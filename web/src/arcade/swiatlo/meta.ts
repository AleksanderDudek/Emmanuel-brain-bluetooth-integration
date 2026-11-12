/**
 * What Światło ciała remembers between sessions, and the pure rules of its meta game:
 *
 *   the body map   every organ at three depths (organs, cells, systems), lit with its best rating
 *                  (1 soft, 2 bright, 3 golden) — the figure in the lobby fills with light over sessions
 *   Wiedza         the knowledge cards met (one per organ and depth, each with a real number and its source)
 *   depths         the deepest depth opened: a whole scan opens the next one (organs → cells → systems)
 *   records        the best lux per session length, full scans, golden organs, the most golden in one scan,
 *                  the fastest whole scan, breaths in rhythm, whether a real pulse was ever seen
 *   the song       the lullaby in the background, on or off (the lobby's card switches it)
 *
 * Version 1 from the start.  The placeholder's save (`{ ver: 1, sessions: n }`) keeps its count and gets
 * everything else fresh; any field of a wrong type is reset rather than trusted.  No DOM, no randomness.
 */
import { ALL_CARDS, DEPTHS, ORGANS, cardId, type Depth, type OrganId } from './content';

export interface SwiatloProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** whole scans, all time */
  scans: number;
  /** the body map: "organ:depth" → the best rating (1 soft, 2 bright, 3 golden) */
  map: Record<string, number>;
  /** the Wiedza cards met ("organ:depth") */
  cards: string[];
  /** the deepest depth opened (1..3) */
  depth: number;
  /** the best lux per session length (s) */
  best: Record<string, number>;
  /** organs settled and golden ones, all time */
  balanced: number;
  golden: number;
  /** the most golden organs in one scan, and the fastest whole scan (s; 0 = none yet) */
  bestScan: number;
  fastest: number;
  /** breaths tapped with the guide, all time */
  breaths: number;
  /** a real pulse (Mendi) was seen at least once */
  pulseSeen: boolean;
  /** the lullaby in the background */
  song: boolean;
  /** first-time explanations and story cards already given */
  seen: string[];
  /** the last session's planned length (s) */
  lastLen: number;
}

export function freshProgress(): SwiatloProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, scans: 0, map: {}, cards: [], depth: 1, best: {}, balanced: 0, golden: 0, bestScan: 0, fastest: 0,
    breaths: 0, pulseSeen: false, song: true, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const CARD_SET = new Set<string>(ALL_CARDS);

/**
 * Bring a loaded save to version 1, in place (idempotent).  The placeholder's save and any older or
 * broken one keep their session count; every field of a wrong type is repaired.
 */
export function migrate(p: SwiatloProgress): SwiatloProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.scans = int(raw.scans);
  const map: Record<string, number> = {};
  if (isObj(raw.map)) for (const [k, v] of Object.entries(raw.map)) if (CARD_SET.has(k) && num(v) >= 1) map[k] = Math.min(3, Math.floor(num(v)));
  p.map = map;
  p.cards = Array.isArray(raw.cards) ? [...new Set(raw.cards.filter((c): c is string => typeof c === 'string' && CARD_SET.has(c)))] : [];
  p.depth = Math.min(3, int(raw.depth, 1, 1));
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.balanced = int(raw.balanced);
  p.golden = int(raw.golden);
  p.bestScan = Math.min(ORGANS.length, int(raw.bestScan));
  p.fastest = Math.max(0, num(raw.fastest));
  p.breaths = int(raw.breaths);
  p.pulseSeen = raw.pulseSeen === true;
  p.song = typeof raw.song === 'boolean' ? raw.song : f.song;
  p.seen = Array.isArray(raw.seen) ? raw.seen.filter((s): s is string => typeof s === 'string') : [];
  p.lastLen = int(raw.lastLen);
  p.ver = 1;
  return p;
}

/** The best lux of any session length (null: never played). */
export function bestOf(p: SwiatloProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** The map's rating of an organ at a depth (0 = dark). */
export const mapRating = (p: SwiatloProgress, o: OrganId, d: Depth): number => p.map[cardId(o, d)] ?? 0;

/** How much of the map is lit (0..27), and how much of it is golden. */
export function mapLit(p: SwiatloProgress): { lit: number; golden: number; all: number } {
  let lit = 0, golden = 0;
  for (const id of ALL_CARDS) {
    const r = p.map[id] ?? 0;
    if (r > 0) lit++;
    if (r >= 3) golden++;
  }
  return { lit, golden, all: ALL_CARDS.length };
}

/** Light an organ on the map (keeps the best rating); true when it was dark before. */
export function lightMap(p: SwiatloProgress, o: OrganId, d: Depth, rating: number): boolean {
  const id = cardId(o, d);
  const was = p.map[id] ?? 0;
  p.map[id] = Math.max(was, Math.min(3, Math.max(1, Math.floor(rating))));
  return was === 0;
}

/** Meet a Wiedza card; true when it is new. */
export function meetCard(p: SwiatloProgress, o: OrganId, d: Depth): boolean {
  const id = cardId(o, d);
  if (p.cards.includes(id)) return false;
  p.cards.push(id);
  return true;
}

/**
 * The depth a scan runs at: the session's first scan at the shallowest opened depth that still has dark
 * organs on the map (or the deepest opened one when the map is whole), each later scan of the session one
 * deeper while the depths allow — "later scans go deeper".
 */
export function scanDepth(p: SwiatloProgress, scanInSession: number): Depth {
  const open = Math.min(3, Math.max(1, p.depth)) as Depth;
  let first: Depth = open;
  for (const d of DEPTHS) {
    if (d > open) break;
    if (ORGANS.some(o => mapRating(p, o, d) === 0)) { first = d; break; }
  }
  const k = Math.max(1, Math.floor(scanInSession)) - 1;
  return Math.min(open, first + k) as Depth;
}

/** A whole scan at depth `d`: the next depth opens (organs → cells → systems); true when it did. */
export function openDeeper(p: SwiatloProgress, d: Depth): boolean {
  if (d >= 3 || p.depth > d) return false;
  p.depth = d + 1;
  return true;
}

/** Stars for a whole scan by its golden organs: ★ whole, ★★ from 4 golden, ★★★ from 7. */
export const scanStars = (golden: number): number => (golden >= 7 ? 3 : golden >= 4 ? 2 : 1);

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: SwiatloProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}
