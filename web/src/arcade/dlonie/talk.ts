/**
 * The narrator's line, without the canvas: one line at a time, on screen long enough to be read twice (≥ 2.5 s +
 * 70 ms a character, never under 4.5 s), a pause between two, never while a telegraph, the runner's block banner, the
 * opening card, the picker or a coach mark is up (a line on screen when one comes is cut), and no line said twice in a
 * session until its moment has used them all.  Moments ask with a priority and a shelf life; the most important one
 * still fresh is said when the way is clear.
 */
import type { Moment } from './content';
import { RULES, readSec } from './rules';

/** Moments that speak however recently they spoke (round 24's long sessions): no signal, the ball waiting for attention, the valve's rest. */
export const ALWAYS: readonly Moment[] = ['nosignal', 'still', 'valve'];

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
  /**
   * Round 24: in a session over 30 minutes the sim sets this to RULES.talkFresh — a line said less than so many seconds
   * ago is not said again, its moment passes in silence (the draws are the same, so 30 minutes and less are as before);
   * 0 = off.  The warnings and the help when stuck (ALWAYS) still speak.
   */
  fresh = 0;
  private readonly saidAt = new Map<string, number>();

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

  clear(): void { this.queue.length = 0; }

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
    const last = this.saidAt.get(text);
    if (this.fresh > 0 && last !== undefined && now - last < this.fresh && !ALWAYS.includes(a.moment)) return;
    this.saidAt.set(text, now);
    this.line = { moment: a.moment, text, t: 0, dur: readSec(text) };
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
