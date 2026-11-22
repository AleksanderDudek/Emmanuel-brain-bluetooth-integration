/**
 * Światło w dłoniach's sounds, on the kit's synthesiser (kit/audio.ts), all gentle: a warm low pad whose filter
 * follows the light in a sighted push (the runner's padLevel), the rub's soft friction, the breath's quiet wind in
 * rest, a high glint for the spark, a glass tone each tenth of the growth or the rise, two bells when the ball is
 * whole, a soft chord when it takes the name, a rising arpeggio when a lifted prayer blooms and a low warm bell when a
 * hand is laid; a quiet click for the buttons.  No voice, no chant.  Throttled.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { DlonieSim, SimEvent } from './sim';

/** D major with an added ninth, low: the pad. */
const PAD = [146.83, 220, 293.66, 329.63];
const ROOT = 587.33;

export class DlonieSound {
  private tickGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 240, bright: 1500, gain: 0.035 });
  }

  update(dt: number): void {
    this.tickGap = Math.max(0, this.tickGap - dt);
  }

  on(e: SimEvent, sim: DlonieSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'step':
        if (e.step === 'rub') a.noiseBurst(Math.min(5, sim.stepDur), { type: 'bandpass', freq: 1700, q: 0.8, gain: 0.01 });
        break;
      case 'spark':
        a.bell(ladder(9, ROOT), 0.03, 1.4);
        break;
      case 'tick':
        if (this.tickGap > 0) break;
        this.tickGap = 0.15;
        a.tone(ladder(e.k + (e.what === 'rise' ? 5 : 2), ROOT / 2), 0.2, { type: 'sine', gain: 0.011 });
        break;
      case 'grown':
        a.bell(ladder(4, ROOT / 2), 0.05, 2);
        a.bell(ladder(7, ROOT / 2), 0.035, 2.2, 0.14);
        break;
      case 'named':
        [0, 2, 4].forEach((k, i) => a.bell(ladder(k, ROOT / 2), 0.025, 2.4, i * 0.09));
        break;
      case 'offered':
        if (e.lay) a.bell(ladder(0, ROOT / 4), 0.06, 3);
        else [0, 2, 4, 7, 9].forEach((k, i) => a.bell(ladder(k + 5, ROOT / 2), 0.045, 2.6, i * 0.16));
        break;
      case 'breath':
        if (e.phase === 'in') a.noiseBurst(sim.pattern.in, { type: 'lowpass', freq: 260, sweepTo: 820, gain: 0.016 });
        else if (e.phase === 'out') a.noiseBurst(sim.pattern.out, { type: 'lowpass', freq: 820, sweepTo: 240, gain: 0.014 });
        break;
      case 'gold':
        if (e.on) a.bell(1568, 0.012, 1);
        break;
      case 'blindEnd':
        [0, 4, 7].forEach((k, i) => a.bell(ladder(k, ROOT / 2), 0.035, 2, i * 0.1));
        break;
      case 'picker':
      case 'who':
      case 'place':
      case 'stay':
        a.tone(ladder(9, ROOT), 0.06, { type: 'sine', gain: 0.012 });
        break;
      default:
        break;
    }
  }
}
