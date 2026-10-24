/**
 * Geoda's wall, without the DOM: an 8×8 grid of rock, empty sockets and set crystals; the full rows
 * and columns; fresh geodes (a little over half rock, vein-like hollows), the first session's wall,
 * and the regrowth of harvested lines as rock with new gaps sized to what the player has been
 * placing; and where a crystal goes for a tap, a key, or "the best spot".
 */
import type { Pt } from './content';

export const N = 8;
export const EMPTY = 0;
export const ROCK = 1;
export const GEM = 2;
export type CellKind = typeof EMPTY | typeof ROCK | typeof GEM;
/** 1 mleczny, 2 czysty, 3 lśniący: the carats per cell, too */
export type Clarity = 1 | 2 | 3;

export interface Cell { k: CellKind; gem: number; clarity: Clarity; piece: number }

const rand = (rng: () => number, n: number) => Math.min(n - 1, Math.floor(rng() * n));

// ── the wall ────────────────────────────────────────────────────

export const rockCell = (): Cell => ({ k: ROCK, gem: 0, clarity: 1, piece: 0 });
export const emptyCell = (): Cell => ({ k: EMPTY, gem: 0, clarity: 1, piece: 0 });

/** Lines 0..7 are the rows (top to bottom), 8..15 the columns (left to right). */
export const lineCells = (line: number): number[] =>
  Array.from({ length: N }, (_, i) => (line < N ? line * N + i : i * N + (line - N)));

export class Wall {
  cells: Cell[] = Array.from({ length: N * N }, rockCell);
  /** cells that take no crystal right now: the lines breaking in a Zbiór */
  readonly locked = new Set<number>();

  static parse(rows: string[]): Wall {
    const w = new Wall();
    rows.forEach((r, y) => [...r.replace(/\s/g, '')].forEach((ch, x) => { w.cells[y * N + x] = ch === '.' ? emptyCell() : rockCell(); }));
    return w;
  }

  free(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    const i = y * N + x;
    return this.cells[i].k === EMPTY && !this.locked.has(i);
  }

  fits(cells: readonly Pt[], ax: number, ay: number): boolean {
    return cells.every(([x, y]) => this.free(ax + x, ay + y));
  }

  filled(line: number): number {
    return lineCells(line).reduce((s, i) => s + (this.cells[i].k !== EMPTY ? 1 : 0), 0);
  }

  full(line: number): boolean { return this.filled(line) === N; }

  /** The full lines: the rows top to bottom, then the columns left to right. */
  fullLines(): number[] {
    const out: number[] = [];
    for (let l = 0; l < 2 * N; l++) if (this.full(l)) out.push(l);
    return out;
  }

  emptyCount(): number { return this.cells.reduce((s, c) => s + (c.k === EMPTY ? 1 : 0), 0); }

  toString(): string {
    const ch = (c: Cell) => (c.k === EMPTY ? '.' : c.k === ROCK ? '#' : String(c.clarity));
    return Array.from({ length: N }, (_, y) => this.cells.slice(y * N, y * N + N).map(ch).join('')).join('\n');
  }
}

const neighbours = (i: number): number[] => {
  const x = i % N, y = Math.floor(i / N), out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < N - 1) out.push(i + 1);
  if (y > 0) out.push(i - N);
  if (y < N - 1) out.push(i + N);
  return out;
};

/**
 * Carve a connected gap of up to `size` cells into rock, from `start`: each next cell is a rock
 * neighbour of the gap, picked with `weight` (cells for which `allow` is false stay rock).
 */
export function carve(wall: Wall, start: number, size: number, rng: () => number,
  weight: (i: number) => number = () => 1, allow: (i: number) => boolean = () => true): number[] {
  if (wall.cells[start].k !== ROCK || !allow(start)) return [];
  const gap = [start];
  wall.cells[start] = emptyCell();
  while (gap.length < size) {
    const options: number[] = [], weights: number[] = [];
    for (const g of gap) {
      for (const n of neighbours(g)) {
        if (wall.cells[n].k === ROCK && allow(n) && !options.includes(n)) {
          options.push(n);
          weights.push(Math.max(0, weight(n)));
        }
      }
    }
    const total = weights.reduce((s, v) => s + v, 0);
    if (!options.length || total <= 0) break;
    let r = rng() * total, k = 0;
    while (k < options.length - 1 && r >= weights[k]) r -= weights[k], k++;
    wall.cells[options[k]] = emptyCell();
    gap.push(options[k]);
  }
  return gap;
}

const GAP_SIZES = [1, 2, 2, 3, 3, 3, 4, 4, 5, 6];

/**
 * A fresh geode: a little over half rock, with vein-like gaps of 1–6 cells.  A good wall has no
 * full line (a free clear), at most one line a single seed would finish, and a few lines that one
 * small grown crystal completes.  Returns the best of a few tries.
 */
