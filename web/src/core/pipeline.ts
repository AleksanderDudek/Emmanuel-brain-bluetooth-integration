/**
 * fNIRS processing pipeline for the Mendi headband: TypeScript port of
 * brainlink/fnirs.py (same constants, same logic, same rounding).
 *
 * Each of the three optical channels (left, right, pulse) carries an infrared
 * and a red intensity plus an ambient-light reading.  Per sample:
 *
 * 1. **Ambient subtraction**     I = raw − ambient
 * 2. **Optical density change**  ΔOD_λ = −log10(I_λ / I0_λ)   (I0 = baseline mean)
 * 3. **Modified Beer–Lambert**   ΔOD_λ = (ε_HbO,λ·ΔHbO + ε_HbR,λ·ΔHbR) · d · DPF_λ,
 *    solved for ΔHbO / ΔHbR (µM)
 * 4. **Causal filtering**: 3rd-order 0.5 Hz low-pass drops the cardiac pulse;
 *    an optional 1st-order high-pass (`hp_hz`) removes drift but also shrinks
 *    sustained responses, so it is off by default.
 * 5. Extras: heart rate from the pulse channel, a scalp-coupling index per
 *    channel and a motion flag from the IMU.
 *
 * Mendi does not publish its LED wavelengths, source–detector separation or
 * DPF; the defaults (660/850 nm, 3 cm, DPF 6) are typical consumer-fNIRS
 * values, so treat ΔHbO/ΔHbR as relative changes.
 */

import { ACCEL_SCALE_G, GYRO_SCALE_DPS, type Frame, type FrameData } from './proto';
import { HEMO_CHANNELS, OPTICAL_CHANNELS } from './types';
import type {
  ChannelQuality, Derived, FNIRSConfig, HemoChannel, Metrics, OpticalChannel, QualityLabel, Snapshot,
} from './types';
import { CausalFilter, butter, findPeaks, mean, pyRound, sosfiltfilt, std, type Sos } from './dsp';

// ─── Constants ────────────────────────────────────────────────────────

/** Measured on firmware 1.0.1 (upstream assumes 25 Hz); `adaptRate()` corrects it anyway. */
export const MENDI_SAMPLE_RATE = 30.6;

/**
 * Molar extinction coefficients [HbO₂, Hb] in cm⁻¹·M⁻¹ (base 10), from
 * S. Prahl's compilation (omlc.org/spectra/hemoglobin).
 */
export const EXTINCTION: Record<number, [number, number]> = {
  660: [319.6, 3226.56],
  690: [276.0, 2051.96],
  730: [390.0, 1102.2],
  760: [586.0, 1548.52],
  780: [710.0, 1075.44],
  810: [864.0, 717.08],
  830: [974.0, 693.04],
  850: [1058.0, 691.32],
  880: [1170.0, 726.44],
  905: [1206.0, 772.28],
  940: [1214.0, 693.44],
};

export const DEFAULT_FNIRS_CONFIG: FNIRSConfig = Object.freeze({
  red_nm: 660,
  ir_nm: 850,
  separation_cm: 3.0,
  dpf_red: 6.0,
  dpf_ir: 6.0,
  baseline_sec: 10.0, // seconds averaged to define I0
  hp_hz: 0.0, // optional drift high-pass (1st order); 0 = off
  lp_hz: 0.5, // removes the cardiac pulse from HbO/HbR
  activation_window_sec: 60.0,
  motion_gyro_dps: 20.0, // gyro magnitude above this → motion
  motion_accel_g: 0.15, // |‖a‖ − 1 g| above this → motion
});

const CONFIG_KEYS = Object.keys(DEFAULT_FNIRS_CONFIG) as (keyof FNIRSConfig)[];

/** Frame fields per optical channel. */
const FIELDS = {
  left: { ir: 'ir_l', red: 'red_l', amb: 'amb_l' },
  right: { ir: 'ir_r', red: 'red_r', amb: 'amb_r' },
  pulse: { ir: 'ir_p', red: 'red_p', amb: 'amb_p' },
} as const satisfies Record<OpticalChannel, Record<'ir' | 'red' | 'amb', keyof FrameData>>;

