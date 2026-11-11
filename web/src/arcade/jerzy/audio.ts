/**
 * Jerzy i smok's sound, on the kit's synthesiser (kit/audio.ts): a bright modal pad (D Dorian, a
 * fiddler's tune) whose filter follows the aura in a sighted Tarcza (the runner drives it from
 * JerzySim.padLevel) and holds still elsewhere; the sword's "shing", soft pops as the brood
 * dissolves, a bell that climbs as scales are gathered (combo pitch, reset when the gathering
 * pauses), the hiss of quenched fire, the aura's low beat, the Miecz światła's swell, a fanfare at a
 * level, a chest, an evolution; the dragon's growl before an attack, his roar, the horse's hooves,
 * the squire's splash; the Postój's slow tune; a fanfare when a dragon flies off.  v3: a sting when a
 * dragon's weak spot opens, a great hiss when the shield puts out a ring of fire, a sparkle for a
 * treasure, a chime for a duet, Linda's card shuffle, Burek's woof, Iskierka's munch, Bartek's
 * knocking, sparks of light, the dive's rumble under the turf and the Golden Dragon's jingle.  A
 * missed verdict makes no sound.  Many small sounds are throttled so a crowd never becomes noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { JerzySim, SimEvent } from './sim';

const FIGHT = [73.42, 110, 146.83, 220];
const REST = [73.42, 110, 164.81, 246.94];
const ROOT = 587.33;
/** the Postój's tune: gentle steps of the pentatonic */
const TUNE = [0, 2, 4, 2, 0, 1, 2, 4, 5, 4, 2, 1, 0];

