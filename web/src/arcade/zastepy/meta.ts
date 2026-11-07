/**
 * What Zastępy remembers between sessions (v2) and the pure rules of its meta game: the gold, the
 * gate of light's level (1–10: walls, the flow of light, the beam, the cards it opens), the host's
 * unit levels (1–5 each), the pillar of cloud's level, the battle the player stands at on the
 * campaign map (chapters of five, the fifth a boss gate; each chapter past the first is a new age of
 * the fortress), the stars won on each battle, the story cards seen, the coach marks done, the
 * records per session length, the day's gift.  No DOM, no randomness.
 *
 * Old saves (v1: `v: 1`, circles of ten with the Smok in the tenth) are migrated in place by
 * `migrate()`: everything v1 kept means the same in v2 (the gold, the gate, the unit levels, the
 * battle reached, the records), so it is kept; the new fields start fresh, and fields of a wrong
 * type are reset rather than trusted.
 */
import { BOSS_IDS, HOST, HOST_IDS, RULES, type BossId, type HostId } from './rules';

export interface ZastepyProgress {
  ver: 2;
  /** sessions saved */
  sessions: number;
  /** demons beaten, all time; battles won; boss gates broken; trumpets sounded; pillars raised */
  total: number;
  won: number;
  bosses: number;
  trumpets: number;
  pillars: number;
  /** the battle the player stands at (0-based, all chapters): chapter = ⌊battle / 5⌋ */
  battle: number;
  /** the best stars per battle won (index = battle) */
  stars: number[];
  /** gold in hand, and gold earned all time */
  gold: number;
  goldAll: number;
  /** the gate of light's level (1..10), the host's unit levels (1..5), the pillar of cloud's level (1..5) */
  gate: number;
  units: Record<HostId, number>;
  hero: number;
  /** Natarcie blocks begun, all time: every 4th is blind ("Mgła bitewna") from the 3rd session */
  calls: number;
  /** records: demons per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** story cards shown: bit 0 the opening, bit a the card of age a */
  seen: number;
  /** coach marks whose thing the player has done or seen (bits of Teach) */
  taught: number;
  /** the day's gift */
  giftDay: string;
}

const freshUnits = (): Record<HostId, number> =>
  Object.fromEntries(HOST_IDS.map(id => [id, 1])) as Record<HostId, number>;

export function freshProgress(): ZastepyProgress {
  return {
    ver: 2, sessions: 0, total: 0, won: 0, bosses: 0, trumpets: 0, pillars: 0, battle: 0, stars: [], gold: 0, goldAll: 0, gate: 1,
    units: freshUnits(), hero: 1, calls: 0, best: {}, lastLen: 0, seen: 0, taught: 0, giftDay: '',
  };
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);

/**
 * Bring a loaded save to v2, in place (idempotent).  A v1 save keeps its sessions, records, demons
 * beaten, battles won, Smoks beaten (as boss gates), trumpets, gold, gate and unit levels, the battle
 * it reached, its blind-block count and the day's gift.  Any field of the wrong type is reset.
 */
