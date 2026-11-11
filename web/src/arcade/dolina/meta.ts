/**
 * What Dolina remembers between runs and the pure rules of its meta game: the level the next run
 * starts at and the stars of every level played (the valley's map), the sparks in hand and all ever
 * (the pilgrim's forms), the upgrades bought with them (Kamieniarz, Kuźnia, Iskry, Knot, Oliwa), the
 * lambs brought home, the guardians beaten, the records per session length, what the player has
 * already been shown (so later sessions explain only new things) and the day's gift — and, from
 * version 3: the mode (the valley or the clock tower) and the tower's floor, the companions found,
 * their bond and the party chosen, the gear in its four slots, the provisions left, the missions on
 * offer.  No DOM; the only randomness is the chest's roll, from the generator it is given.
 *
 * Version 2 (the rebuild after Hell Escape) replaced version 1's eras-and-sword meta; version 3 keeps
 * everything version 2 saved and adds its new fields.  An old save is migrated in place on first use.
 */
import {
  BUFFS, COMPS, GEAR, MISSIONS, MISSION_GOALS, UPGRADES, isComp, type BuffId, type CompId, type GearSlot, type MissionKind, type UpId,
} from './content';
import { RULES } from './rules';

/** A mission on offer: what to do, how much, how much is done, and the rung of its kind's ladder. */
export interface Mission { kind: MissionKind; goal: number; have: number; rung: number }
export interface GearPiece { tier: number; shards: number }
export type Mode = 'valley' | 'tower';

export interface DolinaProgress {
  ver: 3;
  /** runs (sessions) saved */
  sessions: number;
  /** metres of the valley, all time */
  total: number;
  /** sparks in hand, and all ever (the forms) */
  sparks: number;
  sparksAll: number;
  /** upgrade levels */
  ups: Record<UpId, number>;
  /** the level the next run starts at (1-based), and the highest level ever finished */
  level: number;
  top: number;
  /** stars per level ("7": 0..3) */
  stars: Record<string, number>;
  /** lambs brought home, guardians (and keepers) beaten, Świty lit, all time */
  lambs: number;
  guards: number;
  dawns: number;
  /** push blocks begun, all time: every 4th is blind ("Mgła") from the 3rd session */
  pushes: number;
  /** records: metres per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  bestCombo: number;
  /** first-time things already explained (a guardian, the meadow, the tide, the fog…) */
  seen: string[];
  /** the day's gift: the day it was given */
  giftDay: string;
  // ── v3 ──
  /** what the next run plays: the valley's levels or the clock tower's floors */
  mode: Mode;
  /** the tower: the floor the next tower run starts on, the highest floor passed, the nights the clock has gone round */
  tower: { floor: number; best: number; night: number };
  /** companions found (in the order found), their bond (all time), the party picked for the next run */
  found: CompId[];
  bond: Record<string, number>;
  party: CompId[];
  /** gear: each slot's tier (0: none yet) and the shards toward the next */
  gear: Record<GearSlot, GearPiece>;
  /** chests opened, all time */
  chests: number;
  /** provisions: runs left of each */
  buffs: Record<BuffId, number>;
  /** the three missions on offer, how many were drawn and done, each kind's rung */
  missions: Mission[];
  missionSeq: number;
  missionsDone: number;
  rungs: Record<string, number>;
}

const freshUps = (): Record<UpId, number> => Object.fromEntries(UPGRADES.map(id => [id, 0])) as Record<UpId, number>;
const freshGear = (): Record<GearSlot, GearPiece> => Object.fromEntries(GEAR.map(s => [s, { tier: 0, shards: 0 }])) as Record<GearSlot, GearPiece>;
const freshBuffs = (): Record<BuffId, number> => Object.fromEntries(BUFFS.map(b => [b, 0])) as Record<BuffId, number>;

