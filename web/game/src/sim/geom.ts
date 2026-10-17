/** Geometry helpers for circles moving among axis-aligned walls. */

export interface Rect { x: number; y: number; w: number; h: number }

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Push a circle out of a rectangle. Returns the corrected position, or null if they do not overlap. */
export function pushOut(x: number, y: number, r: number, w: Rect): [number, number] | null {
  const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h);
  const dx = x - cx, dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2), k = (r - d) / d;
    return [x + dx * k, y + dy * k];
  }
  // centre inside the rectangle: leave by the nearest side
  const left = x - w.x, right = w.x + w.w - x, top = y - w.y, bottom = w.y + w.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return [w.x - r, y];
  if (m === right) return [w.x + w.w + r, y];
  if (m === top) return [x, w.y - r];
  return [x, w.y + w.h + r];
}

export function pointInRect(x: number, y: number, w: Rect, pad = 0): boolean {
  return x >= w.x - pad && x <= w.x + w.w + pad && y >= w.y - pad && y <= w.y + w.h + pad;
}

/** True when the segment between two points does not pass through any wall (padded by `pad`). */
export function lineOfSight(ax: number, ay: number, bx: number, by: number, walls: readonly Rect[], pad = 0): boolean {
  const len = Math.sqrt(dist2(ax, ay, bx, by));
  const steps = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 1; i < steps; i++) {
    const t = i / steps, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    for (const w of walls) if (pointInRect(x, y, w, pad)) return false;
  }
  return true;
}
