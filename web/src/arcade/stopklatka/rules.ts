/**
 * Every number of Stop-klatka in one place and the session's plan (DESIGN.md §28), pure and deterministic.
 *
 * A session tells stories of the chosen age group one after another over its length T (3–60 minutes, or a test of a
 * minute or less):
 *
 *   intro     the title and the root passage (a first-ever session: the opening pages and, when the lobby was not
 *             touched, the age group asked on the card)                                                       free
 *   stories   one after another, each a slot of three blocks:
 *               tell     the beats through the eyes, each at the reading pace (≈ 15 characters a second + 1.5 s;
 *                        a tap goes on) — the band rests                                                      rest
 *               freeze   the stop-frame, F s (20–60, the founder's bounds): the camera steps out of the eyes, the
 *                        breath, the clarity focus charges, the feeling named, a second look, the choice       push
 *               after    back through the eyes: the answer (or the step away first), the outcome, then the lesson
 *                        with whole breaths of 4 · 0 · 6 · 0 until the slot ends                              rest
 *   close     the session's feelings named, its lessons, the closing passage                                 free
 *
 * Every story's slot has a planned start and end from its own texts (its beats at the reading pace), so the session
 * always ends at T: what the stories leave goes to the lessons' rests (most) and the close.  The freeze grows with the
 * session's length and the player's sessions (first sessions near 20 s, long ones up to 60 — `freezeFor`); a player
 * who moved the lobby's dials keeps theirs.  A tap on the tell's last beat may start the freeze early: it is then
 * longer, never past FREEZE_MAX (`freezeStartMin`).
 *
 * Only real focus charges the clarity (§18.3–18.4): in a sighted freeze past its lead-in, with a reliable signal,
 * while focused, at `focusRate` (the level averaged over one whole breath).  The work is fitted to the player's
 * learned pace (§24.4b): a freeze asks `FILL` of what their pace gives in its sighted seconds.
 */
import { clamp } from '../kit/juice';
import { FREEZE_MAX, FREEZE_MIN, type Story } from './story';

