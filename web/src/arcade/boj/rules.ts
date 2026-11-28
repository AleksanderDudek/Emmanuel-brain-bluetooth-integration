/**
 * Every number of Dobry bój in one place, the session's plan and the outcome of a move (DESIGN.md §25), pure and
 * deterministic.
 *
 * One session over its length T (3–30 minutes, or a test of a minute or less):
 *
 *   intro      the walk to the centre, touching gloves, the bell (a first-ever session: the story card too)
 *   fights     a fight is at most three rounds (the amateur rules); a round is exchanges, the corner between rounds.
 *              A fight is planned when it begins with the time left: three rounds when another fight still fits after
 *              it, else its rounds stretched to end at the session's last bell.  A fight that ends early (a knockout
 *              either way) with a minute or more left: its result, the corner, the walk-in, the next fight.
 *   exchange   read (a rest: whole breaths of 4 · 0 · 6 · 0) → sequence (real time, 1–4 s: a combination thrown at the
 *              player, or the opponent's opening) → slow motion (a push: the window of the rhythm's focus dial, 10–30 s;
 *              focus charges the energy; the move goes the moment it is full, or at the window's end with what was
 *              charged) → resolve (real time: the move and its answer).  An exchange begins only if it fits before the
 *              round's bell; else the read runs to the bell.
 *   end        the result, the embrace, the verse (and, after an early end, the corner in whole breaths first)
 *
 * Only real focus charges (§18.3–18.4): in a sighted push past its lead-in, with a reliable signal, while focused, at
 * `focusRate` (the level averaged over a few seconds).  The read and the corner are receptive: calm restores health.
 * Taps choose the move, never charge it.
 */
import { BREATH_DEFAULT, breathCycle } from '../kit/breath';
import { DEFAULT_DIFFICULTY, difficultyOf, type Difficulty } from '../kit/difficulty';
import { clamp } from '../kit/juice';
import { DEFENSES, STRIKES, answer, type DefenseId, type StrikeId } from './moves';

