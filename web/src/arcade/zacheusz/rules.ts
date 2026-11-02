/**
 * Every number of Zacheusz's rules in one place (sim.ts re-exports it): the run, the jump, the
 * street's pieces, the high way, the rest street, the blocks and the meta game.  Tuning moves a
 * number here and nowhere else; the tests read the same object.
 *
 * World units (u): x to the right, y up, the street's top at y = 0; Zacchaeus is a short man,
 * about 1 u tall.  A landscape screen shows about 16 u across, an upright phone about 11 u.
 */
export const RULES = {
  // ── the run ──────────────────────────────────────────────────
  /** the physics' fixed step (s): the same inputs give the same run on every device */
  step: 1 / 120,
  /** forward speed (u/s): running, walking in the sycamore's shade, the slow finale */
  run: 5.2,
  walk: 2.6,
  /** how fast the speed reaches its target (u/s²) */
  accel: 18,
  /** Zacchaeus' box: half its width and its height (u) */
  halfW: 0.24,
  height: 0.95,
  /** a ledge this low is stepped up without a jump (u) */
  stepUp: 0.3,

  // ── the jump (Super Mario Run's verb) ────────────────────────
  /** the jump's take-off speed (u/s); gravity while it is held (up to holdMax s) and otherwise (u/s²) */
  jumpV: 10,
  gHold: 12,
  holdMax: 0.26,
  g: 38,
  /** falling never faster than this (u/s) */
  maxFall: 16,
  /** a tap this early before landing still jumps, and this long after leaving a ledge (s) */
  buffer: 0.12,
  coyote: 0.08,
  /** against a wall in the air: the slide's speed (u/s); a tap kicks off it upward and back */
  wallSlide: 2.4,
  wallV: 9.6,
  wallKick: 2.6,
  /** the hands reach a ledge this far above the feet: he pulls himself up (u); a pit's far rim only this close */
  mantle: 0.5,
  rimMantle: 0.2,
  /** baskets, chickens and sleeping dogs are vaulted on their own: the hop's speed (u/s), started this far ahead (u) */
  vaultV: 7.2,
  vaultAhead: 0.55,
  /** an awning bounces him up at this speed (u/s), more while the jump is held */
  bounceV: 11.2,
  bounceHeld: 13,
  /** pressed against a wall on the ground this long (s): a neighbour gives him a leg-up */
  legUp: 1.6,
  legUpV: 12.5,
  /** a ladder is climbed at this speed (u/s) */
  climbV: 4.5,

  // ── the rope (Mario's bubble) ────────────────────────────────
  /** below this (u) he has fallen: the neighbour's rope brings him back to where he was this long ago (s) */
  fallY: -2.2,
  rewind: 3,
  /** the rope's animation (s) */
  ropeSec: 1.3,
  /** the history kept for the rope (s) and its sampling (s) */
  history: 4.5,
  historyEvery: 0.05,
  /** this many falls into the same pit and the neighbour lays a plank over it */
  plankAfter: 2,

  // ── the street ───────────────────────────────────────────────
  /** the world is made this long ahead of him at his pace (s), at least this far (u), and forgotten this far behind (u) */
  aheadSec: 4,
  aheadMin: 15,
  behind: 24,
  /** a denarius is picked within this distance of his middle (u) */
  pick: 0.62,
  /** coins this close in time (s) make a chain (the combo's rising notes) */
  chainGap: 0.9,
  /** a special denarius counts this much; five a course */
  specialValue: 5,
  specials: 5,

  // ── the sycamore-fig (the flagpole) ──────────────────────────
  /** where he touches the trunk (feet, u): branch 1 from the ground up, 5 at the top */
  branchAt: [0, 1.1, 2.2, 3.3, 4.4],
  /** denarii for each branch */
  branchPay: [5, 10, 20, 35, 50],
  /** how long he sits in the branches while the procession passes (s) */
  treeSec: 3.2,

  // ── the brain ───────────────────────────────────────────────
  /** Wypatrywanie: the lead-in before the high way answers (s), and the level's extra smoothing (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  tauL: { fnirs: 1.5, eeg: 0.6 },
  /** a high piece locks its state this long before he reaches it (s × his speed) */
  lockSec: 1.5,
  /** the level at which a piece unfolds solid (the threshold's place on the level) */
  solidAt: 0.5,
  /** "Widok": a held view this long (s), Mendi / HALO, then every `viewAgain` s more of it, at most viewMax a block */
  view: { fnirs: 6, eeg: 4 },
  viewAgain: 8,
  viewMax: 3,
  /** a Widok's burst of denarii on the roofs ahead: how many, from how far ahead (u) over how long a stretch (u) */
  viewCoins: 12,
  viewFrom: 6,
  viewSpan: 9,
  /** the procession's dust: its nearness follows the hold (s to full), eases back this slowly (s) */
  dustFull: 10,
  dustTau: 4,
  /** Cień sykomory: ripeness R, dR/dt = gain × calm − leak after the lead-in (s), Mendi / HALO */
  rGain: 0.075,
  rLeak: 0.012,
  rLeadIn: { fnirs: 4, eeg: 2 },
  /** a fig tree carries five figs; the k-th is ripe once R reaches figAt[k] */
  figAt: [0.12, 0.28, 0.45, 0.62, 0.8],
  /** the neutral floor of R for a block with too few reliable seconds */
  rFloor: 0.4,
  minReliable: 8,
  /** a passed Cień sykomory: a basket of figs, worth this many denarii */
  basketPay: 8,
  /** a passed Wypatrywanie: this many denarii shine on the next roofs */
  passPay: 6,
  /** the blind block (Tłum): its last 15 s of focus become this many solid rooftops at most */
  revealMax: 6,

  // ── the session ──────────────────────────────────────────────
  /** Wypatrywanie and Cień: nominal length ± jitter (s); no block under minBlock */
  push: [24, 4],
  rest: [23, 3],
  minBlock: 12,
  telegraph: 4,
  finale: 6,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long (s) for a rope or the tree to finish */
  settle: 4,
  /** the ghost hand shows after this long without a touch in the warm-up (s) */
  idleHint: 3,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** the block card shows this long (s) */
  cardSec: 3.4,

  // ── the meta ─────────────────────────────────────────────────
  /** twelve households: the all-time denarii at which each is restored */
  homes: [40, 110, 200, 320, 460, 620, 800, 1000, 1220, 1460, 1720, 2000],
  /** denarii for the households: a mission, the day's gift */
  missionPay: 15,
  giftPay: 20,
  /** twelve courses; their length in chunks grows with the index */
  courses: 12,
  courseChunks: [11, 15],
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
