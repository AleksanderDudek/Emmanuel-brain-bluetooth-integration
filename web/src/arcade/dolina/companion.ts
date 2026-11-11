/**
 * Ćma, the moth who loves the lamp a little too much: Dolina's talking companion (DESIGN §9.2).  She
 * rides on the pilgrim's hood, and when he jumps a second time in the air she grabs the hood and flaps
 * (the double jump).  She says short lines in a speech bubble — one at a time, 2–4 s each, never over
 * a telegraph or the runner's block banner — at the session's opening, a block's start, a good push
 * (the lamp visibly growing), a dim lamp (she sulks, warmly), a calm meadow, a near miss, a big
 * moment, the first double jump, a stair built (or too short), a climb by hand, a pit, a lamb freed,
 * a high gate, the tide close behind and its catch, a guardian, its anger and its fall, a new era, a
 * fall, low oil, a level's way out and the ending.
 *
 * Version 3: the companions talk too — one voice at a time, in the same queue.  Each has a line when
 * freed (Ćma reacts first: `c.<id>`), when joining, when their power fires, now and then on the road
 * (a quip), when their bond reaches a level, and Babcia when her umbrella takes a hit; Ćma has new
 * lines for the clock tower, its floors and its dawn, a mission done and a chest.  Each moment has
 * several variants and a session never repeats one: when a moment's variants are spent, it keeps quiet.
 *
 * Pure (no DOM, no canvas): the sim owns it, the view draws `current` over its speaker.
 */
import type { CompId, EraId, GuardId } from './content';
import { t, type Key } from './i18n';

type MateMoment = 'join' | 'power' | 'quip' | 'level';

export type Moment =
  | 'first' | 'open' | 'push' | 'blind' | 'rest' | 'good' | 'small' | 'calm' | 'near' | 'big' | 'close'
  | 'double' | 'stairs' | 'short' | 'climb' | 'pit' | 'lamb' | 'gate' | 'tide' | 'caught' | 'level'
  | `guard.${GuardId}` | 'angry' | 'beaten' | `era.${EraId}` | 'fall' | 'oil' | 'end'
  // v3
  | 'tower' | 'floor' | 'towerDawn' | 'mission' | 'chest' | `c.${CompId}` | `m.${CompId}.${MateMoment}` | 'm.babcia.block';

/** Who says a line: Ćma, or one of the companions. */
export type Speaker = 'cma' | CompId;

const MATES: readonly CompId[] = ['glaz', 'babcia', 'bobr', 'zegar', 'kozica', 'wiewiorka'];
const mateMoments = (): Record<`m.${CompId}.${MateMoment}`, number> => {
  const out = {} as Record<`m.${CompId}.${MateMoment}`, number>;
  for (const id of MATES) {
    out[`m.${id}.join`] = 2;
    out[`m.${id}.power`] = 3;
    out[`m.${id}.quip`] = 3;
    out[`m.${id}.level`] = 2;
  }
  return out;
};

/** How many variants each moment has in the catalog (say.<moment>.1 … say.<moment>.n). */
export const SAY: Readonly<Record<Moment, number>> = {
  first: 3, open: 4, push: 4, blind: 3, rest: 4, good: 4, small: 3, calm: 3, near: 3, big: 4, close: 3,
  double: 3, stairs: 3, short: 3, climb: 3, pit: 3, lamb: 4, gate: 3, tide: 3, caught: 3, level: 4,
  'guard.wieza': 3, 'guard.rycerz': 3, 'guard.ekran': 3, 'guard.kukulka': 3, angry: 3, beaten: 4,
  'era.babel': 3, 'era.twierdza': 3, 'era.miasto': 3, fall: 3, oil: 3, end: 4,
  tower: 3, floor: 4, towerDawn: 2, mission: 3, chest: 3,
  'c.glaz': 2, 'c.babcia': 2, 'c.bobr': 2, 'c.zegar': 2, 'c.kozica': 2, 'c.wiewiorka': 2,
  'm.babcia.block': 2,
  ...mateMoments(),
};

/** The speaker of a moment: a companion's own lines start with `m.<id>.`. */
export function speakerOf(m: Moment): Speaker {
  if (!m.startsWith('m.')) return 'cma';
  const id = m.split('.')[1] as CompId;
  return MATES.includes(id) ? id : 'cma';
}

export interface Line { moment: Moment; who: Speaker; text: string; t: number; dur: number }

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

  /** Seconds since the last line ended (0 while one is on screen). */
  get quietFor(): number { return this.current ? 0 : this.since; }

  /**
   * Ask for a moment's line: it waits up to `wait` s for a quiet moment (no telegraph, no banner,
   * the last line done); a waiting line of higher priority is not replaced.
   */
  say(moment: Moment, prio = 1, wait = 4): void {
    if (!(moment in SAY)) return;
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
        const line: Line = { moment: p.moment, who: speakerOf(p.moment), text, t: 0, dur: lineSec(text) };
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
