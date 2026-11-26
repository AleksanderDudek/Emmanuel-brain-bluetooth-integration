/**
 * The garden of light (DESIGN.md §24, Pełnia radości): what grows from the seed at the heart, as a garden on a quiet
 * ground — the camera dives into the figure's heart to come here.  World units: the ground line at y = 30, the garden
 * about 220 wide.
 *
 *   trzy      an evening (a young moon, a few stars): from the seed a stem rises, and three blossoms open one by one —
 *             three good things of the day; from each a thin line runs down into the soil to a small light: where it
 *             came from (the exercise asks both: the good thing and why it happened — Seligman et al. 2005)
 *   korzenie  the same plant: roots of light spread under the ground and new leaves unfurl above — gratitude practised
 *             over weeks (small but real effects, Choi et al. 2025; Emmons & McCullough 2003)
 *   ogrod     the whole garden at dawn (Pełnia): four plants, one for each way joy grows in this library — attention,
 *             gratitude, kindness, closeness — come into bloom in turn, fireflies rising
 */
import { TAU, glow, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { GOLD, GOLD_HI, LEAF, PEACH, PEARL, ROSE, SKY, clamp, phase, pxOf, quad, seed, sparkle, sparkles, stagger, thread, type P2 } from './draw';
import { bakeDawn } from './world-postac';
import { tc } from './i18n';

export const GROUND = 30;
/** the seed of the one plant (trzy, korzenie) */
export const SEED: P2 = [0, GROUND + 3];
const TOP: P2 = [0, -66];
const STEM_C: P2 = [10, -14];
/** the three blossoms: their place on the plant (where their branch leaves the stem, t), the blossom, its radius */
const BLOOMS: readonly { t: number; at: P2; r: number }[] = [
  { t: 0.42, at: [-30, -14], r: 11 },
  { t: 0.62, at: [30, -34], r: 12 },
  { t: 1, at: TOP, r: 14 },
];
/** where each good thing came from: a small light in the soil */
const WHY: readonly P2[] = [[-26, GROUND + 16], [24, GROUND + 22], [2, GROUND + 30]];
/** the four plants of the whole garden: x, height, hue */
const FOUR: readonly { x: number; h: number; hue: string }[] = [
  { x: -78, h: 78, hue: GOLD }, { x: -26, h: 96, hue: PEACH }, { x: 26, h: 90, hue: ROSE }, { x: 78, h: 74, hue: SKY },
];

/** A root system: segments from the seed down and out, each with its depth order (deterministic). */
interface Seg { a: P2; c: P2; b: P2; order: number; w: number }
function roots(): Seg[] {
  const out: Seg[] = [];
  const grow = (a: P2, ang: number, len: number, w: number, order: number, s: number): void => {
    if (len < 7 || order > 5) return;
    const b: P2 = [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len];
    const bend = (hash(s * 13 + 1) - 0.5) * len * 0.5;
    const c: P2 = [(a[0] + b[0]) / 2 + Math.cos(ang + Math.PI / 2) * bend, (a[1] + b[1]) / 2 + Math.sin(ang + Math.PI / 2) * bend];
    out.push({ a, c, b, order, w });
    const n = order < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * (0.75 + 0.3 * hash(s * 7 + i));
      grow(b, ang + spread + (hash(s * 3 + i * 5) - 0.5) * 0.3, len * (0.62 + 0.14 * hash(s * 11 + i)), w * 0.66, order + 1, s * 4 + i + 1);
    }
  };
  grow(SEED, Math.PI / 2, 30, 3, 0, 1);
  return out;
}
const ROOTS = roots();

