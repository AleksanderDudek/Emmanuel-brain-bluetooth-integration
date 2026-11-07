/**
 * Geoda's sound, through the kit's ArcadeAudio (synthesised, no files): a low cave hum whose
 * filter the runner opens with focus, a stone "tock" for every piece set, glass that shatters
 * for a clear with a bell that climbs the pentatonic ladder with the combo (Candy Crush's rising
 * pitch), a chord for a clean board, a ting for each jewel, a rising chime when the shine steps
 * up, the rumble of the geode turning, a fanfare for a chamber, and a soft shimmer for a gem
 * polished in the Szlif.
 */
import type { ArcadeAudio } from '../kit/audio';
import { ladder } from '../kit/audio';
import type { GeodaEvent } from './sim';

const PUSH_CHORD = [55, 82.41, 110, 164.81];
const REST_CHORD = [49, 73.42, 98, 146.83];

export class GeodaSound {
  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PUSH_CHORD, dark: 160, bright: 1200, gain: 0.07 });
  }

  pick(): void {
    this.a.tone(880, 0.05, { type: 'triangle', gain: 0.05, slideTo: 1320 });
  }

  on(e: GeodaEvent): void {
    const a = this.a;
    switch (e.type) {
      case 'place': {
        const n = e.item.piece.cells.length;
        a.tone(220 - n * 8, 0.12, { type: 'triangle', gain: 0.1, slideTo: 140 });
        a.noiseBurst(0.06, { freq: 900, q: 1.2, gain: 0.05 });
        if (e.lines) {
          a.noiseBurst(0.35 + 0.08 * e.lines, { freq: 4200, q: 0.6, gain: 0.08 + 0.02 * e.lines, type: 'highpass', sweepTo: 1800 });
          a.combo(Math.max(0, e.combo - 1) + (e.lines - 1) * 2, 523.25, 0.11);
          for (let k = 1; k < Math.min(4, e.lines); k++) a.bell(ladder(e.combo + k * 2), 0.06, 0.9, k * 0.07);
        }
        if (e.clean) [0, 2, 4, 7].forEach((s, k) => a.bell(ladder(s + 5), 0.08, 1.6, 0.15 + k * 0.09));
        if (e.druse > 0) for (let k = 0; k < 3; k++) a.tone(2400 + k * 400, 0.05, { type: 'sine', gain: 0.03, at: k * 0.04 });
        break;
      }
      case 'miss':
        a.tone(160, 0.12, { type: 'square', gain: 0.03, slideTo: 120 });
        break;
      case 'stuck':
        a.tone(300, 0.15, { type: 'triangle', gain: 0.04, slideTo: 240 });
        break;
      case 'jewel':
        a.bell(1567.98, 0.07, 1.1);
        break;
      case 'mult':
        if (e.up) a.bell(ladder(e.mult + 4, 392), 0.07, 0.9);
        break;
      case 'comboBreak':
        a.tone(440, 0.2, { type: 'sine', gain: 0.03, slideTo: 330 });
        break;
      case 'turn':
        a.noiseBurst(1.1, { freq: 160, q: 0.7, gain: 0.16, type: 'lowpass', sweepTo: 60 });
        a.tone(70, 0.9, { type: 'sine', gain: 0.12, slideTo: 45 });
        break;
      case 'level':
        [0, 2, 4, 5, 7].forEach((s, k) => a.bell(ladder(s, 392), 0.09, 1.4, k * 0.11));
        break;
      case 'gem':
        for (let k = 0; k < 5; k++) a.tone(1800 + k * 260, 0.4, { type: 'sine', gain: 0.025, at: k * 0.07 });
        if (e.polished) a.bell(1046.5, 0.08, 1.8, 0.35);
        break;
      case 'reveal':
        if (e.points > 0) a.combo(e.mult * 2, 392, 0.1);
        break;
      case 'blockStart':
        if (e.block.kind === 'push') a.padChord(PUSH_CHORD, 2);
        else if (e.block.kind === 'rest') a.padChord(REST_CHORD, 3);
        break;
      default:
        break;
    }
  }
}
