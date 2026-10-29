/**
 * Źródła's puzzle, pure (no DOM; randomness only from a seed), so every rule is unit-tested.
 *
 * A valley is a grid of square cells.  A stone carries a carved channel, described by its open
 * sides ("ports", a 4-bit mask N=1, E=2, S=4, W=8); a tap turns it a quarter clockwise.  The shapes
 * are end (a round basin), straight, bend and tee; a four-way rosette is fixed by nature, and a
 * pre-set stone (every spring's mouth stone among them) never turns.  Rock has no channel, and a
 * field is a sink that drinks from every side a neighbour opens into it.  Edge springs pour into
 * their mouth stones from the rock border; wells are sources inside the valley that turn like stones.
 *
 * The water's way is a breadth-first search from every source over channels joined port to port.
 * The sources it links form a component; its outlets are the fields it reaches and its leaks (a port
 * of a reached cell facing the edge, rock or a neighbour without a matching port).  A valley is
 * closed when every field is reached and nothing leaks; dry, unconnected stones do not matter.
 *
 * `generate(recipe, seed)` builds a valley deterministically: springs on the border, wells and rock,
 * a random spanning forest from the sources (straight-biased, branching by the recipe's bias), fields
 * on its leaves spread far apart, a meeting pool where two sources share a field, pre-set anchors,
 * then a scramble that leaves most stones off and the valley open.  `lessonValley()` is the hand-made
 * first valley.  The smoke test's click lands on `smokeCell()` (layout.ts), which every valley keeps
 * a turnable stone.
 */
import { mulberry32 } from '../../core/random';
import { SIZES, type Recipe } from './content';

export const ROCK = 0, STONE = 1, FIELD = 2, WELL = 3, FOUR = 4;

/** Sides by index 0..3 (N, E, S, W, clockwise): their bit in a port mask and their step on the grid. */
export const BIT = [1, 2, 4, 8] as const;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opp = (d: number): number => (d + 2) & 3;

/** A port mask turned `k` quarter turns clockwise (N → E → S → W → N). */
export function rotMask(m: number, k: number): number {
  const q = ((k % 4) + 4) % 4;
  return q === 0 ? m & 15 : ((m << q) | (m >> (4 - q))) & 15;
}

export const popcount = (m: number): number => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

export type Shape = 'end' | 'straight' | 'bend' | 'tee' | 'four';
/** Each shape at rotation 0. */
export const BASE: Readonly<Record<Shape, number>> = { end: 1, straight: 5, bend: 3, tee: 7, four: 15 };

export function shapeOf(m: number): Shape | null {
  switch (popcount(m)) {
    case 1: return 'end';
    case 2: return m === 5 || m === 10 ? 'straight' : 'bend';
    case 3: return 'tee';
    case 4: return 'four';
    default: return null;
  }
}

/** Distinct rotations a shape has: a straight repeats after two quarter turns, a rosette never changes. */
export const period = (s: Shape): number => (s === 'four' ? 1 : s === 'straight' ? 2 : 4);

/** The rotation that turns `shape`'s base into `mask`. */
export function rotTo(shape: Shape, mask: number): number {
  for (let k = 0; k < 4; k++) if (rotMask(BASE[shape], k) === mask) return k;
  return 0;
}

/** A source: an edge spring pouring into its mouth stone from side `side`, or a well (side −1) at its cell. */
export interface Source { readonly kind: 'spring' | 'well'; readonly cell: number; readonly side: number }

/**
 * The cell under the smoke test's click (the canvas at 50 % × 60 %): the board's centre column and
 * the row just below its middle, at 390×844, 844×390 and 1280×800 alike (layout.ts places the board
 * so; the tests check it).
 */
export function smokeCell(cols: number, rows: number): number {
  return (Math.floor(rows / 2) + (rows % 2)) * cols + Math.floor(cols / 2);
}

