/**
 * Urodzaj's sound, on the kit's synthesiser (kit/audio.ts): a warm pad (G major, a harvest evening)
 * whose filter follows the wind in a sighted push block (the runner drives it from padLevel); a soft
 * "plop" for every drop and a thud by the fruit's size when it lands; the merge's pop — pitched to the
 * fruit (bigger is lower) with a lyre pluck that climbs a pentatonic ladder as a chain goes on (Suika's
 * and Candy Crush's rising pitch); a heartbeat tick while the rim is crossed; the wind's rising whoosh
 * and its chime; a gentle bell for each gleaned fruit; a chord when a basket goes to the table.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent, UrodzajSim } from './sim';

const DAY = [98, 146.83, 196, 246.94];
const DUSK = [98, 146.83, 174.61, 233.08];
const ROOT = 523.25;

export class UrodzajSound {
  private tick = 0;
  private landGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY, dark: 300, bright: 2200, gain: 0.04 });
  }

  update(dt: number, sim: UrodzajSim): void {
    const a = this.a;
    if (!a.on) return;
    this.landGap = Math.max(0, this.landGap - dt);
    if (sim.overT > 0) {
      this.tick -= dt;
      if (this.tick <= 0) {
        this.tick = Math.max(0.18, 0.5 - sim.overT * 0.15);
        a.tone(880, 0.06, { type: 'square', gain: 0.025 });
      }
    } else this.tick = 0;
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'drop':
        a.tone(520 - e.tier * 40, 0.08, { type: 'sine', gain: 0.05, slideTo: 300 });
        break;
      case 'land':
        if (this.landGap > 0) break;
        this.landGap = 0.05;
        a.noiseBurst(0.12, { type: 'lowpass', freq: 600 - e.tier * 30, sweepTo: 150, gain: Math.min(0.06, 0.015 + e.speed * 0.02) });
        break;
      case 'merge': {
        // the pop: lower for a bigger fruit, and the pluck climbs with the chain
        const f = 900 / (1 + e.tier * 0.18);
        a.tone(f, 0.14, { type: 'sine', gain: 0.09, slideTo: f * 1.6 });
        a.noiseBurst(0.05, { type: 'bandpass', freq: 2200, q: 1.5, gain: 0.03 });
        this.pluck(ladder(e.link + Math.min(4, Math.floor(e.tier / 2)), ROOT), 0.02, 0.05);
        if (e.tier >= 7) [0, 4, 7].forEach((n, i) => a.bell(ladder(n + e.tier - 5, ROOT / 2), 0.05, 1.6, 0.05 + i * 0.07));
        if (e.first) [0, 2, 4, 7].forEach((n, i) => this.pluck(ladder(n + 5, ROOT), 0.2 + i * 0.1, 0.045));
        break;
      }
      case 'pole':
        [0, 2, 4, 5, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.06, 2, i * 0.09));
        break;
      case 'danger':
        if (e.on) a.tone(220, 0.25, { type: 'triangle', gain: 0.04, slideTo: 180 });
        break;
      case 'windUp':
        a.noiseBurst(1.1, { type: 'bandpass', freq: 400, sweepTo: 1800, q: 0.9, gain: e.hidden ? 0.03 : 0.045 });
        break;
      case 'wind':
        a.noiseBurst(1.3, { type: 'bandpass', freq: 1800, sweepTo: 500, q: 0.7, gain: 0.04 });
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.8, 0.1 + i * 0.08));
        break;
      case 'ready':
        a.bell(ladder(9, ROOT), 0.03, 1.2);
        break;
      case 'glean':
        a.bell(ladder(2 + e.tier, ROOT / 2), 0.04, 1.4);
        break;
      case 'basketEnd':
        [0, 4, 7].forEach((n, i) => this.pluck(ladder(n + e.stars, ROOT / 2), i * 0.12, 0.05));
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? DUSK : DAY, 3);
        break;
      case 'telegraph':
        this.pluck(ladder(e.next?.kind === 'rest' ? 4 : 2, ROOT), 0, 0.035);
        this.pluck(ladder(e.next?.kind === 'rest' ? 2 : 4, ROOT), 0.3, 0.035);
        break;
      case 'mission':
        [0, 4].forEach((n, i) => a.bell(ladder(n + 7, ROOT), 0.04, 1.4, i * 0.1));
        break;
      case 'festival':
        [0, 2, 4, 7, 9].forEach((n, i) => this.pluck(ladder(n, ROOT), i * 0.14, 0.05));
        break;
      case 'end':
        a.padChord([98, 146.83, 196, 293.66], 3);
        break;
      default: break;
    }
  }

  /** A plucked, lyre-like string: a quick triangle with a quiet octave. */
  private pluck(f: number, at: number, gain = 0.06): void {
    this.a.tone(f, 0.7, { type: 'triangle', gain, at, attack: 0.004 });
    this.a.tone(f * 2, 0.4, { type: 'sine', gain: gain * 0.25, at, attack: 0.004 });
  }
}
