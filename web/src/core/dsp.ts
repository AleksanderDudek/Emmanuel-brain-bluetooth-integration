/**
 * Signal-processing primitives for the fNIRS pipeline: a dependency-free port
 * of the SciPy functions brainlink/fnirs.py relies on.
 *
 * - `butter(N, Wn, btype)`            ≡ scipy.signal.butter(..., output='sos')
 * - `sosfilt` / `sosfiltZi`           ≡ sosfilt / sosfilt_zi (direct form II transposed)
 * - `sosfiltfilt`                     ≡ sosfiltfilt (padtype='odd', default padlen)
 * - `findPeaks(x, {distance, prominence})` ≡ find_peaks with those two conditions
 *
 * Filter design follows SciPy's own steps (analog prototype → pre-warp →
 * frequency transform → bilinear transform → zpk2sos with "nearest" pairing),
 * so coefficients and outputs agree with SciPy to rounding error
 * (test/dsp.test.ts replays fixtures produced by scripts/make_fixtures.py).
 */

/** Second-order sections, one biquad per row: [b0, b1, b2, a0, a1, a2] with a0 = 1. */
export type Sos = number[][];

// ─── Complex arithmetic (only what filter design needs) ───────────────

interface Complex {
  re: number;
  im: number;
}

const cx = (re: number, im = 0): Complex => ({ re, im });
const cadd = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
const csub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
const cmul = (a: Complex, b: Complex): Complex =>
  cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cscale = (a: Complex, s: number): Complex => cx(a.re * s, a.im * s);
const cneg = (a: Complex): Complex => cx(-a.re, -a.im);
const conj = (a: Complex): Complex => cx(a.re, -a.im);
const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
const isReal = (a: Complex): boolean => a.im === 0;

/** Complex division with Smith's algorithm (what NumPy uses): no overflow in |b|². */
function cdiv(a: Complex, b: Complex): Complex {
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const rat = b.im / b.re;
    const scl = 1 / (b.re + b.im * rat);
    return cx((a.re + a.im * rat) * scl, (a.im - a.re * rat) * scl);
  }
  const rat = b.re / b.im;
  const scl = 1 / (b.im + b.re * rat);
  return cx((a.re * rat + a.im) * scl, (a.im * rat - a.re) * scl);
}

/** Principal square root (C99 csqrt). */
function csqrt(a: Complex): Complex {
  if (a.re === 0 && a.im === 0) return cx(0, a.im);
  const t = Math.sqrt((Math.abs(a.re) + cabs(a)) / 2);
  if (a.re >= 0) return cx(t, a.im / (2 * t));
  const negIm = a.im < 0 || Object.is(a.im, -0);
  return cx(Math.abs(a.im) / (2 * t), negIm ? -t : t);
}

const cprod = (xs: readonly Complex[]): Complex => xs.reduce(cmul, cx(1));

// ─── Butterworth design (zeros, poles, gain) ──────────────────────────

interface Zpk {
  z: Complex[];
  p: Complex[];
  k: number;
}

/** Analog prototype: N poles evenly spaced on the left half of the unit circle, no zeros. */
function buttap(n: number): Zpk {
  const p: Complex[] = [];
  for (let m = -n + 1; m < n; m += 2) {
    const theta = (Math.PI * m) / (2 * n); // m = 0 gives an exactly real pole
    p.push(cx(-Math.cos(theta), -Math.sin(theta)));
  }
  return { z: [], p, k: 1 };
}

/** Low-pass → low-pass with cutoff `wo`: scale every root radially. */
function lp2lp({ z, p, k }: Zpk, wo: number): Zpk {
  const degree = p.length - z.length;
  return { z: z.map(r => cscale(r, wo)), p: p.map(r => cscale(r, wo)), k: k * wo ** degree };
}

/** Low-pass → high-pass: invert roots about the unit circle; zeros at ∞ move to the origin. */
function lp2hp({ z, p, k }: Zpk, wo: number): Zpk {
  const degree = p.length - z.length;
  const w = cx(wo);
  return {
    z: [...z.map(r => cdiv(w, r)), ...Array.from({ length: degree }, () => cx(0))],
    p: p.map(r => cdiv(w, r)),
    k: k * cdiv(cprod(z.map(cneg)), cprod(p.map(cneg))).re,
  };
}

