/**
 * Every number of Rzeka Ezechiela's rules in one place (DESIGN §18): how the water rises (only with real focus), the
 * washing, the leaves, the blocks (a push lasts until its step is done, then a rest of whole breaths), the plan of
 * the way for a session of 3–30 minutes, the light (the gauge), the voice and the cards.  Tuning moves a number here
 * and nowhere else; the tests read the same object.  Pure: no DOM, no clock.
 */
import { breathCycle, breathRest, type BreathPattern } from '../kit/breath';
import { MARKS } from './content';

export const RULES = {
  // ── progress (only with focus) ───────────────────────────────
  /** the multiplier of a focused second: multBase + multLevel × level + multHold × min(1, hold / holdFull) */
  multBase: 0.75,
  multLevel: 0.5,
  multHold: 0.25,
  holdFull: 20,
  /**
   * What an average player gives a push second past its lead-in (multiplier-seconds): the plan sizes each step's work
   * with it, so the way ends near the session's end (the tests walk such a player through 3, 10 and 30 minutes).
   */
  eff: 1.05,
  /** a step's work is never less than this (multiplier-seconds) */
  minWork: 6,
  /** leaves a rise or wash push opens on the banks as the water reaches them (Ezek 47:9: wherever the river goes, life) */
  byLeaves: 2,
  /** the fruit of the trees: one ripens with each trees step done, at most twelve ("every month", Rev 22:2) */
  fruitsMax: 12,
  /**
   * the leaves laid on one place spread in a rosette up to this many (a 30-minute session lays up to ~28); later ones
   * (an hour lays ~63) settle on its rim, so the rosette never grows over the arms (round 24)
   */
  laidRing: 30,
  /** a blind push's progress is shown at its end over this long (s) */
  revealSec: 1.8,

  // ── the plan: lengths by the session's planned length (3, 10, 30 min and between) ──
  /** the planned lengths the curves below are given at (s) */
  at: [180, 600, 1800] as readonly number[],
  /**
   * an average player's push (s, with its lead-in), and a rest after it, aimed at (s; whole breaths of the player's
   * pattern).  Round 15 (the founder: "dlaczego jest tak często?"): 30 s steps at 10 minutes and 36 at 30 (were 25
   * and 30), the rest at 30 minutes two breaths (was three) — the rests a third to two fifths of the way, not a half
   */
  pushSec: [21, 30, 36] as readonly number[],
  restTarget: [10, 20, 24] as readonly number[],
  /** the floating rest at the end (s) */
  floatTarget: [12, 30, 45] as readonly number[],
  /** leaves a trees push opens, one by one */
  treeLeaves: [3, 4, 5] as readonly number[],
  /** the shortest rest (s) and the most breaths a player may set */
  restMin: 6,
  restBreathsMax: 12,
  /**
   * The rest's rhythm in the lobby (round 15, kit/rhythm.ts): one step of the way — the water a mark higher, a washing
   * pass, the trees' leaves — lasts `focusDef` s for an average player by design (10 minutes; 21 s in 3, 36 s in 30),
   * `focusMin`…`focusMax`; the rest after it `restDef` whole breaths (1…restBreathsMax).  Taken when the player moved
   * a dial; then a push that runs long rests by the valve after valveMax or 1.5 × the player's step, the longer.
   */
  focusDef: 30,
  focusMin: 20,
  focusMax: 90,
  restDef: 2,
  /** a session ends with a push no shorter than this (s): with less time left the floating rest begins instead */
  minPushRoom: 14,

  // ── the safety valve ─────────────────────────────────────────
  /** a push that gains nothing this long past its lead-in (s), or lasts this long under 85 %, rests instead */
  valveStall: 45,
  valveMax: 120,
  valveUnder: 0.85,

  // ── the light (the gauge) ────────────────────────────────────
  baseLight: 0.45,
  lightTau: 0.8,
  restLight: 0.3,
  gold: 0.5,

  // ── the session ──────────────────────────────────────────────
  /** the lead-in before the brain acts in a push (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: the narrator waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up, the threshold (s): 30 from 5 min, 20 in shorter, 6 in a short test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch, where the river goes (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict; a push shorter than minJudged is not judged */
  minReliable: 8,
  minJudged: 10,
  /** gold light this long (s) before the narrator says so; a sighted push without focus this long, "the water waits" */
  goodSec: 5,
  stillSec: 9,
  /** every repeatEvery-th push asks to count steps instead of picturing (for those who do not picture easily) */
  repeatEvery: 3,

  // ── the pictures' moments ────────────────────────────────────
  /** a leaf drifts from its tree to its place (s) */
  layFly: 2.6,
  /** the measuring line of light is laid across the water (s) */
  lineSec: 2.2,
  /** the words glow again after a tap on the picture (s) */
  reshowSec: 2.4,
  /** the place chooser closes by itself after this long untouched (s) */
  pickerIdle: 20,

  // ── cards and the voice ──────────────────────────────────────
  pageSec: 11,
  tapAfter: 0.6,
  talkMin: 2.5,
  talkMax: 4.5,
  talkGap: 2.6,
  /** sessions over talkFrom s (45 and 60 minutes): a narrator's line comes back only after talkFresh s (round 24) */
  talkFrom: 1800,
  talkFresh: 600,
  hintGap: 1.2,
} as const;

