/**
 * Urodzaj's tesserae: an early-Christian floor mosaic come alive (the baskets, vines and pomegranates
 * of Tabgha and Madaba) — square stones on cream ground with darker grout, outlined in a row of dark
 * stones, lit by a few white ones.  Everything that does not move is baked here into offscreen
 * canvases at the device pixel ratio and cached by size: the nine fruit (stones laid in rows that
 * follow each silhouette, "andamento"; the smallest in a bolder glazed style that reads at 8 px), the
 * woven basket and its rim braid, the terraced hills in day and dusk, the frame bands, and the linen.
 */
import { clamp } from '../kit/juice';
import { FRUITS } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';

/** The palette (GDD §8). */
export const C = {
  ground: '#EFE4CC', grout: '#D9CCB0', sand: '#E3D3B1', sky: '#F4EAD5', dark: '#2A2622',
  ochre: '#C8963E', terracotta: '#B5523B', olive: '#5E6B2E', leaf: '#8FA055', vine: '#4E5A2A',
  sage: '#A9B07A', hill: '#7F8A4A', field: '#C8A060', gold: '#D4A640', text: '#2A2622', muted: '#6A5E50',
  lilac: '#8E7FA8', lapis: '#2F4A7A', night: '#1E2A47', dew: '#CFE3F2', white: '#FFFFFF', dusk: '#F3EBDD',
  brown: '#7A5230', reed: '#B78A4A', reedDark: '#8A6232', blue: '#3E5F8A',
} as const;

export const TAU = Math.PI * 2;

/** A stable pseudo-random number in [0, 1) for an integer-ish seed (jitter that never flickers). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** #rrggbb mixed toward #rrggbb by k (0..1). */
export function mix(a: string, b: string, k: number): string {
  const p = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const q = clamp(k);
  const c = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * q).toString(16).padStart(2, '0');
  return `#${c(1)}${c(3)}${c(5)}`;
}

export interface Baked { c: HTMLCanvasElement; w: number; h: number }

/** An offscreen canvas of `w`×`h` CSS px at `dpr`, its context set up to draw in CSS px. */
export function canvas(w: number, h: number, dpr: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

/** One square stone, rotated, at (x, y) with side `s`. */
export function stone(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, color: string): void {
  ctx.fillStyle = color;
  if (Math.abs(a) < 0.02) {
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    return;
  }
  const c = Math.cos(a) * s / 2, d = Math.sin(a) * s / 2;
  ctx.beginPath();
  ctx.moveTo(x - c + d, y - d - c);
  ctx.lineTo(x + c + d, y + d - c);
  ctx.lineTo(x + c - d, y + d + c);
  ctx.lineTo(x - c - d, y - d + c);
  ctx.closePath();
  ctx.fill();
}

/**
 * Stones laid in rows along a star-shaped outline — the radius ρ(θ) from the centre (θ on the canvas,
 * y down), `size` a stone with its grout — outer row first.  `color(row, θ, x, y)` picks each stone.
 */
export function andamento(ctx: CanvasRenderingContext2D, cx: number, cy: number, rho: (a: number) => number, size: number,
  color: (row: number, a: number, x: number, y: number) => string, seed: number): void {
  const N = 96;
  const rs = new Float64Array(N);
  let rmin = Infinity;
  for (let i = 0; i < N; i++) {
    rs[i] = rho((i / N) * TAU);
    rmin = Math.min(rmin, rs[i]);
  }
  const xs = new Float64Array(N + 1), ys = new Float64Array(N + 1), len = new Float64Array(N + 1);
  for (let row = 0; ; row++) {
    const inset = size * (row + 0.5);
    if (inset > rmin - size * 0.3) {
      // the heart: one stone or a few where the rows meet
      const left = rmin - size * row;
      if (left > size * 0.15) stone(ctx, cx, cy, Math.max(size * 0.7, left * 1.1), hash(seed + row) * 0.6, color(row, 0, cx, cy));
      break;
    }
    let total = 0;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, r = Math.max(0, rs[i % N] - inset);
      xs[i] = cx + Math.cos(a) * r;
      ys[i] = cy + Math.sin(a) * r;
      if (i) total += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
      len[i] = total;
    }
    const n = Math.max(3, Math.round(total / size));
    const step = total / n, off = hash(seed * 3 + row) * step;
    let j = 1;
    for (let k = 0; k < n; k++) {
      const at = (off + k * step) % total;
      while (j < N && len[j] < at) j++;
      const f = (at - len[j - 1]) / Math.max(1e-9, len[j] - len[j - 1]);
      const x = xs[j - 1] + (xs[j] - xs[j - 1]) * f, y = ys[j - 1] + (ys[j] - ys[j - 1]) * f;
      const tang = Math.atan2(ys[j] - ys[j - 1], xs[j] - xs[j - 1]);
      const h = hash(seed + row * 131 + k * 7.3);
      const sz = step * (0.84 + 0.08 * h);
      stone(ctx, x + (h - 0.5) * size * 0.1, y + (hash(seed + k * 3.1 + row) - 0.5) * size * 0.1, Math.min(sz, size * 0.92), tang + (h - 0.5) * 0.16,
        color(row, Math.atan2(y - cy, x - cx), x, y));
    }
  }
}

