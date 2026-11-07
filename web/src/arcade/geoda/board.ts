/**
 * Geoda's board and pieces without the DOM (Block Blast's rules): an 8×8 board of empty cells,
 * crystal tiles (five colours) and the chambers' rock; a jewel may sit in a filled cell, and a
 * druse (crystal points the band grows) in a cleared, still-empty one.  A piece is placed whole,
 * never rotated, only where every cell is empty; then every full row and every full column clears
 * at once.  `bestSpot` is the auto-place helper and the dealer's look-ahead; `deal` offers three
 * pieces that can all be placed in some order (Block Blast's fair dealer), leaning toward pieces
 * that finish a line and, in a rest block, toward small ones.
 */
import { PIECES, type Piece } from './content';
import { RULES } from './rules';

export const N = RULES.n;
export const EMPTY = 0;
/** a chamber's rock (tiles are 1..5) */
export const ROCK = 9;

export type Pt = readonly [number, number];

/** One piece in the tray: its shape, its tile colour (1..5), and a jewel in one of its cells (kind 1..4, at `jewelAt`). */
export interface TrayItem { piece: Piece; tile: number; jewel: number; jewelAt: number }

export interface Placed {
  /** the board cells the piece took (indices) */
  cells: number[];
  rows: number[];
  cols: number[];
  /** every cell the clear emptied, with what was in it */
  cleared: { i: number; tile: number; jewel: number }[];
  /** druse growth harvested under the piece (sum of 0..1 per cell) */
  druse: number;
  druseCells: number[];
  /** the board is empty after the clear */
  clean: boolean;
}

export const idx = (x: number, y: number): number => y * N + x;

export class Board {
  readonly cells = new Uint8Array(N * N);
  readonly jewel = new Uint8Array(N * N);
  /** druse growth 0..1 on cleared, still-empty cells (seeded ones only) */
  readonly druse = new Float32Array(N * N);
  readonly seeded = new Uint8Array(N * N);

  clone(): Board {
    const b = new Board();
    b.cells.set(this.cells);
    b.jewel.set(this.jewel);
    b.druse.set(this.druse);
    b.seeded.set(this.seeded);
    return b;
  }

  get filled(): number {
    let n = 0;
    for (let i = 0; i < N * N; i++) if (this.cells[i] !== EMPTY) n++;
    return n;
  }

  get empty(): boolean { return this.filled === 0; }

  /** jewels still in the board, by kind (index 1..4) */
  jewels(): number[] {
    const out = [0, 0, 0, 0, 0];
    for (let i = 0; i < N * N; i++) if (this.jewel[i]) out[this.jewel[i]]++;
    return out;
  }

