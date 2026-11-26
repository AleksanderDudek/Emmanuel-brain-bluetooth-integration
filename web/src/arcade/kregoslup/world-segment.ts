/**
 * Three lumbar vertebrae and the two discs between them, cut lengthwise and seen from the side, under the lens
 * (DESIGN.md §24.5).  Units: millimetres; the front of the body to the left (−x), down is +y.  L3, L4 and L5 are
 * pearl bone with a lattice of trabeculae and a bright cortical rim; each disc has its annulus in layers front and
 * back, the nucleus of gel in the middle, and a cartilage end plate (< 1 mm) above and below; the capillaries of the
 * vertebral bodies end in small loops just behind the bony end plate — the nearest blood the disc has.  Behind the
 * bodies: the canal with the nerve roots and the arches.
 *
 *   plytki   the end plates light, the capillary loops fill one by one, a few motes pass through
 *   dzien    the day: the body's weight from above, the nucleus spreads it evenly, drops of water slowly leave
 *   noc      the night (variant): no load, water drawn back into the nucleus, the disc swells a little
 *   pompa    walking (variant): load and unload in the rhythm of steps, water out and in
 *   dyfuzja  glucose and oxygen diffuse from the loops through the end plate to the cells, lactic acid back
 */
import { AQUA, BLOOD, BLOOD_HI, GOLD, GOLD_HI, PEARL, VIOLET, glow, glowEllipse, rgba } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { BONE, WATER, WATER_HI } from './bones';
import { clamp, hash, smooth, type Pt, type Rect } from './geo';
import { counterText, mpaText } from './i18n';
import { hair } from './world-spine';

// ── the shapes (mm) ───────────────────────────────────────────────
const FRONT = -35, BACK = 0;
/** each body: its top and bottom edges at the rim (the end plates dip 1 mm toward the body at the middle) */
const BODIES = [{ id: 'L3', top: -50, bot: -23 }, { id: 'L4', top: -14, bot: 14 }, { id: 'L5', top: 23, bot: 50 }] as const;
/** each disc: its top and bottom at the rim */
const DISCS = [{ top: -23, bot: -14 }, { top: 14, bot: 23 }] as const;
const DIP = 1.0;
const NUC = { x: -15, rx: 8.5, ry: 3.4 };
const CART = 0.7;

/** The end plate's surface at x (its dip toward the body in the middle): y = rim ± dip. */
const dipAt = (x: number): number => {
  const k = (x - FRONT) / (BACK - FRONT);
  return DIP * Math.sin(Math.PI * clamp(k)) ** 1.4;
};

/** A named point of the picture (for the labels and the gauge). */
export function segPt(name: string): Pt {
  const D = DISCS[1], cy = (D.top + D.bot) / 2;
  switch (name) {
    case 'plateUp': return [-21, D.top + 0.2];
    case 'plateLow': return [-21, D.bot - 0.2];
    case 'capLow': return [-9, D.bot + 1.6];
    case 'bodyL5': return [-29, 29.5];
    case 'discMid': return [-27, cy];
    case 'nucleus': return [NUC.x, cy];
    case 'load': return [-14, 4];
    case 'annulusFront': return [-33.5, cy];
    case 'waterIn': return [-33, cy - 2];
    case 'flow': return [-34, cy];
    case 'cellsDeep': return [NUC.x - 1, cy];
    case 'glucose': return [-8.5, D.bot - 1.6];
    case 'oxygen': return [-25, D.bot - 1.4];
    case 'lactate': return [-11, D.top + 2.2];
    default: return [NUC.x, cy];
  }
}

export const SEG_VIEW: Rect = { x: -57, y: -53, w: 74, h: 106 };
export const SEG_DAY_VIEW: Rect = { x: -47, y: -5, w: 62, h: 46 };
export const SEG_PLATE_VIEW: Rect = { x: -41, y: 6, w: 46, h: 26 };
export const SEG_DIFF_VIEW: Rect = { x: -36, y: 9.5, w: 36, h: 20 };

