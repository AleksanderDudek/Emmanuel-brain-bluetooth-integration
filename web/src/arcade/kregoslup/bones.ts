/**
 * The spine drawn in profile (DESIGN.md §24.5): pearl vertebrae lit from within, aqua discs between them, the
 * posterior arches fainter behind — shared by the whole-body pictures (world-spine.ts, world-core.ts).  Every shape is
 * built from geo.ts's segments; `shift(s)` lets a picture slide them along the axis (the evening's shorter spine).
 */
import { DISCS, SEGS, VERTS, axisAt, inFrame, type Frame, type Seg } from './geo';

export const BONE = '#f6f0ff';
export const BONE_WARM = '#ffe9d6';
export const WATER = '#9fe9ff';
export const WATER_HI = '#e6fbff';

/** How a segment is placed: its frame at the middle (after a slide along the axis) and its half height. */
export interface Placed { f: Frame; hh: number }
export type Shift = (s: number) => number;
const none: Shift = () => 0;

export function place(g: Seg, shift: Shift = none, discScale = 1): Placed {
  const mid = (g.s0 + g.s1) / 2;
  const h = (g.s1 - g.s0) * (g.kind === 'd' ? discScale : 1);
  return { f: axisAt(mid + shift(mid)), hh: h / 2 };
}

/** The four corners of a body: top front, top back, bottom back, bottom front. */
export function corners(p: Placed, depth: number): [number, number][] {
  const d = depth / 2;
  return [inFrame(p.f, -d, -p.hh), inFrame(p.f, d, -p.hh), inFrame(p.f, d, p.hh), inFrame(p.f, -d, p.hh)];
}

/** A vertebral body: a rounded block, its front a little waisted (the lumbar bodies most). */
export function bodyPath(g: Seg, p: Placed): Path2D {
  const d = g.depth / 2, hh = p.hh, r = Math.min(hh, d) * 0.38;
  const waist = g.region === 'L' ? 0.5 : g.region === 'T' ? 0.3 : 0.15;
  const P = (u: number, v: number) => inFrame(p.f, u, v);
  const path = new Path2D();
  let q = P(-d + r, -hh);
  path.moveTo(q[0], q[1]);
  q = P(d - r, -hh); path.lineTo(q[0], q[1]);
  let c = P(d, -hh), e = P(d, -hh + r); path.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  q = P(d, hh - r); path.lineTo(q[0], q[1]);
  c = P(d, hh); e = P(d - r, hh); path.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  q = P(-d + r, hh); path.lineTo(q[0], q[1]);
  c = P(-d, hh); e = P(-d, hh - r); path.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  c = P(-d + waist, 0); e = P(-d, -hh + r); path.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  c = P(-d, -hh); e = P(-d + r, -hh); path.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  path.closePath();
  return path;
}

