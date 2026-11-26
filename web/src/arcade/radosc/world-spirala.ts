/**
 * The upward spiral (DESIGN.md §24, Pełnia radości): Fredrickson's broaden-and-build pictured.  World units: a person at
 * the bottom (y ≈ 64), the sky of possibilities above, the spiral rising about 150.
 *
 *   szerzej  attention as a fan of light from the person's head: narrow at first, it widens as joy grows, and the points
 *            of light inside it — the possibilities seen — wake (positive emotions broaden attention and the repertoire
 *            of thoughts and actions: Fredrickson & Branigan 2005)
 *   buduje   a spiral of light rises turn by turn, widening; on it three lights wake as it reaches them — bonds, skills,
 *            resilience — the lasting resources built (Fredrickson 2001), joy and broad thinking feeding each other
 *            (Fredrickson & Joiner 2002)
 */
import { TAU, glow, glowEllipse, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { GOLD, GOLD_HI, PEACH, ROSE, SKY, SKY_HI, clamp, person, phase, pxOf, sparkle, sparkles, type P2 } from './draw';
import { tc } from './i18n';

/** the person at the bottom of the fan: shoulders' middle, head */
export const WHO: P2 = [0, 66];
const HEADP: P2 = [WHO[0], WHO[1] - 6 * 1.9];

/** the field of possibilities: points over the sky (angle from straight up, distance from the head, size) */
interface Star { at: P2; ang: number; size: number; hue: string }
function field(): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < 80; i++) {
    const ang = (hash(i * 3 + 1) - 0.5) * 2 * 1.25;
    const d = 36 + 120 * Math.sqrt(hash(i * 5 + 2));
    const at: P2 = [HEADP[0] + Math.sin(ang) * d * 1.05, HEADP[1] - Math.cos(ang) * d];
    if (at[1] < -95 || at[1] > 40) continue;
    const b = hash(i * 7 + 3);
    out.push({ at, ang, size: 1.6 + 2.6 * b * b, hue: b > 0.75 ? PEACH : b > 0.45 ? SKY_HI : GOLD_HI });
  }
  return out;
}
const FIELD = field();
const halfAngle = (g: number): number => 0.1 + 1.0 * phase(g, 0.02, 0.92);

/** The spiral: a point at t (0 bottom … 1 top) and its depth (−1 behind … 1 in front). */
const TURNS = 3.2;
function spiralAt(t: number): { p: P2; z: number } {
  const th = t * TURNS * TAU + Math.PI / 2;
  const R = 14 + 52 * t;
  return { p: [Math.cos(th) * R, 74 - 150 * t + Math.sin(th) * R * 0.3], z: Math.sin(th) };
}
const BEADS: readonly { t: number; part: string; hue: string }[] = [
  { t: 0.32, part: 'wiezi', hue: ROSE }, { t: 0.6, part: 'umiejetnosci', hue: SKY }, { t: 0.86, part: 'odpornosc', hue: GOLD },
];
export const BEAD_AT = BEADS.map(b => spiralAt(b.t).p);

