/**
 * Światło ciała's picture through a camera: the glass figure (front or back) or the brain (its lateral face or the
 * cut through the middle), with every element of the meditation drawn as a shape of its own — a ghost of its colour
 * while it waits, its colour lit and glowing once focus has filled it, and the element in the light outlined, filling
 * from within as the focus pours in, a ring around it showing how full it is (gold while it fills).  Used by the play
 * view, the calibration intro and the lobby's preview.  Per frame: a few dozen path fills through one transform and a
 * handful of baked glows; no shadowBlur, no filters.
 */
import type { Element } from './content';
import type { Cam } from './layout';
import { CYAN, GOLD, GOLD_HI, ICE, REST, SILVER, brainPath, geoPaths, glow, linesPath, outlinePath, rgba } from './paint';

const TAU = Math.PI * 2;

export interface PicState {
  /** the element in the light (null: none, e.g. the lobby) and its fill */
  current: string | null;
  fill: number;
  /** how lit each element is (0 waiting … 1 lit), by id */
  lit: (id: string) => number;
  /** the fill is growing (gold), blind (silver), rest (violet, the breath swells everything) */
  filling: boolean;
  blind: boolean;
  rest: boolean;
  /** the lungs' fullness 0..1 in rest (the lit body breathes) */
  breath: number;
  /** seconds (for the slow pulse of the waiting outline) */
  time: number;
  reducedMotion?: boolean;
}

/** Set the camera's transform (with a horizontal squeeze about x = 0 for a turn). */
function setCam(ctx: CanvasRenderingContext2D, dpr: number, cam: Cam, squeeze = 1): void {
  ctx.setTransform(dpr * cam.s * squeeze, 0, 0, dpr * cam.s, dpr * cam.ox, dpr * cam.oy);
}

/** One element: ghost, lit or in the light (with its fill). `clip` is the outline its bands are cut by. */
function drawElement(ctx: CanvasRenderingContext2D, e: Element, st: PicState, s: number, clip: Path2D | null): void {
  const P = geoPaths(e.geo);
  const cur = st.current === e.id;
  const lit = Math.max(0, Math.min(1, st.lit(e.id)));
  const px = 1 / s;
  const deep = !!e.geo.deep;
  // how much colour: a ghost (0.22), lit (0.75), in the light: from 0.32 to 1 with the fill
  const quiet = !!e.geo.quiet && !cur && lit < 0.5;
  // a large band (a limb segment, a lobe) lit is a softer wash, so the lit body never turns into blocks of colour
  const band = !!e.geo.clip && !cur;
  const k = cur ? 0.32 + 0.68 * st.fill : (quiet ? 0.1 : band ? 0.14 : 0.22) + (band ? 0.34 : 0.53) * lit;
  const breathe = st.rest && lit > 0 ? 0.08 * st.breath : 0;
  const fillCol = cur || lit > 0.5 ? e.hue : e.deep;
  if (P.fill) {
    if (e.geo.clip && clip) {
      ctx.save();
      ctx.clip(clip);
    }
    ctx.fillStyle = rgba(fillCol, Math.min(1, (deep && !cur && lit < 0.5 ? 0.35 : 1) * (k + breathe)));
    ctx.fill(P.fill);
    if (e.geo.clip && clip) ctx.restore();
  }
  for (const L of P.lines) {
    ctx.strokeStyle = rgba(fillCol, Math.min(1, k + breathe));
    ctx.lineWidth = L.w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(L.p);
  }
  if (P.skin) {
    const o = outlinePath();
    if (o) {
      ctx.strokeStyle = rgba(cur || lit > 0.5 ? e.hue : e.deep, Math.min(1, 0.25 + k));
      ctx.lineWidth = Math.max(0.006, 5 * px);
      ctx.stroke(o);
    }
  }
  if (P.marks && (cur || lit > 0)) {
    ctx.strokeStyle = rgba('#ffffff', 0.25 + 0.35 * (cur ? st.fill : lit));
    ctx.lineWidth = 1.2 * px;
    ctx.lineCap = 'round';
    ctx.stroke(P.marks);
  }
  // the outline: thin ghost lines while waiting (dashed for a deep structure seen through), bright in the light
  if (P.fill && !e.geo.clip && !quiet) {
    if (deep && !cur) ctx.setLineDash([4 * px, 3 * px]);
    ctx.strokeStyle = cur ? rgba('#ffffff', 0.75 + 0.25 * Math.sin(st.time * 3.2)) : rgba(e.hue, lit > 0 ? 0.7 : 0.3);
    ctx.lineWidth = (cur ? 2 : 1) * px;
    ctx.stroke(P.fill);
    ctx.setLineDash([]);
  } else if (P.fill && cur && clip) {
    // a band: its edge inside the outline, drawn clipped
    ctx.save();
    ctx.clip(clip);
    ctx.strokeStyle = rgba('#ffffff', 0.7 + 0.25 * Math.sin(st.time * 3.2));
    ctx.lineWidth = 2 * px;
    ctx.stroke(P.fill);
    ctx.restore();
  }
}

