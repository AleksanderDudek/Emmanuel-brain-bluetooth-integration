/**
 * What Każda myśl remembers between sessions, and the pure rules of its meta game:
 *
 *   what weighs     the emotion chosen for today (I do not know — all; fear; sadness; anger; the mixtures) and the
 *                   areas of life (none chosen: all eight)
 *   own thoughts    up to 8 of the player's own, ≤ 80 characters each, each with its emotion — kept only in this
 *                   game's progress on this device (DESIGN §18.3 "names stay home"), never in a session's result;
 *                   they come first; "forget after burning" removes each one once it has burned
 *   the library     the thoughts burned last time (they go to the back next time), the ones set aside as "not mine"
 *   the breath      the rest's breath (kit/breath.ts), one of the presets; rests are whole breaths of it
 *   how heavy       the 0–10 the player gave before the next session (the lobby), and a short history of before → after
 *   records         thoughts burned (all, by emotion, own), the most in one session per length, sessions, push blocks
 *                   (every 4th blind from the 3rd session), the longest calm, the first-time explanations given
 *
 * Version 1.  The placeholder's save (`{ best: null }`) and anything broken become a fresh progress keeping only a
 * session count; every field of a wrong type is repaired, never trusted.  No DOM, no randomness.
 */
import { BREATH_DEFAULT, cleanBreath, type BreathPattern } from '../kit/breath';
import {
  AREAS, CHOICES, EMOS, OWN_MAX, cleanOwnList, cleanText, thoughtById, type AreaId, type Emo, type EmoChoice, type OwnEmo, type OwnThought,
} from './content';
import { RULES } from './rules';

/** One before → after: the day, the 0–10 before (null: not given) and after. */
export interface Weight { day: string; before: number | null; after: number }

export interface MysliProgress {
  ver: 1;
  sessions: number;
  pushes: number;
  emotion: EmoChoice;
  /** the areas chosen (empty: all) */
  areas: AreaId[];
  own: OwnThought[];
  forgetBurned: boolean;
  breath: BreathPattern;
  /** library ids burned last session (they go last next time), and the ones set aside as "not mine" */
  recent: string[];
  skipped: string[];
  /** thoughts burned, all time: in all, by their strongest emotion, the player's own */
  burned: number;
  byEmo: Record<Emo, number>;
  ownBurned: number;
  /** the most thoughts burned in one session, per session length (s, rounded to 30) */
  best: Record<string, number>;
  /** the 0–10 given in the lobby for the next session (null: none) */
  before: number | null;
  history: Weight[];
  /** the longest calm in one stretch of a rest (s), the longest quiet held (s) */
  calmBest: number;
  quietBest: number;
  seen: string[];
  lastLen: number;
}

const zeroEmo = (): Record<Emo, number> => ({ fear: 0, sadness: 0, anger: 0 });

export function freshProgress(): MysliProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, emotion: 'unknown', areas: [], own: [], forgetBurned: false, breath: { ...BREATH_DEFAULT },
    recent: [], skipped: [], burned: 0, byEmo: zeroEmo(), ownBurned: 0, best: {}, before: null, history: [], calmBest: 0, quietBest: 0,
    seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** A 0–10 weight, or null. */
export const cleanWeight = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : null);
const ids = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && !!thoughtById(s)))].slice(-max) : [];

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

