/**
 * Every number of Światło ciała's rules in one place (DESIGN.md §13.10, round 11): how an element fills (only with
 * real focus), the light on it (what the gauge shows), the push that ends when its element is full and the rest of
 * whole breaths that follows, the lux, the voice and the cards.  Tuning moves a number here and nowhere else; the
 * tests read the same object.
 *
 * An element's `fill` runs 0 → 1 and only moves while the band reads focus (the founder's rule of 2026-11-17:
 * progress only from real concentration; what was gained stays).
 */
export const RULES = {
  // ── filling (only with focus) ────────────────────────────────
  /** focused seconds an element takes at a multiplier of 1 */
  elementSec: 14,
  /** the multiplier: fillBase + fillLevel × level + fillHold × min(1, hold / holdFull) */
  fillBase: 0.75,
  fillLevel: 0.5,
  fillHold: 0.25,
  holdFull: 20,
  /** the first-ever session's warm-up fills at this share of the rate (real focus, a gentle start) */
  warmK: 0.5,
  /** a blind push's hidden fill may run past full by this much (the next element starts with it) */
  blindCarry: 0.5,
  /** a blind push's fill is shown at its end over this long (s) */
  revealSec: 1.6,

  // ── the light on the element (the gauge) ─────────────────────
  /** without the brain (the lead-in, a blind push, no signal): just under the threshold */
  baseLight: 0.45,
  lightTau: 0.8,
  restLight: 0.3,
  gold: 0.5,

  // ── the blocks: a push fills its elements (2 by design), then a rest of whole breaths ──
  /**
   * the elements ("miejsca") a push fills before its rest (round 15, DESIGN §19): 2 by design — a rest after every
   * single element (round 11) came every ~20 s and took half the session — the player sets 1–4 in the lobby
   * ("Odpoczynek po"); the facts of the push's places are read one after another in its rest
   */
  perPush: 2,
  perPushDial: { min: 1, max: 4 },
  /** the lead-in before the brain acts in a push (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a push ends when its element is full, but not before this (s): an early fill flows into the next element */
  minPush: 12,
  /**
   * a push that cannot fill ends anyway after this long (s) — `maxPush` for one element, `maxPushPer` more for each
   * further one it asks — telegraphed `telegraph` before; the element keeps its fill
   */
  maxPush: 60,
  maxPushPer: 25,
  /** the rest is announced when the element is this full (and the push has run at least minPush − telegraph) */
  announceAt: 0.85,
  telegraph: 4,
  /** a rest of whole breaths of 4 in, 6 out: 2 by design (20 s), the player sets 1–6 in the lobby ("Odpoczynek") */
  restBreaths: 2,
  restBreathsDial: { min: 1, max: 6 },
  /** a short session (≤ 60 s): rests of one breath */
  shortRestBreaths: 1,
  /** a push shorter than this is not judged */
  judgeMin: 10,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 6,
  /** the runner's banner covers the first seconds of a block: the voice waits it out */
  bannerSec: 4.5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a short test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** gold light this long (s) before the narrator says so */
  goodSec: 5,
  /** a sighted push with a signal but no focus this long (s): the narrator says the light waits (once a push) */
  stillSec: 10,
  /** every countEvery-th push asks to count instead of picturing (for those who do not picture easily) */
  countEvery: 3,

  // ── the way through a meditation ─────────────────────────────
  /** the light moves to the next element (s) */
  moveSec: 1.2,
  /** the figure turns (front ↔ back), the brain turns to its cut through the middle, the camera dives into the head (s) */
  turnSec: 2.4,
  diveSec: 2.8,
  /** a whole meditation's moment before its closing card (s) */
  wholeSec: 2.4,
  /** the picker closes by itself after this long untouched (s) */
  pickerIdle: 20,

  // ── lux (the headline) ───────────────────────────────────────
  /** while focus fills: luxFill × the multiplier a second */
  luxFill: 3,
  /** an element lit by focus, a whole meditation, a block judged well */
  luxElement: 20,
  luxWhole: 100,
  luxBlock: 20,
  /** a blind push: its share on the asked side × this */
  luxBlind: 60,
  /** in rest, with a signal: luxRest × (0.3 + calm) a second, shown every 3 s */
  luxRest: 1.2,

  // ── words on screen (the round's clarity rule: ≥ 2.5 s + 70 ms a character, never under 4.5 s) ──
  readBase: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  /** the narrator's pause between two lines (s) */
  talkGap: 2.2,
  /** the first-time explanations (coach marks): one at a time, this far apart (s) */
  hintGap: 1.2,
  /** the opening card's pages and a closing card close themselves after this long (s); a tap after tapAfter */
  pageSec: 12,
  closeSec: 10,
  tapAfter: 0.6,
} as const;

/** How long a text stays on screen to be read twice (s): ≥ 2.5 s + 70 ms a character, never under 4.5 s. */
export const readSec = (text: string): number => Math.max(RULES.readMin, RULES.readBase + RULES.readPerChar * text.length);
