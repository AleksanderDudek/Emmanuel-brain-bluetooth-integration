/**
 * Latarnik's rules and state, without the DOM or the canvas (so every rule is unit-tested).
 *
 * A lighthouse stands in the middle of a round sea of radius R.  Its beam, a 20° wedge, turns
 * clockwise; boats drift in from the horizon toward the reef ring at 0.18 R.  A tap ("Błysk")
 * lights every boat inside the wedge and within the beam's reach: they sail into the harbour with
 * cargo by distance.  An unlit boat that reaches the reef turns back and costs one of the night's
 * three lanterns — losses come from touch only, because the reef lies inside the shortest reach,
 * and a boat of the first-ever warm-up costs nothing at all.  A tap that finds a boat only beyond
 * the reach costs nothing either: the touch was right, the light fell short.
 *
 * Version 2 (DESIGN.md §3.2) plays the session as **nights**, the levels of a one-tap timing game
 * (nights.ts): each night a goal with a counter and three stars, every fifth a squall with
 * telegraphed gusts (the boss).  New on the sea: fog-bound boats (dark until the beam passes over
 * them within its reach), the flotilla (numbered boats that come home in order), pan Edek's lost
 * rowboat (dark, drifting, it bumps the reef at no cost) and a whale that surfaces now and then.
 * The crates buy the workshop's upgrades (meta.ts) the moment they are paid: a wider lens, quicker
 * oil, a bell that rings where fog-bound boats hide, a second beam.  Losing the night's three
 * lanterns never ends anything: the night starts again with its count kept.  Zośka the gull
 * comments in short bubbles (talk.ts).
 *
 * The band only ever adds potential.  Reach = 0.42 R + 0.58 R × L, L being the kit's `level`
 * smoothed again (τ 3 s, 1 s on EEG), plus a steadiness bonus from `hold`; it answers only in a
 * Konwój (push) after the band's delay, and holds in a Cisza (rest), where `calm` grows a glow over
 * the sea that reveals amber.  Each block is judged once at its end by the kit's RoundJudge.
 * While the signal is unreliable everything brain-driven freezes: the reach holds, boats and the
 * block clock stop, no far ships spawn — and taps still work.
 *
 * Boats come on a schedule that keeps its beat whatever happens on the sea, each from its own
 * numbers: on the day's first session ("Noc dnia") those come from the date, so the n-th scheduled
 * boat of the night is the same for everyone who plays the same length.  The nights' own boats
 * (fog-bound, flotilla, rowboat) and the whale come on top, from the session's generator.
 */
import { mulberry32 } from '../../core/random';
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { TracePhase } from '../kit/trace';
import type { ArcadeOutcome, SignalPhase } from '../kit/types';
import { AMBER, LETTERS, TIERS, TIER_NAME, TIPS, VILLAGE, UPGRADE_NAME, type AmberPiece, type Moment, type Tier } from './content';
import { farShips, nightName, t, unit } from './i18n';
import { addCrumbs, addToWorkshop, daysBetween, drawAmber, nextMissing, starsOf, village, type LatarnikProgress } from './meta';
import { nightSpec, starsFor, type NightSpec } from './nights';
import { BANDS, DEG, RULES, TAU, type Band, type Upgrade } from './rules';
import { Talk } from './talk';

export { BANDS, DEG, RULES, TAU, type Band };

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

export type BoatKind = 'kuter' | 'zaglowka' | 'prom' | 'drobnicowiec' | 'zaglowiec' | 'butelka' | 'mgla' | 'flotylla' | 'lodka';
export type BoatState = 'sea' | 'home' | 'leaving' | 'gone';

export interface Boat {
  readonly id: number;
  /** its number in the night's schedule (−1: outside it — the bottle, the nights' own boats) */
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
  /** a fog-bound boat or the rowboat: hidden until the beam finds it; `seen` s left in sight */
  readonly hidden: boolean;
  seen: number;
  /** the bell's next ring where it hides (s) */
  ring: number;
  /** the flotilla: its group and its number (0: none) */
  readonly group: number;
  readonly order: number;
  /** the rowboat: its sideways turn (rad/s) and seconds left rowing back out after a bump */
  readonly turn: number;
  out: number;
}

export interface Nugget { a: number; r: number; revealed: boolean; size: number }

export interface Whale { state: 'idle' | 'warn' | 'up'; t: number; a: number; r: number; next: number }
export interface Gust { state: 'idle' | 'warn' | 'blow'; t: number; next: number; kind: 'fast' | 'back' }
export interface Flotilla { id: number; next: number; size: number; lit: number; lost: number }
export interface Story { kind: 'open'; t: number; dur: number }

export type SimEvent =
  | { type: 'flash'; boats: Boat[]; perfect: boolean; full: boolean; streak: number; cargo: number }
  | { type: 'empty' }
  /** the wedge held a boat only beyond the reach: no cost; `hint`: show "zabrakło N%" (a Konwój with its ring) */
  | { type: 'short'; boat: Boat; short: number; hint: boolean }
  /** the wedge held a flotilla boat whose turn has not come: it waits, no cost */
  | { type: 'order'; boat: Boat; want: number }
  | { type: 'armed' }
  | { type: 'home'; boat: Boat }
  | { type: 'reef'; boat: Boat; lanterns: number; free: boolean }
  | { type: 'bump'; boat: Boat }
  | { type: 'spotted'; boat: Boat }
  | { type: 'ring'; boat: Boat }
  | { type: 'bottle'; boat: Boat; letter: number }
  | { type: 'tallShip'; boat: Boat }
  | { type: 'flotilla'; size: number; lit: number; counted: boolean }
  | { type: 'rescue'; boat: Boat }
  | { type: 'whaleWarn'; whale: Whale }
  | { type: 'whaleUp'; whale: Whale }
  | { type: 'whale'; whale: Whale; crates: number }
  | { type: 'whaleDown' }
  | { type: 'gustWarn'; kind: Gust['kind'] }
  | { type: 'gust'; kind: Gust['kind'] }
  | { type: 'gustEnd' }
  | { type: 'progress'; got: number; goal: number }
  | { type: 'nightStart'; spec: NightSpec; again: boolean }
  | { type: 'nightWon'; spec: NightSpec; stars: number; before: number }
  | { type: 'rewind'; spec: NightSpec }
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
  | { type: 'upgrade'; upgrade: Upgrade; level: number }
  | { type: 'story'; story: Story }
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

