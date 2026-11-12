/**
 * Where Latarnik's play view puts things (CSS px), mobile first (DESIGN.md §3.2 and §12).  The runner's HUD
 * covers the top of the canvas (`insets().top`), a phone's home indicator or notch the other edges: the sea
 * may run under them, the game's own words and things stay inside.  A one-tap timing game has no buttons —
 * the whole screen is the button — so the layout's one job is the largest round sea that fits, the beam and
 * the boats big enough to time a tap by, with the night's few things around it.  Sizes start from a 360 px
 * phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall  (a phone upright, a tablet upright)  the night's pill right under the HUD, Zośka on her post at its
 *         left — her bubble, or a card, takes the pill's place while it shows — then the sea, as wide as the
 *         screen; the lanterns and the perfect ladder in the band's lower corners, or in a row under the sea
 *         where the band is taller than the sea.  The rest of the band is the thumb's.
 *   side  (a phone on its side)  one column on the left under the HUD's row — the lanterns and the ladder,
 *         the night's pill, the card, Zośka with her bubble — and the sea filling the height beside it
 *   wide  (a desktop, a tablet on its side)  the sea centred, rising between the HUD's panel and its score;
 *         the lanterns and the pill under the panel, the ladder and the card under the score, Zośka low on
 *         the left
 *
 * Everything is pure (tests run it at every kit/mobile CHECK_SIZES entry).
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';

export type { Rect };
export type Shape = 'tall' | 'side' | 'wide';

/**
 * The sea keeps this much of R around its centre in sight: a boat at the horizon (0.99 R, and half a boat
 * beyond it) and the reach ring at its widest (1.03 R).
 */
export const SEA_PAD = 1.07;
/** The runner's top bar on a wide screen (the time line, the clock, the buttons): the sea rises to it between the panel and the score. */
export const TOP_BAR = 64;
/** The perfect ladder's diamonds: their half-size and their pitch (× u); the hud draws them, the layout keeps their room. */
export const LADDER_R = 4.6;
export const LADDER_GAP = 12;

export interface Layout {
  w: number;
  h: number;
  shape: Shape;
  /** the night's pill sits in a row under the HUD, the sea under it (a phone or a tablet upright) */
  portrait: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** what covers each edge (the HUD band on top) */
  ins: Insets;
  /** the band the game's own things stay in: under the HUD, over the home indicator, inside a notch */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** the lamp, i.e. the sea's centre, and the sea's radius R */
  cx: number;
  cy: number;
  R: number;
  /** the island's radius and one boat's length (px) */
  s: number;
  boat: number;
  /** the night's three lanterns: their left end, their baseline and one lantern's size */
  lanterns: { x: number; y: number; s: number };
  /**
   * The perfect ladder: its right end and the line its diamonds sit on; `label` is the room for its words
   * above it (px) — where the sea leaves less than they need, a short count stands there instead.
   */
  ladder: { x: number; y: number; label: number };
  /** the night's pill: its name, its goal, the count and the three stars as they stand */
  goal: Rect;
  /** Zośka's post (its foot) and her size; the bubble's room */
  gull: { x: number; y: number; s: number; face: 1 | -1 };
  bubble: Rect;
  /** Zośka's bubble takes the pill's place while she talks (an upright phone) */
  bubbleOnGoal: boolean;
  /** the card slot (amber, the blind reveal, an upgrade) */
  card: Rect;
  /** what the card covers while it shows, stepping aside meanwhile: the pill, Zośka's bubble, or nothing */
  cardOver: 'goal' | 'bubble' | null;
}

/** The HUD's rough boxes when wide (the panel top left, the score top right), for keeping the sea clear of them. */
function hudBoxes(w: number, top: number): [number, number, number, number][] {
  return [[0, 0, Math.min(w * 0.64, 350), top], [w - Math.min(w * 0.3, 190), 0, w, top]];
}

