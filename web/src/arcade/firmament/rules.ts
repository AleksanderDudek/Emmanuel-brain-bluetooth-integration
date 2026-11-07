/**
 * Every number of Firmament's rules in one place (board.ts, levels.ts and sim.ts read it): the
 * board, the points, the clock the rules and the picture share, the telescope (push), the calm sky
 * (rest), the level's flow and the session's blocks.  Tuning moves a number here and nowhere else;
 * the tests read the same object.
 */
export const RULES = {
  // ── the board ────────────────────────────────────────────────
  /** the largest board (levels shape it with holes) and how many kinds a level may use */
  rows: 8,
  cols: 8,
  kinds: 6,
  /** a generator gives up re-rolling after this many tries (then it repairs the board) */
  genTries: 300,

  // ── points (Candy Crush's scale, our numbers) ───────────────
  /** each body cleared by a match, × the cascade's step (1, 2, 3 …) */
  body: 20,
  /** each body a blast takes */
  blasted: 30,
  /** a special made by a match */
  make: { row: 120, col: 120, nova: 200, meteor: 100, pulsar: 300 },
  /** a cloud layer, an asteroid hit, an ink blot cleared, a lock broken, a moon brought down */
  cloud: 100,
  rockHit: 40,
  ink: 60,
  lock: 40,
  moon: 1000,
  /** Deszcz komet: every move left becomes a comet that fires (and these points first) */
  leftover: 300,
  /** the comet shower plays its steps this much faster */
  showerPace: 0.45,
  showerMax: 5,

  // ── the clock the rules and the picture share (s) ───────────
  swapSec: 0.15,
  bounceSec: 0.3,
  clearSec: 0.2,
  /** a fall per cell and its floor */
  fallCell: 0.06,
  fallMin: 0.12,
  /** extra time a step with a special's blast takes */
  blastSec: 0.18,
  /** a meteor's flight */
  flySec: 0.35,
  /** a tool's beam before its blast */
  toolSec: 0.28,

  // ── the telescope (push: Obserwacja) ─────────────────────────
  /** the charge fills in `chargeSec` of focus well above the threshold; just above it at `chargeLow` of that rate */
  chargeSec: 8,
  chargeLow: 0.35,
  /** the level above 0.5 that counts as "well above" (full rate) */
  chargeFull: 0.25,
  /** the lead-in before the band moves the charge (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a held focus this long (s) makes the next tool a pulsar */
  pulsarHold: 12,
  /** the tray: its size, and from which constellation it holds one more */
  tray: 3,
  trayMax: 4,
  trayGrowAt: 2,
  /** +moves tool gives this many */
  toolMoves: 5,
  /** the tray carries at most this many tools into the next session */
  carry: 2,

  // ── the calm sky (rest: Cisza nocy) ──────────────────────────
  /** calm × dt accumulates; every `starEvery` a falling star lands; at most `starMax` a block */
  starEvery: 4,
  starMax: 3,
  /** the block's third star refills this many moves */
  starMoves: 2,
  starLead: { fnirs: 4, eeg: 2 },
  skyTau: 1.5,

  // ── a level's flow (s) ───────────────────────────────────────
  /** the goal card before a level (taps cut it short after `cardMin`), a story card */
  introSec: 2.2,
  storySec: 7,
  cardMin: 0.7,
  /** the stars' tally after a won level, the map's step to the next star */
  wonSec: 3.4,
  /** out of moves: the card waits this long, then a gentle retry */
  outSec: 4.5,
  outMin: 0.9,

  // ── hands ────────────────────────────────────────────────────
  /** a drag this far (share of a cell) picks the neighbour it points to */
  dragCell: 0.3,
  /** the hint glows after this long without a move (s) */
  idleHint: 5,

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

  // ── the saga ─────────────────────────────────────────────────
  /** levels (stars) per constellation; the last one is the hard one */
  perConst: 8,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
