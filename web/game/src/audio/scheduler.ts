/**
 * Timing logic, free of Web Audio so it can be unit-tested.
 *
 * Music uses lookahead scheduling ("A Tale of Two Clocks", Chris Wilson, 2013): a coarse JS
 * timer wakes every TICK_MS and hands Web Audio every cue due within the next LOOKAHEAD seconds
 * of `AudioContext.currentTime`; Web Audio then plays them sample-accurately. The timer may
 * jitter by tens of milliseconds, the audio clock never does.
 */

export const TICK_MS = 50;
export const LOOKAHEAD = 0.25;

/** Cues ordered by time; `take(until)` pops those due before the edge of the lookahead window. */
export class CueQueue<T extends { at: number }> {
  private items: T[] = [];

  /** Insert in time order; cues at equal times keep their insertion order. */
  push(cue: T): void {
    let i = this.items.length;
    while (i > 0 && this.items[i - 1].at > cue.at) i--;
    this.items.splice(i, 0, cue);
  }

  take(until: number): T[] {
    let n = 0;
    while (n < this.items.length && this.items[n].at < until) n++;
    return this.items.splice(0, n);
  }

  clear(): void {
    this.items = [];
  }

  /** Drops the cues at or after `from` — except those `keep` wants — so what follows can be re-composed. */
  cut(from: number, keep: (cue: T) => boolean = () => false): void {
    this.items = this.items.filter(cue => cue.at < from || keep(cue));
  }

  get size(): number {
    return this.items.length;
  }
}

/** Beat clock for the heartbeat pulse; a tempo change keeps the time of the next beat. */
export class Metronome {
  private next = 0;
  private period = 0;

  set(bpm: number | null, now: number): void {
    if (bpm === null) {
      this.period = 0;
      return;
    }
    if (this.period === 0) this.next = now + 0.1;
    this.period = 60 / bpm;
  }

  /** Beats in [now, until) not returned before; beats missed while the timer slept are skipped. */
  due(now: number, until: number): number[] {
    const beats: number[] = [];
    if (this.period === 0) return beats;
    while (this.next < now) this.next += this.period;
    for (; this.next < until; this.next += this.period) beats.push(this.next);
    return beats;
  }
}
