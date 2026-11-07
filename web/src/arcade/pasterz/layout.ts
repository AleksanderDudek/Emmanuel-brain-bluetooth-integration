/**
 * Where Pasterz's play view puts things (CSS px), for phones upright and on their side and for
 * desktops.  The runner's standard HUD covers the top (the Mendi panel on the left, the score on
 * the right, down to `top` = env.hudTop()); its block banner and the simulator button sit at the
 * bottom.  The shepherd stands in the middle of the room between them; the ranking (Crowd City's
 * top list) sits at the right under the score; the tally card in the middle, clear of the banner.
 */
import { clamp } from '../kit/juice';

/** the runner's bottom strip (the block banner, the simulator button) */
export const BOTTOM = 66;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  /** the HUD's lower edge and the play room's bottom */
  top: number;
  bottom: number;
  /** px per metre of the hill for a lone shepherd (the camera zooms out as the flock grows) */
  S0: number;
  /** where the shepherd stands on the screen */
  cx: number;
  cy: number;
  /** the ranking box, the night's row of stars, the tally card */
  rank: Rect;
  stars: Rect;
  card: Rect;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = clamp(Math.min(W, H) / 430, 0.82, 1.2);
  const tall = W / H < 1;
  const top = clamp(hudTop, 0, H * 0.45);
  const bottom = H - BOTTOM;
  const room = Math.max(120, bottom - top);
  const S0 = clamp(Math.min(W, room * 1.15) / 15.5, 20, 46);
  const rw = Math.round((tall ? 136 : 160) * u);
  const rank: Rect = { x: W - 12 - rw, y: top + 4, w: rw, h: Math.round(112 * u) };
  const sw = Math.min(W - 32, 420 * u);
  const stars: Rect = { x: (W - sw) / 2, y: top + 8, w: sw, h: 30 * u };
  const cw = Math.min(W - 28, 390 * u), ch = Math.min(room - 70, 284 * u);
  const card: Rect = { x: (W - cw) / 2, y: top + Math.max(8, (room - 90 - ch) * 0.35), w: cw, h: ch };
  return { w: W, h: H, u, tall, top, bottom, S0, cx: W / 2, cy: top + room * 0.52, rank, stars, card };
}
