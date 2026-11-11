/**
 * What Jerzy i smok remembers between sessions and the pure rules of its meta game:
 *
 *   the adventure  six lands, each fought on four roads (the squire's, the knight's, the hero's, the
 *                  legend's and beyond): the roads cleared per land, the fight now (a land and its road)
 *                  and the scales already knocked off each dragon a knight has fought (a dragon not
 *                  driven off keeps its wounds for the next run, the next session, or the day the
 *                  player comes back to it).  The next fight is the frontier unless the player picks a
 *                  freed land's next road in the lobby.
 *   the companions unlocked by play (Burek, Iskierka, Kolczak, Bartek), and those chosen to come along
 *   the treasury   the treasures of the dragons' hoard found so far (a collection)
 *   the chronicle  the dragons whose fatal flaw the knight has found, the duets he has formed
 *   the forge      permanent upgrades bought with scales (the bank) in the lobby
 *   the armoury    the knight's gear, earned by milestones and worn for good
 *   records        the session's scales per session length, the best run (scales and time), counters
 *
 * Version 3 (2026-11-11).  Older saves are migrated in place on first use: a v2 save keeps its records,
 * bank, forge, armoury, counters and coach marks, and its place on the old four-land map becomes the
 * roads cleared on the six-land map (with the wounds of the dragon it was fighting); a v1 save keeps
 * its records and session count.  No DOM, no randomness.
 */
import {
  ARMOUR, COMPANIONS, DRAGONS, FORGE, TREASURES, forgeCost,
  type ArmourId, type CompanionId, type DragonSpec, type ForgeId, type TreasureId,
} from './content';
import { RULES } from './rules';

export interface JerzyProgress {
  ver: 3;
  /** sessions saved */
  sessions: number;
  /** scales gathered, all time, and the bank the forge spends */
  total: number;
  bank: number;
  /** Tarcza blocks begun, all time: every 4th is blind ("Dym") from the 3rd session */
  pushes: number;
  /** roads cleared per land (index of DRAGONS): 0 none, 1 the squire's, 2 the knight's too… */
  cleared: number[];
  /** the fight now: a land and its road */
  land: number;
  tier: number;
  /** the scales knocked off a dragon not yet driven off, per "land:road" */
  wounds: Record<string, number>;
  /** dragons driven off, all time */
  driven: number;
  /** records: scales per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the best run: its scales and its length (s); runs played */
  bestRun: number;
  bestTime: number;
  runs: number;
  /** Miecze światła released, fires quenched, the highest level of a run, evolutions made, chests opened */
  swords: number;
  quenched: number;
  bestLevel: number;
  evolutions: number;
  chests: number;
  /** the forge's levels */
  forge: Record<string, number>;
  /** the armoury's pieces earned */
  armour: string[];
  /** the companions unlocked, and those chosen to come along */
  companions: string[];
  party: string[];
  /** the treasures found (the collection), the dragons whose fatal flaw is known, the duets formed */
  treasures: string[];
  flaws: string[];
  duets: string[];
  /** first-time explanations already given (coach marks) */
  seen: string[];
}