/** Python's `'{:g}'` (6 significant digits, trailing zeros stripped) for error messages. */
function formatG(x: number): string {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'nan' : x > 0 ? 'inf' : '-inf';
  const [mantissa, expStr] = x.toExponential(5).split('e');
  const exp = Number(expStr);
  const strip = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
  if (exp < -4 || exp >= 6) return `${strip(mantissa)}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  return strip(x.toFixed(5 - exp));
}

/**
 * Check a configuration for sample rate `fs`; throws with the same messages
 * as `FNIRSConfig.validate` in Python.
 */
export function validateConfig(cfg: FNIRSConfig, fs: number = MENDI_SAMPLE_RATE): void {
  for (const k of CONFIG_KEYS) {
    const v: unknown = cfg[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${k} must be a finite number`);
  }
  for (const nm of [cfg.red_nm, cfg.ir_nm]) {
    if (!Object.hasOwn(EXTINCTION, nm)) {
      const known = Object.keys(EXTINCTION).map(Number).sort((a, b) => a - b);
      throw new Error(`No extinction data for ${nm} nm. Known: [${known.join(', ')}]`);
    }
  }
  if (cfg.red_nm === cfg.ir_nm) throw new Error('red_nm and ir_nm must differ');
  if (!Number.isFinite(fs) || fs <= 0) throw new Error('fs must be a positive, finite number');
  if (cfg.lp_hz <= 0) throw new Error('lp_hz must be positive');
  const nyqLimit = (fs / 2.0) * 0.95;
  if (!(cfg.hp_hz >= 0 && cfg.hp_hz < Math.min(cfg.lp_hz, nyqLimit))) {
    throw new Error(`need 0 <= hp_hz < lp_hz and hp_hz < ${formatG(nyqLimit)} Hz (Nyquist)`);
  }
  if (cfg.separation_cm <= 0 || cfg.dpf_red <= 0 || cfg.dpf_ir <= 0) {
    throw new Error('separation_cm and DPF must be positive');
  }
  if (cfg.baseline_sec <= 0 || cfg.activation_window_sec <= 0) {
    throw new Error('baseline_sec and activation_window_sec must be positive');
  }
}

/** `{...base, ...overrides}`, rejecting keys FNIRSConfig doesn't have (Python raises TypeError). */
function mergeConfig(base: FNIRSConfig, overrides: Partial<FNIRSConfig>): FNIRSConfig {
  for (const k of Object.keys(overrides)) {
    if (!(CONFIG_KEYS as string[]).includes(k)) {
      throw new TypeError(`FNIRSConfig got an unexpected keyword argument '${k}'`);
    }
  }
  return { ...base, ...overrides };
}

/** The 2×2 matrix M⁻¹ with [ΔHbO, ΔHbR]ᵀ (µM) = M⁻¹ · [ΔOD_red, ΔOD_ir]ᵀ. */
export function mbllMatrixInv(cfg: FNIRSConfig): [[number, number], [number, number]] {
  const eRed = EXTINCTION[cfg.red_nm];
  const eIr = EXTINCTION[cfg.ir_nm];
  if (!eRed || !eIr) throw new Error(`No extinction data for ${eRed ? cfg.ir_nm : cfg.red_nm} nm`);
  // Rows: wavelengths; columns: chromophores; entries ε·d·DPF
  const a = eRed[0] * cfg.separation_cm * cfg.dpf_red;
  const b = eRed[1] * cfg.separation_cm * cfg.dpf_red;
  const c = eIr[0] * cfg.separation_cm * cfg.dpf_ir;
  const d = eIr[1] * cfg.separation_cm * cfg.dpf_ir;
  const det = a * d - b * c;
  const s = 1e6; // M → µM
  return [
    [(d / det) * s, (-b / det) * s],
    [(-c / det) * s, (a / det) * s],
  ];
}

