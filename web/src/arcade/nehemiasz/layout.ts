/**
 * Where Nehemiasz's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12, §11.8).  The
 * runner's HUD covers the top (`insets().top`); the bottom is the game's thumb zone: the panel with the
 * stores, the guide's button (by day it builds what is next, by night it sends Nehemiah to the wall)
 * and, by night, the ram's horn — a 64 px button.  The world (18 × 10.4 u, the ground seen at a slant:
 * y is squashed by K) fills the band above the panel and runs on under the panel and the HUD; a phone
 * upright shows ~8.6 u across and the camera follows Nehemiah.
 *
 * Two shapes: upright (a phone, a tablet) the stores sit over the buttons; on its side (a phone) and on
 * a desktop one row holds the stores, the button and the horn.  The build badges stand in rows that
 * never overlap at S_MIN px per u or more: the fires and towers above the wall line, the wall's
 * sections and the gate just below it, then the guard posts, then the city.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { SEGS, type MarkerSpec } from './content';
import { RULES } from './rules';

export type { Rect };

/** the ground's slant: a world u down the screen is K × s px */
export const K = 0.78;
/** the fewest px per u on any screen: a phone upright shows ~8.6 u across, and the badges' rows stay apart */
export const S_MIN = 42;

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  /** the play band: from the runner's HUD down to the panel */
  top: number;
  bottom: number;
  /** UI scale: 1 on a phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** px per u, and the screen point the camera centre maps to */
  s: number;
  cx: number;
  cy: number;
  /** the camera may move across / down (the world is wider / taller than the band) */
  panX: boolean;
  panY: boolean;
  /** what can be pressed stays between these (16 px from a phone's edges, clear of a notch) */
  left: number;
  right: number;
  /** a phone upright; a short screen (a phone on its side); the stores over the buttons (upright) */
  phone: boolean;
  side: boolean;
  stack: boolean;
  /** the panel's backdrop, the stores' strip, the day's button, the night's button (beside the horn), the horn */
  panel: Rect;
  stores: Rect;
  guide: Rect;
  rush: Rect;
  horn: { x: number; y: number; r: number };
}

export function layout(w: number, h: number, ins: Insets = NO_INSETS): Layout {
  const u = uiScale(w, h);
  const side = h < 480;
  const stack = !side && w < 900;
  const phone = stack && w < 600;
  const top = clamp(ins.top, 0, h * 0.6);
  const edge = side ? 12 : 16 * u;
  const left = Math.max(ins.left > 0 ? ins.left + 8 : 0, edge);
  const right = w - Math.max(ins.right > 0 ? ins.right + 8 : 0, edge);
  const yb = h - ins.bottom - (side ? 8 : 10) * u;
  const hornR = Math.round((side ? 28 : 32) * u);
  const btnH = Math.round((side ? 50 : 54) * u);
  const rowH = Math.max(btnH, hornR * 2);
  const rowY = yb - rowH;
  const gap = 10 * u;
  let stores: Rect, guide: Rect, horn: { x: number; y: number; r: number }, panelY: number;
  if (stack) {
    horn = { x: right - hornR, y: rowY + rowH / 2, r: hornR };
    guide = { x: left, y: rowY + (rowH - btnH) / 2, w: right - left, h: btnH };
    const sh = Math.round(30 * u);
    stores = { x: left, y: rowY - 8 * u - sh, w: right - left, h: sh };
    panelY = stores.y - 8 * u;
  } else {
    // one row, centred: the stores, the button, the horn at the right (the thumb's side)
    const span = Math.min(right - left, 720 * u);
    const x0 = (left + right) / 2 - span / 2, x1 = x0 + span;
    horn = { x: x1 - hornR, y: rowY + rowH / 2, r: hornR };
    const sh = Math.round(36 * u);
    // the stores need ~280 px for five numbers at 12–13 px ("40/40", "100%")
    const sw = Math.round(clamp(span * 0.46, 280, 340 * u));
    stores = { x: x0, y: rowY + (rowH - sh) / 2, w: sw, h: sh };
    const gx = x0 + sw + gap;
    guide = { x: gx, y: rowY + (rowH - btnH) / 2, w: x1 - gx, h: btnH };
    panelY = rowY - 8 * u;
  }
  const rush = { ...guide, w: horn.x - horn.r - gap - guide.x };
  const panel = { x: 0, y: panelY, w, h: h - panelY };
  const bottom = panelY;
  const playH = Math.max(40, bottom - top);
  const Wu = RULES.worldW, Hu = (RULES.worldH - RULES.viewTop) * K;
  // a phone upright shows ~8.6 u across and follows Nehemiah; wider screens fill the band's height (at
  // least 10 u across), never under S_MIN
  const s = phone ? clamp(w / 8.6, S_MIN, 48) : Math.max(S_MIN, Math.min(playH / Hu, Math.max(w / Wu, w / 10)));
  return {
    w, h, ins, top, bottom, u, s, cx: w / 2, cy: top + playH / 2,
    panX: Wu * s > w + 1, panY: Hu * s > playH + 1,
    left, right, phone, side, stack, panel, stores, guide, rush, horn,
  };
}

