/**
 * The leaf the caterpillar eats, as pure geometry in "leaf space": a 360 × 540 box with the leaf's
 * tip at the top and its stalk at the bottom (the renderer turns it sideways on wide screens).
 *
 * A host plant is one or more leaflets (a nettle is one, a clover three, a bedstraw whorl six), each
 * a smoothed outline from a half-profile, mirrored, with its own margin (saw teeth, scallops, waves).
 * The eaten area is counted on a coarse 96 × 144 grid; a signed distance field on the same grid (exact
 * Euclidean, Felzenszwalb–Huttenlocher) keeps the caterpillar on the leaf and lets it curl along the
 * edge.  Veins are returned as polylines for the painter.  Everything here is deterministic.
 */
import type { PlantId } from './content';

export const LEAF_W = 360;
export const LEAF_H = 540;
export const GRID_W = 96;
export const GRID_H = 144;
export const CELL = LEAF_W / GRID_W;   // 3.75 leaf units

type Pt = [number, number];
type Profile = Pt[];
type Margin = 'serrate' | 'crenate' | 'wavy' | 'entire' | 'lobed';
type Venation = 'pinnate' | 'arched' | 'parallel' | 'palmate' | 'none';

interface LeafletSpec {
  base: Pt;
  /** degrees, 0 = toward the top of the leaf, clockwise positive */
  angle: number;
  length: number;
  /** largest half-width */
  width: number;
  profile: Profile;
  margin: Margin;
  teeth: number;
  depth: number;
  veins: number;
  venation: Venation;
}

interface PlantShape { leaflets: LeafletSpec[]; start: [number, number, number]; stalk: Pt[] }

// Right halves of leaflet outlines: [half-width fraction, position from the base (0) to the tip (1)].
const P = {
  cordate: [[0, 0.045], [0.42, -0.015], [0.8, 0.07], [0.98, 0.22], [1, 0.38], [0.9, 0.55], [0.7, 0.72], [0.44, 0.86], [0.18, 0.96], [0, 1]],
  round: [[0, 0], [0.34, 0.015], [0.66, 0.09], [0.89, 0.23], [0.99, 0.42], [1, 0.6], [0.91, 0.77], [0.72, 0.9], [0.42, 0.98], [0, 1]],
  elliptic: [[0, 0], [0.3, 0.025], [0.64, 0.11], [0.89, 0.28], [1, 0.5], [0.95, 0.69], [0.76, 0.85], [0.47, 0.955], [0.17, 0.995], [0, 1]],
  obovate: [[0, 0], [0.26, 0.05], [0.58, 0.18], [0.86, 0.38], [0.99, 0.6], [0.96, 0.8], [0.76, 0.94], [0.44, 0.995], [0.16, 0.975], [0, 0.93]],
  blade: [[0, 0], [0.72, 0.01], [0.97, 0.08], [1, 0.3], [0.94, 0.55], [0.78, 0.75], [0.5, 0.9], [0.2, 0.975], [0, 1]],
  hastate: [[0, 0.06], [0.56, -0.035], [0.92, -0.005], [0.86, 0.1], [0.78, 0.2], [0.84, 0.36], [0.78, 0.56], [0.6, 0.74], [0.36, 0.89], [0.12, 0.98], [0, 1]],
  reniform: [[0, 0.1], [0.36, -0.03], [0.74, 0.05], [0.97, 0.24], [1, 0.44], [0.9, 0.64], [0.67, 0.82], [0.37, 0.95], [0, 1]],
  lance: [[0, 0], [0.5, 0.04], [0.86, 0.16], [1, 0.36], [0.94, 0.56], [0.74, 0.74], [0.46, 0.88], [0.18, 0.97], [0, 1]],
  strip: [[0, -0.01], [0.9, 0], [1, 0.08], [1, 0.92], [0.9, 1], [0, 1.01]],
} satisfies Record<string, Pt[]>;

const leaflet = (base: Pt, angle: number, length: number, width: number, profile: Profile, margin: Margin, teeth: number, depth: number, veins: number, venation: Venation): LeafletSpec =>
  ({ base, angle, length, width, profile, margin, teeth, depth, veins, venation });

