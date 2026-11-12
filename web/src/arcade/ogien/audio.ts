/**
 * Ogień, ogień, ogień's sound, on the kit's synthesiser (kit/audio.ts): a pad of its own chord for every
 * fire (warm and low on the earth, airy among the stars, bright at Pentecost), whose filter follows the heat
 * in a sighted push (the runner drives it from OgienSim.padLevel) and holds still in rest and blind blocks;
 * the fire's crackle, faster and louder as the heat rises (the shown heat, so a blind block leaks nothing),
 * or a deep hum for a star; a soft bell for every tenth of the ring (the charge can be heard climbing); every
 * task its own small voice; the change's rising swell and the bells of the new fire; in rest a hum that
 * rises with the in-breath and falls with the out-breath.  Small sounds are throttled.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { RULES } from './rules';
import type { OgienSim, SimEvent } from './sim';

/** each fire's pad: four notes (Hz) */
const PADS: readonly (readonly number[])[] = [
  [146.83, 220, 293.66, 369.99],
  [98, 146.83, 246.94, 293.66],
  [130.81, 196, 329.63, 392],
  [110, 164.81, 277.18, 329.63],
  [164.81, 246.94, 415.3, 493.88],
  [146.83, 220, 369.99, 554.37],
  [174.61, 261.63, 440, 523.25],
];

export class OgienSound {
  private crackleT = 0;
  private humT = 0;
  private streak = 0;
  private quiet = 0;
  private lastIn: boolean | null = null;
  private rung = -1;

  constructor(private readonly a: ArcadeAudio) {}

  start(rung: number): void {
    this.rung = rung;
    this.a.pad({ notes: [...PADS[rung]], dark: 260, bright: 2400, gain: 0.045 });
  }

  /** A frame: the crackle or the star's hum, the breath's hum in rest. */
  update(dt: number, sim: OgienSim): void {
    const a = this.a;
    if (!a.on || !sim.started || sim.phase === 'done') return;
    this.quiet += dt;
    if (this.quiet > 2.5) this.streak = 0;
    const heat = sim.blind ? 0.5 : sim.heat;
    const earth = sim.rung <= 3;
    if (earth) {
      this.crackleT -= dt;
      if (this.crackleT <= 0) {
        const rate = sim.restBlock ? 1.2 : 1.5 + 9 * Math.max(0, heat - 0.35) + 3 * sim.ring;
        this.crackleT = (0.4 + Math.random() * 1.2) / rate;
        a.noiseBurst(0.02 + Math.random() * 0.04, { type: 'highpass', freq: 2200 + Math.random() * 2600, gain: 0.012 + 0.03 * heat * (sim.rung === 1 ? 0.4 : 1) });
      }
    } else {
      this.humT -= dt;
      if (this.humT <= 0) {
        this.humT = 1.8 + Math.random();
        a.noiseBurst(1.6, { type: 'lowpass', freq: 140 + 120 * heat, gain: 0.018 + 0.012 * heat });
      }
    }
    if (sim.restBlock) {
      const b = sim.breath;
      if (this.lastIn !== null && b.in !== this.lastIn) {
        if (b.in) a.tone(196, RULES.breathIn * 0.95, { attack: 1.6, gain: 0.016 });
        else a.tone(146.83, RULES.breathOut * 0.9, { attack: 0.6, gain: 0.012 });
      }
      this.lastIn = b.in;
    } else this.lastIn = null;
  }

