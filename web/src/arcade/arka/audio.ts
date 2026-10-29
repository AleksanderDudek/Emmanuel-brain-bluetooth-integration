/**
 * Arka's sound, on the kit's synthesiser (kit/audio.ts): a warm open pad in morning G whose filter
 * follows what the screen shows (the runner drives it from ArkaSim.padLevel: L in a sighted Day,
 * held still elsewhere), the deck's creaks, hoof clops pitched by kind while animals walk (soft for
 * sheep, deep for cattle, a patter for birds), the pair's chime — two plucked, lyre-like notes a
 * fifth apart, a semitone higher for each link of a chain, capped at an octave — the family's hammer
 * at the level's tempo by Day, a finished plank's thunk and three rising notes; in the Evening the
 * last drips fading, the dove's wingbeats and a low lantern hum; the finisher's open-fifth chord.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { KindId } from './content';
import { moving, type ArkaSim, type SimEvent } from './sim';

/** Morning: G with an open ninth; the Evening moves to a softer, lower E minor seventh. */
const MORNING = [98, 146.83, 196, 220];
const EVENING = [82.41, 123.47, 164.81, 196];
const ROOT = 392;

/** A clop's pitch per kind (Hz of the filtered knock). */
const CLOP: Readonly<Record<KindId, number>> = {
  sheep: 1500, goat: 1700, donkey: 1150, cow: 700, horse: 950, camel: 620,
  ibex: 1600, hyrax: 2100, deer: 1350, stork: 2600, partridge: 2900, lion: 820,
};