function bakeNight(ctx: CanvasRenderingContext2D): void {
  const px = pxOf(ctx);
  // a few stars and a young moon low on the left
  for (let i = 0; i < 26; i++) {
    const x = -150 + 300 * hash(i * 3 + 1), y = -110 + 110 * hash(i * 5 + 2);
    const b = hash(i * 7 + 3);
    glow(ctx, b > 0.7 ? PEACH : '#dfe4ff', x, y, 1.2 + 2.4 * b, 0.25 + 0.45 * b);
  }
  const mx = -76, my = -62, r = 9;
  glow(ctx, '#fff1d6', mx, my, 28, 0.16);
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, r, -Math.PI * 0.62, Math.PI * 0.62, true);
  ctx.arc(mx - 4.2, my - 1.4, r * 0.86, Math.PI * 0.56, -Math.PI * 0.56, false);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,240,214,.85)';
  ctx.fill();
  ctx.restore();
  bakeSoil(ctx, px, 0.7);
}

function bakeSoil(ctx: CanvasRenderingContext2D, px: number, a: number): void {
  // the soil, in strips that fade toward the sides (no hard edge where a wide box ends)
  const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 70);
  g.addColorStop(0, 'rgba(60,26,52,.55)');
  g.addColorStop(1, 'rgba(28,12,34,.75)');
  ctx.save();
  ctx.fillStyle = g;
  for (let x = -260; x < 260; x += 8) {
    const fade = 1 - Math.min(1, Math.max(0, (Math.abs(x + 4) - 110) / 140));
    ctx.globalAlpha = a * fade * fade * (3 - 2 * fade);
    if (ctx.globalAlpha > 0.004) ctx.fillRect(x, GROUND, 8.4, 200);
  }
  ctx.restore();
  const line = ctx.createLinearGradient(-200, 0, 200, 0);
  line.addColorStop(0, 'rgba(255,210,190,0)');
  line.addColorStop(0.5, 'rgba(255,214,196,.42)');
  line.addColorStop(1, 'rgba(255,210,190,0)');
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(0.8 / px, 0.8);
  ctx.beginPath();
  ctx.moveTo(-200, GROUND);
  ctx.lineTo(200, GROUND);
  ctx.stroke();
  // faint grains in the soil
  for (let i = 0; i < 60; i++) {
    const x = -160 + 320 * hash(i * 3 + 41), y = GROUND + 4 + 66 * hash(i * 5 + 42);
    ctx.fillStyle = `rgba(255,214,200,${(0.04 + 0.08 * hash(i + 43)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + 0.8 * hash(i * 7 + 44), 0, TAU);
    ctx.fill();
  }
}

function bake(ctx: CanvasRenderingContext2D, variant: string): void {
  if (variant === 'full') {
    bakeDawn(ctx, GROUND, 240, 1);
    bakeSoil(ctx, pxOf(ctx), 0.6);
  } else bakeNight(ctx);
}

/** A leaf: a pointed oval from its base along an angle, filled softly, rimmed in pearl. */
function leaf(ctx: CanvasRenderingContext2D, base: P2, ang: number, len: number, k: number, px: number, hue = LEAF): void {
  if (k <= 0.01) return;
  const L = len * k, W = L * 0.32;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const tip: P2 = [base[0] + ca * L, base[1] + sa * L];
  const n1: P2 = [base[0] + ca * L * 0.5 - sa * W, base[1] + sa * L * 0.5 + ca * W];
  const n2: P2 = [base[0] + ca * L * 0.5 + sa * W, base[1] + sa * L * 0.5 - ca * W];
  const p = new Path2D();
  p.moveTo(base[0], base[1]);
  p.quadraticCurveTo(n1[0], n1[1], tip[0], tip[1]);
  p.quadraticCurveTo(n2[0], n2[1], base[0], base[1]);
  glow(ctx, hue, (base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, L * 0.7, 0.18 * k);
  ctx.fillStyle = rgba(hue, 0.22 * k);
  ctx.fill(p);
  ctx.strokeStyle = rgba(PEARL, 0.55 * k);
  ctx.lineWidth = Math.max(0.7 / px, 0.5);
  ctx.stroke(p);
  ctx.beginPath();
  ctx.moveTo(base[0], base[1]);
  ctx.lineTo(base[0] + ca * L * 0.8, base[1] + sa * L * 0.8);
  ctx.strokeStyle = rgba(PEARL, 0.3 * k);
  ctx.stroke();
}

/** A blossom: petals opening from a bud (k 0 → 1), a gold heart, a halo in its hue. */
export function blossom(ctx: CanvasRenderingContext2D, c: P2, r: number, k: number, hue: string, px: number, time: number, reduced: boolean, n = 6, turn = 0): void {
  if (k <= 0.01) return;
  const open = clamp(k);
  glow(ctx, hue, c[0], c[1], r * (1.6 + 1.6 * open), 0.3 * open);
  for (let i = 0; i < n; i++) {
    // closed: petals point up, small; open: spread round
    const spread = (i / n) * TAU + turn + (reduced ? 0 : 0.04 * Math.sin(time * 0.8 + i));
    const ang = -Math.PI / 2 + (spread + Math.PI / 2 - Math.PI / 2) * open + (1 - open) * ((i - n / 2) * 0.12);
    const L = r * (0.45 + 0.55 * open), W = L * 0.42;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const tip: P2 = [c[0] + ca * L, c[1] + sa * L];
    const p = new Path2D();
    p.moveTo(c[0], c[1]);
    p.quadraticCurveTo(c[0] + ca * L * 0.55 - sa * W, c[1] + sa * L * 0.55 + ca * W, tip[0], tip[1]);
    p.quadraticCurveTo(c[0] + ca * L * 0.55 + sa * W, c[1] + sa * L * 0.55 - ca * W, c[0], c[1]);
    ctx.fillStyle = rgba(hue, 0.3 + 0.25 * open);
    ctx.fill(p);
    ctx.strokeStyle = rgba(PEARL, 0.45 + 0.4 * open);
    ctx.lineWidth = Math.max(0.7 / px, 0.5);
    ctx.stroke(p);
  }
  seed(ctx, c[0], c[1], r * 0.22, open, GOLD);
}

/** The one plant of the evening: stem (k of its height), leaves, three blossoms (each 0..1), the dim ones as grown. */
function plant(ctx: CanvasRenderingContext2D, st: WorldState, kStem: number, kLeaves: number, kB: readonly number[], extraLeaves = 0): void {
  const px = st.px;
  const sway = st.reduced ? 0 : Math.sin(st.time * 0.5) * 1.2;
  const top: P2 = [TOP[0] + sway, TOP[1]];
  const c: P2 = [STEM_C[0] + sway * 0.5, STEM_C[1]];
  thread(ctx, SEED, c, top, kStem, LEAF, 1.3, 0.85, kStem < 0.99);
  seed(ctx, SEED[0], SEED[1], 3.4, 0.9, GOLD);
  // leaves along the stem, alternating
  const LEAVES = [0.22, 0.34, 0.5, 0.58, 0.74, 0.84, 0.3, 0.46, 0.66];
  LEAVES.forEach((t, i) => {
    const extra = i >= 6;
    const k = extra ? stagger(extraLeaves, i - 6, 3, 0.4) : stagger(kLeaves, i, 6, 0.35) * (t <= kStem ? 1 : 0);
    if (k <= 0.01) return;
    const b = quad(SEED, c, top, t);
    const side = i % 2 ? 1 : -1;
    leaf(ctx, b, -Math.PI / 2 + side * (0.95 + 0.25 * hash(i)), 16 + 6 * hash(i * 3), k, px);
  });
  // the blossoms on short branches
  BLOOMS.forEach((bl, i) => {
    const k = kB[i] ?? 0;
    if (k <= 0.01) return;
    const from = quad(SEED, c, top, bl.t);
    const at: P2 = i === 2 ? top : [bl.at[0] + sway * 0.6, bl.at[1]];
    if (i < 2) thread(ctx, from, [(from[0] + at[0]) / 2, from[1] - 4], at, Math.min(1, k * 2), LEAF, 1, 0.8, false);
    blossom(ctx, at, bl.r, phase(k, 0.3, 1), i === 1 ? PEACH : i === 2 ? GOLD : ROSE, px, st.time, st.reduced, 6, i * 0.4);
  });
}

function drawThree(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const kStem = phase(g, 0, 0.3);
  const kB = [phase(g, 0.26, 0.48), phase(g, 0.48, 0.7), phase(g, 0.7, 0.92)];
  plant(ctx, st, kStem, phase(g, 0.08, 0.4), kB);
  // from each good thing a thin line down into the soil, to the light of where it came from
  kB.forEach((k, i) => {
    const kw = phase(k, 0.6, 1);
    if (kw <= 0.01) return;
    const from = i === 2 ? TOP : BLOOMS[i].at;
    thread(ctx, from, [from[0] * 0.4 + WHY[i][0] * 0.2, GROUND - 10], WHY[i], kw, PEACH, 0.6, 0.45, kw < 1);
    if (kw > 0.95) glow(ctx, PEACH, WHY[i][0], WHY[i][1], 6, 0.6 + 0.2 * st.deep);
  });
  // rest: the blossoms breathe softly
  if (st.deep > 0.02) glow(ctx, GOLD, TOP[0], TOP[1], 30 * (0.8 + 0.4 * st.breath), 0.1 * st.deep);
  if (st.growing && !st.reduced) {
    const i = g < 0.48 ? 0 : g < 0.7 ? 1 : 2;
    const at = i === 2 ? TOP : BLOOMS[i].at;
    sparkles(ctx, at[0], at[1], 14, 2.6, st.time, 4, 0.75, i + 2);
  }
}

function drawRoots(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  // the plant as it stands (grown), a little brighter as the roots deepen
  plant(ctx, st, 1, 1, [1, 1, 1], phase(g, 0.5, 1));
  // the roots spread, order by order
  const kR = phase(g, 0.02, 0.85);
  const maxOrder = 6;
  ctx.save();
  for (const s of ROOTS) {
    const k = clamp(kR * maxOrder - s.order);
    if (k <= 0.01) continue;
    thread(ctx, s.a, s.c, s.b, k, s.order < 2 ? GOLD : PEACH, Math.max(0.35, s.w * 0.55), 0.55 + 0.4 * (1 - s.order / maxOrder), k < 1);
  }
  ctx.restore();
  // root tips glow at the end
  if (kR > 0.85) for (const s of ROOTS) if (s.order >= 4) glow(ctx, GOLD_HI, s.b[0], s.b[1], 2.4, 0.5 * (0.6 + 0.4 * st.deep));
  if (st.growing && !st.reduced) {
    const tipOrder = Math.min(5, Math.floor(kR * maxOrder));
    const s = ROOTS.find(r => r.order === tipOrder);
    if (s) sparkles(ctx, s.b[0], s.b[1], 10, 2.2, st.time, 3, 0.7, 4);
  }
}

/** One plant of the whole garden: stem, leaves, a crown of blossoms in its hue (k 0..1). */
function gardenPlant(ctx: CanvasRenderingContext2D, st: WorldState, x: number, h: number, hue: string, k: number, i: number): void {
  const px = st.px;
  const sway = st.reduced ? 0 : Math.sin(st.time * 0.5 + i) * 1.4;
  const base: P2 = [x, GROUND + 2];
  const top: P2 = [x + sway, GROUND - h];
  const c: P2 = [x + (i % 2 ? 8 : -8), GROUND - h * 0.5];
  const kS = phase(k, 0, 0.45);
  thread(ctx, base, c, top, kS, LEAF, 1.2, 0.8, kS < 0.99);
  for (let j = 0; j < 4; j++) {
    const t = 0.25 + j * 0.16;
    const kl = phase(k, 0.15 + j * 0.08, 0.45 + j * 0.08) * (t <= kS ? 1 : 0);
    leaf(ctx, quad(base, c, top, t), -Math.PI / 2 + (j % 2 ? 1 : -1) * 1.05, 13 + 3 * hash(i * 9 + j), kl, px);
  }
  const kb = phase(k, 0.45, 1);
  blossom(ctx, top, 12, kb, hue, px, st.time, st.reduced, 7, i);
  // smaller blossoms on side branches
  for (const [t, dx, r] of [[0.62, -16, 7], [0.78, 15, 8]] as const) {
    const from = quad(base, c, top, t);
    const at: P2 = [from[0] + dx, from[1] - 8];
    const kk = phase(k, 0.6, 1);
    if (kk <= 0.01) continue;
    thread(ctx, from, [from[0] + dx * 0.5, from[1] - 2], at, kk, LEAF, 0.8, 0.7, false);
    blossom(ctx, at, r, kk, hue, px, st.time, st.reduced, 6, t * 3);
  }
}

function drawGarden(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  FOUR.forEach((p, i) => gardenPlant(ctx, st, p.x, p.h, p.hue, stagger(g, i, 4, 0.4, 0, 0.95) + (g >= 1 ? 0 : 0), i));
  // fireflies rising as the garden fills
  const kF = phase(g, 0.3, 1) * (0.7 + 0.3 * st.deep);
  for (let i = 0; i < 24; i++) {
    const life = st.reduced ? hash(i * 5) : (st.time * (0.05 + 0.04 * hash(i)) + hash(i * 5)) % 1;
    const x = -110 + 220 * hash(i * 3 + 7) + (st.reduced ? 0 : Math.sin(st.time * 0.7 + i) * 5);
    const y = GROUND - 4 - life * 120;
    const a = kF * Math.sin(life * Math.PI) * (i / 24 < kF ? 1 : 0);
    if (a > 0.01) glow(ctx, i % 3 ? GOLD_HI : PEACH, x, y, 3.4, 0.75 * a);
  }
  if (st.growing && !st.reduced) {
    const i = Math.min(3, Math.floor(g * 4));
    const p = FOUR[i];
    sparkles(ctx, p.x, GROUND - p.h * clamp(g * 4 - i), 16, 2.8, st.time, 4, 0.75, i + 9);
    sparkle(ctx, p.x, GROUND - p.h, 4, 0.5);
  }
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'trzy') {
    if (g < 0.26) return quad(SEED, STEM_C, TOP, phase(g, 0, 0.3));
    const i = g < 0.48 ? 0 : g < 0.7 ? 1 : 2;
    return BLOOMS[i].at;
  }
  if (scene === 'korzenie') {
    const kR = phase(g, 0.02, 0.85);
    const order = Math.min(5, Math.floor(kR * 6));
    const s = ROOTS.find(r => r.order === order);
    return s ? s.b : SEED;
  }
  const i = Math.min(3, Math.floor(clamp(g / 0.95) * 4));
  const p = FOUR[i];
  return [p.x, GROUND - p.h * 0.7];
}

export const OGROD_WORLD: WorldPainter = {
  depth: 1,
  lens: false,
  bake(ctx, variant) { bake(ctx, variant); },
  draw(ctx, st) {
    if (st.scene === 'korzenie') drawRoots(ctx, st);
    else if (st.scene === 'ogrod') drawGarden(ctx, st);
    else drawThree(ctx, st);
  },
  focusAt,
  counter(scene, g) {
    if (scene === 'trzy') {
      const n = g < 0.48 ? (g > 0.3 ? 1 : 0) : g < 0.7 ? 2 : g > 0.75 ? 3 : 2;
      return n ? tc('count.trzy', n) : null;
    }
    if (scene === 'korzenie' && g > 0.2) return tc('count.korzenie');
    return null;
  },
};

export { WHY, BLOOMS, FOUR };
