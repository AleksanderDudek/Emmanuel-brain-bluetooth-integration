/**
 * The trunk in profile and its deep muscles, a living corset round the lumbar spine (DESIGN.md §24.5).  Drawn in
 * geo.ts's units (≈ 4 mm), the same body as the spine's picture: the diaphragm its roof (a dome from the lower ribs in
 * front down to the crura on the lumbar spine behind), the pelvic floor its floor (from the pubis to the coccyx), the
 * transversus abdominis its wall (horizontal fibres round the waist, from the fascia behind to the front), the
 * multifidus close behind the spine (short thick bundles from each spinous process down 2–5 levels and onto the
 * sacrum).  The lower ribs and the pelvis are faint pearl for orientation.
 *
 *   wielodzielny  the multifidus's bundles light one by one, L1 to the sacrum
 *   poprzeczny    the transversus's fibres wrap the waist from behind to the front, like a belt drawn gently
 *   oddech        the diaphragm and the pelvic floor move down together on the breath in, up on the breath out;
 *                 the pressure between them glows (≈ 1–1.5 cm in quiet breathing: Talasz et al. 2011)
 *   gorset        all four together, breathing
 */
import { GOLD, GOLD_HI, ROSE, glow, rgba, smoothPath } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { stillDiscPaths, stillVerts } from './bones';
import { BODY, DISCS, VERTS, axisAt, clamp, hash, inFrame, seg, segMid, smooth, type Pt, type Rect } from './geo';
import { counterText } from './i18n';
import { VMID, bodyPath, drawFigure, ghostSpine, hair, litDisc, litVert, sac } from './world-spine';

export const CORE_VIEW: Rect = { x: -60, y: -48, w: 100, h: 146 };
export const MULTI_VIEW: Rect = { x: -18, y: 2, w: 50, h: 76 };

const MUSCLE = '#ff7d92';
const MUSCLE_HI = '#ffc2b8';

// ── the multifidus ────────────────────────────────────────────────
/** The tip of a lumbar spinous process (as bones.ts draws it) and a point on the lamina behind a body. */
function spinousTip(id: string): Pt {
  const g = seg(id);
  const f = segMid(g);
  const d = g.depth / 2, len = 7.6, ang = 0.12;
  const p = inFrame(f, d + 3 + len * Math.cos(ang), len * Math.sin(ang));
  return [p[0], p[1]];
}
function laminaAt(id: string, v = 0): Pt {
  const g = seg(id);
  const f = segMid(g);
  const out = g.region === 'S' ? g.depth / 2 + 2.6 : g.depth / 2 + 3.4;
  const p = inFrame(f, out, v);
  return [p[0], p[1]];
}
interface Fascicle { from: Pt; to: Pt; w: number; level: number }
const LEVELS = ['T11', 'T12', 'L1', 'L2', 'L3', 'L4', 'L5'];
const BELOW = ['T12', 'L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3', 'S4'];
const FASCICLES: readonly Fascicle[] = (() => {
  const out: Fascicle[] = [];
  LEVELS.forEach((id, k) => {
    const from = id.startsWith('T') ? laminaAt(id, -1) : spinousTip(id);
    for (const span of [2, 3, 4]) {
      const j = Math.min(BELOW.length - 1, k + span - 1);
      const to = laminaAt(BELOW[j], 1.2 + span * 0.4);
      out.push({ from, to, w: 0.9 + 0.35 * span + (id.startsWith('L') ? 0.5 : 0), level: k });
    }
  });
  return out;
})();

function fasciclePath(f: Fascicle): Path2D {
  const p = new Path2D();
  const dx = f.to[0] - f.from[0], dy = f.to[1] - f.from[1], d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const mx = (f.from[0] + f.to[0]) / 2, my = (f.from[1] + f.to[1]) / 2;
  p.moveTo(f.from[0], f.from[1]);
  p.quadraticCurveTo(mx + nx * f.w, my + ny * f.w, f.to[0], f.to[1]);
  p.quadraticCurveTo(mx - nx * f.w * 0.7, my - ny * f.w * 0.7, f.from[0], f.from[1]);
  p.closePath();
  return p;
}

