/**
 * Where Wzlot's play view puts things (CSS px), for phones upright and on their side and for
 * desktops.  The runner's standard HUD covers the top (the Mendi panel on the left, the score on
 * the right, down to `hudTop`): the play — the eaglet, the hills ahead, the sun's gauge — stays
 * below it, and only the sky runs under it.  The camera (render.ts) fits the ground and the eaglet
 * into the band between `top` and `bottom`.
 */
import { clamp } from '../kit/juice';

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  /** the band the play lives in (px from the canvas top) */
  top: number;
  bottom: number;
  /** where the eaglet sits across the screen (px) */
  ex: number;
  /** the fewest world units (sh) across the screen: an upright phone still sees the hill ahead */
  minWorldW: number;
  /** the sun's arc: its left and right ends and its height (px) */
  arcX0: number;
  arcX1: number;
  arcTop: number;
  arcH: number;
  /** the cards' centre (the story, the tally) */
  cardY: number;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = clamp(Math.min(W, H) / 430, 0.8, 1.25);
  const tall = W / H < 0.9;
  const top = clamp(hudTop, 0, H * 0.45);
  const bottom = H - Math.max(8, H * (tall ? 0.07 : 0.03));
  const span = bottom - top;
  return {
    w: W, h: H, u, tall, top, bottom,
    ex: W * (tall ? 0.24 : 0.3),
    minWorldW: tall ? 1.7 : 2.6,
    arcX0: W * 0.1, arcX1: W * 0.94, arcTop: top + 26 * u, arcH: span * (tall ? 0.22 : 0.3),
    cardY: top + span * (tall ? 0.42 : 0.45),
  };
}
