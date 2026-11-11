/**
 * What Kocia straż remembers between sessions and the pure rules of its meta game.  Like its original
 * (an idle game), the watch goes on from session to session:
 *
 *   the year        the stage the watch has reached, the fish in the bowl, the three upgrades bought
 *                   with fish, how many toys the shop has sold (its price climbs) — all reset by a vintage
 *   the toys        what each cushion on the wall holds, and the chest (kept through a vintage)
 *   the cats        the cats collected, the ones on the wall in order (the rest wait in the kitchen)
 *   the vintage     golden fish and the perks they bought (kept forever), how many vintages
 *   the notebook    pests and chiefs chased off, the highest grade of each toy family
 *   records         the session's pests per session length, the furthest stage, counters
 *
 * Version 1 from the start.  A placeholder save (`{ sessions: n }`, from before the game was built)
 * keeps its session count; any field of a wrong type is reset rather than trusted.  No DOM, no
 * randomness (the merges' luck comes from the session's rng).
 */
import { CATS, FAM_IDS, PERKS, perkCost, toyDps, type BossId, type CatId, type FamId, type PerkId, type Toy } from './content';
import { RULES } from './rules';

export type UpId = 'aim' | 'paws' | 'bowl';
export type BuyId = UpId | 'toy';

export interface KotyProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind (dusk) from the 3rd session */
  pushes: number;

  // the year in progress
  stage: number;
  fish: number;
  up: Record<UpId, number>;
  bought: number;
  /** the cushions' toys (slotsMax entries; only the open ones fire) and the chest's cells */
  slots: (Toy | null)[];
  chest: (Toy | null)[];
  /** the furthest stage this year (the vintage pays for it) */
  yearBest: number;
  /** the share of courage the current stage's chief still has (he keeps his wounds between sessions) */
  chief: number;

  // forever
  cats: CatId[];
  squad: CatId[];
  /** kitchen cats away on a trip to the neighbouring farms: they come back at the next session with gifts */
  trips: CatId[];
  gold: number;
  goldTotal: number;
  perks: Record<string, number>;
  years: number;
  bestStage: number;
  bosses: Record<string, number>;
  /** the best stars each place's chief was chased off with (1: chased, 2: at his first visit, 3: and quickly) */
  stars: Record<string, number>;
  notebook: Record<string, number>;
  toyBook: Record<string, number>;
  bestGrade: number;
  hunts: number;
  merges: number;
  total: number;
  best: Record<string, number>;
  lastLen: number;
  /** when the last session ended (ms since the epoch), for the gift of the watch kept while away */
  lastSeen: number;
  /** first-time explanations already given (coach marks) and first-time story cards */
  seen: string[];
}

const toy = (fam: FamId, g = 1): Toy => ({ fam, g });