// ── the diaphragm, the pelvic floor, the transversus ─────────────
const DIAPH: readonly Pt[] = [[-40, -5], [-39, -17], [-31, -26], [-19, -29.5], [-9.5, -25.5], [-5, -16], [-4, -4], [-5, 8], [-6.5, 18]];
/** how much each diaphragm point moves with the breath (the dome most, its attachments not at all) */
const DIAPH_W = [0, 0.45, 0.85, 1, 0.9, 0.6, 0.3, 0.1, 0];
const FLOOR: readonly Pt[] = [[-27, 80], [-20, 87], [-10, 91], [0, 89.5], [6, 85.5], [8, 83.5]];
const FLOOR_W = [0, 0.6, 1, 0.8, 0.3, 0];
/** Quiet breathing moves the dome ≈ 1.5 cm (3.75 units) and the floor less, both down on the breath in. */
const DOME_MOVE = 3.75, FLOOR_MOVE = 1.6;

/** The front of the belly at height y (the body's outline), for the transversus's fibres. */
function frontX(y: number): number {
  const front = BODY.filter(([x, yy]) => x < -20 && yy > -60 && yy < 90).sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < front.length; i++) {
    if (y <= front[i][1]) {
      const [x0, y0] = front[i - 1], [x1, y1] = front[i];
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
  }
  return front[front.length - 1][0];
}
const TRA_Y: readonly number[] = Array.from({ length: 14 }, (_, i) => -2 + i * 4);

/** The front of the lumbar bodies at height y (the sheet's fibres run from there, its fascia behind the spine). */
function spineFront(y: number): number {
  let best = VERTS[0], bd = 1e9;
  for (const v of VERTS) {
    const m = segMid(v);
    if (Math.abs(m.y - y) < bd) { bd = Math.abs(m.y - y); best = v; }
  }
  const m = segMid(best);
  return m.x - best.depth / 2 - 1.2;
}
function traFibre(y: number, breathOut: number, k = 1): Pt[] {
  const xf = frontX(y) + 3.2 + breathOut * 0.8, xb = spineFront(y);
  const pts: Pt[] = [];
  for (let s = 0; s <= 10; s++) {
    const t = s / 10;
    const x = xb + (xf - xb) * t * k;
    // the sheet curves round the side: lower toward the front, a gentle sag in the middle
    pts.push([x, y + Math.sin(Math.PI * t) * 1.4 + t * 1.2]);
  }
  return pts;
}

/** The breath used by the picture: rest's own breath, or a calm 4-in / 6-out cycle when there is none. */
function breathOf(st: WorldState): number {
  if (st.reduced) return 0.5;
  if (st.breath !== 0.5) return st.breath;
  const t = st.time % 10;
  return t < 4 ? 0.5 - 0.5 * Math.cos((Math.PI * t) / 4) : 0.5 + 0.5 * Math.cos((Math.PI * (t - 4)) / 6);
}

function diaphPts(b: number): Pt[] {
  return DIAPH.map(([x, y], i) => [x, y + DOME_MOVE * (b - 0.5) * DIAPH_W[i]] as Pt);
}
function floorPts(b: number): Pt[] {
  return FLOOR.map(([x, y], i) => [x, y + FLOOR_MOVE * (b - 0.5) * FLOOR_W[i]] as Pt);
}

/** The cavity between them (for the pressure's glow). */
function cavityPath(b: number): Path2D {
  const p = new Path2D();
  const top = diaphPts(b), bot = floorPts(b);
  smoothPath(p, top);
  // down the front of the lumbar spine to the sacrum's front, the floor back to front, up the belly
  for (const id of ['L2', 'L3', 'L4', 'L5', 'S1', 'S3']) {
    const g = seg(id);
    const f = segMid(g);
    const q = inFrame(f, -g.depth / 2 - 0.5, 0);
    p.lineTo(q[0], q[1]);
  }
  for (const q of [...bot].reverse()) p.lineTo(q[0], q[1]);
  for (let y = 78; y >= -10; y -= 6) p.lineTo(frontX(y) + 3, y);
  p.closePath();
  return p;
}

// ── the bones for orientation ─────────────────────────────────────
function bakeFrame(ctx: CanvasRenderingContext2D): void {
  // the pelvis, faint: the iliac crest arching from behind the sacrum to the front, the hip socket, the pubis
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba('#efe3ff', 0.16);
  ctx.lineWidth = hair(ctx, 1.2);
  const s1 = segMid(seg('S1'));
  ctx.beginPath();
  ctx.moveTo(s1.x + 9, s1.y - 2);
  ctx.bezierCurveTo(s1.x + 4, s1.y - 14, -18, 34, -30, 47);
  ctx.quadraticCurveTo(-34, 52, -29, 56);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-17, 70, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-24, 74);
  ctx.quadraticCurveTo(-28, 78, -27, 81);
  ctx.stroke();
  glow(ctx, '#efe3ff', -17, 70, 6, 0.05);
}

