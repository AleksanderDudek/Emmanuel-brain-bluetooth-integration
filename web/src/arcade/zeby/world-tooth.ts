/**
 * The tooth in its socket (DESIGN.md §24.4): a lower first molar cut from front to back, in millimetres — the enamel
 * cap, the dentine with its tubules, the pulp with its horns and canals, the cementum on the roots, the periodontal
 * ligament 0.2 mm wide, the bone of the socket with its bright wall (the lamina dura), and the gum with its sulcus.
 * Seen through the lens; the camera glides within it to the root's side and to the gum's margin.
 *
 *   miazga    the vessels and the nerve rise through the apical foramina up the canals into the chamber
 *   wiezadlo  the ligament's fibres light one after another, slanting from the bone down to the cementum
 *   dziaslo   the junctional epithelium renews: cells rise along the enamel and shed into the sulcus; white cells pass
 *   caly      the whole tooth lights part by part: enamel, dentine, pulp, ligament, gum
 */
import type { Pt, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { AQUA, BLOOD, GOLD, GOLD_HI, PEARL, ROSE, TAU, glow, glowEllipse, polyAt, rgba } from '../kit/healthlib/paint';
import {
  APEX_D, APEX_M, BONE_BOTTOM, CEM_W, CROWN, DEJ, GUM, GUM_VIEW, PDL_W, PULP, PULP_PATHS, ROOTS, ROOT_VIEW, TOOTH,
  closedSmooth, hash, normalAt, openSmooth, part, resample, sstep,
} from './geo';
import { C, bakePx, dec, lightLine, word } from './ink';

const X = GUM.X;

// ── shapes, built once ───────────────────────────────────────────
let toothP: Path2D | null = null, enamelP: Path2D | null = null, pulpP: Path2D | null = null, rootsP: Path2D | null = null;
const tooth = () => (toothP ??= closedSmooth(TOOTH));
const pulp = () => (pulpP ??= closedSmooth(PULP));
const rootsOpen = () => (rootsP ??= openSmooth(ROOTS));
function enamel(): Path2D {
  if (enamelP) return enamelP;
  const p = openSmooth(CROWN);
  const back = [...DEJ].reverse();
  for (let i = 0; i < back.length; i++) p.lineTo(back[i][0], back[i][1]);
  p.closePath();
  return (enamelP = p);
}

/** The x of the tooth's surface at a height on one side (s = -1 mesial, 1 distal), above the furcation. */
export function surfaceX(s: -1 | 1, y: number): number {
  const line = s < 0 ? [...CROWN.slice(0, 6)].reverse().concat(ROOTS.slice(-6).reverse()) : CROWN.slice(-6).concat(ROOTS.slice(0, 6));
  // a vertical scan of the side's points (sorted by y)
  const pts = [...line].sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][1]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const k = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return x0 + (x1 - x0) * k;
    }
  }
  return pts[pts.length - 1][0];
}

/** The gum on one side: its outline (the free margin, the sulcus's wall, the attachment down to the crest, outward). */
function gumOutline(s: -1 | 1): Pt[] {
  const gap = 0.09;
  const at = (y: number, d = 0): Pt => [surfaceX(s, y) + s * d, y];
  return [
    at(GUM.margin, gap + 0.05),
    at(GUM.margin + 0.25, gap),
    at(GUM.sulcus - 0.05, gap * 0.6),
    at(GUM.sulcus),
    at(GUM.cej),
    at(-1.5),
    at(GUM.crest),
    [s * 5.25, GUM.crest - 0.02],
    [s * 6.6, -0.5],
    [s * 9, -0.42],
    [s * X, -0.36],
    [s * X, GUM.outer],
    [s * 11, -1.12],
    [s * 9, -1.4],
    [s * 7.6, -1.95],
    [s * 6.7, -2.6],
    [s * 6.0, -3.2],
    [surfaceX(s, GUM.margin) + s * 0.42, GUM.margin + 0.06],
  ];
}
const gumP: Partial<Record<string, Path2D>> = {};
function gum(s: -1 | 1): Path2D {
  const k = String(s);
  if (gumP[k]) return gumP[k]!;
  const pts = gumOutline(s);
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 7; i++) p.lineTo(pts[i][0], pts[i][1]);
  for (let i = 7; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return (gumP[k] = p);
}

