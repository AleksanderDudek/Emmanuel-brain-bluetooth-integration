/**
 * Źródła's valley without the screen: the grid, the seven channel stones of Pipe Mania (two
 * straights, four bends, the cross) and the pool, the spring, the garden, rocks, old aqueduct stones
 * and one-way stones; where water entering a cell from a side leaves it; the path the water will
 * take through the dry stones ahead of it and where that path ends; a valley's generator (always
 * solvable: the free cells reachable from the spring hold the goal with room to spare, and the
 * garden is reachable); the dispenser; and the helper that lays the next stone (Space).
 * No DOM; randomness only from the caller's generator.
 */
import { RULES, gridOf, goalOf, isGarden, rocksOf } from './rules';

// ── directions ─────────────────────────────────────────────────────
/** 0 north, 1 east, 2 south, 3 west */
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const bit = (d: number): number => 1 << d;
export const opp = (d: number): number => (d + 2) % 4;

// ── the stones ─────────────────────────────────────────────────────
export type Kind = 'h' | 'v' | 'ne' | 'nw' | 'se' | 'sw' | 'x' | 'ph' | 'pv';
export const KINDS: readonly Kind[] = ['h', 'v', 'ne', 'nw', 'se', 'sw', 'x', 'ph', 'pv'];
const N = 1, E = 2, S = 4, W = 8;
export const MASK: Readonly<Record<Kind, number>> = { h: E | W, v: N | S, ne: N | E, nw: N | W, se: S | E, sw: S | W, x: 15, ph: E | W, pv: N | S };
export const isPool = (k: Kind | null): boolean => k === 'ph' || k === 'pv';
export const isBend = (k: Kind | null): boolean => k === 'ne' || k === 'nw' || k === 'se' || k === 'sw';

export const EMPTY = 0, ROCK = 1, SPRING = 2, GARDEN = 3, PIPE = 4;
export type CellType = typeof EMPTY | typeof ROCK | typeof SPRING | typeof GARDEN | typeof PIPE;

export interface Cell {
  type: CellType;
  kind: Kind | null;
  /** laid by the valley (an old aqueduct, a one-way stone): cannot be replaced */
  fixed: boolean;
  aqueduct: boolean;
  /** a one-way stone: the only side water may leave by (−1: none) */
  oneway: number;
  /** the spring's outlet side, the garden's inlet side */
  dir: number;
  /** channels the water filled: bit 0 the main (a cross's east–west), bit 1 a cross's north–south */
  wet: number;
  /** the garden calm grows on a wet cell (rest blocks), 0..1, and whether it bloomed */
  green: number;
  bloom: boolean;
  /** when the stone was laid (s of play), for the view's drop-in */
  laidAt: number;
}

const blank = (): Cell => ({ type: EMPTY, kind: null, fixed: false, aqueduct: false, oneway: -1, dir: -1, wet: 0, green: 0, bloom: false, laidAt: -9 });

/** The channel water entering a cell from `side` uses (a cross has two). */
export const channelOf = (kind: Kind | null, side: number): number => (kind === 'x' && (side === 0 || side === 2) ? 1 : 0);

/** Where water entering stone `kind` from `side` leaves (−1: the stone has no opening on that side). */
export function exitOf(kind: Kind, side: number): number {
  const m = MASK[kind];
  if (!(m & bit(side))) return -1;
  if (isBend(kind)) {
    const rest = m & ~bit(side);
    for (let d = 0; d < 4; d++) if (rest & bit(d)) return d;
    return -1;
  }
  return opp(side);
}

/** One stretch of the water's way: a cell, the side it came in by (−1: the spring), the side it leaves by, the channel. */
export interface Seg { cell: number; entry: number; exit: number; ch: number }

/** Why the way ahead ends where it does. */
export type EndKind = 'empty' | 'edge' | 'rock' | 'mismatch' | 'garden' | 'blocked';
export interface PathEnd { cell: number; side: number; kind: EndKind }

export class Valley {
  readonly cells: Cell[];
  spring = -1;
  garden = -1;
  constructor(readonly cols: number, readonly rows: number) {
    this.cells = Array.from({ length: cols * rows }, blank);
  }