// ── the fruit ────────────────────────────────────────────────────
type Shape = { rho: (a: number) => number; base: string; dark: string; light: string };

/** The silhouette of a tier: its radius at canvas angle a (y down), in units of the fruit's radius. */
function silhouette(tier: number): (a: number) => number {
  switch (tier) {
    case 1: return a => {   // an olive: an oval with a pointed tip
      const f = a + 0.55;
      const e = 1 / Math.sqrt((Math.cos(f) / 1.0) ** 2 + (Math.sin(f) / 0.74) ** 2);
      return 0.97 * e + 0.08 * Math.max(0, Math.cos(f)) ** 8;
    };
    case 3: return a => 1 / Math.sqrt((Math.cos(a) / 0.74) ** 2 + (Math.sin(a) / 1.0) ** 2) * 0.98;   // a date: an upright capsule
    case 4: return a => 0.98 - 0.24 * Math.max(0, -Math.sin(a)) ** 2;   // a fig: a teardrop, narrow at the top
    case 5: return a => 0.98 - 0.08 * Math.max(0, -Math.sin(a)) ** 10;   // an apple: a dimple at the stem
    case 7: return a => 1 / Math.sqrt((Math.cos(a) / 1.0) ** 2 + (Math.sin(a) / 0.9) ** 2) * 0.99;    // a melon: a little wider than tall
    default: return () => 0.97;
  }
}

const shapes = new Map<number, Shape>();
function shapeOf(tier: number): Shape {
  let s = shapes.get(tier);
  if (!s) {
    const f = FRUITS[tier - 1];
    s = { rho: silhouette(tier), base: f.base, dark: f.dark, light: f.light };
    shapes.set(tier, s);
  }
  return s;
}

const LIGHT_X = -0.55, LIGHT_Y = -0.8;

/** The tone of a stone on a fruit: dark at the rim, the base colour lit from the upper left, a stone's own small variation. */
function tone(s: Shape, nx: number, ny: number, seed: number): string {
  const lit = clamp(0.5 - 0.62 * (nx * LIGHT_X + ny * LIGHT_Y) * -1 + 0.5 * (-(nx * LIGHT_X + ny * LIGHT_Y)), 0, 1);
  const k = clamp(0.35 + 0.5 * (-(nx * -LIGHT_X + ny * -LIGHT_Y)) + (hash(seed) - 0.5) * 0.16);
  void lit;
  return k < 0.5 ? mix(s.dark, s.base, k * 2) : mix(s.base, s.light, (k - 0.5) * 1.6);
}

export interface FruitArt { c: HTMLCanvasElement; size: number; r: number }

const fruitCache = new Map<string, FruitArt>();

/**
 * The tier's sprite for a fruit of radius `r` CSS px, baked at `dpr` and cached.  The sprite's
 * centre is the fruit's centre; it is `size` CSS px square (room for stems, crowns and leaves).
 */
export function fruitArt(tier: number, r: number, dpr: number): FruitArt {
  const rq = Math.max(2, Math.round(r * 4) / 4);
  const key = `${tier}|${rq}|${dpr}`;
  let art = fruitCache.get(key);
  if (art) return art;
  if (fruitCache.size > 160) fruitCache.clear();
  const size = Math.ceil(rq * 2.7);
  const { c, ctx } = canvas(size, size, dpr);
  paintFruit(ctx, tier, size / 2, size / 2, rq);
  art = { c, size, r: rq };
  fruitCache.set(key, art);
  return art;
}