function bakeGhosts(ctx: CanvasRenderingContext2D): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // the transversus, faint
  ctx.strokeStyle = rgba(MUSCLE_HI, 0.045);
  ctx.lineWidth = 0.6;
  for (const y of TRA_Y) {
    ctx.beginPath();
    smoothPath(ctx, traFibre(y, 0));
    ctx.stroke();
  }
  // the multifidus, faint
  for (const f of FASCICLES) {
    const P = fasciclePath(f);
    ctx.fillStyle = rgba(MUSCLE, 0.07);
    ctx.fill(P);
    ctx.strokeStyle = rgba(MUSCLE_HI, 0.18);
    ctx.lineWidth = hair(ctx, 0.8);
    ctx.stroke(P);
  }
  // the diaphragm and the floor, faint
  ctx.strokeStyle = rgba(MUSCLE_HI, 0.22);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  smoothPath(ctx, DIAPH);
  ctx.stroke();
  ctx.beginPath();
  smoothPath(ctx, FLOOR);
  ctx.stroke();
}

// ── the painter ───────────────────────────────────────────────────
export function corePt(name: string): Pt {
  switch (name) {
    case 'multiTop': return spinousTip('L1');
    case 'multi': {
      const f = FASCICLES.find(x => x.level === 5)!;
      return [(f.from[0] + f.to[0]) / 2 + 1, (f.from[1] + f.to[1]) / 2];
    }
    case 'spinous': return spinousTip('L2');
    case 'sacrum': return laminaAt('S3', 0);
    case 'tra': return [-37, 24];
    case 'diaphragm': return [-22, -34];
    case 'pelvicfloor': return [-12, 90];
    case 'pressure': return [-20, 32];
    case 'l45': {
      const m = segMid(seg('L4–L5'));
      return [m.x, m.y];
    }
    default: return [-20, 30];
  }
}

export const CORE: WorldPainter = {
  depth: 0,
  lens: false,
  bake(ctx) {
    drawFigure(ctx, bodyPath(), 0.9);
    bakeFrame(ctx);
    ghostSpine(ctx, stillVerts(), stillDiscPaths(), sac(), 0.85);
    bakeGhosts(ctx);
  },
  draw(ctx, st) {
    const b = breathOf(st);
    switch (st.scene) {
      case 'wielodzielny': return drawMulti(ctx, st, st.g, true);
      case 'poprzeczny': return drawTra(ctx, st, st.g, b, true);
      case 'oddech': return drawBreath(ctx, st, st.g, b, true);
      case 'gorset': {
        const g = st.g;
        drawPressure(ctx, b, 0.25 + 0.6 * smooth(0.5, 1, g), st);
        drawBreathParts(ctx, b, smooth(0, 0.3, g), smooth(0.2, 0.55, g));
        drawTra(ctx, st, smooth(0.25, 0.6, g), b, false);
        drawMulti(ctx, st, smooth(0.5, 0.85, g), false);
        if (g > 0.85) for (let i = 0; i < VERTS.length; i++) if (VERTS[i].region === 'L') litVert(ctx, stillVerts()[i], smooth(0.85, 1, g) * 0.8, 0, VMID[i].x, VMID[i].y);
        return;
      }
    }
  },
  focusAt(scene, g) {
    if (scene === 'wielodzielny') {
      const f = FASCICLES[Math.min(FASCICLES.length - 1, Math.floor(g * FASCICLES.length))];
      return [(f.from[0] + f.to[0]) / 2, (f.from[1] + f.to[1]) / 2];
    }
    if (scene === 'poprzeczny') return [frontX(26) + 6 + (1 - g) * 30, 26];
    return corePt('pressure');
  },
  counter(scene, g) {
    if (scene === 'oddech' && g > 0.4) return counterText('breath', 0);
    return null;
  },
};

