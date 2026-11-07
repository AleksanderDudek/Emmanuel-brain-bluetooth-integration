/**
 * Where Chleby i ryby's play view puts things (CSS px), for phones upright and on their side and for
 * desktops: the HUD's boxes (the status with the block's strategy and what the band drives, the
 * headline, the level's strip), the sky and the lake behind, the band of the hungry at the top of
 * the hill, the lane up the hillside in a gentle perspective (the boy's basket at the bottom, the
 * hungry at the top), the boy, and the row of baskets along the bottom edge that holds the band's
 * last 40 s.  The runner's top strip (time, pause) and bottom corner (the simulator button) stay
 * clear; the canvas is the room above the runner's signal dock, so a phone on its side can leave
 * very little height: there the HUD becomes a column on the left and the hill takes the rest.
 */
import { clamp } from '../kit/juice';
import { RULES } from './rules';

export const TOP = 62;
export const BOTTOM = 52;

export interface Rect { x: number; y: number; w: number; h: number }
export type Mode = 'wide' | 'tall' | 'short';

export interface Lane {
  /** the lane's centre line, its bottom (the basket, y = 0) and its top (the hungry, y = laneH) */
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
  mode: Mode;
  lane: Lane;
  /** the status card (block, strategy, what the band drives) at its tallest */
  status: Rect;
  /** the headline's right edge and top; inside the status card's corner on upright screens */
  scoreX: number;
  scoreY: number;
  scoreInStatus: boolean;
  /** the level's strip (level, hillside, hunger bar, baskets of crumbs) */
  strip: Rect;
  tipLines: number;
  driveLines: number;
  /** the row of baskets along the bottom (the band's last 40 s) */
  hist: Rect;
  /** the band of the hungry above the lane's top, and its height */
  crowdH: number;
  /** the horizon (the lake's top edge) and the lake's depth */
  horizon: number;
  lakeD: number;
  /** cards and the choice of upgrades centre here */
  cardX: number;
  cardY: number;
  /** the HUD's lowest edge over the hill */
  hudBottom: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.8, 1.25);
  const tall = W / H < 1;
  const short = !tall && H < 470;
  if (short) {
    // a phone on its side: the HUD is a column on the left, the hill the rest
    const colW = Math.min(W * 0.38, 290 * u);
    const status = { x: 10, y: TOP - 6, w: colW, h: Math.max(80, H - TOP - 6 - 8) };
    const x0 = colW + 16;
    const avail = W - x0 - 10;
    const histH = 14 * u;
    const hist = { x: x0 + 8, y: H - histH - 6, w: avail - 16, h: histH };
    const boy = clamp(H * 0.09, 16, 26 * u);
    const yB = hist.y - 8 - boy * 1.5;
    const strip = { x: x0 + 8, y: 6, w: Math.min(avail - 120, 300 * u), h: 20 * u };
    const horizon = 0, lakeD = 10;
    const crowdH = clamp(H * 0.14, 26, 46);
    const yT = Math.max(strip.y + strip.h + crowdH, lakeD + crowdH + 4);
    const hwB = Math.min(avail / 2 - 4, (yB - yT) * 1.1);
    const lane = mkLane(x0 + avail / 2, yB, yT, hwB, 0.3, boy);
    return {
      w: W, h: H, u, mode: 'short', lane, status, scoreX: status.x + status.w - 10, scoreY: status.y + 6, scoreInStatus: true,
      strip, tipLines: 2, driveLines: 2, hist, crowdH, horizon, lakeD, cardX: lane.cx, cardY: (yT + yB) / 2, hudBottom: strip.y + strip.h,
    };
  }
  const statusWide = Math.min(W * 0.28, 330 * u);
  const scoreW = 150 * u;
  const mid = W - 32 - statusWide - scoreW - 32;
  const wide = !tall && mid >= 300 * u;
  const histH = 20 * u;
  if (wide) {
    const status = { x: 16, y: TOP + 2, w: statusWide, h: Math.min(H - TOP - BOTTOM - 10, 230 * u) };
    const horizon = TOP - 22, lakeD = 22 * u;
    const crowdH = clamp(H * 0.15, 60, 104 * u);
    const yT = horizon + lakeD + 6 + crowdH;
    const histW = Math.min(mid, 560 * u);
    const hist = { x: W / 2 - histW / 2, y: H - histH - 8, w: histW, h: histH };
    const boy = clamp(H * 0.065, 30, 44 * u);
    const yB = hist.y - 10 - boy * 1.55;
    const hwB = Math.min(mid / 2 + 20 * u, (yB - yT) * 0.66);
    const lane = mkLane(W / 2, yB, yT, hwB, 0.55, boy);
    const strip = { x: W - 16 - 200 * u, y: TOP + 82 * u, w: 200 * u, h: 64 * u };
    return {
      w: W, h: H, u, mode: 'wide', lane, status, scoreX: W - 16, scoreY: TOP + 2, scoreInStatus: false, strip,
      tipLines: 3, driveLines: 3, hist, crowdH, horizon, lakeD, cardX: W / 2, cardY: yT + (yB - yT) * 0.45, hudBottom: TOP,
    };
  }
  // upright or narrow: one full-width card (the headline in its corner), a strip, then the hill
  const status = { x: 10, y: TOP, w: W - 20, h: 138 * u };
  const strip = { x: 10, y: status.y + status.h + 4 * u, w: W - 20, h: 22 * u };
  const horizon = strip.y + strip.h + 4 * u, lakeD = 12 * u;
  const crowdH = clamp(H * 0.1, 46, 70 * u);
  const yT = horizon + lakeD + 4 + crowdH;
  const hist = { x: 12, y: H - histH - 8, w: W - 24, h: histH };
  const boy = clamp(H * 0.05, 24, 34 * u);
  const yB = hist.y - 8 - boy * 1.55;
  const hwB = Math.min(W / 2 - 6, (yB - yT) * 0.7);
  const lane = mkLane(W / 2, yB, yT, hwB, 0.45, boy);
  return {
    w: W, h: H, u, mode: 'tall', lane, status, scoreX: W - 20, scoreY: status.y + 4, scoreInStatus: true, strip,
    tipLines: 2, driveLines: 2, hist, crowdH, horizon, lakeD, cardX: W / 2, cardY: yT + (yB - yT) * 0.45, hudBottom: strip.y + strip.h,
  };
}

function mkLane(cx: number, yB: number, yT: number, hwB: number, k: number, boy: number): Lane {
  const unit = (2 * hwB) / RULES.laneW;
  // the hill's depth: px per u up the lane on average; sprites stay within about twice of it
  const depth = (yB - yT) / RULES.laneH;
  return { cx, yB, yT, hwB, hwT: hwB / (1 + k), k, unit, su: Math.min(unit, depth * 2.3), boy };
}

/** The perspective scale at lane height y (1 at the basket, 1 / (1 + k) at the hungry). */
export const scaleAt = (L: Lane, y: number): number => 1 / (1 + L.k * (y / RULES.laneH));

/** Lane (x, y) in u → screen px. */
export function toScreen(L: Lane, x: number, y: number): { x: number; y: number; s: number } {
  const s = scaleAt(L, y), s1 = 1 / (1 + L.k);
  const g = (1 - s) / (1 - s1);
  return { x: L.cx + (x / RULES.laneW - 0.5) * 2 * L.hwB * s, y: L.yB - (L.yB - L.yT) * g, s };
}

/** A screen x at the basket's row → lane x (u). */
export const laneX = (L: Lane, sx: number): number => ((sx - L.cx) / (2 * L.hwB) + 0.5) * RULES.laneW;
