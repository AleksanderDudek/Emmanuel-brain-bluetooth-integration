/**
 * What every picture of Każdy włos is drawn from (DESIGN.md §15), and the camera that frames a scene's view in the
 * picture's box: a world point at the box's middle and a scale (px per world unit), so a world draws itself in its
 * own units under one transform.
 */
import type { HairColour, SceneId } from './content';
import type { Rect } from './geo';

export interface WorldState {
  scene: SceneId;
  /** the scene's growth as drawn (0..1) */
  g: number;
  /** rest's deepening (0..1): warmth, colour, sheen */
  deep: number;
  /** the light at the growing point (0..1, 0.5 at the threshold) */
  light: number;
  /** the scene grows right now (a sighted push, focused) */
  growing: boolean;
  time: number;
  colour: HairColour;
  /** seconds of growth in a grown scene that stays (a gentle sheen) */
  after: number;
  /** rest's breath (0 out … 1 in), 0.5 outside rest */
  breath: number;
  blind: boolean;
  reduced: boolean;
  /** screen px per world unit (line widths and detail follow it) */
  px: number;
}

export interface Cam { cx: number; cy: number; s: number }

/** The camera that fits a view into a box (contained, centred). */
export function camFor(view: Rect, box: Rect): Cam {
  const s = Math.min(box.w / view.w, box.h / view.h);
  return { cx: view.x + view.w / 2, cy: view.y + view.h / 2, s };
}

/** The screen point of a world point under a camera in a box. */
export function toScreen(cam: Cam, box: Rect, x: number, y: number): { x: number; y: number } {
  return { x: box.x + box.w / 2 + (x - cam.cx) * cam.s, y: box.y + box.h / 2 + (y - cam.cy) * cam.s };
}

/** A camera between two (the scale eased in log space, so a zoom feels even). */
export function camLerp(a: Cam, b: Cam, k: number): Cam {
  return { cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k) };
}

/** Set a context's transform to a camera in a box (CSS px × dpr). */
export function applyCam(ctx: CanvasRenderingContext2D, cam: Cam, box: Rect, dpr: number): void {
  ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (box.x + box.w / 2 - cam.cx * cam.s), dpr * (box.y + box.h / 2 - cam.cy * cam.s));
}