/** A stable 32-bit mix of a few integers (the road's seeds, a generator's retries). */
export function mix(...xs: number[]): number {
  let h = 0x811c9dc5;
  for (const x of xs) {
    h = Math.imul(h ^ (x >>> 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

// ── the water's way ──────────────────────────────────────────────
/** What the search found: who is reached, from where, and every port that leads out of the channels. */
export class Flow {
  /** per cell: its component (−1: dry), the cell its water comes from (−1: a source's own cell), steps from the source */
  readonly comp: Int16Array;
  readonly from: Int16Array;
  readonly dist: Int16Array;
  /** reached cells in search order */
  readonly order: Int16Array;
  count = 0;
  /** per source its component; per component how many sources pour into it */
  readonly sourceComp: Int16Array;
  readonly compSources: Uint8Array;
  nComps = 0;
  /** the outlets: a reached cell's port into a field (`outField` ≥ 0) or a leak (−1) */
  readonly outCell: Int16Array;
  readonly outDir: Uint8Array;
  readonly outComp: Int16Array;
  readonly outField: Int8Array;
  nOut = 0;
  /** per field: reached at all, and by how many sources (all the components that open into it) */
  readonly fieldReached: Uint8Array;
  readonly fieldSources: Uint8Array;
  private readonly fieldComps: Uint32Array;
  reachedFields = 0;
  leaks = 0;

  constructor(n: number, sources: number, fields: number) {
    this.comp = new Int16Array(n);
    this.from = new Int16Array(n);
    this.dist = new Int16Array(n);
    this.order = new Int16Array(n);
    this.sourceComp = new Int16Array(Math.max(1, sources));
    this.compSources = new Uint8Array(Math.max(1, sources));
    this.outCell = new Int16Array(n * 4);
    this.outDir = new Uint8Array(n * 4);
    this.outComp = new Int16Array(n * 4);
    this.outField = new Int8Array(n * 4);
    this.fieldReached = new Uint8Array(Math.max(1, fields));
    this.fieldSources = new Uint8Array(Math.max(1, fields));
    this.fieldComps = new Uint32Array(Math.max(1, fields));
  }

  /** Whether the valley is closed: every field reached and no leak. */
  get closed(): boolean { return this.reachedFields === this.fieldReached.length && this.leaks === 0; }

  /** Count each component into each field it opens into once (the search calls it when done). */
  tally(fields: number): void {
    this.fieldComps.fill(0);
    this.fieldReached.fill(0);
    this.fieldSources.fill(0);
    this.leaks = 0;
    for (let k = 0; k < this.nOut; k++) {
      const f = this.outField[k];
      if (f < 0) this.leaks++;
      else this.fieldComps[f] |= 1 << this.outComp[k];
    }
    this.reachedFields = 0;
    for (let f = 0; f < fields; f++) {
      const m = this.fieldComps[f];
      if (!m) continue;
      this.fieldReached[f] = 1;
      this.reachedFields++;
      let s = 0;
      for (let c = 0; c < this.nComps; c++) if (m & (1 << c)) s += this.compSources[c];
      this.fieldSources[f] = s;
    }
  }
}

/** One valley: the grid, its sources and fields, the stones' rotations now and solved. */
export class Valley {
  readonly n: number;
  readonly kind: Uint8Array;
  readonly shape: readonly (Shape | null)[];
  readonly base: Uint8Array;
  readonly solved: Uint8Array;
  readonly rot: Uint8Array;
  /** pre-set (the mouth stones too) or a rosette: never turns */
  readonly fixed: Uint8Array;
  /** per cell: the side a spring pours in from (−1: not a mouth) */
  readonly inlet: Int8Array;
  readonly fields: readonly number[];
  /** per cell: its field number (−1: not a field) */
  readonly fieldNo: Int8Array;
  /** per cell: its source number (−1: none; a spring's is its mouth cell) */
  readonly sourceAt: Int8Array;
  readonly flow: Flow;
  private readonly probe: Flow;
  private readonly queue: Int16Array;

  /** `masks`: each cell's ports when solved; `rot`: the rotations as they lie (default: solved); `fieldOrder`: the fields' numbering (default: row-major). */
  constructor(readonly cols: number, readonly rows: number, kind: ArrayLike<number>, masks: ArrayLike<number>, fixed: ArrayLike<number>,
    readonly sources: readonly Source[], rot?: ArrayLike<number>, fieldOrder?: readonly number[]) {
    const n = (this.n = cols * rows);
    this.kind = Uint8Array.from(kind);
    this.base = new Uint8Array(n);
    this.solved = new Uint8Array(n);
    this.rot = new Uint8Array(n);
    this.fixed = Uint8Array.from(fixed);
    this.inlet = new Int8Array(n).fill(-1);
    this.fieldNo = new Int8Array(n).fill(-1);
    this.sourceAt = new Int8Array(n).fill(-1);
    const shape: (Shape | null)[] = [];
    const fields: number[] = [];
    for (let i = 0; i < n; i++) {
      const k = this.kind[i];
      const s = k === STONE || k === WELL || k === FOUR ? shapeOf(masks[i]) : null;
      shape.push(s);
      if (k === FOUR) this.fixed[i] = 1;
      if (s) {
        this.base[i] = BASE[s];
        this.solved[i] = rotTo(s, masks[i]);
        this.rot[i] = rot && !this.fixed[i] ? rot[i] & 3 : this.solved[i];   // a fixed stone always lies solved
      }
      if (k === FIELD) fields.push(i);
    }
    this.shape = shape;
    this.fields = fieldOrder ?? fields;
    this.fields.forEach((cell, f) => { this.fieldNo[cell] = f; });
    sources.forEach((s, j) => {
      this.sourceAt[s.cell] = j;
      if (s.kind === 'spring') this.inlet[s.cell] = s.side;
    });
    this.flow = new Flow(n, sources.length, fields.length);
    this.probe = new Flow(n, sources.length, fields.length);
    this.queue = new Int16Array(n);
    this.search(this.flow);
  }

  /** The cell `d` of cell `i` (−1: off the board). */
  neighbour(i: number, d: number): number {
    const x = (i % this.cols) + DX[d], y = Math.floor(i / this.cols) + DY[d];
    return x < 0 || y < 0 || x >= this.cols || y >= this.rows ? -1 : y * this.cols + x;
  }

  /** The open sides of cell `i` as it lies now. */
  ports(i: number): number {
    const k = this.kind[i];
    return k === STONE || k === WELL || k === FOUR ? rotMask(this.base[i], this.rot[i]) : 0;
  }

  solvedPorts(i: number): number { return this.shape[i] ? rotMask(this.base[i], this.solved[i]) : 0; }

  /** A stone (or well) the player may turn. */
  turnable(i: number): boolean {
    const k = this.kind[i];
    return (k === STONE || k === WELL) && !this.fixed[i] && period(this.shape[i] ?? 'four') > 1;
  }

  /** Not in its solved rotation (a straight counts modulo two). */
  off(i: number): boolean { return this.ports(i) !== this.solvedPorts(i); }

  /** Turn a stone a quarter (`dir` 1 clockwise, −1 counter-clockwise) and search the water's way again. */
  turn(i: number, dir: 1 | -1 = 1): boolean {
    if (!this.turnable(i)) return false;
    this.rot[i] = (this.rot[i] + (dir > 0 ? 1 : 3)) & 3;
    this.search(this.flow);
    return true;
  }

  /** Set every rotation (a resumed valley) and search again. */
  setRotations(rot: ArrayLike<number>): void {
    for (let i = 0; i < this.n; i++) if (this.turnable(i)) this.rot[i] = rot[i] & 3;
    this.search(this.flow);
  }

  get closed(): boolean { return this.flow.closed; }

  /** Turnable stones and how many of them are off. */
  counts(): { turnable: number; off: number } {
    let turnable = 0, off = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.turnable(i)) continue;
      turnable++;
      if (this.off(i)) off++;
    }
    return { turnable, off };
  }

  /** The breadth-first search over joined channels from every source, into `f`. */
  search(f: Flow): void {
    const q = this.queue;
    f.comp.fill(-1);
    f.from.fill(-2);
    f.dist.fill(0);
    f.sourceComp.fill(-1);
    f.compSources.fill(0);
    f.count = 0;
    f.nComps = 0;
    f.nOut = 0;
    for (let s = 0; s < this.sources.length; s++) {
      if (f.sourceComp[s] >= 0) continue;
      const start = this.sources[s].cell;
      if (f.comp[start] >= 0) {
        // another source's channels reached this one first: they pour together
        const c = f.comp[start];
        f.sourceComp[s] = c;
        f.compSources[c]++;
        continue;
      }
      const c = f.nComps++;
      f.sourceComp[s] = c;
      f.compSources[c] = 1;
      f.comp[start] = c;
      f.from[start] = -1;
      let head = 0, tail = 0;
      q[tail++] = start;
      while (head < tail) {
        const x = q[head++];
        f.order[f.count++] = x;
        const m = this.ports(x);
        for (let d = 0; d < 4; d++) {
          if (!(m & BIT[d])) continue;
          const nb = this.neighbour(x, d);
          if (nb < 0) {
            if (this.inlet[x] !== d) this.outlet(f, x, d, c, -1);   // the spring's own side is no leak
            continue;
          }
          const k = this.kind[nb];
          if (k === FIELD) {
            this.outlet(f, x, d, c, this.fieldNo[nb]);
          } else if (k === ROCK || !(this.ports(nb) & BIT[opp(d)])) {
            this.outlet(f, x, d, c, -1);
          } else if (f.comp[nb] < 0) {
            f.comp[nb] = c;
            f.from[nb] = x;
            f.dist[nb] = f.dist[x] + 1;
            q[tail++] = nb;
            const sj = this.sourceAt[nb];
            if (sj >= 0 && f.sourceComp[sj] < 0) {
              f.sourceComp[sj] = c;
              f.compSources[c]++;
            }
          }
        }
      }
    }
    f.tally(this.fields.length);
  }

  private outlet(f: Flow, cell: number, dir: number, comp: number, field: number): void {
    const k = f.nOut++;
    f.outCell[k] = cell;
    f.outDir[k] = dir;
    f.outComp[k] = comp;
    f.outField[k] = field;
  }

  /**
   * The water's edge: the turnable stone that a leak faces, taking the leak closest to a source
   * (ties in row-major order) — or, when it faces rock, the edge or a fixed stone, the leaking stone
   * itself.  Without leaks: the first stone (row-major) whose turn would reach an unreached field,
   * else the first stone that is off.  −1: nothing to do.
   */
  edge(): number {
    const f = this.flow;
    let best = -1, key = Infinity;
    for (let k = 0; k < f.nOut; k++) {
      if (f.outField[k] >= 0) continue;
      const c = f.outCell[k], d = f.outDir[k], nb = this.neighbour(c, d);
      const cand = nb >= 0 && this.turnable(nb) ? nb : this.turnable(c) ? c : -1;
      if (cand < 0) continue;
      const kk = f.dist[c] * 1e4 + c * 4 + d;
      if (kk < key) {
        key = kk;
        best = cand;
      }
    }
    if (best >= 0) return best;
    const reached = f.reachedFields;
    for (let i = 0; i < this.n; i++) {
      if (!this.turnable(i)) continue;
      const r0 = this.rot[i];
      let gain = false;
      for (let k = 1; k < period(this.shape[i]!) && !gain; k++) {
        this.rot[i] = (r0 + k) & 3;
        this.search(this.probe);
        gain = this.probe.reachedFields > reached;
      }
      this.rot[i] = r0;
      if (gain) return i;
    }
    for (let i = 0; i < this.n; i++) if (this.turnable(i) && this.off(i)) return i;
    return -1;
  }

  /** The rotations as they lie (for the saved open valley). */
  rotations(): number[] { return Array.from(this.rot); }
}

// ── the lesson ───────────────────────────────────────────────────
/**
 * The first-ever valley, 4×4, exactly as drawn in the design: spring A pours down into (0,3), spring
 * B east into (2,0); water stands in fields 1 and 3 from the first second, and three stones — (1,1),
 * (2,2) and (3,1) — each need one clockwise tap, in any order, to close it.
 */
export function lessonValley(): Valley {
  const S = STONE, F = FIELD, R = ROCK;
  // solved: ═ 10, ║ 5, ╔ 6, ╗ 12, ╚ 3, ╣ 13, ╩ 11, an end opening west 8
  const kind = [R, R, R, S, S, S, S, F, S, S, S, S, F, S, S, F];
  const mask = [0, 0, 0, 5, 6, 10, 12, 0, 13, 6, 11, 8, 0, 3, 10, 0];
  const fixed = [0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0];
  // as they lie: ║ at (1,1), ╣ at (2,2), ╝ at (3,1), each one clockwise tap from solved (straight 1 → 0, tee 3 → 2, bend 0 → 3);
  // the fixed stones lie solved whatever is given for them
  const rot = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 3, 0, 0];
  // field 1 is (1,3), field 2 (3,3), field 3 (3,0)
  return new Valley(4, 4, kind, mask, fixed, [{ kind: 'spring', cell: 3, side: 0 }, { kind: 'spring', cell: 8, side: 3 }], rot, [7, 15, 12]);
}

/** The lesson's stones that need a tap, and where its keyboard cursor starts. */
export const LESSON_OFF = [5, 10, 13] as const;
export const LESSON_CURSOR = 5;

// ── the generator ────────────────────────────────────────────────
/** A recipe moved by the player's skill offset (−1..+2): bigger and branchier with skill, gentler without. */
export function withSkill(r: Recipe, skill: number): Recipe {
  if (!skill || r.presetShare !== undefined) return r;
  const out = { ...r };
  const si = Math.max(0, SIZES.findIndex(([c, rr]) => c === r.cols && rr === r.rows));
  const step = (k: number) => {
    const [cols, rows] = SIZES[Math.max(0, Math.min(SIZES.length - 1, si + k))];
    out.cols = cols;
    out.rows = rows;
  };
  if (skill >= 1) {
    out.preset = Math.max(0, r.preset - 1);
    out.tee = Math.min(0.9, r.tee + 0.1);
    step(1);
    if (skill >= 2) {
      out.fields = Math.min(5, r.fields + 1);
      out.fourMax = r.fourMax + 1;
    }
  } else if (skill <= -1) {
    out.preset = r.preset + 2;
    out.tee = Math.max(0.1, r.tee - 0.1);
    step(-1);
  }
  return out;
}

/** The share of turnable stones a fresh valley must start off. */
export const MIN_OFF = 0.6;
const RETRIES = 20;

/**
 * A valley for `recipe`, the same for the same seed: up to 20 tries with sub-seeds, then the same
 * with the meeting pool and the rosettes relaxed.  Never fails: the last resort is the lesson.
 */
export function generate(recipe: Recipe, seed: number): Valley {
  const relaxed: Recipe[] = [recipe, { ...recipe, meeting: false }, { ...recipe, meeting: false, fourMax: 0, rocks: Math.min(recipe.rocks, 1) }];
  for (let r = 0; r < relaxed.length; r++) {
    for (let a = 0; a < RETRIES; a++) {
      const v = attempt(relaxed[r], mulberry32(mix(seed, a, r, 0xa11ce)));
      if (v) return v;
    }
  }
  return lessonValley();
}

const shuffle = <T>(a: T[], rnd: () => number): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function attempt(r: Recipe, rnd: () => number): Valley | null {
  const { cols, rows } = r, n = cols * rows;
  const xy = (i: number) => [i % cols, Math.floor(i / cols)] as const;
  const manhattan = (a: number, b: number) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.abs(ax - bx) + Math.abs(ay - by); };
  const border = (i: number) => { const [x, y] = xy(i); return x === 0 || y === 0 || x === cols - 1 || y === rows - 1; };
  const nb = (i: number, d: number) => {
    const [x, y] = xy(i), X = x + DX[d], Y = y + DY[d];
    return X < 0 || Y < 0 || X >= cols || Y >= rows ? -1 : Y * cols + X;
  };
  const smoke = smokeCell(cols, rows);
  const kind = new Uint8Array(n).fill(STONE);
  const sources: Source[] = [];

  // 1. springs on non-corner border cells, at least 2 apart (3 if they can); wells inside, clear of the mouths
  const edges: { cell: number; side: number }[] = [];
  for (let x = 1; x < cols - 1; x++) edges.push({ cell: x, side: 0 }, { cell: (rows - 1) * cols + x, side: 2 });
  for (let y = 1; y < rows - 1; y++) edges.push({ cell: y * cols, side: 3 }, { cell: y * cols + cols - 1, side: 1 });
  shuffle(edges, rnd);
  for (const gap of [3, 2]) {
    for (const e of edges) {
      if (sources.length >= r.springs) break;
      if (e.cell === smoke || sources.some(s => manhattan(s.cell, e.cell) < gap)) continue;
      sources.push({ kind: 'spring', cell: e.cell, side: e.side });
    }
  }
  if (sources.length < r.springs) return null;
  const inner: number[] = [];
  for (let i = 0; i < n; i++) if (!border(i) && i !== smoke) inner.push(i);
  shuffle(inner, rnd);
  for (const i of inner) {
    if (sources.length >= r.springs + r.wells) break;
    if (sources.some(s => manhattan(s.cell, i) < 2)) continue;
    sources.push({ kind: 'well', cell: i, side: -1 });
  }
  if (sources.length < r.springs + r.wells) return null;
  const isSource = new Int8Array(n).fill(-1);
  sources.forEach((s, j) => {
    isSource[s.cell] = j;
    if (s.kind === 'well') kind[s.cell] = WELL;
  });

  // 2. rock on free cells, the free cells staying connected
  const free = (i: number) => kind[i] !== ROCK;
  const connected = () => {
    const seen = new Uint8Array(n);
    let start = -1, total = 0;
    for (let i = 0; i < n; i++) if (free(i)) { total++; if (start < 0) start = i; }
    const q = [start];
    seen[start] = 1;
    let got = 0;
    while (q.length) {
      const x = q.pop()!;
      got++;
      for (let d = 0; d < 4; d++) {
        const y = nb(x, d);
        if (y >= 0 && !seen[y] && free(y)) { seen[y] = 1; q.push(y); }
      }
    }
    return got === total;
  };
  const rockCands: number[] = [];
  for (let i = 0; i < n; i++) if (isSource[i] < 0 && i !== smoke) rockCands.push(i);
  shuffle(rockCands, rnd);
  let rocks = 0;
  for (const i of rockCands) {
    if (rocks >= r.rocks) break;
    // keep a mouth's way into the valley open
    if (sources.some(s => s.kind === 'spring' && nb(s.cell, opp(s.side)) === i)) continue;
    kind[i] = ROCK;
    if (connected()) rocks++;
    else kind[i] = STONE;
  }
  if (rocks < r.rocks) return null;

  // 3. a random spanning forest over the free cells, rooted at the sources
  const ports = new Uint8Array(n), deg = new Uint8Array(n), tree = new Int8Array(n).fill(-1), last = new Int8Array(n).fill(-1);
  let fours = 0, visited = 0, freeCount = 0;
  for (let i = 0; i < n; i++) if (free(i)) freeCount++;
  const grow: number[] = [];
  sources.forEach((s, j) => {
    tree[s.cell] = j;
    visited++;
    if (s.kind === 'spring') {
      ports[s.cell] |= BIT[s.side];
      deg[s.cell] = 1;
      last[s.cell] = opp(s.side);
    }
    grow.push(s.cell);
  });
  const open = (c: number): number[] => {
    const out: number[] = [];
    for (let d = 0; d < 4; d++) {
      const y = nb(c, d);
      if (y >= 0 && free(y) && tree[y] < 0) out.push(d);
    }
    return out;
  };
  const link = (c: number, d: number) => {
    const y = nb(c, d);
    ports[c] |= BIT[d];
    ports[y] |= BIT[opp(d)];
    deg[c]++;
    deg[y]++;
    if (deg[c] === 4) fours++;
    tree[y] = tree[c];
    last[y] = d;
    visited++;
    grow.push(y);
  };
  const pickDir = (c: number, cand: number[]) => (last[c] >= 0 && cand.includes(last[c]) && rnd() < 0.55 ? last[c] : cand[Math.floor(rnd() * cand.length)]);
  // every source takes its first channel before the forest grows at random
  for (const s of sources) {
    const cand = open(s.cell);
    if (!cand.length) return null;
    link(s.cell, pickDir(s.cell, cand));
  }
  let tries = 0;
  while (visited < freeCount) {
    if (!grow.length || ++tries > 20000) return null;
    const gi = Math.floor(rnd() * grow.length), c = grow[gi];
    const cand = open(c);
    const cap = kind[c] === WELL ? 3 : 4;
    if (!cand.length || deg[c] >= cap || (deg[c] === 3 && fours >= r.fourMax)) {
      grow.splice(gi, 1);
      continue;
    }
    if (c === smoke && deg[c] >= 3) {   // the smoke cell stays a turnable stone, never a rosette
      grow.splice(gi, 1);
      continue;
    }
    // a cell already carrying a channel through branches only now and then
    if (deg[c] >= 2 && rnd() >= r.tee) continue;
    link(c, pickDir(c, cand));
  }

  // 4. fields on the leaves, spread far apart along the trees; every source's tree gets one first
  const leaves: number[] = [];
  for (let i = 0; i < n; i++) if (free(i) && deg[i] === 1 && isSource[i] < 0 && i !== smoke) leaves.push(i);
  if (leaves.length < r.fields) return null;
  const treeDist = (from: number): Int16Array => {
    const dist = new Int16Array(n).fill(-1);
    const q = [from];
    dist[from] = 0;
    for (let h = 0; h < q.length; h++) {
      const x = q[h];
      for (let d = 0; d < 4; d++) {
        if (!(ports[x] & BIT[d])) continue;
        const y = nb(x, d);
        if (y >= 0 && dist[y] < 0) { dist[y] = dist[x] + 1; q.push(y); }
      }
    }
    return dist;
  };
  const fromLeaf = new Map(leaves.map(l => [l, treeDist(l)]));
  const chosen: number[] = [];
  for (let j = 0; j < sources.length && chosen.length < r.fields; j++) {
    const own = leaves.filter(l => tree[l] === j);
    if (!own.length) return null;
    const depth = treeDist(sources[j].cell);
    let best = own[0], bd = -1;
    for (const l of shuffle(own, rnd)) if (depth[l] > bd) { bd = depth[l]; best = l; }
    chosen.push(best);
  }
  while (chosen.length < r.fields) {
    let best = -1, bd = -1;
    for (const l of shuffle(leaves.slice(), rnd)) {
      if (chosen.includes(l)) continue;
      const dl = fromLeaf.get(l)!;
      let m = Infinity;
      for (const c of chosen) m = Math.min(m, dl[c] >= 0 ? dl[c] : 99 + manhattan(l, c));
      if (m > bd) { bd = m; best = l; }
    }
    if (best < 0) return null;
    chosen.push(best);
  }
  for (const f of chosen) kind[f] = FIELD;

  // 5. a meeting pool: a stone of another source's tree opens into one field too
  if (r.meeting && sources.length >= 2) {
    const pairs: [number, number][] = [];
    for (const f of chosen) {
      for (let d = 0; d < 4; d++) {
        const y = nb(f, d);
        if (y < 0 || kind[y] !== STONE || tree[y] === tree[f] || tree[y] < 0 || (y === smoke && deg[y] >= 3)) continue;
        if (ports[y] & BIT[opp(d)]) continue;
        if (deg[y] >= 4 || (deg[y] === 3 && fours >= r.fourMax)) continue;
        pairs.push([y, opp(d)]);
      }
    }
    if (!pairs.length) return null;
    const [y, d] = pairs[Math.floor(rnd() * pairs.length)];
    ports[y] |= BIT[d];
    deg[y]++;
    if (deg[y] === 4) fours++;
  }

  // 6. shapes: rosettes are fixed by nature; the mouths and a few anchors pre-set
  const fixed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (kind[i] === STONE && deg[i] === 4) kind[i] = FOUR;
    if (kind[i] === FOUR) fixed[i] = 1;
  }
  for (const s of sources) if (s.kind === 'spring') fixed[s.cell] = 1;
  const anchors: number[] = [];
  for (let i = 0; i < n; i++) if (kind[i] === STONE && !fixed[i] && i !== smoke) anchors.push(i);
  shuffle(anchors, rnd);
  const prefer = (i: number) => (border(i) ? 2 : 0) + (popcount(ports[i]) >= 2 && ports[i] !== 5 && ports[i] !== 10 ? 0 : 1);
  anchors.sort((a, b) => prefer(a) - prefer(b));
  let turnableCount = 0;
  for (let i = 0; i < n; i++) if ((kind[i] === STONE || kind[i] === WELL) && !fixed[i]) turnableCount++;
  const presets = r.presetShare !== undefined ? Math.round(turnableCount * r.presetShare) : r.preset;
  for (let k = 0; k < Math.min(presets, anchors.length); k++) fixed[anchors[k]] = 1;

  const v = new Valley(cols, rows, kind, ports, fixed, sources);
  if (!v.closed || v.fields.length !== r.fields || v.sources.length !== r.springs + r.wells) return null;

  // 7. scramble: most stones off, never closed at the start
  const turn: number[] = [];
  for (let i = 0; i < n; i++) if (v.turnable(i)) turn.push(i);
  for (const i of turn) if (rnd() < 0.8) v.rot[i] = (v.solved[i] + 1 + Math.floor(rnd() * 3)) & 3;
  const offCount = () => turn.reduce((s, i) => s + (v.off(i) ? 1 : 0), 0);
  const need = Math.ceil(turn.length * MIN_OFF);
  for (const i of shuffle(turn.slice(), rnd)) {
    if (offCount() >= need) break;
    if (!v.off(i)) v.rot[i] = (v.rot[i] + 1) & 3;
  }
  v.search(v.flow);
  for (let k = 0; k < turn.length && v.closed; k++) v.turn(turn[k], 1);
  // 8. valid: the solution closes it (checked above), it starts open, most stones start off
  if (v.closed || !turn.length || offCount() < need) return null;
  return v;
}

