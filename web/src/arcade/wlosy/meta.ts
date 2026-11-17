/**
 * What Każdy włos remembers between sessions, and the pure rules of its meta game (DESIGN.md §15):
 *
 *   the place       where the next session resumes: the meditation, its scene and how far the scene had grown
 *   the choice      the chosen meditation and the mode (in order · just this one · repeat)
 *   the colour      the player's hair colour (the melanocytes and every strand take it)
 *   the library     how many times each scene was grown by focus and each meditation completed
 *   records         the most hairs per session length, all the hairs ever ("all numbered"), the longest calm
 *   the music       the quiet tune in the background, on or off
 *
 * Version 1 from the start; any field of a wrong type is repaired rather than trusted.  No DOM, no randomness.
 */
import { COLOURS, MED, MEDS, MODES, SCENES, sceneCount, type HairColour, type MedId, type Mode, type SceneId } from './content';

export interface Pos { med: MedId; scene: number; g: number }

export interface WlosyProgress {
  ver: 1;
  /** sessions saved */
  sessions: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  mode: Mode;
  chosen: MedId;
  colour: HairColour;
  /** where the next session begins */
  pos: Pos;
  /** each scene: times grown by focus; each meditation: times completed */
  grown: Record<SceneId, number>;
  whole: Record<MedId, number>;
  /** the most hairs per session length (s), and all the hairs ever */
  best: Record<string, number>;
  hairs: number;
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

const zerosOf = <K extends string>(keys: readonly K[]): Record<K, number> => Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;

export function freshProgress(): WlosyProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, mode: 'order', chosen: 'krazenie', colour: 'brown', pos: { med: 'krazenie', scene: 0, g: 0 },
    grown: zerosOf(SCENES), whole: zerosOf(MEDS), best: {}, hairs: 0, abideBest: 0, abideAll: 0, song: true, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : d);

function counts<K extends string>(keys: readonly K[], v: unknown): Record<K, number> {
  const out = zerosOf(keys);
  if (isObj(v)) for (const k of keys) out[k] = int(v[k]);
  return out;
}

/** A saved place, repaired: a meditation that exists, a scene inside it, a growth in 0..1 (a whole scene starts again). */
export function cleanPos(v: unknown, fallback: MedId = 'krazenie'): Pos {
  if (!isObj(v)) return { med: fallback, scene: 0, g: 0 };
  const med = oneOf(MEDS, v.med, fallback);
  const scene = Math.min(sceneCount(med) - 1, int(v.scene));
  const g = Math.max(0, Math.min(1, num(v.g)));
  return { med, scene, g: g >= 1 ? 0 : g };
}

/** Bring a loaded save to version 1, in place (idempotent): every field of a wrong type is repaired. */
export function migrate(p: WlosyProgress): WlosyProgress {
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
  p.mode = oneOf(MODES, raw.mode, f.mode);
  p.chosen = oneOf(MEDS, raw.chosen, f.chosen);
  p.colour = oneOf(COLOURS, raw.colour, f.colour);
  p.pos = cleanPos(raw.pos, p.chosen);
  p.grown = counts(SCENES, raw.grown);
  p.whole = counts(MEDS, raw.whole);
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.hairs = int(raw.hairs);
  p.abideBest = Math.max(0, num(raw.abideBest));
  p.abideAll = Math.max(0, num(raw.abideAll));
  p.song = typeof raw.song === 'boolean' ? raw.song : f.song;
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [];
  p.lastLen = int(raw.lastLen);
  p.ver = 1;
  return p;
}

/** The most hairs of any session length (null: never played). */
export function bestOf(p: WlosyProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** How many of a meditation's scenes were ever grown by focus. */
export const scenesGrown = (p: WlosyProgress, med: MedId): number => MED[med].scenes.reduce((n, s) => n + ((p.grown[s] ?? 0) > 0 ? 1 : 0), 0);

/** How many meditations were completed at least once. */
export const medsDone = (p: WlosyProgress): number => MEDS.reduce((n, m) => n + ((p.whole[m] ?? 0) > 0 ? 1 : 0), 0);

/** Choose the mode (the lobby's card, the picker); false for an unknown value. */
export function setMode(p: WlosyProgress, mode: unknown): boolean {
  if (!(MODES as readonly unknown[]).includes(mode)) return false;
  p.mode = mode as Mode;
  return true;
}

/** Choose the hair colour; false for an unknown value. */
export function setColour(p: WlosyProgress, c: unknown): boolean {
  if (!(COLOURS as readonly unknown[]).includes(c)) return false;
  p.colour = c as HairColour;
  return true;
}

/**
 * Choose a meditation (the lobby's card): the next session begins at its first scene — or where it stopped, when it
 * is the meditation the saved place is already in.
 */
export function choose(p: WlosyProgress, med: unknown): boolean {
  if (!(MEDS as readonly unknown[]).includes(med)) return false;
  p.chosen = med as MedId;
  if (p.pos.med !== med) p.pos = { med: med as MedId, scene: 0, g: 0 };
  return true;
}

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: WlosyProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}
