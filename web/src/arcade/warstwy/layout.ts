/**
 * Warstwy światła's layout (pure, tested at every CHECK_SIZES entry): where the egg of light with the figure in it,
 * the Light above it and the words band go, for three shapes —
 *
 *   tall   a phone upright (and a tablet upright): the egg as tall as the picture allows, the words band below it
 *   side   a phone on its side: the egg on the left, the words in a column on the right
 *   desk   a desktop and a big screen (and a tablet on its side): the egg in the middle of the picture, the words in a
 *          side column at a reading measure
 *
 * Everything the player reads stays inside the insets (below the runner's HUD band); the scene runs under them — the
 * Light above may stand under the HUD, the egg's top is below it.  Text never under 13 px where it is read.
 */
import { MIN_READ, NO_INSETS, screenKind, uiScale, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { EGG_BOTTOM, EGG_HALF, EGG_TOP, LIGHT_Y } from './egg';

export type Shape = 'tall' | 'side' | 'desk';

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  touch: boolean;
  /** the UI scale (1 on a phone, up to the kit's DESK_MAX on a big screen) */
  u: number;
  shape: Shape;
  desk: boolean;
  /** the safe area: inside the insets, with a margin */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** the picture's own area (the egg and the Light above it) */
  stage: Rect;
  /** the figure: its midline, its crown, its height (1 figure unit) */
  fig: { cx: number; top: number; H: number };
  /** the egg's box on the screen (the outer layer with a margin for its glow) */
  egg: Rect;
  /** the Light above (its centre and radius, screen px) */
  light: { x: number; y: number; r: number };
  /** the words band */
  band: Rect;
  font: { label: number; now: number; prayer: number; verse: number; small: number };
  /** the band's inner padding */
  pad: number;
}

/** The egg's height in figure units with a little air above and below. */
const EGG_SPAN = EGG_BOTTOM - EGG_TOP + 0.05;
/** Its width in figure units with a little air at the sides. */
const EGG_WIDE = 2 * EGG_HALF + 0.06;

export function layout(w: number, h: number, ins: Insets = NO_INSETS, touch = true): Layout {
  const kind = screenKind(w, h, touch);
  const desk = kind === 'desktop' || kind === 'big';
  const u = uiScale(w, h);
  const shape: Shape = h >= w ? 'tall' : kind === 'phone-side' ? 'side' : 'desk';
  const top = ins.top + 4 * u, bottom = h - ins.bottom - 6 * u;
  const left = ins.left + 8 * u, right = w - ins.right - 8 * u;
  const font = {
    label: Math.max(MIN_READ, 13 * u), now: Math.max(MIN_READ, 14 * u), prayer: Math.max(15, 16 * u), verse: Math.max(MIN_READ, 15 * u),
    small: Math.max(12, 12 * u),
  };
  const pad = 10 * u;
  let stage: Rect, band: Rect;
  if (shape === 'tall') {
    const avail = bottom - top;
    const bandH = Math.round(Math.max(124, Math.min(avail * 0.36, 230 * u)));
    band = { x: left, y: bottom - bandH, w: right - left, h: bandH };
    stage = { x: left, y: top, w: right - left, h: band.y - 6 * u - top };
  } else {
    const measure = shape === 'side' ? Math.min(380, Math.max(220, (right - left) * 0.44)) : Math.min((right - left) * 0.36, Math.max(300, 19 * font.prayer));
    band = { x: right - measure, y: top, w: measure, h: bottom - top };
    stage = { x: left, y: top, w: band.x - 12 * u - left, h: bottom - top };
  }
  const H = Math.max(40, Math.min(stage.h / EGG_SPAN, stage.w / EGG_WIDE));
  const cx = stage.x + stage.w / 2;
  // the egg centred in the stage's height (its top just under the HUD band on a short stage)
  const eggTop = stage.y + Math.max(0.025 * H, (stage.h - EGG_SPAN * H) / 2 + 0.025 * H);
  const figTop = eggTop - EGG_TOP * H;
  const fig = { cx, top: figTop, H };
  const ex = (EGG_HALF + 0.08) * H;
  const egg = { x: cx - ex, y: figTop + (EGG_TOP - 0.06) * H, w: 2 * ex, h: (EGG_BOTTOM - EGG_TOP + 0.12) * H };
  // the Light above: over the egg's top, as high as the screen allows (it may stand under the HUD)
  const ly = Math.max(ins.top * 0.35 + 10, figTop + LIGHT_Y * H);
  const light = { x: cx, y: Math.min(ly, eggTop - 0.04 * H), r: Math.max(18, 0.16 * H) };
  return { w, h, ins, touch, u, shape, desk, top, bottom, left, right, stage, fig, egg, light, band, font, pad };
}

/** A figure point (figure units) on the screen. */
export function figPt(L: Layout, x: number, y: number): { x: number; y: number } {
  return { x: L.fig.cx + x * L.fig.H, y: L.fig.top + y * L.fig.H };
}
