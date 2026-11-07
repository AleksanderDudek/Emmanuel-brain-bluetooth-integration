/**
 * What Glina remembers between sessions (v2) and the pure rules of its meta game: the purse and the
 * shop (glazes, patterns, the wheel and the kiln), the shelf (the best piece of every form, the
 * collection), the forms open to order (one more for every few stars), the three households'
 * stories, the kiln's gifts, the coach marks already shown and the records.  No DOM; randomness only
 * from the caller's generator.
 *
 * A v1 save (the chalk-line Glina) is migrated in place on first use: its session count stays, its
 * best session (in centimetres, a unit the shop no longer counts in) is kept as `legacyCm` for the
 * records, and the glazes it had and the households' story steps stay; the rest starts fresh.
 * Fields of an unexpected type never crash the game: they are read as their fresh value.
 */
import {
  FORM, FORMS, FORMS_START, FORM_IDS, FORM_STEP, GLAZES, HOUSES, KILN_GIFTS, PATTERNS, SHOP, START_GLAZES, START_PATTERNS,
  type FormId, type GlazeId, type HouseId, type KilnGift, type PatternId, type ShopItem,
} from './content';
import { RINGS } from './shape';

/** A painted band: its height (u × 100), colour and pattern. */
export type BandRec = [number, GlazeId, PatternId];

/** A sold piece, enough to draw it again on the shelf. */
export interface PieceRec {
  f: FormId;
  /** height (cm, 1 decimal) and the radius ÷ height × 100 at the rings */
  h: number;
  q: number[];
  g: GlazeId;
  b: BandRec[];
  stars: 1 | 2 | 3;
  /** the shape's match × 100 */
  m: number;
  gift: KilnGift | null;
}

export interface GlinaProgress {
  ver: 2;
  sessions: number;
  /** the best session (sykli) */
  best: number;
  /** the v1 record in centimetres, kept for the records card */
  legacyCm: number;
  /** sykli to spend, and all ever earned */
  purse: number;
  earned: number;
  /** pieces sold, stars earned, ★★★ pieces, master spins — all time */
  sold: number;
  stars: number;
  three: number;
  spins: number;
  /** the best streak of ★★★ sales in a row */
  bestStreak: number;
  /** what the shop sold */
  glazes: GlazeId[];
  patterns: PatternId[];
  wheel: number;
  kiln: number;
  /** the best piece of every form (the collection) */
  shelf: Partial<Record<FormId, PieceRec>>;
  /** each household's story steps delivered (0..4) */
  steps: Record<HouseId, number>;
  /** the kiln's gifts received, by kind */
  gifts: Record<string, number>;
  /** Toczenie (push) blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** coach marks already shown */
  seen: string[];
  lastDay: string;
}

