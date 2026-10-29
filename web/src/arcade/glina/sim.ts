/**
 * Glina's rules and state, without the DOM or the canvas (so every rule is unit-tested).
 *
 * A session is a potter's day, vessel by vessel: U bramy (a neighbour at the gate with an order),
 * Toczenie (the push block: pull and shape the clay on the wheel), Drut (the wire cuts it off; the
 * card shows its height, stars and wall; a glaze is chosen), Wypał (the rest block: the kiln, the
 * wheel out of view), Otwarcie (the door opens on the fired vessel, which goes to its neighbour),
 * and after the last vessel Zachód, the street at sunset.  The plan scales to the session.
 *
 * The band only adds craft; every vessel is thrown, fired and delivered by touch and by showing up.
 * In a throw an even, steady level does three things, all fill-only:
 *   F  the chalk line the walls may rise to: F += 0.125·max(0, level − 0.35)·dt
 *   T  trueness, the modulate skill: an even level near or above the threshold (the residual spread
 *      of the twice-smoothed level around its own trend over the last 10 s) fills it; it shows as
 *      a glossier sheen and a truer rim, never as a wobble, and T ≥ 0.5 is "Na środku"
 *   the wall grade, judged once at the cut by three RoundJudges whose thresholds sit at the level
 *      bands 0.5, 0.65 and 0.8: mocna, zgrabna, cienka, skorupka
 * In a firing, calm melts the ash into glaze runs (G), and the kit's rest judge gives "Spokojny
 * ogień", which doubles the kiln-gift odds.  Nothing accrues during a block's lag (5 s Mendi, 2 s
 * HALO) or while the band's numbers climb back after a dropout; an unreliable frame freezes all of
 * it and stops the block clock (8 s at most per block, the plan gives the time back), and a block
 * with too little reliable time gets the neutral outcome — never a loss.  From the third session
 * every 4th throw is "Na wyczucie" (blind: a dusk line instead of the chalk line, revealed at the
 * cut) and every 4th firing a closed kiln.
 *
 * Verses never appear during play: the summary's closing passage comes from result().
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { CLAY, Clay, lineAt, nextStar, starsFor, type ClayForm, type PullResult } from './clay';
import {
  CLOSING, DAY_GIFT_NAME, FORM, HOUSES, HOUSE_NAME, KILN_GIFT_NAME, MARK, TIPS, glazeMark, runBand,
  type Form, type FormId, type GiftId, type GlazeId, type HintKey, type HouseId, type KilnGift,
} from './content';
import { cmText, pctText, t, type Key } from './i18n';
import {
  addToBook, addToStreet, alive, buckets, dailyForm, easiest, nextIntroduction, nextStoryHouse, openForms, orderGlaze,
  receiveDayGift, rollGift, storyForm, tallestOf, welcomeBack, type DailyForm, type GlinaProgress, type VesselRec,
} from './meta';

export const RULES = {
  /** a vessel's share of a session (s): gate + throw + cut + firing + opening */
  vesselSec: 58,
  /** sessions this short play the compact cycle */
  compactSec: 60,
  normal: { gate: 3.5, firstGate: 5, cut: 3.5, open: 3, finale: 4, throw: 26, firstThrow: 24, fire: 22, jThrow: 3, jFire: 2 },
  compact: { gate: 3, firstGate: 3, cut: 2.5, open: 2.5, finale: 3, throw: 16, firstThrow: 16, fire: 13, jThrow: 0, jFire: 0 },
  /** no block is shorter, also when the plan gives paused time back (s) */
  minBlock: 12,
  /** the block clock stops at most this long per block while the signal is unreliable (s) */
  maxPause: 8,
  /** the sponge trues the rim in a throw's last seconds (input locked) */
  sponge: 3,
  /** the lag from a block's start before the brain counts (s) */
  lagFnirs: 5,
  lagEeg: 2,
  /** the chalk line: F += fRate·max(0, level − fFloor)·dt, drawn eased with τ lineTau */
  fRate: 0.125,
  fFloor: 0.35,
  lineTau: 0.6,
  /**
   * Trueness: the level smoothed again (τ), a detrended window of `window` s, T += tRate·even·work·dt
   * with even = 1 − sd / sdRef and work = smoothstep(workLo, workHi, mean).  Tuned with the harness
   * in arcade-glina.test.ts: without control a throw ends near T 0.4 (Na środku about one vessel in
   * three), with control nearly always; HALO's shorter second smoothing leaves more spread, so its
   * reference is wider.
   */
  tau2Fnirs: 2.5,
  tau2Eeg: 1.5,
  window: 10,
  windowMin: 4,
  sdRefFnirs: 0.03,
  sdRefEeg: 0.04,
  workLo: 0.4,
  workHi: 0.6,
  tRate: 0.07,
  centre: 0.5,
  trueSteps: [0.25, 0.5, 0.75],
  /** the wall grade's level bands (judge thresholds at these levels): without control mocna ≈ 1/3, zgrabna ≈ 1/3, cienka ≈ 1/5, skorupka ≈ 1/10 */
  bands: [0.5, 0.57, 0.63],
  /** the glaze runs in a firing: G += gRate·calm·dt */
  gRate: 0.07,
  /** a dropout this long clears trueness's window and starts `recover` s in which nothing accrues */
  gap: 2,
  recover: 4,
  /** a block needs this many reliable scored seconds for a verdict; below it the neutral floor */
  scoredMin: 8,
  neutral: 0.4,
  /** a key held this long pulls continuously (a shorter press is one small pull) */
  pressHold: 0.3,
  /** blind throws and closed kilns from this session on */
  blindFrom: 3,
  /** how long the hints and the coaching line stay (s) */
  hintShape: 3,
  hintLine: 4.5,
  hintEven: 3.5,
  tipSec: 6,
  /** at most this often a drag's pulls and shapes are told to the sound (s) */
  touchTell: 0.14,
} as const;

// ── the plan ─────────────────────────────────────────────────────
export type StepKind = 'gate' | 'throw' | 'cut' | 'fire' | 'open';
export interface Step { kind: StepKind; dur: number; vessel: number }
export interface Plan { steps: Step[]; finale: number; vessels: number; compact: boolean }

/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's steps: n = max(1, round((plannedSec − finisher) / 58)) vessels, each a gate, a throw,
 * the cut, a firing and the opening, then the finisher.  Throws are 26 s (the first 24 s), firings
 * 22 s, with a little jitter when the room allows it, all scaled so the plan ends at `plannedSec`;
 * sessions ≤ 60 s play the compact cycle (16 s and 13 s).  No block under 12 s.
 */
