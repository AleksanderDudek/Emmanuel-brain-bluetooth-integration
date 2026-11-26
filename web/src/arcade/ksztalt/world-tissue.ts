/**
 * Fat tissue under the lens (DESIGN.md §24, Lekkość i siła): a lobule of white fat cells — each almost wholly one
 * droplet of stored fat (honey, glowing from within), its nucleus pressed flat to the edge — a capillary passing with
 * its red cells, a sympathetic nerve fibre with its beads, and the edge of a muscle fibre beyond.  World units ≈ µm.
 *
 *   sygnal    the nerve's noradrenaline (and adrenaline from the blood) reaches a fat cell; its lipases cut the
 *             droplet's triglycerides into glycerol and three fatty acids, which leave toward the capillary
 *   albumina  the fatty acids ride albumin down the capillary and pass into the muscle fibre, to its mitochondria
 *   kropla    over weeks the droplets shrink and the cells with them — the number of cells stays the same
 *   odnowa    about one cell in ten is renewed in a year: an old one is let go, a progenitor by the capillary fills
 *             with its first droplet
 *
 * (Lipolysis: StatPearls; Frühbeck 2014.  Albumin: van der Vusse 2009.  Number steady, ~10 % a year: Spalding 2008.)
 */
import { BLOOD, GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba, smoothPath } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { phase, sparkle, stagger, wave, wpx } from './draw';
import type { P } from './geo';
import { HONEY_DEEP, HONEY_FAT, PEARL_W, STEM } from './palette';

// ── the lobule ───────────────────────────────────────────────────
interface Cell { c: [number, number]; poly: [number, number][]; r: number; nuc: number; k: number }

const SPACING = 34;
/** The capillary's centre line x at a height. */
export const capX = (y: number): number => 20 + 7 * Math.sin(y / 46 + 0.6);
const CAP_R = 5.2;
/** The muscle fibre's left edge. */
const FIBRE_X = 66;

const CELLS: readonly Cell[] = (() => {
  const centres: [number, number][] = [];
  for (let row = -4; row <= 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -12 - col * SPACING * 0.88 - (row % 2 ? SPACING * 0.44 : 0) + (hash(row * 13 + col * 7) - 0.5) * 8;
      const y = row * SPACING * 0.86 + (hash(row * 5 + col * 11 + 3) - 0.5) * 8;
      if (x > capX(y) - CAP_R - 13) continue;
      centres.push([x, y]);
    }
  }
  return centres.map((c, i) => {
    // a Voronoi cell: a polygon round the centre clipped by the bisectors with its neighbours
    let poly: [number, number][] = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU;
      poly.push([c[0] + Math.cos(a) * 24, c[1] + Math.sin(a) * 24]);
    }
    for (const [j, d] of centres.entries()) {
      if (j === i || Math.hypot(d[0] - c[0], d[1] - c[1]) > 70) continue;
      poly = clip(poly, c, d);
    }
    // the capillary's side
    poly = poly.map(([x, y]) => [Math.min(x, capX(y) - CAP_R - 2.5), y] as [number, number]);
    const r = Math.sqrt(area(poly) / Math.PI);
    return { c, poly: inset(poly, c, 1.4), r, nuc: hash(i * 3.3 + 1) * TAU, k: hash(i * 7.7 + 2) };
  });
})();

