/**
 * **Obie ręce** — both hands at once (cards 05, 10, 16, 23 and 32; src/cards/DESIGN.md §4.5).
 *
 * The pad is split: the left half for the left hand, the right half for the right.  The board
 * shows two cues at once — a tile split on the diagonal (card 10), two dots (card 05), a coloured
 * shape whose colour is one hand's answer and whose shape is the other's (card 23), a coloured
 * number (card 32) — and both hands answer together.  Besides speed and accuracy the game
 * measures the *asynchrony*: how far apart the two touches land.  Moving both hands together
 * while each does something different is the point of the cards' two-page spreads, and the gap
 * between the hands is a direct measure of how well that coordination works.
 */
import type { PadItem, PadLayout, PadPanel } from '../duo/protocol';
import type { ColorId, ShapeId } from '../palette';
import { Staircase } from './adaptive';
import { dot, pickCue, type EngineOptions, type GameEngine, type Legend, type TapIn, type TapOut, type TrialRecord, type TrialSpec } from './types';

type Kind = 'colors' | 'colorShape' | 'colorNumber';

interface BiLevel {
  kind: Kind;
  left: PadItem[];
  right: PadItem[];
  /** how the board shows the pair */
  joined: 'split' | 'apart' | 'one';
  deadlineMs: number;
  leftArrange: PadPanel['arrange'];
  rightArrange: PadPanel['arrange'];
  cols?: [number, number];
}

const dots = (cs: ColorId[], side: 'L' | 'R'): PadItem[] => cs.map(c => dot(c, `${side}:${c}`));
const shapes = (ss: ShapeId[]): PadItem[] => ss.map(s => ({ id: `R:${s}`, shape: s, color: 'ink' }));
const digits = (): PadItem[] => Array.from({ length: 9 }, (_, i) => ({ id: `R:${i + 1}`, label: String(i + 1) }));

/** Card 23's wheels: six colours for one hand, six shapes for the other. */
const WHEEL_COLORS: ColorId[] = ['yellow', 'teal', 'navy', 'purple', 'coral', 'peach'];
const WHEEL_SHAPES: ShapeId[] = ['triangle', 'circle', 'square', 'hexagon', 'star', 'heart'];
/** Card 32's colour blocks (3 × 3), row by row: red, yellow, orange / green, blue, purple / magenta, grey, teal. */
const BLOCKS: ColorId[] = ['coral', 'yellow', 'peach', 'green', 'navy', 'purple', 'magenta', 'grey', 'teal'];

export const BI_LEVELS: BiLevel[] = [
  // card 10: three hands a side, each tile = one colour of each side
  { kind: 'colors', left: dots(['yellow', 'coral', 'purple'], 'L'), right: dots(['teal', 'navy', 'peach'], 'R'), joined: 'split', deadlineMs: 3000, leftArrange: 'grid', rightArrange: 'grid', cols: [1, 1] },
  { kind: 'colors', left: dots(['yellow', 'coral', 'purple'], 'L'), right: dots(['teal', 'navy', 'peach'], 'R'), joined: 'split', deadlineMs: 2200, leftArrange: 'grid', rightArrange: 'grid', cols: [1, 1] },
  // card 05: four a side, and the sides share colours: only the side tells which hand
  { kind: 'colors', left: dots(['peach', 'navy', 'yellow', 'coral'], 'L'), right: dots(['purple', 'coral', 'peach', 'navy'], 'R'), joined: 'apart', deadlineMs: 2600, leftArrange: 'grid', rightArrange: 'grid', cols: [2, 2] },
  // card 23: the colour for the left hand, the shape for the right
  { kind: 'colorShape', left: dots(WHEEL_COLORS, 'L'), right: shapes(WHEEL_SHAPES), joined: 'one', deadlineMs: 3000, leftArrange: 'ring', rightArrange: 'ring' },
  { kind: 'colorShape', left: dots(WHEEL_COLORS, 'L'), right: shapes(WHEEL_SHAPES), joined: 'one', deadlineMs: 2300, leftArrange: 'ring', rightArrange: 'ring' },
  // card 32: the colour block for the left hand, the number on the keypad for the right
  { kind: 'colorNumber', left: dots(BLOCKS, 'L'), right: digits(), joined: 'one', deadlineMs: 3200, leftArrange: 'grid', rightArrange: 'grid', cols: [3, 3] },
];

