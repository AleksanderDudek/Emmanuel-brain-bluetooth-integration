/**
 * What Odporność remembers between sessions (kit/progress.ts saves it as "arcade:odpornosc"): where the
 * run is (the loop and its stage), the immune memory of the pathogens met, the "Wiedza" cards, the
 * cells that joined with play, the stages' stars, the records and the song switch.  Pure rules, no DOM.
 *
 * Version 1 from the start.  The placeholder saved `{ ver: 1, sessions: n }`: it loads as
 * `mergeSaved(fresh, saved)` and `migrate()` repairs any field of a wrong type, so an old or damaged
 * save never crashes a session.
 */
import { clamp } from '../kit/juice';
import {
  FACT_IDS, PATHOGENS, STAGES, UNLOCKS, loopSpec, type Coach, type FactId, type PathogenId, type StageId, type UnlockId,
} from './content';
import { RULES } from './rules';

export interface OdpProgress {
  ver: 1;
  /** sessions finished */
  sessions: number;
  /** push blocks begun over all sessions (every 4th is blind from the 3rd session) */
  pushes: number;
  /** the run: the loop (1…) and the stage in it (0…5) */
  loop: number;
  stage: number;
  /** loops finished (wounds healed) */
  loopsDone: number;
  /** pathogens cleared over all sessions */
  total: number;
  /** the best session's score by its planned length ("300") */
  best: Record<string, number>;
  bestCombo: number;
  /** immune memory, 0…3 per pathogen (a stage of its adaptive response cleared raises it) */
  memory: Partial<Record<PathogenId, number>>;
  /** pathogens of each kind cleared over all sessions */
  met: Partial<Record<PathogenId, number>>;
  /** the "Wiedza" cards found, in the order found */
  facts: FactId[];
  /** the cells that joined with play */
  unlocks: UnlockId[];
  /** each place's stages: the best stars ("palec.hunt" → 1…3) */
  stars: Record<string, number>;
  /** T-cell stages cleared (the NK cells come after the first) */
  tcellsDone: number;
  /** coach marks already shown */
  seen: Coach[];
  /** the background song on or off */
  song: boolean;
  bursts: number;
  nets: number;
  lastLen: number;
}

export function freshProgress(): OdpProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, loop: 1, stage: 0, loopsDone: 0, total: 0, best: {}, bestCombo: 0,
    memory: {}, met: {}, facts: [], unlocks: [], stars: {}, tcellsDone: 0, seen: [], song: true, bursts: 0, nets: 0, lastLen: 0,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, def: number): number => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.floor(v), lo, hi) : def);

const COACHES: readonly Coach[] = ['drag', 'tap', 'rings', 'roll', 'swarm', 'burst', 'net', 'rest', 'capsule', 'tcell', 'hidden', 'collagen', 'blind', 'tidy'];
const UNLOCK_IDS: readonly UnlockId[] = UNLOCKS.map(u => u.id);

