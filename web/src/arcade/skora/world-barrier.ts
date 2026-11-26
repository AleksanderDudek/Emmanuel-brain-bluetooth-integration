/**
 * The barrier close up (DESIGN.md §24.3, depth 3, under the lens): the horny layer in section as bricks and mortar —
 * flat corneocytes filled with keratin, stacked about ten deep and staggered like a wall, held by tiny rivets
 * (corneodesmosomes); between them the lipid mortar in thin sheets (ceramides, cholesterol, fatty acids — drawn as
 * stripes in about their shares: two of gold, one of pearl, one of honey); below, the granular layer whose lamellar
 * bodies release the lipids; on top the mildly acidic mantle with the skin's friendly bacteria.
 *
 *   cegly    the bricks are laid from the bottom up, layer by layer, and riveted
 *   zaprawa  the mortar flows into every joint from the lamellar bodies below
 *   plaszcz  water is held inside each brick (the natural moisturising factor); the acid mantle forms on top
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, GOLD, GOLD_HI, HONEY, PEARL, ROSE, TAU, glow, glowEllipse, hash, mix, rgba } from '../kit/healthlib/paint';
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cnt } from './i18n';
import { airLight, seen, span, toneOf, type Tone } from './tone';

export const BARRIER_VIEW: Rect = { x: -38, y: -28, w: 76, h: 52 };

/** the horny layer's rows (0 the surface … ROWS-1 the deepest) */
const ROWS = 10;
const ROW = 3.5;
const TOP = -22;
const BRICK_H = 2.5;
const rowY = (r: number): number => TOP + r * ROW;
/** the granular layer below the wall */
const GRAN = rowY(ROWS) + 0.6;

interface Brick { r: number; x0: number; x1: number; y: number; i: number }
let bricks: Brick[] | null = null;
function allBricks(): Brick[] {
  if (bricks) return bricks;
  const out: Brick[] = [];
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    let x = -220 + (r % 2) * 13 + 6 * hash(r * 7 + 1);
    while (x < 220) {
      const len = 23 + 6 * hash(i * 13 + r);
      out.push({ r, x0: x, x1: x + len, y: rowY(r) + 0.25 * Math.sin(x * 0.07 + r), i: i++ });
      x += len + 1.1;
    }
  }
  bricks = out;
  return out;
}
/** when a brick is laid in the bricks scene: from the deepest row up, along the row with a little scatter */
const laidAt = (b: Brick): number => ((ROWS - 1 - b.r) / ROWS) * 0.82 + 0.06 * hash(b.i * 3 + 2);

function brickPath(b: Brick, inset = 0): Path2D {
  const p = new Path2D();
  const x0 = b.x0 + inset, x1 = b.x1 - inset, y0 = b.y - BRICK_H / 2 + inset * 0.4, y1 = b.y + BRICK_H / 2 - inset * 0.4;
  const t = 2.2; // the tapered ends of a flat cell
  p.moveTo(x0 + t, y0);
  p.lineTo(x1 - t, y0);
  p.quadraticCurveTo(x1, y0 + 0.1, x1, b.y);
  p.quadraticCurveTo(x1, y1 - 0.1, x1 - t, y1);
  p.lineTo(x0 + t, y1);
  p.quadraticCurveTo(x0, y1 - 0.1, x0, b.y);
  p.quadraticCurveTo(x0, y0 + 0.1, x0 + t, y0);
  p.closePath();
  return p;
}

function drawBrick(ctx: CanvasRenderingContext2D, b: Brick, tone: Tone, a: number, lift = 0): void {
  ctx.save();
  if (lift) ctx.translate(0, -lift);
  const p = brickPath(b);
  const g = ctx.createLinearGradient(0, b.y - BRICK_H / 2, 0, b.y + BRICK_H / 2);
  // each cell a little different: pearl to the skin's own warmth
  const body = mix(mix(tone.hi, PEARL, 0.25), tone.skin, 0.15 + 0.25 * hash(b.i * 5 + 1));
  g.addColorStop(0, rgba(mix(body, '#ffffff', 0.4), 0.9 * a));
  g.addColorStop(0.45, rgba(body, 0.8 * a));
  g.addColorStop(1, rgba(mix(body, ROSE, 0.35), 0.72 * a));
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = rgba('#fff8f0', 0.6 * a);
  ctx.lineWidth = 0.14;
  ctx.stroke(p);
  // a highlight along its upper edge
  ctx.strokeStyle = rgba('#ffffff', 0.35 * a);
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(b.x0 + 3, b.y - BRICK_H / 2 + 0.35);
  ctx.lineTo(b.x1 - 3, b.y - BRICK_H / 2 + 0.35);
  ctx.stroke();
  // keratin inside: fine lengthwise fibres
  ctx.strokeStyle = rgba(mix(tone.skin, '#a07a90', 0.5), 0.22 * a);
  ctx.lineWidth = 0.1;
  for (let k = 0; k < 3; k++) {
    const y = b.y - 0.6 + k * 0.6;
    ctx.beginPath();
    ctx.moveTo(b.x0 + 3, y);
    for (let x = b.x0 + 3; x <= b.x1 - 3; x += 3) ctx.lineTo(x, y + 0.12 * Math.sin(x * 0.9 + k + b.i));
    ctx.stroke();
  }
  ctx.restore();
}