/** The root surface resampled (for the ligament's fibres), each with its outward normal. */
interface Fibre { c: Pt; n: Pt; t: Pt; y: number; k: number }
let fibres: Fibre[] | null = null;
function ligament(): Fibre[] {
  if (fibres) return fibres;
  const pts = resample(ROOTS, 0.085);
  const out: Fibre[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (y < GUM.crest + 0.05) continue;
    // ROOTS runs distal-down, round, mesial-up: its left normal points out of the tooth, into the ligament
    const n = normalAt(pts, i);
    const t: Pt = [n[1], -n[0]];
    // the tangent pointing up toward the crown
    const up: Pt = t[1] < 0 ? t : [-t[0], -t[1]];
    // a little irregular, as living bundles are
    const j = (hash(i * 13 + 1) - 0.5) * 0.02;
    out.push({ c: [x + up[0] * j, y + up[1] * j], n, t: up, y, k: hash(i * 7 + 3) });
  }
  return (fibres = out);
}

// ── the still tooth ──────────────────────────────────────────────
function bakeTooth(ctx: CanvasRenderingContext2D): void {
  const px = bakePx(ctx);
  const lw = (w: number) => w / px;
  bone(ctx, px);
  // the socket's wall (lamina dura), then the ligament as a band round the roots
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(C.boneRim, 0.62);
  ctx.lineWidth = 2 * (PDL_W + CEM_W) + 0.14;
  ctx.stroke(rootsOpen());
  ctx.strokeStyle = C.pdl;
  ctx.lineWidth = 2 * (PDL_W + CEM_W);
  ctx.stroke(rootsOpen());
  // faint fibres in the ligament (bright when the scene grows them)
  if (px > 18) {
    ctx.strokeStyle = 'rgba(255,196,170,.1)';
    ctx.lineWidth = lw(1.2);
    ctx.beginPath();
    for (const f of ligament()) fibrePath(ctx, f, 0);
    ctx.stroke();
    // fibroblasts: small spindles between the fibres
    for (const f of ligament()) {
      if (f.k > 0.18) continue;
      const m = PDL_W * (0.3 + 0.4 * hash(f.y * 13));
      ctx.fillStyle = 'rgba(214,170,255,.35)';
      ctx.beginPath();
      ctx.ellipse(f.c[0] + f.n[0] * (CEM_W + m), f.c[1] + f.n[1] * (CEM_W + m), 0.045, 0.014, Math.atan2(f.t[1], f.t[0]), 0, TAU);
      ctx.fill();
    }
  }
  // dentine: warm ivory, lit from within, its tubules curving from the pulp outward
  const dg = ctx.createLinearGradient(0, -9, 0, 13);
  dg.addColorStop(0, rgba('#f6e2c2', 0.96));
  dg.addColorStop(0.45, rgba('#e8c8a0', 0.93));
  dg.addColorStop(1, rgba('#c89a80', 0.9));
  ctx.fillStyle = dg;
  ctx.fill(tooth());
  ctx.save();
  ctx.clip(tooth());
  tubules(ctx, px);
  ctx.restore();
  // cementum on the roots: a thin pearl skin
  ctx.save();
  ctx.clip(tooth());
  ctx.strokeStyle = rgba(C.cementum, 0.55);
  ctx.lineWidth = 2 * CEM_W;
  ctx.stroke(rootsOpen());
  ctx.restore();
  // enamel: pearl, a cool rim, rods running from the junction to the surface
  const eg = ctx.createLinearGradient(0, -10, 0, -2.4);
  eg.addColorStop(0, rgba(C.enamel, 0.97));
  eg.addColorStop(0.6, rgba('#e2f1fa', 0.94));
  eg.addColorStop(1, rgba(C.enamelIn, 0.86));
  ctx.fillStyle = eg;
  ctx.fill(enamel());
  ctx.save();
  ctx.clip(enamel());
  enamelRods(ctx, px);
  ctx.restore();
  ctx.strokeStyle = rgba(C.enamelRim, 0.7);
  ctx.lineWidth = lw(1.1);
  ctx.stroke(openSmooth(CROWN));
  ctx.strokeStyle = 'rgba(170,120,90,.45)';
  ctx.lineWidth = lw(0.8);
  ctx.stroke(openSmooth(DEJ));
  // the pulp: deep rose, its odontoblast rim
  const pg = ctx.createLinearGradient(0, -5, 0, 13);
  pg.addColorStop(0, '#c4587a');
  pg.addColorStop(0.4, '#a8456a');
  pg.addColorStop(1, '#7c2c50');
  ctx.fillStyle = pg;
  ctx.fill(pulp());
  ctx.strokeStyle = 'rgba(255,190,200,.35)';
  ctx.lineWidth = lw(0.9);
  ctx.stroke(pulp());
  // the gum, both sides
  for (const s of [-1, 1] as const) gumShape(ctx, s, px);
}

