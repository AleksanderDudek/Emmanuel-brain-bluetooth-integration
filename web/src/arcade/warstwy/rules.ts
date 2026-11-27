/**
 * Every number of Warstwy światła in one place, and the session's plan (DESIGN §28), pure and deterministic.
 *
 * The way of one session over its length T (3–60 minutes, or a test of a minute or less), time-boxed so it always
 * reaches its blessing:
 *
 *   arrive   whole breaths (~6 %, 10–60 s): the figure stands in its seven dim layers
 *   layers   the player's rhythm — a push (the dial's seconds, its lead-in included), a rest of whole breaths, a push… —
 *            and over it the seven layers, the innermost first.  A push draws out what clings to the layer now (only
 *            real focus); a rest entrusts that layer to Jesus in a short prayer (calm deepens its glow).  The layers
 *            share the pushes' sighted seconds (past the lead-in) equally: when a layer's share is spent, what is
 *            left on it is taken by the Light (grace) and the next opens; a layer cleared early opens the next at once.
 *   whole    the seven layers whole and luminous (rest, whole breaths, ~10 %, 10–150 s)
 *   close    the closing word (~5 %, 16–30 s)
 *
 * The rhythm does not stop at a layer's edge, so a short session keeps its sighted time (a lead-in per push, not per
 * layer).  A test session (≤ testSec, app:smoke plays 40 s) is one push.
 *
 * Fit the work to the session (DESIGN §24.4b): each layer holds `hooksFor(T)` clinging things (2 at 3 min … 7 at an
 * hour), and the focus one asks is fitted when the layer opens — its sighted seconds × the player's pace × `fill`,
 * shared among its things — so a player at their own pace clears every layer with a little room.  The pace
 * (focus-seconds a sighted second) is learnt from session to session (meta.ts) and, within a session, from the
 * session's own seconds (`paceNow`).
 */
import { clamp } from '../kit/juice';

export const RULES = {
  // ── the brain ──────────────────────────────────────────────────
  /** the lead-in of a push block before the brain acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** focus-seconds a sighted second for the average player (the forecast's yardstick) */
  avgYield: 0.75,
  /** the pace before any is learnt: a careful guess below the average, so a first layer rather ends early than unfinished */
  paceFirst: 0.6,
  paceMin: 0.25,
  paceMax: 1.6,
  /** a session's pace moves the saved one half-way toward it, once it has this many sighted seconds */
  paceLearn: 0.5,
  paceSec: 20,
  /** within a session the saved pace counts as this many sighted seconds against the session's own */
  paceWeight: 90,
  /**
   * The share of a layer's sighted time its things ask of a player at their pace (the margin): `fill` at most, less
   * for a short layer, where a few unlucky seconds weigh more — 1 − fillK / √(sighted s), never under fillMin
   * (about 0.65 for the 12 s of a 3-minute layer, 0.82 for 40 s, 0.88 from a minute up).
   */
  fill: 0.88,
  fillK: 1.2,
  fillMin: 0.6,
  /** the rate's shape: (lo + k × above) × (holdLo + holdK × min(1, hold / holdFull)); `above` = (mean level − 0.5) / 0.5 */
  focusLo: 0.7,
  focusK: 0.6,
  holdLo: 0.85,
  holdK: 0.3,
  holdFull: 12,
  /** the level the rate reads is averaged over one whole breath (s, §18.4) */
  meanSec: 10,
  /** what is shown follows the truth with this time constant (s) */
  showTau: 0.9,

  // ── the stages ─────────────────────────────────────────────────
  arrive: { share: 0.06, min: 10, max: 60 },
  whole: { share: 0.1, min: 10, max: 150 },
  close: { share: 0.05, min: 16, max: 30 },
  /** a test session (≤ testSec): the arrival, the whole and the close as shares only */
  testSec: 60,
  test: { arrive: 0.08, whole: 0.08, close: 0.12 },

  // ── the things that cling ──────────────────────────────────────
  /** things on each layer by session length (s → things; between two: the nearer below): two even in three minutes,
   *  so one slow moment costs half a layer, not all of it */
  hooks: [[180, 2], [600, 3], [900, 4], [1500, 5], [2700, 6], [3600, 7]] as readonly (readonly [number, number])[],
  hooksTest: 1,
  hooksMax: 7,
  /** focus-seconds a thing never asks less than (a test: exactly this) */
  needMin: 1.2,
  needTest: 1.2,
  /** the share of a draw spent loosening in place before it rises */
  loosen: 0.3,
  /** a wound left where a thing was closes over this (s) */
  woundSec: 2.4,
  /** a cleared layer closes and clears over this (s) */
  healSec: 3,
  /** the grace at a layer's end: seconds a thing, bounds; a test's sweep */
  gracePer: 0.7,
  graceMin: 2,
  graceMax: 4.5,
  graceTest: 1.2,
  /** a layer with a thing still on it may run on into the next layer's share by this much of a share */
  borrow: 0.5,
  /** calm deepens a layer's glow: a full glow after this many seconds of calm */
  glowSec: 24,

  // ── the rhythm (kit/rhythm.ts): a push's seconds (its lead-in included), a rest's whole breaths ──
  focus: { def: 30, min: 20, max: 60, step: 5 },
  rest: { def: 2, min: 1, max: 4 },
  /** by design (the dials untouched) a rest's breaths by session length (s → breaths) */
  restByLen: [[0, 1], [600, 2], [2700, 3]] as readonly (readonly [number, number])[],
  /** a push is at least this many sighted seconds */
  sightMin: 4,
  /** the last push, its layers all cleared, ends no sooner than this (s, lead-in included) */
  minPush: 8,

  // ── voice and cards ────────────────────────────────────────────
  telegraph: 4,
  bannerSec: 5,
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 3,
  hintGap: 1.2,
  /** a tap makes the words glow again for this long (s) */
  reshowSec: 2.4,
} as const;

