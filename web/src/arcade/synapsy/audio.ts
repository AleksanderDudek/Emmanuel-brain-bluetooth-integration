/**
 * Synapsy's sound, on the kit's synthesiser, in the key of its song (D major): the song itself ("Połączenia",
 * music.ts) whose layers follow the band; a neuron's soft pluck pitched by where it sits (the front higher);
 * a new link's rising chirp and a thickening's bell that climbs with its synapses; a thought's arrival — a
 * clap of the hand or a sung "ah" of the voice — over a chord; a lost thought's quiet sigh; myelin's whoosh;
 * the BDNF bloom's cascade; the halves in step as an open fifth; a replay's quick glissando; pruning's low
 * pluck; the wash's swell; a learned lesson's little fanfare.  Small sounds are throttled; with the sound off
 * everything is a quiet no-op.
 */
import type { ArcadeAudio } from '../kit/audio';
import { SongPlayer, degFreq, type Song } from '../kit/song';
import type { Brain } from './brain';
import type { SimEvent, SynapsySim } from './sim';

export class SynapsySound {
  private player: SongPlayer | null = null;
  private fireGap = 0;
  private bellGap = 0;
  private quiet = 0;

  constructor(private readonly a: ArcadeAudio, private readonly song: Song, private readonly brain: Brain) {}

  /** Start the song (when the player keeps it on). */
  start(withSong: boolean): void {
    if (withSong && this.a.on) {
      this.player = new SongPlayer(this.a, this.song);
      this.player.start();
    }
  }

  stop(): void {
    this.player?.stop();
    this.player = null;
  }

  /** The song's fullness follows the sim (null holds it: a blind block). */
  update(dt: number, sim: SynapsySim): void {
    this.fireGap = Math.max(0, this.fireGap - dt);
    this.bellGap = Math.max(0, this.bellGap - dt);
    this.quiet += dt;
    this.player?.level(sim.songLevel());
  }

  private note(deg: number, oct = 0): number { return degFreq(this.song, deg, oct); }

  on(e: SimEvent, sim: SynapsySim): void {
    const a = this.a;
    if (!a.on) return;
    switch (e.type) {
      case 'fire': {
        if (e.by === 'pulse' || this.fireGap > 0) return;
        this.fireGap = 0.06;
        const y = this.brain.neurons[e.n]?.y ?? 0;
        a.tone(this.note(Math.round(4 - y * 4), 1), 0.18, { type: 'triangle', gain: 0.035 });
        break;
      }
      case 'pair':
        if (e.fresh) {
          a.tone(this.note(2, 1), 0.12, { type: 'sine', gain: 0.05 });
          a.tone(this.note(4, 1), 0.2, { type: 'sine', gain: 0.05, at: 0.07 });
        } else a.tone(this.note(e.beat ? 7 : 4, 1), 0.14, { type: 'triangle', gain: 0.04 });
        if (e.beat) a.bell(this.note(7, 1), 0.04, 0.8);
        break;
      case 'linked':
        a.bell(this.note(4, 1), 0.06, 1.2);
        break;
      case 'synapse':
        if (this.bellGap > 0) return;
        this.bellGap = 0.08;
        a.bell(this.note(Math.min(9, 1 + e.syn), 1), 0.05, 1);
        break;
      case 'arrive': {
        if (!e.lesson && this.quiet < 0.5) return;
        this.quiet = 0;
        const kind = this.brain.neurons[e.to]?.io;
        if (e.counted) {
          for (const d of [0, 2, 4]) a.bell(this.note(d, 1), 0.035, 1.3);
          if (kind === 'voice') a.tone(this.note(4, 1), 0.5, { type: 'triangle', gain: 0.06, attack: 0.05, slideTo: this.note(5, 1) });
          else a.noiseBurst(0.09, { freq: 2400, q: 1.4, gain: 0.08 });
        } else a.tone(this.note(e.lesson ? 2 : 4, 1), 0.2, { type: 'sine', gain: e.lesson ? 0.03 : 0.02 });
        break;
      }
      case 'lost':
        if (this.quiet < 0.4) return;
        a.tone(this.note(2), 0.25, { type: 'sine', gain: 0.02, slideTo: this.note(0) });
        break;
      case 'slow':
        a.tone(this.note(1), 0.3, { type: 'triangle', gain: 0.03, slideTo: this.note(-1) });
        break;
      case 'oli':
        if (e.key) a.noiseBurst(0.35, { freq: 900, sweepTo: 2600, q: 0.7, gain: 0.05 });
        break;
      case 'wrapped':
        a.noiseBurst(0.4, { freq: 1800, sweepTo: 600, q: 0.8, gain: 0.05 });
        a.bell(this.note(7, 1), 0.06, 1.5);
        break;
      case 'bloom':
        [0, 2, 4, 7, 9, 11].forEach((d, i) => a.bell(this.note(d, 1), 0.05, 1.6, i * 0.07));
        break;
      case 'step':
        if (e.on) {
          a.tone(this.note(0), 1.2, { type: 'sine', gain: 0.04, attack: 0.3 });
          a.tone(this.note(4), 1.2, { type: 'sine', gain: 0.035, attack: 0.3 });
        }
        break;
      case 'replay':
        [4, 5, 7, 9].forEach((d, i) => a.tone(this.note(d, 1), 0.1, { type: 'sine', gain: 0.018, at: i * 0.05 }));
        break;
      case 'prune':
        a.tone(this.note(0, -1), 0.4, { type: 'triangle', gain: 0.03 });
        break;
      case 'wash':
        a.noiseBurst(2.2, { freq: 400, sweepTo: 1400, q: 0.5, gain: 0.04 });
        break;
      case 'learned':
        [0, 4, 7, 11].forEach((d, i) => a.bell(this.note(d, 1), 0.07, 1.6, i * 0.11));
        break;
      case 'far':
      case 'full':
        a.tone(this.note(0, -1), 0.12, { type: 'sine', gain: 0.04 });
        break;
      case 'story':
        a.bell(this.note(4, 1), 0.05, 2);
        break;
      default:
        break;
    }
    void sim;
  }
}
