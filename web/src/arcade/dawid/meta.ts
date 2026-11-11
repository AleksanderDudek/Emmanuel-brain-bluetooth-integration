/**
 * What Dawid remembers between sessions and the pure rules of its meta game:
 *
 *   David        his level and the XP into it, rested XP waiting for the morning
 *   the road     the land now (six lands, circle after circle), the guardian's wounds there, the quest chain
 *   the camp     the treasury (silver, wood, stone) and the buildings, which travel with David
 *   the bonfire  the ability ladder (steep silver costs, capped by the bonfire's level)
 *   the forge    the weapons' levels (an evolution every five levels; capped by the forge's level)
 *   the party    companions joined through the story, their friendship (stars), who walks along
 *   records      XP per session length, the shepherd's tally of beasts driven off, the cave's deepest floor
 *
 * Version 1.  The placeholder of round 5 saved `{ sessions: n }`: it is read as a fresh save that
 * keeps its session count.  Fields of a wrong type are reset rather than trusted.  No DOM, no randomness.
 */
import {
  ABILITIES, ABILITY_CAP, BUILDINGS, COMPANIONS, CRAFT, GUARDS, LANDS, LAND_COUNT, STAR_AT, STORE_K, TIER_K, WEAPONS, WEAPON_CAP,
  ability, building, slotsAt, type AbilityId, type BuildingId, type CompanionId, type LandSpec, type WeaponId,
} from './content';
import { RULES } from './rules';

export interface DawidProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** David's level, the XP into it, all-time XP, and rested XP waiting (a bonus pool) */
  level: number;
  xp: number;
  total: number;
  rested: number;
  /** the treasury */
  silver: number;
  wood: number;
  stone: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** the land now (0, 1, 2… through the six lands, circle after circle) and the wounds of its guardian */
  land: number;
  wounds: number;
  /** the land's quest chain: the quest now and its progress */
  quest: number;
  questN: number;
  /** levels: abilities, buildings, weapons (0 = not owned; the sling starts at 1) */
  ab: Record<string, number>;
  bd: Record<string, number>;
  wp: Record<string, number>;
  /** companions joined (in order), their friendship, and who walks along */
  joined: string[];
  friend: Record<string, number>;
  party: string[];
  /** beasts driven off by kind (the shepherd's tally) */
  tally: Record<string, number>;
  /** guardians driven off, great stones thrown, thieves caught, quests done (all time) */
  guards: number;
  stones: number;
  thieves: number;
  quests: number;
  /** the cave of Adullam: the deepest floor cleared */
  floor: number;
  /** records: XP per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** first-time explanations already given (coach marks) */
  seen: string[];
}

export function freshProgress(): DawidProgress {
  return {
    ver: 1, sessions: 0, level: 1, xp: 0, total: 0, rested: 0, silver: 0, wood: 0, stone: 0, pushes: 0,
    land: 0, wounds: 0, quest: 0, questN: 0, ab: {}, bd: {}, wp: { proca: 1 }, joined: [], friend: {}, party: [],
    tally: {}, guards: 0, stones: 0, thieves: 0, quests: 0, floor: 0, best: {}, lastLen: 0, seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nonNeg = (v: unknown, d = 0): number => Math.max(0, num(v, d));
const ints = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (num(x) > 0) out[k] = Math.floor(num(x));
  return out;
};
const strs = (v: unknown, allowed?: readonly string[]): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && (!allowed || allowed.includes(x))))] : [];

/**
 * Bring a loaded save to version 1, in place (idempotent).  The placeholder's `{ sessions }` keeps its
 * count; every field of a wrong type falls back to its fresh value; levels and lists are cleaned.
 */