/** Low-pass → band-pass centred on `wo` with width `bw`: every root splits into a pair. */
function lp2bp({ z, p, k }: Zpk, wo: number, bw: number): Zpk {
  const degree = p.length - z.length;
  const wo2 = cx(wo ** 2);
  const split = (roots: Complex[]): Complex[] => {
    const lp = roots.map(r => cx((r.re * bw) / 2, (r.im * bw) / 2));
    const s = lp.map(r => csqrt(csub(cmul(r, r), wo2)));
    return [...lp.map((r, i) => cadd(r, s[i])), ...lp.map((r, i) => csub(r, s[i]))];
  };
  return {
    z: [...split(z), ...Array.from({ length: degree }, () => cx(0))],
    p: split(p),
    k: k * bw ** degree,
  };
}

/** Bilinear transform s → 2·fs·(z−1)/(z+1); zeros at ∞ land on Nyquist (z = −1). */
function bilinear({ z, p, k }: Zpk, fs: number): Zpk {
  const degree = p.length - z.length;
  const fs2 = cx(2 * fs);
  const map = (r: Complex) => cdiv(cadd(fs2, r), csub(fs2, r));
  return {
    z: [...z.map(map), ...Array.from({ length: degree }, () => cx(-1))],
    p: p.map(map),
    k: k * cdiv(cprod(z.map(r => csub(fs2, r))), cprod(p.map(r => csub(fs2, r)))).re,
  };
}

/**
 * SciPy's `_cplxreal`: keep one root of every conjugate pair (positive
 * imaginary part, averaged with its partner) followed by the real roots,
 * each group sorted by real part.
 */
function cplxreal(roots: readonly Complex[]): Complex[] {
  const tol = 100 * Number.EPSILON;
  const sorted = [...roots].sort((a, b) => a.re - b.re || Math.abs(a.im) - Math.abs(b.im));
  const reals: Complex[] = [];
  const pos: Complex[] = [];
  const neg: Complex[] = [];
  for (const r of sorted) {
    if (Math.abs(r.im) <= tol * cabs(r)) reals.push(cx(r.re));
    else (r.im > 0 ? pos : neg).push(r);
  }
  if (pos.length !== neg.length) throw new Error('Array contains complex value with no matching conjugate.');
  // Runs of (nearly) equal real part are ordered by |imag| so that partners line up
  const byImag = (a: Complex, b: Complex) => Math.abs(a.im) - Math.abs(b.im);
  for (let i = 0; i < pos.length; i++) {
    const start = i;
    while (i + 1 < pos.length && pos[i + 1].re - pos[i].re <= tol * cabs(pos[i])) i++;
    if (i > start) {
      pos.splice(start, i - start + 1, ...pos.slice(start, i + 1).sort(byImag));
      neg.splice(start, i - start + 1, ...neg.slice(start, i + 1).sort(byImag));
    }
  }
  const pairs = pos.map((r, i) => {
    if (cabs(csub(r, conj(neg[i]))) > tol * cabs(neg[i])) {
      throw new Error('Array contains complex value with no matching conjugate.');
    }
    return cscale(cadd(r, conj(neg[i])), 0.5);
  });
  return [...pairs, ...reals];
}

/** Real coefficients of ∏(x − rᵢ) for real roots or conjugate pairs. */
function poly(roots: readonly Complex[]): number[] {
  let c: Complex[] = [cx(1)];
  for (const r of roots) {
    const next = [...c, cx(0)];
    for (let i = 1; i < next.length; i++) next[i] = cadd(next[i], cmul(cneg(r), c[i - 1]));
    c = next;
  }
  return c.map(v => v.re);
}

/** One SOS row from ≤ 2 zeros and ≤ 2 poles (coefficients right-aligned, as SciPy does). */
function sectionFromRoots(z: Complex[], p: Complex[]): number[] {
  const b = poly(z);
  const a = poly(p);
  const row = [0, 0, 0, 0, 0, 0];
  row.splice(3 - b.length, b.length, ...b);
  row.splice(6 - a.length, a.length, ...a);
  return row;
}

/** Remove and return the root of `from` nearest to `to` (optionally restricted to real/complex roots). */
function takeNearest(from: Complex[], to: Complex, which: 'real' | 'complex' | 'any'): Complex {
  const order = from.map((_, i) => i).sort((i, j) => cabs(csub(from[i], to)) - cabs(csub(from[j], to)));
  const idx = order.find(i => which === 'any' || isReal(from[i]) === (which === 'real'));
  if (idx === undefined) throw new Error(`no ${which} root left to pair`);
  return from.splice(idx, 1)[0];
}