function bodyPath(b: { top: number; bot: number }): Path2D {
  const p = new Path2D();
  const r = 2.2;
  p.moveTo(FRONT + r, b.top);
  for (let x = FRONT + r; x <= BACK - r; x += 1) p.lineTo(x, b.top + dipAt(x));
  p.quadraticCurveTo(BACK, b.top, BACK, b.top + r);
  p.lineTo(BACK, b.bot - r);
  p.quadraticCurveTo(BACK, b.bot, BACK - r, b.bot);
  for (let x = BACK - r; x >= FRONT + r; x -= 1) p.lineTo(x, b.bot - dipAt(x));
  p.quadraticCurveTo(FRONT, b.bot, FRONT, b.bot - r);
  // the front is a little waisted
  p.quadraticCurveTo(FRONT + 1.6, (b.top + b.bot) / 2, FRONT, b.top + r);
  p.quadraticCurveTo(FRONT, b.top, FRONT + r, b.top);
  p.closePath();
  return p;
}

/** A disc between two end plates, swollen by `sw` mm at each plate (± a little with the day and the night). */
function discPath(d: { top: number; bot: number }, sw: number, bulge: number): Path2D {
  const p = new Path2D();
  const t = d.top - sw, b = d.bot + sw, cy = (t + b) / 2;
  p.moveTo(FRONT + 0.2, t);
  for (let x = FRONT + 0.2; x <= BACK - 0.2; x += 1) p.lineTo(x, t - dipAt(x));
  p.lineTo(BACK - 0.2, t);
  p.quadraticCurveTo(BACK + 0.6 + bulge * 0.6, cy, BACK - 0.2, b);
  for (let x = BACK - 0.2; x >= FRONT + 0.2; x -= 1) p.lineTo(x, b + dipAt(x));
  p.lineTo(FRONT + 0.2, b);
  p.quadraticCurveTo(FRONT - 0.9 - bulge, cy, FRONT + 0.2, t);
  p.closePath();
  return p;
}

/** The capillary loops behind one bony end plate: x positions (over the nucleus and the inner annulus). */
const LOOPS: readonly number[] = Array.from({ length: 16 }, (_, i) => -29 + i * 1.6 + (hash(i * 3 + 7) - 0.5) * 0.5);

/** One loop: down from the bone toward the plate and back (dir +1 points down, toward a disc below). */
function loopPath(x: number, yPlate: number, dir: 1 | -1): Path2D {
  const p = new Path2D();
  const base = yPlate - dir * 2.2, tip = yPlate - dir * 0.35;
  p.moveTo(x - 0.35, base);
  p.lineTo(x - 0.35, tip - dir * 0.3);
  p.quadraticCurveTo(x, tip + dir * 0.25, x + 0.35, tip - dir * 0.3);
  p.lineTo(x + 0.35, base);
  return p;
}

// ── the still picture ─────────────────────────────────────────────
function bakeBone(ctx: CanvasRenderingContext2D, b: { top: number; bot: number }, night: boolean): void {
  const P = bodyPath(b);
  const g = ctx.createLinearGradient(FRONT, b.top, BACK, b.bot);
  g.addColorStop(0, rgba(night ? '#cdd4ff' : '#f3e6ff', 0.2));
  g.addColorStop(1, rgba(night ? '#a9b4ff' : '#d9c4f4', 0.14));
  ctx.fillStyle = g;
  ctx.fill(P);
  ctx.save();
  ctx.clip(P);
  // the trabeculae: a lattice of struts, mostly upright (they carry the load), tied across, the marrow between
  const sp = 2.3;
  const cols = Math.ceil((BACK - FRONT) / sp) + 1, rows = Math.ceil((b.bot - b.top) / sp) + 1;
  const pt = (c: number, r: number): Pt => [FRONT + c * sp + (hash(c * 31 + r * 17 + b.top) - 0.5) * 1.5, b.top + r * sp + (hash(c * 13 + r * 29 + b.bot) - 0.5) * 1.3];
  ctx.lineCap = 'round';
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const p0 = pt(c, r);
      const h1 = hash(c * 7 + r * 11 + b.top * 3), h2 = hash(c * 5 + r * 19 + b.bot * 3);
      if (h1 < 0.86 && r + 1 < rows) {
        const q = pt(c, r + 1);
        ctx.strokeStyle = rgba(BONE, 0.14 + 0.1 * h2);
        ctx.lineWidth = 0.32 + 0.25 * h2;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo((p0[0] + q[0]) / 2 + (h1 - 0.5) * 0.8, (p0[1] + q[1]) / 2, q[0], q[1]);
        ctx.stroke();
      }
      if (h2 < 0.55 && c + 1 < cols) {
        const q = pt(c + 1, r);
        ctx.strokeStyle = rgba(BONE, 0.1 + 0.08 * h1);
        ctx.lineWidth = 0.22 + 0.15 * h1;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
      }
    }
  }
  // the light inside the bone (it is living tissue, its marrow warm)
  glow(ctx, night ? '#8f9cff' : '#ffb7a8', -17, (b.top + b.bot) / 2, 16, 0.12);
  ctx.restore();
  // the cortical rim and the bony end plates
  ctx.strokeStyle = rgba(BONE, 0.72);
  ctx.lineWidth = hair(ctx, 1.4);
  ctx.stroke(P);
  ctx.strokeStyle = rgba(PEARL, 0.12);
  ctx.lineWidth = 1.3;
  ctx.stroke(P);
}

