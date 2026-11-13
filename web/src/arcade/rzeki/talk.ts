/**
 * The narrator's caption, without the canvas: one line at a time, 2–4 s by its length, a pause between two,
 * never while a telegraph, the runner's block banner, a story card or a coach mark is on screen (a line on
 * screen when one comes is cut), and no line said twice in a session until its moment has used them all.
 * Moments ask with a priority and a shelf life; the most important one still fresh is said when the way is
 * clear.  The narrator is quiet by design: the prayer is the voice of this game.
 */
import { clamp } from '../kit/juice';
import type { Moment } from './content';
import { RULES } from './rules';

export interface Line { moment: Moment; text: string; t: number; dur: number }

interface Ask { moment: Moment; pri: number; until: number; seq: number }

export class Talk {
  line: Line | null = null;
  private gap = 0;
  private now = 0;
  private seq = 0;
  private readonly queue: Ask[] = [];
  /** the variants each moment still has to say this session (shuffled) */
  private readonly left = new Map<Moment, number[]>();
  /** every line said this session, in order (the tests read it) */
  readonly said: string[] = [];

  constructor(private readonly lines: (m: Moment) => readonly string[], private readonly rng: () => number) {}

  /** Ask for a line: `pri` orders the queue (higher first), `ttl` is how long (s) it stays worth saying. */
  ask(moment: Moment, pri = 1, ttl = 4): void {
    const i = this.queue.findIndex(a => a.moment === moment);
    if (i >= 0) this.queue.splice(i, 1);
    this.queue.push({ moment, pri, until: this.now + ttl, seq: this.seq++ });
    if (this.queue.length > 4) {
      this.queue.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
      this.queue.length = 4;
    }
  }

  /** Forget what was asked. */
  clear(): void { this.queue.length = 0; }

  /** A frame: the line ages, something on screen cuts it, and the best fresh ask is said when the way is clear. */
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
    if (!text) return;
    this.line = { moment: a.moment, text, t: 0, dur: clamp(RULES.talkMin + text.length / 30, RULES.talkMin, RULES.talkMax) };
    this.said.push(text);
  }

  /** The next unused variant of a moment (a new shuffle once all were said). */
  private pick(m: Moment): string {
    const all = this.lines(m);
    if (!all.length) return '';
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
