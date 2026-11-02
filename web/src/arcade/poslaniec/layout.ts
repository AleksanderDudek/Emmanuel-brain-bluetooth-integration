/**
 * Where Posłaniec's play view puts things (CSS px), for phones upright and on their side and for
 * desktops, and the camera behind the runner: its focal length, how far behind and how high it
 * rides, and where the horizon lies.  Lanes are about a third of an upright phone's width apart, and
 * the runner stands in the lower third; the sky above holds the HUD and the ribbon of dawn.  The
 * runner's top strip (time, pause) and bottom strip (the signal banner, the simulator button) stay
 * clear of the HUD.
 */
import { clamp } from '../kit/juice';

export const TOP = 64;
export const BOTTOM = 66;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  /** the camera: focal length (px), metres behind and above the runner's ground */
  f: number;
  back: number;
  high: number;
  /** the vanishing point */
  cx: number;
  horizon: number;
  /** the status (block, tip, bar); the score's right edge and top; its box width */
  status: Rect;
  scoreX: number;
  scoreY: number;
  scoreW: number;
  /** the ribbon of dawn across the upper sky */
  ribbon: Rect;
  /** the block card's top-left, the centre line of the big cards, the hint pill's centre */
  blockCard: Rect;
  cardY: number;
  hintY: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const f = Math.min(H * 0.62, W * 1.05);
  const back = 5, high = 2.8;
  // the runner's feet rest in the lower part of the screen, clear of the bottom strip
  const feet = Math.min(H * (tall ? 0.84 : 0.85), H - BOTTOM - 24 * u);
  const horizon = feet - (high * f) / back;
  const scoreW = 128 * u;
  const statusW = Math.min(W - 40 - scoreW, tall ? W : W * 0.42, 440 * u);
  const status: Rect = { x: 16, y: TOP + 2, w: statusW, h: 92 * u };
  const cardW = Math.min(200 * u, W - 32);
  let ribbon: Rect, blockCard: Rect;
  if (!tall && H < 560) {
    // a short landscape screen: the ribbon between the status and the score, the card under the status
    const x0 = status.x + statusW + 12, x1 = W - 16 - scoreW - 12;
    ribbon = { x: x0, y: TOP + 6, w: Math.max(80, x1 - x0), h: 54 * u };
    blockCard = { x: 16, y: status.y + status.h + 8, w: cardW, h: 84 * u };
  } else {
    const ribbonTop = TOP + (tall ? 108 : 100) * u;
    const ribbonW = tall ? W - 32 : Math.min(W - 32, W * 0.74);
    const ribbonH = clamp((horizon - ribbonTop) * 0.42, 40 * u, 70 * u);
    ribbon = { x: (W - ribbonW) / 2, y: ribbonTop, w: ribbonW, h: ribbonH };
    blockCard = { x: tall ? 16 : ribbon.x, y: ribbon.y + ribbon.h + 12 * u, w: cardW, h: 92 * u };
  }
  return {
    w: W, h: H, u, tall, f, back, high, cx: W / 2, horizon,
    status, scoreX: W - 16, scoreY: TOP + 2, scoreW,
    ribbon, blockCard,
    cardY: tall ? Math.max(blockCard.y + blockCard.h + 40 * u, H * 0.4) : Math.max(blockCard.y + 40 * u, H * 0.36),
    hintY: H - BOTTOM - 30 * u,
  };
}
