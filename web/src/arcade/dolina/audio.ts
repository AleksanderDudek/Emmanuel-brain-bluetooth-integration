/**
 * Dolina's sound, on the kit's synthesiser (kit/audio.ts): a low pad in D minor whose filter follows
 * the lamp in a sighted push (the runner drives it from DolinaSim.padLevel) and holds still
 * elsewhere, turning to a major chord in the meadow and at the dawn; footsteps that follow the run;
 * the jump — a soft rising tone — and the double jump — Ćma's flutter, a quick airy whirr with a
 * bright chirp on top; the sword's strike on stone, a block's crumble with a bell that climbs the
 * streak's ladder, the stones clattering into the pack, a stair's steps clicking into place one
 * pitch higher each; the gate's chord, a lamb's little bleat (a bell pair), a stomp; a thud for a hit
 * taken, the tide's low swell; the Świt; the guardian's drone, its tells and its fall; the brook's
 * pebbles.  A missed verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { DolinaSim, SimEvent } from './sim';

const DARK = [73.42, 110, 146.83, 174.61];
const MEADOW = [73.42, 110, 146.83, 185];
const ROOT = 587.33;

export class DolinaSound {
  private step = 0;
  private drone = 0;
  private side = 0;
  private tideT = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DARK, dark: 200, bright: 1700, gain: 0.05 });
  }

  update(dt: number, sim: DolinaSim): void {
    const a = this.a;
    if (!a.on) return;
    // footsteps that follow the run (soft, alternating)
    if (sim.state === 'run' && sim.grounded && sim.speed > 0.5) {
      this.step -= dt * sim.speed * 0.42;
      if (this.step <= 0) {
        this.step = 1;
        this.side ^= 1;
        a.noiseBurst(0.05, { type: 'lowpass', freq: sim.restBlock ? 900 : 420 + this.side * 60, gain: sim.restBlock ? 0.02 : 0.03 });
      }
    }
    // a guardian's low drone while it stands in its arena
    const g = sim.guard;
    if (g && g.state === 'fight') {
      this.drone -= dt;
      if (this.drone <= 0) {
        this.drone = 2.4;
        a.tone(g.angry ? 61.74 : 55, 2.6, { type: 'sine', gain: 0.035, attack: 0.6 });
      }
    }
    // the tide's breath when it is close
    if (sim.tideOn && Number.isFinite(sim.tideX) && sim.px - sim.tideX < 5) {
      this.tideT -= dt;
      if (this.tideT <= 0) {
        this.tideT = 1.2;
        a.noiseBurst(0.9, { type: 'lowpass', freq: 220, sweepTo: 140, gain: 0.035 });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'jump':
        if (e.air) {
          // Ćma's flutter and a chirp
          a.noiseBurst(0.22, { type: 'bandpass', freq: 2400, sweepTo: 4200, q: 2.5, gain: 0.04 });
          a.tone(1318.5, 0.1, { type: 'triangle', gain: 0.03, slideTo: 1760 });
          a.tone(880, 0.16, { type: 'sine', gain: 0.025, slideTo: 1318.5, at: 0.04 });
        } else a.tone(392, 0.12, { type: 'triangle', gain: 0.028, slideTo: 587 });
        break;
      case 'land':
        a.noiseBurst(0.06, { type: 'lowpass', freq: 380, gain: e.v > 10 ? 0.05 : 0.03 });
        break;
      case 'stomp':
        a.tone(196, 0.12, { type: 'square', gain: 0.03, slideTo: 98 });
        a.noiseBurst(0.12, { type: 'lowpass', freq: 600, gain: 0.05 });
        a.bell(ladder(9, ROOT), 0.035, 0.5);
        break;
      case 'strike':
        if (e.what === 'stone') {
          a.tone(1567.98, 0.05, { type: 'triangle', gain: 0.025 });
          a.noiseBurst(0.06, { type: 'bandpass', freq: 2600, q: 3, gain: 0.04 });
        } else {
          a.noiseBurst(0.1, { type: 'bandpass', freq: 1200, sweepTo: 4200, q: 0.9, gain: 0.045 });
          if (e.what === 'guard') a.tone(110, 0.16, { type: 'sine', gain: 0.1, slideTo: 55 });
        }
        break;
      case 'break':
        if (e.pen) {
          a.noiseBurst(0.25, { type: 'highpass', freq: 1500, gain: 0.04 });
        } else {
          a.noiseBurst(0.28, { type: 'lowpass', freq: e.tall ? 700 : 1000, gain: 0.07 });
          a.tone(98, 0.14, { type: 'sine', gain: 0.08, slideTo: 60 });
          // the stones clattering into the pack
          for (let i = 0; i < Math.min(4, e.stones); i++) a.tone(1200 + i * 180, 0.04, { type: 'triangle', gain: 0.018, at: 0.08 + i * 0.05 });
        }
        a.bell(ladder(Math.min(19, e.combo % 20), ROOT), 0.04, 0.7);
        break;
      case 'kill':
        if (e.via === 'fade') break;
        a.tone(98, 0.14, { type: 'sine', gain: 0.08, slideTo: 55 });
        a.noiseBurst(0.3, { type: 'highpass', freq: 3000, sweepTo: 8000, gain: 0.022 });
        a.bell(ladder(Math.min(19, e.combo % 20), ROOT), 0.04, 0.8);
        break;
      case 'step':
        a.tone(ladder(e.i % 15, ROOT / 2), 0.07, { type: 'triangle', gain: 0.03 });
        break;
      case 'stairs':
        if (e.answer === 'climb') a.tone(220, 0.4, { type: 'sine', gain: 0.03, slideTo: 196 });
        break;
      case 'climb':
        a.noiseBurst(0.4, { type: 'bandpass', freq: 500, sweepTo: 900, gain: 0.025 });
        break;
      case 'gate':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + (e.high ? 5 : 0), ROOT), 0.045, 1.2, i * 0.05));
        a.noiseBurst(0.6, { type: 'bandpass', freq: 600, sweepTo: 3600, gain: 0.03 });
        break;
      case 'lamb':
        a.tone(659.25, 0.18, { type: 'triangle', gain: 0.035, slideTo: 622.25 });
        a.tone(659.25, 0.22, { type: 'triangle', gain: 0.03, slideTo: 587.33, at: 0.2 });
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 7, ROOT), 0.035, 1.2, 0.3 + i * 0.08));
        break;
      case 'pit':
        a.tone(220, 0.5, { type: 'sine', gain: 0.05, slideTo: 110 });
        break;
      case 'lift':
        a.noiseBurst(0.3, { type: 'bandpass', freq: 2400, sweepTo: 3800, q: 2.5, gain: 0.035 });
        break;
      case 'harm':
        a.tone(160, 0.25, { type: 'triangle', gain: 0.06, slideTo: 90 });
        a.noiseBurst(0.12, { type: 'lowpass', freq: 600, gain: 0.05 });
        break;
      case 'caught':
        a.noiseBurst(0.8, { type: 'lowpass', freq: 300, sweepTo: 2000, gain: 0.06 });
        a.bell(ladder(4, ROOT / 2), 0.04, 1);
        break;
      case 'pull':
        a.tone(880, 0.3, { type: 'sine', gain: 0.03, slideTo: 440 });
        break;
      case 'dodge':
        if (e.near) a.bell(ladder(12, ROOT), 0.035, 0.6);
        break;
      case 'throw':
        a.noiseBurst(0.2, { type: 'bandpass', freq: 600, sweepTo: 1400, gain: 0.025 });
        break;
      case 'shotBreak':
        if (e.via !== 'past') a.noiseBurst(0.18, { type: 'lowpass', freq: 800, gain: 0.04 });
        break;
      case 'combo':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + (e.mult - 2) * 5, ROOT), 0.05, 1.2, i * 0.06));
        break;
      case 'dawn':
      case 'flash':
        a.tone(146.83, 1.8, { type: 'sawtooth', gain: 0.022, attack: 0.05, slideTo: 293.66 });
        [0, 2, 4, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.8, i * 0.05));
        a.noiseBurst(1.2, { type: 'bandpass', freq: 400, sweepTo: 5000, q: 0.6, gain: 0.045 });
        break;
      case 'fall':
        a.tone(196, 0.9, { type: 'sine', gain: 0.05, slideTo: 98, attack: 0.02 });
        break;
      case 'rise':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.4, i * 0.12));
        break;
      case 'brook':
        a.bell(ladder(4 + (e.n % 6), ROOT), 0.03, 1.6);
        a.tone(ladder(e.n % 5, ROOT * 2), 0.05, { type: 'sine', gain: 0.015 });
        break;
      case 'restPass':
      case 'pushPass':
      case 'dayGift':
      case 'look':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.1));
        break;
      case 'level':
        [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 1.8, i * 0.09));
        for (let i = 0; i < e.stars; i++) a.bell(ladder(12 + i * 2, ROOT), 0.05, 1.2, 0.5 + i * 0.22);
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(73.42, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(293.66, 0.5, { type: 'triangle', gain: 0.02, slideTo: 329.63 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? MEADOW : DARK, 3);
        break;
      case 'guard':
        if (e.what === 'come') a.tone(55, 1.6, { type: 'triangle', gain: 0.05, attack: 0.3, slideTo: 41.2 });
        else if (e.what === 'angry') a.tone(82.41, 0.8, { type: 'sawtooth', gain: 0.025, slideTo: 61.74 });
        else if (e.what === 'open') a.bell(ladder(9, ROOT), 0.05, 0.8);
        else if (e.what === 'beaten') {
          [0, 4, 7, 9, 12, 14, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.06, 2.4, i * 0.08));
          a.noiseBurst(1.4, { type: 'bandpass', freq: 600, sweepTo: 4000, gain: 0.04 });
        }
        break;
      case 'guardHit':
        if (e.via === 'stomp') a.bell(ladder(14, ROOT), 0.05, 0.9);
        break;
      case 'move':
        if (!e.act) {
          if (e.kind === 'high') a.tone(880, 0.3, { type: 'sine', gain: 0.02, slideTo: 1320 });
          else if (e.kind === 'wall' || e.kind === 'pair') a.tone(130.81, 0.5, { type: 'triangle', gain: 0.03, slideTo: 196 });
          else if (e.kind === 'roll') a.noiseBurst(0.25, { type: 'lowpass', freq: 300, gain: 0.03 });
          else if (e.kind === 'open') a.bell(ladder(9, ROOT), 0.04, 0.8);
        } else a.noiseBurst(0.35, { type: 'bandpass', freq: 900, sweepTo: 200, gain: 0.045 });
        break;
      case 'era':
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.045, 1.8, i * 0.1));
        break;
      case 'finale':
      case 'done':
        a.padChord([73.42, 110, 146.83, 220], 3);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, 0.4 + i * 0.25));
        break;
      default:
        break;
    }
  }
}
