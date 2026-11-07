/**
 * Klekot, the stork: Posłaniec's talking companion (DESIGN.md §7.3).  A fellow courier and a proud
 * professional ("in my line of work I usually deliver something else"), he circles over the road,
 * grumbles about the weight of the letters, keeps a running feud with Bela the goat, and carries the
 * messenger when the wings are full.  He says short lines in a drawn bubble — one at a time, 2–4 s
 * each, never over a telegraph or the runner's banner — reacting to what just happened.  Each moment
 * has several variants and a session never repeats one: when a moment's variants are spent he keeps
 * quiet.
 *
 * Pure (no DOM, no canvas): the sim owns him, the view draws `current`.
 */
import { t, type Key } from './i18n';

export type Moment =
  | 'first' | 'open' | 'push' | 'blind' | 'rest' | 'good' | 'flight' | 'land' | 'near' | 'stumble'
  | 'goat' | 'caught' | 'station' | 'city' | 'word' | 'mission' | 'mult' | 'power' | 'shield' | 'fire' | 'end';

/** How many variants each moment has in the catalog (say.<moment>.1 … say.<moment>.n). */
export const SAY: Readonly<Record<Moment, number>> = {
  first: 3, open: 4, push: 4, blind: 3, rest: 4, good: 4, flight: 4, land: 3, near: 3, stumble: 4,
  goat: 4, caught: 4, station: 3, city: 3, word: 3, mission: 3, mult: 3, power: 3, shield: 3, fire: 3, end: 4,
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
  /** lines spoken this session (the tests read them) */
  readonly said: Line[] = [];

  constructor(private readonly rng: () => number) {}

  /** Ask for a moment's line: it waits up to `wait` s for a quiet moment. */
  say(moment: Moment, prio = 1, wait = 4): void {
    if (this.queue.some(q => q.moment === moment)) return;
    this.queue.push({ moment, prio, until: this.clock + wait });
    this.queue.sort((a, b) => b.prio - a.prio);
    if (this.queue.length > 4) this.queue.length = 4;
  }

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
    if (!this.current && p && !quiet && this.since >= (p.prio >= 2 ? 0.4 : 2.2)) {
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
