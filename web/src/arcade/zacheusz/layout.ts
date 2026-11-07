/**
 * Where Zacheusz's play view puts things (CSS px), for phones upright and on their side and for
 * desktops.  The runner's standard HUD (the Mendi panel top left, the score top right) covers the
 * band down to `hudTop`; the street and everything that matters for a jump sits below it: the
 * scene's scale is chosen so that the street, the roofs and the band's light road (the lane, about
 * 4 u up, plus his height) all fit between `hudTop` and the street line.  The sky above `hudTop` keeps
 * only background art (the palms of the signal's skyline run along the horizon below the panel).
 */
import { clamp } from '../kit/juice';

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  short: boolean;
  /** px per u */
  S: number;
  /** the street's top line on screen, and where he runs (x) */
  gy: number;
  hx: number;
  /** the runner's HUD bottom edge, and the band of sky for the skyline of palms */
  hudTop: number;
  horizon: number;
  /** the bubble button (bottom right: the simulator's switch sits bottom left) */
  btn: { x: number; y: number; r: number };
  /** where cards centre */
  cardY: number;
}

/** The world's height that must fit under the HUD: the lane, his height, a coin over him. */
const NEED_U = 5.7;

export function layout(w: number, h: number, hudTop: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.8, 1.25);
  const tall = W / H < 0.9;
  const short = !tall && H < 470;
  const top = clamp(hudTop || 0, 0, H * 0.45);
  const floor = Math.max(short ? 34 : 54, H * (tall ? 0.15 : 0.12));
  const gy = H - floor;
  const fitH = (gy - top - 8) / NEED_U;
  const fitW = W / (tall ? 9.5 : 17);
  const S = Math.max(short ? 20 : 26, Math.min(fitH, fitW, 80));
  const hx = W * (tall ? 0.3 : 0.28);
  const horizon = Math.min(gy - S * 1.2, Math.max(top + S * 0.8, gy - S * 4.4));
  const r = clamp(26 * u, 22, 32);
  return {
    w: W, h: H, u, tall, short, S, gy, hx, hudTop: top, horizon,
    btn: { x: W - 16 - r, y: H - 14 - r, r },
    cardY: top + (gy - top) * 0.45,
  };
}
