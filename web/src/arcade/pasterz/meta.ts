/**
 * What Pasterz remembers between sessions and the pure rules of its meta game (no DOM, no
 * randomness):
 *
 *   the hills map    eight hills played in turn, round by round; each keeps its crowns (first places)
 *   the hundred      Luke 15:4: the home flock grows across rounds toward a hundred, then a new season
 *   the lost lambs   the lost one of a round, carried home, gets one of twelve names (a collection)
 *   the wardrobe     cloaks, crooks and Łatek's coats, one new every RULES.unlockEvery sheep gathered
 *   records          the best headline per session length
 *
 * Version 2 (the Crowd City rebuild) replaced version 1's pastures and missions.  An old save is
 * migrated in place on first use: the records and the session count stay, the rest starts afresh.
 */
import { LAMBS, SKINS, UNLOCKS, type SkinKind } from './content';
import { RULES } from './rules';

export interface PasterzProgress {
  ver: 2;
  /** sessions saved */
  sessions: number;
  /** records: the headline per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** sheep gathered (round scores), all time: the wardrobe opens with it */
  total: number;
  /** rounds played and won (a crown), all time */
  rounds: number;
  crowns: number;
  /** the hills map: the next hill to play, and the crowns won on each */
  hill: number;
  hillCrowns: number[];
  /** the hundred: the home flock now (0..99) and the hundreds completed (seasons) */
  flock: number;
  season: number;
  /** the named lambs (indices into LAMBS) and lost lambs carried home, all time */
  lambs: number[];
  lambsFound: number;
  /** Wołanie blocks begun, all time: every 4th is blind ("Zmrok") from the 3rd session */
  calls: number;
  /** the wardrobe: how many unlocks have come (UNLOCKS order), and what is worn */
  unlocked: number;
  wear: Record<SkinKind, number>;
  /** the tutorial's lessons done (each coach mark once) */
  taught: string[];
  /** the most stars in one night, the biggest flock in one round */
  bestStars: number;
  bestFlock: number;
}

