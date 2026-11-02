/**
 * Zastępy's sound, on the kit's synthesiser (kit/audio.ts): a bright pad in D whose filter follows
 * the flow in a sighted Natarcie (the runner drives it from ZastepySim.padLevel) and holds still
 * elsewhere, turning to a hushed B minor in the Cisza; a chime as a unit steps out of the gate (its
 * note by the card); bright tinks of blades of light, the whisper of arrows, the whoosh of the
 * seraph's fire; dull thuds of shadows; a soft puff and a climbing bell as demons come apart; the
 * gate's beam; the trumpet's brass and its wave; a fanfare of bells when the gate of ash falls; a low
 * rumble for the Smok.  A withdrawal is a gentle falling line, never a buzzer; a missed verdict makes
 * no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { HOST_IDS } from './rules';
import type { SimEvent } from './sim';

const DAY = [146.83, 220, 293.66, 369.99];
const STILL = [123.47, 185, 246.94, 293.66];
const ROOT = 587.33;

export class ZastepySound {
  private clock = 0;
  private last = new Map<string, number>();
  private chain = 0;
  private chainT = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY, dark: 300, bright: 2000, gain: 0.05 });
  }

  update(dt: number): void {
    this.clock += dt;
    this.chainT = Math.max(0, this.chainT - dt);
    if (this.chainT <= 0) this.chain = 0;
  }

  /** At most one of a kind every `gap` seconds (busy battles stay listenable). */
  private ok(kind: string, gap: number): boolean {
    const t = this.last.get(kind) ?? -9;
    if (this.clock - t < gap) return false;
    this.last.set(kind, this.clock);
    return true;
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'sent': {
        const i = HOST_IDS.indexOf(e.kind);
        a.bell(ladder(4 + i * 2, ROOT / 2), 0.045, 1.2);
        a.tone(ladder(4 + i * 2, ROOT / 2) * 2, 0.25, { type: 'sine', gain: 0.02, at: 0.05 });
        break;
      }
      case 'spawn':
        if (this.ok('spawn', 0.4)) a.noiseBurst(0.35, { type: 'lowpass', freq: 500, sweepTo: 200, gain: 0.025 });
        break;
      case 'strike':
        if (e.side === 1) {
          if (e.kind === 'lucznik') { if (this.ok('arrow', 0.08)) a.noiseBurst(0.12, { type: 'bandpass', freq: 3200, sweepTo: 1800, q: 1.2, gain: 0.02 }); }
          else if (e.kind === 'serafin') { if (this.ok('fire', 0.15)) a.noiseBurst(0.35, { type: 'bandpass', freq: 900, sweepTo: 2400, q: 0.7, gain: 0.035 }); }
          else if (this.ok('blade', 0.07)) {
            a.tone(1760 + Math.random() * 300, 0.09, { type: 'triangle', gain: 0.018 });
            a.noiseBurst(0.06, { type: 'highpass', freq: 4000, gain: 0.015 });
          }
        } else if (e.kind === 'smok') {
          a.noiseBurst(0.6, { type: 'lowpass', freq: 900, sweepTo: 300, gain: 0.06 });
          a.tone(70, 0.6, { type: 'sawtooth', gain: 0.02, slideTo: 50 });
        } else if (this.ok('thud', 0.1)) a.tone(110 + Math.random() * 30, 0.14, { type: 'sine', gain: 0.03, slideTo: 70 });
        break;
      case 'beaten':
        this.chain = Math.min(16, this.chain + 1);
        this.chainT = 1.6;
        if (this.ok('beaten', 0.06)) {
          a.noiseBurst(0.25, { type: 'lowpass', freq: 1200, sweepTo: 300, gain: 0.03 });
          a.bell(ladder(this.chain, ROOT), 0.03, 0.9, 0.04);
        }
        if (e.kind === 'smok') [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.06, 2.4, i * 0.12));
        break;
      case 'fallen':
        if (this.ok('fallen', 0.2)) a.tone(880, 0.6, { type: 'sine', gain: 0.02, slideTo: 1320, attack: 0.05 });
        break;
      case 'beam':
        if (this.ok('beam', 0.1)) {
          a.tone(2349, 0.16, { type: 'sine', gain: 0.025, slideTo: 1760 });
          a.noiseBurst(0.08, { type: 'highpass', freq: 5000, gain: 0.012 });
        }
        break;
      case 'ember':
        if (this.ok('ember', 0.2)) a.noiseBurst(0.18, { type: 'bandpass', freq: 600, q: 1.5, gain: 0.02 });
        break;
      case 'gateHit':
        if (e.side === 1 && this.ok('wall', 0.25)) a.tone(80, 0.2, { type: 'sine', gain: 0.04, slideTo: 55 });
        break;
      case 'surge':
        a.noiseBurst(1.2, { type: 'lowpass', freq: 300, sweepTo: 120, gain: 0.05 });
        break;
      case 'smok':
        a.noiseBurst(2.4, { type: 'lowpass', freq: 400, sweepTo: 90, gain: 0.08 });
        a.tone(55, 2.4, { type: 'sawtooth', gain: 0.03, attack: 0.4, slideTo: 41 });
        break;
      case 'trumpet':
        // the trumpet's brass: three voices rising into a fifth, then the wave
        [[293.66, 0], [440, 0.05], [587.33, 0.1]].forEach(([f, at]) => {
          a.tone(f, 1.1, { type: 'sawtooth', gain: 0.022, attack: 0.06, at });
          a.tone(f * 1.003, 1.1, { type: 'square', gain: 0.008, attack: 0.06, at });
        });
        a.noiseBurst(1.2, { type: 'bandpass', freq: 400, sweepTo: 2600, q: 0.6, gain: 0.05, at: 0.15 });
        break;
      case 'trumpetReady':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT / 2), 0.04, 1.4, i * 0.08));
        break;
      case 'won':
        [0, 2, 4, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.055, 2, i * 0.1));
        a.tone(293.66, 1.6, { type: 'triangle', gain: 0.04, attack: 0.1, at: 0.3 });
        break;
      case 'lost':
        [7, 4, 2, 0].forEach((n, i) => a.tone(ladder(n, ROOT / 2), 0.5, { type: 'triangle', gain: 0.03, at: i * 0.18 }));
        break;
      case 'battleStart':
        a.tone(293.66, 0.4, { type: 'triangle', gain: 0.04, attack: 0.04 });
        a.tone(440, 0.7, { type: 'triangle', gain: 0.04, attack: 0.04, at: 0.25 });
        break;
      case 'nope':
        a.tone(196, 0.08, { type: 'square', gain: 0.012 });
        break;
      case 'buy':
        a.bell(1567.98, 0.05, 1.2);
        a.bell(2093, 0.04, 1.4, 0.08);
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(146.83, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(440, 0.5, { type: 'triangle', gain: 0.02, slideTo: 587.33 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? STILL : DAY, 3);
        break;
      case 'restPass':
      case 'gift':
      case 'winGold':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.4, i * 0.1));
        break;
      case 'blindPay':
        if (e.light > 0) [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.4, 0.2 + i * 0.08));
        break;
      case 'finale':
        a.padChord([146.83, 220, 293.66, 440], 3);
        a.tone(146.83, 4.5, { type: 'sine', gain: 0.035, attack: 1 });
        break;
      default:
        break;
    }
  }
}
