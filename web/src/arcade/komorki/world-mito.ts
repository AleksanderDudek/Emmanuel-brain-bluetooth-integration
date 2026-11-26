/**
 * The mitochondrion in section (DESIGN.md §24, Każda komórka · Energia): the outer membrane a smooth pearl rim, the
 * thin space between the membranes, the inner membrane folded into cristae that reach far across the matrix, and the
 * matrix itself warm and granular with the mitochondrion's own DNA (small rings) and ribosomes.  As the scene grows
 * the cristae light one after another — gold along their membranes, where the respiratory chain and ATP synthase sit —
 * and small sparks of ATP leave them; pale oxygen drifts in from outside.
 */
import { AQUA, GOLD, GOLD_HI, PEARL, TAU, glow, glowEllipse, hash, rgba, smoothPath, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { dot, drawMito, sparkle, stagger, type P2 } from './draw';
import { t } from './i18n';

const L = 112; // half length
const R = 48; // half width at the middle

/** The centre line's gentle bend and the half width at x. */
const midY = (x: number): number => 5 * Math.sin((x / L) * Math.PI * 0.9) - 2;
const halfW = (x: number): number => R * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / L, 2.6)), 0.5);

function outline(inset: number): Path2D {
  const top: P2[] = [], bot: P2[] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const x = -L + (2 * L * i) / n;
    const w = Math.max(0, halfW(x) - inset);
    top.push([x, midY(x) - w]);
    bot.push([x, midY(x) + w]);
  }
  const p = new Path2D();
  smoothPath(p, [...top, ...bot.reverse()]);
  p.closePath();
  return p;
}

/** The cristae: x where each starts, from the top (-1) or bottom (1), how far it reaches across (0..1 of the width). */
export const CRISTAE: readonly { x: number; side: -1 | 1; reach: number }[] = Array.from({ length: 13 }, (_, i) => {
  const x = -86 + i * 14.4;
  return { x, side: (i % 2 ? 1 : -1) as -1 | 1, reach: 0.62 + 0.22 * hash(i * 3 + 7) };
});

/** A crista's centre line from the inner membrane inward (points). */
function cristaLine(c: (typeof CRISTAE)[number]): P2[] {
  const inset = 4;
  const w = halfW(c.x) - inset;
  const y0 = midY(c.x) + c.side * w;
  const depth = 2 * w * c.reach;
  const pts: P2[] = [];
  for (let k = 0; k <= 8; k++) {
    const f = k / 8;
    pts.push([c.x + 2.2 * Math.sin(f * 3 + c.x * 0.1) * f, y0 - c.side * depth * f]);
  }
  return pts;
}

/** A crista as a narrow tongue (its membrane folded back on itself) round its centre line. */
function cristaPath(c: (typeof CRISTAE)[number], width = 2.6): Path2D {
  const line = cristaLine(c);
  const left: P2[] = [], right: P2[] = [];
  for (let k = 0; k < line.length; k++) {
    const [x, y] = line[k];
    const wd = width * (k === line.length - 1 ? 0.7 : 1);
    left.push([x - wd, y]);
    right.push([x + wd, y]);
  }
  const tip = line[line.length - 1];
  const p = new Path2D();
  smoothPath(p, [...left, [tip[0], tip[1] - c.side * 2.2], ...right.reverse()]);
  p.closePath();
  return p;
}

/** Where crista i is when the camera dives into the membrane (its middle). */
export function cristaMid(i: number): Pt {
  const line = cristaLine(CRISTAE[i]);
  return [line[4][0], line[4][1]];
}

/** The cytoplasm round the mitochondrion: a dim warm ground, faint ER, vesicles and two neighbours half seen. */
function bakeAround(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(54,20,62,.92)';
  ctx.fillRect(-420, -420, 840, 840);
  for (let k = 0; k < 9; k++) {
    const y0 = -260 + k * 62 + 10 * hash(k + 51);
    if (Math.abs(y0) < 70) continue;
    ctx.strokeStyle = 'rgba(214,184,255,.1)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let x = -300; x <= 300; x += 10) {
      const y = y0 + 8 * Math.sin(x * 0.03 + k) + 3 * Math.sin(x * 0.11 + k * 2);
      if (x === -300) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = (hash(i * 5 + 31) * 2 - 1) * 300, y = (hash(i * 9 + 33) * 2 - 1) * 300;
    if (Math.abs(y) < 62 && Math.abs(x) < 130) continue;
    dot(ctx, x, y, 1 + 2.4 * hash(i + 35), i % 3 ? '#ffb0c8' : '#ffd8a0', '#fff0f4', 0.22, 0.3);
  }
  drawMito(ctx, -120, -128, 150, 52, 0.18, 0, { seed: 5, alpha: 0.42 });
  drawMito(ctx, 130, 132, 160, 56, -0.12, 0, { seed: 7, alpha: 0.42 });
  drawMito(ctx, 196, -112, 90, 36, 0.9, 0, { seed: 9, alpha: 0.3 });
}

