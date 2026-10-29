/**
 * Where Glina's play view puts things: the runner's own strips stay clear (the timer and the pause
 * button on top, the signal banner and the simulator button below), the HUD band sits under the
 * top strip, the card zone (the gate, the cut with its glaze buckets, the opening) over the
 * courtyard wall — across the top on a portrait phone, in the left column when wide — and the stage,
 * where the vessel stands on the wheel head with the ruler beside it.  The stage's scale (px per
 * cm) is fixed per form, so the tallest and widest vessel a form allows still fits, and an ordinary
 * one looks like the hero.  Pure geometry: the sim's tests use it too.
 */
import { clamp } from '../kit/juice';
import { limits, type ClayForm } from './clay';

/** The runner's own UI: the top strip (timer, pause), the bottom strip (signal banner, simulator button). */
export const TOP = 64;
export const BOTTOM = 66;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  kind: 'portrait' | 'landscape' | 'desktop';
  /** UI scale for fonts and strokes */
  u: number;
  /** the HUD band under the runner's strip */
  hudY: number;
  hudH: number;
  /** the cards' zone */
  card: Rect;
  /** the stage: the wheel's axis (x), the wheel head (the vessel's foot, y), the stage's top, the widest half-width */
  axis: number;
  foot: number;
  top: number;
  halfW: number;
  /** the ruler's left edge (px) */
  ruler: number;
  /** the courtyard: the wall's top, the floor line, the gate arch (behind the card zone), the kiln when wide */
  wallTop: number;
  floor: number;
  gate: Rect;
  kiln: Rect | null;
  /** pixels per cm are never more than this (small forms do not balloon) */
  maxScale: number;
}

export function layout(w: number, h: number): Layout {
  const kind: Layout['kind'] = h > w ? 'portrait' : h < 560 ? 'landscape' : 'desktop';
  if (kind === 'portrait') {
    const u = clamp(w / 390, 0.86, 1.25);
    const hudY = TOP, hudH = 48 * u;
    const card = { x: 16, y: hudY + hudH, w: w - 32, h: 150 * u };
    const top = card.y + card.h + 34 * u;
    const foot = Math.max(top + 160, h - 144 * Math.min(1, h / 844));
    const halfW = Math.min(w * 0.35, 190);
    const floor = Math.min(foot - 150 * u, top + (foot - top) * 0.45);
    return {
      w, h, kind, u, hudY, hudH, card, axis: w / 2, foot, top, halfW, ruler: w / 2 + halfW + 10 * u,
      wallTop: hudY + 50 * u, floor, gate: { x: 14, y: card.y + card.h + 10, w: Math.min(118 * u, w * 0.3), h: Math.max(80, floor - card.y - card.h - 10) },
      kiln: null, maxScale: 17 * u,
    };
  }
  if (kind === 'landscape') {
    const u = clamp(h / 390, 0.86, 1.2);
    const hudY = TOP, hudH = 36 * u;
    const card = { x: 16, y: hudY + hudH, w: Math.min(w * 0.32, 270 * u), h: Math.min(220 * u, h - hudY - hudH - BOTTOM - 8) };
    const foot = h - BOTTOM - 8;
    const top = hudY + 40 * u;
    const axis = Math.max(card.x + card.w + 150 * u, w * 0.56);
    const halfW = Math.min(140 * u, (w - axis) - 120 * u);
    const floor = top + (foot - top) * 0.62;
    return {
      w, h, kind, u, hudY, hudH, card, axis, foot, top, halfW, ruler: axis + halfW + 10 * u,
      wallTop: hudY + 6 * u, floor, gate: { x: 30, y: floor - (floor - hudY) * 0.86, w: Math.min(150 * u, card.w * 0.7), h: (floor - hudY) * 0.86 },
      kiln: { x: w - Math.min(170 * u, w * 0.19), y: floor - 150 * u, w: Math.min(170 * u, w * 0.19), h: 150 * u }, maxScale: 16 * u,
    };
  }
  const u = clamp(Math.min(w / 1440, h / 900) * 1.15, 1, 1.5);
  const hudY = TOP, hudH = 56 * u;
  const card = { x: 40, y: hudY + hudH + 10, w: Math.min(400 * u, w * 0.3), h: Math.min(300 * u, h * 0.4) };
  const foot = h - 140 * Math.min(1.2, h / 900);
  const top = hudY + hudH + 30;
  const halfW = Math.min(w * 0.18, 280 * u);
  const floor = top + (foot - top) * 0.62;
  const kw = Math.min(w * 0.22, 340 * u), kh = kw * 0.86;
  return {
    w, h, kind, u, hudY, hudH, card, axis: w / 2, foot, top, halfW, ruler: w / 2 + halfW + 14 * u,
    wallTop: hudY + 20 * u, floor, gate: { x: 64, y: floor - (floor - hudY) * 0.72, w: Math.min(220 * u, card.w * 0.62), h: (floor - hudY) * 0.72 },
    kiln: { x: w - kw - Math.max(40, w * 0.055), y: floor - kh * 0.92, w: kw, h: kh }, maxScale: 22 * u,
  };
}

/**
 * Pixels per cm of the stage for a form: its tallest vessel (the line at its highest) fits the
 * stage with room above, and its widest likely one (the outline at that height, a little wider)
 * fits the half-width; never more than the layout's cap.
 */
export function stageScale(L: Layout, f: ClayForm): number {
  const lim = limits(f);
  const byHeight = (L.foot - L.top) / (1.04 * lim.Hmax);
  const byWidth = L.halfW / (1.12 * lim.maxQ * lim.Hmax);
  return Math.max(1, Math.min(byHeight, byWidth, L.maxScale));
}

/** The finger's height on a vessel `H` cm tall (0 foot … 1 rim, clamped to [0.05, 1]). */
export function vesselU(L: Layout, scale: number, H: number, y: number): number {
  return clamp((L.foot - y) / Math.max(1, H * scale), 0.05, 1);
}

/** The play area: the whole canvas but the runner's top strip. */
export function inPlay(L: Layout, _x: number, y: number): boolean {
  return y >= TOP && y <= L.h;
}

/** The cut's glaze buckets, in a row along the card's lower edge (written into `out`). */
export function bucketRects(L: Layout, n: number, out: Rect[]): Rect[] {
  const c = L.card, u = L.u;
  const size = Math.min(58 * u, (c.w - 24) / Math.max(1, n) - 10);
  const gap = Math.min(16 * u, size * 0.3);
  const total = n * size + (n - 1) * gap;
  const x0 = c.x + (c.w - total) / 2, y = c.y + c.h - size - 12 * u;
  out.length = n;
  for (let i = 0; i < n; i++) out[i] = { x: x0 + i * (size + gap), y, w: size, h: size };
  return out;
}

export const hit = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
