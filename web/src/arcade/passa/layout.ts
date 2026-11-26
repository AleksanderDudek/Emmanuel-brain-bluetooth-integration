/**
 * STUB (lead) — builder B ("street") fills it: where everything of Złota passa stands on the canvas, at every size of
 * kit/mobile `CHECK_SIZES`.  The signature is the contract: builder A hit-tests the choices with `choices` and lists
 * them in `targets()`; places its cards (story, verse) in `card` and the runner's breath pacer at `pacer`.
 */
import type { Insets } from '../kit/types';
import type { Rect } from './view';

export interface Layout {
  w: number;
  h: number;
  /** the street's picture (below the runner's HUD) and the moment's card held up close */
  scene: Rect;
  card: Rect;
  /** up to four choice slots in the thumb zone (each ≥ MIN_TAP; fewer choices use the first ones) */
  choices: Rect[];
  /** the narrator's line, the banner, A's story/verse card place, the breath pacer's place */
  say: Rect;
  banner: Rect;
  story: Rect;
  pacer: { x: number; y: number; ring?: boolean } | null;
  font: number;
  wide: boolean;
}

export function layout(w: number, h: number, ins: Insets, touch: boolean): Layout {
  void touch;
  const top = ins.top + 8, bottom = h - ins.bottom - 8;
  const ch = 52, cw = Math.min(420, w - 24);
  const choices = [0, 1, 2, 3].map(i => ({ x: (w - cw) / 2, y: bottom - (4 - i) * (ch + 8), w: cw, h: ch }));
  return {
    w, h,
    scene: { x: 0, y: top, w, h: bottom - top },
    card: { x: w / 2 - 140, y: top + 60, w: 280, h: 180 },
    choices,
    say: { x: 12, y: top + 250, w: w - 24, h: 40 },
    banner: { x: 0, y: h * 0.3, w, h: 60 },
    story: { x: 16, y: top + 40, w: w - 32, h: 200 },
    pacer: null,
    font: 15,
    wide: w > h,
  };
}
