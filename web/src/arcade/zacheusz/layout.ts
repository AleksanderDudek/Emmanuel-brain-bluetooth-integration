/**
 * Where Zacheusz's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12).  The runner's
 * standard HUD (the Mendi panel, the score) covers the band down to `insets().top`; under it the level
 * strip (passive: the level's code and its five special slots), then the street seen from the side,
 * and under the street a band of ground that belongs to the thumb.
 *
 * Upright (a phone in one hand, the reference): the street runs across the lower middle and the scale
 * comes from the width — 9 u across, so about 1.2 s of street shows ahead of him at his pace — with the
 * height above it for the light road, the roofs and a coin over his head (NEED_U) under the HUD.  The
 * ground band below (a quarter of the screen, at least 122 px) is the thumb's pad: a press anywhere
 * jumps, so the thumb never covers the run; Mela's lines sit there in a box (never over the light road
 * or the roofs), and the bubble button in its right corner, inside the 16 px edges and clear of the
 * canvas's last pixel row (a touch on the signal dock plays there).  On its side: a thinner ground band
 * under the HUD's one row, the scale from the height, Mela's line in one or two rows beside the button.
 * A tablet grows the same layout (`u` up to 1.3; the scene capped so it shows more street rather than a
 * giant Zacchaeus).
 *
 * A desktop (kit/mobile `screenKind`: a mouse at a desktop-sized canvas, DESIGN §14) has no thumb on the
 * glass: the ground band is thinner and holds only Mela's lines and the bubble button, the scene grows with
 * the screen instead of stopping at a tablet's cap — Zacchaeus about a tenth of the canvas tall, a fifth of
 * the way in, with about two seconds of street ahead — and the bubble button sits under the street a few
 * strides ahead of him (where the eye already is, its label and its key B to its right), never in a corner.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import type { Insets } from '../kit/types';

export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** the kind of screen (kit/mobile `screenKind`), and whether it is a desktop's: a mouse and keys, no thumb on the glass */
  kind: ScreenKind;
  desk: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a small desktop, growing on a big screen (kit/mobile `uiScale`) */
  u: number;
  /** an upright screen (a phone in one hand, a tablet upright) */
  tall: boolean;
  /** a phone on its side (the play band is short) */
  short: boolean;
  /** px per u */
  S: number;
  /** the street's top line on screen, and where he runs (x) */
  gy: number;
  hx: number;
  /** the runner's HUD bottom edge (insets().top), and the band of sky for the skyline of palms */
  hudTop: number;
  horizon: number;
  /** the safe edges for text and anything to tap: left, right (16 px in, past a notch) and bottom (the home indicator) */
  left: number;
  right: number;
  bottom: number;
  /** the bubble button: its centre and radius (the ground band's right corner) */
  btn: { x: number; y: number; r: number };
  /** the room for Mela's lines: the ground band left of the bubble button */
  talk: Box;
  /** where cards centre, and how wide they may be */
  cardY: number;
  cardW: number;
}

/** Text keeps this far from a side; anything to tap keeps the 16 px of an upright phone's edge (Safari's back swipe). */
export const EDGE = 16;
/** The world's height that must fit under the HUD: the lane, his height, a coin over him (u). */
export const NEED_U = 5.7;
/** The canvas's last rows stay free of controls: a touch on the signal dock plays at y = h − 1. */
export const DOCK_ROW = 4;
/** The bubble button's hit square reaches this far past its drawn circle (a finger is wider than its aim). */
export const HIT_PAD = 4;

