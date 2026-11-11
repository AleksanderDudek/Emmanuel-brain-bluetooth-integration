/**
 * Kocia straż's sound, on the kit's synthesiser (kit/audio.ts): a warm pastoral pad (G major) whose
 * filter follows alertness in a sighted push (the runner drives it from KotySim.padLevel) and holds
 * still elsewhere; every toy its own small voice (a pea's pip, a splash, a yarn ball's boing, a bubble's
 * bloop, a mirror's shimmer, an apple's thunk), a startled pest's "yip" and a fish's clink that climbs
 * with a streak (combo pitch, reset when the chasing pauses), a merge's pop and a chime as high as the
 * new grade, a purr when a cat is petted, a "psst", the chief's comic horn, the Great Hunt's rush and
 * fanfare, the nap's lullaby, the vintage's chord.  Many small sounds are throttled so a busy field
 * never becomes noise; a missed verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { FamId } from './content';
import type { KotySim, SimEvent } from './sim';

const WATCH = [98, 146.83, 196, 246.94];
const NAP = [87.31, 130.81, 174.61, 220];
const ROOT = 523.25;
/** the nap's lullaby: gentle steps of the pentatonic */
const LULLABY = [4, 2, 0, 2, 4, 4, 4, 3, 2, 2, 2, 4, 7, 7];

