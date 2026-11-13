/**
 * Rzeki żywej wody's pictures, drawn with canvas paths and gradients (no images): a deep cosmic space of
 * indigo and violet with soft nebulae and stars, an open heaven with rays, a figure of soft light with a warm
 * rim from above, an egg of light around it, a pool of living water at its feet, and the rose windows of
 * church glass that bloom at the seven places.  Light is light: additive glows from small baked sprites, never
 * shadowBlur or filters per frame; the sky, the rays, the figure, the aura and every rose window are baked
 * once per size into offscreen layers, so a frame only composes them.
 */
import { MIN_TEXT } from '../kit/mobile';
import { PLACE, PLACES, type PlaceId } from './content';
import { outlinePath, type ToScreen } from './figure';
import { RING, pieces } from './rose';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const GOLD = '#ffd98a';
export const GOLD_HI = '#fff1c9';
export const SILVER = '#dfe8ff';
export const WATER = '#9fe6ff';
export const PEARL = '#f6f2ff';
export const LILAC = '#c9c2ff';
export const INK = 'rgba(8,6,26,.8)';
const TAU = Math.PI * 2;

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

/** Mix two "#rrggbb" colours (k = 0 → a, 1 → b) into "#rrggbb". */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
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
  if (!s || a <= 0.003 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

const bloomCache = new Map<string, Layer>();

/** A wide, soft bloom in a colour (128 px, baked once): the light of lit glass spilling onto what is around it. */
export function bloomSprite(hex: string): Layer | null {
  const hit = bloomCache.get(hex);
  if (hit) return hit;
  const L = layer(128, 128, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  const g = L.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `${pre}.9)`);
  g.addColorStop(0.14, `${pre}.62)`);
  g.addColorStop(0.32, `${pre}.3)`);
  g.addColorStop(0.56, `${pre}.11)`);
  g.addColorStop(0.8, `${pre}.03)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 128, 128);
  bloomCache.set(hex, L.c);
  return L.c;
}

/** Draw a baked bloom centred at (x, y), radius r, alpha a (additive). */
export function bloom(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = bloomSprite(hex);
  if (!s || a <= 0.003 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

const columnCache = new Map<string, Layer>();

/** A vertical beam (64 × 4 px): transparent at its sides, a bright core in the middle — drawn stretched. */
export function columnSprite(hex: string): Layer | null {
  const hit = columnCache.get(hex);
  if (hit) return hit;
  const L = layer(64, 4, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  const g = L.ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, `${pre}0)`);
  g.addColorStop(0.3, `${pre}.12)`);
  g.addColorStop(0.44, `${pre}.55)`);
  g.addColorStop(0.5, `${pre}1)`);
  g.addColorStop(0.56, `${pre}.55)`);
  g.addColorStop(0.7, `${pre}.12)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 64, 4);
  columnCache.set(hex, L.c);
  return L.c;
}

let starSpriteC: Layer | null | undefined;

/** A star with a soft four-pointed glint (32 px). */
export function starSprite(): Layer | null {
  if (starSpriteC !== undefined) return starSpriteC;
  const L = layer(32, 32, 1);
  starSpriteC = L ? L.c : null;
  if (!L) return null;
  const c = L.ctx;
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(240,236,255,.8)');
  g.addColorStop(0.35, 'rgba(200,200,255,.16)');
  g.addColorStop(1, 'rgba(200,200,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  for (const [w, h] of [[32, 1.6], [1.6, 32]]) {
    const lg = w > h ? c.createLinearGradient(0, 16, 32, 16) : c.createLinearGradient(16, 0, 16, 32);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,.75)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lg;
    c.fillRect(16 - w / 2, 16 - h / 2, w, h);
  }
  return starSpriteC;
}

// ── the sky ──────────────────────────────────────────────────────
export interface SkyFocus { cx: number; heavenY: number; midY: number; H: number }

const NEBULA = ['#6c4fd0', '#3b47b8', '#a65aa8', '#2b86ad', '#4c64d8', '#7a52c4', '#c56a9c'] as const;