function fibrePath(ctx: CanvasRenderingContext2D | Path2D, f: Fibre, sway: number): void {
  // oblique fibres: from the cementum up and out to the bone (the bone end lies nearer the crown); near the crest
  // they run level or up toward the crest (alveolar crest and horizontal groups); each a gently wavy bundle
  const crestNear = sstep(0.9, -0.2, f.y - GUM.crest);
  const slant = (0.1 + 0.08 * f.k) * (1 - crestNear) - 0.05 * crestNear;
  const a: Pt = [f.c[0] + f.n[0] * CEM_W * 0.4, f.c[1] + f.n[1] * CEM_W * 0.4];
  const w = PDL_W + CEM_W * 0.7;
  const b: Pt = [f.c[0] + f.n[0] * (CEM_W + w) + f.t[0] * slant, f.c[1] + f.n[1] * (CEM_W + w) + f.t[1] * slant];
  const wv = 0.014 + 0.01 * f.k + sway;
  const p1: Pt = [a[0] + (b[0] - a[0]) / 3 + f.t[0] * wv, a[1] + (b[1] - a[1]) / 3 + f.t[1] * wv];
  const p2: Pt = [a[0] + ((b[0] - a[0]) * 2) / 3 - f.t[0] * wv, a[1] + ((b[1] - a[1]) * 2) / 3 - f.t[1] * wv];
  ctx.moveTo(a[0], a[1]);
  ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], b[0], b[1]);
}

