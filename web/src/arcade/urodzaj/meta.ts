/**
 * What Urodzaj remembers between sessions and the pure rules of its meta game: the circle of fruits
 * (how many of each tier were ever made: the lobby's ring lights the ones reached), the festivals in
 * the year's turn (three missions each, done by touch alone; each festival sets one decoration on the
 * village table), Kosz dnia (the day's first session drops the same fruit for everyone) and the
 * records.  No DOM, no randomness.
 *
 * Old saves (version 1, the mosaic game with its guests and dew) are migrated in place on first use:
 * the best session and the session count stay, the rest starts over.
 */
import { MAX_TIER, festivalAt, type Mission } from './content';

export interface UrodzajProgress {
  ver: 2;
  /** saved sessions (result(): Math.max with this session's number) */
  sessions: number;
  /** the best session's points (result(): Math.max) */
  bestSession: number;
  /** the best single basket, the highest tier ever made (1..11), the longest chain (merges in one) */
  bestBasket: number;
  bestTier: number;
  bestChain: number;
  /** all-time points, baskets carried to the table, merges (live, Math.max with the session's start + its own) */
  harvest: number;
  baskets: number;
  merges: number;
  /** fruit made by a merge, per tier (index 0 = tier 1, never made by a merge) */
  made: number[];
  /** harvest winds blown, fruit gathered by the gleaners, great clusters carried off on the pole */
  winds: number;
  gleaned: number;
  poles: number;
  /** push blocks begun, all time: every 4th is blind from the 3rd session */
  pushes: number;
  /** the festival now (index into festivalAt) and its missions' progress (a sum or the best feat), parallel to its missions */
  fest: number;
  festProg: number[];
  /** "Kosz dnia": the day of the last one, its score and the best ever */
  dailyDay: string;
  dailyScore: number;
  dailyBest: number;
  lastDay: string;
}

export function freshProgress(): UrodzajProgress {
  return {
    ver: 2, sessions: 0, bestSession: 0, bestBasket: 0, bestTier: 0, bestChain: 0, harvest: 0, baskets: 0, merges: 0,
    made: new Array<number>(MAX_TIER).fill(0), winds: 0, gleaned: 0, poles: 0, pushes: 0, fest: 0, festProg: [0, 0, 0],
    dailyDay: '', dailyScore: 0, dailyBest: 0, lastDay: '',
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * Bring any saved shape to version 2, in place (the runner merged the save over freshProgress(), so
 * old fields may sit next to new ones with a different type).  Idempotent.
 */
export function migrate(p: UrodzajProgress): UrodzajProgress {
  const raw = p as unknown as Record<string, unknown>;
  // the first version's own version field (`v`) still sits in a merged old save; freshProgress() brought `ver`
  if (raw.ver !== 2 || raw.v !== undefined) {
    const sessions = Math.max(0, Math.floor(num(raw.sessions)));
    const best = Math.max(0, num(raw.bestSession));
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(raw, freshProgress(), { sessions, bestSession: best });
  }
  // a v2 save can still carry a broken field (a hand edit, a crash mid-save): heal what the rules read
  if (!Array.isArray(p.made) || p.made.length !== MAX_TIER) p.made = new Array<number>(MAX_TIER).fill(0).map((_, i) => num((p.made as unknown[] | undefined)?.[i]));
  if (!Array.isArray(p.festProg) || p.festProg.length !== 3) p.festProg = [0, 0, 0];
  for (const k of ['sessions', 'bestSession', 'bestBasket', 'bestTier', 'bestChain', 'harvest', 'baskets', 'merges', 'winds', 'gleaned', 'poles',
    'pushes', 'fest', 'dailyScore', 'dailyBest'] as const) p[k] = Math.max(0, num(p[k]));
  for (const k of ['dailyDay', 'lastDay'] as const) if (typeof p[k] !== 'string') p[k] = '';
  return p;
}

// ── the circle of fruits ─────────────────────────────────────────
/** Tiers reached (made by a merge, or dropped: the five smallest count once played). */
export function reached(p: UrodzajProgress): number {
  return Math.max(p.sessions > 0 ? 5 : 0, Math.min(MAX_TIER, p.bestTier));
}

// ── the festivals ────────────────────────────────────────────────
/** Whether a mission's progress meets it. */
export const missionDone = (m: Mission, v: number): boolean => v >= m.n;

/** Sums grow (merges, points); feats keep the best (a fruit's tier, a basket, a chain, stars). */
export const isSum = (m: Mission): boolean => m.kind === 'merges' || m.kind === 'harvest';

export interface FestEvent {
  /** what happened: the festival's missions all done (celebrated, a decoration set), or one mission just done */
  kind: 'mission' | 'festival';
  fest: number;
  mission: number;
}

/**
 * Feed what just happened to the current festival: `kind` and the value (for a sum: how much to add;
 * for a feat: the value reached).  Returns what got done; a festival whose three missions are all
 * met is celebrated and the next one begins (its progress at zero).
 */
export function festFeed(p: UrodzajProgress, kind: Mission['kind'], v: number): FestEvent[] {
  const out: FestEvent[] = [];
  const f = festivalAt(p.fest);
  f.missions.forEach((m, i) => {
    if (m.kind !== kind) return;
    const was = p.festProg[i];
    if (missionDone(m, was)) return;
    p.festProg[i] = isSum(m) ? was + v : Math.max(was, v);
    if (missionDone(m, p.festProg[i])) out.push({ kind: 'mission', fest: p.fest, mission: i });
  });
  if (out.length && f.missions.every((m, i) => missionDone(m, p.festProg[i]))) {
    out.push({ kind: 'festival', fest: p.fest, mission: -1 });
    p.fest++;
    p.festProg = [0, 0, 0];
  }
  return out;
}

/** Decorations on the table: one per festival celebrated, the six in turn. */
export const decorCount = (p: UrodzajProgress): number => Math.min(6, p.fest);

// ── stars and the day ────────────────────────────────────────────
/** Stars for a basket's score (0–3). */
export function starsFor(score: number, steps: readonly number[]): number {
  let n = 0;
  for (const s of steps) if (score >= s) n++;
  return n;
}

/** The day's first saved session plays Kosz dnia. */
export const dailyDue = (p: UrodzajProgress, day: string): boolean => p.dailyDay !== day;
