/**
 * What Synapsy remembers between sessions, and the pure rules of its meta game.  The brain persists:
 *
 *   the brain      its seed (each player's own jitter of the template, chosen at the first session), and
 *                  the links that were **consolidated** in rest blocks — their synapses and myelin — and the
 *                  bridge's myelin.  What was not consolidated is gone by the next session (as in life:
 *                  consolidation is what makes a memory last).
 *   the ladder     the next lesson, the lessons learned (their paths carry "habit" thoughts in later sessions)
 *   the map        the regions of the mind lit by the lessons and the wiring
 *   Wiedza         the fact cards unlocked
 *   records        the best session per length, the fastest path (ms), the longest time the halves were in
 *                  step (s), counters
 *   settings       the background song on or off
 *
 * Version 1 from the start.  The placeholder's save (`{ ver: 1, sessions: n }`) keeps its session count;
 * any field of a wrong type is reset rather than trusted.  No DOM, no randomness.
 */
import { TEMPLATE_SIZE, type RegionId } from './brain';
import { CARD_IDS, LESSONS, REGIONS, type CardId, type LessonId } from './content';
import { RULES } from './rules';

/** A consolidated link as saved: [neuron a, neuron b, synapses, myelin in %]. */
export type SavedLink = [number, number, number, number];

export interface SynapsyProgress {
  ver: 1;
  sessions: number;
  /** push blocks begun, all time (every 4th is blind from the 3rd session) */
  pushes: number;
  /** the brain's seed (0 until the first session chooses one) */
  seed: number;
  /** the ladder's next lesson */
  lesson: number;
  /** lessons learned at least once */
  learned: LessonId[];
  links: SavedLink[];
  /** the two bridge lanes' myelin in % */
  bridge: [number, number];
  cards: CardId[];
  regions: RegionId[];
  /** the best session's connections per session length (s) */
  best: Record<string, number>;
  /** the fastest conduction time of a lesson's thought (ms; 0 = none yet) */
  fastest: number;
  /** the longest stretch the halves were in step (s, real readings only) */
  inStep: number;
  /** all-time counters */
  total: number;
  thoughts: number;
  blooms: number;
  /** the background song plays (the progress card's switch) */
  song: boolean;
  lastLen: number;
  /** first-time explanations already given */
  seen: string[];
}

export function freshProgress(): SynapsyProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, seed: 0, lesson: 0, learned: [], links: [],
    bridge: [Math.round(RULES.bridgeMyelin * 100), Math.round(RULES.bridgeMyelin * 100)],
    cards: [], regions: ['plan'], best: {}, fastest: 0, inStep: 0, total: 0, thoughts: 0, blooms: 0, song: true, lastLen: 0, seen: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0, lo = 0): number => Math.max(lo, Math.floor(num(v, d)));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const LESSON_SET = new Set<string>(LESSONS.map(l => l.id));
const CARD_SET = new Set<string>(CARD_IDS);
const REGION_SET = new Set<string>(REGIONS);

/** A saved link, if it is one: two different neuron ids under `n`, synapses 1..max, myelin 0..100. */
function readLink(v: unknown, n: number): SavedLink | null {
  if (!Array.isArray(v) || v.length < 4) return null;
  const [a, b, syn, my] = v.map(x => num(x, NaN));
  if (![a, b, syn, my].every(Number.isFinite)) return null;
  const ia = Math.floor(a), ib = Math.floor(b);
  if (ia === ib || ia < 0 || ib < 0 || ia >= n || ib >= n) return null;
  return [Math.min(ia, ib), Math.max(ia, ib), Math.min(RULES.synMax, Math.max(1, Math.round(syn))), Math.min(100, Math.max(0, Math.round(my)))];
}

/** How many neurons a brain has (the saved links are checked against it). */
export const NEURONS = TEMPLATE_SIZE;

/**
 * Bring a loaded save to version 1, in place (idempotent).  A version-1 save keeps everything with its
 * types repaired; anything else (garbage, a future version) starts fresh and keeps the session count.
 */
