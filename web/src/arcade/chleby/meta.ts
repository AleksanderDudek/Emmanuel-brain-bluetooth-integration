/**
 * What Chleby i ryby remembers between sessions (v2) and the pure rules of its meta game: the
 * level the player stands at on the path of hillsides (chapters of four, the fourth the Pelikan's),
 * the stars won on each level, the baskets of crumbs in the bank and the four upgrades they buy
 * (Strumień = the cannon's rate, Ryby = runners worth two, Wielki kosz = the champion, Bramka
 * startowa = a ×2 gate by the basket), the records per session length, the story cards seen and
 * the coach marks done, the day's gift.  No DOM, no randomness.
 *
 * Old saves (v1, the rolling-bread version) carry `v: 1` and other fields: `migrate()` keeps their
 * records, sessions and people fed, and starts the new path from its first level.
 */
import { RULES, UPGRADES, type Upgrade } from './rules';

export interface ChlebyProgress {
  ver: 2;
  /** sessions saved */
  sessions: number;
  /** people fed, all time; levels finished; Pelikans sated; Big Baskets sent */
  total: number;
  levels: number;
  pelikans: number;
  bigs: number;
  /** the level the player stands at (0-based, all chapters) */
  level: number;
  /** the best stars per level (index = level) */
  stars: number[];
  /** baskets of crumbs in the bank, the crumbs of the next one (0..1), and all baskets ever filled */
  bank: number;
  crumbs: number;
  bankAll: number;
  /** upgrade levels (0 = none) */
  up: Record<Upgrade, number>;
  /** Rozdawanie blocks begun, all time: every 4th is blind ("Mgła nad jeziorem") from the 3rd session */
  calls: number;
  /** the highest golden-gate multiplier ever seen working */
  bestGold: number;
  /** records: people fed per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** story cards shown: bit 0 the opening, bit c + 1 the chapter c */
  seen: number;
  /** coach marks whose control the player has done (bits of Teach) */
  taught: number;
  /** the day's gift */
  giftDay: string;
}

const freshUp = (): Record<Upgrade, number> => ({ rate: 0, fish: 0, big: 0, start: 0 });

export function freshProgress(): ChlebyProgress {
  return {
    ver: 2, sessions: 0, total: 0, levels: 0, pelikans: 0, bigs: 0, level: 0, stars: [], bank: 0, crumbs: 0, bankAll: 0,
    up: freshUp(), calls: 0, bestGold: 1, best: {}, lastLen: 0, seen: 0, taught: 0, giftDay: '',
  };
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);

/**
 * Bring a loaded save to v2, in place (idempotent).  A v1 save keeps its records, its sessions,
 * its people fed, its blind-block count and the day's gift; the rest starts fresh.  Fields of a
 * wrong type are reset rather than trusted.
 */
export function migrate(p: ChlebyProgress): ChlebyProgress {
  const o = p as unknown as Record<string, unknown>;
  const old = 'v' in o || o.ver !== 2;
  if (old) {
    const keep = {
      sessions: num(o.sessions), total: num(o.total), calls: num(o.calls), lastLen: num(o.lastLen),
      giftDay: typeof o.giftDay === 'string' ? o.giftDay : '',
      best: o.best && typeof o.best === 'object' && !Array.isArray(o.best) ? (o.best as Record<string, unknown>) : {},
    };
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, freshProgress(), keep);
  }
  // sanitise every field (an odd save never crashes the game)
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const k of Object.keys(f)) {
    const want = typeof f[k];
    if (Array.isArray(f[k])) { if (!Array.isArray(o[k])) o[k] = []; continue; }
    if (want === 'object') { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = f[k]; continue; }
    if (typeof o[k] !== want || (want === 'number' && !Number.isFinite(o[k] as number))) o[k] = f[k];
  }
  const best: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.best)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) best[k] = v;
  p.best = best;
  const up = freshUp();
  for (const u of UPGRADES) up[u] = Math.min(maxLevel(u), Math.max(0, Math.round(num((p.up as Record<string, unknown>)[u]))));
  p.up = up;
  p.stars = p.stars.map(s => Math.max(0, Math.min(3, Math.round(num(s)))));
  p.level = Math.max(0, Math.floor(p.level));
  p.crumbs = Math.max(0, Math.min(0.999, p.crumbs));
  p.bank = Math.max(0, Math.floor(p.bank));
  p.ver = 2;
  return p;
}