/** The panel's gauge for a reach: 0 at the shortest, 0.5 at the threshold's reach (L = 0.5), 1 at full. */
export const reachMeter = (reach: number): number => clamp((reach - RULES.reachMin) / RULES.reachGain);

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

/** The beam's wedge and perfect core for a lens level, and the lamp's recharge for an oil level. */
export const wedgeFor = (lens: number): number => RULES.wedge + RULES.lensWedge * lens;
export const perfectFor = (lens: number): number => RULES.perfect + RULES.lensPerfect * lens;
export const rechargeFor = (oil: number): number => RULES.recharge - RULES.oilRecharge * oil;
export const seenFor = (bell: number): number => RULES.fogSeen + RULES.bellSeen * bell;

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

const phaseOf = (k: BlockKind): TracePhase => (k === 'konwoj' ? 'focus' : k === 'cisza' ? 'rest' : 'free');

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

export type Phase = 'play' | 'between' | 'finale' | 'done';

export class LatarnikSim {
  readonly p: LatarnikProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly tau: number;
  private readonly lead: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private readonly events: SimEvent[] = [];
  readonly talk: Talk;

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
  /** the between-nights card: a night won, or the lanterns gone and the night again */
  between: 'won' | 'rewind' = 'won';
  tip = '';
  /** yesterday's (or the last day's) best reach: a faint ring to beat */
  ghost: { reach: number; label: string } | null = null;
  /** the opening card of the first-ever session (a tap closes it) */
  story: Story | null = null;
  /** seconds of play (the runner's clock) */
  now = 0;

  // the night
  spec: NightSpec = nightSpec(0);
  got = 0;
  lost = 0;
  nightStreak = 0;
  /** the stars the night just won earned (the between card) and its best before */
  lastStars = 0;
  lastBefore = 0;
  nightsWon = 0;
  starsGained = 0;
  bossWon = 0;
  private readonly firstNight: number;

  // the lamp
  beam = -Math.PI / 2;
  /** the beam's turn now (rad/s) and its nominal speed */
  omega: number = RULES.speed;
  speed: number = RULES.speed;
  /** the workshop's levels, read at start and on every upgrade */
  wedge: number = RULES.wedge;
  perfectW: number = RULES.perfect;
  rechargeSec: number = RULES.recharge;
  bell = 0;
  second = false;
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
  private rawHold = 0;
  private holdCarry = 0;
  private fogT = 0;
  private recover = 0;
  /** the reach crossed the threshold in this Konwój (Zośka cheers once) */
  private cheered = false;

  // the sea
  readonly boats: Boat[] = [];
  private ids = 0;
  spawnT = 0.35;
  private spawnN = 0;
  private seaT = 0;
  private readonly u = new Float64Array(DRAWS);
  private readonly laneA = new Float64Array(LANES);
  private readonly laneR = new Float64Array(LANES);
  private readonly laneT = new Float64Array(LANES);
  private laneN = 0;
  /** a new night: seconds until its easy first boat comes (0: none waiting) */
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
  // the nights' own boats
  private mistT = 0;
  private rowT = 0;
  flotilla: Flotilla | null = null;
  private groups = 0;
  readonly whale: Whale = { state: 'idle', t: 0, a: 0, r: 0, next: 20 };
  readonly gust: Gust = { state: 'idle', t: 0, next: 6, kind: 'fast' };

  // the night's lanterns and the streak
  lanterns: number = RULES.lanterns;
  streak = 0;
  maxStreak = 0;
  armed = false;

  // the session's tallies
  score = 0;
  crates = 0;
  farthest = 0;
  starsWon = 0;
  konwojJudged = 0;
  blindFar = 0;
  nuggetsFound = 0;
  ciszeWon = 0;
  whalesNow = 0;
  rescuedNow = 0;
  private gotNew = false;
  private pity = false;
  private readonly newAmber: number[] = [];
  private readonly builtNow: number[] = [];
  private readonly upgradesNow: Upgrade[] = [];
  private letterNow = 0;
  private tallNow = 0;
  private fullNow = 0;
  private blindFarAll = 0;
  private readonly bestBefore: number | null;
  private readonly before: { streak: number; farthest: number };
  private konwojeBase = 0;
  private konwojeBegun = 0;

