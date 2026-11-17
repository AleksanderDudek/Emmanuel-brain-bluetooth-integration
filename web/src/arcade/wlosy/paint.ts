/**
 * Każdy włos's painting kit (DESIGN.md §15): a luminous medical illustration drawn with canvas paths and gradients,
 * no images — a deep plum ground, tissues that glow from within, warm light for blood, gold for growth, aqua for
 * stem cells.  Light is light: additive glows from small baked sprites, never shadowBlur or filters per frame; the
 * ground and each picture's still parts are baked once per size into offscreen layers, so a frame only composes them
 * and draws what grows.
 */
import { MIN_TEXT } from '../kit/mobile';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const GOLD = '#ffd98a';
export const GOLD_HI = '#fff1c9';
export const PEARL = '#f6f0ff';
export const LILAC = '#d2c6ff';
export const BLOOD = '#ff5470';
export const BLOOD_HI = '#ffa48c';
export const ROSE = '#ff9cbc';
export const VIOLET = '#c59bff';
export const AQUA = '#9fe9ff';
export const HONEY = '#ffcf7a';
export const SKIN = '#f3b09a';
export const INK = 'rgba(12,6,26,.82)';
export const TAU = Math.PI * 2;

/** A canvas font, never under MIN_TEXT (11 px); text the player must read asks for 13 px and more itself. */
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

export function rr(ctx: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  if (ctx instanceof Path2D) {
    ctx.moveTo(x + k, y);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + k, y);
  }
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
export const rgba = (hex: string, a: number): string => `${rgbaPrefix(hex)}${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** Mix two "#rrggbb" colours (k = 0 → a, 1 → b) into "#rrggbb". */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
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
  g.addColorStop(0.2, `${pre}.62)`);
  g.addColorStop(0.5, `${pre}.2)`);
  g.addColorStop(0.78, `${pre}.06)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 64);
  glowCache.set(hex, L.c);
  return L.c;
}

/** Draw a baked glow centred at (x, y) with radius r and alpha a (additive). */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003 || r <= 0.01) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a * ga);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

/** A soft glow stretched into an ellipse (rx, ry), turned by `rot` (additive). */
export function glowEllipse(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, rx: number, ry: number, rot: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a * ga);
  ctx.drawImage(s, -rx, -ry, 2 * rx, 2 * ry);
  ctx.restore();
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

let starC: Layer | null | undefined;

/** A small four-pointed glint (32 px): a sparkle of growth. */
export function starSprite(): Layer | null {
  if (starC !== undefined) return starC;
  const L = layer(32, 32, 1);
  starC = L ? L.c : null;
  if (!L) return null;
  const c = L.ctx;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.14, 'rgba(255,246,220,.8)');
  g.addColorStop(0.38, 'rgba(255,220,160,.16)');
  g.addColorStop(1, 'rgba(255,220,160,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  for (const [w, h] of [[32, 1.6], [1.6, 32]]) {
    const lg = w > h ? c.createLinearGradient(0, 16, 32, 16) : c.createLinearGradient(16, 0, 16, 32);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,250,236,.8)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lg;
    c.fillRect(16 - w / 2, 16 - h / 2, w, h);
  }
  return starC;
}

// ── the ground ───────────────────────────────────────────────────
/** A deterministic 0..1 for a number. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The ground, baked per size: a deep plum to indigo, soft warm and violet clouds of light gathered where the picture
 * stands, a few far motes like dust in a beam, and a vignette — a quiet stage for a luminous anatomy plate.
 */
