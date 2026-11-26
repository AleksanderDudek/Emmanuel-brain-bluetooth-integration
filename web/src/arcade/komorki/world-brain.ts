/**
 * Brain tissue at night (DESIGN.md §24, Każda komórka · Noc odnowy · "Płyn w mózgu"): neurons (warm cell bodies,
 * their dendrites), star-shaped astrocytes whose end-feet wrap the vessels, an arteriole on the left and a venule on
 * the right, each in its sleeve of fluid.  As the scene grows the clear fluid (aqua) runs down along the arteriole,
 * spreads through the spaces between the cells and leaves along the venule, carrying small motes of waste.
 *
 * Said honestly on screen: this was seen in mice (Xie et al. 2013: the spaces between the cells ≈ 60 % wider in sleep,
 * faster clearance); a later mouse study found the opposite (Miao et al. 2024); in people we know less.
 */
import { AQUA, TAU, glow, glowEllipse, hash, rgba, smoothPath, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { blobPath, dot, sparkle, type P2 } from './draw';
import { t } from './i18n';

export const ART_X = -52, VEN_X = 62;
const ART_W = 7, VEN_W = 8, SLEEVE = 3.4;
/** A vessel's middle line (it wanders a little). */
const vx = (x0: number, y: number, k: number): number => x0 + 4 * Math.sin(y * 0.03 + k);
export const NEURONS: readonly P2[] = [[-14, -40], [20, 10], [-10, 44], [30, -52], [100, -30], [-96, 30], [96, 48]];
export const ASTROS: readonly P2[] = [[-28, 0], [36, -22], [80, 10], [-80, -40]];

function vesselPath(x0: number, w: number, k: number): Path2D {
  const left: P2[] = [], right: P2[] = [];
  for (let y = -400; y <= 400; y += 8) {
    left.push([vx(x0, y, k) - w, y]);
    right.push([vx(x0, y, k) + w, y]);
  }
  const p = new Path2D();
  smoothPath(p, [...left, ...right.reverse()]);
  p.closePath();
  return p;
}

function bakeBrain(ctx: CanvasRenderingContext2D): void {
  // the neuropil: deep violet, fine fibres everywhere
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 180);
  g.addColorStop(0, 'rgba(70,36,110,.98)');
  g.addColorStop(1, 'rgba(36,18,64,.98)');
  ctx.fillStyle = g;
  ctx.fillRect(-420, -420, 840, 840);
  for (let i = 0; i < 360; i++) {
    const x = (hash(i * 3 + 1301) * 2 - 1) * 170, y = (hash(i * 7 + 1303) * 2 - 1) * 120;
    ctx.strokeStyle = i % 3 ? 'rgba(200,180,255,.07)' : 'rgba(255,214,236,.1)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 6, y - 3, x + 10, y + 4, x + 16 * hash(i + 1305), y + 6 * (hash(i + 1307) - 0.5));
    ctx.stroke();
  }
  // the vessels in their sleeves: the arteriole warm red, the venule darker
  for (const [x0, w, k, col] of [[ART_X, ART_W, 0, 'rgba(200,40,70,.9)'], [VEN_X, VEN_W, 2, 'rgba(120,40,110,.9)']] as const) {
    ctx.fillStyle = 'rgba(80,140,170,.28)';
    ctx.fill(vesselPath(x0, w + SLEEVE, k));
    ctx.fillStyle = col;
    ctx.fill(vesselPath(x0, w, k));
    ctx.strokeStyle = 'rgba(255,214,230,.55)';
    ctx.lineWidth = 0.5;
    ctx.stroke(vesselPath(x0, w, k));
    // the astrocytes' end-feet tiling the sleeve's outer wall
    for (let y = -396; y <= 396; y += 7) {
      for (const s of [-1, 1]) {
        const x = vx(x0, y, k) + s * (w + SLEEVE + 1.2);
        ctx.fillStyle = 'rgba(190,160,255,.55)';
        ctx.beginPath();
        ctx.ellipse(x, y, 1.6, 3.2, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
  // astrocytes: stars of lilac with processes reaching the vessels
  for (const [i, [x, y]] of ASTROS.entries()) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + hash(i * 9 + k) * 0.5, len = 12 + 10 * hash(i * 13 + k);
      ctx.strokeStyle = 'rgba(200,170,255,.5)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * len * 0.5, y + Math.sin(a + 0.4) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(200,170,255,.85)';
    ctx.fill(blobPath(x, y, 3.6, 3.2, i + 70, 0.15, 10));
  }
  // neurons: warm bodies with dendrites and an axon
  for (const [i, [x, y]] of NEURONS.entries()) {
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.7 + 0.2 * hash(i * 7 + k), len = 16 + 14 * hash(i * 11 + k);
      ctx.strokeStyle = 'rgba(255,200,170,.45)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 3, y + Math.sin(a) * len * 0.5, ex, ey);
      ctx.stroke();
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a + 0.6) * 6, ey + Math.sin(a + 0.6) * 6);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a - 0.6) * 6, ey + Math.sin(a - 0.6) * 6);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,220,190,.35)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.bezierCurveTo(x + 3, y + 20, x - 4, y + 34, x + 2, y + 50);
    ctx.stroke();
    const body = new Path2D();
    body.moveTo(x, y - 6.5);
    body.quadraticCurveTo(x + 5.5, y + 1, x + 4.2, y + 4.2);
    body.quadraticCurveTo(x, y + 6, x - 4.2, y + 4.2);
    body.quadraticCurveTo(x - 5.5, y + 1, x, y - 6.5);
    const bg = ctx.createRadialGradient(x - 1, y, 0, x, y, 6);
    bg.addColorStop(0, 'rgba(255,214,170,.98)');
    bg.addColorStop(1, 'rgba(220,120,120,.95)');
    ctx.fillStyle = bg;
    ctx.fill(body);
    dot(ctx, x, y + 0.5, 1.5, '#7a4a9a', null, 0.8);
    glow(ctx, '#ffcf9a', x, y, 10, 0.25);
  }
}

