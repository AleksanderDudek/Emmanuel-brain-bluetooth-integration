/**
 * Odnowa's sound, on the kit's synthesiser (kit/audio.ts) and the series' song player (kit/song.ts): the song
 * of this game (song.ts) when the player keeps it on — its layers follow the band in a sighted push, a gentle
 * fixed level in a rest, and hold still in a blind push — or, with the song off, a quiet ambient pad.
 *
 * Every event has a small voice, throttled so a busy cell never turns into noise: a soft tink as each ATP
 * leaves the turbine (three notes a turn, one per β), a crisp click when a crew sets off and a chime that
 * climbs with a repair streak, the snap of a broken strand, the bloop of a closing autophagosome, the fizz
 * of a lysosome, the rush of full power, the chord of a division.
 */
import { ladder, type ArcadeAudio } from '../kit/audio';
import { SongPlayer } from '../kit/song';
import type { SimEvent } from './sim';
import { buildSong } from './song';

const PAD = [98, 146.83, 196, 246.94];
const ROOT = 392;

export class OdnowaSound {
  private song: SongPlayer | null = null;
  private atpGap = 0;
  private stepGap = 0;
  private atpI = 0;
  private t = 0;

  constructor(private readonly a: ArcadeAudio, private readonly withSong: boolean) {}

  start(): void {
    if (this.withSong) {
      this.song = new SongPlayer(this.a, buildSong());
      this.song.start();
    } else this.a.pad({ notes: PAD, dark: 320, bright: 2400, gain: 0.04 });
  }

  /** End of play or the game destroyed: the song fades out. */
  stop(): void {
    this.song?.stop();
    this.song = null;
  }

  /** The song's fullness this frame (null holds it: a blind push, no signal). */
  level(v: number | null): void { this.song?.level(v); }

  /** Beats since the song began (the visuals pulse on it); without the song the same tempo by the clock. */
  get beat(): number { return this.song ? this.song.beat : (this.t * 92) / 60; }

  /** The sing-along line now (null without the song). */
  line(): { text: string; next: string | null; p: number } | null { return this.song?.line() ?? null; }

  update(dt: number): void {
    this.t += dt;
    this.atpGap = Math.max(0, this.atpGap - dt);
    this.stepGap = Math.max(0, this.stepGap - dt);
  }

  on(e: SimEvent): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'atp':
        if (this.atpGap > 0) break;
        this.atpGap = 0.07;
        a.tone(ladder(5 + (this.atpI++ % 3) * 2, ROOT), 0.07, { type: 'sine', gain: e.src === 0 ? 0.016 : 0.009, attack: 0.004 });
        break;
      case 'kick':
        a.noiseBurst(0.09, { type: 'bandpass', freq: 900, sweepTo: 2200, q: 1.4, gain: 0.03 });
        a.tone(300, 0.08, { type: 'triangle', gain: 0.02, slideTo: 540 });
        break;
      case 'repairStart':
        if (e.by === 'tap') {
          a.tone(2300, 0.03, { type: 'square', gain: 0.01, slideTo: 1500 });
          if (e.combo >= 2) a.combo(Math.min(e.combo + 2, 14), 659.25, 0.04);
        }
        break;
      case 'repairStep':
        if (this.stepGap > 0) break;
        this.stepGap = 0.06;
        a.tone(e.step === 'lig' || e.step === 'lig4' ? 1568 : 1046, 0.035, { type: 'sine', gain: 0.012 });
        break;
      case 'repaired':
        a.bell(ladder(4 + Math.min(8, e.combo), ROOT * 2), e.by === 'tap' ? 0.035 : 0.018, 0.7);
        break;
      case 'wait':
        a.tone(660, 0.12, { type: 'triangle', gain: 0.022 });
        break;
      case 'gate':
        a.tone(220, 0.3, { type: 'triangle', gain: 0.03, slideTo: 196 });
        break;
      case 'spawn':
        if (e.kind === 'dsb') {
          a.noiseBurst(0.16, { type: 'highpass', freq: 3200, gain: 0.04 });
          a.tone(170, 0.22, { type: 'triangle', gain: 0.04, slideTo: 90 });
        }
        break;
      case 'part':
        a.tone(520, 0.1, { type: 'sine', gain: 0.012, slideTo: 440 });
        break;
      case 'sealed':
        a.tone(380, 0.18, { type: 'sine', gain: 0.025, slideTo: 640 });
        break;
      case 'fuse':
        a.tone(300, 0.22, { type: 'sine', gain: 0.032, slideTo: 150 });
        a.bell(1318.5, 0.018, 0.9);
        break;
      case 'recycled':
        for (let i = 0; i < 3; i++) a.bell(ladder(5 + i * 2, ROOT), 0.022, 0.9, i * 0.09);
        break;
      case 'ready':
        a.noiseBurst(0.5, { type: 'bandpass', freq: 500, sweepTo: 3000, q: 0.9, gain: 0.03 });
        a.bell(ladder(10, ROOT), 0.04, 1.4, 0.3);
        break;
      case 'surge':
        a.noiseBurst(0.9, { type: 'bandpass', freq: 300, sweepTo: 3600, q: 0.8, gain: 0.05 });
        a.tone(98, 1.3, { type: 'sawtooth', gain: 0.025, attack: 0.05 });
        [0, 4, 7, 12].forEach((s, i) => a.bell(ROOT * 2 ** (s / 12), 0.035, 1.6, 0.1 + i * 0.06));
        break;
      case 'surgeEnd':
        a.tone(400, 0.4, { type: 'sine', gain: 0.015, slideTo: 260 });
        break;
      case 'checkpoint':
        a.bell(ladder(4, ROOT), 0.025, 0.8);
        a.bell(ladder(2, ROOT), 0.025, 0.8, 0.18);
        break;
      case 'divide':
        [0, 4, 7, 11, 14].forEach((s, i) => a.bell(ROOT * 2 ** (s / 12), 0.03, 1.8, i * 0.14));
        break;
      case 'mitosis':
        if (e.phase > 0) a.bell(ladder(4 + e.phase * 2, ROOT), 0.02, 1.0);
        break;
      case 'cell':
        [0, 2, 4, 7, 9, 12].forEach((s, i) => a.bell(ladder(s, ROOT), 0.03, 1.2, i * 0.07));
        break;
      case 'card':
        a.bell(ladder(12, ROOT), 0.018, 1.2);
        break;
      case 'up':
        [0, 4, 7].forEach((s, i) => a.bell(ROOT * 2 ** (s / 12), 0.04, 1.4, i * 0.12));
        break;
      case 'blockStart':
        if (e.block.kind === 'push') a.tone(330, 0.5, { type: 'sine', gain: 0.025, slideTo: 494 });
        else if (e.block.kind === 'rest') a.noiseBurst(1.2, { type: 'lowpass', freq: 900, sweepTo: 300, gain: 0.02 });
        break;
      case 'telegraph':
        a.tone(880, 0.05, { type: 'sine', gain: 0.015 });
        break;
      case 'blindEnd':
        a.bell(ladder(e.share >= 0.5 ? 9 : 5, ROOT), 0.03, 1.4);
        break;
      default:
        break;
    }
  }
}
