/**
 * Every number of Latarnik in one place (DESIGN.md §3.2): the beam and the flash, the reach the
 * band drives, the sea's boats, the blocks, the Cisza glow and its amber, and (version 2) the
 * nights with their goals and stars, the new boats (fog-bound, the flotilla, Edek's rowboat), the
 * whale, the squall's gusts, the workshop's upgrades and Zośka's bubble.
 *
 * Angles are radians, clockwise on screen; distances are in R, the sea's radius.
 */
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const RULES = {
  /** half-widths of the beam's wedge and of its "Idealnie" core (the lens widens both) */
  wedge: 10 * DEG,
  perfect: 4 * DEG,
  /** a flash is judged this long before the frame that received it (touch latency) */
  latency: 0.03,
  /** a flash on empty water: the lamp recharges this long (s); the oil shortens it */
  recharge: 0.6,
  /** the beam's turn (rad/s); the very first night turns slower; each night a little faster */
  speed: 104 * DEG,
  firstSpeed: 90 * DEG,
  speedStep: 3 * DEG,
  speedMax: 136 * DEG,
  reef: 0.18,
  /** boats drift in at `drift` R/s, at `driftSlow` inside `slowFrom` */
  slowFrom: 0.5,
  drift: 0.05,
  driftSlow: 0.03,
  bottleDrift: 0.02,
  leaveSpeed: 0.14,
  /** cargo bands: 1 crate inside `near`, 2 up to `far`, 3 beyond */
  near: 0.4,
  far: 0.7,
  reachMin: 0.42,
  reachGain: 0.58,
  /** the lens settles after a step of the bonuses (s) */
  reachTau: 0.6,
  holdStep: 6,
  holdBonus: 0.04,
  holdMax: 0.12,
  holdDecay: 3,
  /** sessions 1–3 of the game: +0.06 R, fading out */
  beginner: 0.06,
  /** after two failed Konwój blocks in a row the next gets a little help */
  failBoost: 0.04,
  tau: 3,
  tauEeg: 1,
  /** the band acts only after its delay into a Konwój (s): fNIRS, EEG */
  lead: 5,
  leadEeg: 2,
  /** the first watch's warm-up, a no-feedback pre-run: a fixed beam that reaches every warm-up boat, a steady lamp */
  warmReach: 0.62,
  warmLens: 0.6,
  lanterns: 3,
  maxBoats: 4,
  /** the warm-up keeps to two boats at a time, each placed ahead of the beam */
  warmBoats: 2,
  fullLight: 8,
  /** the sea glow grows from the shore while calm ≥ glowCalm */
  glowFrom: 0.18,
  glowGrow: 0.04,
  glowShrink: 0.02,
  glowMax: 0.6,
  glowCalm: 0.5,
  nuggets: 4,
  rareCalm: 0.6,
  rareSec: 12,
  legendContrast: 5,
  tallHold: 12,
  spawnEvery: 3,
  spawnJitter: 0.6,
  warmSpawnEvery: 3.5,
  /** no block is shorter, also when the plan gives fog's time back (s) */
  minBlock: 12,
  /** the lesson's beam waits on the first boat at most this long (s); the next boat follows soon after */
  lessonSec: 6,
  afterLesson: 1.5,
  /** a new night's first boat comes this soon (s) */
  watchFirst: 0.5,
  finale: 3.6,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: Zośka waits (s) */
  bannerSec: 4,
  starCrates: 5,
  /** a ship this close beyond the reach shows "zabrakło N%" */
  nearMiss: 0.08,
  /**
   * After a dropout of `fogGap` s the kit's level and calm have faded to zero and climb back over a
   * few seconds; for `recover` s after it nothing brain-driven may fall (the signal took it, not the player).
   */
  fogGap: 2,
  recover: 6,

  // ── version 2: the nights ──────────────────────────────────────
  /** the card between two nights (the stars, the next night's name) and the opening card (s) */
  nightCard: 3.2,
  openCard: 9,
  /** ★★★: a run of this many perfects within the night */
  streakStar: 5,
  /** ★★: at most this many lanterns lost in the night */
  lostStar: 1,

  // fog-bound boats: dark until the beam passes over them within its reach, then seen for a while
  fogEvery: 5.5,
  fogBand: [0.6, 0.92] as readonly [number, number],
  fogSeen: 2.2,
  /** each level of the bell keeps them seen longer and rings where they hide */
  bellSeen: 1.1,
  bellRing: 3,

  // the flotilla: numbered boats that come home in order; they sail slower
  flotillaSize: 3,
  flotillaDrift: 0.022,
  flotillaBand: [0.58, 0.82] as readonly [number, number],

  // Edek's rowboat: dark, drifting sideways; it bumps the reef and rows back out at no cost
  rowDrift: 0.014,
  rowTurn: 0.14,
  rowBand: [0.55, 0.85] as readonly [number, number],
  rowBack: 0.72,
  rowFirst: 4,
  rowEvery: 9,

  // the whale: bubbles first, then it surfaces for a moment; a flash on it is a bonus, never a cost
  whaleFrom: 2,
  whaleEvery: [16, 26] as readonly [number, number],
  whaleWarn: 1.6,
  whaleUp: 2.8,
  whaleCrates: 6,
  whaleBand: [0.4, 0.82] as readonly [number, number],

  // the squall (every 5th night): telegraphed gusts that throw the beam and push the boats
  gustEvery: [5.5, 8] as readonly [number, number],
  gustWarn: 1.6,
  gustBlow: 2,
  gustFast: 2.1,
  gustBack: -0.85,
  gustPush: 0.18,

  // the workshop: what each level does
  lensWedge: 1 * DEG,
  lensPerfect: 0.5 * DEG,
  oilRecharge: 0.12,
  /** the second beam, opposite the first, reaches this share of the reach */
  secondReach: 0.62,

  // Zośka's bubble
  talkGap: 2.2,
  talkMin: 2.2,
  talkMax: 4,
} as const;

/** Where boats appear (R). */
export const BANDS = {
  horizon: [0.9, 0.99],
  mid: [0.48, 0.68],
  near: [0.38, 0.46],
  /** the warm-up's boats: three passes of the beam or more before the reef */
  warm: [0.5, 0.6],
  /** the night's first boat: within any reach the lamp starts with */
  first: [0.45, 0.53],
} as const satisfies Record<string, readonly [number, number]>;
export type Band = keyof typeof BANDS;

/** The workshop's four upgrades, their top levels and their costs in crates, level by level. */
export const UPGRADES = ['lens', 'oil', 'bell', 'beam'] as const;
export type Upgrade = (typeof UPGRADES)[number];
export const UPGRADE_MAX: Record<Upgrade, number> = { lens: 3, oil: 3, bell: 2, beam: 1 };
export const UPGRADE_COST: Record<Upgrade, readonly number[]> = {
  lens: [40, 110, 220],
  oil: [50, 120, 230],
  bell: [60, 150],
  beam: [260],
};

/** The village's eight steps stand at these totals of night stars (the map lights up as nights are kept). */
export const VILLAGE_STARS: readonly number[] = [1, 3, 6, 10, 14, 19, 24, 30];
