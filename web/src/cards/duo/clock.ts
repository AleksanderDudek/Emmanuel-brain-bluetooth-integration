/**
 * Clock sync between the pad and the board (src/cards/DESIGN.md §5.2).
 *
 * A reaction time is measured from the moment the board shows a stimulus to the moment the
 * player touches the pad, two devices with two unrelated `performance.now()` clocks.  The pad
 * pings the board every few seconds (NTP's idea, reduced to one hop):
 *
 *   pad sends   a (pad clock)     →   board stamps b (board clock)   →   pad receives c (pad clock)
 *   round trip = c − a,  offset θ = b − (a + c) / 2   (board time = pad time + θ)
 *
 * The estimate is exact when both legs take equally long, and off by at most half the round
 * trip when they do not, so the sample with the shortest round trip among the recent ones wins.
 * Over a local network that is typically a few milliseconds; inside one page it is zero.  The
 * two clocks also drift apart by a few parts per million, which the regular pings follow.
 */

export interface ClockSample {
  rtt: number;
  offset: number;
  /** pad time when it was taken */
  at: number;
}

/** How many recent samples the estimate chooses from, and how old one may be (ms). */
const KEEP = 12;
const MAX_AGE_MS = 60_000;

export class ClockSync {
  private readonly samples: ClockSample[] = [];

  /** One ping–pong: `a` and `c` on the pad's clock, `b` on the board's.  Returns the sample, or null if impossible. */
  add(a: number, b: number, c: number): ClockSample | null {
    const rtt = c - a;
    if (!Number.isFinite(rtt) || rtt < 0 || rtt > 5000 || !Number.isFinite(b)) return null;
    const s = { rtt, offset: b - (a + c) / 2, at: c };
    this.samples.push(s);
    if (this.samples.length > KEEP) this.samples.shift();
    return s;
  }

  /** The best current estimate: the shortest round trip among the fresh samples (null before the first). */
  best(now = performance.now()): ClockSample | null {
    let best: ClockSample | null = null;
    for (const s of this.samples) {
      if (now - s.at > MAX_AGE_MS) continue;
      if (!best || s.rtt < best.rtt) best = s;
    }
    return best ?? this.samples[this.samples.length - 1] ?? null;
  }

  /** A pad timestamp on the board's clock (null before the first sample). */
  toBoard(padTime: number, now = performance.now()): number | null {
    const b = this.best(now);
    return b ? padTime + b.offset : null;
  }

  /** The worst error the estimate can have (half the best round trip, ms). */
  uncertainty(now = performance.now()): number | null {
    const b = this.best(now);
    return b ? b.rtt / 2 : null;
  }

  reset(): void { this.samples.length = 0; }
}
