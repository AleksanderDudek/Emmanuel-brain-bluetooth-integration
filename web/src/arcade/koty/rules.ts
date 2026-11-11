/**
 * Every number of Kocia straż's rules in one place (sim.ts re-exports it): the field, the squad and its
 * cushions, the toys and their grades, the pests and the stages, the bosses, the economy (fish, the three
 * upgrades, the toy shop), the band (alertness, the Great Hunt, the nap), the blocks, offline gifts and
 * the vintage (rebirth).  Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * The field is a logical 10 × 10: x across, y from the far edge (where the pests come in, 0) to the
 * abbey wall the cats sit on (10).  The view maps it onto whatever room the layout gives it.
 */
export const RULES = {
  // ── the field ────────────────────────────────────────────────
  FW: 10,
  FH: 10,
  /** pests come in a little beyond the far edge and settle on goal spots in this band of y (the goods) */
  enterY: -0.7,
  goodsY: [3.2, 8.2],
  goodsX: [0.8, 9.2],

  // ── the squad (cushions on the wall) ─────────────────────────
  /** cushions: two at first, one more when the best stage ever reaches each of these */
  slotsBase: 2,
  slotsAt: [3, 6, 11, 16],
  slotsMax: 6,
  /** the toy chest's cells */
  chest: 10,
  /** a petted cat purrs: its rate × purrK for purrSec; it can be petted again after petCool */
  purrK: 1.5,
  purrSec: 2.5,
  petCool: 4,
  /** a tap on the empty field ("psst!"): this share of the squad's best shot, at most every clapCool s */
  clapK: 0.6,
  clapCool: 0.22,
  /** a player's target stays marked this long (s) */
  targetSec: 12,

  // ── the toys ─────────────────────────────────────────────────
  grades: 12,
  /** a toy's damage per grade (two of a grade make one of the next: more than double, and a cushion freed) */
  gradeK: 2.5,
  /** projectile speed (u/s); a lobbed apple flies this long (s) */
  shotSpeed: 15,
  slowShot: 7,
  lobSec: 0.85,
  /** the trait a family is good against: × this */
  traitK: 1.5,

  // ── pests and stages ─────────────────────────────────────────
  /** a stage's pests: base + per stage in its place (+ per round); the boss stage brings a short wave first */
  waveBase: 7,
  wavePer: 1.4,
  waveRound: 1,
  bossWave: 4,
  /** courage (hp) and fish of a pest at stage s: base × kind × growth^(s − 1) */
  hp0: 10,
  hpG: 1.24,
  fish0: 1,
  fishG: 1.18,
  /** pests come in groups every this long (s) */
  groupSec: [1.1, 2.0],
  /** a pest that is hit flinches this long (s) */
  flinch: 0.16,
  /** chased pests run off at this speed (u/s) */
  fleeSpeed: 9,
  /** a golden (elite) pest: this often, × courage and fish, and it leaves a toy */
  eliteChance: 0.06,
  eliteHp: 4,
  eliteFish: 5,
  /** pests nibbling the goods are idle targets; a goal spot keeps this far from another (u) */
  spotGap: 0.9,
  /** at most this many pests on the field */
  cap: 26,

  // ── bosses (the place's chief, every 5th stage) ─────────────
  stagesPerPlace: 5,
  places: 6,
  /** courage × this of the stage's fox-sized pest; + per place and round */
  bossK: 32,
  bossPlace: 0.12,
  /** the boss's patience (s), + 5 s a perk level; it pauses in a nap */
  patience: 30,
  /** after he backs off, this many pests come before he returns */
  farmWave: 5,
  /** his trick: every trickEvery s, telegraphed trickTele s, lasting trickSec s */
  trickEvery: [5.5, 7.5],
  trickTele: 1.1,
  /** what a boss leaves: fish × this of a pest, and a toy */
  bossFish: 22,

  // ── the economy (fish) ───────────────────────────────────────
  /** Celność (damage): +per a level, × 2 every `double` levels; cost = c0 × g^L */
  aim: { per: 0.1, double: 25, c0: 10, g: 1.14 },
  /** Zwinne łapy (fire rate): +per a level up to max levels */
  paws: { per: 0.03, max: 50, c0: 20, g: 1.19 },
  /** Pełna miska (fish): +per a level */
  bowl: { per: 0.1, c0: 12, g: 1.15 },
  /** Nowa zabawka (a toy of the shop's grade): c0 × gradeCost^(grade − 1) × g^bought */
  shop: { c0: 20, g: 1.13, gradeCost: 2.6 },
  /** the shop sells this many grades under the best toy ever made (at least grade 1), + the perk */
  shopUnder: 4,

  // ── the band ─────────────────────────────────────────────────
  /** the lead-in before the band acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** alertness: fire rate × (1 + alertK × level) in a sighted push block (×1…×3); eased over this (s) */
  alertK: 2,
  alertTau: 0.5,
  /** the Great Hunt: a held focus this long (s) fills it at holdRate a second; a chased pest in a sighted push adds this; any chased pest a little */
  holdNeed: { fnirs: 5, eeg: 3 },
  holdRate: 0.075,
  chaseCharge: 0.012,
  baseCharge: 0.004,
  /** ready: released by a tap or Space, by itself after this long (s) */
  huntAuto: 5,
  /** the hunt lasts this long (s); a cat pounces every pounceSec; a pounce is this many of its shots; the boss loses this share once */
  huntSec: 4.2,
  pounceSec: 0.32,
  pounceK: 8,
  huntBoss: 0.18,
  /** the nap: calm ripens grapes into fish at this many seconds of the stage's fighting income a second, after the lead-in (s) */
  napRate: 1.1,
  restLead: { fnirs: 4, eeg: 2 },
  /** a cat with the "golden" gift: its alertness above the threshold counts this much more */
  goldenK: 2,

  // ── offline (modest, capped) ─────────────────────────────────
  /** away at least this long (s) for a gift; at most cap hours (+ the perk); this share of the fighting income */
  awayMin: 120,
  awayCapH: 8,
  awayShare: 0.012,
  /** away this long (s) or more: a toy too */
  awayToy: 3600,

  // ── the vintage (rebirth) ────────────────────────────────────
  /** open from this stage on; golden fish = floor((stage − off)^pow / div) */
  vintageFrom: 31,
  vintage: { off: 10, pow: 1.2, div: 2 },

  // ── the session ──────────────────────────────────────────────
  /** push and rest: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: the brother waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind (dusk) from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** push blocks bring pests a little faster */
  pushSpawn: 1.25,
  /** story cards: at most this long (s), a tap closes them after 0.6 s */
  storySec: 7,
  openSec: 9,
  /** closing verses: a hold this long (s) */
  longHold: 12,

  // ── the brother's lines ──────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.6,
  /** alertness above the threshold this long (s) before he cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
