/**
 * Memory games (src/cards/DESIGN.md §4.6).
 *
 * * **Powtórz pasek** — copy the strip (cards 04, 09, 12).  The board shows a strip of colours one
 *   by one, the player taps them back in order on the pad's ring.  The strip grows after every
 *   success and shrinks after two failures in a row, so the session finds the player's span: how
 *   much they can hold in working memory (about 5–7 items for most adults, Miller's "seven, plus
 *   or minus two").  From a span of six, every third strip is to be tapped back from the end.
 * * **Kod kolorów** — the colour code (card 29).  The board gives a number code, "1-5-7-8", and the
 *   key of numbers to colours; the pad has the eight colours on a wheel that is dealt anew for
 *   every code, so the hand cannot learn positions — each digit is looked up, held and found.
 */
import type { PadItem, PadLayout } from '../duo/protocol';
import type { ColorId } from '../palette';
import { SpanRule, Staircase } from './adaptive';
import { dot, shuffled, type EngineOptions, type GameEngine, type Legend, type TapIn, type TapOut, type TrialRecord, type TrialSpec } from './types';

// ── Powtórz pasek ──────────────────────────────────────────────────

/** Card 09's six colours, around the ring in this order. */
const RING: ColorId[] = ['navy', 'coral', 'purple', 'peach', 'teal', 'yellow'];
export const SPAN_MIN = 2;
export const SPAN_MAX = 9;
/** How long each colour of the strip is lit, and the gap after it (ms). */
export const SHOW_MS = 650;
export const GAP_MS = 250;

export class SequenceEngine implements GameEngine {
  readonly id = 'sekwencja' as const;
  readonly maxLevel = SPAN_MAX;
  private readonly span: SpanRule;
  private readonly rng: () => number;
  private readonly fixed: boolean;
  private strip: ColorId[] = [];
  private reverse = false;
  private pos = 0;
  private ok = false;
  private failed = false;
  private rt: number | null = null;
  private taps = 0;
  private count = 0;

  constructor(opts: EngineOptions) {
    this.rng = opts.rng;
    this.fixed = !!opts.fixed;
    this.span = new SpanRule(Math.max(3, opts.level), SPAN_MIN, SPAN_MAX);
  }

  /** The level is the strip's length. */
  get level(): number { return this.span.level; }

  layout(): PadLayout {
    return { panels: [{ arrange: 'ring', items: RING.map(c => dot(c)) }] };
  }

  rule(): Legend | null { return null; }

  start(): TrialSpec {
    const n = this.span.level;
    const strip: ColorId[] = [];
    for (let k = 0; k < n; k++) {
      let c: ColorId;
      do c = RING[Math.floor(this.rng() * RING.length)];
      while (strip.length && c === strip[strip.length - 1]);   // no colour twice in a row: it would look like one
      strip.push(c);
    }
    this.strip = strip;
    this.count++;
    this.reverse = n >= 6 && this.count % 3 === 0;
    this.pos = 0;
    this.ok = false;
    this.failed = false;
    this.rt = null;
    this.taps = 0;
    const items: PadItem[] = strip.map((c, k) => dot(c, `s${k}`));
    const frames: { at: number; stim: TrialSpec['stim'] }[] = [];
    for (let k = 0; k < n; k++) {
      frames.push({ at: k * (SHOW_MS + GAP_MS), stim: { kind: 'strip', items, lit: k, shown: k + 1, reverse: this.reverse } });
      frames.push({ at: k * (SHOW_MS + GAP_MS) + SHOW_MS, stim: { kind: 'strip', items, lit: null, shown: k + 1, reverse: this.reverse } });
    }
    const inputAt = n * (SHOW_MS + GAP_MS);
    return {
      stim: { kind: 'strip', items, lit: null, shown: 0, reverse: this.reverse }, frames, inputAt,
      legend: null, deadlineMs: 2000 + n * 1500, cue: this.reverse ? 'reverse' : null,
    };
  }

  private want(): ColorId { return this.strip[this.reverse ? this.strip.length - 1 - this.pos : this.pos]; }

  tap(t: TapIn): TapOut {
    if (this.ok || this.failed) return { ok: null, done: false };
    this.taps++;
    if (t.item !== this.want()) {
      this.failed = true;
      return { ok: false, done: true };
    }
    this.pos++;
    const items: PadItem[] = this.strip.map((c, k) => dot(c, `s${k}`));
    if (this.pos >= this.strip.length) {
      this.ok = true;
      this.rt = t.t;
      return { ok: true, done: true, stim: { kind: 'strip', items, lit: null, shown: this.strip.length, reverse: this.reverse } };
    }
    return { ok: true, done: false };
  }