/** HbO/HbR filter: 3rd-order low-pass (kept below Nyquist), preceded by the optional drift high-pass. */
export function hemoSos(cfg: FNIRSConfig, fs: number): Sos {
  const nyq = fs / 2.0;
  const lp = butter(3, Math.min(cfg.lp_hz, nyq * 0.95) / nyq, 'low');
  if (cfg.hp_hz <= 0) return lp;
  return [...butter(1, cfg.hp_hz / nyq, 'high'), ...lp];
}

/** Butterworth band-pass in Hz (upper edge kept below Nyquist). */
export function bandpassSos(lo: number, hi: number, fs: number, order = 2): Sos {
  const nyq = fs / 2.0;
  return butter(order, [lo / nyq, Math.min(hi, nyq * 0.95) / nyq], 'band');
}

/** Clamped logistic: a lifted optode gives |ΔHb| in the hundreds of µM. */
const sigmoid = (x: number): number => 1.0 / (1.0 + Math.exp(-Math.max(-50.0, Math.min(50.0, x))));

const nanArray = (n: number): Float64Array => new Float64Array(n).fill(NaN);

/** Start index of Python's `seq[-n:]` (note: n = 0 selects everything). */
const pyTailStart = (len: number, n: number): number =>
  n === 0 ? 0 : n > 0 ? Math.max(0, len - n) : Math.min(len, -n);

/** Fixed-capacity FIFO of numbers, like `collections.deque(maxlen=capacity)`. */
class Ring {
  private readonly buf: Float64Array;
  private head = 0;
  private size = 0;

  constructor(capacity: number) {
    this.buf = new Float64Array(Math.max(0, capacity));
  }

  get length(): number {
    return this.size;
  }

  push(v: number): void {
    const cap = this.buf.length;
    if (cap === 0) return;
    if (this.size < cap) {
      this.buf[(this.head + this.size) % cap] = v;
      this.size++;
    } else {
      this.buf[this.head] = v;
      this.head = (this.head + 1) % cap;
    }
  }

  extend(values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i++) this.push(values[i]);
  }

  last(): number {
    return this.buf[(this.head + this.size - 1) % this.buf.length];
  }

  /** Oldest-first copy of the values from logical index `start` on. */
  slice(start = 0): Float64Array {
    const out = new Float64Array(Math.max(0, this.size - start));
    for (let i = 0; i < out.length; i++) out[i] = this.buf[(this.head + start + i) % this.buf.length];
    return out;
  }

  /** Python's `list(d)[-n:]`. */
  tail(n: number): Float64Array {
    return this.slice(pyTailStart(this.size, n));
  }

  sum(): number {
    let s = 0;
    for (let i = 0; i < this.size; i++) s += this.buf[(this.head + i) % this.buf.length];
    return s;
  }
}

/** Everything `reset()` rebuilds for one configuration and sample rate. */
interface StreamState {
  minv: [[number, number], [number, number]];
  baselineTarget: number;
  baselineAcc: Record<HemoChannel, { red: Float64Array; ir: Float64Array; n: number }>;
  baseline: Record<HemoChannel, [number, number] | null>;
  filters: Record<HemoChannel, { hbo: CausalFilter; hbr: CausalFilter }>;
  hbo: Record<HemoChannel, Ring>;
  hbr: Record<HemoChannel, Ring>;
  /** Ambient-corrected intensities for SCI / heart rate (last 10 s). */
  intensity: Record<OpticalChannel, { red: Ring; ir: Ring }>;
  ambientRatio: Record<OpticalChannel, Ring>;
  motion: Ring;
  /** Long window of the mean (HbO − HbR) for activation normalisation. */
  actHist: Ring;
  /** Cardiac band-passes, designed once per rate. */
  heartSos: Sos;
  sciSos: Sos;
  rateT0: number | null;
  rateN: number;
}

