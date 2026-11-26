/**
 * Każdy włos's pictures inside Rozkwit (DESIGN.md §15, §24): Każdy włos is not on the health engine, so its
 * follicle and its head in profile come in through this adapter — WorldPainters that call Każdy włos's own world
 * functions (world-follicle.ts, world-head.ts) in Każdy włos's units, under the engine's camera.
 *
 * Why not wlosy's picture.ts `paintScene` (it paints a whole scene into a box with its own camera and lens): the
 * engine fits a view into the picture's box, which is wider or taller than the view, and nothing a world is told
 * gives that box — so a picture painted into the view's box would sit in a lens narrower than every other scene's.
 * Here the engine draws the lens over the whole box (as for every tissue) and the follicle is painted in it as
 * Każdy włos's own renderer paints it: the dermis baked as the still layer, what grows drawn, then the epidermis
 * laid over it.  The head's still layer turns with the head as it lifts ("Cała głowa", Ps 3:3), so it is kept by
 * the adapter (a layer under the camera of its frame, redrawn only when the camera needs more of it).
 *
 * The hair takes one colour here (brown, its sheen golden on the dark ground): Rozkwit's look is the figure.
 */
import { CROWN, NECK } from '../wlosy/geo';
import { SCENE, type HairColour, type SceneId } from '../wlosy/content';
import type { WorldState as HairState } from '../wlosy/world';
import { bakeDermis, bakeEpidermis, drawFollicleOver, drawFollicleUnder, folFocus } from '../wlosy/world-follicle';
import { bakeHead, drawHead, headLift } from '../wlosy/world-head';
import { layer } from '../kit/healthlib/paint';
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';

/** The overlap of two rectangles (w or h ≤ 0 when none). */
function meet(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y };
}

/** Where Każdy włos's still parts lie (its units): the epidermis band over a follicle, the head with its glows. */
const EPI_BOUNDS: Rect = { x: -170, y: -28, w: 340, h: 58 };
const HEAD_BOUNDS: Rect = { x: -100, y: -108, w: 205, h: 196 };

/** The hair's colour in Rozkwit (Każdy włos's palette). */
export const HAIR_COLOUR: HairColour = 'brown';

/** Każdy włos's scenes Rozkwit borrows, by Rozkwit's scene id. */
export type HairMap = ReadonlyMap<string, SceneId>;

const isScene = (s: string): s is SceneId => s in SCENE;

function hairState(st: WorldState, scene: SceneId): HairState {
  return {
    scene, g: st.g, deep: st.deep, light: st.light, growing: st.growing, time: st.time, colour: HAIR_COLOUR, after: st.after,
    breath: st.breath, blind: st.blind, reduced: st.reduced, px: st.px,
  };
}

/**
 * A still layer kept by a world itself (under the camera of the frame it was drawn in): drawn in world units, so a
 * glide, a dive's zoom or the head's turn moves it with the picture; redrawn when the camera needs more of it (a
 * closer zoom than 15 % above its own, or a part of the canvas it does not cover) or the key changes.
 */
export class OwnLayer {
  private c: HTMLCanvasElement | null = null;
  private key = '';
  private s = 0;
  private r = { x: 0, y: 0, w: 0, h: 0 };

