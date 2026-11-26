/**
 * The figure in profile (DESIGN.md §24, Lekkość i siła · "Pierś i postawa"): the body of light facing left, in the
 * chosen silhouette, featureless but for the line of the face, the arm hanging at its side.  World units: the
 * figure's ×100 (geo.ts), the crown at (0, 0).
 *
 *   piersiowy  the chest muscle (pectoralis major) lights as a fan from the collarbone and the breastbone to the
 *              upper arm, under the line of the chest; for `ona` it lies beneath the breast (drawn only as the
 *              figure's soft outline) — training strengthens the muscle; it does not change the breast's own tissue
 *   wyprost    from a sunk posture (head forward, shoulders rounded) the body rises upright: the shoulder blades
 *              draw back, the head comes over the shoulders, the line of the chest lifts; the plumb line from the
 *              ear through the shoulder and the hip to the ankle lights as they align (Lynch et al. 2010)
 */
import { GOLD, GOLD_HI, TAU, glow, glowEllipse, rgba } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { figureLight, growSparks, lightLine, phase, sparkle, stagger } from './draw';
import { F, lookOf, profileArmPath, profilePath, profilePlaces, up, type Look, type P } from './geo';
import { MUSCLE, PEARL_W } from './palette';

const W = (p: P): [number, number] => [p[0] * F, p[1] * F];

/** The posture of a scene at a growth (1 upright). */
export function postureOf(scene: string, g: number): number {
  if (scene === 'wyprost') return 0.08 + 0.92 * phase(g, 0.05, 0.9);
  return 1;
}

function bake(ctx: CanvasRenderingContext2D): void {
  // the ground's warmth under the feet; the figure itself moves, so it is drawn each frame
  glowEllipse(ctx, '#ffb89a', -1.5, 99.6, 14, 2.4, 0, 0.18);
}

/** The pectoral fan: fibres from the collarbone and the breastbone (on the chest wall) to the upper arm. */
function pectoral(ctx: CanvasRenderingContext2D, st: WorldState, look: Look, u: number, k: number): void {
  const pl = profilePlaces(look, u);
  const ins = W(pl.insertion);
  const wall = look === 'on' ? -0.058 : -0.046;
  const n = 11;
  // the muscle's body, a soft coral fan
  const fan = new Path2D();
  const origins: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const y = 0.2 + (0.105 * i) / (n - 1);
    const off = profilePlaces(look, u).sternum[0] - (-0.05); // follows the chest as the posture moves
    const sl = (1 - u) * 0.012 * Math.exp(-(((y - 0.27) / 0.06) ** 2));
    origins.push(W([wall + off + sl + (i === 0 ? 0.012 : 0) + 0.004 * Math.sin(i), y + (1 - u) * 0.01]));
  }
  fan.moveTo(...ins);
  for (const o of origins) fan.lineTo(...o);
  fan.closePath();
  ctx.fillStyle = rgba(MUSCLE, 0.1 + 0.32 * k);
  ctx.fill(fan);
  glowEllipse(ctx, '#ff9a86', (ins[0] + origins[5][0]) / 2, (ins[1] + origins[5][1]) / 2, 4, 5.5, 0, 0.28 * k);
  for (const [i, o] of origins.entries()) {
    const a = stagger(k, i, n, 0, 1, 3);
    const mid: [number, number] = [(o[0] + ins[0]) / 2 + 0.4, (o[1] + ins[1]) / 2 - 0.3];
    lightLine(ctx, [o, mid, ins], 0.55 / st.px * 1.5, i % 3 ? '#ffb39a' : GOLD, 0.16 + 0.75 * a, 0.4);
  }
  glow(ctx, GOLD, ins[0], ins[1], 2.6, 0.3 * k);
}

