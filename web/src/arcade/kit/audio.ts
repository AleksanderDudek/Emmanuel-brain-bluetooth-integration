/**
 * Sound for the arcade games, synthesised with Web Audio (no files, works offline): a master
 * volume, an ambient pad whose filter opens with the player's focus, and a few small voices the
 * games combine — tones, bells, a rising combo ladder, filtered noise (splash, wind, whoosh).
 */

const PENTA = [0, 2, 4, 7, 9];

/** Frequency of the n-th step of a major pentatonic ladder from `root` (Hz). */
export const ladder = (n: number, root = 523.25): number => root * 2 ** ((PENTA[((n % 5) + 5) % 5] + 12 * Math.floor(n / 5)) / 12);

export interface PadSpec {
  /** chord tones in Hz; each is doubled with a slight detune */
  notes: number[];
  type?: OscillatorType;
  /** low-pass cutoff at no focus and at full focus (Hz) */
  dark: number;
  bright: number;
  gain?: number;
}

export class ArcadeAudio {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padGain: GainNode | null = null;
  private padVoices: OscillatorNode[] = [];
  private padSpec: PadSpec | null = null;
  private noise: AudioBuffer | null = null;

  constructor(private volume: number, private enabled: boolean) {}

  /** Call from a click (browsers allow audio only after a gesture). */
  start(): void {
    if (this.ctx || !this.enabled) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.8);
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
  }

  get on(): boolean { return this.ctx !== null; }

  /** A sustained ambient chord; `focus(level)` opens its filter. */
  pad(spec: PadSpec): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.stopPad();
    this.padSpec = spec;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = spec.dark;
    this.padFilter.Q.value = 0.7;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    this.padGain.gain.setTargetAtTime(spec.gain ?? 0.07, ctx.currentTime, 2);
    this.padFilter.connect(this.padGain).connect(this.master);
    spec.notes.forEach((f, i) => {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = spec.type ?? (i < 2 ? 'sine' : 'triangle');
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = i < 2 ? 0.22 : 0.1;
        o.connect(g).connect(this.padFilter!);
        o.start();
        this.padVoices.push(o);
      }
    });
  }

  /** Move the pad to another chord (same number of notes) over `sec`. */
  padChord(notes: number[], sec = 2): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.padVoices.forEach((o, k) => o.frequency.setTargetAtTime(notes[Math.floor(k / 2) % notes.length], ctx.currentTime, sec / 3));
  }

  /** 0..1: the pad brightens with focus. */
  focus(level: number): void {
    const ctx = this.ctx, s = this.padSpec;
    if (!ctx || !this.padFilter || !s || !Number.isFinite(level)) return;
    const l = Math.max(0, Math.min(1, level));
    this.padFilter.frequency.setTargetAtTime(s.dark + (s.bright - s.dark) * l * l, ctx.currentTime, 0.8);
  }

  private stopPad(): void {
    const ctx = this.ctx;
    for (const o of this.padVoices) { try { o.stop(ctx ? ctx.currentTime + 1.2 : 0); } catch { /* already stopped */ } }
    if (ctx && this.padGain) this.padGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    this.padVoices = [];
    this.padSpec = null;
  }

  /** A plain enveloped tone. */
  tone(freq: number, dur = 0.25, opts: { type?: OscillatorType; gain?: number; attack?: number; slideTo?: number; at?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    const a = opts.attack ?? 0.008;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.12, t + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(a + 0.02, dur));
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** A bell (three inharmonic partials), e.g. for rewards. */
  bell(freq: number, gain = 0.12, dur = 1.8, at = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + at;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(gain, t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    out.connect(this.master);
    for (const [mult, amp] of [[1, 1], [2.76, 0.28], [5.4, 0.08]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq * mult;
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  /** The n-th note of a rising combo ladder (n = streak length). */
  combo(n: number, root = 523.25, gain = 0.1): void { this.bell(ladder(Math.min(n, 19), root), gain, 1.1); }

  /** Filtered noise: splash, wind, whoosh, crumble. */
  noiseBurst(dur: number, opts: { freq?: number; q?: number; gain?: number; type?: BiquadFilterType; sweepTo?: number; at?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.15, t + Math.min(0.03, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }

  stop(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    this.stopPad();
    setTimeout(() => { void ctx.close().catch(() => undefined); }, 900);
    this.ctx = null;
    this.master = null;
  }
}
