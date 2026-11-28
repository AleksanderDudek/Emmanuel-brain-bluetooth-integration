/**
 * Dobry bój's sound (DESIGN.md §25, builder B), synthesised live with Web Audio on the kit's context into the app's
 * master bus (kit/audio.ts `ctx`, `out`: the player's volume, the sound switch, the runner's fade) — no files, offline,
 * nothing when the sound is off.  A hall under one light, heard from the ring:
 *
 *   the hall    the crowd's murmur (two bands of filtered noise, left and right, with slow swells; it rises with the
 *               crowd's mood and in a cheer, hushes in the corner), in a hall's short reverb
 *   the fight   the bell (two strokes), gloves touching, the jab's snap, a punch's thump (to the body: duller), a kick's
 *               slap, a blocked shot (a glove's muffled thud), the slip's swish, a choice's whoosh, the takedown's mat
 *               thud, the knockdown, the referee's count (a clear wooden tick per number), the rise, the KO, the win
 *               (the crowd and the bell), the loss (quiet)
 *   the slow    the world's sound sinks: a low-pass closes over the hall and the fight, the crowd's noise slows; the
 *   motion      player's own sound stays clear — a heartbeat, the charge rising with the energy (a soft swelling chord
 *               that opens and climbs a fifth, never a meter's beep), the ready chime, the release (a whoosh and the
 *               snap back to real time)
 *
 * Every sound rises from silence and falls back to it (no clicks); cues are throttled per cue and under one budget.
 * `finish()` fades over ~2.5 s, `destroy()` lets the graph go; before `start()` and after `destroy()` every call is a
 * no-op.  The runner suspends the context on a pause; `pause()` keeps anything from being scheduled meanwhile.
 *
 * CONTRACT (lead): builder A's index.ts creates one per session, calls `start()` at play, `update()` every frame,
 * `cue()` on the sim's events, `pause`, `finish()` and `destroy()`; `padLevel` is null in the slow motion.
 */
import type { ArcadeAudio } from '../kit/audio';
import type { Phase } from './view';

export type RingCue =
  | 'bell' | 'touch' | 'jab' | 'punch' | 'body' | 'kick' | 'blocked' | 'slip' | 'whoosh' | 'takedown'
  | 'slowIn' | 'slowOut' | 'ready' | 'release' | 'down' | 'count' | 'rise' | 'ko' | 'win' | 'lose' | 'crowd';

export const RING_CUES: readonly RingCue[] = [
  'bell', 'touch', 'jab', 'punch', 'body', 'kick', 'blocked', 'slip', 'whoosh', 'takedown',
  'slowIn', 'slowOut', 'ready', 'release', 'down', 'count', 'rise', 'ko', 'win', 'lose', 'crowd',
];

export interface RingState { phase: Phase; slow: number; crowd: number; energy: number; breath: number }

/** The least time between two of the same cue (s). */
export const CUE_GAP: Readonly<Record<RingCue, number>> = {
  bell: 1.2, touch: 0.4, jab: 0.06, punch: 0.06, body: 0.06, kick: 0.08, blocked: 0.06, slip: 0.12, whoosh: 0.15, takedown: 0.5,
  slowIn: 0.6, slowOut: 0.4, ready: 0.5, release: 0.4, down: 1, count: 0.45, rise: 1, ko: 2, win: 3, lose: 3, crowd: 1.2,
};
/** Of all cues together, at most this many in any 1.5 s (a burst of events never becomes noise). */
const CUE_BUDGET = 10, CUE_WINDOW = 1.5;
/** The whole fight's level into the app's master (like the other games: rms ~0.02–0.03 at a usual volume). */
export const LEVEL = 1.5;
const FADE = 2.5;
/** The crowd's murmur at a calm mood and how much the mood adds. */
const CROWD_BASE = 0.034, CROWD_MOOD = 0.044;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
/** The world's low-pass for a depth of the slow motion (Hz): open in real time, ~650 Hz deep in it. */
export const worldCutoff = (slow: number): number => 650 + (16000 - 650) * Math.pow(1 - clamp01(slow), 2.2);
/** The charge's pitch (Hz) and brightness for an energy: up a fifth, the filter opening. */
export const chargeHz = (e: number): number => 110 * 2 ** ((7 * clamp01(e)) / 12);
export const chargeCutoff = (e: number): number => 260 + 2400 * clamp01(e) ** 1.4;

