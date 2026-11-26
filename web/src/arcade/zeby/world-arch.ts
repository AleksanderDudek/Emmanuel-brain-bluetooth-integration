/**
 * The upper teeth seen from below (DESIGN.md §24.4), in millimetres: sixteen crowns round the arch, the front teeth
 * at the top — incisors, canines, premolars, molars — each the mirror of its partner across the palate.  The gum
 * round their necks, the palate's ridges between.  No lens: a free picture on the ground.
 *
 *   pary  the pairs light from the front to the back, each joined to its twin by a thread of gold
 */
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { GOLD, GOLD_HI, PEARL, TAU, glow, polyAt, polyLen, rgba } from '../kit/healthlib/paint';
import { closedSmooth, part } from './geo';
import { C, bakePx, lightLine, word } from './ink';

export const ARCH_VIEW: Rect = { x: -36, y: -30, w: 72, h: 68 };

/** The arch's middle line, from the front (the midline) round to the back, on the right side (x ≥ 0). */
const CURVE: readonly Pt[] = [[0, -22], [5.5, -21.2], [11, -18.4], [15.6, -13.6], [18.8, -7.6], [21, -1], [22.6, 6], [23.8, 13.5], [24.6, 21], [25, 27]];
/** The teeth from the midline back: kind, mesiodistal width and buccolingual depth (mm, typical adult values). */
const TEETH: readonly { kind: 'i' | 'c' | 'p' | 'm'; md: number; bl: number }[] = [
  { kind: 'i', md: 8.6, bl: 7 }, { kind: 'i', md: 6.6, bl: 6.2 }, { kind: 'c', md: 7.6, bl: 8 },
  { kind: 'p', md: 7, bl: 9 }, { kind: 'p', md: 6.6, bl: 9 }, { kind: 'm', md: 10, bl: 11 },
  { kind: 'm', md: 9, bl: 11 }, { kind: 'm', md: 8.4, bl: 10.4 },
];
interface Placed { x: number; y: number; rot: number; md: number; bl: number; kind: string; i: number }
const PLACED: Placed[] = [];
{
  const L = polyLen(CURVE);
  let at = 0;
  TEETH.forEach((t, i) => {
    const mid = at + t.md / 2 + 0.25;
    at += t.md + 0.5;
    const k = mid / L;
    const [x, y] = polyAt(CURVE, k);
    const [x2, y2] = polyAt(CURVE, Math.min(1, k + 0.01));
    PLACED.push({ x, y, rot: Math.atan2(y2 - y, x2 - x), md: t.md, bl: t.bl, kind: t.kind, i });
  });
}

/** A crown seen from below, in its own frame (u along the arch, v across it, v > 0 toward the palate). */
function crownPath(t: Placed, side: 1 | -1): Path2D {
  const a = t.md / 2, b = t.bl / 2;
  let pts: Pt[];
  if (t.kind === 'i') pts = [[-a, -b * 0.75], [0, -b * 0.95], [a, -b * 0.75], [a * 0.9, b * 0.2], [a * 0.45, b * 0.9], [0, b], [-a * 0.45, b * 0.9], [-a * 0.9, b * 0.2]];
  else if (t.kind === 'c') pts = [[-a * 0.9, -b * 0.3], [0, -b], [a * 0.9, -b * 0.3], [a * 0.8, b * 0.4], [0, b], [-a * 0.8, b * 0.4]];
  else if (t.kind === 'p') pts = [[-a, -b * 0.5], [-a * 0.4, -b], [a * 0.4, -b], [a, -b * 0.5], [a, b * 0.5], [a * 0.4, b], [-a * 0.4, b], [-a, b * 0.5]];
  else pts = [[-a, -b * 0.8], [0, -b], [a, -b * 0.85], [a * 1.02, b * 0.3], [a * 0.7, b], [-a * 0.6, b], [-a * 0.95, b * 0.5]];
  return closedSmooth(pts.map(([u, v]) => toWorld(t, side, u, v)));
}
function toWorld(t: Placed, side: 1 | -1, u: number, v: number): Pt {
  // across the arch, "outward" (cheek side) is to the curve's left on the right side
  const c = Math.cos(t.rot), s = Math.sin(t.rot);
  const nx = -s, ny = c; // left normal: toward the palate on the right side
  const x = t.x + u * c + v * nx, y = t.y + u * s + v * ny;
  return [side * x, y];
}
/** The occlusal grooves: a cross for molars, a line for premolars. */
function grooves(t: Placed, side: 1 | -1): Path2D {
  const a = t.md / 2, b = t.bl / 2;
  const p = new Path2D();
  const seg = (pts: Pt[]) => pts.forEach(([u, v], i) => {
    const [x, y] = toWorld(t, side, u, v);
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  });
  if (t.kind === 'm') {
    seg([[-a * 0.6, -b * 0.05], [-a * 0.1, b * 0.08], [a * 0.6, -b * 0.05]]);
    seg([[-a * 0.1, b * 0.08], [-a * 0.15, -b * 0.6]]);
    seg([[-a * 0.1, b * 0.08], [0, b * 0.65]]);
  } else if (t.kind === 'p') seg([[-a * 0.6, 0], [a * 0.6, 0]]);
  else if (t.kind === 'c') seg([[0, -b * 0.6], [0, b * 0.3]]);
  return p;
}

