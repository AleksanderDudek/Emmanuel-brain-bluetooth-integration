/**
 * Where everything sits in the workshop (CSS px), phone first (src/arcade/DESIGN.md §12): the order
 * ticket, the customer at the counter, the wheel with the pot's stage (its foot on the wheel head, the
 * spirit level on the frame, the Gotowe button beside it), the kiln with the cat on it, the shelf where
 * the batch dries, Szamot's bubble, and the glazing palette.  The runner's HUD covers the band above
 * `top` (insets().top): nothing that must be read or touched sits there.
 *
 * Upright (a phone in one hand, the reference): the ticket under the HUD on the left and the kiln with
 * the cat on the right (passive, the top band), the pot's stage across the middle, and the thumb zone
 * at the bottom — the wheel's floor band with the level, the master's hand and the Gotowe button (124 ×
 * 52 at the bottom right), or while glazing the palette as a bottom sheet: the patterns' row, the
 * colours (48 px swatches, up to five a row) and the same Gotowe in the same corner.  Szamot's bubble
 * hangs under the kiln on the right (it waits while a finger works the clay).  On its side and on a
 * desktop: the ticket and the customer on the left, the wheel in the middle with Gotowe at its right,
 * the kiln on the right, the palette along the bottom.  `u` is the kit's `uiScale` (1 on a phone, up to
 * 1.3); every control is at least MIN_TAP and keeps the 16 px edges, the home indicator and the canvas's
 * last rows (a touch on the signal dock plays there) clear.
 */
