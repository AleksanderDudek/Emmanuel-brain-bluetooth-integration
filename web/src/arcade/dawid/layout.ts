/**
 * Where Dawid's play view puts things (CSS px), for desktops and for phones upright and on their side.
 * The runner's standard HUD covers the top (its Mendi panel and score, down to `hudTop`); its bottom strip
 * (the banner, the simulator's switch) keeps the last `BOTTOM` px.  David stands a little below the middle
 * of the band between them and the map runs under everything; the game's own bits sit at the band's
 * edges: the quest pill and the minimap at the top, the level's bar at the bottom with health and the
 * party above it on the left, the bag and the great stone's dial on the right, and the camp's card as a
 * sheet over the bottom when David is in camp.
 */
import { clamp } from '../kit/juice';

export const BOTTOM = 62;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  top: number;
  bottom: number;
  /** UI scale (1 on a desktop) */
  u: number;
  /** px per u of the map, and where David stands (px) */
  s: number;
  kx: number;
  ky: number;
  halfW: number;
  halfH: number;
  xp: Rect;
  hp: Rect;
  party: { x: number; y: number; r: number; gap: number };
  bag: { x: number; y: number; r: number };
  stone: { x: number; y: number; r: number };
  quest: { x: number; y: number; w: number; h: number };
  mini: Rect | null;
  /** the camp's card: its box, columns, a tile's size, the tabs' height */
  card: Rect;
  cols: number;
  tileW: number;
  tileH: number;
  tabH: number;
  bannerY: number;
  narrow: boolean;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const u = clamp(Math.min(w / 900, h / 620), 0.72, 1.15);
  const top = clamp(hudTop || 64, 40, h * 0.5);
  const bottom = h - BOTTOM;
  const s = clamp(Math.min(w, h - top * 0.5) / 11.5, 30, 54);
  const kx = w / 2;
  const ky = top + (bottom - top) * 0.52;
  const halfW = Math.max(kx, w - kx) / s;
  const halfH = Math.max(ky, h - ky) / s;
  const m = 12 * u;
  const narrow = w < 600;
  const xpH = Math.max(9, 11 * u);
  const xp = { x: m, y: bottom - xpH - 4, w: w - 2 * m, h: xpH };
  // a row of words over the bar (the level, the XP), then health over that
  const hpH = Math.max(8, 10 * u);
  const hp = { x: m, y: xp.y - 18 * u - hpH, w: Math.min(narrow ? w * 0.44 : 240 * u, w * 0.5), h: hpH };
  const pr = 16 * u;
  const party = { x: m + pr, y: hp.y - 10 * u - pr, r: pr, gap: pr * 2 + 8 * u };
  const br = 22 * u;
  const bag = { x: w - m - br, y: xp.y - 20 * u - 13 * u - br, r: br };
  const stone = { x: bag.x - br - 16 * u - br, y: bag.y, r: br };
  const mw = narrow ? Math.min(96, w * 0.26) : 132 * u;
  const mini = h < 360 ? null : { x: w - m - mw, y: top + 6, w: mw, h: mw * (42 / 64) };
  const quest = { x: m, y: top + 6, w: Math.min(440 * u, w - 2 * m - (mini ? mini.w + 10 : 0)), h: 26 * u };
  const cols = w < 520 ? 3 : w < 900 ? 4 : 5;
  const cw = Math.min(w - 2 * m, 860 * u);
  const pad = 10 * u, gap = 6 * u;
  const tileW = (cw - pad * 2 - gap * (cols - 1)) / cols;
  const tileH = 56 * u;
  const tabH = 28 * u;
  const rows = Math.ceil(9 / cols);
  const ch = pad * 2 + tabH + 6 * u + rows * tileH + (rows - 1) * gap;
  const card = { x: (w - cw) / 2, y: Math.max(top + 40 * u, xp.y - 10 * u - ch), w: cw, h: ch };
  return {
    w, h, top, bottom, u, s, kx, ky, halfW, halfH, xp, hp, party, bag, stone, quest, mini, card, cols, tileW, tileH, tabH,
    bannerY: top + 70 * u, narrow,
  };
}
