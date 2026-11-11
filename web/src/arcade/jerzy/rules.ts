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
  /** the beat grows with the aura: × (1 + pulseGrow × the band's share of the radius); on the dragon × pulseBoss */
  pulseGrow: 2,
  pulseBoss: 3,
  /** a dragon's knocked-off scales: one silver scale (3) for every this much damage; this many gold ones when he flies off */
  owedPer: 35,
  drivenGold: 8,
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
  swordBoss: 0.08,
  swordBossMax: 240,

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
  spawnPerSec: 0.014,
  spawnMax: 3.2,
  cap: 110,
  /** creature hp grows with run time: × (1 + run s / hpGrow) */
  hpGrow: 70,
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
  xpStep: 6,
  xpSq: 1.8,
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
  tele: { breath: 1.05, lanes: 1.15, rain: 1.0, swoop: 1.1, dive: 1.5, ring: 1.2, embers: 0.9, coins: 0.95, sweep: 1.1 },
  teleFast: 0.88,
  /** between the attacks of a round (the Three-Headed, a hard road's combo) (s) */
  comboGap: 0.45,
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
  /** hearts lost: a flame, a fire lane, a drop, the swoop, the dive's burst, the ring of fire, a hot coin, the tail */
  hurt: { touch: 0.25, ball: 0.75, flame: 0.25, lane: 1, rain: 1, swoop: 1, dive: 1, ring: 1, coin: 0.5, sweep: 1 },
  /** the flaw: after an attack he is dizzy this long (s) and takes this much more */
  flawSec: 2.2,
  flawK: 2,
  /**
   * The fatal flaw (each dragon's own weakness, found by play): a longer window that hurts more.
   * steam — the Green Dragon chokes when this many flames of one breath are put out;
   * greed — the Golden Dragon stops to gobble when this many scales lie this near him (each takes this long);
   * heat — the Ember Dragon cools this long after his ring of fire (the aura or water touching him then).
   */
  fatalSec: 3.6,
  fatalK: 3,
  steamNeed: 6,
  greedN: 4,
  greedNear: 3.8,
  greedEach: 0.45,
  greedMax: 3.4,
  greedK: 2.5,
  heatSec: 2.6,
  /** the Three-Headed: three heads attack in a row (a round), then the necks tangle */
  tangleRound: 3,
  /** his scales (hp) on the squire's road and the growth per road beyond the fourth */
  circleUp: 0.8,
  /** a third of his scales knocked off: a roar (s, invulnerable), a push (u), a chest */
  roarSec: 1.1,
  roarPush: 2.2,
  /** the dive (the Marsh Dragon): under the ground toward the mark this long (s), then a burst this wide (u) */
  diveR: 1.55,
  /** the ring of fire (the Ember Dragon): from this radius to this one (u) in this long (s), a band this wide, a gap this wide (rad) */
  ringFrom: 4.6,
  ringTo: 0.5,
  ringSec: 1.8,
  ringBand: 0.55,
  ringGap: 1.15,
  /** his embers: this many packs of ember beetles hatch around the knight */
  emberPacks: 2,
  /** hot coins (the Golden Dragon): this many in a fan this wide (rad), at this speed (u/s); those that miss cool into scales */
  coins: 9,
  coinFan: 1.0,
  coinSpeed: 3.6,
  coinLife: 2.1,
  /** the tail sweep: a ring this wide (u) around him */
  sweepR: 3.1,

  // ── the Postój (rest) ────────────────────────────────────────
  /** calm restores hearts (per s at calm 1) after this lead-in (s) */
  heal: 0.11,
  restLead: { fnirs: 4, eeg: 2 },

  // ── v3: the roads (difficulties a land is fought on again) ──
  /**
   * The squire's, the knight's, the hero's and the legend's road: the dragon's scales (hp ×), the
   * brood's hp (×), the telegraphs (× their length), attacks in a row before he is dizzy, the bonus
   * of the session's scales paid into the treasury.  Past the fourth the legend's road grows by
   * `circleUp` hp and 0.25 brood a road.
   */
  roads: [
    { hp: 1, brood: 1, tele: 1, combo: 0, bank: 0 },
    { hp: 1.6, brood: 1.3, tele: 0.9, combo: 0, bank: 0.25 },
    { hp: 2.3, brood: 1.65, tele: 0.82, combo: 1, bank: 0.5 },
    { hp: 3.1, brood: 2.0, tele: 0.76, combo: 1, bank: 0.75 },
  ],

  // ── v3: crits, rerolls, damage tallies ───────────────────────
  /** a blow is critical this often (and ×critK) before the ring and the vambraces */
  crit: 0.04,
  critK: 2,
  /** reshuffles of a choice per run (Linda shuffles the cards) */
  rerolls: 1,

  // ── v3: the new weapons ──────────────────────────────────────
  /** the hammer flies out at this speed and comes back at that one (u/s) */
  hammerOut: 9,
  hammerBack: 12,
  /** bolts fly at this speed (u/s) this long (s) */
  boltSpeed: 15,
  boltLife: 0.75,
  /** caltrops lie this long (s) and bite every tick (s), slowing what stands on them (×) */
  caltropLife: 5,
  caltropTick: 0.5,
  caltropSlow: 0.5,

  // ── v3: the treasures (the dragons' hoard) ───────────────────
  /** a treasure instead of a level: an elite's chest, a roar's chest; a run holds at most this many */
  treasureElite: 0.3,
  treasureRoar: 0.5,
  treasureMax: 6,
  /** the mirror: a quenched fireball (a flame) throws a spark of light at the nearest creature this near (u) */
  mirrorDmg: 5,
  mirrorFlame: 2,
  mirrorReach: 5.5,

  // ── v3: the companions (they come along, levelled in the run by cards) ──
  palMax: 4,
  /** Burek: runs (u/s), fetches what lies this far (u) beyond the pickup, bites what is this near (u) every bite s */
  dogSpeed: 5.6,
  dogFetch: 6.5,
  dogBiteR: 1.5,
  dogBite: 0.7,
  /** Burek barks at a telegraph: it lasts this much longer (s) */
  dogBark: 0.25,
  /** Iskierka: orbits at (u), eats fire this near (u) every eat s, spits a spark this far (u) every spark s */
  sparkOrbit: 1.15,
  sparkEatR: 2.4,
  sparkEat: 2.2,
  sparkReach: 4.6,
  sparkSpit: 1.6,
  /** Kolczak: rolls round the knight at this radius (u), a lap in this long (s); hits a creature at most every 0.5 s */
  hogR: 2.3,
  hogLap: 2.6,
  /** Bartek: a palisade every wall s when this many creatures are this near (u); this long (u), it stands this long (s) */
  wallEvery: 9,
  wallNeed: 3,
  wallNear: 6,
  wallLen: 2.6,
  wallLife: 6,

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
