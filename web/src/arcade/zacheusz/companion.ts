/**
 * Mela, the neighbour's goat who follows Zacchaeus everywhere: Zacheusz's talking companion.  Her
 * running jokes: every goose and goat he bonks is a relative of hers ("that was my cousin… he had it
 * coming"), she eats whatever is not nailed down (awnings, figs, the tax ledger), and she has
 * opinions about his height ("not short — compact").  She says short lines in a drawn bubble — one
 * at a time, 2–4 s each, never over a telegraph or the runner's banner — at the opening, a block's
 * start, a good push (the road visibly growing), the road running out, a rest, a near miss, a big
 * moment (a special set, the top of the palm), a bonk, a fall and its bubble, the pause stone, the
 * crowd's street and the sycamore, a new level, and the ending.  A session never repeats a line:
 * when a moment's variants are spent she keeps quiet.
 *
 * Pure (no DOM, no canvas): the sim owns her, the view draws `current`.
 */
import { t, type Key } from './i18n';

export type Moment =
  | 'first' | 'open' | 'push' | 'blind' | 'rest' | 'good' | 'small' | 'near' | 'big' | 'bonk' | 'fall' | 'bubble'
  | 'pause' | 'crowd' | 'sycamore' | 'level' | 'set' | 'figs' | 'end';

/** How many variants each moment has in the catalog (say.<moment>.1 … say.<moment>.n). */
export const SAY: Readonly<Record<Moment, number>> = {
  first: 3, open: 4, push: 4, blind: 3, rest: 4, good: 4, small: 3, near: 3, big: 4, bonk: 6, fall: 3, bubble: 3,
  pause: 3, crowd: 3, sycamore: 3, level: 4, set: 3, figs: 3, end: 4,
};

export interface Line { moment: Moment; text: string; t: number; dur: number }

/** A line's time on screen: 2–4 s by its length. */
export const lineSec = (text: string): number => Math.max(2, Math.min(4, 1.4 + text.length * 0.032));

export class Companion {
  current: Line | null = null;
  private readonly queue: { moment: Moment; prio: number; until: number }[] = [];
  private readonly used = new Set<string>();
  private clock = 0;
  private since = 99;
  readonly said: Line[] = [];

  constructor(private readonly rng: () => number) {}

  /** Ask her to say a moment's line: it waits up to `wait` s for a quiet moment. */
  say(moment: Moment, prio = 1, wait = 4): void {
    if (this.queue.some(q => q.moment === moment)) return;
    this.queue.push({ moment, prio, until: this.clock + wait });
    this.queue.sort((a, b) => b.prio - a.prio);
    if (this.queue.length > 4) this.queue.length = 4;
  }

  clear(): void { this.queue.length = 0; }

  hush(): void {
    if (this.current) this.current.dur = Math.min(this.current.dur, this.current.t + 0.25);
  }

  update(dt: number, quiet: boolean): void {
    this.clock += dt;
    if (this.current) {
      this.current.t += dt;
      if (quiet) this.hush();
      if (this.current.t >= this.current.dur) {
        this.current = null;
        this.since = 0;
      }
    } else this.since += dt;
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.clock > this.queue[i].until) this.queue.splice(i, 1);
    const p = this.queue[0];
    if (!this.current && p && !quiet && this.since >= (p.prio >= 2 ? 0.5 : 2.5)) {
      this.queue.shift();
      const text = this.pick(p.moment);
      if (text) {
        const line = { moment: p.moment, text, t: 0, dur: lineSec(text) };
        this.current = line;
        this.said.push(line);
      }
    }
  }

  private pick(m: Moment): string | null {
    const n = SAY[m];
    const free: number[] = [];
    for (let i = 1; i <= n; i++) if (!this.used.has(`${m}.${i}`)) free.push(i);
    if (!free.length) return null;
    const i = free[Math.floor(this.rng() * free.length) % free.length];
    this.used.add(`${m}.${i}`);
    return t(`say.${m}.${i}` as Key);
  }
}