/** How long a line of `text` stays on screen to be read twice (s). */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

export const leadOf = (eeg: boolean): number => (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs);
const fin = (v: number | null | undefined, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const byLen = (table: readonly (readonly [number, number])[], T: number): number => {
  let n = table[0][1];
  for (const [sec, k] of table) if (T >= sec - 1) n = k;
  return n;
};

/** Things on each layer for a session of T seconds. */
export function hooksFor(T: number): number {
  if (T <= RULES.testSec) return RULES.hooksTest;
  return Math.min(RULES.hooksMax, byLen(RULES.hooks, T));
}

/** A pace in range (the careful first guess when unknown). */
export const cleanPace = (v: unknown): number =>
  clamp(typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : RULES.paceFirst, RULES.paceMin, RULES.paceMax);

/** The pace a session works with now: the saved pace weighed against the session's own sighted seconds. */
export function paceNow(saved: number, foc: number, sec: number): number {
  const w = RULES.paceWeight;
  const s = Math.max(0, fin(sec, 0));
  return clamp((cleanPace(saved) * w + Math.max(0, fin(foc, 0))) / (w + s), RULES.paceMin, RULES.paceMax);
}

/** The saved pace after a session whose sighted seconds yielded `foc` focus-seconds in `sec` (unchanged under paceSec). */
export function learnPace(saved: number | null, foc: number, sec: number): number | null {
  if (!(sec >= RULES.paceSec)) return saved;
  const own = clamp(foc / sec, RULES.paceMin, RULES.paceMax);
  const from = saved === null ? RULES.paceFirst : cleanPace(saved);
  return Math.round(clamp(from + (own - from) * RULES.paceLearn, RULES.paceMin, RULES.paceMax) * 1000) / 1000;
}

/**
 * How fast a thing is drawn per second for a frame, in focus-seconds: only while focused, faster above the threshold
 * (the level averaged over a whole breath) and as a focused stretch is held.  (The sim calls it only in a sighted push
 * past its lead-in with a reliable signal.)
 */
export function focusRate(meanLevel: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = clamp((fin(meanLevel, 0.5) - 0.5) / 0.5);
  return (R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, fin(hold, 0)) / R.holdFull));
}

/** The grace's sweep at a layer's end for `left` things (s). */
export function graceFor(left: number, test: boolean): number {
  if (left <= 0) return 0;
  if (test) return RULES.graceTest;
  return clamp(RULES.gracePer * left, RULES.graceMin, RULES.graceMax);
}

/** The margin for a layer of `sighted` sighted seconds (see RULES.fill). */
export const fillFor = (sighted: number): number =>
  clamp(1 - RULES.fillK / Math.sqrt(Math.max(1, sighted)), RULES.fillMin, RULES.fill);