  get n(): number { return this.cols * this.rows; }
  idx(c: number, r: number): number { return r * this.cols + c; }
  col(i: number): number { return i % this.cols; }
  row(i: number): number { return Math.floor(i / this.cols); }
  inside(c: number, r: number): boolean { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  /** the neighbour of cell `i` across side `d` (−1: off the grid) */
  step(i: number, d: number): number {
    const c = this.col(i) + DX[d], r = this.row(i) + DY[d];
    return this.inside(c, r) ? this.idx(c, r) : -1;
  }

  /** A stone can be laid here: an empty cell, or a dry stone the hands laid (it is replaced). */
  canLay(i: number): boolean {
    const c = this.cells[i];
    if (!c) return false;
    return c.type === EMPTY || (c.type === PIPE && !c.fixed && c.wet === 0);
  }

  lay(i: number, kind: Kind, now: number): void {
    const c = this.cells[i];
    c.type = PIPE;
    c.kind = kind;
    c.fixed = false;
    c.aqueduct = false;
    c.oneway = -1;
    c.wet = 0;
    c.laidAt = now;
  }

  /**
   * Water arriving at cell `i` by `side`: the stretch it runs through, 'garden' when it is the
   * garden's inlet, or why it cannot (`wet` counts channels already filled, plus `extra` planned ones).
   */
  enter(i: number, side: number, extra?: ReadonlySet<number>): Seg | 'garden' | EndKind {
    if (i < 0) return 'edge';
    const c = this.cells[i];
    if (c.type === EMPTY) return 'empty';
    if (c.type === ROCK || c.type === SPRING) return 'rock';
    if (c.type === GARDEN) return side === c.dir ? 'garden' : 'rock';
    const kind = c.kind!;
    const exit = exitOf(kind, side);
    if (exit < 0) return 'mismatch';
    if (c.oneway >= 0 && exit !== c.oneway) return 'mismatch';
    const ch = channelOf(kind, side);
    const wet = c.wet | (extra?.has(i * 2 + ch) ? bit(ch) : 0);
    if (wet & bit(ch)) return 'blocked';
    return { cell: i, entry: side, exit, ch };
  }

  /**
   * The way ahead of the water: from the stretch `from` (the water's last), through the dry stones
   * it would fill in turn, to where it ends.  `cells` counts the stretches (a cross run twice counts
   * twice), `garden` whether it ends in the garden.
   */
  ahead(from: Seg): { segs: Seg[]; end: PathEnd } {
    const planned = new Set<number>();
    const segs: Seg[] = [];
    let cur = from;
    for (let guard = 0; guard < this.n * 2 + 2; guard++) {
      const nx = this.step(cur.cell, cur.exit);
      const side = opp(cur.exit);
      const r = this.enter(nx, side, planned);
      if (typeof r === 'object') {
        planned.add(r.cell * 2 + r.ch);
        segs.push(r);
        cur = r;
        continue;
      }
      return { segs, end: { cell: nx, side, kind: r === 'garden' ? 'garden' : r } };
    }
    return { segs, end: { cell: -1, side: 0, kind: 'blocked' } };
  }

  /** The spring's own stretch (the water's first). */
  springSeg(): Seg { return { cell: this.spring, entry: -1, exit: this.cells[this.spring].dir, ch: 0 }; }

  /** Empty cells reachable from cell `start` through empty cells (rocks, fixed stones and the spring stop it). */
  reach(start: number): number {
    if (start < 0 || this.cells[start].type !== EMPTY) return 0;
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const i = q.pop()!;
      for (let d = 0; d < 4; d++) {
        const j = this.step(i, d);
        if (j >= 0 && !seen.has(j) && this.cells[j].type === EMPTY) { seen.add(j); q.push(j); }
      }
    }
    return seen.size;
  }

  reachable(start: number, target: number): boolean {
    if (start < 0 || target < 0) return false;
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const i = q.pop()!;
      if (i === target) return true;
      for (let d = 0; d < 4; d++) {
        const j = this.step(i, d);
        if (j >= 0 && !seen.has(j) && (this.cells[j].type === EMPTY || j === target)) { seen.add(j); q.push(j); }
      }
    }
    return false;
  }

  /** cells the water filled (the spring's stretch included) */
  wetCells(): number[] {
    const out: number[] = [];
    this.cells.forEach((c, i) => { if (c.wet) out.push(i); });
    return out;
  }

  emptyCount(): number { return this.cells.reduce((s, c) => s + (c.type === EMPTY ? 1 : 0), 0); }
}

