/**
 * What Rozświetl remembers between sessions, and the pure rules of its meta game:
 *
 *   the album      every picture transformed: how often, the best gold laid in its seams, the first and
 *                  the last day — the eight pairs and the player's own
 *   the tiles      the mosaics grow with the sessions: a few tiles at first, a dozen soon, dozens later
 *   the rotation   the day's picture first each day (the same for everyone), else the pair transformed
 *                  least; the player may choose the next one, and whether the own pictures take turns
 *                  ("builtin", "own", "both")
 *   own pictures   pairs of the player's photos (kit/images.ts keeps the files, only on this device;
 *                  here only their ids and the label)
 *   records        shards, the best session, the longest chain, flares, golden seams
 *
 * Version 1 from the start.  The placeholder's save (`{ ver: 1, sessions: n }`) keeps its session count;
 * a field of a wrong type is reset rather than trusted.  No DOM, no randomness.
 */
import { PAIR_IDS, type PairId } from './content';
import { RULES } from './rules';

export type Source = 'builtin' | 'own' | 'both';

/** A pair of the player's own pictures: the bright "after" (required) and the dark "before" (optional). */
export interface OwnPair { id: string; after: string; before: string | null; label: string; added: number }

export interface AlbumEntry {
  /** times transformed */
  n: number;
  /** the best share of its seams laid in gold (0..100) */
  gold: number;
  /** the first and the last day it was transformed ("YYYY-MM-DD") */
  first: string;
  last: string;
}

export interface RozProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** pictures transformed, all time */
  pictures: number;
  /** shards, all time */
  shards: number;
  /** the best session's shards, the longest chain */
  best: number;
  bestChain: number;
  flares: number;
  /** seams laid all in gold, all time */
  goldSeams: number;
  /** pair id or own pair id → its album entry */
  album: Record<string, AlbumEntry>;
  own: OwnPair[];
  source: Source;
  /** the next picture chosen in the lobby (a pair id or an own pair's id), used once */
  pick: string | null;
  /** the day the day's picture was last begun, and the day it was transformed */
  lastDay: string;
  dayDone: string;
  /** the rotation's position among the pairs */
  next: number;
  /** first-time explanations and story cards already given */
  seen: string[];
}

export function freshProgress(): RozProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, pictures: 0, shards: 0, best: 0, bestChain: 0, flares: 0, goldSeams: 0,
    album: {}, own: [], source: 'both', pick: null, lastDay: '', dayDone: '', next: 0, seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown): string => (typeof v === 'string' && DAY.test(v) ? v : '');
const PAIR_SET = new Set<string>(PAIR_IDS);
export const isPair = (id: string): id is PairId => PAIR_SET.has(id);

function readOwn(v: unknown): OwnPair | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id || typeof v.after !== 'string' || !v.after) return null;
  return {
    id: v.id, after: v.after, before: typeof v.before === 'string' && v.before ? v.before : null,
    label: str(v.label).slice(0, 40), added: Math.max(0, num(v.added)),
  };
}

function readAlbum(v: unknown): Record<string, AlbumEntry> {
  const out: Record<string, AlbumEntry> = {};
  if (!isObj(v)) return out;
  for (const [k, e] of Object.entries(v)) {
    if (!isObj(e) || int(e.n) < 1) continue;
    out[k] = { n: int(e.n), gold: Math.min(100, int(e.gold)), first: day(e.first), last: day(e.last) };
  }
  return out;
}

/**
 * Bring a loaded save to version 1, in place (idempotent).  The placeholder's save keeps its session
 * count; a version-1 save keeps everything, its types repaired.
 */
export function migrate(p: RozProgress): RozProgress {
  const raw = p as unknown as Record<string, unknown>;
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), keep);
    return p;
  }
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.pictures = int(raw.pictures);
  p.shards = int(raw.shards);
  p.best = int(raw.best);
  p.bestChain = int(raw.bestChain);
  p.flares = int(raw.flares);
  p.goldSeams = int(raw.goldSeams);
  p.album = readAlbum(raw.album);
  const own = Array.isArray(raw.own) ? raw.own.map(readOwn).filter((x): x is OwnPair => !!x) : [];
  p.own = own.filter((o, i) => own.findIndex(x => x.id === o.id) === i);
  p.source = raw.source === 'builtin' || raw.source === 'own' || raw.source === 'both' ? raw.source : 'both';
  p.pick = typeof raw.pick === 'string' && (isPair(raw.pick) || p.own.some(o => o.id === raw.pick)) ? raw.pick : null;
  p.lastDay = day(raw.lastDay);
  p.dayDone = day(raw.dayDone);
  p.next = int(raw.next);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [];
  return p;
}

// ── the tiles ────────────────────────────────────────────────────

/** How many tiles a picture has: by the sessions saved before this one, a little more for a session's later pictures. */
export function tilesFor(sessionsBefore: number, pictureInSession: number): number {
  const T = RULES.tiles;
  const base = T[Math.min(T.length - 1, Math.max(0, Math.floor(sessionsBefore)))];
  const L = RULES.tilesLater;
  return Math.min(RULES.tilesMax, base + L[Math.min(L.length - 1, Math.max(0, pictureInSession))]);
}

