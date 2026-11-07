/**
 * What Dolina remembers between runs and the pure rules of its meta game: the level the next run
 * starts at and the stars of every level played (the valley's map), the sparks in hand and all ever
 * (the pilgrim's looks), the upgrades bought with them (Kamieniarz, Kuźnia, Iskry, Knot, Oliwa), the
 * lambs brought home, the guardians beaten, the records per session length, what the player has
 * already been shown (so later sessions explain only new things) and the day's gift.
 * No DOM, no randomness.
 *
 * Version 2 (the rebuild after Hell Escape) replaced version 1's eras-and-sword meta: an old save is
 * migrated in place on first use — its best scores, the length last played and the session count
 * stay, the rest starts over (its upgrades no longer exist).
 */
import { UPGRADES, type UpId } from './content';
import { RULES } from './rules';

export interface DolinaProgress {
  ver: 2;
  /** runs (sessions) saved */
  sessions: number;
  /** metres of the valley, all time */
  total: number;
  /** sparks in hand, and all ever (the looks) */
  sparks: number;
  sparksAll: number;
  /** upgrade levels */
  ups: Record<UpId, number>;
  /** the level the next run starts at (1-based), and the highest level ever finished */
  level: number;
  top: number;
  /** stars per level ("7": 0..3) */
  stars: Record<string, number>;
  /** lambs brought home, guardians beaten, Świty lit, all time */
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
}

const freshUps = (): Record<UpId, number> => Object.fromEntries(UPGRADES.map(id => [id, 0])) as Record<UpId, number>;

export function freshProgress(): DolinaProgress {
  return {
    ver: 2, sessions: 0, total: 0, sparks: 0, sparksAll: 0, ups: freshUps(), level: 1, top: 0, stars: {},
    lambs: 0, guards: 0, dawns: 0, pushes: 0, best: {}, lastLen: 0, bestCombo: 0, seen: [], giftDay: '',
  };
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
 * Bring a loaded progress to version 2 in place (idempotent).  A version-1 save (or anything older or
 * broken) keeps its best scores, its last length and its session count; everything else starts over.
 * A version-2 save only has its fields' types checked, so a damaged field never crashes a run.
 */
export function migrate(p: DolinaProgress): DolinaProgress {
  const o = p as unknown as Record<string, unknown>;
  // the runner merges a save over a fresh progress, so a version-1 save arrives with `ver: 2` from
  // the fresh one — and its own `v: 1`
  if (o.ver !== 2 || o.v !== undefined) {
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
  if (!Array.isArray(o.seen)) o.seen = [];
  o.best = records(o.best);
  o.stars = records(o.stars);
  const ups = isObj(o.ups) ? o.ups : {};
  o.ups = Object.fromEntries(UPGRADES.map(id => [id, Math.round(num(ups[id]))]));
  p.level = Math.max(1, Math.round(p.level));
  return p;
}

// ── the looks ────────────────────────────────────────────────────
/** The look (0-based) for all sparks ever. */
export function lookOf(sparksAll: number): number {
  let r = 0;
  RULES.looks.forEach((at, i) => { if (sparksAll >= at) r = i; });
  return r;
}

/** Sparks at which the next look comes (null: the last). */
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
