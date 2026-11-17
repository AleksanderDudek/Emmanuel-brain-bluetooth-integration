/**
 * Światło ciała's pictures, drawn with canvas paths (no images): a night of deep blue, a figure like frosted glass
 * with a cyan rim, the brain as glass of the same family, and every element of a meditation as a shape of its own —
 * a ghost of its colour while it waits, its colour lit and glowing once focus has filled it.  Light is light: additive
 * glows from small baked sprites, never shadowBlur or filters per frame.  Every shape is a Path2D built once in its
 * picture's units (the figure's H = 1, the brain's units) and drawn through the camera's transform, so a zoom into a
 * hand or a dive into the head stays crisp without baking anything per zoom.
 */
import { MIN_TEXT } from '../kit/mobile';
import { LAT_CEREBELLUM, LAT_OUTLINE, LAT_STEM, LAT_SULCI, MED_OUTLINE, MED_SULCI } from './brain';
import { OUTLINE, QUIET, polygon, spline, type Geo, type P, type Shape } from './figure';

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

/** Wrap `text` at the largest size from `px` down to `min` that fits `maxLines` lines in `maxW`; sets ctx.font. */
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

/** "#rrggbb" → "rgba(r,g,b," (append the alpha and ")"). */
export function rgbaPrefix(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},`;
}
export const rgba = (hex: string, a: number): string => `${rgbaPrefix(hex)}${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** Mix two "#rrggbb" colours (k = 0 → a, 1 → b) into "rgb(…)". */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ── offscreen layers and baked glows ──────────────────────────────
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

/** Draw a baked glow centred at (x, y) with radius r and alpha a (additive), in the current transform. */
export function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number): void {
  const s = glowSprite(hex);
  if (!s || a <= 0.003 || r <= 0) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

/** A deterministic 0..1 for an integer (decorations that never jump). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The night sky behind the picture (baked per size): deep gradient, a few still stars, a soft halo behind the stage. */
export function bakeNight(w: number, h: number, dpr: number, cx: number, cy: number): Layer | null {
  const L = layer(w, h, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, NIGHT[0]);
  g.addColorStop(0.55, NIGHT[1]);
  g.addColorStop(1, NIGHT[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.55;
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  rg.addColorStop(0, 'rgba(90,150,220,.22)');
  rg.addColorStop(0.5, 'rgba(60,90,170,.08)');
  rg.addColorStop(1, 'rgba(40,60,120,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < Math.round((w * h) / 9000); i++) {
    const x = hash(i * 3 + 1) * w, y = hash(i * 7 + 2) * h, s = 0.4 + hash(i * 11 + 3) * 1.1;
    ctx.fillStyle = `rgba(220,235,255,${(0.15 + 0.45 * hash(i * 13 + 4)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
  }
  return L.c;
}

// ── paths in picture units ─────────────────────────────────────
const hasPath2D = (): boolean => typeof Path2D !== 'undefined';

let outlineCache: Path2D | null = null;
/** The figure's outline (H = 1 units). */
export function outlinePath(): Path2D | null {
  if (!hasPath2D()) return null;
  if (!outlineCache) {
    outlineCache = new Path2D();
    spline(outlineCache, OUTLINE, true);
  }
  return outlineCache;
}

const brainCache = new Map<string, Path2D>();
/** The hemisphere's outline in a brain view ('lat' or 'med'), and the lateral view's cerebellum and stem. */
export function brainPath(which: 'lat' | 'med' | 'cereb' | 'stem'): Path2D | null {
  if (!hasPath2D()) return null;
  let p = brainCache.get(which);
  if (!p) {
    p = new Path2D();
    spline(p, which === 'lat' ? LAT_OUTLINE : which === 'med' ? MED_OUTLINE : which === 'cereb' ? LAT_CEREBELLUM : LAT_STEM, true);
    brainCache.set(which, p);
  }
  return p;
}

const linesCache = new Map<string, Path2D>();
/** Quiet lines (the figure's anatomy under the glass, the sulci of a brain view) as one path. */
export function linesPath(which: 'quiet' | 'latSulci' | 'medSulci' | 'back'): Path2D | null {
  if (!hasPath2D()) return null;
  let p = linesCache.get(which);
  if (!p) {
    p = new Path2D();
    const sets: readonly (readonly P[])[] = which === 'quiet' ? QUIET : which === 'latSulci' ? LAT_SULCI : which === 'medSulci' ? MED_SULCI : BACK_LINES;
    for (const pts of sets) spline(p, pts, false);
    linesCache.set(which, p);
  }
  return p;
}

/** The back's quiet lines: the spine, the shoulder blades, the line of the buttocks, the backs of the knees. */
const BACK_LINES: readonly (readonly P[])[] = [
  [[0, 0.15], [0, 0.3], [0.001, 0.46]],
  [[0.03, 0.19], [0.068, 0.2], [0.075, 0.24], [0.045, 0.27]], [[-0.03, 0.19], [-0.068, 0.2], [-0.075, 0.24], [-0.045, 0.27]],
  [[0, 0.47], [0, 0.53]],
  [[0.036, 0.72], [0.05, 0.728], [0.064, 0.72]], [[-0.036, 0.72], [-0.05, 0.728], [-0.064, 0.72]],
];

export interface GeoPaths {
  fill: Path2D | null;
  lines: { p: Path2D; w: number }[];
  marks: Path2D | null;
  skin: boolean;
}

const geoCache = new WeakMap<Geo, GeoPaths>();

function addShape(fill: Path2D, s: Shape, m: number): void {
  const mp = (pts: readonly P[]): P[] => (m > 0 ? [...pts] : pts.map(([x, y]) => [-x, y] as P));
  if (s.k === 'blob') spline(fill, mp(s.p), true);
  else if (s.k === 'poly') polygon(fill, mp(s.p));
  else if (s.k === 'ell') {
    const x = m * s.x;
    fill.moveTo(x + s.rx, s.y);
    fill.ellipse(x, s.y, s.rx, s.ry, m * (s.rot ?? 0), 0, TAU);
  }
}

/** An element's paths (built once): its filled shapes, its tubes with their widths, its decorations. */
export function geoPaths(g: Geo): GeoPaths {
  const hit = geoCache.get(g);
  if (hit) return hit;
  const out: GeoPaths = { fill: null, lines: [], marks: null, skin: false };
  if (!hasPath2D()) return out;
  const sides = g.mirror ? [1, -1] : [1];
  let fill: Path2D | null = null;
  for (const s of g.shapes) {
    if (s.k === 'skin') { out.skin = true; continue; }
    for (const m of sides) {
      if (s.k === 'line') {
        const p = new Path2D();
        spline(p, m > 0 ? s.p : s.p.map(([x, y]) => [-x, y] as P), false);
        out.lines.push({ p, w: s.w });
      } else {
        fill ??= new Path2D();
        addShape(fill, s, m);
      }
    }
  }
  out.fill = fill;
  if (g.marks?.length) {
    const mk = new Path2D();
    for (const pts of g.marks) spline(mk, pts, false);
    out.marks = mk;
  }
  geoCache.set(g, out);
  return out;
}

/** Text with a soft dark edge so it reads on any ground (screen space). */
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
