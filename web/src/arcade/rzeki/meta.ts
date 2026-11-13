/**
 * What Rzeki żywej wody remembers between sessions, and the pure rules of its meta game:
 *
 *   the way         down, up, or down and then up (the lobby's card chooses; both by default)
 *   own words       the player's own words of prayer (≤ 120 characters, plain text), shown at every place
 *                   instead of the built-in prayer; kept only in this device's progress
 *   the map         how many times each place was lit going down and thanked going up — the figure in the
 *                   lobby shows the places lit across sessions
 *   records         the best drops per session length, the full ways down and up, the longest calm abiding
 *                   in one stretch, all the drops and the abiding seconds ever
 *   the chorale     the quiet chorale in the background, on or off
 *
 * Version 1 from the start.  The placeholder's save (`{ ver: 1, sessions: n }`) keeps its count and gets
 * everything else fresh; any field of a wrong type is reset rather than trusted.  No DOM, no randomness.
 */
import { PLACES, WAYS, cleanOwn, windowTier, type Dir, type PlaceId, type Tier, type Way } from './content';

export interface RzekiProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** the way a session walks */
  way: Way;
  /** the player's own words ('' = the prayer of each place) */
  own: string;
  /** each place: times lit going down, and thanked going up */
  down: Record<PlaceId, number>;
  up: Record<PlaceId, number>;
  /** whole ways walked, all time */
  descents: number;
  ascents: number;
  /** the best drops per session length (s) */
  best: Record<string, number>;
  /** all the drops ever gathered */
  drops: number;
  /** the longest calm abiding in one stretch (s), and all the abiding seconds ever */
  abideBest: number;
  abideAll: number;
  /** the quiet chorale in the background */
  song: boolean;
  /** first-time explanations and story cards already given */
  seen: string[];
  /** the last session's planned length (s) */
  lastLen: number;
}

const zeros = (): Record<PlaceId, number> => Object.fromEntries(PLACES.map(p => [p, 0])) as Record<PlaceId, number>;

export function freshProgress(): RzekiProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, way: 'both', own: '', down: zeros(), up: zeros(), descents: 0, ascents: 0, best: {}, drops: 0,
    abideBest: 0, abideAll: 0, song: true, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function counts(v: unknown): Record<PlaceId, number> {
  const out = zeros();
  if (isObj(v)) for (const p of PLACES) out[p] = int(v[p]);
  return out;
}

/**
 * Bring a loaded save to version 1, in place (idempotent).  The placeholder's save and any older or broken
 * one keep their session count; every field of a wrong type is repaired.
 */
export function migrate(p: RzekiProgress): RzekiProgress {
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
  p.way = (WAYS as readonly unknown[]).includes(raw.way) ? (raw.way as Way) : f.way;
  p.own = cleanOwn(raw.own);
  p.down = counts(raw.down);
  p.up = counts(raw.up);
  p.descents = int(raw.descents);
  p.ascents = int(raw.ascents);
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.drops = int(raw.drops);
  p.abideBest = Math.max(0, num(raw.abideBest));
  p.abideAll = Math.max(0, num(raw.abideAll));
  p.song = typeof raw.song === 'boolean' ? raw.song : f.song;
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [];
  p.lastLen = int(raw.lastLen);
  p.ver = 1;
  return p;
}

/** The best drops of any session length (null: never played). */
export function bestOf(p: RzekiProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** How many times a place was lit (both ways together). */
export const timesLit = (p: RzekiProgress, place: PlaceId): number => (p.down[place] ?? 0) + (p.up[place] ?? 0);

/** The craft of a place's window from the times it was lit (0 plain … 3 golden tracery). */
export const tierOf = (p: RzekiProgress, place: PlaceId): Tier => windowTier(timesLit(p, place));

/** How many of the seven places were ever lit. */
export const placesLit = (p: RzekiProgress): number => PLACES.reduce((n, pl) => n + (timesLit(p, pl) > 0 ? 1 : 0), 0);

/** A place's glow on the lobby's figure (0 never lit … 1 lit often): it grows with the times, softly. */
export const mapGlow = (p: RzekiProgress, place: PlaceId): number => {
  const n = timesLit(p, place);
  return n <= 0 ? 0 : Math.min(1, 0.35 + 0.65 * (1 - Math.exp(-n / 6)));
};

/** Count a place lit on a way (the session's tally reaches the progress once, at its end). */
export function countPlace(p: RzekiProgress, place: PlaceId, dir: Dir, n = 1): void {
  const rec = dir === 'down' ? p.down : p.up;
  rec[place] = (rec[place] ?? 0) + Math.max(0, Math.floor(n));
}

/** Choose the way (the lobby's card); false for an unknown value. */
export function setWay(p: RzekiProgress, way: unknown): boolean {
  if (!(WAYS as readonly unknown[]).includes(way)) return false;
  p.way = way as Way;
  return true;
}

/** Keep the player's own words (cleaned: plain text, ≤ 120 characters; '' goes back to the prayer). */
export function setOwn(p: RzekiProgress, words: unknown): string {
  p.own = cleanOwn(words);
  return p.own;
}

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: RzekiProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}
