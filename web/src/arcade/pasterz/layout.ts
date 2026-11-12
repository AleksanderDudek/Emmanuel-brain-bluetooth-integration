/**
 * Where Pasterz's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12): sized for a phone
 * 360 px wide held upright at u = 1, grown on a tablet or a desktop (u ≤ 1.3).  The runner's HUD covers the
 * top (`insets.top`), the home indicator the bottom, a notch the sides; the hill runs under all of it, the
 * game's own bits stay inside.
 *
 *   the top band    under the HUD, passive: the ranking (Crowd City's top list, its header the pasture and
 *                   its clock) at the right; in a night the row of twelve stars across the middle
 *   the field       the shepherd stands in its middle, a little above the centre on a phone held upright
 *                   (the thumb steers from below him); the camera follows him and zooms out as his flock
 *                   grows; a drag anywhere is the floating joystick, a tap anywhere whistles for Łatek
 *   the thumb zone  Łatek's button at the bottom right (the whistle, its cool-down on the rim)
 *   the tally card  between rounds, a sheet from the bottom: one column on a phone held upright, two on a
 *                   wider screen — a round ends where the next block begins, so the runner's block banner
 *                   is over the top of the room while the card shows, and the card keeps under it
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';

export type { Rect };

/** Nothing to press within this many px of the screen's left and right edges (Safari's back swipe, DESIGN §12.2). */
export const EDGE = 16;
/** Łatek's button: its radius at u = 1 (a 60 px disc), and the label's line under it. */
export const BUTTON_R = 30;
export const LABEL_H = 18;

/** A round button: its centre and radius, and the rectangle a tap hits (its label under it included). */
export interface Button { x: number; y: number; r: number; hit: Rect }

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** taller than wide (a phone upright, a tablet upright) */
  tall: boolean;
  /** what the runner and the device cover: the HUD band's lower edge, the home indicator's upper edge, a notch */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** px per metre of the hill for a lone shepherd (the camera zooms out as the flock grows) */
  S0: number;
  /** where the shepherd stands on the screen */
  cx: number;
  cy: number;
  /** the ranking box (its width; its height follows its rows), the night's row of stars */
  rank: Rect;
  stars: Rect;
  /** the tally card's column(s) and the most room it has: it rises from `card.y + card.h` as tall as its rows need */
  card: Rect;
  /** the tally card in two columns (a screen wider than tall) */
  cardWide: boolean;
  /** Łatek's button in the thumb zone */
  whistle: Button;
  /** the room between the top band and the thumb zone's row: bubbles and coach marks keep inside it */
  field: { top: number; bottom: number };
}

/** The runner's block banner under the HUD (a phone's brief one: two lines), which the tally card keeps under. */
export const BANNER_ROOM = 106;

/** The ranking's rows: the header (the pasture, its clock) and one row per shepherd shown (at u = 1). */
export const RANK_HEAD = 24;
export const RANK_ROW = 21;

export function layout(w: number, h: number, ins: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = uiScale(W, H);
  const tall = W / H < 1;
  const top = clamp(ins.top, 0, H * 0.45);
  const bottom = Math.max(top + 160, H - ins.bottom);
  const left = ins.left, right = W - ins.right;
  const room = bottom - top;
  // where a control may reach: EDGE from the screen's sides, inside a notch
  const xMax = Math.min(W - EDGE, right - 6);

  // ── the thumb zone: Łatek's button at the bottom right ────────────
  const R = BUTTON_R * Math.min(u, 1.15);
  const hw = Math.max(R + 2, MIN_TAP / 2);
  const labelH = LABEL_H * u;
  const bb = bottom - 8;
  const by = bb - labelH - 4 - R;
  const bx = xMax - hw;
  const whistle: Button = { x: bx, y: by, r: R, hit: { x: bx - hw, y: by - hw, w: hw * 2, h: bb - (by - hw) } };

  // ── the top band: the ranking at the right, the stars across the middle ─────
  const m = 8 * u;
  const rw = Math.round((tall ? 152 : 164) * u);
  const rank: Rect = { x: right - m - rw, y: top + 6, w: rw, h: Math.round((RANK_HEAD + 4 * RANK_ROW + 6) * u) };
  const sw = Math.min(right - left - 32, 420 * u);
  const stars: Rect = { x: (left + right - sw) / 2, y: top + 10 * u, w: sw, h: 30 * u };

  // ── the field and the camera ─────────────────────────────────────
  const field = { top: top + 6, bottom: whistle.hit.y - 6 };
  // a phone upright sees about 14 m across (the flock and its ring read at 360 px); wider screens 15.5 m,
  // the height limiting a short one
  const across = tall && W < 600 ? 14 : 15.5;
  const S0 = clamp(Math.min(right - left, room * 1.15) / across, 20, 48);
  const cx = (left + right) / 2;
  const cy = top + room * (tall ? 0.47 : 0.52);

  // ── the tally card: a sheet from the bottom, under the block's banner (Łatek's button steps aside) ─────
  const cardWide = !tall;
  const cw = Math.min(right - left - 24, (cardWide ? 600 : 400) * u);
  const card: Rect = { x: cx - cw / 2, y: top + BANNER_ROOM * u, w: cw, h: bottom - 8 - (top + BANNER_ROOM * u) };

  return { w: W, h: H, u, tall, top, bottom, left, right, S0, cx, cy, rank, stars, card, cardWide, whistle, field };
}
