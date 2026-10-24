/**
 * EEG signal processing: TypeScript port of brainlink/dsp.py.
 *
 * Per channel: DC/drift removal (high-pass as signal − exponential moving
 * average, τ = 0.5 s), a 50 Hz notch (`scipy.signal.iirnotch`, Q = 30), a 2 s
 * ring buffer, band powers from Welch's method over the whole buffer (1 s
 * segments, 1 Hz bins), and a blink counter on the frontal channels.  Checked
 * against SciPy through test/fixtures/eeg.json.
 */
import { mean, sosfilt, sosfiltZi, std, type Sos } from '../dsp';
import { BANDS, BUFFER_SAMPLES, EEG_CHANNELS, EEG_SAMPLE_RATE, PSD_SEGMENT_SEC, WINDOW_SAMPLES, type Band, type BandPowers, type EegChannel, type EegChunk } from './types';

/** `scipy.signal.iirnotch(w0, Q, fs)` as one second-order section (what `tf2sos` makes of it). */
export function iirnotch(w0Hz: number, q: number, fs: number): Sos {
  const w0 = (2 * w0Hz / fs) * Math.PI;
  const bw = (2 * w0Hz / fs / q) * Math.PI;
  // gb = 1/√2 (−3 dB bandwidth), so beta = √(1 − gb²)/gb · tan(bw/2) = tan(bw/2)
  const gain = 1 / (1 + Math.tan(bw / 2));
  const c = Math.cos(w0);
  return [[gain, -2 * gain * c, gain, 1, -2 * gain * c, 2 * gain - 1]];
}

/** Periodic Hann window, like `scipy.signal.get_window('hann', n)`. */
export function hann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>();

function dftTables(n: number) {
  let t = twiddles.get(n);
  if (!t) {
    const cos = new Float64Array(n), sin = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      cos[k] = Math.cos((2 * Math.PI * k) / n);
      sin[k] = Math.sin((2 * Math.PI * k) / n);
    }
    t = { cos, sin };
    twiddles.set(n, t);
  }
  return t;
}

/**
 * Power spectral density by Welch's method with SciPy's defaults for
 * `welch(x, fs, nperseg=n)`: periodic Hann window, 50 % overlap, constant
 * detrend per segment, one-sided, density scaling, mean over segments.
 */
export function welch(x: ArrayLike<number>, fs: number, nperseg: number): { freqs: Float64Array; psd: Float64Array } {
  const n = Math.min(nperseg, x.length);
  const step = n - Math.floor(n / 2);
  const nseg = Math.floor((x.length - Math.floor(n / 2)) / step);
  const nf = Math.floor(n / 2) + 1;
  const win = hann(n);
  let wss = 0;
  for (let i = 0; i < n; i++) wss += win[i] * win[i];
  const scale = 1 / (fs * wss);
  const { cos, sin } = dftTables(n);
  const psd = new Float64Array(nf);
  const seg = new Float64Array(n);
  for (let s = 0; s < nseg; s++) {
    const off = s * step;
    let m = 0;
    for (let i = 0; i < n; i++) m += x[off + i];
    m /= n;
    for (let i = 0; i < n; i++) seg[i] = (x[off + i] - m) * win[i];
    for (let k = 0; k < nf; k++) {
      let re = 0, im = 0;
      for (let i = 0, idx = 0; i < n; i++, idx = idx + k < n ? idx + k : idx + k - n) {   // (i·k) mod n; k < n
        re += seg[i] * cos[idx];
        im -= seg[i] * sin[idx];
      }
      let p = (re * re + im * im) * scale;
      if (k > 0 && !(n % 2 === 0 && k === nf - 1)) p *= 2;   // one-sided; DC and Nyquist are not doubled
      psd[k] += p;
    }
  }
  if (nseg > 0) for (let k = 0; k < nf; k++) psd[k] /= nseg;
  const freqs = Float64Array.from({ length: nf }, (_, k) => (k * fs) / n);
  return { freqs, psd };
}

/**
 * Mean power density of each band (µV²/Hz), as `band_densities` in dsp.py: the PSD
 * integrated over the band, each bin weighted by the part of its width [f − df/2, f + df/2]
 * inside the band, then divided by the band's width.  Edge bins are split between the two
 * bands instead of counted twice, and the result does not depend on the bin width.
 */
export function bandDensities(freqs: ArrayLike<number>, psd: ArrayLike<number>, df: number): Record<Band, number> {
  const clip = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const out = {} as Record<Band, number>;
  for (const [band, [lo, hi]] of Object.entries(BANDS) as [Band, readonly [number, number]][]) {
    let sum = 0;
    for (let k = 0; k < freqs.length; k++) sum += psd[k] * (clip(freqs[k] + df / 2, lo, hi) - clip(freqs[k] - df / 2, lo, hi));
    out[band] = sum / (hi - lo);
  }
  return out;
}