export function planSession(plannedSec: number, firstEver: boolean, rnd: () => number): Plan {
  const compact = plannedSec <= RULES.compactSec;
  const T = compact ? RULES.compact : RULES.normal;
  const n = Math.max(1, Math.round((plannedSec - T.finale) / RULES.vesselSec));
  const gates = n * T.gate + (firstEver ? T.firstGate - T.gate : 0);
  const left = Math.max(0, plannedSec - gates - n * (T.cut + T.open) - T.finale);
  const nominal: number[] = [];
  for (let i = 0; i < n; i++) nominal.push(i === 0 ? T.firstThrow : T.throw, T.fire);
  const sum = nominal.reduce((s, d) => s + d, 0);
  const jitter = left / sum >= 0.75 ? 1 : 0;
  const durs = nominal.map((d, i) => d + jitter * (rnd() * 2 - 1) * (i % 2 ? T.jFire : T.jThrow));
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, RULES.minBlock);
  const steps: Step[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({ kind: 'gate', dur: i === 0 && firstEver ? T.firstGate : T.gate, vessel: i });
    steps.push({ kind: 'throw', dur: durs[2 * i], vessel: i });
    steps.push({ kind: 'cut', dur: T.cut, vessel: i });
    steps.push({ kind: 'fire', dur: durs[2 * i + 1], vessel: i });
    steps.push({ kind: 'open', dur: T.open, vessel: i });
  }
  return { steps, finale: T.finale, vessels: n, compact };
}

// ── orders ───────────────────────────────────────────────────────
export type OrderKind = 'intro' | 'story' | 'daily' | 'everyday' | 'golden';

export interface Order {
  /** the vessel's slot in the session (0-based) */
  index: number;
  kind: OrderKind;
  form: Form;
  /** what the clay matches: the form's height and outline (the form of the day has its own variant) */
  clay: ClayForm;
  /** the household (null: the traveller with the form of the day) and its name */
  house: HouseId | null;
  who: string;
  /** the story step this order is (1..4; 0 for everyday orders and the form of the day) */
  step: number;
  glaze: GlazeId;
  line: string;
  thanks: string;
  /** the welcome back: this lump is porcelain */
  porcelain: boolean;
  /** the very first vessel ever: never blind, no overpull, gentler stars, a guaranteed flame blush */
  first: boolean;
}

/** What the cut shows, right after the throw's judged window. */
export interface CutCard {
  h: number;
  stars: 1 | 2 | 3;
  sim: number;
  /** the next star's threshold when the shape fell within 5 points of it */
  next: number | null;
  /** 0 mocna … 3 skorupka; verdict null: too little reliable signal (the neutral zgrabna) */
  wall: number;
  verdict: boolean | null;
  centre: boolean;
  blind: boolean;
  /** cm the last pull added (the floors, the blind reveal) */
  raised: number;
  formBest: boolean;
  buckets: GlazeId[];
}

/** What the opening shows: the fired vessel, its stamps, and its neighbour's thanks. */
export interface OpenCard {
  rec: VesselRec;
  band: number;
  calm: boolean;
  gift: KilnGift | null;
  isNew: boolean;
  first: boolean;
  closed: boolean;
  who: string;
  thanks: string;
}

export interface FinaleCard { vessels: number; cm: number; gift: GiftId | null; enough: boolean; alive: HouseId[] }

export type SimEvent =
  | { type: 'gate'; order: Order }
  | { type: 'throw'; blind: boolean }
  | { type: 'pull'; dh: number; tap: boolean }
  | { type: 'shape'; dr: number }
  | { type: 'contact' }
  | { type: 'strain' }
  | { type: 'slump' }
  | { type: 'gather' }
  | { type: 'centre' }
  | { type: 'true'; step: number }
  | { type: 'sponge' }
  | { type: 'cut'; card: CutCard }
  | { type: 'glaze'; index: number }
  | { type: 'fire'; closed: boolean }
  | { type: 'runs'; band: number }
  | { type: 'open'; card: OpenCard }
  | { type: 'alive'; house: HouseId }
  | { type: 'hint'; key: HintKey }
  | { type: 'finale'; card: FinaleCard }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

export type Phase = StepKind | 'finale' | 'done';

export interface SimInit {
  progress: GlinaProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning (the kit's defaults, the game's entry, a beginner's bias): the judges follow it */
  tuning: FocusTuning;
}

/** The detrended window of trueness: (t, x, weight) samples of the twice-smoothed level, the last 10 s. */
class Window {
  private readonly t = new Float64Array(1024);
  private readonly x = new Float64Array(1024);
  private readonly w = new Float64Array(1024);
  private head = 0;
  private n = 0;
  sec = 0;

  clear(): void { this.head = 0; this.n = 0; this.sec = 0; }

  push(t: number, x: number, w: number, span: number): void {
    const cap = this.t.length;
    const i = (this.head + this.n) % cap;
    if (this.n === cap) { this.sec -= this.w[this.head]; this.head = (this.head + 1) % cap; this.n--; }
    this.t[i] = t; this.x[i] = x; this.w[i] = w;
    this.n++;
    this.sec += w;
    while (this.n > 0 && this.t[this.head] < t - span) {
      this.sec -= this.w[this.head];
      this.head = (this.head + 1) % cap;
      this.n--;
    }
  }

  /**
   * The weighted mean and the residual spread around a weighted quadratic fit: the slow bend of a
   * block's haemodynamic onset (rest to focus, a rise that levels off) is the trend, not unsteadiness,
   * while a swing within the window (a Mayer wave, a wandering mind) stays in the residual.
   */
  fit(out: { m: number; sd: number }): void {
    const cap = this.t.length;
    let sw = 0, st = 0, sx = 0;
    for (let j = 0; j < this.n; j++) {
      const i = (this.head + j) % cap;
      sw += this.w[i]; st += this.w[i] * this.t[i]; sx += this.w[i] * this.x[i];
    }
    if (sw <= 0) { out.m = 0; out.sd = 0; return; }
    const tm = st / sw, xm = sx / sw;
    // normal equations of x − x̄ ≈ b·τ + c·(τ² − m2) with τ = t − t̄ (the centred quadratic keeps them well-conditioned)
    let m2 = 0;
    for (let j = 0; j < this.n; j++) {
      const i = (this.head + j) % cap, d = this.t[i] - tm;
      m2 += this.w[i] * d * d;
    }
    m2 /= sw;
    let s11 = 0, s12 = 0, s22 = 0, r1 = 0, r2 = 0;
    for (let j = 0; j < this.n; j++) {
      const i = (this.head + j) % cap, w = this.w[i];
      const a = this.t[i] - tm, q = a * a - m2, y = this.x[i] - xm;
      s11 += w * a * a; s12 += w * a * q; s22 += w * q * q; r1 += w * a * y; r2 += w * q * y;
    }
    const det = s11 * s22 - s12 * s12;
    const b = det > 1e-12 ? (r1 * s22 - r2 * s12) / det : s11 > 1e-12 ? r1 / s11 : 0;
    const c = det > 1e-12 ? (s11 * r2 - s12 * r1) / det : 0;
    let ss = 0;
    for (let j = 0; j < this.n; j++) {
      const i = (this.head + j) % cap;
      const a = this.t[i] - tm;
      const e = this.x[i] - xm - b * a - c * (a * a - m2);
      ss += this.w[i] * e * e;
    }
    out.m = xm;
    out.sd = Math.sqrt(ss / sw);
  }
}

const smoothstep = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

const frameCopy = (): FocusFrame => ({ reliable: false, activity: null, threshold: 0, level: 0, focused: false, hold: 0, calm: 0 });

export class GlinaSim {
  readonly p: GlinaProgress;
  readonly plannedSec: number;
  readonly day: string;
  private readonly rng: () => number;
  private readonly lag: number;
  private readonly tau2: number;
  private readonly sdRef: number;
  private readonly events: SimEvent[] = [];

