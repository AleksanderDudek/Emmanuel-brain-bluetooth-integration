/**
 * The Web Audio side: the mixing graph, the persistent choir, the bells, and the lookahead loop
 * that hands the Composer's cues to them.
 *
 *   choir (lead + low sections), bells, breath, heartbeat
 *     → music in → tone (low-pass: the realm's brightness) → music volume ┬→ dry ─────────┐
 *                                                                        └→ wet → reverb ┼→ master → compressor → out
 *   effects → effects volume ───────────────────────────────────────────┬→ dry ─────────┘
 *                                                                        └→ small send → reverb
 *
 * Music oscillators: 3 lead singers × 2 + 2 low singers × 2 + 1 vibrato LFO = 11, plus 1 for the
 * heartbeat once a heart rate is set. Bells are buffer playbacks and use no oscillators.
 */
import type { MusicMood, SfxName, SoundscapeId } from '../types';
import { BELL_SAMPLE_RATE, renderBell } from './bells';
import type { Realm } from './chant';
import { Composer, type Cue } from './composer';
import { impulseResponse } from './reverb';
import { Rng } from './rng';
import { LOOKAHEAD, Metronome, TICK_MS } from './scheduler';
import { Sfx, strikeBell, type Kit, type SfxOptions } from './sfx';
import { Section } from './voice';

export interface EngineState {
  soundscape: SoundscapeId;
  mood: MusicMood;
  volumes: { master: number; music: number; sfx: number };
  muted: boolean;
  heartRate: number | null;
}

/** Low-pass cutoff of the music per realm: Hell is dark, Heaven bright. */
const TONE_HZ: Readonly<Record<Realm, number>> = { hell: 1400, earth: 3200, heaven: 5600 };
/** Formant scaling per realm: a darker or brighter vocal colour. */
const COLOUR: Readonly<Record<Realm, number>> = { hell: 0.9, earth: 1, heaven: 1.06 };
const MUSIC_TRIM = 0.5;
/** Bells are struck, not sustained: a peal needs more gain to sit level with the choir. */
const BELL_GAIN = 1.6;
const SFX_TRIM = 1;
/** Time constant of volume changes, s. */
const RAMP = 0.08;

