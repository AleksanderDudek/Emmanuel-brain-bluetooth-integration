/**
 * What Nehemiasz remembers between sessions and the pure rules of its meta game:
 *
 *   the campaign   the year, the next day to play (1..52), the gate now being built and its day
 *   the stretch    the current gate's wall (six sections and the gate: tiers, cubits laid, integrity),
 *                  its towers, fires and guard posts — a new gate starts its own stretch
 *   the city       the buildings inside the wall (kept from gate to gate), the stores, the people,
 *                  their strength, the decrees in force
 *   the meta       stars per gate, the star bank and the king's letters bought with it, the chronicle
 *   records        cubits per session length, totals and counters
 *
 * Version 1.  The placeholder module saved `{ sessions: n }`; such a save (or anything without
 * `ver: 1`) keeps its session count and starts the campaign fresh.  A v1 save with fields of a wrong
 * type is repaired rather than trusted.  No DOM, no randomness.
 */
import {
  CITY_START, COSTS, GATES, GATE_SEG, HOUSE_IDS, MAX_LEVEL, PERKS, SEGS, SLOTS, STRETCH_IDS, gateDays, perkCost, tierCubits,
  type Cost, type DecreeId, type Kind, type PerkId,
} from './content';
import { RULES } from './rules';

export interface WallSeg {
  /** the tier ordered (0..3) and the tiers finished; while tier > done, `prog` cubits of the next tier are laid */
  tier: number;
  done: number;
  prog: number;
  /** integrity (hp) of what stands; a breach is hp ≤ 0 */
  hp: number;
}

export type TowerKind = '' | 'far' | 'quick';

export interface NehProgress {
  ver: 1;
  sessions: number;
  /** nights begun, all time: every 4th is moonless from the 3rd session */
  pushes: number;
  // the campaign
  year: number;
  day: number;
  gate: number;
  /** days begun at this gate */
  gateDay: number;
  // the stretch of the current gate
  wall: WallSeg[];
  /** levels of the stretch's towers, fires and posts (ids from content.ts) */
  stretch: Record<string, number>;
  towerKind: Record<string, TowerKind>;
  /** a dawn found a breach in this stretch, or a raider got away with loot (the third star is gone) */
  breached: boolean;
  // the city
  city: Record<string, number>;
  stone: number;
  timber: number;
  bread: number;
  people: number;
  strength: number;
  /** groups of newcomers so far (the next comes from the next town in turn) */
  arrivals: number;
  /** decrees in force and the days they have left; a sabbath ordered for the next day */
  decrees: Record<string, number>;
  sabbath: boolean;
  /** the horn's charge kept for the next night; stones dressed and waiting for the next tier (cubits) */
  hornCarry: number;
  dressed: number;
  // the meta
  stars: number[];
  starBank: number;
  perks: Record<string, number>;
  chronicle: string[];
  /** invitations to Ono turned down, foxes that found the wall standing; the stretch (year × 10 + gate) last invited */
  ono: number;
  foxes: number;
  onoGate: number;
  /** the first horn and the first invitation have had their story cards */
  cards: string[];
  // records
  best: Record<string, number>;
  lastLen: number;
  total: number;
  driven: number;
  horns: number;
  bestDay: number;
  /** first-time explanations already given (coach marks) */
  seen: string[];
}

const seg0 = (): WallSeg => ({ tier: 0, done: 0, prog: 0, hp: 0 });

