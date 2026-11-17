/**
 * Światło ciała's small sounds, on the kit's synthesiser (kit/audio.ts), under the lullaby (lullaby.ts on kit/song.ts):
 * a soft whoosh and a bell as the light comes to an element (the bell climbs the scale along the way), a glass tone
 * for each tenth of an element filled by focus, bells for an element lit (a second, higher one the first time ever), an
 * arpeggio for a whole meditation, the breath's soft wind in rest (silence on a hold), a quiet click for the buttons.
 * Without the song the game keeps the runner's quiet pad, whose filter follows the light.  Throttled.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent, SwiatloSim } from './sim';

/** C major 6/9 in a low register: the pad when the song is off. */
const PAD = [130.81, 196, 261.63, 293.66];
const ROOT = 523.25;

export class SwiatloSound {
  private tickGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(songOn: boolean): void {
    if (!songOn) this.a.pad({ notes: PAD, dark: 260, bright: 1900, gain: 0.04 });
  }

  update(dt: number, _sim: SwiatloSim): void {
    this.tickGap = Math.max(0, this.tickGap - dt);
  }

  on(e: SimEvent, sim: SwiatloSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'element':
        a.noiseBurst(e.turned ? 1.4 : 0.5, { type: 'lowpass', freq: 400, sweepTo: 1400, gain: 0.016 });
        a.bell(ladder(sim.idx % 10, ROOT / 2), 0.03, 1.6);
        break;
      case 'tick':
        if (this.tickGap > 0) break;
        this.tickGap = 0.12;
        a.tone(ladder(e.k + 3, ROOT), 0.18, { type: 'sine', gain: 0.012 });
        break;
      case 'lit': {
        const n = sim.idx % 10;
        a.bell(ladder(n + 2, ROOT), 0.07, 2);
        a.bell(ladder(n + 4, ROOT), 0.04, 2.2, 0.12);
        if (e.first) a.bell(ladder(n + 7, ROOT), 0.03, 1.4, 0.3);
        break;
      }
      case 'whole':
        [0, 2, 4, 7, 9].forEach((k, i) => a.bell(ladder(k + 5, ROOT / 2), 0.06, 2.6, i * 0.14));
        break;
      case 'breath':
        if (e.phase === 'in') a.noiseBurst(3.6, { type: 'lowpass', freq: 260, sweepTo: 900, gain: 0.02 });
        else if (e.phase === 'out') a.noiseBurst(5.4, { type: 'lowpass', freq: 900, sweepTo: 240, gain: 0.018 });
        break;
      case 'gold':
        if (e.on) a.bell(1568, 0.014, 1);
        break;
      case 'blindEnd':
        [0, 4, 7].forEach((k, i) => a.bell(ladder(k, ROOT / 2), 0.04, 2, i * 0.1));
        break;
      case 'picker':
      case 'stay':
        a.tone(ladder(9, ROOT), 0.06, { type: 'sine', gain: 0.014 });
        break;
      default:
        break;
    }
  }
}