const SHAPES: Record<PlantId, PlantShape> = {
  pokrzywa: { leaflets: [leaflet([180, 512], 0, 474, 160, P.cordate, 'serrate', 15, 10, 5, 'arched')], start: [180, 430, 0], stalk: [[180, 512], [178, 548]] },
  kapusta: { leaflets: [leaflet([180, 520], 0, 488, 164, P.round, 'wavy', 7, 10, 6, 'pinnate')], start: [180, 440, 0], stalk: [[180, 520], [181, 552]] },
  rzezucha: {
    leaflets: [
      leaflet([180, 300], 0, 268, 140, P.round, 'wavy', 5, 5, 4, 'pinnate'),
      leaflet([180, 360], -58, 175, 84, P.round, 'wavy', 3, 4, 3, 'pinnate'),
      leaflet([180, 360], 58, 175, 84, P.round, 'wavy', 3, 4, 3, 'pinnate'),
      leaflet([180, 452], -64, 140, 72, P.round, 'wavy', 3, 4, 2, 'pinnate'),
      leaflet([180, 452], 64, 140, 72, P.round, 'wavy', 3, 4, 2, 'pinnate'),
      leaflet([180, 518], 0, 236, 30, P.strip, 'entire', 0, 0, 0, 'none'),
    ],
    start: [180, 420, 0], stalk: [[180, 518], [180, 552]],
  },
  kruszyna: { leaflets: [leaflet([180, 520], 0, 494, 150, P.elliptic, 'entire', 0, 0, 8, 'arched')], start: [180, 440, 0], stalk: [[180, 520], [179, 550]] },
  koniczyna: {
    leaflets: [
      leaflet([180, 272], 0, 200, 110, P.obovate, 'serrate', 16, 3, 9, 'parallel'),
      leaflet([180, 272], 120, 160, 90, P.obovate, 'serrate', 15, 3, 9, 'parallel'),
      leaflet([180, 272], -120, 160, 90, P.obovate, 'serrate', 15, 3, 9, 'parallel'),
    ],
    start: [180, 268, 0], stalk: [[180, 280], [184, 552]],
  },
  trawa: {
    leaflets: [
      leaflet([180, 522], 0, 498, 64, P.blade, 'entire', 0, 0, 5, 'parallel'),
      leaflet([172, 522], -19, 446, 60, P.blade, 'entire', 0, 0, 5, 'parallel'),
      leaflet([188, 522], 19, 446, 60, P.blade, 'entire', 0, 0, 5, 'parallel'),
    ],
    start: [180, 460, 0], stalk: [[180, 522], [180, 552]],
  },
  szczaw: { leaflets: [leaflet([180, 508], 0, 488, 150, P.hastate, 'wavy', 6, 5, 7, 'pinnate')], start: [180, 420, 0], stalk: [[180, 508], [182, 552]] },
  fiolek: { leaflets: [leaflet([180, 470], 0, 438, 163, P.reniform, 'crenate', 13, 6, 5, 'palmate')], start: [180, 360, 0], stalk: [[180, 432], [176, 552]] },
  przytulia: {
    leaflets: [
      leaflet([180, 276], 0, 250, 72, P.lance, 'entire', 0, 0, 0, 'parallel'),
      leaflet([180, 276], 180, 246, 72, P.lance, 'entire', 0, 0, 0, 'parallel'),
      leaflet([180, 276], 57, 192, 68, P.lance, 'entire', 0, 0, 0, 'parallel'),
      leaflet([180, 276], -57, 192, 68, P.lance, 'entire', 0, 0, 0, 'parallel'),
      leaflet([180, 276], 123, 192, 68, P.lance, 'entire', 0, 0, 0, 'parallel'),
      leaflet([180, 276], -123, 192, 68, P.lance, 'entire', 0, 0, 0, 'parallel'),
    ],
    start: [180, 300, 0], stalk: [[180, 276], [180, 552]],
  },
  marchew: {
    leaflets: [
      leaflet([180, 212], 0, 184, 72, P.lance, 'lobed', 5, 12, 4, 'pinnate'),
      leaflet([180, 260], -52, 168, 66, P.lance, 'lobed', 5, 11, 3, 'pinnate'),
      leaflet([180, 260], 52, 168, 66, P.lance, 'lobed', 5, 11, 3, 'pinnate'),
      leaflet([180, 350], -58, 172, 66, P.lance, 'lobed', 5, 11, 3, 'pinnate'),
      leaflet([180, 350], 58, 172, 66, P.lance, 'lobed', 5, 11, 3, 'pinnate'),
      leaflet([180, 440], -62, 150, 60, P.lance, 'lobed', 4, 10, 3, 'pinnate'),
      leaflet([180, 440], 62, 150, 60, P.lance, 'lobed', 4, 10, 3, 'pinnate'),
      leaflet([180, 522], 0, 326, 36, P.strip, 'entire', 0, 0, 0, 'none'),
    ],
    start: [180, 430, 0], stalk: [[180, 522], [180, 552]],
  },
};