export const RULES = {
  // ── the brain ──────────────────────────────────────────────────
  /** the lead-in of a push block before the brain acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** focus-seconds a second past the lead-in for the average player (the plan's yardstick) */
  avgYield: 0.75,
  /** the average player fills the energy in this share of the window's sighted part */
  fill: 0.85,
  /** the rate's shape: (lo + k × above) × (holdLo + holdK × min(1, hold / holdFull)); `above` = (mean level − 0.5) / 0.5 */
  focusLo: 0.7,
  focusK: 0.6,
  holdLo: 0.85,
  holdK: 0.3,
  holdFull: 12,
  /** the level the rate reads is averaged over this long (s) */
  meanSec: 5,
  /** a first-ever session's first slow motion asks this share of the energy */
  firstNeed: 0.5,
  /** the gauge follows the pace with this time constant (s) */
  meterTau: 0.8,

  // ── the rhythm (kit/rhythm.ts): the slow motion's window (s), the read's whole breaths ──
  focus: { def: 20, min: 10, max: 30, step: 5 },
  rest: { def: 1, min: 1, max: 3 },
  /** the corner between rounds = the read's breaths + this many (a session under `shortSec`: `cornerPlusShort`) */
  cornerPlus: 2,
  cornerPlusShort: 1,
  shortSec: 600,
  /** in a session under `readCapSec` the read keeps at most `readCap` breaths (two exchanges still fit a round) */
  readCapSec: 300,
  readCap: 2,

  // ── the plan ───────────────────────────────────────────────────
  testSec: 60,
  /** the first walk-in (s): the usual, a first-ever session's (the story card), a test's; a later fight's walk-in */
  intro: { sec: 6, first: 9, test: 2.5 },
  walkSec: 4,
  /** the session's end (the result, the embrace, the verse) */
  end: { sec: 14, test: 5 },
  /** a fight's result in the middle of a session */
  fightEnd: { sec: 9, test: 4 },
  /** a round's length by session length (s → s; between two: the nearer below) */
  roundSec: [[0, 70], [300, 120], [600, 165], [900, 180]] as readonly (readonly [number, number])[],
  /** rounds in a fight (amateur rules), and the most the session's last fight may stretch to */
  maxRounds: 3,
  maxRoundsLast: 4,
  /** a new fight begins only with this much of the session left after its walk-in (s) */
  nextFightMin: 60,
  /** a test session (≤ testSec): the read (s), the longest window, no corner */
  test: { read: 3, window: 12, count: 8, foeCount: 4 },
  /** the shortest window the round's last exchange may shrink to (a test: the lead-in + `testWindowPast`) */
  minWindow: 10,
  testWindowPast: 4,
  /** the sequence: the step into range and the tell before the first strike (s); strikes run slower than life by `tempo` */
  seqStep: 0.6,
  seqTell: 0.3,
  tempo: 1.25,
  /** the opening's tell is held this long before the slow motion (s) */
  openHold: 0.9,
  /** what the plan keeps for a sequence and a resolve (s) */
  seqMax: 3,
  resolveMax: 3.4,
  /** the slow motion: the world's speed in it, the ease in and out (s), the incoming strike's travel at its start and end */
  slowScale: 0.06,
  slowEase: 0.4,
  travel0: 0.3,
  travel1: 0.7,
  /** full energy shows as `ready` this long before the move goes (s) */
  readyHold: 0.3,

  // ── the fight ──────────────────────────────────────────────────
  hp: 100,
  lives: 3,
  /** a chosen move with no charge still does this share (q(0)); full charge: all of it */
  q0: 0.2,
  /** a counter's damage over its strike's */
  counterMult: 1.5,
  /** an attack: the lead strike lands at this charge whatever the choice; strike i ≥ 1 when charge × fit ≥ land[i] */
  landLead: 0.35,
  land: [0, 0.45, 0.65, 0.8, 0.9] as readonly number[],
  /** the player's and the opponents' damage over moves.ts's numbers */
  playerPow: 1.1,
  foePow: 3.8,
  /** the strikes after the key one land with this share of what the defence did not save */
  followShare: 0.45,
  /** an attack where nothing lands gets a soft counter back: this share of a cross */
  weakBack: 0.7,
  /** the read restores up to this much health a second at full calm; the corner: its base and its calm share a second */
  readHp: 0.25,
  cornerHp: 0.9,
  cornerBase: 0.35,
  /** the opponent's corner restores this much */
  foeCornerHp: 12,
  /** the player's count: its length (s), the energy it asks (share of a window's), the health risen with */
  count: { sec: 13, need: 0.7, fullHp: 0.6, lowHp: 0.3, plusHp: 0.3 },
  /** the opponent's count (s, free) and the health it rises with */
  foeCount: { sec: 7, hp: 0.5 },
  /** a win at the bell moves up the ladder only with this many landed strikes in the fight (a knockout always does) */
  ladderBellMin: 3,
  /** a later opponent on the ladder hits harder and takes less, per rung */
  ladderPow: 0.05,
  ladderChin: 0.04,
  /** the coach's pick glows in the first `sessions` sessions, and after `wrongRun` wrong picks in a row */
  hint: { sessions: 3, wrongRun: 2 },
  /** the crowd's mood rests here and returns with this time constant (s) */
  crowdBase: 0.3,
  crowdTau: 6,
  /** at most this many exchanges of one kind (incoming / opening) in a row */
  sameKindMax: 2,

  // ── voice and cards ────────────────────────────────────────────
  telegraph: 3,
  bannerSec: 2.8,
  impactSec: 1.2,
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 3,
  talkGap: 2.5,
  hintGap: 1.2,
} as const;

// ── the difficulty levels (kit/difficulty.ts, DESIGN.md §29) ─────────

