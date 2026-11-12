/**
 * Światło ciała's pictures, drawn with canvas paths (no images): a night of deep blue, a figure like
 * frosted glass with a cyan rim, organs in warm, clear colours that glow when they are in balance, a band
 * of light (cool white, gold above the threshold, violet in rest, silver when blind).  Light is light:
 * additive glows from small baked sprites, never shadowBlur or filters per frame; the figure and its
 * organs are drawn once per size and depth into offscreen layers, so a frame only composes them.
 */
import { MIN_TEXT } from '../kit/mobile';
import { ORGAN, ORGANS, type Depth, type OrganId } from './content';
import { HEAD, HYPOTHALAMUS, ORGAN_SHAPES, ORGAN_SPOT, PITUITARY, SYSTEMS, organFill, organStrokes, silhouettePath, spline, type ToScreen } from './figure';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const NIGHT = ['#050816', '#0b1430', '#13213f'] as const;
export const CYAN = '#8fd6e8';
export const ICE = '#e9fbff';
export const GOLD = '#ffd27a';
export const GOLD_HI = '#fff0c4';
export const REST = '#a9b8ff';
export const SILVER = '#c8d0e0';
export const INK = 'rgba(6,10,26,.78)';
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

/** Mix two "#rrggbb" colours (k = 0 → a, 1 → b) into "rgb(…)". */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ── offscreen layers ─────────────────────────────────────────────
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
  g.addColorStop(0.25, `${pre}.55)`);
  g.addColorStop(0.6, `${pre}.14)`);
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

const bandCache = new Map<string, Layer>();

/** A vertical strip of light (1 × 128 px): transparent at the edges, a bright core in the middle. */
export function bandSprite(hex: string): Layer | null {
  const hit = bandCache.get(hex);
  if (hit) return hit;
  const L = layer(4, 128, 1);
  if (!L) return null;
  const pre = rgbaPrefix(hex);
  const g = L.ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, `${pre}0)`);
  g.addColorStop(0.3, `${pre}.28)`);
  g.addColorStop(0.47, `${pre}.9)`);
  g.addColorStop(0.5, `${pre}1)`);
  g.addColorStop(0.53, `${pre}.9)`);
  g.addColorStop(0.7, `${pre}.28)`);
  g.addColorStop(1, `${pre}0)`);
  L.ctx.fillStyle = g;
  L.ctx.fillRect(0, 0, 4, 128);
  bandCache.set(hex, L.c);
  return L.c;
}

// ── the figure ───────────────────────────────────────────────────
export interface FigureBox { cx: number; top: number; H: number }

/** The figure's own box (px) around its centre line: the arms' span and the feet, with a margin for glows. */
export function figureBounds(f: FigureBox, pad = 0.04): { x: number; y: number; w: number; h: number } {
  const half = (0.19 + pad) * f.H;
  return { x: f.cx - half, y: f.top - pad * f.H, w: 2 * half, h: (1 + 2 * pad) * f.H };
}

/** Screen coordinates for figure units inside a layer whose origin is at (ox, oy). */
export const mapper = (f: FigureBox, ox = 0, oy = 0): ToScreen => (x, y) => [f.cx - ox + x * f.H, f.top - oy + y * f.H];

/** The silhouette path in screen coordinates (for clipping the band). */
export const silhouette = (f: FigureBox): Path2D => silhouettePath(mapper(f), f.H);