export class JerzySound {
  private tuneI = 0;
  private tuneT = 0;
  private scaleN = 0;
  private scaleQuiet = 0;
  private hiss = 0;
  private pop = 0;
  private swing = 0;
  private hurt = 0;
  private zap = 0;
  private woof = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: FIGHT, dark: 260, bright: 2100, gain: 0.045 });
  }

  update(dt: number, sim: JerzySim): void {
    const a = this.a;
    if (!a.on) return;
    this.hiss = Math.max(0, this.hiss - dt);
    this.pop = Math.max(0, this.pop - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.zap = Math.max(0, this.zap - dt);
    this.woof = Math.max(0, this.woof - dt);
    this.scaleQuiet += dt;
    if (this.scaleQuiet > 1.2) this.scaleN = 0;
    if (sim.restBlock) {
      this.tuneT -= dt;
      if (this.tuneT <= 0) {
        this.tuneT = this.tuneI % 4 === 3 ? 1.1 : 0.7;
        a.bell(ladder(TUNE[this.tuneI % TUNE.length], ROOT / 2), 0.028, 1.6);
        this.tuneI++;
      }
    } else this.tuneT = 0.5;
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'swing':
        if (this.swing > 0) break;
        this.swing = 0.12;
        if (e.weapon === 'miecz') a.noiseBurst(0.09, { type: 'bandpass', freq: 3200, sweepTo: 6000, q: 2, gain: 0.03 });
        else if (e.weapon === 'kopia') a.noiseBurst(0.2, { type: 'bandpass', freq: 1800, sweepTo: 900, gain: 0.03 });
        else if (e.weapon === 'wiadra') a.noiseBurst(0.35, { type: 'bandpass', freq: 1400, sweepTo: 500, q: 0.7, gain: 0.04 });
        else if (e.weapon === 'rog') {
          a.tone(220, 0.5, { type: 'sawtooth', gain: 0.03, attack: 0.03, slideTo: 196 });
          a.tone(329.63, 0.5, { type: 'triangle', gain: 0.02, attack: 0.03 });
        } else if (e.weapon === 'kon') for (let i = 0; i < 6; i++) a.tone(180 + (i % 2) * 40, 0.06, { type: 'triangle', gain: 0.035, at: i * 0.11 });
        break;
      case 'gone':
        if (this.pop > 0 && !e.elite) break;
        this.pop = 0.05;
        a.tone(e.elite ? 392 : 520 + Math.random() * 160, 0.09, { type: 'sine', gain: e.elite ? 0.06 : 0.025, slideTo: e.elite ? 784 : 880 });
        break;
      case 'scale':
        this.scaleQuiet = 0;
        a.bell(ladder(Math.min(14, this.scaleN++), ROOT), e.v >= 10 ? 0.04 : 0.022, 0.5);
        break;
      case 'quench':
        if (this.hiss <= 0 || e.big) {
          this.hiss = 0.12;
          a.noiseBurst(e.big ? 0.4 : 0.2, { type: 'highpass', freq: 3500, sweepTo: 7000, gain: e.big ? 0.045 : 0.022 });
        }
        break;
      case 'pulse':
        if (e.n > 0) a.tone(110, 0.18, { type: 'sine', gain: 0.05, slideTo: 82 });
        break;
      case 'hurt':
        if (this.hurt > 0) break;
        this.hurt = 0.2;
        a.tone(150, 0.2, { type: 'triangle', gain: 0.06, slideTo: 90 });
        a.noiseBurst(0.12, { type: 'lowpass', freq: 600, gain: 0.05 });
        break;
      case 'swordReady':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.045, 1.2, i * 0.06));
        break;
      case 'sword':
        a.tone(146.83, 1.4, { type: 'sawtooth', gain: 0.03, attack: 0.02, slideTo: 293.66 });
        a.noiseBurst(0.8, { type: 'highpass', freq: 2000, sweepTo: 8000, gain: 0.04 });
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.6, i * 0.05));
        break;
      case 'level':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.2, i * 0.05));
        break;
      case 'pick':
        a.bell(ladder(e.gold ? 14 : 12, ROOT), 0.045, 1.4);
        break;
      case 'chest':
        [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.4, i * 0.07));
        break;
      case 'evolve':
        a.padChord([73.42, 110, 146.83, 185], 2);
        [0, 2, 4, 7, 9, 12, 14, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, i * 0.08));
        break;
      case 'apple':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + (e.revive ? 0 : 5), ROOT), 0.035, 1, i * 0.08));
        break;
      case 'down':
        a.tone(196, 0.6, { type: 'sine', gain: 0.05, slideTo: 130, attack: 0.02 });
        break;
      case 'runEnd':
        [7, 4, 2, 0].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.035, 1.6, i * 0.18));
        break;
      case 'newRun':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1, i * 0.1));
        break;
      case 'wave':
        a.tone(98, 0.8, { type: 'sawtooth', gain: 0.02, attack: 0.2, slideTo: 110 });
        break;
      case 'elite':
        a.tone(220, 0.6, { type: 'triangle', gain: 0.03, attack: 0.1, slideTo: 330 });
        break;
      case 'boss':
        a.tone(55, 1.4, { type: 'sawtooth', gain: 0.04, attack: 0.1, slideTo: 41 });
        a.noiseBurst(1, { type: 'lowpass', freq: 600, sweepTo: 200, gain: 0.05 });
        break;
      case 'bossTele':
        // the growl before an attack (a rumble under the turf before a dive)
        if (e.pattern === 'dive') a.noiseBurst(1.2, { type: 'lowpass', freq: 220, sweepTo: 420, gain: 0.05 });
        else a.tone(e.pattern === 'breath' ? 82 : 98, 0.6, { type: 'sawtooth', gain: 0.02, attack: 0.15, slideTo: e.pattern === 'breath' ? 110 : 82 });
        break;
      case 'bossAct':
        if (e.pattern === 'breath') a.noiseBurst(1.2, { type: 'bandpass', freq: 500, sweepTo: 1400, q: 0.6, gain: 0.05 });
        else if (e.pattern === 'ring') a.noiseBurst(1.6, { type: 'bandpass', freq: 380, sweepTo: 1700, q: 0.7, gain: 0.05 });
        else if (e.pattern === 'coins') for (let i = 0; i < 6; i++) a.bell(ladder(10 + Math.floor(Math.random() * 6), ROOT), 0.018, 0.4, i * 0.05);
        else if (e.pattern === 'embers') a.noiseBurst(0.5, { type: 'highpass', freq: 2500, sweepTo: 5000, gain: 0.03 });
        else if (e.pattern === 'dive') {
          a.noiseBurst(0.5, { type: 'lowpass', freq: 500, gain: 0.08 });
          a.tone(55, 0.5, { type: 'sine', gain: 0.06, slideTo: 41 });
        } else a.noiseBurst(0.3, { type: 'lowpass', freq: 400, gain: 0.07 });
        break;
      case 'fatal':
        a.tone(73.42, 0.4, { type: 'sine', gain: 0.06, slideTo: 55 });
        [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT), e.first ? 0.05 : 0.04, 1.2, i * 0.06));
        break;
      case 'ringOut':
        a.noiseBurst(1.1, { type: 'highpass', freq: 2500, sweepTo: 7500, gain: 0.06 });
        [0, 4, 7, 11].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.6, 0.1 + i * 0.07));
        break;
      case 'treasure':
        [0, 4, 7, 11, 14, 19].forEach((n, i) => a.bell(ladder(n, ROOT), e.first ? 0.05 : 0.04, 1.5, i * 0.06));
        break;
      case 'duet':
        a.bell(ladder(7, ROOT), 0.045, 1.2);
        a.bell(ladder(12, ROOT), 0.045, 1.2, 0.12);
        a.bell(ladder(16, ROOT), 0.04, 1.4, 0.24);
        break;
      case 'reroll':
        for (let i = 0; i < 4; i++) a.noiseBurst(0.05, { type: 'bandpass', freq: 2600, q: 1.5, gain: 0.03, at: i * 0.06 });
        break;
      case 'pal':
        if (e.id === 'pies' && this.woof <= 0) {
          this.woof = 0.6;
          a.tone(e.what === 'fetch' ? 760 : 320, 0.08, { type: 'triangle', gain: 0.045, slideTo: e.what === 'fetch' ? 980 : 190 });
          if (e.what === 'bite') a.tone(300, 0.07, { type: 'triangle', gain: 0.035, slideTo: 180, at: 0.12 });
        } else if (e.id === 'iskierka') {
          a.noiseBurst(0.06, { type: 'lowpass', freq: 900, gain: 0.04 });
          a.noiseBurst(0.06, { type: 'lowpass', freq: 900, gain: 0.04, at: 0.1 });
          a.bell(ladder(12, ROOT), 0.025, 0.5, 0.18);
        } else if (e.id === 'bobr') for (let i = 0; i < 3; i++) a.tone(190, 0.06, { type: 'square', gain: 0.02, at: i * 0.09, slideTo: 150 });
        break;
      case 'spark':
        if (this.zap > 0) break;
        this.zap = 0.08;
        a.tone(e.from === 'mirror' ? 1200 : 820, 0.07, { type: 'sine', gain: 0.025, slideTo: e.from === 'mirror' ? 2100 : 1500 });
        break;
      case 'block':
        a.tone(130, 0.12, { type: 'triangle', gain: 0.04, slideTo: 80 });
        break;
      case 'flaw':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.035, 0.8, i * 0.06));
        break;
      case 'roar':
        a.tone(55, 1.2, { type: 'sawtooth', gain: 0.045, attack: 0.05, slideTo: 41 });
        a.noiseBurst(0.9, { type: 'lowpass', freq: 600, gain: 0.05 });
        break;
      case 'nap':
        a.tone(110, 1.5, { type: 'sine', gain: 0.03, attack: 0.3, slideTo: 73.42 });
        break;
      case 'driven':
        [0, 2, 4, 5, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, i * 0.09));
        a.padChord([73.42, 110, 146.83, 185], 3);
        break;
      case 'smoke':
        a.tone(146.83, 1, { type: 'sine', gain: 0.04, attack: 0.2, slideTo: 293.66 });
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(73.42, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(293.66, 0.5, { type: 'triangle', gain: 0.02, slideTo: 329.63 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? REST : FIGHT, 3);
        this.tuneI = 0;
        break;
      case 'done':
        a.padChord([73.42, 110, 146.83, 220], 3);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, 0.3 + i * 0.25));
        break;
      default:
        break;
    }
  }
}
