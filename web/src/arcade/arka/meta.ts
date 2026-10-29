/**
 * What Arka remembers between sessions and the pure rules of its meta game: "Nowa ziemia" (the new
 * land), where every pair led out settles into its kind's valley and a kind's young appear after
 * three pairs; the twelve kinds coming out of the ark on a schedule; the family's homestead built
 * from planks, carved posts and the neighbours' gift; olive trees; the leaves in store and the
 * dove's grace; the day's hold and the day's gift; the records.  No DOM; no randomness.
 */
import { KINDS, STAGES, YOUNG_AT, kindsAt, type KindId, type Stage } from './content';

export interface ArkaProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** pairs led out onto the new land, all time */
  pairs: number;
  /** records: the best session (pairs), per planned length too ("180": 14), the longest chain, the most ★★★ holds in a session, the most planks in one Day */
  bestSession: number;
  bestByLen: Record<string, number>;
  bestChain: number;
  bestStars: number;
  bestPlanks: number;
  /** pairs settled per kind */
  settled: Record<string, number>;
  /** kinds whose young have appeared, in the order they came */
  young: string[];
  /** homestead points: planks carried down, carved posts, the neighbours' planks */
  home: number;
  olives: number;
  /** olive leaves in store (at most MAX_LEAVES) */
  leaves: number;
  /** Evenings ended, all time (the first always brings a leaf), and Evenings in a row without one (the third brings one anyway) */
  evenings: number;
  dry: number;
  /** Day blocks begun, all time: every 4th is a blind "Mgła poranna" from the 4th session */
  days: number;
  /** the day's hold: the day it was cleared, its stars and seconds */
  dailyDay: string;
  dailyStars: number;
  dailySec: number;
  /** the day the neighbours' planks came (the day's first session) */
  giftDay: string;
  lastDay: string;
}

export const MAX_LEAVES = 3;
/** The neighbours' planks: the same for everyone who comes, whatever the score (Matthew 20:1-16). */
export const DAY_GIFT = 3;

export function freshProgress(): ArkaProgress {
  return {
    v: 1, sessions: 0, pairs: 0, bestSession: 0, bestByLen: {}, bestChain: 0, bestStars: 0, bestPlanks: 0,
    settled: {}, young: [], home: 0, olives: 0, leaves: 0, evenings: 0, dry: 0, days: 0,
    dailyDay: '', dailyStars: 0, dailySec: 0, giftDay: '', lastDay: '',
  };
}

/** The kinds out of the ark by the `session`-th session, in their order. */
export const kindsOut = (session: number): readonly KindId[] => KINDS.slice(0, kindsAt(session));

/** Pairs of a kind settled so far. */
export const settledOf = (p: ArkaProgress, k: KindId): number => p.settled[k] ?? 0;

export const hasYoung = (p: ArkaProgress, k: KindId): boolean => p.young.includes(k);

/**
 * Settle one pair of `k` in its valley: the all-time counts grow, and the third pair of a kind
 * brings its young.  Returns true when the young came with this pair.
 */
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
  /** the stage being built (null: the homestead is complete), and the points toward it */
  next: Stage | null;
  have: number;
  need: number;
}

export function homestead(points: number): HomeState {
  const pts = Math.max(0, Math.floor(points));
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

/** Add homestead points; the stages they complete (their indices). */
export function addHome(p: ArkaProgress, n: number): number[] {
  const before = homestead(p.home).built;
  p.home += Math.max(0, Math.round(n));
  const after = homestead(p.home).built;
  const out: number[] = [];
  for (let s = before; s < after; s++) out.push(s);
  return out;
}

// ── the dove ─────────────────────────────────────────────────────
/**
 * Whether an Evening's dove brings a leaf: a passed verdict does; the player's first Evening ever
 * always does, and so does the third after two without one (grace never waits on the band).
 */
export function doveBringsLeaf(p: ArkaProgress, verdict: boolean | null): { leaf: boolean; grace: boolean } {
  if (verdict) return { leaf: true, grace: false };
  const grace = p.evenings === 0 || p.dry >= 2;
  return { leaf: grace, grace };
}

/** An Evening ended: count it, store the leaf (at most three), and keep the run of Evenings without one. */
export function endEvening(p: ArkaProgress, leaf: boolean): { stored: boolean } {
  p.evenings++;
  if (!leaf) {
    p.dry++;
    return { stored: false };
  }
  p.dry = 0;
  const stored = p.leaves < MAX_LEAVES;
  if (stored) p.leaves++;
  return { stored };
}

// ── dates ────────────────────────────────────────────────────────
/** A stable 32-bit mix of a seed and a number (the day's hold, the session's holds). */
export function mix(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
