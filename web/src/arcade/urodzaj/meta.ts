/**
 * What Urodzaj remembers between sessions and the pure rules of its meta game: the village table set
 * step by step from the harvest and the days' loaves, and the guest album — twelve people at one
 * table, two of them from the Book of Ruth who come by the story, ten drawn with published odds by
 * how far they came, with grain from duplicates and pity.  No DOM; randomness only from the caller.
 */
import {
  CRAFT_GRAIN, DUPLICATE_GRAIN, GUESTS, LOAF_POINTS, TABLE_START, TABLE_STEP, TABLE_STEPS, TIERS,
  type Guest, type GuestId, type TableStep, type Tier,
} from './content';

export interface UrodzajProgress {
  v: 1;
  /** saved sessions (result(): Math.max with this session's number) */
  sessions: number;
  /** all-time harvest points (live: every point scored) */
  harvest: number;
  /** the days' loaves set on the table (live, once a day) and the day of the last one */
  loaves: number;
  loafDay: string;
  /** Zbiór and Rosa blocks begun, all time (result(): Math.max): the blind rotation */
  zbiory: number;
  rosy: number;
  /** records (result(): Math.max) */
  bestSession: number;
  bestBasket: number;
  /** 1..9, the highest fruit ever made (live with Math.max; result() too) */
  bestTier: number;
  /** the longest chain (links + 1) and the deepest dew at a Rosa's end (%) */
  bestChain: number;
  bestDew: number;
  /** great clusters, all time (live) */
  greatClusters: number;
  /** guest ids at the table in order of arrival, grain from duplicates (live, in the evening) */
  guests: string[];
  grain: number;
  /** the session that last brought a new guest (pity); −1 none */
  lastNewSession: number;
  /** the sessions Ruth and Naomi came (0: not yet) */
  ruthAt: number;
  naomiAt: number;
  /** "Kosz dnia": its day, its score and the best one ever (result()) */
  dailyDay: string;
  dailyScore: number;
  dailyBest: number;
  /** the last session's day */
  lastDay: string;
}

export function freshProgress(): UrodzajProgress {
  return {
    v: 1, sessions: 0, harvest: 0, loaves: 0, loafDay: '', zbiory: 0, rosy: 0, bestSession: 0, bestBasket: 0, bestTier: 1,
    bestChain: 0, bestDew: 0, greatClusters: 0, guests: [], grain: 0, lastNewSession: -1, ruthAt: 0, naomiAt: 0,
    dailyDay: '', dailyScore: 0, dailyBest: 0, lastDay: '',
  };
}

// ── the table ────────────────────────────────────────────────────
/** Table points: 350 to start, every harvest point, 150 for each day's loaf — never from the band, never lost. */
export const tablePoints = (p: Pick<UrodzajProgress, 'harvest' | 'loaves'>): number => TABLE_START + Math.max(0, p.harvest) + LOAF_POINTS * Math.max(0, p.loaves);

export interface TableState {
  /** steps set */
  built: number;
  /** the step being set (null: the table is set) and the points toward it */
  next: TableStep | null;
  have: number;
  need: number;
}

export function tableState(points: number): TableState {
  const built = Math.min(TABLE_STEPS.length, Math.floor(Math.max(0, points) / TABLE_STEP));
  if (built >= TABLE_STEPS.length) return { built, next: null, have: 0, need: 0 };
  return { built, next: TABLE_STEPS[built], have: Math.floor(points - built * TABLE_STEP), need: TABLE_STEP };
}

export const stepBuilt = (p: Pick<UrodzajProgress, 'harvest' | 'loaves'>, id: TableStep['id']): boolean =>
  tableState(tablePoints(p)).built > TABLE_STEPS.findIndex(s => s.id === id);

// ── the guests ───────────────────────────────────────────────────
export const atTable = (p: UrodzajProgress, id: GuestId): boolean => p.guests.includes(id);

/** The drawn guests of a tier (Ruth and Naomi come by the story only). */
export const tierPool = (tier: Tier): readonly Guest[] => GUESTS.filter(g => g.tier === tier);

/** The published odds: the chance that a draw of `tier` brings a guest not yet at the table. */
export function newChance(p: UrodzajProgress, tier: Tier): number {
  const pool = tierPool(tier);
  return pool.filter(g => !atTable(p, g.id)).length / pool.length;
}

/** The lowest missing drawn guest — commons first, then rares, the epic, the legendary last (`legend` false: never it). */
export function nextMissing(p: UrodzajProgress, legend = true): GuestId | null {
  for (const tier of TIERS) {
    if (tier === 'legend' && !legend) break;
    for (const g of tierPool(tier)) if (!atTable(p, g.id)) return g.id;
  }
  return null;
}

export interface Draw {
  id: GuestId;
  tier: Tier;
  isNew: boolean;
  /** guests the grain brought right after it */
  crafted: GuestId[];
}

const pickOne = <T>(list: readonly T[], rnd: () => number): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

/**
 * One draw: the feat sets the tier, the guest is drawn evenly within it.  A guest already at the
 * table leaves grain; with `forceNew` (pity) the draw takes a missing guest of its tier, or else the
 * lowest missing one (never the legendary).
 */
export function drawGuest(p: UrodzajProgress, tier: Tier, rnd: () => number, forceNew = false): Draw {
  const pool = tierPool(tier);
  let g = pickOne(pool, rnd);
  let drawnTier = tier;
  if (forceNew && atTable(p, g.id)) {
    const missing = pool.filter(x => !atTable(p, x.id));
    if (missing.length) g = pickOne(missing, rnd);
    else {
      const m = nextMissing(p, false);
      const mg = m ? GUESTS.find(x => x.id === m) : undefined;
      if (mg) {
        g = mg;
        drawnTier = mg.tier ?? tier;
      }
    }
  }
  const isNew = !atTable(p, g.id);
  if (isNew) p.guests.push(g.id);
  else p.grain += DUPLICATE_GRAIN;
  return { id: g.id, tier: drawnTier, isNew, crafted: craft(p) };
}

/** Every 25 grain brings the lowest missing guest to the table. */
function craft(p: UrodzajProgress): GuestId[] {
  const out: GuestId[] = [];
  while (p.grain >= CRAFT_GRAIN) {
    const m = nextMissing(p);
    if (m === null) break;
    p.grain -= CRAFT_GRAIN;
    p.guests.push(m);
    out.push(m);
  }
  return out;
}

/** Ruth comes to the evening table the first time fruit spills to the field's edge, or in the 3rd session at the latest. */
export const ruthDue = (p: UrodzajProgress, session: number, spilled: boolean): boolean => p.ruthAt === 0 && (spilled || session >= 3);

/** Naomi comes at the evening of the next saved session after Ruth's. */
export const naomiDue = (p: UrodzajProgress, session: number): boolean => p.ruthAt > 0 && p.naomiAt === 0 && session > p.ruthAt;

/** The day's loaf: the first saved session of the day sets it on the table, whatever the score. */
export const loafDue = (p: UrodzajProgress, day: string): boolean => p.loafDay !== day;