/** The rivets: small knots where a brick holds its neighbours above and below. */
function rivets(ctx: CanvasRenderingContext2D, b: Brick, a: number): void {
  if (b.r === 0) return;
  ctx.fillStyle = rgba(mix(AQUA, PEARL, 0.5), 0.8 * a);
  for (let k = 1; k <= 3; k++) {
    const x = b.x0 + ((b.x1 - b.x0) * k) / 4;
    ctx.beginPath();
    ctx.ellipse(x, b.y - BRICK_H / 2 - 0.5, 0.3, 0.55, 0, 0, TAU);
    ctx.fill();
  }
}

/** The mortar along a joint (x0..x1 at y, horizontal), a share k drawn: stripes of gold (ceramides), pearl, honey. */
function mortarH(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, k: number, a: number): void {
  if (k <= 0) return;
  const xe = x0 + (x1 - x0) * k;
  // a soft golden light along the joint, then its sheets
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(GOLD, 0.2 * a);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(xe, y);
  ctx.stroke();
  ctx.globalCompositeOperation = op;
  const stripes: [string, number][] = [[GOLD, -0.3], [GOLD_HI, -0.1], [PEARL, 0.1], [HONEY, 0.3]];
  for (const [c, dy] of stripes) {
    ctx.strokeStyle = rgba(c, 0.9 * a);
    ctx.lineWidth = 0.15;
    ctx.beginPath();
    ctx.moveTo(x0, y + dy);
    ctx.lineTo(xe, y + dy);
    ctx.stroke();
  }
}

function seams(): { h: { y: number; x0: number; x1: number }[]; v: { x: number; y0: number; y1: number }[] } {
  const h: { y: number; x0: number; x1: number }[] = [];
  for (let r = 0; r < ROWS - 1; r++) h.push({ y: rowY(r) + ROW / 2, x0: -220, x1: 220 });
  const v: { x: number; y0: number; y1: number }[] = [];
  let prev: Brick | null = null;
  for (const b of allBricks()) {
    if (prev && prev.r === b.r) v.push({ x: (prev.x1 + b.x0) / 2, y0: b.y - BRICK_H / 2, y1: b.y + BRICK_H / 2 });
    prev = b;
  }
  return { h, v };
}

// ── the still layer ──────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D, variant: string, look: string): void {
  const tone = toneOf(look);
  // the granular layer below: living cells, warm, with their lamellar bodies
  const gg = ctx.createLinearGradient(0, GRAN, 0, GRAN + 40);
  gg.addColorStop(0, rgba(mix(tone.skin, '#ffd9b0', 0.25), 0.55));
  gg.addColorStop(1, rgba(mix(tone.deep, '#5a2050', 0.5), 0.5));
  ctx.fillStyle = gg;
  ctx.fillRect(-260, GRAN, 520, 60);
  for (let j = 0; j < 5; j++) for (let i = -16; i <= 16; i++) {
    const x = i * 15 + 4 * Math.sin(i) + (j % 2) * 7.5, y = GRAN + 6.5 + j * 9.5 + 1.5 * hash(i + 40 + j * 7);
    const fade = 1 - j * 0.16;
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.ellipse(x, y, 7.4, 4.2, 0, 0, TAU);
    ctx.fillStyle = rgba(mix(tone.skin, '#ffd2b8', 0.3), 0.55);
    ctx.fill();
    ctx.strokeStyle = rgba(tone.hi, 0.45);
    ctx.lineWidth = 0.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y + 0.6, 2.1, 1.4, 0, 0, TAU);
    ctx.fillStyle = 'rgba(74,42,110,.6)';
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x - 4.5 + k * 3 + hash(i * 5 + k), y - 2 + hash(i * 3 + k), 0.35, 0, TAU);
      ctx.fillStyle = 'rgba(60,30,60,.6)';
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // the air above, lit
  airLight(ctx, TOP - BRICK_H / 2 - 0.5, 0.4);
  if (variant === 'built' || variant === 'full') {
    for (const b of allBricks()) {
      drawBrick(ctx, b, tone, 1);
      rivets(ctx, b, 1);
    }
  }
  if (variant === 'full') {
    const s = seams();
    for (const j of s.h) mortarH(ctx, j.x0, j.x1, j.y, 1, 1);
    for (const j of s.v) vJoint(ctx, j.x, j.y0, j.y1, 1, 1);
  }
}