/** The drawing order: bands first, then shapes, deep structures, and the element in the light on top. */
function ordered(els: readonly Element[], cur: string | null): Element[] {
  const rank = (e: Element) => (e.id === cur ? 3 : e.geo.clip ? 0 : e.geo.deep ? 2 : 1);
  return [...els].sort((a, b) => rank(a) - rank(b));
}

/** The glows and the ring: drawn after the shapes, additively. */
function drawLight(ctx: CanvasRenderingContext2D, els: readonly Element[], st: PicState, s: number): void {
  const px = 1 / s;
  for (const e of els) {
    const cur = st.current === e.id;
    const lit = st.lit(e.id);
    const [cx, cy] = e.geo.c;
    const r = e.geo.r;
    if (lit > 0 && !cur) glow(ctx, e.hue, cx, cy, r * (1.25 + 0.2 * (st.rest ? st.breath : 0)), 0.22 * lit + (st.rest ? 0.12 * st.breath : 0));
    if (!cur) continue;
    // the element in the light: its glow grows with the fill
    glow(ctx, st.filling ? GOLD : e.hue, cx, cy, r * (1 + 0.8 * st.fill), 0.15 + 0.55 * st.fill);
    // the ring: how full it is (gold while it fills, silver in a blind push)
    const R = r + 9 * px;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(233,251,255,.18)';
    ctx.lineWidth = 3 * px;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    if (st.fill > 0.002) {
      ctx.strokeStyle = st.blind ? SILVER : st.filling ? GOLD_HI : rgba(ICE, 0.9);
      ctx.lineWidth = 3.5 * px;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * st.fill);
      ctx.stroke();
    }
  }
}

/**
 * The figure (front or back) with the elements of its view.  `alpha` fades it (a dive), `squeeze` narrows it about its
 * midline (a turn: cos of the angle, the back drawn past the half).
 */
