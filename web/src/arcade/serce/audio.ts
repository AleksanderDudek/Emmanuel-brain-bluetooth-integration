/**
 * Z głowy do serca's sounds on the kit's synthesiser (kit/audio.ts), gentle and few: a warm pad in F with an added
 * ninth whose brightness follows the light (the runner's padLevel); a soft bell descending the pentatonic ladder as
 * the light passes the eyes, the mouth, the throat and arrives in the heart; a low warm chord when the flame kindles;
 * one small bell per lamp, its pitch the ring's (higher for the nearer circles), throttled; a chime when the field
 * touches a ring; a glassy shimmer as ring 4's thorns blossom; the breath's soft wind in rest; a swell when the sun
 * rises.  No drums, no chant.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SerceSim, SimEvent } from './sim';

/** F major with an added ninth, low. */
const PAD = [174.61, 261.63, 349.23, 392.0];
/** The bells' root: F4. */
const ROOT = 349.23;
const PLACE_STEP: Record<string, number> = { eyes: 9, mouth: 7, throat: 5, heart: 3 };

export class SerceSound {
  private lampGap = 0;
  private tapGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 260, bright: 1500, gain: 0.05 });
  }

  update(dt: number): void {
    this.lampGap = Math.max(0, this.lampGap - dt);
    this.tapGap = Math.max(0, this.tapGap - dt);
  }

  on(e: SimEvent, sim: SerceSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'place':
        a.bell(ladder(PLACE_STEP[e.place] ?? 5, ROOT), 0.05, 2.2);
        break;
      case 'kindled':
        [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.06, 3.2, i * 0.14));
        a.noiseBurst(1.6, { type: 'lowpass', freq: 300, sweepTo: 1200, gain: 0.014 });
        break;
      case 'whole':
        [2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.045, 3, i * 0.12));
        break;
      case 'reach':
        a.bell(ladder(10 - e.ring, ROOT / 2), 0.05, 2.6);
        a.noiseBurst(1.2, { type: 'bandpass', freq: 900, sweepTo: 2400, q: 0.9, gain: 0.012 });
        break;
      case 'lamp': {
        if (this.lampGap > 0) break;
        this.lampGap = 0.12;
        const n = 12 - e.ring * 1.5 + (e.i % 3);
        a.tone(ladder(Math.round(n), ROOT / 2), 0.4, { type: 'sine', gain: 0.016 });
        if (e.ring === 4) a.noiseBurst(0.5, { type: 'bandpass', freq: 3400, sweepTo: 5200, q: 1.4, gain: 0.006 });
        break;
      }
      case 'ringDone':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT / 2), 0.04, 2.6, i * 0.1));
        break;
      case 'sunUp':
        [0, 2, 4, 5, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT / 2), 0.035, 3.4, i * 0.16));
        a.noiseBurst(2.6, { type: 'lowpass', freq: 400, sweepTo: 2200, gain: 0.016 });
        break;
      case 'home':
        [7, 4, 2, 0].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.045, 3, i * 0.2));
        break;
      case 'more':
        a.tone(ladder(9 + (e.n % 3), ROOT / 2), 0.5, { type: 'sine', gain: 0.014 });
        break;
      case 'breathTurn':
        if (e.phase === 'in') a.noiseBurst(Math.max(0.6, e.len * 0.92), { type: 'lowpass', freq: 240, sweepTo: 820, gain: 0.018 });
        else if (e.phase === 'out') a.noiseBurst(Math.max(0.6, e.len * 0.92), { type: 'lowpass', freq: 820, sweepTo: 220, gain: 0.016 });
        else a.bell(ladder(e.phase === 'holdIn' ? 7 : 2, ROOT / 2), 0.01, 1.6);
        break;
      case 'tap':
        if (this.tapGap > 0) break;
        this.tapGap = 0.15;
        a.tone(ladder(sim.restBlock ? 7 : 5, ROOT), 0.25, { type: 'triangle', gain: 0.014 });
        break;
      case 'story':
        a.bell(ladder(4, ROOT), 0.03, 2.2);
        break;
      default:
        break;
    }
  }
}
