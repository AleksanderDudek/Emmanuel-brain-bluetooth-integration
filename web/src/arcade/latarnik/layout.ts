/**
 * Where Latarnik's play view puts things: the largest round sea that fits between the runner's
 * own strips (the timer and pause button on top, the signal banner and simulator button below),
 * with room for the HUD above and below it on a portrait phone, or beside it when wide; and the
 * card slot (amber, the blind reveal), which never covers the sea.
 */
import { clamp } from '../kit/juice';

/** The runner's own UI: the top strip (timer, pause), the bottom strip (signal banner, simulator button). */
export const TOP = 64;
export const BOTTOM = 66;

export interface Layout {
  w: number;
  h: number;
  /** the lamp, i.e. the sea's centre, and the sea's radius R */
  cx: number;
  cy: number;
  R: number;
  /** the island's radius and one boat length (px) */
  s: number;
  boat: number;
  portrait: boolean;
  /** UI scale */
  u: number;
}

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * The largest sea that fits between the runner's strips: on a portrait phone with the status and
 * the score above it and, below it, the lanterns' row with the card slot under that; when wide,
 * with the HUD in the columns beside it.  A small sea gets a slightly larger island (its village
 * still inside the reef ring) and boats of at least 20 px, so both read on a phone.
 */
export function layout(w: number, h: number): Layout {
  const u = clamp(Math.min(w, h) / 430, 0.84, 1.2);
  const hudTop = 104 * u, hudBottom = 128 * u;
  const rPortrait = Math.min(w / 2 - 8, (h - TOP - BOTTOM - hudTop - hudBottom) / 2);
  const side = clamp(w * 0.2, 150 * u, 300);
  const rLand = Math.min((h - TOP - BOTTOM) / 2 + 6, (w - 2 * side) / 2);
  const portrait = rPortrait >= rLand;
  const R = Math.max(60, portrait ? rPortrait : rLand);
  const cy = portrait ? TOP + hudTop + (h - TOP - BOTTOM - hudTop - hudBottom) / 2 : TOP + (h - TOP - BOTTOM) / 2;
  const s = R * (0.13 - 0.015 * clamp((R - 180) / 120));
  return { w, h, cx: w / 2, cy, R, s, boat: Math.max(20, R * 0.1), portrait, u };
}

/** The portrait phone's row of lanterns and perfects under the sea (its baseline, px). */
export const lanternRow = (L: Layout): number => Math.min(L.h - BOTTOM - 22 * L.u, L.cy + L.R + 34 * L.u);

/**
 * The card slot, off the sea: on a portrait phone under the lanterns' row, when wide in the left
 * column under the lanterns (`below`: their lowest point).  Written into `out` (no garbage per frame).
 */
export function cardSlot(L: Layout, below: number, out: Rect): Rect {
  const { u } = L;
  out.h = 66 * u;
  if (L.portrait) {
    out.w = Math.min(L.w - 32, 300 * u);
    out.x = (L.w - out.w) / 2;
    out.y = Math.min(L.h - BOTTOM - out.h - 4, lanternRow(L) + 24 * u);
  } else {
    out.w = Math.max(150 * u, Math.min(L.cx - L.R - 30, 290 * u));
    out.x = 18;
    out.y = Math.min(L.h - BOTTOM - out.h - 4, below + 16 * u);
  }
  return out;
}