export function migrate(p: DawidProgress): DawidProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress() as unknown as Record<string, unknown>;
  if (raw.ver !== 1) {
    // the placeholder (or anything older): only the session count means something
    const keep = { sessions: Math.floor(nonNeg(raw.sessions)) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), keep);
    return p;
  }
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'number' && typeof raw[k] !== 'number') raw[k] = v;
    if (Array.isArray(v) && !Array.isArray(raw[k])) raw[k] = [...v];
    if (isObj(v) && !isObj(raw[k])) raw[k] = { ...v };
  }
  for (const k of ['sessions', 'xp', 'total', 'rested', 'silver', 'wood', 'stone', 'pushes', 'land', 'wounds', 'quest', 'questN', 'guards', 'stones', 'thieves', 'quests', 'floor', 'lastLen'] as const) {
    (p as unknown as Record<string, number>)[k] = nonNeg(p[k]);
  }
  for (const k of ['sessions', 'pushes', 'land', 'quest', 'questN', 'guards', 'stones', 'thieves', 'quests', 'floor'] as const) {
    (p as unknown as Record<string, number>)[k] = Math.floor(p[k]);
  }
  p.level = Math.max(1, Math.floor(num(p.level, 1)));
  p.ab = ints(p.ab);
  p.bd = ints(p.bd);
  p.wp = ints(p.wp);
  p.wp.proca = Math.max(1, p.wp.proca ?? 1);
  p.friend = ints(p.friend);
  p.tally = ints(p.tally);
  const ids = COMPANIONS.map(c => c.id);
  p.joined = strs(p.joined, ids);
  p.party = strs(p.party, p.joined);
  p.seen = strs(p.seen);
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = num(v);
  p.best = best;
  return p;
}

// ── levels ───────────────────────────────────────────────────────
/** XP from level L to the next (L ≥ 1): a gentle exponential, tidy numbers. */
export function xpNeed(level: number): number {
  const v = RULES.xpBase * RULES.xpGrow ** (Math.max(1, level) - 1);
  return v < 100 ? Math.round(v) : Math.round(v / 10) * 10;
}

/** David's damage and health before abilities and weapons. */
export const baseDmg = (level: number): number => RULES.dmgBase + RULES.dmgPerLevel * (Math.max(1, level) - 1);
export const baseHp = (level: number): number => RULES.hpBase + RULES.hpPerLevel * (Math.max(1, level) - 1);

// ── the road ─────────────────────────────────────────────────────
/** The land at a place on the endless road: its spec, its index in the circle and the circle. */
export function landAt(i: number): { spec: LandSpec; idx: number; circle: number } {
  const n = Math.max(0, Math.floor(i));
  return { spec: LANDS[n % LAND_COUNT], idx: n % LAND_COUNT, circle: Math.floor(n / LAND_COUNT) };
}

/** The strength of the beasts (and their XP and silver) at a place on the road. */
export const landK = (i: number): number => {
  const { idx, circle } = landAt(i);
  return RULES.landK[idx] * RULES.circleK ** circle;
};

/** A guardian's spirit at a place on the road. */
export const guardHp = (i: number): number => Math.round(GUARDS[landAt(i).spec.guard].hp * landK(i));

/** How many lands David has reached in the first circle (for unlocks): 1 at the start, 6 from Gath on. */
export const reached = (p: DawidProgress): number => Math.min(LAND_COUNT, Math.max(0, Math.floor(p.land)) + 1);

// ── the bonfire: abilities ───────────────────────────────────────
export const abilityLevel = (p: DawidProgress, id: AbilityId): number => Math.max(0, Math.floor(num(p.ab[id])));
/** the silver for the next level of an ability (from level `have`) */
export const abilityCost = (id: AbilityId, have: number): number => {
  const a = ability(id);
  const v = a.cost * a.grow ** Math.max(0, have);
  return v < 1000 ? Math.round(v) : Math.round(v / 10) * 10;
};
/** the highest level the bonfire allows now (0: no bonfire yet) */
export const abilityCap = (p: DawidProgress, id: AbilityId): number => Math.min(ability(id).max, ABILITY_CAP[Math.min(3, buildingLevel(p, 'ognisko'))]);

