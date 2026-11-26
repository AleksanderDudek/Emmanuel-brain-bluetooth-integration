/**
 * A muscle fibre under the lens (DESIGN.md §24, Lekkość i siła): one skeletal-muscle cell seen along its length —
 * the myofibrils banded by their sarcomeres (Z lines bright, A bands deep coral), its nuclei at the edge, the
 * membrane a rim of light and, a breath outside it, the basal lamina; satellite cells (the muscle's stem cells) wait
 * between the two; capillaries pass above and below.  World units ≈ µm.
 *
 *   bodziec   after strength training the fibre builds protein faster for a day or two: sparks along the fibrils,
 *             and the curve of the rise below (+112 % at 3 h, +65 % at 24 h, +34 % at 48 h — Phillips et al. 1997)
 *   satelity  a satellite cell wakes, divides, and one daughter fuses into the fibre as a new nucleus (Mauro 1961;
 *             Murach et al. 2021)
 *   budowa    in the hours of rest amino acids arrive from the blood and new myofibrils are laid; the fibre thickens
 */
import { BLOOD, GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { phase, sparkle, stagger, wave, wpx } from './draw';
import { MUSCLE, PEARL_W, STEM } from './palette';

export const R0 = 42;
const LAMINA = 3.6;
const CAP_Y = 68;
const SARC = 18;
const X0 = -190, X1 = 190;
const NUCLEI: readonly [number, number][] = [[-112, -1], [26, 1], [118, -1]];
/** The satellite cells: on the top side (the scene's own) and one below. */
export const SAT: readonly [number, number][] = [[-38, -1], [70, 1]];
/** The MPS curve under the fibre (hours → % above rest, Phillips et al. 1997), drawn as a line of light. */
export const CURVE: readonly [number, number][] = [[0, 0], [3, 112], [24, 65], [48, 34]];
const CX0 = -112, CX1 = 112, CY = 106, CSCALE = 0.16;
export const curvePt = (h: number, pct: number): [number, number] => [CX0 + ((CX1 - CX0) * h) / 48, CY - pct * CSCALE];

function bandsOf(R: number): { y: number; h: number }[] {
  const out: { y: number; h: number }[] = [];
  const n = 9, gap = 1.8;
  const h = (2 * R - 4 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) out.push({ y: -R + 2 + i * (h + gap), h });
  return out;
}

function drawStroma(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(48,16,44,.96)';
  ctx.fillRect(X0 - 20, -170, X1 - X0 + 40, 340);
  for (let i = 0; i < 200; i++) {
    const x = X0 + (X1 - X0) * hash(i * 3 + 601), y = -150 + 300 * hash(i * 5 + 602);
    if (Math.abs(y) < R0 + 6) continue;
    ctx.strokeStyle = i % 3 ? 'rgba(255,170,214,.07)' : 'rgba(255,214,236,.13)';
    ctx.lineWidth = wpx(ctx, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 7, y - 2 + 4 * hash(i + 603), x + 15, y + 2 * (hash(i + 604) - 0.5));
    ctx.stroke();
  }
  for (const cy of [-CAP_Y, CAP_Y]) {
    ctx.fillStyle = 'rgba(255,120,140,.12)';
    ctx.fillRect(X0 - 20, cy - 8, X1 - X0 + 40, 16);
    ctx.fillStyle = 'rgba(120,20,48,.95)';
    ctx.fillRect(X0 - 20, cy - 5, X1 - X0 + 40, 10);
    ctx.strokeStyle = 'rgba(255,170,170,.5)';
    ctx.lineWidth = wpx(ctx, 1.2);
    for (const s of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(X0 - 20, cy + s);
      ctx.lineTo(X1 + 20, cy + s);
      ctx.stroke();
    }
  }
}

function drawFibre(ctx: CanvasRenderingContext2D, R: number, px: number, lit = 0): void {
  // the body of the cell
  const g = ctx.createLinearGradient(0, -R, 0, R);
  g.addColorStop(0, 'rgba(176,52,92,.92)');
  g.addColorStop(0.5, 'rgba(206,74,104,.92)');
  g.addColorStop(1, 'rgba(168,48,90,.92)');
  ctx.fillStyle = g;
  ctx.fillRect(X0, -R, X1 - X0, 2 * R);
  // the myofibrils and their sarcomeres
  for (const b of bandsOf(R)) {
    ctx.fillStyle = `rgba(255,150,160,${(0.16 + 0.12 * lit).toFixed(3)})`;
    ctx.fillRect(X0, b.y, X1 - X0, b.h);
    for (let x = Math.ceil(X0 / SARC) * SARC; x < X1; x += SARC) {
      // the A band (dark, thick filaments) in the middle of each sarcomere
      ctx.fillStyle = `rgba(110,20,52,${(0.42).toFixed(3)})`;
      ctx.fillRect(x + SARC * 0.25, b.y, SARC * 0.5, b.h);
      // the M line
      ctx.fillStyle = 'rgba(255,190,200,.14)';
      ctx.fillRect(x + SARC * 0.5 - 0.25, b.y, 0.5, b.h);
    }
  }
  // the Z lines, bright
  ctx.strokeStyle = `rgba(255,226,232,${(0.32 + 0.3 * lit).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.5, 0.9 / px);
  for (let x = Math.ceil(X0 / SARC) * SARC; x < X1; x += SARC) {
    ctx.beginPath();
    ctx.moveTo(x, -R + 1);
    ctx.lineTo(x, R - 1);
    ctx.stroke();
  }
  // the nuclei at the edge
  for (const [x, s] of NUCLEI) {
    ctx.fillStyle = 'rgba(186,150,255,.82)';
    ctx.beginPath();
    ctx.ellipse(x, s * (R - 3), 11, 2.4, 0, 0, TAU);
    ctx.fill();
  }
  // the membrane (a rim of light) and the basal lamina just outside
  for (const s of [-1, 1]) {
    ctx.strokeStyle = 'rgba(255,214,220,.75)';
    ctx.lineWidth = Math.max(0.6, 1.3 / px);
    ctx.beginPath();
    ctx.moveTo(X0, s * R);
    ctx.lineTo(X1, s * R);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(236,226,255,.4)';
    ctx.lineWidth = Math.max(0.4, 0.9 / px);
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(X0, s * (R + LAMINA));
    ctx.lineTo(X1, s * (R + LAMINA));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function satellite(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, wake: number): void {
  if (a <= 0.01) return;
  glow(ctx, STEM, x, y, 6 + 5 * wake, (0.15 + 0.4 * wake) * a);
  ctx.fillStyle = rgba(STEM, (0.55 + 0.35 * wake) * a);
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * s, 1.6 + 0.5 * wake, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba('#e6fbff', 0.85 * a);
  ctx.beginPath();
  ctx.ellipse(x, y, 3.6 * s, 1, 0, 0, TAU);
  ctx.fill();
}

function redCells(ctx: CanvasRenderingContext2D, st: WorldState): void {
  for (const [j, cy] of [-CAP_Y, CAP_Y].entries()) {
    for (let i = 0; i < 9; i++) {
      const k = st.reduced ? (i + 0.5) / 9 : ((st.time * 0.04 + i / 9 + j * 0.37) % 1);
      const x = X0 + (X1 - X0) * k;
      ctx.fillStyle = rgba(BLOOD, 0.75);
      ctx.beginPath();
      ctx.ellipse(x, cy + (hash(i * 3 + j) - 0.5) * 3, 3.8, 2, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// ── the still layer ──────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D, variant: string): void {
  drawStroma(ctx);
  if (variant === 'grow') return;
  drawFibre(ctx, R0, 1 / wpx(ctx, 1));
  if (variant === 'curve') {
    // the axis of the 48 hours under the fibre: a faint baseline and the day's tick
    ctx.strokeStyle = 'rgba(255,236,226,.28)';
    ctx.lineWidth = wpx(ctx, 1);
    ctx.beginPath();
    ctx.moveTo(CX0, CY);
    ctx.lineTo(CX1, CY);
    ctx.stroke();
    for (const h of [0, 24, 48]) {
      const [x] = curvePt(h, 0);
      ctx.beginPath();
      ctx.moveTo(x, CY - 2);
      ctx.lineTo(x, CY + 2);
      ctx.stroke();
    }
  }
}

// ── the scenes ───────────────────────────────────────────────────
/** The curve's point at a share k of the 48 hours (a smooth rise to the 3 h peak, then the fall). */
function curveAt(k: number): [number, number] {
  const h = 48 * k;
  let pct: number;
  if (h <= 3) pct = 112 * Math.sin((h / 3) * (Math.PI / 2));
  else if (h <= 24) pct = 112 + (65 - 112) * ((h - 3) / 21);
  else pct = 65 + (34 - 65) * ((h - 24) / 24);
  return curvePt(h, pct);
}

function bodziec(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const kS = phase(g, 0, 0.7);
  // the fibrils glow as their protein is built
  glowEllipse(ctx, MUSCLE, 0, 0, 170, R0 * 1.1, 0, 0.12 + 0.18 * kS);
  const bands = bandsOf(R0);
  const n = Math.round(10 + 50 * kS);
  for (let i = 0; i < n; i++) {
    const b = bands[i % bands.length];
    const x = X0 + 20 + (X1 - X0 - 40) * hash(i * 3.7 + 11);
    const y = b.y + b.h * (0.25 + 0.5 * hash(i * 5.3 + 2));
    const tw = st.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(st.time * 2.2 + i * 1.3);
    sparkle(ctx, x, y, 2.6, (0.35 + 0.6 * kS) * tw);
  }
  // the curve of the 48 hours below
  const k = phase(g, 0.1, 1);
  if (k > 0.005) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const steps = Math.max(2, Math.round(60 * k));
    for (let i = 0; i <= steps; i++) {
      const [x, y] = curveAt((k * i) / steps);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = rgba(GOLD, 0.25);
    ctx.lineWidth = 4.5 / st.px;
    ctx.stroke();
    ctx.strokeStyle = rgba(GOLD_HI, 0.9);
    ctx.lineWidth = 1.6 / st.px;
    ctx.stroke();
    ctx.restore();
    for (const [h, pct] of CURVE.slice(1)) {
      if (48 * k + 0.01 < h) continue;
      const [x, y] = curvePt(h, pct);
      glow(ctx, GOLD, x, y, 5, 0.5);
      ctx.fillStyle = GOLD_HI;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, TAU);
      ctx.fill();
    }
    const [hx, hy] = curveAt(k);
    sparkle(ctx, hx, hy, 5, 0.9);
  }
}

function satelity(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  for (const [j, [sx, side]] of SAT.entries()) {
    const gg = j === 0 ? g : phase(g, 0.35, 1); // the second follows later
    const wake = phase(gg, 0, 0.3), split = phase(gg, 0.3, 0.55), fuse = phase(gg, 0.55, 0.9);
    const y = side * (R0 + LAMINA / 2);
    const pulse = st.reduced ? 0.7 : 0.6 + 0.4 * Math.sin(st.time * 2.5 + j);
    // the mother (stays in her niche: self-renewal) and the daughter moving off and inward
    satellite(ctx, sx - 5 * split, y, 1 - 0.25 * split, 1, wake * pulse);
    if (split > 0.01) {
      const dx = sx + 8 * split, dy = y - side * (LAMINA / 2 + 4) * fuse;
      satellite(ctx, dx, dy, 0.8 - 0.2 * fuse, 1 - fuse, wake * pulse);
      // the new nucleus inside the fibre, rimmed in gold
      if (fuse > 0.01) {
        const nx = dx, ny = side * (R0 - 3);
        glow(ctx, GOLD, nx, ny, 9, 0.35 * fuse);
        ctx.fillStyle = rgba('#c8a6ff', 0.85 * fuse);
        ctx.beginPath();
        ctx.ellipse(nx, ny, 10 * fuse, 2.4, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(GOLD_HI, 0.8 * fuse);
        ctx.lineWidth = 0.9 / st.px;
        ctx.stroke();
      }
    }
  }
  redCells(ctx, st);
}

function budowa(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const kB = phase(g, 0.1, 1);
  const R = R0 + 4 * kB;
  drawFibre(ctx, R, st.px, 0.3 * kB + 0.3 * st.deep);
  // new myofibrils laid between the old: lines of gold growing along
  const bands = bandsOf(R);
  for (let i = 0; i < bands.length - 1; i++) {
    const a = stagger(g, i, bands.length - 1, 0.1, 1, 3);
    if (a <= 0.01) continue;
    const y = bands[i].y + bands[i].h + 0.9;
    const x1 = X0 + (X1 - X0) * a;
    ctx.strokeStyle = rgba(GOLD, 0.25);
    ctx.lineWidth = 2.6 / st.px;
    ctx.beginPath();
    ctx.moveTo(X0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.strokeStyle = rgba(GOLD_HI, 0.85);
    ctx.lineWidth = 0.9 / st.px;
    ctx.stroke();
    if (a < 1) sparkle(ctx, x1, y, 3, 0.9);
  }
  // amino acids from the blood: small lights of many colours, out of the capillaries and into the fibre
  const COLS = ['#ffd98a', '#9fe9ff', '#ffb0c8', '#c9b8ff', '#bdf2a8'];
  const n = Math.round(8 + 30 * phase(g, 0, 0.8));
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const life = st.reduced ? (i + 0.5) / n : ((st.time * 0.18 + hash(i * 3.3)) % 1);
    const x = X0 + 20 + (X1 - X0 - 40) * hash(i * 7.1 + 5);
    const y = side * (CAP_Y - (CAP_Y - R * 0.6) * life);
    const a = Math.sin(Math.PI * life);
    glow(ctx, COLS[i % COLS.length], x, y, 2.8, 0.35 * a);
    ctx.fillStyle = rgba(COLS[i % COLS.length], 0.9 * a);
    ctx.beginPath();
    ctx.arc(x, y, 0.9, 0, TAU);
    ctx.fill();
  }
  redCells(ctx, st);
  // the rest's own warmth: building goes on while the body rests
  if (st.deep > 0.02) glowEllipse(ctx, '#ffd0a8', 0, 0, 150, R, 0, 0.12 * st.deep);
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  if (st.deep > 0.02 && st.scene !== 'budowa') glowEllipse(ctx, '#ffcfb0', 0, 0, 160, 60, 0, 0.08 * st.deep);
  switch (st.scene) {
    case 'bodziec': bodziec(ctx, st); redCells(ctx, st); break;
    case 'satelity': satelity(ctx, st); break;
    case 'budowa': budowa(ctx, st); break;
    default: break;
  }
  void wave;
}

function focusAt(scene: string, g: number): [number, number] {
  switch (scene) {
    case 'bodziec': return curveAt(phase(g, 0.1, 1));
    case 'satelity': return [SAT[0][0] + 8 * phase(g, 0.3, 0.55), -(R0 + LAMINA / 2) + (LAMINA / 2 + 4) * phase(g, 0.55, 0.9)];
    case 'budowa': return [X0 + 40 + (X1 - X0 - 80) * phase(g, 0.1, 1), 0];
    default: return [0, 0];
  }
}

export const FIBRE_WORLD: WorldPainter = { depth: 1, lens: true, bake, draw, focusAt };
export const FIBRE = { R0, LAMINA, CAP_Y, nuclei: NUCLEI, curvePt, PEARL_W };
