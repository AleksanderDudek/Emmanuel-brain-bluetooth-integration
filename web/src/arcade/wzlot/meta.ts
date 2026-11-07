/**
 * What Wzlot remembers between sessions and the pure rules of its meta game (Tiny Wings' nest): the
 * nest's level (its multiplier), the flight lessons (three at a time; a full set grows the nest and
 * lays an egg that hatches next session), the plumage the nest unlocks, the records (the best day,
 * the best session, the farthest day, the farthest grań) and what the coach has already taught.
 * No DOM; no randomness.
 *
 * Version 2 rebuilt the game.  A version-1 save (`v: 1`, metres per session length, plumage
 * feathers, vistas, missions) is migrated in place on first use: the session count and the farthest
 * flight stay, the rest starts over.  Any field of a wrong type is reset, never trusted.
 */
import { lessonsOf, plumageFor, type Lesson, type LessonKind } from './content';
import { RULES } from './rules';

export interface WzlotProgress {
  ver: 2;
  /** sessions saved */
  sessions: number;
  /** days (runs) flown, all time */
  days: number;
  /** the nest's level = the points' multiplier (×1, ×2 …) */
  nest: number;
  /** the lesson set open now (0-based) and which of its three are done (bits 1, 2, 4) */
  set: number;
  doneMask: number;
  /** promyki gathered, all time */
  coins: number;
  /** eggs laid (one per full set) and chicks hatched from them */
  eggs: number;
  chicks: number;
  /** records: the best day's points, the best session's points, the farthest day (m), the farthest grań (1-based) */
  bestDay: number;
  bestTotal: number;
  farthest: number;
  bestGran: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** the opening story was seen; what the coach has taught (bits of TEACH) */
  opened: boolean;
  taught: number;
  lastLen: number;
}

/** What the coach marks teach, once ever each. */
export const TEACH = { hold: 1, release: 2, perfect: 4, crag: 8, sun: 16, thermal: 32, night: 64, fever: 128 } as const;
export type Teach = keyof typeof TEACH;

export function freshProgress(): WzlotProgress {
  return {
    ver: 2, sessions: 0, days: 0, nest: 1, set: 0, doneMask: 0, coins: 0, eggs: 0, chicks: 0,
    bestDay: 0, bestTotal: 0, farthest: 0, bestGran: 0, pushes: 0, opened: false, taught: 0, lastLen: 0,
  };
}

const num = (v: unknown, lo = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= lo ? v : lo);

/**
 * Bring a loaded save to version 2, in place (idempotent).  A version-1 save keeps its sessions and
 * its farthest flight (the best of its per-length metres); every field of a wrong type is reset.
 */
export function migrate(p: WzlotProgress): WzlotProgress {
  const raw = p as unknown as Record<string, unknown>;
  const fresh = freshProgress();
  if (raw.v === 1 || raw.ver !== 2) {
    const sessions = num(raw.sessions);
    const best = raw.best && typeof raw.best === 'object' ? Object.values(raw.best as Record<string, unknown>) : [];
    const farthest = Math.max(0, ...best.map(v => num(v)));
    const pushes = num(raw.lekcje);
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(raw, fresh, { sessions: Math.floor(sessions), farthest: Math.round(farthest), pushes: Math.floor(pushes), opened: sessions > 0 });
    return p;
  }
  // a version-2 save: only repair what is broken
  for (const [k, def] of Object.entries(fresh)) {
    if (typeof raw[k] !== typeof def || (typeof def === 'number' && !Number.isFinite(raw[k] as number))) raw[k] = def;
  }
  p.nest = Math.max(1, Math.floor(p.nest));
  return p;
}

/** The record the lobby shows: the best session's points (null before any). */
export function bestOf(p: WzlotProgress): number | null {
  migrate(p);
  return p.sessions > 0 && p.bestTotal > 0 ? p.bestTotal : null;
}

export const multOf = (p: WzlotProgress): number => Math.max(1, Math.floor(p.nest));
export const plumageOf = (p: WzlotProgress): 1 | 2 | 3 => plumageFor(p.nest, RULES.plumage);

/** The three lessons open now, with whether each is done. */
export function openLessons(p: WzlotProgress): { lesson: Lesson; done: boolean }[] {
  return lessonsOf(p.set).map((lesson, i) => ({ lesson, done: (p.doneMask & (1 << i)) !== 0 }));
}

/** What a day (or the session so far) has shown, for the lessons. */
export interface Feats {
  perfectDay: number; granDay: number; chainDay: number; cloudDay: number; airFlight: number; thermalDay: number;
  pointsDay: number; feverDay: number; quickGran: number; daysSession: number; bandFever: number; orbDay: number;
}

export const noFeats = (): Feats => ({
  perfectDay: 0, granDay: 0, chainDay: 0, cloudDay: 0, airFlight: 0, thermalDay: 0, pointsDay: 0, feverDay: 0,
  quickGran: 0, daysSession: 0, bandFever: 0, orbDay: 0,
});

/** How far a lesson is (its count against its target) from today's best feats and the all-time coins. */
export function lessonValue(kind: LessonKind, f: Feats, p: WzlotProgress): number {
  return kind === 'coinsAll' ? p.coins : f[kind];
}

export interface LessonCheck {
  /** the lessons just done (indices into the open set) */
  done: number[];
  /** the set was completed: the nest grew to this level (null: not yet) */
  nest: number | null;
}

/**
 * Mark what the feats complete.  A full set grows the nest (its multiplier), lays an egg and opens
 * the next set; the next set's lessons are checked at once (an all-time count may already be met).
 */
export function checkLessons(p: WzlotProgress, f: Feats): LessonCheck {
  const out: LessonCheck = { done: [], nest: null };
  for (let guard = 0; guard < 4; guard++) {
    const open = openLessons(p);
    open.forEach((o, i) => {
      if (!o.done && lessonValue(o.lesson.kind, f, p) >= o.lesson.target) {
        p.doneMask |= 1 << i;
        out.done.push(i);
      }
    });
    if (p.doneMask !== 7) break;
    p.nest = Math.max(1, Math.floor(p.nest)) + 1;
    p.eggs += 1;
    p.set += 1;
    p.doneMask = 0;
    out.nest = p.nest;
    // feats of the day stay; only the all-time and session counts may complete the next set at once
    f = { ...noFeats(), daysSession: f.daysSession };
  }
  return out;
}

/** At a session's start: eggs laid earlier hatch (returns how many hatched now). */
export function hatch(p: WzlotProgress): number {
  const n = Math.max(0, p.eggs - p.chicks);
  p.chicks = p.eggs;
  return n;
}

export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));
