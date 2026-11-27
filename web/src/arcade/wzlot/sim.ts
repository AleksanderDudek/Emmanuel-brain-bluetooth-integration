/**
 * Wzlot's session, without the DOM or the canvas (so every rule is unit-tested): Tiny Wings' loop
 * over the wilderness granie.  All numbers are in rules.ts (re-exported here).
 *
 * The hands fly (flight.ts on terrain.ts): hold anywhere and the eaglet gets heavy and dives, let go
 * and it is light.  When is shown in the world (round 11): every downslope is a "hold" stretch, every
 * upslope a "let go" one (terrain.zoneAt), and `cue()` says which one the eaglet is on, a moment ahead.
 * Each slide gets a verdict: held down the slope and let go at its bottom (the let-go on time), then over
 * the crest — "Idealnie!", a perfect slide (+50, +10 a link); a let-go high on the way down "Za wcześnie",
 * still held up the next slope "Za późno"; a landing into an upslope or across the slope tells whether
 * the dive came late or early.  Three perfect slides in a row light the Poryw (fever: faster, a golden
 * trail, every point × 2) until a landing that is not smooth.  A bad landing into an upslope is a bump.
 * The first session (and the lobby's "Ćwiczenie") opens with a practice valley: three slides in slow
 * motion, the game waiting for the hold at a downslope's top and the let-go at its bottom.  The
 * end of a grań is a long run-up and a crag: the leap over the gorge to the next grań scores, and
 * reaching a grań gives the sun back (+8 s for the first, less for each next, + up to 4 s for a quick one).  Promyki (coins), the
 * podmuch (a gust orb) and the clouds score.
 *
 * The day (a run): the eaglet starts in the nest at dawn; the sun sinks along its arc; when the night
 * catches it, the eaglet dozes off and the mother carries it home: the day's tally, the nest, and a
 * new day over the same granie.  The session's score is every day's points together; the session
 * never ends early, and its last seconds bring the last sunset.
 *
 * The band only adds:
 *   push (Skupienie)   after the lead-in (5 s Mendi, 2 s HALO) the smoothed level holds the sun up:
 *                      the night comes at 1 − 0.5 × clamp(2L − 1) of its pace; and every second of a
 *                      focused hold fills the Poryw's charge (10 s Mendi, 7 s HALO): full = a Poryw
 *                      of the band, safe from bumps for 8 s.
 *   rest (Odpoczynek)  calm builds the thermals' strength T; warm columns rise over the valleys ahead
 *                      and lift the eaglet (0.6 + 1.4 T) sh/s for (1 + 0.6 T) s: clouds, long glides,
 *                      a grań sooner.
 *   blind              every 4th push from the 3rd session: the sun's halo is veiled, its effect is
 *                      the same, the charge waits; at the end the held seconds are revealed.
 * Each block is judged once at its end (RoundJudge): a passed push gives 4 s of daylight, a passed
 * rest starts the next with warm air; both +100.  While the signal is unreliable nothing brain-driven
 * moves: the night comes at its base pace and T holds.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { scaledBlock } from '../kit/rhythm';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome, SignalPhase } from '../kit/types';
import { TASKS, lessonText, lines, type Moment } from './content';
import { Eaglet, type FlightEvent, type Landing } from './flight';
import { fmtInt, fmtNum, metres, t, type Key } from './i18n';
import { TEACH, checkLessons, cueBase, hatch, migrate, multOf, noFeats, openLessons, plumageOf, wantsPractice, type Feats, type Teach, type WzlotProgress } from './meta';
import { RULES, readSec } from './rules';
import { Talk } from './talk';
import { Terrain, type GranSpec, type Zone } from './terrain';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/** What the hands should do now: the cue near the eaglet ("Trzymaj ↓" / "Puść ↑"). */
export type Cue = 'hold' | 'release';
/** A slide's verdict. */
export type Verdict = 'perfect' | 'early' | 'late';
/**
 * Why: the let-go on the way down came too soon (`releaseEarly`) or the hold went on up the next slope
 * (`releaseLate`); the dive came too late (`diveLate`: a glide onto the upslope, or across the slope) or too early
 * (`diveEarly`: a dive over the upslope, before the crest); `slide` for a perfect one.
 */
export type VerdictWhy = 'slide' | 'releaseEarly' | 'releaseLate' | 'diveLate' | 'diveEarly';

/** The practice valley's steps: on to the next downslope, wait for the hold, down, wait for the let-go, up. */
export type PracticeStep = 'go' | 'waitHold' | 'down' | 'waitRelease' | 'up';
export interface Practice {
  /** slides done (0…practiceReps) */
  rep: number;
  step: PracticeStep;
  /** seconds of practice, and in this step */
  t: number;
  stepT: number;
  /** the valley of this slide: its downslope's top, its bottom, the next crest */
  down0: number;
  trough: number;
  crest: number;
  /** the wait came back: a let-go too soon (hold again) or a hold on the way up (let go again) */
  again: boolean;
}

/** A coach mark or a one-line label, waiting its turn (one explanation at a time). */
interface Explain {
  key: Teach | 'sun' | 'thermal';
  label: boolean;
  at?: Anchor;
  mark?: boolean;
  /** the label's world x (a warm column) */
  x: number;
  /** its shelf life (sim seconds), and whether it still fits the moment */
  until: number;
  still?: () => boolean;
}

/** A slide on the ground through one valley (the verdict's record). */
interface Slide {
  trough: number;
  crest: number;
  downLen: number;
  upLen: number;
  /** the hand held on the way down (or the dive that landed here) */
  pressed: boolean;
  /** where the hand let go (null: not yet, or held again since) */
  releaseX: number | null;
  judged: boolean;
}

/** A thermal over a valley: its column's centre and floor. */
export interface Thermal { readonly id: number; readonly x: number; readonly base: number; used: boolean; age: number }

/** Where a coach mark points (index.ts turns it into canvas px through the view). */
export type Anchor = 'eaglet' | 'sun' | 'crag' | 'thermal' | 'night' | 'center';

/** A day's tally (the card at nightfall). */
export interface Tally {
  day: number;
  points: number;
  metres: number;
  /** the farthest grań reached (1-based) */
  gran: number;
  perfect: number;
  coins: number;
  feverSec: number;
  sunHeld: number;
  record: boolean;
  /** points short of the best day (a near miss), null when not close or no record yet */
  toRecord: number | null;
}

export type SimEvent =
  | { type: 'dawn'; day: number }
  | { type: 'takeoff' }
  | { type: 'land'; cls: Landing; deg: number; air: number; pts: number }
  | { type: 'launch'; perfect: boolean }
  | { type: 'perfect'; chain: number; pts: number }
  | { type: 'bump' }
  | { type: 'fever'; band: boolean }
  | { type: 'feverEnd' }
  | { type: 'coin'; x: number; y: number; pts: number; streak: number }
  | { type: 'orb'; x: number; y: number; pts: number }
  | { type: 'cloud'; x: number; y: number; pts: number }
  | { type: 'leap'; index: number }
  | { type: 'leapDone'; pts: number }
  | { type: 'gran'; index: number; sun: number; quick: number; pts: number }
  | { type: 'catch'; why: 'roll' | 'gap' }
  | { type: 'carried' }
  | { type: 'thermalRise'; thermal: Thermal }
  | { type: 'thermal'; T: number }
  | { type: 'climbTop'; height: number; pts: number }
  | { type: 'nightfall' }
  | { type: 'tally'; tally: Tally }
  | { type: 'telegraph'; next: Block }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; sunHeld: number; pts: number }
  | { type: 'lesson'; text: string }
  | { type: 'nest'; level: number }
  | { type: 'hatch'; n: number }
  | { type: 'hint'; key: Teach; at: Anchor }
  /** a slide judged: `x` the moment on the hill (the let-go, the touchdown), `ideal` where it would have been right */
  | { type: 'verdict'; v: Verdict; why: VerdictWhy; x: number; ideal: number | null; chain: number }
  | { type: 'practice'; step: PracticeStep; rep: number; again: boolean }
  | { type: 'practiceDone'; finished: boolean }
  /** a one-line explanation where it matters, the first time in a session: by the sun, at a warm column */
  | { type: 'label'; what: 'sun' | 'thermal'; x: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

// ── pure rules ───────────────────────────────────────────────────
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks: a first-ever session opens with a warm-up (30 s in 5 and 10 min, 20 s in 3,
 * 6 s in a 40 s test); then push / rest pairs (40 ± 7 s and 20 ± 3 s, or the player's rhythm with the
 * jitter scaled to it; scaled to end on time, jittered only when there is room) ending with a rest,
 * leaving the last 6 s to the last sunset.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number, rhythm?: { focus: number; rest: number } | null): Block[] {
  const R = { ...RULES, push: scaledBlock(RULES.push, rhythm?.focus ?? RULES.push[0]), rest: scaledBlock(RULES.rest, rhythm?.rest ?? RULES.rest[0]) };
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - R.finale);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec - R.finale;
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  const pair = R.push[0] + R.rest[0];
  const pairs = Math.max(1, Math.round(left / pair));
  const jitter = pairs >= 2 && left / (pairs * pair) >= 0.85 ? 1 : 0;
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1], R.rest[0] + jitter * (rnd() * 2 - 1) * R.rest[1]);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** The night's pace for the smoothed level L in a push block: the band can only slow it. */
export const nightPace = (L: number): number => 1 - RULES.holdMax * clamp(2 * L - 1);