export class KotySound {
  private shotGap = 0;
  private hitGap = 0;
  private yipGap = 0;
  private streak = 0;
  private quiet = 0;
  private tuneI = 0;
  private tuneT = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: WATCH, dark: 300, bright: 2300, gain: 0.04 });
  }

  update(dt: number, sim: KotySim): void {
    const a = this.a;
    if (!a.on) return;
    this.shotGap = Math.max(0, this.shotGap - dt);
    this.hitGap = Math.max(0, this.hitGap - dt);
    this.yipGap = Math.max(0, this.yipGap - dt);
    this.quiet += dt;
    if (this.quiet > 1.4) this.streak = 0;
    if (sim.restBlock && sim.napK > 0.6) {
      this.tuneT -= dt;
      if (this.tuneT <= 0) {
        this.tuneT = this.tuneI % 4 === 3 ? 1.2 : 0.75;
        a.bell(ladder(LULLABY[this.tuneI % LULLABY.length], ROOT / 2), 0.026, 1.8);
        this.tuneI++;
      }
    } else this.tuneT = 0.4;
  }

  private shot(fam: FamId): void {
    const a = this.a;
    if (this.shotGap > 0) return;
    this.shotGap = 0.07;
    switch (fam) {
      case 'proca': a.tone(1500 + Math.random() * 300, 0.05, { type: 'sine', gain: 0.018, slideTo: 900 }); break;
      case 'dmuchawka': a.tone(1900 + Math.random() * 300, 0.035, { type: 'sine', gain: 0.012, slideTo: 1300 }); break;
      case 'konewka': a.noiseBurst(0.12, { type: 'bandpass', freq: 2400, sweepTo: 1200, q: 1.2, gain: 0.02 }); break;
      case 'sikawka': a.noiseBurst(0.16, { type: 'highpass', freq: 2600, sweepTo: 4200, gain: 0.018 }); break;
      case 'klebek': a.tone(260, 0.14, { type: 'sine', gain: 0.03, slideTo: 520 }); break;
      case 'banki': a.tone(480, 0.12, { type: 'sine', gain: 0.025, slideTo: 960 }); break;
      case 'lusterko': if (Math.random() < 0.35) a.bell(2093 + Math.random() * 400, 0.008, 0.25); break;
      case 'katapulta': a.tone(140, 0.12, { type: 'triangle', gain: 0.04, slideTo: 90 }); break;
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'shot':
        this.shot(e.fam);
        break;
      case 'hit':
        if (this.hitGap > 0 && !e.boss) break;
        this.hitGap = 0.05;
        a.tone(e.boss ? 180 : 700 + Math.random() * 200, 0.04, { type: 'triangle', gain: e.boss ? 0.03 : 0.012 });
        break;
      case 'splash':
        if (e.kind === 'apple') a.noiseBurst(0.18, { type: 'lowpass', freq: 500, gain: 0.04 });
        else a.noiseBurst(0.2, { type: 'bandpass', freq: 1600, sweepTo: 700, q: 0.8, gain: 0.025 });
        break;
      case 'chased':
        this.quiet = 0;
        if (this.yipGap <= 0) {
          this.yipGap = 0.06;
          const hi = e.kind === 'mysz' || e.kind === 'rybik' || e.kind === 'wrobel' || e.kind === 'szpak' ? 1.6 : 1;
          a.tone(520 * hi, 0.09, { type: 'square', gain: 0.012, slideTo: 980 * hi });
        }
        a.bell(ladder(Math.min(14, this.streak++), ROOT), e.elite ? 0.04 : 0.022, 0.45);
        break;
      case 'merge':
        a.tone(220, 0.08, { type: 'sine', gain: 0.05, slideTo: 440 });
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + Math.min(9, e.toy.g), ROOT), 0.04, 0.9, 0.05 + i * 0.06));
        if (e.fresh) [12, 16].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.2, 0.3 + i * 0.08));
        break;
      case 'equip':
      case 'swap':
        a.tone(660, 0.06, { type: 'triangle', gain: 0.025, slideTo: 880 });
        break;
      case 'buy':
        a.bell(ladder(7 + (e.level % 5), ROOT), 0.03, 0.5);
        break;
      case 'cant':
      case 'nope':
        a.tone(160, 0.12, { type: 'sine', gain: 0.03, slideTo: 120 });
        break;
      case 'toy':
        if (e.source !== 'shop') [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.03, 1, i * 0.06));
        break;
      case 'huntReady':
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.04, 1.1, i * 0.05));
        break;
      case 'hunt':
        a.noiseBurst(0.9, { type: 'highpass', freq: 1500, sweepTo: 6000, gain: 0.04 });
        a.tone(196, 1.2, { type: 'sawtooth', gain: 0.025, attack: 0.03, slideTo: 392 });
        [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.4, i * 0.06));
        break;
      case 'pounce':
        a.tone(110, 0.08, { type: 'sine', gain: 0.04, slideTo: 70 });
        break;
      case 'boss':
        a.tone(98, 0.7, { type: 'sawtooth', gain: 0.03, attack: 0.05, slideTo: 82 });
        a.tone(73.42, 0.9, { type: 'triangle', gain: 0.04, attack: 0.1 });
        break;
      case 'bossTele':
        a.tone(196, 0.5, { type: 'triangle', gain: 0.02, slideTo: 247 });
        break;
      case 'bossTrick':
        a.noiseBurst(0.35, { type: 'bandpass', freq: 900, sweepTo: 2200, q: 0.8, gain: 0.03 });
        break;
      case 'bossChased':
        [0, 2, 4, 5, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 1.8, i * 0.08));
        a.padChord([98, 146.83, 196, 293.66], 2);
        break;
      case 'bossBacks':
        [7, 4, 2].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.03, 1.2, i * 0.15));
        break;
      case 'stage':
        if (e.newPlace) [0, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.2, i * 0.1));
        else a.bell(ladder(4, ROOT), 0.025, 0.7);
        break;
      case 'pet':
        a.noiseBurst(0.8, { type: 'lowpass', freq: 160, q: 2, gain: 0.08 });
        break;
      case 'clap':
        a.noiseBurst(0.12, { type: 'highpass', freq: 5000, gain: 0.03 });
        break;
      case 'napStart':
        a.padChord(NAP, 3);
        this.tuneI = 0;
        break;
      case 'ripe':
        a.bell(ladder(9 + Math.floor(Math.random() * 3), ROOT), 0.012, 0.6);
        break;
      case 'napEnd':
        a.padChord(WATCH, 3);
        break;
      case 'cat':
        [0, 4, 7, 11, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.3, i * 0.09));
        break;
      case 'vintage':
        a.padChord([98, 146.83, 196, 246.94], 2);
        [0, 2, 4, 7, 9, 12, 14, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2.2, i * 0.09));
        break;
      case 'dusk':
        a.tone(196, 1, { type: 'sine', gain: 0.035, attack: 0.2, slideTo: 392 });
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(87.31, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(392, 0.4, { type: 'triangle', gain: 0.02, slideTo: 440 });
        break;
      case 'blockStart':
        if (e.block.kind !== 'rest') a.padChord(WATCH, 3);
        break;
      case 'done':
        a.padChord(WATCH, 3);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, 0.3 + i * 0.25));
        break;
      default:
        break;
    }
  }
}
