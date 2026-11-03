/**
 * Games on a free field of dots (src/cards/DESIGN.md §4.7).
 *
 * * **Szlak** — the trail (cards 08 and 19).  Dots scattered over the pad, tapped in order: the
 *   numbers 1, 2, 3…, then card 08's colour chain (1 coral, 2 teal, 3 purple, 4 navy, 5 yellow;
 *   the dots carry no numbers), then numbers and colours taking turns (1, coral, 2, teal…).  It is
 *   the Trail Making Test's idea — part A measures visual search and speed, part B adds switching
 *   between two series.  A wrong tap counts as an error and the trail goes on, as in the test.
 * * **Znajdź kolor** — find the colour (card 17).  A grid of dots; every dot of the target colour is
 *   to be found and tapped.  This is a cancellation task, the classic measure of selective
 *   attention: speed, misses and false taps.  Later grids add near colours (coral among peach and
 *   magenta) and two targets at once.
 */
import type { PadItem, PadLayout } from '../duo/protocol';
import type { ColorId } from '../palette';
import { Staircase } from './adaptive';
import { dot, shuffled, type EngineOptions, type GameEngine, type Legend, type TapIn, type TapOut, type TrialRecord, type TrialSpec } from './types';

/** The field is wider than tall on a phone held sideways and a tablet; positions are kept in 0..1 of it. */
export const FIELD_ASPECT = 1.5;

/** `n` points in the unit square, at least `minDist` apart (in field units, aspect applied), away from the edges. */
export function scatter(rng: () => number, n: number, minDist: number, aspect = FIELD_ASPECT): { x: number; y: number }[] {
  for (let attempt = 0; attempt < 40; attempt++) {
    const pts: { x: number; y: number }[] = [];
    const d = minDist * (1 - attempt / 60);
    for (let tries = 0; pts.length < n && tries < n * 400; tries++) {
      const p = { x: 0.07 + rng() * 0.86, y: 0.09 + rng() * 0.82 };
      if (pts.every(q => Math.hypot((p.x - q.x) * aspect, p.y - q.y) >= d)) pts.push(p);
    }
    if (pts.length === n) return pts;
  }
  throw new Error(`cannot place ${n} dots`);
}

// ── Szlak ──────────────────────────────────────────────────────────

/** Card 08's chain. */
export const TRAIL_CHAIN: ColorId[] = ['coral', 'teal', 'purple', 'navy', 'yellow'];

type Stop = { kind: 'num'; n: number } | { kind: 'color'; c: ColorId };
interface TrailLevel { stops: Stop[]; deadlineMs: number; legend: boolean }

const nums = (n: number): Stop[] => Array.from({ length: n }, (_, i) => ({ kind: 'num', n: i + 1 }));
const chain = (): Stop[] => TRAIL_CHAIN.map(c => ({ kind: 'color', c }));
const alternate = (): Stop[] => TRAIL_CHAIN.flatMap((c, i): Stop[] => [{ kind: 'num', n: i + 1 }, { kind: 'color', c }]);

export const TRAIL_LEVELS: TrailLevel[] = [
  { stops: nums(8), deadlineMs: 30_000, legend: false },
  { stops: nums(12), deadlineMs: 40_000, legend: false },
  { stops: chain(), deadlineMs: 15_000, legend: true },
  { stops: nums(16), deadlineMs: 50_000, legend: false },
  { stops: alternate(), deadlineMs: 40_000, legend: true },
];

const stopItem = (s: Stop, k: number, p: { x: number; y: number }, r: number): PadItem =>
  s.kind === 'num' ? { id: `t${k}`, label: String(s.n), color: 'navy', x: p.x, y: p.y, r } : { id: `t${k}`, color: s.c, x: p.x, y: p.y, r };

export class TrailEngine implements GameEngine {
  readonly id = 'szlak' as const;
  readonly maxLevel = TRAIL_LEVELS.length;
  private readonly stairs: Staircase;
  private readonly rng: () => number;
  private readonly fixed: boolean;
  private items: PadItem[] = [];
  private stops: Stop[] = [];
  private pos = 0;
  private errors = 0;
  private taps = 0;
  private rt: number | null = null;

