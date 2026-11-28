/**
 * Stop-klatka's sound (DESIGN.md §28), on the kit's synthesiser (kit/audio.ts), quiet and few: a warm low room tone
 * (the pad) under everything; each place's own soft life now and then (a street's passing cars, a bus's hum, a
 * school's distant voices, an office's keys, a kitchen's clink, a park's birds); a heartbeat that follows the story's
 * heat (faster and nearer as it builds, quieter with calm); at the freeze a held breath of silence — the room tone
 * dims, a soft air sweeps down, the heart slows and fades — the breath's own soft wind, a faint shimmer as each line
 * of the second look comes, a warm chord when the clarity is full, and time flowing again with the air sweeping up.
 * Taps are a soft tick, never noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { SimEvent, StopSim } from './sim';
import type { Place } from './story';

/** A warm A with an added ninth, low: the room tone. */
const PAD = [55, 82.41, 110, 123.47];
/** The bells' root: A5. */
const ROOT = 880;

/** Each place's soft life: how often (s) and what. */
const LIFE: Readonly<Record<Place, { every: number; kind: 'cars' | 'hum' | 'voices' | 'keys' | 'clink' | 'birds' | 'room' }>> = {
  classroom: { every: 5, kind: 'voices' }, corridor: { every: 4, kind: 'voices' }, bedroom: { every: 9, kind: 'room' }, kitchen: { every: 6, kind: 'clink' },
  living: { every: 8, kind: 'room' }, bus: { every: 2.5, kind: 'hum' }, street: { every: 3.5, kind: 'cars' }, car: { every: 3, kind: 'cars' },
  office: { every: 2.2, kind: 'keys' }, meeting: { every: 7, kind: 'room' }, shop: { every: 3.5, kind: 'keys' }, queue: { every: 6, kind: 'voices' },
  clinic: { every: 7, kind: 'room' }, park: { every: 2.8, kind: 'birds' }, gym: { every: 4.5, kind: 'voices' }, screen: { every: 9, kind: 'room' },
};

export class StopSound {
  private beat = 0;
  private dub = -1;
  private life = 1.5;
  private gap = 0;
  private place: Place = 'street';

  constructor(private readonly a: ArcadeAudio, private readonly o: { reduced: boolean }) {}

  start(): void {
    this.a.pad({ notes: PAD, dark: 260, bright: 1100, gain: 0.04 });
  }

  update(dt: number, sim: StopSim): void {
    this.gap = Math.max(0, this.gap - dt);
    const a = this.a;
    if (!a.on || !sim.started) return;
    const w = sim.block.what;
    const scene = sim.scene();
    this.place = scene.place;
    // the heartbeat: the story's heat sets its pace and nearness; calm softens it; the freeze slows it to silence
    let bpm = 0, gain = 0;
    if (w === 'tell' || w === 'after') {
      const heat = sim.heat;
      if (heat > 0.12) {
        bpm = 62 + 52 * heat;
        gain = (0.012 + 0.045 * heat) * (1 - 0.5 * sim.calm);
      }
    } else if (w === 'freeze' && sim.blockT < 4) {
      bpm = 60;
      gain = 0.03 * Math.max(0, 1 - sim.blockT / 4);
    }
    if (gain > 0.002) {
      this.beat -= dt;
      if (this.beat <= 0) {
        this.beat = 60 / bpm;
        a.tone(52, 0.16, { type: 'sine', gain, attack: 0.01, slideTo: 38 });
        this.dub = 0.24;
      }
      if (this.dub >= 0) {
        this.dub -= dt;
        if (this.dub < 0) a.tone(46, 0.14, { type: 'sine', gain: gain * 0.7, attack: 0.01, slideTo: 34 });
      }
    } else this.beat = Math.min(this.beat, 0.3);
    // the place's life, never in the freeze's silence nor the close
    if (w === 'tell' || (w === 'after' && sim.afterPart !== 'lesson')) {
      this.life -= dt;
      if (this.life <= 0) {
        const L = LIFE[this.place];
        this.life = L.every * (0.7 + Math.random() * 0.6);
        this.placeLife(L.kind);
      }
    }
  }

  private placeLife(kind: (typeof LIFE)[Place]['kind']): void {
    const a = this.a;
    switch (kind) {
      case 'cars': a.noiseBurst(1.8 + Math.random(), { type: 'lowpass', freq: 380, sweepTo: 180, gain: 0.012 }); break;
      case 'hum': a.noiseBurst(2.6, { type: 'lowpass', freq: 160, sweepTo: 220, gain: 0.014 }); break;
      case 'voices': a.noiseBurst(0.9, { type: 'bandpass', freq: 700 + Math.random() * 500, q: 3, gain: 0.006 }); break;
      case 'keys':
        for (let i = 0; i < 4; i++) a.noiseBurst(0.03, { type: 'highpass', freq: 3000, gain: 0.006, at: i * (0.09 + Math.random() * 0.08) });
        break;
      case 'clink': a.tone(2600 + Math.random() * 600, 0.25, { type: 'sine', gain: 0.006 }); break;
      case 'birds':
        for (let i = 0; i < 3; i++) a.tone(3200 + Math.random() * 900, 0.09, { type: 'sine', gain: 0.005, slideTo: 3900 + Math.random() * 700, at: i * 0.14 });
        break;
      default: a.noiseBurst(1.4, { type: 'lowpass', freq: 220, gain: 0.006 }); break;
    }
  }

  on(e: SimEvent, sim: StopSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'freeze':
        // the stop: a soft glassy tone and the air sweeping down; the room tone dims (padLevel)
        a.tone(ladder(9, ROOT / 2), 1.6, { type: 'sine', gain: 0.02, attack: 0.02 });
        a.noiseBurst(1.4, { type: 'highpass', freq: 4200, sweepTo: 900, gain: 0.012 });
        break;
      case 'chips':
        a.tone(ladder(2, ROOT), 0.2, { type: 'sine', gain: 0.008 });
        break;
      case 'named':
        if (e.by === 'player') a.bell(ladder(4, ROOT / 2), 0.03, 1.6);
        break;
      case 'line':
        a.tone(ladder(5 + e.i, ROOT), 0.9, { type: 'sine', gain: 0.008, attack: 0.08 });
        break;
      case 'charged':
        [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.03, 3.2, i * (this.o.reduced ? 0.05 : 0.22)));
        break;
      case 'chose':
        if (e.by === 'player') a.bell(ladder(e.way === 'away' ? 3 : 4, ROOT / 2), 0.026, 1.4);
        break;
      case 'flow':
        a.noiseBurst(1.2, { type: 'highpass', freq: 900, sweepTo: 3800, gain: 0.01 });
        break;
      case 'part':
        if (e.part === 'lesson') a.bell(ladder(0, ROOT / 2), 0.022, 2.4);
        break;
      case 'beat':
        a.noiseBurst(0.35, { type: 'bandpass', freq: 1800, q: 1.2, gain: 0.004 });
        break;
      case 'age':
        a.bell(ladder(2, ROOT / 2), 0.03, 1.6);
        break;
      case 'tap':
        if (this.gap > 0) break;
        this.gap = 0.25;
        a.tone(ladder(1, ROOT), 0.08, { type: 'sine', gain: 0.006 });
        break;
      default: break;
    }
    void sim;
  }
}
