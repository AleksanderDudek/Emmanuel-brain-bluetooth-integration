/**
 * What a game of the health visualisations remembers between sessions, and the pure rules of its meta game (DESIGN.md
 * §24, Każdy włos's §15 generalised):
 *
 *   the place       where the next session resumes: the meditation, its scene and how far the scene had grown
 *   the choice      the chosen meditation and the mode (in order · just this one · repeat)
 *   the look        the player's look (HealthLibrary.looks: a skin tone…), '' for a game without looks
 *   the library     how many times each scene was grown by focus and each meditation completed
 *   records         the most units per session length, all the units ever, the longest calm
 *   the music       the quiet tune in the background, on or off
 *
 * Version 1 from the start; any field of a wrong type is repaired rather than trusted, against the library (a scene or
 * a meditation that no longer exists is dropped).  A save of another shape — the placeholder that loaded Każdy włos
 * before the game was wired — starts fresh but keeps its sessions and pushes.  No DOM, no randomness.
 */
import type { HealthLibrary } from './spec';
import { MODES, libOf, type Mode } from './lib';

export interface Pos { med: string; scene: number; g: number }

export interface HealthProgress {
  ver: 1;
  /** the library's id (a save of another game is not this one's) */
  game: string;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  mode: Mode;
  chosen: string;
  /** the look the player chose ('' when the game has none) */
  look: string;
  /** where the next session begins */
  pos: Pos;
  /** each scene: times grown by focus; each meditation: times completed */
  grown: Record<string, number>;
  whole: Record<string, number>;
  /** the most units per session length (s), and all the units ever */
  best: Record<string, number>;
  units: number;
  /** the longest calm in one stretch (s), and all the calm seconds ever */
  abideBest: number;
  abideAll: number;
  /** the quiet tune in the background */
  song: boolean;
  /** first-time explanations and story cards already given */
  seen: string[];
  /** the last session's planned length (s) */
  lastLen: number;
}

const zerosOf = (keys: readonly string[]): Record<string, number> => Object.fromEntries(keys.map(k => [k, 0]));

export function freshProgress(spec: HealthLibrary): HealthProgress {
  const lib = libOf(spec);
  const first = lib.meds[0];
  return {
    ver: 1, game: spec.id, sessions: 0, pushes: 0, mode: 'order', chosen: first, look: spec.looks[0] ?? '', pos: { med: first, scene: 0, g: 0 },
    grown: zerosOf(lib.scenes), whole: zerosOf(lib.meds), best: {}, units: 0, abideBest: 0, abideAll: 0, song: true, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : d);

function counts(keys: readonly string[], v: unknown): Record<string, number> {
  const out = zerosOf(keys);
  if (isObj(v)) for (const k of keys) out[k] = int(v[k]);
  return out;
}

/** A saved place, repaired: a meditation that exists, a scene inside it, a growth in 0..1 (a whole scene starts again). */
export function cleanPos(spec: HealthLibrary, v: unknown, fallback?: string): Pos {
  const lib = libOf(spec);
  const fb = fallback && lib.isMed(fallback) ? fallback : lib.meds[0];
  if (!isObj(v)) return { med: fb, scene: 0, g: 0 };
  const med = lib.isMed(v.med) ? v.med : fb;
  if (med !== v.med) return { med, scene: 0, g: 0 };
  const scene = Math.min(lib.sceneCount(med) - 1, int(v.scene));
  const g = Math.max(0, Math.min(1, num(v.g)));
  return { med, scene, g: g >= 1 ? 0 : g };
}

/** The keys a health save has; any other key means a save of another shape. */
const SHAPE = ['ver', 'game', 'sessions', 'pushes', 'mode', 'chosen', 'look', 'pos', 'grown', 'whole', 'best', 'units', 'abideBest', 'abideAll', 'song', 'seen', 'lastLen'];

/** Is this a save of another shape (another game's, the placeholder's, garbage)? */
export function foreignSave(spec: HealthLibrary, raw: Record<string, unknown>): boolean {
  if (raw.ver !== 1) return true;
  if (typeof raw.game === 'string' && raw.game !== spec.id) return true;
  return Object.keys(raw).some(k => !SHAPE.includes(k));
}

/** Bring a loaded save to version 1, in place (idempotent): every field of a wrong type is repaired against the library. */
export function migrate(p: HealthProgress, spec: HealthLibrary): HealthProgress {
  const lib = libOf(spec);
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress(spec);
  if (!isObj(raw)) return f;
  if (foreignSave(spec, raw)) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  p.game = spec.id;
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.mode = oneOf(MODES, raw.mode, f.mode);
  p.chosen = lib.isMed(raw.chosen) ? raw.chosen : f.chosen;
  p.look = oneOf(spec.looks, raw.look, f.look);
  p.pos = cleanPos(spec, raw.pos, p.chosen);
  p.grown = counts(lib.scenes, raw.grown);
  p.whole = counts(lib.meds, raw.whole);
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.units = int(raw.units);
  p.abideBest = Math.max(0, num(raw.abideBest));
  p.abideAll = Math.max(0, num(raw.abideAll));
  p.song = typeof raw.song === 'boolean' ? raw.song : f.song;
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [];
  p.lastLen = int(raw.lastLen);
  p.ver = 1;
  return p;
}

/** The most units of any session length (null: never played). */
export function bestOf(p: HealthProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** How many of a meditation's scenes were ever grown by focus. */
export const scenesGrown = (spec: HealthLibrary, p: HealthProgress, med: string): number =>
  libOf(spec).med(med).scenes.reduce((n, s) => n + ((p.grown[s] ?? 0) > 0 ? 1 : 0), 0);

/** How many meditations were completed at least once. */
export const medsDone = (spec: HealthLibrary, p: HealthProgress): number => libOf(spec).meds.reduce((n, m) => n + ((p.whole[m] ?? 0) > 0 ? 1 : 0), 0);

/** Choose the mode (the lobby's card, the picker); false for an unknown value. */
export function setMode(p: HealthProgress, mode: unknown): boolean {
  if (!(MODES as readonly unknown[]).includes(mode)) return false;
  p.mode = mode as Mode;
  return true;
}

/** Choose the look; false for one the library does not have. */
export function setLook(spec: HealthLibrary, p: HealthProgress, look: unknown): boolean {
  if (!(spec.looks as readonly unknown[]).includes(look)) return false;
  p.look = look as string;
  return true;
}

/**
 * Choose a meditation (the lobby's card): the next session begins at its first scene — or where it stopped, when it
 * is the meditation the saved place is already in.
 */
export function choose(spec: HealthLibrary, p: HealthProgress, med: unknown): boolean {
  const lib = libOf(spec);
  if (!lib.isMed(med)) return false;
  p.chosen = med;
  if (p.pos.med !== med) p.pos = { med, scene: 0, g: 0 };
  return true;
}

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: HealthProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}