/**
 * Where the camera wants to be (world u) for Nehemiah at (nx, ny): it follows him where the world is wider
 * or taller than the band; by day it keeps the wall's badges in sight while he works in the city, by
 * night it looks up toward the hills (the roads, the ridge of the band's history), never losing him.
 */
export function cameraFor(L: Layout, nx: number, ny: number, night: boolean): { x: number; y: number } {
  const s = L.s;
  const visW = L.w / s, visH = (L.bottom - L.top) / (s * K);
  let x = RULES.worldW / 2, y = (RULES.viewTop + RULES.worldH) / 2;
  if (L.panX) x = clamp(nx, visW / 2 - 0.4, RULES.worldW - visW / 2 + 0.4);
  if (L.panY) {
    const want = night ? Math.min(ny, RULES.wallY - 0.4) : Math.min(ny, RULES.wallY - (s * 0.62 + 30) / (s * K) + visH / 2);
    const keep = visH > 2.5 ? clamp(want, ny - visH / 2 + 0.9, ny + visH / 2 - 0.9) : ny;
    y = clamp(keep, RULES.viewTop + visH / 2 - 0.5, RULES.worldH - visH / 2 + 0.2);
  }
  return { x, y };
}

/** The screen point of a world point for a camera at (camX, camY). */
export function screenOf(L: Layout, camX: number, camY: number, x: number, y: number): { x: number; y: number } {
  return { x: L.cx + (x - camX) * L.s, y: L.cy + (y - camY) * L.s * K };
}

/** A marker's build badge on screen: its centre and radius, and the box a tap on it takes. */
export interface Badge { id: string; x: number; y: number; r: number; box: Rect }

/**
 * Where a marker's build badge sits and the box a tap on it takes, in rows that never overlap at s ≥
 * S_MIN: the fires and towers stand on the wall walk, so theirs sit above the wall line (down to the
 * spot where Nehemiah stands); the wall's sections and the gate take the wide strip of scaffold just
 * inside the wall; the guard posts and the city's buildings sit on their plots.
 */
export function badgeOf(L: Layout, camX: number, camY: number, m: MarkerSpec): Badge {
  const s = L.s;
  const X = (x: number) => L.cx + (x - camX) * s;
  const Y = (y: number) => L.cy + (y - camY) * s * K;
  const r = clamp(s * 0.3, 12, 20);
  const wall = Y(RULES.wallY);
  if (m.kind === 'fire' || m.kind === 'tower') {
    // neighbours on the wall walk are 1.2 u apart at the closest (a tower, the gate's fire, a tower)
    const bw = clamp(s * 1.2 - 6, MIN_TAP, 64);
    const y0 = wall - s * 0.62 - 24, y1 = wall + 3;
    return { id: m.id, x: X(m.x), y: wall - s * 0.62, r, box: { x: X(m.x) - bw / 2, y: y0, w: bw, h: y1 - y0 } };
  }
  if (m.kind === 'wall' || m.kind === 'gate') {
    const sg = SEGS[m.seg ?? 0];
    const x0 = X(sg.x0) + 4, x1 = X(sg.x1) - 4;
    const bh = Math.max(MIN_TAP, s * 0.9);
    const y0 = wall + 8;
    return { id: m.id, x: X(m.x), y: y0 + bh / 2, r, box: { x: x0, y: y0, w: x1 - x0, h: bh } };
  }
  const size = Math.max(MIN_TAP, s * 0.95);
  const cy = m.kind === 'post' ? Y(m.y) : Y(m.y) - s * 0.2;
  return { id: m.id, x: X(m.x), y: cy, r, box: { x: X(m.x) - size / 2, y: cy - size / 2, w: size, h: size } };
}

/** Whether a badge's whole box lies where a finger may press: inside the band, clear of the panel and the edges. */
export function badgeFree(L: Layout, b: Badge): boolean {
  const x = b.box;
  return x.x >= L.left && x.x + x.w <= L.right && x.y >= L.top + 2 && x.y + x.h <= L.bottom - 2;
}

/** A point inside a rectangle. */
export const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Two rectangles that share more than a sliver. */
export const overlaps = (a: Rect, b: Rect): boolean =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
