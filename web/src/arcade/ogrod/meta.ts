/**
 * What Ogród o świcie remembers between sessions (DESIGN.md §23), and the pure rules of its meta:
 *
 *   records     the most flowers in one session, flowers in all, acts done with focus and acts the time finished by
 *               grace, ways walked to the dawn, stones let fall, sessions
 *   the way     the preparation (prep.ts `GardenPrep`, builder B's: the stations chosen and the player's words for
 *               each, repaired by its own `cleanPrep`) — own words and names only in this progress, on this device
 *               (§18.3 "names stay home"), never in a session's result; the unsent letter is never here (letter.ts)
 *   the week    what the last session left for the coming days (prep-panel.ts `Week`: the boundary, the friends to
 *               reach out to, the seeds to tend), shown in the lobby's card
 *   the breath  the settles' breath (kit/breath.ts): every rest of the way is whole breaths of it
 *   the heart   the 0–10 "how heavy is your heart" before (in the prep, cleared after the session) → after: a short
 *               history (the player's own sense, not a measurement)
 *
 * Anything broken becomes a fresh progress keeping only a session count; every field of a wrong type is repaired, never
 * trusted.  No DOM, no randomness.
 */
import { BREATH_PRESETS, cleanBreath, type BreathPattern } from '../kit/breath';
import { cleanPrep, cleanWeek, freshPrep, type GardenPrep } from './prep';
import type { Week } from './prep-panel';
import { RULES } from './rules';

/** One before → after: the day, the 0–10 before (null: not given) and after. */
export interface Weight { day: string; before: number | null; after: number }

export interface OgrodProgress {
  ver: 1;
  sessions: number;
  /** the most flowers in one session */
  best: number;
  /** all time: flowers, acts done with focus, acts finished by grace, ways walked to the dawn, stones let fall */
  flowers: number;
  acts: number;
  grace: number;
  ways: number;
  stones: number;
  /** the preparation (builder B's shapes): the way and the player's words */
  prep: GardenPrep;
  /** what the last session left for the week (null: nothing yet) */
  week: Week | null;
  breath: BreathPattern;
  history: Weight[];
  /** first-time explanations given */
  seen: string[];
  /** the last session's length (s): the lobby's guess before the length buttons are read */
  lastLen: number;
}

/** The meditation's breath: in 5, out 5 — six breaths a minute, even (the series' choice for a calm heart). */
export const BREATH_DEF: BreathPattern = BREATH_PRESETS.even;

export function freshProgress(): OgrodProgress {
  return {
    ver: 1, sessions: 0, best: 0, flowers: 0, acts: 0, grace: 0, ways: 0, stones: 0, prep: freshPrep(), week: null,
    breath: { ...BREATH_DEF }, history: [], seen: [], lastLen: 0,
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
export function migrate(p: OgrodProgress): OgrodProgress {
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
  p.flowers = int(raw.flowers);
  p.acts = int(raw.acts);
  p.grace = int(raw.grace);
  p.ways = int(raw.ways);
  p.stones = int(raw.stones);
  p.prep = cleanPrep(raw.prep);
  p.week = cleanWeek(raw.week);
  p.breath = cleanBreath(raw.breath);
  p.history = cleanHistory(raw.history);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))].slice(0, 40) : [];
  p.lastLen = int(raw.lastLen);
  // the letter is never kept: a save that carries one (it never should) loses it here
  delete raw.letter;
  return p;
}

/** The best so far (null: never played). */
export const bestOf = (p: OgrodProgress): number | null => (p.sessions > 0 ? p.best : null);

export function setBreath(p: OgrodProgress, b: BreathPattern): boolean {
  p.breath = cleanBreath(b);
  return true;
}

/** Record a session's after-rating (with the before it had), keeping the last `historyMax`. */
export function addWeight(p: OgrodProgress, day: string, before: number | null, after: number): void {
  const a = cleanWeight(after);
  if (a === null) return;
  p.history.push({ day: day.slice(0, 10), before: cleanWeight(before), after: a });
  if (p.history.length > RULES.historyMax) p.history.splice(0, p.history.length - RULES.historyMax);
}
