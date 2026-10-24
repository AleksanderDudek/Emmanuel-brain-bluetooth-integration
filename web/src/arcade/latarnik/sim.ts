/**
 * Latarnik's rules and state, without the DOM or the canvas (so every rule is unit-tested).
 *
 * A lighthouse stands in the middle of a round sea of radius R.  Its beam, a 20° wedge, turns
 * clockwise; boats drift in from the horizon toward the reef ring at 0.18 R.  A tap ("Błysk")
 * lights every boat inside the wedge and within the beam's reach: they sail into the harbour with
 * cargo by distance.  An unlit boat that reaches the reef turns back and costs one of the watch's
 * three lanterns — losses come from touch only, because the reef lies inside the shortest reach,
 * and a boat of the first-ever warm-up costs nothing at all.  A tap that finds a boat only beyond
 * the reach costs nothing either: the touch was right, the light fell short.
 *
 * The band only ever adds potential.  Reach = 0.42 R + 0.58 R × L, L being the kit's `level`
 * smoothed again (τ 3 s, 1 s on EEG), plus a steadiness bonus from `hold`.  The session alternates
 * Konwój (push: ships far out, reach pays triple) with Cisza (rest: `calm` grows a glow over the
 * sea that reveals amber), each judged once at its end by the kit's RoundJudge.  The lamp answers
 * focus only in a Konwój: in a Cisza the reach and the lamp hold where the Konwój left them, so the
 * glow is the one thing the band changes there.  While the signal is unreliable everything
 * brain-driven freezes: the reach holds, boats and the block clock stop, no far ships spawn — and
 * taps still work; after a long dropout nothing may fall while the band's numbers climb back, and
 * the plan gives the lost time back from the Konwój blocks so the closing Cisza stays whole.
 *
 * Boats come on a schedule that keeps its beat whatever happens on the sea, each from its own
 * numbers: on the day's first session ("Noc dnia") those come from the date, so the n-th boat of
 * the night is the same for everyone who plays the same length.
 *
 * Angles are radians, clockwise on screen (canvas y points down); distances are in R.
 */
import { mulberry32 } from '../../core/random';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { ArcadeOutcome } from '../kit/types';
import { AMBER, LETTERS, TIERS, TIER_NAME, TIPS, VILLAGE, boatWord, boats, crates, farShips, plural, type AmberPiece, type Tier } from './content';
import { addCrumbs, daysBetween, drawAmber, nextMissing, village, welcomeBonus, type LatarnikProgress } from './meta';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const RULES = {
  /** half-widths of the beam's wedge and of its "Idealnie" core */
  wedge: 10 * DEG,
  perfect: 4 * DEG,
  /** a flash is judged this long before the frame that received it (touch latency) */
  latency: 0.03,
  /** a flash on empty water: the lamp recharges this long (s) */
  recharge: 0.6,
  /** the beam's turn (rad/s); the very first watch turns slower */
  speed: 110 * DEG,
  firstSpeed: 90 * DEG,
  reef: 0.18,
  /** boats drift in at `drift` R/s, at `driftSlow` inside `slowFrom` */
  slowFrom: 0.5,
  drift: 0.05,
  driftSlow: 0.03,
  bottleDrift: 0.02,
  leaveSpeed: 0.14,
  /** cargo bands: 1 crate inside `near`, 2 up to `far`, 3 beyond */
  near: 0.4,
  far: 0.7,
  reachMin: 0.42,
  reachGain: 0.58,
  /** the lens settles after a step of the bonuses (s) */
  reachTau: 0.6,
  holdStep: 6,
  holdBonus: 0.04,
  holdMax: 0.12,
  holdDecay: 3,
  /** sessions 1–3 of the game: +0.06 R, fading out */
  beginner: 0.06,
  /** after two failed Konwój blocks in a row the next gets a little help */
  failBoost: 0.04,
  tau: 3,
  tauEeg: 1,
  /** the first watch's warm-up, a no-feedback pre-run: a fixed beam that reaches every warm-up boat, a steady lamp */
  warmReach: 0.62,
  warmLens: 0.6,
  lanterns: 3,
  maxBoats: 4,
  /** the warm-up keeps to two boats at a time, each placed ahead of the beam */
  warmBoats: 2,
  fullLight: 8,
  /** the sea glow grows from the shore while calm ≥ glowCalm */
  glowFrom: 0.18,
  glowGrow: 0.04,
  glowShrink: 0.02,
  glowMax: 0.6,
  glowCalm: 0.5,
  nuggets: 4,
  rareCalm: 0.6,
  rareSec: 12,
  legendContrast: 5,
  tallHold: 12,
  spawnEvery: 3,
  spawnJitter: 0.6,
  warmSpawnEvery: 3.5,
  /** no block is shorter, also when the plan gives fog's time back (s) */
  minBlock: 12,
  /** the watch's "Świt" card, the session's finisher, the telegraph before a block (s) */
  watchCard: 2,
  /** the lesson's beam waits on the first boat at most this long (s); the next boat follows soon after */
  lessonSec: 6,
  afterLesson: 1.5,
  /** a new watch's first boat comes this soon (s) */
  watchFirst: 0.5,
  finale: 3.6,
  telegraph: 4,
  starCrates: 5,
  /** a ship this close beyond the reach shows "zabrakło N%" */
  nearMiss: 0.08,
  /**
   * After a dropout of `fogGap` s the kit's level and calm have faded to zero and climb back over a
   * few seconds; for `recover` s after it nothing brain-driven may fall (the signal took it, not the player).
   */
  fogGap: 2,
  recover: 6,
} as const;

/** Where boats appear (R). */
export const BANDS = {
  horizon: [0.9, 0.99],
  mid: [0.48, 0.68],
  near: [0.38, 0.46],
  /** the warm-up's boats: three passes of the beam or more before the reef */
  warm: [0.5, 0.6],
  /** the night's first boat: within any reach the lamp starts with */
  first: [0.45, 0.53],
} as const satisfies Record<string, readonly [number, number]>;
export type Band = keyof typeof BANDS;

/** Random numbers per scheduled spawn: always this many, so no spawn shifts the next one's. */
const DRAWS = 11;
/** The scheduled spawns remembered: a new boat keeps clear of them, a convoy lines up behind them. */
const LANES = 4;
/** On "Noc dnia" the n-th scheduled spawn draws from mulberry32(daySeed + NIGHT_STEP · n). */
export const NIGHT_STEP = 7919;
/** …and the night's plan from its own stream. */
const PLAN_SALT = 0x2545f491;