export function freshProgress(): KotyProgress {
  const slots: (Toy | null)[] = Array.from({ length: RULES.slotsMax }, () => null);
  slots[0] = toy('proca');
  slots[1] = toy('dmuchawka');
  const chest: (Toy | null)[] = Array.from({ length: RULES.chest }, () => null);
  // two old toys in the chest teach the merge
  chest[0] = toy('konewka');
  chest[1] = toy('proca');
  return {
    ver: 1, sessions: 0, pushes: 0,
    stage: 1, fish: 0, up: { aim: 0, paws: 0, bowl: 0 }, bought: 0, slots, chest, yearBest: 1, chief: 1,
    cats: ['mruczek', 'rudy'], squad: ['mruczek', 'rudy'], trips: [], gold: 0, goldTotal: 0, perks: {}, years: 0, bestStage: 1,
    bosses: {}, stars: {}, notebook: {}, toyBook: { proca: 1, dmuchawka: 1, konewka: 1 }, bestGrade: 1, hunts: 0, merges: 0, total: 0,
    best: {}, lastLen: 0, lastSeen: 0, seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const CAT_SET = new Set<string>(CATS.map(c => c.id));
const FAM_SET = new Set<string>(FAM_IDS);

/** A saved toy, if it is one (a family we know, a grade in range). */
function readToy(v: unknown): Toy | null {
  if (!isObj(v) || typeof v.fam !== 'string' || !FAM_SET.has(v.fam)) return null;
  const g = int(v.g, 1, 1);
  return { fam: v.fam as FamId, g: Math.min(RULES.grades, g) };
}

function counts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (num(x) > 0) out[k] = Math.floor(num(x));
  return out;
}

/**
 * Bring a loaded save to version 1, in place (idempotent).  The placeholder's save keeps its session
 * count and starts the watch fresh; a version-1 save keeps everything, with its types repaired.
 */
export function migrate(p: KotyProgress): KotyProgress {
  const raw = p as unknown as Record<string, unknown>;
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), keep);
    return p;
  }
  const f = freshProgress();
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.stage = int(raw.stage, 1, 1);
  p.fish = Math.max(0, num(raw.fish));
  const up = isObj(raw.up) ? raw.up : {};
  p.up = { aim: int(up.aim), paws: Math.min(RULES.paws.max, int(up.paws)), bowl: int(up.bowl) };
  p.bought = int(raw.bought);
  const slots = Array.isArray(raw.slots) ? raw.slots : [];
  p.slots = Array.from({ length: RULES.slotsMax }, (_, i) => readToy(slots[i]));
  const chest = Array.isArray(raw.chest) ? raw.chest : [];
  p.chest = Array.from({ length: RULES.chest }, (_, i) => readToy(chest[i]));
  p.yearBest = Math.max(p.stage, int(raw.yearBest, 1, 1));
  p.chief = Math.min(1, Math.max(0.05, num(raw.chief, 1)));
  const cats = Array.isArray(raw.cats) ? raw.cats.filter((c): c is CatId => typeof c === 'string' && CAT_SET.has(c)) : [];
  p.cats = [...new Set<CatId>([...f.cats, ...cats])];
  const squad = Array.isArray(raw.squad) ? raw.squad.filter((c): c is CatId => typeof c === 'string' && p.cats.includes(c as CatId)) : [];
  p.squad = [...new Set(squad)].slice(0, RULES.slotsMax);
  if (!p.squad.length) p.squad = p.cats.slice(0, RULES.slotsMax);
  const trips = Array.isArray(raw.trips) ? raw.trips.filter((c): c is CatId => typeof c === 'string' && p.cats.includes(c as CatId) && !p.squad.includes(c as CatId)) : [];
  p.trips = [...new Set(trips)];
  p.gold = Math.max(0, int(raw.gold));
  p.goldTotal = Math.max(p.gold, int(raw.goldTotal));
  p.perks = counts(raw.perks);
  p.years = int(raw.years);
  p.bestStage = Math.max(p.stage, int(raw.bestStage, 1, 1));
  p.bosses = counts(raw.bosses);
  p.stars = {};
  for (const [k, v] of Object.entries(counts(raw.stars))) p.stars[k] = Math.min(3, v);
  p.notebook = counts(raw.notebook);
  p.toyBook = {};
  for (const [k, g] of Object.entries(counts(raw.toyBook))) if (FAM_SET.has(k)) p.toyBook[k] = Math.min(RULES.grades, g);
  p.bestGrade = Math.min(RULES.grades, Math.max(1, int(raw.bestGrade, 1, 1), ...Object.values(p.toyBook)));
  // the toys held count in the book (a save older than its book, or a book that lost a family)
  for (const x of [...p.slots, ...p.chest]) if (x) noteToy(p, x);
  p.hunts = int(raw.hunts);
  p.merges = int(raw.merges);
  p.total = int(raw.total);
  p.best = counts(raw.best);
  p.lastLen = num(raw.lastLen);
  p.lastSeen = Math.max(0, num(raw.lastSeen));
  p.seen = Array.isArray(raw.seen) ? raw.seen.filter((s): s is string => typeof s === 'string') : [];
  return p;
}