function bone(ctx: CanvasRenderingContext2D, px: number): void {
  const p = new Path2D();
  p.moveTo(-X, -0.36);
  p.bezierCurveTo(-9, -0.42, -6.6, -0.5, -5.25, GUM.crest - 0.02);
  p.lineTo(5.25, GUM.crest - 0.02);
  p.bezierCurveTo(6.6, -0.5, 9, -0.42, X, -0.36);
  p.lineTo(X, BONE_BOTTOM);
  p.lineTo(-X, BONE_BOTTOM);
  p.closePath();
  const g = ctx.createLinearGradient(0, -0.5, 0, BONE_BOTTOM);
  g.addColorStop(0, '#5a3466');
  g.addColorStop(0.5, '#43264f');
  g.addColorStop(1, '#2a1534');
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  // spongy bone: soft marrow spaces between pale struts (finer close up)
  const fine = px > 30;
  const n = fine ? 4200 : 520;
  for (let i = 0; i < n; i++) {
    const wX = fine ? 8 : X * 0.5;
    const x = -wX + hash(i * 3 + 11) * 2 * wX, y = -0.2 + hash(i * 5 + 12) * ((fine ? 14 : BONE_BOTTOM) + 0.2);
    const r = (fine ? 0.025 : 0.14) + (fine ? 0.07 : 0.3) * hash(i * 7 + 13) ** 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.55 + 0.45 * hash(i + 14)), hash(i + 15) * 3, 0, TAU);
    ctx.fillStyle = fine ? 'rgba(40,16,48,.4)' : 'rgba(34,12,40,.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(236,214,244,.2)';
    ctx.lineWidth = 0.8 / px;
    ctx.stroke();
  }
  // the bundle bone lining the socket: lamellae parallel to the root
  const lam = new Path2D();
  for (let k = 1; k <= (fine ? 6 : 2); k++) offsetRoot(lam, PDL_W + CEM_W + 0.05 + k * (fine ? 0.05 : 0.16));
  ctx.strokeStyle = 'rgba(236,216,246,.16)';
  ctx.lineWidth = 0.9 / px;
  ctx.stroke(lam);
  ctx.restore();
  // the cortical crest
  ctx.strokeStyle = rgba(C.boneRim, 0.55);
  ctx.lineWidth = Math.max(0.08, 1.4 / px);
  ctx.beginPath();
  ctx.moveTo(-X, -0.36);
  ctx.bezierCurveTo(-9, -0.42, -6.6, -0.5, -5.25, GUM.crest - 0.02);
  ctx.moveTo(5.25, GUM.crest - 0.02);
  ctx.bezierCurveTo(6.6, -0.5, 9, -0.42, X, -0.36);
  ctx.stroke();
}

/** A line parallel to the root's surface at a distance d outside it (below the crest), added to a path. */
function offsetRoot(p: Path2D, d: number): void {
  const pts = resample(ROOTS, 0.08);
  let on = false;
  for (let i = 0; i < pts.length; i++) {
    const n = normalAt(pts, i);
    const x = pts[i][0] + n[0] * d, y = pts[i][1] + n[1] * d;
    if (y < GUM.crest + 0.1) { on = false; continue; }
    if (on) p.lineTo(x, y); else p.moveTo(x, y);
    on = true;
  }
}

function tubules(ctx: CanvasRenderingContext2D, px: number): void {
  // gentle S-curves from the pulp's wall outward; more of them close up
  const n = px > 30 ? 520 : 120;
  ctx.strokeStyle = 'rgba(150,96,78,.24)';
  ctx.lineWidth = 0.7 / px;
  ctx.beginPath();
  const wall = resample(PULP, 0.05);
  for (let i = 0; i < n; i++) {
    const j = Math.floor(hash(i * 13 + 5) * wall.length);
    const [x, y] = wall[j];
    if (y > 10.5) continue;
    const nl = normalAt(wall, j);
    // outward from the pulp (its outline's left normal points into the dentine)
    const nx = nl[0], ny = nl[1];
    const len = 1.0 + 1.6 * hash(i + 77);
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + nx * len * 0.35 + ny * 0.25, y + ny * len * 0.35 - nx * 0.25, x + nx * len * 0.7 - ny * 0.25, y + ny * len * 0.7 + nx * 0.25, x + nx * len, y + ny * len);
  }
  ctx.stroke();
}

function enamelRods(ctx: CanvasRenderingContext2D, px: number): void {
  const dej = resample(DEJ, px > 30 ? 0.09 : 0.2);
  ctx.strokeStyle = 'rgba(150,200,226,.2)';
  ctx.lineWidth = 0.6 / px;
  ctx.beginPath();
  for (let i = 0; i < dej.length; i++) {
    const [x, y] = dej[i];
    const nl = normalAt(dej, i);
    const nx = nl[0], ny = nl[1];
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + nx * 1.1 + ny * 0.12, y + ny * 1.1 - nx * 0.12, x + nx * 2.6, y + ny * 2.6);
  }
  ctx.stroke();
  // the faint lines of Retzius, parallel to the surface
  ctx.strokeStyle = 'rgba(120,170,206,.16)';
  for (let k = 1; k <= 3; k++) {
    const pts = CROWN.map((p, i): Pt => [p[0] + (DEJ[Math.min(DEJ.length - 1, Math.round((i * (DEJ.length - 1)) / (CROWN.length - 1)))][0] - p[0]) * k * 0.24, p[1] + (DEJ[Math.min(DEJ.length - 1, Math.round((i * (DEJ.length - 1)) / (CROWN.length - 1)))][1] - p[1]) * k * 0.24]);
    ctx.stroke(openSmooth(pts));
  }
}