function clip(poly: [number, number][], a: [number, number], b: [number, number]): [number, number][] {
  // keep the side of the bisector of a–b nearer a
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
  const side = (p: [number, number]): number => (p[0] - mx) * nx + (p[1] - my) * ny;
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
function area(poly: readonly [number, number][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}
function inset(poly: readonly [number, number][], c: readonly [number, number], d: number): [number, number][] {
  return poly.map(([x, y]) => {
    const dx = x - c[0], dy = y - c[1], l = Math.hypot(dx, dy) || 1;
    const k = Math.max(0.2, (l - d) / l);
    return [c[0] + dx * k, c[1] + dy * k];
  });
}
/** A closed smooth path through a polygon, scaled about its centre. */
function cellPath(cell: Cell, s: number): Path2D {
  const p = new Path2D();
  const c = cell.c;
  const m = cell.poly.map(([x, y]) => [c[0] + (x - c[0]) * s, c[1] + (y - c[1]) * s] as [number, number]);
  const n = m.length;
  const mid = (i: number): [number, number] => [(m[i % n][0] + m[(i + 1) % n][0]) / 2, (m[i % n][1] + m[(i + 1) % n][1]) / 2];
  const st = mid(n - 1);
  p.moveTo(st[0], st[1]);
  for (let i = 0; i < n; i++) {
    const e = mid(i);
    p.quadraticCurveTo(m[i][0], m[i][1], e[0], e[1]);
  }
  p.closePath();
  return p;
}

/** The cell the signal reaches (the scene's own), the one let go and where the new one grows. */
const nearest = (x: number, y: number): number => {
  let best = 0, d = Infinity;
  CELLS.forEach((c, i) => { const dd = Math.hypot(c.c[0] - x, c.c[1] - y); if (dd < d) { d = dd; best = i; } });
  return best;
};
export const SIGNAL_CELL = nearest(-48, -6);
const OLD_CELL = nearest(-80, 34);
const NEW_AT: [number, number] = [capX(-48) - CAP_R - 8, -48];
const NEW_CELL = nearest(NEW_AT[0], NEW_AT[1]);
const RENEWED = CELLS.map((_, i) => i).filter(i => i !== OLD_CELL && i !== NEW_CELL && i !== SIGNAL_CELL && hash(i * 5.5 + 9) < 0.11);

export const TISSUE = {
  signal: CELLS[SIGNAL_CELL].c, old: CELLS[OLD_CELL].c, fresh: NEW_AT, capX, fibreX: FIBRE_X,
  nucleus: (i: number): [number, number] => nucleusAt(CELLS[i], 1),
};

function nucleusAt(cell: Cell, s: number): [number, number] {
  // the nucleus sits pressed to the edge, toward the polygon's farthest vertex in its direction
  const dir = cell.nuc;
  let best = cell.poly[0], bd = -Infinity;
  for (const p of cell.poly) {
    const d = (p[0] - cell.c[0]) * Math.cos(dir) + (p[1] - cell.c[1]) * Math.sin(dir);
    if (d > bd) { bd = d; best = p; }
  }
  return [cell.c[0] + (best[0] - cell.c[0]) * 0.86 * s, cell.c[1] + (best[1] - cell.c[1]) * 0.86 * s];
}

/** The nerve fibre: down from the top between the cells to the signalled cell, with its beads. */
const NERVE: readonly P[] = (() => {
  const c = CELLS[SIGNAL_CELL].c;
  return [[-112, -130], [-100, -96], [-86, -70], [c[0] - 22, c[1] - 30], [c[0] - 6, c[1] - 24], [c[0] + 10, c[1] - 26]];
})();

// ── drawing the parts ────────────────────────────────────────────
function drawCell(ctx: CanvasRenderingContext2D, cell: Cell, s: number, alpha: number, px: number, lit = 0, rim = PEARL_W): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const outer = cellPath(cell, s);
  // the thin cytoplasm (a deep rose film) and the membrane
  ctx.fillStyle = 'rgba(92,30,74,.8)';
  ctx.fill(outer);
  // the droplet: honey light from within, a pearl sheen at its top
  const drop = cellPath(cell, s * 0.9);
  const [cx, cy] = cell.c;
  const R = cell.r * s;
  const g = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.32, R * 0.05, cx, cy, R * 1.02);
  g.addColorStop(0, rgba('#fff7e2', 0.92));
  g.addColorStop(0.32, rgba('#ffe0a0', 0.78 + 0.15 * lit));
  g.addColorStop(0.75, rgba(HONEY_DEEP, 0.62));
  g.addColorStop(1, rgba('#b8664e', 0.6));
  ctx.fillStyle = g;
  ctx.fill(drop);
  glow(ctx, '#ffd9a0', cx - R * 0.1, cy - R * 0.12, R * 0.9, 0.14 + 0.25 * lit);
  // the sheen: a thin crescent of light at the droplet's upper left
  ctx.strokeStyle = 'rgba(255,255,255,.32)';
  ctx.lineWidth = Math.max(0.6 / px, R * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.66, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.strokeStyle = rgba(lit > 0 ? GOLD_HI : '#ffeccc', 0.4 + 0.5 * lit);
  ctx.lineWidth = (0.7 + 0.8 * lit) / px;
  ctx.stroke(drop);
  ctx.strokeStyle = rgba(rim, 0.5);
  ctx.lineWidth = 0.8 / px;
  ctx.stroke(outer);
  // the nucleus, flat at the edge
  const [nx, ny] = nucleusAt(cell, s);
  const ang = Math.atan2(ny - cy, nx - cx) + Math.PI / 2;
  ctx.fillStyle = 'rgba(176,140,255,.75)';
  ctx.beginPath();
  ctx.ellipse(nx, ny, 4.2 * Math.max(0.7, s), 1.5, ang, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawStroma(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(36,12,36,.97)';
  ctx.fillRect(-220, -170, 440, 340);
  // collagen glints
  for (let i = 0; i < 220; i++) {
    const x = -210 + 420 * hash(i * 3 + 501), y = -160 + 320 * hash(i * 5 + 502);
    ctx.strokeStyle = i % 3 ? 'rgba(255,170,214,.07)' : 'rgba(255,214,236,.13)';
    ctx.lineWidth = wpx(ctx, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 6, y - 2 + 4 * hash(i + 503), x + 13, y + 2 * (hash(i + 504) - 0.5));
    ctx.stroke();
  }
}

function capillaryPts(): P[] {
  const pts: P[] = [];
  for (let y = -170; y <= 170; y += 10) pts.push([capX(y), y]);
  return pts;
}
function drawCapillary(ctx: CanvasRenderingContext2D): void {
  const pts = capillaryPts();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  smoothPath(ctx, pts);
  ctx.strokeStyle = 'rgba(255,120,140,.16)';
  ctx.lineWidth = CAP_R * 3.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,20,48,.95)';
  ctx.lineWidth = CAP_R * 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,170,.5)';
  ctx.lineWidth = wpx(ctx, 1.2);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    smoothPath(ctx, pts.map(([x, y]) => [x + s * CAP_R, y] as P));
    ctx.stroke();
  }
  ctx.restore();
}