/** Index of the root closest to the unit circle (the "worst" one for a digital filter). */
const worstIndex = (roots: readonly Complex[], candidates: readonly number[]): number =>
  candidates.reduce((best, i) => (Math.abs(1 - cabs(roots[i])) < Math.abs(1 - cabs(roots[best])) ? i : best));

/**
 * SciPy's zpk2sos with pairing='nearest': the pole closest to the unit circle
 * goes into the last section together with its nearest zeros, and so on
 * backwards; the gain goes into the first section.
 */
function zpk2sos({ z: z0, p: p0, k }: Zpk): Sos {
  if (z0.length === 0 && p0.length === 0) return [[k, 0, 0, 1, 0, 0]];
  const z = [...z0];
  const p = [...p0];
  while (p.length < z.length) p.push(cx(0));
  while (z.length < p.length) z.push(cx(0));
  const nSections = (p.length + 1) >> 1;
  if (p.length % 2 === 1) {
    p.push(cx(0));
    z.push(cx(0));
  }
  const zs = cplxreal(z);
  const ps = cplxreal(p);
  const all = (xs: Complex[]) => xs.map((_, i) => i);
  const realIdx = (xs: Complex[]) => all(xs).filter(i => isReal(xs[i]));

  const sos: Sos = [];
  for (let si = nSections - 1; si >= 0; si--) {
    const p1 = ps.splice(worstIndex(ps, all(ps)), 1)[0];
    const nRealP = realIdx(ps).length;
    if (isReal(p1) && nRealP === 0) {
      // Last real pole: first-order section (padded with a pole/zero at the origin)
      sos[si] = sectionFromRoots([takeNearest(zs, p1, 'real'), cx(0)], [p1, cx(0)]);
    } else if (ps.length + 1 === zs.length && !isReal(p1) && nRealP === 1 && realIdx(zs).length === 1) {
      // One real pole and one real zero must stay together: pair p1 with a complex zero
      const z1 = takeNearest(zs, p1, 'complex');
      sos[si] = sectionFromRoots([z1, conj(z1)], [p1, conj(p1)]);
    } else {
      const p2 = isReal(p1) ? ps.splice(worstIndex(ps, realIdx(ps)), 1)[0] : conj(p1);
      if (zs.length === 0) {
        sos[si] = sectionFromRoots([], [p1, p2]);
        continue;
      }
      const z1 = takeNearest(zs, p1, 'any');
      if (!isReal(z1)) sos[si] = sectionFromRoots([z1, conj(z1)], [p1, p2]);
      else if (zs.length > 0) sos[si] = sectionFromRoots([z1, takeNearest(zs, p1, 'real')], [p1, p2]);
      else sos[si] = sectionFromRoots([z1], [p1, p2]);
    }
  }
  for (let i = 0; i < 3; i++) sos[0][i] *= k;
  return sos;
}

/**
 * Digital Butterworth filter as second-order sections, like
 * `scipy.signal.butter(order, wn, btype, output='sos')`.  `wn` is normalised
 * to Nyquist (0 < wn < 1); a band-pass takes `[low, high]`.
 */
export function butter(order: number, wn: number | [number, number], btype: 'low' | 'high' | 'band'): Sos {
  const w = typeof wn === 'number' ? [wn] : [...wn];
  if (w.some(v => !(v > 0))) throw new Error('filter critical frequencies must be greater than 0');
  if (w.length > 1 && !(w[0] < w[1])) throw new Error('Wn[0] must be less than Wn[1]');
  if (btype !== 'low' && btype !== 'high' && btype !== 'band') {
    throw new Error(`'${String(btype)}' is an invalid bandtype for filter.`);
  }
  if (!Number.isInteger(order) || order < 0) throw new Error('Filter order must be a nonnegative integer');
  if (w.some(v => v >= 1)) throw new Error('Digital filter critical frequencies must be 0 < Wn < 1');

  // Pre-warp so the bilinear transform (at fs = 2) puts the cutoffs exactly at wn
  const warped = w.map(v => 4 * Math.tan((Math.PI * v) / 2));
  let zpk = buttap(order);
  if (btype === 'band') {
    if (warped.length !== 2) {
      throw new Error('Wn must specify start and stop frequencies for bandpass or bandstop filter');
    }
    zpk = lp2bp(zpk, Math.sqrt(warped[0] * warped[1]), warped[1] - warped[0]);
  } else {
    if (warped.length !== 1) {
      throw new Error('Must specify a single critical frequency Wn for lowpass or highpass filter');
    }
    zpk = btype === 'low' ? lp2lp(zpk, warped[0]) : lp2hp(zpk, warped[0]);
  }
  return zpk2sos(bilinear(zpk, 2));
}

