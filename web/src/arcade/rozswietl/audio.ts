/**
 * Rozświetl's sound, on the kit's synthesiser (kit/audio.ts): a low, patient pad in D (its filter
 * follows the light in a sighted push, the runner drives it from RozSim.padLevel) that turns to a warm
 * major chord when a picture is transformed; a glassy tick when a crack opens, a soft knock for a tap,
 * a deep thud with a glass shimmer for a burst (higher with every link of a chain), a rising whoosh and
 * a chord for the flare, a small chime when a seam fills with gold, a bell arpeggio for a picture done,
 * the firefly's two-note chirp when it speaks.  Busy moments are throttled so a chain never becomes noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { RozSim, SimEvent } from './sim';

const DARK = [73.42, 110, 146.83, 174.61];
const WARM = [73.42, 110, 146.83, 185];
const BRIGHT = [98, 146.83, 196, 246.94];
const ROOT = 587.33;

export class RozSound {
  private crackGap = 0;
  private goldGap = 0;
  private knockGap = 0;
  private chain = 0;
  private quiet = 0;
  private lastLine = '';
  private bright = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DARK, dark: 260, bright: 2100, gain: 0.045 });
  }

  update(dt: number, sim: RozSim): void {
    const a = this.a;
    if (!a.on) return;
    this.crackGap = Math.max(0, this.crackGap - dt);
    this.goldGap = Math.max(0, this.goldGap - dt);
    this.knockGap = Math.max(0, this.knockGap - dt);
    this.quiet += dt;
    if (this.quiet > 1.2) this.chain = 0;
    if (this.bright > 0) {
      this.bright -= dt;
      if (this.bright <= 0) a.padChord(sim.restBlock ? WARM : DARK, 4);
    }
    // the firefly speaks: a tiny chirp
    const line = sim.talk.line?.text ?? '';
    if (line && line !== this.lastLine) {
      a.tone(2637, 0.05, { gain: 0.012, slideTo: 3136 });
      a.tone(3520, 0.05, { gain: 0.01, at: 0.07, slideTo: 3951 });
    }
    this.lastLine = line;
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'crack':
        if (this.crackGap > 0) return;
        this.crackGap = 0.09;
        a.bell(2600 + Math.random() * 900, 0.014, 0.22);
        a.noiseBurst(0.05, { type: 'highpass', freq: 5200, gain: 0.025 });
        break;
      case 'knock':
        if (this.knockGap > 0) return;
        this.knockGap = 0.06;
        a.tone(190, 0.08, { type: 'triangle', gain: 0.05 * (0.5 + e.power), slideTo: 120 });
        a.noiseBurst(0.06, { freq: 1900, q: 2, gain: 0.04 * (0.5 + e.power) });
        break;
      case 'burst': {
        this.quiet = 0;
        this.chain++;
        // the thud, then the glass
        a.tone(82, 0.38, { type: 'sine', gain: 0.16, slideTo: 44 });
        a.noiseBurst(0.42, { type: 'highpass', freq: 6200, sweepTo: 1800, gain: 0.06 });
        a.bell(ladder(Math.min(this.chain + 2, 16), ROOT), 0.045, 1.2);
        if (e.double) a.bell(ladder(Math.min(this.chain + 5, 18), ROOT), 0.03, 0.9, 0.05);
        break;
      }
      case 'chain':
        if (e.n >= 3) a.combo(Math.min(e.n + 3, 18), ROOT, 0.05);
        break;
      case 'flareReady':
        a.bell(ladder(5, ROOT), 0.04, 1.4);
        a.bell(ladder(7, ROOT), 0.035, 1.4, 0.12);
        break;
      case 'flare':
        a.noiseBurst(0.9, { type: 'bandpass', freq: 400, sweepTo: 5000, q: 0.7, gain: 0.08 });
        for (let i = 0; i < 4; i++) a.bell(ladder(i * 2 + 5, ROOT / 2), 0.05, 2, i * 0.06);
        break;
      case 'gold':
        if (this.goldGap > 0) return;
        this.goldGap = 0.35;
        a.bell(1318.5 + Math.random() * 300, 0.018, 1.6);
        break;
      case 'gild':
        a.bell(1567.98, 0.03, 1.8);
        break;
      case 'reveal':
        a.noiseBurst(0.7, { type: 'bandpass', freq: 600, sweepTo: 3000, gain: 0.05 });
        a.bell(ladder(9, ROOT / 2), 0.05, 2.2);
        break;
      case 'done':
        a.padChord(BRIGHT, 2.5);
        this.bright = 8;
        for (let i = 0; i < 5; i++) a.bell(ladder([0, 2, 4, 5, 7][i], ROOT / 2), 0.05, 2.6, i * 0.14);
        break;
      case 'picture':
        // the new mosaic settles: a few soft glass ticks
        for (let i = 0; i < 4; i++) a.bell(2200 + i * 260, 0.01, 0.3, 0.15 + i * 0.18);
        break;
      case 'blockStart':
        if (this.bright > 0) break;
        a.padChord(e.block.kind === 'rest' ? WARM : DARK, 3);
        break;
      default: break;
    }
  }
}