export function freshProgress(): GlinaProgress {
  return {
    ver: 2, sessions: 0, best: 0, legacyCm: 0, purse: 0, earned: 0, sold: 0, stars: 0, three: 0, spins: 0, bestStreak: 0,
    glazes: [...START_GLAZES], patterns: [...START_PATTERNS], wheel: 0, kiln: 0, shelf: {},
    steps: { karczma: 0, piekarnia: 0, mlodzi: 0 }, gifts: {}, pushes: 0, seen: [], lastDay: '',
  };
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nat = (v: unknown, def = 0, max = Infinity): number => Math.min(max, Math.max(0, Math.floor(num(v, def))));

function cleanPiece(v: unknown, f: FormId): PieceRec | null {
  if (!isObj(v)) return null;
  const q = Array.isArray(v.q) && v.q.length === RINGS && v.q.every(x => typeof x === 'number' && Number.isFinite(x)) ? (v.q as number[]) : null;
  if (!q) return null;
  const g = GLAZES.includes(v.g as GlazeId) ? (v.g as GlazeId) : 'biel';
  const b = Array.isArray(v.b) ? (v.b as unknown[]).filter((x): x is BandRec => Array.isArray(x) && x.length === 3
    && typeof x[0] === 'number' && GLAZES.includes(x[1] as GlazeId) && PATTERNS.includes(x[2] as PatternId)).slice(0, 4) : [];
  const stars = Math.min(3, Math.max(1, Math.round(num(v.stars, 1)))) as 1 | 2 | 3;
  const gift = KILN_GIFTS.includes(v.gift as KilnGift) ? (v.gift as KilnGift) : null;
  return { f, h: Math.max(1, num(v.h, FORM[f].N)), q, g, b, stars, m: nat(v.m, 0, 100), gift };
}

/**
 * Bring a loaded save to v2, in place.  An old (v1) or unknown save keeps its session count, its
 * best (as legacyCm), its glazes and its households' steps; a v2 save has every field checked.
 */
export function migrate(p: GlinaProgress): GlinaProgress {
  const raw = p as unknown as Record<string, unknown>;
  const fresh = freshProgress();
  if (raw.ver !== 2 || 'v' in raw) {
    const sessions = nat(raw.sessions);
    const legacyCm = nat(raw.bestSession);
    const glazes = Array.isArray(raw.glazes) ? (raw.glazes as unknown[]).filter((g): g is GlazeId => GLAZES.includes(g as GlazeId)) : [];
    const steps = isObj(raw.steps) ? raw.steps : {};
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(raw, fresh, {
      sessions, legacyCm,
      glazes: [...new Set([...START_GLAZES, ...glazes])],
      steps: Object.fromEntries(HOUSES.map(h => [h, nat(steps[h], 0, 4)])),
    });
    return p;
  }
  const f = fresh as unknown as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (!(k in f)) delete raw[k];
  for (const [k, def] of Object.entries(f)) {
    const v = raw[k];
    if (typeof def === 'number') raw[k] = nat(v, def, k === 'wheel' || k === 'kiln' ? 3 : Infinity);
    else if (typeof def === 'string') raw[k] = typeof v === 'string' ? v : def;
  }
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  p.glazes = [...new Set([...START_GLAZES, ...arr(raw.glazes).filter((g): g is GlazeId => GLAZES.includes(g as GlazeId))])];
  p.patterns = [...new Set([...START_PATTERNS, ...arr(raw.patterns).filter((x): x is PatternId => PATTERNS.includes(x as PatternId))])];
  p.seen = arr(raw.seen).filter((x): x is string => typeof x === 'string');
  const shelf = isObj(raw.shelf) ? raw.shelf : {};
  p.shelf = {};
  for (const id of FORM_IDS) {
    const rec = cleanPiece(shelf[id], id);
    if (rec) p.shelf[id] = rec;
  }
  const steps = isObj(raw.steps) ? raw.steps : {};
  p.steps = Object.fromEntries(HOUSES.map(h => [h, nat(steps[h], 0, 4)])) as Record<HouseId, number>;
  const gifts = isObj(raw.gifts) ? raw.gifts : {};
  p.gifts = Object.fromEntries(KILN_GIFTS.filter(g => num(gifts[g]) > 0).map(g => [g, nat(gifts[g])]));
  raw.ver = 2;
  return p;
}

/** The best headline so far (null: never played). */
export const bestOf = (p: GlinaProgress): number | null => (p.sessions > 0 ? p.best : null);

// ── forms ────────────────────────────────────────────────────────
/** How many forms are open to order (by stars earned, all time). */
export const openCount = (p: GlinaProgress): number => Math.min(FORMS.length, FORMS_START + Math.floor(p.stars / FORM_STEP));

/** The forms open to order, easiest first. */
export const openForms = (p: GlinaProgress): FormId[] => FORMS.slice(0, openCount(p)).map(f => f.id);

/** Stars still needed for the next form (null: all are open). */
export function starsToNext(p: GlinaProgress): number | null {
  const n = openCount(p);
  return n >= FORMS.length ? null : (n - FORMS_START + 1) * FORM_STEP - p.stars;
}

// ── the shelf ────────────────────────────────────────────────────
/** Whether `a` is a better shelf piece than `b`: by stars, then by shape. */
export const better = (a: PieceRec, b: PieceRec): boolean => (a.stars !== b.stars ? a.stars > b.stars : a.m > b.m);

/** Put a sold piece on the shelf: 'new' (its form's first), 'up' (a better one), or 'same'. */
export function shelve(p: GlinaProgress, rec: PieceRec): 'new' | 'up' | 'same' {
  const had = p.shelf[rec.f];
  if (!had) {
    p.shelf[rec.f] = rec;
    return 'new';
  }
  if (better(rec, had)) {
    p.shelf[rec.f] = rec;
    return 'up';
  }
  return 'same';
}

export const shelfCount = (p: GlinaProgress): number => FORM_IDS.filter(f => p.shelf[f]).length;

// ── the shop ────────────────────────────────────────────────────
export function owned(p: GlinaProgress, it: ShopItem): boolean {
  switch (it.kind) {
    case 'glaze': return p.glazes.includes(it.ref);
    case 'pattern': return p.patterns.includes(it.ref);
    case 'wheel': return p.wheel >= it.ref;
    case 'kiln': return p.kiln >= it.ref;
  }
}

/** An item is on sale when it is not owned and its earlier level is (wheel 2 after wheel 1). */
export function onSale(p: GlinaProgress, it: ShopItem): boolean {
  if (owned(p, it)) return false;
  if (it.kind === 'wheel') return p.wheel === it.ref - 1;
  if (it.kind === 'kiln') return p.kiln === it.ref - 1;
  return true;
}

/** The shop's window: the next few items on sale, cheapest first. */
export const window_ = (p: GlinaProgress, n = 4): ShopItem[] => SHOP.filter(it => onSale(p, it)).sort((a, b) => a.price - b.price).slice(0, n);

/** Buy an item with the purse; false when it cannot be bought. */
export function buy(p: GlinaProgress, id: string): boolean {
  const it = SHOP.find(x => x.id === id);
  if (!it || !onSale(p, it) || p.purse < it.price) return false;
  p.purse -= it.price;
  switch (it.kind) {
    case 'glaze': p.glazes.push(it.ref); break;
    case 'pattern': p.patterns.push(it.ref); break;
    case 'wheel': p.wheel = it.ref; break;
    case 'kiln': p.kiln = it.ref; break;
  }
  return true;
}

/** The kiln shelf's capacity (pieces per firing). */
export const capacity = (p: GlinaProgress): number => 3 + p.kiln;

// ── the households ──────────────────────────────────────────────
/** The household whose story goes on next: the fewest steps (< 4), ties in street order (null: all told). */
export function nextStory(p: GlinaProgress): HouseId | null {
  let best: HouseId | null = null;
  for (const h of HOUSES) if (p.steps[h] < 4 && (best === null || p.steps[h] < p.steps[best])) best = h;
  return best;
}

/** Shop items owned (for the records): glazes, patterns, upgrade levels. */
export const ownedCount = (p: GlinaProgress): number => SHOP.filter(it => owned(p, it)).length;
