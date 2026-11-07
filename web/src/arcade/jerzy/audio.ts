/**
 * Jerzy i smok's sound, on the kit's synthesiser (kit/audio.ts): a bright modal pad (D Dorian, a
 * fiddler's tune) whose filter follows the shield in a sighted Tarcza (the runner drives it from
 * JerzySim.padLevel) and holds still elsewhere; the strike — a metal "shing" and a thump — with a bell
 * that climbs as the scales fly; the hiss of a flame put out; the Miecz światła's swell; the dragon's
 * growl before an attack, its roar at a new phase; a low thud when a blow lands; the white horse's
 * hooves; the squire's splash; the Postój's slow tune; a fanfare when a dragon flies off.  A missed
 * verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { JerzySim, SimEvent } from './sim';

const FIGHT = [73.42, 110, 146.83, 220];
const REST = [73.42, 110, 164.81, 246.94];
const ROOT = 587.33;
/** the Postój's tune: gentle steps of the pentatonic */
const TUNE = [0, 2, 4, 2, 0, 1, 2, 4, 5, 4, 2, 1, 0];

export class JerzySound {
  private tuneI = 0;
  private tuneT = 0;
  private scaleN = 0;
  private hiss = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: FIGHT, dark: 260, bright: 2100, gain: 0.045 });
  }

  update(dt: number, sim: JerzySim): void {
    const a = this.a;
    if (!a.on) return;
    this.hiss = Math.max(0, this.hiss - dt);
    if (sim.restBlock) {
      this.tuneT -= dt;
      if (this.tuneT <= 0) {
        this.tuneT = this.tuneI % 4 === 3 ? 1.1 : 0.7;
        a.bell(ladder(TUNE[this.tuneI % TUNE.length], ROOT / 2), 0.028, 1.6);
        this.tuneI++;
      }
    } else this.tuneT = 0.5;
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'strike':
        a.noiseBurst(0.1, { type: 'bandpass', freq: 3200, sweepTo: 6000, q: 2, gain: 0.04 });
        a.tone(e.sword ? 110 : 150, 0.12, { type: 'sine', gain: 0.1, slideTo: 70 });
        if (e.sword) {
          a.tone(146.83, 1.4, { type: 'sawtooth', gain: 0.025, attack: 0.02, slideTo: 293.66 });
          [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.6, i * 0.05));
        }
        break;
      case 'scales':
        a.bell(ladder(this.scaleN++ % 12, ROOT), 0.035, 0.6);
        break;
      case 'quench':
        if (this.hiss <= 0 || e.big) {
          this.hiss = 0.12;
          a.noiseBurst(e.big ? 0.5 : 0.22, { type: 'highpass', freq: 3500, sweepTo: 7000, gain: e.big ? 0.05 : 0.025 });
        }
        break;
      case 'reflect':
        a.bell(ladder(9, ROOT), 0.03, 0.6);
        break;
      case 'burn':
        a.tone(e.what === 'blob' ? 220 : 110, 0.2, { type: 'triangle', gain: 0.05, slideTo: e.what === 'blob' ? 180 : 60 });
        if (e.what !== 'blob') a.noiseBurst(0.15, { type: 'lowpass', freq: 500, gain: 0.07 });
        break;
      case 'land':
        a.noiseBurst(0.3, { type: 'lowpass', freq: 900, sweepTo: 200, gain: 0.05 });
        break;
      case 'roll':
        a.noiseBurst(0.18, { type: 'bandpass', freq: 600, sweepTo: 300, q: 0.8, gain: 0.03 });
        break;
      case 'tele':
        // the dragon's growl before an attack
        a.tone(e.pattern === 'breath' ? 82 : 98, 0.6, { type: 'sawtooth', gain: 0.018, attack: 0.15, slideTo: e.pattern === 'breath' ? 110 : 82 });
        break;
      case 'attack':
        if (e.pattern === 'breath') a.noiseBurst(1.2, { type: 'bandpass', freq: 500, sweepTo: 1400, q: 0.6, gain: 0.05 });
        else a.noiseBurst(0.2, { type: 'lowpass', freq: 400, gain: 0.06 });
        break;
      case 'surface':
        a.noiseBurst(0.5, { type: 'lowpass', freq: 1200, sweepTo: 300, gain: 0.07 });
        break;
      case 'flaw':
        if (e.tip) [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.04, 0.8, i * 0.06));
        break;
      case 'phase':
        a.tone(55, 1.2, { type: 'sawtooth', gain: 0.04, attack: 0.05, slideTo: 41 });
        a.noiseBurst(0.9, { type: 'lowpass', freq: 600, gain: 0.05 });
        break;
      case 'driven':
        [0, 2, 4, 5, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, i * 0.09));
        a.padChord([73.42, 110, 146.83, 185], 3);
        break;
      case 'swordReady':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.045, 1.2, i * 0.06));
        break;
      case 'level':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.2, i * 0.06));
        break;
      case 'skill':
        a.bell(ladder(12, ROOT), 0.045, 1.4);
        break;
      case 'lance':
        a.noiseBurst(0.2, { type: 'bandpass', freq: 1800, sweepTo: 900, gain: 0.03 });
        break;
      case 'horse':
        for (let i = 0; i < 6; i++) a.tone(180 + (i % 2) * 40, 0.06, { type: 'triangle', gain: 0.04, at: i * 0.12 });
        break;
      case 'squire':
        a.noiseBurst(0.35, { type: 'bandpass', freq: 1400, sweepTo: 500, q: 0.7, gain: 0.04 });
        break;
      case 'down':
        a.tone(196, 0.6, { type: 'sine', gain: 0.05, slideTo: 130, attack: 0.02 });
        break;
      case 'up':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1, i * 0.08));
        break;
      case 'tip':
      case 'restPass':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.4, i * 0.1));
        break;
      case 'smoke':
        a.tone(146.83, 1, { type: 'sine', gain: 0.04, attack: 0.2, slideTo: 293.66 });
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(73.42, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(293.66, 0.5, { type: 'triangle', gain: 0.02, slideTo: 329.63 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? REST : FIGHT, 3);
        this.tuneI = 0;
        break;
      case 'done':
        a.padChord([73.42, 110, 146.83, 220], 3);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, 0.3 + i * 0.25));
        break;
      default:
        break;
    }
  }
}
