/**
 * The face in profile (DESIGN.md §24.4): no features but the line of the face itself (anyone can see themselves),
 * facing left, seen through the lens, the teeth faint through the cheek, the jaw's faint bone, and the three pairs of great salivary glands
 * with their ducts — the parotid before the ear (its duct across the cheek to the upper second molar), the
 * submandibular under the jaw (its duct forward to the floor of the mouth), the sublingual under the tongue — and
 * the many small glands of the lips, cheeks and palate.  Units: about 2 mm (the outline shared with Każdy włos).
 *
 *   zrodla  the glands light one after another, their ducts carrying saliva to the mouth
 *   kapiel  all of them flow; a clear wave washes along the teeth, one after another
 */
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { AQUA, GOLD, PEARL, TAU, glow, glowEllipse, hash, polyAt, rgba } from '../kit/healthlib/paint';
import { closedSmooth, openSmooth, part, sstep } from './geo';
import { C, bakePx, lightLine, word } from './ink';

/** The profile's outline as cubic segments (from Każdy włos's geo.ts: the nape, the crown, the face, the throat). */
const PROFILE: readonly Pt[] = [
  [31, 76],
  [30, 52], [40, 34], [45, 14],
  [49, -4], [49, -30], [39, -48],
  [29, -62], [8, -66], [-8, -64],
  [-26, -61], [-38, -48], [-40, -30],
  [-41, -22], [-41, -17], [-43, -12],
  [-46, -6], [-50, 1], [-52, 6],
  [-53, 9], [-50, 11.5], [-45.5, 12],
  [-46.5, 15], [-46.8, 18], [-45, 20.5],
  [-46, 24], [-45.6, 27.5], [-43, 29.5],
  [-42.5, 33], [-43.5, 39], [-39, 44],
  [-35, 47.5], [-28, 49], [-21, 51],
  [-18, 58], [-17, 67], [-16, 76],
];
const EAR: readonly Pt[] = [
  [9, -6],
  [13, -12], [24, -11], [24, -1],
  [24, 6], [21, 13], [16, 15],
  [12, 17], [9, 14], [9, 10],
];
function cubic(pts: readonly Pt[], close: boolean): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i + 2 < pts.length; i += 3) p.bezierCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i + 2][0], pts[i + 2][1]);
  if (close) p.closePath();
  return p;
}
let headP: Path2D | null = null;
const head = () => (headP ??= cubic(PROFILE, true));

export const FACE_VIEW: Rect = { x: -60, y: -14, w: 92, h: 70 };
export const MOUTH_VIEW: Rect = { x: -56, y: -2, w: 56, h: 44 };

// ── the teeth through the cheek ──────────────────────────────────
/** Teeth in profile, front to back: x of the middle, width (units), and kind (crown shapes differ). */
const ROW: readonly { x: number; w: number; kind: 'i' | 'c' | 'p' | 'm' }[] = [
  { x: -42.6, w: 2.6, kind: 'i' }, { x: -40.4, w: 2.4, kind: 'i' }, { x: -37.9, w: 2.9, kind: 'c' },
  { x: -35.0, w: 3.0, kind: 'p' }, { x: -31.9, w: 3.0, kind: 'p' }, { x: -27.9, w: 4.6, kind: 'm' },
  { x: -23.4, w: 4.3, kind: 'm' }, { x: -19.2, w: 4.0, kind: 'm' },
];
const OCC = 21.6;
/** The occlusal line curves gently (the curve of Spee): lower toward the back. */
const occ = (x: number): number => OCC + 0.012 * (x + 44) * (x + 44) * 0.03;
function crown(x: number, w: number, kind: string, up: boolean): Path2D {
  const s = up ? -1 : 1, h = kind === 'm' ? 3.4 : kind === 'p' ? 3.8 : kind === 'c' ? 4.6 : 4.3;
  const W = w - 0.7, y0 = occ(x) + s * 0.12, y1 = y0 + s * h;
  const tilt = kind === 'i' ? (up ? -0.9 : -0.5) : 0;
  const p = new Path2D();
  // the neck (narrower), down the sides, then the biting edge by kind
  p.moveTo(x - W * 0.36 + tilt, y1);
  p.bezierCurveTo(x - W * 0.52 + tilt * 0.6, y1 - s * h * 0.35, x - W * 0.56, y0 - s * h * 0.25, x - W * 0.48, y0);
  if (kind === 'c') p.quadraticCurveTo(x - W * 0.2, y0 + s * 0.2, x, y0 + s * 0.9);
  else if (kind === 'm') {
    p.quadraticCurveTo(x - W * 0.3, y0 + s * 0.45, x - W * 0.12, y0 + s * 0.1);
    p.quadraticCurveTo(x, y0 - s * 0.05, x + W * 0.12, y0 + s * 0.1);
    p.quadraticCurveTo(x + W * 0.3, y0 + s * 0.45, x + W * 0.48, y0);
  } else if (kind === 'p') p.quadraticCurveTo(x, y0 + s * 0.6, x + W * 0.48, y0);
  else p.lineTo(x + W * 0.48, y0);
  if (kind === 'c') p.quadraticCurveTo(x + W * 0.2, y0 + s * 0.2, x + W * 0.48, y0);
  p.bezierCurveTo(x + W * 0.56, y0 - s * h * 0.25, x + W * 0.52 + tilt * 0.6, y1 - s * h * 0.35, x + W * 0.36 + tilt, y1);
  p.closePath();
  return p;
}
interface FTooth { p: Path2D; x: number; y: number; i: number; up: boolean; w: number; kind: string }
let teethL: FTooth[] | null = null;
/** The teeth, built on first use (no Path2D before a canvas exists). */
function teeth(): FTooth[] {
  if (teethL) return teethL;
  const out: FTooth[] = [];
  for (const up of [true, false]) ROW.forEach((t, i) => {
    const x = t.x + (up ? 0 : 0.7);
    out.push({ p: crown(x, t.w, t.kind, up), x, y: occ(x) + (up ? -2 : 2), i, up, w: t.w, kind: t.kind });
  });
  return (teethL = out);
}

