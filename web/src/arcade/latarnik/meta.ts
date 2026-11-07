/**
 * What Latarnik remembers between sessions (saved by the runner under "arcade:latarnik") and the
 * pure rules of its meta game, version 2:
 *
 *   the nights   the next night to keep and the best stars of each one kept (nights.ts)
 *   the village  eight steps around the lighthouse, lit by the stars of the nights kept
 *   the workshop the lens, the oil, the bell and the second beam, bought with crates; the player
 *                picks in the lobby what the crates go to next
 *   the album    the amber with honest odds, crumbs and pity (kept from version 1)
 *   the letters  Hania's letters in bottles (kept from version 1)
 *
 * Old saves (version 1: `v: 1`, the village built from crates) migrate in place on first use: the
 * best score, the session count, the all-time boats, the records, the amber and the letters stay;
 * the village is lit again by stars from the first night, and the crates a player had piled up
 * come along as a little workshop credit.  Every field is checked by type, so an old field of
 * another type never crashes anything.  No DOM; randomness only from the caller's generator.
 */
import { AMBER, CRAFT_OKRUCHY, DUPLICATE_OKRUCHY, TIERS, VILLAGE, type Tier, type VillageStep } from './content';
import { totalStars } from './nights';
import { UPGRADES, UPGRADE_COST, UPGRADE_MAX, VILLAGE_STARS, type Upgrade } from './rules';

export interface LatarnikProgress {
  ver: 2;
  /** sessions started (saved) */
  sessions: number;
  /** the best session's boats (the headline) */
  bestSession: number;
  /** boats guided and crates delivered, all time */
  boats: number;
  crates: number;
  bestStreak: number;
  /** the farthest the light reached in a session (% of the sea's radius) */
  farthest: number;
  /** the night to keep next (0-based) and the best stars of each night kept */
  night: number;
  nightStars: number[];
  /** the workshop: each upgrade's level, the crates put toward the next, what they go to */
  upgrades: Record<Upgrade, number>;
  chest: number;
  focus: Upgrade;
  /** the whale seen (lit) and Edek's rowboat brought home, all time */
  whales: number;
  rescued: number;
  /** Konwój blocks begun, all time: every 4th is blind ("W ciemno") from the 3rd session */
  konwoje: number;
  /** album pieces owned (indices into AMBER), crumbs, and the session that last brought a new piece */
  amber: number[];
  okruchy: number;
  lastNewSession: number;
  /** letters found (the newest is LETTERS[letters − 1]) */
  letters: number;
  tallShips: number;
  /** the last session's day (the welcome back) */
  lastDay: string;
  /** today's farthest reach and the last earlier day's (the faint ring to beat), in R */
  reachDay: string;
  reachBest: number;
  reachPrevDay: string;
  reachPrev: number;
  /** "Noc dnia": the day the date-seeded night was played, and its boats */
  dailyDay: string;
  dailyScore: number;
  /** coach marks already shown (later sessions explain only what is new) */
  seen: string[];
}

const zeroUpgrades = (): Record<Upgrade, number> => ({ lens: 0, oil: 0, bell: 0, beam: 0 });

export function freshProgress(): LatarnikProgress {
  return {
    ver: 2, sessions: 0, bestSession: 0, boats: 0, crates: 0, bestStreak: 0, farthest: 0,
    night: 0, nightStars: [], upgrades: zeroUpgrades(), chest: 0, focus: 'lens', whales: 0, rescued: 0,
    konwoje: 0, amber: [], okruchy: 0, lastNewSession: -1, letters: 0, tallShips: 0, lastDay: '',
    reachDay: '', reachBest: 0, reachPrevDay: '', reachPrev: 0, dailyDay: '', dailyScore: 0, seen: [],
  };
}

/** The most a version-1 crate pile brings into the workshop. */
export const OLD_CRATES_CREDIT = 120;

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const whole = (v: unknown): number => Math.max(0, Math.floor(num(v)));
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Bring a loaded save to version 2, in place (idempotent).  A version-1 save keeps its best score,
 * its sessions, its boats, its records, its amber and its letters; its crates become a little
 * workshop credit and the nights start at the first.  A version-2 save only gets its fields checked.
 */
const checked = new WeakSet<object>();