export type BuyWhy = 'ok' | 'max' | 'cap' | 'silver' | 'need' | 'land' | 'gift';

export function abilityWhy(p: DawidProgress, id: AbilityId): BuyWhy {
  const lv = abilityLevel(p, id);
  if (lv >= ability(id).max) return 'max';
  if (buildingLevel(p, 'ognisko') <= 0) return 'need';
  if (lv >= abilityCap(p, id)) return 'cap';
  // the triple throw comes after ten levels of the double
  if (id === 'potrojny' && abilityLevel(p, 'podwojny') < 10) return 'need';
  return p.silver >= abilityCost(id, lv) ? 'ok' : 'silver';
}

export function buyAbility(p: DawidProgress, id: AbilityId): boolean {
  if (abilityWhy(p, id) !== 'ok') return false;
  const lv = abilityLevel(p, id);
  p.silver -= abilityCost(id, lv);
  p.ab[id] = lv + 1;
  return true;
}

// ── the camp: buildings ──────────────────────────────────────────
export const buildingLevel = (p: DawidProgress, id: BuildingId): number => Math.max(0, Math.min(3, Math.floor(num(p.bd[id]))));
/** silver, wood and stone for the next level (null: at its top) */
export function buildingCost(id: BuildingId, have: number): readonly [number, number, number] | null {
  const c = building(id).cost;
  return have >= c.length ? null : c[have];
}

export function buildingWhy(p: DawidProgress, id: BuildingId): BuyWhy {
  const b = building(id), lv = buildingLevel(p, id);
  const cost = buildingCost(id, lv);
  if (!cost) return 'max';
  if (b.after && buildingLevel(p, b.after) <= 0) return 'need';
  if (b.land !== undefined && reached(p) <= b.land) return 'land';
  return p.silver >= cost[0] && p.wood >= cost[1] && p.stone >= cost[2] ? 'ok' : 'silver';
}

export function build(p: DawidProgress, id: BuildingId): boolean {
  if (buildingWhy(p, id) !== 'ok') return false;
  const lv = buildingLevel(p, id), cost = buildingCost(id, lv)!;
  p.silver -= cost[0];
  p.wood -= cost[1];
  p.stone -= cost[2];
  p.bd[id] = lv + 1;
  return true;
}

// ── the forge: weapons ───────────────────────────────────────────
export const weaponLevel = (p: DawidProgress, id: WeaponId): number => Math.max(0, Math.min(RULES.weaponMax, Math.floor(num(p.wp[id]))));
export const tierOf = (level: number): number => Math.max(0, Math.min(4, Math.floor((Math.max(1, level) - 1) / RULES.tierEvery)));
/** a weapon's damage factor at a level (its tier, and 6 % a level inside the tier) */
export const weaponK = (level: number): number => {
  const lv = Math.max(1, level), tier = tierOf(lv);
  return TIER_K[tier] * (1 + 0.06 * (lv - 1 - tier * RULES.tierEvery));
};
/** the next level's price: silver, and wood and stone when it is an evolution (null: at its top) */
export function weaponCost(id: WeaponId, have: number): readonly [number, number, number] | null {
  if (have >= RULES.weaponMax || have <= 0) return null;
  const w = WEAPONS[id];
  const v = w.cost * w.grow ** (have - 1);
  const silver = v < 1000 ? Math.round(v) : Math.round(v / 10) * 10;
  const evo = have % RULES.tierEvery === 0;
  const tier = tierOf(have + 1);
  return [silver, evo ? tier * 8 : 0, evo ? tier * 8 : 0];
}
export const weaponCap = (p: DawidProgress): number => WEAPON_CAP[Math.min(3, buildingLevel(p, 'kuznia'))];