/** The focus-seconds each of `n` things asks in a layer of `sighted` sighted seconds at `pace`. */
export const needFor = (sighted: number, pace: number, n: number): number => {
  const S = Math.max(0, sighted);
  return Math.max(RULES.needMin, (S * clamp(pace, RULES.paceMin, RULES.paceMax) * fillFor(S)) / Math.max(1, n));
};

export interface PlanOpts {
  plannedSec: number;
  /** the breath's whole cycle (s) */
  cyc: number;
  eeg: boolean;
  /** the rhythm: a push's seconds and a rest's whole breaths (null: the design) */
  focus?: number | null;
  rest?: number | null;
  /** the player moved a dial (kit/rhythm.ts `custom`): their rests are kept at every length */
  custom?: boolean;
  /** the player's learnt pace (null: the careful first guess) */
  pace?: number | null;
}

export interface Plan {
  T: number;
  lead: number;
  cyc: number;
  test: boolean;
  /** the arrival's end, the layers' planned end (the last push's), the whole's end (s of play); the close ends at T */
  arriveEnd: number;
  layersEnd: number;
  wholeEnd: number;
  arriveBreaths: number;
  /** the rhythm: pushes, a push's seconds (its lead-in included), a rest's whole breaths and seconds */
  pushes: number;
  push: number;
  restBreaths: number;
  rest: number;
  /** sighted seconds in all the pushes, and each layer's share of them */
  sighted: number;
  win: number;
  /** things on each layer, and the focus each asks at the plan's pace */
  hooks: number;
  need: number;
  pace: number;
}

const dialFocus = (v: number | null | undefined): number => {
  const F = RULES.focus;
  return clamp(Math.round(fin(v, F.def) / F.step) * F.step, F.min, F.max);
};
const dialRest = (v: number | null | undefined): number => {
  const R = RULES.rest;
  return clamp(Math.round(fin(v, R.def)), R.min, R.max);
};

/** The session's plan (see the module's comment).  Every length is in seconds of play; the stage ends add up to T. */
export function planFor(o: PlanOpts): Plan {
  const R = RULES;
  const T = Math.max(10, fin(o.plannedSec, 300));
  const test = T <= R.testSec;
  const cyc = Math.max(2, fin(o.cyc, 10));
  const lead = leadOf(o.eeg);
  const pace = cleanPace(o.pace ?? null);
  const F = dialFocus(o.focus);
  let restBreaths = o.custom ? dialRest(o.rest) : byLen(R.restByLen, T);

  let arrive: number, arriveBreaths: number, whole: number, close: number;
  if (test) {
    arrive = T * R.test.arrive;
    arriveBreaths = Math.max(1, Math.ceil(arrive / cyc));
    whole = T * R.test.whole;
    close = T * R.test.close;
  } else {
    arriveBreaths = Math.max(1, Math.round(clamp(T * R.arrive.share, R.arrive.min, R.arrive.max) / cyc));
    arrive = arriveBreaths * cyc;
    whole = Math.max(cyc, Math.round(clamp(T * R.whole.share, R.whole.min, R.whole.max) / cyc) * cyc);
    close = clamp(T * R.close.share, R.close.min, R.close.max);
  }
  const mid = Math.max(lead + 1, T - arrive - whole - close);
  // the rhythm: m pushes with m − 1 rests between them (the whole is the rest after the last)
  let pushes = 1, push = mid, rest = 0;
  if (!test) {
    rest = restBreaths * cyc;
    const least = lead + R.sightMin;
    pushes = Math.max(1, Math.round((mid + rest) / (F + rest)));
    push = (mid - (pushes - 1) * rest) / pushes;
    while (pushes > 1 && push < least) {
      pushes--;
      push = (mid - (pushes - 1) * rest) / pushes;
    }
  } else restBreaths = 0;
  const sighted = pushes * Math.max(0, push - lead);
  const hooks = hooksFor(T);
  const win = sighted / 7;
  const need = test ? R.needTest : needFor(win, pace, hooks);
  return {
    T, lead, cyc, test, arriveEnd: arrive, layersEnd: arrive + mid, wholeEnd: T - close, arriveBreaths,
    pushes, push, restBreaths, rest, sighted, win, hooks, need, pace,
  };
}
