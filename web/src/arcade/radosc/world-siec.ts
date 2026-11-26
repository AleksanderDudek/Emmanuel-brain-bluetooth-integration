/**
 * The constellation of people (DESIGN.md §24, Pełnia radości): a person in the middle and the people around — close ones,
 * their friends, the friends of those — as small featureless figures (a head and shoulders) joined by threads, on the
 * night ground like a constellation.  World units: the close ring at r ≈ 30, the second at ≈ 60, the third at ≈ 92;
 * a far fourth ring stays dim (the world goes on beyond).
 *
 *   bliscy   the middle lights, then the close ones one by one, each joined by a warm thread (the Harvard Study of Adult
 *            Development, since 1938: close relationships and a good, healthy life)
 *   stopnie  the light spreads ring by ring to the third degree (happiness clustered in a network of 4739 people over
 *            20 years, up to three degrees: Fowler & Christakis 2008 — an association, said as such)
 *   smiech   the close circle laughing together: ripples of light pass between them, and a small glow in each head
 *            (social laughter released endogenous opioids: Manninen et al. 2017; laughter ≈ 30× more frequent in company)
 *   plynie   the whole (Pełnia): light given in the middle passes outward ring by ring and comes back multiplied
 *            (in a lab game each extra contribution was tripled through others, up to three degrees: Fowler &
 *            Christakis 2010)
 */
import { TAU, glow, glowEllipse, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { GOLD, GOLD_HI, PEACH, ROSE, SKY, clamp, person, phase, pxOf, sparkle, sparkles, stagger, thread, type P2 } from './draw';
import { tc } from './i18n';

export interface Node { at: P2; ring: number; s: number; parent: number; order: number }

/** The people: the middle (ring 0), the close ones (1), their friends (2), theirs (3), the far ones (4, dim). */
function build(): Node[] {
  const out: Node[] = [{ at: [0, 0], ring: 0, s: 5.4, parent: -1, order: 0 }];
  const ring = (n: number, r: number, ringN: number, s: number, off: number): void => {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU + (hash(ringN * 31 + i) - 0.5) * (TAU / n) * 0.4;
      const rr = r * (0.92 + 0.16 * hash(ringN * 17 + i * 3));
      const at: P2 = [Math.cos(a) * rr, Math.sin(a) * rr * 0.9];
      // the parent: the nearest of the ring inside
      let parent = 0, best = Infinity;
      out.forEach((m, j) => {
        if (m.ring !== ringN - 1) return;
        const d = Math.hypot(m.at[0] - at[0], m.at[1] - at[1]);
        if (d < best) { best = d; parent = j; }
      });
      out.push({ at, ring: ringN, s, parent, order: i });
    }
  };
  ring(6, 31, 1, 4.2, -Math.PI / 2 + 0.3);
  ring(12, 61, 2, 3.3, -Math.PI / 2 + 0.1);
  ring(20, 93, 3, 2.7, -Math.PI / 2 + 0.05);
  ring(30, 128, 4, 2.2, -Math.PI / 2);
  return out;
}
export const NODES = build();
const byRing = (r: number): Node[] => NODES.filter(n => n.ring === r);
const R1 = byRing(1);

/** The far fourth ring and the faint threads of everyone: baked. */
function bake(ctx: CanvasRenderingContext2D): void {
  const px = pxOf(ctx);
  glowEllipse(ctx, '#6a4aa8', 0, 0, 140, 120, 0, 0.12);
  ctx.save();
  ctx.lineWidth = Math.max(0.6 / px, 0.45);
  for (const n of NODES) {
    if (n.parent < 0) continue;
    const p = NODES[n.parent];
    ctx.strokeStyle = `rgba(214,206,255,${n.ring >= 4 ? 0.07 : 0.14})`;
    ctx.beginPath();
    ctx.moveTo(p.at[0], p.at[1]);
    ctx.lineTo(n.at[0], n.at[1]);
    ctx.stroke();
  }
  ctx.restore();
  for (const n of NODES) if (n.ring >= 4) person(ctx, n.at[0], n.at[1], n.s, 0, px, PEACH, 0.6);
}

/** How lit a node is (0..1) for the scene's growth. */
function litOf(scene: string, n: Node, g: number): number {
  const nr = n.ring;
  if (nr >= 4) return 0;
  switch (scene) {
    case 'bliscy':
      if (nr === 0) return 0.4 + 0.6 * phase(g, 0, 0.12);
      if (nr === 1) return stagger(g, n.order, 6, 0.2, 0.1, 0.85);
      return 0;
    case 'stopnie':
      if (nr <= 1) return 1;
      if (nr === 2) return stagger(g, n.order, 12, 0.18, 0.04, 0.46);
      return stagger(g, n.order, 20, 0.16, 0.44, 0.9);
    case 'smiech':
      return nr <= 1 ? 1 : 0;
    default: // plynie
      if (nr === 0) return 1;
      return stagger(g, n.order, nr === 1 ? 6 : nr === 2 ? 12 : 20, 0.14, 0.05 + (nr - 1) * 0.25, 0.3 + (nr - 1) * 0.25);
  }
}

/** A ring's colour: dawn's three in the network of degrees, all warm in the fullness (light multiplied). */
function hueOf(n: Node, scene: string): string {
  if (scene === 'plynie') return n.ring <= 1 ? GOLD : n.ring === 2 ? PEACH : ROSE;
  return n.ring === 0 ? GOLD : n.ring === 1 ? PEACH : n.ring === 2 ? ROSE : SKY;
}

