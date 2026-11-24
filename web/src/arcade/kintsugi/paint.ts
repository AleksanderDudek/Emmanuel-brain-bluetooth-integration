/**
 * Złote serce's paint (DESIGN.md §21): the colours, the fonts, and the textures baked once per size —
 *
 *   porcelain  the whole heart lit as glazed porcelain: a height field from the distance to its outline (a full,
 *              pillowed volume), its normals lit from the upper left — a soft diffuse body, a faint rose blush, a
 *              crisp specular highlight, a cool sky reflection at the rim, a little shadow where it turns away
 *   gold       the same volume in polished gold (a metallic ramp on the reflection, warm white highlights): the seams
 *              are stroked with it, and the heart turns to it in the beat
 *   soot       charcoal grime, ink-like stains of pain and soot streaks (value noise), thicker at the edges; its
 *              alpha is kept so a piece can be washed pixel by pixel, from its edges inward
 *
 * Every texture covers the heart's box (`TEX`, heart units) at `ps` pixels a unit; a piece is drawn by clipping it.
 */
import { HEART } from './heart';

export const FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';

export const GOLD = '#f2c35c';
export const GOLD_HI = '#fff1c2';
export const GOLD_DEEP = '#9a6a1a';
export const ROSE = '#ffb6c4';
export const IVORY = '#f7f1e6';
export const INK = '#f6ede0';

const TAU = Math.PI * 2;

export const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

/** 0..1 from an integer (stable). */
export function hash(i: number): number {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const h2 = (x: number, y: number, seed: number): number => hash((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791));
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise in 0..1. */
export function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = h2(xi, yi, seed), b = h2(xi + 1, yi, seed), c = h2(xi, yi + 1, seed), d = h2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise in about 0..1. */
export function fbm(x: number, y: number, seed: number, oct = 4): number {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * noise(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}

/** The textures' box in heart units. */
export const TEX = { x0: -1.04, y0: HEART.top - 0.04, w: 2.08, h: HEART.bottom - HEART.top + 0.08 };

type Canvas2D = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): Canvas2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** The heart's outline as a Path2D in heart units. */
export function heartPath(): Path2D {
  const p = new Path2D();
  HEART.pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
  p.closePath();
  return p;
}

/** A closed polygon of heart points as a Path2D in heart units. */
export function polyPath(pts: readonly { x: number; y: number }[]): Path2D {
  const p = new Path2D();
  pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
  p.closePath();
  return p;
}

/** An open polyline as a Path2D in heart units. */
export function linePath(pts: readonly { x: number; y: number }[]): Path2D {
  const p = new Path2D();
  pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
  return p;
}

/** Chamfer distance (3-4) from the outside, in pixels, for a mask (1 inside). */
export function distanceField(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3); else v = Math.min(v, 3);
    if (y > 0) {
      v = Math.min(v, d[i - w] + 3);
      if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
    } else v = Math.min(v, 3);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3); else v = Math.min(v, 3);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + 3);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
      if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
    } else v = Math.min(v, 3);
    d[i] = v;
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** The baked textures of one size. */
export interface HeartTex {
  ps: number;
  w: number;
  h: number;
  porcelain: Canvas2D;
  gold: Canvas2D;
  soot: Canvas2D;
  /** the soot's colour and alpha per pixel (for washing) */
  sootRGB: Uint8ClampedArray;
  sootA: Float32Array;
  /** 1 inside the heart */
  mask: Uint8Array;
  seed: number;
}

/** A canvas's mask of the heart drawn at `ps` (1 inside). */
function heartMask(w: number, h: number, ps: number): Uint8Array | null {
  const c = makeCanvas(w, h);
  const g = c?.getContext('2d');
  if (!c || !g) return null;
  g.setTransform(ps, 0, 0, ps, -TEX.x0 * ps, -TEX.y0 * ps);
  g.fillStyle = '#fff';
  g.fill(heartPath());
  const data = g.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  return m;
}

