/**
 * What Latarnik remembers between sessions and the pure rules of its meta game: the harbour
 * village that grows from crates, the amber album with honest odds, crumbs and pity, the letters
 * in bottles, and the dates behind the welcome-back bonus and yesterday's reach ring.
 * No DOM; randomness only from the caller's generator.
 */
import { AMBER, CRAFT_OKRUCHY, DUPLICATE_OKRUCHY, SMOKEHOUSE, START_CRATES, TIERS, VILLAGE, type Tier, type VillageStep } from './content';

export interface LatarnikProgress {
  v: 1;
  /** sessions started */
  sessions: number;
  /** boats guided and crates delivered, all time (crates build the village) */
  boats: number;
  crates: number;
  /** "Gwiazdy latarni": Konwój blocks won */
  stars: number;
  /** records */
  bestSession: number;
  bestWatch: number;
  bestStreak: number;
  /** the farthest the light reached in a session (% of the sea's radius) */
  farthest: number;
  /** Konwój blocks begun, all time: every 4th is blind ("W ciemno") from the 3rd session */
  konwoje: number;
  /** album pieces owned (indices into AMBER), crumbs, and the session that last brought a new piece */
  amber: number[];
  okruchy: number;
  lastNewSession: number;
  /** letters found (the newest is LETTERS[letters − 1]) */
  letters: number;
  tallShips: number;
  /** the last session's day and crates (the smokehouse's welcome back) */
  lastDay: string;
  lastCrates: number;
  /** today's farthest reach and the last earlier day's (the faint ring to beat), in R */
  reachDay: string;
  reachBest: number;
  reachPrevDay: string;
  reachPrev: number;
  /** "Noc dnia": the day the date-seeded night was played, and its boats */
  dailyDay: string;
  dailyScore: number;
}

export function freshProgress(): LatarnikProgress {
  return {
    v: 1, sessions: 0, boats: 0, crates: START_CRATES, stars: 0, bestSession: 0, bestWatch: 0, bestStreak: 0, farthest: 0,
    konwoje: 0, amber: [], okruchy: 0, lastNewSession: -1, letters: 0, tallShips: 0, lastDay: '', lastCrates: 0,
    reachDay: '', reachBest: 0, reachPrevDay: '', reachPrev: 0, dailyDay: '', dailyScore: 0,
  };
}

// ── the village ──────────────────────────────────────────────────
export interface VillageState {
  /** steps standing */
  built: number;
  /** the step being built (null: the harbour is complete) and the crates toward it */
  next: VillageStep | null;
  have: number;
  need: number;
}

export function village(crates: number): VillageState {
  let left = Math.max(0, crates), built = 0;
  for (const s of VILLAGE) {
    if (left < s.cost) return { built, next: s, have: left, need: s.cost };
    left -= s.cost;
    built++;
  }
  return { built, next: null, have: left, need: 0 };
}

// ── the album ────────────────────────────────────────────────────
export const owned = (p: LatarnikProgress, piece: number): boolean => p.amber.includes(piece);

/**
 * What crumbs and pity give: the lowest missing tier across both sets — every common first, then
 * the rares, then the epics, each set in turn — so a rarer piece still comes from its feat.  A
 * legendary piece only last and only for crumbs (`legend`); pity never gives one.  Null: nothing left.
 */
export function nextMissing(p: LatarnikProgress, legend = true): number | null {
  for (const tier of TIERS) {
    if (tier === 'legend' && !legend) break;
    for (const a of AMBER) if (a.tier === tier && !p.amber.includes(a.index)) return a.index;
  }
  return null;
}

export const tierPool = (tier: Tier) => AMBER.filter(a => a.tier === tier);

/** The published odds: the chance that a draw of `tier` brings a piece not yet in the album. */
export function newChance(p: LatarnikProgress, tier: Tier): number {
  const pool = tierPool(tier);
  return pool.filter(a => !p.amber.includes(a.index)).length / pool.length;
}

export interface Draw {
  piece: number;
  isNew: boolean;
  /** pieces crafted from crumbs right after it */
  crafted: number[];
}

const pick = <T>(list: readonly T[], rnd: () => number): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

/**
 * One album draw: the feat decides the tier, the piece is drawn evenly within it.  A duplicate
 * becomes crumbs; with `forceNew` (pity) the draw takes a missing piece of the tier, or else what
 * pity gives (nextMissing without legends).
 */
export function drawAmber(p: LatarnikProgress, tier: Tier, rnd: () => number, forceNew = false): Draw {
  const pool = tierPool(tier);
  let piece = pick(pool, rnd).index;
  if (forceNew && owned(p, piece)) {
    const missing = pool.filter(a => !owned(p, a.index));
    piece = missing.length ? pick(missing, rnd).index : nextMissing(p, false) ?? piece;
  }
  const isNew = !owned(p, piece);
  if (isNew) p.amber.push(piece);
  else p.okruchy += DUPLICATE_OKRUCHY;
  return { piece, isNew, crafted: craft(p) };
}

/** Add crumbs (amber washed up in Cisza); every 25 become the album's next missing piece. */
export function addCrumbs(p: LatarnikProgress, n: number): number[] {
  p.okruchy += Math.max(0, Math.round(n));
  return craft(p);
}

function craft(p: LatarnikProgress): number[] {
  const out: number[] = [];
  while (p.okruchy >= CRAFT_OKRUCHY) {
    const m = nextMissing(p);
    if (m === null) break;
    p.okruchy -= CRAFT_OKRUCHY;
    p.amber.push(m);
    out.push(m);
  }
  return out;
}

// ── dates ────────────────────────────────────────────────────────
const dayNum = (d: string): number | null => {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
};

/** Whole days from `a` to `b` ("YYYY-MM-DD"); null when either is missing. */
export function daysBetween(a: string, b: string): number | null {
  const x = dayNum(a), y = dayNum(b);
  return x === null || y === null ? null : Math.round(y - x);
}

/** The smokehouse's welcome back after two days or more away: a small share of the last session's crates. */
export function welcomeBonus(p: LatarnikProgress, day: string): number {
  const away = daysBetween(p.lastDay, day);
  if (away === null || away < 2 || village(p.crates).built <= SMOKEHOUSE) return 0;
  return Math.min(40, Math.max(10, Math.round(p.lastCrates * 0.15)));
}
