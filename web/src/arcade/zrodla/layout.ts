/**
 * Where Źródła's play view puts things (CSS px): the valley's board between the runner's strips
 * (its timer and pause button on top, the simulator button and the signal banner below), the HUD
 * above it on a portrait phone or in the columns beside it when wide, and the card slot, which never
 * covers the board.  On a portrait phone the board's centre stays at 55 % of the height and on a wide
 * screen in the middle between the strips, so the smoke test's click at 50 % × 60 % always lands on
 * the same cell (valley.ts `smokeCell`); the whole cell is the target.
 */
import { clamp } from '../kit/juice';

/** The runner's own UI: the top strip (timer, pause), the bottom strip (simulator button, signal banner). */
export const TOP = 64;
export const BOTTOM = 66;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  portrait: boolean;
  cols: number;
  rows: number;
  /** one stone (px) and the board's top-left corner and size */
  S: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  /** the rock border around the board, where the springs rise (px) */
  rim: number;
  /** the block's name; the strategy line under it; the jar count (right-aligned to x + w); the road strip; the card slot */
  name: Rect;
  tip: Rect;
  score: Rect;
  road: Rect;
  card: Rect;
  /** the title line over the board's top rows: its centre and width */
  title: { x: number; y: number; w: number };
}

export function layout(w: number, h: number, cols: number, rows: number): Layout {
  const u = clamp(Math.min(w, h) / 430, 0.84, 1.2);
  const portrait = w < h;
  const cardH = Math.round(66 * u);
  if (portrait) {
    const hudH = 118 * u, gap = 14;
    const room = h - TOP - BOTTOM - hudH - cardH - gap - 16;
    const S = Math.max(36, Math.min((w - 32) / cols, 80, room / rows));
    const bw = S * cols, bh = S * rows, rim = Math.max(8, Math.round(S * 0.16));
    // the centre stays at 55 % of the height (the smoke cell depends on it) unless the HUD or the card needs the room
    const lo = TOP + hudH + rim + 8 + bh / 2, hi = h - BOTTOM - cardH - gap - rim - bh / 2;
    const cy = clamp(h * 0.55, lo, Math.max(lo, hi));
    const bx = (w - bw) / 2, by = cy - bh / 2;
    const cw = Math.min(w - 32, 330 * u);
    const cardY = Math.min(by + bh + rim + gap, h - BOTTOM - cardH - 4);
    const scoreW = Math.min(128 * u, w * 0.34);
    const top = TOP + 8;
    const roadH = 30 * u, roadY = Math.max(top + 76 * u, by - rim - 8 - roadH);
    return {
      w, h, u, portrait, cols, rows, S, bx, by, bw, bh, rim,
      name: { x: 16, y: top, w: w - 32 - scoreW - 8, h: 28 * u },
      tip: { x: 16, y: top + 30 * u, w: w - 32 - scoreW * 0.35, h: 36 * u },
      score: { x: w - 16 - scoreW, y: top - 4, w: scoreW, h: 62 * u },
      road: { x: 16, y: roadY, w: w - 32, h: roadH },
      card: { x: (w - cw) / 2, y: cardY, w: cw, h: cardH },
      title: { x: w / 2, y: by + S * 0.55, w: Math.min(bw, w - 24) },
    };
  }
  const side = clamp(w * 0.22, 160 * u, 320);
  const S = Math.max(36, Math.min((h - TOP - BOTTOM) / rows, (w - 2 * side - 24) / cols, 110));
  const bw = S * cols, bh = S * rows, rim = Math.max(6, Math.round(S * 0.14));
  const bx = (w - bw) / 2, by = TOP + (h - TOP - BOTTOM - bh) / 2;
  const left = Math.max(120, Math.min(bx - rim - 32, 340 * u)), right = Math.max(120, Math.min(w - (bx + bw + rim) - 32, 340 * u));
  const rx = w - 16 - right;
  const cw = Math.min(right, 300 * u);
  const scoreH = 74 * u, top = TOP + 4;
  const tipY = top + 30 * u, tipH = 56 * u;
  return {
    w, h, u, portrait, cols, rows, S, bx, by, bw, bh, rim,
    name: { x: 16, y: top, w: left, h: 28 * u },
    tip: { x: 16, y: tipY, w: left, h: tipH },
    score: { x: rx, y: top - 4, w: right, h: scoreH },
    road: { x: 16, y: Math.min(h - BOTTOM - 64 * u, tipY + tipH + 12 * u), w: left, h: 52 * u },
    card: { x: w - 16 - cw, y: Math.min(h - BOTTOM - cardH - 4, top + scoreH + 10 * u), w: cw, h: cardH },
    title: { x: w / 2, y: by + S * 0.55, w: bw },
  };
}

/** The cell under a point (−1: off the board). */
export function cellAt(L: Layout, x: number, y: number): number {
  const c = Math.floor((x - L.bx) / L.S), r = Math.floor((y - L.by) / L.S);
  return c < 0 || r < 0 || c >= L.cols || r >= L.rows ? -1 : r * L.cols + c;
}

/** A cell's centre (x, y) into `out` (no garbage per frame). */
export function cellCentre(L: Layout, cell: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = L.bx + ((cell % L.cols) + 0.5) * L.S;
  out.y = L.by + (Math.floor(cell / L.cols) + 0.5) * L.S;
  return out;
}
