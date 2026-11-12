/**
 * Światło ciała's small sounds, on the kit's synthesiser (kit/audio.ts), under the lullaby (lullaby.ts,
 * played by kit/song.ts): a soft whoosh and a bell as the band reaches an organ, each organ's own gentle
 * voice for a helping tap (a drop, a bubble's bloop, a heartbeat's thump, a chime), bells that climb the
 * scale organ by organ as they settle (a second bell for a golden one), an arpeggio for the whole body in
 * light, the breath's soft wind in rest.  Without the song the game keeps the runner's quiet pad, whose
 * filter follows the band's light.  Throttled, so many taps never become noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { ORGANS, type OrganId } from './content';
import type { SimEvent, SwiatloSim } from './sim';

/** C major 6/9 in a low register: the pad when the song is off. */
const PAD = [130.81, 196, 261.63, 293.66];
const ROOT = 523.25;

const voiceOf: Record<OrganId, number> = {
  brain: 0, lungs: 1, heart: 2, liver: 3, adrenal: 4, kidney: 5, gut: 6, skin: 7, bone: 8,
};

export class SwiatloSound {
  private tapGap = 0;
  private beatGap = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(songOn: boolean): void {
    if (!songOn) this.a.pad({ notes: PAD, dark: 260, bright: 1900, gain: 0.04 });
  }

  update(dt: number, _sim: SwiatloSim): void {
    this.tapGap = Math.max(0, this.tapGap - dt);
    this.beatGap = Math.max(0, this.beatGap - dt);
  }

  on(e: SimEvent, sim: SwiatloSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'arrive':
        a.noiseBurst(0.5, { type: 'lowpass', freq: 400, sweepTo: 1400, gain: 0.018 });
        a.bell(ladder(voiceOf[e.organ], ROOT / 2), 0.035, 1.6);
        break;
      case 'help': {
        if (this.tapGap > 0) break;
        this.tapGap = 0.06;
        if (e.kind === 'beat') {
          a.tone(e.good ? 92 : 70, 0.14, { type: 'sine', gain: e.good ? 0.09 : 0.04, slideTo: 52 });
          if (e.good) a.bell(ladder(7, ROOT), 0.02, 0.5);
        } else if (e.kind === 'bubble') {
          a.tone(320, 0.12, { type: 'sine', gain: e.good ? 0.04 : 0.02, slideTo: 760 });
        } else if (e.kind === 'step') {
          a.tone(ladder(9, ROOT), 0.08, { type: 'sine', gain: 0.018 });
        } else {
          const n = e.organ ? voiceOf[e.organ] : 0;
          a.tone(ladder(n + 5, ROOT), 0.12, { type: 'triangle', gain: 0.022, slideTo: ladder(n + 6, ROOT) });
        }
        break;
      }
      case 'balanced': {
        const n = ORGANS.indexOf(e.organ) + (sim.depth - 1) * 2;
        a.bell(ladder(n + 2, ROOT), 0.07, 2);
        if (e.rating === 3) a.bell(ladder(n + 4, ROOT), 0.05, 2.2, 0.12);
        if (e.fresh) a.bell(ladder(n + 7, ROOT), 0.03, 1.4, 0.3);
        break;
      }
      case 'scanDone':
        [0, 2, 4, 7, 9].forEach((k, i) => a.bell(ladder(k + 5, ROOT / 2), 0.06, 2.6, i * 0.14));
        break;
      case 'beat':
        // the heart's own thump only while the band is on it (the song carries a heartbeat of its own)
        if (sim.loop?.organ === 'heart' && this.beatGap <= 0) {
          this.beatGap = 0.25;
          a.tone(64, 0.1, { type: 'sine', gain: 0.07, slideTo: 46 });
          a.tone(58, 0.08, { type: 'sine', gain: 0.04, slideTo: 44, at: 0.14 });
        }
        break;
      case 'breathTurn':
        if (e.inhale) a.noiseBurst(3.6, { type: 'lowpass', freq: 260, sweepTo: 900, gain: 0.022 });
        else a.noiseBurst(5.4, { type: 'lowpass', freq: 900, sweepTo: 240, gain: 0.02 });
        break;
      case 'breathTap':
        if (e.good) a.bell(ladder(4, ROOT), 0.03, 1.4);
        break;
      case 'gold':
        if (e.on) a.bell(1568, 0.016, 1);
        break;
      case 'blindEnd':
        [0, 4, 7].forEach((k, i) => a.bell(ladder(k, ROOT / 2), 0.04, 2, i * 0.1));
        break;
      default:
        break;
    }
  }
}
