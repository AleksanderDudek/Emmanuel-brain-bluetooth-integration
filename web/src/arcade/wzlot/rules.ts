/**
 * Every number of Wzlot's rules in one place (sim.ts re-exports it): the world, the hills, the
 * flight, the brain's influence, the session's blocks and the meta game.  Tuning moves a number
 * here and nowhere else; the tests and the headless harness read the same object.
 *
 * World units: x to the right and y up, in screen heights (sh) of a landscape play area at zoom 1.
 * A portrait phone shows the same world through a narrower window (layout.ts), so the terrain and
 * the physics are the same on every screen and a seeded ridge is the same for everyone.
 */
export const RULES = {
  // ── the world ────────────────────────────────────────────────
  /** a hill (≈ 0.85 sh) is about 40 m */
  mPerSh: 48,
  /** the physics' fixed step (s): the same inputs give the same flight on every device */
  step: 1 / 120,

  // ── the hills ────────────────────────────────────────────────
  hillsPerRidge: 16,
  /** a hill's wavelength, the downslope's share of it, and its drop from crest to trough (sh) */
  wave: [0.6, 1.1],
  downShare: [0.62, 0.74],
  drop: [0.1, 0.28],
  /** a ridge swells from gentle to bold: the drop's factor at its first and last hill */
  swell: [0.62, 1],
  /** the first-ever session's warm-up ridge ("Pierwsze zbocza") is this much gentler */
  gentle: 0.55,
  /** the steepest slope of a hill (tan) */
  slopeMax: 0.62,
  /** crests drift back toward the nest's level by this share of their offset per hill, rising at most riseMax (sh) */
  levelPull: 0.2,
  riseMax: 0.32,
  /** the crag at a ridge's end: a run-up dip (length, depth), a kicker (length) ending cragRise over the dip's start (net level: the speed carries), its steepest slope */
  cragRun: [0.45, 0.55],
  cragDip: [0.15, 0.2],
  cragKick: [0.3, 0.36],
  cragRise: [-0.04, 0],
  cragSlope: 1,
  /** the wadi after the crag: a cleft's width, its depth under the crag and the far rim's drop under it (sh) */
  wadiWidth: [0.32, 0.5],
  wadiDepth: 0.75,
  rimDrop: 0.4,
  /** "Długi przelot": the announced stretch's wide valley */
  wideWidth: [1.2, 1.45],
  wideDepth: 1.1,
  wideRimDrop: 0.42,
  /** the gentle warm-up ridge ends in a shallow dip, not a gorge */
  gentleWadi: { width: 0.5, depth: 0.32, rim: 0.2 },
  /** below the far rim by this much (sh) over a wadi, the eaglet cannot make it: the parent catches it */
  wadiMargin: 0.25,

  // ── the flight ───────────────────────────────────────────────
  /** gravity (sh/s²); holding folds the wings: × dive, on the ground and in the air */
  g: 6,
  dive: 2.2,
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
  /** open wings sink at most (sink0 − sinkW × W) × (sinkRef / vx)^sinkPow (sh/s, vx within sinkVx), eased in over sinkTau (s): height becomes long glides */
  sink0: 1.1,
  sinkW: 0.9,
  sinkRef: 1.5,
  sinkPow: 0.7,
  sinkVx: [0.6, 3],
  /** wing lift works with the airspeed: its gain over neutral is full from this forward speed (sh/s), ∝ v² below */
  liftV: 1.4,
  sinkTau: 0.25,
  /** a dive closer than magnetH (sh) above a downslope flares onto it: aimed magnetFlare rad per sh of height into the slope (at most magnetMaxInto), turning at magnetRate (1/s) */
  magnetH: 0.45,
  magnetRate: 40,
  magnetRateNear: 60,
  magnetSlope: -0.07,
  magnetFlare: 4,
  magnetMaxInto: 0.87,
  /** on the rail this close over the slope (sh) and lined up with it, the eaglet is down */
  touchH: 0.025,
  /** a hop shorter than this (s) is no landing (no class, no chain) */
  minAir: 0.1,
  /** landings: within `smooth`° of a downslope's tangent, the honest margin up to `near`°, a stall beyond `stall`° into an upslope */
  smooth: 10,
  near: 12,
  stall: 35,
  /** a stall needs a real upslope under it (tan): a steep drop onto flat ground is only rough */
  upslope: 0.05,
  /** a launch needs the ground to curve away this much faster than gravity holds the eaglet */
  launchMargin: 1.05,
  smoothBonus: 1.06,
  stallKeep: 0.55,
  /** three smooth landings in a row: soaring, +15 % at once and less drag until a rough landing */
  soarAfter: 3,
  soarBonus: 1.15,
  soarDrag: 0.8,
  /** after a stall the eaglet's own push rests this long (s), or until it crests */
  stun: 0.9,
  /** rolling back this long (s) calls the parent */
  rollBack: 0.8,
  /** the catch: the swoop (s), the carry's speed (sh/s) and least time, the release past the crest */
  swoop: 0.8,
  carrySpeed: 1.5,
  carryMin: 0.9,
  releaseV: 1,
  releaseAt: [0.16, 0.05],
  /** the start: off the nest's crest, down the first slope */
  startX: 0.04,
  startV: 0.9,
  /** stage 3's wingbeat: an upward and forward push, once per ridge; a double tap is two downs this close (s) */
  beatVy: 1.1,
  beatVx: 0.12,
  doubleTap: 0.32,

  // ── thermals (Wznoszenie) ────────────────────────────────────
  /** a thermal column's half-width (sh) and how far ahead of the eaglet it rises (sh) */
  thermalHalf: 0.2,
  thermalAhead: 1.15,
  /** the first comes this far into the block (s), the next ones this often */
  thermalFirst: 4.5,
  thermalEvery: 7.5,
  thermalMax: 3,
  /** a climb rises (rate0 + rateT × T) sh/s for (dur0 + durT × T) s, drifting forward at climbDrift */
  climbRate: [0.6, 1.4],
  climbDur: [1, 2],
  climbDrift: 0.3,
  /** leaving the column: at least this forward speed (sh/s) */
  climbExit: 1.15,
  /** a climb this high (sh above the ground: 150 m) opens a vista; with pity, this lower one (100 m) */
  vistaAlt: 150 / 48,
  vistaAltPity: 100 / 48,

  // ── the brain ───────────────────────────────────────────────
  /** Lekcja's wings: the lead-in (s) before they answer, and the level's extra smoothing (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  tauL: { fnirs: 2.5, eeg: 0.8 },
  /** W = max(neutral, w0 + wL × L): the band can only add */
  wNeutral: 0.55,
  w0: 0.3,
  wL: 0.6,
  /** how fast the drawn wings follow W (s) */
  wTau: 0.45,
  /** stage 2's first feathers: base lift × (1 + this) */
  stage2Lift: 0.05,
  /** follow steps: +step per full holdStep s of hold, up to max, easing off over decay s */
  holdStep: 6,
  stepBonus: 0.04,
  stepMax: 0.12,
  stepDecay: 3,
  /** returns: back with `hold` ≥ hold s after a lapse ≥ lapse s; +bonus for dur s, gold within gold s, at most `max` a block */
  ret: { fnirs: { lapse: 6, hold: 4 }, eeg: { lapse: 4, hold: 3 } },
  retBonus: 0.08,
  retDur: 4,
  retGold: 10,
  retMax: 3,
  /** Wznoszenie's thermal strength: dT/dt = gain × calm − leak after the lead-in (s), Mendi / HALO */
  tGain: 0.07,
  tLeak: 0.015,
  tLeadIn: { fnirs: 4, eeg: 2 },
  /** a passed Wznoszenie makes the next one's first thermal stronger */
  tPassBonus: 0.2,
  /** the neutral floor: a block with too few reliable seconds */
  tFloor: 0.4,
  minReliable: 8,
  /** after a dropout this long (s), nothing brain-driven may fall for `recover` s while the band climbs back */
  fogGap: 2,
  recover: 6,

  // ── the session ──────────────────────────────────────────────
  /** Lekcja and Wznoszenie: nominal length ± jitter (s); no block under minBlock */
  lekcja: [24, 4],
  wzn: [23, 3],
  minBlock: 12,
  telegraph: 4,
  finale: 6,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long (s) for a climb or a catch to finish */
  settle: 4,
  /** the ghost hand shows after this long without a touch in the warm-up (s) */
  idleHint: 3,
  /** Lekcja blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** the announced stretch ("Długi przelot") comes in sessions this long (s) */
  stretchFrom: 300,

  // ── the meta ─────────────────────────────────────────────────
  /** feathers: per saved session, per passed block, per mission; the day's gift */
  featherSession: 3,
  featherBlock: 1,
  featherMission: 1,
  featherGift: 2,
  /** plumage stages reached at these feather counts (stage 1 is the down) */
  stages: [0, 12, 30],
  /** vistas: a duplicate gives down, this much down crafts the next missing vista */
  dupDown: 5,
  craftDown: 10,
  /** the summary's median return time shows from this many returns */
  medianFrom: 3,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
