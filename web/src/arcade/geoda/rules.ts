/**
 * Every number of Geoda's rules in one place: the board, the scoring (after Block Blast: a point per
 * cell placed, ten per line with a bonus for several at once, a combo kept alive by a clear within
 * three placements, a clean-board bonus), the dealer, the shine (the band's multiplier), the druses
 * that grow on cleared cells, the Szlif, the chambers of the Wyprawa, the blocks and the companion.
 * Tuning moves a number here and nowhere else; the tests read the same object.
 */
export const RULES = {
  // ── the board ────────────────────────────────────────────────
  n: 8,

  // ── scoring ──────────────────────────────────────────────────
  /** points per cell placed */
  perCell: 1,
  /** a clear of L lines at once: lineBase × L × (L + 1) / 2 (10, 30, 60, 100, 150 …) */
  lineBase: 10,
  /** the combo multiplies a clear: 1 + comboStep × (combo − 1) */
  comboStep: 0.5,
  /** a combo stays alive while a clear comes within this many placements */
  comboFuse: 3,
  /** the board left empty by a clear */
  cleanBonus: 120,
  /** a druse cell harvested at full growth (× shine) */
  druseCt: 10,

  // ── the shine (push blocks): the band's multiplier ─────────────
  /** the dial's steps: ×1 below the first, ×5 from the last (the threshold = 0.5 is where ×3 begins) */
  shineSteps: [0.25, 0.5, 0.67, 0.84],
  /** how fast the dial follows the level (s) */
  shineTau: 0.9,
  /** the lead-in before the band moves the dial (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** druses grow on seeded empty cells this much per second at the threshold, and up to druseMax at a full dial */
  druseRate: 0.05,
  druseMax: 0.16,

  // ── the Szlif (rest) ────────────────────────────────────────
  /** calm polishes the round's gem this much per second at calm 1, after the lead-in (s) */
  polishRate: 0.1,
  restLead: { fnirs: 4, eeg: 2 },
  /** the polished gem's points: its base (the round's best clear, at least gemMin) × (1 + polish) */
  gemMin: 40,

  // ── the dealer ──────────────────────────────────────────────
  /** triples tried before settling for one whose first piece fits */
  dealTries: 24,
  /** a piece that completes a line right now is this much more likely (the Block Blast lean) */
  helpLean: 2.2,
  /** in a Szlif and the warm-up, small pieces are this much more likely */
  gentleLean: 1.8,
  /** a dealt piece in the Wyprawa carries a jewel this often (when the chamber still wants jewels) */
  jewelChance: 0.22,

  // ── the Wyprawa (adventure) ─────────────────────────────────
  /** a chamber's prefilled rock: cells at the first chamber, more per chamber, at most */
  rockStart: 12,
  rockStep: 1.5,
  rockMax: 26,
  /** jewels to collect: at the first chamber, more per chamber, at most */
  goalStart: 9,
  goalStep: 2,
  goalMax: 32,
  /** the chamber's star targets (points in the chamber): ★★ and ★★★, growing per chamber */
  starBase: [400, 1000],
  starStep: [100, 240],
  /** a fresh board after a turn carries this share of the chamber's rock */
  turnRock: 0.5,

  // ── the session ─────────────────────────────────────────────
  /** Blask and Szlif: nominal length ± jitter (s); no block under minBlock */
  push: [24, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: Bazyl waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 min and more, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** canStop() waits at most this long for a clear in flight (s) */
  settle: 1.5,

  // ── feel ────────────────────────────────────────────────────
  /** a clear's animation: the sweep (s) and the hit-stop (s) for 1 / 2 / 3+ lines */
  clearSec: 0.42,
  stop: [0.04, 0.06, 0.09],
  /** a geode's turn: how long the tally stays (s) */
  turnSec: 2.6,
  /** a chamber's tally card (s) */
  levelSec: 3.2,
  /** the opening card (first session): at most this long (s), a tap closes it */
  openSec: 8,
  /** without input this long (s) in the first session, the coach points at the auto-place */
  idleHint: 5,

  // ── Bazyl's lines ───────────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 3,
  /** the dial stays at ×3 or more this long (s) before he cheers it */
  goodSec: 4,
} as const;

export type Band = keyof typeof RULES.leadIn;

/** The multiplier (1..5) for a dial value 0..1. */
export function multOf(dial: number): number {
  let m = 1;
  for (const s of RULES.shineSteps) if (dial >= s) m++;
  return m;
}

/** Points for a clear of `lines` lines at once, before the combo and the shine. */
export const linePoints = (lines: number): number => (lines > 0 ? (RULES.lineBase * lines * (lines + 1)) / 2 : 0);

/** The combo's factor for a combo of `combo` clears in a row (1 for the first). */
export const comboFactor = (combo: number): number => 1 + RULES.comboStep * Math.max(0, combo - 1);
