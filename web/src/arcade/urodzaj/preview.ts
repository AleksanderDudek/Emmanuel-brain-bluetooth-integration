/**
 * Urodzaj's picture for the lobby's hero and the game card: a basket heaped with fruit at golden hour,
 * Feliks the sparrow letting an apricot go, two grapes meeting in a pop, the rim's gauge with its wheat
 * ear at the threshold, the charge glowing in the weave.  With progress (the lobby) the table beside it
 * shows the player's decorations.  Drawn every frame, so it stays cheap: no state.
 */
import { clamp } from '../kit/juice';
import { DECORS } from './content';
import { decorCount, type UrodzajProgress } from './meta';
import { World } from './physics';
import { TAU, paintBasketBack, paintBasketFront, paintField, paintFruit, paintRim, paintSparrow, paintTable } from './paint';

/** The fruit dropped into the picture's basket (tier, x), settled once by the game's own physics and kept. */
const DROPS: readonly [number, number][] = [
  [9, -0.25], [7, 0.3], [6, 0.02], [8, 0.28], [5, -0.3], [4, -0.05], [3, 0.12], [2, -0.36], [1, 0.38], [6, -0.12], [4, 0.36], [3, -0.28],
];
let heap: { tier: number; x: number; y: number; r: number; a: number }[] | null = null;

function settledHeap(): { tier: number; x: number; y: number; r: number; a: number }[] {
  if (heap) return heap;
  const w = new World();
  DROPS.forEach(([tier, x], i) => {
    w.add(tier, x, 0.9 + i * 0.25);
    for (let k = 0; k < 60; k++) w.stepOnce();
  });
  for (let k = 0; k < 600; k++) w.stepOnce();
  heap = w.bodies.map(b => ({ tier: b.tier, x: b.x, y: b.y, r: b.r, a: b.angle }));
  return heap;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: UrodzajProgress): void {
  const S = Math.max(40, Math.min(w * 0.42, h * 0.62));
  const cx = w * (p ? 0.42 : 0.5), floor = h - Math.max(10, h * 0.1);
  paintField(ctx, w, h, floor + 4, t);
  const level = 0.5 + 0.42 * Math.sin(t * 0.8);
  const bp = { x0: cx - S / 2, x1: cx + S / 2, floor, rim: floor - S * 1.0, wall: Math.max(5, S * 0.045), charge: clamp(0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.5))), veiled: false, burst: 0, t };
  paintBasketBack(ctx, bp);
  for (const f of settledHeap()) {
    if (f.y + f.r > 0.95) continue;
    paintFruit(ctx, null, f.tier, cx + f.x * S, floor - f.y * S, f.r * S, -f.a, 0, 'calm');
  }
  // two grapes meeting
  const k = (t % 2.4) / 2.4;
  const gx = cx + S * 0.12, gy = floor - S * 0.78;
  if (k < 0.6) {
    const d = (1 - k / 0.6) * S * 0.09;
    paintFruit(ctx, null, 2, gx - d, gy, S * 0.045, 0, 0, 'calm');
    paintFruit(ctx, null, 2, gx + d, gy, S * 0.045, 0, 0, 'calm');
  } else {
    const q = (k - 0.6) / 0.4;
    paintFruit(ctx, null, 3, gx, gy, S * 0.058 * (1 + 0.2 * Math.sin(q * Math.PI)), 0, 0.12 * (1 - q), 'happy');
    ctx.strokeStyle = `rgba(255,236,170,${1 - q})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, S * 0.06 * (1 + q), 0, TAU);
    ctx.stroke();
  }
  paintBasketFront(ctx, bp);
  paintRim(ctx, bp, { wind: level, live: true, danger: 0, over: 0, waiting: false, t });
  const fx = cx - S * 0.2 + Math.sin(t * 0.7) * S * 0.2;
  paintFruit(ctx, null, 5, fx, bp.rim - S * 0.14, S * 0.09, 0, 0, 'calm');
  paintSparrow(ctx, fx, bp.rim - S * 0.21, Math.max(16, S * 0.14), { flip: 1, flap: 0.7, beat: t * 20, strain: 0.5, talk: false, blink: false, scared: false, t });
  if (p) paintTable(ctx, cx + S * 0.62, floor + 4, Math.min(w - cx - S * 0.62 - 8, S * 0.8), DECORS.slice(0, decorCount(p)), p.baskets, t);
}
