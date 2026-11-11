/**
 * Where Dziewiątka's play view puts things (CSS px), for desktops and for phones upright and on their
 * side.  The runner's standard HUD covers the top (its Mendi panel and score, down to `hudTop`); the
 * simulator's switch may sit in the last `BOTTOM` px on the left, so the command strip stays above it
 * when there is room.  From the top down:
 *
 *   the street    the side-view field from hudTop to the strip: the five on the left, the Din on the
 *                 right, the well in a rest; Klara at the left edge with her bubble
 *   the strip     the five portraits (tap = the ultimate; at the well = a piece of gear), the energy
 *                 dial (the band's multiplier, ×1…×3, the threshold at ×2) on the left and the bell
 *                 (Harmony) on the right; on narrow screens the dial and the bell get a row of their own
 *
 * A short canvas (a phone on its side) goes compact: no bottom reserve and a slimmer strip.
 */
import { clamp } from '../kit/juice';
import { RULES } from './rules';

export const BOTTOM = 54;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** the runner's HUD bottom; the street's band */
  top: number;
  /** UI scale (1 on a desktop) */
  u: number;
  compact: boolean;
  narrow: boolean;
  /** px per u of the street, the street's left edge (u) and how wide it shows (u) */
  s: number;
  /** the figures' scale over the street's (tall phones draw them larger than their spacing) */
  k: number;
  x0: number;
  viewW: number;
  /** the feet line of the front row (px) and the depth of the rows (px) */
  groundY: number;
  depth: number;
  /** the street's bottom edge (px): below it, the strip */
  fieldBottom: number;
  /** the five portraits, the dial, the bell */
  slots: Rect[];
  dial: Rect;
  bell: Rect;
  /** the boons' cards (three) and the story card */
  cards: Rect[];
  story: Rect;
  /** the mission's pill under the HUD and the boss bar */
  pill: Rect;
  bossBar: Rect;
}

