/**
 * Where Nehemiasz's play view puts things (CSS px), for desktops and for phones upright and on their
 * side.  The runner's standard HUD covers the top (its Mendi panel and score, down to `hudTop`); its
 * bottom strip (the simulator's switch) keeps the last `BOTTOM` px.  The world (18 × 12 u, the
 * ground seen at a slant: y is squashed by K) fills the band between them; where it does not fit the
 * camera follows Nehemiah.  The game's own bits sit at the band's bottom edge: the stores' bar, the
 * guide's chip and the horn's dial.
 */
import { clamp } from '../kit/juice';
import { RULES } from './rules';

export const BOTTOM = 60;
/** the ground's slant: a world u down the screen is K × s px */
export const K = 0.78;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** the runner's HUD bottom, the play band's bottom (above the game's own bar) */
  top: number;
  bottom: number;
  /** UI scale (1 on a desktop) */
  u: number;
  /** px per u, and the screen point the camera centre maps to */
  s: number;
  cx: number;
  cy: number;
  /** the camera may move across / down (the world is wider / taller than the screen) */
  panX: boolean;
  panY: boolean;
  /** the stores' bar, the guide's chip, the horn's dial (centre, radius) */
  bar: Rect;
  guide: Rect;
  horn: { x: number; y: number; r: number };
  /** narrow screens stack the choice cards; short ones shrink the bar */
  narrow: boolean;
  short: boolean;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const u = clamp(Math.min(w / 900, h / 640), 0.72, 1.15);
  const short = h < 520;
  const narrow = w < 700;
  const top = clamp(hudTop || 64, 30, h * 0.55);
  const m = 10 * u;
  const barH = Math.round((short ? 30 : 36) * u);
  const barY = h - BOTTOM - barH + (short ? 16 : 8);
  // wide: one row (the stores, then the guide's chip at its right); narrow: the chip above the stores
  const barW = narrow ? w - 2 * m : Math.min(w - 2 * m, 780 * u);
  const bar = { x: (w - barW) / 2, y: barY, w: barW, h: barH };
  const gw = narrow ? Math.min(w - 2 * m, 340 * u) : Math.min(330 * u, barW * 0.44);
  const guide = narrow
    ? { x: (w - gw) / 2, y: bar.y - barH - 4 * u, w: gw, h: barH }
    : { x: bar.x + bar.w - gw - 4, y: bar.y + 3, w: gw, h: barH - 6 };
  const bottom = (narrow ? guide.y : bar.y) - 6;
  const playH = Math.max(40, bottom - top);
  const W = RULES.worldW, H = (RULES.worldH - RULES.viewTop) * K;
  // fill the band's height, but on a narrow screen never show less than 10 u across (the camera follows)
  let s = Math.min(playH / H, Math.max(w / W, w / 10));
  s = Math.max(s, 24);
  const panX = W * s > w + 1;
  const panY = H * s > playH + 1;
  const cx = w / 2;
  const cy = top + playH / 2;
  const hr = Math.round(26 * u);
  return {
    w, h, top, bottom, u, s, cx, cy, panX, panY, bar, guide,
    horn: { x: w - m - hr - 4, y: Math.min(narrow ? guide.y : bar.y) - hr - 8 * u, r: hr },
    narrow, short,
  };
}
