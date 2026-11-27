/**
 * The gut's lining under the lens (DESIGN.md §28, Nowe siły · Cała postać, depth 1): one villus of the small intestine
 * rising into the lumen and the crypts at its foot — a single layer of tall cells with a bright brush border, inside
 * the villus a capillary loop and the pale lacteal; at the crypts' floor the stem cells (aqua) between the Paneth
 * cells (gold grains) (Barker et al. 2007).
 *
 *   jelito   new cells climb from the crypts up both sides of the villus while the oldest let go at its tip: the
 *            whole lining renewed in about 3–5 days (Darwich et al. 2014: 3.5 days on average in people); then the
 *            lining takes in what the body needs — iron, vitamin B12 — and the blood carries it on (to the marrow,
 *            among others)
 */
import { GOLD, TAU, glow, glowEllipse, hash, polyAt, polyLen, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cell, phase, smooth, stemCell } from './draw';
import { tc } from './i18n';

export const JELITO_VIEW = { x: -62, y: -86, w: 124, h: 160 } as const;

const BASE_Y = 22, TIP_Y = -70, VW = 15, CRYPT_X = 30, CRYPT_W = 8, FLOOR_Y = 64;
/** the villi (their middle and tip) and the crypts between them, left to right (the outer ones fill a wide screen) */
const VILLI: readonly [number, number][] = [[-120, -46], [-60, -58], [0, TIP_Y], [60, -56], [120, -48]];
const CRYPTS: readonly number[] = [-150, -90, -CRYPT_X, CRYPT_X, 90, 150];

/** a villus's side from its foot to the tip (side −1: the left side, going up), rounded at the top */
function villusSide(cx: number, tip: number, side: -1 | 1): Pt[] {
  const pts: Pt[] = [];
  for (let y = BASE_Y - 4; y >= tip + 8; y -= 5) pts.push([cx + side * (VW - 0.8 * Math.sin((y - tip) * 0.05)), y]);
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push([cx + side * VW * Math.cos(a), tip + 8 - 8 * Math.sin(a)]);
  }
  return pts;
}
/** a crypt: down one wall, round the floor, up the other (left to right) */
function crypt(cx: number): Pt[] {
  const pts: Pt[] = [];
  for (let y = BASE_Y + 2; y <= FLOOR_Y - 4; y += 4) pts.push([cx - CRYPT_W, y]);
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI - (i / 6) * Math.PI;
    pts.push([cx + Math.cos(a) * CRYPT_W, FLOOR_Y - 4 + Math.sin(a) * 4]);
  }
  for (let y = FLOOR_Y - 4; y >= BASE_Y + 2; y -= 4) pts.push([cx + CRYPT_W, y]);
  return pts;
}
/** the whole apical surface, left to right: crypt, villus, crypt, villus… */
const SURFACE: Pt[] = (() => {
  const out: Pt[] = [[-200, BASE_Y]];
  for (let i = 0; i < CRYPTS.length; i++) {
    out.push(...crypt(CRYPTS[i]));
    const v = VILLI[i];
    if (v) out.push(...villusSide(v[0], v[1], -1), ...villusSide(v[0], v[1], 1).reverse());
  }
  out.push([200, BASE_Y]);
  return out;
})();
/** the growth's two ways: from a crypt's floor up its wall by the middle villus, and up that villus to its tip */
function half(side: -1 | 1): Pt[] {
  const cx = side * CRYPT_X;
  const pts: Pt[] = [[cx, FLOOR_Y]];
  for (let y = FLOOR_Y - 4; y >= BASE_Y + 2; y -= 4) pts.push([cx - side * CRYPT_W, y]);
  pts.push(...villusSide(0, TIP_Y, side));
  return pts;
}
const LEFT = half(-1), RIGHT = half(1);
const STEP = 3.4;
interface Spot { p: Pt; n: Pt }
/** cells along the surface, each with its normal toward the lumen (the surface runs left to right: the lumen is on the left of the way) */
const CELLS: Spot[] = (() => {
  const out: Spot[] = [];
  const L = polyLen(SURFACE);
  for (let d = 1; d < L; d += STEP) {
    const p = polyAt(SURFACE, d / L), q = polyAt(SURFACE, Math.min(1, (d + 0.8) / L));
    const tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1;
    out.push({ p, n: [ty / l, -tx / l] });
  }
  return out;
})();

