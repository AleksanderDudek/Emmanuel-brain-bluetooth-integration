/**
 * Rzeka Ezechiela's pictures, drawn with canvas paths and gradients (no images): a dawn over a dry valley — dusty
 * ochre hills, a pale gold sky, the sun low in the east where the river goes — the temple's east gate with light in
 * its doorway and water trickling from under its threshold, the river in layered translucent bands of turquoise
 * rising up the figure of light (kit/figure.ts) with caustic light on its legs, grey dust that rinses away, trees on
 * both banks whose leaves are small luminous shapes, and far downstream the dead sea turning fresh.
 *
 * It must look nothing like Rzeki żywej wody (light coming down through stained glass in deep space): here it is a
 * landscape in daylight and the water rises from below.  The figure shares Rzeki's rim of light, warm at the head.
 * Light is light: soft glows from small baked sprites, never shadowBlur or filters per frame; the sky, the land, the
 * gate, the figure, its dust and every tree with its leaves are baked into offscreen layers, so a frame composes them.
 */
import { FIG_HALF, figurePath, type ToScreen } from '../kit/figure';
import { MIN_TEXT } from '../kit/mobile';
import type { Layout } from './layout';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const GOLD = '#ffd98a';
export const GOLD_HI = '#fff3cf';
export const PEARL = '#fffaf0';
export const AQUA = '#9fe9ef';
export const TEAL = '#2fa7b8';
export const DEEP = '#0f5f78';
export const LEAF = '#8fe07a';
export const LEAF_HI = '#e9ffc8';
export const OCHRE = '#d6b07a';
const TAU = Math.PI * 2;

/** A canvas font, never under MIN_TEXT (11 px); text the player must read asks for 13 px and more itself. */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 600, serif = false, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

/** Greedy word wrap with the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Fit a one-line text into a width by shrinking from `px` toward `min` (never under MIN_TEXT); returns the size used. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = 13, weight = 600, serif = false, italic = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif, italic);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif, italic);
  }
  return size;
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** "#rrggbb" → "rgba(r,g,b," (append the alpha and ")"). */
export function rgbaPrefix(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},`;
}

/** Mix two "#rrggbb" colours (k = 0 → a, 1 → b). */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const kk = Math.max(0, Math.min(1, k));
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - kk) + ((y >> s) & 255) * kk);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** A deterministic 0..1 for an integer (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── offscreen layers and sprites ─────────────────────────────────
export type Layer = HTMLCanvasElement;

/** A blank offscreen canvas of w × h CSS px at `dpr` (null where there is no DOM). */
export function layer(w: number, h: number, dpr: number): { c: Layer; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

const glowCache = new Map<string, Layer>();

/** A soft round glow in a colour (64 px, baked once): draw it scaled, additively, for light. */
export function glowSprite(hex: string): Layer | null {
  const hit = glowCache.get(hex);
  if (hit) return hit;
  const L = layer(64, 64, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  const g = L.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `${pre}1)`);
  g.addColorStop(0.25, `${pre}.55)`);
  g.addColorStop(0.55, `${pre}.18)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 64);
  glowCache.set(hex, L.c);
  return L.c;
}

/** Draw a baked glow centred at (x, y) with radius r and alpha a (additive). */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

// ── the land: sky, sun, hills, the far sea, the valley floor, the gate ──

/** Where the gate stands (its threshold's middle) and its size. */
export function gateAt(L: Layout): { x: number; y: number; w: number; h: number } {
  const H = L.fig.H;
  const room = L.stage.x + L.stage.w - L.fig.cx;
  const x = L.fig.cx + Math.min(0.44 * H, room * 0.72);
  return { x, y: L.horizon + 0.012 * H, w: 0.14 * H, h: 0.18 * H };
}

/** Where the river meets the far sea (the left horizon). */
export function seaAt(L: Layout): { x0: number; x1: number; y: number } {
  const H = L.fig.H;
  const x1 = Math.max(L.fig.cx - 0.3 * H, 0.3 * L.w * (L.shape === 'tall' ? 0.6 : 1));
  return { x0: -2, x1, y: L.horizon + 0.006 * H };
}

