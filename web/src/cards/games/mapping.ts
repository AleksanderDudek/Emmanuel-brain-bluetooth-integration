/**
 * Rule games (src/cards/DESIGN.md §4.3): the board shows a cue, the pad has the answers, and a
 * rule maps one to the other.  Four games share this engine:
 *
 * * **Kolorowe palce** (cards 02, 07, 14) — the cue is a colour, the answer its finger or disc:
 *   choice reaction time with 3 to 6 choices (Hick's law: each doubling of choices costs time).
 * * **Dłoń, pięść, kant** (cards 03, 13, 21, 25, 30) — a colour means a gesture: palm, fist, the
 *   edge of the hand (Luria's fist–edge–palm), later five gestures, counted repetitions (card 13)
 *   and a rule that changes mid-game.
 * * **Znaki dłoni** (cards 18, 27, 31) — a colour, then a shape, means a hand sign.
 * * **Ćwiartki** (card 24) — a colour means a quarter of the crosshair.
 *
 * Every game starts with the rule on the board; higher levels play it from memory, faster.
 */
import type { GlyphId } from '../art/glyphs';
import type { Arrange, PadItem, PadLayout } from '../duo/protocol';
import type { ColorId, ShapeId } from '../palette';
import { Staircase } from './adaptive';
import { dot, pickCue, shuffled, type EngineOptions, type GameEngine, type GameId, type Legend, type TapIn, type TapOut,
         type TrialRecord, type TrialSpec } from './types';

export interface MapLevel {
  /** the cues the board can show */
  cues: PadItem[];
  /** the pad's buttons */
  answers: PadItem[];
  /** cue id → answer id */
  map: Record<string, string>;
  arrange: Arrange;
  cols?: number;
  /** the rule stays on the board */
  legend: boolean;
  /** the pad's buttons carry their cue's colour as a small hint (the gentlest level) */
  hint?: boolean;
  deadlineMs: number;
  /** card 13: the cue comes 1–3 times; the answer is tapped as many times */
  counts?: boolean;
  /** the rule is dealt anew every this many trials (shown on the board for the first trial after) */
  reshuffle?: number;
}

const glyph = (g: GlyphId): PadItem => ({ id: g, glyph: g });
const shape = (s: ShapeId): PadItem => ({ id: s, shape: s, color: 'ink' });

/** A map from parallel lists. */
const zipMap = (cues: readonly string[], answers: readonly string[]): Record<string, string> =>
  Object.fromEntries(cues.map((c, i) => [c, answers[i]]));

// ── the four games' levels ─────────────────────────────────────────

/** Card 07's hand: thumb teal, index coral, middle navy, ring yellow, little finger purple. */
const HAND: ColorId[] = ['teal', 'coral', 'navy', 'yellow', 'purple'];

export const PALCE: MapLevel[] = (() => {
  const set = (colors: ColorId[], arrange: Arrange, deadlineMs: number, cols?: number): MapLevel => ({
    cues: colors.map(c => dot(c)), answers: colors.map(c => dot(c)), map: zipMap(colors, colors), arrange, cols, legend: false, deadlineMs,
  });
  return [
    set(['coral', 'purple', 'navy'], 'grid', 2200, 3),                   // card 02: three hands
    set(['coral', 'purple', 'navy', 'yellow'], 'grid', 2000, 2),
    set(HAND, 'hand', 2000),                                             // card 07: five fingers
    set(HAND, 'hand', 1500),
    set(['purple', 'teal', 'coral', 'yellow', 'navy', 'peach'], 'grid', 1500, 3),   // card 14: six discs
    set(['purple', 'teal', 'coral', 'yellow', 'navy', 'peach'], 'grid', 1100, 3),
  ];
})();

/** Card 21's rule: the magenta hand = palm, the navy disc = fist, the yellow pill = edge, two teal dots = two fingertips, the peach bar = two fingers flat. */
const GESTURE_COLORS: ColorId[] = ['magenta', 'navy', 'yellow', 'teal', 'peach'];
const GESTURES: GlyphId[] = ['palm', 'fist', 'edge', 'twoTips', 'twoFlat'];

