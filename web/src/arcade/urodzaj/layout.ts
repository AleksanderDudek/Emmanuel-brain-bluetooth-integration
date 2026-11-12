/**
 * Where Urodzaj's scene sits on the canvas (CSS px), phone first (src/arcade/DESIGN.md §6, §12): the basket's
 * scale S (CSS px per W), its centre and floor, the twine Feliks flies along, the next fruit's bubble, the circle
 * of fruits, the gleaners and the table.  The runner's HUD covers the top (`insets().top`), a phone's home
 * indicator the bottom; the field runs under them, the game's words stay inside.
 *
 *   tall  a phone (or a tablet) upright: the basket as wide as the band allows, its ground on the circle of
 *         fruits — a strip of eleven along the bottom, 16 px off the edges; the next fruit's bubble (44 px and
 *         up, "Następny" at 13 px) beside Feliks's twine in the right margin, or — where a wide phone would
 *         have to shrink the basket for that margin — on its own row under the HUD, the basket below it.  A
 *         finger anywhere aims (the fruit hangs at the top, over the finger), so the thumb zone is the basket's
 *         lower half and the strip
 *   wide  a desktop, a tablet or a phone on its side: the circle left of the basket, the table right of it, the
 *         basket risen between the runner's panel and score where it is clear of both
 *
 * `u` is 1 on any phone and grows to 1.3 (kit/mobile `uiScale`).  Pure: the tests run it at every CHECK_SIZES entry.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { BASKET } from './rules';

export type { Rect };

export interface Layout {
  w: number;
  h: number;
  wide: boolean;
  /** UI scale: 1 on any phone, up to 1.3 */
  u: number;
  /** what covers each edge; the top of the play (the runner's HUD's lower edge where it must be); the lowest y of words */
  ins: Insets;
  top: number;
  bottom: number;
  /** the words' side margins */
  left: number;
  right: number;
  /** CSS px per W, the basket's centre x and its floor's y */
  S: number;
  cx: number;
  floor: number;
  /** the ground line (the basket stands on it) */
  ground: number;
  /** the next fruit's bubble: centre and radius; its label's size (px) and baseline; beside Feliks's twine (else on a row above it) */
  next: { x: number; y: number; r: number; label: number; labelY: number; beside: boolean };
  /** the circle of fruits: a ring (wide) or a strip (tall) — `r` the ring's radius or a strip icon's */
  ring: { x: number; y: number; r: number; strip: boolean; w: number };
  /** the gleaners stand here (their feet) */
  glean: { x: number; y: number; s: number };
  /** the table (wide: right of the basket; tall: off screen right) */
  table: { x: number; y: number; w: number; on: boolean };
  /** the cards' room (the story, the tally, a festival) */
  cards: Rect;
}

/** The runner's panel and score sizes on a wide screen (CSS px), for the "rise between them" check. */
const PANEL_W = 350;
const SCORE_W = 240;
/** the scene's height in W: from Feliks's head (over the twine) to the ground under the basket; its width with the walls */
const ABOVE = BASKET.hang + 0.24;
const BELOW = 0.07;
const WALLS = 1.09;