  started = false;
  /** this session's number in the game (1 = the first ever) */
  session = 0;
  plan: Plan = { steps: [], finale: 0, vessels: 0, compact: false };
  /** the step running now (an index into plan.steps); the finisher comes after the last */
  si = 0;
  phase: Phase = 'gate';
  /** seconds in this phase (play time) */
  phaseT = 0;
  /** seconds into the block (throws and firings: the block clock stops while the signal is unreliable) */
  blockT = 0;
  private paused = 0;
  /** play time, the sum of the frames (the window's clock) */
  clock = 0;

  // the vessel on the wheel
  order: Order | null = null;
  clay: Clay | null = null;
  blind = false;
  closed = false;
  sponge = false;
  /** the cut's buckets and the one picked */
  buckets: GlazeId[] = [];
  pick = 0;
  glaze: GlazeId = 'biel';
  cutCard: CutCard | null = null;
  openCard: OpenCard | null = null;
  finaleCard: FinaleCard | null = null;
  /** the current vessel's record once fired */
  rec: VesselRec | null = null;

  // the brain
  reliable = false;
  level = 0;
  F = 0;
  T = 0;
  G = 0;
  /** the line drawn (eased; cm) */
  lineShown = 0;
  private L2 = 0.3;
  private readonly win = new Window();
  private readonly fitOut = { m: 0, sd: 0 };
  /** the window's last mean and spread (the tuning harness and tests read them) */
  m = 0;
  sd = 0;
  private scored = 0;
  private gapT = 0;
  private gapCleared = false;
  private recover = 0;
  private readonly judges: RoundJudge[];
  private readonly shifts: number[];
  private readonly bandFrames: FocusFrame[] = [frameCopy(), frameCopy(), frameCopy()];
  private readonly restJudge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private trueStep = 0;
  private centreShown = false;
  private runsShown = 0;
  private lineClimbed = false;

  // touch and keys
  private press = { down: false, t: 0 };
  private shapeDir = 0;
  private handDir = 0;
  private tellPull = 0;
  private tellShape = 0;
  private tellT = 0;

  // hints and coaching
  hint: HintKey | null = null;
  hintT = 0;
  private hintDur = 0;
  private readonly hintQueue: { key: HintKey; dur: number }[] = [];
  private readonly hintsSeen = new Set<HintKey>();
  tip = '';
  tipT = 0;

  // the session's tallies
  /** heights of the vessels cut so far (cm) */
  readonly heights: number[] = [];
  /** the vessels fired this session, in order (the finisher draws them on the street) */
  readonly made: VesselRec[] = [];
  private threes = 0;
  private thin = 0;
  private centres = 0;
  private calms = 0;
  private firingsJudged = 0;
  private throwsJudged = 0;
  private dailySim = -1;
  private readonly newForms: FormId[] = [];
  private readonly aliveNow: HouseId[] = [];
  private readonly stepsNow: { house: HouseId; n: number }[] = [];
  private readonly giftsNow: { gift: KilnGift; form: FormId }[] = [];
  private dayGiftNow: GiftId | null = null;
  private secondNow = false;
  private porcelainNow = false;
  private mantleNow = false;
  private tallestNow = 0;
  /** session-start snapshots: the records to beat, the counters, the day */
  private readonly bestBefore: number | null;
  private readonly before: { tallest: number; three: number; seconds: number };
  private throwsBase = 0;
  private firingsBase = 0;
  private throwsBegun = 0;
  private firingsBegun = 0;
  private closedDue = false;
  private dailyOpen = false;
  private dailyPlaced = false;
  private daily: DailyForm | null = null;
  private porcelainDue = false;
  private todayN = 1;
  private prevForm: FormId | null = null;

  constructor(private readonly init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.day = init.day;
    this.plannedSec = init.plannedSec;
    this.lag = init.eeg ? RULES.lagEeg : RULES.lagFnirs;
    this.tau2 = init.eeg ? RULES.tau2Eeg : RULES.tau2Fnirs;
    this.sdRef = init.eeg ? RULES.sdRefEeg : RULES.sdRefFnirs;
    this.judges = RULES.bands.map(() => RoundJudge.from(init.tuning));
    this.shifts = RULES.bands.map(b => init.tuning.width * Math.log(b / (1 - b)));
    this.restJudge = RoundJudge.from(init.tuning);
    this.bestBefore = this.p.sessions > 0 ? this.p.bestSession : null;
    this.before = { tallest: this.p.tallest, three: this.p.bestThree, seconds: this.p.seconds };
  }

  get step(): Step | null { return this.plan.steps[this.si] ?? null; }
  get vesselIndex(): number { return this.step?.vessel ?? Math.max(0, this.plan.vessels - 1); }
  /** the length of the running phase (s) */
  get phaseDur(): number { return this.phase === 'finale' ? this.plan.finale : this.step?.dur ?? 0; }
  /** the running block's progress 0..1 (throws and firings on the block clock, the rest on play time) */
  get progress(): number {
    const d = this.phaseDur;
    if (d <= 0) return 1;
    return clamp((this.phase === 'throw' || this.phase === 'fire' ? this.blockT : this.phaseT) / d);
  }
  /** the first-ever session */
  get firstSession(): boolean { return this.session === 1; }
  /** the cap the wall may rise to in a blind throw: the dusk line at the neutral height */
  get duskLine(): number { return this.order ? lineAt(this.order.clay, RULES.neutral) : 0; }
  /** the trueness the screen shows (neutral in a blind throw) and the runs (hidden in a closed kiln until it opens) */
  get shownT(): number { return this.blind && this.phase === 'throw' ? 0.5 : this.T; }
  get shownG(): number { return this.closed && this.phase === 'fire' ? 0 : this.G; }
  /** the light of the day: 0 morning … 1 the golden hour of the last vessel */
  get light(): number { return this.plan.vessels > 1 ? this.vesselIndex / (this.plan.vessels - 1) : 0.4; }
  get golden(): boolean { return this.order?.kind === 'golden'; }
  /** a verse may show now (never during play: the summary closes with result().verse) */
  get verseNow(): PassageId | null { return null; }