export const GESTY: MapLevel[] = (() => {
  const set = (n: 3 | 5, extra: Partial<MapLevel>): MapLevel => ({
    cues: GESTURE_COLORS.slice(0, n).map(c => dot(c)), answers: GESTURES.slice(0, n).map(glyph),
    map: zipMap(GESTURE_COLORS.slice(0, n), GESTURES.slice(0, n)), arrange: 'grid', cols: n, legend: true, deadlineMs: 2400, ...extra,
  });
  return [
    set(3, { hint: true }),                                 // card 03: the rule on the board, the buttons hint at it
    set(3, { deadlineMs: 2000 }),
    set(3, { legend: false, deadlineMs: 1800 }),            // from memory
    set(3, { legend: false, counts: true, deadlineMs: 3200 }),   // card 13: count the dots
    set(5, { deadlineMs: 2400 }),                           // card 21: five gestures
    set(5, { legend: false, deadlineMs: 2000 }),
    set(3, { legend: false, reshuffle: 8, deadlineMs: 2000 }),  // the rule changes: flexibility
  ];
})();

/** Card 18: coral OK, navy V, teal fist, yellow crossed fingers. */
const SIGNS_A: [ColorId, GlyphId][] = [['coral', 'okSign'], ['navy', 'vSign'], ['teal', 'fist'], ['yellow', 'crossed']];
/** Card 27: coral V, peach pinch, yellow fist, teal crossed, navy thumb up, purple OK. */
const SIGNS_B: [ColorId, GlyphId][] = [['coral', 'vSign'], ['peach', 'pinch'], ['yellow', 'fist'], ['teal', 'crossed'], ['navy', 'thumbUp'], ['purple', 'okSign']];
/** Card 31: circle OK, triangle thumb up, heart open palm, star three fingers, square crossed, hexagon fist. */
const SIGNS_C: [ShapeId, GlyphId][] = [['circle', 'okSign'], ['triangle', 'thumbUp'], ['heart', 'spread'], ['star', 'threeUp'], ['square', 'crossed'], ['hexagon', 'fist']];

export const ZNAKI: MapLevel[] = (() => {
  const byColor = (pairs: [ColorId, GlyphId][], legend: boolean, deadlineMs: number): MapLevel => ({
    cues: pairs.map(([c]) => dot(c)), answers: pairs.map(([, g]) => glyph(g)), map: Object.fromEntries(pairs),
    arrange: 'grid', cols: pairs.length > 4 ? 3 : 2, legend, deadlineMs,
  });
  const byShape = (legend: boolean, deadlineMs: number): MapLevel => ({
    cues: SIGNS_C.map(([s]) => shape(s)), answers: SIGNS_C.map(([, g]) => glyph(g)), map: Object.fromEntries(SIGNS_C),
    arrange: 'grid', cols: 3, legend, deadlineMs,
  });
  return [
    byColor(SIGNS_A, true, 2600), byColor(SIGNS_A, false, 2200),
    byColor(SIGNS_B, true, 2800), byColor(SIGNS_B, false, 2400),
    byShape(true, 2800), byShape(false, 2400),
  ];
})();

/** Card 24's key: teal top left, coral top right, navy bottom left, yellow bottom right. */
const QUAD_COLORS: ColorId[] = ['teal', 'coral', 'navy', 'yellow'];
const QUADS = ['tl', 'tr', 'bl', 'br'];

export const CWIARTKI: MapLevel[] = (() => {
  const set = (extra: Partial<MapLevel>): MapLevel => ({
    cues: QUAD_COLORS.map(c => ({ id: c, color: c, look: 'cross' as const })),
    answers: QUADS.map(q => ({ id: q, look: 'quarter' as const })), map: zipMap(QUAD_COLORS, QUADS), arrange: 'quad', legend: true, deadlineMs: 2200, ...extra,
  });
  return [
    set({ hint: true }), set({}), set({ legend: false, deadlineMs: 1800 }), set({ legend: false, deadlineMs: 1300 }),
    set({ legend: false, reshuffle: 8, deadlineMs: 1800 }),
  ];
})();

export const MAP_LEVELS: Readonly<Record<'palce' | 'gesty' | 'znaki' | 'cwiartki', MapLevel[]>> = {
  palce: PALCE, gesty: GESTY, znaki: ZNAKI, cwiartki: CWIARTKI,
};

// ── the engine ─────────────────────────────────────────────────────

