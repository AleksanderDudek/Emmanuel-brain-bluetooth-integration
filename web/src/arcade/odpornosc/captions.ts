/**
 * Odporność's teaching words on the play field, without the canvas (round 11, DESIGN §13.9): the coach marks —
 * one at a time, each pointing at the thing it is about with the gesture drawn (a finger that taps or drags) —
 * and the glosses, a plain-words label on a technical term the first time its thing shows („Neutrofil — biała
 * krwinka, która zjada bakterie”).  The founder could not read the old ones before they went, so:
 *
 *   * every one stays at least `readSec(text)` (2.5 s + 70 ms a character, never under 4.5 s);
 *   * a coach mark that asks for a gesture stays until the player does it (then only until it has been read),
 *     the next one replaces it — a weightier one once it has been read, any other a few seconds after that — or
 *     RULES.coachMax passes; one that only explains stays RULES.infoMin at least and goes when the player taps on
 *     after reading it;
 *   * one of each at a time, never over each other: a coach mark has the right of way (a gloss comes once the
 *     coach mark on screen has been read, and the view sets the two apart); nothing new comes, nothing ages, while
 *     the runner's block banner is on screen; a card ends the coach mark on screen (its moment has passed) and the
 *     queue waits behind it;
 *   * what was shown is remembered (`onShow`: the player's progress), what was only queued is not.
 *
 * Pure logic: the sim feeds it and says what fits now; index.ts shows the coach mark with the runner's bubble,
 * the view draws the gesture and the gloss.
 */
import type { Coach, CoachAt, GlossId } from './content';
import { RULES, readSec } from './rules';

export type CaptionGesture = 'tap' | 'drag' | null;

export interface Caption<K extends string> {
  what: K;
  text: string;
  /** what it points at; a drag's gesture goes on to `to` */
  at: CoachAt;
  to: CoachAt | null;
  gesture: CaptionGesture;
  /** higher replaces lower (once the lower has been read) */
  pri: number;
  /** seconds on screen, the least it stays (read twice), the most */
  t: number;
  read: number;
  max: number;
  /** the player did what it asked */
  done: boolean;
}

export class Captions {
  coach: Caption<Coach> | null = null;
  gloss: Caption<GlossId> | null = null;
  private readonly coachQ: Caption<Coach>[] = [];
  private readonly glossQ: Caption<GlossId>[] = [];
  /** bumps when the coach mark on screen changes (index.ts then shows the new one, or hides it) */
  seq = 0;
  /** what showed this session, in order (the tests read them) */
  readonly coached: Coach[] = [];
  readonly glossed: GlossId[] = [];
  /** a gloss may show beside a coach mark already read (false on a small field — a phone on its side: one at a time) */
  together = true;
  /** told when one shows (the sim remembers it in the progress: a coach mark and a gloss come once for a player) */
  onShow: ((kind: 'coach' | 'gloss', what: string) => void) | null = null;

  /** a coach mark on screen read twice and given this long more for its gesture (s) gives way to any other */
  static readonly GRACE = 4;

  /** Queue a coach mark (`gesture` null: it only explains). */
  ask(what: Coach, text: string, at: CoachAt, gesture: CaptionGesture, pri: number, to: CoachAt | null = null): void {
    if (this.coach?.what === what || this.coachQ.some(c => c.what === what)) return;
    const read = readSec(text);
    const max = gesture ? Math.max(read, RULES.coachMax) : Math.max(read, RULES.infoMin);
    this.coachQ.push({ what, text, at, to, gesture, pri, t: 0, read, max, done: false });
  }

  /** Queue a gloss (the sim keeps it from ever coming twice). */
  explain(what: GlossId, text: string, at: CoachAt): void {
    if (this.gloss?.what === what || this.glossQ.some(g => g.what === what)) return;
    const read = readSec(text);
    this.glossQ.push({ what, text, at, to: null, gesture: null, pri: 0, t: 0, read, max: read, done: false });
  }

  /** The player did what a coach mark asks: on screen it goes once read (its gesture at once); queued, it is not needed. */
  done(what: Coach): void {
    if (this.coach?.what === what) this.coach.done = true;
    const i = this.coachQ.findIndex(c => c.what === what);
    if (i >= 0) this.coachQ.splice(i, 1);
  }

  /** A tap on the field: an explanation already read twice is tapped away. */
  tapped(): void {
    const c = this.coach;
    if (c && !c.gesture && c.t >= c.read) this.end();
  }

  /** A card came: the coach mark on screen is over (the queue waits behind the card). */
  cardShown(): void {
    if (this.coach) this.end();
  }

  /** Drop what no longer fits (another stage, a moment that passed). */
  prune(fits: (c: Caption<string>) => boolean): void {
    for (let i = this.coachQ.length - 1; i >= 0; i--) if (!fits(this.coachQ[i])) this.coachQ.splice(i, 1);
    for (let i = this.glossQ.length - 1; i >= 0; i--) if (!fits(this.glossQ[i])) this.glossQ.splice(i, 1);
    if (this.coach && !fits(this.coach)) this.end();
    if (this.gloss && !fits(this.gloss)) this.gloss = null;
  }

  get pending(): number { return this.coachQ.length + this.glossQ.length; }

  /** The world's width changed by `k`: the fixed points keep their place in it. */
  scaleX(k: number): void {
    const all = [this.coach, this.gloss, ...this.coachQ, ...this.glossQ];
    for (const c of all) {
      if (!c) continue;
      for (const a of [c.at, c.to]) if (a && a.kind === 'world') a.x *= k;
    }
  }

  /**
   * A frame.  `hold`: the runner's banner is up (nothing ages, nothing new); `free`: the play is on (no card);
   * `ready`: whether a queued one's thing is on screen now (it waits for it, it is not dropped).
   */
  update(dt: number, hold: boolean, free: boolean, ready: (c: Caption<string>) => boolean = () => true): void {
    if (hold) return;
    const c = this.coach;
    if (c) {
      c.t += dt;
      if ((c.done && c.t >= c.read) || c.t >= c.max) this.end();
    }
    if (this.gloss) {
      this.gloss.t += dt;
      if (this.gloss.t >= this.gloss.read) this.gloss = null;
    }
    if (!free) return;
    // the next coach mark replaces the one on screen: a weightier one once that one has been read, any other a
    // few seconds later (its gesture had its chance; the coach mark asked once, it does not nag)
    const next = this.best(ready);
    if (next && this.coach && this.coach.t >= this.coach.read && (next.pri > this.coach.pri || this.coach.t >= this.coach.read + Captions.GRACE)) this.end();
    if (next && !this.coach && !this.gloss) {
      this.coachQ.splice(this.coachQ.indexOf(next), 1);
      this.coach = next;
      this.coached.push(next.what);
      this.seq++;
      this.onShow?.('coach', next.what);
    }
    // a gloss when no coach mark is waiting to show and the one on screen (if any) has been read
    const g = this.glossQ.find(ready);
    if (!this.gloss && g && !(next && !this.coach) && (!this.coach || (this.together && this.coach.t >= this.coach.read))) {
      this.glossQ.splice(this.glossQ.indexOf(g), 1);
      this.gloss = g;
      this.glossed.push(g.what);
      this.onShow?.('gloss', g.what);
    }
  }

  private best(ready: (c: Caption<string>) => boolean): Caption<Coach> | null {
    let b: Caption<Coach> | null = null;
    for (const c of this.coachQ) if ((!b || c.pri > b.pri) && ready(c)) b = c;
    return b;
  }

  private end(): void {
    this.coach = null;
    this.seq++;
  }
}