/**
 * What a level changes in the fight — the opponents and the helps, never the training: the energy (the rate, the
 * need, the lead-in), the threshold, the blocks (the read, the slow motion's window, the corner) and what calm restores
 * are the same at every level.  REGULAR is the game as it was (every number 1, the coach's pick as designed, no time
 * limit on the choice).  The shared scale (`SCALE`: foe, count, speed, self, helps) bent for a fight:
 *
 *   pow     the opponents' power — the damage the player takes (foe over the player's own health, `self`)
 *   chin    the damage the opponents take (their health: 1 / foe, softened)
 *   speed   their hand speed: the sequence's tempo and their strikes'; never below the design (STARTING keeps it: the
 *           plan's room and the resolve's length are built for it)
 *   guard   their guard: an attack's follow-up strikes land at charge × fit ≥ land[i] × guard (at most 1, so the whole
 *           combination still lands at full charge with the right choice); the lead strike as designed (a 40 s test
 *           scores at every level)
 *   aggr    how often they lead (`count`): the share of exchanges that come at the player, × this (0.25–0.75)
 *   hint    the coach's pick (`helps`): it glows in the first `hintSessions` sessions and after `hintWrong` wrong picks
 *   choose  the quick-time choice: the options stay open this long into the slow motion (s) — STARTING and REGULAR the
 *           whole of it, ADVANCED and HARDCORE a few seconds (the energy keeps charging to the window's end: the choice
 *           closes, the push block does not)
 */
export interface Level {
  d: Difficulty;
  pow: number;
  chin: number;
  speed: number;
  guard: number;
  aggr: number;
  hintSessions: number;
  hintWrong: number;
  chooseSec: number;
}

export const LEVELS: Readonly<Record<Difficulty, Level>> = {
  start:    { d: 'start', pow: 0.55, chin: 1.45, speed: 1, guard: 0.85, aggr: 0.85, hintSessions: 5, hintWrong: 1, chooseSec: Infinity },
  regular:  { d: 'regular', pow: 1, chin: 1, speed: 1, guard: 1, aggr: 1, hintSessions: 3, hintWrong: 2, chooseSec: Infinity },
  advanced: { d: 'advanced', pow: 1.35, chin: 0.82, speed: 1.1, guard: 1.05, aggr: 1.1, hintSessions: 2, hintWrong: 3, chooseSec: 7 },
  hardcore: { d: 'hardcore', pow: 1.8, chin: 0.7, speed: 1.2, guard: 1.08, aggr: 1.2, hintSessions: 0, hintWrong: Infinity, chooseSec: 4.5 },
};

/** A saved level's knobs (an old save, or none: REGULAR). */
export const levelOf = (d: unknown = DEFAULT_DIFFICULTY): Level => LEVELS[difficultyOf(d)];

/** The rests' breath: in 4, out 6 (the runner's own pacer). */
export const BREATH = BREATH_DEFAULT;
export const CYC = breathCycle(BREATH);

/** How long a line of `text` stays on screen to be read (s): 2.5 s + 70 ms a character. */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

export const leadOf = (eeg: boolean): number => (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs);
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

/**
 * How fast the energy charges per second for a frame, in focus-seconds: only while focused, faster above the threshold
 * (the level averaged over a few seconds) and as a focused stretch is held.  (The sim calls it only in a sighted push
 * past its lead-in with a reliable signal.)
 */
export function focusRate(meanLevel: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = clamp((fin(meanLevel, 0.5) - 0.5) / 0.5);
  return (R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, fin(hold, 0)) / R.holdFull));
}

/** The focus-seconds a window of `sec` asks the average player to fill near its end. */
export const needFor = (sec: number, lead: number): number => Math.max(0.5, RULES.avgYield * Math.max(1, sec - lead) * RULES.fill);

/** What a move does with the charge `e` (0..1): a fifth with none, all of it when full. */
export const q = (e: number): number => RULES.q0 + (1 - RULES.q0) * clamp(fin(e, 0));

// ── the outcome of a move ─────────────────────────────────────────

export interface DefenseOutcome {
  /** the share of the key strike saved (0..1) */
  save: number;
  /** the counter's strike lands */
  counter: boolean;
}

/**
 * A defence `d` against the strike `s` with the charge `e`: it saves `answer × q(e)` of the strike; a counter (`withCounter`)
 * lands only on the right answer (answer 1) with full charge — with less it is only its defence.
 */
export function defend(d: DefenseId, s: StrikeId, e: number, withCounter: boolean): DefenseOutcome {
  const a = answer(d, s);
  return { save: clamp(a * q(e)), counter: withCounter && a >= 1 && e >= 1 - 1e-9 };
}