function drawFlow(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g, T = st.time;
  const flow = 0.15 + 0.85 * g;
  // the sleeves brighten as the fluid runs
  for (const [x0, w, k] of [[ART_X, ART_W, 0], [VEN_X, VEN_W, 2]] as const) {
    ctx.fillStyle = rgba(AQUA, 0.05 + 0.16 * g);
    ctx.fill(vesselPath(x0, w + SLEEVE, k));
    ctx.fillStyle = 'rgba(0,0,0,0)';
  }
  // down the arteriole's sleeve
  const nDown = Math.round(10 + 22 * g);
  for (let i = 0; i < nDown; i++) {
    const f = (T * (0.05 + 0.06 * flow) + i / nDown) % 1;
    const y = -130 + 260 * f;
    for (const s of [-1, 1]) {
      const x = vx(ART_X, y, 0) + s * (ART_W + SLEEVE / 2);
      dot(ctx, x, y, 1.1, AQUA, '#ffffff', 0.9 * flow, 0.2);
      glow(ctx, AQUA, x, y, 3.6, 0.45 * flow);
    }
  }
  // across, between the cells, toward the venule (carrying waste)
  const nX = Math.round(8 + 44 * g);
  let front: Pt = [ART_X, 0];
  for (let i = 0; i < nX; i++) {
    const f = (T * (0.03 + 0.05 * flow) + hash(i + 1401)) % 1;
    const y0 = -100 + 200 * hash(i * 3 + 1403);
    const x = ART_X + ART_W + SLEEVE + f * (VEN_X - ART_X - ART_W - VEN_W - 2 * SLEEVE);
    const y = y0 + 10 * Math.sin(f * 5 + i) + 6 * Math.sin(f * 11 + i * 0.7);
    const a = Math.sin(f * Math.PI) * flow;
    ctx.strokeStyle = rgba(AQUA, 0.45 * a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 0.8 * Math.cos(f * 5 + i));
    ctx.lineTo(x, y);
    ctx.stroke();
    dot(ctx, x, y, 1, AQUA, '#ffffff', 0.9 * a, 0.2);
    glow(ctx, AQUA, x, y, 3, 0.35 * a);
    if (i % 3 === 0) dot(ctx, x + 1.4, y + 1, 0.9, '#8a7a9a', '#d8cce0', 0.85 * a, 0.2);
    if (i === nX - 1) front = [x, y];
  }
  // out along the venule's sleeve, with the waste
  const nOut = Math.round(4 + 18 * g);
  for (let i = 0; i < nOut; i++) {
    const f = (T * (0.04 + 0.05 * flow) + i / nOut) % 1;
    const y = -130 + 260 * f;
    const x = vx(VEN_X, y, 2) - (VEN_W + SLEEVE / 2);
    dot(ctx, x, y, 0.9, AQUA, null, 0.7 * flow);
    if (i % 2 === 0) dot(ctx, x + 0.8, y + 1.5, 0.9, '#8a7a9a', '#d8cce0', 0.8 * flow, 0.2);
  }
  glowEllipse(ctx, AQUA, (ART_X + VEN_X) / 2, 0, 90, 110, 0, 0.05 * g + 0.04 * st.deep * (0.6 + 0.4 * st.breath));
  if (g > 0.95 || st.after > 0) sparkle(ctx, ART_X, -60, 4, 0.4 + 0.3 * Math.sin(T * 2));
  return front;
}

export const BRAIN_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: ctx => bakeBrain(ctx),
  draw: (ctx, st) => {
    drawFlow(ctx, st);
  },
  focusAt: (_s, g) => [ART_X + ART_W + SLEEVE + g * (VEN_X - ART_X - ART_W - VEN_W - 2 * SLEEVE), -10 + 20 * Math.sin(g * 3)],
  counter: (_s, g) => (g > 0.15 ? t('count.mozg') : null),
};

export const vesselX = vx;
