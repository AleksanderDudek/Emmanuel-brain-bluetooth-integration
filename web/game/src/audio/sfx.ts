/**
 * Sound effects: short, soft and consonant (major chords, pentatonic pings) — this is a game for
 * calming down, nothing harsh. Each is synthesised per call from a few primitives (enveloped
 * tones, filtered noise, bell strikes, choral chords), and all its nodes are disconnected once
 * its last source has ended. Rapid-fire effects are rate-limited and simultaneous ones capped.
 *
 * The melodic ones (combo, digest, flame, tier, fire) are tuned to the music: they take their
 * notes from the key of what is playing (the soundtrack's piece, or the chant's mode).
 */
import type { SfxName } from '../types';
import type { Key } from './arranger';
import { BELL_PRIME_HZ } from './bells';
import { clamp, midiToHz, type Vowel } from './chant';
import { degreeMidi } from './psalm';
import type { Rng } from './rng';
import { FormantBank } from './voice';

/** Material shared by all effects, rendered once at unlock. */
export interface Kit {
  ctx: BaseAudioContext;
  bell: AudioBuffer;
  noise: AudioBuffer;
  rng: Rng;
}

/** `step`: a scale step for melodic effects (the combo's length, a tier). */
export interface SfxOptions { pan?: number; pitch?: number; volume?: number; step?: number }

/**
 * How long each effect sounds (s); `every`: minimum spacing of effects the game may fire every
 * frame (≤ 8 shots, 15 seeds, 12 hits per second); `major`: rare and meaningful, never dropped.
 */
const SPEC: Readonly<Record<SfxName, { dur: number; every?: number; major?: boolean }>> = {
  eat: { dur: 0.5, every: 0.06 },
  digest: { dur: 1.2, every: 0.1 },
  shoot: { dur: 0.2, every: 1 / 8 },
  hit: { dur: 0.1, every: 1 / 12 },
  weaken: { dur: 0.6, every: 0.08 },
  hurt: { dur: 0.4, every: 0.15 },
  seed: { dur: 0.6, every: 1 / 15 },
  grace: { dur: 2.2, major: true },
  levelup: { dur: 2.5, major: true },
  door: { dur: 1.8, major: true },
  fragment: { dur: 1.5, every: 0.1 },
  boss: { dur: 4, major: true },
  revelation: { dur: 5, major: true },
  prayer_word: { dur: 0.06, every: 0.05 },
  ultimate: { dur: 3.2, major: true },
  bell: { dur: 5, major: true },
  click: { dur: 0.05, every: 0.04 },
  fall: { dur: 1.1, major: true },
  rank: { dur: 3, major: true },
  fire: { dur: 0.9, every: 0.12 },
  flame: { dur: 1.1, every: 0.15 },
  tier: { dur: 1.2, major: true },
  combo: { dur: 0.6, every: 0.05 },
};

/** Simultaneous effects beyond which minor ones are dropped. */
export const MAX_SFX_VOICES = 16;

/** Rate limiting and voice capping (kept apart from Web Audio, for testing). */
export class SfxGate {
  private readonly last = new Map<SfxName, number>();
  private ends: number[] = [];

  /** Whether `name` may sound at `now`; if so, it holds a voice for the effect's duration. */
  admit(name: SfxName, now: number): boolean {
    const { dur, every = 0, major = false } = SPEC[name];
    this.ends = this.ends.filter(end => end > now);
    if (!major) {
      const prev = this.last.get(name);
      if (prev !== undefined && now - prev < every - 1e-9) return false;
      if (this.ends.length >= MAX_SFX_VOICES) return false;
    }
    this.last.set(name, now);
    this.ends.push(now + dur);
    return true;
  }
}

/** `to`: glide to this frequency by the end */
interface ToneOptions { type?: OscillatorType; gain?: number; attack?: number; to?: number }
interface ChordOptions { type?: OscillatorType; gain?: number; attack?: number; lowpass?: number }
interface NoiseOptions { from: number; to: number; q?: number; gain?: number; attack?: number }

