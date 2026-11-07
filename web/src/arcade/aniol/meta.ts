/**
 * What Anioł Stróż remembers between nights and the pure rules of its meta game: the angel's rank
 * (all feathers ever — it widens the pool of gifts and makes the room cosier), the wallet of feathers
 * and the upgrade tree they buy, the campaign of dreams (each session is the next night; three nights
 * a dream, a boss at each night's end, one to three stars a night), the coach marks already seen,
 * the records per session length, the bosses banished and the day's gift.  No DOM, no randomness.
 *
 * Version 2 (2026-11-07) added the wallet, the tree, the dreams and the coach marks.  A version-1
 * save (it carries `v: 1`) keeps its records, sessions, feathers and counters, and starts the
 * campaign at the first dream with a welcome of feathers in the wallet.
 */
import { CHAPTERS, GIFTS, ROOM, UPS, type Chapter, type Gift, type RoomItem, type UpId } from './content';
import { RULES } from './rules';

export interface AniolProgress {
  ver: 2;
  /** nights (sessions) saved */
  sessions: number;
  /** Zmory banished, all time */
  total: number;
  /** feathers, all time: the angel's rank */
  feathers: number;
  /** feathers to spend on the upgrade tree */
  wallet: number;
  /** the tree's levels (0..upMax) */
  up: Record<UpId, number>;
  /** Czuwanie blocks begun, all time: every 4th is blind ("Mgła snu") from the 3rd session */
  pushes: number;
  /** records: Zmory banished per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the longest combo, the highest level of a night, bosses banished, Płomienie, calm nights, perfect hits */
  bestCombo: number;
  bestLevel: number;
  koszmary: number;
  flames: number;
  calmNights: number;
  perfects: number;
  /** the campaign: the next night's index (0-based) and the stars each night earned (best kept) */
  night: number;
  stars: number[];
  /** coach marks and story cards already shown (keys) */
  seen: string[];
  /** the day's gift: the day it was given */
  giftDay: string;
}

const noUps = (): Record<UpId, number> => ({ reach: 0, perfect: 0, aura: 0, flame: 0, sen: 0, lull: 0 });

