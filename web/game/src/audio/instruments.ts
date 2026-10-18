/**
 * The instruments of Psalm 150 ("Praise him with the sound of the trumpet: praise him with the
 * psaltery and harp. Praise him with the timbrel and dance … upon the loud cymbals"), synthesised
 * into sample buffers. Pure DSP, no Web Audio: the engine copies a rendered note into an
 * AudioBuffer the first time it is needed and replays it from then on.
 *
 * Every render is a few tens of thousands of samples at INSTRUMENT_RATE with a handful of
 * operations per sample (a sine table instead of Math.sin, recursive envelopes instead of
 * Math.exp), so one note takes well under a millisecond on a laptop and a few on a slow phone.
 *
 *   harp   kinnor: Karplus–Strong plucked string with a fractional (all-pass) delay for tuning
 *   bass   the same string, plucked softly and low, with a sine for weight
 *   flute  halil / ney: a breathy sine with a pitch onset, delayed vibrato and breath noise
 *   shofar the ram's horn: a band-limited sawtooth scooping up to pitch, brassy filter, growl
 *   stab   a short shofar blast
 *   doum   frame drum (tof), centre stroke: a deep membrane tuned to the piece, pitch dropping
 *   tek    frame drum, rim stroke: dry, bright;  ka: the softer stroke of the other hand
 *   jingle tambourine / sistrum: metal discs (high resonators) struck a few times at once
 *   shake  a tambourine roll
 *   zil    finger cymbals (tzeltzelim): a clear inharmonic ring
 *   drone  a held tone with its fifth, rendered as a seamless loop
 */
import type { Realm } from './chant';

/** Sample rate of rendered notes: low enough to be cheap, and what every WebKit accepts. */
export const INSTRUMENT_RATE = 22050;

export type Inst =
  | 'harp' | 'bass' | 'flute' | 'shofar' | 'stab' | 'doum' | 'tek' | 'ka' | 'jingle' | 'shake' | 'zil' | 'drone';

/** Instruments rendered once, whatever the note. */
export const UNPITCHED: ReadonlySet<Inst> = new Set<Inst>(['tek', 'ka', 'jingle', 'shake', 'zil']);
/** Instruments whose buffer loops seamlessly, for held notes. */
export const LOOPED: ReadonlySet<Inst> = new Set<Inst>(['drone']);
/** Length of the drone loop, s: every partial is tuned to a whole number of cycles in it. */
export const DRONE_LOOP = 4;

const TABLE = 2048;
const SINE = Float32Array.from({ length: TABLE + 1 }, (_, i) => Math.sin((2 * Math.PI * i) / TABLE));

/** sin(2π·phase) from the table, linearly interpolated; `phase` in cycles, ≥ 0. */
function sin1(phase: number): number {
  const x = (phase - Math.floor(phase)) * TABLE;
  const i = x | 0;
  return SINE[i] + (x - i) * (SINE[i + 1] - SINE[i]);
}

/** Seeded white noise in [−1, 1) (xorshift32): renders are reproducible. */
function noise(seed: number): () => number {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2147483648 - 1;
  };
}

const hzOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
/** Per-sample multiplier of an exponential decay with time constant `tau` seconds. */
const decay = (tau: number, sr: number): number => Math.exp(-1 / (tau * sr));

