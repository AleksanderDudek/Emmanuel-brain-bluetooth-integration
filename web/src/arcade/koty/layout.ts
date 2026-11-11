/**
 * Where Kocia straż's play view puts things (CSS px), for desktops, phones upright and phones on their
 * side.  The runner's standard HUD covers the top (its Mendi panel on the left and the score on the
 * right, down to `hudTop`), and its simulator switch sits bottom left; the game keeps out of both.
 *
 *   tall (a phone upright)   the field under the HUD, the wall with the cats and the gatehouse's eye, the
 *                            chest (5 × 2), and the row of buttons (the three upgrades, a toy, the paw)
 *   wide (desktops, tablets) the field and the wall on the left, a column on the right under the score:
 *                            the fish, the chest, the buttons, the vintage
 *   short (a phone on its side) the chest under the Mendi panel, the field and the wall in the middle,
 *                            the buttons in a column under the score
 *
 * The field is the sim's 10 × 10 (x across, y from the far edge down to the wall), stretched onto its
 * rectangle; the cushions sit on the wall at the sim's `cushionX`, split around the eye in the middle.
 */
import { clamp } from '../kit/juice';
import type { BuyId } from './meta';
import { RULES } from './rules';
import { cushionX } from './sim';

export interface Rect { x: number; y: number; w: number; h: number }
export type Mode = 'tall' | 'wide' | 'short';

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale (1 on a desktop) */
  u: number;
  /** the runner's HUD's lower edge */
  top: number;
  /** the field (the sim's 10 × 10 maps onto it) and the scenery band above it */
  field: Rect;
  sky: Rect;
  /** px per field unit across and down, and the sprites' unit (the smaller, a little enlarged) */
  sx: number;
  sy: number;
  s: number;
  /** the wall: its band, and the line the cushions sit on */
  wall: Rect;
  seatY: number;
  /** a cat's height (px) */
  cat: number;
  /** the gatehouse's eye: the band's gauge and the hunt's button */
  eye: { x: number; y: number; r: number };
  /** the stage's bar (the stage, the place, the wave, the chief's courage and patience) */
  bar: Rect;
  /** the fish in the bowl */
  fish: Rect;
  /** the chest: its box, its cells (5 × 2 or 2 × 5) */
  chest: Rect;
  cols: number;
  rows: number;
  cell: number;
  /** the buttons */
  ups: Record<BuyId, Rect>;
  paw: Rect;
  vintage: Rect;
  /** Brother Anselm's portrait (centre, radius) and the room for his bubble */
  brother: { x: number; y: number; r: number; maxW: number; side: 'above' | 'right' };
  /** cards (story, the vintage's question) */
  card: Rect;
}

/** the runner's simulator switch sits bottom left (only on the simulator): the game keeps out of its corner */
const SWITCH = 56;

