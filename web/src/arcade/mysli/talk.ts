/**
 * The narrator's caption, without the canvas (the pattern of Drzewo's talk.ts): one line at a time, long enough to
 * read it twice (rules.ts `readTime`), a pause between two, never while a telegraph, the runner's banner, a story
 * card, the finale's row or a coach mark is on screen (a line on screen then is cut), no line twice in a session
 * until its moment has used them all.  Moments ask with a priority and a shelf life; the most important fresh one is
 * said when the way is clear.  Quiet by design: the point of light and the thoughts carry this game.
 */
import type { Moment } from './content';
import { RULES, readTime } from './rules';

export interface Line { moment: Moment; text: string; t: number; dur: number }

interface Ask { moment: Moment; pri: number; until: number; seq: number }

export class Talk {
  line: Line | null = null;
  private gap = 0;
  private now = 0;
  private seq = 0;
  private readonly queue: Ask[] = [];
  private readonly left = new Map<Moment, number[]>();
  /** when each line was last said (only with `fresh`) */
  private readonly saidAt = new Map<string, number>();
  /** every line said this session, in order (the tests read it) */
  readonly said: string[] = [];

  /**
   * `fresh` (round 24): in a session over 30 minutes a line comes back only this long (s) after it was said — till then
   * its moment passes in silence; 0 (every shorter session): as before
   */
  constructor(private readonly lines: (m: Moment) => readonly string[], private readonly rng: () => number, private readonly fresh = 0) {}

  ask(moment: Moment, pri = 1, ttl = 4): void {
    const i = this.queue.findIndex(a => a.moment === moment);
    if (i >= 0) this.queue.splice(i, 1);
    this.queue.push({ moment, pri, until: this.now + ttl, seq: this.seq++ });
    if (this.queue.length > 4) {
      this.queue.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
      this.queue.length = 4;
    }
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
    const text = this.pick(a.moment);
    if (!text) return;
    this.line = { moment: a.moment, text, t: 0, dur: readTime(text) };
    this.said.push(text);
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
    if (this.fresh > 0) {
      const k = left.findIndex(i => this.now - (this.saidAt.get(all[i]) ?? -Infinity) >= this.fresh);
      if (k < 0) return '';
      const [i] = left.splice(k, 1);
      this.saidAt.set(all[i], this.now);
      return all[i];
    }
    return all[left.shift()!];
  }
}
