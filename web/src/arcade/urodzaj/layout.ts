/**
 * Where Urodzaj's scene sits on the canvas: the basket's scale S (CSS px per W), its centre and floor,
 * the twine Feliks flies along, the next fruit's bubble, the circle of fruits, the gleaners and the
 * table.  Two shapes: wide (a desktop or a phone held sideways) puts the circle left of the basket and
 * the table right of it, and lets the basket rise into the band between the runner's Mendi panel and
 * score when it is clear of both; tall (a phone upright) keeps everything under the runner's HUD and
 * draws the circle as a strip under the basket.
 */
import { BASKET } from './rules';

export interface Layout {
  w: number;
  h: number;
  wide: boolean;
  /** CSS px per W, the basket's centre x and its floor's y */
  S: number;
  cx: number;
  floor: number;
  /** the ground line (the basket stands on it) */
  ground: number;
  /** the next fruit's bubble: centre and radius */
  next: { x: number; y: number; r: number };
  /** the circle of fruits: a ring (wide) or a strip (tall) */
  ring: { x: number; y: number; r: number; strip: boolean; w: number };
  /** the gleaners stand here (their feet) */
  glean: { x: number; y: number; s: number };
  /** the table (wide: right of the basket; tall: off screen right) */
  table: { x: number; y: number; w: number; on: boolean };
  /** the top of the play (below the runner's HUD where it must be) */
  top: number;
}

/** The runner's panel and score sizes on a wide screen (CSS px), for the "rise between them" check. */
const PANEL_W = 350;
const SCORE_W = 240;

export function computeLayout(w: number, h: number, hudTop: number): Layout {
  const wide = w >= h * 1.05;
  // the scene's height in W: from Feliks's head (over the twine) to the ground under the basket
  const above = BASKET.hang + 0.24, below = 0.07;
  const sideW = 1 + 0.12;
  const margin = 10;
  if (wide) {
    const sBelow = Math.min((h - hudTop - margin * 2) / (above + below), (w * 0.5) / sideW);
    // free of the panel and the score at its width: the basket may start high
    const sHigh = Math.min((h - margin * 2 - 6) / (above + below), (w * 0.5) / sideW);
    const halfPx = (sHigh * sideW) / 2 + 30;
    const clear = w / 2 - halfPx > PANEL_W && w / 2 - halfPx > SCORE_W;
    const S = Math.max(40, clear ? sHigh : sBelow);
    const top = clear ? margin : hudTop;
    const floor = Math.min(h - margin - below * S, top + above * S + Math.max(0, (h - top - margin - (above + below) * S) / 2));
    const cx = w / 2;
    const left = cx - S * 0.56;
    const ringR = Math.max(34, Math.min(110, (left - 24) * 0.42, (floor - hudTop) * 0.3));
    return {
      w, h, wide, S, cx, floor, ground: floor + below * S, top,
      next: { x: cx + S * 0.5 + Math.min(70, S * 0.22), y: floor - BASKET.hang * S, r: Math.max(18, S * 0.09) },
      ring: { x: Math.max(ringR + 16, left - ringR - 40), y: Math.max(hudTop + ringR + 26, floor - (BASKET.rim * S) * 0.62), r: ringR, strip: false, w: ringR * 2 },
      glean: { x: left - S * 0.16, y: floor + below * S, s: S * 0.36 },
      table: { x: cx + S * 0.62 + 12, y: floor + below * S, w: Math.max(80, Math.min(w - (cx + S * 0.62) - 24, S * 0.9)), on: w - (cx + S * 0.62) > 110 },
    };
  }
  const stripH = 30;
  const S = Math.max(40, Math.min((h - hudTop - margin - stripH) / (above + below), (w - 24) / sideW));
  const cx = w / 2;
  const floor = hudTop + above * S + Math.max(0, (h - hudTop - margin - stripH - (above + below) * S) * 0.35);
  const ground = floor + below * S;
  return {
    w, h, wide, S, cx, floor, ground, top: hudTop,
    next: { x: cx + S * 0.5 - Math.max(16, S * 0.07), y: floor - BASKET.hang * S - S * 0.02, r: Math.max(14, S * 0.065) },
    ring: { x: cx, y: Math.min(h - stripH / 2 - 4, ground + stripH / 2 + 4), r: 12, strip: true, w: Math.min(w - 24, S * 1.1) },
    glean: { x: cx - S * 0.42, y: ground, s: S * 0.24 },
    table: { x: w + 40, y: ground, w: 100, on: false },
  };
}

/** World (W, y up) to the canvas (CSS px). */
export const sx = (l: Layout, x: number): number => l.cx + x * l.S;
export const sy = (l: Layout, y: number): number => l.floor - y * l.S;
/** The canvas to the world's x (the aim). */
export const worldX = (l: Layout, px: number): number => (px - l.cx) / l.S;
