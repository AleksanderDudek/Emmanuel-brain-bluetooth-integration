/**
 * Where Wzlot's play view puts things (CSS px), for phones upright and on their side and for
 * desktops, and how the camera turns world units (sh, rules.ts) into pixels.  The world is the
 * same on every screen: a wide screen sees it at its height, an upright phone through a narrower,
 * taller window, so the hills ahead read at the same size on both.  The runner's top strip (time,
 * pause) and its bottom strip (the signal banner, the simulator button) stay clear of the HUD.
 */
import { clamp } from '../kit/juice';

/** The runner's own UI: the top strip and the bottom strip. */
export const TOP = 64;
export const BOTTOM = 66;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  /** px per sh at zoom 1 */
  base: number;
  /** where the eaglet sits across the screen (px) and where the ground under it rests (px) */
  ex: number;
  gy: number;
  /** the highest the eaglet may be drawn before the camera zooms out (px) */
  ceiling: number;
  /** the status (block, tip, bar), its width; the score's right edge and top */
  status: Rect;
  scoreX: number;
  scoreY: number;
  /** the cards' centre */
  cardY: number;
  /** how far ahead the world is made (sh): the camera never shows past it */
  ahead: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const base = tall ? W / 1.9 : Math.min(H * 0.92, W / 2.1);
  const ex = W * (tall ? 0.3 : 0.28);
  const gy = H * (tall ? 0.7 : 0.74);
  const statusW = Math.min(W - 32 - 128 * u, tall ? W : W * 0.5, 440 * u);
  const status: Rect = { x: 16, y: TOP + 2, w: statusW, h: 96 * u };
  return {
    w: W, h: H, u, tall, base, ex, gy,
    ceiling: TOP + (tall ? 150 : 100) * u,
    status, scoreX: W - 16, scoreY: TOP + 2,
    cardY: tall ? H * 0.42 : H * 0.4,
    ahead: 3.7,
  };
}