/** A thermal of strength T: its climb rate (sh/s) and how long it lifts (s). */
export const climbFor = (T: number): { rate: number; dur: number } => ({
  rate: RULES.climbRate[0] + RULES.climbRate[1] * clamp(T),
  dur: RULES.climbDur[0] + (RULES.climbDur[1] - RULES.climbDur[0]) * clamp(T),
});

/** How quick a grań was (0..1): full at half its par, nothing at par or slower. */
export const quickOf = (took: number, hills: number): number => {
  const par = RULES.parPerHill * hills;
  return clamp((par - took) / (par * 0.5));
};

/** The daylight a grań gives back (before the quick bonus): less for each next one, as the day goes on. */
export const granSunFor = (index: number): number => Math.max(RULES.granMin, RULES.granSun - RULES.granStep * (index - 1));

/** The perfect slide's points before the multipliers, for its place in the chain (1-based). */
export const perfectPts = (chain: number): number => Math.min(RULES.perfectMax, RULES.perfect + RULES.perfectStep * (chain - 1));

/** The seed of the day's i-th grań: the same for everyone today, and in every run of the day. */
export const granSeed = (daySeed: number, i: number): number => (daySeed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: WzlotProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** the rest's rhythm the player set (s of holding the sun, s of thermals); absent: the rules' */
  rhythm?: { focus: number; rest: number } | null;
}

export type Phase = 'play' | 'finale' | 'done';
export type DayPhase = 'nest' | 'fly' | 'dusk' | 'tally';

export class WzlotSim {
  readonly p: WzlotProgress;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly firstEver: boolean;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  private readonly events: SimEvent[] = [];
  private readonly flightEvents: FlightEvent[] = [];

  terrain!: Terrain;
  eaglet!: Eaglet;
  started = false;
  phase: Phase = 'play';
  dayPhase: DayPhase = 'nest';
  /** seconds of play; seconds into the current day phase */
  t = 0;
  phaseT = 0;

  // ── blocks ──
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  private pushesHere = 0;
  private restsHere = 0;
  private taskNow = '';

  // ── the day ──
  dayNo = 0;
  dayLeft = 0;
  /** seconds flown in this day; when the current grań began */
  dayT = 0;
  private granT = 0;
  granIdx = 0;
  dayScore = 0;
  dayMult = 1;
  private lastMaxX = 0;
  tally: Tally | null = null;
  private nightWarned = false;
  /** the opening story card is up (first-ever session, before the first takeoff) */
  opening = false;

  // ── the session's points ──
  banked = 0;
  private dayFeats: Feats = noFeats();
  private sessionFeats: Feats = noFeats();
  daysDone = 0;
  bestDayHere = 0;
  farthestHere = 0;
  bestGranHere = 0;
  perfectHere = 0;
  coinsHere = 0;
  feverSecHere = 0;
  sunHeldHere = 0;
  catches = 0;
  maxChain = 0;
  climbs = 0;
  bandFevers = 0;
  private readonly bestDayBefore: number;
  private readonly bestBefore: number | null;
  private readonly nestBefore: number;
  readonly lessonsDone: string[] = [];
  hatched = 0;
  private settled = false;

  // ── the flight ──
  private readonly downs = new Set<number>();
  private readonly keys = new Set<string>();
  private holdUntil = 0;
  held = false;
  chain = 0;
  fever = false;
  feverBand = false;
  feverT = 0;
  private feverSafe = 0;
  private leaping = -1;
  private cloudCool = 0;
  coinStreak = 0;
  private lastCoinT = -9;
  private dayDistance = 0;
  private daySun = 0;

  // ── the band ──
  /** the smoothed level, the sun's hold now (0..1 of holdMax), the Poryw's charge, the thermals' strength */
  Ls = 0.5;
  sunFrac = 0;
  charge = 0;
  T: number = RULES.tFloor;
  private nextRestT: number = RULES.tFloor;
  private gapSec = 99;
  private reliable = false;
  private blockSun = 0;
  private goodT = 0;
  private goodSaid = false;
  readonly thermals: Thermal[] = [];
  private thermalId = 0;
  private nextThermal = 0;
  private quietT = 0;
  private lessonCheck = 0;
  private pendingNest: number | null = null;
  private hintT: Partial<Record<Teach, number>> = {};
  /** hit-stop: the flight runs at a sliver of its pace for this long (s) after a big moment */
  private stopT = 0;

  // ── when to steer (round 11) ──
  /** the slide through the valley under the eaglet, for its verdict */
  private slide: Slide | null = null;
  /** the cue now, and a change waiting a moment so it never flickers */
  private cueNow: Cue | null = null;
  private cueNext: Cue | null = null;
  private cueWait = 0;
  /** what lay under the eaglet when the current hold began (a dive over an upslope is early) */
  private pressZone: Zone = 'hold';
  private wasHeld = false;
  /** the touch that took off (its pointer, its key, its shortest hold): the practice waits for a new one */
  private spentId: number | null = null;
  private spentKey: string | null = null;
  private spentTap = false;
  /** when the current hold began */
  private holdStart = 0;
  /** misses in a row (an early or late verdict): the cues come back in full */
  missStreak = 0;
  private readonly cueStart: number;
  /** this session opens with the practice valley; the practice now (null: none, or over) */
  readonly practiceSession: boolean;
  practice: Practice | null = null;
  private practiceBegun = false;
  practiceFinished = false;
  private readonly practiceCap: number;
  /** the one-line explanations already shown this session; the seconds the sun has been held up so far */
  private sunLabel = false;
  private thermalLabel = false;
  private sunGood = 0;
  /** one explanation at a time: until when the one on screen is read, and what waits */
  private explainUntil = -1;
  private readonly waitingExplain: Explain[] = [];

  constructor(private readonly init: SimInit) {
    this.p = migrate(init.progress);
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.rng = init.rng;
    this.firstEver = this.p.sessions === 0;
    this.judge = RoundJudge.from(init.tuning);
    this.talk = new Talk(lines(), init.rng);
    this.practiceSession = wantsPractice(this.p);
    this.practiceCap = Math.max(RULES.practiceMin, Math.min(RULES.practiceMax, RULES.practiceShare * init.plannedSec));
    this.cueStart = this.firstEver || this.practiceSession ? 1 : cueBase(this.p);
    // a session with the practice valley opens with a free warm-up, as a first one does: the practice is no push block
    this.plan = planBlocks(init.plannedSec, this.firstEver || this.practiceSession, init.rng, init.rhythm);
    this.bestDayBefore = this.p.bestDay;
    this.bestBefore = this.p.sessions > 0 && this.p.bestTotal > 0 ? this.p.bestTotal : null;
    this.nestBefore = this.p.nest;
    this.newGround();
  }