export function freshProgress(): DolinaProgress {
  const p: DolinaProgress = {
    ver: 3, sessions: 0, total: 0, sparks: 0, sparksAll: 0, ups: freshUps(), level: 1, top: 0, stars: {},
    lambs: 0, guards: 0, dawns: 0, pushes: 0, best: {}, lastLen: 0, bestCombo: 0, seen: [], giftDay: '',
    mode: 'valley', tower: { floor: 1, best: 0, night: 0 }, found: [], bond: {}, party: [], gear: freshGear(), chests: 0,
    buffs: freshBuffs(), missions: [], missionSeq: 0, missionsDone: 0, rungs: {},
  };
  fillMissions(p);
  return p;
}

const num = (v: unknown, lo = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, v) : lo);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Only the numeric records of a saved table (an old save may hold anything). */
function records(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x) && x > 0) out[k] = x;
  return out;
}

/**
 * Bring a loaded progress to version 3 in place (idempotent).  A version-1 save (or anything older or
 * broken) keeps its best scores, its last length and its session count; everything else starts over.
 * A version-2 save keeps everything (records, sparks, upgrades, the map and its stars, lambs, guardians,
 * what was explained) and gets the new fields fresh; companions it already walked past are found again
 * one level at a time (their cages stand on the next levels).  Every field's type is checked, so a
 * damaged field never crashes a run.
 */
export function migrate(p: DolinaProgress): DolinaProgress {
  const o = p as unknown as Record<string, unknown>;
  // the runner merges a save over a fresh progress, so a version-1 save arrives with the fresh `ver`
  // and its own `v: 1`; a version-2 save arrives with its own `ver: 2`
  if (o.v !== undefined || (o.ver !== 2 && o.ver !== 3)) {
    const keep = { sessions: Math.round(num(o.sessions)), best: records(o.best), lastLen: num(o.lastLen) };
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, freshProgress(), keep);
    return p;
  }
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'number' && typeof o[k] !== 'number') o[k] = v;
    else if (typeof v === 'string' && typeof o[k] !== 'string') o[k] = v;
  }
  o.ver = 3;
  for (const k of ['sessions', 'total', 'sparks', 'sparksAll', 'top', 'lambs', 'guards', 'dawns', 'pushes', 'lastLen', 'bestCombo', 'chests', 'missionSeq', 'missionsDone'] as const) {
    o[k] = num(o[k]);
  }
  if (!Array.isArray(o.seen)) o.seen = [];
  else o.seen = (o.seen as unknown[]).filter(s => typeof s === 'string');
  o.best = records(o.best);
  o.stars = records(o.stars);
  const ups = isObj(o.ups) ? o.ups : {};
  o.ups = Object.fromEntries(UPGRADES.map(id => [id, Math.round(num(ups[id]))]));
  p.level = Math.max(1, Math.round(p.level));
  // v3 fields
  if (o.mode !== 'valley' && o.mode !== 'tower') o.mode = 'valley';
  const tw = isObj(o.tower) ? o.tower : {};
  o.tower = { floor: Math.max(1, Math.round(num(tw.floor, 1))), best: Math.round(num(tw.best)), night: Math.round(num(tw.night)) };
  const found: CompId[] = [];
  if (Array.isArray(o.found)) for (const c of o.found) if (isComp(c) && !found.includes(c)) found.push(c);
  o.found = found;
  o.bond = records(o.bond);
  const party: CompId[] = [];
  if (Array.isArray(o.party)) for (const c of o.party) if (isComp(c) && found.includes(c) && !party.includes(c) && party.length < 3) party.push(c);
  o.party = party;
  const gear = isObj(o.gear) ? o.gear : {};
  o.gear = Object.fromEntries(GEAR.map(s => {
    const g = isObj(gear[s]) ? gear[s] as Record<string, unknown> : {};
    return [s, { tier: Math.min(RULES.gear.top, Math.round(num(g.tier))), shards: Math.round(num(g.shards)) }];
  }));
  const buffs = isObj(o.buffs) ? o.buffs : {};
  o.buffs = Object.fromEntries(BUFFS.map(b => [b, Math.round(num(buffs[b]))]));
  o.rungs = records(o.rungs);
  const ms: Mission[] = [];
  if (Array.isArray(o.missions)) {
    for (const m of o.missions) {
      if (!isObj(m) || !(MISSIONS as readonly unknown[]).includes(m.kind)) continue;
      const goal = Math.round(num(m.goal, 1));
      if (ms.some(x => x.kind === m.kind) || goal < 1) continue;
      ms.push({ kind: m.kind as MissionKind, goal, have: Math.min(goal, Math.round(num(m.have))), rung: Math.round(num(m.rung)) });
    }
  }
  p.missions = ms.slice(0, 3);
  fillMissions(p);
  return p;
}