  timeout(): void { /* not completed */ }

  finish(i: number, at: number): TrialRecord {
    const rec: TrialRecord = {
      i, level: this.span.level, ok: this.ok, rt: this.rt, taps: this.taps, errors: this.failed ? 1 : 0,
      n: this.strip.length, done: this.pos, cue: this.strip.join(','), at,
      ...(this.reverse ? { resp: 'reverse' } : {}), ...(!this.ok && !this.failed ? { timeout: true } : {}),
    };
    if (!this.fixed) this.span.push(this.ok);
    return rec;
  }
}

// ── Kod kolorów ────────────────────────────────────────────────────

/** Card 29's key: 1 coral, 2 peach, 3 yellow, 4 teal, 5 navy, 6 purple, 7 magenta, 8 ink. */
export const CODE_KEY: ColorId[] = ['coral', 'peach', 'yellow', 'teal', 'navy', 'purple', 'magenta', 'ink'];

interface CodeLevel { len: number; legend: boolean; deadlinePerDigit: number }
export const CODE_LEVELS: CodeLevel[] = [
  { len: 3, legend: true, deadlinePerDigit: 3000 },
  { len: 4, legend: true, deadlinePerDigit: 2800 },
  { len: 5, legend: true, deadlinePerDigit: 2600 },
  { len: 6, legend: true, deadlinePerDigit: 2400 },
  { len: 7, legend: true, deadlinePerDigit: 2200 },   // the card's own length
  { len: 7, legend: false, deadlinePerDigit: 2200 },  // the key from memory
];

export class CodeEngine implements GameEngine {
  readonly id = 'kod' as const;
  readonly maxLevel = CODE_LEVELS.length;
  private readonly stairs: Staircase;
  private readonly rng: () => number;
  private readonly fixed: boolean;
  private digits: number[] = [];
  private wheel: ColorId[] = CODE_KEY;
  private pos = 0;
  private ok = false;
  private failed = false;
  private rt: number | null = null;
  private taps = 0;

  constructor(opts: EngineOptions) {
    this.rng = opts.rng;
    this.fixed = !!opts.fixed;
    this.stairs = new Staircase(opts.level, 1, this.maxLevel, 2);
  }

  get level(): number { return this.stairs.level; }
  private get cfg(): CodeLevel { return CODE_LEVELS[this.stairs.level - 1]; }

  layout(): PadLayout {
    return { panels: [{ arrange: 'ring', items: this.wheel.map(c => dot(c)) }] };
  }

  rule(): Legend {
    return { rows: CODE_KEY.map((c, k) => ({ cue: { id: String(k + 1), label: String(k + 1) }, answer: dot(c) })) };
  }

  start(): TrialSpec {
    const { len, legend, deadlinePerDigit } = this.cfg;
    // the card's codes use each digit at most once
    this.digits = shuffled(this.rng, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, len);
    this.wheel = shuffled(this.rng, CODE_KEY);
    this.pos = 0;
    this.ok = false;
    this.failed = false;
    this.rt = null;
    this.taps = 0;
    return { stim: { kind: 'code', digits: this.digits, pos: 0 }, layout: this.layout(), legend: legend ? this.rule() : null,
             deadlineMs: len * deadlinePerDigit };
  }

  tap(t: TapIn): TapOut {
    if (this.ok || this.failed) return { ok: null, done: false };
    this.taps++;
    if (t.item !== CODE_KEY[this.digits[this.pos] - 1]) {
      this.failed = true;
      return { ok: false, done: true };
    }
    this.pos++;
    const stim = { kind: 'code' as const, digits: this.digits, pos: this.pos };
    if (this.pos >= this.digits.length) {
      this.ok = true;
      this.rt = t.t;
      return { ok: true, done: true, stim };
    }
    return { ok: true, done: false, stim };
  }

  timeout(): void { /* not completed */ }

  finish(i: number, at: number): TrialRecord {
    const rec: TrialRecord = {
      i, level: this.level, ok: this.ok, rt: this.rt, taps: this.taps, errors: this.failed ? 1 : 0,
      n: this.digits.length, done: this.pos, cue: this.digits.join(''), at, ...(!this.ok && !this.failed ? { timeout: true } : {}),
    };
    if (!this.fixed) this.stairs.push(this.ok);
    return rec;
  }
}
