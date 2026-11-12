/**
 * Ogień's brushes, shared by the scenes, the view, the intro, the lobby's picture and the card's tiles:
 * fonts that never go under the arcade's 11 px floor, light baked into small sprites (a glow is one
 * drawImage, never a shadowBlur or a filter), the flame (layered teardrops in local units, their gradients
 * made once and reused), sparks and smoke, rounded panels.
 */
import { MIN_TEXT } from '../kit/mobile';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const TAU = Math.PI * 2;
export const GOLD = '#ffd36a';
export const GOLD_HI = '#fff1c2';
export const EMBER = '#ff8a3d';
export const LIGHT = '#e6efff';
export const CREAM = '#fff4dc';
export const INK = '#1a0f12';

/** A canvas font size, never under MIN_TEXT (11 px); text the player must read asks 13 and more itself. */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 700, serif = false, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

/** The largest size from `px` down to `min` (never under 11) at which `text` fits `maxW`; sets ctx.font. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = 13, weight = 700, serif = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif);
  }
  return size;
}

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

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a: number, b: number, k: number): number => a + (b - a) * k;
export function mixRgb(a: readonly number[], b: readonly number[], k: number): [number, number, number] {
  return [Math.round(mix(a[0], b[0], k)), Math.round(mix(a[1], b[1], k)), Math.round(mix(a[2], b[2], k))];
}
export const rgba = (c: readonly number[], a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** A small deterministic random stream (for cached layers: the same picture on every resize). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── offscreen canvases (with a fallback where OffscreenCanvas is missing) ─────
export type Surface = HTMLCanvasElement;

export function surface(w: number, h: number): Surface | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ── light: glows baked into sprites ─────────────────────────────
const sprites = new Map<string, Surface | null>();

/**
 * A soft round glow of one colour (a radial gradient baked once into a 128 px sprite): drawn with
 * `drawGlow`, additively ('lighter') for light that adds up, or normally for a haze.
 */
export function glowSprite(rgb: readonly number[], hard = 0): Surface | null {
  const key = `${rgb.join(',')}|${hard}`;
  if (sprites.has(key)) return sprites.get(key)!;
  const s = surface(128, 128);
  const g = s?.getContext('2d') ?? null;
  if (s && g) {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(rgb, 1));
    gr.addColorStop(Math.min(0.9, 0.12 + hard * 0.5), rgba(rgb, 0.55 + hard * 0.3));
    gr.addColorStop(Math.min(0.97, 0.45 + hard * 0.35), rgba(rgb, 0.16));
    gr.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  sprites.set(key, s);
  return s;
}

/** A glow at (x, y) of radius r; alpha multiplies (the caller sets the composite). */
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: readonly number[], alpha: number, hard = 0): void {
  if (r < 0.5 || alpha <= 0.004) return;
  const s = glowSprite(rgb, hard);
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * Math.min(1, alpha);
  if (s) ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = rgba(rgb, 0.4);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = a0;
}