function bake(ctx: CanvasRenderingContext2D): void {
  // the lumen above, a deep violet with drifting specks
  const g = ctx.createLinearGradient(0, -110, 0, 90);
  g.addColorStop(0, '#1e1236');
  g.addColorStop(1, '#3a1a3a');
  ctx.fillStyle = g;
  ctx.fillRect(-220, -150, 440, 300);
  for (let i = 0; i < 40; i++) glow(ctx, '#ffe8c8', -160 + hash(i * 2.1) * 320, -110 + hash(i * 4.3) * 120, 1 + hash(i) * 1.4, 0.16);
  // the tissue under the surface and inside each villus (lamina propria)
  const tg = ctx.createLinearGradient(0, -70, 0, 110);
  tg.addColorStop(0, '#8a4060');
  tg.addColorStop(1, '#5a2440');
  ctx.fillStyle = tg;
  ctx.beginPath();
  SURFACE.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.lineTo(200, 150);
  ctx.lineTo(-200, 150);
  ctx.closePath();
  ctx.fill();
  // in each villus: a capillary loop and the pale lacteal
  for (const [vx, tip] of VILLI) {
    ctx.strokeStyle = 'rgba(255,90,110,.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(vx - 8, BASE_Y + 20);
    ctx.lineTo(vx - 8, tip + 14);
    ctx.quadraticCurveTo(vx, tip + 6, vx + 8, tip + 14);
    ctx.lineTo(vx + 8, BASE_Y + 20);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,244,214,.5)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(vx, BASE_Y + 24);
    ctx.lineTo(vx, tip + 18);
    ctx.stroke();
  }
  // the lining's cells: tall, the nucleus at the base, a brush border toward the lumen
  for (const c of CELLS) {
    const [x, y] = c.p, [nx, ny] = c.n;
    const rot = Math.atan2(ny, nx);
    cell(ctx, x - nx * 3.6, y - ny * 3.6, 4.1, 1.5, rot, '#f2c6c0', null, 0.95);
    ctx.fillStyle = '#6a4a8a';
    ctx.beginPath();
    ctx.ellipse(x - nx * 5.4, y - ny * 5.4, 1.2, 0.75, rot, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,246,220,.75)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  SURFACE.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
  // every crypt's floor: Paneth cells with gold grains
  for (const cx of CRYPTS) {
    for (const dx of [-4.2, 4.2]) {
      const x = cx + dx, y = FLOOR_Y - 3.4;
      cell(ctx, x, y, 2.8, 2.8, 0, '#f0d4b0', null, 0.95);
      ctx.fillStyle = 'rgba(255,206,120,.95)';
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        ctx.arc(x - 1.1 + (j % 3) * 1.1, y - 0.7 + Math.floor(j / 3) * 1.3, 0.42, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const k = st.g;
  // the stem cells at each crypt's floor, dividing with the scene
  for (const s of [-1, 1]) {
    for (const dx of [-6.4, 0, 6.4]) stemCell(ctx, s * CRYPT_X + dx, FLOOR_Y - (dx ? 5.4 : 1.6), 2, 0.35 + 0.65 * smooth(phase(k, 0, 0.2)), st.time + dx, st.reduced);
  }
  // the new cells climbing: everything below the front is new (a fresh pearl light along the lining)
  const front = smooth(phase(k, 0.04, 0.92));
  if (front > 0) {
    for (const path of [LEFT, RIGHT]) {
      const pts: Pt[] = [];
      for (let q = 0; q <= front + 1e-6; q += 0.02) pts.push(polyAt(path, q));
      if (pts.length < 2) continue;
      for (const [w, a] of [[5.6, 0.16], [2.2, 0.32]] as const) {
        ctx.strokeStyle = rgba('#dff8ff', a);
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
      const f = pts[pts.length - 1];
      glow(ctx, GOLD, f[0], f[1], 5, 0.45);
    }
  }
  // the oldest let go at the tip and drift into the lumen
  const shed = Math.round(7 * smooth(phase(k, 0.1, 1)));
  for (let i = 0; i < shed; i++) {
    const q = st.reduced ? 0.5 : (st.time * 0.05 + hash(i * 3.9)) % 1;
    const x = (hash(i * 1.7) - 0.5) * 18 + (hash(i * 2.3) - 0.5) * 20 * q, y = TIP_Y - 3 - q * 22;
    cell(ctx, x, y, 3.6, 1.5, hash(i) * 3, '#d8b4b8', null, 0.7 * (1 - q));
  }
  // what the lining takes in — iron, vitamin B12 — passes into the blood and away
  const take = smooth(phase(k, 0.55, 1));
  if (take > 0) {
    const n = Math.round(16 * take);
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1;
      const q = st.reduced ? hash(i * 6.1) : (st.time * 0.08 + hash(i * 2.6)) % 1;
      const y0 = TIP_Y + 18 + hash(i * 4.4) * 70;
      let x: number, y: number;
      if (q < 0.5) {
        x = s * (VW + 6 - (VW + 6 - 8) * (q / 0.5));
        y = y0;
      } else {
        x = s * 8;
        y = y0 + (q - 0.5) * 2 * (BASE_Y + 24 - y0);
      }
      glow(ctx, q < 0.5 ? '#ffd98a' : '#ff8a8a', x, y, 1.6, 0.6 * Math.sin(Math.PI * q) * take);
    }
  }
  if (st.deep > 0.02) glowEllipse(ctx, '#ffc0b0', 0, -20, 40, 70, 0, 0.08 * st.deep);
}

export const JELITO_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: ctx => bake(ctx),
  draw,
  focusAt(_scene, g) {
    const f = smooth(phase(g, 0.04, 0.92));
    return g < 0.05 ? [-CRYPT_X, FLOOR_Y - 4] : polyAt(LEFT, f);
  },
  counter(_scene, g) {
    return g > 0.1 ? tc('count.jelito') : null;
  },
};
