/**
 * A cathedral, generated: the impulse response for the ConvolverNode, built once at unlock.
 *
 * Stereo, with independent noise in each channel (a wide, enveloping tail), decaying
 * exponentially with RT60 ≈ 4.4 s (a large stone nave) and darkening as it decays (air and stone
 * absorb the highs first), after a short pre-delay and a few early reflections off the nearest
 * walls and pillars.
 */
import { Rng } from './rng';

/** Early reflections: [ms after the pre-delay, gain]; the right channel hears them 15 % later. */
const EARLY: readonly (readonly [ms: number, gain: number])[] = [
  [11, 0.5], [19, -0.35], [27, 0.3], [41, -0.22], [53, 0.18], [67, -0.12],
];

export function impulseResponse(sampleRate: number, seconds = 4.8, rt60 = 4.4, preDelay = 0.03): Float32Array<ArrayBuffer>[] {
  const rng = new Rng(0xca7ed1a1);
  const length = Math.round(sampleRate * seconds);
  const start = Math.round(sampleRate * preDelay);
  const decay = Math.exp(-6.91 / (rt60 * sampleRate)); // amplitude ×10⁻³ (−60 dB) after rt60
  return [1, 1.15].map(spread => {
    const ir = new Float32Array(length);
    let env = 1;
    let lowpassed = 0;
    let k = 0;
    for (let i = start; i < length; i++, env *= decay) {
      if ((i - start) % 64 === 0) {
        const cutoff = 600 + 7400 * Math.exp(-(i - start) / sampleRate / 1.2); // Hz: bright, then dark
        k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
      }
      lowpassed += k * (rng.next() * 2 - 1 - lowpassed);
      ir[i] = lowpassed * env;
    }
    for (const [ms, gain] of EARLY) ir[start + Math.round((ms * spread * sampleRate) / 1000)] += gain;
    return ir;
  });
}