function drawFibre(ctx: CanvasRenderingContext2D): void {
  // the edge of a muscle fibre: deep rose, banded by its sarcomeres, the membrane a rim of light
  ctx.fillStyle = 'rgba(150,40,80,.7)';
  ctx.fillRect(FIBRE_X, -170, 160, 340);
  for (let y = -170; y < 170; y += 7.5) {
    ctx.fillStyle = 'rgba(255,150,170,.12)';
    ctx.fillRect(FIBRE_X, y, 160, 3.2);
    ctx.fillStyle = 'rgba(255,220,230,.18)';
    ctx.fillRect(FIBRE_X, y + 5.2, 160, wpx(ctx, 0.9));
  }
  for (let x = FIBRE_X + 9; x < 230; x += 9) {
    ctx.strokeStyle = 'rgba(40,6,22,.35)';
    ctx.lineWidth = wpx(ctx, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, -170);
    ctx.lineTo(x, 170);
    ctx.stroke();
  }
  // its nuclei at the edge
  for (let i = 0; i < 4; i++) {
    const y = -120 + i * 82 + 20 * hash(i + 61);
    ctx.fillStyle = 'rgba(176,140,255,.7)';
    ctx.beginPath();
    ctx.ellipse(FIBRE_X + 3.2, y, 1.8, 6.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,214,220,.7)';
  ctx.lineWidth = wpx(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(FIBRE_X, -170);
  ctx.lineTo(FIBRE_X, 170);
  ctx.stroke();
}
/** The fibre's mitochondria (small beans between the myofibrils) where the fatty acids are going. */
const MITOS: readonly [number, number][] = Array.from({ length: 22 }, (_, i) => [FIBRE_X + 8 + 70 * hash(i * 3 + 71), -100 + 200 * hash(i * 5 + 73)] as [number, number]);

function drawNerve(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  smoothPath(ctx, NERVE);
  ctx.strokeStyle = 'rgba(255,236,200,.14)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,200,.6)';
  ctx.lineWidth = wpx(ctx, 1.3);
  ctx.stroke();
  // the beads (varicosities) where the transmitter waits
  for (let i = 2; i < 9; i++) {
    const [x, y] = along(NERVE, i / 9);
    ctx.fillStyle = 'rgba(255,240,210,.75)';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
function along(pts: readonly P[], k: number): [number, number] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  let want = Math.max(0, Math.min(1, k)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) {
      const u = seg[i] ? Math.min(1, want / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
    }
    want -= seg[i];
  }
  return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
}

/** A fatty acid: a short zigzag chain of gold (a carbon backbone), drawn at (x, y) turned by `a`. */
function fattyAcid(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, alpha: number, px: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.strokeStyle = rgba(GOLD, Math.min(1, alpha));
  ctx.lineWidth = Math.max(0.7 / px, 0.5);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const xx = -len / 2 + (len * i) / n, yy = i % 2 ? -0.9 : 0.9;
    if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
  }
  ctx.stroke();
  ctx.fillStyle = rgba('#ff9a86', alpha);
  ctx.beginPath();
  ctx.arc(-len / 2, 0.9, 0.9, 0, TAU);
  ctx.fill();
  ctx.restore();
  glow(ctx, GOLD, x, y, len * 0.8, 0.12 * alpha);
}

/** Red cells drifting down the capillary. */
function redCells(ctx: CanvasRenderingContext2D, st: WorldState, y0: number, y1: number): void {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = st.reduced ? (i + 0.5) / n : ((st.time * 0.05 + i / n + hash(i) * 0.05) % 1);
    const y = y0 + (y1 - y0) * k;
    const x = capX(y) + (hash(i * 3) - 0.5) * 3;
    ctx.fillStyle = rgba(BLOOD, 0.75);
    ctx.beginPath();
    ctx.ellipse(x, y, 3.6, 1.8, 0.3 * Math.sin(i), 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,10,40,.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, 1.6, 0.7, 0.3 * Math.sin(i), 0, TAU);
    ctx.fill();
  }
}

/** Albumin: a pearl, heart-shaped protein with fatty acids on it, carried down the capillary. */
function albumin(ctx: CanvasRenderingContext2D, x: number, y: number, load: number, a: number, px: number): void {
  glow(ctx, PEARL_W, x, y, 5, 0.2 * a);
  ctx.fillStyle = rgba('#f4ecff', 0.85 * a);
  ctx.beginPath();
  ctx.ellipse(x - 1, y, 2.3, 2.6, -0.3, 0, TAU);
  ctx.ellipse(x + 1.2, y + 0.3, 2.2, 2.4, 0.3, 0, TAU);
  ctx.fill();
  for (let j = 0; j < load; j++) fattyAcid(ctx, x + Math.cos(j * 2.1) * 3.4, y + Math.sin(j * 2.1) * 3.4, j * 2.1, 3.6, a, px);
}

// ── the still layer ──────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D, variant: string): void {
  drawStroma(ctx);
  drawFibre(ctx);
  drawCapillary(ctx);
  if (variant === 'open') return; // the cells move: drawn each frame
  const px = 1 / wpx(ctx, 1);
  CELLS.forEach((cell, i) => {
    if (variant === 'signal' && i === SIGNAL_CELL) return;
    if (variant === 'renew' && (i === OLD_CELL || i === NEW_CELL)) return;
    drawCell(ctx, cell, 1, 1, px);
  });
  drawNerve(ctx);
}