export function migrate(p: ZastepyProgress): ZastepyProgress {
  const o = p as unknown as Record<string, unknown>;
  if ('v' in o || o.ver !== 2) {
    const units = o.units && typeof o.units === 'object' && !Array.isArray(o.units) ? (o.units as Record<string, unknown>) : {};
    const keep = {
      sessions: num(o.sessions), total: num(o.total), won: num(o.won), bosses: num(o.bosses, num(o.smoks)), trumpets: num(o.trumpets),
      battle: num(o.battle), gold: num(o.gold), goldAll: num(o.goldAll), gate: num(o.gate, 1), calls: num(o.calls), lastLen: num(o.lastLen),
      units: Object.fromEntries(HOST_IDS.map(id => [id, num(units[id], 1)])) as Record<HostId, number>,
      giftDay: typeof o.giftDay === 'string' ? o.giftDay : '',
      best: o.best && typeof o.best === 'object' && !Array.isArray(o.best) ? (o.best as Record<string, number>) : {},
      // a v1 player has played: the hands need no teaching again
      taught: num(o.sessions) > 0 ? HANDS : 0,
      seen: num(o.sessions) > 0 ? 1 : 0,
    };
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, freshProgress(), keep);
  }
  // sanitise every field (an odd save never crashes the game)
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const k of Object.keys(f)) {
    if (Array.isArray(f[k])) {
      if (!Array.isArray(o[k])) o[k] = [];
      continue;
    }
    const want = typeof f[k];
    if (want === 'number' && !(typeof o[k] === 'number' && Number.isFinite(o[k]))) o[k] = f[k];
    else if (want === 'string' && typeof o[k] !== 'string') o[k] = f[k];
    else if (want === 'object' && !(o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]))) o[k] = f[k];
  }
  o.ver = 2;
  const u = o.units as Record<string, unknown>;
  for (const id of HOST_IDS) if (typeof u[id] !== 'number' || !Number.isFinite(u[id])) u[id] = 1;
  const best = o.best as Record<string, unknown>;
  for (const k of Object.keys(best)) if (typeof best[k] !== 'number' || !Number.isFinite(best[k])) delete best[k];
  p.stars = p.stars.map(v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(3, Math.round(v))) : 0));
  p.battle = Math.max(0, Math.floor(p.battle));
  return p;
}

// ── the coach marks ──────────────────────────────────────────────
export const TEACH = ['card', 'pillar', 'counter', 'trumpet', 'upgrade', 'boss', 'rest'] as const;
export type Teach = typeof TEACH[number];
export const taughtBit = (w: Teach): number => 1 << TEACH.indexOf(w);
export const isTaught = (p: ZastepyProgress, w: Teach): boolean => ((p.taught ?? 0) & taughtBit(w)) !== 0;
/** the hands: a v1 player knows them already */
const HANDS = taughtBit('card');

// ── the campaign ─────────────────────────────────────────────────
/** The chapter (0-based) and the battle within it (0..4) of a battle number. */
export const chapterOf = (battle: number): { chapter: number; local: number } =>
  ({ chapter: Math.floor(Math.max(0, battle) / RULES.chapter), local: Math.max(0, battle) % RULES.chapter });

/** A chapter's last battle: a boss gate. */
export const isBossBattle = (battle: number): boolean => chapterOf(battle).local === RULES.chapter - 1;

/** The boss of a chapter (in turn: the Colossus, the Locust, the Dragon). */
export const bossOf = (battle: number): BossId => BOSS_IDS[chapterOf(battle).chapter % BOSS_IDS.length];

/** The age of the fortress a battle is fought in (0 stone, 1 cedar, 2 bronze, 3 gold, 4 pearl). */
export const ageOf = (battle: number): number => Math.min(RULES.ageMax, chapterOf(battle).chapter);

/** The host's power in an age (× hp and damage). */
export const agePower = (age: number): number => 1 + RULES.agePower * Math.max(0, Math.min(RULES.ageMax, age));

/** The stars of a battle won with this share of the walls left. */
export const starsFor = (walls: number): number => 1 + (walls >= RULES.star2 ? 1 : 0) + (walls >= RULES.star3 ? 1 : 0);

/** The stars won in a chapter (of 3 × 5). */
export function chapterStars(p: ZastepyProgress, chapter: number): number {
  let n = 0;
  for (let i = 0; i < RULES.chapter; i++) n += p.stars[chapter * RULES.chapter + i] ?? 0;
  return n;
}

// ── the gate, the units, the pillar ──────────────────────────────
/** The unit levels as saved (an older save may miss a unit: it is level 1). */
export const unitLevel = (p: ZastepyProgress, id: HostId): number =>
  Math.min(RULES.unitMaxLevel, Math.max(1, Math.round(p.units?.[id] ?? 1)));

export const gateLevel = (p: ZastepyProgress): number => Math.min(RULES.gateMax, Math.max(1, Math.round(p.gate || 1)));
export const heroLevel = (p: ZastepyProgress): number => Math.min(RULES.heroMax, Math.max(1, Math.round(p.hero || 1)));

