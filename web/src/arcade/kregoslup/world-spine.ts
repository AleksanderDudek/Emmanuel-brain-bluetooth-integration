/**
 * The spine whole, in profile, inside a body that has no features but its outline (DESIGN.md §24.5).  Drawn in
 * geo.ts's units (≈ 4 mm); the figure and the ghost of the spine are baked, what grows is drawn each frame.
 *
 *   kregi      the 33 vertebrae light one by one from the atlas to the tip of the coccyx (7 · 12 · 5 · 5 · 4)
 *   dyski      the 23 discs fill with water one by one, C2–C3 to L5–S1
 *   krzywizny  the four curves traced in light: the neck and the low back bowed forward, the chest and the sacrum back
 *   poranek    evening to morning: every disc drinks a little, the spine lengthens, the crown rises ≈ 19 mm (a ruler)
 *   napojone   all 23 discs drink at once and the spine glows whole
 *   wyprost    upright: the figure lit, the crown lifted toward the light, the spine whole
 */
import { GOLD, GOLD_HI, PEARL, glow, glowEllipse, rgba, smoothPath } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { BONE, WATER, WATER_HI, discPath, nucleusAt, sacrumPath, stillDiscPaths, stillVerts, vertShapes, type Shift, type VertShape } from './bones';
import { BODY, CROWN, DISCS, SPINE_VIEW, VERTS, clamp, hash, segMid, smooth, type Pt } from './geo';
import { counterText } from './i18n';

/** Device pixels → world units under the current transform (a hairline that stays visible at every size). */
export const hair = (ctx: CanvasRenderingContext2D, dev: number): number => dev / Math.max(1e-6, Math.abs(ctx.getTransform().a));

// ── the body ──────────────────────────────────────────────────────
function bodyPathShifted(lift: number): Path2D {
  const p = new Path2D();
  // the points above the shoulders rise with the crown; the trunk below stays
  const pts = BODY.map(([x, y]) => [x, y - lift * smooth(-40, -100, y)] as [number, number]);
  smoothPath(p, [...pts, pts[0], pts[1]]);
  p.closePath();
  return p;
}
let bodyStill: Path2D | null = null;
export const bodyPath = (): Path2D => (bodyStill ??= bodyPathShifted(0));