/** Paint a fruit of `tier` centred at (x, y) with radius r (CSS px) — used by the sprites, the preview and the panel. */
export function paintFruit(ctx: CanvasRenderingContext2D, tier: number, x: number, y: number, r: number): void {
  if (tier >= 8) return paintBunch(ctx, x, y, r, tier === 9);
  const s = shapeOf(tier);
  const outline = mix(s.dark, C.dark, 0.45);
  const grout = mix(s.dark, C.dark, 0.25);
  // the grout: the silhouette, a shade darker than the fruit
  ctx.fillStyle = grout;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU, rr = s.rho(a) * r + 0.4;
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
  const glazed = r < 12;
  const size = glazed ? Math.max(2.5, r / 2.4) : clamp(r / 5.4, 2.4, 7.5);
  const seed = tier * 17 + Math.round(r);
  andamento(ctx, x, y, a => s.rho(a) * r, size, (row, _a, px, py) => {
    if (row === 0) return outline;
    const nx = (px - x) / r, ny = (py - y) / r;
    if (tier === 3 && row % 2 === 0) return mix(tone(s, nx, ny, px * 3 + py), s.dark, 0.35);   // the date's ridges
    if (tier === 7) {   // the melon's stripes, along its meridians
      const m = Math.abs(Math.sin(Math.atan2(ny, nx * 0.9) * 3));
      if (m > 0.86) return mix(C.hill, '#4F6A2C', 0.5 + 0.3 * hash(px + py));
    }
    return tone(s, nx, ny, px * 7.1 + py * 3.3);
  }, seed);
  // a white highlight cluster in the light
  const hx = x - r * 0.36, hy = y - r * 0.42;
  ctx.globalAlpha = 0.92;
  if (glazed) stone(ctx, hx, hy, Math.max(2, r * 0.32), 0.3, '#FFF8E8');
  else {
    const n = tier === 1 ? 1 : 3;
    for (let i = 0; i < n; i++) stone(ctx, hx + (i % 2) * size * 0.95, hy + Math.floor(i / 2) * size * 0.95, size * 0.8, 0.2 + i * 0.3, i ? '#F4EEE0' : '#FFFFFF');
  }
  ctx.globalAlpha = 1;
  details(ctx, tier, x, y, r, size, outline);
}

/** Stems, the apple's leaf, the pomegranate's crown. */
function details(ctx: CanvasRenderingContext2D, tier: number, x: number, y: number, r: number, size: number, outline: string): void {
  const st = Math.max(1.6, size * 0.85);
  if (tier === 4 || tier === 5) {
    const top = y - r * (tier === 4 ? 0.74 : 0.9);
    stone(ctx, x + st * 0.1, top - st * 0.4, st, 0.2, C.brown);
    stone(ctx, x + st * 0.4, top - st * 1.25, st * 0.9, 0.5, mix(C.brown, C.dark, 0.3));
  }
  if (tier === 5) {   // the apple's leaf
    const lx = x + r * 0.3, ly = y - r * 1.02;
    for (let i = 0; i < 4; i++) stone(ctx, lx + i * st * 0.8, ly - i * st * 0.25, st * (1 - i * 0.12), -0.4, i % 2 ? C.leaf : mix(C.leaf, C.vine, 0.4));
  }
  if (tier === 6) {   // the pomegranate's crown
    const top = y - r * 0.93;
    for (let i = -2; i <= 2; i++) {
      stone(ctx, x + i * st * 0.85, top - st * (0.35 + (i % 2 ? 0 : 0.45)), st * 0.95, 0.785, i % 2 ? mix('#A3243B', C.dark, 0.35) : '#7E1A2E');
    }
    stone(ctx, x, top + st * 0.2, st, 0, outline);
  }
}

/** A bunch (tier 8) or the great cluster (tier 9): beads in a tapering heap, each its own little mosaic; the cluster with gold leaf and a vine leaf. */
function paintBunch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, great: boolean): void {
  const s = shapeOf(great ? 9 : 8);
  const rows = great ? [5, 6, 5, 4, 3, 2, 1] : [4, 5, 4, 3, 2, 1];
  const br = r * (great ? 0.17 : 0.2);
  const outline = mix(s.dark, C.dark, 0.5);
  // the stalk and a vine leaf on top
  const top = y - r * 0.86;
  const st = Math.max(1.6, br * 0.42);
  stone(ctx, x, top - st * 0.5, st * 1.1, 0, C.brown);
  stone(ctx, x + st * 0.3, top - st * 1.5, st, 0.4, C.brown);
  const leafX = x + br * 1.6, leafY = top - br * 0.2;
  paintVineLeaf(ctx, leafX, leafY, br * (great ? 1.5 : 1.2), -0.5, great);
  let n = 0;
  rows.forEach((count, i) => {
    const yy = top + br * 0.95 + i * br * 1.62;
    const width = (count - 1) * br * 1.9;
    for (let k = 0; k < count; k++) {
      const xx = x - width / 2 + k * br * 1.9 + (i % 2 ? br * 0.25 : 0) * (k % 2 ? 1 : -1);
      const lit = clamp(0.62 - ((xx - x) / r) * 0.35 - ((yy - y) / r) * 0.45 + (hash(n * 9.7) - 0.5) * 0.2);
      bead(ctx, xx, yy, br, mix(s.dark, s.light, lit), outline, great && hash(n * 3.3 + 1) < 0.22);
      n++;
    }
  });
}