function vJoint(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, k: number, a: number): void {
  if (k <= 0) return;
  ctx.strokeStyle = rgba(GOLD, 0.85 * a);
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y0 + (y1 - y0) * k);
  ctx.stroke();
}

// ── what lives ───────────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const tone = toneOf(st.look);
  const { scene, g } = st;
  const v = seen(ctx, 6);
  const inView = (b: Brick) => b.x1 > v.x0 && b.x0 < v.x1;
  if (scene === 'cegly') {
    for (const b of allBricks()) {
      if (!inView(b)) continue;
      const k = clamp((g - laidAt(b)) / 0.08);
      if (k <= 0) continue;
      drawBrick(ctx, b, tone, ease.outCubic(k), (1 - ease.outCubic(k)) * 3);
      if (k >= 1) rivets(ctx, b, clamp((g - laidAt(b) - 0.08) / 0.05));
      if (k < 1 && st.growing) glow(ctx, GOLD, (b.x0 + b.x1) / 2, b.y, 6, 0.3 * Math.sin(k * Math.PI));
    }
  } else if (scene === 'zaprawa') {
    const s = seams();
    // the mortar flows from the deepest joints up, each from left to right through the view
    for (const j of s.h) {
      const r = (j.y - TOP) / ROW;
      const k = span(g, 0.04 + ((ROWS - 1 - r) / ROWS) * 0.7, 0.3 + ((ROWS - 1 - r) / ROWS) * 0.7);
      const x0 = Math.max(j.x0, v.x0), x1 = Math.min(j.x1, v.x1);
      mortarH(ctx, x0, x1, j.y, ease.inOutSine(k), 1);
      if (k > 0 && k < 1 && st.growing) glow(ctx, GOLD, x0 + (x1 - x0) * k, j.y, 3, 0.45);
    }
    for (const j of s.v) {
      if (j.x < v.x0 || j.x > v.x1) continue;
      const r = (j.y0 + BRICK_H / 2 - TOP) / ROW;
      vJoint(ctx, j.x, j.y0, j.y1, span(g, 0.1 + ((ROWS - 1 - r) / ROWS) * 0.7, 0.24 + ((ROWS - 1 - r) / ROWS) * 0.7), 1);
    }
    // lamellar bodies rising from the granular cells, releasing their sheets into the deepest joint
    for (let i = 0; i < 14; i++) {
      const x = -48 + i * 7.3 + 2 * Math.sin(i * 1.7);
      const ph = (g * 2.4 + hash(i * 9 + 1)) % 1;
      const y = GRAN + 5 - ph * 6;
      const a = Math.sin(ph * Math.PI) * clamp(g * 8);
      if (a < 0.02) continue;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.1, 0.75, 0, 0, TAU);
      ctx.fillStyle = rgba(GOLD, 0.65 * a);
      ctx.fill();
      ctx.strokeStyle = rgba(GOLD_HI, 0.8 * a);
      ctx.lineWidth = 0.1;
      for (const dy of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(x - 0.8, y + dy);
        ctx.lineTo(x + 0.8, y + dy);
        ctx.stroke();
      }
    }
  } else if (scene === 'plaszcz') {
    // water held inside the bricks (aqua light pooling), the deepest first
    const nmf = ease.outCubic(span(g, 0.02, 0.6));
    for (const b of allBricks()) {
      if (!inView(b)) continue;
      const k = clamp((nmf - (ROWS - 1 - b.r) / ROWS * 0.6) / 0.4);
      if (k <= 0) continue;
      ctx.save();
      ctx.clip(brickPath(b, 0.4));
      ctx.fillStyle = rgba(AQUA, 0.24 * k);
      ctx.fillRect(b.x0, b.y - BRICK_H / 2, b.x1 - b.x0, BRICK_H);
      ctx.restore();
      for (let d = 0; d < 3; d++) {
        const x = b.x0 + 4 + (b.x1 - b.x0 - 8) * hash(b.i * 7 + d), y = b.y + 0.4 * (hash(b.i + d * 3) - 0.5);
        glow(ctx, AQUA, x, y, 1.4, 0.35 * k);
      }
    }
    // the mantle: a thin, shimmering, mildly acidic film over the surface
    const m = ease.outCubic(span(g, 0.35, 0.85));
    if (m > 0) {
      const y = TOP - BRICK_H / 2 - 0.9;
      const mg = ctx.createLinearGradient(0, y - 1.4, 0, y + 0.8);
      mg.addColorStop(0, 'rgba(200,170,255,0)');
      mg.addColorStop(0.6, rgba(mix(AQUA, '#d2c6ff', 0.5), 0.45 * m));
      mg.addColorStop(1, rgba('#e8dcff', 0.2 * m));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.moveTo(v.x0, y + 0.8);
      for (let x = v.x0; x <= v.x1; x += 2) ctx.lineTo(x, y - 0.9 - 0.25 * Math.sin(x * 0.3 + (st.reduced ? 0 : st.time) * 0.3));
      ctx.lineTo(v.x1, y + 0.8);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 26; i++) {
        const x = -60 + i * 4.8 + 1.5 * Math.sin(i * 2.1);
        if (x < v.x0 || x > v.x1) continue;
        glow(ctx, '#e6dcff', x, y - 0.6, 1.2, 0.25 * m * (0.5 + 0.5 * Math.sin(i * 1.3 + (st.reduced ? 0 : st.time) * 0.8)));
      }
    }
    // the friendly bacteria settling on the mantle
    const f = span(g, 0.55, 1);
    for (let i = 0; i < 11; i++) {
      const k = clamp((f - i / 14) * 4);
      if (k <= 0) continue;
      const x = -44 + i * 8.7 + 2 * hash(i * 3), y = TOP - BRICK_H / 2 - 2.3 - (1 - ease.outCubic(k)) * 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((hash(i) - 0.5) * 0.6);
      ctx.beginPath();
      if (i % 3) ctx.ellipse(0, 0, 1.4, 0.55, 0, 0, TAU);
      else ctx.arc(0, 0, 0.75, 0, TAU);
      ctx.fillStyle = rgba('#c8f0b8', 0.75 * k);
      ctx.fill();
      ctx.strokeStyle = rgba('#f0ffe8', 0.8 * k);
      ctx.lineWidth = 0.12;
      ctx.stroke();
      ctx.restore();
    }
  }
  if (st.deep > 0.02) {
    glowEllipse(ctx, '#ffd0b0', 0, rowY(5), 70, 26, 0, 0.07 * st.deep);
    if (scene === 'plaszcz') glowEllipse(ctx, AQUA, 0, rowY(4), 60, 18, 0, 0.06 * st.deep);
  }
}

