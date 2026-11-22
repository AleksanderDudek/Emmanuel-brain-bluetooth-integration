/**
 * Światło w dłoniach's palette and small drawing helpers: a deep umber night, warm hands with the series' rim of light,
 * a golden-white ball, ivory incense.  Light is light: additive glows from small baked sprites (never shadowBlur or a
 * filter per frame); the night is baked once per size.
 */
import { MIN_TEXT } from '../kit/mobile';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
/** the night: the edges, the middle, the warm heart of it */
export const NIGHT = ['#090504', '#170e08', '#2a190d'] as const;
/** the hands: their skin in the dark, and the rim of light */
export const SKIN = ['#2e1c10', '#4a2e1a', '#6b4427'] as const;
export const RIM = '#ffd9a0';
export const RIM_HI = '#fff3da';
/** the ball, from its white heart to its amber edge */
export const BALL = ['#fffdf6', '#fff0c6', '#ffd27a', '#f0a24a'] as const;
export const GOLD = '#ffd27a';
export const IVORY = '#fff4e2';
export const MUTED = '#d9c3a5';
export const SMOKE = '#f6e7cf';
/** the rest's tone (calm, not gold) */
export const REST = '#e4d2ff';
export const SILVER = '#d6d0c8';
export const INK = 'rgba(14,8,4,.82)';
export const TAU = Math.PI * 2;

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

/** Wrap `text` at the largest size from `px` down to `min` that fits `maxLines` in `maxW`; sets ctx.font. */
export function fitWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, px: number, min: number, weight = 600, serif = false, italic = false): { lines: string[]; px: number } {
  let size = fontPx(px);
  for (;;) {
    ctx.font = font(size, weight, serif, italic);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines || size <= min) return { lines, px: size };
    size = Math.max(min, size - 0.5);
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

const prefixes = new Map<string, string>();
export function rgbaPrefix(hex: string): string {
  let p = prefixes.get(hex);
  if (!p) {
    const v = parseInt(hex.slice(1), 16);
    p = `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},`;
    prefixes.set(hex, p);
  }
  return p;
}
export const rgba = (hex: string, a: number): string => `${rgbaPrefix(hex)}${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** Mix two hex colours (k 0 → a, 1 → b). */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * Math.max(0, Math.min(1, k)));
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

export type Layer = HTMLCanvasElement;

/** An offscreen canvas (null where there is none: tests). */
export function layer(w: number, h: number, dpr: number): { c: Layer; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

const sprites = new Map<string, Layer | null>();
/** A soft round glow of one colour, baked once (64 px), drawn scaled with 'lighter'. */
export function glowSprite(hex: string): Layer | null {
  if (sprites.has(hex)) return sprites.get(hex)!;
  const l = layer(64, 64, 1);
  if (l) {
    const g = l.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(hex, 1));
    g.addColorStop(0.25, rgba(hex, 0.55));
    g.addColorStop(0.6, rgba(hex, 0.14));
    g.addColorStop(1, rgba(hex, 0));
    l.ctx.fillStyle = g;
    l.ctx.fillRect(0, 0, 64, 64);
  }
  sprites.set(hex, l?.c ?? null);
  return l?.c ?? null;
}

/** An additive glow of radius r (px) and strength a. */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  if (a <= 0.003 || r <= 0.5) return;
  const s = glowSprite(hex);
  if (!s) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
}

/** A stable pseudo-random 0..1 for an integer. */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** The night: a deep umber, warmer at (cx, cy), darker at the edges, a faint grain of warm dust. */
export function bakeNight(w: number, h: number, dpr: number, cx: number, cy: number): Layer | null {
  const l = layer(w, h, dpr);
  if (!l) return null;
  const { ctx } = l;
  ctx.fillStyle = NIGHT[0];
  ctx.fillRect(0, 0, w, h);
  const R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, NIGHT[2]);
  g.addColorStop(0.45, NIGHT[1]);
  g.addColorStop(1, NIGHT[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // a breath of warmth from above, where prayers go
  const top = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, Math.max(w, h) * 0.55);
  top.addColorStop(0, 'rgba(255,214,150,0.07)');
  top.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);
  const n = Math.round((w * h) / 2600);
  for (let i = 0; i < n; i++) {
    const x = hash(i * 3 + 1) * w, y = hash(i * 3 + 2) * h, a = 0.03 + hash(i * 3 + 3) * 0.07;
    ctx.fillStyle = `rgba(255,226,180,${a.toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return l.c;
}

/** A warm tint for a name (the ball takes its colour): a hue between peach and pale gold, stable for the name. */
export function tintOf(name: string): string {
  let hsh = 7;
  for (const ch of name) hsh = (Math.imul(hsh, 31) + ch.charCodeAt(0)) | 0;
  const k = hash(hsh);
  const TINTS = ['#ffd27a', '#ffc79a', '#ffe08a', '#ffb98a', '#ffe6b0', '#f8cf9e'];
  return TINTS[Math.floor(k * TINTS.length) % TINTS.length];
}

/**
 * Incense rising from (x, y0) to y1: three thin strands that curl wider as they rise and fade toward the top (smooth:
 * many short segments), drawn with 'lighter'.  `amp` the widest curl (px), `a` the strength.
 */
export function incense(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, t: number, amp: number, a: number, still = false): void {
  if (a <= 0.01 || y0 - y1 < 4) return;
  const n = 56;
  const H = y0 - y1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let s = 0; s < 3; s++) {
    const ph = s * 2.1 + (still ? 0 : t * (0.5 + 0.12 * s));
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, rgba(SMOKE, 0.28 * a));
    g.addColorStop(0.6, rgba(SMOKE, 0.12 * a));
    g.addColorStop(1, rgba(SMOKE, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6 - s * 0.35;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const y = y0 - H * k;
      const w = amp * (0.08 + 0.92 * k) * (0.7 + 0.3 * s);
      const xx = x + Math.sin(k * 7.5 + ph) * w * 0.6 + Math.sin(k * 3.1 - ph * 0.7 + s) * w * 0.4;
      if (i) ctx.lineTo(xx, y); else ctx.moveTo(xx, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
