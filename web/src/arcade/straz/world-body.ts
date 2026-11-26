/**
 * The body (DESIGN.md §24): a figure without features — anyone can see themselves — drawn as light on the ground,
 * with its lymph nodes and vessels, the thymus and the spleen.  No lens: a free picture.
 *
 *   rezydenci   memory T cells that stay in the tissues: the skin fills with fine points of light (about twenty
 *               billion T cells live in it), and the lungs and the gut with fewer
 *   cala_cialo  the whole watch: lymph flows, node after node lights, the thymus and the spleen glow, memory everywhere
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, GOLD, GOLD_HI, LILAC, PEARL, TAU, glow, hash, rgba, smoothPath } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { BODY_NODES, BODY_OUTLINE, BODY_VESSELS, SPLEEN, THYMUS, along, type Pt } from './geo';
import { LYMPH_C } from './cells';

/** The figure's outline, closed smoothly (quadratic curves through the midpoints, no seam at the crown). */
function outlinePath(): Path2D {
  const p = new Path2D();
  const pts = BODY_OUTLINE, n = pts.length;
  const mid = (i: number): [number, number] => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const s = mid(n - 1);
  p.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  p.closePath();
  return p;
}
let OUT: Path2D | null = null;
const outline = (): Path2D => (OUT ??= outlinePath());

function bake(ctx: CanvasRenderingContext2D): void {
  const p = outline();
  const g = ctx.createLinearGradient(0, -100, 0, 100);
  g.addColorStop(0, 'rgba(200,190,255,.1)');
  g.addColorStop(0.5, 'rgba(160,150,240,.07)');
  g.addColorStop(1, 'rgba(140,130,230,.05)');
  ctx.fillStyle = g;
  ctx.fill(p);
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(190,180,255,.08)';
  ctx.lineWidth = 5;
  ctx.stroke(p);
  ctx.strokeStyle = 'rgba(210,200,255,.12)';
  ctx.lineWidth = 2.2;
  ctx.stroke(p);
  ctx.globalCompositeOperation = op;
  ctx.strokeStyle = 'rgba(236,230,255,.55)';
  ctx.lineWidth = 0.45;
  ctx.stroke(p);
  // the lymphatic trunks, faint
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const v of BODY_VESSELS) {
    const q = new Path2D();
    smoothPath(q, v as [number, number][]);
    ctx.strokeStyle = rgba(LYMPH_C, 0.22);
    ctx.lineWidth = 0.7;
    ctx.stroke(q);
  }
  // the thymus (two small lobes above the heart) and the spleen
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(THYMUS[0] + s * 1.4, THYMUS[1], 1.6, 3, s * 0.2, 0, TAU);
    ctx.fillStyle = 'rgba(214,200,255,.25)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(SPLEEN[0], SPLEEN[1], 2.6, 4.2, 0.5, 0, TAU);
  ctx.fillStyle = 'rgba(220,140,190,.25)';
  ctx.fill();
  // the nodes, dim
  for (const [x, y] of BODY_NODES) {
    ctx.beginPath();
    ctx.ellipse(x, y, 1.2, 0.85, 0.4, 0, TAU);
    ctx.fillStyle = 'rgba(190,240,230,.4)';
    ctx.fill();
  }
}

// the skin's points: along the outline, just inside it; then fewer in the lungs and the gut
interface Dot { x: number; y: number; at: number; skin: boolean }
let DOTS: Dot[] | null = null;
function dots(): Dot[] {
  if (DOTS) return DOTS;
  const out: Dot[] = [];
  const pts = BODY_OUTLINE;
  let n = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.round(L / 0.7));
    for (let s = 0; s < steps; s++) {
      n++;
      const k = s / steps;
      const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k;
      // inward: the outline runs clockwise on the screen, so the inside is on the left of each edge
      const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
      const inset = 0.5 + 1.6 * hash(n * 1.31);
      const sgn = 1;
      const barrier = y < -76 || (Math.abs(x) > 36 && y > -6) || y > 94 ? 0 : 0.25;
      out.push({ x: x + sgn * nx * inset, y: y + sgn * ny * inset, at: barrier + 0.7 * hash(n * 2.71), skin: true });
    }
  }
  for (let i = 0; i < 160; i++) {
    const lung = i < 80;
    const x = (lung ? (i % 2 ? 1 : -1) * (5 + 13 * hash(i * 3.1)) : (hash(i * 3.1) - 0.5) * 30);
    const y = lung ? -58 + 26 * hash(i * 5.3) : -22 + 24 * hash(i * 5.3);
    out.push({ x, y, at: 0.35 + 0.6 * hash(i * 7.9), skin: false });
  }
  DOTS = out;
  return out;
}