  fits(p: Piece, gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx + p.w > N || gy + p.h > N) return false;
    for (const [x, y] of p.cells) if (this.cells[idx(gx + x, gy + y)] !== EMPTY) return false;
    return true;
  }

  /** every spot where the piece fits (its top-left corner) */
  spots(p: Piece): Pt[] {
    const out: Pt[] = [];
    for (let gy = 0; gy + p.h <= N; gy++) for (let gx = 0; gx + p.w <= N; gx++) if (this.fits(p, gx, gy)) out.push([gx, gy]);
    return out;
  }

  fitsAnywhere(p: Piece): boolean {
    for (let gy = 0; gy + p.h <= N; gy++) for (let gx = 0; gx + p.w <= N; gx++) if (this.fits(p, gx, gy)) return true;
    return false;
  }

  /** The rows and columns that would be full with the piece at (gx, gy) (it must fit). */
  wouldClear(p: Piece, gx: number, gy: number): { rows: number[]; cols: number[] } {
    const set = new Set(p.cells.map(([x, y]) => idx(gx + x, gy + y)));
    const on = (i: number) => this.cells[i] !== EMPTY || set.has(i);
    const rows: number[] = [], cols: number[] = [];
    for (let k = 0; k < N; k++) {
      let r = true, c = true;
      for (let j = 0; j < N && (r || c); j++) {
        if (r && !on(idx(j, k))) r = false;
        if (c && !on(idx(k, j))) c = false;
      }
      if (r) rows.push(k);
      if (c) cols.push(k);
    }
    return { rows, cols };
  }

  /** Put the piece down (it must fit) with tile colour `tile`, a jewel in its `jewelAt`-th cell; clear full lines. */
  place(p: Piece, gx: number, gy: number, tile: number, jewel = 0, jewelAt = -1): Placed {
    const cells: number[] = [];
    let druse = 0;
    const druseCells: number[] = [];
    p.cells.forEach(([x, y], k) => {
      const i = idx(gx + x, gy + y);
      cells.push(i);
      this.cells[i] = tile;
      this.jewel[i] = k === jewelAt ? jewel : 0;
      if (this.seeded[i] && this.druse[i] > 0.02) {
        druse += this.druse[i];
        druseCells.push(i);
      }
      this.druse[i] = 0;
      this.seeded[i] = 0;
    });
    const rows: number[] = [], cols: number[] = [];
    for (let k = 0; k < N; k++) {
      let r = true, c = true;
      for (let j = 0; j < N; j++) {
        if (this.cells[idx(j, k)] === EMPTY) r = false;
        if (this.cells[idx(k, j)] === EMPTY) c = false;
      }
      if (r) rows.push(k);
      if (c) cols.push(k);
    }
    const hit = new Set<number>();
    for (const r of rows) for (let j = 0; j < N; j++) hit.add(idx(j, r));
    for (const c of cols) for (let j = 0; j < N; j++) hit.add(idx(c, j));
    const cleared = [...hit].sort((a, b) => a - b).map(i => ({ i, tile: this.cells[i], jewel: this.jewel[i] }));
    for (const { i } of cleared) {
      this.cells[i] = EMPTY;
      this.jewel[i] = 0;
      this.seeded[i] = 1;
      this.druse[i] = 0;
    }
    return { cells, rows, cols, cleared, druse, druseCells, clean: this.empty };
  }

  /** Druses grow on seeded empty cells by `amount` (0..1 each, capped). */
  grow(amount: number): number {
    let grown = 0;
    for (let i = 0; i < N * N; i++) {
      if (!this.seeded[i] || this.cells[i] !== EMPTY || this.druse[i] >= 1) continue;
      const before = this.druse[i];
      this.druse[i] = Math.min(1, before + amount);
      grown += this.druse[i] - before;
    }
    return grown;
  }

  /** seeded empty cells (where druses can grow) */
  get seeds(): number {
    let n = 0;
    for (let i = 0; i < N * N; i++) if (this.seeded[i] && this.cells[i] === EMPTY) n++;
    return n;
  }

  clear(): void {
    this.cells.fill(0);
    this.jewel.fill(0);
    this.druse.fill(0);
    this.seeded.fill(0);
  }
}

// ── the auto-place helper ───────────────────────────────────────

/**
 * How good a spot is: lines cleared (most), jewels cleared, cells touching walls and filled cells
 * (a tidy board), minus lonely holes left behind (single empty cells walled in on four sides).
 */
