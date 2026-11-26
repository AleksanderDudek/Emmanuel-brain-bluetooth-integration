/**
 * Ogród o świcie's soundscape (DESIGN.md §23), synthesised live with Web Audio on the kit's context into the app's
 * master bus (kit/audio.ts `ctx`, `out`: the player's volume, the sound switch, the runner's fade) — no files, offline,
 * nothing when the sound is off.  The night garden after rain turning to dawn, gentle and few:
 *
 *   the pad     slow chords in F major on soft voices (a sine, a quiet triangle a few cents apart, a soft octave; a slow
 *               rise, a long fall, drifting cents), a low root; the night walks vi–IV–I–V (Dm9, B♭maj9, Fadd9, Csus2),
 *               the blue hour IV–I–ii–V, the morning I–V/E–vi–IV–I–V; a low-pass that opens with `dawn` (and a little
 *               with the focus light), a faint high glow that rises with the light — focus is heard, never a meter
 *   the night   the rain's last drips (thinning over the first minute, gone before the blue hour), crickets (sparse
 *               chirps of a few pulses, left and right), the pond's water (filtered noise, lapping slowly)
 *   the dawn    birds — a few synthesised phrases, sparse and pretty, more as the light comes
 *   rest        the breath's soft air (rising on the in-breath, falling on the out-breath, still on a hold)
 *   cues        the moments of the way (`SoundCue`): a soft swell for a wave, a glassy drip into the vessel, a low warm
 *               tone, a small rising bell motif, paper folding, a gentle push of water, a wooden soft close and its
 *               latch, a petal-like shimmer, a stone's plop and its rings as soft bell harmonics, a small flame and a
 *               blessing bell, soil and a rising pluck, the first bird, the sun's warm swell, a cascade of bells as
 *               the flowers open, one clear bell for the name, a soft chord for grace (never a failure sound), a few
 *               quiet steps — each throttled, and all of them together kept under a budget
 *
 * Every sound rises from silence and falls back to it (no clicks); everything goes through one bus that `finish()`
 * fades over ~3 s and `destroy()` closes.  The runner suspends the context on a pause; `pause()` also keeps the
 * garden from scheduling anything until play resumes.
 *
 * CONTRACT (lead): builder B owns this file; builder A's index.ts creates one per session (`new GardenSound(env.audio,
 * { reducedMotion })`), calls `start()` at play, `update(dt, state)` every frame, `cue()` on the sim's events, `pause`,
 * `finish()` at the close's end and `destroy()`.  The meditation keeps the runner's pad quiet (`padLevel` null).
 */
import type { ArcadeAudio } from '../kit/audio';
import type { BreathPhase, BreathState } from '../kit/breath';
import type { StationId } from './stations';

/** Where the session is: the arrival, a station, the dawn (its prayer), the close (the 0–10 and the blessing). */
export type Place = 'arrive' | StationId | 'dawn' | 'close';

/** A moment's sound, from the sim's events (builder A maps them). */
export type SoundCue =
  | 'wave' | 'drop'            // lzy: a wave of feeling rises; a tear of light gathered into the vessel
  | 'warm' | 'kind'            // dlon: the hands come to rest; the kind word written in light
  | 'fold' | 'sail'            // list: the letter folds into a boat; the boat sets out
  | 'gate' | 'rose'            // furtka: the gate closes softly; the rose opens over it
  | 'stone' | 'ring'           // kamienie: the stone falls into the water; its rings spread
  | 'lantern' | 'bless'        // latarnie: a lantern lights; its blessing
  | 'seed' | 'sprout'          // nasiona: a seed sown; it sprouts in the rain of light
  | 'bird' | 'sun' | 'bloom' | 'call' // the dawn: the first bird, the sun's rim, the garden's flowers opening, the name called
  | 'grace'                    // an act the time finished gently (no focus): a soft chord, never a failure sound
  | 'step';                    // the camera walks to the next station

export interface SoundState {
  place: Place;
  /** the night (0) to the risen sun (1) */
  dawn: number;
  /** a rest block (receptive, whole breaths) */
  rest: boolean;
  /** the focus light now, 0…1 (a sighted push past its lead-in; 0 elsewhere) */
  light: number;
  /** the breath in a rest (the breath guide's), else null */
  breath: BreathState | null;
}

/** The three colours of the way's sky, each with its own progression. */
export type Mood = 'night' | 'blue' | 'morning';