function gumShape(ctx: CanvasRenderingContext2D, s: -1 | 1, px: number): void {
  const p = gum(s);
  const g = ctx.createLinearGradient(s * 5, -3.6, s * 9, -0.4);
  g.addColorStop(0, '#e07a98');
  g.addColorStop(0.5, '#c25a80');
  g.addColorStop(1, '#8e3459');
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  // connective tissue: collagen glints and capillary loops under the epithelium
  for (let i = 0; i < (px > 30 ? 160 : 60); i++) {
    const x = s * (5.4 + hash(i * 3 + 1) * 9), y = -2.8 + hash(i * 5 + 2) * 2.3;
    ctx.strokeStyle = 'rgba(255,214,230,.14)';
    ctx.lineWidth = 0.6 / px;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 0.2, y - 0.08, x + 0.42, y + 0.02);
    ctx.stroke();
  }
  ctx.restore();
  // the epithelium: a lighter rim along the outer surface
  const pts = gumOutline(s);
  const outer = pts.slice(11).concat([pts[0]]);
  ctx.strokeStyle = rgba(C.gumRim, 0.6);
  ctx.lineWidth = Math.max(0.05, 1.2 / px);
  ctx.stroke(openSmooth(outer));
  ctx.strokeStyle = 'rgba(255,210,224,.28)';
  ctx.lineWidth = 0.16;
  ctx.stroke(openSmooth(outer));
}

// ── what lives and grows ─────────────────────────────────────────
function drawPulp(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  const px = st.px;
  // the pulp fills with warm light
  ctx.save();
  ctx.clip(pulp());
  glow(ctx, BLOOD, 0, -2.6, 3.4 * (0.4 + 0.6 * k), 0.25 + 0.4 * k + 0.12 * st.deep);
  glowEllipse(ctx, ROSE, -3.1, 6, 0.9, 6.4, 0, 0.25 * k);
  glowEllipse(ctx, ROSE, 2.65, 6, 0.9, 6.0, 0, 0.25 * k);
  ctx.restore();
  // vessels and the nerve climbing from the foramina (the canals first, then across the chamber)
  const grow = [part(k, 0, 0.68), part(k, 0.08, 0.72), part(k, 0.6, 0.95)];
  PULP_PATHS.forEach((path, i) => {
    const kk = grow[i];
    if (kk <= 0) return;
    const pts = sub(path, kk);
    const off = (d: number): Path2D => openSmooth(pts.map((p): Pt => [p[0] + d, p[1] + (i === 2 ? d : 0)]));
    lightLine(ctx, off(-0.11), px, BLOOD, '#ff8a9a', 1.6, 0.9);
    lightLine(ctx, off(0.11), px, C.vein, '#b9aaff', 1.4, 0.8);
    lightLine(ctx, off(0), px, GOLD, C.nerve, 1.1, 0.9);
    // blood cells along the artery
    const n = 8;
    for (let j = 0; j < n; j++) {
      const u = ((st.time * 0.09 + j / n) % 1) * kk;
      const [x, y] = polyAt(path, u);
      ctx.fillStyle = 'rgba(255,120,140,.9)';
      ctx.beginPath();
      ctx.arc(x - 0.11, y, Math.max(0.03, 1.4 / px), 0, TAU);
      ctx.fill();
    }
    const tip = polyAt(path, kk);
    if (st.growing && kk < 1) glow(ctx, GOLD_HI, tip[0], tip[1], 0.7, 0.6);
  });
  // the odontoblasts' rim brightens last
  const ok = part(k, 0.55, 1);
  if (ok > 0) {
    const wall = resample(PULP, Math.max(0.12, 3.2 / px));
    ctx.fillStyle = rgba(GOLD_HI, 0.55 * ok);
    for (let i = 0; i < wall.length; i++) {
      if (hash(i * 3.1) > ok) continue;
      ctx.beginPath();
      ctx.arc(wall[i][0], wall[i][1], Math.max(0.025, 1.1 / px), 0, TAU);
      ctx.fill();
    }
  }
  // the foramina glow (where life comes in)
  glow(ctx, BLOOD, APEX_M[0], APEX_M[1], 0.8, 0.35 * part(k, 0, 0.2));
  glow(ctx, BLOOD, APEX_D[0], APEX_D[1], 0.8, 0.35 * part(k, 0.05, 0.25));
}

