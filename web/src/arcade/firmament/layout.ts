/**
 * Where Firmament's play view puts things (CSS px) in the canvas the runner gives it — which is the
 * screen minus the signal dock — for phones upright (the HUD above and below the board) and on
 * their side and for desktops (the HUD in columns beside it).  The runner's top strip (the clock,
 * pause, the dock button) stays clear; on an upright phone the cells keep at least ~38 px.
 */
import { clamp } from '../kit/juice';

/** the runner's top strip, and a little room at the bottom edge */
export const TOP = 56;
export const BOTTOM = 8;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  /** a short screen on its side: the goals in one row, the Milky Way in the left column */
  low: boolean;
  /** the board: its top left corner and a cell's size */
  bx: number;
  by: number;
  cell: number;
  /** the block's status (name, strategy, what the band drives), the score's right edge and top */
  status: Rect;
  scoreX: number;
  scoreY: number;
  /** the moves and the goals */
  goals: Rect;
  /** the Milky Way (the band's last 40 s) */
  milky: Rect;
  /** the telescope's lens: its centre and radius, and its caption's box */
  lens: { x: number; y: number; r: number };
  lensText: Rect;
  /** the tray's slot `i` when the tray holds `n` */
  slot(i: number, n: number): Rect;
  /** where the cards (a block's verdict, a level's end) sit */
  cardY: number;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(260, w), H = Math.max(240, h);
  const tall = W / H < 1.05;
  return tall ? upright(W, H) : wide(W, H);
}

/** Upright: status and score, the Milky Way, the goals, the board, then the lens and the tray. */
function upright(W: number, H: number): Layout {
  const u = clamp(W / 400, 0.84, 1.3);
  const gap = 6 * u;
  const statusH = 74 * u, milkyH = 22 * u, goalsH = 40 * u, lensH = Math.max(70, 76 * u);
  const fixed = TOP + statusH + milkyH + goalsH + lensH + 4 * gap + BOTTOM;
  const cell = Math.floor(clamp(Math.min((W - 16) / 8, (H - fixed) / 8), 26, 74));
  const bw = cell * 8;
  const bx = Math.round((W - bw) / 2);
  const side = Math.max(10, Math.min(bx, 16));
  // the free height is shared out: a little more room around the board on tall screens
  const spare = Math.max(0, H - fixed - bw);
  const top = TOP + Math.min(spare * 0.35, 30 * u);
  const status = { x: side, y: top, w: W - 2 * side, h: statusH };
  const milky = { x: side, y: status.y + statusH + gap, w: W - 2 * side, h: milkyH };
  const goals = { x: side, y: milky.y + milkyH + gap, w: W - 2 * side, h: goalsH };
  const by = Math.round(goals.y + goalsH + gap + Math.min(spare * 0.2, 16 * u));
  const lensTop = by + bw + gap + Math.min(spare * 0.15, 12 * u);
  const r = Math.min(lensH / 2 - 7 * u, 32 * u);
  const lens = { x: W - side - r - 2, y: lensTop + lensH / 2, r };
  const slotS = Math.min(52 * u, lensH - 14);
  const trayRight = lens.x - r - 12 * u;
  const slot = (i: number, n: number): Rect => ({ x: trayRight - (n - i) * (slotS + 6 * u), y: lensTop + (lensH - slotS) / 2, w: slotS, h: slotS });
  const lensText = { x: side, y: lensTop, w: Math.max(40, slot(0, 3).x - side - 6 * u), h: lensH };
  return {
    w: W, h: H, u, tall: true, low: false, bx, by, cell, status, scoreX: W - side, scoreY: status.y, goals, milky, lens, lensText, slot,
    cardY: by + bw * 0.42,
  };
}

/** On the side and on desktops: the board in the middle, the status and goals left, the lens and the tray right. */
function wide(W: number, H: number): Layout {
  const u = clamp(Math.min(W / 1100, H / 640), 0.72, 1.2);
  const low = H < 470;
  const milkyH = low ? 0 : 30 * u;
  const top = low ? 46 : TOP;
  const cell = Math.floor(clamp(Math.min((H - top - milkyH - (milkyH ? 10 : 0) - BOTTOM - 4) / 8, (W * 0.5) / 8), 22, 66));
  const bw = cell * 8;
  const bx = Math.round((W - bw) / 2);
  const by = Math.round(top + milkyH + (milkyH ? 10 : 0) + Math.max(0, (H - top - milkyH - BOTTOM - bw) / 2 - (milkyH ? 10 : 0)));
  const colW = Math.max(120, bx - 32 * u);
  const lx = Math.max(12, bx - 16 * u - colW), rx = bx + bw + 16 * u;
  const gap = 8 * u;
  const statusH = (low ? 74 : 104) * u;
  const status = { x: lx, y: by, w: colW, h: statusH };
  const goalsH = (low ? 56 : 86) * u;
  const goals = { x: lx, y: status.y + statusH + gap, w: colW, h: goalsH };
  const milky = low
    ? { x: lx, y: goals.y + goalsH + gap, w: colW, h: Math.max(22, Math.min(40 * u, by + bw - (goals.y + goalsH + gap))) }
    : { x: 16, y: top + 2, w: W - 32, h: milkyH };
  const scoreY = by;
  const r = clamp(Math.min(colW * 0.3, (low ? 52 : 74) * u), 30, 92);
  const lens = low ? { x: rx + r + 10 * u, y: by + 30 * u + r, r } : { x: rx + Math.min(colW, 300 * u) / 2, y: by + 84 * u + r, r };
  const slotS = clamp(Math.min((colW - 18 * u) / 4, 62 * u), 34, 66);
  const trayY = lens.y + r + (low ? 12 : 34) * u;
  const slot = (i: number, n: number): Rect => {
    const tw = n * slotS + (n - 1) * 6 * u;
    const x0 = low ? rx : lens.x - tw / 2;
    return { x: x0 + i * (slotS + 6 * u), y: trayY, w: slotS, h: slotS };
  };
  const lensText = { x: rx, y: trayY + slotS + 6 * u, w: colW, h: Math.max(0, by + bw - (trayY + slotS + 6 * u)) };
  return {
    w: W, h: H, u, tall: false, low, bx, by, cell, status, scoreX: rx + Math.min(colW, 300 * u), scoreY, goals, milky, lens, lensText, slot,
    cardY: by + bw * 0.42,
  };
}
