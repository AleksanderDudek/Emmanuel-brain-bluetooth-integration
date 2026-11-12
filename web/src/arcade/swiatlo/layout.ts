/**
 * Where Światło ciała's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12, §13.10).
 * The runner's HUD covers the canvas top (`insets().top`), the home indicator its bottom, a notch the
 * sides; the night runs under all of them, the game's own bits stay inside.  One layout in three shapes:
 *
 *   tall   anything upright, the reference being a phone held upright (360 × 500 with a 134 px HUD band):
 *          the sing-along line under the HUD, the standing figure in the left column as tall as the band
 *          allows, the organ's panel (or its Wiedza card) in the right column at the band's height, the
 *          round help button in the bottom-right thumb zone; Zofia's bubble over the figure's column, at
 *          the end away from the band.  A tablet upright is the same, grown (u up to 1.3)
 *   side   a phone on its side (one 68 px HUD row): the figure in the middle, the panel in the left
 *          column, the bubble and the button in the right one (under the right thumb)
 *   wide   a desktop or a tablet on its side: the side layout grown (u up to 1.3), the figure capped so
 *          both columns keep room to read
 *
 * The figure is drawn in its own units: H tall (0 crown … 1 soles), 0.36 H wide with the arms; a point
 * (fx, fy) of it is (cx + fx·H, top + fy·H) on screen.  Everything here is pure: the tests run it at every
 * kit/mobile CHECK_SIZES entry.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';

export interface Rect { x: number; y: number; w: number; h: number }

export type Shape = 'tall' | 'side' | 'wide';

/** half the figure's width with the arms, in figure units (H) */
export const FIG_HALF = 0.185;

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  /** the play band: under the HUD, over the home indicator, inside a notch */
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape: Shape;
  touch: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** the figure: its centre line, its crown's y, its height (px) */
  fig: { cx: number; top: number; H: number };
  /** the sing-along line's strip (passive: under the HUD) */
  line: Rect;
  /** the column the organ's panel (or its card) lives in: x, width, and the y range it may take */
  panel: { x: number; w: number; y0: number; y1: number };
  /** the column Zofia's bubble lives in, and the y range it may take */
  bubble: { x: number; w: number; y0: number; y1: number };
  /** the round help button (centre, radius) and the rectangle a tap on it hits (the caption under it included) */
  button: { x: number; y: number; r: number };
  buttonHit: Rect;
  /** the story card's box (the whole band, with margins) */
  story: Rect;
  /** text sizes (px, never under the kit's floor) */
  font: { name: number; value: number; text: number; small: number; bubble: number; line: number; caption: number };
}

/** The screen point of a figure point. */
export const figPt = (L: Pick<Layout, 'fig'>, fx: number, fy: number): { x: number; y: number } =>
  ({ x: L.fig.cx + fx * L.fig.H, y: L.fig.top + fy * L.fig.H });