/** The arch behind a body seen from the side: the pedicle and the articular pillar, then the spinous process. */
export function archPath(g: Seg, p: Placed): Path2D | null {
  if (g.region === 'S' || g.region === 'Co') return null;
  const d = g.depth / 2, hh = p.hh;
  const P = (u: number, v: number) => inFrame(p.f, u, v);
  const path = new Path2D();
  const num = Number(g.id.slice(1));
  // the pedicle and the pillar of the facet joints
  const pil = g.region === 'C' ? 2.4 : g.region === 'T' ? 2.8 : 3.4;
  // the spinous process: short in the neck (long at C7), long and slanting down in the chest, square in the low back
  let len = 3.0, ang = 0.25, w0 = hh * 0.7, w1 = 0.7;
  if (g.region === 'C' && num === 7) { len = 6; ang = 0.32; }
  else if (g.region === 'C' && num === 2) { len = 4.0; ang = 0.15; w0 = hh * 0.6; }
  else if (g.region === 'C' && num === 1) { len = 2.2; ang = 0; w0 = hh * 0.5; }
  else if (g.region === 'T') {
    const k = Math.sin(((num - 1) / 11) * Math.PI);
    len = 6.2 + 1.8 * k; ang = 0.55 + 0.45 * k; w0 = hh * 0.62; w1 = 0.9;
  } else if (g.region === 'L') { len = 6.6; ang = 0.12; w0 = hh * 0.82; w1 = hh * 0.62; }
  // one outline: from the body's back up the pedicle to the pillar of the facet joints, out along the top of the
  // spinous process, round its tip, back along its underside, down the pillar and into the body again
  const bx = d + pil * 0.8;
  const tipU = bx + len * Math.cos(ang), tipV = len * Math.sin(ang);
  const a = P(d - 0.2, -hh * 0.8), b = P(d + pil * 0.55, -hh * 1.06);
  const s0 = P(bx, -w0 * 0.7);
  const t0 = P(tipU, tipV - w1 / 2), t1 = P(tipU + 0.3, tipV + w1 / 2);
  const s1 = P(bx + 0.3, w0 * 0.55), c2 = P(d + pil * 0.7, hh * 0.68), e = P(d - 0.2, hh * 0.12);
  path.moveTo(a[0], a[1]);
  path.lineTo(b[0], b[1]);
  path.quadraticCurveTo(...P(d + pil * 0.85, -hh * 1.0), s0[0], s0[1]);
  path.quadraticCurveTo(...P(bx + len * 0.55, -w0 * 0.3 + tipV * 0.45), t0[0], t0[1]);
  path.quadraticCurveTo(...P(tipU + 1.0, tipV), t1[0], t1[1]);
  path.quadraticCurveTo(...P(bx + len * 0.5, w0 * 0.55 + tipV * 0.5), s1[0], s1[1]);
  path.quadraticCurveTo(...P(d + pil * 0.95, hh * 0.5), c2[0], c2[1]);
  path.quadraticCurveTo(...P(d + pil * 0.3, hh * 0.45), e[0], e[1]);
  path.closePath();
  return path;
}

/** C1 (the atlas) has no body: a small front arch and a ring behind; C2 lends it its tooth (the dens). */
export function atlasPath(p: Placed): Path2D {
  const P = (u: number, v: number) => inFrame(p.f, u, v);
  const path = new Path2D();
  const c = P(-1.4, 0);
  path.ellipse(c[0], c[1], 1.1, p.hh * 0.75, Math.atan2(p.f.ty, p.f.tx) - Math.PI / 2, 0, Math.PI * 2);
  return path;
}
export function densPath(g: Seg, p: Placed): Path2D {
  const P = (u: number, v: number) => inFrame(p.f, u, v);
  const path = new Path2D();
  const a = P(-0.9, -p.hh), b = P(-0.7, -p.hh - 3.2), c = P(0.9, -p.hh - 3.2), d = P(1.1, -p.hh);
  path.moveTo(a[0], a[1]);
  path.lineTo(b[0], b[1]);
  path.quadraticCurveTo(...P(0.1, -p.hh - 4.4), c[0], c[1]);
  path.lineTo(d[0], d[1]);
  path.closePath();
  void g;
  return path;
}

/** The disc between two bodies: the gap between their end plates, bulging a little front and back. */
export function discPath(i: number, shift: Shift = none, discScale = 1): Path2D {
  const d = DISCS[i];
  const k = SEGS.indexOf(d);
  const up = SEGS[k - 1], down = SEGS[k + 1];
  const pu = place(up, shift, discScale), pd = place(down, shift, discScale);
  const [, , ubp, ubf] = corners(pu, up.depth * 0.96);
  const [dtf, dtp] = corners(pd, down.depth * 0.96);
  const pm = place(d, shift, discScale);
  const front = inFrame(pm.f, -d.depth / 2 - 0.45, 0), back = inFrame(pm.f, d.depth / 2 + 0.35, 0);
  const path = new Path2D();
  path.moveTo(ubf[0], ubf[1]);
  path.lineTo(ubp[0], ubp[1]);
  path.quadraticCurveTo(back[0], back[1], dtp[0], dtp[1]);
  path.lineTo(dtf[0], dtf[1]);
  path.quadraticCurveTo(front[0], front[1], ubf[0], ubf[1]);
  path.closePath();
  return path;
}

