/**
 * What Złote serce remembers between sessions (DESIGN.md §21), and the pure rules of its meta:
 *
 *   records     the most seams gilded in one session, seams gilded and pieces gathered in all (with care, by grace),
 *               golden hearts (sessions with every seam gilded), sessions
 *   Co boli?    the words written on the pieces: a gentle themed set, the player's own words, or none — own words are
 *               kept only in this progress on this device (§18.3 "names stay home"), never in a session's result
 *   the breath  the rests' breath (kit/breath.ts): washing, the beat and the radiance are whole breaths of it
 *   how it hurts the 0–10 the player gave in the lobby for the next session, and a short history of before → after
 *               (the player's own sense, not a measurement)
 *   the music   builder B's MusicPrefs (music/index.ts), repaired by its own `cleanMusic`
 *
 * Anything broken becomes a fresh progress keeping only a session count; every field of a wrong type is repaired, never
 * trusted.  No DOM, no randomness.
 */
import { BREATH_PRESETS, cleanBreath, type BreathPattern } from '../kit/breath';
import { cleanWords, isWordChoice, type WordChoice } from './content';
import { cleanMusic, freshMusic, type MusicPrefs } from './music/index';
import { RULES } from './rules';

/** One before → after: the day, the 0–10 before (null: not given) and after. */
export interface Weight { day: string; before: number | null; after: number }

export interface KintsugiProgress {
  ver: 1;
  sessions: number;
  /** the most seams gilded in one session */
  best: number;
  /** all time: seams gilded, pieces gathered with the player's focus, pieces gathered by grace, hearts gilded whole */
  seams: number;
  pieces: number;
  grace: number;
  golden: number;
  /** "Co boli?": a themed set, own words, or none */
  words: WordChoice;
  /** the player's own words (≤ 14, each ≤ 24 characters), only on this device */
  own: string[];
  breath: BreathPattern;
  /** the 0–10 given in the lobby for the next session (null: none), and the history of before → after */
  before: number | null;
  history: Weight[];
  music: MusicPrefs;
  /** first-time explanations given */
  seen: string[];
  /** the last session's length (s): the lobby's guess before the length buttons are read */
  lastLen: number;
}

/** The meditation's default breath: in 5, out 5 — six breaths a minute, even (the series' choice for a calm heart). */
export const BREATH_DEF: BreathPattern = BREATH_PRESETS.even;

export function freshProgress(): KintsugiProgress {
  return {
    ver: 1, sessions: 0, best: 0, seams: 0, pieces: 0, grace: 0, golden: 0, words: 'heart', own: [], breath: { ...BREATH_DEF },
    before: null, history: [], music: freshMusic(), seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** A 0–10 rating, or null. */
export const cleanWeight = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : null);

function cleanHistory(v: unknown): Weight[] {
  if (!Array.isArray(v)) return [];
  const out: Weight[] = [];
  for (const x of v) {
    if (!isObj(x)) continue;
    const after = cleanWeight(x.after);
    if (after === null) continue;
    out.push({ day: typeof x.day === 'string' ? x.day.slice(0, 10) : '', before: cleanWeight(x.before), after });
  }
  return out.slice(-RULES.historyMax);
}

/** Bring a loaded save to version 1, in place (idempotent): every field repaired; a broken save keeps its session count. */
export function migrate(p: KintsugiProgress): KintsugiProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const sessions = int(raw.sessions);
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, { sessions });
    return p;
  }
  p.sessions = int(raw.sessions);
  p.best = int(raw.best);
  p.seams = int(raw.seams);
  p.pieces = int(raw.pieces);
  p.grace = int(raw.grace);
  p.golden = int(raw.golden);
  p.words = isWordChoice(raw.words) ? raw.words : f.words;
  p.own = cleanWords(raw.own);
  p.breath = cleanBreath(raw.breath);
  p.before = cleanWeight(raw.before);
  p.history = cleanHistory(raw.history);
  p.music = cleanMusic(raw.music);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))].slice(0, 40) : [];
  p.lastLen = int(raw.lastLen);
  return p;
}

/** The best so far (null: never played). */
export const bestOf = (p: KintsugiProgress): number | null => (p.sessions > 0 ? p.best : null);

/** The words for the pieces: a themed set, own words, or none (own words chosen but none written: none). */
export const wordsOn = (p: KintsugiProgress): boolean => p.words !== 'none' && (p.words !== 'own' || p.own.length > 0);

export function setWords(p: KintsugiProgress, w: WordChoice): void {
  if (isWordChoice(w)) p.words = w;
}

/** The player's own words from a typed line (commas between them): kept clean, ≤ 14. */
export function setOwn(p: KintsugiProgress, line: string): void {
  p.own = cleanWords(line);
}

export function forgetOwn(p: KintsugiProgress): void {
  p.own = [];
  if (p.words === 'own') p.words = 'heart';
}

export function setBreath(p: KintsugiProgress, b: BreathPattern): boolean {
  const c = cleanBreath(b);
  p.breath = c;
  return true;
}

export function setBefore(p: KintsugiProgress, v: number | null): void {
  p.before = v === null ? null : cleanWeight(v);
}

/** Record a session's after-rating (with the before it had), keeping the last `historyMax`. */
export function addWeight(p: KintsugiProgress, day: string, before: number | null, after: number): void {
  const a = cleanWeight(after);
  if (a === null) return;
  p.history.push({ day: day.slice(0, 10), before: cleanWeight(before), after: a });
  if (p.history.length > RULES.historyMax) p.history.splice(0, p.history.length - RULES.historyMax);
}
