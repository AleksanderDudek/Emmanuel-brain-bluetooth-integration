/**
 * What Drzewo nad wodą remembers between sessions, and the pure rules of its meta game:
 *
 *   the posture     seated (the default, the safer one) or standing — the figure on the screen and the cues
 *   the season      auto (the calendar's; in a session of 15 minutes and more the year turns through it) or one season
 *   the breath      the rest's breath (kit/breath.ts), one of the presets; rests are whole breaths of it
 *   the fruits      the next fruit of the nine to ripen and the light already gathered in it (`next`, `nextFill`), the
 *                   fruits ripe in the current round of nine (`ripe`: they hang on the tree from the start), how many
 *                   times each kind ripened (`count`) and the whole rounds of nine (`harvests`)
 *   records         the best fruits per session length, sessions, push blocks (every 4th blind from the 3rd session),
 *                   the longest calm in one stretch, the first-time explanations already given
 *
 * Version 1.  The round-13 placeholder saved `{ best: null }`; that and anything broken become a fresh progress
 * (keeping a session count if one was there); any field of a wrong type is repaired, never trusted.  No DOM.
 */
import { BREATH_DEFAULT, cleanBreath, type BreathPattern } from '../kit/breath';
import { FRUITS, POSTURES, SEASON_MODES, type FruitId, type Posture, type SeasonMode } from './content';

export interface DrzewoProgress {
  ver: 1;
  sessions: number;
  pushes: number;
  posture: Posture;
  season: SeasonMode;
  breath: BreathPattern;
  /** the fruit (0..8 in Galatians' order) the next session ripens first, and its light already gathered (0..0.99) */
  next: number;
  nextFill: number;
  /** the fruits ripe in the current round of nine */
  ripe: boolean[];
  /** times each fruit ripened, all time */
  count: Record<FruitId, number>;
  /** whole rounds of nine, all time */
  harvests: number;
  /** all the fruits ever ripened */
  fruits: number;
  /** the stream reached (sessions) — the roots went all the way down */
  streams: number;
  /** the best fruits per session length (s, rounded to 30) */
  best: Record<string, number>;
  /** the longest calm in one stretch (s) */
  calmBest: number;
  seen: string[];
  lastLen: number;
}

const zeros = (): Record<FruitId, number> => Object.fromEntries(FRUITS.map(f => [f, 0])) as Record<FruitId, number>;

export function freshProgress(): DrzewoProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, posture: 'sit', season: 'auto', breath: { ...BREATH_DEFAULT }, next: 0, nextFill: 0,
    ripe: FRUITS.map(() => false), count: zeros(), harvests: 0, fruits: 0, streams: 0, best: {}, calmBest: 0, seen: [], lastLen: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Bring a loaded save to version 1, in place (idempotent); anything of a wrong type is repaired. */
export function migrate(p: DrzewoProgress): DrzewoProgress {
  const raw = p as unknown as Record<string, unknown>;
  const f = freshProgress();
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, f, keep);
    return p;
  }
  const count = zeros();
  if (isObj(raw.count)) for (const k of FRUITS) count[k] = int(raw.count[k]);
  const ripe = FRUITS.map((_, i) => Array.isArray(raw.ripe) && raw.ripe[i] === true);
  const fields: DrzewoProgress = {
    ver: 1,
    sessions: int(raw.sessions),
    pushes: int(raw.pushes),
    posture: (POSTURES as readonly unknown[]).includes(raw.posture) ? (raw.posture as Posture) : f.posture,
    season: (SEASON_MODES as readonly unknown[]).includes(raw.season) ? (raw.season as SeasonMode) : f.season,
    breath: { ...cleanBreath(raw.breath) },
    next: int(raw.next) % 9,
    nextFill: Math.max(0, Math.min(0.99, num(raw.nextFill))),
    ripe: ripe.every(Boolean) ? FRUITS.map(() => false) : ripe,
    count,
    harvests: int(raw.harvests),
    fruits: int(raw.fruits),
    streams: int(raw.streams),
    best: {},
    calmBest: Math.max(0, num(raw.calmBest)),
    seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [],
    lastLen: int(raw.lastLen),
  };
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) fields.best[k] = Math.floor(num(v));
  for (const k of Object.keys(raw)) delete raw[k];
  Object.assign(p, fields);
  return p;
}

/** The best fruits of any session length (null: never a fruit). */
export function bestOf(p: DrzewoProgress): number | null {
  const vals = Object.values(p.best).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** The record key for a planned length: sessions are compared with sessions of the same length. */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec / 30) * 30);

/** Remember a first-time thing; true when it was new. */
export function markSeen(p: DrzewoProgress, what: string): boolean {
  if (p.seen.includes(what)) return false;
  p.seen.push(what);
  return true;
}

export const breathOf = (p: DrzewoProgress): BreathPattern => cleanBreath(p.breath);

/** Choose the posture / the season (the lobby's card, the ≡ picker); false for an unknown value. */
export function setPosture(p: DrzewoProgress, v: unknown): boolean {
  if (!(POSTURES as readonly unknown[]).includes(v)) return false;
  p.posture = v as Posture;
  return true;
}
export function setSeason(p: DrzewoProgress, v: unknown): boolean {
  if (!(SEASON_MODES as readonly unknown[]).includes(v)) return false;
  p.season = v as SeasonMode;
  return true;
}
export function setBreath(p: DrzewoProgress, b: BreathPattern): void {
  p.breath = { ...cleanBreath(b) };
}

/** "Zacznij od…": the next session ripens this fruit first (the light gathered elsewhere is kept only for its own fruit). */
export function setNext(p: DrzewoProgress, i: number): boolean {
  if (!Number.isInteger(i) || i < 0 || i > 8) return false;
  if (p.next !== i) p.nextFill = 0;
  p.next = i;
  return true;
}

/** How many of the current round's nine are ripe. */
export const ripeCount = (p: DrzewoProgress): number => p.ripe.filter(Boolean).length;
