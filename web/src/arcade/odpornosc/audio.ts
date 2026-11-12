/**
 * Odporność's sounds on the kit's synthesiser (kit/audio.ts), under the song (song.ts): a soft "bloop" for
 * every gulp whose pitch climbs with the combo (a bell on the ladder every third), a tiny fizz as a phagosome
 * digests, the alarm's warm pings, the adhesion cascade's tick (rolling), click (arrest) and pop (through the
 * wall), the respiratory burst's whoosh and shimmer, the NET's crackle and chime, a gold tinkle for a tag,
 * the T cell's knock and the gentle fold, the collagen's pluck, the closing wound's arpeggio.  Busy moments
 * are throttled so a full field never turns into noise.  With the song off, a quiet pad keeps the room.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent } from './sim';

const ROOT = 523.25;
const PAD = [130.81, 196, 261.63, 329.63];

export class OdpSound {
  private gulpGap = 0;
  private fizzGap = 0;
  private ringGap = 0;
  private tickGap = 0;
  private slipGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  /** The quiet pad when the song is off (the song plays the room otherwise). */
  start(song: boolean): void {
    if (!song) this.a.pad({ notes: PAD, dark: 280, bright: 2000, gain: 0.035 });
  }

  update(dt: number): void {
    this.gulpGap = Math.max(0, this.gulpGap - dt);
    this.fizzGap = Math.max(0, this.fizzGap - dt);
    this.ringGap = Math.max(0, this.ringGap - dt);
    this.tickGap = Math.max(0, this.tickGap - dt);
    this.slipGap = Math.max(0, this.slipGap - dt);
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'gulp':
        if (this.gulpGap > 0) break;
        this.gulpGap = 0.06;
        a.tone(e.by === 'mac' ? 220 : 340 + Math.min(12, e.combo) * 18, 0.16, { type: 'sine', gain: 0.07, slideTo: e.by === 'mac' ? 110 : 160 });
        if (e.combo >= 3 && e.combo % 3 === 0) a.combo(Math.floor(e.combo / 3), ROOT, 0.05);
        if (e.tagged) a.bell(1568, 0.025, 0.5);
        break;
      case 'digest':
        if (this.fizzGap > 0) break;
        this.fizzGap = 0.12;
        a.noiseBurst(0.18, { freq: 5200, q: 2, gain: 0.018, type: 'bandpass', sweepTo: 8000 });
        break;
      case 'ring':
        if (this.ringGap > 0) break;
        this.ringGap = e.kind === 'gulp' ? 0.2 : 0.9;
        a.tone(e.kind === 'growth' ? 392 : e.kind === 'ifn' ? 466 : 330, 0.9, { type: 'sine', gain: e.kind === 'gulp' ? 0.035 : 0.02, attack: 0.25, slideTo: e.kind === 'gulp' ? 440 : undefined });
        break;
      case 'pad':
        a.bell(ladder(e.lit + 2, ROOT), 0.05, 1.2);
        break;
      case 'roll':
        if (this.tickGap > 0) break;
        this.tickGap = 0.1;
        a.tone(900, 0.03, { type: 'triangle', gain: 0.02 });
        break;
      case 'arrest':
        a.tone(1300, 0.05, { type: 'square', gain: 0.018, slideTo: 900 });
        break;
      case 'squeeze':
        a.tone(260, 0.22, { type: 'sine', gain: 0.045, slideTo: 620 });
        break;
      case 'join':
        a.bell(ladder(Math.min(14, e.n), ROOT / 2), 0.03, 0.8);
        break;
      case 'spent':
        a.tone(420, 0.3, { type: 'sine', gain: 0.03, slideTo: 260 });
        break;
      case 'tidy':
        a.tone(196, 0.25, { type: 'sine', gain: 0.05, slideTo: 130 });
        a.bell(784, 0.02, 0.6, 0.12);
        break;
      case 'burstReady':
        a.bell(1046.5, 0.06, 1.4);
        a.bell(1318.5, 0.05, 1.4, 0.12);
        break;
      case 'burst':
        a.noiseBurst(0.9, { freq: 600, q: 0.7, gain: 0.08, type: 'bandpass', sweepTo: 5000 });
        for (let i = 0; i < 5; i++) a.bell(ladder(8 + i, ROOT), 0.04, 1.2, i * 0.06);
        break;
      case 'burstNo':
      case 'netNo':
        a.tone(180, 0.08, { type: 'triangle', gain: 0.03 });
        break;
      case 'netReady':
        a.bell(1174.7, 0.05, 1);
        break;
      case 'net':
        a.noiseBurst(0.5, { freq: 2600, q: 3, gain: 0.05, type: 'bandpass', sweepTo: 900 });
        a.bell(659.25, 0.06, 1.6, 0.05);
        a.bell(987.77, 0.05, 1.6, 0.15);
        break;
      case 'tag':
        a.bell(e.by === 'c3' ? 1760 : 2093, 0.02, 0.5);
        break;
      case 'slip':
        if (this.slipGap > 0) break;
        this.slipGap = 0.6;
        a.tone(500, 0.18, { type: 'sine', gain: 0.03, slideTo: 760 });
        break;
      case 'divide':
        a.tone(1400, 0.05, { type: 'sine', gain: 0.01, slideTo: 1800 });
        break;
      case 'dock':
        a.tone(160, 0.12, { type: 'triangle', gain: 0.05 });
        a.tone(160, 0.12, { type: 'triangle', gain: 0.04, at: 0.16 });
        break;
      case 'fold':
        a.bell(659.25, 0.04, 1);
        a.bell(523.25, 0.035, 1, 0.12);
        a.bell(392, 0.03, 1.2, 0.24);
        break;
      case 'virions':
        a.noiseBurst(0.25, { freq: 900, q: 1.5, gain: 0.03 });
        break;
      case 'neutralise':
        a.bell(1975.5, 0.015, 0.4);
        break;
      case 'collagen':
        a.tone(587.33, 0.5, { type: 'triangle', gain: 0.045, slideTo: 590 });
        break;
      case 'closed':
        for (let i = 0; i < 6; i++) a.bell(ladder(i * 2, ROOT / 2), 0.06, 2, i * 0.1);
        break;
      case 'stageDone':
        if (!e.grace) for (let i = 0; i < 3; i++) a.bell(ladder(4 + i * 2 + e.stars, ROOT / 2), 0.05, 1.4, i * 0.12);
        else a.bell(523.25, 0.04, 1.2);
        break;
      case 'card':
        a.noiseBurst(0.35, { freq: 1800, q: 0.6, gain: 0.025, type: 'bandpass', sweepTo: 600 });
        break;
      case 'memory':
      case 'unlock':
        a.bell(1318.5, 0.05, 1.4);
        a.bell(1568, 0.05, 1.4, 0.1);
        break;
      default:
        break;
    }
  }
}