/** An elliptical glow (a light pool on the ground, a halo on a wall). */
export function drawGlowEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rgb: readonly number[], alpha: number): void {
  if (rx < 0.5 || ry < 0.5 || alpha <= 0.004) return;
  const s = glowSprite(rgb, 0);
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * Math.min(1, alpha);
  if (s) ctx.drawImage(s, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = a0;
}

// ── the flame ────────────────────────────────────────────────────
export interface FlamePalette {
  /** outer, middle and core colours, base to tip (rgb) */
  outer: readonly [readonly number[], readonly number[]];
  mid: readonly [readonly number[], readonly number[]];
  core: readonly [readonly number[], readonly number[]];
  /** a blue root (a candle's, a gas's), or none */
  root?: readonly number[];
}

export const FIRE: FlamePalette = {
  outer: [[214, 64, 24], [255, 112, 34]],
  mid: [[255, 150, 40], [255, 206, 92]],
  core: [[255, 248, 214], [255, 236, 168]],
};
export const CANDLE: FlamePalette = {
  outer: [[255, 120, 40], [255, 170, 70]],
  mid: [[255, 196, 90], [255, 228, 150]],
  core: [[255, 252, 236], [255, 244, 200]],
  root: [90, 140, 255],
};
export const SPIRIT: FlamePalette = {
  outer: [[255, 130, 50], [255, 186, 96]],
  mid: [[255, 214, 120], [255, 238, 176]],
  core: [[255, 255, 245], [255, 250, 228]],
};

const flameGrads = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient[]>>();

/** The three gradients of a palette in the flame's local units (base at 0, tip at −1), made once per context. */
function gradsFor(ctx: CanvasRenderingContext2D, pal: FlamePalette): CanvasGradient[] {
  let m = flameGrads.get(ctx);
  if (!m) {
    m = new Map();
    flameGrads.set(ctx, m);
  }
  const key = `${pal.outer[0].join()}|${pal.core[1].join()}|${pal.root ? 1 : 0}`;
  let g = m.get(key);
  if (!g) {
    const lin = (a: readonly number[], b: readonly number[], alphaTop: number, root?: readonly number[]) => {
      const gr = ctx.createLinearGradient(0, 0.08, 0, -1);
      if (root) {
        gr.addColorStop(0, rgba(root, 0.0));
        gr.addColorStop(0.1, rgba(root, 0.75));
        gr.addColorStop(0.22, rgba(a, 0.95));
      } else gr.addColorStop(0, rgba(a, 0.9));
      gr.addColorStop(0.55, rgba(mixRgb(a, b, 0.6), 0.95));
      gr.addColorStop(1, rgba(b, alphaTop));
      return gr;
    };
    g = [lin(pal.outer[0], pal.outer[1], 0.0, pal.root), lin(pal.mid[0], pal.mid[1], 0.1), lin(pal.core[0], pal.core[1], 0.35)];
    m.set(key, g);
  }
  return g;
}

/**
 * A teardrop path in local units: its base a round belly of half-width `bw` at y = 0, its tip at (sway, −1).
 */
function tear(ctx: CanvasRenderingContext2D, bw: number, sway: number, belly: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0.06);
  ctx.bezierCurveTo(-bw * 1.25, 0.02, -bw * 1.05, -0.38 * belly, -bw * 0.38 + sway * 0.25, -0.62);
  ctx.quadraticCurveTo(-bw * 0.1 + sway * 0.8, -0.86, sway, -1);
  ctx.quadraticCurveTo(bw * 0.12 + sway * 0.8, -0.84, bw * 0.4 + sway * 0.25, -0.6);
  ctx.bezierCurveTo(bw * 1.05, -0.38 * belly, bw * 1.25, 0.02, 0, 0.06);
  ctx.closePath();
}

/**
 * One flame: base at (x, y), `w` wide and `h` tall, flickering with `t` and `energy` (0 still … 1 wild),
 * bent by `bend` (−1 … 1, a draught).  Drawn in the flame's own units, so its gradients are reused.
 */
export function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, energy: number, pal: FlamePalette = FIRE,
  bend = 0, seed = 0, alpha = 1): void {
  if (w < 0.5 || h < 0.5 || alpha <= 0.01) return;
  const e = Math.max(0, Math.min(1.4, energy));
  const s = seed * 1.7;
  const flick = Math.sin(t * 9.1 + s) * 0.5 + Math.sin(t * 13.7 + s * 2.3) * 0.3 + Math.sin(t * 5.3 + s * 0.7) * 0.2;
  const sway = (flick * 0.16 * (0.35 + e) + bend * 0.55) * (w / h) * 1.6;
  const hh = h * (1 + 0.06 * (0.4 + e) * Math.sin(t * 11.3 + s * 1.9));
  const [go, gm, gc] = gradsFor(ctx, pal);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 2, hh);
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  // the outer veil, the body, the core — each a little narrower, its tip lagging the sway
  ctx.fillStyle = go;
  tear(ctx, 1, sway, 1);
  ctx.fill();
  ctx.fillStyle = gm;
  ctx.save();
  ctx.scale(0.78, 0.82);
  tear(ctx, 1, sway * 0.85, 1.05);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = gc;
  ctx.save();
  ctx.scale(0.46, 0.5);
  tear(ctx, 1, sway * 0.6, 1.1);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = a0;
  ctx.restore();
}

/** A stable pseudo-random number in 0..1 for an index (the same flame keeps its shape). */
export const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A blaze: a broad soft body for volume and several flames of their own heights and widths over it, leaning a
 * little toward the middle like a real fire's (a bonfire, a pillar's foot).
 */
