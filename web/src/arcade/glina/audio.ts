/**
 * Glina's sound, on the kit's synthesiser (kit/audio.ts): a low, earthy D Dorian pad (its filter
 * follows the band in a sighted Toczenie, held still in rest and blind blocks), and the workshop's
 * craft around it: the kick wheel's wooden knock, wet squelches under the finger, the lump's slap,
 * the wire's zip at the cut, a golden arpeggio for the master's spin, the glaze bucket's plunk and a
 * brush's swish, the kiln's roar and ember ticks (slower as the heat evens), the needle's stop
 * (bells in the gold, a dull knock outside it), the door and the steam, and the sale's coins — their
 * pitch climbing with a streak of ★★★ (the combo ladder).
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { GlinaEvent, GlinaSim } from './sim';

const PAD = [73.42, 110, 146.83, 220];
const KILN = [73.42, 110, 164.81, 220];
const DORIAN = [293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33];

export class GlinaSound {
  private knock = 0.4;
  private roar = 0;
  private ember = 0;
  private squelch = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 300, bright: 1600, gain: 0.05 });
  }

  update(dt: number, sim: GlinaSim): void {
    const a = this.a;
    if (!a.on) return;
    this.squelch = Math.max(0, this.squelch - dt);
    if (sim.wheel === 'shape' || sim.wheel === 'assist' || sim.wheel === 'spin') {
      this.knock -= dt;
      if (this.knock <= 0) {
        this.knock += sim.wheel === 'spin' ? 0.4 : 0.9;
        a.noiseBurst(0.05, { type: 'bandpass', freq: 900, q: 4, gain: 0.025 });
      }
    }
    if (sim.kiln === 'heat' || sim.kiln === 'fire') {
      this.roar -= dt;
      if (this.roar <= 0) {
        this.roar += 2.4;
        a.noiseBurst(2.8, { type: 'lowpass', freq: 180, sweepTo: 260, gain: 0.03 });
      }
      this.ember -= dt;
      if (this.ember <= 0) {
        this.ember += (1 / (3.2 - 2 * sim.heat)) * (0.6 + 0.8 * Math.random());
        a.noiseBurst(0.025, { type: 'highpass', freq: 3500 + Math.random() * 2500, q: 1, gain: 0.022 });
      }
    }
  }

  on(e: GlinaEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'walk':
        a.bell(587.33, 0.03, 1.1, 0.05);
        a.bell(880, 0.025, 1.3, 0.2);
        break;
      case 'order':
        a.noiseBurst(0.09, { type: 'lowpass', freq: 500, gain: 0.06 });
        a.padChord(PAD, 1.5);
        break;
      case 'stroke':
        if (this.squelch > 0) break;
        this.squelch = 0.18;
        a.noiseBurst(e.mode === 'rim' ? 0.18 : 0.13, { type: 'lowpass', freq: e.mode === 'rim' ? 400 : 600, sweepTo: 900, gain: 0.03 });
        break;
      case 'assist':
        a.bell(DORIAN[4], 0.03, 1, 0);
        a.bell(DORIAN[6], 0.025, 1, 0.15);
        break;
      case 'spin':
        [0, 2, 4, 5, 7].forEach((n, i) => a.bell(DORIAN[n] * (i > 3 ? 2 : 1), 0.045, 1.6, i * 0.09));
        a.noiseBurst(1, { type: 'bandpass', freq: 2400, q: 0.6, gain: 0.02 });
        break;
      case 'cut':
        a.noiseBurst(0.3, { type: 'highpass', freq: 2000, sweepTo: 6000, gain: 0.035 });
        if (e.piece.match >= 0.88) a.bell(1174.66, 0.035, 0.9, 0.2);
        break;
      case 'dip':
        a.noiseBurst(0.05, { type: 'bandpass', freq: 1800, q: 4, gain: 0.04 });
        a.tone(300, 0.15, { type: 'sine', gain: 0.05, slideTo: 120, at: 0.05 });
        break;
      case 'band':
        a.noiseBurst(0.25, { type: 'bandpass', freq: 3000, q: 1.5, gain: 0.025 });
        break;
      case 'brush':
        a.tone(660, 0.05, { type: 'triangle', gain: 0.02 });
        break;
      case 'glazeDone':
        a.tone(440, 0.08, { type: 'triangle', gain: 0.025 });
        break;
      case 'heat':
        a.padChord(KILN, 2);
        this.roar = 0.2;
        this.ember = 0.4;
        break;
      case 'fire':
        if (e.grade === 'perfect') [0, 4, 7].forEach((n, i) => a.bell(DORIAN[n] * 2, 0.05, 1.6, i * 0.07));
        else if (e.grade === 'good') a.bell(DORIAN[4] * 2, 0.04, 1.2);
        else a.tone(110, 0.3, { type: 'sine', gain: 0.07, slideTo: 80 });
        break;
      case 'open':
        a.tone(220, 0.5, { type: 'triangle', gain: 0.025, slideTo: 160 });
        a.noiseBurst(0.8, { type: 'highpass', freq: 3000, gain: 0.03, at: 0.1 });
        break;
      case 'sale': {
        const n = Math.min(12, e.streak);
        for (let i = 0; i < Math.min(5, 1 + e.piece.stars); i++) a.bell(ladder(n + i, 880), 0.03, 0.5, i * 0.06);
        a.noiseBurst(0.12, { type: 'highpass', freq: 5000, gain: 0.03, at: 0.05 });
        break;
      }
      case 'market':
        [0, 2, 4].forEach((n, i) => a.bell(ladder(n, 660), 0.03, 0.6, i * 0.08));
        break;
      case 'newForm':
      case 'unlock':
        [0, 2, 4, 7].forEach((n, i) => a.bell(DORIAN[n], 0.04, 2, 0.1 + i * 0.14));
        break;
      case 'story':
        [0, 4, 7, 9].forEach((n, i) => a.bell(DORIAN[Math.min(7, n)] / 2, 0.04, 2.4, 0.3 + i * 0.2));
        break;
      case 'gift':
        [1318.5, 1567.98, 1760].forEach((f, i) => a.bell(f, 0.03, 1.6, i * 0.09));
        break;
      case 'reveal':
        a.bell(DORIAN[2], 0.03, 1.2);
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? KILN : PAD, 2);
        break;
      default:
        break;
    }
  }
}
