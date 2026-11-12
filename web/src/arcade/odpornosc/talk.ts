/**
 * Neo's and Makro's speech bubble, without the canvas: one line at a time, 2–4 s by its length, a pause
 * between two, never while a card, the runner's block banner or a telegraph is up (a line on screen when
 * one begins is cut), and no line said twice in a session until its moment has used them all.  Moments
 * ask with a priority and a shelf life; the most important one still fresh is said when the way is clear.
 */
import { clamp } from '../kit/juice';
import { speakerOf, type Moment, type Speaker } from './content';
import { RULES } from './rules';

export interface Line { moment: Moment; speaker: Speaker; text: string; t: number; dur: number }

interface Ask { moment: Moment; pri: number; until: number; seq: number }

export class Talk {
  line: Line | null = null;
  private gap = 1;
  private now = 0;
  private seq = 0;
  private readonly queue: Ask[] = [];
  private readonly left = new Map<Moment, number[]>();
  /** every line said this session, in order (the tests read it) */
  readonly said: string[] = [];

  constructor(private readonly lines: Readonly<Record<Moment, readonly string[]>>, private readonly rng: () => number) {}

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

  /** A frame: the line ages, a card or a banner cuts it, and the best fresh ask is said when the way is clear. */
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
    this.line = { moment: a.moment, speaker: speakerOf(a.moment), text, t: 0, dur: clamp(RULES.talkMin + text.length / 30, RULES.talkMin, RULES.talkMax) };
    this.said.push(text);
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
