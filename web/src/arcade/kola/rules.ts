/**
 * Every number of Koła światła in one place, and the session's plan (DESIGN.md §28), pure and deterministic.
 *
 * One session over its length T (3–60 minutes, or a test of a minute or less):
 *
 *   arrive   the figure in the dark, the twelve wheels dim and out of true — whole breaths (~5 %)
 *   wheels   one after another from the base up (1, 2 front, 2 back … 6 back, 7), in pushes and rests: a push lasts
 *            until its group of wheels turns true by focus (by the light, as the founder asked of Rzeki in round 11:
 *            a rest after each finished station, not each interval), then a rest of whole breaths — the place's
 *            prayer, its passage, the breath guide.  A long session walks the twelve again in finer rounds.
 *   field    all twelve turning together; their light fills one egg-shaped field round the figure, layer by layer,
 *            in the seven colours, into one white-gold light (~10 %)
 *   close    the blessing and the closing passage
 *
 * The groups: every wheel alone where the time allows (10 minutes up), each centre's front and back together at
 * 5 minutes, two or three centres together at 3; rounds 2 and 3 from 25 and 45 minutes.  The plan gives each group
 * a target push; the sim re-fits it to the time left and sizes the work to the player's pace (rules `needPer`), so a
 * player who focuses as they usually do turns the twelve true and reaches the full field at any length.
 *
 * Only real focus brings a wheel true (§18.3–18.4): in a sighted push past its lead-in, with a reliable signal, while
 * focused, at `focusRate`.  The rests, the arrival and the field are receptive and run in whole breaths.
 */
import { clamp } from '../kit/juice';
import { CENTRES, WHEELS, type CentreId, type WheelId } from './content';

export const RULES = {
  // ── the brain ──────────────────────────────────────────────────
  /** the lead-in of a push before the brain acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the rate's shape: (lo + k × above) × (holdLo + holdK × min(1, hold / holdFull)) */
  focusLo: 0.7,
  focusK: 0.6,
  holdLo: 0.85,
  holdK: 0.3,
  holdFull: 12,
  /** the level the rate reads is averaged over one whole breath (s, §18.4) */
  meanSec: 10,
  /** what is shown follows the truth with this time constant (s) */
  showTau: 0.9,

  // ── the pace (focus-seconds a sighted second) and the fit ───────
  /** a newcomer's pace: a careful guess under the average player's ~0.75, so the first session rather ends early */
  paceDef: 0.6,
  paceMin: 0.2,
  paceMax: 1.4,
  /** the saved pace counts as this many sighted seconds against the session's own */
  paceWeight: 90,
  /** a session keeps its pace only after this many sighted seconds */
  paceLearn: 40,
  /** the work asks this share of what the pace does in the target time (the margin) */
  fill: 0.88,
  /** a step's focus-seconds: never less, never more */
  needMin: 0.6,
  needMax: 30,
  /** the target re-fitted to the time left: at most this far from the plan */
  scaleMin: 0.5,
  scaleMax: 1.6,

  // ── the valve: a push that cannot finish ends into a rest; its wheel waits ──
  valveNoGain: 40,
  valveOver: 1.8,
  valvePlus: 15,
  /** a push with no progress this long (s) asks gently once */
  waitSec: 12,
  /** the gentle "come back" and the valve's words at most once in this long (s): a long session never nags */
  quietSec: 300,

  // ── the rhythm (kit/rhythm.ts): a push's seconds (lead-in included), a rest's whole breaths ──
  focus: { def: 20, min: 10, max: 60, step: 5 },
  rest: { def: 2, min: 1, max: 5 },

  // ── the frame ──────────────────────────────────────────────────
  arrive: { share: 0.05, min: 15, max: 50 },
  field: { share: 0.1, min: 30, max: 240 },
  close: { share: 0.03, min: 12, max: 30 },
  /** the field may grow to this share of its frame with time left over */
  fieldGrow: 1.6,
  /** a test session (app:smoke plays 40 s and wants petals): at most this long */
  testSec: 60,
  /** a test's shares: the arrival, the field, the close (the push takes the rest) */
  test: { arrive: 0.1, field: 0.22, close: 0.12 },
  /** a test wheel's focus-seconds (app:smoke's half focus lights several) */
  testNeed: 0.6,

  // ── the plan's growth ──────────────────────────────────────────
  /** the least sighted seconds a wheel takes in a push, by how many groups a round has */
  wMin: { 12: 10, 7: 7, 4: 5, 3: 4, 2: 4, 1: 3 } as Readonly<Record<number, number>>,
  /** a finer round (2, 3) begins only with this many sighted seconds a wheel at least */
  wRound: 15,

  // ── the field ──────────────────────────────────────────────────
  /** the field's parts (shares): all wheels turning together, the seven layers filling, the white-gold */
  fieldTurn: 0.1,
  fieldLayers: 0.72,

  // ── the voice ──────────────────────────────────────────────────
  telegraph: 4,
  bannerSec: 5,
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 3,
  hintGap: 1.2,
  reshowSec: 2.4,
} as const;

