/**
 * Koła światła's layout (DESIGN.md §28, mobile first, then the desk).  The night runs under the whole canvas; what
 * matters stands inside the insets and under the HUD band:
 *
 *   tall   a phone upright: the figure's stage above, the name card over its top (the camera frames the figure under
 *          the card); at the bottom the words' band and, under it, the breath guide (its word beside the ring)
 *   side   a phone on its side: the stage on the left; a column on the right — the name card, the words, the guide
 *   wide   a tablet on its side or the desk: as `side`, the column a page beside the tall figure, the text larger
 *
 * The figure is tall and narrow, so a landscape screen gives the words a column of their own beside it rather than a
 * band under it.  Pure numbers, CSS px.
 */
import type { Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';

export type { Rect };
export type LayoutKind = 'tall' | 'side' | 'wide';

export interface Layout {
  w: number;
  h: number;
  kind: LayoutKind;
  /** the scene's area, and the part of it the camera frames the figure into (under the name card on a phone) */
  stage: Rect;
  frame: Rect;
  /** the name card: the wheel's name, its place in the way, the qualities' chips */
  title: Rect;
  /** the words' band: the narrator, a prayer, a passage */
  band: Rect;
  /** the breath guide: its ring's middle and radius, its words beside (row) or under (stack), the widest its words may be */
  guide: { cx: number; cy: number; r: number; layout: 'stack' | 'row'; maxW: number };
  /** the text's base size (CSS px) */
  font: number;
}

/** The breath guide's height for a ring radius (its scrim, the word and the "oddech 2 z 3" line). */
export const guideHeight = (r: number, layout: 'stack' | 'row'): number => (layout === 'row' ? 2 * r + 26 : 2 * r + 78);

export function layout(w: number, h: number, ins: Insets): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const L = ins.left + 10, R = W - ins.right - 10, T = ins.top + 6, B = H - ins.bottom - 8;
  const kind: LayoutKind = W >= 900 && H >= 560 ? 'wide' : W > H * 1.15 ? 'side' : 'tall';
  const font = kind === 'wide' ? Math.round(Math.min(20, 15 + (Math.min(W, 1700) - 900) / 160)) : 15;

  if (kind === 'tall') {
    const avail = B - T;
    const small = avail < 440;
    const r = small ? 22 : 26, gH = guideHeight(r, 'row');
    const bandH = Math.round(Math.max(88, Math.min(128, avail * 0.25)));
    const guide = { cx: (L + R) / 2 - 44, cy: B - gH / 2, r, layout: 'row' as const, maxW: (R - L) / 2 };
    const band: Rect = { x: L, y: B - gH - 6 - bandH, w: R - L, h: bandH };
    const titleH = small ? 62 : 74;
    const title: Rect = { x: L, y: T, w: R - L, h: titleH };
    const stage: Rect = { x: L, y: T, w: R - L, h: Math.max(90, band.y - 4 - T) };
    const frame: Rect = { x: L, y: T + titleH - 4, w: R - L, h: Math.max(60, stage.h - titleH + 4) };
    return { w: W, h: H, kind, stage, frame, title, band, guide, font };
  }
  const colW = kind === 'wide' ? Math.max(340, Math.min(560, (R - L) * 0.4)) : Math.max(220, Math.min(330, (R - L) * 0.42));
  const colX = R - colW;
  const r = kind === 'wide' ? Math.max(28, Math.min(40, H * 0.04)) : Math.max(18, Math.min(24, (B - T) * 0.07));
  const lay = kind === 'wide' ? 'stack' as const : 'row' as const;
  const gH = guideHeight(r, lay);
  const guide = { cx: kind === 'wide' ? colX + colW / 2 : colX + colW / 2 - 40, cy: lay === 'stack' ? B - gH + r + 14 : B - gH / 2, r, layout: lay, maxW: colW - 40 };
  const titleH = kind === 'wide' ? Math.round(font * 3.9 + 26) : 74;
  const title: Rect = { x: colX, y: T, w: colW, h: Math.min(titleH, (B - T) * 0.3) };
  const bandY = title.y + title.h + 6;
  const band: Rect = { x: colX, y: bandY, w: colW, h: Math.max(56, B - gH - 10 - bandY) };
  const stage: Rect = { x: L, y: T, w: Math.max(90, colX - 16 - L), h: B - T };
  return { w: W, h: H, kind, stage, frame: stage, title, band, guide, font };
}
