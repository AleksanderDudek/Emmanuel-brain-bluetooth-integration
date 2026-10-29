/**
 * What Źródła remembers between sessions and the pure rules of its meta game: the road of the Songs
 * of Ascents (five stages of eight valleys, then valleys by the road), the open valley that waits
 * for the next session, the album "Studnie i źródła" with honest odds, pity and drops, the day's
 * trees, and the dates behind them.  No DOM; randomness only from the caller's generator.
 */
import { ALBUM, ROAD_LENGTH, STAGES, TREES, VALLEYS_PER_STAGE, type Recipe } from './content';
import { Valley, generate, lessonValley, mix, withSkill } from './valley';

/** A road valley in progress, saved at the session's end and resumed in the next one. */
export interface OpenValley { idx: number; seed: number; skill: number; rot: number[]; jars: number[]; green: number[] }

/** A closed road valley as the lobby and the intro draw it: its deepest level, green %, nest (0 none, 1 sparrows, 2 swallows), young. */
export interface RoadValley { i: number; d: number; g: number; n: 0 | 1 | 2; y: 0 | 1 }

export interface ZrodlaProgress {
  v: 1;
  /** saved sessions */
  sessions: number;
  /** all-time jars, valleys closed (all kinds), nests built */
  jars: number;
  valleys: number;
  nests: number;
  /** eligible Streams begun, all time: every 4th is blind ("Pod ziemią") from the 4th session */
  pushes: number;
  /** the next road valley: stage × 8 + index (0..39), then 40, 41, … (valleys by the road) */
  roadIndex: number;
  open: OpenValley | null;
  /** closed road valleys, the last 40, one per index */
  road: RoadValley[];
  /** −1..+2: the road's valleys grow with a quick hand and ease off for a slow one */
  skill: number;
  /** album cards owned (ids 0..5), those in morning light ✦, drops from duplicates, the session that last brought a new card */
  album: number[];
  dawn: number[];
  drops: number;
  lastNewSession: number;
  /** the day's trees by the road: kind 0..5 and the day planted (the last 30) */
  trees: { k: number; d: string }[];
  giftDay: string;
  /** "Dolina dnia": the day last played, that day's closing time (s, 0 = not closed), the fastest close ever */
  dailyDay: string;
  dailySec: number;
  dailyBest: number;
  /** records */
  bestSession: number;
  deepestJars: number;
  deepest: number;
  /** the fastest close of a 5×5 or larger road or daily valley (s, 0 = none) */
  fastest: number;
  /** the longest steady stretch in a sighted Stream (s) */
  steady: number;
  /** the best session contrast, push − rest (activity %) */
  rytm: number | null;
  lastDay: string;
}

export function freshProgress(): ZrodlaProgress {
  return {
    v: 1, sessions: 0, jars: 0, valleys: 0, nests: 0, pushes: 0, roadIndex: 0, open: null, road: [], skill: 0,
    album: [], dawn: [], drops: 0, lastNewSession: -1, trees: [], giftDay: '', dailyDay: '', dailySec: 0, dailyBest: 0,
    bestSession: 0, deepestJars: 0, deepest: 0, fastest: 0, steady: 0, rytm: null, lastDay: '',
  };
}

// ── the road ─────────────────────────────────────────────────────
export interface RoadPlace {
  /** 0-based stage (valleys by the road keep stage 5's recipes: 4), the valley within it, and whether it is past the road's end */
  stage: number;
  index: number;
  free: boolean;
  recipe: Recipe | 'lesson';
  seed: number;
}

/** Where road valley `idx` lies and what it is; the same road for everyone (only the skill offset differs). */
export function roadPlace(idx: number): RoadPlace {
  if (idx < ROAD_LENGTH) {
    const stage = Math.floor(idx / VALLEYS_PER_STAGE), index = idx % VALLEYS_PER_STAGE;
    return { stage, index, free: false, recipe: STAGES[stage].recipes[index], seed: mix(stage, index, 0x5eed) };
  }
  const k = idx - ROAD_LENGTH, last = STAGES.length - 1;
  return { stage: last, index: k % VALLEYS_PER_STAGE, free: true, recipe: STAGES[last].recipes[k % VALLEYS_PER_STAGE], seed: mix(last, VALLEYS_PER_STAGE + k, 0x5eed) };
}

/** Road valley `idx` as generated for a skill offset (index 0 is the hand-made lesson). */
export function roadValley(idx: number, skill: number): Valley {
  const place = roadPlace(idx);
  return place.recipe === 'lesson' ? lessonValley() : generate(withSkill(place.recipe, skill), place.seed);
}