export function generateWall(rng: () => number, emptyCells = 28): Wall {
  let best = new Wall(), bestScore = -Infinity;
  for (let attempt = 0; attempt < 30; attempt++) {
    const wall = new Wall();
    let made = 0;
    while (made < emptyCells) {
      // a new gap starts away from the others, so they read as separate hollows between veins
      const starts = wall.cells.map((_, i) => i).filter(i => wall.cells[i].k === ROCK && neighbours(i).every(n => wall.cells[n].k === ROCK));
      if (!starts.length) break;
      made += carve(wall, starts[rand(rng, starts.length)], Math.min(GAP_SIZES[rand(rng, GAP_SIZES.length)], emptyCells - made), rng).length;
    }
    let full = 0, single = 0, near = 0;
    for (let l = 0; l < 2 * N; l++) {
      const gaps = N - wall.filled(l);
      if (gaps === 0) full++;
      else if (gaps === 1) single++;
      else if (gaps <= 3) near++;
    }
    const score = -10 * full - 3 * Math.max(0, single - 1) + Math.min(near, 4);
    if (score > bestScore) { best = wall; bestScore = score; }
    if (!full && single <= 1 && near >= 3) break;
  }
  return best;
}

/** The first session's 2-cell gap in the 6th row, outlined until the first crystal goes in. */
export const FTUE_GAP = [5 * N + 3, 5 * N + 4];
/** The very first wall: every line needs a few cells, the 6th row only that gap; no line a lone seed finishes. */
export const ftueWall = (): Wall => Wall.parse([
  '##..####',
  '#..###..',
  '#.##..##',
  '.####.##',
  '.##.###.',
  '###..###',
  '##.###.#',
  '##.###.#',
]);

/**
 * After a Zbiór: the cleared lines come back as rock, each with a new gap of `size()` cells (at
 * least two of them in the line itself, so a lone seed never finishes it), the rest free to bend
 * into the rock next to it — never into crystals or into a full line.  Returns the new gap cells.
 */
export function regrowLines(wall: Wall, lines: readonly number[], size: () => number, rng: () => number): number[] {
  const cleared = new Set(lines.flatMap(lineCells));
  for (const i of cleared) wall.cells[i] = rockCell();
  const keep = new Set(wall.fullLines().filter(l => !lines.includes(l)).flatMap(lineCells));
  const gaps: number[] = [];
  const order = [...lines];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rand(rng, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const l of order) {
    const own = new Set(lineCells(l));
    const inLine = () => lineCells(l).reduce((s, i) => s + (wall.cells[i].k === EMPTY ? 1 : 0), 0);
    const starts = [...own].filter(i => wall.cells[i].k === ROCK && !keep.has(i));
    if (!starts.length) continue;
    // a line already opened by a crossing line's gap needs fewer new cells
    const k = Math.max(1, size() - inLine());
    gaps.push(...carve(wall, starts[rand(rng, starts.length)], k, rng, i => (own.has(i) ? 3 : inLine() >= 2 ? 2 : 0), i => !keep.has(i)));
  }
  return gaps;
}

// ── where crystals go ──────────────────────────────────────────

/** The cell a tap or a key cursor holds the crystal by: the one nearest the middle of its box. */
export function grabCell(cells: readonly Pt[]): Pt {
  let w = 0, hh = 0;
  for (const [x, y] of cells) { w = Math.max(w, x); hh = Math.max(hh, y); }
  let best = cells[0], d = Infinity;
  for (const p of cells) {
    const dd = (p[0] - w / 2) ** 2 + (p[1] - hh / 2) ** 2;
    if (dd < d - 1e-9) { d = dd; best = p; }
  }
  return best;
}

/**
 * The tap rule: an anchor that covers the tapped cell, held by the crystal's middle cell if
 * possible; otherwise the nearest fitting anchor within one cell.  Null when nothing fits.
 */
export function tapSpot(wall: Wall, cells: readonly Pt[], cx: number, cy: number): Pt | null {
  const g = grabCell(cells);
  const a0: Pt = [cx - g[0], cy - g[1]];
  let best: Pt | null = null, score = Infinity;
  const consider = (ax: number, ay: number, base: number) => {
    if (!wall.fits(cells, ax, ay)) return;
    const s = base + (ax - a0[0]) ** 2 + (ay - a0[1]) ** 2;
    if (s < score) { score = s; best = [ax, ay]; }
  };
  for (const [x, y] of cells) consider(cx - x, cy - y, 0);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) consider(a0[0] + dx, a0[1] + dy, 10);
  return best;
}

/** How good a spot is: completing lines first, then filling lines that are nearly full. */
export function spotScore(wall: Wall, cells: readonly Pt[], ax: number, ay: number): number {
  const per = new Map<number, number>();
  for (const [x, y] of cells) {
    per.set(ay + y, (per.get(ay + y) ?? 0) + 1);
    per.set(N + ax + x, (per.get(N + ax + x) ?? 0) + 1);
  }
  let s = 0;
  for (const [line, k] of per) {
    const after = wall.filled(line) + k;
    s += after === N ? 100 : k * (after / N) ** 3 * 20;
  }
  return s;
}

/** The best fitting spot for these cells (ties: higher up, then further left); null when none fits. */
export function bestSpot(wall: Wall, cells: readonly Pt[]): Pt | null {
  let best: Pt | null = null, score = -Infinity;
  for (let ay = 0; ay < N; ay++) {
    for (let ax = 0; ax < N; ax++) {
      if (!wall.fits(cells, ax, ay)) continue;
      const s = spotScore(wall, cells, ax, ay);
      if (s > score + 1e-9) { score = s; best = [ax, ay]; }
    }
  }
  return best;
}
