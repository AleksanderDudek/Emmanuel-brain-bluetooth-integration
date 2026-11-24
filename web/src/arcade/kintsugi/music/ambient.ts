/**
 * Złote serce's own music — the founder's "piękna muzyka dla serca" — played live with Web Audio into the app's master
 * bus (kit/audio.ts `out`: the player's volume and the runner's fade; never louder than the app), no files, offline.
 * It plays score.ts: slow chords in E-flat major on soft pads (a sine and a quiet triangle per note, gently detuned,
 * a slow attack, a low-pass that opens with the meditation and a little with the light), a soft low root, a sparse
 * melody plucked on a harp or struck on a celesta, a high shimmer in the golden stages, all in a long, dark reverb
 * made here from shaped noise.  Every sound rises from silence and falls back to it (no clicks).
 *
 * It is the session's ambient bus (kit/music.ts AmbientBus): `mix(level, s)` lowers it fully under a YouTube track
 * and brings it back.  The meditation's moments are marked by small cues — a bell in the key as a piece settles
 * (`place`) or a seam fills with gold (`seam`, climbing the chord), a breath of air with two drops as a piece is
 * washed (`clean`), a lift, a bloom of the chord, and the heartbeat (`beat`: lub-dub, low, felt more than heard).
 * The cues stay (softer) under a track, and stay in "silence" (then nothing else plays).
 */
import type { AmbientBus } from '../../kit/music';
import {
  CHORDS, MOODS, PROGRESSIONS, chordLen, chordTonesIn, melodyPool, midiHz, nextIndex, nextNote, phrase, type Chord, type MoodSpec,
} from './score';
import type { MusicCue, MusicMood, MusicStage } from './types';

/** How far ahead notes are scheduled (s). */
const AHEAD = 0.4;
/** The pads: a slow rise, a long fall, crossfading from chord to chord. */
const PAD_ATTACK = 3.2, PAD_FALL = 1.8;
/** The whole music's loudness (into the app's master), and each part's. */
const MASTER = 2.6;
const PAD_GAIN = 0.024, BASS_GAIN = 0.036, MEL_GAIN = 0.05, SHIM_GAIN = 0.008;
/** The reverb's length (s). */
const VERB_SEC = 5.2;
/** The cues' loudness alone (under a track: 60 % of it). */
const CUE = 1.3;
/** The least time between two of the same cue (s). */
const CUE_GAP: Readonly<Record<MusicCue, number>> = { lift: 0.6, clean: 1.2, place: 0.3, seam: 0.28, beat: 0.3, bloom: 2.5 };

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

interface Voice { env: GainNode; srcs: AudioScheduledSourceNode[]; peakAt: number }

/** What the ambient needs of the app's audio (kit/audio.ts ArcadeAudio). */
export interface AudioOut { ctx: BaseAudioContext | null; out: AudioNode | null }

/** A long, dark room: stereo noise decaying to −60 dB over ~`sec`, its highs fading faster than its lows. */
export function impulse(ctx: BaseAudioContext, sec = VERB_SEC): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * sec));
  const pre = Math.floor(sr * 0.024);
  const buf = ctx.createBuffer(2, len, sr);
  const k = Math.exp(-6.9078 / (sec * 0.85 * sr));
  const fadeIn = Math.max(1, Math.floor(sr * 0.006));
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = ch ? 0x2545f491 : 0x9e3779b9;
    let y = 0, amp = 1, a = 0;
    for (let i = 0; i < len; i++) {
      if (i < pre) { d[i] = 0; continue; }
      const j = i - pre;
      if ((j & 31) === 0) a = 1 - Math.exp((-2 * Math.PI * (6500 * Math.exp(-(j / sr) * 1.1) + 380)) / sr);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      y += a * (seed / 2147483648 - 1 - y);
      d[i] = y * amp * Math.min(1, j / fadeIn);
      amp *= k;
    }
  }
  return buf;
}

