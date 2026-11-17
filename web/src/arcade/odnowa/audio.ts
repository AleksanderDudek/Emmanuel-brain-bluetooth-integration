/**
 * Odnowa's sound, on the kit's synthesiser (kit/audio.ts) and the series' song player (kit/song.ts): the song
 * of this game (song.ts) when the player keeps it on — its layers follow the band in a sighted push, a gentle
 * fixed level in a rest, and hold still in a blind push — or, with the song off, a quiet ambient pad.
 *
 * Every event has a small voice, throttled so a busy cell never turns into noise: a soft tink as each ATP
 * leaves the turbine (three notes a turn, one per β), a crisp click when a crew sets off and a chime when it
 * is done, the snap of a broken strand, the bloop of a closing autophagosome, the fizz of a lysosome, a warm
 * swell when a held focus turns the turbine gold, a bell when a need fills, the chord of a division.
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
      case 'repairStart':
        if (e.by === 'tap') a.tone(2300, 0.03, { type: 'square', gain: 0.01, slideTo: 1500 });
        break;
      case 'repairStep':
        if (this.stepGap > 0) break;
        this.stepGap = 0.06;
        a.tone(e.step === 'lig' || e.step === 'lig4' ? 1568 : 1046, 0.035, { type: 'sine', gain: 0.012 });
        break;
      case 'repaired':
        a.bell(ladder(6, ROOT * 2), e.by === 'tap' ? 0.035 : 0.018, 0.7);
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
      case 'gold':
        a.noiseBurst(0.5, { type: 'bandpass', freq: 500, sweepTo: 2400, q: 0.9, gain: 0.025 });
        [0, 4, 7].forEach((s, i) => a.bell(ROOT * 2 ** (s / 12), 0.03, 1.4, 0.05 + i * 0.08));
        break;
      case 'full':
        a.bell(ladder(7 + e.need * 2, ROOT), 0.035, 1.2);
        a.bell(ladder(11 + e.need * 2, ROOT), 0.025, 1.2, 0.12);
        break;
      case 'reveal':
        a.bell(ladder(9, ROOT), 0.02, 1.0);
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
        if (e.n > 0) [0, 2, 4].forEach((s, i) => a.bell(ladder(5 + s, ROOT), 0.02, 0.9, 0.2 + i * 0.07));
        break;
      default:
        break;
    }
  }
}