/** Bake the heart's textures at `ps` pixels per heart unit (null without a canvas). */
export function bakeHeart(ps: number, seed: number): HeartTex | null {
  const w = Math.ceil(TEX.w * ps), h = Math.ceil(TEX.h * ps);
  const mask = heartMask(w, h, ps);
  if (!mask) return null;
  const dist = distanceField(mask, w, h);
  // the volume: each lobe a soft dome (the rim rounded, the middle still curving), so the light makes a broad gradient
  const R = 0.85 * ps;
  const height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const k = Math.min(1, dist[i] / R);
    height[i] = Math.sqrt(1 - (1 - k) * (1 - k)) * 0.42 * ps;
  }
  // blurred well, so the distance field's ridges (the medial axis) leave no facets or creases in the light
  const hs = boxBlur(boxBlur(boxBlur(height, w, h, Math.max(1, Math.round(ps * 0.05))), w, h, Math.max(1, Math.round(ps * 0.035))), w, h, Math.max(1, Math.round(ps * 0.02)));
  const mk = (): { c: Canvas2D; g: CanvasRenderingContext2D; img: ImageData } | null => {
    const c = makeCanvas(w, h), g = c?.getContext('2d');
    if (!c || !g) return null;
    return { c, g, img: g.createImageData(w, h) };
  };
  const P = mk(), G = mk(), S = mk();
  if (!P || !G || !S) return null;
  const pd = P.img.data, gd = G.img.data, sd = S.img.data;
  const sootA = new Float32Array(w * h);
  // the light: from the upper left, toward the viewer
  let lx = -0.5, ly = -0.62, lz = 0.6;
  const ll = Math.hypot(lx, ly, lz);
  lx /= ll; ly /= ll; lz /= ll;
  let hx = lx, hy = ly, hz = lz + 1;
  const hl = Math.hypot(hx, hy, hz);
  hx /= hl; hy /= hl; hz /= hl;
  // the stains of pain: ink blots inside the heart
  const blots: { x: number; y: number; r: number; k: number }[] = [];
  for (let i = 0; i < 26; i++) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 20; tries++) {
      x = Math.floor(hash(seed + i * 7 + tries * 131) * w);
      y = Math.floor(hash(seed + i * 11 + tries * 173) * h);
      if (mask[y * w + x]) break;
    }
    blots.push({ x, y, r: ps * (0.05 + 0.17 * hash(seed + i * 13) ** 1.5), k: 0.55 + 0.45 * hash(seed + i * 19) });
  }
  const inv = 1 / ps;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4;
    if (!mask[i]) continue;
    const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(h - 1, y + 1);
    let nx = -(hs[y * w + xp] - hs[y * w + xm]) * 0.5, ny = -(hs[yp * w + x] - hs[ym * w + x]) * 0.5, nz = 1;
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl; ny /= nl; nz /= nl;
    const ndl = Math.max(0, nx * lx + ny * ly + nz * lz);
    const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
    const edge = Math.min(1, dist[i] / (0.2 * ps));
    const ao = 0.9 + 0.1 * edge;
    const rim = (1 - nz) ** 1.6;
    // heart units for the colour's variation
    const ux = x * inv + TEX.x0, uy = y * inv + TEX.y0;
    // ── porcelain ──
    // a warm ivory glaze with a faint rose blush in the middle; a little shadow gathering toward the tip
    const blush = 0.3 * Math.exp(-((ux * ux) / 0.45 + ((uy - 0.15) * (uy - 0.15)) / 0.3));
    const ar = 242, ag = 235 - 24 * blush, ab = 224 - 18 * blush;
    const tipT = Math.max(0, Math.min(1, (uy - 0.1) / 0.8));
    const tip = 1 - 0.17 * tipT * tipT * (3 - 2 * tipT);
    // a broad gradient for the form, one small crisp highlight per lobe, a faint sheen round it
    const dif = (0.58 + 0.42 * ndl) * ao * tip;
    const spec = ndh ** 220 * 0.95 + ndh ** 30 * 0.05;
    // the side turned from the light a touch cooler; a faint warm light along the rim
    const cool = (1 - ndl) * 12;
    const r = ar * dif + 255 * spec + 40 * rim - cool, gg = ag * dif + 255 * spec + 30 * rim - cool * 0.5, b = ab * dif + 255 * spec + 18 * rim;
    // a soft shoulder instead of a hard clip, so no flat white blobs
    const soft = (c: number): number => (c < 215 ? c : 215 + 40 * (1 - Math.exp(-(c - 215) / 40)));
    pd[o] = soft(r);
    pd[o + 1] = soft(gg);
    pd[o + 2] = soft(b);
    pd[o + 3] = 255;
    // ── gold ── (a metallic ramp on the reflected sky: up bright, down deep)
    const ry = 2 * nz * ny;
    const env = Math.max(0, Math.min(1, 0.55 - ry * 1.4 + (ndl - 0.5) * 0.6)) * (0.85 + 0.15 * tip);
    const gr = 156 + (255 - 156) * env, gg2 = 104 + (222 - 104) * env, gb = 34 + (128 - 34) * env;
    const gdif = 0.72 + 0.28 * ndl;
    const gspec = ndh ** 36 * 1.0 + ndh ** 6 * 0.18;
    gd[o] = Math.min(255, gr * gdif * ao + 255 * gspec);
    gd[o + 1] = Math.min(255, gg2 * gdif * ao + 240 * gspec);
    gd[o + 2] = Math.min(255, gb * gdif * ao + 200 * gspec + 10 * rim);
    gd[o + 3] = 255;
    // ── soot ── grime everywhere, thicker at the edges; ink blots; streaks
    const n1 = fbm(ux * 3.2, uy * 3.2, seed);
    const n2 = fbm(ux * 9, uy * 9, seed + 5);
    const n3 = fbm(ux * 1.6 + 7, uy * 1.6, seed + 11);
    // uneven stains: thick patches and thinner film where the glaze shows through, thicker at the edges
    const pt = Math.max(0, Math.min(1, (n1 * 0.7 + n3 * 0.5 - 0.42) / 0.3));
    let a = 0.42 + 0.5 * pt * pt * (3 - 2 * pt) + 0.12 * (1 - edge) + 0.1 * (n2 - 0.5);
    let dark = 0.25 + 0.45 * n2;
    for (const bl of blots) {
      const dx = x - bl.x, dy = y - bl.y;
      const warp = 0.75 + 0.5 * noise(x / (ps * 0.05), y / (ps * 0.05), seed + 9);
      const q = Math.hypot(dx, dy) / (bl.r * warp);
      if (q < 1.25) {
        const core = Math.max(0, Math.min(1, (1.15 - q) / 0.3));
        // a dried ink rim a little darker than its middle
        const ring = Math.max(0, 1 - Math.abs(q - 0.95) / 0.12) * 0.4;
        a = Math.max(a, 0.86 * bl.k * core + ring);
        dark = Math.min(dark, 0.12 + 0.2 * (1 - core));
      }
    }
    const streak = Math.max(0, fbm(ux * 1.4 + uy * 5.5, uy * 0.8, seed + 3) - 0.55) * 1.6;
    a = Math.max(0, Math.min(0.95, a + streak * 0.25));
    // the glaze still catches the light through the grime
    a *= 1 - 0.45 * Math.min(1, ndh ** 70 * 1.6);
    sootA[i] = a;
    const base = 14 + 42 * dark;
    sd[o] = base + 4;
    sd[o + 1] = base;
    sd[o + 2] = base + 6;
    sd[o + 3] = Math.round(a * 255);
  }
  P.g.putImageData(P.img, 0, 0);
  G.g.putImageData(G.img, 0, 0);
  S.g.putImageData(S.img, 0, 0);
  return { ps, w, h, porcelain: P.c, gold: G.c, soot: S.c, sootRGB: sd, sootA, mask, seed };
}

