/**
 * Where Wzlot's play view puts things (CSS px), mobile first (DESIGN.md §6 and §12).  The runner's HUD covers
 * the top of the canvas (`insets().top`), a phone's home indicator or notch the other edges: the sky and the
 * ground run under them, the game's own words and cards stay inside.  A hold anywhere is the whole control,
 * so the layout's job is a world that reads at a glance and a thumb that never covers it:
 *
 *   tall  (a phone or a tablet upright)  the world closer than when wide — 1.45 screen heights across (the
 *         eaglet ~35 px, a hill's drop easy to read), never closer than 290 × u px a screen height (a tablet
 *         sees more of the granie, not a giant eaglet) — the eaglet a fifth in from the left, so the next
 *         valley is in sight; the lowest ground in sight stands a thumb pad above the canvas's foot (the
 *         earth goes on under it), so a thumb held at the bottom never covers the eaglet; the sun's arc under
 *         the HUD
 *   wide  (a phone on its side, a tablet on its side, a desktop)  2.6 screen heights across, the eaglet at
 *         three tenths, the ground near the foot
 *
 * The camera (render.ts) fits the ground and the eaglet into the band between `top` and `bottom`.  Sizes start
 * from a 360 px phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets } from '../kit/types';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  tall: boolean;
  /** what covers each edge (the HUD band on top) */
  ins: Insets;
  /** the band the play lives in (px from the canvas top): the HUD's lower edge and the world's floor line */
  top: number;
  bottom: number;
  /** the lowest y the game's words and cards reach (over the home indicator), and the band's sides */
  foot: number;
  left: number;
  right: number;
  /** where the eaglet sits across the screen (px) */
  ex: number;
  /** the fewest world units (sh) across the screen, and the closest the camera comes (px per sh) */
  minWorldW: number;
  maxS: number;
  /** the sun's arc: its left and right ends and its height (px), and the sun's radius */
  arcX0: number;
  arcX1: number;
  arcTop: number;
  arcH: number;
  sunR: number;
  /** the cards' centre (the story, the tally) */
  cardY: number;
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(240, h);
  const u = uiScale(W, H);
  const tall = W / H < 0.9;
  const ins: Insets = {
    top: clamp(insets.top, 0, H * 0.45), right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left),
  };
  const top = ins.top, foot = H - ins.bottom, left = ins.left, right = W - ins.right;
  // an upright phone is held in one hand and the thumb rests at the bottom while it holds: the ground's
  // lowest line stands a pad above the foot, the earth under it is the thumb's
  const pad = tall ? clamp((foot - top) * 0.16, 8, 110 * u) : Math.max(8, H * 0.03);
  const bottom = foot - pad;
  const span = bottom - top;
  const across = right - left;
  const sunR = 14 * u;
  return {
    w: W, h: H, u, tall, ins, top, bottom, foot, left, right,
    ex: left + across * (tall ? 0.2 : 0.3),
    minWorldW: tall ? 1.45 : 2.6,
    maxS: 290 * u,
    arcX0: left + across * 0.1, arcX1: left + across * 0.9, arcTop: top + sunR * 3.3, arcH: span * (tall ? 0.2 : 0.3), sunR,
    cardY: top + span * (tall ? 0.42 : 0.45),
  };
}