function bakeArch(ctx: CanvasRenderingContext2D): void {
  const px = bakePx(ctx);
  // the palate: a soft rose dome inside the arch, its ridges (rugae) and the midline
  const pal = new Path2D();
  const inner = [...CURVE.map(([x, y]): Pt => [x * 0.62, y * 0.9 + 3])];
  pal.moveTo(0, inner[0][1]);
  inner.forEach(([x, y]) => pal.lineTo(x, y));
  [...inner].reverse().forEach(([x, y]) => pal.lineTo(-x, y));
  pal.closePath();
  const pg = ctx.createRadialGradient(0, 2, 2, 0, 4, 30);
  pg.addColorStop(0, 'rgba(176,70,110,.55)');
  pg.addColorStop(1, 'rgba(120,40,80,.3)');
  ctx.fillStyle = pg;
  ctx.fill(pal);
  ctx.strokeStyle = 'rgba(255,190,214,.22)';
  ctx.lineWidth = 1.1 / px + 0.1;
  for (let k = 0; k < 4; k++) {
    const y = -12 + k * 3.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 1, y);
      ctx.bezierCurveTo(s * 4, y - 1.2, s * 6, y + 1.2, s * (8 + k), y + 0.4);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255,190,214,.18)';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 24);
  ctx.stroke();
  // the gum: a band round the arch under the crowns
  for (const s of [-1, 1] as const) {
    const band = new Path2D();
    CURVE.forEach(([x, y], i) => (i ? band.lineTo(s * x, y) : band.moveTo(s * x, y)));
    ctx.strokeStyle = rgba(C.gum, 0.55);
    ctx.lineWidth = 12.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(band);
    ctx.strokeStyle = rgba(C.gumRim, 0.2);
    ctx.lineWidth = 13.2;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.stroke(band);
    ctx.globalCompositeOperation = 'source-over';
  }
  // the crowns
  for (const s of [-1, 1] as const) for (const t of PLACED) {
    const p = crownPath(t, s);
    const [cx, cy] = toWorld(t, s, 0, 0);
    const g = ctx.createRadialGradient(cx - 1, cy - 1, 0.3, cx, cy, Math.max(t.md, t.bl) * 0.6);
    g.addColorStop(0, '#fbfdff');
    g.addColorStop(0.6, '#e2eef8');
    g.addColorStop(1, '#b9cde2');
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(120,150,190,.5)';
    ctx.lineWidth = 0.9 / px + 0.04;
    ctx.stroke(p);
    ctx.strokeStyle = 'rgba(130,140,190,.55)';
    ctx.lineWidth = 0.9 / px + 0.03;
    ctx.stroke(grooves(t, s));
  }
}

function drawArch(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g, px = st.px;
  const threads = new Path2D(), rims = new Path2D();
  for (const t of PLACED) {
    const k = part(g, t.i / 8, (t.i + 0.9) / 8);
    if (k <= 0) continue;
    for (const s of [-1, 1] as const) {
      const [cx, cy] = toWorld(t, s, 0, 0);
      glow(ctx, PEARL, cx, cy, Math.max(t.md, t.bl) * 0.75, (0.35 + 0.1 * st.deep) * k);
      rims.addPath(crownPath(t, s));
    }
    // the thread to its twin across the palate, drawn from both sides to the middle
    const [ax, ay] = toWorld(t, 1, 0, t.bl / 2 + 0.6);
    const sag = 2 + t.i * 0.4;
    const half = Math.min(1, k * 1.2);
    const p = new Path2D();
    p.moveTo(ax, ay);
    p.quadraticCurveTo(ax * 0.5, ay + sag, ax * (1 - half), ay + sag * (half > 0.5 ? 1 : half * 2) * 0.75);
    p.moveTo(-ax, ay);
    p.quadraticCurveTo(-ax * 0.5, ay + sag, -ax * (1 - half), ay + sag * (half > 0.5 ? 1 : half * 2) * 0.75);
    threads.addPath(p);
    if (k < 1 && st.growing) glow(ctx, GOLD_HI, 0, ay + sag * 0.75, 1.8, 0.7);
  }
  lightLine(ctx, threads, px, GOLD, GOLD_HI, 1.1, 0.75);
  lightLine(ctx, rims, px, C.enamelRim, '#ffffff', 1.2, 0.8);
  if (st.after > 0 && !st.reduced) {
    const a = (st.time * 0.4) % TAU;
    glow(ctx, GOLD, Math.cos(a) * 18, Math.sin(a) * 18, 5, 0.18);
  }
}

function focusAt(_scene: string, g: number): Pt {
  const i = Math.min(7, Math.floor(g * 8));
  const t = PLACED[i];
  return [0, toWorld(t, 1, 0, t.bl / 2 + 0.6)[1] + (2 + i * 0.4) * 0.75];
}

export const ARCH: WorldPainter = {
  depth: 0,
  lens: false,
  bake: bakeArch,
  draw: drawArch,
  focusAt,
  counter: (_s, g) => (g > 0.05 ? word('cnt.pairs', { n: Math.min(8, Math.floor(g * 8 + 0.1)) }) : null),
};

const at = (i: number, s: 1 | -1, v = 0): Pt => toWorld(PLACED[i], s, 0, v);
export const archPt = {
  incisors: at(0, -1, -2),
  canines: at(2, 1, -2),
  premolars: at(3, -1, -2),
  molars: at(6, 1, -2),
  molar1: at(5, 1, 0),
};