/** Whether a circle meets a box. */
function meets(cx: number, cy: number, r: number, b: [number, number, number, number]): boolean {
  const x = clamp(cx, b[0], b[2]), y = clamp(cy, b[1], b[3]);
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

/** The leftmost x right of the sea's centre from which the band y0..y1 is clear of a circle (cx, cy, r). */
function clearRightOf(cx: number, cy: number, r: number, y0: number, y1: number): number {
  const dy = y0 > cy ? y0 - cy : y1 < cy ? cy - y1 : 0;
  return dy >= r ? -Infinity : cx + Math.sqrt(r * r - dy * dy);
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = uiScale(W, H);
  const ins: Insets = {
    top: clamp(insets.top, 0, H * 0.6), right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left),
  };
  const top = ins.top, bottom = H - ins.bottom, left = ins.left, right = W - ins.right;
  const bw = right - left, bh = bottom - top;
  const shape: Shape = W / H < 0.9 ? 'tall' : bh < 470 && W > H * 1.3 ? 'side' : 'wide';
  const ls = 12.5 * u;
  const L: Layout = {
    w: W, h: H, shape, portrait: shape === 'tall', u, ins, top, bottom, left, right,
    cx: W / 2, cy: H / 2, R: 60, s: 0, boat: 0,
    lanterns: { x: 0, y: 0, s: ls }, ladder: { x: 0, y: 0, label: 0 }, goal: { x: 0, y: 0, w: 0, h: 0 },
    gull: { x: 0, y: 0, s: 0, face: 1 }, bubble: { x: 0, y: 0, w: 0, h: 0 }, bubbleOnGoal: false, card: { x: 0, y: 0, w: 0, h: 0 }, cardOver: null,
  };
  if (shape === 'tall') tall(L, bw, ls);
  else if (shape === 'side') side(L, bw, ls);
  else wide(L, ls);
  const R = L.R;
  // a small sea gets a slightly larger island; boats never under 24 px, so their timing reads on a phone
  L.s = R * (0.13 - 0.015 * clamp((R - 180) / 120));
  L.boat = Math.max(24, R * 0.1);
  return L;
}

/**
 * An upright phone or tablet: the row under the HUD (Zośka and the night's pill), the sea as wide as the screen
 * under it, the lanterns and the ladder under the sea when the band has the room, else in its lower corners.
 */
function tall(L: Layout, bw: number, ls: number): void {
  const { u, top, bottom, left, right } = L;
  const m = Math.round(10 * u);
  const rowY = top + Math.round(6 * u), rowH = Math.round(44 * u);
  const seaTop = rowY + rowH + Math.round(4 * u);
  const deckH = Math.round(34 * u);
  const room = bottom - 2 - seaTop;
  const R = Math.max(60, Math.min((bw - 8) / 2, room / 2) / SEA_PAD);
  const keep = R * SEA_PAD;
  const surplus = room - 2 * keep;
  const below = surplus >= deckH;
  // a taller band: the sea comes down a little from the pill, the deck sits under it, the rest is the thumb's
  const lift = below ? Math.min((surplus - deckH) * 0.25, 24 * u) : 0;
  L.R = R;
  L.cx = (left + right) / 2;
  L.cy = seaTop + lift + keep;
  // the row: Zośka on her post at the left, the pill beside her; her bubble and a card take the pill's place
  const gs = Math.round(32 * u);
  L.gull = { x: left + m + gs * 0.46, y: rowY + rowH, s: gs, face: 1 };
  const gx = left + m + gs + Math.round(6 * u);
  L.goal = { x: gx, y: rowY, w: right - m - gx, h: rowH };
  L.bubble = { ...L.goal };
  L.bubbleOnGoal = true;
  L.card = { ...L.goal };
  L.cardOver = 'goal';
  const r = LADDER_R * u;
  if (below) {
    const y = L.cy + keep + Math.round(deckH * 0.62);
    L.lanterns = { x: left + m, y, s: ls };
    const ly = y - Math.round(2 * u), base = ly - r - 8 * u;
    const x0 = clearRightOf(L.cx, L.cy, keep, base - 13 * u, base + 3);
    L.ladder = { x: right - m, y: ly, label: Math.max(0, Math.floor(right - m - Math.max(x0 + 4, L.cx + 16 * u))) };
    // a band taller still: the card under the deck, clear of the pill
    const cardH = Math.round(60 * u);
    const cy0 = L.cy + keep + deckH + Math.round(8 * u);
    if (cy0 + cardH <= bottom - 6) {
      L.card = { x: left + m, y: cy0, w: bw - 2 * m, h: cardH };
      L.cardOver = null;
    }
  } else {
    // the band's lower corners, clear of the horizon's boats: the lanterns left, the ladder right
    L.lanterns = { x: left + m, y: bottom - Math.round(4 * u) - ls * 0.82, s: ls };
    const ly = bottom - Math.round(8 * u);
    const labelBase = ly - r - 8 * u;
    const x0 = clearRightOf(L.cx, L.cy, keep, labelBase - 13 * u, labelBase + 3);
    L.ladder = { x: right - m, y: ly, label: Math.max(0, Math.floor(right - m - Math.max(x0 + 4, L.cx))) };
  }
}

/**
 * A phone on its side: the sea fills the band's height on the right; the column on its left holds the
 * lanterns and the ladder, the night's pill, then the card or Zośka's bubble beside her post at the foot.
 */
