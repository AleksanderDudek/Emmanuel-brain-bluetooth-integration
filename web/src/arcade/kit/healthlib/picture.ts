/**
 * One of a library's pictures painted on its own, outside play (DESIGN.md §24, Każdy włos's picture.ts): the lobby's
 * hero, the card art, the calibration intro and the tiles of the library — a scene's picture through its camera in a
 * box, at a growth, with its world's still layer baked once per box (a small cache) and what grows drawn on top.
 */
import { applyCam, camFor, type Rect } from './camera';
import { drawLensRim, layer, lensGround, lensPath, lensShade, type Layer } from './paint';
import type { HealthLibrary, WorldState } from './spec';

export class PictureCache {
  private readonly bases = new Map<string, Layer | null>();

  base(lib: HealthLibrary, scene: string, box: Rect, dpr: number, look: string): Layer | null {
    const sc = lib.scenes[scene];
    const variant = sc.variant ?? '';
    const key = `${lib.id}|${sc.world}|${variant}|${sc.view.x},${sc.view.y},${sc.view.w},${sc.view.h}|${Math.round(box.w)}x${Math.round(box.h)}@${dpr}|${look}`;
    if (!this.bases.has(key)) {
      if (this.bases.size > 16) this.bases.clear();
      const cam = camFor(sc.view, box);
      const L = layer(box.w, box.h, dpr);
      const world = lib.worlds[sc.world];
      if (L && world) {
        const c = L.ctx;
        c.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (box.w / 2 - cam.cx * cam.s), dpr * (box.h / 2 - cam.cy * cam.s));
        try {
          world.bake(c, variant, look);
        } catch (err) {
          console.error(`healthlib: ${lib.id} world ${sc.world} bake failed`, err);
        }
      }
      this.bases.set(key, L?.c ?? null);
    }
    return this.bases.get(key) ?? null;
  }
}

export interface PaintOpts { deep?: number; light?: number; growing?: boolean; after?: number; breath?: number }

/**
 * Paint a scene's picture into a box of the context (CSS px, the context's transform at dpr): the lens for tissue,
 * the still layer, what has grown by `g`.
 */
export function paintScene(ctx: CanvasRenderingContext2D, cache: PictureCache, lib: HealthLibrary, box: Rect, dpr: number, scene: string, g: number, look: string, time: number, opts: PaintOpts = {}): void {
  const sc = lib.scenes[scene];
  const world = sc ? lib.worlds[sc.world] : undefined;
  if (!sc || !world) return;
  const cam = camFor(sc.view, box);
  const lens = world.lens;
  const st: WorldState = {
    scene, g, deep: opts.deep ?? 0.3, light: opts.light ?? 0.6, growing: opts.growing ?? false, time, after: opts.after ?? 0, breath: opts.breath ?? 0.5,
    blind: false, reduced: false, px: cam.s, look,
  };
  const R = Math.max(8, Math.min(box.w, box.h) * 0.05);
  ctx.save();
  if (lens) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clip(lensPath(box.x, box.y, box.w, box.h, R));
    lensGround(ctx, box.x, box.y, box.w, box.h);
  }
  applyCam(ctx, cam, box, dpr);
  const base = cache.base(lib, scene, box, dpr, look);
  if (base) ctx.drawImage(base, cam.cx - box.w / 2 / cam.s, cam.cy - box.h / 2 / cam.s, box.w / cam.s, box.h / cam.s);
  try {
    world.draw(ctx, st);
  } catch (err) {
    console.error(`healthlib: ${lib.id} scene ${scene} draw failed`, err);
  }
  if (lens) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lensShade(ctx, box.x, box.y, box.w, box.h);
  }
  ctx.restore();
  if (lens) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLensRim(ctx, box.x, box.y, box.w, box.h, R);
  }
}
