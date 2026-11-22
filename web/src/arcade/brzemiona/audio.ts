/**
 * Brzemiona's sounds, on the kit's synthesiser (kit/audio.ts): a warm, low pad in F whose filter opens as smoke turns
 * to light at the Cross; a soft bell when a burden is brought (the call), two rising when the circle widens; a high
 * small bell when the turning begins (gold), a glass tone climbing the pentatonic ladder each tenth of a circle; a
 * chime for a circle turned and three bells settling for a burden carried; the breath's soft wind (rising in,
 * falling out, quiet on a hold); a slow chord of bells as everything is left at the Cross.  No drums, no chant;
 * nothing loud.  Throttled, so many taps never become noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent } from './sim';

/** F major with an added ninth, low: the pad. */
const PAD = [87.31, 130.81, 174.61, 220, 261.63];
/** The bells' root: F4 (the pentatonic ladder F G A C D). */
const ROOT = 349.23;

export class BrzSound {
  private tapGap = 0;
  private tickGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 220, bright: 1500, gain: 0.045 });
  }

  update(dt: number): void {
    this.tapGap = Math.max(0, this.tapGap - dt);
    this.tickGap = Math.max(0, this.tickGap - dt);
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'call':
        a.bell(ladder(2, ROOT), 0.045, 2.6);
        a.noiseBurst(1.6, { type: 'lowpass', freq: 300, sweepTo: 900, gain: 0.012 });
        break;
      case 'widen':
        a.bell(ladder(e.circle === 'world' ? 5 : 3, ROOT), 0.035, 2.4);
        a.bell(ladder(e.circle === 'world' ? 7 : 5, ROOT), 0.03, 2.4, 0.28);
        break;
      case 'gold':
        if (e.on) a.bell(ladder(9, ROOT), 0.014, 1.2);
        break;
      case 'tenth':
        if (this.tickGap > 0) break;
        this.tickGap = 0.3;
        a.tone(ladder(4 + e.n, ROOT), 0.2, { type: 'sine', gain: 0.012 });
        break;
      case 'circle':
        a.bell(ladder(e.carried ? 7 : 5, ROOT), 0.06, 2.8);
        a.bell(ladder(e.carried ? 9 : 7, ROOT), 0.035, 2.6, 0.12);
        break;
      case 'carried':
        [7, 5, 2].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 3, 0.5 + i * 0.32));
        break;
      case 'breathTurn':
        if (e.phase === 'in') a.noiseBurst(Math.max(0.6, e.len * 0.92), { type: 'lowpass', freq: 260, sweepTo: 820, gain: e.rest ? 0.02 : 0.013 });
        else if (e.phase === 'out') a.noiseBurst(Math.max(0.6, e.len * 0.92), { type: 'lowpass', freq: 820, sweepTo: 230, gain: e.rest ? 0.018 : 0.012 });
        else a.bell(ladder(e.phase === 'holdIn' ? 4 : 0, ROOT), 0.01, 1.4);
        break;
      case 'tap':
        if (this.tapGap > 0) break;
        this.tapGap = 0.12;
        a.tone(ladder(5, ROOT), 0.22, { type: 'triangle', gain: 0.016, slideTo: ladder(5, ROOT) * 1.004 });
        break;
      case 'chooser':
      case 'queued':
        a.tone(ladder(e.type === 'chooser' ? 3 : 6, ROOT), 0.12, { type: 'sine', gain: 0.012 });
        break;
      case 'story':
        a.bell(ladder(4, ROOT), 0.03, 2.4);
        break;
      case 'finale':
        [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 3.4, i * 0.4));
        break;
      default:
        break;
    }
  }
}
