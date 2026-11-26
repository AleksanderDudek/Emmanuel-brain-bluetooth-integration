/**
 * The hands of light that rest on the heart and the belly (Dłoń na sercu, DESIGN.md §23): seen through the player's
 * own eyes, a hand lying flat, palm down, the fingers together and the thumb a little apart, the forearm fading toward
 * the screen's edge — the series' style of light (Złote serce's hands.ts, kit/figure.ts): a rim of light round the
 * hand's union, a faint warm fill.  Built once as shapes in hand units (wrist at 0, the fingers toward +x, the middle
 * finger's tip at x ≈ 1, the thumb toward −y), drawn into a sprite per size, so a frame only places it.
 *
 * The cupped pair that holds the stone (Kamienie) is Złote serce's (kintsugi/hands.ts `drawHands`).
 */
import { capsule, cw, spline, type P } from '../kit/figure';
import { makeCanvas } from './paint';

interface Shape { pts: readonly P[]; smooth: boolean }

function hand(): Shape[] {
  const palm: P[] = [
    [0.02, -0.17], [0.2, -0.21], [0.4, -0.2], [0.52, -0.16], [0.55, -0.05], [0.55, 0.07], [0.5, 0.17],
    [0.32, 0.2], [0.14, 0.19], [0.02, 0.15], [-0.02, 0],
  ];
  // the four fingers together, a little curved at the tips (lying on the chest)
  const fingers: [P, P, number][] = [
    [[0.5, -0.135], [0.9, -0.15], 0.058],
    [[0.53, -0.045], [0.99, -0.05], 0.062],
    [[0.53, 0.05], [0.95, 0.058], 0.06],
    [[0.48, 0.135], [0.8, 0.16], 0.052],
  ];
  const thumb: [P, P, number] = [[0.22, -0.17], [0.52, -0.33], 0.068];
  const arm: [P, P, number] = [[0.06, 0.0], [-0.95, 0.02], 0.17];
  return [
    { pts: cw(palm), smooth: true },
    ...fingers.map(([a, b, r]) => ({ pts: cw(capsule(a, b, r, r * 0.9)), smooth: false })),
    { pts: cw(capsule(thumb[0], thumb[1], thumb[2], thumb[2] * 0.85)), smooth: false },
    { pts: cw(capsule(arm[0], arm[1], arm[2], arm[2] * 1.05)), smooth: false },
  ];
}

const SHAPES = hand();
/** The hand's box in hand units (the forearm runs off to the left). */
const BOX = { x0: -1.0, y0: -0.45, w: 2.12, h: 0.75 };

function shapePath(s: Shape, map: (x: number, y: number) => [number, number]): Path2D {
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

let cache: { px: number; c: HTMLCanvasElement } | null = null;

/** The hand's sprite at `px` pixels per hand unit (cached by size). */
function sprite(px: number): HTMLCanvasElement | null {
  const size = Math.max(8, Math.round(px));
  if (cache && cache.px === size) return cache.c;
  if (typeof Path2D === 'undefined') return null;
  const w = Math.ceil(BOX.w * size), h = Math.ceil(BOX.h * size);
  const c = makeCanvas(w, h), g = c?.getContext('2d');
  if (!c || !g) return null;
  const map = (x: number, y: number): [number, number] => [(x - BOX.x0) * size, (y - BOX.y0) * size];
  const all = new Path2D();
  for (const s of SHAPES) all.addPath(shapePath(s, map));
  g.lineJoin = 'round';
  for (const [wk, a] of [[0.16, 0.07], [0.09, 0.15], [0.045, 0.32], [0.016, 0.78]] as const) {
    g.strokeStyle = `rgba(255,238,210,${a})`;
    g.lineWidth = wk * size;
    for (const s of SHAPES) g.stroke(shapePath(s, map));
  }
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fill(all, 'nonzero');
  g.globalCompositeOperation = 'source-over';
  const fill = g.createLinearGradient(w, 0, 0, 0);
  fill.addColorStop(0, 'rgba(255,246,228,0.4)');
  fill.addColorStop(0.5, 'rgba(255,228,192,0.26)');
  fill.addColorStop(1, 'rgba(255,206,160,0.02)');
  g.fillStyle = fill;
  g.fill(all, 'nonzero');
  // the forearm fades toward its end
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.32, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  cache = { px: size, c };
  return c;
}

/**
 * Draw a resting hand: its palm's middle at (x, y), `px` pixels per hand unit, turned by `rot` (rad), mirrored when
 * `flip` (the fingers then point left), with alpha.
 */
export function drawRestingHand(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, rot: number, flip: boolean, alpha: number): void {
  if (alpha <= 0.01 || px < 6) return;
  const q = Math.round(px / 8) * 8 || 8;
  const spr = sprite(q);
  if (!spr) return;
  const k = px / q;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha *= Math.min(1, alpha);
  // the palm's middle (0.3, 0) at the origin
  ctx.drawImage(spr, (BOX.x0 - 0.3) * px, BOX.y0 * px, spr.width * k, spr.height * k);
  ctx.restore();
}

/** The palm's middle to the fingertips, in hand units (for placing the warmth under the hand). */
export const HAND_LEN = 0.7;
