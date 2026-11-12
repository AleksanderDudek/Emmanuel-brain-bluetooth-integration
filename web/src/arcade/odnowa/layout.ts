/**
 * Where Odnowa's play view puts things (CSS px), mobile first (DESIGN §12, §13.12).  The runner's HUD covers
 * the top of the canvas (`insets().top`); the game owns the rest, the bottom included.  Sizes start from a
 * 360 px phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall  (a phone upright, a tablet upright)  under the HUD the sing-along line and the division's three
 *         chips (passive), then the cell city with the engine lens in the middle (the ATP turbine, big),
 *         Mito top left, worn parts and lysosomes in the side columns, and the DNA lane across the bottom —
 *         in the thumb zone, where the hands work
 *   short (a phone on its side)  the lyric over the city, the lens left of centre, the chips stacked on the
 *         right, the lane across the bottom
 *   wide  (desktops, tablets on their side)  the tall layout grown: the lens centred, Mito and his bubble on
 *         the left, the clean-up on both sides, a wide lane
 *
 * Everything the player taps is a rectangle here (`tapTargets`), the same ones the view hit-tests and the
 * mobile audit checks: the turbine (the lens), Mito, and the story card while it is up.  The lane, the
 * autophagosomes and the free city are the play area: a tap there is never a precision tap — it goes to the
 * nearest lesion (the sim's `tapLane`/`repairNext`).
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, TAP_GAP, target, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export type { Rect };
export type Mode = 'tall' | 'short' | 'wide';
export interface Pt { x: number; y: number }
export interface Circle { x: number; y: number; r: number }

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  ins: Insets;
  top: number;
  /** the play band under the HUD */
  band: Rect;
  /** the sing-along line */
  lyric: Rect;
  /** the division's recipe: energy, material, DNA */
  chips: [Rect, Rect, Rect];
  /** the cell city between the chips and the lane */
  city: Rect;
  /** the engine lens (the ATP turbine) and its tap target */
  lens: Circle;
  lensHit: Rect;
  /** the DNA lane, its helix's centre line and amplitude, and where u = 0 and u = laneU fall */
  lane: Rect;
  laneMid: number;
  amp: number;
  ux0: number;
  ux1: number;
  /** Mito (the body's half-length) and his target; where his bubble goes */
  mito: Circle;
  mitoHit: Rect;
  bubble: { x: number; y: number; maxW: number; side: 'right' | 'left' };
  /** the worn parts' spots (two a side), the lysosomes (the third opens with the top lysosome level), extra mitochondria */
  spots: Pt[];
  lysos: Circle[];
  extras: Circle[];
  /** the nucleus in the backdrop (the lane's zoom source) */
  nucleus: Circle;
  /** the story card, the new cell's toast */
  card: Rect;
  toast: Rect;
  /** the label size for words the player reads (≥ 13 on a phone) */
  fs: number;
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const mode: Mode = W / H < 0.9 ? 'tall' : H < 460 ? 'short' : 'wide';
  const u = uiScale(W, H);
  const top = clamp(insets.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  const x0 = ins.left, x1 = W - ins.right, bottom = H - ins.bottom;
  const band: Rect = { x: x0, y: top, w: x1 - x0, h: bottom - top };
  const fs = Math.round(14 * u);
  let lyric: Rect, chips: [Rect, Rect, Rect], city: Rect, lane: Rect, lens: Circle, mito: Circle, card: Rect, toast: Rect;
  let bubble: Layout['bubble'];
  let spots: Pt[], lysos: Circle[];
  const gap = Math.round(TAP_GAP * u);
  if (mode === 'tall') {
    const m = W < 600 ? 10 : Math.round(20 * u);
    lyric = { x: x0 + 16, y: top + 3, w: x1 - x0 - 32, h: Math.round(22 * u) };
    const chipW = Math.min((x1 - x0 - 2 * m - 2 * gap) / 3, 220 * u), chipH = Math.round(32 * u);
    const chipsW = 3 * chipW + 2 * gap, cx0 = (x0 + x1) / 2 - chipsW / 2, cy = lyric.y + lyric.h + 3;
    chips = [0, 1, 2].map(i => ({ x: cx0 + i * (chipW + gap), y: cy, w: chipW, h: chipH })) as [Rect, Rect, Rect];
    const laneW = Math.min(x1 - x0 - 2 * m, 760 * u);
    const laneH = Math.round(clamp(band.h * 0.25, 86, 136 * u));
    lane = { x: (x0 + x1) / 2 - laneW / 2, y: bottom - Math.round(10 * u) - laneH, w: laneW, h: laneH };
    const cTop = cy + chipH + 4;
    city = { x: x0, y: cTop, w: x1 - x0, h: Math.max(60, lane.y - 6 - cTop) };
    const r = clamp(Math.min(city.h / 2 - 6, (x1 - x0) * 0.27), 50, 160 * u);
    // the lens sits just over the lane (near the thumb); a tall city keeps its upper part for Mito and his words
    lens = { x: (x0 + x1) / 2, y: Math.max(city.y + city.h / 2, lane.y - 20 - r * 1.1), r };
    const colW = lens.x - r - x0, colL = x0 + colW / 2, colR = x1 - colW / 2;
    const mr = Math.round(clamp(colW * 0.22, 15, 24 * u));
    mito = { x: colL, y: city.y + mr + 10, r: mr };
    bubble = { x: colL + mr * 1.3, y: city.y + 4, maxW: Math.min(x1 - x0 - 24 - (colL + mr * 1.3 - x0), 300 * u), side: 'right' };
    const lr = Math.round(clamp(colW * 0.2, 14, 26 * u));
    lysos = [
      { x: colL, y: city.y + city.h - lr - 6, r: lr },
      { x: colR, y: city.y + city.h - lr - 6, r: lr },
      { x: colR, y: city.y + lr + 10, r: lr },
    ];
    const midY = city.y + city.h * 0.5;
    spots = [{ x: colL, y: midY }, { x: colL + colW * 0.12, y: midY + city.h * 0.12 }, { x: colR, y: midY }, { x: colR - colW * 0.12, y: midY + city.h * 0.12 }];
    card = { x: x0 + 12, y: top + 8, w: x1 - x0 - 24, h: bottom - top - 16 };
    const tw = Math.min(x1 - x0 - 32, 380 * u);
    toast = { x: (x0 + x1) / 2 - tw / 2, y: city.y + 4, w: tw, h: Math.round(64 * u) };
  } else if (mode === 'short') {
    const m = 10;
    lyric = { x: x0 + (x1 - x0) * 0.2, y: top + 2, w: (x1 - x0) * 0.6, h: 20 };
    const laneH = Math.round(clamp(band.h * 0.26, 70, 96));
    lane = { x: x0 + m, y: bottom - 6 - laneH, w: x1 - x0 - 2 * m, h: laneH };
    const chipW = Math.round(clamp((x1 - x0) * 0.2, 112, 160)), chipH = 30;
    const cTop = top + lyric.h + 4;
    city = { x: x0, y: cTop, w: x1 - x0, h: Math.max(60, lane.y - 4 - cTop) };
    const chipX = x1 - m - chipW;
    const stackH = 3 * chipH + 2 * gap;
    const cy0 = city.y + Math.max(0, (city.h - stackH) / 2);
    chips = [0, 1, 2].map(i => ({ x: chipX, y: cy0 + i * (chipH + gap), w: chipW, h: chipH })) as [Rect, Rect, Rect];
    const r = clamp((city.h / 2 - 3) / 1.12, 46, 120);
    const lx = x0 + (chipX - x0) * 0.5;
    lens = { x: lx, y: city.y + city.h / 2, r };
    const colLw = lens.x - r - x0, colRw = chipX - (lens.x + r);
    const colL = x0 + colLw / 2, colR = lens.x + r + colRw / 2;
    const mr = Math.round(clamp(colLw * 0.18, 14, 22));
    mito = { x: colL, y: city.y + mr + 8, r: mr };
    bubble = { x: colL + mr * 1.3, y: city.y + 2, maxW: Math.min(320, chipX - 8 - (colL + mr * 1.3)), side: 'right' };
    const lr = Math.round(clamp(Math.min(colLw, colRw) * 0.2, 13, 22));
    lysos = [
      { x: colL, y: city.y + city.h - lr - 4, r: lr },
      { x: colR, y: city.y + city.h - lr - 4, r: lr },
      { x: colR, y: city.y + lr + 6, r: lr },
    ];
    const midY = city.y + city.h * 0.48;
    spots = [{ x: colL, y: midY }, { x: colL, y: midY + city.h * 0.1 }, { x: colR, y: midY }, { x: colR, y: midY + city.h * 0.1 }];
    const cw = Math.min(x1 - x0 - 24, 640);
    card = { x: (x0 + x1) / 2 - cw / 2, y: top + 6, w: cw, h: bottom - top - 12 };
    const tw = Math.min(x1 - x0 - 32, 360);
    toast = { x: lens.x - tw / 2, y: city.y + 2, w: tw, h: 58 };
  } else {
    // a desktop or a tablet on its side: the lens as big as the height allows, the chips a column on the right
    lyric = { x: (x0 + x1) / 2 - 320 * u, y: top + 6, w: 640 * u, h: Math.round(26 * u) };
    const laneW = Math.min(x1 - x0 - 64, 940 * u), laneH = Math.round(clamp(band.h * 0.22, 96, 136 * u));
    lane = { x: (x0 + x1) / 2 - laneW / 2, y: bottom - Math.round(14 * u) - laneH, w: laneW, h: laneH };
    const cTop = lyric.y + lyric.h + 6;
    city = { x: x0, y: cTop, w: x1 - x0, h: Math.max(80, lane.y - 10 - cTop) };
    const r = clamp(Math.min((city.h / 2 - 4) / 1.12, (x1 - x0) * 0.17), 64, 190 * u);
    lens = { x: (x0 + x1) / 2, y: city.y + city.h / 2, r };
    const side = (x1 - x0) / 2 - r * 1.12;
    const lc = lens.x - r * 1.12 - side / 2, rc = lens.x + r * 1.12 + side / 2;
    const chipW = Math.min(250 * u, side - 24), chipH = Math.round(36 * u);
    chips = [0, 1, 2].map(i => ({ x: rc - chipW / 2, y: city.y + 8 + i * (chipH + gap), w: chipW, h: chipH })) as [Rect, Rect, Rect];
    const mr = Math.round(24 * u);
    mito = { x: lens.x - r * 1.12 - Math.min(side * 0.3, 70 * u), y: lens.y - r * 0.62, r: mr };
    const bw = Math.min(340 * u, mito.x - mr * 1.4 - x0 - 24);
    bubble = { x: mito.x - mr * 1.4, y: mito.y - mr - 8, maxW: Math.max(140, bw), side: 'left' };
    const lr = Math.round(24 * u);
    // the right column's top is the chips': its worn parts and lysosomes keep below them
    const chipsBottom = chips[2].y + chips[2].h;
    const rowY = Math.max(lens.y + r * 0.42, chipsBottom + r * 0.4);
    lysos = [
      { x: lc, y: city.y + city.h - lr - 10, r: lr },
      { x: rc + side * 0.25, y: city.y + city.h - lr - 10, r: lr },
      { x: lc - side * 0.3, y: city.y + city.h - lr - 10, r: lr },
    ];
    spots = [
      { x: lc + side * 0.12, y: lens.y + r * 0.22 }, { x: lc - side * 0.2, y: lens.y + r * 0.02 },
      { x: lens.x + r * 1.12 + side * 0.2, y: rowY }, { x: lens.x + r * 1.12 + side * 0.45, y: Math.min(rowY + r * 0.3, city.y + city.h - lr * 2) },
    ];
    const cw = Math.min(x1 - x0 - 48, 560 * u), ch = Math.min(bottom - top - 24, 420 * u);
    card = { x: (x0 + x1) / 2 - cw / 2, y: top + (bottom - top - ch) / 2, w: cw, h: ch };
    const tw = Math.min(x1 - x0 - 48, 420 * u);
    toast = { x: (x0 + x1) / 2 - tw / 2, y: city.y + 4, w: tw, h: Math.round(66 * u) };
  }
  // the turbine's target: the square inside the lens (a finger on the glass), at least MIN_TAP
  const side = Math.max(MIN_TAP, lens.r * 1.36);
  const lensHit: Rect = { x: lens.x - side / 2, y: lens.y - side / 2, w: side, h: side };
  const mitoHit = target('mito', { x: mito.x - mito.r * 1.3, y: mito.y - mito.r, w: mito.r * 2.6, h: mito.r * 2 });
  // extra mitochondria cluster around the lens, half behind its rim
  const extras: Circle[] = [215, 325, 145].map(deg => {
    const a = (deg * Math.PI) / 180;
    return { x: lens.x + Math.cos(a) * (lens.r + 4), y: lens.y + Math.sin(a) * (lens.r + 4), r: Math.max(12, lens.r * 0.2) };
  });
  const pad = Math.max(10, lane.w * 0.03);
  const ux0 = lane.x + pad, ux1 = lane.x + lane.w - pad;
  const nucleus: Circle = { x: lane.x + lane.w * 0.12, y: lane.y + lane.h * 0.2, r: Math.max(90, W * 0.36) };
  return {
    w: W, h: H, mode, u, ins, top, band, lyric, chips, city, lens, lensHit, lane, laneMid: lane.y + lane.h * 0.54, amp: lane.h * 0.27,
    ux0, ux1, mito, mitoHit: { x: mitoHit.x, y: mitoHit.y, w: mitoHit.w, h: mitoHit.h }, bubble, spots, lysos, extras, nucleus, card, toast, fs,
  };
}