/** A hall's air: stereo noise decaying over `sec`, its highs fading faster. */
export function hallRoom(ctx: BaseAudioContext, sec = 1.7): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * sec));
  const buf = ctx.createBuffer(2, len, sr);
  const k = Math.exp(-6.9078 / (sec * 0.8 * sr));
  const pre = Math.floor(sr * 0.025);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = ch ? 0x2b9a71 : 0x6e1f03;
    let y = 0, amp = 1;
    for (let i = 0; i < len; i++) {
      if (i < pre) { d[i] = 0; continue; }
      const j = i - pre;
      const a = 1 - Math.exp((-2 * Math.PI * (4200 * Math.exp(-(j / sr) * 2) + 250)) / sr);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      y += a * (seed / 2147483648 - 1 - y);
      d[i] = y * amp * Math.min(1, j / Math.max(1, sr * 0.004));
      amp *= k;
    }
  }
  return buf;
}

interface Graph {
  ctx: BaseAudioContext;
  bus: GainNode;
  /** the world (the hall, the fight) through the slow motion's low-pass; the player's own (the heart, the charge) clear */
  world: GainNode;
  /** the world a little to the left and to the right (a blow's side: DESIGN §29 — the player's own hand, the
   *  opponent's) — null where the context has no stereo panner */
  worldL: AudioNode | null;
  worldR: AudioNode | null;
  worldF: BiquadFilterNode;
  inner: GainNode;
  verbIn: GainNode;
  crowd: GainNode;
  crowdSrc: AudioBufferSourceNode[];
  crowdF: BiquadFilterNode[];
  charge: GainNode;
  chargeF: BiquadFilterNode;
  chargeOsc: OscillatorNode[];
  noise: AudioBuffer;
  tops: AudioNode[];
}

export class RingSound {
  private g: Graph | null = null;
  private started = false;
  private paused = false;
  private finished = false;
  private destroyed = false;
  private live = new Set<AudioScheduledSourceNode>();
  private cueAt: Partial<Record<RingCue, number>> = {};
  private recent: number[] = [];
  private t = 0;
  private slow = 0;
  private energy = 0;
  private mood = 0.4;
  private swell = 0;
  private phase: Phase = 'intro';
  private beatAt = 0;
  private ctlAt = -1;
  private rng: () => number;

