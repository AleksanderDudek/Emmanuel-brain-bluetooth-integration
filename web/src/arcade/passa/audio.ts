/**
 * Złota passa's sound (DESIGN.md §26, builder B), synthesised live with Web Audio on the kit's context into the app's
 * master bus (kit/audio.ts `ctx`, `out`) — no files, offline, nothing when the sound is off.  The street through one
 * day, soft and low:
 *
 *   the street   morning birds (short phrases, more at dawn) and a café's murmur on the right; at noon a far city
 *                hum; in the afternoon a fountain's patter; in the evening crickets and, at the evening's cue, the
 *                church's distant bell
 *   a moment     the card arriving (a paper's rustle), the turn beginning (a whisper), the card turned (the whisper
 *                warming into a chime), the light flying up into the garland (a rising shimmer and, as the bulb
 *                lights, a small bell that climbs the day's scale with each win — the streak you can hear — wrapping
 *                after an octave and a half), the pocket (a soft slide and a thud), trust (a single low warm note), a
 *                heavy moment (the street's sound thins out and a low soft tone holds), the evening's chord, the dawn
 *   the focus    in a turn, a warm soft chord under the street opens with the focus's glow (never a meter's beep)
 *
 * Every sound rises from silence and falls back to it; cues are throttled per cue and under one budget.  `finish()`
 * fades over ~2.5 s, `destroy()` lets the graph go; before `start()` and after `destroy()` every call is a no-op.
 *
 * CONTRACT (lead): builder A's index.ts creates one per session, calls `start()` at play, `update()` every frame,
 * `cue()` on the sim's events (`n` = the light's number in the streak), `pause`, `finish()` and `destroy()`.
 */
import type { ArcadeAudio } from '../kit/audio';
import type { Phase } from './view';

export type StreetCue = 'arrive' | 'turnStart' | 'turned' | 'light' | 'carry' | 'trust' | 'heavy' | 'evening' | 'dawn';

export const STREET_CUES: readonly StreetCue[] = ['arrive', 'turnStart', 'turned', 'light', 'carry', 'trust', 'heavy', 'evening', 'dawn'];

/** The least time between two of the same cue (s). */
export const CUE_GAP: Readonly<Record<StreetCue, number>> = {
  arrive: 0.8, turnStart: 1, turned: 0.8, light: 0.6, carry: 1, trust: 1.2, heavy: 2, evening: 6, dawn: 6,
};
/** Of all cues together, at most this many in any 2 s. */
const CUE_BUDGET = 6, CUE_WINDOW = 2;
/** The whole street's level into the app's master (rms ~0.02 at a usual volume). */
export const LEVEL = 2.3;
const FADE = 2.5;
/** The flight's length (s): the bell rings as the bulb lights (A: `flying` 0 → 1 over 1.8 s). */
export const FLIGHT_S = 1.8;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const band = (a: number, b: number, x: number): number => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** The day's scale for the streak's bell: a major pentatonic from C5 over an octave and a half, then round again. */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
export const bellHz = (n: number): number => 523.25 * 2 ** (PENTA[((Math.max(1, Math.floor(n || 1)) - 1) % PENTA.length)] / 12);

/** The street's layers for a moment of the day (0 dawn … 1 night): birds, the café, the far hum, the fountain, crickets. */
export function layersAt(day: number): { birds: number; cafe: number; hum: number; fountain: number; crickets: number } {
  const d = clamp01(day);
  return {
    birds: 1 - band(0.28, 0.46, d),
    cafe: band(0.04, 0.16, d) * (1 - band(0.74, 0.9, d)),
    hum: band(0.24, 0.4, d) * (1 - band(0.66, 0.82, d)),
    fountain: band(0.48, 0.6, d) * (1 - band(0.86, 0.96, d)),
    crickets: band(0.8, 0.92, d),
  };
}

