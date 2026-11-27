/**
 * Stop-klatka's paint box (DESIGN.md §28): the fonts, the gouache palette, colour maths, a one-point perspective camera
 * for the places (metres in, CSS px out), small shape helpers and the paper's grain.  The look is a graphic novel in soft
 * gouache: flat shapes, warm light from a window, soft shadows, a faint grain — no outlines but a soft darker edge on
 * people so a face reads at a glance.  No randomness at draw time: `hash` gives every detail its stable place.
 */

export const FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const TAU = Math.PI * 2;

/** The inks of words and the cards. */
export const INK = {
  ink: '#2a211c',
  inkSoft: '#5b4b40',
  paper: '#fbf5ea',
  paperEdge: '#e9dcc6',
  cream: '#fff8ec',
  gold: '#f1c36d',
  goldDeep: '#c98a2e',
  clarity: '#9fd8ff',
  clarityHi: '#e8f7ff',
  still: '#8fa6bf',
  warm: '#ff8a4a',
  night: '#141a2a',
} as const;

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const smooth = (k: number): number => { const x = clamp01(k); return x * x * (3 - 2 * x); };
export const easeOut = (k: number): number => { const x = clamp01(k); return 1 - (1 - x) * (1 - x); };

/** A stable pseudo-random 0..1 for an integer. */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A stable integer for a string (FNV-1a). */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type RGB = [number, number, number];
export const hexRGB = (h: string): RGB => {
  const v = parseInt(h.slice(1, 7), 16);
  return Number.isFinite(v) ? [(v >> 16) & 255, (v >> 8) & 255, v & 255] : [128, 128, 128];
};
const to2 = (v: number): string => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
export const rgbHex = (c: RGB): string => `#${to2(c[0])}${to2(c[1])}${to2(c[2])}`;
export const rgba = (hex: string, a: number): string => {
  const [r, g, b] = hexRGB(hex);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
};
export function mix(a: string, b: string, k: number): string {
  const p = hexRGB(a), q = hexRGB(b), t = clamp01(k);
  return rgbHex([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
}
/** Darker (k > 0 toward a warm shadow) or lighter (k < 0 toward a warm light). */
export const shade = (c: string, k: number): string => (k >= 0 ? mix(c, '#2a1c18', k) : mix(c, '#fff4e2', -k));

// ── shapes ────────────────────────────────────────────────────────

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

export function fillRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient): void {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function poly(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], fill: string | CanvasGradient): void {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A soft round shadow or glow (a radial gradient; only in baked layers or a few per frame). */
export function soft(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (!(r > 0.5) || a <= 0.003) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

// ── the camera of a place (one-point perspective) ─────────────────

/**
 * Metres to CSS px: the eye at height `E` above the floor looks straight ahead; the vanishing point is (cx, hy) and a
 * metre at a distance of one metre is `f` px.  X is metres to the right, Y metres above the floor, Z metres ahead.
 */
export interface Cam {
  cx: number;
  hy: number;
  f: number;
  E: number;
  w: number;
  h: number;
  /** the camera stepped right (m) and back (m) — the observer's view; 0 through the eyes */
  dx: number;
  dz: number;
}

export const sx = (c: Cam, X: number, Z: number): number => c.cx + (c.f * (X - c.dx)) / Math.max(0.05, Z + c.dz);
export const sy = (c: Cam, Y: number, Z: number): number => c.hy + (c.f * (c.E - Y)) / Math.max(0.05, Z + c.dz);
export const P = (c: Cam, X: number, Y: number, Z: number): [number, number] => [sx(c, X, Z), sy(c, Y, Z)];

/** A quad in the room: four corners (X, Y, Z) projected and filled. */
export function quad(ctx: CanvasRenderingContext2D, c: Cam, pts: readonly (readonly [number, number, number])[], fill: string | CanvasGradient): void {
  poly(ctx, pts.map(([X, Y, Z]) => P(c, X, Y, Z)), fill);
}

/** A box resting in the room: its front face at Z, its top seen from above (when under the eye), its inner side. */
export function box(ctx: CanvasRenderingContext2D, c: Cam, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: string): void {
  // the side facing the centre
  if (x1 < c.dx) quad(ctx, c, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], shade(col, 0.18));
  if (x0 > c.dx) quad(ctx, c, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], shade(col, 0.18));
  // the top (seen from above) or the bottom (from below)
  if (y1 < c.E) quad(ctx, c, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], shade(col, -0.12));
  else if (y0 > c.E) quad(ctx, c, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], shade(col, 0.28));
  // the front
  quad(ctx, c, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], col);
}

// ── the paper's grain (one small tile, made once) ─────────────────

let grainTile: HTMLCanvasElement | null = null;

/** The gouache paper's grain over a baked layer (a soft overlay; nothing when there is no DOM). */
export function grain(ctx: CanvasRenderingContext2D, w: number, h: number, a = 0.07): void {
  if (typeof document === 'undefined') return;
  if (!grainTile) {
    const t = document.createElement('canvas');
    t.width = 96;
    t.height = 96;
    const g = t.getContext('2d');
    if (!g) return;
    const img = g.createImageData(96, 96);
    let seed = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const v = 110 + ((seed / 2147483647) * 90) | 0;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTile = t;
  }
  const pat = ctx.createPattern(grainTile, 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** An offscreen canvas (null without a DOM). */
export function layer(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Wrap `text` into lines no wider than `maxW` at the context's font (words never cut; a word too long stands alone). */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
  }
  return out;
}

export const font = (px: number, weight = 600, family = FONT): string => `${weight} ${Math.round(px)}px ${family}`;
