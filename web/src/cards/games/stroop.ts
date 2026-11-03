/**
 * **Bez koloru** — "ignore the colour" (cards 20 and 32; src/cards/DESIGN.md §4.4).
 *
 * The board shows a number on a coloured tile; the pad has one button per number, each in a
 * colour of its own.  The answer is the number, whatever the tile's colour says.  When the tile
 * wears the colour of the right button the trial is *congruent*, when it wears another button's
 * colour it is *incongruent* (the colour pulls toward the wrong button), and a colour no button has
 * is *neutral*.  The difference between incongruent and congruent reaction times is the Stroop
 * interference: how much it costs to hold back an automatic response — one of the most studied
 * measures of inhibitory control.  It shrinks with practice, which is what the progress chart shows.
 */
import type { PadLayout } from '../duo/protocol';
import type { ColorId } from '../palette';
import { Staircase } from './adaptive';
import { type EngineOptions, type GameEngine, type Legend, type TapIn, type TapOut, type TrialRecord, type TrialSpec } from './types';

interface StroopLevel { n: 3 | 4; incongruent: number; neutral: number; deadlineMs: number }

export const STROOP_LEVELS: StroopLevel[] = [
  { n: 3, incongruent: 0.34, neutral: 0.33, deadlineMs: 2400 },
  { n: 3, incongruent: 0.5, neutral: 0.2, deadlineMs: 2000 },
  { n: 3, incongruent: 0.66, neutral: 0.1, deadlineMs: 1600 },
  { n: 4, incongruent: 0.5, neutral: 0.2, deadlineMs: 2000 },
  { n: 4, incongruent: 0.66, neutral: 0.1, deadlineMs: 1500 },
];

/** The buttons' colours: 1 coral, 2 teal, 3 navy, 4 yellow; tiles that belong to no button: purple, peach. */
const BUTTON: ColorId[] = ['coral', 'teal', 'navy', 'yellow'];
const NEUTRAL: ColorId[] = ['purple', 'peach'];

export class StroopEngine implements GameEngine {
  readonly id = 'stroop' as const;
  readonly maxLevel = STROOP_LEVELS.length;
  private readonly stairs: Staircase;
  private readonly rng: () => number;
  private readonly fixed: boolean;
  private num = 1;
  private cong: 0 | 1 | 2 = 0;
  private color: ColorId = 'coral';
  private resp: string | undefined;
  private ok = false;
  private rt: number | null = null;
  private answered = false;
  private last = 0;

  constructor(opts: EngineOptions) {
    this.rng = opts.rng;
    this.fixed = !!opts.fixed;
    this.stairs = new Staircase(opts.level, 1, this.maxLevel);
  }

  get level(): number { return this.stairs.level; }
  private get cfg(): StroopLevel { return STROOP_LEVELS[this.stairs.level - 1]; }

  layout(): PadLayout {
    const n = this.cfg.n;
    return { panels: [{ arrange: 'grid', cols: n, items: BUTTON.slice(0, n).map((c, i) => ({ id: String(i + 1), label: String(i + 1), color: c })) }] };
  }

  /** The rule is the instruction itself: answer the number. */
  rule(): Legend | null { return null; }

  start(): TrialSpec {
    const { n, incongruent, neutral, deadlineMs } = this.cfg;
    let num = 1 + Math.floor(this.rng() * n);
    if (num === this.last && this.rng() < 0.6) num = 1 + (num % n);   // fewer repeats: a repeat is answered faster
    this.last = num;
    const u = this.rng();
    this.cong = u < incongruent ? 1 : u < incongruent + neutral ? 2 : 0;
    if (this.cong === 0) this.color = BUTTON[num - 1];
    else if (this.cong === 2) this.color = NEUTRAL[Math.floor(this.rng() * NEUTRAL.length)];
    else {
      const others = BUTTON.slice(0, n).filter((_, i) => i !== num - 1);
      this.color = others[Math.floor(this.rng() * others.length)];
    }
    this.num = num;
    this.ok = false;
    this.rt = null;
    this.resp = undefined;
    this.answered = false;
    return { stim: { kind: 'item', item: { id: String(num), label: String(num), color: this.color } }, legend: null, deadlineMs };
  }

  tap(t: TapIn): TapOut {
    if (this.answered) return { ok: null, done: false };
    this.answered = true;
    this.resp = t.item;
    this.ok = t.item === String(this.num);
    if (this.ok) this.rt = t.t;
    return { ok: this.ok, done: true };
  }

  timeout(): void { /* recorded as not answered */ }

  finish(i: number, at: number): TrialRecord {
    const rec: TrialRecord = {
      i, level: this.level, ok: this.ok, rt: this.rt, taps: this.answered ? 1 : 0, errors: this.answered && !this.ok ? 1 : 0,
      cue: `${this.num}:${this.color}`, resp: this.resp, cong: this.cong, at, ...(this.answered ? {} : { timeout: true }),
    };
    if (!this.fixed) this.stairs.push(this.ok);
    return rec;
  }
}