export function freshProgress(): AniolProgress {
  return {
    ver: 2, sessions: 0, total: 0, feathers: 0, wallet: 0, up: noUps(), pushes: 0, best: {}, lastLen: 0,
    bestCombo: 0, bestLevel: 0, koszmary: 0, flames: 0, calmNights: 0, perfects: 0, night: 0, stars: [], seen: [], giftDay: '',
  };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const whole = (v: unknown): number => Math.max(0, Math.floor(num(v)));

/**
 * Bring any saved progress to version 2 in place (and return it).  A version-1 save — merged over
 * fresh defaults it shows `ver: 2` and still `v: 1` — keeps its records and counters and starts the
 * dreams anew; fields of a wrong type never crash, they fall back to their fresh values.
 */
export function migrate(p: AniolProgress): AniolProgress {
  const raw = p as unknown as Record<string, unknown>;
  const old = raw.ver !== 2 || 'v' in raw;
  const fresh = freshProgress();
  const best: Record<string, number> = {};
  if (raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)) {
    for (const [k, v] of Object.entries(raw.best as Record<string, unknown>)) if (num(v) > 0) best[k] = num(v);
  }
  const keep = {
    sessions: whole(raw.sessions), total: whole(raw.total), feathers: whole(raw.feathers), pushes: whole(raw.pushes), best,
    lastLen: whole(raw.lastLen), bestCombo: whole(raw.bestCombo), bestLevel: whole(raw.bestLevel), koszmary: whole(raw.koszmary),
    flames: whole(raw.flames), calmNights: whole(raw.calmNights), giftDay: typeof raw.giftDay === 'string' ? raw.giftDay : '',
  };
  if (old) {
    for (const k of Object.keys(raw)) if (!(k in fresh)) delete raw[k];
    Object.assign(p, fresh, keep);
    p.wallet = Math.min(RULES.welcome, keep.feathers);
    return p;
  }
  Object.assign(p, keep);
  p.wallet = whole(raw.wallet);
  const up = noUps();
  if (raw.up && typeof raw.up === 'object' && !Array.isArray(raw.up)) {
    for (const u of UPS) up[u.id] = Math.min(RULES.upMax, whole((raw.up as Record<string, unknown>)[u.id]));
  }
  p.up = up;
  p.perfects = whole(raw.perfects);
  p.night = whole(raw.night);
  p.stars = Array.isArray(raw.stars) ? (raw.stars as unknown[]).map(v => Math.min(3, whole(v))) : [];
  p.seen = Array.isArray(raw.seen) ? (raw.seen as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  return p;
}

// ── the rank ─────────────────────────────────────────────────────
/** The rank (0-based) for all feathers ever. */
export function rankOf(feathers: number): number {
  let r = 0;
  RULES.ranks.forEach((at, i) => { if (feathers >= at) r = i; });
  return r;
}

/** Feathers at which the next rank comes (null: the last rank). */
export function nextRankAt(feathers: number): number | null {
  const r = rankOf(feathers);
  return r + 1 < RULES.ranks.length ? RULES.ranks[r + 1] : null;
}

/** The gifts a night can offer at a rank. */
export const giftPool = (rank: number): Gift[] => GIFTS.filter(g => g.rank <= rank);

/** The cosy things the room has at a rank: one more with each rank from the second. */
export const roomItems = (rank: number): RoomItem[] => ROOM.slice(0, Math.max(0, Math.min(ROOM.length, rank)));

// ── the dreams ───────────────────────────────────────────────────
/** The dream (chapter index) of a night: three nights each, the last dream goes on. */
export const chapterOf = (night: number): number => Math.min(RULES.chapters - 1, Math.floor(Math.max(0, night) / RULES.nightsPer));
export const chapterAt = (night: number): Chapter => CHAPTERS[chapterOf(night)];
/** The night's number inside its dream (1..3; in the last dream it keeps counting). */
export const nightInChapter = (night: number): number => Math.max(0, night) - chapterOf(night) * RULES.nightsPer + 1;

/** The stars of a night, kept at their best.  Returns how many were new. */
export function giveStars(p: AniolProgress, night: number, stars: number): number {
  while (p.stars.length <= night) p.stars.push(0);
  const before = p.stars[night];
  p.stars[night] = Math.max(before, Math.min(3, Math.max(0, Math.round(stars))));
  return p.stars[night] - before;
}

export const starsTotal = (p: AniolProgress): number => p.stars.reduce((s, v) => s + (v > 0 ? v : 0), 0);

// ── the upgrade tree ─────────────────────────────────────────────
/** The price of the next level of an upgrade (null: at its top). */
export function upPrice(p: AniolProgress, id: UpId): number | null {
  const lvl = p.up[id] ?? 0;
  return lvl >= RULES.upMax ? null : RULES.upCost[lvl];
}

/** An upgrade can be bought: not at its top, the one before it on the branch has a level, the wallet holds its price. */
export function canBuy(p: AniolProgress, id: UpId): boolean {
  const u = UPS.find(x => x.id === id);
  const price = upPrice(p, id);
  if (!u || price === null) return false;
  if (u.needs && (p.up[u.needs] ?? 0) < 1) return false;
  return p.wallet >= price;
}

/** Buy one level (false: it cannot be bought now). */
export function buyUp(p: AniolProgress, id: UpId): boolean {
  if (!canBuy(p, id)) return false;
  p.wallet -= upPrice(p, id)!;
  p.up[id] = (p.up[id] ?? 0) + 1;
  return true;
}

/** What an upgrade gives at a level, as a share of its base (for the numbers on the card): +5 %, −16 %… */
export function upShare(id: UpId, lvl: number): number {
  const k = RULES.up[id] * lvl;
  switch (id) {
    case 'reach': return k / RULES.reach;
    case 'perfect': return k / RULES.perfect;
    default: return k;
  }
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: AniolProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: AniolProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
