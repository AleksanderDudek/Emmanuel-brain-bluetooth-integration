/**
 * Follows a prayer being read aloud: speech recognition output is matched
 * word by word against the text, forgiving recognition errors, Polish
 * inflection and a few skipped words.  The matched words light up like
 * karaoke.  Also a "read along" mode for players who cannot or do not want to
 * speak (the text reveals itself at reading pace while a button is held).
 */

export function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Same word, allowing recognition slips and different endings (Polish inflection). */
export function similar(spoken: string, expected: string): boolean {
  if (!spoken || !expected) return false;
  if (spoken === expected) return true;
  const n = Math.max(spoken.length, expected.length);
  const allowed = n >= 7 ? 2 : n >= 4 ? 1 : 0;
  if (levenshtein(spoken, expected) <= allowed) return true;
  // a shared stem ("zmiluj" / "zmilowal"): 4+ letters, both words reasonably long
  let k = 0;
  while (k < spoken.length && k < expected.length && spoken[k] === expected[k]) k++;
  return k >= 4 && Math.min(spoken.length, expected.length) >= 5;
}

export interface PrayerProgress {
  /** per display word: matched by voice */
  matched: boolean[];
  /** index of the next expected word (words before it are passed) */
  pointer: number;
  /** share of words actually matched */
  ratio: number;
  done: boolean;
}

const LOOKAHEAD = 5;

export class PrayerMatcher {
  readonly words: string[];
  private readonly norm: string[];
  private readonly matched: boolean[];
  private pointer = 0;
  private tentative = 0;

  constructor(text: string) {
    this.words = tokenize(text);
    this.norm = this.words.map(normalizeWord);
    this.matched = this.words.map(() => false);
    // punctuation-only tokens count as passed
    this.skipEmpty();
  }

  private skipEmpty(): void {
    while (this.pointer < this.norm.length && !this.norm[this.pointer]) {
      this.matched[this.pointer] = true;
      this.pointer++;
    }
  }

  /** Advance through `spoken` from `start`; returns the new pointer (marks matches when `commit`). */
  private advance(spoken: string, start: number, commit: boolean): number {
    let p = start;
    for (const raw of tokenize(spoken)) {
      const w = normalizeWord(raw);
      if (!w) continue;
      for (let k = p; k < Math.min(this.norm.length, p + LOOKAHEAD); k++) {
        if (similar(w, this.norm[k])) {
          if (commit) this.matched[k] = true;
          p = k + 1;
          while (p < this.norm.length && !this.norm[p]) { if (commit) this.matched[p] = true; p++; }
          break;
        }
      }
    }
    return p;
  }

  /**
   * Feed recognised speech. Final results are committed; interim ones only move
   * the highlight ahead tentatively (they will be re-sent as final).
   */
  feed(spoken: string, final: boolean): PrayerProgress {
    if (final) {
      this.pointer = this.advance(spoken, this.pointer, true);
      this.tentative = this.pointer;
    } else {
      this.tentative = this.advance(spoken, this.pointer, false);
    }
    return this.progress();
  }

  progress(): PrayerProgress {
    const total = this.words.length || 1;
    const hits = this.matched.filter(Boolean).length;
    const ratio = hits / total;
    const atEnd = this.pointer >= this.words.length - 1;
    return {
      matched: [...this.matched],
      pointer: Math.max(this.pointer, this.tentative),
      ratio,
      done: ratio >= 0.75 || (atEnd && ratio >= 0.6),
    };
  }
}

/** Read-along: reveal words at reading-aloud pace while the player holds the button. */
export class ReadAlong {
  readonly words: string[];
  private pos = 0;

  constructor(text: string, private readonly wordsPerSecond = 2.2) {
    this.words = tokenize(text);
  }

  update(dt: number, holding: boolean): number {
    if (holding) this.pos = Math.min(this.words.length, this.pos + dt * this.wordsPerSecond);
    return Math.floor(this.pos);
  }

  get revealed(): number { return Math.floor(this.pos); }
  get done(): boolean { return this.pos >= this.words.length; }
  get seconds(): number { return this.words.length / this.wordsPerSecond; }
}