  constructor(readonly audio: ArcadeAudio, readonly o: { reducedMotion: boolean; rng?: () => number }) {
    let s = 0x1234567;
    this.rng = o?.rng ?? (() => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; });
  }

  /** What the ring plays now (for the tests and the console). */
  get debug(): { on: boolean; slow: number; energy: number; mood: number; paused: boolean; finished: boolean; cues: number } {
    return { on: !!this.g, slow: this.slow, energy: this.energy, mood: this.mood, paused: this.paused, finished: this.finished, cues: this.recent.length };
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
    this.ramp(this.g.bus.gain, LEVEL, now, 2);
    this.beatAt = now + 0.5;
  }

  /** a moment's sound; strength 0..1; `pan` −1 (left) … 1 (right) for a blow heard from one side (0: the middle) */
  cue(c: RingCue, strength = 1, pan = 0): void {
    const g = this.g;
    if (!g || this.paused || this.finished || this.destroyed || !(c in CUE_GAP)) return;
    const now = g.ctx.currentTime;
    if (now - (this.cueAt[c] ?? -1e9) < CUE_GAP[c]) return;
    this.recent = this.recent.filter(t => now - t < CUE_WINDOW);
    if (this.recent.length >= CUE_BUDGET) return;
    this.cueAt[c] = now;
    this.recent.push(now);
    const k = 0.45 + 0.55 * clamp01(Number.isFinite(strength) ? strength : 1);
    const at = now + 0.01;
    const r = this.rng;
    const side = Number.isFinite(pan) ? pan : 0;
    const W = side < -0.05 && g.worldL ? g.worldL : side > 0.05 && g.worldR ? g.worldR : g.world, I = g.inner;
    switch (c) {
      case 'bell':
        this.ringBell(at, 1);
        this.ringBell(at + 0.42, 0.85);
        break;
      case 'touch':
        this.thump(W, at, 150, 110, 0.05, 0.05 * k);
        this.hiss(W, at, 0.05, 'lowpass', 700, 0.02 * k);
        break;
      case 'jab':
        this.hiss(W, at, 0.045, 'bandpass', 1900 + 300 * r(), 0.07 * k, 0, 1.3);
        this.thump(W, at, 130, 80, 0.07, 0.06 * k);
        break;
      case 'punch':
        this.thump(W, at, 95, 48, 0.13, 0.13 * k);
        this.hiss(W, at, 0.07, 'lowpass', 1100, 0.07 * k);
        this.hiss(W, at, 0.03, 'bandpass', 2400, 0.03 * k);
        this.swellCrowd(0.25 * k);
        break;
      case 'body':
        this.thump(W, at, 72, 42, 0.17, 0.13 * k);
        this.hiss(W, at, 0.09, 'lowpass', 450, 0.08 * k);
        this.swellCrowd(0.2 * k);
        break;
      case 'kick':
        this.hiss(W, at, 0.05, 'bandpass', 2800, 0.09 * k, 0, 1.6);
        this.thump(W, at + 0.005, 105, 55, 0.12, 0.11 * k);
        this.swellCrowd(0.3 * k);
        break;
      case 'blocked':
        this.thump(W, at, 135, 85, 0.08, 0.06 * k);
        this.hiss(W, at, 0.06, 'lowpass', 520, 0.05 * k);
        break;
      case 'slip':
        this.hiss(W, at, 0.2, 'bandpass', 1300, 0.03 * k, 380, 1.2);
        break;
      case 'whoosh':
        this.hiss(I, at, 0.22, 'bandpass', 420, 0.025 * k, 2600, 1.1);
        break;
      case 'takedown':
        this.thump(W, at, 62, 34, 0.35, 0.16 * k);
        this.hiss(W, at, 0.3, 'lowpass', 320, 0.1 * k);
        this.swellCrowd(0.5);
        break;
      case 'slowIn':
        this.hiss(I, at, 0.7, 'lowpass', 2400, 0.03, 260, 0.8);
        this.thump(I, at + 0.05, 70, 40, 0.5, 0.04);
        break;
      case 'slowOut':
        this.hiss(I, at, 0.4, 'lowpass', 300, 0.025, 2600, 0.8);
        break;
      case 'ready':
        this.chime(I, at, 1320, 0.04);
        this.chime(I, at + 0.09, 1980, 0.025);
        break;
      case 'release':
        this.hiss(I, at, 0.32, 'bandpass', 350, 0.05, 3200, 1);
        this.hiss(I, at + 0.3, 0.03, 'highpass', 3000, 0.04);
        break;
      case 'down':
        this.thump(W, at, 70, 38, 0.3, 0.12);
        this.hiss(W, at, 0.25, 'lowpass', 350, 0.07);
        this.swellCrowd(0.6);
        break;
      case 'count':
        this.tick(W, at, 0.07 * k);
        break;
      case 'rise':
        this.chime(W, at, 523.25, 0.025);
        this.chime(W, at + 0.14, 784, 0.022);
        this.swellCrowd(0.5);
        break;
      case 'ko':
        this.ringBell(at + 0.2, 1);
        this.ringBell(at + 0.55, 0.85);
        this.ringBell(at + 0.9, 0.75);
        this.swellCrowd(0.8);
        break;
      case 'win':
        this.ringBell(at, 0.9);
        this.ringBell(at + 0.4, 0.8);
        [523.25, 659.25, 784].forEach((f, i) => this.chime(I, at + 0.6 + i * 0.12, f, 0.02));
        this.swellCrowd(0.8);
        break;
      case 'lose':
        [220, 277.18, 329.63].forEach((f, i) => this.soft(W, at + i * 0.05, f, 0.012, 2.4));
        this.swellCrowd(-0.6);
        break;
      case 'crowd':
        this.swellCrowd(0.6 * k);
        break;
    }
  }

  update(dt: number, s: RingState): void {
    const g = this.g;
    if (!g || this.paused || this.finished || this.destroyed) return;
    const step = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
    this.t += step;
    const now = g.ctx.currentTime;
    this.phase = s?.phase ?? this.phase;
    this.slow += (clamp01(s?.slow ?? 0) - this.slow) * Math.min(1, step / 0.12);
    this.energy += (clamp01(s?.energy ?? 0) - this.energy) * Math.min(1, step / 0.2);
    this.mood += (clamp01(s?.crowd ?? 0.4) - this.mood) * Math.min(1, step / 1.2);
    this.swell *= Math.exp(-step / 1.6);
    // the player's heart in the slow motion and the count: about 60 a minute, a little faster as the energy rises
    const pushing = this.phase === 'slow' || this.phase === 'count';
    const heart = pushing ? Math.max(this.slow, this.phase === 'count' ? 0.8 : 0) : 0;
    if (this.beatAt < now - 1) this.beatAt = now + 0.2;
    if (heart > 0.15 && now + 0.12 >= this.beatAt) {
      const at = Math.max(now + 0.02, this.beatAt);
      this.thump(g.inner, at, 58, 40, 0.16, 0.06 * heart);
      this.thump(g.inner, at + 0.2, 52, 38, 0.14, 0.035 * heart);
      this.beatAt = at + (1.0 - 0.18 * this.energy);
    } else if (heart <= 0.15) this.beatAt = Math.max(this.beatAt, now + 0.3);
    if (this.ctlAt < 0 || now - this.ctlAt > 0.05) {
      this.ctlAt = now;
      // the world sinks in the slow motion; the crowd's noise slows with it
      g.worldF.frequency.setTargetAtTime(worldCutoff(this.slow), now, 0.08);
      for (const src of g.crowdSrc) src.playbackRate.setTargetAtTime(1 - 0.4 * this.slow, now, 0.15);
      const calm = this.phase === 'corner' ? 0.6 : this.phase === 'end' ? 1.1 : this.phase === 'read' ? 0.85 : 1;
      const breathe = 1 + 0.22 * Math.sin(this.t * 0.21) + 0.12 * Math.sin(this.t * 0.53 + 1);
      const lvl = Math.max(0.002, (CROWD_BASE + CROWD_MOOD * this.mood) * calm * breathe * (1 + Math.max(-0.6, this.swell)));
      g.crowd.gain.setTargetAtTime(lvl, now, 0.25);
      // the charge: only in the slow motion and the count (a push), rising with the energy
      const ch = pushing ? Math.max(this.slow, this.phase === 'count' ? 1 : 0) * (0.004 + 0.016 * this.energy) : 0;
      g.charge.gain.setTargetAtTime(ch, now, 0.12);
      g.chargeF.frequency.setTargetAtTime(chargeCutoff(this.energy), now, 0.15);
      g.chargeOsc.slice(0, 3).forEach((o, i) => o.frequency.setTargetAtTime(chargeHz(this.energy) * [1, 1.5, 2.003][i], now, 0.2));
    }
  }

  pause(p: boolean): void {
    const g = this.g;
    if (!g || this.finished || this.destroyed || this.paused === p) return;
    this.paused = p;
    const now = g.ctx.currentTime;
    this.ramp(g.bus.gain, p ? 0 : LEVEL, now, p ? 0.25 : 0.6);
    if (!p) this.beatAt = Math.max(this.beatAt, now + 0.4);
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
    // the hall's reverb
    const verb = ctx.createConvolver();
    verb.normalize = true;
    verb.buffer = hallRoom(ctx);
    const verbIn = gain(1), verbOut = gain(0.55);
    verbIn.connect(verb).connect(verbOut);
    // the world: dry + its reverb, through the slow motion's low-pass
    const worldF = ctx.createBiquadFilter();
    worldF.type = 'lowpass';
    worldF.frequency.value = worldCutoff(0);
    worldF.Q.value = 0.6;
    worldF.connect(bus);
    const world = gain(1);
    world.connect(worldF);
    world.connect(gain(0.35)).connect(verbIn);
    verbOut.connect(worldF);
    // the player's own sound: clear, a touch of the hall
    const inner = gain(1);
    inner.connect(bus);
    inner.connect(gain(0.15)).connect(verbIn);
    // the noise
    const n = Math.floor(ctx.sampleRate * 2);
    const noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    let seed = 0x5a17c3;
    for (let i = 0; i < n; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; nd[i] = seed / 2147483648 - 1; }
    // the crowd: two bands, left and right, each its own loop of the noise from a different point
    // the murmur lives in the voices' band: a low-pass over it, so it never hisses
    const crowd = gain(0);
    const crowdLP = ctx.createBiquadFilter();
    crowdLP.type = 'lowpass';
    crowdLP.frequency.value = 1700;
    crowdLP.Q.value = 0.5;
    crowd.connect(crowdLP).connect(world);
    const crowdSrc: AudioBufferSourceNode[] = [], crowdF: BiquadFilterNode[] = [], lfos: OscillatorNode[] = [];
    const hasPan = typeof (ctx as AudioContext).createStereoPanner === 'function';
    [[480, 0.7, -0.5], [900, 0.9, 0.5], [260, 0.6, 0]].forEach(([f, q, pan], i) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const lvl = gain([1, 0.55, 0.8][i]);
      src.connect(bp).connect(lvl);
      // many voices: each band breathes on its own slow, uneven swell
      const lfo = ctx.createOscillator();
      lfo.frequency.value = [0.37, 0.53, 0.23][i];
      lfo.connect(gain([0.28, 0.32, 0.22][i])).connect(lvl.gain);
      lfo.start();
      lfos.push(lfo);
      if (hasPan) {
        const p = (ctx as AudioContext).createStereoPanner();
        p.pan.value = pan;
        lvl.connect(p).connect(crowd);
      } else lvl.connect(crowd);
      src.start(ctx.currentTime, i * 0.61);
      crowdSrc.push(src);
      crowdF.push(bp);
    });
    // the charge: a soft chord (root, fifth, octave) through a low-pass that opens with the energy
    const charge = gain(0);
    const chargeF = ctx.createBiquadFilter();
    chargeF.type = 'lowpass';
    chargeF.frequency.value = chargeCutoff(0);
    chargeF.Q.value = 0.9;
    chargeF.connect(charge).connect(inner);
    const chargeOsc = [1, 1.5, 2.003].map((m, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sawtooth';
      o.frequency.value = chargeHz(0) * m;
      o.detune.value = [0, 4, -5][i];
      o.connect(gain([0.6, 0.22, 0.14][i])).connect(chargeF);
      o.start();
      return o;
    });
    // a blow from one side: the world's input through a gentle pan (the hall's reverb stays wide)
    const sideOf = (v: number): AudioNode | null => {
      if (!hasPan) return null;
      const p = (ctx as AudioContext).createStereoPanner();
      p.pan.value = v;
      p.connect(world);
      return p;
    };
    const worldL = sideOf(-0.4), worldR = sideOf(0.4);
    const tops: AudioNode[] = [bus, world, worldF, inner, verbIn, verb, verbOut, crowd, crowdLP, charge, chargeF];
    if (worldL) tops.push(worldL);
    if (worldR) tops.push(worldR);
    return { ctx, bus, world, worldL, worldR, worldF, inner, verbIn, crowd, crowdSrc, crowdF, charge, chargeF, chargeOsc: [...chargeOsc, ...lfos], noise, tops };
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
    for (const s of [...this.live, ...g.crowdSrc, ...g.chargeOsc]) { try { s.stop(at); } catch { /* stopped */ } }
  }

  private env(to: AudioNode, at: number, peak: number, attack: number, dur: number): GainNode {
    const g = this.g!.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(Math.max(1e-4, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0004, at + Math.max(attack + 0.02, dur));
    g.connect(to);
    return g;
  }

  /** A low body: a sine falling in pitch (a punch's weight, the heart, the mat). */
  private thump(to: AudioNode, at: number, f0: number, f1: number, dur: number, peak: number): void {
    const ctx = this.g!.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    o.connect(this.env(to, at, peak, 0.004, dur));
    o.start(at);
    this.track(o, at + dur + 0.05);
  }

  /** Filtered noise (a snap, a slap, a swish, a whoosh), optionally sweeping. */
  private hiss(to: AudioNode, at: number, dur: number, type: BiquadFilterType, f: number, peak: number, sweepTo = 0, q = 0.8): void {
    const g = this.g!;
    const src = g.ctx.createBufferSource();
    src.buffer = g.noise;
    src.loop = true;
    const bf = g.ctx.createBiquadFilter();
    bf.type = type;
    bf.frequency.setValueAtTime(f, at);
    if (sweepTo > 0) bf.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    bf.Q.value = q;
    src.connect(bf).connect(this.env(to, at, peak, Math.min(0.006, dur / 5), dur));
    src.start(at, this.rng() * 1.5);
    this.track(src, at + dur + 0.05);
  }

  /** The ring's bell: a bright inharmonic stroke with a long ring, into the hall. */
  private ringBell(at: number, k: number): void {
    const g = this.g!;
    const out = this.env(g.world, at, 0.042 * k, 0.003, 2.2);
    out.connect(g.verbIn);
    for (const [m, a] of [[1, 1], [2.76, 0.42], [5.4, 0.16], [8.93, 0.06]] as const) {
      const o = g.ctx.createOscillator();
      o.frequency.value = 1180 * m;
      const gg = g.ctx.createGain();
      gg.gain.value = a;
      o.connect(gg).connect(out);
      o.start(at);
      this.track(o, at + 2.3);
    }
    this.hiss(g.world, at, 0.02, 'highpass', 4000, 0.03 * k);
  }

  /** A clear chime (ready, the rise, the win). */
  private chime(to: AudioNode, at: number, f: number, peak: number): void {
    const g = this.g!;
    const out = this.env(to, at, peak, 0.004, 1.2);
    for (const [m, a] of [[1, 1], [2, 0.3], [3.01, 0.12]] as const) {
      const o = g.ctx.createOscillator();
      o.frequency.value = f * m;
      const gg = g.ctx.createGain();
      gg.gain.value = a;
      o.connect(gg).connect(out);
      o.start(at);
      this.track(o, at + 1.3);
    }
  }

  /** A soft held tone (the loss's quiet chord). */
  private soft(to: AudioNode, at: number, f: number, peak: number, dur: number): void {
    const g = this.g!;
    const o = g.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(this.env(to, at, peak, 0.4, dur));
    o.start(at);
    this.track(o, at + dur + 0.1);
  }

  /** The referee's count: a short wooden tick. */
  private tick(to: AudioNode, at: number, peak: number): void {
    const g = this.g!;
    const o = g.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1650, at);
    o.frequency.exponentialRampToValueAtTime(1250, at + 0.05);
    o.connect(this.env(to, at, peak, 0.002, 0.07));
    o.start(at);
    this.track(o, at + 0.1);
    this.hiss(to, at, 0.025, 'bandpass', 3200, peak * 0.4, 0, 2);
  }

  /** The crowd rises (or hushes, negative) for a few seconds. */
  private swellCrowd(k: number): void {
    this.swell = Math.max(-0.6, Math.min(1.6, this.swell + k));
  }
}
