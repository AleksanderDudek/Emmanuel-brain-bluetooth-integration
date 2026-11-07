/**
 * Wzlot's sound, on the kit's synthesiser (kit/audio.ts): an open desert pad in D whose filter
 * follows the focus in a sighted push block (the runner drives it from WzlotSim.padLevel); the wind,
 * louder with the eaglet's speed and a rush while it dives; a perfect slide's plucked note climbing
 * the pentatonic ladder with the chain; the promyki's tiny bells rising with a streak; the Poryw's
 * fanfare; a bump's thud; the mother's high cry and a warm chord when she sets the eaglet down; the
 * thermal's swell; a grań's chime; the nightfall's lullaby and the tally's count.  A lapse makes no
 * sound at all.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent, WzlotSim } from './sim';

const DAY = [73.42, 110, 146.83, 220];
const REST = [65.41, 98, 130.81, 196];
const ROOT = 440;

export class WzlotSound {
  private wind = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY, dark: 240, bright: 1600, gain: 0.05 });
  }

  update(dt: number, sim: WzlotSim): void {
    const a = this.a;
    if (!a.on || sim.dayPhase !== 'fly') return;
    this.wind -= dt;
    if (this.wind <= 0) {
      const e = sim.eaglet;
      const sp = Math.min(3.5, e.speed || 0);
      const dive = sim.held && e.airborne;
      this.wind = dive ? 0.22 : 0.45;
      a.noiseBurst(dive ? 0.35 : 0.6, { type: 'bandpass', freq: 380 + sp * 260 + (sim.fever ? 400 : 0), q: 0.7, gain: 0.006 + sp * (dive ? 0.006 : 0.003) });
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'perfect':
        this.pluck(ladder(Math.min(12, e.chain + 1), ROOT), 0, 0.055);
        break;
      case 'land':
        if (e.cls === 'smooth' || e.cls === 'near') a.noiseBurst(0.1, { type: 'lowpass', freq: 900, gain: 0.015 });
        break;
      case 'bump':
        a.noiseBurst(0.16, { type: 'lowpass', freq: 300, gain: 0.06 });
        a.tone(110, 0.2, { type: 'sine', gain: 0.05, slideTo: 70 });
        break;
      case 'fever':
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.4, i * 0.06));
        a.noiseBurst(0.6, { type: 'bandpass', freq: 900, sweepTo: 2600, q: 0.8, gain: 0.03 });
        break;
      case 'feverEnd':
        a.tone(ladder(4, ROOT), 0.4, { type: 'triangle', gain: 0.025, slideTo: ladder(0, ROOT) });
        break;
      case 'coin':
        a.bell(ladder(5 + Math.min(10, e.streak), ROOT), 0.025, 0.4);
        break;
      case 'orb':
        a.noiseBurst(0.5, { type: 'bandpass', freq: 700, sweepTo: 2200, q: 1, gain: 0.04 });
        break;
      case 'cloud':
        a.noiseBurst(0.6, { type: 'highpass', freq: 2400, gain: 0.02 });
        a.bell(ladder(9, ROOT), 0.03, 1.2);
        break;
      case 'launch':
        a.noiseBurst(0.25, { type: 'highpass', freq: 1800, gain: e.perfect ? 0.02 : 0.01 });
        break;
      case 'leap':
        a.tone(220, 0.6, { type: 'triangle', gain: 0.03, slideTo: 440 });
        break;
      case 'gran':
        [0, 4, 7].forEach((n, i) => this.pluck(ladder(n, ROOT), i * 0.09, 0.045));
        break;
      case 'catch':
        a.tone(1900, 0.35, { type: 'triangle', gain: 0.03, slideTo: 1300 });
        a.tone(1700, 0.3, { type: 'triangle', gain: 0.02, at: 0.32, slideTo: 1150 });
        for (let i = 0; i < 3; i++) a.noiseBurst(0.12, { type: 'bandpass', freq: 520, q: 1, gain: 0.03, at: 0.2 + i * 0.16 });
        break;
      case 'carried':
        a.tone(220, 0.9, { type: 'sine', gain: 0.04, attack: 0.08 });
        a.tone(329.63, 0.8, { type: 'sine', gain: 0.03, attack: 0.1, at: 0.08 });
        break;
      case 'thermal':
        a.tone(196, 1.6, { type: 'sine', gain: 0.04, attack: 0.3, slideTo: 392 });
        a.noiseBurst(1.2, { type: 'bandpass', freq: 600, sweepTo: 1400, q: 0.8, gain: 0.015 });
        break;
      case 'climbTop':
        this.pluck(ladder(5, ROOT), 0, 0.04);
        break;
      case 'telegraph':
        if (e.next.kind === 'push' && !e.next.blind) a.tone(1500, 0.4, { type: 'triangle', gain: 0.018, slideTo: 1100 });
        else if (e.next.kind === 'rest') a.tone(130.81, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? REST : DAY, 3);
        break;
      case 'blockEnd':
        if (e.verdict) [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.4, i * 0.1));
        break;
      case 'nightfall':
        [7, 4, 2, 0].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.4, i * 0.35));
        break;
      case 'tally':
        if (e.tally.record) [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.8, 0.3 + i * 0.12));
        break;
      case 'dawn':
        [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.03, 1.6, i * 0.2));
        break;
      case 'lesson':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.1));
        break;
      case 'nest':
      case 'hatch':
        [0, 2, 4, 5, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2.2, i * 0.12));
        break;
      case 'finale':
        a.padChord([73.42, 110, 146.83, 185], 3);
        break;
      default:
        break;
    }
  }

  /** A plucked string: a quick triangle with a quiet octave. */
  private pluck(f: number, at: number, gain = 0.06): void {
    this.a.tone(f, 0.8, { type: 'triangle', gain, at, attack: 0.004 });
    this.a.tone(f * 2, 0.45, { type: 'sine', gain: gain * 0.25, at, attack: 0.004 });
  }
}
