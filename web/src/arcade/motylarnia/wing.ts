/**
 * Wing geometry, pure and deterministic: the outline of each wing family (a right forewing and
 * hindwing, half-wingspan = 1, x away from the body, y down), and the polar map that lays the eaten
 * path onto them.  A ray from the wing root at angle φ leaves the wings at R(φ); a wing point is
 * (u, s): u sweeps from the forewing's leading edge (0) to the hindwing's inner edge (1), s from the
 * root (0) to the margin (1).  The leaf's long axis becomes u and its width becomes s, so a trail
 * along the leaf turns into a band that follows the veins, and a trail across it into a band parallel
 * to the margin — the way real butterfly patterns run.  Markings use the same coordinates.
 *
 * Also the butterfly's compact record of its path: ≤ 384 points of (x, y, appetite, silk) quantised
 * to three bytes each, as base64 (≤ 1.5 KB).
 */
import type { WingFamily } from './content';
import { LEAF_H, LEAF_W } from './leaf';

type Pt = [number, number];
/** [x, y] or [x, y, 1] for a sharp corner */
type Ctl = [number, number] | [number, number, 1];

const FAMILIES: Record<WingFamily, { fore: Ctl[]; hind: Ctl[]; tail?: boolean }> = {
  nymph: {
    fore: [[0.02, -0.02], [0.08, -0.2], [0.25, -0.45], [0.48, -0.64], [0.72, -0.76], [0.89, -0.8, 1], [0.95, -0.72], [0.9, -0.6], [0.86, -0.5], [0.9, -0.41, 1], [0.84, -0.28], [0.74, -0.14], [0.6, -0.02, 1], [0.4, 0.02], [0.2, 0.03], [0.06, 0.02]],
    hind: [[0.03, 0], [0.2, -0.06], [0.42, -0.08], [0.6, -0.04], [0.74, 0.06], [0.8, 0.2], [0.76, 0.32], [0.71, 0.42, 1], [0.6, 0.5], [0.48, 0.6], [0.36, 0.64], [0.24, 0.62], [0.14, 0.55], [0.07, 0.42], [0.03, 0.25], [0.02, 0.1]],
  },
  pierid: {
    fore: [[0.02, -0.02], [0.1, -0.25], [0.3, -0.5], [0.55, -0.66], [0.78, -0.72], [0.9, -0.66], [0.94, -0.52], [0.9, -0.34], [0.8, -0.16], [0.66, -0.03], [0.42, 0.02], [0.18, 0.03], [0.06, 0.02]],
    hind: [[0.03, 0], [0.25, -0.06], [0.5, -0.06], [0.7, 0.02], [0.8, 0.16], [0.79, 0.32], [0.7, 0.46], [0.54, 0.57], [0.36, 0.61], [0.2, 0.57], [0.09, 0.45], [0.04, 0.28], [0.02, 0.12]],
  },
  brimstone: {
    fore: [[0.02, -0.02], [0.12, -0.28], [0.34, -0.54], [0.6, -0.7], [0.87, -0.8, 1], [0.85, -0.66], [0.84, -0.46], [0.78, -0.26], [0.66, -0.08], [0.46, 0.01], [0.2, 0.03], [0.06, 0.02]],
    hind: [[0.03, 0], [0.26, -0.07], [0.52, -0.08], [0.7, 0], [0.78, 0.14], [0.79, 0.29, 1], [0.7, 0.42], [0.54, 0.55], [0.36, 0.61], [0.2, 0.58], [0.08, 0.44], [0.03, 0.24]],
  },
  swallowtail: {
    fore: [[0.02, -0.02], [0.1, -0.25], [0.3, -0.52], [0.56, -0.72], [0.82, -0.84], [0.94, -0.82, 1], [0.9, -0.62], [0.82, -0.42], [0.72, -0.22], [0.58, -0.06, 1], [0.38, 0], [0.18, 0.02], [0.06, 0.02]],
    hind: [[0.03, 0], [0.24, -0.05], [0.48, -0.05], [0.66, 0.04], [0.74, 0.16], [0.72, 0.27, 1], [0.66, 0.37], [0.6, 0.45, 1], [0.52, 0.52], [0.47, 0.58, 1], [0.46, 0.7], [0.45, 0.84], [0.41, 0.86], [0.39, 0.7], [0.37, 0.63, 1], [0.28, 0.62], [0.17, 0.57], [0.08, 0.46], [0.04, 0.3], [0.02, 0.12]],
    tail: true,
  },
  lycaenid: {
    fore: [[0.02, -0.02], [0.1, -0.24], [0.28, -0.47], [0.5, -0.62], [0.72, -0.68], [0.84, -0.62], [0.86, -0.45], [0.79, -0.26], [0.66, -0.1], [0.47, 0], [0.24, 0.03], [0.07, 0.02]],
    hind: [[0.03, 0], [0.24, -0.05], [0.47, -0.05], [0.64, 0.04], [0.73, 0.18], [0.71, 0.33], [0.6, 0.45], [0.44, 0.53], [0.27, 0.53], [0.13, 0.45], [0.05, 0.3], [0.02, 0.13]],
  },
  satyr: {
    fore: [[0.02, -0.02], [0.1, -0.26], [0.3, -0.5], [0.54, -0.66], [0.76, -0.72], [0.88, -0.64], [0.92, -0.48], [0.88, -0.3], [0.78, -0.14], [0.62, -0.02], [0.4, 0.02], [0.18, 0.03], [0.06, 0.02]],
    hind: [[0.03, 0], [0.24, -0.06], [0.48, -0.06], [0.66, 0.02], [0.76, 0.16], [0.77, 0.3], [0.7, 0.44], [0.56, 0.56], [0.4, 0.62], [0.24, 0.6], [0.12, 0.5], [0.05, 0.32], [0.02, 0.14]],
  },
  skipper: {
    fore: [[0.02, -0.02], [0.14, -0.26], [0.4, -0.5], [0.7, -0.66], [0.9, -0.7, 1], [0.88, -0.54], [0.8, -0.34], [0.66, -0.14], [0.46, -0.02], [0.22, 0.02], [0.06, 0.02]],
    hind: [[0.03, 0], [0.24, -0.06], [0.44, -0.04], [0.58, 0.06], [0.62, 0.2], [0.56, 0.34], [0.42, 0.44], [0.26, 0.46], [0.12, 0.38], [0.04, 0.22], [0.02, 0.1]],
  },
  hawk: {
    fore: [[0.02, -0.04], [0.16, -0.22], [0.42, -0.38], [0.7, -0.5], [0.94, -0.57, 1], [0.96, -0.48], [0.86, -0.36], [0.68, -0.2], [0.46, -0.06], [0.24, 0], [0.06, 0.01]],
    hind: [[0.03, 0], [0.2, -0.04], [0.38, -0.02], [0.5, 0.06], [0.54, 0.16], [0.48, 0.26], [0.36, 0.32], [0.22, 0.32], [0.1, 0.24], [0.04, 0.12]],
  },
  burnet: {
    fore: [[0.02, -0.04], [0.18, -0.24], [0.44, -0.42], [0.72, -0.54], [0.9, -0.58], [0.96, -0.5], [0.9, -0.4], [0.7, -0.26], [0.46, -0.12], [0.24, -0.02], [0.06, 0]],
    hind: [[0.03, 0], [0.2, -0.06], [0.4, -0.08], [0.56, -0.02], [0.62, 0.08], [0.56, 0.18], [0.42, 0.24], [0.26, 0.24], [0.12, 0.18], [0.04, 0.08]],
  },
};

