/**
 * What Anioł Stróż remembers between nights and the pure rules of its meta game: the angel's rank
 * (all feathers ever — it widens the pool of gifts and makes the room cosier), the records per
 * session length, the Koszmary banished and the day's gift.  No DOM, no randomness.
 */
import { GIFTS, ROOM, type Gift, type RoomItem } from './content';
import { RULES } from './rules';

export interface AniolProgress {
  v: 1;
  /** nights (sessions) saved */
  sessions: number;
  /** Zmory banished, all time */
  total: number;
  /** feathers, all time: the angel's rank */
  feathers: number;
  /** Czuwanie blocks begun, all time: every 4th is blind ("Mgła snu") from the 3rd session */
  pushes: number;
  /** records: Zmory banished per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the longest combo, the highest level of a night, Koszmary banished, Płomienie, calm nights */
  bestCombo: number;
  bestLevel: number;
  koszmary: number;
  flames: number;
  calmNights: number;
  /** the day's gift: the day it was given */
  giftDay: string;
}

export function freshProgress(): AniolProgress {
  return {
    v: 1, sessions: 0, total: 0, feathers: 0, pushes: 0, best: {}, lastLen: 0,
    bestCombo: 0, bestLevel: 0, koszmary: 0, flames: 0, calmNights: 0, giftDay: '',
  };
}

// ── the rank ─────────────────────────────────────────────────────
/** The rank (0-based) for all feathers ever. */
export function rankOf(feathers: number): number {
  let r = 0;
  RULES.ranks.forEach((at, i) => { if (feathers >= at) r = i; });
  return r;
}

/** Feathers at which the next rank comes (null: the last rank). */
export function nextRankAt(feathers: number): number | null {
  const r = rankOf(feathers);
  return r + 1 < RULES.ranks.length ? RULES.ranks[r + 1] : null;
}

/** The gifts a night can offer at a rank. */
export const giftPool = (rank: number): Gift[] => GIFTS.filter(g => g.rank <= rank);

/** The cosy things the room has at a rank: one more with each rank from the second. */
export const roomItems = (rank: number): RoomItem[] => ROOM.slice(0, Math.max(0, Math.min(ROOM.length, rank)));

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: AniolProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: AniolProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
