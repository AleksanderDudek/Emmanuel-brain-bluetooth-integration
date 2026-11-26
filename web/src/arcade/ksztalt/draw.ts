/**
 * Lekkość i siła's shared strokes (DESIGN.md §24): the figure of light (a rim warm at the top and pearl below, a
 * translucent body, a soft inner light down the midline — the meditations' figure, kit/figure, in this game's warm
 * gold, coral and pearl), bubbles of breath, a sparkle, a stream of motes along a path, and the small sums that
 * stage a scene's growth.  Line widths come in screen px and are turned into world units by the transform.
 */
import { CORAL, PEARL_W } from './palette';
import { GOLD, GOLD_HI, TAU, glow, hash, rgba, smoothPath, starSprite } from '../kit/healthlib/paint';
import type { P } from './geo';

export { CORAL, PEARL_W };

/** World units for `css` screen px under the context's current transform (bake: read from the transform). */
export function wpx(ctx: CanvasRenderingContext2D, css: number): number {
  const a = Math.abs(ctx.getTransform().a) || 1;
  const dpr = Math.min(3, Math.max(1, (typeof globalThis !== 'undefined' && (globalThis as { devicePixelRatio?: number }).devicePixelRatio) || 1));
  return (css * dpr) / a;
}

/** A 0..1 share of a growth `g` between `a` and `b` (eased). */
export function phase(g: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (g - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The i-th of n things shows from growth a to b, one after another (0..1 each). */
export function stagger(g: number, i: number, n: number, a = 0, b = 1, overlap = 2.5): number {
  const span = (b - a) / Math.max(1, n);
  const start = a + i * span;
  return phase(g, start, Math.min(b, start + span * overlap));
}

/** A slow wave 0..1 for life in a grown picture (reduced motion: still). */
export const wave = (t: number, period: number, ph = 0, reduced = false): number => (reduced ? 0.5 : 0.5 + 0.5 * Math.sin((t / period) * TAU + ph));

/**
 * The figure of light, drawn with a path in world units: the rim (a wide soft halo, a mid glow and a crisp line,
 * warm gold at the crown to pearl below), the rim's inside erased so it lies outside without seams, a translucent body
 * and a soft light down the midline.  `top`/`bottom` are the crown's and the soles' y in world units; `alpha` dims it.
 */
export function figureLight(ctx: CanvasRenderingContext2D, path: Path2D, top: number, bottom: number, opt: { alpha?: number; warm?: number; mid?: number; midX?: number; horizontal?: boolean } = {}): void {
  const a = opt.alpha ?? 1, warm = opt.warm ?? 0;
  const span = bottom - top;
  const H = Math.abs(span);
  ctx.save();
  ctx.globalAlpha *= a;
  const grad = (stops: [number, string][]): CanvasGradient => {
    const g = opt.horizontal ? ctx.createLinearGradient(top, 0, bottom, 0) : ctx.createLinearGradient(0, top, 0, bottom);
    for (const [k, c] of stops) g.addColorStop(k, c);
    return g;
  };
  ctx.lineJoin = 'round';
  // the rim: soft and wide, then a mid glow, then the line
  ctx.strokeStyle = `rgba(255,214,190,${(0.08 + 0.05 * warm).toFixed(3)})`;
  ctx.lineWidth = Math.max(wpx(ctx, 7), H * 0.03);
  ctx.stroke(path);
  ctx.strokeStyle = `rgba(255,226,214,${(0.18 + 0.08 * warm).toFixed(3)})`;
  ctx.lineWidth = Math.max(wpx(ctx, 3.2), H * 0.012);
  ctx.stroke(path);
  ctx.strokeStyle = grad([[0, 'rgba(255,230,176,.95)'], [0.32, 'rgba(255,226,220,.82)'], [0.72, 'rgba(246,224,255,.66)'], [1, 'rgba(232,214,255,.62)']]);
  ctx.lineWidth = Math.max(wpx(ctx, 1.5), H * 0.0055);
  ctx.stroke(path);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.fill(path);
  ctx.globalCompositeOperation = 'source-over';
  // the body: translucent, warm toward the chest
  ctx.fillStyle = grad([[0, 'rgba(255,232,224,.16)'], [0.3, 'rgba(255,214,206,.16)'], [0.62, 'rgba(226,196,236,.13)'], [1, 'rgba(196,178,236,.12)']]);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const mx = opt.midX ?? 0, mw = H * 0.09;
  if (!opt.horizontal) {
    const mid = ctx.createLinearGradient(mx - mw, 0, mx + mw, 0);
    mid.addColorStop(0, 'rgba(255,255,255,0)');
    mid.addColorStop(0.5, `rgba(255,246,236,${(0.1 * (opt.mid ?? 1)).toFixed(3)})`);
    mid.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mid;
    ctx.fillRect(mx - mw, top - H, 2 * mw, 3 * H);
  } else {
    const mid = ctx.createLinearGradient(0, mx - mw, 0, mx + mw);
    mid.addColorStop(0, 'rgba(255,255,255,0)');
    mid.addColorStop(0.5, `rgba(255,246,236,${(0.1 * (opt.mid ?? 1)).toFixed(3)})`);
    mid.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mid;
    ctx.fillRect(top - H, mx - mw, 3 * H, 2 * mw);
  }
  ctx.restore();
  ctx.restore();
}

/** A bubble of breath (CO₂ leaving): a pearl ring with a glint and a soft glow. */
export function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, px: number, hex = PEARL_W): void {
  if (a <= 0.01 || r <= 0) return;
  glow(ctx, hex, x, y, r * 2.4, 0.22 * a);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, a);
  ctx.strokeStyle = rgba(hex, 0.75);
  ctx.lineWidth = Math.max(0.8 / px, r * 0.14);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgba(hex, 0.12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A four-pointed sparkle (growth), additively. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number): void {
  const s = starSprite();
  if (!s || a <= 0.01) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a * ga);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

/** Motes travelling along a polyline (world units): n of them, at speed (lengths a second), as soft glows. */
export function motes(ctx: CanvasRenderingContext2D, pts: readonly P[], n: number, t: number, speed: number, r: number, hex: string, a: number, seed = 0, reduced = false): void {
  if (n <= 0 || a <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const k = reduced ? (i + 0.5) / n : (hash(seed + i * 7.1) + (t * speed) / Math.max(1, n) * 0.2 + i / n) % 1;
    const [x, y] = pointOn(pts, k);
    const fade = Math.sin(Math.PI * k);
    glow(ctx, hex, x, y, r * 2.2, a * 0.5 * fade);
    ctx.fillStyle = rgba(hex, Math.min(1, a * 0.9 * fade));
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, TAU);
    ctx.fill();
  }
}

/** A point at share k (0..1) along a polyline. */
export function pointOn(pts: readonly P[], k: number): [number, number] {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
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

/** A smooth stroked line through points with a glow under it (light along a muscle's fibre, a vessel). */
export function lightLine(ctx: CanvasRenderingContext2D, pts: readonly P[], width: number, hex: string, a: number, glowA = 0.35): void {
  if (a <= 0.01) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  smoothPath(ctx, pts);
  ctx.strokeStyle = rgba(hex, a * glowA);
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.strokeStyle = rgba(hex, a);
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** The growing point's golden spark trail while a scene grows (a few sparkles round a point). */
export function growSparks(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, n: number, a: number, reduced: boolean): void {
  if (a <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const ang = hash(i * 3.3) * TAU + (reduced ? 0 : t * (0.4 + hash(i) * 0.6));
    const d = r * (0.3 + 0.9 * hash(i * 5.7 + 1));
    const tw = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7);
    sparkle(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, r * 0.22 * (0.6 + tw), a * tw);
  }
}

export { GOLD, GOLD_HI };
