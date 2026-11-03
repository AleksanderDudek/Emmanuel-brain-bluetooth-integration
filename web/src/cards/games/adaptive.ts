/**
 * Difficulty that follows the player (src/cards/DESIGN.md §4.2).
 *
 * A *staircase*, as in psychophysics: a few successes in a row move one level up, too many
 * failures among the last trials move one level down.  With three up / two-of-four down the
 * player settles where about four trials in five succeed: hard enough to stretch, easy enough
 * to keep going.  Training is meant to stay at that edge — a task that has become easy no
 * longer trains much, and one that keeps failing discourages.
 *
 * Memory spans (the strip, the code) use the classic span rule instead: one success → one
 * longer, two failures in a row → one shorter.
 */

export class Staircase {
  private run = 0;
  private recent: boolean[] = [];

  constructor(public level: number, readonly min: number, readonly max: number,
              readonly upAfter = 3, readonly downOf: [number, number] = [2, 4]) {
    this.level = Math.max(min, Math.min(max, Math.round(level)));
  }

  /** One trial's outcome; returns the change of level (−1, 0 or +1). */
  push(ok: boolean): -1 | 0 | 1 {
    this.recent.push(ok);
    if (this.recent.length > this.downOf[1]) this.recent.shift();
    if (ok) {
      this.run++;
      if (this.run >= this.upAfter && this.level < this.max) {
        this.level++;
        this.run = 0;
        this.recent = [];
        return 1;
      }
      return 0;
    }
    this.run = 0;
    if (this.recent.filter(x => !x).length >= this.downOf[0] && this.level > this.min) {
      this.level--;
      this.recent = [];
      return -1;
    }
    return 0;
  }
}

/** The span rule: success → +1, two failures in a row → −1. */
export class SpanRule {
  private fails = 0;

  constructor(public level: number, readonly min: number, readonly max: number) {
    this.level = Math.max(min, Math.min(max, Math.round(level)));
  }

  push(ok: boolean): -1 | 0 | 1 {
    if (ok) {
      this.fails = 0;
      if (this.level < this.max) { this.level++; return 1; }
      return 0;
    }
    if (++this.fails >= 2) {
      this.fails = 0;
      if (this.level > this.min) { this.level--; return -1; }
    }
    return 0;
  }
}