// ── upgrades ─────────────────────────────────────────────────────
export const maxLevel = (u: Upgrade): number => RULES.prices[u].length;

export const upLevel = (p: ChlebyProgress, u: Upgrade): number =>
  Math.min(maxLevel(u), Math.max(0, Math.round(p.up?.[u] ?? 0)));

/** The baskets for an upgrade's next level (null at the top). */
export function upPrice(u: Upgrade, level: number): number | null {
  const list = RULES.prices[u];
  return level >= list.length ? null : list[level];
}

/** Buy an upgrade's next level if the bank allows; true when bought. */
export function buyUp(p: ChlebyProgress, u: Upgrade): boolean {
  const lv = upLevel(p, u), price = upPrice(u, lv);
  if (price === null || p.bank < price) return false;
  p.bank -= price;
  p.up = { ...freshUp(), ...p.up, [u]: lv + 1 };
  return true;
}

export interface Offer { u: Upgrade; level: number; price: number; can: boolean }

/** The upgrades on offer (not at the top), cheapest first; `level` is the one it would buy. */
export function offers(p: ChlebyProgress): Offer[] {
  return UPGRADES
    .map(u => ({ u, level: upLevel(p, u), price: upPrice(u, upLevel(p, u)) }))
    .filter((o): o is { u: Upgrade; level: number; price: number } => o.price !== null)
    .sort((a, b) => a.price - b.price)
    .map(o => ({ ...o, level: o.level + 1, can: p.bank >= o.price }));
}

/** Add crumbs (in baskets); returns how many whole baskets they completed. */
export function addCrumbs(p: ChlebyProgress, baskets: number): number {
  if (!(baskets > 0)) return 0;
  p.crumbs += baskets;
  const whole = Math.floor(p.crumbs);
  p.crumbs -= whole;
  p.bank += whole;
  p.bankAll += whole;
  return whole;
}

/** The stream's rate (runners/s), the fish's spacing (0: none), the Big Basket's worth and fill per shot. */
export const streamRate = (p: ChlebyProgress): number => RULES.stream + RULES.streamPerLevel * upLevel(p, 'rate');
export const fishEvery = (p: ChlebyProgress): number => RULES.fishEvery[Math.min(RULES.fishEvery.length - 1, upLevel(p, 'fish'))];
export const bigWorth = (p: ChlebyProgress): number => RULES.bigW + RULES.bigWPerLevel * upLevel(p, 'big');
export const bigPerShot = (p: ChlebyProgress): number => RULES.bigPerShot + RULES.bigPerShotLevel * upLevel(p, 'big');

// ── stars ────────────────────────────────────────────────────────
/** A level's par (s): each terrace parBase + its hunger / parRate. */
export const parOf = (hungers: readonly number[]): number =>
  hungers.reduce((s, h) => s + RULES.parBase + h / RULES.parRate, 0);

/** A finished level's stars: 3 within par, 2 within starSlow × par, else 1 (the disciples' help: 1). */
export function starsFor(sec: number, par: number, byHelp: boolean): number {
  if (byHelp) return 1;
  if (sec <= par) return 3;
  return sec <= par * RULES.starSlow ? 2 : 1;
}

export const starsAll = (p: ChlebyProgress): number => (p.stars ?? []).reduce((s, n) => s + (n || 0), 0);

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: ChlebyProgress, plannedSec: number): number | null {
  const v = p.best?.[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: ChlebyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best ?? {}).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

export const seenCard = (p: ChlebyProgress, bit: number): boolean => ((p.seen ?? 0) & (1 << bit)) !== 0;
export const markCard = (p: ChlebyProgress, bit: number): void => { p.seen = (p.seen ?? 0) | (1 << bit); };

/** The coach marks (bits of `taught`). */
export const TEACH = ['tap', 'hold', 'drag', 'gull', 'gold', 'big', 'rest', 'pelikan', 'sub', 'add'] as const;
export type Teach = (typeof TEACH)[number];
export const taughtBit = (w: Teach): number => 1 << TEACH.indexOf(w);
export const isTaught = (p: ChlebyProgress, w: Teach): boolean => ((p.taught ?? 0) & taughtBit(w)) !== 0;