function bakeLoops(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.lineWidth = 0.24;
  ctx.strokeStyle = rgba(BLOOD, 0.32 * a);
  for (const d of DISCS) {
    for (const x of LOOPS) {
      ctx.stroke(loopPath(x, d.top - dipAt(x), 1));
      ctx.stroke(loopPath(x, d.bot + dipAt(x), -1));
    }
  }
}

/** The canal behind the bodies, the nerve roots in it, and the arches behind. */
function bakeBack(ctx: CanvasRenderingContext2D): void {
  // the posterior longitudinal ligament and the canal
  ctx.fillStyle = 'rgba(40,18,70,.55)';
  ctx.fillRect(BACK + 0.8, -62, 15, 124);
  const cg = ctx.createLinearGradient(BACK, 0, BACK + 16, 0);
  cg.addColorStop(0, 'rgba(160,120,255,.08)');
  cg.addColorStop(0.5, 'rgba(255,220,170,.05)');
  cg.addColorStop(1, 'rgba(160,120,255,.08)');
  ctx.fillStyle = cg;
  ctx.fillRect(BACK + 0.8, -62, 15, 124);
  ctx.strokeStyle = rgba('#d9c8ff', 0.4);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(BACK + 0.4, -62);
  ctx.lineTo(BACK + 0.4, 62);
  ctx.moveTo(FRONT - 0.6, -62);
  ctx.lineTo(FRONT - 0.6, 62);
  ctx.stroke();
  // the nerve roots of the cauda equina, pale gold threads
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 9; i++) {
    const x = BACK + 3 + i * 1.3;
    ctx.strokeStyle = rgba('#ffe3b0', 0.14 + 0.08 * hash(i * 3));
    ctx.beginPath();
    ctx.moveTo(x, -62);
    for (let y = -62; y <= 62; y += 6) ctx.lineTo(x + Math.sin(y * 0.08 + i) * 0.5, y);
    ctx.stroke();
  }
  // the arches: lamina and spinous process of each vertebra, the ligamentum flavum between them
  for (const b of BODIES) {
    const cy = (b.top + b.bot) / 2;
    const p = new Path2D();
    p.moveTo(BACK + 16, cy - 11);
    p.quadraticCurveTo(BACK + 22, cy - 12, BACK + 30, cy - 9);
    p.lineTo(BACK + 52, cy - 8);
    p.quadraticCurveTo(BACK + 56, cy - 2, BACK + 52, cy + 6);
    p.lineTo(BACK + 30, cy + 7);
    p.quadraticCurveTo(BACK + 22, cy + 9, BACK + 16, cy + 6);
    p.closePath();
    ctx.fillStyle = rgba(BONE, 0.1);
    ctx.fill(p);
    ctx.strokeStyle = rgba(BONE, 0.42);
    ctx.lineWidth = hair(ctx, 1.1);
    ctx.stroke(p);
  }
  ctx.fillStyle = rgba('#ffd98a', 0.09);
  for (const d of DISCS) ctx.fillRect(BACK + 16, d.top - 4, 3, d.bot - d.top + 8);
}