/** The gold for the next gate level (null at the top). */
export function gatePrice(level: number): number | null {
  if (level >= RULES.gateMax) return null;
  return Math.round(RULES.gatePrice * level ** RULES.gateExp);
}

/** The gold for a unit's next level (null at the top). */
export function unitPrice(id: HostId, level: number): number | null {
  if (level >= RULES.unitMaxLevel) return null;
  return Math.round(HOST[id].price * level ** RULES.unitExp);
}

/** The gold for the pillar's next level (null at the top). */
export function heroPrice(level: number): number | null {
  if (level >= RULES.heroMax) return null;
  return Math.round(RULES.heroPrice * level ** RULES.unitExp);
}

/** The cards the gate opens at a level, in order. */
export const cardsAt = (gate: number): HostId[] => HOST_IDS.filter(id => HOST[id].gate <= gate);

/** The gate level that opens the next card (null: all open). */
export function nextCardGate(gate: number): { id: HostId; gate: number } | null {
  const id = HOST_IDS.find(i => HOST[i].gate > gate);
  return id ? { id, gate: HOST[id].gate } : null;
}

/** Raise the gate one level if the gold allows; true when bought. */
export function buyGate(p: ZastepyProgress): boolean {
  const lv = gateLevel(p), price = gatePrice(lv);
  if (price === null || p.gold < price) return false;
  p.gold -= price;
  p.gate = lv + 1;
  return true;
}

/** Raise a unit one level if the gold allows and its card is open; true when bought. */
export function buyUnit(p: ZastepyProgress, id: HostId): boolean {
  const lv = unitLevel(p, id), price = unitPrice(id, lv);
  if (price === null || p.gold < price || HOST[id].gate > gateLevel(p)) return false;
  p.gold -= price;
  p.units = { ...freshUnits(), ...p.units, [id]: lv + 1 };
  return true;
}

/** Raise the pillar of cloud one level if the gold allows; true when bought. */
export function buyHero(p: ZastepyProgress): boolean {
  const lv = heroLevel(p), price = heroPrice(lv);
  if (price === null || p.gold < price) return false;
  p.gold -= price;
  p.hero = lv + 1;
  return true;
}

// ── the numbers of the gate and the pillar ───────────────────────
export const wallsFor = (gate: number, retreats = 0): number => RULES.walls + RULES.wallsPerLevel * (gate - 1) + RULES.wallsPerRetreat * retreats;
export const flowFor = (gate: number): number => RULES.flow + RULES.flowPerLevel * (gate - 1);
export const lightMaxFor = (gate: number): number => RULES.lightMax + RULES.lightMaxPerLevel * (gate - 1);
export const beamFor = (gate: number): { dmg: number; rate: number; range: number } => ({
  dmg: RULES.beamDmg + RULES.beamDmgPerLevel * (gate - 1),
  rate: Math.max(0.5, RULES.beamRate - RULES.beamRatePerLevel * (gate - 1)),
  range: RULES.beamRange + RULES.beamRangePerLevel * (gate - 1),
});
export const trumpetDmgFor = (gate: number): number => RULES.trumpetDmg + RULES.trumpetDmgPerLevel * (gate - 1);
export const pillarFor = (level: number): { sec: number; cool: number; burn: number } => ({
  sec: RULES.pillarSec + RULES.pillarSecPerLevel * (level - 1),
  cool: RULES.pillarCool - RULES.pillarCoolPerLevel * (level - 1),
  burn: RULES.pillarBurn + RULES.pillarBurnPerLevel * (level - 1),
});
/** A unit's hp and damage at a level in an age. */
export function unitStats(id: HostId, level: number, age: number): { hp: number; dmg: number } {
  const k = (1 + RULES.unitPerLevel * (level - 1)) * agePower(age);
  return { hp: Math.round(HOST[id].hp * k), dmg: Math.round(HOST[id].dmg * k) };
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: ZastepyProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: ZastepyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
