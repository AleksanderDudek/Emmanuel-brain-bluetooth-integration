/**
 * Złota passa's paint box (DESIGN.md §26, builder B): the fonts, the day's light (a few keyframes from the dawn to the
 * night, mixed for any `day` 0..1: the sky's three colours, the ambient light, the sun's colour, strength and
 * direction, the haze, the lamps and the stars), colour maths, soft glow sprites drawn additively, offscreen layers and
 * small drawing helpers.  No randomness at draw time: `hash` gives every window and every pigeon its stable place.
 */

export const FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const TAU = Math.PI * 2;

/** The warm golds of the streak and the inks of words. */
export const C = {
  gold: '#f5c66a',
  goldDeep: '#c98a2e',
  goldHi: '#fff1c4',
  bulb: '#ffd98a',
  bulbHi: '#fff6dc',
  ember: '#ff9a5a',
  ink: '#2b2118',
  inkSoft: '#5a4a3a',
  cream: '#fbf3e4',
  paper: '#f6ecda',
  night: '#0c1230',
  wire: '#2a2420',
} as const;

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const smooth = (k: number): number => { const x = clamp01(k); return x * x * (3 - 2 * x); };
export const easeOut = (k: number): number => { const x = clamp01(k); return 1 - (1 - x) * (1 - x); };
export const easeInOut = (k: number): number => { const x = clamp01(k); return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x); };
export const band = (a: number, b: number, x: number): number => smooth((x - a) / (b - a));

/** A stable pseudo-random 0..1 for an integer. */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type RGB = [number, number, number];

export const hexRGB = (h: string): RGB => {
  const v = parseInt(h.slice(1, 7), 16);
  return Number.isFinite(v) ? [(v >> 16) & 255, (v >> 8) & 255, v & 255] : [128, 128, 128];
};
const to2 = (v: number): string => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
export const rgbHex = (c: RGB): string => `#${to2(c[0])}${to2(c[1])}${to2(c[2])}`;

/** "#rrggbb" with an alpha as "rgba(…)". */
export const rgba = (hex: string, a: number): string => {
  const [r, g, b] = hexRGB(hex);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
};