export function bakeGround(w: number, h: number, dpr: number, focus: { x: number; y: number; r: number }): Layer | null {
  const L = layer(w, h, dpr);
  if (!L) return null;
  const c = L.ctx;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d0719');
  g.addColorStop(0.35, '#1a0d2c');
  g.addColorStop(0.7, '#1d0f2e');
  g.addColorStop(1, '#0c0716');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const big = Math.max(w, h);
  c.globalCompositeOperation = 'lighter';
  const clouds = ['#7b3f8f', '#4a2f8f', '#a04a72', '#5a3aa0', '#8a4a6a', '#3c2f7a'];
  for (let i = 0; i < 14; i++) {
    const near = i < 8;
    const x = near ? focus.x + (hash(i * 3 + 1) - 0.5) * focus.r * 2.4 : hash(i * 3 + 1) * w;
    const y = near ? focus.y + (hash(i * 5 + 2) - 0.5) * focus.r * 2 : hash(i * 5 + 2) * h;
    const r = big * (0.12 + 0.22 * hash(i * 7 + 3));
    const a = 0.035 + 0.05 * hash(i * 11 + 4);
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    const pre = rgbaPrefix(clouds[i % clouds.length]);
    rg.addColorStop(0, `${pre}${a.toFixed(3)})`);
    rg.addColorStop(0.5, `${pre}${(a * 0.4).toFixed(3)})`);
    rg.addColorStop(1, `${pre}0)`);
    c.fillStyle = rg;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // the quiet warmth behind the picture
  const halo = c.createRadialGradient(focus.x, focus.y, 0, focus.x, focus.y, focus.r * 1.3);
  halo.addColorStop(0, 'rgba(255,170,150,.08)');
  halo.addColorStop(0.5, 'rgba(190,120,220,.05)');
  halo.addColorStop(1, 'rgba(120,80,200,0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  // far motes
  const n = Math.round((w * h) / 2600);
  for (let i = 0; i < n; i++) {
    const x = hash(i * 3 + 101) * w, y = hash(i * 7 + 202) * h, s = 0.3 + hash(i * 11 + 303) ** 3 * 1.2;
    c.fillStyle = `rgba(${236 + Math.round(19 * hash(i + 9))},${214 + Math.round(30 * hash(i + 19))},255,${(0.1 + 0.4 * hash(i * 13 + 404)).toFixed(2)})`;
    c.beginPath();
    c.arc(x, y, s, 0, TAU);
    c.fill();
  }
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, big * 0.75);
  v.addColorStop(0, 'rgba(4,2,10,0)');
  v.addColorStop(1, 'rgba(4,2,10,.55)');
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  return L.c;
}

/** The lens's outline: a rounded rectangle (the tissue pictures are seen through it, as on a plate). */
export function lensPath(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  rr(p, x, y, w, h, r);
  return p;
}

/** The lens's own ground behind a tissue (the air above the skin reads as a deep indigo). */
export function lensGround(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#120a24');
  g.addColorStop(1, '#22102c');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** Depth inside the lens: its edges sink into shadow, its middle stays lit. */
export function lensShade(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 1): void {
  const cx = x + w / 2, cy = y + h / 2, r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
  g.addColorStop(0, 'rgba(8,3,18,0)');
  g.addColorStop(1, `rgba(8,3,18,${(0.55 * a).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** The lens's rim: a soft outer glow and a thin line of warm light. */
export function drawLensRim(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, a = 1): void {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  rr(ctx, x - 1.5, y - 1.5, w + 3, h + 3, r + 1.5);
  ctx.strokeStyle = 'rgba(255,214,190,.13)';
  ctx.lineWidth = 5;
  ctx.stroke();
  rr(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,226,190,.7)');
  g.addColorStop(0.5, 'rgba(236,206,255,.45)');
  g.addColorStop(1, 'rgba(255,200,190,.6)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Text with a soft dark edge so it reads on any ground. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color = PEARL, align: CanvasTextAlign = 'center', weight = 700, serif = false, italic = false): void {
  ctx.font = font(px, weight, serif, italic);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, px * 0.28);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** A smooth path through points (quadratic curves through the midpoints). */
export function smoothPath(p: Path2D | CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], move = true): void {
  if (pts.length < 2) return;
  if (move) p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  p.lineTo(last[0], last[1]);
}

/** A polyline's length and a point at a share of it (0..1). */
export function polyLen(pts: readonly (readonly [number, number])[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}
export function polyAt(pts: readonly (readonly [number, number])[], k: number): [number, number] {
  const total = polyLen(pts);
  let want = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= d || i === pts.length - 1) {
      const f = d > 0 ? Math.min(1, want / d) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    want -= d;
  }
  return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
}
