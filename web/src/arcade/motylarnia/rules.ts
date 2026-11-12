/**
 * Every number of Motylarnia's rules in one place: the garden, the caterpillar and its sprint, food
 * and the chain, the reach (Apetyt) the band drives, the chrysalis colours calm deepens, rivals,
 * birds, the gardens' goals, the blocks and the companion.  Tuning moves a number here and nowhere
 * else; the tests read the same object.
 *
 * The world is a top-down garden `worldW` × `worldH` u, x to the right, y down.  A segment of the
 * caterpillar is `spacing` u long; 1 segment of length = 1 cm on the score corner's second line.
 */
export const RULES = {
  // ── the garden ───────────────────────────────────────────────
  worldW: 1800,
  worldH: 1200,
  /** the hedge: this far from the edge the caterpillar is turned back in (u) */
  hedge: 40,

  // ── the caterpillar (touch: anything under 2 s) ──────────────
  spacing: 9,
  /** body radius: base + per segment, at most max (u) */
  girth: [8, 0.09, 15] as readonly [number, number, number],
  startLen: 8,
  minLen: 6,
  speed: 118,
  sprint: 215,
  /** rad/s, a little slower when long (min factor) */
  turn: 3.4,
  turnLong: 0.7,
  /** a press shorter than this is a tap (steer); held longer it sprints (s) */
  holdSec: 0.22,
  /** ←/→ turn at this share of the full turn rate */
  keyTurn: 1,
  /** the sprint costs one segment per this many seconds (above `sprintFreeLen`), dropped as a crumb */
  sprintCost: 1.1,
  sprintFreeLen: 10,
  /** a stumble: the share of the length lost (at least `stumbleMin` segments), curled for `curlSec`, safe for `safeSec` */
  stumbleShare: 0.2,
  stumbleMin: 2,
  curlSec: 0.7,
  safeSec: 1.6,
  /** own body: segments closer than this to the head (by index) never trip it */
  selfSkip: 10,
  /** hit-stop (s): a stumble, a rival curled, a garden done */
  stopStumble: 0.08,
  stopCurl: 0.06,
  stopGoal: 0.18,
  /** moults (a brighter skin, a cheer) at these lengths */
  moults: [16, 28, 44, 64] as readonly number[],

  // ── food ─────────────────────────────────────────────────────
  /** growth (segments) and points per kind */
  food: {
    leaf: { grow: 0.2, pts: 1, r: 7 },
    flower: { grow: 0.6, pts: 3, r: 9 },
    dew: { grow: 0.35, pts: 2, r: 7 },
    crumb: { grow: 0.2, pts: 1, r: 5 },
    rare: { grow: 2, pts: 25, r: 16 },
  },
  /** how many of each the garden keeps (scaled by the garden's area share) */
  leaves: 230,
  flowers: 26,
  /** dewdrops in a rest block (they evaporate after it) */
  dews: 46,
  /** the eat radius beyond the head's own radius (u) */
  mouth: 6,
  /** chain: items eaten within this many seconds of each other; ×1 + 1 per `chainStep` items, at most ×5 */
  chainSec: 1.0,
  chainStep: 6,
  chainMax: 5,

  // ── the reach (Apetyt: the live gauge) ───────────────────────
  /** radius = reachBase + level × reachExtra (u) in a sighted push block past its lead-in; reachBase otherwise */
  reachBase: 26,
  reachExtra: 130,
  /** how fast the drawn and acting reach follows its target (s) */
  reachTau: 0.6,
  /** food in reach drifts to the mouth at up to this speed (u/s) */
  pull: 300,
  /** the lead-in before the band moves the reach (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the free sprint: a sighted push block, past the lead-in, level ≥ this */
  freeSprint: 0.5,

  // ── the chrysalis (calm: the colours) ────────────────────────
  /** a chrysalis starts at this depth (+ per star); calm adds `depthRate` × (calm − 0.5 … ) per second */
  depthBase: 0.3,
  depthStar: 0.06,
  depthRate: 0.07,
  /** never hatches paler than this (a bad signal is never a loss) */
  depthFloor: 0.35,
  /** radiant: hatched at least this deep from a rest block that passed */
  radiantDepth: 0.78,
  /** at most this many chrysalises wait on the twig */
  twigMax: 4,

  // ── rivals (AI caterpillars) ─────────────────────────────────
  rivalSpeed: 92,
  rivalTurn: 2.6,
  /** a curled rival drops this share of its length as crumbs; comes back after (s) */
  rivalDrop: 0.7,
  rivalBack: 6,
  rivalCurlPts: 10,
  /** in a rest block rivals crawl at this share of their speed */
  restSlow: 0.55,

  // ── birds ────────────────────────────────────────────────────
  birdR: 15,
  birdHop: 46,
  /** a swoop: the shadow grows for `swoopWarn` s, then the bird pecks a circle of `peckR` u */
  swoopEvery: [7, 12] as readonly [number, number],
  swoopWarn: 1.4,
  peckR: 44,
  /** a near miss: the head this close to a peck that missed (u) */
  nearR: 70,

  // ── stars ────────────────────────────────────────────────────
  /** two stars: at most this many stumbles in the garden */
  starStumbles: 1,
  gardenPts: 20,

  // ── the session ──────────────────────────────────────────────
  push: [25, 3] as readonly [number, number],
  rest: [22, 3] as readonly [number, number],
  minBlock: 10,
  telegraph: 3.5,
  /** the runner's banner covers the first seconds of a block: Hieronim waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 8 in a short test */
  warm: { long: 30, short: 20, test: 8 },
  /** the finale (s): the chrysalises hatch, the butterflies fly to the glasshouse */
  finale: 4.5,
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the spin cutscene (s) and the garden card after it (s) */
  spinSec: 1.6,
  cardSec: 2.6,
  /** the opening card of the first session: at most this long (s), a tap closes it (the story and the verse read
   *  at a phone's pace; "Stuknij, by zacząć" says how to close it sooner) */
  openSec: 12,
  /** Hieronim keeps quiet this long after a coach mark appears (it shows 4.2 s) */
  teachQuiet: 4.2,
  /** a session-end caterpillar this share of its goal long still spins */
  lateShare: 0.6,

  // ── Hieronim's lines ─────────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.8,
  /** the reach stays beyond the threshold this long (s) before he cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** The caterpillar's body radius at a length (u). */
export const girthOf = (len: number): number => Math.min(RULES.girth[2], RULES.girth[0] + RULES.girth[1] * len);

/** The reach for a level (u): the band can only add. */
export const reachFor = (level: number): number => RULES.reachBase + Math.min(1, Math.max(0, level)) * RULES.reachExtra;
/** The reach at the threshold (level 0.5): the dotted ring. */
export const REACH_MARK = reachFor(0.5);