/** How long a line of `text` stays on screen to be read twice (s). */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

export const leadOf = (eeg: boolean): number => (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs);
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

/**
 * How fast a wheel comes true per second for a frame, in focus-seconds: only while focused, faster above the threshold
 * (the level averaged over a whole breath) and as a focused stretch is held.  (The sim calls it only in a sighted push
 * past its lead-in with a reliable signal and work to do.)
 */
export function focusRate(meanLevel: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = clamp((fin(meanLevel, 0.5) - 0.5) / 0.5);
  return (R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, fin(hold, 0)) / R.holdFull));
}

/** A pace kept in range (unknown or broken: the newcomer's). */
export const cleanPace = (v: unknown): number =>
  (typeof v === 'number' && Number.isFinite(v) && v > 0 ? clamp(v, RULES.paceMin, RULES.paceMax) : RULES.paceDef);

/** The pace a session works with: the saved one (as `paceWeight` sighted seconds) blended with the session's own. */
export function paceNow(saved: number, earned: number, sighted: number): number {
  const p0 = cleanPace(saved), W = RULES.paceWeight;
  const s = Math.max(0, fin(sighted, 0)), e = Math.max(0, fin(earned, 0));
  return clamp((p0 * W + e) / (W + s), RULES.paceMin, RULES.paceMax);
}

/** The pace to keep after a session: half-way toward its own (once it had `paceLearn` sighted seconds). */
export function learnPace(saved: number, earned: number, sighted: number, known: boolean): number {
  if (!(sighted >= RULES.paceLearn)) return known ? cleanPace(saved) : 0;
  const own = clamp(earned / sighted, RULES.paceMin, RULES.paceMax);
  return known ? clamp((cleanPace(saved) + own) / 2, RULES.paceMin, RULES.paceMax) : own;
}

/** A step's focus-seconds: the pace over the sighted target, with the margin, shared by the steps. */
export function needPer(pace: number, sighted: number, steps: number): number {
  const n = Math.max(1, Math.round(fin(steps, 1)));
  return clamp((cleanPace(pace) * Math.max(0, fin(sighted, 0)) * RULES.fill) / n, RULES.needMin, RULES.needMax);
}

/** The steps a round asks of each wheel, from the sighted seconds a wheel has in it (more time: finer steps). */
export function stepsFor(round: number, w: number): number {
  if (round === 1) return w < 8 ? 2 : w < 13 ? 3 : w < 20 ? 4 : 5;
  return w < 20 ? 1 : 2;
}

// ── the groups ──────────────────────────────────────────────────────

/** The groupings a round may take: how many pushes it has (12: each wheel; 7: each centre; fewer: centres together). */
export const GROUPINGS = [12, 7, 4, 3, 2, 1] as const;
export type Grouping = (typeof GROUPINGS)[number];

const CENTRE_SETS: Readonly<Record<Exclude<Grouping, 12 | 7>, readonly (readonly CentreId[])[]>> = {
  4: [['root', 'sacral'], ['plexus', 'heart'], ['throat', 'brow'], ['crown']],
  3: [['root', 'sacral', 'plexus'], ['heart', 'throat'], ['brow', 'crown']],
  2: [['root', 'sacral', 'plexus'], ['heart', 'throat', 'brow', 'crown']],
  1: [CENTRES],
};

/** The wheels of each push in a grouping, in the way's order: front and back of one centre always together (but 12). */
export function groupsOf(g: Grouping): WheelId[][] {
  if (g === 12) return WHEELS.map(w => [w.id]);
  if (g === 7) return CENTRES.map(c => WHEELS.filter(w => w.centre === c).map(w => w.id));
  return CENTRE_SETS[g].map(set => WHEELS.filter(w => set.includes(w.centre)).map(w => w.id));
}

// ── the plan ────────────────────────────────────────────────────────

export interface RoundPlan {
  round: 1 | 2 | 3;
  grouping: Grouping;
  /** sighted seconds a wheel takes (the plan's; the sim re-fits it to the time left) */
  w: number;
  /** steps each wheel asks in this round */
  steps: number;
}

export interface Group {
  round: 1 | 2 | 3;
  wheels: WheelId[];
  /** the target push (s, lead-in included) and its sighted seconds */
  push: number;
  sighted: number;
  /** the rest after it: whole breaths (a test: none) */
  breaths: number;
}