interface Side { want: string; got: string | null; t: number | null; ok: boolean | null }

export class BimanualEngine implements GameEngine {
  readonly id = 'obie' as const;
  readonly maxLevel = BI_LEVELS.length;
  private readonly stairs: Staircase;
  private readonly rng: () => number;
  private readonly fixed: boolean;
  private sides: [Side, Side] = [this.side(''), this.side('')];
  private historyL: PadItem[] = [];
  private cueId = '';
  private taps = 0;

  constructor(opts: EngineOptions) {
    this.rng = opts.rng;
    this.fixed = !!opts.fixed;
    this.stairs = new Staircase(opts.level, 1, this.maxLevel);
  }

  private side(want: string): Side { return { want, got: null, t: null, ok: null }; }
  get level(): number { return this.stairs.level; }
  private get cfg(): BiLevel { return BI_LEVELS[this.stairs.level - 1]; }

  layout(): PadLayout {
    const c = this.cfg;
    return { panels: [
      { arrange: c.leftArrange, items: c.left.map(i => ({ ...i })), cols: c.cols?.[0], caption: 'L' },
      { arrange: c.rightArrange, items: c.right.map(i => ({ ...i })), cols: c.cols?.[1], caption: 'R' },
    ] };
  }

  rule(): Legend | null { return null; }

  start(): TrialSpec {
    const c = this.cfg;
    const l = pickCue(this.rng, c.left, this.historyL);
    this.historyL.push(l);
    if (this.historyL.length > 6) this.historyL.shift();
    const r = c.right[Math.floor(this.rng() * c.right.length)];
    this.sides = [this.side(l.id), this.side(r.id)];
    this.taps = 0;
    this.cueId = `${l.id}|${r.id}`;
    const color = l.color;
    let left: PadItem = { id: 'L', color }, right: PadItem;
    if (c.kind === 'colors') right = { id: 'R', color: r.color };
    else if (c.kind === 'colorShape') right = { id: 'R', shape: r.shape, color };
    else right = { id: 'R', label: r.label, color };
    if (c.joined === 'one') left = right;
    return { stim: { kind: 'pair', left, right, joined: c.joined }, legend: null, deadlineMs: c.deadlineMs };
  }

  tap(t: TapIn): TapOut {
    const s = this.sides[t.panel === 1 ? 1 : 0];
    if (s.got !== null || this.sides.some(x => x.ok === false)) return { ok: null, done: false };
    this.taps++;
    s.got = t.item;
    s.t = t.t;
    s.ok = t.item === s.want;
    const done = !s.ok || this.sides.every(x => x.got !== null);
    return { ok: s.ok, done };
  }

  timeout(): void { /* the record says which hand did not answer */ }

  finish(i: number, at: number): TrialRecord {
    const [L, R] = this.sides;
    const ok = L.ok === true && R.ok === true;
    const rec: TrialRecord = {
      i, level: this.level, ok, rt: ok ? Math.max(L.t!, R.t!) : null, taps: this.taps,
      errors: (L.ok === false ? 1 : 0) + (R.ok === false ? 1 : 0), cue: this.cueId, resp: `${L.got ?? ''}|${R.got ?? ''}`, at,
      ...(ok ? { async: Math.round(Math.abs(L.t! - R.t!)) } : {}),
      // a timeout only when no hand was wrong (a wrong hand ends the trial before the other answers)
      ...((L.got === null || R.got === null) && L.ok !== false && R.ok !== false ? { timeout: true } : {}),
    };
    if (!this.fixed) this.stairs.push(ok);
    return rec;
  }
}