/** The nucleus of a disc: an oval a little behind the middle. */
export function nucleusAt(i: number, shift: Shift = none, discScale = 1): { x: number; y: number; rx: number; ry: number; rot: number } {
  const d = DISCS[i];
  const pm = place(d, shift, discScale);
  const [x, y] = inFrame(pm.f, d.depth * 0.08, 0);
  return { x, y, rx: d.depth * 0.24, ry: pm.hh * 0.62, rot: Math.atan2(pm.f.py, pm.f.px) };
}

/** The sacrum seen from the side: one curved wedge of five fused pieces, the lines of their fusion faint across it. */
export function sacrumPath(shift: Shift = none): { outline: Path2D; ridges: [number, number][][] } {
  const S = VERTS.filter(v => v.region === 'S');
  const front: [number, number][] = [], back: [number, number][] = [], ridges: [number, number][][] = [];
  for (let i = 0; i < S.length; i++) {
    const g = S[i];
    for (const v of [-0.5, 0.5]) {
      const s = g.s0 + (g.s1 - g.s0) * (v + 0.5);
      const f = axisAt(s + shift(s));
      const dep = g.depth / 2;
      front.push(inFrame(f, -dep, 0));
      back.push(inFrame(f, dep + 3.2 - i * 0.55, 0));
    }
    if (i > 0) {
      const f = axisAt(g.s0 + shift(g.s0));
      ridges.push([inFrame(f, -g.depth / 2 + 0.3, 0), inFrame(f, g.depth / 2 + 2.6 - i * 0.55, 0)]);
    }
  }
  const outline = new Path2D();
  outline.moveTo(front[0][0], front[0][1]);
  for (const p of front.slice(1)) outline.lineTo(p[0], p[1]);
  for (const p of back.reverse()) outline.lineTo(p[0], p[1]);
  outline.closePath();
  return { outline, ridges };
}

/** A sacral piece (for lighting one at a time): its band across the wedge. */
export function sacralBand(g: Seg, shift: Shift = none): Path2D {
  const i = Number(g.id.slice(1)) - 1;
  const p = new Path2D();
  const f0 = axisAt(g.s0 + shift(g.s0)), f1 = axisAt(g.s1 + shift(g.s1));
  const a = inFrame(f0, -g.depth / 2, 0.15), b = inFrame(f0, g.depth / 2 + 3.2 - i * 0.55, 0.15);
  const c = inFrame(f1, g.depth / 2 + 3.2 - (i + 1) * 0.55, -0.15), d = inFrame(f1, -g.depth / 2 + 0.6, -0.15);
  p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); p.lineTo(c[0], c[1]); p.lineTo(d[0], d[1]); p.closePath();
  return p;
}

/** A coccygeal piece: a small rounded bead. */
export function coccyxPath(g: Seg, p: Placed): Path2D {
  const path = new Path2D();
  path.ellipse(p.f.x, p.f.y, g.depth / 2, p.hh * 0.95, Math.atan2(p.f.py, p.f.px), 0, Math.PI * 2);
  return path;
}

/** Every vertebra's paths, for the still pictures (built once per slide). */
export interface VertShape { g: Seg; body: Path2D; arch: Path2D | null; extra: Path2D | null }
export function vertShapes(shift: Shift = none, discScale = 1): VertShape[] {
  const out: VertShape[] = [];
  for (const g of VERTS) {
    const p = place(g, shift, discScale);
    if (g.region === 'S') out.push({ g, body: sacralBand(g, shift), arch: null, extra: null });
    else if (g.region === 'Co') out.push({ g, body: coccyxPath(g, p), arch: null, extra: null });
    else if (g.id === 'C1') out.push({ g, body: atlasPath(p), arch: archPath(g, p), extra: null });
    else out.push({ g, body: bodyPath(g, p), arch: archPath(g, p), extra: g.id === 'C2' ? densPath(g, p) : null });
  }
  return out;
}

let still: VertShape[] | null = null;
let stillDiscs: Path2D[] | null = null;
export const stillVerts = (): VertShape[] => (still ??= vertShapes());
export const stillDiscPaths = (): Path2D[] => (stillDiscs ??= DISCS.map((_, i) => discPath(i)));