/** A chord: four pad notes and a low root (MIDI). */
interface Chord { name: string; pad: readonly number[]; bass: number }
const CH: Readonly<Record<string, Chord>> = {
  I: { name: 'Fadd9', pad: [53, 57, 60, 67], bass: 41 },
  Iup: { name: 'F', pad: [57, 60, 65, 69], bass: 41 },
  ii: { name: 'Gm7', pad: [55, 58, 62, 65], bass: 43 },
  IV: { name: 'B♭maj9', pad: [50, 53, 57, 60], bass: 34 },
  V: { name: 'Csus2', pad: [55, 60, 62, 67], bass: 36 },
  V6: { name: 'C/E', pad: [55, 60, 64, 67], bass: 40 },
  vi: { name: 'Dm9', pad: [50, 57, 60, 64], bass: 38 },
};
export const PROGRESSIONS: Readonly<Record<Mood, readonly string[]>> = {
  night: ['vi', 'IV', 'I', 'V'],
  blue: ['IV', 'I', 'ii', 'V'],
  morning: ['I', 'V6', 'vi', 'IV', 'Iup', 'V'],
};
/** A chord's length (s) in each mood, before a little randomness. */
const CHORD_SEC: Readonly<Record<Mood, number>> = { night: 12, blue: 10, morning: 9 };

/** The mood for a point of the way's dawn. */
export const moodOf = (dawn: number): Mood => (dawn < 0.34 ? 'night' : dawn < 0.72 ? 'blue' : 'morning');

/** The pad's low-pass for a dawn and a focus light (Hz): dark at night, open at sunrise, a little brighter with focus. */
export const cutoffOf = (dawn: number, light: number, rest: boolean): number =>
  (320 + 1500 * clamp01(dawn) ** 2) * (1 + 0.45 * clamp01(light)) * (rest ? 0.9 : 1);

/** The least time between two of the same cue (s). */
export const CUE_GAP: Readonly<Record<SoundCue, number>> = {
  wave: 2.5, drop: 0.6, warm: 2, kind: 1.2, fold: 1.5, sail: 2.5, gate: 2, rose: 2, stone: 1.2, ring: 1.2,
  lantern: 1, bless: 1.5, seed: 0.8, sprout: 0.8, bird: 1.5, sun: 6, bloom: 1.2, call: 4, grace: 2.5, step: 1.5,
};
/** Of all cues together, at most this many in any few seconds (a burst of events never becomes noise). */
const CUE_BUDGET = 8, CUE_WINDOW = 3;

/** Scheduling: how far ahead chords are set (s); the pads' rise and fall; the finish's fade. */
const AHEAD = 0.4, PAD_ATTACK = 3.6, PAD_FALL = 1.8, FADE = 3;
const PAD_PEAK = 0.0105, BASS_PEAK = 0.02, GLOW = 0.009, WATER = 0.011;
/** The whole garden's level into the app's master (about the kit pad's loudness × 1.6: present on a phone, never music-loud). */
export const LEVEL = 1.6;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** A small seeded randomness, so a session's bed is not a pattern but a test can repeat it. */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A garden's air: stereo noise decaying to −60 dB over `sec`, its highs fading faster than its lows. */
export function gardenRoom(ctx: BaseAudioContext, sec = 3.4): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * sec));
  const buf = ctx.createBuffer(2, len, sr);
  const k = Math.exp(-6.9078 / (sec * 0.85 * sr));
  const pre = Math.floor(sr * 0.018);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = ch ? 0x51f15e : 0x2c1b3c6d;
    let y = 0, amp = 1;
    for (let i = 0; i < len; i++) {
      if (i < pre) { d[i] = 0; continue; }
      const j = i - pre;
      const a = 1 - Math.exp((-2 * Math.PI * (5200 * Math.exp(-(j / sr) * 1.3) + 300)) / sr);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      y += a * (seed / 2147483648 - 1 - y);
      d[i] = y * amp * Math.min(1, j / Math.max(1, sr * 0.005));
      amp *= k;
    }
  }
  return buf;
}

interface Voice { env: GainNode; srcs: AudioScheduledSourceNode[]; peakAt: number }

/** The graph made at `start()` (none without sound). */
interface Graph {
  ctx: BaseAudioContext;
  bus: GainNode;
  dry: GainNode;
  wet: GainNode;
  padF: BiquadFilterNode;
  padBus: GainNode;
  bassBus: GainNode;
  cueBus: GainNode;
  bedBus: GainNode;
  glow: GainNode;
  glowOsc: OscillatorNode[];
  water: GainNode;
  drift: GainNode;
  noise: AudioBuffer;
  tops: AudioNode[];
  lfos: AudioScheduledSourceNode[];
}

export class GardenSound {
  private g: Graph | null = null;
  private readonly rng: () => number;
  private readonly live = new Set<AudioScheduledSourceNode>();
  private voices: Voice[] = [];
  private started = false;
  private paused = false;
  private finished = false;
  private destroyed = false;
  private mood: Mood = 'night';
  private idx = -1;
  private chord: Chord = CH.vi;
  private chordAt = -1e9;
  private nextChordAt = 0;
  private playT = 0;
  private dawn = 0;
  private light = 0;
  private rest = false;
  private place: Place = 'arrive';
  private ctlAt = -1;
  private targets = new Map<AudioParam, number>();
  private dripAt = 0;
  private cricketAt = 0;
  private cricketSide = 1;
  private birdAt = 0;
  private breathPhase: BreathPhase | null = null;
  private cueAt: Partial<Record<SoundCue, number>> = {};
  private recent: number[] = [];

