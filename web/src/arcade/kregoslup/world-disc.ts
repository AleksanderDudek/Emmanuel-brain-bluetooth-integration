/**
 * One lumbar disc cut open, seen from above and in front, under the lens (DESIGN.md §24.5).  Units: millimetres
 * (≈ 50 mm across, ≈ 34 front to back, 10 high: Urban & Roberts 2003).  Its top is a cross-section: the nucleus of
 * gel a little behind the middle, ringed by the annulus's lamellae; at the front-right the outer lamellae are cut away
 * in steps, so each layer shows its collagen fibres slanting the other way from its neighbour's (≈ 60° from the
 * vertical); below lie the cartilage end plate and the top of the vertebral body.
 *
 *   jadro      the nucleus fills with water; aggrecan's brushes appear in it and catch the water (≈ 80 %)
 *   pierscien  the lamellae light one by one from the outside in, their fibres crossing
 */
import { GOLD, GOLD_HI, PEARL, glow, glowEllipse, rgba } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { BONE, WATER, WATER_HI } from './bones';
import { clamp, hash, smooth, type Pt, type Rect } from './geo';
import { counterText } from './i18n';
import { brush } from './world-segment';
import { hair } from './world-spine';

const A = 25, B = 17, H = 9, K = 0.5;
/** lamellae of the annulus (the outer 45 % of the radius), the nucleus inside */
const NL = 18;
const S_NUC = 0.5;
const ls = (i: number): number => 1 - (i * (1 - S_NUC - 0.03)) / NL;
/** The axial outline: a kidney, its back (−z) drawn in where the canal lies. */
function outline(th: number, s: number): { x: number; z: number } {
  const c = Math.cos(th), sn = Math.sin(th);
  let z = B * sn;
  if (sn < 0) z *= 1 - 0.36 * Math.pow(1 - c * c, 1.6);
  return { x: A * c * s, z: z * s };
}
/** The nucleus sits a little behind the middle. */
const NUC_Z = -2.2;
/** Seen from above and in front: the near edge (+z) lower on the screen. */
const proj = (x: number, z: number, y: number): [number, number] => [x, y + z * K];

/** Each cut lamella's gap: the outer ones cut away over a wider arc (a staircase from θ = 0.3). */
const CUT0 = 0.26, NCUT = 6;
const gapEnd = (i: number): number => (i < NCUT ? CUT0 + 1.15 - i * 0.18 : CUT0);

function ringPoint(i: number, th: number, y = 0): [number, number] {
  const o = outline(th, ls(i));
  const zc = NUC_Z * (1 - ls(i)) / (1 - S_NUC);
  return proj(o.x, o.z + zc, y);
}