/** Closed Catmull–Rom through control points; corners are kept sharp. */
function outline(ctl: Ctl[], per = 10): Pt[] {
  const n = ctl.length, out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const c1 = ctl[i], c2 = ctl[(i + 1) % n];
    // a corner ends the curve's tangent there: use the point itself as its own neighbour
    const p0 = c1.length === 3 ? c1 : ctl[(i - 1 + n) % n], p3 = c2.length === 3 ? c2 : ctl[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * c1[0] + (-p0[0] + c2[0]) * t + (2 * p0[0] - 5 * c1[0] + 4 * c2[0] - p3[0]) * t2 + (-p0[0] + 3 * c1[0] - 3 * c2[0] + p3[0]) * t3),
        0.5 * (2 * c1[1] + (-p0[1] + c2[1]) * t + (2 * p0[1] - 5 * c1[1] + 4 * c2[1] - p3[1]) * t2 + (-p0[1] + 3 * c1[1] - 3 * c2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}

export function pointInPoly(poly: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface WingShape {
  family: WingFamily;
  fore: Pt[];
  hind: Pt[];
  /** the root of the polar map */
  ox: number;
  oy: number;
  /** angles of u = 0 and u = 1 */
  phi0: number;
  phi1: number;
  /** R(φ) sampled over [phi0, phi1] */
  radius: Float32Array;
  /** u at equal steps of swept wing area (the path's map spreads evenly over the wings) */
  areaU: Float32Array;
  /** bounding box of both wings */
  minY: number;
  maxY: number;
  maxX: number;
}

const SAMPLES = 160;
const shapes = new Map<WingFamily, WingShape>();

const inWings = (fore: Pt[], hind: Pt[], x: number, y: number) => pointInPoly(fore, x, y) || pointInPoly(hind, x, y);

/** Distance from the root along angle `phi` to the first point outside both wings. */
function firstExit(fore: Pt[], hind: Pt[], ox: number, oy: number, phi: number): number {
  const c = Math.cos(phi), s = Math.sin(phi);
  let r = 0;
  while (r < 1.6 && inWings(fore, hind, ox + c * r, oy + s * r)) r += 0.004;
  return r;
}

export function wingShape(family: WingFamily): WingShape {
  const hit = shapes.get(family);
  if (hit) return hit;
  const f = FAMILIES[family];
  let fore = outline(f.fore), hind = outline(f.hind);
  // normalise: the farthest wing point is 1 from the body
  const maxX0 = Math.max(...fore.map(p => p[0]), ...hind.map(p => p[0]));
  fore = fore.map(([x, y]) => [x / maxX0, y / maxX0]);
  hind = hind.map(([x, y]) => [x / maxX0, y / maxX0]);
  const ox = 0.07, oy = 0;
  // the angular span: the rays that cross a real stretch of wing
  const probe: number[] = [];
  for (let a = -100; a <= 100; a++) probe.push(firstExit(fore, hind, ox, oy, (a * Math.PI) / 180));
  let lo = 100, hi = 100;
  while (lo > 0 && probe[lo - 1] >= 0.24) lo--;
  while (hi < 200 && probe[hi + 1] >= 0.24) hi++;
  const phi0 = ((lo - 100 + 2) * Math.PI) / 180, phi1 = ((hi - 100 - 2) * Math.PI) / 180;
  const radius = new Float32Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) radius[i] = firstExit(fore, hind, ox, oy, phi0 + ((phi1 - phi0) * i) / SAMPLES);
  // cumulative swept area ∝ ∫R² du, inverted at equal steps
  const cum = new Float64Array(SAMPLES + 1);
  for (let i = 1; i <= SAMPLES; i++) cum[i] = cum[i - 1] + (radius[i - 1] ** 2 + radius[i] ** 2) / 2;
  const areaU = new Float32Array(SAMPLES + 1);
  for (let k = 0, i = 0; k <= SAMPLES; k++) {
    const want = (k / SAMPLES) * cum[SAMPLES];
    while (i < SAMPLES - 1 && cum[i + 1] < want) i++;
    const seg = cum[i + 1] - cum[i] || 1;
    areaU[k] = (i + Math.min(1, Math.max(0, (want - cum[i]) / seg))) / SAMPLES;
  }
  const ys = [...fore, ...hind].map(p => p[1]);
  const shape: WingShape = {
    family, fore, hind, ox, oy, phi0, phi1, radius, areaU,
    minY: Math.min(...ys), maxY: Math.max(...ys), maxX: 1,
  };
  shapes.set(family, shape);
  return shape;
}

/** R at u (0..1), interpolated. */
export function radiusAt(w: WingShape, u: number): number {
  const x = Math.min(1, Math.max(0, u)) * SAMPLES, i = Math.min(SAMPLES - 1, Math.floor(x)), f = x - i;
  return w.radius[i] * (1 - f) + w.radius[i + 1] * f;
}

/** Polar wing coordinates → wing point; `out` is reused. */
export function wingPoint(w: WingShape, u: number, s: number, out: { x: number; y: number }): { x: number; y: number } {
  const phi = w.phi0 + (w.phi1 - w.phi0) * u, r = s * radiusAt(w, u);
  out.x = w.ox + Math.cos(phi) * r;
  out.y = w.oy + Math.sin(phi) * r;
  return out;
}

export const insideWing = (w: WingShape, x: number, y: number): boolean => inWings(w.fore, w.hind, x, y);

/**
 * One recorded point of the eaten path: leaf position, appetite (0..1), whether it was silk, and
 * (during play only, not stored) whether the signal was bad when it was taken.
 */
export interface PathPoint { x: number; y: number; a: number; silk: boolean; bad?: boolean }

/** A mapped point of the wing's band: wing position and the band's width (half-wingspan units). */
export interface BandPoint { x: number; y: number; w: number; silk: boolean }

/** How far into the wing the leaf's width reaches (s) and the band widths (half-wingspan units). */
const S_IN = 0.12, S_OUT = 0.9;

/** Equal-area wing coordinates: leaf fractions (fx across, fy along) → (u, s) so the path keeps its density. */
export function areaUS(w: WingShape, fx: number, fy: number): [number, number] {
  const x = Math.min(1, Math.max(0, fy)) * SAMPLES, i = Math.min(SAMPLES - 1, Math.floor(x)), f = x - i;
  const u = w.areaU[i] * (1 - f) + w.areaU[i + 1] * f;
  const s = Math.sqrt(S_IN * S_IN + (S_OUT * S_OUT - S_IN * S_IN) * Math.min(1, Math.max(0, fx)));
  return [u, s];
}
export const BAND_MIN = 0.016, BAND_MAX = 0.064;

/**
 * Lay the eaten path onto the wing: leaf y → u, leaf x → s (both through a light smoothing, so the
 * band is calm even where the caterpillar wobbled), appetite → band width.
 */
export function mapPath(w: WingShape, path: readonly PathPoint[], box: { x0: number; y0: number; x1: number; y1: number } = { x0: 0, y0: 0, x1: LEAF_W, y1: LEAF_H }): BandPoint[] {
  const n = path.length, out: BandPoint[] = [];
  if (!n) return out;
  const p = { x: 0, y: 0 };
  for (let i = 0; i < n; i++) {
    // a 5-point moving average of position and appetite
    let sx = 0, sy = 0, sa = 0, k = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
      sx += path[j].x; sy += path[j].y; sa += path[j].a; k++;
    }
    const fx = Math.min(1, Math.max(0, (sx / k - box.x0) / (box.x1 - box.x0 || 1)));
    const fy = Math.min(1, Math.max(0, (sy / k - box.y0) / (box.y1 - box.y0 || 1)));
    const [u, s] = areaUS(w, fx, fy);
    wingPoint(w, u, s, p);
    out.push({ x: p.x, y: p.y, w: BAND_MIN + (BAND_MAX - BAND_MIN) * Math.min(1, Math.max(0, sa / k)), silk: path[i].silk });
  }
  return out;
}

// ── the compact path record ─────────────────────────────────────────
export const PATH_MAX = 384;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0, n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1] ?? 'A') << 12) | (Math.max(0, B64.indexOf(clean[i + 2] ?? 'A')) << 6) | Math.max(0, B64.indexOf(clean[i + 3] ?? 'A'));
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** Evenly resample by arc length to at most `max` points (keeps the ends; silk from the nearest). */
export function resamplePath(path: readonly PathPoint[], max = PATH_MAX): PathPoint[] {
  if (path.length <= max) return path.slice();
  const cum = new Float64Array(path.length);
  for (let i = 1; i < path.length; i++) cum[i] = cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  const total = cum[path.length - 1], out: PathPoint[] = [];
  let j = 0;
  for (let k = 0; k < max; k++) {
    const d = (k / (max - 1)) * total;
    while (j < path.length - 2 && cum[j + 1] < d) j++;
    const a = path[j], b = path[j + 1], seg = cum[j + 1] - cum[j] || 1, t = Math.min(1, (d - cum[j]) / seg);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: a.a + (b.a - a.a) * t, silk: t < 0.5 ? a.silk : b.silk });
  }
  return out;
}