export function spotScore(b: Board, p: Piece, gx: number, gy: number): number {
  const { rows, cols } = b.wouldClear(p, gx, gy);
  const lines = rows.length + cols.length;
  const set = new Set(p.cells.map(([x, y]) => idx(gx + x, gy + y)));
  const full = (x: number, y: number) => x < 0 || y < 0 || x >= N || y >= N || b.cells[idx(x, y)] !== EMPTY || set.has(idx(x, y));
  let contact = 0;
  for (const [x, y] of p.cells) {
    const ax = gx + x, ay = gy + y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = ax + dx, ny = ay + dy;
      if (set.has(idx(nx, ny)) && nx >= 0 && ny >= 0 && nx < N && ny < N) continue;
      if (full(nx, ny)) contact++;
    }
  }
  let jewels = 0, druse = 0;
  if (lines) {
    for (const r of rows) for (let j = 0; j < N; j++) if (b.jewel[idx(j, r)]) jewels++;
    for (const c of cols) for (let j = 0; j < N; j++) if (b.jewel[idx(c, j)]) jewels++;
  }
  for (const i of set) druse += b.seeded[i] ? b.druse[i] : 0;
  // lonely holes next to the piece (cleared lines leave none worth counting)
  let holes = 0;
  if (!lines) {
    for (const [x, y] of p.cells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const hx = gx + x + dx, hy = gy + y + dy;
        if (hx < 0 || hy < 0 || hx >= N || hy >= N || full(hx, hy)) continue;
        if (full(hx + 1, hy) && full(hx - 1, hy) && full(hx, hy + 1) && full(hx, hy - 1)) holes++;
      }
    }
  }
  return lines * 100 + lines * lines * 20 + jewels * 30 + druse * 12 + contact * 3 - holes * 9 + p.cells.length;
}

/** The best spot for a piece (null: it fits nowhere); ties go to the spot nearest the board's centre. */
export function bestSpot(b: Board, p: Piece): Pt | null {
  let best: Pt | null = null, bs = -Infinity;
  for (const [gx, gy] of b.spots(p)) {
    const cx = gx + p.w / 2 - N / 2, cy = gy + p.h / 2 - N / 2;
    const s = spotScore(b, p, gx, gy) - (cx * cx + cy * cy) * 0.01;
    if (s > bs) { bs = s; best = [gx, gy]; }
  }
  return best;
}

/**
 * The spot for a tap at board cell (cx, cy): the piece centred on it when it fits there, else the
 * fitting spot nearest to it (within `reach` cells), else the best spot on the board.
 */
export function tapSpot(b: Board, p: Piece, cx: number, cy: number, reach = 2.5): Pt | null {
  const ax = Math.round(cx - (p.w - 1) / 2), ay = Math.round(cy - (p.h - 1) / 2);
  if (b.fits(p, ax, ay)) return [ax, ay];
  let near: Pt | null = null, nd = Infinity;
  for (const [gx, gy] of b.spots(p)) {
    const d = Math.hypot(gx - ax, gy - ay);
    if (d < nd) { nd = d; near = [gx, gy]; }
  }
  if (near && nd <= reach) return near;
  return bestSpot(b, p);
}

/** How many of the pieces can be placed one after another (greedy best spots, in the best order). */
export function placeable(b: Board, pieces: readonly Piece[]): number {
  let best = 0;
  const orders = permutations(pieces.length);
  for (const order of orders) {
    const c = b.clone();
    let n = 0;
    for (const k of order) {
      const s = bestSpot(c, pieces[k]);
      if (!s) break;
      c.place(pieces[k], s[0], s[1], 1);
      n++;
    }
    best = Math.max(best, n);
    if (best === pieces.length) break;
  }
  return best;
}

function permutations(n: number): number[][] {
  if (n <= 1) return [[0].slice(0, n)];
  const out: number[][] = [];
  const rec = (pre: number[], left: number[]) => {
    if (!left.length) { out.push(pre); return; }
    left.forEach((v, i) => rec([...pre, v], left.filter((_, j) => j !== i)));
  };
  rec([], Array.from({ length: n }, (_, i) => i));
  return out;
}

// ── the dealer ──────────────────────────────────────────────────

export interface DealOpts {
  /** a rest block or the warm-up: small pieces lean in */
  gentle: boolean;
  /** jewel kinds the chamber still wants (empty: no jewels on pieces) */
  jewels: readonly number[];
  jewelChance: number;
}