export function freshProgress(): JerzyProgress {
  return {
    ver: 3, sessions: 0, total: 0, bank: 0, pushes: 0,
    cleared: DRAGONS.map(() => 0), land: 0, tier: 0, wounds: {}, driven: 0,
    best: {}, lastLen: 0, bestRun: 0, bestTime: 0, runs: 0, swords: 0, quenched: 0, bestLevel: 0, evolutions: 0, chests: 0,
    forge: {}, armour: [], companions: [], party: [], treasures: [], flaws: [], duets: [], seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown): number => Math.max(0, Math.floor(num(v)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((a): a is string => typeof a === 'string') : []);
const OLD_LANDS = 4;

/**
 * Bring a loaded save to version 3, in place (idempotent).  Fields of a wrong type are reset rather
 * than trusted.
 *   v1 (the round-3 boss fight, `v: 1`): the records per length and the session count stay.
 *   v2 (the survivors-like, `ver: 2`): everything that still means something stays — the bank, the
 *   forge, the armoury, the records, the counters, the coach marks; the old map index (four lands,
 *   circle after circle) becomes roads cleared on the six-land map; the dragon it was fighting keeps
 *   its wounds.  A knight who had already gone round once meets the two new lands first.
 */
export function migrate(p: JerzyProgress): JerzyProgress {
  const raw = p as unknown as Record<string, unknown>;
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = num(v);
  if (raw.v !== undefined || (raw.ver !== 2 && raw.ver !== 3)) {
    const keep = { sessions: int(raw.sessions), best, lastLen: num(raw.lastLen), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), keep);
    return p;
  }
  if (raw.ver === 2) {
    const n = int(raw.dragon), circle = Math.floor(n / OLD_LANDS), at = n % OLD_LANDS;
    const damage = num(raw.damage);
    const cleared = DRAGONS.map((_, j) => (j < OLD_LANDS ? circle + (j < at ? 1 : 0) : 0));
    delete raw.dragon;
    delete raw.damage;
    raw.cleared = cleared;
    raw.wounds = {};
    if (damage > 0) (raw.wounds as Record<string, number>)[woundKey(at, circle)] = Math.floor(damage);
    raw.land = at;
    raw.tier = circle;
    raw.ver = 3;
    repair(p, best);
    // a knight who has gone round the old lands at least once meets the new ones first
    if (circle >= 1) {
      const f = frontier(p);
      p.land = f.land;
      p.tier = f.tier;
    }
    earnCompanions(p);
    return p;
  }
  repair(p, best);
  return p;
}

/** Repair the types of a v3 save (and fill what a v2 save lacks). */
function repair(p: JerzyProgress, best: Record<string, number>): void {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'number' && typeof raw[k] !== 'number') raw[k] = v;
    if (Array.isArray(v) && !Array.isArray(raw[k])) raw[k] = Array.isArray(v) ? [...v] : [];
    if (isObj(v) && !isObj(raw[k])) raw[k] = {};
  }
  p.ver = 3;
  p.best = best;
  for (const k of ['sessions', 'total', 'bank', 'pushes', 'driven', 'runs', 'swords', 'quenched', 'bestLevel', 'evolutions', 'chests', 'bestRun', 'bestTime'] as const) p[k] = int(p[k]);
  p.cleared = DRAGONS.map((_, i) => int(p.cleared[i]));
  p.land = Math.min(DRAGONS.length - 1, int(p.land));
  p.tier = int(p.tier);
  const wounds: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.wounds)) if (/^\d+:\d+$/.test(k) && num(v) > 0) wounds[k] = Math.floor(num(v));
  p.wounds = wounds;
  const forge: Record<string, number> = {};
  for (const fs of FORGE) if (int(p.forge[fs.id]) > 0) forge[fs.id] = Math.min(fs.max, int(p.forge[fs.id]));
  p.forge = forge;
  p.armour = strings(p.armour).filter(a => (ARMOUR as readonly string[]).includes(a));
  p.companions = strings(p.companions).filter(a => (COMPANIONS as readonly string[]).includes(a));
  p.party = strings(p.party).filter(a => p.companions.includes(a)).slice(0, slots(p));
  p.treasures = strings(p.treasures).filter(a => (TREASURES as readonly string[]).includes(a));
  p.flaws = strings(p.flaws);
  p.duets = strings(p.duets);
  p.seen = strings(p.seen);
  // the fight now must be one the map allows
  if (!canFight(p, p.land, p.tier)) {
    const fr = frontier(p);
    p.land = fr.land;
    p.tier = fr.tier;
  }
}

// ── the adventure: six lands, four roads ─────────────────────────
export const woundKey = (land: number, tier: number): string => `${land}:${tier}`;

/** The land's next road may be fought: its own previous road is cleared, and on the squire's road the land before it too. */
export function canFight(p: JerzyProgress, land: number, tier: number): boolean {
  if (land < 0 || land >= DRAGONS.length || tier < 0) return false;
  if (tier !== (p.cleared[land] ?? 0)) return false;
  return tier > 0 || land === 0 || (p.cleared[land - 1] ?? 0) >= 1;
}

/** The frontier: the lowest road with a land still to clear on it, the first such land in the kingdom's order. */
export function frontier(p: JerzyProgress): { land: number; tier: number } {
  for (let tier = 0; tier < 999; tier++) {
    for (let land = 0; land < DRAGONS.length; land++) if (canFight(p, land, tier)) return { land, tier };
  }
  return { land: 0, tier: p.cleared[0] ?? 0 };
}

/** Every fight the lobby may offer: each land's next road, where the map allows it (the frontier first). */
export function fights(p: JerzyProgress): { land: number; tier: number; frontier: boolean }[] {
  const fr = frontier(p);
  const out = [{ ...fr, frontier: true }];
  for (let land = 0; land < DRAGONS.length; land++) {
    const tier = p.cleared[land] ?? 0;
    if ((land !== fr.land || tier !== fr.tier) && canFight(p, land, tier)) out.push({ land, tier, frontier: false });
  }
  return out;
}

/** The player picks the next fight in the lobby (false: the map does not allow it). */
export function pickFight(p: JerzyProgress, land: number): boolean {
  const tier = p.cleared[land] ?? 0;
  if (!canFight(p, land, tier)) return false;
  p.land = land;
  p.tier = tier;
  return true;
}

/** The fight now: its dragon and its road. */
export function fightOf(p: JerzyProgress): { spec: DragonSpec; tier: number; land: number } {
  const land = Math.max(0, Math.min(DRAGONS.length - 1, Math.floor(p.land)));
  return { spec: DRAGONS[land], tier: Math.max(0, Math.floor(p.tier)), land };
}

/** A road's multipliers (past the legend's road it keeps growing). */
export function road(tier: number): { hp: number; brood: number; tele: number; combo: number; bank: number } {
  const R = RULES.roads, last = R[R.length - 1];
  if (tier < R.length) return R[Math.max(0, tier)];
  const k = tier - (R.length - 1);
  return { hp: last.hp + RULES.circleUp * k, brood: last.brood + 0.25 * k, tele: last.tele, combo: last.combo, bank: last.bank };
}