  /** the headline: the vessels cut so far plus the one on the wheel once its walls were first pulled */
  get score(): number {
    let s = 0;
    for (const h of this.heights) s += h;
    if (this.phase === 'throw' && this.clay?.opened) s += this.clay.H;
    return Math.round(s);
  }

  /** the day's cm with one decimal (the finisher's line) */
  get cm(): number {
    let s = 0;
    for (const h of this.heights) s += h;
    if (this.phase === 'throw' && this.clay?.opened) s += this.clay.H;
    return s;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const p = this.p, day = this.day;
    this.session = p.sessions + 1;
    this.throwsBase = p.throwsBegun;
    this.firingsBase = p.firingsBegun;
    this.dailyOpen = p.dailyDay !== day;
    this.daily = dailyForm(this.init.daySeed);
    this.porcelainDue = welcomeBack(p, day);
    this.todayN = (p.lastDay === day ? p.todayN : 0) + 1;
    this.plan = planSession(this.plannedSec, p.vessels === 0, this.rng);
    this.si = 0;
    this.startGate(0);
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.clock += dt;
    this.phaseT += dt;
    this.reliable = f.reliable;
    if (f.reliable) this.level = f.level;
    this.signal(dt, f);
    this.ageHints(dt);
    switch (this.phase) {
      case 'gate':
        if (this.phaseT >= this.phaseDur) this.next();
        break;
      case 'throw':
        this.throwFrame(dt, f);
        break;
      case 'cut':
        if (this.phaseT >= this.phaseDur) this.next();
        break;
      case 'fire':
        this.fireFrame(dt, f);
        break;
      case 'open':
        if (this.phaseT >= this.phaseDur) this.next();
        break;
      case 'finale':
        if (this.phaseT >= this.plan.finale) {
          this.phase = 'done';
          this.phaseT = 0;
          this.emit({ type: 'done' });
        }
        break;
      default:
        break;
    }
    if (this.phase !== 'finale' && this.phase !== 'done') {
      this.fitPlan(t);
      // time is up mid-block (a plan that could not fit, a slow device): settle, then the finisher
      if (t >= this.plannedSec) {
        this.settle();
        this.startFinale();
      }
    }
    this.tellTouch(dt);
  }

  /** Dropouts: a long one clears trueness's window, and when the signal returns nothing accrues for a while. */
  private signal(dt: number, f: FocusFrame): void {
    if (!f.reliable) {
      this.gapT += dt;
      if (this.gapT >= RULES.gap && !this.gapCleared) {
        this.win.clear();
        this.gapCleared = true;
      }
      return;
    }
    if (this.gapT > 0) {
      if (this.gapT >= RULES.gap) this.recover = RULES.recover;
      this.gapT = 0;
      this.gapCleared = false;
    } else if (this.recover > 0) {
      this.recover = Math.max(0, this.recover - dt);
      if (this.recover === 0) this.L2 = f.level;   // a fresh start for the second smoothing
    }
  }

  /** The block clock: it stops while the signal is unreliable, at most 8 s per block. */
  private blockClock(dt: number, f: FocusFrame): void {
    if (!f.reliable && this.paused < RULES.maxPause) this.paused += dt;
    else this.blockT += dt;
  }

  // ── the throw ───────────────────────────────────────────────────
  private throwFrame(dt: number, f: FocusFrame): void {
    const clay = this.clay!, o = this.order!;
    this.blockClock(dt, f);
    const dur = this.phaseDur;
    if (!this.sponge && this.blockT >= dur - RULES.sponge) {
      this.sponge = true;
      clay.calm();
      clay.overpull = false;
      this.press.down = false;
      this.emit({ type: 'sponge' });
    }
    this.throwBrain(dt, f);
    const target = lineAt(o.clay, this.F);
    this.lineShown = approach(this.lineShown, target, dt, RULES.lineTau);
    clay.line = this.blind ? this.duskLine : this.lineShown;
    // held keys: a press is one small pull; held on, the wall rises 0.25·N per s
    if (this.press.down && !this.sponge) {
      this.press.t += dt;
      clay.keyHold = this.press.t >= RULES.pressHold;
    } else clay.keyHold = false;
    if (!this.sponge && clay.free) {
      if (this.shapeDir) {
        clay.shape(this.shapeDir * CLAY.keyShape * dt);
        this.tellShape += CLAY.keyShape * dt;
      }
      if (this.handDir) clay.hand = clamp(clay.hand + this.handDir * CLAY.handSpeed * dt, 0.05, 1);
    }
    const strained = clay.strain > 0;
    const was = clay.H;
    const happened = clay.update(dt, true);
    if (clay.keyHold && clay.H > was) this.tellPull += clay.H - was;
    if (!strained && clay.strain > 0) this.emit({ type: 'strain' });
    if (happened === 'slump') {
      this.secondNow = true;
      this.emit({ type: 'slump' });
    } else if (happened === 'gather') this.emit({ type: 'gather' });
    if (this.blockT >= dur) this.next();
  }

  private throwBrain(dt: number, f: FocusFrame): void {
    // the wall grade's judges see every tick (they skip unreliable ones themselves), each at its level band
    for (let i = 0; i < this.judges.length; i++) {
      const fr = this.bandFrames[i];
      fr.reliable = f.reliable;
      fr.activity = f.activity;
      fr.threshold = f.threshold + this.shifts[i];
      fr.level = f.level;
      fr.calm = f.calm;
      this.judges[i].push('focus', fr, dt);
    }
    this.contrast.push('focus', f.activity, f.reliable, this.blockT, dt);
    if (!f.reliable || this.recover > 0) return;
    this.L2 = approach(this.L2, f.level, dt, this.tau2);
    this.win.push(this.clock, this.L2, dt, RULES.window);
    if (this.blockT < this.lag) return;
    this.scored += dt;
    const F0 = this.F;
    this.F = Math.min(1, this.F + RULES.fRate * Math.max(0, f.level - RULES.fFloor) * dt);
    if (this.F > F0 && !this.lineClimbed && this.F > 0.01) {
      this.lineClimbed = true;
      if (this.firstSession && !this.blind) this.showHint('line', RULES.hintLine);
    }
    if (this.win.sec >= RULES.windowMin) {
      this.win.fit(this.fitOut);
      this.m = this.fitOut.m;
      this.sd = this.fitOut.sd;
      const even = clamp(1 - this.sd / this.sdRef), work = smoothstep(RULES.workLo, RULES.workHi, this.m);
      this.T = Math.min(1, this.T + RULES.tRate * even * work * dt);
    }
    if (this.blind) return;
    while (this.trueStep < RULES.trueSteps.length && this.T >= RULES.trueSteps[this.trueStep]) {
      this.trueStep++;
      this.emit({ type: 'true', step: this.trueStep });
      if (this.trueStep === 1 && this.firstSession) this.showHint('even', RULES.hintEven);
    }
    if (!this.centreShown && this.T >= RULES.centre) {
      this.centreShown = true;
      this.emit({ type: 'centre' });
    }
  }

