/**
 * Każda myśl's sounds, on the kit's synthesiser (kit/audio.ts), gentle and few: a warm low pad in D whose filter
 * follows the flame in a sighted push (the runner drives it through padLevel), a soft rustle of paper as a thought
 * drifts in or away, a quiet crackle while it burns (short filtered noise, low and throttled), a breath of air as it
 * turns to ash, a faint shimmer while its truth fills with light and a small bell as it joins the point — the bells
 * climb a pentatonic ladder as the golden lights gather — a stone's low thud as a stronghold's stone falls, a deep
 * chord as the stronghold falls, the breath's soft wind in rest, and the close's chord.  No drums, no chant; taps
 * never become noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { MysliSim, SimEvent } from './sim';

/** D with an added ninth, low: the pad. */
const PAD = [73.42, 110, 146.83, 164.81];
/** The bells' root: D5. */
const ROOT = 587.33;

export class MysliSound {
  private gap = 0;
  private crackle = 0;
  private shimmer = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 240, bright: 1400, gain: 0.05 });
  }

  update(dt: number, sim: MysliSim): void {
    this.gap = Math.max(0, this.gap - dt);
    if (!this.a.on) return;
    // the crackle of burning paper: only while the thought really burns, soft and uneven
    if (sim.goldOn && sim.ready) {
      this.crackle -= dt;
      if (this.crackle <= 0) {
        this.crackle = 0.09 + Math.random() * 0.22;
        this.a.noiseBurst(0.05 + Math.random() * 0.06, { type: 'bandpass', freq: 2200 + Math.random() * 2400, q: 0.9, gain: 0.006 + Math.random() * 0.006 });
      }
    } else this.crackle = 0.2;
    // a truth filling with light: now and then a faint high note
    if (sim.goldOn && sim.truthReady) {
      this.shimmer -= dt;
      if (this.shimmer <= 0) {
        this.shimmer = 0.55 + Math.random() * 0.5;
        this.a.tone(ladder(7 + Math.floor(Math.random() * 4), ROOT), 0.5, { type: 'sine', gain: 0.005 });
      }
    } else this.shimmer = 0.3;
  }

  on(e: SimEvent, sim: MysliSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'arrive':
        a.noiseBurst(0.5, { type: 'highpass', freq: 3200, sweepTo: 1800, gain: 0.006 });
        break;
      case 'leave':
        a.noiseBurst(0.6, { type: 'highpass', freq: 1800, sweepTo: 3600, gain: 0.006 });
        break;
      case 'burned':
        // the last flare; a set's stone gives way with a low, soft thud
        a.noiseBurst(0.9, { type: 'lowpass', freq: 500, sweepTo: 2600, gain: 0.016 });
        if (sim.set && e.thought.src !== 'lib') a.noiseBurst(0.7, { type: 'lowpass', freq: 220, sweepTo: 90, gain: 0.02 });
        break;
      case 'gilded':
        // a small bell as the truth's light joins the point (the ladder climbs with the lights)
        a.bell(ladder(4 + (e.n % 10), ROOT), 0.035, 2.2, 0.4);
        break;
      case 'fall':
        // the stronghold falls: a deep chord, the light breaking through
        a.noiseBurst(2.4, { type: 'lowpass', freq: 160, sweepTo: 900, gain: 0.02 });
        [0, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.03, 4, 0.2 + i * 0.4));
        break;
      case 'breathTurn':
        if (e.phase === 'in') a.noiseBurst(Math.max(1, e.len), { type: 'lowpass', freq: 280, sweepTo: 820, gain: 0.009 });
        else if (e.phase === 'out') a.noiseBurst(Math.max(1, e.len), { type: 'lowpass', freq: 820, sweepTo: 240, gain: 0.009 });
        break;
      case 'tap':
        if (this.gap > 0) break;
        this.gap = 0.3;
        a.tone(ladder(2, ROOT), 0.12, { type: 'sine', gain: 0.012 });
        break;
      case 'blindEnd':
        if (e.gained > 0) a.noiseBurst(1.2, { type: 'bandpass', freq: 1200, sweepTo: 2400, q: 1, gain: 0.012 });
        break;
      case 'rated':
        a.bell(ladder(2, ROOT), 0.03, 1.6);
        break;
      case 'finale':
        [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.024, 3, i * 0.35));
        break;
      default: break;
    }
    void sim;
  }
}
