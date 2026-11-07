/**
 * What Zacheusz remembers between sessions and the pure rules of its meta game:
 *
 *   the levels    three worlds of four (Super Mario Run's World Tour): they open in turn; each keeps
 *                 its stars (finished · the level's coin target · the top of the palm), its best
 *                 coins, and its special sets — silver, then gold, then purple, each a harder set
 *                 that shows once the one before was gathered whole in one run;
 *   Fourfold      (Luke 19:8) every denarius ever gathered goes back to Jericho's twelve households,
 *                 each restored when the all-time sum reaches its mark (nothing is spent or chosen);
 *   missions      three at a time; the day's gift; the records per session length;
 *   the story     which cards were shown (the opening, each world's end) and which controls the
 *                 first sessions already taught.
 *
 * Old saves (v1, the chunk-course version) carry `v: 1`: `migrate()` keeps their sessions, records,
 * denarii (the town keeps its restored homes), figs, the blind-block count and the day's gift, and
 * starts the rest fresh.  Fields of a wrong type are reset, never trusted.  No DOM.
 */
import { LEVELS, MISSIONS, TIERS, HOMES, type Home, type MissionId, type Tier } from './content';
import { RULES } from './rules';

/** A level's record: finished; its stars (best); special sets completed (0..3) and the most of the current set in one run; best coins. */
export interface LevelRec { done: boolean; stars: number; tier: number; got: number; coins: number }

export interface ZacheuszProgress {
  ver: 2;
  sessions: number;
  /** every denarius gathered for Jericho, all time */
  denarii: number;
  figs: number;
  bonks: number;
  /** push blocks begun, all time: every 4th is blind ("Tłum") from the 3rd session */
  pushes: number;
  levels: LevelRec[];
  /** the level the player picked in the lobby to start with (−1: the next one to play) */
  pick: number;
  /** the level the last session ended in */
  lastLevel: number;
  /** story cards seen: the opening, and the highest world whose ending card was shown (−1 none) */
  opened: boolean;
  worldsSeen: number;
  /** the controls the tutorial already taught (tap, hold, bonk, wall, pause, back, dash, bubble, road, orchard) */
  taught: string[];
  missions: MissionId[];
  missionsDone: number;
  missionNext: number;
  best: Record<string, number>;
  lastLen: number;
  giftDay: string;
}

const freshLevel = (): LevelRec => ({ done: false, stars: 0, tier: 0, got: 0, coins: 0 });

export function freshProgress(): ZacheuszProgress {
  return {
    ver: 2, sessions: 0, denarii: 0, figs: 0, bonks: 0, pushes: 0,
    levels: LEVELS.map(freshLevel), pick: -1, lastLevel: -1, opened: false, worldsSeen: -1, taught: [],
    missions: MISSIONS.slice(0, 3).map(m => m.id), missionsDone: 0, missionNext: 3,
    best: {}, lastLen: 0, giftDay: '',
  };
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);

/**
 * Bring a loaded save to v2, in place (idempotent).  A v1 save keeps its sessions, its records, its
 * denarii, figs, blind-block count and the day's gift; the rest starts fresh.
 */
export function migrate(p: ZacheuszProgress): ZacheuszProgress {
  const o = p as unknown as Record<string, unknown>;
  if ('v' in o || o.ver !== 2) {
    const keep = {
      sessions: num(o.sessions), denarii: num(o.denarii), figs: num(o.figs), pushes: num(o.pushes), lastLen: num(o.lastLen),
      giftDay: typeof o.giftDay === 'string' ? o.giftDay : '',
      best: o.best && typeof o.best === 'object' && !Array.isArray(o.best) ? (o.best as Record<string, unknown>) : {},
    };
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, freshProgress(), keep);
  }
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const k of Object.keys(f)) {
    const want = typeof f[k];
    if (Array.isArray(f[k])) { if (!Array.isArray(o[k])) o[k] = f[k]; continue; }
    if (want === 'object') { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = f[k]; continue; }
    if (typeof o[k] !== want || (want === 'number' && !Number.isFinite(o[k] as number))) o[k] = f[k];
  }
  const best: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.best)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) best[k] = v;
  p.best = best;
  p.levels = LEVELS.map((_, i) => {
    const r = p.levels[i] as unknown as Record<string, unknown> | undefined;
    if (!r || typeof r !== 'object') return freshLevel();
    return {
      done: r.done === true, stars: Math.max(0, Math.min(3, Math.round(num(r.stars)))),
      tier: Math.max(0, Math.min(TIERS.length, Math.round(num(r.tier)))), got: Math.max(0, Math.min(RULES.specials, Math.round(num(r.got)))),
      coins: Math.max(0, Math.round(num(r.coins))),
    };
  });
  p.taught = p.taught.filter((s): s is string => typeof s === 'string');
  const ids = new Set(MISSIONS.map(m => m.id));
  p.missions = p.missions.filter(id => ids.has(id));
  for (const m of MISSIONS) if (p.missions.length < 3 && !p.missions.includes(m.id)) p.missions.push(m.id);
  p.pick = Math.max(-1, Math.min(LEVELS.length - 1, Math.floor(p.pick)));
  p.missionNext = Math.max(0, Math.floor(p.missionNext)) % MISSIONS.length;
  p.ver = 2;
  return p;
}