// ─── Filtering ────────────────────────────────────────────────────────

/** Validate an SOS array and pack it row-major into a Float64Array for the inner loop. */
function packSos(sos: Sos, requireNormalised: boolean): Float64Array {
  if (sos.length === 0 || sos.some(row => row.length !== 6)) {
    throw new Error('sos array must be shape (n_sections, 6)');
  }
  if (requireNormalised && sos.some(row => row[3] !== 1)) throw new Error('sos[:, 3] should be all ones');
  return Float64Array.from(sos.flat());
}

/**
 * Run the cascade over `y` in place (backwards when `reverse`), updating the
 * packed state `zi` ([z0, z1] per section).  Same operation order as SciPy's
 * `_sosfilt` kernel, direct form II transposed:
 *
 *     y   = b0·x + z0
 *     z0' = b1·x − a1·y + z1
 *     z1' = b2·x − a2·y
 */
function runCascade(coeffs: Float64Array, y: Float64Array, zi: Float64Array, reverse = false): void {
  const nSec = coeffs.length / 6;
  const n = y.length;
  for (let k = 0; k < n; k++) {
    const i = reverse ? n - 1 - k : k;
    let xCur = y[i];
    for (let s = 0; s < nSec; s++) {
      const c = s * 6;
      const z = s * 2;
      const xNew = coeffs[c] * xCur + zi[z];
      zi[z] = coeffs[c + 1] * xCur - coeffs[c + 4] * xNew + zi[z + 1];
      zi[z + 1] = coeffs[c + 2] * xCur - coeffs[c + 5] * xNew;
      xCur = xNew;
    }
    y[i] = xCur;
  }
}

const packState = (zi: number[][], nSec: number): Float64Array => {
  if (zi.length !== nSec || zi.some(r => r.length !== 2)) {
    throw new Error(`zi must have shape (${nSec}, 2) for an sos array with ${nSec} sections`);
  }
  return Float64Array.from(zi.flat());
};

const unpackState = (zi: Float64Array): number[][] =>
  Array.from({ length: zi.length / 2 }, (_, s) => [zi[2 * s], zi[2 * s + 1]]);

/** Filter `x` through the cascade, like `scipy.signal.sosfilt(sos, x, zi=zi)`; `zf` is the final state. */
export function sosfilt(sos: Sos, x: ArrayLike<number>, zi?: number[][]): { y: Float64Array; zf: number[][] } {
  const coeffs = packSos(sos, true);
  const state = zi ? packState(zi, sos.length) : new Float64Array(2 * sos.length);
  const y = Float64Array.from(x);
  runCascade(coeffs, y, state);
  return { y, zf: unpackState(state) };
}

/** Solve [[m00, m01], [m10, m11]]·x = r by Gaussian elimination with partial pivoting (as LAPACK). */
function solve2(m00: number, m01: number, m10: number, m11: number, r0: number, r1: number): [number, number] {
  if (Math.abs(m10) > Math.abs(m00)) {
    [m00, m01, m10, m11, r0, r1] = [m10, m11, m00, m01, r1, r0];
  }
  const l = m10 / m00;
  const u11 = m11 - l * m01;
  if (m00 === 0 || u11 === 0) throw new Error('Singular matrix');
  const x1 = (r1 - l * r0) / u11;
  return [(r0 - m01 * x1) / m00, x1];
}

/**
 * Initial state for a unit-step steady state, like `scipy.signal.sosfilt_zi`.
 * Scale by the first sample (`zi * x[0]`) to start the filter without a transient.
 *
 * Per section this is `lfilter_zi`: the state z with z = A·z + B for the DF-II
 * transposed state-space form (A = companion(a)ᵀ, B = b[1:] − a[1:]·b0), i.e.
 * (I − A)·z = B.  Each section's input is the previous sections' DC gain, so
 * its state is scaled by the cumulative ∑b / ∑a.
 */