// ── the valleys ───────────────────────────────────────────────────
/** A small seeded generator (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const valleySeed = (v: number, attempt = 0): number => (Math.imul(v + 1, 0x9e3779b1) ^ Math.imul(attempt + 7, 0x85ebca6b)) >>> 0;

export interface ValleySpec { v: number; goal: number; garden: boolean; cols: number; rows: number }

export function specOf(v: number): ValleySpec {
  const [cols, rows] = gridOf(v);
  return { v, goal: goalOf(v), garden: isGarden(v), cols, rows };
}

/**
 * Valley `v` of the road, the same for everyone: the spring a step in from the edge with its outlet
 * toward the open middle, rocks, from valley 3 old aqueduct stones, from valley 9 a one-way stone,
 * and in a station's last valley the garden the water must reach.  Tried seed by seed until the
 * free cells reachable from the spring's outlet hold the goal with room, and the garden is reachable.
 */
export function makeValley(v: number): Valley {
  const spec = specOf(v);
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = seeded(valleySeed(v, attempt));
    const val = tryValley(spec, rng, attempt >= 30 ? 0 : 1);
    if (val) return val;
  }
  // a plain valley, never unsolvable
  const val = new Valley(spec.cols, spec.rows);
  const s = val.idx(1, Math.floor(spec.rows / 2));
  val.spring = s;
  Object.assign(val.cells[s], { type: SPRING, dir: 1, fixed: true });
  if (spec.garden) {
    const g = val.idx(spec.cols - 2, Math.floor(spec.rows / 2));
    val.garden = g;
    Object.assign(val.cells[g], { type: GARDEN, dir: 3, fixed: true });
  }
  return val;
}

function tryValley(spec: ValleySpec, rng: () => number, extras: number): Valley | null {
  const { cols, rows, v } = spec;
  const val = new Valley(cols, rows);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
  // the spring: one cell in from an edge (or on it in a small grid), its outlet toward the middle
  const sc = 1 + Math.floor(rng() * Math.max(1, cols - 2));
  const sr = 1 + Math.floor(rng() * Math.max(1, rows - 2));
  const s = val.idx(Math.min(cols - 1, sc), Math.min(rows - 1, sr));
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  const dxs = cx - val.col(s), dys = cy - val.row(s);
  let out = Math.abs(dxs) >= Math.abs(dys) ? (dxs >= 0 ? 1 : 3) : (dys >= 0 ? 2 : 0);
  if (rng() < 0.3) out = pick([0, 1, 2, 3].filter(d => val.step(s, d) >= 0));
  if (val.step(s, out) < 0) return null;
  val.spring = s;
  Object.assign(val.cells[s], { type: SPRING, dir: out, fixed: true });
  const outlet = val.step(s, out);
  const keep = new Set([s, outlet]);
  // the garden: far from the spring, its inlet facing an inside cell
  if (spec.garden) {
    const far: number[] = [];
    for (let i = 0; i < val.n; i++) {
      if (keep.has(i)) continue;
      const dist = Math.abs(val.col(i) - val.col(s)) + Math.abs(val.row(i) - val.row(s));
      if (dist >= Math.min(cols + rows - 4, Math.max(4, Math.round(spec.goal * 0.55)))) far.push(i);
    }
    if (!far.length) return null;
    const g = pick(far);
    const inl = [0, 1, 2, 3].filter(d => val.step(g, d) >= 0 && !keep.has(val.step(g, d)));
    if (!inl.length) return null;
    const gd = pick(inl);
    val.garden = g;
    Object.assign(val.cells[g], { type: GARDEN, dir: gd, fixed: true });
    keep.add(g).add(val.step(g, gd));
  }
  const free = () => {
    const xs: number[] = [];
    for (let i = 0; i < val.n; i++) if (val.cells[i].type === EMPTY && !keep.has(i)) xs.push(i);
    return xs;
  };
  // rocks
  const rocks = rocksOf(v) * extras;
  for (let k = 0; k < rocks; k++) {
    const xs = free();
    if (!xs.length) break;
    Object.assign(val.cells[pick(xs)], { type: ROCK, fixed: true });
  }
  // old aqueduct stones and a one-way stone (never next to the outlet)
  const near = new Set<number>();
  for (let d = 0; d < 4; d++) near.add(val.step(outlet, d));
  const aq = v >= RULES.aqueductFrom ? (v >= 8 ? 2 : 1) * extras : 0;
  for (let k = 0; k < aq; k++) {
    const xs = free().filter(i => !near.has(i));
    if (!xs.length) break;
    const i = pick(xs);
    const kind = pick(['h', 'v', 'ne', 'nw', 'se', 'sw', 'x'] as const);
    Object.assign(val.cells[i], { type: PIPE, kind, fixed: true, aqueduct: true });
  }
  if (v >= RULES.onewayFrom && extras) {
    const xs = free().filter(i => !near.has(i));
    if (xs.length) {
      const i = pick(xs);
      const horiz = rng() < 0.5;
      Object.assign(val.cells[i], { type: PIPE, kind: horiz ? 'h' : 'v', fixed: true, oneway: horiz ? pick([1, 3]) : pick([0, 2]) });
    }
  }
  // solvable: room for the goal, the garden reachable
  if (val.reach(outlet) < spec.goal + 4) return null;
  if (spec.garden) {
    const g = val.garden, gin = val.step(g, val.cells[g].dir);
    if (!val.reachable(outlet, gin)) return null;
  }
  return val;
}

