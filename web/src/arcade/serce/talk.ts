/**
 * The narrator's caption, without the canvas (Rzeki's pattern): one line at a time, long enough to read it twice
 * (rules.ts `readTime`), a pause between two, never while a telegraph, the runner's block banner, a story card or a
 * coach mark is on screen (a line on screen when one comes is cut), and no line said twice in a session until its
 * moment has used them all.  The narrator is quiet by design: the heart word and the blessings are this game's voice.
 */
import { RULES, readTime } from './rules';

export type Moment =
  | 'open' | 'resume' | 'descend' | 'settle' | 'heart' | 'field' | 'whole' | 'ring1' | 'ring2' | 'ring3' | 'ring4' | 'ring5'
  | 'sun' | 'pervade' | 'back' | 'home' | 'more' | 'wait' | 'good' | 'nosignal' | 'valve' | 'end'
  // round 16: abiding in a stage whose light is met early (a circle's own lines), the close before the way is whole
  | 'abide' | 'abideRing' | 'close';

export interface Line { moment: Moment; text: string; t: number; dur: number }

interface Ask { moment: Moment; pri: number; until: number; seq: number }

export class Talk {
  line: Line | null = null;
  private gap = 0;
  private now = 0;
  private seq = 0;
  private readonly queue: Ask[] = [];
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

  /** The way moved on: forget the asks of these moments and cut a line of one of them that is on screen. */
  drop(moments: readonly Moment[]): void {
    for (let i = this.queue.length - 1; i >= 0; i--) if (moments.includes(this.queue[i].moment)) this.queue.splice(i, 1);
    if (this.line && moments.includes(this.line.moment)) {
      this.line = null;
      this.gap = RULES.talkGap / 2;
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
    return all[left.shift()!];
  }
}
