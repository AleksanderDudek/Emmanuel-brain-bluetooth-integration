/**
 * The Web Audio side: the mixing graph, the persistent choir, the voice pool that plays the
 * soundtrack's rendered instruments and the bells, and the lookahead loop that hands the
 * Composer's cues to them.
 *
 *   choir (lead + low sections), bells, breath, heartbeat
 *     → music in → tone (low-pass: the realm's brightness) → music volume ┬→ dry ─────────┐
 *                                                                        └→ wet → reverb ┼→ master → compressor → out
 *   soundtrack: harp, flute, bass, drone, drums, metal, cymbals, horn channels            │
 *     → psalm in → psalm tone → music volume ┬→ dry ──────────────────────────────────────┤
 *                                            └→ small send → reverb                        │
 *   effects → effects volume ────────────────┬→ dry ──────────────────────────────────────┘
 *                                            └→ small send → reverb
 *
 * Music oscillators: 3 lead singers × 2 + 2 low singers × 2 + 1 vibrato LFO = 11, plus 1 for the
 * heartbeat once a heart rate is set. Instruments and bells are buffer playbacks — at most
 * MAX_VOICES at once, each disconnected when it ends — and use no oscillators.
 */
import type { MusicMood, SfxName, SoundscapeId } from '../types';
import { palette, type InstCue } from './arranger';
import { BELL_PRIME_HZ, BELL_SAMPLE_RATE, renderBell } from './bells';
import { midiToHz, type Realm } from './chant';
import { Composer, type Cue } from './composer';
import type { Inst } from './instruments';
import { BufferBank, VoicePool, WARM_BUDGET_MS, WARM_PER_TICK, type PlayOptions } from './pool';
import type { Piece } from './psalm';
import { impulseResponse } from './reverb';
import { Rng } from './rng';
import { LOOKAHEAD, Metronome, TICK_MS } from './scheduler';
import { Sfx, type Kit, type SfxOptions } from './sfx';
import { Section } from './voice';

export interface EngineState {
  soundscape: SoundscapeId;
  mood: MusicMood;
  volumes: { master: number; music: number; sfx: number };
  muted: boolean;
  heartRate: number | null;
  /** the player's variation per track ("next track") */
  variations: Record<string, number>;
}

/** Low-pass cutoff of the choir per realm: Hell is dark, Heaven bright. */
const TONE_HZ: Readonly<Record<Realm, number>> = { hell: 1400, earth: 3200, heaven: 5600 };
/** The soundtrack's brightness per realm: Hell muffled, Heaven open. */
const PSALM_TONE_HZ: Readonly<Record<Realm, number>> = { hell: 2400, earth: 8000, heaven: 11000 };
/** Formant scaling per realm: a darker or brighter vocal colour. */
const COLOUR: Readonly<Record<Realm, number>> = { hell: 0.9, earth: 1, heaven: 1.06 };
/**
 * Music volume → choir and bells bus, and → soundtrack bus. Measured in Chrome (offline render
 * through the compressor): at full volumes (master, music, sfx = 1) a boss fight with effects on
 * top peaks at −3.3…−4.7 dBFS, the chant at about −3.5 (a full Byzantine schola, rarely, −2);
 * at the defaults the music sits 6–10 dB under the effects (RMS ≈ −29 dBFS in battle).
 */
const MUSIC_TRIM = 0.25;
const PSALM_TRIM = 0.6;
/** Bells are struck, not sustained: a peal needs more gain to sit level with the choir. */
const BELL_GAIN = 3.1;
const SFX_TRIM = 1;
/** Time constant of volume changes, s. */
const RAMP = 0.08;

