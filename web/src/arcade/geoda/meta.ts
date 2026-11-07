/**
 * What Geoda remembers between sessions (saved by the runner under "arcade:geoda"), version 2:
 * the records (best session, best board of the Klasyka, longest combo), the Wyprawa (the next
 * chamber and the stars of each one played), the mode the lobby chose, the cabinet (nine minerals,
 * each at the best tier the Szlif polished), and the push blocks counted for the blind schedule.
 *
 * Old saves (version 1: carats per session length, the Gablota with pył and pity) migrate in place
 * on first use: the best score and the session count stay, the rest starts over.  Every field is
 * checked by type, so an old field of another type never crashes anything.
 */
import { MINERALS, TIERS } from './content';
import { RULES } from './rules';

export type Mode = 'adventure' | 'classic';

export interface GeodaProgress {
  ver: 2;
  sessions: number;
  /** the best session score (ct) */
  best: number;
  /** the best single board of the Klasyka (ct) */
  bestBoard: number;
  /** the longest combo */
  bestCombo: number;
  /** the Wyprawa: the chamber to play next (0-based) and the stars won in each */
  level: number;
  stars: number[];
  mode: Mode;
  /** the cabinet: each mineral's best tier (null: not found yet) */
  cabinet: (number | null)[];
  polished: number;
  lines: number;
  /** all ct ever banked */
  total: number;
  /** push blocks begun across sessions (every 4th is blind from the 3rd session) */
  pushes: number;
  /** coach marks already shown (later sessions only explain what is new) */
  seen: string[];
}

export function freshProgress(): GeodaProgress {
  return {
    ver: 2, sessions: 0, best: 0, bestBoard: 0, bestCombo: 0, level: 0, stars: [], mode: 'adventure',
    cabinet: MINERALS.map(() => null), polished: 0, lines: 0, total: 0, pushes: 0, seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * Bring a loaded save to version 2, in place (idempotent).  A version-1 save keeps its best score
 * (the best over its session lengths) and its session count; everything else starts fresh.  A
 * version-2 save only gets its fields checked.
 */
export function migrate(p: GeodaProgress): GeodaProgress {
  const raw = p as unknown as Record<string, unknown>;
  const fresh = freshProgress();
  // a version-1 save (merged over fresh defaults, so it carries `ver: 2` from them) still has its `v`
  if (raw.ver !== 2 || raw.v !== undefined || typeof raw.best !== 'number') {
    let best = 0;
    if (raw.best && typeof raw.best === 'object') for (const v of Object.values(raw.best as Record<string, unknown>)) best = Math.max(best, num(v));
    else best = num(raw.best);
    const sessions = Math.max(0, Math.floor(num(raw.sessions)));
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(raw, fresh, { best, sessions });
    return p;
  }
  // a version-2 save: every field of the right type
  for (const k of ['sessions', 'best', 'bestBoard', 'bestCombo', 'level', 'polished', 'lines', 'total', 'pushes'] as const) raw[k] = Math.max(0, num(raw[k]));
  if (!Array.isArray(raw.stars)) raw.stars = [];
  p.stars = p.stars.map(s => Math.max(0, Math.min(3, Math.floor(num(s)))));
  if (raw.mode !== 'adventure' && raw.mode !== 'classic') raw.mode = 'adventure';
  if (!Array.isArray(raw.cabinet) || raw.cabinet.length !== MINERALS.length) raw.cabinet = fresh.cabinet;
  p.cabinet = p.cabinet.map(v => (typeof v === 'number' && v >= 0 ? Math.min(TIERS.length - 1, Math.floor(v)) : null));
  if (!Array.isArray(raw.seen)) raw.seen = [];
  p.seen = p.seen.filter(s => typeof s === 'string');
  return p;
}

/** The best headline so far (null: never played). */
export const bestOf = (p: GeodaProgress): number | null => {
  migrate(p);
  return p.sessions > 0 || p.best > 0 ? p.best : null;
};

// ── the Wyprawa ─────────────────────────────────────────────────

export interface ChamberSpec {
  level: number;
  /** rock cells in the starting board */
  rock: number;
  /** what to collect: [jewel kind, count] */
  goal: [number, number][];
  /** points in the chamber for ★★ and ★★★ */
  stars: [number, number];
  /** the seed of its starting board */
  seed: number;
}

const span = (start: number, step: number, max: number, level: number) => Math.min(max, Math.round(start + step * level));

/** A chamber's spec: more rock and more jewels as they go, one kind first, then two, then three. */
export function chamber(level: number): ChamberSpec {
  const R = RULES;
  const kinds = level < 2 ? 1 : level < 6 ? 2 : 3;
  const total = span(R.goalStart, R.goalStep, R.goalMax, level);
  const first = (level * 3) % 4;
  const goal: [number, number][] = [];
  for (let k = 0; k < kinds; k++) {
    const share = Math.round(total / kinds);
    goal.push([((first + k) % 4) + 1, Math.max(2, k === kinds - 1 ? total - share * (kinds - 1) : share)]);
  }
  return {
    level,
    rock: span(R.rockStart, R.rockStep, R.rockMax, level),
    goal,
    stars: [R.starBase[0] + R.starStep[0] * level, R.starBase[1] + R.starStep[1] * level],
    seed: 7919 * (level + 1) + 17,
  };
}

/** Stars for a finished chamber: one for the goal, two and three for its points. */
export const starsFor = (spec: ChamberSpec, points: number): number => 1 + (points >= spec.stars[0] ? 1 : 0) + (points >= spec.stars[1] ? 1 : 0);

export const totalStars = (p: GeodaProgress): number => p.stars.reduce((s, v) => s + (v || 0), 0);

// ── the cabinet ─────────────────────────────────────────────────

/** The mineral the next polished gem is: the first ones are always missing ones (the set is sure to complete). */
export function nextMineral(p: GeodaProgress, rng: () => number): number {
  const missing = p.cabinet.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
  if (missing.length) return missing[Math.min(missing.length - 1, Math.floor(rng() * missing.length))];
  // the set is complete: the plainest one gets the chance to be lifted
  const low = Math.min(...p.cabinet.map(v => v ?? 0));
  const plain = p.cabinet.map((v, i) => ((v ?? 0) === low ? i : -1)).filter(i => i >= 0);
  return plain[Math.min(plain.length - 1, Math.floor(rng() * plain.length))];
}

/** Put a gem in the cabinet: a new mineral, or a better tier of one already there. */
export function shelve(p: GeodaProgress, m: number, tier: number): 'new' | 'up' | 'same' {
  const had = p.cabinet[m];
  const v = Math.max(0, Math.min(TIERS.length - 1, tier));
  if (had === null || had === undefined) {
    p.cabinet[m] = v;
    return 'new';
  }
  if (v > had) {
    p.cabinet[m] = v;
    return 'up';
  }
  return 'same';
}

export const found = (p: GeodaProgress): number => p.cabinet.filter(v => v !== null && v !== undefined).length;
export const complete = (p: GeodaProgress): boolean => found(p) === MINERALS.length;