/** A small room's air: stereo noise decaying over `sec` (the street's reverb between the houses). */
function streetRoom(ctx: BaseAudioContext, sec = 1.4): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * sec));
  const buf = ctx.createBuffer(2, len, sr);
  const k = Math.exp(-6.9078 / (sec * 0.7 * sr));
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = ch ? 0x3c71a9 : 0x17b2e5;
    let y = 0, amp = 1;
    for (let i = 0; i < len; i++) {
      const a = 1 - Math.exp((-2 * Math.PI * (3600 * Math.exp(-(i / sr) * 2.5) + 300)) / sr);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      y += a * (seed / 2147483648 - 1 - y);
      d[i] = y * amp * Math.min(1, i / Math.max(1, sr * 0.006));
      amp *= k;
    }
  }
  return buf;
}

interface Graph {
  ctx: BaseAudioContext;
  bus: GainNode;
  /** the street's ambience (thinned in a heavy moment) and its low-pass; the moments' own sounds */
  amb: GainNode;
  ambF: BiquadFilterNode;
  fx: GainNode;
  verbIn: GainNode;
  cafe: GainNode;
  hum: GainNode;
  fountain: GainNode;
  warm: GainNode;
  warmF: BiquadFilterNode;
  srcs: AudioScheduledSourceNode[];
  noise: AudioBuffer;
  tops: AudioNode[];
}

export class StreetSound {
  private g: Graph | null = null;
  private started = false;
  private paused = false;
  private finished = false;
  private destroyed = false;
  private live = new Set<AudioScheduledSourceNode>();
  private cueAt: Partial<Record<StreetCue, number>> = {};
  private recent: number[] = [];
  private t = 0;
  private day = 0;
  private glow = 0;
  private phase: Phase = 'intro';
  private heavy = false;
  private thin = 0;
  private birdAt = 0;
  private cricketAt = 0;
  private ctlAt = -1;
  private rng: () => number;

