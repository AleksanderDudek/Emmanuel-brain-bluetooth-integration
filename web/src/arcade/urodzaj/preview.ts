/**
 * Urodzaj's picture for the lobby's hero and the game card.  In the lobby (with the player's
 * progress) the orchard at the end of the day: the village table as the player has set it, their
 * guests in their seats and the basket of the day beside it.  On the cards (no progress) the basket
 * in the morning orchard, a heap of fruit inside and the next fruit swaying on the olive twig.
 * Drawn every frame in the lobby, so the scene and the heap are sprites made once per size.
 */
import { fruit } from './content';
import { World } from './physics';
import { tablePoints, tableState, type UrodzajProgress } from './meta';
import { C, DAY, bakeScene, fruitArt, paintBasket, paintRim, paintVineLeaf } from './mosaic';
import { paintTable } from './table';

let bg: { key: string; c: HTMLCanvasElement } | null = null;

/** The picture's heap: a fixed set of fruit dropped into the basket and let settle once (physics.ts), then kept. */
const DROPS: readonly [number, number][] = [
  [6, -0.25], [5, 0.12], [7, 0.24], [3, -0.34], [4, -0.05], [2, 0.3], [5, -0.18], [1, 0.02], [3, 0.36], [2, -0.3], [8, 0.02], [4, 0.28], [1, -0.36],
];
let heap: { tier: number; x: number; y: number; angle: number }[] | null = null;

function settledHeap(): { tier: number; x: number; y: number; angle: number }[] {
  if (heap) return heap;
  const w = new World();
  DROPS.forEach(([tier, x], i) => {
    w.add(tier, x, 0.3 + i * 0.12);
    for (let k = 0; k < 40; k++) w.stepOnce();
  });
  for (let k = 0; k < 600; k++) w.stepOnce();
  w.merges.length = 0;
  heap = w.bodies.filter(b => !b.dead).map(b => ({ tier: b.tier, x: b.x, y: b.y, angle: b.angle }));
  return heap;
}

function scene(w: number, h: number, dpr: number, evening: boolean): HTMLCanvasElement {
  const key = `${w}|${h}|${dpr}|${evening}`;
  if (bg && bg.key === key) return bg.c;
  const tile = Math.max(5, Math.min(w, h) / 46);
  const b = bakeScene(w, h, dpr, h * (evening ? 0.3 : 0.24), tile, DAY, 0, 0);
  if (evening) {
    // the end of the day: a warm low light over the same orchard, a little lilac at the top
    const g = b.c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgba(142,127,168,.42)');
    sky.addColorStop(0.35, 'rgba(217,169,142,.28)');
    sky.addColorStop(1, 'rgba(60,40,50,.18)');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
  }
  bg = { key, c: b.c };
  return b.c;
}

/** The basket with its heap, at (cx, floorY), `s` px per W. */
function basket(ctx: CanvasRenderingContext2D, cx: number, floorY: number, s: number, dpr: number): void {
  const X = (x: number) => cx + x * s, Y = (y: number) => floorY - y * s;
  paintBasket(ctx, X, Y, s, 'back');
  for (const f of settledHeap()) {
    const r = fruit(f.tier).r * s;
    const art = fruitArt(f.tier, r, dpr);
    ctx.save();
    ctx.translate(X(f.x), Y(f.y));
    ctx.rotate(-f.angle);
    ctx.drawImage(art.c, -art.size / 2, -art.size / 2, art.size, art.size);
    ctx.restore();
  }
  paintBasket(ctx, X, Y, s, 'front');
  paintRim(ctx, X, Y, s);
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: UrodzajProgress): void {
  const dpr = ctx.getTransform().a || 1;
  if (p && p.sessions > 0) {
    ctx.drawImage(scene(w, h, dpr, true), 0, 0, w, h);
    const st = tableState(tablePoints(p));
    const tw = Math.min(w * 0.62, h * 1.1);
    paintTable(ctx, w * 0.42, h * 0.52, tw, { built: Math.max(1, st.built), guests: p.guests, t, bowl: Math.max(2, p.bestTier) });
    basket(ctx, w * 0.86, h * 0.92, Math.min(w * 0.2, h * 0.38), dpr);
    return;
  }
  ctx.drawImage(scene(w, h, dpr, false), 0, 0, w, h);
  const s = Math.min(w * 0.44, h * 0.56);
  const cx = w * 0.58, floorY = h * 0.92;
  basket(ctx, cx, floorY, s, dpr);
  // the olive twig over it and the next fruit swaying on its stem
  const twigY = floorY - 1.28 * s;
  ctx.strokeStyle = C.brown;
  ctx.lineWidth = Math.max(2, s * 0.012);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 0.6 * s, twigY + 3);
  ctx.quadraticCurveTo(cx, twigY - 5, cx + 0.6 * s, twigY + 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) paintVineLeaf(ctx, cx - 0.5 * s + (i / 5) * s, twigY - 2 + (i % 2) * 4, Math.max(3, s * 0.03), i % 2 ? 0.6 : -0.6);
  const sway = Math.sin(t * 1.2) * 0.04 * s;
  const tier = 4, r = fruit(tier).r * s;
  const hx = cx + 0.12 * s + sway, hy = floorY - 1.16 * s;
  ctx.lineWidth = Math.max(1.2, s * 0.006);
  ctx.beginPath();
  ctx.moveTo(cx + 0.12 * s, twigY);
  ctx.lineTo(hx, hy - r);
  ctx.stroke();
  const art = fruitArt(tier, r, dpr);
  ctx.drawImage(art.c, hx - art.size / 2, hy - art.size / 2, art.size, art.size);
}