/** One effect: its nodes feed a gain and a panner, and are all disconnected after its last source ends. */
class Fx {
  private readonly out: GainNode;
  private readonly nodes: AudioNode[] = [];
  private live = 0;

  constructor(
    private readonly kit: Kit,
    dest: AudioNode,
    private readonly pitch: number,
    volume: number,
    pan: number,
  ) {
    this.out = this.add(kit.ctx.createGain());
    this.out.gain.value = volume;
    const panner = this.add(kit.ctx.createStereoPanner());
    panner.pan.value = clamp(pan, -1, 1);
    this.out.connect(panner).connect(dest);
  }

  /** A partial with a quick attack and an exponential decay; `to` glides its pitch. */
  tone(at: number, hz: number, dur: number, { type = 'sine', gain = 0.2, attack = 0.005, to }: ToneOptions = {}): void {
    const osc = this.osc(type, hz, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to * this.pitch, at + dur);
    osc.connect(this.envelope(at, attack, dur, gain));
    this.play(osc, at, at + dur);
  }

  /** A chord (MIDI notes) swelling in and dying away. */
  chord(at: number, notes: readonly number[], dur: number, { type = 'triangle', gain = 0.07, attack = 0.2, lowpass }: ChordOptions = {}): void {
    let dest: AudioNode = this.envelope(at, attack, dur, gain);
    if (lowpass) {
      const filter = this.filter('lowpass', lowpass, 0.7, at);
      filter.connect(dest);
      dest = filter;
    }
    for (const note of notes) {
      const osc = this.osc(type, midiToHz(note), at);
      osc.detune.value = this.kit.rng.range(-5, 5);
      osc.connect(dest);
      this.play(osc, at, at + dur);
    }
  }

  /** Band-passed noise sweeping between two frequencies: air, wind, a whoosh. */
  noise(at: number, dur: number, { from, to, q = 1, gain = 0.1, attack = dur / 3 }: NoiseOptions): void {
    const src = this.add(this.kit.ctx.createBufferSource());
    src.buffer = this.kit.noise;
    src.loop = true;
    const filter = this.filter('bandpass', from, q, at);
    filter.frequency.exponentialRampToValueAtTime(to * this.pitch, at + dur);
    const env = this.add(this.kit.ctx.createGain());
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + attack);
    env.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(filter).connect(env).connect(this.out);
    src.start(at, this.kit.rng.range(0, 1));
    this.track(src, at + dur);
  }

  /** A strike of the bell at a MIDI pitch. */
  bell(at: number, midi: number, gain: number): void {
    const src = this.add(this.kit.ctx.createBufferSource());
    src.buffer = this.kit.bell;
    const rate = (midiToHz(midi) * this.pitch) / BELL_PRIME_HZ;
    src.playbackRate.value = rate;
    const level = this.add(this.kit.ctx.createGain());
    level.gain.value = gain;
    src.connect(level).connect(this.out);
    this.play(src, at, at + this.kit.bell.duration / rate);
  }

  /** A small choir through vowel formants: one chord (MIDI) and one vowel per syllable, gliding legato. */
  choral(at: number, chords: readonly (readonly number[])[], vowels: readonly Vowel[], step: number, gain: number): void {
    const bank = new FormantBank(this.kit.ctx);
    this.nodes.push(...bank.nodes);
    const env = this.add(this.kit.ctx.createGain());
    bank.output.connect(env).connect(this.out);
    const end = at + chords.length * step;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.25);
    vowels.forEach((vowel, i) => {
      const t = at + i * step;
      bank.vowel(t, vowel, 1, 0.05);
      if (i > 0) {
        env.gain.setTargetAtTime(0.6 * gain, t - 0.03, 0.012); // consonant
        env.gain.setTargetAtTime(gain, t + 0.01, 0.04);
      }
    });
    env.gain.setTargetAtTime(0, end, 0.4);
    chords[0].forEach((note, v) => {
      const osc = this.osc('sawtooth', midiToHz(note), at);
      osc.detune.value = this.kit.rng.range(-6, 6);
      chords.forEach((chord, i) => {
        if (i > 0) osc.frequency.setTargetAtTime(midiToHz(chord[v]) * this.pitch, at + i * step, 0.04);
      });
      osc.connect(bank.input);
      this.play(osc, at, end + 2);
    });
  }

  private add<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  private osc(type: OscillatorType, hz: number, at: number): OscillatorNode {
    const osc = this.add(this.kit.ctx.createOscillator());
    osc.type = type;
    osc.frequency.setValueAtTime(hz * this.pitch, at);
    return osc;
  }

  private filter(type: BiquadFilterType, hz: number, q: number, at: number): BiquadFilterNode {
    const filter = this.add(this.kit.ctx.createBiquadFilter());
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(hz * this.pitch, at);
    return filter;
  }

  /** 0 → `gain` over `attack`, then an exponential decay that is all but silent by `at + dur`. */
  private envelope(at: number, attack: number, dur: number, gain: number): GainNode {
    const env = this.add(this.kit.ctx.createGain());
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + attack);
    env.gain.setTargetAtTime(0, at + attack, Math.max(0.005, (dur - attack) / 5));
    env.connect(this.out);
    return env;
  }

  private play(src: AudioScheduledSourceNode, start: number, stop: number): void {
    src.start(start);
    this.track(src, stop);
  }

  private track(src: AudioScheduledSourceNode, stop: number): void {
    this.live++;
    src.onended = () => {
      if (--this.live === 0) for (const node of this.nodes) node.disconnect();
    };
    src.stop(stop + 0.05);
  }
}

