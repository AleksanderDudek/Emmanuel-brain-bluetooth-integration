/**
 * Red bone marrow (DESIGN.md §24, Każda komórka · Odnowa tkanek · "Szpik kostny"): inside spongy bone — struts of
 * bone (trabeculae, cream and gold, their lamellae and the small osteocytes), the marrow between them crowded with
 * young blood cells, pale fat cells, one great megakaryocyte by a wide sinusoid where the new cells enter the blood.
 * Near the vessel two blood-forming stem cells (aqua).  As the scene grows the stem cells divide and their daughters
 * ripen along the way to the sinusoid — aqua to lilac to rose, the nucleus let go, a red disc — and pour into the
 * stream: about 330 billion cells renewed in a body each day, nearly 90 % of them blood cells (Sender & Milo 2021);
 * a red cell lives ≈ 115–120 days (Franco 2012).
 */
import { AQUA, GOLD_HI, TAU, glow, glowEllipse, hash, mix, rgba, smoothPath, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { dot, sparkle, type P2 } from './draw';
import { t } from './i18n';

/** The sinusoid's middle line (left to right) and its half width. */
const SIN: readonly P2[] = [[-170, 4], [-110, -6], [-60, 6], [-10, 0], [40, -10], [90, 2], [170, -6]];
const SIN_W = 9;
/** The trabeculae: thick bands of bone (points along their middle, their half width). */
const TRAB: readonly { pts: readonly P2[]; w: number }[] = [
  { pts: [[-200, -70], [-120, -62], [-70, -72], [-20, -64], [20, -76], [70, -66], [200, -78]], w: 9 },
  { pts: [[-200, 72], [-110, 66], [-50, 76], [10, 70], [60, 80], [200, 70]], w: 10 },
  { pts: [[-200, -150], [-80, -140], [40, -152], [200, -142]], w: 12 },
  { pts: [[-200, 150], [-60, 142], [60, 154], [200, 146]], w: 12 },
  { pts: [[-96, -64], [-104, -30], [-92, -14]], w: 5 },
  { pts: [[104, 70], [110, 44], [100, 26]], w: 5 },
];
export const STEMS: readonly P2[] = [[-52, 30], [34, -36]];
/** Each stem cell's way to the vessel (its daughters ripen along it). */
const WAYS: readonly (readonly P2[])[] = [
  [[-52, 30], [-46, 24], [-40, 18], [-34, 11]],
  [[34, -36], [38, -28], [40, -21], [41, -14]],
];
const MEGA: P2 = [8, 22];
const FAT: readonly (readonly [number, number, number])[] = [[-130, 34, 13], [-80, -40, 11], [90, 40, 14], [130, -36, 12], [-12, -42, 10], [66, -44, 9]];

/** A point on a smooth polyline at share k (linear between samples; the lines are gentle). */
function along(pts: readonly P2[], k: number): P2 {
  const n = pts.length - 1;
  const f = Math.max(0, Math.min(1, k)) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const u = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
}

function bakeMarrow(ctx: CanvasRenderingContext2D): void {
  // the marrow's ground: a warm red-plum stroma
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 190);
  g.addColorStop(0, 'rgba(126,36,72,.98)');
  g.addColorStop(1, 'rgba(70,20,56,.98)');
  ctx.fillStyle = g;
  ctx.fillRect(-420, -420, 840, 840);
  // fat cells: large, pale, almost empty
  for (const [x, y, r] of FAT) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = 'rgba(255,236,214,.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,226,.55)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    dot(ctx, x + r * 0.6, y + r * 0.55, 1, '#c8a0c0', null, 0.6);
  }
  // the young blood cells crowding the spaces (not on the vessel, the bone or the fat)
  const free = (x: number, y: number): boolean => {
    for (const [fx, fy, r] of FAT) if (Math.hypot(x - fx, y - fy) < r + 2) return false;
    if (Math.hypot(x - MEGA[0], y - MEGA[1]) < 12) return false;
    return Math.abs(y - along(SIN, (x + 170) / 340)[1]) > SIN_W + 3 && y > -58 && y < 60;
  };
  const tints = ['#c58bd8', '#e88aa8', '#d870a0', '#b07ad0', '#f0a0a0', '#e05a78'];
  for (let i = 0; i < 400; i++) {
    const x = (hash(i * 3 + 701) * 2 - 1) * 170, y = (hash(i * 7 + 703) * 2 - 1) * 70;
    if (!free(x, y)) continue;
    const r = 2 + 1.4 * hash(i + 707);
    const c = tints[i % tints.length];
    dot(ctx, x, y, r, c, '#ffe6f0', 0.62, 0.25);
    if (i % 6 !== 5) dot(ctx, x + 0.3, y - 0.2, r * 0.5, '#5a2a70', null, 0.6);
  }
  // the megakaryocyte: big, lobed, with platelets budding toward the vessel
  ctx.fillStyle = 'rgba(214,150,220,.75)';
  ctx.beginPath();
  ctx.arc(MEGA[0], MEGA[1], 10, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,250,.7)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  for (let k = 0; k < 5; k++) dot(ctx, MEGA[0] + Math.cos(k * 1.3) * 4, MEGA[1] + Math.sin(k * 1.3) * 3.4, 2.4, '#6a3a90', null, 0.85);
  for (let k = 0; k < 6; k++) dot(ctx, MEGA[0] - 6 + k * 2.4, MEGA[1] - 11.5 - (k % 2), 0.7, '#ffd0e0', null, 0.8);
  // the sinusoid: a wide, thin-walled vessel
  const top: P2[] = SIN.map(([x, y]) => [x, y - SIN_W]);
  const bot: P2[] = SIN.map(([x, y]) => [x, y + SIN_W]);
  const vessel = new Path2D();
  smoothPath(vessel, [...top, ...[...bot].reverse()]);
  vessel.closePath();
  ctx.fillStyle = 'rgba(176,30,56,.85)';
  ctx.fill(vessel);
  glowEllipse(ctx, '#ff5470', 0, 0, 170, 16, 0, 0.18);
  for (const edge of [top, bot]) {
    const p = new Path2D();
    smoothPath(p, edge);
    ctx.strokeStyle = 'rgba(255,200,200,.7)';
    ctx.lineWidth = 0.6;
    ctx.stroke(p);
  }
  // the trabeculae: bone, cream to gold, its lamellae and osteocytes
  for (const [k, tr] of TRAB.entries()) {
    const p = new Path2D();
    smoothPath(p, tr.pts);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,220,170,.18)';
    ctx.lineWidth = tr.w * 2 + 6;
    ctx.stroke(p);
    ctx.strokeStyle = 'rgba(236,200,150,.95)';
    ctx.lineWidth = tr.w * 2;
    ctx.stroke(p);
    ctx.strokeStyle = 'rgba(255,240,210,.5)';
    ctx.lineWidth = tr.w * 1.2;
    ctx.stroke(p);
    for (let l = -2; l <= 2; l++) {
      const q = new Path2D();
      smoothPath(q, tr.pts.map(([x, y]) => [x, y + l * tr.w * 0.32] as P2));
      ctx.strokeStyle = 'rgba(180,130,90,.3)';
      ctx.lineWidth = 0.35;
      ctx.stroke(q);
    }
    for (let i = 0; i < 14; i++) {
      const [x, y] = along(tr.pts, hash(i * 5 + k * 31 + 711));
      ctx.fillStyle = 'rgba(120,80,60,.6)';
      ctx.beginPath();
      ctx.ellipse(x, y + (hash(i + k) - 0.5) * tr.w, 1.4, 0.6, 0.2, 0, TAU);
      ctx.fill();
    }
  }
}