/** RBJ band-pass (constant 0 dB peak gain) as a direct-form-I closure. */
function bandpass(hz: number, q: number, sr: number): (x: number) => number {
  const w = (2 * Math.PI * Math.min(hz, 0.45 * sr)) / sr;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return x => {
    const y = b0 * (x - x2) - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/** Fades in the first `attack` s and out the last `release` s (no clicks), then scales to `peak`. */
function finish(out: Float32Array, sr: number, attack: number, release: number, peak = 0.9): Float32Array<ArrayBuffer> {
  const a = Math.max(1, Math.round(attack * sr));
  const r = Math.max(1, Math.round(release * sr));
  for (let i = 0; i < a && i < out.length; i++) out[i] *= i / a;
  for (let i = 0; i < r && i < out.length; i++) out[out.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / r);
  return normalise(out, peak);
}

function normalise(out: Float32Array, peak: number): Float32Array<ArrayBuffer> {
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return out as Float32Array<ArrayBuffer>;
}

interface PluckOptions {
  /** time for the fundamental to decay by 60 dB, s */
  t60: number;
  /** passes of a gentle low-pass over the excitation: 0 = a bright pick … 3 = a soft thumb */
  soft: number;
  /** how gentle each pass is: 0.3 (dark) … 0.9 (barely filtered) */
  bright?: number;
  /** where along the string it is plucked, 0–0.5: nearer the end is brighter */
  position: number;
  seed: number;
}

/**
 * Karplus–Strong (Jaffe & Smith's extended form): a delay line one period long, filled with a
 * burst of shaped noise, fed back through a two-point average (the string's losses, which damp
 * high partials sooner) and a first-order all-pass that supplies the fractional part of the
 * period, so even high notes are in tune.
 */
function pluck(out: Float32Array, hz: number, sr: number, o: PluckOptions): void {
  const period = sr / hz;
  const length = Math.max(2, Math.floor(period - 0.6));
  const frac = period - 0.5 - length; // all-pass delay, 0.1–1.1 samples
  const c = (1 - frac) / (1 + frac);
  const g = 0.001 ** (1 / (o.t60 * hz));
  const rnd = noise(o.seed);
  const burst = Float32Array.from({ length }, () => rnd());
  const k = o.bright ?? 0.45;
  for (let pass = 0; pass < o.soft; pass++) {
    let y = burst[length - 1];
    for (let i = 0; i < length; i++) burst[i] = y += k * (burst[i] - y);
  }
  const line = new Float32Array(length);
  const shift = Math.max(1, Math.round(o.position * length));
  let mean = 0;
  for (let i = 0; i < length; i++) mean += line[i] = burst[i] - burst[(i - shift + length) % length]; // comb: the plucking point
  mean /= length;
  for (let i = 0; i < length; i++) line[i] -= mean;
  let idx = 0;
  let prev = 0;
  let apIn = 0;
  let apOut = 0;
  for (let n = 0; n < out.length; n++) {
    const x = line[idx];
    const avg = 0.5 * (x + prev);
    prev = x;
    apOut = c * (avg - apOut) + apIn;
    apIn = avg;
    line[idx] = g * apOut;
    if (++idx === length) idx = 0;
    out[n] += x;
  }
}

/** Kinnor: bright, ringing longer in the bass (4.5 s at D3) than in the treble (1.4 s at D6). */
function harp(midi: number, sr: number): Float32Array<ArrayBuffer> {
  const t60 = Math.min(4.5, Math.max(1.4, 4.5 - (midi - 50) * 0.085));
  const out = new Float32Array(Math.round(Math.min(2.6, 0.55 * t60 + 0.35) * sr));
  pluck(out, hzOf(midi), sr, { t60, soft: 1, bright: 0.7, position: 0.12, seed: midi * 7919 });
  return finish(out, sr, 0.0015, 0.12);
}

/** A low string plucked with the thumb, and a sine under it for weight. */
function bass(midi: number, sr: number): Float32Array<ArrayBuffer> {
  const hz = hzOf(midi);
  const out = new Float32Array(Math.round(1.5 * sr));
  pluck(out, hz, sr, { t60: 2.6, soft: 3, position: 0.2, seed: midi * 104729 });
  normalise(out, 0.7);
  const d = decay(0.38, sr);
  for (let n = 0, a = 0.35; n < out.length; n++, a *= d) out[n] += a * sin1((n * hz) / sr);
  return finish(out, sr, 0.004, 0.15);
}

/** Samples per control-rate update (vibrato, pitch glides, filter sweeps): 0.7 ms at INSTRUMENT_RATE. */
const BLOCK = 16;

/** One cycle of a waveform from harmonic amplitudes (and phase offsets, in table steps). */
function wavetable(amps: readonly number[], offsets: readonly number[] = []): Float32Array {
  const wave = new Float32Array(TABLE + 1);
  amps.forEach((amp, k) => {
    for (let i = 0; i <= TABLE; i++) wave[i] += amp * SINE[((k + 1) * i + (offsets[k] ?? 0)) % TABLE];
  });
  return wave;
}

/** Halil / ney: breath first ("chiff"), then a warm tone, its vibrato blooming after a moment. */
function flute(midi: number, sr: number, seconds = 2.4): Float32Array<ArrayBuffer> {
  const hz = hzOf(midi);
  const out = new Float32Array(Math.round(seconds * sr));
  const wave = wavetable([1, 0.13, 0.05], [0, 100, 300]);
  const rnd = noise(midi * 31337);
  const air = bandpass(Math.min(5000, Math.max(1200, 2.2 * hz)), 0.8, sr);
  const chiff = decay(0.035, sr);
  const attack = decay(0.045, sr);
  const fall = decay(6, sr);
  const onset = decay(0.04, sr) ** BLOCK;
  let phase = 0;
  let scoop = -25; // cents: the breath reaches the pitch from just below
  let ch = 0.3;
  let rise = 1;
  let level = 1;
  for (let b = 0; b < out.length; b += BLOCK) {
    const t = b / sr;
    const depth = 14 * Math.min(1, Math.max(0, (t - 0.2) / 0.5));
    const inc = (hz / sr) * (1 + 0.000577623 * (scoop + depth * sin1(5.1 * t))); // 2^(c/1200) ≈ 1 + c·ln2/1200
    const swell = 1 + 0.08 * Math.min(1, t / 0.8);
    scoop *= onset;
    for (let n = b, end = Math.min(out.length, b + BLOCK); n < end; n++) {
      phase += inc;
      const x = (phase - Math.floor(phase)) * TABLE;
      const i = x | 0;
      const env = (1 - rise) * swell * level;
      out[n] = env * (wave[i] + (x - i) * (wave[i + 1] - wave[i])) + (ch + 0.05 * env) * air(rnd());
      ch *= chiff;
      rise *= attack;
      level *= fall;
    }
  }
  return finish(out, sr, 0.002, 0.12);
}

/**
 * Shofar: a sawtooth (PolyBLEP, so it does not alias) that scoops up to pitch, through a
 * low-pass that opens with the breath (brass) and a nasal formant, with a growl in the attack.
 */
function shofar(midi: number, sr: number, stab: boolean): Float32Array<ArrayBuffer> {
  const hz = hzOf(midi);
  const seconds = stab ? 0.55 : 1.8;
  const out = new Float32Array(Math.round(seconds * sr));
  const rnd = noise(midi * 4099 + (stab ? 1 : 0));
  const honk = bandpass(1150, 2, sr);
  const scoopDecay = decay(stab ? 0.03 : 0.045, sr);
  const attack = decay(stab ? 0.012 : 0.025, sr);
  const body = decay(stab ? 0.16 : 40, sr);
  const growl = decay(0.25, sr);
  let scoop = stab ? -250 : -420;
  let rise = 1;
  let level = 1;
  let gr = 0.18;
  let phase = 0;
  let low = 0;
  let band = 0;
  const scoopBlock = scoopDecay ** BLOCK;
  for (let b = 0; b < out.length; b += BLOCK) {
    const t = b / sr;
    const wobble = 9 * Math.min(1, t / 0.4) * sin1(5.6 * t);
    const dt = (hz * Math.exp((scoop + wobble) * 0.000577623)) / sr;
    const growlLfo = 1 + gr * sin1(31 * t);
    const shape = stab ? level : 0.85 + 0.15 * Math.min(1, t / 0.8);
    const open = (1 - rise) * shape;
    // Chamberlin state-variable low-pass, opening with the breath
    const k = 2 * Math.sin((Math.PI * Math.min(3400, hz * (1.8 + 5 * open * open))) / sr);
    scoop *= scoopBlock;
    for (let n = b, end = Math.min(out.length, b + BLOCK); n < end; n++) {
      phase += dt;
      if (phase >= 1) phase -= 1;
      let saw = 2 * phase - 1;
      if (phase < dt) {
        const x = phase / dt;
        saw -= x + x - x * x - 1;
      } else if (phase > 1 - dt) {
        const x = (phase - 1) / dt;
        saw -= x * x + x + x + 1;
      }
      const env = (1 - rise) * (stab ? level : shape);
      low += k * band;
      band += k * (saw - low - 0.9 * band);
      out[n] = env * ((low + 0.35 * honk(saw)) * growlLfo + 0.03 * rnd());
      rise *= attack;
      level *= body;
      gr *= growl;
    }
  }
  return finish(out, sr, 0.003, stab ? 0.08 : 0.3);
}

/** Frame drum, centre stroke: the membrane's modes (1 : 1.59 : 2.14) settling in pitch, and a thump. */
function doum(midi: number, sr: number): Float32Array<ArrayBuffer> {
  const hz = hzOf(midi);
  const out = new Float32Array(Math.round(0.85 * sr));
  const rnd = noise(midi * 811);
  const slap = bandpass(1200, 0.8, sr);
  const [d1, d2, d3, dThump, dSlap, dGlide] = [0.28, 0.09, 0.05, 0.012, 0.005, 0.022].map(tau => decay(tau, sr));
  let e1 = 1;
  let e2 = 0.35;
  let e3 = 0.15;
  let thump = 0.8;
  let sl = 0.25;
  let glide = 0.6;
  let p1 = 0;
  let low = 0;
  const k = 1 - Math.exp((-2 * Math.PI * 250) / sr);
  for (let n = 0; n < out.length; n++) {
    p1 += (hz * (1 + glide)) / sr;
    const r = rnd();
    low += k * (r - low);
    out[n] = e1 * sin1(p1) + e2 * sin1(1.59 * p1) + e3 * sin1(2.14 * p1) + thump * low * 4 + sl * slap(r);
    e1 *= d1;
    e2 *= d2;
    e3 *= d3;
    thump *= dThump;
    sl *= dSlap;
    glide *= dGlide;
  }
  return finish(out, sr, 0.0015, 0.1);
}

/** Frame drum, rim strokes: band-passed noise and a ringing rim mode, short and dry. */
function rim(sr: number, soft: boolean): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.round((soft ? 0.18 : 0.22) * sr));
  const rnd = noise(soft ? 0x6b61 : 0x74656b);
  const crack = bandpass(soft ? 1700 : 3000, soft ? 0.9 : 1.2, sr);
  const [dn, dm, dm2] = (soft ? [0.016, 0.03, 0.02] : [0.01, 0.03, 0.02]).map(tau => decay(tau, sr));
  const [f1, f2] = soft ? [420, 640] : [600, 905];
  let en = soft ? 0.7 : 1;
  let em = soft ? 0.3 : 0.35;
  let em2 = 0.2;
  for (let n = 0; n < out.length; n++) {
    out[n] = en * crack(rnd()) * 3 + em * sin1((n * f1) / sr) + em2 * sin1((n * f2) / sr);
    en *= dn;
    em *= dm;
    em2 *= dm2;
  }
  return finish(out, sr, 0.0005, 0.04);
}

