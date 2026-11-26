/**
 * Pełnia radości's shared strokes (DESIGN.md §24): what several of its worlds draw — the figure of light (kit/figure's
 * calm, featureless person: anyone can stand in it) placed in a world's own units, its rim baked once and its inner
 * light drawn each frame; a small person of the constellation (a head and shoulders, no face); a seed of light; a
 * sparkle of growth; the staggered reveal of a row of things — on the section's painting kit (kit/healthlib/paint.ts).
 *
 * The palette is dawn's: gold and peach for joy received, rose for warmth between people, sky blue for the open
 * space joy makes, pearl for the figure's rim.  Light is light: additive glows from baked sprites, no shadowBlur.
 */
import { clamp } from '../kit/juice';
import { figurePath, type ToScreen } from '../kit/figure';
import { GOLD, GOLD_HI, PEARL, TAU, glow, hash, rgba, starSprite } from '../kit/healthlib/paint';

export { clamp };
export type P2 = [number, number];

export const PEACH = '#ffc4a0';
export const DAWN = '#ffab7a';
export const ROSE = '#ff9cbc';
export const ROSE_HI = '#ffd0de';
export const SKY = '#a8d8ff';
export const SKY_HI = '#e2f2ff';
export const LEAF = '#b8f0c8';
export { GOLD, GOLD_HI, PEARL };

/** A smooth step 0..1 (cubic). */
export const smooth = (t: number): number => {
  const k = clamp(t);
  return k * k * (3 - 2 * k);
};

/** A part of a growth between a and b, eased (0 before a, 1 after b). */
export const phase = (g: number, a: number, b: number): number => smooth((g - a) / Math.max(0.0001, b - a));

/** The i-th of n things revealed along a growth g: each takes `span` of it, starting in turn between `from` and `to`. */
export function stagger(g: number, i: number, n: number, span = 0.3, from = 0, to = 1): number {
  const room = Math.max(0.0001, to - from - span);
  const start = from + (n <= 1 ? 0 : (i / (n - 1)) * room);
  return smooth((g - start) / span);
}

/** Screen px per world unit of a context's current transform (CSS px: the device ratio taken out). */
export function pxOf(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(2, Math.max(1, devicePixelRatio)) : 1;
  return Math.hypot(m.a, m.b) / dpr || 1;
}

/** A gentle wave 0..1 at a rate (Hz) and phase; 0.5 when motion is reduced. */
export const wave = (time: number, hz: number, ph = 0, reduced = false): number =>
  reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * TAU * hz + ph);

// ── the figure of light ──────────────────────────────────────────

/** Where a figure stands in a world: its midline x, its crown's y, its height (crown to soles) in world units. */
export interface FigAt { x: number; top: number; h: number }

/** kit/figure's places, in a figure's own units (0 crown … 1 soles). */
export const FIG = {
  brow: [0, 0.052], heart: [0, 0.262], plexus: [0, 0.335], belly: [0, 0.44], palmR: [0.168, 0.525], palmL: [-0.168, 0.525],
  footR: [0.044, 0.972], footL: [-0.044, 0.972], crown: [0, 0.004], throat: [0, 0.165],
} as const satisfies Record<string, readonly [number, number]>;

/** A place of a figure in world units. */
export const figPt = (f: FigAt, p: readonly [number, number]): P2 => [f.x + p[0] * f.h, f.top + p[1] * f.h];

const pathCache = new Map<string, Path2D>();
/** The figure's silhouette (body, hands, feet) as one path in world units (cached per placement). */
export function figPath(f: FigAt): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  const key = `${f.x}|${f.top}|${f.h}`;
  let p = pathCache.get(key);
  if (!p) {
    const map: ToScreen = (x, y) => [f.x + x * f.h, f.top + y * f.h];
    p = figurePath(map);
    pathCache.set(key, p);
  }
  return p;
}

/**
 * The figure's rim, baked: a wide soft halo, a mid glow and a crisp line (warm at the head, pearl below), drawn only
 * outside the silhouette, then a faint translucent body — the family's figure of light (serce, Rzeki).
 */
export function bakeFigure(ctx: CanvasRenderingContext2D, f: FigAt, warmth = 1): void {
  const p = figPath(f);
  if (!p) return;
  const px = pxOf(ctx);
  const rim = ctx.createLinearGradient(0, f.top, 0, f.top + f.h);
  rim.addColorStop(0, `rgba(255,226,170,${(0.95 * warmth).toFixed(3)})`);
  rim.addColorStop(0.3, `rgba(255,228,214,${(0.82 * warmth).toFixed(3)})`);
  rim.addColorStop(0.7, 'rgba(232,214,255,.6)');
  rim.addColorStop(1, 'rgba(214,214,255,.55)');
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,200,170,.08)';
  ctx.lineWidth = Math.max(5 / px, f.h * 0.03);
  ctx.stroke(p);
  ctx.strokeStyle = 'rgba(255,226,210,.18)';
  ctx.lineWidth = Math.max(2.5 / px, f.h * 0.012);
  ctx.stroke(p);
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1.2 / px, f.h * 0.0055);
  ctx.stroke(p);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.fill(p);
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createLinearGradient(0, f.top, 0, f.top + f.h);
  body.addColorStop(0, 'rgba(236,222,255,.13)');
  body.addColorStop(0.4, 'rgba(206,196,250,.1)');
  body.addColorStop(1, 'rgba(150,150,230,.08)');
  ctx.fillStyle = body;
  ctx.fill(p);
  ctx.restore();
}

