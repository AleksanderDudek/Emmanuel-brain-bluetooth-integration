/**
 * Where things sit on Motylarnia's screen: the camera that follows the caterpillar's head through the
 * garden (it zooms out as the caterpillar grows, as in the original), the play area below the
 * runner's standard HUD, the flowerbed strip (the band's last 40 s) along the bottom, the twig where
 * the chrysalises hang, and Hieronim's corner.  Pure numbers, no drawing.
 */
import { RULES } from './rules';

export interface Rect { x: number; y: number; w: number; h: number }
/** a box in the wing's leaf space (wing.ts maps a path from it) */
export interface LeafBox { x0: number; y0: number; x1: number; y1: number }

export interface Layout {
  w: number;
  h: number;
  /** the play area: below the HUD band, above the flowerbed */
  play: Rect;
  /** the flowerbed strip along the bottom (the signal's history) */
  bed: Rect;
  /** the twig (its attachment line) and the chrysalis length on it */
  twig: { x0: number; x1: number; y: number; len: number };
  /** Hieronim the snail: where he sits, and his size */
  snail: { x: number; y: number; s: number };
  /** px per world unit at the start length */
  zoom: number;
  phone: boolean;
}

export function computeLayout(w: number, h: number, hudTop: number): Layout {
  const phone = w < 600;
  const bedH = phone ? 38 : 46;
  const top = Math.min(h * 0.4, Math.max(0, hudTop));
  const play = { x: 0, y: top, w, h: Math.max(80, h - top - bedH) };
  const bed = { x: 0, y: h - bedH, w, h: bedH };
  // the twig hangs from the right edge, under the score corner's band
  const len = Math.max(36, Math.min(76, Math.min(w, h) * 0.1));
  const twigY = top + 10;
  const twig = { x0: w - Math.min(w * 0.42, 6 + len * 0.95 * (RULES.twigMax + 0.6)), x1: w + 4, y: twigY, len };
  const s = phone ? 0.8 : 1;
  // above the bottom-left corner (the simulator's button sits there in a demo)
  const snail = { x: 16 + 30 * s, y: bed.y - 52, s };
  const zoom = Math.max(0.8, Math.min(2, Math.min(w, h * 1.1) / 430));
  return { w, h, play, bed, twig, snail, zoom, phone };
}

/** The camera's zoom for a caterpillar of `len` segments (it zooms out as it grows). */
export const zoomFor = (L: Layout, len: number): number => L.zoom * (1 - 0.32 * Math.min(1, Math.max(0, (len - RULES.startLen) / 60)));

export interface Camera { x: number; y: number; z: number }

/** World → screen with a camera centred on (cam.x, cam.y) in the middle of the play area. */
export function toScreen(L: Layout, cam: Camera, x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = L.play.x + L.play.w / 2 + (x - cam.x) * cam.z;
  out.y = L.play.y + L.play.h / 2 + (y - cam.y) * cam.z;
  return out;
}

export function toWorld(L: Layout, cam: Camera, sx: number, sy: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = cam.x + (sx - L.play.x - L.play.w / 2) / cam.z;
  out.y = cam.y + (sy - L.play.y - L.play.h / 2) / cam.z;
  return out;
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