export function drawBlaze(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, energy: number,
  pal: FlamePalette = FIRE, n = 5, bend = 0, seed = 0): void {
  drawFlame(ctx, x, y + h * 0.02, w * 1.05, h * 0.8, t * 0.7, energy * 0.6, pal, bend, seed + 11, 0.5);
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1) - 0.5;
    const j = hash(seed * 7.1 + i * 3.3);
    const tall = (1 - Math.abs(k) * 1.2) * (0.62 + 0.5 * j) + 0.12 * Math.sin(t * (1.5 + j) + i * 1.7 + seed);
    const fw = (w / Math.max(1, n * 0.48)) * (0.65 + 0.55 * hash(seed + i * 9.7));
    drawFlame(ctx, x + k * w * 0.78 + (j - 0.5) * w * 0.1, y + Math.abs(k) * h * 0.05, fw, h * Math.max(0.2, tall), t + i * 0.37, energy, pal,
      bend - k * 0.35, seed + i * 3.1);
  }
}

// ── panels and pills ─────────────────────────────────────────────
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Text with a soft dark rim so it reads on any part of the picture. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color = CREAM, align: CanvasTextAlign = 'center',
  weight = 700, serif = false): void {
  ctx.font = font(px, weight, serif);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, fontPx(px) * 0.28);
  ctx.strokeStyle = 'rgba(10,5,8,.72)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ── Ignacy, the old lamplighter ─────────────────────────────────
/**
 * Ignacy's portrait in a round frame: an old man in a cap with a white beard, his lantern's light on one
 * cheek — drawn in a few shapes so it reads at 36 px.
 */
export function paintIgnacy(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, glow = 1): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  const bg = ctx.createRadialGradient(x - r * 0.4, y + r * 0.3, 0, x, y, r * 1.2);
  bg.addColorStop(0, '#6a3a1c');
  bg.addColorStop(1, '#1e1216');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();
  // the lantern's light from the lower left
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x - r * 0.75, y + r * 0.7, r * 1.1, [255, 170, 70], (0.45 + 0.1 * Math.sin(t * 3)) * glow);
  ctx.globalCompositeOperation = 'source-over';
  // shoulders (a dark coat)
  ctx.fillStyle = '#2b1d22';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.05, r * 0.85, r * 0.55, 0, 0, TAU);
  ctx.fill();
  // the face
  ctx.fillStyle = '#d9a27c';
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.02, r * 0.36, r * 0.42, 0, 0, TAU);
  ctx.fill();
  // the beard, white and full
  ctx.fillStyle = '#f2ece4';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.38, y - r * 0.02);
  ctx.quadraticCurveTo(x - r * 0.42, y + r * 0.5, x, y + r * 0.62);
  ctx.quadraticCurveTo(x + r * 0.42, y + r * 0.5, x + r * 0.38, y - r * 0.02);
  ctx.quadraticCurveTo(x, y + r * 0.18, x - r * 0.38, y - r * 0.02);
  ctx.fill();
  // the moustache and a smile
  ctx.fillStyle = '#e6ddd2';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.1, y + r * 0.12, r * 0.13, r * 0.06, -0.3, 0, TAU);
  ctx.ellipse(x + r * 0.1, y + r * 0.12, r * 0.13, r * 0.06, 0.3, 0, TAU);
  ctx.fill();
  // eyes: two kind crescents (they blink now and then)
  const blink = Math.sin(t * 0.9) > 0.985 ? 0.2 : 1;
  ctx.strokeStyle = '#3a2422';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * r * 0.15, y - r * 0.08, r * 0.07, r * 0.05 * blink, 0, Math.PI, TAU);
    ctx.stroke();
  }
  // the cap: a lamplighter's flat cap with a brim
  ctx.fillStyle = '#3b2a3a';
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.38, r * 0.46, r * 0.2, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillRect(x - r * 0.46, y - r * 0.4, r * 0.92, r * 0.08);
  ctx.fillStyle = '#5a405a';
  ctx.fillRect(x - r * 0.5, y - r * 0.34, r * 0.62, r * 0.06);
  ctx.restore();
  // the frame: a warm brass ring
  ctx.strokeStyle = 'rgba(255,206,120,.85)';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}
