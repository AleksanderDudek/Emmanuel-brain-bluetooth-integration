/**
 * Arka's holds, without the DOM: the deck as a grid of cells, the animals on it (one cell each,
 * facing N, E, S or W), the straight way out, and the generator that builds every hold solvable by
 * construction.
 *
 * Reverse construction: first a removal order in which at most `open` kinds are ever "open" (one
 * animal out on the landing, its mate still on the deck — so at most `open` stalls are ever in use),
 * then the animals are placed in the reverse of that order, each on a free cell whose straight way
 * to the edge crosses no animal placed before it (none that leaves after it).  Removing them in the
 * chosen order is then always possible with three stalls and no help, and so is any subset of the
 * deck: taking animals away only ever opens ways.  Animals pair by kind (any two sheep are a pair),
 * as Genesis has them, "kind by kind".
 *
 * The generator also plays each candidate hold with a greedy player that sends any free animal whose
 * mate waits, else any free animal; a hold it jams too often is built again.  All of it is
 * deterministic for (spec, seed): the same day's hold for everyone.
 */
import { mulberry32 } from '../../core/random';
import type { KindId } from './content';

/** Facing: up, right, down, left on screen. */
export type Dir = 0 | 1 | 2 | 3;
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];
export const DIRS: readonly Dir[] = [0, 1, 2, 3];

export interface Animal { readonly id: number; readonly kind: KindId; readonly x: number; readonly y: number; readonly dir: Dir }

export interface Hold {
  cols: number;
  rows: number;
  animals: Animal[];
  /** a removal order (ids) that clears the hold with three stalls and no help */
  order: number[];
}

export interface HoldSpec {
  cols: number;
  rows: number;
  /** one kind per pair (a kind may come twice: two pairs of sheep) */
  pairs: readonly KindId[];
  /** the share of animals whose way out is blocked at the start */
  blocked: number;
  /** the most kinds open at once in the removal order */
  open: number;
  /** a cell that must hold a free animal of this kind (the warm-up's sheep under the smoke test's tap) */
  anchor?: { x: number; y: number; kind: KindId };
}

/** The stalls a hold is proven against: the landing without planks. */
export const STALLS = 3;

/** Cells between (x, y) and the deck's edge in `dir` (its own cell not counted). */
export function toEdge(cols: number, rows: number, x: number, y: number, dir: Dir): number {
  return dir === 0 ? y : dir === 1 ? cols - 1 - x : dir === 2 ? rows - 1 - y : x;
}

/**
 * How far ahead the first occupied cell is on the way out (1 = the next cell), or 0 when the way
 * is clear.  `grid` holds −1 for an empty cell.
 */
export function blockedAt(grid: ArrayLike<number>, cols: number, rows: number, x: number, y: number, dir: Dir): number {
  const n = toEdge(cols, rows, x, y, dir);
  for (let k = 1; k <= n; k++) if (grid[(y + DY[dir] * k) * cols + x + DX[dir] * k] >= 0) return k;
  return 0;
}

const pickOf = <T>(list: readonly T[], rnd: () => number): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

/**
 * A removal order of the pairs' animals (as kinds, two per pair) in which at most `open` kinds are
 * open at once.  At each step it closes an open kind or opens a new one, about evenly.
 */
export function removalOrder(pairs: readonly KindId[], open: number, rnd: () => number): KindId[] {
  const kinds: KindId[] = [];
  const left = new Map<KindId, number>();
  for (const k of pairs) {
    if (!left.has(k)) kinds.push(k);
    left.set(k, (left.get(k) ?? 0) + 2);
  }
  const isOpen = new Set<KindId>();
  const seq: KindId[] = [];
  let total = pairs.length * 2;
  while (total > 0) {
    const closers = kinds.filter(k => isOpen.has(k));
    const openers = isOpen.size < Math.max(1, open) ? kinds.filter(k => !isOpen.has(k) && (left.get(k) ?? 0) > 0) : [];
    let k: KindId;
    if (closers.length && (!openers.length || rnd() < 0.5)) {
      k = pickOf(closers, rnd);
      isOpen.delete(k);
    } else {
      k = pickOf(openers, rnd);
      isOpen.add(k);
    }
    left.set(k, (left.get(k) ?? 0) - 1);
    seq.push(k);
    total--;
  }
  return seq;
}

