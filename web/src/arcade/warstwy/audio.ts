/**
 * Warstwy światła's sound, gentle and wordless (kit/audio.ts): a warm pad in D whose filter opens with the light of a
 * push, a faint shimmer as a thing loosens, a soft chime when it reaches the Light (a little higher for each layer —
 * the seven layers climb the pentatonic ladder), quieter bells when the Light takes what is left, a chord of bells when
 * a layer closes, and the bells of the whole at the end.  Nothing loud, no chant.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent } from './sim';

const D3 = 146.83, A3 = 220, D4 = 293.66, FS4 = 369.99;

export class WarstwySound {
  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: [D3, A3, D4, FS4], dark: 300, bright: 1600, gain: 0.055 });
  }

  on(e: SimEvent): void {
    const a = this.a;
    switch (e.type) {
      case 'layer':
        a.bell(ladder(e.k, 146.83), 0.05, 2.6);
        break;
      case 'loosen':
        a.noiseBurst(1.1, { freq: 2600, sweepTo: 4200, gain: 0.012, q: 0.8, type: 'bandpass' });
        break;
      case 'drawn':
        if (e.grace) a.bell(ladder(4 + e.k, 293.66), 0.03, 2.2);
        else {
          a.bell(ladder(4 + e.k, 293.66), 0.07, 2.8);
          a.bell(ladder(6 + e.k, 293.66), 0.035, 2.4, 0.16);
        }
        break;
      case 'healed':
        [0, 2, 4].forEach((s, i) => a.bell(ladder(s + e.k, 293.66), 0.05, 3, 0.12 + i * 0.22));
        a.noiseBurst(2.2, { freq: 3200, sweepTo: 1400, gain: 0.018, q: 0.6 });
        break;
      case 'stage':
        if (e.stage === 'whole') [0, 2, 4, 5, 7, 9].forEach((s, i) => a.bell(ladder(s, 293.66), 0.055, 3.2, i * 0.4));
        break;
      default:
        break;
    }
  }
}
