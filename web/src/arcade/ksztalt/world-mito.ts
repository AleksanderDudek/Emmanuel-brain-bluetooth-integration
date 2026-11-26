/**
 * A mitochondrion in a muscle fibre under the lens (DESIGN.md §24, Lekkość i siła · "Spalanie"): its outer membrane,
 * the folded inner membrane (cristae) and the matrix.  A fatty acid comes in through the carnitine shuttle and is cut
 * two carbons at a time (β-oxidation); each two-carbon piece (acetyl-CoA) enters the citric acid cycle, where its
 * carbon leaves joined to oxygen as CO₂ — bubbles of light drifting out toward the blood and the lungs — while the
 * hydrogen's electrons run along the cristae to oxygen, which becomes water; ATP sparks gold.  (Houten & Wanders
 * 2010; StatPearls "Fatty Acid Oxidation".)  World units ≈ 10 nm.
 */
import { GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { bubble, phase, sparkle, wave, wpx } from './draw';
import { CO2, PEARL_W, WATER } from './palette';

const RX = 100, RY = 54;
export const GATE: [number, number] = [-RX + 4, 6];
export const SPIRAL: [number, number] = [-48, 4];
export const CYCLE: [number, number] = [26, -2];
const CYCLE_R = 19;
/** The cristae: folds of the inner membrane from the top and the bottom (x, from which side, how deep). */
const CRISTAE: readonly [number, number, number][] = [
  [-80, -1, 30], [-68, 1, 40], [-56, -1, 34], [-34, 1, 38], [-20, -1, 40], [-6, 1, 34], [8, -1, 22], [48, 1, 30],
  [56, -1, 40], [70, 1, 40], [82, -1, 30],
];

function beanPath(rx: number, ry: number): Path2D {
  const p = new Path2D();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU;
    // a soft capsule: |cos|^0.6 widens the ends a little
    const c = Math.cos(a), s = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** 0.7 * rx, y = Math.sign(s) * Math.abs(s) ** 0.9 * ry;
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}
let outerP: Path2D | null = null, innerP: Path2D | null = null;
const outer = (): Path2D => (outerP ??= beanPath(RX, RY));
const inner = (): Path2D => (innerP ??= beanPath(RX - 6, RY - 6));
const innerY = (x: number, side: number): number => side * (RY - 6) * Math.max(0, 1 - (Math.abs(x) / (RX - 6)) ** 2) ** 0.55;

function bake(ctx: CanvasRenderingContext2D): void {
  // the cytoplasm of the muscle fibre round it: deep rose with faint myofibril bands
  ctx.fillStyle = 'rgba(70,20,56,.96)';
  ctx.fillRect(-200, -150, 400, 300);
  for (let y = -150; y < 150; y += 22) {
    if (Math.abs(y) < RY + 10) continue;
    ctx.fillStyle = 'rgba(200,70,110,.14)';
    ctx.fillRect(-200, y, 400, 12);
  }
  glowEllipse(ctx, '#ff9ab0', 0, 0, RX * 1.25, RY * 1.4, 0, 0.18);
  // the outer membrane
  ctx.fillStyle = 'rgba(150,60,110,.75)';
  ctx.fill(outer());
  ctx.strokeStyle = 'rgba(255,214,226,.75)';
  ctx.lineWidth = wpx(ctx, 1.6);
  ctx.stroke(outer());
  // the matrix inside the inner membrane
  const g = ctx.createRadialGradient(0, -10, 10, 0, 0, RX);
  g.addColorStop(0, 'rgba(255,190,200,.42)');
  g.addColorStop(1, 'rgba(176,90,150,.45)');
  ctx.fillStyle = g;
  ctx.fill(inner());
  ctx.strokeStyle = 'rgba(255,226,236,.6)';
  ctx.lineWidth = wpx(ctx, 1.2);
  ctx.stroke(inner());
  // the cristae: folds of the inner membrane reaching in, soft tongues with a lit edge
  for (const [i, [x, side, depth]] of CRISTAE.entries()) {
    const y0 = innerY(x, side) + side * 1.5;
    const y1 = y0 - side * depth;
    const bend = (i % 2 ? 1 : -1) * 3.5;
    const w = 2.3;
    const p = new Path2D();
    p.moveTo(x - w - 1.5, y0 + side * 2);
    p.quadraticCurveTo(x - w + bend * 0.6, (y0 + y1) / 2, x - w * 0.8 + bend, y1 + side * w);
    p.quadraticCurveTo(x + bend, y1 - side * 1.6, x + w * 0.8 + bend, y1 + side * w);
    p.quadraticCurveTo(x + w + bend * 0.6, (y0 + y1) / 2, x + w + 1.5, y0 + side * 2);
    p.closePath();
    ctx.fillStyle = 'rgba(108,34,86,.62)';
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(255,212,232,.62)';
    ctx.lineWidth = wpx(ctx, 1.1);
    ctx.stroke(p);
    // the space inside the fold, a darker line down its middle
    ctx.strokeStyle = 'rgba(60,14,48,.6)';
    ctx.lineWidth = wpx(ctx, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + bend * 0.6, (y0 + y1) / 2, x + bend, y1 + side * w * 1.4);
    ctx.stroke();
  }
  // the matrix glows faintly from within
  glowEllipse(ctx, '#ffc2d6', -10, -6, RX * 0.7, RY * 0.6, 0, 0.14);
}

/** A carbon chain of n beads (a fatty acid's backbone) along a direction, beads gold. */
function chain(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, ang: number, a: number): void {
  if (a <= 0.01 || n <= 0) return;
  const step = 3.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = rgba(GOLD, 0.7 * a);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const xx = -i * step, yy = i % 2 ? -1.3 : 1.3;
    if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
  }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rgba(i === 0 ? '#ff9a86' : GOLD_HI, 0.95 * a);
    ctx.beginPath();
    ctx.arc(-i * step, i % 2 ? -1.3 : 1.3, 1.25, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, GOLD, x - 8 * Math.cos(ang), y - 8 * Math.sin(ang), 12, 0.15 * a);
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, t = st.time, red = st.reduced;
  const kIn = phase(g, 0, 0.3), kB = phase(g, 0.15, 0.65), kK = phase(g, 0.35, 0.9), kW = phase(g, 0.55, 1);
  if (st.deep > 0.02) glowEllipse(ctx, '#ffd0b8', 0, 0, RX, RY, 0, 0.1 * st.deep);
  // 1 the fatty acid arrives from the left and passes the shuttle's gate
  const enter = red ? 0.7 : (t * 0.12) % 1;
  const ex = -150 + (GATE[0] + 150) * Math.min(1, enter * 1.4);
  chain(ctx, ex, GATE[1] + Math.sin(t) * 1.5, 16, 0, kIn * (1 - phase(enter, 0.6, 0.72)));
  glow(ctx, GOLD_HI, GATE[0], GATE[1], 6, 0.2 + 0.5 * kIn);
  ctx.strokeStyle = rgba(GOLD_HI, 0.4 + 0.5 * kIn);
  ctx.lineWidth = 1.2 / st.px;
  ctx.beginPath();
  ctx.arc(GATE[0], GATE[1], 3.6, 0, TAU);
  ctx.stroke();
  // 2 the spiral of β-oxidation: a turning wheel; the chain shortens by two carbons a turn
  const spin = red ? 0 : t * 0.6;
  ctx.save();
  ctx.strokeStyle = rgba('#ffe2b0', 0.2 + 0.55 * kB);
  ctx.lineWidth = 1.1 / st.px;
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const a = spin + (i / 80) * TAU * 1.8, r = 4 + (i / 80) * 12;
    const x = SPIRAL[0] + Math.cos(a) * r, y = SPIRAL[1] + Math.sin(a) * r * 0.8;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  const turn = red ? 0.5 : (t * 0.35) % 1;
  const left = 16 - 2 * Math.floor(turn * 7);
  chain(ctx, SPIRAL[0] + 10, SPIRAL[1] - 6, Math.max(2, left), Math.PI, 0.85 * kB);
  // the two-carbon pieces (acetyl-CoA) travel to the cycle
  for (let i = 0; i < 6; i++) {
    const life = red ? (i + 0.5) / 6 : ((t * 0.3 + i / 6) % 1);
    const x = SPIRAL[0] + 14 + (CYCLE[0] - CYCLE_R - SPIRAL[0] - 14) * life, y = SPIRAL[1] + (CYCLE[1] - SPIRAL[1]) * life + Math.sin(life * 6 + i) * 3;
    const a = Math.sin(Math.PI * life) * kB;
    for (const d of [-1.6, 1.6]) {
      ctx.fillStyle = rgba(GOLD_HI, a);
      ctx.beginPath();
      ctx.arc(x + d, y, 1.3, 0, TAU);
      ctx.fill();
    }
    glow(ctx, GOLD, x, y, 5, 0.25 * a);
  }
  // 3 the citric acid cycle: a ring of eight steps turning; CO₂ leaves at two of them
  const rot = red ? 0 : t * 0.5;
  ctx.strokeStyle = rgba('#ffd8c0', 0.2 + 0.5 * kK);
  ctx.lineWidth = 1.2 / st.px;
  ctx.beginPath();
  ctx.arc(CYCLE[0], CYCLE[1], CYCLE_R, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * TAU;
    const x = CYCLE[0] + Math.cos(a) * CYCLE_R, y = CYCLE[1] + Math.sin(a) * CYCLE_R;
    glow(ctx, i % 4 === 1 ? CO2 : GOLD, x, y, 4, 0.25 * kK);
    ctx.fillStyle = rgba(i % 4 === 1 ? CO2 : GOLD_HI, 0.35 + 0.6 * kK);
    ctx.beginPath();
    ctx.arc(x, y, 1.7, 0, TAU);
    ctx.fill();
  }
  // CO₂: bubbles rising out through the membranes, up and to the right (toward the blood, the lungs)
  const nb = Math.round(3 + 12 * kK);
  for (let i = 0; i < nb; i++) {
    const life = red ? (i + 0.5) / nb : ((t * 0.13 + hash(i * 2.9)) % 1);
    const x0 = CYCLE[0] + (hash(i * 3.1) - 0.5) * 20, y0 = CYCLE[1] - 8;
    const x = x0 + 70 * life + Math.sin(t + i) * 2, y = y0 - 85 * life;
    bubble(ctx, x, y, 2 + 2.4 * hash(i * 1.7) + 1.5 * life, Math.sin(Math.PI * life) * (0.3 + 0.7 * kK), st.px, CO2);
  }
  // 4 along the cristae: electrons run, oxygen takes them and becomes water; ATP sparks
  CRISTAE.forEach(([x, side, depth], i) => {
    const y0 = innerY(x, side), y1 = y0 - side * depth;
    const k = red ? 0.5 : ((t * 0.5 + i * 0.17) % 1);
    const yy = y0 + (y1 - y0) * k;
    glow(ctx, GOLD_HI, x, yy, 3.2, 0.45 * kW);
    if (i % 2 === 0) sparkle(ctx, x + 5, y1 + side * 4, 3, kW * (0.4 + 0.6 * wave(t, 1.6, i, red)));
  });
  for (let i = 0; i < Math.round(9 * kW); i++) {
    const [x, side] = CRISTAE[(i * 4) % CRISTAE.length];
    const y = innerY(x, side) - side * 6 - side * 10 * hash(i * 1.3);
    const life = red ? 0.5 : ((t * 0.2 + hash(i * 4.4)) % 1);
    const a = Math.sin(Math.PI * life) * kW;
    glow(ctx, WATER, x + 6, y, 4, 0.3 * a);
    ctx.fillStyle = rgba(WATER, 0.75 * a);
    ctx.beginPath();
    ctx.arc(x + 6, y + 2 * life, 1.6, 0, TAU);
    ctx.fill();
  }
  // oxygen arriving from the right (two linked beads)
  for (let i = 0; i < 4; i++) {
    const life = red ? (i + 0.5) / 4 : ((t * 0.16 + i / 4) % 1);
    const x = 150 - 70 * life, y = 30 - 10 * i + Math.sin(t + i) * 2;
    const a = Math.sin(Math.PI * life) * kW;
    for (const d of [-1.4, 1.4]) {
      ctx.fillStyle = rgba('#bfe6ff', 0.85 * a);
      ctx.beginPath();
      ctx.arc(x + d, y, 1.3, 0, TAU);
      ctx.fill();
    }
  }
  void PEARL_W;
}

function focusAt(_scene: string, g: number): [number, number] {
  if (g < 0.3) return [GATE[0] + (SPIRAL[0] - GATE[0]) * phase(g, 0, 0.3), GATE[1] + (SPIRAL[1] - GATE[1]) * phase(g, 0, 0.3)];
  if (g < 0.65) return [SPIRAL[0] + (CYCLE[0] - SPIRAL[0]) * phase(g, 0.3, 0.65), SPIRAL[1] + (CYCLE[1] - SPIRAL[1]) * phase(g, 0.3, 0.65)];
  return [CYCLE[0] + 30 * phase(g, 0.65, 1), CYCLE[1] - 40 * phase(g, 0.65, 1)];
}

export const MITO_WORLD: WorldPainter = { depth: 2, lens: true, bake, draw, focusAt };
export const MITO = { RX, RY, GATE, SPIRAL, CYCLE, innerY };