const perChannel = <C extends string, T>(channels: readonly C[], make: (ch: C) => T): Record<C, T> =>
  Object.fromEntries(channels.map(ch => [ch, make(ch)])) as Record<C, T>;

/**
 * Streaming fNIRS processor.  Call {@link push} with every batch of new
 * frames, then {@link snapshot} for the latest derived values.
 */
export class FNIRSPipeline {
  fs: number;
  config: FNIRSConfig;
  measuredRate: number | null = null;
  totalFrames = 0;
  lastFrame: Frame | null = null;
  readonly historySec = 30.0;

  private readonly clock: () => number;
  private st: StreamState;

  /** @param clock monotonic milliseconds, used only to measure the incoming frame rate */
  constructor(config: Partial<FNIRSConfig> = {}, fs: number = MENDI_SAMPLE_RATE, clock: () => number = () => performance.now()) {
    this.config = mergeConfig(DEFAULT_FNIRS_CONFIG, config);
    validateConfig(this.config, fs);
    this.fs = fs;
    this.clock = clock;
    this.st = this.buildState();
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /** Forget the baseline and all history (e.g. after re-seating the band). */
  reset(): void {
    this.st = this.buildState();
    this.lastFrame = null;
    this.totalFrames = 0;
    this.measuredRate = null;
  }

  private buildState(): StreamState {
    const { config: cfg, fs } = this;
    const cap = Math.trunc(this.historySec * fs);
    const icap = Math.trunc(10 * fs);
    const baselineTarget = Math.max(1, Math.trunc(cfg.baseline_sec * fs));
    const hemo = hemoSos(cfg, fs);
    return {
      minv: mbllMatrixInv(cfg),
      baselineTarget,
      baselineAcc: perChannel(HEMO_CHANNELS, () => ({
        red: new Float64Array(baselineTarget), ir: new Float64Array(baselineTarget), n: 0,
      })),
      baseline: perChannel(HEMO_CHANNELS, () => null),
      filters: perChannel(HEMO_CHANNELS, () => ({ hbo: new CausalFilter(hemo), hbr: new CausalFilter(hemo) })),
      hbo: perChannel(HEMO_CHANNELS, () => new Ring(cap)),
      hbr: perChannel(HEMO_CHANNELS, () => new Ring(cap)),
      intensity: perChannel(OPTICAL_CHANNELS, () => ({ red: new Ring(icap), ir: new Ring(icap) })),
      ambientRatio: perChannel(OPTICAL_CHANNELS, () => new Ring(icap)),
      motion: new Ring(Math.trunc(2 * fs)),
      actHist: new Ring(Math.trunc(cfg.activation_window_sec * fs)),
      heartSos: bandpassSos(0.7, 3.5, fs, 3),
      sciSos: bandpassSos(0.5, 2.5, fs, 3),
      rateT0: null,
      rateN: 0,
    };
  }

  /** Validate and apply config overrides, then reset; the old config stays if anything fails. */
  setConfig(overrides: Partial<FNIRSConfig>): FNIRSConfig {
    const cfg = mergeConfig(this.config, overrides);
    validateConfig(cfg, this.fs);
    const old = this.config;
    this.config = cfg;
    try {
      this.reset();
    } catch (e) {
      this.config = old; // never leave a config whose filters could not be built
      this.reset();
      throw e;
    }
    return { ...cfg };
  }

  /** Change the sample rate (filters, buffers); resets the baseline. */
  setRate(fs: number): void {
    validateConfig(this.config, fs);
    this.fs = fs;
    this.reset();
  }

  /** Switch to the measured rate when it is more than `tolerance` off. Returns true if changed. */
  adaptRate(tolerance = 0.1): boolean {
    const m = this.measuredRate;
    if (!m || Math.abs(m - this.fs) / this.fs <= tolerance) return false;
    this.setRate(pyRound(m, 1));
    return true;
  }

  get baselineReady(): boolean {
    return HEMO_CHANNELS.every(ch => this.st.baseline[ch] !== null);
  }

  get baselineProgress(): number {
    const n = Math.min(...HEMO_CHANNELS.map(ch => this.st.baselineAcc[ch].n));
    return this.baselineReady ? 1.0 : pyRound(n / this.st.baselineTarget, 3);
  }

  // ── Ingest ─────────────────────────────────────────────────────

  /**
   * Process a batch of frames.  Returns per-sample ΔHbO/ΔHbR aligned with the
   * input, NaN while the baseline is still being collected.
   */
  push(frames: readonly Frame[]): Derived {
    const n = frames.length;
    const out: Derived = { hbo_left: nanArray(n), hbr_left: nanArray(n), hbo_right: nanArray(n), hbr_right: nanArray(n) };
    if (n === 0) return out;
    const st = this.st;
    this.trackRate(n);
    this.totalFrames += n;
    this.lastFrame = frames[n - 1];

    const corrected = perChannel(OPTICAL_CHANNELS, () => ({ red: new Float64Array(n), ir: new Float64Array(n) }));
    for (const ch of OPTICAL_CHANNELS) {
      const f = FIELDS[ch];
      const { red, ir } = corrected[ch];
      for (let i = 0; i < n; i++) {
        const fr = frames[i];
        const amb = fr[f.amb];
        red[i] = Math.max(fr[f.red] - amb, 1.0);
        ir[i] = Math.max(fr[f.ir] - amb, 1.0);
        st.ambientRatio[ch].push(Math.abs(amb) / Math.max(fr[f.ir], 1.0));
      }
      st.intensity[ch].red.extend(red);
      st.intensity[ch].ir.extend(ir);
    }

    const { motion_accel_g: accelLimit, motion_gyro_dps: gyroLimit } = this.config;
    for (const f of frames) {
      const ax = f.acc_x * ACCEL_SCALE_G;
      const ay = f.acc_y * ACCEL_SCALE_G;
      const az = f.acc_z * ACCEL_SCALE_G;
      const gx = f.ang_x * GYRO_SCALE_DPS;
      const gy = f.ang_y * GYRO_SCALE_DPS;
      const gz = f.ang_z * GYRO_SCALE_DPS;
      const aDev = Math.abs(Math.sqrt(ax * ax + ay * ay + az * az) - 1.0);
      const gMag = Math.sqrt(gx * gx + gy * gy + gz * gz);
      // An all-zero accelerometer means "no IMU data", not free fall
      const hasAccel = ax !== 0 || ay !== 0 || az !== 0;
      st.motion.push((aDev > accelLimit && hasAccel) || gMag > gyroLimit ? 1 : 0);
    }

    const [[m00, m01], [m10, m11]] = st.minv;
    for (const ch of HEMO_CHANNELS) {
      const { red, ir } = corrected[ch];
      let start = 0;
      if (st.baseline[ch] === null) {
        const acc = st.baselineAcc[ch];
        const take = Math.min(st.baselineTarget - acc.n, n);
        acc.red.set(red.subarray(0, take), acc.n);
        acc.ir.set(ir.subarray(0, take), acc.n);
        acc.n += take;
        start = take;
        if (acc.n >= st.baselineTarget) st.baseline[ch] = [mean(acc.red), mean(acc.ir)];
      }
      const base = st.baseline[ch];
      if (base === null || start >= n) continue;
      const [i0Red, i0Ir] = base;
      const m = n - start;
      const hboRaw = new Float64Array(m);
      const hbrRaw = new Float64Array(m);
      for (let j = 0; j < m; j++) {
        const odRed = -Math.log10(red[start + j] / i0Red);
        const odIr = -Math.log10(ir[start + j] / i0Ir);
        hboRaw[j] = m00 * odRed + m01 * odIr;
        hbrRaw[j] = m10 * odRed + m11 * odIr;
      }
      const hbo = st.filters[ch].hbo.process(hboRaw);
      const hbr = st.filters[ch].hbr.process(hbrRaw);
      st.hbo[ch].extend(hbo);
      st.hbr[ch].extend(hbr);
      (ch === 'left' ? out.hbo_left : out.hbo_right).set(hbo, start);
      (ch === 'left' ? out.hbr_left : out.hbr_right).set(hbr, start);
    }

    if (this.baselineReady) {
      for (let i = 0; i < n; i++) {
        // NaN where either side is still warming up
        const both = ((out.hbo_left[i] - out.hbr_left[i]) + (out.hbo_right[i] - out.hbr_right[i])) / 2.0;
        if (!Number.isNaN(both)) st.actHist.push(both);
      }
    }
    return out;
  }

  private trackRate(n: number): void {
    const now = this.clock() / 1000;
    const st = this.st;
    if (st.rateT0 === null) {
      st.rateT0 = now;
      return;
    }
    st.rateN += n;
    const dt = now - st.rateT0;
    if (dt >= 5.0) {
      this.measuredRate = pyRound(st.rateN / dt, 2);
      st.rateT0 = now;
      st.rateN = 0;
    }
  }

  // ── Derived metrics ────────────────────────────────────────────

  /** Beats per minute from the pulse channel's IR intensity (last ~10 s). */
  heartRate(): number | null {
    const ir = this.st.intensity.pulse.ir.slice();
    if (ir.length < this.fs * 6) return null;
    const m = mean(ir);
    let x: Float64Array;
    try {
      x = sosfiltfilt(this.st.heartSos, ir.map(v => v - m));
    } catch (e) {
      if (e instanceof RangeError) return null; // too short for the zero-phase filter
      throw e;
    }
    // Blood volume ↑ → light ↓, so pulses are troughs of intensity
    const peaks = findPeaks(x.map(v => -v), {
      distance: Math.max(1, Math.trunc(this.fs * 0.33)),
      prominence: std(x) * 0.5,
    });
    if (peaks.length < 4) return null;
    const ibi: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const d = (peaks[i] - peaks[i - 1]) / this.fs;
      if (d > 0.28 && d < 1.5) ibi.push(d);
    }
    if (ibi.length < 3) return null;
    return pyRound(60.0 / median(ibi), 1);
  }