/** One attempt at a hold from a removal order: null when the cells ran out (the caller tries again). */
function place(spec: HoldSpec, seq: readonly KindId[], rnd: () => number): Hold | null {
  const { cols, rows } = spec;
  const n = seq.length;
  const grid = new Int16Array(cols * rows).fill(-1);
  const xs = new Int16Array(n), ys = new Int16Array(n), ds = new Int8Array(n);
  const blocked = new Uint8Array(n);
  let placed = 0, blockedCount = 0;
  // the anchor's animal: the last of its kind to leave, placed first, so nothing may stand in its way
  let anchorIdx = -1;
  if (spec.anchor) {
    for (let i = n - 1; i >= 0; i--) if (seq[i] === spec.anchor.kind) { anchorIdx = i; break; }
    if (anchorIdx < 0) return null;
  }
  // candidates as (cell × 4 + direction): the ones the blocked share asks for, and the rest
  const want: number[] = [];
  const rest: number[] = [];
  const order: number[] = [];
  for (let step = 0; step < n; step++) {
    // the anchor first, then the others from the last to leave to the first
    const i = step === 0 && anchorIdx >= 0 ? anchorIdx : nextIndex(n, step, anchorIdx);
    order.push(i);
    const wantBlock = placed > 0 && blockedCount < spec.blocked * (placed + 1) - 0.5;
    want.length = 0;
    rest.length = 0;
    const onlyAnchor = i === anchorIdx;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y * cols + x] >= 0) continue;
        if (onlyAnchor && (x !== spec.anchor!.x || y !== spec.anchor!.y)) continue;
        if (!onlyAnchor && spec.anchor && x === spec.anchor.x && y === spec.anchor.y) continue;
        // would it stand in the way of animals placed before it (they leave after it)?
        let onAny = false, onNew = false;
        for (let j = 0; j < order.length - 1; j++) {
          const o = order[j];
          if (!onRay(xs[o], ys[o], ds[o], x, y)) continue;
          onAny = true;
          if (!blocked[o]) onNew = true;
        }
        const wanted = wantBlock ? onNew : !onAny;
        for (const d of DIRS) {
          if (blockedAt(grid, cols, rows, x, y, d) !== 0) continue;   // its own way must be clear
          (wanted ? want : rest).push((y * cols + x) * 4 + d);
        }
      }
    }
    const list = want.length ? want : rest;
    if (!list.length) return null;
    const code = pickOf(list, rnd);
    const cell = code >> 2, d = (code & 3) as Dir;
    const x = cell % cols, y = Math.floor(cell / cols);
    for (let j = 0; j < order.length - 1; j++) {
      const o = order[j];
      if (!blocked[o] && onRay(xs[o], ys[o], ds[o], x, y)) {
        blocked[o] = 1;
        blockedCount++;
      }
    }
    xs[i] = x;
    ys[i] = y;
    ds[i] = d;
    grid[cell] = i;
    placed++;
  }
  if (anchorIdx >= 0 && blocked[anchorIdx]) return null;
  const animals: Animal[] = [];
  for (let i = 0; i < n; i++) animals.push({ id: i, kind: seq[i], x: xs[i], y: ys[i], dir: ds[i] as Dir });
  return { cols, rows, animals, order: animals.map(a => a.id) };
}

/** Placement goes from the last animal to leave to the first, skipping the anchor's (placed first). */
function nextIndex(n: number, step: number, anchorIdx: number): number {
  let i = n - 1, k = anchorIdx >= 0 ? 1 : 0;
  for (; i >= 0; i--) {
    if (i === anchorIdx) continue;
    if (k === step) return i;
    k++;
  }
  return 0;
}

/** Whether cell (x, y) lies on the way out of an animal at (ax, ay) facing `d`. */
function onRay(ax: number, ay: number, d: number, x: number, y: number): boolean {
  if (d === 0) return x === ax && y < ay;
  if (d === 1) return y === ay && x > ax;
  if (d === 2) return x === ax && y > ay;
  return y === ay && x < ax;
}

// ── checks ──────────────────────────────────────────────────────
const gridOf = (h: Hold, present: (a: Animal) => boolean): Int16Array => {
  const g = new Int16Array(h.cols * h.rows).fill(-1);
  for (const a of h.animals) if (present(a)) g[a.y * h.cols + a.x] = a.id;
  return g;
};

/**
 * Plays `order` with `stalls` stalls: every animal must be free when its turn comes and the landing
 * never overflows (pairs by kind leave at once).  True: the order clears the hold without help.
 */
export function replay(h: Hold, order: readonly number[], stalls = STALLS): boolean {
  const gone = new Set<number>();
  const grid = gridOf(h, () => true);
  const waiting = new Set<KindId>();
  for (const id of order) {
    const a = h.animals[id];
    if (!a || gone.has(id) || blockedAt(grid, h.cols, h.rows, a.x, a.y, a.dir) !== 0) return false;
    grid[a.y * h.cols + a.x] = -1;
    gone.add(id);
    if (waiting.has(a.kind)) waiting.delete(a.kind);
    else {
      if (waiting.size >= stalls) return false;
      waiting.add(a.kind);
    }
  }
  return gone.size === h.animals.length && waiting.size === 0;
}

