/**
 * Every number of Zastępy's rules in one place (sim.ts and battle.ts re-export it): the road, the
 * gates, the light, the host and the demons, the waves, the trumpet, the blocks and the meta game.
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
  /** the gate of ash: base walls, + per battle of the circle; × per circle */
  ash: 2200,
  ashPerBattle: 230,
  ashCircle: 0.55,
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
  /** demons' hp and damage: × (1 + perBattle × b) × (1 + perCircle × c) */
  demonPerBattle: 0.05,
  demonPerCircle: 0.5,
  /** the Smok steps out after this long (s) in the tenth battle; its waves are those of this battle */
  smokAt: 10,
  smokWaves: 3,

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
  /** gold for a battle won: base + per battle of the circle; the Smok's own gold is its bounty */
  winGold: 30,
  winGoldPerBattle: 8,
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
  /** the warm-up's hint shows after this long without a card sent (s) */
  idleHint: 3.5,

  // ── the meta ─────────────────────────────────────────────────
  /** battles in a circle; the last is the Smok */
  circle: 10,
  /** the day's gift (gold, the same for everyone who comes) */
  giftGold: 40,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** The host's units, in the cards' order (keys 1–6). */
export const HOST_IDS = ['straznik', 'lucznik', 'tarczownik', 'jezdziec', 'serafin', 'archaniol'] as const;
export type HostId = typeof HOST_IDS[number];
export const DEMON_IDS = ['chochlik', 'cien', 'ogar', 'skrzydlak', 'bestia', 'smok'] as const;
export type DemonId = typeof DEMON_IDS[number];

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
  /** gold for beating it; the battle of a circle (0-based) from which it marches */
  gold: number; from: number;
}

const s = (o: Partial<Stats> & Pick<Stats, 'hp' | 'dmg' | 'rate' | 'range' | 'speed'>): Stats =>
  ({ fly: false, aoe: 0, armor: 0, ranged: false, ...o });

export const HOST: Readonly<Record<HostId, HostStats>> = {
  straznik: { ...s({ hp: 85, dmg: 12, rate: 0.75, range: 0.9, speed: 1.8 }), cost: 20, cool: 1.2, gate: 1, price: 20 },
  lucznik: { ...s({ hp: 38, dmg: 8, rate: 0.9, range: 5.5, speed: 1.5, ranged: true }), cost: 30, cool: 2.5, gate: 1, price: 24 },
  tarczownik: { ...s({ hp: 210, dmg: 5, rate: 1, range: 0.9, speed: 1.1, armor: 0.3 }), cost: 45, cool: 4, gate: 1, price: 28 },
  jezdziec: { ...s({ hp: 120, dmg: 18, rate: 0.8, range: 1.1, speed: 3.4 }), cost: 60, cool: 6, gate: 2, price: 34 },
  serafin: { ...s({ hp: 80, dmg: 12, rate: 1.3, range: 3.5, speed: 1.6, fly: true, aoe: 1.4, ranged: true }), cost: 90, cool: 9, gate: 4, price: 42 },
  archaniol: { ...s({ hp: 420, dmg: 34, rate: 0.9, range: 1.4, speed: 1.7, aoe: 1.2, armor: 0.2 }), cost: 150, cool: 30, gate: 6, price: 60 },
};

export const DEMONS: Readonly<Record<DemonId, DemonStats>> = {
  chochlik: { ...s({ hp: 30, dmg: 5, rate: 0.8, range: 0.8, speed: 1.4 }), gold: 2, from: 0 },
  cien: { ...s({ hp: 60, dmg: 8, rate: 0.9, range: 0.9, speed: 1.2 }), gold: 3, from: 0 },
  ogar: { ...s({ hp: 36, dmg: 7, rate: 0.6, range: 0.8, speed: 2.9 }), gold: 3, from: 1 },
  skrzydlak: { ...s({ hp: 36, dmg: 7, rate: 1, range: 2.2, speed: 1.6, fly: true, ranged: true }), gold: 4, from: 2 },
  bestia: { ...s({ hp: 240, dmg: 20, rate: 1.3, range: 1, speed: 0.8, armor: 0.15 }), gold: 9, from: 5 },
  smok: { ...s({ hp: 2300, dmg: 22, rate: 1.6, range: 3, speed: 0.45, aoe: 2.5, armor: 0.1, ranged: true }), gold: 120, from: 9 },
};