// ── the forms ────────────────────────────────────────────────────
/** The form (0-based) for all sparks ever. */
export function lookOf(sparksAll: number): number {
  let r = 0;
  RULES.looks.forEach((at, i) => { if (sparksAll >= at) r = i; });
  return r;
}

/** Sparks at which the next form comes (null: the last). */
export function nextLookAt(sparksAll: number): number | null {
  const r = lookOf(sparksAll);
  return r + 1 < RULES.looks.length ? RULES.looks[r + 1] : null;
}

// ── the upgrades ─────────────────────────────────────────────────
/** An upgrade's level as saved (a missing one: level 0). */
export const upLevel = (p: DolinaProgress, id: UpId): number =>
  Math.min(RULES.upMax[id], Math.max(0, Math.round(p.ups?.[id] ?? 0)));

/** The sparks for an upgrade's next level (null at the top). */
export function upPrice(id: UpId, level: number): number | null {
  if (level >= RULES.upMax[id]) return null;
  return Math.round(RULES.priceBase * RULES.priceGrowth ** level);
}

/** Buy an upgrade's next level if the sparks reach; true when bought. */
export function buyUp(p: DolinaProgress, id: UpId): boolean {
  const lv = upLevel(p, id), price = upPrice(id, lv);
  if (price === null || p.sparks < price) return false;
  p.sparks -= price;
  p.ups = { ...freshUps(), ...p.ups, [id]: lv + 1 };
  return true;
}

/** The cheapest upgrade on offer (for the end of a run). */
export function cheapestUp(p: DolinaProgress): { id: UpId; price: number } | null {
  let best: { id: UpId; price: number } | null = null;
  for (const id of UPGRADES) {
    const price = upPrice(id, upLevel(p, id));
    if (price !== null && (!best || price < best.price)) best = { id, price };
  }
  return best;
}

// ── the map ──────────────────────────────────────────────────────
/** A level's stars as saved (0..3). */
export const starsOf = (p: DolinaProgress, level: number): number => Math.max(0, Math.min(3, Math.round(p.stars?.[String(level)] ?? 0)));

/** All stars collected. */
export const starTotal = (p: DolinaProgress): number => Object.values(p.stars ?? {}).reduce((s, v) => s + Math.max(0, Math.min(3, v)), 0);