  constructor(opts: EngineOptions) {
    this.rng = opts.rng;
    this.fixed = !!opts.fixed;
    this.stairs = new Staircase(opts.level, 1, this.maxLevel, 2);
  }

  get level(): number { return this.stairs.level; }
  private get cfg(): TrailLevel { return TRAIL_LEVELS[this.stairs.level - 1]; }

  layout(): PadLayout {
    return { panels: [{ arrange: 'field', aspect: FIELD_ASPECT, items: this.items.map(i => ({ ...i })) }] };
  }

  rule(): Legend | null {
    const c = this.cfg;
    if (!c.stops.some(s => s.kind === 'color')) return null;
    return { rows: TRAIL_CHAIN.map((col, i) => ({ cue: { id: String(i + 1), label: String(i + 1) }, answer: dot(col) })) };
  }

  start(): TrialSpec {
    const c = this.cfg;
    this.stops = c.stops;
    const n = c.stops.length;
    const r = n <= 8 ? 0.075 : n <= 12 ? 0.065 : 0.056;
    const pts = scatter(this.rng, n, r * 2.6);
    this.items = c.stops.map((s, k) => stopItem(s, k, pts[k], r));
    this.pos = 0;
    this.errors = 0;
    this.taps = 0;
    this.rt = null;
    return { stim: this.stim(), layout: this.layout(), legend: c.legend ? this.rule() : null, deadlineMs: c.deadlineMs };
  }

  private stim(): TrialSpec['stim'] {
    const s = this.stops[this.pos];
    const next: PadItem | null = !s ? null : s.kind === 'num' ? { id: 'next', label: String(s.n), color: 'navy' } : dot(s.c, 'next');
    return { kind: 'trail', next, done: this.pos, total: this.stops.length };
  }

  tap(t: TapIn): TapOut {
    if (this.pos >= this.stops.length) return { ok: null, done: false };
    const k = Number(t.item.slice(1));
    if (!t.item.startsWith('t') || !Number.isInteger(k) || k >= this.stops.length) return { ok: null, done: false };
    if (k < this.pos) return { ok: null, done: false };   // a stop already passed
    this.taps++;
    // the trail asks for a stop, not a dot: in the colour chain any dot of the wanted colour will do
    const want = this.stops[this.pos], got = this.stops[k];
    const same = want.kind === got.kind && (want.kind === 'num' ? want.n === (got as { n: number }).n : want.c === (got as { c: ColorId }).c);
    if (!same) {
      this.errors++;
      return { ok: false, done: false };
    }
    if (k !== this.pos) {
      // swap so that "the next stop" stays the one at `pos` (only possible with repeated colours)
      [this.items[k], this.items[this.pos]] = [this.items[this.pos], this.items[k]];
    }
    this.pos++;
    const done = this.pos >= this.stops.length;
    if (done) this.rt = t.t;
    return { ok: true, done, keep: true, stim: this.stim() };
  }

  timeout(): void { /* the record shows how far the trail got */ }

  finish(i: number, at: number): TrialRecord {
    const complete = this.pos >= this.stops.length;
    const ok = complete && this.errors <= 1;
    const rec: TrialRecord = {
      i, level: this.level, ok, rt: complete ? this.rt : null, taps: this.taps, errors: this.errors, n: this.stops.length, done: this.pos, at,
      ...(complete ? {} : { timeout: true }),
    };
    if (!this.fixed) this.stairs.push(ok);
    return rec;
  }
}

// ── Znajdź kolor ───────────────────────────────────────────────────

interface SearchLevel { cols: number; rows: number; targets: ColorId[]; perTarget: number; others: ColorId[]; deadlineMs: number }