/** A cell ripening on its way (0 stem … 1 a red disc in the vessel). */
function ripeCell(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, a: number): void {
  const col = k < 0.33 ? mix(AQUA, '#c59bff', k / 0.33) : k < 0.66 ? mix('#c59bff', '#ff7a9a', (k - 0.33) / 0.33) : mix('#ff7a9a', '#ff3a5a', (k - 0.66) / 0.34);
  const r = 3.4 - 0.9 * k;
  dot(ctx, x, y, r, col, '#fff0f4', a, 0.35);
  if (k < 0.8) dot(ctx, x + 0.3, y - 0.2, r * (0.55 - 0.25 * k), '#4a2070', null, a * 0.9);
  else {
    ctx.fillStyle = rgba('#a01a3a', a * 0.6);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.4, r * 0.32, 0, 0, TAU);
    ctx.fill();
  }
}

function drawMarrow(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  // the stream in the sinusoid: red discs flowing, more as the scene grows
  const n = Math.round(10 + 34 * g);
  for (let i = 0; i < n; i++) {
    const k = ((st.time * 0.035 + hash(i + 721)) % 1);
    const [x, y] = along(SIN, k);
    const off = (hash(i * 3 + 723) * 2 - 1) * (SIN_W - 3);
    ctx.fillStyle = 'rgba(255,70,96,.95)';
    ctx.beginPath();
    ctx.ellipse(x, y + off, 2.6, 2.1, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,16,46,.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + off, 1, 0.8, 0.3, 0, TAU);
    ctx.fill();
  }
  // the stem cells: aqua, dividing (a flash and a twin)
  for (const [s, [x, y]] of STEMS.entries()) {
    const f = (st.time * 0.4 + s * 0.5) % 1;
    const div = Math.max(0, Math.sin(f * Math.PI)) ** 4 * (0.3 + 0.7 * Math.min(1, g * 3));
    dot(ctx, x, y, 3.8, AQUA, '#ffffff', 1, 0.4);
    dot(ctx, x + 0.3, y - 0.2, 1.8, '#2a7090', null, 0.9);
    glow(ctx, AQUA, x, y, 9, 0.35 + 0.35 * div);
    if (div > 0.4) {
      dot(ctx, x - 4 * div, y + 3 * div, 3, AQUA, '#ffffff', div, 0.3);
      sparkle(ctx, x, y, 4, div);
    }
  }
  // their daughters ripening on the way to the vessel, then into it
  let front: Pt = STEMS[0];
  for (const [w, way] of WAYS.entries()) {
    const cells = Math.round(2 + 6 * g);
    for (let c = 0; c < cells; c++) {
      const k = (st.time * (0.05 + 0.08 * g) + c / cells + w * 0.3) % 1;
      const [x, y] = along(way, k);
      ripeCell(ctx, x, y, k, 0.4 + 0.6 * Math.min(1, g * 2));
    }
    front = along(way, 0.3 + 0.6 * g);
  }
  glowEllipse(ctx, '#ff5470', 0, 0, 160, 20, 0, 0.12 * g + 0.06 * st.deep * (0.6 + 0.4 * st.breath));
  if (g > 0.95 || st.after > 0) glow(ctx, GOLD_HI, 0, 0, 30, 0.06);
  return front;
}

export const MARROW_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: ctx => bakeMarrow(ctx),
  draw: (ctx, st) => {
    drawMarrow(ctx, st);
  },
  focusAt: (_s, g) => along(WAYS[0], 0.15 + 0.75 * g),
  counter: (_s, g) => (g > 0.3 ? t('count.szpik') : null),
};

export const SINUSOID_AT = (x: number): P2 => along(SIN, (x + 170) / 340);
