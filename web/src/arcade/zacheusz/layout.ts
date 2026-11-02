/**
 * Where Zacheusz's play view puts things (CSS px), for phones upright and on their side and for
 * desktops: the scale of the street (px per u), where Zacchaeus runs across the screen, the
 * street's line, the skyline of palms (the signal's history) on the horizon, and the HUD's boxes.
 * The runner's top strip (time, pause) and bottom strip (the signal banner, the simulator button)
 * stay clear of the HUD.
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
  /** px per world unit */
  S: number;
  /** where he runs across the screen, and the street's line when the camera rests (px) */
  hx: number;
  gy: number;
  /** the skyline's foot and the tallest palm (px); its left and right ends */
  horizon: number;
  palmMax: number;
  skyX0: number;
  skyX1: number;
  status: Rect;
  scoreX: number;
  scoreY: number;
  /** the block card's box and the event cards' centre */
  block: Rect;
  cardY: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const S = tall ? W / 9.5 : Math.min(H / 9.6, W / 14.5);
  const gy = H * (tall ? 0.83 : 0.78);
  const palmMax = tall ? H * 0.11 : H * 0.13;
  const statusW = Math.min(W - 32 - 128 * u, tall ? W : W * 0.5, 440 * u);
  const status: Rect = { x: 16, y: TOP + 2, w: statusW, h: 96 * u };
  // the skyline stands clear of the HUD above it and of the roofs' run below it
  const horizon = tall ? H * 0.52 : Math.max(H * 0.36, TOP + 100 * u + palmMax * 1.15 + 24);
  // the block card: under the status on an upright phone, else in the gap between the status and the score
  const bh = 100 * u;
  let block: Rect;
  if (tall) block = { x: 16, y: TOP + 2 + 112 * u, w: Math.min(250 * u, W - 32), h: bh };
  else {
    const gx0 = status.x + statusW + 12, gx1 = W - 16 - 150 * u;
    const bw = Math.max(150, Math.min(250 * u, gx1 - gx0));
    block = { x: Math.max(gx0, (gx0 + gx1) / 2 - bw / 2), y: TOP + 2, w: bw, h: bh };
  }
  return {
    w: W, h: H, u, tall, S, hx: W * (tall ? 0.26 : 0.27), gy, horizon, palmMax,
    skyX0: W * 0.02, skyX1: W * 0.98,
    status, scoreX: W - 16, scoreY: TOP + 2, block,
    cardY: tall ? H * 0.36 : H * 0.36,
  };
}