export const SEARCH_LEVELS: SearchLevel[] = [
  { cols: 6, rows: 5, targets: ['coral'], perTarget: 6, others: ['navy', 'yellow', 'teal', 'purple'], deadlineMs: 30_000 },
  { cols: 7, rows: 7, targets: ['teal'], perTarget: 8, others: ['navy', 'yellow', 'coral', 'purple', 'peach'], deadlineMs: 35_000 },
  // card 17: 7 × 8, nine targets, grey dots among the colours
  { cols: 7, rows: 8, targets: ['navy'], perTarget: 9, others: ['coral', 'yellow', 'teal', 'purple', 'peach', 'grey'], deadlineMs: 40_000 },
  // near colours: coral among peach and magenta
  { cols: 7, rows: 8, targets: ['coral'], perTarget: 9, others: ['peach', 'magenta', 'yellow', 'purple', 'teal', 'grey'], deadlineMs: 40_000 },
  // two targets at once
  { cols: 8, rows: 8, targets: ['coral', 'teal'], perTarget: 7, others: ['peach', 'navy', 'yellow', 'purple', 'grey'], deadlineMs: 50_000 },
];

export class SearchEngine implements GameEngine {
  readonly id = 'szukaj' as const;
  readonly maxLevel = SEARCH_LEVELS.length;
  private readonly stairs: Staircase;
  private readonly rng: () => number;
  private readonly fixed: boolean;
  private grid: ColorId[] = [];
  private found = new Set<number>();
  private total = 0;
  private errors = 0;
  private taps = 0;
  private rt: number | null = null;

  constructor(opts: EngineOptions) {
    this.rng = opts.rng;
    this.fixed = !!opts.fixed;
    this.stairs = new Staircase(opts.level, 1, this.maxLevel, 2);
  }

  get level(): number { return this.stairs.level; }
  private get cfg(): SearchLevel { return SEARCH_LEVELS[this.stairs.level - 1]; }

  layout(): PadLayout {
    const c = this.cfg;
    return { panels: [{ arrange: 'grid', cols: c.cols, items: this.grid.map((col, k) => ({ id: `g${k}`, color: col, ...(this.found.has(k) ? { done: true } : {}) })) }] };
  }

  rule(): Legend | null { return null; }

  start(): TrialSpec {
    const c = this.cfg;
    const cells = c.cols * c.rows;
    const list: ColorId[] = [];
    for (const t of c.targets) for (let k = 0; k < c.perTarget; k++) list.push(t);
    while (list.length < cells) list.push(c.others[Math.floor(this.rng() * c.others.length)]);
    this.grid = shuffled(this.rng, list);
    this.found = new Set();
    this.total = c.targets.length * c.perTarget;
    this.errors = 0;
    this.taps = 0;
    this.rt = null;
    return { stim: this.stim(), layout: this.layout(), legend: null, deadlineMs: c.deadlineMs };
  }

  private stim(): TrialSpec['stim'] {
    return { kind: 'target', items: this.cfg.targets.map(c => dot(c)), found: this.found.size, total: this.total };
  }

  tap(t: TapIn): TapOut {
    const k = Number(t.item.slice(1));
    if (!t.item.startsWith('g') || !Number.isInteger(k) || k < 0 || k >= this.grid.length || this.found.has(k)) return { ok: null, done: false };
    this.taps++;
    if (!this.cfg.targets.includes(this.grid[k])) {
      this.errors++;
      return { ok: false, done: false };
    }
    this.found.add(k);
    const done = this.found.size >= this.total;
    if (done) this.rt = t.t;
    return { ok: true, done, keep: true, stim: this.stim() };
  }

  timeout(): void { /* misses are the targets left */ }

  finish(i: number, at: number): TrialRecord {
    const complete = this.found.size >= this.total;
    const ok = complete && this.errors <= 1;
    const rec: TrialRecord = {
      i, level: this.level, ok, rt: complete ? this.rt : null, taps: this.taps, errors: this.errors, n: this.total, done: this.found.size, at,
      ...(complete ? {} : { timeout: true }),
    };
    if (!this.fixed) this.stairs.push(ok);
    return rec;
  }
}
