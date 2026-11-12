/**
 * Where everything sits on Synapsy's canvas, phone first (DESIGN §12): pure numbers, so the tests can check
 * every size the arcade is played on.
 *
 *   tall   a phone upright (the reference) and a tablet: the brain fills the band under the HUD; the lens
 *          (the gauge) in the bottom-left corner beside the occipital lobe, Oli's button in the bottom-right
 *          corner under the thumb, the sing-along line between them; the message strip (a lesson card, a
 *          Wiedza card) at the top of the band, over the frontal lobes for a few seconds.
 *   side   a phone on its side and a desktop: the brain in the middle at the band's full height; a column on
 *          the left for the lens and the message strip, a column on the right for Oli (bottom, under the
 *          right thumb) and her bubble; the song line at the bottom of the left column.
 *
 * The halves' plate sits on the corpus callosum itself, between its two lanes.  `u` is the kit's uiScale
 * (1 on any phone, up to 1.3).
 */
import { MIN_TAP, target, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { OUTLINE } from './brain';

export type Mode = 'tall' | 'side';

export interface Layout {
  w: number;
  h: number;
  u: number;
  ins: Insets;
  mode: Mode;
  /** the play band under the HUD, inside the insets */
  band: Rect;
  /** the brain's centre (px) and its scale (px per unit) */
  cx: number;
  cy: number;
  s: number;
  /** the brain's box (px) */
  brain: Rect;
  /** the lens: centre and radius */
  lens: { x: number; y: number; r: number };
  /** Oli's button (a round button in this square) */
  oli: Rect;
  /** the sing-along line */
  song: Rect;
  /** the message strip: a lesson's card, a new Wiedza card */
  strip: Rect;
  /** Oli's bubble: where it may grow (it hangs from its bottom-right corner over Oli) */
  bubble: Rect;
  /** the halves' plate on the bridge */
  plate: Rect;
  /** the story card */
  card: Rect;
  /** how near a finger must land to pick a neuron (px) */
  pick: number;
  /** a neuron's body radius (px) */
  soma: number;
}

/** The brain's outline spans about this many units across and down (both hemispheres, with the egg's rim). */
const SPAN_X = OUTLINE.half + 0.02;
const SPAN_Y = OUTLINE.ry + 0.02;

export function layout(w: number, h: number, ins: Insets, spacing = 0.235): Layout {
  const u = uiScale(w, h);
  const band: Rect = { x: ins.left, y: ins.top, w: Math.max(1, w - ins.left - ins.right), h: Math.max(1, h - ins.top - ins.bottom) };
  const mode: Mode = band.w / band.h < 1.15 ? 'tall' : 'side';
  const songH = Math.round(24 * u);
  const edge = 16;   // nothing to press in the outer 16 px of the sides
  let s: number, cx: number, cy: number, lens: Layout['lens'], oli: Rect, song: Rect, strip: Rect, bubble: Rect;
  const oliSize = Math.round(Math.min(64, Math.max(52, band.w * 0.15)) * u);
  if (mode === 'tall') {
    const boxH = band.h - songH - 10;
    s = Math.max(40, Math.min((band.w - 12) / 2 / SPAN_X, boxH / 2 / SPAN_Y));
    cx = band.x + band.w / 2;
    cy = band.y + 4 + boxH / 2;
    const r = Math.round(Math.min(46 * u, Math.max(28, band.w * 0.085 * u)));
    lens = { x: band.x + edge + r, y: band.y + band.h - 8 - r, r };
    oli = { x: band.x + band.w - edge - oliSize, y: band.y + band.h - 8 - oliSize, w: oliSize, h: oliSize };
    const sx = lens.x + r + 8, ex = oli.x - 8;
    song = { x: sx, y: band.y + band.h - songH - 4, w: Math.max(40, ex - sx), h: songH };
    strip = { x: band.x + 8, y: band.y + 6, w: band.w - 16, h: Math.round(46 * u) };
    const bw = Math.min(band.w - 2 * edge, Math.round(300 * u));
    // the bubble hangs over Oli's nest, clear of her name above it
    bubble = { x: oli.x + oli.w - bw, y: band.y + band.h * 0.42, w: bw, h: oli.y - 30 - (band.y + band.h * 0.42) };
  } else {
    s = Math.max(40, Math.min(band.h - 10, (band.w * 0.56)) / 2 / SPAN_Y);
    cx = band.x + band.w / 2;
    cy = band.y + band.h / 2;
    const left = cx - SPAN_X * s;
    const colW = Math.max(60, left - band.x - 12);
    const r = Math.round(Math.max(28, Math.min(colW * 0.32, 64 * u, band.h * 0.16)));
    lens = { x: band.x + 10 + Math.max(edge, colW / 2), y: band.y + 12 + r, r };
    if (colW > 2.6 * r + 20) lens.x = band.x + edge + r;
    oli = { x: band.x + band.w - edge - oliSize, y: band.y + band.h - 8 - oliSize, w: oliSize, h: oliSize };
    song = { x: band.x + 8, y: band.y + band.h - songH - 6, w: colW, h: songH };
    strip = { x: band.x + 8, y: lens.y + r + 10, w: colW, h: Math.max(40, song.y - 8 - (lens.y + r + 10)) };
    const rightX = cx + SPAN_X * s + 8;
    const bw = Math.max(80, band.x + band.w - edge - rightX);
    bubble = { x: band.x + band.w - edge - bw, y: band.y + 8, w: bw, h: oli.y - 30 - (band.y + 8) };
  }
  const brain: Rect = { x: cx - SPAN_X * s, y: cy - SPAN_Y * s, w: 2 * SPAN_X * s, h: 2 * SPAN_Y * s };
  const soma = Math.max(5.5, Math.min(9, s * 0.04)) * Math.min(u, 1.15);
  // the plate sits on the callosum between its two lanes, as wide as the hippocampi on either side allow
  const pw = Math.round(Math.max(44, Math.min(70 * u, 2 * (0.28 * s - soma * 1.9 - 3))));
  const ph = Math.round(44 * Math.min(u, 1.15));
  const plate: Rect = { x: cx - pw / 2, y: cy + 0.13 * s - ph / 2, w: pw, h: ph };
  const cw = Math.min(band.w - 24, Math.round(470 * u));
  const ch = Math.min(band.h - 16, Math.round(330 * u));
  const card: Rect = { x: band.x + (band.w - cw) / 2, y: band.y + (band.h - ch) / 2, w: cw, h: ch };
  const pick = Math.max(22, Math.min(40, spacing * s * 0.62));
  return { w, h, u, ins, mode, band, cx, cy, s, brain, lens, oli, song, strip, bubble, plate, card, pick, soma };
}

/** A point of the brain (units) on the screen (px). */
export const toScreen = (L: Layout, x: number, y: number): { x: number; y: number } => ({ x: L.cx + x * L.s, y: L.cy + y * L.s });

/** A point on the screen (px) in the brain (units). */
export const toBrain = (L: Layout, x: number, y: number): { x: number; y: number } => ({ x: (x - L.cx) / L.s, y: (y - L.cy) / L.s });

/** Whether (x, y) is on Oli's button (a finger-sized circle in its square). */
export function onOli(L: Layout, x: number, y: number): boolean {
  const r = Math.max(L.oli.w, MIN_TAP) / 2 + 4;
  return Math.hypot(x - (L.oli.x + L.oli.w / 2), y - (L.oli.y + L.oli.h / 2)) <= r;
}

/** The controls that can be tapped now: Oli's button, or the story card while it is up. */
export function tapTargets(L: Layout, o: { story: boolean }): TapTarget[] {
  if (o.story) return [target('story card', L.card)];
  return [target('Oli (myelin)', L.oli)];
}