  constructor(private readonly a: ArcadeAudio, private readonly o: { reducedMotion?: boolean; rng?: () => number } = {}) {
    this.rng = o.rng ?? lcg(Math.floor(Math.random() * 0x7fffffff));
  }

  /** What the garden plays now (for the tests and the console). */
  get debug(): { on: boolean; mood: Mood; chord: string; dawn: number; cues: number; paused: boolean; finished: boolean } {
    return { on: !!this.g, mood: this.mood, chord: this.chord.name, dawn: this.dawn, cues: this.recent.length, paused: this.paused, finished: this.finished };
  }

  /** The session's play begins (the calibration has its own sound): the garden rises from silence over a few seconds. */
  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    const ctx = this.a?.ctx ?? null, out = this.a?.out ?? null;
    if (!ctx || !out) return;
    try {
      this.g = this.build(ctx, out);
    } catch (e) {
      // never an error on screen: the garden is silent instead
      console.error(e);
      this.g = null;
      return;
    }
    const now = ctx.currentTime;
    this.nextChordAt = now + 0.1;
    this.dripAt = now + 0.6;
    this.cricketAt = now + 3;
    this.birdAt = now + 4;
    this.ramp(this.g.bus.gain, LEVEL, now, 4);
    this.controls(now, 1.5);
  }

  /** Every frame. */
  update(dt: number, s: SoundState): void {
    const g = this.g;
    if (!g || this.paused || this.finished || this.destroyed) return;
    const now = g.ctx.currentTime;
    const step = Math.max(0, Math.min(0.5, Number.isFinite(dt) ? dt : 0));
    this.playT += step;
    this.dawn += (clamp01(s?.dawn ?? 0) - this.dawn) * Math.min(1, step / 2);
    this.light += (clamp01(s?.light ?? 0) - this.light) * Math.min(1, step / 0.8);
    this.rest = !!s?.rest;
    this.place = s?.place ?? this.place;
    // the sky's colour picks the progression; a new one begins soon, never over a chord that has only just come
    const mood = moodOf(this.dawn);
    if (mood !== this.mood) {
      this.mood = mood;
      this.idx = -1;
      if (now - this.chordAt > 4) this.nextChordAt = Math.min(this.nextChordAt, now + 1);
    }
    // after a long gap (a throttled tab), never a burst of what was due
    if (this.nextChordAt < now - 2) this.nextChordAt = now;
    for (const k of ['dripAt', 'cricketAt', 'birdAt'] as const) if (this[k] < now - 2) this[k] = now + 0.5;
    if (now + AHEAD >= this.nextChordAt) this.playChord(Math.max(now + 0.03, this.nextChordAt));
    this.bed(now);
    this.breathAir(now, s?.rest ? s.breath ?? null : null);
    if (this.ctlAt < 0 || now - this.ctlAt > 0.25) this.controls(now, 1.6);
  }

  /** A moment of the way, marked softly (throttled per cue, and all cues under one budget). */
  cue(c: SoundCue): void {
    const g = this.g;
    if (!g || this.paused || this.finished || this.destroyed || !(c in CUE_GAP)) return;
    const now = g.ctx.currentTime;
    if (now - (this.cueAt[c] ?? -1e9) < CUE_GAP[c]) return;
    this.recent = this.recent.filter(t => now - t < CUE_WINDOW);
    if (this.recent.length >= CUE_BUDGET) return;
    this.cueAt[c] = now;
    this.recent.push(now);
    const at = now + 0.02;
    const r = this.rng;
    const tones = (lo: number, hi: number): number[] => tonesIn(this.chord, lo, hi);
    const pick = (lo: number, hi: number): number => { const ts = tones(lo, hi); return ts[Math.floor(r() * ts.length)] ?? 72; };
    switch (c) {
      case 'wave':
        this.air(at, 3.6, 180, 700, 0.016);
        this.bell(pick(65, 77), at + 1.2, 0.008, 2.4);
        break;
      case 'drop':
        this.chirp(at, 1900, 1000, 0.06, 0.018, (r() - 0.5) * 0.4);
        this.bell(pick(84, 96), at + 0.05, 0.012, 1.4);
        break;
      case 'warm':
        this.warmTone(at, midiHz(this.chord.bass + 12), 0.03);
        break;
      case 'kind':
        tones(76, 88).slice(0, 3).forEach((m, i) => this.bell(m, at + i * 0.2, 0.016 + i * 0.002, 1.6));
        break;
      case 'fold':
        [0, 0.12, 0.27].forEach(d => this.hiss(at + d, 0.05 + r() * 0.04, 'highpass', 3000 + r() * 2000, 0.009));
        break;
      case 'sail':
        this.air(at, 2.4, 250, 650, 0.014);
        this.bell(pick(84, 93), at + 0.8, 0.008, 1.8);
        break;
      case 'gate':
        this.thock(at, 150, 95, 0.05, 0.25);
        this.hiss(at, 0.04, 'bandpass', 700, 0.01);
        this.thock(at + 0.22, 420, 380, 0.012, 0.08);
        break;
      case 'rose':
        tones(86, 98).concat(tones(86, 98).reverse()).slice(0, 5).forEach((m, i) => this.bell(m, at + i * 0.09, 0.007, 1.2));
        this.air(at, 1.6, 2000, 4000, 0.004);
        break;
      case 'stone':
        this.thock(at, 360, 120, 0.045, 0.16);
        this.hiss(at, 0.06, 'bandpass', 900, 0.012);
        this.hiss(at + 0.08, 0.12, 'highpass', 2400, 0.005);
        break;
      case 'ring':
        tones(72, 84).slice(0, 3).forEach((m, i) => this.bell(m, at + [0, 0.45, 1][i], [0.016, 0.011, 0.007][i], 2.2));
        break;
      case 'lantern':
        this.hiss(at, 0.5, 'bandpass', 500, 0.012, 1600);
        this.bell(pick(79, 91), at + 0.2, 0.006, 1.4);
        break;
      case 'bless': {
        const m = pick(77, 84);
        this.bell(m, at, 0.026, 2.6);
        this.bell(m + 7, at + 0.15, 0.01, 2.2);
        break;
      }
      case 'seed':
        this.hiss(at, 0.22, 'lowpass', 500, 0.014);
        this.thock(at, 120, 80, 0.015, 0.12);
        break;
      case 'sprout':
        tones(67, 84).slice(0, 3).forEach((m, i) => this.pluck(m, at + i * 0.14, 0.02));
        break;
      case 'bird':
        this.birdsong(at, 1.4);
        break;
      case 'sun':
        this.air(at, 5, 200, 1600, 0.012);
        tones(70, 82).slice(0, 4).forEach((m, i) => this.bell(m, at + 0.6 + i * 0.4, 0.012, 3));
        break;
      case 'bloom':
        tones(79, 96).slice(0, 4).forEach((m, i) => this.bell(m, at + i * 0.11, 0.014 * (1 - i * 0.15), 1.6));
        break;
      case 'call':
        this.bell(77, at, 0.04, 4);
        this.bell(89, at, 0.006, 3);
        break;
      case 'grace':
        tones(65, 77).slice(0, 3).forEach((m, i) => this.bell(m, at + i * 0.06, 0.012, 2.4));
        this.air(at, 2.6, 300, 800, 0.006);
        break;
      case 'step':
        this.air(at, 1.8, 300, 520, 0.006);
        this.hiss(at + 0.2, 0.05, 'bandpass', 1800, 0.004);
        this.hiss(at + 0.75, 0.05, 'bandpass', 1700, 0.004);
        break;
      default: break;
    }
  }

  /** The session paused / resumed (the runner suspends the context too): nothing is scheduled while paused. */
  pause(on: boolean): void {
    const g = this.g;
    if (!g || this.finished || this.destroyed || this.paused === on) return;
    this.paused = on;
    const now = g.ctx.currentTime;
    this.ramp(g.bus.gain, on ? 0 : LEVEL, now, on ? 0.3 : 0.8);
    if (!on) {
      // the night's small sounds wait a moment after the return; the chord carries on where it was
      this.dripAt = Math.max(this.dripAt, now + 1);
      this.cricketAt = Math.max(this.cricketAt, now + 2);
      this.birdAt = Math.max(this.birdAt, now + 2);
      this.nextChordAt = Math.max(this.nextChordAt, now + 0.5);
    }
  }

  /** The close's end: everything fades over a few seconds, then stops. */
  finish(): void {
    const g = this.g;
    if (this.finished || this.destroyed) return;
    this.finished = true;
    if (!g) return;
    const now = g.ctx.currentTime;
    this.ramp(g.bus.gain, 0, now, FADE);
    this.stopAll(now + FADE + 0.3);
  }

  /** The session's teardown: silent at once (a short fade), and the graph let go. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const g = this.g;
    if (!g) return;
    if ((g.ctx as AudioContext).state !== 'closed') {
      const now = g.ctx.currentTime;
      if (!this.finished) this.ramp(g.bus.gain, 0, now, 0.3);
      this.stopAll(now + (this.finished ? FADE + 0.3 : 0.5));
    }
    this.finished = true;
    setTimeout(() => { for (const n of g.tops) { try { n.disconnect(); } catch { /* gone */ } } }, (FADE + 1) * 1000);
  }

  // ── the graph ─────────────────────────────────────────────────

  private build(ctx: BaseAudioContext, out: AudioNode): Graph {
    const gain = (v: number): GainNode => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const bus = gain(0);
    bus.connect(out);
    const verb = ctx.createConvolver();
    verb.normalize = true;
    verb.buffer = gardenRoom(ctx);
    const wetOut = gain(0.8);
    verb.connect(wetOut).connect(bus);
    const dry = gain(1), wet = gain(1);
    dry.connect(bus);
    wet.connect(verb);
    const send = (from: AudioNode, d: number, w: number): void => {
      from.connect(gain(d)).connect(dry);
      from.connect(gain(w)).connect(wet);
    };
    // the pad: its low-pass, its bus (breathing very slowly), the low root on its own
    const padF = ctx.createBiquadFilter();
    padF.type = 'lowpass';
    padF.frequency.value = cutoffOf(0, 0, false);
    padF.Q.value = 0.5;
    const padBus = gain(0.9);
    padF.connect(padBus);
    send(padBus, 1, 0.5);
    const bassBus = gain(1);
    const bassF = ctx.createBiquadFilter();
    bassF.type = 'lowpass';
    bassF.frequency.value = 220;
    bassBus.connect(bassF);
    send(bassF, 1, 0.1);
    // the cues and the night's small sounds
    const cueBus = gain(1);
    send(cueBus, 0.8, 0.6);
    const bedBus = gain(1);
    send(bedBus, 0.6, 0.7);
    // the focus glow: two high sines over the chord, as loud as the light
    const glow = gain(0);
    send(glow, 0.3, 1);
    const glowOsc = [0, 1].map(i => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = midiHz(CH.vi.pad[3 - i] + 12);
      o.detune.value = i ? 4 : -3;
      o.connect(glow);
      o.start();
      return o;
    });
    // the pond: filtered noise lapping slowly
    const n = Math.floor(ctx.sampleRate * 2);
    const noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    let seed = 0x7a3e91;
    for (let i = 0; i < n; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; nd[i] = seed / 2147483648 - 1; }
    const pond = ctx.createBufferSource();
    pond.buffer = noise;
    pond.loop = true;
    const pondF = ctx.createBiquadFilter();
    pondF.type = 'bandpass';
    pondF.frequency.value = 420;
    pondF.Q.value = 0.7;
    const water = gain(WATER);
    pond.connect(pondF).connect(water);
    send(water, 0.6, 0.4);
    pond.start();
    // slow movement: a few cents of drift on the pad, the pad's breath, the water's lapping
    const lfo = (hz: number, depth: number, to: AudioParam): OscillatorNode => {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      o.connect(gain(depth)).connect(to);
      o.start();
      return o;
    };
    const driftOsc = ctx.createOscillator();
    driftOsc.frequency.value = 0.09;
    const drift = gain(4);
    driftOsc.connect(drift);
    driftOsc.start();
    const lfos: AudioScheduledSourceNode[] = [driftOsc, pond, ...glowOsc, lfo(0.05, 0.07, padBus.gain), lfo(0.07, 120, pondF.frequency), lfo(0.13, 0.003, water.gain)];
    return { ctx, bus, dry, wet, padF, padBus, bassBus, cueBus, bedBus, glow, glowOsc, water, drift, noise, tops: [bus, dry, wet, verb, wetOut], lfos };
  }

  /** The levels and colours, moved smoothly (only when a target really changes). */
  private controls(now: number, tau: number): void {
    const g = this.g;
    if (!g) return;
    this.ctlAt = now;
    this.toward(g.padF.frequency, cutoffOf(this.dawn, this.light, this.rest), now, 1.4);
    const close = this.place === 'close' ? 0.85 : 1;
    this.toward(g.padBus.gain, (0.85 + 0.25 * this.dawn) * close * (this.rest ? 0.92 : 1), now, tau);
    this.toward(g.glow.gain, GLOW * this.light * this.light, now, 0.6);
    this.toward(g.water.gain, WATER * (1 - 0.35 * this.dawn), now, tau);
  }

  private toward(p: AudioParam, v: number, now: number, tau: number): void {
    const last = this.targets.get(p);
    if (last !== undefined && Math.abs(last - v) <= Math.max(1e-5, Math.abs(v) * 0.02)) return;
    this.targets.set(p, v);
    p.setTargetAtTime(v, now, tau);
  }

  private ramp(p: AudioParam, v: number, now: number, s: number): void {
    const cur = p.value;
    p.cancelScheduledValues(now);
    p.setValueAtTime(cur, now);
    p.linearRampToValueAtTime(v, now + s);
    this.targets.delete(p);
  }

  private stopAll(at: number): void {
    const g = this.g;
    for (const s of [...this.live, ...(g?.lfos ?? [])]) { try { s.stop(at); } catch { /* already stopped */ } }
    this.live.clear();
    this.voices = [];
  }

  // ── the pad ───────────────────────────────────────────────────

  private playChord(at: number): void {
    const g = this.g!;
    const prog = PROGRESSIONS[this.mood];
    this.idx = (this.idx + 1) % prog.length;
    const c = CH[prog[this.idx]];
    for (const v of this.voices) this.release(v, at);
    this.voices = c.pad.map((m, i) => this.padNote(m, at, PAD_PEAK * (i === 0 ? 1.1 : 1) * (1 - (m - 50) / 80), -0.45 + (0.9 * i) / 3));
    this.voices.push(this.bassNote(c.bass, at));
    g.glowOsc.forEach((o, i) => o.frequency.setTargetAtTime(midiHz(c.pad[3 - i] + 12), at, 1.2));
    this.chord = c;
    this.chordAt = at;
    this.nextChordAt = at + CHORD_SEC[this.mood] * (0.88 + 0.24 * this.rng());
  }

  private padNote(m: number, at: number, peak: number, x: number): Voice {
    const g = this.g!;
    const hz = midiHz(m);
    const e = this.env(at, peak, PAD_ATTACK);
    e.connect(this.pan(g.padF, x));
    const a = this.osc('sine', hz, -4), b = this.osc('triangle', hz, 5), c = this.osc('sine', hz * 2, 2);
    a.connect(e);
    b.connect(this.gain(0.3)).connect(e);
    c.connect(this.gain(0.18)).connect(e);
    const srcs = [a, b, c].map(o => {
      g.drift.connect(o.detune);
      return this.src(o, at, null, () => { try { g.drift.disconnect(o.detune); } catch { /* gone */ } });
    });
    return { env: e, srcs, peakAt: at + PAD_ATTACK };
  }

  private bassNote(m: number, at: number): Voice {
    const hz = midiHz(m);
    const e = this.env(at, BASS_PEAK, 4);
    e.connect(this.g!.bassBus);
    const a = this.osc('sine', hz), b = this.osc('sine', hz * 2);
    a.connect(e);
    b.connect(this.gain(0.35)).connect(e);
    return { env: e, srcs: [this.src(a, at, null), this.src(b, at, null)], peakAt: at + 4 };
  }

  /** A chord's voices fall away (never before they have fully risen: no jump). */
  private release(v: Voice, at: number): void {
    const t = Math.max(at, v.peakAt);
    v.env.gain.setTargetAtTime(0, t, PAD_FALL);
    for (const s of v.srcs) s.stop(t + PAD_FALL * 7);
  }

  // ── the bed: drips, crickets, birds, the breath ───────────────

  private bed(now: number): void {
    const r = this.rng;
    const calm = this.o.reducedMotion ? 2 : 1;
    // the rain's last drips: thinning over the first minute, gone before the blue hour
    const night = 1 - clamp01(this.dawn / 0.45);
    if (now >= this.dripAt) {
      const rate = night * Math.max(0.08, 1.4 * Math.exp(-this.playT / 35));
      if (rate > 0.01) {
        if (r() < 0.85) this.chirp(now + 0.02, 1500 + r() * 1100, 0, 0.05, 0.004 + r() * 0.005, (r() - 0.5) * 1.4, true);
        else this.chirp(now + 0.02, 900 + r() * 300, 0, 0.07, 0.004, (r() - 0.5) * 1.2, true);
        this.dripAt = now + (0.3 + r() * 1.4) / rate * calm;
      } else this.dripAt = now + 2;
    }
    // crickets: a few pulses now and then, left and right, until the blue hour
    const crick = 1 - clamp01(this.dawn / 0.5);
    if (now >= this.cricketAt) {
      if (crick > 0.02) {
        this.cricketSide = -this.cricketSide;
        this.cricket(now + 0.02, 0.0035 * crick, this.cricketSide * (0.35 + r() * 0.3));
        this.cricketAt = now + (2.2 + r() * 3) * calm;
      } else this.cricketAt = now + 3;
    }
    // birds: from the blue hour's end, more as the sun comes; at the dawn's prayer a little more often
    const day = this.place === 'dawn' ? Math.max(0.6, clamp01((this.dawn - 0.6) / 0.4)) : clamp01((this.dawn - 0.6) / 0.4);
    if (now >= this.birdAt) {
      if (day > 0.02) {
        this.birdsong(now + 0.05, 0.6 + 0.4 * day);
        const gap = (this.place === 'close' ? 10 : 9 - 5 * day) + r() * 4;
        this.birdAt = now + gap * calm;
      } else this.birdAt = now + 3;
    }
  }

  /** The breath's soft air in a rest: rising on the in-breath, falling on the out-breath, nothing on a hold. */
  private breathAir(now: number, b: BreathState | null): void {
    if (!b) { this.breathPhase = null; return; }
    if (b.phase === this.breathPhase) return;
    const first = this.breathPhase === null;
    this.breathPhase = b.phase;
    if (b.phase !== 'in' && b.phase !== 'out') return;
    // the phase's whole length, from what is left of it (a phase met half-way plays its rest)
    const len = Math.max(1, Math.min(9, b.left / Math.max(0.1, 1 - (first ? b.p : 0))));
    if (b.phase === 'in') this.air(now + 0.02, len, 300, 900, 0.008, this.g!.bedBus);
    else this.air(now + 0.02, len, 900, 260, 0.008, this.g!.bedBus);
  }

  // ── the voices ────────────────────────────────────────────────

  private src<T extends AudioScheduledSourceNode>(node: T, at: number, stop: number | null, ended?: () => void): T {
    node.start(at);
    if (stop !== null) node.stop(stop);
    this.live.add(node);
    node.onended = () => {
      this.live.delete(node);
      try { node.disconnect(); } catch { /* gone */ }
      ended?.();
    };
    return node;
  }

  private osc(type: OscillatorType, hz: number, detune = 0): OscillatorNode {
    const o = this.g!.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = detune;
    return o;
  }

  private gain(v: number): GainNode {
    const n = this.g!.ctx.createGain();
    n.gain.value = v;
    return n;
  }

  /** A gain rising from silence to `peak` over `attack` from `at`. */
  private env(at: number, peak: number, attack: number): GainNode {
    const e = this.gain(0);
    e.gain.setValueAtTime(0, at);
    e.gain.linearRampToValueAtTime(peak, at + attack);
    return e;
  }

  private pan(to: AudioNode, x: number): AudioNode {
    const ctx = this.g!.ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (!ctx.createStereoPanner) return to;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, x));
    p.connect(to);
    return p;
  }

  /** A soft bell in the key (near-harmonic partials, a gentle strike). */
  private bell(m: number, at: number, peak: number, decay: number, bus: AudioNode = this.g!.cueBus): void {
    const hz = midiHz(m);
    const e = this.env(at, peak, 0.012);
    e.gain.setTargetAtTime(0, at + 0.02, decay / 3);
    e.connect(this.pan(bus, (this.rng() - 0.5) * 0.6));
    const end = at + decay * 2.4 + 0.05;
    for (const [mult, amp] of [[1, 1], [2, 0.28], [3.01, 0.09], [4.12, 0.04]] as const) {
      const o = this.osc('sine', hz * mult);
      o.connect(this.gain(amp)).connect(e);
      this.src(o, at, end);
    }
  }

  /** A plucked string, warm, its brightness fading fast. */
  private pluck(m: number, at: number, peak: number): void {
    const g = this.g!;
    const hz = midiHz(m);
    const e = this.env(at, peak, 0.006);
    e.gain.setTargetAtTime(0, at + 0.012, 0.9);
    const f = g.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(hz * 9, 10000), at);
    f.frequency.setTargetAtTime(Math.min(hz * 2.6, 8000), at, 0.3);
    f.connect(e);
    e.connect(this.pan(g.cueBus, (this.rng() - 0.5) * 0.5));
    const end = at + 6.4;
    for (const [mult, amp] of [[1, 1], [2, 0.36], [3, 0.14], [4, 0.05]] as const) {
      const o = this.osc('sine', hz * mult);
      o.connect(this.gain(amp)).connect(f);
      this.src(o, at, end);
    }
  }

  /** A low, warm tone that swells and settles (the hands coming to rest). */
  private warmTone(at: number, hz: number, peak: number): void {
    const g = this.g!;
    const e = this.env(at, peak, 0.9);
    e.gain.setTargetAtTime(0, at + 1, 1);
    const f = g.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    e.connect(f).connect(g.cueBus);
    const a = this.osc('sine', hz), b = this.osc('triangle', hz * 2, 3);
    a.connect(e);
    b.connect(this.gain(0.25)).connect(e);
    this.src(a, at, at + 7.5);
    this.src(b, at, at + 7.5);
  }

  /** A short tone falling in pitch: wood, a stone into water, soil. */
  private thock(at: number, f0: number, f1: number, peak: number, dur: number): void {
    const g = this.g!;
    const e = this.env(at, peak, 0.006);
    e.gain.setTargetAtTime(0, at + 0.01, dur / 3);
    const f = g.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    e.connect(f).connect(g.cueBus);
    const o = this.osc('sine', f0);
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    o.connect(e);
    this.src(o, at, at + dur * 3 + 0.1);
  }

  /** A glassy drip (a tone falling fast) or, with `f1` 0, a raindrop falling to 55 % of its pitch. */
  private chirp(at: number, f0: number, f1: number, dur: number, peak: number, x: number, bedSound = false): void {
    const g = this.g!;
    const e = this.env(at, peak, 0.004);
    e.gain.setTargetAtTime(0, at + 0.006, dur / 2.5);
    e.connect(this.pan(bedSound ? g.bedBus : g.cueBus, x));
    const o = this.osc('sine', f0);
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1 || f0 * 0.55), at + dur);
    o.connect(e);
    this.src(o, at, at + dur * 3 + 0.08);
  }

  /** A cricket: a high carrier in three or four quick pulses. */
  private cricket(at: number, peak: number, x: number): void {
    const g = this.g!;
    const hz = 4200 + this.rng() * 600;
    const pulses = 3 + (this.rng() < 0.5 ? 1 : 0);
    const e = this.gain(0);
    e.gain.setValueAtTime(0, at);
    for (let i = 0; i < pulses; i++) {
      const t = at + i * 0.042;
      e.gain.linearRampToValueAtTime(peak, t + 0.006);
      e.gain.linearRampToValueAtTime(peak * 0.7, t + 0.018);
      e.gain.linearRampToValueAtTime(0, t + 0.026);
    }
    e.connect(this.pan(g.bedBus, x));
    const o = this.osc('sine', hz);
    o.connect(e);
    this.src(o, at, at + pulses * 0.042 + 0.06);
  }

  /** A bird's short phrase: a few quick notes with glides, high and light (two kinds: a warble and a "ti-ta"). */
  private birdsong(at: number, level: number): void {
    const g = this.g!;
    const r = this.rng;
    const x = (r() - 0.5) * 1.4;
    const out = this.pan(g.bedBus, x);
    const peak = 0.006 * level;
    let t = at;
    if (r() < 0.55) {
      const n = 3 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const f0 = 2400 + r() * 1800, f1 = f0 * (0.8 + r() * 0.5), d = 0.05 + r() * 0.06;
        this.tweet(t, f0, f1, d, peak * (0.7 + 0.3 * r()), out);
        t += d + 0.03 + r() * 0.07;
      }
    } else {
      const hi = 3600 + r() * 600, lo = hi * 0.78;
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        this.tweet(t, hi, hi * 1.04, 0.07, peak, out);
        this.tweet(t + 0.11, lo, lo * 0.97, 0.09, peak * 0.85, out);
        t += 0.32;
      }
    }
  }

  private tweet(at: number, f0: number, f1: number, dur: number, peak: number, out: AudioNode): void {
    const e = this.env(at, peak, 0.008);
    e.gain.setTargetAtTime(0, at + dur * 0.6, dur / 4);
    e.connect(out);
    const o = this.osc('sine', f0);
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
    o.connect(e);
    this.src(o, at, at + dur * 2 + 0.06);
  }

  /** A breath of air: band-passed noise swelling and settling. */
  private air(at: number, dur: number, f0: number, f1: number, peak: number, bus: AudioNode = this.g!.cueBus): void {
    const g = this.g!;
    const s = g.ctx.createBufferSource();
    s.buffer = g.noise;
    s.loop = true;
    const bp = g.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur * 0.5);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, (f0 + f1) / 2), at + dur);
    const e = this.env(at, peak, dur * 0.4);
    e.gain.linearRampToValueAtTime(0, at + dur);
    s.connect(bp).connect(e).connect(bus);
    this.src(s, at, at + dur + 0.05);
  }

  /** A short noise: paper, a latch's click, a splash, soil, a flame. */
  private hiss(at: number, dur: number, type: BiquadFilterType, freq: number, peak: number, sweepTo?: number): void {
    const g = this.g!;
    const s = g.ctx.createBufferSource();
    s.buffer = g.noise;
    s.loop = true;
    const f = g.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(freq, at);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    const e = this.env(at, peak, Math.min(0.03, dur / 4));
    e.gain.linearRampToValueAtTime(0, at + dur);
    s.connect(f).connect(e).connect(g.cueBus);
    this.src(s, at, at + dur + 0.05);
  }
}

/** A chord's tones (pad and root, in every octave) between `lo` and `hi` (MIDI), rising. */
export function tonesIn(c: Chord, lo: number, hi: number): number[] {
  const pcs = new Set([...c.pad, c.bass].map(m => ((m % 12) + 12) % 12));
  const out: number[] = [];
  for (let m = Math.ceil(lo); m <= hi; m++) if (pcs.has(((m % 12) + 12) % 12)) out.push(m);
  return out;
}