/** Draw inside the figure only (the light that fills it). */
export function insideFigure(ctx: CanvasRenderingContext2D, f: FigAt, draw: () => void): void {
  const p = figPath(f);
  if (!p) return;
  ctx.save();
  ctx.clip(p);
  draw();
  ctx.restore();
}

/** The rim lit again from within (a second, brighter line over the baked one as the figure fills). */
export function rimLight(ctx: CanvasRenderingContext2D, f: FigAt, a: number, color = GOLD_HI): void {
  const p = figPath(f);
  if (!p || a <= 0.01) return;
  const px = pxOf(ctx);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(color, 0.12 * a);
  ctx.lineWidth = Math.max(6 / px, f.h * 0.035);
  ctx.stroke(p);
  ctx.strokeStyle = rgba(color, 0.55 * a);
  ctx.lineWidth = Math.max(1.3 / px, f.h * 0.006);
  ctx.stroke(p);
  ctx.restore();
}

// ── small lights ─────────────────────────────────────────────────

/** A seed of light: a warm core with a white heart and a soft halo; `k` 0..1 how awake. */
export function seed(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, color = GOLD): void {
  if (k <= 0.005) return;
  glow(ctx, color, x, y, r * (2.6 + 2.4 * k), 0.22 * k);
  glow(ctx, color, x, y, r * (1.2 + 0.8 * k), 0.55 * k);
  glow(ctx, '#ffffff', x, y, r * 0.55, 0.85 * k);
}

/** A four-pointed glint (additive), size in world units. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, a: number): void {
  const s = starSprite();
  if (!s || a <= 0.01 || size <= 0) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a) * ga;
  ctx.drawImage(s, x - size, y - size, 2 * size, 2 * size);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

/** A few sparkles round a point while something grows (deterministic in time). */
export function sparkles(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, size: number, time: number, n: number, a: number, seedN = 1): void {
  if (a <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const life = (time * 0.7 + hash(seedN * 17 + i * 3)) % 1;
    const ang = hash(seedN * 7 + i * 11) * TAU + time * 0.2;
    const d = r * (0.3 + 0.7 * hash(seedN * 5 + i * 13));
    sparkle(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d - life * r * 0.4, size * (0.6 + 0.6 * hash(i + seedN)), a * Math.sin(life * Math.PI));
  }
}

/** A thread of light along a quadratic curve, drawn up to `k` of its length (0..1), with a bright head. */
export function thread(ctx: CanvasRenderingContext2D, a: P2, c: P2, b: P2, k: number, color: string, w: number, alpha = 1, head = true): P2 {
  const at = (t: number): P2 => {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  };
  if (k <= 0.002) return a;
  const n = 28, m = Math.max(1, Math.round(n * k));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [lw, al] of [[w * 4, 0.12], [w * 1.8, 0.28], [w * 0.7, 0.9]] as const) {
    ctx.beginPath();
    for (let i = 0; i <= m; i++) {
      const [x, y] = at((i / n) * (k * n / m));
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = rgba(color, al * alpha);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
  const tip = at(k);
  if (head && k < 0.999) glow(ctx, color, tip[0], tip[1], w * 5, 0.8 * alpha);
  return tip;
}

/** The point at t (0..1) of a quadratic curve. */
export const quad = (a: P2, c: P2, b: P2, t: number): P2 => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
};

// ── a person of the constellation ────────────────────────────────

/**
 * A small person: a round head and the curve of the shoulders, no face — an outline of pearl light, filled softly when
 * lit (`k` 0..1), with a warm glow at the heart.  (x, y) is the middle of the shoulders; `s` the head's radius.
 */
export function person(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k: number, px: number, color = PEACH, dim = 0.5): void {
  const head = new Path2D();
  head.arc(x, y - s * 1.9, s, 0, TAU);
  const body = new Path2D();
  body.moveTo(x - s * 1.9, y + s * 1.5);
  body.bezierCurveTo(x - s * 1.9, y - s * 0.2, x - s * 1.1, y - s * 0.75, x, y - s * 0.75);
  body.bezierCurveTo(x + s * 1.1, y - s * 0.75, x + s * 1.9, y - s * 0.2, x + s * 1.9, y + s * 1.5);
  body.closePath();
  const lit = clamp(k);
  if (lit > 0.01) glow(ctx, color, x, y - s * 0.6, s * 4.2, 0.28 * lit);
  ctx.save();
  ctx.fillStyle = lit > 0.01 ? rgba(color, 0.1 + 0.32 * lit) : `rgba(200,196,240,${(0.05 * dim).toFixed(3)})`;
  ctx.fill(head);
  ctx.fill(body);
  ctx.strokeStyle = lit > 0.01 ? rgba(GOLD_HI, 0.35 + 0.6 * lit) : `rgba(214,206,255,${(0.32 * dim + 0.06).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.8 / px, s * 0.16);
  ctx.stroke(head);
  ctx.stroke(body);
  ctx.restore();
  if (lit > 0.01) glow(ctx, '#ffffff', x, y + s * 0.1, s * 0.7, 0.5 * lit);
}