/** Mix two hex colours (k 0..1) as "#rrggbb". */
export function mixHex(a: string, b: string, k: number): string {
  const p = hexRGB(a), q = hexRGB(b), t = clamp01(k);
  return rgbHex([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
}

/** Grey of a colour (its luminance), mixed back toward it by `keep` (0 all grey … 1 the colour). */
export function desat(hex: string, keep: number, tint = '#8e96a8'): string {
  const [r, g, b] = hexRGB(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  const t = hexRGB(tint);
  const grey: RGB = [l * 0.82 + t[0] * 0.18, l * 0.82 + t[1] * 0.18, l * 0.82 + t[2] * 0.18];
  return rgbHex([grey[0] + (r - grey[0]) * keep, grey[1] + (g - grey[1]) * keep, grey[2] + (b - grey[2]) * keep]);
}

/** A CSS font. */
export const font = (weight: number, px: number, family = FONT, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(px * 10) / 10}px ${family}`;

// ── the day's light ───────────────────────────────────────────────

/** The light of one moment of the day: everything the street's colours follow. */
export interface Light {
  /** the sky from its top to the horizon */
  top: RGB; mid: RGB; hor: RGB;
  /** the ambient light (multiplies a surface's colour) and the sun's (added where it falls), its strength 0..1 */
  amb: RGB; sun: RGB; sunI: number;
  /** toward the sun (unit-ish): x right, y up, z down the street */
  L: [number, number, number];
  /** the haze's colour and its density (how far things fade into it) */
  haze: RGB; hazeK: number;
  /** street lamps 0..1, stars 0..1, the evening's blue 0..1 (shop windows and lamps glow more in it) */
  lamps: number; stars: number; dusk: number;
}

interface Key { at: number; top: string; mid: string; hor: string; amb: RGB; sun: string; sunI: number; L: [number, number, number]; haze: string; hazeK: number; lamps: number; stars: number; dusk: number }

/** The keyframes: dawn mist and long cool shadows → bright noon → the golden afternoon → the blue evening. */
const KEYS: Key[] = [
  { at: 0.0, top: '#34467e', mid: '#8a8cbc', hor: '#f0bfb2', amb: [0.5, 0.53, 0.7], sun: '#ffb49a', sunI: 0.22, L: [-0.62, 0.07, -0.78], haze: '#c6bfd8', hazeK: 0.75, lamps: 0.7, stars: 0.25, dusk: 0.55 },
  { at: 0.1, top: '#5280c0', mid: '#a6bfe0', hor: '#f7d8c4', amb: [0.6, 0.64, 0.78], sun: '#ffd4b0', sunI: 0.62, L: [-0.66, 0.2, -0.72], haze: '#dcd6e4', hazeK: 0.42, lamps: 0, stars: 0, dusk: 0 },
  { at: 0.28, top: '#4c8ad2', mid: '#98c3ec', hor: '#e6eff4', amb: [0.68, 0.72, 0.84], sun: '#fff1dc', sunI: 0.88, L: [-0.58, 0.52, -0.62], haze: '#d8e4ee', hazeK: 0.2, lamps: 0, stars: 0, dusk: 0 },
  { at: 0.46, top: '#3c84d6', mid: '#8cc2ef', hor: '#d9ebf5', amb: [0.74, 0.77, 0.86], sun: '#fffaf0', sunI: 1, L: [-0.2, 0.95, 0.16], haze: '#d4e3ef', hazeK: 0.16, lamps: 0, stars: 0, dusk: 0 },
  { at: 0.64, top: '#5585c6', mid: '#c9c6bc', hor: '#f8d396', amb: [0.7, 0.64, 0.62], sun: '#ffd28a', sunI: 0.96, L: [0.52, 0.36, 0.78], haze: '#f0d6b0', hazeK: 0.24, lamps: 0, stars: 0, dusk: 0 },
  { at: 0.76, top: '#4a5d9c', mid: '#d29a8c', hor: '#ffb768', amb: [0.6, 0.51, 0.54], sun: '#ffa860', sunI: 0.82, L: [0.3, 0.12, 0.95], haze: '#f2b48a', hazeK: 0.3, lamps: 0.15, stars: 0, dusk: 0.2 },
  { at: 0.85, top: '#2b3a74', mid: '#7c6aa2', hor: '#ff9468', amb: [0.38, 0.35, 0.5], sun: '#ff8a50', sunI: 0.22, L: [0.05, 0.02, 1], haze: '#a88aa8', hazeK: 0.32, lamps: 0.75, stars: 0.05, dusk: 0.6 },
  { at: 0.93, top: '#16234f', mid: '#2f4280', hor: '#c9857c', amb: [0.24, 0.27, 0.44], sun: '#ff8a50', sunI: 0, L: [0, 0.05, 1], haze: '#3a4876', hazeK: 0.34, lamps: 1, stars: 0.6, dusk: 0.9 },
  { at: 1.0, top: '#0b112c', mid: '#18234e', hor: '#463a5e', amb: [0.17, 0.19, 0.33], sun: '#ff8a50', sunI: 0, L: [0, 0.05, 1], haze: '#26305a', hazeK: 0.34, lamps: 1, stars: 1, dusk: 1 },
];

const mixRGB = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** The light at a moment of the day (0 dawn … 1 night). */
export function lightAt(day: number): Light {
  const d = clamp01(day);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].at <= d) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = smooth((d - a.at) / Math.max(1e-6, b.at - a.at));
  const L: [number, number, number] = [lerp(a.L[0], b.L[0], k), lerp(a.L[1], b.L[1], k), lerp(a.L[2], b.L[2], k)];
  const n = Math.hypot(L[0], L[1], L[2]) || 1;
  return {
    top: mixRGB(hexRGB(a.top), hexRGB(b.top), k),
    mid: mixRGB(hexRGB(a.mid), hexRGB(b.mid), k),
    hor: mixRGB(hexRGB(a.hor), hexRGB(b.hor), k),
    amb: mixRGB(a.amb, b.amb, k),
    sun: mixRGB(hexRGB(a.sun), hexRGB(b.sun), k),
    sunI: lerp(a.sunI, b.sunI, k),
    L: [L[0] / n, L[1] / n, L[2] / n],
    haze: mixRGB(hexRGB(a.haze), hexRGB(b.haze), k),
    hazeK: lerp(a.hazeK, b.hazeK, k),
    lamps: lerp(a.lamps, b.lamps, k),
    stars: lerp(a.stars, b.stars, k),
    dusk: lerp(a.dusk, b.dusk, k),
  };
}

/**
 * A surface's colour under the day's light: its base colour × (the ambient + the sun × how squarely the sun falls on
 * it), faded into the haze with its distance `z` (metres down the street).
 */
export function shade(base: string, lit: number, z: number, Lt: Light, glow = 0): string {
  const c = hexRGB(base);
  const s = Math.max(0, lit) * Lt.sunI;
  const r = (c[0] / 255) * (Lt.amb[0] + (Lt.sun[0] / 255) * s * 0.82) + glow;
  const g = (c[1] / 255) * (Lt.amb[1] + (Lt.sun[1] / 255) * s * 0.82) + glow * 0.8;
  const b = (c[2] / 255) * (Lt.amb[2] + (Lt.sun[2] / 255) * s * 0.82) + glow * 0.5;
  const f = Lt.hazeK * (1 - Math.exp(-Math.max(0, z) / 34));
  return rgbHex([
    (r * 255) * (1 - f) + Lt.haze[0] * f,
    (g * 255) * (1 - f) + Lt.haze[1] * f,
    (b * 255) * (1 - f) + Lt.haze[2] * f,
  ]);
}

/** How much of the haze lies over something `z` metres away (0..1). */
export const hazeAt = (z: number, Lt: Light): number => Lt.hazeK * (1 - Math.exp(-Math.max(0, z) / 34));

// ── canvases and glows ─────────────────────────────────────────────

/** An offscreen canvas of w × h CSS px at `dpr`, its context scaled so drawing is in CSS px; null without a DOM. */
export function layer(w: number, h: number, dpr: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

const glowCache = new Map<string, HTMLCanvasElement>();

/** A soft round glow in a colour (64 px, baked once): draw it scaled, additively, for light. */
export function glowSprite(hex: string): HTMLCanvasElement | null {
  const hit = glowCache.get(hex);
  if (hit) return hit;
  const L = layer(64, 64, 1);
  if (!L) return null;
  const g = L.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, rgba(hex, 1));
  g.addColorStop(0.22, rgba(hex, 0.55));
  g.addColorStop(0.55, rgba(hex, 0.16));
  g.addColorStop(1, rgba(hex, 0));
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 64);
  glowCache.set(hex, L.c);
  return L.c;
}

/** A glow of radius r at (x, y), alpha a (call inside a 'lighter' composite for light). */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number, sy = 1): void {
  if (!(r > 0) || !(a > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const s = glowSprite(hex);
  ctx.globalAlpha = clamp01(a);
  if (s) ctx.drawImage(s, x - r, y - r * sy, r * 2, r * 2 * sy);
  else {
    ctx.fillStyle = rgba(hex, 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.5, r * 0.5 * sy, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A rounded rectangle path. */
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

/**
 * Wrap `text` into lines no wider than `maxW` with the current font: at most `max` lines; a word longer than the
 * line is broken.  Returns the lines and whether everything fit (the caller shrinks the font when it did not).
 */
export function wrapFit(ctx: CanvasRenderingContext2D, text: string, maxW: number, max: number): { lines: string[]; fits: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const tryL = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryL).width <= maxW) { line = tryL; continue; }
    if (line) lines.push(line);
    line = w;
  }
  if (line) lines.push(line);
  const fits = lines.length <= max && lines.every(l => ctx.measureText(l).width <= maxW + 0.5);
  return { lines, fits };
}

/**
 * The largest font (from `px` down to `min`, half a pixel a step) at which `text` wraps into at most `max` lines of
 * `maxW`; at the floor the lines are what they are (more than `max` if they must: never cut).
 */
export function fitWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, max: number, px: number, min: number, weight: number, family = FONT, italic = false): { lines: string[]; px: number } {
  let size = Math.max(min, px);
  for (;;) {
    ctx.font = font(weight, size, family, italic);
    const r = wrapFit(ctx, text, maxW, max);
    if (r.fits || size <= min) return { lines: r.lines, px: size };
    size = Math.max(min, size - 0.5);
  }
}