/** Repair a loaded save in place (wrong types, unknown ids, out-of-range numbers) and return it. */
export function migrate(p: OdpProgress): OdpProgress {
  const q = p as unknown as Record<string, unknown>;
  p.ver = 1;
  p.sessions = num(q.sessions, 0, 1e6, 0);
  p.pushes = num(q.pushes, 0, 1e7, 0);
  p.loop = num(q.loop, 1, 9999, 1);
  p.stage = num(q.stage, 0, STAGES.length - 1, 0);
  p.loopsDone = num(q.loopsDone, 0, 9999, 0);
  p.total = num(q.total, 0, 1e9, 0);
  p.bestCombo = num(q.bestCombo, 0, 1e6, 0);
  p.tcellsDone = num(q.tcellsDone, 0, 1e6, 0);
  p.bursts = num(q.bursts, 0, 1e7, 0);
  p.nets = num(q.nets, 0, 1e7, 0);
  p.lastLen = num(q.lastLen, 0, 1e5, 0);
  p.song = typeof q.song === 'boolean' ? q.song : true;
  const best: Record<string, number> = {};
  if (isObj(q.best)) for (const [k, v] of Object.entries(q.best)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) best[k] = Math.floor(v);
  p.best = best;
  const memory: Partial<Record<PathogenId, number>> = {};
  const met: Partial<Record<PathogenId, number>> = {};
  for (const id of PATHOGENS) {
    if (isObj(q.memory) && typeof q.memory[id] === 'number') memory[id] = num(q.memory[id], 0, 3, 0);
    if (isObj(q.met) && typeof q.met[id] === 'number') met[id] = num(q.met[id], 0, 1e9, 0);
  }
  p.memory = memory;
  p.met = met;
  const facts = Array.isArray(q.facts) ? q.facts.filter((f): f is FactId => typeof f === 'string' && (FACT_IDS as readonly string[]).includes(f)) : [];
  p.facts = [...new Set(facts)];
  const unlocks = Array.isArray(q.unlocks) ? q.unlocks.filter((u): u is UnlockId => typeof u === 'string' && (UNLOCK_IDS as readonly string[]).includes(u)) : [];
  p.unlocks = [...new Set(unlocks)];
  const stars: Record<string, number> = {};
  if (isObj(q.stars)) for (const [k, v] of Object.entries(q.stars)) if (typeof v === 'number' && Number.isFinite(v)) stars[k] = clamp(Math.round(v), 0, 3);
  p.stars = stars;
  const seen = Array.isArray(q.seen) ? q.seen.filter((c): c is Coach => typeof c === 'string' && (COACHES as readonly string[]).includes(c)) : [];
  p.seen = [...new Set(seen)];
  return p;
}

/** The best session score so far (any length), or null before the first. */
export function bestOf(p: OdpProgress): number | null {
  const v = Object.values(p.best);
  return v.length ? Math.max(...v) : null;
}

/** The key of a planned session length for the records ("300"). */
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export const has = (p: OdpProgress, id: UnlockId): boolean => p.unlocks.includes(id);

/** The cells whose condition is met and that have not joined yet: they join now (returned in order). */
export function checkUnlocks(p: OdpProgress): UnlockId[] {
  const fresh: UnlockId[] = [];
  for (const u of UNLOCKS) {
    if (p.unlocks.includes(u.id)) continue;
    const ok = u.afterTcells ? p.tcellsDone > 0 : u.total !== undefined && p.total >= u.total;
    if (ok) {
      p.unlocks.push(u.id);
      fresh.push(u.id);
    }
  }
  return fresh;
}

export const memoryOf = (p: OdpProgress, id: PathogenId): number => clamp(Math.floor(p.memory[id] ?? 0), 0, 3);

/** Remember a pathogen one level deeper (at most 3); returns the new level. */
export function remember(p: OdpProgress, id: PathogenId): number {
  const lv = Math.min(3, memoryOf(p, id) + 1);
  p.memory[id] = lv;
  return lv;
}

/** Add a "Wiedza" card; true when it is new. */
export function addFact(p: OdpProgress, id: FactId): boolean {
  if (p.facts.includes(id)) return false;
  p.facts.push(id);
  return true;
}

/** The key of a stage in a loop's place for its stars ("palec.hunt"). */
export const starKey = (loop: number, stage: StageId): string => `${loopSpec(loop).place}.${stage}`;

/** Keep a stage's best stars (Math.max: never less). */
export function setStars(p: OdpProgress, key: string, n: number): void {
  p.stars[key] = Math.max(p.stars[key] ?? 0, clamp(Math.round(n), 0, 3));
}

/** A neutrophil's appetite (bacteria before it is spent): Guyton's 3–20, the unlock adds 4. */
export const appetiteOf = (p: OdpProgress): number => RULES.neut.appetite + (has(p, 'apetyt') ? 4 : 0);

/** How many neutrophils the swarm holds at once. */
export const swarmCapOf = (p: OdpProgress): number => RULES.swarmCap + (has(p, 'szpik') ? 2 : 0);

/** NETs held at most, and a net's radius. */
export const netMaxOf = (p: OdpProgress): number => RULES.nets + (has(p, 'siec') ? 1 : 0);
export const netROf = (p: OdpProgress): number => RULES.net.r * (has(p, 'siec') ? 1.25 : 1);

/** A share 0..1 of the cards found. */
export const factShare = (p: OdpProgress): number => p.facts.length / FACT_IDS.length;