// ── the households ───────────────────────────────────────────────
export const homesRestored = (denarii: number): number => RULES.homes.filter(at => denarii >= at).length;

/** The next household and the denarii toward it (null: all twelve restored). */
export function toNextHome(denarii: number): { home: Home; have: number; need: number } | null {
  const i = homesRestored(denarii);
  if (i >= HOMES.length) return null;
  const prev = i ? RULES.homes[i - 1] : 0;
  return { home: HOMES[i], have: Math.max(0, denarii - prev), need: RULES.homes[i] - prev };
}

// ── the levels ───────────────────────────────────────────────────
export const levelsDone = (p: ZacheuszProgress): number => p.levels.filter(l => l.done).length;
export const starsAll = (p: ZacheuszProgress): number => p.levels.reduce((s, l) => s + l.stars, 0);

/** Levels open to play: the finished ones and the next (they open in turn). */
export const unlocked = (p: ZacheuszProgress): number => {
  let n = 0;
  while (n < LEVELS.length && p.levels[n]?.done) n++;
  return Math.min(LEVELS.length, n + 1);
};

/** The set a level shows now: silver, then gold, then purple (purple stays once all three are done). */
export const tierIndex = (rec: LevelRec): number => Math.min(TIERS.length - 1, Math.max(0, rec.tier));
export const tierOf = (rec: LevelRec): Tier => TIERS[tierIndex(rec)];

/**
 * The level a session starts with: the lobby's pick if it is open, else the first not yet
 * finished, else (all done) the one with the fewest special sets after the last played.
 */
export function startLevel(p: ZacheuszProgress): number {
  if (p.pick >= 0 && p.pick < unlocked(p)) return p.pick;
  return nextLevel(p, p.lastLevel, true);
}

/**
 * The level after `from`: the next in order while the worlds are not all finished (or the first
 * unfinished with `fresh`); once all twelve are, the replay with the fewest special sets after it.
 */
export function nextLevel(p: ZacheuszProgress, from: number, fresh = false): number {
  const n = LEVELS.length;
  if (fresh) for (let i = 0; i < n; i++) if (!p.levels[i]?.done) return i;
  if (from + 1 < unlocked(p) && from + 1 < n) return from + 1;
  if (levelsDone(p) < n) return Math.min(n - 1, unlocked(p) - 1);
  let best = 0, bestTier = Infinity;
  for (let k = 1; k <= n; k++) {
    const i = (((from + k) % n) + n) % n;
    const tier = p.levels[i].tier;
    if (tier < bestTier) { best = i; bestTier = tier; }
  }
  return best;
}

/** Stars for a run: finished, the coin target, the top of the palm. */
export const starsFor = (coins: number, target: number, band: number): number => 1 + (coins >= target ? 1 : 0) + (band >= 4 ? 1 : 0);

/**
 * A level finished: recorded at its best.  All five specials of its set in one run complete the set
 * and show the next on the next replay.  Returns the first finish, the stars gained and the set completed.
 */
export function finishLevel(p: ZacheuszProgress, index: number, coins: number, band: number, specials: number): { first: boolean; stars: number; gained: number; completed: Tier | null } {
  const rec = p.levels[index];
  const first = !rec.done;
  rec.done = true;
  const stars = starsFor(coins, LEVELS[index].target, band);
  const gained = Math.max(0, stars - rec.stars);
  rec.stars = Math.max(rec.stars, stars);
  rec.coins = Math.max(rec.coins, coins);
  let completed: Tier | null = null;
  if (specials >= RULES.specials && rec.tier < TIERS.length) {
    completed = tierOf(rec);
    rec.tier++;
    rec.got = 0;
  } else if (rec.tier < TIERS.length) rec.got = Math.max(rec.got, specials);
  return { first, stars, gained, completed };
}

// ── the missions ─────────────────────────────────────────────────
/** After a session: every done mission gives its place to the next not yet open. */
export function turnPages(p: ZacheuszProgress, done: readonly MissionId[]): MissionId[] {
  const opened: MissionId[] = [];
  p.missions = p.missions.map(id => {
    if (!done.includes(id)) return id;
    for (let k = 0; k < MISSIONS.length; k++) {
      const next = MISSIONS[(p.missionNext + k) % MISSIONS.length];
      if (!p.missions.includes(next.id) && !opened.includes(next.id) && !done.includes(next.id)) {
        p.missionNext = (p.missionNext + k + 1) % MISSIONS.length;
        opened.push(next.id);
        return next.id;
      }
    }
    return id;
  });
  return opened;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: ZacheuszProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: ZacheuszProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best ?? {}).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