export const RULES = {
  // ── the brain ──────────────────────────────────────────────────
  /** the lead-in of a freeze before the brain acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** focus-seconds a sighted second for a player whose pace is not learned yet */
  pace0: 0.5,
  /** a learned pace stays in this range */
  paceMin: 0.25,
  paceMax: 1.2,
  /** how much a new session's pace moves the learned one (0..1); the session's own pace counts after this many s */
  paceKeep: 0.5,
  paceMinSec: 10,
  /** within a session the measured pace weighs s / (s + paceBlendSec) against the learned one */
  paceBlendSec: 60,
  /** a freeze asks this share of what the pace gives in its sighted seconds (the work fits the session, §24.4b) */
  fill: 0.85,
  /** the rate's shape: (lo + k × above) × (holdLo + holdK × min(1, hold / holdFull)); `above` = (mean − 0.5) / 0.5 */
  focusLo: 0.7,
  focusK: 0.6,
  holdLo: 0.85,
  holdK: 0.3,
  holdFull: 12,
  /** the level the rate reads is averaged over one whole breath (s, §18.4) */
  meanSec: 10,
  /** what is shown follows the truth with this time constant (s) */
  showTau: 0.9,
  /** a first-ever session's first freeze asks this share */
  firstNeed: 0.7,
  /** a test session's freeze asks this share (app:smoke plays 40 s at half focus and must score) */
  testNeed: 0.4,

  // ── reading ────────────────────────────────────────────────────
  /** a beat stays for 1.5 s + its characters at 15 a second, within these bounds (s) */
  readBase: 1.5,
  readCps: 15,
  beatMin: 4.5,
  beatMax: 18,
  /** the story's first beat carries its title this much longer (s) */
  titleSec: 2,

  // ── the freeze (the push) ─────────────────────────────────────
  /** by design: the freeze for a session of T s … */
  freezeByT: [[0, 20], [300, 24], [600, 30], [900, 35], [1200, 40], [1500, 45], [1800, 50], [2700, 55], [3600, 60]] as readonly (readonly [number, number])[],
  /** … and at most this for a player with this many sessions behind them (first sessions nearer 20 s) */
  freezeByExp: [[0, 22], [1, 25], [2, 30], [3, 35], [5, 45], [8, 50], [13, 60]] as readonly (readonly [number, number])[],
  /** the freeze's inner clock (s from its start): the flash, the drain to a cool still, the camera stepping out */
  flashSec: 0.6,
  drainSec: 1.2,
  stepOutSec: 2.8,
  /** the trigger shows from, the urge from (s) */
  triggerAt: 0.4,
  urgeAt: 1.6,
  /** the stop step lasts at least this (s), else the lead-in */
  stopMin: 3.2,
  /** the feelings come this long after the stop step (s, at most a share of the freeze) */
  nameAfter: 4,
  nameShare: 0.15,
  /** the likeliest is named for the player this long after the feelings came (s, at least a share of the freeze) */
  autoName: 6,
  autoNameShare: 0.22,
  /** a second look's lines unlock at these clarities (2 lines, 3 lines) */
  secondAt2: [0.4, 0.75] as readonly number[],
  secondAt3: [0.3, 0.55, 0.8] as readonly number[],
  /** the choice comes once the clarity is full and every line is shown (+ s), or at the latest this share / s before the end */
  chooseAfter: 1.5,
  chooseLateShare: 0.2,
  chooseLateSec: 5,
  /** the lines still locked show (dim) this long before the choice comes at the latest (s) */
  lateLines: 1.5,
  /** the rhythm dials (kit/rhythm.ts): the freeze's seconds, the lesson's whole breaths */
  focus: { def: 30, min: FREEZE_MIN, max: FREEZE_MAX, step: 5 },
  rest: { def: 2, min: 1, max: 4 },
  /** by design: the lesson's breaths for a session of T s */
  breathsByT: [[0, 1], [600, 2], [2700, 3]] as readonly (readonly [number, number])[],
  /** the breath of every rest: 4 · 0 · 6 · 0 — one whole breath (s) */
  cyc: 10,

  // ── the session ────────────────────────────────────────────────
  intro: { share: 0.04, min: 8, max: 18 },
  /** a first-ever session's opening pages (s each), the age asked on the card (s) */
  openSec: 5.5,
  openMax: 4,
  askSec: 12,
  /** the opening pages and the age card come in sessions from this long (s) */
  openFrom: 170,
  close: { share: 0.05, min: 14, max: 40 },
  /** what the stories leave goes this share to the lessons' rests, the rest to the close */
  spareToRest: 0.75,
  /** at most this many stories in a session */
  storiesMax: 40,

  // ── a test session (≤ testSec: app:smoke plays 40 s and must score) ──
  testSec: 60,
  test: { intro: 0.05, close: 0.07, freeze: 0.5, freezeMax: 20, freezeMin: 8, tell: 0.4 },

  // ── words on screen ────────────────────────────────────────────
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  hintGap: 1.2,
  telegraph: 3,
} as const;

/** How long a coach mark stays to be read twice (s): ≥ 2.5 s + 70 ms a character. */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

/** How long a beat of `chars` characters stays (s): 1.5 s + 15 characters a second, within the beat's bounds. */
export const beatSec = (chars: number): number => clamp(RULES.readBase + Math.max(0, chars) / RULES.readCps, RULES.beatMin, RULES.beatMax);

const len = (s?: string): number => (s ? [...s].length : 0);

export const leadOf = (eeg: boolean): number => (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs);
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

/**
 * How fast the clarity charges a second, in focus-seconds: only while focused, faster above the threshold (the level
 * averaged over a whole breath) and as a focused stretch is held.  (The sim calls it only in a sighted freeze with a
 * reliable signal.)
 */
export function focusRate(meanLevel: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = clamp((fin(meanLevel, 0.5) - 0.5) / 0.5);
  return (R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, fin(hold, 0)) / R.holdFull));
}

/** A pace kept in range (the unlearned one when absent). */
export const cleanPace = (v: unknown): number =>
  (typeof v === 'number' && Number.isFinite(v) && v > 0 ? clamp(v, RULES.paceMin, RULES.paceMax) : 0);

