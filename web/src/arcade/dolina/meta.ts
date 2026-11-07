/**
 * What Dolina remembers between runs and the pure rules of its meta game: the sparks in hand and
 * all ever (the pilgrim's looks), the upgrades bought with them (sword, lamp, oil, boots, the
 * Świt), the eras reached (a run that met an era's guardian may start there next time), the
 * guardians beaten and the dawn gate, the records per session length and the day's gift.
 * No DOM, no randomness.
 */
import { ERAS, UPGRADES, type EraId, type UpId } from './content';
import { RULES } from './rules';

export interface DolinaProgress {
  v: 1;
  /** runs (sessions) saved */
  sessions: number;
  /** metres of the valley, all time */
  total: number;
  /** sparks in hand, and all ever (the looks) */
  sparks: number;
  sparksAll: number;
  /** upgrade levels */
  ups: Record<UpId, number>;
  /** the furthest era a run has entered (0: Babel), and the era the next run starts in */
  reached: number;
  startEra: number;
  /** guardians beaten, all time; dawn gates passed; Świty lit */
  guards: number;
  gates: number;
  dawns: number;
  /** Światło blocks begun, all time: every 4th is blind ("Mgła") from the 3rd session */
  pushes: number;
  /** records: metres per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  bestCombo: number;
  /** the day's gift: the day it was given */
  giftDay: string;
}

const freshUps = (): Record<UpId, number> => Object.fromEntries(UPGRADES.map(id => [id, 0])) as Record<UpId, number>;

export function freshProgress(): DolinaProgress {
  return {
    v: 1, sessions: 0, total: 0, sparks: 0, sparksAll: 0, ups: freshUps(), reached: 0, startEra: 0,
    guards: 0, gates: 0, dawns: 0, pushes: 0, best: {}, lastLen: 0, bestCombo: 0, giftDay: '',
  };
}

// ── the looks ────────────────────────────────────────────────────
/** The look (0-based) for all sparks ever. */
export function lookOf(sparksAll: number): number {
  let r = 0;
  RULES.looks.forEach((at, i) => { if (sparksAll >= at) r = i; });
  return r;
}

/** Sparks at which the next look comes (null: the last). */
export function nextLookAt(sparksAll: number): number | null {
  const r = lookOf(sparksAll);
  return r + 1 < RULES.looks.length ? RULES.looks[r + 1] : null;
}

// ── the upgrades ─────────────────────────────────────────────────
/** An upgrade's level as saved (an older save may miss one: level 0). */
export const upLevel = (p: DolinaProgress, id: UpId): number =>
  Math.min(RULES.upMax[id], Math.max(0, Math.round(p.ups?.[id] ?? 0)));

/** The sparks for an upgrade's next level (null at the top). */
export function upPrice(id: UpId, level: number): number | null {
  if (level >= RULES.upMax[id]) return null;
  return Math.round(RULES.priceBase * RULES.priceGrowth ** level);
}

/** Buy an upgrade's next level if the sparks reach; true when bought. */
export function buyUp(p: DolinaProgress, id: UpId): boolean {
  const lv = upLevel(p, id), price = upPrice(id, lv);
  if (price === null || p.sparks < price) return false;
  p.sparks -= price;
  p.ups = { ...freshUps(), ...p.ups, [id]: lv + 1 };
  return true;
}

/** The cheapest upgrade on offer (for the card at the end of a run). */
export function cheapestUp(p: DolinaProgress): { id: UpId; price: number } | null {
  let best: { id: UpId; price: number } | null = null;
  for (const id of UPGRADES) {
    const price = upPrice(id, upLevel(p, id));
    if (price !== null && (!best || price < best.price)) best = { id, price };
  }
  return best;
}

// ── the eras ─────────────────────────────────────────────────────
/** The eras a run may start in: every era a run has entered. */
export const startEras = (p: DolinaProgress): EraId[] => ERAS.slice(0, Math.max(0, Math.min(ERAS.length - 1, p.reached)) + 1);

/** The era the next run starts in (index), within what is open. */
export const startEraOf = (p: DolinaProgress): number => Math.max(0, Math.min(startEras(p).length - 1, Math.round(p.startEra || 0)));

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: DolinaProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: DolinaProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