/** One leaflet for the painter: its outline, its veins, and its axis (base, direction, size). */
export interface LeafletArt {
  outline: Float32Array;
  veins: { pts: Float32Array; w: number }[];
  x: number;
  y: number;
  /** radians, 0 = toward the top of the leaf */
  angle: number;
  length: number;
  width: number;
}

export interface LeafModel {
  plant: PlantId;
  /** outline of every leaflet (closed polygons, x/y pairs) */
  outlines: Float32Array[];
  /** the leaflets bottom layer first (the first leaflet of a plant lies on top) */
  layers: LeafletArt[];
  /** 1 = the cell centre is on the leaf */
  inside: Uint8Array;
  insideCount: number;
  /** signed distance to the leaf's edge per cell (leaf units; negative outside) */
  dist: Float32Array;
  /** midribs and veins for the painter: [polyline, width] */
  veins: { pts: Float32Array; w: number }[];
  stalk: Pt[];
  start: { x: number; y: number; heading: number };
  /** the leaflets' bounding box: the renderer zooms it to fill the screen */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** size of this leaf against a typical one (√ of the area ratio): the caterpillar, its bites and
   *  the dots scale with it, so every plant plays the same in proportion */
  k: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Closed Catmull–Rom spline through `pts`, `per` samples per segment. */
function spline(pts: Pt[], per: number): Pt[] {
  const n = pts.length, out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}

/** Resample a closed polyline to `n` points evenly spaced along its length. */
function resample(pts: Pt[], n: number): Pt[] {
  const m = pts.length, cum = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % m];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const total = cum[m], out: Pt[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    while (j < m - 1 && cum[j + 1] < d) j++;
    const a = pts[j], b = pts[(j + 1) % m], seg = cum[j + 1] - cum[j] || 1, t = (d - cum[j]) / seg;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const signedArea = (pts: Pt[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

/** Margin offset (in units of `depth`) at tooth phase x. */
function tooth(margin: Margin, x: number): number {
  const f = x - Math.floor(x);
  switch (margin) {
    case 'serrate': return f ** 1.5 - 0.42;
    case 'crenate': return Math.abs(Math.sin(Math.PI * x)) - 0.62;
    case 'wavy': return 0.5 * Math.sin(2 * Math.PI * x);
    case 'lobed': return Math.abs(Math.sin(Math.PI * x)) ** 0.55 - 0.72;
    default: return 0;
  }
}

/** One leaflet's outline in leaf space, with its margin, and its half-width profile (64 bins). */
function leafletOutline(s: LeafletSpec): { pts: Pt[]; halfWidth: Float32Array } {
  // local frame: x across (right positive), y from the base (0) to the tip (1)
  const right = s.profile;
  const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y] as Pt);
  const loop = spline([...right, ...left], 24);
  const local = resample(loop, 420);
  const halfWidth = new Float32Array(64);
  for (const [x, y] of local) {
    const bin = Math.max(0, Math.min(63, Math.floor(y * 64)));
    halfWidth[bin] = Math.max(halfWidth[bin], Math.abs(x));
  }
  const a = rad(s.angle), dir: Pt = [Math.sin(a), -Math.cos(a)], perp: Pt = [Math.cos(a), Math.sin(a)];
  const toLeaf = (x: number, y: number): Pt => [
    s.base[0] + dir[0] * y * s.length + perp[0] * x * s.width,
    s.base[1] + dir[1] * y * s.length + perp[1] * x * s.width,
  ];
  let pts = local.map(([x, y]) => toLeaf(x, y));
  if (s.margin !== 'entire' && s.depth > 0) {
    // arc position along each half (base → tip) gives the tooth phase
    const n = local.length, tipIdx = local.reduce((best, p, i) => (p[1] > local[best][1] ? i : best), 0);
    const area = signedArea(pts), out: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
      let dx = next[0] - prev[0], dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const nx = area > 0 ? dy : -dy, ny = area > 0 ? -dx : dx;
      const onRight = i <= tipIdx;
      const t = onRight ? i / tipIdx : (n - i) / (n - tipIdx);
      const env = smooth(0.04, 0.14, t) * (1 - smooth(0.9, 0.985, t));
      const off = s.depth * tooth(s.margin, t * s.teeth) * env;
      out.push([pts[i][0] + nx * off, pts[i][1] + ny * off]);
    }
    pts = out;
  }
  return { pts, halfWidth };
}

function veinsOf(s: LeafletSpec, halfWidth: Float32Array): { pts: Float32Array; w: number }[] {
  const out: { pts: Float32Array; w: number }[] = [];
  if (s.venation === 'none') return out;
  const a = rad(s.angle), dir: Pt = [Math.sin(a), -Math.cos(a)], perp: Pt = [Math.cos(a), Math.sin(a)];
  const at = (x: number, y: number): [number, number] => [
    s.base[0] + dir[0] * y * s.length + perp[0] * x * s.width,
    s.base[1] + dir[1] * y * s.length + perp[1] * x * s.width,
  ];
  const hw = (y: number) => halfWidth[Math.max(0, Math.min(63, Math.floor(y * 64)))];
  const line = (f: (t: number) => [number, number], steps: number, w: number) => {
    const arr = new Float32Array((steps + 1) * 2);
    for (let i = 0; i <= steps; i++) {
      const [x, y] = f(i / steps);
      const p = at(x, y);
      arr[i * 2] = p[0];
      arr[i * 2 + 1] = p[1];
    }
    out.push({ pts: arr, w });
  };
  const mid = Math.max(3, s.width * 0.05);
  if (s.venation !== 'parallel') line(t => [0.012 * Math.sin(t * 3), 0.02 + t * 0.94], 24, mid);
  const n = s.veins;
  if (s.venation === 'pinnate' || s.venation === 'arched') {
    const rise = s.venation === 'arched' ? 0.2 : 0.12;
    for (let i = 0; i < n; i++) {
      const y0 = 0.1 + (i / n) * 0.72, reach = 0.84 - 0.18 * (i / n);
      for (const side of [1, -1]) {
        line(t => {
          const y = y0 + rise * t ** 1.3 * (1 - 0.3 * (i / n));
          return [side * reach * hw(y) * t, y];
        }, 12, mid * (0.55 - 0.25 * (i / n)));
      }
    }
  } else if (s.venation === 'parallel') {
    const k = Math.max(3, n);
    for (let i = 0; i < k; i++) {
      const f = k === 1 ? 0 : -0.7 + (1.4 * i) / (k - 1);
      line(t => {
        const y = 0.02 + t * 0.95;
        return [f * hw(y) * (1 - 0.05 * t), y];
      }, 20, f === 0 ? mid * 0.9 : mid * 0.45);
    }
  } else if (s.venation === 'palmate') {
    for (let i = 0; i < n; i++) {
      const ang = -1.15 + (2.3 * i) / (n - 1);
      if (Math.abs(ang) < 0.1) continue;
      line(t => {
        const y = 0.05 + t * 0.62 * Math.cos(ang * 0.7) + 0.08 * t * t;
        return [Math.sin(ang) * t * 0.86, Math.max(0.02, y)];
      }, 14, mid * 0.55);
    }
    for (let i = 0; i < 3; i++) {
      const y0 = 0.45 + i * 0.15;
      for (const side of [1, -1]) line(t => [side * hw(y0 + 0.1 * t) * 0.8 * t, y0 + 0.1 * t], 10, mid * 0.35);
    }
  }
  return out;
}

/** Fill the cells whose centres lie inside `poly` (scanline, even–odd). */
function rasterize(poly: Pt[], inside: Uint8Array): void {
  const xs: number[] = [];
  for (let j = 0; j < GRID_H; j++) {
    const y = (j + 0.5) * CELL;
    xs.length = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / CELL - 0.5)), i1 = Math.min(GRID_W - 1, Math.floor(xs[k + 1] / CELL - 0.5));
      for (let i = i0; i <= i1; i++) inside[j * GRID_W + i] = 1;
    }
  }
}

