/**
 * Two people (DESIGN.md §24, Pełnia radości): two calm figures of light side by side at dawn, featureless — anyone can
 * be either.  World units: the figures 150 tall (crowns at y = −75, soles at +75), the one who gives on the left
 * (x = −48), the one who receives on the right (x = +48); their inner hands about 45 apart.
 *
 *   dar      a light gathers at the giver's heart, runs down the arm to the open hand, crosses to the other's hand and
 *            rises to their heart (spending on others: Dunn et al. 2008; the registered replication, Aknin et al. 2020)
 *   powrot   both hearts lit; the light comes back to the giver, warmer than it went (acts of kindness raise the doer's
 *            well-being a little: Curry et al. 2018), and a soft rose bond glows between them
 *   list     a letter of thanks: a small envelope of light crosses from the writer to the reader; a dashed ring at the
 *            reader's heart shows what the writer expected, and the reader's real joy grows past it (Kumar & Epley 2018)
 */
import { TAU, glow, glowEllipse, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import {
  FIG, GOLD, GOLD_HI, PEACH, PEARL, ROSE, bakeFigure, clamp, figPt, insideFigure, phase, pxOf, quad, rimLight, seed, sparkles, thread,
  type FigAt, type P2,
} from './draw';
import { bakeDawn } from './world-postac';
import { tc } from './i18n';

export const GIVER: FigAt = { x: -48, top: -75, h: 150 };
export const TAKER: FigAt = { x: 48, top: -75, h: 150 };
export const H1 = figPt(GIVER, FIG.heart);
export const H2 = figPt(TAKER, FIG.heart);
/** the inner hands: the giver's right of the viewer, the receiver's left */
export const P1 = figPt(GIVER, FIG.palmR);
export const P2_ = figPt(TAKER, FIG.palmL);

const ARM1: [P2, P2, P2] = [H1, [H1[0] + 26, H1[1] + 6], P1];
const ARM2: [P2, P2, P2] = [P2_, [H2[0] - 26, H2[1] + 6], H2];
const ACROSS: [P2, P2, P2] = [P1, [0, -26], P2_];
const BACK: [P2, P2, P2] = [H2, [0, -78], H1];

function bake(ctx: CanvasRenderingContext2D): void {
  bakeDawn(ctx, 75, 220, 0.8);
  bakeFigure(ctx, GIVER);
  bakeFigure(ctx, TAKER);
}

function chest(ctx: CanvasRenderingContext2D, f: FigAt, h: P2, k: number, deep: number, color = PEACH): void {
  if (k <= 0.01) return;
  insideFigure(ctx, f, () => {
    glow(ctx, color, h[0], h[1] + 4, 22 + 26 * k, 0.18 + 0.32 * k + 0.1 * deep);
  });
  seed(ctx, h[0], h[1], 4.6 * (0.7 + 0.5 * k), k, GOLD);
}

function drawGift(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const k1 = phase(g, 0, 0.22);
  chest(ctx, GIVER, H1, 0.4 + 0.6 * k1, st.deep);
  const kArm = phase(g, 0.15, 0.38);
  thread(ctx, ...ARM1, kArm, GOLD, 1.2, 0.8);
  const kX = phase(g, 0.38, 0.74);
  const tip = thread(ctx, ...ACROSS, kX, GOLD_HI, 1.4, 0.9);
  if (kX > 0.01 && kX < 1) seed(ctx, tip[0], tip[1], 4, 1, GOLD);
  if (kArm > 0.98) glow(ctx, GOLD, P1[0], P1[1], 7, 0.6);
  const kUp = phase(g, 0.72, 0.88);
  thread(ctx, ...ARM2, kUp, GOLD, 1.2, 0.8);
  if (kX > 0.98) glow(ctx, GOLD, P2_[0], P2_[1], 7, 0.6);
  const k2 = phase(g, 0.82, 1);
  chest(ctx, TAKER, H2, k2, st.deep);
  rimLight(ctx, TAKER, 0.6 * k2);
  if (st.growing && !st.reduced) {
    const at = g < 0.38 ? quad(...ARM1, kArm) : g < 0.74 ? tip : quad(...ARM2, kUp);
    sparkles(ctx, at[0], at[1], 9, 2.6, st.time, 3, 0.75, 6);
  }
}

function drawReturn(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  // the gift as given: both hearts lit
  chest(ctx, GIVER, H1, 0.55, st.deep);
  chest(ctx, TAKER, H2, 0.8, st.deep);
  thread(ctx, ...ACROSS, 1, GOLD, 0.8, 0.35, false);
  // the light comes back above them, wider and warmer
  const kB = phase(g, 0.08, 0.55);
  const tip = thread(ctx, ...BACK, kB, PEACH, 1.6, 0.9);
  if (kB > 0.01 && kB < 1) seed(ctx, tip[0], tip[1], 5.4, 1, PEACH);
  // the giver's heart brighter than before, the rim lit
  const kG = phase(g, 0.5, 0.95) + 0.2 * st.deep;
  chest(ctx, GIVER, H1, 0.55 + 0.45 * clamp(kG), st.deep, PEACH);
  rimLight(ctx, GIVER, 0.75 * clamp(kG));
  // the bond between them: a soft rose glow
  const kBond = phase(g, 0.7, 1);
  if (kBond > 0.01) {
    glowEllipse(ctx, ROSE, 0, -20, 70, 34, 0, 0.14 * kBond);
    glow(ctx, ROSE, 0, -30, 14, 0.25 * kBond);
  }
  if (st.growing && !st.reduced) {
    const at = g < 0.55 ? tip : H1;
    sparkles(ctx, at[0], at[1], 11, 2.8, st.time, 4, 0.75, 8);
  }
}

/** A small envelope of light (centre, width), turned a little as it flies. */
function envelope(ctx: CanvasRenderingContext2D, c: P2, w: number, rot: number, a: number, px: number): void {
  const h = w * 0.64;
  glow(ctx, GOLD, c[0], c[1], w * 1.6, 0.4 * a);
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(rot);
  ctx.fillStyle = rgba('#fff4e2', 0.82 * a);
  ctx.strokeStyle = rgba(GOLD, 0.95 * a);
  ctx.lineWidth = Math.max(0.8 / px, w * 0.05);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(0, h * 0.08);
  ctx.lineTo(w / 2, -h / 2);
  ctx.stroke();
  ctx.restore();
}

function drawLetter(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  chest(ctx, GIVER, H1, 0.5, st.deep);
  // the letter is written at the writer's hands, then flies across
  const kW = phase(g, 0, 0.2);
  const kF = phase(g, 0.2, 0.62);
  const path: [P2, P2, P2] = [[P1[0] + 2, P1[1] - 6], [0, -54], [P2_[0] - 2, P2_[1] - 6]];
  if (kF > 0.01) thread(ctx, path[0], path[1], path[2], kF, PEACH, 0.6, 0.4, false);
  const at = quad(...path, kF);
  const fly = st.reduced ? 0 : Math.sin(st.time * 2) * 0.12;
  envelope(ctx, at, 11 * (0.4 + 0.6 * kW), -0.2 + 0.4 * kF + fly * (kF > 0 && kF < 1 ? 1 : 0), kW, px);
  // what the writer expected: a small dashed ring at the reader's heart
  const kE = phase(g, 0.42, 0.56);
  if (kE > 0.01) {
    ctx.save();
    ctx.setLineDash([2.4, 2.4]);
    ctx.strokeStyle = rgba(PEARL, 0.7 * kE);
    ctx.lineWidth = Math.max(0.8 / px, 0.7);
    ctx.beginPath();
    ctx.arc(H2[0], H2[1], 11, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // what the reader really felt: the joy grows past the ring
  const kR = phase(g, 0.62, 1);
  chest(ctx, TAKER, H2, kR, st.deep, PEACH);
  if (kR > 0.01) {
    glow(ctx, ROSE, H2[0], H2[1], 12 + 30 * kR, 0.3 * kR);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(GOLD_HI, 0.55 * kR);
    ctx.lineWidth = Math.max(1 / px, 1.1);
    ctx.beginPath();
    ctx.arc(H2[0], H2[1], 11 + 16 * kR, 0, TAU);
    ctx.stroke();
    ctx.restore();
    rimLight(ctx, TAKER, 0.6 * kR);
  }
  if (st.growing && !st.reduced) sparkles(ctx, ...(g < 0.62 ? at : H2), 10, 2.6, st.time, 3, 0.75, 12);
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'dar') {
    if (g < 0.15) return H1;
    if (g < 0.38) return quad(...ARM1, phase(g, 0.15, 0.38));
    if (g < 0.74) return quad(...ACROSS, phase(g, 0.38, 0.74));
    return H2;
  }
  if (scene === 'powrot') return g < 0.55 ? quad(...BACK, phase(g, 0.08, 0.55)) : H1;
  if (g < 0.62) return quad([P1[0] + 2, P1[1] - 6], [0, -54], [P2_[0] - 2, P2_[1] - 6], phase(g, 0.2, 0.62));
  return H2;
}

export const DWOJE_WORLD: WorldPainter = {
  depth: 0,
  lens: false,
  bake(ctx) { bake(ctx); },
  draw(ctx, st) {
    if (st.scene === 'powrot') drawReturn(ctx, st);
    else if (st.scene === 'list') drawLetter(ctx, st);
    else drawGift(ctx, st);
  },
  focusAt,
  counter(scene, g) {
    if (g < 0.2) return null;
    return tc(`count.${scene}`);
  },
};

void pxOf;
