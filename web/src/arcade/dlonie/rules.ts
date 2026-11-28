/**
 * Every number of Światło w dłoniach in one place (DESIGN.md §18): how the ball grows and the prayer rises (only with
 * real focus), the smoothing that keeps the 0.1 Hz wave out of the picture, the steps' lengths in whole breaths, how
 * many prayers a session holds, the flames (the headline), the words' reading times.  Tuning moves a number here and
 * nowhere else; the tests read the same object.
 */
export const RULES = {
  // ── growth (only with focus) ─────────────────────────────────
  /** the multiplier: growBase + growLevel × level + growHold × min(1, hold / holdFull) */
  growBase: 0.75,
  growLevel: 0.5,
  growHold: 0.25,
  holdFull: 20,
  /** focused seconds a push needs at a multiplier of 1: set per prayer from the time left, within these bounds */
  needMin: 8,
  needMax: 30,
  /**
   * The rest's rhythm in the lobby (round 15, kit/rhythm.ts): how long one stretch of focus (the ball growing, the
   * prayer rising) lasts for an average player, `focusDef` s by design (what the plan gives a 5–10 minute session),
   * `focusMin`…`focusMax`; and the breaths of the rest after the offering (`restDef`, 1…`restMax`), the hands' breath
   * before the ball about half of it, the name one breath.  With the player's rhythm the session holds as many prayers
   * as fit, each push's need up to `needMaxRhythm`.
   */
  focusDef: 30,
  focusMin: 20,
  focusMax: 90,
  restDef: 3,
  restMax: 6,
  needMaxRhythm: 56,
  /** an average player's focused share × mean multiplier (the plan's estimate of growth per push second) */
  expect: 0.62,
  /** the shown growth follows the real one through a moving average of its rate over this long (s): one breath at 6/min */
  smoothSec: 10,
  /** once the real growth is whole, the shown one catches up with this time constant (s) */
  catchTau: 0.45,
  /** a blind push's growth is shown at its end over this long (s) */
  revealSec: 1.8,
  /** the lead-in before the brain acts in a push (s): Mendi / HALO — the spark appears in it */
  leadIn: { fnirs: 5, eeg: 2 },

  // ── the steps ────────────────────────────────────────────────
  /** the first prayer's rub, and the later ones' (s) */
  rubFirst: 6,
  rubLater: 4,
  /** a push ends when its growth is whole, but not before this (s) */
  minPush: 10,
  /** a push that cannot finish ends after this long (s): a rest of `waitBreaths`, then the same step again */
  maxPush: 60,
  waitBreaths: 2,
  /** the next block is announced this long before it (s) */
  telegraph: 4,
  /** the rest is announced when the growth is this whole (and the push has run at least minPush − telegraph) */
  announceAt: 0.88,
  /** a block shorter than this is not judged (s); a block needs this many reliable seconds for a verdict */
  judgeMin: 9,
  minReliable: 6,
  /** push blocks: every blindEvery-th ball push is blind from the blindFrom-th session (never a session's first) */
  blindEvery: 3,
  blindFrom: 3,
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** the runner's banner covers the first seconds of a block: the narrator waits it out */
  bannerSec: 4.5,
  /** the bloom at the top (or the laying) before the rest begins (s) */
  bloomSec: 2.2,

  // ── flames (the headline) ────────────────────────────────────
  /** while focus grows: flameGrow × the multiplier a second */
  flameGrow: 1.5,
  /** a prayer offered (lifted or laid), a block judged well */
  flamePrayer: 15,
  flameBlock: 10,
  /** a blind push: its share on the asked side × this */
  flameBlind: 60,
  /** in rest, with a signal: flameRest × (0.3 + calm) a second */
  flameRest: 0.6,

  // ── words on screen (the clarity rule: ≥ 2.5 s + 70 ms a character, never under 4.5 s) ──
  readBase: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 2.2,
  /** sessions over talkFrom s (45 and 60 minutes): a narrator's line comes back only after talkFresh s (round 24) */
  talkFrom: 1800,
  talkFresh: 600,
  hintGap: 1.2,
  /** a sighted push with a signal but no focus this long (s): the narrator says the ball waits (once a push) */
  stillSec: 10,
  /** gold light this long (s) before the narrator says so */
  goodSec: 6,
  /** every countEvery-th push asks to count instead of picturing */
  countEvery: 3,
  /** the opening card closes itself after this long (s); a tap after tapAfter */
  pageSec: 12,
  tapAfter: 0.6,
  /** the picker closes by itself after this long untouched (s) */
  pickerIdle: 20,

  // ── the player's names ───────────────────────────────────────
  namesMax: 12,
  nameLen: 24,
} as const;

/** How long a text stays on screen to be read twice (s). */
export const readSec = (text: string): number => Math.max(RULES.readMin, RULES.readBase + RULES.readPerChar * text.length);

/** How many prayers a session of `plannedSec` holds: 3 min 2, 5 min 3, 10 min 4, 15 min 6, 20 min 8, 30 min 11. */
export function prayersFor(plannedSec: number): number {
  if (plannedSec <= 75) return 1;
  return Math.max(1, Math.round(1 + plannedSec / 180));
}

/**
 * Whole breaths each kind of rest takes: the player's Rytm (the rest after the offering; the hands' breath before the
 * ball about half of it; the name one breath), or by design for the session's length — long sessions breathe deeper.
 */
export function breathsOf(rest: number): { breathe: number; name: number; rest: number } {
  const r = Math.max(1, Math.min(RULES.restMax, Math.round(rest)));
  return { breathe: Math.max(1, Math.round(r / 2)), name: 1, rest: r };
}

/** How many prayers fit a session with the player's stretch of focus: each prayer its fixed part and two pushes. */
export function prayersWith(plannedSec: number, focusSec: number, fixedSec: number): number {
  const avail = Math.max(0, plannedSec - finaleFor(plannedSec));
  return Math.max(1, Math.round(avail / (fixedSec + 2 * Math.max(RULES.minPush, focusSec))));
}

/** Whole breaths each kind of rest takes in a session of `plannedSec`: long sessions breathe deeper. */
export function breathsFor(plannedSec: number): { breathe: number; name: number; rest: number } {
  if (plannedSec <= 75) return { breathe: 1, name: 1, rest: 1 };
  if (plannedSec <= 330) return { breathe: 1, name: 1, rest: 2 };
  if (plannedSec <= 900) return { breathe: 2, name: 1, rest: 3 };
  return { breathe: 3, name: 1, rest: 4 };
}

/** The finale: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);
