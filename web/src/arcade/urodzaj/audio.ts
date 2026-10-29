/**
 * Urodzaj's sound, on the kit's synthesiser (kit/audio.ts): a warm pad in D whose filter follows
 * what the screen shows (the runner drives it from UrodzajSim.padLevel: the vine in a sighted Zbiór,
 * held still in Rosa, in blind blocks and in the evening), a soft rush as a fruit leaves the twig, a
 * thud as it lands (deeper for bigger fruit), a plucked pair for every merge pitched by its tier and
 * a step higher for each link of a chain, bells for the great cluster, a wooden tick while the rim
 * warns and a patter of fruit rolling to the gleaners; the vine's shoots chime, the dew drips, the
 * crickets sing under the linen, and the evening closes on the lyre over an open fifth.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent, UrodzajSim } from './sim';

const DAY_CHORD = [73.42, 110, 146.83, 220];
const DUSK_CHORD = [61.74, 92.5, 123.47, 185];
const ROOT = 293.66;

export class UrodzajSound {
  private cricket = 2;
  private wind = 6;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY_CHORD, dark: 280, bright: 1600, gain: 0.05 });
  }

  update(dt: number, sim: UrodzajSim): void {
    const a = this.a;
    if (!a.on) return;
    const b = sim.block;
    const rest = sim.phase !== 'play' || b?.kind === 'rosa';
    // crickets under the linen and in the evening
    this.cricket -= dt;
    if (rest && this.cricket <= 0) {
      this.cricket = 0.9 + Math.random() * 1.6;
      const f = 4200 + Math.random() * 600;
      for (let i = 0; i < 3; i++) a.tone(f, 0.03, { type: 'sine', gain: 0.008, at: i * 0.06 });
    }
    // a breath of wind through the orchard now and then
    this.wind -= dt;
    if (this.wind <= 0) {
      this.wind = 7 + Math.random() * 6;
      a.noiseBurst(1.6, { type: 'bandpass', freq: 500, sweepTo: 900, q: 0.7, gain: 0.012 });
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'drop':
        a.noiseBurst(0.12, { type: 'bandpass', freq: 1400, sweepTo: 700, q: 1.5, gain: 0.02 });
        break;
      case 'land':
        if (e.speed < 0.35) break;
        a.noiseBurst(0.08, { type: 'lowpass', freq: 520 - e.tier * 35, gain: Math.min(0.06, 0.02 + e.speed * 0.02) });
        a.tone(150 - e.tier * 9, 0.09, { type: 'sine', gain: 0.03, slideTo: 90 });
        break;
      case 'merge': {
        // a plucked pair, lower for bigger fruit, a pentatonic step up for each link of a chain
        const f = ladder(Math.max(0, 9 - e.tier) + Math.min(6, e.link), ROOT);
        this.pluck(f, 0, e.via === 'touch' ? 0.06 : 0.05);
        this.pluck(f * 1.5, 0.08, 0.04);
        if (e.via === 'dew') a.tone(f * 3, 0.4, { type: 'sine', gain: 0.012, at: 0.1 });
        break;
      }
      case 'great':
        [0, 2, 4, 5, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.06, 2, i * 0.1));
        break;
      case 'warnTick':
        a.noiseBurst(0.03, { type: 'bandpass', freq: 1800, q: 6, gain: 0.02 + 0.02 * e.k });
        break;
      case 'spill':
        for (let i = 0; i < 6; i++) a.noiseBurst(0.05, { type: 'lowpass', freq: 400 + i * 30, gain: 0.03, at: i * 0.09 });
        this.pluck(ladder(2, ROOT / 2), 0.5, 0.04);
        break;
      case 'newBasket':
        a.noiseBurst(0.2, { type: 'bandpass', freq: 600, q: 2, gain: 0.02 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rosa' ? DUSK_CHORD : DAY_CHORD, 3);
        break;
      case 'telegraph':
        if (e.next === 'rosa' || e.next === 'evening') {
          this.pluck(ladder(4, ROOT), 0, 0.04);
          this.pluck(ladder(2, ROOT), 0.3, 0.04);
        } else {
          this.pluck(ladder(2, ROOT), 0, 0.04);
          this.pluck(ladder(4, ROOT), 0.3, 0.04);
        }
        break;
      case 'stamp':
        if (e.kind === 'almost') this.pluck(ladder(1, ROOT / 2), 0, 0.035);
        else [0, 2, 4].forEach((n, i) => a.bell(ladder(n + (e.kind === 'drop' ? 5 : 0), ROOT), 0.05, 1.6, i * 0.12));
        break;
      case 'revealZbior': case 'revealRosa':
        [0, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.14));
        break;
      case 'gather':
        if (e.pairs > 0) a.noiseBurst(0.5, { type: 'bandpass', freq: 900, sweepTo: 2200, q: 1, gain: 0.02 });
        break;
      case 'settle':
        if (e.dew > 0.05) a.noiseBurst(1, { type: 'highpass', freq: 3000, gain: 0.012 });
        break;
      case 'saved':
        a.bell(ladder(7, ROOT), 0.05, 1.6);
        break;
      case 'shoot':
        if (!e.blind) a.bell(ladder(5 + e.n, ROOT), 0.035, 1.2);
        break;
      case 'bead': {
        const f = 1600 + Math.random() * 500;
        a.tone(f, 0.07, { type: 'sine', gain: 0.015, slideTo: f * 0.6 });
        break;
      }
      case 'veil':
        a.noiseBurst(0.6, { type: 'bandpass', freq: 1200, sweepTo: 500, q: 0.8, gain: 0.012 });
        break;
      case 'tableStep':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, i * 0.12));
        break;
      case 'evening':
        a.padChord([73.42, 110, 146.83, 185], 3);
        break;
      case 'loaf':
        a.bell(ladder(2, ROOT), 0.045, 1.6);
        break;
      case 'guest':
        if (e.isNew) [0, 2, 4, 7].forEach((n, i) => this.pluck(ladder(n, ROOT), i * 0.13, 0.05));
        else this.pluck(ladder(4, ROOT), 0, 0.04);
        break;
      case 'enough':
        a.tone(73.42, 4, { type: 'sine', gain: 0.045, attack: 0.8 });
        a.tone(110, 3.8, { type: 'sine', gain: 0.035, attack: 1 });
        [0, 2, 4, 7, 9].forEach((n, i) => this.pluck(ladder(n, ROOT), 0.4 + i * 0.28, 0.045));
        break;
      default:
        break;
    }
  }

  /** A plucked, lyre-like string: a quick triangle with a quiet octave. */
  private pluck(f: number, at: number, gain = 0.06): void {
    this.a.tone(f, 0.8, { type: 'triangle', gain, at, attack: 0.004 });
    this.a.tone(f * 2, 0.45, { type: 'sine', gain: gain * 0.25, at, attack: 0.004 });
  }
}
