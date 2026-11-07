/**
 * Where Arka's parts sit on the canvas (CSS px), for any screen: the runner's HUD band at the top
 * (`top`, from env.hudTop()), under it the deck's bar (hearts, the level, the dove's button), the deck
 * itself (the board's grid, centred, its cells as large as fit), and the new land's strip at the
 * bottom where the first of each kind waits for its mate.  The raven perches on the deck's rail.
 * Pure arithmetic, so the tests can check every screen size.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export interface Layout {
  w: number;
  h: number;
  top: number;
  portrait: boolean;
  /** a short landscape screen: the deck right of the panel, the bar and the new land in the column under it */
  compact: boolean;
  /** a wide landscape screen: the deck in the middle column between the panel and the score, up to the top bar */
  wide: boolean;
  /** the bar over the deck: hearts on the left, the level in the middle, the dove on the right */
  bar: Rect;
  dove: Pt & { r: number };
  /** the deck's grid */
  deck: Rect;
  cell: number;
  cols: number;
  rows: number;
  /** the new land's strip, and the gangway's foot on it (the deck's door) */
  shore: Rect;
  door: Pt;
  /** the raven's perch (its feet) and its size */
  raven: Pt & { s: number };
}

export const BAR_H = 40;
export const MAX_CELL = 68;

