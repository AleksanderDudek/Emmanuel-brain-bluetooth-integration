/**
 * Posłaniec's sound, on the kit's synthesiser (kit/audio.ts): a dawn pad in A whose filter follows
 * the glow in a sighted push (the runner drives it from PoslaniecSim.padLevel) and holds still
 * elsewhere, moving to an evening chord at the watchtowers; soft footfalls on the paving; silver
 * drachmas on a rising ladder with the combo; a whoosh for a jump, a swish for a slide, a soft thud
 * for a stumble (never a buzzer), the mule's bells; the ladder's rungs as rising bells and the
 * heights' bright chord; a tower's fire as a crackle with a low horn, the watchmen's song as a horn
 * call; bells for a city reached, a cloak, an errand and the gift; the inn's evening chord.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { PoslaniecSim, SimEvent } from './sim';

const DAWN = [110, 164.81, 220, 277.18];
const EVENING = [98, 146.83, 196, 246.94];
const ROOT = 440;

export class PoslaniecSound {
  private step = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAWN, dark: 260, bright: 1700, gain: 0.05 });
  }

  update(_dt: number, sim: PoslaniecSim): void {
    const a = this.a;
    if (!a.on) return;
    // a footfall on every step on the ground
    const st = Math.floor(sim.stride);
    if (st !== this.step) {
      this.step = st;
      if (!sim.airborne && sim.muleT <= 0 && sim.phase !== 'done') a.noiseBurst(0.06, { type: 'bandpass', freq: sim.onHeights ? 1800 : 900, q: 1.4, gain: 0.012 });
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'lane': a.noiseBurst(0.12, { type: 'bandpass', freq: 700, sweepTo: 1300, q: 0.9, gain: 0.02 }); break;
      case 'bump': a.tone(140, 0.12, { type: 'sine', gain: 0.03 }); break;
      case 'jump':
        a.noiseBurst(0.22, { type: 'bandpass', freq: 500, sweepTo: 1600, q: 0.8, gain: 0.03 });
        if (e.high) a.tone(660, 0.3, { type: 'triangle', gain: 0.025, slideTo: 990 });
        break;
      case 'land': a.noiseBurst(0.08, { type: 'lowpass', freq: 380, gain: e.hard ? 0.05 : 0.025 }); break;
      case 'slide': a.noiseBurst(0.35, { type: 'bandpass', freq: 1400, sweepTo: 600, q: 0.7, gain: 0.03 }); break;
      case 'clear': a.tone(ladder(7, ROOT), 0.12, { type: 'triangle', gain: 0.015 }); break;
      case 'stumble':
        a.noiseBurst(0.18, { type: 'lowpass', freq: 260, gain: 0.07 });
        a.tone(196, 0.25, { type: 'sine', gain: 0.035, slideTo: 147 });
        break;
      case 'mule': [0, 0.18, 0.36].forEach((at, i) => a.bell(ladder(4 - i, ROOT), 0.03, 0.8, at)); break;
      case 'coin': a.tone(ladder(Math.min(14, 5 + Math.floor(e.combo / 3)), ROOT * 2), 0.14, { type: 'sine', gain: 0.022 }); break;
      case 'combo': [0, 2, 4].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.035, 1, i * 0.06)); break;
      case 'power': [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.2, i * 0.05)); break;
      case 'powerEnd': a.tone(ladder(2, ROOT), 0.3, { type: 'sine', gain: 0.02, slideTo: ladder(0, ROOT) }); break;
      case 'rung': a.bell(ladder(e.n * 2, ROOT / 2), 0.045, 1.2); break;
      case 'heights':
        [0, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.045, 2, i * 0.08));
        a.noiseBurst(0.9, { type: 'bandpass', freq: 400, sweepTo: 2400, q: 0.7, gain: 0.025 });
        break;
      case 'glide': a.noiseBurst(1.1, { type: 'bandpass', freq: 1800, sweepTo: 500, q: 0.7, gain: 0.02 }); break;
      case 'tower':
        a.noiseBurst(0.5, { type: 'highpass', freq: 2500, gain: e.lit ? 0.02 : 0.008 });
        if (e.lit) a.tone(110, 1.2, { type: 'sawtooth', gain: 0.012, attack: 0.2 });
        break;
      case 'telegraph':
        if (e.next.kind === 'rest') a.tone(110, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else a.tone(880, 0.4, { type: 'triangle', gain: 0.018, slideTo: 1320 });
        break;
      case 'blockStart': a.padChord(e.block.kind === 'rest' ? EVENING : DAWN, 3); break;
      case 'blockEnd':
        if (e.verdict && e.block.kind === 'rest') {
          // the watchmen's song: a horn call answered across the road
          [0, 4, 7].forEach((n, i) => a.tone(ladder(n, 220), 0.7, { type: 'sawtooth', gain: 0.012, attack: 0.06, at: i * 0.22 }));
          [7, 4].forEach((n, i) => a.tone(ladder(n, 220), 0.8, { type: 'triangle', gain: 0.02, attack: 0.06, at: 0.8 + i * 0.25 }));
        } else if (e.verdict) [0, 2, 4].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.04, 1.4, i * 0.1));
        break;
      case 'blindReveal': if (e.sec > 0) [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.4, i * 0.1)); break;
      case 'city': [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2.4, i * 0.14)); break;
      case 'cloak': [0, 2, 4, 5, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.045, 2, i * 0.1)); break;
      case 'mission': [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.5, i * 0.1)); break;
      case 'gift': a.bell(ladder(7, ROOT), 0.045, 1.6); break;
      case 'finale':
        a.padChord(EVENING, 3);
        a.tone(98, 4, { type: 'sine', gain: 0.04, attack: 1 });
        break;
      case 'inn': [7, 4, 2, 0].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, i * 0.3)); break;
      default: break;
    }
  }
}