const BIG = 1e10;

/** Squared distance transform of one line (Felzenszwalb & Huttenlocher 2012). */
function edt1(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Squared distance (cells) from every cell to the nearest cell where `target` is set. */
function edt(target: (i: number) => boolean): Float64Array {
  const out = new Float64Array(GRID_W * GRID_H);
  const n = Math.max(GRID_W, GRID_H);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < GRID_W; i++) {
    for (let j = 0; j < GRID_H; j++) f[j] = target(j * GRID_W + i) ? 0 : BIG;
    edt1(f, GRID_H, d, v, z);
    for (let j = 0; j < GRID_H; j++) out[j * GRID_W + i] = d[j];
  }
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) f[i] = out[j * GRID_W + i];
    edt1(f, GRID_W, d, v, z);
    for (let i = 0; i < GRID_W; i++) out[j * GRID_W + i] = d[i];
  }
  return out;
}

const cache = new Map<PlantId, LeafModel>();
/** leaf units² of a typical leaf (k = 1) */
const TYPICAL_AREA = 120000;

/** The leaf of a host plant (built once, then shared: treat it as read-only). */
export function buildLeaf(plant: PlantId): LeafModel {
  const hit = cache.get(plant);
  if (hit) return hit;
  const shape = SHAPES[plant];
  const inside = new Uint8Array(GRID_W * GRID_H);
  const outlines: Float32Array[] = [];
  const veins: { pts: Float32Array; w: number }[] = [];
  const layers: LeafletArt[] = [];
  for (const s of shape.leaflets) {
    const { pts, halfWidth } = leafletOutline(s);
    rasterize(pts, inside);
    const outline = Float32Array.from(pts.flat()), v = veinsOf(s, halfWidth);
    outlines.push(outline);
    veins.push(...v);
    layers.unshift({ outline, veins: v, x: s.base[0], y: s.base[1], angle: rad(s.angle), length: s.length, width: s.width });
  }
  let insideCount = 0;
  for (let i = 0; i < inside.length; i++) insideCount += inside[i];
  const toOut = edt(i => !inside[i]), toIn = edt(i => !!inside[i]);
  const dist = new Float32Array(GRID_W * GRID_H);
  for (let i = 0; i < dist.length; i++) dist[i] = inside[i] ? Math.sqrt(toOut[i]) * CELL - CELL / 2 : -(Math.sqrt(toIn[i]) * CELL - CELL / 2);
  const [sx, sy, sa] = shape.start;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const o of outlines) {
    for (let i = 0; i < o.length; i += 2) {
      box.x0 = Math.min(box.x0, o[i]); box.x1 = Math.max(box.x1, o[i]);
      box.y0 = Math.min(box.y0, o[i + 1]); box.y1 = Math.max(box.y1, o[i + 1]);
    }
  }
  const k = Math.sqrt((insideCount * CELL * CELL) / TYPICAL_AREA);
  const model: LeafModel = { plant, outlines, layers, inside, insideCount, dist, veins, stalk: shape.stalk, start: { x: sx, y: sy, heading: rad(sa) - Math.PI / 2 }, box, k };
  cache.set(plant, model);
  return model;
}