  on(e: SimEvent, sim: OgienSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'puff':
        a.noiseBurst(0.32, { type: 'lowpass', freq: 900, sweepTo: 280, gain: 0.04 });
        break;
      case 'task': {
        this.quiet = 0;
        this.streak++;
        switch (e.kind) {
          case 'blow': a.bell(ladder(Math.min(this.streak, 10), 523.25), 0.018, 0.7); break;
          case 'trim': a.bell(1318.51, 0.025, 0.6); break;
          case 'poke':
            for (let i = 0; i < 3; i++) a.noiseBurst(0.03, { type: 'highpass', freq: 2600 + i * 600, gain: 0.03, at: i * 0.05 });
            break;
          case 'feed':
            a.tone(92, 0.3, { type: 'triangle', gain: 0.08, slideTo: 58 });
            a.noiseBurst(0.7, { type: 'highpass', freq: 3000, gain: 0.04, at: 0.05 });
            break;
          case 'shield':
            a.bell(659.25, 0.05, 1.2);
            a.bell(987.77, 0.03, 1, 0.08);
            break;
          case 'tents':
            a.noiseBurst(0.35, { type: 'lowpass', freq: 220, sweepTo: 900, gain: 0.04 });
            a.combo(this.streak, 392, 0.05);
            break;
          case 'fuse':
            a.bell(1567.98, 0.045, 0.9);
            a.tone(440, 0.22, { type: 'triangle', gain: 0.025, slideTo: 1760 });
            break;
          case 'gather': a.combo(this.streak, 523.25, 0.04); break;
          case 'pass':
            a.combo(this.streak, 587.33, 0.05);
            a.noiseBurst(0.4, { type: 'bandpass', freq: 900, sweepTo: 2400, gain: 0.025 });
            break;
          default: break;
        }
        break;
      }
      case 'gustTele':
        a.noiseBurst(1.6, { type: 'bandpass', freq: 480, sweepTo: 1400, q: 0.7, gain: 0.04 });
        break;
      case 'gust':
        if (!e.shielded) a.noiseBurst(0.5, { type: 'bandpass', freq: 1400, sweepTo: 600, gain: 0.05 });
        break;
      case 'tongue':
        a.bell(2093, 0.02, 1.6);
        break;
      case 'arrive':
        a.bell(1046.5, 0.025, 1.2);
        break;
      case 'tick':
        if (!sim.blind) a.bell(ladder(Math.round(e.pct / 10) + 2, 523.25), 0.02, 0.8);
        break;
      case 'near':
        a.bell(1318.51, 0.03, 1.4);
        a.bell(1760, 0.02, 1.4, 0.1);
        break;
      case 'change': {
        a.tone(110, 1.3, { type: 'triangle', gain: 0.05, slideTo: 880, attack: 0.6 });
        a.noiseBurst(1.4, { type: 'bandpass', freq: 300, sweepTo: 3200, gain: 0.055 });
        const at = RULES.changeSec * 0.62;
        for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) a.bell(f, 0.07 - i * 0.012, 2.6, at + i * 0.06);
        if (e.to !== this.rung) {
          this.rung = e.to;
          a.padChord([...PADS[e.to]], 2.5);
        }
        break;
      }
      case 'cycle':
        for (const [i, f] of [392, 493.88, 587.33, 783.99, 987.77].entries()) a.bell(f, 0.05, 2.8, RULES.changeSec * 0.62 + 0.3 + i * 0.09);
        break;
      case 'bonus':
        a.bell(783.99, 0.04, 1.2);
        a.bell(1174.66, 0.035, 1.2, 0.12);
        break;
      case 'ember':
        a.bell(392, 0.05, 1.8);
        break;
      case 'pour':
        a.tone(660, 1, { gain: 0.022, slideTo: 1320, attack: 0.3 });
        break;
      case 'reveal':
        a.noiseBurst(0.9, { type: 'lowpass', freq: 300, sweepTo: 2200, gain: 0.04 });
        a.bell(880, 0.03, 1.4, 0.3);
        break;
      case 'record':
        for (const [i, f] of [783.99, 987.77, 1174.66, 1567.98].entries()) a.bell(f, 0.04, 1.4, i * 0.1);
        break;
      case 'ripple':
        a.bell(783.99, 0.012, 0.8);
        break;
      default:
        break;
    }
  }
}
