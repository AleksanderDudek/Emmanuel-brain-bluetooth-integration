/**
 * What Z głowy do serca remembers between sessions (only on this device), and the pure rules of its meta game:
 *
 *   the circles   up to 8 names or initials (≤ 24 characters each, plain text) for each of rings 1–4: they appear by
 *                 the lamps of their ring; empty is fine (the lamps are then unnamed)
 *   the heart word  the Jesus Prayer (default), "Jezu", "Abba, Ojcze", "Maranatha", or own words (≤ 60 characters)
 *   ring 4 today  "leave it out today": the day it was set (it is in again from tomorrow)
 *   the breath    the rests' breath (kit/breath.ts), 5 · 5 by default (heart-focused breathing, six a minute)
 *   where it goes on  the ring the last session stopped at (`pos`): the next walks the head to the heart and the field,
 *                 then goes on from that ring; a whole way clears it, and the card can start from the beginning
 *   records       the best lights per session length, all the lights ever, whole ways, the furthest ring reached
 *
 * Version 1 (round 13).  The placeholder's save (`{ best }`) and anything broken are repaired field by field: a
 * wrong type is reset rather than trusted.  No DOM, no randomness.
 */
import { BREATH_PRESETS, breathOk, cleanBreath, type BreathPattern } from '../kit/breath';
import { RINGS, WORDS, cleanName, cleanOwn, type Ring, type WordId } from './content';
import { RULES } from './rules';

export interface SerceProgress {
  ver: 1;
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
  /** where the circles go on next session (null: from the first ring) */
  pos: { ring: Ring } | null;
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
    ver: 1, sessions: 0, pushes: 0, best: {}, lights: 0, ways: 0, reach: -1, pos: null, names: [[], [], [], []], word: 'jesus', own: '', skip4: '',
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

/** Bring a loaded save to version 1, in place (idempotent): every field of a wrong type is repaired. */
export function migrate(p: SerceProgress): SerceProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (/^\d+$/.test(k) && num(v, -1) >= 0) best[k] = Math.floor(num(v));
  p.ver = 1;
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.best = best;
  p.lights = int(raw.lights);
  p.ways = int(raw.ways);
  p.reach = Math.min(5, int(raw.reach, -1, -1));
  const pos = raw.pos;
  p.pos = isObj(pos) && (RINGS as readonly unknown[]).includes(pos.ring) ? { ring: pos.ring as Ring } : null;
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

/** The ring the circles go on from (1 when there is nowhere to go on from). */
export const startRing = (p: SerceProgress): Ring => p.pos?.ring ?? 1;

export function clearStart(p: SerceProgress): void { p.pos = null; }

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