/** A deterministic 0..1 for an integer (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The cells of the "cells" depth inside a path: small rounded nuclei on a soft membrane grid. */
function cells(ctx: CanvasRenderingContext2D, path: Path2D, bx: number, by: number, bw: number, bh: number, cell: number, hue: string, a: number): void {
  ctx.save();
  ctx.clip(path);
  const pre = rgbaPrefix(hue);
  ctx.strokeStyle = `${pre}${(0.35 * a).toFixed(3)})`;
  ctx.fillStyle = `${pre}${(0.5 * a).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.6, cell * 0.08);
  let k = 0;
  for (let y = by; y < by + bh + cell; y += cell * 0.86) {
    const row = Math.round((y - by) / (cell * 0.86));
    for (let x = bx + (row % 2 ? cell / 2 : 0); x < bx + bw + cell; x += cell) {
      const j = hash(++k) * 0.3;
      ctx.beginPath();
      ctx.arc(x + j * cell, y, cell * 0.46, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + j * cell, y, cell * 0.14, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The organ's bounding box in figure units (from its shapes), padded. */
function organBox(o: OrganId, pad: number): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of ORGAN_SHAPES[o]) {
    const pts = s.kind === 'ellipse' ? [[s.x - s.rx, s.y - s.ry], [s.x + s.rx, s.y + s.ry]] : s.pts;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** Paint one organ (filled parts and strokes) into a context with a mapper. */
function paintOrgan(ctx: CanvasRenderingContext2D, o: OrganId, map: ToScreen, H: number, fill: string | CanvasGradient, line: string, lw: number): void {
  const p = organFill(o, map, H);
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.stroke(p);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of organStrokes(o, map, H)) {
    ctx.strokeStyle = line;
    ctx.lineWidth = s.width + lw * 2;
    ctx.stroke(s.path);
    ctx.strokeStyle = typeof fill === 'string' ? fill : line;
    ctx.lineWidth = s.width;
    ctx.stroke(s.path);
  }
}

export interface FigureLayers {
  box: { x: number; y: number; w: number; h: number };
  /** the glass body with its organs at rest (deep colours), the depth's details */
  base: Layer;
  /** each organ lit (its hue, a bloom baked in), drawn over the base with the organ's glow as alpha */
  lit: Record<OrganId, { c: Layer; x: number; y: number; w: number; h: number }>;
  /** the silhouette in screen px (the band's clip) */
  clip: Path2D;
}

/** Bake the figure for a box and a depth (call on resize and when the depth changes). */
export function bakeFigure(f: FigureBox, depth: Depth, dpr: number): FigureLayers | null {
  const box = figureBounds(f);
  const B = layer(box.w, box.h, dpr);
  if (!B) return null;
  const ctx = B.ctx, H = f.H;
  const map = mapper(f, box.x, box.y);
  const sil = silhouettePath(map, H);
  // the glass body: a cool gradient, light from above, a soft inner glow at the chest
  const g = ctx.createLinearGradient(0, map(0, 0)[1], 0, map(0, 1)[1]);
  g.addColorStop(0, 'rgba(150,215,240,.26)');
  g.addColorStop(0.35, 'rgba(110,170,225,.17)');
  g.addColorStop(1, 'rgba(70,110,190,.12)');
  ctx.fillStyle = g;
  ctx.fill(sil);
  ctx.save();
  ctx.clip(sil);
  const [cx, cy] = map(0, 0.3);
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.42);
  rg.addColorStop(0, 'rgba(200,240,255,.14)');
  rg.addColorStop(1, 'rgba(200,240,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, box.w, box.h);
  // anatomy's quiet lines: the spine, the clavicles, the ribs
  ctx.strokeStyle = 'rgba(190,235,255,.12)';
  ctx.lineWidth = Math.max(1, H * 0.003);
  const sp = new Path2D();
  spline(sp, [[0, 0.13], [0, 0.25], [0.002, 0.36], [0, 0.47]], map, false);
  ctx.stroke(sp);
  for (const s of [1, -1]) {
    const cl = new Path2D();
    spline(cl, [[0.006 * s, 0.168], [0.05 * s, 0.163], [0.095 * s, 0.17]], map, false);
    ctx.stroke(cl);
    for (let i = 0; i < 6; i++) {
      const y = 0.19 + i * 0.022;
      const rib = new Path2D();
      spline(rib, [[0.004 * s, y], [0.05 * s, y + 0.006], [0.078 * s, y + 0.022 + i * 0.002]], map, false);
      ctx.stroke(rib);
    }
  }
  ctx.restore();
  // the organs at rest
  for (const o of ORGANS) {
    const spec = ORGAN[o];
    const b = organBox(o, 0);
    const [x0, y0] = map(b.x0, b.y0), [x1, y1] = map(b.x1, b.y1);
    // glass with colour in it: lighter where the light from above falls, deep below; the bones quieter
    const soft = o === 'bone' ? 0.6 : 1;
    const og = ctx.createLinearGradient(0, y0, 0, y1);
    og.addColorStop(0, `${rgbaPrefix(spec.hue)}${(0.34 * soft).toFixed(2)})`);
    og.addColorStop(0.45, `${rgbaPrefix(spec.deep)}${(0.5 * soft).toFixed(2)})`);
    og.addColorStop(1, `${rgbaPrefix(spec.deep)}${(0.62 * soft).toFixed(2)})`);
    paintOrgan(ctx, o, map, H, og, `${rgbaPrefix(spec.hue)}${(0.42 * soft).toFixed(2)})`, Math.max(0.8, H * 0.0022));
    if (depth >= 2) cells(ctx, organFill(o, map, H), x0, y0, x1 - x0, y1 - y0, Math.max(3, H * 0.0085), spec.hue, 0.6);
  }
  // the hypothalamus and the pituitary
  for (const s of [HYPOTHALAMUS, PITUITARY]) {
    const [x, y] = map(s.x, s.y);
    ctx.fillStyle = 'rgba(255,220,240,.55)';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.2, s.r * H), 0, TAU);
    ctx.fill();
  }
  // the systems depth: the paths between the organs, quietly
  if (depth >= 3) {
    ctx.lineCap = 'round';
    for (const [kind, lines] of Object.entries(SYSTEMS)) {
      ctx.strokeStyle = kind === 'vagus' ? 'rgba(255,236,170,.32)' : kind === 'hpa' ? 'rgba(255,190,120,.3)' : 'rgba(255,140,150,.28)';
      ctx.lineWidth = Math.max(1, H * (kind === 'aorta' ? 0.006 : 0.0032));
      for (const pts of lines) {
        const p = new Path2D();
        spline(p, pts, map, false);
        ctx.stroke(p);
      }
    }
  }
  // the rim of light around the body
  ctx.strokeStyle = 'rgba(143,214,232,.12)';
  ctx.lineWidth = Math.max(3, H * 0.014);
  ctx.stroke(sil);
  ctx.strokeStyle = 'rgba(190,240,255,.62)';
  ctx.lineWidth = Math.max(1, H * 0.0036);
  ctx.stroke(sil);
  // the face, barely: closed eyes in peace
  const [ex, ey] = map(0, HEAD.y + 0.006);
  ctx.strokeStyle = 'rgba(220,245,255,.4)';
  ctx.lineWidth = Math.max(0.8, H * 0.0026);
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.arc(ex + s * HEAD.rx * 0.42 * H, ey, HEAD.rx * 0.18 * H, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // each organ lit, with its bloom
  const lit = {} as FigureLayers['lit'];
  for (const o of ORGANS) {
    const spec = ORGAN[o];
    const b = organBox(o, 0.05);
    const pairBox = ORGAN_SPOT[o].pair ? { x0: Math.min(b.x0, -b.x1), x1: Math.max(b.x1, -b.x0) } : { x0: b.x0, x1: b.x1 };
    const fx0 = pairBox.x0, fx1 = pairBox.x1;
    const w = (fx1 - fx0) * H, h = (b.y1 - b.y0) * H;
    const L = layer(w, h, dpr);
    if (!L) continue;
    const m: ToScreen = (x, y) => [(x - fx0) * H, (y - b.y0) * H];
    const lc = L.ctx;
    // the bloom: a few soft glows over the organ's spots
    const spot = ORGAN_SPOT[o];
    for (const sx of spot.pair ? [spot.x, -spot.x] : [spot.x]) {
      const [gx, gy] = m(sx, spot.y);
      const s = glowSprite(spec.hue);
      if (s) {
        lc.globalAlpha = 0.55;
        const r = (spot.r + 0.035) * H;
        lc.drawImage(s, gx - r, gy - r, 2 * r, 2 * r);
        lc.globalAlpha = 1;
      }
    }
    const fillG = lc.createLinearGradient(0, 0, 0, h);
    fillG.addColorStop(0, '#ffffff');
    fillG.addColorStop(0.35, spec.hue);
    fillG.addColorStop(1, spec.hue);
    paintOrgan(lc, o, m, H, fillG, 'rgba(255,255,255,.85)', Math.max(0.8, H * 0.0024));
    if (depth >= 2) cells(lc, organFill(o, m, H), 0, 0, w, h, Math.max(3, H * 0.0085), '#ffffff', 0.55);
    lit[o] = { c: L.c, x: f.cx + fx0 * H, y: f.top + b.y0 * H, w, h };
  }
  return { box, base: B.c, lit, clip: silhouettePath(mapper(f), H) };
}

/** The night sky behind the figure (baked per size): deep gradient, a few still stars, a soft floor of light. */
export function bakeNight(w: number, h: number, dpr: number, figCx: number, figMidY: number): Layer | null {
  const L = layer(w, h, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, NIGHT[0]);
  g.addColorStop(0.55, NIGHT[1]);
  g.addColorStop(1, NIGHT[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // a halo of quiet light behind the figure
  const r = Math.max(w, h) * 0.55;
  const rg = ctx.createRadialGradient(figCx, figMidY, 0, figCx, figMidY, r);
  rg.addColorStop(0, 'rgba(90,150,220,.22)');
  rg.addColorStop(0.5, 'rgba(60,90,170,.08)');
  rg.addColorStop(1, 'rgba(40,60,120,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  // still stars
  for (let i = 0; i < Math.round((w * h) / 9000); i++) {
    const x = hash(i * 3 + 1) * w, y = hash(i * 7 + 2) * h, s = 0.4 + hash(i * 11 + 3) * 1.1;
    ctx.fillStyle = `rgba(220,235,255,${(0.15 + 0.45 * hash(i * 13 + 4)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
  }
  return L.c;
}

/** Text with a soft dark edge so it reads on any ground. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color = ICE, align: CanvasTextAlign = 'center', weight = 700): void {
  ctx.font = font(px, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, px * 0.24);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Small stars for a rating (★ filled, ☆ empty) as text. */
export const stars = (n: number, of = 3): string => '★'.repeat(Math.max(0, Math.min(of, n))) + '☆'.repeat(Math.max(0, of - Math.max(0, Math.min(of, n))));
