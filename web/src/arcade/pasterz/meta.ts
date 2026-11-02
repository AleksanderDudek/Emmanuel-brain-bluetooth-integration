/**
 * What Pasterz remembers between sessions and the pure rules of its meta game: the hundred (Luke
 * 15:4 — the flock grows across sessions toward a hundred sheep, then a new season begins), the
 * twelve lambs that get a name when the lost one of a pasture is carried home (in a fixed order:
 * the collection always completes), the three open missions, the records per session length, the
 * day's hill and the day's gift.  No DOM, no randomness.
 */
import { LAMBS, MISSIONS, type MissionId } from './content';
import { RULES } from './rules';

export interface PasterzProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** sheep gathered, all time */
  total: number;
  /** the hundred: the flock now (0..99) and the hundreds completed (seasons) */
  flock: number;
  season: number;
  /** the named lambs (indices into LAMBS) and lost lambs carried home, all time */
  lambs: number[];
  lambsFound: number;
  /** Wołanie blocks begun, all time: every 4th is blind ("Zmrok") from the 3rd session */
  calls: number;
  /** the three open missions, how many were done, the next to open */
  missions: MissionId[];
  missionsDone: number;
  missionNext: number;
  /** records: sheep per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the most stars in one night */
  bestStars: number;
  /** "Wzgórze dnia": the day it was walked and the sheep gathered on it; the day's gift */
  dailyDay: string;
  dailyGathered: number;
  giftDay: string;
}

export function freshProgress(): PasterzProgress {
  return {
    v: 1, sessions: 0, total: 0, flock: 0, season: 0, lambs: [], lambsFound: 0, calls: 0,
    missions: MISSIONS.slice(0, 3).map(m => m.id), missionsDone: 0, missionNext: 3,
    best: {}, lastLen: 0, bestStars: 0, dailyDay: '', dailyGathered: 0, giftDay: '',
  };
}

// ── the hundred ──────────────────────────────────────────────────
/** Sheep join the flock across sessions; every hundred starts a new season.  Returns the seasons begun. */
export function addToFlock(p: PasterzProgress, n: number): number {
  if (!(n > 0)) return 0;
  p.flock += Math.round(n);
  let seasons = 0;
  while (p.flock >= RULES.hundred) {
    p.flock -= RULES.hundred;
    p.season++;
    seasons++;
  }
  return seasons;
}

// ── the named lambs ──────────────────────────────────────────────
/** The next lamb to get a name (null: all twelve named). */
export function nextLamb(p: PasterzProgress): number | null {
  for (const l of LAMBS) if (!p.lambs.includes(l.index)) return l.index;
  return null;
}

/**
 * A lost lamb carried into the fold: it gets the next name of the twelve; once all are named, the
 * lambs come home again in turn ("Dzwoneczek znów w domu").
 */
export function nameLamb(p: PasterzProgress): { index: number; isNew: boolean } {
  p.lambsFound++;
  const next = nextLamb(p);
  if (next !== null) {
    p.lambs.push(next);
    return { index: next, isNew: true };
  }
  return { index: (p.lambsFound - 1) % LAMBS.length, isNew: false };
}

// ── the missions ─────────────────────────────────────────────────
/** After a session: every done mission gives its place to the next one not yet open. */
export function turnPages(p: PasterzProgress, done: readonly MissionId[]): MissionId[] {
  const opened: MissionId[] = [];
  p.missions = p.missions.map(id => {
    if (!done.includes(id)) return id;
    for (let k = 0; k < MISSIONS.length; k++) {
      const next = MISSIONS[(p.missionNext + k) % MISSIONS.length];
      if (!p.missions.includes(next.id) && !opened.includes(next.id) && !done.includes(next.id)) {
        p.missionNext = (p.missionNext + k + 1) % MISSIONS.length;
        opened.push(next.id);
        return next.id;
      }
    }
    return id;
  });
  return opened;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: PasterzProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: PasterzProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
