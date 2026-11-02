/**
 * Firmament's match-3 engine, pure (no DOM, no clock): an 8×8 sky of bodies in six kinds, matches
 * in lines and in L/T shapes, the specials they make (Kometa, Supernowa, Pulsar) and every combo of
 * two specials swapped together, the stardust on cells, the asteroids that block them, the
 * satellites that come down to the bottom row, gravity and refill, cascades, a generator that never
 * starts with a match and always leaves a move, and a reshuffle when no move is left.
 *
 * Everything random comes from the board's own seeded stream, so a level's seed and the same moves
 * give the same sky for everyone.  A move resolves at once into a list of steps (what was cleared,
 * what blasted, what was born, what fell where); the picture plays the steps back on the same clock
 * (rules.ts), so the rules never wait for the picture.
 *
 * Cells are numbered row by row from the top left: i = r × cols + c.
 */
import { mulberry32 } from '../../core/random';
import { RULES } from './rules';

export type Sp = 'none' | 'row' | 'col' | 'nova' | 'pulsar' | 'sat';
export type ToolKind = 'comet' | 'ray' | 'swap' | 'nova' | 'pulsar';

/** A body (kind 0..5), a special made of one, a pulsar (kind −1) or a satellite (kind −2). */
export interface Piece { id: number; kind: number; sp: Sp; armed: boolean }

export const PULSAR = -1;
export const SAT = -2;

export type BlastKind = 'row' | 'col' | 'nova' | 'cross' | 'big' | 'nova5' | 'kind' | 'all' | 'ray';
export interface Blast { kind: BlastKind; at: number; cells: number[]; of?: number }

export interface Cleared { id: number; at: number; kind: number; sp: Sp }
export interface Step {
  /** 1-based: the first step of a move is 1, its cascades count up */
  cascade: number;
  cleared: Cleared[];
  blasts: Blast[];
  /** specials born where a match made one, pieces changed in place (a nova armed, a body made special) */
  born: { id: number; at: number; kind: number; sp: Sp }[];
  changed: { id: number; at: number; sp: Sp; armed: boolean }[];
  rocks: { at: number; hp: number }[];
  dust: { at: number; layers: number }[];
  sats: { id: number; at: number }[];
  moves: { id: number; from: number; to: number }[];
  spawns: { id: number; kind: number; sp: Sp; to: number; fromRow: number }[];
  points: number;
  /** how long the picture takes to play this step (s) */
  dur: number;
}

/** What a move did, in sum (the level's goals and the session's numbers read it). */
export interface Tally {
  points: number;
  /** bodies cleared per kind */
  kinds: number[];
  dust: number;
  rocks: number;
  sats: number;
  made: { row: number; col: number; nova: number; pulsar: number };
  cascades: number;
  combo: string | null;
}

export interface Resolution {
  ok: boolean;
  steps: Step[];
  tally: Tally;
  /** the swap (bounced back when not ok), and the reshuffle after the move when no move was left */
  swap: [number, number] | null;
  shuffle: { id: number; to: number }[] | null;
  /** total time the picture needs (s) */
  dur: number;
}

export interface Move { a: number; b: number; value: number }

export interface BoardSpec {
  rows?: number;
  cols?: number;
  kinds: number;
  /** playable cells (false: a hole in the sky) */
  mask?: boolean[];
  /** asteroid hits per cell (0: none) */
  rocks?: number[];
  /** stardust layers per cell */
  dust?: number[];
  /** satellites to bring down, and how many at most on the board at once */
  sats?: number;
  satsAtOnce?: number;
  seed: number;
}

const freshTally = (kinds: number): Tally => ({
  points: 0, kinds: new Array<number>(kinds).fill(0), dust: 0, rocks: 0, sats: 0, made: { row: 0, col: 0, nova: 0, pulsar: 0 }, cascades: 0, combo: null,
});

const isSpecial = (p: Piece | null): boolean => !!p && (p.sp === 'row' || p.sp === 'col' || p.sp === 'nova' || p.sp === 'pulsar');
const matchable = (p: Piece | null): p is Piece => !!p && p.kind >= 0;

interface Pending {
  /** cells taken without activating (the two specials of a combo) */
  consume: number[];
  /** bodies turned into a special before the blasts (a pulsar's combo, an instrument's comet or nova) */
  convert: { at: number; sp: Sp }[];
  /** cells to clear (and activate) */
  clear: number[];
  /** blasts fired at once */
  blasts: { kind: BlastKind; at: number; of?: number }[];
  /** asteroids broken outright (the ray) */
  breakRocks: number[];
  /** a swap's two cells: a match made by it puts its special where the moved body landed */
  swap: [number, number] | null;
  /** look for matches in this step too */
  match: boolean;
}