/** Lamella i's top ring between its inner and outer edge, over [a, b]. */
function ringPath(i: number, a: number, b: number): Path2D {
  const p = new Path2D();
  const n = Math.max(4, Math.ceil((b - a) * 22));
  for (let k = 0; k <= n; k++) {
    const [x, y] = ringPoint(i, a + ((b - a) * k) / n);
    if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  for (let k = n; k >= 0; k--) {
    const [x, y] = ringPoint(i + 1, a + ((b - a) * k) / n);
    p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/** Lamella i's outer wall over [a, b] (front-facing angles only). */
function wallPath(i: number, a: number, b: number): Path2D {
  const p = new Path2D();
  const n = Math.max(4, Math.ceil((b - a) * 22));
  for (let k = 0; k <= n; k++) {
    const [x, y] = ringPoint(i, a + ((b - a) * k) / n, 0);
    if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  for (let k = n; k >= 0; k--) {
    const [x, y] = ringPoint(i, a + ((b - a) * k) / n, H);
    p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/** The angle ranges of a lamella that are not cut away (within [lo, hi]). */
function spans(i: number, lo: number, hi: number): [number, number][] {
  if (i >= NCUT) return [[lo, hi]];
  const out: [number, number][] = [];
  if (CUT0 > lo) out.push([lo, Math.min(hi, CUT0)]);
  if (gapEnd(i) < hi) out.push([Math.max(lo, gapEnd(i)), hi]);
  return out;
}

/** The fibres on lamella i's wall over [a, b]: slanting ≈ 60° from the vertical, alternating layer to layer. */
function fibres(ctx: CanvasRenderingContext2D, i: number, a: number, b: number, step = 1.3): void {
  const r = A * ls(i);
  const dth = ((i % 2 ? 1 : -1) * H * Math.tan(Math.PI / 3)) / r;
  ctx.save();
  ctx.clip(wallPath(i, a, b));
  ctx.beginPath();
  const lo = Math.min(a, a - dth), hi = Math.max(b, b - dth);
  for (let th = lo; th <= hi; th += step / r) {
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const [x, y] = ringPoint(i, th + dth * t, H * t);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// ── named points ──────────────────────────────────────────────────
export function discPt(name: string): Pt {
  switch (name) {
    case 'nucleus': return proj(0, NUC_Z, 0);
    case 'aggrecan': return proj(-6, NUC_Z + 2, 0);
    case 'annulus': return ringPoint(2, 2.35);
    case 'cut': return ringPoint(NCUT, CUT0 + 0.5, H * 0.45);
    default: return proj(0, 0, 0);
  }
}
export const DISC_VIEW: Rect = { x: -31, y: -13, w: 62, h: 44 };
export const NUCLEUS_VIEW: Rect = { x: -17, y: -10, w: 34, h: 20 };

// ── the aggrecan and the cells' places in the nucleus (top face) ──
const BRUSHES: readonly { x: number; z: number; a: number }[] = Array.from({ length: 34 }, (_, i) => {
  const t = hash(i * 3 + 1) * Math.PI * 2, r = Math.sqrt(hash(i * 5 + 2)) * 0.9;
  const o = outline(t, S_NUC * r);
  return { x: o.x, z: o.z + NUC_Z, a: hash(i * 7 + 3) * Math.PI };
});

function frontArc(s: number, y: number, n = 48): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const o = outline(Math.PI * (k / n), s);
    out.push(proj(o.x, o.z, y));
  }
  return out;
}

function bakeDisc(ctx: CanvasRenderingContext2D): void {
  // the vertebral body below: its front face fading down, a fine lattice of trabeculae seen through its shell
  const top = H + 0.75, depth = 11;
  const up = frontArc(1.01, top), down = frontArc(1.01, top + depth);
  const bodyP = new Path2D();
  up.forEach(([x, y], k) => (k ? bodyP.lineTo(x, y) : bodyP.moveTo(x, y)));
  for (const [x, y] of down.reverse()) bodyP.lineTo(x, y);
  bodyP.closePath();
  const bg = ctx.createLinearGradient(0, top, 0, top + depth + 8);
  bg.addColorStop(0, rgba(BONE, 0.2));
  bg.addColorStop(0.5, rgba('#d9c4f4', 0.08));
  bg.addColorStop(1, rgba(BONE, 0));
  ctx.fillStyle = bg;
  ctx.fill(bodyP);
  ctx.save();
  ctx.clip(bodyP);
  ctx.lineWidth = 0.22;
  for (let i = 0; i < 160; i++) {
    const th = hash(i * 3 + 11) * Math.PI;
    const o = outline(th, 1);
    const [x, y] = proj(o.x, o.z, top + 0.8 + hash(i * 7 + 5) * depth);
    const a = hash(i * 13) * Math.PI, l = 0.8 + hash(i * 17) * 1.4;
    ctx.strokeStyle = rgba(BONE, 0.08 + 0.1 * hash(i * 19));
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l * 0.6);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.6);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = rgba(BONE, 0.45);
  ctx.lineWidth = hair(ctx, 1);
  ctx.beginPath();
  frontArc(1.01, top).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  // the cartilage end plate: a thin translucent layer between the disc and the bone
  ctx.strokeStyle = rgba('#dff4ff', 0.6);
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  frontArc(1.0, H + 0.35).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  glow(ctx, '#7fb8ff', 0, 4, 38, 0.09);
  // the nucleus's top (out to the innermost lamella)
  const nucP = ringPathNucleus();
  ctx.fillStyle = rgba(WATER, 0.16);
  ctx.fill(nucP);
  // the lamellae from the inside out: wall (front-facing, not cut) then the top ring
  for (let i = NL - 1; i >= 0; i--) {
    const lam = i % 2 ? '#cfeeff' : '#d4c9ff';
    for (const [a, b] of spans(i, 0.02, Math.PI - 0.02)) {
      const W = wallPath(i, a, b);
      const wg = ctx.createLinearGradient(0, 0, 0, H + 8);
      wg.addColorStop(0, rgba(lam, 0.22));
      wg.addColorStop(1, rgba(lam, 0.07));
      ctx.fillStyle = '#1a1130';
      ctx.fill(W);
      ctx.fillStyle = wg;
      ctx.fill(W);
      ctx.strokeStyle = rgba(lam, i === 0 ? 0.2 : 0.34);
      ctx.lineWidth = 0.18;
      fibres(ctx, i, a, b, i === 0 ? 2.4 : 1.4);
      ctx.strokeStyle = rgba(PEARL, 0.32);
      ctx.lineWidth = hair(ctx, 0.8);
      ctx.stroke(W);
    }
    for (const [a, b] of spans(i, 0, Math.PI * 2)) {
      const R = ringPath(i, a, b);
      ctx.fillStyle = '#1b1233';
      ctx.fill(R);
      ctx.fillStyle = rgba(lam, 0.07 + 0.06 * (i % 2));
      ctx.fill(R);
    }
  }
  // the tree-ring lines of the top, faint
  ctx.strokeStyle = rgba('#e6e0ff', 0.16);
  ctx.lineWidth = hair(ctx, 0.6);
  for (let i = 0; i <= NL; i++) {
    for (const [a, b] of spans(Math.max(0, i - 1), 0, Math.PI * 2)) {
      ctx.beginPath();
      const m = Math.ceil((b - a) * 22);
      for (let k = 0; k <= m; k++) {
        const [x, y] = ringPoint(i, a + ((b - a) * k) / m);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  // the cut face where the steps begin: the layers in section, like plywood
  for (let i = 0; i < NCUT; i++) {
    const p0 = ringPoint(i, CUT0, 0), p1 = ringPoint(i + 1, CUT0, 0), p2 = ringPoint(i + 1, CUT0, H), p3 = ringPoint(i, CUT0, H);
    const F = new Path2D();
    F.moveTo(p0[0], p0[1]); F.lineTo(p1[0], p1[1]); F.lineTo(p2[0], p2[1]); F.lineTo(p3[0], p3[1]); F.closePath();
    ctx.fillStyle = '#1c1234';
    ctx.fill(F);
    ctx.fillStyle = rgba(i % 2 ? '#cfeeff' : '#d4c9ff', 0.2);
    ctx.fill(F);
  }
  // the outer rim, a line of light
  ctx.strokeStyle = rgba(PEARL, 0.55);
  ctx.lineWidth = hair(ctx, 1.1);
  for (const [a, b] of spans(0, 0, Math.PI * 2)) {
    ctx.beginPath();
    const m = Math.ceil((b - a) * 22);
    for (let k = 0; k <= m; k++) {
      const [x, y] = ringPoint(0, a + ((b - a) * k) / m);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // the nucleus again, its gel catching the light
  ctx.fillStyle = rgba(WATER, 0.1);
  ctx.fill(nucP);
  ctx.strokeStyle = rgba(WATER_HI, 0.35);
  ctx.lineWidth = hair(ctx, 1);
  ctx.stroke(nucP);
}

let nucCache: Path2D | null = null;
function ringPathNucleus(): Path2D {
  if (nucCache) return nucCache;
  const p = new Path2D();
  for (let k = 0; k <= 64; k++) {
    const th = (Math.PI * 2 * k) / 64;
    const [x, y] = ringPoint(NL, th);
    if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  nucCache = p;
  return p;
}

export const DISC: WorldPainter = {
  depth: 2,
  lens: true,
  bake(ctx) {
    bakeDisc(ctx);
  },
  draw(ctx, st) {
    if (st.scene === 'jadro') drawNucleus(ctx, st);
    else if (st.scene === 'pierscien') drawRings(ctx, st);
  },
  focusAt(scene, g) {
    if (scene === 'pierscien') {
      const i = Math.min(NL - 1, Math.floor(g * NL));
      return ringPoint(i, 2.0);
    }
    return discPt('nucleus');
  },
  counter(scene, g) {
    if (scene === 'jadro') return counterText('water', Math.round(80 * smooth(0, 0.9, g)));
    if (scene === 'pierscien') return counterText('layers', Math.min(NL, Math.floor(g * NL + 1e-6)));
    return null;
  },
};

function drawNucleus(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, e = smooth(0, 0.9, g);
  const nucP = ringPathNucleus();
  const [cx, cy] = discPt('nucleus');
  glowEllipse(ctx, WATER, cx, cy, A * S_NUC * 1.4, B * S_NUC * K * 2.6, 0, (0.15 + 0.5 * e) * (0.85 + 0.15 * st.deep));
  const gr = ctx.createRadialGradient(cx - 3, cy - 1, 0.5, cx, cy, A * S_NUC);
  gr.addColorStop(0, rgba(WATER_HI, 0.25 + 0.55 * e));
  gr.addColorStop(0.7, rgba(WATER, 0.15 + 0.35 * e));
  gr.addColorStop(1, rgba(WATER, 0.05 + 0.15 * e));
  ctx.fillStyle = gr;
  ctx.fill(nucP);
  ctx.strokeStyle = rgba(WATER_HI, 0.4 + 0.5 * e);
  ctx.lineWidth = hair(ctx, 1.3);
  ctx.stroke(nucP);
  // the aggrecan brushes appear one by one, gold while new
  const nb = smooth(0.25, 1, g) * BRUSHES.length;
  ctx.lineCap = 'round';
  for (let i = 0; i < BRUSHES.length; i++) {
    const a = clamp(nb - i);
    if (a <= 0) break;
    const b = BRUSHES[i];
    const [x, y] = proj(b.x, b.z, 0);
    ctx.strokeStyle = rgba(a < 1 ? GOLD_HI : '#fff3d6', 0.75 * a);
    ctx.lineWidth = 0.14;
    brush(ctx, x, y, b.a, 2.4);
    // the water each brush holds: two drops shimmering by it
    if (!st.reduced) {
      for (let j = 0; j < 2; j++) {
        const ph = st.time * 0.8 + i * 1.7 + j * 3.1;
        glow(ctx, WATER_HI, x + Math.cos(ph) * 1.1, y + Math.sin(ph) * 0.7, 0.55, 0.5 * a);
      }
    }
  }
  if (st.growing && !st.reduced) glow(ctx, GOLD, cx, cy, 3 + 2 * Math.sin(st.time * 3), 0.25);
}

function drawRings(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const n = st.g * NL;
  for (let i = 0; i < NL; i++) {
    const a = clamp(n - i);
    if (a <= 0) break;
    const flash = st.reduced ? 0 : clamp(1 - (n - i - 1) / 2);
    const col = flash > 0.05 ? GOLD_HI : i % 2 ? WATER_HI : '#e4dcff';
    // the outer edge of its top ring, all round
    ctx.strokeStyle = rgba(col, (0.5 + 0.4 * flash) * a);
    ctx.lineWidth = hair(ctx, 1.2 + flash);
    for (const [lo, hi] of spans(i, 0, Math.PI * 2)) {
      ctx.beginPath();
      const m = Math.ceil((hi - lo) * 22);
      for (let k = 0; k <= m; k++) {
        const [x, y] = ringPoint(i, lo + ((hi - lo) * k) / m);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // its fibres where its wall can be seen: the outer one all along the front, the inner ones in the steps
    const vis: [number, number][] = i === 0 ? spans(0, 0.05, Math.PI - 0.05) : i <= NCUT ? [[gapEnd(i), gapEnd(i - 1)]] : [];
    ctx.strokeStyle = rgba(col, (0.35 + 0.4 * flash) * a);
    ctx.lineWidth = 0.18;
    for (const [lo, hi] of vis) if (hi > lo) fibres(ctx, i, lo, hi, i === 0 ? 2.2 : 1.3);
    if (flash > 0.05) {
      const [x, y] = ringPoint(i, 2.0);
      glow(ctx, GOLD, x, y, 2.4, 0.6 * flash);
    }
  }
  // the nucleus glows quietly in the middle
  const [cx, cy] = discPt('nucleus');
  glowEllipse(ctx, WATER, cx, cy, A * S_NUC, B * S_NUC * K * 1.6, 0, 0.25 * (0.85 + 0.15 * st.deep));
}