  // ── read-outs ──────────────────────────────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get nextBlock(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get telegraphing(): boolean { return this.phase === 'play' && this.telegraphed && this.nextBlock !== null; }
  get total(): number { return this.banked + this.dayScore; }
  get mult(): number { return this.dayMult * (this.fever ? 2 : 1); }
  get plumage(): 1 | 2 | 3 { return plumageOf(this.p); }
  /** the sun along its arc: 0 dawn … 1 the night has caught up */
  get sunAt(): number { return clamp(1 - this.dayLeft / RULES.dayMax); }
  get lead(): number { return this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs; }
  get inPush(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get inRest(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get blind(): boolean { return this.inPush && this.block.blind; }
  /** what the dock's banner and the panel say to do in the head */
  get task(): string { return this.taskNow; }
  /** the Poryw's charge is waiting for a blind block's end */
  get chargeHidden(): boolean { return this.blind; }

  /**
   * What the hands should do now — the cue near the eaglet: "hold" on (or falling over) a downslope, "release" up
   * the next slope, over a gorge and in a warm column; in the practice its own step.  Null when there is nothing to
   * steer (the nest, the night, the mother's care).
   */
  cue(): Cue | null {
    if (!this.started || this.dayPhase !== 'fly') return null;
    const pr = this.practice;
    if (pr && pr.step !== 'go') return pr.step === 'waitHold' || pr.step === 'down' ? 'hold' : 'release';
    return this.cueNow;
  }

  /**
   * How strongly the cues and the coloured slopes show (0..1): in full in a first session and with the practice, and
   * after two misses in a row; otherwise fading as perfect slides add up (meta.cueBase), unless the lobby keeps them.
   */
  get cueLevel(): number {
    return this.missStreak >= RULES.cueMiss ? 1 : this.cueStart;
  }

  /** The flight is waiting for the hand (the practice valley stands still). */
  get waiting(): boolean {
    const s = this.practice?.step;
    return s === 'waitHold' || s === 'waitRelease';
  }

  /** The gauge: the sun's hold in a sighted push, the thermals in a rest (null: blind, no signal, free). */
  meter(): number | null {
    if (!this.started || !this.reliable) return null;
    if (this.inPush) return this.block.blind ? null : this.Ls;
    if (this.inRest) return this.T;
    return null;
  }

  signal(): SignalPhase {
    if (!this.started || this.phase !== 'play') return { want: 'free', blind: false };
    const b = this.block, next = this.telegraphing ? this.nextBlock : null;
    const kind = (k: BlockKind) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free') as SignalPhase['want'];
    const left = Math.max(0, b.dur - this.blockT);
    // (a warm-up waiting for the practice valley has no end to count down to)
    if (b.kind === 'warmup') return { want: 'free', blind: false, left: this.practiceHolds ? undefined : left, next: next ? kind(next.kind) : null };
    return { want: kind(b.kind), blind: b.blind, task: this.taskNow, left, next: next ? kind(next.kind) : null };
  }

  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || !this.inPush || this.block.blind) return null;
    return f.level;
  }

  headline(): { value: number; sub?: string } {
    const v = Math.floor(this.total);
    let sub: string;
    if (this.fever) sub = t('sub.fever', { m: this.mult });
    else if (this.chain > 0) sub = t('sub.chain', { n: this.chain });
    else if (this.bestDayBefore > 0 && this.dayPhase === 'fly' && this.dayScore < this.bestDayBefore) sub = t('sub.toRecord', { n: fmtInt(this.bestDayBefore - this.dayScore) });
    else sub = t('sub.day', { n: Math.max(1, this.dayNo), m: this.dayMult });
    return { value: v, sub };
  }

