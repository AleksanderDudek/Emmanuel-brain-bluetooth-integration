/**
 * Where Dolina's play view puts things (CSS px), for phones upright and on their side and for
 * desktops: the HUD's boxes (the status with the block's strategy and what the band drives, the
 * headline, the ridge whose sky holds the band's curve and whose row of lanterns holds a lantern a
 * second), the scene's scale (px per u), the road's line and where the pilgrim runs on screen.  The
 * runner's top strip (time, pause) and bottom strip (the simulator's button) stay clear of the HUD;
 * the canvas is the valley above the runner's signal dock, so a phone on its side can leave very
 * little height: there the HUD becomes a column on the left and the valley takes the rest.
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
  /** px per u of the valley */
  S: number;
  /** the road's top line, and the pilgrim's x on screen */
  floorY: number;
  runX: number;
  /** the status card's box at its tallest; the headline's right edge and top */
  status: Rect;
  scoreX: number;
  scoreY: number;
  /** the headline sits inside the status card's corner (upright screens) */
  scoreInStatus: boolean;
  tipLines: number;
  driveLines: number;
  /** the ridge's sky (the band's curve) and its row of lanterns (one a second) */
  ridge: Rect;
  row: Rect;
  /** the lowest HUD edge over the valley, where cards centre, the valley's left edge */
  hudBottom: number;
  /** where the valley's free sky begins (below the pills on an upright phone) */
  sceneTop: number;
  cardY: number;
  x0: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const short = !tall && H < 470;
  const floorDepth = Math.max(30, 34 * u);
  const floorY = H - BOTTOM - floorDepth;
  if (short) {
    // a phone on its side: the status is a column on the left (above the simulator's button), the
    // ridge runs along the valley's top, the valley takes the rest
    const colW = Math.min(W * 0.36, 280 * u);
    const status = { x: 12, y: TOP - 4, w: colW, h: Math.max(60, H - TOP - 62) };
    const x0 = colW + 20;
    const scoreW = 92 * u;
    const ridge = { x: x0, y: TOP - 2, w: Math.max(120, W - x0 - scoreW - 20), h: 30 * u };
    const row = { x: ridge.x, y: ridge.y + ridge.h + 2, w: ridge.w, h: 12 * u };
    const hudBottom = row.y + row.h + 4;
    const fy = H - 34;
    const S = clamp(Math.min((W - x0) / 12, (fy - hudBottom) / 3.4), 18, 80);
    return {
      w: W, h: H, u, mode: 'short', S, floorY: fy, runX: x0 + (W - x0) * 0.24, status, scoreX: W - 12, scoreY: TOP - 4, scoreInStatus: false,
      tipLines: 2, driveLines: 2, ridge, row, hudBottom, sceneTop: hudBottom, cardY: hudBottom + 6 * u, x0,
    };
  }
  const scoreW = 120 * u;
  const statusWide = Math.min(W * 0.3, 330 * u);
  const mid = W - 32 - statusWide - scoreW - 32;
  const wide = !tall && mid >= 260 * u;
  let status: Rect, ridge: Rect;
  if (wide) {
    status = { x: 16, y: TOP + 2, w: statusWide, h: 150 * u };
    const rw = Math.min(mid, 560 * u);
    ridge = { x: 16 + statusWide + 16 + (mid - rw) / 2, y: TOP + 8, w: rw, h: 70 * u };
  } else {
    // upright or narrow: one full-width card, the headline in its top-right corner
    status = { x: 16, y: TOP + 2, w: W - 32, h: 158 * u };
    ridge = { x: 22, y: status.y + status.h + 10 * u, w: W - 44, h: (tall ? 54 : 46) * u };
  }
  const row = { x: ridge.x, y: ridge.y + ridge.h + 3, w: ridge.w, h: 18 * u };
  const hudBottom = Math.max(wide ? ridge.y + ridge.h : status.y + status.h, row.y + row.h) + 8;
  const S = clamp(Math.min(W / (tall ? 10.5 : 16), (floorY - hudBottom - 6) / 4.3), 20, 84);
  return {
    w: W, h: H, u, mode: wide ? 'wide' : 'tall', S, floorY, runX: W * (tall ? 0.22 : 0.27), status, scoreX: W - 16 - (wide ? 0 : 6 * u), scoreY: TOP + 2,
    scoreInStatus: !wide, tipLines: 2, driveLines: 3, ridge, row, hudBottom, sceneTop: wide ? hudBottom : hudBottom + 28 * u, cardY: Math.min(hudBottom + 70 * u, (hudBottom + floorY) / 2 - 10 * u), x0: 0,
  };
}