/** scale degrees of the tonic triad: consonant in every mode and scale */
const TRIAD = [0, 2, 4];
const I = [60, 64, 67, 72];
const IV = [60, 65, 69, 72];
const V = [59, 62, 67, 74];

/** The key melodic effects play in, when none is given: C major. */
export const DEFAULT_KEY: Key = { tonic: 72, scale: [0, 2, 4, 5, 7, 9, 11] };

/**
 * The notes (MIDI) of a melodic effect in a key, for its `step` (the combo's length, the flame's
 * number, the tier; for digest, which chord tone):
 * combo: climbing scale degrees from the octave below the tonic, two octaves at most;
 * digest: a chime on a chord tone (root, third, fifth in turn) over the tonic's open chord;
 * flame: a soft rise through a triad, a step higher with each flame (up to the fifth);
 * tier: a rising fifth, an octave higher from tier 3; fire: the burst's bright chord.
 */
export function melodicNotes(name: 'combo' | 'digest' | 'flame' | 'tier' | 'fire', step: number, key: Key): number[] {
  const at = (degree: number, octave = 0): number => degreeMidi(key.tonic + 12 * octave, key.scale, degree);
  switch (name) {
    case 'combo': return [at(Math.min(Math.max(step, 1) - 1, 14), -1)];
    case 'digest': return [at(-7, -1), at(-3, -1), at(2, -1), at(4, -1), at([0, 2, 4][((step % 3) + 3) % 3])];
    case 'flame': {
      const base = Math.min(Math.max(step, 1) - 1, 4);
      return [at(base), at(base + 2), at(base + 4)];
    }
    case 'tier': {
      const low = step >= 3 ? 7 : 0;
      return [at(low, -1), at(low + 4, -1)];
    }
    case 'fire': return [at(0), at(4), at(7), at(9)];
  }
}

/** `step`: as the game passed it (a whole number), if it did. */
interface Melodic { key: Key; step: number | undefined }
type Recipe = (fx: Fx, t: number, rng: Rng, m: Melodic) => void;

