/**
 * What Dziewiątka remembers between sessions and the pure rules of its meta game:
 *
 *   the town     the campaign's place (mission 0…29 through six districts) with the stars of every
 *                mission won, then the Bell Tower's floor and the best floor
 *   the heroes   who has joined, the five on the team, and each hero's growth: level and XP, colour
 *                rank with the pieces of gear sewn on for the next one, notes and stars
 *   the bag      pieces of gear won in battle and not yet sewn on (by kind)
 *   a boon       the last boon of a session, kept for the next one
 *   records      hushed per session length, totals, counters, first-time explanations seen
 *
 * Version 1.  The placeholder of the v3 foundation saved `{ sessions: n }`: it is read in place
 * (the count stays, everything else starts fresh).  Fields of a wrong type are reset rather than
 * trusted.  No DOM, no randomness.
 */
import {
  CAMPAIGN, FAMILIES, FAMILY_BONUS, HERO_IDS, HEROES, MISSIONS_PER_CHAPTER, PIECES, START_TEAM, BOON_IDS,
  type BoonId, type Family, type HeroId,
} from './content';
import { RULES } from './rules';

export interface HeroGrowth {
  /** level 1…levelMax and the XP toward the next */
  lv: number;
  xp: number;
  /** colour rank 0 (white) … rankMax (red), and the pieces sewn on toward the next (a bit per kind) */
  rank: number;
  slots: number;
  /** notes gathered toward the next star, and the stars (1…6) */
  notes: number;
  stars: number;
}

export interface DziewiatkaProgress {
  ver: 1;
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** hushed all time; records per session length (planned seconds) and the length last played */
  total: number;
  best: Record<string, number>;
  lastLen: number;
  /** the campaign: the next mission (0…CAMPAIGN; CAMPAIGN = all done) and the stars of each mission won */
  mission: number;
  stars: number[];
  /** the Bell Tower: the next floor (1…) and the best floor cleared */
  floor: number;
  towerBest: number;
  /** who has joined, and the five (in the order of the portraits) */
  owned: string[];
  team: string[];
  heroes: Record<string, HeroGrowth>;
  /** pieces in the bag, by kind */
  bag: number[];
  /** a boon kept for the next session ('' none) and whether it is golden */
  boon: string;
  boonGold: boolean;
  /** counters */
  missions: number;
  ults: number;
  harmonies: number;
  interrupts: number;
  bosses: number;
  /** first-time explanations already given (coach marks) */
  seen: string[];
}

export const freshHero = (): HeroGrowth => ({ lv: 1, xp: 0, rank: 0, slots: 0, notes: 0, stars: 1 });

export function freshProgress(): DziewiatkaProgress {
  const heroes: Record<string, HeroGrowth> = {};
  for (const id of HERO_IDS) heroes[id] = freshHero();
  return {
    ver: 1, sessions: 0, pushes: 0, total: 0, best: {}, lastLen: 0, mission: 0, stars: [], floor: 1, towerBest: 0,
    owned: [...START_TEAM], team: [...START_TEAM], heroes, bag: new Array(PIECES).fill(0), boon: '', boonGold: false,
    missions: 0, ults: 0, harmonies: 0, interrupts: 0, bosses: 0, seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = -Infinity, hi = Infinity): number => Math.max(lo, Math.min(hi, Math.floor(num(v, d))));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isHero = (v: unknown): v is HeroId => typeof v === 'string' && (HERO_IDS as readonly string[]).includes(v);

/**
 * Bring a loaded save to version 1, in place (idempotent).  The foundation's placeholder (`{ sessions }`)
 * keeps its count; a v1 save keeps everything that still means something, with wrong types repaired.
 */
export function migrate(p: DziewiatkaProgress): DziewiatkaProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions, 0, 0), pushes: int(raw.pushes, 0, 0) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  for (const k of ['sessions', 'pushes', 'total', 'lastLen', 'missions', 'ults', 'harmonies', 'interrupts', 'bosses', 'towerBest'] as const) {
    raw[k] = int(raw[k], 0, 0);
  }
  p.mission = int(raw.mission, 0, 0, CAMPAIGN);
  p.floor = int(raw.floor, 1, 1);
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.stars = Array.isArray(raw.stars) ? raw.stars.slice(0, CAMPAIGN).map(s => int(s, 0, 0, 3)) : [];
  const owned = Array.isArray(raw.owned) ? [...new Set(raw.owned.filter(isHero))] : [];
  for (const id of START_TEAM) if (!owned.includes(id)) owned.push(id);
  p.owned = HERO_IDS.filter(id => owned.includes(id));
  let team: HeroId[] = Array.isArray(raw.team) ? [...new Set(raw.team.filter(isHero))].filter(id => p.owned.includes(id)) : [];
  for (const id of [...START_TEAM, ...(p.owned as HeroId[])]) if (team.length < 5 && !team.includes(id)) team.push(id);
  team = team.slice(0, 5);
  p.team = team;
  const heroes: Record<string, HeroGrowth> = {};
  const rh = isObj(raw.heroes) ? raw.heroes : {};
  for (const id of HERO_IDS) {
    const h = isObj(rh[id]) ? rh[id] as Record<string, unknown> : {};
    heroes[id] = {
      lv: int(h.lv, 1, 1, RULES.levelMax), xp: int(h.xp, 0, 0), rank: int(h.rank, 0, 0, RULES.rankMax),
      slots: int(h.slots, 0, 0, (1 << PIECES) - 1), notes: int(h.notes, 0, 0), stars: int(h.stars, 1, 1, 6),
    };
  }
  p.heroes = heroes;
  p.bag = Array.from({ length: PIECES }, (_, i) => (Array.isArray(raw.bag) ? int(raw.bag[i], 0, 0) : 0));
  p.boon = typeof raw.boon === 'string' && (BOON_IDS as string[]).includes(raw.boon) ? raw.boon : '';
  p.boonGold = raw.boonGold === true;
  p.seen = Array.isArray(raw.seen) ? raw.seen.filter((s): s is string => typeof s === 'string') : [];
  return p;
}