// ── the dispenser ─────────────────────────────────────────────────
/** The next stone: straights, bends, the cross and (from valley 2) a pool now and then; `help` = a side it should open on. */
export function deal(rng: () => number, v: number, help: number | null): Kind {
  const R = RULES;
  const pool = v >= R.poolFrom;
  const w: [Kind, number][] = [
    ['h', R.wStraight], ['v', R.wStraight], ['ne', R.wBend], ['nw', R.wBend], ['se', R.wBend], ['sw', R.wBend], ['x', R.wCross],
    ['ph', pool ? R.wPool / 2 : 0], ['pv', pool ? R.wPool / 2 : 0],
  ];
  const list = help === null ? w : w.filter(([k]) => MASK[k] & bit(help));
  const sum = list.reduce((s, [, x]) => s + x, 0);
  let r = rng() * sum;
  for (const [k, x] of list) {
    r -= x;
    if (r <= 0 && x > 0) return k;
  }
  return list[0][0];
}

/**
 * Where the helper (Space) lays stone `kind`: at the open end of the way ahead when the stone
 * continues it toward a free cell; otherwise "parked" in a free cell well away from the open end and
 * the water (as Pipe Mania players do with a stone they cannot use yet).  −1: nowhere.
 */
export function autoSpot(val: Valley, kind: Kind, end: PathEnd, water: number): number {
  if (end.kind === 'garden') return park(val, end, water);
  const i = end.cell;
  if (i >= 0 && val.canLay(i) && (end.kind === 'empty' || end.kind === 'mismatch')) {
    const ex = exitOf(kind, end.side);
    if (ex >= 0) {
      const nx = val.step(i, ex);
      const next = nx >= 0 ? val.cells[nx] : null;
      const open = next !== null && (next.type === EMPTY
        || (next.type === GARDEN && opp(ex) === next.dir)
        || (next.type === PIPE && exitOf(next.kind!, opp(ex)) >= 0 && (next.oneway < 0 || exitOf(next.kind!, opp(ex)) === next.oneway)));
      if (open) return i;
    }
  }
  return park(val, end, water);
}

function park(val: Valley, end: PathEnd, water: number): number {
  let best = -1, bestScore = -Infinity;
  const ec = end.cell >= 0 ? end.cell : water;
  const gin = val.garden >= 0 ? val.step(val.garden, val.cells[val.garden].dir) : -1;
  for (let i = 0; i < val.n; i++) {
    if (val.cells[i].type !== EMPTY || i === end.cell || i === gin) continue;
    const d1 = Math.abs(val.col(i) - val.col(ec)) + Math.abs(val.row(i) - val.row(ec));
    const d2 = water >= 0 ? Math.abs(val.col(i) - val.col(water)) + Math.abs(val.row(i) - val.row(water)) : 0;
    const edge = val.col(i) === 0 || val.row(i) === 0 || val.col(i) === val.cols - 1 || val.row(i) === val.rows - 1 ? 1.5 : 0;
    const score = d1 + 0.5 * d2 + edge + ((i * 7) % 5) * 0.01;
    if (d1 >= 2 && score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