/** Focus-seconds a freeze of `freeze` s asks at `pace` (before the first-ever / test shares). */
export const needFor = (freeze: number, lead: number, pace: number): number =>
  Math.max(0.5, (cleanPace(pace) || RULES.pace0) * Math.max(1, freeze - lead) * RULES.fill);

/** A table's value at `x` (the last row whose key `x` reaches; `tol` forgives a second's rounding). */
const step = (table: readonly (readonly [number, number])[], x: number, tol = 0): number => {
  let v = table[0][1];
  for (const [k, val] of table) if (x >= k - tol) v = val;
  return v;
};

/** The design's freeze (s) for a session of T s and a player with `sessions` sessions behind them. */
export const freezeFor = (T: number, sessions: number): number =>
  clamp(Math.min(step(RULES.freezeByT, T, 1), step(RULES.freezeByExp, Math.max(0, Math.floor(sessions)))), FREEZE_MIN, FREEZE_MAX);

/** The design's lesson breaths for a session of T s. */
export const breathsFor = (T: number): number => step(RULES.breathsByT, T, 1);

/** A dial's value in range (the design's when absent). */
export const dialFreeze = (v: number | null | undefined): number => {
  const F = RULES.focus;
  return clamp(Math.round(fin(v ?? F.def, F.def) / F.step) * F.step, F.min, F.max);
};
export const dialBreaths = (v: number | null | undefined): number => {
  const R = RULES.rest;
  return clamp(Math.round(fin(v ?? R.def, R.def)), R.min, R.max);
};

export type BlockKind = 'rest' | 'push' | 'free';
export type BlockWhat = 'intro' | 'tell' | 'freeze' | 'after' | 'close';

/** One block of the schedule: planned start and end (s of play), and the story slot it belongs to (−1: none). */
export interface PlanBlock { kind: BlockKind; what: BlockWhat; t0: number; t1: number; slot: number }

/** A story's slot: its story, which telling this is in the session, and its planned parts. */
export interface SlotPlan {
  slot: number;
  id: string;
  /** 0: the first telling this session; 1, 2…: told again (the freeze then offers the other way first) */
  round: number;
  /** the tell's beats (s each, the title in the first) and the beats told (a compact slot keeps only the last ones) */
  beats: number[];
  from: number;
  /** the after's parts at the reading pace (s): the answer, the step away, the outcome, the lesson */
  answer: number;
  away: number;
  outcome: number;
  lesson: number;
  /** the lesson's whole breaths by design (the after's rest holds at least these) */
  breaths: number;
  /** the planned times: the slot's start, the tell's end (the freeze's planned start), the freeze's end, the slot's end */
  t0: number;
  tellEnd: number;
  freezeEnd: number;
  t1: number;
}

export interface PlanOpts {
  plannedSec: number;
  eeg: boolean;
  /** the stories a session may tell, in order, and where this session begins in them */
  order: readonly Story[];
  start?: number;
  /** the player's sessions so far (the freeze grows with them) */
  sessions?: number;
  /** the rhythm: the freeze's seconds and the lesson's breaths (null: the design) */
  focus?: number | null;
  rest?: number | null;
  custom?: boolean;
  /** a first-ever session: the opening pages (how many), and the age asked on the card */
  open?: number;
  ask?: boolean;
  /** the words of the step away (its length sets its beat) */
  awayChars?: number;
}

export interface Plan {
  T: number;
  lead: number;
  cyc: number;
  test: boolean;
  /** the freeze by design (each slot's may be longer after a tap on the tell's last beat) */
  freeze: number;
  breaths: number;
  introEnd: number;
  /** the opening pages' end, the age card's end (both = 0 when none) */
  openEnd: number;
  askEnd: number;
  closeStart: number;
  slots: SlotPlan[];
  blocks: PlanBlock[];
}