export function freshProgress(): PasterzProgress {
  return {
    ver: 2, sessions: 0, best: {}, lastLen: 0, total: 0, rounds: 0, crowns: 0, hill: 0, hillCrowns: [],
    flock: 0, season: 0, lambs: [], lambsFound: 0, calls: 0, unlocked: 0, wear: { cloak: 0, crook: 0, dog: 0 },
    taught: [], bestStars: 0, bestFlock: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * An old save (version 1, or anything odd) becomes version 2 in place: the session count and the
 * records stay, everything else starts afresh.  Fields of the wrong type are repaired, never trusted.
 * Returns true when it changed something.
 */
export function migrate(p: PasterzProgress): boolean {
  const raw = p as unknown as Record<string, unknown>;
  // the runner merges a save over fresh defaults, so an old save arrives with `ver: 2` from them and its own `v: 1`
  const old = raw.v !== undefined || raw.ver !== 2;
  if (!old && isSound(p)) return false;
  const fresh = freshProgress();
  const sessions = Math.max(0, Math.floor(num(raw.sessions)));
  const best: Record<string, number> = {};
  if (raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)) {
    for (const [k, v] of Object.entries(raw.best as Record<string, unknown>)) if (num(v) > 0) best[k] = num(v);
  }
  const lastLen = Math.max(0, num(raw.lastLen));
  const keep = old ? {} : { ...raw };
  for (const k of Object.keys(raw)) delete raw[k];
  Object.assign(raw, fresh, keep, { ver: 2, sessions, best, lastLen });
  repair(p);
  return true;
}

function isSound(p: PasterzProgress): boolean {
  return Array.isArray(p.lambs) && Array.isArray(p.hillCrowns) && Array.isArray(p.taught) && !!p.wear && typeof p.wear === 'object'
    && typeof p.total === 'number' && typeof p.hill === 'number' && typeof p.flock === 'number';
}

/** Every field to its type (a version-2 save written by an older build of this version). */
function repair(p: PasterzProgress): void {
  const f = freshProgress();
  const r = p as unknown as Record<string, unknown>;
  for (const k of ['total', 'rounds', 'crowns', 'hill', 'flock', 'season', 'lambsFound', 'calls', 'unlocked', 'bestStars', 'bestFlock'] as const) {
    r[k] = Math.max(0, Math.floor(num(r[k], f[k])));
  }
  if (!Array.isArray(p.lambs)) p.lambs = [];
  p.lambs = p.lambs.filter(i => typeof i === 'number' && i >= 0 && i < LAMBS.length);
  if (!Array.isArray(p.hillCrowns)) p.hillCrowns = [];
  p.hillCrowns = p.hillCrowns.map(v => Math.max(0, num(v)));
  if (!Array.isArray(p.taught)) p.taught = [];
  p.taught = p.taught.filter(s => typeof s === 'string');
  const w = (p.wear && typeof p.wear === 'object' ? p.wear : {}) as Record<string, unknown>;
  p.wear = { cloak: Math.floor(num(w.cloak)), crook: Math.floor(num(w.crook)), dog: Math.floor(num(w.dog)) };
  for (const k of ['cloak', 'crook', 'dog'] as const) if (!owns(p, k, p.wear[k])) p.wear[k] = 0;
}

// ── the hundred ──────────────────────────────────────────────────
/** A round's flock adds flock / 10 (at least 1) to the home flock; every hundred starts a new season.  Returns the sheep added. */
export function homeFor(flock: number): number {
  return Math.max(1, Math.floor(Math.max(0, flock) / RULES.hundredPer));
}
export function addHome(p: PasterzProgress, n: number): number {
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
export function nextLamb(p: PasterzProgress): number | null {
  for (const l of LAMBS) if (!p.lambs.includes(l.index)) return l.index;
  return null;
}

/** A lost lamb carried home: the next of the twelve names; once all are named, they come home again in turn. */
export function nameLamb(p: PasterzProgress): { index: number; isNew: boolean } {
  p.lambsFound++;
  const next = nextLamb(p);
  if (next !== null) {
    p.lambs.push(next);
    return { index: next, isNew: true };
  }
  return { index: (p.lambsFound - 1) % LAMBS.length, isNew: false };
}

// ── the wardrobe ─────────────────────────────────────────────────
/** Unlocks earned by a total of sheep gathered. */
export const unlocksFor = (total: number): number => Math.min(UNLOCKS.length, Math.floor(Math.max(0, total) / RULES.unlockEvery));

export function owns(p: PasterzProgress, kind: SkinKind, index: number): boolean {
  if (index === 0) return true;
  if (!(index > 0) || index >= SKINS[kind].length) return false;
  return UNLOCKS.slice(0, p.unlocked).some(u => u.kind === kind && u.index === index);
}

/** The total grew: every new unlock comes and is worn at once ("new" moments).  Returns the new ones. */
export function openWardrobe(p: PasterzProgress): { kind: SkinKind; index: number }[] {
  const want = unlocksFor(p.total);
  const out: { kind: SkinKind; index: number }[] = [];
  while (p.unlocked < want) {
    const u = UNLOCKS[p.unlocked++];
    p.wear[u.kind] = u.index;
    out.push(u);
  }
  return out;
}

/** Sheep still to gather for the next unlock (null: the wardrobe is full), and the share done. */
export function nextUnlock(p: PasterzProgress): { left: number; share: number } | null {
  if (p.unlocked >= UNLOCKS.length) return null;
  const goal = (p.unlocked + 1) * RULES.unlockEvery;
  const from = p.unlocked * RULES.unlockEvery;
  return { left: Math.max(0, goal - p.total), share: Math.max(0, Math.min(1, (p.total - from) / RULES.unlockEvery)) };
}

export function wear(p: PasterzProgress, kind: SkinKind, index: number): boolean {
  if (!owns(p, kind, index)) return false;
  p.wear[kind] = index;
  return true;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: PasterzProgress, plannedSec: number): number | null {
  const v = p.best?.[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: PasterzProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best ?? {}).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