/** The soundtrack's mixer: each channel's level and stereo position. */
type Channel = 'harp' | 'flute' | 'bass' | 'drone' | 'drums' | 'metal' | 'zil' | 'horn';
const CHANNELS: Readonly<Record<Channel, readonly [level: number, pan: number]>> = {
  harp: [0.7, -0.25], flute: [0.36, 0.22], bass: [0.36, 0], drone: [0.36, 0], drums: [0.55, 0.05], metal: [0.8, -0.35], zil: [0.5, 0.4], horn: [0.36, 0.12],
};
const CHANNEL_OF: Readonly<Record<Inst, Channel>> = {
  harp: 'harp', flute: 'flute', bass: 'bass', drone: 'drone', doum: 'drums', tek: 'drums', ka: 'drums', jingle: 'metal', shake: 'metal', zil: 'zil',
  shofar: 'horn', stab: 'horn',
};
/** Which voices to keep when too many sound: the held drone and the melody; the tambourine goes first. */
const RANK: Readonly<Record<Inst, number>> = { drone: 6, flute: 5, shofar: 5, stab: 5, bass: 4, doum: 4, tek: 3, harp: 2, zil: 2, ka: 1, jingle: 1, shake: 1 };
const BELL_RANK = 3;
/** Release (time constant, s) of a note cut short. */
const RELEASE: Readonly<Partial<Record<Inst, number>>> = { flute: 0.06, shofar: 0.09, stab: 0.05, bass: 0.07, harp: 0.12 };

export class Engine {
  private readonly master: GainNode;
  private readonly music: GainNode;
  private readonly psalmOut: GainNode;
  private readonly effects: GainNode;
  private readonly musicIn: GainNode;
  private readonly psalmIn: GainNode;
  private readonly tone: BiquadFilterNode;
  private readonly psalmTone: BiquadFilterNode;
  private readonly breath: GainNode;
  private readonly lead: Section;
  private readonly low: Section;
  private readonly kit: Kit;
  private readonly sfx: Sfx;
  private readonly composer: Composer;
  private readonly bank: BufferBank;
  private readonly pool: VoicePool;
  private readonly channels = new Map<Channel, GainNode>();
  private readonly heart = new Metronome();
  private pulse: GainNode | null = null;
  private colour = 1;
  /** the piece (and whether its boss scale) whose notes were last queued for rendering ahead */
  private warmed: Piece | null = null;
  private warmedDark = false;
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
    this.music = gain(0, gain(0.35, this.master), gain(1, reverb)); // the choir: mostly wet
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

    // the soundtrack: rendered instruments, much drier than the choir so the groove stays clear
    this.psalmTone = ctx.createBiquadFilter();
    this.psalmTone.type = 'lowpass';
    this.psalmTone.frequency.value = PSALM_TONE_HZ[state.mood.realm];
    this.psalmTone.Q.value = 0.5;
    this.psalmOut = gain(0, this.master, gain(0.22, reverb));
    this.psalmTone.connect(this.psalmOut);
    this.psalmIn = gain(1, this.psalmTone);
    this.bank = new BufferBank(ctx);
    this.pool = new VoicePool(ctx);

