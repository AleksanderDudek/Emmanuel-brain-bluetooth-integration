/**
 * Every number of Jerzy i smok's rules in one place (sim.ts re-exports it): the field, the knight,
 * the shield's aura (the band's gauge), the Miecz światła, the dragon's brood and the waves, the
 * scales and the levels, the weapons and the gear a level-up offers, the land's dragon (the boss),
 * hearts and grace, the Postój, the blocks and the meta.  Tuning moves a number here and nowhere
 * else; the tests read the same object.
 *
 * The world is an endless top-down field in u (about a metre each), x to the right, y down; the
 * camera follows the knight, the brood comes in from beyond the screen.
 */
export const RULES = {
  // ── the field and the knight (touch: anything under 2 s) ─────
  /** the half-size of the field the view shows (u), until the view says otherwise */
  viewHalf: [7, 5],
  knightR: 0.36,
  /** walking speed (u/s) at a full joystick */
  walk: 3.6,
  /** the joystick: full speed this far from where the finger went down (px), nothing under the dead zone (px) */
  stickPx: 56,
  stickDead: 8,
  /** a tap: up within this long (s) and this close (px) to the press */
  tapSec: 0.3,
  tapPx: 14,
  /** hit-stop (s): a level-up, an elite driven off, the Miecz światła, the dragon driven off */
  stopElite: 0.06,
  stopSword: 0.18,
  stopDriven: 0.35,

  // ── the shield's aura (the live gauge: Tarcza) ───────────────
  /** radius = shieldBase (+ gear) + level × shieldExtra (u) in a sighted Tarcza past its lead-in; the base otherwise */
  /** the base hugs the knight: a fireball reaches him before it (0.42 < knight + ball); gear and the forge widen it */
  shieldBase: 0.42,
  shieldExtra: 2.8,
  /** how fast the drawn and acting aura follows its target (s) */
  shieldTau: 0.4,
  /** the aura's beat: every this long (s) it throws the brood inside it out (u/s), with this damage */
  pulseSec: 1.35,
  pulsePush: 7,
  pulseDmg: 1,
  /** the lead-in before the band moves the aura (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },

  // ── the Miecz światła (quenched fire and a held focus) ───────
  /** charge per quenched fireball, per quenched flame of a breath */
  quenchBall: 0.05,
  quenchFlame: 0.012,
  /** a held focus this long (s) also fills it, this much per second */
  holdNeed: { fnirs: 5, eeg: 3 },
  holdRate: 0.04,
  /** released by a tap or Space; by itself after this long ready (s) */
  swordAuto: 6,
  /** the light's damage to every creature on screen, and the share of a dragon's scales it takes (at most this many) */
  swordDmg: 60,
  swordBoss: 0.05,
  swordBossMax: 90,

  // ── the brood (the dragon's creatures: they dissolve into smoke and run, never die in gore) ──
  /** they come in this far beyond the edge of sight (u) and are brought round when this far away (× the view's half-diagonal) */
  spawnOut: 1.2,
  farK: 1.6,
  /** a run opens with this many chicks; for its first hatchSec (s) the brood hatches at hatchK × the ring, within sight */
  seed: 5,
  hatchSec: 20,
  hatchK: 0.55,
  /** spawn rate (per s) = base + perSec × run time, at most max; alive at most cap */
  spawnBase: 1.0,
  spawnPerSec: 0.022,
  spawnMax: 5.5,
  cap: 110,
  /** creature hp grows with run time: × (1 + run s / hpGrow) */
  hpGrow: 100,
  /** a wave (a ring closing in) every waveSec (s) from waveFrom: count = waveBase + run s / wavePer */
  waveSec: 30,
  waveFrom: 28,
  waveBase: 10,
  wavePer: 7,
  /** an elite (golden, drops a chest) every eliteSec (s), the first at eliteFrom */
  eliteSec: 50,
  eliteFrom: 38,
  eliteHp: 7,
  eliteR: 1.5,
  /** block moods: the push block brings more spitters (fire for the shield), the rest makes them drowsy */
  pushSpawn: 1.2,
  /** spitters that hatch when a Tarcza's aura wakes */
  pushSpitters: 3,
  restSpawn: 0.3,
  restSlow: 0.45,
  bossSpawn: 0.45,
  warmSpawn: 0.55,
  /** contact: a creature touching the knight hurts every touchSec (s) */
  touchSec: 0.6,
  /** a hit's knockback (u/s) and how fast it fades (1/s) */
  knock: 3.2,
  knockDrag: 6,
  /** fireballs of the spitters: speed (u/s), radius (u), life (s) */
  ballSpeed: 4.2,
  ballR: 0.2,
  ballLife: 3.5,

  // ── scales, levels and drops ─────────────────────────────────
  /** pickup radius (u) and the pull's speed (u/s) */
  pickR: 2.6,
  pull: 9,
  /** scales to the next level from level L (1-based): base + step × (L − 1) + sq × (L − 1)² */
  xpBase: 5,
  xpStep: 4,
  xpSq: 0.45,
  /** the world freezes during a choice; the first card is taken after this long (s) */
  choiceSec: 12,
  /** slots for weapons and gear */
  slotsWeapon: 4,
  slotsGear: 4,
  /** item levels */
  weaponMax: 5,
  gearMax: 3,
  /** drop chances: an apple, a gust (all scales fly in) */
  appleChance: 0.025,
  gustChance: 0.006,
  /** an apple heals this many hearts */
  appleHeal: 1.5,
  /** a scale lying this long (s) creeps toward the knight at this speed (u/s) */
  creepAfter: 5,
  creep: 1.4,
  /** scales lie at most this long (s), at most this many */
  scaleLife: 60,
  scaleCap: 260,

  // ── hearts and grace ─────────────────────────────────────────
  hearts: 5,
  /** invulnerable after a hit (s) */
  safe: 0.8,
  /** Linda's apple: once a run he gets up with this share of hearts; the brood near him is thrown back (u) */
  appleBack: 0.5,
  appleClear: 3.5,
  /** knocked down this long (s) before the apple or the tally */
  downSec: 1.6,
  /** the run's tally card (s), a tap closes it after tallyMin */
  tallySec: 4.2,
  tallyMin: 1.2,

  // ── the land's dragon (the boss) ─────────────────────────────
  /** he comes on every bossEvery-th Tarcza block of the session (the 2nd, the 4th…), not before this second of play */
  bossFrom: 30,
  bossEvery: 2,
  bossR: 1.15,
  /** he keeps this far from the knight (u) and moves at this speed (u/s) */
  bossKeep: [2.8, 4.2],
  bossSpeed: 2.4,
  /** touching him hurts this many hearts */
  bossTouch: 1,
  /** telegraphs (s) before an attack lands; quicker in his later thirds */
  tele: { breath: 1.05, lanes: 1.15, rain: 1.0, swoop: 1.1 },
  teleFast: 0.88,
  /** between attacks (s) */
  bossRest: [1.0, 1.8],
  /** the breath: a cone this wide (half angle, rad) and long (u), flames per second, their speed (u/s), how long (s) */
  coneHalf: 0.42,
  coneLen: 5.5,
  flameRate: 26,
  flameSpeed: 6.5,
  flameR: 0.18,
  breathSec: 1.2,
  /** fire lanes: this many, this wide (u), this long (u) */
  lanes: 3,
  laneW: 1.1,
  laneLen: 9,
  /** fire rain: this many drops around the knight, their splash (u), scatter (u), fall (s) */
  rainN: 6,
  rainR: 0.9,
  rainScatter: 2.4,
  rainFall: 0.9,
  /** the swoop: a lane this wide (u) flown at this speed (u/s) */
  swoopW: 1.6,
  swoopSpeed: 12,
  /** hearts lost: a flame, a fire lane, a drop, the swoop */
  hurt: { touch: 0.25, ball: 0.75, flame: 0.25, lane: 1, rain: 1, swoop: 1 },
  /** the flaw: after an attack he is dizzy this long (s) and takes this much more */
  flawSec: 2.2,
  flawK: 2,
  /** his scales (hp) at circle 0 and the growth per circle */
  circleUp: 0.35,
  /** a third of his scales knocked off: a roar (s, invulnerable), a push (u), a chest */
  roarSec: 1.1,
  roarPush: 2.2,

  // ── the Postój (rest) ────────────────────────────────────────
  /** calm restores hearts (per s at calm 1) after this lead-in (s) */
  heal: 0.11,
  restLead: { fnirs: 4, eeg: 2 },

  // ── the session ──────────────────────────────────────────────
  /** Tarcza and Postój: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: Linda waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** Tarcza blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the opening card (the first session): at most this long (s), a tap closes it */
  openSec: 8,
  /** the story card when a land is freed (s) */
  storySec: 4,
  /** footprints: one every this far (u) or this long standing (s), kept this long (s) */
  stepU: 0.7,
  stepSec: 0.8,
  stepKeep: 40,
  /** closing verses: a hold this long (s), this many quenched fires */
  longHold: 12,
  manyQuench: 25,

  // ── Linda's lines ────────────────────────────────────────────
  /** a line stays 2–4 s (by its length), at least this long between two (s) */
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.4,
  /** the aura stays above the threshold this long (s) before she cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