/** The figure's v (0 crown … 1 soles) at a screen y. */
export const figV = (L: Pick<Layout, 'fig'>, y: number): number => (y - L.fig.top) / L.fig.H;

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 24, h * 0.6);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const bw = right - left, bh = bottom - top;
  const side = h < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w > h ? 'wide' : 'tall';
  const u = shape === 'side' ? 1 : uiScale(w, h, 1.3);
  const edge = 16;
  const lineH = Math.round(20 * u);
  const line = { x: left + edge, y: top + 3, w: bw - 2 * edge, h: lineH };
  const figTop = top + lineH + 8;
  const font = {
    name: Math.round(15 * u), value: Math.round(20 * u), text: Math.round(13 * u), small: Math.max(11, Math.round(12 * u)),
    bubble: Math.round(14 * u), line: Math.round(13.5 * u), caption: 13,
  };

  if (shape === 'tall') {
    // the button in the bottom-right thumb zone, its caption under it; its hit area stays out of the edge's 16 px
    const r = Math.round(30 * Math.min(u, 1.15));
    const bx = right - edge - 6 - r, by = bottom - 12 - 16 - r;
    const buttonHit = { x: bx - r - 6, y: by - r - 6, w: 2 * r + 12, h: 2 * r + 12 + 16 };
    // the panel's column on the right, the figure's on the left
    const panelW = clamp(bw * 0.42, 148, 230 * u);
    const colR = right - edge - panelW - 8;
    const colL = left + 10;
    const H = Math.max(120, Math.min(bottom - figTop - 8, (colR - colL) / (2 * FIG_HALF + 0.01)));
    const cx = (colL + colR) / 2;
    const fig = { cx, top: figTop + Math.max(0, (bottom - 8 - figTop - H) / 2), H };
    const panel = { x: right - edge - panelW, w: panelW, y0: figTop, y1: buttonHit.y - 8 };
    const bubble = { x: left + edge, w: Math.max(150, colR - left - edge + 6), y0: figTop, y1: bottom - 10 };
    return {
      w, h, ins, top, bottom, left, right, shape, touch, u, fig, line, panel, bubble, button: { x: bx, y: by, r }, buttonHit,
      story: { x: left + edge, y: top + 8, w: bw - 2 * edge, h: bh - 16 }, font,
    };
  }

  // side and wide: the figure in the middle, a column either side
  const r = Math.round(30 * Math.min(u, 1.15));
  const bx = right - edge - 6 - r, by = bottom - 12 - 16 - r;
  const buttonHit = { x: bx - r - 6, y: by - r - 6, w: 2 * r + 12, h: 2 * r + 12 + 16 };
  const colMin = shape === 'side' ? 190 : 250 * u;
  const H = Math.max(120, Math.min(bottom - figTop - 8, (bw - 2 * (colMin + 2 * edge)) / (2 * FIG_HALF + 0.02)));
  const cx = (left + right) / 2;
  const fig = { cx, top: figTop + Math.max(0, (bottom - 8 - figTop - H) / 2), H };
  const figL = cx - FIG_HALF * H - 12, figR = cx + FIG_HALF * H + 12;
  const panelW = Math.min(shape === 'side' ? 250 : 340 * u, figL - left - edge);
  const panel = { x: figL - panelW, w: panelW, y0: figTop, y1: bottom - 8 };
  const bubbleW = Math.min(shape === 'side' ? 250 : 340 * u, right - edge - figR);
  const bubble = { x: figR, w: bubbleW, y0: figTop, y1: buttonHit.y - 8 };
  const storyW = Math.min(bw - 2 * edge, 560 * u);
  return {
    w, h, ins, top, bottom, left, right, shape, touch, u, fig, line, panel, bubble, button: { x: bx, y: by, r }, buttonHit,
    story: { x: (left + right - storyW) / 2, y: top + 8, w: storyW, h: bh - 16 }, font,
  };
}

/**
 * The panel's rectangle for a content height, following the band's screen y (centred on it, kept inside
 * its column's range).
 */
export function panelRect(L: Layout, bandY: number, height: number): Rect {
  const h = Math.min(height, L.panel.y1 - L.panel.y0);
  const y = clamp(bandY - h / 2, L.panel.y0, L.panel.y1 - h);
  return { x: L.panel.x, y, w: L.panel.w, h };
}

/** The bubble's rectangle for a content height: at the end of its column farther from the band. */
export function bubbleRect(L: Layout, bandY: number, height: number): Rect {
  const h = Math.min(height, L.bubble.y1 - L.bubble.y0);
  const mid = (L.bubble.y0 + L.bubble.y1) / 2;
  const y = bandY > mid ? L.bubble.y0 : L.bubble.y1 - h;
  return { x: L.bubble.x, y, w: L.bubble.w, h };
}

/** The story card's rectangle for a content height (centred in the band). */
export function storyRect(L: Layout, height: number): Rect {
  const h = Math.min(height, L.story.h);
  return { x: L.story.x, y: L.story.y + (L.story.h - h) / 2, w: L.story.w, h };
}

export interface TargetState {
  /** a story card is up (it takes every tap: the only target) */
  story: Rect | null;
  /** the organ's panel (or its card) as drawn, when shown */
  panel: Rect | null;
}

/** Every control the player can tap now, as `hit` tests them. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  const out: TapTarget[] = [{ label: 'help', ...L.buttonHit }];
  if (s.panel) out.push({ label: 'panel', ...s.panel });
  return out;
}

export type Hit = { kind: 'story' } | { kind: 'button' } | { kind: 'panel' } | { kind: 'field'; x: number; y: number };

const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** What a tap at (x, y) lands on. */
export function hitTest(L: Layout, s: TargetState, x: number, y: number): Hit {
  if (s.story) return { kind: 'story' };
  if (inside(L.buttonHit, x, y)) return { kind: 'button' };
  if (s.panel && inside(s.panel, x, y)) return { kind: 'panel' };
  return { kind: 'field', x, y };
}