    this.composer = new Composer(state.soundscape, state.mood, rng.int(1, 2 ** 31), state.variations);
    this.setMood(state.mood);
    this.setHeartRate(state.heartRate);
    this.applyLevels();
  }

  /** Resumes the context and the scheduler loop. */
  resume(): Promise<void> {
    this.timer ??= setInterval(this.tick, TICK_MS);
    return this.ctx.resume().catch(() => undefined);
  }

  /**
   * Stops the loop and the context. Everything sounding is released first — just after the
   * notes already scheduled ahead, which would otherwise re-open a voice — so no note hangs on
   * if the context keeps running (WebKit sometimes ignores suspend()) or when it resumes.
   */
  suspend(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    const at = this.composer.interrupt(this.ctx.currentTime) + 0.01;
    this.lead.rest(at, 0.05);
    this.low.rest(at, 0.05);
    this.breath.gain.setTargetAtTime(0, at + 0.3, 0.05); // after a breath that may have begun
    this.pool.stopAll(at, 0.03);
    this.ctx.suspend().catch(() => undefined);
  }

  setSoundscape(id: SoundscapeId): void {
    this.composer.setSoundscape(id);
  }

  setMood(mood: MusicMood): void {
    this.composer.setMood(mood);
    this.colour = COLOUR[mood.realm];
    this.tone.frequency.setTargetAtTime(TONE_HZ[mood.realm], this.ctx.currentTime, 1.5);
    this.psalmTone.frequency.setTargetAtTime(PSALM_TONE_HZ[mood.realm], this.ctx.currentTime, 1.5);
  }

  invocation(): void {
    this.composer.invocation();
  }

  nextTrack(): void {
    this.composer.nextTrack();
  }

  playSfx(name: SfxName, opts: SfxOptions): void {
    if (this.ctx.state === 'running') this.sfx.play(name, opts, this.composer.key());
  }

  /** Applies volumes and mute with short ramps (no clicks). */
  applyLevels(): void {
    const { volumes, muted } = this.state;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(muted ? 0 : volumes.master, now, RAMP);
    this.music.gain.setTargetAtTime(volumes.music * MUSIC_TRIM, now, RAMP);
    this.psalmOut.gain.setTargetAtTime(volumes.music * PSALM_TRIM, now, RAMP);
    this.effects.gain.setTargetAtTime(volumes.sfx * SFX_TRIM, now, RAMP);
  }

  setHeartRate(bpm: number | null): void {
    const now = this.ctx.currentTime;
    this.heart.set(bpm, now);
    if (bpm === null) this.pulse?.gain.setTargetAtTime(0, now, 0.1);
    else this.pulse ??= this.createPulse();
  }

  private readonly tick = (): void => {
    const started = performance.now();
    const now = this.ctx.currentTime;
    const until = now + LOOKAHEAD;
    const rendered = this.bank.renders;
    // a silent soundtrack (music at 0, or all muted) is still composed, so it returns in time and in shape,
    // but its one-shot notes are neither rendered nor played: no work for nothing on a phone
    const { muted, volumes } = this.state;
    const audible = !muted && volumes.music > 0 && volumes.master > 0;
    for (const cue of this.composer.take(now, until)) if (audible || (cue.kind !== 'inst' && cue.kind !== 'bell')) this.perform(cue);
    if (this.pulse && this.state.heartRate) {
      for (const beat of this.heart.due(now, until)) this.beat(this.pulse.gain, beat, this.state.heartRate);
    }
    // render the coming piece's notes ahead of need — its boss scale too when a boss is near —
    // a couple per tick, fewer if this tick already had to render some on the spot
    if (!audible) return;
    const piece = this.composer.upcoming;
    const { scene, intensity } = this.state.mood;
    const dark = scene === 'boss' || intensity >= 0.8;
    if (piece !== this.warmed || dark !== this.warmedDark) {
      this.warmed = piece;
      this.warmedDark = dark;
      if (piece) this.bank.prewarm(palette(piece, this.state.mood.realm, dark));
    }
    this.bank.warm(WARM_PER_TICK - (this.bank.renders - rendered), WARM_BUDGET_MS - (performance.now() - started));
  };

  private perform(cue: Cue): void {
    switch (cue.kind) {
      case 'bell':
        this.pool.play(this.kit.bell, this.musicIn, cue.at, { rate: midiToHz(cue.midi) / BELL_PRIME_HZ, level: BELL_GAIN * cue.level, rank: BELL_RANK, pan: cue.pan });
        return;
      case 'inst':
        this.instrument(cue);
        return;
      case 'hold':
        this.pool.hold(this.bank.get(cue.inst, cue.midi, cue.colour), this.channel(cue.inst), cue.at, cue.id, cue.level, cue.tau, RANK[cue.inst], cue.midi);
        return;
      case 'release':
        this.pool.release(cue.id, cue.at, cue.tau);
        return;
      case 'stop':
        this.pool.stopAll(cue.at, cue.tau);
        return;
      case 'note':
        (cue.part === 'lead' ? this.lead : this.low).note(cue, this.colour);
        return;
      case 'rest':
        (cue.part === 'lead' ? this.lead : this.low).rest(cue.at, cue.release);
        if (cue.breath) this.inhale(cue.at);
        return;
    }
  }

  private instrument(cue: InstCue): void {
    const o: PlayOptions = { level: cue.level, rank: RANK[cue.inst], midi: cue.midi };
    if (cue.dur !== undefined) {
      o.dur = cue.dur;
      o.release = RELEASE[cue.inst] ?? 0.08;
    }
    this.pool.play(this.bank.get(cue.inst, cue.midi), this.channel(cue.inst), cue.at, o);
  }

  /** The mixer channel of an instrument (made on first use): its level and stereo position. */
  private channel(inst: Inst): GainNode {
    const name = CHANNEL_OF[inst];
    let node = this.channels.get(name);
    if (!node) {
      const [level, pan] = CHANNELS[name];
      node = this.ctx.createGain();
      node.gain.value = level;
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      node.connect(panner).connect(this.psalmIn);
      this.channels.set(name, node);
    }
    return node;
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
