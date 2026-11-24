/**
 * Every number of Złote serce in one place, and the session's plan (DESIGN.md §21), pure and deterministic.
 *
 * The way of one session is time-boxed over its length T (3–30 minutes, or a test of a minute or less): each stage has
 * a planned END, so a session always reaches its close —
 *
 *   arrive    whole breaths in the dark (~6 %, 20–60 s): the heart lies broken on the cloth
 *   gather    the pieces, each lifted (focus) → washed (rest, whole breaths) → laid (focus).  A focus block lays the
 *             piece washed last and lifts the next; a rest washes it.  The heart breaks into `pieces` pieces by the
 *             session's length; the plan fits `planned` of them to the player's rhythm (how much focus a lift or a lay
 *             asks of the average player).  A stronger player gathers more; whatever is left when the gather's time
 *             ends is gathered by grace in a short gentle sweep — the heart is always whole by the gold.  All laid
 *             sooner: the gold begins sooner.
 *   gold      pushes of focus pour the gold along the seams, rests between (the player's rhythm), until its end — or,
 *             all gilded, at the end of that push (the beat and the radiance then share the time left)
 *   beat      the heart begins to beat (rest; ~10 %, at most 2 minutes)
 *   radiance  the golden heart shines (rest; ~12 %, at most 3 minutes)
 *   close     the blessing, the closing verse, "how much does it hurt now" (~5 %, 16–30 s)
 *
 * Only real focus lifts, lays and pours (§18.3–18.4): in a sighted push past its lead-in, with a reliable signal, while
 * focused, at the rate of `focusRate`.  Washing, the beat and the radiance are receptive and run in whole breaths.
 */
import { clamp } from '../kit/juice';

export const RULES = {
  // ── the brain ──────────────────────────────────────────────────
  /** the lead-in of a push block before the brain acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** focus-seconds a second past the lead-in for the average player (the plan's yardstick) */
  avgYield: 0.75,
  /** the average player finishes what the plan asks in this share of its time */
  fill: 0.88,
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
  arrive: { share: 0.06, min: 20, max: 60 },
  close: { share: 0.05, min: 16, max: 30 },
  /** a test session (≤ testSec): the arrival and the close as shares only */
  testSec: 60,
  test: { arrive: 0.08, close: 0.14 },
  /** a test session's gold: seconds of sighted pour it keeps room for (app:smoke plays 40 s and wants a score) */
  testPour: 7,
  /** the middle's shares of the session (the arrival and the close aside) */
  shares: { gather: 0.48, gold: 0.2, beat: 0.1, radiance: 0.12 },
  beatMax: 120,
  radianceMax: 180,

  // ── the pieces ─────────────────────────────────────────────────
  /** pieces the heart breaks into, by session length (s → pieces; between two: the nearer below) */
  pieces: [[180, 4], [300, 5], [600, 7], [900, 9], [1200, 11], [1500, 12], [1800, 13]] as readonly (readonly [number, number])[],
  piecesTest: 3,
  piecesMax: 14,
  /** a lift or a lay never asks less than this many sighted seconds of the plan */
  taskMin: 2.5,
  /** the grace's sweep: seconds per piece left, and its bounds */
  gracePer: 0.9,
  graceMin: 5,
  graceMax: 10,
  graceTest: 3,
  /** a focus block with no progress this long (s) rests (the progress stays) */
  stallSec: 40,
  /** a focus block whose task is done ends no sooner than this (s, lead-in included) */
  minPush: 8,

  // ── the rhythm (kit/rhythm.ts): a lift-and-lay block's seconds, a wash's whole breaths ──
  focus: { def: 20, min: 15, max: 45, step: 5 },
  rest: { def: 2, min: 1, max: 4 },
  /** by design (the player has not moved the dials) a session shorter than this washes in one breath: more pieces fit */
  shortSec: 600,
  /** a gold push is at least this long (s, lead-in included) */
  goldPushMin: 25,
  /** a push left shorter than this before a stage's end is not begun (s past the lead-in) */
  pushTail: 8,

  // ── the beat ───────────────────────────────────────────────────
  /** beats a minute without a reliable pulse from the band, and the pulse's bounds */
  bpmCalm: 60,
  bpmMin: 45,
  bpmMax: 110,
  /** the "dub" after the "lub" (share of a beat) */
  dubAt: 0.3,
  /** the colour turns gold over this share of the beat stage */
  tintShare: 0.7,

  // ── the radiance ───────────────────────────────────────────────
  /** the three qualities open at these shares of the radiance */
  qualityAt: [0.04, 0.34, 0.64] as readonly number[],

  // ── the close ──────────────────────────────────────────────────
  /** the close waits up to this long (s) past the session's end for the 0–10 answer */
  rateWait: 6,
  historyMax: 30,

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
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

/** Pieces the heart breaks into for a session of T seconds. */
export function piecesFor(T: number): number {
  if (T <= RULES.testSec) return RULES.piecesTest;
  let n = RULES.pieces[0][1];
  for (const [sec, k] of RULES.pieces) if (T >= sec - 1) n = k;
  return n;
}

/** The grace's sweep for `left` pieces (s). */
export function graceFor(left: number, T: number): number {
  if (left <= 0) return 0;
  if (T <= RULES.testSec) return RULES.graceTest;
  return clamp(RULES.graceMin + RULES.gracePer * (left - 1), RULES.graceMin, RULES.graceMax);
}

/**
 * How fast a task (a lift, a lay, the gold) moves per second for a frame, in focus-seconds: only while focused, faster
 * above the threshold (the level averaged over a whole breath) and as a focused stretch is held.  (The sim calls it
 * only in a sighted push past its lead-in with a reliable signal.)
 */
export function focusRate(meanLevel: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = clamp((fin(meanLevel, 0.5) - 0.5) / 0.5);
  return (R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, fin(hold, 0)) / R.holdFull));
}

