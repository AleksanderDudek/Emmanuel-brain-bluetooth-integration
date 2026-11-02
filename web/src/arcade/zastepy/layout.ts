/**
 * Where Zastępy's play view puts things (CSS px), for desktops and for phones upright (and, cramped
 * but usable, on their side): the status and the score at the top, the battle's bar, the road with
 * its banners (the band's history) along the far edge, the light's row (the live gauge, the light
 * bar and the walls, the trumpet) and the unit cards along the bottom.  The runner's top strip (time,
 * pause) and its bottom strip (the signal banner, the simulator button) stay clear of the HUD.  The
 * canvas centre at 60 % of its height (the smoke test's tap) lands on the road or the sky: no harm.
 */
import { clamp } from '../kit/juice';
import { RULES } from './rules';

export const TOP = 64;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  short: boolean;
  /** px per metre of the road; the road's line (the feet of the nearest lane) and its far edge */
  S: number;
  roadY: number;
  roadBack: number;
  /** metres of road in view */
  viewM: number;
  status: Rect;
  scoreX: number;
  scoreY: number;
  /** the battle's name and the gate of ash's walls */
  battle: Rect;
  /** the banners: their foot (the road's far edge), their tallest, their left and right ends */
  banners: { y: number; h: number; x0: number; x1: number };
  /** the light's row: the gauge tube, the light bar, the walls bar, the trumpet */
  tube: Rect;
  light: Rect;
  walls: Rect;
  trumpet: { x: number; y: number; r: number };
  /** the cards' row */
  cards: Rect;
  /** the lowest edge of the top HUD; the centre of the block cards and toasts */
  hudBottom: number;
  cardY: number;
  cardX: number;
  cardW: number;
  /** the card between battles */
  upgrade: Rect;
}

export function layout(w: number, h: number): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const short = !tall && H < 420;
  const bottom = short ? 8 : 60;
  // the bottom: cards, then the light's row above them
  const cardH = (short ? 50 : 74) * u;
  const cards: Rect = { x: 16, y: H - bottom - cardH, w: W - 32, h: cardH };
  const rowH = (short ? 30 : 44) * u;
  const rowY = cards.y - (short ? 4 : 8) * u - rowH;
  const tr = rowH * 0.62;
  const trumpet = { x: W - 16 - tr - 4 * u, y: rowY + rowH / 2, r: tr };
  const tube: Rect = { x: 16, y: rowY - 2 * u, w: 30 * u, h: rowH + 4 * u };
  const lx = tube.x + tube.w + 12 * u, lw = trumpet.x - tr - 14 * u - lx;
  const light: Rect = { x: lx, y: rowY + 2 * u, w: lw, h: rowH * 0.5 };
  const walls: Rect = { x: lx, y: rowY + rowH * 0.62, w: lw, h: rowH * 0.3 };
  // the top: the status on the left, the score on the right, the battle's bar
  const scoreW = 118 * u;
  const statusW = tall ? W - 32 - scoreW - 8 : Math.min(W * 0.42, 430 * u);
  const statusH = (short ? 64 : 100) * u;
  const status: Rect = { x: 16, y: TOP + 2, w: statusW, h: statusH };
  let battle: Rect;
  if (tall || short) battle = { x: 16, y: status.y + status.h + 6 * u, w: W - 32, h: 22 * u };
  else {
    const bx = status.x + status.w + 16, bw = Math.min(380 * u, W - 16 - scoreW - 16 - bx);
    battle = { x: bx + Math.max(0, (W - 16 - scoreW - 16 - bx - bw) / 2), y: TOP + 6, w: bw, h: 24 * u };
  }
  const hudBottom = Math.max(status.y + status.h, battle.y + battle.h) + 6;
  // the road: as much of it in view as the width allows (all of it on a desktop), the scale held by the room
  const room = rowY - hudBottom;
  let S = tall ? W / 12.5 : W / (RULES.road + 6.5);
  S = clamp(Math.min(S, room / (short ? 3.2 : 5.6)), 18, 48);
  const roadY = rowY - Math.max(18 * u, S * 0.75);
  const roadBack = roadY - S * 1.05;
  const bannerH = Math.min(S * 1.9, Math.max(30, roadBack - hudBottom - S * 1.2));
  // the card between battles ends above the canvas centre's 60 % (the smoke's tap lands below it: no harm)
  const upH = (short ? 112 : 142) * u;
  const upBot = Math.min(H * 0.6 - 10 * u, rowY - 6 * u);
  const upTop = Math.max(TOP + 4, Math.min(hudBottom + 4 * u, upBot - upH));
  const uw = Math.min(W - 32, 540 * u);
  return {
    w: W, h: H, u, tall, short, S, roadY, roadBack, viewM: W / S,
    status, scoreX: W - 16, scoreY: TOP + 2, battle,
    banners: { y: roadBack, h: bannerH, x0: 16, x1: W - 16 },
    tube, light, walls, trumpet, cards, hudBottom,
    // the block cards: under the battle's bar in the gap beside the status on a wide screen, else under the HUD
    cardY: tall || short ? hudBottom + (short ? 34 : 56) * u : battle.y + battle.h + 8 * u + 50 * u,
    cardX: tall || short ? W / 2 : battle.x + battle.w / 2,
    cardW: tall || short ? Math.min(320 * u, W - 32) : Math.max(battle.w, Math.min(320 * u, W - 32)),
    upgrade: { x: (W - uw) / 2, y: upTop, w: uw, h: Math.max(60, Math.min(upH, upBot - upTop)) },
  };
}