function sub(path: readonly Pt[], k: number): Pt[] {
  if (k >= 1) return [...path];
  const out: Pt[] = [path[0]];
  const n = 24;
  for (let i = 1; i <= n; i++) out.push(polyAt(path, (i / n) * k));
  return out;
}

/** Which fibres glow: in the ligament's scene from the crest down the view; in the whole, all together. */
function drawFibres(ctx: CanvasRenderingContext2D, st: WorldState, k: number, scene: string): void {
  const px = st.px;
  const sway = st.reduced ? 0 : 0.012 * Math.sin(st.time * 0.9) + 0.01 * (st.breath - 0.5);
  const y0 = scene === 'wiezadlo' ? ROOT_VIEW.y - 0.4 : GUM.crest;
  const span = scene === 'wiezadlo' ? ROOT_VIEW.h + 0.8 : 13.6;
  const lit = new Path2D(), front = new Path2D();
  let any = false;
  for (const f of ligament()) {
    const at = (f.y - y0) / span;
    const on = scene === 'wiezadlo' ? k * 1.05 - at - f.k * 0.05 : k - 0.15 * f.k;
    if (on <= 0) continue;
    any = true;
    fibrePath(on < 0.08 ? front : lit, f, sway * (0.6 + f.k));
  }
  if (!any) return;
  lightLine(ctx, lit, px, GOLD, GOLD_HI, 1.1, 0.75 + 0.2 * st.deep);
  lightLine(ctx, front, px, GOLD_HI, '#ffffff', 1.4, 1);
  // the cementum shines as its fibres take hold
  ctx.save();
  ctx.clip(tooth());
  lightLine(ctx, rootsOpen(), px, C.cementum, '#fff7e8', 1.3, 0.55 * k);
  ctx.restore();
}