function bakeDiscGhost(ctx: CanvasRenderingContext2D, night: boolean): void {
  for (const d of DISCS) {
    const P = discPath(d, 0, 0);
    ctx.fillStyle = rgba(night ? '#8fb6ff' : '#cfe8ff', 0.1);
    ctx.fill(P);
    ctx.strokeStyle = rgba(WATER, 0.35);
    ctx.lineWidth = hair(ctx, 1);
    ctx.stroke(P);
    lamellae(ctx, d, 0, 0.3, 0);
  }
}

/** The annulus's layers seen in section: arcs from plate to plate, bulging outward, front and back. */
function lamellae(ctx: CanvasRenderingContext2D, d: { top: number; bot: number }, sw: number, a: number, bulge: number): void {
  const t = d.top - sw, b = d.bot + sw, cy = (t + b) / 2;
  ctx.lineWidth = 0.22;
  for (let i = 0; i < 9; i++) {
    const k = i / 8;
    const xf = FRONT + 0.6 + i * 1.25, xb = BACK - 0.6 - i * 0.85;
    const bf = (1 - k) * (1.1 + bulge), bb = (1 - k) * (0.8 + bulge * 0.6);
    ctx.strokeStyle = rgba(i % 2 ? '#d8f6ff' : '#c9c2ff', a * (0.6 + 0.4 * (1 - k)));
    ctx.beginPath();
    ctx.moveTo(xf, t - dipAt(xf) * 0.8);
    ctx.quadraticCurveTo(xf - bf, cy, xf, b + dipAt(xf) * 0.8);
    ctx.moveTo(xb, t - dipAt(xb) * 0.8);
    ctx.quadraticCurveTo(xb + bb, cy, xb, b + dipAt(xb) * 0.8);
    ctx.stroke();
  }
}

// ── what lives ────────────────────────────────────────────────────
interface DiscLook { sw: number; fill: number; nuc: number; bulge: number; plate: number }