/** Signed distance to the leaf's edge at a point (bilinear; negative outside the leaf). */
export function leafDist(m: LeafModel, x: number, y: number): number {
  const gx = x / CELL - 0.5, gy = y / CELL - 0.5;
  const i = Math.floor(gx), j = Math.floor(gy);
  if (i < 0 || j < 0 || i >= GRID_W - 1 || j >= GRID_H - 1) return -CELL * 4;
  const fx = gx - i, fy = gy - j, k = j * GRID_W + i, d = m.dist;
  return (d[k] * (1 - fx) + d[k + 1] * fx) * (1 - fy) + (d[k + GRID_W] * (1 - fx) + d[k + GRID_W + 1] * fx) * fy;
}

/** Unit vector pointing into the leaf (up the distance field) at a point; writes into `out`. */
export function leafNormal(m: LeafModel, x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
  const e = CELL;
  const gx = leafDist(m, x + e, y) - leafDist(m, x - e, y);
  const gy = leafDist(m, x, y + e) - leafDist(m, x, y - e);
  const len = Math.hypot(gx, gy);
  if (len < 1e-6) { out.x = 0; out.y = -1; } else { out.x = gx / len; out.y = gy / len; }
  return out;
}

export type TreatKind = 'malina' | 'dmuchawiec';
/** One bite out of the leaf (leaf space). */
export interface Bite { x: number; y: number; r: number }
export interface Dot { x: number; y: number; r: number; pigment: number; eaten: boolean }
export interface Treat { x: number; y: number; r: number; kind: TreatKind; eaten: boolean }

