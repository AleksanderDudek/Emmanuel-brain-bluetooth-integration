/**
 * Every number of Jerzy i smok's rules in one place (sim.ts re-exports it): the arena, the knight,
 * his strike and roll, the shield, the Miecz światła, the dragons' fire and patterns, the heart and
 * the princess's apple, the Postój, the levels and skills of a fight, the blocks and the meta.
 * Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * The world is a top-down arena `arenaW` × `arenaH` u (about a metre each), x to the right, y down;
 * the dragon's cave is at the top left, the fence with its pennants runs along the top.
 */
export const RULES = {
  // ── the arena ────────────────────────────────────────────────
  arenaW: 10,
  arenaH: 8,
  /** where the knight starts, where the dragon lands when it arrives, and the cave's mouth (u) */
  knightStart: [5, 6.2],
  dragonLand: [5, 2.7],
  cave: [1.3, -0.6],
  /** the dragon flies in (s), to and from its cave (s) */
  arriveSec: 1.8,
  flySec: 1.4,

  // ── the knight (touch: anything under 2 s) ───────────────────
  knightR: 0.36,
  walk: 3.4,
  /** a tap this close to the dragon's body (u, beyond its radius) means "go and fight it": he follows */
  engageR: 1.4,
  /** he strikes by himself when the dragon's body is this close to his own (u, edge to edge) */
  reach: 1.0,
  /** seconds between strikes */
  swing: 0.7,
  /** hit-stop (s): a strike, the Miecz światła, a phase, the dragon driven off */
  stopHit: 0.04,
  stopSword: 0.2,
  stopPhase: 0.25,
  stopDriven: 0.35,
  /** the roll: how far (u), how long (s), invulnerable (s), ready again after (s) */
  rollDist: 2.4,
  rollSec: 0.32,
  rollSafe: 0.42,
  rollCool: 0.8,
  /** a swipe: this far (px) within this long (s) of the touch */
  swipePx: 34,
  swipeSec: 0.3,

  // ── the shield (the live gauge: Tarcza) ──────────────────────
  /** radius = shieldMin + level × shieldExtra (u) in a sighted Tarcza past its lead-in; the buckler otherwise */
  shieldMin: 0.25,
  shieldExtra: 1.6,
  /** the shield's centre sits this far in front of the knight (u) */
  shieldAhead: 0.38,
  /** how fast the drawn and acting shield follows its target (s) */
  shieldTau: 0.35,
  /** the lead-in before the band moves the shield (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },

  // ── the Miecz światła (quenched fire and hold) ───────────────
  /** charge per quenched flame of a breath, per quenched fireball or drop */
  quenchBlob: 0.03,
  quenchBall: 0.12,
  /** a held focus this long (s) also fills it, this much per second */
  holdNeed: { fnirs: 5, eeg: 3 },
  holdRate: 0.07,
  /** the great strike knocks off this many scales (no more than the phase has left) */
  swordScales: 10,

  // ── the dragons' fire and patterns ───────────────────────────
  /** the breath: a cone this wide (half angle, rad) and long (u); flames per second, their speed (u/s) and size (u) */
  coneHalf: 0.36,
  coneLen: 5.2,
  blobRate: 24,
  blobSpeed: 6.5,
  blobR: 0.16,
  breathSec: 1.25,
  /** fireballs and drops: their splash (u), how far they scatter around the knight (u), their flight (s) */
  splashR: 0.75,
  scatter: 1.3,
  ballFlight: 1.0,
  /** the tail's sweep: a ring around the dragon from inner to outer (u) */
  sweepIn: 0.6,
  sweepOut: 2.9,
  /** the bite: a lunge this long (u) and wide (u) */
  biteLen: 2.2,
  biteW: 1.3,
  /** the marsh dive: under for this long (s), the splash when it surfaces (u) */
  diveSec: 1.5,
  diveR: 1.5,
  /** the swoop: a lane this wide (u), flown at this speed (u/s) */
  swoopW: 1.5,
  swoopSpeed: 11,
  /** telegraphs (s) before an attack lands, and how they quicken by phase (× per phase) */
  tele: { breath: 1.0, sweep: 0.9, bite: 0.8, balls: 1.0, dive: 0.9, swoop: 1.1, rain: 1.0 },
  teleFast: 0.88,
  /** the warm-up's slower telegraphs */
  teleWarm: 1.35,
  /** between attacks the dragon repositions this long (s) at this speed (u/s), keeping this distance from the knight (u, centres) */
  moveSec: [0.8, 1.5],
  moveSpeed: 2.2,
  keep: [1.5, 3.1],
  /** the flaw: after an attack the dragon is open this long (s) */
  flawSec: 2.0,
  /** a roar at a new phase: invulnerable (s), and how far it pushes the knight (u) */
  roarSec: 1.2,
  roarPush: 1.6,
  /** the circles: after the last dragon the kingdom's dragons come back this much stronger per circle */
  circleUp: 0.3,

  // ── the heart and grace ──────────────────────────────────────
  /** losses of heart (1 = full): a flame of the breath, a fireball or drop, the tail, the bite, the dive, the swoop */
  hurt: { blob: 0.045, ball: 0.14, sweep: 0.2, bite: 0.16, dive: 0.22, swoop: 0.22 },
  /** invulnerable after a flame (s) and after a blow (s) */
  safeBlob: 0.25,
  safeBlow: 0.8,
  /** knocked down: on the ground this long (s), up with this much heart, the dragon catches its breath (s) */
  downSec: 2.3,
  heartBack: 0.5,
  breather: 2.6,

  // ── the Postój (rest) ────────────────────────────────────────
  /** calm restores heart (per s at calm 1) and fills Linda's tip (per s at calm 1) after this lead-in (s) */
  heal: 0.035,
  tipGain: 0.075,
  restLead: { fnirs: 4, eeg: 2 },

  // ── levels and skills (one fight) ────────────────────────────
  /** scales to the next level: levelBase + levelStep × level */
  levelBase: 10,
  levelStep: 9,
  /** the choice: the fight goes on at this speed, the first is taken after this long (s) */
  choiceSlow: 0.15,
  choiceSec: 6,
  /** the skills' numbers */
  spinEvery: [3, 2],
  lanceEvery: [6, 4.5, 3.5],
  lanceScales: 2,
  lanceRange: 7.5,
  horseEvery: [14, 10],
  horseScales: 4,
  horseSec: 1.1,
  squireEvery: [4, 3],
  squireRange: 3.2,
  swiftK: 0.82,
  shieldUp: 0.14,
  reflectChance: 0.3,
  armourCool: 0.7,
  armourWalk: 0.12,
  reachUp: 0.35,

  // ── the session ──────────────────────────────────────────────
  /** Tarcza and Postój: nominal length ± jitter (s); no block under minBlock */
  push: [24, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: Linda waits it out */
  bannerSec: 5.4,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last clash (s): sessions of 2 min and more / shorter */
  finale: { long: 16, short: 8 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** Tarcza blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the warm-up's ghost hand shows after this long without a touch (s) */
  idleHint: 3,
  /** the opening card (the first session): at most this long (s), a tap closes it */
  openSec: 7,
  /** the story card between two dragons (s) */
  storySec: 3.4,
  /** a hold this long (s) counts as a long stand; this many quenched flames count as many (closing verses) */
  longHold: 12,
  manyQuench: 30,

  // ── Linda's lines ────────────────────────────────────────────
  /** a line stays 2–4 s (by its length), at least this long between two (s) */
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.6,
  /** the level stays above the threshold this long (s) before she cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