export type BlockKind = 'warmup' | 'konwoj' | 'cisza';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

export type BoatKind = 'kuter' | 'zaglowka' | 'prom' | 'drobnicowiec' | 'zaglowiec' | 'butelka';
export type BoatState = 'sea' | 'home' | 'leaving' | 'gone';

export interface Boat {
  readonly id: number;
  /** its number in the night's schedule (−1: outside it — the bottle) */
  readonly n: number;
  readonly kind: BoatKind;
  /** bearing from the lamp and distance */
  a: number;
  r: number;
  /** the warm-up's first boat waits for its light */
  anchored: boolean;
  state: BoatState;
  /** seconds in this state */
  t: number;
  /** where it was lit (home) or turned back (leaving) */
  a0: number;
  r0: number;
  /** its sail into the harbour (s) */
  dur: number;
  cargo: number;
  perfect: boolean;
  /** far out in a blind Konwój: a silhouette without its lantern */
  readonly dark: boolean;
  /** born in the first-ever warm-up: if it reaches the reef unlit it turns back at no cost */
  readonly practice: boolean;
  /** its own bobbing phase */
  readonly phase: number;
}

export interface Nugget { a: number; r: number; revealed: boolean; size: number }

export type SimEvent =
  | { type: 'flash'; boats: Boat[]; perfect: boolean; full: boolean; streak: number; cargo: number }
  | { type: 'empty' }
  /** the wedge held a boat only beyond the reach: no cost; `hint`: show "zabrakło N%" (a Konwój with its ring) */
  | { type: 'short'; boat: Boat; short: number; hint: boolean }
  | { type: 'armed' }
  | { type: 'home'; boat: Boat }
  | { type: 'reef'; boat: Boat; lanterns: number; free: boolean }
  | { type: 'bottle'; boat: Boat; letter: number }
  | { type: 'tallShip'; boat: Boat }
  | { type: 'watchEnd'; watch: number; boats: number }
  | { type: 'watchStart'; watch: number }
  | { type: 'telegraph'; next: BlockKind }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null }
  | { type: 'star'; lanterns: number }
  | { type: 'steady'; bonus: number }
  | { type: 'blindReveal'; far: number }
  | { type: 'reveal'; nugget: Nugget }
  | { type: 'washUp'; nuggets: Nugget[] }
  | { type: 'amber'; piece: number; isNew: boolean; via: 'draw' | 'craft' | 'pity'; tier: Tier }
  | { type: 'built'; step: number }
  | { type: 'welcome'; crates: number }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];

// ── pure rules ───────────────────────────────────────────────────
/** a − b wrapped into (−π, π]. */
export function angDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;

export const cargoAt = (r: number): number => (r < RULES.near ? 1 : r <= RULES.far ? 2 : 3);

/** The reach (R) for the doubly smoothed level L and the bonuses on top. */
export const reachFor = (L: number, bonus = 0): number => RULES.reachMin + RULES.reachGain * clamp(L) + bonus;

/** +0.04 R per 6 s of steady focus, up to +0.12 R. */
export const holdTarget = (hold: number): number =>
  Math.min(RULES.holdMax, Math.floor(Math.max(0, hold) / RULES.holdStep) * RULES.holdBonus);

/** The first three sessions lean toward the player: +0.06, +0.04, +0.02 R. */
export const beginnerBonus = (session: number): number =>
  (session >= 1 && session <= 3 ? (RULES.beginner * (4 - session)) / 3 : 0);

/** Konwój: 60 % of spawns at the horizon (none while the signal is unreliable); Cisza: mid and near only. */
export function pickBand(kind: BlockKind, u: number, reliable: boolean): Band {
  if (kind === 'warmup') return 'warm';
  if (kind === 'cisza') return u < 0.6 ? 'mid' : 'near';
  const band: Band = u < 0.6 ? 'horizon' : u < 0.88 ? 'mid' : 'near';
  return band === 'horizon' && !reliable ? 'mid' : band;
}

export function pickKind(band: Band, u: number): BoatKind {
  if (band === 'horizon') return u < 0.3 ? 'drobnicowiec' : u < 0.55 ? 'prom' : u < 0.8 ? 'kuter' : 'zaglowka';
  return u < 0.5 ? 'kuter' : u < 0.82 ? 'zaglowka' : 'prom';
}

/** Where a boat born at `r` would be after `sec` s of undisturbed drift (R). */
export function drifted(r: number, sec: number): number {
  const fast = Math.max(0, Math.min(sec, (r - RULES.slowFrom) / RULES.drift));
  return r - RULES.drift * fast - RULES.driftSlow * Math.max(0, sec - fast);
}

/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks: the first-ever session opens with a "Pierwsza wachta" warm-up (12 s in a
 * 40 s session, else 30 s), then Konwój/Cisza pairs (26 ± 4 s and 22 ± 3 s, scaled to fill the
 * session) ending with a Cisza, leaving the last seconds to the finisher.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const plan: Block[] = [];
  let left = Math.max(0, plannedSec - RULES.finale);
  if (firstEver) {
    const warm = plannedSec <= 60 ? 12 : 30;
    plan.push({ kind: 'warmup', dur: warm, blind: false });
    left = Math.max(0, left - warm);
  }
  const pairs = Math.max(1, Math.round(left / 48));
  const jitter = left / (pairs * 48) >= 0.75 ? 1 : 0;   // short sessions: no jitter, or a block falls under 12 s
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(26 + jitter * (rnd() * 2 - 1) * 4, 22 + jitter * (rnd() * 2 - 1) * 3);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, RULES.minBlock);
  durs.forEach((dur, i) => plan.push({ kind: i % 2 ? 'cisza' : 'konwoj', dur, blind: false }));
  return plan;
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: LatarnikProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning (the kit's defaults, the game's entry, a beginner's bias): the blocks' judges follow it */
  tuning: FocusTuning;
}

export type Phase = 'play' | 'watchEnd' | 'finale' | 'done';

export class LatarnikSim {
  readonly p: LatarnikProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly tau: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private readonly events: SimEvent[] = [];

