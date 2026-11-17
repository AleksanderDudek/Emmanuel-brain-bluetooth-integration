/**
 * One of Każdy włos's pictures painted on its own, outside play (DESIGN.md §15): the lobby's hero, the card art, the
 * calibration intro and the tiles of the library — a scene's picture through its camera in a box, at a growth, with
 * its still layer baked once per box (a small cache) and what grows drawn on top.
 */
import { SCENE, type HairColour, type SceneId } from './content';
import { NECK, type Rect } from './geo';
import { drawLensRim, layer, lensGround, lensPath, lensShade, type Layer } from './paint';
import { applyCam, camFor, type WorldState } from './world';
import { StrandLayer, bakeAbove, bakeSkin, drawAbove, drawSkin } from './world-above';
import { bakeDermis, bakeEpidermis, drawFollicleOver, drawFollicleUnder } from './world-follicle';
import { bakeHead, drawHead, headLift } from './world-head';
import { bakeSection, drawSection, type SecVariant } from './world-section';

export class PictureCache {
  private readonly bases = new Map<string, Layer | null>();
  readonly strands = new StrandLayer();

  base(scene: SceneId, box: Rect, dpr: number, colour: HairColour, part: 'under' | 'over' = 'under'): Layer | null {
    const sc = SCENE[scene];
    const variant = sc.world === 'head' ? (scene === 'glowa' ? 'bare' : 'ghost')
      : sc.world === 'section' ? (scene === 'wyrastanie' ? 'noshaft' : scene === 'mozaika' ? 'bare' : scene === 'naskorek' ? 'epi' : 'anagen') : 'one';
    const key = `${sc.world}|${part}|${variant}|${sc.view.x},${sc.view.y}|${Math.round(box.w)}x${Math.round(box.h)}@${dpr}|${colour}`;
    if (!this.bases.has(key)) {
      if (this.bases.size > 16) this.bases.clear();
      const cam = camFor(sc.view, box);
      const L = layer(box.w, box.h, dpr);
      if (L) {
        const c = L.ctx;
        c.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (box.w / 2 - cam.cx * cam.s), dpr * (box.h / 2 - cam.cy * cam.s));
        if (sc.world === 'head') bakeHead(c, variant === 'ghost' ? 0.09 : 0);
        else if (sc.world === 'above') bakeAbove(c);
        else if (sc.world === 'skin') bakeSkin(c);
        else if (sc.world === 'section') bakeSection(c, variant as SecVariant, colour);
        else if (part === 'over') bakeEpidermis(c);
        else bakeDermis(c);
      }
      this.bases.set(key, L?.c ?? null);
    }
    return this.bases.get(key) ?? null;
  }
}

/**
 * Paint a scene's picture into a box of the context (CSS px, the context's transform at dpr): the lens for the
 * tissues, the still layer, what has grown by `g`.
 */
export function paintScene(ctx: CanvasRenderingContext2D, cache: PictureCache, box: Rect, dpr: number, scene: SceneId, g: number, colour: HairColour, time: number, opts: { deep?: number; light?: number; growing?: boolean } = {}): void {
  const sc = SCENE[scene];
  const cam = camFor(sc.view, box);
  const lens = sc.world !== 'head' && sc.world !== 'above';
  const st: WorldState = {
    scene, g, deep: opts.deep ?? 0.3, light: opts.light ?? 0.6, growing: opts.growing ?? false, time, colour, after: 0, breath: 0.5,
    blind: false, reduced: false, px: cam.s,
  };
  const R = Math.max(8, Math.min(box.w, box.h) * 0.05);
  ctx.save();
  if (lens) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clip(lensPath(box.x, box.y, box.w, box.h, R));
    lensGround(ctx, box.x, box.y, box.w, box.h);
  }
  applyCam(ctx, cam, box, dpr);
  const lift = sc.world === 'head' ? headLift(scene, g) : 0;
  if (lift) {
    ctx.translate(NECK[0], NECK[1]);
    ctx.rotate(lift);
    ctx.translate(-NECK[0], -NECK[1]);
  }
  const base = cache.base(scene, box, dpr, colour);
  if (base) ctx.drawImage(base, cam.cx - box.w / 2 / cam.s, cam.cy - box.h / 2 / cam.s, box.w / cam.s, box.h / cam.s);
  if (sc.world === 'head') drawHead(ctx, st);
  else if (sc.world === 'above') drawAbove(ctx, st, cache.strands, box, cam, dpr);
  else if (sc.world === 'skin') drawSkin(ctx, st);
  else if (sc.world === 'section') drawSection(ctx, st);
  else {
    drawFollicleUnder(ctx, st);
    const over = cache.base(scene, box, dpr, colour, 'over');
    if (over) ctx.drawImage(over, cam.cx - box.w / 2 / cam.s, cam.cy - box.h / 2 / cam.s, box.w / cam.s, box.h / cam.s);
    drawFollicleOver(ctx, st);
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
