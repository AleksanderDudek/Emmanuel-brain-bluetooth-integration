/**
 * Dziewiątka's sound, on the kit's synthesiser (kit/audio.ts): a warm town-morning pad (D major) whose
 * filter follows the energy multiplier in a sighted push (the runner drives it from padLevel) and
 * turns to a softer chord at the well; each hero's own voice for an ultimate (Patience's stone drum,
 * Love's warm swell, Joy's plucked run, Peace's water chime, Kindness's teacup clink, Goodness's zing,
 * Faithfulness's low bell, Gentleness's breath of seeds, Self-control's single clean tink), Harmony's
 * chord of five bells under the deep bell of the town, a chime that climbs as shadows are hushed in a
 * row (combo pitch), the Din's wind-ups (a growl, a kettle), a broken wind-up's pop, the well's slow
 * tune and drips, a fanfare for a mission and a new colour rank.  Many small sounds are throttled.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { HEROES, type HeroId } from './content';
import type { DziewiatkaSim, SimEvent } from './sim';

const FIGHT = [146.83, 220, 293.66, 369.99];
const WELL = [146.83, 220, 277.18, 329.63];
const ROOT = 587.33;
const TUNE = [0, 2, 4, 2, 1, 0, 2, 4, 5, 4, 2, 0];

export class DziewiatkaSound {
  private hushN = 0;
  private hushQuiet = 0;
  private hitT = 0;
  private shotT = 0;
  private tuneI = 0;
  private tuneT = 0;
  private atWell = false;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: FIGHT, dark: 240, bright: 2300, gain: 0.045 });
  }

  update(dt: number, sim: DziewiatkaSim): void {
    const a = this.a;
    if (!a.on) return;
    this.hitT = Math.max(0, this.hitT - dt);
    this.shotT = Math.max(0, this.shotT - dt);
    this.hushQuiet += dt;
    if (this.hushQuiet > 1.3) this.hushN = 0;
    if (sim.atWell !== this.atWell) {
      this.atWell = sim.atWell;
      a.padChord(this.atWell ? WELL : FIGHT, 2.5);
    }
    if (sim.atWell && sim.restBlock) {
      this.tuneT -= dt;
      if (this.tuneT <= 0) {
        this.tuneT = this.tuneI % 4 === 3 ? 1.2 : 0.75;
        a.bell(ladder(TUNE[this.tuneI % TUNE.length], ROOT / 2), 0.026, 1.6);
        if (this.tuneI % 3 === 1) a.tone(1800 + Math.random() * 400, 0.12, { type: 'sine', gain: 0.012, slideTo: 900 });
        this.tuneI++;
      }
    } else this.tuneT = 0.4;
  }

  private ult(kind: HeroId, chord: boolean): void {
    const a = this.a;
    if (chord) return;
    switch (kind) {
      case 'cierpliwosc':
        a.tone(98, 0.5, { type: 'sine', gain: 0.12, slideTo: 70 });
        a.noiseBurst(0.35, { type: 'lowpass', freq: 500, gain: 0.08 });
        break;
      case 'milosc':
        a.tone(392, 0.9, { type: 'sine', gain: 0.05, attack: 0.15 });
        a.tone(493.88, 0.9, { type: 'sine', gain: 0.04, attack: 0.2 });
        a.tone(587.33, 0.9, { type: 'triangle', gain: 0.025, attack: 0.25 });
        break;
      case 'radosc':
        for (let i = 0; i < 5; i++) a.tone(ladder(i + 2, 523.25), 0.18, { type: 'triangle', gain: 0.05, at: i * 0.07 });
        break;
      case 'pokoj':
        a.bell(1046.5, 0.07, 1.4);
        a.bell(1318.5, 0.05, 1.4, 0.08);
        a.noiseBurst(0.5, { type: 'highpass', freq: 3000, gain: 0.03, sweepTo: 1200 });
        break;
      case 'uprzejmosc':
        a.bell(2093, 0.05, 0.4);
        a.bell(2349.3, 0.04, 0.4, 0.09);
        break;
      case 'dobroc':
        a.tone(880, 0.35, { type: 'triangle', gain: 0.06, slideTo: 1760 });
        a.noiseBurst(0.3, { type: 'highpass', freq: 2500, gain: 0.05 });
        break;
      case 'wiernosc':
        a.bell(293.66, 0.09, 1.6);
        break;
      case 'lagodnosc':
        a.noiseBurst(1.0, { type: 'bandpass', freq: 2200, sweepTo: 700, q: 0.6, gain: 0.05 });
        a.tone(1174.7, 0.8, { type: 'sine', gain: 0.025, attack: 0.2 });
        break;
      case 'opanowanie':
        a.bell(1568, 0.08, 0.9, 0.12);
        a.noiseBurst(0.08, { type: 'bandpass', freq: 5000, q: 2, gain: 0.04, at: 0.1 });
        break;
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'attack':
        if (!e.hero) break;
        if (this.shotT > 0) break;
        this.shotT = 0.07;
        if (e.kind === 'radosc') a.tone(ladder(Math.floor(Math.random() * 5) + 5, 523.25), 0.12, { type: 'triangle', gain: 0.025 });
        else if (e.kind === 'pokoj') a.tone(1400, 0.12, { type: 'sine', gain: 0.02, slideTo: 700 });
        else if (e.kind === 'dobroc') a.tone(1200, 0.08, { type: 'triangle', gain: 0.02, slideTo: 1800 });
        else if (!e.ranged) a.noiseBurst(0.07, { type: 'lowpass', freq: 600, gain: 0.04 });
        else a.noiseBurst(0.1, { type: 'bandpass', freq: 1800, sweepTo: 900, gain: 0.02 });
        break;
      case 'hit':
        if (!e.onHero || this.hitT > 0) break;
        this.hitT = 0.12;
        a.noiseBurst(0.09, { type: 'lowpass', freq: 380, gain: 0.05 });
        break;
      case 'hush':
        this.hushQuiet = 0;
        a.bell(ladder(Math.min(14, this.hushN++), ROOT), e.boss ? 0.09 : 0.035, e.boss ? 2.2 : 0.7);
        if (e.boss) a.bell(146.83, 0.08, 2.5, 0.1);
        break;
      case 'ready':
        a.tone(ladder(e.slot + 5, 523.25), 0.15, { type: 'sine', gain: 0.03 });
        break;
      case 'ult':
        this.ult(e.kind, e.chord);
        break;
      case 'chord': {
        const notes = Object.values(HEROES).map(h => h.note).sort((x, y) => x - y).slice(0, 5);
        notes.forEach((f, i) => a.bell(f, 0.06, 2.4, i * 0.05));
        a.bell(98, 0.12, 3.2, 0.02);
        a.noiseBurst(1.4, { type: 'bandpass', freq: 600, sweepTo: 3000, q: 0.5, gain: 0.04 });
        break;
      }
      case 'harmonyReady':
        a.bell(783.99, 0.05, 1.2);
        a.bell(987.77, 0.04, 1.2, 0.12);
        break;
      case 'wind':
        if (e.kind === 'gniewosz') a.tone(900, 1.6, { type: 'sine', gain: 0.02, attack: 0.4, slideTo: 1500 });
        else if (e.boss) a.tone(110, 1.8, { type: 'sawtooth', gain: 0.025, attack: 0.5, slideTo: 165 });
        else a.noiseBurst(0.9, { type: 'bandpass', freq: 3000, q: 3, gain: 0.02 });
        break;
      case 'special':
        if (e.special === 'whisper') a.noiseBurst(0.5, { type: 'bandpass', freq: 3500, q: 4, gain: 0.03 });
        else {
          a.noiseBurst(0.5, { type: 'lowpass', freq: 260, gain: 0.12 });
          a.tone(70, 0.5, { type: 'sine', gain: 0.1, slideTo: 50 });
        }
        break;
      case 'interrupt':
        a.tone(300, 0.12, { type: 'square', gain: 0.03, slideTo: 150 });
        a.bell(1318.5, 0.06, 0.9, 0.08);
        break;
      case 'steal':
        a.tone(620, 0.12, { type: 'sawtooth', gain: 0.012, slideTo: 300 });
        break;
      case 'fall':
        a.tone(440, 0.6, { type: 'sine', gain: 0.04, slideTo: 220 });
        break;
      case 'revive':
        a.tone(330, 0.5, { type: 'sine', gain: 0.04, slideTo: 660 });
        a.bell(990, 0.04, 0.9, 0.2);
        break;
      case 'wave':
        a.noiseBurst(0.25, { type: 'lowpass', freq: 300, gain: 0.05 });
        break;
      case 'won':
        [0, 2, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.06, 1.4, i * 0.12));
        break;
      case 'pick':
        [7, 9, 11].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 0.9, i * 0.06));
        break;
      case 'equip':
        a.tone(1200, 0.05, { type: 'square', gain: 0.02 });
        if (e.rankUp) [0, 4, 7, 9].forEach((n, i) => a.bell(ladder(n, ROOT), 0.06, 1.2, 0.05 + i * 0.1));
        break;
      case 'level':
        a.bell(ladder(8, ROOT), 0.03, 0.6);
        break;
      case 'nope':
        a.tone(180, 0.08, { type: 'square', gain: 0.02 });
        break;
      case 'wipe':
        a.tone(392, 0.9, { type: 'triangle', gain: 0.04, slideTo: 196 });
        break;
      case 'standUp':
        for (let i = 0; i < 4; i++) a.bell(1568, 0.03, 0.4, i * 0.12);
        break;
      case 'mission':
        if (e.boss) a.tone(98, 1.2, { type: 'sawtooth', gain: 0.03, attack: 0.3, slideTo: 82 });
        break;
      default:
        break;
    }
  }
}
