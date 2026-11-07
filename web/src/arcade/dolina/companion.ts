/**
 * Ćma, the moth who loves the lamp a little too much: Dolina's talking companion (DESIGN §9.2).  She
 * rides on the pilgrim's hood, and when he jumps a second time in the air she grabs the hood and flaps
 * (the double jump).  She says short lines in a speech bubble — one at a time, 2–4 s each, never over
 * a telegraph or the runner's block banner — at the session's opening, a block's start, a good push
 * (the lamp visibly growing), a dim lamp (she sulks, warmly), a calm meadow, a near miss, a big
 * moment, the first double jump, a stair built (or too short), a climb by hand, a pit, a lamb freed,
 * a high gate, the tide close behind and its catch, a guardian, its anger and its fall, a new era, a
 * fall, low oil, a level's way out and the ending.  Each moment has several variants and a session
 * never repeats one: when a moment's variants are spent she keeps quiet.
 *
 * Pure (no DOM, no canvas): the sim owns her, the view draws `current`.
 */
import type { EraId, GuardId } from './content';
import { t, type Key } from './i18n';

export type Moment =
  | 'first' | 'open' | 'push' | 'blind' | 'rest' | 'good' | 'small' | 'calm' | 'near' | 'big' | 'close'
  | 'double' | 'stairs' | 'short' | 'climb' | 'pit' | 'lamb' | 'gate' | 'tide' | 'caught' | 'level'
  | `guard.${GuardId}` | 'angry' | 'beaten' | `era.${EraId}` | 'fall' | 'oil' | 'end';

/** How many variants each moment has in the catalog (say.<moment>.1 … say.<moment>.n). */
export const SAY: Readonly<Record<Moment, number>> = {
  first: 3, open: 4, push: 4, blind: 3, rest: 4, good: 4, small: 3, calm: 3, near: 3, big: 4, close: 3,
  double: 3, stairs: 3, short: 3, climb: 3, pit: 3, lamb: 4, gate: 3, tide: 3, caught: 3, level: 4,
  'guard.wieza': 3, 'guard.rycerz': 3, 'guard.ekran': 3, angry: 3, beaten: 4,
  'era.babel': 3, 'era.twierdza': 3, 'era.miasto': 3, fall: 3, oil: 3, end: 4,
};

export interface Line { moment: Moment; text: string; t: number; dur: number }

/** A line's time on screen: 2–4 s by its length. */
export const lineSec = (text: string): number => Math.max(2, Math.min(4, 1.4 + text.length * 0.032));

export class Companion {
  current: Line | null = null;
  private readonly queue: { moment: Moment; prio: number; until: number }[] = [];
  private readonly used = new Set<string>();
  private clock = 0;
  /** seconds since the last line ended */
  private since = 99;
  /** lines spoken this session (for the tests and the summary) */
  readonly said: Line[] = [];

  constructor(private readonly rng: () => number) {}

  /**
   * Ask her to say a moment's line: it waits up to `wait` s for a quiet moment (no telegraph, no
   * banner, the last line done); a waiting line of higher priority is not replaced.
   */
  say(moment: Moment, prio = 1, wait = 4): void {
    if (this.queue.some(q => q.moment === moment)) return;
    this.queue.push({ moment, prio, until: this.clock + wait });
    // the most important first; at most four wait
    this.queue.sort((a, b) => b.prio - a.prio);
    if (this.queue.length > 4) this.queue.length = 4;
  }

  /** Forget the lines waiting (a new start). */
  clear(): void { this.queue.length = 0; }

  /** Cut the line on screen short (a telegraph or a banner is coming). */
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

  /** An unused variant of the moment, or null when all were said this session. */
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