  // ── start, input ───────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.hatched = hatch(this.p);
    if (this.hatched > 0) this.emit({ type: 'hatch', n: this.hatched });
    this.opening = this.firstEver && !this.p.opened;
    this.beginBlock(0);
    this.dawn();
  }

  private newGround(): void {
    const seed = this.init.daySeed, gentle = this.firstEver;
    this.terrain = new Terrain((i): GranSpec => ({ seed: granSeed(seed, i), gentle: gentle && i === 0 }));
    this.terrain.ensure(8);
    this.eaglet = new Eaglet(this.terrain, e => this.flightEvents.push(e));
    this.eaglet.toNest();
    this.lastMaxX = this.eaglet.maxX;
  }

  /** A new day in the nest: the same granie, the sun up, the eaglet waiting for a touch. */
  private dawn(): void {
    this.dayNo++;
    if (this.dayNo > 1) this.newGround();
    this.dayPhase = 'nest';
    this.phaseT = 0;
    this.dayLeft = this.firstEver && this.dayNo === 1 ? RULES.dayFirst : RULES.day0;
    this.dayT = 0;
    this.granT = 0;
    this.granIdx = 0;
    this.dayScore = 0;
    this.dayMult = multOf(this.p);
    this.dayFeats = { ...noFeats(), daysSession: this.daysDone };
    this.tally = null;
    this.nightWarned = false;
    this.chain = 0;
    this.slide = null;
    this.cueNow = this.cueNext = null;
    this.endFever(false);
    this.leaping = -1;
    this.dayDistance = 0;
    this.daySun = 0;
    this.thermals.length = 0;
    this.emit({ type: 'dawn', day: this.dayNo });
    if (!this.opening) this.talk.ask(this.dayNo === 1 && this.firstEver ? 'open' : 'dawn', 2, 6);
  }

  private takeoff(): void {
    if (this.dayPhase !== 'nest') return;
    const practice = this.practiceSession && !this.practiceBegun && this.phase === 'play';
    if (this.opening) {
      this.opening = false;
      this.p.opened = true;
      if (!practice) this.talk.ask('open', 3, 8);
    }
    this.dayPhase = 'fly';
    this.phaseT = 0;
    this.eaglet.leave();
    this.emit({ type: 'takeoff' });
    if (practice) this.beginPractice();
    else this.teach('hold', 'eaglet');
  }

  // ── the practice valley ─────────────────────────────────────────
  private beginPractice(): void {
    this.practiceBegun = true;
    this.talk.clear();
    this.practice = { rep: 0, step: 'go', t: 0, stepT: 0, down0: 0, trough: 0, crest: 0, again: false };
  }

  private practiceTo(step: PracticeStep, again = false): void {
    const pr = this.practice!;
    pr.step = step;
    pr.again = again;
    pr.stepT = 0;
    this.emit({ type: 'practice', step, rep: pr.rep, again });
  }

  /**
   * One frame of the practice valley: its step from the eaglet and the hand, and the flight's pace — slow motion,
   * and standing still while the game waits for the hold at a downslope's top or the let-go at its bottom.  A let-go
   * high on the way down asks for the hold again; a hold on the way up, for the let-go.  Over the next crest a
   * slide is done; after the third, full speed.
   */
  private practiceFrame(dt: number): number {
    const pr = this.practice!, e = this.eaglet, T = this.terrain, R = RULES, held = this.practiceHeld, slow = R.practiceSlow;
    pr.t += dt;
    pr.stepT += dt;
    if (pr.t > this.practiceCap || this.phase !== 'play') {
      this.endPractice(false);
      return 1;
    }
    if (e.caught) {
      // the mother carries it on: the slide begins again past her
      if (pr.step !== 'go') this.practiceTo('go');
      return slow;
    }
    switch (pr.step) {
      case 'go': {
        // on to the top of the next downslope: on the ground past the crest, or falling over it
        if (T.zoneAt(e.x) !== 'hold' || (e.airborne && e.vy > 0) || e.mode === 'climb') return slow;
        const v = T.valley(e.x);
        pr.down0 = v.down0;
        pr.trough = v.trough;
        pr.crest = v.crest;
        this.practiceTo(held ? 'down' : 'waitHold');
        return held ? slow : 0;
      }
      case 'waitHold':
        if (!held) return 0;
        this.practiceTo('down');
        return slow;
      case 'down':
        if (e.x >= pr.trough - 0.01) {
          if (!held) {
            this.practiceTo('up');
            return slow;
          }
          this.practiceTo('waitRelease');
          return 0;
        }
        if (!held) {
          // a let-go near the bottom is on time; higher up, the hold again
          if (pr.trough - e.x > R.practiceEarly * Math.max(0.05, pr.trough - pr.down0)) {
            this.practiceTo('waitHold', true);
            return 0;
          }
          this.practiceTo('up');
        }
        return slow;
      case 'waitRelease':
        if (held) return 0;
        this.practiceTo('up');
        return slow;
      case 'up':
        // over the crest the slide's verdict ("Idealnie!") moves the practice on (slideVerdict); should none come
        // (the slide was lost on the way), it moves on a little past the crest
        if (e.x >= pr.crest + 0.15) {
          pr.rep++;
          if (pr.rep >= R.practiceReps) this.endPractice(true);
          else this.practiceTo('go');
          return slow;
        }
        // a hold on the way up waits for the let-go; just under the crest it is the next slide's
        if (held && e.x > pr.trough + 0.01 && e.x < pr.crest - R.pressNear * (pr.crest - pr.trough)) {
          this.practiceTo('waitRelease', true);
          return 0;
        }
        return slow;
    }
  }

  /** The practice is over: finished (three slides; the hold and the let-go are taught) or out of time. */
  private endPractice(finished: boolean): void {
    if (!this.practice) return;
    this.practice = null;
    this.practiceFinished = finished;
    if (finished) {
      this.p.practiced++;
      this.p.practice = false;
      // the practice showed the hold, the let-go, the perfect slide and the Poryw it lit
      this.p.taught |= TEACH.hold | TEACH.release | TEACH.perfect | (this.fever ? TEACH.fever : 0);
    }
    this.emit({ type: 'practiceDone', finished });
    this.talk.ask('open', 3, 8);
    this.afterWarmUp();
  }

  /**
   * The warm-up waited for the practice: when the practice took longer than the warm-up's time, the blocks after it
   * are planned again for the time left (a telegraph's seconds of free flight first); with too little left for a
   * push and a rest, the flight stays free until the last sunset.
   */
  private afterWarmUp(): void {
    const b = this.block, R = RULES;
    if (this.phase !== 'play' || b.kind !== 'warmup' || this.blockT < b.dur - R.telegraph) return;
    const left = this.plannedSec - R.finale - this.t - R.telegraph;
    this.plan.length = this.blockIndex + 1;
    if (left >= 2 * R.minBlock) {
      b.dur = this.blockT + R.telegraph;
      this.plan.push(...planBlocks(left + R.finale, false, this.rng, this.init.rhythm));
    } else b.dur = this.blockT + Math.max(0, left + R.telegraph);
  }

  /** The warm-up holds while the practice is still to come or under way. */
  private get practiceHolds(): boolean {
    return this.practice !== null || (this.practiceSession && !this.practiceBegun && this.dayNo <= 1);
  }

  /**
   * A finger, a button or a key goes down.  The one that takes off (the story card, the dawn's prompt) is no hold for
   * the practice valley, which waits for a new one — unless it stays down: a hold kept half a second is meant.
   */
  private touch(id: number | null, key: string | null): void {
    let spend = false;
    if (this.dayPhase === 'nest' && this.phase === 'play' && (!this.opening || this.phaseT > 1.2)) {
      this.takeoff();
      spend = true;
    } else if (this.dayPhase === 'tally' && this.phaseT >= RULES.tallyMin) this.afterTally();
    else if (this.dayPhase === 'nest') spend = true;
    this.holdUntil = this.t + RULES.minHold;
    this.spentTap = spend;
    if (spend) {
      this.spentId = id;
      this.spentKey = key;
    }
  }

  pointer(type: 'down' | 'move' | 'up', id: number): void {
    if (type === 'down') {
      this.downs.add(id);
      this.touch(id, null);
    } else if (type === 'up') {
      this.downs.delete(id);
      if (id === this.spentId) this.spentId = null;
    }
  }

  /** Space, ↓, Enter, S: the same as a finger. */
  key(key: string, down: boolean): boolean {
    if (key !== ' ' && key !== 'Spacebar' && key !== 'ArrowDown' && key !== 'Enter' && key !== 's' && key !== 'S') return false;
    if (down) {
      if (!this.keys.has(key)) {
        this.keys.add(key);
        this.touch(null, key);
      }
    } else {
      this.keys.delete(key);
      if (key === this.spentKey) this.spentKey = null;
    }
    return true;
  }

  /** The hand holds for the practice valley: a new hold, or one kept down half a second (not the tap that took off). */
  private get practiceHeld(): boolean {
    if (!this.held) return false;
    if (this.t - this.holdStart >= 0.5 && (this.downs.size > 0 || this.keys.size > 0)) return true;
    for (const id of this.downs) if (id !== this.spentId) return true;
    for (const k of this.keys) if (k !== this.spentKey) return true;
    return !this.spentTap && this.t < this.holdUntil;
  }

  /** A hit-stop of `sec` seconds (the view asks for one on a perfect slide, the Poryw, a leap). */
  hitStop(sec: number): void { this.stopT = Math.max(this.stopT, sec); }

  /** Let go of everything (a pause, the end). */
  release(): void {
    this.downs.clear();
    this.keys.clear();
    this.holdUntil = 0;
  }

  // ── the frame ──────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || this.phase === 'done' || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.held = this.downs.size > 0 || this.keys.size > 0 || t < this.holdUntil;
    // a hold begins: what lies under the eaglet (a dive over an upslope comes too early)
    if (this.held && !this.wasHeld) {
      this.pressZone = this.terrain.zoneAt(this.eaglet.x);
      this.holdStart = t;
    }
    this.wasHeld = this.held;
    this.blocks(dt, f);
    this.brain(dt, f);
    this.day(dt);
    this.talkFrame(dt);
    this.lessonCheck -= dt;
    if (this.lessonCheck <= 0) {
      this.lessonCheck = 0.5;
      this.lessons();
    }
  }

  // ── blocks ─────────────────────────────────────────────────────
  private beginBlock(i: number): void {
    this.blockIndex = i;
    this.blockT = 0;
    this.telegraphed = false;
    this.judge.reset();
    this.blockSun = 0;
    this.goodT = 0;
    this.goodSaid = false;
    const b = this.block;
    if (b.kind === 'push') {
      this.p.pushes++;
      b.blind = this.p.sessions + 1 >= RULES.blindFrom && this.pushesHere > 0 && this.p.pushes % RULES.blindEvery === 0;
      const list = b.blind ? TASKS.blind : TASKS.push;
      this.taskNow = t(list[(this.pushesHere + this.p.sessions) % list.length] as Key);
      this.pushesHere++;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 9);
    } else if (b.kind === 'rest') {
      this.taskNow = t(TASKS.rest[(this.restsHere + this.p.sessions) % TASKS.rest.length] as Key);
      this.restsHere++;
      this.T = Math.max(RULES.tFloor, this.nextRestT);
      this.nextRestT = RULES.tFloor;
      this.nextThermal = RULES.thermalFirst;
      this.talk.ask('rest', 2, 9);
    } else this.taskNow = '';
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private blocks(dt: number, f: FocusFrame): void {
    if (this.phase !== 'play') return;
    const b = this.block;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      this.judge.push(b.kind === 'push' ? 'focus' : 'rest', f, dt);
      this.contrast.push(b.kind === 'push' ? 'focus' : 'rest', f.activity, f.reliable, this.blockT, dt);
    }
    const next = this.nextBlock;
    // the warm-up waits for the practice valley (its blocks are planned again when it is over)
    if (b.kind === 'warmup' && this.practiceHolds) return;
    if (!this.telegraphed && next && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next });
    }
    if (this.blockT >= b.dur) {
      // the frame's overshoot carries into the next block: an hour of ~120 blocks would otherwise reach its last
      // sunset 1–2 s late and the runner would cut the last day's tally short
      const over = this.blockT - b.dur;
      this.endBlock();
      if (next) {
        this.beginBlock(this.blockIndex + 1);
        this.blockT = over;
      } else this.beginFinale();
    }
  }

  private endBlock(): void {
    const b = this.block;
    if (b.kind === 'warmup') return;
    const verdict = this.judge.verdict();
    let pts = 0;
    if (verdict) {
      pts = this.gain(RULES.blockPass);
      if (b.kind === 'push') {
        if (this.dayPhase === 'fly') this.dayLeft += RULES.pushSun;
      } else this.nextRestT = RULES.tPass;
    }
    this.emit({ type: 'blockEnd', block: b, verdict, share: this.judge.share, need: this.judge.need(b.kind === 'push' ? 'focus' : 'rest'), sunHeld: this.blockSun, pts });
    // a blind block's charge waited for its end
    if (b.kind === 'push' && b.blind && this.charge >= 1) this.bandFever();
  }

  private beginFinale(): void {
    this.phase = 'finale';
    this.emit({ type: 'finale' });
    if (this.dayPhase === 'fly') this.dayLeft = Math.min(this.dayLeft, 1.5);
    else if (this.dayPhase === 'nest') this.finishDays();
  }

  // ── the band ───────────────────────────────────────────────────
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES;
    const ok = f.reliable && f.activity !== null;
    this.reliable = ok;
    if (ok) {
      this.gapSec = 0;
      this.Ls = approach(this.Ls, f.level, dt, this.eeg ? R.tauL.eeg : R.tauL.fnirs);
    } else {
      this.gapSec += dt;
      if (this.gapSec > R.gap) this.Ls = approach(this.Ls, 0.5, dt, 1);
    }
    const live = this.gapSec < R.gap;
    this.sunFrac = this.inPush && live && this.blockT >= this.lead ? clamp(2 * this.Ls - 1) : 0;
    if (this.inPush && ok && f.focused && this.blockT >= this.lead && !this.fever) {
      this.charge = Math.min(1, this.charge + dt / (this.eeg ? R.feverHold.eeg : R.feverHold.fnirs));
      if (this.charge >= 1 && !this.block.blind) this.bandFever();
    }
    if (this.inRest && ok && this.blockT >= (this.eeg ? R.tLeadIn.eeg : R.tLeadIn.fnirs)) {
      this.T = clamp(this.T + (R.tGain * f.calm - R.tLeak) * dt, R.tFloor, 1);
    }
    // the first time in a session the focus holds the sun up for a second, the sun says so ("Twoje skupienie trzyma
    // słońce wysoko"); the label stays to be read
    if (!this.sunLabel && this.inPush && !this.block.blind && this.dayPhase === 'fly' && this.sunFrac > 0.15) {
      this.sunGood += dt;
      if (this.sunGood >= 1) {
        this.sunLabel = true;
        this.p.taught |= TEACH.sun;
        this.explain({ key: 'sun', label: true, x: this.eaglet.x, until: this.t + 20, still: () => this.inPush && !this.blind && this.dayPhase === 'fly' });
      }
    }
    // a good push, in the companion's words once a block
    if (this.inPush && !this.block.blind && this.sunFrac > 0.4) {
      this.goodT += dt;
      if (this.goodT > 3 && !this.goodSaid) {
        this.goodSaid = true;
        this.talk.ask('goodPush', 2, 5);
      }
    }
  }

  private bandFever(): void {
    this.charge = 0;
    if (this.dayPhase !== 'fly') {
      this.charge = 1;   // it waits for the flight
      return;
    }
    this.bandFevers++;
    this.dayFeats.bandFever++;
    this.startFever(true);
  }

  // ── the day ────────────────────────────────────────────────────
  private day(dt: number): void {
    switch (this.dayPhase) {
      case 'nest':
        if (this.phase !== 'play') {
          this.finishDays();
          return;
        }
        if (this.phaseT >= (this.opening ? RULES.openWait : RULES.dawnWait)) this.takeoff();
        return;
      case 'fly':
      case 'dusk':
        this.fly(dt);
        return;
      case 'tally':
        if (this.phaseT >= RULES.tallyMax) this.afterTally();
        return;
    }
  }

  private fly(dt: number): void {
    const R = RULES;
    const flying = this.dayPhase === 'fly';
    // the practice valley: slow motion, standing still while it waits for the hand; no night meanwhile
    const slow = flying && this.practice ? this.practiceFrame(dt) : 1;
    if (flying && this.practice) {
      this.flightFrame(dt * slow, flying);
      return;
    }
    if (flying) {
      this.dayT += dt;
      const pace = 1 - RULES.holdMax * this.sunFrac;
      this.dayLeft -= dt * pace;
      const held = dt * (1 - pace);
      this.blockSun += held;
      this.sunHeldHere += held;
      this.daySun += held;
      if (this.charge >= 1 && !this.fever && !this.blind) this.bandFever();
      if (!this.nightWarned && this.dayLeft < R.nightNear) {
        this.nightWarned = true;
        this.talk.ask('nightNear', 3, 4);
        this.teach('night', 'night');
      }
      if (this.dayLeft <= 0) {
        this.dayLeft = 0;
        this.nightfall();
      }
    } else if (this.phaseT >= R.dusk) {
      this.endDay();
      return;
    }
    if (this.fever) {
      this.feverT += dt;
      this.feverSafe = Math.max(0, this.feverSafe - dt);
      this.feverSecHere += dt;
      this.dayFeats.feverDay += dt;
    }
    this.cloudCool -= dt;
    this.rest(dt);
    this.flightFrame(dt, flying);
  }

  /**
   * The flight's frame (`dt` already slowed by the practice): the fixed-step flight (a hit-stop slows it for a few
   * frames), each step's events, pickups and the slide's verdict; the distance points, the granie, the cue and the
   * coach marks.
   */
  private flightFrame(dt: number, flying: boolean): void {
    const R = RULES;
    const e = this.eaglet;
    const inp = { held: flying && this.held, fever: this.fever };
    let left = this.stopT > 0 ? dt * 0.12 : dt;
    this.stopT = Math.max(0, this.stopT - dt);
    while (left > 1e-9) {
      const h = Math.min(R.step, left);
      left -= h;
      e.step(h, inp);
      if (this.flightEvents.length) this.flightOut();
      this.pickups();
      if (flying) this.slideStep(inp.held);
    }
    this.cueFrame(dt);
    // distance points (the farthest point only: a roll back costs nothing)
    if (e.maxX > this.lastMaxX) {
      const dx = e.maxX - this.lastMaxX;
      this.lastMaxX = e.maxX;
      this.dayDistance += dx;
      this.gain(dx * R.mPerSh * R.ptsPerM);
    }
    this.granie();
    this.terrain.ensure(e.x + 6);
    this.terrain.trim(e.x - 2.5);
    // tutorial: the release, the crag
    if (flying && (this.p.taught & TEACH.hold) && !(this.p.taught & TEACH.release) && this.held && e.mode === 'ground' && this.terrain.slope(e.x) > 0.12) {
      this.teach('release', 'eaglet', false);
    }
    const g = this.terrain.byIndex(0);
    // the crag's coach mark once it is in sight (a phone sees about 1.2 screen heights ahead)
    if (g && flying && !(this.p.taught & TEACH.crag) && e.x > g.crag - 1 && e.x < g.crag) this.teach('crag', 'crag');
    if (flying && this.held && !(this.p.taught & TEACH.hold) && this.phaseT > 0.3) this.p.taught |= TEACH.hold;
    if (flying && !(this.p.taught & TEACH.hold) && (this.hintT.hold ?? 0) + 6 < this.t) this.teach('hold', 'eaglet', false);
  }

  /** What the flight did this step, in the game's terms. */
  private flightOut(): void {
    const R = RULES;
    for (const fe of this.flightEvents) {
      switch (fe.type) {
        case 'launch': {
          const g = this.terrain.granAt(fe.x);
          if (!this.held && !(this.p.taught & TEACH.release) && (this.p.taught & TEACH.hold)) this.p.taught |= TEACH.release;
          // off the crest after the valley's bottom: the slide is judged; a hop before it is no slide
          const s = this.slide;
          const perfect = s !== null && fe.x >= s.trough ? this.endSlide(fe.x) : (this.slide = null, false);
          this.emit({ type: 'launch', perfect });
          if (g && Math.abs(fe.x - g.crag) < 0.2 && this.leaping !== g.index) {
            this.leaping = g.index;
            this.emit({ type: 'leap', index: g.index });
          }
          break;
        }
        case 'land': {
          let pts = 0;
          if (fe.airT >= R.airFrom) pts = this.gain(R.airPts * fe.airT);
          this.dayFeats.airFlight = Math.max(this.dayFeats.airFlight, fe.airT);
          this.emit({ type: 'land', cls: fe.cls, deg: fe.deg, air: fe.airT, pts });
          this.slide = null;
          if (fe.cls !== 'smooth' && fe.cls !== 'near') {
            this.landingVerdict(fe.down);
            if (fe.cls === 'stall') {
              this.emit({ type: 'bump' });
              if (this.rng() < 0.6) this.talk.ask('bump', 1, 3);
            }
            if (this.fever && this.feverSafe <= 0) this.endFever(true);
          }
          break;
        }
        case 'crest':
          break;
        case 'catch':
          this.catches++;
          this.leaping = -1;
          this.chain = 0;
          this.slide = null;
          this.emit({ type: 'catch', why: fe.why });
          this.talk.ask('catch', 3, 4);
          break;
        case 'carried':
          this.emit({ type: 'carried' });
          break;
        case 'climbEnd': {
          const pts = this.gain(R.climbTop);
          this.emit({ type: 'climbTop', height: fe.height, pts });
          break;
        }
        case 'climbOut':
          break;
      }
    }
    this.flightEvents.length = 0;
  }

  // ── when to steer: the slide's verdict and the cue ─────────────────
  /**
   * One step of the slide through the valley under the eaglet (on the ground): on the way down the hand should
   * hold; it should let go about the valley's bottom — from releaseEarly of the downslope before it to releaseLate
   * of the upslope after it (or a moment's travel either way, whichever is more: a fast eaglet passes a valley in a
   * fraction of a second).  A let-go higher up is "Za wcześnie", a hold still on further up "Za późno", judged the
   * moment it is known; on time, the crest (a launch or a roll over it) makes it "Idealnie!".  A valley the hand
   * never held is no slide to judge (the cue already asks).
   */
  private slideStep(held: boolean): void {
    const e = this.eaglet, T = this.terrain, R = RULES;
    let s = this.slide;
    if (e.mode !== 'ground') {
      // airborne before the bottom (a hop), climbing a column, in the mother's care: no slide; the landing is judged
      if (s && (e.mode !== 'air' || e.x < s.trough)) this.slide = null;
      return;
    }
    if (s && e.x >= s.crest) {
      this.endSlide(e.x);   // rolled over the crest
      s = null;
    }
    if (!s) {
      if (T.zoneAt(e.x) !== 'hold') return;
      const v = T.valley(e.x);
      s = this.slide = { trough: v.trough, crest: v.crest, downLen: v.trough - v.down0, upLen: v.crest - v.trough, pressed: held, releaseX: null, judged: false };
    }
    if (s.judged) return;
    if (e.x < s.trough) {
      if (held) {
        s.pressed = true;
        s.releaseX = null;
      } else if (s.pressed && s.releaseX === null) s.releaseX = e.x;
      return;
    }
    const sp = Math.max(0.3, e.speed);
    if (s.releaseX !== null && s.releaseX < s.trough - Math.max(R.releaseEarly * s.downLen, R.releaseEarlySec * sp)) {
      this.slideVerdict('early', 'releaseEarly', s.releaseX, s.trough);
    } else if (held && s.pressed && s.releaseX === null) {
      // the hold from the way down goes on up the slope
      const late = s.trough + Math.min(0.85 * s.upLen, Math.max(R.releaseLate * s.upLen, R.releaseLateSec * sp));
      if (e.x >= late) this.slideVerdict('late', 'releaseLate', e.x, s.trough);
    } else if (held) {
      // a new hold on the way up: just under the crest it is the next slide's (this one was done right, if it was
      // held at all); lower down it comes too early — wait for the downhill past the top
      if (e.x < s.crest - R.pressNear * s.upLen) this.slideVerdict('early', 'diveEarly', e.x, s.crest + 0.12);
      else if (s.pressed) this.slideVerdict('perfect', 'slide', s.releaseX ?? s.trough, null);
      else s.judged = true;
    } else if (s.pressed && s.releaseX === null) s.releaseX = e.x;
  }

  /** The slide reached its crest (a launch at `x`, or a roll over it): on time all the way, a perfect slide. */
  private endSlide(x: number): boolean {
    const s = this.slide;
    this.slide = null;
    if (!s || s.judged || !s.pressed) return false;
    if (s.releaseX === null) {
      // still held over the crest
      this.slideVerdict('late', 'releaseLate', x, s.trough);
      return false;
    }
    this.slideVerdict('perfect', 'slide', s.releaseX, null);
    return true;
  }

  /** A verdict: a perfect slide counts (and moves the practice on); a miss breaks the chain and brings the cues back. */
  private slideVerdict(v: Verdict, why: VerdictWhy, x: number, ideal: number | null): void {
    if (this.slide) this.slide.judged = true;
    const pr = this.practice;
    if (v === 'perfect') {
      if (pr) pr.rep++;
      this.emit({ type: 'verdict', v, why, x, ideal, chain: this.chain + 1 });
      this.perfect();
      if (pr && this.practice) {
        if (pr.rep >= RULES.practiceReps) this.endPractice(true);
        else this.practiceTo('go');
      }
      return;
    }
    this.chain = 0;
    this.missStreak++;
    this.emit({ type: 'verdict', v, why, x, ideal, chain: 0 });
  }

  /**
   * A landing that is not smooth tells when the dive came: into an upslope with the hand held from over that
   * upslope — before the crest — too early; otherwise (a glide onto the upslope, a landing across a downslope) too
   * late.  The mark is the touchdown; the right place, the downslope behind it (late onto an upslope) or past the
   * crest (early); across a downslope the place was right, the dive came too late to line up.
   */
  private landingVerdict(down: boolean): void {
    const e = this.eaglet, v = this.terrain.valley(e.x);
    const early = !down && this.held && this.pressZone === 'release';
    if (early) this.slideVerdict('early', 'diveEarly', e.x, v.crest + 0.12);
    else this.slideVerdict('late', 'diveLate', e.x, down ? null : (v.down0 + v.trough) / 2);
  }

  /** The cue for this frame, from the ground under the eaglet and a moment ahead; a change waits 0.06 s so it never flickers. */
  private cueFrame(dt: number): void {
    const want = this.cueOf();
    if (want === this.cueNow || want === null) {
      this.cueNow = want;
      this.cueWait = 0;
      return;
    }
    if (want !== this.cueNext) {
      this.cueNext = want;
      this.cueWait = 0;
    }
    this.cueWait += dt;
    if (this.cueNow === null || this.cueWait >= 0.06) {
      this.cueNow = want;
      this.cueWait = 0;
    }
  }

  /**
   * What the hands should do, read from the world: on the ground, hold from the crest down (read cueLead of travel
   * ahead, so "let go" shows a moment before the bottom; never before the crest: a hold there keeps the eaglet on the
   * ground) and let go up the slope; in the air, let go while rising, hold while falling over a downslope within
   * reach, else glide on; in a warm column, let go.
   */
  private cueOf(): Cue | null {
    const e = this.eaglet, T = this.terrain, R = RULES;
    if (e.caught || e.mode === 'nest') return null;
    if (e.mode === 'climb') return 'release';
    if (e.mode === 'ground') {
      if (T.zoneAt(e.x) !== 'hold') return 'release';
      return T.zoneAt(e.x + Math.max(0, e.s) * R.cueLead) === 'hold' ? 'hold' : 'release';
    }
    if (e.vy > 0) return 'release';
    const ahead = e.x + e.vx * R.cueLead;
    return T.zoneAt(e.x) === 'hold' && T.zoneAt(ahead) === 'hold' && e.y - T.height(ahead) < R.cueReach ? 'hold' : 'release';
  }

  private perfect(): void {
    this.chain++;
    this.missStreak = 0;
    this.p.perfectAll++;
    this.maxChain = Math.max(this.maxChain, this.chain);
    this.perfectHere++;
    this.dayFeats.perfectDay++;
    this.dayFeats.chainDay = Math.max(this.dayFeats.chainDay, this.chain);
    const pts = this.gain(perfectPts(this.chain));
    this.emit({ type: 'perfect', chain: this.chain, pts });
    this.teach('perfect', 'eaglet');
    if (this.chain >= RULES.feverAfter && !this.fever) this.startFever(false);
    else if (!this.fever && this.rng() < 0.3) this.talk.ask('perfect', 1, 3);
  }

  private startFever(band: boolean): void {
    if (this.fever) {
      if (band) this.feverSafe = Math.max(this.feverSafe, RULES.bandFever);
      return;
    }
    this.fever = true;
    this.feverBand = band;
    this.feverT = 0;
    this.feverSafe = band ? RULES.bandFever : 0;
    this.eaglet.boost(RULES.feverBoost);
    this.emit({ type: 'fever', band });
    this.talk.ask(band ? 'bandFever' : 'fever', 3, 4);
    this.teach('fever', 'eaglet');
  }

  private endFever(emit: boolean): void {
    if (!this.fever) return;
    this.fever = false;
    this.feverSafe = 0;
    if (emit) this.emit({ type: 'feverEnd' });
  }

  /** Promyki, the podmuch, the clouds, the thermals' columns. */
  private pickups(): void {
    const R = RULES, e = this.eaglet;
    if (e.mode === 'nest') return;
    for (const g of this.terrain.granie) {
      if (g.x0 > e.x + 0.5 || g.gapX1 < e.x - 0.5) continue;
      for (const c of g.coins) {
        if (c.taken || Math.abs(c.x - e.x) > R.coinR || Math.abs(c.y - e.y) > R.coinR * 1.4) continue;
        c.taken = true;
        this.coinStreak = this.t - this.lastCoinT < 0.6 ? this.coinStreak + 1 : 1;
        this.lastCoinT = this.t;
        this.coinsHere++;
        this.p.coins++;
        this.emit({ type: 'coin', x: c.x, y: c.y, pts: this.gain(R.coin), streak: this.coinStreak });
      }
      for (const o of g.orbs) {
        if (o.taken || Math.hypot(o.x - e.x, o.y - e.y) > R.orbR) continue;
        o.taken = true;
        e.boost(R.orbBoost);
        this.dayFeats.orbDay++;
        this.emit({ type: 'orb', x: o.x, y: o.y, pts: this.gain(R.orb) });
      }
    }
    if (e.y >= R.cloudY && this.cloudCool <= 0 && e.airborne) {
      this.cloudCool = R.cloudGap;
      this.dayFeats.cloudDay++;
      if (this.dayFeats.cloudDay === 1) this.talk.ask('cloud', 2, 3);
      this.emit({ type: 'cloud', x: e.x, y: e.y, pts: this.gain(R.cloud) });
    }
    // a column of warm air: with open wings the eaglet climbs it
    if (!this.held && (e.mode === 'air' || e.mode === 'ground')) {
      for (const th of this.thermals) {
        if (th.used || Math.abs(th.x - e.x) > R.thermalHalf) continue;
        th.used = true;
        e.enterClimb(climbFor(this.T));
        this.climbs++;
        this.dayFeats.thermalDay++;
        this.emit({ type: 'thermal', T: this.T });
        if (this.rng() < 0.5) this.talk.ask('thermal', 1, 3);
        break;
      }
    }
  }

  /** The thermals rise in a rest block, over the valleys ahead. */
  private rest(dt: number): void {
    const R = RULES, e = this.eaglet;
    for (let i = this.thermals.length - 1; i >= 0; i--) {
      const th = this.thermals[i];
      th.age += dt;
      if (th.x < e.x - 1.6) this.thermals.splice(i, 1);
    }
    if (!this.inRest || this.dayPhase !== 'fly') return;
    if (this.blockT < this.nextThermal) return;
    this.nextThermal = this.blockT + R.thermalEvery;
    if (this.thermals.filter(th => !th.used).length >= R.thermalMax) return;
    const x = this.terrain.troughAfter(e.x + R.thermalAhead);
    if (x === null || this.terrain.gapAt(x)) return;
    const th: Thermal = { id: ++this.thermalId, x, base: this.terrain.height(x), used: false, age: 0 };
    this.thermals.push(th);
    this.emit({ type: 'thermalRise', thermal: th });
    // the first warm column of a session says what it is, beside it ("Spokój unosi — prąd wznoszący")
    if (!this.thermalLabel) {
      this.thermalLabel = true;
      this.p.taught |= TEACH.thermal;
      this.explain({ key: 'thermal', label: true, x, until: this.t + 6, still: () => this.dayPhase === 'fly' && !th.used && th.x > this.eaglet.x + 0.2 });
    }
  }

  /** A grań reached: the sun comes back (more for a quick one), points; the leap over the gorge. */
  private granie(): void {
    const e = this.eaglet;
    const next = this.terrain.byIndex(this.granIdx + 1);
    if (!next || e.maxX < next.x0) return;
    const prev = this.terrain.byIndex(this.granIdx);
    const took = this.dayT - this.granT;
    const quick = quickOf(took, prev?.hills ?? RULES.hills0);
    this.granIdx++;
    this.granT = this.dayT;
    const R = RULES;
    // the last sunset gives no daylight back: the session ends on time (a fast flight once kept it a few seconds past)
    const sun = this.dayPhase === 'fly' && this.phase === 'play' ? granSunFor(this.granIdx) + R.quickSun * quick : 0;
    this.dayLeft += sun;
    const pts = this.gain(R.gran + R.quick * quick);
    this.dayFeats.granDay = Math.max(this.dayFeats.granDay, this.granIdx);
    if (quick >= 0.5) this.dayFeats.quickGran++;
    this.emit({ type: 'gran', index: this.granIdx, sun, quick, pts });
    this.talk.ask('gran', 2, 4);
    if (this.leaping === this.granIdx - 1) {
      this.emit({ type: 'leapDone', pts: this.gain(R.leap) });
    }
    this.leaping = -1;
  }

  private nightfall(): void {
    this.dayPhase = 'dusk';
    this.phaseT = 0;
    this.endFever(false);
    this.release();
    this.emit({ type: 'nightfall' });
    this.talk.ask('dayEnd', 3, 4);
  }

  /** The day is over: its tally, banked into the session; the records and the lessons. */
  private endDay(): void {
    const pts = Math.floor(this.dayScore);
    const metres = Math.round(this.dayDistance * RULES.mPerSh);
    const gran = this.granIdx + 1;
    const record = this.bestDayBefore > 0 && pts > Math.max(this.bestDayBefore, this.bestDayHere);
    const best = Math.max(this.bestDayBefore, this.bestDayHere);
    const short = best - pts;
    const toRecord = best > 0 && short > 0 && short <= best * 0.3 ? short : null;
    this.dayFeats.pointsDay = pts;
    this.mergeFeats();
    this.daysDone++;
    this.sessionFeats.daysSession = this.daysDone;
    this.bestDayHere = Math.max(this.bestDayHere, pts);
    this.farthestHere = Math.max(this.farthestHere, metres);
    this.bestGranHere = Math.max(this.bestGranHere, gran);
    this.banked += pts;
    this.dayScore = 0;
    this.tally = { day: this.dayNo, points: pts, metres, gran, perfect: this.dayFeats.perfectDay, coins: 0, feverSec: Math.round(this.dayFeats.feverDay), sunHeld: Math.round(this.daySun), record, toRecord };
    this.tally.coins = this.coinsDay();
    this.dayPhase = 'tally';
    this.phaseT = 0;
    this.eaglet.toNest();
    this.lessons();
    if (this.pendingNest !== null) {
      this.emit({ type: 'nest', level: this.pendingNest });
      this.talk.ask('nest', 4, 5);
      this.pendingNest = null;
    }
    this.emit({ type: 'tally', tally: this.tally });
    if (record) this.talk.ask('record', 4, 5);
  }

  private coinsDay(): number {
    let n = 0;
    for (const g of this.terrain.granie) for (const c of g.coins) if (c.taken) n++;
    return n;
  }

  private afterTally(): void {
    if (this.dayPhase !== 'tally') return;
    if (this.phase === 'play') this.dawn();
    else this.finishDays();
  }

  /** The session's days are over (the last sunset): settle. */
  private finishDays(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.emit({ type: 'done' });
  }

  private mergeFeats(): void {
    const s = this.sessionFeats, d = this.dayFeats;
    for (const k of Object.keys(s) as (keyof Feats)[]) s[k] = Math.max(s[k], d[k]);
  }

  /** The open lessons against today's feats; a full set grows the nest (shown at the day's tally). */
  private lessons(): void {
    if (!this.started) return;
    const f = { ...this.dayFeats };
    const s = this.sessionFeats;
    for (const k of Object.keys(f) as (keyof Feats)[]) f[k] = Math.max(f[k], s[k]);
    f.pointsDay = Math.max(f.pointsDay, Math.floor(this.dayScore));
    f.daysSession = this.daysDone;
    const before = openLessons(this.p).map(o => o.lesson);
    const out = checkLessons(this.p, f);
    for (const i of out.done) {
      const text = lessonText(before[i]);
      this.lessonsDone.push(text);
      this.emit({ type: 'lesson', text });
    }
    if (out.nest !== null) {
      this.pendingNest = out.nest;
      if (this.dayPhase === 'tally') {
        this.emit({ type: 'nest', level: out.nest });
        this.talk.ask('nest', 4, 5);
        this.pendingNest = null;
      }
    }
  }

  /** Points, through the nest's multiplier and the Poryw. */
  private gain(base: number): number {
    const v = base * this.mult;
    this.dayScore += v;
    return v;
  }

  // ── the companion, the coach ───────────────────────────────────
  private talkFrame(dt: number): void {
    const banner = this.phase === 'play' && this.block.kind !== 'warmup' && this.blockT < RULES.banner;
    // (the practice valley's prompts speak alone)
    const blocked = this.telegraphing || banner || this.opening || this.practice !== null;
    if (this.talk.line) this.quietT = 0;
    else this.quietT += dt;
    if (this.quietT > 25 && this.dayPhase === 'fly') {
      this.quietT = 0;
      this.talk.ask('idle', 0, 5);
    }
    this.explainNext();
    this.talk.update(dt, this.t, blocked);
  }

  /**
   * One explanation at a time (round 11): a coach mark or a one-line label is read whole before the next one comes
   * (each stays long enough to read twice), and Leon keeps quiet meanwhile.  What waits keeps a shelf life and is
   * dropped when it no longer fits the moment.
   */
  private explain(x: Explain): void {
    if (this.t < this.explainUntil) {
      if (!this.waitingExplain.some(w => w.key === x.key)) this.waitingExplain.push(x);
      return;
    }
    let text: string;
    if (x.label) {
      text = x.key === 'sun' ? t('label.sun') : `${t('label.thermal')} ${t('label.thermalSub')}`;
      this.emit({ type: 'label', what: x.key as 'sun' | 'thermal', x: x.x });
    } else {
      const key = x.key as Teach;
      // the longer of the finger's and the keyboard's words
      text = key === 'hold' ? t('hint.hold.keys') : t(`hint.${key}` as Key);
      if (x.mark && key !== 'hold' && key !== 'release') this.p.taught |= TEACH[key];
      this.emit({ type: 'hint', key, at: x.at ?? 'center' });
    }
    // the runner holds a coach mark back while its block banner is up: count that wait in
    const late = !x.label && this.phase === 'play' && this.block.kind !== 'warmup' ? Math.max(0, RULES.banner - this.blockT) : 0;
    const sec = readSec(text) + late;
    this.explainUntil = this.t + sec + 0.4;
    this.talk.hush(sec);
  }

  /** The next explanation that waited, if the way is clear and it still fits. */
  private explainNext(): void {
    while (this.waitingExplain.length && this.t >= this.explainUntil) {
      const x = this.waitingExplain.shift()!;
      if (this.t <= x.until && (!x.still || x.still())) this.explain(x);
    }
  }

  /** A coach mark, once ever per thing (the first session teaches the controls; later only the new). */
  private teach(key: Teach, at: Anchor, mark = true): void {
    // the practice valley teaches with its own words
    if (this.p.taught & TEACH[key] || this.practice) return;
    const last = this.hintT[key];
    if (last !== undefined && this.t - last < 6) return;
    this.hintT[key] = this.t;
    this.explain({ key, at, mark, label: false, x: 0, until: this.t + 8 });
  }

  // ── the end ────────────────────────────────────────────────────
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.days += this.daysDone;
    p.lastLen = Math.round(this.plannedSec);
  }

  finish(): void {
    if (!this.started || this.phase === 'done') return;
    if (this.phase === 'play') this.endBlock();
    if (this.dayPhase === 'fly' || this.dayPhase === 'dusk') this.endDay();
    this.finishDays();
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The session's numbers, idempotent: the records go in with Math.max. */
  result(): ArcadeOutcome {
    const p = this.p;
    const score = Math.floor(this.total);
    if (this.started) {
      p.bestTotal = Math.max(p.bestTotal, score);
      p.bestDay = Math.max(p.bestDay, this.bestDayHere, Math.floor(this.dayScore));
      p.farthest = Math.max(p.farthest, this.farthestHere, Math.round(this.dayDistance * RULES.mPerSh));
      p.bestGran = Math.max(p.bestGran, this.bestGranHere, this.granIdx + 1);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.days'), String(Math.max(this.daysDone, this.dayNo > 0 ? 1 : 0))],
      [t('stat.bestDay'), fmtInt(Math.max(this.bestDayHere, Math.floor(this.dayScore)))],
      [t('stat.far'), t('stat.farVal', { m: metres(Math.max(this.farthestHere, Math.round(this.dayDistance * RULES.mPerSh))), n: Math.max(this.bestGranHere, this.granIdx + 1) })],
      [t('stat.perfect'), String(this.perfectHere)],
      [t('stat.fever'), t('sec', { n: Math.round(this.feverSecHere) })],
      [t('stat.coins'), String(this.coinsHere)],
      [t('stat.sun'), t('sec', { n: Math.round(this.sunHeldHere) })],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score, unit: t('unit'), record: this.bestBefore !== null && score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.p.nest > this.nestBefore) fit.push('psa103.5');
    if (this.catches > 0) fit.push('psa91.4');
    if (this.feverSecHere >= 8 || this.climbs > 0) fit.push('isa40.31');
    if (this.daysDone >= 2) fit.push('lam3.22-23');
    fit.push('exo19.4');
    return inTurn(fit, this.p.sessions || 1);
  }

  private highlights(): string[] {
    const out: string[] = [];
    if (this.p.nest > this.nestBefore) out.push(t('hl.nest', { m: this.p.nest }));
    if (this.hatched > 0) out.push(t('hl.hatch', { n: this.hatched }));
    if (this.lessonsDone.length) out.push(t('hl.lessons', { list: this.lessonsDone.slice(0, 3).join(', '), n: this.lessonsDone.length }));
    const bestHere = Math.max(this.bestDayHere, Math.floor(this.dayScore));
    if (this.bestDayBefore > 0 && bestHere > this.bestDayBefore) out.push(t('hl.recordDay', { n: fmtInt(bestHere) }));
    else if (this.bestDayBefore > 0 && bestHere > 0 && this.bestDayBefore - bestHere <= this.bestDayBefore * 0.3) out.push(t('hl.near', { n: fmtInt(this.bestDayBefore - bestHere) }));
    if (this.bandFevers > 0) out.push(t('hl.bandFever', { n: this.bandFevers }));
    out.push(t(`hl.close.${1 + (this.p.sessions % 3)}` as 'hl.close.1'));
    return out.slice(0, 5);
  }
}

/** For the view and tests: the moment names. */
export type { Moment };