/** The after's parts of a story at the reading pace. */
function afterParts(s: Story, awayChars: number): { answer: number; away: number; outcome: number; lesson: number } {
  return {
    answer: beatSec(len(s.answer) + len(s.answerSay)),
    away: beatSec(awayChars),
    outcome: beatSec(len(s.outcome.text) + len(s.outcome.say) + len(s.outcome.screen)),
    lesson: beatSec(len(s.lesson)),
  };
}

/** The tell's beats of a story at the reading pace (the title rides on the first). */
export const tellBeats = (s: Story): number[] =>
  s.beats.map((b, i) => beatSec(len(b.text) + len(b.say) + len(b.screen)) + (i === 0 ? RULES.titleSec : 0));

/** The longest the after takes before its lesson rest: the step away first, then the answer and the outcome. */
const afterPath = (p: { answer: number; away: number; outcome: number }): number => p.away + p.answer + p.outcome;

/** The session's plan (see the module's comment). */
export function planFor(o: PlanOpts): Plan {
  const R = RULES;
  const T = Math.max(10, fin(o.plannedSec, 300));
  const test = T <= R.testSec;
  const cyc = R.cyc;
  const lead = leadOf(o.eeg);
  const order = o.order;
  const start = Math.max(0, Math.floor(fin(o.start ?? 0, 0)));
  const awayChars = Math.max(0, fin(o.awayChars ?? 90, 90));
  const custom = !!o.custom;
  const F0 = custom ? dialFreeze(o.focus) : freezeFor(T, fin(o.sessions ?? 0, 0));
  const B0 = custom ? dialBreaths(o.rest) : breathsFor(T);
  const slots: SlotPlan[] = [];
  let intro: number, openEnd = 0, askEnd = 0, close: number, F = F0, breaths = B0;

  if (!order.length) {
    // no story to tell (never in the app: every group has its stories): the intro and the close share the session
    intro = T * 0.5;
    close = T - intro;
  } else if (test) {
    intro = Math.max(1.5, T * R.test.intro);
    close = Math.max(2, T * R.test.close);
    F = clamp(T * R.test.freeze, R.test.freezeMin, R.test.freezeMax);
    const rest = Math.max(2, T - intro - close - F);
    const s = order[start % order.length];
    const tell = rest * R.test.tell;
    const p = afterParts(s, awayChars);
    slots.push({
      slot: 0, id: s.id, round: 0, beats: [tell], from: s.beats.length - 1, ...p, breaths: 0,
      t0: intro, tellEnd: intro + tell, freezeEnd: intro + tell + F, t1: intro + rest + F,
    });
    breaths = 0;
  } else {
    // the first session's opening pages and the age card need a session of 3 minutes or more (a shorter trainingSec
    // keeps its time for the story)
    const roomy = T >= R.openFrom;
    const open = roomy ? Math.max(0, Math.min(R.openMax, Math.floor(fin(o.open ?? 0, 0)))) : 0;
    const base = clamp(T * R.intro.share, R.intro.min, R.intro.max);
    openEnd = open ? open * R.openSec : 0;
    askEnd = o.ask && roomy ? openEnd + R.askSec : 0;
    intro = Math.max(openEnd, askEnd) + base;
    const close0 = clamp(T * R.close.share, R.close.min, R.close.max);
    const avail = T - intro - close0;
    let used = 0;
    /** each slot's natural length (its tell, the freeze, the longest after with the lesson's breaths) */
    const lens: number[] = [];
    const lessonRest = (p: { lesson: number }, b: number): number => Math.max(p.lesson, b * cyc);
    for (let k = 0; k < R.storiesMax; k++) {
      const s = order[(start + k) % order.length];
      const beats = tellBeats(s);
      const p = afterParts(s, awayChars);
      const tell = beats.reduce((a, b) => a + b, 0);
      const len1 = tell + F + afterPath(p) + lessonRest(p, breaths);
      if (used + len1 > avail + 1e-6) break;
      slots.push({ slot: k, id: s.id, round: Math.floor(k / order.length), beats, from: 0, ...p, breaths, t0: 0, tellEnd: 0, freezeEnd: 0, t1: 0 });
      lens.push(len1);
      used += len1;
    }
    if (!slots.length) {
      // a session too short for a whole story (only a trainingSec between a test and 3 minutes): one compact story —
      // the freeze a share, the tell its last beats that fit (scaled to 30 %), the after what is left
      const s = order[start % order.length];
      F = clamp(avail * 0.4, Math.min(FREEZE_MIN, avail * 0.4), F0);
      const all = tellBeats(s);
      let from = all.length - 1, sum = all[from];
      while (from > 0 && sum + all[from - 1] <= avail * 0.3) sum += all[--from];
      const k = Math.min(1, (avail * 0.3) / sum);
      breaths = 1;
      slots.push({ slot: 0, id: s.id, round: 0, beats: all.slice(from).map(b => b * k), from, ...afterParts(s, awayChars), breaths, t0: 0, tellEnd: 0, freezeEnd: 0, t1: 0 });
      lens.push(avail);
      used = avail;
    }
    // what the stories leave: most to the lessons' rests, the rest to the close
    const spare = Math.max(0, avail - used);
    const perSlot = (spare * R.spareToRest) / slots.length;
    close = close0 + spare - perSlot * slots.length;
    // the slots' times
    let t = intro;
    slots.forEach((sl, i) => {
      sl.t0 = t;
      sl.tellEnd = t + sl.beats.reduce((a, b) => a + b, 0);
      sl.freezeEnd = sl.tellEnd + F;
      sl.t1 = t + lens[i] + perSlot;
      t = sl.t1;
    });
  }

  // the schedule
  const blocks: PlanBlock[] = [];
  const add = (kind: BlockKind, what: BlockWhat, t0: number, t1: number, slot = -1): void => {
    if (t1 - t0 > 1e-9) blocks.push({ kind, what, t0, t1, slot });
  };
  add('free', 'intro', 0, intro);
  for (const sl of slots) {
    add('rest', 'tell', sl.t0, sl.tellEnd, sl.slot);
    add('push', 'freeze', sl.tellEnd, sl.freezeEnd, sl.slot);
    add('rest', 'after', sl.freezeEnd, sl.t1, sl.slot);
  }
  const closeStart = slots.length ? slots[slots.length - 1].t1 : intro;
  add('free', 'close', closeStart, T);
  void close;
  return { T, lead, cyc, test, freeze: F, breaths, introEnd: intro, openEnd, askEnd, closeStart, slots, blocks };
}

