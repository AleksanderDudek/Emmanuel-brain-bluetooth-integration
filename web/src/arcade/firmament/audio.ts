/**
 * Firmament's sound, on the kit's synthesiser (kit/audio.ts): a wide, slow pad in D whose filter
 * follows the level in a sighted Obserwacja (the runner drives it from FirmamentSim.padLevel) and
 * holds still elsewhere, turning to a quiet B minor in the calm sky; glassy bells for every clear that
 * climb a ladder with the cascade (Candy Crush's rising pitch); a chime when a special is born; a
 * comet's whoosh, a supernova's low boom, a pulsar's shimmer, a meteor's rush; a soft tick to select
 * and a muffled knock for a swap that makes nothing; the telescope's bells when a tool lands in the
 * tray; a falling star's glissando; the comet shower's run of bells; the stars of the tally one by one.
 * Out of moves makes a soft falling sigh, never a fail sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { Step } from './board';
import type { SimEvent } from './sim';

const DAY = [73.42, 110, 146.83, 220, 277.18];
const NIGHT = [61.74, 92.5, 123.47, 185, 246.94];
const ROOT = 587.33;

export class FirmamentSound {
  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY, dark: 240, bright: 1900, gain: 0.05 });
  }

  /** A step of a move as the picture plays it: the clear's bells, the blasts, the specials born. */
  step(st: Step, shower: boolean): void {
    const a = this.a;
    if (!a.on) return;
    const n = st.cleared.length;
    if (n) {
      const base = Math.min(12, (st.cascade - 1) * 2 + (shower ? 3 : 0));
      a.bell(ladder(base, ROOT), 0.05, 1.1);
      if (n >= 4) a.bell(ladder(base + 2, ROOT), 0.035, 1, 0.05);
      if (n >= 8) a.bell(ladder(base + 4, ROOT), 0.03, 1, 0.1);
      a.noiseBurst(0.08, { type: 'highpass', freq: 5000, gain: 0.01 });
    }
    for (const b of st.blasts.slice(0, 3)) {
      switch (b.kind) {
        case 'row': case 'col': case 'cross': case 'cross3':
          a.noiseBurst(0.45, { type: 'bandpass', freq: 600, sweepTo: 4200, q: 0.9, gain: 0.05 });
          a.tone(880, 0.3, { type: 'sine', gain: 0.025, slideTo: 1760 });
          break;
        case 'nova': case 'nova5':
          a.tone(110, 0.6, { type: 'sine', gain: 0.08, slideTo: 55 });
          a.noiseBurst(0.6, { type: 'lowpass', freq: 900, sweepTo: 200, gain: 0.06 });
          break;
        case 'kind': case 'all':
          [0, 2, 4, 7, 9, 12].forEach((k, i) => a.bell(ladder(k + 5, ROOT), 0.03, 1.4, i * 0.04));
          break;
        case 'meteor':
          a.noiseBurst(0.4, { type: 'bandpass', freq: 2400, sweepTo: 500, q: 1.2, gain: 0.04 });
          break;
        case 'hammer': case 'star':
          a.tone(330, 0.2, { type: 'triangle', gain: 0.05, slideTo: 165 });
          break;
      }
    }
    for (const b of st.born) {
      const top = b.sp === 'pulsar' ? 12 : b.sp === 'nova' ? 9 : 7;
      a.bell(ladder(top, ROOT), 0.045, 1.6, 0.06);
      a.bell(ladder(top + 2, ROOT), 0.035, 1.6, 0.14);
    }
    if (st.rocks.some(r => r.hp === 0)) a.noiseBurst(0.3, { type: 'lowpass', freq: 700, gain: 0.07 });
    else if (st.rocks.length) a.noiseBurst(0.12, { type: 'bandpass', freq: 400, gain: 0.05 });
    if (st.clouds.length) a.noiseBurst(0.25, { type: 'highpass', freq: 2500, gain: 0.015 });
    if (st.inks.some(k => !k.on)) a.bell(ladder(10, ROOT), 0.03, 1.2);
    if (st.moons.length) [0, 4, 7, 12].forEach((k, i) => a.bell(ladder(k, ROOT / 2), 0.045, 1.6, i * 0.07));
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'select':
        if (e.at >= 0) a.tone(1760, 0.05, { type: 'sine', gain: 0.02 });
        break;
      case 'bounce':
        a.tone(196, 0.12, { type: 'triangle', gain: 0.04, slideTo: 150 });
        break;
      case 'resolve':
        if (e.via === 'swap') a.noiseBurst(0.1, { type: 'bandpass', freq: 1800, q: 1.5, gain: 0.02 });
        break;
      case 'arm':
        if (e.tool) a.tone(987.77, 0.15, { type: 'triangle', gain: 0.03, slideTo: 1318.5 });
        break;
      case 'toolMiss':
        a.tone(220, 0.1, { type: 'triangle', gain: 0.03 });
        break;
      case 'tool':
        [0, 4, 7, 11].forEach((k, i) => a.bell(ladder(k, ROOT), 0.045, 1.6, i * 0.08));
        if (e.tool === 'pulsar') [12, 14, 16].forEach((k, i) => a.bell(ladder(k, ROOT), 0.035, 2, 0.4 + i * 0.08));
        break;
      case 'moves':
        [0, 3, 5].forEach((k, i) => a.bell(ladder(k, ROOT), 0.05, 1.4, i * 0.12));
        break;
      case 'pulsarReady':
        a.tone(440, 0.8, { type: 'sine', gain: 0.03, attack: 0.1, slideTo: 880 });
        break;
      case 'changed':
        a.tone(2093, 0.7, { type: 'sine', gain: 0.025, slideTo: 1046.5 });
        a.bell(ladder(9, ROOT), 0.03, 1.8, 0.65);
        break;
      case 'shuffle':
        a.noiseBurst(0.5, { type: 'bandpass', freq: 1200, sweepTo: 3000, q: 0.8, gain: 0.03 });
        break;
      case 'shower':
        [0, 2, 4, 7, 9, 12, 14].forEach((k, i) => a.bell(ladder(k, ROOT), 0.035, 1.2, i * 0.06));
        break;
      case 'won':
        for (let k = 0; k < e.stars; k++) a.bell(ladder(7 + k * 2, ROOT), 0.06, 2, 0.35 + k * 0.35);
        [0, 4, 7].forEach((k, i) => a.bell(ladder(k, ROOT / 2), 0.04, 2, i * 0.08));
        break;
      case 'out':
        a.tone(293.66, 0.8, { type: 'sine', gain: 0.025, slideTo: 246.94 });
        break;
      case 'intro':
        a.bell(ladder(4, ROOT), 0.03, 1.4);
        break;
      case 'telegraph':
        if (e.next?.kind === 'night') a.tone(92.5, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'obs') a.tone(440, 0.5, { type: 'triangle', gain: 0.02, slideTo: 587.33 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'night' ? NIGHT : DAY, 3);
        break;
      case 'finale':
        a.padChord([73.42, 110, 146.83, 220, 293.66], 3);
        a.tone(73.42, 4.5, { type: 'sine', gain: 0.04, attack: 1 });
        break;
      default:
        break;
    }
  }
}