export function migrate(p: LatarnikProgress): LatarnikProgress {
  if (checked.has(p)) return p;
  checked.add(p);
  const raw = p as unknown as Record<string, unknown>;
  const fresh = freshProgress();
  if (raw.ver !== 2 || raw.v !== undefined) {
    const keep = {
      sessions: whole(raw.sessions), bestSession: whole(raw.bestSession), boats: whole(raw.boats),
      bestStreak: whole(raw.bestStreak), farthest: whole(raw.farthest), konwoje: whole(raw.konwoje),
      amber: Array.isArray(raw.amber) ? raw.amber : [], okruchy: whole(raw.okruchy), lastNewSession: Math.floor(num(raw.lastNewSession, -1)),
      letters: whole(raw.letters), tallShips: whole(raw.tallShips),
      reachDay: str(raw.reachDay), reachBest: Math.max(0, num(raw.reachBest)), reachPrevDay: str(raw.reachPrevDay), reachPrev: Math.max(0, num(raw.reachPrev)),
      dailyDay: str(raw.dailyDay), dailyScore: whole(raw.dailyScore), lastDay: str(raw.lastDay),
      chest: Math.min(OLD_CRATES_CREDIT, whole(raw.crates)),
      // a keeper who has played knows the tap: only what is new is explained
      seen: whole(raw.sessions) > 0 ? ['tap', 'perfect', 'lanterns', 'reach', 'glow'] : [],
    };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(raw, fresh, keep);
  }
  for (const k of ['sessions', 'bestSession', 'boats', 'crates', 'bestStreak', 'farthest', 'night', 'chest', 'whales', 'rescued',
    'konwoje', 'okruchy', 'letters', 'tallShips', 'dailyScore'] as const) raw[k] = whole(raw[k]);
  raw.lastNewSession = Math.floor(num(raw.lastNewSession, -1));
  for (const k of ['reachBest', 'reachPrev'] as const) raw[k] = Math.max(0, num(raw[k]));
  for (const k of ['lastDay', 'reachDay', 'reachPrevDay', 'dailyDay'] as const) raw[k] = str(raw[k]);
  if (!Array.isArray(raw.nightStars)) raw.nightStars = [];
  p.nightStars = p.nightStars.map(s => Math.max(0, Math.min(3, Math.floor(num(s)))));
  const up = (raw.upgrades && typeof raw.upgrades === 'object' ? raw.upgrades : {}) as Record<string, unknown>;
  p.upgrades = zeroUpgrades();
  for (const u of UPGRADES) p.upgrades[u] = Math.min(UPGRADE_MAX[u], whole(up[u]));
  if (!UPGRADES.includes(raw.focus as Upgrade)) raw.focus = 'lens';
  if (!Array.isArray(raw.amber)) raw.amber = [];
  p.amber = [...new Set(p.amber.filter(i => Number.isInteger(i) && i >= 0 && i < AMBER.length))];
  if (!Array.isArray(raw.seen)) raw.seen = [];
  p.seen = p.seen.filter(s => typeof s === 'string');
  raw.ver = 2;
  return p;
}

// ── the village: lit by the stars of the nights kept ──────────────
export interface VillageState {
  /** steps standing */
  built: number;
  /** the step being lit next (null: the harbour is complete), the stars toward it */
  next: VillageStep | null;
  have: number;
  need: number;
}

export function village(stars: number): VillageState {
  let built = 0;
  while (built < VILLAGE.length && stars >= VILLAGE_STARS[built]) built++;
  if (built >= VILLAGE.length) return { built, next: null, have: 0, need: 0 };
  const from = built ? VILLAGE_STARS[built - 1] : 0;
  return { built, next: VILLAGE[built], have: Math.max(0, stars - from), need: VILLAGE_STARS[built] - from };
}

export const starsOf = (p: LatarnikProgress): number => totalStars(p.nightStars);

// ── the workshop ─────────────────────────────────────────────────
/** The crates the next level of `u` costs (null: at its top). */
export function costOf(p: LatarnikProgress, u: Upgrade): number | null {
  const lv = p.upgrades[u];
  return lv >= UPGRADE_MAX[u] ? null : UPGRADE_COST[u][lv];
}

/** What the crates go to now: the player's pick, or else the first upgrade still to buy (null: all bought). */
export function workshopTarget(p: LatarnikProgress): Upgrade | null {
  if (costOf(p, p.focus) !== null) return p.focus;
  return UPGRADES.find(u => costOf(p, u) !== null) ?? null;
}

/**
 * Put crates into the workshop: they fill the chest toward the target, and every full chest is the
 * target's next level.  Returns the upgrades bought (in order).  With everything bought the crates
 * still count, they just have nothing left to buy.
 */
export function addToWorkshop(p: LatarnikProgress, n: number): Upgrade[] {
  p.chest += Math.max(0, Math.round(n));
  const out: Upgrade[] = [];
  for (let guard = 0; guard < 12; guard++) {
    const u = workshopTarget(p);
    if (!u) break;
    const cost = costOf(p, u)!;
    if (p.chest < cost) break;
    p.chest -= cost;
    p.upgrades[u]++;
    out.push(u);
  }
  return out;
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
