/**
 * The firefly's bubble, without the canvas: one line at a time, long enough to read twice (2.5 s + 70 ms a
 * character, never under 4.5 s — the clarity rule of 2026-11-17), a pause between two, never while a telegraph,
 * the runner's block banner or a card is on screen (a line on screen when one begins is cut), and no line said
 * twice until its moment has used them all.  Moments ask with a priority and a shelf life; a picture's own line
 * (when it is transformed) asks with its text, pinned: it is said at once and only a card or a coach mark cuts it.
 */
import type { Moment } from './content';
import { RULES } from './rules';

export interface Line { moment: Moment | 'own'; text: string; t: number; dur: number; pinned: boolean }

interface Ask { moment: Moment | 'own'; text: string | null; pri: number; until: number; seq: number; pinned: boolean }

/** How long a line of `text` stays: long enough to read twice (RULES.talkBase + talkPerChar × characters, ≥ talkMin). */
export const readSec = (text: string): number => Math.max(RULES.talkMin, RULES.talkBase + RULES.talkPerChar * [...text].length);

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

  /** Ask for a moment's line: `pri` orders the queue (higher first), `ttl` is how long (s) it stays worth saying. */
  ask(moment: Moment, pri = 1, ttl = 4): void {
    if (!this.lines(moment).length) return;
    this.push({ moment, text: null, pri, until: this.now + ttl, seq: this.seq++, pinned: false });
  }

  /** Ask for a line of its own (a picture's reveal); `pinned`: said at once, cut only by a card or a coach mark. */
  say(text: string, pri = 3, ttl = 6, pinned = false): void {
    if (!text) return;
    this.push({ moment: 'own', text, pri, until: this.now + ttl, seq: this.seq++, pinned });
  }

  private push(a: Ask): void {
    const i = this.queue.findIndex(q => q.moment === a.moment && a.moment !== 'own');
    if (i >= 0) this.queue.splice(i, 1);
    this.queue.push(a);
    if (this.queue.length > 4) {
      this.queue.sort((x, y) => y.pri - x.pri || x.seq - y.seq);
      this.queue.length = 4;
    }
  }

  clear(): void { this.queue.length = 0; }

  /** A pinned line is on screen or waiting to be said. */
  get pinned(): boolean { return !!this.line?.pinned || this.queue.some(q => q.pinned); }

  /** Cut the line on screen (a card, a banner or a telegraph is coming); a pinned line only for a card (`force`). */
  hush(force = false): void {
    if (!this.line || (this.line.pinned && !force)) return;
    this.line = null;
    this.gap = RULES.talkGap * 0.5;
  }

  /**
   * `blocked`: a telegraph, a banner, a card or a coach mark is on screen (the voice waits); `hard`: a card or a coach
   * mark — the only things that cut a pinned line.
   */
  update(dt: number, now: number, blocked: boolean, hard = blocked): void {
    this.now = now;
    if (this.line) {
      this.line.t += dt;
      if ((this.line.pinned ? hard : blocked) || this.line.t >= this.line.dur) {
        this.line = null;
        this.gap = RULES.talkGap;
      }
    } else this.gap = Math.max(0, this.gap - dt);
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].until < now) this.queue.splice(i, 1);
    if (this.line || !this.queue.length) return;
    this.queue.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.pri - a.pri || a.seq - b.seq);
    const top = this.queue[0];
    if (top.pinned ? hard : blocked || this.gap > 0) return;
    this.queue.shift();
    const text = top.text ?? this.pick(top.moment as Moment);
    this.line = { moment: top.moment, text, t: 0, dur: readSec(text), pinned: top.pinned };
    this.said.push(text);
  }

  /** A line of a moment, in turn (none said twice until the moment has used them all). */
  pick(m: Moment): string {
    const all = this.lines(m);
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
