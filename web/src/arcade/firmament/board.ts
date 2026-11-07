/**
 * Firmament's match-3 engine, pure (no DOM, no clock), built after Candy Crush Saga with Royal
 * Match's square: a sky of up to 8×8 cells shaped by holes, six kinds of sky bodies, and
 *
 *   matches     three or more in a line, and a square of four (Royal Match)
 *   specials    four in a line → Kometa (a beam along a row or a column); an L or a T → Supernowa
 *               (a 3×3 blast, then again after the fall); five in a line → Pulsar (every body of one
 *               kind); a square → Meteor (flies to what the level wants cleared)
 *   combos      two comets: a cross; a comet and a supernova: three rows and three columns; two
 *               supernovae: 5×5 twice; a pulsar and a special: every body of that kind becomes it and
 *               fires; two pulsars: the whole sky; a meteor carries the other special to its target
 *   the level   dark clouds on cells (1–2 layers, cleared by clearing the body on them), asteroids
 *               (1–3 hits from a match beside them or a blast), orbit locks (the body stays put until a
 *               match or a blast frees it), ink (takes a cell; spreads when a move clears none) and moons
 *               that fall to the bottom row and leave the sky there
 *   the rest    gravity (straight down, sliding diagonally past what blocks a column), refill from the
 *               top, cascades, a generator that never starts with a match and always leaves a move, a
 *               reshuffle when no move is left, and the end of a won level: specials left fire and every
 *               move left becomes a comet (Deszcz komet, Candy Crush's Sugar Crush)
 *
 * A move resolves at once into steps (what was cleared, what blasted, what was born, what fell where);
 * the picture plays them back on the same clock (rules.ts), so the rules never wait for the picture.
 * Everything random comes from the board's own seeded stream.  Cells: i = r × cols + c from the top left.
 */
import { mulberry32 } from '../../core/random';
import { RULES } from './rules';

export type Sp = 'none' | 'row' | 'col' | 'nova' | 'meteor' | 'pulsar';
export type MadeSp = Exclude<Sp, 'none'>;
/** A pulsar has no kind; a moon is not a body you can match. */
export const PULSAR = -1;
export const MOON = -2;

export interface Piece { id: number; kind: number; sp: Sp }

export type BlastKind = 'row' | 'col' | 'nova' | 'nova5' | 'cross' | 'cross3' | 'kind' | 'all' | 'hammer' | 'meteor' | 'star';
export interface Blast { kind: BlastKind; at: number; cells: number[]; of?: number; from?: number }
export interface Cleared { id: number; at: number; kind: number; sp: Sp }
export interface MatchInfo { cells: number[]; kind: number; points: number; made: Sp; at: number }

export interface Step {
  /** 1-based: a move's first step is 1, its cascades count up */
  cascade: number;
  matches: MatchInfo[];
  cleared: Cleared[];
  blasts: Blast[];
  /** specials born from a match; bodies turned special in place (a pulsar's combo, a gift, the finale) */
  born: { id: number; at: number; kind: number; sp: Sp }[];
  changed: { id: number; at: number; sp: Sp }[];
  clouds: { at: number; layers: number }[];
  rocks: { at: number; hp: number }[];
  inks: { at: number; on: boolean }[];
  locks: number[];
  moons: { id: number; at: number }[];
  moves: { id: number; from: number; to: number }[];
  spawns: { id: number; kind: number; sp: Sp; to: number; fromRow: number }[];
  points: number;
  /** when the fall begins in this step, and how long the picture takes to play all of it (s) */
  fall: number;
  dur: number;
}

/** What a move did, in sum (the goals and the session's numbers read it). */
export interface Tally {
  points: number;
  /** bodies cleared per kind */
  kinds: number[];
  clouds: number;
  rocks: number;
  inks: number;
  locks: number;
  moons: number;
  made: Record<MadeSp, number>;
  cascades: number;
  /** a combo of two specials ('comet+comet', 'pulsar+pulsar' …) */
  combo: string | null;
  cleared: number;
}

export interface Resolution {
  ok: boolean;
  steps: Step[];
  tally: Tally;
  /** the swap (bounced back when not ok), and a reshuffle after the move when no move was left */
  swap: [number, number] | null;
  shuffle: { id: number; to: number }[] | null;
  dur: number;
}

export interface Move { a: number; b: number; value: number }

export interface BoardSpec {
  rows?: number;
  cols?: number;
  kinds: number;
  mask?: boolean[];
  cloud?: number[];
  rock?: number[];
  ink?: number[];
  lock?: number[];
  /** moons to bring down, how many at most on the board at once, and how many start in the top row */
  moons?: number;
  moonsAtOnce?: number;
  /** the kinds the level wants collected (a meteor's target) */
  want?: number[];
  seed: number;
}

const emptyMade = (): Record<MadeSp, number> => ({ row: 0, col: 0, nova: 0, meteor: 0, pulsar: 0 });
export const freshTally = (kinds: number): Tally => ({
  points: 0, kinds: new Array<number>(kinds).fill(0), clouds: 0, rocks: 0, inks: 0, locks: 0, moons: 0, made: emptyMade(), cascades: 0, combo: null, cleared: 0,
});
const freshStep = (cascade: number): Step => ({
  cascade, matches: [], cleared: [], blasts: [], born: [], changed: [], clouds: [], rocks: [], inks: [], locks: [], moons: [], moves: [], spawns: [], points: 0, fall: 0, dur: 0,
});

export const isSpecial = (p: Piece | null | undefined): boolean => !!p && p.sp !== 'none';
const comet = (sp: Sp): boolean => sp === 'row' || sp === 'col';

interface Group { cells: number[]; kind: number; h: number; v: number; square: boolean; hRun: number[]; vRun: number[]; sqCells: number[] }
interface Queued { kind: BlastKind; at: number; of?: number; carry?: Sp; from?: number }

