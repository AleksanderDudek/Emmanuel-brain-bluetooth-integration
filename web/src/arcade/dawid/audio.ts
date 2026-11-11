/**
 * Dawid's sound, on the kit's synthesiser (kit/audio.ts): a warm pastoral pad (a drone and a fifth, a
 * shepherd's open chord) whose filter follows the whirl in a sighted push (the runner drives it from
 * DawidSim.padLevel) and holds still elsewhere; the sling's whoosh once a turn, rising in pitch as the
 * whirl speeds up — so focus can be heard — a "fwip" for a throw, a wooden "tok" for a hit (a bright
 * "tink" for a golden stone), a yelp and patter as a beast runs off, silver chimes that climb as coins
 * are gathered (combo pitch), the bag's thump when it is full, a cascade into the treasury, a fanfare at
 * a level, the great stone's deep whoom and crack, a guardian's growl and roar, Goliath's taunt, the
 * thud of a giant falling, and in the rest the harp: plucked notes in a pentatonic, one for each note
 * that rises over the fire.  A missed verdict makes no sound.  Small sounds are throttled.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import type { DawidSim, SimEvent } from './sim';

const FIELD = [73.42, 110, 146.83, 220];
const HARP = [98, 146.83, 196, 246.94];
const ROOT = 523.25;
/** the harp's tune: a lullaby on the pentatonic */
const TUNE = [0, 2, 4, 7, 4, 2, 4, 5, 7, 9, 7, 4, 2, 0, 2, 4];

export class DawidSound {
  private tuneI = 0;
  private coinN = 0;
  private coinQuiet = 0;
  private lastTurn = 0;
  private hitT = 0;
  private throwT = 0;
  private yelpT = 0;

  constructor(private readonly a: ArcadeAudio) {}

  start(): void {
    this.a.pad({ notes: FIELD, dark: 280, bright: 2200, gain: 0.045 });
  }

