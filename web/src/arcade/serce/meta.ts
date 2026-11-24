/**
 * What Z głowy do serca remembers between sessions (only on this device), and the pure rules of its meta game:
 *
 *   the circles   up to 8 names or initials (≤ 24 characters each, plain text) for each of rings 1–4: they appear by
 *                 the lamps of their ring; empty is fine (the lamps are then unnamed)
 *   the heart word  the Jesus Prayer (default), "Jezu", "Abba, Ojcze", "Maranatha", or own words (≤ 60 characters)
 *   ring 4 today  "leave it out today": the day it was set (it is in again from tomorrow)
 *   the breath    the rests' breath (kit/breath.ts), 5 · 5 by default (heart-focused breathing, six a minute)
 *   the stages    (round 16) the stage length the player chose (2:00–4:00, 3:00 by default) and where the way goes on:
 *                 `next`, the stage (0–8 of the nine) the next session starts at — after a short re-entry — or 0 for
 *                 the start; a whole way clears it, and the card lets the player pick any stage
 *   records       the best lights per session length, all the lights ever, whole ways, stages walked, the furthest
 *                 ring reached
 *
 * Version 2 (round 16; version 1 was round 13).  A version-1 save keeps everything; its `pos` (the ring the circles
 * went on from) becomes `next`, that ring's stage.  The placeholder's save (`{ best }`) and anything broken are repaired
 * field by field: a wrong type is reset rather than trusted.  No DOM, no randomness.
 */
import { BREATH_PRESETS, breathOk, cleanBreath, type BreathPattern } from '../kit/breath';
import { RINGS, WAY_LEN, WORDS, cleanName, cleanOwn, ringIndex, type Ring, type WordId } from './content';
import { RULES, cleanStageSec } from './rules';

export interface SerceProgress {
  ver: 2;
  sessions: number;
  /** push blocks begun, all time */
  pushes: number;
  /** the best lights per session length (s) */
  best: Record<string, number>;
  /** all the lights ever kindled */
  lights: number;
  /** whole ways walked (head → heart → the world → back into the heart) */
  ways: number;
  /** the furthest ring ever reached (0: the field round the figure; −1: never) */
  reach: number;
  /** the stage (0–8) the next session goes on from (0: the way from the start) */
  next: number;
  /** each stage's least length (s): 120–240 by 30 */
  stageSec: number;
  /** stages walked, all time */
  stages: number;
  /** names for rings 1–4 (index 0 = ring 1) */
  names: string[][];
  word: WordId;
  own: string;
  /** the day ring 4 was left out ('' = in) */
  skip4: string;
  breath: BreathPattern;
  /** first-time explanations and cards already given */
  seen: string[];
  lastLen: number;
}