export function layout(w: number, h: number, hudTop: number): Layout {
  const u = clamp(Math.min(w / 900, h / 640), 0.7, 1.15);
  const top = clamp(hudTop || 64, 40, h * 0.55);
  const compact = h - top < 300;
  const narrow = w < 640;
  const bottomPad = compact ? 6 : BOTTOM;
  // the strip
  const m = Math.max(8, 12 * u);
  let slotH: number, slotW: number, gap: number;
  if (compact) {
    slotH = clamp((h - top) * 0.36, 44, 66);
    gap = 6;
    slotW = Math.min(118, (w - 2 * m - 2 * (slotH * 1.5 + gap) - 4 * gap) / 5);
  } else if (narrow) {
    gap = 5;
    slotW = (w - 2 * m - 4 * gap) / 5;
    slotH = clamp(slotW * 1.12, 64, 92);
  } else {
    gap = 10 * u;
    slotH = clamp(100 * u, 78, 116);
    slotW = clamp(118 * u, 92, 136);
  }
  const stripY = h - bottomPad - slotH;
  let rowW = 5 * slotW + 4 * gap;
  let rowX = (w - rowW) / 2;
  let dial: Rect, bell: Rect, fieldBottom: number;
  if (compact) {
    // a phone on its side: the strip keeps to the right (the simulator's switch may sit bottom left)
    const dialW = slotH * 1.45, bellW = slotH * 1.1;
    const free = w > 640 ? 180 : m;
    const avail = w - m - free - dialW - bellW - 2 * gap;
    slotW = Math.max(40, Math.min(slotW, (avail - 4 * gap) / 5));
    rowW = 5 * slotW + 4 * gap;
    rowX = w - m - bellW - gap - rowW;
    dial = { x: rowX - gap - dialW, y: stripY, w: dialW, h: slotH };
    bell = { x: rowX + rowW + gap, y: stripY, w: bellW, h: slotH };
    fieldBottom = stripY - 6;
  } else if (narrow) {
    // the dial and the bell above the portraits, at either side
    const rowH = clamp(54 * u, 46, 60);
    const y = stripY - 6 - rowH;
    dial = { x: m, y, w: Math.min(190, w * 0.5), h: rowH };
    bell = { x: w - m - rowH * 1.05, y, w: rowH * 1.05, h: rowH };
    fieldBottom = y - 4;
  } else {
    const side = clamp(slotH * 1.05, 80, 120);
    dial = { x: rowX - gap - side, y: stripY, w: side, h: slotH };
    bell = { x: rowX + rowW + gap, y: stripY, w: side * 0.86, h: slotH };
    if (dial.x < m) {
      const k = (rowX - m) / (side + gap);
      dial = { ...dial, x: m, w: Math.max(40, side * k) };
      bell = { ...bell, w: Math.max(40, Math.min(bell.w, w - m - bell.x)) };
    }
    fieldBottom = stripY - 6;
  }
  // the street: its right edge where the Din forms, as much of it as fits (phones a little closer)
  const fieldH = Math.max(40, fieldBottom - top);
  const s = Math.max(14, Math.min(w / (narrow ? 13.2 : 14.8), fieldH / 2.75));
  const x0 = RULES.fieldW + 0.1 - w / s;
  const k = narrow && !compact ? clamp(fieldH / s / 6.2, 1, 1.75) : 1;
  const depth = Math.min(s * k * 0.42, fieldH * 0.16);
  const groundY = fieldBottom - Math.max(6, fieldH * 0.06);
  // cards
  const cw = narrow ? Math.min(w - 2 * m, 300) : clamp(220 * u, 180, 250);
  const ch = narrow ? clamp((fieldBottom - top - 96) / 3 - 8, 54, 86) : clamp(150 * u, 116, 170);
  let cards: Rect[];
  // under the pill and the cards' title
  const cy = top + Math.max(clamp(22 * u, 18, 26) + 34, (fieldBottom - top - (narrow ? 3 * ch + 16 : ch)) / 2);
  if (narrow) cards = [0, 1, 2].map(i => ({ x: (w - cw) / 2, y: cy + i * (ch + 8), w: cw, h: ch }));
  else cards = [0, 1, 2].map(i => ({ x: w / 2 + (i - 1) * (cw + 16) - cw / 2, y: cy, w: cw, h: ch }));
  const sw = Math.min(w - 2 * m, 520 * Math.max(u, 0.85));
  const sh = Math.min(fieldBottom - top - 16 + (compact ? slotH : 0), narrow ? 330 : 270);
  const story: Rect = { x: (w - sw) / 2, y: Math.max(top + 8, (top + fieldBottom) / 2 - sh / 2), w: sw, h: sh };
  const pw = Math.min(w - 2 * m, 360 * u);
  const pill: Rect = { x: (w - pw) / 2, y: top + 4, w: pw, h: clamp(22 * u, 18, 26) };
  const bossBar: Rect = { x: (w - pw) / 2, y: pill.y + pill.h + 4, w: pw, h: clamp(12 * u, 9, 14) };
  const slots: Rect[] = Array.from({ length: 5 }, (_, i) => ({ x: rowX + i * (slotW + gap), y: stripY, w: slotW, h: slotH }));
  return { w, h, top, u, compact, narrow, s, k, x0, viewW: w / s, groundY, depth, fieldBottom, slots, dial, bell, cards, story, pill, bossBar };
}

/** A street point (u) to the canvas (px): `x` along the street, `y` the depth row (0 back … 1 front), `lift` above the feet (u). */
export function toScreen(L: Layout, x: number, y: number, lift = 0): { x: number; y: number } {
  return { x: (x - L.x0) * L.s, y: L.groundY - (1 - y) * L.depth - lift * L.s * L.k };
}

/** Is a point inside a rectangle (with some slack for fingers)? */
export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