  // ── the firing ──────────────────────────────────────────────────
  private fireFrame(dt: number, f: FocusFrame): void {
    this.blockClock(dt, f);
    this.restJudge.push('rest', f, dt);
    this.contrast.push('rest', f.activity, f.reliable, this.blockT, dt);
    if (f.reliable && this.recover <= 0 && this.blockT >= this.lag) {
      this.scored += dt;
      this.G = Math.min(1, this.G + RULES.gRate * f.calm * dt);
      const band = runBand(this.G);
      if (band > this.runsShown) {
        this.runsShown = band;
        if (!this.closed) this.emit({ type: 'runs', band });
      }
    }
    if (this.blockT >= this.phaseDur) this.next();
  }

  // ── the steps ───────────────────────────────────────────────────
  private next(): void {
    this.si++;
    const s = this.step;
    if (!s) {
      this.startFinale();
      return;
    }
    switch (s.kind) {
      case 'gate': this.startGate(s.vessel); break;
      case 'throw': this.startThrow(); break;
      case 'cut': this.cut(); break;
      case 'fire': this.startFire(); break;
      case 'open': this.open(false); break;
    }
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.phaseT = 0;
    this.blockT = 0;
    this.paused = 0;
    this.scored = 0;
  }

  private startGate(i: number): void {
    this.enter('gate');
    const o = this.orderFor(i);
    this.order = o;
    this.clay = new Clay(o.clay);
    this.clay.overpull = !o.first;
    this.blind = false;
    this.closed = false;
    this.cutCard = null;
    this.openCard = null;
    this.rec = null;
    this.F = 0;
    this.T = 0;
    this.G = 0;
    this.lineShown = this.clay.lim.Hmin;
    this.clay.line = this.lineShown;
    if (o.porcelain) this.porcelainNow = true;
    this.emit({ type: 'gate', order: o });
  }

  private startThrow(): void {
    this.enter('throw');
    const o = this.order!, clay = this.clay!;
    this.throwsBegun++;
    const n = this.plan.vessels;
    this.blind = this.session >= RULES.blindFrom && (this.throwsBase + this.throwsBegun) % 4 === 0
      && o.index > 0 && o.index < n - 1 && o.kind !== 'daily' && !o.first;
    this.F = 0;
    this.T = 0;
    this.sponge = false;
    this.trueStep = 0;
    this.centreShown = false;
    this.lineClimbed = false;
    this.L2 = this.reliable ? this.level : 0.3;
    this.win.clear();
    for (const j of this.judges) j.reset();
    clay.overpull = !o.first;
    clay.line = this.blind ? this.duskLine : this.lineShown;
    this.setTip(this.blind ? TIPS.blind : TIPS.throw[(this.session - 1 + o.index) % TIPS.throw.length], this.blind);
    if (o.first) this.showHint('pull', Infinity);
    this.emit({ type: 'throw', blind: this.blind });
  }

  /**
   * The wire: the judges' verdicts and the floors, the blind reveal and the last pull, the shape's
   * stars; the vessel's height is kept for the headline.  The glaze buckets come up.
   */
  private cut(): void {
    const clay = this.clay!, o = this.order!;
    clay.calm();
    clay.release();
    this.press.down = false;
    this.shapeDir = 0;
    this.handDir = 0;
    const scoredOk = this.scored >= RULES.scoredMin - 0.25;
    let wall = 1, verdict: boolean | null = null;
    if (scoredOk) {
      const v = this.judges.map(j => j.verdict());
      verdict = v[0];
      if (verdict !== null) {
        wall = !v[0] ? 0 : !v[1] ? 1 : !v[2] ? 2 : 3;
        this.throwsJudged++;
      }
    }
    if (!scoredOk || verdict === null) {
      // too little reliable signal: the neutral outcome (never a loss, never a brain stamp)
      this.F = Math.max(this.F, RULES.neutral);
      this.T = Math.max(this.T, RULES.neutral);
      wall = 1;
      verdict = null;
    }
    if (this.blind) this.F = Math.max(this.F, RULES.neutral);
    const lineCut = clay.line;
    const lineFinal = lineAt(o.clay, this.F);
    const raised = clay.lastPull(lineCut, lineFinal);
    this.lineShown = Math.max(this.lineShown, lineFinal);
    const sim = clay.similarity();
    const stars = starsFor(sim, o.first);
    const h = Math.round(clay.H * 10) / 10;
    const centre = this.T >= RULES.centre;
    this.heights.push(h);
    this.tallestNow = Math.max(this.tallestNow, h);
    if (stars === 3) this.threes++;
    if (wall >= 2) this.thin++;
    if (centre) this.centres++;
    for (const j of this.judges) j.reset();
    this.enter('cut');
    this.buckets = buckets(this.p, o.glaze, this.p.vessels + o.index);
    this.pick = 0;
    this.cutCard = {
      h, stars, sim, next: nextStar(sim, o.first), wall, verdict, centre, blind: this.blind, raised,
      formBest: tallestOf(this.p, o.form.id) > 0 && h > tallestOf(this.p, o.form.id), buckets: this.buckets,
    };
    if (o.first) this.showHint('glaze', Infinity);
    this.emit({ type: 'cut', card: this.cutCard });
  }

  private startFire(): void {
    this.enter('fire');
    const o = this.order!;
    this.glaze = this.buckets[this.pick] ?? o.glaze;
    this.firingsBegun++;
    const n = this.plan.vessels, last = o.index === n - 1;
    if (this.session >= RULES.blindFrom && (this.firingsBase + this.firingsBegun) % 4 === 2) this.closedDue = true;
    // never right after a blind throw (it moves to the next firing), never the session's last firing
    this.closed = this.closedDue && !this.blind && !last;
    if (this.closed) this.closedDue = false;
    this.G = 0;
    this.runsShown = 0;
    this.restJudge.reset();
    this.setTip(this.closed ? TIPS.closed : TIPS.fire[(this.session - 1 + o.index) % TIPS.fire.length], this.closed);
    if (o.first) this.showHint('kiln', Infinity);
    else this.clearHint();
    this.emit({ type: 'fire', closed: this.closed });
  }