const RECIPES: Readonly<Record<SfxName, Recipe>> = {
  // a soft gulp, then a rising sparkle
  eat: (fx, t) => {
    fx.tone(t, 300, 0.12, { to: 140, gain: 0.3 });
    [84, 88, 91].forEach((m, i) => fx.tone(t + 0.09 + 0.06 * i, midiToHz(m), 0.3, { gain: 0.06 }));
  },
  // digested: a soft open chord on the key's tonic and a chime on one of its chord tones
  digest: (fx, t, rng, { key, step }) => {
    const notes = melodicNotes('digest', step ?? rng.int(0, 2), key);
    fx.chord(t, notes.slice(0, 4), 1.2, { attack: 0.18, gain: 0.055 });
    fx.tone(t + 0.12, midiToHz(notes[4]), 0.8, { gain: 0.05 });
  },
  shoot: (fx, t) => {
    fx.noise(t, 0.12, { from: 3200, to: 1500, q: 1.4, gain: 0.08, attack: 0.008 });
    fx.tone(t, midiToHz(81), 0.16, { type: 'triangle', to: midiToHz(76), gain: 0.05 });
  },
  hit: (fx, t) => fx.tone(t, 1100, 0.07, { type: 'triangle', to: 760, gain: 0.06 }),
  weaken: (fx, t) => [88, 86, 83, 81, 79].forEach((m, i) => fx.tone(t + 0.055 * i, midiToHz(m), 0.35, { gain: 0.045 })),
  hurt: (fx, t) => fx.tone(t, 130, 0.35, { to: 55, gain: 0.35, attack: 0.008 }),
  // a tiny bell, somewhere on a pentatonic scale, so a run of pickups makes a little tune
  // a seed rings on a chord tone of the playing piece, never a semitone against it
  seed: (fx, t, rng, { key }) => fx.bell(t, degreeMidi(72 + (key.tonic % 12) + 12 * rng.int(0, 1), key.scale, rng.pick(TRIAD)), 0.2),
  grace: (fx, t) => {
    fx.chord(t, [62, 66, 69, 74], 2, { attack: 0.3, gain: 0.06 });
    [86, 90, 93, 98].forEach((m, i) => fx.tone(t + 0.2 + 0.09 * i, midiToHz(m), 0.6, { gain: 0.03 }));
  },
  levelup: (fx, t) => [79, 83, 86, 91].forEach((m, i) => fx.bell(t + 0.12 * i, m, 0.22)),
  door: (fx, t) => {
    fx.noise(t, 1.1, { from: 220, to: 1400, q: 2.5, gain: 0.1 });
    fx.chord(t + 0.15, [50, 57, 62, 69], 1.6, { attack: 0.35, gain: 0.05 });
  },
  // glass: the inharmonic partials of a free bar (1 : 2.76 : 5.40)
  fragment: (fx, t) => {
    fx.tone(t, 1320, 1.3, { gain: 0.06 });
    fx.tone(t, 1320 * 2.76, 0.8, { gain: 0.025 });
    fx.tone(t, 1320 * 5.4, 0.5, { gain: 0.012 });
  },
  boss: (fx, t) => {
    fx.bell(t, 43, 0.6);
    fx.chord(t, [31, 38, 43], 3.5, { type: 'sawtooth', attack: 0.06, gain: 0.05, lowpass: 380 });
  },
  // "A-men": the plagal cadence IV → I on a broad major chord
  revelation: (fx, t) => fx.choral(t, [[41, 53, 57, 60, 65], [36, 52, 55, 60, 64]], ['a', 'e'], 1.4, 0.16),
  prayer_word: (fx, t) => fx.tone(t, 1760, 0.035, { gain: 0.02 }),
  // a rushing mighty wind (Acts 2:2), the crackle of tongues of fire, a chord
  ultimate: (fx, t, rng) => {
    fx.noise(t, 2.4, { from: 300, to: 3800, q: 0.7, gain: 0.14, attack: 0.9 });
    for (let i = 0; i < 12; i++) {
      fx.noise(t + rng.range(0.3, 1.9), 0.03, { from: rng.range(2500, 5000), to: 2000, q: 3, gain: 0.06, attack: 0.003 });
    }
    fx.chord(t + 0.4, [55, 62, 67, 71, 74], 2.6, { attack: 0.8, gain: 0.05 });
  },
  bell: (fx, t) => fx.bell(t, 55, 0.6),
  click: (fx, t) => fx.tone(t, 1500, 0.03, { type: 'triangle', gain: 0.04 }),
  fall: (fx, t) => {
    fx.tone(t, 440, 1, { to: 220, gain: 0.1, attack: 0.06 });
    fx.tone(t, 220, 1, { type: 'triangle', to: 110, gain: 0.06, attack: 0.06 });
  },
  // "Al-le-lu-i-a" on I–IV–I–V–I
  rank: (fx, t) => fx.choral(t, [I, IV, I, V, I], ['a', 'e', 'u', 'i', 'a'], 0.34, 0.14),
  // a tongue of fire: a rushing whoosh, then a bright burst on the key's chord and a crackle
  fire: (fx, t, rng, { key }) => {
    fx.noise(t, 0.4, { from: 300, to: 2800, q: 0.8, gain: 0.12, attack: 0.25 });
    melodicNotes('fire', 1, key).forEach((m, i) => fx.tone(t + 0.28 + 0.015 * i, midiToHz(m), 0.45, { type: i ? 'sine' : 'triangle', gain: 0.04 }));
    for (let i = 0; i < 3; i++) fx.noise(t + rng.range(0.3, 0.6), 0.025, { from: rng.range(2500, 4500), to: 2000, q: 3, gain: 0.04, attack: 0.003 });
  },
  // a flame of the Spirit fills: a soft chime rising through the triad
  flame: (fx, t, _rng, { key, step = 1 }) => {
    melodicNotes('flame', step, key).forEach((m, i, all) => {
      const last = i === all.length - 1;
      fx.tone(t + 0.07 * i, midiToHz(m), last ? 0.9 : 0.35, { gain: 0.045 });
      if (last) fx.tone(t + 0.07 * i, 2 * midiToHz(m), 0.5, { gain: 0.012 });
    });
  },
  // focus reached the next multiplier: a rising fifth, brighter at higher tiers
  tier: (fx, t, _rng, { key, step = 1 }) => {
    const bright = clamp((step - 1) / 4, 0, 1);
    melodicNotes('tier', step, key).forEach((m, i) => {
      const hz = midiToHz(m);
      fx.tone(t + 0.13 * i, hz, 0.7, { type: bright > 0.5 ? 'triangle' : 'sine', gain: 0.06 });
      if (bright > 0) fx.tone(t + 0.13 * i, 2 * hz, 0.45, { gain: 0.025 * bright });
      if (bright >= 1) fx.tone(t + 0.13 * i, 4 * hz, 0.3, { gain: 0.008 });
    });
  },
  // shadows eaten in a row: each one a scale step higher, a sparkle once the run is long
  combo: (fx, t, _rng, { key, step = 1 }) => {
    const hz = midiToHz(melodicNotes('combo', step, key)[0]);
    fx.tone(t, hz, 0.45, { gain: 0.085 });
    fx.tone(t, hz, 0.3, { type: 'triangle', gain: 0.03 });
    fx.tone(t, 2 * hz, 0.25, { gain: 0.025 });
    if (step >= 8) fx.tone(t + 0.05, 4 * hz, 0.2, { gain: 0.01 });
  },
};

/** Plays effects into `out`, through the gate. */
export class Sfx {
  private readonly gate = new SfxGate();

  constructor(
    private readonly kit: Kit,
    private readonly out: AudioNode,
  ) {}

  /** Plays an effect; melodic ones take their notes from `key`. */
  play(name: SfxName, { pan = 0, pitch = 1, volume = 1, step }: SfxOptions = {}, key: Key = DEFAULT_KEY): void {
    const now = this.kit.ctx.currentTime;
    if (!this.gate.admit(name, now)) return;
    // NaN-proof: `NaN || x` is x
    const fx = new Fx(this.kit, this.out, clamp(pitch || 1, 0.25, 4), clamp(volume || 0, 0, 2), pan || 0);
    const melodic = step !== undefined && Number.isFinite(step) ? clamp(Math.round(step), 0, 99) : undefined;
    RECIPES[name](fx, now + 0.005, this.kit.rng, { key, step: melodic });
  }
}
