/**
 * What Każda myśl remembers between sessions, and the pure rules of its meta game:
 *
 *   what to do      today's mode: "To, co mnie trapi" (the library by today's emotion and areas, an own set first if
 *                   chosen), a warownia of the series, or one of the player's own warownie (sets.ts)
 *   what weighs     the emotion chosen for today (I do not know — all; fear; sadness; anger; the mixtures) and the
 *                   areas of life (none chosen: all eight)
 *   own warownie    up to 6 sets of up to 10 lie → truth pairs, each lie with its feeling — kept only in this game's
 *                   progress on this device (DESIGN §18.3 "names stay home"), never in a session's result
 *   the places      each warownia's place (its stones down, its truths gilded, how often it fell); an own set keeps its own
 *   the library     the thoughts burned last time (they go to the back next time), the ones set aside as "not mine"
 *   the breath      the rest's breath (kit/breath.ts), one of the presets; rests are whole breaths of it
 *   how heavy       the 0–10 the player gave before the next session (the lobby), and a short history of before → after
 *   records         lies burned (all, by emotion, own), truths gilded, the most in one session per length, sessions, push
 *                   blocks (every 4th blind from the 3rd session), the longest calm, the first-time explanations given
 *
 * Version 2 (round 16).  Version 1's own thoughts (≤ 8) become one own set "Moje myśli" with empty truths, chosen to
 * come first in today's mode, so nothing the player wrote is lost.  The placeholder's save (`{ best: null }`) and
 * anything broken become a fresh progress keeping only a session count; every field of a wrong type is repaired, never
 * trusted.  No DOM, no randomness.
 */
import { BREATH_DEFAULT, cleanBreath, type BreathPattern } from '../kit/breath';
import { isWarowniaId, type WarowniaId } from '../kit/warownie';
import { AREAS, CHOICES, EMOS, cleanOwnList, cleanText, thoughtById, type AreaId, type Emo, type EmoChoice, type OwnEmo } from './content';
import { RULES } from './rules';
import {
  PAIRS_MAX, SETS_MAX, cleanName, cleanPlace, cleanSets, freshPlace, setFromThoughts, type OwnSet, type Place,
} from './sets';

/** One before → after: the day, the 0–10 before (null: not given) and after. */
export interface Weight { day: string; before: number | null; after: number }

/** What a session plays: the library by what weighs today, a warownia of the series, or an own warownia. */
export const MODES = ['today', 'war', 'own'] as const;
export type Mode = (typeof MODES)[number];

export interface MysliProgress {
  ver: 2;
  sessions: number;
  pushes: number;
  mode: Mode;
  /** the warownia chosen (mode 'war'), the own set chosen (mode 'own', -1: none), the own set first in today's mode (-1: none) */
  war: WarowniaId | null;
  set: number;
  first: number;
  emotion: EmoChoice;
  /** the areas chosen (empty: all) */
  areas: AreaId[];
  /** the player's own warownie */
  sets: OwnSet[];
  /** each warownia's place */
  places: Partial<Record<WarowniaId, Place>>;
  breath: BreathPattern;
  /** library ids burned last session (they go last next time), and the ones set aside as "not mine" */
  recent: string[];
  skipped: string[];
  /** lies burned, all time: in all, by their strongest emotion, the player's own; truths gilded */
  burned: number;
  byEmo: Record<Emo, number>;
  ownBurned: number;
  truths: number;
  /** the most thoughts given (each answered by its truth) in one session, per session length (s, rounded to 30) */
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
    ver: 2, sessions: 0, pushes: 0, mode: 'today', war: null, set: -1, first: -1, emotion: 'unknown', areas: [], sets: [], places: {},
    breath: { ...BREATH_DEFAULT }, recent: [], skipped: [], burned: 0, byEmo: zeroEmo(), ownBurned: 0, truths: 0, best: {}, before: null,
    history: [], calmBest: 0, quietBest: 0, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** A 0–10 weight, or null. */
export const cleanWeight = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : null);
const ids = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && !!thoughtById(s)))].slice(-max) : [];
const setIndex = (v: unknown, n: number): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : -1);

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

function cleanPlaces(v: unknown): Partial<Record<WarowniaId, Place>> {
  const out: Partial<Record<WarowniaId, Place>> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) if (isWarowniaId(k)) out[k] = cleanPlace(x, 6);
  return out;
}

/**
 * Bring a loaded save to version 2, in place (idempotent): version 1 keeps everything and its own thoughts become one
 * own set; the placeholder's or a broken save keeps its session count.
 */
