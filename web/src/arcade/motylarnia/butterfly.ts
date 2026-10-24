/**
 * Motylarnia's procedural art, part two: the butterflies.  A wing is painted once into an offscreen
 * bitmap (the right half; the left is its mirror, or the female look for a gynandromorph) and then
 * flaps by squeezing it sideways.  Painting goes ground → the eaten path as a three-band gouache
 * ribbon (pigments oldest to newest, its width the appetite, its depth B: pastel watercolour at 0,
 * deep gouache at 1) → the species' markings → scale dust at the root → veins (bold when S filled) →
 * fringe; then a radiant sheen or an aberration over all.  Also the chrysalis with the wing showing
 * through its shell (three cached layers with the wing between them), the blind silk cocoon, and
 * silhouettes for undiscovered species.
 */
import { PIGMENTS, speciesById, type Aberration, type Mark, type Species, type WingLook } from './content';
import type { LeafBox } from './layout';
import { buildLeaf } from './leaf';
import { F, type ButterflyRec } from './meta';
import { canvas, ctx2d, darken, hash, lighten, mix, remember, rgba } from './paint';
import { decodePath, mapPath, wingPoint, wingShape, type BandPoint, type PathPoint, type WingShape } from './wing';

const TAU = Math.PI * 2;

export interface WingSpec {
  species: Species;
  path: readonly PathPoint[];
  box: LeafBox;
  pigments: readonly number[];
  depth: number;
  bold: boolean;
  radiant: boolean;
  aberration: Aberration | null;
  /** paint the female look (the other side of a gynandromorph) */
  female: boolean;
  /** a ghost of the wing for the chrysalis: no fringe, no shadow */
  bare?: boolean;
}

/** A painted half-wing: the canvas, where the body attaches in it, and px per half-wingspan. */
export interface WingBitmap { canvas: HTMLCanvasElement; ox: number; oy: number; scale: number }

const isHex = (c: string) => c.startsWith('#');

function lookOf(sp: Species, female: boolean): WingLook {
  return female && sp.female ? { ...sp.look, ...sp.female, marks: sp.female.marks ?? sp.look.marks } : sp.look;
}

function polyPath(pts: readonly [number, number][]): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

/** The band's three colours: eaten pigments (oldest first), missing ones a muted hint of the recipe. */
export function bandColours(sp: Species, pigments: readonly number[], depth: number, ground: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const p = pigments[i];
    let c = p === undefined ? mix(PIGMENTS[sp.classic[i]].color, ground, 0.62) : PIGMENTS[p].color;
    c = mix(c, ground, 0.08);                         // a touch of the ground ties it in
    c = mix(c, '#F6F0E1', 0.48 * (1 - depth));        // pastel watercolour … deep gouache
    out.push(depth > 0.85 ? mix(c, darken(c, 0.25), (depth - 0.85) / 0.15 * 0.35) : c);
  }
  return out;
}

/** Stroke a variable-width polyline, grouping runs of equal (quantised) width into one path. */
function strokeBand(ctx: CanvasRenderingContext2D, pts: readonly BandPoint[], mul: number, add: number, colour: string, filter?: (p: BandPoint) => boolean): void {
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const q = (p: BandPoint) => Math.round((p.w * mul + add) * 400) / 400;
  let i = 0;
  while (i < pts.length - 1) {
    if (filter && !(filter(pts[i]) && filter(pts[i + 1]))) { i++; continue; }
    const w = q(pts[i]);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    let j = i + 1;
    for (; j < pts.length; j++) {
      ctx.lineTo(pts[j].x, pts[j].y);
      if (j === pts.length - 1 || q(pts[j]) !== w || (filter && !filter(pts[j + 1]))) break;
    }
    ctx.stroke();
    i = j;
  }
}

function polarSector(w: WingShape, u0: number, u1: number, s0: number, s1: number): Path2D {
  const p = new Path2D(), q = { x: 0, y: 0 }, n = Math.max(4, Math.ceil((u1 - u0) * 60));
  for (let i = 0; i <= n; i++) {
    wingPoint(w, u0 + ((u1 - u0) * i) / n, s1, q);
    if (i) p.lineTo(q.x, q.y); else p.moveTo(q.x, q.y);
  }
  for (let i = n; i >= 0; i--) {
    wingPoint(w, u0 + ((u1 - u0) * i) / n, s0, q);
    p.lineTo(q.x, q.y);
  }
  p.closePath();
  return p;
}