/** All the scales of a dragon on a road. */
export const hpOf = (spec: DragonSpec, tier: number): number => Math.round(spec.hp * road(tier).hp);

/** The scales already knocked off the dragon of a fight. */
export const woundsOf = (p: JerzyProgress, land: number, tier: number): number => Math.max(0, num(p.wounds[woundKey(land, tier)]));

/** Crowns on the map: the roads cleared over all lands. */
export const crowns = (p: JerzyProgress): number => p.cleared.reduce((s, c) => s + c, 0);

/**
 * A dragon driven off: its road is cleared, its wounds forgotten, and the next fight is the frontier.
 * Returns whether this was the first time this land's road was cleared (it always is: a cleared road
 * cannot be fought again — the land's next road can).
 */
export function clearFight(p: JerzyProgress, land: number, tier: number): void {
  p.cleared[land] = Math.max(p.cleared[land] ?? 0, tier + 1);
  delete p.wounds[woundKey(land, tier)];
  const f = frontier(p);
  p.land = f.land;
  p.tier = f.tier;
}

// ── the companions ───────────────────────────────────────────────
/** How many come along: one, two once three dragons have been driven off. */
export const slots = (p: JerzyProgress): number => (p.driven >= 3 ? 2 : 1);

/** Whether a companion's milestone is reached. */
export function companionEarned(id: CompanionId, p: JerzyProgress): boolean {
  switch (id) {
    case 'pies': return p.sessions >= 1;
    case 'iskierka': return (p.cleared[0] ?? 0) >= 1;
    case 'jez': return p.chests >= 8;
    case 'bobr': return (p.cleared[1] ?? 0) >= 1;
  }
}

/** Unlock the companions whose milestones are reached (a new one comes along when a slot is free); returns the new ones. */
export function earnCompanions(p: JerzyProgress): CompanionId[] {
  const out: CompanionId[] = [];
  for (const id of COMPANIONS) {
    if (p.companions.includes(id) || !companionEarned(id, p)) continue;
    p.companions.push(id);
    out.push(id);
    if (p.party.length < slots(p)) p.party.push(id);
  }
  return out;
}

/** Take a companion along or leave it home (false: locked, or no free slot). */
export function toggleParty(p: JerzyProgress, id: CompanionId): boolean {
  if (!p.companions.includes(id)) return false;
  const i = p.party.indexOf(id);
  if (i >= 0) {
    p.party.splice(i, 1);
    return true;
  }
  if (p.party.length >= slots(p)) return false;
  p.party.push(id);
  return true;
}

// ── the treasury ─────────────────────────────────────────────────
/** Record a treasure found; true the first time ever. */
export function findTreasure(p: JerzyProgress, id: TreasureId): boolean {
  if (p.treasures.includes(id)) return false;
  p.treasures.push(id);
  return true;
}

// ── the forge ────────────────────────────────────────────────────
export const forgeLevel = (p: JerzyProgress, id: ForgeId): number => Math.max(0, Math.floor(num(p.forge[id])));

/** Buy the next level of a forge upgrade with the bank's scales; false when it is at its top or too dear. */
export function buyForge(p: JerzyProgress, id: ForgeId): boolean {
  const cost = forgeCost(id, forgeLevel(p, id));
  if (cost === null || p.bank < cost) return false;
  p.bank -= cost;
  p.forge[id] = forgeLevel(p, id) + 1;
  return true;
}

/** The cheapest forge upgrade the bank can pay now (null: none). */
export function affordable(p: JerzyProgress): ForgeId | null {
  let bestId: ForgeId | null = null, bestCost = Infinity;
  for (const f of FORGE) {
    const c = forgeCost(f.id, forgeLevel(p, f.id));
    if (c !== null && c <= p.bank && c < bestCost) { bestCost = c; bestId = f.id; }
  }
  return bestId;
}

// ── the armoury ──────────────────────────────────────────────────
export const hasArmour = (p: JerzyProgress, id: ArmourId): boolean => p.armour.includes(id);

/** Whether a piece's milestone is reached: its condition on the progress (after this session's counters). */
export function armourEarned(id: ArmourId, p: JerzyProgress): boolean {
  switch (id) {
    case 'proporzec': return p.driven >= 1;
    case 'helm': return p.runs >= 6;
    case 'ostrogi': return p.bestLevel >= 15;
    case 'pas': return p.total >= 2500;
    case 'kosz': return p.swords >= 10;
    case 'slonce': return p.quenched >= 300;
    case 'wieniec': return p.cleared.some(c => c >= 2);
    case 'karwasz': return p.treasures.length >= 6;
  }
}

/** Give the pieces whose milestones are reached; returns the new ones. */
export function earnArmour(p: JerzyProgress): ArmourId[] {
  const out: ArmourId[] = [];
  for (const id of ARMOUR) if (!hasArmour(p, id) && armourEarned(id, p)) { p.armour.push(id); out.push(id); }
  return out;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: JerzyProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: JerzyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