/** The saved open valley rebuilt with its stones, water and green; null when it no longer matches (a newer generator). */
export function restoreOpen(o: OpenValley | null): { valley: Valley; jars: number[]; green: number[] } | null {
  if (!o || !Array.isArray(o.rot) || !Array.isArray(o.jars) || !Array.isArray(o.green)) return null;
  if (o.seed !== roadPlace(o.idx).seed) return null;
  const valley = roadValley(o.idx, o.skill);
  if (o.rot.length !== valley.n || o.jars.length !== valley.fields.length || o.green.length !== valley.fields.length) return null;
  valley.setRotations(o.rot);
  if (valley.closed) return null;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
  return { valley, jars: o.jars.map(num), green: o.green.map(num) };
}

/** Closed road valleys merged: one per index (the newer wins), in road order, the last 40. */
export function mergeRoad(base: readonly RoadValley[], add: readonly RoadValley[]): RoadValley[] {
  const by = new Map<number, RoadValley>();
  for (const r of base) by.set(r.i, r);
  for (const r of add) by.set(r.i, { ...r });
  return [...by.values()].sort((a, b) => a.i - b.i).slice(-40);
}

/** The skill offset after a road valley closed in `sec` Stream seconds (a Stream lasting `streamSec`). */
export function nextSkill(skill: number, sec: number, streamSec: number): number {
  if (sec < 8) return Math.min(2, skill + 1);
  if (sec > streamSec + 8) return Math.max(-1, skill - 1);
  return skill;
}

// ── the album ────────────────────────────────────────────────────
export type CardKind = 'new' | 'dawn' | 'dup' | 'upgrade';
export interface CardRoll {
  id: number;
  kind: CardKind;
  /** a card crafted from three drops right after (null: none) */
  crafted: number | null;
}

export const DROPS_PER_CARD = 3;
export const PITY_SESSIONS = 3;

export const missingCards = (p: ZrodlaProgress): number[] => ALBUM.map(c => c.id).filter(id => !p.album.includes(id));

/** A sure new card is due: an empty album, or three sessions since the last new one while a card is missing. */
export function pityDue(p: ZrodlaProgress, session: number): boolean {
  const missing = missingCards(p).length > 0;
  return missing && (p.album.length === 0 || session - p.lastNewSession >= PITY_SESSIONS);
}

/**
 * The session's one roll: each card 1 in 6 (a sure missing one when pity is due).  A new card comes
 * in morning light ✦ after a deep calm; then a duplicate of a plain card turns to ✦ instead of
 * giving a drop.  Three drops become the next missing card in album order, at once.
 */
export function rollCard(p: ZrodlaProgress, rnd: () => number, session: number, dawn: boolean): CardRoll {
  const missing = missingCards(p);
  const pity = pityDue(p, session);
  const pickFrom = (list: readonly number[]) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
  const id = pity ? pickFrom(missing) : pickFrom(ALBUM.map(c => c.id));
  let kind: CardKind;
  if (!p.album.includes(id)) {
    p.album.push(id);
    p.lastNewSession = session;
    kind = 'new';
    if (dawn) {
      p.dawn.push(id);
      kind = 'dawn';
    }
  } else if (dawn && !p.dawn.includes(id)) {
    p.dawn.push(id);
    kind = 'upgrade';
  } else {
    p.drops++;
    kind = 'dup';
  }
  let crafted: number | null = null;
  const left = missingCards(p);
  if (p.drops >= DROPS_PER_CARD && left.length) {
    p.drops -= DROPS_PER_CARD;
    crafted = left[0];
    p.album.push(crafted);
    p.lastNewSession = session;
  }
  return { id, kind, crafted };
}

// ── the day's tree ───────────────────────────────────────────────
/** The day's tree, the same for everyone: its kind (index into TREES). */
export const treeOfDay = (daySeed: number): number => (daySeed >>> 0) % TREES.length;

/** A tree's growth: 0 a sapling (the day it was planted), 1 young, 2 grown (from the third day). */
export function treeStage(planted: string, today: string): 0 | 1 | 2 {
  const d = daysBetween(planted, today) ?? 0;
  return d >= 3 ? 2 : d >= 1 ? 1 : 0;
}

/** The first session of a day plants the day's tree (whatever its score); null when today's tree stands already. */
export function plantTree(p: ZrodlaProgress, day: string, daySeed: number): number | null {
  if (p.giftDay === day) return null;
  p.giftDay = day;
  const k = treeOfDay(daySeed);
  p.trees.push({ k, d: day });
  if (p.trees.length > 30) p.trees.splice(0, p.trees.length - 30);
  return k;
}

// ── dates and records ────────────────────────────────────────────
const dayNum = (d: string): number | null => {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
};

/** Whole days from `a` to `b` ("YYYY-MM-DD"); null when either is missing. */
export function daysBetween(a: string, b: string): number | null {
  const x = dayNum(a), y = dayNum(b);
  return x === null || y === null ? null : Math.round(y - x);
}

/** The smaller of two times where 0 means "none yet". */
export const minTime = (a: number, b: number): number => (a > 0 && b > 0 ? Math.min(a, b) : Math.max(a, b));
