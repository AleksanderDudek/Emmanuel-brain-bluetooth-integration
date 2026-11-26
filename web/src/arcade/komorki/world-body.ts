/**
 * The whole body (DESIGN.md §24, Każda komórka): a standing human figure from the front, without features (anyone can
 * see themselves), luminous and translucent on the plum ground — its skin a rim of light, faint vessels, the gut's
 * coils, the heart, the brain, the long bones with their marrow.
 *
 *   tempo  each tissue lights at its own pace — the gut's lining in quick sparks (days), the blood in pulses (months),
 *          the skin a slow wave (weeks), the heart muscle a slow glow (≈ 1 % a year at 25), the cortex steady (a
 *          lifetime): the "every seven years" myth corrected (Spalding 2005; Bergmann 2009)
 *   cialo  the figure fills with small lights from the heart outward — about 30 trillion cells, most of them red
 *          blood cells (Sender, Fuchs & Milo 2016)
 */
import { AQUA, GOLD, GOLD_HI, PEARL, TAU, glow, glowEllipse, hash, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { dot, phase, sparkle, strokeThrough, type P2 } from './draw';
import { t } from './i18n';

/** The right half of the outline, from the top of the head round the arm to the crotch. */
const RIGHT: readonly P2[] = [
  [0, -98], [6, -96.5], [10.5, -91], [11.5, -85], [10, -79], [6.5, -75], [5.5, -71], [8, -67.5], [17, -65.5], [23, -62.5],
  [26, -57], [27.5, -46], [28.5, -34], [30, -22], [32, -8], [34.5, 4], [37, 12], [36, 18], [32.5, 19.5], [30.5, 13],
  [28, 1], [25.5, -12], [23, -26], [21, -37], [19.5, -28], [17, -16], [17.5, -4], [19, 8], [18.5, 22], [17, 40], [15.5, 54],
  [14.5, 68], [13.8, 82], [13.5, 92], [16.5, 96.5], [15.5, 99.5], [8.5, 99.5], [7, 95], [6.5, 84], [6, 70], [5, 56],
  [3.5, 40], [1.5, 26], [0, 22],
];
const OUTLINE: P2[] = [...RIGHT, ...[...RIGHT].reverse().slice(1, -1).map(([x, y]) => [-x, y] as P2)];

/** Inside the outline (a polygon test on its points). */
export function inBody(x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i], [xj, yj] = OUTLINE[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const HEART: P2 = [5, -46];
export const BRAIN: P2 = [0, -88];
export const GUT_AT: P2 = [0, -10];
const GUT_COILS: P2[] = (() => {
  const out: P2[] = [];
  for (let k = 0; k < 7; k++) {
    const y = -24 + k * 3.8;
    const dir = k % 2 ? -1 : 1;
    for (let s = 0; s <= 8; s++) out.push([dir * (-10 + 2.5 * s) + 1.2 * Math.sin(s + k), y + 1.6 * Math.sin(s * 1.3 + k)]);
  }
  return out;
})();
/** The vessels: the aorta down to the legs, the carotids up, an artery in each arm (lines of points). */
const VESSELS: readonly P2[][] = [
  [[4, -44], [3, -30], [2, -10], [1, 6], [8, 14], [11, 40], [11, 70], [10.5, 92]],
  [[1, 6], [-8, 14], [-11, 40], [-11, 70], [-10.5, 92]],
  [[3, -50], [4, -64], [5, -74], [4, -84]],
  [[3, -50], [-4, -64], [-5, -74], [-4, -84]],
  [[5, -52], [18, -60], [26, -42], [29, -20], [33, 2], [35, 12]],
  [[3, -52], [-18, -60], [-26, -42], [-29, -20], [-33, 2], [-35, 12]],
];
const FEMURS: readonly [P2, P2][] = [[[10, 14], [11, 50]], [[-10, 14], [-11, 50]]];

/** Points of light inside the body, from the heart outward (cialo). */
const CELLS: { x: number; y: number; d: number; red: boolean; s: number }[] = (() => {
  const out: { x: number; y: number; d: number; red: boolean; s: number }[] = [];
  for (let i = 0; out.length < 900 && i < 6000; i++) {
    const x = (hash(i * 3 + 1001) * 2 - 1) * 38, y = -98 + hash(i * 7 + 1003) * 198;
    if (!inBody(x, y)) continue;
    out.push({ x, y, d: Math.hypot(x - HEART[0], y - HEART[1]), red: hash(i + 1007) < 0.8, s: hash(i * 11 + 1009) });
  }
  return out.sort((a, b) => a.d + a.s * 18 - (b.d + b.s * 18));
})();

function bodyPath(): Path2D {
  const p = new Path2D();
  const n = OUTLINE.length;
  const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(OUTLINE[n - 1], OUTLINE[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(OUTLINE[i], OUTLINE[(i + 1) % n]);
    p.quadraticCurveTo(OUTLINE[i][0], OUTLINE[i][1], m[0], m[1]);
  }
  p.closePath();
  return p;
}
const BODY = typeof Path2D !== 'undefined' ? bodyPath() : null;

function bakeBody(ctx: CanvasRenderingContext2D): void {
  if (!BODY) return;
  // a halo round the figure, then the body lit from within
  glowEllipse(ctx, '#b07cff', 0, -4, 70, 120, 0, 0.18);
  glowEllipse(ctx, '#ff9ab8', 0, -30, 40, 60, 0, 0.12);
  const g = ctx.createLinearGradient(0, -98, 0, 100);
  g.addColorStop(0, 'rgba(96,52,130,.92)');
  g.addColorStop(0.35, 'rgba(120,52,120,.9)');
  g.addColorStop(0.7, 'rgba(92,40,104,.9)');
  g.addColorStop(1, 'rgba(66,30,86,.92)');
  ctx.fillStyle = g;
  ctx.fill(BODY);
  ctx.save();
  ctx.clip(BODY);
  glowEllipse(ctx, '#ffb0c8', 0, -40, 24, 30, 0, 0.18);
  // faint vessels, the brain, the heart, the gut's coils, the long bones
  for (const v of VESSELS) strokeThrough(ctx, v, '#ff6a80', 1.2, 0.28);
  ctx.fillStyle = 'rgba(200,170,255,.3)';
  ctx.beginPath();
  ctx.ellipse(BRAIN[0], BRAIN[1], 8.6, 7.2, 0, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 6; k++) {
    ctx.strokeStyle = 'rgba(240,226,255,.3)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(BRAIN[0] + (k - 2.5) * 2.6, BRAIN[1] + (k % 2) * 2 - 1, 2.4, 0.3, 2.8);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,110,140,.4)';
  ctx.beginPath();
  ctx.ellipse(HEART[0], HEART[1], 4.6, 5.4, 0.5, 0, TAU);
  ctx.fill();
  strokeThrough(ctx, GUT_COILS, '#ffc0a0', 1.6, 0.25);
  for (const [a, b] of FEMURS) strokeThrough(ctx, [a, b], '#ffe6c8', 3.4, 0.22);
  ctx.restore();
  // the skin: a rim of light
  ctx.strokeStyle = 'rgba(255,214,236,.25)';
  ctx.lineWidth = 3;
  ctx.stroke(BODY);
  ctx.strokeStyle = 'rgba(255,244,250,.8)';
  ctx.lineWidth = 0.7;
  ctx.stroke(BODY);
}

/** A point along a polyline at share k (linear). */
function at(pts: readonly P2[], k: number): P2 {
  const n = pts.length - 1, f = Math.max(0, Math.min(1, k)) * n;
  const i = Math.min(n - 1, Math.floor(f)), u = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
}

function drawTempo(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g, T = st.time;
  const gut = phase(g, 0.03, 0.2), blood = phase(g, 0.22, 0.4), skin = phase(g, 0.42, 0.6), heart = phase(g, 0.62, 0.8), cortex = phase(g, 0.82, 0.98);
  // the gut: quick sparks all along its coils (days)
  if (gut > 0) {
    glowEllipse(ctx, '#ffc0a0', GUT_AT[0], GUT_AT[1] - 2, 14, 16, 0, 0.25 * gut);
    for (let i = 0; i < 14; i++) {
      const f = (T * 1.6 + i * 0.37) % 1;
      const [x, y] = at(GUT_COILS, (hash(i + Math.floor(T * 1.6 + i * 0.37) * 13) + 0.0001) % 1);
      sparkle(ctx, x, y, 2.6, gut * Math.sin(f * Math.PI));
    }
  }
  // the blood: pulses along the vessels, the marrow warm in the long bones (months)
  if (blood > 0) {
    for (const [a, b] of FEMURS) strokeThrough(ctx, [a, b], '#ff5470', 3, 0.5 * blood);
    for (const [k, v] of VESSELS.entries()) {
      for (let j = 0; j < 2; j++) {
        const f = (T * 0.3 + j * 0.5 + k * 0.17) % 1;
        const [x, y] = at(v, f);
        glow(ctx, '#ff5470', x, y, 3.4, 0.7 * blood);
        dot(ctx, x, y, 0.9, '#ffb0b8', null, blood);
      }
    }
  }
  // the skin: a slow wave of light climbing the outline (weeks)
  if (skin > 0) {
    const yW = 100 - ((T * 12) % 220);
    for (let i = 0; i < OUTLINE.length; i++) {
      const [x, y] = OUTLINE[i];
      const near = Math.max(0, 1 - Math.abs(y - yW) / 26);
      if (near > 0.02) glow(ctx, PEARL, x, y, 4, 0.5 * skin * near);
    }
  }
  // the heart: a slow, steady glow (years)
  if (heart > 0) glow(ctx, '#ff8aa0', HEART[0], HEART[1], 11, heart * (0.45 + 0.1 * Math.sin(T * 0.6)));
  // the cortex: steady light (a lifetime)
  if (cortex > 0) {
    glowEllipse(ctx, '#e0c8ff', BRAIN[0], BRAIN[1], 12, 10, 0, 0.6 * cortex);
    glow(ctx, GOLD_HI, BRAIN[0], BRAIN[1], 5, 0.3 * cortex);
  }
  const stops: Pt[] = [GUT_AT, [10, 30], [-28, -40], HEART, BRAIN];
  return stops[Math.min(4, Math.floor(g * 5))];
}

function drawWhole(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  const n = Math.floor(CELLS.length * Math.min(1, g * 1.02));
  let last: Pt = HEART;
  for (let i = 0; i < n; i++) {
    const c = CELLS[i];
    const tw = 0.65 + 0.35 * Math.sin(st.time * (0.8 + c.s) + i);
    if (c.red) dot(ctx, c.x, c.y, 0.75, '#ff6a80', null, 0.85 * tw);
    else dot(ctx, c.x, c.y, 0.7, c.s > 0.66 ? AQUA : c.s > 0.33 ? GOLD_HI : PEARL, null, 0.9 * tw);
    if (i > n - 12) {
      glow(ctx, GOLD, c.x, c.y, 3, 0.5);
      last = [c.x, c.y];
    }
  }
  glowEllipse(ctx, GOLD, 0, -10, 40, 100, 0, 0.12 * g + 0.06 * st.deep * (0.6 + 0.4 * st.breath));
  glow(ctx, '#ff8aa0', HEART[0], HEART[1], 9, 0.3 + 0.2 * g);
  return last;
}

export const BODY_WORLD: WorldPainter = {
  depth: 0,
  lens: false,
  bake: ctx => bakeBody(ctx),
  draw: (ctx, st) => {
    if (st.scene === 'cialo') drawWhole(ctx, st);
    else drawTempo(ctx, st);
  },
  focusAt(scene, g) {
    if (scene === 'cialo') {
      const n = Math.max(0, Math.min(CELLS.length - 1, Math.floor(CELLS.length * g) - 1));
      return [CELLS[n].x, CELLS[n].y];
    }
    const stops: Pt[] = [GUT_AT, [10, 30], [-28, -40], HEART, BRAIN];
    return stops[Math.min(4, Math.floor(g * 5))];
  },
  counter: (scene, g) => (scene === 'cialo' && g > 0.2 ? t('count.cialo') : null),
};
