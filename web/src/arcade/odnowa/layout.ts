/**
 * Where Odnowa's play view puts things (CSS px), mobile first (DESIGN §12, §13.12).  The runner's HUD covers
 * the top of the canvas (`insets().top`); the game owns the rest, the bottom included.  Sizes start from a
 * 360 px phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 * Round 11 (clarity): under the HUD, always, the **what to do now** line (`now`) and the **goal** — its sentence
 * and the three needs as labelled bars (`chips`: Energia, Naprawa DNA, Budulec).
 *
 *   tall  (a phone upright, a tablet upright)  the now line, the goal's sentence and its three bars in a row
 *         (passive: the top band is the HUD's), then the cell with the engine lens in the middle (the ATP turbine),
 *         Mito top left, worn parts and lysosomes in the side columns, and the DNA lane across the bottom — in the
 *         thumb zone, where the hands work
 *   short (a phone on its side)  the now line over the cell, the lens left of centre, the goal stacked on the right,
 *         the lane across the bottom
 *   wide  (desktops, tablets on their side)  the now line centred over the lens; the goal a panel in the right
 *         column (its sentence, the three bars with their sources, and what a division brings); Mito, his words and
 *         the clean-up in the left column; the sing-along line under the goal; a wide lane
 *   a desk (a mouse on a desktop or a big screen, kit/mobile `screenKind`, §14)  the wide layout with the lens as
 *         big as the cell allows (the phone's caps lifted), a Wiedza card shown whole, hover answers in the view
 *
 * Everything the player taps is a rectangle here (`tapTargets`), the same ones the view hit-tests and the mobile
 * audit checks: Mito, and the story card while it is up.  The lane and the free cell are the play area: a tap
 * there is never a precision tap — it goes to the nearest damage (the sim's `tapAt`).
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, TAP_GAP, screenKind, target, uiScale, type Rect } from '../kit/mobile';
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
  /** a mouse on a desktop or a big screen: the lens grows, the cards show whole, hover answers */
  desk: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop (a big screen's desk: up to 2.2) */
  u: number;
  ins: Insets;
  top: number;
  /** the play band under the HUD */
  band: Rect;
  /** the "what to do now" line */
  now: Rect;
  /** the goal: its box, its sentence, the three needs (energy, DNA repair, building material) */
  goal: Rect;
  goalTitle: Rect;
  chips: [Rect, Rect, Rect];
  /** how a need is drawn: a two-line chip (a phone upright), one line (a phone on its side), a bar with its source (a wide panel) */
  chipStyle: 'compact' | 'line' | 'bar';
  /** what a division brings (a wide panel only) */
  outcome: Rect | null;
  /** the sing-along line (a wide layout only: on a phone the top has enough words) */
  lyric: Rect | null;
  /** the cell between the goal and the lane */
  city: Rect;
  /** the engine lens (the ATP turbine), and the square a desk's mouse finds it in */
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
  /** where Mito's bubble goes: its top (`anchor` top) or its bottom (`anchor` bottom: a wide column, Mito under his words) */
  bubble: { x: number; y: number; maxW: number; side: 'right' | 'left'; anchor: 'top' | 'bottom' };
  /** the worn parts' spots (two a side: 0/1 go to lysosome 0, 2/3 to lysosome 1), the lysosomes, extra mitochondria */
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

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const mode: Mode = W / H < 0.9 ? 'tall' : H < 460 ? 'short' : 'wide';
  const kind = screenKind(W, H, touch);
  const desk = !touch && mode === 'wide' && (kind === 'desktop' || kind === 'big');
  const u = uiScale(W, H);
  const top = clamp(insets.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  const x0 = ins.left, x1 = W - ins.right, bottom = H - ins.bottom;
  const band: Rect = { x: x0, y: top, w: x1 - x0, h: bottom - top };
  const fs = Math.round(14 * u);
  const gap = Math.round(TAP_GAP * u);
  let now: Rect, goal: Rect, goalTitle: Rect, chips: [Rect, Rect, Rect], outcome: Rect | null = null, lyric: Rect | null = null;
  let city: Rect, lane: Rect, lens: Circle, mito: Circle, card: Rect, toast: Rect;
  let bubble: Layout['bubble'];
  let spots: Pt[], lysos: Circle[];
  let chipStyle: Layout['chipStyle'] = 'compact';
  if (mode === 'tall') {
    const m = W < 600 ? 8 : Math.round(20 * u);
    const iw = x1 - x0 - 2 * m;
    now = { x: x0 + m, y: top + 4, w: iw, h: Math.round(30 * u) };
    goalTitle = { x: x0 + m, y: now.y + now.h + 4, w: iw, h: Math.round(17 * u) };
    const chipW = Math.min((iw - 2 * gap) / 3, 230 * u), chipH = Math.round(40 * u);
    const cx0 = (x0 + x1) / 2 - (3 * chipW + 2 * gap) / 2, cy = goalTitle.y + goalTitle.h + 2;
    chips = [0, 1, 2].map(i => ({ x: cx0 + i * (chipW + gap), y: cy, w: chipW, h: chipH })) as [Rect, Rect, Rect];
    goal = { x: x0 + m, y: goalTitle.y, w: iw, h: cy + chipH - goalTitle.y };
    const laneW = Math.min(iw, 760 * u);
    const laneH = Math.round(clamp(band.h * 0.23, 84, 130 * u));
    lane = { x: (x0 + x1) / 2 - laneW / 2, y: bottom - Math.round(8 * u) - laneH, w: laneW, h: laneH };
    const cTop = cy + chipH + 5;
    city = { x: x0, y: cTop, w: x1 - x0, h: Math.max(60, lane.y - 5 - cTop) };
    // the lens and its gauge ring (r · 1.12) fit the cell
    const r = clamp(Math.min((city.h / 2 - 1) / 1.12, (x1 - x0) * 0.29), 46, 170 * u);
    // the lens sits just over the lane (near the thumb); a tall cell keeps its upper part for Mito and his words
    lens = { x: (x0 + x1) / 2, y: Math.max(city.y + city.h / 2, lane.y - 16 - r * 1.12), r };
    const colW = lens.x - r * 1.12 - x0, colL = x0 + colW / 2, colR = x1 - colW / 2;
    const mr = Math.round(clamp(colW * 0.22, 15, 24 * u));
    // Mito's capsule is 1.7 r to each side of him: never cut by the edge
    mito = { x: x0 + m + mr * 1.8, y: city.y + mr + 8, r: mr };
    const bx = mito.x + mr * 1.5;
    bubble = { x: bx, y: city.y + 3, maxW: Math.min(x1 - m - bx, 320 * u), side: 'right', anchor: 'top' };
    const lr = Math.round(clamp(colW * 0.2, 13, 26 * u));
    lysos = [
      { x: colL, y: city.y + city.h - lr - 6, r: lr },
      { x: colR, y: city.y + city.h - lr - 6, r: lr },
      { x: colR, y: city.y + lr + 10, r: lr },
    ];
    const midY = city.y + city.h * 0.56;
    spots = [{ x: colL, y: midY }, { x: colL + colW * 0.1, y: midY - city.h * 0.13 }, { x: colR, y: midY }, { x: colR - colW * 0.1, y: midY - city.h * 0.13 }];
    card = { x: x0 + 12, y: top + 8, w: x1 - x0 - 24, h: bottom - top - 16 };
    const tw = Math.min(x1 - x0 - 24, 380 * u);
    toast = { x: (x0 + x1) / 2 - tw / 2, y: city.y + 4, w: tw, h: Math.round(64 * u) };
  } else if (mode === 'short') {
    chipStyle = 'line';
    const m = 10;
    const nw = Math.min(x1 - x0 - 2 * m, 560);
    now = { x: (x0 + x1) / 2 - nw / 2, y: top + 3, w: nw, h: 28 };
    const laneH = Math.round(clamp(band.h * 0.24, 64, 90));
    lane = { x: x0 + m, y: bottom - 6 - laneH, w: x1 - x0 - 2 * m, h: laneH };
    const cTop = now.y + now.h + 4;
    city = { x: x0, y: cTop, w: x1 - x0, h: Math.max(60, lane.y - 4 - cTop) };
    // the goal stacked on the right: its sentence on two lines, the three bars under it
    const gw = Math.round(clamp((x1 - x0) * 0.25, 140, 200)), gx = x1 - m - gw;
    const chipH = 32;
    const stackH = 34 + 4 + 3 * chipH + 2 * gap;
    const gy = city.y + Math.max(0, (city.h - stackH) / 2);
    goalTitle = { x: gx, y: gy, w: gw, h: 34 };
    chips = [0, 1, 2].map(i => ({ x: gx, y: gy + 38 + i * (chipH + gap), w: gw, h: chipH })) as [Rect, Rect, Rect];
    goal = { x: gx, y: gy, w: gw, h: stackH };
    const r = clamp((city.h / 2 - 2) / 1.12, 42, 120);
    const lx = x0 + (gx - x0) * 0.52;
    lens = { x: lx, y: city.y + city.h / 2, r };
    const colLw = lens.x - r * 1.12 - x0, colRw = gx - (lens.x + r * 1.12);
    const colL = x0 + colLw / 2, colR = lens.x + r * 1.12 + colRw / 2;
    const mr = Math.round(clamp(colLw * 0.17, 14, 22));
    mito = { x: Math.max(x0 + m + mr * 1.8, colL - colLw * 0.18), y: city.y + mr + 6, r: mr };
    const bx = mito.x + mr * 1.5;
    bubble = { x: bx, y: city.y + 2, maxW: Math.min(320, gx - 8 - bx), side: 'right', anchor: 'top' };
    const lr = Math.round(clamp(Math.min(colLw, Math.max(colRw, colLw * 0.6)) * 0.2, 12, 20));
    lysos = [
      { x: colL, y: city.y + city.h - lr - 4, r: lr },
      { x: colR, y: city.y + city.h - lr - 4, r: lr },
      { x: colL + colLw * 0.28, y: city.y + city.h - lr * 3.4, r: lr },
    ];
    const midY = city.y + city.h * 0.56;
    spots = [{ x: colL, y: midY }, { x: colL - colLw * 0.12, y: midY - city.h * 0.12 }, { x: colR, y: midY }, { x: colR, y: midY - city.h * 0.14 }];
    const cw = Math.min(x1 - x0 - 24, 640);
    card = { x: (x0 + x1) / 2 - cw / 2, y: top + 6, w: cw, h: bottom - top - 12 };
    const tw = Math.min(gx - 12 - x0 - 12, 360);
    toast = { x: Math.max(x0 + 12, lens.x - tw / 2), y: city.y + 2, w: tw, h: 58 };
  } else {
    // a desktop or a tablet on its side: the lens as big as the height allows, the goal a panel on the right
    chipStyle = 'bar';
    const m = Math.round(16 * u);
    const nw = Math.min(620 * u, x1 - x0 - 2 * m);
    now = { x: (x0 + x1) / 2 - nw / 2, y: top + 6, w: nw, h: Math.round(34 * u) };
    const laneW = Math.min(x1 - x0 - 64, 940 * u), laneH = Math.round(clamp(band.h * 0.2, 90, 130 * u));
    lane = { x: (x0 + x1) / 2 - laneW / 2, y: bottom - Math.round(12 * u) - laneH, w: laneW, h: laneH };
    const cTop = now.y + now.h + 8;
    city = { x: x0, y: cTop, w: x1 - x0, h: Math.max(80, lane.y - 10 - cTop) };
    // a desk lets the lens take more of the width (the side columns keep room for the goal and Mito)
    const r = clamp(Math.min((city.h / 2 - 4) / 1.12, (x1 - x0) * (desk ? 0.22 : 0.17)), 60, (desk ? 260 : 190) * u);
    lens = { x: (x0 + x1) / 2, y: city.y + city.h / 2, r };
    const side = (x1 - x0) / 2 - r * 1.12;
    const lc = x0 + side / 2, rc = lens.x + r * 1.12 + side / 2;
    // the goal panel: its sentence (two lines), three bars, what a division brings
    const gw = Math.min(300 * u, side - 24), gx = rc - gw / 2;
    const chipH = Math.round(40 * u), tH = Math.round(36 * u), oH = Math.round(26 * u);
    const gy = city.y + 4;
    goalTitle = { x: gx, y: gy, w: gw, h: tH };
    chips = [0, 1, 2].map(i => ({ x: gx, y: gy + tH + 4 + i * (chipH + gap), w: gw, h: chipH })) as [Rect, Rect, Rect];
    const cEnd = chips[2].y + chips[2].h;
    outcome = { x: gx, y: cEnd + gap, w: gw, h: oH };
    goal = { x: gx, y: gy, w: gw, h: outcome.y + oH - gy };
    const ly = goal.y + goal.h + Math.round(14 * u), lh = Math.round(26 * u);
    lyric = ly + lh <= lane.y - 8 ? { x: gx, y: ly, w: gw, h: lh } : null;
    // the left column: the clean-up along its foot (three lysosomes in a row, the worn parts' spots over them),
    // Mito above it with his words over him (the column's whole width, up to the HUD)
    const lr = Math.round(24 * u);
    const rowY = city.y + city.h - lr - 10;
    lysos = [
      { x: lc - side * 0.27, y: rowY, r: lr },
      { x: lc + side * 0.27, y: rowY, r: lr },
      { x: lc, y: rowY, r: lr },
    ];
    const sy = rowY - lr * 2.7;
    spots = [
      { x: lc - side * 0.34, y: sy }, { x: lc - side * 0.14, y: sy - lr * 0.8 },
      { x: lc + side * 0.34, y: sy }, { x: lc + side * 0.14, y: sy - lr * 0.8 },
    ];
    const mr = Math.round(24 * u);
    const partTop = sy - lr * 0.8 - Math.max(14, mr * 1.05) * 1.4;
    mito = { x: x0 + m + mr * 1.8, y: Math.max(city.y + mr + 8, Math.min(city.y + city.h * 0.34, partTop - mr - 8)), r: mr };
    const bx = x0 + m;
    bubble = { x: bx, y: mito.y - mr - 8, maxW: Math.max(140, Math.min(420 * u, lens.x - r * 1.12 - 12 - bx)), side: 'right', anchor: 'bottom' };
    const cw = Math.min(x1 - x0 - 48, 560 * u), ch = Math.min(bottom - top - 24, 420 * u);
    card = { x: (x0 + x1) / 2 - cw / 2, y: top + (bottom - top - ch) / 2, w: cw, h: ch };
    // a desk's toast holds a Wiedza card whole: its title and number, its sentence and its source
    const tw = Math.min(x1 - x0 - 48, (desk ? 560 : 420) * u, 2 * (gx - 12 - lens.x));
    toast = { x: (x0 + x1) / 2 - tw / 2, y: city.y + 4, w: tw, h: Math.round((desk ? 118 : 66) * u) };
  }
  // a desk's mouse finds the turbine in the square inside the lens (a tap there sends a crew, like anywhere)
  const side = Math.max(MIN_TAP, lens.r * 1.36);
  const lensHit: Rect = { x: lens.x - side / 2, y: lens.y - side / 2, w: side, h: side };
  const mitoHit = target('mito', { x: mito.x - mito.r * 1.7, y: mito.y - mito.r, w: mito.r * 3.4, h: mito.r * 2 });
  // extra mitochondria cluster around the lens, half behind its rim
  const extras: Circle[] = [215, 325, 145].map(deg => {
    const a = (deg * Math.PI) / 180;
    return { x: lens.x + Math.cos(a) * (lens.r + 4), y: lens.y + Math.sin(a) * (lens.r + 4), r: Math.max(12, lens.r * 0.2) };
  });
  const pad = Math.max(10, lane.w * 0.03);
  const ux0 = lane.x + pad, ux1 = lane.x + lane.w - pad;
  const nucleus: Circle = { x: lane.x + lane.w * 0.12, y: lane.y + lane.h * 0.2, r: Math.max(90, W * 0.36) };
  return {
    w: W, h: H, mode, desk, u, ins, top, band, now, goal, goalTitle, chips, chipStyle, outcome, lyric, city, lens, lensHit, lane,
    laneMid: lane.y + lane.h * 0.54, amp: lane.h * 0.27, ux0, ux1, mito, mitoHit: { x: mitoHit.x, y: mitoHit.y, w: mitoHit.w, h: mitoHit.h },
    bubble, spots, lysos, extras, nucleus, card, toast, fs,
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

/** The goal's need under a point (a desk's hover), or -1. */
export const chipAt = (L: Layout, x: number, y: number): number => L.chips.findIndex(c => inRect(c, x, y));

/** The controls the player can tap now: the story card alone while it is up; else Mito (what to do now). */
export function tapTargets(L: Layout, o: { card: boolean; started: boolean }): TapTarget[] {
  if (!o.started) return [];
  if (o.card) return [target('story card: tap to begin', L.card)];
  return [target('mito', L.mitoHit)];
}
