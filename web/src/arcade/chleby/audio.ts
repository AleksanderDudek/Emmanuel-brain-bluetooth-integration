/**
 * Chleby i ryby's sound, on the kit's synthesiser (kit/audio.ts): a warm pad in D whose filter
 * follows the golden gate in a sighted Rozdawanie (the runner drives it from ChlebySim.padLevel) and
 * holds still elsewhere; the basket's soft "pop" as a runner leaves it (thinned out when it pours),
 * a bright tick through a green gate, a rising chime through a honey one, a sparkle through the
 * golden gate that climbs with its multiplier, a dull thud into a grey one and its crack; a wave of
 * gulls squawking, the snatch, the peck, Mirka's laugh; the pelican's gulp; a table's cheer; the Big
 * Basket's swell and its spill; the lake and a hummed tune in a rest; the level's fanfare.  A missed
 * verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { ChlebySim, SimEvent } from './sim';

const DAY = [73.42, 110, 146.83, 185];
const REST = [73.42, 110, 138.59, 220];
const ROOT = 587.33;
/** a shepherd's tune for the rests: steps of the major pentatonic */
const TUNE = [0, 2, 4, 4, 2, 4, 7, 4, 2, 0, 2, 2, 0, -1, 0];

export class ChlebySound {
  private tuneI = 0;
  private tuneT = 0;
  private waveT = 0;
  /** cool-downs (s) so a flood of bread does not become a roar */
  private popT = 0;
  private gateT = 0;
  private goldT = 0;
  private feedT = 0;
  private snatchT = 0;
  private gulpT = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY, dark: 260, bright: 2200, gain: 0.05 });
  }

  update(dt: number, sim: ChlebySim): void {
    const a = this.a;
    this.popT -= dt;
    this.gateT -= dt;
    this.goldT -= dt;
    this.feedT -= dt;
    this.snatchT -= dt;
    this.gulpT -= dt;
    if (!a.on) return;
    if (sim.restBlock) {
      this.tuneT -= dt;
      if (this.tuneT <= 0) {
        this.tuneT = this.tuneI % 4 === 3 ? 1.1 : 0.7;
        a.bell(ladder(TUNE[this.tuneI % TUNE.length] + 5, ROOT / 2), 0.026, 1.5);
        this.tuneI++;
      }
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveT = 3.2;
        a.noiseBurst(2.6, { type: 'lowpass', freq: 500, sweepTo: 260, gain: 0.025 });
      }
    } else this.tuneT = 0.5;
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'fire':
        if (e.kind === 'big') {
          a.tone(110, 0.5, { type: 'triangle', gain: 0.06, slideTo: 220 });
          a.noiseBurst(0.3, { type: 'bandpass', freq: 600, sweepTo: 1600, gain: 0.04 });
        } else if (this.popT <= 0) {
          this.popT = 0.09;
          a.tone(e.kind === 'fish' ? 880 : 520, 0.07, { type: 'sine', gain: 0.03, slideTo: e.kind === 'fish' ? 1320 : 700 });
        }
        break;
      case 'gate':
        if (e.kind === 'gold') {
          if (this.goldT <= 0) {
            this.goldT = 0.12;
            const n = Math.min(14, Math.round(e.n * 2));
            a.bell(ladder(5 + n, ROOT), e.n >= 2 ? 0.035 : 0.02, 0.9);
          }
        } else if (this.gateT <= 0) {
          this.gateT = 0.1;
          if (e.kind === 'add') a.tone(1046, 0.08, { type: 'triangle', gain: 0.025 });
          else a.bell(ladder(3 + e.n * 2, ROOT), 0.028, 0.6);
        }
        break;
      case 'swallow':
        if (this.gateT <= 0) {
          this.gateT = 0.12;
          a.tone(160, 0.1, { type: 'sine', gain: 0.04, slideTo: 120 });
        }
        break;
      case 'break':
        a.noiseBurst(0.3, { type: 'bandpass', freq: 900, sweepTo: 300, gain: 0.06 });
        a.tone(98, 0.25, { type: 'triangle', gain: 0.05, slideTo: 70 });
        break;
      case 'spill':
        a.noiseBurst(0.35, { type: 'bandpass', freq: 1200, sweepTo: 3600, gain: 0.05 });
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1, i * 0.04));
        break;
      case 'feed':
        if (this.feedT <= 0) {
          this.feedT = 0.07;
          // a soft munch that climbs a little with the crowd's size
          a.tone(e.big ? 330 : 1318, e.big ? 0.4 : 0.05, { type: 'sine', gain: e.big ? 0.05 : 0.012, slideTo: e.big ? 660 : undefined });
        }
        break;
      case 'tableFed':
        a.noiseBurst(0.8, { type: 'bandpass', freq: 1500, q: 0.6, gain: 0.04 });
        [0, 2, 4].forEach((n, i) => a.bell(ladder(n + 7, ROOT), 0.045, 1.1, i * 0.08));
        break;
      case 'wave':
        a.tone(e.fat ? 900 : 1500, 0.22, { type: 'sawtooth', gain: 0.012, slideTo: e.fat ? 600 : 900 });
        if (e.mirka) [0, 0.18, 0.36].forEach(at => a.tone(1300, 0.12, { type: 'sawtooth', gain: 0.013, slideTo: 1000, at }));
        break;
      case 'snatch':
        if (this.snatchT <= 0) {
          this.snatchT = 0.1;
          a.tone(1600, 0.1, { type: 'square', gain: 0.008, slideTo: 1100 });
        }
        break;
      case 'peck':
        a.tone(900, 0.06, { type: 'square', gain: 0.02 });
        a.tone(700, 0.06, { type: 'square', gain: 0.02, at: 0.09 });
        break;
      case 'shoo':
        if (this.snatchT <= 0) {
          this.snatchT = 0.15;
          a.noiseBurst(0.25, { type: 'highpass', freq: 2000, gain: 0.02 });
        }
        break;
      case 'gulp':
        if (this.gulpT <= 0) {
          this.gulpT = 0.12;
          a.tone(220, 0.14, { type: 'sine', gain: 0.035, slideTo: 110 });
        }
        break;
      case 'pelikan':
        a.tone(98, 0.6, { type: 'triangle', gain: 0.04, slideTo: 82 });
        break;
      case 'sated':
        a.tone(82, 0.5, { type: 'sine', gain: 0.05, slideTo: 165 });
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.2, 0.2 + i * 0.1));
        break;
      case 'cleared':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.04, 1, i * 0.06));
        break;
      case 'won':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.4, i * 0.08));
        a.noiseBurst(1.2, { type: 'bandpass', freq: 1400, q: 0.5, gain: 0.04 });
        break;
      case 'bigReady':
        a.tone(220, 0.9, { type: 'triangle', gain: 0.035, attack: 0.1, slideTo: 440 });
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.04, 1.4, 0.3 + i * 0.08));
        break;
      case 'basket':
        a.bell(ladder(e.pass ? 9 : 4 + (e.n % 5), ROOT / 2), 0.04, 1.4);
        break;
      case 'blindPay':
        if (e.runners > 0) a.noiseBurst(0.9, { type: 'bandpass', freq: 500, sweepTo: 3000, gain: 0.04 });
        break;
      case 'buy':
      case 'gift':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.045, 1.4, i * 0.1));
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(73.42, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(293.66, 0.5, { type: 'triangle', gain: 0.02, slideTo: 329.63 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? REST : DAY, 3);
        this.tuneI = 0;
        break;
      case 'finale':
        a.padChord([73.42, 110, 146.83, 220], 3);
        break;
      default:
        break;
    }
  }
}
