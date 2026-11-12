/**
 * Ja jestem…'s sound, synthesised on the arcade audio (no files): a warm pad (the runner opens its filter
 * with the focus in a sighted push), a soft trickle while the colour flows (quicker with a wider stream),
 * a bell for every lit cell climbing a pentatonic ladder through a block, a chord for a whole fragment, an
 * arpeggio for the whole vision, a chime for a ray and a low bell for a ring, the night's hush and the
 * dawn's rising fifths, slow swells of breath in the rest (in 4, out 6), and the finale's chord.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { RULES } from './rules';
import type { JestemSim, SimEvent } from './sim';

const D3 = 146.83;
const ROOT = 587.33;   // D5: the bells' ladder

export class JestemSound {
  private streak = 0;
  private trickle = 0;
  private graceAt = 0;
  private breathPhase = -1;
  private now = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    // D major with an added ninth: open and warm
    this.a.pad({ notes: [D3, D3 * 1.5, D3 * 2, D3 * 2.5198, D3 * 3.3636], dark: 420, bright: 2600, gain: 0.06 });
  }

  on(e: SimEvent): void {
    const a = this.a;
    switch (e.type) {
      case 'blockStart':
        this.streak = 0;
        if (e.block.kind === 'rest') a.padChord([D3 * 0.8909, D3 * 1.3348, D3 * 1.7818, D3 * 2.2449, D3 * 2.6697], 3);
        else a.padChord([D3, D3 * 1.5, D3 * 2, D3 * 2.5198, D3 * 3.3636], 3);
        break;
      case 'target':
        if (e.by !== 'auto') a.tone(880, 0.12, { type: 'sine', gain: 0.035, slideTo: 990 });
        break;
      case 'splash':
        a.tone(ladder(3 + (this.streak % 5), ROOT), 0.18, { type: 'sine', gain: 0.03, slideTo: ladder(5 + (this.streak % 5), ROOT) });
        a.noiseBurst(0.12, { freq: 3800, q: 2, gain: 0.025, type: 'bandpass' });
        break;
      case 'lit':
        if (e.by === 'grace') {
          if (this.now - this.graceAt > 0.09) {
            this.graceAt = this.now;
            a.bell(ladder(10 - (Math.floor(this.now * 11) % 8), ROOT * 0.5), 0.035, 1.6);
          }
          break;
        }
        a.combo(this.streak++, ROOT, 0.07);
        a.bell(ladder(this.streak, ROOT) * 2, 0.02, 1.2, 0.06);
        break;
      case 'fragment':
        for (const [i, n] of [0, 2, 4, 7].entries()) a.bell(ladder(n, ROOT * 0.5), 0.06, 2.6, i * 0.09);
        a.noiseBurst(1.2, { freq: 5200, q: 0.7, gain: 0.03, type: 'highpass', sweepTo: 9000 });
        break;
      case 'complete':
        for (let i = 0; i < 7; i++) a.bell(ladder(i * 2, ROOT * 0.5), 0.07, 3, i * 0.12);
        break;
      case 'ray':
        a.noiseBurst(0.9, { freq: 6000, q: 0.8, gain: 0.035, type: 'highpass', sweepTo: 11000 });
        a.bell(ladder(9, ROOT), 0.05, 2.2, 0.05);
        break;
      case 'ring':
        a.bell(ladder(0, ROOT * 0.25), 0.07, 3.6);
        a.bell(ladder(4, ROOT * 0.25), 0.04, 3.2, 0.2);
        break;
      case 'night':
        a.noiseBurst(2.2, { freq: 900, q: 0.6, gain: 0.04, type: 'lowpass', sweepTo: 240 });
        break;
      case 'dawn':
        for (const [i, n] of [0, 4, 7, 9, 12].entries()) a.bell(ladder(n, ROOT * 0.5), 0.05, 2.4, 0.1 + i * 0.16);
        break;
      case 'touchLight':
        a.bell(ladder(7 + Math.floor(this.now * 3) % 4, ROOT), 0.035, 1.8);
        break;
      case 'mark':
        a.tone(740, 0.16, { type: 'triangle', gain: 0.03 });
        break;
      case 'path':
        a.tone(660, 0.1, { type: 'sine', gain: 0.03, slideTo: 880 });
        break;
      case 'finale':
        // a long chord, then the bells ring under the writing
        for (const [i, n] of [0, 4, 7, 11, 14].entries()) a.bell(ladder(n, ROOT * 0.25), 0.06, 5, i * 0.4);
        for (let i = 0; i < 6; i++) a.bell(ladder(5 + i * 2, ROOT * 0.5), 0.04, 3.2, 5 + i * 0.9);
        a.padChord([D3, D3 * 1.5, D3 * 2, D3 * 2.5198, D3 * 3], 6);
        break;
      case 'storyEnd':
        a.bell(ladder(4, ROOT), 0.04, 2);
        break;
      default:
        break;
    }
  }

  update(dt: number, sim: JestemSim): void {
    this.now += dt;
    // the colour's soft trickle, quicker with a wider stream (never in the night: it would tell the flow)
    if (sim.pouring && !sim.blind) {
      this.trickle -= dt;
      if (this.trickle <= 0) {
        this.trickle = 0.5 / (0.5 + sim.flow * 1.5) * (0.8 + Math.random() * 0.4);
        this.a.noiseBurst(0.08, { freq: 2600 + Math.random() * 2400, q: 3, gain: 0.012 + 0.01 * sim.flow, type: 'bandpass' });
      }
    }
    // the rest's breath: a swell in (4 s), a fall out (6 s)
    if (sim.restBlock) {
      const cyc = RULES.breathIn + RULES.breathOut;
      const x = ((sim.t % cyc) + cyc) % cyc;
      const phase = x < RULES.breathIn ? 0 : 1;
      if (phase !== this.breathPhase) {
        this.breathPhase = phase;
        if (phase === 0) this.a.noiseBurst(RULES.breathIn, { freq: 500, q: 0.5, gain: 0.025, type: 'lowpass', sweepTo: 1400 });
        else this.a.noiseBurst(RULES.breathOut, { freq: 1400, q: 0.5, gain: 0.02, type: 'lowpass', sweepTo: 300 });
      }
    } else this.breathPhase = -1;
  }
}