export function migrate(p: SynapsyProgress): SynapsyProgress {
  const raw = p as unknown as Record<string, unknown>;
  if (raw.ver !== 1) {
    const keep = { sessions: int(raw.sessions), pushes: int(raw.pushes) };
    for (const k of Object.keys(raw)) delete raw[k];
    Object.assign(p, freshProgress(), keep);
    return p;
  }
  const f = freshProgress();
  p.sessions = int(raw.sessions);
  p.pushes = int(raw.pushes);
  p.seed = int(raw.seed) >>> 0;
  p.lesson = int(raw.lesson);
  p.learned = Array.isArray(raw.learned) ? [...new Set(raw.learned.filter((x): x is LessonId => typeof x === 'string' && LESSON_SET.has(x)))] : [];
  const seen = new Set<string>();
  const links: SavedLink[] = [];
  if (Array.isArray(raw.links)) {
    for (const v of raw.links) {
      const l = readLink(v, NEURONS);
      if (!l || seen.has(`${l[0]}-${l[1]}`)) continue;
      seen.add(`${l[0]}-${l[1]}`);
      links.push(l);
    }
  }
  p.links = links.slice(0, RULES.keepLinks);
  const br = Array.isArray(raw.bridge) ? raw.bridge : [];
  p.bridge = [0, 1].map(i => Math.min(100, Math.max(0, Math.round(num(br[i], f.bridge[i]))))) as [number, number];
  p.cards = Array.isArray(raw.cards) ? [...new Set(raw.cards.filter((x): x is CardId => typeof x === 'string' && CARD_SET.has(x)))] : [];
  const regions = Array.isArray(raw.regions) ? raw.regions.filter((x): x is RegionId => typeof x === 'string' && REGION_SET.has(x)) : [];
  p.regions = [...new Set<RegionId>(['plan', ...regions])];
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (num(v) > 0) best[k] = Math.floor(num(v));
  p.best = best;
  p.fastest = Math.max(0, num(raw.fastest));
  p.inStep = Math.max(0, num(raw.inStep));
  p.total = int(raw.total);
  p.thoughts = int(raw.thoughts);
  p.blooms = int(raw.blooms);
  p.song = typeof raw.song === 'boolean' ? raw.song : true;
  p.lastLen = int(raw.lastLen);
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((x): x is string => typeof x === 'string'))] : [];
  return p;
}

/** The session-length key of a record (sessions of different lengths keep their own best). */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The best session's connections of any length (null: none yet). */
export function bestOf(p: SynapsyProgress): number | null {
  const v = Object.values(p.best);
  return v.length ? Math.max(...v) : null;
}

/** The best of this session length (null: none yet). */
export const bestFor = (p: SynapsyProgress, plannedSec: number): number | null => p.best[lenKey(plannedSec)] ?? null;

/** Unlock a card; true when it is new. */
export function unlockCard(p: SynapsyProgress, id: CardId): boolean {
  if (p.cards.includes(id)) return false;
  p.cards.push(id);
  return true;
}

/** Light a region of the map; true when it is new. */
export function lightRegion(p: SynapsyProgress, id: RegionId): boolean {
  if (p.regions.includes(id)) return false;
  p.regions.push(id);
  return true;
}

/** The share of the map lit (0..1). */
export const mapShare = (p: SynapsyProgress): number => p.regions.length / REGIONS.length;

/** The consolidated links that touch a region's neurons (the map's brightness), given each neuron's region. */
export function wiring(p: SynapsyProgress, regionOf: (n: number) => RegionId | null): Record<RegionId, number> {
  const out = Object.fromEntries(REGIONS.map(r => [r, 0])) as Record<RegionId, number>;
  for (const [a, b] of p.links) {
    const ra = regionOf(a), rb = regionOf(b);
    if (ra) out[ra]++;
    if (rb && rb !== ra) out[rb]++;
  }
  return out;
}

/** The synapses kept in the saved network. */
export const keptSynapses = (p: SynapsyProgress): number => p.links.reduce((s, l) => s + l[2], 0);
