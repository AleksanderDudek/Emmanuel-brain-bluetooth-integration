/**
 * The clay on the wheel, as numbers only (no DOM): a surface of revolution — its height H (cm) and
 * its outer radius r[k] (cm) at 16 rings, u_k = k/15 from the foot to the rim — shaped the way Let's
 * Create! Pottery shapes it: a finger on the wall pulls the wall to the finger at that height (in =
 * narrower, out = wider) under a soft brush, and a finger at the rim pulls the clay up or presses it
 * down.  The order is a target of the same kind (its height and its radii), and the match compares
 * the two ring by ring.
 *
 * The band's steadiness S (0..1, 0.5 at the threshold) is how still the wheel runs: the wobble
 * (1 − S) roughens every stroke, a steady wheel follows the finger faster and trues the wall by
 * itself, and from `magnetAt` a stroke close to the order snaps onto it (the clay obeys).
 */
import { RULES } from './rules';

export const RINGS = 16;
/** The rings' heights as a share of the vessel's height, foot (0) to rim (1). */
export const U: Float64Array = Float64Array.from({ length: RINGS }, (_, k) => k / (RINGS - 1));

/** What an order asks of the clay: its height (cm) and its outer radius (cm) at the 16 rings. */
export interface Target { H: number; r: Float64Array }

/**
 * The target profile at the 16 rings from control points (u, q) with q = radius ÷ height,
 * interpolated with a monotone cubic (Fritsch–Carlson), so the outline never overshoots.
 */
