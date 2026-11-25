/**
 * The camera of the health visualisations (DESIGN.md §24, generalised from Każdy włos's world.ts, §15.4): every
 * picture is drawn in its world's own units; a scene frames a view of it, and the camera fits that view into the
 * picture's box (contained, centred) — a world point at the box's middle and a scale (px per world unit), so a world
 * draws itself under one transform.
 */

/** A point in a world's own units. */
export type Pt = readonly [number, number];
/** A rectangle: a view in world units, or a box on the screen in CSS px. */
export interface Rect { x: number; y: number; w: number; h: number }

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

/** The world point under a screen point (the inverse of toScreen). */
export function toWorld(cam: Cam, box: Rect, x: number, y: number): [number, number] {
  return [cam.cx + (x - box.x - box.w / 2) / cam.s, cam.cy + (y - box.y - box.h / 2) / cam.s];
}

/** A camera between two (the scale eased in log space, so a zoom feels even). */
export function camLerp(a: Cam, b: Cam, k: number): Cam {
  return { cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k) };
}

/** Set a context's transform to a camera in a box (CSS px × dpr). */
export function applyCam(ctx: CanvasRenderingContext2D, cam: Cam, box: Rect, dpr: number): void {
  ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (box.x + box.w / 2 - cam.cx * cam.s), dpr * (box.y + box.h / 2 - cam.cy * cam.s));
}