/**
 * The earliest a slot's freeze may start after a tap on the tell's last beat: the freeze then lasts to its planned end,
 * never past FREEZE_MAX (a test's never past its own).
 */
export const freezeStartMin = (sl: SlotPlan): number => Math.max(sl.t0, sl.freezeEnd - FREEZE_MAX);

/** The freeze's inner moments for a freeze of `F` s with a lead-in of `lead` s (s from its start). */
export function freezeMoments(F: number, lead: number): { stopEnd: number; nameAt: number; autoNameAt: number; chooseLate: number } {
  const R = RULES;
  const stopEnd = Math.min(Math.max(lead, R.stopMin), F * 0.3);
  const nameAt = stopEnd + Math.min(R.nameAfter, F * R.nameShare);
  const chooseLate = Math.max(nameAt + 2, F - Math.max(R.chooseLateSec, F * R.chooseLateShare));
  const autoNameAt = Math.min(nameAt + Math.max(R.autoName, F * R.autoNameShare), chooseLate - 1);
  return { stopEnd, nameAt, autoNameAt: Math.max(nameAt + 1, autoNameAt), chooseLate };
}

/** The clarities at which a second look's `n` lines unlock. */
export const secondAt = (n: number): readonly number[] =>
  n <= 1 ? [0.5] : n === 2 ? RULES.secondAt2 : n === 3 ? RULES.secondAt3 : Array.from({ length: n }, (_, i) => 0.25 + (0.6 * i) / (n - 1));

/** The lesson rest the player's dials keep in a session of `sec` s (whole breaths): the lobby's `restIn`. */
export function restInFor(focus: number, rest: number, sec: number, order: readonly Story[]): number {
  return planFor({ plannedSec: sec, eeg: false, focus, rest, custom: true, order }).breaths;
}