  constructor(readonly audio: ArcadeAudio, readonly o: { reducedMotion: boolean; rng?: () => number }) {
    let s = 0x2f6e1d;
    this.rng = o?.rng ?? (() => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; });
  }

  /** What the street plays now (for the tests and the console). */
  get debug(): { on: boolean; day: number; glow: number; heavy: boolean; thin: number; paused: boolean; finished: boolean; cues: number } {
    return { on: !!this.g, day: this.day, glow: this.glow, heavy: this.heavy, thin: this.thin, paused: this.paused, finished: this.finished, cues: this.recent.length };
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    const ctx = this.audio?.ctx ?? null, out = this.audio?.out ?? null;
    if (!ctx || !out) return;
    try {
      this.g = this.build(ctx, out);
    } catch (e) {
      console.error(e);
      this.g = null;
      return;
    }
    const now = ctx.currentTime;
    this.ramp(this.g.bus.gain, LEVEL, now, 2.5);
    this.birdAt = now + 0.8;
    this.cricketAt = now + 1;
  }

  /** a moment's sound; `n` = the light's number in the streak (the bell climbs the scale with it) */
  cue(c: StreetCue, n = 0): void {
    const g = this.g;
    if (!g || this.paused || this.finished || this.destroyed || !(c in CUE_GAP)) return;
    const now = g.ctx.currentTime;
    if (now - (this.cueAt[c] ?? -1e9) < CUE_GAP[c]) return;
    this.recent = this.recent.filter(t => now - t < CUE_WINDOW);
    if (this.recent.length >= CUE_BUDGET) return;
    this.cueAt[c] = now;
    this.recent.push(now);
    const at = now + 0.02;
    const F = g.fx;
    switch (c) {
      case 'arrive':
        // a paper's rustle as the card comes up close
        this.hiss(F, at, 0.32, 'bandpass', 2600, 0.014, 3800, 0.9);
        this.hiss(F, at + 0.12, 0.22, 'bandpass', 1500, 0.009, 0, 1.2);
        this.heavy = false;
        break;
      case 'turnStart':
        this.hiss(F, at, 1.6, 'bandpass', 900, 0.006, 1800, 0.7, 0.6);
        break;
      case 'turned':
        // the card flips (a soft paper flap) and its whisper warms into a chime
        this.hiss(F, at, 0.16, 'bandpass', 1800, 0.016, 900, 1.1);
        this.chime(F, at + 0.08, 659.25, 0.018, 1.6);
        this.chime(F, at + 0.2, 987.77, 0.012, 1.8);
        break;
      case 'light': {
        // the light flies up (a rising shimmer), the bulb lights with the streak's bell
        this.sweep(F, at, FLIGHT_S * 0.95, 700, 2400, 0.006);
        this.bell(F, at + FLIGHT_S * 0.92, bellHz(n), 0.03);
        this.heavy = false;
        break;
      }
      case 'carry':
        // the card slides into the pocket: a soft swish, then a cloth thud as it lands
        this.hiss(F, at, 0.9, 'lowpass', 1400, 0.008, 500, 0.7, 0.3);
        this.thump(F, at + 2.5, 110, 70, 0.22, 0.05);
        this.hiss(F, at + 2.5, 0.18, 'lowpass', 700, 0.012);
        this.heavy = false;
        break;
      case 'trust':
        // a single low warm note
        this.soft(F, at, 220, 0.03, 3.2, 'triangle');
        this.soft(F, at, 440.6, 0.008, 2.6);
        break;
      case 'heavy':
        // the street thins out; a low soft tone holds under the naming
        this.heavy = true;
        this.soft(F, at, 146.83, 0.016, 6, 'sine', 1.6);
        this.soft(F, at + 0.3, 220.5, 0.006, 5.5, 'sine', 1.6);
        break;
      case 'evening':
        // the evening's chord, the church's bell far away
        [174.61, 220, 261.63, 329.63].forEach((f, i) => this.soft(F, at + i * 0.25, f, 0.012, 7, 'triangle', 2.2));
        for (let i = 0; i < 3; i++) this.churchBell(at + 1.2 + i * 2.6, 0.9 - i * 0.15);
        this.heavy = false;
        break;
      case 'dawn':
        [261.63, 392, 587.33].forEach((f, i) => this.soft(F, at + i * 0.4, f, 0.008, 6, 'sine', 2.5));
        this.birdAt = Math.min(this.birdAt, now + 1.2);
        break;
    }
  }

  update(dt: number, s: { phase: Phase; day: number; glow: number; breath: number }): void {
    const g = this.g;
    if (!g || this.paused || this.finished || this.destroyed) return;
    const step = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
    this.t += step;
    const now = g.ctx.currentTime;
    this.phase = s?.phase ?? this.phase;
    this.day = clamp01(s?.day ?? this.day);
    this.glow += (clamp01(s?.glow ?? 0) - this.glow) * Math.min(1, step / 0.4);
    const heavyNow = this.heavy && (this.phase === 'arrive' || this.phase === 'name' || this.phase === 'turn');
    this.thin += ((heavyNow ? 1 : 0) - this.thin) * Math.min(1, step / 1.5);
    const L = layersAt(this.day);
    const quiet = 1 - 0.65 * this.thin;
    // birds: a phrase now and then (more often at dawn)
    if (this.birdAt < now - 2) this.birdAt = now + 0.5;
    if (L.birds > 0.05 && now + 0.1 >= this.birdAt) {
      this.birdPhrase(Math.max(now + 0.02, this.birdAt), 0.012 * L.birds * quiet);
      this.birdAt = now + (1.6 + 3.4 * this.rng()) / (0.6 + L.birds);
    } else if (L.birds <= 0.05) this.birdAt = Math.max(this.birdAt, now + 0.5);
    // crickets: short trills, about one a second
    if (this.cricketAt < now - 2) this.cricketAt = now + 0.3;
    if (L.crickets > 0.05 && now + 0.1 >= this.cricketAt) {
      this.cricket(Math.max(now + 0.02, this.cricketAt), 0.006 * L.crickets * quiet);
      this.cricketAt = now + 0.7 + 0.6 * this.rng();
    } else if (L.crickets <= 0.05) this.cricketAt = Math.max(this.cricketAt, now + 0.3);
    if (this.ctlAt < 0 || now - this.ctlAt > 0.08) {
      this.ctlAt = now;
      const breathe = 1 + 0.18 * Math.sin(this.t * 0.17) + 0.1 * Math.sin(this.t * 0.41 + 1);
      g.cafe.gain.setTargetAtTime(0.04 * L.cafe * breathe * quiet, now, 0.6);
      g.hum.gain.setTargetAtTime(0.045 * L.hum * quiet, now, 0.8);
      g.fountain.gain.setTargetAtTime(0.02 * L.fountain * quiet, now, 0.6);
      g.ambF.frequency.setTargetAtTime(this.thin > 0.5 ? 1800 : 9000, now, 0.8);
      // the focus's warmth: only in a turn, opening with the glow
      const w = this.phase === 'turn' ? 0.0035 + 0.009 * this.glow : 0;
      g.warm.gain.setTargetAtTime(w, now, 0.35);
      g.warmF.frequency.setTargetAtTime(320 + 1600 * this.glow ** 1.3, now, 0.4);
    }
  }

  pause(p: boolean): void {
    const g = this.g;
    if (!g || this.finished || this.destroyed || this.paused === p) return;
    this.paused = p;
    const now = g.ctx.currentTime;
    this.ramp(g.bus.gain, p ? 0 : LEVEL, now, p ? 0.25 : 0.8);
    if (!p) { this.birdAt = Math.max(this.birdAt, now + 0.6); this.cricketAt = Math.max(this.cricketAt, now + 0.6); }
  }

  finish(): void {
    if (this.finished || this.destroyed) return;
    this.finished = true;
    const g = this.g;
    if (!g) return;
    const now = g.ctx.currentTime;
    this.ramp(g.bus.gain, 0, now, FADE);
    this.stopAll(now + FADE + 0.3);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const g = this.g;
    if (!g) return;
    try {
      if ((g.ctx as AudioContext).state !== 'closed') {
        const now = g.ctx.currentTime;
        if (!this.finished) this.ramp(g.bus.gain, 0, now, 0.25);
        this.stopAll(now + (this.finished ? FADE + 0.3 : 0.4));
      }
    } catch { /* the context is gone */ }
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
    verb.buffer = streetRoom(ctx);
    const verbIn = gain(1), verbOut = gain(0.5);
    verbIn.connect(verb).connect(verbOut).connect(bus);
    // the ambience through its low-pass (it closes a little when the street thins out)
    const ambF = ctx.createBiquadFilter();
    ambF.type = 'lowpass';
    ambF.frequency.value = 9000;
    ambF.Q.value = 0.5;
    ambF.connect(bus);
    const amb = gain(1);
    amb.connect(ambF);
    amb.connect(gain(0.25)).connect(verbIn);
    // the moments' sounds: clear, with the street's air
    const fx = gain(1);
    fx.connect(bus);
    fx.connect(gain(0.35)).connect(verbIn);
    const n = Math.floor(ctx.sampleRate * 2);
    const noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    let seed = 0x4b1d27;
    for (let i = 0; i < n; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; nd[i] = seed / 2147483648 - 1; }
    const hasPan = typeof (ctx as AudioContext).createStereoPanner === 'function';
    const pan = (node: AudioNode, p: number, to: AudioNode): void => {
      if (hasPan) { const pn = (ctx as AudioContext).createStereoPanner(); pn.pan.value = p; node.connect(pn).connect(to); } else node.connect(to);
    };
    const srcs: AudioScheduledSourceNode[] = [];
    const loop = (from: number): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.start(ctx.currentTime, from);
      srcs.push(s);
      return s;
    };
    const filt = (type: BiquadFilterType, f: number, q: number): BiquadFilterNode => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };
    const lfo = (hz: number, depth: number, to: AudioParam): void => {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      o.connect(gain(depth)).connect(to);
      o.start();
      srcs.push(o);
    };
    // the café's murmur on the right: two bands of voices, slowly breathing, under a low-pass (never a hiss)
    const cafe = gain(0);
    pan(cafe, 0.45, amb);
    [[520, 0.8, 0.31], [880, 1.0, 0.47]].forEach(([f, q, r], i) => {
      const lv = gain(i ? 0.5 : 1);
      loop(i * 0.7).connect(filt('bandpass', f, q)).connect(filt('lowpass', 1500, 0.5)).connect(lv).connect(cafe);
      lfo(r, 0.35, lv.gain);
    });
    // the far city's hum at noon: a deep, slow wash
    const hum = gain(0);
    const hw = gain(1);
    loop(0.3).connect(filt('lowpass', 220, 0.6)).connect(hw).connect(hum);
    lfo(0.07, 0.3, hw.gain);
    pan(hum, -0.1, amb);
    // the fountain in the afternoon: bright water patter, a little left, its flutter
    const fountain = gain(0);
    const fl = gain(1);
    loop(1.1).connect(filt('bandpass', 2600, 0.6)).connect(filt('highpass', 900, 0.5)).connect(fl).connect(fountain);
    lfo(6.3, 0.35, fl.gain);
    lfo(9.7, 0.2, fl.gain);
    pan(fountain, -0.35, amb);
    // the focus's warmth: a soft root and fifth through a low-pass that opens with the glow
    const warm = gain(0);
    const warmF = filt('lowpass', 320, 0.8);
    warmF.connect(warm).connect(fx);
    [[130.81, 'triangle', 0.7], [196, 'sine', 0.5], [261.9, 'sine', 0.25]].forEach(([f, type, a]) => {
      const o = ctx.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = f as number;
      o.connect(gain(a as number)).connect(warmF);
      o.start();
      srcs.push(o);
    });
    return { ctx, bus, amb, ambF, fx, verbIn, cafe, hum, fountain, warm, warmF, srcs, noise, tops: [bus, verb, verbIn, verbOut, ambF, amb, fx, cafe, hum, fountain, warm, warmF] };
  }

  // ── voices ───────────────────────────────────────────────────

  private ramp(p: AudioParam, v: number, at: number, sec: number): void {
    try {
      p.cancelScheduledValues(at);
      p.setTargetAtTime(v, at, Math.max(0.01, sec / 3));
    } catch { /* a closed context */ }
  }

  private track(src: AudioScheduledSourceNode, stopAt: number): void {
    this.live.add(src);
    src.onended = () => { this.live.delete(src); };
    src.stop(stopAt);
  }

  private stopAll(at: number): void {
    const g = this.g;
    if (!g) return;
    for (const s of [...this.live, ...g.srcs]) { try { s.stop(at); } catch { /* stopped */ } }
  }

  private env(to: AudioNode, at: number, peak: number, attack: number, dur: number): GainNode {
    const g = this.g!.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(Math.max(1e-4, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0003, at + Math.max(attack + 0.02, dur));
    g.connect(to);
    return g;
  }

  private thump(to: AudioNode, at: number, f0: number, f1: number, dur: number, peak: number): void {
    const ctx = this.g!.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    o.connect(this.env(to, at, peak, 0.006, dur));
    o.start(at);
    this.track(o, at + dur + 0.05);
  }

  private hiss(to: AudioNode, at: number, dur: number, type: BiquadFilterType, f: number, peak: number, sweepTo = 0, q = 0.8, attack = 0): void {
    const g = this.g!;
    const src = g.ctx.createBufferSource();
    src.buffer = g.noise;
    src.loop = true;
    const bf = g.ctx.createBiquadFilter();
    bf.type = type;
    bf.frequency.setValueAtTime(f, at);
    if (sweepTo > 0) bf.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    bf.Q.value = q;
    src.connect(bf).connect(this.env(to, at, peak, Math.max(Math.min(0.01, dur / 5), attack), dur));
    src.start(at, this.rng() * 1.5);
    this.track(src, at + dur + 0.05);
  }

  /** A soft rising shimmer (the light flying up). */
  private sweep(to: AudioNode, at: number, dur: number, f0: number, f1: number, peak: number): void {
    const g = this.g!;
    for (const [m, a, type] of [[1, 1, 'sine'], [1.5, 0.4, 'sine'], [2.01, 0.25, 'triangle']] as const) {
      const o = g.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * m, at);
      o.frequency.exponentialRampToValueAtTime(f1 * m, at + dur);
      const e = g.ctx.createGain();
      e.gain.setValueAtTime(0, at);
      e.gain.linearRampToValueAtTime(peak * a, at + dur * 0.6);
      e.gain.linearRampToValueAtTime(0, at + dur);
      e.connect(to);
      o.connect(e);
      o.start(at);
      this.track(o, at + dur + 0.05);
    }
    this.hiss(to, at, dur, 'bandpass', 3000, peak * 0.6, 6000, 1.4, dur * 0.5);
  }

  /** The streak's small bell: bright, clear, a long soft ring into the street's air. */
  private bell(to: AudioNode, at: number, f: number, peak: number): void {
    const g = this.g!;
    const out = this.env(to, at, peak, 0.003, 2.6);
    out.connect(g.verbIn);
    for (const [m, a] of [[1, 1], [2.0, 0.35], [3.01, 0.16], [4.17, 0.07]] as const) {
      const o = g.ctx.createOscillator();
      o.frequency.value = f * m;
      const gg = g.ctx.createGain();
      gg.gain.value = a;
      o.connect(gg).connect(out);
      o.start(at);
      this.track(o, at + 2.7);
    }
  }

  private chime(to: AudioNode, at: number, f: number, peak: number, dur: number): void {
    const g = this.g!;
    const out = this.env(to, at, peak, 0.01, dur);
    for (const [m, a] of [[1, 1], [2, 0.25], [3.01, 0.08]] as const) {
      const o = g.ctx.createOscillator();
      o.frequency.value = f * m;
      const gg = g.ctx.createGain();
      gg.gain.value = a;
      o.connect(gg).connect(out);
      o.start(at);
      this.track(o, at + dur + 0.1);
    }
  }

  private soft(to: AudioNode, at: number, f: number, peak: number, dur: number, type: OscillatorType = 'sine', attack = 0.5): void {
    const g = this.g!;
    const o = g.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(this.env(to, at, peak, attack, dur));
    o.start(at);
    this.track(o, at + dur + 0.1);
  }

  /** The church's bell far away: a low inharmonic stroke through the distance (a low-pass) into the air. */
  private churchBell(at: number, k: number): void {
    const g = this.g!;
    const lp = g.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.connect(g.amb);
    lp.connect(g.verbIn);
    const out = this.env(lp, at, 0.02 * k, 0.004, 4.5);
    for (const [m, a] of [[0.5, 0.6], [1, 1], [1.19, 0.5], [1.5, 0.35], [2.0, 0.3], [2.52, 0.15]] as const) {
      const o = g.ctx.createOscillator();
      o.frequency.value = 220 * m;
      const gg = g.ctx.createGain();
      gg.gain.value = a;
      o.connect(gg).connect(out);
      o.start(at);
      this.track(o, at + 4.6);
    }
  }

  /** A bird's phrase: two to five quick chirps, each a little sweep up or down. */
  private birdPhrase(at: number, peak: number): void {
    const g = this.g!;
    const n = 2 + Math.floor(this.rng() * 4);
    const base = 2600 + 1800 * this.rng();
    const pan = typeof (g.ctx as AudioContext).createStereoPanner === 'function' ? (g.ctx as AudioContext).createStereoPanner() : null;
    let to: AudioNode = g.amb;
    if (pan) { pan.pan.value = this.rng() * 1.4 - 0.7; pan.connect(g.amb); to = pan; }
    let t = at;
    for (let i = 0; i < n; i++) {
      const o = g.ctx.createOscillator();
      o.type = 'sine';
      const f0 = base * (0.9 + 0.25 * this.rng()), up = this.rng() < 0.6;
      const d = 0.05 + 0.07 * this.rng();
      o.frequency.setValueAtTime(up ? f0 * 0.8 : f0 * 1.2, t);
      o.frequency.exponentialRampToValueAtTime(up ? f0 * 1.25 : f0 * 0.85, t + d);
      o.connect(this.env(to, t, peak * (0.7 + 0.3 * this.rng()), 0.008, d));
      o.start(t);
      this.track(o, t + d + 0.03);
      t += d + 0.03 + 0.09 * this.rng();
    }
  }

  /** A cricket's trill: three or four pulses of a high tone. */
  private cricket(at: number, peak: number): void {
    const g = this.g!;
    const f = 4300 + 500 * this.rng();
    const n = 3 + Math.floor(this.rng() * 2);
    for (let i = 0; i < n; i++) {
      const t = at + i * 0.045;
      const o = g.ctx.createOscillator();
      o.frequency.value = f;
      o.connect(this.env(g.amb, t, peak, 0.004, 0.028));
      o.start(t);
      this.track(o, t + 0.04);
    }
  }
}
