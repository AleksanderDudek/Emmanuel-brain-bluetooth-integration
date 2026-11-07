/**
 * Arka's sound (v2), on the kit's synthesiser (kit/audio.ts): a warm open pad in morning G whose
 * filter follows the focus only in a sighted Mgła (ArkaSim.padLevel), the deck's creaks, and a voice
 * for everything the hands do — the whoosh of an animal sliding out with a clop pitched by its kind,
 * a rising bell for every clean send in a row (the streak), the dull thud of a bump and a heart's
 * low drop, the pair's two plucked notes a fifth apart (brighter for "Parami!"), the wake-up yawn,
 * the pen's latch, the goat's quick bleat, the dove's coo, the stars' chimes, the rainbow's arpeggio,
 * the sun breaking through the mist, and the raven's short "kra" when he speaks.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { KindId } from './content';
import type { ArkaSim, SimEvent } from './sim';

const MORNING = [98, 146.83, 196, 220];
const DUSK = [82.41, 123.47, 164.81, 196];
const ROOT = 392;

const CLOP: Readonly<Record<KindId, number>> = {
  sheep: 1500, goat: 1700, donkey: 1150, cow: 700, horse: 950, camel: 620,
  ibex: 1600, hyrax: 2100, deer: 1350, stork: 2600, partridge: 2900, lion: 820,
};

export class ArkaSound {
  private creak = 4;
  private wind = 0;
  private rest = false;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: MORNING, dark: 260, bright: 1500, gain: 0.055 });
  }

  update(dt: number, sim: ArkaSim): void {
    const a = this.a;
    if (!a.on) return;
    const rest = sim.phase === 'play' && sim.block.kind === 'rest';
    if (rest !== this.rest) {
      this.rest = rest;
      a.padChord(rest ? DUSK : MORNING, 3);
    }
    this.creak -= dt;
    if (this.creak <= 0) {
      this.creak = 5 + Math.random() * 6;
      a.tone(70 + Math.random() * 30, 0.5, { type: 'triangle', gain: 0.018, slideTo: 55 });
    }
    // the mist's wind while it lies on the deck
    if (sim.mist > 0.3) {
      this.wind -= dt;
      if (this.wind <= 0) {
        this.wind = 2.5 + Math.random() * 2;
        a.noiseBurst(2.2, { type: 'lowpass', freq: 500, sweepTo: 260, gain: 0.025 * sim.mist });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'send': {
        a.noiseBurst(0.32, { type: 'bandpass', freq: 600, sweepTo: 2600, q: 0.9, gain: 0.07 });
        a.noiseBurst(0.05, { type: 'bandpass', freq: CLOP[e.kind], q: 4, gain: 0.04, at: 0.03 });
        a.noiseBurst(0.05, { type: 'bandpass', freq: CLOP[e.kind] * 0.94, q: 4, gain: 0.03, at: 0.12 });
        a.combo(Math.min(e.chain, 14), ROOT, 0.055);
        break;
      }
      case 'bump':
        a.tone(110, 0.18, { type: 'sine', gain: 0.14, slideTo: 70 });
        a.noiseBurst(0.08, { type: 'lowpass', freq: 400, gain: 0.08 });
        if (e.lost) a.tone(330, 0.35, { type: 'triangle', gain: 0.05, slideTo: 196, at: 0.08 });
        break;
      case 'pair': {
        const base = e.bonus ? 523.25 : 392;
        a.tone(base, 0.5, { type: 'triangle', gain: 0.07 });
        a.tone(base * 1.5, 0.6, { type: 'triangle', gain: 0.06, at: 0.09 });
        if (e.bonus) a.bell(base * 2, 0.06, 1.2, 0.18);
        if (e.young) a.bell(ROOT * 2.5, 0.05, 1.4, 0.3);
        break;
      }
      case 'wake':
        a.tone(220, 0.45, { type: 'sine', gain: 0.05, slideTo: 330 });
        break;
      case 'turn':
        a.tone(700, 0.12, { type: 'square', gain: 0.018, slideTo: 620 });
        break;
      case 'locked':
        a.noiseBurst(0.06, { type: 'bandpass', freq: 3000, q: 6, gain: 0.04 });
        a.noiseBurst(0.06, { type: 'bandpass', freq: 2600, q: 6, gain: 0.035, at: 0.08 });
        break;
      case 'unlock':
        a.noiseBurst(0.05, { type: 'bandpass', freq: 3200, q: 5, gain: 0.05 });
        a.bell(784, 0.07, 1);
        break;
      case 'clear': {
        const n = e.stars;
        for (let i = 0; i < 3; i++) a.bell(ladder(4 + i * 2, ROOT), i < n ? 0.09 : 0.03, 1.4, 0.3 + i * 0.22);
        break;
      }
      case 'restart':
        a.tone(196, 0.8, { type: 'triangle', gain: 0.05, slideTo: 147 });
        break;
      case 'dove':
        a.tone(440, 0.22, { type: 'sine', gain: 0.05, slideTo: 392 });
        a.tone(392, 0.3, { type: 'sine', gain: 0.045, at: 0.24, slideTo: 349 });
        break;
      case 'doveBusy':
        a.tone(300, 0.08, { type: 'sine', gain: 0.025 });
        break;
      case 'rainbow':
        [0, 2, 4, 5, 7].forEach((s, i) => a.bell(ladder(s, ROOT), 0.06, 1.6, i * 0.1));
        break;
      case 'sun':
        a.bell(ROOT * 2, 0.06, 1.8);
        a.bell(ROOT * 3, 0.04, 1.8, 0.12);
        break;
      case 'say':
        // the raven clears his throat
        a.noiseBurst(0.09, { type: 'bandpass', freq: 900, sweepTo: 600, q: 2, gain: 0.03 });
        a.tone(520, 0.1, { type: 'sawtooth', gain: 0.015, slideTo: 380 });
        break;
      case 'level':
        a.noiseBurst(0.3, { type: 'lowpass', freq: 300, gain: 0.04 });
        break;
      case 'finale':
        a.padChord(MORNING, 2);
        [0, 4, 7].forEach((s, i) => a.bell(ladder(s, ROOT / 2), 0.05, 2.4, i * 0.15));
        break;
      default:
        break;
    }
  }
}
