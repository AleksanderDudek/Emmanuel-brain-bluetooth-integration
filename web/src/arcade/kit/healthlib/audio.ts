/**
 * A health visualisation's sounds (DESIGN.md §24, Każdy włos's audio.ts), on the kit's synthesiser (kit/audio.ts),
 * under the game's quiet tune or, without one, a warm pad in F whose filter follows the light: a bell for each
 * meditation on a pentatonic ladder when its scene arrives, a whisper of glass with each tenth of a scene grown
 * (climbing as it grows), a chime with its fifth and octave when a scene has grown, all the meditations' bells when one
 * is whole, the breath's soft wind in rest, a soft page-turn for a step along the scenes.  No drums.  Throttled, so
 * many taps never become noise.  Round 23: a word received in calm rings a soft low bell (once a breath at most);
 * before sleep the whole sound is quieter and fades to silence at the end (index.ts, kit/inner nightLevel).
 */
import { ladder, type ArcadeAudio } from '../audio';
import type { HealthSim, SimEvent } from './sim';

/** F major with an added ninth, low: the pad when there is no tune. */
const PAD = [174.61, 261.63, 349.23, 440];
/** The bells' root: F5 on the pentatonic ladder (F G A C D). */
const ROOT = 698.46;

const bellOf = (i: number): number => ladder(i, ROOT / 2);

export class HealthSound {
  private tickGap = 0;
  private tapGap = 0;
  private wordGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  /** `pad`: no tune plays (the game has none, or the player turned it off) — a warm pad instead. */
  start(pad: boolean): void {
    if (pad) this.a.pad({ notes: PAD, dark: 260, bright: 1800, gain: 0.05 });
  }

  update(dt: number): void {
    this.tickGap = Math.max(0, this.tickGap - dt);
    this.tapGap = Math.max(0, this.tapGap - dt);
    this.wordGap = Math.max(0, this.wordGap - dt);
  }

  on(e: SimEvent, sim: HealthSim): void {
    const a = this.a;
    if (!a.on) return;
    const bell = (m: string): number => Math.max(0, sim.lib.meds.indexOf(m));
    switch (e.type) {
      case 'scene': {
        const b = bell(e.med);
        if (e.via === 'auto' || e.via === 'start' || e.via === 'pick') {
          a.bell(bellOf(b + 5 + e.i), 0.045, 2.2);
          a.noiseBurst(1.6, { type: 'lowpass', freq: 300, sweepTo: 1200, gain: 0.012 });
        } else {
          // a step along the scenes: a soft turn of a page
          a.noiseBurst(0.35, { type: 'bandpass', freq: e.via === 'prev' ? 1600 : 2200, sweepTo: e.via === 'prev' ? 900 : 3200, q: 1, gain: 0.014 });
          a.tone(bellOf(b + 5 + e.i), 0.25, { type: 'triangle', gain: 0.018 });
        }
        break;
      }
      case 'tick': {
        if (this.tickGap > 0) break;
        this.tickGap = 0.08;
        a.tone(ladder(bell(sim.med) + 4 + e.k, ROOT / 2), 0.18, { type: 'sine', gain: 0.012 });
        break;
      }
      case 'grown': {
        const f = bellOf(bell(e.med) + 7);
        a.bell(f, 0.07, 2.6);
        a.bell(f * 1.5, 0.035, 2.4, 0.09);
        a.bell(f * 2, 0.022, 2, 0.18);
        a.noiseBurst(1.2, { type: 'bandpass', freq: 2400, sweepTo: 5000, q: 1.2, gain: 0.014 });
        break;
      }
      case 'whole':
        sim.lib.meds.forEach((_, i) => a.bell(bellOf(i + 5), 0.045, 2.8, i * 0.16));
        break;
      case 'gold':
        if (e.on) a.bell(1396.91, 0.013, 1.1);
        break;
      case 'breathTurn':
        if (e.inhale) a.noiseBurst(3.6, { type: 'lowpass', freq: 260, sweepTo: 900, gain: 0.02 });
        else a.noiseBurst(5.4, { type: 'lowpass', freq: 900, sweepTo: 240, gain: 0.018 });
        break;
      case 'received': {
        // a soft low bell, its octave a breath later: the word has gone in (never louder than the breath's wind)
        if (this.wordGap > 0) break;
        this.wordGap = 4;
        const f = ladder(e.from === 'cue' ? 0 : 2, ROOT / 4);
        a.bell(f, 0.03, 3.2);
        a.bell(f * 2, 0.012, 2.6, 0.22);
        break;
      }
      case 'blindEnd':
        [0, 2, 4].forEach((k, i) => a.bell(ladder(k + 5, ROOT / 2), 0.035, 2.2, i * 0.12));
        break;
      case 'stay':
        if (this.tapGap > 0) break;
        this.tapGap = 0.1;
        a.tone(bellOf(bell(sim.med) + 6), 0.22, { type: 'triangle', gain: 0.014 });
        break;
      case 'picker':
        a.noiseBurst(0.4, { type: 'bandpass', freq: e.open ? 900 : 1800, sweepTo: e.open ? 1800 : 900, q: 0.9, gain: 0.012 });
        break;
      case 'mode':
        a.bell(bellOf(9), 0.02, 1.2);
        break;
      case 'story':
        a.bell(bellOf(bell(sim.med) + 5), 0.03, 2.4);
        break;
      default:
        break;
    }
  }
}