export function sosfiltZi(sos: Sos): number[][] {
  packSos(sos, false);
  let scale = 1;
  return sos.map(row => {
    const a0 = row[3];
    if (a0 === 0) throw new Error('sos[:, 3] must be nonzero');
    const [b0, b1, b2, a1, a2] = [row[0] / a0, row[1] / a0, row[2] / a0, row[4] / a0, row[5] / a0];
    const [z0, z1] = solve2(1 + a1, -1, a2, 1, b1 - a1 * b0, b2 - a2 * b0);
    const zi = [scale * z0, scale * z1];
    scale *= (row[0] + row[1] + row[2]) / (row[3] + row[4] + row[5]);
    return zi;
  });
}

/** SciPy's default sosfiltfilt pad length; first-order sections (b2 = a2 = 0) count as fewer taps. */
function defaultPadlen(sos: Sos): number {
  const zeroB2 = sos.filter(row => row[2] === 0).length;
  const zeroA2 = sos.filter(row => row[5] === 0).length;
  return 3 * (2 * sos.length + 1 - Math.min(zeroB2, zeroA2));
}

/**
 * Zero-phase forward–backward filtering, like `scipy.signal.sosfiltfilt` with
 * its defaults: odd extension of `padlen` samples at both ends and
 * steady-state initial conditions for both passes.
 *
 * @throws RangeError when `x.length <= padlen` (SciPy raises ValueError).
 */
export function sosfiltfilt(sos: Sos, x: ArrayLike<number>): Float64Array {
  const coeffs = packSos(sos, true);
  const edge = defaultPadlen(sos);
  const n = x.length;
  if (n <= edge) {
    throw new RangeError(`The length of the input vector x must be greater than padlen, which is ${edge}.`);
  }
  // Odd extension: a 180° rotation of the signal about each end point
  const ext = new Float64Array(n + 2 * edge);
  const first = x[0];
  const last = x[n - 1];
  for (let i = 0; i < edge; i++) {
    ext[i] = 2 * first - x[edge - i];
    ext[edge + n + i] = 2 * last - x[n - 2 - i];
  }
  for (let i = 0; i < n; i++) ext[edge + i] = x[i];

  const zi = Float64Array.from(sosfiltZi(sos).flat());
  const state = zi.map(v => v * ext[0]);
  runCascade(coeffs, ext, state);
  const back = zi.map(v => v * ext[ext.length - 1]);
  runCascade(coeffs, ext, back, true);
  return ext.slice(edge, edge + n);
}

/**
 * Streaming cascade that keeps its own state between calls (`_CausalFilter`).
 * The state starts at the steady state for the first sample, so a signal that
 * starts at an offset produces no start-up transient.
 */
export class CausalFilter {
  readonly sos: Sos;
  private readonly coeffs: Float64Array;
  private readonly unitState: Float64Array;
  private zi: Float64Array | null = null;

  constructor(sos: Sos) {
    this.sos = sos;
    this.coeffs = packSos(sos, true);
    this.unitState = Float64Array.from(sosfiltZi(sos).flat());
  }

  process(x: ArrayLike<number>): Float64Array {
    const y = Float64Array.from(x);
    if (y.length === 0) return y;
    if (this.zi === null) {
      const x0 = y[0];
      this.zi = this.unitState.map(v => v * x0);
    }
    runCascade(this.coeffs, y, this.zi);
    return y;
  }
}

// ─── Peak finding ─────────────────────────────────────────────────────

/** Local maxima; a flat-topped peak reports its middle sample (rounded down), as `_local_maxima_1d`. */
function localMaxima(x: ArrayLike<number>): number[] {
  const peaks: number[] = [];
  const iMax = x.length - 1; // first and last samples can't be maxima
  let i = 1;
  while (i < iMax) {
    if (x[i - 1] < x[i]) {
      let ahead = i + 1;
      while (ahead < iMax && x[ahead] === x[i]) ahead++;
      if (x[ahead] < x[i]) {
        peaks.push((i + ahead - 1) >> 1);
        i = ahead;
      }
    }
    i++;
  }
  return peaks;
}

/** NaN-last ascending comparison, like NumPy's sort order. */
const ascending = (a: number, b: number): number =>
  Number.isNaN(a) ? (Number.isNaN(b) ? 0 : 1) : Number.isNaN(b) ? -1 : a - b;

/**
 * Keep peaks at least `distance` samples apart, visiting the highest first and
 * dropping its lower neighbours (`_select_by_peak_distance`).  Equal heights
 * are visited right to left (stable sort); NumPy's argsort is not stable for
 * more than 16 peaks, so large sets of exactly equal peaks may differ.
 */
