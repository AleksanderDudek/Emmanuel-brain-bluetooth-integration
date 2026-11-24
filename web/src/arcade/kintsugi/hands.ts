/**
 * The hands of light that lift, hold and lay each piece (DESIGN.md §21): two open hands, palms up and toward the one
 * who prays, the little-finger edges together at the bottom and the fingers fanning up and out — the gesture of
 * offering, in the series' style of light (kit/figure.ts): a rim of light round their union, a faint warm fill that
 * fades toward the wrists.  Built once as shapes in hand units (the pair 2 wide, the piece rests at (0, −0.12)), drawn
 * into a sprite per size, so a frame only places the sprite.
 */
import { capsule, cw, spline, type P } from '../kit/figure';
import { makeCanvas } from './paint';

interface Shape { pts: readonly P[]; smooth: boolean }

/** One hand (the viewer's right) in its own frame: palm centre at 0, fingers up (−y), the little finger toward −x. */
function hand(): Shape[] {
  const palm: P[] = [
    [-0.21, -0.16], [-0.1, -0.21], [0.05, -0.22], [0.19, -0.18], [0.25, -0.05], [0.27, 0.1],
    [0.2, 0.24], [0.05, 0.3], [-0.12, 0.27], [-0.21, 0.14], [-0.24, 0],
  ];
  // the fingers close together and a little curled (shorter), as hands that hold
  const fingers: [P, P, number][] = [
    [[-0.165, -0.13], [-0.215, -0.4], 0.056],
    [[-0.06, -0.17], [-0.075, -0.5], 0.062],
    [[0.055, -0.18], [0.06, -0.53], 0.063],
    [[0.165, -0.14], [0.19, -0.46], 0.058],
  ];
  const thumb: [P, P, number] = [[0.22, 0.06], [0.42, -0.17], 0.07];
  const arm: [P, P, number] = [[0.0, 0.22], [0.05, 0.95], 0.19];
  return [
    { pts: cw(palm), smooth: true },
    ...fingers.map(([a, b, r]) => ({ pts: cw(capsule(a, b, r, r * 0.92)), smooth: false })),
    { pts: cw(capsule(thumb[0], thumb[1], thumb[2], thumb[2] * 0.85)), smooth: false },
    { pts: cw(capsule(arm[0], arm[1], arm[2], arm[2])), smooth: false },
  ];
}

/** Both hands in pair units: each turned out a little, the heels together under the piece. */
function pair(): Shape[] {
  const one = hand();
  const out: Shape[] = [];
  for (const side of [1, -1] as const) {
    const a = side * 0.36, c = Math.cos(a), s = Math.sin(a);
    const ox = side * 0.31, oy = 0.14;
    for (const sh of one) {
      const pts = sh.pts.map(([x, y]) => {
        const xx = side * x;
        return [ox + xx * c - y * s, oy + xx * s + y * c] as P;
      });
      // a mirrored hand winds the other way: turn it back, so the union fills (nonzero)
      out.push({ smooth: sh.smooth, pts: side < 0 ? pts.reverse() : pts });
    }
  }
  return out;
}

const SHAPES = pair();
/** The pair's box in pair units (the arms run off the bottom). */
export const HANDS_BOX = { x0: -1.05, y0: -0.78, w: 2.1, h: 1.75 };

function shapesPath(map: (x: number, y: number) => [number, number]): Path2D {
  const p = new Path2D();
  for (const s of SHAPES) {
    if (s.smooth) spline(p, s.pts, map, true);
    else {
      s.pts.forEach(([x, y], i) => {
        const [X, Y] = map(x, y);
        if (i) p.lineTo(X, Y); else p.moveTo(X, Y);
      });
      p.closePath();
    }
  }
  return p;
}

/** The hands' sprite at `px` pixels per pair unit (cached by size). */
let cache: { px: number; c: HTMLCanvasElement } | null = null;
export function handsSprite(px: number): HTMLCanvasElement | null {
  const size = Math.max(8, Math.round(px));
  if (cache && cache.px === size) return cache.c;
  const w = Math.ceil(HANDS_BOX.w * size), h = Math.ceil(HANDS_BOX.h * size);
  const c = makeCanvas(w, h), g = c?.getContext('2d');
  if (!c || !g) return null;
  const map = (x: number, y: number): [number, number] => [(x - HANDS_BOX.x0) * size, (y - HANDS_BOX.y0) * size];
  const path = shapesPath(map);
  // the rim of light: wide and faint, then narrow and bright; the inside erased so only the rim round the union stays
  g.lineJoin = 'round';
  for (const [wk, a] of [[0.2, 0.07], [0.11, 0.15], [0.055, 0.32], [0.02, 0.75]] as const) {
    g.strokeStyle = `rgba(255,238,206,${a})`;
    g.lineWidth = wk * size;
    for (const s of SHAPES) g.stroke(shapesPath0(s, map));
  }
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fill(path, 'nonzero');
  g.globalCompositeOperation = 'source-over';
  // the warm fill, brightest at the palms
  const fill = g.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, 'rgba(255,248,232,0.42)');
  fill.addColorStop(0.45, 'rgba(255,230,192,0.28)');
  fill.addColorStop(1, 'rgba(255,206,160,0.03)');
  g.fillStyle = fill;
  g.fill(path, 'nonzero');
  // the palms' light
  const pc = map(0, -0.02);
  const pg = g.createRadialGradient(pc[0], pc[1], 0, pc[0], pc[1], 0.75 * size);
  pg.addColorStop(0, 'rgba(255,242,214,0.45)');
  pg.addColorStop(1, 'rgba(255,240,210,0)');
  g.save();
  g.clip(path, 'nonzero');
  g.fillStyle = pg;
  g.fillRect(0, 0, w, h);
  g.restore();
  // the arms fade out toward the bottom
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.62, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  cache = { px: size, c };
  return c;
}

function shapesPath0(s: Shape, map: (x: number, y: number) => [number, number]): Path2D {
  const p = new Path2D();
  if (s.smooth) spline(p, s.pts, map, true);
  else {
    s.pts.forEach(([x, y], i) => {
      const [X, Y] = map(x, y);
      if (i) p.lineTo(X, Y); else p.moveTo(X, Y);
    });
    p.closePath();
  }
  return p;
}

/** Where a piece rests on the hands (pair units). */
export const REST_AT = { x: 0, y: -0.12 };

/** Draw the hands so their resting point is at (x, y), `px` pixels per pair unit, with alpha. */
export function drawHands(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, alpha: number): void {
  if (alpha <= 0.01 || px < 4) return;
  const spr = handsSprite(Math.round(px / 8) * 8 || 8);
  if (!spr) return;
  const k = px / (Math.round(px / 8) * 8 || 8);
  const w = spr.width * k, h = spr.height * k;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(spr, x - (REST_AT.x - HANDS_BOX.x0) * px, y - (REST_AT.y - HANDS_BOX.y0) * px, w, h);
  ctx.globalAlpha = 1;
}