/** Two-pole resonators at the metal's partials, rung by `impulses` [time s, amplitude]. */
function metal(out: Float32Array, sr: number, partials: readonly (readonly [hz: number, tau: number])[], impulses: readonly (readonly [number, number])[], seed: number): void {
  const rnd = noise(seed);
  const drive = new Float32Array(out.length);
  for (const [at, amp] of impulses) {
    const start = Math.round(at * sr);
    for (let i = 0; i < 14 && start + i < out.length; i++) drive[start + i] += amp * rnd() * (1 - i / 14);
  }
  for (const [hz, tau] of partials) {
    const r = Math.exp(-1 / (tau * sr));
    const a1 = 2 * r * Math.cos((2 * Math.PI * hz) / sr);
    const a2 = -r * r;
    let y1 = 0;
    let y2 = 0;
    for (let n = 0; n < out.length; n++) {
      const y = (1 - r) * drive[n] + a1 * y1 + a2 * y2;
      y2 = y1;
      y1 = y;
      out[n] += y;
    }
  }
}

const JINGLES: readonly (readonly [number, number])[] = [[4950, 0.09], [6120, 0.08], [7230, 0.07], [8410, 0.06], [9530, 0.05]];

/** Tambourine: a few discs clashing within 15 ms. */
function jingle(sr: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.round(0.3 * sr));
  metal(out, sr, JINGLES, [[0, 1], [0.004, 0.7], [0.009, 0.55], [0.014, 0.35]], 0x6a696e);
  return finish(out, sr, 0.0005, 0.06);
}

