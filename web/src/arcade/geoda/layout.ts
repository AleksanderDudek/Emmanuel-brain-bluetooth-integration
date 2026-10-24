/**
 * Where Geoda's parts sit on the canvas (CSS px), for phones upright and on their side and for
 * desktops: the 8×8 wall in the middle (the smoke test's tap at 50 % × 60 % always lands on it)
 * inside the geode's rim, the HUD above it (portrait) or to its left (landscape), the tray of three
 * crystals below or to its right.  The runner's strip (top ~64 px), the simulator button (bottom
 * left) and the signal banner (bottom centre) are kept clear of the game's controls and text.
 */
import { GEODE_REACH } from './art';
import { N } from './wall';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  landscape: boolean;
  /** one wall cell (px) */
  cell: number;
  /** the geode's rim thickness unit (it reaches GEODE_REACH × rim beyond the wall) */
  rim: number;
  wall: Rect;
  /** the three tray slots */
  slots: Rect[];
  hud: Rect;
  /** the line of hints (centre x, baseline y, width) */
  hint: { x: number; y: number; w: number };
}

/** The runner's top strip (time, pause). */
export const TOP = 64;

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** The rim grows with the cells: a heavier geode on a desktop, a slimmer one on a phone. */
export const rimFor = (cell: number): number => Math.round(clampN(cell * 0.3, 9, 22));

export function computeLayout(w: number, h: number): Layout {
  return w > h * 1.1 ? landscape(w, h) : portrait(w, h);
}

function portrait(w: number, h: number): Layout {
  const side = 12, hudH = clampN(h * 0.085, 60, 84), trayH = clampN(h * 0.19, 112, 190), bottom = 76;
  const gapA = 6, gapB = 30;   // HUD → rim, rim → tray (the hint line sits in the second)
  const reachK = 0.3 * GEODE_REACH;   // the rim's reach in cells
  // the wall spans the width (the rim may run off the sides); above and below, the rim must fit
  const byW = (w - 2 * side - 8) / N;
  const byH = (h - TOP - bottom - hudH - trayH - gapA - gapB) / (N + 2 * reachK);
  const cell = Math.floor(clampN(Math.min(byW, byH), 24, 72));
  const rim = rimFor(cell), reach = rim * GEODE_REACH, size = cell * N;
  const total = hudH + gapA + reach + size + reach + gapB + trayH;
  const y0 = TOP + Math.max(0, (h - TOP - bottom - total) / 2);
  const wall = { x: Math.round((w - size) / 2), y: Math.round(y0 + hudH + gapA + reach), w: size, h: size };
  const trayY = wall.y + size + reach + gapB;
  const trayW = Math.min(w - 2 * side, size + 40);
  const gap = 10, sw = (trayW - 2 * gap) / 3, tx = (w - trayW) / 2;
  const slots = [0, 1, 2].map(i => ({ x: tx + i * (sw + gap), y: trayY, w: sw, h: trayH }));
  return {
    w, h, landscape: false, cell, rim, wall, slots,
    hud: { x: Math.max(side, wall.x), y: y0, w: Math.min(w - 2 * side, size), h: hudH },
    hint: { x: w / 2, y: wall.y + size + reach + gapB * 0.68, w: w - 2 * side },
  };
}

function landscape(w: number, h: number): Layout {
  const top = TOP - 4, bottom = 66, gap = 22;
  const sideW = clampN(w * 0.21, 196, 290);
  const byH = (h - top - bottom) / (N + 0.6);
  const byW = (w - 2 * sideW - 2 * gap) / (N + 0.6);
  const cell = Math.floor(clampN(Math.min(byH, byW), 22, 72));
  const rim = rimFor(cell), size = cell * N;
  const wall = { x: Math.round((w - size) / 2), y: Math.round(top + Math.max(0, (h - top - bottom - size) / 2)), w: size, h: size };
  const edge = rim * 1.2 + gap;   // from the wall to the side columns
  // the tray: a column to the right of the wall, as tall as the screen allows below the pause button
  const tx = wall.x + size + edge;
  const tw = Math.min(sideW, w - tx - 14);
  const tTop = Math.max(top, wall.y - rim), tBottom = Math.min(h - 12, wall.y + size + rim + 60);
  const sg = 10, sh = Math.min(176, (tBottom - tTop - 2 * sg) / 3);
  const ty = tTop + Math.max(0, (tBottom - tTop - 3 * sh - 2 * sg) / 2);
  const slots = [0, 1, 2].map(i => ({ x: tx, y: ty + i * (sh + sg), w: tw, h: sh }));
  const hx = Math.max(14, wall.x - edge - sideW);
  const hud = { x: hx, y: wall.y, w: wall.x - edge - hx, h: Math.min(size, h - bottom - wall.y - 6) };
  return {
    w, h, landscape: true, cell, rim, wall, slots, hud,
    hint: { x: hud.x + hud.w / 2, y: hud.y + hud.h - 8, w: hud.w },
  };
}

/**
 * Where a tray slot's crystal may sit, top and bottom (px): below the stalactite, above the size
 * label in portrait; a landscape slot is short and wide, so its label goes beside the crystal.
 */
export function trayBand(l: Layout, r: Rect): { top: number; bottom: number } {
  return { top: r.y + 16, bottom: r.y + r.h - (l.landscape ? 6 : 18) };
}

/**
 * One cell of a crystal in the tray, for crystals up to `extW` × `extH` cells: the same in every
 * slot so sizes compare, as large as the widest and the tallest crystal there let it be.
 */
export function trayCellFor(l: Layout, extW: number, extH: number): number {
  const s = l.slots[0], band = trayBand(l, s);
  const ew = Math.max(2, extW), eh = Math.max(2, extH);
  // phones get bigger tray crystals relative to the wall; a desktop's wall cells are large already
  return Math.floor(Math.min(s.w / (ew + (l.landscape ? 1.2 : 0.5)), (band.bottom - band.top) / eh, l.cell * (l.cell <= 48 ? 0.72 : 0.6)));
}

/** The wall cell under a point (null outside the wall). */
export function cellAt(l: Layout, x: number, y: number): [number, number] | null {
  const cx = Math.floor((x - l.wall.x) / l.cell), cy = Math.floor((y - l.wall.y) / l.cell);
  return cx >= 0 && cy >= 0 && cx < N && cy < N ? [cx, cy] : null;
}

/** The tray slot under a point (−1: none). */
export function slotAt(l: Layout, x: number, y: number): number {
  return l.slots.findIndex(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}