  /**
   * The kiln opens: the floors and the rest verdict, the kiln gift (pity, the first vessel's blush),
   * the vessel's page in the book, and the delivery to its neighbour (a story step, the street).
   * `early`: the session ends now (finish(), time up) — G at least 0.4 and no verdict.
   */
  private open(early: boolean): void {
    const o = this.order!, clay = this.clay!, card = this.cutCard!, p = this.p;
    let calm = false;
    if (early || this.scored < RULES.scoredMin - 0.25) this.G = Math.max(this.G, RULES.neutral);
    else {
      const v = this.restJudge.verdict();
      if (v !== null) {
        this.firingsJudged++;
        calm = v;
        if (v) this.calms++;
      } else this.G = Math.max(this.G, RULES.neutral);
    }
    const gift = rollGift(p, calm, this.rng, o.first);
    const band = runBand(this.G);
    const rec: VesselRec = {
      f: o.form.id, h: card.h, q: clay.ratios(), stars: card.stars, sim: Math.round(card.sim * 100), wall: card.wall,
      centre: card.centre, glaze: this.glaze, runs: Math.round(this.G * 100), gift, second: clay.second, porcelain: o.porcelain,
    };
    let marks = glazeMark(this.glaze);
    if (rec.centre) marks |= MARK.centre;
    if (calm) marks |= MARK.calm;
    if (rec.wall === 3) marks |= MARK.eggshell;
    if (band === 3) marks |= MARK.mantle;
    if (rec.second) marks |= MARK.second;
    if (gift) marks |= MARK[gift];
    if (rec.porcelain) marks |= MARK.porcelain;
    const isNew = addToBook(p, rec, marks);
    p.vessels++;
    p.cmTotal = Math.round((p.cmTotal + rec.h) * 10) / 10;
    p.newest = rec.f;
    if (rec.second) p.seconds++;
    if (isNew) this.newForms.push(rec.f);
    if (gift) this.giftsNow.push({ gift, form: rec.f });
    if (band === 3) this.mantleNow = true;
    this.rec = rec;
    this.made.push(rec);
    this.prevForm = rec.f;
    // the delivery
    if (o.house && (o.kind === 'intro' || o.kind === 'story')) {
      const h = o.house;
      if (!p.introduced.includes(h)) p.introduced.push(h);
      p.steps[h] = Math.max(p.steps[h], o.step);
      p.storyDay = this.day;
      if (o.step >= 4) {
        this.aliveNow.push(h);
        this.emit({ type: 'alive', house: h });
      } else this.stepsNow.push({ house: h, n: o.step });
    } else if (o.house) addToStreet(p, o.house, { f: rec.f, glaze: rec.glaze });
    if (o.kind === 'daily') this.dailySim = Math.max(this.dailySim, rec.sim);
    this.enter('open');
    this.openCard = { rec, band, calm, gift, isNew, first: o.first, closed: this.closed, who: o.who, thanks: o.thanks };
    this.clearHint();
    this.emit({ type: 'open', card: this.openCard });
  }

  private startFinale(): void {
    this.phase = 'finale';
    this.phaseT = 0;
    this.si = this.plan.steps.length;
    this.clearHint();
    this.tip = '';
    const g = receiveDayGift(this.p, this.day);
    if (g) this.dayGiftNow = g;
    this.finaleCard = {
      vessels: this.made.length, cm: this.cm, gift: g, enough: this.todayN >= 3,
      alive: HOUSES.filter(h => alive(this.p, h)),
    };
    this.emit({ type: 'finale', card: this.finaleCard });
  }

  /** Settle the vessel on the wheel now: cut it, fire it with G ≥ 0.4 and no verdict, open and deliver it. */
  private settle(): void {
    if (this.phase === 'throw') {
      this.cut();
      this.startFire();
      this.open(true);
    } else if (this.phase === 'cut') {
      this.startFire();
      this.open(true);
    } else if (this.phase === 'fire') this.open(true);
    // the gate: the lump was never thrown; the opening: delivered already
  }

  /**
   * The session ends before its own sunset ("Zakończ i zapisz", the runner's overtime limit):
   * settle the vessel on the wheel as the day would, give the day's gift if due.  Nothing more once
   * the sunset has begun.  The view is gone by then: no animation follows.
   */
  finish(): void {
    if (!this.started || this.phase === 'finale' || this.phase === 'done') return;
    this.settle();
    this.startFinale();
    this.phase = 'done';
  }

  /**
   * The plan ends with the session.  When the signal (or a slow device) held a block clock back,
   * later throws give the time back first, then the running throw, then the firings before the
   * last, down to 12 s each, so the last firing stays whole.
   */
  private fitPlan(t: number): void {
    const steps = this.plan.steps, i0 = this.si, cur = steps[i0];
    if (!cur) return;
    const inBlock = cur.kind === 'throw' || cur.kind === 'fire';
    let need = Math.max(0, cur.dur - (inBlock ? this.blockT : this.phaseT));
    for (let i = i0 + 1; i < steps.length; i++) need += steps[i].dur;
    let over = need + this.plan.finale - (this.plannedSec - t);
    if (over < 0.05) return;
    over = this.giveBack(over, i0 + 1, 'throw');
    if (over > 0 && cur.kind === 'throw') {
      const k = Math.min(over, Math.max(0, cur.dur - Math.max(RULES.minBlock, this.blockT)));
      cur.dur -= k;
      over -= k;
    }
    if (over > 0) {
      const lastFire = steps.length - 2;
      if (cur.kind === 'fire' && i0 !== lastFire) {
        const k = Math.min(over, Math.max(0, cur.dur - Math.max(RULES.minBlock, this.blockT)));
        cur.dur -= k;
        over -= k;
      }
      if (over > 0) this.giveBack(over, i0 + 1, 'fire', lastFire);
    }
  }

  /** Take up to `over` s from the steps of `kind` from `from` on (never the step `skip`), each in proportion to its time above 12 s. */
  private giveBack(over: number, from: number, kind: StepKind, skip = -1): number {
    const steps = this.plan.steps;
    let spare = 0;
    for (let i = from; i < steps.length; i++) if (steps[i].kind === kind && i !== skip) spare += Math.max(0, steps[i].dur - RULES.minBlock);
    if (spare <= 0) return over;
    const k = Math.min(1, over / spare);
    for (let i = from; i < steps.length; i++) if (steps[i].kind === kind && i !== skip) steps[i].dur -= Math.max(0, steps[i].dur - RULES.minBlock) * k;
    return over - spare * k;
  }