export class HeartAmbient implements AmbientBus {
  /** The ambient on the app's audio, or null without sound (no context: the sound is off, or no Web Audio). */
  static create(audio: AudioOut | null | undefined, opts: { music: boolean; rng: () => number }): HeartAmbient | null {
    const ctx = audio?.ctx ?? null, out = audio?.out ?? null;
    if (!ctx || !out) return null;
    try {
      return new HeartAmbient(ctx, out, opts.music, opts.rng);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  private readonly lvl: GainNode[];
  private readonly duck: GainNode[];
  private readonly cueBus: GainNode;
  private readonly padF: BiquadFilterNode;
  private readonly padBus: GainNode;
  private readonly bassBus: GainNode;
  private readonly melBus: GainNode;
  private readonly shimBus: GainNode;
  private readonly cueDry: GainNode;
  private readonly cueWet: GainNode;
  private readonly tops: AudioNode[];
  private readonly lfos: OscillatorNode[];
  private readonly drift: GainNode;
  private readonly noise: AudioBuffer;
  private readonly live = new Set<AudioScheduledSourceNode>();
  private voices: Voice[] = [];
  private stage: MusicStage = 'arrive';
  private idx = -1;
  private chord: Chord = CHORDS.vi;
  private chordAt = -1e9;
  private nextChordAt = 0;
  private nextPhraseAt = 0;
  private lastNote: number | null = null;
  private light = 0;
  private rest = false;
  private mixLevel = 1;
  private started = false;
  private stopped = false;
  private ctlAt = -1;
  private targets = new Map<AudioParam, number>();
  private cueAt: Record<MusicCue, number> = { lift: -9, clean: -9, place: -9, seam: -9, beat: -9, bloom: -9 };
  private seamStep = 0;

  private constructor(private readonly ctx: BaseAudioContext, out: AudioNode, private readonly music: boolean, private readonly rng: () => number) {
    const g = (v = 1): GainNode => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const verb = ctx.createConvolver();
    verb.normalize = true;
    verb.buffer = impulse(ctx);
    const wet = g(0.85);
    verb.connect(wet).connect(out);

    // the music: a dry and a reverb path, each with the mood's level and the director's duck (set in pairs)
    const lvlDry = g(0), lvlWet = g(0), duckDry = g(1), duckWet = g(1);
    lvlDry.connect(duckDry).connect(out);
    lvlWet.connect(duckWet).connect(verb);
    this.lvl = [lvlDry, lvlWet];
    this.duck = [duckDry, duckWet];
    const send = (from: AudioNode, dry: number, wetAmt: number) => {
      from.connect(g(dry)).connect(lvlDry);
      from.connect(g(wetAmt)).connect(lvlWet);
    };

    // pads → their low-pass → a bus that breathes very slowly
    this.padF = ctx.createBiquadFilter();
    this.padF.type = 'lowpass';
    this.padF.frequency.value = MOODS.arrive.cutoff;
    this.padF.Q.value = 0.5;
    this.padBus = g(0.9);
    this.padF.connect(this.padBus);
    send(this.padBus, 1, 0.55);
    // the soft root, kept low
    this.bassBus = g(MOODS.arrive.bass);
    const bassF = ctx.createBiquadFilter();
    bassF.type = 'lowpass';
    bassF.frequency.value = 240;
    bassF.Q.value = 0.4;
    this.bassBus.connect(bassF);
    send(bassF, 1, 0.12);
    // the melody, a touch rolled off, mostly in the room
    this.melBus = g(1);
    const melF = ctx.createBiquadFilter();
    melF.type = 'lowpass';
    melF.frequency.value = 4200;
    melF.Q.value = 0.3;
    this.melBus.connect(melF);
    send(melF, 0.8, 0.75);
    // the shimmer: high, airy, trembling slowly (its level is the mood's; the tremble rides on a second gain)
    this.shimBus = g(0);
    const shimHp = ctx.createBiquadFilter();
    shimHp.type = 'highpass';
    shimHp.frequency.value = 900;
    const trem = g(0.75);
    this.shimBus.connect(shimHp).connect(trem);
    send(trem, 0.45, 1);

    // the cues: their own path, not ducked away under a track (only softened)
    this.cueBus = g(CUE);
    this.cueDry = g(0.85);
    this.cueWet = g(0.6);
    this.cueBus.connect(this.cueDry).connect(out);
    this.cueBus.connect(this.cueWet).connect(verb);

    // slow movement: a few cents of drift on every pad note, the pads' breath, the shimmer's tremble
    const lfo = (hz: number, depth: number, to: AudioParam): OscillatorNode => {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      const d = g(depth);
      o.connect(d).connect(to);
      o.start();
      return o;
    };
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.11;
    this.drift = g(4);
    drift.connect(this.drift);
    drift.start();
    this.lfos = [drift, lfo(0.06, 0.08, this.padBus.gain), lfo(0.21, 0.25, trem.gain)];

    // a second of noise for the breaths of air
    const n = Math.floor(ctx.sampleRate * 2);
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    let seed = 0x1234567;
    for (let i = 0; i < n; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; nd[i] = seed / 2147483648 - 1; }

    this.tops = [lvlDry, lvlWet, duckDry, duckWet, this.cueBus, this.cueDry, this.cueWet, wet, verb];
  }

  /** Play begins: the music rises from silence over a few seconds. */
  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    const now = this.ctx.currentTime;
    this.nextChordAt = now + 0.1;
    this.nextPhraseAt = now + 7;
    this.controls(now, 2);
  }

  /** Every frame: follow the meditation, and schedule what is due in the next moments. */
  update(dt: number, mood: MusicMood): void {
    if (!this.started || this.stopped) return;
    const now = this.ctx.currentTime;
    this.light += (clamp01(mood.light) - this.light) * Math.min(1, Math.max(0, dt) / 1.2);
    this.rest = !!mood.rest;
    if (mood.stage !== this.stage && mood.stage in MOODS) {
      this.stage = mood.stage;
      this.idx = -1;
      // the new stage's progression begins soon, never on top of a chord that has only just arrived
      if (now - this.chordAt > 5) this.nextChordAt = Math.min(this.nextChordAt, now + 1);
      this.ctlAt = -1;
    }
    // after a long gap (a throttled tab), never a burst of notes that were due
    if (this.nextChordAt < now - 2) this.nextChordAt = now;
    if (this.nextPhraseAt < now - 2) this.nextPhraseAt = now + 1;
    if (this.music) {
      if (now + AHEAD >= this.nextChordAt) this.playChord(Math.max(now + 0.03, this.nextChordAt));
      if (now + AHEAD >= this.nextPhraseAt) this.playPhrase(Math.max(now + 0.03, this.nextPhraseAt));
    }
    if (this.ctlAt < 0 || now - this.ctlAt > 0.25) this.controls(now, 2.2);
  }

  /** The director: the music's level against a track (1 alone, 0 under a track), over `seconds`. */
  mix(level: number, seconds: number): void {
    this.mixLevel = clamp01(level);
    if (this.stopped) return;
    const now = this.ctx.currentTime;
    const s = Math.max(0.05, Number.isFinite(seconds) ? seconds : 1);
    for (const d of this.duck) this.rampFromNow(d.gain, this.mixLevel, now, s);
    this.rampFromNow(this.cueBus.gain, CUE * (0.6 + 0.4 * this.mixLevel), now, s);
  }

  /** A moment of the meditation, marked softly. */
  cue(c: MusicCue): void {
    if (!this.started || this.stopped) return;
    const now = this.ctx.currentTime;
    if (now - this.cueAt[c] < CUE_GAP[c]) return;
    this.cueAt[c] = now;
    const at = now + 0.02;
    const r = this.rng;
    switch (c) {
      case 'beat': {
        const k = this.stage === 'radiance' || this.stage === 'close' ? 0.7 : 1;
        this.thump(at, 55, 41, 0.2 * k);
        this.thump(at + 0.28, 62, 47, 0.14 * k);
        break;
      }
      case 'place': {
        const tones = chordTonesIn(this.chord, 72, 84);
        this.bell(tones[Math.floor(r() * tones.length)] ?? 75, at, 0.034, 1.1);
        break;
      }
      case 'seam': {
        const tones = chordTonesIn(this.chord, 79, 91);
        this.bell(tones[this.seamStep++ % Math.max(1, tones.length)] ?? 82, at, 0.02, 0.8);
        break;
      }
      case 'clean': {
        this.air(at, 2.4, 420, 1700, 0.016);
        const tones = chordTonesIn(this.chord, 84, 96);
        if (tones.length) {
          this.bell(tones[Math.floor(r() * tones.length)], at + 0.7, 0.009, 0.5);
          this.bell(tones[Math.floor(r() * tones.length)], at + 1.25, 0.007, 0.5);
        }
        break;
      }
      case 'lift': {
        this.air(at, 1.6, 260, 900, 0.009);
        const tones = chordTonesIn(this.chord, 67, 82);
        const i = Math.floor(r() * Math.max(1, tones.length - 1));
        if (tones.length > 1) {
          this.pluck(tones[i], at, 0.55, 'harp', 1, this.cueBus);
          this.pluck(tones[i + 1], at + 0.32, 0.5, 'harp', 1.5, this.cueBus);
        }
        break;
      }
      case 'bloom': {
        this.air(at, 3.2, 300, 2400, 0.012);
        chordTonesIn(this.chord, 70, 89).slice(0, 6).forEach((m, i) => this.bell(m, at + i * 0.18, 0.026 * (1 - i * 0.1), 1.4));
        break;
      }
      default:
    }
  }

  /** The session's end or its teardown: everything falls silent in about a second, then stops. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const ctx = this.ctx;
    if ((ctx as AudioContext).state === 'closed') return;
    const now = ctx.currentTime;
    for (const n of [...this.lvl, this.cueBus]) this.rampFromNow(n.gain, 0, now, 1.2);
    const end = now + 1.5;
    for (const o of [...this.live, ...this.lfos]) { try { o.stop(end); } catch { /* already stopped */ } }
    this.live.clear();
    this.voices = [];
    setTimeout(() => { for (const n of this.tops) { try { n.disconnect(); } catch { /* gone */ } } }, 2000);
  }

  // ── the parts ─────────────────────────────────────────────────

  private playChord(at: number): void {
    const stage = this.stage;
    const spec = MOODS[stage];
    this.idx = this.idx < 0 ? 0 : nextIndex(stage, this.idx);
    const c = CHORDS[PROGRESSIONS[stage][this.idx]];
    for (const v of this.voices) this.release(v, at);
    this.voices = [];
    const n = c.pad.length;
    c.pad.forEach((m, i) => this.voices.push(this.padNote(m, at, PAD_GAIN * (i === 0 ? 1.15 : 1) * (1 - (m - 55) / 90), n > 1 ? -0.4 + (0.8 * i) / (n - 1) : 0)));
    this.voices.push(this.bassNote(c.bass, at));
    if (spec.shimmer > 0) for (const m of c.pad.slice(-2)) this.voices.push(this.shimNote(m + 24, at));
    this.chord = c;
    this.chordAt = at;
    this.nextChordAt = at + chordLen(spec, this.rng);
  }

  private playPhrase(at: number): void {
    const spec = MOODS[this.stage];
    const ph = phrase(spec, this.rng, this.rest);
    const audible = this.mixLevel > 0.05;
    // a note that falls after the next chord change is chosen against that chord
    const after = CHORDS[PROGRESSIONS[this.stage][this.idx < 0 ? 0 : nextIndex(this.stage, this.idx)]];
    ph.notes.forEach((n, i) => {
      const t = at + n.at;
      const c = t >= this.nextChordAt ? after : this.chord;
      const m = nextNote(this.lastNote, melodyPool(c, spec.range[0], spec.range[1]), c, this.rng, { last: i === ph.notes.length - 1, fall: spec.fall });
      this.lastNote = m;
      if (audible) this.pluck(m, t, n.vel, spec.voice, n.len, this.melBus);
    });
    // the golden stages: now and then a tiny glint high above
    if (audible && spec.glint > 0) {
      for (let b = 0; b < ph.next; b += spec.beat) {
        if (this.rng() >= spec.glint * (this.rest ? 0.5 : 1)) continue;
        const t = at + b;
        const tones = chordTonesIn(t >= this.nextChordAt ? after : this.chord, 86, 98);
        if (tones.length) this.pluck(tones[Math.floor(this.rng() * tones.length)], t, 0.22, 'celesta', 1, this.melBus);
      }
    }
    this.nextPhraseAt = at + ph.next;
  }

  /** The mood's levels and colours, moved smoothly (only when a target changes). */
  private controls(now: number, tau: number): void {
    this.ctlAt = now;
    const s: MoodSpec = MOODS[this.stage];
    const level = this.music ? s.level * MASTER : 0;
    for (const n of this.lvl) this.toward(n.gain, level, now, tau);
    const cutoff = s.cutoff * (0.75 + 0.6 * this.light) * (this.rest ? 0.85 : 1);
    this.toward(this.padF.frequency, cutoff, now, 1.6);
    this.toward(this.bassBus.gain, s.bass, now, tau);
    this.toward(this.shimBus.gain, s.shimmer * (this.rest ? 0.6 : 1), now, 3);
  }

  private toward(p: AudioParam, v: number, now: number, tau: number): void {
    const last = this.targets.get(p);
    if (last !== undefined && Math.abs(last - v) <= Math.max(1e-4, Math.abs(v) * 0.02)) return;
    this.targets.set(p, v);
    p.setTargetAtTime(v, now, tau);
  }

  private rampFromNow(p: AudioParam, v: number, now: number, s: number): void {
    const cur = p.value;
    p.cancelScheduledValues(now);
    p.setValueAtTime(cur, now);
    p.linearRampToValueAtTime(v, now + s);
    this.targets.delete(p);
  }

  /** Start a source at `at` (and stop it at `stop`, or later by release()); it lets go of the graph when it ends. */
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
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = detune;
    return o;
  }

  private gain(v: number): GainNode {
    const n = this.ctx.createGain();
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
    const ctx = this.ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (!ctx.createStereoPanner) return to;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, x));
    p.connect(to);
    return p;
  }

  /** One pad note: a sine, a quiet triangle a few cents apart and a soft octave, drifting together, slow to rise. */
  private padNote(m: number, at: number, peak: number, x: number): Voice {
    const hz = midiHz(m);
    const e = this.env(at, peak, PAD_ATTACK);
    e.connect(this.pan(this.padF, x));
    // the octave above gives the voice its presence (and a small speaker something to play); the stage's filter
    // lets it through as the meditation brightens
    const a = this.osc('sine', hz, -4), b = this.osc('triangle', hz, 5), c = this.osc('sine', hz * 2, 2);
    a.connect(e);
    b.connect(this.gain(0.3)).connect(e);
    c.connect(this.gain(0.2)).connect(e);
    const unhook = (o: OscillatorNode) => () => { try { this.drift.disconnect(o.detune); } catch { /* gone */ } };
    const srcs = [a, b, c].map(o => {
      this.drift.connect(o.detune);
      return this.src(o, at, null, unhook(o));
    });
    return { env: e, srcs, peakAt: at + PAD_ATTACK };
  }

  /** The root, low and round (a sine and a little of its octave). */
  private bassNote(m: number, at: number): Voice {
    const hz = midiHz(m);
    const e = this.env(at, BASS_GAIN, 3.6);
    e.connect(this.bassBus);
    const a = this.osc('sine', hz), b = this.osc('sine', hz * 2);
    const bg = this.gain(0.35);
    a.connect(e);
    b.connect(bg).connect(e);
    return { env: e, srcs: [this.src(a, at, null), this.src(b, at, null)], peakAt: at + 3.6 };
  }

  /** The shimmer: a pure high tone two octaves over a pad voice, slow to come. */
  private shimNote(m: number, at: number): Voice {
    const e = this.env(at, SHIM_GAIN, 4.5);
    e.connect(this.shimBus);
    const a = this.osc('sine', midiHz(m), 3);
    a.connect(e);
    return { env: e, srcs: [this.src(a, at, null)], peakAt: at + 4.5 };
  }

  /** A chord's voices fade away (never before they have fully risen: no jump back). */
  private release(v: Voice, at: number): void {
    const t = Math.max(at, v.peakAt);
    v.env.gain.setTargetAtTime(0, t, PAD_FALL);
    const end = t + PAD_FALL * 7;
    for (const s of v.srcs) s.stop(end);
  }

  /**
   * A plucked harp string (warm partials, a brightness that fades fast) or a celesta's struck bar (a pure tone with
   * a bright, quickly fading double octave): `len` is how long the note is meant (s); the string rings on.
   */
  private pluck(m: number, at: number, vel: number, voice: 'harp' | 'celesta', len: number, bus: AudioNode): void {
    const hz = midiHz(m);
    const harp = voice === 'harp';
    const peak = MEL_GAIN * clamp01(vel) * (harp ? 1 : 0.9) * Math.max(0.45, 1 - (m - 63) / 50);
    const e = this.env(at, peak, harp ? 0.006 : 0.004);
    const decay = harp ? 0.85 + Math.min(1.5, len) * 0.2 : 0.62;
    e.gain.setTargetAtTime(0, at + 0.012, decay);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.4;
    f.frequency.setValueAtTime(Math.min(hz * 9, 10000), at);
    f.frequency.setTargetAtTime(Math.min(hz * 2.6, 8000), at, harp ? 0.32 : 0.5);
    f.connect(e);
    e.connect(this.pan(bus, (this.rng() - 0.5) * 0.5));
    const parts: readonly (readonly [number, number])[] = harp
      ? [[1, 1], [2, 0.36], [3, 0.14], [4, 0.05]]
      : [[1, 1], [1.0016, 0.45], [2, 0.08], [4, 0.17]];
    const end = at + decay * 7 + 0.05;
    for (const [mult, amp] of parts) {
      const o = this.osc('sine', hz * mult);
      const g = this.gain(amp);
      o.connect(g).connect(f);
      this.src(o, at, end);
    }
  }

  /** A soft bell in the key (near-harmonic partials, a gentle strike), into the cues' path. */
  private bell(m: number, at: number, peak: number, decay: number): void {
    const hz = midiHz(m);
    const e = this.env(at, peak, 0.014);
    e.gain.setTargetAtTime(0, at + 0.02, decay);
    e.connect(this.pan(this.cueBus, (this.rng() - 0.5) * 0.6));
    const end = at + decay * 7 + 0.05;
    for (const [mult, amp] of [[1, 1], [2, 0.28], [3.01, 0.09], [4.12, 0.04]] as const) {
      const o = this.osc('sine', hz * mult);
      const g = this.gain(amp);
      o.connect(g).connect(e);
      this.src(o, at, end);
    }
  }

  /** A breath of air: filtered noise swelling and settling (a linear fall to silence, then it stops). */
  private air(at: number, dur: number, f0: number, f1: number, peak: number): void {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(Math.max(60, f0 * 0.8), at + dur);
    const e = this.env(at, peak, dur * 0.4);
    e.gain.linearRampToValueAtTime(0, at + dur);
    s.connect(bp).connect(e).connect(this.cueBus);
    this.src(s, at, at + dur + 0.05);
  }

  /** One beat of the heart (lub or dub): a low thump falling in pitch, with a little of its octave for small speakers. */
  private thump(at: number, f0: number, f1: number, peak: number): void {
    const e = this.env(at, peak, 0.016);
    e.gain.setTargetAtTime(0, at + 0.03, 0.075);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 210;
    lp.Q.value = 0.5;
    e.connect(lp);
    lp.connect(this.cueDry);
    lp.connect(this.gain(0.1)).connect(this.cueWet);
    const a = this.osc('sine', f0), b = this.osc('sine', f0 * 2);
    a.frequency.setValueAtTime(f0, at);
    a.frequency.exponentialRampToValueAtTime(f1, at + 0.16);
    b.frequency.setValueAtTime(f0 * 2, at);
    b.frequency.exponentialRampToValueAtTime(f1 * 2, at + 0.16);
    const bg = this.gain(0.28);
    a.connect(e);
    b.connect(bg).connect(e);
    const end = at + 0.75;
    this.src(a, at, end);
    this.src(b, at, end);
  }
}