  /**
   * Scalp Coupling Index (Pollonini et al., 2014): correlation of the two
   * wavelengths after band-passing to the cardiac band.  > 0.75 is good.
   */
  scalpCoupling(ch: OpticalChannel): number | null {
    const red = this.st.intensity[ch].red.slice();
    const ir = this.st.intensity[ch].ir.slice();
    if (red.length < this.fs * 5) return null;
    let r: Float64Array;
    let i: Float64Array;
    try {
      const mr = mean(red);
      const mi = mean(ir);
      r = sosfiltfilt(this.st.sciSos, red.map(v => v - mr));
      i = sosfiltfilt(this.st.sciSos, ir.map(v => v - mi));
    } catch (e) {
      if (e instanceof RangeError) return null;
      throw e;
    }
    if (std(r) < 1e-9 || std(i) < 1e-9) return 0.0;
    return pyRound(corrcoef(r, i), 3);
  }

  signalQuality(): Snapshot['quality'] {
    return perChannel(OPTICAL_CHANNELS, (ch): ChannelQuality => {
      const sci = this.scalpCoupling(ch);
      const ambRing = this.st.ambientRatio[ch];
      const irRing = this.st.intensity[ch].ir;
      const amb = ambRing.length ? ambRing.sum() / ambRing.length : null;
      const dc = irRing.length ? irRing.sum() / irRing.length : null;
      let label: QualityLabel;
      if (sci === null) label = 'warming_up';
      else if (amb !== null && amb > 0.5) label = 'light_leak';
      else if (dc !== null && dc < 100) label = 'no_signal';
      else if (sci >= 0.75) label = 'good';
      else if (sci >= 0.5) label = 'fair';
      else label = 'poor';
      return {
        sci,
        ambient_ratio: amb === null ? null : pyRound(amb, 3),
        dc: dc === null ? null : pyRound(dc, 1),
        label,
      };
    });
  }