function drawMarks(ctx: CanvasRenderingContext2D, w: WingShape, marks: readonly Mark[], depth: number): void {
  const q = { x: 0, y: 0 };
  const deepen = (c: string) => (isHex(c) ? mix(c, '#F6F0E1', 0.18 * (1 - depth)) : c);
  for (const m of marks) {
    switch (m.k) {
      case 'sector': {
        const path = polarSector(w, m.u0, m.u1, m.s0, m.s1);
        ctx.fillStyle = deepen(m.c);
        if (m.soft) {
          // a soft edge: the shadow of a copy drawn far away
          const dev = ctx.getTransform().a || 1;   // device px per wing unit: shadows ignore the transform
          ctx.save();
          ctx.shadowColor = deepen(m.c);
          ctx.shadowBlur = m.soft * dev;
          ctx.shadowOffsetX = 1000;
          ctx.translate(-1000 / dev, 0);
          ctx.fill(path);
          ctx.restore();
          ctx.globalAlpha = 0.55;
          ctx.fill(path);
          ctx.globalAlpha = 1;
        } else ctx.fill(path);
        break;
      }
      case 'spot':
        wingPoint(w, m.u, m.s, q);
        ctx.fillStyle = deepen(m.c);
        ctx.beginPath();
        ctx.arc(q.x, q.y, m.r, 0, TAU);
        ctx.fill();
        break;
      case 'eye': {
        wingPoint(w, m.u, m.s, q);
        const n = m.rings.length;
        m.rings.forEach((c, i) => {
          ctx.fillStyle = deepen(c);
          ctx.beginPath();
          ctx.arc(q.x, q.y, m.r * (1 - i / (n + (m.pupil ? 1.2 : 0.6))), 0, TAU);
          ctx.fill();
        });
        if (m.pupil) {
          ctx.fillStyle = m.pupil;
          ctx.beginPath();
          ctx.arc(q.x - m.r * 0.12, q.y - m.r * 0.14, m.r * 0.16, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'chain':
        ctx.fillStyle = deepen(m.c);
        for (let i = 0; i < m.n; i++) {
          const u = m.n === 1 ? m.u0 : m.u0 + ((m.u1 - m.u0) * i) / (m.n - 1);
          wingPoint(w, u, m.s, q);
          ctx.beginPath();
          if (m.shape === 'lune') {
            ctx.ellipse(q.x, q.y, m.r * 1.15, m.r * 0.62, Math.atan2(q.y - w.oy, q.x - w.ox) + Math.PI / 2, 0, TAU);
          } else if (m.shape === 'tri') {
            const a = Math.atan2(q.y - w.oy, q.x - w.ox);
            ctx.moveTo(q.x + Math.cos(a) * m.r * 1.2, q.y + Math.sin(a) * m.r * 1.2);
            ctx.lineTo(q.x + Math.cos(a + 2.2) * m.r, q.y + Math.sin(a + 2.2) * m.r);
            ctx.lineTo(q.x + Math.cos(a - 2.2) * m.r, q.y + Math.sin(a - 2.2) * m.r);
            ctx.closePath();
          } else ctx.arc(q.x, q.y, m.r, 0, TAU);
          ctx.fill();
        }
        break;
      case 'bar': {
        ctx.strokeStyle = deepen(m.c);
        ctx.lineWidth = m.w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        wingPoint(w, m.u, m.s0, q);
        ctx.moveTo(q.x, q.y);
        wingPoint(w, m.u, m.s1, q);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        break;
      }
      case 'band': {
        ctx.strokeStyle = deepen(m.c);
        ctx.lineWidth = m.w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        m.pts.forEach(([u, s], i) => {
          wingPoint(w, u, s, q);
          if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
        });
        ctx.stroke();
        break;
      }
    }
  }
}

function drawVeins(ctx: CanvasRenderingContext2D, w: WingShape, colour: string, bold: boolean): void {
  const q = { x: 0, y: 0 };
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  const fore = [0.05, 0.12, 0.2, 0.28, 0.35, 0.42], hind = [0.52, 0.61, 0.7, 0.79, 0.88, 0.95];
  for (const u of [...fore, ...hind]) {
    ctx.lineWidth = bold ? 0.011 : 0.0055;
    ctx.beginPath();
    for (let k = 0; k <= 14; k++) {
      const s = 0.14 + (0.88 * k) / 14, uu = u + 0.025 * s * s * (u < 0.47 ? -1 : 1);
      wingPoint(w, uu, s, q);
      if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
  }
  // the discal cells
  ctx.lineWidth = bold ? 0.009 : 0.0045;
  for (const [u0, u1, s] of [[0.12, 0.35, 0.44], [0.55, 0.85, 0.4]] as const) {
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      wingPoint(w, u0 + ((u1 - u0) * k) / 10, s + 0.04 * Math.sin((k / 10) * Math.PI), q);
      if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
  }
}

function fringe(ctx: CanvasRenderingContext2D, pts: readonly [number, number][], light: string, dark: string): void {
  ctx.lineCap = 'butt';
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const nx = y2 - y, ny = -(x2 - x), l = Math.hypot(nx, ny) || 1;
    ctx.strokeStyle = i % 2 === 0 ? dark : light;
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (nx / l) * 0.011, y + (ny / l) * 0.011);
    ctx.stroke();
  }
}

const signedArea = (pts: readonly [number, number][]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a;
};

/** Paint one half-wing `px` pixels per half-wingspan. */
export function paintWing(spec: WingSpec, px: number): WingBitmap {
  const sp = spec.species, w = wingShape(sp.family), look = lookOf(sp, spec.female);
  const pad = Math.ceil(px * 0.08) + 4;
  const c = canvas(px * 1.02 + pad * 2, px * (w.maxY - w.minY) + pad * 2), ctx = ctx2d(c);
  const ox = pad, oy = pad - w.minY * px;
  ctx.translate(ox, oy);
  ctx.scale(px, px);
  const depth = Math.min(1, Math.max(0, spec.depth));
  const fore = polyPath(w.fore), hind = polyPath(w.hind), both = new Path2D();
  both.addPath(hind);
  both.addPath(fore);
  if (!spec.bare) {
    ctx.save();
    ctx.shadowColor = 'rgba(40,24,10,.28)';
    ctx.shadowBlur = px * 0.05;
    ctx.shadowOffsetY = px * 0.015;
    ctx.fillStyle = rgba(isHex(look.hind) ? look.hind : '#888888', 1);
    ctx.fill(both);
    ctx.restore();
  }
  const pts = mapPath(w, spec.path, spec.box);
  for (const part of ['hind', 'fore'] as const) {
    const path = part === 'fore' ? fore : hind, ground0 = part === 'fore' ? look.fore : look.hind;
    const ground = mix(ground0, '#F6F0E1', 0.22 * (1 - depth));
    ctx.save();
    ctx.clip(path);
    const g = ctx.createRadialGradient(w.ox, w.oy, 0.02, w.ox, w.oy, 1.15);
    g.addColorStop(0, darken(ground, 0.16));
    g.addColorStop(0.55, ground);
    g.addColorStop(1, lighten(ground, 0.08));
    ctx.fillStyle = g;
    ctx.fillRect(-0.1, w.minY - 0.1, 1.3, w.maxY - w.minY + 0.2);
    // watercolour bloom where the colours are still pale
    if (depth < 0.7) {
      for (let i = 0; i < 9; i++) {
        const x = 0.2 + hash(sp.id.length * 7 + i * 3) * 0.7, y = w.minY + hash(i * 5 + 1) * (w.maxY - w.minY), r = 0.08 + hash(i * 11) * 0.16;
        const b = ctx.createRadialGradient(x, y, 0, x, y, r);
        b.addColorStop(0, `rgba(255,252,240,${0.16 * (1 - depth)})`);
        b.addColorStop(1, 'rgba(255,252,240,0)');
        ctx.fillStyle = b;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
    // the eaten path: dark crisp edge, then three bands, then the silk
    if (pts.length > 1) {
      const [a, b2, cc] = bandColours(sp, spec.pigments, depth, ground);
      const edge = spec.bold ? 0.022 : 0.012;
      strokeBand(ctx, pts, 1, edge, `rgba(30,20,12,${(0.32 + 0.3 * depth + (spec.bold ? 0.18 : 0)).toFixed(2)})`);
      ctx.globalAlpha = 0.8 + 0.2 * depth;
      strokeBand(ctx, pts, 1, 0, a);
      strokeBand(ctx, pts, 0.6, 0, b2);
      strokeBand(ctx, pts, 0.24, 0, cc);
      ctx.globalAlpha = 1;
      if (pts.some(p => p.silk)) {
        strokeBand(ctx, pts, 0.3, 0.012, 'rgba(255,246,214,.9)', p => p.silk);
        strokeBand(ctx, pts, 0.1, 0.004, 'rgba(255,255,255,.95)', p => p.silk);
      }
    }
    drawMarks(ctx, w, look.marks, depth);
    const dust = ctx.createRadialGradient(w.ox, w.oy, 0, w.ox, w.oy, 0.42);
    dust.addColorStop(0, sp.dust);
    dust.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dust;
    ctx.fillRect(-0.1, -0.5, 0.6, 1);
    drawVeins(ctx, w, spec.bold ? darken(isHex(look.fore) ? look.fore : '#555555', 0.7) : sp.vein, spec.bold);
    // light from the upper left, a faint sheen of scales
    const sheen = ctx.createLinearGradient(0, w.minY, 0.8, w.maxY);
    sheen.addColorStop(0, 'rgba(255,255,255,.12)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-0.1, w.minY - 0.1, 1.3, w.maxY - w.minY + 0.2);
    ctx.restore();
  }
  // the forewing's edge over the hindwing
  ctx.strokeStyle = 'rgba(20,12,6,.32)';
  ctx.lineWidth = 0.006;
  ctx.stroke(fore);
  ctx.stroke(hind);
  if (!spec.bare) {
    const fl = isHex(sp.fringe) ? sp.fringe : '#eeeeee';
    // outward normals: flip for clockwise outlines
    const fo = signedArea(w.fore) > 0 ? w.fore : [...w.fore].reverse(), ho = signedArea(w.hind) > 0 ? w.hind : [...w.hind].reverse();
    fringe(ctx, fo.filter((_, i) => i % 2 === 0), rgba(fl, 0.9), rgba(darken(fl, 0.3), 0.7));
    fringe(ctx, ho.filter((_, i) => i % 2 === 0), rgba(fl, 0.9), rgba(darken(fl, 0.3), 0.7));
  }
  if (spec.aberration === 'albino' || spec.aberration === 'melanic' || spec.radiant) {
    ctx.save();
    ctx.clip(both);
    if (spec.aberration === 'albino') {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'rgba(128,128,128,.85)';
      ctx.fillRect(-0.1, w.minY - 0.1, 1.3, w.maxY - w.minY + 0.2);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(246,238,220,.6)';
      ctx.fillRect(-0.1, w.minY - 0.1, 1.3, w.maxY - w.minY + 0.2);
    } else if (spec.aberration === 'melanic') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(58,40,32,.78)';
      ctx.fillRect(-0.1, w.minY - 0.1, 1.3, w.maxY - w.minY + 0.2);
    }
    if (spec.radiant) {
      // an iridescent sheen in thin diagonal bands, and glints along the wings
      ctx.globalCompositeOperation = 'soft-light';
      const ir = ctx.createLinearGradient(0, w.minY, 1, w.maxY);
      const hues = ['rgba(110,235,230,.7)', 'rgba(200,150,255,.6)', 'rgba(255,215,130,.7)'];
      for (let i = 0; i <= 9; i++) ir.addColorStop(i / 9, hues[i % 3]);
      ctx.fillStyle = ir;
      ctx.fillRect(-0.1, w.minY - 0.1, 1.3, w.maxY - w.minY + 0.2);
      ctx.globalCompositeOperation = 'lighter';
      const q = { x: 0, y: 0 };
      wingPoint(w, 0.24, 0.8, q);
      const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.45);
      glow.addColorStop(0, 'rgba(255,250,230,.2)');
      glow.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(q.x - 0.5, q.y - 0.5, 1, 1);
      ctx.fillStyle = 'rgba(255,255,245,.85)';
      for (let i = 0; i < 26; i++) {
        wingPoint(w, hash(i * 3 + 1), 0.3 + 0.65 * hash(i * 5 + 2), q);
        const r = 0.004 + 0.006 * hash(i * 7);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - r * 3);
        ctx.lineTo(q.x + r, q.y);
        ctx.lineTo(q.x, q.y + r * 3);
        ctx.lineTo(q.x - r, q.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
  return { canvas: c, ox, oy, scale: px };
}

/** Both halves of a butterfly: the right, and the left (its mirror, or the female look). */
export interface ButterflySprite { right: WingBitmap; left: WingBitmap | null; species: Species }

export function paintButterfly(spec: WingSpec, px: number): ButterflySprite {
  const right = paintWing({ ...spec, female: false }, px);
  const left = spec.aberration === 'gyn' ? paintWing({ ...spec, female: true, pigments: [...spec.pigments].reverse() }, px) : null;
  return { right, left, species: spec.species };
}

/** The wing spec of a stored butterfly: the same picture every time. */
export function specOfRecord(rec: ButterflyRec): WingSpec {
  const species = speciesById(rec.sp);
  const aberration: Aberration | null = rec.f & F.GYN ? 'gyn' : rec.f & F.ALBINO ? 'albino' : rec.f & F.MELANIC ? 'melanic' : null;
  return {
    species, path: decodePath(rec.path), box: buildLeaf(species.plant).box, pigments: rec.pig, depth: rec.b / 100,
    bold: (rec.f & F.BOLD) !== 0, radiant: (rec.f & F.RADIANT) !== 0, aberration, female: false,
  };
}

const recordSprites = new Map<string, ButterflySprite>();

/** A stored butterfly's sprite at `px` per half-wingspan, cached (at most 90 kept). */
export function spriteOfRecord(rec: ButterflyRec, px: number): ButterflySprite {
  const key = `${rec.id}:${rec.sp}:${Math.round(px)}`;
  return recordSprites.get(key) ?? remember(recordSprites, key, paintButterfly(specOfRecord(rec), px), 90);
}

/**
 * A butterfly at (x, y) with half-wingspan `size` px: `open` 1 = flat, 0 = folded up; `rot` tilts it.
 * Head up in its own frame; the body sits on the wings' root.
 */
export function drawButterfly(ctx: CanvasRenderingContext2D, b: ButterflySprite, x: number, y: number, size: number, open: number, rot = 0, alpha = 1): void {
  const s = size / b.right.scale, o = Math.max(0.06, open);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.save();
  ctx.scale(s * o, s);
  ctx.drawImage(b.right.canvas, -b.right.ox, -b.right.oy);
  ctx.restore();
  const left = b.left ?? b.right;
  ctx.save();
  ctx.scale(-s * o, s);
  ctx.drawImage(left.canvas, -left.ox, -left.oy);
  ctx.restore();
  drawBody(ctx, b.species, size);
  ctx.restore();
}

/** A species' body colours and its shading across the body (a gradient from x = −1 to 1, per context). */
interface BodyInk { fill: CanvasGradient; stroke: string; knob: string; fat: number }
const bodyInks = new WeakMap<CanvasRenderingContext2D, Map<string, BodyInk>>();

function bodyInk(ctx: CanvasRenderingContext2D, sp: Species): BodyInk {
  let inks = bodyInks.get(ctx);
  if (!inks) bodyInks.set(ctx, (inks = new Map()));
  let ink = inks.get(sp.id);
  if (!ink) {
    const fill = ctx.createLinearGradient(-1, 0, 1, 0);
    fill.addColorStop(0, darken(sp.body, 0.2));
    fill.addColorStop(0.45, lighten(sp.body, 0.22));
    fill.addColorStop(1, darken(sp.body, 0.3));
    const fat = sp.family === 'hawk' || sp.family === 'burnet' ? 1.45 : sp.family === 'skipper' ? 1.25 : 1;
    ink = { fill, stroke: darken(sp.body, 0.2), knob: darken(sp.body, 0.1), fat };
    inks.set(sp.id, ink);
  }
  return ink;
}

export function drawBody(ctx: CanvasRenderingContext2D, sp: Species, size: number): void {
  const ink = bodyInk(ctx, sp), fat = ink.fat;
  // abdomen, thorax and head in one path; the shading is scaled to the body's width at fill time
  // (a path is fixed when it is built, a fill's gradient follows the transform when it is used)
  ctx.beginPath();
  ctx.moveTo(size * 0.04 * fat, size * 0.22);
  ctx.ellipse(0, size * 0.22, size * 0.04 * fat, size * 0.3, 0, 0, TAU);
  ctx.moveTo(size * 0.06 * fat, -size * 0.03);
  ctx.ellipse(0, -size * 0.03, size * 0.06 * fat, size * 0.1, 0, 0, TAU);
  ctx.moveTo(size * 0.045 * fat, -size * 0.15);
  ctx.arc(0, -size * 0.15, size * 0.045 * fat, 0, TAU);
  ctx.save();
  ctx.scale(size * 0.05, 1);
  ctx.fillStyle = ink.fill;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = ink.stroke;
  ctx.lineWidth = Math.max(0.7, size * 0.012);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let s = -1; s <= 1; s += 2) {
    ctx.moveTo(s * size * 0.02, -size * 0.18);
    ctx.quadraticCurveTo(s * size * 0.08, -size * 0.42, s * size * 0.2, -size * 0.58);
  }
  ctx.stroke();
  const knob = Math.max(0.8, size * 0.022);
  ctx.fillStyle = ink.knob;
  ctx.beginPath();
  for (let s = -1; s <= 1; s += 2) {
    ctx.moveTo(s * size * 0.2 + knob, -size * 0.58);
    ctx.arc(s * size * 0.2, -size * 0.58, knob, 0, TAU);
  }
  ctx.fill();
}

/** The species' wing outline, filled flat: for undiscovered atlas entries and egg cards. */
export function drawSilhouette(ctx: CanvasRenderingContext2D, sp: Species, x: number, y: number, size: number, fill: string): void {
  const w = wingShape(sp.family);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  for (const side of [1, -1]) {
    ctx.save();
    ctx.scale(side * size, size);
    ctx.fill(polyPath(w.hind));
    ctx.fill(polyPath(w.fore));
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, size * 0.2, size * 0.045, size * 0.32, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Vertical centre of the wings in their own frame (for centring a butterfly). */
export const wingMidY = (sp: Species): number => {
  const w = wingShape(sp.family);
  return (w.minY + w.maxY) / 2;
};

// ── the chrysalis ────────────────────────────────────────────────
/** The pupa's outline hanging from (0, 0) and `len` long (head down), or girdled (head up, leaning). */
export function pupaPath(kind: 'hanging' | 'girdled', len: number): Path2D {
  const p = new Path2D(), w = len * 0.2;
  if (kind === 'hanging') {
    p.moveTo(0, 0);
    p.bezierCurveTo(w * 0.5, len * 0.05, w * 1.25, len * 0.22, w * 1.18, len * 0.45);
    p.lineTo(w * 1.32, len * 0.52);
    p.bezierCurveTo(w * 1.1, len * 0.7, w * 0.8, len * 0.86, w * 0.55, len * 0.94);
    p.lineTo(w * 0.42, len * 1.02);
    p.lineTo(w * 0.1, len * 0.97);
    p.lineTo(-w * 0.1, len * 0.97);
    p.lineTo(-w * 0.42, len * 1.02);
    p.lineTo(-w * 0.55, len * 0.94);
    p.bezierCurveTo(-w * 0.8, len * 0.86, -w * 1.1, len * 0.7, -w * 1.32, len * 0.52);
    p.lineTo(-w * 1.18, len * 0.45);
    p.bezierCurveTo(-w * 1.25, len * 0.22, -w * 0.5, len * 0.05, 0, 0);
  } else {
    p.moveTo(0, 0);
    p.bezierCurveTo(w * 0.7, -len * 0.06, w * 1.35, -len * 0.3, w * 1.2, -len * 0.55);
    p.bezierCurveTo(w * 1.05, -len * 0.78, w * 0.4, -len * 0.92, 0, -len * 1.02);
    p.bezierCurveTo(-w * 0.4, -len * 0.92, -w * 1.05, -len * 0.78, -w * 1.2, -len * 0.55);
    p.bezierCurveTo(-w * 1.35, -len * 0.3, -w * 0.7, -len * 0.06, 0, 0);
  }
  return p;
}

export interface ChrysalisLook {
  kind: 'hanging' | 'girdled';
  color: string;
  accent: string;
  /** 0 opaque … 1 clear */
  glass: number;
  depth: number;
  blind: boolean;
  /** the wing inside, pale and deep */
  pale: WingBitmap | null;
  deep: WingBitmap | null;
  /** golden-hour light */
  warm: number;
}

const pupaPaths = new Map<string, Path2D>();
const pupaPathOf = (kind: 'hanging' | 'girdled', len: number): Path2D => {
  const key = `${kind}|${len.toFixed(1)}`;
  return pupaPaths.get(key) ?? remember(pupaPaths, key, pupaPath(kind, len), 8);
};

/**
 * A pupa's picture in three layers, in its own frame (attached at the origin), at `px` device px per
 * unit: the body with its shadow (under the wing), the shell's sheen (over the wing, as clear as the
 * calm makes it), and its details (rings, spots, light, outline, silk).  Painted once per look and size.
 */
interface PupaLayers { base: HTMLCanvasElement; shell: HTMLCanvasElement; detail: HTMLCanvasElement; ox: number; oy: number; px: number }
const pupaLayers = new Map<string, PupaLayers>();
/** a pupa's frame in its sprites: from −0.5 to 0.5 of its length across, 1.5 lengths along (it lies down or up) */
const PUPA_W = 1, PUPA_H = 1.5;

function layersOf(look: ChrysalisLook, len: number, px: number): PupaLayers {
  const key = `${look.kind}|${look.color}|${look.accent}|${look.warm}|${Math.round(len * px)}`;
  let L = pupaLayers.get(key);
  if (L) return L;
  const dir = look.kind === 'hanging' ? 1 : -1, path = pupaPathOf(look.kind, len);
  const ox = len * PUPA_W * 0.5, oy = dir > 0 ? len * 0.25 : len * 1.25;
  const layer = (paint: (x: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
    const c = canvas(len * PUPA_W * px, len * PUPA_H * px), x = ctx2d(c);
    x.scale(px, px);
    x.translate(ox, oy);
    paint(x);
    return c;
  };
  const base = layer(x => {
    x.shadowColor = 'rgba(50,30,10,.3)';
    x.shadowBlur = len * 0.06 * px;
    x.shadowOffsetX = len * 0.03 * px;
    x.fillStyle = look.color;
    x.fill(path);
  });
  const shell = layer(x => {
    x.clip(path);
    const g = x.createLinearGradient(-len * 0.3, 0, len * 0.3, 0);
    g.addColorStop(0, darken(look.color, 0.25));
    g.addColorStop(0.42, lighten(look.color, 0.25));
    g.addColorStop(1, darken(look.color, 0.35));
    x.fillStyle = g;
    x.fillRect(-len, -len * 1.2, len * 2, len * 2.4);
  });
  const detail = layer(x => {
    x.save();
    x.clip(path);
    // abdominal rings at the cremaster end, the wing case's edge, gold spots, a highlight
    x.strokeStyle = rgba(darken(look.color, 0.45), 0.45);
    x.lineWidth = Math.max(0.8, len * 0.01);
    x.beginPath();
    for (let i = 0; i < 4; i++) {
      const k = 0.1 + i * 0.075, half = len * (0.08 + 0.1 * (i + 1) / 4);
      x.moveTo(-half, dir * len * k);
      x.quadraticCurveTo(0, dir * len * (k + 0.03), half, dir * len * k);
    }
    x.moveTo(-len * 0.2, dir * len * 0.42);
    x.bezierCurveTo(-len * 0.05, dir * len * 0.5, len * 0.02, dir * len * 0.72, -len * 0.04, dir * len * 0.92);
    x.stroke();
    x.fillStyle = look.accent;
    x.beginPath();
    for (let i = 0; i < 4; i++) {
      const k = 0.3 + i * 0.13, cx = (i % 2 ? -1 : 1) * len * 0.11;
      x.moveTo(cx + len * 0.02, dir * len * k);
      x.arc(cx, dir * len * k, len * 0.02, 0, TAU);
    }
    x.fill();
    x.fillStyle = `rgba(255,250,230,${0.28 + 0.2 * look.warm})`;
    x.beginPath();
    x.ellipse(len * 0.09, dir * len * 0.5, len * 0.035, len * 0.2, -0.1 * dir, 0, TAU);
    x.fill();
    x.restore();
    x.strokeStyle = rgba(darken(look.color, 0.5), 0.55);
    x.lineWidth = Math.max(0.8, len * 0.014);
    x.stroke(path);
    // silk: the pad it hangs from, or the girdle that ties it to the stem
    x.strokeStyle = 'rgba(255,250,236,.9)';
    x.lineWidth = Math.max(1, len * 0.012);
    x.lineCap = 'round';
    x.beginPath();
    if (look.kind === 'hanging') {
      // the silk pad: a little tuft of threads on the twig
      for (let i = -2; i <= 2; i++) {
        x.moveTo(i * len * 0.018, -len * 0.035);
        x.lineTo(i * len * 0.008, len * 0.012);
      }
    } else {
      const gy = -len * 0.62;
      x.strokeStyle = 'rgba(255,250,236,.7)';
      x.lineWidth = Math.max(0.8, len * 0.008);
      x.moveTo(-len * 0.34, gy + len * 0.01);
      x.quadraticCurveTo(-len * 0.12, gy + len * 0.04, len * 0.05, gy + len * 0.035);
      x.moveTo(-len * 0.06, -len * 0.01);
      x.lineTo(-len * 0.12, len * 0.02);
    }
    x.stroke();
  });
  L = remember(pupaLayers, key, { base, shell, detail, ox, oy, px }, 6);
  return L;
}

const cocoons = new Map<string, { c: HTMLCanvasElement; ox: number; oy: number }>();

/** The blind round's silk cocoon as a sprite in the pupa's frame (its strands barely stir, so still). */
function cocoonSprite(kind: 'hanging' | 'girdled', len: number, px: number): { c: HTMLCanvasElement; ox: number; oy: number } {
  const key = `${kind}|${Math.round(len * px)}`;
  let s = cocoons.get(key);
  if (!s) {
    const ox = len * PUPA_W * 0.5, oy = kind === 'hanging' ? len * 0.25 : len * 1.25;
    const c = canvas(len * PUPA_W * px, len * PUPA_H * px), x = ctx2d(c);
    x.scale(px, px);
    x.translate(ox, oy);
    drawCocoon(x, len, kind, 0);
    s = remember(cocoons, key, { c, ox, oy }, 4);
  }
  return s;
}

/**
 * A chrysalis at its attachment point (x, y), `len` px long (`px` device px each), swaying by `sway`
 * radians, faded by the context's alpha.  The folded wing shows through as the shell clears.
 */
export function drawChrysalis(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, look: ChrysalisLook, sway: number, px = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  if (look.blind) {
    const s = cocoonSprite(look.kind, len, px);
    ctx.drawImage(s.c, -s.ox, -s.oy, s.c.width / px, s.c.height / px);
    ctx.restore();
    return;
  }
  const L = layersOf(look, len, px), w = L.base.width / px, h = L.base.height / px, alpha = ctx.globalAlpha;
  ctx.drawImage(L.base, -L.ox, -L.oy, w, h);
  // the wing showing through: folded in the wing case, its root at the thorax, the tip toward the cremaster
  const show = Math.min(1, Math.max(0, look.glass)), dir = look.kind === 'hanging' ? 1 : -1;
  if (look.pale && show > 0.02) {
    ctx.save();
    ctx.clip(pupaPathOf(look.kind, len));
    ctx.translate(-len * 0.1, dir * len * 0.78);
    ctx.rotate(dir > 0 ? -Math.PI / 2 - 0.25 : Math.PI / 2 + 0.25);
    const s = (len * 0.5) / look.pale.scale;
    ctx.scale(s, s * 0.72);
    ctx.globalAlpha = alpha * show * 0.8;
    ctx.drawImage(look.pale.canvas, -look.pale.ox, -look.pale.oy);
    if (look.deep && look.depth > 0.01) {
      ctx.globalAlpha = alpha * show * 0.8 * look.depth;
      ctx.drawImage(look.deep.canvas, -look.deep.ox, -look.deep.oy);
    }
    ctx.restore();
  }
  // the shell over it, then its details
  ctx.globalAlpha = alpha * (1 - 0.78 * show);
  ctx.drawImage(L.shell, -L.ox, -L.oy, w, h);
  ctx.globalAlpha = alpha;
  ctx.drawImage(L.detail, -L.ox, -L.oy, w, h);
  ctx.restore();
}

/**
 * An opaque silk cocoon (a blind round: nothing shows through), in the pupa's own frame and place:
 * hanging down from its silk pad, or — for a girdled species — lying up along the stem from (0, 0),
 * tied to it by a silk girdle and a few strands.
 */
export function drawCocoon(ctx: CanvasRenderingContext2D, len: number, kind: 'hanging' | 'girdled', t: number): void {
  const girdled = kind === 'girdled', dir = girdled ? -1 : 1;
  // a girdled cocoon sits a little off the stem (the stem runs at x ≈ −0.16·len in this frame)
  const w = len * (girdled ? 0.26 : 0.3), cx = girdled ? len * 0.03 : 0, cy = dir * len * 0.52, ry = len * 0.5;
  if (girdled) {
    // strands to the stem behind it, above and below
    ctx.strokeStyle = 'rgba(255,250,236,.7)';
    ctx.lineWidth = Math.max(0.7, len * 0.006);
    ctx.beginPath();
    for (const [y0, y1] of [[-0.06, 0.04], [-0.12, -0.02], [-0.95, -1.08], [-0.9, -1.12]] as const) {
      ctx.moveTo(cx - w * 0.3, len * y0);
      ctx.quadraticCurveTo(-len * 0.12, len * (y0 + y1) / 2, -len * 0.17, len * y1);
    }
    ctx.stroke();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(50,30,10,.28)';
  ctx.shadowBlur = len * 0.12;
  ctx.shadowOffsetX = len * 0.05;
  const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
  g.addColorStop(0, '#D8D0BE');
  g.addColorStop(0.45, '#FBF7EC');
  g.addColorStop(1, '#CFC6B2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // loose silk wound around it
  ctx.strokeStyle = 'rgba(255,255,250,.6)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 40; i++) {
    const y = cy + dir * len * (-0.44 + 0.88 * hash(i * 3)), a = hash(i * 7) * 1.4 - 0.7 + Math.sin(t * 0.3 + i) * 0.02;
    const half = w * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
    ctx.beginPath();
    ctx.moveTo(cx - half, y - Math.tan(a) * half);
    ctx.quadraticCurveTo(cx, y + 3, cx + half, y + Math.tan(a) * half);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,250,236,.85)';
  ctx.lineCap = 'round';
  if (girdled) {
    // the girdle: a band of silk across its front, round to the stem
    const gy = -len * 0.64;
    ctx.lineWidth = Math.max(1, len * 0.014);
    ctx.beginPath();
    ctx.moveTo(-len * 0.19, gy - len * 0.03);
    ctx.quadraticCurveTo(cx, gy + len * 0.07, cx + w * 0.98, gy - len * 0.01);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214,204,182,.7)';
    ctx.lineWidth = Math.max(0.7, len * 0.006);
    ctx.beginPath();
    ctx.moveTo(-len * 0.19, gy + len * 0.01);
    ctx.quadraticCurveTo(cx, gy + len * 0.11, cx + w * 0.96, gy + len * 0.03);
    ctx.stroke();
  } else {
    // the thread it hangs by
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, len * 0.06);
    ctx.stroke();
  }
}