  constructor(private readonly init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.tau = init.eeg ? RULES.tauEeg : RULES.tau;
    this.lead = init.eeg ? RULES.leadEeg : RULES.lead;
    this.judge = RoundJudge.from(init.tuning);
    this.bestBefore = this.p.sessions > 0 ? this.p.bestSession : null;
    this.before = { streak: this.p.bestStreak, farthest: this.p.farthest };
    this.firstNight = this.p.night;
    this.talk = new Talk(init.rng);
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get blind(): boolean { return this.block?.kind === 'konwoj' && this.block.blind; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  /** seconds until the next block begins (null: the last block) */
  get toNext(): number | null { return this.next ? Math.max(0, this.block.dur - this.blockT) : null; }
  get telegraphing(): boolean { const n = this.toNext; return n !== null && n <= RULES.telegraph && this.phase !== 'finale' && this.phase !== 'done'; }
  get ended(): boolean { return this.phase === 'finale' || this.phase === 'done'; }
  /** the reach answers the band now: a sighted Konwój past the band's delay */
  get sighted(): boolean { return this.block?.kind === 'konwoj' && !this.block.blind && this.blockT >= this.lead && !this.ended; }
  /** the night's goal left (the squall's strength) */
  get left(): number { return Math.max(0, this.spec.goal - this.got); }

  start(): void {
    if (this.started) return;
    this.started = true;
    const p = this.p, day = this.init.day;
    // the session (and its Konwój blocks, and the day's "Noc dnia") reach the progress in result(),
    // which only a saved session calls: an abandoned first attempt leaves the next one the first
    this.session = p.sessions + 1;
    this.konwojeBase = p.konwoje;
    this.daily = p.dailyDay !== day;
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
    if (p.reachPrev > 0) this.ghost = { reach: p.reachPrev, label: t(daysBetween(p.reachPrevDay, day) === 1 ? 'ring.yesterday' : 'ring.lately') };
    p.lastDay = day;
    this.applyUpgrades();
    this.plan = planBlocks(this.plannedSec, this.session === 1, this.daily ? mulberry32((this.init.daySeed ^ PLAN_SALT) >>> 0) : this.rng);
    const warm = this.plan[0].kind === 'warmup';
    this.reach = warm ? RULES.warmReach : reachFor(this.L, beginnerBonus(this.session));
    this.lens = warm ? RULES.warmLens : this.L;
    this.startNight(p.night, false);
    this.omega = this.speed;
    this.startBlock(0);
    if (this.session === 1) {
      this.story = { kind: 'open', t: 0, dur: RULES.openCard };
      this.emit({ type: 'story', story: this.story });
    } else this.say('open', 3, 9);
  }

  /** The workshop's levels as the lamp uses them. */
  private applyUpgrades(): void {
    const u = this.p.upgrades;
    this.wedge = wedgeFor(u.lens);
    this.perfectW = perfectFor(u.lens);
    this.rechargeSec = rechargeFor(u.oil);
    this.bell = u.bell;
    this.second = u.beam > 0;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.now = t;
    this.reliable = f.reliable;
    if (this.story && (this.story.t += dt) >= this.story.dur) this.story = null;
    this.turn(dt);
    this.recharge = Math.max(0, this.recharge - dt);
    this.fog = approach(this.fog, f.reliable ? 0 : 1, dt, 0.7);
    this.phaseT += dt;
    this.brain(dt, f);
    if (this.phase === 'between' && this.phaseT >= RULES.nightCard) this.afterCard();
    else if (this.phase === 'finale' && this.phaseT >= RULES.finale) this.phase = 'done';
    const night = this.phase === 'play' || this.phase === 'between';
    if (night) this.schedule(dt, f, t);
    this.seaGlow(dt, f);
    if (night && !this.story) {
      this.spawner(dt);
      this.nightLife(dt);
    }
    this.moveBoats(dt);
    this.talk.update(dt, t, this.talkBlocked);
  }

  /** Zośka keeps quiet under a card, the runner's banner, a telegraph and the lesson. */
  get talkBlocked(): boolean {
    if (this.story || this.phase === 'between' || this.lesson !== 'done') return true;
    if (this.ended) return false;
    if (this.block.kind !== 'warmup' && this.blockT < RULES.bannerSec) return true;
    return this.telegraphing || this.gust.state === 'warn';
  }

  private say(m: Moment, pri = 1, ttl = 4): void { this.talk.ask(m, pri, ttl); }

  private turn(dt: number): void {
    const lb = this.lessonBoat;
    if (this.lesson === 'wait' && lb) {
      if (lb.state !== 'sea' || this.block.kind !== 'warmup') this.endLesson();
      else if (!this.story && Math.abs(angDiff(lb.a, this.beam)) <= Math.abs(this.omega) * dt + 1e-6) {
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
    const g = this.gust;
    const want = g.state === 'blow' ? this.speed * (g.kind === 'fast' ? RULES.gustFast : RULES.gustBack) : this.speed;
    this.omega = approach(this.omega, this.story ? this.speed * 0.5 : want, dt, g.state === 'blow' ? 0.12 : 0.25);
    this.beam = wrap(this.beam + this.omega * dt);
  }

  private endLesson(): void {
    this.lesson = 'done';
    if (this.lessonBoat) this.lessonBoat.anchored = false;   // unlit, it sails on like the others
    this.spawnT = Math.min(this.spawnT, RULES.afterLesson);
  }

  /**
   * The band's slow quantities.  L always follows the level (silently outside a Konwój), so every
   * Konwój starts honestly; the reach answers it only in a Konwój past the band's delay, the lamp only
   * where the ring shows (not blind).  A Cisza holds them where the Konwój left them.
   */
  private brain(dt: number, f: FocusFrame): void {
    if (!f.reliable) {
      this.fogT += dt;   // the reach and the lamp hold, dimmed, at their last values
      this.calm = 0;
      return;
    }
    if (this.fogT > 0) {
      if (this.fogT >= RULES.fogGap) this.recover = RULES.recover;
      if (f.hold < this.rawHold) this.holdCarry += this.rawHold;
      this.fogT = 0;
    } else this.recover = Math.max(0, this.recover - dt);
    if (!f.focused && this.recover <= 0) this.holdCarry = 0;
    this.rawHold = f.hold;
    this.calm = f.calm;
    const L = approach(this.L, clamp(f.level), dt, this.tau);
    this.L = this.recover > 0 ? Math.max(this.L, L) : L;
    const b = this.block;
    if (b.kind === 'warmup') {
      this.hold = 0;
      this.reach = approach(this.reach, RULES.warmReach, dt, RULES.reachTau);
      this.lens = approach(this.lens, RULES.warmLens, dt, RULES.reachTau);
      return;
    }
    if (b.kind === 'cisza' || this.blockT < this.lead) {
      this.hold = 0;   // rest, or the band's delay: the reach, its bonuses and the lamp hold
      return;
    }
    const sighted = !b.blind;
    this.hold = Math.min(this.holdCarry + f.hold, this.blockT);
    const target = holdTarget(this.hold);
    if (target >= this.holdBonus) {
      if (target > this.holdBonus + 1e-9 && sighted) this.emit({ type: 'steady', bonus: target });
      this.holdBonus = target;
      this.decayRate = 0;
    } else {
      if (this.decayRate === 0) this.decayRate = this.holdBonus / RULES.holdDecay;
      this.holdBonus = Math.max(target, this.holdBonus - this.decayRate * dt);
    }
    this.boost = approach(this.boost, this.boostOn ? RULES.failBoost : 0, dt, 1);
    this.reach = approach(this.reach, reachFor(this.L, this.holdBonus + beginnerBonus(this.session) + this.boost), dt, RULES.reachTau);
    if (sighted) {
      this.lens = approach(this.lens, this.L, dt, RULES.reachTau);
      if (!this.cheered && this.reach >= reachFor(0.5) + 0.02 && this.phase === 'play') {
        this.cheered = true;
        this.say('good', 2, 5);
      }
    }
    if (this.phase === 'play' || this.phase === 'between') {
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
      this.cheered = false;
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
    this.tip = first && this.session <= 2 && b.kind === 'konwoj' ? TIPS.firstKonwoj
      : first && this.session <= 2 && b.kind === 'cisza' ? TIPS.firstCisza
        : list[(this.session - 1 + i) % list.length];
    if (b.kind === 'konwoj') this.say(b.blind ? 'blind' : 'push', 2, 8);
    else if (b.kind === 'cisza') this.say('rest', 2, 8);
    else if (this.session > 1) this.say('warm', 1, 8);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null;
    if (b.kind === 'konwoj') {
      verdict = this.judge.verdict();
      if (verdict !== null) this.konwojJudged++;
      if (verdict) {
        // "Blask latarni": a lantern back (relief bought with focus) and five crates
        this.starsWon++;
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
      if (verdict) {
        this.ciszeWon++;
        this.albumDraw();
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict });
  }

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
    this.gust.state = 'idle';
    this.whale.state = 'idle';
    for (const b of this.boats) if (b.state === 'sea') this.turnBack(b);
    if (this.pity && !this.gotNew) {
      const m = nextMissing(this.p, false);
      if (m !== null) {
        this.p.amber.push(m);
        this.amberGot(m, true, 'pity');
      }
    }
    this.talk.clear();
    this.say('end', 3, 6);
    this.emit({ type: 'finale' });
  }

  /**
   * The session ends before its own dawn ("Zakończ i zapisz", the runner's overtime limit): settle
   * as the dawn would — the open block is judged and its amber washes up, and the pity piece is
   * rolled.  Nothing more once the dawn has come.
   */
  finish(): void {
    if (!this.started || this.ended) return;
    this.endBlock();
    this.startFinale();
  }

  // ── the nights ──────────────────────────────────────────────────
  private startNight(n: number, again: boolean): void {
    if (!again) {
      this.spec = nightSpec(n);
      this.got = 0;
      this.lost = 0;
      this.nightStreak = 0;
      this.flotilla = null;
    }
    this.lanterns = RULES.lanterns;
    this.streak = 0;
    this.phase = 'play';
    this.phaseT = 0;
    // the very first night of all turns slower
    this.speed = this.session === 1 && n === 0 ? RULES.firstSpeed : this.spec.speed;
    this.watchFirst = this.boats.length || again || n !== this.firstNight ? RULES.watchFirst : 0;
    this.mistT = 2;
    this.rowT = RULES.rowFirst;
    const [w0, w1] = RULES.whaleEvery;
    this.whale.state = 'idle';
    this.whale.next = w0 * 0.5 + this.rng() * (w1 - w0) * 0.5;
    this.gust.state = 'idle';
    this.gust.next = RULES.gustEvery[0];
    this.emit({ type: 'nightStart', spec: this.spec, again });
    if (n !== this.firstNight || again) this.say(again ? 'rewind' : this.spec.boss ? 'boss' : 'night', 2, 8);
  }

  /** The goal reached: stars, the map and the village, and a card before the next night. */
  private winNight(): void {
    const spec = this.spec;
    const stars = starsFor(spec, { got: this.got, lost: this.lost, bestStreak: this.nightStreak });
    const p = this.p;
    const before = p.nightStars[spec.n] ?? 0;
    const builtBefore = village(starsOf(p)).built;
    while (p.nightStars.length <= spec.n) p.nightStars.push(0);
    p.nightStars[spec.n] = Math.max(before, stars);
    this.starsGained += Math.max(0, stars - before);
    p.night = Math.max(p.night, spec.n + 1);
    this.nightsWon++;
    if (spec.boss) this.bossWon++;
    this.lastStars = stars;
    this.lastBefore = before;
    this.toCard('won');
    this.emit({ type: 'nightWon', spec, stars, before });
    const builtAfter = village(starsOf(p)).built;
    for (let s = builtBefore; s < builtAfter; s++) {
      this.builtNow.push(s);
      this.emit({ type: 'built', step: s });
    }
  }

  private toCard(kind: 'won' | 'rewind'): void {
    this.between = kind;
    this.phase = 'between';
    this.phaseT = 0;
    this.streak = 0;
    this.armed = kind === 'won' ? this.armed : false;
    this.gust.state = 'idle';
    this.flotilla = null;
    if (this.whale.state !== 'idle') this.whale.state = 'idle';
    for (const b of this.boats) if (b.state === 'sea') this.turnBack(b);
    this.talk.clear();
  }

  private afterCard(): void {
    if (this.between === 'won') {
      this.say(this.lastStars >= 3 ? 'three' : 'won', 3, 7);
      this.startNight(this.p.night, false);
    } else this.startNight(this.spec.n, true);
  }

  /** A night's goal moved on. */
  private count(): void {
    this.got++;
    this.emit({ type: 'progress', got: this.got, goal: this.spec.goal });
    if (this.got >= this.spec.goal && this.phase === 'play') this.winNight();
  }

  // ── the sea's own life: fog-bound boats, the flotilla, the rowboat, the whale, the squall ──
  private nightLife(dt: number): void {
    if (this.phase !== 'play' || this.lesson !== 'done') return;
    const spec = this.spec;
    const still = !this.reliable;
    // fog-bound boats: two at most, a new one every few seconds
    if (spec.kind === 'mgla' && !still && (this.mistT -= dt) <= 0) {
      this.mistT = RULES.fogEvery;
      let on = 0;
      for (const b of this.boats) if (b.state === 'sea' && b.kind === 'mgla') on++;
      if (on < 2 && this.alive() < RULES.maxBoats + 1) {
        const [lo, hi] = RULES.fogBand;
        this.spawn({ kind: 'mgla', r: lo + (hi - lo) * this.rng() });
      }
    }
    // the flotilla: three numbered boats at once, a new one when the last is home
    if (spec.kind === 'flotylla' && !this.flotilla && !still && this.alive() <= 2) this.launchFlotilla();
    // the rowboat
    if (spec.kind === 'ratunek' && !still && !this.boats.some(b => b.kind === 'lodka' && b.state === 'sea') && (this.rowT -= dt) <= 0) {
      this.rowT = RULES.rowEvery;
      const [lo, hi] = RULES.rowBand;
      this.spawn({ kind: 'lodka', r: lo + (hi - lo) * this.rng() });
    }
    this.whaleLife(dt, still);
    if (spec.boss) this.gustLife(dt, still);
    // a hidden boat comes into sight when the beam passes over it within its reach; the bell rings where it hides
    for (const b of this.boats) {
      if (b.state !== 'sea' || !b.hidden) continue;
      if (this.inBeam(b, this.wedge * 1.3)) {
        if (b.seen <= 0) this.emit({ type: 'spotted', boat: b });
        b.seen = seenFor(this.bell);
      } else b.seen = Math.max(0, b.seen - dt);
      if (this.bell > 0 && b.seen <= 0 && (b.ring -= dt) <= 0) {
        b.ring = RULES.bellRing;
        this.emit({ type: 'ring', boat: b });
      }
    }
  }

  /** Whether a boat lies inside a beam's wedge (half-width `w`) and within that beam's reach. */
  private inBeam(b: Boat, w: number): boolean {
    if (Math.abs(angDiff(b.a, this.beam)) <= w && b.r <= this.reach) return true;
    return this.second && Math.abs(angDiff(b.a, this.beam + Math.PI)) <= w && b.r <= this.reach * RULES.secondReach;
  }

  private launchFlotilla(): void {
    const n = RULES.flotillaSize;
    const id = ++this.groups;
    this.flotilla = { id, next: 1, size: n, lit: 0, lost: 0 };
    // their numbers in a shuffled order around the sea, so the beam's sweep is not the order
    const order = [1, 2, 3].slice(0, n);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const base = this.beam + (60 + this.rng() * 40) * DEG;
    const [lo, hi] = RULES.flotillaBand;
    for (let k = 0; k < n; k++) {
      this.launch('flotylla', base + k * (360 / n) * DEG + (this.rng() - 0.5) * 20 * DEG, lo + (hi - lo) * this.rng(), this.rng() * TAU, -1,
        { group: id, order: order[k] });
    }
  }

  private whaleLife(dt: number, still: boolean): void {
    const w = this.whale;
    if (!this.spec.whale || still) return;
    w.t += dt;
    if (w.state === 'idle') {
      if ((w.next -= dt) > 0) return;
      const [lo, hi] = RULES.whaleBand;
      w.state = 'warn';
      w.t = 0;
      w.a = this.freeBearing(lo, this.rng(), this.rng(), this.rng(), this.beam + Math.PI * 0.6, this.seaT);
      w.r = lo + (hi - lo) * this.rng();
      this.emit({ type: 'whaleWarn', whale: w });
    } else if (w.state === 'warn' && w.t >= RULES.whaleWarn) {
      w.state = 'up';
      w.t = 0;
      this.emit({ type: 'whaleUp', whale: w });
      this.say('whale', 2, 3);
    } else if (w.state === 'up' && w.t >= RULES.whaleUp) this.whaleDone(false);
  }

  private whaleDone(lit: boolean): void {
    const w = this.whale, [lo, hi] = RULES.whaleEvery;
    w.state = 'idle';
    w.t = 0;
    w.next = lo + (hi - lo) * this.rng();
    if (!lit) this.emit({ type: 'whaleDown' });
  }

  private gustLife(dt: number, still: boolean): void {
    const g = this.gust;
    if (still && g.state !== 'blow') return;
    g.t += dt;
    if (g.state === 'idle') {
      if ((g.next -= dt) > 0) return;
      g.state = 'warn';
      g.t = 0;
      g.kind = this.rng() < 0.5 ? 'fast' : 'back';
      this.emit({ type: 'gustWarn', kind: g.kind });
    } else if (g.state === 'warn' && g.t >= RULES.gustWarn) {
      g.state = 'blow';
      g.t = 0;
      this.emit({ type: 'gust', kind: g.kind });
    } else if (g.state === 'blow') {
      // the wind pushes the boats sideways (never into the reef: only the bearing moves)
      const push = (g.kind === 'fast' ? 1 : -1) * RULES.gustPush * dt;
      for (const b of this.boats) if (b.state === 'sea' && !b.anchored) b.a = wrap(b.a + push);
      if (g.t >= RULES.gustBlow) {
        const [lo, hi] = RULES.gustEvery;
        g.state = 'idle';
        g.t = 0;
        g.next = lo + (hi - lo) * this.rng();
        this.emit({ type: 'gustEnd' });
      }
    }
  }

  private seaGlow(dt: number, f: FocusFrame): void {
    const cisza = this.block.kind === 'cisza' && (this.phase === 'play' || this.phase === 'between');
    if (!cisza) {
      this.glow = Math.max(0, this.glow - 0.15 * dt);
      return;
    }
    if (!f.reliable) return;
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

  // ── the night's scheduled boats ─────────────────────────────────
  private spawner(dt: number): void {
    if (this.lesson !== 'done') return;
    this.seaT += dt;
    this.spawnT -= dt;
    if (this.watchFirst > 0 && (this.watchFirst -= dt) <= 0 && this.phase === 'play') this.firstBoat();
    while (this.spawnT <= 0) this.slot();
  }

  private firstBoat(): void {
    this.spawn({ band: 'mid', a: this.beam + (70 + this.rng() * 30) * DEG, r: clamp(this.reach - 0.08, BANDS.near[0], BANDS.mid[1]) });
  }

  /**
   * The night's next scheduled boat, due `spawnT` s from now (≤ 0: due already).  Its numbers come
   * from its own stream on "Noc dnia", and its bearing from the beam at the due time and the last
   * few scheduled spawns — never from what happens to be on the sea — so the n-th boat is the same
   * for everyone.  A full sea (or a card) skips it.  Only this player's: the tall ship that takes
   * the place of one for steady focus.
   */
  private slot(): void {
    const n = this.spawnN++, u = this.recipe(n), due = this.spawnT;
    // on "Noc dnia" the bearings come from a beam that turns evenly from the start (the real one turns
    // faster night by night and lurches in a squall, which differs from player to player)
    const block = this.block, warm = block.kind === 'warmup';
    const at = this.seaT + due, beam = this.daily && !warm ? -Math.PI / 2 + RULES.speed * at : this.beam + this.omega * due;
    this.spawnT += (warm ? RULES.warmSpawnEvery : RULES.spawnEvery) + (u[0] * 2 - 1) * RULES.spawnJitter;
    const band: Band = n === 0 && !warm ? 'first' : pickBand(block.kind, u[1], this.reliable);
    const [lo, hi] = BANDS[band];
    let r = lo + (hi - lo) * u[2];
    const a = n === 0 ? beam + (70 + u[3] * 30) * DEG
      : warm ? beam + (40 + u[3] * 100) * DEG
        : this.convoyBearing(r, band, u, at) ?? this.freeBearing(r, u[3], u[4], u[5], beam, at);
    this.lane(a, r, at);
    if (this.phase !== 'play' || this.alive() >= (warm ? RULES.warmBoats : RULES.maxBoats)) return;
    // a flotilla on the sea keeps it quieter, so the numbers can be read (every other boat is skipped)
    if (this.flotilla && n % 2 === 1) return;
    let kind = pickKind(band, u[6]);
    if (this.tallDue && this.reliable && block.kind === 'konwoj') {
      kind = 'zaglowiec';
      r = BANDS.horizon[0] + (BANDS.horizon[1] - BANDS.horizon[0]) * u[2];
      this.tallDue = false;
      this.tallSpawned = true;
    }
    const b = this.launch(kind, a, r, u[7] * TAU, n);
    if (n === 0 && warm && this.session === 1) {
      b.anchored = true;   // the lesson: the first boat ever waits for its light
      this.lessonBoat = b;
      this.lesson = 'wait';
    }
  }

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
      if (Math.abs(angDiff(a, beam)) < RULES.wedge * 2) gap *= 0.3;
      if (gap > bestGap) {
        best = a;
        bestGap = gap;
      }
      if (gap > 20 * DEG) break;
    }
    return best;
  }

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

  /** A boat outside the night's schedule (the bottle, the nights' own boats; tests): what `o` leaves open comes from the session's generator. */
  spawn(o: { band?: Band; a?: number; r?: number; kind?: BoatKind } = {}): Boat {
    const rnd = this.rng;
    const band = o.band ?? pickBand(this.block.kind, rnd(), this.reliable);
    const [lo, hi] = BANDS[band];
    const r = o.r ?? lo + (hi - lo) * rnd();
    const a = o.a ?? (band === 'warm' ? this.beam + (40 + rnd() * 100) * DEG : this.freeBearing(r, rnd(), rnd(), rnd(), this.beam, this.seaT));
    return this.launch(o.kind ?? pickKind(band, rnd()), a, r, rnd() * TAU, -1);
  }

  private launch(kind: BoatKind, a: number, r: number, phase: number, n: number, fl: { group: number; order: number } = { group: 0, order: 0 }): Boat {
    const hidden = kind === 'mgla' || kind === 'lodka';
    const boat: Boat = {
      id: ++this.ids, n, kind, a: wrap(a), r, anchored: false, state: 'sea', t: 0, a0: a, r0: r, dur: 0, cargo: 0, perfect: false,
      dark: this.blind && r > RULES.far && kind !== 'butelka' && !hidden, practice: this.block.kind === 'warmup', phase,
      hidden, seen: 0, ring: 0.6, group: fl.group, order: fl.order,
      turn: kind === 'lodka' ? (this.rng() < 0.5 ? -1 : 1) * RULES.rowTurn : 0, out: 0,
    };
    this.boats.push(boat);
    return boat;
  }

  private moveBoats(dt: number): void {
    // fog, the lesson and the opening card: everything waits, so nothing can be lost
    const still = !this.reliable || this.lesson !== 'done' || !!this.story;
    for (const b of this.boats) {
      b.t += dt;
      if (b.state === 'sea') {
        if (still || b.anchored) continue;
        if (b.kind === 'lodka') {
          b.a = wrap(b.a + (b.turn / Math.max(0.3, b.r)) * 0.3 * dt);
          if (b.out > 0) {
            b.out -= dt;
            b.r = Math.min(RULES.rowBack, b.r + 0.12 * dt);
          } else b.r -= RULES.rowDrift * dt;
        } else {
          const v = b.kind === 'butelka' ? RULES.bottleDrift : b.kind === 'flotylla' ? RULES.flotillaDrift : b.r > RULES.slowFrom ? RULES.drift : RULES.driftSlow;
          b.r -= v * dt;
        }
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
    if (b.kind === 'lodka') {
      // pan Edek bumps the reef and rows back out: no cost (and a joke for Zośka)
      b.out = 3;
      this.emit({ type: 'bump', boat: b });
      this.say('bump', 2, 4);
      return;
    }
    this.turnBack(b);
    if (b.kind === 'butelka') return;
    const free = b.practice;
    if (!free) {
      this.lanterns = Math.max(0, this.lanterns - 1);
      this.lost++;
    }
    this.emit({ type: 'reef', boat: b, lanterns: this.lanterns, free });
    if (b.kind === 'flotylla') this.flotillaStep(b, false);
    if (!free) this.say('reef', 1, 3);
    if (!free && this.lanterns === 0 && this.phase === 'play') {
      this.toCard('rewind');
      this.emit({ type: 'rewind', spec: this.spec });
    }
  }

  private turnBack(b: Boat): void {
    b.state = 'leaving';
    b.t = 0;
    b.a0 = b.a;
    b.r0 = b.r;
  }

  /** A flotilla boat is resolved (lit or turned back): the next number's turn; the flotilla counts when at most one was lost. */
  private flotillaStep(b: Boat, lit: boolean): void {
    const f = this.flotilla;
    if (!f || b.group !== f.id) return;
    if (lit) f.lit++;
    else f.lost++;
    f.next++;
    // a number that turned back already is skipped
    while (f.next <= f.size && !this.boats.some(x => x.group === f.id && x.order === f.next && x.state === 'sea')) {
      if (f.lit + f.lost >= f.size) break;
      f.next++;
    }
    if (f.lit + f.lost >= f.size) {
      const counted = f.lit >= f.size - 1;
      this.flotilla = null;
      this.emit({ type: 'flotilla', size: f.size, lit: f.lit, counted });
      if (counted) {
        this.say('flotilla', 2, 4);
        this.count();
      }
    }
  }

  // ── the tap ─────────────────────────────────────────────────────
  /**
   * "Błysk" (a tap anywhere, Space, Enter): every boat in the wedge and within the reach lights up
   * (and, with the second beam, in the opposite wedge within its shorter reach).  A flotilla boat
   * lights only in its number's turn.  Empty water breaks the streak and recharges the lamp; a boat
   * only beyond the reach, or out of turn, costs nothing.  The first tap closes the opening card.
   */
  flash(): void {
    if (this.story) {
      this.story = null;
      return;
    }
    if (!this.started || this.phase !== 'play' || this.recharge > 0) return;
    const at = this.beam - this.omega * RULES.latency;
    const full = this.armed;
    const lit: Boat[] = [];
    let nearest = Infinity, beyond: Boat | null = null, waiting: Boat | null = null;
    const back = at + Math.PI, reach2 = this.reach * RULES.secondReach;
    for (const b of this.boats) {
      if (b.state !== 'sea') continue;
      const d = Math.abs(angDiff(b.a, at));
      const d2 = this.second ? Math.abs(angDiff(b.a, back)) : Infinity;
      const inMain = full || d <= this.wedge, inBack = !full && d2 <= this.wedge;
      if (!inMain && !inBack) continue;
      const within = (inMain && b.r <= this.reach) || (inBack && b.r <= reach2);
      if (!within) {
        if (!beyond || b.r < beyond.r) beyond = b;
        continue;
      }
      if (b.kind === 'flotylla' && this.flotilla && b.group === this.flotilla.id && b.order !== this.flotilla.next && !full) {
        waiting = b;
        continue;
      }
      lit.push(b);
      nearest = Math.min(nearest, inMain && b.r <= this.reach ? d : d2);
    }
    // the whale, surfaced within the light: a bonus, never a cost
    const w = this.whale;
    let whale = false;
    if (w.state === 'up') {
      const d = Math.abs(angDiff(w.a, at)), d2 = this.second ? Math.abs(angDiff(w.a, back)) : Infinity;
      whale = (full && w.r <= this.reach) || (d <= this.wedge * 1.2 && w.r <= this.reach) || (d2 <= this.wedge * 1.2 && w.r <= reach2);
    }
    if (whale) {
      this.whalesNow++;
      this.p.whales++;
      this.addCrates(RULES.whaleCrates);
      this.emit({ type: 'whale', whale: { ...w }, crates: RULES.whaleCrates });
      this.whaleDone(true);
    }
    if (!lit.length) {
      if (whale) return;
      if (waiting) {
        this.emit({ type: 'order', boat: waiting, want: this.flotilla?.next ?? 1 });
        this.say('order', 1, 2.5);
        return;
      }
      if (beyond) {
        const short = beyond.r - this.reach;
        const hint = !full && this.block.kind === 'konwoj' && !this.block.blind && beyond.kind !== 'butelka' && short <= RULES.nearMiss;
        this.emit({ type: 'short', boat: beyond, short, hint });
        if (hint) this.say('short', 1, 2.5);
        return;
      }
      this.streak = 0;
      this.recharge = this.rechargeSec;
      this.emit({ type: 'empty' });
      return;
    }
    const perfect = !full && nearest <= this.perfectW;
    let armedNow = false;
    if (full) {
      this.armed = false;
      this.fullNow++;
      this.say('full', 2, 3);
    } else if (perfect) {
      this.streak++;
      this.maxStreak = Math.max(this.maxStreak, this.streak);
      this.nightStreak = Math.max(this.nightStreak, this.streak);
      if (this.streak === RULES.streakStar) this.say('perfect', 1, 3);
      if (this.streak % RULES.fullLight === 0 && !this.armed) armedNow = this.armed = true;
    } else this.streak = 0;
    // a flotilla in full light comes home in its order
    lit.sort((a, b) => a.order - b.order);
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
        this.say('bottle', 1, 4);
      }
      return 0;
    }
    const cargo = cargoAt(b.r) * (b.kind === 'zaglowiec' ? 2 : 1) + (b.hidden ? 1 : 0);
    b.cargo = cargo;
    this.score++;
    this.p.boats++;
    if (b.r > RULES.far && this.blind) this.blindFar++;
    if (b.kind === 'zaglowiec') {
      this.p.tallShips++;
      this.tallNow++;
      this.emit({ type: 'tallShip', boat: b });
      this.say('full', 2, 3);
    }
    this.addCrates(cargo);
    if (this.phase !== 'play') return cargo;
    const kind = this.spec.kind;
    if (b.kind === 'flotylla') this.flotillaStep(b, true);
    else if (b.kind === 'lodka') {
      this.rescuedNow++;
      this.p.rescued++;
      this.emit({ type: 'rescue', boat: b });
      this.say('rescue', 3, 4);
      if (kind === 'ratunek') this.count();
    } else if (b.kind === 'mgla') {
      this.say('fog', 1, 3);
      if (kind === 'mgla') this.count();
    } else if (kind === 'powroty' || kind === 'szkwal') this.count();
    return cargo;
  }

  private addCrates(n: number): void {
    this.p.crates += n;
    this.crates += n;
    for (const u of addToWorkshop(this.p, n)) {
      this.upgradesNow.push(u);
      this.applyUpgrades();
      this.emit({ type: 'upgrade', upgrade: u, level: this.p.upgrades[u] });
      this.say('upgrade', 2, 5);
    }
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /**
   * What the ambient pad's brightness follows (kit/types.ts): the lamp in a Konwój with its ring and
   * in the warm-up (steady there), the sea glow in a Cisza.  Held still in a blind Konwój, at dawn
   * and while the signal is unreliable.
   */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.ended) return null;
    const b = this.block;
    if (b.kind === 'cisza') return clamp(this.glow / RULES.glowMax);
    return b.kind === 'konwoj' && b.blind ? null : this.lens;
  }

  /** The block for the runner's panel and dock: what it asks, its strategy, its seconds left, the next one during the telegraph. */
  signal(): SignalPhase {
    if (!this.started || this.ended || !this.block || this.block.kind === 'warmup') {
      const next = this.started && !this.ended && this.telegraphing && this.next ? phaseOf(this.next.kind) : null;
      return { want: 'free', blind: false, ...(next ? { next } : {}) };
    }
    const b = this.block;
    return {
      want: phaseOf(b.kind), blind: b.kind === 'konwoj' && b.blind, task: this.tip,
      left: Math.max(0, b.dur - this.blockT), next: this.telegraphing && this.next ? phaseOf(this.next.kind) : null,
    };
  }

  /** The panel's gauge: the reach in a sighted Konwój (0.5 = the threshold's reach), the glow in a Cisza; null where nothing shows. */
  meter(): number | null {
    if (!this.started || this.ended || !this.reliable) return null;
    const b = this.block;
    if (b.kind === 'cisza') return clamp(this.glow / RULES.glowMax);
    if (b.kind === 'konwoj' && !b.blind) return reachMeter(this.reach);
    return null;
  }

  /** The score corner's line under the boats: the night and its goal. */
  headlineSub(): string {
    if (this.ended) return t('sub.dawn', { n: this.nightsWon });
    return t('sub.night', { n: this.spec.n + 1, got: Math.min(this.got, this.spec.goal), goal: this.spec.goal });
  }

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
    const far = Math.round(this.farthest * 100);
    p.bestSession = Math.max(p.bestSession, this.score);
    p.bestStreak = Math.max(p.bestStreak, this.maxStreak);
    p.farthest = Math.max(p.farthest, far);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.nights'), this.nightsWon ? t('stat.nightsV', { n: this.nightsWon, stars: this.starsGained }) : '—'],
      [t('stat.night'), String(this.spec.n + 1)],
      [t('stat.crates'), String(this.crates)],
      [t('stat.farthest'), t('pct', { n: far })],
      [t('stat.streak'), String(this.maxStreak)],
      [t('stat.stars'), this.konwojJudged ? `${this.starsWon}/${this.konwojJudged}` : '—'],
      [t('stat.amber'), String(this.nuggetsFound)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(far), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one of those the night fits, in turn from session to session: a
   * rescue is the hand that caught the sinking one, a squall or a Cisza won is the stilled sea, boats
   * home are the haven and the waters passed, and the lamp fits every night.
   */
  private closingVerse(): PassageId {
    if (this.rescuedNow > 0) return 'mat14.31';
    const fit: PassageId[] = [];
    if (this.bossWon > 0 || this.ciszeWon > 0) fit.push('mrk4.39');
    if (this.score > 0) fit.push('psa107.29-30', 'isa43.2');
    fit.push('psa119.105');
    return inTurn(fit, this.session);
  }

  /** At most five lines for the summary, the session's best moments first. */
  private highlights(far: number): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.nightsWon) {
      add(0, this.bossWon ? t('hl.boss', { n: this.bossWon }) : t('hl.nights', { n: this.nightsWon, stars: this.starsGained }));
    } else if (this.started) {
      add(5, t('hl.toGoal', { n: this.left, night: nightName(this.spec.kind) }));
    }
    if (this.newAmber.length) {
      const pieces = this.newAmber.map(i => AMBER[i]).sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier));
      add(pieces[0].tier === 'legend' || pieces[0].tier === 'epic' ? 1 : 4, amberLine(pieces));
    }
    if (this.builtNow.length) add(1, t('port.grows', { names: this.builtNow.map(s => VILLAGE[s].name).join(', ') }));
    if (this.upgradesNow.length) add(2, t('hl.upgrade', { names: [...new Set(this.upgradesNow)].map(u => UPGRADE_NAME[u]).join(', ') }));
    if (this.bestBefore !== null) {
      const one: string[] = [], part: string[] = [];
      if (this.maxStreak > this.before.streak) {
        one.push(t('hl.record.streak', { n: this.maxStreak }));
        part.push(t('hl.records.streak', { n: this.maxStreak }));
      }
      if (far > this.before.farthest) {
        one.push(t('hl.record.reach', { n: far }));
        part.push(t('hl.records.reach', { n: far }));
      }
      if (part.length) add(2, part.length === 1 ? one[0] : t('hl.records', { list: part.join(', ') }));
      else if (this.score < this.bestBefore && this.bestBefore - this.score <= 6) add(6, t('hl.toRecord', { boats: t('boats', { n: this.bestBefore - this.score }) }));
    }
    if (this.rescuedNow) add(3, t('hl.rescue'));
    if (this.letterNow) add(3, t('bottle', { n: this.letterNow, total: LETTERS.length }));
    if (this.whalesNow) add(4, t('hl.whale'));
    if (this.tallNow) add(5, this.tallNow > 1 ? t('hl.talls', { n: this.tallNow }) : t('hl.tall'));
    if (this.blindFarAll > 0) add(6, farShips(this.blindFarAll));
    if (this.fullNow) add(7, this.fullNow > 1 ? t('hl.fulls', { n: this.fullNow }) : t('title.full'));
    const top = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    // Zośka has the last word
    const last = this.talk.closing();
    if (last) top.push(t('hl.zoska', { line: last }));
    return top;
  }
}

/** "Nowy bursztyn: jaszczurka (legendarny)", or the session's new pieces in one line, the rarest first. */
function amberLine(pieces: readonly AmberPiece[]): string {
  const named = pieces.slice(0, 3).map(a => t('hl.piece', { name: a.name, tier: TIER_NAME[a.tier] })).join(', ');
  if (pieces.length === 1) return t('hl.amber', { piece: named });
  const more = pieces.length - 3;
  return more > 0 ? t('hl.ambersMore', { pieces: named, n: more }) : t('hl.ambers', { pieces: named });
}