/** One grape: a ring of dark stones, a body, a bright stone; gold leaf on some of the great cluster's. */
function bead(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, body: string, outline: string, gold: boolean): void {
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.02, 0, TAU);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0, TAU);
  ctx.fill();
  const t = Math.max(1.2, r * 0.42);
  stone(ctx, x + r * 0.22, y + r * 0.2, t, 0.5, mix(body, outline, 0.3));
  stone(ctx, x - r * 0.3, y - r * 0.32, Math.max(1, t * 0.8), 0.3, gold ? C.gold : '#F2ECF5');
  if (gold) stone(ctx, x + r * 0.15, y - r * 0.05, t * 0.8, 0.9, '#E8C063');
}

/** A vine leaf of stones: three lobes in leaf greens with a darker vein. */
export function paintVineLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, rich = false): void {
  const lobes = [[0, -0.55, 0.55], [-0.5, -0.1, 0.45], [0.5, -0.1, 0.45], [0, 0.2, 0.5]];
  const ca = Math.cos(a), sa = Math.sin(a);
  ctx.fillStyle = C.vine;
  for (const [lx, ly, lr] of lobes) {
    ctx.beginPath();
    ctx.arc(x + (lx * ca - ly * sa) * r, y + (lx * sa + ly * ca) * r, lr * r * 1.12, 0, TAU);
    ctx.fill();
  }
  const st = Math.max(1.4, r * 0.32);
  let i = 0;
  for (const [lx, ly, lr] of lobes) {
    const px = x + (lx * ca - ly * sa) * r, py = y + (lx * sa + ly * ca) * r;
    stone(ctx, px, py, st * 1.25 * lr * 2, a + i, i % 2 ? C.leaf : mix(C.leaf, rich ? C.gold : '#B9C27A', 0.35));
    i++;
  }
  stone(ctx, x, y - r * 0.15, st * 0.8, a + 0.785, mix(C.vine, C.dark, 0.3));
}

// ── the scene ────────────────────────────────────────────────────
export interface Palette {
  sky: [string, string];
  bands: string[];
  trees: string;
  grout: string;
  frame: string;
}

export const DAY: Palette = { sky: ['#F7EFDD', '#EADAB7'], bands: ['#A9B07A', '#C8A060', '#7F8A4A', '#D8C38E', '#99A564'], trees: '#55622A', grout: '#D9CCB0', frame: C.dark };
export const DUSK: Palette = { sky: ['#9E8FB8', '#D9A98E'], bands: ['#6F7590', '#8E7A86', '#4F5C78', '#9C8A8E', '#5E6A80'], trees: '#33405A', grout: '#7C7590', frame: '#211E26' };

/**
 * The orchard's terraces behind the basket: a pale sky band, then horizontal mosaic bands of sage,
 * ochre, olive and sand with small olive trees, laid in rows of stones.  Baked once per size and palette.
 */