export function weaponWhy(p: DawidProgress, id: WeaponId): BuyWhy {
  const lv = weaponLevel(p, id);
  if (lv <= 0) {
    const c = CRAFT[id];
    if (!c) return 'gift';
    if (buildingLevel(p, 'kuznia') <= 0) return 'need';
    if (id === 'oszczep' && reached(p) < 4) return 'land';
    return p.silver >= c[0] && p.wood >= c[1] && p.stone >= c[2] ? 'ok' : 'silver';
  }
  const cost = weaponCost(id, lv);
  if (!cost) return 'max';
  if (buildingLevel(p, 'kuznia') <= 0) return 'need';
  if (lv >= weaponCap(p)) return 'cap';
  return p.silver >= cost[0] && p.wood >= cost[1] && p.stone >= cost[2] ? 'ok' : 'silver';
}

/** Craft a weapon not yet owned, or raise one a level (an evolution every five). */
export function forge(p: DawidProgress, id: WeaponId): boolean {
  if (weaponWhy(p, id) !== 'ok') return false;
  const lv = weaponLevel(p, id);
  const cost = lv <= 0 ? CRAFT[id]! : weaponCost(id, lv)!;
  p.silver -= cost[0];
  p.wood -= cost[1];
  p.stone -= cost[2];
  p.wp[id] = lv + 1;
  return true;
}

// ── the party ────────────────────────────────────────────────────
export const hasJoined = (p: DawidProgress, id: CompanionId): boolean => p.joined.includes(id);
/** 1★ when they join, up to 5★ with friendship (the XP they share) */
export function stars(p: DawidProgress, id: CompanionId): number {
  if (!hasJoined(p, id)) return 0;
  const f = num(p.friend[id]);
  let s = 0;
  for (const at of STAR_AT) if (f >= at) s++;
  return Math.max(1, Math.min(5, s));
}
export const partySlots = (p: DawidProgress): number => slotsAt(reached(p) - 1);

/** Who walks along: the chosen ones who have joined, as many as there are slots. */
export function partyNow(p: DawidProgress): CompanionId[] {
  return (p.party.filter(id => hasJoined(p, id as CompanionId)) as CompanionId[]).slice(0, partySlots(p));
}

/** Free slots are filled with the others, in the order they joined (a new session, a new land). */
export function fillParty(p: DawidProgress): CompanionId[] {
  const out = partyNow(p);
  for (const id of p.joined as CompanionId[]) {
    if (out.length >= partySlots(p)) break;
    if (!out.includes(id)) out.push(id);
  }
  p.party = [...out];
  return out;
}

/** Take a companion along or leave them resting (a full party swaps out the first one). */
export function toggleParty(p: DawidProgress, id: CompanionId): boolean {
  if (!hasJoined(p, id)) return false;
  const now = partyNow(p);
  if (now.includes(id)) p.party = now.filter(x => x !== id);
  else {
    const next = [...now];
    if (next.length >= partySlots(p)) next.shift();
    next.push(id);
    p.party = next;
  }
  return true;
}

export function join(p: DawidProgress, id: CompanionId): boolean {
  if (hasJoined(p, id)) return false;
  p.joined.push(id);
  p.friend[id] = Math.max(0, num(p.friend[id]));
  if (partyNow(p).length < partySlots(p)) p.party = [...partyNow(p), id];
  return true;
}

// ── the bag ──────────────────────────────────────────────────────
/** What the shepherd's bag holds (silver-units; wood and stone weigh RULES.matWeight each). */
export const bagCap = (p: DawidProgress): number =>
  Math.round(RULES.bagBase * RULES.bagGrow ** abilityLevel(p, 'torba') * STORE_K[Math.min(3, buildingLevel(p, 'spichlerz'))]);

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: DawidProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: DawidProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

/** Something the treasury can buy now (for the summary's nudge and the lobby). */
export function anyAffordable(p: DawidProgress): boolean {
  return ABILITIES.some(a => abilityWhy(p, a.id) === 'ok') || BUILDINGS.some(b => buildingWhy(p, b.id) === 'ok')
    || (Object.keys(WEAPONS) as WeaponId[]).some(w => weaponWhy(p, w) === 'ok');
}
