/**
 * Zacheusz's sound, on the kit's synthesiser (kit/audio.ts): a warm pad in D whose filter follows
 * the level in a sighted push (the runner drives it from ZacheuszSim.padLevel), a softer chord in
 * the fig orchard; a bright tick for every denarius climbing a pentatonic ladder as the chain grows
 * (light coins an octave up); a "hup" for a jump, a whoosh for a spin, a boing off an awning or the
 * crowd, a spring's twang; a goose's honk and a goat's bleat for a bonk (a pitch up per bonk in a
 * row), a stone's knock, a soap "plip" for the bubble; a soft chime as each plank of light lays;
 * plucks for figs; bells for a special denarius, a full set, the finish palm (more bells the higher)
 * and a household restored.  A fall or a missed block makes no sad sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent, ZacheuszSim } from './sim';

const PAD = [73.42, 110, 146.83, 220];
const SHADE = [65.41, 98, 130.81, 164.81];
const ROOT = 523.25;

export class ZacheuszSound {
  private shade = false;
  private lastTick = 0;
  private lastPlank = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 260, bright: 1700, gain: 0.05 });
  }

  update(_dt: number, sim: ZacheuszSim): void {
    const a = this.a;
    if (!a.on) return;
    const shade = sim.inOrchard;
    if (shade !== this.shade) {
      this.shade = shade;
      a.padChord(shade ? SHADE : PAD, 3);
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    const now = a.ctx?.currentTime ?? 0;
    switch (e.type) {
      case 'coin':
        if (now - this.lastTick > 0.04) {
          this.lastTick = now;
          a.tone(ladder(Math.min(14, e.chain - 1), ROOT * (e.light ? 4 : 2)), 0.09, { type: 'triangle', gain: e.light ? 0.03 : 0.045 });
        }
        break;
      case 'special':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ROOT * 2 ** (n / 12), 0.06, 1.4, i * 0.06));
        break;
      case 'set':
        [0, 4, 7, 12, 16, 19].forEach((n, i) => a.bell(ROOT * 2 ** (n / 12), 0.06, 1.8, i * 0.08));
        break;
      case 'jump':
        a.tone(330, 0.12, { type: 'sine', gain: 0.03, slideTo: e.held ? 620 : 520 });
        break;
      case 'spin':
        a.noiseBurst(0.18, { type: 'bandpass', freq: 1200, sweepTo: 3200, gain: 0.025 });
        break;
      case 'bounce':
        a.tone(196, 0.28, { type: 'triangle', gain: 0.06, slideTo: 520 });
        if (e.on === 'crowd') a.noiseBurst(0.3, { type: 'bandpass', freq: 900, q: 1.5, gain: 0.03, at: 0.05 });
        break;
      case 'spring':
        a.tone(140, 0.4, { type: 'triangle', gain: 0.06, slideTo: 880 });
        a.bell(ladder(7, ROOT), 0.03, 0.8, 0.1);
        break;
      case 'wallJump':
        a.noiseBurst(0.06, { type: 'lowpass', freq: 900, gain: 0.05 });
        a.noiseBurst(0.22, { type: 'bandpass', freq: 1400, sweepTo: 2600, gain: 0.025, at: 0.02 });
        break;
      case 'vault':
        a.tone(440, 0.08, { type: 'triangle', gain: 0.025, slideTo: 560 });
        break;
      case 'bonk': {
        const up = 2 ** (Math.min(4, e.chain - 1) / 6);
        a.tone(160 * up, 0.12, { type: 'square', gain: 0.03, slideTo: 90 * up });
        if (e.kind === 'goose') {
          a.tone(620 * up, 0.12, { type: 'sawtooth', gain: 0.02, slideTo: 520 * up, at: 0.05 });
          a.tone(640 * up, 0.1, { type: 'sawtooth', gain: 0.018, slideTo: 540 * up, at: 0.18 });
        } else a.tone(300 * up, 0.35, { type: 'sawtooth', gain: 0.018, slideTo: 280 * up, at: 0.05 });
        break;
      }
      case 'land':
        if (e.fall > 0.8) a.noiseBurst(0.1, { type: 'lowpass', freq: 380, gain: Math.min(0.06, 0.02 + e.fall * 0.012) });
        break;
      case 'mantle':
        a.tone(392, 0.1, { type: 'triangle', gain: 0.025, slideTo: 494 });
        break;
      case 'legUp':
        a.tone(262, 0.3, { type: 'triangle', gain: 0.04, slideTo: 523 });
        break;
      case 'tile':
        a.noiseBurst(0.06, { type: 'lowpass', freq: 600, gain: 0.05 });
        a.tone(e.kind === 'pause' ? 330 : e.kind === 'back' ? 262 : 523, 0.15, { type: 'triangle', gain: 0.03, at: 0.03 });
        break;
      case 'longJump':
        a.noiseBurst(0.3, { type: 'bandpass', freq: 800, sweepTo: 2400, gain: 0.03 });
        break;
      case 'fall':
        if (e.bubble) a.tone(880, 0.25, { type: 'sine', gain: 0.03, slideTo: 1320 });
        else a.noiseBurst(0.35, { type: 'bandpass', freq: 600, q: 6, gain: 0.03 });
        break;
      case 'pop':
        a.noiseBurst(0.05, { type: 'highpass', freq: 3000, gain: 0.05 });
        a.tone(1200, 0.06, { type: 'sine', gain: 0.03, slideTo: 1800 });
        break;
      case 'plank':
        if (now - this.lastPlank > 0.08) {
          this.lastPlank = now;
          a.tone(1320, 0.07, { type: 'sine', gain: 0.012 });
        }
        break;
      case 'road':
        if (e.on) [0, 2, 4].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.03, 1, i * 0.07));
        break;
      case 'view':
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.6, i * 0.09));
        break;
      case 'pushPass':
      case 'restPass':
        [0, 4, 7].forEach((n, i) => a.bell(ROOT * 2 ** (n / 12), 0.04, 1.2, i * 0.1));
        break;
      case 'figs':
        for (let i = 0; i < Math.min(5, e.n); i++) a.tone(ladder(i + 2, 392), 0.18, { type: 'triangle', gain: 0.035, at: i * 0.07 });
        break;
      case 'trunk':
        for (let i = 0; i < e.band + 2; i++) a.bell(ladder(i * 2, ROOT * 0.75), 0.05, 1.3, i * 0.11);
        break;
      case 'levelDone':
        a.bell(ladder(4, ROOT), 0.04, 1.2, 0.3);
        break;
      case 'home':
        [0, 4, 7, 11].forEach((n, i) => a.bell(ROOT * 0.5 * 2 ** (n / 12), 0.055, 2.2, i * 0.12));
        break;
      case 'gift':
        a.bell(ladder(4, ROOT), 0.05, 1.4);
        a.bell(ladder(7, ROOT), 0.045, 1.4, 0.12);
        break;
      case 'levelStart':
        a.tone(ladder(0, 392), 0.2, { type: 'triangle', gain: 0.035 });
        a.tone(ladder(4, 392), 0.3, { type: 'triangle', gain: 0.035, at: 0.12 });
        break;
      case 'story':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ROOT * 0.5 * 2 ** (n / 12), 0.05, 2.6, i * 0.2));
        break;
      default:
        break;
    }
  }
}
