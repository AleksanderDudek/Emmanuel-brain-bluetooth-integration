/**
 * Latarnik's sound, on the kit's synthesiser (kit/audio.ts): a warm night pad whose filter follows
 * what the screen shows (the runner drives it from LatarnikSim.padLevel: the lamp in a Konwój, the
 * sea glow in a Cisza, held still where nothing shows), a slow sea swell, water lapping and a
 * glassier chord in Cisza, a bell for every flash that climbs the pentatonic ladder with perfects,
 * far horns as the Konwój telegraph, a falling two-note bell before Cisza, small wooden clicks for
 * crates and amber.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { LatarnikSim, SimEvent } from './sim';

/** D major 7, low and warm; Cisza moves to an open G for its glass-harmonica feel. */
const NIGHT = [73.42, 110, 185, 277.18];
const CALM = [98, 146.83, 220, 293.66];
const BELL_ROOT = 392;

export class LatarnikSound {
  private swell = 1.2;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: NIGHT, dark: 240, bright: 1400, gain: 0.06 });
  }

  update(dt: number, sim: LatarnikSim): void {
    this.swell -= dt;
    if (this.swell > 0 || !this.a.on) return;
    if (sim.block?.kind === 'cisza') {
      // water lapping at the shore
      this.a.noiseBurst(0.45, { type: 'bandpass', freq: 700 + Math.random() * 500, q: 1.4, gain: 0.022 });
      this.swell = 1.4 + Math.random() * 1.6;
    } else {
      this.a.noiseBurst(3.4, { type: 'lowpass', freq: 260, sweepTo: 620, gain: 0.035 });
      this.swell = 4 + Math.random() * 3;
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'flash': {
        if (e.full) {
          [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, BELL_ROOT), 0.07, 2, i * 0.07));
          a.noiseBurst(0.8, { type: 'highpass', freq: 2500, sweepTo: 6000, gain: 0.03 });
          break;
        }
        // one pentatonic step up per perfect in a row, capped at an octave
        const step = e.perfect ? Math.min(e.streak, 5) : 0;
        a.combo(step, BELL_ROOT, 0.09);
        if (e.boats.length > 1) a.bell(ladder(step + 2, BELL_ROOT), 0.06, 1.3, 0.06);
        break;
      }
      case 'empty':
        a.tone(150, 0.14, { type: 'triangle', gain: 0.045, slideTo: 95 });
        a.noiseBurst(0.12, { freq: 500, gain: 0.025 });
        break;
      case 'short':
        // the light fell short of a boat: a soft, unfinished chime, nothing lost
        a.bell(ladder(0, BELL_ROOT), 0.03, 0.45);
        break;
      case 'armed':
        a.bell(ladder(5, BELL_ROOT), 0.07, 1.6);
        a.bell(ladder(7, BELL_ROOT), 0.06, 1.8, 0.12);
        break;
      case 'home':
        // crates: small wooden clicks on the pier
        for (let i = 0; i < Math.max(1, e.boat.cargo); i++) a.noiseBurst(0.05, { freq: 2200 + i * 300, q: 3, gain: 0.05, at: i * 0.08 });
        break;
      case 'reef':
        // a low horn: the boat turns back into the dark (softer in the warm-up, where it costs nothing)
        a.tone(98, 1.3, { type: 'triangle', gain: e.free ? 0.045 : 0.07, attack: 0.25 });
        a.tone(146.83, 1.1, { type: 'sine', gain: e.free ? 0.02 : 0.03, attack: 0.3 });
        break;
      case 'bottle':
        a.bell(1318.5, 0.05, 1.4);
        a.bell(1567.98, 0.04, 1.6, 0.1);
        break;
      case 'tallShip':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, BELL_ROOT / 2), 0.07, 2.2, i * 0.1));
        break;
      case 'telegraph':
        if (e.next === 'konwoj') {
          a.tone(82.41, 2.4, { type: 'triangle', gain: 0.06, attack: 0.6 });
          a.tone(123.47, 2.2, { type: 'sine', gain: 0.025, attack: 0.7, at: 0.1 });
        } else {
          a.bell(659.25, 0.06, 1.8);
          a.bell(493.88, 0.06, 2.2, 0.45);
        }
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'cisza' ? CALM : NIGHT, 3);
        break;
      case 'star':
        [0, 2, 4].forEach((n, i) => a.bell(ladder(n + 5, BELL_ROOT), 0.07, 1.8, i * 0.09));
        break;
      case 'steady':
        // the lens tightens a notch: a soft high note, higher with each step
        a.bell(ladder(6 + Math.round(e.bonus / 0.04), BELL_ROOT), 0.035, 1.3);
        break;
      case 'reveal':
        a.bell(ladder(9, BELL_ROOT), 0.025, 0.9);
        break;
      case 'washUp':
        e.nuggets.forEach((_, i) => a.noiseBurst(0.04, { freq: 3200, q: 4, gain: 0.05, at: 0.9 + i * 0.15 }));
        break;
      case 'amber':
        if (e.isNew) {
          a.bell(ladder(7, BELL_ROOT), 0.07, 1.8, 0.2);
          a.bell(ladder(9, BELL_ROOT), 0.06, 2, 0.32);
        }
        break;
      case 'built':
        [0, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, BELL_ROOT / 2), 0.05, 2, i * 0.12));
        break;
      case 'watchEnd':
        [4, 2, 0].forEach((n, i) => a.bell(ladder(n, BELL_ROOT), 0.06, 1.6, i * 0.16));
        break;
      case 'watchStart':
        a.bell(ladder(0, BELL_ROOT), 0.06, 1.4);
        break;
      case 'finale':
        a.padChord(CALM, 2);
        [0, 2, 4, 7, 9, 10].forEach((n, i) => a.bell(ladder(n, BELL_ROOT), 0.06, 2.4, 0.2 + i * 0.22));
        break;
      default:
        break;
    }
  }
}
