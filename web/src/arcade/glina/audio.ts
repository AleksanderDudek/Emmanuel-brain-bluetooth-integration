/**
 * Glina's sound, on the kit's synthesiser (kit/audio.ts): a low, earthy D Dorian pad whose filter
 * follows the chalk line (the runner drives it from GlinaSim.padLevel; held still in rest and blind
 * blocks) and whose chord grows purer in steps as the clay comes true — the impure F settles onto
 * the pure fifth at Na środku.  Around it the courtyard's craft: the kick wheel's wooden knock, wet
 * squelches for pulls and shaping, a creak at the chalk line, a low thud and a long squelch for the
 * slump (never a break: no breaking sound exists in the game), the wire's zip, the glaze bucket's
 * plunk, the kiln's roar and ember ticks slowing as the ash melts, the door and the steam at the
 * opening and the vessel's own ring (higher for a taller vessel, longer for a thinner wall, one pure
 * partial when it was true), a latch and two soft bells at the gate, and the day's vessels ringing
 * in turn at sunset.
 */
import type { ArcadeAudio } from '../kit/audio';
import { CLAY } from './clay';
import { FORM } from './content';
import type { VesselRec } from './meta';
import type { GlinaSim, SimEvent } from './sim';

/** D2, A2, D3 and an impure F3 just flat; the steps toward purity replace the fourth voice, then double the third. */
const CHORDS = [
  [73.42, 110, 146.83, 171.1],
  [73.42, 110, 146.83, 172.8],
  [73.42, 110, 146.83, 220],
  [73.42, 110, 293.66, 220],
];
const KILN = [73.42, 110, 146.83, 220];
/** D Dorian from D4 to D5 (the vessels' rings). */
const DORIAN = [293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33];
/** The ring's decay by wall grade: mocna, zgrabna, cienka, skorupka (s). */
const DECAY = [1.0, 1.5, 2.1, 2.8];

/** A vessel's ring on D Dorian: D4 at the lowest line its form allows, D5 at the highest. */
function ringOf(rec: VesselRec): number {
  const k = (rec.h / FORM[rec.f].N - CLAY.hmin) / (CLAY.hmax - CLAY.hmin);
  return DORIAN[Math.round(Math.min(1, Math.max(0, k)) * (DORIAN.length - 1))];
}

