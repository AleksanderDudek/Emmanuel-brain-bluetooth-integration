/**
 * Where Chleby i ryby's play view puts things (CSS px), for desktops, phones upright and phones on
 * their side.  The runner's standard HUD (the Mendi panel top left, the score top right, under the
 * time bar) covers the top band down to `hudTop`: the sky and the lake run under it, the play stays
 * below it — the tables of the hungry at the lane's top, the gates, the crowd, the boy's basket at
 * the bottom, Mirka's post beside the lane and the row of baskets of crumbs along the bottom edge.
 * On a phone on its side there is little height: the lane then sits between the panel and the score
 * and rises to just under the time bar.
 */
import { clamp } from '../kit/juice';
import { RULES } from './rules';

export interface Lane {
  /** the lane's centre line, its bottom (the basket, y = 0) and its top (the tables, y = laneH) */
  cx: number;
  yB: number;
  yT: number;
  /** half widths (px) at the bottom and at the top */
  hwB: number;
  hwT: number;
  /** perspective: the scale at the top is 1 / (1 + k) */
  k: number;
  /** px per u across the lane at the bottom */
  unit: number;
  /** px per u for the sprites at the bottom (never taller than the hill's depth allows) */
  su: number;
  /** the boy's size (px) */
  boy: number;
}

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  mode: 'wide' | 'tall' | 'short';
  lane: Lane;
  /** the sky down to the horizon, then the lake's depth, then the grass */
  horizon: number;
  lakeD: number;
  /** the band the runner's HUD covers */
  hudTop: number;
  /** the row of baskets of crumbs (the bank) along the bottom */
  bank: { x: number; y: number; w: number; h: number };
  /** Mirka's post: its foot, and the side her bubble opens to */
  perch: { x: number; y: number; dir: 1 | -1 };
  /** cards centre here */
  cardX: number;
  cardY: number;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.8, 1.25);
  const tall = W / H < 0.9;
  const short = !tall && H - hudTop < 330;
  let top = hudTop + 8, x0 = 0, x1 = W;
  if (short) {
    // a phone on its side: between the panel and the score, up to just under the time bar
    top = Math.min(hudTop, 58);
    x0 = Math.min(W * 0.36, 300 * u);
    x1 = W - Math.min(W * 0.16, 130 * u);
  }
  const bankH = clamp(H * 0.035, 14, 22 * u);
  const bank = { x: 0, y: H - bankH - 6, w: 0, h: bankH };
  const boy = clamp(H * 0.055, 22, 42 * u);
  const yB = bank.y - 8 - boy * 1.5;
  // the tables' band: people, the bar and the number stand over the lane's top line
  const crowd = clamp((yB - top) * 0.17, 34, 84 * u);
  const yT = top + crowd;
  const avail = x1 - x0;
  const hwB = Math.min(avail / 2 - (tall ? 4 : 30 * u), (yB - yT) * (tall ? 0.75 : 0.8));
  const k = tall ? 0.42 : short ? 0.3 : 0.45;
  const lane = mkLane((x0 + x1) / 2, yB, yT, hwB, k, boy);
  // on an upright phone the simulator's button and the corner stay clear: the row sits to the right
  const bankW = tall ? Math.min(avail * 0.62, 12 * bankH * 2.1) : Math.min(avail - 24, 12 * bankH * 2.1);
  bank.x = tall ? x1 - bankW - 8 : lane.cx - bankW / 2;
  bank.w = bankW;
  const horizon = short ? 0 : Math.max(24, top - 48 * u);
  const lakeD = short ? Math.max(8, top - 4) : clamp(top - horizon - 4, 18, 40 * u);
  // Mirka's post: beside the lane's lower half, on the side with more room (left on wide screens)
  const leftRoom = lane.cx - lane.hwB - x0;
  const px = tall || leftRoom < 60 * u ? Math.max(x0 + 26 * u, lane.cx - lane.hwB + 18 * u) : lane.cx - lane.hwB - 34 * u;
  const perch = { x: px, y: yB - (yB - yT) * 0.32, dir: 1 as const };
  return {
    w: W, h: H, u, mode: short ? 'short' : tall ? 'tall' : 'wide', lane, horizon, lakeD, hudTop, bank, perch,
    cardX: lane.cx, cardY: yT + (yB - yT) * 0.48,
  };
}

function mkLane(cx: number, yB: number, yT: number, hwB: number, k: number, boy: number): Lane {
  const unit = (2 * hwB) / RULES.laneW;
  const depth = (yB - yT) / RULES.laneH;
  return { cx, yB, yT, hwB, hwT: hwB / (1 + k), k, unit, su: Math.min(unit, depth * 2.6), boy };
}

/** The perspective scale at lane height y (1 at the basket, 1 / (1 + k) at the tables). */
export const scaleAt = (L: Lane, y: number): number => 1 / (1 + L.k * (y / RULES.laneH));

/** Lane (x, y) in u → screen px, and the scale there. */
export function toScreen(L: Lane, x: number, y: number): { x: number; y: number; s: number } {
  const s = scaleAt(L, y), s1 = 1 / (1 + L.k);
  const g = (1 - s) / (1 - s1);
  return { x: L.cx + (x / RULES.laneW - 0.5) * 2 * L.hwB * s, y: L.yB - (L.yB - L.yT) * g, s };
}

/** A screen x at the basket's row → lane x (u). */
export const laneX = (L: Lane, sx: number): number => ((sx - L.cx) / (2 * L.hwB) + 0.5) * RULES.laneW;
