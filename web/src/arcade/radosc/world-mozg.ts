/**
 * The brain's reward circuit (DESIGN.md §24, Pełnia radości), seen through the lens: one hemisphere cut along the
 * midline, the forehead to the left — where the band sits — the cranium a faint line round it.  World units ≈ mm:
 * the cerebrum about 160 long, the origin near the thalamus.
 *
 *   nagroda   the ventral tegmental area (VTA) in the midbrain wakes; dopamine flows along the mesolimbic way to the
 *             ventral striatum (nucleus accumbens) and the mesocortical way to the prefrontal cortex; last, the small
 *             "hot spots" of liking glow rose (dopamine is wanting and anticipation, not pleasure itself — Berridge &
 *             Kringelbach 2015)
 *   trwac     staying with the good: a loop of light between the prefrontal cortex and the striatum keeps turning, and
 *             a small trace beneath shows the activity held longer and longer (Heller et al. 2013: sustained striatal and
 *             prefrontal activity to good pictures went with higher well-being)
 */
import { AQUA, LILAC, PEARL, TAU, glow, glowEllipse, hash, rgba, smoothPath, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { GOLD, GOLD_HI, PEACH, ROSE, ROSE_HI, clamp, phase, pxOf, quad, sparkles, thread, type P2 } from './draw';
import { tc } from './i18n';

/** The cerebrum's medial outline (a smooth closed curve, clockwise from the frontal pole). */
const CEREBRUM: readonly P2[] = [
  [-82, -6], [-80, -26], [-70, -44], [-52, -58], [-28, -66], [0, -68], [28, -64], [52, -52], [70, -34], [80, -12],
  [80, 8], [72, 22], [58, 26], [40, 22], [26, 16], [14, 14], [2, 18], [-10, 20], [-26, 22], [-46, 22], [-64, 18], [-76, 8],
];
const CEREBELLUM = { x: 54, y: 42, rx: 27, ry: 17 };
/** The brainstem: midbrain, pons, medulla (a soft stalk, front edge then back edge). */
const STEM: readonly P2[] = [[-2, 16], [-4, 30], [0, 44], [6, 56], [10, 74], [22, 76], [24, 58], [26, 42], [22, 28], [16, 16]];
const CALLOSUM: readonly P2[] = [[-44, -4], [-48, -16], [-34, -30], [-10, -36], [16, -34], [38, -24], [46, -10], [40, -6]];
const THALAMUS = { x: 4, y: 2, rx: 14, ry: 9 };

export const VTA: P2 = [8, 26];
export const NACC: P2 = [-30, 12];
export const PFC: P2 = [-62, -22];
export const DLPFC: P2 = [-56, -40];
export const BAND: P2 = [-95, -30];
const HOT: readonly P2[] = [[-33, 15], [-26, 17], [-19, 19]];

/** The two ways of dopamine: mesolimbic (VTA → ventral striatum), mesocortical (VTA → prefrontal cortex). */
const LIMBIC: [P2, P2, P2] = [VTA, [-8, 26], NACC];
const CORTICAL: [P2, P2, P2] = [VTA, [-46, 30], PFC];
const CORTICAL2: [P2, P2, P2] = [PFC, [-70, -34], DLPFC];

function closed(pts: readonly P2[]): Path2D {
  const p = new Path2D();
  const n = pts.length;
  const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

let paths: { cer: Path2D; stem: Path2D; head: Path2D } | null = null;
function P(): { cer: Path2D; stem: Path2D; head: Path2D } {
  if (!paths) {
    const head: readonly P2[] = [
      [-92, 30], [-96, 8], [-97, -22], [-88, -50], [-66, -72], [-30, -82], [10, -82], [46, -74], [74, -56], [90, -30],
      [94, 0], [90, 30], [80, 56], [64, 76],
    ];
    const h = new Path2D();
    smoothPath(h, head);
    paths = { cer: closed(CEREBRUM), stem: closed(STEM), head: h };
  }
  return paths;
}

/**
 * The gyri of the medial surface: wavy arcs parallel to the cerebrum's edge (the cingulate and the gyri above it) and
 * short sulci between them — soft, deterministic, clipped to the cerebrum.
 */
function sulci(): P2[][] {
  const out: P2[][] = [];
  const cx = 0, cy = -18;
  const arc = (rx: number, ry: number, k: number, a0: number, a1: number): P2[] => {
    const pts: P2[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = a0 + ((a1 - a0) * i) / 48;
      const w = 1 + 0.032 * Math.sin(a * (9 + k) + k * 1.7) + 0.012 * Math.sin(a * 23 + k);
      pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
    }
    return pts;
  };
  for (let k = 0; k < 4; k++) out.push(arc(74 - 12 * k, 44 - 8 * k, k, Math.PI + 0.12 + 0.05 * k, TAU - 0.1 - 0.05 * k));
  // short sulci across the gyri, and the parieto-occipital and calcarine sulci at the back
  for (let i = 0; i < 18; i++) {
    const a = Math.PI + 0.2 + (Math.PI - 0.4) * hash(i * 7 + 1);
    const k = Math.floor(hash(i * 5 + 2) * 3);
    const r0 = 1 - 0.16 * k, r1 = r0 - 0.13;
    const p0: P2 = [cx + Math.cos(a) * 76 * r0, cy + Math.sin(a) * 45 * r0];
    const p1: P2 = [cx + Math.cos(a + 0.05) * 76 * r1, cy + Math.sin(a + 0.05) * 45 * r1];
    out.push([p0, [(p0[0] + p1[0]) / 2 + (hash(i) - 0.5) * 4, (p0[1] + p1[1]) / 2], p1]);
  }
  out.push([[52, -48], [56, -30], [58, -12]]);
  out.push([[58, -10], [68, -5], [80, -3]]);
  return out;
}
const SULCI = sulci();

function bake(ctx: CanvasRenderingContext2D, variant: string): void {
  const px = pxOf(ctx);
  const { cer, stem, head } = P();
  // the cranium: a faint line of the head round the brain, the forehead where the band sits
  ctx.save();
  ctx.strokeStyle = 'rgba(236,214,255,.16)';
  ctx.lineWidth = Math.max(1 / px, 1.4);
  ctx.stroke(head);
  ctx.restore();
  glowEllipse(ctx, '#7b4fa8', 0, 0, 100, 80, 0, 0.18);
  // the brainstem and the cerebellum beneath
  ctx.save();
  const sg = ctx.createLinearGradient(0, 14, 0, 76);
  sg.addColorStop(0, 'rgba(150,104,170,.78)');
  sg.addColorStop(1, 'rgba(96,64,128,.6)');
  ctx.fillStyle = sg;
  ctx.fill(stem);
  ctx.strokeStyle = 'rgba(236,214,255,.4)';
  ctx.lineWidth = Math.max(0.8 / px, 0.8);
  ctx.stroke(stem);
  const C = CEREBELLUM;
  ctx.beginPath();
  ctx.ellipse(C.x, C.y, C.rx, C.ry, -0.18, 0, TAU);
  const cg = ctx.createRadialGradient(C.x - 6, C.y - 4, 2, C.x, C.y, C.rx);
  cg.addColorStop(0, 'rgba(176,122,190,.85)');
  cg.addColorStop(1, 'rgba(104,66,140,.7)');
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(236,214,255,.42)';
  ctx.stroke();
  // the cerebellum's tree of white matter (arbor vitae)
  ctx.strokeStyle = 'rgba(246,232,255,.32)';
  ctx.lineWidth = Math.max(0.6 / px, 0.7);
  for (let i = 0; i < 7; i++) {
    const a = -2.3 + i * 0.55;
    ctx.beginPath();
    ctx.moveTo(C.x - 10, C.y);
    ctx.quadraticCurveTo(C.x + Math.cos(a) * 8, C.y + Math.sin(a) * 6, C.x + Math.cos(a) * C.rx * 0.82, C.y + Math.sin(a) * C.ry * 0.82);
    ctx.stroke();
  }
  ctx.restore();
  // the cerebrum: warm plum lit from within, a rim of pearl
  ctx.save();
  const g = ctx.createRadialGradient(-10, -18, 6, 0, -10, 92);
  g.addColorStop(0, 'rgba(206,140,196,.95)');
  g.addColorStop(0.55, 'rgba(162,98,168,.9)');
  g.addColorStop(1, 'rgba(110,64,140,.88)');
  ctx.fillStyle = g;
  ctx.fill(cer);
  ctx.clip(cer);
  // the gyri: soft paler bands along the sulci
  ctx.lineCap = 'round';
  for (const s of SULCI) {
    ctx.beginPath();
    smoothPath(ctx, s);
    ctx.strokeStyle = 'rgba(255,226,250,.08)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,24,80,.3)';
    ctx.lineWidth = Math.max(0.6 / px, 0.9);
    ctx.stroke();
  }
  // the corpus callosum: a pearl arch
  ctx.beginPath();
  smoothPath(ctx, CALLOSUM);
  ctx.strokeStyle = 'rgba(250,240,255,.5)';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,255,.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // the thalamus
  const T = THALAMUS;
  ctx.beginPath();
  ctx.ellipse(T.x, T.y, T.rx, T.ry, -0.1, 0, TAU);
  ctx.fillStyle = 'rgba(214,170,220,.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(246,228,255,.35)';
  ctx.lineWidth = Math.max(0.6 / px, 0.7);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,236,250,.6)';
  ctx.lineWidth = Math.max(1 / px, 1.1);
  ctx.stroke(cer);
  ctx.restore();
  // the places of the circuit, dim before they wake
  glow(ctx, LILAC, NACC[0], NACC[1], 9, 0.25);
  glow(ctx, LILAC, VTA[0], VTA[1], 6, 0.25);
  // the band on the forehead (the trace's frame in the "staying" scene)
  ctx.save();
  ctx.translate(BAND[0], BAND[1]);
  ctx.rotate(0.12);
  ctx.fillStyle = 'rgba(30,22,48,.9)';
  ctx.strokeStyle = 'rgba(236,226,255,.55)';
  ctx.lineWidth = Math.max(0.7 / px, 0.8);
  ctx.beginPath();
  ctx.roundRect(-3.2, -16, 6.4, 32, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (variant === 'loop') {
    // the trace's frame: a quiet baseline under the brain (time →)
    ctx.save();
    ctx.strokeStyle = 'rgba(236,226,255,.22)';
    ctx.lineWidth = Math.max(0.7 / px, 0.7);
    ctx.beginPath();
    ctx.moveTo(TRACE.x, TRACE.y + TRACE.h);
    ctx.lineTo(TRACE.x + TRACE.w, TRACE.y + TRACE.h);
    ctx.moveTo(TRACE.x, TRACE.y + TRACE.h);
    ctx.lineTo(TRACE.x, TRACE.y - 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** The small trace of activity held over time (world units), under the front of the brain. */
const TRACE = { x: -84, y: 46, w: 70, h: 24 };

function dopamine(ctx: CanvasRenderingContext2D, way: [P2, P2, P2], k: number, st: WorldState, n: number, color: string): void {
  if (k <= 0.01) return;
  thread(ctx, way[0], way[1], way[2], k, color, 1.4, 0.75, false);
  // pulses travelling along what has opened
  for (let i = 0; i < n; i++) {
    const t = st.reduced ? (i + 0.5) / n : (st.time * 0.32 + i / n) % 1;
    if (t > k) continue;
    const [x, y] = quad(way[0], way[1], way[2], t);
    glow(ctx, GOLD_HI, x, y, 3.6, 0.85);
  }
}

function drawReward(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const kV = phase(g, 0, 0.22) + 0.1 * st.deep;
  glow(ctx, GOLD, VTA[0], VTA[1], 8 + 8 * kV, 0.5 * kV);
  glow(ctx, '#ffffff', VTA[0], VTA[1], 2.6, 0.8 * kV);
  const kL = phase(g, 0.15, 0.55);
  dopamine(ctx, LIMBIC, kL, st, 5, GOLD);
  const kN = phase(g, 0.45, 0.62);
  glow(ctx, PEACH, NACC[0], NACC[1], 10 + 8 * kN, 0.55 * kN);
  const kC = phase(g, 0.5, 0.85);
  dopamine(ctx, CORTICAL, kC, st, 6, GOLD);
  dopamine(ctx, CORTICAL2, phase(g, 0.75, 0.92), st, 3, GOLD);
  const kP = phase(g, 0.75, 0.95);
  glowEllipse(ctx, AQUA, PFC[0] + 2, PFC[1] - 6, 22, 30, -0.3, 0.22 * kP);
  glow(ctx, GOLD_HI, PFC[0], PFC[1], 10, 0.35 * kP);
  // the hot spots of liking: small and rose, distinct from the flow of wanting
  const kH = phase(g, 0.84, 1);
  HOT.forEach(([x, y], i) => {
    const w = st.reduced ? 1 : 0.8 + 0.2 * Math.sin(st.time * 2.2 + i * 2);
    glow(ctx, ROSE, x, y, 5 * w, 0.75 * kH);
    glow(ctx, ROSE_HI, x, y, 1.6, 0.9 * kH);
  });
  if (st.growing && !st.reduced) {
    const at = g < 0.5 ? quad(...LIMBIC, kL) : quad(...CORTICAL, kC);
    sparkles(ctx, at[0], at[1], 8, 2.4, st.time, 3, 0.7, 5);
  }
}

function drawStay(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  // the circuit already awake, softly
  glow(ctx, GOLD, VTA[0], VTA[1], 9, 0.35);
  dopamine(ctx, LIMBIC, 1, st, 3, GOLD);
  dopamine(ctx, CORTICAL, 1, st, 3, GOLD);
  // the loop between the prefrontal cortex and the striatum: brighter and steadier as it holds
  const k = phase(g, 0.05, 0.8) + 0.15 * st.deep;
  const c: P2 = [(DLPFC[0] + NACC[0]) / 2 + 2, (DLPFC[1] + NACC[1]) / 2];
  const rx = 10, ry = Math.hypot(DLPFC[0] - NACC[0], DLPFC[1] - NACC[1]) / 2 + 3, rot = Math.atan2(NACC[1] - DLPFC[1], NACC[0] - DLPFC[0]) - Math.PI / 2;
  if (k > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(c[0], c[1]);
    ctx.rotate(rot);
    for (const [lw, a] of [[6, 0.1], [2.2, 0.32], [0.9, 0.9]] as const) {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k));
      ctx.strokeStyle = rgba(GOLD_HI, a * clamp(k));
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (st.reduced ? i / n : (st.time * 0.22 + i / n) % 1) * clamp(k);
      const a = -Math.PI / 2 + t * TAU;
      const x0 = Math.cos(a) * rx, y0 = Math.sin(a) * ry;
      glow(ctx, GOLD_HI, c[0] + x0 * Math.cos(rot) - y0 * Math.sin(rot), c[1] + x0 * Math.sin(rot) + y0 * Math.cos(rot), 3, 0.8);
    }
  }
  glowEllipse(ctx, AQUA, DLPFC[0], DLPFC[1] + 8, 20, 26, -0.3, 0.12 + 0.2 * k);
  glow(ctx, PEACH, NACC[0], NACC[1], 14, 0.25 + 0.35 * k);
  // the band reads the forehead: its light follows the loop
  glow(ctx, AQUA, BAND[0] + 1, BAND[1], 6 + 6 * k, 0.25 + 0.45 * k);
  // the trace: a good moment at the left, the activity rising and held — longer as the scene grows
  const T = TRACE;
  const hold = 0.18 + 0.7 * phase(g, 0.1, 0.95);
  const pts: P2[] = [];
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    const rise = phase(u, 0.08, 0.2);
    const fall = 1 - phase(u, 0.2 + hold * 0.7, 0.3 + hold * 0.7);
    const v = rise * fall * (0.85 + 0.08 * Math.sin(u * 30 + (st.reduced ? 0 : st.time * 2)));
    pts.push([T.x + u * T.w, T.y + T.h - v * T.h * 0.9]);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (const [lw, a] of [[3.6, 0.14], [1.2, 0.85]] as const) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = rgba(GOLD_HI, a);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
  // the good moment's mark at the start
  glow(ctx, ROSE, T.x + T.w * 0.1, T.y + T.h + 1, 3, 0.8);
  if (st.growing && !st.reduced) sparkles(ctx, c[0], c[1], 26, 2.6, st.time, 4, 0.6, 9);
  void PEARL;
}

function focusAt(scene: string, g: number): Pt {
  if (scene === 'nagroda') {
    if (g < 0.2) return VTA;
    if (g < 0.55) return quad(...LIMBIC, phase(g, 0.15, 0.55));
    return quad(...CORTICAL, phase(g, 0.5, 0.85));
  }
  return [(DLPFC[0] + NACC[0]) / 2 + 2, (DLPFC[1] + NACC[1]) / 2];
}

export const MOZG_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake(ctx, variant) { bake(ctx, variant); },
  draw(ctx, st) {
    if (st.scene === 'trwac') drawStay(ctx, st);
    else drawReward(ctx, st);
  },
  focusAt,
  counter(scene, g) {
    if (scene === 'trwac' && g > 0.2) return tc('count.trwac');
    return null;
  },
};
