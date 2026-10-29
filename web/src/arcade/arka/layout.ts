/**
 * Where Arka's play view puts things (CSS px), for phones upright and on their side and for
 * desktops.  Upright ("stack"): the new land along the top under the runner's strip, the landing
 * with its stalls under it, the deck below.  Wide ("side"): the HUD on the left, the deck left of
 * centre, the land and the landing to its right.  The warm-up's deck always sits so that the smoke
 * test's tap (50 %, 60 %) falls on the centre of its anchor cell, where the sheep stands.  The
 * runner's top strip, the simulator button (bottom left) and the signal banner (bottom centre)
 * stay clear of the game's controls and text.
 */
import { clamp } from '../kit/juice';
import { ANCHOR } from './content';

/** The runner's own UI: the top strip (time, pause) and the bottom strip (signal banner, simulator button). */
export const TOP = 64;
export const BOTTOM = 66;
/** Stalls the landing can grow to. */
export const SLOTS = 6;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  mode: 'stack' | 'side';
  cols: number;
  rows: number;
  /** one deck cell (px) and the deck itself */
  c: number;
  deck: Rect;
  /** the rail's width around the deck */
  rail: number;
  /** the new land's panorama */
  land: Rect;
  /** the landing: the door at its left end, then six stalls (three built from the start) */
  landing: Rect;
  stall: number;
  door: Rect;
  /** where the rail meets the landing */
  gate: Pt;
  /** the status (block, line, bar) and the score's right edge and top */
  status: Rect;
  score: Pt;
  /** the leaf chip (tap it, then a waiting animal) */
  leaf: Rect;
}

const G = 14;

/** The play view's layout for a deck of `cols` × `rows`; `anchored`: the warm-up, its anchor cell under (50 %, 60 %). */
export function layout(w: number, h: number, cols: number, rows: number, anchored: boolean): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  return W / H >= 1.2 ? side(W, H, u, cols, rows, anchored) : stack(W, H, u, cols, rows, anchored);
}

/** The largest cell for the deck in `zone`, and the deck placed in it (the anchored warm-up keeps its cell under the smoke tap). */
function placeDeck(W: number, H: number, zone: Rect, cols: number, rows: number, anchored: boolean, cMax: number): { c: number; deck: Rect } {
  let c = Math.min(cMax, zone.w / cols, zone.h / rows);
  if (anchored) {
    const ax = W * 0.5, ay = H * 0.6;
    c = Math.min(c, (ax - zone.x) / (ANCHOR.x + 0.5), (zone.x + zone.w - ax) / (cols - ANCHOR.x - 0.5),
      (ay - zone.y) / (ANCHOR.y + 0.5), (zone.y + zone.h - ay) / (rows - ANCHOR.y - 0.5));
    c = Math.max(24, Math.floor(c));
    return { c, deck: { x: ax - (ANCHOR.x + 0.5) * c, y: ay - (ANCHOR.y + 0.5) * c, w: cols * c, h: rows * c } };
  }
  c = Math.max(22, Math.floor(c));
  const dw = cols * c, dh = rows * c;
  return { c, deck: { x: Math.round(zone.x + (zone.w - dw) / 2), y: Math.round(zone.y + (zone.h - dh) / 2), w: dw, h: dh } };
}

function stack(W: number, H: number, u: number, cols: number, rows: number, anchored: boolean): Layout {
  const landH = clamp(H * 0.2, 120, 230);
  const land = { x: 0, y: TOP, w: W, h: landH };
  // the landing and the leaf chip beside it share one row
  const leafS = Math.round(clamp(W * 0.11, 40, 52));
  const stall = Math.floor(clamp((W - 2 * G - leafS - 8) / (SLOTS + 1.1), 36, 62));
  const doorW = Math.round(stall * 1.1);
  const lw = doorW + SLOTS * stall;
  const landing = { x: Math.round((W - lw - 8 - leafS) / 2), y: Math.round(TOP + landH + 4), w: lw, h: stall + 14 };
  const rail0 = 14 * u;
  const zone = { x: G + rail0, y: landing.y + landing.h + 10 + rail0, w: W - 2 * (G + rail0), h: 0 };
  zone.h = H - BOTTOM - rail0 - 4 - zone.y;
  const cMax = W >= 900 && H >= 700 ? 76 : 62;
  const { c, deck } = placeDeck(W, H, zone, cols, rows, anchored, cMax);
  const rail = Math.round(clamp(c * 0.3, 10, 20));
  const door = { x: landing.x, y: landing.y, w: doorW, h: landing.h };
  const gate = { x: landing.x + doorW + stall * 1.5, y: landing.y + landing.h };
  const status = { x: G + 4, y: TOP + 6, w: Math.min(W * 0.58, 330 * u), h: landH - 12 };
  const leaf = { x: landing.x + lw + 8, y: landing.y + (landing.h - leafS) / 2, w: leafS, h: leafS };
  return { w: W, h: H, u, mode: 'stack', cols, rows, c, deck, rail, land, landing, stall, door, gate, status, score: { x: W - G - 4, y: TOP + 6 }, leaf };
}