// ── the squad ────────────────────────────────────────────────────
/** Cushions open on the wall: two, and one more at each milestone of the furthest stage ever. */
export function slotCount(p: KotyProgress): number {
  const n = RULES.slotsBase + RULES.slotsAt.filter(s => p.bestStage >= s).length;
  return Math.min(RULES.slotsMax, n);
}

/** Whether a cat's join condition is met by the progress. */
export function catEarned(p: KotyProgress, id: CatId): boolean {
  const j = CATS.find(c => c.id === id)?.join;
  if (!j) return false;
  switch (j.kind) {
    case 'start': return true;
    case 'stage': return p.bestStage >= j.n;
    case 'boss': return (p.bosses[j.id] ?? 0) > 0;
    case 'vintage': return p.years >= 1;
    case 'sessions': return p.sessions >= j.n;
    case 'hunts': return p.hunts >= j.n;
  }
}

/** Cats whose milestone is reached join the abbey (and the wall, while it has room); returns the new ones. */
export function joinCats(p: KotyProgress): CatId[] {
  const out: CatId[] = [];
  for (const c of CATS) {
    if (p.cats.includes(c.id) || !catEarned(p, c.id)) continue;
    p.cats.push(c.id);
    if (p.squad.length < RULES.slotsMax) p.squad.push(c.id);
    out.push(c.id);
  }
  return out;
}

/** Put a cat on the wall (the last one goes to the kitchen when it is full) or take it off. */
export function toggleWall(p: KotyProgress, id: CatId): void {
  if (!p.cats.includes(id) || p.trips.includes(id)) return;
  const i = p.squad.indexOf(id);
  if (i >= 0) {
    if (p.squad.length > 1) p.squad.splice(i, 1);
    return;
  }
  const room = slotCount(p);
  if (p.squad.length >= room) p.squad.splice(room - 1, 1, id);
  else p.squad.push(id);
}

/** Send a kitchen cat on a trip to the neighbouring farms (it comes back at the next session); false when it cannot go. */
export function sendTrip(p: KotyProgress, id: CatId): boolean {
  const onWall = p.squad.slice(0, slotCount(p)).includes(id);
  if (!p.cats.includes(id) || onWall || p.trips.includes(id)) return false;
  const i = p.squad.indexOf(id);
  if (i >= 0) p.squad.splice(i, 1);
  p.trips.push(id);
  return true;
}

// ── the upgrades (fish) ──────────────────────────────────────────
export const aimMult = (l: number): number => (1 + RULES.aim.per * l) * 2 ** Math.floor(l / RULES.aim.double);
export const pawsMult = (l: number): number => 1 + RULES.paws.per * Math.min(l, RULES.paws.max);
export const bowlMult = (l: number): number => 1 + RULES.bowl.per * l;

/** The fish the next level costs (null: at its top). */
export function upCost(id: UpId, l: number): number | null {
  if (id === 'paws' && l >= RULES.paws.max) return null;
  const r = RULES[id];
  return Math.ceil(r.c0 * r.g ** l);
}

export const perkLevel = (p: KotyProgress, id: PerkId): number => Math.max(0, Math.floor(num(p.perks[id])));

/** The grade the brother's trunk (the shop) sells now. */
export function shopGrade(p: KotyProgress): number {
  return Math.max(1, Math.min(RULES.grades - 2, p.bestGrade - RULES.shopUnder + perkLevel(p, 'kufer'), 1 + perkLevel(p, 'kufer')));
}

export function toyCost(p: KotyProgress): number {
  const g = shopGrade(p);
  return Math.ceil(RULES.shop.c0 * RULES.shop.gradeCost ** (g - 1) * RULES.shop.g ** p.bought);
}

/** The cost of the next purchase of anything along the bottom (null: at its top). */
export function costOf(p: KotyProgress, id: BuyId): number | null {
  return id === 'toy' ? toyCost(p) : upCost(id, p.up[id]);
}

