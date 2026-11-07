/**
 * Arka's boards (pure, no DOM): the deck as a grid of cells, the animals on it, the way out of each,
 * the generator of the saga's boards and the solver that proves them.
 *
 * As in the arrows escape puzzles, an animal is a leader facing one way, alone or with a file of its
 * young behind it (a long piece that may bend).  Sent, the leader walks straight ahead and the file
 * follows its path; it leaves the deck only when every cell ahead of the leader to the edge is free.
 * Removing an animal never blocks another, so a board is solvable when there is an order in which
 * each animal's way is clear once the animals before it have gone.  The generator builds the board
 * backwards to guarantee one: each new animal gets a way out clear of every animal placed before it
 * (they leave after it), while later ones may stand in its way (they leave before it).
 *
 * Three special animals: a sleeper (the first tap wakes it), a turning goat (it turns a quarter
 * clockwise whenever another animal leaves), and a locked pen (it opens when the animal carrying its
 * key has left; the generator places the key's carrier later, so it leaves first).  Turning goats
 * break the backwards proof, so every board is also solved forward (with the game's own help when
 * nothing can move: the goats look round), and a goat that would trap the board stays an ordinary one.
 */
import { mulberry32 } from '../../core/random';
import { KINDS, levelSpec, type KindId, type LevelSpec } from './content';
import { DX, DY, type Dir } from './rules';

export interface Cell { x: number; y: number }

export interface PieceSpec {
  kind: KindId;
  /** cells[0] is the leader; the rest is its file, each cell next to the one before */
  cells: Cell[];
  dir: Dir;
  sleepy: boolean;
  turner: boolean;
  /** the index of the animal carrying this pen's key (-1: not locked) */
  lockedBy: number;
}

export interface BoardSpec { n: number; cols: number; rows: number; pieces: PieceSpec[] }

/** What lies ahead of a leader: the free cells to the edge (or to the blocker) and who blocks (-1: the way is clear). */
export interface Way { dist: number; blocker: number }

/**
 * The way out from `head` facing `dir` on a grid of piece indices (-1 empty): the number of free
 * cells before the first occupied one (or the edge), and that cell's piece.  `self` is skipped.
 */
export function wayOut(grid: ArrayLike<number>, cols: number, rows: number, head: Cell, dir: Dir, self = -1): Way {
  let x = head.x + DX[dir], y = head.y + DY[dir], dist = 0;
  while (x >= 0 && y >= 0 && x < cols && y < rows) {
    const id = grid[y * cols + x];
    if (id >= 0 && id !== self) return { dist, blocker: id };
    dist++;
    x += DX[dir];
    y += DY[dir];
  }
  return { dist, blocker: -1 };
}

/** The cells a leader walks over on its way off the deck (to the edge), in order. */
export function rayCells(cols: number, rows: number, head: Cell, dir: Dir): Cell[] {
  const out: Cell[] = [];
  let x = head.x + DX[dir], y = head.y + DY[dir];
  while (x >= 0 && y >= 0 && x < cols && y < rows) {
    out.push({ x, y });
    x += DX[dir];
    y += DY[dir];
  }
  return out;
}

export function gridOf(b: BoardSpec, alive: (i: number) => boolean = () => true): Int16Array {
  const g = new Int16Array(b.cols * b.rows).fill(-1);
  b.pieces.forEach((p, i) => {
    if (!alive(i)) return;
    for (const c of p.cells) g[c.y * b.cols + c.x] = i;
  });
  return g;
}

// ── solving ──────────────────────────────────────────────────────
/**
 * Play the board forward the way a patient player would: send any animal whose way is clear and
 * whose pen is open (the lowest index first); when nothing can move, the turning goats look round (as
 * the game makes them).  Returns the order the animals left in, or null when the board traps itself.
 */