function side(L: Layout, bw: number, ls: number): void {
  const { u, top, bottom, left, right } = L;
  const m = Math.round(10 * u);
  const y0 = top + Math.round(6 * u), y1 = bottom - Math.round(4 * u);
  let R = (y1 - y0) / 2 / SEA_PAD;
  // the column keeps at least 200 px (the pill's words at 13 px and more); the sea gives way first
  const colMin = 200 * u;
  R = Math.max(60, Math.min(R, (bw - colMin - 3 * m) / 2 / SEA_PAD));
  const keep = R * SEA_PAD;
  const colW = Math.min(bw - 2 * keep - 3 * m, 280 * u);
  const x0 = left + m, x1 = x0 + colW;
  L.R = R;
  L.cx = (x1 + m + right) / 2;
  L.cy = (y0 + y1) / 2;
  // the lanterns and the ladder in one row, its words over the diamonds
  const rowB = y0 + Math.round(26 * u);
  L.lanterns = { x: x0, y: rowB, s: ls };
  L.ladder = { x: x1, y: rowB - Math.round(2 * u), label: Math.round(colW - ls * 6.2) };
  const gy = rowB + Math.round(16 * u);
  L.goal = { x: x0, y: gy, w: colW, h: Math.round(48 * u) };
  // Zośka at the column's foot, her bubble beside her and up to the pill; the card above her, over the bubble
  const gs = Math.round(36 * u);
  L.gull = { x: x0 + gs * 0.46, y: y1, s: gs, face: 1 };
  const bx = x0 + gs + Math.round(6 * u);
  const by = L.goal.y + L.goal.h + Math.round(10 * u);
  L.bubble = { x: bx, y: by, w: x1 - bx, h: y1 - Math.round(4 * u) - by };
  L.card = { x: x0, y: by, w: colW, h: Math.round(60 * u) };
  L.cardOver = 'bubble';
}

/**
 * A desktop or a tablet on its side: the largest sea clear of the HUD's panel and score, centred (or a little
 * right of centre on a short screen), the columns beside it under the panel and the score.
 */
function wide(L: Layout, ls: number): void {
  const { u, top, bottom, left, right, w } = L;
  const boxes = hudBoxes(w, top);
  const barTop = Math.min(TOP_BAR, top);
  const side = clamp(w * 0.21, 160 * u, 330);
  let best = { R: 0, cx: w / 2, cy: 0 };
  for (const k of [0.5, 0.55, 0.6, 0.64]) {
    const x = left + (right - left) * k;
    let r = Math.min((bottom - barTop) / 2 / SEA_PAD + 4, Math.min(x - left - 160 * u, right - x - 16) / SEA_PAD, ((right - left) - 2 * side) / 2 + (k - 0.5) * (right - left));
    let y = barTop + (bottom - barTop) / 2;
    for (let i = 0; i < 300 && r > 60 && boxes.some(b => meets(x, y, r * SEA_PAD, b)); i++) {
      r -= 1.5;
      y = Math.min(y + 1, bottom - r * SEA_PAD);
    }
    if (r > best.R * 1.08) best = { R: r, cx: x, cy: y };
  }
  L.R = Math.max(60, best.R);
  L.cx = best.cx;
  L.cy = best.cy;
  const cx = L.cx, keep = L.R * SEA_PAD;
  const m = 18;
  const leftW = Math.max(150, Math.min(cx - keep - left - 30, 300 * u));
  const rightW = Math.max(150, Math.min(right - (cx + keep) - 30, 290 * u));
  L.lanterns = { x: left + m, y: top + 26 * u, s: ls };
  L.goal = { x: left + m, y: top + 44 * u, w: leftW, h: Math.round(56 * u) };
  L.ladder = { x: right - m, y: top + 26 * u, label: rightW };
  L.card = { x: right - m - rightW, y: top + 50 * u, w: rightW, h: Math.round(66 * u) };
  L.cardOver = null;
  const gs = Math.round(54 * u);
  L.gull = { x: left + m + gs * 0.42, y: bottom - 6, s: gs, face: 1 };
  const by = L.goal.y + L.goal.h + 12 * u;
  L.bubble = { x: left + m, y: by, w: leftW, h: L.gull.y - gs * 1.4 - by };
  if (L.bubble.h < 40 * u) {
    // a short screen: no room for her post; she speaks over the pill instead
    L.gull.s = 0;
    L.bubble = { x: L.goal.x, y: L.goal.y, w: L.goal.w, h: L.goal.h };
    L.bubbleOnGoal = true;
  }
}

/** The first session's opening card (the story and the root verse): centred in the band, as tall as it allows. */
export function openCardRect(L: Layout): Rect {
  const cw = Math.min(L.right - L.left - 24, 440 * L.u);
  const top = L.top + 6, bottom = L.bottom - 6;
  const ch = Math.min(bottom - top, 440 * L.u);
  return { x: (L.left + L.right) / 2 - cw / 2, y: top + (bottom - top - ch) / 2, w: cw, h: ch };
}