export function bakeScene(w: number, h: number, dpr: number, horizon: number, tile: number, pal: Palette, top: number, bottom: number): Baked {
  const { c, ctx } = canvas(w, h, dpr);
  const sky = ctx.createLinearGradient(0, top, 0, horizon);
  sky.addColorStop(0, pal.sky[0]);
  sky.addColorStop(1, pal.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // the sky in loose rows of pale stones
  const t = tile;
  for (let y = top + t / 2, row = 0; y < horizon + t; y += t * 1.02, row++) {
    for (let x = (row % 2) * t * 0.5; x < w + t; x += t * 1.04) {
      const k = (y - top) / Math.max(1, horizon - top);
      const col = mix(pal.sky[0], pal.sky[1], k + (hash(x * 0.37 + y * 1.3) - 0.5) * 0.18);
      stone(ctx, x + (hash(x + y) - 0.5) * t * 0.12, y, t * 0.86, (hash(x * 3 + y) - 0.5) * 0.12, col);
    }
  }
  // the terraces: each band's top edge waves, and its stones follow it
  const bands = pal.bands.length;
  const span = h - bottom - horizon;
  for (let b = 0; b < bands; b++) {
    const y0 = horizon + (span * b) / bands * 0.92;
    const amp = t * (1.4 - b * 0.18), freq = 0.006 + b * 0.002, ph = b * 1.7;
    const edge = (x: number) => y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.3 + ph * 2) * amp * 0.4;
    ctx.fillStyle = pal.grout;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, edge(x) - t * 0.3);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    const col = pal.bands[b];
    for (let y = 0, row = 0; y < h - y0 + t; y += t * 1.02, row++) {
      for (let x = (row % 2) * t * 0.5; x < w + t; x += t * 1.04) {
        const yy = edge(x) + y + t * 0.5;
        if (yy > h) continue;
        const v = (hash(x * 1.7 + yy * 0.9 + b * 31) - 0.5) * 0.14 - (row === 0 ? 0.12 : 0);
        stone(ctx, x, yy, t * 0.88, (hash(x + b) - 0.5) * 0.1, mix(col, v < 0 ? C.dark : C.white, Math.abs(v)));
      }
    }
    // olive trees along the band's crest
    for (let i = 0; i < 9; i++) {
      const x = hash(b * 13 + i * 7.7) * w;
      if (hash(b * 5 + i) < 0.45) continue;
      const yy = edge(x);
      const tr = t * (1.3 + hash(i + b * 3) * 0.9) * (1 - b * 0.08);
      stone(ctx, x, yy - tr * 0.2, t * 0.55, 0, mix(pal.trees, C.brown, 0.4));
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + hash(i + k);
        stone(ctx, x + Math.cos(a) * tr * 0.55, yy - tr * 0.9 + Math.sin(a) * tr * 0.42, t * 0.7, a, mix(pal.trees, pal.bands[b], 0.15 + 0.2 * hash(k + i)));
      }
      stone(ctx, x - tr * 0.15, yy - tr * 1.05, t * 0.5, 0.3, mix(pal.trees, C.white, 0.18));
    }
  }
  return { c, w, h };
}

/**
 * The frame: dark bands across the top and the bottom (the runner's clock, bar and buttons read on
 * them) with a running-wave border of ochre and terracotta stones and a cream line.
 */
export function paintFrame(ctx: CanvasRenderingContext2D, w: number, h: number, top: number, bottom: number, tile: number, dark: string): void {
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, w, top);
  ctx.fillRect(0, h - bottom, w, bottom);
  const t = tile * 0.62;
  for (const [y0, dir] of [[top - t * 1.6, 1], [h - bottom + t * 1.6, -1]] as const) {
    // the running wave: a row of stones riding a sine, and a cream line beside it
    for (let x = t / 2, k = 0; x < w; x += t * 1.05, k++) {
      const wave = Math.sin(k * 0.62) * t * 0.7;
      stone(ctx, x, y0 + wave, t * 0.9, 0, k % 6 < 3 ? C.ochre : C.terracotta);
    }
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, y0 + dir * t * 1.45 - 1, w, 2);
  }
}

// ── the basket ───────────────────────────────────────────────────
/**
 * The woven basket in screen px: its back (the inside, darker, seen past the fruit), and its front
 * (the two walls, the floor and the rim braid).  Rows alternate diagonally: over, under.
 */
