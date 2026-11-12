/**
 * Every number of Ogień, ogień, ogień's rules in one place (sim.ts reads it, the tests read the same
 * object): the ladder of seven fires and what each ring costs, how focus charges it, the hands' small
 * tasks, the light that calm banks in rest, the change, the blocks, the guide's bubbles.  Tuning moves a
 * number here and nowhere else.
 *
 * Positions of the hands' targets (tents, hydrogen pairs, gas wisps, the gathered) are in units of the
 * ring's radius around the fire: x to the right, y downward, the fire at (0, 0).  The view maps a unit to
 * the ring's radius in px, whatever the screen, so the rules never see a pixel.
 */
export const RULES = {
  // ── the ladder ───────────────────────────────────────────────
  /** fires on the ladder (spark … Pentecost); a full ring on the last starts a new cycle from a spark */
  rungs: 7,
  /**
   * Seconds of full focus (k = 1, see `brainK`) that fill each fire's ring by the brain alone in the first
   * cycle: a spark catches fast, a star takes its time.  A no-control player still climbs: the adaptive
   * threshold keeps the signal above it ~60 % of the time, touch adds a base and calm banks light.  Tuned by
   * the pace test (test/arcade-ogien.test.ts): in 5 minutes no control reaches the bonfire (the pillar with
   * the hands), some control the pillar or the star, good focus Pentecost (with busy hands the whole ladder).
   */
  ringSec: [9, 12, 15, 18, 22, 26, 30],
  /** each later cycle's rings need this much more (×, compounding) */
  cycleK: 1.2,
  /** sparks (the headline) a full ring is worth, per fire; × cycleWorth per cycle */
  worth: [100, 140, 180, 240, 300, 380, 480],
  cycleWorth: 1.5,
  /** a change's overflow carried into the new ring, at most */
  carryMax: 0.12,

  // ── focus: the charge ────────────────────────────────────────
  /** the brain's part starts this long into a push block (s): the haemodynamic lag / EEG's short one */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the shown heat eases toward the level (s) */
  heatTau: 0.45,
  /** with no usable signal the heat eases to neutral (the threshold) this slowly (s) */
  neutralTau: 1.6,
  /** k = ((level − 0.5) / 0.5)^kPow above the threshold: 0 at the threshold, 1 at the top */
  kPow: 1,
  /** a passed rest leaves an ember bed: the next push's brain rate × this */
  emberK: 1.15,
  /** a passed push adds this share of a ring */
  pushBonus: 0.05,
  /** a push whose heat stayed above the threshold this long (s) earns the guide's cheer */
  goodSec: 4,
  /** the ring at or above this share: "almost" */
  nearAt: 0.9,

  // ── the hands (touch: a small base, under 2 s each) ──────────
  /** rings the hands may add in a block, softly: each gain × (1 − used / cap) */
  touchCap: { push: 0.24, warmup: 0.5, finale: 0.2 },
  /** a gain is this share of a ring */
  gains: { blow: 0.012, trim: 0.01, shield: 0.05, poke: 0.009, log: 0.06, tent: 0.03, fuse: 0.032, wisp: 0.016, pass: 0.04 },
  /** the shortest gap between two blows / trims / pokes that both count (s) */
  blowGap: 0.28,
  trimGap: 0.55,
  pokeGap: 0.35,
  /** the candle's draughts: every gustEvery s, warned gustTele s ahead, blowing gustSec s */
  gustEvery: [6, 10],
  gustTele: 1.6,
  gustSec: 0.9,
  /** a tap shields this long (s); holding shields as long as the finger stays */
  shieldTap: 0.9,
  /** the bonfire's pile: at most this many logs, a new one every logEvery s; a log burns logBurn s */
  logs: 3,
  logEvery: 4,
  logBurn: 2.2,
  /** the camp's tents: each lamp fades from 1 to dark in tentFade s; a lamp under relight can be lit */
  tentFade: 28,
  relight: 0.45,
  /** hydrogen pairs: at most this many, a new one every pairEvery s, each lives pairLife s */
  pairs: 4,
  pairEvery: 1.5,
  pairLife: 9,
  /** a tap fuses the nearest pair within this (units) */
  pairReach: 0.6,
  /** gas wisps: at most this many, a new one every wispEvery s; a caught wisp spirals in for wispIn s */
  wisps: 10,
  wispEvery: 0.8,
  wispIn: 1.3,
  /** a drag catches wisps within this of the finger (units); a tap pulls those within pullReach, at most pullMax */
  catchReach: 0.38,
  pullReach: 0.85,
  pullMax: 2,
  /** the gathered at Pentecost: a tongue of fire comes down on a waiting one in the room every tongueEvery s */
  tongueEvery: 3.2,
  /** a tongue takes this long to come down (s); a passed flame this long to cross (s) */
  tongueSec: 1.4,
  passSec: 0.7,

  // ── rest: calm banks light ───────────────────────────────────
  /** calm banks light from this far into a rest block (s) */
  restLead: { fnirs: 4, eeg: 2 },
  /** rings of light a second at calm 1 */
  lightRate: 0.012,
  /** the light reserve holds at most this much (rings) */
  lightMax: 0.45,
  /** the breath the flame keeps in rest: in, out (s) */
  breathIn: 4,
  breathOut: 6,
  /** at a push's start the banked light pours back into the ring over its lead-in; at least this long (s) */
  pourMin: 2,
  /** a blind block's hidden charge pours in over this long when its veil lifts (s) */
  revealSec: 1.4,

  // ── the change ───────────────────────────────────────────────
  /** the change's picture (flare, white-out, zoom, ignition) in s; its card stays at most cardSec */
  changeSec: 2.8,
  cardSec: 7,
  cardMin: 0.6,
  /** the first-ever opening card (s) */
  openSec: 11,

  // ── the session ──────────────────────────────────────────────
  /** push and rest: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: the guide waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind (smoke) from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** a session this long (s) or a fire held above the threshold this long counts as a long burn (Jer 20:9, Song 8:7) */
  longBurn: 540,
  longHold: 14,

  // ── the guide's bubbles ──────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.6,
  /** the sky keeps this many stars (the oldest dimmest go first) */
  skyMax: 160,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