export interface PlanOpts {
  plannedSec: number;
  /** the breath's whole cycle (s) */
  cyc: number;
  eeg: boolean;
  /** the rhythm: a lift-and-lay block's seconds and a wash's whole breaths (null: the design) */
  focus?: number | null;
  rest?: number | null;
  /** the player moved a dial (kit/rhythm.ts `custom`): their washes are kept in a short session too */
  custom?: boolean;
}

export interface Plan {
  T: number;
  lead: number;
  cyc: number;
  /** each stage's planned end (s of play); `close` = T */
  arriveEnd: number;
  gatherEnd: number;
  goldEnd: number;
  beatEnd: number;
  radianceEnd: number;
  /** the arrival's whole breaths (a test: a share of a breath may end it) */
  arriveBreaths: number;
  /** pieces the heart breaks into, and how many the plan fits to the average player */
  pieces: number;
  planned: number;
  /** a wash's whole breaths */
  wash: number;
  /** sighted seconds the plan gives a lift or a lay, and the focus-seconds each asks */
  taskSec: number;
  taskNeed: number;
  /** the gold: a push's length (s, lead-in included), the rests' whole breaths, the pushes planned, the focus-seconds it all asks */
  goldPush: number;
  goldRest: number;
  goldPushes: number;
  goldNeed: number;
  /** the grace's sweep the plan expects (s; 0 when the average player gathers every piece) */
  grace: number;
}

/** A focus dial value in range (the design's when absent). */
const dialFocus = (v: number | null | undefined): number => {
  const F = RULES.focus;
  return clamp(Math.round(fin(v ?? F.def, F.def) / F.step) * F.step, F.min, F.max);
};
const dialRest = (v: number | null | undefined): number => {
  const R = RULES.rest;
  return clamp(Math.round(fin(v ?? R.def, R.def)), R.min, R.max);
};

/** Sighted seconds per task when `n` pieces are gathered in `G` s with washes of `w` breaths. */
export const taskSecFor = (G: number, n: number, w: number, cyc: number, lead: number): number =>
  (G - n * w * cyc - (n + 1) * lead) / (2 * n);

/**
 * The session's plan (see the module's comment).  Every length is in seconds of play; the stage ends add up to T.
 */
