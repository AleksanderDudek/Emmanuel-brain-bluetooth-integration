/**
 * The figure (DESIGN.md §24, Pełnia radości): a calm, featureless person of light standing on the ground at dawn — anyone
 * can stand in it.  World units: the figure 200 tall, its crown at y = −100, its soles at +100, the midline at x = 0.
 *
 *   dostrzec  one good thing: a small light before the figure; attention (a thread from the brow, where the band sits)
 *             rests on it, and the seed of light at the heart wakes and warms, ring by ring
 *   cialo     the whole body (Pełnia): the warmth spreads from the heart through the chest, the arms to the palms, the
 *             head and down to the feet — as happiness is felt all over the body (Nummenmaa et al., PNAS 2014) — and at
 *             the last it flows out round the figure
 */
import { TAU, glow, glowEllipse, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import {
  DAWN, FIG, GOLD, GOLD_HI, PEACH, ROSE, SKY, bakeFigure, clamp, figPt, insideFigure, phase, pxOf, rimLight, seed, sparkle,
  sparkles, thread, wave, type FigAt, type P2,
} from './draw';
import { tc } from './i18n';

export const FIGURE: FigAt = { x: 0, top: -100, h: 200 };
export const HEART = figPt(FIGURE, FIG.heart);
export const BROW = figPt(FIGURE, FIG.brow);
/** the good thing noticed: a small light before the figure, at the height of the heart */
export const GOOD: P2 = [62, -62];

/** The dawn behind the figure: a low warm band of light on the horizon and a soft sky above (baked, additive). */
export function bakeDawn(ctx: CanvasRenderingContext2D, groundY: number, span: number, a = 1): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glowEllipse(ctx, DAWN, 0, groundY + span * 0.02, span * 0.9, span * 0.16, 0, 0.16 * a);
  glowEllipse(ctx, PEACH, 0, groundY - span * 0.05, span * 0.55, span * 0.12, 0, 0.12 * a);
  glowEllipse(ctx, SKY, 0, groundY - span * 0.55, span * 0.9, span * 0.4, 0, 0.05 * a);
  ctx.restore();
  // the ground line: a thin horizon of light fading to the sides
  const g = ctx.createLinearGradient(-span, 0, span, 0);
  g.addColorStop(0, 'rgba(255,210,180,0)');
  g.addColorStop(0.5, `rgba(255,222,196,${(0.32 * a).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,210,180,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(0.6 / pxOf(ctx), span * 0.004);
  ctx.beginPath();
  ctx.moveTo(-span, groundY);
  ctx.lineTo(span, groundY);
  ctx.stroke();
}

function bake(ctx: CanvasRenderingContext2D, variant: string): void {
  bakeDawn(ctx, 100, 260, variant === 'full' ? 1 : 0.75);
  bakeFigure(ctx, FIGURE);
}

/** The seed at the heart and its warm rings (k 0..1: how awake). */
function heartSeed(ctx: CanvasRenderingContext2D, st: WorldState, k: number): void {
  const [hx, hy] = HEART;
  const br = 0.85 + 0.15 * (st.breath - 0.5) * 2 * (st.reduced ? 0 : 1);
  seed(ctx, hx, hy, 7 * br * (0.6 + 0.6 * k), clamp(0.15 + k), GOLD);
  // rings of warmth widen as it wakes (three, in turn)
  for (let i = 0; i < 3; i++) {
    const ki = phase(k, 0.15 + i * 0.22, 0.45 + i * 0.22);
    if (ki <= 0.01) continue;
    const t = st.reduced ? 0.5 : (st.time * 0.35 + i / 3) % 1;
    const r = 10 + 26 * ki + 14 * t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(i === 1 ? ROSE : PEACH, 0.32 * ki * (1 - t * 0.7));
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(hx, hy, r, r * 0.82, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawNotice(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  // the good thing: a small light before the figure, more itself as attention stays (a soft sun with petals of light)
  const kGood = 0.35 + 0.65 * phase(g, 0, 0.3);
  const [gx, gy] = GOOD;
  const tw = wave(st.time, 0.25, 0, st.reduced);
  glow(ctx, DAWN, gx, gy, 30 * kGood, 0.22 * kGood);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + st.time * 0.05 * (st.reduced ? 0 : 1);
    glowEllipse(ctx, GOLD, gx + Math.cos(a) * 7, gy + Math.sin(a) * 7, 7 * kGood, 2.2 * kGood, a, 0.35 * kGood);
  }
  seed(ctx, gx, gy, 5 + tw, kGood, GOLD);
  // attention: a thread from the brow to the good thing, held (it steadies, then stays)
  const kAtt = phase(g, 0.08, 0.4);
  const brow: P2 = [BROW[0] + 6, BROW[1]];
  thread(ctx, brow, [34, -98], [gx - 6, gy - 4], kAtt, GOLD_HI, 1.1, 0.7);
  glow(ctx, GOLD_HI, BROW[0], BROW[1], 9 * (0.4 + kAtt), 0.4 * kAtt);
  // the good taken in: a slow warm stream from the good thing to the heart
  const kIn = phase(g, 0.32, 0.7);
  const tip = thread(ctx, [gx - 4, gy + 3], [34, -40], [HEART[0] + 8, HEART[1] + 2], kIn, PEACH, 1.4, 0.8);
  if (kIn > 0.01 && kIn < 1) sparkles(ctx, tip[0], tip[1], 6, 2.6, st.time, 3, 0.6 * (st.growing ? 1 : 0.4), 3);
  // the heart warms
  heartSeed(ctx, st, phase(g, 0.4, 1) + 0.15 * st.deep);
  // the chest's glow inside the figure
  const kWarm = phase(g, 0.55, 1);
  insideFigure(ctx, FIGURE, () => {
    glow(ctx, PEACH, HEART[0], HEART[1], 30 + 30 * kWarm, 0.16 + 0.34 * kWarm + 0.12 * st.deep);
    glow(ctx, ROSE, HEART[0], HEART[1] + 8, 22 + 16 * kWarm, 0.1 * kWarm);
  });
  if (st.growing && !st.reduced) sparkles(ctx, HEART[0], HEART[1], 14, 3, st.time, 4, 0.7, 7);
  void px;
}

/** How far the warmth has spread from the heart (world units) at a growth. */
const spreadR = (g: number): number => 12 + 150 * phase(g, 0.05, 0.92);

function drawWhole(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const [hx, hy] = HEART;
  const R = spreadR(g);
  const br = st.reduced ? 1 : 0.94 + 0.12 * st.breath;
  insideFigure(ctx, FIGURE, () => {
    // the warmth spreads from the heart (a soft front, peach behind gold)
    glow(ctx, PEACH, hx, hy + R * 0.25, R * 1.25 * br, 0.32 + 0.12 * st.deep);
    glow(ctx, GOLD, hx, hy, R * 0.8 * br, 0.3);
    glow(ctx, ROSE, hx, hy + 6, Math.min(R, 50), 0.16);
    // the arms down to the palms, the head, the legs to the feet: warm points as the front reaches them
    const reach = (p: P2, k0: number): number => clamp((R - Math.hypot(p[0] - hx, p[1] - hy) + 10) / 24) * (k0 >= 0 ? 1 : 0);
    for (const p of [FIG.palmL, FIG.palmR, FIG.crown, FIG.footL, FIG.footR, FIG.belly] as const) {
      const w = figPt(FIGURE, p);
      const k = reach(w, 0);
      if (k > 0.01) glow(ctx, GOLD_HI, w[0], w[1], 16, 0.35 * k);
    }
  });
  rimLight(ctx, FIGURE, phase(g, 0.35, 1) * (0.7 + 0.3 * st.deep));
  seed(ctx, hx, hy, 6 * br, 1, GOLD);
  // the last: it flows out round the figure — slow rays and a halo
  const kOut = phase(g, 0.82, 1) + 0.25 * st.deep * phase(g, 0.82, 1);
  if (kOut > 0.01) {
    glowEllipse(ctx, DAWN, 0, 0, 120, 150, 0, 0.12 * kOut);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + (st.reduced ? 0 : st.time * 0.03);
      const len = 70 + 30 * hash(i * 7);
      glowEllipse(ctx, GOLD, hx + Math.cos(a) * len, hy + 30 + Math.sin(a) * len * 1.1, 26, 3, a, 0.16 * kOut);
    }
  }
  if (st.growing && !st.reduced) {
    const a = st.time * 0.9;
    const p: P2 = [hx + Math.cos(a) * R * 0.5, hy + Math.sin(a) * R * 0.6];
    sparkle(ctx, p[0], p[1], 5, 0.7);
    sparkles(ctx, hx, hy, Math.min(R, 60), 3, st.time, 5, 0.6, 11);
  }
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'dostrzec') return g < 0.32 ? [GOOD[0] - 4, GOOD[1]] : HEART;
  if (scene === 'cialo') {
    const R = spreadR(g);
    return [HEART[0], Math.min(80, HEART[1] + R * 0.55)];
  }
  return HEART;
}

export const POSTAC_WORLD: WorldPainter = {
  depth: 0,
  lens: false,
  bake(ctx, variant) { bake(ctx, variant); },
  draw(ctx, st) {
    if (st.scene === 'cialo') drawWhole(ctx, st);
    else drawNotice(ctx, st);
  },
  focusAt,
  counter(scene, g) {
    if (scene === 'cialo' && g > 0.15) return tc('count.cialo');
    if (scene === 'dostrzec' && g > 0.1) return tc('count.dostrzec');
    return null;
  },
};