/** The junctional epithelium renewing: cells rise along the enamel and leave into the sulcus; white cells pass. */
function drawGum(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  const px = st.px;
  for (const s of [-1, 1] as const) {
    ctx.save();
    ctx.clip(gum(s));
    glowEllipse(ctx, ROSE, s * 6.2, -2.0, 2.4, 1.1, 0, (0.22 + 0.15 * st.deep) * (0.3 + 0.7 * k));
    // capillary loops: the plexus beside the attachment, and small loops under the outer epithelium
    const loops = new Path2D();
    for (let i = 0; i < 5; i++) {
      const y = -2.75 + i * 0.42, x = surfaceX(s, Math.min(y, GUM.cej)) + s * (0.42 + 0.06 * Math.sin(i * 2.1));
      loops.moveTo(x + s * 0.22, y - 0.05);
      loops.bezierCurveTo(x - s * 0.04, y - 0.1, x - s * 0.04, y + 0.12, x + s * 0.22, y + 0.08);
    }
    for (let i = 0; i < 6; i++) {
      const x = s * (6.0 + i * 0.55), y = -2.55 + 0.42 * i * 0.55 * 0.62 + 0.25;
      loops.moveTo(x - 0.05, y + 0.3);
      loops.bezierCurveTo(x - 0.06, y + 0.02, x + 0.06, y + 0.02, x + 0.05, y + 0.3);
    }
    lightLine(ctx, loops, px, BLOOD, '#ff9aa8', 0.9, 0.22 + 0.4 * k);
    ctx.restore();
    // the junctional epithelium's band along the enamel, from the CEJ up to the sulcus's floor
    const band: Pt[] = [];
    for (let y = GUM.cej; y >= GUM.sulcus - 0.001; y -= 0.05) band.push([surfaceX(s, y) + s * 0.05, y]);
    const wide = (y: number) => 0.05 + 0.18 * part(GUM.cej - y, 0, GUM.cej - GUM.sulcus);
    ctx.fillStyle = rgba('#ffd6e2', 0.12 + 0.22 * k);
    ctx.beginPath();
    band.forEach(([x, y], i) => (i ? ctx.lineTo(x + s * wide(y), y) : ctx.moveTo(x, y)));
    for (let i = band.length - 1; i >= 0; i--) ctx.lineTo(band[i][0], band[i][1]);
    ctx.fill();
    // cells streaming up (coronally) and shedding into the sulcus
    const n = Math.round(10 + 26 * k);
    for (let i = 0; i < n; i++) {
      const u = st.reduced ? hash(i * 9 + s) : (hash(i * 9 + s) + st.time * 0.05) % 1;
      const y = GUM.cej - u * (GUM.cej - GUM.sulcus + 0.35);
      const inSulcus = y < GUM.sulcus;
      const x = surfaceX(s, Math.max(GUM.sulcus, y)) + s * (0.05 + (inSulcus ? 0.05 : wide(y) * hash(i * 3 + 1)));
      const a = inSulcus ? 0.6 * (1 - (GUM.sulcus - y) / 0.35) : 0.75;
      ctx.fillStyle = rgba('#ffe4ec', a * (0.35 + 0.65 * k));
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.02, 1.5 / px), Math.max(0.014, 1 / px), 0.3 * s, 0, TAU);
      ctx.fill();
    }
    // white cells (neutrophils) passing from the loops through the epithelium into the sulcus
    const w = Math.round(2 + 6 * k);
    for (let i = 0; i < w; i++) {
      const u = st.reduced ? hash(i * 5 + 2 * s) : (hash(i * 5 + 2 * s) + st.time * 0.035) % 1;
      const from: Pt = [s * (5.8 + 0.4 * hash(i + 31)), -1.9];
      const to: Pt = [surfaceX(s, GUM.sulcus - 0.15) + s * 0.05, GUM.sulcus - 0.2];
      const x = from[0] + (to[0] - from[0]) * u, y = from[1] + (to[1] - from[1]) * u + 0.15 * Math.sin(u * 7 + i);
      glow(ctx, PEARL, x, y, Math.max(0.06, 4 / px), 0.5 * k);
      ctx.fillStyle = rgba('#ffffff', 0.85 * k);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.025, 1.4 / px), 0, TAU);
      ctx.fill();
    }
    // the sulcus's fluid: a thread of aqua light
    const sul = openSmooth([[surfaceX(s, GUM.margin) + s * 0.06, GUM.margin], [surfaceX(s, GUM.sulcus) + s * 0.04, GUM.sulcus]]);
    lightLine(ctx, sul, px, AQUA, '#e8fbff', 1.2, 0.3 + 0.5 * k);
  }
}

function drawEnamel(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  if (k <= 0) return;
  const sweep = st.reduced ? 0.5 : (st.time * 0.08) % 1;
  ctx.save();
  ctx.clip(enamel());
  glow(ctx, PEARL, 0, -8, 5 * k, 0.28 * k + 0.08 * st.deep);
  const sx = -6 + 12 * sweep;
  glowEllipse(ctx, C.enamelRim, sx, -8.2, 1.4, 3.2, 0.5, 0.35 * k);
  ctx.restore();
  lightLine(ctx, openSmooth(CROWN), st.px, C.saliva, '#f2fdff', 1.3, 0.55 * k);
}

