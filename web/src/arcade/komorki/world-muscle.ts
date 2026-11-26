/**
 * A muscle fibre (DESIGN.md §24, Każda komórka · Energia · "Nowe mitochondria"): one skeletal-muscle cell seen along
 * its length through the lens — the sarcolemma a rim of light, the myofibrils banded by their sarcomeres (Z lines
 * bright, A bands deep rose), the nuclei at the edge, mitochondria in pairs by the Z lines between the myofibrils, and
 * a capillary on either side with red cells passing.  As the scene grows the nuclei send their signal (PGC-1α, gold
 * rings) and the fibre builds more mitochondria: new ones appear in the gaps and a few divide — what regular
 * endurance training does to human muscle over weeks (Granata et al. 2018; Pilegaard et al. 2003).
 */
import { GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { capsulePath, drawMito, phase, sparkle, stagger, type P2 } from './draw';

const X0 = -150, X1 = 150;
const TOP = -38, BOT = 38;
const BANDS = 5;
const BAND_H = 12, GAP = 3.4;
const S = 24; // a sarcomere's length
export const MUSCLE_NUCLEI: readonly P2[] = [[-52, TOP + 3.4], [40, BOT - 3.4]];
const CAP_Y = [-50, 50];

/** The top of myofibril k. */
const bandY = (k: number): number => TOP + 1.2 + k * (BAND_H + GAP);
/** The middle of the gap under myofibril k (between k and k+1). */
const gapY = (k: number): number => bandY(k) + BAND_H + GAP / 2;

/** The places for mitochondria: by every Z line, in every gap; the first set is there from the start. */
const SLOTS: { x: number; y: number; base: boolean; order: number }[] = (() => {
  const out: { x: number; y: number; base: boolean; order: number }[] = [];
  for (let k = 0; k < BANDS - 1; k++) {
    for (let z = Math.ceil(X0 / S); z * S <= X1; z++) {
      const x = z * S, y = gapY(k);
      const base = (z + k) % 2 === 0;
      for (const dx of [-4, 4]) out.push({ x: x + dx, y, base, order: hash(x * 0.37 + y * 1.3) });
    }
  }
  return out;
})();
const near = (s: { x: number; order: number }): number => (Math.abs(s.x) / 80) * 0.5 + s.order * 0.5;
const NEW = SLOTS.filter(s => !s.base && Math.abs(s.x) < 76).sort((a, b) => near(a) - near(b));
const BASE = SLOTS.filter(s => s.base);

function bakeMuscle(ctx: CanvasRenderingContext2D): void {
  // the connective tissue round the fibre: dark plum with collagen glints
  ctx.fillStyle = 'rgba(46,16,52,.95)';
  ctx.fillRect(-420, -420, 840, 840);
  for (let i = 0; i < 260; i++) {
    const x = X0 + hash(i * 3 + 801) * (X1 - X0), y = -160 + hash(i * 5 + 802) * 320;
    if (y > TOP - 4 && y < BOT + 4) continue;
    ctx.strokeStyle = i % 3 ? 'rgba(255,170,214,.08)' : 'rgba(255,214,236,.15)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 8, y - 2 + 4 * hash(i + 803), x + 16, y + 2 * (hash(i + 804) - 0.5));
    ctx.stroke();
  }
  // the capillaries: warm tubes on either side
  for (const cy of CAP_Y) {
    ctx.fillStyle = 'rgba(150,30,60,.8)';
    ctx.fillRect(X0 - 20, cy - 3.6, X1 - X0 + 40, 7.2);
    ctx.strokeStyle = 'rgba(255,170,170,.55)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(X0 - 20, cy - 3.6);
    ctx.lineTo(X1 + 20, cy - 3.6);
    ctx.moveTo(X0 - 20, cy + 3.6);
    ctx.lineTo(X1 + 20, cy + 3.6);
    ctx.stroke();
    glowEllipse(ctx, '#ff5470', 0, cy, 170, 7, 0, 0.12);
  }
  // the fibre
  glowEllipse(ctx, '#ff7a90', 0, 0, 170, 70, 0, 0.12);
  const body = ctx.createLinearGradient(0, TOP, 0, BOT);
  body.addColorStop(0, 'rgba(190,70,98,.95)');
  body.addColorStop(0.5, 'rgba(150,46,84,.95)');
  body.addColorStop(1, 'rgba(116,34,74,.95)');
  ctx.fillStyle = body;
  ctx.fillRect(X0 - 20, TOP, X1 - X0 + 40, BOT - TOP);
  // the myofibrils and their sarcomeres
  for (let k = 0; k < BANDS; k++) {
    const y = bandY(k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(X0 - 20, y, X1 - X0 + 40, BAND_H);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,190,200,.16)';
    ctx.fillRect(X0 - 20, y, X1 - X0 + 40, BAND_H);
    for (let z = Math.floor((X0 - 20) / S); z * S <= X1 + 20; z++) {
      const x = z * S;
      // the A band (dark) in the middle of each sarcomere, its lighter H zone, the M line
      ctx.fillStyle = 'rgba(96,20,60,.42)';
      ctx.fillRect(x + 5, y, S - 10, BAND_H);
      ctx.fillStyle = 'rgba(160,60,100,.3)';
      ctx.fillRect(x + S / 2 - 2.4, y, 4.8, BAND_H);
      ctx.fillStyle = 'rgba(255,214,230,.25)';
      ctx.fillRect(x + S / 2 - 0.25, y, 0.5, BAND_H);
      // the Z line
      ctx.fillStyle = 'rgba(255,236,240,.7)';
      ctx.fillRect(x - 0.35, y, 0.7, BAND_H);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,214,226,.22)';
    ctx.lineWidth = 0.4;
    ctx.strokeRect(X0 - 20, y, X1 - X0 + 40, BAND_H);
  }
  // the nuclei at the edge, flattened under the sarcolemma
  for (const [x, y] of MUSCLE_NUCLEI) {
    const g = ctx.createRadialGradient(x - 4, y - 1, 0, x, y, 14);
    g.addColorStop(0, 'rgba(150,110,230,.98)');
    g.addColorStop(1, 'rgba(84,52,160,.98)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 16, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(236,222,255,.85)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    glow(ctx, '#b49cff', x, y, 16, 0.25);
  }
  // the mitochondria there from the start
  for (const [i, s] of BASE.entries()) drawSmallMito(ctx, s.x, s.y, 0, i, 1);
  // the sarcolemma
  for (const y of [TOP, BOT]) {
    ctx.strokeStyle = 'rgba(255,200,220,.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X0 - 20, y);
    ctx.lineTo(X1 + 20, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,246,.9)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/** A mitochondrion in a gap: small, along the gap (its lit share `lit`, its size `k`). */
function drawSmallMito(ctx: CanvasRenderingContext2D, x: number, y: number, lit: number, seed: number, k: number): void {
  if (k <= 0.02) return;
  drawMito(ctx, x, y, 6.6 * k, 3 * Math.min(1, k * 1.4), 0, lit, { seed, px: 6 });
}

/** The red cells passing in the capillaries. */
function drawFlow(ctx: CanvasRenderingContext2D, st: WorldState): void {
  for (const [j, cy] of CAP_Y.entries()) {
    for (let i = 0; i < 14; i++) {
      const x = X0 - 10 + (((st.time * (9 + 3 * j) + i * 23 + j * 11) % (X1 - X0 + 20)) + (X1 - X0 + 20)) % (X1 - X0 + 20);
      ctx.fillStyle = 'rgba(255,90,110,.9)';
      ctx.beginPath();
      ctx.ellipse(x, cy + 0.6 * Math.sin(i), 2.6, 2.1, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,20,50,.6)';
      ctx.beginPath();
      ctx.ellipse(x, cy + 0.6 * Math.sin(i), 1, 0.8, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function newIndexAt(g: number): number {
  return Math.min(NEW.length - 1, Math.max(0, Math.floor(phase(g, 0.12, 0.98) * NEW.length)));
}

function drawMuscle(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  drawFlow(ctx, st);
  // the signal: gold rings from the nuclei while it grows, and a warm light along the fibre
  const sig = phase(g, 0.02, 0.3) * (st.after > 0 ? 0.6 : 1);
  for (const [n, [x, y]] of MUSCLE_NUCLEI.entries()) {
    if (sig <= 0) continue;
    for (let r = 0; r < 3; r++) {
      const f = (st.time * 0.45 + r / 3 + n * 0.5) % 1;
      ctx.strokeStyle = rgba(GOLD, sig * (1 - f) * 0.6);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(x, y, 16 + f * 40, 3.2 + f * 26, 0, 0, TAU);
      ctx.stroke();
    }
    glow(ctx, GOLD_HI, x, y, 12, 0.35 * sig);
  }
  // the base mitochondria warm up as the fibre works
  const warm = phase(g, 0.05, 0.5);
  if (warm > 0.02) for (const [i, s] of BASE.entries()) if (Math.abs(s.x) < 120) drawSmallMito(ctx, s.x, s.y, warm * (0.6 + 0.4 * Math.sin(st.time * 1.5 + i)), i, 1);
  // new ones: each appears in its slot, small then full, and lights up
  const shown = phase(g, 0.12, 0.98) * NEW.length;
  let front: Pt = MUSCLE_NUCLEI[0];
  for (let i = 0; i < NEW.length; i++) {
    const k = Math.max(0, Math.min(1, shown - i));
    if (k <= 0) break;
    const s = NEW[i];
    drawSmallMito(ctx, s.x, s.y, 0.6 + 0.4 * k, i + 50, 0.3 + 0.7 * k);
    if (k < 1) {
      sparkle(ctx, s.x, s.y, 3.2, 0.9 * (1 - k) + 0.2);
      front = [s.x, s.y];
    }
  }
  // a few divide: one stretches and pinches into two (fission)
  for (let d = 0; d < 3; d++) {
    const on = stagger(g, d, 3, 0.3, 0.25, 0.95);
    if (on <= 0 || on >= 1) continue;
    const s = BASE[(d * 37 + 11) % BASE.length];
    const sep = 2.8 * on;
    ctx.save();
    ctx.translate(s.x, s.y);
    const p = capsulePath(6.6 + sep, 3 * (1 - 0.35 * Math.sin(on * Math.PI)));
    ctx.fillStyle = rgba(GOLD_HI, 0.35);
    ctx.fill(p);
    ctx.restore();
    sparkle(ctx, s.x, s.y, 2.6, 0.7);
  }
  glowEllipse(ctx, GOLD, 0, 0, 120, 40, 0, 0.08 * g + 0.05 * st.deep * (0.6 + 0.4 * st.breath));
  return front;
}

export const MUSCLE_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: ctx => bakeMuscle(ctx),
  draw: (ctx, st) => {
    drawMuscle(ctx, st);
  },
  focusAt(_scene, g) {
    if (g < 0.12) return MUSCLE_NUCLEI[0];
    const s = NEW[newIndexAt(g)];
    return [s.x, s.y];
  },
};

/** A mitochondrion of the fibre (a portal), and the first new one (its label). */
export const MUSCLE_MITO: Pt = [BASE[20].x, BASE[20].y];
export const FIRST_NEW: Pt = [NEW[0].x, NEW[0].y];