// ── the scenes ───────────────────────────────────────────────────
function sygnal(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, cell = CELLS[SIGNAL_CELL];
  const kN = phase(g, 0, 0.35), kL = phase(g, 0.2, 0.65), kF = phase(g, 0.4, 1);
  drawCell(ctx, cell, 1 - 0.05 * kF, 1, st.px, kL);
  // noradrenaline from the nerve's beads: small gold sparks drifting to the cell
  for (let i = 0; i < 8; i++) {
    const [bx, by] = along(NERVE, 0.55 + 0.05 * (i % 4));
    const life = st.reduced ? 0.5 : ((st.time * 0.5 + hash(i * 1.7)) % 1);
    const x = bx + (cell.c[0] - bx) * life * 0.7, y = by + (cell.c[1] - by) * life * 0.7 + Math.sin(i + st.time) * 2;
    sparkle(ctx, x, y, 2.4, kN * Math.sin(Math.PI * life));
  }
  // adrenaline from the blood: a few sparks out of the capillary
  for (let i = 0; i < 4; i++) {
    const life = st.reduced ? 0.5 : ((st.time * 0.4 + i / 4) % 1);
    const y = cell.c[1] + 18 - i * 9;
    const x = capX(y) - CAP_R - 30 * life;
    sparkle(ctx, x, y, 1.8, 0.7 * kN * Math.sin(Math.PI * life));
  }
  // the lipases at work on the droplet's surface: points of light around its rim
  const R = cell.r * 0.9;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + (st.reduced ? 0 : st.time * 0.15);
    const tw = st.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(st.time * 3 + i * 1.9);
    glow(ctx, GOLD_HI, cell.c[0] + Math.cos(a) * R * 0.92, cell.c[1] + Math.sin(a) * R * 0.92, 2.6, 0.5 * kL * tw);
  }
  // glycerol (a pearl) and three fatty acids leave the cell toward the capillary
  const n = Math.round(10 * kF);
  for (let i = 0; i < n; i++) {
    const life = st.reduced ? (i + 0.5) / Math.max(1, n) : ((st.time * 0.12 + hash(i * 2.3)) % 1);
    const sy = cell.c[1] + (hash(i * 4.1) - 0.5) * 30;
    const x0 = cell.c[0] + cell.r * 0.7, x1 = capX(sy) - 2;
    const x = x0 + (x1 - x0) * life, y = sy + Math.sin(life * 6 + i) * 3;
    const a = Math.sin(Math.PI * Math.min(1, life * 1.3)) * kF;
    for (let j = 0; j < 3; j++) fattyAcid(ctx, x + (j - 1) * 2.5, y + (j - 1) * 4.2, 0.2 * j, 6.5, a, st.px);
    ctx.fillStyle = rgba(PEARL_W, 0.8 * a);
    ctx.beginPath();
    ctx.arc(x - 5, y, 1.3, 0, TAU);
    ctx.fill();
  }
}