  /** More than 20 % of the last 2 s flagged as moving. */
  motion(): boolean {
    const m = this.st.motion;
    return m.length > 0 && m.sum() / m.length > 0.2;
  }

  /**
   * Game-friendly 0–1 values:
   *
   * - `activation`: prefrontal oxygenation (ΔHbO − ΔHbR, both sides) relative
   *   to its recent distribution (sigmoid of a z-score).
   * - `asymmetry`: right minus left oxygenation mapped to 0..1 (0.5 = balanced).
   */
  metrics(): Metrics {
    const st = this.st;
    if (!this.baselineReady || st.hbo.left.length === 0) return { activation: null, asymmetry: null };
    const hist = st.actHist.slice();
    const curL = st.hbo.left.last() - st.hbr.left.last();
    const curR = st.hbo.right.last() - st.hbr.right.last();
    const cur = (curL + curR) / 2.0;
    const sd = hist.length > this.fs * 5 ? std(hist) : 0.0;
    const activation = sd < 1e-6 ? 0.5 : sigmoid((cur - mean(hist)) / sd);
    const scale = Math.max(sd, 0.05);
    const asym = sigmoid((curR - curL) / scale);
    return { activation: pyRound(activation, 3), asymmetry: pyRound(asym, 3) };
  }

  /** Latest values for the UI; same keys and rounding as the Python snapshot. */
  snapshot(previewSec = 10.0): Snapshot {
    const st = this.st;
    const n = Math.trunc(previewSec * this.fs);
    const step = Math.max(1, Math.trunc(this.fs / 5)); // ~5 points per second for the UI
    const tail = (r: Ring): number[] => {
      const arr = r.tail(n);
      const res: number[] = [];
      for (let i = 0; i < arr.length; i += step) res.push(pyRound(arr[i], 4));
      return res;
    };
    const latest = (r: Ring): number | null => (r.length ? pyRound(r.last(), 4) : null);
    const f = this.lastFrame;
    return {
      ts: Date.now(),
      baseline_ready: this.baselineReady,
      baseline_progress: this.baselineProgress,
      hbo: perChannel(HEMO_CHANNELS, ch => latest(st.hbo[ch])),
      hbr: perChannel(HEMO_CHANNELS, ch => latest(st.hbr[ch])),
      preview: {
        hbo: perChannel(HEMO_CHANNELS, ch => tail(st.hbo[ch])),
        hbr: perChannel(HEMO_CHANNELS, ch => tail(st.hbr[ch])),
        pulse_ir: Array.from(st.intensity.pulse.ir.tail(Math.trunc(5 * this.fs)), v => pyRound(v, 1)),
      },
      raw: f === null ? null : perChannel(OPTICAL_CHANNELS, ch => ({
        ir: f[FIELDS[ch].ir], red: f[FIELDS[ch].red], amb: f[FIELDS[ch].amb],
      })),
      imu: f === null ? null : {
        accel_g: f.accel_g.map(v => pyRound(v, 3)),
        gyro_dps: f.gyro_dps.map(v => pyRound(v, 2)),
        temp_c: Number.isFinite(f.temp) ? pyRound(f.temp, 2) : null,
      },
      heart_rate_bpm: this.heartRate(),
      quality: this.signalQuality(),
      motion: this.motion(),
      metrics: this.metrics(),
      sample_rate: this.fs,
      measured_rate: this.measuredRate,
      total_frames: this.totalFrames,
      config: { ...this.config },
    };
  }
}

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Pearson correlation the way `np.corrcoef(x, y)[0, 1]` computes it (covariance / σx / σy, clipped). */
function corrcoef(x: Float64Array, y: Float64Array): number {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const f = 1 / (n - 1);
  const c = sxy * f / Math.sqrt(sxx * f) / Math.sqrt(syy * f);
  return Math.max(-1, Math.min(1, c));
}
