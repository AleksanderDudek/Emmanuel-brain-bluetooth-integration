/**
 * Rzeka Ezechiela's sound, gentle and wordless (kit/audio.ts): a warm pad in A major whose filter opens with the
 * light, the river's murmur now and then, a bell at each mark rising with the water (the pentatonic ladder), a soft
 * plink for each leaf, two bells when a leaf is laid, a long wash of water for a washing pass, the breath's wind in
 * rest following the player's pattern (still on a hold), and the bells of the end.  Nothing loud, no chant.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { EzechielSim, SimEvent } from './sim';

const A2 = 110, E3 = 164.81, A3 = 220, CS4 = 277.18;

export class EzechielSound {
  private murmur = 2;
  private n = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: [A2, E3, A3, CS4], dark: 320, bright: 1700, gain: 0.06 });
  }

  on(e: SimEvent, sim: EzechielSim): void {
    const a = this.a;
    switch (e.type) {
      case 'mark':
        a.bell(ladder(2 + e.mark * 2, 293.66), 0.09, 2.6);
        a.bell(ladder(4 + e.mark * 2, 293.66), 0.04, 2.2, 0.18);
        a.noiseBurst(1.2, { freq: 1400, sweepTo: 700, gain: 0.03, q: 0.6 });
        break;
      case 'leaf':
        a.tone(ladder(6 + (e.n % 5), 587.33), 0.22, { type: 'sine', gain: 0.045, slideTo: ladder(6 + (e.n % 5), 587.33) * 1.02 });
        break;
      case 'lay':
        a.bell(659.25, 0.08, 2.8);
        a.bell(880, 0.05, 2.6, 0.3);
        break;
      case 'pass':
        a.noiseBurst(2.4, { freq: 2200, sweepTo: 500, gain: 0.05, q: 0.5 });
        a.bell(ladder(9, 293.66), 0.06, 2.4, 0.2);
        break;
      case 'fruit':
        a.bell(1046.5, 0.05, 1.8);
        break;
      case 'blindEnd':
        a.noiseBurst(1.6, { freq: 3000, sweepTo: 1200, gain: 0.025, q: 0.7 });
        break;
      case 'telegraph':
        a.tone(440, 0.35, { type: 'sine', gain: 0.025 });
        break;
      case 'breathTurn': {
        const b = sim.breathP;
        if (e.phase === 'in') a.noiseBurst(Math.max(0.5, b.in), { freq: 380, sweepTo: 1100, gain: 0.022, type: 'lowpass', q: 0.4 });
        else if (e.phase === 'out') a.noiseBurst(Math.max(0.5, b.out), { freq: 1100, sweepTo: 300, gain: 0.02, type: 'lowpass', q: 0.4 });
        else a.bell(A2 * 2, 0.02, 1.4);
        break;
      }
      case 'finale':
        [0, 2, 4, 5, 7].forEach((k, i) => a.bell(ladder(k, 293.66), 0.06, 2.6, i * 0.45));
        break;
      default:
        break;
    }
  }

  /** The river's murmur now and then (a soft band of noise every few seconds). */
  update(dt: number): void {
    this.murmur -= dt;
    if (this.murmur > 0) return;
    this.n++;
    this.murmur = 3.5 + (this.n % 3);
    this.a.noiseBurst(3, { freq: 700 + 120 * (this.n % 4), q: 0.5, gain: 0.012, type: 'bandpass' });
  }
}
