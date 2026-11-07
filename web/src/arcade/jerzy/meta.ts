/**
 * What Jerzy i smok remembers between fights and the pure rules of its meta game: the kingdom's map
 * (the dragon now holding a town, and the scales already knocked off it — a fight not won in one
 * session goes on in the next), the dragons driven off (each adds one skill to the armoury for
 * good), the records per session length and a few counters.  No DOM, no randomness.
 */
import { ARMOURY, DRAGONS, type DragonSpec, type SkillId } from './content';
import { RULES } from './rules';

export interface JerzyProgress {
  v: 1;
  /** fights (sessions) saved */
  sessions: number;
  /** scales knocked off, all time */
  total: number;
  /** Tarcza blocks begun, all time: every 4th is blind ("Dym") from the 3rd session */
  pushes: number;
  /** the dragon now on the map (0, 1, 2… through the four dragons, circle after circle) and its scales already knocked off */
  dragon: number;
  damage: number;
  /** dragons driven off, all time */
  driven: number;
  /** records: scales per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** Miecze światła struck, flames put out, the highest level of a fight */
  swords: number;
  quenched: number;
  bestLevel: number;
}

export function freshProgress(): JerzyProgress {
  return { v: 1, sessions: 0, total: 0, pushes: 0, dragon: 0, damage: 0, driven: 0, best: {}, lastLen: 0, swords: 0, quenched: 0, bestLevel: 0 };
}

// ── the map ──────────────────────────────────────────────────────
/** The dragon at a place of the endless map: its kind (in turn) and the circle it comes back on. */
export function dragonAt(i: number): { spec: DragonSpec; circle: number } {
  const n = Math.max(0, Math.floor(i));
  return { spec: DRAGONS[n % DRAGONS.length], circle: Math.floor(n / DRAGONS.length) };
}

/** Scales per phase for a dragon on a circle (each circle stronger). */
export function phasesOf(spec: DragonSpec, circle: number): number[] {
  const k = 1 + RULES.circleUp * Math.max(0, circle);
  return spec.hp.map(h => Math.round(h * k));
}

/** All the scales of a dragon on a circle. */
export const hpOf = (spec: DragonSpec, circle: number): number => phasesOf(spec, circle).reduce((s, h) => s + h, 0);

/** The phase (0-based) and the scales left in it, for the damage already done. */
export function phaseAt(phases: readonly number[], damage: number): { phase: number; left: number } {
  let d = Math.max(0, damage);
  for (let i = 0; i < phases.length; i++) {
    if (d < phases[i]) return { phase: i, left: phases[i] - d };
    d -= phases[i];
  }
  return { phase: phases.length - 1, left: 0 };
}

/** The armoury after `driven` dragons: one skill kept for good with each, in order. */
export const armouryOf = (driven: number): SkillId[] => ARMOURY.slice(0, Math.max(0, Math.min(ARMOURY.length, Math.floor(driven))));

/** The skill the next dragon driven off will bring (null: the armoury is full). */
export const nextArmoury = (driven: number): SkillId | null => ARMOURY[Math.max(0, Math.floor(driven))] ?? null;

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: JerzyProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: JerzyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