export function encodePath(path: readonly PathPoint[]): string {
  const pts = resamplePath(path);
  const bytes = new Uint8Array(pts.length * 3);
  pts.forEach((p, i) => {
    bytes[i * 3] = Math.round((Math.min(LEAF_W, Math.max(0, p.x)) / LEAF_W) * 255);
    bytes[i * 3 + 1] = Math.round((Math.min(LEAF_H, Math.max(0, p.y)) / LEAF_H) * 255);
    bytes[i * 3 + 2] = (Math.round(Math.min(1, Math.max(0, p.a)) * 15) << 1) | (p.silk ? 1 : 0);
  });
  return toBase64(bytes);
}

export function decodePath(s: string): PathPoint[] {
  const b = fromBase64(s), out: PathPoint[] = [];
  for (let i = 0; i + 2 < b.length; i += 3) {
    out.push({ x: (b[i] / 255) * LEAF_W, y: (b[i + 1] / 255) * LEAF_H, a: (b[i + 2] >> 1) / 15, silk: (b[i + 2] & 1) === 1 });
  }
  return out;
}

/**
 * A made-up path drawn the way the game draws one (a crawl with a capped turn toward wandering
 * targets): for the lobby's generic butterflies and for checking that any scribble makes a good wing.
 */
export function scribble(rng: () => number, points = 300): PathPoint[] {
  // waypoints: one in each cell of a 3 × 4 grid over the leaf, visited in a random order (as a player
  // steering from dot to dot)
  const cells: [number, number][] = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) cells.push([30 + (i + 0.15 + 0.7 * rng()) * ((LEAF_W - 60) / 3), 30 + (j + 0.15 + 0.7 * rng()) * ((LEAF_H - 60) / 4)]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const out: PathPoint[] = [];
  let x = LEAF_W / 2, y = LEAF_H * 0.82, h = -Math.PI / 2, a = 0, next = 0;
  let [tx, ty] = cells[0];
  for (let i = 0; i < points; i++) {
    if (Math.hypot(tx - x, ty - y) < 26) { next = (next + 1) % cells.length; [tx, ty] = cells[next]; }
    let d = Math.atan2(ty - y, tx - x) - h;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    h += Math.max(-0.42, Math.min(0.42, d));
    x = Math.min(LEAF_W - 20, Math.max(20, x + Math.cos(h) * 8));
    y = Math.min(LEAF_H - 20, Math.max(20, y + Math.sin(h) * 8));
    a += ((i > 40 ? 0.5 + 0.5 * Math.sin(i / 37 + rng()) : 0) - a) * 0.08;
    out.push({ x, y, a: Math.min(1, Math.max(0, a)), silk: i > 150 && i < 190 });
  }
  return out;
}