export class ArkaSound {
  private creak = 4;
  private clop = 0;
  private drip = 1.2;
  private wing = 0;
  private hum = 2;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: MORNING, dark: 260, bright: 1500, gain: 0.055 });
  }

  update(dt: number, sim: ArkaSim, hammerHit: boolean): void {
    const a = this.a;
    if (!a.on) return;
    if (hammerHit) {
      // the family's hammer on a fresh plank
      a.noiseBurst(0.05, { type: 'bandpass', freq: 1900, q: 3, gain: 0.035 });
      a.tone(196, 0.06, { type: 'triangle', gain: 0.03 });
    }
    // hooves on wood while animals walk
    this.clop -= dt;
    if (this.clop <= 0) {
      this.clop = 0.17;
      for (const b of sim.hold.beasts) {
        if (!moving(b)) continue;
        const bird = b.kind === 'stork' || b.kind === 'partridge';
        a.noiseBurst(bird ? 0.025 : 0.045, { type: 'bandpass', freq: CLOP[b.kind] * (0.94 + Math.random() * 0.12), q: bird ? 6 : 4, gain: bird ? 0.022 : 0.03 });
        break;
      }
    }
    const evening = sim.phase === 'play' && sim.block.kind === 'evening';
    // the deck creaks now and then
    this.creak -= dt;
    if (this.creak <= 0) {
      this.creak = 5 + Math.random() * 5;
      a.noiseBurst(0.6, { type: 'bandpass', freq: 240, sweepTo: 180, q: 6, gain: 0.025 });
    }
    if (evening) {
      const into = sim.now - sim.block.start;
      // the last drips, fewer and fainter as the Evening goes on
      this.drip -= dt;
      if (this.drip <= 0 && into < 14) {
        this.drip = 1 + into * 0.25 + Math.random() * 1.2;
        const f = 1500 + Math.random() * 700;
        a.tone(f, 0.08, { type: 'sine', gain: 0.022 * Math.max(0.2, 1 - into / 14), slideTo: f * 0.55 });
      }
      // the dove's wingbeats while it flies, a low lantern hum
      if (sim.dove.state === 'out') {
        this.wing -= dt;
        if (this.wing <= 0) {
          this.wing = 2.6 + Math.random() * 2;
          for (let i = 0; i < 3; i++) a.noiseBurst(0.07, { type: 'bandpass', freq: 700, q: 1.2, gain: 0.018, at: i * 0.11 });
        }
      }
      this.hum -= dt;
      if (this.hum <= 0) {
        this.hum = 3.5;
        a.tone(110, 3.4, { type: 'sine', gain: 0.012, attack: 1.2 });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'send':
        a.noiseBurst(0.05, { type: 'bandpass', freq: CLOP[e.beast.kind], q: 4, gain: 0.04 });
        break;
      case 'bump': {
        // a soft bleat
        const f = 300 + Math.random() * 60;
        a.tone(f, 0.22, { type: 'triangle', gain: 0.045, slideTo: f * 0.9 });
        a.tone(f * 1.02, 0.18, { type: 'sine', gain: 0.025, at: 0.05, slideTo: f * 0.88 });
        break;
      }
      case 'full':
        a.tone(196, 0.22, { type: 'triangle', gain: 0.04 });
        a.tone(174.61, 0.3, { type: 'triangle', gain: 0.035, at: 0.16 });
        break;
      case 'wait':
        a.noiseBurst(0.18, { type: 'highpass', freq: 3200, gain: 0.02 });
        break;
      case 'pair': {
        // two plucked notes a fifth apart, a semitone higher with each link of the chain (an octave at most)
        const f = ROOT * 2 ** (Math.min(12, e.chain) / 12);
        this.pluck(f, 0);
        this.pluck(f * 1.5, 0.11);
        break;
      }
      case 'plank':
        if (e.blind) break;
        a.noiseBurst(0.16, { type: 'lowpass', freq: 380, gain: 0.08 });
        a.tone(92, 0.18, { type: 'sine', gain: 0.08, slideTo: 60 });
        [0, 1, 2].forEach((n, i) => this.pluck(ladder(n, ROOT), 0.12 + i * 0.1, 0.06));
        break;
      case 'blindReveal':
        if (e.planks > 0) [0, 1, 2, 4].forEach((n, i) => this.pluck(ladder(n, ROOT), i * 0.1, 0.05));
        break;
      case 'hand':
        a.tone(196, 0.7, { type: 'sine', gain: 0.05, attack: 0.05 });
        a.tone(293.66, 0.6, { type: 'sine', gain: 0.03, attack: 0.08, at: 0.06 });
        if (e.leaf) a.noiseBurst(0.3, { type: 'highpass', freq: 4200, gain: 0.02 });
        break;
      case 'clear':
        [0, 2, 4, 5, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.06, 1.8, i * 0.09));
        break;
      case 'telegraph':
        if (e.next === 'day') {
          // dawn on the door: two hammer taps, a rising two-note figure
          for (let i = 0; i < 2; i++) a.noiseBurst(0.05, { type: 'bandpass', freq: 1900, q: 3, gain: 0.04, at: i * 0.35 });
          this.pluck(ROOT, 0.8, 0.06);
          this.pluck(ROOT * 1.5, 1.05, 0.06);
        } else {
          // the dove coos on the rail, a falling figure
          a.tone(330, 0.32, { type: 'sine', gain: 0.04, slideTo: 300 });
          a.tone(311, 0.42, { type: 'sine', gain: 0.035, at: 0.36, slideTo: 262 });
          this.pluck(ROOT * 1.5, 0.9, 0.05);
          this.pluck(ROOT, 1.15, 0.05);
        }
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'evening' ? EVENING : MORNING, 3);
        break;
      case 'post':
        // the family's short work song
        [0, 2, 1, 4].forEach((n, i) => this.pluck(ladder(n, ROOT / 2), i * 0.16, 0.06));
        break;
      case 'almost':
        this.pluck(ladder(1, ROOT / 2), 0, 0.035);
        break;
      case 'dove':
        for (let i = 0; i < 4; i++) a.noiseBurst(0.08, { type: 'bandpass', freq: 650, q: 1.1, gain: 0.03, at: i * 0.12 });
        if (e.leaf) {
          a.bell(ladder(7, ROOT), 0.06, 1.8, 0.5);
          a.bell(ladder(9, ROOT), 0.05, 2, 0.62);
        }
        break;
      case 'young':
        a.bell(ladder(5, ROOT), 0.05, 1.4);
        a.bell(ladder(7, ROOT), 0.045, 1.6, 0.14);
        break;
      case 'built':
        [0, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, i * 0.12));
        break;
      case 'finale':
        // an open fifth under the rainbow
        a.padChord([98, 146.83, 196, 293.66], 2);
        a.tone(98, 4.2, { type: 'sine', gain: 0.05, attack: 0.8 });
        a.tone(146.83, 4, { type: 'sine', gain: 0.04, attack: 1 });
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 2.6, 0.6 + i * 0.3));
        break;
      default:
        break;
    }
  }

  /** A plucked, lyre-like string: a quick triangle with a quiet octave. */
  private pluck(f: number, at: number, gain = 0.07): void {
    this.a.tone(f, 0.9, { type: 'triangle', gain, at, attack: 0.004 });
    this.a.tone(f * 2, 0.5, { type: 'sine', gain: gain * 0.25, at, attack: 0.004 });
  }
}
