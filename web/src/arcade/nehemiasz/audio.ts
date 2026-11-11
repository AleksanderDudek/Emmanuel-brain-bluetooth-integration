/**
 * Nehemiasz's sound, on the kit's synthesiser (kit/audio.ts): a warm pad by day (D major, open
 * fifths) and a darker one at night (D minor) whose filter follows the watch fires in a sighted night
 * (the runner drives it from NehSim.padLevel); the trowels' tap in the builders' rhythm (faster when
 * calm), stones clacking into place, a bell when a building stands and a rising one at each tier, the
 * timber cart, newcomers' chime; at night the sling's whoosh and the pebble's "bonk", a comic yelp as
 * a raider runs, the crumble of a breach, the ram's horn (a shofar's long call), the dawn's bells.
 * Many small sounds are throttled so a busy night never becomes noise.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { NehSim, SimEvent } from './sim';

const DAY = [73.42, 110, 146.83, 220];
const NIGHT = [73.42, 110, 130.81, 196];
const ROOT = 587.33;

export class NehSound {
  private tap = 0;
  private bonk = 0;
  private yelp = 0;
  private jab = 0;
  private lay = 0;
  private night = false;
  private combo = 0;
  private comboQuiet = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: DAY, dark: 300, bright: 2200, gain: 0.04 });
  }

  update(dt: number, sim: NehSim): void {
    const a = this.a;
    if (!a.on) return;
    this.bonk = Math.max(0, this.bonk - dt);
    this.yelp = Math.max(0, this.yelp - dt);
    this.jab = Math.max(0, this.jab - dt);
    this.lay = Math.max(0, this.lay - dt);
    this.comboQuiet += dt;
    if (this.comboQuiet > 1.8) this.combo = 0;
    if (sim.nightTime !== this.night) {
      this.night = sim.nightTime;
      a.padChord(this.night ? NIGHT : DAY, 2.5);
    }
    // the trowels keep the builders' rhythm by day
    if (sim.dayTime && !sim.frozen && (sim.front >= 0 || sim.mendSeg >= 0) && !sim.sabbathToday) {
      this.tap -= dt;
      if (this.tap <= 0) {
        this.tap = 0.62 / Math.max(1, sim.rhythm);
        a.tone(sim.rhythm > 1.5 ? 1760 : 1568, 0.05, { type: 'triangle', gain: 0.018 });
        a.noiseBurst(0.04, { type: 'highpass', freq: 4000, gain: 0.012 });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'pay':
        for (let i = 0; i < Math.min(4, e.stone + e.timber); i++) a.tone(320 + i * 40, 0.06, { type: 'square', gain: 0.02, at: i * 0.07 });
        break;
      case 'built':
        a.bell(ladder(4, ROOT), 0.06, 1.2);
        a.bell(ladder(7, ROOT), 0.04, 1.4, 0.08);
        a.noiseBurst(0.18, { type: 'lowpass', freq: 500, gain: 0.05 });
        break;
      case 'missing':
        a.tone(220, 0.15, { type: 'triangle', gain: 0.04, slideTo: 180 });
        break;
      case 'tier':
        [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n + e.level * 2, ROOT), 0.05, 1.3, i * 0.07));
        break;
      case 'dressed':
        for (let i = 0; i < 5; i++) a.tone(260 + i * 30, 0.07, { type: 'triangle', gain: 0.03, at: i * 0.05 });
        break;
      case 'mend':
        a.noiseBurst(0.12, { type: 'lowpass', freq: 700, gain: 0.04 });
        break;
      case 'timber':
        for (let i = 0; i < 3; i++) a.tone(150 + i * 12, 0.09, { type: 'triangle', gain: 0.045, at: 0.3 + i * 0.16 });
        break;
      case 'newcomers':
        a.bell(ladder(2, ROOT), 0.035, 1.2);
        a.bell(ladder(5, ROOT), 0.03, 1.2, 0.12);
        break;
      case 'hunger':
        a.tone(196, 0.5, { type: 'sine', gain: 0.04, slideTo: 165 });
        break;
      case 'decree':
        a.bell(ladder(0, ROOT / 2), 0.05, 1.6);
        break;
      case 'night':
        a.bell(ladder(0, ROOT / 4), 0.06, 2.2);
        if (e.captain) for (let i = 0; i < 4; i++) a.tone(90, 0.12, { type: 'sine', gain: 0.07, at: i * 0.32 });
        break;
      case 'dawn':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.03, 1.5, i * 0.15));
        break;
      case 'sling':
        a.noiseBurst(0.18, { type: 'bandpass', freq: 1500, sweepTo: 600, q: 1.5, gain: 0.02 });
        break;
      case 'bonk':
        if (this.bonk > 0 && !e.volley) break;
        this.bonk = 0.06;
        a.tone(720 + Math.random() * 120, 0.06, { type: 'square', gain: 0.025, slideTo: 420 });
        break;
      case 'jab':
        if (this.jab > 0) break;
        this.jab = 0.08;
        a.noiseBurst(0.06, { type: 'bandpass', freq: 2400, q: 2, gain: 0.025 });
        break;
      case 'driven':
        // a comic yelp, and a bell that climbs while the routs come quick
        this.comboQuiet = 0;
        a.bell(ladder(Math.min(12, this.combo++), ROOT), 0.035, 0.7);
        if (this.yelp > 0) break;
        this.yelp = 0.15;
        a.tone(520 + Math.random() * 140, 0.22, { type: 'triangle', gain: 0.035, slideTo: 260 });
        break;
      case 'breach':
        a.noiseBurst(0.6, { type: 'lowpass', freq: 400, sweepTo: 120, gain: 0.08 });
        break;
      case 'climb':
        a.tone(300, 0.08, { type: 'triangle', gain: 0.02 });
        break;
      case 'plunder':
        a.tone(392, 0.4, { type: 'sine', gain: 0.03, slideTo: 262 });
        break;
      case 'recovered':
        a.bell(ladder(3, ROOT), 0.03, 0.8);
        break;
      case 'hornReady':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.045, 1.2, i * 0.06));
        break;
      case 'horn':
        // the shofar: a long, rising, breathy call
        a.tone(220, 1.5, { type: 'sawtooth', gain: 0.045, attack: 0.08, slideTo: 330 });
        a.tone(330, 1.3, { type: 'triangle', gain: 0.025, attack: 0.1, at: 0.15, slideTo: 440 });
        a.noiseBurst(1.2, { type: 'bandpass', freq: 900, sweepTo: 1600, q: 1.2, gain: 0.03 });
        break;
      case 'ono':
        if (e.answered) [0, 2, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.2, i * 0.06));
        break;
      case 'invite':
        a.tone(440, 0.12, { type: 'square', gain: 0.025 });
        a.tone(554, 0.12, { type: 'square', gain: 0.025, at: 0.14 });
        break;
      case 'fox':
        a.tone(900, 0.08, { type: 'triangle', gain: 0.03, slideTo: 1300 });
        a.tone(900, 0.08, { type: 'triangle', gain: 0.03, slideTo: 1300, at: 0.12 });
        break;
      case 'gateDone':
        [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, i * 0.12));
        break;
      case 'dayBonus':
      case 'nightHeld':
        a.bell(ladder(5, ROOT), 0.04, 1.4);
        break;
      default:
        break;
    }
  }
}