export class Board {
  readonly rows: number;
  readonly cols: number;
  readonly n: number;
  readonly kinds: number;
  readonly mask: boolean[];
  readonly cells: (Piece | null)[];
  readonly rock: number[];
  readonly dust: number[];
  satTotal: number;
  satSpawned = 0;
  satDown = 0;
  readonly satsAtOnce: number;
  private nextId = 1;
  private readonly rng: () => number;

  constructor(spec: BoardSpec) {
    this.rows = spec.rows ?? RULES.rows;
    this.cols = spec.cols ?? RULES.cols;
    this.n = this.rows * this.cols;
    this.kinds = Math.max(3, Math.min(RULES.kinds, spec.kinds));
    this.mask = spec.mask ? spec.mask.slice() : new Array<boolean>(this.n).fill(true);
    this.rock = spec.rocks ? spec.rocks.map((v, i) => (this.mask[i] ? v : 0)) : new Array<number>(this.n).fill(0);
    this.dust = spec.dust ? spec.dust.map((v, i) => (this.mask[i] && !this.rock[i] ? v : 0)) : new Array<number>(this.n).fill(0);
    this.cells = new Array<Piece | null>(this.n).fill(null);
    this.satTotal = spec.sats ?? 0;
    this.satsAtOnce = spec.satsAtOnce ?? 2;
    this.rng = mulberry32(spec.seed >>> 0);
    this.generate();
  }

