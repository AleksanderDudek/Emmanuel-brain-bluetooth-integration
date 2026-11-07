/**
 * Źródła's sound, on the kit's synthesiser (kit/audio.ts): no files.  The pad is open fifths on D,
 * moving to G in a rest; the runner drives its brightness from ZrodlaSim.padLevel (the sluice in a
 * sighted push; still in a rest, a blind push and while the signal is out).  Over it: a stone's
 * clunk for every stone laid (a scrape for a swap), the spring's gurgle when the water starts, a
 * droplet for each filled cell stepping up D Dorian (an octave higher in fast flow), a bright
 * psaltery run for a loop, a pool's deep plop, a splash and a falling slide for a spill, a rising
 * arpeggio for a won valley and the garden, a glassy chord for still waters, bells for blooms, and
 * a warning tick when the water nears the way's end.  No named hymn tune.
 */
import type { ArcadeAudio } from '../kit/audio';
import type { ZrodlaEvent } from './sim';

/** D Dorian from D4 up an octave and a step. */
const MODE = [293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33, 659.25];
const STREAM = [73.42, 110, 146.83, 220];
const SELAH = [98, 146.83, 196, 246.94];

export class ZrodlaSound {
  private step = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: STREAM, dark: 220, bright: 1600, gain: 0.06 });
  }

  /** The psaltery: a plucked triangle with a soft octave and a bell's shimmer. */
  private pluck(f: number, at = 0, gain = 0.06): void {
    this.a.tone(f, 1.4, { type: 'triangle', attack: 0.004, gain, at });
    this.a.tone(f * 2, 0.7, { type: 'sine', gain: gain * 0.25, at });
  }

  on(e: ZrodlaEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'lay':
        a.tone(e.replaced ? 140 : 190, 0.12, { type: 'triangle', gain: 0.1, slideTo: e.replaced ? 90 : 150 });
        a.noiseBurst(0.08, { freq: e.replaced ? 900 : 2400, gain: e.replaced ? 0.08 : 0.04 });
        break;
      case 'deny':
        a.tone(160, 0.08, { type: 'square', gain: 0.025 });
        break;
      case 'flow':
        a.noiseBurst(0.9, { type: 'lowpass', freq: 400, sweepTo: 1400, gain: 0.08 });
        this.pluck(MODE[0], 0, 0.06);
        this.step = 0;
        break;
      case 'fill': {
        const f = MODE[this.step % MODE.length] * (e.fast ? 2 : 1) * (this.step >= MODE.length ? 2 : 1);
        this.step = Math.min(this.step + 1, MODE.length * 2 - 1);
        a.tone(f, 0.18, { type: 'sine', gain: 0.05, slideTo: f * 1.12 });
        if (e.loop) [0, 2, 4, 7].forEach((k, i) => this.pluck(MODE[k % MODE.length] * 2, i * 0.07, 0.06));
        if (e.aqueduct) a.bell(MODE[4] * 2, 0.06, 1);
        break;
      }
      case 'poolDone':
        a.tone(110, 0.35, { type: 'sine', gain: 0.12, slideTo: 70 });
        a.bell(MODE[2], 0.06, 1.4);
        break;
      case 'near':
        a.tone(880, 0.06, { type: 'square', gain: 0.03 });
        a.tone(880, 0.06, { type: 'square', gain: 0.03, at: 0.12 });
        break;
      case 'spill':
        a.noiseBurst(0.7, { freq: 900, sweepTo: 300, gain: 0.12 });
        a.tone(330, 0.5, { type: 'triangle', gain: 0.06, slideTo: 160 });
        break;
      case 'garden':
      case 'valleyEnd':
        if (e.type === 'valleyEnd' && !e.won) break;
        [0, 2, 4, 6, 8].forEach((k, i) => this.pluck(MODE[k], i * 0.09, 0.07));
        if (e.type === 'valleyEnd' && e.stars === 3) a.bell(MODE[8] * 2, 0.08, 2, 0.5);
        break;
      case 'fast':
        a.noiseBurst(0.6, { type: 'bandpass', freq: 600, sweepTo: 3000, gain: 0.07 });
        break;
      case 'still':
        if (e.on) [MODE[0], MODE[4], MODE[7]].forEach((f, i) => a.bell(f * 2, 0.06, 2.4, i * 0.05));
        else a.tone(MODE[0], 0.4, { gain: 0.04, slideTo: MODE[1] });
        break;
      case 'bloom':
        a.bell(MODE[(e.cell % 5) + 3] * 2, 0.05, 1.2);
        break;
      case 'goal':
        this.pluck(MODE[4] * 2, 0, 0.06);
        this.pluck(MODE[7] * 2, 0.1, 0.06);
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? SELAH : STREAM, 3);
        break;
      case 'reveal':
        a.bell(MODE[4], 0.07, 1.6);
        break;
      default:
        break;
    }
  }
}