/** A tambourine roll (sistrum): discs clashing ever faster, then settling. */
function shake(sr: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.round(0.42 * sr));
  const rnd = noise(0x736b);
  const impulses: [number, number][] = [];
  for (let t = 0; t < 0.3; t += 0.006 + 0.01 * rnd() ** 2) impulses.push([t, (0.4 + 0.6 * Math.sin((Math.PI * t) / 0.3)) * (0.6 + 0.4 * rnd())]);
  metal(out, sr, JINGLES.map(([hz, tau]) => [hz, tau * 0.6] as const), impulses, 0x7368);
  return finish(out, sr, 0.003, 0.08);
}

/** Finger cymbals: inharmonic partials, the lower ones with a slowly beating twin. */
function zil(sr: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.round(1.3 * sr));
  const partials: readonly (readonly [ratio: number, amp: number, tau: number])[] = [
    [1, 1, 1.1], [1.505, 0.55, 0.8], [2.09, 0.6, 0.6], [2.63, 0.35, 0.45], [3.17, 0.25, 0.35], [3.71, 0.15, 0.25],
  ];
  const ring = (hz: number, amp: number, tau: number): void => {
    const w = (2 * Math.PI * hz) / sr;
    const [cos, sin, d] = [Math.cos(w), Math.sin(w), decay(tau, sr)];
    let re = 1;
    let im = 0;
    for (let n = 0, a = amp; n < out.length && a > 1e-4; n++, a *= d) {
      out[n] += a * im;
      const next = re * cos - im * sin;
      im = re * sin + im * cos;
      re = next;
    }
  };
  partials.forEach(([ratio, amp, tau], i) => {
    ring(2250 * ratio, amp, tau);
    if (i < 2) ring(2250 * ratio + 2.5, 0.4 * amp, tau);
  });
  const rnd = noise(0x7a696c);
  for (let n = 0; n < 0.003 * sr; n++) out[n] += 0.6 * rnd() * (1 - n / (0.003 * sr));
  return finish(out, sr, 0.0005, 0.2);
}