/** A piece's weight for this board: its own, more if it finishes a line now, more if small and gentle. */
export function weightOf(b: Board, p: Piece, gentle: boolean): number {
  let w = p.weight;
  if (gentle && p.cells.length <= 3) w *= RULES.gentleLean;
  if (gentle && p.cells.length >= 6) w *= 0.4;
  for (const [gx, gy] of b.spots(p)) {
    const c = b.wouldClear(p, gx, gy);
    if (c.rows.length + c.cols.length) { w *= RULES.helpLean; break; }
  }
  return w;
}

function draw(rng: () => number, ws: readonly number[]): number {
  const total = ws.reduce((s, v) => s + v, 0);
  let r = rng() * total;
  for (let i = 0; i < ws.length; i++) {
    r -= ws[i];
    if (r < 0) return i;
  }
  return ws.length - 1;
}

/**
 * Three pieces for the tray: drawn by weight until all three can be placed in some order (tries
 * RULES.dealTries triples), else the triple that places the most.  Each gets a tile colour, and
 * with `jewelChance` a jewel the chamber wants in one of its cells.
 */
export function deal(b: Board, rng: () => number, o: DealOpts): TrayItem[] {
  const ws = PIECES.map(p => weightOf(b, p, o.gentle));
  let best: Piece[] = [], bestN = -1;
  for (let k = 0; k < RULES.dealTries; k++) {
    const trio = [0, 1, 2].map(() => PIECES[draw(rng, ws)]);
    const n = placeable(b, trio);
    if (n > bestN) { best = trio; bestN = n; }
    if (n === 3) break;
  }
  return best.map(piece => {
    const tile = 1 + Math.min(4, Math.floor(rng() * 5));
    let jewel = 0, jewelAt = -1;
    if (o.jewels.length && rng() < o.jewelChance) {
      jewel = o.jewels[Math.min(o.jewels.length - 1, Math.floor(rng() * o.jewels.length))];
      jewelAt = Math.min(piece.cells.length - 1, Math.floor(rng() * piece.cells.length));
    }
    return { piece, tile, jewel, jewelAt };
  });
}

/**
 * A chamber's starting board: `rock` cells of rock in a few clumps (no full line), `jewels` of the
 * wanted kinds set into the rock.  Seeded, so the same chamber looks the same.
 */
export function chamberBoard(rng: () => number, rock: number, jewelKinds: readonly number[], jewels: number): Board {
  const b = new Board();
  const want = Math.min(rock, N * N - 3 * N);
  let placed = 0, guard = 0;
  while (placed < want && guard++ < 400) {
    // a clump grows from a seed cell, usually in the lower half (rock settles)
    let x = Math.floor(rng() * N), y = Math.floor(N / 2 - 1 + rng() * (N / 2 + 1));
    y = Math.min(N - 1, y);
    const size = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < size && placed < want; k++) {
      const i = idx(x, y);
      if (b.cells[i] === EMPTY) {
        b.cells[i] = ROCK;
        if (rowFull(b, y) || colFull(b, x)) b.cells[i] = EMPTY;
        else placed++;
      }
      const d = Math.floor(rng() * 4);
      x = Math.max(0, Math.min(N - 1, x + (d === 0 ? 1 : d === 1 ? -1 : 0)));
      y = Math.max(0, Math.min(N - 1, y + (d === 2 ? 1 : d === 3 ? -1 : 0)));
    }
  }
  const rocks: number[] = [];
  for (let i = 0; i < N * N; i++) if (b.cells[i] === ROCK) rocks.push(i);
  for (let k = 0; k < jewels && rocks.length && jewelKinds.length; k++) {
    const j = Math.floor(rng() * rocks.length);
    b.jewel[rocks[j]] = jewelKinds[k % jewelKinds.length];
    rocks.splice(j, 1);
  }
  return b;
}

function rowFull(b: Board, y: number): boolean {
  for (let x = 0; x < N; x++) if (b.cells[idx(x, y)] === EMPTY) return false;
  return true;
}

function colFull(b: Board, x: number): boolean {
  for (let y = 0; y < N; y++) if (b.cells[idx(x, y)] === EMPTY) return false;
  return true;
}