/**
 * A greedy player: sends a free animal whose mate waits if there is one, else any free animal (at
 * random) while a stall is free.  True when it clears the hold without a jam (every stall taken and
 * no free animal able to pair).
 */
export function greedyClears(h: Hold, rnd: () => number, stalls = STALLS): boolean {
  const grid = gridOf(h, () => true);
  const on = h.animals.slice();
  const waiting = new Set<KindId>();
  const free: Animal[] = [];
  while (on.length) {
    free.length = 0;
    let pairer: Animal | null = null;
    for (const a of on) {
      if (blockedAt(grid, h.cols, h.rows, a.x, a.y, a.dir) !== 0) continue;
      free.push(a);
      if (!pairer && waiting.has(a.kind)) pairer = a;
    }
    let a: Animal;
    if (pairer) a = pairer;
    else if (waiting.size < stalls && free.length) a = pickOf(free, rnd);
    else return false;
    grid[a.y * h.cols + a.x] = -1;
    on.splice(on.indexOf(a), 1);
    if (waiting.has(a.kind)) waiting.delete(a.kind);
    else waiting.add(a.kind);
  }
  return true;
}

/** The share of animals whose way out is blocked at the start. */
export function blockedShare(h: Hold): number {
  const grid = gridOf(h, () => true);
  let n = 0;
  for (const a of h.animals) if (blockedAt(grid, h.cols, h.rows, a.x, a.y, a.dir) !== 0) n++;
  return h.animals.length ? n / h.animals.length : 0;
}

/** Greedy plays per candidate, and how many must clear for the hold to be kept. */
export const ROLLOUTS = 12;
export const ROLLOUTS_NEEDED = 12;
const ATTEMPTS = 60;

/**
 * The hold for `spec` and `seed`: built again until its removal order replays with three stalls and
 * the greedy player clears it every time; after many attempts the blocked share eases off a little,
 * so a crowded recipe still finds its hold.  The same (spec, seed) always gives the same hold.
 */
export function generateHold(spec: HoldSpec, seed: number): Hold {
  const rnd = mulberry32(seed >>> 0);
  let fallback: Hold | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const ease = Math.floor(attempt / 15) * 0.1;
    const s: HoldSpec = { ...spec, blocked: Math.max(0, spec.blocked - ease) };
    const seq = removalOrder(s.pairs, s.open, rnd);
    const h = place(s, seq, rnd);
    if (!h || !replay(h, h.order)) continue;
    fallback ??= h;
    const play = mulberry32((seed ^ (attempt * 0x9e3779b1)) >>> 0);
    let clears = 0;
    for (let k = 0; k < ROLLOUTS; k++) if (greedyClears(h, play)) clears++;
    if (clears >= ROLLOUTS_NEEDED) return h;
  }
  // nothing passed the greedy check: the first solvable one (Noah's hand keeps every hold clearable)
  return fallback ?? emptyFallback(spec, rnd);
}

/** The plainest hold: every animal on its own row or column facing out, all free (never expected in play). */
function emptyFallback(spec: HoldSpec, rnd: () => number): Hold {
  const animals: Animal[] = [];
  const cells: number[] = [];
  for (let y = 0; y < spec.rows; y++) for (let x = 0; x < spec.cols; x++) cells.push(y * spec.cols + x);
  let id = 0;
  for (const k of spec.pairs) {
    for (let m = 0; m < 2 && cells.length; m++) {
      const cell = cells.splice(Math.floor(rnd() * cells.length), 1)[0];
      const x = cell % spec.cols, y = Math.floor(cell / spec.cols);
      // facing the nearest edge keeps the way short; a blocked one stays solvable through the order below
      const dist = [y, spec.cols - 1 - x, spec.rows - 1 - y, x];
      const dir = dist.indexOf(Math.min(...dist)) as Dir;
      animals.push({ id: id++, kind: k, x, y, dir });
    }
  }
  const h: Hold = { cols: spec.cols, rows: spec.rows, animals, order: [] };
  // any acyclic order: repeatedly take a free animal
  const grid = gridOf(h, () => true);
  const left = animals.slice();
  while (left.length) {
    const i = left.findIndex(a => blockedAt(grid, h.cols, h.rows, a.x, a.y, a.dir) === 0);
    const a = left.splice(i < 0 ? 0 : i, 1)[0];
    grid[a.y * h.cols + a.x] = -1;
    h.order.push(a.id);
  }
  return h;
}