/** Harmonic amplitudes of the drone per realm: Hell dark, Heaven bright. */
const DRONE_COLOUR: Readonly<Record<Realm, readonly number[]>> = {
  hell: [1, 0.5, 0.26, 0.12, 0.06, 0.03],
  earth: [1, 0.6, 0.42, 0.28, 0.2, 0.13, 0.08, 0.05, 0.03],
  heaven: [1, 0.55, 0.45, 0.32, 0.26, 0.2, 0.15, 0.1, 0.08, 0.06],
};

/**
 * The drone: the tonic and its fifth from a one-cycle wavetable, each beating slowly against a
 * twin and breathing in amplitude. Every frequency is a whole number of cycles per DRONE_LOOP,
 * so the buffer loops without a seam.
 */
function drone(midi: number, sr: number, colour: Realm): Float32Array<ArrayBuffer> {
  const n = Math.round(DRONE_LOOP * sr);
  const out = new Float32Array(n);
  const wave = wavetable(DRONE_COLOUR[colour]);
  const quant = (hz: number): number => Math.round(hz * DRONE_LOOP) / DRONE_LOOP;
  const hz = hzOf(midi);
  const f1 = quant(hz) / sr;
  const f2 = (quant(hz) + 2 / DRONE_LOOP) / sr; // beats twice per loop
  const f5 = quant(1.5 * hz) / sr;
  const breath = 1 / (DRONE_LOOP * sr);
  for (let b = 0; b < n; b += 4 * BLOCK) {
    const swell = 1 + 0.12 * sin1(b * breath);
    const swell5 = 0.32 * (1 + 0.15 * sin1(2 * b * breath + 0.3));
    for (let i = b, end = Math.min(n, b + 4 * BLOCK); i < end; i++) {
      // exact phases (i·f, no accumulated error): every partial is back at zero when the loop wraps
      let x = i * f1;
      x = (x - Math.floor(x)) * TABLE;
      let k = x | 0;
      let s = wave[k] + (x - k) * (wave[k + 1] - wave[k]);
      x = i * f2 + 0.25;
      x = (x - Math.floor(x)) * TABLE;
      k = x | 0;
      s += 0.35 * (wave[k] + (x - k) * (wave[k + 1] - wave[k]));
      x = i * f5 + 0.6;
      x = (x - Math.floor(x)) * TABLE;
      k = x | 0;
      out[i] = swell * s + swell5 * (wave[k] + (x - k) * (wave[k + 1] - wave[k]));
    }
  }
  return normalise(out, 0.9);
}

/** Renders one note of an instrument (unpitched instruments ignore `midi`; only the drone uses `colour`). */
export function renderInstrument(inst: Inst, midi: number, colour: Realm = 'earth', sr = INSTRUMENT_RATE): Float32Array<ArrayBuffer> {
  switch (inst) {
    case 'harp': return harp(midi, sr);
    case 'bass': return bass(midi, sr);
    case 'flute': return flute(midi, sr);
    case 'shofar': return shofar(midi, sr, false);
    case 'stab': return shofar(midi, sr, true);
    case 'doum': return doum(midi, sr);
    case 'tek': return rim(sr, false);
    case 'ka': return rim(sr, true);
    case 'jingle': return jingle(sr);
    case 'shake': return shake(sr);
    case 'zil': return zil(sr);
    case 'drone': return drone(midi, sr, colour);
  }
}