/** A value of one of the plan's curves for a planned length (piecewise linear over RULES.at, flat outside). */
export function curve(values: readonly number[], plannedSec: number): number {
  const at = RULES.at;
  if (plannedSec <= at[0]) return values[0];
  for (let i = 1; i < at.length; i++) {
    if (plannedSec <= at[i]) return values[i - 1] + (values[i] - values[i - 1]) * ((plannedSec - at[i - 1]) / (at[i] - at[i - 1]));
  }
  return values[values.length - 1];
}

/** The multiplier of a focused second: faster with the level and with a sustained hold. */
export function mult(level: number, hold: number): number {
  const l = Math.max(0, Math.min(1, level));
  return RULES.multBase + RULES.multLevel * l + RULES.multHold * Math.min(1, Math.max(0, hold) / RULES.holdFull);
}

/** The last stretch: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** The first-ever session's warm-up (the threshold): 30 s from 5 minutes, 20 s in shorter, 6 s in a short test. */
export const warmFor = (plannedSec: number): number => (plannedSec >= 300 ? RULES.warm.long : plannedSec >= 120 ? RULES.warm.short : RULES.warm.test);

export type StepKind = 'rise' | 'wash' | 'trees';

/**
 * One push of the way: the water rising from mark `from` to mark `to`, a washing pass (`pass` of `of`), or the trees
 * putting out `leaves` leaves.  `work` is what the step takes (multiplier-seconds of focus).
 */
export interface Step { kind: StepKind; from: number; to: number; pass: number; of: number; leaves: number; work: number }

/** The way of one session. */
export interface Way {
  steps: Step[];
  /** the nominal push (s), a rest's breaths and seconds, the floating rest's breaths and seconds */
  pushSec: number;
  rest: { cycles: number; sec: number };
  float: { cycles: number; sec: number };
  /** a push's work (multiplier-seconds) and leaves per trees push */
  work: number;
  treeLeaves: number;
}

/** How the rise is cut into pushes for the room there is: four marks one by one, or two a push on a short session. */
export function riseCuts(pushes: number): number[] {
  if (pushes >= 4) return [1, 1, 1, 1];
  if (pushes === 3) return [1, 1, 2];
  if (pushes === 2) return [2, 2];
  return [MARKS];
}

/**
 * The way for a session (pure): how many pushes fit (each ~`pushSec` for an average player, a rest of whole breaths
 * after it, the floating rest and the last stretch at the end, the warm-up the first time), and what each push does —
 * the rise (four pushes when six fit, fewer when fewer), one to three washing passes, and the trees with their leaves.
 * Three minutes reach the river and one leaf; thirty go through more breaths at each mark, more passes, many leaves.
 *
 * `restBreaths`: the player's own count of breaths in a rest (0 = auto); `pushSec`: the player's own step (s, the
 * lobby's Rytm; absent = the curve for the length).
 */
export function planWay(plannedSec: number, opts: { firstEver: boolean; eeg: boolean; breath: BreathPattern; restBreaths?: number; pushSec?: number }): Way {
  const P = Math.max(10, plannedSec);
  const lead = opts.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
  const pushSec = opts.pushSec ? Math.max(RULES.focusMin, Math.min(RULES.focusMax, opts.pushSec)) : curve(RULES.pushSec, P);
  const cyc = breathCycle(opts.breath);
  const own = Math.max(0, Math.min(RULES.restBreathsMax, Math.round(opts.restBreaths ?? 0)));
  const rest = own > 0 ? { cycles: own, sec: own * cyc } : breathRest(opts.breath, curve(RULES.restTarget, P), RULES.restMin);
  const float = breathRest(opts.breath, curve(RULES.floatTarget, P), RULES.restMin);
  const warm = opts.firstEver ? warmFor(P) : 0;
  const room = P - warm - finaleFor(P) - float.sec;
  const n = Math.max(1, Math.floor((room + rest.sec) / (pushSec + rest.sec)));
  const work = Math.max(RULES.minWork, (pushSec - lead) * RULES.eff);
  const treeLeaves = Math.round(curve(RULES.treeLeaves, P));
  const steps: Step[] = [];
  const step = (kind: StepKind, from: number, to: number, pass = 0, of = 0, leaves = 0): Step => ({ kind, from, to, pass, of, leaves, work });
  // the rise: four pushes when there is room for six (rise, a washing, a leaf), else fewer with two marks in one
  const risePushes = n >= 6 ? 4 : n === 5 ? 3 : n === 4 ? 2 : 1;
  let level = 0;
  for (const cut of riseCuts(risePushes)) {
    steps.push(step('rise', level, level + cut));
    level += cut;
  }
  const left = n - risePushes;
  if (left <= 0) return { steps, pushSec, rest, float, work, treeLeaves };
  // the washing: one pass, two from ten pushes, three from sixteen — but with room for one push only, the leaf (the
  // prayer) comes first and the dust waits for a longer session
  const washes = left === 1 ? 0 : Math.max(1, Math.min(3, Math.round(left * 0.22)));
  for (let i = 0; i < washes; i++) steps.push(step('wash', MARKS, MARKS, i + 1, washes));
  for (let i = 0; i < left - washes; i++) steps.push(step('trees', MARKS, MARKS, 0, 0, treeLeaves));
  return { steps, pushSec, rest, float, work, treeLeaves };
}

/** A trees step beyond the plan (a strong player finished the way early: the trees go on putting out leaves). */
export function moreTrees(way: Way): Step {
  return { kind: 'trees', from: MARKS, to: MARKS, pass: 0, of: 0, leaves: way.treeLeaves, work: way.work };
}
