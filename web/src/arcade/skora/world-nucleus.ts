/**
 * One cell of the epidermis, its nucleus close up (DESIGN.md §24.3, depth 3, under the lens): the melanin cap over
 * the nucleus on the side of the light, and inside it a stretch of DNA — two strands and their rungs — with four
 * places a UV ray has damaged (two neighbouring bases fused, a kink).  The repair is the real one (nucleotide
 * excision repair): enzymes find the kink, cut out a short stretch of the damaged strand, write it anew from the other
 * strand (gold) and seal it.
 *
 *   naprawa   the four places repaired one after another
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, GOLD, GOLD_HI, PEARL, ROSE, TAU, VIOLET, glow, glowEllipse, hash, mix, rgba } from '../kit/healthlib/paint';
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cnt } from './i18n';
import { seen, span, toneOf } from './tone';

export const NUCLEUS_VIEW: Rect = { x: -50, y: -33, w: 100, h: 64 };

const CY = 8;
const AMP = 3.6;
const PERIOD = 13;
const SITES = [-25, -7, 11, 28];
const CUT = 5;
const strandY = (x: number, s: 0 | 1): number => CY + AMP * Math.sin((x / PERIOD) * TAU + (s ? Math.PI : 0));
/** when each place is repaired: its window over the scene */
const winOf = (i: number): [number, number] => [0.04 + i * 0.235, 0.04 + i * 0.235 + 0.21];

function bake(ctx: CanvasRenderingContext2D, _variant: string, look: string): void {
  const tone = toneOf(look);
  // the cell: its body in the skin's tone, glowing softly on the plate
  ctx.beginPath();
  ctx.ellipse(0, CY + 4, 86, 52, 0, 0, TAU);
  const cg = ctx.createRadialGradient(0, CY, 10, 0, CY, 90);
  cg.addColorStop(0, rgba(mix(tone.skin, '#ffd8c8', 0.25), 0.5));
  cg.addColorStop(1, rgba(mix(tone.deep, '#4a1a40', 0.4), 0.55));
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = rgba(tone.hi, 0.5);
  ctx.lineWidth = 0.4;
  ctx.stroke();
  // keratin threads in the cell around the nucleus
  ctx.strokeStyle = rgba(tone.hi, 0.12);
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 60; i++) {
    const a = hash(i * 3 + 1) * TAU, r0 = 46 + 30 * hash(i * 5 + 2);
    const x = Math.cos(a) * r0, y = CY + Math.sin(a) * r0 * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 6 * Math.cos(a + 1.4), y + 4 * Math.sin(a + 1.4), x + 12 * Math.cos(a + 1.6), y + 7 * Math.sin(a + 1.6));
    ctx.stroke();
  }
  // the nucleus: a lilac pool, its envelope a fine bright line, chromatin speckled
  ctx.beginPath();
  ctx.ellipse(0, CY, 44, 22, 0, 0, TAU);
  const ng = ctx.createRadialGradient(-6, CY - 4, 4, 0, CY, 46);
  ng.addColorStop(0, 'rgba(150,120,230,.55)');
  ng.addColorStop(1, 'rgba(90,60,170,.5)');
  ctx.fillStyle = ng;
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,210,255,.75)';
  ctx.lineWidth = 0.45;
  ctx.stroke();
  for (let i = 0; i < 160; i++) {
    const a = hash(i * 7 + 3) * TAU, r = Math.sqrt(hash(i * 11 + 4));
    const x = Math.cos(a) * r * 41, y = CY + Math.sin(a) * r * 19.5;
    if (Math.abs(y - CY) < AMP + 2.5 && Math.abs(x) < 40) continue;
    ctx.beginPath();
    ctx.arc(x, y, 0.35 + 0.4 * hash(i), 0, TAU);
    ctx.fillStyle = 'rgba(200,180,255,.22)';
    ctx.fill();
  }
  // the melanin cap over the nucleus, on the side of the light (denser and larger in darker skin)
  const n = Math.round(40 + 150 * tone.mel);
  for (let i = 0; i < n; i++) {
    const t = hash(i * 13 + 5);
    const a = Math.PI + 0.18 + t * (Math.PI - 0.36);
    const r = 1.04 + 0.12 * hash(i * 17 + 6);
    const x = Math.cos(a) * 44 * r, y = CY + Math.sin(a) * 22 * r - 1.2 * hash(i * 19 + 7);
    ctx.beginPath();
    ctx.ellipse(x, y, 0.9 * tone.size, 0.65 * tone.size, a, 0, TAU);
    ctx.fillStyle = rgba(tone.gran, 0.88);
    ctx.fill();
  }
  glowEllipse(ctx, mix(tone.gran, GOLD, 0.5), 0, CY - 23, 40, 4, 0, 0.12);
  // the light above the cell
  const lg = ctx.createLinearGradient(0, -80, 0, -20);
  lg.addColorStop(0, 'rgba(255,230,180,.0)');
  lg.addColorStop(1, 'rgba(255,230,180,.06)');
  ctx.fillStyle = lg;
  ctx.fillRect(-200, -80, 400, 60);
}