function bakeTeeth(ctx: CanvasRenderingContext2D, px: number): void {
  for (const t of teeth()) {
    const s = t.up ? -1 : 1, y0 = occ(t.x), neck = y0 + s * 4;
    // roots, faint in their bone (two for molars)
    ctx.strokeStyle = 'rgba(236,222,240,.07)';
    ctx.lineWidth = t.kind === 'm' ? 0.9 : 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const dx of t.kind === 'm' ? [-t.w * 0.22, t.w * 0.22] : [0]) {
      ctx.moveTo(t.x + dx, neck);
      ctx.quadraticCurveTo(t.x + dx * 1.1, neck + s * 4, t.x + dx * 0.7 + 0.3, neck + s * (t.kind === 'c' ? 9.5 : 7.5));
    }
    ctx.stroke();
    const g = ctx.createLinearGradient(0, y0, 0, neck);
    g.addColorStop(0, 'rgba(250,253,255,.42)');
    g.addColorStop(0.55, 'rgba(226,240,250,.26)');
    g.addColorStop(1, 'rgba(206,222,240,.1)');
    ctx.fillStyle = g;
    ctx.fill(t.p);
    ctx.strokeStyle = 'rgba(191,243,255,.3)';
    ctx.lineWidth = 0.8 / px + 0.02;
    ctx.stroke(t.p);
  }
  // the gum along the necks, scalloped between the teeth
  for (const up of [true, false]) {
    const s = up ? -1 : 1;
    const gp = new Path2D();
    const row = teeth().filter(t => t.up === up);
    row.forEach((t, i) => {
      const y = occ(t.x) + s * 3.9;
      const xl = t.x - t.w / 2, xr = t.x + t.w / 2;
      if (i === 0) gp.moveTo(xl, y + s * 0.2);
      gp.quadraticCurveTo(t.x, y + s * 1.3, xr, y + s * 0.2);
    });
    ctx.strokeStyle = 'rgba(216,106,140,.22)';
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.stroke(gp);
  }
}

// ── the glands and their ducts ───────────────────────────────────
const PAROTID: readonly Pt[] = [[-2, 2], [5, -1], [11, 1], [13, 8], [12, 17], [10, 25], [6, 31], [1, 29], [-1, 22], [-3, 14]];
const SUBMAND: readonly Pt[] = [[-14, 37], [-8, 34.5], [-1, 35], [4, 38], [3, 43], [-3, 46], [-10, 45], [-15, 41]];
const SUBLING: readonly Pt[] = [[-34, 30], [-28, 28.8], [-20, 29.4], [-19, 31.2], [-26, 32.4], [-33, 32]];
const DUCT_P: readonly Pt[] = [[-1.5, 12], [-6, 12.6], [-11, 13.6], [-15, 15], [-18.5, 16.4], [-20.6, 17.4]];
const DUCT_S: readonly Pt[] = [[-11, 37], [-17, 34.5], [-24, 32.6], [-31, 30.2], [-37.4, 27.6]];
const DUCT_L: readonly Pt[] = [[-27, 29], [-28.4, 27.2], [-29.6, 25.8]];
/** Small glands: in the lips, the cheek and the palate. */
const MINOR: Pt[] = [];
for (let i = 0; i < 26; i++) {
  const k = hash(i * 7 + 2);
  if (i < 8) MINOR.push([-44.4 + hash(i) * 1.6, 16.5 + k * 11]);
  else if (i < 18) MINOR.push([-40 + (i - 8) * 2.6, 13.4 + hash(i * 3) * 1.2]);
  else MINOR.push([-30 + (i - 18) * 2.2, 20 + hash(i * 5) * 4.4 - 2.2]);
}