function drawResidents(ctx: CanvasRenderingContext2D, g: number, st: WorldState, density = 1): void {
  const t = st.reduced ? 0 : st.time;
  const skin = new Path2D(), inner = new Path2D();
  let lit = 0;
  const list = dots();
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    if (density < 1 && hash(i * 9.1) > density) continue;
    if (d.at > g) continue;
    lit++;
    const target = d.skin ? skin : inner;
    target.moveTo(d.x + 0.42, d.y);
    target.arc(d.x, d.y, 0.42, 0, TAU);
  }
  ctx.fillStyle = rgba(GOLD_HI, 0.85);
  ctx.fill(skin);
  ctx.fillStyle = rgba(AQUA, 0.6);
  ctx.fill(inner);
  // a few glints: the watch, settled and awake
  for (let i = 0; i < 14; i++) {
    const d = list[Math.floor(hash(i * 13.3 + Math.floor(t * 0.4)) * list.length)];
    if (!d || d.at > g) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.3);
    glow(ctx, d.skin ? GOLD : AQUA, d.x, d.y, 2.6, 0.45 * tw);
  }
  if (lit > 0) glow(ctx, LILAC, 0, -10, 90, 0.05 + 0.08 * g);
}

/** The nodes in the order they light (from the feet upward, both sides together). */
const NODE_ORDER = BODY_NODES.map((p, i) => ({ p, i })).sort((a, b) => b.p[1] - a.p[1]);

function drawWhole(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const t = st.reduced ? 0 : st.time;
  drawResidents(ctx, Math.min(1, g * 1.1), st, 0.45);
  // lymph flowing up the trunks to the ducts
  for (const v of BODY_VESSELS) {
    for (let i = 0; i < 5; i++) {
      const [x, y] = along(v, (i / 5 + t * 0.04) % 1);
      glow(ctx, LYMPH_C, x, y, 1.8, 0.35 + 0.25 * g);
    }
  }
  NODE_ORDER.forEach(({ p }, j) => {
    const k = clamp((g - (j / NODE_ORDER.length) * 0.8) / 0.08);
    if (k <= 0) return;
    glow(ctx, LYMPH_C, p[0], p[1], 3.2, 0.55 * k);
    glow(ctx, GOLD_HI, p[0], p[1], 1.4, 0.7 * k);
  });
  const organs = clamp((g - 0.5) / 0.2);
  if (organs > 0) {
    glow(ctx, LILAC, THYMUS[0], THYMUS[1], 6, 0.5 * organs);
    glow(ctx, '#ff9cc8', SPLEEN[0], SPLEEN[1], 7, 0.45 * organs);
  }
  if (g >= 1 || st.after > 0) glow(ctx, PEARL, 0, -20, 70, 0.06 + 0.04 * Math.sin(t * 0.5));
}

function draw(ctx: CanvasRenderingContext2D, st0: WorldState): void {
  const st = st0.reduced ? { ...st0, time: 0 } : st0;
  if (st.scene === 'rezydenci') drawResidents(ctx, ease.inOutSine(st.g), st);
  else drawWhole(ctx, st.g, st);
  if (st.deep > 0.02) glow(ctx, '#ffd0b0', 0, -40, 60, 0.07 * st.deep);
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'rezydenci') return [0, -40 + 60 * g];
  const j = Math.min(NODE_ORDER.length - 1, Math.floor(g * 0.8 * NODE_ORDER.length));
  return NODE_ORDER[j].p;
}

export function bodyWorld(counter: (scene: string, g: number) => string | null): WorldPainter {
  return { depth: 0, lens: false, bake: (ctx) => bake(ctx), draw, focusAt, counter };
}