/** A soft round glow sprite (white core, the colour, transparent), drawn additively. */
export function glowSprite(color: string, size = 128): Canvas2D | null {
  const c = makeCanvas(size, size), g = c?.getContext('2d');
  if (!c || !g) return null;
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(color, 1));
  gr.addColorStop(0.25, rgba(color, 0.55));
  gr.addColorStop(0.6, rgba(color, 0.14));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Draw a glow sprite centred at (x, y) with radius r. */
export function glow(ctx: CanvasRenderingContext2D, sprite: Canvas2D | null, x: number, y: number, r: number, a: number): void {
  if (!sprite || r <= 0 || a <= 0.003) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(sprite, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
}

/** A gradient glow without a sprite (the preview and the intro). */
export function softGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, a: number): void {
  if (r <= 0 || a <= 0.003) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.35, rgba(color, a * 0.4));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** Mix two hex colours (k 0..1) as "rgb(…)". */
export function mix(a: string, b: string, k: number): string {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round((((p >> s) & 255) * (1 - k) + ((q >> s) & 255) * k));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

/** The sky from night (0) to dawn (1): top, middle, bottom. */
export function skyAt(k: number): [string, string, string] {
  const night = ['#03050f', '#080c22', '#0c0d20'], pre = ['#080a20', '#211a3a', '#3e2638'], dawn = ['#1a1636', '#5a3646', '#c98a4e'];
  if (k <= 0.5) {
    const u = k / 0.5;
    return [mix(night[0], pre[0], u), mix(night[1], pre[1], u), mix(night[2], pre[2], u)];
  }
  const u = (k - 0.5) / 0.5;
  return [mix(pre[0], dawn[0], u), mix(pre[1], dawn[1], u), mix(pre[2], dawn[2], u)];
}
