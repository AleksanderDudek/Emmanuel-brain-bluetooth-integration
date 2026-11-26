/**
 * Dobry bój's paint box (DESIGN.md §25, builder B): the fonts, the hall's colours (a dark hall under one warm light),
 * the five skin tones and their shades, hair, the kit's defaults, soft glow sprites drawn additively, offscreen layers
 * and small drawing helpers.  No randomness at draw time: `hash` gives the crowd and the dust their stable places.
 */

export const FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const TAU = Math.PI * 2;

/** The hall: near-black warm dark, the light's warm gold, the ink of words. */
export const C = {
  night: '#0d0a0f',
  hall: '#17111a',
  hall2: '#251a22',
  warm: '#ffd9a0',
  warmHi: '#fff1d6',
  gold: '#f5c66a',
  goldDeep: '#c98a2e',
  goldHi: '#fff1c4',
  ember: '#ff9a5a',
  ink: '#f7efe4',
  inkDim: '#cbbfb2',
  /** the incoming strike's path (soft red-gold, never blood-red) */
  threat: '#ff8a5c',
  threatHi: '#ffd27a',
  /** the player's energy */
  energy: '#ffd36e',
  energyHi: '#fff4cf',
  /** a defence that answered (cool, calm) */
  calm: '#a9d8ff',
  /** the canvas of the ring and the mat of the cage */
  canvas: '#d9cfc0',
  canvasShade: '#a99c8a',
  mat: '#3a3c46',
  matShade: '#24252d',
  rope: '#e9e2d6',
  ropeRed: '#b8423a',
  ropeBlue: '#3c5f9e',
  post: '#2a2228',
  fence: '#9aa0ac',
} as const;

/** Five skin tones, lightest to deepest: the lit tone, its shade (the side away from the light) and a warm highlight. */
/** The bases are builder A's lobby chips (content.ts SKIN_SWATCH), so the chip and the fighter match. */
export const SKINS: readonly { base: string; shade: string; hi: string; lip: string }[] = [
  { base: '#f4d3c0', shade: '#d4a88e', hi: '#fff1e6', lip: '#c98a7f' },
  { base: '#e3b08e', shade: '#bf8866', hi: '#f8dcc0', lip: '#b77462' },
  { base: '#c68a5e', shade: '#9c6642', hi: '#e6b88c', lip: '#94574a' },
  { base: '#8d5a3a', shade: '#6a3e27', hi: '#b98058', lip: '#6c3a2e' },
  { base: '#5a3a26', shade: '#3f2619', hi: '#835a40', lip: '#45271e' },
];

/** Hair colour for a skin tone and a hair style (stable: the same look draws the same hair). */
export function hairColour(skin: number, hair: number): string {
  const sets = [
    ['#6b4a2c', '#a8784a', '#3d2818', '#5a3c24'],
    ['#4a3020', '#6b4a2c', '#2e1d12', '#4a3020'],
    ['#2c1c12', '#3d2818', '#1f140c', '#2c1c12'],
    ['#1d130c', '#24170e', '#15100b', '#1d130c'],
    ['#140e0a', '#1a120c', '#100b08', '#140e0a'],
  ];
  const s = sets[clampInt(skin, 0, 4)];
  return s[clampInt(hair, 0, 3)];
}

export const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));
export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const smooth = (k: number): number => { const x = clamp01(k); return x * x * (3 - 2 * x); };
export const easeOut = (k: number): number => { const x = clamp01(k); return 1 - (1 - x) * (1 - x); };
export const easeIn = (k: number): number => { const x = clamp01(k); return x * x; };

/** A stable pseudo-random 0..1 for an integer. */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const hexRGB = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1, 7), 16);
  return Number.isFinite(v) ? [(v >> 16) & 255, (v >> 8) & 255, v & 255] : [128, 128, 128];
};

/** Whether a string is a "#rrggbb" colour (the look's kit colours come from saved progress). */
export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);

/** "#rrggbb" with an alpha as "rgba(…)". */
export const rgba = (hex: string, a: number): string => {
  const [r, g, b] = hexRGB(hex);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
};

/** Mix two hex colours (k 0..1) as "#rrggbb". */
export function mixHex(a: string, b: string, k: number): string {
  const p = hexRGB(a), q = hexRGB(b);
  const c = (i: number) => Math.round(p[i] + (q[i] - p[i]) * clamp01(k)).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** A colour lit by the hall's warm light (k 0..1 toward a warm highlight) or put into shade (negative k toward the dark). */
export function lit(hex: string, k: number): string {
  return k >= 0 ? mixHex(hex, '#fff0d8', k) : mixHex(hex, '#120c10', -k);
}

/** A CSS font. */
export const font = (weight: number, px: number, family = FONT): string => `${weight} ${Math.round(px * 10) / 10}px ${family}`;

export type Layer = HTMLCanvasElement | OffscreenCanvas;

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
  g.addColorStop(0.25, rgba(hex, 0.55));
  g.addColorStop(0.6, rgba(hex, 0.16));
  g.addColorStop(1, rgba(hex, 0));
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 64);
  glowCache.set(hex, L.c);
  return L.c;
}

/** A glow of radius r at (x, y), alpha a (call inside a 'lighter' composite for light). */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  if (!(r > 0) || !(a > 0)) return;
  const s = glowSprite(hex);
  ctx.globalAlpha = clamp01(a);
  if (s) ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = rgba(hex, 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, TAU);
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

/** Wrap `text` into lines no wider than `maxW` with the current font (at most `max` lines; the last cut with "…"). */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, max = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const tryL = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(tryL).width <= maxW || !line) line = tryL;
    else {
      out.push(line);
      line = words[i];
      if (out.length === max - 1) {
        line = words.slice(i).join(' ');
        break;
      }
    }
  }
  if (line) out.push(line);
  if (out.length > max) out.length = max;
  const last = out.length - 1;
  if (last >= 0 && ctx.measureText(out[last]).width > maxW) {
    let s = out[last];
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    out[last] = `${s.trimEnd()}…`;
  }
  return out;
}
