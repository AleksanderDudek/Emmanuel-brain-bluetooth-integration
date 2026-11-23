/**
 * Każda myśl's drawing helpers (the patterns of Drzewo's paint.ts, its own palette): the fonts with the kit's floor,
 * word wrap, colours, offscreen layers and baked glow sprites (light is additive sprites, never shadowBlur or filters
 * per frame), the point of light — a candle's flame drawn in code — and a thought's slip of ash-paper, baked once
 * with its words, tinted by its emotions.
 */
import { MIN_TEXT } from '../kit/mobile';
import { blend, type Mix } from './content';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
/** the palette: the flame's gold, its warm ring, the golden lights, the night, the pearl of words */
export const GOLD = '#ffd27a';
export const GOLD_HI = '#fff1c9';
export const EMBER = '#ff9a3c';
export const WARM = '#ffb35c';
export const PEARL = '#f4f0e8';
export const CALM = '#a9d8ff';
export const NIGHT = '#0b0810';
export const INK = 'rgba(10,8,12,.82)';
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

/** Greedy word wrap with the context's current font (a word longer than the line is broken by characters). */
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
    // a single word wider than the line (a long own word): break it
    while (ctx.measureText(line).width > maxW && [...line].length > 1) {
      const chars = [...line];
      let k = chars.length - 1;
      while (k > 1 && ctx.measureText(chars.slice(0, k).join('')).width > maxW) k--;
      out.push(chars.slice(0, k).join(''));
      line = chars.slice(k).join('');
    }
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
  if (glowCache.size > 40) glowCache.clear();
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

// ── the point of light ───────────────────────────────────────────

/**
 * The flame at (x, y) — the point the eyes rest on is its bright core at (x, y) — `s` its height's unit (the flame
 * is about 2.2 s tall), `k` its strength 0..1 (the light of focus), `t` the time for its quiet flicker (none with
 * reduced motion).  A teardrop of warm gold round a white core, a faint blue root, a halo.
 */
export function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k: number, t: number, still = false): void {
  const kk = Math.max(0, Math.min(1, k));
  const fl = still ? 0 : 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 11.1 + 1.3) + 0.03 * Math.sin(t * 3.1);
  const sway = still ? 0 : 0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 5.7 + 0.7);
  const hgt = s * (2 + 0.45 * kk) * (1 + fl);
  const wid = s * (0.62 + 0.12 * kk);
  // the halo: a wide warm glow, a nearer gold one
  glow(ctx, WARM, x, y - s * 0.3, s * (5 + 4 * kk), 0.22 + 0.25 * kk);
  glow(ctx, GOLD, x, y - s * 0.4, s * (2.4 + 1.2 * kk), 0.45 + 0.3 * kk);
  const tipX = x + sway * s * 2, tipY = y - hgt * 0.78;
  const base = y + hgt * 0.22;
  const outline = (w: number, top: number, bot: number) => {
    ctx.beginPath();
    ctx.moveTo(tipX + (x - tipX) * (1 - top), y - hgt * 0.78 * top);
    ctx.bezierCurveTo(x + w * 1.05, y - hgt * 0.25 * top, x + w * 0.95, y + (base - y) * bot, x, y + (base - y) * bot);
    ctx.bezierCurveTo(x - w * 0.95, y + (base - y) * bot, x - w * 1.05, y - hgt * 0.25 * top, tipX + (x - tipX) * (1 - top), y - hgt * 0.78 * top);
    ctx.closePath();
  };
  // the outer flame: orange at its rim, gold within
  const g = ctx.createLinearGradient(x, tipY, x, base);
  g.addColorStop(0, 'rgba(255,150,60,0)');
  g.addColorStop(0.25, `rgba(255,160,70,${0.65 + 0.25 * kk})`);
  g.addColorStop(0.7, `rgba(255,205,120,${0.9})`);
  g.addColorStop(1, 'rgba(255,190,110,.55)');
  ctx.fillStyle = g;
  outline(wid, 1, 1);
  ctx.fill();
  // the inner flame: pale gold to white
  const g2 = ctx.createLinearGradient(x, y - hgt * 0.55, x, base);
  g2.addColorStop(0, 'rgba(255,240,200,0)');
  g2.addColorStop(0.35, 'rgba(255,244,214,.9)');
  g2.addColorStop(1, 'rgba(255,255,250,.95)');
  ctx.fillStyle = g2;
  outline(wid * 0.55, 0.72, 0.8);
  ctx.fill();
  // the faint blue root of a candle's flame
  ctx.fillStyle = 'rgba(120,170,255,.35)';
  ctx.beginPath();
  ctx.ellipse(x, base - s * 0.12, wid * 0.42, s * 0.16, 0, 0, TAU);
  ctx.fill();
  // the point itself: where the eyes rest
  glow(ctx, '#ffffff', x, y, s * (0.9 + 0.4 * kk), 0.75);
  ctx.fillStyle = '#fffdf6';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.2, s * 0.13), 0, TAU);
  ctx.fill();
}