export function layout(w: number, h: number, hudTop: number, simulated = true): Layout {
  const BOTTOM = simulated ? SWITCH : 12;
  const W = Math.max(240, w), H = Math.max(200, h);
  const mode: Mode = W / H < 0.9 ? 'tall' : H < 460 ? 'short' : 'wide';
  const u = clamp(Math.min(W / 430, H / 640), 0.78, 1.25);
  const top = clamp(hudTop || 120, 40, H * 0.6);
  let field: Rect, wall: Rect, chest: Rect, fish: Rect, paw: Rect, vintage: Rect, bar: Rect;
  let ups: Record<BuyId, Rect>;
  let cols = 5, rows = 2, cell: number;
  const gap = 6 * u;
  if (mode === 'tall') {
    const m = 10;
    const btnH = Math.round(54 * u);
    const btnY = H - BOTTOM - btnH;
    const bw = (W - 2 * m - 4 * gap) / 5;
    const b = (i: number): Rect => ({ x: m + i * (bw + gap), y: btnY, w: bw, h: btnH });
    ups = { aim: b(0), paws: b(1), bowl: b(2), toy: b(3) };
    paw = b(4);
    cell = Math.min(56 * u, (W - 2 * m - 4 * gap) / 5, (btnY - top) * 0.135);
    const chestW = cols * cell + (cols - 1) * gap;
    const chestH = rows * cell + (rows - 1) * gap;
    chest = { x: (W - chestW) / 2 + 22 * u, y: btnY - gap * 1.5 - chestH, w: chestW, h: chestH };
    fish = { x: m, y: chest.y, w: Math.max(40, chest.x - m - gap), h: chestH };
    const wallH = Math.round(Math.max(54, 68 * u));
    wall = { x: 0, y: chest.y - gap - wallH, w: W, h: wallH };
    field = { x: 0, y: top + 24 * u, w: W, h: Math.max(60, wall.y - (top + 24 * u)) };
    bar = { x: m, y: top + 2, w: W - 2 * m, h: 18 * u };
    vintage = { x: W - m - 132 * u, y: field.y + 4, w: 132 * u, h: 30 * u };
  } else if (mode === 'wide') {
    const sideW = clamp(W * 0.27, 250, 380);
    const sx = W - sideW - 6;
    const m = 12;
    const colX = sx + 8, colW = sideW - 8 - m;
    cell = Math.min(62 * u, (colW - 4 * gap) / 5);
    const chestW = cols * cell + (cols - 1) * gap;
    const chestH = rows * cell + (rows - 1) * gap;
    fish = { x: colX, y: top + 4, w: colW, h: 34 * u };
    chest = { x: colX + (colW - chestW) / 2, y: fish.y + fish.h + gap * 1.5, w: chestW, h: chestH };
    const btnH = Math.round(56 * u);
    const bw = (colW - gap) / 2;
    const by = chest.y + chestH + gap * 2;
    ups = {
      aim: { x: colX, y: by, w: bw, h: btnH }, paws: { x: colX + bw + gap, y: by, w: bw, h: btnH },
      bowl: { x: colX, y: by + btnH + gap, w: bw, h: btnH }, toy: { x: colX + bw + gap, y: by + btnH + gap, w: bw, h: btnH },
    };
    paw = { x: colX, y: by + 2 * (btnH + gap), w: bw, h: btnH * 0.8 };
    vintage = { x: colX + bw + gap, y: by + 2 * (btnH + gap), w: bw, h: btnH * 0.8 };
    const wallH = Math.round(Math.max(64, 78 * u));
    wall = { x: 0, y: H - BOTTOM - wallH, w: sx, h: wallH };
    field = { x: 0, y: top + 26 * u, w: sx, h: Math.max(80, wall.y - (top + 26 * u)) };
    bar = { x: m, y: top + 3, w: Math.min(sx - 2 * m, 560 * u), h: 20 * u };
    bar.x = (sx - bar.w) / 2;
  } else {
    // short: a phone on its side — three columns under the top bar
    const m = 8;
    const leftW = Math.min(W * 0.4, 342);
    const rightW = clamp(W * 0.2, 130, 190);
    const fx = leftW + 6, fw = W - leftW - rightW - 12;
    const below = clamp(top, 56, H - 90);
    cols = 5;
    rows = 2;
    const avail = H - BOTTOM - below - 4;
    cell = Math.max(24, Math.min((avail - gap) / 2, (leftW - 2 * m - 4 * gap - 46) / 5));
    const chestW = cols * cell + (cols - 1) * gap;
    const chestH = rows * cell + gap;
    chest = { x: m + 2, y: below + 2, w: chestW, h: chestH };
    fish = { x: chest.x + chestW + gap, y: chest.y, w: Math.max(30, leftW - chestW - m - gap - 4), h: chestH };
    const rx = W - rightW - m;
    const scoreBottom = Math.min(H * 0.45, 128);
    const bh = Math.max(26, (H - scoreBottom - 8 - 5 * 4) / 5);
    const r = (i: number): Rect => ({ x: rx, y: scoreBottom + i * (bh + 4), w: rightW, h: bh });
    ups = { aim: r(0), paws: r(1), bowl: r(2), toy: r(3) };
    paw = { x: rx, y: scoreBottom + 4 * (bh + 4), w: rightW / 2 - 2, h: bh };
    vintage = { x: rx + rightW / 2 + 2, y: paw.y, w: rightW / 2 - 2, h: bh };
    const wallH = Math.round(Math.max(44, Math.min(60, H * 0.2)));
    wall = { x: fx, y: H - wallH - 4, w: fw, h: wallH };
    const fy = 56;
    field = { x: fx, y: fy + 14, w: fw, h: Math.max(50, wall.y - fy - 14) };
    bar = { x: fx + 4, y: fy - 2, w: fw - 8, h: 15 };
  }
  const sx = field.w / RULES.FW;
  const sy = field.h / RULES.FH;
  const s = clamp(Math.min(sx, sy * 1.25) * 1.15, 14, 56);
  const seatY = wall.y + wall.h * 0.38;
  const cat = Math.min(wall.h * 1.05, field.w / 7.2, 84);
  const eyeR = Math.min(wall.h * 0.46, field.w * 0.07, 46);
  const eye = { x: wall.x + wall.w / 2, y: wall.y + wall.h * 0.46, r: eyeR };
  const sky: Rect = { x: field.x, y: 0, w: field.w, h: field.y };
  const brR = (mode === 'short' ? 14 : 18) * u;
  // a phone upright fills its narrow wall with cats: the brother looks in from the field's top corner
  // instead, his bubble to his right; elsewhere he stands at the wall's end with his bubble above
  const brother = mode === 'tall'
    ? { x: field.x + brR + 8, y: field.y + brR + 4, r: brR, maxW: Math.min(field.w - 2 * brR - 30, 360 * u), side: 'right' as const }
    : { x: field.x + brR + 8, y: wall.y - brR - 10 * u, r: brR, maxW: Math.min(field.w - 2 * brR - 30, 360 * u), side: 'above' as const };
  const cw = Math.min(field.w - 24, 440 * u);
  const ch = Math.min(field.h + wall.h - 12, 300 * u);
  const card: Rect = { x: field.x + (field.w - cw) / 2, y: Math.max(field.y, field.y + (field.h + wall.h - ch) / 2 - 10), w: cw, h: ch };
  return {
    w: W, h: H, mode, u, top, field, sky, sx, sy, s, wall, seatY, cat, eye, bar, fish, chest, cols, rows, cell, ups, paw, vintage,
    brother, card,
  };
}

/** A field point (u) on the canvas (px). */
export const toPx = (L: Layout, x: number, y: number): { x: number; y: number } => ({ x: L.field.x + x * L.sx, y: L.field.y + y * L.sy });

/** A canvas point (px) in the field (u). */
export const toField = (L: Layout, x: number, y: number): { x: number; y: number } => ({ x: (x - L.field.x) / L.sx, y: (y - L.field.y) / L.sy });

/** A cushion's seat on the wall (px): where the cat sits. */
export function seat(L: Layout, i: number, n: number): { x: number; y: number } {
  return { x: L.wall.x + (cushionX(i, n) / RULES.FW) * L.wall.w, y: L.seatY };
}

/** The chest's i-th cell (px). */
export function cellRect(L: Layout, i: number): Rect {
  const c = i % L.cols, r = Math.floor(i / L.cols);
  const gap = (L.chest.w - L.cols * L.cell) / Math.max(1, L.cols - 1);
  const gy = L.rows > 1 ? (L.chest.h - L.rows * L.cell) / (L.rows - 1) : 0;
  return { x: L.chest.x + c * (L.cell + gap), y: L.chest.y + r * (L.cell + gy), w: L.cell, h: L.cell };
}

export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
