/**
 * Drzewo nad wodą's drawing helpers (the patterns of Rzeki's paint.ts, its own palette): the fonts with the kit's
 * floor, word wrap, colours, offscreen layers and baked glow sprites (light is additive sprites, never shadowBlur or
 * filters per frame), and the fruits of the Spirit as jewels of light, each in its own shape.
 */
import { MIN_TEXT } from '../kit/mobile';
import { FRUIT, type FruitId } from './content';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
/** the palette: the tree's gold-green light, the stream's cyan, the warm gold of growth, the pearl of words */
export const GOLD = '#ffd98a';
export const GOLD_HI = '#fff1c9';
export const LEAF = '#b6e39a';
export const TREE = '#d9f0a0';
export const WATER = '#8fe0e8';
export const PEARL = '#f4f1ea';
export const DUSK = '#c9d6ff';
export const INK = 'rgba(10,12,8,.82)';
const TAU = Math.PI * 2;

export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 600, serif = false, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

/** Fit a text into a width by shrinking from `px` toward `min` (never under MIN_TEXT); returns the size used. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = MIN_TEXT, weight = 600, serif = false, italic = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif, italic);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif, italic);
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

/** A soft round glow in a colour (64 px, baked once): drawn scaled, additively. */
export function glowSprite(hex: string): Layer | null {
  const hit = glowCache.get(hex);
  if (hit) return hit;
  const L = layer(64, 64, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  const g = L.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `${pre}1)`);
  g.addColorStop(0.2, `${pre}.6)`);
  g.addColorStop(0.5, `${pre}.2)`);
  g.addColorStop(0.78, `${pre}.06)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 64);
  glowCache.set(hex, L.c);
  return L.c;
}

/** Draw a baked glow centred at (x, y), radius r, alpha a (additive). */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a) * ga;
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

// ── the fruits as jewels ─────────────────────────────────────────

/**
 * A fruit of the Spirit drawn at (x, y) with radius r (its size when ripe), `ripe` 0..1: a blossom of its tint at
 * first (five petals), then a small green fruit, then its own colour and shape filling out — a jewel lit from
 * within with a bright rim and a highlight.  `lamp` (winter): a stronger glow, the fruit as a light on bare wood.
 */
export function drawFruit(ctx: CanvasRenderingContext2D, f: FruitId, x: number, y: number, r: number, ripe: number, lamp = false, alpha = 1): void {
  const F = FRUIT[f];
  const k = Math.max(0, Math.min(1, ripe));
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (k < 0.32) {
    // the blossom opening
    const b = k / 0.32;
    const pr = r * (0.35 + 0.45 * b);
    ctx.fillStyle = mix('#fffaf2', F.light, 0.35);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * pr * 0.55, y + Math.sin(a) * pr * 0.55, pr * 0.5, pr * 0.34, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x, y, pr * 0.22, 0, TAU);
    ctx.fill();
    glow(ctx, F.light, x, y, pr * 2.2, 0.35 * b);
    ctx.restore();
    return;
  }
  // the fruit: green and small, then its colour, full size
  const g = (k - 0.32) / 0.68;
  const s = r * (0.45 + 0.55 * g);
  const col = mix('#8fbf5a', F.color, Math.min(1, g * 1.25));
  glow(ctx, F.color, x, y + s * 0.2, s * (lamp ? 4.2 : 2.6), (lamp ? 0.7 : 0.38) * g + 0.05);
  // the stalk
  ctx.strokeStyle = 'rgba(120,90,50,.9)';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.05);
  ctx.lineTo(x + s * 0.12, y - s * 1.55);
  ctx.stroke();
  const body = ctx.createRadialGradient(x - s * 0.35, y - s * 0.3, s * 0.1, x, y, s * 1.25);
  body.addColorStop(0, mix(col, '#ffffff', 0.55));
  body.addColorStop(0.45, col);
  body.addColorStop(1, mix(col, '#1a1020', 0.45));
  ctx.fillStyle = body;
  shapePath(ctx, F.shape, x, y, s);
  ctx.fill();
  ctx.strokeStyle = `${rgbaPrefix(mix(col, '#ffffff', 0.6))}${0.55 + 0.35 * g})`;
  ctx.lineWidth = Math.max(0.8, s * 0.09);
  ctx.stroke();
  // a highlight: the light inside the jewel
  ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * g})`;
  ctx.beginPath();
  ctx.ellipse(x - s * 0.32, y - s * 0.34, s * 0.2, s * 0.12, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The outline of a fruit's shape at (x, y), size s, as the current path (grapes and cherries are several rounds). */
function shapePath(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, s: number): void {
  ctx.beginPath();
  switch (shape) {
    case 'pomegranate': {
      ctx.arc(x, y, s, 0, TAU);
      // the little crown on top
      ctx.moveTo(x - s * 0.32, y - s * 0.86);
      ctx.lineTo(x - s * 0.22, y - s * 1.18);
      ctx.lineTo(x - s * 0.06, y - s * 0.94);
      ctx.lineTo(x + s * 0.06, y - s * 1.22);
      ctx.lineTo(x + s * 0.18, y - s * 0.94);
      ctx.lineTo(x + s * 0.32, y - s * 1.16);
      ctx.lineTo(x + s * 0.36, y - s * 0.84);
      ctx.closePath();
      break;
    }
    case 'grapes': {
      const rr0 = s * 0.38;
      const at: [number, number][] = [[-0.42, -0.5], [0.0, -0.55], [0.42, -0.5], [-0.22, -0.08], [0.22, -0.08], [0, 0.34], [-0.42, 0.3], [0.42, 0.3], [0, 0.72]];
      for (const [u, v] of at) {
        ctx.moveTo(x + u * s + rr0, y + v * s);
        ctx.arc(x + u * s, y + v * s, rr0, 0, TAU);
      }
      break;
    }
    case 'olive':
      ctx.ellipse(x, y, s * 0.68, s, 0.35, 0, TAU);
      break;
    case 'fig':
      ctx.moveTo(x, y - s * 1.1);
      ctx.bezierCurveTo(x + s * 0.45, y - s * 0.7, x + s * 1.05, y + s * 0.1, x, y + s * 0.95);
      ctx.bezierCurveTo(x - s * 1.05, y + s * 0.1, x - s * 0.45, y - s * 0.7, x, y - s * 1.1);
      break;
    case 'peach':
      ctx.arc(x - s * 0.08, y + s * 0.02, s * 0.92, Math.PI * 0.55, Math.PI * 1.65);
      ctx.arc(x + s * 0.08, y + s * 0.02, s * 0.92, Math.PI * 1.35, Math.PI * 2.45);
      ctx.closePath();
      break;
    case 'pear':
      ctx.moveTo(x, y - s * 1.05);
      ctx.bezierCurveTo(x + s * 0.4, y - s * 1.05, x + s * 0.35, y - s * 0.35, x + s * 0.7, y + s * 0.1);
      ctx.bezierCurveTo(x + s * 1.1, y + s * 0.65, x + s * 0.6, y + s * 1.05, x, y + s * 1.05);
      ctx.bezierCurveTo(x - s * 0.6, y + s * 1.05, x - s * 1.1, y + s * 0.65, x - s * 0.7, y + s * 0.1);
      ctx.bezierCurveTo(x - s * 0.35, y - s * 0.35, x - s * 0.4, y - s * 1.05, x, y - s * 1.05);
      break;
    case 'date':
      ctx.ellipse(x, y + s * 0.1, s * 0.48, s * 1.08, 0, 0, TAU);
      break;
    case 'cherry':
      ctx.moveTo(x - s * 0.38 + s * 0.6, y + s * 0.35);
      ctx.arc(x - s * 0.38, y + s * 0.35, s * 0.6, 0, TAU);
      ctx.moveTo(x + s * 0.45 + s * 0.6, y + s * 0.2);
      ctx.arc(x + s * 0.45, y + s * 0.2, s * 0.6, 0, TAU);
      break;
    case 'almond':
    default:
      ctx.moveTo(x, y - s * 1.1);
      ctx.quadraticCurveTo(x + s * 1.05, y - s * 0.1, x, y + s * 1.0);
      ctx.quadraticCurveTo(x - s * 1.05, y - s * 0.1, x, y - s * 1.1);
      break;
  }
}

/** A tapered ribbon along points (a root, a branch) as one filled shape: width w0 at the start, w1 at the end. */
export function ribbon(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], w0: number, w1: number): void {
  const n = pts.length;
  if (n < 2) return;
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  // a rounded tip
  const e = pts[n - 1];
  ctx.quadraticCurveTo(e[0] + (e[0] - pts[n - 2][0]) * 0.8, e[1] + (e[1] - pts[n - 2][1]) * 0.8, R[n - 1][0], R[n - 1][1]);
  for (let i = n - 2; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}