// ── heroes ───────────────────────────────────────────────────────
export const growth = (p: DziewiatkaProgress, id: HeroId): HeroGrowth => p.heroes[id] ?? (p.heroes[id] = freshHero());

/** A hero's multiplier on health and attack from level, rank and stars. */
export function powerOf(g: HeroGrowth): number {
  return (1 + RULES.perLevel * (g.lv - 1)) * (1 + RULES.perRank * g.rank) * (1 + RULES.perStar * (g.stars - 1));
}

/** A hero's power rating (the panel's "siła"): health and attack together, rounded. */
export function rating(p: DziewiatkaProgress, id: HeroId): number {
  const s = HEROES[id];
  return Math.round(((s.hp / 10) + (s.atk / s.cd) * 2) * powerOf(growth(p, id)));
}

/** The five's power: the sum of their ratings. */
export const teamRating = (p: DziewiatkaProgress): number => p.team.reduce((s, id) => s + (isHero(id) ? rating(p, id) : 0), 0);

/** XP from level L to L + 1. */
export const xpNeed = (lv: number): number => RULES.xpNeed + RULES.xpNeedStep * Math.max(0, lv - 1);

/** Give XP to a hero; returns the levels gained. */
export function addXp(g: HeroGrowth, xp: number): number {
  if (!(xp > 0)) return 0;
  let up = 0;
  g.xp += Math.round(xp);
  while (g.lv < RULES.levelMax && g.xp >= xpNeed(g.lv)) {
    g.xp -= xpNeed(g.lv);
    g.lv++;
    up++;
  }
  if (g.lv >= RULES.levelMax) g.xp = 0;
  return up;
}

/** Notes toward the next star; returns the stars gained. */
export function addNotes(g: HeroGrowth, n: number): number {
  if (!(n > 0)) return 0;
  let up = 0;
  g.notes += Math.round(n);
  while (g.stars < 6 && g.notes >= RULES.starNotes[g.stars - 1]) {
    g.notes -= RULES.starNotes[g.stars - 1];
    g.stars++;
    up++;
  }
  if (g.stars >= 6) g.notes = 0;
  return up;
}

/** How many pieces a hero has sewn on toward the next rank. */
export const slotCount = (g: HeroGrowth): number => {
  let n = 0;
  for (let k = 0; k < PIECES; k++) if (g.slots & (1 << k)) n++;
  return n;
};

/** The kind of piece this hero could take from the bag now (−1: none fits, or the rank is at its top). */
export function fitting(p: DziewiatkaProgress, id: HeroId): number {
  const g = growth(p, id);
  if (g.rank >= RULES.rankMax) return -1;
  for (let k = 0; k < PIECES; k++) if (!(g.slots & (1 << k)) && p.bag[k] > 0) return k;
  return -1;
}

/**
 * Sew one piece from the bag onto a hero (the first kind that fits).  Six pieces make the next colour
 * rank: the slots clear.  Returns the kind sewn on and whether the rank went up (null: nothing fit).
 */