  started = false;
  /** this session's number in the game (1 = the first ever) */
  session = 0;
  /** the day's first session: "Noc dnia", its boats and plan from the date */
  daily = false;
  plan: Block[] = [];
  blockIndex = 0;
  /** seconds into the block (the block clock stops while the signal is unreliable) */
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  tip = '';
  /** yesterday's (or the last day's) best reach: a faint ring to beat */
  ghost: { reach: number; label: string } | null = null;

  // the lamp
  beam = -Math.PI / 2;
  /** the beam's turn now (rad/s) and its nominal speed */
  omega: number = RULES.speed;
  speed: number = RULES.speed;
  /**
   * The first-ever session's lesson: the warm-up's first boat waits at anchor, and when the beam first
   * reaches it the beam stops on it ("Stuknij teraz") until it is lit, at most `lessonSec`.
   */
  lesson: 'wait' | 'hold' | 'done' = 'done';
  private lessonBoat: Boat | null = null;
  private phaseLesson = 0;
  recharge = 0;
  /** the level smoothed again; it starts where a resting player's level sits */
  L = 0.3;
  /** the level the lamp shows: L in a Konwój with its ring; held in a Cisza and a blind Konwój; fixed in the warm-up */
  lens = 0.3;
  holdBonus = 0;
  private decayRate = 0;
  private boost = 0;
  private boostOn = false;
  reach: number = RULES.warmReach;
  reliable = false;
  fog = 0;
  /** the steady stretch that counts for the bonus: the hold within this Konwój, carried over a dropout */
  hold = 0;
  calm = 0;
  /** the kit's hold at the last reliable frame, and a stretch the kit restarted during a dropout */
  private rawHold = 0;
  private holdCarry = 0;
  /** seconds of the current dropout; seconds left after a long one in which nothing brain-driven may fall */
  private fogT = 0;
  private recover = 0;

  // the sea
  readonly boats: Boat[] = [];
  private ids = 0;
  /**
   * The night's spawn schedule: seconds to the next scheduled boat, its number and the schedule's
   * own clock.  It keeps its beat whatever happens on the sea — a full sea skips a boat, and so does a
   * watch's card — so on "Noc dnia" the n-th boat is the same for everyone.
   */
  spawnT = 0.35;
  private spawnN = 0;
  private seaT = 0;
  private readonly u = new Float64Array(DRAWS);
  /** the last LANES scheduled spawns (sailing or skipped): bearing, distance, sea time */
  private readonly laneA = new Float64Array(LANES);
  private readonly laneR = new Float64Array(LANES);
  private readonly laneT = new Float64Array(LANES);
  private laneN = 0;
  /** a new watch: seconds until its easy first boat comes (0: none waiting) */
  private watchFirst = 0;
  glow = 0;
  nuggets: Nugget[] = [];
  private bottleAt = -1;
  private bottleDue = false;
  private tallDue = false;
  private tallSpawned = false;
  private calmRun = 0;
  private calmFeat = false;
  private failStreak = 0;
  private legendGiven = false;

  // the watch
  watch = 1;
  lanterns: number = RULES.lanterns;
  watchBoats = 0;
  streak = 0;
  maxStreak = 0;
  armed = false;

  // the session's tallies
  score = 0;
  crates = 0;
  bestWatch = 0;
  farthest = 0;
  starsWon = 0;
  konwojJudged = 0;
  blindFar = 0;
  nuggetsFound = 0;
  private gotNew = false;
  private pity = false;
  /** what the summary may tell (result() ranks it) */
  private readonly newAmber: number[] = [];
  private readonly builtNow: number[] = [];
  private letterNow = 0;
  private tallNow = 0;
  private fullNow = 0;
  private welcomeNow = 0;
  private blindFarAll = 0;
  /** the records before this session (bestBefore null: the first session, where everything is new) */
  private readonly bestBefore: number | null;
  private readonly before: { watch: number; streak: number; farthest: number };
  /**
   * Konwój blocks begun before this session and in it (every 4th is blind).  Like the session's
   * own number they reach the progress only in result(), so an unsaved session does not count.
   */
  private konwojeBase = 0;
  private konwojeBegun = 0;