export interface PlanOpts {
  plannedSec: number;
  /** the breath's whole cycle (s) */
  cyc: number;
  eeg: boolean;
  /** the rhythm: a push's seconds and a rest's whole breaths (null: the design) */
  focus?: number | null;
  rest?: number | null;
  /** the player moved a dial (kit/rhythm.ts `custom`): their push and rest are kept */
  custom?: boolean;
}

export interface Plan {
  T: number;
  lead: number;
  cyc: number;
  test: boolean;
  /** the arrival ends here (whole breaths), the field begins at the latest here, the close here */
  arriveEnd: number;
  arriveBreaths: number;
  fieldStart: number;
  closeStart: number;
  rounds: RoundPlan[];
  groups: Group[];
  /** a rest's whole breaths */
  breaths: number;
  /** the time the plan uses in the wheels (s) and the room it had */
  used: number;
  room: number;
}

/** A focus dial value in range (the design's when absent). */
export const dialFocus = (v: number | null | undefined): number => {
  const F = RULES.focus;
  return clamp(Math.round(fin(v ?? F.def, F.def) / F.step) * F.step, F.min, F.max);
};
export const dialRest = (v: number | null | undefined): number => {
  const R = RULES.rest;
  return clamp(Math.round(fin(v ?? R.def, R.def)), R.min, R.max);
};

/** The frame's seconds for a session of `T` (a test: shares). */
export function frameOf(T: number, cyc: number): { arrive: number; arriveBreaths: number; field: number; close: number } {
  const R = RULES;
  if (T <= R.testSec) return { arrive: T * R.test.arrive, arriveBreaths: 1, field: T * R.test.field, close: T * R.test.close };
  const want = clamp(T * R.arrive.share, R.arrive.min, R.arrive.max);
  const arriveBreaths = Math.max(1, Math.round(want / cyc));
  return {
    arrive: arriveBreaths * cyc,
    arriveBreaths,
    field: clamp(T * R.field.share, R.field.min, R.field.max),
    close: clamp(T * R.close.share, R.close.min, R.close.max),
  };
}

/** The session's plan (see the module's comment). */
export function planFor(o: PlanOpts): Plan {
  const R = RULES;
  const T = Math.max(10, fin(o.plannedSec, 300));
  const test = T <= R.testSec;
  const cyc = Math.max(2, fin(o.cyc, 10));
  const lead = leadOf(o.eeg);
  const fr = frameOf(T, cyc);
  const room = Math.max(1, T - fr.arrive - fr.field - fr.close);
  let field = fr.field;
  let rounds: RoundPlan[];
  let b: number;

  if (test) {
    // one push for all twelve, one step each; no rest (the field follows)
    rounds = [{ round: 1, grouping: 1, w: Math.max(0.5, (room - lead) / 12), steps: 1 }];
    b = 0;
  } else if (o.custom) {
    ({ rounds, b } = customRounds(room, lead, cyc, dialFocus(o.focus), dialRest(o.rest)));
  } else {
    ({ rounds, b } = designRounds(room, lead, cyc));
  }
  const cost = (rs: RoundPlan[], bb: number): number => rs.reduce((s, r) => s + r.grouping * (lead + bb * cyc) + 12 * r.w, 0);
  const used = test ? room : cost(rounds, b);
  // time left over: the field grows (up to its share), the rest the sim's re-fit gives the pushes
  const left = room - used;
  if (!test && left > 0) field += Math.min(left, field * (R.fieldGrow - 1));
  const groups: Group[] = [];
  for (const r of rounds) {
    for (const wheels of groupsOf(r.grouping)) {
      const sighted = r.w * wheels.length;
      groups.push({ round: r.round, wheels, push: lead + sighted, sighted, breaths: b });
    }
  }
  const closeStart = T - fr.close;
  const fieldStart = Math.max(fr.arrive + 1, closeStart - field);
  return { T, lead, cyc, test, arriveEnd: fr.arrive, arriveBreaths: fr.arriveBreaths, fieldStart, closeStart, rounds, groups, breaths: b, used, room };
}

/**
 * The design's rounds for `S` seconds of wheels (dials untouched): the finest grouping round 1 can have, then in
 * order — rests of two breaths, a finer grouping, wheels of 15 s, rests of three breaths, wheels of 25 s, a second
 * round (by centre, then each wheel), a third, wheels of 35 s, rests of four breaths, wheels of 45 s, rests of five.
 */