export function freshProgress(): NehProgress {
  const p: NehProgress = {
    ver: 1, sessions: 0, pushes: 0,
    year: 0, day: 1, gate: 0, gateDay: 0,
    wall: SEGS.map(seg0), stretch: {}, towerKind: {}, breached: false,
    city: { ...CITY_START }, stone: RULES.start.stone, timber: RULES.start.timber, bread: RULES.start.bread,
    people: RULES.start.people, strength: RULES.start.strength, arrivals: 0, decrees: {}, sabbath: false, hornCarry: 0, dressed: 0,
    stars: GATES.map(() => 0), starBank: 0, perks: {}, chronicle: [], ono: 0, foxes: 0, onoGate: -1, cards: [],
    best: {}, lastLen: 0, total: 0, driven: 0, horns: 0, bestDay: 0, seen: [],
  };
  freshStretch(p);
  return p;
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const clampInt = (v: unknown, lo: number, hi: number, d: number): number => Math.max(lo, Math.min(hi, Math.floor(num(v, d))));

/**
 * Bring a loaded save to version 1, in place (idempotent).  Anything older (the placeholder's
 * `{ sessions: n }`) keeps its session count and night count; the campaign starts fresh.  A v1 save
 * gets its types repaired and its numbers clamped.
 */
export function migrate(p: NehProgress): NehProgress {
  const raw = p as unknown as Record<string, unknown>;
  if (raw.ver !== 1) {
    const keep = { sessions: Math.max(0, Math.floor(num(raw.sessions))), pushes: Math.max(0, Math.floor(num(raw.pushes))) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), keep);
    return p;
  }
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'number' && (typeof raw[k] !== 'number' || !Number.isFinite(raw[k] as number))) raw[k] = v;
    if (typeof v === 'boolean' && typeof raw[k] !== 'boolean') raw[k] = v;
    if (Array.isArray(v) && !Array.isArray(raw[k])) raw[k] = JSON.parse(JSON.stringify(v));
    if (isObj(v) && !isObj(raw[k])) raw[k] = JSON.parse(JSON.stringify(v));
  }
  p.year = clampInt(p.year, 0, 99, 0);
  p.gate = clampInt(p.gate, 0, GATES.length - 1, 0);
  p.day = clampInt(p.day, 1, 52, 1);
  p.gateDay = clampInt(p.gateDay, 0, gateDays(p.gate), 0);
  p.people = clampInt(p.people, 1, 999, RULES.start.people);
  p.strength = Math.max(RULES.strengthMin, Math.min(1, num(p.strength, RULES.start.strength)));
  for (const k of ['stone', 'timber', 'bread'] as const) p[k] = Math.max(0, num(p[k]));
  // the wall: seven segments of sane numbers
  const wall: WallSeg[] = SEGS.map((_, i) => {
    const w = Array.isArray(p.wall) && isObj(p.wall[i]) ? p.wall[i] as unknown as Record<string, unknown> : {};
    const tier = clampInt(w.tier, 0, MAX_LEVEL, 0);
    const done = clampInt(w.done, 0, tier, 0);
    const prog = tier > done ? Math.max(0, Math.min(tierCubits(i, done + 1) - 1e-6, num(w.prog))) : 0;
    const s: WallSeg = { tier, done, prog, hp: 0 };
    s.hp = Math.max(0, Math.min(maxHp(i, s), num(w.hp, maxHp(i, s))));
    return s;
  });
  p.wall = wall;
  const levels = (o: Record<string, unknown>, ids: readonly string[], start: Readonly<Record<string, number>> = {}): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = clampInt(o[id], 0, MAX_LEVEL, start[id] ?? 0);
    return out;
  };
  p.stretch = levels(p.stretch, STRETCH_IDS);
  p.city = levels(p.city, Object.keys(CITY_START), CITY_START);
  for (const id of Object.keys(p.towerKind)) if (p.towerKind[id] !== 'far' && p.towerKind[id] !== 'quick') delete p.towerKind[id];
  const stars: number[] = GATES.map((_, i) => clampInt(Array.isArray(p.stars) ? p.stars[i] : 0, 0, 3, 0));
  p.stars = stars;
  p.starBank = Math.max(0, Math.floor(num(p.starBank)));
  const perks: Record<string, number> = {};
  for (const id of PERKS) perks[id] = clampInt(p.perks[id], 0, PERK_MAX[id], 0);
  p.perks = perks;
  const decrees: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.decrees)) if (num(v) > 0) decrees[k] = Math.floor(num(v));
  p.decrees = decrees;
  const best: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.best)) if (num(v) > 0) best[k] = num(v);
  p.best = best;
  p.chronicle = p.chronicle.filter((a): a is string => typeof a === 'string');
  p.seen = p.seen.filter((a): a is string => typeof a === 'string');
  p.cards = p.cards.filter((a): a is string => typeof a === 'string');
  p.hornCarry = Math.max(0, Math.min(1, num(p.hornCarry)));
  p.dressed = Math.max(0, Math.min(RULES.dressedCap, num(p.dressed)));
  return p;
}

const PERK_MAX: Readonly<Record<PerkId, number>> = { drewno: 3, kielnie: 3, trebacz: 3, piece: 2, straz: 2, eskorta: 2 };
export const perkMax = (id: PerkId): number => PERK_MAX[id];

// ── the wall ─────────────────────────────────────────────────────
/** A segment's standing height in tiers (0..3): the finished tiers and the share of the next one laid. */
export const heightOf = (i: number, s: WallSeg): number => s.done + (s.tier > s.done ? s.prog / tierCubits(i, s.done + 1) : 0);
/** Its integrity when whole. */
export const maxHp = (i: number, s: WallSeg): number => heightOf(i, s) * (SEGS[i].gate ? RULES.gateHpTier : RULES.hpTier);
/** Open: too low to stop anyone, or breached. */
export const isOpen = (i: number, s: WallSeg): boolean => heightOf(i, s) < RULES.openBelow || s.hp <= 0;
/** The share of the stretch's integrity that stands (1 when nothing stands yet: nothing is broken). */
export function standing(p: NehProgress): number {
  let have = 0, all = 0;
  p.wall.forEach((s, i) => { have += Math.max(0, s.hp); all += maxHp(i, s); });
  return all > 0 ? have / all : 1;
}