function selectByDistance(peaks: number[], x: ArrayLike<number>, distance: number): number[] {
  const d = Math.ceil(distance);
  const keep = new Uint8Array(peaks.length).fill(1);
  const byHeight = peaks.map((_, i) => i).sort((i, j) => ascending(x[peaks[i]], x[peaks[j]]));
  for (let r = byHeight.length - 1; r >= 0; r--) {
    const j = byHeight[r];
    if (!keep[j]) continue;
    for (let k = j - 1; k >= 0 && peaks[j] - peaks[k] < d; k--) keep[k] = 0;
    for (let k = j + 1; k < peaks.length && peaks[k] - peaks[j] < d; k++) keep[k] = 0;
  }
  return peaks.filter((_, i) => keep[i]);
}

/**
 * Topographic prominence (`_peak_prominences` without a window): walk outwards
 * until a higher sample (or the edge) and take the lowest point on each side;
 * the higher of those two minima is the base.
 */
function prominence(x: ArrayLike<number>, peak: number): number {
  const h = x[peak];
  let leftMin = h;
  for (let i = peak; i >= 0 && x[i] <= h; i--) if (x[i] < leftMin) leftMin = x[i];
  let rightMin = h;
  for (let i = peak; i < x.length && x[i] <= h; i++) if (x[i] < rightMin) rightMin = x[i];
  return h - Math.max(leftMin, rightMin);
}

/**
 * Indices of peaks in `x`, like `scipy.signal.find_peaks(x, distance=…, prominence=…)`.
 * SciPy applies the distance condition first, then the minimum prominence
 * (computed against the whole signal, not just the surviving peaks).
 */
export function findPeaks(x: ArrayLike<number>, opts: { distance?: number; prominence?: number } = {}): number[] {
  const { distance, prominence: minProminence } = opts;
  if (distance !== undefined && !(distance >= 1)) throw new Error('`distance` must be greater or equal to 1');
  let peaks = localMaxima(x);
  if (distance !== undefined) peaks = selectByDistance(peaks, x, distance);
  if (minProminence !== undefined) peaks = peaks.filter(p => minProminence <= prominence(x, p));
  return peaks;
}

// ─── Numeric helpers shared by the core ───────────────────────────────

export function mean(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return s / x.length;
}

/** Population standard deviation (NumPy's default ddof = 0), two-pass. */
export function std(x: ArrayLike<number>): number {
  const m = mean(x);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2;
  return Math.sqrt(s / x.length);
}

const POW10 = Array.from({ length: 16 }, (_, i) => Number(`1e${i}`));

/**
 * Python's `round(x, ndigits)`: the decimal nearest to the exact binary value
 * of `x`, ties to even, returned as the nearest double.  The naive
 * `Math.round(x * 10**n) / 10**n` gets halves wrong (Python: round(0.125, 2)
 * = 0.12) and values like 0.15 whose product rounds up to an exact half.
 */
export function pyRound(x: number, ndigits: number): number {
  if (!Number.isInteger(ndigits) || ndigits < 0 || ndigits >= POW10.length) {
    throw new RangeError('ndigits must be an integer in 0..15');
  }
  if (!Number.isFinite(x) || Math.abs(x) >= 2 ** 52) return x;
  const p = POW10[ndigits];
  const y = Math.abs(x) * p;
  if (y < 1e9 && Math.abs(y - Math.floor(y) - 0.5) > 1e-6) {
    // Clear of a tie, so the rounding error of x·10ⁿ can't flip the result, and
    // k / 10ⁿ (both exact) is correctly rounded: the same double Python returns.
    return (Math.sign(x) * Math.round(y)) / p;
  }
  // Near a tie: decide on the exact decimal expansion (toFixed works on the exact value)
  const ax = Math.abs(x);
  const away = ax.toFixed(ndigits); // correctly rounded, ties away from zero
  const exact = ax.toFixed(100);
  const dot = exact.indexOf('.');
  let r = Number(away);
  if (/^50*$/.test(exact.slice(dot + 1 + ndigits))) {
    const truncated = exact.slice(0, ndigits === 0 ? dot : dot + 1 + ndigits);
    if ((truncated.charCodeAt(truncated.length - 1) - 48) % 2 === 0) r = Number(truncated);
  }
  return x < 0 ? -r : r;
}