/** Bring a loaded save to version 1, in place (idempotent); the placeholder's or a broken save keeps its session count. */
export function migrate(p: MysliProgress): MysliProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  const byEmo = zeroEmo();
  if (isObj(raw.byEmo)) for (const e of EMOS) byEmo[e] = int(raw.byEmo[e]);
  const fields: MysliProgress = {
    ver: 1,
    sessions: int(raw.sessions),
    pushes: int(raw.pushes),
    emotion: (CHOICES as readonly unknown[]).includes(raw.emotion) ? (raw.emotion as EmoChoice) : f.emotion,
    areas: Array.isArray(raw.areas) ? AREAS.filter(a => (raw.areas as unknown[]).includes(a)) : [],
    own: cleanOwnList(raw.own),
    forgetBurned: raw.forgetBurned === true,
    breath: { ...cleanBreath(raw.breath) },
    recent: ids(raw.recent, RULES.recentMax),
    skipped: ids(raw.skipped, RULES.skipMax),
    burned: int(raw.burned),
    byEmo,
    ownBurned: int(raw.ownBurned),
    best: {},
    before: cleanWeight(raw.before),
    history: cleanHistory(raw.history),
    calmBest: Math.max(0, num(raw.calmBest)),
    quietBest: Math.max(0, num(raw.quietBest)),
    seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [],
    lastLen: int(raw.lastLen),
  };
  // every area chosen is the same as none chosen: all
  if (fields.areas.length === AREAS.length) fields.areas = [];
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) fields.best[k] = Math.floor(num(v));
  for (const k of Object.keys(raw)) delete raw[k];
  Object.assign(p, fields);
  return p;
}

/** The most thoughts burned in a session of any length (null: never one). */
export function bestOf(p: MysliProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: MysliProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}

export const breathOf = (p: MysliProgress): BreathPattern => cleanBreath(p.breath);
export function setBreath(p: MysliProgress, b: BreathPattern): void {
  p.breath = { ...cleanBreath(b) };
}

/** What weighs today; false for an unknown value. */
export function setEmotion(p: MysliProgress, v: unknown): boolean {
  if (!(CHOICES as readonly unknown[]).includes(v)) return false;
  p.emotion = v as EmoChoice;
  return true;
}

/** An area in or out of today's choice (all of them chosen is the same as none: all). */
export function toggleArea(p: MysliProgress, a: AreaId): boolean {
  if (!(AREAS as readonly string[]).includes(a)) return false;
  p.areas = p.areas.includes(a) ? p.areas.filter(x => x !== a) : AREAS.filter(x => x === a || p.areas.includes(x));
  if (p.areas.length === AREAS.length) p.areas = [];
  return true;
}
export function allAreas(p: MysliProgress): void { p.areas = []; }

/** Add an own thought (plain text, its emotion); false when empty, too many or already there. */
export function addOwn(p: MysliProgress, text: unknown, emo: OwnEmo = 'mixed'): boolean {
  const s = cleanText(text);
  if (!s || p.own.length >= OWN_MAX) return false;
  if (p.own.some(o => o.text.toLocaleLowerCase() === s.toLocaleLowerCase())) return false;
  p.own.push({ text: s, emo });
  return true;
}
export function removeOwn(p: MysliProgress, i: number): boolean {
  if (!Number.isInteger(i) || i < 0 || i >= p.own.length) return false;
  p.own.splice(i, 1);
  return true;
}
export function setOwnEmo(p: MysliProgress, i: number, emo: OwnEmo): boolean {
  const o = p.own[i];
  if (!o) return false;
  o.emo = emo;
  return true;
}
/** Forget every own thought (the lobby's "Zapomnij moje myśli"). */
export function forgetOwn(p: MysliProgress): void { p.own = []; }

/** Set a library thought aside for good ("nie moja"). */
export function skipThought(p: MysliProgress, id: string): boolean {
  if (!thoughtById(id) || p.skipped.includes(id)) return false;
  p.skipped.push(id);
  if (p.skipped.length > RULES.skipMax) p.skipped.splice(0, p.skipped.length - RULES.skipMax);
  return true;
}
export function restoreSkipped(p: MysliProgress): void { p.skipped = []; }

/** The 0–10 before the next session (null clears it). */
export function setBefore(p: MysliProgress, v: unknown): void { p.before = cleanWeight(v); }

/** The last few before → after, newest first. */
export const lastWeights = (p: MysliProgress, n = 5): Weight[] => p.history.slice(-n).reverse();