export class MappingEngine implements GameEngine {
  readonly maxLevel: number;
  private readonly stairs: Staircase;
  private readonly rng: () => number;
  private readonly fixed: boolean;
  private map: Record<string, string>;
  private history: string[] = [];
  private cue: PadItem | null = null;
  private need = 1;
  private got = 0;
  private resp: string | undefined;
  private ok = false;
  private rt: number | null = null;
  private errors = 0;
  private taps = 0;
  private sinceShuffle = 0;
  private reshuffled = false;

  constructor(readonly id: GameId & keyof typeof MAP_LEVELS, opts: EngineOptions) {
    const levels = MAP_LEVELS[id];
    this.maxLevel = levels.length;
    this.rng = opts.rng;
    this.fixed = !!opts.fixed;
    this.stairs = new Staircase(opts.level, 1, this.maxLevel);
    this.map = { ...this.cfg.map };
  }

  get level(): number { return this.stairs.level; }
  private get cfg(): MapLevel { return MAP_LEVELS[this.id][this.stairs.level - 1]; }

  layout(): PadLayout {
    const c = this.cfg;
    const cueOf = new Map(Object.entries(this.map).map(([cue, ans]) => [ans, cue]));
    const items = c.answers.map(a => (c.hint && cueOf.has(a.id) && a.color === undefined
      ? { ...a, color: c.cues.find(q => q.id === cueOf.get(a.id))?.color } : { ...a }));
    return { panels: [{ arrange: c.arrange, items, cols: c.cols }] };
  }

  rule(): Legend | null {
    const c = this.cfg;
    // every answer is its own cue (Kolorowe palce: a colour, the same colour): there is no rule to show
    if (c.cues.every(q => this.map[q.id] === q.id)) return null;
    return { rows: c.cues.map(q => ({ cue: q, answer: c.answers.find(a => a.id === this.map[q.id])! })) };
  }

  start(): TrialSpec {
    const c = this.cfg;
    // (a new rule stays announced until a trial with it has been judged: a pause may drop the first one)
    if (c.reshuffle && !this.fixed && ++this.sinceShuffle > c.reshuffle) {
      // a new rule: the same answers dealt to the cues in another order (never the old one)
      const answers = c.cues.map(q => this.map[q.id]);
      let next = answers;
      for (let k = 0; k < 6 && next.every((a, i) => a === answers[i]); k++) next = shuffled(this.rng, answers);
      this.map = zipMap(c.cues.map(q => q.id), next);
      this.sinceShuffle = 1;
      this.reshuffled = true;
    }
    const cue = pickCue(this.rng, c.cues, this.history.map(id => c.cues.find(q => q.id === id)!).filter(Boolean));
    this.history.push(cue.id);
    if (this.history.length > 8) this.history.shift();
    this.cue = cue;
    this.need = c.counts ? 1 + Math.floor(this.rng() * 3) : 1;
    this.got = 0;
    this.ok = false;
    this.rt = null;
    this.resp = undefined;
    this.errors = 0;
    this.taps = 0;
    return {
      stim: { kind: 'item', item: cue, count: this.need > 1 || c.counts ? this.need : undefined },
      legend: c.legend || this.reshuffled ? this.rule() : null,
      deadlineMs: c.deadlineMs,
      cue: this.reshuffled ? 'switch' : null,
    };
  }

  tap(t: TapIn): TapOut {
    if (!this.cue || this.ok || this.errors) return { ok: null, done: false };
    this.taps++;
    this.resp = t.item;
    if (t.item !== this.map[this.cue.id]) {
      this.errors++;
      return { ok: false, done: true };
    }
    this.got++;
    if (this.got < this.need) return { ok: true, done: false, stim: { kind: 'item', item: this.cue, count: this.need - this.got } };
    this.ok = true;
    this.rt = t.t;
    return { ok: true, done: true };
  }

  timeout(): void { /* the record says so: not ok, no rt */ }

  finish(i: number, at: number): TrialRecord {
    const rec: TrialRecord = {
      i, level: this.stairs.level, ok: this.ok, rt: this.rt, taps: this.taps, errors: this.errors, at,
      cue: this.cue?.id, resp: this.resp, ...(this.need > 1 ? { n: this.need } : {}), ...(!this.ok && !this.errors ? { timeout: true } : {}),
    };
    if (!this.fixed) {
      const before = this.stairs.level;
      this.stairs.push(this.ok);
      if (this.stairs.level !== before) {
        this.map = { ...this.cfg.map };
        this.history = [];
        this.sinceShuffle = 0;
      }
    }
    this.cue = null;
    this.reshuffled = false;
    return rec;
  }
}