  constructor(private readonly init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.tau = init.eeg ? RULES.tauEeg : RULES.tau;
    this.judge = RoundJudge.from(init.tuning);
    this.bestBefore = this.p.sessions > 0 ? this.p.bestSession : null;
    this.before = { watch: this.p.bestWatch, streak: this.p.bestStreak, farthest: this.p.farthest };
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get blind(): boolean { return this.block?.kind === 'konwoj' && this.block.blind; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  /** seconds until the next block begins (null: the last block) */
  get toNext(): number | null { return this.next ? Math.max(0, this.block.dur - this.blockT) : null; }

  start(): void {
    if (this.started) return;
    this.started = true;
    const p = this.p, day = this.init.day;
    // the session (and its Konwój blocks, and the day's "Noc dnia") reach the progress in result(),
    // which only a saved session calls: an abandoned first attempt leaves the next one the first
    this.session = p.sessions + 1;
    this.konwojeBase = p.konwoje;
    this.daily = p.dailyDay !== day;
    this.omega = this.speed = this.session === 1 ? RULES.firstSpeed : RULES.speed;
    this.pity = this.session - p.lastNewSession >= 2 && nextMissing(p, false) !== null;
    this.bottleDue = p.letters < LETTERS.length;
    if (p.reachDay !== day) {
      if (p.reachDay && p.reachBest > 0) {
        p.reachPrev = p.reachBest;
        p.reachPrevDay = p.reachDay;
      }
      p.reachDay = day;
      p.reachBest = 0;
    }
    if (p.reachPrev > 0) this.ghost = { reach: p.reachPrev, label: daysBetween(p.reachPrevDay, day) === 1 ? 'wczoraj' : 'ostatnio' };
    const bonus = welcomeBonus(p, day);
    p.lastDay = day;
    p.lastCrates = 0;
    this.plan = planBlocks(this.plannedSec, this.session === 1, this.daily ? mulberry32((this.init.daySeed ^ PLAN_SALT) >>> 0) : this.rng);
    const warm = this.plan[0].kind === 'warmup';
    this.reach = warm ? RULES.warmReach : reachFor(this.L, beginnerBonus(this.session));
    this.lens = warm ? RULES.warmLens : this.L;
    this.startBlock(0);
    if (bonus > 0) {
      this.addCrates(bonus, false);
      this.welcomeNow = bonus;
      this.emit({ type: 'welcome', crates: bonus });
    }
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.reliable = f.reliable;
    this.turn(dt);
    this.recharge = Math.max(0, this.recharge - dt);
    this.fog = approach(this.fog, f.reliable ? 0 : 1, dt, 0.7);
    this.phaseT += dt;
    this.brain(dt, f);
    if (this.phase === 'watchEnd' && this.phaseT >= RULES.watchCard) this.newWatch();
    else if (this.phase === 'finale' && this.phaseT >= RULES.finale) this.phase = 'done';
    const night = this.phase === 'play' || this.phase === 'watchEnd';
    if (night) this.schedule(dt, f, t);
    this.seaGlow(dt, f);
    if (night) this.spawner(dt);
    this.moveBoats(dt);
  }

  private turn(dt: number): void {
    const lb = this.lessonBoat;
    if (this.lesson === 'wait' && lb) {
      if (lb.state !== 'sea' || this.block.kind !== 'warmup') this.endLesson();
      else if (Math.abs(angDiff(lb.a, this.beam)) <= this.omega * dt + 1e-6) {
        this.beam = lb.a;   // the beam stops on the boat: "Stuknij teraz"
        this.omega = 0;
        this.lesson = 'hold';
        this.phaseLesson = 0;
        return;
      }
    }
    if (this.lesson === 'hold') {
      this.phaseLesson += dt;
      if (lb?.state === 'sea' && this.phaseLesson < RULES.lessonSec) return;
      this.endLesson();
    }
    this.omega = approach(this.omega, this.speed, dt, 0.25);
    this.beam = wrap(this.beam + this.omega * dt);
  }

  /** The sea waited for the lesson; now it moves again and the next boat comes soon. */
  private endLesson(): void {
    this.lesson = 'done';
    if (this.lessonBoat) this.lessonBoat.anchored = false;   // unlit, it sails on like the others
    this.spawnT = Math.min(this.spawnT, RULES.afterLesson);
  }

  /**
   * The band's slow quantities.  L always follows the level (silently outside a Konwój), so every
   * Konwój starts honestly; the reach and the lamp answer it only in a Konwój, the lamp only where
   * the ring shows (not blind).  A Cisza holds them where the Konwój left them, and the steadiness
   * bonus counts the hold within the Konwój, so focus during rest is neither shown nor rewarded.
   */
  private brain(dt: number, f: FocusFrame): void {
    if (!f.reliable) {
      this.fogT += dt;   // the reach and the lamp hold, dimmed, at their last values
      this.calm = 0;
      return;
    }
    if (this.fogT > 0) {
      // back from a dropout.  After a long one the kit's level and calm climb back from zero: for a
      // while nothing may fall.  The kit also restarts a hold that the gap broke: the stretch carries on.
      if (this.fogT >= RULES.fogGap) this.recover = RULES.recover;
      if (f.hold < this.rawHold) this.holdCarry += this.rawHold;
      this.fogT = 0;
    } else this.recover = Math.max(0, this.recover - dt);
    if (!f.focused && this.recover <= 0) this.holdCarry = 0;   // the stretch broke for real
    this.rawHold = f.hold;
    this.calm = f.calm;
    const L = approach(this.L, clamp(f.level), dt, this.tau);
    this.L = this.recover > 0 ? Math.max(this.L, L) : L;
    const b = this.block;
    if (b.kind === 'warmup') {
      // the no-feedback pre-run: a fixed beam and a steady lamp
      this.hold = 0;
      this.reach = approach(this.reach, RULES.warmReach, dt, RULES.reachTau);
      this.lens = approach(this.lens, RULES.warmLens, dt, RULES.reachTau);
      return;
    }
    if (b.kind === 'cisza') {
      this.hold = 0;   // rest: the reach, its bonuses and the lamp hold where the Konwój left them
      return;
    }
    const sighted = !b.blind;
    this.hold = Math.min(this.holdCarry + f.hold, this.blockT);
    const target = holdTarget(this.hold);
    if (target >= this.holdBonus) {
      // each 6 s step of steady focus is a moment of its own: the lens tightens a notch
      if (target > this.holdBonus + 1e-9 && sighted) this.emit({ type: 'steady', bonus: target });
      this.holdBonus = target;
      this.decayRate = 0;
    } else {
      // the hold broke: the bonus eases off over 3 s instead of vanishing
      if (this.decayRate === 0) this.decayRate = this.holdBonus / RULES.holdDecay;
      this.holdBonus = Math.max(target, this.holdBonus - this.decayRate * dt);
    }
    this.boost = approach(this.boost, this.boostOn ? RULES.failBoost : 0, dt, 1);
    this.reach = approach(this.reach, reachFor(this.L, this.holdBonus + beginnerBonus(this.session) + this.boost), dt, RULES.reachTau);
    if (sighted) this.lens = approach(this.lens, this.L, dt, RULES.reachTau);
    if (this.phase === 'play' || this.phase === 'watchEnd') {
      this.farthest = Math.max(this.farthest, this.reach);
      this.p.reachBest = Math.max(this.p.reachBest, this.reach);
    }
  }

  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block;
    if (f.reliable) this.blockT += dt;
    this.fitPlan(t);
    if (b.kind !== 'warmup') {
      const want = b.kind === 'konwoj' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (f.reliable) {
      if (b.kind === 'cisza') {
        // while the kit's calm climbs back after a dropout, a dip does not break the run
        if (f.calm >= RULES.rareCalm) this.calmRun += dt;
        else if (this.recover <= 0) this.calmRun = 0;
        if (this.calmRun >= RULES.rareSec) this.calmFeat = true;
      }
      if (b.kind === 'konwoj' && this.hold >= RULES.tallHold && !this.tallSpawned) this.tallDue = true;
    }
    if (b.kind === 'konwoj' && this.bottleAt >= 0 && this.blockT >= this.bottleAt && this.phase === 'play') {
      this.bottleAt = -1;
      if (!this.boats.some(x => x.kind === 'butelka' && x.state === 'sea')) this.spawn({ band: 'mid', kind: 'butelka' });
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!last && !this.telegraphed && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: this.plan[this.blockIndex + 1].kind });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - RULES.finale) {
      this.endBlock();
      this.startFinale();
    } else if (!last && this.blockT >= b.dur) {
      this.endBlock();
      this.startBlock(this.blockIndex + 1);
    }
  }

