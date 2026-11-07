/**
 * What Źródła remembers between sessions and the pure rules of its meta game: the road of the
 * Songs of Ascents (fifteen stations, Psalms 120–134, four valleys each, the last of each a garden),
 * the best stars per valley, the flowers the gardens bloomed, the records, and the coach marks
 * already shown.  Version 2 replaces the rotate-to-connect save of version 1 (its album, trees and
 * open valley): an old save keeps its best session and its session count, the rest starts over.
 * No DOM.
 */
import { RULES } from './rules';

export interface ZrodlaProgress {
  ver: 2;
  sessions: number;
  /** the best session (jars) */
  best: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** the furthest valley open on the road (0-based); the session starts there */
  valley: number;
  /** the best stars per valley (index = valley) */
  stars: number[];
  /** all-time: gardens in bloom, loops through a cross, valleys won */
  flowers: number;
  loops: number;
  won: number;
  /** records: the longest water way (cells), the best single valley (jars) */
  longest: number;
  bestValley: number;
  /** the coach marks already shown (keys) */
  seen: string[];
  lastDay: string;
}

export function freshProgress(): ZrodlaProgress {
  return {
    ver: 2, sessions: 0, best: 0, pushes: 0, valley: 0, stars: [], flowers: 0, loops: 0, won: 0, longest: 0, bestValley: 0, seen: [], lastDay: '',
  };
}

const num = (x: unknown, lo = 0): number => (typeof x === 'number' && Number.isFinite(x) && x >= lo ? x : lo);
const nums = (x: unknown): number[] => (Array.isArray(x) ? x.map(v => Math.max(0, Math.min(3, Math.round(num(v))))) : []);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(0, 64) : []);

/**
 * Bring a loaded save to version 2, in place (the runner saves this same object).  Version 1 (`v: 1`,
 * the rotate-to-connect valleys) keeps its best session and session count; every field of a wrong
 * type is reset.  Idempotent.
 */
export function migrate(p: ZrodlaProgress): ZrodlaProgress {
  const o = p as unknown as Record<string, unknown>;
  if (o.ver !== 2 || o.v !== undefined || 'roadIndex' in o || 'bestSession' in o) {
    const sessions = Math.floor(num(o.sessions));
    const best = Math.round(Math.max(num(o.best), num(o.bestSession)));
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, freshProgress(), { sessions, best });
    return p;
  }
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const k of ['sessions', 'best', 'pushes', 'valley', 'flowers', 'loops', 'won', 'longest', 'bestValley']) o[k] = Math.floor(num(o[k]));
  o.stars = nums(o.stars);
  o.seen = strs(o.seen);
  if (typeof o.lastDay !== 'string') o.lastDay = '';
  for (const k of Object.keys(f)) if (!(k in o)) o[k] = f[k];
  return p;
}

/** The best headline so far, for the lobby (null: never played); safe on an unmigrated save. */
export function bestOf(p: ZrodlaProgress): number | null {
  const o = p as unknown as Record<string, unknown>;
  if (num(o.sessions) <= 0) return null;
  return Math.round(Math.max(num(o.best), num(o.bestSession)));
}

/** Record a valley's stars (the best stays) and open the next one. */
export function recordValley(p: ZrodlaProgress, v: number, stars: number): void {
  while (p.stars.length <= v) p.stars.push(0);
  p.stars[v] = Math.max(p.stars[v] ?? 0, stars);
  if (stars > 0) p.valley = Math.max(p.valley, v + 1);
}

export const totalStars = (p: ZrodlaProgress): number => p.stars.reduce((s, x) => s + x, 0);

/** Stations passed (all four valleys won), of the road's fifteen. */
export const stationsDone = (p: ZrodlaProgress): number => Math.min(RULES.stations, Math.floor(p.valley / RULES.perStation));

/** The road is walked: the fifteenth station passed (the valleys go on by the road). */
export const roadDone = (p: ZrodlaProgress): boolean => p.valley >= RULES.stations * RULES.perStation;