let glandsL: { parotid: Path2D; submand: Path2D; subling: Path2D } | null = null;
const glandPaths = () => (glandsL ??= { parotid: closedSmooth(PAROTID), submand: closedSmooth(SUBMAND), subling: closedSmooth(SUBLING) });

function bakeFace(ctx: CanvasRenderingContext2D): void {
  const px = bakePx(ctx);
  // the head: a quiet, warm silhouette lit from within, its outline in pearl
  const hg = ctx.createRadialGradient(-20, 18, 4, -10, 10, 90);
  hg.addColorStop(0, '#4a2440');
  hg.addColorStop(0.6, '#341a3a');
  hg.addColorStop(1, '#22122c');
  ctx.fillStyle = hg;
  ctx.fill(head());
  ctx.save();
  ctx.clip(head());
  // the jaw's bone, a faint edge, and the cheek's muscle
  const jaw = new Path2D();
  jaw.moveTo(-41, 31);
  jaw.bezierCurveTo(-41, 40, -36, 42, -26, 41);
  jaw.bezierCurveTo(-14, 40, -2, 39, 4, 37);
  jaw.bezierCurveTo(7, 34, 7, 26, 6, 18);
  jaw.bezierCurveTo(5, 12, 6, 7, 8, 4);
  ctx.strokeStyle = 'rgba(232,212,238,.12)';
  ctx.lineWidth = 0.9;
  ctx.stroke(jaw);
  glowEllipse(ctx, '#a04a72', -6, 20, 9, 13, -0.2, 0.18);
  // the tongue's mass under the palate, faint
  const tongue = new Path2D();
  tongue.moveTo(-41, 25.5);
  tongue.bezierCurveTo(-36, 22.6, -22, 21.8, -10, 23.4);
  tongue.bezierCurveTo(-4, 26, -4, 33, -10, 35);
  tongue.bezierCurveTo(-22, 34.5, -34, 33, -41, 25.5);
  ctx.fillStyle = 'rgba(214,106,140,.2)';
  ctx.fill(tongue);
  bakeTeeth(ctx, px);
  // the glands at rest: lobules faintly drawn
  const glands = glandPaths();
  for (const [p, c] of [[glands.parotid, '#d9a0c8'], [glands.submand, '#d9a0c8'], [glands.subling, '#d9a0c8']] as const) {
    ctx.fillStyle = rgba(c, 0.18);
    ctx.fill(p);
    ctx.strokeStyle = rgba(c, 0.4);
    ctx.lineWidth = 0.8 / px + 0.05;
    ctx.stroke(p);
  }
  lobules(ctx, PAROTID, 30, 1);
  lobules(ctx, SUBMAND, 18, 2);
  lobules(ctx, SUBLING, 8, 3);
  for (const d of [DUCT_P, DUCT_S, DUCT_L]) {
    ctx.strokeStyle = 'rgba(159,233,255,.22)';
    ctx.lineWidth = 0.8;
    ctx.stroke(openSmooth(d));
  }
  ctx.restore();
  // the ear's outline, the profile's rim
  ctx.strokeStyle = 'rgba(246,240,255,.35)';
  ctx.lineWidth = 1.2 / px + 0.1;
  ctx.stroke(cubic(EAR, false));
  ctx.strokeStyle = 'rgba(246,240,255,.75)';
  ctx.lineWidth = 1.4 / px + 0.12;
  ctx.stroke(head());
}

