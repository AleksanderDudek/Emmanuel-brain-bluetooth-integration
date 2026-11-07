/**
 * Posłaniec's sound, on the kit's synthesiser (kit/audio.ts): a dawn pad in A whose filter follows the
 * level in a sighted push (the runner drives it from PoslaniecSim.padLevel) and holds still elsewhere,
 * moving to an evening chord on the watchtowers' road; footfalls on the paving (hollow on a wagon's
 * roof); a swish for a lane, a whoosh for a jump, a scrape for a roll; drachmas on a pentatonic ladder
 * that climbs with the streak; a soft thud for a stumble and Bela's bleat (never a buzzer); the
 * stork's wingbeats and a rising chord for the flight; a crackle and a low horn for a tower's fire;
 * bells for a station, a letter, the day's word, a city, a mission, the multiplier.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { PoslaniecSim, SimEvent } from './sim';

const DAWN = [110, 164.81, 220, 277.18];
const EVENING = [98, 146.83, 196, 246.94];
const ROOT = 440;

export class PoslaniecSound {
  private step = 0;
  private wing = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAWN, dark: 260, bright: 1700, gain: 0.05 });
  }

  update(_dt: number, sim: PoslaniecSim, stride: number): void {
    const a = this.a;
    if (!a.on || sim.phase !== 'play') return;
    const st = Math.floor(stride);
    if (st !== this.step) {
      this.step = st;
      if (sim.r.grounded && sim.r.rollT <= 0) a.noiseBurst(0.05, { type: 'bandpass', freq: sim.r.roof ? 420 : 950, q: 1.4, gain: sim.r.roof ? 0.02 : 0.012 });
    }
    if (sim.flying) {
      const wb = Math.floor(sim.t * 2.2);
      if (wb !== this.wing) {
        this.wing = wb;
        a.noiseBurst(0.25, { type: 'lowpass', freq: 500, sweepTo: 200, gain: 0.03 });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'lane': a.noiseBurst(0.1, { type: 'bandpass', freq: 800, sweepTo: 1500, q: 0.9, gain: 0.022 }); break;
      case 'bump': a.tone(150, 0.1, { type: 'sine', gain: 0.03 }); break;
      case 'jump':
        a.noiseBurst(0.2, { type: 'bandpass', freq: 500, sweepTo: 1700, q: 0.8, gain: 0.03 });
        a.tone(e.high ? 520 : 390, 0.18, { type: 'triangle', gain: 0.02, slideTo: e.high ? 1040 : 620 });
        break;
      case 'roll': a.noiseBurst(0.3, { type: 'bandpass', freq: 1400, sweepTo: 500, q: 0.7, gain: 0.03 }); break;
      case 'slam': a.tone(500, 0.12, { type: 'triangle', gain: 0.02, slideTo: 180 }); break;
      case 'land': a.noiseBurst(0.08, { type: 'lowpass', freq: 380, gain: e.hard ? 0.05 : 0.025 }); break;
      case 'roof': a.tone(ladder(4, ROOT / 2), 0.2, { type: 'triangle', gain: 0.025 }); break;
      case 'cleared': a.tone(ladder(e.tight ? 9 : 7, ROOT), 0.12, { type: 'triangle', gain: e.tight ? 0.03 : 0.015 }); break;
      case 'stumble':
        a.noiseBurst(0.18, { type: 'lowpass', freq: 260, gain: 0.07 });
        a.tone(196, 0.25, { type: 'sine', gain: 0.035, slideTo: 147 });
        // Bela's bleat
        if (!e.caught) a.tone(620, 0.45, { type: 'sawtooth', gain: 0.012, slideTo: 560, attack: 0.03 });
        break;
      case 'shieldBreak':
        a.bell(1200, 0.05, 0.6);
        a.noiseBurst(0.25, { type: 'highpass', freq: 3000, gain: 0.03 });
        break;
      case 'caught':
        [0, 0.18, 0.36].forEach(at => a.tone(600, 0.16, { type: 'sawtooth', gain: 0.012, slideTo: 540, at }));
        a.tone(220, 0.9, { type: 'sine', gain: 0.03, slideTo: 165, at: 0.5 });
        break;
      case 'newRun': [0, 2, 4].forEach((n, i) => a.bell(ladder(n, ROOT), 0.03, 0.9, i * 0.07)); break;
      case 'coin': a.tone(ladder(Math.min(17, 4 + Math.floor(e.streak / 2)), ROOT * 2), 0.13, { type: 'sine', gain: 0.022 }); break;
      case 'power': [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.2, i * 0.05)); break;
      case 'powerEnd': a.tone(ladder(2, ROOT), 0.3, { type: 'sine', gain: 0.02, slideTo: ladder(0, ROOT) }); break;
      case 'letter': a.bell(ladder(5 + e.got, ROOT), 0.05, 1.4); break;
      case 'word': [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.6, i * 0.08)); break;
      case 'station': [4, 7].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.2, i * 0.12)); break;
      case 'city': [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2.4, i * 0.14)); break;
      case 'good': a.bell(ladder(9, ROOT), 0.03, 1); break;
      case 'full': [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.04, 1.2, i * 0.06)); break;
      case 'flight':
        if (e.stage === 'start') {
          [0, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.045, 2, i * 0.08));
          a.noiseBurst(0.9, { type: 'bandpass', freq: 400, sweepTo: 2400, q: 0.7, gain: 0.025 });
        } else if (e.stage === 'glide') a.noiseBurst(1.1, { type: 'bandpass', freq: 1800, sweepTo: 500, q: 0.7, gain: 0.02 });
        break;
      case 'reveal': if (e.charge > 0.2) [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1.4, i * 0.1)); break;
      case 'fire':
        a.noiseBurst(0.5, { type: 'highpass', freq: 2500, gain: e.lit ? 0.02 : 0.006 });
        if (e.lit) a.tone(110, 1.2, { type: 'sawtooth', gain: 0.012, attack: 0.2 });
        break;
      case 'shieldGift':
        [0, 4, 7].forEach((n, i) => a.tone(ladder(n, 220), 0.7, { type: 'sawtooth', gain: 0.012, attack: 0.06, at: i * 0.22 }));
        break;
      case 'telegraph':
        if (e.next === 'rest') a.tone(110, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next === 'push') a.tone(880, 0.4, { type: 'triangle', gain: 0.018, slideTo: 1320 });
        break;
      case 'block':
        a.padChord(e.block.kind === 'rest' || e.block.kind === 'finale' ? EVENING : DAWN, 3);
        break;
      case 'verdict':
        if (e.pass && e.kind === 'rest') {
          // the watchmen's song: a horn call answered across the road
          [0, 4, 7].forEach((n, i) => a.tone(ladder(n, 220), 0.7, { type: 'sawtooth', gain: 0.012, attack: 0.06, at: i * 0.22 }));
          [7, 4].forEach((n, i) => a.tone(ladder(n, 220), 0.8, { type: 'triangle', gain: 0.02, attack: 0.06, at: 0.8 + i * 0.25 }));
        } else if (e.pass) [0, 2, 4].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.04, 1.4, i * 0.1));
        break;
      case 'mission': [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.5, i * 0.1)); break;
      case 'mult': [0, 4, 7, 12, 16, 19].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, i * 0.09)); break;
      default: break;
    }
  }
}
