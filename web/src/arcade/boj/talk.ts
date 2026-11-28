/**
 * Dobry bój's coach, without the canvas: one short calm line at a time, long enough to read (rules.ts `readTime`:
 * 2.5 s + 70 ms a character), a pause between two, quiet while the slow motion asks for focus (the "why" line speaks
 * there), and no variant said twice in a session until its moment has used them all.  Moments ask with a priority and
 * a shelf life; the most important one still fresh is said when the way is clear.  A line may also be given as it is
 * (`say`: the "why" of a wrong pick, repeated in the read as the lesson).
 */
import type { Moment } from './content';
import { linesOf } from './i18n';
import { RULES, readTime } from './rules';

/** how many said lines the log keeps (a session of any length) */
export const SAID_KEEP = 120;

export interface Line { moment: Moment | 'why'; text: string; t: number; dur: number }

interface Ask { moment: Moment | 'why'; text?: string; pri: number; until: number; seq: number }

export class Talk {
  line: Line | null = null;
  private gap = 0;
  private now = 0;
  private seq = 0;
  private readonly queue: Ask[] = [];
  private readonly left = new Map<Moment, number[]>();
  /** the lines said this session, in order, the last SAID_KEEP of them (the tests read it; an hour says ~400) */
  readonly said: string[] = [];

  constructor(private readonly rng: () => number, private readonly lines: (m: Moment) => readonly string[] = linesOf) {}

  ask(moment: Moment, pri = 1, ttl = 4): void {
    const i = this.queue.findIndex(a => a.moment === moment);
    if (i >= 0) this.queue.splice(i, 1);
    this.push({ moment, pri, until: this.now + ttl, seq: this.seq++ });
  }

  /** A line given as it is (the lesson of a wrong pick). */
  say(text: string, pri = 2, ttl = 6): void {
    if (!text) return;
    const i = this.queue.findIndex(a => a.moment === 'why');
    if (i >= 0) this.queue.splice(i, 1);
    this.push({ moment: 'why', text, pri, until: this.now + ttl, seq: this.seq++ });
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
      if (blocked || this.line.t >= this.line.dur) {
        this.line = null;
        this.gap = RULES.talkGap;
      }
    } else this.gap = Math.max(0, this.gap - dt);
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].until < now) this.queue.splice(i, 1);
    if (this.line || blocked || this.gap > 0 || !this.queue.length) return;
    this.queue.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
    const a = this.queue.shift()!;
    const text = a.text ?? (a.moment === 'why' ? '' : this.pick(a.moment));
    if (!text) return;
    this.line = { moment: a.moment, text, t: 0, dur: readTime(text) };
    this.said.push(text);
    if (this.said.length > SAID_KEEP) this.said.splice(0, this.said.length - SAID_KEEP);
  }

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
