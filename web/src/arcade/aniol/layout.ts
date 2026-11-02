/**
 * Where Anioł Stróż's play view puts things (CSS px), for phones upright and on their side and for
 * desktops: the HUD's boxes (the status with the block's strategy and what the band drives, the
 * headline, the window whose sky holds the band's curve and whose sill holds its stars), the room's
 * scale (px per u), the floor line and the bed.  The runner's top strip (time, pause) and bottom
 * strip (the signal banner, the simulator button) stay clear of the HUD; the canvas is the room
 * above the runner's signal dock, so a phone on its side can leave very little height: there the
 * HUD becomes a column on the left and the room takes the rest.
 */
import { clamp } from '../kit/juice';

export const TOP = 64;
export const BOTTOM = 66;

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
  /** the status (block, strategy, what the band drives) at its tallest; the headline's right edge and top */
  status: Rect;
  scoreX: number;
  scoreY: number;
  /** the headline sits inside the status card's corner (upright screens) */
  scoreInStatus: boolean;
  /** the status card's lines: the strategy's and the band's at most */
  tipLines: number;
  driveLines: number;
  /** the window's sky (the band's curve) and its sill (the stars, one a second) */
  win: Rect;
  sill: Rect;
  /** the lowest HUD edge over the room, and where cards and the choice of gifts centre */
  hudBottom: number;
  cardY: number;
  /** the room's own top (below the HUD) and the x range it can use for cards */
  roomX0: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const scoreW = 120 * u;
  const short = !tall && H < 470;
  const floorDepth = short ? 14 : Math.max(26, 30 * u);
  const floorY = H - BOTTOM - floorDepth;
  if (short) {
    // a phone on its side: the HUD is a column on the left, the room the rest
    const colW = Math.min(W * 0.4, 300 * u);
    const winH = clamp((H - TOP - BOTTOM) * 0.22, 28, 50 * u);
    const sillH = 13 * u;
    const statusH = Math.max(60, H - TOP - BOTTOM - winH - sillH - 14);
    const status = { x: 12, y: TOP - 4, w: colW, h: statusH };
    const win = { x: 18, y: status.y + statusH + 6, w: colW - 12, h: winH };
    const sill = { x: win.x, y: win.y + winH + 2, w: win.w, h: sillH };
    const roomX0 = colW + 20;
    const S = clamp(Math.min((W - roomX0) / (2 * 4.4), (floorY - TOP + 6) / 3.6), 18, 92);
    const cx = roomX0 + (W - roomX0) / 2;
    return {
      w: W, h: H, u, mode: 'short', tall, S, cx, floorY, status, scoreX: W - 12, scoreY: TOP - 4, scoreInStatus: false,
      tipLines: 1, driveLines: 2, win, sill, hudBottom: TOP + 70 * u, cardY: TOP + 80 * u, roomX0,
    };
  }
  const statusWide = Math.min(W * 0.3, 330 * u);
  const mid = W - 32 - statusWide - scoreW - 32;
  const wide = !tall && mid >= 260 * u;
  let status: Rect, win: Rect;
  if (wide) {
    status = { x: 16, y: TOP + 2, w: statusWide, h: 150 * u };
    const ww = Math.min(mid, 560 * u);
    win = { x: 16 + statusWide + 16 + (mid - ww) / 2, y: TOP + 8, w: ww, h: 74 * u };
  } else {
    // upright or narrow: one full-width card, the headline in its top-right corner
    status = { x: 16, y: TOP + 2, w: W - 32, h: 158 * u };
    win = { x: 22, y: status.y + status.h + 10 * u, w: W - 44, h: (tall ? 60 : 50) * u };
  }
  const sill = { x: win.x, y: win.y + win.h + 3, w: win.w, h: 18 * u };
  const hudBottom = Math.max(wide ? win.y + win.h : status.y + status.h, sill.y + sill.h) + 8;
  // the room: the bed, the angel above it and the reach on both sides must fit (upright: the Zmory step in from beyond the screen)
  const S = clamp(Math.min(W / (2 * (tall ? 4.2 : 5.2)), (floorY - hudBottom - 6) / 3.5), 22, 92);
  return {
    w: W, h: H, u, mode: wide ? 'wide' : 'tall', tall, S, cx: W / 2, floorY, status, scoreX: W - 16 - (wide ? 0 : 6 * u), scoreY: TOP + 2,
    scoreInStatus: !wide, tipLines: 2, driveLines: 3, win, sill, hudBottom, cardY: win.y + win.h / 2 + 8 * u, roomX0: 0,
  };
}