export function drawFigure(ctx: CanvasRenderingContext2D, dpr: number, cam: Cam, back: boolean, els: readonly Element[], st: PicState, alpha = 1, squeeze = 1): void {
  const o = outlinePath();
  if (!o || alpha <= 0.01) return;
  setCam(ctx, dpr, cam, Math.max(0.02, squeeze));
  const s = cam.s * Math.max(0.3, squeeze);
  const px = 1 / s;
  ctx.globalAlpha = alpha;
  // the glass body: light from above, a soft inner glow at the chest; the rest's breath swells it a little
  const g = ctx.createLinearGradient(0, 0, 0, 1);
  g.addColorStop(0, back ? 'rgba(140,200,235,.22)' : 'rgba(150,215,240,.26)');
  g.addColorStop(0.35, 'rgba(110,170,225,.17)');
  g.addColorStop(1, 'rgba(70,110,190,.12)');
  ctx.fillStyle = g;
  ctx.fill(o);
  glow(ctx, st.rest ? REST : CYAN, 0, 0.3, 0.32 + (st.rest ? 0.03 * st.breath : 0), 0.1 + (st.rest ? 0.08 * st.breath : 0));
  const quiet = linesPath(back ? 'back' : 'quiet');
  if (quiet) {
    ctx.strokeStyle = 'rgba(190,235,255,.13)';
    ctx.lineWidth = 1.1 * px;
    ctx.stroke(quiet);
  }
  for (const e of ordered(els, st.current)) drawElement(ctx, e, st, s, o);
  // the rim of light
  ctx.strokeStyle = 'rgba(143,214,232,.14)';
  ctx.lineWidth = 5 * px;
  ctx.stroke(o);
  ctx.strokeStyle = 'rgba(190,240,255,.62)';
  ctx.lineWidth = 1.3 * px;
  ctx.stroke(o);
  if (!back) {
    // the face, barely: closed eyes in peace
    ctx.strokeStyle = 'rgba(220,245,255,.4)';
    ctx.lineWidth = 1 * px;
    for (const sx of [1, -1]) {
      ctx.beginPath();
      ctx.arc(sx * 0.017, 0.072, 0.008, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  drawLight(ctx, els, st, s);
  ctx.globalAlpha = 1;
}

/** The brain in a view (lateral: the left hemisphere from the side; medial: a cut through the middle) with its elements. */
export function drawBrain(ctx: CanvasRenderingContext2D, dpr: number, cam: Cam, view: 'lat' | 'med', els: readonly Element[], st: PicState, alpha = 1, squeeze = 1): void {
  const hemi = brainPath(view);
  if (!hemi || alpha <= 0.01) return;
  setCam(ctx, dpr, cam, Math.max(0.02, squeeze));
  // the turn squeezes about the brain's middle (x = 0.5): shift so the squeeze is centred
  if (squeeze !== 1) {
    const sq = Math.max(0.02, squeeze);
    ctx.setTransform(dpr * cam.s * sq, 0, 0, dpr * cam.s, dpr * (cam.ox + 0.5 * cam.s * (1 - sq)), dpr * cam.oy);
  }
  const s = cam.s * Math.max(0.3, squeeze);
  const px = 1 / s;
  ctx.globalAlpha = alpha;
  // the cerebellum and the stem under the lateral face (the medial view has them as elements)
  if (view === 'lat') {
    const cb = brainPath('cereb'), stem = brainPath('stem');
    if (stem) { ctx.fillStyle = 'rgba(150,170,230,.2)'; ctx.fill(stem); ctx.strokeStyle = 'rgba(190,220,255,.35)'; ctx.lineWidth = px; ctx.stroke(stem); }
    if (cb) { ctx.fillStyle = 'rgba(140,200,210,.22)'; ctx.fill(cb); ctx.strokeStyle = 'rgba(190,240,255,.4)'; ctx.lineWidth = px; ctx.stroke(cb); }
  }
  const g = ctx.createLinearGradient(0, 0, 0, 0.65);
  g.addColorStop(0, 'rgba(205,190,245,.26)');
  g.addColorStop(1, 'rgba(120,120,200,.16)');
  ctx.fillStyle = g;
  ctx.fill(hemi);
  glow(ctx, st.rest ? REST : CYAN, 0.5, 0.33, 0.42 + (st.rest ? 0.04 * st.breath : 0), 0.1 + (st.rest ? 0.08 * st.breath : 0));
  for (const e of ordered(els, st.current)) drawElement(ctx, e, st, s, hemi);
  const sulci = linesPath(view === 'lat' ? 'latSulci' : 'medSulci');
  if (sulci) {
    ctx.strokeStyle = 'rgba(230,220,255,.32)';
    ctx.lineWidth = 1.4 * px;
    ctx.lineCap = 'round';
    ctx.stroke(sulci);
  }
  ctx.strokeStyle = 'rgba(143,214,232,.16)';
  ctx.lineWidth = 5 * px;
  ctx.stroke(hemi);
  ctx.strokeStyle = 'rgba(214,226,255,.66)';
  ctx.lineWidth = 1.3 * px;
  ctx.stroke(hemi);
  drawLight(ctx, els, st, s);
  ctx.globalAlpha = 1;
}