/** The places the names point to. */
export const barPt = {
  brick: [6, rowY(2)] as Pt,
  deepBrick: [-20, rowY(8)] as Pt,
  rivet: [-12, rowY(5) - BRICK_H / 2 - 0.5] as Pt,
  joint: [14, rowY(6) + ROW / 2] as Pt,
  lamellar: [-20, GRAN + 4] as Pt,
  water: [-8, rowY(3)] as Pt,
  mantle: [24, TOP - BRICK_H / 2 - 1.6] as Pt,
  flora: [-27, TOP - BRICK_H / 2 - 2.3] as Pt,
  surface: [0, TOP] as Pt,
};

export const BARRIER: WorldPainter = {
  depth: 3,
  lens: true,
  bake,
  draw,
  focusAt(scene, g) {
    if (scene === 'cegly') return [0, rowY(Math.max(0, Math.min(ROWS - 1, Math.round((1 - g) * (ROWS - 1)))))];
    if (scene === 'zaprawa') return [0, rowY(Math.max(0, Math.min(ROWS - 2, Math.round((1 - g) * (ROWS - 2))))) + ROW / 2];
    return [0, TOP - 1];
  },
  counter(scene, g) {
    if (scene === 'cegly') {
      let n = 0;
      for (let r = ROWS - 1; r >= 0; r--) if (g >= ((ROWS - 1 - r) / ROWS) * 0.82 + 0.12) n++;
      return n > 0 ? cnt('layers', n) : null;
    }
    if (scene === 'plaszcz') return g > 0.45 ? cnt('ph', 4.7) : null;
    return null;
  },
};