export function freshProgress(): SerceProgress {
  return {
    ver: 2, sessions: 0, pushes: 0, best: {}, lights: 0, ways: 0, reach: -1, next: 0, stageSec: RULES.stageDef, stages: 0,
    names: [[], [], [], []], word: 'jesus', own: '', skip4: '',
    breath: { ...BREATH_PRESETS.even }, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function cleanNames(v: unknown): string[][] {
  const out: string[][] = [[], [], [], []];
  if (!Array.isArray(v)) return out;
  for (let i = 0; i < 4; i++) {
    const list = v[i];
    if (Array.isArray(list)) out[i] = list.map(cleanName).filter(Boolean).slice(0, RULES.namesMax);
  }
  return out;
}

/** Bring a loaded save to version 2, in place (idempotent): every field of a wrong type is repaired. */
export function migrate(p: SerceProgress): SerceProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (/^\d+$/.test(k) && num(v, -1) >= 0) best[k] = Math.floor(num(v));
  p.ver = 2;
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.best = best;
  p.lights = int(raw.lights);
  p.ways = int(raw.ways);
  p.reach = Math.min(5, int(raw.reach, -1, -1));
  // round 16: where the way goes on is a stage; a version-1 save's ring (`pos`) is that ring's stage. `pos` wins:
  // the kit merges a save over freshProgress() (next: 0) before this runs, so a round-15 save always arrives with a
  // `next`, and only a version-1 save still carries `pos` (this deletes it)
  const pos = raw.pos;
  const next = typeof raw.next === 'number' && Number.isFinite(raw.next) ? Math.floor(raw.next) : null;
  p.next = isObj(pos) && (RINGS as readonly unknown[]).includes(pos.ring) ? ringIndex(pos.ring as Ring)
    : next !== null && next >= 0 && next < WAY_LEN ? next : 0;
  delete (raw as { [k: string]: unknown }).pos;
  p.stageSec = cleanStageSec(raw.stageSec);
  p.stages = int(raw.stages);
  p.names = cleanNames(raw.names);
  p.word = (WORDS as readonly unknown[]).includes(raw.word) ? (raw.word as WordId) : f.word;
  p.own = cleanOwn(raw.own);
  p.skip4 = typeof raw.skip4 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.skip4) ? raw.skip4 : '';
  p.breath = isObj(raw.breath) ? cleanBreath(raw.breath) : f.breath;
  if (!breathOk(p.breath)) p.breath = f.breath;
  p.seen = Array.isArray(raw.seen) ? raw.seen.filter((s): s is string => typeof s === 'string').slice(0, 200) : [];
  p.lastLen = int(raw.lastLen);
  // the placeholder's own field: nothing else to keep
  delete (raw as { [k: string]: unknown }).placeholder;
  return p;
}

/** The best lights of any length (null: never played). */
export function bestOf(p: SerceProgress): number | null {
  const v = Object.values(p.best);
  return v.length ? Math.max(...v) : null;
}

/** The key a session length's record is kept under. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** Mark a first-time explanation as given; true when it was new. */
export function markSeen(p: SerceProgress, key: string): boolean {
  if (p.seen.includes(key)) return false;
  p.seen.push(key);
  return true;
}

/** Ring 4 is left out today. */
export const skip4Today = (p: SerceProgress, day: string): boolean => p.skip4 === day;

export function setSkip4(p: SerceProgress, day: string, skip: boolean): void {
  p.skip4 = skip ? day : '';
}

/** The stage the next session goes on from (0: the way from the start). */
export const startStage = (p: SerceProgress): number => (p.next >= 0 && p.next < WAY_LEN ? Math.floor(p.next) : 0);

/** The next session starts at this stage (0–8; 0 = from the start). */
export function setStart(p: SerceProgress, i: number): void {
  p.next = Math.max(0, Math.min(WAY_LEN - 1, Math.floor(Number.isFinite(i) ? i : 0)));
}

export function clearStart(p: SerceProgress): void { p.next = 0; }

/** Each stage's least length (s): one of the lobby's choices. */
export function setStageSec(p: SerceProgress, sec: number): void { p.stageSec = cleanStageSec(sec); }

/** The names of a ring (1–4); ring 5 has none. */
export const namesOf = (p: SerceProgress, r: Ring): readonly string[] => (r <= 4 ? p.names[r - 1] ?? [] : []);

/** Set a ring's names from a text (comma- or line-separated); returns the names kept. */
export function setNames(p: SerceProgress, r: Ring, text: string): string[] {
  if (r > 4) return [];
  const list = text.split(/[,\n;]+/).map(cleanName).filter(Boolean).slice(0, RULES.namesMax);
  p.names[r - 1] = list;
  return list;
}

/** All the names written, across rings 1–4. */
export const namesCount = (p: SerceProgress): number => p.names.reduce((n, l) => n + l.length, 0);

export function setWord(p: SerceProgress, w: WordId): void { p.word = w; }
export function setOwn(p: SerceProgress, v: string): void { p.own = cleanOwn(v); }

/** Set the rests' breath; a pattern whose whole breath is under 2 s is refused (false). */
export function setBreath(p: SerceProgress, b: BreathPattern): boolean {
  if (!breathOk(b)) return false;
  p.breath = cleanBreath(b);
  return true;
}
