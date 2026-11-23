/**
 * Every number of Każda myśl's rules in one place (DESIGN.md §19): what focus burns and how fast, the blocks, the
 * rests of whole breaths, the plan that fits the whole arc — the settling, the thoughts in pushes of the player's
 * rhythm, the last rest, the quiet with the point alone, the close — into any session from 3 to 30 minutes, the
 * voice and the cards.  Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * Light only from real focus (the heart series' first rule, §18): a thought burns only in a sighted push, past its
 * lead-in, once it has drifted to the ring, with a reliable signal, while `frame.focused`, at `focusRate`
 * focus-seconds a second (1 at the threshold, up to 1.5 in a strong, held focus).  A thought needs `need`
 * focus-seconds.  Nothing burns in rest, the settling, the finale, without a signal, below the threshold or from
 * taps; what has burned stays burned.
 */
import { breathCycle, type BreathPattern } from '../kit/breath';

export const RULES = {
  // ── burning ──────────────────────────────────────────────────
  /** focus-seconds a second while focused: base + levelK · level + holdK · min(1, hold / holdFull) */
  rateBase: 0.75,
  levelK: 0.5,
  holdK: 0.25,
  holdFull: 20,
  /** the flame's light while the brain drives nothing (the settling, the lead-in, a blind block, no signal), and in rest */
  baseLight: 0.42,
  restLight: 0.3,
  lightTau: 0.8,
  /** the warm ring reaches the waiting thought only while focus holds; it eases out and back this fast (s) */
  ringTau: 0.7,
  /** a blind block's unseen burning is shown at its end over this long (s) */
  revealSec: 1.6,

  // ── the thoughts ─────────────────────────────────────────────
  /** a thought drifts in from the dark to the ring this long (s) — not gated, nothing burns meanwhile */
  arriveSec: 2.5,
  /** a thought set aside ("nie moja") drifts back out this long (s) */
  leaveSec: 1.2,
  /** the library thoughts burned last time go to the back of the next session's queue (at most this many kept) */
  recentMax: 24,
  /** "nie moja": at most this many library thoughts set aside for good */
  skipMax: 40,
  /** the before/after history kept (entries) */
  historyMax: 30,

  // ── the blocks ───────────────────────────────────────────────
  /** the lead-in before the brain acts in a push (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a push lasts at least this long: its thoughts burned sooner, the next one comes in the same push (s) */
  minPush: 12,
  /** a push under this is not judged (s) */
  judgeMin: 10,
  /** telegraphs: 4 s ahead; the rest is announced when the push's last thought is this far burned */
  telegraph: 4,
  telegraphFill: 0.85,
  /** the safety valve: this long without any burning, or this long in all under telegraphFill, gives way to a rest (s) */
  valveStall: 60,
  valveSec: 150,
  /** the runner's banner covers the first seconds of a block: the narrator waits it out */
  bannerSec: 5,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session (never a session's first) */
  blindEvery: 4,
  blindFrom: 3,
  /** the close with its card and the "how heavy now" row (s): sessions of 2 min and more / shorter */
  finale: { long: 16, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 6,
  /** the burning running this long (s) before the narrator says so; a sighted push this long without it: how it burns (once) */
  goodSec: 5,
  waitSec: 9,
  /** a rest begins no later than this many seconds before the reserved end, or the last rest comes instead of a push */
  lastLead: 10,
  /** the last rest ("the ash settles") is this many breaths longer than the others */
  lastExtra: 1,

  // ── the rhythm (the lobby's dials, kit/rhythm.ts) ────────────
  /** thoughts burned before a rest: the designed default and the range */
  focus: { def: 3, min: 1, max: 6 },
  /** whole breaths in a rest: the designed default and the range */
  rest: { def: 2, min: 1, max: 6 },
  /** what a thought typically needs (focus-seconds), for the lobby's count of rests */
  typicalNeed: 12,

  // ── the plan's average player (planFor) ─────────────────────
  /** focus-seconds a second an average player gathers past the lead-in (~70 % of the time focused, a little above the threshold) */
  avgRate: 0.75,
  /** the share of the free time the planned thoughts take for that player (the rest of it: more thoughts, or slack) */
  avgShare: 0.88,
  /** what a thought needs (focus-seconds): bounds for a real session and for a test of under two minutes */
  needMin: 6,
  needMax: 30,
  tinyNeed: 2.5,

  // ── the hands, the cards, the voice ─────────────────────────
  /** a line shown again by a tap glows this long (s) */
  reshowSec: 2.4,
  /** a story card's page closes itself after its reading time (at least pageSec); a tap turns it after tapAfter */
  pageSec: 9,
  tapAfter: 0.6,
  /** reading time: readSec + readPerChar × characters, at least readMin (the round-11 clarity rule) */
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 2.6,
  hintGap: 1.2,
  /** the golden lights drawn round the point at most (more are counted, and the crown glows brighter) */
  lightsDrawn: 24,
} as const;

/** How long a line of `text` stays on screen to be read twice (s). */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

/** Focus-seconds a second for a focus frame: only while focused; faster above the threshold and as the focus is held. */
export function focusRate(level: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const lv = Math.max(0, Math.min(1, level));
  return R.rateBase + R.levelK * lv + R.holdK * Math.min(1, Math.max(0, hold) / R.holdFull);
}

/** The finale's length for a session length. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

// ── the plan ─────────────────────────────────────────────────────

/**
 * The arc's shape by the session's length (DESIGN §17: 3–30 minutes; a session under two minutes is a test or the
 * smoke): seconds a settling cue lasts, the thoughts the plan is paced for, and the quiet stretch with the point
 * alone at the end (long sessions go deeper: more thoughts, more mixtures, and the quiet).
 */
interface Row { upTo: number; cue: number; thoughts: number; quiet: number }
const TABLE: readonly Row[] = [
  { upTo: 119, cue: 1, thoughts: 2, quiet: 0 },
  { upTo: 239, cue: 6, thoughts: 5, quiet: 0 },
  { upTo: 449, cue: 7, thoughts: 8, quiet: 0 },
  { upTo: 749, cue: 8, thoughts: 16, quiet: 30 },
  { upTo: 1049, cue: 9, thoughts: 22, quiet: 45 },
  { upTo: 1349, cue: 10, thoughts: 28, quiet: 60 },
  { upTo: 1649, cue: 10, thoughts: 34, quiet: 75 },
  { upTo: Infinity, cue: 10, thoughts: 40, quiet: 90 },
];

export const rowFor = (plannedSec: number): Row => TABLE.find(r => plannedSec <= r.upTo) ?? TABLE[TABLE.length - 1];

/** The player's rhythm in this game's units: thoughts before a rest, breaths in a rest (clamped; absent: the defaults). */
export interface MysliRhythm { focus: number; rest: number }
export function cleanRhythm(r: { focus?: unknown; rest?: unknown } | null | undefined): MysliRhythm {
  const pick = (v: unknown, d: { def: number; min: number; max: number }) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(d.min, Math.min(d.max, Math.round(v))) : d.def;
  return { focus: pick(r?.focus, RULES.focus), rest: pick(r?.rest, RULES.rest) };
}

export interface Plan {
  plannedSec: number;
  /** one settling cue (s); three of them */
  cueSec: number;
  /** the thoughts the plan is paced for, and how many burn in one push before a rest */
  thoughts: number;
  perPush: number;
  /** what one thought needs (focus-seconds) */
  need: number;
  /** a rest of whole breaths; the last rest (the ash settles) a breath longer */
  restCycles: number;
  restSec: number;
  lastCycles: number;
  lastSec: number;
  cycleSec: number;
  /** the quiet stretch with the point alone (s, 0: none) and the finale (s): the end reserved for them and the last rest */
  quietSec: number;
  finaleSec: number;
  /** the lead-in of a push (s) */
  lead: number;
}

/**
 * The plan for a session: the shape from the table, the player's rhythm, and what each thought needs so that an
 * average player (RULES.avgRate focus-seconds a second past the lead-in) burns the planned thoughts at about
 * RULES.avgShare of the time left after the settling, the lead-ins, the arrivals, the rests, the last rest, the
 * quiet and the finale — so the arc ends near the end at any length, never at 40 %.  A rhythm of many short pushes
 * and long rests plans fewer thoughts (each still needs at least RULES.needMin).  A stronger player burns more
 * thoughts (the queue goes on); a weaker one fewer; the last rest, the quiet and the close always come at the end.
 */
export function planFor(plannedSec: number, pattern: BreathPattern, rhythm: MysliRhythm, eeg = false): Plan {
  const T = Math.max(10, plannedSec);
  const r = rowFor(T);
  const R = RULES;
  const lead = eeg ? R.leadIn.eeg : R.leadIn.fnirs;
  const cyc = breathCycle(pattern) > 0 ? breathCycle(pattern) : 10;
  const rh = cleanRhythm(rhythm);
  const tiny = T < 120;
  // a test of under two minutes: one breath of rest, so the arc still fits
  const restCycles = tiny ? 1 : rh.rest;
  const lastCycles = tiny ? 1 : rh.rest + R.lastExtra;
  const restSec = restCycles * cyc, lastSec = lastCycles * cyc;
  const finaleSec = finaleFor(T);
  const N = rh.focus;
  // the focus-seconds the free time gives an average player for K thoughts (pushes of N, a rest between two)
  const freeFor = (K: number): number => {
    const pushes = Math.ceil(K / N);
    const fixed = 3 * r.cue + finaleSec + r.quiet + lastSec + (pushes - 1) * restSec + pushes * lead + (K - pushes) * R.arriveSec;
    return Math.max(0, T - fixed) * R.avgShare * R.avgRate;
  };
  // a rhythm of many short pushes and long rests leaves less time to burn in: fewer thoughts, each still worth its least
  let K = r.thoughts;
  while (!tiny && K > 2 && freeFor(K) / K < R.needMin) K--;
  const need = tiny ? R.tinyNeed : Math.max(R.needMin, Math.min(R.needMax, freeFor(K) / K));
  return {
    plannedSec: T, cueSec: r.cue, thoughts: K, perPush: N, need, restCycles, restSec, lastCycles, lastSec, cycleSec: cyc,
    quietSec: r.quiet, finaleSec, lead,
  };
}

/** Seconds a push of `n` thoughts typically takes (the lobby's count of rests): the lead-in, the arrivals, the burning. */
export const pushSecFor = (n: number, eeg = false): number =>
  (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs) + n * (RULES.typicalNeed / RULES.avgRate) + Math.max(0, n - 1) * RULES.arriveSec;