function bake(ctx: CanvasRenderingContext2D, variant: string): void {
  const px = pxOf(ctx);
  if (variant === 'spiral') {
    glowEllipse(ctx, '#5a3aa0', 0, 0, 120, 110, 0, 0.14);
    // the spiral's whole way, faint
    ctx.save();
    ctx.strokeStyle = 'rgba(214,206,255,.16)';
    ctx.lineWidth = Math.max(0.6 / px, 0.6);
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const { p } = spiralAt(i / 240);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  // the field of possibilities, dim; a horizon of light under the person
  glowEllipse(ctx, '#3c4a9a', 0, -20, 150, 110, 0, 0.12);
  for (const s of FIELD) glow(ctx, '#cfd2ff', s.at[0], s.at[1], s.size * 1.4, 0.18);
  const g = ctx.createLinearGradient(-160, 0, 160, 0);
  g.addColorStop(0, 'rgba(255,210,180,0)');
  g.addColorStop(0.5, 'rgba(255,222,196,.3)');
  g.addColorStop(1, 'rgba(255,210,180,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(0.7 / px, 0.7);
  ctx.beginPath();
  ctx.moveTo(-160, WHO[1] + 8);
  ctx.lineTo(160, WHO[1] + 8);
  ctx.stroke();
}

function drawBroaden(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  const ha = halfAngle(g) + (st.reduced ? 0 : 0.015 * Math.sin(st.time * 0.8));
  const len = 175;
  // the fan of attention
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(HEADP[0], HEADP[1], 4, HEADP[0], HEADP[1], len);
  grad.addColorStop(0, rgba(GOLD_HI, 0.32));
  grad.addColorStop(0.35, rgba(PEACH, 0.12 + 0.04 * st.deep));
  grad.addColorStop(1, rgba(SKY, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(HEADP[0], HEADP[1]);
  ctx.arc(HEADP[0], HEADP[1], len, -Math.PI / 2 - ha, -Math.PI / 2 + ha);
  ctx.closePath();
  ctx.fill();
  for (const sgn of [-1, 1]) {
    const a = -Math.PI / 2 + sgn * ha;
    const e = ctx.createLinearGradient(HEADP[0], HEADP[1], HEADP[0] + Math.cos(a) * len, HEADP[1] + Math.sin(a) * len);
    e.addColorStop(0, rgba(GOLD_HI, 0.7));
    e.addColorStop(1, rgba(GOLD_HI, 0));
    ctx.strokeStyle = e;
    ctx.lineWidth = Math.max(0.8 / px, 0.8);
    ctx.beginPath();
    ctx.moveTo(HEADP[0], HEADP[1]);
    ctx.lineTo(HEADP[0] + Math.cos(a) * len, HEADP[1] + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
  // the possibilities inside the fan wake
  FIELD.forEach((s, i) => {
    const inside = clamp((ha - Math.abs(s.ang)) / 0.12);
    if (inside <= 0.01) return;
    const tw = st.reduced ? 1 : 0.8 + 0.2 * Math.sin(st.time * 1.3 + i);
    glow(ctx, s.hue, s.at[0], s.at[1], s.size * 3.2 * tw, 0.32 * inside);
    glow(ctx, '#ffffff', s.at[0], s.at[1], s.size * 0.8, 0.75 * inside);
  });
  person(ctx, WHO[0], WHO[1], 6, 0.6 + 0.4 * phase(g, 0, 0.3), px, GOLD, 1);
  if (st.growing && !st.reduced) {
    for (const sgn of [-1, 1]) {
      const a = -Math.PI / 2 + sgn * ha;
      sparkle(ctx, HEADP[0] + Math.cos(a) * 80, HEADP[1] + Math.sin(a) * 80, 4, 0.7);
    }
  }
}

function drawSpiral(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  const k = phase(g, 0.02, 0.95);
  const N = 240, m = Math.round(N * k);
  // a soft glow under the risen way
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(PEACH, 0.1 + 0.05 * st.deep);
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let i = 0; i <= m; i++) {
    const { p } = spiralAt(i / N);
    if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.restore();
  // the risen way: back half dimmer, front half bright, widening as it rises
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 1; i <= m; i++) {
    const a = spiralAt((i - 1) / N), b = spiralAt(i / N);
    const front = (a.z + b.z) / 2;
    const t = i / N;
    const al = 0.3 + 0.45 * (front > 0 ? 1 : 0.35) * (0.6 + 0.4 * t);
    ctx.strokeStyle = rgba(t < 0.5 ? PEACH : GOLD_HI, al);
    ctx.lineWidth = Math.max(0.9 / px, 0.8 + 1.6 * t) * (front > 0 ? 1 : 0.6);
    ctx.beginPath();
    ctx.moveTo(a.p[0], a.p[1]);
    ctx.lineTo(b.p[0], b.p[1]);
    ctx.stroke();
  }
  ctx.restore();
  // light travelling up what has risen
  for (let i = 0; i < 6; i++) {
    const t = (st.reduced ? i / 6 : (st.time * 0.06 + i / 6) % 1) * k;
    const { p, z } = spiralAt(t);
    glow(ctx, GOLD_HI, p[0], p[1], 3 + 2 * t, z > 0 ? 0.85 : 0.35);
  }
  // the resources: lights that wake as the spiral reaches them
  BEADS.forEach((b, i) => {
    const kb = clamp((k - b.t) / 0.06);
    const { p } = spiralAt(b.t);
    glow(ctx, b.hue, p[0], p[1], 6 + 10 * kb, 0.2 + 0.5 * kb + 0.1 * st.deep);
    glow(ctx, '#ffffff', p[0], p[1], 2.2, 0.3 + 0.6 * kb);
    if (kb > 0.01 && kb < 1 && !st.reduced) sparkles(ctx, p[0], p[1], 10, 2.6, st.time, 4, 0.8, i + 20);
  });
  // the tip
  if (k > 0.01) {
    const { p } = spiralAt(k);
    glow(ctx, GOLD, p[0], p[1], 10, 0.6);
    if (st.growing && !st.reduced) sparkles(ctx, p[0], p[1], 8, 2.4, st.time, 3, 0.7, 31);
  }
  // the top opens wide when it has risen (rest deepens it)
  const kTop = phase(g, 0.9, 1);
  if (kTop > 0.01) glowEllipse(ctx, PEACH, 0, -80, 70, 18, 0, 0.18 * kTop * (0.8 + 0.4 * st.deep));
  glow(ctx, GOLD, 0, 76, 8, 0.6);
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'szerzej') {
    const ha = halfAngle(g);
    return [HEADP[0] + Math.sin(ha) * 70, HEADP[1] - Math.cos(ha) * 70];
  }
  return spiralAt(phase(g, 0.02, 0.95)).p;
}

export const SPIRALA_WORLD: WorldPainter = {
  depth: 0,
  lens: false,
  bake(ctx, variant) { bake(ctx, variant); },
  draw(ctx, st) {
    if (st.scene === 'buduje') drawSpiral(ctx, st);
    else drawBroaden(ctx, st);
  },
  focusAt,
  counter(scene, g) {
    if (g < 0.2) return null;
    return tc(`count.${scene}`);
  },
};
