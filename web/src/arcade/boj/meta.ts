/**
 * What Dobry bój remembers between sessions (DESIGN.md §25, §29), and the pure rules of its meta:
 *
 *   the fighter  the style (boxing or MMA), the division (ona / on), the skin tone and the hair — the lobby's choices
 *   the view     from the side (the ring as it was) or through the boxer's eyes (first person); an older save: the side
 *   the level    the difficulty (kit/difficulty.ts; an older save: REGULAR, the game as it was)
 *   the ladder   the next opponent (beat one → the next; lose → the same one again), the champion's belts won — one
 *                ladder for every level (a player may change the level at any time)
 *   records      fights, wins, knockouts, landed strikes and counters in all (every level); the most landed strikes in
 *                a session per level (`best` is REGULAR's, as before levels came; the others under `recordKey`)
 *
 * Anything broken becomes a fresh progress keeping only a session count; every field of a wrong type is repaired, never
 * trusted.  No DOM, no randomness.
 */
import { difficultyOf, isDifficulty, recordKey, type Difficulty } from '../kit/difficulty';
import { HAIRS, LADDER, SKINS } from './content';
import { STYLES, type Style } from './moves';

export type Sex = 'ona' | 'on';
export const SEXES: readonly Sex[] = ['ona', 'on'];

/** How the fight is seen: from the side (the ring as round 21 drew it) or through the boxer's eyes. */
export type ViewMode = 'side' | 'fp';
export const VIEWS: readonly ViewMode[] = ['side', 'fp'];

export interface BojProgress {
  ver: 1;
  sessions: number;
  style: Style;
  sex: Sex;
  skin: number;
  hair: number;
  /** the next opponent on the ladder (0 … LADDER.length − 1) */
  ladder: number;
  /** the champion beaten (fights won on the last rung) */
  titles: number;
  fights: number;
  wins: number;
  kos: number;
  /** the most landed strikes in one session */
  best: number;
  /** all time: landed strikes, counters landed */
  strikes: number;
  counters: number;
  /** first-time explanations given */
  seen: string[];
  /** the last session's length (s): the lobby's guess before the length buttons are read */
  lastLen: number;
  /** how the fight is seen (an older save: from the side) */
  view: ViewMode;
  /** the difficulty level (an older save: REGULAR) */
  difficulty: Difficulty;
  /** the most landed strikes in a session at the other levels, by `recordKey('best', level)` (REGULAR's is `best`) */
  records: Record<string, number>;
}

/** The hair a division starts with: tied back for her, short for him. */
export const hairDefault = (sex: Sex): number => (sex === 'ona' ? 1 : 0);

export function freshProgress(): BojProgress {
  return {
    ver: 1, sessions: 0, style: 'boks', sex: 'on', skin: 1, hair: hairDefault('on'), ladder: 0, titles: 0,
    fights: 0, wins: 0, kos: 0, best: 0, strikes: 0, counters: 0, seen: [], lastLen: 0,
    view: 'side', difficulty: 'regular', records: {},
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const inRange = (v: unknown, n: number, d: number): number => {
  const k = int(v, d);
  return k < n ? k : d;
};

/** Bring a loaded save to version 1, in place (idempotent): every field repaired; a broken save keeps its session count. */
export function migrate(p: BojProgress): BojProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const sessions = int(raw.sessions);
    const keep = { sessions, view: viewOf(raw.view), difficulty: difficultyOf(raw.difficulty) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  p.sessions = int(raw.sessions);
  p.style = (STYLES as readonly unknown[]).includes(raw.style) ? (raw.style as Style) : f.style;
  p.sex = (SEXES as readonly unknown[]).includes(raw.sex) ? (raw.sex as Sex) : f.sex;
  p.skin = inRange(raw.skin, SKINS, f.skin);
  p.hair = inRange(raw.hair, HAIRS, hairDefault(p.sex));
  p.ladder = inRange(raw.ladder, LADDER.length, 0);
  p.titles = int(raw.titles);
  p.fights = int(raw.fights);
  p.wins = Math.min(int(raw.wins), p.fights);
  p.kos = Math.min(int(raw.kos), p.wins);
  p.best = int(raw.best);
  p.strikes = Math.max(int(raw.strikes), p.best);
  p.counters = int(raw.counters);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string').map(s => s.slice(0, 40)))].slice(0, 40) : [];
  p.lastLen = int(raw.lastLen);
  p.view = viewOf(raw.view);
  p.difficulty = difficultyOf(raw.difficulty);
  const rec: Record<string, number> = {};
  if (raw.records && typeof raw.records === 'object' && !Array.isArray(raw.records)) {
    for (const d of ['start', 'advanced', 'hardcore'] as const) {
      const k = recordKey('best', d), v = (raw.records as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) rec[k] = Math.floor(v);
    }
  }
  p.records = rec;
  return p;
}

/** A saved view, or the side (an older save, anything broken). */
export const viewOf = (v: unknown): ViewMode => (v === 'fp' ? 'fp' : 'side');

export function setView(p: BojProgress, v: unknown): boolean {
  if (!(VIEWS as readonly unknown[]).includes(v)) return false;
  p.view = v as ViewMode;
  return true;
}

export function setDifficulty(p: BojProgress, d: unknown): boolean {
  if (!isDifficulty(d)) return false;
  p.difficulty = d;
  return true;
}

/** The most landed strikes in a session at a level (null: never played there; REGULAR's is `best`). */
export function bestAt(p: BojProgress, d: Difficulty): number | null {
  if (d === 'regular') return p.sessions > 0 ? p.best : null;
  const v = p.records?.[recordKey('best', d)];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** A session's landed strikes into the level's record (records only rise). */
export function recordAt(p: BojProgress, d: Difficulty, score: number): void {
  const n = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
  if (d === 'regular') { p.best = Math.max(p.best, n); return; }
  const k = recordKey('best', d);
  p.records = { ...(p.records ?? {}), [k]: Math.max(p.records?.[k] ?? 0, n) };
}

/** The best so far at the chosen level (null: never played there). */
export const bestOf = (p: BojProgress): number | null => bestAt(p, difficultyOf(p.difficulty));

export function setStyle(p: BojProgress, s: unknown): boolean {
  if (!(STYLES as readonly unknown[]).includes(s)) return false;
  p.style = s as Style;
  return true;
}

/** Choose the division; the hair follows when it was the other division's default. */
export function setSex(p: BojProgress, s: unknown): boolean {
  if (!(SEXES as readonly unknown[]).includes(s)) return false;
  const next = s as Sex;
  if (p.hair === hairDefault(p.sex)) p.hair = hairDefault(next);
  p.sex = next;
  return true;
}

export function setSkin(p: BojProgress, v: unknown): boolean {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= SKINS) return false;
  p.skin = v;
  return true;
}

export function setHair(p: BojProgress, v: unknown): boolean {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= HAIRS) return false;
  p.hair = v;
  return true;
}

/** One fight's result into the ladder: a win moves to the next opponent (the champion stays the last rung). */
export function ladderAfter(ladder: number, won: boolean): number {
  const top = LADDER.length - 1;
  const i = Math.max(0, Math.min(top, Math.floor(ladder)));
  return won ? Math.min(top, i + 1) : i;
}