export class GlinaSound {
  private knock = 0.4;
  private roar = 0;
  private ember = 0;
  private squelch = 0;
  private strain = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: CHORDS[0], dark: 300, bright: 1600, gain: 0.05 });
  }

  update(dt: number, sim: GlinaSim): void {
    const a = this.a;
    if (!a.on) return;
    this.squelch = Math.max(0, this.squelch - dt);
    // the kick wheel's soft knock while it spins
    if (sim.phase === 'throw' || sim.phase === 'gate') {
      this.knock -= dt;
      if (this.knock <= 0) {
        this.knock += 1.1;
        a.noiseBurst(0.05, { type: 'bandpass', freq: 900, q: 4, gain: 0.03 });
      }
    }
    // the overpull's strain: a creak rising while the wall twists
    const st = sim.clay?.strain ?? 0;
    if (st > 0 && sim.phase === 'throw') {
      this.strain -= dt;
      if (this.strain <= 0) {
        this.strain = 0.15;
        a.tone(150 + 120 * st, 0.16, { type: 'triangle', gain: 0.02 + 0.03 * st, slideTo: 170 + 140 * st });
      }
    }
    // the kiln: a low roar in overlapping bursts, ember ticks that slow as the ash melts
    if (sim.phase === 'fire') {
      this.roar -= dt;
      if (this.roar <= 0) {
        this.roar += 2.5;
        a.noiseBurst(3, { type: 'lowpass', freq: 180, sweepTo: 260, gain: 0.03 });
      }
      const rate = sim.closed ? 2 : 3 - 1.8 * sim.shownG;
      this.ember -= dt;
      if (this.ember <= 0) {
        this.ember += (1 / rate) * (0.6 + 0.8 * Math.random());
        a.noiseBurst(0.025, { type: 'highpass', freq: 3500 + Math.random() * 2500, q: 1, gain: 0.025 });
      }
    }
  }

  on(e: SimEvent, sim: GlinaSim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'gate':
        a.padChord(CHORDS[0], 2);
        a.noiseBurst(0.04, { type: 'bandpass', freq: 2400, q: 5, gain: 0.04 });
        a.bell(587.33, 0.035, 1.2, 0.18);
        a.bell(880, 0.03, 1.4, 0.42);
        // the lump slaps down on the wheel
        a.noiseBurst(0.09, { type: 'lowpass', freq: 500, gain: 0.05, at: 0.9 });
        break;
      case 'throw':
        a.padChord(CHORDS[0], 1.5);
        break;
      case 'pull':
        if (this.squelch > 0) break;
        this.squelch = 1 / 6;
        a.noiseBurst(e.tap ? 0.18 : 0.14, { type: 'lowpass', freq: 400, sweepTo: 900, gain: e.tap ? 0.04 : 0.03 });
        break;
      case 'shape':
        if (this.squelch > 0) break;
        this.squelch = 1 / 6;
        a.noiseBurst(0.12, { type: 'bandpass', freq: 600, q: 1.2, gain: 0.025 });
        break;
      case 'contact':
        a.tone(180, 0.2, { type: 'triangle', gain: 0.04, slideTo: 150 });
        a.noiseBurst(0.06, { type: 'bandpass', freq: 1200, q: 3, gain: 0.02 });
        break;
      case 'slump':
        a.tone(70, 0.4, { type: 'sine', gain: 0.09, attack: 0.02 });
        a.noiseBurst(0.6, { type: 'lowpass', freq: 300, sweepTo: 150, gain: 0.05 });
        break;
      case 'gather':
        a.noiseBurst(0.07, { type: 'lowpass', freq: 600, gain: 0.04 });
        a.noiseBurst(0.07, { type: 'lowpass', freq: 650, gain: 0.04, at: 0.22 });
        break;
      case 'true':
        if (!sim.blind) a.padChord(CHORDS[Math.min(3, e.step)], 1.2);
        break;
      case 'centre':
        a.noiseBurst(0.06, { type: 'bandpass', freq: 1400, q: 6, gain: 0.06 });
        break;
      case 'cut':
        a.noiseBurst(0.35, { type: 'highpass', freq: 2000, sweepTo: 6000, gain: 0.035 });
        a.padChord(CHORDS[0], 2);
        break;
      case 'glaze':
        a.noiseBurst(0.04, { type: 'bandpass', freq: 1800, q: 4, gain: 0.04 });
        a.tone(300, 0.15, { type: 'sine', gain: 0.05, slideTo: 120, at: 0.05 });
        break;
      case 'fire':
        a.noiseBurst(0.5, { type: 'bandpass', freq: 700, q: 0.7, gain: 0.025 });   // the dip's soft wash
        a.padChord(KILN, 3);
        this.roar = 0.3;
        this.ember = 0.5;
        break;
      case 'runs':
        a.bell(1760 + e.band * 220, 0.012, 0.6);
        break;
      case 'open': {
        a.tone(220, 0.5, { type: 'triangle', gain: 0.025, slideTo: 160 });
        a.noiseBurst(0.8, { type: 'highpass', freq: 3000, gain: 0.03, at: 0.1 });
        // the vessel's ring: pitch by height, decay by wall, a second partial a cent apart unless it was true
        const rec = e.card.rec, f = ringOf(rec), dur = DECAY[rec.wall] ?? 1.5;
        a.bell(f, 0.07, dur, 0.9);
        if (!rec.centre) a.bell(f * 1.0006, 0.035, dur, 0.9);
        if (e.card.gift) {
          const up = e.card.gift === 'moon' ? 2 : 1;
          [1318.5, 1567.98, 1760].forEach((f, i) => a.bell(f * up, 0.03, 1.6, 1.4 + i * 0.09));
        }
        break;
      }
      case 'alive':
        // a house comes alive: a rising D Dorian figure after the ring
        [0, 2, 4, 7].forEach((n, i) => a.bell(DORIAN[n], 0.04, 2.2, 1.8 + i * 0.16));
        break;
      case 'finale':
        // the day's vessels ring in turn from their houses, then a slow arpeggio
        a.padChord(KILN, 3);
        sim.made.forEach((rec, i) => a.bell(ringOf(rec), 0.045, DECAY[rec.wall] ?? 1.5, 0.3 + i * 0.22));
        [0, 2, 4, 7].forEach((n, i) => a.bell(DORIAN[n] / 2, 0.035, 2.6, 0.5 + sim.made.length * 0.22 + i * 0.35));
        break;
      default:
        break;
    }
  }
}
