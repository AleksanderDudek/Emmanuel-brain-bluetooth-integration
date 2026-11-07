/**
 * Where Anioł Stróż's play view puts things (CSS px), for phones upright and on their side and for
 * desktops.  The runner's standard HUD covers the top (the Mendi panel on the left, the score on the
 * right, down to `hudTop`); its bottom strip holds the block banner and the simulator button.  So:
 *
 *   wide    a desktop or a tablet on its side: the window (the band's last 40 s in its sky, a star a
 *           second on its sill) hangs at the top between the panel and the score; the room below hudTop
 *   tall    a phone upright: the window under the HUD, full width; the room under it
 *   short   a phone on its side (very little height): the room takes the right of the screen beside
 *           the panel, the window sits under the panel on the left when there is room for it
 *
 * The room's scale S (px per u) fits the bed, the angel above it and the reach on both sides.
 */
import { clamp } from '../kit/juice';

/** the runner's top bar and its bottom strip (the banner, the simulator's button) */
export const TOP = 58;
export const BOTTOM = 62;

export interface Rect { x: number; y: number; w: number; h: number }

export type Mode = 'wide' | 'tall' | 'short';

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  mode: Mode;
  tall: boolean;
  /** px per u of the room */
  S: number;
  /** the bed's centre and the floor line */
  cx: number;
  floorY: number;
  /** the window's sky (the band's curve) and its sill (the stars, one a second); w 0 = no window */
  win: Rect;
  sill: Rect;
  /** the top of the room's play (below the standard HUD) and the left edge of the room */
  roomTop: number;
  roomX0: number;
  /** where cards (toasts, the story, the dawn) centre */
  cardY: number;
}

export function layout(w: number, h: number, hudTop = 190): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 0.9;
  const top = Math.max(TOP, hudTop);
  const short = !tall && H - top - BOTTOM < 230;
  const floorDepth = short ? 12 : Math.max(24, 28 * u);
  const floorY = H - BOTTOM - floorDepth;
  if (short) {
    // a phone on its side: the room beside the panel, the window under the panel when it fits
    const roomX0 = Math.min(W * 0.42, 350);
    const winH = clamp(H - top - BOTTOM - 22, 0, 46);
    const win = winH >= 22 ? { x: 16, y: top + 2, w: roomX0 - 28, h: winH } : { x: 0, y: 0, w: 0, h: 0 };
    const sill = { x: win.x, y: win.y + win.h + 2, w: win.w, h: win.w ? 12 : 0 };
    const roomTop = TOP + 4;
    const S = clamp(Math.min((W - roomX0) / (2 * 4.6), (floorY - roomTop - 2) / 3.3), 16, 92);
    return { w: W, h: H, u, mode: 'short', tall, S, cx: roomX0 + (W - roomX0) / 2, floorY, win, sill, roomTop, roomX0, cardY: roomTop + 26 * u };
  }
  // a desktop: the window hangs between the panel and the score when there is room for it
  const left = Math.min(W * 0.36, 360), right = 150;
  const mid = W - left - right;
  if (!tall && mid >= 360 && top - TOP >= 70) {
    const ww = Math.min(mid - 24, 560 * u);
    const sillH = 16 * u;
    const winH = clamp(top - TOP - sillH - 14, 40, 80 * u);
    const win = { x: left + (mid - ww) / 2, y: TOP + 4, w: ww, h: winH };
    const sill = { x: win.x, y: win.y + win.h + 3, w: win.w, h: sillH };
    const roomTop = Math.max(top, sill.y + sill.h + 6);
    const S = clamp(Math.min(W / (2 * 5.2), (floorY - roomTop - 4) / 3.4), 22, 92);
    return { w: W, h: H, u, mode: 'wide', tall, S, cx: W / 2, floorY, win, sill, roomTop, roomX0: 0, cardY: roomTop + Math.min(70 * u, (floorY - roomTop) * 0.22) };
  }
  // upright (or narrow): the window under the HUD, the room under it
  const win = { x: 18, y: top + 2, w: W - 36, h: (tall ? 46 : 40) * u };
  const sill = { x: win.x, y: win.y + win.h + 3, w: win.w, h: 15 * u };
  const roomTop = sill.y + sill.h + 6;
  // upright, the Zmory step in from beyond the screen's edges: the room is drawn larger
  const S = clamp(Math.min(W / (2 * (tall ? 3.85 : 5.2)), (floorY - roomTop - 4) / 3.4), 22, 92);
  return { w: W, h: H, u, mode: 'tall', tall, S, cx: W / 2, floorY, win, sill, roomTop, roomX0: 0, cardY: roomTop + Math.min(70 * u, (floorY - roomTop) * 0.22) };
}