import { MIN_TAP, NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { RULES } from './rules';
import { widestOf, type Target } from './shape';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Circle { x: number; y: number; r: number }

export interface Layout {
  w: number;
  h: number;
  /** the runner's HUD band (insets().top) */
  top: number;
  /** the safe edges for text and anything to tap: 16 px in from the sides (past a notch), above the home indicator */
  left: number;
  right: number;
  bottom: number;
  portrait: boolean;
  /** the UI scale: 1 on a phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** the wheel's axis, and the pot's foot (the wheel head's top) */
  axis: number;
  floor: number;
  /** the pot's room: up from the floor, and to each side of the axis */
  stageH: number;
  stageW: number;
  /** the wheel head (an ellipse) and the frame's spirit level */
  wheel: { x: number; y: number; rx: number; ry: number };
  level: Rect;
  /** the master's hand ring */
  charge: { x: number; y: number; r: number };
  /** the Gotowe button at the wheel */
  done: Rect;
  ticket: Rect;
  /** the customer's feet and height (px) */
  customer: { x: number; y: number; s: number };
  kiln: Rect;
  /** the heat gauge over the kiln: a half dial (its centre at the bottom) */
  gauge: { x: number; y: number; r: number };
  /** the kiln shelf where the batch dries */
  shelf: Rect;
  /** the cat (on the kiln upright, on the back shelf on its side) */
  cat: { x: number; y: number; s: number };
  /** where Szamot's bubble may go: its top-left corner and the widest it may be; `under` the cat or beside it */
  talk: { x: number; y: number; maxW: number; side: 'left' | 'right' };
}

/** Text keeps this far from a side; anything to tap keeps the 16 px of an upright phone's edge (Safari's back swipe). */
export const EDGE = 16;
/** The canvas's last rows stay free of controls: a touch on the signal dock plays at y = h − 1. */
export const DOCK_ROW = 4;
/** Two neighbouring controls keep this far apart. */
export const GAP = 8;

export function layout(w: number, h: number, insets: Insets | number = NO_INSETS): Layout {
  const ins: Insets = typeof insets === 'number' ? { ...NO_INSETS, top: insets } : insets;
  const W = Math.max(240, w), H = Math.max(200, h);
  const portrait = H > W * 1.05;
  const u = uiScale(W, H);
  const T = Math.min(H * 0.5, Math.max(0, ins.top || 0));
  const left = Math.max(0, ins.left || 0) + EDGE;
  const right = W - Math.max(0, ins.right || 0) - EDGE;
  const bottom = Math.min(H - Math.max(0, ins.bottom || 0), H - DOCK_ROW);
  const span = right - left;
  if (!portrait) {
    // on its side or a desktop: ticket | wheel | kiln, the floor band under them
    const floor = bottom - Math.max(46 * u, Math.min(96 * u, H * 0.15));
    const axis = W * 0.5;
    const stageTop = T + 16;
    const stageH = Math.max(60, floor - stageTop);
    const stageW = Math.min(W * 0.17, 230 * u);
    const wheelRx = Math.min(stageW * 1.05, 150 * u);
    const ticketW = Math.min(250 * u, Math.max(186 * u, W * 0.2));
    const kilnW = Math.min(200 * u, Math.max(118 * u, W * 0.16));
    const kilnH = Math.min(kilnW, (floor - T) * 0.6);
    const gaugeR = Math.min(kilnW * 0.5, (floor - T) * 0.22);
    const ticketH = Math.max(108 * u, Math.min(176 * u, (floor - T) * 0.5));
    const doneW = 124 * u, doneH = 52 * u;
    const doneX = Math.min(right - doneW, axis + wheelRx + 14 * u);
    const kiln = { x: right - kilnW, y: floor + 20 * u - kilnH, w: kilnW, h: kilnH };
    const shelfX = axis + stageW + 30 * u;
    const talkX = axis + 24 * u;
    return {
      w: W, h: H, top: T, left, right, bottom, portrait, u, axis, floor, stageH, stageW,
      wheel: { x: axis, y: floor, rx: wheelRx, ry: wheelRx * 0.2 },
      level: { x: axis - 46 * u, y: floor + Math.min(18 * u, (bottom - floor) * 0.3), w: 92 * u, h: 16 * u },
      charge: { x: axis - wheelRx - 30 * u, y: floor - 30 * u, r: 22 * u },
      done: { x: doneX, y: floor - doneH - 18 * u, w: doneW, h: doneH },
      ticket: { x: left, y: T + 10, w: ticketW, h: Math.min(ticketH, floor - T - 60 * u) },
      customer: { x: left + ticketW * 0.5, y: floor + 20 * u, s: Math.min(170 * u, (floor - T) * 0.4) },
      kiln,
      gauge: { x: kiln.x + kilnW / 2, y: kiln.y - 16 * u, r: gaugeR },
      shelf: { x: shelfX, y: T + 46 * u, w: Math.max(60, right - shelfX), h: 9 },
      cat: { x: right - 34 * u, y: T + 46 * u, s: 44 * u },
      talk: { x: right, y: T + 58 * u, maxW: Math.min(320 * u, right - talkX), side: 'left' },
    };
  }
  // upright: the top band (ticket left, kiln with the cat right), the stage, the floor band (thumb zone)
  const ticketW = Math.min(span * 0.62, 300 * u);
  const ticketH = 100 * u;
  const ticket = { x: left, y: T + 8, w: ticketW, h: ticketH };
  const kilnW = Math.min(104 * u, right - (ticket.x + ticket.w) - 12);
  const kilnH = kilnW * 0.86;
  const shelfY = ticket.y + ticket.h + 6;
  const kiln = { x: right - kilnW, y: shelfY - kilnH - 2, w: kilnW, h: kilnH };
  // the floor band: the level, the master's hand and Gotowe, its top a finger's lift (LIFT, index.ts) under the wheel
  // line — a finger working the pot's foot stays above the button
  const floorBand = 100 * u;
  const floor = bottom - floorBand;
  const stageTop = shelfY + 14;
  const stageH = Math.max(60, floor - stageTop);
  const stageW = Math.min(span * 0.3, 150 * u);
  const axis = (left + right) / 2;
  const wheelRx = Math.min(stageW * 1.1, 130 * u);
  const doneW = 124 * u, doneH = 52 * u;
  const done = { x: right - doneW, y: bottom - 12 * u - doneH, w: doneW, h: doneH };
  const levelW = 72 * u;
  const levelX = Math.min(axis - levelW / 2, done.x - 12 - levelW);
  const shelfX = ticket.x + ticket.w + 10;
  return {
    w: W, h: H, top: T, left, right, bottom, portrait, u, axis, floor, stageH, stageW,
    wheel: { x: axis, y: floor, rx: wheelRx, ry: wheelRx * 0.2 },
    level: { x: levelX, y: floor + 16 * u, w: levelW, h: 16 * u },
    charge: { x: left + 26 * u, y: floor + 46 * u, r: 22 * u },
    done,
    ticket,
    customer: { x: left + 30 * u, y: floor - 4, s: Math.min(100 * u, stageH * 0.45) },
    kiln,
    gauge: { x: kiln.x + kilnW / 2, y: kiln.y - 6, r: kilnW * 0.42 },
    shelf: { x: shelfX, y: shelfY, w: Math.max(40, right - shelfX), h: 6 },
    cat: { x: kiln.x + kilnW / 2, y: kiln.y + 4, s: 34 * u },
    talk: { x: right, y: shelfY + 10, maxW: Math.min(span * 0.7, 270 * u), side: 'left' },
  };
}

/** px per cm for an order, so that the tallest and widest the clay may go still fit the stage. */
export function stageScale(L: Layout, t: Target, room = L.stageH): number {
  const tall = t.H * Math.min(RULES.hMax, 1.32);
  const wide = widestOf(t.r) * 1.32;
  return Math.max(1, Math.min((room * 0.94) / tall, (L.stageW * 1.25) / wide));
}

/**
 * The glazing palette for `nColors` glazes and `nPatterns` patterns: the colours (finger-sized swatches),
 * the patterns' chips, the Gotowe button and the glazing wheel's floor above them.  Upright it is a bottom
 * sheet — the first colours beside Gotowe in the bottom row (Gotowe where the wheel's is), more colours in
 * a row above, the patterns above them (none while there is only one) — and the ticket shrinks to its glaze
 * line (`ticket`).  On its side and on a desktop: the colours' row along the bottom, the patterns over it,
 * Gotowe right of the piece.
 */
export interface Palette { colors: Circle[]; patterns: Rect[]; done: Rect; floor: number; top: number; ticket: Rect; axis: number; stageW: number }

export function palette(L: Layout, nColors: number, nPatterns: number): Palette {
  const u = L.u, span = L.right - L.left;
  const swatchR = Math.max(MIN_TAP / 2, 24 * u);
  const rowH = swatchR * 2 + 6 * u, chipH = Math.max(MIN_TAP, 46 * u);
  /** n items spread over [x0, x1], each `cell` wide at most */
  const spread = (n: number, x0: number, x1: number, cell: number): number[] => {
    const c = Math.min(cell, (x1 - x0) / Math.max(1, n));
    const s = x0 + (x1 - x0 - c * n) / 2;
    return Array.from({ length: n }, (_, i) => s + c * (i + 0.5));
  };
  if (L.portrait) {
    const done = L.done;
    // the bottom row: the first colours left of Gotowe; the rest (up to five a row) above it
    const inRow = Math.max(1, Math.floor((done.x - GAP - L.left) / (swatchR * 2 + 12 * u)));
    const first = Math.min(nColors, inRow);
    const rest = nColors - first;
    const colors: Circle[] = [];
    const rowY = done.y + done.h / 2;
    for (const x of spread(first, L.left, done.x - GAP, swatchR * 2 + 20 * u)) colors.push({ x, y: rowY, r: swatchR });
    let y = done.y;
    if (rest > 0) {
      const perRow = Math.max(1, Math.floor(span / (swatchR * 2 + 12 * u)));
      const rows = Math.ceil(rest / perRow);
      for (let r = rows - 1; r >= 0; r--) {
        const n = Math.min(perRow, rest - r * perRow);
        y -= rowH + 4 * u;
        for (const x of spread(n, L.left, L.right, swatchR * 2 + 22 * u)) colors.push({ x, y: y + rowH / 2, r: swatchR });
      }
      // keep the order: the bottom row first, then the rows above from the bottom up
    }
    // the patterns' chips (a single pattern is no choice: no row, the piece keeps the room)
    let patterns: Rect[] = [];
    if (nPatterns > 1) {
      y -= chipH + 8 * u;
      const chipW = Math.min(76 * u, (span - GAP * (nPatterns - 1)) / nPatterns);
      patterns = spread(nPatterns, L.left, L.right, chipW + GAP).map(x => ({ x: x - chipW / 2, y, w: chipW, h: chipH }));
    }
    const top = y;
    const ticket = { ...L.ticket, h: 62 * u };
    return { colors, patterns, done, floor: top - 12 * u, top, ticket, axis: L.axis, stageW: L.stageW };
  }
  // on its side / desktop: the colours along the bottom with Gotowe at the row's right end (under the right thumb),
  // the patterns over them
  const colorsY = L.bottom - 8 * u - rowH;
  const doneW = L.done.w, doneH = L.done.h;
  const done = { x: L.right - doneW, y: colorsY + (rowH - doneH) / 2, w: doneW, h: doneH };
  const regionR = done.x - GAP;
  const cell = Math.min(72 * u, (regionR - L.left) / Math.max(1, nColors));
  const cw = cell * nColors;
  // centred under the piece when they fit left of Gotowe, else pushed left
  const c0 = Math.max(L.left, Math.min(L.axis - cw / 2, regionR - cw));
  const colors = spread(nColors, c0, c0 + cw, cell).map(x => ({ x, y: colorsY + rowH / 2, r: swatchR }));
  const chipW = 76 * u;
  const many = nPatterns > 1;
  const pw = Math.min(regionR - L.left, (chipW + GAP) * Math.max(1, nPatterns));
  const p0 = Math.max(L.left, Math.min(L.axis - pw / 2, regionR - pw));
  const py = many ? colorsY - 8 * u - chipH : colorsY;
  const patterns = many ? spread(nPatterns, p0, p0 + pw, chipW + GAP).map(x => ({ x: x - chipW / 2, y: py, w: chipW, h: chipH })) : [];
  const floor = Math.min(py, done.y) - 14 * u;
  return { colors, patterns, done, floor, top: Math.min(py, done.y), ticket: L.ticket, axis: L.axis, stageW: L.stageW };
}

export const hit = (r: Rect, x: number, y: number, pad = 0): boolean =>
  x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

export const hitCircle = (c: Circle, x: number, y: number, pad = 6): boolean =>
  Math.hypot(x - c.x, y - c.y) <= c.r + pad;