function drawDisc(ctx: CanvasRenderingContext2D, d: { top: number; bot: number }, L: DiscLook, st: WorldState): void {
  const P = discPath(d, L.sw, L.bulge);
  const t = d.top - L.sw, b = d.bot + L.sw, cy = (t + b) / 2;
  ctx.fillStyle = rgba(WATER, 0.1 + 0.16 * L.fill);
  ctx.fill(P);
  lamellae(ctx, d, L.sw, 0.35 + 0.4 * L.fill, L.bulge);
  // the nucleus: a gel of water, brighter the fuller it is
  const ry = NUC.ry + L.sw * 0.8;
  glowEllipse(ctx, WATER, NUC.x, cy, NUC.rx * 1.7, ry * 2.2, 0, (0.2 + 0.45 * L.nuc) * (0.85 + 0.15 * st.deep));
  const ng = ctx.createRadialGradient(NUC.x - 1.5, cy - 0.8, 0.5, NUC.x, cy, NUC.rx);
  ng.addColorStop(0, rgba(WATER_HI, 0.55 + 0.35 * L.nuc));
  ng.addColorStop(0.6, rgba(WATER, 0.3 + 0.3 * L.nuc));
  ng.addColorStop(1, rgba(WATER, 0));
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.ellipse(NUC.x, cy, NUC.rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(WATER_HI, 0.75);
  ctx.lineWidth = hair(ctx, 1);
  ctx.stroke(P);
  // the cartilage end plates
  for (const [y, dir] of [[t, 1], [b, -1]] as const) {
    ctx.strokeStyle = rgba('#dff4ff', 0.25 + 0.6 * L.plate);
    ctx.lineWidth = CART;
    ctx.beginPath();
    for (let x = FRONT + 2; x <= BACK - 2; x += 1) {
      const yy = y - dir * dipAt(x) + dir * CART / 2;
      if (x === FRONT + 2) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

/** A mote of light moving along a short wandering path (diffusion), deterministic by its index. */
function mote(i: number, t: number, from: Pt, to: Pt, life: number): { x: number; y: number; a: number } {
  const ph = (t / life + hash(i * 7 + 1)) % 1;
  const wob = 0.9 * Math.sin(ph * 9 + i * 2.3) + 0.5 * Math.sin(ph * 23 + i);
  const x = from[0] + (to[0] - from[0]) * ph + wob * 0.6;
  const y = from[1] + (to[1] - from[1]) * ph + 0.4 * Math.cos(ph * 13 + i * 1.1);
  return { x, y, a: Math.sin(Math.PI * ph) };
}

const CELLS: readonly Pt[] = Array.from({ length: 14 }, (_, i) => [NUC.x - 7 + hash(i * 11 + 2) * 14, 18.5 + (hash(i * 13 + 5) - 0.5) * 5] as Pt);

function drawWalker(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number, a: number, reduced: boolean): void {
  // a small round window with a figure walking: head, trunk, swinging arms and legs (no features)
  ctx.save();
  ctx.fillStyle = 'rgba(14,8,30,.6)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffe2c4', 0.45 * a);
  ctx.lineWidth = hair(ctx, 1);
  ctx.stroke();
  const s = r / 10, ph = reduced ? 0.6 : t * Math.PI * 2 * 0.9;
  const sw = Math.sin(ph) * 0.55;
  const hip: Pt = [cx, cy + 1.2 * s], neck: Pt = [cx - 0.3 * s, cy - 3.8 * s];
  ctx.strokeStyle = rgba(GOLD_HI, 0.9 * a);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.1 * s;
  ctx.beginPath();
  ctx.moveTo(hip[0], hip[1]);
  ctx.lineTo(neck[0], neck[1]);
  for (const k of [1, -1]) {
    ctx.moveTo(hip[0], hip[1]);
    const kx = hip[0] + Math.sin(sw * k) * 3 * s, ky = hip[1] + Math.cos(sw * k) * 3 * s;
    ctx.lineTo(kx, ky);
    ctx.lineTo(kx + Math.sin(sw * k - 0.25 * (1 + k * Math.sign(sw))) * 3 * s, ky + 3 * s);
    ctx.moveTo(neck[0], neck[1] + 0.6 * s);
    ctx.lineTo(neck[0] - Math.sin(sw * k) * 2.6 * s, neck[1] + 3.2 * s);
  }
  ctx.stroke();
  ctx.fillStyle = rgba(GOLD_HI, 0.9 * a);
  ctx.beginPath();
  ctx.arc(neck[0] - 0.2 * s, neck[1] - 1.7 * s, 1.3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const SEGMENT: WorldPainter = {
  depth: 1,
  lens: true,
  bake(ctx, variant) {
    const night = variant === 'night';
    if (night) {
      const g = ctx.createLinearGradient(0, -60, 0, 60);
      g.addColorStop(0, 'rgba(30,40,110,.35)');
      g.addColorStop(1, 'rgba(20,20,70,.25)');
      ctx.fillStyle = g;
      ctx.fillRect(-70, -62, 140, 124);
    }
    // the front: the anterior longitudinal ligament, and the soft dark in front of the spine
    glow(ctx, night ? '#5a6cff' : '#a05a8a', -17, 0, 60, 0.12);
    bakeBack(ctx);
    for (const b of BODIES) bakeBone(ctx, b, night);
    bakeLoops(ctx, 1);
    bakeDiscGhost(ctx, night);
  },
  draw(ctx, st) {
    switch (st.scene) {
      case 'plytki': return drawPlates(ctx, st);
      case 'dzien': return drawDay(ctx, st);
      case 'noc': return drawNight(ctx, st);
      case 'pompa': return drawPump(ctx, st);
      case 'dyfuzja': return drawDiffusion(ctx, st);
    }
  },
  focusAt(scene, g) {
    if (scene === 'plytki') return [-29 + 24 * g, DISCS[1].bot - 0.3];
    if (scene === 'dyfuzja') return [NUC.x - 6 + 6 * g, DISCS[1].bot - 1 - 3.5 * g];
    return segPt('nucleus');
  },
  counter(scene, g) {
    if (scene === 'dzien') return mpaText(0.5);
    if (scene === 'noc') return mpaText(0.1 + 0.14 * smooth(0, 1, g));
    if (scene === 'dyfuzja' && g > 0.3) return counterText('depth', 8);
    return null;
  },
};

function drawPlates(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const d = DISCS[1];
  drawDisc(ctx, d, { sw: 0, fill: 0.5, nuc: 0.45, bulge: 0, plate: smooth(0, 0.35, g) }, st);
  // the gold sweep along both plates as they are named
  const sweep = FRONT + 2 + (BACK - FRONT - 4) * smooth(0, 0.4, g);
  for (const [y, dir] of [[d.top, 1], [d.bot, -1]] as const) {
    if (g < 0.42 && !st.reduced) glow(ctx, GOLD, sweep, y - dir * dipAt(sweep), 2.2, 0.8);
  }
  // the loops fill with warm blood, one after another, from the middle out
  const n = smooth(0.3, 0.8, g) * LOOPS.length;
  ctx.lineWidth = 0.3;
  for (let i = 0; i < LOOPS.length; i++) {
    const order = Math.abs(i - LOOPS.length / 2) * 2;
    const a = clamp(n - order);
    if (a <= 0) continue;
    const x = LOOPS[i];
    for (const [yp, dir] of [[d.top - dipAt(x), 1], [d.bot + dipAt(x), -1]] as const) {
      ctx.strokeStyle = rgba(a > 0.98 ? BLOOD : BLOOD_HI, 0.9 * a);
      ctx.stroke(loopPath(x, yp, dir));
      glow(ctx, BLOOD, x, yp - dir * 0.6, 0.9, 0.35 * a);
    }
  }
  // then motes of food pass through the plates into the disc
  const m = smooth(0.7, 1, g);
  if (m > 0 && !st.reduced) {
    for (let i = 0; i < 10; i++) {
      const x = LOOPS[(i * 3) % LOOPS.length];
      const up = i % 2 === 0;
      const from: Pt = up ? [x, d.bot + 0.6] : [x, d.top - 0.6], to: Pt = [x + (hash(i) - 0.5) * 3, up ? d.bot - 2.6 : d.top + 2.6];
      const p = mote(i, st.time, from, to, 2.6);
      glow(ctx, i % 3 ? GOLD : '#e9fbff', p.x, p.y, 0.55, p.a * m);
    }
  }
}

function drawDay(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const d = DISCS[1];
  const sw = -0.35 * smooth(0, 1, g);
  drawDisc(ctx, d, { sw, fill: 0.55, nuc: 0.5 + 0.3 * g, bulge: 0.15 * g, plate: 0.4 }, st);
  const cy = (d.top + d.bot) / 2;
  // the weight from above: gold arrows down through L4
  const arr = smooth(0, 0.3, g);
  for (let i = 0; i < 5; i++) {
    const x = -29 + i * 6.5;
    const off = st.reduced ? 0 : ((st.time * 0.6 + i * 0.2) % 1) * 2;
    const y0 = 0 + off, y1 = 8 + off;
    ctx.strokeStyle = rgba(GOLD, 0.7 * arr);
    ctx.lineWidth = hair(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.moveTo(x - 1.1, y1 - 1.4);
    ctx.lineTo(x, y1);
    ctx.lineTo(x + 1.1, y1 - 1.4);
    ctx.stroke();
  }
  // the nucleus spreads the pressure evenly: rings of light, out to the annulus and the plates
  const pr = smooth(0.2, 0.7, g);
  for (let k = 0; k < 3; k++) {
    const ph = st.reduced ? 0.5 + k * 0.15 : (st.time * 0.35 + k / 3) % 1;
    ctx.strokeStyle = rgba(GOLD_HI, 0.5 * pr * (1 - ph));
    ctx.lineWidth = hair(ctx, 1.3);
    ctx.beginPath();
    ctx.ellipse(NUC.x, cy, NUC.rx * (0.5 + ph * 1.6), (NUC.ry + sw) * (0.5 + ph * 1.2), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // a little water leaves through the plates and the annulus
  const lv = smooth(0.45, 1, g);
  if (lv > 0 && !st.reduced) {
    for (let i = 0; i < 12; i++) {
      const side = i % 3;
      const from: Pt = side === 0 ? [NUC.x + (hash(i) - 0.5) * 10, cy] : side === 1 ? [-30, cy + (hash(i) - 0.5) * 4] : [-4, cy];
      const to: Pt = side === 0 ? [from[0], hash(i * 3) > 0.5 ? d.bot + 2.5 : d.top - 2.5] : side === 1 ? [-39, from[1]] : [2.5, cy];
      const p = mote(i, st.time, from, to, 3.2);
      glow(ctx, WATER_HI, p.x, p.y, 0.6, 0.8 * p.a * lv);
    }
  }
}

function drawNight(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const d = DISCS[1];
  const e = smooth(0, 1, g);
  const sw = -0.35 + 0.7 * e;
  drawDisc(ctx, d, { sw, fill: 0.4 + 0.5 * e, nuc: 0.35 + 0.65 * e, bulge: 0.1 * e, plate: 0.5 }, st);
  const cy = (d.top + d.bot) / 2;
  // water drawn back in: from the capillary beds through the plates and from the edges, into the nucleus
  if (!st.reduced) {
    const n = Math.round(6 + 18 * e);
    for (let i = 0; i < n; i++) {
      const side = i % 3;
      const from: Pt = side === 0 ? [LOOPS[(i * 5) % LOOPS.length], d.bot + 1.2] : side === 1 ? [LOOPS[(i * 7) % LOOPS.length], d.top - 1.2] : [-40, cy + (hash(i) - 0.5) * 6];
      const to: Pt = [NUC.x + (hash(i * 9) - 0.5) * 12, cy + (hash(i * 5) - 0.5) * 3];
      const p = mote(i, st.time, from, to, 4.5);
      glow(ctx, WATER_HI, p.x, p.y, 0.7, 0.85 * p.a);
    }
  }
  // the aggrecan in the gel, catching the water (small brushes)
  ctx.strokeStyle = rgba(GOLD_HI, 0.25 + 0.45 * e);
  ctx.lineWidth = 0.14;
  for (let i = 0; i < 9; i++) {
    const x = NUC.x - 6 + hash(i * 3 + 1) * 12, y = cy - 2 + hash(i * 5 + 2) * 4, a = hash(i * 7) * Math.PI;
    brush(ctx, x, y, a, 2.2);
  }
  // the moon of the night, a soft light in a corner
  glow(ctx, '#c9d4ff', -40, 0, 6, 0.25);
}

/** A tiny aggrecan "bottle brush": a core with bristles. */
export function brush(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number): void {
  const c = Math.cos(ang), s = Math.sin(ang);
  ctx.beginPath();
  ctx.moveTo(x - c * len / 2, y - s * len / 2);
  ctx.lineTo(x + c * len / 2, y + s * len / 2);
  for (let k = 0; k <= 6; k++) {
    const u = -len / 2 + (len * k) / 6, bl = len * 0.22;
    const px = x + c * u, py = y + s * u;
    ctx.moveTo(px - s * bl, py + c * bl);
    ctx.lineTo(px + s * bl, py - c * bl);
  }
  ctx.stroke();
}

function drawPump(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const amp = 0.15 + 0.35 * smooth(0, 0.6, g);
  const step = st.reduced ? 0 : Math.sin(st.time * Math.PI * 2 * 0.9);
  const sw = -amp * 0.5 * step;
  for (const d of DISCS) drawDisc(ctx, d, { sw, fill: 0.5 + 0.3 * g, nuc: 0.45 + 0.4 * g, bulge: 0.1 * Math.max(0, step) * amp, plate: 0.4 }, st);
  // water out on the load, back in on the release
  if (!st.reduced) {
    const n = Math.round(4 + 14 * g);
    for (const d of DISCS) {
      const cy = (d.top + d.bot) / 2;
      for (let i = 0; i < n; i++) {
        const out = step > 0;
        const inner: Pt = [NUC.x + (hash(i * 3) - 0.5) * 12, cy + (hash(i * 7) - 0.5) * 3];
        const outer: Pt = i % 2 ? [-40 + hash(i) * 2, cy + (hash(i * 5) - 0.5) * 6] : [LOOPS[(i * 5) % LOOPS.length], hash(i * 11) > 0.5 ? d.bot + 1.6 : d.top - 1.6];
        const p = mote(i, st.time, out ? inner : outer, out ? outer : inner, 1.1);
        glow(ctx, WATER_HI, p.x, p.y, 0.8, 0.75 * p.a * Math.abs(step) * (0.4 + 0.6 * g));
      }
    }
  }
  drawWalker(ctx, -46.5, -42.5, 8, st.time, 0.5 + 0.5 * smooth(0, 0.3, g), st.reduced);
}

function drawDiffusion(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const d = DISCS[1];
  const cy = (d.top + d.bot) / 2;
  drawDisc(ctx, d, { sw: 0, fill: 0.5, nuc: 0.5, bulge: 0, plate: 0.55 }, st);
  // the loops warm
  ctx.lineWidth = 0.3;
  for (const x of LOOPS) {
    ctx.strokeStyle = rgba(BLOOD, 0.55 + 0.35 * smooth(0, 0.2, g));
    ctx.stroke(loopPath(x, d.bot + dipAt(x), -1));
    ctx.stroke(loopPath(x, d.top - dipAt(x), 1));
  }
  // the cells of the nucleus light as food reaches them (the far ones last)
  const lit = smooth(0.15, 0.95, g) * CELLS.length;
  const order = CELLS.map((c, i) => ({ i, d: Math.abs(c[1] - cy) })).sort((a, b) => b.d - a.d);
  for (let k = 0; k < order.length; k++) {
    const c = CELLS[order[k].i];
    const a = clamp(lit - k);
    ctx.fillStyle = rgba(a > 0.5 ? '#fff4dc' : '#cfe0ff', 0.35 + 0.55 * a);
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], 0.45, 0.32, hash(order[k].i) * 3, 0, Math.PI * 2);
    ctx.fill();
    if (a > 0) glow(ctx, GOLD, c[0], c[1], 1.2, 0.5 * a);
  }
  if (!st.reduced) {
    const n = Math.round(4 + 22 * smooth(0, 0.7, g));
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 0;
      const x = LOOPS[(i * 5) % LOOPS.length];
      const target = CELLS[i % CELLS.length];
      const from: Pt = [x, up ? d.bot + 1.4 : d.top - 1.4];
      const p = mote(i, st.time, from, target, 5 + hash(i) * 3);
      glow(ctx, i % 3 === 2 ? '#e9fbff' : GOLD, p.x, p.y, 0.45, 0.9 * p.a);
    }
    const nl = Math.round(3 * smooth(0.6, 1, g) * 4);
    for (let i = 0; i < nl; i++) {
      const c = CELLS[(i * 3) % CELLS.length];
      const p = mote(i + 50, st.time, c, [LOOPS[(i * 7) % LOOPS.length], i % 2 ? d.bot + 1.4 : d.top - 1.4], 6);
      glow(ctx, VIOLET, p.x, p.y, 0.5, 0.85 * p.a);
    }
  }
  // the reach: ≈ 8 mm from a loop to the deepest cell, a measuring line with its two ends
  const rr = smooth(0.3, 0.6, g);
  if (rr > 0) {
    const a: Pt = [-22.5, d.bot + 2.0], b: Pt = [-15.6, cy - 0.2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    const e: Pt = [a[0] + (b[0] - a[0]) * rr, a[1] + (b[1] - a[1]) * rr];
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba('#0c0618', 0.55 * rr);
    ctx.lineWidth = hair(ctx, 4);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(e[0], e[1]);
    ctx.stroke();
    ctx.strokeStyle = rgba(AQUA, 0.95 * rr);
    ctx.lineWidth = hair(ctx, 1.6);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(e[0], e[1]);
    for (const p of [a, e]) {
      ctx.moveTo(p[0] - uy * 0.7, p[1] + ux * 0.7);
      ctx.lineTo(p[0] + uy * 0.7, p[1] - ux * 0.7);
    }
    ctx.stroke();
  }
}
