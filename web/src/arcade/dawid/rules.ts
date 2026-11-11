/**
 * Every number of Dawid's rules in one place (sim.ts re-exports it): the field and David, the sling
 * (the band's gauge: its whirl, the multiplier, the great stone from the brook), the harp (rest: healing
 * and rested XP), the beasts and their camps, the guardians, the bag and the camp, levels, the weapons
 * and the companions' kit skills, the cave of Adullam, the blocks and the companion's lines.  Tuning
 * moves a number here and nowhere else; the tests read the same object.
 *
 * The world is a top-down map of each land in u (about a metre each), x to the right, y down; the
 * camera follows David.
 */
export const RULES = {
  // ── the field and David (touch: anything under 2 s) ──────────
  /** the half-size of the field the view shows (u), until the view says otherwise */
  viewHalf: [8, 5],
  davidR: 0.34,
  /** walking speed (u/s) at a full joystick, before the Krok ability */
  walk: 3.8,
  /** the joystick: full speed this far from where the finger went down (px), nothing under the dead zone (px) */
  stickPx: 56,
  stickDead: 8,
  /** a tap: up within this long (s) and this close (px) to the press */
  tapSec: 0.3,
  tapPx: 14,
  /** a tap this close to David (u) means "hunt" (the nearest beasts); farther: walk there, then hunt */
  tapNear: 2.2,
  /** the hunt looks for beasts this far from David (u); none: it walks to the nearest camp with beasts */
  huntSeek: 9,
  /** the hunt stops this far inside the sling's reach (share of the range) */
  huntStand: 0.78,
  /** hit-stop (s): a level, the great stone, a guardian driven off */
  stopLevel: 0.05,
  stopStone: 0.16,
  stopDriven: 0.35,

  // ── the sling (David's main weapon; the band's gauge) ─────────
  /** reach (u), seconds between throws (before Tempo and the forge), a stone's speed (u/s) */
  slingRange: 5.6,
  slingCd: 0.8,
  stoneSpeed: 15,
  /** David's base damage at level 1, and per level */
  dmgBase: 8,
  dmgPerLevel: 2,
  /** health at level 1, and per level */
  hpBase: 100,
  hpPerLevel: 14,
  /** critical hits: base chance and the damage factor */
  crit: 0.05,
  critK: 2,

  // ── the whirl (the live gauge: Proca) ────────────────────────
  /** the lead-in before the band moves the whirl (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the multiplier: ×1 below the threshold (never less), ×multAt at it, ×multMax at level 1, in halves */
  multAt: 2,
  multMax: 4,
  /** the ring around David (u) and the stone's whirl (turns per second) at no focus and the extra at full */
  ringR: 1.35,
  spinBase: 0.7,
  spinExtra: 2.6,
  /** how fast the drawn whirl follows the band (s) */
  whirlTau: 0.5,
  /** the great stone from the brook: a held focus this long (s) polishes it at this rate (per s); a golden hit adds this */
  holdNeed: { fnirs: 6, eeg: 3 },
  holdRate: 0.11,
  goldHit: 0.012,
  /** at most this many great stones a push block; ready this long (s) and it goes by itself */
  stonesPerBlock: 2,
  stoneAuto: 5,
  /** the great stone: damage × David's, a camp scattered around the impact (u), a guardian's bite (share of all, at most ×dmg) */
  stoneDmg: 12,
  stoneScatter: 3.4,
  stoneBoss: 0.14,

  // ── the harp by the fire (rest: Harfa) ───────────────────────
  /** calm heals this share of the party's health per second (at calm 1) after this lead-in (s) */
  heal: 0.045,
  restLead: { fnirs: 4, eeg: 2 },
  /** rested XP: calm fills this share of a level's need per second (at calm 1); at most this many levels' worth */
  rested: 0.0065,
  restedCap: 1.5,
  /** a passed rest: the fire's gift, this share of a level's need as rested XP */
  restGift: 0.06,
  /** David sits down this long (s) after the block begins (the banner) — then the harp plays */
  sitDelay: 0.6,

  // ── beasts and their camps ───────────────────────────────────
  /** a beast this far from its den (u) goes home; a den refills a slot after the kind's respawn (s) when David is this far (u) */
  leash: 13,
  respawnFar: 5,
  /** beasts bite every this long (s) when touching David */
  biteSec: 1.0,
  /** a struck beast's knockback (u/s) and how fast it fades (1/s) */
  knock: 3,
  knockDrag: 7,
  /** fleeing (driven off): this long (s) at this speed (u/s) */
  fleeSec: 1.0,
  fleeSpeed: 7,
  /** coins: pickup radius (u), the pull (u/s), how long they lie (s) */
  pickR: 3,
  /** coins lying this long (s) within this far (u) fly to the bag anyway (XP Hero's vacuum) */
  vacuumAfter: 1.4,
  vacuumR: 9,
  pull: 10,
  coinLife: 70,
  coinCap: 220,
  /** the far camps are tougher: × (1 + distance from the camp / campDist) */
  campDist: 90,

  // ── the bag and the camp ─────────────────────────────────────
  /** the bag's capacity (silver-units) before Torba and the storehouse; wood and stone weigh this much */
  bagBase: 60,
  bagGrow: 1.18,
  matWeight: 5,
  /** the camp's circle (u); in camp the party heals this share per second */
  campR: 3.4,
  campHeal: 0.2,
  /** a stumble: David sits dazed this long (s), then wakes at the camp's fire */
  downSec: 1.6,
  /** invulnerable after a hit (s), after waking (s) */
  safe: 0.5,
  wakeSafe: 2,
  /** health back per second per Oddech level (share of max), after this long unhurt (s) */
  regenPer: 0.001,
  regenAfter: 3,

  // ── levels ───────────────────────────────────────────────────
  /** XP to the next level from level L: xpBase × xpGrow^(L − 1), rounded to tens past 100 */
  xpBase: 70,
  xpGrow: 1.1,
  /** every this many levels: a reward chest */
  rewardEvery: 5,

  // ── lands and circles ────────────────────────────────────────
  /** the beasts' strength, XP and silver by land (index in the circle) */
  landK: [1, 2.2, 4.6, 9.5, 19, 38],
  /** each circle round the six lands multiplies everything by this */
  circleK: 45,

  // ── the guardians (the gate bosses) ──────────────────────────
  /** a guardian wakes when David comes this close to its lair (u); goes home past leash (u) */
  guardWake: 7,
  guardLeash: 15,
  /** telegraph (s) by pattern; between attacks (s); the daze after an attack (s) and its damage factor */
  tele: { lunge: 0.95, swipe: 0.8, roar: 1.0, pounce: 1.0, spear: 1.1, stomp: 1.0, taunt: 0.6 },
  guardRest: [0.9, 1.6],
  dazeSec: 1.8,
  dazeK: 2,
  /** an attack's harm (× the guardian's atk) */
  harm: { lunge: 1.2, swipe: 1, roar: 0.8, pounce: 1.3, spear: 1.5, stomp: 1.2, taunt: 0 },
  /** sizes: a lunge lane (w, len), a swipe cone (half angle, len), a roar ring (r), a pounce circle (r), the spear lane, the stomp (r) */
  lungeW: 1.2,
  lungeLen: 7,
  swipeHalf: 0.6,
  swipeLen: 2.8,
  roarR: 3.6,
  pounceR: 1.4,
  spearW: 0.9,
  spearLen: 13,
  stompR: 3,
  /** the taunt slows David (×) this long (s) */
  tauntSlow: 0.6,
  tauntSec: 2,
  /** the shield-bearer walks this far in front of Goliath (u) and blocks stones within this half-width (u) */
  bearerAhead: 1.5,
  bearerHalf: 0.85,

  // ── weapons (the forge) ──────────────────────────────────────
  /** weapon levels; every 5 an evolution (a new tier) */
  weaponMax: 25,
  tierEvery: 5,

  // ── chests, the jackal thief, gifts ──────────────────────────
  /** a land's chest comes back after this long (s) */
  chestBack: 90,
  /** the golden jackal: first after this long (s), then every (s); it runs this long (s) before diving into its burrow */
  thiefFirst: 70,
  thiefEvery: [100, 150],
  thiefRun: 14,
  thiefSpeed: 4.2,
  /** Jesse's bundle: first after this long (s), then every (s); it lies this long (s) */
  giftFirst: 95,
  giftEvery: 150,
  giftLife: 60,

  // ── the cave of Adullam (the tower) ──────────────────────────
  /** a floor's time (s), its beasts' strength growth per floor, a pause between floors (s) */
  floorSec: 30,
  floorGrow: 1.13,
  floorPause: 2,

  // ── the session ──────────────────────────────────────────────
  /** Proca and Harfa: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: the lamb waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the opening card (the first session): at most this long (s), a tap closes it; other cards */
  openSec: 9,
  storySec: 5,
  /** footprints: one every this far (u) or this long standing (s), kept this long (s) */
  stepU: 0.75,
  stepSec: 0.9,
  stepKeep: 40,
  /** closing verses: a hold this long (s) */
  longHold: 12,

  // ── the lamb's lines ─────────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.6,
  /** the ring stays gold this long (s) before the lamb cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
