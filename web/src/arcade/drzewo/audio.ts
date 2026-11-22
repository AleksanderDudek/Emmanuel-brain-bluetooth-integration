/**
 * Drzewo nad wodą's sounds, on the kit's synthesiser (kit/audio.ts), gentle and few: a warm pad in G whose filter
 * follows the growth in a sighted push (the runner drives it through padLevel), a soft low wooden tone as the roots
 * pass each tenth of their way, the shimmer of water and three bells when they reach the stream, a rising airy sweep
 * as the crown opens, a bell for each fruit on a pentatonic ladder (the nine rise in Galatians' order) and all nine
 * for a whole round, the breath's soft wind in rest (rising in, falling out, quiet on a hold), the wind's gusts in its
 * rest, a page's whisper for a card.  No drums, no chant; throttled, so taps never become noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { FRUIT, FRUITS } from './content';
import type { DrzewoSim, SimEvent } from './sim';

/** G major with an added ninth, low: the pad. */
const PAD = [98, 146.83, 196, 246.94];
/** The bells' root: G4. */
const ROOT = 392;

export class DrzewoSound {
  private gap = 0;
  private gustT = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 260, bright: 1600, gain: 0.05 });
  }

  update(dt: number, sim: DrzewoSim): void {
    this.gap = Math.max(0, this.gap - dt);
    // the wind's gusts in its rest
    if (sim.restKind === 'wind' && this.a.on) {
      this.gustT -= dt;
      if (this.gustT <= 0) {
        this.gustT = 3 + Math.random() * 2.5;
        this.a.noiseBurst(2.4, { type: 'bandpass', freq: 380, sweepTo: 900, q: 0.6, gain: 0.018 });
      }
    }
  }

  on(e: SimEvent, sim: DrzewoSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'grow':
        if (this.gap > 0) break;
        this.gap = 0.25;
        if (e.kind === 'roots') a.tone(110 + 30 * e.fill, 0.35, { type: 'triangle', gain: 0.03, slideTo: 98 });
        else if (e.kind === 'trunk') a.tone(196 + 120 * e.fill, 0.3, { type: 'sine', gain: 0.022 });
        else a.tone(ladder(FRUIT[sim.fruit].bell, ROOT) * 0.5, 0.25, { type: 'sine', gain: 0.016 });
        break;
      case 'stream':
        a.noiseBurst(2.2, { type: 'bandpass', freq: 2400, sweepTo: 900, q: 1.2, gain: 0.02 });
        [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.03, 2.4, i * 0.25));
        break;
      case 'crown':
        a.noiseBurst(2.6, { type: 'lowpass', freq: 600, sweepTo: 2600, gain: 0.016 });
        [5, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.026, 2.2, i * 0.2));
        break;
      case 'blossom':
        a.bell(ladder(FRUIT[e.fruit].bell, ROOT) * 2, 0.012, 1.2);
        break;
      case 'ripe':
        a.bell(ladder(FRUIT[e.fruit].bell, ROOT), 0.05, 2.6);
        a.bell(ladder(FRUIT[e.fruit].bell + 2, ROOT), 0.025, 2.2, 0.18);
        break;
      case 'harvest':
        FRUITS.forEach((f, i) => a.bell(ladder(FRUIT[f].bell, ROOT), 0.03, 2.4, 0.4 + i * 0.16));
        break;
      case 'breathTurn':
        if (e.phase === 'in') a.noiseBurst(Math.max(1, e.len), { type: 'lowpass', freq: 300, sweepTo: 900, gain: 0.01 });
        else if (e.phase === 'out') a.noiseBurst(Math.max(1, e.len), { type: 'lowpass', freq: 900, sweepTo: 260, gain: 0.01 });
        break;
      case 'tap':
        if (this.gap > 0) break;
        this.gap = 0.3;
        if (e.fruit) a.bell(ladder(FRUIT[e.fruit].bell, ROOT), 0.03, 1.4);
        else a.tone(784, 0.12, { type: 'sine', gain: 0.014 });
        break;
      case 'blindEnd':
        if (e.gained > 0) a.noiseBurst(1.2, { type: 'bandpass', freq: 1200, sweepTo: 2400, q: 1, gain: 0.014 });
        break;
      case 'finale':
        [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.026, 3, i * 0.35));
        break;
      default: break;
    }
  }
}