  update(dt: number, sim: DawidSim): void {
    const a = this.a;
    if (!a.on) return;
    this.hitT = Math.max(0, this.hitT - dt);
    this.throwT = Math.max(0, this.throwT - dt);
    this.yelpT = Math.max(0, this.yelpT - dt);
    this.coinQuiet += dt;
    if (this.coinQuiet > 1.2) this.coinN = 0;
    // the sling's whoosh, once a turn; its pitch and loudness follow the whirl
    const turn = Math.floor(sim.spinA / (Math.PI * 2));
    if (turn !== this.lastTurn) {
      this.lastTurn = turn;
      if (!sim.sitting && sim.david.down <= 0) {
        const live = sim.ringLook === 'live';
        const f = 500 + sim.whirl * 1600;
        a.noiseBurst(0.12, { type: 'bandpass', freq: f, sweepTo: f * 1.6, q: 2.5, gain: live ? 0.012 + sim.whirl * 0.03 : 0.008 });
      }
    }
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'throw':
        if (e.kind === 'great') {
          a.tone(98, 0.9, { type: 'sawtooth', gain: 0.03, attack: 0.02, slideTo: 196 });
          a.noiseBurst(0.6, { type: 'bandpass', freq: 600, sweepTo: 2400, q: 1.2, gain: 0.05 });
          break;
        }
        if (this.throwT > 0) break;
        this.throwT = 0.07;
        a.noiseBurst(0.07, { type: 'highpass', freq: e.gold ? 3000 : 2200, sweepTo: e.gold ? 6000 : 4200, gain: e.gold ? 0.025 : 0.016 });
        break;
      case 'hit':
        if (this.hitT > 0 && !e.crit) break;
        this.hitT = 0.05;
        if (e.gold) a.bell(1318.5 + Math.random() * 200, 0.025, 0.25);
        a.tone(e.guard ? 160 : 420 + Math.random() * 80, 0.07, { type: 'triangle', gain: e.crit ? 0.06 : 0.035, slideTo: e.guard ? 110 : 300 });
        if (e.crit) a.noiseBurst(0.08, { type: 'bandpass', freq: 1800, gain: 0.03 });
        break;
      case 'blocked':
        a.bell(880, 0.04, 0.3);
        a.tone(440, 0.12, { type: 'square', gain: 0.02, slideTo: 330 });
        break;
      case 'driven':
        if (this.yelpT > 0) break;
        this.yelpT = 0.06;
        a.tone(700 + Math.random() * 200, 0.12, { type: 'sine', gain: 0.03, slideTo: 1200 });
        for (let i = 0; i < 3; i++) a.noiseBurst(0.04, { type: 'lowpass', freq: 700, gain: 0.02, at: 0.06 + i * 0.07 });
        break;
      case 'coin':
        this.coinQuiet = 0;
        if (e.kind === 'silver') a.bell(ladder(Math.min(16, this.coinN++), ROOT * 1.5), 0.02, 0.45);
        else a.tone(e.kind === 'wood' ? 220 : 330, 0.06, { type: 'triangle', gain: 0.03 });
        break;
      case 'bagFull':
        a.tone(110, 0.3, { type: 'sine', gain: 0.06, slideTo: 82 });
        break;
      case 'deliver':
        for (let i = 0; i < 8; i++) a.bell(ladder(i, ROOT), 0.03, 0.6, i * 0.05);
        break;
      case 'level':
        [0, 2, 4, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT), 0.045, 1.2, i * 0.05));
        a.tone(196, 0.6, { type: 'triangle', gain: 0.03, slideTo: 392 });
        break;
      case 'stoneReady':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n + 2, ROOT), 0.045, 1.2, i * 0.06));
        break;
      case 'stoneHit':
        a.tone(65.4, 0.9, { type: 'sine', gain: 0.09, slideTo: 41 });
        a.noiseBurst(0.5, { type: 'lowpass', freq: 900, sweepTo: 200, gain: 0.08 });
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.6, 0.1 + i * 0.05));
        break;
      case 'sweep':
        a.noiseBurst(0.12, { type: 'bandpass', freq: 900, sweepTo: 2200, q: 1.5, gain: 0.03 });
        break;
      case 'kit':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.03, 0.8, i * 0.05));
        break;
      case 'star':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.3, i * 0.07));
        break;
      case 'hurt':
        a.tone(160, 0.18, { type: 'triangle', gain: 0.05, slideTo: 100 });
        break;
      case 'down':
        a.tone(196, 0.7, { type: 'sine', gain: 0.05, slideTo: 130, attack: 0.02 });
        break;
      case 'wake':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1, i * 0.1));
        break;
      case 'guardWake':
        a.tone(55, 1.4, { type: 'sawtooth', gain: 0.045, attack: 0.1, slideTo: 41 });
        a.noiseBurst(1, { type: 'lowpass', freq: 600, sweepTo: 200, gain: 0.05 });
        break;
      case 'guardTele':
        if (e.pattern === 'taunt') {
          a.tone(130, 0.35, { type: 'sawtooth', gain: 0.04, slideTo: 98 });
          a.noiseBurst(0.3, { type: 'bandpass', freq: 400, gain: 0.04 });
        } else a.tone(82, 0.5, { type: 'sawtooth', gain: 0.025, attack: 0.12, slideTo: 110 });
        break;
      case 'guardAct':
        if (e.pattern === 'roar') a.noiseBurst(0.9, { type: 'lowpass', freq: 500, gain: 0.07 });
        else if (e.pattern === 'stomp' || e.pattern === 'pounce') a.tone(55, 0.4, { type: 'sine', gain: 0.08, slideTo: 36 });
        else if (e.pattern !== 'taunt') a.noiseBurst(0.25, { type: 'bandpass', freq: 700, sweepTo: 300, gain: 0.05 });
        break;
      case 'daze':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 5, ROOT), 0.03, 0.8, i * 0.06));
        break;
      case 'guardDriven':
        if (e.giant) {
          a.tone(41, 1.2, { type: 'sine', gain: 0.12, slideTo: 30 });
          a.noiseBurst(1.2, { type: 'lowpass', freq: 400, sweepTo: 120, gain: 0.1 });
        }
        [0, 2, 4, 5, 7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.05, 2, 0.3 + i * 0.09));
        a.padChord([73.42, 110, 146.83, 185], 3);
        break;
      case 'gate':
        [7, 9, 12, 14].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.6, i * 0.12));
        break;
      case 'questDone':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1, i * 0.06));
        break;
      case 'buy': case 'build': case 'forge':
        a.tone(220, 0.08, { type: 'square', gain: 0.025 });
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n + 7, ROOT), 0.035, 0.9, 0.04 + i * 0.05));
        break;
      case 'joined':
        [0, 2, 4, 7, 9, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.6, i * 0.1));
        break;
      case 'chest': case 'gift':
        [0, 4, 7, 12, 16].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.3, i * 0.07));
        break;
      case 'node':
        a.tone(260, 0.08, { type: 'triangle', gain: 0.03 });
        break;
      case 'thief':
        a.tone(660, 0.25, { type: 'square', gain: 0.02, slideTo: 990 });
        break;
      case 'thiefCaught':
        [0, 4, 7, 12, 16, 19].forEach((n, i) => a.bell(ladder(n, ROOT), 0.04, 1.2, i * 0.05));
        break;
      case 'thiefGone':
        a.tone(500, 0.3, { type: 'sine', gain: 0.03, slideTo: 250 });
        break;
      case 'note':
        a.tone(ladder(TUNE[this.tuneI++ % TUNE.length], 261.63), 1.4, { type: 'triangle', gain: 0.045, attack: 0.004 });
        break;
      case 'restGift':
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 1.8, i * 0.15));
        break;
      case 'dawn':
        a.tone(146.83, 1.2, { type: 'sine', gain: 0.04, attack: 0.2, slideTo: 293.66 });
        break;
      case 'armour':
        for (let i = 0; i < 4; i++) a.tone(300 + i * 40, 0.08, { type: 'square', gain: 0.02, at: i * 0.12 });
        break;
      case 'cave': case 'caveOut':
        a.tone(110, 1.2, { type: 'sine', gain: 0.04, attack: 0.2, slideTo: e.type === 'cave' ? 73.42 : 146.83 });
        break;
      case 'floor':
        [0, 4, 7].forEach((n, i) => a.bell(ladder(n, ROOT), 0.035, 1, i * 0.06));
        break;
      case 'telegraph':
        if (e.next?.kind === 'rest') a.tone(73.42, 2, { type: 'sine', gain: 0.03, attack: 0.8 });
        else if (e.next?.kind === 'push') a.tone(293.66, 0.5, { type: 'triangle', gain: 0.02, slideTo: 329.63 });
        break;
      case 'blockStart':
        a.padChord(e.block.kind === 'rest' ? HARP : FIELD, 3);
        break;
      case 'done':
        a.padChord(HARP, 3);
        [0, 4, 7, 12].forEach((n, i) => a.bell(ladder(n, ROOT / 2), 0.04, 2.2, 0.3 + i * 0.25));
        break;
      default:
        break;
    }
  }
}