export class Engine {
  private readonly master: GainNode;
  private readonly music: GainNode;
  private readonly effects: GainNode;
  private readonly musicIn: GainNode;
  private readonly tone: BiquadFilterNode;
  private readonly breath: GainNode;
  private readonly lead: Section;
  private readonly low: Section;
  private readonly kit: Kit;
  private readonly sfx: Sfx;
  private readonly composer: Composer;
  private readonly heart = new Metronome();
  private pulse: GainNode | null = null;
  private colour = 1;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly ctx: AudioContext,
    private readonly state: EngineState,
  ) {
    const rng = new Rng(Date.now());
    const gain = (value: number, ...dests: AudioNode[]): GainNode => {
      const node = ctx.createGain();
      node.gain.value = value;
      for (const dest of dests) node.connect(dest);
      return node;
    };
    const compressor = ctx.createDynamicsCompressor(); // gentle glue that also catches stacked effects
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.4;
    compressor.connect(ctx.destination);
    this.master = gain(0, compressor);
    const reverb = ctx.createConvolver();
    reverb.buffer = toBuffer(ctx, impulseResponse(ctx.sampleRate), ctx.sampleRate);
    reverb.connect(this.master);
    this.music = gain(0, gain(0.35, this.master), gain(1, reverb)); // music: mostly wet
    this.effects = gain(0, this.master, gain(0.12, reverb)); // effects: mostly dry
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = TONE_HZ[state.mood.realm];
    this.tone.Q.value = 0.5;
    this.tone.connect(this.music);
    this.musicIn = gain(1, this.tone);

    const noise = toBuffer(ctx, [Float32Array.from({ length: 2 * ctx.sampleRate }, () => rng.range(-1, 1))], ctx.sampleRate);
    this.kit = { ctx, rng, noise, bell: toBuffer(ctx, [renderBell()], BELL_SAMPLE_RATE) };
    this.sfx = new Sfx(this.kit, this.effects);

    const lfo = ctx.createOscillator(); // one ~5 Hz vibrato LFO shared by every singer
    lfo.frequency.value = 5.2;
    lfo.start();
    this.lead = new Section(ctx, this.musicIn, 3, lfo, rng, 9);
    this.low = new Section(ctx, this.musicIn, 2, lfo, rng, 5);

    // breath: band-passed noise that swells for a moment whenever the singers inhale
    const air = ctx.createBufferSource();
    air.buffer = noise;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 1600;
    airFilter.Q.value = 0.8;
    this.breath = gain(0, this.musicIn);
    air.connect(airFilter).connect(this.breath);
    air.start();

    this.composer = new Composer(state.soundscape, state.mood, rng.int(1, 2 ** 31));
    this.setMood(state.mood);
    this.setHeartRate(state.heartRate);
    this.applyLevels();
  }

  /** Resumes the context and the scheduler loop. */
  resume(): Promise<void> {
    this.timer ??= setInterval(this.tick, TICK_MS);
    return this.ctx.resume().catch(() => undefined);
  }

  suspend(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.ctx.suspend().catch(() => undefined);
  }

  setSoundscape(id: SoundscapeId): void {
    this.composer.setSoundscape(id);
  }

  setMood(mood: MusicMood): void {
    this.composer.setMood(mood);
    this.colour = COLOUR[mood.realm];
    this.tone.frequency.setTargetAtTime(TONE_HZ[mood.realm], this.ctx.currentTime, 1.5);
  }

  invocation(): void {
    this.composer.invocation();
  }

  playSfx(name: SfxName, opts: SfxOptions): void {
    if (this.ctx.state === 'running') this.sfx.play(name, opts);
  }

  /** Applies volumes and mute with short ramps (no clicks). */
  applyLevels(): void {
    const { volumes, muted } = this.state;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(muted ? 0 : volumes.master, now, RAMP);
    this.music.gain.setTargetAtTime(volumes.music * MUSIC_TRIM, now, RAMP);
    this.effects.gain.setTargetAtTime(volumes.sfx * SFX_TRIM, now, RAMP);
  }

  setHeartRate(bpm: number | null): void {
    const now = this.ctx.currentTime;
    this.heart.set(bpm, now);
    if (bpm === null) this.pulse?.gain.setTargetAtTime(0, now, 0.1);
    else this.pulse ??= this.createPulse();
  }

  private readonly tick = (): void => {
    const now = this.ctx.currentTime;
    const until = now + LOOKAHEAD;
    for (const cue of this.composer.take(now, until)) this.perform(cue);
    if (this.pulse && this.state.heartRate) {
      for (const beat of this.heart.due(now, until)) this.beat(this.pulse.gain, beat, this.state.heartRate);
    }
  };

  private perform(cue: Cue): void {
    if (cue.kind === 'bell') {
      strikeBell(this.kit, this.musicIn, cue.at, cue.midi, BELL_GAIN * cue.level, cue.pan);
      return;
    }
    const section = cue.part === 'lead' ? this.lead : this.low;
    if (cue.kind === 'note') {
      section.note(cue, this.colour);
    } else {
      section.rest(cue.at, cue.release);
      if (cue.breath) this.inhale(cue.at);
    }
  }

  private inhale(at: number): void {
    const g = this.breath.gain;
    g.setTargetAtTime(0.04, at + 0.04, 0.08);
    g.setTargetAtTime(0, at + 0.32, 0.08);
  }

  /** The heartbeat: a low, muffled tone that swells twice per beat ("lub-dub"), very softly. */
  private createPulse(): GainNode {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 58;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 220;
    const level = this.ctx.createGain();
    level.gain.value = 0;
    osc.connect(lowpass).connect(level).connect(this.musicIn);
    osc.start();
    return level;
  }

  private beat(gain: AudioParam, at: number, bpm: number): void {
    const dub = at + Math.min(0.3, 24 / bpm); // the second sound, closer at fast rates
    gain.setTargetAtTime(0.3, at, 0.025);
    gain.setTargetAtTime(0, at + 0.08, 0.07);
    gain.setTargetAtTime(0.18, dub, 0.025);
    gain.setTargetAtTime(0, dub + 0.08, 0.08);
  }
}

function toBuffer(ctx: BaseAudioContext, channels: readonly Float32Array[], sampleRate: number): AudioBuffer {
  const buffer = ctx.createBuffer(channels.length, channels[0].length, sampleRate);
  channels.forEach((data, i) => buffer.getChannelData(i).set(data));
  return buffer;
}