export function planFor(o: PlanOpts): Plan {
  const R = RULES;
  const T = Math.max(10, fin(o.plannedSec, 300));
  const test = T <= R.testSec;
  const cyc = Math.max(2, fin(o.cyc, 10));
  const lead = leadOf(o.eeg);
  const F = dialFocus(o.focus);
  const W0 = !o.custom && T < R.shortSec ? R.rest.min : dialRest(o.rest);

  // the arrival in whole breaths (a test: its share), the close
  let arrive: number, arriveBreaths: number;
  if (test) {
    arrive = T * R.test.arrive;
    arriveBreaths = Math.max(1, Math.ceil(arrive / cyc));
  } else {
    const want = clamp(T * R.arrive.share, R.arrive.min, R.arrive.max);
    arriveBreaths = Math.max(1, Math.round(want / cyc));
    arrive = arriveBreaths * cyc;
  }
  const close = test ? T * R.test.close : clamp(T * R.close.share, R.close.min, R.close.max);
  const mid = Math.max(1, T - arrive - close);
  const S = R.shares, sum = S.gather + S.gold + S.beat + S.radiance;
  // the beat and the radiance in whole breaths, capped; what they leave goes to the gather and the gold
  const whole = (x: number): number => (test ? x : Math.max(cyc, Math.round(x / cyc) * cyc));
  const beat = whole(Math.min(R.beatMax, (mid * S.beat) / sum));
  const radiance = whole(Math.min(R.radianceMax, (mid * S.radiance) / sum));
  const work = Math.max(1, mid - beat - radiance);
  // a test (≤ testSec): the gold keeps room for one sighted push after the grace — a minute's test still pours and scores
  const share = (work * S.gather) / (S.gather + S.gold);
  const gather = test ? Math.max(R.taskMin, Math.min(share, work - R.graceTest - lead - R.testPour)) : share;

  // the pieces: the heart's, and how many fit the player's rhythm (a lift-and-lay block of F s: tasks of (F − lead) / 2)
  const pieces = piecesFor(T);
  const sMin = Math.max(R.taskMin, (F - lead) / 2);
  let planned = 0, wash = W0, taskSec = 0;
  for (let w = W0; w >= 1 && !planned; w--) {
    for (let n = pieces; n >= 1; n--) {
      const s = taskSecFor(gather, n, w, cyc, lead);
      if (s >= sMin) { planned = n; wash = w; taskSec = s; break; }
    }
  }
  if (!planned) {
    // even one piece at the least wash does not fit (a test): one piece, as long as the gather allows
    planned = 1;
    wash = 1;
    taskSec = Math.max(R.taskMin, taskSecFor(gather, 1, 1, cyc, lead));
  }
  const taskNeed = R.avgYield * taskSec * R.fill;
  const grace = planned < pieces ? graceFor(pieces - planned, T) : 0;

  // the gold: pushes of at least goldPushMin (the player's F when longer), rests of the wash's breaths, filling its window
  const goldWin = Math.max(1, work - gather - grace);
  const restSec = wash * cyc;
  const P = Math.max(F, R.goldPushMin);
  const k = Math.max(1, Math.round((goldWin + restSec) / (P + restSec)));
  const goldPush = Math.max(lead + 1, (goldWin - (k - 1) * restSec) / k);
  const goldNeed = R.avgYield * k * Math.max(1, goldPush - lead) * R.fill;

  const arriveEnd = arrive;
  const gatherEnd = arriveEnd + gather;
  const goldEnd = arriveEnd + work;
  const radianceEnd = Math.max(goldEnd, T - close);
  const beatEnd = goldEnd + ((radianceEnd - goldEnd) * beat) / Math.max(1e-6, beat + radiance);
  return {
    T, lead, cyc, arriveEnd, gatherEnd, goldEnd, beatEnd, radianceEnd, arriveBreaths, pieces, planned, wash, taskSec, taskNeed,
    goldPush, goldRest: wash, goldPushes: k, goldNeed, grace,
  };
}