/**
 * Deep space, baked per size: a gradient from near-black indigo through violet, nebulae as soft coloured
 * clouds added with light, a few darker lanes for depth, a warm glow where the heaven opens, a quiet halo
 * behind the figure, stars (a few with glints), and a vignette.
 */
export function bakeSky(w: number, h: number, dpr: number, f: SkyFocus): Layer | null {
  const L = layer(w, h, dpr);
  if (!L) return null;
  const c = L.ctx;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#07051c');
  g.addColorStop(0.32, '#120b35');
  g.addColorStop(0.62, '#1a1242');
  g.addColorStop(1, '#090c25');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const big = Math.max(w, h);
  // nebulae: soft clouds that gather around the figure, more of them in a band across it
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) {
    const near = i < 12;
    const x = near ? f.cx + (hash(i * 3 + 1) - 0.5) * Math.min(w, f.H * 1.6) : hash(i * 3 + 1) * w;
    const y = near ? f.midY + (hash(i * 5 + 2) - 0.5) * f.H * 1.2 : hash(i * 5 + 2) * h;
    const r = big * (0.12 + 0.26 * hash(i * 7 + 3));
    const hex = NEBULA[i % NEBULA.length];
    const a = 0.035 + 0.06 * hash(i * 11 + 4);
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    const pre = rgbaPrefix(hex);
    rg.addColorStop(0, `${pre}${a.toFixed(3)})`);
    rg.addColorStop(0.5, `${pre}${(a * 0.45).toFixed(3)})`);
    rg.addColorStop(1, `${pre}0)`);
    c.fillStyle = rg;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  c.globalCompositeOperation = 'source-over';
  // a few darker lanes of dust, for depth
  for (let i = 0; i < 5; i++) {
    const x = hash(i * 13 + 7) * w, y = hash(i * 17 + 8) * h, r = big * (0.08 + 0.12 * hash(i * 19 + 9));
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(4,3,14,.35)');
    rg.addColorStop(1, 'rgba(4,3,14,0)');
    c.fillStyle = rg;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // the quiet halo behind the figure, and the warm opening of heaven above it
  c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(f.cx, f.midY, 0, f.cx, f.midY, f.H * 0.75);
  halo.addColorStop(0, 'rgba(150,130,255,.16)');
  halo.addColorStop(0.55, 'rgba(110,90,220,.06)');
  halo.addColorStop(1, 'rgba(90,70,200,0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, w, h);
  const hr = Math.max(f.H * 0.42, 60);
  const heaven = c.createRadialGradient(f.cx, f.heavenY, 0, f.cx, f.heavenY, hr);
  heaven.addColorStop(0, 'rgba(255,246,220,.42)');
  heaven.addColorStop(0.25, 'rgba(255,226,170,.16)');
  heaven.addColorStop(0.6, 'rgba(200,170,255,.06)');
  heaven.addColorStop(1, 'rgba(160,140,255,0)');
  c.fillStyle = heaven;
  c.fillRect(f.cx - hr, f.heavenY - hr, 2 * hr, 2 * hr);
  c.globalCompositeOperation = 'source-over';
  // stars
  const n = Math.round((w * h) / 1500);
  for (let i = 0; i < n; i++) {
    const x = hash(i * 3 + 101) * w, y = hash(i * 7 + 202) * h, s = 0.3 + hash(i * 11 + 303) ** 3 * 1.3;
    c.fillStyle = `rgba(${225 + Math.round(30 * hash(i + 9))},${228 + Math.round(20 * hash(i + 19))},255,${(0.18 + 0.6 * hash(i * 13 + 404)).toFixed(2)})`;
    c.beginPath();
    c.arc(x, y, s, 0, TAU);
    c.fill();
  }
  const st = starSprite();
  if (st) {
    for (let i = 0; i < Math.max(3, Math.round((w * h) / 60000)); i++) {
      const x = hash(i * 31 + 505) * w, y = hash(i * 37 + 606) * h, r = 5 + 7 * hash(i * 41 + 707);
      c.globalAlpha = 0.35 + 0.4 * hash(i * 43 + 808);
      c.drawImage(st, x - r, y - r, 2 * r, 2 * r);
    }
    c.globalAlpha = 1;
  }
  // a vignette
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, big * 0.75);
  v.addColorStop(0, 'rgba(2,1,10,0)');
  v.addColorStop(1, 'rgba(2,1,10,.5)');
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  return L.c;
}

/**
 * The rays from the open heaven (baked per size): soft beams fanning down from above the top edge to the
 * crown, warm white at their source, gone before they reach the head.  `x0..x0+w`, `0..h` on the canvas.
 */
export function bakeRays(w: number, h: number, dpr: number, cx: number): Layer | null {
  const L = layer(w, h, dpr);
  if (!L) return null;
  const c = L.ctx;
  c.globalCompositeOperation = 'lighter';
  const apexY = -h * 0.35;
  const n = 13;
  for (let i = 0; i < n; i++) {
    const k = (i / (n - 1)) * 2 - 1;
    const spread = w * 0.42;
    const bx = cx + k * spread * (0.6 + 0.4 * hash(i + 3));
    const bw = w * (0.025 + 0.05 * hash(i * 7 + 1));
    const g = c.createLinearGradient(0, 0, 0, h);
    const a = 0.12 + 0.16 * hash(i * 5 + 2) * (1 - 0.5 * Math.abs(k));
    g.addColorStop(0, `rgba(255,244,214,${a.toFixed(3)})`);
    g.addColorStop(0.55, `rgba(255,230,190,${(a * 0.45).toFixed(3)})`);
    g.addColorStop(1, 'rgba(230,210,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx + k * w * 0.04, apexY);
    c.lineTo(bx - bw, h);
    c.lineTo(bx + bw, h);
    c.closePath();
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  return L.c;
}

// ── the figure ───────────────────────────────────────────────────
export interface FigureBox { cx: number; top: number; H: number }

/** Screen coordinates for figure units inside a layer whose origin is at (ox, oy). */
export const mapper = (f: FigureBox, ox = 0, oy = 0): ToScreen => (x, y) => [f.cx - ox + x * f.H, f.top - oy + y * f.H];

export interface FigureLayer { box: { x: number; y: number; w: number; h: number }; c: Layer; clip: Path2D }

/** The figure's own box (px) with a margin for its rim. */
export function figureBounds(f: FigureBox): { x: number; y: number; w: number; h: number } {
  const half = 0.25 * f.H;
  return { x: f.cx - half, y: f.top - 0.04 * f.H, w: 2 * half, h: 1.08 * f.H };
}

/**
 * The figure of light, baked per size: a translucent body, warm where the light from above falls and cool
 * below, an inner glow along the midline, and a rim of light — gold at the head and the shoulders, pearl and
 * silver lower down.  No face, no features: anyone can stand in it.
 */
export function bakeFigure(f: FigureBox, dpr: number): FigureLayer | null {
  const box = figureBounds(f);
  const B = layer(box.w, box.h, dpr);
  if (!B) return null;
  const c = B.ctx, H = f.H;
  const map = mapper(f, box.x, box.y);
  const sil = outlinePath(map);
  const [, y0] = map(0, 0), [, y1] = map(0, 1);
  // the body: translucent, the head no brighter than the chest (a gradient of light, never a white fill)
  const body = c.createLinearGradient(0, y0, 0, y1);
  body.addColorStop(0, 'rgba(240,226,255,.17)');
  body.addColorStop(0.2, 'rgba(226,214,255,.16)');
  body.addColorStop(0.62, 'rgba(176,176,246,.13)');
  body.addColorStop(1, 'rgba(140,150,230,.11)');
  c.fillStyle = body;
  c.fill(sil);
  c.save();
  c.clip(sil);
  // the inner light along the midline, and a soft warmth at the head and the chest
  const [mx] = map(0, 0);
  const mid = c.createLinearGradient(mx - H * 0.1, 0, mx + H * 0.1, 0);
  mid.addColorStop(0, 'rgba(255,255,255,0)');
  mid.addColorStop(0.5, 'rgba(255,250,240,.11)');
  mid.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = mid;
  c.fillRect(0, 0, box.w, box.h);
  for (const [y, r, a] of [[0.06, 0.075, 0.08], [0.3, 0.2, 0.1], [0.47, 0.16, 0.07]] as const) {
    const [gx, gy] = map(0, y);
    const rg = c.createRadialGradient(gx, gy, 0, gx, gy, r * H);
    rg.addColorStop(0, `rgba(255,244,236,${a})`);
    rg.addColorStop(1, 'rgba(255,244,236,0)');
    c.fillStyle = rg;
    c.fillRect(gx - r * H, gy - r * H, 2 * r * H, 2 * r * H);
  }
  // the light from above along the top edge of the head (inside the rim), fading by the brow
  const top = c.createLinearGradient(0, y0, 0, y0 + H * 0.07);
  top.addColorStop(0, 'rgba(255,236,196,.14)');
  top.addColorStop(1, 'rgba(255,236,196,0)');
  c.fillStyle = top;
  c.fillRect(0, 0, box.w, box.h);
  c.restore();
  // the rim of light: a wide soft halo, a mid glow, and a crisp line warm at the top and silver below
  const rim = c.createLinearGradient(0, y0, 0, y1);
  rim.addColorStop(0, 'rgba(255,232,176,.95)');
  rim.addColorStop(0.3, 'rgba(244,232,255,.8)');
  rim.addColorStop(0.7, 'rgba(206,210,255,.6)');
  rim.addColorStop(1, 'rgba(176,206,255,.55)');
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(206,196,255,.08)';
  c.lineWidth = Math.max(4, H * 0.026);
  c.stroke(sil);
  c.strokeStyle = 'rgba(232,222,255,.18)';
  c.lineWidth = Math.max(2, H * 0.01);
  c.stroke(sil);
  c.strokeStyle = rim;
  c.lineWidth = Math.max(1, H * 0.0034);
  c.stroke(sil);
  return { box, c: B.c, clip: outlinePath(mapper(f)) };
}

// ── the aura and the pool ────────────────────────────────────────
let auraC: Layer | null | undefined;

/** An egg of light (a ring, 256 px): drawn stretched into the ellipse around the body, additively. */
export function auraSprite(): Layer | null {
  if (auraC !== undefined) return auraC;
  const L = layer(256, 256, 1);
  auraC = L ? L.c : null;
  if (!L) return null;
  const g = L.ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(240,230,255,0)');
  g.addColorStop(0.5, 'rgba(232,222,255,.035)');
  g.addColorStop(0.74, 'rgba(236,224,255,.13)');
  g.addColorStop(0.86, 'rgba(255,238,206,.26)');
  g.addColorStop(0.93, 'rgba(214,206,255,.11)');
  g.addColorStop(1, 'rgba(200,190,255,0)');
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 256, 256);
  return auraC;
}

let poolC: Layer | null | undefined;

/** The pool of living water (128 px, round): drawn flattened under the feet, additively. */
export function poolSprite(): Layer | null {
  if (poolC !== undefined) return poolC;
  const L = layer(128, 128, 1);
  poolC = L ? L.c : null;
  if (!L) return null;
  const g = L.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(230,252,255,.85)');
  g.addColorStop(0.28, 'rgba(159,230,255,.5)');
  g.addColorStop(0.62, 'rgba(90,170,240,.16)');
  g.addColorStop(1, 'rgba(70,140,230,0)');
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 128, 128);
  return poolC;
}

// ── the rose windows ─────────────────────────────────────────────
export interface RoseLayers {
  /** the baked radius (CSS px) and the layer's half size (radius + margin) */
  R: number;
  half: number;
  /** the whole window in light: every piece of glass, the lead, the stone */
  glass: Layer;
  /** the window waiting for light: the tracery and a ghost of its glass */
  lead: Layer;
}

/**
 * A place's rose window at radius R (CSS px), baked: each piece of glass filled with light from the centre
 * outward (pale near the oculus, the glass colour at the rim, alternate pieces a touch deeper), the dark lead
 * around every piece, and the stone tracery rings.  The unlit `lead` layer keeps a faint ghost of the glass.
 */
export function bakeRose(place: PlaceId, R: number, dpr: number, tier = 0): RoseLayers | null {
  const spec = PLACE[place], rose = spec.rose;
  const half = Math.ceil(R * 1.24);
  const G = layer(half * 2, half * 2, dpr), Ld = layer(half * 2, half * 2, dpr);
  if (!G || !Ld) return null;
  const all = pieces(rose, R);
  const [cGlass, iGlass, oGlass] = rose.glass;
  // thin leading: at the size of a lit window on the figure it all but disappears, and the glass reads as light
  const leadW = Math.max(0.5, R * 0.02);
  const paint = (c: CanvasRenderingContext2D, ghost: boolean) => {
    c.save();
    c.translate(half, half);
    // The waiting window has only a breath of light in it — its tracery drawn in light, its glass a ghost of its
    // colours.  The lit window is glass lit from behind: the ground between the pieces is glass of the place's
    // own colour too, brightest at the centre, so the whole disc glows.
    c.beginPath();
    c.arc(0, 0, R * 1.0, 0, TAU);
    if (ghost) c.fillStyle = 'rgba(206,198,255,.07)';
    else {
      const gg = c.createRadialGradient(0, 0, 0, 0, 0, R);
      gg.addColorStop(0, mix(spec.hue, '#ffffff', 0.4));
      gg.addColorStop(0.45, mix(spec.hue, spec.deep, 0.2));
      gg.addColorStop(1, mix(spec.hue, spec.deep, 0.5));
      c.fillStyle = gg;
    }
    c.fill();
    for (const pc of all) {
      // the foils turn to gold glass once the window is gilded (tier 1)
      const base = pc.ring === 'c' ? cGlass : pc.ring === 'i' ? iGlass : pc.ring === 'o' ? oGlass : tier >= 1 ? '#ffd98a' : cGlass;
      const tone = pc.index % 2 === 1 && pc.ring !== 'c' ? mix(base, spec.deep, ghost ? 0.22 : 0.1) : base;
      const g = c.createRadialGradient(0, 0, Math.max(0, pc.r0 * 0.6), 0, 0, Math.max(1, pc.r1));
      if (ghost) {
        g.addColorStop(0, mix(tone, '#ffffff', 0.6));
        g.addColorStop(0.55, mix(tone, '#ffffff', 0.18));
        g.addColorStop(1, tone);
      } else {
        // saturated, translucent, bright: white-hot near the light, the glass's own colour at the rim
        g.addColorStop(0, mix(tone, '#ffffff', 0.62));
        g.addColorStop(0.5, mix(tone, '#ffffff', 0.16));
        g.addColorStop(1, tone);
      }
      c.globalAlpha = ghost ? 0.2 : 1;
      c.fillStyle = g;
      c.fill(pc.path);
    }
    c.globalAlpha = 1;
    // the lead around every piece: dark and thin on lit glass, light on the waiting one
    c.strokeStyle = ghost ? 'rgba(236,232,255,.42)' : 'rgba(34,20,58,.58)';
    c.lineWidth = ghost ? Math.max(0.7, leadW) : leadW;
    c.lineJoin = 'round';
    for (const pc of all) c.stroke(pc.path);
    // the tracery's rings
    c.lineWidth = Math.max(0.7, R * (ghost ? 0.03 : 0.026));
    c.strokeStyle = ghost ? 'rgba(240,236,255,.5)' : 'rgba(44,26,72,.5)';
    for (const r of [RING.c, RING.i, RING.o]) {
      c.beginPath();
      c.arc(0, 0, r * R, 0, TAU);
      c.stroke();
    }
    if (!ghost) {
      // the window's edge catches the light: a bright rim in the place's colour
      c.lineWidth = Math.max(0.8, R * 0.035);
      c.strokeStyle = `${rgbaPrefix(mix(spec.hue, '#ffffff', 0.35))}.9)`;
      c.beginPath();
      c.arc(0, 0, R * 0.995, 0, TAU);
      c.stroke();
    }
    // a crown of small round lights outside the rim (tier 2): its tracery waits in the ghost too
    if (tier >= 2) {
      const n = rose.outer, cr = R * 0.055, ring = R * 1.1;
      c.lineWidth = Math.max(0.6, R * 0.02);
      c.strokeStyle = ghost ? 'rgba(240,236,255,.4)' : 'rgba(44,26,72,.5)';
      c.beginPath();
      c.arc(0, 0, R * 1.035, 0, TAU);
      c.stroke();
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k + 0.5 + rose.twist) * (TAU / n);
        const x = Math.cos(a) * ring, y = Math.sin(a) * ring;
        c.beginPath();
        c.arc(x, y, cr, 0, TAU);
        if (ghost) {
          c.fillStyle = 'rgba(236,232,255,.12)';
        } else {
          const g = c.createRadialGradient(x, y, 0, x, y, cr);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, spec.hue);
          c.fillStyle = g;
        }
        c.fill();
        c.lineWidth = Math.max(0.6, leadW * 0.7);
        c.stroke();
      }
    }
    if (!ghost) {
      // a gilded edge on the outer stone (tier 1), golden tracery on the inner rings (tier 3), a bright centre
      if (tier >= 1) {
        c.lineWidth = Math.max(0.6, R * 0.016);
        c.strokeStyle = 'rgba(255,217,138,.85)';
        c.beginPath();
        c.arc(0, 0, RING.o * R + R * 0.03, 0, TAU);
        c.stroke();
      }
      if (tier >= 3) {
        c.lineWidth = Math.max(0.6, R * 0.014);
        c.strokeStyle = 'rgba(255,226,160,.9)';
        for (const r of [RING.c, RING.i]) {
          c.beginPath();
          c.arc(0, 0, r * R, 0, TAU);
          c.stroke();
        }
        c.fillStyle = '#ffe9b0';
        for (let k = 0; k < rose.outer; k++) {
          const a = -Math.PI / 2 + (k + rose.twist) * (TAU / rose.outer);
          c.beginPath();
          c.arc(Math.cos(a) * RING.o * R, Math.sin(a) * RING.o * R, Math.max(0.8, R * 0.022), 0, TAU);
          c.fill();
        }
      }
      // the luminous core: the light itself, seen through the oculus
      const cg = c.createRadialGradient(0, 0, 0, 0, 0, RING.c * R * 1.25);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.45, 'rgba(255,255,255,.75)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = cg;
      c.beginPath();
      c.arc(0, 0, RING.c * R * 1.25, 0, TAU);
      c.fill();
    }
    c.restore();
  };
  paint(G.ctx, false);
  paint(Ld.ctx, true);
  return { R, half, glass: G.c, lead: Ld.c };
}

/** Bake every place's window at radius R (a size's set), each at its craft tier. */
export function bakeRoses(R: number, dpr: number, tiers: Partial<Record<PlaceId, number>> = {}): Partial<Record<PlaceId, RoseLayers>> {
  const out: Partial<Record<PlaceId, RoseLayers>> = {};
  for (const p of PLACES) {
    const r = bakeRose(p, R, dpr, tiers[p] ?? 0);
    if (r) out[p] = r;
  }
  return out;
}

/** Text with a soft dark edge so it reads on any ground. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color = PEARL, align: CanvasTextAlign = 'center', weight = 700, serif = false, italic = false): void {
  ctx.font = font(px, weight, serif, italic);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, px * 0.26);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
