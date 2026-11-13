/**
 * Where Rzeki żywej wody's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12, §13.14).
 * The runner's HUD covers the canvas top (`insets().top`), the home indicator its bottom, a notch the sides;
 * the sky runs under all of them, the game's own bits stay inside.  One layout in three shapes:
 *
 *   tall   anything upright, the reference being a phone held upright (360 × 500 with a 134 px HUD band): the
 *          narrator's caption under the HUD, the figure tall in the middle, the prayer in the band below it
 *          (the eye goes from the place down to its words); a tablet upright is the same, grown (u ≤ 1.3)
 *   side   a phone on its side (one 68 px HUD row): the figure on the left, the caption and the prayer on the right
 *   wide   a desktop or a tablet on its side: the side layout grown, the prayer column capped to read well
 *
 * A tap anywhere stays with the place, so the only target is the place's own circle (≥ 44 px) — or the story
 * card while one is up.  The figure is drawn in its own units: a point (fx, fy) is (cx + fx·H, top + fy·H).
 * Everything here is pure: the tests run it at every kit/mobile CHECK_SIZES entry.
 */
import { clamp, ease } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { PLACE, type PlaceId } from './content';

export interface Rect { x: number; y: number; w: number; h: number }

export type Shape = 'tall' | 'side' | 'wide';

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
  /** the figure: its midline, its crown's y, its height (px) */
  fig: { cx: number; top: number; H: number };
  /** the narrator's caption (passive) */
  caption: Rect;
  /** the prayer's band */
  prayer: Rect;
  /** the story card's box */
  story: Rect;
  /** text sizes (px, never under the kit's floor) */
  font: { label: number; prayer: number; prayerMin: number; caption: number; verse: number; small: number };
}

/** The screen point of a figure point. */
export const figPt = (L: Pick<Layout, 'fig'>, fx: number, fy: number): { x: number; y: number } =>
  ({ x: L.fig.cx + fx * L.fig.H, y: L.fig.top + fy * L.fig.H });

/** A place's centre on the screen. */
export const placeXY = (L: Pick<Layout, 'fig'>, p: PlaceId): { x: number; y: number } => figPt(L, 0, PLACE[p].y);

/** The radius of the current place's rose window at a fill (it grows as it opens). */
export const windowR = (L: Pick<Layout, 'fig'>, fill: number): number => L.fig.H * (0.055 + 0.05 * ease.outCubic(clamp(fill)));
/** The radius of a lit place's small window, and of a place still waiting. */
export const litR = (L: Pick<Layout, 'fig'>): number => L.fig.H * 0.034;
export const idleR = (L: Pick<Layout, 'fig'>): number => Math.max(2.5, L.fig.H * 0.014);
/** The biggest window radius (the layers are baked at it). */
export const maxWindowR = (L: Pick<Layout, 'fig'>): number => windowR(L, 1);

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
  const font = {
    label: Math.round(13 * u), prayer: Math.round(17 * u), prayerMin: 15, caption: Math.max(13, Math.round(13.5 * u)),
    verse: Math.round(15 * u), small: Math.max(11, Math.round(12 * u)),
  };

  if (shape === 'tall') {
    // the narrator speaks in the prayer band's top row here (a caption above the figure would cover the crown)
    const prH = Math.round(clamp(bh * 0.27, 100, 170 * u));
    const prayer = { x: left + edge, y: bottom - prH - 8, w: bw - 2 * edge, h: prH };
    const caption = { x: prayer.x, y: prayer.y, w: prayer.w, h: Math.round(20 * u) * 2 };
    const yB = prayer.y - 6;
    // the crown's window sits just above the head and opens there (0.125 H of room: it never slips under the
    // HUD), the feet stand at H, the pool lies below them
    const H = Math.max(120, Math.min((yB - top - 4) / 1.185, (bw - 2 * edge) / 0.5));
    const fig = { cx: (left + right) / 2, top: top + 4 + 0.125 * H + Math.max(0, (yB - top - 4 - 1.185 * H) / 2), H };
    return { w, h, ins, top, bottom, left, right, shape, touch, u, fig, caption, prayer, story: { x: left + edge, y: top + 8, w: bw - 2 * edge, h: bh - 16 }, font };
  }

  // side and wide: the figure on the left, the caption and the prayer on the right
  const H = Math.max(120, Math.min((bh - 14) / 1.1, bw * 0.62));
  // the egg of light (±0.33 H) fits beside the left edge; on a big screen the figure stands in the left third
  const cx = left + (shape === 'side' ? edge + 0.36 * H : Math.max(edge + 0.36 * H, bw * 0.3));
  const fig = { cx, top: top + 8 + 0.03 * H + Math.max(0, (bh - 14 - 1.1 * H) / 2), H };
  const colX = cx + 0.3 * H + 14;
  const colW = Math.min(right - edge - colX, (shape === 'side' ? 420 : 600) * u);
  const x0 = colX + Math.max(0, (right - edge - colX - colW) / 2);
  const prH = Math.round(clamp(bh * 0.46, 110, 240 * u));
  const capH = Math.round(20 * u) * 2 + 6;
  const prayer = { x: x0, y: top + Math.max(capH + 14, (bh - prH) / 2 + capH * 0.4), w: colW, h: prH };
  if (prayer.y + prayer.h > bottom - 8) prayer.y = Math.max(top + capH + 10, bottom - 8 - prayer.h);
  const caption = { x: x0, y: prayer.y - capH - 6, w: colW, h: capH };
  const storyW = Math.min(bw - 2 * edge, 560 * u);
  return {
    w, h, ins, top, bottom, left, right, shape, touch, u, fig, caption, prayer,
    story: { x: (left + right - storyW) / 2, y: top + 8, w: storyW, h: bh - 16 }, font,
  };
}

/** The story card's rectangle for a content height (centred in its box). */
export function storyRect(L: Layout, height: number): Rect {
  const h = Math.min(height, L.story.h);
  return { x: L.story.x, y: L.story.y + (L.story.h - h) / 2, w: L.story.w, h };
}

/** The current place's tap circle as a target (≥ 44 px), kept inside the safe area. */
export function placeTarget(L: Layout, p: PlaceId, fill: number): TapTarget {
  const c = placeXY(L, p);
  const s = Math.max(MIN_TAP, 2 * windowR(L, fill) * 0.9);
  const x = clamp(c.x - s / 2, L.left, L.right - s);
  const y = clamp(c.y - s / 2, L.top, L.bottom - s);
  return { label: 'place', x, y, w: s, h: s };
}

export interface TargetState {
  /** a story card is up (it takes every tap: the only target) */
  story: Rect | null;
  /** the place the light is at (null between ways) and its fill */
  place: PlaceId | null;
  fill: number;
}

/** Every control the player can tap now, as `hit` tests them. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  return s.place ? [placeTarget(L, s.place, s.fill)] : [];
}