  // ── geometry ────────────────────────────────────────────────────
  r(i: number): number { return Math.floor(i / this.cols); }
  c(i: number): number { return i % this.cols; }
  at(r: number, c: number): number { return r * this.cols + c; }
  inside(r: number, c: number): boolean { return r >= 0 && c >= 0 && r < this.rows && c < this.cols; }
  /** a cell that holds a piece: playable and no asteroid on it */
  free(i: number): boolean { return this.mask[i] && this.rock[i] <= 0; }
  adjacent(a: number, b: number): boolean {
    return (this.r(a) === this.r(b) && Math.abs(this.c(a) - this.c(b)) === 1) || (this.c(a) === this.c(b) && Math.abs(this.r(a) - this.r(b)) === 1);
  }
  private neighbours(i: number): number[] {
    const r = this.r(i), c = this.c(i), out: number[] = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) if (this.inside(r + dr, c + dc)) out.push(this.at(r + dr, c + dc));
    return out;
  }
  /** the lowest cell of a column that holds a piece: where a satellite lands */
  floorOf(c: number): number {
    for (let r = this.rows - 1; r >= 0; r--) if (this.free(this.at(r, c))) return this.at(r, c);
    return -1;
  }

  get rocksLeft(): number { return this.rock.reduce((s, v) => s + (v > 0 ? 1 : 0), 0); }
  get dustLeft(): number { return this.dust.reduce((s, v) => s + v, 0); }
  get satsOnBoard(): number { return this.cells.reduce((s, p) => s + (p?.sp === 'sat' ? 1 : 0), 0); }

  private piece(kind: number, sp: Sp = 'none'): Piece { return { id: this.nextId++, kind, sp, armed: false }; }
  private randKind(): number { return Math.floor(this.rng() * this.kinds) % this.kinds; }

  // ── the generator ───────────────────────────────────────────────
  /** Would a body of `kind` at `i` complete a line of three with what is already left of it or above it? */
  private makesLine(i: number, kind: number): boolean {
    const r = this.r(i), c = this.c(i);
    const k = (rr: number, cc: number) => (this.inside(rr, cc) ? this.cells[this.at(rr, cc)] : null);
    const same = (p: Piece | null) => matchable(p) && p.kind === kind && p.sp !== 'sat';
    if (same(k(r, c - 1)) && same(k(r, c - 2))) return true;
    if (same(k(r - 1, c)) && same(k(r - 2, c))) return true;
    return false;
  }

  /** A fresh sky: no match anywhere, at least one move; the first satellites in the top row. */
  private generate(): void {
    for (let tries = 0; tries < RULES.genTries; tries++) {
      for (let i = 0; i < this.n; i++) {
        this.cells[i] = null;
        if (!this.free(i)) continue;
        let kind = this.randKind();
        for (let k = 0; k < this.kinds && this.makesLine(i, kind); k++) kind = (kind + 1) % this.kinds;
        this.cells[i] = this.piece(kind);
      }
      if (this.findGroups(null).length === 0 && this.hasMove()) break;
    }
    // the first satellites start a quarter of the way down spread-out columns
    const first = Math.min(this.satTotal, this.satsAtOnce);
    const cols = this.shuffled(Array.from({ length: this.cols }, (_, c) => c));
    for (let k = 0, placed = 0; k < cols.length && placed < first; k++) {
      let top = -1;
      for (let r = Math.floor(this.rows / 4); r < this.rows; r++) if (this.free(this.at(r, cols[k]))) { top = this.at(r, cols[k]); break; }
      if (top < 0 || top === this.floorOf(cols[k])) continue;
      this.cells[top] = this.piece(SAT, 'sat');
      this.satSpawned++;
      placed++;
    }
  }

  private shuffled<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── matches ─────────────────────────────────────────────────────
  /**
   * Every match on the board: runs of three or more of a kind in a row or a column, runs that share
   * a cell joined into one group (an L, a T or a cross).  Each group says what it makes: five in a
   * line a pulsar, a row and a column together a supernova, four in a line a comet along the line.
   */
  findGroups(swap: [number, number] | null): { cells: number[]; kind: number; make: Sp; at: number }[] {
    interface Run { cells: number[]; dir: 'h' | 'v' }
    const runs: Run[] = [];
    const scan = (dir: 'h' | 'v') => {
      const outer = dir === 'h' ? this.rows : this.cols, inner = dir === 'h' ? this.cols : this.rows;
      for (let o = 0; o < outer; o++) {
        let run: number[] = [], kind = -99;
        const flush = () => { if (run.length >= 3) runs.push({ cells: run, dir }); };
        for (let k = 0; k < inner; k++) {
          const i = dir === 'h' ? this.at(o, k) : this.at(k, o);
          const p = this.cells[i];
          const pk = matchable(p) ? p.kind : -99;
          if (pk >= 0 && pk === kind) run.push(i);
          else {
            flush();
            run = pk >= 0 ? [i] : [];
            kind = pk;
          }
        }
        flush();
      }
    };
    scan('h');
    scan('v');
    if (!runs.length) return [];
    // join runs that share a cell
    const parent = runs.map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const owner = new Map<number, number>();
    runs.forEach((run, ri) => {
      for (const cell of run.cells) {
        const o = owner.get(cell);
        if (o === undefined) owner.set(cell, ri);
        else parent[find(ri)] = find(o);
      }
    });
    const byRoot = new Map<number, Run[]>();
    runs.forEach((run, ri) => {
      const root = find(ri);
      const list = byRoot.get(root) ?? [];
      list.push(run);
      byRoot.set(root, list);
    });
    const out: { cells: number[]; kind: number; make: Sp; at: number }[] = [];
    for (const list of byRoot.values()) {
      const cells = [...new Set(list.flatMap(r => r.cells))].sort((a, b) => a - b);
      const kind = this.cells[cells[0]]!.kind;
      const longest = list.reduce((m, r) => (r.cells.length > m.cells.length ? r : m), list[0]);
      const hv = list.some(r => r.dir === 'h') && list.some(r => r.dir === 'v');
      let make: Sp = 'none';
      if (longest.cells.length >= 5) make = 'pulsar';
      else if (hv) make = 'nova';
      else if (longest.cells.length === 4) make = longest.dir === 'h' ? 'row' : 'col';
      // where the special appears: where the moved body landed, else the corner of an L, else the line's middle
      let at = -1;
      if (swap) at = cells.includes(swap[1]) ? swap[1] : cells.includes(swap[0]) ? swap[0] : -1;
      if (at < 0 && hv) {
        const h = list.filter(r => r.dir === 'h').flatMap(r => r.cells), v = new Set(list.filter(r => r.dir === 'v').flatMap(r => r.cells));
        at = h.find(c => v.has(c)) ?? -1;
      }
      if (at < 0) at = longest.cells[Math.floor((longest.cells.length - 1) / 2)];
      out.push({ cells, kind, make, at });
    }
    return out;
  }

  /** The length of the longest line through `i` if it held a body of `kind` (for moves and hints). */
  private lineThrough(i: number, kind: number, skip: number): { h: number[]; v: number[] } {
    const r = this.r(i), c = this.c(i);
    const same = (rr: number, cc: number) => {
      if (!this.inside(rr, cc)) return false;
      const j = this.at(rr, cc);
      if (j === skip) return false;
      const p = this.cells[j];
      return matchable(p) && p.kind === kind;
    };
    const h = [i], v = [i];
    for (let k = c - 1; same(r, k); k--) h.push(this.at(r, k));
    for (let k = c + 1; same(r, k); k++) h.push(this.at(r, k));
    for (let k = r - 1; same(k, c); k--) v.push(this.at(k, c));
    for (let k = r + 1; same(k, c); k++) v.push(this.at(k, c));
    return { h, v };
  }

  /** May these two be swapped at all (neighbours holding pieces)? */
  swappable(a: number, b: number): boolean {
    return a >= 0 && b >= 0 && a < this.n && b < this.n && this.adjacent(a, b) && this.free(a) && this.free(b) && !!this.cells[a] && !!this.cells[b];
  }

  /** What swapping a and b would do: 0 = nothing (it bounces back), else a value for the hint. */
  swapValue(a: number, b: number): number {
    if (!this.swappable(a, b)) return 0;
    const pa = this.cells[a]!, pb = this.cells[b]!;
    if (pa.sp === 'pulsar' || pb.sp === 'pulsar') {
      const other = pa.sp === 'pulsar' ? pb : pa;
      if (other.sp === 'sat') return 0;
      return other.sp === 'pulsar' ? 100 : isSpecial(other) ? 60 : 30;
    }
    if (isSpecial(pa) && isSpecial(pb)) return 40;
    let value = 0;
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const p = this.cells[from]!;
      if (!matchable(p)) continue;
      const { h, v } = this.lineThrough(to, p.kind, from);
      const line = [...(h.length >= 3 ? h : []), ...(v.length >= 3 ? v.slice(1) : [])];
      if (!line.length) continue;
      value += line.length + (h.length >= 5 || v.length >= 5 ? 12 : h.length >= 3 && v.length >= 3 ? 8 : h.length === 4 || v.length === 4 ? 5 : 0);
      // the level's goals: dust under the line, asteroids beside it, satellites above it come down
      const rocks = new Set<number>();
      for (const i of line) {
        value += this.dust[i] * 3;
        for (const j of this.neighbours(i)) if (this.rock[j] > 0) rocks.add(j);
        for (let r = 0; r < this.r(i); r++) if (this.cells[this.at(r, this.c(i))]?.sp === 'sat') value += r === this.r(i) - 1 ? 12 : 3;
      }
      value += rocks.size * 3;
    }
    return value;
  }

  /** Every move that does something, best first (the hint takes the first; ties go to the lower, earlier cell). */
  findMoves(): Move[] {
    const out: Move[] = [];
    for (let i = 0; i < this.n; i++) {
      const r = this.r(i), c = this.c(i);
      for (const j of [c + 1 < this.cols ? this.at(r, c + 1) : -1, r + 1 < this.rows ? this.at(r + 1, c) : -1]) {
        if (j < 0) continue;
        const value = this.swapValue(i, j);
        if (value > 0) out.push({ a: i, b: j, value });
      }
    }
    return out.sort((x, y) => y.value - x.value || y.a - x.a);
  }

  hasMove(): boolean {
    for (let i = 0; i < this.n; i++) {
      const r = this.r(i), c = this.c(i);
      if (c + 1 < this.cols && this.swapValue(i, this.at(r, c + 1)) > 0) return true;
      if (r + 1 < this.rows && this.swapValue(i, this.at(r + 1, c)) > 0) return true;
    }
    return false;
  }

  // ── moves ───────────────────────────────────────────────────────
  /**
   * The player swaps a with b.  Two specials, or a pulsar with anything but a satellite, combine; a
   * swap that lines up three or more resolves; anything else bounces back for free (unless `free`:
   * the gravity instrument lets one swap stand without a match).
   */
  swap(a: number, b: number, free = false): Resolution {
    const none = (): Resolution => ({ ok: false, steps: [], tally: freshTally(this.kinds), swap: [a, b], shuffle: null, dur: RULES.bounceSec });
    if (!this.swappable(a, b)) return none();
    const pa = this.cells[a]!, pb = this.cells[b]!;
    const pending = (p: Partial<Pending>): Pending => ({ consume: [], convert: [], clear: [], blasts: [], breakRocks: [], swap: [a, b], match: false, ...p });
    // combos: the moved piece lands on b
    if ((pa.sp === 'pulsar' || pb.sp === 'pulsar') && pa.sp !== 'sat' && pb.sp !== 'sat') {
      this.cells[a] = pb;
      this.cells[b] = pa;
      const other = pa.sp === 'pulsar' ? pb : pa;
      if (other.sp === 'pulsar') return this.resolve(pending({ consume: [a, b], blasts: [{ kind: 'all', at: b }] }), 'pulsar+pulsar');
      const kind = other.kind;
      const pulsarAt = pa.sp === 'pulsar' ? b : a;
      if (isSpecial(other)) {
        const sp = other.sp;
        const convert: { at: number; sp: Sp }[] = [];
        for (let i = 0; i < this.n; i++) {
          const p = this.cells[i];
          if (i !== pulsarAt && matchable(p) && p.kind === kind) convert.push({ at: i, sp: sp === 'row' || sp === 'col' ? (this.rng() < 0.5 ? 'row' : 'col') : sp });
        }
        return this.resolve(pending({ consume: [pulsarAt], convert, clear: convert.map(c => c.at), blasts: [{ kind: 'kind', at: pulsarAt, of: kind }] }), `pulsar+${sp === 'nova' ? 'nova' : 'comet'}`);
      }
      return this.resolve(pending({ consume: [pulsarAt], blasts: [{ kind: 'kind', at: pulsarAt, of: kind }] }), 'pulsar');
    }
    if (isSpecial(pa) && isSpecial(pb)) {
      this.cells[a] = pb;
      this.cells[b] = pa;
      const comets = [pa, pb].filter(p => p.sp === 'row' || p.sp === 'col').length;
      const kind: BlastKind = comets === 2 ? 'cross' : comets === 1 ? 'big' : 'nova5';
      return this.resolve(pending({ consume: [a, b], blasts: [{ kind, at: b }] }), comets === 2 ? 'comet+comet' : comets === 1 ? 'comet+nova' : 'nova+nova');
    }
    this.cells[a] = pb;
    this.cells[b] = pa;
    if (this.findGroups(null).length === 0) {
      if (free) {
        const res = this.resolve(pending({ match: true }), null);
        res.ok = true;
        return res;
      }
      this.cells[a] = pa;
      this.cells[b] = pb;
      return none();
    }
    return this.resolve(pending({ match: true }), null);
  }

  /** An instrument used on a cell; null when it cannot be used there (the tray keeps it). */
  useTool(tool: Exclude<ToolKind, 'swap'>, at: number): Resolution | null {
    if (at < 0 || at >= this.n || !this.mask[at]) return null;
    const p = this.cells[at];
    const pending = (x: Partial<Pending>): Pending => ({ consume: [], convert: [], clear: [], blasts: [], breakRocks: [], swap: null, match: false, ...x });
    if (tool === 'ray') {
      if (this.rock[at] > 0) return this.resolve(pending({ breakRocks: [at], blasts: [{ kind: 'ray', at }] }), 'tool');
      if (!p || p.sp === 'sat') return null;
      return this.resolve(pending({ clear: [at], blasts: [{ kind: 'ray', at }] }), 'tool');
    }
    if (!p || p.sp === 'sat' || this.rock[at] > 0) return null;
    if (tool === 'pulsar') {
      const kind = matchable(p) ? p.kind : this.commonKind();
      return this.resolve(pending({ clear: p.sp === 'pulsar' ? [at] : [], blasts: [{ kind: 'kind', at, of: kind }] }), 'tool');
    }
    if (tool === 'nova') {
      if (p.sp === 'pulsar') return this.resolve(pending({ clear: [at] }), 'tool');
      return this.resolve(pending({ convert: [{ at, sp: 'nova' }], clear: [at] }), 'tool');
    }
    // the comet flies the way that clears more (asteroids and dust count double); a tie: the row
    const score = (cells: number[]) => cells.reduce((s, i) => s + (this.rock[i] > 0 ? 2 : 0) + this.dust[i] + (this.cells[i] ? 1 : 0), 0);
    const r = this.r(at), c = this.c(at);
    const row = Array.from({ length: this.cols }, (_, k) => this.at(r, k)), col = Array.from({ length: this.rows }, (_, k) => this.at(k, c));
    const sp: Sp = score(col) > score(row) ? 'col' : 'row';
    if (p.sp === 'pulsar') return this.resolve(pending({ clear: [at] }), 'tool');
    return this.resolve(pending({ convert: [{ at, sp }], clear: [at] }), 'tool');
  }

  /** A won level's moves left: that many bodies become comets and fire, one resolution. */
  celebrate(count: number): Resolution {
    const plain: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.cells[i]?.sp === 'none' && matchable(this.cells[i])) plain.push(i);
    const pick = this.shuffled(plain).slice(0, Math.max(0, count));
    const convert = pick.map(at => ({ at, sp: (this.rng() < 0.5 ? 'row' : 'col') as Sp }));
    return this.resolve({ consume: [], convert, clear: pick, blasts: [], breakRocks: [], swap: null, match: false }, 'bonus');
  }

  /** A falling star in the night: a plain body becomes a comet (a gift).  Returns the cell, or −1. */
  gift(): { at: number; sp: Sp; id: number } | null {
    const plain: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.cells[i]?.sp === 'none' && matchable(this.cells[i])) plain.push(i);
    if (!plain.length) return null;
    const at = plain[Math.floor(this.rng() * plain.length)];
    const p = this.cells[at]!;
    p.sp = this.rng() < 0.5 ? 'row' : 'col';
    return { at, sp: p.sp, id: p.id };
  }

  /** The kind of body most common on the board (a pulsar set off by a blast takes it). */
  private commonKind(): number {
    const count = new Array<number>(this.kinds).fill(0);
    for (const p of this.cells) if (matchable(p)) count[p.kind]++;
    let best = 0;
    for (let k = 1; k < this.kinds; k++) if (count[k] > count[best]) best = k;
    return best;
  }

  // ── resolving ───────────────────────────────────────────────────
  private resolve(first: Pending, combo: string | null): Resolution {
    const tally = freshTally(this.kinds);
    tally.combo = combo;
    const steps: Step[] = [];
    let pending: Pending | null = first;
    for (let cascade = 1; cascade <= 80; cascade++) {
      const groups = !pending || pending.match ? this.findGroups(pending?.swap ?? null) : [];
      const armed: number[] = [];
      for (let i = 0; i < this.n; i++) if (this.cells[i]?.armed) armed.push(i);
      const busy = pending && (pending.consume.length || pending.clear.length || pending.blasts.length || pending.breakRocks.length);
      if (!busy && !groups.length && !armed.length) break;
      steps.push(this.step(cascade, groups, pending, armed, tally));
      pending = null;
    }
    tally.cascades = steps.length;
    let shuffle: { id: number; to: number }[] | null = null;
    if (!this.hasMove()) shuffle = this.reshuffle();
    const dur = steps.reduce((s, st) => s + st.dur, 0) + (first.swap ? RULES.swapSec : 0) + (shuffle ? 0.5 : 0);
    return { ok: true, steps, tally, swap: first.swap, shuffle, dur };
  }

  private blastCells(kind: BlastKind, at: number, of?: number): number[] {
    const r = this.r(at), c = this.c(at), out: number[] = [];
    const box = (rad: number) => {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) if (this.inside(r + dr, c + dc)) out.push(this.at(r + dr, c + dc));
    };
    const row = (rr: number) => { if (rr >= 0 && rr < this.rows) for (let k = 0; k < this.cols; k++) out.push(this.at(rr, k)); };
    const col = (cc: number) => { if (cc >= 0 && cc < this.cols) for (let k = 0; k < this.rows; k++) out.push(this.at(k, cc)); };
    switch (kind) {
      case 'row': row(r); break;
      case 'col': col(c); break;
      case 'nova': box(1); break;
      case 'nova5': box(2); break;
      case 'cross': row(r); col(c); break;
      case 'big': for (let d = -1; d <= 1; d++) { row(r + d); col(c + d); } break;
      case 'kind': for (let i = 0; i < this.n; i++) { const p = this.cells[i]; if (matchable(p) && p.kind === of) out.push(i); } break;
      case 'all': for (let i = 0; i < this.n; i++) out.push(i); break;
      case 'ray': out.push(at); break;
    }
    return [...new Set(out)].filter(i => this.mask[i]);
  }

  private step(cascade: number, groups: ReturnType<Board['findGroups']>, pending: Pending | null, armed: number[], tally: Tally): Step {
    const R = RULES;
    const st: Step = { cascade, cleared: [], blasts: [], born: [], changed: [], rocks: [], dust: [], sats: [], moves: [], spawns: [], points: 0, dur: 0 };
    const clear = new Set<number>();
    const consumed = new Set<number>();
    const rockHit = new Set<number>();
    const rockBreak = new Set<number>();
    const births = new Map<number, { kind: number; sp: Sp }>();
    const activated = new Set<number>();
    const queue: number[] = [];
    const add = (i: number) => {
      if (!this.mask[i]) return;
      if (this.rock[i] > 0) { rockHit.add(i); return; }
      if (!clear.has(i) && this.cells[i]) { clear.add(i); queue.push(i); }
    };
    // the matches: their cells, the specials they make, the asteroids beside them
    for (const g of groups) {
      for (const i of g.cells) add(i);
      for (const i of g.cells) for (const j of this.neighbours(i)) if (this.rock[j] > 0) rockHit.add(j);
      if (g.make !== 'none') births.set(g.at, { kind: g.make === 'pulsar' ? PULSAR : g.kind, sp: g.make });
    }
    if (pending) {
      for (const i of pending.consume) { consumed.add(i); clear.add(i); }
      for (const cv of pending.convert) {
        const p = this.cells[cv.at];
        if (!p) continue;
        p.sp = cv.sp;
        st.changed.push({ id: p.id, at: cv.at, sp: cv.sp, armed: false });
      }
      for (const i of pending.breakRocks) rockBreak.add(i);
      for (const i of pending.clear) add(i);
      for (const b of pending.blasts) {
        const cells = this.blastCells(b.kind, b.at, b.of);
        st.blasts.push({ kind: b.kind, at: b.at, cells, of: b.of });
        for (const i of cells) if (!consumed.has(i)) add(i);
      }
    }
    for (const i of armed) add(i);
    // set off every special caught in the clear, and what their blasts catch in turn
    while (queue.length) {
      const i = queue.shift()!;
      const p = this.cells[i];
      if (!p || consumed.has(i) || activated.has(p.id) || !isSpecial(p)) continue;
      activated.add(p.id);
      let kind: BlastKind, of: number | undefined;
      if (p.sp === 'pulsar') {
        kind = 'kind';
        of = this.commonKind();
      } else kind = p.sp === 'nova' ? 'nova' : p.sp === 'row' ? 'row' : 'col';
      const cells = this.blastCells(kind, i, of);
      st.blasts.push({ kind, at: i, cells, of });
      for (const j of cells) add(j);
    }
    // clear: a nova set off the first time stays, armed, to blast again after the fall
    for (const i of clear) {
      const p = this.cells[i];
      if (!p || p.sp === 'sat') continue;
      if (p.sp === 'nova' && activated.has(p.id) && !p.armed && !consumed.has(i)) {
        p.armed = true;
        st.changed.push({ id: p.id, at: i, sp: 'nova', armed: true });
        continue;
      }
      this.cells[i] = null;
      st.cleared.push({ id: p.id, at: i, kind: p.kind, sp: p.sp });
      if (p.kind >= 0) {
        tally.kinds[p.kind]++;
        st.points += R.body * cascade;
      }
      if (this.dust[i] > 0) {
        this.dust[i]--;
        tally.dust++;
        st.points += R.dust;
        st.dust.push({ at: i, layers: this.dust[i] });
      }
    }
    // asteroids: a hit from a match beside them or a blast over them; the ray breaks one outright
    for (const i of new Set([...rockHit, ...rockBreak])) {
      if (this.rock[i] <= 0) continue;
      this.rock[i] = rockBreak.has(i) ? 0 : this.rock[i] - 1;
      st.points += R.rockHit;
      if (this.rock[i] === 0) {
        tally.rocks++;
        st.points += R.rockBreak;
      }
      st.rocks.push({ at: i, hp: this.rock[i] });
    }
    // the specials the matches made
    for (const [i, b] of births) {
      if (this.cells[i] || !this.free(i)) continue;
      const p = this.piece(b.kind, b.sp);
      this.cells[i] = p;
      st.born.push({ id: p.id, at: i, kind: b.kind, sp: b.sp });
      tally.made[b.sp as 'row' | 'col' | 'nova' | 'pulsar']++;
      st.points += R.make[b.sp as 'row' | 'col' | 'nova' | 'pulsar'];
    }
    // the fall, the refill, the satellites that reach the bottom
    const from = new Map<number, number>();
    const spawned = new Map<number, { kind: number; sp: Sp; fromRow: number }>();
    for (let guard = 0; guard < 10; guard++) {
      this.fall(from, spawned);
      let landed = false;
      for (let c = 0; c < this.cols; c++) {
        const f = this.floorOf(c);
        const p = f >= 0 ? this.cells[f] : null;
        if (p?.sp === 'sat') {
          this.cells[f] = null;
          this.satDown++;
          tally.sats++;
          st.points += R.sat;
          st.sats.push({ id: p.id, at: f });
          landed = true;
        }
      }
      if (!landed) break;
    }
    let longest = 0;
    for (let i = 0; i < this.n; i++) {
      const p = this.cells[i];
      if (!p) continue;
      const s = spawned.get(p.id);
      if (s) {
        st.spawns.push({ id: p.id, kind: p.kind, sp: p.sp, to: i, fromRow: s.fromRow });
        longest = Math.max(longest, this.r(i) - s.fromRow);
      } else {
        const f0 = from.get(p.id);
        if (f0 !== undefined && f0 !== i) {
          st.moves.push({ id: p.id, from: f0, to: i });
          longest = Math.max(longest, this.r(i) - this.r(f0));
        }
      }
    }
    tally.points += st.points;
    const fall = longest > 0 ? Math.max(R.fallMin, longest * R.fallCell + 0.06) : 0;
    st.dur = R.clearSec + (st.blasts.length ? R.blastSec : 0) + fall;
    return st;
  }

  /** Every column settles: pieces drop into the free cells below them, new ones come in from above. */
  private fall(from: Map<number, number>, spawned: Map<number, { kind: number; sp: Sp; fromRow: number }>): void {
    const fresh: number[] = [];
    for (let c = 0; c < this.cols; c++) {
      const slots: number[] = [];
      for (let r = this.rows - 1; r >= 0; r--) if (this.free(this.at(r, c))) slots.push(this.at(r, c));
      const pieces: Piece[] = [];
      for (const s of slots) {
        const p = this.cells[s];
        if (p) {
          if (!from.has(p.id) && !spawned.has(p.id)) from.set(p.id, s);
          pieces.push(p);
        }
        this.cells[s] = null;
      }
      pieces.forEach((p, k) => { this.cells[slots[k]] = p; });
      const need = slots.length - pieces.length;
      for (let k = 0; k < need; k++) {
        const s = slots[pieces.length + k];
        const p = this.piece(this.randKind());
        this.cells[s] = p;
        spawned.set(p.id, { kind: p.kind, sp: p.sp, fromRow: this.r(s) - need });
        fresh.push(s);
      }
    }
    // a satellite still to come enters at the top of one of the refilled columns
    if (fresh.length && this.satSpawned < this.satTotal && this.satsOnBoard < this.satsAtOnce) {
      const tops = fresh.filter(s => !fresh.includes(s - this.cols) && this.floorOf(this.c(s)) !== s);
      if (tops.length) {
        const s = tops[Math.floor(this.rng() * tops.length)];
        const old = this.cells[s]!;
        const p: Piece = { id: old.id, kind: SAT, sp: 'sat', armed: false };
        this.cells[s] = p;
        const sp = spawned.get(old.id);
        if (sp) spawned.set(old.id, { ...sp, kind: SAT, sp: 'sat' });
        this.satSpawned++;
      }
    }
  }

  /**
   * No move is left: the plain bodies trade places (specials, satellites and asteroids stay) until
   * the sky has no match and at least one move; as a last resort their kinds are drawn anew.
   */
  reshuffle(): { id: number; to: number }[] {
    const spots: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.cells[i] && this.cells[i]!.sp === 'none' && this.cells[i]!.kind >= 0) spots.push(i);
    const pieces = spots.map(i => this.cells[i]!);
    let ok = false;
    for (let tries = 0; tries < RULES.genTries && !ok; tries++) {
      const order = this.shuffled(pieces.slice());
      spots.forEach((s, k) => { this.cells[s] = order[k]; });
      if (tries > RULES.genTries / 2) for (const s of spots) this.cells[s]!.kind = this.randKind();
      ok = this.findGroups(null).length === 0 && this.hasMove();
    }
    if (!ok) {
      // draw every plain body again, cell by cell, never making a line
      for (const s of spots) {
        let kind = this.randKind();
        this.cells[s]!.kind = -9;
        for (let k = 0; k < this.kinds && this.makesLine(s, kind); k++) kind = (kind + 1) % this.kinds;
        this.cells[s]!.kind = kind;
      }
    }
    const out: { id: number; to: number }[] = [];
    for (const s of spots) out.push({ id: this.cells[s]!.id, to: s });
    return out;
  }

  /** A copy of the kinds on the board (tests and the picture's resync). */
  snapshot(): { id: number; kind: number; sp: Sp; armed: boolean }[] {
    return this.cells.map(p => (p ? { ...p } : { id: 0, kind: -9, sp: 'none' as Sp, armed: false }));
  }
}

/** Build a board's cells from rows of text (tests and hand-made levels): see levels.ts for the letters. */
export function setCells(b: Board, rows: string[]): void {
  const KIND: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
  let id = 10_000;
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const i = b.at(r, c);
      const lower = ch.toLowerCase();
      if (ch === '#') { b.mask[i] = false; b.cells[i] = null; return; }
      if (ch >= '1' && ch <= '3') { b.rock[i] = Number(ch); b.cells[i] = null; return; }
      if (ch === 's') { b.cells[i] = { id: id++, kind: SAT, sp: 'sat', armed: false }; return; }
      if (ch === '*') { b.cells[i] = { id: id++, kind: PULSAR, sp: 'pulsar', armed: false }; return; }
      const kind = KIND[lower];
      if (kind === undefined) return;
      b.mask[i] = true;
      b.rock[i] = 0;
      b.cells[i] = { id: id++, kind, sp: 'none', armed: false };
    });
  });
}
