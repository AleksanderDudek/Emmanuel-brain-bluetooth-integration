/**
 * Where Dolina's play view puts things (CSS px), for desktops and for phones upright and on their
 * side: the scene's scale (px per u) and where the pilgrim's floor sits on screen, how far ahead he
 * runs, the band under the runner's standard HUD (`hudTop`: the Mendi panel on the left, the score on
 * the right) that the climb keeps clear, the strip in the ground where the pack (sword, stones, oil)
 * is drawn, and the box story cards are centred in.
 */
import { clamp } from '../kit/juice';

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  /** px per u of the valley */
  S: number;
  /** the screen line of the floor he stands on, and his x on screen */
  floorLine: number;
  runX: number;
  /** the top of the free play area (under the runner's HUD) */
  top: number;
  /** the pack's strip: its centre line and its right edge (the runner's simulator button sits bottom-left) */
  packY: number;
  packRight: number;
  /** story cards: their width and the top they hang from */
  cardW: number;
  cardTop: number;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 0.9;
  const top = clamp(hudTop || 0, 0, H * 0.45);
  // the ground band below the floor holds the pack's strip
  const band = tall ? clamp(H * 0.24, 70, 180) : clamp(H * 0.14, 58, 110);
  const floorLine = H - band;
  // room above the floor for a ledge, a double jump and the gate in the air: about 5.8 u
  const Sv = (floorLine - top - 8) / 5.8;
  const Sh = W / (tall ? 9.2 : 17);
  const S = clamp(Math.min(Sv, Sh), 16, 82);
  return {
    w: W, h: H, u, tall, S, floorLine, runX: W * (tall ? 0.26 : 0.3), top,
    packY: floorLine + Math.min(band * 0.5, 34 * u), packRight: W - 14,
    cardW: Math.min(W - 32, 460 * u), cardTop: top + 8,
  };
}