  /**
   * The plan ends with the session.  When fog (or a slow device) has held the block clock back, the
   * Konwój blocks still to come give the delay back — then the one running, then the Cisza blocks
   * before the last — down to 12 s each, so the closing Cisza stays whole.
   */
  private fitPlan(t: number): void {
    const plan = this.plan, i0 = this.blockIndex, cur = plan[i0];
    let need = Math.max(0, cur.dur - this.blockT);
    for (let i = i0 + 1; i < plan.length; i++) need += plan[i].dur;
    let over = need - (this.plannedSec - RULES.finale - t);
    if (over < 0.05) return;
    over = this.giveBack(over, i0 + 1, 'konwoj', 0);
    if (over > 0 && cur.kind === 'konwoj') {
      const k = Math.min(over, Math.max(0, cur.dur - Math.max(RULES.minBlock, this.blockT)));
      cur.dur -= k;
      over -= k;
    }
    if (over > 0) this.giveBack(over, i0 + 1, 'cisza', 1);
  }

  /** Take up to `over` s from the blocks of `kind` from `from` on (never the last `keep`), each in proportion to its time above 12 s. */
  private giveBack(over: number, from: number, kind: BlockKind, keep: number): number {
    const plan = this.plan, end = plan.length - keep;
    let spare = 0;
    for (let i = from; i < end; i++) if (plan[i].kind === kind) spare += Math.max(0, plan[i].dur - RULES.minBlock);
    if (spare <= 0) return over;
    const k = Math.min(1, over / spare);
    for (let i = from; i < end; i++) if (plan[i].kind === kind) plan[i].dur -= Math.max(0, plan[i].dur - RULES.minBlock) * k;
    return over - spare * k;
  }

