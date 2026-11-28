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
import type { Difficulty } from '../kit/difficulty';

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
  /**
   * the demons' waves come this much slower, and walk at this speed (×).  Round 15: 1.7 → 2.2 — with the Cisza a third
   * of the session (it was half), a deeper lull keeps a minute's waves about as many as before (a host at the top
   * deep in the campaign won ~7 of 8 battles in 30 minutes again, not 5 of 10)
   */
  restGap: 2.2,
  restWalk: 0.7,
  /**
   * calm mends the walls (share of the walls per second at calm 1) and lays shields (hp/s at calm 1).  Round 15: the
   * Cisza is a third of the session where it was half, so it mends a third faster (0.012 → 0.016, a passed one
   * 0.12 → 0.16): a minute of battle mends about what it did, and a host at the top still holds the plateau.
   */
  mend: 0.016,
  shieldGain: 14,
  /** the shield of light: at most this share of a unit's hp; on this many units at the front */
  shieldMax: 0.5,
  shieldFront: 3,
  /** the brain's lead-in before calm mends (s), Mendi / HALO */
  calmLead: { fnirs: 4, eeg: 2 },
  /** a passed Cisza: the walls mend by this share at once, and gold */
  restWalls: 0.16,
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
  /**
   * the darkness stops growing at this chapter (0-based): past it the gate of ash, the shades, their
   * surges, embers and pace stay those of the 8th chapter (the bosses still come in turn).  The host
   * stops growing too (the pearl age, the top levels); without the plateau a fully upgraded host that
   * answers every wave withdraws again and again from the 11th chapter on — reached within a few
   * 30-minute sessions — and a battle could last ten minutes.
   */
  chapterCap: 7,
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
  /**
   * Natarcie and Cisza: nominal length ± jitter (s); no block under minBlock.  The designed rhythm (round 15, DESIGN
   * §19.2): a 40 s Natarcie — the light's stream long enough to send out a host and press a wave back — then a 20 s
   * Cisza, the lull in which the demons slow and calm mends the walls; rest a third of the session, where 24 / 23 s
   * made it nearly half.  The player sets both in the lobby (kit/rhythm.ts); the jitter scales with them.
   */
  push: [40, 7],
  rest: [20, 3],
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
  /**
   * a moment's lines all said, they come round again (in the same order) only after this long (s)
   * of the session, a round per this long: a session of up to 10 minutes never repeats a line, a
   * 30-minute one still hears Tymek at its 20th minute
   */
  talkRound: 600,

  // ── the meta ─────────────────────────────────────────────────
  /** battles in a chapter; the last is the boss gate */
  chapter: 5,
  /** the day's gift (gold, the same for everyone who comes) */
  giftGold: 40,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/**
 * The difficulty levels (kit/difficulty.ts, DESIGN §29) on Zastępy's own knobs — multipliers on REGULAR, which is
 * all ones (the game as it was, number for number).  What a level never touches is the training: the flow's
 * multiplier, the trumpet's hold, calm's mending and shields, a passed Cisza's walls and gold, the blind block's
 * pay, the blocks themselves; nor the host the player built (the gate's beam, the cards, the pillar, the trumpet).
 *
 * The shared scale is bent for a lane battler, where the numbers compound: stronger demons that also come more
 * often meet a host that reaches the gate of ash later, so its surges and the waves that grow with the battle's
 * length pile up — at SCALE's own numbers (foe ×1.4 / ×2, waves ×1.25 / ×1.5) a focused player who answers every
 * wave lost the first battle at Hardcore and the campaign stalled (5 battles in four 10-minute sessions where
 * REGULAR made 31).  Measured with the session bots (test/arcade-zastepy.test.ts, "levels"): a focused player who
 * answers the waves reaches about battle 42 / 31 / 26 / 17 in four 10-minute sessions from Na start to Hardcore, a
 * player without the band and without the counters 35 / 18 / 12 / 8.
 *   foe      the demons' hp and damage (the bosses, their specials and the embers of the gate of ash too)
 *   ash      the gate of ash's walls (only Na start's falls sooner)
 *   waves    how often the waves come (their gap ÷ this)
 *   count    how big the cracking gate's surges are (×)
 *   speed    the demons' walk and the pace of their strikes — SCALE.speed bent to half its step
 *   walls    the gate of light's walls — SCALE.self, a little gentler at Hardcore
 *   grace    a withdrawal's stronger walls (×) — the help a lost battle gives; none at Hardcore
 *   light    the light a battle starts with (×; at Hardcore still a strażnik's price: the first card is never a wait)
 *   lift     the answering card lifts and glows when its shade comes (a hint; Hardcore reads the wave's icons alone)
 *   reward   the gold a won battle, its stars and a beaten demon pay — SCALE.reward
 */
export interface ZastepyLevel {
  foe: number; ash: number; waves: number; count: number; speed: number; walls: number;
  grace: number; light: number; lift: boolean; reward: number;
}

export const LEVELS: Readonly<Record<Difficulty, ZastepyLevel>> = {
  start: { foe: 0.6, ash: 0.8, waves: 0.8, count: 0.8, speed: 0.85, walls: 1.5, grace: 1.5, light: 1.5, lift: true, reward: 0.9 },
  regular: { foe: 1, ash: 1, waves: 1, count: 1, speed: 1, walls: 1, grace: 1, light: 1, lift: true, reward: 1 },
  advanced: { foe: 1.2, ash: 1, waves: 1.05, count: 1.2, speed: 1.05, walls: 0.85, grace: 0.6, light: 0.8, lift: true, reward: 1.15 },
  hardcore: { foe: 1.4, ash: 1, waves: 1.1, count: 1.4, speed: 1.1, walls: 0.75, grace: 0, light: 0.5, lift: false, reward: 1.3 },
};

/** A level's knobs (an unknown value: REGULAR). */
export const levelKnobs = (d: Difficulty | undefined): ZastepyLevel => LEVELS[d ?? 'regular'] ?? LEVELS.regular;

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