export function equip(p: DziewiatkaProgress, id: HeroId): { kind: number; rankUp: boolean } | null {
  const k = fitting(p, id);
  if (k < 0) return null;
  const g = growth(p, id);
  p.bag[k]--;
  g.slots |= 1 << k;
  if (slotCount(g) >= PIECES) {
    g.slots = 0;
    g.rank = Math.min(RULES.rankMax, g.rank + 1);
    return { kind: k, rankUp: true };
  }
  return { kind: k, rankUp: false };
}

/** The hero of the five a piece goes to: the lowest colour rank first, then the one closest to its next rank (null: none fits). */
export function nextToEquip(p: DziewiatkaProgress): HeroId | null {
  let best: HeroId | null = null, bestKey = Infinity;
  for (const id of p.team) {
    if (!isHero(id) || fitting(p, id) < 0) continue;
    const g = growth(p, id);
    const key = g.rank * 10 - slotCount(g);
    if (key < bestKey) { bestKey = key; best = id; }
  }
  return best;
}

/** The kinds of piece the five still need for their next ranks (and the bag does not hold). */
export function neededKinds(p: DziewiatkaProgress): number[] {
  const out: number[] = [];
  for (let k = 0; k < PIECES; k++) {
    const want = p.team.filter(id => isHero(id) && growth(p, id).rank < RULES.rankMax && !(growth(p, id).slots & (1 << k))).length;
    if (want > (p.bag[k] ?? 0)) out.push(k);
  }
  return out;
}

/** Sew everything that fits onto the five (Klara does it when nobody tapped): the rank-ups made. */
export function equipAll(p: DziewiatkaProgress): { id: HeroId; rankUp: boolean }[] {
  const out: { id: HeroId; rankUp: boolean }[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const id = nextToEquip(p);
    if (!id) break;
    const r = equip(p, id);
    if (!r) break;
    out.push({ id, rankUp: r.rankUp });
  }
  return out;
}

// ── the team ─────────────────────────────────────────────────────
/** Families in the five: how many of each. */
export function familyCounts(team: readonly string[]): Record<Family, number> {
  const c: Record<Family, number> = { serce: 0, dlonie: 0, korzenie: 0 };
  for (const id of team) if (isHero(id)) c[HEROES[id].family]++;
  return c;
}

/** A family's bonus for the five (0 below two of it). */
export function familyBonus(team: readonly string[], f: Family): number {
  const n = familyCounts(team)[f];
  return n >= 3 ? FAMILY_BONUS[f][1] : n === 2 ? FAMILY_BONUS[f][0] : 0;
}

export const activeFamilies = (team: readonly string[]): Family[] => FAMILIES.filter(f => familyCounts(team)[f] >= 2);

/**
 * Put a hero into the five (the lobby's choice): a hero already in it stays; a newcomer takes the
 * place of `out` (or the last of the five).  Returns whether the five changed.
 */
export function swapIn(p: DziewiatkaProgress, id: HeroId, out?: HeroId): boolean {
  if (!p.owned.includes(id) || p.team.includes(id)) return false;
  const i = out && p.team.includes(out) ? p.team.indexOf(out) : p.team.length - 1;
  p.team[i] = id;
  return true;
}

/** The heroes who join after a campaign mission is won (the campaign's story). */
export const joiningAfter = (mission: number): HeroId[] => HERO_IDS.filter(id => HEROES[id].joins === mission);

// ── the town ─────────────────────────────────────────────────────
export const campaignDone = (p: DziewiatkaProgress): boolean => p.mission >= CAMPAIGN;
export const starsTotal = (p: DziewiatkaProgress): number => p.stars.reduce((s, v) => s + Math.max(0, Math.min(3, v)), 0);
export const chapterStars = (p: DziewiatkaProgress, c: number): number => {
  let s = 0;
  for (let m = 0; m < MISSIONS_PER_CHAPTER; m++) s += Math.max(0, Math.min(3, p.stars[c * MISSIONS_PER_CHAPTER + m] ?? 0));
  return s;
};

/** Keep a mission's stars (the best of every try). */
export function recordStars(p: DziewiatkaProgress, index: number, stars: number): void {
  if (index < 0 || index >= CAMPAIGN) return;
  while (p.stars.length <= index) p.stars.push(0);
  p.stars[index] = Math.max(p.stars[index] ?? 0, Math.max(1, Math.min(3, stars)));
}

export const isBoonId = (v: string): v is BoonId => (BOON_IDS as string[]).includes(v);

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: DziewiatkaProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: DziewiatkaProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
