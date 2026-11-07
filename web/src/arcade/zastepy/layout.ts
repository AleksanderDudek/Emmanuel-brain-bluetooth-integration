/**
 * Where Zastępy's play view puts things (CSS px), for desktops and for phones upright (and, cramped
 * but usable, on their side).  The runner's standard HUD covers the top (the Mendi panel on the
 * left, the score on the right, down to `hudTop`), so the game starts below it: the battle's bar (the
 * battle on the map and the gate of ash's walls, or the boss), Tymek's corner, the sky with the
 * banners (the band's history) along the road's far edge, the road, the light's row (the lantern —
 * the large gauge of what focus drives, with its threshold — the light bar, the walls, the pillar and
 * the trumpet) and the unit cards along the bottom.  The canvas centre at 60 % of its height (the
 * smoke test's tap) lands on the road or the sky above it: the pillar of cloud.
 */
import { clamp } from '../kit/juice';
import { RULES } from './rules';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** UI scale */
  u: number;
  tall: boolean;
  short: boolean;
  /** the runner's HUD's lower edge */
  top: number;
  /** px per metre of the road; the road's line (the feet of the nearest lane) and its far edge */
  S: number;
  roadY: number;
  roadBack: number;
  /** metres of road in view */
  viewM: number;
  /** the battle's name and the gate of ash's walls (or the boss) */
  battle: Rect;
  /** Tymek's portrait (centre, radius) and the room for his bubble to its right */
  tymek: { x: number; y: number; r: number; maxW: number };
  /** the banners: their foot (the road's far edge), their tallest, their left and right ends */
  banners: { y: number; h: number; x0: number; x1: number };
  /** the light's row: the lantern dial, the light bar, the walls bar, the pillar's button, the trumpet */
  lantern: { x: number; y: number; r: number };
  light: Rect;
  walls: Rect;
  pillar: { x: number; y: number; r: number };
  trumpet: { x: number; y: number; r: number };
  row: Rect;
  /** the cards' row */
  cards: Rect;
  /** the centre of the toasts and the story cards */
  cardY: number;
  cardX: number;
  cardW: number;
  /** the card between battles */
  upgrade: Rect;
}

export function layout(w: number, h: number, hudTop = 120): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = clamp(Math.min(W, H) / 430, 0.84, 1.25);
  const tall = W / H < 1;
  const short = !tall && H < 460;
  const top = clamp(hudTop, 0, H * 0.45);
  // the runner's simulator button sits bottom left: on a phone upright the cards keep above it
  const bottom = short ? 6 : tall ? 58 : 16;
  // the bottom: cards, then the light's row above them
  const cardH = (short ? 48 : 74) * u;
  const cards: Rect = { x: 16, y: H - bottom - cardH, w: W - 32, h: cardH };
  const rowH = (short ? 34 : 50) * u;
  const rowY = cards.y - (short ? 4 : 10) * u - rowH;
  const row: Rect = { x: 12, y: rowY, w: W - 24, h: rowH };
  const lr = rowH * (short ? 0.62 : 0.78);
  const lantern = { x: 16 + lr + 4 * u, y: rowY + rowH / 2 - (short ? 0 : 4 * u), r: lr };
  const tr = rowH * 0.56;
  const trumpet = { x: W - 16 - tr - 2 * u, y: rowY + rowH / 2, r: tr };
  const pillar = { x: trumpet.x - tr - 10 * u - tr * 0.9, y: rowY + rowH / 2, r: tr * 0.9 };
  const lx = lantern.x + lr + 12 * u, lw = Math.max(60, pillar.x - pillar.r - 12 * u - lx);
  const light: Rect = { x: lx, y: rowY + rowH * 0.12, w: lw, h: rowH * 0.42 };
  const walls: Rect = { x: lx, y: rowY + rowH * 0.62, w: lw, h: rowH * 0.28 };
  // the top: the battle's bar right under the runner's HUD
  const bh = (short ? 18 : 22) * u;
  const bw = Math.min(W - 32, 520 * u);
  const battle: Rect = { x: (W - bw) / 2, y: top + 4, w: bw, h: bh };
  const below = battle.y + bh + 6 * u;
  // the road: as much of it in view as the width allows (all of it on a desktop), the scale held by the room
  const room = rowY - below;
  let S = tall ? W / 10.5 : W / (RULES.road + 6.5);
  S = clamp(Math.min(S, room / (short ? 3.4 : 5.4)), 16, 48);
  const roadY = rowY - Math.max(16 * u, S * 0.7);
  const roadBack = roadY - S * 1.05;
  const bannerH = Math.max(18, Math.min(S * (tall ? 2.4 : 1.6), roadBack - below - S * 1.6));
  const tyR = (short ? 15 : 21) * u;
  const tymek = { x: 16 + tyR, y: below + tyR + 4 * u, r: tyR, maxW: Math.min(W - 32 - 2 * tyR - 14 * u, 380 * u) };
  // the card between battles sits under the battle's bar, ending above the light's row
  const upH = (short ? 150 : 214) * u;
  const upTop = below + 2 * u;
  const uw = Math.min(W - 24, 560 * u);
  return {
    w: W, h: H, u, tall, short, top, S, roadY, roadBack, viewM: W / S,
    battle, tymek,
    banners: { y: roadBack, h: bannerH, x0: 16, x1: W - 16 },
    lantern, light, walls, pillar, trumpet, row, cards,
    cardY: clamp((below + roadBack) / 2, below + 40 * u, H * 0.5),
    cardX: W / 2,
    cardW: Math.min(360 * u, W - 32),
    upgrade: { x: (W - uw) / 2, y: upTop, w: uw, h: Math.max(90, Math.min(upH, rowY - 6 * u - upTop)) },
  };
}