  private startBlock(i: number): void {
    this.blockIndex = i;
    this.blockT = 0;
    this.telegraphed = false;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind !== 'warmup') for (const x of this.boats) x.anchored = false;
    if (b.kind === 'konwoj') {
      this.konwojeBegun++;
      b.blind = this.session >= 3 && (this.konwojeBase + this.konwojeBegun) % 4 === 0;
      this.blindFar = 0;
      this.tallDue = false;
      this.tallSpawned = false;
      this.boostOn = this.failStreak >= 2;
      this.bottleAt = this.bottleDue ? 3 + this.rng() * 4 : -1;
    } else if (b.kind === 'cisza') {
      this.calmRun = 0;
      this.calmFeat = false;
      this.nuggets = [];
      for (let k = 0; k < RULES.nuggets; k++) {
        this.nuggets.push({ a: this.rng() * TAU, r: 0.25 + k * 0.12 + this.rng() * 0.1, revealed: false, size: 0.75 + this.rng() * 0.5 });
      }
    }
    const list = b.kind === 'konwoj' && b.blind ? TIPS.blind : TIPS[b.kind];
    // the lines rotate from session to session; the very first session starts each list at its first line
    this.tip = first && this.session <= 2 && b.kind === 'konwoj' ? TIPS.firstKonwoj
      : first && this.session <= 2 && b.kind === 'cisza' ? TIPS.firstCisza
        : list[(this.session - 1 + i) % list.length];
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null;
    if (b.kind === 'konwoj') {
      verdict = this.judge.verdict();
      if (verdict !== null) this.konwojJudged++;
      if (verdict) {
        // "Gwiazda latarni": a lantern back (relief bought with focus) and five crates
        this.starsWon++;
        this.p.stars++;
        this.failStreak = 0;
        if (this.phase === 'play') this.lanterns = Math.min(RULES.lanterns, this.lanterns + 1);
        this.emit({ type: 'star', lanterns: this.lanterns });
        this.addCrates(RULES.starCrates);
      } else if (verdict === false) this.failStreak++;
      this.tallDue = false;
      if (b.blind) {
        this.blindFarAll += this.blindFar;
        this.emit({ type: 'blindReveal', far: this.blindFar });
      }
    } else if (b.kind === 'cisza') {
      verdict = this.judge.verdict();
      const found = this.nuggets.filter(n => n.revealed);
      this.nuggets = [];
      if (found.length) {
        this.nuggetsFound += found.length;
        this.emit({ type: 'washUp', nuggets: found });
        this.crafted(addCrumbs(this.p, found.length));
      }
      if (verdict) this.albumDraw();
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict });
  }

  /** A successful Cisza: the honest feat sets the tier, the piece is drawn evenly within it. */
  private albumDraw(): void {
    const prev = this.plan[this.blockIndex - 1];
    const c = this.contrast.contrast;
    let tier: Tier = this.calmFeat ? 'rare' : 'common';
    if (prev?.kind === 'konwoj' && prev.blind) tier = 'epic';
    if (!this.legendGiven && c !== null && c >= RULES.legendContrast) {
      tier = 'legend';
      this.legendGiven = true;
    }
    const d = drawAmber(this.p, tier, this.rng, this.pity && !this.gotNew);
    this.amberGot(d.piece, d.isNew, 'draw');
    this.crafted(d.crafted);
  }

  private crafted(pieces: number[]): void {
    for (const piece of pieces) this.amberGot(piece, true, 'craft');
  }

  private amberGot(piece: number, isNew: boolean, via: 'draw' | 'craft' | 'pity'): void {
    const a = AMBER[piece];
    if (isNew) {
      this.gotNew = true;
      this.p.lastNewSession = this.session;
      this.newAmber.push(piece);
    }
    this.emit({ type: 'amber', piece, isNew, via, tier: a.tier });
  }

  private startFinale(): void {
    this.phase = 'finale';
    this.phaseT = 0;
    this.bestWatch = Math.max(this.bestWatch, this.watchBoats);
    for (const b of this.boats) if (b.state === 'sea') this.turnBack(b);
    if (this.pity && !this.gotNew) {
      // pity: a new piece at least every second session, washed up at dawn (never a legendary one)
      const m = nextMissing(this.p, false);
      if (m !== null) {
        this.p.amber.push(m);
        this.amberGot(m, true, 'pity');
      }
    }
    this.emit({ type: 'finale' });
  }

  /**
   * The session ends before its own dawn ("Zakończ i zapisz", the runner's overtime limit): settle
   * as the dawn would — the open block is judged and its amber washes up, and the pity piece is
   * rolled.  Nothing more once the dawn has come.  The view is gone by then: no animation follows.
   */
  finish(): void {
    if (!this.started || this.phase === 'finale' || this.phase === 'done') return;
    this.endBlock();
    this.startFinale();
  }

  private endWatch(): void {
    this.bestWatch = Math.max(this.bestWatch, this.watchBoats);
    this.phase = 'watchEnd';
    this.phaseT = 0;
    this.streak = 0;
    for (const b of this.boats) if (b.state === 'sea') this.turnBack(b);
    this.emit({ type: 'watchEnd', watch: this.watch, boats: this.watchBoats });
  }

  private newWatch(): void {
    this.watch++;
    this.watchBoats = 0;
    this.lanterns = RULES.lanterns;
    this.phase = 'play';
    this.phaseT = 0;
    this.watchFirst = RULES.watchFirst;
    this.speed = RULES.speed;   // only the very first watch turns slower
    this.emit({ type: 'watchStart', watch: this.watch });
  }

  private seaGlow(dt: number, f: FocusFrame): void {
    const cisza = this.block.kind === 'cisza' && (this.phase === 'play' || this.phase === 'watchEnd');
    if (!cisza) {
      this.glow = Math.max(0, this.glow - 0.15 * dt);   // the glow ebbs after its block
      return;
    }
    if (!f.reliable) return;   // frozen: no reward, no loss
    // after a dropout the kit's calm climbs back from zero: meanwhile the glow may grow, not shrink
    const grow = f.calm >= RULES.glowCalm;
    if (grow || this.recover <= 0) this.glow = clamp(this.glow + (grow ? RULES.glowGrow : -RULES.glowShrink) * dt, 0, RULES.glowMax);
    const edge = RULES.glowFrom + this.glow;
    for (const n of this.nuggets) {
      if (!n.revealed && n.r <= edge) {
        n.revealed = true;
        this.emit({ type: 'reveal', nugget: n });
      }
    }
  }

  // ── the night's boats ───────────────────────────────────────────
  private spawner(dt: number): void {
    if (this.lesson !== 'done') return;   // the lesson's sea waits for its first light
    this.seaT += dt;
    this.spawnT -= dt;
    if (this.watchFirst > 0 && (this.watchFirst -= dt) <= 0 && this.phase === 'play') this.firstBoat();
    while (this.spawnT <= 0) this.slot();
  }

  /** A new watch's easy first boat: just ahead of the beam and within its reach, the player's own (outside the schedule). */
  private firstBoat(): void {
    this.spawn({ band: 'mid', a: this.beam + (70 + this.rng() * 30) * DEG, r: clamp(this.reach - 0.08, BANDS.near[0], BANDS.mid[1]) });
  }

  /**
   * The night's next scheduled boat, due `spawnT` s from now (≤ 0: due already).  Its numbers come
   * from its own stream on "Noc dnia", and its bearing from the beam at the due time and the last
   * few scheduled spawns — never from what happens to be on the sea — so the n-th boat is the same
   * for everyone.  A full sea (or a watch's card) skips it.  Only this player's: the tall ship that
   * takes the place of one for steady focus.
   */
  private slot(): void {
    const n = this.spawnN++, u = this.recipe(n), due = this.spawnT;
    const at = this.seaT + due, beam = this.beam + this.omega * due;
    const block = this.block, warm = block.kind === 'warmup';
    this.spawnT += (warm ? RULES.warmSpawnEvery : RULES.spawnEvery) + (u[0] * 2 - 1) * RULES.spawnJitter;
    // the night's first boat: just ahead of the beam and within any reach; a warm-up boat: ahead of
    // the beam; any other: clear of the last spawns and out of the light, or behind one of them (a convoy)
    const band: Band = n === 0 && !warm ? 'first' : pickBand(block.kind, u[1], this.reliable);
    const [lo, hi] = BANDS[band];
    let r = lo + (hi - lo) * u[2];
    const a = n === 0 ? beam + (70 + u[3] * 30) * DEG
      : warm ? beam + (40 + u[3] * 100) * DEG
        : this.convoyBearing(r, band, u, at) ?? this.freeBearing(r, u[3], u[4], u[5], beam, at);
    this.lane(a, r, at);
    if (this.phase !== 'play' || this.alive() >= (warm ? RULES.warmBoats : RULES.maxBoats)) return;
    let kind = pickKind(band, u[6]);
    if (this.tallDue && this.reliable && block.kind === 'konwoj') {
      // the rare żaglowiec: at the horizon, after 12 s of steady focus within a Konwój
      kind = 'zaglowiec';
      r = BANDS.horizon[0] + (BANDS.horizon[1] - BANDS.horizon[0]) * u[2];
      this.tallDue = false;
      this.tallSpawned = true;
    }
    const b = this.launch(kind, a, r, u[7] * TAU, n);
    if (n === 0 && warm) {
      b.anchored = true;   // the lesson: the first boat ever waits for its light
      this.lessonBoat = b;
      this.lesson = 'wait';
    }
  }

  /** The numbers of the night's n-th scheduled spawn: on "Noc dnia" from its own stream, else from the session's. */
  private recipe(n: number): Float64Array {
    const rnd = this.daily ? mulberry32((this.init.daySeed + NIGHT_STEP * n) >>> 0) : this.rng;
    for (let i = 0; i < DRAWS; i++) this.u[i] = rnd();
    return this.u;
  }

  private lane(a: number, r: number, at: number): void {
    const i = this.laneN++ % LANES;
    this.laneA[i] = wrap(a);
    this.laneR[i] = r;
    this.laneT[i] = at;
  }

  /** Where the i-th remembered spawn would be at sea time `at` (R). */
  private laneAt(i: number, at: number): number {
    return drifted(this.laneR[i], at - this.laneT[i]);
  }

  /** The first of three candidate bearings (c0..c2 in turns) clear of the recent spawns at a similar distance and out of the beam. */
  private freeBearing(r: number, c0: number, c1: number, c2: number, beam: number, at: number): number {
    const m = Math.min(this.laneN, LANES);
    let best = 0, bestGap = -1;
    for (let k = 0; k < 3; k++) {
      const a = (k === 0 ? c0 : k === 1 ? c1 : c2) * TAU;
      let gap = Math.PI;
      for (let i = 0; i < m; i++) if (Math.abs(this.laneAt(i, at) - r) < 0.2) gap = Math.min(gap, Math.abs(angDiff(a, this.laneA[i])));
      if (Math.abs(angDiff(a, beam)) < RULES.wedge * 2) gap *= 0.3;   // never appear already in the light
      if (gap > bestGap) {
        best = a;
        bestGap = gap;
      }
      if (gap > 20 * DEG) break;
    }
    return best;
  }

  /** A convoy: now and then a boat takes the bearing of a recent spawn closer in, so the beam can line them up (Szereg). */
  private convoyBearing(r: number, band: Band, u: Float64Array, at: number): number | null {
    const chance = band === 'horizon' ? 0.3 : band === 'mid' && this.block.kind === 'cisza' ? 0.2 : 0;
    if (!(u[8] < chance)) return null;
    const m = Math.min(this.laneN, LANES);
    let leads = 0;
    for (let i = 0; i < m; i++) if (this.leads(i, r, at)) leads++;
    let k = Math.min(leads - 1, Math.floor(u[9] * leads));
    for (let i = 0; i < m; i++) if (this.leads(i, r, at) && k-- === 0) return this.laneA[i] + (u[10] * 2 - 1) * 2 * DEG;
    return null;
  }

  /** Whether the i-th remembered spawn is still inbound and closer in than a new boat at `r`. */
  private leads(i: number, r: number, at: number): boolean {
    const q = this.laneAt(i, at);
    return q < r - 0.15 && q > RULES.reef + 0.04;
  }

  /** Boats on the sea that count toward the cap (the bottle does not). */
  alive(): number {
    let n = 0;
    for (const b of this.boats) if (b.state === 'sea' && b.kind !== 'butelka') n++;
    return n;
  }

  /** A boat outside the night's schedule (the bottle; tests): what `o` leaves open comes from the session's generator. */
  spawn(o: { band?: Band; a?: number; r?: number; kind?: BoatKind } = {}): Boat {
    const rnd = this.rng;
    const band = o.band ?? pickBand(this.block.kind, rnd(), this.reliable);
    const [lo, hi] = BANDS[band];
    const r = o.r ?? lo + (hi - lo) * rnd();
    const a = o.a ?? (band === 'warm' ? this.beam + (40 + rnd() * 100) * DEG : this.freeBearing(r, rnd(), rnd(), rnd(), this.beam, this.seaT));
    return this.launch(o.kind ?? pickKind(band, rnd()), a, r, rnd() * TAU, -1);
  }

  private launch(kind: BoatKind, a: number, r: number, phase: number, n: number): Boat {
    const boat: Boat = {
      id: ++this.ids, n, kind, a: wrap(a), r, anchored: false, state: 'sea', t: 0, a0: a, r0: r, dur: 0, cargo: 0, perfect: false,
      dark: this.blind && r > RULES.far && kind !== 'butelka', practice: this.block.kind === 'warmup', phase,
    };
    this.boats.push(boat);
    return boat;
  }

  private moveBoats(dt: number): void {
    // fog: everything waits, so nothing can be lost; the lesson: the sea waits for its first light
    const still = !this.reliable || this.lesson !== 'done';
    for (const b of this.boats) {
      b.t += dt;
      if (b.state === 'sea') {
        if (still || b.anchored) continue;
        const v = b.kind === 'butelka' ? RULES.bottleDrift : b.r > RULES.slowFrom ? RULES.drift : RULES.driftSlow;
        b.r -= v * dt;
        if (b.r <= RULES.reef) this.reefHit(b);
      } else if (b.state === 'home') {
        if (b.t >= b.dur) {
          b.state = 'gone';
          this.emit({ type: 'home', boat: b });
        }
      } else if (b.state === 'leaving') {
        b.r += RULES.leaveSpeed * dt;
        if (b.t >= 2.4) b.state = 'gone';
      }
    }
    let n = 0;
    for (const b of this.boats) if (b.state !== 'gone') this.boats[n++] = b;
    this.boats.length = n;
  }

  private reefHit(b: Boat): void {
    b.r = RULES.reef;
    this.turnBack(b);
    if (b.kind === 'butelka') return;   // the bottle drifts back out and returns in the next Konwój
    // a boat of the first-ever warm-up only turns back: the lesson costs nothing
    const free = b.practice;
    if (!free) this.lanterns = Math.max(0, this.lanterns - 1);
    this.emit({ type: 'reef', boat: b, lanterns: this.lanterns, free });
    if (!free && this.lanterns === 0 && this.phase === 'play') this.endWatch();
  }

  private turnBack(b: Boat): void {
    b.state = 'leaving';
    b.t = 0;
    b.a0 = b.a;
    b.r0 = b.r;
  }

  // ── the tap ─────────────────────────────────────────────────────
  /**
   * "Błysk" (a tap anywhere, Space, Enter): every boat in the wedge and within the reach lights up.
   * Empty water breaks the streak and recharges the lamp; a boat only beyond the reach costs nothing.
   */
  flash(): void {
    if (!this.started || this.phase !== 'play' || this.recharge > 0) return;
    const at = this.beam - this.omega * RULES.latency;
    const full = this.armed;
    const lit: Boat[] = [];
    let nearest = Infinity, beyond: Boat | null = null;
    for (const b of this.boats) {
      if (b.state !== 'sea') continue;
      const d = Math.abs(angDiff(b.a, at));
      if (!full && d > RULES.wedge) continue;
      if (b.r > this.reach) {
        if (!beyond || b.r < beyond.r) beyond = b;
        continue;
      }
      lit.push(b);
      nearest = Math.min(nearest, d);
    }
    if (!lit.length) {
      if (beyond) {
        // the touch was right, only the light fell short: no cost; "zabrakło 4%" is feedback on focus,
        // so it shows only where the reach answers it (a Konwój with its ring)
        const short = beyond.r - this.reach;
        const hint = !full && this.block.kind === 'konwoj' && !this.block.blind && beyond.kind !== 'butelka' && short <= RULES.nearMiss;
        this.emit({ type: 'short', boat: beyond, short, hint });
        return;
      }
      this.streak = 0;
      this.recharge = RULES.recharge;
      this.emit({ type: 'empty' });
      return;
    }
    const perfect = !full && nearest <= RULES.perfect;
    let armedNow = false;
    if (full) {
      this.armed = false;
      this.fullNow++;
    } else if (perfect) {
      this.streak++;
      this.maxStreak = Math.max(this.maxStreak, this.streak);
      if (this.streak % RULES.fullLight === 0 && !this.armed) armedNow = this.armed = true;
    } else this.streak = 0;
    let cargo = 0;
    for (const b of lit) cargo += this.light(b, perfect);
    this.emit({ type: 'flash', boats: lit, perfect, full, streak: this.streak, cargo });
    if (armedNow) this.emit({ type: 'armed' });
  }

  private light(b: Boat, perfect: boolean): number {
    b.state = 'home';
    b.t = 0;
    b.a0 = b.a;
    b.r0 = b.r;
    b.perfect = perfect;
    b.dur = 1 + 1.3 * b.r;
    if (b.kind === 'butelka') {
      this.bottleDue = false;
      if (this.p.letters < LETTERS.length) {
        this.letterNow = ++this.p.letters;
        this.emit({ type: 'bottle', boat: b, letter: this.p.letters });
      }
      return 0;
    }
    const cargo = cargoAt(b.r) * (b.kind === 'zaglowiec' ? 2 : 1);
    b.cargo = cargo;
    this.score++;
    this.watchBoats++;
    this.p.boats++;
    if (b.r > RULES.far && this.blind) this.blindFar++;
    if (b.kind === 'zaglowiec') {
      this.p.tallShips++;
      this.tallNow++;
      this.emit({ type: 'tallShip', boat: b });
    }
    this.addCrates(cargo);
    return cargo;
  }

  private addCrates(n: number, session = true): void {
    const before = village(this.p.crates).built;
    this.p.crates += n;
    if (session) {
      this.crates += n;
      this.p.lastCrates = this.crates;
    }
    const after = village(this.p.crates).built;
    for (let s = before; s < after; s++) {
      this.builtNow.push(s);
      this.emit({ type: 'built', step: s });
    }
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  /** The events since the last call, oldest first (most frames have none: then nothing is allocated). */
  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /**
   * What the ambient pad's brightness follows (kit/types.ts): the lamp in a Konwój with its ring and
   * in the warm-up (steady there), the sea glow in a Cisza.  Held still in a blind Konwój, at dawn
   * and while the signal is unreliable, so no live feedback reaches the sound where the screen has none.
   */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase === 'finale' || this.phase === 'done') return null;
    const b = this.block;
    if (b.kind === 'cisza') return clamp(this.glow / RULES.glowMax);
    return b.kind === 'konwoj' && b.blind ? null : this.lens;
  }

  /** Time is up: the session may stop once the finisher has played and no boat is mid-sail. */
  canStop(): boolean {
    return this.phase === 'done' && !this.boats.some(b => b.state === 'home');
  }

  /**
   * The session's numbers, idempotent.  Only a saved session calls it for good, so the session, its
   * Konwój blocks and the day's "Noc dnia" are counted here; records go into the progress with Math.max.
   */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      p.sessions = Math.max(p.sessions, this.session);
      p.konwoje = Math.max(p.konwoje, this.konwojeBase + this.konwojeBegun);
      if (this.daily) {
        p.dailyDay = this.init.day;
        p.dailyScore = this.score;
      }
    }
    const watchBest = Math.max(this.bestWatch, this.watchBoats);
    const far = Math.round(this.farthest * 100);
    p.bestSession = Math.max(p.bestSession, this.score);
    p.bestWatch = Math.max(p.bestWatch, watchBest);
    p.bestStreak = Math.max(p.bestStreak, this.maxStreak);
    p.farthest = Math.max(p.farthest, far);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;   // no "−0.0%"
    const stats: [string, string][] = [
      ['Najlepsza wachta', boats(watchBest)],
      ['Skrzynie', String(this.crates)],
      ['Najdalsze światło', `${far}%`],
      ['Seria idealnych', String(this.maxStreak)],
      ['Gwiazdy latarni', this.konwojJudged ? `${this.starsWon}/${this.konwojJudged}` : '—'],
      ['Bursztyny z dna', String(this.nuggetsFound)],
      ['Kontrast', c === null ? '—' : `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c).toFixed(1)}%`],
      ['Wachty', String(this.watch)],
    ];
    return {
      score: this.score, unit: boatWord(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(watchBest, far),
    };
  }

  /**
   * At most five lines for the summary, the session's best moments first: rare amber, the village,
   * records, the letter, other amber, the tall ship, the blind reveal, Pełne światło, the welcome.
   */
  private highlights(watchBest: number, far: number): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.newAmber.length) {
      const pieces = this.newAmber.map(i => AMBER[i]).sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier));
      add(pieces[0].tier === 'legend' || pieces[0].tier === 'epic' ? 0 : 4, amberLine(pieces));
    }
    if (this.builtNow.length) add(1, `Port rośnie: ${this.builtNow.map(s => VILLAGE[s].name.toLowerCase()).join(', ')}`);
    if (this.bestBefore !== null) {
      // records share one line when there are several
      const one: string[] = [], part: string[] = [];
      if (watchBest > this.before.watch) {
        one.push(`Rekord wachty: ${boats(watchBest)}`);
        part.push(`wachta ${boats(watchBest)}`);
      }
      if (this.maxStreak > this.before.streak) {
        one.push(`Rekord serii idealnych: ${this.maxStreak}`);
        part.push(`seria ${this.maxStreak} idealnych`);
      }
      if (far > this.before.farthest) {
        one.push(`Rekord zasięgu: ${far}%`);
        part.push(`zasięg ${far}%`);
      }
      if (part.length) add(2, part.length === 1 ? one[0] : `Rekordy: ${part.join(', ')}`);
    }
    if (this.letterNow) add(3, `List z butelki ${this.letterNow}/${LETTERS.length}`);
    if (this.tallNow) add(5, this.tallNow > 1 ? `Żaglowce w porcie: ${this.tallNow}` : 'Żaglowiec w porcie');
    if (this.blindFarAll > 0) add(6, farShips(this.blindFarAll));
    if (this.fullNow) add(7, this.fullNow > 1 ? `Pełne światło ×${this.fullNow}` : 'Pełne światło');
    if (this.welcomeNow) add(8, `Wędzarnia: ${crates(this.welcomeNow)} na powitanie`);
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);   // a stable sort: time order within a rank
  }
}

/** "Nowy bursztyn: jaszczurka (legendarny)", or the session's new pieces in one line, the rarest first. */
function amberLine(pieces: readonly AmberPiece[]): string {
  const named = pieces.slice(0, 3).map(a => `${a.name.toLowerCase()} (${TIER_NAME[a.tier]})`).join(', ');
  if (pieces.length === 1) return `Nowy bursztyn: ${named}`;
  const more = pieces.length - 3;
  return `Nowe bursztyny: ${named}${more > 0 ? ` i ${more} ${plural(more, 'inny', 'inne', 'innych')}` : ''}`;
}
