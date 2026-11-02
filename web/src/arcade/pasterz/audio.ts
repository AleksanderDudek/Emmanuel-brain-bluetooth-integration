/**
 * Pasterz's sound, on the kit's synthesiser (kit/audio.ts): an open pastoral pad in G whose filter
 * follows the ring in a sighted Wołanie (the runner drives it from PasterzSim.padLevel) and holds
 * still elsewhere, turning to a quiet E minor at night; soft steps in the grass; a sheep's "baa"
 * (three falling triangle-and-reed notes, higher for a lamb) when one joins, with a pluck that
 * climbs as the joins come close together; the shepherd's two-note call on Space; the voice's
 * horn and bells; the count's rising plucks and a chord for every tenth sheep; the fanfare of a
 * full fold; a bell for each star; the fire's crackle at night.  A missed verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { RULES, type PasterzSim, type SimEvent } from './sim';

const DAY = [98, 146.83, 196, 246.94];
const NIGHT = [82.41, 123.47, 164.81, 196];
const ROOT = 392;

export class PasterzSound {
  private lastStep = 0;
  private lastBaa = -1;
  private chain = 0;
  private chainT = 0;
  private crackle = 0;
  private clock = 0;

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
    // steps in the grass (a splash in the stream)
    const sh = sim.shepherd;
    if (sh.stepT - this.lastStep >= RULES.stride * 1.2) {
      this.lastStep = sh.stepT;
      if (sh.wading) a.noiseBurst(0.14, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.02 });
      else a.noiseBurst(0.07, { type: 'highpass', freq: 2400, gain: 0.008 });
    }
    if (sh.stepT < this.lastStep) this.lastStep = sh.stepT;
    // the fire's crackle at night
    if (sim.fire && sim.night > 0.4) {
      this.crackle -= dt;
      if (this.crackle <= 0) {
        this.crackle = 0.12 + Math.random() * 0.5;
        a.noiseBurst(0.04, { type: 'highpass', freq: 3000 + Math.random() * 2000, gain: 0.012 * sim.night });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'join':
        this.chain = Math.min(14, this.chain + 1);
        this.chainT = 1.2;
        this.pluck(ladder(this.chain, ROOT), 0, 0.035);
        if (this.clock - this.lastBaa > 0.16) {
          this.lastBaa = this.clock;
          this.baa(e.via === 'morning' ? 640 : 380 + Math.random() * 90, 0.03);
        }
        break;
      case 'call':
        a.tone(330, 0.22, { type: 'sine', gain: 0.05, slideTo: 440 });
        a.tone(392, 0.45, { type: 'sine', gain: 0.045, at: 0.2, slideTo: 370 });
        break;
      case 'voice':
        a.tone(196, 1.4, { type: 'triangle', gain: 0.05, attack: 0.15 });
        a.tone(293.66, 1.3, { type: 'triangle', gain: 0.04, attack: 0.2, at: 0.1 });
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.6, 0.25 + i * 0.09));
        a.noiseBurst(1.2, { type: 'bandpass', freq: 500, sweepTo: 1500, q: 0.7, gain: 0.02 });
        // the lost lamb answers from far away
        if (e.lamb) this.baa(720, 0.014, 1.1);
        break;
      case 'snag':
        this.baa(560, 0.035);
        a.noiseBurst(0.12, { type: 'highpass', freq: 3500, gain: 0.02 });
        break;
      case 'free':
        this.pluck(ladder(5, ROOT), 0, 0.04);
        this.pluck(ladder(7, ROOT), 0.08, 0.04);
        break;
      case 'lambFound':
        this.baa(680, 0.04);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.8, 0.2 + i * 0.1));
        break;
      case 'pastureEnd':
        a.bell(ladder(4, ROOT / 2), 0.045, 1.6);
        a.bell(ladder(7, ROOT / 2), 0.04, 1.8, 0.15);
        break;
      case 'folded':
        this.pluck(ladder(Math.min(19, (e.n - 1) % 20), ROOT), 0, 0.03);
        break;
      case 'step':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT / 2), 0.04, 1.3, i * 0.05));
        break;
      case 'lambNamed':
        a.bell(1318.5, 0.04, 2.2);
        a.bell(1318.5, 0.03, 2, 0.35);
        a.bell(1567.98, 0.03, 2.2, 0.7);
        break;
      case 'pastureDone':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.05, 1.8, i * 0.09));
        if (e.all) a.bell(ladder(14, ROOT), 0.045, 2.2, 0.6);
        break;
      case 'newPasture':
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
        for (let i = 0; i < e.n; i++) this.baa(620 + i * 30, 0.03, 0.2 + i * 0.25);
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.6, i * 0.1));
        break;
      case 'flare':
        a.tone(196, 1.2, { type: 'sine', gain: 0.04, attack: 0.2, slideTo: 392 });
        if (e.share > 0.3) [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.4, 0.3 + i * 0.1));
        break;
      case 'mission':
      case 'gift':
      case 'hundred':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.1));
        break;
      case 'finale':
        a.padChord([98, 146.83, 196, 293.66], 3);
        a.tone(98, 4.5, { type: 'sine', gain: 0.04, attack: 1 });
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

  /** A plucked string: a quick triangle with a quiet octave. */
  private pluck(f: number, at: number, gain = 0.05): void {
    this.a.tone(f, 0.7, { type: 'triangle', gain, at, attack: 0.004 });
    this.a.tone(f * 2, 0.4, { type: 'sine', gain: gain * 0.25, at, attack: 0.004 });
  }
}
