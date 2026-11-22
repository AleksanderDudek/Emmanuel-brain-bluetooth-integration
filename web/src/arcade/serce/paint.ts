/**
 * Z głowy do serca's paint box: the palette (night blue to warm gold, the heart's gold to rose), the fonts, small
 * baked sprites for light (a soft glow per colour), the night sky (baked per size) and the figure of light (kit/figure.ts,
 * baked per scale with its rim of light like Rzeki's — warm at the head, pearl below — and a faint translucent body).
 * Light is light: additive glows from sprites, never shadowBlur or filters per frame.
 */
import { figurePath, type ToScreen } from '../kit/figure';
import { MIN_TEXT } from '../kit/mobile';
import { HEART_Y } from './layout';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const GOLD = '#ffd98a';
export const GOLD_HI = '#fff3d6';
export const ROSE = '#ff9fb4';
export const EMBER = '#ffb36b';
export const PEARL = '#f6f0ff';
export const NIGHT = '#0b0a22';
export const INK = 'rgba(12,8,30,.78)';
const TAU = Math.PI * 2;

/** A canvas font, never under MIN_TEXT (11 px). */
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

/** The largest size from `px` down to `min` at which `text` wraps into `maxLines` lines of `maxW`; the lines and the size. */
export function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min: number, maxLines: number,
  weight = 400, serif = true, italic = true): { lines: string[]; size: number } {
  let size = Math.max(min, px);
  for (;;) {
    ctx.font = font(size, weight, serif, italic);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines || size <= min) {
      if (lines.length > maxLines) {
        const cut = lines.slice(0, maxLines);
        cut[maxLines - 1] = `${cut[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
        return { lines: cut, size };
      }
      return { lines, size };
    }
    size = Math.max(min, size - 1);
  }
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
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** A deterministic 0..1 for an integer. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── offscreen layers and sprites ─────────────────────────────────
export type Layer = HTMLCanvasElement;

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

const glowCache = new Map<string, Layer | null>();

/** A soft round glow in a colour (64 px, baked once): draw it scaled, additively. */
export function glowSprite(hex: string): Layer | null {
  if (glowCache.has(hex)) return glowCache.get(hex)!;
  const L = layer(64, 64, 1);
  if (L) {
    const pre = rgbaPrefix(hex);
    const g = L.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `${pre}1)`);
    g.addColorStop(0.18, `${pre}.6)`);
    g.addColorStop(0.45, `${pre}.2)`);
    g.addColorStop(0.75, `${pre}.05)`);
    g.addColorStop(1, `${pre}0)`);
    L.ctx.fillStyle = g;
    L.ctx.fillRect(0, 0, 64, 64);
  }
  glowCache.set(hex, L?.c ?? null);
  return L?.c ?? null;
}

/** A glow of radius r (px) at (x, y), additively, at alpha a. */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003 || r <= 0.2) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
}

/** The night sky for a canvas of w × h: deep blue above, violet near the horizon, stars (two sizes), a faint band. */
export function bakeSky(w: number, h: number, dpr: number): Layer | null {
  const L = layer(w, h, dpr);
  if (!L) return null;
  const c = L.ctx;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#070818');
  g.addColorStop(0.45, '#0d0b26');
  g.addColorStop(0.8, '#1a0f30');
  g.addColorStop(1, '#241236');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // a faint band of the galaxy, diagonal
  c.save();
  c.translate(w * 0.5, h * 0.45);
  c.rotate(-0.5);
  const band = c.createLinearGradient(0, -h * 0.25, 0, h * 0.25);
  band.addColorStop(0, 'rgba(160,140,255,0)');
  band.addColorStop(0.5, 'rgba(160,140,255,.055)');
  band.addColorStop(1, 'rgba(160,140,255,0)');
  c.fillStyle = band;
  c.fillRect(-w, -h * 0.25, 2 * w, h * 0.5);
  c.restore();
  const n = Math.round((w * h) / 2600);
  for (let i = 0; i < n; i++) {
    const x = hash(i * 3 + 1) * w, y = hash(i * 3 + 2) * h, b = hash(i * 3 + 3);
    c.fillStyle = `rgba(${b > 0.8 ? '255,236,210' : '220,226,255'},${0.18 + 0.55 * b * b})`;
    const r = b > 0.93 ? 1.3 : b > 0.7 ? 0.9 : 0.6;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
  return L.c;
}

// ── the figure ───────────────────────────────────────────────────

/** The figure in world units (the heart at the origin): kit/figure's points shifted up by the heart's height. */
export const worldMap: ToScreen = (x, y) => [x, y - HEART_Y];

let figPath: Path2D | null = null;
/** The silhouette as one Path2D in world units (drawn through the camera's transform). */
export function figureWorldPath(): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  figPath ??= figurePath(worldMap);
  return figPath;
}

export interface FigureLayer { c: Layer; s: number; x0: number; y0: number; w: number; h: number }

/**
 * The figure of light baked at `s` px per world unit: the rim (a wide soft halo, a mid glow, a crisp line warm at the
 * head and pearl below) drawn outside the union of the body, the hands and the feet, and a faint translucent body.
 * No face: anyone can stand in it.  Drawn scaled; re-baked when the camera's scale moves far from it.
 */
export function bakeFigure(s: number, dpr: number): FigureLayer | null {
  const x0 = -0.27, y0 = -HEART_Y - 0.05, w = 0.54, h = 1.1;
  const L = layer(w * s, h * s, dpr);
  if (!L) return null;
  const c = L.ctx;
  const map: ToScreen = (x, y) => [(x - x0) * s, (y - HEART_Y - y0) * s];
  const sil = figurePath(map);
  const [, top] = map(0, 0), [, bot] = map(0, 1);
  const rim = c.createLinearGradient(0, top, 0, bot);
  rim.addColorStop(0, 'rgba(255,226,170,.95)');
  rim.addColorStop(0.3, 'rgba(255,232,220,.8)');
  rim.addColorStop(0.7, 'rgba(226,214,255,.6)');
  rim.addColorStop(1, 'rgba(210,214,255,.55)');
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(255,200,170,.08)';
  c.lineWidth = Math.max(5, s * 0.03);
  c.stroke(sil);
  c.strokeStyle = 'rgba(255,226,210,.18)';
  c.lineWidth = Math.max(2.5, s * 0.012);
  c.stroke(sil);
  c.strokeStyle = rim;
  c.lineWidth = Math.max(1.2, s * 0.0055);
  c.stroke(sil);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.fill(sil);
  c.globalCompositeOperation = 'source-over';
  const body = c.createLinearGradient(0, top, 0, bot);
  body.addColorStop(0, 'rgba(236,222,255,.12)');
  body.addColorStop(0.4, 'rgba(206,196,250,.1)');
  body.addColorStop(1, 'rgba(150,150,230,.08)');
  c.fillStyle = body;
  c.fill(sil);
  return { c: L.c, s, x0, y0, w, h };
}