/** A ridge line along the width: a soft sum of sines (deterministic by seed). */
function ridge(x: number, seed: number, amp: number, scale: number): number {
  return amp * (0.55 * Math.sin(x / scale + seed) + 0.3 * Math.sin(x / (scale * 0.43) + seed * 2.1) + 0.15 * Math.sin(x / (scale * 0.19) + seed * 3.7));
}

/**
 * The land, baked per size and per step of the far land's life (`far` 0..1) and of the dawn (`dawn` 0..1: the
 * intro's first light → the morning): sky, sun, far hills, the sea on the left horizon (grey and dead → fresh,
 * green shores), the dusty valley floor, the gate with its door-light.
 */
export function bakeLand(L: Layout, dpr: number, far: number, dawn = 1): Layer | null {
  const B = layer(L.w, L.h, dpr);
  if (!B) return null;
  const c = B.ctx, H = L.fig.H, yH = L.horizon, w = L.w;
  // the sky: a soft morning blue above, the gold of the dawn at the horizon
  const sky = c.createLinearGradient(0, 0, 0, yH);
  sky.addColorStop(0, mix('#3a4f7a', '#7fb2d4', dawn));
  sky.addColorStop(0.55, mix('#a7849a', '#cfe1e2', dawn));
  sky.addColorStop(0.86, mix('#f0b38a', '#fbe6bb', dawn));
  sky.addColorStop(1, mix('#f6c992', '#fff1cf', dawn));
  c.fillStyle = sky;
  c.fillRect(0, 0, w, yH + 1);
  // the sun low in the east (left), where the river goes
  const sea = seaAt(L);
  const sx = Math.max(0.08 * w, sea.x1 * 0.45), sy = yH - 0.035 * H;
  const sun = c.createRadialGradient(sx, sy, 0, sx, sy, 0.9 * H);
  sun.addColorStop(0, `rgba(255,248,222,${0.95 * dawn})`);
  sun.addColorStop(0.06, `rgba(255,236,190,${0.75 * dawn})`);
  sun.addColorStop(0.3, `rgba(255,214,150,${0.25 * dawn})`);
  sun.addColorStop(1, 'rgba(255,214,150,0)');
  c.fillStyle = sun;
  c.fillRect(0, 0, w, yH + 1);
  c.fillStyle = `rgba(255,252,238,${dawn})`;
  c.beginPath();
  c.arc(sx, sy, Math.max(3, 0.022 * H), 0, TAU);
  c.fill();
  // a few thin clouds catching the light
  c.globalAlpha = 0.5;
  for (let i = 0; i < 4; i++) {
    const cy = yH * (0.25 + 0.15 * i) - 0.02 * H, cxp = w * hash(i + 3);
    const g = c.createLinearGradient(0, cy - 3, 0, cy + 3);
    g.addColorStop(0, 'rgba(255,240,220,0)');
    g.addColorStop(0.5, `rgba(255,236,214,${0.5 - 0.08 * i})`);
    g.addColorStop(1, 'rgba(255,240,220,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cxp, cy, 0.5 * H * (1 - 0.1 * i), 0.008 * H + 2, 0, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
  // far hills: two soft ranges, bluish lilac in the haze
  for (const [k, col, amp, sc, seed] of [[0.06, '#b9a9b7', 0.05, 0.6, 1.3], [0.03, '#c8a98f', 0.035, 0.42, 4.2]] as const) {
    c.fillStyle = mix(col, '#f2d9b8', 0.15);
    c.beginPath();
    c.moveTo(0, yH + 1);
    for (let x = 0; x <= w; x += 6) c.lineTo(x, yH - k * H - ridge(x, seed, amp * H, sc * H) - amp * H * 0.5);
    c.lineTo(w, yH + 1);
    c.closePath();
    c.fill();
  }
  // the valley floor: dust and ochre, warmer near
  const floor = c.createLinearGradient(0, yH, 0, L.h);
  floor.addColorStop(0, '#e4c999');
  floor.addColorStop(0.25, '#d9b57f');
  floor.addColorStop(1, '#b98a57');
  c.fillStyle = floor;
  c.fillRect(0, yH, w, L.h - yH);
  // dry texture: short strokes of lighter and darker dust, sparse stones
  for (let i = 0; i < 140; i++) {
    const x = hash(i * 3.1) * w, k = hash(i * 7.7);
    const y = yH + (k * k) * (L.h - yH);
    const len = (3 + 14 * k) * (H / 400 + 0.5);
    c.strokeStyle = hash(i) > 0.5 ? 'rgba(250,232,196,.35)' : 'rgba(140,100,60,.18)';
    c.lineWidth = 0.6 + 1.2 * k;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y + 0.6 * k);
    c.stroke();
  }
  // the far sea on the left horizon: a thin band of salt grey at first, turquoise with green shores as the river
  // reaches it (Ezek 47:8-9)
  const sh = 0.012 * H + 2;
  const sx0 = sea.x0, sx1 = sea.x1;
  c.fillStyle = mix('#ece4d2', '#a9d58f', far);
  c.beginPath();
  c.moveTo(sx0, sea.y - sh * 0.6);
  c.lineTo(sx1 + 0.05 * H, sea.y - sh * 0.4);
  c.quadraticCurveTo(sx1 + 0.08 * H, sea.y + sh * 0.9, sx1 - 0.02 * H, sea.y + sh * 1.5);
  c.lineTo(sx0, sea.y + sh * 1.6);
  c.closePath();
  c.fill();
  const sg = c.createLinearGradient(0, sea.y - sh * 0.5, 0, sea.y + sh);
  sg.addColorStop(0, mix('#d9d8d0', '#c4f4ee', far));
  sg.addColorStop(1, mix('#a8b0b2', '#3cbfcc', far));
  c.fillStyle = sg;
  c.beginPath();
  c.moveTo(sx0, sea.y - sh * 0.45);
  c.lineTo(sx1, sea.y - sh * 0.3);
  c.quadraticCurveTo(sx1 + 0.03 * H, sea.y + sh * 0.4, sx1 - 0.04 * H, sea.y + sh);
  c.lineTo(sx0, sea.y + sh * 1.05);
  c.closePath();
  c.fill();
  c.strokeStyle = `rgba(255,255,255,${0.35 + 0.3 * far})`;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(sx0, sea.y - sh * 0.15);
  c.lineTo(sx1 - 0.02 * H, sea.y - sh * 0.05);
  c.stroke();
  // green comes to the shores in stages: grass, then reeds and small trees
  if (far > 0.2) {
    const n = Math.round(6 + 30 * far);
    for (let i = 0; i < n; i++) {
      const x = sx0 + (sx1 - sx0 + 0.05 * H) * hash(i * 5.3), y = sea.y - sh * (0.55 + 0.25 * hash(i * 2.9));
      const r = (0.004 + 0.006 * hash(i)) * H + 0.8;
      c.fillStyle = `rgba(${60 + 40 * hash(i + 1)},${130 + 40 * hash(i + 2)},70,${Math.min(1, (far - 0.2) * 2)})`;
      c.beginPath();
      c.ellipse(x, y - r * 0.6, r, r * 1.5, 0, 0, TAU);
      c.fill();
    }
  }
  // the gate: low walls of the house on either side, two jambs, a lintel, the doorway's light, the threshold
  const g = gateAt(L);
  const gw = g.w, gh = g.h, gx = g.x - gw / 2, gy = g.y - gh;
  c.fillStyle = '#d8c39b';
  c.fillRect(gx - 0.5 * gw, gy + 0.45 * gh, 2 * gw, 0.55 * gh);
  c.fillStyle = 'rgba(120,90,60,.18)';
  c.fillRect(gx - 0.5 * gw, gy + 0.45 * gh, 2 * gw, 0.06 * gh);
  const door = c.createRadialGradient(g.x, gy + 0.62 * gh, 0, g.x, gy + 0.62 * gh, gw * 1.6);
  door.addColorStop(0, `rgba(255,252,236,${0.55 * dawn + 0.3})`);
  door.addColorStop(0.4, `rgba(255,236,190,${0.25 * dawn + 0.1})`);
  door.addColorStop(1, 'rgba(255,236,190,0)');
  c.fillStyle = door;
  c.fillRect(g.x - gw * 1.6, gy - gw, gw * 3.2, gh + 2 * gw);
  c.fillStyle = '#e7d4ae';
  c.fillRect(gx, gy + 0.08 * gh, 0.22 * gw, 0.92 * gh);
  c.fillRect(gx + 0.78 * gw, gy + 0.08 * gh, 0.22 * gw, 0.92 * gh);
  c.fillStyle = '#c9b086';
  c.fillRect(gx + 0.62 * gw + 0.16 * gw, gy + 0.08 * gh, 0.06 * gw, 0.92 * gh);
  c.fillStyle = '#efe0c0';
  c.fillRect(gx - 0.08 * gw, gy, 1.16 * gw, 0.12 * gh);
  const light = c.createLinearGradient(0, gy + 0.12 * gh, 0, g.y);
  light.addColorStop(0, `rgba(255,250,232,${0.6 + 0.35 * dawn})`);
  light.addColorStop(1, `rgba(255,236,186,${0.75 + 0.2 * dawn})`);
  c.fillStyle = light;
  c.fillRect(gx + 0.22 * gw, gy + 0.12 * gh, 0.56 * gw, 0.88 * gh);
  c.fillStyle = '#cdb68c';
  c.fillRect(gx - 0.12 * gw, g.y - 0.03 * gh, 1.24 * gw, 0.07 * gh);
  return B.c;
}

// ── the river ────────────────────────────────────────────────────

export interface River {
  /** the waterline at the figure (screen y), the river's half-width there */
  yw: number;
  half: number;
  /** the near water (from the waterline to the bottom), the arm from the gate, the arm to the sea: closed polygons */
  near: [number, number][];
  up: [number, number][];
  down: [number, number][];
  /** the flood behind the figure as the river grows wide (from the waterline to the horizon), and how much of it shows */
  flood: [number, number][];
  floodK: number;
  /** how much of the arm to the sea shows (it comes as the water rises: at first only the trickle from the gate) */
  downK: number;
}

/** A point and the unit direction of a cubic Bézier at t. */
function cubicAt(a: [number, number], c1: [number, number], c2: [number, number], b: [number, number], t: number): { x: number; y: number; dx: number; dy: number } {
  const u = 1 - t;
  const x = u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0];
  const y = u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1];
  let dx = 3 * u * u * (c1[0] - a[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (b[0] - c2[0]);
  let dy = 3 * u * u * (c1[1] - a[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (b[1] - c2[1]);
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  return { x, y, dx, dy };
}

/** A meandering stream along a cubic centre line from `a` to `b`, its width going from `wa` to `wb`, its banks wavering. */
export function stream(a: [number, number], c1: [number, number], c2: [number, number], b: [number, number], wa: number, wb: number, seed = 0, n = 22): [number, number][] {
  const left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = cubicAt(a, c1, c2, b, t);
    const w = (wa + (wb - wa) * Math.pow(t, 1.5)) / 2;
    const wl = w * (1 + 0.14 * Math.sin(t * 11 + seed)), wr = w * (1 + 0.14 * Math.sin(t * 9 + seed * 2.3 + 1));
    left.push([p.x - p.dy * wl, p.y + p.dx * wl]);
    right.push([p.x + p.dy * wr, p.y - p.dx * wr]);
  }
  return [...left, ...right.reverse()];
}

/** How far the river may spread at the figure (figure units): up to the first trees on the banks. */
export function riverMax(L: Layout): number {
  return L.shape === 'tall' ? 0.6 : 0.56;
}

/**
 * The river's shapes for a water level 0..4 (the waterline `yw` on the figure, from waterY in content.ts): a pool at
 * the feet and two thin streams at first — one down from the gate's threshold, one away to the far sea — widening as
 * the water rises until the valley floor is river between the banks and their trees.
 */
export function river(L: Layout, level: number, yw: number): River {
  const H = L.fig.H, cx = L.fig.cx, yH = L.horizon;
  const k = Math.max(0, Math.min(1, level / 4));
  const half = H * (0.1 + (riverMax(L) - 0.1) * Math.pow(k, 0.85));
  const bottom = L.h + 4;
  // the near water comes on toward the viewer as a river widening with the nearness, its banks wavering
  const spread = half * 1.35 + 0.16 * H;
  // sides that widen toward the viewer and waver a little (a straight-sided trapezoid would read as a pool's tiles)
  const n = 24, right: [number, number][] = [], left: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = yw + (bottom - yw) * t;
    // the top corners rounded into the banks (the river at the figure is no box)
    const w = half * (1 - 0.3 * Math.exp(-t * 14)) + (spread - half) * t * t + Math.sin(t * 7.3 + 1) * 0.012 * H * t;
    right.push([cx + w + Math.sin(t * 5.1) * 0.01 * H * t, y]);
    left.push([cx - w - Math.sin(t * 4.3 + 2) * 0.01 * H * t, y]);
  }
  const near: [number, number][] = [...left.reverse(), ...right];
  const g = gateAt(L);
  const dy = Math.max(2, yw - yH);
  // a stream may not be wider than its bend allows (it would fold over itself): the flood takes over as it widens
  const wb = Math.min(half, 0.6 * dy + 0.03 * H);
  const end: [number, number] = [cx + wb * 0.42, yw + 0.5];
  const up = stream([g.x, g.y], [g.x - 0.1 * H, g.y + dy * 0.3], [end[0] + 0.3 * H + half * 0.2, end[1] - dy * 0.4], end, (0.014 + 0.02 * k) * H, wb, 1);
  const sea = seaAt(L);
  const tip: [number, number] = [sea.x1 - 0.03 * H, sea.y + 0.004 * H];
  const start: [number, number] = [cx - wb * 0.42, yw + 0.5];
  const down = stream(start, [start[0] - 0.25 * H - half * 0.2, start[1] - dy * 0.3], [tip[0] + 0.12 * H, tip[1] + dy * 0.3], tip, Math.min(wb * 0.5, 0.5 * dy), (0.01 + 0.02 * k) * H, 2);
  const top = yH + 0.004 * H;
  const flood: [number, number][] = [[cx - half, yw + 0.5]];
  for (let i = 0; i <= 12; i++) {
    const x = tip[0] + (g.x + 0.04 * H - tip[0]) * (i / 12);
    flood.push([x, top + Math.sin(i * 1.7) * 0.003 * H + 0.004 * H * Math.sin((i / 12) * Math.PI)]);
  }
  flood.push([cx + half, yw + 0.5]);
  return { yw, half, near, up, down, flood, floodK: Math.max(0, Math.min(1, (k - 0.45) / 0.45)), downK: Math.max(0, Math.min(1, (k - 0.15) / 0.3)) };
}

export function polyPath(ctx: CanvasRenderingContext2D, pts: readonly [number, number][]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// ── the figure and its dust ──────────────────────────────────────

/** Screen coordinates for figure units inside a layer whose origin is at (ox, oy). */
export const mapper = (L: Layout, ox = 0, oy = 0): ToScreen => (x, y) => [L.fig.cx - ox + x * L.fig.H, L.fig.top - oy + y * L.fig.H];

/** The figure's own box (px) with a margin for its rim and its hands. */
export function figureBox(L: Layout): { x: number; y: number; w: number; h: number } {
  const H = L.fig.H, half = (FIG_HALF + 0.04) * H;
  return { x: L.fig.cx - half, y: L.fig.top - 0.05 * H, w: 2 * half, h: 1.1 * H };
}

/**
 * The figure of light in daylight, baked per size: a pearl body, warm where the sun falls and cool toward the feet,
 * an inner glow along the midline, and Rzeki's rim of light — here a soft gold halo outside the union with a thin
 * warm contour, so the figure reads against the bright sky and the water alike.  No face, no features.
 */
export function bakeFigure(L: Layout, dpr: number): Layer | null {
  const box = figureBox(L);
  const B = layer(box.w, box.h, dpr);
  if (!B) return null;
  const c = B.ctx, H = L.fig.H;
  const map = mapper(L, box.x, box.y);
  const sil = figurePath(map);
  const [, y0] = map(0, 0), [, y1] = map(0, 1);
  c.lineJoin = 'round';
  // the halo of light outside, then a thin warm contour
  c.strokeStyle = 'rgba(255,236,180,.22)';
  c.lineWidth = Math.max(7, H * 0.034);
  c.stroke(sil);
  c.strokeStyle = 'rgba(255,244,214,.45)';
  c.lineWidth = Math.max(3, H * 0.014);
  c.stroke(sil);
  const rim = c.createLinearGradient(0, y0, 0, y1);
  rim.addColorStop(0, 'rgba(186,128,58,.75)');
  rim.addColorStop(0.5, 'rgba(120,120,128,.55)');
  rim.addColorStop(1, 'rgba(60,120,140,.6)');
  c.strokeStyle = rim;
  c.lineWidth = Math.max(1.2, H * 0.0045);
  c.stroke(sil);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.fill(sil);
  c.globalCompositeOperation = 'source-over';
  // the body: pearl light, warm at the head and shoulders, cool and clear toward the feet
  const body = c.createLinearGradient(0, y0, 0, y1);
  body.addColorStop(0, 'rgba(255,248,232,.96)');
  body.addColorStop(0.3, 'rgba(255,250,240,.93)');
  body.addColorStop(0.7, 'rgba(236,250,252,.9)');
  body.addColorStop(1, 'rgba(214,244,248,.9)');
  c.fillStyle = body;
  c.fill(sil);
  c.save();
  c.clip(sil);
  const [mx] = map(0, 0);
  const side = c.createLinearGradient(mx - 0.16 * H, 0, mx + 0.16 * H, 0);
  side.addColorStop(0, 'rgba(176,196,214,.35)');
  side.addColorStop(0.35, 'rgba(255,255,255,0)');
  side.addColorStop(0.65, 'rgba(255,255,255,0)');
  side.addColorStop(1, 'rgba(214,170,120,.3)');
  c.fillStyle = side;
  c.fillRect(0, 0, box.w, box.h);
  for (const [y, r, a] of [[0.07, 0.07, 0.5], [0.3, 0.17, 0.45], [0.5, 0.13, 0.25]] as const) {
    const [gx, gy] = map(0, y);
    const rg = c.createRadialGradient(gx, gy, 0, gx, gy, r * H);
    rg.addColorStop(0, `rgba(255,255,250,${a})`);
    rg.addColorStop(1, 'rgba(255,255,250,0)');
    c.fillStyle = rg;
    c.fillRect(gx - r * H, gy - r * H, 2 * r * H, 2 * r * H);
  }
  c.restore();
  return B.c;
}

/**
 * The grey dust over the figure, baked per size in the figure's box: a dull veil and fine specks, clipped to the
 * silhouette.  The view draws it above and below the washing's front at the dust left there.
 */
export function bakeDust(L: Layout, dpr: number): Layer | null {
  const box = figureBox(L);
  const B = layer(box.w, box.h, dpr);
  if (!B) return null;
  const c = B.ctx, H = L.fig.H;
  const map = mapper(L, box.x, box.y);
  const sil = figurePath(map);
  c.save();
  c.clip(sil);
  c.fillStyle = 'rgba(132,124,112,.4)';
  c.fill(sil);
  const n = Math.round(170 + H * 0.4);
  for (let i = 0; i < n; i++) {
    const x = hash(i * 1.37) * box.w, y = hash(i * 2.71 + 9) * box.h;
    const r = (0.6 + 1.5 * hash(i * 4.1)) * Math.max(0.7, H / 380);
    c.fillStyle = hash(i * 5.9) > 0.5 ? 'rgba(104,94,82,.5)' : 'rgba(170,160,144,.55)';
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
  c.restore();
  return B.c;
}

// ── the trees and their leaves ───────────────────────────────────

export interface TreeSpec { x: number; base: number; size: number; side: -1 | 1; seed: number }
export interface Twig { x: number; y: number; a: number; depth: number }
export interface TreeGeo { spec: TreeSpec; branches: { x0: number; y0: number; x1: number; y1: number; w: number }[]; leaves: Twig[]; fruits: Twig[]; box: { x: number; y: number; w: number; h: number } }

/** The trees on both banks for a layout: two on a phone upright, more along a wide valley. */
export function treeSpecs(L: Layout): TreeSpec[] {
  const H = L.fig.H, cx = L.fig.cx;
  const rows: [number, number, number][] = L.shape === 'tall'
    ? [[0.64, 0.56, 0.99]]
    : L.shape === 'side' ? [[0.64, 0.52, 0.99], [0.98, 0.38, 0.8]]
      : [[0.64, 0.54, 1.0], [0.98, 0.4, 0.8], [1.32, 0.3, 0.64]];
  const out: TreeSpec[] = [];
  let seed = 1;
  for (const [dx, size, base] of rows) {
    for (const side of [-1, 1] as const) {
      const x = cx + side * dx * H;
      seed++;
      if (x < -0.1 * H || x > L.w + 0.1 * H) continue;
      if (side === 1 && L.shape !== 'tall' && x > L.stage.x + L.stage.w + 0.15 * H) continue;
      out.push({ x, base: L.fig.top + base * H, size: size * H, side, seed });
    }
  }
  return out;
}

/** A tree's branches, leaf twigs and fruit places (deterministic): a trunk, then forks to depth 4. */
export function treeGeo(spec: TreeSpec): TreeGeo {
  const S = spec.size;
  const branches: TreeGeo['branches'] = [];
  const leaves: Twig[] = [];
  const fruits: Twig[] = [];
  let r = spec.seed * 13;
  const rnd = () => hash(r++);
  const grow = (x: number, y: number, a: number, len: number, w: number, depth: number): void => {
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    branches.push({ x0: x, y0: y, x1, y1, w });
    if (depth >= 4) {
      for (let i = 0; i < 4; i++) leaves.push({ x: x1 + (rnd() - 0.5) * 0.09 * S, y: y1 + (rnd() - 0.5) * 0.07 * S, a: a + (rnd() - 0.5) * 2.2, depth });
      return;
    }
    if (depth === 2 || depth === 3) fruits.push({ x: x1, y: y1 + 0.02 * S, a, depth });
    const spread = 0.42 + 0.18 * rnd();
    grow(x1, y1, a - spread + (rnd() - 0.5) * 0.2, len * (0.7 + 0.08 * rnd()), w * 0.68, depth + 1);
    grow(x1, y1, a + spread + (rnd() - 0.5) * 0.2, len * (0.7 + 0.08 * rnd()), w * 0.68, depth + 1);
    if (depth === 1) grow(x1, y1, a + (rnd() - 0.5) * 0.3, len * 0.62, w * 0.6, depth + 2);
  };
  const lean = -spec.side * 0.08;
  grow(spec.x, spec.base, -Math.PI / 2 + lean, S * 0.34, Math.max(2.4, S * 0.075), 0);
  // the leaf slots from the middle of the crown outward, so a tree fills from within
  const cxm = leaves.reduce((s, l) => s + l.x, 0) / Math.max(1, leaves.length);
  const cym = leaves.reduce((s, l) => s + l.y, 0) / Math.max(1, leaves.length);
  leaves.sort((p, q) => Math.hypot(p.x - cxm, p.y - cym) - Math.hypot(q.x - cxm, q.y - cym));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of branches) {
    x0 = Math.min(x0, b.x0, b.x1); x1 = Math.max(x1, b.x0, b.x1);
    y0 = Math.min(y0, b.y0, b.y1); y1 = Math.max(y1, b.y0, b.y1);
  }
  const m = 0.1 * S;
  return { spec, branches, leaves, fruits: fruits.slice(0, 6), box: { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m } };
}

/** A leaf: an almond with a bright midrib (centred at x, y, pointing along a), `len` long. */
export function leafShape(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, fill: string, rim: string, alpha = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.quadraticCurveTo(-len * 0.05, -len * 0.5, len / 2, 0);
  ctx.quadraticCurveTo(-len * 0.05, len * 0.5, -len / 2, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(0.6, len * 0.06);
  ctx.beginPath();
  ctx.moveTo(-len * 0.42, 0);
  ctx.lineTo(len * 0.42, 0);
  ctx.stroke();
  ctx.restore();
}

/** A tree with its leaves: `old` kept from earlier sessions (deep green), `now` grown this session (luminous). */
export function bakeTree(geo: TreeGeo, dpr: number, old: number, now: number, fruits: number, buds = false): Layer | null {
  const b = geo.box;
  const B = layer(b.w, b.h, dpr);
  if (!B) return null;
  const c = B.ctx, S = geo.spec.size;
  c.translate(-b.x, -b.y);
  c.lineCap = 'round';
  // the bark: grey-brown and dry, a little warmer once it has leaves
  const live = Math.min(1, (old + now) / 12);
  // a soft crown of green behind the leaves once there are some (so the crown reads as one at a glance)
  const nLeaves = Math.min(geo.leaves.length, old + now);
  if (nLeaves > 0) {
    const fill = Math.min(1, nLeaves / 30);
    const xs = geo.leaves.slice(0, nLeaves);
    const mx = xs.reduce((sum, l) => sum + l.x, 0) / xs.length, my = xs.reduce((sum, l) => sum + l.y, 0) / xs.length;
    const rg = c.createRadialGradient(mx, my, 0, mx, my, S * (0.25 + 0.2 * fill));
    rg.addColorStop(0, `rgba(150,210,120,${0.18 + 0.2 * fill})`);
    rg.addColorStop(1, 'rgba(150,210,120,0)');
    c.fillStyle = rg;
    c.fillRect(b.x, b.y, b.w, b.h);
  }
  for (const br of geo.branches) {
    // tapered and a little bent: each branch a thin quad from its base width to its tip width
    const dx = br.x1 - br.x0, dy = br.y1 - br.y0, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, w0 = br.w / 2, w1 = br.w * 0.34;
    const bend = 0.08 * d;
    c.fillStyle = mix('#8a7663', '#6f5c40', live);
    c.beginPath();
    c.moveTo(br.x0 + nx * w0, br.y0 + ny * w0);
    c.quadraticCurveTo((br.x0 + br.x1) / 2 + nx * (bend + w0), (br.y0 + br.y1) / 2 + ny * (bend + w0), br.x1 + nx * w1, br.y1 + ny * w1);
    c.lineTo(br.x1 - nx * w1, br.y1 - ny * w1);
    c.quadraticCurveTo((br.x0 + br.x1) / 2 + nx * (bend - w0), (br.y0 + br.y1) / 2 + ny * (bend - w0), br.x0 - nx * w0, br.y0 - ny * w0);
    c.closePath();
    c.fill();
  }
  // the light catches the bark on the sun's side (the left, the east)
  c.strokeStyle = 'rgba(255,236,200,.28)';
  for (const br of geo.branches) {
    if (br.w < 2) continue;
    c.lineWidth = Math.max(0.6, br.w * 0.22);
    c.beginPath();
    c.moveTo(br.x0 - br.w * 0.25, br.y0);
    c.lineTo(br.x1 - br.w * 0.12, br.y1);
    c.stroke();
  }
  const len = S * 0.13;
  const n = Math.min(geo.leaves.length, old + now);
  if (buds) {
    for (let i = n; i < geo.leaves.length; i += 2) {
      const l = geo.leaves[i];
      c.fillStyle = 'rgba(196,232,150,.85)';
      c.beginPath();
      c.ellipse(l.x, l.y, len * 0.12 + 0.6, len * 0.2 + 0.8, l.a, 0, TAU);
      c.fill();
    }
  }
  for (let i = 0; i < n; i++) {
    const l = geo.leaves[i];
    const fresh = i >= old;
    if (fresh) glow(c, '#d8ffb0', l.x, l.y, len * 0.9, 0.35);
    leafShape(c, l.x, l.y, l.a, len, fresh ? LEAF : '#5c9455', fresh ? LEAF_HI : 'rgba(210,240,190,.5)', fresh ? 1 : 0.9);
  }
  for (let i = 0; i < Math.min(fruits, geo.fruits.length); i++) {
    const f = geo.fruits[i];
    glow(c, '#ffd27a', f.x, f.y, S * 0.06, 0.5);
    c.fillStyle = '#f2a44a';
    c.beginPath();
    c.arc(f.x, f.y, S * 0.022 + 1, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,246,210,.8)';
    c.beginPath();
    c.arc(f.x - S * 0.007, f.y - S * 0.007, S * 0.007 + 0.5, 0, TAU);
    c.fill();
  }
  return B.c;
}