function drawMulti(ctx: CanvasRenderingContext2D, st: WorldState, g: number, own: boolean): void {
  if (g <= 0) return;
  const n = g * FASCICLES.length;
  for (let i = 0; i < FASCICLES.length; i++) {
    const a = clamp(n - i);
    if (a <= 0) break;
    const f = FASCICLES[i];
    const flash = own && !st.reduced ? clamp(1 - (n - i - 1) / 3) : 0;
    const P = fasciclePath(f);
    const gr = ctx.createLinearGradient(f.from[0], f.from[1], f.to[0], f.to[1]);
    gr.addColorStop(0, rgba(MUSCLE_HI, 0.5 * a));
    gr.addColorStop(0.5, rgba(MUSCLE, 0.45 * a));
    gr.addColorStop(1, rgba(MUSCLE_HI, 0.5 * a));
    ctx.fillStyle = gr;
    ctx.fill(P);
    ctx.strokeStyle = rgba(flash > 0.05 ? GOLD_HI : MUSCLE_HI, (0.6 + 0.3 * flash) * a);
    ctx.lineWidth = hair(ctx, 1);
    ctx.stroke(P);
    // its fibres along it
    ctx.strokeStyle = rgba('#ffe1da', 0.3 * a);
    ctx.lineWidth = hair(ctx, 0.6);
    ctx.beginPath();
    ctx.moveTo(f.from[0], f.from[1]);
    ctx.lineTo(f.to[0], f.to[1]);
    ctx.stroke();
    if (flash > 0.05) glow(ctx, GOLD, (f.from[0] + f.to[0]) / 2, (f.from[1] + f.to[1]) / 2, 3, 0.6 * flash);
  }
  if (own) {
    // the vertebrae it steadies, lit softly as it grows
    for (let i = 0; i < VERTS.length; i++) {
      const v = VERTS[i];
      if (v.region === 'L' || v.region === 'S') litVert(ctx, stillVerts()[i], 0.25 + 0.4 * g, 0, VMID[i].x, VMID[i].y);
    }
  }
}

