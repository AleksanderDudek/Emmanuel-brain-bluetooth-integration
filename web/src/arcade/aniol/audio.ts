/**
 * Anioł Stróż's sound, on the kit's synthesiser (kit/audio.ts): a soft lullaby pad in F whose
 * filter follows the aura in a sighted Czuwanie (the runner drives it from AniolSim.padLevel) and
 * holds still elsewhere; the strike — an airy whoosh with a bright "shing" — then on a hit a low
 * thump and a bell that climbs the combo's ladder; the banishing's sparkle of rising bells; the
 * dull clang of armour, its crack; a soft breath for a whiff; the harp in the lullaby; the
 * lullaby's melody hummed by bells; the Płomień's swell; Koszmar's low drone and its dissolving
 * chord; the dawn.  The child's bed only ever hears soft sounds.  A missed verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { AniolSim, SimEvent } from './sim';

const WATCH = [87.31, 130.81, 174.61, 220];
const LULL = [87.31, 130.81, 164.81, 220];
const ROOT = 523.25;
/** the lullaby's tune: steps of the major pentatonic, gently up and down */
const TUNE = [4, 2, 0, 2, 4, 4, 4, 3, 2, 2, 2, 4, 6, 6, 4, 2, 0, 2, 4, 4, 4, 4, 2, 2, 4, 2, 0];

export class AniolSound {
  private tuneI = 0;
  private tuneT = 0;
  private drone = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: WATCH, dark: 240, bright: 1900, gain: 0.05 });
  }

  update(dt: number, sim: AniolSim): void {
    const a = this.a;
    if (!a.on) return;
    // the lullaby hummed by the angel, one bell at a time
    if (sim.restBlock) {
      this.tuneT -= dt;
      if (this.tuneT <= 0) {
        this.tuneT = this.tuneI % 3 === 2 ? 0.95 : 0.62;
        a.bell(ladder(TUNE[this.tuneI % TUNE.length], ROOT / 2), 0.03, 1.6);
        this.tuneI++;
      }
    } else this.tuneT = 0.4;
    // Koszmar's low drone while it is in the room
    if (sim.koszmar === 'come') {
      this.drone -= dt;
      if (this.drone <= 0) {
        this.drone = 2.2;
        a.tone(55, 2.4, { type: 'sine', gain: 0.035, attack: 0.6 });
        a.noiseBurst(2, { type: 'lowpass', freq: 220, gain: 0.02 });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'strike':
        // the sweep: air, then a bright edge of light
        a.noiseBurst(e.hit ? 0.16 : 0.12, { type: 'bandpass', freq: 1400, sweepTo: e.hit ? 5200 : 2600, q: 0.9, gain: e.hit ? 0.06 : 0.035 });
        if (e.hit) a.tone(1760, 0.12, { type: 'triangle', gain: 0.025, slideTo: 2640 });
        break;
      case 'hit':
        a.tone(e.kind === 'koszmar' ? 70 : 110, 0.14, { type: 'sine', gain: 0.11, slideTo: 55 });
        a.noiseBurst(0.06, { type: 'lowpass', freq: 700, gain: 0.06 });
        a.bell(ladder(Math.min(19, e.combo % 20), ROOT), 0.045, 0.7);
        break;
      case 'banish':
        if (e.kind === 'koszmar') {
          [0, 4, 7, 9, 12, 14, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.06, 2.4, i * 0.08));
          a.tone(87.31, 3, { type: 'sine', gain: 0.06, attack: 0.3 });
          a.noiseBurst(1.4, { type: 'bandpass', freq: 600, sweepTo: 4000, gain: 0.04 });
        } else {
          a.noiseBurst(0.35, { type: 'highpass', freq: 3000, sweepTo: 8000, gain: 0.025 });
          a.bell(ladder(7 + (e.id % 5), ROOT), 0.035, 1.1, 0.03);
        }
        break;
      case 'bounce':
        a.tone(240, 0.18, { type: 'square', gain: 0.03, slideTo: 200 });
        a.tone(720, 0.12, { type: 'triangle', gain: 0.03 });
        a.noiseBurst(0.08, { type: 'bandpass', freq: 2400, q: 3, gain: 0.04 });
        break;
      case 'crack':
        a.noiseBurst(0.3, { type: 'highpass', freq: 1800, gain: 0.06 });
        a.bell(ladder(9, ROOT), 0.05, 1.2);
        break;
      case 'split':
        a.noiseBurst(0.2, { type: 'bandpass', freq: 900, sweepTo: 300, gain: 0.04 });
        break;
      case 'whiff':
        a.noiseBurst(0.14, { type: 'bandpass', freq: 700, sweepTo: 400, q: 0.7, gain: 0.025 });
        break;
      case 'harp':
        a.tone(ladder(e.n % 10, ROOT / 2), 1.1, { type: 'triangle', gain: 0.045, attack: 0.004 });
        a.tone(ladder(e.n % 10, ROOT / 2) * 2, 0.6, { type: 'sine', gain: 0.012, attack: 0.004 });
        break;
      case 'combo':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + (e.mult - 2) * 5, ROOT), 0.05, 1.2, i * 0.06));
        break;
      case 'touch':
        a.tone(196, 0.5, { type: 'sine', gain: 0.04, slideTo: 165, attack: 0.04 });
        break;
      case 'shield':
        a.noiseBurst(0.3, { type: 'bandpass', freq: 2000, sweepTo: 600, gain: 0.04 });
        a.bell(ladder(5, ROOT), 0.045, 1.2);
        break;
      case 'stir':
        // a soft "shh" and two falling notes: the angel soothes the child
        a.noiseBurst(0.9, { type: 'highpass', freq: 2500, gain: 0.025 });
        a.bell(ladder(4, ROOT / 2), 0.04, 1.6, 0.2);
        a.bell(ladder(2, ROOT / 2), 0.04, 1.8, 0.55);
        break;
      case 'flame':
        a.tone(174.61, 1.8, { type: 'sawtooth', gain: 0.025, attack: 0.05, slideTo: 349.23 });
        [0, 2, 4, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.8, i * 0.05));
        a.noiseBurst(1.2, { type: 'bandpass', freq: 400, sweepTo: 5000, q: 0.6, gain: 0.05 });
        break;
      case 'level':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.3, i * 0.07));
        break;
      case 'gift':
        a.bell(ladder(12, ROOT), 0.05, 1.6);
        a.bell(ladder(14, ROOT), 0.04, 1.6, 0.12);
        break;
      case 'star':
        a.bell(ladder(5 + e.n, ROOT), 0.03, 2);
        break;
      case 'restPass':
      case 'dayGift':
      case 'rank':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.1));
        break;
      case 'burst':
        a.tone(174.61, 1.2, { type: 'sine', gain: 0.045, attack: 0.15, slideTo: 349.23 });
        if (e.share > 0.3) [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.4, 0.3 + i * 0.1));
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(87.31, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(349.23, 0.5, { type: 'triangle', gain: 0.02, slideTo: 392 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? LULL : WATCH, 3);
        this.tuneI = 0;
        break;
      case 'koszmar':
        if (e.what === 'come' || e.what === 'turn') a.tone(65.41, 1.4, { type: 'triangle', gain: 0.04, attack: 0.3, slideTo: 49 });
        break;
      case 'dawn':
        a.padChord([87.31, 130.81, 174.61, 261.63], 3);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, 0.4 + i * 0.25));
        break;
      default:
        break;
    }
  }
}
