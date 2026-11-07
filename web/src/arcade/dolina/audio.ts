/**
 * Dolina's sound, on the kit's synthesiser (kit/audio.ts): a low pad in D minor whose filter follows
 * the lamp in a sighted Światło (the runner drives it from DolinaSim.padLevel) and holds still
 * elsewhere, turning to a major chord in the meadow and at the dawn; footsteps that follow the run;
 * the slash — a quick airy whoosh with a bright edge — then on a kill a dull thump and a bell that
 * climbs the combo's ladder; the clink of a shield, a brick's crumble, a notification's ping; a soft
 * thud for a hit taken; the lamp's burst, the Świt's swell; the guardian's low drone, its tells and
 * its fall; the meadow's drops of oil; the dawn.  A missed verdict makes no sound.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { DolinaSim, SimEvent } from './sim';

const DARK = [73.42, 110, 146.83, 174.61];
const MEADOW = [73.42, 110, 146.83, 185];
const ROOT = 587.33;

export class DolinaSound {
  private step = 0;
  private drone = 0;
  private side = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DARK, dark: 200, bright: 1700, gain: 0.05 });
  }

  update(dt: number, sim: DolinaSim): void {
    const a = this.a;
    if (!a.on) return;
    // footsteps that follow the run (soft, alternating)
    if (sim.state === 'run' && sim.grounded && sim.speed > 0.5) {
      this.step -= dt * sim.speed * 0.42;
      if (this.step <= 0) {
        this.step = 1;
        this.side ^= 1;
        a.noiseBurst(0.05, { type: 'lowpass', freq: sim.restBlock ? 900 : 420 + this.side * 60, gain: sim.restBlock ? 0.02 : 0.03 });
      }
    }
    // a guardian's low drone while it stands on the road
    if (sim.guard && sim.guard.state === 'fight') {
      this.drone -= dt;
      if (this.drone <= 0) {
        this.drone = 2.4;
        a.tone(sim.guard.angry ? 61.74 : 55, 2.6, { type: 'sine', gain: 0.035, attack: 0.6 });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'slash':
        a.noiseBurst(0.13, { type: 'bandpass', freq: 1200, sweepTo: e.rest ? 2000 : 5200, q: 0.9, gain: e.rest ? 0.025 : 0.05 });
        if (!e.rest) a.tone(1568, 0.08, { type: 'triangle', gain: 0.018, slideTo: 2350 });
        break;
      case 'hit':
        a.tone(130, 0.12, { type: 'sine', gain: 0.09, slideTo: 70 });
        break;
      case 'kill':
        if (e.via === 'touch' || e.via === 'fade') break;
        a.tone(98, 0.14, { type: 'sine', gain: 0.1, slideTo: 55 });
        a.noiseBurst(0.3, { type: 'highpass', freq: 3000, sweepTo: 8000, gain: 0.025 });
        a.bell(ladder(Math.min(19, e.combo % 20), ROOT), 0.045, 0.8);
        break;
      case 'clink':
        a.tone(1320, 0.18, { type: 'triangle', gain: 0.04 });
        a.tone(1980, 0.12, { type: 'sine', gain: 0.025 });
        a.noiseBurst(0.07, { type: 'bandpass', freq: 3200, q: 3, gain: 0.04 });
        break;
      case 'shieldBreak':
        a.noiseBurst(0.3, { type: 'highpass', freq: 1500, gain: 0.05 });
        a.bell(ladder(9, ROOT), 0.04, 1);
        break;
      case 'shotBreak':
        if (e.kind === 'pling') a.tone(1760, 0.1, { type: 'sine', gain: 0.03, slideTo: 880 });
        else a.noiseBurst(0.18, { type: 'lowpass', freq: e.via === 'ground' ? 500 : 900, gain: e.via === 'ground' ? 0.03 : 0.06 });
        break;
      case 'pop':
        a.tone(1318.5, 0.09, { type: 'sine', gain: 0.04 });
        a.tone(1975.5, 0.12, { type: 'sine', gain: 0.03, at: 0.07 });
        break;
      case 'throw':
        a.noiseBurst(0.2, { type: 'bandpass', freq: 600, sweepTo: 1400, gain: 0.025 });
        break;
      case 'harm':
        a.tone(160, 0.25, { type: 'triangle', gain: 0.06, slideTo: 90 });
        a.noiseBurst(0.12, { type: 'lowpass', freq: 600, gain: 0.05 });
        break;
      case 'jump':
        a.tone(392, 0.12, { type: 'triangle', gain: 0.025, slideTo: 587 });
        break;
      case 'land':
        a.noiseBurst(0.06, { type: 'lowpass', freq: 380, gain: 0.04 });
        break;
      case 'slide':
        a.noiseBurst(0.3, { type: 'bandpass', freq: 700, sweepTo: 300, gain: 0.035 });
        break;
      case 'pit':
        a.tone(220, 0.5, { type: 'sine', gain: 0.05, slideTo: 110 });
        break;
      case 'dodge':
        if (e.near) a.bell(ladder(12, ROOT), 0.035, 0.6);
        break;
      case 'burst':
        if (e.ready) {
          a.noiseBurst(0.5, { type: 'bandpass', freq: 500, sweepTo: 3000, gain: 0.04 });
          a.bell(ladder(7, ROOT), 0.035, 0.9);
        } else a.tone(220, 0.08, { type: 'sine', gain: 0.02 });
        break;
      case 'combo':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + (e.mult - 2) * 5, ROOT), 0.05, 1.2, i * 0.06));
        break;
      case 'dawn':
      case 'flash':
        a.tone(146.83, 1.8, { type: 'sawtooth', gain: 0.022, attack: 0.05, slideTo: 293.66 });
        [0, 2, 4, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.8, i * 0.05));
        a.noiseBurst(1.2, { type: 'bandpass', freq: 400, sweepTo: 5000, q: 0.6, gain: 0.045 });
        break;
      case 'fall':
        a.tone(196, 0.9, { type: 'sine', gain: 0.05, slideTo: 98, attack: 0.02 });
        break;
      case 'rise':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.4, i * 0.12));
        break;
      case 'drop':
        a.bell(ladder(4 + (e.n % 6), ROOT), 0.03, 1.6);
        break;
      case 'chime':
        a.tone(ladder(e.n % 10, ROOT / 2), 0.9, { type: 'triangle', gain: 0.035, attack: 0.004 });
        break;
      case 'restPass':
      case 'pushPass':
      case 'dayGift':
      case 'look':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.1));
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(73.42, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(293.66, 0.5, { type: 'triangle', gain: 0.02, slideTo: 329.63 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? MEADOW : DARK, 3);
        break;
      case 'guard':
        if (e.what === 'come') a.tone(55, 1.6, { type: 'triangle', gain: 0.05, attack: 0.3, slideTo: 41.2 });
        else if (e.what === 'angry') a.tone(82.41, 0.8, { type: 'sawtooth', gain: 0.025, slideTo: 61.74 });
        else if (e.what === 'open') a.bell(ladder(9, ROOT), 0.05, 0.8);
        else if (e.what === 'beaten') {
          [0, 4, 7, 9, 12, 14, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.06, 2.4, i * 0.08));
          a.noiseBurst(1.4, { type: 'bandpass', freq: 600, sweepTo: 4000, gain: 0.04 });
        }
        break;
      case 'guardHit':
        if (e.via === 'slash') {
          a.tone(110, 0.16, { type: 'sine', gain: 0.11, slideTo: 55 });
          a.bell(ladder(Math.min(19, e.combo), ROOT), 0.05, 0.7);
        }
        break;
      case 'move':
        if (!e.act) {
          if (e.kind === 'strike' || e.kind === 'heavy') a.tone(880, 0.15, { type: 'triangle', gain: 0.02, slideTo: 1320 });
          else if (e.kind === 'sweep') a.tone(440, 0.6, { type: 'sine', gain: 0.02, slideTo: 880 });
          else if (e.kind === 'rain' || e.kind === 'roll') a.noiseBurst(0.25, { type: 'lowpass', freq: 300, gain: 0.03 });
        } else if (e.kind === 'heavy' || e.kind === 'sweep') a.noiseBurst(0.35, { type: 'bandpass', freq: 900, sweepTo: 200, gain: 0.05 });
        else if (e.kind === 'strike') a.noiseBurst(0.15, { type: 'bandpass', freq: 1800, sweepTo: 600, gain: 0.04 });
        break;
      case 'parry':
        a.tone(1760, 0.25, { type: 'triangle', gain: 0.045 });
        a.bell(ladder(10 + e.n, ROOT), 0.04, 0.8);
        break;
      case 'era':
      case 'gate':
        [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.045, 1.8, i * 0.1));
        break;
      case 'finale':
      case 'done':
        a.padChord([73.42, 110, 146.83, 220], 3);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, 0.4 + i * 0.25));
        break;
      default:
        break;
    }
  }
}
