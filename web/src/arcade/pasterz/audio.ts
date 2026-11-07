/**
 * Pasterz's sound, on the kit's synthesiser (kit/audio.ts): an open pastoral pad in G whose filter
 * follows the call ring in a sighted Wołanie (the runner drives it from PasterzSim.padLevel) and
 * turns to a quiet E minor at night; a sheep's "baa" (three falling triangle-and-reed notes) when
 * sheep join, with a pluck that climbs as the joins come close together (the combo ladder); a
 * bright pop for every sheep won from a rival and a low one for every sheep lost; Łatek's whistle
 * and bark; the Głos's horn and bells; a comic falling "wah" when a rival sulks; a crown's
 * fanfare; a bell for each star; the tally's count.  A missed verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { PasterzSim, SimEvent } from './sim';

const DAY = [98, 146.83, 196, 246.94];
const NIGHT = [82.41, 123.47, 164.81, 196];
const ROOT = 392;

export class PasterzSound {
  private lastBaa = -1;
  private chain = 0;
  private chainT = 0;
  private lastPop = -1;
  private crackle = 0;
  private clock = 0;
  private lastStep = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY, dark: 260, bright: 1700, gain: 0.05 });
  }

  update(dt: number, sim: PasterzSim): void {
    const a = this.a;
    if (!a.on) return;
    this.clock += dt;
    this.chainT = Math.max(0, this.chainT - dt);
    if (this.chainT <= 0) this.chain = 0;
    const pl = sim.player;
    if (pl.stepT - this.lastStep >= 0.75) {
      this.lastStep = pl.stepT;
      a.noiseBurst(0.06, { type: 'highpass', freq: 2400, gain: 0.007 });
    }
    if (pl.stepT < this.lastStep) this.lastStep = pl.stepT;
    if (sim.night > 0.4) {
      this.crackle -= dt;
      if (this.crackle <= 0) {
        this.crackle = 0.12 + Math.random() * 0.5;
        a.noiseBurst(0.04, { type: 'highpass', freq: 3000 + Math.random() * 2000, gain: 0.01 * sim.night });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'join':
        if (e.who !== 0) break;
        this.chain = Math.min(19, this.chain + 1);
        this.chainT = 0.9;
        if (this.clock - this.lastPop > 0.045) {
          this.lastPop = this.clock;
          this.pluck(ladder(this.chain, ROOT), 0, 0.03);
        }
        if (this.clock - this.lastBaa > 0.22) {
          this.lastBaa = this.clock;
          this.baa(e.via === 'morning' ? 640 : 360 + Math.random() * 120, 0.026);
        }
        break;
      case 'steal':
        if (this.clock - this.lastPop < 0.045) break;
        this.lastPop = this.clock;
        if (e.to === 0) {
          this.chain = Math.min(19, this.chain + 1);
          this.chainT = 0.9;
          a.tone(ladder(this.chain + 3, ROOT), 0.12, { type: 'square', gain: 0.018, slideTo: ladder(this.chain + 5, ROOT) });
        } else if (e.from === 0) a.tone(220, 0.14, { type: 'triangle', gain: 0.03, slideTo: 160 });
        break;
      case 'out':
        // a comic falling "wah-wah"
        a.tone(330, 0.28, { type: 'sawtooth', gain: 0.025, slideTo: 290 });
        a.tone(290, 0.5, { type: 'sawtooth', gain: 0.025, slideTo: 200, at: 0.28 });
        break;
      case 'tumble':
        a.noiseBurst(0.5, { type: 'bandpass', freq: 1800, sweepTo: 300, q: 0.8, gain: 0.04 });
        this.bark(0.15);
        break;
      case 'whistle':
        if (e.herd) {
          a.tone(1567.98, 0.12, { type: 'sine', gain: 0.04, slideTo: 2093 });
          a.tone(2093, 0.18, { type: 'sine', gain: 0.035, at: 0.13, slideTo: 1760 });
        } else a.tone(1200, 0.1, { type: 'sine', gain: 0.02 });
        break;
      case 'herd':
        this.bark(0);
        break;
      case 'voice':
        a.tone(196, 1.4, { type: 'triangle', gain: 0.05, attack: 0.15 });
        a.tone(293.66, 1.3, { type: 'triangle', gain: 0.04, attack: 0.2, at: 0.1 });
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.6, 0.25 + i * 0.09));
        a.noiseBurst(1.2, { type: 'bandpass', freq: 500, sweepTo: 1500, q: 0.7, gain: 0.02 });
        if (e.lamb) this.baa(720, 0.014, 1.1);
        break;
      case 'bleat':
        this.baa(760, 0.012);
        break;
      case 'lambFound':
        this.baa(680, 0.04);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.8, 0.2 + i * 0.1));
        break;
      case 'lambNamed':
        a.bell(1318.5, 0.04, 2.2);
        a.bell(1567.98, 0.03, 2.2, 0.35);
        break;
      case 'crown':
        if (e.who === 0) [0, 4, 7, 12].forEach((n, i) => a.tone(ladder(n, ROOT), 0.22, { type: 'square', gain: 0.022, at: i * 0.08 }));
        break;
      case 'roundEnd':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.09));
        if (e.tally.place === 1 && e.tally.flock > 0) a.bell(ladder(14, ROOT), 0.045, 2.2, 0.6);
        break;
      case 'newRound':
        a.noiseBurst(0.8, { type: 'bandpass', freq: 400, sweepTo: 1200, q: 0.6, gain: 0.015 });
        break;
      case 'telegraph':
        if (e.next?.kind === 'watch') a.tone(98, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'call') a.tone(392, 0.5, { type: 'triangle', gain: 0.02, slideTo: 440 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'watch' ? NIGHT : DAY, 3);
        break;
      case 'star':
        a.bell(ladder(5 + e.n, ROOT), 0.03, 2);
        break;
      case 'morning':
        for (let i = 0; i < e.n; i++) this.baa(620 + i * 30, 0.025, 0.2 + i * 0.25);
        break;
      case 'flare':
        a.tone(196, 1.2, { type: 'sine', gain: 0.04, attack: 0.2, slideTo: 392 });
        if (e.share > 0.3) [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.4, 0.3 + i * 0.1));
        break;
      case 'unlock':
      case 'hundred':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.1));
        break;
      case 'finale':
        a.padChord([98, 146.83, 196, 293.66], 3);
        break;
      default:
        break;
    }
  }

  /** A sheep's "baa": three falling notes, a triangle with a little reed in it. */
  private baa(f: number, gain: number, at = 0): void {
    const a = this.a;
    [1, 0.96, 0.9].forEach((k, i) => {
      a.tone(f * k, i === 2 ? 0.26 : 0.1, { type: 'triangle', gain, at: at + i * 0.075, attack: 0.01 });
      a.tone(f * k * 2.01, i === 2 ? 0.22 : 0.08, { type: 'sawtooth', gain: gain * 0.18, at: at + i * 0.075, attack: 0.01 });
    });
  }

  /** Łatek's bark: two short barks, noise through a resonant band. */
  private bark(at: number): void {
    for (const k of [0, 0.16]) {
      this.a.noiseBurst(0.09, { type: 'bandpass', freq: 900, q: 3, gain: 0.05, at: at + k });
      this.a.tone(420, 0.08, { type: 'sawtooth', gain: 0.02, at: at + k, slideTo: 300 });
    }
  }

  private pluck(f: number, at: number, gain = 0.05): void {
    this.a.tone(f, 0.6, { type: 'triangle', gain, at, attack: 0.004 });
    this.a.tone(f * 2, 0.35, { type: 'sine', gain: gain * 0.25, at, attack: 0.004 });
  }
}