// ── a thought's slip ─────────────────────────────────────────────

export interface Slip {
  c: Layer;
  /** its size (CSS px) */
  w: number;
  h: number;
  /** the text's size and lines, as drawn */
  size: number;
  lines: string[];
}

/** The lines of a thought at a size, and the slip's height for them. */
export function slipText(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, min: number): { size: number; lines: string[]; h: number; pad: number } {
  const pad = Math.max(10, Math.round(px * 0.75));
  let size = Math.max(min, px), lines: string[] = [];
  // shrink toward `min` until it fits three lines; never cut: at the least size it takes as many lines as it needs
  for (; size >= min; size -= 0.5) {
    ctx.font = font(size, 500, true, true);
    lines = wrap(ctx, text, w - 2 * pad);
    if (lines.length <= 3) break;
  }
  size = Math.max(min, size);
  ctx.font = font(size, 500, true, true);
  lines = wrap(ctx, text, w - 2 * pad);
  const lh = Math.round(size * 1.3);
  return { size, lines, h: lines.length * lh + 2 * pad, pad };
}

/**
 * A thought's slip baked once: ash-paper tinted by its emotions (the blend of their colours, a darker stain at the
 * edges), torn edges, the words in a dark ink serif.  `w` its width (CSS px), `px`/`min` the text's size and floor.
 */
export function bakeSlip(text: string, m: Mix, w: number, px: number, min: number, dpr: number, seed: number): Slip | null {
  const probe = layer(4, 4, 1);
  if (!probe) return null;
  const tx = slipText(probe.ctx, text, w, px, min);
  const h = tx.h;
  const L = layer(w + 8, h + 8, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  ctx.translate(4, 4);
  const tint = blend(m);
  const ink = blend(m, 'ink');
  // the torn outline
  ctx.beginPath();
  const n = 22;
  const jag = (i: number, k: number) => (hash(seed * 31 + i * 7 + k) - 0.5) * 3.2;
  ctx.moveTo(0, 0);
  for (let i = 1; i <= n; i++) ctx.lineTo((w * i) / n, jag(i, 1));
  for (let i = 1; i <= 6; i++) ctx.lineTo(w + jag(i, 2), (h * i) / 6);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo((w * i) / n, h + jag(i, 3));
  for (let i = 5; i >= 1; i--) ctx.lineTo(jag(i, 4), (h * i) / 6);
  ctx.closePath();
  const paper = ctx.createLinearGradient(0, 0, w, h);
  paper.addColorStop(0, mix('#e9e1d2', tint, 0.22));
  paper.addColorStop(0.55, mix('#ddd3c0', tint, 0.3));
  paper.addColorStop(1, mix('#c9bea9', tint, 0.38));
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // a darker stain toward the edges, the emotion's own
  const stain = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
  stain.addColorStop(0, 'rgba(0,0,0,0)');
  stain.addColorStop(1, `${rgbaPrefix(ink)}.35)`);
  ctx.fillStyle = stain;
  ctx.fillRect(0, 0, w, h);
  // the paper's fibres
  ctx.strokeStyle = 'rgba(90,70,50,.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const y = hash(seed + i * 13) * h, x = hash(seed + i * 17) * w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + 30 * hash(seed + i), y + 2 * (hash(seed + i * 3) - 0.5));
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = `${rgbaPrefix(ink)}.45)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  // the words
  ctx.fillStyle = mix('#241c18', ink, 0.35);
  ctx.font = font(tx.size, 500, true, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = Math.round(tx.size * 1.3);
  let y = tx.pad + lh / 2;
  for (const line of tx.lines) {
    ctx.fillText(line, w / 2, y);
    y += lh;
  }
  return { c: L.c, w, h, size: tx.size, lines: tx.lines };
}
