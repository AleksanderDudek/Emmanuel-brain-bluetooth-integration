/**
 * Where Urodzaj's play view puts things.  The basket is centred horizontally in every layout (the
 * smoke test's centre taps aim at it), sized in px per W (`s`) so its world box — 1.07 W wide and
 * 1.275 W tall with the walls, the floor and the room above the rim for the largest drop — fits
 * between the runner's strips (the clock and pause button on top, the signal banner and simulator
 * button below).  On a portrait phone the HUD stacks above the basket and the stamp slot sits in the
 * hills between them; when wide, the score and the table panel take the left column, the next fruit,
 * the ladder, the block and the stamps the right one.
 */
import { clamp } from '../kit/juice';
import { BASKET } from './physics';

/** The runner's own UI: the top strip (timer, pause), the bottom strip (signal banner, simulator button). */
export const TOP = 64;
export const BOTTOM = 66;

/** The basket's world box (W): width with the walls, height from under the floor to the top of the largest hanging fruit. */
export const BOX_W = 1.07;
export const BOX_H = 1.275;
/** the largest drop (a fig) and its top above the hang line (W) */
export const DROP_MAX_R = 0.079;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  portrait: boolean;
  /** px per W, the basket's centre x and the floor's y (screen px) */
  s: number;
  cx: number;
  floorY: number;
  rimY: number;
  hangY: number;
  /** the vine border's width at both sides */
  border: number;
  /** the HUD's places: the score, the next fruit's roundel (its centre and radius), the ladder strip, the block label, the tip */
  score: Rect;
  next: { x: number; y: number; r: number };
  ladder: Rect;
  label: Rect;
  tip: Rect;
  /** at most this many lines of tip */
  tipLines: number;
  /** the stamp slot's centre and the width a stamp may take */
  stamp: { x: number; y: number; w: number };
  /** the table panel (wide layouts only) */
  table: Rect | null;
  /** where the gleaners stand (the field's edge, left of the basket) */
  gleaners: { x: number; y: number; size: number };
}

/** World x and y (W, y up) to screen px. */
export const sx = (L: Layout, x: number): number => L.cx + x * L.s;
export const sy = (L: Layout, y: number): number => L.floorY - y * L.s;

export function layout(w: number, h: number): Layout {
  const u = clamp(Math.min(w, h) / 430, 0.84, 1.25);
  const border = Math.round(12 * u);
  const portrait = h >= 1.15 * w;
  let s: number, floorY: number;
  if (portrait) {
    s = Math.min((w - 32) / BOX_W, (h - TOP - BOTTOM - 124 * u - 14) / BOX_H, 600);
    floorY = h - BOTTOM - 4 - BASKET.wall * Math.max(60, s);
  } else {
    const colW = clamp(0.22 * w, 170 * u, 340);
    s = Math.min((h - TOP - BOTTOM - 8) / BOX_H, (w - 2 * colW) / BOX_W, 600);
    // the woven floor band under the floor stays above the bottom strip
    floorY = h - BOTTOM - 4 - BASKET.wall * Math.max(60, s);
  }
  s = Math.max(60, s);
  const cx = w / 2;
  const rimY = floorY - BASKET.rim * s;
  const hangY = floorY - BASKET.hang * s;
  const boxTop = hangY - DROP_MAX_R * s;
  const L: Layout = {
    w, h, u, portrait, s, cx, floorY, rimY, hangY, border,
    score: { x: 0, y: 0, w: 0, h: 0 }, next: { x: 0, y: 0, r: 0 }, ladder: { x: 0, y: 0, w: 0, h: 0 }, label: { x: 0, y: 0, w: 0, h: 0 },
    tip: { x: 0, y: 0, w: 0, h: 0 }, tipLines: 2, stamp: { x: cx, y: 0, w: 0 }, table: null,
    gleaners: { x: 0, y: 0, size: 0 },
  };
  if (portrait) {
    // the HUD stack: the score row, the ladder, the block, the tip — compressed on a short phone
    const avail = boxTop - TOP - 4;
    const f = Math.min(u, avail / 142);
    const pad = 18;
    let y = TOP + 6 * f;
    L.score = { x: pad, y, w: w - 2 * pad - 60 * u, h: 44 * f };
    L.next = { x: w - pad - 20 * u, y: y + 24 * f, r: 20 * Math.min(u, f + 0.1) };
    y += 50 * f;
    L.ladder = { x: pad, y, w: w - 2 * pad, h: 16 * f };
    y += 22 * f;
    L.label = { x: pad, y, w: w - 2 * pad, h: 22 * f };
    y += 28 * f;
    L.tip = { x: pad + 6, y, w: w - 2 * pad - 12, h: 36 * f };
    L.tipLines = 2;
    const below = y + 36 * f;
    const room = boxTop - below;
    // the stamp in the hills between the HUD and the basket, or over the basket's empty top on a short phone
    L.stamp = { x: cx, y: room > 90 * u ? below + room * 0.46 : hangY + 6 * u, w: Math.min(w - 40, 320 * u) };
    // no room beside the basket on a phone: the gleaners stand on the hill above the twig, at the left
    const size = 30 * u;
    L.gleaners = { x: border + 34 * u, y: hangY - DROP_MAX_R * s - 10 * u - size * 0.5, size };
  } else {
    const left = sx(L, -BOX_W / 2), right = sx(L, BOX_W / 2);
    // the gleaners at the field's edge, low beside the basket's left wall (the table panel ends above them)
    const size = 30 * u;
    L.gleaners = { x: left - 30 * u, y: floorY - 0.2 * s, size };
    const lx = border + 14 * u, lw = Math.max(80, left - 16 - lx);
    const rx = right + 16, rw = Math.max(80, w - border - 14 * u - rx);
    let y = TOP + 8;
    L.score = { x: lx, y, w: lw, h: 56 * u };
    const tableTop = y + 66 * u;
    const th = Math.min(h - BOTTOM - 8 - tableTop, lw * 0.78, L.gleaners.y - size - 16 * u - tableTop);
    L.table = th > 90 * u ? { x: lx, y: tableTop, w: lw, h: th } : null;
    let ry = TOP + 8;
    L.next = { x: rx + 22 * u, y: ry + 24 * u, r: 20 * u };
    ry += 54 * u;
    L.ladder = { x: rx, y: ry, w: rw, h: 16 * u };
    ry += 26 * u;
    L.label = { x: rx, y: ry, w: rw, h: 24 * u };
    ry += 32 * u;
    L.tipLines = 3;
    L.tip = { x: rx, y: ry, w: rw, h: 18 * u * 3 };
    ry += L.tip.h + 18 * u;
    L.stamp = { x: rx + rw / 2, y: Math.min(h - BOTTOM - 60 * u, ry + 44 * u), w: rw };
  }
  return L;
}
