/**
 * Where Pasterz's play view puts things (CSS px), for phones upright and on their side and for
 * desktops, and how many pixels a metre of the hill takes.  The runner's top strip (time, pause)
 * and its bottom strip (the signal banner, the simulator button) stay clear of the HUD.  The
 * shepherd sits at the middle of the screen, so a tap below him (the smoke test's) walks him on.
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
  /** px per metre of the hill */
  S: number;
  /** the status (block, tip), the score's right edge, the pasture bar and the tally strip */
  status: Rect;
  scoreX: number;
  scoreY: number;
  bar: Rect;
  trace: Rect;
  /** the lowest HUD edge, the block card's centre, the count's steps' baseline */
  hudBottom: number;
  cardY: number;
  stepsY: number;
  /** where the shepherd sits on the screen */
  cx: number;
  cy: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const S = clamp(Math.min(W, H * 0.85) / 14.5, 21, 46);
  const scoreW = 118 * u;
  const statusWide = Math.min(W * 0.3, 360 * u);
  const mid = W - 32 - statusWide - scoreW - 32;
  const wide = !tall && mid >= 250 * u;
  let status: Rect, bar: Rect, trace: Rect;
  if (wide) {
    status = { x: 16, y: TOP + 2, w: statusWide, h: 86 * u };
    const bw = Math.min(mid, 400 * u);
    const bx = 16 + statusWide + 16 + (mid - bw) / 2;
    bar = { x: bx, y: TOP + 4, w: bw, h: 24 * u };
    trace = { x: bx, y: bar.y + bar.h + 8 * u, w: bw, h: 50 * u };
  } else {
    status = { x: 16, y: TOP + 2, w: W - 32 - scoreW - 8, h: 74 * u };
    bar = { x: 16, y: status.y + status.h + 4 * u, w: W - 32, h: 24 * u };
    trace = { x: 16, y: bar.y + bar.h + 6 * u, w: W - 32, h: 44 * u };
  }
  const hudBottom = Math.max(status.y + status.h, trace.y + trace.h) + 8;
  return {
    w: W, h: H, u, tall, S, status, scoreX: W - 16, scoreY: TOP + 2, bar, trace, hudBottom,
    cardY: hudBottom + 70 * u, stepsY: H - BOTTOM - 14 * u,
    cx: W / 2, cy: H * 0.5,
  };
}