/** The damage (HP) a strike of the opponent's takes when `save` of it is saved; `pow` = the opponent's power. */
export const strikeDamage = (s: StrikeId, pow: number, save: number, share = 1): number =>
  Math.max(0, Math.round(STRIKES[s].dmg * RULES.foePow * pow * share * (1 - clamp(save))));

/** The damage a counter's strike does to an opponent of `chin` (a damage multiplier: < 1 takes less). */
export const counterDamage = (s: StrikeId, chin: number): number => Math.max(1, Math.round(STRIKES[s].dmg * RULES.playerPow * RULES.counterMult * chin));

/**
 * An attack: which of the combination's strikes land with the charge `e` and the combination's fit to the opening
 * (`fitV`, 1 the coach's choice … MISS): the lead strike with `landLead` charge whatever the choice — the guard takes the
 * rest of a weak or a wrong attack.  `guard` (a level's, 1 as designed) raises or lowers the follow-up strikes' thresholds.
 */
export function attackLands(n: number, fitV: number, e: number, guard = 1): boolean[] {
  const R = RULES, ee = clamp(fin(e, 0)), f = clamp(fin(fitV, 0));
  const g = Number.isFinite(guard) && guard > 0 ? guard : 1;
  const at = (i: number): number => {
    const v = R.land[Math.min(i, R.land.length - 1)] ?? 1;
    return g === 1 ? v : Math.min(1, v * g);
  };
  return Array.from({ length: n }, (_, i) => (i === 0 ? ee >= R.landLead - 1e-9 : ee * f >= at(i) - 1e-9));
}

/** A landed strike of the player's attack: its damage with the charge and the fit, on an opponent of `chin`. */
export const attackDamage = (s: StrikeId, fitV: number, e: number, chin: number): number =>
  Math.max(1, Math.round(STRIKES[s].dmg * RULES.playerPow * (0.4 + 0.6 * clamp(e)) * (0.6 + 0.4 * clamp(fitV)) * chin));

/** The soft counter an attack gets back when nothing of it landed. */
export const weakBackDamage = (pow: number, e: number): number => Math.max(1, Math.round(STRIKES.cross.dmg * RULES.foePow * pow * RULES.weakBack * (1 - q(e))));

/** Seconds a defence takes on screen (real time, a little slower than life to be read). */
export const defenseSec = (d: DefenseId): number => DEFENSES[d].dur * RULES.tempo;
/** Seconds a strike takes on screen: its load, travel and way back. */
export const strikeSec = (s: StrikeId, speed = 1): number => ((STRIKES[s].load + STRIKES[s].travel + STRIKES[s].back) * RULES.tempo) / Math.max(0.5, speed);
/** Seconds from a strike's start to its landing. */
export const landSec = (s: StrikeId, speed = 1): number => ((STRIKES[s].load + STRIKES[s].travel) * RULES.tempo) / Math.max(0.5, speed);

// ── the plan ──────────────────────────────────────────────────────

export interface PlanOpts {
  plannedSec: number;
  eeg: boolean;
  /** the rhythm: the window's seconds and the read's whole breaths (null: the design) */
  focus?: number | null;
  rest?: number | null;
  /** the player moved a dial (kit/rhythm.ts `custom`) */
  custom?: boolean;
  /** a first-ever session (the walk-in keeps room for the story card) */
  first?: boolean;
}

export interface Plan {
  T: number;
  test: boolean;
  lead: number;
  cyc: number;
  /** the first walk-in, a later fight's, the session's end, a fight's result in the middle (s) */
  intro: number;
  walk: number;
  endSec: number;
  fightEnd: number;
  /** the read: its whole breaths (a test: a part of one) and seconds */
  readBreaths: number;
  read: number;
  /** the slow motion's window (s) and the focus-seconds it asks */
  window: number;
  need: number;
  /** the shortest window the round's last exchange may take */
  minWindow: number;
  /** the corner between rounds: whole breaths and seconds (0 in a test) */
  cornerBreaths: number;
  corner: number;
  /** a round's designed length (s) */
  roundSec: number;
  /** the player's count, the opponent's count (s) */
  count: number;
  foeCount: number;
  /** the session's last bell (s of play) */
  lastBell: number;
}