export function solve(b: BoardSpec): number[] | null {
  const n = b.pieces.length;
  const alive = new Array<boolean>(n).fill(true);
  const dirs = b.pieces.map(p => p.dir);
  const grid = gridOf(b);
  const order: number[] = [];
  let stuck = 0;
  const open = (i: number) => b.pieces[i].lockedBy < 0 || !alive[b.pieces[i].lockedBy];
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n && pick < 0; i++) {
      if (!alive[i] || !open(i)) continue;
      if (wayOut(grid, b.cols, b.rows, b.pieces[i].cells[0], dirs[i], i).blocker < 0) pick = i;
    }
    if (pick < 0) {
      const goats = b.pieces.some((p, i) => alive[i] && p.turner);
      if (!goats || ++stuck > 4) return null;
      b.pieces.forEach((p, i) => { if (alive[i] && p.turner) dirs[i] = ((dirs[i] + 1) % 4) as Dir; });
      continue;
    }
    stuck = 0;
    alive[pick] = false;
    for (const c of b.pieces[pick].cells) grid[c.y * b.cols + c.x] = -1;
    order.push(pick);
    b.pieces.forEach((p, i) => { if (alive[i] && p.turner) dirs[i] = ((dirs[i] + 1) % 4) as Dir; });
  }
  return order;
}

// ── generating ───────────────────────────────────────────────────
/** The tutorial's first board, by hand: two pairs on a 3×4 deck, one goat behind a sheep. */
export function firstBoard(): BoardSpec {
  const p = (kind: KindId, x: number, y: number, dir: Dir): PieceSpec => ({ kind, cells: [{ x, y }], dir, sleepy: false, turner: false, lockedBy: -1 });
  return {
    n: 1, cols: 3, rows: 4,
    pieces: [p('sheep', 1, 1, 0), p('goat', 1, 2, 0), p('goat', 2, 3, 2), p('sheep', 0, 2, 3)],
  };
}

/**
 * The saga's board for level `n`, the same for everyone (seeded by the level, and by `salt` for a
 * fresh board on a retry of the same level).  Level 1 is the tutorial's own board.
 */