  /**
   * Call with the camera's transform set (no extra rotation yet); then `put` under whatever transform follows.
   * `bounds`: where the layer's content lies (world units) — the layer covers only what of it is on the canvas.
   */
  ensure(ctx: CanvasRenderingContext2D, key: string, bounds: Rect, paint: (c: CanvasRenderingContext2D) => void): void {
    const m = ctx.getTransform();
    let s = Math.abs(m.a) || 1;
    // (s: device px per world unit wanted now; this.s: what the layer was drawn for)
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const vis = { x: -m.e / s, y: -m.f / s, w: W / s, h: H / s };
    const need = meet(vis, bounds);
    if (need.w <= 0 || need.h <= 0) return;
    const covers = this.r.x <= need.x + 0.5 / s && this.r.y <= need.y + 0.5 / s && this.r.x + this.r.w >= need.x + need.w - 0.5 / s && this.r.y + this.r.h >= need.y + need.h - 0.5 / s;
    if (this.c && this.key === key && s <= this.s * 1.15 && covers) return;
    // a margin of a fifth round the visible part (within the content), so a slow glide does not redraw it each frame
    const r = meet({ x: need.x - need.w * 0.2, y: need.y - need.h * 0.2, w: need.w * 1.4, h: need.h * 1.4 }, bounds);
    // never more than ~6 megapixels (a QHD canvas at 2×): the still parts are soft, a little less sharpness is fine
    const want = s;
    const px = r.w * s * r.h * s;
    if (px > 6e6) s *= Math.sqrt(6e6 / px);
    const L = layer(Math.ceil(r.w * s), Math.ceil(r.h * s), 1);
    if (!L) return;
    L.ctx.setTransform(s, 0, 0, s, -r.x * s, -r.y * s);
    paint(L.ctx);
    this.c = L.c;
    this.key = key;
    this.s = want;
    this.r = r;
  }

  put(ctx: CanvasRenderingContext2D): void {
    if (this.c) ctx.drawImage(this.c, this.r.x, this.r.y, this.r.w, this.r.h);
  }
}

/** One follicle in detail (Każdy włos's depth 2, through the lens). */
export function follicleWorld(map: HairMap): WorldPainter {
  const over = new OwnLayer();
  const id = (s: string): SceneId => {
    const t = map.get(s) ?? s;
    return isScene(t) ? t : 'barwa';
  };
  return {
    depth: 2,
    lens: true,
    bake: ctx => bakeDermis(ctx),
    draw(ctx, st) {
      const scene = id(st.scene);
      const hs = hairState(st, scene);
      drawFollicleUnder(ctx, hs);
      over.ensure(ctx, 'epi', EPI_BOUNDS, c => bakeEpidermis(c));
      over.put(ctx);
      drawFollicleOver(ctx, hs);
    },
    focusAt: (s, g) => folFocus(id(s), g),
  };
}

/** The head in profile (Każdy włos's depth 0, free on the ground), lifting calmly in "Cała głowa". */
export function headWorld(map: HairMap): WorldPainter {
  const still = new OwnLayer();
  const id = (s: string): SceneId => {
    const t = map.get(s) ?? s;
    return isScene(t) ? t : 'glowa';
  };
  return {
    depth: 0,
    lens: false,
    bake: () => {},
    draw(ctx, st) {
      const scene = id(st.scene);
      const ghost = scene !== 'glowa';
      still.ensure(ctx, ghost ? 'ghost' : 'bare', HEAD_BOUNDS, c => bakeHead(c, ghost ? 0.09 : 0));
      const lift = headLift(scene, st.g);
      ctx.save();
      if (lift) {
        ctx.translate(NECK[0], NECK[1]);
        ctx.rotate(lift);
        ctx.translate(-NECK[0], -NECK[1]);
      }
      still.put(ctx);
      drawHead(ctx, hairState(st, scene));
      ctx.restore();
    },
    focusAt: (s, g) => {
      const scene = id(s);
      const f = SCENE[scene].focus;
      return liftPt(f, headLift(scene, g));
    },
  };
}

/** A point of the head turned with it about the neck. */
export function liftPt(p: Pt, lift: number): Pt {
  if (!lift) return p;
  const dx = p[0] - NECK[0], dy = p[1] - NECK[1];
  return [NECK[0] + dx * Math.cos(lift) - dy * Math.sin(lift), NECK[1] + dx * Math.sin(lift) + dy * Math.cos(lift)];
}

/** The crown, turned as the head ends lifted (for a name that stays by it). */
export const CROWN_LIFTED: Pt = liftPt(CROWN, headLift('glowa', 1));