function albuminScene(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  redCells(ctx, st, -150, 150);
  const kA = phase(g, 0, 0.5), kM = phase(g, 0.35, 1);
  // albumin carriers down the capillary
  const n = 3 + Math.round(9 * kA);
  for (let i = 0; i < n; i++) {
    const k = st.reduced ? (i + 0.5) / n : ((st.time * 0.045 + i / n + hash(i * 9) * 0.03) % 1);
    const y = -140 + 280 * k;
    albumin(ctx, capX(y) + (hash(i * 5) - 0.5) * 2.5, y, 2 + (i % 3), 0.5 + 0.5 * kA, st.px);
  }
  // fatty acids leave the capillary into the fibre and run to its mitochondria
  const m = Math.round(12 * kM);
  for (let i = 0; i < m; i++) {
    const life = st.reduced ? (i + 0.5) / Math.max(1, m) : ((st.time * 0.15 + hash(i * 3.1)) % 1);
    const target = MITOS[i % MITOS.length];
    const y0 = target[1] - 20 + 10 * hash(i), x0 = capX(y0) + CAP_R;
    const x = x0 + (target[0] - x0) * life, y = y0 + (target[1] - y0) * life;
    fattyAcid(ctx, x, y, 0.4, 6, Math.sin(Math.PI * life) * kM, st.px);
  }
  // the fibre's mitochondria warm as they receive them
  MITOS.forEach(([x, y], i) => {
    const a = stagger(g, i, MITOS.length, 0.35, 1, 4);
    ctx.fillStyle = rgba('#ffb38a', 0.25 + 0.5 * a);
    ctx.beginPath();
    ctx.ellipse(x, y, 3.4, 1.6, 0, 0, TAU);
    ctx.fill();
    glow(ctx, GOLD, x, y, 5, 0.3 * a * (0.8 + 0.2 * wave(st.time, 2, i, st.reduced)));
  });
}

function kropla(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  // every cell shrinks a little (most of a fat cell is its droplet), none disappears
  CELLS.forEach((cell, i) => {
    const s = 1 - 0.16 * stagger(g, i, CELLS.length, 0, 1, 8);
    drawCell(ctx, cell, s, 1, st.px, 0.15 * phase(g, 0.1, 1));
  });
  redCells(ctx, st, -150, 150);
  drawNerve(ctx);
  // what leaves goes on as light toward the capillary
  const k = phase(g, 0.05, 1);
  for (let i = 0; i < Math.round(14 * k); i++) {
    const cell = CELLS[(i * 7) % CELLS.length];
    const life = st.reduced ? 0.5 : ((st.time * 0.1 + hash(i * 2.7)) % 1);
    const x0 = cell.c[0], y0 = cell.c[1];
    const x = x0 + (capX(y0) - x0) * life, y = y0 + Math.sin(life * 5 + i) * 2;
    glow(ctx, GOLD, x, y, 2.6, 0.35 * Math.sin(Math.PI * life) * k);
  }
}