// ── the perks (golden fish) ──────────────────────────────────────
export interface Perks {
  dmg: number; fish: number; nap: number; napGift: number; huntPower: number; huntCharge: number;
  start: number; awayCapH: number; awayShare: number; patience: number;
}

export function perks(p: KotyProgress): Perks {
  const l = (id: PerkId) => perkLevel(p, id);
  return {
    dmg: 1 + 0.5 * l('oczy'),
    fish: 1 + 0.5 * l('spizarnia'),
    nap: 1 + 0.4 * l('parapet'),
    napGift: l('parapet') >= 2 ? 1 : 0,
    huntPower: 1 + 0.4 * l('lowy'),
    huntCharge: 1 + 0.15 * l('lowy'),
    start: 1 + 2 * l('skrot'),
    awayCapH: RULES.awayCapH + 2 * l('warta'),
    awayShare: RULES.awayShare + 0.003 * l('warta'),
    patience: RULES.patience + 5 * l('gaweda'),
  };
}

/** Buy the next level of a perk with golden fish; false when it is at its top or too dear. */
export function buyPerk(p: KotyProgress, id: PerkId): boolean {
  const cost = perkCost(id, perkLevel(p, id));
  if (cost === null || p.gold < cost) return false;
  p.gold -= cost;
  p.perks[id] = perkLevel(p, id) + 1;
  return true;
}

/** The cheapest perk the golden fish can pay now (null: none). */
export function affordablePerk(p: KotyProgress): PerkId | null {
  let best: PerkId | null = null, bestCost = Infinity;
  for (const k of PERKS) {
    const c = perkCost(k.id, perkLevel(p, k.id));
    if (c !== null && c <= p.gold && c < bestCost) { bestCost = c; best = k.id; }
  }
  return best;
}

// ── the vintage (rebirth) ────────────────────────────────────────
/** The golden fish a vintage at this stage pays (0 before it opens). */
export function vintageGold(stage: number): number {
  if (stage < RULES.vintageFrom) return 0;
  const v = RULES.vintage;
  return Math.max(1, Math.floor((stage - v.off) ** v.pow / v.div));
}

export const canVintage = (p: KotyProgress): boolean => p.stage >= RULES.vintageFrom;

/**
 * Hold the vintage: golden fish for the year, and the year starts over (stage, fish, upgrades and the
 * shop's price); toys, cats, perks and records stay.  Returns the golden fish paid (0: not open).
 */
export function holdVintage(p: KotyProgress): number {
  if (!canVintage(p)) return 0;
  const gold = vintageGold(Math.max(p.stage, p.yearBest));
  p.gold += gold;
  p.goldTotal += gold;
  p.years += 1;
  p.stage = perks(p).start;
  p.yearBest = p.stage;
  p.fish = 0;
  p.up = { aim: 0, paws: 0, bowl: 0 };
  p.bought = 0;
  p.chief = 1;
  return gold;
}

// ── the notebook ─────────────────────────────────────────────────
/** Remember a toy made: its family's best grade and the best grade of all. */
export function noteToy(p: KotyProgress, t: Toy): boolean {
  const was = p.toyBook[t.fam] ?? 0;
  if (t.g > was) p.toyBook[t.fam] = t.g;
  const fresh = t.g > p.bestGrade;
  p.bestGrade = Math.max(p.bestGrade, t.g);
  return fresh;
}

export const bossChased = (p: KotyProgress, id: BossId): number => p.bosses[id] ?? 0;

/** The best toy the watch holds now (on the wall or in the chest). */
export function bestToy(p: KotyProgress): Toy | null {
  let best: Toy | null = null;
  for (const x of [...p.slots, ...p.chest]) if (x && (!best || x.g > best.g || (x.g === best.g && toyDps(x) > toyDps(best)))) best = x;
  return best;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: KotyProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: KotyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
