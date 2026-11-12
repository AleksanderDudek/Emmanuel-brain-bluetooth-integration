/**
 * Where Dolina's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12): the scene's
 * scale (px per u) and where the pilgrim's floor sits on screen, how far ahead he runs, the band under
 * the runner's HUD (`insets().top`) that the climb keeps clear, the pack's row (sword, stones, oil), the
 * safe edges (a notch on the side, the home indicator) and the box story cards hang in.
 *
 * Upright (a phone in one hand, the reference): the road runs across the lower middle; under it a band of
 * ground holds the pack's row just under the road — where the eye already is, above the thumb — and below
 * that a pad for the thumb (any tap on the field jumps, so the thumb never has to cover the climb).  The
 * scale comes from the width, so he sees more than a second of road ahead; the height above the floor
 * keeps room for a ledge, both jumps and a gate in the air.  On its side: a thin ground band and the
 * scale from the height under the HUD's one row.  A tablet and a desktop grow the same layout (`u` up to
 * 1.3, the scene capped so a big screen shows more valley rather than a giant pilgrim).
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets } from '../kit/types';

export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, growing to 1.3 on a tablet or a desktop (kit/mobile `uiScale`) */
  u: number;
  /** an upright screen (a phone in one hand, a tablet upright) */
  tall: boolean;
  /** px per u of the valley */
  S: number;
  /** the screen line of the floor he stands on, and his x on screen */
  floorLine: number;
  runX: number;
  /** the top of the free play area (under the runner's HUD) */
  top: number;
  /** the safe edges for text and anything to tap: left, right and bottom (notch, rounded corners, home indicator) */
  left: number;
  right: number;
  bottom: number;
  /** the pack's row (sword, stones, oil): the box it is centred in, and its height */
  pack: Box;
  /** story cards: their width and the top they hang from (toasts hang there too) */
  cardW: number;
  cardTop: number;
}

/** Text keeps this far from a side; anything to tap keeps the 16 px of an upright phone's edge (Safari's back swipe). */
export const EDGE = 16;
/** The room above the floor (u): a ledge's top (up to 5.2 u), both jumps (3 u + his height) and the high gate. */
export const ROOM = 5.8;

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = uiScale(W, H);
  const tall = W / H < 0.9;
  const top = clamp(insets.top || 0, 0, H * 0.45);
  const left = Math.max(0, insets.left || 0) + EDGE;
  const right = W - Math.max(0, insets.right || 0) - EDGE;
  const bottom = H - Math.max(0, insets.bottom || 0);
  const packH = Math.round(36 * u);
  let floorLine: number, S: number, runX: number, packY: number;
  if (tall) {
    // the ground band: the pack's row under the road, then the thumb's pad
    const band = clamp(H * 0.24, 122 * u, 240 * u);
    floorLine = Math.max(top + 120, bottom - band);
    const Sv = (floorLine - top - 8) / ROOM;
    // from the width: 9 u across, so the road ahead shows for about 1.3 s at his pace
    const Sh = W / 9;
    S = clamp(Math.min(Sv, Sh, 58 * u), 16, 82);
    // far enough left to see ahead, far enough right for the party running behind him
    runX = Math.max(W * 0.22, left + S * 1.9);
    packY = floorLine + Math.round(10 * u);
  } else {
    // on its side: a thin band of ground holds the pack; the scene takes the height under the HUD's row
    const band = clamp(H * 0.15, 52 * u, 110 * u);
    floorLine = Math.max(top + 120, bottom - band);
    const Sv = (floorLine - top - 8) / ROOM;
    const Sh = W / (W < 900 ? 15 : 17);
    S = clamp(Math.min(Sv, Sh), 16, 82);
    runX = clamp(W * 0.28, left + S * 2.6, W * 0.42);
    packY = floorLine + Math.max(4, (Math.min(bottom, H) - floorLine - packH) / 2);
  }
  // the pack never sinks under the home indicator
  packY = Math.min(packY, bottom - packH - 6);
  return {
    w: W, h: H, u, tall, S, floorLine, runX, top, left, right, bottom,
    pack: { x: left, y: packY, w: right - left, h: packH },
    cardW: Math.min(right - left, 460 * u), cardTop: top + 8,
  };
}