export function profileFrom(points: readonly (readonly [number, number])[]): Float64Array {
  const n = points.length;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  const out = new Float64Array(RINGS);
  for (let k = 0; k < RINGS; k++) {
    const u = U[k];
    let i = 0;
    while (i < n - 2 && u > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = (u - xs[i]) / h;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    out[k] = h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  }
  return out;
}

/** A target from a form's height (cm) and its profile (radius ÷ height at the rings). */
export function targetOf(N: number, q: ArrayLike<number>): Target {
  const r = new Float64Array(RINGS);
  for (let k = 0; k < RINGS; k++) r[k] = Math.max(RULES.rMin, q[k] * N);
  return { H: N, r };
}

export const widestOf = (r: ArrayLike<number>): number => {
  let m = 0;
  for (let k = 0; k < RINGS; k++) m = Math.max(m, r[k]);
  return m;
};

/** How close a shape is to the order, 0..1. */
export function matchOf(H: number, r: ArrayLike<number>, t: Target): number {
  let e = 0;
  for (let k = 0; k < RINGS; k++) e += Math.abs(r[k] - t.r[k]) / Math.max(1, t.r[k]);
  e /= RINGS;
  const eh = Math.abs(H - t.H) / t.H;
  return Math.min(1, Math.max(0, 1 - RULES.ringW * e - RULES.heightW * eh));
}

/** The ring furthest from the order and which way it should go (+1 wider, −1 narrower); k = −1 for the height. */
export interface Worst { k: number; dir: number; err: number }

export class Pot {
  readonly r = new Float64Array(RINGS);
  H = 1;
  /** the limits for this order */
  readonly hLo: number;
  readonly hHi: number;
  readonly rHi: number;
  /** strokes and height moves so far (the view's squelches; the tests) */
  strokes = 0;

  constructor(readonly target: Target) {
    this.hLo = RULES.hMin * target.H;
    this.hHi = RULES.hMax * target.H;
    this.rHi = RULES.rMax * widestOf(target.r);
    this.lump();
  }

  /** A fresh lump, a little tapered: about half the order's height, its mean radius and a bit. */
  lump(): void {
    const t = this.target;
    let mean = 0;
    for (let k = 0; k < RINGS; k++) mean += t.r[k];
    mean /= RINGS;
    this.H = RULES.lumpH * t.H;
    for (let k = 0; k < RINGS; k++) this.r[k] = Math.min(this.rHi, mean * RULES.lumpR * (1.06 - 0.14 * U[k] * U[k]));
  }

  get match(): number { return matchOf(this.H, this.r, this.target); }

  /** The radius (cm) at height u through the rings (linear). */
  at(u: number): number {
    const f = Math.min(RINGS - 1, Math.max(0, u * (RINGS - 1)));
    const i = Math.min(RINGS - 2, Math.floor(f)), s = f - i;
    return this.r[i] + (this.r[i + 1] - this.r[i]) * s;
  }

  /** The order's radius (cm) at height u. */
  targetAt(u: number): number {
    const t = this.target.r;
    const f = Math.min(RINGS - 1, Math.max(0, u * (RINGS - 1)));
    const i = Math.min(RINGS - 2, Math.floor(f)), s = f - i;
    return t[i] + (t[i + 1] - t[i]) * s;
  }

  /**
   * A finger on the wall at height u (0..1 of the pot) and `d` cm from the axis, for `dt` s: the
   * wall under the brush moves toward the finger.  `steady` 0..1; `noise` −1..1 per ring (the
   * wobble's roughness, from the caller's generator).
   */
  wall(u: number, d: number, dt: number, steady: number, noise: (k: number) => number): void {
    if (!(dt > 0)) return;
    const R = RULES, s = clamp01(steady);
    const rate = R.follow[0] + (R.follow[1] - R.follow[0]) * s;
    const wob = 1 - s;
    const want = Math.min(this.rHi, Math.max(R.rMin, d));
    for (let k = 0; k < RINGS; k++) {
      const z = (U[k] - u) / R.brush;
      const w = Math.exp(-0.5 * z * z);
      if (w < 0.02) continue;
      let goal = want + R.rough * wob * noise(k);
      const tk = this.target.r[k];
      if (s >= R.magnetAt && Math.abs(want - tk) <= R.magnet * Math.max(tk, 1.5)) goal = tk;
      const a = 1 - Math.exp(-rate * w * dt);
      this.r[k] += (goal - this.r[k]) * a;
    }
    this.clamp();
    this.strokes++;
  }

  /** A finger at the rim: the height moves toward `Hwant` (cm). */
  height(Hwant: number, dt: number): void {
    if (!(dt > 0)) return;
    const want = Math.min(this.hHi, Math.max(this.hLo, Hwant));
    this.H += (want - this.H) * (1 - Math.exp(-RULES.followH * dt));
    this.H = Math.min(this.hHi, Math.max(this.hLo, this.H));
    this.strokes++;
  }

  /** The turning wheel trues the wall a little (more when it runs steady): a light smoothing. */
  true_(dt: number, steady: number): void {
    const k = Math.min(0.5, RULES.trueRate * clamp01(steady) * dt);
    if (k <= 0) return;
    const prev = Float64Array.from(this.r);
    for (let i = 1; i < RINGS - 1; i++) this.r[i] += ((prev[i - 1] + prev[i + 1]) / 2 - prev[i]) * k;
    this.clamp();
  }

  /** Move a share `k` (0..1) of the way toward the order. */
  toward(k: number): void {
    const a = clamp01(k), t = this.target;
    for (let i = 0; i < RINGS; i++) this.r[i] += (t.r[i] - this.r[i]) * a;
    this.H += (t.H - this.H) * a;
    this.clamp();
  }

  /** The share toward the order that lifts the match to `goal` (0 when it is already there). */
  shareFor(goal: number): number {
    const m = this.match;
    if (m >= goal) return 0;
    return clamp01(1 - (1 - goal) / Math.max(1e-6, 1 - m));
  }

  /** The ring furthest from the order (relative), or the height when that is worse. */
  worst(): Worst {
    let best: Worst = { k: -1, dir: Math.sign(this.target.H - this.H), err: Math.abs(this.H - this.target.H) / this.target.H };
    for (let k = 0; k < RINGS; k++) {
      const tk = this.target.r[k], e = Math.abs(this.r[k] - tk) / Math.max(1, tk);
      if (e > best.err) best = { k, dir: Math.sign(tk - this.r[k]), err: e };
    }
    return best;
  }

  /** A snapshot of the shape. */
  snap(): { H: number; r: Float64Array } { return { H: this.H, r: Float64Array.from(this.r) }; }

  /** Set the shape (a blend between two snapshots: the master's hand animates through it). */
  blend(a: { H: number; r: Float64Array }, b: { H: number; r: Float64Array }, k: number): void {
    const s = clamp01(k);
    for (let i = 0; i < RINGS; i++) this.r[i] = a.r[i] + (b.r[i] - a.r[i]) * s;
    this.H = a.H + (b.H - a.H) * s;
  }

  private clamp(): void {
    let wide = 0;
    for (let k = 0; k < RINGS; k++) {
      const v = this.r[k];
      this.r[k] = Number.isFinite(v) ? Math.min(this.rHi, Math.max(RULES.rMin, v)) : RULES.rMin;
      wide = Math.max(wide, this.r[k]);
    }
    this.r[0] = Math.max(this.r[0], RULES.foot * wide);
    if (!Number.isFinite(this.H)) this.H = this.target.H * RULES.lumpH;
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