export function layout(w: number, h: number, insets: Insets = NO_INSETS, kind: ScreenKind = screenKind(w, h, true)): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = uiScale(W, H);
  const tall = W / H < 0.9;
  const short = !tall && H < 470;
  const desk = kind === 'desktop' || kind === 'big';
  const top = clamp(insets.top || 0, 0, H * 0.45);
  const left = Math.max(0, insets.left || 0) + EDGE;
  const right = W - Math.max(0, insets.right || 0) - EDGE;
  const bottom = H - Math.max(0, insets.bottom || 0);
  const r = Math.round(28 * u);
  let gy: number, S: number, hx: number;
  if (desk) {
    // a desktop: a thinner ground band (Mela's lines and the bubble button, no thumb's pad), the scene from
    // the width (12.5 u across) as far as the height under the HUD allows — no tablet's cap
    const band = clamp(H * 0.16, 72 * u, 190 * u);
    gy = Math.max(top + 130, bottom - band);
    S = clamp(Math.min((gy - top - 8) / NEED_U, W / 12.5), 18, 160);
    hx = clamp(W * 0.22, left + S * 2.6, W * 0.4);
  } else if (tall) {
    // the ground band: the thumb's pad, Mela's lines and the bubble button
    const band = clamp(H * 0.24, 122 * u, 240 * u);
    gy = Math.max(top + 150, bottom - band);
    // from the width (9 u across: ~1.2 s of street ahead), the height above the street, a cap for a tablet
    S = clamp(Math.min((gy - top - 8) / NEED_U, W / 9, 52 * u), 18, 80);
    // far enough right for Mela trotting behind him, far enough left to see ahead
    hx = Math.max(W * 0.28, left + S * 2.2);
  } else {
    // on its side (or a desktop): a thinner band of ground; the scene takes the height under the HUD
    const band = clamp(H * 0.17, 58 * u, 120 * u);
    gy = Math.max(top + 130, bottom - band);
    S = clamp(Math.min((gy - top - 8) / NEED_U, W / 15, 52 * u), 18, 80);
    hx = clamp(W * 0.28, left + S * 2.6, W * 0.4);
  }
  // the bubble button sits in the ground band's right corner (its hit square ends at the safe edge), above
  // the home indicator and the dock's row
  const hitBottom = Math.min(bottom - (tall && !desk ? 10 : 4), H - DOCK_ROW - 2);
  // on a desktop: under the street a few strides ahead of him, room for Mela's lines on its left
  const btn = desk
    ? { x: Math.min(W * 0.62, Math.max(hx + 2.4 * S, left + 220 * u + r + HIT_PAD + 12)), y: clamp(gy + (bottom - gy) / 2, gy + r + HIT_PAD + 4, hitBottom - r - HIT_PAD), r }
    : { x: right - r - HIT_PAD, y: Math.max(gy + r * 0.4, hitBottom - r - HIT_PAD), r };
  // Mela's lines: the band under the street, left of the button (its label sits above it, upright; right of it on a desktop)
  const talkY = gy + (tall && !desk ? 12 : 6);
  const talkW = desk ? btn.x - r - HIT_PAD - 10 - left : btn.x - r - 12 - left;
  const talk = { x: left, y: talkY, w: Math.max(80, talkW), h: Math.max(30, bottom - (tall && !desk ? 10 : 5) - talkY) };
  const horizon = Math.min(gy - S * 1.2, Math.max(top + S * 0.8, gy - S * 4.4));
  return {
    w: W, h: H, kind, desk, u, tall, short, S, gy, hx, hudTop: top, horizon, left, right, bottom, btn, talk,
    cardY: top + (gy - top) * 0.45,
    cardW: Math.min(right - left, 400 * u),
  };
}

/** How far behind him Mela trots (u): closer on a narrow phone, so the whole goat stays on screen. */
export const melaBehind = (L: Layout): number => clamp((L.hx - L.left) / L.S - 0.9, 1.2, 1.8);

/** The bubble button's hit rectangle (as the game tests it, and as `targets()` reports it). */
export function buttonRect(L: Layout): Box {
  const { x, y, r } = L.btn;
  const s = r + HIT_PAD;
  return { x: x - s, y: y - s, w: s * 2, h: s * 2 };
}
