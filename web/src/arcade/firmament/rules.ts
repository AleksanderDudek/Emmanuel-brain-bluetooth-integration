/**
 * Every number of Firmament's rules in one place (board.ts, levels.ts and sim.ts read it): the
 * board, the points, the animation clock the rules and the picture share, the telescope, the
 * night's falling stars, the rescue, the blocks and the meta.  Tuning moves a number here and
 * nowhere else; the tests read the same object.
 */
export const RULES = {
  // ── the board ────────────────────────────────────────────────
  /** rows and columns, and how many kinds of sky bodies a level may use */
  rows: 8,
  cols: 8,
  kinds: 6,
  /** a generator gives up re-rolling a board after this many tries (then it repairs one) */
  genTries: 400,

  // ── points ───────────────────────────────────────────────────
  /** each body cleared (× the cascade's step: 1, 2, 3 …) */
  body: 10,
  /** a special made by a match */
  make: { row: 60, col: 60, nova: 90, pulsar: 150 },
  /** a layer of stardust cleared, an asteroid hit, an asteroid broken, a satellite brought down */
  dust: 20,
  rockHit: 20,
  rockBreak: 40,
  sat: 300,
  /** every move left when a level is won becomes a comet that fires (and these points) */
  leftover: 60,

  // ── the clock the rules and the picture share (s) ───────────
  /** a swap's slide, a bounce back, a clear's pop, a fall per cell (and its floor), a nova's second blast */
  swapSec: 0.14,
  bounceSec: 0.26,
  clearSec: 0.2,
  fallCell: 0.055,
  fallMin: 0.12,
  /** extra time a step with a special's blast takes */
  blastSec: 0.16,
  /** an instrument's beam before its blast */
  toolSec: 0.3,

  // ── the telescope (push: Obserwacja) ─────────────────────────
  /** a lens fills in `lensSec` of focus well above the threshold; just above it at `lensLow` of that rate */
  lensSec: 8,
  lensLow: 0.35,
  /** the level above 0.5 that counts as "well above" (full rate) */
  lensFull: 0.25,
  /** the lead-in before the band moves the lens (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a held focus this long (s) makes the next instrument a pulsar */
  pulsarHold: 12,
  /** the tray: its size at first, and at its largest */
  tray: 3,
  trayMax: 4,

  // ── Cisza nocy (rest) ────────────────────────────────────────
  /** calm × dt accumulates; every `starEvery` a falling star leaves a comet; at most `starMax` a block */
  starEvery: 4,
  starMax: 3,
  starLead: { fnirs: 4, eeg: 2 },
  /** how fast the sky brightens and dims with calm (s) */
  skyTau: 1.5,

  // ── Ratunek (out of moves) ───────────────────────────────────
  /** seconds of the block's own state that give `rescueMoves` more moves; the window it may take */
  rescueSec: 6,
  rescueMoves: 5,
  rescueWindow: 24,

  // ── a level's end ────────────────────────────────────────────
  /** the card after a won or a lost level, before the next board (s) */
  wonHold: 2.8,
  lostHold: 2.2,

  // ── hands ────────────────────────────────────────────────────
  /** a drag this far (share of a cell) picks the neighbour it points to */
  dragCell: 0.35,
  /** the hint glows by itself after this long without a move (s) */
  idleHint: 6,

  // ── the session ──────────────────────────────────────────────
  /** Obserwacja and Cisza nocy: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  finale: 4,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long for a cascade to land (s) */
  settle: 3,
  /** Obserwacja blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,

  // ── the meta ─────────────────────────────────────────────────
  /** levels per constellation */
  perConst: 10,
  /** the day's gift: an instrument in the tray at the day's first session */
  giftDay: true,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