function odnowa(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const kOld = phase(g, 0.05, 0.55), kNew = phase(g, 0.3, 1);
  // the old cell is let go: it dims and its droplet is taken away as light
  const old = CELLS[OLD_CELL];
  drawCell(ctx, old, 1 - 0.25 * kOld, 1 - 0.85 * kOld, st.px);
  if (kOld > 0.01 && kOld < 0.99) for (let i = 0; i < 6; i++) glow(ctx, HONEY_FAT, old.c[0] + Math.cos(i) * 10 * kOld, old.c[1] + Math.sin(i * 1.3) * 10 * kOld, 3, 0.3 * Math.sin(Math.PI * kOld));
  // a progenitor by the capillary: an aqua spindle that fills with its first droplet and becomes a fat cell
  const nc = CELLS[NEW_CELL];
  const cx = NEW_AT[0] + (nc.c[0] - NEW_AT[0]) * kNew, cy = NEW_AT[1] + (nc.c[1] - NEW_AT[1]) * kNew;
  if (kNew < 0.7) {
    const a = 1 - phase(kNew, 0.4, 0.7);
    const pulse = st.reduced ? 0.8 : 0.75 + 0.25 * Math.sin(st.time * 2);
    glow(ctx, STEM, cx, cy, 16, 0.4 * a * pulse);
    ctx.fillStyle = rgba(STEM, 0.75 * a);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 11 * (1 - 0.3 * kNew), 3.4 + 5 * kNew, 1.35, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba('#e8fbff', 0.9 * a);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 4, 2, 1.35, 0, TAU);
    ctx.fill();
  }
  const grow = phase(kNew, 0.2, 1);
  if (grow > 0.01) drawCell(ctx, nc, 0.35 + 0.65 * grow, grow, st.px, 0.4, STEM);
  // the renewed ones (about one in ten): a thin aqua rim
  RENEWED.forEach((i, j) => {
    const a = stagger(g, j, RENEWED.length, 0.4, 1, 2);
    if (a <= 0.01) return;
    ctx.strokeStyle = rgba(STEM, 0.55 * a);
    ctx.lineWidth = 1.2 / st.px;
    ctx.stroke(cellPath(CELLS[i], 1.0));
  });
  redCells(ctx, st, -150, 150);
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  // rest's deepening: the tissue warms
  if (st.deep > 0.02) glowEllipse(ctx, '#ffcf9a', -60, 0, 110, 90, 0, 0.08 * st.deep);
  switch (st.scene) {
    case 'sygnal': sygnal(ctx, st); redCells(ctx, st, -150, 150); break;
    case 'albumina': albuminScene(ctx, st); break;
    case 'kropla': kropla(ctx, st); break;
    case 'odnowa': odnowa(ctx, st); break;
    default: break;
  }
}

function focusAt(scene: string, g: number): [number, number] {
  const c = CELLS[SIGNAL_CELL].c;
  switch (scene) {
    case 'sygnal': return [c[0] + (capX(c[1]) - 8 - c[0]) * phase(g, 0.4, 1), c[1]];
    case 'albumina': return [capX(0) + (FIBRE_X + 26 - capX(0)) * phase(g, 0.3, 1), 0];
    case 'kropla': return [-60, 0];
    case 'odnowa': {
      const nc = CELLS[NEW_CELL].c;
      return [NEW_AT[0] + (nc[0] - NEW_AT[0]) * phase(g, 0.3, 1), NEW_AT[1] + (nc[1] - NEW_AT[1]) * phase(g, 0.3, 1)];
    }
    default: return [0, 0];
  }
}

export const TISSUE_WORLD: WorldPainter = { depth: 1, lens: true, bake, draw, focusAt };
export const TISSUE_PARTS = { cells: CELLS, nerveAt: (k: number) => along(NERVE, k), mitos: MITOS, oldCell: OLD_CELL, newCell: NEW_CELL };
