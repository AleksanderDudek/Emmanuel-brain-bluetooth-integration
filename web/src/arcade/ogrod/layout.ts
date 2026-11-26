/**
 * Ogród o świcie's layout (DESIGN.md §23, mobile first, then the desk).  The garden's picture fills the whole canvas
 * (the sky runs under the runner's HUD, the garden's front under the words); what matters stands in the `view`, the
 * window inside the insets, under the HUD band and above the words:
 *
 *   tall   a phone upright: the view above; at the bottom the words' band and, under it, the breath guide (its word
 *          beside the ring)
 *   side   a phone on its side: the view on the left; a column on the right with the band, the guide under it
 *   wide   a tablet or the desk: the view over the whole width; the band at the bottom centre, the guide left of it
 *
 * The station's name card stands at the top of the view; the hands of light (Dłoń, Kamienie) in its lower part; the
 * close's 0–10 row (one row of 11, or 6 + 5, or 4 + 4 + 3 at 44 px), its question and its words at the foot.  Pure
 * numbers, CSS px.
 */
import { MIN_TAP, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { VIEW_Y, WORLD_W } from './world';

export type { Rect };
export type LayoutKind = 'tall' | 'side' | 'wide';

export interface Layout {
  w: number;
  h: number;
  kind: LayoutKind;
  /** the window on the garden where what matters stands */
  view: Rect;
  /** px per world unit for the garden's places (before a place's zoom), and at the dawn's whole view */
  s: number;
  sDawn: number;
  /** the station's name card */
  title: Rect;
  /** the words' band */
  band: Rect;
  /** the breath guide: its ring's middle and radius, its words beside (row) or under (stack), the widest its words may be */
  guide: { cx: number; cy: number; r: number; layout: 'stack' | 'row'; maxW: number };
  /** the hands of light: where the palm (or the cupped pair's rest) stands and px per hand unit */
  hands: { cx: number; cy: number; px: number };
  /** the close: its question line, its 0–10 buttons, its words above them */
  rateQ: Rect;
  rate: Rect[];
  closeText: Rect;
  /** the name in light at the dawn */
  name: Rect;
  /** the text's base size (CSS px) */
  font: number;
}

/** How many screens wide the garden is on each layout (the panorama the camera walks). */
const SCREENS: Readonly<Record<LayoutKind, number>> = { tall: 2.6, side: 2.0, wide: 1.6 };

/** The breath guide's height for a ring radius (its scrim, the word and the "oddech 2 z 3" line). */
export const guideHeight = (r: number, layout: 'stack' | 'row'): number => (layout === 'row' ? 2 * r + 26 : 2 * r + 78);

/** The 0–10 row: one row of eleven where it fits at MIN_TAP, else two (6 + 5), else three (4 + 4 + 3). */
function rateRow(area: Rect): Rect[] {
  const gap = 6;
  const out: Rect[] = [];
  const per = rateCols(area.w);
  const rows = Math.ceil(11 / per);
  const bw = Math.max(MIN_TAP, Math.min(56, (area.w - (per - 1) * gap) / per));
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const k = Math.min(per, 11 - n);
    const total = k * bw + (k - 1) * gap;
    const x0 = area.x + (area.w - total) / 2;
    for (let i = 0; i < k; i++) out.push({ x: x0 + i * (bw + gap), y: area.y + r * (MIN_TAP + gap), w: bw, h: MIN_TAP });
    n += k;
  }
  return out;
}

const rateCols = (w: number): number => (w >= 11 * MIN_TAP + 60 ? 11 : w >= 6 * MIN_TAP + 30 ? 6 : 4);
const rateH = (w: number): number => { const rows = Math.ceil(11 / rateCols(w)); return rows * MIN_TAP + (rows - 1) * 6; };

