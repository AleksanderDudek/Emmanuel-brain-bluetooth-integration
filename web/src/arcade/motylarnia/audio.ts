/**
 * Motylarnia's sound, through the kit's synthesiser: a soft pad (its filter opens with what the game's
 * padLevel() reports: the appetite while it eats, the clearing shell in a seen chrysalis, held still in
 * a blind cocoon), a meadow breeze and bird chirps, and the caterpillar's munch — tiny noise crunches
 * whose rate IS the appetite, rising a semitone for every 5 s held in the zone.  Each pigment is a
 * note on the pentatonic ladder, so eating dots plays a melody; the chrysalis gets a music-box chord
 * and wind chimes, the emergence a rising arpeggio and a paper rustle.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { PIGMENTS } from './content';
import type { MothSim, SimEvent } from './sim';

const LEAF_CHORD = [174.61, 261.63, 329.63, 392];
const CHRYSALIS_CHORD = [146.83, 220, 293.66, 369.99];
const GOLD_CHORD = [130.81, 196, 261.63, 329.63];

export class MothSound {
  private munchIn = 0;
  private breezeIn = 1.5;
  private birdIn = 3;
  private chimeIn = 2;
  private chord = LEAF_CHORD;

  constructor(private readonly a: ArcadeAudio, private readonly rng: () => number) {}

  start(): void {
    // the low-pass at a level of 0 and of 1
    this.a.pad({ notes: LEAF_CHORD, type: 'sine', dark: 420, bright: 2400, gain: 0.05 });
  }

  private setChord(notes: number[]): void {
    if (this.chord === notes) return;
    this.chord = notes;
    this.a.padChord(notes, 2.5);
  }

  /** Ambience and the munch, every frame of play. */
  tick(dt: number, sim: MothSim): void {
    if (!this.a.on) return;
    const r = sim.round, phase = sim.phase;
    if (phase === 'feed' && r) {
      const c = r.cat;
      this.munchIn -= dt;
      if (c.fresh < 0.25 && this.munchIn <= 0) {
        const rate = 2 + 6 * c.a, semis = Math.floor((r.leafBlock?.zone ?? 0) / 5);
        this.a.noiseBurst(0.045, { type: 'bandpass', freq: 2300 * 2 ** (semis / 12) * (0.92 + 0.16 * this.rng()), q: 2.4, gain: 0.07 });
        this.a.tone(180 + 60 * this.rng(), 0.04, { type: 'triangle', gain: 0.025 });
        this.munchIn = (1 / rate) * (0.85 + 0.3 * this.rng());
      }
    }
    this.breezeIn -= dt;
    if (this.breezeIn <= 0) {
      this.a.noiseBurst(3.6, { type: 'lowpass', freq: 420, sweepTo: 950, q: 0.6, gain: 0.03 });
      this.breezeIn = 5 + 4 * this.rng();
    }
    if (phase !== 'chrysalis' && phase !== 'spin') {
      this.birdIn -= dt;
      if (this.birdIn <= 0) {
        const n = 2 + Math.floor(this.rng() * 3), f = 2500 + this.rng() * 900;
        for (let k = 0; k < n; k++) this.a.tone(f * (1 + 0.05 * k), 0.07, { type: 'sine', gain: 0.02, slideTo: f * 1.35, at: k * 0.12 });
        this.birdIn = 7 + 8 * this.rng();
      }
    } else {
      this.chimeIn -= dt;
      if (this.chimeIn <= 0) {
        this.a.bell(ladder(5 + Math.floor(this.rng() * 6), 523.25), 0.022, 2.6);
        this.chimeIn = 2.4 + 2.8 * this.rng();
      }
    }
  }

  event(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'round':
        this.setChord(e.last ? GOLD_CHORD : LEAF_CHORD);
        break;
      case 'pick':
        a.tone(660, 0.12, { type: 'triangle', gain: 0.06 });
        break;
      case 'hatch':
        a.noiseBurst(0.18, { type: 'highpass', freq: 3000, gain: 0.04 });
        a.bell(ladder(2), 0.05, 1);
        break;
      case 'dot':
        a.bell(ladder(PIGMENTS[e.pigment].note + 5 * Math.min(2, Math.floor((e.n - 1) / 5))), 0.09, 1.3);
        break;
      case 'treat':
        if (e.kind === 'malina') {
          a.tone(520, 0.16, { type: 'triangle', slideTo: 880, gain: 0.07 });
          a.bell(1318.5, 0.04, 0.8, 0.08);
        } else {
          a.noiseBurst(0.9, { type: 'highpass', freq: 3200, sweepTo: 5200, gain: 0.035 });
          a.bell(1567.98, 0.045, 1.2);
        }
        break;
      case 'class':
        a.combo(e.cls + 5, 523.25, 0.07);
        break;
      case 'bold':
        a.bell(ladder(7), 0.08, 1.4);
        a.bell(ladder(9), 0.06, 1.6, 0.12);
        break;
      case 'silk':
        for (let k = 0; k < 5; k++) a.bell(ladder(9 + k), 0.04, 1.2, k * 0.06);
        break;
      case 'full':
        a.tone(392, 0.3, { type: 'triangle', gain: 0.07 });
        a.tone(523.25, 0.45, { type: 'triangle', gain: 0.06, at: 0.14 });
        break;
      case 'spin':
        this.setChord(CHRYSALIS_CHORD);
        a.noiseBurst(1.1, { type: 'bandpass', freq: 900, sweepTo: 380, gain: 0.03 });
        break;
      case 'deep':
        a.bell(ladder(4, 261.63), 0.06, 2.2);
        break;
      case 'emerge':
        for (let k = 0; k < 8; k++) a.bell(ladder(k + 2), 0.065, 1.6, 0.5 + k * 0.09);
        a.noiseBurst(1.3, { type: 'highpass', freq: 2400, sweepTo: 6400, gain: 0.04, at: 0.7 });
        // a blind cocoon's deep colours: their bell, now that it has opened
        if (e.outcome.blind && e.outcome.deep) a.bell(ladder(4, 261.63), 0.06, 2.2, 1.4);
        if (e.outcome.radiant || e.outcome.aberration) for (let k = 0; k < 4; k++) a.bell(ladder(12 + k), 0.04, 1.4, 1.5 + k * 0.08);
        break;
      case 'finale':
        this.setChord(GOLD_CHORD);
        break;
    }
  }
}
