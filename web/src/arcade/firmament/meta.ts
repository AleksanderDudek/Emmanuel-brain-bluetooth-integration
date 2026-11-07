/**
 * What Firmament remembers between sessions and the pure rules of its meta game: the star on the saga
 * map the player stands at (the saga goes on across sessions; an attempt that runs out of moves
 * simply starts again), the best stars of every level (never fewer), the records per session length,
 * the Obserwacja blocks begun (every 4th is blind from the 3rd session), the tools the telescope gave
 * (up to two carried into the next session), the story cards seen and the things already explained.
 * No DOM, no randomness.
 *
 * Version 2 rebuilt the saga (eight stars a constellation, new levels): an older save keeps its
 * sessions, its points and its records, and starts the new map from its first star.
 */
import type { ToolKind } from './content';
import { RULES } from './rules';

export interface FirmamentProgress {
  ver: 2;
  /** sessions saved */
  sessions: number;
  /** points, all time */
  total: number;
  /** the level the player is on (0-based), and the best stars of every level played (index = level) */
  level: number;
  stars: number[];
  /** Obserwacja blocks begun, all time */
  pushes: number;
  /** tools from the telescope (all time), pulsars among them; the longest cascade; levels won */
  tools: number;
  pulsars: number;
  bestCascade: number;
  won: number;
  /** records: points per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** tools carried to the next session */
  kit: ToolKind[];
  /** constellations whose story card was shown; coach marks already given */
  story: number[];
  seen: string[];
}

export function freshProgress(): FirmamentProgress {
  return { ver: 2, sessions: 0, total: 0, level: 0, stars: [], pushes: 0, tools: 0, pulsars: 0, bestCascade: 0, won: 0, best: {}, lastLen: 0, kit: [], story: [], seen: [] };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const TOOLS: readonly ToolKind[] = ['hammer', 'ray', 'shuffle', 'moves', 'pulsar'];

/**
 * Bring a loaded progress to version 2, in place (idempotent).  A version-1 save (v: 1, ten levels a
 * constellation) keeps its sessions, points, pushes and records; its map starts over.  Fields of a
 * wrong type are reset rather than trusted.
 */
export function migrate(p: FirmamentProgress): FirmamentProgress {
  const raw = p as unknown as Record<string, unknown>;
  // a version-1 save carries `v: 1` (merged over fresh defaults it also shows `ver: 2`)
  const old = raw.ver !== 2 || 'v' in raw;
  const fresh = freshProgress();
  const best: Record<string, number> = {};
  if (raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)) {
    for (const [k, v] of Object.entries(raw.best as Record<string, unknown>)) if (num(v) > 0) best[k] = num(v);
  }
  const keep = {
    sessions: Math.max(0, Math.floor(num(raw.sessions))), total: Math.max(0, num(raw.total)), pushes: Math.max(0, Math.floor(num(raw.pushes))),
    best, lastLen: num(raw.lastLen), bestCascade: Math.max(0, Math.floor(num(raw.bestCascade))),
  };
  if (old) {
    for (const k of Object.keys(raw)) if (!(k in fresh)) delete raw[k];
    Object.assign(p, fresh, keep);
    return p;
  }
  Object.assign(p, keep);
  p.level = Math.max(0, Math.floor(num(raw.level)));
  p.stars = Array.isArray(raw.stars) ? (raw.stars as unknown[]).map(v => Math.max(0, Math.min(3, Math.floor(num(v))))) : [];
  p.tools = Math.max(0, Math.floor(num(raw.tools)));
  p.pulsars = Math.max(0, Math.floor(num(raw.pulsars)));
  p.won = Math.max(0, Math.floor(num(raw.won)));
  p.kit = Array.isArray(raw.kit) ? (raw.kit as unknown[]).filter((x): x is ToolKind => TOOLS.includes(x as ToolKind)).slice(0, RULES.carry) : [];
  p.story = Array.isArray(raw.story) ? (raw.story as unknown[]).filter((x): x is number => typeof x === 'number') : [];
  p.seen = Array.isArray(raw.seen) ? (raw.seen as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  return p;
}

/** A won level: its stars kept at their best (never fewer), the saga moved past it.  Returns the stars gained. */
export function winLevel(p: FirmamentProgress, index: number, stars: number): number {
  const before = p.stars[index] ?? 0;
  while (p.stars.length <= index) p.stars.push(0);
  p.stars[index] = Math.max(before, Math.min(3, Math.max(1, Math.round(stars))));
  p.level = Math.max(p.level, index + 1);
  return p.stars[index] - before;
}

export const starsTotal = (p: FirmamentProgress): number => p.stars.reduce((s, v) => s + (v > 0 ? v : 0), 0);

/** Stars on the levels of one constellation (perConst values, 0 = not won yet). */
export function constStars(p: FirmamentProgress, c: number): number[] {
  return Array.from({ length: RULES.perConst }, (_, k) => p.stars[c * RULES.perConst + k] ?? 0);
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: FirmamentProgress, plannedSec: number): number | null {
  const v = p.best?.[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: FirmamentProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best ?? {}).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
