/**
 * What Jerzy i smok remembers between sessions and the pure rules of its meta game:
 *
 *   the map      the dragon's lands, the dragon now holding a town and the scales already knocked off
 *                it (a dragon not driven off keeps its wounds for the next run and the next session)
 *   the forge    permanent upgrades bought with scales (the bank) in the lobby
 *   the armoury  the knight's gear, earned by milestones and worn for good
 *   records      the session's scales per session length, the best run (scales and time), counters
 *
 * Version 2 (the survivors-like rebuild).  An older save (v: 1) is migrated in place on first use:
 * the best scores and the session count stay, the rest starts over.  No DOM, no randomness.
 */
import { ARMOUR, DRAGONS, FORGE, forgeCost, type ArmourId, type DragonSpec, type ForgeId } from './content';
import { RULES } from './rules';

export interface JerzyProgress {
  ver: 2;
  /** sessions saved */
  sessions: number;
  /** scales gathered, all time, and the bank the forge spends */
  total: number;
  bank: number;
  /** Tarcza blocks begun, all time: every 4th is blind ("Dym") from the 3rd session */
  pushes: number;
  /** the dragon now on the map (0, 1, 2… through the four lands, circle after circle) and its scales already knocked off */
  dragon: number;
  damage: number;
  /** dragons driven off, all time */
  driven: number;
  /** records: scales per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the best run: its scales and its length (s); runs played */
  bestRun: number;
  bestTime: number;
  runs: number;
  /** Miecze światła released, fires quenched, the highest level of a run, evolutions made */
  swords: number;
  quenched: number;
  bestLevel: number;
  evolutions: number;
  /** the forge's levels */
  forge: Record<string, number>;
  /** the armoury's pieces earned */
  armour: string[];
  /** first-time explanations already given (coach marks) */
  seen: string[];
}

export function freshProgress(): JerzyProgress {
  return {
    ver: 2, sessions: 0, total: 0, bank: 0, pushes: 0, dragon: 0, damage: 0, driven: 0, best: {}, lastLen: 0,
    bestRun: 0, bestTime: 0, runs: 0, swords: 0, quenched: 0, bestLevel: 0, evolutions: 0, forge: {}, armour: [], seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Bring a loaded save to version 2, in place (idempotent).  An old save (the round-3 boss fight, v: 1)
 * keeps its records per length and its session count; the map, the counters and the rest start over.
 * Fields of a wrong type are reset rather than trusted.
 */
export function migrate(p: JerzyProgress): JerzyProgress {
  const raw = p as unknown as Record<string, unknown>;
  const old = raw.v !== undefined || raw.ver !== 2;
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = num(v);
  if (old) {
    const keep = { sessions: Math.max(0, Math.floor(num(raw.sessions))), best, lastLen: num(raw.lastLen), pushes: Math.max(0, Math.floor(num(raw.pushes))) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), keep);
    return p;
  }
  // a v2 save: only repair types
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'number' && typeof raw[k] !== 'number') raw[k] = v;
    if (Array.isArray(v) && !Array.isArray(raw[k])) raw[k] = [];
    if (isObj(v) && !isObj(raw[k])) raw[k] = {};
  }
  p.best = best;
  p.armour = p.armour.filter((a): a is string => typeof a === 'string');
  p.seen = p.seen.filter((a): a is string => typeof a === 'string');
  return p;
}

// ── the map ──────────────────────────────────────────────────────
/** The dragon at a place of the endless map: its land (in turn) and the circle it comes back on. */
export function dragonAt(i: number): { spec: DragonSpec; circle: number } {
  const n = Math.max(0, Math.floor(i));
  return { spec: DRAGONS[n % DRAGONS.length], circle: Math.floor(n / DRAGONS.length) };
}

/** All the scales of a dragon on a circle (each circle stronger). */
export const hpOf = (spec: DragonSpec, circle: number): number => Math.round(spec.hp * (1 + RULES.circleUp * Math.max(0, circle)));

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