export class Board {
  readonly rows: number;
  readonly cols: number;
  readonly n: number;
  readonly kinds: number;
  readonly mask: boolean[];
  readonly cells: (Piece | null)[];
  readonly cloud: number[];
  readonly rock: number[];
  readonly ink: number[];
  readonly lock: number[];
  /** the bottom cell of each column's run of sky (under it: the edge or a hole), where moons leave */
  readonly exit: boolean[];
  /** the top cell of each run of sky (over it: the edge or a hole), where new bodies come in */
  readonly spawn: boolean[];
  moonTotal: number;
  moonSpawned = 0;
  moonDown = 0;
  readonly moonsAtOnce: number;
  want: number[];
  private nextId = 1;
  private readonly rng: () => number;
  /** second blasts of supernovae, fired in the next step */
  private pending: Queued[] = [];

  constructor(spec: BoardSpec) {
    this.rows = spec.rows ?? RULES.rows;
    this.cols = spec.cols ?? RULES.cols;
    this.n = this.rows * this.cols;
    this.kinds = Math.max(3, Math.min(RULES.kinds, spec.kinds));
    this.rng = mulberry32(spec.seed);
    const fill = (src: number[] | undefined) => Array.from({ length: this.n }, (_, i) => (src && Number.isFinite(src[i]) ? Math.max(0, Math.floor(src[i])) : 0));
    this.mask = Array.from({ length: this.n }, (_, i) => (spec.mask ? !!spec.mask[i] : true));
    this.rock = fill(spec.rock).map((v, i) => (this.mask[i] ? Math.min(3, v) : 0));
    this.ink = fill(spec.ink).map((v, i) => (this.mask[i] && !this.rock[i] ? Math.min(1, v) : 0));
    this.cloud = fill(spec.cloud).map((v, i) => (this.mask[i] && !this.rock[i] && !this.ink[i] ? Math.min(2, v) : 0));
    this.lock = fill(spec.lock).map((v, i) => (this.mask[i] && !this.rock[i] && !this.ink[i] ? Math.min(1, v) : 0));
    this.cells = new Array<Piece | null>(this.n).fill(null);
    this.exit = Array.from({ length: this.n }, (_, i) => this.mask[i] && (this.r(i) === this.rows - 1 || !this.mask[i + this.cols]));
    this.spawn = Array.from({ length: this.n }, (_, i) => this.mask[i] && (this.r(i) === 0 || !this.mask[i - this.cols]));
    this.moonTotal = Math.max(0, spec.moons ?? 0);
    this.moonsAtOnce = Math.max(1, spec.moonsAtOnce ?? 2);
    this.want = spec.want?.slice() ?? [];
    this.generate();
    // the first moons wait in the top row
    let start = Math.min(this.moonTotal, this.moonsAtOnce);
    const tops: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.spawn[i] && this.open(i) && !this.lock[i] && !this.exit[i]) tops.push(i);
    while (start > 0 && tops.length) {
      const i = tops.splice(Math.floor(this.rng() * tops.length), 1)[0];
      this.cells[i] = { id: this.nextId++, kind: MOON, sp: 'none' };
      this.moonSpawned++;
      start--;
    }
    if (!this.hasMove()) this.reshuffle();
  }

  // ── geometry ──────────────────────────────────────────────────
  at(r: number, c: number): number { return r * this.cols + c; }
  r(i: number): number { return Math.floor(i / this.cols); }
  c(i: number): number { return i % this.cols; }
  inside(r: number, c: number): boolean { return r >= 0 && c >= 0 && r < this.rows && c < this.cols; }
  /** a cell that can hold a body: in the sky, not an asteroid or ink */
  open(i: number): boolean { return i >= 0 && i < this.n && this.mask[i] && !this.rock[i] && !this.ink[i]; }
  adjacent(a: number, b: number): boolean {
    return Math.abs(this.r(a) - this.r(b)) + Math.abs(this.c(a) - this.c(b)) === 1;
  }
  neighbours(i: number): number[] {
    const r = this.r(i), c = this.c(i), out: number[] = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) if (this.inside(r + dr, c + dc)) out.push(this.at(r + dr, c + dc));
    return out;
  }
  /** may this cell's body be swapped */
  free(i: number): boolean { return this.open(i) && !!this.cells[i] && !this.lock[i]; }

  get cloudLeft(): number { return this.cloud.reduce((s, v) => s + v, 0); }
  get cloudCells(): number { return this.cloud.reduce((s, v) => s + (v > 0 ? 1 : 0), 0); }
  get rocksLeft(): number { return this.rock.reduce((s, v) => s + (v > 0 ? 1 : 0), 0); }
  get inkLeft(): number { return this.ink.reduce((s, v) => s + v, 0); }
  get locksLeft(): number { return this.lock.reduce((s, v) => s + v, 0); }
  get moonsLeft(): number { return Math.max(0, this.moonTotal - this.moonDown); }
  get moonsOnBoard(): number { return this.cells.filter(p => p?.kind === MOON).length; }

  private matchable(i: number): boolean {
    const p = this.cells[i];
    return !!p && p.kind >= 0 && this.open(i);
  }

  private randKind(): number { return Math.floor(this.rng() * this.kinds); }

  private newPiece(kind: number, sp: Sp = 'none'): Piece { return { id: this.nextId++, kind, sp }; }

  // ── generation ────────────────────────────────────────────────
  /** Would `kind` at i make a line of three (left or up) or a square with what is already placed? */
  private makesMatch(i: number, kind: number): boolean {
    const r = this.r(i), c = this.c(i);
    const k = (rr: number, cc: number) => (this.inside(rr, cc) ? this.cells[this.at(rr, cc)]?.kind ?? -9 : -9);
    if (k(r, c - 1) === kind && k(r, c - 2) === kind) return true;
    if (k(r - 1, c) === kind && k(r - 2, c) === kind) return true;
    if (k(r, c + 1) === kind && k(r, c + 2) === kind) return true;
    if (k(r + 1, c) === kind && k(r + 2, c) === kind) return true;
    if (k(r, c - 1) === kind && k(r, c + 1) === kind) return true;
    if (k(r - 1, c) === kind && k(r + 1, c) === kind) return true;
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      if (k(r + dr, c) === kind && k(r, c + dc) === kind && k(r + dr, c + dc) === kind) return true;
    }
    return false;
  }

  private generate(): void {
    for (let tries = 0; tries < RULES.genTries; tries++) {
      for (let i = 0; i < this.n; i++) if (this.open(i)) this.cells[i] = null;
      for (let i = 0; i < this.n; i++) {
        if (!this.open(i)) continue;
        let kind = this.randKind();
        for (let k = 0; k < this.kinds && this.makesMatch(i, kind); k++) kind = (kind + 1) % this.kinds;
        this.cells[i] = this.newPiece(kind);
      }
      if (this.findGroups().length === 0 && this.hasMove()) return;
    }
  }

  // ── matches ───────────────────────────────────────────────────
  findGroups(): Group[] {
    const parent = new Map<number, number>();
    const find = (x: number): number => {
      let p = parent.get(x) ?? x;
      while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
      parent.set(x, p);
      return p;
    };
    const union = (a: number, b: number) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    const hLen = new Map<number, number>(), vLen = new Map<number, number>(), sq = new Set<number>();
    const kindAt = (i: number) => (this.matchable(i) ? this.cells[i]!.kind : -9);
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const k = kindAt(this.at(r, c));
        let e = c + 1;
        while (k >= 0 && e < this.cols && kindAt(this.at(r, e)) === k) e++;
        if (k >= 0 && e - c >= 3) {
          for (let x = c; x < e; x++) {
            hLen.set(this.at(r, x), e - c);
            parent.set(this.at(r, x), parent.get(this.at(r, x)) ?? this.at(r, x));
            if (x > c) union(this.at(r, x), this.at(r, c));
          }
        }
        c = e;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const k = kindAt(this.at(r, c));
        let e = r + 1;
        while (k >= 0 && e < this.rows && kindAt(this.at(e, c)) === k) e++;
        if (k >= 0 && e - r >= 3) {
          for (let y = r; y < e; y++) {
            vLen.set(this.at(y, c), e - r);
            parent.set(this.at(y, c), parent.get(this.at(y, c)) ?? this.at(y, c));
            if (y > r) union(this.at(y, c), this.at(r, c));
          }
        }
        r = e;
      }
    }
    for (let r = 0; r + 1 < this.rows; r++) {
      for (let c = 0; c + 1 < this.cols; c++) {
        const a = this.at(r, c), k = kindAt(a);
        if (k < 0) continue;
        const four = [a, this.at(r, c + 1), this.at(r + 1, c), this.at(r + 1, c + 1)];
        if (four.every(i => kindAt(i) === k)) {
          for (const i of four) {
            sq.add(i);
            parent.set(i, parent.get(i) ?? i);
            union(i, a);
          }
        }
      }
    }
    const groups = new Map<number, Group>();
    for (const i of parent.keys()) {
      const root = find(i);
      let g = groups.get(root);
      if (!g) {
        g = { cells: [], kind: this.cells[i]!.kind, h: 0, v: 0, square: false, hRun: [], vRun: [], sqCells: [] };
        groups.set(root, g);
      }
      g.cells.push(i);
      const h = hLen.get(i) ?? 0, v = vLen.get(i) ?? 0;
      if (h > g.h) g.h = h;
      if (v > g.v) g.v = v;
      if (h >= 3) g.hRun.push(i);
      if (v >= 3) g.vRun.push(i);
      if (sq.has(i)) { g.square = true; g.sqCells.push(i); }
    }
    return [...groups.values()].map(g => ({ ...g, cells: g.cells.sort((a, b) => a - b) }));
  }

  /** What a group makes: five → pulsar, L/T → supernova, four → comet across the line, a square → meteor. */
  static special(g: Pick<Group, 'h' | 'v' | 'square'>): Sp {
    if (g.h >= 5 || g.v >= 5) return 'pulsar';
    if (g.h >= 3 && g.v >= 3) return 'nova';
    if (g.h === 4) return 'col';
    if (g.v === 4) return 'row';
    if (g.square) return 'meteor';
    return 'none';
  }

  /** Where the special of a group is born: on the swapped cell when it took part, else in the group's heart. */
  private birthCell(g: Group, sp: Sp, swap: [number, number] | null): number {
    if (swap) for (const s of [swap[1], swap[0]]) if (g.cells.includes(s)) return s;
    if (sp === 'nova') {
      const both = g.hRun.find(i => g.vRun.includes(i));
      if (both !== undefined) return both;
    }
    if (sp === 'meteor' && g.sqCells.length) return g.sqCells[0];
    const run = g.h >= g.v ? g.hRun : g.vRun;
    return run.length ? run[Math.floor(run.length / 2)] : g.cells[Math.floor(g.cells.length / 2)];
  }

  // ── moves ─────────────────────────────────────────────────────
  /** Run lengths through i (with the cells as they are) and whether it sits in a square of its kind. */
  private lineAt(i: number): { h: number; v: number; sq: boolean; cells: number[] } {
    const p = this.cells[i];
    if (!p || p.kind < 0 || !this.open(i)) return { h: 0, v: 0, sq: false, cells: [] };
    const k = p.kind, r = this.r(i), c = this.c(i);
    const same = (rr: number, cc: number) => this.inside(rr, cc) && this.matchable(this.at(rr, cc)) && this.cells[this.at(rr, cc)]!.kind === k;
    let l = c, rr = c, u = r, d = r;
    while (same(r, l - 1)) l--;
    while (same(r, rr + 1)) rr++;
    while (same(u - 1, c)) u--;
    while (same(d + 1, c)) d++;
    const h = rr - l + 1, v = d - u + 1;
    const cells: number[] = [];
    if (h >= 3) for (let x = l; x <= rr; x++) cells.push(this.at(r, x));
    if (v >= 3) for (let y = u; y <= d; y++) if (y !== r || h < 3) cells.push(this.at(y, c));
    let sq = false;
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      if (same(r + dr, c) && same(r, c + dc) && same(r + dr, c + dc)) {
        sq = true;
        for (const x of [this.at(r + dr, c), this.at(r, c + dc), this.at(r + dr, c + dc)]) if (!cells.includes(x)) cells.push(x);
        if (!cells.includes(i)) cells.push(i);
        break;
      }
    }
    return { h, v, sq, cells };
  }

  /** How good a swap is (0: it makes nothing).  Specials made and the level's goals weigh in. */
  swapValue(a: number, b: number): number {
    if (!this.free(a) || !this.free(b) || !this.adjacent(a, b)) return 0;
    const pa = this.cells[a]!, pb = this.cells[b]!;
    if (pa.sp === 'pulsar' || pb.sp === 'pulsar') {
      if (pa.kind === MOON || pb.kind === MOON) return 0;
      return isSpecial(pa) && isSpecial(pb) ? 90 : 60;
    }
    if (isSpecial(pa) && isSpecial(pb)) return 70;
    let v = pa.sp === 'meteor' || pb.sp === 'meteor' ? 25 : 0;
    this.cells[a] = pb;
    this.cells[b] = pa;
    for (const i of [a, b]) {
      const m = this.lineAt(i);
      if (m.h < 3 && m.v < 3 && !m.sq) continue;
      v += m.cells.length * 2;
      const sp = Board.special({ h: m.h, v: m.v, square: m.sq });
      v += sp === 'pulsar' ? 40 : sp === 'nova' ? 30 : comet(sp) ? 20 : sp === 'meteor' ? 12 : 0;
      for (const x of m.cells) {
        v += this.cloud[x] * 6 + (isSpecial(this.cells[x]) ? 10 : 0) + (this.want.includes(this.cells[x]!.kind) ? 3 : 0);
        for (const nb of this.neighbours(x)) if (this.rock[nb] || this.ink[nb]) v += 4;
        // a moon above a cleared cell comes down
        const up = this.r(x) > 0 ? this.cells[x - this.cols] : null;
        if (up?.kind === MOON) v += 8;
      }
      v += this.r(i) * 0.3;   // lower moves stir more cascades
    }
    this.cells[a] = pa;
    this.cells[b] = pb;
    return v;
  }

  /** Every swap that does something, best first. */
  findMoves(): Move[] {
    const out: Move[] = [];
    for (let i = 0; i < this.n; i++) {
      if (!this.free(i)) continue;
      for (const j of [this.c(i) + 1 < this.cols ? i + 1 : -1, i + this.cols < this.n ? i + this.cols : -1]) {
        if (j < 0 || !this.free(j)) continue;
        const value = this.swapValue(i, j);
        if (value > 0) out.push({ a: i, b: j, value });
      }
    }
    return out.sort((x, y) => y.value - x.value || x.a - y.a);
  }

  hasMove(): boolean {
    for (let i = 0; i < this.n; i++) {
      if (!this.free(i)) continue;
      if (this.c(i) + 1 < this.cols && this.free(i + 1) && this.swapValue(i, i + 1) > 0) return true;
      if (i + this.cols < this.n && this.free(i + this.cols) && this.swapValue(i, i + this.cols) > 0) return true;
    }
    return false;
  }

  // ── resolving ─────────────────────────────────────────────────
  /** Swap two neighbours: a move when it makes something, a free bounce when not. */
  swap(a: number, b: number): Resolution {
    const tally = freshTally(this.kinds);
    const bounce = (): Resolution => ({ ok: false, steps: [], tally, swap: [a, b], shuffle: null, dur: RULES.bounceSec });
    if (!this.adjacent(a, b) || !this.free(a) || !this.free(b)) return bounce();
    const pa = this.cells[a]!, pb = this.cells[b]!;
    const queue: Queued[] = [];
    const consume: number[] = [];
    const convert: { at: number; sp: Sp }[] = [];
    if (pa.sp === 'pulsar' || pb.sp === 'pulsar') {
      if (pa.kind === MOON || pb.kind === MOON) return bounce();
      // the pulsar ends where it was swapped to: b's cell holds what was at a
      const [pul, other, oAt] = pa.sp === 'pulsar' ? [a, pb, b] : [b, pa, a];
      consume.push(pul);
      if (other.sp === 'pulsar') {
        consume.push(oAt);
        queue.push({ kind: 'all', at: b });
        tally.combo = 'pulsar+pulsar';
      } else if (other.sp !== 'none') {
        consume.push(oAt);
        for (let i = 0; i < this.n; i++) {
          const p = this.cells[i];
          if (i !== oAt && i !== pul && p && p.kind === other.kind && p.sp === 'none' && this.open(i)) {
            const sp: Sp = comet(other.sp) ? (this.rng() < 0.5 ? 'row' : 'col') : other.sp;
            convert.push({ at: i, sp });
            queue.push({ kind: this.blastOf(sp), at: i });
          }
        }
        queue.push({ kind: this.blastOf(other.sp), at: oAt });
        tally.combo = `pulsar+${comet(other.sp) ? 'comet' : other.sp}`;
      } else {
        queue.push({ kind: 'kind', at: pul, of: other.kind });
        tally.combo = 'pulsar';
      }
      return this.resolve({ consume, convert, queue, swap: [a, b], match: false }, tally, true);
    }
    if (isSpecial(pa) && isSpecial(pb)) {
      const sps: Sp[] = [pa.sp, pb.sp];
      consume.push(a, b);
      const has = (s: Sp) => sps.includes(s);
      if (has('meteor')) {
        const carry = pa.sp === 'meteor' ? pb.sp : pa.sp;
        if (carry === 'meteor') {
          for (let k = 0; k < 3; k++) queue.push({ kind: 'meteor', at: b });
          tally.combo = 'meteor+meteor';
        } else {
          queue.push({ kind: 'meteor', at: b, carry });
          tally.combo = `meteor+${comet(carry) ? 'comet' : carry}`;
        }
      } else if (comet(pa.sp) && comet(pb.sp)) {
        queue.push({ kind: 'cross', at: b });
        tally.combo = 'comet+comet';
      } else if (has('nova') && (comet(pa.sp) || comet(pb.sp))) {
        queue.push({ kind: 'cross3', at: b });
        tally.combo = 'comet+nova';
      } else {
        queue.push({ kind: 'nova5', at: b });
        this.pending.push({ kind: 'nova5', at: b });
        tally.combo = 'nova+nova';
      }
      return this.resolve({ consume, convert, queue, swap: [a, b], match: false }, tally, true);
    }
    // an ordinary swap: it must make a match (a meteor flies anyway, as in Royal Match)
    this.cells[a] = pb;
    this.cells[b] = pa;
    const groups = this.findGroups();
    const meteor = pa.sp === 'meteor' ? b : pb.sp === 'meteor' ? a : -1;
    if (!groups.length && meteor < 0) {
      this.cells[a] = pa;
      this.cells[b] = pb;
      return bounce();
    }
    if (meteor >= 0 && !groups.some(g => g.cells.includes(meteor))) {
      consume.push(meteor);
      queue.push({ kind: 'meteor', at: meteor });
    }
    return this.resolve({ consume, convert, queue, swap: [a, b], match: true }, tally, true);
  }

  /** The blast a special at i sets off. */
  private fireOf(p: Piece, i: number): Queued {
    return { kind: this.blastOf(p.sp), at: i, of: p.sp === 'pulsar' ? undefined : p.kind };
  }

  private blastOf(sp: Sp): BlastKind {
    return sp === 'row' ? 'row' : sp === 'col' ? 'col' : sp === 'nova' ? 'nova' : sp === 'meteor' ? 'meteor' : sp === 'pulsar' ? 'kind' : 'hammer';
  }

  /**
   * The engine: steps until the sky is still.  A step clears its matches and fires its blasts (a
   * special hit by a blast fires too), damages what stands beside a match, places the specials
   * born, lets everything fall and refills; then the next step looks for new matches.
   */
  private resolve(first: { consume: number[]; convert: { at: number; sp: Sp }[]; queue: Queued[]; swap: [number, number] | null; match: boolean },
    tally: Tally, ok: boolean): Resolution {
    const steps: Step[] = [];
    let cascade = 1;
    let work: { consume: number[]; convert: { at: number; sp: Sp }[]; queue: Queued[]; swap: [number, number] | null; match: boolean } | null = first;
    while (work) {
      const st = freshStep(cascade);
      // turned special before anything fires (their blasts are queued already)
      const fired = new Set<number>();
      for (const cv of work.convert) {
        const p = this.cells[cv.at];
        if (!p) continue;
        p.sp = cv.sp;
        if (work.queue.some(q => q.at === cv.at)) fired.add(p.id);
        st.changed.push({ id: p.id, at: cv.at, sp: cv.sp });
      }
      const hitBlock = new Set<number>();
      const queue = work.queue.slice();
      // the two specials of a combo leave without firing on their own
      for (const i of work.consume) {
        const p = this.cells[i];
        if (!p) continue;
        fired.add(p.id);
        this.removeAt(i, st, tally, false);
      }
      const births: { at: number; kind: number; sp: Sp }[] = [];
      if (work.match) {
        for (const g of this.findGroups()) {
          const sp = Board.special(g);
          const at = sp === 'none' ? g.cells[0] : this.birthCell(g, sp, work.swap);
          const pts = RULES.body * g.cells.length * cascade + (sp !== 'none' ? RULES.make[sp] : 0);
          st.matches.push({ cells: g.cells.slice(), kind: g.kind, points: pts, made: sp, at });
          st.points += pts;
          for (const i of g.cells) {
            // beside a match: asteroids crack, ink dissolves (each once a step)
            for (const nb of this.neighbours(i)) if ((this.rock[nb] || this.ink[nb]) && !hitBlock.has(nb)) { hitBlock.add(nb); this.hitBlocker(nb, st, tally); }
            this.hitCell(i, st, tally, queue, fired, true);
          }
          if (sp !== 'none') {
            births.push({ at, kind: g.kind, sp });
            tally.made[sp as MadeSp]++;
          }
        }
      }
      // blasts (and the specials they set off)
      let guard = 0;
      while (queue.length && guard++ < 400) {
        const q = queue.shift()!;
        const cells = this.blastCells(q);
        const blast: Blast = { kind: q.kind, at: q.at, cells, of: q.of };
        if (q.kind === 'meteor') {
          const target = this.meteorTarget(new Set(st.blasts.filter(b => b.kind === 'meteor').map(b => b.at)));
          blast.from = q.at;
          blast.at = target;
          blast.cells = [...new Set([...cells, target])];
          if (q.carry && q.carry !== 'none') queue.push({ kind: this.blastOf(q.carry), at: target });
        }
        if (q.kind === 'kind' && q.of === undefined) blast.of = this.commonKind();
        if (q.kind === 'kind') blast.cells = this.cellsOfKind(blast.of ?? 0);
        st.blasts.push(blast);
        for (const i of blast.cells) {
          if (this.rock[i] || this.ink[i]) {
            if (!hitBlock.has(i)) { hitBlock.add(i); this.hitBlocker(i, st, tally); }
            continue;
          }
          this.hitCell(i, st, tally, queue, fired, false);
        }
      }
      // the specials born take their cells (a cell still held by a locked body or a moon passes to a free one)
      for (const b of births) {
        let at = b.at;
        if (this.cells[at] || !this.open(at)) {
          const g = st.matches.find(m => m.at === b.at);
          at = g?.cells.find(i => !this.cells[i] && this.open(i)) ?? -1;
        }
        if (at < 0) continue;
        const p = this.newPiece(b.kind, b.sp);
        this.cells[at] = p;
        st.born.push({ id: p.id, at, kind: b.kind, sp: b.sp });
      }
      this.gravity(st, tally);
      st.fall = RULES.clearSec + (st.blasts.length ? RULES.blastSec : 0) + (st.blasts.some(b => b.kind === 'meteor') ? RULES.flySec : 0);
      st.dur = st.fall + this.fallDur(st);
      tally.points += st.points;
      steps.push(st);
      tally.cascades = Math.max(tally.cascades, cascade);
      // next: a supernova's second blast, new matches
      const pend = this.pending;
      this.pending = [];
      const again = this.findGroups().length > 0;
      if (!again && !pend.length) break;
      cascade++;
      work = { consume: [], convert: [], queue: pend, swap: null, match: again };
      if (cascade > 60) break;
    }
    const shuffle = this.hasMove() ? null : this.reshuffle();
    const dur = steps.reduce((s, x) => s + x.dur, 0) + RULES.swapSec;
    return { ok, steps, tally, swap: first.swap, shuffle, dur };
  }

  private fallDur(st: Step): number {
    let rows = 0;
    for (const m of st.moves) rows = Math.max(rows, Math.abs(this.r(m.to) - this.r(m.from)) + Math.abs(this.c(m.to) - this.c(m.from)) * 0.5);
    for (const s of st.spawns) rows = Math.max(rows, this.r(s.to) - s.fromRow);
    return rows > 0 ? Math.max(RULES.fallMin, rows * RULES.fallCell) : 0;
  }

  /** A cell taken by a match or a blast: a lock breaks, a cloud thins, the body leaves (a special fires). */
  private hitCell(i: number, st: Step, tally: Tally, queue: Queued[], fired: Set<number>, byMatch: boolean): void {
    if (!this.mask[i]) return;
    const p = this.cells[i];
    if (!p) {
      if (!byMatch && this.cloud[i] > 0) this.thinCloud(i, st, tally);
      return;
    }
    if (p.kind === MOON) return;
    if (this.lock[i]) {
      this.lock[i] = 0;
      st.locks.push(i);
      tally.locks++;
      st.points += RULES.lock;
      if (this.cloud[i] > 0) this.thinCloud(i, st, tally);
      return;
    }
    if (p.sp !== 'none' && !fired.has(p.id)) {
      fired.add(p.id);
      queue.push(this.fireOf(p, i));
      if (p.sp === 'nova') this.pending.push({ kind: 'nova', at: i });
    }
    if (!byMatch) st.points += RULES.blasted;
    this.removeAt(i, st, tally, true);
  }

  private removeAt(i: number, st: Step, tally: Tally, layer: boolean): void {
    const p = this.cells[i];
    if (!p) return;
    this.cells[i] = null;
    st.cleared.push({ id: p.id, at: i, kind: p.kind, sp: p.sp });
    tally.cleared++;
    if (p.kind >= 0) tally.kinds[p.kind]++;
    if (layer && this.cloud[i] > 0) this.thinCloud(i, st, tally);
  }

  private thinCloud(i: number, st: Step, tally: Tally): void {
    this.cloud[i]--;
    st.clouds.push({ at: i, layers: this.cloud[i] });
    tally.clouds++;
    st.points += RULES.cloud;
  }

  private hitBlocker(i: number, st: Step, tally: Tally): void {
    if (this.rock[i] > 0) {
      this.rock[i]--;
      st.rocks.push({ at: i, hp: this.rock[i] });
      st.points += RULES.rockHit;
      if (this.rock[i] === 0) tally.rocks++;
    } else if (this.ink[i] > 0) {
      this.ink[i] = 0;
      st.inks.push({ at: i, on: false });
      st.points += RULES.ink;
      tally.inks++;
    }
  }

  private blastCells(q: Queued): number[] {
    const r = this.r(q.at), c = this.c(q.at), out: number[] = [];
    const add = (rr: number, cc: number) => { if (this.inside(rr, cc) && this.mask[this.at(rr, cc)]) out.push(this.at(rr, cc)); };
    const box = (k: number) => { for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) add(r + dr, c + dc); };
    switch (q.kind) {
      case 'row': for (let x = 0; x < this.cols; x++) add(r, x); break;
      case 'col': for (let y = 0; y < this.rows; y++) add(y, c); break;
      case 'cross': for (let x = 0; x < this.cols; x++) add(r, x); for (let y = 0; y < this.rows; y++) if (y !== r) add(y, c); break;
      case 'cross3': {
        const s = new Set<number>();
        for (let d = -1; d <= 1; d++) {
          for (let x = 0; x < this.cols; x++) if (this.inside(r + d, x) && this.mask[this.at(r + d, x)]) s.add(this.at(r + d, x));
          for (let y = 0; y < this.rows; y++) if (this.inside(y, c + d) && this.mask[this.at(y, c + d)]) s.add(this.at(y, c + d));
        }
        return [...s];
      }
      case 'nova': box(1); break;
      case 'nova5': box(2); break;
      case 'all': for (let i = 0; i < this.n; i++) if (this.mask[i]) out.push(i); break;
      case 'meteor': add(r, c); add(r - 1, c); add(r + 1, c); add(r, c - 1); add(r, c + 1); break;
      case 'hammer': case 'star': add(r, c); break;
      case 'kind': break;
    }
    return out;
  }

  private cellsOfKind(kind: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.cells[i]?.kind === kind && this.open(i)) out.push(i);
    return out;
  }

  /** The kind most bodies on the board have (a pulsar set off by a blast takes it). */
  commonKind(): number {
    const n = new Array<number>(this.kinds).fill(0);
    for (const p of this.cells) if (p && p.kind >= 0) n[p.kind]++;
    let best = 0;
    for (let k = 1; k < n.length; k++) if (n[k] > n[best]) best = k;
    return best;
  }

  /** Where a meteor flies: what the level wants cleared first (clouds, asteroids, ink, under a moon, a wanted kind). */
  meteorTarget(skip: Set<number> = new Set()): number {
    let best = -1, bestV = -1;
    for (let i = 0; i < this.n; i++) {
      if (!this.mask[i] || skip.has(i)) continue;
      let v = 0;
      const p = this.cells[i];
      if (this.rock[i] || this.ink[i]) v = 9 + this.rock[i];
      else if (!p || p.kind === MOON) continue;
      else {
        if (this.cloud[i]) v = 10 + this.cloud[i];
        else if (this.lock[i]) v = 7;
        else if (this.r(i) > 0 && this.cells[i - this.cols]?.kind === MOON) v = 8;
        else if (this.want.includes(p.kind)) v = 5;
        else v = 1;
      }
      v += this.rng() * 0.9;
      if (v > bestV) { bestV = v; best = i; }
    }
    return best >= 0 ? best : Math.floor(this.n / 2);
  }

  // ── gravity ───────────────────────────────────────────────────
  /** Does something come down this column into i (a body above, or the column's top that refills)? */
  private fedFromAbove(i: number): boolean {
    let j = i;
    while (j >= 0) {
      if (!this.open(j)) return false;
      const p = this.cells[j];
      if (p && j !== i) return !this.lock[j];
      if (this.spawn[j]) return true;
      j -= this.cols;
    }
    return false;
  }

  private gravity(st: Step, tally: Tally): void {
    const moved = new Map<number, { id: number; from: number; to: number }>();
    const spawned = new Map<number, { id: number; kind: number; sp: Sp; to: number; fromRow: number }>();
    const spawnCount = new Map<number, number>();
    const move = (from: number, to: number) => {
      const p = this.cells[from]!;
      this.cells[to] = p;
      this.cells[from] = null;
      const s = spawned.get(p.id);
      if (s) { s.to = to; return; }
      const m = moved.get(p.id);
      if (m) m.to = to;
      else moved.set(p.id, { id: p.id, from, to });
    };
    for (let pass = 0; pass < this.n * 2; pass++) {
      let changed = false;
      for (let r = this.rows - 1; r >= 0; r--) {
        for (let c = 0; c < this.cols; c++) {
          const i = this.at(r, c);
          if (!this.open(i) || this.cells[i]) continue;
          const up = r > 0 ? i - this.cols : -1;
          if (up >= 0 && this.open(up) && this.cells[up] && !this.lock[up]) { move(up, i); changed = true; continue; }
          if (this.spawn[i]) {
            const p = this.spawnPiece();
            this.cells[i] = p;
            const k = (spawnCount.get(i) ?? 0) + 1;
            spawnCount.set(i, k);
            spawned.set(p.id, { id: p.id, kind: p.kind, sp: p.sp, to: i, fromRow: r - k });
            changed = true;
            continue;
          }
          if (up >= 0 && this.open(up) && !this.cells[up] && this.fedFromAbove(up)) continue;
          for (const dc of this.rng() < 0.5 ? [-1, 1] : [1, -1]) {
            if (!this.inside(r - 1, c + dc)) continue;
            const k = this.at(r - 1, c + dc), below = this.at(r, c + dc);
            if (!this.open(k) || !this.cells[k] || this.lock[k]) continue;
            if (this.open(below) && !this.cells[below]) continue;   // it will fall straight
            move(k, i);
            changed = true;
            break;
          }
        }
      }
      if (!changed) {
        // moons that reached the bottom leave the sky, and the column falls again
        let left = false;
        for (let i = 0; i < this.n; i++) {
          const p = this.cells[i];
          if (p?.kind === MOON && this.exit[i]) {
            this.cells[i] = null;
            this.moonDown++;
            tally.moons++;
            st.points += RULES.moon;
            st.moons.push({ id: p.id, at: i });
            left = true;
          }
        }
        if (!left) break;
      }
    }
    st.moves.push(...[...moved.values()].filter(m => m.from !== m.to));
    st.spawns.push(...spawned.values());
  }

  private spawnPiece(): Piece {
    if (this.moonSpawned < this.moonTotal && this.moonsOnBoard < this.moonsAtOnce && (this.moonsOnBoard === 0 || this.rng() < 0.12)) {
      this.moonSpawned++;
      return this.newPiece(MOON);
    }
    return this.newPiece(this.randKind());
  }

  // ── reshuffle ─────────────────────────────────────────────────
  /** No move left: the free bodies trade places until the sky has a move and no ready match. */
  reshuffle(): { id: number; to: number }[] {
    const spots: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.free(i) && this.cells[i]!.kind !== MOON) spots.push(i);
    const pieces = spots.map(i => this.cells[i]!);
    for (let tries = 0; tries < 80; tries++) {
      for (let k = pieces.length - 1; k > 0; k--) {
        const j = Math.floor(this.rng() * (k + 1));
        [pieces[k], pieces[j]] = [pieces[j], pieces[k]];
      }
      spots.forEach((i, k) => { this.cells[i] = pieces[k]; });
      if (tries > 40) {
        // stubborn: recolour the plain bodies too
        for (const i of spots) {
          const p = this.cells[i]!;
          if (p.sp === 'none') { p.kind = this.randKind(); for (let q = 0; q < this.kinds && this.makesMatchAny(i, p.kind); q++) p.kind = (p.kind + 1) % this.kinds; }
        }
      }
      if (!this.findGroups().length && this.hasMove()) break;
    }
    return spots.map(i => ({ id: this.cells[i]!.id, to: i }));
  }

  private makesMatchAny(i: number, kind: number): boolean {
    const p = this.cells[i];
    this.cells[i] = null;
    const r = this.makesMatch(i, kind);
    this.cells[i] = p;
    return r;
  }

  // ── tools and gifts (no move spent) ───────────────────────────
  /** The star hammer: one cell — a body leaves (a special fires), a lock breaks, an asteroid cracks, ink dissolves. */
  hammer(at: number): Resolution | null {
    if (at < 0 || at >= this.n || !this.mask[at]) return null;
    const p = this.cells[at];
    if (!this.rock[at] && !this.ink[at] && (!p || p.kind === MOON)) return null;
    return this.resolve({ consume: [], convert: [], queue: [{ kind: 'hammer', at }], swap: null, match: false }, freshTally(this.kinds), true);
  }

  /** The ray: a beam along the row. */
  ray(at: number): Resolution | null {
    if (at < 0 || at >= this.n || !this.mask[at]) return null;
    return this.resolve({ consume: [], convert: [], queue: [{ kind: 'row', at }], swap: null, match: false }, freshTally(this.kinds), true);
  }

  /** Turn the body at `at` into a special (a pulsar from the telescope); false when it cannot. */
  makeSpecial(at: number, sp: Sp): { id: number; at: number; sp: Sp } | null {
    const p = this.cells[at];
    if (!p || p.kind < 0 || p.sp !== 'none' || !this.free(at)) return null;
    p.sp = sp;
    if (sp === 'pulsar') p.kind = PULSAR;
    return { id: p.id, at, sp };
  }

  /** A falling star: a plain body (a lower one, far from the edge, preferred) turns into a special. */
  gift(sp: Sp): { id: number; at: number; sp: Sp } | null {
    const cand: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.free(i) && this.cells[i]!.sp === 'none' && this.cells[i]!.kind >= 0) cand.push(i);
    if (!cand.length) return null;
    cand.sort((x, y) => this.giftScore(y) - this.giftScore(x));
    const pick = cand[Math.floor(this.rng() * Math.min(6, cand.length))];
    return this.makeSpecial(pick, sp);
  }

  private giftScore(i: number): number {
    const r = this.r(i), c = this.c(i);
    return r * 0.6 - Math.abs(c - (this.cols - 1) / 2) * 0.4 + this.cloud[i] * 2;
  }

  /** The tool "shuffle": the free bodies trade places. */
  shuffleNow(): { id: number; to: number }[] { return this.reshuffle(); }

  /** Ink spreads (a move cleared none): onto one plain body beside it.  Null when it cannot. */
  spreadInk(): Step | null {
    const src: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.ink[i]) src.push(i);
    const opts: number[] = [];
    for (const i of src) for (const nb of this.neighbours(i)) {
      const p = this.cells[nb];
      if (this.open(nb) && p && p.kind >= 0 && p.sp === 'none' && !this.lock[nb] && !this.cloud[nb]) opts.push(nb);
    }
    if (!opts.length) return null;
    const at = opts[Math.floor(this.rng() * opts.length)];
    const st = freshStep(1);
    const p = this.cells[at]!;
    this.cells[at] = null;
    this.ink[at] = 1;
    st.cleared.push({ id: p.id, at, kind: p.kind, sp: p.sp });
    st.inks.push({ at, on: true });
    st.dur = RULES.clearSec + 0.15;
    st.fall = st.dur;
    return st;
  }

  /**
   * Deszcz komet (Candy Crush's Sugar Crush): the specials left on the board fire, then every move
   * left turns a body into a comet that fires; points for each.
   */
  celebrate(moves: number): Resolution {
    const tally = freshTally(this.kinds);
    const steps: Step[] = [];
    let dur = 0;
    const run = (res: Resolution) => {
      for (const s of res.steps) steps.push(s);
      dur += res.dur;
      tally.points += res.tally.points;
      tally.cascades = Math.max(tally.cascades, res.tally.cascades);
      tally.cleared += res.tally.cleared;
      tally.clouds += res.tally.clouds;
      tally.rocks += res.tally.rocks;
      tally.moons += res.tally.moons;
      res.tally.kinds.forEach((v, k) => { tally.kinds[k] += v; });
    };
    const left = (): number[] => {
      const out: number[] = [];
      for (let i = 0; i < this.n; i++) if (this.open(i) && isSpecial(this.cells[i])) out.push(i);
      return out;
    };
    let specials = left();
    if (specials.length) {
      const queue: Queued[] = specials.map(i => this.fireOf(this.cells[i]!, i));
      run(this.resolve({ consume: specials, convert: [], queue, swap: null, match: false }, freshTally(this.kinds), true));
    }
    for (let k = 0; k < moves; k++) {
      const cand: number[] = [];
      for (let i = 0; i < this.n; i++) if (this.free(i) && this.cells[i]!.kind >= 0 && this.cells[i]!.sp === 'none') cand.push(i);
      if (!cand.length) break;
      const at = cand[Math.floor(this.rng() * cand.length)];
      const sp: Sp = k % 2 ? 'row' : 'col';
      const res = this.resolve({ consume: [], convert: [{ at, sp }], queue: [], swap: null, match: false }, freshTally(this.kinds), true);
      // the comet made then fires at once
      const p = this.cells[at];
      if (p && p.sp === sp) {
        const fire = this.resolve({ consume: [at], convert: [], queue: [{ kind: sp, at }], swap: null, match: false }, freshTally(this.kinds), true);
        fire.steps[0].changed.unshift(...res.steps[0].changed);
        fire.steps[0].points += RULES.leftover;
        fire.tally.points += RULES.leftover;
        run(fire);
      } else run(res);
    }
    specials = left();
    if (specials.length) {
      const queue: Queued[] = specials.map(i => this.fireOf(this.cells[i]!, i));
      run(this.resolve({ consume: specials, convert: [], queue, swap: null, match: false }, freshTally(this.kinds), true));
    }
    // the shower plays fast, comet after comet (Candy Crush's Sugar Crush is a quick payoff)
    const raw = steps.reduce((s, x) => s + x.dur, 0);
    const pace = raw > 0 ? Math.min(RULES.showerPace, RULES.showerMax / raw) : 1;
    steps.forEach((s, i) => { s.cascade = i + 1; s.dur *= pace; s.fall *= pace; });
    dur = steps.reduce((s, x) => s + x.dur, 0);
    return { ok: true, steps, tally, swap: null, shuffle: this.hasMove() ? null : this.reshuffle(), dur };
  }
}

/** For tests and hand-made boards: set the cells from rows of letters (a..f = kinds 0..5, M = a moon, . = empty). */
export function setCells(b: Board, rows: string[], sp: Record<number, Sp> = {}): void {
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const i = b.at(r, c);
    if (ch === '.' || ch === ' ') { b.cells[i] = null; return; }
    if (ch === 'M') { b.cells[i] = { id: 10_000 + i, kind: MOON, sp: 'none' }; return; }
    if (ch === 'P') { b.cells[i] = { id: 10_000 + i, kind: PULSAR, sp: 'pulsar' }; return; }
    b.cells[i] = { id: 10_000 + i, kind: ch.charCodeAt(0) - 97, sp: sp[i] ?? 'none' };
  }));
}