/** Random spots on the leaf at least `edge` from its edge, `gap` apart, away from `avoid` points. */
function scatter(m: LeafModel, rng: () => number, count: number, edge: number, gap: number, avoid: { x: number; y: number; r: number }[]): { x: number; y: number }[] {
  const cand: number[] = [];
  for (let k = 0; k < m.dist.length; k++) if (m.dist[k] >= edge) cand.push(k);
  const out: { x: number; y: number }[] = [];
  let g = gap;
  for (let tries = 0; out.length < count && tries < 4000; tries++) {
    if (tries > 0 && tries % 800 === 0) g *= 0.85;   // a small leaf: let the dots sit closer
    const k = cand[Math.floor(rng() * cand.length)];
    if (k === undefined) break;
    const x = ((k % GRID_W) + 0.2 + 0.6 * rng()) * CELL, y = (Math.floor(k / GRID_W) + 0.2 + 0.6 * rng()) * CELL;
    if (out.some(p => Math.hypot(p.x - x, p.y - y) < g)) continue;
    if (avoid.some(p => Math.hypot(p.x - x, p.y - y) < p.r)) continue;
    out.push({ x, y });
  }
  return out;
}

/**
 * The pigment dots and the two treats of a leaf: `colours` (3–4 pigments) spread over `count` dots,
 * each colour at least three times, the spare ones mostly the last colour; `big` makes the first
 * leaf's three recipe dots large and easy.
 */
export function placeDots(m: LeafModel, rng: () => number, colours: number[], count: number, big = false): { dots: Dot[]; treats: Treat[] } {
  const k = m.k;
  const start = { x: m.start.x, y: m.start.y, r: 70 * k };
  const spots = scatter(m, rng, count, (big ? 30 : 24) * k, (big ? 70 : 56) * k, [start]);
  // colours: each at least 3 times, the rest at random, then shuffled over the spots
  const order: number[] = [];
  for (const c of colours) for (let i = 0; i < 3; i++) order.push(c);
  // the spare dots lean to the last colour (the one outside the recipe)
  while (order.length < spots.length) order.push(rng() < 0.6 ? colours[colours.length - 1] : colours[Math.floor(rng() * colours.length)]);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const dots: Dot[] = spots.map((p, i) => ({ x: p.x, y: p.y, r: (big && i < 3 ? 15 : 10) * k, pigment: order[i % order.length], eaten: false }));
  if (big) {
    // the first leaf: one large dot of each recipe colour, nearest the caterpillar
    dots.sort((a, b) => Math.hypot(a.x - m.start.x, a.y - m.start.y) - Math.hypot(b.x - m.start.x, b.y - m.start.y));
    dots.forEach((d, i) => { d.r = (i < 3 ? 15 : 10) * k; if (i < 3) d.pigment = colours[i]; });
  }
  const tspots = scatter(m, rng, 2, 30 * k, 160 * k, [{ x: m.start.x, y: m.start.y, r: 120 * k }, ...dots.map(d => ({ x: d.x, y: d.y, r: 44 * k }))]);
  const kinds: TreatKind[] = ['malina', 'dmuchawiec'];
  const treats: Treat[] = tspots.map((p, i) => ({ x: p.x, y: p.y, r: 13 * k, kind: kinds[i], eaten: false }));
  return { dots, treats };
}
