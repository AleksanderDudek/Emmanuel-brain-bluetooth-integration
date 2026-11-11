/**
 * What the road holds, as plans the generator lays one beat at a time (pure, from the generator it
 * is given): a valley floor's beats for a level and stage (v2), the first-ever floor that teaches one
 * thing at a time, and — from version 3 — the clock tower's floors: which trial a floor is (a quarry
 * of blocks, a bridge of falling planks, swinging weights, a gallery of gates ending at a giant block,
 * pens, a dark floor, a floor where the dark rises fast) with a keeper every fifth floor, and each
 * trial's beats.  The sim lays them (sim.ts); the words are in the catalog.
 */
import { ERAS, TRIALS, type EraId, type FloorKind } from './content';
import { RULES } from './rules';

/** What a stretch of a floor holds, in order: the generator lays them with gaps between. */
export type Beat =
  | 'pitN' | 'pitW' | 'block' | 'tall' | 'pair' | 'walker' | 'special' | 'gate' | 'gate2' | 'pen'
  // v3: a crumbling bridge, a swinging weight, a giant block, a smoke curtain, a companion's cage
  | 'bridge' | 'pend' | 'giant' | 'barrier' | 'cage';

/**
 * A floor's beats for a level and stage (pure, from the rng): gates in its first and second half
 * (the second one high from level 2 or the second stage), a pen on the second floor and two on the
 * third (the original's cages), then blocks, pits (wide ones more often each level), shadows and the
 * era's special (from level 2), shuffled between them.  From version 3 a smoke curtain may stand on a
 * floor from level 2, and a bridge of planks from level 4.
 */
export function stagePlan(level: number, stage: number, rnd: () => number): Beat[] {
  const L = Math.max(1, level);
  const len = RULES.stageLen[0] + Math.min(RULES.stageLen[2], RULES.stageLen[1] * (L - 1));
  const n = Math.max(5, Math.round(len / 7.5));
  const wide = Math.min(0.6, 0.25 + 0.05 * L);
  const pool: Beat[] = [];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    if (r < 0.34) pool.push(rnd() < 0.3 + 0.03 * L ? (rnd() < 0.5 ? 'tall' : 'pair') : 'block');
    else if (r < 0.58) pool.push(rnd() < wide ? 'pitW' : 'pitN');
    else if (r < 0.8 || L < 2) pool.push('walker');
    else pool.push('special');
  }
  const pens = stage === 3 ? 2 : stage === 2 ? 1 : 0;
  for (let i = 0; i < pens; i++) pool.splice(Math.floor(rnd() * (pool.length + 1)), 0, 'pen');
  // the gates: one early, one past the middle (high from level 2 or the second floor)
  pool.splice(Math.min(pool.length, 1 + Math.floor(rnd() * 2)), 0, 'gate');
  pool.splice(Math.max(0, pool.length - 1 - Math.floor(rnd() * 2)), 0, L >= 2 || stage >= 2 ? 'gate2' : 'gate');
  // v3: a smoke curtain (a power or the light breaks it best) and, deeper in, a bridge of planks
  if (L >= 2 && rnd() < 0.4) pool.splice(2 + Math.floor(rnd() * Math.max(1, pool.length - 3)), 0, 'barrier');
  if (L >= 4 && rnd() < 0.35) pool.splice(1 + Math.floor(rnd() * Math.max(1, pool.length - 2)), 0, 'bridge');
  return pool;
}

/** The first-ever floor: one thing at a time, each taught when it comes. */
export const WARM_PLAN: readonly Beat[] = ['pitN', 'block', 'pitW', 'gate2', 'walker', 'tall', 'pen', 'pitN', 'block'];

// ── the clock tower ──────────────────────────────────────────────
/** A small integer hash (a floor's trials are the same for everyone). */
function mixHash(n: number): number {
  let x = (n | 0) ^ 0x2545f491;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** The keeper floors: every fifth. */
export const keeperFloor = (floor: number): boolean => floor >= 1 && floor % RULES.tower.keeperEvery === 0;

/**
 * The trial a tower floor holds: every fifth floor a keeper; the first four floors teach (the quarry,
 * the bridge, the gates, the weights); after that each band of four floors takes four different
 * trials in an order of its own.
 */
export function floorKind(floor: number): FloorKind {
  const f = Math.max(1, Math.round(floor));
  if (keeperFloor(f)) return 'keeper';
  const band = Math.floor((f - 1) / RULES.tower.keeperEvery), i = (f - 1) % RULES.tower.keeperEvery;
  if (band === 0) return (['quarry', 'bridge', 'gates', 'pendulum'] as const)[i];
  const order = TRIALS.slice();
  for (let k = order.length - 1; k > 0; k--) {
    const j = mixHash(band * 31 + k) % (k + 1);
    [order[k], order[j]] = [order[j], order[k]];
  }
  return order[i];
}

/** The tower's shadows come from the era of the floor's band: Babel's, the fortress's, the city's, round again. */
export const eraOfFloor = (floor: number): EraId => ERAS[Math.floor((Math.max(1, floor) - 1) / RULES.tower.keeperEvery) % ERAS.length];

/** How hard a tower floor is, as a valley level (the numbers scale with it). */
export const floorLevel = (floor: number): number => 1 + (Math.max(1, floor) - 1) * RULES.tower.perFloor;

/** A tower floor's beats for its trial (a keeper's floor is only its arena). */
export function towerPlan(floor: number, kind: FloorKind, rnd: () => number): Beat[] {
  if (kind === 'keeper') return [];
  const T = RULES.tower;
  const len = T.len[0] + Math.min(T.len[2], T.len[1] * (Math.max(1, floor) - 1));
  const n = Math.max(4, Math.round(len / 7));
  const pick = <B extends Beat>(xs: readonly B[]): B => xs[Math.floor(rnd() * xs.length) % xs.length];
  const out: Beat[] = [];
  switch (kind) {
    case 'quarry':
      for (let i = 0; i < n; i++) out.push(pick(['block', 'block', 'tall', 'pair']));
      out.splice(1 + Math.floor(rnd() * (out.length - 1)), 0, 'walker');
      break;
    case 'bridge':
      out.push('bridge', pick(['block', 'walker']), 'bridge', pick(['pitN', 'block']));
      if (n > 4) out.push('bridge');
      break;
    case 'pendulum':
      out.push('pend', pick(['block', 'walker']), 'pend', pick(['pitN', 'block']), 'pend');
      break;
    case 'gates':
      out.push('gate', 'block', 'gate2', pick(['walker', 'block']), 'gate2', 'giant');
      return out;
    case 'pens':
      out.push('pen', pick(['block', 'walker']), 'pen', 'pitN', 'pen');
      break;
    case 'dark':
      for (let i = 0; i < n; i++) out.push(pick(['walker', 'special', 'walker', 'pitN', 'block']));
      break;
    case 'tide':
      for (let i = 0; i < Math.max(3, n - 1); i++) out.push(pick(['block', 'pitN', 'block', 'pitW']));
      break;
  }
  // every trial grows the weapon a little: a gate early (a high one from the third floor)
  out.splice(Math.min(1, out.length), 0, floor >= 3 ? 'gate2' : 'gate');
  return out;
}
