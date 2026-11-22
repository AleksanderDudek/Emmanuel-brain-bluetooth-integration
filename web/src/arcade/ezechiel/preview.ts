/**
 * Rzeka Ezechiela around play: the lobby's hero picture and the Games tab's card (the valley, the gate, the river at
 * the knees, the figure with its leaves, the trees with the player's leaves), and the intro scene while the reference
 * is taken (the first light kindling over the dry valley, the door-light in the gate, the water trickling to the
 * figure's feet).  Each size bakes its layers once and keeps them; a frame composes them.
 */
import { NO_INSETS } from '../kit/mobile';
import { layout, type Layout } from './layout';
import type { EzechielProgress } from './meta';
import { bakeDust, bakeFigure, bakeLand, bakeTree, leafShape, treeGeo, treeSpecs, LEAF, LEAF_HI, glow, type Layer, type TreeGeo } from './paint';
import { drawScene, leavesOn } from './render';
import { placePoints } from './content';
import { figPt } from './layout';

interface Baked { L: Layout; land: Layer | null; fig: Layer | null; dust: Layer | null; trees: { geo: TreeGeo; layer: Layer | null }[]; key: string }

/** A layout for a picture without the play's words: the whole canvas is the stage. */
function pictureLayout(w: number, h: number): Layout {
  const base = layout(Math.max(120, w), Math.max(80, h), NO_INSETS, true);
  const tall = h >= w;
  const H = Math.max(40, Math.min(h * (tall ? 0.78 : 0.84), w * 1.3));
  const top = h - H - (tall ? h * 0.1 : h * 0.06);
  return {
    ...base, w, h, shape: tall ? 'tall' : 'desk', top: 0, bottom: h, left: 0, right: w,
    stage: { x: 0, y: 0, w, h }, fig: { cx: w * (tall ? 0.5 : 0.5), top, H }, horizon: top + 0.22 * H,
    band: { x: 0, y: h, w: 0, h: 0 }, list: { x: -100, y: -100, w: 0, h: 0 },
  };
}

const cache = new Map<string, Baked>();

function baked(w: number, h: number, dpr: number, leaves: number, dawn: number): Baked {
  const key = `${w}x${h}@${dpr}:${leaves}:${dawn}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const L = pictureLayout(w, h);
  const trees = treeSpecs(L).map(s => ({ geo: treeGeo(s), layer: null as Layer | null }));
  const caps = trees.map(tr => tr.geo.leaves.length);
  trees.forEach((tr, k) => { tr.layer = bakeTree(tr.geo, dpr, 0, leavesOn(caps, k, leaves), leaves >= 24 && k < 2 ? 1 : 0); });
  const b: Baked = { L, land: bakeLand(L, dpr, leaves >= 24 ? 0.6 : 0.2, dawn), fig: bakeFigure(L, dpr), dust: bakeDust(L, dpr), trees, key };
  if (cache.size > 8) cache.delete(cache.keys().next().value as string);
  cache.set(key, b);
  return b;
}

const dprOf = (ctx: CanvasRenderingContext2D, w: number): number => Math.max(1, Math.min(2, ctx.canvas.width / Math.max(1, w)));

/**
 * The lobby's picture and the card art: the player's world when `p` is given (their leaves on the trees and on the
 * places they pray for), a generic one on the cards.
 */
export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: EzechielProgress): void {
  if (w < 4 || h < 4) return;
  const dpr = dprOf(ctx, w);
  const leaves = p ? Math.min(60, Math.max(10, Math.round(p.leaves / 4) * 4)) : 16;
  const B = baked(w, h, dpr, leaves, 1);
  const L = B.L;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (B.land) ctx.drawImage(B.land, 0, 0, w, h);
  else {
    ctx.fillStyle = '#e4c999';
    ctx.fillRect(0, 0, w, h);
  }
  const level = 2.15 + 0.08 * Math.sin(t * 0.4);
  drawScene(ctx, L, {
    time: t, water: level, lift: 0, dust: { above: 0.25, below: 0.25, front: 0 }, washK: 0, goldK: 0.4 + 0.4 * Math.sin(t * 0.9), mist: 0,
    fig: B.fig, dust_: B.dust, trees: B.trees, sil: null, farK: 0.2, markReached: 2, lineK: 1, leavesGreen: Math.min(1, leaves / 20), reduced: false,
    finale: false,
  });
  // the leaves the player lays most, resting on their places
  const places = p ? (Object.entries(p.laid) as [keyof EzechielProgress['laid'], number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k) : ['heart' as const];
  for (const pl of places) {
    for (const [x, y] of placePoints(pl)) {
      const q = figPt(L, x, y);
      glow(ctx, '#e6ffb8', q.x, q.y, 0.07 * L.fig.H, 0.55);
      leafShape(ctx, q.x, q.y, -0.6, 0.05 * L.fig.H, LEAF, LEAF_HI);
    }
  }
  ctx.restore();
}

/** The intro (calibration): the first light comes over the dry valley; the door-light kindles; the water trickles. */
export class EzechielIntro {
  private time = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: EzechielProgress | undefined, dpr: number): void {
    this.time += dt;
    const dawn = Math.round((0.2 + 0.8 * Math.max(0, Math.min(1, p))) * 8) / 8;
    const B = baked(w, h, dpr, progress ? Math.min(60, Math.round(progress.leaves / 4) * 4) : 0, dawn);
    const L = B.L;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (B.land) ctx.drawImage(B.land, 0, 0, w, h);
    else {
      ctx.fillStyle = '#3a4f7a';
      ctx.fillRect(0, 0, w, h);
    }
    drawScene(ctx, L, {
      time: this.time, water: 0.05 + 0.15 * p, lift: 0, dust: { above: 1, below: 1, front: 0 }, washK: 0, goldK: 0, mist: 0, fig: B.fig, dust_: B.dust,
      trees: B.trees, sil: null, farK: 0, markReached: 0, lineK: 1, leavesGreen: 0, reduced: false, finale: false, figAlpha: 0.35 + 0.65 * p,
    });
    ctx.restore();
  }
}
