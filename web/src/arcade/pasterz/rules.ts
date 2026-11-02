/**
 * Every number of Pasterz's rules in one place (sim.ts re-exports it): the hill, the shepherd's
 * walk, the sheep, the call ring, the pastures, the blocks and the meta game.  Tuning moves a
 * number here and nowhere else; the tests read the same object.
 *
 * World units are metres on the hill, seen from above: x to the right, y down the screen.
 */
export const RULES = {
  // ── the hill ─────────────────────────────────────────────────
  /** the pasture's size (m) and the keep-out strip along its edge */
  mapW: 52,
  mapH: 52,
  edge: 1.2,
  /** where the shepherd starts (share of the map) */
  startAt: [0.5, 0.36],
  /** obstacles: thorn bushes, rocks and terrace walls (counts, radii and lengths in m) */
  bushes: [9, 12],
  bushR: [0.55, 0.95],
  rocks: [10, 14],
  rockR: [0.5, 1.25],
  terraces: [3, 5],
  terraceLen: [6, 12],
  /** a terrace wall's half thickness (m) */
  wallHalf: 0.35,
  /** nothing solid this close to the start (m) */
  clearStart: 6,
  /** the stream: its share of the map's height, its meander (m), its width (m), wading slows to this */
  streamAt: [0.66, 0.78],
  streamAmp: [2.5, 5],
  streamHalf: 0.85,
  wade: 0.6,
  fords: 3,

  // ── the shepherd ─────────────────────────────────────────────
  /** walking speed (m/s), its easing (s), slowing near the goal (m), the body's radius (m) */
  speed: 3.6,
  accelTau: 0.14,
  arrive: 1.1,
  radius: 0.38,
  /** the night's walk is slower (× speed) */
  nightWalk: 0.55,
  /** a footprint every stride (m); prints older than the trace's window fade away */
  stride: 0.62,
  prints: 160,

  // ── the call ring (the live gauge) ────────────────────────────
  /** radius = r0 + level × rExtra (m) in a sighted Wołanie past the lead-in; r0 always (grace) */
  r0: 2.6,
  rExtra: 4,
  /** how fast the drawn and gathering ring follows its target (s) */
  ringTau: 0.35,
  /** the lead-in before the band moves the ring (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** Space: the shepherd's call, a ring flash; sheep this many ring radii away look up */
  callSec: 0.6,
  lookRings: 2,
  lookSec: 1.6,

  // ── Głos (the voice across the hill) ─────────────────────────
  /** a held focus this long (s) sends the voice; again after `again` more seconds; at most `max` a block */
  voiceHold: { fnirs: 5, eeg: 3 },
  voiceAgain: 10,
  voiceMax: 3,
  /** the lost lamb's compass shows this long (s); called sheep walk at this speed (m/s) */
  compassSec: 6,
  calledSpeed: 2.6,
  /** a called sheep that has not reached the ring in this long joins anyway (s) */
  calledMax: 14,

  // ── the sheep ────────────────────────────────────────────────
  /** collision radius, separation radius (m), the flock's top speed (m/s) */
  sheepR: 0.4,
  sepR: 0.95,
  maxSpeed: 4.4,
  /** the flock keeps this far around its target (m): keep0 + keepN × √n */
  keep0: 1.1,
  keepN: 0.3,
  /** followers aim at where the shepherd was this long ago (s) */
  lag: 0.35,
  /** how fast a sheep's velocity follows what it wants (s) */
  steerTau: 0.28,
  /** grazing: the group's spread (m) and the wander speed (m/s) */
  grazeR: 1.6,
  grazeSpeed: 0.4,
  /** a pasture's grazing groups: sheep per group, sheep on the first hill, more on each next (to `hillMax`) */
  group: [3, 8],
  hill: [24, 30],
  hillGrow: 4,
  hillMax: 44,
  /** a follower this far from the shepherd and out of view for this long catches up behind him (m, s) */
  strayDist: 12,
  straySec: 5,

  // ── thorns ───────────────────────────────────────────────────
  /** a follower brushing a bush this close (m) may snag (chance per brush); not again for `snagCool` s */
  snagR: 0.75,
  snagChance: 0.3,
  snagCool: 10,
  /** a snagged sheep waits at least this long (s), then frees when the shepherd comes within the ring */
  snagMin: 1.5,

  // ── the pastures ─────────────────────────────────────────────
  /** a pasture's grazing time (s), and the share gathered that ends it early (after `earliest` s) */
  pasture: [45, 60],
  gatherEnd: 0.85,
  earliest: 12,
  /** the fold: its radius, distance ahead of the shepherd, the gate's catch radius (m) */
  foldR: 3,
  foldDist: 6.5,
  gateR: 1.7,
  /** waiting at the fold this long (s), the flock walks in on its own */
  foldWait: 14,
  /** the count: the gap between sheep (s, first and fastest), every n-th lights a step */
  countGap: [0.22, 0.07],
  stepEvery: 10,
  /** a sheep walking to the gate longer than this is counted in (s) */
  gateMax: 6,
  /** the celebration after the count and the change of pasture (s) */
  doneHold: 1.8,
  /** the lost lamb: at least this far from the start (m), picked up this close (m) */
  lambDist: 18,
  lambPick: 1.5,

  // ── Nocna straż (rest) ───────────────────────────────────────
  /** stars: d(stars)/dt = gain × calm after the lead-in (s), Mendi / HALO; at most `max` */
  starGain: 0.75,
  starMax: 12,
  starLead: { fnirs: 4, eeg: 2 },
  /** how fast the night falls and lifts (s) */
  nightTau: 1.2,
  /** a passed night's morning lambs: base, +1 at each of these star counts */
  morning: 2,
  morningAt: [6, 10],

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
  /** the ghost hand of the warm-up shows after this long without a touch (s) */
  idleHint: 3,
  /** Wołanie blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the blind block's flare lasts this long (s) */
  flareSec: 3,

  // ── the meta ─────────────────────────────────────────────────
  /** the hundred (Luke 15:4): the flock across sessions; then a new season */
  hundred: 100,
  /** sheep added to the hundred by the day's gift and by a mission */
  giftSheep: 3,
  missionSheep: 2,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
