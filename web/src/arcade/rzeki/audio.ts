/**
 * Rzeki żywej wody's sounds, on the kit's synthesiser (kit/audio.ts), under the quiet chorale (hymn.ts on
 * kit/song.ts) or, with the chorale off, a warm pad in D whose filter follows the light: a bell for each
 * place on a pentatonic scale by height — so the bells descend as the light comes down and rise as the thanks
 * go up — a whisper of glass as each petal opens, a chime and the shimmer of water when a place is full and
 * the light flows on, all seven bells when a way is whole, the breath's soft wind in rest, a plink for each
 * drop that reaches the pool.  No drums.  Throttled, so many taps never become noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { PLACE, PLACES, type PlaceId } from './content';
import type { RzekiSim, SimEvent } from './sim';

/** D major with an added ninth, low: the pad when the chorale is off. */
const PAD = [146.83, 220, 293.66, 369.99];
/** The bells' root: D5 (the pentatonic ladder D E F♯ A B, then up an octave). */
const ROOT = 587.33;

const bellOf = (p: PlaceId): number => ladder(PLACE[p].bell, ROOT);

export class RzekiSound {
  private tapGap = 0;
  private tickGap = 0;
  private plinkGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(chorale: boolean): void {
    if (!chorale) this.a.pad({ notes: PAD, dark: 240, bright: 1700, gain: 0.05 });
  }

  update(dt: number): void {
    this.tapGap = Math.max(0, this.tapGap - dt);
    this.tickGap = Math.max(0, this.tickGap - dt);
    this.plinkGap = Math.max(0, this.plinkGap - dt);
  }

  /** A drop reached the pool: a small high plink (throttled). */
  plink(): void {
    if (!this.a.on || this.plinkGap > 0) return;
    this.plinkGap = 0.3;
    const f = 1150 + Math.random() * 520;
    this.a.tone(f, 0.12, { type: 'sine', gain: 0.012, slideTo: f * 1.55 });
  }

  on(e: SimEvent, sim: RzekiSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'enter':
        if (e.dir === 'down') {
          // the heaven opens: three soft high bells and air
          [6, 9, 11].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.025, 2.6, i * 0.22));
          a.noiseBurst(2, { type: 'lowpass', freq: 2400, sweepTo: 700, gain: 0.014 });
        } else a.noiseBurst(2, { type: 'bandpass', freq: 500, sweepTo: 2200, q: 0.8, gain: 0.016 });
        break;
      case 'arrive':
        a.noiseBurst(0.6, { type: 'lowpass', freq: 380, sweepTo: 1300, gain: 0.014 });
        a.bell(bellOf(e.place), 0.055, 2.2);
        break;
      case 'petal': {
        if (this.tickGap > 0) break;
        this.tickGap = 0.05;
        // a whisper of glass, climbing the ladder as the window opens
        const n = PLACE[e.place].bell + 5 + Math.floor((e.n / Math.max(1, e.of)) * 6);
        a.tone(ladder(n, ROOT / 2), 0.16, { type: 'sine', gain: 0.011 });
        break;
      }
      case 'tap': {
        if (this.tapGap > 0) break;
        this.tapGap = 0.09;
        a.tone(bellOf(e.place), 0.22, { type: 'triangle', gain: 0.014 + 0.012 * e.eff, slideTo: bellOf(e.place) * 1.004 });
        break;
      }
      case 'full': {
        const f = bellOf(e.place);
        a.bell(f, 0.08, 2.6);
        a.bell(f * 1.5, 0.04, 2.4, 0.09);
        a.bell(f * 2, 0.025, 2, 0.18);
        a.noiseBurst(1.3, { type: 'bandpass', freq: 2400, sweepTo: 5200, q: 1.2, gain: 0.018 });
        break;
      }
      case 'flow': {
        // living water: a gliding shimmer the way the light goes, and glints along it
        const down = e.dir === 'down';
        a.noiseBurst(2.8, { type: 'bandpass', freq: down ? 3200 : 1100, sweepTo: down ? 1100 : 3200, q: 0.9, gain: 0.016 });
        const from = PLACE[e.from].bell, to = PLACE[e.to].bell;
        // ladder() takes whole steps of the scale (a fraction would index past its table)
        for (let i = 0; i < 3; i++) a.bell(ladder(Math.round(from + (to - from) * (i / 2)) + 5, ROOT / 2), 0.016, 1.2, 0.5 + i * 0.6);
        break;
      }
      case 'whole': {
        const order = e.dir === 'down' ? PLACES : [...PLACES].reverse();
        order.forEach((p, i) => a.bell(bellOf(p), 0.05, 2.8, i * 0.17));
        break;
      }
      case 'gold':
        if (e.on) a.bell(1760, 0.014, 1.1);
        break;
      case 'breathTurn':
        if (e.inhale) a.noiseBurst(3.6, { type: 'lowpass', freq: 260, sweepTo: 900, gain: 0.02 });
        else a.noiseBurst(5.4, { type: 'lowpass', freq: 900, sweepTo: 240, gain: 0.018 });
        break;
      case 'blindEnd':
        [0, 4, 7].forEach((k, i) => a.bell(ladder(k, ROOT / 2), 0.04, 2.2, i * 0.12));
        break;
      case 'story':
        a.bell(bellOf(sim.place), 0.03, 2.4);
        break;
      default:
        break;
    }
  }
}
