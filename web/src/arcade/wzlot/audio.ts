/**
 * Wzlot's sound, on the kit's synthesiser (kit/audio.ts): an open desert pad in D whose filter
 * follows the wings in a sighted Lekcja (the runner drives it from WzlotSim.padLevel) and holds
 * still elsewhere; the wind, louder and brighter with the eaglet's speed and a rush in a dive; a
 * smooth landing's soft plucked note, a semitone higher with each link of the chain; the soaring
 * chime; the parent's high cry when it comes to catch and a warm chord when it sets the eaglet
 * down; the thermal's rising swell; feathers, vistas and new plumage as bells; the nest's lullaby.
 * A lapse makes no sound at all.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent, WzlotSim } from './sim';

const LESSON = [73.42, 110, 146.83, 220];
const RISING = [65.41, 98, 130.81, 196];
const ROOT = 440;

export class WzlotSound {
  private wind = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: LESSON, dark: 240, bright: 1600, gain: 0.05 });
  }

  update(dt: number, sim: WzlotSim): void {
    const a = this.a;
    if (!a.on) return;
    // the wind: a soft gust now and then, brighter with speed, a rush while diving
    this.wind -= dt;
    if (this.wind <= 0) {
      const e = sim.eaglet;
      const sp = Math.min(3.5, e.speed || 0);
      const dive = sim.held && e.airborne;
      this.wind = dive ? 0.22 : 0.45;
      a.noiseBurst(dive ? 0.35 : 0.6, { type: 'bandpass', freq: 380 + sp * 260, q: 0.7, gain: 0.006 + sp * (dive ? 0.006 : 0.003) });
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'land':
        if (e.cls === 'smooth') this.pluck(ROOT * 2 ** (Math.min(12, e.chain) / 12), 0, 0.05);
        else if (e.cls === 'near') this.pluck(ROOT * 0.75, 0, 0.035);
        else a.noiseBurst(0.12, { type: 'lowpass', freq: 420, gain: e.cls === 'stall' ? 0.05 : 0.03 });
        break;
      case 'soar':
        [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.4, i * 0.08));
        break;
      case 'soarEnd':
        break;
      case 'launch':
        a.noiseBurst(0.25, { type: 'highpass', freq: 1800, gain: 0.012 });
        break;
      case 'crag':
        this.pluck(ladder(4, ROOT), 0, 0.04);
        this.pluck(ladder(7, ROOT), 0.12, 0.04);
        break;
      case 'catch':
        // the parent's high cry, then its wings
        a.tone(1900, 0.35, { type: 'triangle', gain: 0.03, slideTo: 1300 });
        a.tone(1700, 0.3, { type: 'triangle', gain: 0.02, at: 0.32, slideTo: 1150 });
        for (let i = 0; i < 3; i++) a.noiseBurst(0.12, { type: 'bandpass', freq: 520, q: 1, gain: 0.03, at: 0.2 + i * 0.16 });
        break;
      case 'carried':
        a.tone(220, 0.9, { type: 'sine', gain: 0.04, attack: 0.08 });
        a.tone(329.63, 0.8, { type: 'sine', gain: 0.03, attack: 0.1, at: 0.08 });
        break;
      case 'telegraph':
        if (e.next.kind === 'lekcja' && !e.next.blind) a.tone(1500, 0.4, { type: 'triangle', gain: 0.018, slideTo: 1100 });
        else if (e.next.kind === 'wzn') a.tone(130.81, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'wzn' ? RISING : LESSON, 3);
        break;
      case 'step':
        a.bell(ladder(2 + Math.round(e.bonus * 25), ROOT), 0.03, 0.9);
        break;
      case 'return':
        a.bell(ladder(e.gold ? 9 : 7, ROOT), 0.05, 1.6);
        if (e.gold) a.bell(ladder(11, ROOT), 0.04, 1.8, 0.12);
        break;
      case 'thermal':
        a.tone(196, 1.6, { type: 'sine', gain: 0.04, attack: 0.3, slideTo: 392 });
        a.noiseBurst(1.2, { type: 'bandpass', freq: 600, sweepTo: 1400, q: 0.8, gain: 0.015 });
        break;
      case 'climbTop':
        this.pluck(ladder(5, ROOT), 0, 0.04);
        break;
      case 'vistaSeen':
        [0, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, i * 0.15));
        break;
      case 'vista':
        if (e.isNew) [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.8, i * 0.1));
        else a.bell(ladder(2, ROOT), 0.035, 1.2);
        break;
      case 'feather':
        a.bell(ladder(4, ROOT), 0.04, 1.4);
        break;
      case 'stage':
        [0, 2, 4, 5, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2.2, i * 0.12));
        break;
      case 'mission':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.1));
        break;
      case 'blindReveal':
        if (e.T > 0) [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.4, i * 0.1));
        break;
      case 'wingbeat':
        a.noiseBurst(0.18, { type: 'bandpass', freq: 480, q: 1.2, gain: 0.05 });
        break;
      case 'gift':
        a.bell(ladder(7, ROOT), 0.045, 1.6);
        break;
      case 'finale':
        a.padChord([73.42, 110, 146.83, 185], 3);
        a.tone(73.42, 4.5, { type: 'sine', gain: 0.045, attack: 1 });
        break;
      case 'nest':
        [7, 4, 2, 0].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.4, i * 0.35));
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
