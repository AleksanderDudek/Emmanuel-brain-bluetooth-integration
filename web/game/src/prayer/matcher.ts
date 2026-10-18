/**
 * Hears a prayer of the heart said aloud: a short invocation repeated again and again (like the
 * Jesus Prayer). Speech recognition output is matched word by word, forgiving recognition slips,
 * Polish inflection and a skipped word.
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

/**
 * Counts repetitions of the invocation in recognised speech. A repetition counts once at least
 * 70 % of its words were heard in order; starting the invocation again closes the one before.
 */
export class RepetitionCounter {
  private readonly words: string[];
  private ptr = 0;
  private hits = 0;

  constructor(invocation: string) {
    this.words = tokenize(invocation).map(normalizeWord).filter(Boolean);
  }

  /** Feed one final transcript; returns how many repetitions it completed. */
  feed(text: string): number {
    let reps = 0;
    for (const raw of tokenize(text)) {
      const w = normalizeWord(raw);
      if (!w || !this.words.length) continue;
      let matched = -1;
      for (let k = this.ptr; k < Math.min(this.words.length, this.ptr + 2); k++) {
        if (similar(w, this.words[k])) { matched = k; break; }
      }
      if (matched < 0 && this.ptr > 0 && similar(w, this.words[0])) {
        if (this.complete()) reps++;   // a new repetition began before this one was finished
        this.ptr = 1;
        this.hits = 1;
        continue;
      }
      if (matched < 0) continue;
      this.ptr = matched + 1;
      this.hits++;
      if (this.ptr >= this.words.length) {
        if (this.complete()) reps++;
        this.ptr = 0;
        this.hits = 0;
      }
    }
    return reps;
  }

  private complete(): boolean {
    return this.hits >= Math.ceil(this.words.length * 0.7);
  }
}
