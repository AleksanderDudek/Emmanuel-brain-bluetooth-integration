/**
 * What Firmament remembers between sessions and the pure rules of its meta game: the level the
 * player is on (the saga goes on across sessions; a failed level simply restarts), the stars won on
 * every level (the best of each, never less), the records per session length, the Obserwacja
 * blocks begun (every 4th is blind from the 3rd session), the instruments earned and the day's
 * gift.  No DOM, no randomness.
 */
import { RULES } from './rules';

export interface FirmamentProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** points, all time */
  total: number;
  /** the level the player is on (0-based), and the best stars of every level played (index = level) */
  level: number;
  stars: number[];
  /** Obserwacja blocks begun, all time */
  pushes: number;
  /** instruments earned from the telescope, pulsars among them, rescues, the longest cascade */
  tools: number;
  pulsars: number;
  rescues: number;
  bestCascade: number;
  /** records: points per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the day the day's gift was given */
  giftDay: string;
}

export function freshProgress(): FirmamentProgress {
  return { v: 1, sessions: 0, total: 0, level: 0, stars: [], pushes: 0, tools: 0, pulsars: 0, rescues: 0, bestCascade: 0, best: {}, lastLen: 0, giftDay: '' };
}

/** A won level: its stars kept at their best (never fewer), the saga moved past it.  Returns the stars gained. */
export function winLevel(p: FirmamentProgress, index: number, stars: number): number {
  const before = p.stars[index] ?? 0;
  while (p.stars.length <= index) p.stars.push(0);
  p.stars[index] = Math.max(before, Math.min(3, Math.max(1, Math.round(stars))));
  p.level = Math.max(p.level, index + 1);
  return p.stars[index] - before;
}

export const starsTotal = (p: FirmamentProgress): number => p.stars.reduce((s, v) => s + (v > 0 ? v : 0), 0);

/** Stars on the levels of one constellation (ten values, 0 = not won yet). */
export function constStars(p: FirmamentProgress, c: number): number[] {
  return Array.from({ length: RULES.perConst }, (_, k) => p.stars[c * RULES.perConst + k] ?? 0);
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: FirmamentProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: FirmamentProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
