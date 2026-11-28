/**
 * Koła światła's paint box (DESIGN.md §28): the fonts and the night's colours, soft glow sprites and the funnels'
 * cone sprites (baked once per colour, drawn additively under a transform — no gradient is built per frame), and
 * small drawing helpers.
 */
import { CENTRES, HUE, type CentreId } from './content';

export const FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const INK = '#f4f0ff';
export const GOLD = '#f5c66a';
export const GOLD_HI = '#fff1c4';
export const PEARL = '#e6e4ff';
export const TAU = Math.PI * 2;

/** The night: top, middle, bottom of the sky behind the figure, and the soft light round it. */
export const NIGHT = ['#06061a', '#0d0b2a', '#140c26'] as const;

export type Canvas2D = HTMLCanvasElement;

const hexRGB = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** "#rrggbb" with an alpha as "rgba(…)". */
export const rgba = (hex: string, a: number): string => {
  const [r, g, b] = hexRGB(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

/** Mix two hex colours (k 0..1) as "#rrggbb". */
export function mixHex(a: string, b: string, k: number): string {
  const p = hexRGB(a), q = hexRGB(b);
  const c = (i: number) => Math.round(p[i] + (q[i] - p[i]) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** A stable pseudo-random 0..1 for an integer. */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function makeCanvas(w: number, h: number): Canvas2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c.getContext('2d') ? c : null;
}

/** A soft round glow sprite (the colour at its core, transparent at its rim), drawn additively. */
export function glowSprite(color: string, size = 128, core = 1): Canvas2D | null {
  const c = makeCanvas(size, size), g = c?.getContext('2d');
  if (!c || !g) return null;
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(color, core));
  gr.addColorStop(0.22, rgba(color, 0.55 * core));
  gr.addColorStop(0.55, rgba(color, 0.16 * core));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Draw a glow sprite centred at (x, y), radius r (rx × ry when stretched). */
export function glow(ctx: CanvasRenderingContext2D, sprite: Canvas2D | null, x: number, y: number, r: number, a: number, ry = r): void {
  if (!sprite || r <= 0 || ry <= 0 || a <= 0.003) return;
  const was = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, a) * was;
  ctx.drawImage(sprite, x - r, y - ry, 2 * r, 2 * ry);
  ctx.globalAlpha = was;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** The cone sprite's size: the tip at (0, H/2), the mouth the right edge, its half-height H/2. */
export const CONE_W = 256;
export const CONE_H = 128;

/**
 * A funnel of light lying along x: a trumpet that widens from a fine tip to the mouth, brightest along its axis and at
 * its tip, its edges soft — the colour `hue` with a white-hot `core`.
 */
export function coneSprite(hue: string, core: string): Canvas2D | null {
  const c = makeCanvas(CONE_W, CONE_H), g = c?.getContext('2d');
  if (!c || !g) return null;
  const mid = CONE_H / 2;
  const half = (x: number): number => 1.5 + (mid - 3) * Math.pow(x / CONE_W, 1.45);
  const shape = (scale: number): void => {
    g.beginPath();
    g.moveTo(0, mid);
    for (let x = 0; x <= CONE_W; x += 8) g.lineTo(x, mid - half(x) * scale);
    for (let x = CONE_W; x >= 0; x -= 8) g.lineTo(x, mid + half(x) * scale);
    g.closePath();
  };
  // the body: the colour, stronger toward the tip
  const body = g.createLinearGradient(0, 0, CONE_W, 0);
  body.addColorStop(0, rgba(core, 0.85));
  body.addColorStop(0.18, rgba(hue, 0.5));
  body.addColorStop(0.7, rgba(hue, 0.22));
  body.addColorStop(1, rgba(hue, 0.3));
  g.fillStyle = body;
  shape(1);
  g.fill();
  // the axis: a brighter core narrowing to the mouth
  const axis = g.createLinearGradient(0, 0, CONE_W, 0);
  axis.addColorStop(0, rgba(core, 0.9));
  axis.addColorStop(0.5, rgba(core, 0.18));
  axis.addColorStop(1, rgba(core, 0.04));
  g.fillStyle = axis;
  shape(0.35);
  g.fill();
  // soft edges: the rim of the trumpet a little brighter, as glass catches light
  g.strokeStyle = rgba(hue, 0.35);
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= CONE_W; x += 8) g.lineTo(x, mid - half(x));
  g.stroke();
  g.beginPath();
  for (let x = 0; x <= CONE_W; x += 8) g.lineTo(x, mid + half(x));
  g.stroke();
  return c;
}

/** The sprites of each centre: its cone clear and dull, its glow, its deep glow. */
export interface CentreSprites { cone: Canvas2D | null; coneDull: Canvas2D | null; glow: Canvas2D | null; deep: Canvas2D | null }

let cache: Record<CentreId, CentreSprites> | null = null;
let shared: { white: Canvas2D | null; gold: Canvas2D | null; pearl: Canvas2D | null } | null = null;

export function centreSprites(): Record<CentreId, CentreSprites> {
  if (cache) return cache;
  const out = {} as Record<CentreId, CentreSprites>;
  for (const c of CENTRES) {
    const h = HUE[c];
    out[c] = { cone: coneSprite(h.hue, h.core), coneDull: coneSprite(h.dull, mixHex(h.dull, '#ffffff', 0.35)), glow: glowSprite(h.hue, 128), deep: glowSprite(h.deep, 128) };
  }
  cache = out;
  return out;
}

export function sharedSprites(): { white: Canvas2D | null; gold: Canvas2D | null; pearl: Canvas2D | null } {
  if (!shared) shared = { white: glowSprite('#ffffff', 128), gold: glowSprite(GOLD, 128), pearl: glowSprite(PEARL, 128) };
  return shared;
}