export function boardFor(n: number, salt = 0): BoardSpec {
  if (n <= 1 && salt === 0) return firstBoard();
  return generate(levelSpec(n), (Math.imul(n, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0);
}

export function generate(spec: LevelSpec, seed: number): BoardSpec {
  // a few seeds in turn: the first board that reaches the size and solves wins, else the fullest one
  let best: BoardSpec | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const rnd = mulberry32((seed + attempt * 7919) >>> 0);
    const b = build(spec, rnd);
    if (!solve(cloneBoard(b))) continue;
    if (b.pieces.length >= spec.animals) return b;
    if (!best || b.pieces.length > best.pieces.length) best = b;
  }
  return best ?? build({ ...spec, turners: 0, locks: 0 }, mulberry32(seed));
}

export function cloneBoard(b: BoardSpec): BoardSpec {
  return { ...b, pieces: b.pieces.map(p => ({ ...p, cells: p.cells.map(c => ({ ...c })) })) };
}

function build(spec: LevelSpec, rnd: () => number): BoardSpec {
  const { cols, rows } = spec;
  const grid = new Int16Array(cols * rows).fill(-1);
  const pieces: PieceSpec[] = [];
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && grid[y * cols + x] < 0;
  const tries = cols * rows * 30;
  // the cells in front of the animals placed so far: an animal put there stands in their way (the puzzle)
  const inFront = (): number[] => {
    const out: number[] = [];
    for (const p of pieces) for (const c of rayCells(cols, rows, p.cells[0], p.dir)) if (grid[c.y * cols + c.x] < 0) out.push(c.y * cols + c.x);
    return out;
  };
  let front: number[] = [];
  for (let k = 0; k < tries && pieces.length < spec.animals; k++) {
    if (k % 8 === 0) front = inFront();
    let x = Math.floor(rnd() * cols), y = Math.floor(rnd() * rows);
    if (front.length && rnd() < 0.75) {
      const at = front[Math.floor(rnd() * front.length)];
      x = at % cols;
      y = Math.floor(at / cols);
    }
    if (!free(x, y)) continue;
    const dir = Math.floor(rnd() * 4) as Dir;
    // its way out must be clear of everyone placed before it (they leave after it)
    if (wayOut(grid, cols, rows, { x, y }, dir).blocker >= 0) continue;
    const ray = new Set(rayCells(cols, rows, { x, y }, dir).map(c => c.y * cols + c.x));
    const cells: Cell[] = [{ x, y }];
    const want = rnd() < spec.files ? 2 + Math.floor(rnd() * (spec.maxLen - 1)) : 1;
    // the file grows behind the leader: the first young straight behind, then it may bend
    let heading = ((dir + 2) % 4) as Dir;
    while (cells.length < want) {
      const last = cells[cells.length - 1];
      const turns: Dir[] = cells.length === 1 ? [heading] : rnd() < 0.6
        ? [heading, ((heading + 1) % 4) as Dir, ((heading + 3) % 4) as Dir]
        : rnd() < 0.5 ? [((heading + 1) % 4) as Dir, heading, ((heading + 3) % 4) as Dir] : [((heading + 3) % 4) as Dir, heading, ((heading + 1) % 4) as Dir];
      let placed = false;
      for (const d of turns) {
        const nx = last.x + DX[d], ny = last.y + DY[d];
        if (!free(nx, ny) || ray.has(ny * cols + nx) || cells.some(c => c.x === nx && c.y === ny)) continue;
        cells.push({ x: nx, y: ny });
        heading = d;
        placed = true;
        break;
      }
      if (!placed) break;
    }
    const i = pieces.length;
    for (const c of cells) grid[c.y * cols + c.x] = i;
    pieces.push({ kind: 'sheep', cells, dir, sleepy: false, turner: false, lockedBy: -1 });
    front = inFront();
  }
  if (pieces.length % 2) {
    // the last one placed leaves first: taking it away never breaks the others' proof
    pieces.pop();
  }
  const b: BoardSpec = { n: spec.n, cols, rows, pieces };
  assignKinds(b, spec, rnd);
  addSpecials(b, spec, rnd);
  return b;
}

/** Two of a kind for every pair, the kinds spread over the board (a pair's two rarely stand together). */
function assignKinds(b: BoardSpec, spec: LevelSpec, rnd: () => number): void {
  const n = b.pieces.length;
  const idx = shuffle(Array.from({ length: n }, (_, i) => i), rnd);
  const kinds = KINDS.slice(0, Math.max(1, spec.kinds));
  const offset = Math.floor(rnd() * kinds.length);
  for (let p = 0; p < n / 2; p++) {
    const kind = kinds[(p + offset) % kinds.length];
    b.pieces[idx[2 * p]].kind = kind;
    b.pieces[idx[2 * p + 1]].kind = kind;
  }
}

function addSpecials(b: BoardSpec, spec: LevelSpec, rnd: () => number): void {
  const n = b.pieces.length;
  if (n < 4) return;
  // locked pens: the pen early in the build (it leaves late), the key's carrier later (it leaves first)
  for (let k = 0; k < spec.locks; k++) {
    const pen = Math.floor(rnd() * Math.floor(n / 2));
    const p = b.pieces[pen];
    if (p.lockedBy >= 0 || b.pieces.some(q => q.lockedBy === pen)) continue;
    const from = pen + 1 + Math.floor(rnd() * (n - pen - 1));
    if (from >= n || b.pieces[from].lockedBy >= 0) continue;
    p.lockedBy = from;
  }
  for (let k = 0; k < spec.sleepy; k++) {
    const i = Math.floor(rnd() * n);
    if (b.pieces[i].lockedBy < 0) b.pieces[i].sleepy = true;
  }
  // turning goats: single animals only, and only where the board still solves with them
  for (let k = 0; k < spec.turners; k++) {
    const singles = b.pieces.map((p, i) => (p.cells.length === 1 && !p.turner && !p.sleepy && p.lockedBy < 0 ? i : -1)).filter(i => i >= 0);
    if (!singles.length) break;
    const i = singles[Math.floor(rnd() * singles.length)];
    b.pieces[i].turner = true;
    if (!solve(cloneBoard(b))) b.pieces[i].turner = false;
  }
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
