/**
 * What Arka remembers between sessions (v2) and the pure rules of its meta game: the saga (the level
 * to play next and the best stars of every level), "Nowa ziemia" (every pair led out settles in its
 * kind's valley, a kind's young appear after three pairs), the family's homestead raised by the
 * saga's stars, an olive tree for every chapter finished, the coach marks already shown, and the
 * records.  No DOM; no randomness.
 *
 * A v1 save (the landing-and-planks Arka) is migrated in place on first use: its best session and its
 * session count stay, the rest starts over (the saga is new).  Fields of an unexpected type never
 * crash the game: they are read as their fresh value.
 */
import { CHAPTER_LEN, STAGES, YOUNG_AT, type KindId, type Stage } from './content';

export interface ArkaProgress {
  ver: 2;
  /** sessions played */
  sessions: number;
  /** records: the best session (pairs), the longest run of clean sends, the most pairs leaving back to back in a session */
  bestSession: number;
  bestChain: number;
  bestBonus: number;
  /** the saga: the level to play next (from 1), and the best stars of every level played (index = level − 1) */
  level: number;
  stars: number[];
  /** pairs led out onto the new land, all time, and per kind */
  pairs: number;
  settled: Record<string, number>;
  /** kinds whose young have appeared, in the order they came */
  young: string[];
  /** coach marks already shown (tap, bump, pair, dove, mist, rainbow, file, sleepy, turner, locked) */
  taught: string[];
  /** the story's chapter cards already shown (index) */
  chapters: number;
  /** Mgła (push) blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  lastDay: string;
}

export function freshProgress(): ArkaProgress {
  return {
    ver: 2, sessions: 0, bestSession: 0, bestChain: 0, bestBonus: 0, level: 1, stars: [],
    pairs: 0, settled: {}, young: [], taught: [], chapters: 0, pushes: 0, lastDay: '',
  };
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Bring a loaded save to v2, in place.  An old (v1) or unknown save keeps its best session and its
 * session count and starts the rest fresh; a v2 save has every field checked for its type.
 */
export function migrate(p: ArkaProgress): ArkaProgress {
  const raw = p as unknown as Record<string, unknown>;
  const fresh = freshProgress() as unknown as Record<string, unknown>;
  // a v1 save carries `v: 1` (merged over a fresh v2, so `ver` alone cannot tell)
  if (raw.ver !== 2 || 'v' in raw) {
    const best = Math.max(0, Math.floor(num(raw.bestSession)));
    const sessions = Math.max(0, Math.floor(num(raw.sessions)));
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(raw, fresh, { bestSession: best, sessions });
    return p;
  }
  for (const k of Object.keys(raw)) if (!(k in fresh)) delete raw[k];
  for (const [k, def] of Object.entries(fresh)) {
    const v = raw[k];
    if (typeof def === 'number') raw[k] = Math.max(k === 'level' ? 1 : 0, Math.floor(num(v, def)));
    else if (typeof def === 'string') raw[k] = typeof v === 'string' ? v : def;
    else if (Array.isArray(def)) raw[k] = Array.isArray(v) ? v.filter(x => (k === 'stars' ? typeof x === 'number' : typeof x === 'string')) : [];
    else if (isObj(def)) raw[k] = isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'number')) : {};
  }
  raw.ver = 2;
  return p;
}

/** The best headline so far (null: never played). */
export const bestOf = (p: ArkaProgress): number | null => (p.sessions > 0 ? p.bestSession : null);

// ── the saga ─────────────────────────────────────────────────────
/** All stars of the saga (each level's best). */
export const totalStars = (p: ArkaProgress): number => p.stars.reduce((s, v) => s + (v > 0 ? v : 0), 0);

/** Levels cleared so far (the next level − 1). */
export const levelsDone = (p: ArkaProgress): number => Math.max(0, p.level - 1);

/** Chapters finished (an olive tree each). */
export const olivesOf = (p: ArkaProgress): number => Math.floor(levelsDone(p) / CHAPTER_LEN);

/**
 * A board cleared: keep its best stars, and move the saga on when it was the frontier.  Returns the
 * stars gained (the improvement over the level's best) and whether the saga moved.
 */
export function clearLevel(p: ArkaProgress, n: number, stars: number): { gained: number; advanced: boolean } {
  const i = Math.max(0, n - 1);
  while (p.stars.length <= i) p.stars.push(0);
  const before = p.stars[i];
  p.stars[i] = Math.max(before, stars);
  const advanced = n >= p.level;
  if (advanced) p.level = n + 1;
  return { gained: p.stars[i] - before, advanced };
}

// ── the new land ─────────────────────────────────────────────────
export const settledOf = (p: ArkaProgress, k: KindId): number => p.settled[k] ?? 0;
export const hasYoung = (p: ArkaProgress, k: KindId): boolean => p.young.includes(k);

/** Settle one pair of `k` in its valley; true when the kind's young came with this pair. */
export function settle(p: ArkaProgress, k: KindId): boolean {
  p.pairs++;
  p.settled[k] = settledOf(p, k) + 1;
  if (p.settled[k] >= YOUNG_AT && !hasYoung(p, k)) {
    p.young.push(k);
    return true;
  }
  return false;
}

// ── the homestead ────────────────────────────────────────────────
export interface HomeState {
  /** stages standing */
  built: number;
  /** the stage being built (null: the homestead is complete), and the stars toward it */
  next: Stage | null;
  have: number;
  need: number;
}

export function homestead(stars: number): HomeState {
  const pts = Math.max(0, Math.floor(stars));
  let built = 0;
  for (const s of STAGES) {
    if (pts < s.at) {
      const from = built ? STAGES[built - 1].at : 0;
      return { built, next: s, have: pts - from, need: s.at - from };
    }
    built++;
  }
  return { built, next: null, have: 0, need: 0 };
}

/** Coach marks: whether `key` was shown already, and mark it shown (returns true the first time). */
export function teach(p: ArkaProgress, key: string): boolean {
  if (p.taught.includes(key)) return false;
  p.taught.push(key);
  return true;
}
