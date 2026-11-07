/**
 * Every number of Dolina's rules in one place (sim.ts re-exports it): the run, the jump and the
 * double jump, the staff that strikes by itself, the stones and the stairs, the gates, the lambs'
 * pens, the shadows, the tide of the dark behind, the guardians, the lamp (the live gauge), the Świt
 * (hold), the oil and the meadow (rest), the blocks and the meta.  Tuning moves a number here and
 * nowhere else; the tests read the same object.
 *
 * World units (u, about a metre): x to the right along the valley, y up.  The pilgrim is about 1 u
 * tall; a landscape screen shows about 16 u, an upright phone about 10 u.  The headline is metres:
 * one u is one metre of the valley.
 */
export const RULES = {
  // ── the run ──────────────────────────────────────────────────
  /** forward speed (u/s): running, the warm-up's easier pace, the meadow's walk, toward the dawn; + per level (capped) */
  run: 5.2,
  warmRun: 4.4,
  walk: 2.3,
  dawnRun: 6,
  levelRun: 0.05,
  levelRunMax: 0.8,
  /** how fast the speed reaches its target (s) */
  speedTau: 0.25,
  /** the pilgrim's box: half its width and its height (u) */
  halfW: 0.24,
  height: 1.05,
  /** he walks up anything this high without a jump (a stair's step) (u) */
  stepUp: 0.5,

  // ── the jump (touch: anything under 2 s) ─────────────────────
  /** gravity (u/s²); take-off speed: apex v²/2g ≈ 1.69 u, ≈ 0.33 s up */
  g: 32,
  jumpV: 10.4,
  /** the second jump in the air (Ćma's flap): ≈ 1.3 u more */
  jump2V: 9.2,
  /** air jumps (the double jump): one; it comes back on landing and on a stomp */
  airJumps: 1,
  /** let go while rising: the climb is cut to this share (variable height) */
  cut: 0.45,
  /** a press this early before landing still jumps (buffer), and this long after leaving an edge (coyote) (s) */
  buffer: 0.12,
  coyote: 0.1,
  /** the stomp (↓ in the air): straight down this fast (u/s); the bounce off a shadow (u/s) */
  stompV: 16,
  bounceV: 8.6,
  /** the highest a standing pilgrim's feet reach: one jump, both jumps (u) — the levels are drawn to these */
  reach1: 1.69,
  reach2: 3.0,

  // ── the staff (strikes by itself) ────────────────────────────
  /** a strike every this often (s) while something is in reach; the reach ahead (u) */
  strikeGap: 0.19,
  reach: 0.95,
  /** the weapon's power by tier (1-based): each gate merges it up */
  power: [2, 3, 4, 6, 8, 11, 15, 20, 27, 36, 48, 64],
  /** a stomp on a block or a guardian's weak point hits this many times as hard */
  stompHit: 3,
  /** hit-stop: a strike, a break, a guardian's hit, its fall (s) */
  stopHit: 0.025,
  stopBreak: 0.05,
  stopGuard: 0.06,
  stopBeaten: 0.3,
  /** the combo: breaks and kills without a hit taken; it lapses after this long without one (s); sparks ×2 from 10, ×3 from 25 */
  comboLapse: 4,
  comboAt: [10, 25],

  // ── the stones and the stairs ────────────────────────────────
  /** strikes a block takes at the expected weapon of its stage: small, tall */
  strikes: [3, 6],
  /** a block's height (u): small (one jump clears it), tall (two jumps) */
  blockH: [0.95, 2.05],
  blockW: 0.95,
  /** stones a block gives: small, tall; the Kamieniarz upgrade adds this share per level */
  stones: [2, 4],
  stoneStep: 0.25,
  /** blocks grow tougher per level (× per level) */
  levelHp: 1.045,
  /** a stair's step: height and depth (u); built one every this often (s), starting this far before the wall (u) */
  stepH: 0.45,
  stepD: 0.5,
  stepEvery: 0.045,
  buildAt: 7,
  /** a ledge's height (u): base + per level (capped) + jitter */
  ledge: [3.2, 0.22, 1.6, 0.8],
  /** stuck at a wall this long (s) — he climbs by hand at this speed (u/s); the first-ever session waits longer */
  climbWait: 1.3,
  climbWaitFirst: 2.6,
  climbV: 1.3,
  /** a tap while climbing scrambles him this much higher (u) */
  climbTap: 0.3,
  /** stones left at a level's end become sparks, this many each */
  stoneSparks: 0.5,

  // ── the gates (weapon merges) ────────────────────────────────
  /** the low gate's opening and the high one's (his middle above the road, u): the high one needs both jumps */
  gateLow: [0, 2.3],
  gateHigh: [2.35, 3.9],
  /** tiers each gives */
  gatePlus: [1, 2],

  // ── the lambs ────────────────────────────────────────────────
  /** a pen takes the strikes of a small block; sparks per lamb freed */
  penStrikes: 4,
  lambSparks: 5,
  /** at most this many lambs trot behind him (the rest wait at the fold) */
  flock: 8,

  // ── the shadows ──────────────────────────────────────────────
  /** a shadow's light in strikes of the expected weapon, by kind: walker, the era's special */
  shadowStrikes: [1, 2],
  /** a thrower throws a brick along the road every this often (s) from this far (u) */
  throwEvery: 2.3,
  throwFrom: [3, 10],
  /** a brick rolling along the road: speed (u/s), height (u) */
  rollV: 5.2,
  rollH: 0.55,
  /** a pling floats at this height (feet above the road, u) */
  plingY: 1.55,
  /** the scroller pulls him back this far (u) */
  pullBack: 1.6,
  /** a dodge this close (u) is a near miss */
  nearMiss: 0.35,

  // ── the tide of the dark behind (the horde) ──────────────────
  /** it starts this far behind (u), never falls further back than tideMax, moves this fast (u/s, + per level) */
  tideStart: 13,
  tideMax: 16,
  tideV: 4.3,
  tideLevel: 0.04,
  /** caught: oil lost, a share of the stones in the pack spilled, the tide thrown back this far (u) */
  caughtOil: 0.2,
  caughtSpill: 0.3,
  caughtBack: 9,
  /** in a live light below the threshold it crawls at this share; above it the light pushes it back (u/s at the top) */
  tideSlow: 0.55,
  tidePush: 3.4,

  // ── the lamp: the live gauge ─────────────────────────────────
  /** the steady small flame outside push blocks (u) */
  flame: 2.4,
  /** in a sighted push block past the lead-in: reach = lampMin + level × lampExtra (u); + per Knot upgrade */
  lampMin: 2.4,
  lampExtra: 5.2,
  lampStep: 0.35,
  /** how fast the drawn and acting reach follows its target (s) */
  lampTau: 0.4,
  /** in a live light the shadows and the guardian's throws move at this share of their speed */
  lightSlow: 0.6,
  /** in the light above the threshold a shadow burns this share of its light per second (at the top of the level) */
  burn: 0.6,
  /** a guardian in the light above the threshold burns this many strikes per second (at the top) */
  guardBurn: 1.2,
  /** the fog: things this far beyond the light still show their numbers (u) */
  fogMargin: 1.5,
  /** the lead-in before the band moves the lamp (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },

  // ── the Świt (hold) ──────────────────────────────────────────
  /** a held focus this long (s) fills it; again after as long once more; at most dawnMax a block */
  dawnHold: { fnirs: 5, eeg: 3 },
  dawnMax: 3,
  /** on a guardian: the share of its light it takes, and how long its weak point opens (s) */
  dawnGuard: 0.12,
  dawnOpen: 3,
  /** the blind block's Świt: the light's flash (s) */
  flashSec: 1.4,

  // ── the oil (health) and grace ───────────────────────────────
  /** oil lost to a touch of each kind; per Oliwa upgrade the losses shrink by this share */
  harm: { shadow: 0.12, roll: 0.1, crow: 0.1, pling: 0.08, guard: 0.14, pit: 0.08 },
  oilStep: 0.1,
  /** after a hit nothing hurts for this long (s); a stumble slows the run this long (s) */
  safeSec: 1,
  stumbleSec: 0.4,
  /** a fall into a pit: Ćma lifts him to the far rim in this long (s) */
  pitSec: 0.9,
  /** no oil: he falls and rises (s), with half oil; the shadows this close fade back (u) */
  fallSec: 2,
  riseOil: 0.5,
  clearNear: 5,

  // ── the meadow (rest) ────────────────────────────────────────
  /** calm refills the oil (per s at calm 1) after the lead-in; smooth stones from the brook: d(stones)/dt = brookGain × calm, at most brookMax a rest */
  oilGain: 0.035,
  brookGain: 0.55,
  brookMax: 12,
  brookSparks: 1,
  restLead: { fnirs: 4, eeg: 2 },
  /** a passed meadow: a full flask, stones and sparks; a passed push block: sparks */
  restStones: 4,
  restBonus: 8,
  pushBonus: 8,

  // ── the road ─────────────────────────────────────────────────
  /** the road is laid this far ahead of him (u) and forgotten this far behind (u) */
  ahead: 26,
  behind: 12,
  /** a stage's road before its ledge (u): base + per level (capped) */
  stageLen: [44, 3, 24],
  /** gaps between things (u): roomy, tight */
  gap: [5.2, 3.4],
  /** pits (u): narrow (one jump), wide (both jumps) */
  pitNarrow: [1.4, 2.2],
  pitWide: [3.5, 4.3],
  /** a lantern post every this far (u) */
  postEvery: 24,

  // ── the guardians ────────────────────────────────────────────
  /** every this many levels the last floor is a guardian's arena; its flat length (u) */
  guardEvery: 3,
  arenaLen: 16,
  /** where it stands, ahead of him (u); in the opening its front comes this close to his staff's tip */
  guardAt: 6,
  guardNear: 0.72,
  /** a guardian's light, in strikes of the expected weapon; sessions under 70 s; × per lap */
  guardStrikes: 30,
  guardShort: 0.55,
  guardLap: 0.25,
  /** at this share of its light it grows angrier: its clock runs this much faster */
  angryAt: 0.5,
  angry: 1.25,
  /** a guardian comes only with this many seconds of the push block left; it withdraws at the block's end, keeping its damage */
  guardNeed: 10,
  /** each move: its telegraph and its whole length (s, on the guardian's clock) */
  moves: {
    roll: { tele: 0.75, len: 1.5 },
    wall: { tele: 0.9, len: 1.8 },
    high: { tele: 0.8, len: 1.6 },
    pair: { tele: 0.9, len: 2.1 },
    open: { tele: 0, len: 2.8 },
  },
  /** the guardian's throws: speed (u/s); a wall's height and a high beam's span (u above the road) */
  throwV: 6.4,
  wallH: 2.05,
  highY: [1.3, 2.1],
  /** the pair's second throw comes this much later (s) */
  pairGap: 0.42,
  /** the weak point stands this high when open (feet above the road, u): reached with both jumps */
  weakY: 2.2,
  guardSparks: 30,

  // ── the session ──────────────────────────────────────────────
  /** push and rest blocks: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [20, 3],
  minBlock: 12,
  telegraph: 4,
  /** the run toward the dawn at the end (s): sessions of 2 min and more / shorter */
  finale: { long: 8, short: 4 },
  /** the first-ever session's warm-up (s): 34 in 5 and 10 min, 24 in 3, 8 in a 40 s test */
  warm: { long: 34, short: 24, test: 8 },
  /** the opening story card holds the road quiet this long (s) */
  storySec: 6,
  /** canStop() waits at most this long after time is up (s) */
  settle: 2,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** a hold this long (s) counts as a long push with a wide lamp (the closing verse) */
  longHold: 12,
  /** the level's card stays this long (s) */
  cardSec: 2.6,

  // ── the meta ─────────────────────────────────────────────────
  /** the pilgrim's looks by all sparks ever: cloak, traveller, lamplighter, keeper of the dawn */
  looks: [0, 150, 500, 1200],
  /** upgrades: price of level L+1 = base × growth^L; their top levels */
  priceBase: 40,
  priceGrowth: 1.55,
  upMax: { stone: 6, forge: 5, income: 5, lamp: 4, oil: 4 },
  /** Iskry: sparks × (1 + this × level) */
  incomeStep: 0.2,
  /** the day's gift (sparks, the same for everyone who comes) */
  dayGift: 15,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
