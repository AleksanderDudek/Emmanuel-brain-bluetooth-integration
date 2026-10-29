/**
 * Źródła's sound, on the kit's synthesiser (kit/audio.ts): no files, no nodes of its own.  The pad
 * is open fifths on D for a Nurt, moving to G for a Sela; the runner drives its brightness from
 * ZrodlaSim.padLevel (how much water runs; still in a Sela, a blind Nurt and while the signal is out).
 * Over it a water bed of soft low-passed noise in a sighted Nurt, a stone's clunk for every turn,
 * droplets stepping up D Dorian as the front runs, psaltery plucks for a field joining, springs
 * meeting and a valley closing (a running arpeggio), bells for depths, the curb stone, the album and
 * the stage, chirps for a nest, and in the Sela a generative lyre in D Dorian with drips and
 * birdsong that follows how green the valley is — never the signal, and no named hymn tune.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { isPush, type SimEvent, type ZrodlaSim } from './sim';

/** D Dorian from D4 up an octave and a step. */
const MODE = [293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33, 659.25];
const STREAM = [73.42, 110, 146.83, 220];
const SELAH = [98, 146.83, 196, 246.94];

export class ZrodlaSound {
  private bed = 1;
  private lyre = 1.5;
  private walk = 4;
  private drip = 0;
  private bird = 3;
  private rain = 0;
  private rainT = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: STREAM, dark: 220, bright: 1600, gain: 0.06 });
  }

  /** The psaltery: a plucked triangle with a soft octave and a bell's shimmer. */
  private pluck(f: number, at = 0, gain = 0.06): void {
    this.a.tone(f, 1.8, { type: 'triangle', attack: 0.004, gain, at });
    this.a.tone(f * 2, 0.9, { type: 'sine', gain: gain * 0.25, at });
    this.a.bell(f, 0.01, 1.2, at);
  }

  update(dt: number, sim: ZrodlaSim): void {
    const a = this.a;
    if (!a.on || !sim.started) return;
    const b = sim.phase === 'play' ? sim.block : null;
    this.drip = Math.max(0, this.drip - dt);
    // the water bed in a sighted Nurt (steady in the warm-up), silent underground and in a Sela
    if (b && (b.kind === 'warmup' || (isPush(b.kind) && !b.blind)) && sim.flowing) {
      this.bed -= dt;
      if (this.bed <= 0) {
        const phi = b.kind === 'warmup' ? 0.2 : sim.phi;
        a.noiseBurst(2.5 + Math.random(), { type: 'lowpass', freq: 300, sweepTo: 700, gain: 0.02 + 0.03 * phi });
        this.bed = 2 + Math.random();
      }
    }
    // the Sela's lyre: a slow random walk over D Dorian, a dyad now and then; it fades over the telegraph
    if (b?.kind === 'sela') {
      const left = b.dur - sim.blockT;
      const fade = Math.max(0, Math.min(1, (left - 0.5) / 3.5));
      this.lyre -= dt;
      if (this.lyre <= 0 && fade > 0.05) {
        this.walk = Math.max(0, Math.min(MODE.length - 1, this.walk + Math.round((Math.random() - 0.5) * 3)));
        this.pluck(MODE[this.walk] / 2, 0, 0.045 * fade);
        if (Math.random() < 0.25) this.pluck(MODE[Math.min(MODE.length - 1, this.walk + 2)] / 2, 0.08, 0.03 * fade);
        this.lyre = 0.7 + Math.random() * 0.8;
      }
      // drips and birdsong, the birds more often as the valley greens
      this.bird -= dt * (0.25 + 1.5 * Math.min(1, greenShare(sim)));
      if (this.bird <= 0 && fade > 0.05) {
        this.chirp(0, 0.025 * fade);
        this.bird = 1.5 + Math.random() * 2.5;
      }
      if (Math.random() < dt * 0.6) a.tone(1100 + Math.random() * 700, 0.08, { type: 'sine', gain: 0.018 * fade });
    }
    // the rain's soft noise and its high drips
    if (this.rain > 0) {
      this.rain -= dt;
      this.rainT -= dt;
      if (this.rainT <= 0) {
        a.noiseBurst(0.6, { type: 'lowpass', freq: 800, gain: 0.03 });
        if (Math.random() < 0.6) a.tone(1500 + Math.random() * 1200, 0.06, { type: 'sine', gain: 0.02 });
        this.rainT = 0.3;
      }
    }
  }

  private chirp(at: number, gain: number): void {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const f = 2800 + Math.random() * 300;
      this.a.tone(f, 0.06, { type: 'sine', gain, slideTo: f * 1.28, at: at + i * 0.09 });
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'turn':
        a.noiseBurst(0.06, { type: 'bandpass', freq: 420, q: 2, gain: 0.06 });
        a.tone(140, 0.08, { type: 'triangle', gain: 0.05 });
        break;
      case 'knock':
        if (e.selah) a.bell(1760, 0.015, 0.6);
        else a.noiseBurst(0.03, { freq: 900, gain: 0.03 });
        break;
      case 'drip':
        if (this.drip > 0) break;
        this.drip = 0.125;
        a.tone(MODE[Math.min(MODE.length - 1, e.dist)] * 2, 0.12, { type: 'sine', gain: 0.035 });
        break;
      case 'join':
        // root, fifth, octave
        [0, 4, 7].forEach((k, i) => this.pluck(MODE[k], i * 0.03, 0.045));
        break;
      case 'meet':
        this.pluck(MODE[0]);
        this.pluck(MODE[4], 0.09);
        break;
      case 'depth':
        a.bell(MODE[Math.max(0, 8 - e.level * 2)], 0.06, 1.6);
        a.noiseBurst(0.18, { type: 'bandpass', freq: 1400, q: 1.2, gain: 0.03 });
        break;
      case 'closed':
        for (let i = 0; i < 8; i++) this.pluck(MODE[i], i * 0.07, 0.05);
        a.bell(MODE[7], 0.06, 2.4, 0.62);
        break;
      case 'oneLeft':
        this.pluck(MODE[4], 0, 0.035);
        break;
      case 'curb':
        a.noiseBurst(0.05, { freq: 2200, q: 3, gain: 0.05 });
        a.bell(ladder(4 + e.stones, 392), 0.06, 1.6, 0.08);
        break;
      case 'nest':
        this.chirp(0, 0.04);
        this.chirp(0.32, 0.035);
        break;
      case 'rain':
        this.rain = 5;
        this.rainT = 0;
        break;
      case 'reveal':
        for (let i = 0; i < 6; i++) a.tone(MODE[i] * 2, 0.12, { type: 'sine', gain: 0.03, at: i * 0.25 });
        break;
      case 'card':
        a.bell(MODE[5], 0.07, 1.8);
        a.bell(MODE[7] * 2, 0.06, 2, 0.3);
        break;
      case 'tree':
        a.noiseBurst(0.05, { freq: 600, q: 2, gain: 0.04 });
        [0, 2, 4].forEach((k, i) => this.pluck(MODE[k], 0.1 + i * 0.12, 0.04));
        break;
      case 'stage':
        [0, 2, 4, 7].forEach((k, i) => this.pluck(MODE[k], i * 0.32, 0.05));
        a.bell(MODE[7], 0.06, 2.6, 1.3);
        break;
      case 'telegraph':
        if (e.next.kind === 'sela') {
          this.pluck(440, 0, 0.045);
          this.pluck(329.63, 0.45, 0.045);
          a.noiseBurst(0.8, { type: 'highpass', freq: 3000, sweepTo: 6000, gain: 0.015 });
        } else for (let i = 0; i < 4; i++) a.tone(MODE[i + 2] * 2, 0.12, { type: 'sine', gain: 0.03, at: i * 0.25 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'sela' ? SELAH : STREAM, 3);
        if (e.block.kind === 'sela') {
          this.lyre = 1;
          this.walk = 4;
        }
        break;
      case 'finale':
        a.padChord(SELAH, 2);
        [0, 2, 4, 7].forEach((k, i) => {
          this.pluck(MODE[k], 0.3 + i * 0.4, 0.045);
          a.bell(MODE[k] * 2, 0.025, 1.6, 0.3 + i * 0.4);
        });
        break;
      default:
        break;
    }
  }
}

/** How green the valley is now (0..1), sampled cheaply from its fields' radii. */
function greenShare(sim: ZrodlaSim): number {
  const r = sim.run;
  let g = 0;
  for (let i = 0; i < r.green.length; i++) g += r.green[i];
  return Math.min(1, g / Math.max(1, r.v.n * 0.25));
}
