/**
 * Every number of Posłaniec's rules in one place (DESIGN.md §7.3, v2): the road and the run, the
 * runner's moves, the obstacles, the power-ups, the goat, the wings (the band's push), the
 * watchtowers (the band's rest), the session's blocks and the meta.  Tuning moves a number here and
 * nowhere else; the tests read the same object.
 *
 * World units: metres.  z runs along the road (the run's distance), x across it (lanes −1, 0, +1,
 * `laneW` apart), y up from the paving.
 */
export const RULES = {
  // ── the road and the run ─────────────────────────────────────
  /** the physics' fixed step (s): the same inputs give the same run on every device */
  step: 1 / 120,
  /** a lane's width (m) */
  laneW: 2.3,
  /** speed (m/s): a run starts at vMin and rises toward vMax over vRise metres of the run */
  vMin: 11,
  vMax: 17,
  vRise: 2400,
  /** the watchtowers' road is slower; the flight a little faster */
  restSpeed: 0.84,
  flightSpeed: 1.12,
  /** how fast the speed follows its target (s) */
  vTau: 0.5,
  /** the road is made this far ahead (m) */
  ahead: 110,

  // ── the moves (touch drives anything under 2 s) ──────────────
  /** a lane change takes this long (s): snappy */
  laneSec: 0.11,
  /** a jump's top (m) and its time in the air (s); sandals: a higher, longer one */
  jumpTop: 1.5,
  jumpSec: 0.64,
  sandalTop: 3.1,
  /** a roll lasts this long (s); a roll pressed in the air slams down at this speed (m/s) */
  rollSec: 0.62,
  slam: 26,
  /** a press this long before it can act (landing, the end of a stumble) still acts (s) */
  buffer: 0.16,
  /** the runner's height standing and rolling (m), half his depth along the road (m) */
  bodyH: 1.7,
  rollH: 0.7,
  bodyHalf: 0.35,
  /** a step up onto a roof this much higher than the feet still lands (m) */
  stepUp: 0.35,

  // ── the obstacles ────────────────────────────────────────────
  /** a low fence or a fallen column: its top (m) and depth (m) — jump it */
  lowTop: 0.95,
  lowLen: 0.6,
  /** a beam with a hanging sign: the gap under it (m) and depth — roll under it */
  highGap: 1.05,
  highTop: 3.4,
  highLen: 0.5,
  /** a wagon: its roof (m), its lengths (m), a ramp's length (m) at its near end */
  wagonTop: 2.5,
  wagonLen: [8, 13],
  rampLen: 5,
  /** an oncoming ox-cart: its speed toward the runner (m/s) and length */
  cartSpeed: 7,
  cartLen: 6,
  /** rows of a pattern are this far apart at difficulty 0 and 1 (m), a breather between patterns */
  rowGap: [22, 13],
  patternGap: [30, 14],
  /** difficulty in a run: d = d0 + (1 − d0) × (1 − e^(−dist/dRise)); the rest road is easier by restDip */
  d0: 0.1,
  dRise: 1800,
  restDip: 0.45,

  // ── drachmas, power-ups, letters, stations ───────────────────
  /** drachmas in a line are this far apart (m); a pick-up reaches this far across (lanes) and along (m) */
  coinGap: 2.4,
  coinReach: 0.45,
  coinDepth: 1.0,
  /** the satchel (magnet): reach in lanes across and m along */
  magnetReach: 2.4,
  magnetDepth: 9,
  /** a power-up on the road every this many metres (± a third) */
  powerEvery: 360,
  /** how long a power-up works at upgrade level 0 (s), and what each level adds */
  powerSec: 10,
  powerStep: 2.5,
  /** the day's word: a letter every this many metres (± a quarter) */
  letterEvery: 280,
  /** a relay station (mutatio) every this many metres of a run: a letter delivered */
  stationEvery: 450,

  // ── grace: stumbles and the goat ─────────────────────────────
  /** a stumble: slowed to this share of speed, easing back over stumbleSec */
  stumbleSlow: 0.45,
  stumbleSec: 1.1,
  /** after a stumble the goat stays at the heels this long (s); a second stumble then = caught */
  goatNear: 7,
  /** a hit taken through the shield: the shield breaks and the runner is untouchable this long (s) */
  shieldGrace: 1.2,
  /** caught: the tally holds this long (s) before a new run starts */
  caughtSec: 2.8,

  // ── the band: the wings (push) ───────────────────────────────
  /** the lead-in (s) before the band acts in a block, Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** seconds of level well above the threshold to fill the wind ring, Mendi / HALO */
  fillSec: { fnirs: 8, eeg: 6 },
  /** the level counts from `liftFrom` and fully at `liftFull` (0.5 = the threshold) */
  liftFrom: 0.5,
  liftFull: 0.72,
  /** the flight: the climb (s), the stretch (s), more while still focused up to flightMax, the glide down (s) */
  flightRise: 0.9,
  flightSec: 8,
  flightMax: 12,
  flightGlide: 1.2,
  /** the flight's height (m) and its drachma trail's spacing (m) */
  flightY: 7.5,
  flightCoinGap: 2.2,
  /** the road after a landing is clear for this many metres */
  landClear: 45,

  // ── the band: the watchtowers (rest) ─────────────────────────
  /** a pair of towers every this many metres on the rest road */
  towerEvery: 40,
  /** calm at the moment a tower is passed lights it */
  fireLit: 0.5,
  /** fires lit for a shield */
  hornNotches: 3,

  // ── the score ───────────────────────────────────────────────
  /** points per metre at ×1; a station, a letter, the day's word, a fire */
  perMetre: 1,
  stationPts: 100,
  wordPts: 500,
  firePts: 40,
  /** the permanent multiplier's top */
  multMax: 30,

  // ── the session ──────────────────────────────────────────────
  /** push and rest blocks: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the finale (s): the last stretch to the inn */
  finale: { long: 6, short: 3 },
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 22 in 3, 8 in a short test; later sessions 6 */
  warm: { long: 30, short: 22, test: 8, later: 6 },
  /** canStop() waits at most this long (s) for a flight or a jump to land */
  settle: 3,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,

  // ── the meta ─────────────────────────────────────────────────
  /** drachmas for a passed push block, for the watchmen's song (a passed rest), the day's word */
  pushPay: 15,
  songPay: 20,
  wordPay: 60,
  /** the road to the seven churches: the legs between them (m), Ephesus first */
  legs: [2000, 2500, 3000, 3500, 4000, 4500],
  /** upgrade prices (drachmas) for levels 1…5 */
  upCost: [80, 200, 420, 800, 1400],
  upMax: 5,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** Gravity that gives a jump of `jumpTop` m lasting `jumpSec`. */
export const GRAVITY = (8 * RULES.jumpTop) / (RULES.jumpSec * RULES.jumpSec);
export const jumpV = (top: number): number => Math.sqrt(2 * GRAVITY * top);

/** Speed of a run `dist` metres in (m/s), before the block's and the stumble's factors. */
export const speedFor = (dist: number): number => RULES.vMin + (RULES.vMax - RULES.vMin) * (1 - Math.exp(-Math.max(0, dist) / RULES.vRise));

/** Difficulty 0..1 of the road `dist` metres into a run. */
export const difficultyFor = (dist: number): number => RULES.d0 + (1 - RULES.d0) * (1 - Math.exp(-Math.max(0, dist) / RULES.dRise));

/** How much of the flight a frame's level adds (0 at or below the threshold, 1 well above it). */
export const liftOf = (level: number): number => Math.max(0, Math.min(1, (level - RULES.liftFrom) / (RULES.liftFull - RULES.liftFrom)));
