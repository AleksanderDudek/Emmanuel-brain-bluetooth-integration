/**
 * What Koła światła remembers between sessions (DESIGN.md §28), and the pure rules of its meta:
 *
 *   records   the most petals lit in one session, petals in all, wheels brought true in all, full fields reached
 *             (every wheel true), sessions
 *   the pace  focus-seconds a sighted second, learnt session by session (0: not yet known) — the work of the next
 *             session is fitted to it (rules.ts `needPer`)
 *   choices   the posture (standing, as the chart shows; or seated on a low stool) and the rests' breath
 *
 * Anything broken becomes a fresh progress keeping only a session count; every field of a wrong type is repaired,
 * never trusted.  No DOM, no randomness.
 */
import { BREATH_PRESETS, cleanBreath, type BreathPattern } from '../kit/breath';
import { RULES } from './rules';

export type Posture = 'stand' | 'sit';
export const POSTURES: readonly Posture[] = ['stand', 'sit'];

export interface KolaProgress {
  ver: 1;
  sessions: number;
  /** the most petals in one session */
  best: number;
  /** all time: petals lit, wheels brought true (round 1), full fields (all twelve true) */
  petals: number;
  wheels: number;
  fields: number;
  /** focus-seconds a sighted second (0: not yet known) */
  pace: number;
  posture: Posture;
  breath: BreathPattern;
  /** first-time explanations given */
  seen: string[];
  /** the last session's length (s): the lobby's guess before the length buttons are read */
  lastLen: number;
}

/** The rests' breath: in 5, out 5 — six breaths a minute, even (the series' choice). */
export const BREATH_DEF: BreathPattern = BREATH_PRESETS.even;

export function freshProgress(): KolaProgress {
  return { ver: 1, sessions: 0, best: 0, petals: 0, wheels: 0, fields: 0, pace: 0, posture: 'stand', breath: { ...BREATH_DEF }, seen: [], lastLen: 0 };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));

/** Bring a loaded save to version 1, in place (idempotent): every field repaired; a broken save keeps its session count. */
export function migrate(p: KolaProgress): KolaProgress {
  const raw = p as unknown as Record<string, unknown>;
  if (raw.ver !== 1) {
    const sessions = int(raw.sessions);
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), { sessions });
    return p;
  }
  p.sessions = int(raw.sessions);
  p.best = int(raw.best);
  p.petals = int(raw.petals);
  p.wheels = int(raw.wheels);
  p.fields = int(raw.fields);
  const pace = num(raw.pace);
  p.pace = pace > 0 ? Math.max(RULES.paceMin, Math.min(RULES.paceMax, pace)) : 0;
  p.posture = raw.posture === 'sit' ? 'sit' : 'stand';
  p.breath = raw.breath === undefined ? { ...BREATH_DEF } : cleanBreath(raw.breath);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))].slice(0, 40) : [];
  p.lastLen = int(raw.lastLen);
  return p;
}

/** The best so far (null: never played). */
export const bestOf = (p: KolaProgress): number | null => (p.sessions > 0 ? p.best : null);

export function setBreath(p: KolaProgress, b: BreathPattern): boolean {
  p.breath = cleanBreath(b);
  return true;
}

export function setPosture(p: KolaProgress, v: Posture): boolean {
  if (!POSTURES.includes(v) || p.posture === v) return false;
  p.posture = v;
  return true;
}
