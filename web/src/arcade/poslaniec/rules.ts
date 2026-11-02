/**
 * Every number of Posłaniec's rules in one place (sim.ts re-exports it): the road, the runner's
 * moves, the obstacles' chunks, the brain's influence, the session's blocks and the meta game.
 * Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * World units: metres.  z runs along the road (the runner's distance), x across it in lanes
 * (−1, 0, +1; a lane is `laneW` m wide on the picture), y up from the paving.
 */
export const RULES = {
  // ── the road and the run ─────────────────────────────────────
  /** the physics' fixed step (s): the same inputs give the same run on every device */
  step: 1 / 120,
  /** a lane's width on the picture (m) */
  laneW: 1.55,
  /** running speed (m/s): from vMin, rising toward vMax with the session's distance (scale vRise m) */
  vMin: 9,
  vMax: 13.5,
  vRise: 2600,
  /** Strażnice: an evening stretch, slower; the heights: a little faster */
  restSpeed: 0.78,
  heightsSpeed: 1.08,
  /** how fast the speed follows its target (s) */
  vTau: 0.6,
  /** how far ahead the road is made (m) and how far the picture shows it */
  ahead: 95,

  // ── the moves (touch: anything under 2 s) ────────────────────
  /** a lane change eases over about this long (s) */
  laneSec: 0.15,
  /** a jump's arc: its length (s) and its top (m); sandals: a higher one */
  jumpSec: 0.7,
  jumpTop: 1.45,
  sandalTop: 2.6,
  /** a slide lasts this long (s); a slide pressed in the air slams down at this speed (m/s) */
  slideSec: 0.7,
  slam: 20,
  /** a press this long before landing still jumps or slides on landing (s) */
  buffer: 0.14,

  // ── the obstacles ────────────────────────────────────────────
  /** heights (m): a low wall or a column (jump), the beam of an arch or a branch (slide), a cart's and a wagon's roof */
  wallTop: 0.85,
  archGap: 1.0,
  cartTop: 1.75,
  wagonTop: 1.9,
  /** a wagon's ramp (m) */
  rampLen: 4,
  /** depth along the road (m) */
  wallLen: 0.7,
  archLen: 0.6,
  goatLen: 0.9,
  /** carts' and wagons' lengths (m) */
  cartLen: [4, 7],
  wagonLen: [16, 24],
  /** a goat crosses the road at this speed (lanes/s), starting when the runner is this far (m) */
  goatSpeed: 1.1,
  goatWake: 26,
  /** the runner's half depth and the lateral reach of a hit (lanes) */
  bodyHalf: 0.35,
  hitHalf: 0.42,

  // ── the chunks (the road's seeded patterns) ──────────────────
  /** rows of a chunk are this far apart at difficulty 0 and 1 (m) */
  rowGap: [19, 11.5],
  /** a breather between chunks (m) */
  chunkGap: [22, 12],
  /** difficulty: d = d0 + (1 − d0) × (1 − e^(−dist/dRise)); a rest block dips it, the first minute is gentle */
  d0: 0.08,
  dRise: 2200,
  /** after a rest block the next chunk is this much easier */
  restDip: 0.25,
  /** a power-up on the road every this many metres (± a third) */
  powerEvery: 320,
  /** how long a power-up works (s) */
  sandalsSec: 10,
  satchelSec: 10,
  /** watchtowers in Strażnice: one pair every this many seconds of running */
  towerEvery: 2.5,

  // ── grace ───────────────────────────────────────────────────
  /** a stumble: slowed to this share of speed, easing back over stumbleSec; passing through what was hit */
  stumbleSlow: 0.45,
  stumbleSec: 1,
  /** two stumbles this close (s): a fellow traveller's mule cart carries the messenger past the next stretch */
  muleWindow: 8,
  muleSec: 4,
  muleSpeed: 11,

  // ── the drachmas ─────────────────────────────────────────────
  /** pick-up reach (lanes across, m along); the band widens it in a sighted push by up to magnetL lanes; the satchel reaches every lane */
  coinReach: 0.5,
  coinDepth: 0.9,
  magnetL: 0.75,
  satchelReach: 2.2,
  satchelDepth: 7,
  /** every comboStep drachmas in a row without a stumble pay comboBonus */
  comboStep: 25,
  comboBonus: 5,

  // ── the brain ───────────────────────────────────────────────
  /** the lead-in (s) before the band acts in a block, Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the ladder: seconds of hold to reach the heights, Mendi / HALO */
  heightsHold: { fnirs: 5, eeg: 3 },
  /** the heights: at most this long (s), the rise and the glide down (s), the clear stretch after (s), its road's height (m) */
  heightsMax: 12,
  riseSec: 0.8,
  glideSec: 1.1,
  clearSec: 1.5,
  heightsY: 5.5,
  /** a new climb up the ladder after the heights waits this long (s) */
  ladderRest: 3,
  /** drachmas on the heights: one every this many metres in each lane */
  heightsCoinGap: 2.2,
  /** the blind block's bonus heights: (judged share) × heightsMax, at least blindMin s if it was judged */
  blindMin: 2,
  /** a tower is kindled when the runner is this close (m) */
  kindleAhead: 12,
  /** a fire counts as lit above this calm */
  fireLit: 0.5,
  /** an unreliable moment lights a tower at this neutral glow (never a low value) */
  fireNeutral: 0.4,
  /** the neutral floor: a block with too few reliable seconds has no verdict */
  minReliable: 8,

  // ── the session ──────────────────────────────────────────────
  /** Na wyżyny and Strażnice: nominal length ± jitter (s); no block under minBlock */
  push: [25, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  finale: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long (s) for a jump or the heights' glide to land */
  settle: 3,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,

  // ── the meta ─────────────────────────────────────────────────
  /** drachmas for a passed push block, for the watchmen's song (a passed rest), a mission, the day's gift */
  pushPay: 10,
  songPay: 12,
  missionPay: 25,
  giftPay: 30,
  /** the road to the seven churches: the legs between them (m), Ephesus first */
  legs: [2000, 2500, 3000, 3500, 4000, 4500],
  /** the jar's milestones (drachmas, all time): each dresses the messenger in a new cloak */
  cloaks: [0, 250, 800, 2000],
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** The jump's launch speed and gravity for a top of `top` m reached in half of `sec`. */
export const GRAVITY = (8 * RULES.jumpTop) / (RULES.jumpSec * RULES.jumpSec);
export const jumpV = (top: number): number => Math.sqrt(2 * GRAVITY * top);