/** `insets` as the runner reports them (a bare number is the HUD's lower edge, as before the insets). */
export function computeLayout(w: number, h: number, insets: Partial<Insets> | number = NO_INSETS): Layout {
  const ins: Insets = typeof insets === 'number' ? { ...NO_INSETS, top: insets } : { ...NO_INSETS, ...insets };
  const W = Math.max(1, w), H = Math.max(1, h);
  const u = uiScale(W, H);
  const hudTop = clamp(ins.top, 0, H * 0.6);
  const wide = W >= H * 1.05;
  const label = Math.round(13 * u);
  if (wide) {
    const margin = 10;
    const left = Math.max(12, ins.left + 6), right = W - Math.max(12, ins.right + 6);
    const bottom = H - Math.max(margin, ins.bottom + 4);
    const sBelow = Math.min((bottom - hudTop - margin) / (ABOVE + BELOW), (W * 0.5) / 1.12);
    // free of the panel and the score at its width: the basket may start high
    const sHigh = Math.min((bottom - margin - 6) / (ABOVE + BELOW), (W * 0.5) / 1.12);
    const halfPx = (sHigh * 1.12) / 2 + 30;
    const clear = W / 2 - halfPx > PANEL_W && W / 2 - halfPx > SCORE_W;
    const S = Math.max(40, clear ? sHigh : sBelow);
    const top = clear ? margin : hudTop;
    const floor = Math.min(bottom - BELOW * S, top + ABOVE * S + Math.max(0, (bottom - top - (ABOVE + BELOW) * S) / 2));
    const cx = W / 2;
    const bl = cx - S * 0.56;
    const ringR = Math.max(40, Math.min(110, (bl - 24) * 0.42, (floor - hudTop) * 0.3));
    const nr = Math.round(clamp(S * 0.1, 22, 32 * u));
    const ny = floor - BASKET.hang * S;
    const cw = Math.min(right - left, 460 * u);
    return {
      w: W, h: H, wide, u, ins, top, bottom, left, right, S, cx, floor, ground: floor + BELOW * S,
      // beside the twine, its word under the runner's HUD even where the basket rises between the panel and the score
      next: { x: cx + S * 0.5 + Math.max(8, S * 0.045) + nr + 12, y: Math.max(ny, hudTop + label + nr + 8), r: nr, label, labelY: Math.max(ny, hudTop + label + nr + 8) - nr - 5, beside: true },
      ring: { x: Math.max(ringR + 16 + ins.left, bl - ringR - 40), y: Math.max(hudTop + ringR + 26, floor - (BASKET.rim * S) * 0.62), r: ringR, strip: false, w: ringR * 2 },
      glean: { x: bl - S * 0.16, y: floor + BELOW * S, s: S * 0.36 },
      table: { x: cx + S * 0.62 + 12, y: floor + BELOW * S, w: Math.max(80, Math.min(W - (cx + S * 0.62) - 24, S * 0.9)), on: W - (cx + S * 0.62) > 110 },
      cards: { x: (W - cw) / 2, y: hudTop + 6, w: cw, h: bottom - hudTop - 12 },
    };
  }
  // ── a phone upright ────────────────────────────────────────────────────────
  const edge = W < 600 ? 16 : Math.round(24 * u);
  const left = ins.left + edge, right = W - ins.right - edge, A = right - left;
  const bottom = H - Math.max(Math.round(8 * u), ins.bottom + 4);
  const band = bottom - hudTop;
  // the circle of fruits: a strip of eleven along the bottom, the basket's ground on it
  const ringH = Math.round(clamp(band * 0.075, 30, 40 * u));
  const room = band - ringH - 8;
  // the next fruit's bubble: beside the twine in a margin of its own, or on a row under the HUD — whichever leaves
  // the basket wider
  const nr = Math.round(clamp(Math.min(W, H) * 0.06, 22, 30 * u));
  const side = 2 * nr + 14;
  const rowH = 2 * nr + label + 12;
  const sSide = Math.min(room / (ABOVE + BELOW), (A - 2 * side) / WALLS);
  const sRow = Math.min((room - rowH) / (ABOVE + BELOW), A / WALLS);
  const onRow = sRow > sSide;
  const S = Math.max(40, onRow ? sRow : sSide);
  const cx = (left + right) / 2;
  // the basket stands on the strip; what is left over is sky above it
  const ground = bottom - ringH - 8;
  const floor = ground - BELOW * S;
  const hang = floor - BASKET.hang * S;
  const ny = onRow ? hudTop + label + 8 + nr : Math.max(hang, hudTop + label + 8 + nr);
  const cw = Math.min(W - ins.left - ins.right - 20, 480 * u);
  return {
    w: W, h: H, wide, u, ins, top: hudTop, bottom, left, right, S, cx, floor, ground,
    next: { x: right - nr, y: ny, r: nr, label, labelY: ny - nr - 5, beside: !onRow },
    ring: { x: cx, y: bottom - ringH / 2, r: Math.min(ringH * 0.4, (A / 11) * 0.42), strip: true, w: A },
    glean: { x: cx - S * 0.42, y: ground, s: S * 0.24 },
    table: { x: W + 40, y: ground, w: 100, on: false },
    cards: { x: (W - cw) / 2, y: hudTop + 6, w: cw, h: bottom - hudTop - 12 },
  };
}

/** World (W, y up) to the canvas (CSS px). */
export const sx = (l: Layout, x: number): number => l.cx + x * l.S;
export const sy = (l: Layout, y: number): number => l.floor - y * l.S;
/** The canvas to the world's x (the aim). */
export const worldX = (l: Layout, px: number): number => (px - l.cx) / l.S;