function designRounds(S: number, lead: number, cyc: number): { rounds: RoundPlan[]; b: number } {
  const R = RULES;
  let b = 1;
  const rs: { round: 1 | 2 | 3; grouping: Grouping; w: number }[] = [];
  const cost = (bb = b): number => rs.reduce((s, r) => s + r.grouping * (lead + bb * cyc) + 12 * r.w, 0);
  const fits = (): boolean => cost() <= S + 1e-6;
  // round 1: the finest grouping whose least cost fits
  let g1: Grouping = 1;
  for (const g of GROUPINGS) {
    if (g * (lead + cyc) + 12 * R.wMin[g] <= S) { g1 = g; break; }
  }
  rs.push({ round: 1, grouping: g1, w: R.wMin[g1] });
  if (!fits()) rs[0].w = Math.max(0.5, (S - g1 * (lead + cyc)) / 12);
  if (!fits()) { b = 0; rs[0].w = Math.max(0.5, (S - g1 * lead) / 12); }
  const tryB = (nb: number): void => { if (b >= 1 && nb > b && cost(nb) <= S + 1e-6) b = nb; };
  const refine = (r: number, wLeast = 0): void => {
    for (;;) {
      const i = GROUPINGS.indexOf(rs[r].grouping);
      if (i <= 0) return;
      const was = { ...rs[r] };
      rs[r].grouping = GROUPINGS[i - 1];
      rs[r].w = Math.max(rs[r].w, R.wMin[rs[r].grouping], wLeast);
      if (!fits()) { rs[r] = was; return; }
    }
  };
  /** every round in `which` grows its wheels' time together, up to `cap` s */
  const growW = (cap: number, which: number[] = rs.map((_, i) => i)): void => {
    const live = which.filter(i => rs[i].w < cap);
    if (!live.length) return;
    const left = S - cost();
    if (left <= 1e-9) return;
    const add = Math.min(left / (12 * live.length), ...live.map(i => cap - rs[i].w));
    for (const i of live) rs[i].w += add;
  };
  const addRound = (round: 2 | 3): boolean => {
    const last = rs[rs.length - 1];
    if (last.grouping !== 12) return false;
    rs.push({ round, grouping: 7, w: R.wRound });
    if (!fits()) { rs.pop(); return false; }
    refine(rs.length - 1, R.wRound);
    return true;
  };
  refine(0);
  growW(8, [0]);
  tryB(2);
  refine(0);
  growW(15, [0]);
  refine(0);
  tryB(3);
  growW(25, [0]);
  if (addRound(2)) {
    growW(25, [1]);
    if (addRound(3)) growW(25, [2]);
  }
  growW(35);
  tryB(4);
  growW(45);
  tryB(5);
  // what is left: the field takes it (planFor), and the sim's re-fit gives the pushes the rest
  return { rounds: rs.map(r => ({ ...r, steps: stepsFor(r.round, r.w) })), b };
}

/**
 * The player's own rhythm: pushes of `P` s and rests of `rb` breaths, as many as fit; the twelve in as many pushes as
 * that allows (each wheel, each centre, or centres together), further rounds when more pushes fit; time left over
 * goes to the field.  Too short for even one push and rest: one push for all, a rest of one breath.
 */
function customRounds(S: number, lead: number, cyc: number, P: number, rb: number): { rounds: RoundPlan[]; b: number } {
  let b = rb;
  let n = Math.floor(S / (P + b * cyc));
  if (n < 1) {
    b = 1;
    n = Math.max(1, Math.floor(S / (P + cyc)));
  }
  const rs: RoundPlan[] = [];
  const largest = (k: number, of: readonly Grouping[]): Grouping | null => of.find(g => g <= k) ?? null;
  const g1 = largest(n, GROUPINGS) ?? 1;
  rs.push({ round: 1, grouping: g1, w: 0, steps: 0 });
  n -= g1;
  if (g1 === 12) {
    const g2 = largest(n, [12, 7]);
    if (g2) {
      rs.push({ round: 2, grouping: g2, w: 0, steps: 0 });
      n -= g2;
      const g3 = g2 === 12 ? largest(n, [12, 7]) : null;
      if (g3) rs.push({ round: 3, grouping: g3, w: 0, steps: 0 });
    }
  }
  // each push about the player's length: a group of the average size takes P (its lead-in included)
  const total = rs.reduce((s, r) => s + r.grouping, 0);
  const fitP = Math.min(P, Math.max(lead + 1, (S - total * b * cyc) / total));
  for (const r of rs) {
    r.w = Math.max(0.5, ((fitP - lead) * r.grouping) / 12);
    r.steps = stepsFor(r.round, r.w);
  }
  return { rounds: rs, b };
}

/** The rest a session of `sec` keeps for the player's dials (whole breaths): the lobby's `restIn`. */
export function restInFor(focus: number, rest: number, sec: number, cyc: number): number {
  return planFor({ plannedSec: sec, cyc, eeg: false, focus, rest, custom: true }).breaths;
}