/** The figure: a translucent body lit from within, a rim of light warm above and pearl below, fading at the hips. */
export function drawFigure(ctx: CanvasRenderingContext2D, P: Path2D, a: number, warm = 0): void {
  glow(ctx, '#8a4fa0', -8, -40, 120, 0.16 * a);
  glow(ctx, '#ffb39a', -10, -116, 44, 0.08 * a);
  const fill = ctx.createLinearGradient(0, -145, 0, 104);
  fill.addColorStop(0, `rgba(255,214,200,${(0.13 * a).toFixed(3)})`);
  fill.addColorStop(0.45, `rgba(214,170,220,${(0.09 * a).toFixed(3)})`);
  fill.addColorStop(0.8, `rgba(170,140,220,${(0.05 * a).toFixed(3)})`);
  fill.addColorStop(1, 'rgba(160,120,220,0)');
  ctx.fillStyle = fill;
  ctx.fill(P);
  const rim = ctx.createLinearGradient(0, -145, 0, 104);
  rim.addColorStop(0, `rgba(255,${Math.round(226 + 20 * warm)},${Math.round(196 - 40 * warm)},${(0.75 * a).toFixed(3)})`);
  rim.addColorStop(0.45, `rgba(240,220,255,${(0.42 * a).toFixed(3)})`);
  rim.addColorStop(0.78, `rgba(206,190,255,${(0.2 * a).toFixed(3)})`);
  rim.addColorStop(0.95, 'rgba(200,180,255,0)');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(255,200,220,${(0.06 * a).toFixed(3)})`;
  ctx.lineWidth = hair(ctx, 7);
  ctx.stroke(P);
  ctx.strokeStyle = rim;
  ctx.lineWidth = hair(ctx, 1.3);
  ctx.stroke(P);
}

// ── the spine's ghost and its lit parts ───────────────────────────
export function ghostSpine(ctx: CanvasRenderingContext2D, verts: readonly VertShape[], discs: readonly Path2D[], sac: ReturnType<typeof sacrumPath>, a = 1): void {
  // the column's glow behind it
  for (let i = 0; i < VERTS.length; i += 3) {
    const m = segMid(VERTS[i]);
    glow(ctx, '#b49cff', m.x, m.y, 9, 0.05 * a);
  }
  const lw = hair(ctx, 1);
  ctx.lineJoin = 'round';
  for (const v of verts) {
    if (v.arch) {
      ctx.fillStyle = rgba(BONE, 0.05 * a);
      ctx.fill(v.arch);
      ctx.strokeStyle = rgba(BONE, 0.2 * a);
      ctx.lineWidth = lw;
      ctx.stroke(v.arch);
    }
  }
  ctx.fillStyle = rgba(BONE, 0.07 * a);
  ctx.fill(sac.outline);
  ctx.strokeStyle = rgba(BONE, 0.3 * a);
  ctx.lineWidth = lw;
  ctx.stroke(sac.outline);
  for (const v of verts) {
    if (v.g.region === 'S') continue;
    const bg = ctx.createLinearGradient(0, -100, 0, 90);
    bg.addColorStop(0, rgba(BONE, 0.12 * a));
    bg.addColorStop(1, rgba('#d8c8ff', 0.1 * a));
    ctx.fillStyle = bg;
    ctx.fill(v.body);
    if (v.extra) ctx.fill(v.extra);
    ctx.strokeStyle = rgba(BONE, 0.38 * a);
    ctx.lineWidth = lw;
    ctx.stroke(v.body);
    if (v.extra) ctx.stroke(v.extra);
  }
  ctx.strokeStyle = rgba(BONE, 0.16 * a);
  for (const [p, q] of sac.ridges) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }
  for (const d of discs) {
    ctx.fillStyle = rgba(WATER, 0.17 * a);
    ctx.fill(d);
    ctx.strokeStyle = rgba(WATER, 0.4 * a);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke(d);
  }
}

/** A vertebra lit: pearl from within, a bright rim, a glow; `flash` is the gold of the moment it is named. */
export function litVert(ctx: CanvasRenderingContext2D, v: VertShape, a: number, flash: number, cx: number, cy: number): void {
  if (a <= 0.01) return;
  const lw = hair(ctx, 1.2);
  glow(ctx, flash > 0.02 ? GOLD : '#efe4ff', cx, cy, v.g.depth * (0.9 + 0.5 * flash), (0.2 + 0.55 * flash) * a);
  if (v.arch) {
    ctx.fillStyle = rgba(BONE, 0.09 * a);
    ctx.fill(v.arch);
    ctx.strokeStyle = rgba(flash > 0.02 ? GOLD_HI : BONE, 0.4 * a);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke(v.arch);
  }
  ctx.fillStyle = rgba(flash > 0.3 ? '#fff1dc' : BONE, (0.34 + 0.2 * flash) * a);
  ctx.fill(v.body);
  if (v.extra) ctx.fill(v.extra);
  ctx.strokeStyle = rgba(flash > 0.02 ? GOLD_HI : PEARL, 0.92 * a);
  ctx.lineWidth = lw;
  ctx.stroke(v.body);
  if (v.extra) ctx.stroke(v.extra);
}

/** A disc full of water: aqua, the nucleus bright, a glow; `flash` the gold of the moment it fills. */
export function litDisc(ctx: CanvasRenderingContext2D, i: number, path: Path2D, a: number, flash: number, shift?: Shift, scale = 1, sheen = 0): void {
  if (a <= 0.01) return;
  const n = nucleusAt(i, shift, scale);
  glowEllipse(ctx, flash > 0.02 ? GOLD : WATER, n.x, n.y, n.rx * 2.6, n.ry * 3.2 + 1, n.rot, (0.22 + 0.5 * flash) * a);
  ctx.fillStyle = rgba(WATER, (0.34 + 0.12 * sheen) * a);
  ctx.fill(path);
  ctx.strokeStyle = rgba(flash > 0.02 ? GOLD_HI : WATER_HI, 0.85 * a);
  ctx.lineWidth = hair(ctx, 1);
  ctx.stroke(path);
  ctx.fillStyle = rgba(WATER_HI, (0.55 + 0.25 * sheen) * a);
  ctx.beginPath();
  ctx.ellipse(n.x, n.y, n.rx, Math.max(0.2, n.ry), n.rot, 0, Math.PI * 2);
  ctx.fill();
}

// ── the four curves ───────────────────────────────────────────────
/** Each curve: its stretch of the spine (segment ids), forward (lordosis) or back (kyphosis). */
const CURVES: readonly { from: string; to: string; fwd: boolean }[] = [
  { from: 'C1', to: 'T1', fwd: true },
  { from: 'T1', to: 'T12', fwd: false },
  { from: 'L1', to: 'S1', fwd: true },
  { from: 'S1', to: 'Co4', fwd: false },
];
function curvePts(k: number): Pt[] {
  const c = CURVES[k];
  const a = VERTS.find(v => v.id === c.from)!, b = VERTS.find(v => v.id === c.to)!;
  const out: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const s = a.s0 + ((b.s1 - a.s0) * i) / 24;
    const m = VERTS.find(v => v.s0 <= s && v.s1 >= s) ?? a;
    // the ribbon runs along the front of the bodies for a forward curve, behind the arches for a backward one
    const u = c.fwd ? -m.depth / 2 - 3.2 : m.depth / 2 + (m.region === 'S' || m.region === 'Co' ? 4.5 : 9.5);
    const f = segMid({ ...m, s0: s, s1: s });
    out.push([f.x + f.px * u, f.y + f.py * u]);
  }
  return out;
}
let curveCache: Pt[][] | null = null;
const curves = (): Pt[][] => (curveCache ??= CURVES.map((_, k) => curvePts(k)));
/** Where each curve's name stands (the apex of its ribbon). */
export const curveApex = (k: number): Pt => curves()[k][12];

function drawCurve(ctx: CanvasRenderingContext2D, k: number, prog: number, time: number, reduced: boolean): void {
  if (prog <= 0) return;
  const pts = curves()[k];
  const n = Math.max(2, Math.round(pts.length * prog));
  const col = CURVES[k].fwd ? WATER : '#ffb1c8';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(col, 0.22);
  ctx.lineWidth = hair(ctx, 7);
  ctx.beginPath();
  smoothPath(ctx, pts.slice(0, n));
  ctx.stroke();
  ctx.strokeStyle = rgba(col, 0.95);
  ctx.lineWidth = hair(ctx, 2);
  ctx.beginPath();
  smoothPath(ctx, pts.slice(0, n));
  ctx.stroke();
  // the drawing tip: gold while it grows
  const tip = pts[n - 1];
  if (prog < 1) glow(ctx, GOLD, tip[0], tip[1], 5, 0.8);
  // a slow pulse travelling along a finished curve
  if (prog >= 1 && !reduced) {
    const q = pts[Math.floor(((time * 0.25 + k * 0.3) % 1) * (pts.length - 1))];
    glow(ctx, col, q[0], q[1], 4, 0.5);
  }
}

// ── the evening's shorter spine ───────────────────────────────────
/** Total height the 23 discs give back overnight: 19.3 mm (Tyrrell et al. 1985) = 4.8 units of 4 mm. */
export const NIGHT_GAIN = 19.3 / 4;
const DISC_SUM = DISCS.reduce((n, d) => n + d.s1 - d.s0, 0);
/** How much thinner each disc is in the evening (a share of its thickness). */
export const EVENING_THIN = NIGHT_GAIN / DISC_SUM;

/** The slide of every point along the axis when the discs are `thin` thinner (the sacrum stays, all above sinks). */
function eveningShift(thin: number): Shift {
  return (s: number) => {
    let d = 0;
    for (const g of DISCS) if (g.s0 > s) d += (g.s1 - g.s0) * thin;
      else if (g.s1 > s) d += (g.s1 - s) * thin;
    return -d;
  };
}

// ── the painter ───────────────────────────────────────────────────
let sacStill: ReturnType<typeof sacrumPath> | null = null;
export const sac = (): ReturnType<typeof sacrumPath> => (sacStill ??= sacrumPath());

/** The vertebrae's centres, for their glows. */
export const VMID = VERTS.map(v => segMid(v));

export const SPINE: WorldPainter = {
  depth: 0,
  lens: false,
  bake(ctx, variant) {
    if (variant === 'free') {
      glow(ctx, '#7a4a9a', -6, -30, 140, 0.12);
      return;
    }
    drawFigure(ctx, bodyPath(), 1);
    ghostSpine(ctx, stillVerts(), stillDiscPaths(), sac());
    // the head is out of these views: the figure fades away at the view's top (and at the hips below)
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'destination-out';
    const top = ctx.createLinearGradient(0, SPINE_VIEW.y - 1, 0, SPINE_VIEW.y + 11);
    top.addColorStop(0, 'rgba(0,0,0,1)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(SPINE_VIEW.x - 40, SPINE_VIEW.y - 60, SPINE_VIEW.w + 80, 71);
    const bot = ctx.createLinearGradient(0, 88, 0, SPINE_VIEW.y + SPINE_VIEW.h + 1);
    bot.addColorStop(0, 'rgba(0,0,0,0)');
    bot.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = bot;
    ctx.fillRect(SPINE_VIEW.x - 40, 88, SPINE_VIEW.w + 80, 80);
    ctx.globalCompositeOperation = op;
  },
  draw(ctx, st) {
    switch (st.scene) {
      case 'kregi': return drawKregi(ctx, st);
      case 'dyski': return drawDyski(ctx, st);
      case 'krzywizny': return drawKrzywizny(ctx, st);
      case 'poranek': return drawPoranek(ctx, st);
      case 'napojone': return drawNapojone(ctx, st);
      case 'wyprost': return drawWyprost(ctx, st);
    }
  },
  focusAt(scene, g) {
    if (scene === 'kregi') {
      const i = Math.min(VERTS.length - 1, Math.floor(g * VERTS.length));
      return [VMID[i].x, VMID[i].y];
    }
    if (scene === 'dyski') {
      const i = Math.min(DISCS.length - 1, Math.floor(g * DISCS.length));
      const m = segMid(DISCS[i]);
      return [m.x, m.y];
    }
    if (scene === 'krzywizny') return curveApex(Math.min(3, Math.floor(g * 4)));
    if (scene === 'poranek') return [CROWN[0], CROWN[1] + NIGHT_GAIN * (1 - g)];
    if (scene === 'wyprost') return [CROWN[0], CROWN[1] - 1.5 * g];
    const m = segMid(DISCS[DISCS.length - 1 - Math.min(DISCS.length - 1, Math.floor(g * DISCS.length))]);
    return [m.x, m.y];
  },
  counter(scene, g) {
    if (scene === 'kregi') return counterText('verts', Math.min(33, Math.floor(g * 33 + 1e-6)));
    if (scene === 'dyski') return counterText('discs', Math.min(23, Math.floor(g * 23 + 1e-6)));
    if (scene === 'poranek') return counterText('mm', Math.round(19.3 * smooth(0, 1, g)));
    return null;
  },
};

/** Light grows with rest's depth: warmth and sheen. */
const deepA = (st: WorldState): number => 0.85 + 0.15 * st.deep;

function drawKregi(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const verts = stillVerts();
  const n = st.g * VERTS.length;
  for (let i = 0; i < verts.length; i++) {
    const a = clamp(n - i);
    if (a <= 0) break;
    const flash = st.reduced ? 0 : clamp(1 - (n - i - 1) / 2.5) * (st.growing ? 1 : 0.4);
    litVert(ctx, verts[i], a * deepA(st), flash, VMID[i].x, VMID[i].y);
  }
}

function drawDyski(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const discs = stillDiscPaths();
  const n = st.g * DISCS.length;
  for (let i = 0; i < DISCS.length; i++) {
    const a = clamp(n - i);
    if (a <= 0) break;
    const flash = st.reduced ? 0 : clamp(1 - (n - i - 1) / 2.5) * (st.growing ? 1 : 0.4);
    litDisc(ctx, i, discs[i], a * deepA(st), flash, undefined, 1, st.deep);
  }
}

function drawKrzywizny(ctx: CanvasRenderingContext2D, st: WorldState): void {
  // the spine itself a little brighter as the curves appear
  const verts = stillVerts();
  for (let i = 0; i < verts.length; i++) litVert(ctx, verts[i], 0.35 * smooth(0, 0.4, st.g), 0, VMID[i].x, VMID[i].y);
  for (let k = 0; k < 4; k++) drawCurve(ctx, k, clamp(st.g * 4 - k), st.time, st.reduced);
}

function drawNapojone(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const discs = stillDiscPaths(), verts = stillVerts();
  const g = st.g;
  // the bones warm first, then every disc drinks, a wave from the low back up (where the discs are thickest)
  for (let i = 0; i < verts.length; i++) litVert(ctx, verts[i], 0.25 + 0.55 * smooth(0, 0.5, g), 0, VMID[i].x, VMID[i].y);
  for (let i = 0; i < DISCS.length; i++) {
    const k = (DISCS.length - 1 - i) / DISCS.length;
    const a = smooth(k * 0.6, k * 0.6 + 0.4, g);
    litDisc(ctx, i, discs[i], a * deepA(st), 0, undefined, 1, st.deep);
    if (a > 0.05 && a < 1 && !st.reduced) {
      // drops of light drawn in from both sides
      const m = nucleusAt(i);
      for (let j = 0; j < 2; j++) {
        const ph = (st.time * 0.7 + hash(i * 7 + j)) % 1;
        const side = j ? 1 : -1;
        glow(ctx, WATER_HI, m.x + side * (6 - 5 * ph) * Math.cos(m.rot), m.y + side * (6 - 5 * ph) * Math.sin(m.rot), 1.2, 0.6 * (1 - ph));
      }
    }
  }
}

function drawPoranek(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const e = smooth(0, 1, st.g);
  const thin = EVENING_THIN * (1 - e);
  const shift = eveningShift(thin);
  const scale = 1 - thin;
  const lift = NIGHT_GAIN * (1 - e);
  // dawn: a warm light rising behind the figure as morning comes
  glow(ctx, '#ffcf9a', -10, -150, 90, 0.05 + 0.12 * e);
  drawFigure(ctx, bodyPathShifted(-lift), 1, e);
  const verts = vertShapes(shift, scale);
  const sacr = sacrumPath(shift);
  const discs = DISCS.map((_, i) => discPath(i, shift, scale));
  ghostSpine(ctx, verts, discs, sacr, 1);
  for (let i = 0; i < DISCS.length; i++) litDisc(ctx, i, discs[i], (0.35 + 0.6 * e) * deepA(st), 0, shift, scale, st.deep);
  // the ruler beside the head: the evening's mark and the crown now
  const x = 26, top = CROWN[1] - 4, base = CROWN[1] + NIGHT_GAIN + 3;
  ctx.strokeStyle = rgba(PEARL, 0.5);
  ctx.lineWidth = hair(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, base);
  for (let mm = 0; mm <= 30; mm += 5) {
    const y = base - 3 - mm / 4;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (mm % 10 === 0 ? 2.4 : 1.4), y);
  }
  ctx.stroke();
  const eveY = CROWN[1] + NIGHT_GAIN, nowY = CROWN[1] + lift;
  ctx.setLineDash([hair(ctx, 3), hair(ctx, 3)]);
  ctx.strokeStyle = rgba('#c8b8ff', 0.6);
  ctx.beginPath();
  ctx.moveTo(CROWN[0], eveY);
  ctx.lineTo(x, eveY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(GOLD, 0.9);
  ctx.lineWidth = hair(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(CROWN[0], nowY);
  ctx.lineTo(x + 2.4, nowY);
  ctx.stroke();
  glow(ctx, GOLD, x, nowY, 3, 0.7);
}

function drawWyprost(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const e = smooth(0, 1, st.g);
  const lift = -1.5 * e;
  const breath = st.reduced ? 0 : (st.breath - 0.5) * 0.4;
  // a soft light above the crown, and the axis of light through the body as it straightens into ease
  glow(ctx, GOLD, CROWN[0], CROWN[1] - 6 + lift, 18 + 10 * e, 0.12 + 0.35 * e);
  glow(ctx, GOLD_HI, CROWN[0], CROWN[1] - 2 + lift, 5, 0.25 * e);
  drawFigure(ctx, bodyPathShifted(1.5 * e + breath * 0.5), 1 + 0.25 * e, e);
  const verts = stillVerts(), discs = stillDiscPaths();
  ghostSpine(ctx, verts, discs, sac(), 1);
  for (let i = 0; i < verts.length; i++) litVert(ctx, verts[i], 0.3 + 0.6 * smooth(0.1, 0.7, st.g), 0, VMID[i].x, VMID[i].y);
  for (let i = 0; i < DISCS.length; i++) litDisc(ctx, i, discs[i], (0.3 + 0.65 * smooth(0.2, 0.8, st.g)) * deepA(st), 0, undefined, 1, st.deep);
  // the light of uprightness: a few soft glows rising along the spine to the crown
  if (e > 0.02) {
    for (let k = 0; k < 6; k++) {
      const v = VMID[Math.round((VERTS.length - 10) * (1 - k / 6))];
      const ph = st.reduced ? 0.5 : (st.time * 0.3 + k / 6) % 1;
      glow(ctx, GOLD, v.x, v.y, 6, 0.16 * e * Math.sin(Math.PI * ph));
    }
  }
}