/**
 * A new stretch for the current gate: the sections in rubble, the two beside the gate ordered to half
 * height (the builders start at once), the gate's own fire lit, its gatekeepers' post, and the king's
 * escort's towers.
 */
export function freshStretch(p: NehProgress): void {
  p.wall = SEGS.map(seg0);
  for (const i of [GATE_SEG - 1, GATE_SEG + 1]) p.wall[i].tier = 1;
  p.stretch = Object.fromEntries(STRETCH_IDS.map(id => [id, 0]));
  p.stretch.f2 = 1;
  // the gatekeepers (Neh 7:1): every stretch begins with a post by the gate
  p.stretch.p1 = 1;
  const esc = perkLevel(p, 'eskorta');
  if (esc >= 1) { p.stretch.t0 = 1; p.stretch.t3 = 1; }
  if (esc >= 2) { p.stretch.f1 = 1; p.stretch.f3 = 1; }
  p.towerKind = {};
  p.breached = false;
}

// ── the city and its people ─────────────────────────────────────
/** The highest level a building may reach now: the governor's house caps the rest (one above it). */
export function levelCap(p: NehProgress, kind: Kind): number {
  if (kind === 'governor') return MAX_LEVEL;
  return Math.min(MAX_LEVEL, (p.city.gov ?? 1) + 1);
}

/** Room for people: the camp's tents and the houses. */
export function room(p: NehProgress): number {
  let r = RULES.tents;
  for (const id of HOUSE_IDS) r += (p.city[id] ?? 0) * RULES.housePer;
  return r;
}

export const stoneCap = (p: NehProgress): number => RULES.stoneCap[Math.min(3, p.city.yard ?? 1)];
export const breadCap = (p: NehProgress): number => RULES.breadCap[Math.min(3, p.city.granary ?? 0)];

export interface Jobs { quarry: number; bakers: number; water: number; guards: number; builders: number }

/**
 * Who does what: the job slots of the buildings fill in turn (stone, bread, water, then the guards of
 * the stretch's posts and towers), never past the share that must stay on the wall; everyone else
 * builds (Neh 4:6).
 */
export function jobs(p: NehProgress, guardSlots: number): Jobs {
  const n = Math.max(0, Math.floor(p.people));
  let free = Math.max(0, n - Math.ceil(n * RULES.minBuilders));
  const take = (want: number): number => {
    const k = Math.max(0, Math.min(free, want));
    free -= k;
    return k;
  };
  const quarry = take(SLOTS.yard[Math.min(3, p.city.yard ?? 0)]);
  const bakers = take(SLOTS.bakery[Math.min(3, p.city.bakery ?? 0)]);
  const water = take(SLOTS.well[Math.min(3, p.city.well ?? 0)]);
  const guards = take(guardSlots);
  return { quarry, bakers, water, guards, builders: n - quarry - bakers - water - guards };
}

// ── costs ────────────────────────────────────────────────────────
export const costOf = (kind: Kind, level: number): Cost | null => (level >= 1 && level <= MAX_LEVEL ? COSTS[kind][level] : null);
export const canPay = (p: NehProgress, c: Cost): boolean => p.stone >= c.stone - 1e-9 && p.timber >= c.timber - 1e-9;

// ── the king's letters ───────────────────────────────────────────
export const perkLevel = (p: NehProgress, id: PerkId): number => Math.max(0, Math.floor(num(p.perks?.[id])));

/** Buy the next level of a letter with the star bank; false when it is full or too dear. */
export function buyPerk(p: NehProgress, id: PerkId): boolean {
  const lv = perkLevel(p, id);
  const cost = perkCost(id, lv);
  if (cost === null || p.starBank < cost) return false;
  p.starBank -= cost;
  p.perks[id] = lv + 1;
  return true;
}

/** The cheapest letter the bank can pay now (null: none). */
export function affordablePerk(p: NehProgress): PerkId | null {
  let best: PerkId | null = null, bestCost = Infinity;
  for (const id of PERKS) {
    const c = perkCost(id, perkLevel(p, id));
    if (c !== null && c <= p.starBank && c < bestCost) { bestCost = c; best = id; }
  }
  return best;
}

// ── decrees ──────────────────────────────────────────────────────
export const decreeOn = (p: NehProgress, id: DecreeId): boolean => (p.decrees[id] ?? 0) > 0;

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: NehProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: NehProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

/** Stars a stretch earns at its gate's last dawn: the gate and half a wall everywhere; a full wall everywhere; no breach at any dawn. */
export function starsOf(p: NehProgress): number {
  const walls = p.wall.filter((_, i) => i !== GATE_SEG);
  const one = p.wall[GATE_SEG].done >= 1 && walls.every(s => s.done >= 1);
  if (!one) return 0;
  const two = walls.every(s => s.done >= 2);
  return 1 + (two ? 1 : 0) + (!p.breached ? 1 : 0);
}
