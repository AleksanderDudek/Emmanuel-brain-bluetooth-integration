/**
 * Every number of Pasterz's rules in one place (sim.ts re-exports it): the hills, the shepherds and
 * their flocks, the contest between flocks (Crowd City's rule: the bigger flock wins the smaller
 * one's sheep at the contact), the call ring, the sheepdog, the rounds, the blocks and the meta.
 * Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * World units are metres on the hill, seen from above: x to the right, y down the screen.
 */
export const RULES = {
  // ── the hill ─────────────────────────────────────────────────
  /** the map's size (m) and the keep-out strip along its edge */
  mapW: 64,
  mapH: 64,
  edge: 1,
  /** obstacles per hill (counts, radii in m) */
  rocks: [10, 16],
  rockR: [0.55, 1.3],
  trees: [7, 13],
  treeR: 0.45,
  canopyR: [1.5, 2.2],
  bushes: [6, 11],
  bushR: [0.55, 0.9],
  /** the dry-stone pens: radius, wall half thickness (m), the gate's half angle (rad), sheep inside */
  penR: [3.2, 4.2],
  penWall: 0.32,
  penGate: 0.42,
  penSheep: [10, 18],
  /** the river: half width (m), meander amplitude (m) and wavelength (m), the bridges' half width (m) */
  riverHalf: 1.5,
  riverAmp: [2, 5],
  riverWave: [26, 40],
  bridgeHalf: 1.3,
  /** loose sheep on a fresh hill: groups, sheep per group, the group's spread (m) */
  groups: [14, 19],
  group: [3, 8],
  groupR: 1.7,
  /** when fewer loose sheep than this graze, a straggler wanders in every `trickle` s */
  looseMin: 40,
  trickle: 0.55,
  maxSheep: 420,

  // ── the shepherds ────────────────────────────────────────────
  /** the player's walk (m/s), its easing (s), the body's radius (m) */
  speed: 4.3,
  accelTau: 0.12,
  radius: 0.42,
  /** a big flock walks a little slower: speed × (1 − slowPer × √n), never below `slowMin` */
  slowPer: 0.012,
  slowMin: 0.8,
  /** without a finger or a key for this long (s), Łatek leads the shepherd to the nearest loose sheep at this share of the speed */
  autoAfter: 1.2,
  autoSpeed: 0.72,
  /** the joystick: a drag this long (px) is full speed (the drawn base's radius); a finger that moved less than `deadPx` is a tap */
  stickPx: 46,
  deadPx: 10,
  tapSec: 0.32,
  /** the rival shepherds: how many, their speed (× the player's), how often they think (s) */
  rivals: 5,
  rivalSpeed: 0.86,
  thinkSec: 0.35,
  /** a rival hunts a flock smaller than `hunt` × its own within `huntR` m, and flees one bigger than `flee` × its own within `fleeR` m */
  hunt: 0.8,
  huntR: 12,
  flee: 1.15,
  fleeR: 9,
  /** rivals start a later round with this many sheep each (round index × `rivalStart`, at most `rivalStartMax`) */
  rivalStart: 2,
  rivalStartMax: 8,
  /** a rival's comic habit: every `habit` s ± half, for `habitSec` s it stops (a nap, a snack, a chat) */
  habit: [9, 16],
  habitSec: 1.6,

  // ── the sheep ────────────────────────────────────────────────
  /** the body's radius, the spacing they keep (m), the follower's top speed (m/s) */
  sheepR: 0.36,
  sepR: 0.82,
  maxSpeed: 5.2,
  /** the flock keeps this far around its shepherd (m): keep0 + keepN × √n */
  keep0: 0.8,
  keepN: 0.34,
  /** how fast a sheep's velocity follows what it wants (s) */
  steerTau: 0.16,
  /** loose sheep graze around their spot at this speed (m/s), a new spot every few seconds */
  grazeSpeed: 0.45,
  /** touch: a loose sheep this close to a flock's sheep or its shepherd joins it (m) */
  joinR: 0.85,
  /** contact between two flocks (m), and a converted sheep's immunity before it can switch again (s) */
  contactR: 0.8,
  immune: 0.45,
  /** conversions per flock per second (the contact streams, it does not snap) */
  convertRate: 22,
  /** a shepherd this close to a bigger flock's sheep, with no sheep of his own, is out (a rival) or tumbles (the player) */
  outR: 0.9,

  // ── the call ring (the live gauge) ────────────────────────────
  /** radius = r0 + level × rExtra (m) in a sighted Wołanie past the lead-in; r0 always (grace) */
  r0: 1.5,
  rExtra: 6,
  /** how fast the ring follows its target (s) */
  ringTau: 0.4,
  /** the lead-in before the band moves the ring (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },

  // ── Głos (the voice across the hill) ─────────────────────────
  /** a held focus this long (s) sends the voice; again after `voiceAgain` more seconds; at most `voiceMax` a block */
  voiceHold: { fnirs: 5, eeg: 3 },
  voiceAgain: 10,
  voiceMax: 2,
  /** every loose sheep this close (m) hears it; the lost lamb's compass shows this long (s) */
  voiceR: 15,
  compassSec: 7,

  // ── Łatek, the sheepdog ───────────────────────────────────────
  /** a tap or Space whistles: the dog runs (m/s) to the nearest loose sheep within `dogReach` m, and herds every loose sheep within `herdR` m; again after `whistleCool` s */
  dogSpeed: 9,
  dogReach: 11,
  herdR: 2.4,
  whistleCool: 3.2,

  // ── the lost lamb (Luke 15:4) ────────────────────────────────
  /** hidden at least this far from the start (m), picked up this close (m), bleats every `bleat` s; carried home it is worth `lambBonus` */
  lambDist: 24,
  lambPick: 1.3,
  bleat: 7,
  lambBonus: 10,

  // ── grace for the player ─────────────────────────────────────
  /** eaten down to the shepherd: Łatek pulls him to a quiet spot; nothing can touch him for this long (s) */
  graceSec: 3,

  // ── the rounds ───────────────────────────────────────────────
  /** the first place's bonus: + share of the flock + a flat number; the second's flat number */
  crownShare: 0.2,
  crownFlat: 5,
  secondFlat: 2,
  /** the tally card between rounds (s): the world holds still while it shows */
  tallySec: 3.6,
  /** the hundred grows by flock / `hundredPer` (at least 1) per round */
  hundredPer: 10,
  hundred: 100,

  // ── Nocna straż (rest) ───────────────────────────────────────
  /** stars: d(stars)/dt = gain × calm after the lead-in (s), Mendi / HALO; at most `max` */
  starGain: 0.75,
  starMax: 12,
  starLead: { fnirs: 4, eeg: 2 },
  /** each rival's flock grows by this many stragglers in a night */
  rivalNight: [2, 4],
  /** how fast the night falls and lifts (s) */
  nightTau: 1.1,
  /** morning lambs: a passed night's base, +1 at each of these star counts; a night without a pass still brings `graceLambs` */
  morning: 2,
  morningAt: [6, 10],
  graceLambs: 1,

  // ── the session ──────────────────────────────────────────────
  /** Wołanie and Nocna straż: nominal length ± jitter (s); no block under minBlock */
  push: [24, 4],
  rest: [23, 3],
  minBlock: 12,
  telegraph: 4,
  finale: 6,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** Wołanie blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** the blind block's flare lasts this long (s) */
  flareSec: 3,
  /** the runner's block banner covers the first seconds of a block: the dog keeps quiet (s) */
  bannerSec: 5.4,

  // ── the companion ────────────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.5,
  /** at most this many characters in a bubble */
  talkChars: 90,

  // ── the meta ─────────────────────────────────────────────────
  /** a new cosmetic every `unlockEvery` sheep gathered (all time) */
  unlockEvery: 60,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
