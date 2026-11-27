/**
 * Złota passa's narrator, without the canvas: one short warm line at a time, long enough to read (rules.ts `readTime`:
 * 2.5 s + 70 ms a character, at least 4.5 s), a pause between two, and no variant said twice in a session until its
 * moment has used them all.  Moments ask with a priority and a shelf life; the most important one still fresh is said
 * when the way is clear.  A line may also be given as it is (`say`: a run of wins, the streak's day).
 */
import type { Say } from './content';
import { linesOf } from './i18n';
import { RULES, readTime } from './rules';

export interface Line { what: Say | 'given'; text: string; t: number; dur: number }

interface Ask { what: Say | 'given'; text?: string; pri: number; until: number; seq: number }

export class Talk {
  line: Line | null = null;
  private gap = 0;
  private now = 0;
  private seq = 0;
  private readonly queue: Ask[] = [];
  private readonly left = new Map<Say, number[]>();
  /** every line said this session, in order (the tests read it) */
  readonly said: string[] = [];

  constructor(private readonly rng: () => number, private readonly lines: (w: Say) => readonly string[] = linesOf) {}

  ask(what: Say, pri = 1, ttl = 4): void {
    const i = this.queue.findIndex(a => a.what === what);
    if (i >= 0) this.queue.splice(i, 1);
    this.push({ what, pri, until: this.now + ttl, seq: this.seq++ });
  }

  /** A line given as it is. */
  say(text: string, pri = 2, ttl = 5): void {
    if (!text) return;
    this.push({ what: 'given', text, pri, until: this.now + ttl, seq: this.seq++ });
  }

  private push(a: Ask): void {
    this.queue.push(a);
    if (this.queue.length > 4) {
      this.queue.sort((x, y) => y.pri - x.pri || x.seq - y.seq);
      this.queue.length = 4;
    }
  }

  /** Quiet now: the line on screen ends and nothing waiting is said. */
  hush(): void {
    if (this.line) {
      this.line = null;
      this.gap = RULES.talkGap * 0.5;
    }
    this.queue.length = 0;
  }

  update(dt: number, now: number, blocked: boolean): void {
    this.now = now;
    if (this.line) {
      this.line.t += dt;
      if (this.line.t >= this.line.dur) {
        this.line = null;
        this.gap = RULES.talkGap;
      }
    } else this.gap = Math.max(0, this.gap - dt);
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].until < now) this.queue.splice(i, 1);
    if (this.line || blocked || this.gap > 0 || !this.queue.length) return;
    this.queue.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
    const a = this.queue.shift()!;
    const text = a.text ?? (a.what === 'given' ? '' : this.pick(a.what));
    if (!text) return;
    this.line = { what: a.what, text, t: 0, dur: readTime(text) };
    this.said.push(text);
  }

  private pick(w: Say): string {
    const all = this.lines(w);
    if (!all.length) return '';
    let left = this.left.get(w);
    if (!left || !left.length) {
      left = all.map((_, i) => i);
      for (let i = left.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [left[i], left[j]] = [left[j], left[i]];
      }
      this.left.set(w, left);
    }
    return all[left.shift()!];
  }
}