// ── the quality harness ──────────────────────────────────────────
export interface Quality {
  turnable: number;
  off: number;
  /** quarter turns to the intended solution */
  turns: number;
  ends: number;
  tees: number;
  fours: number;
  /** the longest way from a source to a field (cells) */
  longest: number;
  /** stones whose rotation the border, rock or a fixed neighbour leaves no choice in */
  forced: number;
}

/** What a valley asks of the player (the tests log it per recipe band, for tuning). */
export function quality(v: Valley): Quality {
  const q: Quality = { turnable: 0, off: 0, turns: 0, ends: 0, tees: 0, fours: 0, longest: 0, forced: 0 };
  const rot = v.rotations();
  for (let i = 0; i < v.n; i++) {
    const s = v.shape[i];
    if (s === 'end') q.ends++;
    else if (s === 'tee') q.tees++;
    else if (s === 'four') q.fours++;
    if (!v.turnable(i)) continue;
    q.turnable++;
    if (v.off(i)) q.off++;
    q.turns += (((v.solved[i] - v.rot[i]) % period(s!)) + period(s!)) % period(s!);
    let ways = 0;
    for (let k = 0; k < period(s!); k++) {
      const m = rotMask(v.base[i], k);
      let ok = true;
      for (let d = 0; d < 4 && ok; d++) {
        const y = v.neighbour(i, d), mine = (m & BIT[d]) !== 0;
        if (y < 0 || v.kind[y] === ROCK) ok = !mine;
        else if (v.fixed[y] && v.kind[y] !== FIELD) ok = mine === ((v.ports(y) & BIT[opp(d)]) !== 0);
      }
      if (ok) ways++;
    }
    if (ways === 1) q.forced++;
  }
  // the solution's longest way to a field
  for (let i = 0; i < v.n; i++) if (v.turnable(i)) v.rot[i] = v.solved[i];
  v.search(v.flow);
  const f = v.flow;
  for (let k = 0; k < f.nOut; k++) if (f.outField[k] >= 0) q.longest = Math.max(q.longest, f.dist[f.outCell[k]] + 1);
  v.setRotations(rot);
  return q;
}
