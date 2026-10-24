/**
 * Where things sit on the screen, as pure math (shared by the renderer, the pointer and the tests):
 * the leaf fills the play area — upright on tall screens with the HUD in a strip above it, turned
 * sideways (tip to the right) on wide ones with the HUD in side columns — and the two egg cards sit
 * either side of the centre line.  The top 64 px stay free for the runner's clock and pause button.
 */
import { LEAF_H, LEAF_W } from './leaf';

export interface Rect { x: number; y: number; w: number; h: number }

export interface LeafBox { x0: number; y0: number; x1: number; y1: number }
export const FULL_BOX: LeafBox = { x0: 0, y0: 0, x1: LEAF_W, y1: LEAF_H };

export interface Layout {
  w: number;
  h: number;
  /** the leaf-space centre that sits at (cx, cy) */
  bx: number;
  by: number;
  /** a wide screen: the leaf lies sideways, the HUD sits in side columns */
  wide: boolean;
  /** leaf units → CSS px */
  scale: number;
  /** the screen centre of the leaf box */
  cx: number;
  cy: number;
  /** species, palette and recipe */
  info: Rect;
  /** wingspan, size class, the brain meter */
  stats: Rect;
  cards: [Rect, Rect];
}

export const TOP = 64;
/** the HUD panels' heights while it eats and while it rests (wide screens; the strip on tall ones is 72) */
export const PANEL_FEED = 190;
export const PANEL_REST = 140;
export const STRIP = 72;

/**
 * Where the side view (spinning, chrysalis, emergence) composes itself: the part of the screen the HUD
 * leaves free (between the side panels on a wide screen, under the strip on a tall one), and `under`,
 * the bottom of the HUD a stem has to pass beneath where it runs behind it.
 */
export interface SideArea { x0: number; y0: number; x1: number; y1: number; under: number }

export function sideArea(L: Layout): SideArea {
  if (L.wide) return { x0: L.info.x + L.info.w + 18, y0: TOP + 4, x1: L.stats.x - 18, y1: L.h - 28, under: L.info.y - 4 + PANEL_REST };
  return { x0: 0, y0: L.info.y + 80, x1: L.w, y1: L.h - 64, under: L.info.y - 4 + STRIP };
}

/** `box`: the part of leaf space to fit (the current leaf's bounds, with a little air). */
export function computeLayout(w: number, h: number, box: LeafBox = FULL_BOX): Layout {
  const wide = w > h * 1.1;
  const pad = 10, bw = box.x1 - box.x0 + 2 * pad, bh = box.y1 - box.y0 + 2 * pad;
  const bx = (box.x0 + box.x1) / 2, by = (box.y0 + box.y1) / 2;
  let scale: number, cx: number, cy: number, info: Rect, stats: Rect;
  if (wide) {
    const col = Math.min(280, Math.max(150, w * 0.2));
    const x0 = col + 8, x1 = w - col - 8, y0 = TOP, y1 = h - 34;
    scale = Math.min((x1 - x0) / bh, (y1 - y0) / bw);
    cx = (x0 + x1) / 2;
    cy = (y0 + y1) / 2;
    info = { x: 16, y: TOP + 8, w: col - 24, h: h - TOP - 90 };
    stats = { x: w - col + 8, y: TOP + 8, w: col - 24, h: h - TOP - 60 };
  } else {
    const hud = 66;
    const y0 = TOP + hud + 6, y1 = h - 58;
    scale = Math.min((w - 20) / bw, (y1 - y0) / bh);
    cx = w / 2;
    cy = (y0 + y1) / 2;
    info = { x: 16, y: TOP + 2, w: w / 2 - 20, h: hud };
    stats = { x: w / 2 + 4, y: TOP + 2, w: w / 2 - 20, h: hud };
  }
  // the egg cards: a title above them (~40 px), a hint below when there is room
  const gap = 8, title = 40;
  let cw = Math.min(214, (w - 48) / 2);
  let ch = cw * 1.38;
  const room = h - TOP - title - 18;
  if (ch > room) { ch = room; cw = Math.min(cw, ch / 1.2); }
  const cy0 = TOP + title + Math.max(0, (room - ch - 40) / 2);
  const cards: [Rect, Rect] = [{ x: w / 2 - gap - cw, y: cy0, w: cw, h: ch }, { x: w / 2 + gap, y: cy0, w: cw, h: ch }];
  return { w, h, bx, by, wide, scale, cx, cy, info, stats, cards };
}

/** Leaf space → screen (CSS px); `out` is reused. */
export function toScreen(L: Layout, x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
  if (L.wide) {
    out.x = L.cx + (L.by - y) * L.scale;
    out.y = L.cy + (x - L.bx) * L.scale;
  } else {
    out.x = L.cx + (x - L.bx) * L.scale;
    out.y = L.cy + (y - L.by) * L.scale;
  }
  return out;
}

/** Screen (CSS px) → leaf space; `out` is reused. */
export function toLeaf(L: Layout, sx: number, sy: number, out: { x: number; y: number }): { x: number; y: number } {
  if (L.wide) {
    out.x = L.bx + (sy - L.cy) / L.scale;
    out.y = L.by - (sx - L.cx) / L.scale;
  } else {
    out.x = L.bx + (sx - L.cx) / L.scale;
    out.y = L.by + (sy - L.cy) / L.scale;
  }
  return out;
}

/** The canvas transform that draws leaf space in place (after the dpr transform). */
export function applyLeafTransform(ctx: CanvasRenderingContext2D, L: Layout): void {
  ctx.translate(L.cx, L.cy);
  if (L.wide) ctx.rotate(Math.PI / 2);
  ctx.scale(L.scale, L.scale);
  ctx.translate(-L.bx, -L.by);
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