export function layout(w: number, h: number, top: number, cols: number, rows: number): Layout {
  const portrait = h > w;
  const m = 12;
  const t = Math.max(0, Math.min(top, h * 0.45)) + 4;
  const s0 = (cell: number) => Math.max(26, Math.min(46, cell * 0.8));
  // a short landscape screen (a phone on its side): the deck goes right of the Mendi panel, under the
  // score corner only, and the bar and the new land fill the column under the panel
  if (!portrait && h - t < 330) {
    const split = Math.round(w * 0.64) + 6;
    const y0 = Math.round(Math.min(t, Math.max(56, t * 0.55)));
    // the score corner (about 120 px wide) sits top right: the deck keeps left of it
    const availW = Math.max(40, w - split - 138), availH = Math.max(40, h - y0 - 10);
    const cell = Math.max(12, Math.floor(Math.min(availW / cols, availH / rows, MAX_CELL)));
    const dw = cell * cols, dh = cell * rows;
    const deck: Rect = { x: Math.round(split + (availW - dw) / 2), y: Math.round(y0 + (availH - dh) / 2), w: dw, h: dh };
    const bar: Rect = { x: m, y: t, w: split - 2 * m, h: BAR_H };
    const shore: Rect = { x: 0, y: bar.y + bar.h + 6, w: split - m, h: Math.max(40, h - (bar.y + bar.h + 6)) };
    const r = 19;
    const s = s0(cell) * 0.85;
    return {
      w, h, top: t, portrait, compact: true, wide: false, bar, dove: { x: bar.x + bar.w - r - 2, y: bar.y + bar.h / 2, r }, deck, cell, cols, rows, shore,
      door: { x: deck.x + deck.w / 2, y: deck.y + deck.h }, raven: { x: split - s * 0.9, y: shore.y + s * 0.2, s },
    };
  }
  const shoreH = Math.round(Math.max(44, Math.min(72, h * 0.085)));
  // a wide landscape screen: the Mendi panel (top left, ~340 px) and the score (top right, ~130 px)
  // leave the middle column free up to the top bar, so the deck rises into it and its cells grow
  if (!portrait && w >= 760) {
    const panelR = Math.min(352, w * 0.3) + 14, scoreL = w - 142;
    const half = Math.max(120, Math.min(w / 2 - panelR, scoreL - w / 2));
    const bar: Rect = { x: Math.round(w / 2 - half), y: 60, w: Math.round(half * 2), h: BAR_H };
    const areaTop = bar.y + bar.h + 8, areaBot = h - shoreH - 8;
    const availW = bar.w, availH = Math.max(40, areaBot - areaTop);
    const cell = Math.max(12, Math.floor(Math.min(availW / cols, availH / rows, MAX_CELL)));
    const dw = cell * cols, dh = cell * rows;
    const deck: Rect = { x: Math.round((w - dw) / 2), y: Math.round(areaTop + Math.max(0, (availH - dh) / 2)), w: dw, h: dh };
    const shore: Rect = { x: 0, y: h - shoreH, w, h: shoreH };
    const r = 21;
    const s = s0(cell);
    // the raven stands right of the deck, under the score corner
    const rx = Math.min(w - s * 1.2, deck.x + deck.w + Math.max(s * 1.1, Math.min(90, (w - deck.x - deck.w) * 0.3)));
    return {
      w, h, top: t, portrait, compact: false, wide: true, bar, dove: { x: bar.x + bar.w - r - 2, y: bar.y + bar.h / 2, r }, deck, cell, cols, rows, shore,
      door: { x: deck.x + deck.w / 2, y: deck.y + deck.h }, raven: { x: rx, y: Math.max(t + s * 1.2, deck.y + s * 1.6), s },
    };
  }
  const barW = portrait ? w - 2 * m : Math.min(w - 2 * m, Math.max(420, w * 0.5));
  const bar: Rect = { x: Math.round((w - barW) / 2), y: t, w: barW, h: BAR_H };
  const areaTop = bar.y + bar.h + 6;
  const areaBot = h - shoreH - 8;
  // landscape screens keep room beside the deck for the raven; phones use the whole width
  const side = portrait ? m + 2 : Math.max(m + 4, Math.min(150, w * 0.12));
  const availW = Math.max(40, w - 2 * side);
  const availH = Math.max(40, areaBot - areaTop);
  const cell = Math.max(12, Math.floor(Math.min(availW / cols, availH / rows, MAX_CELL)));
  const dw = cell * cols, dh = cell * rows;
  const deck: Rect = { x: Math.round((w - dw) / 2), y: Math.round(areaTop + Math.max(0, (availH - dh) / 2)), w: dw, h: dh };
  const shore: Rect = { x: 0, y: h - shoreH, w, h: shoreH };
  const r = 21;
  const dove = { x: bar.x + bar.w - r - 2, y: bar.y + bar.h / 2, r };
  const s = s0(cell);
  // the raven: beside the deck's top-right corner when there is room, else on the rail's corner
  const roomRight = w - (deck.x + deck.w);
  const raven = roomRight > s * 2.2
    ? { x: deck.x + deck.w + Math.min(roomRight * 0.45, s * 1.4), y: deck.y + s * 1.4, s }
    : { x: deck.x + deck.w - s * 0.55, y: deck.y - 4, s: s * 0.85 };
  return { w, h, top: t, portrait, compact: false, wide: false, bar, dove, deck, cell, cols, rows, shore, door: { x: deck.x + deck.w / 2, y: deck.y + deck.h }, raven };
}

/** The centre of a board cell in canvas px. */
export const cellCentre = (L: Layout, x: number, y: number): Pt => ({ x: L.deck.x + (x + 0.5) * L.cell, y: L.deck.y + (y + 0.5) * L.cell });

/** The board cell under a canvas point (null: off the deck). */
export function cellAt(L: Layout, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - L.deck.x) / L.cell), y = Math.floor((py - L.deck.y) / L.cell);
  return x >= 0 && y >= 0 && x < L.cols && y < L.rows ? { x, y } : null;
}

/** The mist's clear circle: centred on the door, its radius a share of the farthest corner's distance. */
export function sightRadius(L: Layout, share: number): number {
  const far = Math.hypot(L.deck.w / 2, L.deck.h);
  return far * share;
}

export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean =>
  x >= r.x - pad && y >= r.y - pad && x <= r.x + r.w + pad && y <= r.y + r.h + pad;