/** The lane's x of a position u (0 at the left, RULES.laneU at the right). */
export const laneX = (L: Layout, u: number): number => L.ux0 + (u / RULES.laneU) * (L.ux1 - L.ux0);
/** The lane position u of an x. */
export const laneU = (L: Layout, x: number): number => ((x - L.ux0) / Math.max(1, L.ux1 - L.ux0)) * RULES.laneU;

/** Whether a point is on the lane (a little above and below it too: the helix is the hands' field). */
export const onLane = (L: Layout, x: number, y: number): boolean =>
  x >= L.lane.x - 8 && x <= L.lane.x + L.lane.w + 8 && y >= L.lane.y - 18 && y <= L.lane.y + L.lane.h + 12;

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Whether a point is on the turbine (inside the lens's glass). */
export const onLens = (L: Layout, x: number, y: number): boolean => Math.hypot(x - L.lens.x, y - L.lens.y) <= L.lens.r + 6 || inRect(L.lensHit, x, y);

/** The controls the player can tap now: the story card alone while it is up; else the turbine and Mito. */
export function tapTargets(L: Layout, o: { card: boolean; started: boolean }): TapTarget[] {
  if (!o.started) return [];
  if (o.card) return [target('story card: tap to begin', L.card)];
  return [target('turbine', L.lensHit), target('mito', L.mitoHit)];
}
