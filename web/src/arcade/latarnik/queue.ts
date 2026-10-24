/**
 * Timed messages that share one place on Latarnik's screen (the title over the sea, the card slot
 * below the island): one shows at a time, the more important first, and a message that others wait
 * for steps aside after its minimum time with a short fade.  Pure timing, no drawing (hud.ts draws),
 * so the order of a busy moment — a star, the blind Konwój's reveal, the next block's name — is tested.
 */

export interface Shown<T> {
  readonly item: T;
  /** seconds shown so far, and when it ends (sooner once something waits) */
  t: number;
  end: number;
  /** the least it shows when something waits (s) */
  readonly min: number;
  /** lower is more important */
  readonly rank: number;
  /** a waiting message is dropped after this long: its moment has passed (s) */
  readonly keep: number;
  waited: number;
}

export interface QueueOpts {
  dur: number;
  min?: number;
  rank?: number;
  keep?: number;
}

export class Queue<T> {
  private readonly q: Shown<T>[] = [];

  constructor(readonly fadeIn = 0.2, readonly fadeOut = 0.3, readonly cap = 6) {}

  /** Queue `item`: behind the message showing and behind every waiting one at least as important. */
  push(item: T, o: QueueOpts): void {
    const s: Shown<T> = { item, t: 0, end: o.dur, min: Math.min(o.min ?? o.dur, o.dur), rank: o.rank ?? 1, keep: o.keep ?? Infinity, waited: 0 };
    let i = this.q.length;
    while (i > 1 && this.q[i - 1].rank > s.rank) i--;
    this.q.splice(i, 0, s);
    if (this.q.length > this.cap) this.q.pop();   // the least important one waits no longer
    this.yieldHead();
  }

  /** The message showing (null: none). */
  get head(): Shown<T> | null { return this.q[0] ?? null; }

  get length(): number { return this.q.length; }

  /** The showing message's opacity: it fades in, and out before it ends. */
  get alpha(): number {
    const h = this.q[0];
    return h ? Math.max(0, Math.min(1, h.t / this.fadeIn, (h.end - h.t) / this.fadeOut)) : 0;
  }

  update(dt: number): void {
    const h = this.q[0];
    if (!h) return;
    h.t += dt;
    for (let i = this.q.length - 1; i >= 1; i--) if ((this.q[i].waited += dt) > this.q[i].keep) this.q.splice(i, 1);
    if (h.t >= h.end) {
      this.q.shift();
      this.yieldHead();
    }
  }

  clear(): void { this.q.length = 0; }

  /** Something waits: the message showing ends after its minimum time, with its fade. */
  private yieldHead(): void {
    const h = this.q[0];
    if (h && this.q.length > 1) h.end = Math.min(h.end, Math.max(h.min, h.t) + this.fadeOut);
  }
}