  // ── orders ──────────────────────────────────────────────────────
  /**
   * What the gate brings for slot `i`: a household not met yet (in street order, step 1); in slot 0
   * the story step of the day; the form of the day in the first free slot from the second that is
   * not the last; Złota godzina in the last slot (an easy open form, in golden light); else an
   * everyday order, an open form weighted by 1 / (1 + times fired), never the previous vessel's.
   */
  private orderFor(i: number): Order {
    const p = this.p, n = this.plan.vessels, last = i === n - 1;
    const intro = nextIntroduction(p);
    if (intro) return this.storyOrder(i, 'intro', intro, 1);
    if (i === 0 && p.storyDay !== this.day) {
      const h = nextStoryHouse(p);
      if (h) return this.storyOrder(i, 'story', h, p.steps[h] + 1);
    }
    if (this.dailyOpen && !this.dailyPlaced && i >= 1 && !last && this.daily) {
      this.dailyPlaced = true;
      const d = this.daily, form = FORM[d.f];
      return {
        index: i, kind: 'daily', form, clay: { N: form.N, q: d.q }, house: null, who: t('gate.dailyWho'), step: 0, glaze: d.glaze,
        line: t('gate.dailyLine'), thanks: t('thanks.daily'), porcelain: this.porcelain(i), first: false,
      };
    }
    const golden = last && n >= 2;
    let pool = golden ? easiest(p) : openForms(p);
    if (pool.length > 1 && this.prevForm) pool = pool.filter(f => f !== this.prevForm);
    if (!pool.length) pool = ['kubek'];
    let total = 0;
    for (const f of pool) total += 1 / (1 + (p.book[f]?.n ?? 0));
    let u = this.rng() * total, pickF = pool[pool.length - 1];
    for (const f of pool) {
      u -= 1 / (1 + (p.book[f]?.n ?? 0));
      if (u <= 0) { pickF = f; break; }
    }
    const form = FORM[pickF];
    const h = form.house;
    return {
      index: i, kind: golden ? 'golden' : 'everyday', form, clay: { N: form.N, q: form.q }, house: h, who: HOUSE_NAME[h], step: 0,
      glaze: orderGlaze(p, form.glaze), line: t(`again.${form.id}` as Key),
      thanks: t(`thanksAgain.${h}.${(p.vessels + i) % 2 ? 'b' : 'a'}` as Key), porcelain: this.porcelain(i), first: false,
    };
  }

  private storyOrder(i: number, kind: 'intro' | 'story', h: HouseId, step: number): Order {
    const form = FORM[storyForm(h, step)];
    return {
      index: i, kind, form, clay: { N: form.N, q: form.q }, house: h, who: HOUSE_NAME[h], step, glaze: orderGlaze(this.p, form.glaze),
      line: t(`story.${h}.${step}` as Key), thanks: t(`thanks.${h}.${step}` as Key), porcelain: this.porcelain(i),
      first: this.p.vessels === 0 && i === 0,
    };
  }

  private porcelain(i: number): boolean { return i === 0 && this.porcelainDue; }

  // ── hints and coaching ──────────────────────────────────────────
  private showHint(key: HintKey, dur: number): void {
    if (this.hintsSeen.has(key)) return;
    this.hintsSeen.add(key);
    if (this.hint && this.hintT < this.hintDur && this.hintDur !== Infinity) {
      this.hintQueue.push({ key, dur });
      return;
    }
    this.hint = key;
    this.hintT = 0;
    this.hintDur = dur;
    this.emit({ type: 'hint', key });
  }

  private clearHint(): void {
    this.hint = null;
    this.hintQueue.length = 0;
  }

  private ageHints(dt: number): void {
    this.tipT += dt;
    if (!this.hint) return;
    this.hintT += dt;
    if (this.hint === 'pull' && this.clay?.opened) this.hintDur = Math.min(this.hintDur, this.hintT);
    if (this.hintT >= this.hintDur) {
      this.hint = null;
      const q = this.hintQueue.shift();
      if (q) {
        this.hint = q.key;
        this.hintT = 0;
        this.hintDur = q.dur;
        this.emit({ type: 'hint', key: q.key });
      }
    }
  }

  /** The coaching line at a block's start: sessions 1–5, and every blind block. */
  private setTip(text: string, always: boolean): void {
    this.tip = this.session <= 5 || always ? text : '';
    this.tipT = 0;
  }

  // ── input ───────────────────────────────────────────────────────
  /** Touch shapes the clay now (not at the gate, not in the sponge's seconds, not while it slumps). */
  get inputOpen(): boolean { return this.phase === 'throw' && !this.sponge && !!this.clay?.free; }

  /** A tap anywhere on the play area: in a throw a small pull (taps never overpull). */
  tap(): void {
    if (!this.inputOpen) return;
    const clay = this.clay!, before = clay.H;
    const res = clay.tap();
    this.afterPull(res, clay.H - before, true);
  }

  /** A finger lands at height `u` of the vessel (0 foot … 1 rim), on `side` of the axis: the hand moves there. */
  touch(u: number, side: number): void {
    if (this.phase === 'throw' && this.clay) this.clay.touch(u, side);
  }

  /** A drag step (px): `dxOut` away from the axis on the finger's side, `dyUp` upward; the finger at `fingerY`, the hand at `u`. */
  drag(dxOut: number, dyUp: number, fingerY: number, u: number, scale: number): void {
    if (!this.inputOpen) return;
    const clay = this.clay!, before = clay.H;
    const res = clay.drag(dxOut, dyUp, fingerY, u, scale);
    if (dyUp > 0) this.afterPull(res, clay.H - before, false);
    if (dxOut) this.tellShape += Math.abs((CLAY.drag * dxOut) / scale);
  }

  /** The finger lifted. */
  release(): void { this.clay?.release(); }

  private afterPull(res: PullResult, dh: number, tap: boolean): void {
    if (dh > 0) {
      if (tap) this.emit({ type: 'pull', dh, tap: true });
      else this.tellPull += dh;
    }
    if (res === 'contact') {
      this.emit({ type: 'contact' });
      if (this.order?.first) this.showHint('shape', RULES.hintShape);
      if (this.session === 2) this.showHint('over', RULES.hintLine);
    }
  }

  /** Space, ↑ or Enter: a press is a small pull; held, the wall rises steadily. */
  pressKey(down: boolean): void {
    if (down) {
      if (this.press.down) return;
      this.press.down = true;
      this.press.t = 0;
      this.tap();
    } else {
      this.press.down = false;
      this.press.t = 0;
      if (this.clay) this.clay.keyHold = false;
    }
  }