function drawDentine(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  if (k <= 0) return;
  ctx.save();
  ctx.clip(tooth());
  glowEllipse(ctx, '#ffcf8a', 0, -4, 5, 4, 0, (0.2 + 0.06 * st.deep) * k);
  glowEllipse(ctx, '#ffcf8a', -3.2, 6, 1.6, 6, 0, 0.14 * k);
  glowEllipse(ctx, '#ffcf8a', 3, 6, 1.6, 6, 0, 0.14 * k);
  ctx.restore();
}

function drawTooth(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  // the breath's gentle life in rest, a sheen in "after"
  if (st.scene === 'miazga') {
    drawDentine(ctx, st, 0.25 + 0.25 * st.deep);
    drawPulp(ctx, st, g);
  } else if (st.scene === 'wiezadlo') {
    drawPulp(ctx, st, 0.85);
    drawFibres(ctx, st, g, 'wiezadlo');
  } else if (st.scene === 'dziaslo') {
    drawEnamel(ctx, st, 0.35);
    drawGum(ctx, st, g);
  } else {
    drawEnamel(ctx, st, part(g, 0, 0.25));
    drawDentine(ctx, st, part(g, 0.18, 0.42));
    if (g > 0.36) drawPulp(ctx, st, part(g, 0.36, 0.64));
    if (g > 0.58) drawFibres(ctx, st, part(g, 0.58, 0.84), 'caly');
    if (g > 0.8) drawGum(ctx, st, part(g, 0.8, 1));
  }
  if (st.after > 0 && !st.reduced) {
    const a = 0.12 + 0.08 * Math.sin(st.time * 1.3);
    glow(ctx, GOLD, 0, -3, 9, a * 0.5);
  }
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'miazga') {
    if (g < 0.6) return polyAt(PULP_PATHS[0], part(g, 0, 0.68));
    return polyAt(PULP_PATHS[2], part(g, 0.6, 0.95));
  }
  if (scene === 'wiezadlo') {
    const y = ROOT_VIEW.y + 0.3 + (ROOT_VIEW.h - 0.6) * Math.min(1, g);
    return [surfaceX(-1, Math.min(y, 5)) - 0.12 + (y > 5 ? (y - 5) * 0.08 : 0), y];
  }
  if (scene === 'dziaslo') return [surfaceX(-1, GUM.sulcus + 0.25) - 0.2, GUM.sulcus + 0.25];
  // the whole: enamel, dentine, pulp, ligament, gum
  if (g < 0.22) return [-2.6, -8.6];
  if (g < 0.4) return [-1.2, -5.6];
  if (g < 0.62) return [0, -2.4];
  if (g < 0.82) return [-4.9, 5];
  return [-5.6, -2.8];
}

function counter(scene: string, g: number): string | null {
  if (scene === 'wiezadlo' && g > 0.25) return word('cnt.pdl', { mm: dec(0.2) });
  if (scene === 'dziaslo' && g > 0.25) return word('cnt.je');
  if (scene === 'miazga' && g > 0.25) return word('cnt.canals');
  return null;
}

export const TOOTH_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: bakeTooth,
  draw: drawTooth,
  focusAt,
  counter,
};

export { GUM_VIEW, ROOT_VIEW };
export const toothPt = {
  pulp: [0, -2.4] as Pt,
  canal: [-3.15, 6] as Pt,
  apex: APEX_M,
  enamel: [-3.4, -9.2] as Pt,
  dentine: [-1.6, -6.0] as Pt,
  pdl: [-4.98, 5.2] as Pt,
  cementum: [-4.79, 4.4] as Pt,
  bone: [-6.4, 6.2] as Pt,
  gum: [-6.6, -2.3] as Pt,
  sulcus: [surfaceX(-1, -3.3) - 0.05, -3.3] as Pt,
  je: [surfaceX(-1, -2.7) - 0.1, -2.7] as Pt,
  cej: [surfaceX(-1, -2.4), -2.4] as Pt,
  crest: [-5.6, -0.55] as Pt,
};
