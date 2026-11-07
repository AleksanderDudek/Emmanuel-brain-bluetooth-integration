/**
 * Zośka's speech bubble, without the canvas: one line at a time, 2–4 s by its length, a pause
 * between two, never while a card, the runner's block banner, a telegraph or a gust's warning is on
 * screen (a line on screen when one begins is cut), and no line said twice in a session until its
 * moment has used them all.  Moments ask with a priority and a shelf life; the most important one
 * still fresh is said when the way is clear.
 */
import { clamp } from '../kit/juice';
import { ZOSKA, type Moment } from './content';
import { RULES } from './rules';

export interface Line { moment: Moment; text: string; t: number; dur: number }

interface Ask { moment: Moment; pri: number; until: number; seq: number }

export class Talk {
  line: Line | null = null;
  private gap = 0;
  private now = 0;
  private seq = 0;
  private readonly queue: Ask[] = [];
  private readonly left = new Map<Moment, number[]>();
  private last: string | null = null;
  /** every line said this session, in order (the tests read it) */
  readonly said: string[] = [];

  constructor(private readonly rng: () => number, private readonly lines: Readonly<Record<Moment, readonly string[]>> = ZOSKA) {}

  /** Ask for a line: `pri` orders the queue (higher first), `ttl` is how long (s) it stays worth saying. */
  ask(moment: Moment, pri = 1, ttl = 4): void {
    if (!this.lines[moment]?.length) return;
    const i = this.queue.findIndex(a => a.moment === moment);
    if (i >= 0) this.queue.splice(i, 1);
    this.queue.push({ moment, pri, until: this.now + ttl, seq: this.seq++ });
    if (this.queue.length > 4) {
      this.queue.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
      this.queue.length = 4;
    }
  }

  clear(): void { this.queue.length = 0; }

  update(dt: number, now: number, blocked: boolean): void {
    this.now = now;
    if (this.line) {
      this.line.t += dt;
      if (blocked || this.line.t >= this.line.dur) {
        this.line = null;
        this.gap = RULES.talkGap;
      }
    } else this.gap = Math.max(0, this.gap - dt);
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].until < now) this.queue.splice(i, 1);
    if (this.line || blocked || this.gap > 0 || !this.queue.length) return;
    this.queue.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
    const a = this.queue.shift()!;
    const text = this.pick(a.moment);
    this.line = { moment: a.moment, text, t: 0, dur: clamp(RULES.talkMin + text.length / 32, RULES.talkMin, RULES.talkMax) };
    this.said.push(text);
    if (a.moment === 'end') this.last = text;
  }

  /** The summary's last word: the closing line she said at dawn, or one picked once (the same on every call). */
  closing(): string | null {
    if (this.last === null && this.lines.end?.length) this.last = this.pick('end');
    return this.last;
  }

  private pick(m: Moment): string {
    const all = this.lines[m];
    let left = this.left.get(m);
    if (!left || !left.length) {
      left = all.map((_, i) => i);
      for (let i = left.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [left[i], left[j]] = [left[j], left[i]];
      }
      this.left.set(m, left);
    }
    return all[left.shift()!];
  }
}