// ── the rotation ─────────────────────────────────────────────────

/** A picture to transform: one of the eight pairs, or one of the player's own. */
export type PicSrc = { kind: 'pair'; id: PairId } | { kind: 'own'; id: string };

export const srcKey = (s: PicSrc): string => s.id;
export const sameSrc = (a: PicSrc | null, b: PicSrc | null): boolean => !!a && !!b && a.kind === b.kind && a.id === b.id;

/** The day's picture: one of the eight, the same for everyone on a day. */
export const dayPair = (daySeed: number): PairId => PAIR_IDS[(Math.abs(Math.floor(daySeed)) >>> 0) % PAIR_IDS.length];

/** The pair transformed least so far (ties: in the rotation's order from its position), never `not`. */
export function leastPair(p: RozProgress, not: PairId | null = null): PairId {
  let best: PairId = PAIR_IDS[0], bestN = Infinity;
  for (let k = 0; k < PAIR_IDS.length; k++) {
    const id = PAIR_IDS[(p.next + k) % PAIR_IDS.length];
    if (id === not && PAIR_IDS.length > 1) continue;
    const n = p.album[id]?.n ?? 0;
    if (n < bestN) { best = id; bestN = n; }
  }
  return best;
}

export interface ChooseCtx {
  day: string;
  daySeed: number;
  /** own pairs whose pictures are loaded and ready to play */
  ownReady: readonly string[];
  /** pictures begun in this session so far */
  index: number;
  /** the picture just finished (not to repeat it at once) */
  prev: PicSrc | null;
}

/**
 * The next picture, and the rotation moved on (mutates `p`): the lobby's pick first; then, once a day,
 * the day's picture; then own pictures in turn with the pairs ("both": every second picture; "own":
 * all of them, the pairs only while none is ready); else the pair transformed least.
 */
export function choosePicture(p: RozProgress, c: ChooseCtx): PicSrc {
  const ready = p.own.filter(o => c.ownReady.includes(o.id));
  if (p.pick) {
    const pick = p.pick;
    p.pick = null;
    if (isPair(pick)) return { kind: 'pair', id: pick };
    if (ready.some(o => o.id === pick)) return { kind: 'own', id: pick };
  }
  const prevPair = c.prev?.kind === 'pair' ? c.prev.id : null;
  if (p.lastDay !== c.day && p.source !== 'own') {
    p.lastDay = c.day;
    const d = dayPair(c.daySeed);
    if (d !== prevPair) return { kind: 'pair', id: d };
  }
  const ownTurn = ready.length > 0 && (p.source === 'own' || (p.source === 'both' && c.index % 2 === 1));
  if (ownTurn) {
    // the own picture shown longest ago (least often in the album), never the one just finished
    const cands = ready.filter(o => !(c.prev?.kind === 'own' && c.prev.id === o.id) || ready.length === 1);
    cands.sort((a, b) => (p.album[a.id]?.n ?? 0) - (p.album[b.id]?.n ?? 0) || a.added - b.added);
    return { kind: 'own', id: cands[0].id };
  }
  const id = leastPair(p, prevPair);
  p.next = (PAIR_IDS.indexOf(id) + 1) % PAIR_IDS.length;
  return { kind: 'pair', id };
}

/** A picture transformed: its album entry (best gold with Math.max), the counts, the day's picture done. */
export function recordPicture(p: RozProgress, src: PicSrc, goldPct: number, today: string, daySeed: number): AlbumEntry {
  const key = srcKey(src);
  const e = p.album[key] ?? { n: 0, gold: 0, first: today, last: today };
  e.n += 1;
  e.gold = Math.max(e.gold, Math.min(100, Math.max(0, Math.round(goldPct))));
  e.first = e.first || today;
  e.last = today;
  p.album[key] = e;
  p.pictures += 1;
  if (src.kind === 'pair' && src.id === dayPair(daySeed)) p.dayDone = today;
  return e;
}

/** The pairs transformed at least once, of the eight. */
export const albumCount = (p: RozProgress): number => PAIR_IDS.filter(id => (p.album[id]?.n ?? 0) > 0).length;

/** The best session so far (null: never played). */
export const bestOf = (p: RozProgress): number | null => (p.sessions > 0 || p.best > 0 ? p.best : null);

// ── own pairs (the lobby's card) ─────────────────────────────────

/** Add a pair of own pictures (the files already kept by kit/images.ts). */
export function addOwn(p: RozProgress, pair: OwnPair): void {
  if (p.own.some(o => o.id === pair.id)) return;
  p.own.push({ ...pair, label: pair.label.slice(0, 40) });
}

/** Forget an own pair (the caller deletes its files); its album entry goes with it. */
export function removeOwn(p: RozProgress, id: string): OwnPair | null {
  const i = p.own.findIndex(o => o.id === id);
  if (i < 0) return null;
  const [gone] = p.own.splice(i, 1);
  delete p.album[id];
  if (p.pick === id) p.pick = null;
  return gone;
}
