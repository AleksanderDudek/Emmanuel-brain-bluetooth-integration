/**
 * Ogród o świcie's lobby picture and card art (DESIGN.md §23): the walled garden at the first light — the pond with
 * the sky and the olive in it, the rose sky warming behind the wall, a paper boat with its small light on the water, a
 * few flowers opening by the pond.  The lobby shows the player's garden a little fuller as flowers have grown in it.
 * The same scenery as the session (scenery.ts), drawn from a still camera; the dawn breathes slowly.
 */
import { clamp } from '../kit/juice';
import type { OgrodProgress } from './meta';
import { BLOOMS, TAU, glow, hash, rgba } from './paint';
import { Scenery, type Cam } from './scenery';
import { POND } from './world';

let scene: Scenery | null = null;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, p?: OgrodProgress): void {
  if (!scene) scene = new Scenery(false);
  const S = scene;
  ctx.save();
  const d = ctx.getTransform().a || 1;
  const k = 0.72 + 0.06 * Math.sin(time * 0.12);
  // the garden from the bench: the pond in the middle, the olive at the right, the wall behind — at least 1.35 units
  // wide, the band 0.6 high in a wide picture.  A desk's hero is as tall as the lobby's card beside it (the way's
  // section makes it very tall) and is seen from its top: the garden stands in a frame at most as tall as it is wide
  // at the top, and the lawn runs on below it
  const hv = Math.min(h, w);
  const s = Math.min(w / 1.35, hv / 0.6);
  const c: Cam = { s, x: POND.x + 0.18, y: Math.min(0.6, 1.08 - hv / (2 * s)), vx: w / 2, vy: hv / 2 };
  S.sky(ctx, w, h, k, time, c, d);
  S.beyond(ctx, k, c, d);
  S.garden(ctx, k, c, d);
  S.olive(ctx, k, c, d, time);
  S.ground(ctx, k, c, d);
  S.pond(ctx, k, c, d, time, 0);
  S.vessel(ctx, k, c, d, 3, 0.5 + 0.5 * Math.sin(time * 0.9));
  S.setWorld(ctx, c, d);
  // a paper boat with its light, drifting slowly
  const bx = POND.x + 0.1 + 0.06 * Math.sin(time * 0.15), by = POND.y - 0.03;
  ctx.fillStyle = '#f5efe2';
  ctx.beginPath();
  ctx.moveTo(bx - 0.026, by);
  ctx.lineTo(bx + 0.026, by);
  ctx.lineTo(bx + 0.017, by + 0.011);
  ctx.lineTo(bx - 0.017, by + 0.011);
  ctx.closePath();
  ctx.moveTo(bx - 0.013, by);
  ctx.lineTo(bx, by - 0.022);
  ctx.lineTo(bx + 0.013, by);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, S.sprites.warm, bx, by - 0.008, 0.05, 0.75);
  ctx.globalCompositeOperation = 'source-over';
  // flowers by the near rim (more as the player's garden has grown)
  const grown = p ? clamp(p.flowers / 60) : 0.4;
  const n = 7 + Math.round(10 * grown);
  for (let i = 0; i < n; i++) {
    const an = Math.PI * (0.55 + 0.45 * (i / n)) + 0.05 * hash(i);
    const x = POND.x + Math.cos(an) * POND.rx * (1.08 + 0.1 * hash(i + 3)), y = POND.y + Math.sin(an) * POND.ry * 1.25 + 0.015;
    const col = BLOOMS[i % BLOOMS.length];
    const r = 0.011 * (0.9 + 0.3 * hash(i + 5));
    const open = 0.6 + 0.4 * Math.sin(time * 0.4 + i) ** 2;
    ctx.strokeStyle = '#4f7a46';
    ctx.lineWidth = 1 / s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 0.025);
    ctx.stroke();
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * TAU + i;
      const L = r * (0.5 + 0.6 * open);
      ctx.fillStyle = q % 2 ? col.deep : col.petal;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * L * 0.55, y - 0.025 + Math.sin(a) * L * 0.42, L * 0.55, L * 0.3, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = col.heart;
    ctx.beginPath();
    ctx.arc(x, y - 0.025, r * 0.22, 0, TAU);
    ctx.fill();
  }
  S.air(ctx, k, c, d, time);
  S.light(ctx, k, c, d, time, w, h, 0);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  // a soft vignette
  const vg = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, rgba('#06081a', 0.45));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
