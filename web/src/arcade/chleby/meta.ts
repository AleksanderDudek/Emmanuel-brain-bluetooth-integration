/**
 * What Chleby i ryby remembers between sessions and the pure rules of its meta game: the level the
 * player stands at on the path of hillsides (chapters of four, the fourth the Pelikan's), the stars
 * won on each level, the grain in hand and the four upgrades it buys (the stream, the start gate,
 * the fish, the big basket), the records per session length, the story cards seen, the day's gift.
 * No DOM, no randomness.
 */
import { RULES, UPGRADES, type Upgrade } from './rules';

export interface ChlebyProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** people fed, all time; levels finished; baskets of crumbs; Pelikans sated; big baskets poured */
  total: number;
  levels: number;
  baskets: number;
  pelikans: number;
  bigs: number;
  /** the level the player stands at (0-based, all chapters) */
  level: number;
  /** the best stars per level (index = level) */
  stars: number[];
  /** grain in hand, and all time */
  grain: number;
  grainAll: number;
  /** upgrade levels (0 = none) */
  up: Record<Upgrade, number>;
  /** Rozdawanie blocks begun, all time: every 4th is blind ("Mgła nad jeziorem") from the 3rd session */
  calls: number;
  /** the highest golden-gate multiplier ever seen working */
  bestGold: number;
  /** records: people fed per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the chapters whose story card was shown (the opening card is chapter −1 → bit 0 of `seen` is the opening) */
  seen: number;
  /** the day's gift */
  giftDay: string;
}

const freshUp = (): Record<Upgrade, number> => ({ stream: 0, start: 0, fish: 0, big: 0 });

export function freshProgress(): ChlebyProgress {
  return {
    v: 1, sessions: 0, total: 0, levels: 0, baskets: 0, pelikans: 0, bigs: 0, level: 0, stars: [], grain: 0, grainAll: 0,
    up: freshUp(), calls: 0, bestGold: 1, best: {}, lastLen: 0, seen: 0, giftDay: '',
  };
}

// ── upgrades ─────────────────────────────────────────────────────
export const maxLevel = (u: Upgrade): number => RULES.prices[u].length;

/** An upgrade's level as saved (an older save may miss one: 0). */
export const upLevel = (p: ChlebyProgress, u: Upgrade): number =>
  Math.min(maxLevel(u), Math.max(0, Math.round(p.up?.[u] ?? 0)));

/** The grain for an upgrade's next level (null at the top). */
export function upPrice(u: Upgrade, level: number): number | null {
  const list = RULES.prices[u];
  return level >= list.length ? null : list[level];
}

/** Buy an upgrade's next level if the grain allows; true when bought. */
export function buyUp(p: ChlebyProgress, u: Upgrade): boolean {
  const lv = upLevel(p, u), price = upPrice(u, lv);
  if (price === null || p.grain < price) return false;
  p.grain -= price;
  p.up = { ...freshUp(), ...p.up, [u]: lv + 1 };
  return true;
}

/** The upgrades on offer (not at the top), cheapest first. */
export function offers(p: ChlebyProgress): { u: Upgrade; level: number; price: number; can: boolean }[] {
  return UPGRADES
    .map(u => ({ u, level: upLevel(p, u), price: upPrice(u, upLevel(p, u)) }))
    .filter((o): o is { u: Upgrade; level: number; price: number } => o.price !== null)
    .sort((a, b) => a.price - b.price)
    .map(o => ({ ...o, level: o.level + 1, can: p.grain >= o.price }));
}

/** The stream's rate (pieces/s) and the fish's spacing at the saved levels. */
export const streamRate = (p: ChlebyProgress): number => RULES.stream + RULES.streamPerLevel * upLevel(p, 'stream');
export const fishEvery = (p: ChlebyProgress): number => RULES.fishEvery[Math.min(RULES.fishEvery.length - 1, upLevel(p, 'fish'))];
export const bigLoaves = (p: ChlebyProgress): number => RULES.bigLoaves + RULES.bigPerLevel * upLevel(p, 'big');

// ── stars ────────────────────────────────────────────────────────
/**
 * A finished level's stars: one always (the disciples finish what time leaves), two when the player
 * fed everyone, three when that left a good share of the time or the rests filled enough baskets.
 */
export function starsFor(byTime: boolean, timeLeftShare: number, baskets: number): number {
  if (byTime) return 1;
  return timeLeftShare >= RULES.starTime || baskets >= RULES.starBaskets ? 3 : 2;
}

/** All stars won. */
export const starsAll = (p: ChlebyProgress): number => (p.stars ?? []).reduce((s, n) => s + (n || 0), 0);

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: ChlebyProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: ChlebyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

/** A story card seen: bit 0 the opening, bit c + 1 the chapter c (of the six). */
export const seenCard = (p: ChlebyProgress, bit: number): boolean => ((p.seen ?? 0) & (1 << bit)) !== 0;
export const markCard = (p: ChlebyProgress, bit: number): void => { p.seen = (p.seen ?? 0) | (1 << bit); };
