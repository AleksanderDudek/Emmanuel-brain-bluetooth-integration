/**
 * Every number of Zastępy's rules in one place (sim.ts and battle.ts re-export it): the road, the
 * gates, the light, the host and the demons with their counters, the waves and the boss gates, the
 * trumpet, the pillar of cloud, the ages of the fortress, the blocks and the meta game.
 * Tuning moves a number here and nowhere else; the tests (with their headless battles) read the
 * same object.
 *
 * World units are metres of the road, seen from the side: x from the gate of light (0) to the gate
 * of ash (`road`).
 */
export const RULES = {
  // ── the road and the gates ───────────────────────────────────
  /** the road's length between the gates (m) */
  road: 30,
  /** the gate of light's walls: base, + per gate level, + per withdrawal of this battle */
  walls: 650,
  wallsPerLevel: 90,
  wallsPerRetreat: 160,
  /** the gate's beam: damage, + per level; seconds between shots, − per level; reach (m), + per level */
  beamDmg: 12,
  beamDmgPerLevel: 3,
  beamRate: 1.1,
  beamRatePerLevel: 0.04,
  beamRange: 6.5,
  beamRangePerLevel: 0.35,
  /** the gate of ash: base walls, + per battle of the chapter; × per chapter */
  ash: 2200,
  ashPerBattle: 260,
  ashChapter: 0.3,
  /** as the gate of ash cracks, it pours out a defence: a wave every this share of its walls */
  ashSurge: 0.2,
  /** the gate of ash throws embers at angels near it: damage (+ per battle), seconds between, reach (m) */
  ember: 8,
  emberPerBattle: 2.5,
  emberRate: 1,
  emberRange: 4.5,

  // ── the light ────────────────────────────────────────────────
  /** the flow (light/s) at gate level 1, + per level; the bar's size, + per level; light at a battle's start */
  flow: 4.5,
  flowPerLevel: 0.5,
  lightMax: 100,
  lightMaxPerLevel: 12,
  lightStart: 45,
  /** Natarcie: the flow's multiplier at the top of the level (×1 at the threshold, never below) */
  flowTop: 2.2,
  /** a blind block's light may overfill the bar up to this share */
  overfill: 1.5,

  // ── the trumpet ──────────────────────────────────────────────
  /** a held focus this long (s) charges it, Mendi / HALO */
  trumpetHold: { fnirs: 5, eeg: 3 },
  /** the shockwave down the whole road: damage (+ per gate level), knock-back (m) */
  trumpetDmg: 60,
  trumpetDmgPerLevel: 12,
  trumpetPush: 3,

  // ── Cisza (rest) ─────────────────────────────────────────────
  /** the demons' waves come this much slower, and walk at this speed (×) */
  restGap: 1.7,
  restWalk: 0.7,
  /** calm mends the walls (share of the walls per second at calm 1) and lays shields (hp/s at calm 1) */
  mend: 0.012,
  shieldGain: 14,
  /** the shield of light: at most this share of a unit's hp; on this many units at the front */
  shieldMax: 0.5,
  shieldFront: 3,
  /** the brain's lead-in before calm mends (s), Mendi / HALO */
  calmLead: { fnirs: 4, eeg: 2 },
  /** a passed Cisza: the walls mend by this share at once, and gold */
  restWalls: 0.12,
  restGold: 10,

  // ── the waves ────────────────────────────────────────────────
  /** the first wave comes after this long (s); then a wave every gap (s), − per battle, at least gapMin */
  firstWave: 1.2,
  gap: 8.5,
  gapPerBattle: 0.35,
  gapMin: 4.5,
  /** a wave's size: 1, + 1 every `growSec` of the battle, + 1 every `growBattles` battles; at most `waveMax` */
  growSec: 30,
  growBattles: 3,
  waveMax: 7,
  /** + 1 for every this many of the host on the road */
  answer: 3,
  /** demons step out of the gate this far apart (s) */
  spawnGap: 0.6,
  /** demons' hp and damage: × (1 + perBattle × b) × (1 + perChapter × c) */
  demonPerBattle: 0.05,
  demonPerChapter: 0.26,
  /** the boss steps out after this long (s) in a chapter's last battle; its waves are those of this battle */
  bossAt: 10,
  bossWaves: 1,
  /** while the boss is out, its waves come this much slower */
  bossGap: 1.35,
  /** a boss's special: every this long (s) after it is out, telegraphed this long (s) before it lands */
  specialEvery: 10,
  specialWarn: 1.8,
  /** Kolos's stomp: the zone in front of it (m), damage, knock-back (m) */
  stompReach: 4.5,
  stompDmg: 55,
  stompPush: 2.5,
  /** Szarańcza's swarm: this many fliers step out of it */
  swarmN: 3,
  /** the Smok's breath: the cone in front of it (m), damage */
  breathReach: 6.5,
  breathDmg: 65,

  // ── the counters ─────────────────────────────────────────────
  /** a unit striking what it is the bane of; a bane on a boss; a shield-bearer struck from afar */
  bane: 2,
  baneBoss: 1.5,
  shieldRanged: 0.4,
  /** the demons' banes on the host (the hound on archers, the brute on the foot) */
  demonBane: 1.6,

  // ── the ages of the fortress ─────────────────────────────────
  /** the host's power per age (hp and damage); the last age */
  agePower: 0.2,
  ageMax: 4,

  // ── the pillar of cloud (the hero power) ─────────────────────
  /** seconds it stands, + per level; the cooldown (s), − per level; its burn (dmg/s), + per level; its half-width (m) */
  pillarSec: 4,
  pillarSecPerLevel: 0.5,
  pillarCool: 20,
  pillarCoolPerLevel: 1.5,
  pillarBurn: 22,
  pillarBurnPerLevel: 7,
  pillarHalf: 0.9,
  /** the first pillar of a battle is ready after this long (s) */
  pillarFirst: 4,
  heroMax: 5,
  heroPrice: 30,

  // ── combat ───────────────────────────────────────────────────
  /** a ground fighter keeps this far behind a friend of the same side (m): a loose file, not a heap */
  file: 0.45,
  /** a fallen unit dissolves for this long (s) */
  fade: 0.6,
  /** unit levels raise hp and damage by this share per level */
  unitPerLevel: 0.15,
  unitMaxLevel: 5,

  // ── gold and the gate's levels ───────────────────────────────
  gateMax: 10,
  /** gold for a battle won: base + per battle of the chapter; a boss's own gold is its bounty; + per new star */
  winGold: 30,
  winGoldPerBattle: 8,
  starGold: 6,
  /** the stars of a battle won: walls left at the end ≥ these shares (one star for winning) */
  star2: 0.5,
  star3: 0.8,
  /** the price of the next gate level: gatePrice × level^gateExp; of a unit's next level: unitPrice[tier] × level^unitExp */
  gatePrice: 35,
  gateExp: 1.55,
  unitExp: 1.6,

  // ── between battles ──────────────────────────────────────────
  /** the gate of ash falls / the host withdraws: the celebration (s); then the upgrade card (auto-continue, s) */
  wonHold: 2.4,
  lostHold: 2.6,
  upgradeSec: 5.5,

  // ── the session ──────────────────────────────────────────────
  /** Natarcie and Cisza: nominal length ± jitter (s); no block under minBlock */
  push: [24, 4],
  rest: [23, 3],
  minBlock: 12,
  telegraph: 4,
  finale: 6,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** the lead-in before the band speeds the light (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** Natarcie blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the coach: a mark at most every this long (s), each shown at most this many times */
  hintEvery: 6,
  hintTimes: 3,
  /** the companion: a line at most every this long (s); a line shows this long (s) */
  talkEvery: 9,
  talkSec: 3.4,

  // ── the meta ─────────────────────────────────────────────────
  /** battles in a chapter; the last is the boss gate */
  chapter: 5,
  /** the day's gift (gold, the same for everyone who comes) */
  giftGold: 40,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** The host's units, in the cards' order (keys 1–7). */
export const HOST_IDS = ['straznik', 'lucznik', 'tarczownik', 'wlocznik', 'jezdziec', 'serafin', 'archaniol'] as const;
export type HostId = typeof HOST_IDS[number];
/** The demons that march in waves, then the bosses (one per chapter's last battle, in turn). */
export const WAVE_IDS = ['chochlik', 'cien', 'ogar', 'skrzydlak', 'miotacz', 'bestia'] as const;
export const BOSS_IDS = ['kolos', 'szarancza', 'smok'] as const;
export const DEMON_IDS = [...WAVE_IDS, ...BOSS_IDS] as const;
export type WaveId = typeof WAVE_IDS[number];
export type BossId = typeof BOSS_IDS[number];
export type DemonId = WaveId | BossId;
export const isBoss = (id: string): id is BossId => (BOSS_IDS as readonly string[]).includes(id);

/** What each angel is the bane of (×RULES.bane): the readable rock-paper-scissors of the road. */
export const BANE: Readonly<Record<HostId, WaveId | null>> = {
  straznik: 'cien', lucznik: 'skrzydlak', tarczownik: null, wlocznik: 'ogar', jezdziec: 'miotacz', serafin: 'chochlik', archaniol: 'bestia',
};
/** The angel that answers a demon (the card that glows when it comes). */
export const ANSWER: Readonly<Record<WaveId, HostId>> = {
  chochlik: 'serafin', cien: 'straznik', ogar: 'wlocznik', skrzydlak: 'lucznik', miotacz: 'jezdziec', bestia: 'archaniol',
};
/** The demons' banes on the host (×RULES.demonBane). */
export const DEMON_BANE: Readonly<Partial<Record<WaveId, readonly HostId[]>>> = {
  ogar: ['lucznik'], bestia: ['straznik', 'wlocznik'],
};

/**
 * A fighter's numbers at level 1: hp, damage per strike, seconds between strikes, reach (m), walk
 * (m/s); `fly`: in the air (ground blades pass under it; bows, fire, the beam and the trumpet reach
 * it); `aoe`: the strike's splash radius (m); `armor`: the share of damage it turns aside.
 */
export interface Stats {
  hp: number; dmg: number; rate: number; range: number; speed: number;
  fly: boolean; aoe: number; armor: number; ranged: boolean;
}

export interface HostStats extends Stats {
  /** light to send, the card's cooldown (s), the gate level that opens the card, the upgrade price tier */
  cost: number; cool: number; gate: number; price: number;
}

export interface DemonStats extends Stats {
  /** gold for beating it; the battle (0-based, all chapters) from which it marches */
  gold: number; from: number;
}

const s = (o: Partial<Stats> & Pick<Stats, 'hp' | 'dmg' | 'rate' | 'range' | 'speed'>): Stats =>
  ({ fly: false, aoe: 0, armor: 0, ranged: false, ...o });

export const HOST: Readonly<Record<HostId, HostStats>> = {
  straznik: { ...s({ hp: 85, dmg: 12, rate: 0.75, range: 0.9, speed: 1.8 }), cost: 20, cool: 1.2, gate: 1, price: 20 },
  lucznik: { ...s({ hp: 38, dmg: 8, rate: 0.9, range: 5.5, speed: 1.5, ranged: true }), cost: 30, cool: 2.5, gate: 1, price: 24 },
  tarczownik: { ...s({ hp: 210, dmg: 5, rate: 1, range: 0.9, speed: 1.1, armor: 0.3 }), cost: 45, cool: 4, gate: 1, price: 28 },
  wlocznik: { ...s({ hp: 95, dmg: 11, rate: 0.85, range: 1.5, speed: 1.6 }), cost: 35, cool: 2.5, gate: 2, price: 28 },
  jezdziec: { ...s({ hp: 120, dmg: 18, rate: 0.8, range: 1.1, speed: 3.4 }), cost: 60, cool: 6, gate: 3, price: 34 },
  serafin: { ...s({ hp: 80, dmg: 12, rate: 1.3, range: 3.5, speed: 1.6, fly: true, aoe: 1.4, ranged: true }), cost: 90, cool: 9, gate: 4, price: 42 },
  archaniol: { ...s({ hp: 420, dmg: 34, rate: 0.9, range: 1.4, speed: 1.7, aoe: 1.2, armor: 0.2 }), cost: 150, cool: 30, gate: 6, price: 60 },
};

export const DEMONS: Readonly<Record<DemonId, DemonStats>> = {
  chochlik: { ...s({ hp: 30, dmg: 5, rate: 0.8, range: 0.8, speed: 1.4 }), gold: 2, from: 0 },
  cien: { ...s({ hp: 60, dmg: 8, rate: 0.9, range: 0.9, speed: 1.2 }), gold: 3, from: 0 },
  ogar: { ...s({ hp: 36, dmg: 7, rate: 0.6, range: 0.8, speed: 2.9 }), gold: 3, from: 1 },
  skrzydlak: { ...s({ hp: 36, dmg: 7, rate: 1, range: 2.2, speed: 1.6, fly: true, ranged: true }), gold: 4, from: 2 },
  miotacz: { ...s({ hp: 40, dmg: 7, rate: 1.4, range: 4.5, speed: 1.1, ranged: true }), gold: 4, from: 3 },
  bestia: { ...s({ hp: 240, dmg: 20, rate: 1.3, range: 1, speed: 0.8, armor: 0.15 }), gold: 9, from: 6 },
  kolos: { ...s({ hp: 1700, dmg: 26, rate: 1.7, range: 1.6, speed: 0.4, aoe: 1.6, armor: 0.2 }), gold: 110, from: 4 },
  szarancza: { ...s({ hp: 1400, dmg: 14, rate: 1.1, range: 2.6, speed: 0.55, aoe: 1.2, ranged: true }), gold: 120, from: 9 },
  smok: { ...s({ hp: 1800, dmg: 22, rate: 1.6, range: 3, speed: 0.45, aoe: 2.5, armor: 0.1, ranged: true }), gold: 130, from: 14 },
};
