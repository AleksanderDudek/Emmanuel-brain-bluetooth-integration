/**
 * Motylarnia's sound, through the kit's synthesiser: a soft garden pad (its filter follows padLevel(),
 * the focus in a sighted Apetyt block, still otherwise), a breeze and far bird chirps, and every bite
 * a crunch whose pitch climbs with the chain (Peggle's ladder): flowers ring their pigment's note,
 * dew drips, the rare flower opens a chord.  A stumble thuds, a rival curling boings down, a bird's
 * swoop whistles before the peck, a moult arpeggiates, the chrysalis is spun with a music-box run and
 * a butterfly hatches on bells.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { MothSim, SimEvent } from './sim';

const DAY_CHORD = [174.61, 261.63, 329.63, 392];
const SIESTA_CHORD = [146.83, 220, 293.66, 369.99];
const GOLD_CHORD = [130.81, 196, 261.63, 329.63];
const PIG_NOTE = [0, 2, 4, 1, 3];

export class MothSound {
  private breezeIn = 2;
  private birdIn = 4;
  private chord = DAY_CHORD;
  private sprintIn = 0;
  private rnd = 1;

  constructor(private readonly a: ArcadeAudio) {}

  private r(): number {
    this.rnd = (this.rnd * 16807) % 2147483647;
    return this.rnd / 2147483647;
  }

  start(): void {
    this.a.pad({ notes: DAY_CHORD, type: 'sine', dark: 420, bright: 2600, gain: 0.05 });
  }

  private setChord(notes: number[]): void {
    if (this.chord === notes) return;
    this.chord = notes;
    this.a.padChord(notes, 2.5);
  }

  update(dt: number, sim: MothSim): void {
    if (!this.a.on) return;
    this.setChord(sim.phase === 'finale' || sim.phase === 'done' ? GOLD_CHORD : sim.block.kind === 'rest' ? SIESTA_CHORD : DAY_CHORD);
    this.breezeIn -= dt;
    if (this.breezeIn <= 0) {
      this.a.noiseBurst(3.4, { type: 'lowpass', freq: 380, sweepTo: 900, q: 0.6, gain: 0.025 });
      this.breezeIn = 5 + 4 * this.r();
    }
    if (sim.block.kind !== 'rest') {
      this.birdIn -= dt;
      if (this.birdIn <= 0) {
        const n = 2 + Math.floor(this.r() * 3), f = 2400 + this.r() * 900;
        for (let k = 0; k < n; k++) this.a.tone(f * (1 + 0.05 * k), 0.07, { type: 'sine', gain: 0.016, slideTo: f * 1.3, at: k * 0.12 });
        this.birdIn = 6 + 6 * this.r();
      }
    }
    if (sim.sprinting) {
      this.sprintIn -= dt;
      if (this.sprintIn <= 0) {
        this.a.noiseBurst(0.3, { type: 'bandpass', freq: sim.freeSprint ? 1800 : 900, sweepTo: sim.freeSprint ? 2600 : 1300, q: 1.2, gain: 0.03 });
        this.sprintIn = 0.25;
      }
    } else this.sprintIn = 0;
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'eat': {
        const step = Math.min(14, e.chain - 1);
        if (e.kind === 'leaf' || e.kind === 'crumb') {
          a.noiseBurst(0.05, { type: 'bandpass', freq: 2100 * 2 ** (step / 24), q: 2.2, gain: 0.06 });
          a.tone(ladder(step, 392), 0.07, { type: 'triangle', gain: 0.035 });
        } else if (e.kind === 'flower') {
          a.bell(ladder(PIG_NOTE[Math.max(0, e.pig) % 5] + Math.floor(step / 3), 523.25), 0.08, 0.9);
        } else if (e.kind === 'dew') {
          a.tone(1200 + step * 40, 0.12, { type: 'sine', gain: 0.06, slideTo: 1900 + step * 40 });
        } else {
          [0, 4, 7, 12].forEach((s, i) => a.bell(523.25 * 2 ** (s / 12), 0.09, 1.6, i * 0.07));
        }
        break;
      }
      case 'moult': [0, 2, 4, 7].forEach((n, i) => a.tone(ladder(n + 5, 392), 0.16, { type: 'triangle', gain: 0.06, at: i * 0.06 })); break;
      case 'sprint': if (e.on) a.noiseBurst(0.35, { type: 'bandpass', freq: 700, sweepTo: 2200, q: 1, gain: 0.05 }); break;
      case 'stumble':
        a.tone(160, 0.25, { type: 'sine', gain: 0.14, slideTo: 70 });
        a.noiseBurst(0.22, { type: 'lowpass', freq: 600, gain: 0.08 });
        break;
      case 'curl':
        a.tone(620, 0.35, { type: 'triangle', gain: 0.09, slideTo: 180 });
        a.combo(6, 523.25, 0.07);
        break;
      case 'swoop': a.tone(2600, 0.9, { type: 'sine', gain: 0.03, slideTo: 900, attack: 0.3 }); break;
      case 'peck': a.noiseBurst(0.06, { type: 'highpass', freq: 2500, gain: e.hit ? 0.12 : 0.06 }); break;
      case 'near': a.tone(880, 0.12, { type: 'sine', gain: 0.05, slideTo: 1320 }); break;
      case 'side': [0, 4, 7, 12, 16].forEach((s, i) => a.bell(659.25 * 2 ** (s / 12), 0.07, 1.2, i * 0.08)); break;
      case 'goal': [0, 2, 4, 5, 7, 9, 11, 12].forEach((s, i) => a.tone(523.25 * 2 ** (s / 12), 0.2, { type: 'triangle', gain: 0.05, at: i * 0.07 })); break;
      case 'spun': a.bell(392, 0.1, 2); break;
      case 'garden': a.bell(523.25, 0.08, 1.4); a.bell(659.25, 0.06, 1.4, 0.12); break;
      case 'hatch': [0, 7, 12, 16, 19].forEach((s, i) => a.bell(392 * 2 ** (s / 12), e.b.radiant ? 0.1 : 0.07, 1.8, i * 0.11)); break;
      case 'feast': [0, 4, 7].forEach((s, i) => a.bell(587.33 * 2 ** (s / 12), 0.08, 1.2, i * 0.05)); break;
      case 'teach': a.tone(988, 0.1, { type: 'sine', gain: 0.03 }); break;
      case 'finale': GOLD_CHORD.forEach((f, i) => a.bell(f * 2, 0.06, 2.4, i * 0.15)); break;
      default: break;
    }
  }
}