/** Keep a level's best stars (never fewer). */
export function setStars(p: DolinaProgress, level: number, n: number): void {
  const k = String(level);
  p.stars = { ...p.stars, [k]: Math.max(starsOf(p, level), Math.max(0, Math.min(3, Math.round(n)))) };
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: DolinaProgress, plannedSec: number): number | null {
  const v = p.best?.[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: DolinaProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best ?? {}).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

// ── v3: the companions ───────────────────────────────────────────
/** Party slots: one, and one more for each of the first two guardians beaten (never bought). */
export const slotsFor = (guards: number): number => Math.min(3, 1 + Math.max(0, Math.floor(guards)));

/** A companion's bond level (1..5) for its bond. */
export function bondLevel(bond: number): number {
  let lv = 1;
  RULES.comp.bond.forEach((at, i) => { if (bond >= at) lv = i + 1; });
  return lv;
}

/** The bond the next level needs (null at the top). */
export function nextBondAt(bond: number): number | null {
  const lv = bondLevel(bond);
  return lv < RULES.comp.bond.length ? RULES.comp.bond[lv] : null;
}

export const compBond = (p: DolinaProgress, id: CompId): number => Math.max(0, p.bond?.[id] ?? 0);
export const compLevel = (p: DolinaProgress, id: CompId): number => bondLevel(compBond(p, id));

/** The party a run takes: the picked companions that were found, up to the slots; free slots filled in the order found. */
export function partyFor(p: DolinaProgress, slots = slotsFor(p.guards)): CompId[] {
  const out = (p.party ?? []).filter(c => p.found.includes(c)).slice(0, slots);
  for (const c of p.found) if (out.length < slots && !out.includes(c)) out.push(c);
  return out;
}

/** The lobby's pick: take a companion into the party (dropping the first picked when full) or leave them at the camp. */
export function toggleParty(p: DolinaProgress, id: CompId): void {
  if (!p.found.includes(id)) return;
  const slots = slotsFor(p.guards);
  const cur = partyFor(p, slots);
  if (cur.includes(id)) p.party = cur.filter(c => c !== id);
  else {
    const next = [...cur, id];
    p.party = next.length > slots ? next.slice(next.length - slots) : next;
  }
}

// ── v3: gear ─────────────────────────────────────────────────────
export const gearTier = (p: DolinaProgress, s: GearSlot): number => Math.max(0, Math.min(RULES.gear.top, Math.round(p.gear?.[s]?.tier ?? 0)));
/** Shards the next tier needs (null at the top). */
export const shardsNeed = (tier: number): number | null => (tier >= RULES.gear.top ? null : RULES.gear.shards * Math.max(1, tier));

/** What a piece of gear did: a better tier put on, shards added, shards that merged into the next tier. */
export interface GearResult { slot: GearSlot; tier: number; before: number; shards: number; merged: boolean }

/**
 * A piece of gear comes (from a chest): a better tier than the slot's is put on at once; an equal or
 * lower one becomes shards (as many as its tier), and enough shards merge into the next tier — a
 * duplicate is never wasted.
 */
export function addGear(p: DolinaProgress, slot: GearSlot, tier: number): GearResult {
  const g: GearPiece = { tier: gearTier(p, slot), shards: Math.max(0, Math.round(p.gear?.[slot]?.shards ?? 0)) };
  const before = g.tier;
  let merged = false;
  if (tier > g.tier) g.tier = Math.min(RULES.gear.top, tier);
  else {
    g.shards += Math.max(1, tier);
    for (let need = shardsNeed(g.tier); need !== null && g.shards >= need; need = shardsNeed(g.tier)) {
      g.shards -= need;
      g.tier++;
      merged = true;
    }
    if (g.tier >= RULES.gear.top) g.shards = 0;
  }
  p.gear = { ...freshGear(), ...p.gear, [slot]: g };
  return { slot, tier: g.tier, before, shards: g.shards, merged };
}

/**
 * The pilgrim's strength in one number (the original's battle power, live in the lobby): gear tiers
 * count most, then upgrades, the companions' levels and the form.
 */
export function strengthOf(p: DolinaProgress): number {
  let s = 0;
  for (const g of GEAR) s += 10 * gearTier(p, g) ** 2;
  for (const u of UPGRADES) s += 6 * upLevel(p, u);
  for (const c of p.found ?? []) s += 15 * compLevel(p, c);
  return s + 20 * lookOf(p.sparksAll);
}

// ── v3: chests ───────────────────────────────────────────────────
export type ChestSource = keyof typeof RULES.chest.tiers;
export type ChestDrop =
  | { kind: 'gear'; slot: GearSlot; tier: number }
  | { kind: 'bond'; comp: CompId; n: number }
  | { kind: 'buff'; buff: BuffId; runs: number };

/** What a chest holds, from the generator it is given (the play's own luck, never bought). */
export function rollChest(p: DolinaProgress, source: ChestSource, rnd: () => number): ChestDrop {
  const R = RULES.chest;
  const r = rnd();
  if (r >= R.gear && r < R.gear + R.bond && p.found.length) {
    return { kind: 'bond', comp: p.found[Math.floor(rnd() * p.found.length) % p.found.length], n: R.bondN };
  }
  if (r >= R.gear + R.bond) return { kind: 'buff', buff: BUFFS[Math.floor(rnd() * BUFFS.length) % BUFFS.length], runs: R.buffRuns };
  const odds: readonly number[] = R.tiers[source];
  const total = odds.reduce((s: number, v: number) => s + v, 0);
  let x = rnd() * total, tier = 1;
  for (let i = 0; i < odds.length; i++) {
    if (x < odds[i]) { tier = i + 1; break; }
    x -= odds[i];
  }
  return { kind: 'gear', slot: GEAR[Math.floor(rnd() * GEAR.length) % GEAR.length], tier };
}

/** Open a chest into the progress: gear on or merged, bond to a companion, provisions for runs. */
export function applyChest(p: DolinaProgress, d: ChestDrop): GearResult | null {
  p.chests = Math.max(0, p.chests) + 1;
  if (d.kind === 'gear') return addGear(p, d.slot, d.tier);
  if (d.kind === 'bond') p.bond = { ...p.bond, [d.comp]: compBond(p, d.comp) + d.n };
  else p.buffs = { ...freshBuffs(), ...p.buffs, [d.buff]: Math.max(0, p.buffs?.[d.buff] ?? 0) + d.runs };
  return null;
}

// ── v3: provisions ───────────────────────────────────────────────
/** The provisions this run eats from (each one run). */
export const activeBuffs = (p: DolinaProgress): BuffId[] => BUFFS.filter(b => (p.buffs?.[b] ?? 0) > 0);

// ── v3: missions ─────────────────────────────────────────────────
/** A small integer hash (deterministic draws without a generator). */
function mixHash(n: number): number {
  let x = (n | 0) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  return (x ^ (x >>> 15)) >>> 0;
}

/** The tower opens with the first guardian beaten. */
export const towerOpen = (p: DolinaProgress): boolean => p.guards >= 1;

/** Kinds a mission may ask now: the tower's only once it is open, the companions' only once one is found. */
function missionKinds(p: DolinaProgress): MissionKind[] {
  return MISSIONS.filter(k => (k !== 'floors' || towerOpen(p)) && (k !== 'powers' || p.found.length > 0));
}

/** The next mission (deterministic from how many were drawn), never one already on offer. */
export function drawMission(p: DolinaProgress): Mission {
  const taken = new Set(p.missions.map(m => m.kind));
  const pool = missionKinds(p).filter(k => !taken.has(k));
  const kinds = pool.length ? pool : missionKinds(p);
  const kind = kinds[mixHash(p.missionSeq + 17) % kinds.length];
  p.missionSeq++;
  const ladder = MISSION_GOALS[kind];
  const rung = Math.min(ladder.length - 1, Math.max(0, Math.round(p.rungs?.[kind] ?? 0)));
  return { kind, goal: ladder[rung], have: 0, rung };
}

/** Keep three missions on offer. */
export function fillMissions(p: DolinaProgress): void {
  if (!Array.isArray(p.missions)) p.missions = [];
  while (p.missions.length < 3) p.missions.push(drawMission(p));
}

/** A mission's reward in sparks. */
export const missionReward = (m: Mission): number => RULES.mission.reward[0] + RULES.mission.reward[1] * m.rung;

/** A mission is done: its kind climbs a rung, a new one takes its place; true when a chest comes with it. */
export function completeMission(p: DolinaProgress, m: Mission): boolean {
  const i = p.missions.indexOf(m);
  p.missionsDone = Math.max(0, p.missionsDone) + 1;
  p.rungs = { ...p.rungs, [m.kind]: Math.max(0, p.rungs?.[m.kind] ?? 0) + 1 };
  const next = drawMission(p);
  if (i >= 0) p.missions[i] = next;
  else p.missions.push(next);
  return p.missionsDone % RULES.mission.chestEvery === 0;
}

// ── v3: the clock tower ──────────────────────────────────────────
/** The clock's time on a floor ("01:12"): the hands move six minutes a floor from midnight; the dawn at 06:00. */
export function clockTime(floor: number): string {
  const per = RULES.tower.dawnFloor;
  const f = ((Math.max(1, Math.round(floor)) - 1) % per);
  const min = f * RULES.tower.minutes;
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** The night of the clock a floor is in (1-based): the tower goes round again, darker. */
export const nightOf = (floor: number): number => Math.floor((Math.max(1, Math.round(floor)) - 1) / RULES.tower.dawnFloor) + 1;

/** All companions, found or not, for the lobby. */
export const ALL_COMPS: readonly CompId[] = COMPS;
