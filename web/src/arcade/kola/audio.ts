/**
 * Koła światła's sounds, on the kit's synthesiser (kit/audio.ts), all gentle: a low open pad whose filter follows the
 * light in a sighted push (the runner's padLevel) and holds still in rest; a glass tone when a quality comes right; a
 * bell when a wheel turns true, pitched by its place (the base lowest, the crown highest on a pentatonic ladder); two
 * bells a fifth apart when a centre's front and back balance; a faint tick as petals light (throttled); the breath's
 * quiet wind in rest; in the field a bell for each layer rising from the base to the crown, and a chord when the light
 * is whole.  No voice, no chant.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { CENTRES } from './content';
import type { KolaSim, SimEvent } from './sim';

/** C and G low, D and E above: an open, unresolved calm. */
const PAD = [130.81, 196, 293.66, 329.63];
const ROOT = 523.25;

export class KolaSound {
  private tickGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 220, bright: 1400, gain: 0.032 });
  }

  update(dt: number): void {
    this.tickGap = Math.max(0, this.tickGap - dt);
  }

  on(e: SimEvent, sim: KolaSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'step':
        a.tone(ladder(CENTRES.indexOf(sim.run(e.wheel).centre) + 5, ROOT / 2), 0.35, { type: 'sine', gain: 0.012 });
        break;
      case 'true': {
        const k = CENTRES.indexOf(sim.run(e.wheel).centre);
        a.bell(ladder(k + 2, ROOT / 2), 0.05, 2.4);
        a.bell(ladder(k + 7, ROOT / 2), 0.018, 2.8, 0.06);
        break;
      }
      case 'pair': {
        const k = CENTRES.indexOf(e.centre);
        a.bell(ladder(k + 2, ROOT / 4), 0.035, 3, 0.35);
        a.bell(ladder(k + 5, ROOT / 4), 0.03, 3.2, 0.5);
        break;
      }
      case 'petal':
        if (this.tickGap > 0) break;
        this.tickGap = 0.16;
        a.tone(ladder(e.n % 5 + 10, ROOT / 2), 0.12, { type: 'sine', gain: 0.006 });
        break;
      case 'layer':
        a.bell(ladder(e.i + 2, ROOT / 2), 0.04, 3);
        break;
      case 'whole':
        [0, 2, 4, 7].forEach((k, i) => a.bell(ladder(k + 5, ROOT / 2), 0.035, 3.4, i * 0.12));
        break;
      case 'breath':
        if (e.phase === 'in') a.noiseBurst(Math.max(1, sim.pattern.in), { type: 'lowpass', freq: 260, sweepTo: 820, gain: 0.014 });
        else a.noiseBurst(Math.max(1, sim.pattern.out), { type: 'lowpass', freq: 820, sweepTo: 240, gain: 0.012 });
        break;
      case 'block':
        if (e.what === 'rest') a.bell(ladder(0, ROOT / 4), 0.025, 2.6);
        break;
      case 'tap':
        a.tone(ladder(9, ROOT), 0.06, { type: 'sine', gain: 0.01 });
        break;
      default:
        break;
    }
  }
}