function drawNet(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  const lit = NODES.map(n => litOf(st.scene, n, g));
  // the threads of light to each lit node from its parent
  NODES.forEach((n, i) => {
    if (n.parent < 0 || lit[i] <= 0.01) return;
    const p = NODES[n.parent];
    const mid: P2 = [(p.at[0] + n.at[0]) / 2, (p.at[1] + n.at[1]) / 2];
    thread(ctx, p.at, mid, n.at, lit[i], hueOf(n, st.scene), n.ring === 1 ? 1.1 : 0.8, 0.75, lit[i] < 1);
  });
  // the close ones joined to each other once all are lit (bliscy, smiech)
  if (st.scene === 'bliscy' || st.scene === 'smiech') {
    const kRing = st.scene === 'smiech' ? 1 : phase(g, 0.8, 1);
    if (kRing > 0.01) {
      R1.forEach((n, i) => {
        const m = R1[(i + 1) % R1.length];
        const c: P2 = [(n.at[0] + m.at[0]) * 0.56, (n.at[1] + m.at[1]) * 0.56];
        thread(ctx, n.at, c, m.at, kRing, ROSE, 0.7, 0.5, false);
      });
    }
  }
  // the people
  NODES.forEach((n, i) => {
    if (n.ring >= 4) return;
    const breathe = st.reduced ? 1 : 1 + 0.04 * (st.breath - 0.5) * st.deep;
    const close = st.scene === 'bliscy' || st.scene === 'smiech';
    person(ctx, n.at[0], n.at[1], n.s * breathe, lit[i], px, hueOf(n, st.scene), close && n.ring >= 2 ? 0.3 : 1);
  });
}

function drawLaughter(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  drawNet(ctx, st);
  const circle = [NODES[0], ...R1];
  // ripples of laughter passing from person to person, more and wider as it grows
  const kW = phase(g, 0.05, 0.7);
  const n = Math.round(1 + 4 * kW);
  for (let i = 0; i < n; i++) {
    const who = circle[(i * 3) % circle.length];
    const t = st.reduced ? 0.5 : (st.time * 0.45 + i * 0.37) % 1;
    const r = who.s * (1.6 + 4.4 * t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(i % 2 ? GOLD_HI : ROSE, 0.55 * (1 - t) * kW);
    ctx.lineWidth = Math.max(0.8 / px, 0.8);
    ctx.beginPath();
    ctx.arc(who.at[0], who.at[1] - who.s * 1.2, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // a small glow in each head: the brain's own opioids after laughing together
  const kE = phase(g, 0.45, 1) + 0.15 * st.deep;
  circle.forEach((m, i) => {
    const w = st.reduced ? 1 : 0.85 + 0.15 * Math.sin(st.time * 1.6 + i);
    glow(ctx, GOLD_HI, m.at[0], m.at[1] - m.s * 1.9, m.s * 1.1 * w, 0.75 * clamp(kE));
  });
  if (st.growing && !st.reduced) sparkles(ctx, 0, -4, 30, 2.4, st.time, 6, 0.6, 14);
}

function drawFlow(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  drawNet(ctx, st);
  // pulses travelling outward along the lit threads, and back home once all are lit
  const back = phase(g, 0.85, 1);
  NODES.forEach((n, i) => {
    if (n.parent < 0 || n.ring >= 4) return;
    const k = litOf('plynie', n, g);
    if (k < 0.99) return;
    const p = NODES[n.parent];
    const t = st.reduced ? 0.5 : (st.time * 0.4 + hash(i * 3)) % 1;
    const u = back > 0.5 && i % 2 ? 1 - t : t;
    glow(ctx, GOLD_HI, p.at[0] + (n.at[0] - p.at[0]) * u, p.at[1] + (n.at[1] - p.at[1]) * u, 2.4, 0.7);
  });
  // the middle grows warmer as the light comes back
  glow(ctx, GOLD, 0, -6, 18 + 22 * back, 0.2 + 0.4 * back);
  if (back > 0.01) glowEllipse(ctx, PEACH, 0, 0, 120 * back, 108 * back, 0, 0.08 * back);
  if (st.growing && !st.reduced) {
    const ring = g < 0.3 ? 1 : g < 0.55 ? 2 : 3;
    const front = ring * 31;
    const a = st.time * 0.8;
    sparkle(ctx, Math.cos(a) * front, Math.sin(a) * front * 0.9, 4, 0.7);
  }
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'bliscy') {
    const i = Math.min(5, Math.floor(clamp((g - 0.1) / 0.75) * 6));
    return g < 0.1 ? NODES[0].at : R1[i].at;
  }
  if (scene === 'stopnie' || scene === 'plynie') {
    const r = scene === 'stopnie' ? (g < 0.45 ? 2 : 3) : g < 0.3 ? 1 : g < 0.55 ? 2 : 3;
    const list = byRing(r);
    const from = scene === 'stopnie' ? (r === 2 ? 0.04 : 0.44) : 0.05 + (r - 1) * 0.25;
    const span = scene === 'stopnie' ? (r === 2 ? 0.42 : 0.46) : 0.25;
    const i = Math.min(list.length - 1, Math.floor(clamp((g - from) / span) * list.length));
    return list[i].at;
  }
  return [0, -6];
}

export const SIEC_WORLD: WorldPainter = {
  depth: 0,
  lens: false,
  bake(ctx) { bake(ctx); },
  draw(ctx, st) {
    if (st.scene === 'smiech') drawLaughter(ctx, st);
    else if (st.scene === 'plynie') drawFlow(ctx, st);
    else drawNet(ctx, st);
  },
  focusAt,
  counter(scene, g) {
    if (g < 0.2) return null;
    return tc(`count.${scene}`);
  },
};