function bakeMito(ctx: CanvasRenderingContext2D): void {
  bakeAround(ctx);
  const outer = outline(0), inner = outline(3.6);
  glowEllipse(ctx, '#ff8aa0', 0, 0, L * 1.25, R * 1.6, 0, 0.18);
  glowEllipse(ctx, '#b07cff', 0, 0, L * 1.5, R * 2.1, 0, 0.1);
  // the space between the membranes
  ctx.fillStyle = 'rgba(120,40,92,.85)';
  ctx.fill(outer);
  // the matrix: warm, granular, lit from within
  const mg = ctx.createRadialGradient(-20, -10, 4, 0, 0, L);
  mg.addColorStop(0, 'rgba(236,120,110,.95)');
  mg.addColorStop(0.5, 'rgba(196,78,100,.95)');
  mg.addColorStop(1, 'rgba(132,44,92,.95)');
  ctx.fillStyle = mg;
  ctx.fill(inner);
  ctx.save();
  ctx.clip(inner);
  for (let i = 0; i < 700; i++) {
    const x = (hash(i * 3 + 5) * 2 - 1) * L, y = (hash(i * 7 + 9) * 2 - 1) * R;
    ctx.fillStyle = i % 5 ? 'rgba(255,214,200,.13)' : 'rgba(90,20,60,.3)';
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + 0.7 * hash(i + 3), 0, TAU);
    ctx.fill();
  }
  // the cristae: the intracristal space darker plum, the membrane bright
  for (const c of CRISTAE) {
    const p = cristaPath(c);
    ctx.fillStyle = 'rgba(104,34,86,.92)';
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(255,214,206,.75)';
    ctx.lineWidth = 0.7;
    ctx.stroke(p);
  }
  // the mitochondrion's own DNA (nucleoids: small rings) and its ribosomes; dark matrix granules
  for (const [i, [x, y]] of ([[-60, 14], [-8, -18], [24, 20], [66, -12], [-34, -24], [92, 8]] as const).entries()) {
    ctx.strokeStyle = 'rgba(160,240,255,.7)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.2, 2.4, i, 0, TAU);
    ctx.stroke();
    glow(ctx, AQUA, x, y, 6, 0.25);
  }
  for (let i = 0; i < 60; i++) dot(ctx, (hash(i * 11 + 61) * 2 - 1) * L * 0.9, (hash(i * 13 + 67) * 2 - 1) * R * 0.75, 0.55, '#fff0e0', null, 0.5);
  for (let i = 0; i < 9; i++) dot(ctx, (hash(i * 17 + 71) * 2 - 1) * L * 0.8, (hash(i * 19 + 73) * 2 - 1) * R * 0.6, 1.3, '#3a1030', '#ffb0a0', 0.6, 0.25);
  ctx.restore();
  // the inner membrane's line and the outer membrane's rim
  ctx.strokeStyle = 'rgba(255,220,210,.8)';
  ctx.lineWidth = 0.8;
  ctx.stroke(inner);
  ctx.strokeStyle = 'rgba(255,190,210,.22)';
  ctx.lineWidth = 4;
  ctx.stroke(outer);
  ctx.strokeStyle = 'rgba(255,244,240,.95)';
  ctx.lineWidth = 1.1;
  ctx.stroke(outer);
}

function drawMitoScene(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  // rest deepens the matrix's warmth
  glowEllipse(ctx, '#ff9a8a', 0, 0, L * 0.9, R * 0.8, 0, 0.08 * st.deep * (0.6 + 0.4 * st.breath));
  const n = CRISTAE.length;
  const inner = outline(3.6);
  ctx.save();
  ctx.clip(inner);
  for (let i = 0; i < n; i++) {
    const on = stagger(g, i, n, 0.22, 0.02, 0.96);
    if (on <= 0.01) continue;
    const c = CRISTAE[i];
    const p = cristaPath(c);
    const pulse = 0.85 + 0.15 * Math.sin(st.time * 2 + i);
    ctx.strokeStyle = rgba(GOLD_HI, 0.9 * on);
    ctx.lineWidth = 0.9;
    ctx.stroke(p);
    ctx.strokeStyle = rgba(GOLD, 0.25 * on * pulse);
    ctx.lineWidth = 3.2;
    ctx.stroke(p);
    const line = cristaLine(c);
    const mid = line[4], tip = line[8];
    glowEllipse(ctx, GOLD, mid[0], mid[1], 6, Math.abs(tip[1] - line[0][1]) * 0.6, 0, 0.3 * on * pulse);
    // ATP: small sparks leaving the crista into the matrix
    for (let k = 0; k < 3; k++) {
      const f = (st.time * 0.4 + k / 3 + i * 0.17) % 1;
      const [lx, ly] = line[2 + k * 2];
      const x = lx + (k % 2 ? 1 : -1) * (2.5 + f * 9), y = ly + Math.sin(f * 6 + k) * 2;
      dot(ctx, x, y, 0.8, GOLD_HI, null, on * (1 - f) * 0.9);
      glow(ctx, GOLD, x, y, 2.6, on * (1 - f) * 0.35);
    }
  }
  ctx.restore();
  // oxygen: pale blue motes drifting in through the membranes
  const o2 = Math.round(16 * Math.max(g, 0.15));
  for (let i = 0; i < o2; i++) {
    const f = (st.time * 0.12 + hash(i + 201)) % 1;
    const a = hash(i * 3 + 203) * TAU;
    const r0 = 1.25, r1 = 0.55;
    const r = r0 + (r1 - r0) * f;
    const x = Math.cos(a) * L * r, y = midY(Math.cos(a) * L * r) + Math.sin(a) * R * r;
    dot(ctx, x, y, 0.9, '#cfe8ff', null, 0.7 * Math.sin(f * Math.PI));
  }
  if (g > 0.98 || st.after > 0) sparkle(ctx, 0, midY(0), 6, 0.3 + 0.2 * Math.sin(st.time * 2));
}

function focusAt(_scene: string, g: number): Pt {
  const n = CRISTAE.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(g * n)));
  return cristaMid(i);
}

export const MITO_WORLD: WorldPainter = {
  depth: 2,
  lens: true,
  bake: ctx => bakeMito(ctx),
  draw: (ctx, st) => {
    drawMitoScene(ctx, st);
    glow(ctx, PEARL, -L * 0.6, midY(-L * 0.6) - R * 0.86, 8, 0.12);
  },
  focusAt,
  counter: (scene, g) => (scene === 'grzebienie' && g > 0.3 ? t('count.grzebienie') : null),
};
