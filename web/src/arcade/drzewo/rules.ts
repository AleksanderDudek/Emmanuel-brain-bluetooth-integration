/**
 * Every number of Drzewo nad wodą's rules in one place (DESIGN.md §18): what focus grows and how fast, the blocks,
 * the rests of whole breaths, the plan that fits the whole arc — posture, roots, water, tree, fruits, wind, close —
 * into any session from 3 to 30 minutes, the voice and the cards.  Tuning moves a number here and nowhere else; the
 * tests read the same object.
 *
 * Light only from real focus (the series' first rule): a station grows only in a sighted push past its lead-in, with
 * a reliable signal, while `frame.focused`, at `focusRate` focus-seconds a second (1 at the threshold, up to 1.5 in a
 * strong, held focus).  A station needs `need` focus-seconds.  Nothing grows in rest, the posture, the finale,
 * without a signal, below the threshold or from taps; what has grown stays.
 */
import { breathCycle, breathRest, type BreathPattern } from '../kit/breath';

export const RULES = {
  // ── growth ───────────────────────────────────────────────────
  /** focus-seconds a second while focused: base + levelK · level + holdK · min(1, hold / holdFull) */
  rateBase: 0.75,
  levelK: 0.5,
  holdK: 0.25,
  holdFull: 20,
  /** the light shown while the brain drives nothing (the posture, the lead-in, a blind block, no signal), and in rest */
  baseLight: 0.45,
  restLight: 0.3,
  lightTau: 0.8,
  /** a blind block's unseen growth is shown at its end over this long (s) */
  revealSec: 1.6,

  // ── the blocks ───────────────────────────────────────────────
  /** the lead-in before the brain acts in a push (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a push lasts at least this long: a station full sooner flows on into the next in the same push (s) */
  minPush: 12,
  /** a push under this is not judged (s) */
  judgeMin: 10,
  /** telegraphs: 4 s ahead; the rest is announced when a sighted station is this full */
  telegraph: 4,
  telegraphFill: 0.85,
  /** the safety valve: this long without any growth, or this long in all under telegraphFill, gives way to a rest (s) */
  valveStall: 60,
  valveSec: 150,
  /** the runner's banner covers the first seconds of a block: the narrator waits it out */
  bannerSec: 5,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session (never a session's first) */
  blindEvery: 4,
  blindFrom: 3,
  /** the quiet finale with the closing card (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 6,
  /** the growth running this long (s) before the narrator says so; a sighted push this long without growth: how it grows (once) */
  goodSec: 5,
  waitSec: 9,
  /** every repeatEvery-th push asks for the slow repetition of the prayer */
  repeatEvery: 3,
  /** a rest begins no later than this many seconds before the reserved end, or the wind rest comes instead of a push */
  windLead: 10,

  // ── the plan's average player (planFor) ─────────────────────
  /** focus-seconds a second an average player gathers past the lead-in (~70 % of the time focused, a little above the threshold) */
  avgRate: 0.75,
  /** the share of the free time the planned arc takes for that player (the rest of it: more fruit, or slack) */
  avgShare: 0.88,
  /** what a station needs (focus-seconds): bounds for a real session and for a test of under two minutes */
  needMin: 8,
  needMax: 40,
  tinyNeed: 2.5,

  // ── the hands, the cards, the voice ─────────────────────────
  /** a line shown again by a tap glows this long (s); a fruit's card stays its reading time, a tap adds this much */
  reshowSec: 2.4,
  cardMore: 3,
  /** a story card's page closes itself after its reading time (at least pageSec); a tap turns it after tapAfter */
  pageSec: 9,
  tapAfter: 0.6,
  /** reading time: readSec + readPerChar × characters, at least readMin (the round-11 clarity rule) */
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 2.6,
  hintGap: 1.2,
  /** the picker closes itself after this long untouched (s) */
  pickerIdle: 20,
  /** at most this many fruits of a kind hang on the tree in one session (more are counted, not drawn) */
  perKind: 3,
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
 * smoke): seconds a posture cue lasts; the soil's layers on screen and the root stations through them; the trunk
 * stations (1: trunk, branches and crown in one; 2: the trunk, then the branches and the crown; 3: each its own);
 * the steps of a fruit (2: the blossom sets, then it ripens — with a second reflection); the fruits the plan is
 * paced for; the rest's target (s); extra breaths for the water and the wind.
 */
interface Row { upTo: number; cue: number; layers: number; roots: number; trunk: number; steps: 1 | 2; fruits: number; rest: number; extra: number }
const TABLE: readonly Row[] = [
  { upTo: 119, cue: 1, layers: 2, roots: 1, trunk: 1, steps: 1, fruits: 2, rest: 8, extra: 0 },
  { upTo: 239, cue: 6, layers: 2, roots: 1, trunk: 1, steps: 1, fruits: 3, rest: 10, extra: 0 },
  { upTo: 449, cue: 7, layers: 3, roots: 2, trunk: 1, steps: 1, fruits: 5, rest: 10, extra: 0 },
  { upTo: 749, cue: 8, layers: 4, roots: 2, trunk: 2, steps: 1, fruits: 9, rest: 20, extra: 1 },
  { upTo: 1049, cue: 9, layers: 5, roots: 3, trunk: 3, steps: 1, fruits: 9, rest: 26, extra: 1 },
  { upTo: 1349, cue: 10, layers: 5, roots: 4, trunk: 3, steps: 2, fruits: 9, rest: 20, extra: 1 },
  { upTo: 1649, cue: 10, layers: 6, roots: 5, trunk: 3, steps: 2, fruits: 9, rest: 26, extra: 1 },
  { upTo: Infinity, cue: 10, layers: 6, roots: 6, trunk: 3, steps: 2, fruits: 9, rest: 30, extra: 1 },
];

export interface Plan {
  plannedSec: number;
  /** one posture cue (s); three of them */
  cueSec: number;
  /** soil layers on screen, root stations, trunk stations */
  layers: number;
  roots: number;
  trunk: number;
  /** pushes a fruit takes (1, or 2: blossom → ripe) and the fruits the plan is paced for */
  steps: 1 | 2;
  fruits: number;
  /** what each station needs (focus-seconds): a root station, a trunk station, one step of a fruit */
  needRoot: number;
  needTrunk: number;
  needFruit: number;
  /** a rest of whole breaths; the water's and the wind's take `extra` breaths more */
  restCycles: number;
  restSec: number;
  extra: number;
  cycleSec: number;
  /** the wind's rest (s) and the finale (s): the end reserved for them */
  windSec: number;
  finaleSec: number;
  /** the lead-in of a push (s) */
  lead: number;
}

export const rowFor = (plannedSec: number): Row => TABLE.find(r => plannedSec <= r.upTo) ?? TABLE[TABLE.length - 1];

/**
 * The plan for a session: the shape from the table, and what each station needs so that an average player
 * (RULES.avgRate focus-seconds a second past the lead-in) completes the planned arc at about RULES.avgShare of the
 * time left after the posture, the lead-ins, the rests, the wind and the finale — so the arc ends near the end at
 * any length, never at 40 %.  A stronger player ripens more fruit; a weaker one fewer; the wind and the close always
 * come at the end.
 */
export function planFor(plannedSec: number, pattern: BreathPattern, eeg = false): Plan {
  const T = Math.max(10, plannedSec);
  const r = rowFor(T);
  const R = RULES;
  const lead = eeg ? R.leadIn.eeg : R.leadIn.fnirs;
  const rest = breathRest(pattern, r.rest, Math.min(8, r.rest));
  const cyc = breathCycle(pattern) > 0 ? rest.sec / rest.cycles : 10;
  const windSec = rest.sec + r.extra * cyc;
  const finaleSec = finaleFor(T);
  const stations = r.roots + r.trunk + r.fruits * r.steps;
  // the rests between stations (the last fruit's rest is the wind's), the water's extra breaths
  const fixed = 3 * r.cue + finaleSec + windSec + (stations - 1) * rest.sec + r.extra * cyc + stations * lead;
  const free = Math.max(0, T - fixed) * R.avgShare * R.avgRate;
  const wRoot = 1.3, wTrunk = 1.2, wFruit = r.steps === 2 ? 0.6 : 0.9;
  const unit = free / (r.roots * wRoot + r.trunk * wTrunk + r.fruits * r.steps * wFruit);
  const tiny = T < 120;
  const bound = (v: number) => (tiny ? R.tinyNeed : Math.max(R.needMin, Math.min(R.needMax, v)));
  return {
    plannedSec: T, cueSec: r.cue, layers: r.layers, roots: r.roots, trunk: r.trunk, steps: r.steps, fruits: r.fruits,
    needRoot: bound(unit * wRoot), needTrunk: bound(unit * wTrunk), needFruit: bound(unit * wFruit),
    restCycles: rest.cycles, restSec: rest.sec, extra: r.extra, cycleSec: cyc, windSec, finaleSec, lead,
  };
}