function side(W: number, H: number, u: number, cols: number, rows: number, anchored: boolean): Layout {
  const hudW = clamp(W * 0.22, 170, 290);
  const rail0 = 14 * u;
  const colMin = clamp(W * 0.3, 230, 520);
  // the deck between the HUD and the right column, above the banner
  const zone = { x: hudW + rail0 + 10, y: TOP + rail0 + 2, w: 0, h: 0 };
  zone.w = W - colMin - G - rail0 - 14 - zone.x;
  zone.h = H - 60 - rail0 - zone.y;
  const cMax = H >= 700 ? 76 : 62;
  const { c, deck } = placeDeck(W, H, zone, cols, rows, anchored, cMax);
  const rail = Math.round(clamp(c * 0.3, 10, 20));
  const rx = Math.max(deck.x + deck.w + rail + 18, W - G - colMin);
  const colW = W - G - rx;
  const landH = Math.round(clamp((H - TOP) * 0.44, 110, 380));
  const land = { x: rx, y: TOP, w: colW, h: landH };
  const stall = Math.floor(clamp(colW / (SLOTS + 1.3), 30, 62));
  const doorW = Math.round(stall * 1.1);
  const lw = doorW + SLOTS * stall;
  const landing = { x: Math.round(rx + (colW - lw) / 2), y: Math.round(TOP + landH + 6), w: lw, h: stall + 14 };
  const door = { x: landing.x, y: landing.y, w: doorW, h: landing.h };
  const gate = { x: landing.x, y: landing.y + landing.h / 2 };
  const leafS = Math.round(clamp(stall * 1.05, 40, 52));
  const leaf = { x: landing.x + lw - leafS, y: landing.y + landing.h + 10, w: leafS, h: leafS };
  const status = { x: G + 4, y: TOP + 4, w: hudW - G - 8, h: H - TOP - 80 };
  return { w: W, h: H, u, mode: 'side', cols, rows, c, deck, rail, land, landing, stall, door, gate, status, score: { x: hudW - 10, y: TOP + 4 }, leaf };
}

/** A stall's centre (i: 0..5). */
export function stallAt(L: Layout, i: number, out: Pt): Pt {
  out.x = L.landing.x + L.door.w + (i + 0.5) * L.stall;
  out.y = L.landing.y + L.landing.h * 0.54;
  return out;
}

/** A cell's centre. */
export function cellAt(L: Layout, x: number, y: number, out: Pt): Pt {
  out.x = L.deck.x + (x + 0.5) * L.c;
  out.y = L.deck.y + (y + 0.5) * L.c;
  return out;
}

/** The deck cell under a point (null: none). */
export function cellUnder(L: Layout, x: number, y: number): { x: number; y: number } | null {
  const cx = Math.floor((x - L.deck.x) / L.c), cy = Math.floor((y - L.deck.y) / L.c);
  return cx >= 0 && cy >= 0 && cx < L.cols && cy < L.rows ? { x: cx, y: cy } : null;
}

/** The stall under a point (−1: none). */
export function stallUnder(L: Layout, x: number, y: number): number {
  if (y < L.landing.y - 6 || y > L.landing.y + L.landing.h + 6) return -1;
  const i = Math.floor((x - L.landing.x - L.door.w) / L.stall);
  return i >= 0 && i < SLOTS ? i : -1;
}

export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

/**
 * The rail around the deck as a ring at half the rail's width: a point on it from a perimeter
 * coordinate s (0 at the top-left corner, clockwise), and the coordinate of a point on it.
 */
export function railRect(L: Layout): Rect {
  const k = L.rail * 0.5;
  return { x: L.deck.x - k, y: L.deck.y - k, w: L.deck.w + 2 * k, h: L.deck.h + 2 * k };
}

export function railPoint(r: Rect, s: number, out: Pt): Pt {
  const P = 2 * (r.w + r.h);
  let q = ((s % P) + P) % P;
  if (q < r.w) { out.x = r.x + q; out.y = r.y; return out; }
  q -= r.w;
  if (q < r.h) { out.x = r.x + r.w; out.y = r.y + q; return out; }
  q -= r.h;
  if (q < r.w) { out.x = r.x + r.w - q; out.y = r.y + r.h; return out; }
  q -= r.w;
  out.x = r.x;
  out.y = r.y + r.h - q;
  return out;
}

export function railCoord(r: Rect, x: number, y: number): number {
  // the nearest side
  const dTop = Math.abs(y - r.y), dRight = Math.abs(x - (r.x + r.w)), dBottom = Math.abs(y - (r.y + r.h)), dLeft = Math.abs(x - r.x);
  const m = Math.min(dTop, dRight, dBottom, dLeft);
  if (m === dTop) return clamp(x - r.x, 0, r.w);
  if (m === dRight) return r.w + clamp(y - r.y, 0, r.h);
  if (m === dBottom) return r.w + r.h + clamp(r.x + r.w - x, 0, r.w);
  return 2 * r.w + r.h + clamp(r.y + r.h - y, 0, r.h);
}

/** Where the rail meets the walkway to the landing (on the ring). */
export function railGate(L: Layout, r: Rect, out: Pt): Pt {
  if (L.mode === 'stack') {
    out.x = clamp(L.gate.x, r.x, r.x + r.w);
    out.y = r.y;
  } else {
    out.x = r.x + r.w;
    out.y = clamp(L.gate.y, r.y, r.y + r.h);
  }
  return out;
}
