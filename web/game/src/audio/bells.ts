/**
 * Church bells: the partials of a bell as additive synthesis, rendered once into a buffer that
 * every strike replays at its own pitch (so a bigger, lower bell also rings longer, as real
 * ones do), and the change-ringing method the peals follow.
 */

/**
 * Partials of a tuned church bell relative to its strike note (the "prime"), after the
 * bell-founders' tuning: hum an octave below, prime, the minor-third "tierce" that gives bells
 * their plaintive colour, quint, nominal an octave up, a few upper partials and the clapper's
 * clang. [frequency ratio, amplitude, decay time constant in s at BELL_PRIME_HZ]
 */
export const BELL_PARTIALS: readonly (readonly [ratio: number, amp: number, tau: number])[] = [
  [0.5, 0.5, 3.0], // hum
  [1.0, 0.45, 2.2], // prime
  [1.2, 0.4, 1.6], // tierce (minor third)
  [1.5, 0.2, 1.2], // quint (fifth)
  [2.0, 0.55, 1.0], // nominal (octave)
  [2.5, 0.15, 0.6], // major tenth
  [3.0, 0.12, 0.45], // twelfth
  [4.0, 0.07, 0.3], // double octave
  [5.33, 0.05, 0.2],
  [6.2, 0.06, 0.05], // clang of the clapper
];
export const BELL_PRIME_HZ = 220;
export const BELL_SAMPLE_RATE = 22050;

/**
 * The bell at BELL_PRIME_HZ. Each partial is an exponentially decaying sine (a rotating phasor:
 * cheap enough to compute on a phone at unlock); the lower ones get a twin a fraction of a hertz
 * away, so they beat slowly like a real, never perfectly round bell.
 */
export function renderBell(sampleRate = BELL_SAMPLE_RATE, seconds = 6): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.round(sampleRate * seconds));
  const partial = (hz: number, amp: number, tau: number): void => {
    const w = (2 * Math.PI * hz) / sampleRate;
    const cos = Math.cos(w);
    const sin = Math.sin(w);
    const decay = Math.exp(-1 / (tau * sampleRate));
    let re = 1;
    let im = 0;
    for (let i = 0, a = amp; i < out.length && a > 1e-5; i++, a *= decay) {
      out[i] += a * im;
      const next = re * cos - im * sin;
      im = re * sin + im * cos;
      re = next;
    }
  };
  for (const [ratio, amp, tau] of BELL_PARTIALS) {
    partial(BELL_PRIME_HZ * ratio, amp, tau);
    if (ratio <= 2) partial(BELL_PRIME_HZ * ratio + 0.4 + 0.5 * ratio, 0.35 * amp, tau);
  }
  // fade out the last second (the hum is still sounding) and normalise
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    const left = out.length - i;
    if (left < sampleRate) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * left) / sampleRate);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  for (let i = 0; i < out.length; i++) out[i] *= 0.8 / peak;
  return out;
}

/**
 * Plain Hunt on n bells, the simplest change-ringing method: each bell moves one place per row,
 * adjacent pairs swapping alternately from the front and from second place, until rounds
 * (0 1 … n−1, treble to tenor) come back after 2n changes.
 */
export function plainHunt(n: number): number[][] {
  const rows: number[][] = [];
  let row = Array.from({ length: n }, (_, i) => i);
  for (let change = 0; change < 2 * n; change++) {
    row = [...row];
    for (let i = change % 2; i + 1 < n; i += 2) [row[i], row[i + 1]] = [row[i + 1], row[i]];
    rows.push(row);
  }
  return rows;
}