export function paintBasket(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, s: number, part: 'back' | 'front'): void {
  const wall = 0.035;
  const t = clamp(s * 0.022, 3.2, 9);
  if (part === 'back') {
    // the inside: a trapezoid of darker weave
    ctx.fillStyle = mix(C.reedDark, C.dark, 0.35);
    ctx.beginPath();
    ctx.moveTo(X(-0.42), Y(0));
    ctx.lineTo(X(0.42), Y(0));
    ctx.lineTo(X(0.5), Y(1));
    ctx.lineTo(X(-0.5), Y(1));
    ctx.closePath();
    ctx.fill();
    const rows = Math.max(6, Math.round(s / (t * 1.15)));
    for (let i = 0; i < rows; i++) {
      const yw = (i + 0.5) / rows;
      const half = 0.42 + 0.08 * yw;
      const y = Y(yw);
      const n = Math.max(4, Math.round((2 * half * s) / (t * 1.6)));
      for (let k = 0; k < n; k++) {
        const x = X(-half + ((k + 0.5) / n) * 2 * half);
        const over = (k + i) % 2 === 0;
        const col = mix(over ? '#8B6436' : '#6E4C2A', C.dark, 0.38 + 0.08 * hash(k * 3 + i));
        stone(ctx, x, y, t * (over ? 1.25 : 0.95), over ? 0.5 : -0.5, col);
      }
    }
    // a soft shade at the floor, where the heap will sit
    const g = ctx.createLinearGradient(0, Y(0.35), 0, Y(0));
    g.addColorStop(0, 'rgba(42,38,34,0)');
    g.addColorStop(1, 'rgba(42,38,34,.35)');
    ctx.fillStyle = g;
    ctx.fillRect(X(-0.5), Y(0.35), s, 0.35 * s);
    return;
  }
  // the walls: slanted bands of over-under weave
  for (const side of [-1, 1]) {
    const rows = Math.max(8, Math.round(s / (t * 0.95)));
    for (let i = 0; i < rows; i++) {
      const yw = (i + 0.5) / rows * 1.0;
      const inner = 0.42 + 0.08 * yw;
      for (let k = 0; k < 3; k++) {
        const xw = side * (inner + wall * (k + 0.5) / 3);
        const over = (i + k) % 2 === 0;
        stone(ctx, X(xw), Y(yw), t * 0.95, side * (over ? 0.6 : -0.6), mix(over ? C.reed : C.reedDark, C.white, over ? 0.08 * hash(i + k) : 0));
      }
    }
  }
  // the floor band
  const n = Math.max(10, Math.round((0.84 + 2 * wall) * s / (t * 1.05)));
  for (let k = 0; k < n; k++) {
    const xw = -0.42 - wall + ((k + 0.5) / n) * (0.84 + 2 * wall);
    for (let j = 0; j < 2; j++) stone(ctx, X(xw), Y(-wall * (j + 0.5) / 2), t * 0.9, (k + j) % 2 ? 0.55 : -0.55, (k + j) % 2 ? C.reed : C.reedDark);
  }
  // the outline of the walls in dark stones
  ctx.fillStyle = mix(C.dark, C.brown, 0.2);
  for (const side of [-1, 1]) {
    const rows = Math.max(8, Math.round(s / (t * 0.9)));
    for (let i = 0; i < rows; i++) {
      const yw = (i + 0.5) / rows;
      stone(ctx, X(side * (0.42 + 0.08 * yw + wall + t * 0.25 / s)), Y(yw), t * 0.55, 0, mix(C.dark, C.brown, 0.25));
    }
  }
}

/** The rim braid at the top of the walls: terracotta and ochre in a chevron; `warn` turns it into the zigzag across the mouth. */
export function paintRim(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, s: number): void {
  const t = clamp(s * 0.022, 3.2, 9);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const xw = side * (0.5 + 0.035 * (k / 3));
      stone(ctx, X(xw) + side * t * 0.2, Y(1) - t * 0.4, t * 1.05, side * 0.785, k % 2 ? C.terracotta : C.ochre);
      stone(ctx, X(xw) + side * t * 0.2, Y(1) + t * 0.55, t * 0.95, -side * 0.785, k % 2 ? C.ochre : C.terracotta);
    }
  }
}

// ── the linen ────────────────────────────────────────────────────
/** The cloth's weave: a fine diagonal thread texture, baked as a tile to fill the cloth with. */
export function linenTile(dpr: number, u: number): HTMLCanvasElement {
  const size = Math.round(24 * u);
  const { c, ctx } = canvas(size, size, dpr);
  ctx.fillStyle = '#F2EBDD';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(160,140,110,.16)';
  ctx.lineWidth = 0.7;
  for (let i = -size; i < size * 2; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  for (let i = -size; i < size * 2; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
  return c;
}

/** A row of woven stones (the cloth's border): blue and terracotta. */
export function paintBorder(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, t: number, phase = 0): void {
  for (let x = x0 + t / 2, k = 0; x < x1; x += t * 1.05, k++) {
    const blue = (k + phase) % 4 < 2;
    stone(ctx, x, y, t * 0.9, 0.785, blue ? C.blue : C.terracotta);
    stone(ctx, x, y + t * 1.05, t * 0.6, 0, blue ? C.ground : mix(C.ochre, C.white, 0.2));
  }
}