function lobules(ctx: CanvasRenderingContext2D, poly: readonly Pt[], n: number, seed: number): void {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  ctx.save();
  ctx.clip(closedSmooth(poly));
  for (let i = 0; i < n * 3; i++) {
    const x = x0 + hash(i * 5 + seed * 31) * (x1 - x0), y = y0 + hash(i * 7 + seed * 17) * (y1 - y0);
    ctx.strokeStyle = 'rgba(255,214,236,.22)';
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.arc(x, y, 0.9 + hash(i + seed) * 0.8, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// ── what flows ───────────────────────────────────────────────────
function gland(ctx: CanvasRenderingContext2D, st: WorldState, poly: readonly Pt[], p: Path2D, duct: readonly Pt[], k: number, seed: number): void {
  if (k <= 0) return;
  const px = st.px;
  const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  ctx.save();
  ctx.clip(head());
  ctx.save();
  ctx.clip(p);
  glowEllipse(ctx, '#ffc2e0', cx, cy, (Math.max(...xs) - Math.min(...xs)) * 0.7, (Math.max(...ys) - Math.min(...ys)) * 0.7, 0, (0.45 + 0.15 * st.deep) * k);
  ctx.restore();
  lightLine(ctx, p, px, '#ffc2e0', '#fff0f8', 1.2, 0.6 * k);
  // the duct fills, then drops travel along it into the mouth
  const dk = part(k, 0.3, 1);
  if (dk > 0) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) pts.push(polyAt(duct, (i / 20) * dk));
    lightLine(ctx, openSmooth(pts), px, AQUA, '#e9fcff', 1.4, 0.85);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const u = st.reduced ? (i + 0.5) / n : (st.time * 0.22 + i / n + seed * 0.13) % 1;
      if (u > dk) continue;
      const [x, y] = polyAt(duct, u);
      glow(ctx, AQUA, x, y, 1.6, 0.7);
    }
    if (dk >= 1) {
      const end = duct[duct.length - 1];
      glow(ctx, AQUA, end[0], end[1], 3.2, 0.45 + 0.15 * Math.sin(st.time * 2 + seed));
    }
  }
  ctx.restore();
}

function saliva(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  if (k <= 0) return;
  ctx.save();
  ctx.clip(head());
  glowEllipse(ctx, AQUA, -31, OCC + 0.6, 14, 3.4, 0.04, 0.3 * k + 0.08 * st.deep);
  ctx.restore();
}

function drawFace(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, glands = glandPaths();
  if (st.scene === 'zrodla') {
    gland(ctx, st, PAROTID, glands.parotid, DUCT_P, part(g, 0, 0.36), 0);
    gland(ctx, st, SUBMAND, glands.submand, DUCT_S, part(g, 0.28, 0.64), 1);
    gland(ctx, st, SUBLING, glands.subling, DUCT_L, part(g, 0.56, 0.84), 2);
    const mk = part(g, 0.78, 1);
    if (mk > 0) for (const [i, [x, y]] of MINOR.entries()) if (hash(i * 3.3) < mk) glow(ctx, '#ffd2ea', x, y, 1.1, 0.7);
    saliva(ctx, st, part(g, 0.2, 1));
  } else {
    // the whole: every gland flows, a clear wave washes the teeth one after another (front to back, then back again)
    for (const [i, [poly, p, d]] of ([[PAROTID, glands.parotid, DUCT_P], [SUBMAND, glands.submand, DUCT_S], [SUBLING, glands.subling, DUCT_L]] as const).entries()) gland(ctx, st, poly, p, d, 0.75 + 0.25 * g, i);
    saliva(ctx, st, 0.5 + 0.5 * g);
    const front = -44 + 28 * Math.min(1, g * 1.05);
    for (const t of teeth()) {
      const shine = sstep(t.x - 1.5, t.x + 1.5, front + 0.0001);
      if (shine <= 0) continue;
      // a clean sheen on the crown (no outline: lit teeth read as a smile, not as blocks)
      ctx.save();
      ctx.clip(t.p);
      glowEllipse(ctx, PEARL, t.x, occ(t.x) + (t.up ? -1.6 : 1.6), t.w * 0.45, 2.6, 0, 0.5 * shine);
      glowEllipse(ctx, C.saliva, t.x - t.w * 0.2, occ(t.x) + (t.up ? -2.6 : 2.6), 0.5, 1.8, 0.2, 0.35 * shine);
      ctx.restore();
    }
    if (g > 0 && g < 1) glowEllipse(ctx, AQUA, front, OCC, 1.6, 6.5, 0, 0.6);
  }
  if (st.after > 0 && !st.reduced) glow(ctx, GOLD, -30, OCC, 8, 0.12 + 0.06 * Math.sin(st.time));
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'zrodla') {
    if (g < 0.32) return [5, 14];
    if (g < 0.6) return [-6, 40];
    if (g < 0.82) return [-26, 30.5];
    return [-41, 20];
  }
  return [-44 + 28 * Math.min(1, g), OCC];
}

export const FACE: WorldPainter = {
  depth: 0,
  lens: true,
  bake: bakeFace,
  draw: drawFace,
  focusAt,
  counter: (scene, g) => (scene === 'zrodla' && g > 0.3 ? word('cnt.flow') : null),
};

export const facePt = {
  parotid: [6, 8] as Pt,
  submandibular: [-4, 42] as Pt,
  sublingual: [-30, 30.8] as Pt,
  minor: [-44, 22] as Pt,
  teeth: [-30, OCC] as Pt,
  molar: [-23.4, OCC - 2] as Pt,
  saliva: [-36, OCC + 1.2] as Pt,
};