export function layout(w: number, h: number, ins: Insets): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const L = ins.left + 10, R = W - ins.right - 10, T = ins.top + 6, B = H - ins.bottom - 8;
  const kind: LayoutKind = W >= 900 && H >= 560 ? 'wide' : W > H * 1.15 ? 'side' : 'tall';
  const font = kind === 'wide' ? Math.min(20, 15 + (Math.min(W, 1600) - 900) / 140) : 15;
  let view: Rect, band: Rect, guide: Layout['guide'], closeArea: Rect;

  if (kind === 'tall') {
    const r = 26, gH = guideHeight(r, 'row');
    const bandH = Math.max(84, Math.min(118, H * 0.15));
    guide = { cx: (L + R) / 2 - 44, cy: B - gH / 2, r, layout: 'row', maxW: (R - L) / 2 };
    band = { x: L, y: B - gH - 6 - bandH, w: R - L, h: bandH };
    view = { x: L, y: T, w: R - L, h: Math.max(90, band.y - 4 - T) };
    const closeY = Math.min(band.y, B - rateH(R - L) - 52 - 104);
    closeArea = { x: L, y: closeY, w: R - L, h: B - closeY };
  } else if (kind === 'side') {
    const colW = Math.max(210, Math.min(320, (R - L) * 0.4));
    const colX = R - colW;
    const r = Math.max(18, Math.min(24, (B - T) * 0.07)), gH = guideHeight(r, 'row');
    band = { x: colX, y: T, w: colW, h: Math.max(56, B - T - gH - 6) };
    guide = { cx: colX + colW / 2 - 40, cy: B - gH / 2, r, layout: 'row', maxW: colW / 2 };
    view = { x: L, y: T, w: Math.max(90, colX - 10 - L), h: B - T };
    closeArea = { x: colX, y: T, w: colW, h: B - T };
  } else {
    const bandH = Math.max(100, Math.min(136, H * 0.14));
    const bandW = Math.min(860, (R - L) - 2 * 200);
    band = { x: (W - bandW) / 2, y: B - bandH, w: bandW, h: bandH };
    const r = Math.max(28, Math.min(38, bandH * 0.26)), gH = guideHeight(r, 'stack');
    guide = { cx: Math.max(L + 80, band.x - 24 - 80), cy: B - gH + 10 + r, r, layout: 'stack', maxW: 160 };
    view = { x: L, y: T, w: R - L, h: Math.max(120, band.y - 8 - T) };
    closeArea = { x: band.x, y: band.y - 40, w: band.w, h: B - band.y + 40 };
  }

  // the garden's scale: the band of the world that matters fills the view's height, the panorama its screens wide
  const span = VIEW_Y.bottom - VIEW_Y.top;
  const s = Math.max(60, Math.min(view.h / span, (view.w * SCREENS[kind]) / WORLD_W));
  // the dawn: as much of the garden as fits the width, never smaller than 0.62 of the places' scale
  const sDawn = Math.max(s * 0.62, Math.min(s, W / (WORLD_W * 1.02)));

  // the name card: the top of the view
  const titleH = Math.min(64, Math.max(46, view.h * 0.2));
  const title: Rect = { x: view.x, y: view.y + 2, w: view.w, h: titleH };
  // the hands: in the view's lower part, sized to it
  const hpx = Math.max(70, Math.min(view.w * 0.32, view.h * 0.5, 260));
  const hands = { cx: view.x + view.w / 2, cy: view.y + view.h - hpx * 0.52, px: hpx };

  // the close: the question line and the row at the bottom of its area, its words above them
  const rh = rateH(closeArea.w);
  const rateArea: Rect = { x: closeArea.x, y: closeArea.y + closeArea.h - rh, w: closeArea.w, h: rh };
  // the question (font + 1) over its "0 — lekko, 10 — bardzo ciężko" line (font − 2, at least 13 px) on one scrim:
  // taller with a big screen's font, so it never reaches over the row
  const qH = Math.max(42, Math.round(font + 8) + Math.max(13, Math.round(font - 2)) + 3);
  const rateQ: Rect = { x: closeArea.x, y: rateArea.y - 4 - qH, w: closeArea.w, h: qH };
  const textH = kind === 'wide' ? 116 : Math.max(60, rateQ.y - 6 - closeArea.y);
  const closeText: Rect = { x: closeArea.x, y: rateQ.y - 6 - textH, w: closeArea.w, h: textH };
  // the name in light: the middle of the view's upper part (over the garden, under the HUD)
  const name: Rect = { x: view.x, y: view.y + view.h * 0.12, w: view.w, h: Math.max(60, view.h * 0.32) };
  return { w: W, h: H, kind, view, s, sDawn, title, band, guide, hands, rateQ, rate: rateRow(rateArea), closeText, name, font };
}
