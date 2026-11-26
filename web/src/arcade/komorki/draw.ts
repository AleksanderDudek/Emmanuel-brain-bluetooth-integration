/**
 * Każda komórka's shared strokes (DESIGN.md §24): the shapes that several of its worlds draw — a soft irregular cell,
 * a mitochondrion at cell scale (two membranes, the inner folded into cristae, lit from within when it works), a
 * small sparkle of growth, the staggered reveal of a row of things — on top of the section's painting kit
 * (kit/healthlib/paint.ts).  Every world draws in its own units; line widths follow `px` (screen px per unit) where a
 * hairline must stay a hairline.
 */
import { clamp } from '../kit/juice';
import { GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba, smoothPath, starSprite } from '../kit/healthlib/paint';

export { clamp };
export type P2 = [number, number];

/** A smooth step 0..1 (cubic). */
export const smooth = (t: number): number => {
  const k = clamp(t);
  return k * k * (3 - 2 * k);
};

/** The i-th of n things revealed along a growth g: each takes `span` of it, starting in turn. */
export function stagger(g: number, i: number, n: number, span = 0.35, from = 0, to = 1): number {
  const room = Math.max(0.0001, to - from - span);
  const start = from + (n <= 1 ? 0 : (i / (n - 1)) * room);
  return smooth((g - start) / span);
}

/** A part of a growth between a and b, eased (0 before a, 1 after b). */
export const phase = (g: number, a: number, b: number): number => smooth((g - a) / Math.max(0.0001, b - a));

/** A soft irregular closed outline round (cx, cy) with radii rx, ry: a living cell, never a perfect ellipse. */
export function blobPath(cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.07, n = 16, rot = 0): Path2D {
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + wob * (hash(seed * 31 + i * 7) - 0.5) * 2;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  const p = new Path2D();
  const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

/** A capsule (a mitochondrion's outline) centred at the origin along x: length len, width wid. */
export function capsulePath(len: number, wid: number): Path2D {
  const r = wid / 2, h = Math.max(0, len / 2 - r);
  const p = new Path2D();
  p.moveTo(-h, -r);
  p.lineTo(h, -r);
  p.arc(h, 0, r, -Math.PI / 2, Math.PI / 2);
  p.lineTo(-h, r);
  p.arc(-h, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
  p.closePath();
  return p;
}

/**
 * A mitochondrion at cell scale (centre x, y; length, width, turned by rot): the outer membrane a pearl rim, the
 * matrix warm, the cristae as folds from both sides.  `lit` (0..1) is its work: the matrix glows gold, the folds catch
 * light.  `old` dims it to a tired brown-grey with broken folds (a worn one, for autophagy).
 */
export function drawMito(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number, rot: number, lit: number, opts: { old?: number; seed?: number; px?: number; alpha?: number } = {}): void {
  const old = opts.old ?? 0, seed = opts.seed ?? 1, a = opts.alpha ?? 1;
  if (a <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= a;
  const cap = capsulePath(len, wid);
  const body = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2);
  const warm = old > 0.5 ? ['#6a5560', '#4a3646', '#3a2a38'] : ['#ff9e7a', '#c8506a', '#7a2a58'];
  body.addColorStop(0, rgba(warm[0], 0.85 - 0.25 * old));
  body.addColorStop(0.5, rgba(warm[1], 0.8 - 0.2 * old));
  body.addColorStop(1, rgba(warm[2], 0.85));
  ctx.fillStyle = body;
  ctx.fill(cap);
  // the cristae: folds from either side, broken in a worn one
  ctx.save();
  ctx.clip(cap);
  const n = Math.max(3, Math.round(len / (wid * 0.42)));
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const fx = -len / 2 + wid * 0.45 + (i + 0.5) * ((len - wid * 0.9) / n);
    const top = i % 2 === 0;
    const reach = wid * (0.5 + 0.22 * hash(seed * 13 + i)) * (old > 0.5 && hash(seed + i * 3) > 0.5 ? 0.35 : 1);
    const y0 = top ? -wid / 2 : wid / 2, y1 = top ? -wid / 2 + reach : wid / 2 - reach;
    ctx.strokeStyle = old > 0.5 ? 'rgba(210,190,200,.35)' : rgba(lit > 0.05 ? GOLD_HI : '#ffd0c0', 0.45 + 0.45 * lit);
    ctx.lineWidth = Math.max(wid * 0.09, 0.6 / (opts.px ?? 4));
    ctx.beginPath();
    ctx.moveTo(fx, y0);
    ctx.bezierCurveTo(fx + wid * 0.08, (y0 * 2 + y1) / 3, fx - wid * 0.08, (y0 + 2 * y1) / 3, fx, y1);
    ctx.stroke();
  }
  ctx.restore();
  // the outer membrane: a bright pearl rim
  ctx.strokeStyle = old > 0.5 ? 'rgba(220,200,210,.45)' : rgba('#ffe6dc', 0.75);
  ctx.lineWidth = Math.max(wid * 0.08, 0.7 / (opts.px ?? 4));
  ctx.stroke(cap);
  ctx.restore();
  if (lit > 0.01) {
    glowEllipse(ctx, GOLD, x, y, len * 0.85, wid * 1.5, rot, 0.55 * lit * a);
    glow(ctx, GOLD_HI, x, y, wid * 0.8, 0.35 * lit * a);
  }
}

/** A small four-pointed glint at (x, y), size r (world units), alpha a: a sparkle of growth. */
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

/** A soft round dot with a lit rim (a vesicle, a granule): fill colour, rim colour, alpha. */
export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, rim: string | null, a = 1, rimW = 0.4): void {
  if (a <= 0.01 || r <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = rgba(fill, a);
  ctx.fill();
  if (rim) {
    ctx.strokeStyle = rgba(rim, a * 0.9);
    ctx.lineWidth = rimW;
    ctx.stroke();
  }
}

/** A smooth stroke through points (alpha, colour, width). */
export function strokeThrough(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], color: string, width: number, a = 1): void {
  if (pts.length < 2 || a <= 0.01) return;
  const p = new Path2D();
  smoothPath(p, pts);
  ctx.strokeStyle = rgba(color, a);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(p);
}

/** The first share k (0..1) of a polyline, as points (for a path drawn as it grows). */
export function partOf(pts: readonly (readonly [number, number])[], k: number): P2[] {
  if (k <= 0 || pts.length < 2) return [];
  let total = 0;
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let want = clamp(k) * total;
  const out: P2[] = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) {
    const d = seg[i - 1];
    if (want >= d) {
      out.push([pts[i][0], pts[i][1]]);
      want -= d;
    } else {
      const f = d > 0 ? want / d : 0;
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
      break;
    }
  }
  return out;
}

/** A deterministic scatter of n points inside a path's bounding ellipse (rejecting those outside the ellipse). */
export function scatter(n: number, cx: number, cy: number, rx: number, ry: number, seed: number, keep?: (x: number, y: number) => boolean): P2[] {
  const out: P2[] = [];
  for (let i = 0, tries = 0; out.length < n && tries < n * 12; tries++, i++) {
    const x = cx + (hash(seed + i * 2.13) * 2 - 1) * rx, y = cy + (hash(seed * 3 + i * 5.71) * 2 - 1) * ry;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
    if (keep && !keep(x, y)) continue;
    out.push([x, y]);
  }
  return out;
}