/** The ribs of the chest wall, faint arcs behind the muscle. */
function ribs(ctx: CanvasRenderingContext2D, st: WorldState, look: Look, u: number): void {
  const off = profilePlaces(look, u).sternum[0] + 0.05;
  ctx.strokeStyle = 'rgba(255,236,226,.12)';
  ctx.lineWidth = 0.6 / st.px;
  for (let i = 0; i < 6; i++) {
    const y = 0.215 + i * 0.022;
    const sl = (1 - u) * 0.01;
    ctx.beginPath();
    ctx.moveTo(...W([(look === 'on' ? -0.056 : -0.046) + off + sl, y + sl]));
    ctx.quadraticCurveTo(...W([-0.01 + off * 0.5, y - 0.012]), ...W([0.035 + (1 - u) * 0.015, y + 0.02]));
    ctx.stroke();
  }
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const look = lookOf(st.look);
  const g = st.g;
  const u = postureOf(st.scene, g);
  const body = profilePath(look, u, up);
  const arm = profileArmPath(look, u, up);
  if (st.deep > 0.02) glowEllipse(ctx, '#ffcdb0', -2, 28, 12, 16, 0, 0.1 * st.deep);
  const pl = profilePlaces(look, u);
  // the plumb line of the upright body (ear · shoulder · hip · ankle), behind the figure
  const align = st.scene === 'wyprost' ? phase(g, 0.55, 1) : 0.3;
  ctx.save();
  ctx.setLineDash([1.1, 1.6]);
  ctx.strokeStyle = rgba(GOLD, 0.12 + 0.45 * align);
  ctx.lineWidth = 0.6 / st.px;
  ctx.beginPath();
  ctx.moveTo(0.6, -3);
  ctx.lineTo(0.6, 100);
  ctx.stroke();
  ctx.restore();
  figureLight(ctx, body, 0, 100, { midX: 0, mid: 0.6 });
  ctx.save();
  ctx.clip(body);
  ribs(ctx, st, look, u);
  if (st.scene === 'piersiowy') pectoral(ctx, st, look, u, phase(g, 0, 0.85));
  else pectoral(ctx, st, look, u, 0.15 + 0.35 * phase(g, 0.4, 1));
  // the upper back: the muscles that draw the shoulder blades back light as the body rises
  if (st.scene === 'wyprost') {
    const k = phase(g, 0.15, 0.8);
    for (let i = 0; i < 5; i++) {
      const y = 0.2 + i * 0.022;
      const bx = 0.045 + (1 - u) * 0.02 * Math.exp(-(((y - 0.235) / 0.065) ** 2));
      lightLine(ctx, [W([bx, y]), W([bx - 0.02, y + 0.01])], 0.45 / st.px * 1.5, i % 2 ? MUSCLE : GOLD, 0.15 + 0.55 * stagger(k, i, 5, 0, 1, 2), 0.35);
    }
  }
  ctx.restore();
  // the arm in front, a little lighter, its own rim
  figureLight(ctx, arm, 20, 57, { alpha: 0.6, mid: 0.25, midX: pl.shoulder[0] * F });
  if (st.scene === 'piersiowy') {
    // the muscle's fan again over the arm, softly, so its whole shape reads
    ctx.save();
    ctx.globalAlpha *= 0.45;
    pectoral(ctx, st, look, u, phase(g, 0, 0.85));
    ctx.restore();
  }
  // the deltoid's cap at the shoulder
  const [sx, sy] = W(pl.shoulder);
  glowEllipse(ctx, '#ffb59a', sx - 0.4, sy + 1.6, 2.6, 3.6, 0.2, 0.12 + 0.2 * (st.scene === 'piersiowy' ? phase(g, 0.5, 1) : phase(g, 0.4, 1)));
  if (st.scene === 'wyprost') {
    // the landmarks on the plumb line (ear, shoulder, hip, ankle): small rings the body comes into, gold as they align;
    // the shoulder's own point rides with the body (no mark on the featureless head)
    [21.2, 50, 94].forEach((y, i) => {
      const a = 0.3 + 0.7 * align;
      ctx.strokeStyle = rgba(i < 1 ? GOLD_HI : PEARL_W, 0.35 + 0.55 * align);
      ctx.lineWidth = 0.6 / st.px;
      ctx.beginPath();
      ctx.arc(0.6, y, 1.2, 0, TAU);
      ctx.stroke();
      glow(ctx, i < 1 ? GOLD : PEARL_W, 0.6, y, 2.6, 0.22 * a);
    });
    const [shx, shy] = W(pl.shoulder);
    ctx.fillStyle = rgba(GOLD_HI, 0.6 + 0.4 * align);
    ctx.beginPath();
    ctx.arc(shx, shy, 0.7, 0, TAU);
    ctx.fill();
    // the chest's line lifting: a gold arc along the front of the chest
    const lift = phase(g, 0.3, 1);
    const c = W(pl.chest), cl = W(pl.clavicle);
    ctx.strokeStyle = rgba(GOLD_HI, 0.15 + 0.6 * lift);
    ctx.lineWidth = 1.1 / st.px;
    ctx.beginPath();
    ctx.moveTo(cl[0] - 1.2, cl[1]);
    ctx.quadraticCurveTo(c[0] - 2.4, (cl[1] + c[1]) / 2, c[0] - 0.9, c[1] + 2);
    ctx.stroke();
    if (lift > 0.98) sparkle(ctx, c[0] - 1.5, c[1] - 3, 2.4, 0.9);
  }
  if (st.growing) {
    const f = focusAt(st.scene, g);
    growSparks(ctx, f[0], f[1], 3, st.time, 5, 0.6, st.reduced);
  }
}

function focusAt(scene: string, g: number): [number, number] {
  const u = postureOf(scene, g);
  const pl = profilePlaces('ona', u);
  if (scene === 'piersiowy') {
    const k = phase(g, 0, 0.85);
    return [-4.6 + 4 * k, 26 - 2.6 * k];
  }
  return [pl.shoulder[0] * F - 1, pl.shoulder[1] * F - 3];
}

export const PROFILE_WORLD: WorldPainter = { depth: 0, lens: false, bake, draw, focusAt };