const dialFocus = (v: number | null | undefined): number => {
  const F = RULES.focus;
  return clamp(Math.round(fin(v ?? F.def, F.def) / F.step) * F.step, F.min, F.max);
};
const dialRest = (v: number | null | undefined): number => {
  const R = RULES.rest;
  return clamp(Math.round(fin(v ?? R.def, R.def)), R.min, R.max);
};

/** The read's whole breaths a session of `sec` keeps with the rest dial `rest` (kit/rhythm.ts `restIn`). */
export function readBreathsIn(rest: number, sec: number): number {
  const r = dialRest(rest);
  return sec < RULES.readCapSec ? Math.min(r, RULES.readCap) : r;
}

/** The corner's whole breaths for a read of `read` breaths in a session of `sec`. */
export const cornerBreathsIn = (read: number, sec: number): number => read + (sec < RULES.shortSec ? RULES.cornerPlusShort : RULES.cornerPlus);

/** A round's designed length for a session of T seconds. */
export function roundSecFor(T: number): number {
  let r = RULES.roundSec[0][1];
  for (const [sec, len] of RULES.roundSec) if (T >= sec - 1) r = len;
  return r;
}

/** The session's plan (see the module's comment).  Every length is in seconds of play. */
export function planFor(o: PlanOpts): Plan {
  const R = RULES;
  const T = Math.max(10, fin(o.plannedSec, 300));
  const test = T <= R.testSec;
  const lead = leadOf(o.eeg);
  const W = dialFocus(o.focus);
  const intro = test ? R.intro.test : o.first ? R.intro.first : R.intro.sec;
  const endSec = test ? R.end.test : R.end.sec;
  const readBreaths = test ? 1 : readBreathsIn(dialRest(o.rest), T);
  const read = test ? R.test.read : readBreaths * CYC;
  const window = test ? Math.min(W, R.test.window) : W;
  const minWindow = test ? Math.min(window, lead + R.testWindowPast) : Math.min(window, R.minWindow);
  const cornerBreaths = test ? 0 : cornerBreathsIn(readBreaths, T);
  const lastBell = T - endSec;
  return {
    T, test, lead, cyc: CYC, intro, walk: R.walkSec, endSec, fightEnd: test ? R.fightEnd.test : R.fightEnd.sec,
    readBreaths, read, window, need: needFor(window, lead), minWindow,
    cornerBreaths, corner: cornerBreaths * CYC,
    roundSec: test ? Math.max(1, lastBell - intro) : roundSecFor(T),
    count: test ? R.test.count : R.count.sec,
    foeCount: test ? R.test.foeCount : R.foeCount.sec,
    lastBell,
  };
}

/** A fight's rounds: how many, each one's length (s), and its last bell (s of play). */
export interface FightPlan { rounds: number; len: number; bell: number; last: boolean }

/**
 * The fight that begins at `t0`: three rounds of the designed length when another fight (its result, the corner, the
 * walk-in and two rounds) still fits after it; else the rounds (1–4) that fill the time to the session's last bell.
 */
export function fightPlan(p: Plan, t0: number): FightPlan {
  const R = RULES;
  const avail = Math.max(1, p.lastBell - t0);
  const len = p.roundSec, C = p.corner;
  const full = R.maxRounds * len + (R.maxRounds - 1) * C;
  const next = p.fightEnd + C + p.walk + 2 * len + C;
  if (!p.test && avail >= full + next) return { rounds: R.maxRounds, len, bell: t0 + full, last: false };
  const n = p.test ? 1 : clamp(Math.round((avail + C) / (len + C)), 1, R.maxRoundsLast);
  return { rounds: n, len: Math.max(1, (avail - (n - 1) * C) / n), bell: p.lastBell, last: true };
}

/** The window an exchange that begins its read at `t` gets before a bell at `bell` (null: none fits; the read runs to the bell). */
export function windowFits(p: Plan, t: number, bell: number): number | null {
  const room = bell - t - p.read - RULES.seqMax - RULES.resolveMax;
  if (room < p.minWindow - 1e-9) return null;
  return Math.min(p.window, room);
}
