/**
 * Geoda's sound, through the kit's ArcadeAudio (synthesised, no files): a low cave hum whose filter
 * opens with focus (the runner drives the pad) and whose chord rises before a Wzrost and sinks
 * before a Szlif; water drops with a cave echo (quieter repeats stand in for the reverb); a bell
 * that climbs a semitone for each cell grown within one hold; glass and stone at the harvest,
 * a semitone higher per line; a soft wind through the rest.
 */
import type { ArcadeAudio } from '../kit/audio';

const WZROST_CHORD = [55, 82.41, 110, 164.81];
const SZLIF_CHORD = [49, 73.42, 98, 146.83];
const semis = (root: number, n: number) => root * 2 ** (n / 12);

export class GeodaSound {
  private wind = false;
  private windIn = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: WZROST_CHORD, dark: 150, bright: 1100, gain: 0.07 });
  }

  /** A drop falling into a pool, with the cave's echo; `pitch` 0..1 varies it. */
  drip(pitch: number): void {
    const f = 880 + pitch * 660;
    for (const [at, g] of [[0, 0.045], [0.12, 0.016], [0.26, 0.007], [0.42, 0.003]] as const) {
      this.a.tone(f, 0.08, { type: 'sine', gain: g, slideTo: f * 1.8, at });
    }
  }

  /** A cell grew: a bell a semitone higher for each cell within one hold (one octave at most). */
  grow(ladder: number): void {
    const f = semis(1046.5, Math.min(12, Math.max(0, ladder - 1)));
    this.a.bell(f, 0.055, 1.4);
    this.a.bell(f, 0.018, 1.1, 0.2);
  }

  place(cells: number): void {
    this.a.tone(300, 0.12, { type: 'triangle', gain: 0.08, slideTo: 170 });
    this.a.noiseBurst(0.07, { freq: 3400, q: 1.4, gain: 0.05 });
    this.a.bell(semis(784, Math.min(cells, 5) * 2), 0.04, 0.9, 0.03);
  }

  /** A line just became full: a soft shimmer (it breaks at the Zbiór). */
  lineReady(): void {
    this.a.bell(1567.98, 0.035, 2.2, 0.06);
    this.a.bell(2093, 0.02, 2, 0.14);
  }

  nofit(): void { this.a.tone(150, 0.16, { type: 'sine', gain: 0.07, slideTo: 105 }); }

  crumble(): void { this.a.noiseBurst(0.5, { freq: 900, sweepTo: 180, type: 'lowpass', q: 0.5, gain: 0.12 }); }

  select(): void { this.a.tone(660, 0.07, { type: 'triangle', gain: 0.035 }); }

  /** The 4 s before a block: the hum rises toward a Wzrost or sinks toward a Szlif. */
  telegraph(to: 'szlif' | 'wzrost'): void {
    this.a.tone(to === 'wzrost' ? 440 : 330, 0.14, { type: 'triangle', gain: 0.045 });
    this.a.padChord(to === 'wzrost' ? WZROST_CHORD : SZLIF_CHORD, 4);
  }

  /** One line breaking: glass, stone, and a bell a semitone above the previous line. */
  shatter(index: number, gems: number): void {
    this.a.noiseBurst(0.34, { freq: 2600, sweepTo: 900, q: 0.9, gain: 0.1 });
    this.a.noiseBurst(0.22, { freq: 360, type: 'lowpass', gain: 0.12 });
    const f = semis(523.25, index);
    this.a.bell(f * 2, 0.07, 1.7);
    if (gems) this.a.bell(f * 3, 0.03, 1.2, 0.05);
  }

  bonus(lines: number): void {
    for (let i = 0; i <= Math.min(4, lines); i++) this.a.bell(semis(1046.5, i * 4), 0.05, 1.5, 0.09 * i);
  }

  wzrost(): void { this.wind = false; }

  szlif(): void {
    this.wind = true;
    this.windIn = 0;
  }

  /** Every frame: keeps a soft wind going through the Szlif. */
  tick(dt: number): void {
    if (!this.wind) return;
    this.windIn -= dt;
    if (this.windIn > 0) return;
    this.windIn = 3.1;
    this.a.noiseBurst(4.4, { freq: 380, sweepTo: 820, type: 'lowpass', q: 0.4, gain: 0.026 });
  }

  polish(): void {
    this.a.bell(2093, 0.05, 1.6);
    this.a.bell(2637.02, 0.04, 1.4, 0.09);
    this.a.bell(3135.96, 0.03, 1.2, 0.18);
  }

  reveal(): void {
    this.a.noiseBurst(0.6, { freq: 500, sweepTo: 2400, q: 0.6, gain: 0.05 });
    this.a.bell(1318.5, 0.05, 1.6, 0.2);
  }

  /** The finisher: the stone cracks, then opens on a chord. */
  crack(step: number): void {
    this.a.noiseBurst(0.18 + step * 0.06, { freq: 260 + step * 120, type: 'lowpass', gain: 0.14 + step * 0.03 });
    this.a.tone(90 - step * 8, 0.2, { type: 'sine', gain: 0.08 });
  }

  open(tier: number): void {
    this.wind = false;
    this.a.noiseBurst(0.5, { freq: 3000, sweepTo: 700, q: 0.7, gain: 0.08 });
    const chord = [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, tier));
    chord.forEach((n, i) => this.a.bell(semis(523.25, n), 0.06, 2.4, 0.1 + i * 0.07));
  }
}
