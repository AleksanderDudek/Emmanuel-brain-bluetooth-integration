/**
 * STUB (lead) — builder B ("ring") fills it: where everything of Dobry bój stands on the canvas, for every size of
 * kit/mobile `CHECK_SIZES` (phone upright first, on its side, tablet, desk).  The signature is the contract: the fight
 * (builder A) hit-tests the options with `options` and lists them in `targets()`.
 */
import type { Insets } from '../kit/types';
import type { Rect } from './view';

export interface Layout {
  w: number;
  h: number;
  /** the ring's floor band where the two fighters stand (below the runner's HUD) */
  ring: Rect;
  /** the two health bars with their lives and names */
  bars: { player: Rect; foe: Rect };
  /** three slots for the slow motion's options, in the thumb zone (each ≥ MIN_TAP; fewer options use the first ones) */
  options: Rect[];
  /** the coach's bubble, the "why" line, the big banner, the referee's count */
  coach: Rect;
  why: Rect;
  banner: Rect;
  count: Rect;
  /** the base font size (CSS px) and whether the screen is wide (side / desk) */
  font: number;
  wide: boolean;
}

export function layout(w: number, h: number, ins: Insets, touch: boolean): Layout {
  void touch;
  const top = ins.top + 8, bottom = h - ins.bottom - 8;
  const bw = Math.min(160, (w - 48) / 3);
  const oy = bottom - 64;
  return {
    w, h,
    ring: { x: 0, y: top + 60, w, h: Math.max(120, oy - top - 80) },
    bars: { player: { x: 12, y: top, w: w / 2 - 24, h: 40 }, foe: { x: w / 2 + 12, y: top, w: w / 2 - 24, h: 40 } },
    options: [0, 1, 2].map(i => ({ x: 12 + i * (bw + 12), y: oy, w: bw, h: 56 })),
    coach: { x: 12, y: top + 48, w: w - 24, h: 40 },
    why: { x: 12, y: oy - 34, w: w - 24, h: 28 },
    banner: { x: 0, y: h * 0.35, w, h: 60 },
    count: { x: w / 2 - 40, y: h * 0.3, w: 80, h: 80 },
    font: 15,
    wide: w > h,
  };
}
