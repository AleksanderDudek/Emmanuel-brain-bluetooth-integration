/**
 * Every number of Wzlot's rules in one place (sim.ts re-exports it): the world, the granie (Tiny
 * Wings' islands), the flight, the day and its sun, the points, the Poryw (fever), the band's
 * influence, the session's blocks, the companion and the meta.  Tuning moves a number here and
 * nowhere else; the tests read the same object.
 *
 * World units: x to the right and y up, in screen heights (sh) of a landscape play area at zoom 1.
 */
export const RULES = {
  // ── the world ────────────────────────────────────────────────
  /** a hill (≈ 0.85 sh) is about 40 m */
  mPerSh: 48,
  /** the physics' fixed step (s): the same inputs give the same flight on every device */
  step: 1 / 120,

  // ── the granie (islands) ─────────────────────────────────────
  /** hills on the first grań, one more on each next one, at most hillsMax */
  hills0: 7,
  hillsMax: 13,
  /** a hill's wavelength, the downslope's share of it, and its drop from crest to trough (sh) */
  wave: [0.6, 1.1],
  downShare: [0.6, 0.72],
  drop: [0.1, 0.28],
  /** a grań grows bolder: the drop's factor at the first grań, + per grań, at most */
  bold0: 0.72,
  boldStep: 0.07,
  boldMax: 1.2,
  /** the waves grow longer by this share per grań (at most 8 granie) */
  waveGrow: 0.04,
  /** a grań swells from gentle to bold: the drop's factor at its first and last hill */
  swell: [0.62, 1],
  /** the first-ever session's first grań is this much gentler */
  gentle: 0.55,
  /** the steepest slope of a hill (tan) */
  slopeMax: 0.62,
  /** crests drift back toward level 0 by this share of their offset per hill, rising at most riseMax (sh) */
  levelPull: 0.2,
  riseMax: 0.32,
  /** the grań's end: a long run-up dip (length, depth), the kicker (length) ending cragRise over the dip's start, its steepest slope */
  cragRun: [0.75, 0.95],
  cragDip: [0.3, 0.4],
  cragKick: [0.3, 0.36],
  cragRise: [-0.04, 0.02],
  cragSlope: 1,
  /** the gorge to the next grań: its width (+ per grań), its depth under the crag, the far rim's drop under the crag (sh) */
  gapWidth: [0.9, 1.15],
  gapGrow: 0.06,
  gapDepth: 0.9,
  rimDrop: [0.42, 0.55],
  /** below the far rim by this much (sh) over a gorge, the eaglet cannot make it: the mother catches it */
  gapMargin: 0.25,
  /** promyki (Tiny Wings' coins): strings per grań, coins in a string, spacing (sh), height over the ground (sh) */
  strings: [3, 5],
  stringLen: [5, 8],
  coinGap: 0.075,
  coinLift: 0.06,
  /** an arc over a crest: its height (sh) */
  arcLift: [0.18, 0.36],
  /** pickup radius (generous, §10.3.2) */
  coinR: 0.075,
  /** podmuch (Tiny Wings' speed orb): one per grań over a valley, this high over its trough (sh), its pickup radius, its boost */
  orbLift: [0.28, 0.42],
  orbR: 0.1,
  orbBoost: 1.25,
  /** the cloud deck (world y, sh): touching it scores, at most once per cloudGap s */
  cloudY: 1.45,
  cloudGap: 1.5,

  // ── the flight (Tiny Wings' verb) ─────────────────────────────
  /** gravity (sh/s²); holding makes the eaglet heavy — × dive, on the ground and in the air */
  g: 6,
  dive: 2.2,
  /** a tap is a hold of at least this long (s): short taps still dive a little */
  minHold: 0.12,
  /** speed's soft caps (sh/s): a push below vMin keeps the eaglet going, drag grows above vMax */
  vMin: 0.9,
  vMax: 3,
  floorPush: 12,
  floorRate: 12,
  capRate: 3,
  /** friction on the ground (× the weight on it) and drag (∝ v²) on the ground and in the air */
  friction: 0.05,
  groundDrag: 0.035,
  airDrag: 0.03,
  /** open wings sink at most (sink0 − sinkW × W) × (sinkRef / vx)^sinkPow (sh/s), eased in over sinkTau (s) */
  wing: 0.62,
  sink0: 1.1,
  sinkW: 0.9,
  sinkRef: 1.5,
  sinkPow: 0.7,
  sinkVx: [0.6, 3],
  liftV: 1.4,
  sinkTau: 0.25,
  /** a dive close above a downslope flares onto it */
  magnetH: 0.45,
  magnetRate: 40,
  magnetRateNear: 60,
  magnetSlope: -0.07,
  magnetFlare: 4,
  magnetMaxInto: 0.87,
  touchH: 0.025,
  /** a hop shorter than this (s) is no landing */
  minAir: 0.1,
  /** landings: within `smooth`° of a downslope's tangent (perfect), up to `near`° the honest margin, a bump beyond `stall`° into an upslope */
  smooth: 11,
  near: 14,
  stall: 32,
  upslope: 0.05,
  /** a launch needs the ground to curve away this much faster than gravity holds the eaglet */
  launchMargin: 1.05,
  smoothBonus: 1.06,
  /** a bump keeps this share of the speed and rests the eaglet's push for `stun` s */
  bumpKeep: 0.55,
  stun: 0.9,
  /** rolling back this long (s) calls the mother */
  rollBack: 0.8,
  /** the catch: the swoop (s), the carry's speed (sh/s) and least time, the release past the crest */
  swoop: 0.8,
  carrySpeed: 1.6,
  carryMin: 0.9,
  releaseV: 1.1,
  releaseAt: [0.16, 0.05],
  startX: 0.05,
  startV: 0.9,

  // ── the Poryw (Tiny Wings' fever) ─────────────────────────────
  /** perfect slides in a row that light it */
  feverAfter: 3,
  /** at once faster by this, a higher cap and less drag while it lasts */
  feverBoost: 1.15,
  feverCap: 1.15,
  feverDrag: 0.8,
  /** a Poryw from the band: this many seconds of focused hold fill it; it is safe from bumps for bandFever s */
  feverHold: { fnirs: 10, eeg: 7 },
  bandFever: 8,

  // ── the day and its sun ───────────────────────────────────────
  /** daylight at dawn (s); the first-ever session's first day is longer */
  day0: 40,
  dayFirst: 52,
  /** the sun's arc spans this many seconds of daylight (more is the sun higher than noon) */
  dayMax: 80,
  /** a grań reached: daylight back (granSun for the first, granStep less for each next, never under granMin), + up to `quickSun` for a quick one (par: parPerHill s per hill) */
  granSun: 8,
  granStep: 1,
  granMin: 1.5,
  quickSun: 4,
  parPerHill: 1.5,
  /** focus holds the sun: the night comes at 1 − holdMax × clamp(2L − 1) of its pace */
  holdMax: 0.5,
  /** a passed push block: daylight back (s) */
  pushSun: 4,
  /** the night is near: the companion and the coach mark speak below this (s) */
  nightNear: 12,
  /** nightfall: the eaglet dozes off for this long (s), the tally shows at least tallyMin and at most tallyMax s; a dawn waits for a touch at most dawnWait s */
  dusk: 2.4,
  tallyMin: 1.6,
  tallyMax: 4.5,
  dawnWait: 2.2,
  openWait: 7,

  // ── points (× the nest's multiplier, × 2 in a Poryw) ──────────
  ptsPerM: 0.25,
  perfect: 50,
  perfectStep: 10,
  perfectMax: 100,
  /** a flight longer than airFrom s scores airPts a second on landing */
  airFrom: 1,
  airPts: 20,
  coin: 5,
  orb: 20,
  cloud: 30,
  gran: 250,
  quick: 150,
  /** the leap over a gorge without the mother's help */
  leap: 100,
  climbTop: 40,
  blockPass: 100,

  // ── thermals (rest) ───────────────────────────────────────────
  thermalHalf: 0.2,
  thermalAhead: 1.15,
  thermalFirst: 4.5,
  thermalEvery: 5.5,
  thermalMax: 3,
  climbRate: [0.6, 1.4],
  climbDur: [1, 1.6],
  climbDrift: 0.3,
  climbExit: 1.2,
  /** T: dT/dt = gain × calm − leak after the lead-in; never under the floor; a passed rest starts the next at tPass */
  tGain: 0.07,
  tLeak: 0.015,
  tFloor: 0.15,
  tPass: 0.4,
  tLeadIn: { fnirs: 4, eeg: 2 },

  // ── the brain ────────────────────────────────────────────────
  leadIn: { fnirs: 5, eeg: 2 },
  tauL: { fnirs: 2.5, eeg: 0.8 },
  /** after this long without signal (s) the brain's influence eases to neutral */
  gap: 2,

  // ── the session ──────────────────────────────────────────────
  push: [24, 4],
  rest: [23, 3],
  minBlock: 12,
  telegraph: 4,
  /** the last sunset: the session's last seconds bring the night */
  finale: 6,
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long (s) */
  settle: 4,
  blindEvery: 4,
  blindFrom: 3,
  /** the runner's banner covers the first seconds of a block: the companion waits */
  banner: 4.5,

  // ── the companion (Leon the lark) ───────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.2,
  talkChars: 90,

  // ── the meta ─────────────────────────────────────────────────
  /** the nest's multiplier is its level; the plumage grows at these levels */
  plumage: [3, 5],
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