function drawTra(ctx: CanvasRenderingContext2D, st: WorldState, g: number, b: number, own: boolean): void {
  if (g <= 0) return;
  const out = 1 - b;
  ctx.lineCap = 'round';
  // the sheet itself, a soft rose veil wrapping from the spine toward the front as it grows
  const top = traFibre(TRA_Y[0], out), bot = traFibre(TRA_Y[TRA_Y.length - 1], out);
  const sheet = new Path2D();
  smoothPath(sheet, top);
  for (const p of [...bot].reverse()) sheet.lineTo(p[0], p[1]);
  sheet.closePath();
  const reach = clamp(g * 1.25);
  ctx.save();
  ctx.clip(sheet);
  const xb = top[0][0], xf = top[top.length - 1][0];
  const gr = ctx.createLinearGradient(xb, 0, xf, 0);
  gr.addColorStop(0, rgba(MUSCLE, 0.05 * reach));
  gr.addColorStop(Math.max(0.01, reach * 0.9), rgba(MUSCLE, 0.2 * reach));
  gr.addColorStop(Math.min(1, reach + 0.001), rgba(MUSCLE, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(xf - 4, TRA_Y[0] - 4, xb - xf + 8, TRA_Y[TRA_Y.length - 1] - TRA_Y[0] + 10);
  ctx.restore();
  for (let i = 0; i < TRA_Y.length; i++) {
    const y = TRA_Y[i];
    // each fibre runs from the fascia behind toward the front, the lower ones a little later
    const k = clamp(g * 1.6 - (i / TRA_Y.length) * 0.6);
    if (k <= 0) continue;
    const pts = traFibre(y, out, k);
    ctx.strokeStyle = rgba(MUSCLE, 0.14 * k);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.stroke();
    ctx.strokeStyle = rgba(k < 1 && own ? GOLD_HI : MUSCLE_HI, 0.62 * k);
    ctx.lineWidth = hair(ctx, 1.1);
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.stroke();
    if (k < 1 && own && !st.reduced) glow(ctx, GOLD, pts[pts.length - 1][0], pts[pts.length - 1][1], 2.2, 0.6);
  }
  // where it joins at the front (the linea alba) a seam of light once it has wrapped round
  const seam = smooth(0.6, 1, g);
  if (seam > 0) {
    ctx.strokeStyle = rgba(GOLD_HI, 0.55 * seam);
    ctx.lineWidth = hair(ctx, 1.4);
    ctx.beginPath();
    TRA_Y.forEach((y, i) => {
      const p = traFibre(y, out)[10];
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();
  }
}

function drawBreathParts(ctx: CanvasRenderingContext2D, b: number, ad: number, af: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [pts, a, dome] of [[diaphPts(b), ad, true], [floorPts(b), af, false]] as const) {
    if (a <= 0) continue;
    // under the dome a soft rose light, so the roof reads as a sheet, not a line
    if (dome) {
      ctx.save();
      const P = new Path2D();
      smoothPath(P, pts);
      P.closePath();
      ctx.clip(P);
      const gr = ctx.createLinearGradient(0, pts[3][1], 0, pts[3][1] + 22);
      gr.addColorStop(0, rgba(MUSCLE, 0.18 * a));
      gr.addColorStop(1, rgba(MUSCLE, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(-46, pts[3][1] - 2, 46, 50);
      ctx.restore();
    }
    ctx.strokeStyle = rgba(MUSCLE, 0.25 * a);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.stroke();
    ctx.strokeStyle = rgba(MUSCLE_HI, 0.9 * a);
    ctx.lineWidth = hair(ctx, 1.8);
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.stroke();
    // its fibres: short strokes across the sheet
    ctx.strokeStyle = rgba('#ffe1da', 0.35 * a);
    ctx.lineWidth = hair(ctx, 0.7);
    ctx.beginPath();
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, d = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
      ctx.moveTo(mx - nx * 1.2, my - ny * 1.2);
      ctx.lineTo(mx + nx * 1.2, my + ny * 1.2);
    }
    ctx.stroke();
    // the dome's central tendon: pearl at its top
    if (dome) {
      ctx.strokeStyle = rgba('#fff4ee', 0.7 * a);
      ctx.lineWidth = hair(ctx, 2.2);
      ctx.beginPath();
      smoothPath(ctx, pts.slice(2, 5));
      ctx.stroke();
    }
  }
}

function drawPressure(ctx: CanvasRenderingContext2D, b: number, a: number, st: WorldState): void {
  if (a <= 0) return;
  ctx.save();
  ctx.clip(cavityPath(b));
  const [cx, cy] = corePt('pressure');
  const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, 52);
  gr.addColorStop(0, `rgba(159,233,255,${(0.32 * a * (0.8 + 0.2 * st.deep)).toFixed(3)})`);
  gr.addColorStop(0.6, `rgba(140,200,255,${(0.14 * a).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(140,180,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(cx - 60, cy - 80, 120, 160);
  ctx.restore();
}

function drawBreath(ctx: CanvasRenderingContext2D, st: WorldState, g: number, b: number, own: boolean): void {
  drawPressure(ctx, b, smooth(0.45, 1, g), st);
  drawBreathParts(ctx, b, smooth(0, 0.3, g), smooth(0.2, 0.5, g));
  if (own && g > 0.05) {
    // the arrows of the breath beside the dome and the floor: down on the breath in, up on the breath out
    const dir = b > 0.5 ? 1 : -1;
    const a = smooth(0.05, 0.3, g) * Math.abs(b - 0.5) * 2;
    for (const [x, y] of [[-24, -40], [-6, 96]] as const) {
      const yy = y + (dir > 0 ? 0 : 3);
      ctx.strokeStyle = rgba(GOLD_HI, 0.8 * a);
      ctx.lineWidth = hair(ctx, 1.6);
      ctx.beginPath();
      ctx.moveTo(x, yy - dir * 2.5);
      ctx.lineTo(x, yy + dir * 2.5);
      ctx.moveTo(x - 1.4, yy + dir * 1.1);
      ctx.lineTo(x, yy + dir * 2.5);
      ctx.lineTo(x + 1.4, yy + dir * 1.1);
      ctx.stroke();
    }
    // the transversus answers faintly (it tunes the shape of the pressurised cavity with the diaphragm)
    drawTra(ctx, st, 0.35 * smooth(0.5, 1, g), b, false);
  }
  // the discs of the low back in the middle of it all, quietly lit
  const discs = stillDiscPaths();
  for (let i = 0; i < DISCS.length; i++) if (DISCS[i].region === 'L' || DISCS[i].id.startsWith('T12')) litDisc(ctx, i, discs[i], 0.35 + 0.3 * g, 0);
  void hash;
  void axisAt;
  void ROSE;
}