export function migrate(p: MysliProgress): MysliProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1 && raw.ver !== 2) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  let sets = cleanSets(raw.sets);
  let first = setIndex(raw.first, sets.length);
  if (raw.ver === 1) {
    // round 15's own thoughts: one own set "Moje myśli", with empty truths, coming first in today's mode as they did
    const own = setFromThoughts(cleanOwnList(raw.own));
    sets = own ? [own] : [];
    first = own ? 0 : -1;
  }
  const byEmo = zeroEmo();
  if (isObj(raw.byEmo)) for (const e of EMOS) byEmo[e] = int(raw.byEmo[e]);
  const war = isWarowniaId(raw.war) ? raw.war : null;
  const set = setIndex(raw.set, sets.length);
  // a mode whose set is not chosen yet stays (the card shows the choice; until then a session plays today's)
  const mode: Mode = (MODES as readonly unknown[]).includes(raw.mode) ? (raw.mode as Mode) : 'today';
  const fields: MysliProgress = {
    ver: 2,
    sessions: int(raw.sessions),
    pushes: int(raw.pushes),
    mode,
    war,
    set,
    first,
    emotion: (CHOICES as readonly unknown[]).includes(raw.emotion) ? (raw.emotion as EmoChoice) : f.emotion,
    areas: Array.isArray(raw.areas) ? AREAS.filter(a => (raw.areas as unknown[]).includes(a)) : [],
    sets,
    places: cleanPlaces(raw.places),
    breath: { ...cleanBreath(raw.breath) },
    recent: ids(raw.recent, RULES.recentMax),
    skipped: ids(raw.skipped, RULES.skipMax),
    burned: int(raw.burned),
    byEmo,
    ownBurned: int(raw.ownBurned),
    truths: int(raw.truths),
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

// ── the mode and the sets ────────────────────────────────────────

/** What the next session plays; false for an unknown value (a warownia or own set needs one chosen). */
export function setMode(p: MysliProgress, m: unknown): boolean {
  if (!(MODES as readonly unknown[]).includes(m)) return false;
  p.mode = m as Mode;
  return true;
}

/** Choose a warownia of the series for the next session (and its mode). */
export function chooseWar(p: MysliProgress, id: unknown): boolean {
  if (!isWarowniaId(id)) return false;
  p.war = id;
  p.mode = 'war';
  return true;
}

/** Choose an own warownia for the next session (and its mode). */
export function chooseSet(p: MysliProgress, i: number): boolean {
  if (!p.sets[i]) return false;
  p.set = i;
  p.mode = 'own';
  return true;
}

/** The own set that comes first in today's mode (-1: none). */
export function setFirst(p: MysliProgress, i: number): void { p.first = p.sets[i] ? i : -1; }

/** A warownia's place (created on first use). */
export function placeOf(p: MysliProgress, id: WarowniaId): Place {
  const pl = p.places[id] ?? freshPlace();
  p.places[id] = pl;
  return pl;
}

/** A new own warownia (a name, no pairs yet); its index, or -1 when there are already SETS_MAX. */
export function addSet(p: MysliProgress, name: unknown = ''): number {
  if (p.sets.length >= SETS_MAX) return -1;
  p.sets.push({ name: cleanName(name), pairs: [], place: freshPlace() });
  return p.sets.length - 1;
}

export function renameSet(p: MysliProgress, i: number, name: unknown): boolean {
  const s = p.sets[i];
  if (!s) return false;
  s.name = cleanName(name);
  return true;
}

/** Forget an own warownia (its pairs, its place); the chosen indices follow. */
export function removeSet(p: MysliProgress, i: number): boolean {
  if (!p.sets[i]) return false;
  p.sets.splice(i, 1);
  const shift = (k: number) => (k === i ? -1 : k > i ? k - 1 : k);
  p.set = shift(p.set);
  p.first = shift(p.first);
  if (p.mode === 'own' && p.set < 0) p.mode = 'today';
  return true;
}

/** Forget every own warownia (the lobby's "Zapomnij wszystkie"). */
export function forgetSets(p: MysliProgress): void {
  p.sets = [];
  p.set = -1;
  p.first = -1;
  if (p.mode === 'own') p.mode = 'today';
}

/** Add a pair to an own set: the lie (needed), its truth (may be empty), its feeling; false when empty, full or already there. */
export function addPair(p: MysliProgress, i: number, lie: unknown, truth: unknown = '', emo: OwnEmo = 'mixed'): boolean {
  const s = p.sets[i];
  const l = cleanText(lie);
  if (!s || !l || s.pairs.length >= PAIRS_MAX) return false;
  if (s.pairs.some(x => x.lie.toLocaleLowerCase() === l.toLocaleLowerCase())) return false;
  s.pairs.push({ lie: l, truth: cleanText(truth), emo });
  return true;
}

/** Change a pair: its lie (never to empty), its truth, its feeling. */
export function editPair(p: MysliProgress, i: number, k: number, ch: { lie?: unknown; truth?: unknown; emo?: OwnEmo }): boolean {
  const pr = p.sets[i]?.pairs[k];
  if (!pr) return false;
  if (ch.lie !== undefined) {
    const l = cleanText(ch.lie);
    if (!l) return false;
    pr.lie = l;
  }
  if (ch.truth !== undefined) pr.truth = cleanText(ch.truth);
  if (ch.emo !== undefined) pr.emo = ch.emo;
  return true;
}

/** Remove a pair; the set's place follows (the indices after it move down). */
export function removePair(p: MysliProgress, i: number, k: number): boolean {
  const s = p.sets[i];
  if (!s || !s.pairs[k]) return false;
  s.pairs.splice(k, 1);
  const move = (list: number[]) => list.filter(x => x !== k).map(x => (x > k ? x - 1 : x));
  s.place = cleanPlace({ ...s.place, burned: move(s.place.burned), gilded: move(s.place.gilded) }, s.pairs.length);
  return true;
}

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