function strandPath(s: 0 | 1, x0: number, x1: number): Path2D {
  const p = new Path2D();
  for (let x = x0; x <= x1 + 0.001; x += 0.6) {
    if (x === x0) p.moveTo(x, strandY(x, s));
    else p.lineTo(x, strandY(x, s));
  }
  return p;
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const { g } = st;
  const v = seen(ctx, 4);
  const xa = Math.max(-40, v.x0), xb = Math.min(40, v.x1);
  // UV rays from above, most stopped by the cap
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = -36 + i * 12 + 2 * Math.sin(i * 2.1);
    const lg = ctx.createLinearGradient(x, -40, x + 3, CY - 22);
    lg.addColorStop(0, 'rgba(200,150,255,0)');
    lg.addColorStop(1, 'rgba(200,150,255,.2)');
    ctx.strokeStyle = lg;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, -40);
    ctx.lineTo(x + 3, CY - 22 - 1.5 * Math.cos(x / 30));
    ctx.stroke();
  }
  ctx.globalCompositeOperation = op;
  // the rungs (base pairs) between the strands
  for (let x = Math.ceil(xa / 1.6) * 1.6; x <= xb; x += 1.6) {
    const near = SITES.findIndex(sx => Math.abs(x - sx) < 1.7);
    const y0 = strandY(x, 0), y1 = strandY(x, 1);
    const k = Math.floor(x / 1.6) & 3;
    ctx.strokeStyle = rgba(['#ff9cbc', '#9fe9ff', '#ffd98a', '#c59bff'][k], 0.55);
    ctx.lineWidth = 0.42;
    if (near >= 0) {
      const [a, b] = winOf(near);
      const fixedK = span(g, a + (b - a) * 0.5, b);
      if (fixedK < 1) {
        // the damage: two neighbouring bases fused, the rung kinked, glowing
        const kink = 1.2 * (1 - fixedK);
        ctx.strokeStyle = rgba(mix(VIOLET, '#ff6080', 0.5), 0.9);
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.quadraticCurveTo(x + kink * (x < SITES[near] ? 1 : -1), (y0 + y1) / 2, x, y1);
        ctx.stroke();
        continue;
      }
    }
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }
  for (let i = 0; i < SITES.length; i++) {
    const [a, b] = winOf(i);
    const k = span(g, a, b);
    const sx = SITES[i];
    if (sx < xa - 8 || sx > xb + 8) continue;
    if (k < 0.5) glow(ctx, '#ff6a9a', sx, CY, 4.5, 0.5 * (1 - k * 2) + 0.2);
  }
  // the strands: the lower intact, the upper with its cut and written stretches
  const lower = strandPath(1, xa, xb);
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(ROSE, 0.9);
  ctx.lineWidth = 0.9;
  ctx.stroke(lower);
  let x = xa;
  const cuts = SITES.map((sx, i) => ({ sx, k: span(g, winOf(i)[0], winOf(i)[1]) }));
  for (const c of cuts) {
    const c0 = c.sx - CUT, c1 = c.sx + CUT;
    if (c0 > x) {
      ctx.strokeStyle = rgba(PEARL, 0.92);
      ctx.lineWidth = 0.9;
      ctx.stroke(strandPath(0, x, Math.min(c0, xb)));
    }
    x = Math.max(x, c1);
    if (c1 < xa || c0 > xb) continue;
    if (c.k < 0.3) {
      ctx.strokeStyle = rgba(PEARL, 0.92);
      ctx.lineWidth = 0.9;
      ctx.stroke(strandPath(0, Math.max(xa, c0), Math.min(xb, c1)));
    } else {
      // the cut piece drifts away, fading
      const f = clamp((c.k - 0.3) / 0.25);
      if (f < 1) {
        ctx.save();
        ctx.translate(2 * f, -9 * f);
        ctx.strokeStyle = rgba(PEARL, 0.8 * (1 - f));
        ctx.lineWidth = 0.9;
        ctx.stroke(strandPath(0, c0, c1));
        ctx.restore();
      }
      // the new stretch written in gold from the other strand
      const w = ease.inOutSine(clamp((c.k - 0.45) / 0.4));
      if (w > 0) {
        ctx.strokeStyle = rgba(GOLD_HI, 0.95);
        ctx.lineWidth = 1;
        ctx.stroke(strandPath(0, c0, c0 + (c1 - c0) * w));
        glow(ctx, GOLD, c0 + (c1 - c0) * w, strandY(c0 + (c1 - c0) * w, 0), 3, w < 1 ? 0.6 : 0.25);
      }
    }
    // the enzymes: they come, hold the place while they work, and leave
    const e = c.k <= 0 ? 0 : c.k < 0.25 ? c.k / 0.25 : c.k < 0.88 ? 1 : 1 - (c.k - 0.88) / 0.12;
    if (e > 0) {
      const ey = CY - 3 - (1 - Math.min(1, c.k / 0.25)) * 16 - (c.k > 0.88 ? (c.k - 0.88) * 80 : 0);
      glow(ctx, AQUA, c.sx, ey, 6, 0.35 * e);
      ctx.beginPath();
      ctx.ellipse(c.sx - 1.6, ey, 2.4, 1.9, 0.3, 0, TAU);
      ctx.ellipse(c.sx + 1.8, ey + 0.4, 2.1, 1.7, -0.3, 0, TAU);
      ctx.fillStyle = rgba(mix(AQUA, '#ffffff', 0.25), 0.62 * e);
      ctx.fill();
    }
  }
  if (x < xb) {
    ctx.strokeStyle = rgba(PEARL, 0.92);
    ctx.lineWidth = 0.9;
    ctx.stroke(strandPath(0, x, xb));
  }
  if (st.deep > 0.02) {
    glowEllipse(ctx, '#c8b0ff', 0, CY, 46, 22, 0, 0.07 * st.deep);
    glowEllipse(ctx, '#ffb08a', 0, CY - 24, 40, 8, 0, 0.06 * st.deep);
  }
}

export const nucPt = {
  dna: [-38, CY] as Pt,
  damage: [SITES[3], CY + AMP] as Pt,
  enzymes: [SITES[1], CY - 5] as Pt,
  newstrand: [SITES[0], strandY(SITES[0] + 2, 0) - 1.5] as Pt,
  cap: [14, CY - 24] as Pt,
  nucleus: [26, CY + 16] as Pt,
};

export const NUCLEUS: WorldPainter = {
  depth: 3,
  lens: true,
  bake,
  draw,
  focusAt(_scene, g) {
    const i = Math.max(0, Math.min(SITES.length - 1, Math.floor((g - 0.04) / 0.235)));
    return [SITES[i], CY];
  },
  counter(_scene, g) {
    let n = 0;
    for (let i = 0; i < SITES.length; i++) if (g >= winOf(i)[1]) n++;
    return g > 0.02 ? cnt('repaired', n, SITES.length) : null;
  },
};