/**
 * Band power densities of one channel by Welch's method, as `band_powers` in dsp.py: 1 s Hann
 * segments (1 Hz bins) with 50 % overlap over the whole signal — three averaged segments for the
 * 2 s buffer.
 */
export function bandPowers(signal: ArrayLike<number>, fs: number): Record<Band, number> {
  const nperseg = Math.min(Math.round(fs * PSD_SEGMENT_SEC), signal.length);
  const { freqs, psd } = welch(signal, fs, nperseg);
  return bandDensities(freqs, psd, fs / nperseg);
}

function median(x: ArrayLike<number>): number {
  const s = Array.from(x).sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

/** Streaming EEG processor (`DSPPipeline`). */
export class EegDsp {
  static readonly HP_ALPHA = Math.exp(-1 / (EEG_SAMPLE_RATE * 0.5));
  readonly notchSos: Sos = iirnotch(50, 30, EEG_SAMPLE_RATE);
  readonly buffers: Record<EegChannel, Float64Array>;
  private readonly cap = BUFFER_SAMPLES;
  private hpState: Record<EegChannel, number | null>;
  private notchState: Record<EegChannel, number[][] | null>;

  constructor() {
    this.buffers = Object.fromEntries(EEG_CHANNELS.map(ch => [ch, new Float64Array(0)])) as Record<EegChannel, Float64Array>;
    this.hpState = Object.fromEntries(EEG_CHANNELS.map(ch => [ch, null])) as Record<EegChannel, number | null>;
    this.notchState = Object.fromEntries(EEG_CHANNELS.map(ch => [ch, null])) as Record<EegChannel, number[][] | null>;
  }

  /** DC removal + 50 Hz notch + buffer (last 2 s) for every channel. */
  push(data: EegChunk): void {
    const a = EegDsp.HP_ALPHA;
    for (const ch of EEG_CHANNELS) {
      const raw = data[ch];
      if (!raw || raw.length === 0) continue;
      // seeded at the median of the first chunk: robust to a spike at the start of the stream
      let lp = this.hpState[ch] ?? median(raw);
      const hp = new Float64Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        lp = a * lp + (1 - a) * raw[i];
        hp[i] = raw[i] - lp;
      }
      this.hpState[ch] = lp;
      const zi = this.notchState[ch] ?? sosfiltZi(this.notchSos).map(r => r.map(v => v * hp[0]));
      const { y, zf } = sosfilt(this.notchSos, hp, zi);
      this.notchState[ch] = zf;
      const old = this.buffers[ch];
      const keep = Math.min(old.length, Math.max(0, this.cap - y.length));
      const next = new Float64Array(keep + Math.min(y.length, this.cap));
      next.set(old.subarray(old.length - keep));
      next.set(y.length > this.cap ? y.subarray(y.length - this.cap) : y, keep);
      this.buffers[ch] = next;
    }
  }

  hasEnough(): boolean {
    return EEG_CHANNELS.every(ch => this.buffers[ch].length >= WINDOW_SAMPLES);
  }

  /** {channel: {band: µV²/Hz}} over the whole buffer (up to 2 s). */
  bandPowers(): BandPowers {
    const out = {} as BandPowers;
    for (const ch of EEG_CHANNELS) out[ch] = bandPowers(this.buffers[ch], EEG_SAMPLE_RATE);
    return out;
  }

  /** Blink artefacts in the last second on Fp1/Fp2 (excursions beyond 4 SD, 20 samples apart). */
  blinks(): number {
    let count = 0;
    for (const ch of ['Fp1', 'Fp2'] as const) {
      const buf = this.buffers[ch].subarray(-WINDOW_SAMPLES);
      const threshold = std(buf) * 4;
      let last = -1, any = false;
      for (let i = 0; i < buf.length; i++) {
        if (Math.abs(buf[i]) <= threshold) continue;
        if (!any) { count++; any = true; } else if (i - last > 20) count++;
        last = i;
      }
    }
    return count;
  }

  /** The last `n` filtered samples per channel with their linear trend removed, for the traces. */
  preview(n: number): Record<EegChannel, number[]> {
    const out = {} as Record<EegChannel, number[]>;
    for (const ch of EEG_CHANNELS) {
      const w = this.buffers[ch].subarray(-n);
      out[ch] = detrend(w);
    }
    return out;
  }
}

/** Least-squares line removed (`np.polyfit(t, w, 1)`), as the server does for its display window. */
export function detrend(w: ArrayLike<number>): number[] {
  const n = w.length;
  if (n < 3) return Array.from(w);
  const tm = (n - 1) / 2, wm = mean(w);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - tm) * (w[i] - wm);
    sxx += (i - tm) ** 2;
  }
  const slope = sxy / sxx;
  return Array.from(w, (v, i) => v - (wm + slope * (i - tm)));
}