  /** ← / →: narrow (−1) or widen (+1) at the hand's height while held; 0 stops. */
  shapeKey(dir: number): void { this.shapeDir = Math.sign(dir); }

  /** W / S: move the hand up (+1) or down (−1) while held; 0 stops. */
  handKey(dir: number): void { this.handDir = Math.sign(dir); }

  /** Pick the glaze in bucket `i` at the cut (a tap on it, or 1 / 2 / 3). */
  pickGlaze(i: number): void {
    if (this.phase !== 'cut' || i < 0 || i >= this.buckets.length || i === this.pick) return;
    this.pick = i;
    this.emit({ type: 'glaze', index: i });
  }

  /** Every key and finger is up (the runner paused, the window lost focus). */
  releaseAll(): void {
    this.pressKey(false);
    this.shapeDir = 0;
    this.handDir = 0;
    this.release();
  }

  /** A drag's pulls and shapes reach the sound at most ~7 times a second, summed. */
  private tellTouch(dt: number): void {
    this.tellT -= dt;
    if (this.tellT > 0) return;
    if (this.tellPull > 0.02) {
      this.emit({ type: 'pull', dh: this.tellPull, tap: false });
      this.tellT = RULES.touchTell;
    } else if (this.tellShape > 0.02) {
      this.emit({ type: 'shape', dr: this.tellShape });
      this.tellT = RULES.touchTell;
    }
    this.tellPull = 0;
    this.tellShape = 0;
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
   * What the ambient pad's brightness follows (kit/types.ts): the chalk line's fill in a visible
   * throw with a reliable frame; held still everywhere else (blind throws, firings, the gate, the
   * cut, the opening, the finisher, unreliable frames), so the sound never leaks feedback.
   */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'throw' || this.blind || !this.order) return null;
    const lim = this.clay!.lim;
    return clamp((this.lineShown - lim.Hmin) / (lim.Hmax - lim.Hmin));
  }

  /** Time is up: the session may stop once the sunset has played. */
  canStop(): boolean { return this.phase === 'done'; }

  /**
   * The session's numbers, idempotent.  Only a saved session calls it for good, so the session, its
   * blocks and the day are counted here; records go into the progress with Math.max.
   */
  result(): ArcadeOutcome {
    const p = this.p, score = this.score;
    if (this.started) {
      p.sessions = Math.max(p.sessions, this.session);
      p.throwsBegun = Math.max(p.throwsBegun, this.throwsBase + this.throwsBegun);
      p.firingsBegun = Math.max(p.firingsBegun, this.firingsBase + this.firingsBegun);
      if (this.dailySim >= 0) {
        if (p.dailyDay !== this.day) {
          p.dailyDay = this.day;
          p.dailyBest = this.dailySim;
        } else p.dailyBest = Math.max(p.dailyBest, this.dailySim);
      }
      p.todayN = p.lastDay === this.day ? Math.max(p.todayN, this.todayN) : this.todayN;
      p.lastDay = this.day;
    }
    p.bestSession = Math.max(p.bestSession, score);
    p.tallest = Math.max(p.tallest, this.tallestNow);
    p.bestThree = Math.max(p.bestThree, this.threes);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const n = this.heights.length;
    const stats: [string, string][] = [
      [t('stat.vessels'), String(n)],
      [t('stat.tallest'), this.tallestNow > 0 ? cmText(this.tallestNow) : '—'],
      [t('stat.three'), String(this.threes)],
      [t('stat.thin'), this.throwsJudged ? `${this.thin}/${this.throwsJudged}` : '—'],
      [t('stat.centre'), n ? `${this.centres}/${n}` : '—'],
      [t('stat.calm'), this.firingsJudged ? `${this.calms}/${this.firingsJudged}` : '—'],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
      [t('stat.daily'), this.dailySim >= 0 ? pctText(this.dailySim / 100) : '—'],
    ];
    return {
      score, unit: t('unit'), record: this.bestBefore !== null && score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage (kit/scripture.ts): the first Druga forma ever is Jeremiah 18:4,
   * the first session the treasure in clay jars; otherwise the passages the session fits, best fit
   * first, taken in turn from session to session.  The lobby already opens with Jeremiah 18:6.
   */
  closingVerse(): PassageId {
    if (this.secondNow && this.before.seconds === 0) return CLOSING.second;
    if (this.session <= 1) return CLOSING.clay;
    const fit: PassageId[] = [];
    if (this.secondNow) fit.push(CLOSING.second);
    if (this.aliveNow.length) fit.push(CLOSING.alive);
    if (this.mantleNow) fit.push(CLOSING.mantle);
    if (this.calms > 0) fit.push(CLOSING.calm);
    fit.push(CLOSING.clay, CLOSING.work);
    return inTurn(fit, this.session);
  }

  /**
   * At most five lines for the summary, the session's best moments first: new pages, a house come
   * alive, records, kiln gifts, the form of the day, the day's gift, Druga forma, porcelain, story
   * steps.  The first session ends with one strategy to try.
   */
  private highlights(): string[] {
    const out: string[] = [];
    if (this.newForms.length === 1) out.push(t('hl.form', { form: FORM[this.newForms[0]].name }));
    else if (this.newForms.length > 1) out.push(t('hl.forms', { forms: this.newForms.map(f => FORM[f].name).join(', ') }));
    for (const h of this.aliveNow) out.push(t(`alive.${h}` as Key));
    if (this.bestBefore !== null) {
      if (this.tallestNow > this.before.tallest) out.push(t('hl.tallest', { cm: cmText(this.tallestNow) }));
      if (this.threes > this.before.three && this.threes > 1) out.push(t('hl.three', { n: this.threes }));
    }
    if (this.giftsNow.length === 1) out.push(t('hl.gift', { gift: KILN_GIFT_NAME[this.giftsNow[0].gift], form: FORM[this.giftsNow[0].form].name }));
    else if (this.giftsNow.length > 1) {
      out.push(t('hl.gifts', { list: this.giftsNow.map(g => `${KILN_GIFT_NAME[g.gift]} (${FORM[g.form].name})`).join(', ') }));
    }
    if (this.dailySim >= 0) out.push(t('hl.daily', { pct: pctText(this.dailySim / 100) }));
    if (this.dayGiftNow) out.push(t('hl.dayGift', { gift: DAY_GIFT_NAME[this.dayGiftNow] }));
    if (this.secondNow) out.push(t('hl.second'));
    if (this.porcelainNow) out.push(t('hl.porcelain'));
    for (const s of this.stepsNow) out.push(t('hl.step', { house: HOUSE_NAME[s.house], n: s.n }));
    if (this.session === 1) return [...out.slice(0, 4), TIPS.throw[2]];
    return out.slice(0, 5);
  }
}
