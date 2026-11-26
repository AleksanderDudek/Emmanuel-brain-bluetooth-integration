/**
 * Where everything of Złota passa stands on the canvas (DESIGN.md §26, builder B), at every size of kit/mobile
 * `CHECK_SIZES`.  The signature is the contract: builder A hit-tests the choices with `choiceRects(l, n)` (the n slots
 * in use; `choices` = the four), lists them in `targets()`, places its story and verse cards in `story` and the
 * runner's breath pacer at `pacer`.
 *
 * Two arrangements:
 *
 *   upright   (a phone held upright, a tablet upright, a narrow window) the street across the upper part of the band
 *             under the HUD; the moment's card up close in the middle; the choices a column of full-width buttons
 *             at the foot (the thumb zone), bottom-aligned, the card just above them.  While no choices are open the
 *             card sits lower (`cardFree`), the narrator's line under it and the breath pacer at the foot — so the
 *             street and its garland stay in sight above (the light flies up into it).
 *   side      (a phone on its side, a desk, a big screen) the street wide over the whole canvas; the card in the
 *             lower part, left of centre, the choices in a column beside it (the thumb's side, the mouse's — §14.3);
 *             the pacer and the narrator in that column while no choices are open.
 *
 * The street's camera (`street`) is framed so the street's end, the church tower and the garland's first spans stand
 * in the strip above the card.  Text is never under 13 px; each choice is at least 50 px tall.
 */
import { MIN_READ, MIN_TAP, TAP_GAP, uiScale } from '../kit/mobile';
import type { Insets } from '../kit/types';
import type { Rect } from './view';

/** The street's camera on the canvas: the vanishing point's x, the horizon's y, the focal length (px per m at 1 m). */
export interface StreetCam { cx: number; hy: number; f: number }

export interface Layout {
  w: number;
  h: number;
  /** the street's picture (below the runner's HUD) and the moment's card held up close */
  scene: Rect;
  card: Rect;
  /** up to four choice slots in the thumb zone (each ≥ MIN_TAP; fewer choices: `choiceRects(l, n)`) */
  choices: Rect[];
  /** the narrator's line, the banner, A's story/verse card place, the breath pacer's place */
  say: Rect;
  banner: Rect;
  story: Rect;
  pacer: { x: number; y: number; ring?: boolean } | null;
  font: number;
  wide: boolean;
  /** (B) which arrangement, the UI scale, a finger or a mouse */
  mode?: 'upright' | 'side';
  k?: number;
  touch?: boolean;
  /** (B) the safe band: under the HUD, inside the insets */
  band?: Rect;
  /** (B) the card's place while no choices are open (lower on an upright phone: the street in sight above it) */
  cardFree?: Rect;
  /** (B) the pocket (a small bag at the card zone's corner) where a card that did not turn goes */
  pocket?: { x: number; y: number; r: number };
  /** (B) the street's camera */
  street?: StreetCam;
}

/** The smallest choice height: a label in two lines at 15 px. */
export const CHOICE_H = 50;
/** The runner's pacer pill (kit/pacerspot: 210 × 70; 240 × 80 on a big screen) and the ring alone. */
const PILL_W = 210, PILL_H = 70, RING_D = 72;

export function layout(w: number, h: number, ins: Insets, touch: boolean): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const k = uiScale(W, H);
  const upright = H >= W * 0.95;
  return upright ? uprightLayout(W, H, ins, k, touch) : sideLayout(W, H, ins, k, touch);
}

/**
 * The slots of `n` choices (1–4): on an upright screen bottom-aligned in the thumb zone (the first on top), beside the
 * card centred on its middle (clamped to the band) on a wide one.
 */
export function choiceRects(l: Layout, n: number): Rect[] {
  const all = l.choices;
  const m = Math.max(0, Math.min(all.length, Math.round(n) || 0));
  if (!m) return [];
  if (l.mode === 'side') {
    const ch = all[0].h, gap = all.length > 1 ? all[1].y - all[0].y - ch : 8;
    const total = m * ch + (m - 1) * gap;
    const band = l.band ?? { x: 0, y: 0, w: l.w, h: l.h };
    const mid = l.card.y + l.card.h / 2;
    const y0 = Math.max(band.y, Math.min(band.y + band.h - total, mid - total / 2));
    return Array.from({ length: m }, (_, i) => ({ x: all[0].x, y: y0 + i * (ch + gap), w: all[0].w, h: ch }));
  }
  // upright: the last m slots of the four (the column grows upward from the foot)
  return all.slice(all.length - m);
}

/** The card's place for `n` open choices: just above them on an upright screen, `card` on a wide one. */
export function cardFor(l: Layout, n: number): Rect {
  if (n <= 0) return l.cardFree ?? l.card;
  if (l.mode === 'side') return l.card;
  const r = choiceRects(l, n);
  const gap = Math.max(8, Math.round(8 * (l.k ?? 1)));
  const top = r[0].y - gap - l.card.h;
  return { ...l.card, y: Math.max(l.card.y, top) };
}

interface Band { x0: number; x1: number; y0: number; y1: number; pad: number; gap: number }

function bandOf(W: number, H: number, ins: Insets, k: number): Band {
  const pad = Math.round(12 * Math.min(k, 1.6));
  return {
    x0: ins.left + pad, x1: W - ins.right - pad,
    y0: ins.top + Math.round(6 * k), y1: H - ins.bottom - Math.round(10 * Math.min(k, 1.4)),
    pad, gap: Math.max(TAP_GAP + 2, Math.round(8 * k)),
  };
}

function fontOf(k: number): number {
  return Math.max(MIN_READ + 2, Math.round(15 * k));
}

function uprightLayout(W: number, H: number, ins: Insets, k: number, touch: boolean): Layout {
  const B = bandOf(W, H, ins, k);
  const font = fontOf(k);
  const ch = Math.max(CHOICE_H, Math.round(52 * k));
  // the choices: a column at the foot, at most 480 × k wide, centred
  const cw = Math.min(B.x1 - B.x0, Math.round(480 * k));
  const cx = (B.x0 + B.x1) / 2;
  const choices = [0, 1, 2, 3].map(i => ({ x: cx - cw / 2, y: B.y1 - (4 - i) * ch - (3 - i) * B.gap, w: cw, h: ch }));
  // the card: as wide as the column (a little wider on a phone), 0.52 as tall, never taller than the room over four choices
  const cardW = Math.min(B.x1 - B.x0, Math.round(470 * k));
  const room4 = choices[0].y - B.gap - B.y0;
  const cardH = Math.round(Math.max(96, Math.min(cardW * 0.52, room4, 270 * k)));
  const card = { x: cx - cardW / 2, y: Math.max(B.y0, choices[0].y - B.gap - cardH), w: cardW, h: cardH };
  // no choices open: the pacer (or the narrator) at the foot, the narrator's line over it, the card over that
  const big = k >= 1.35;
  const pillH = big ? 80 : PILL_H;
  const sayH = Math.round(font * 1.4 * 2 + 18);
  const short = B.y1 - B.y0 < 420;
  const pacerTop = B.y1 - pillH;
  const sayY = pacerTop - B.gap - sayH;
  let freeY = sayY - B.gap - cardH;
  // a short band (a small phone): the street needs a strip over the card — the ring alone beside the narrator then
  let pacer: Layout['pacer'] = { x: cx, y: pacerTop };
  let say = { x: cx - cw / 2, y: sayY, w: cw, h: sayH };
  if (short) {
    const ringY = B.y1 - RING_D;
    pacer = { x: B.x0 + RING_D / 2, y: ringY, ring: true };
    say = { x: B.x0 + RING_D + B.gap, y: B.y1 - Math.max(RING_D, sayH), w: B.x1 - B.x0 - RING_D - B.gap, h: Math.max(RING_D, sayH) };
    freeY = say.y - B.gap - cardH;
  }
  freeY = Math.max(card.y, freeY);
  const cardFree = { ...card, y: freeY };
  // the street's strip over the free card: the horizon a little above the card's top
  const strip = Math.max(40, cardFree.y - B.y0);
  const hy = cardFree.y - Math.round(strip * 0.1);
  const f = Math.max(120, Math.min(2.3 * (hy - B.y0), 1.5 * (W / 2), 1.2 * H));
  const street = { cx: W / 2 + W * 0.02, hy, f };
  // A's story and verse cards: where the card sits free and the narrator under it
  const story = { x: B.x0, y: cardFree.y, w: B.x1 - B.x0, h: Math.max(80, (short ? say.y + say.h : sayY + sayH) - cardFree.y) };
  // the banner over the street's strip
  const banner = { x: B.x0, y: B.y0 + Math.max(8, strip * 0.18), w: B.x1 - B.x0, h: Math.round(Math.min(strip * 0.5, 78 * k)) };
  const r = Math.round(Math.max(22, 24 * Math.min(k, 1.4)));
  const pocket = { x: B.x0 + r + 2, y: cardFree.y - r - B.gap, r };
  return {
    w: W, h: H, scene: { x: 0, y: B.y0, w: W, h: Math.max(1, hy - B.y0 + strip * 0.1) }, card, choices, say, banner, story, pacer, font,
    wide: W > H, mode: 'upright', k, touch, band: { x: B.x0, y: B.y0, w: B.x1 - B.x0, h: B.y1 - B.y0 }, cardFree, pocket, street,
  };
}

function sideLayout(W: number, H: number, ins: Insets, k: number, touch: boolean): Layout {
  const B = bandOf(W, H, ins, k);
  const font = fontOf(k);
  const bw = B.x1 - B.x0, bh = B.y1 - B.y0;
  const big = k >= 1.35;
  // the choices' column beside the card: at least the pacer's pill wide
  const colW = Math.round(Math.max(PILL_W + 12, Math.min(bw * 0.36, 400 * k)));
  const ch = Math.max(CHOICE_H, Math.round(52 * Math.min(k, 1.5)));
  // the card: half the band's width at most, 0.56 as tall, at most 46 % of the band's height (the street above it)
  let cardW = Math.min(bw - colW - B.gap * 3, Math.round(560 * k));
  let cardH = Math.round(cardW * 0.56);
  const maxH = Math.round(bh * (bh < 340 ? 0.58 : 0.46));
  if (cardH > maxH) { cardH = maxH; cardW = Math.min(cardW, Math.round(cardH / 0.5)); }
  const groupW = cardW + B.gap * 2 + colW;
  const gx = Math.max(B.x0, (B.x0 + B.x1) / 2 - groupW / 2);
  const bottomGap = Math.round(bh * (bh > 700 ? 0.07 : 0.02));
  const card = { x: gx, y: B.y1 - bottomGap - cardH, w: cardW, h: cardH };
  const colX = gx + cardW + B.gap * 2;
  // four slots stacked in the column, bottom-aligned (choiceRects centres fewer on the card's middle)
  const total = 4 * ch + 3 * B.gap;
  const top4 = Math.max(B.y0, Math.min(B.y1 - total, card.y + card.h / 2 - total / 2));
  const choices = [0, 1, 2, 3].map(i => ({ x: colX, y: top4 + i * (ch + B.gap), w: colW, h: ch }));
  // the column while no choices are open: the pacer at the card's top line, the narrator under it
  const pillW = big ? 240 : PILL_W, pillH = big ? 80 : PILL_H;
  const ringy = colW < pillW + 4;
  const pacerY = Math.max(B.y0, card.y);
  const pacer = ringy ? { x: colX + RING_D / 2, y: pacerY, ring: true } : { x: colX + colW / 2, y: pacerY };
  const sayY = pacerY + (ringy ? RING_D : pillH) + B.gap;
  const say = { x: colX, y: sayY, w: colW, h: Math.max(MIN_TAP, B.y1 - sayY) };
  // the street: the strip over the card, the vanishing point over the band's middle
  const strip = Math.max(40, card.y - B.y0);
  const hy = card.y - Math.round(strip * 0.08);
  const f = Math.max(140, Math.min(2.4 * (hy - B.y0), 0.62 * W, 1.6 * H));
  const street = { cx: W / 2, hy, f };
  const story = { x: gx, y: card.y, w: cardW, h: cardH };
  const banner = { x: B.x0, y: B.y0 + Math.max(6, strip * 0.16), w: bw, h: Math.round(Math.min(strip * 0.5, 84 * k)) };
  const r = Math.round(Math.max(22, 24 * Math.min(k, 1.6)));
  const pocket = { x: card.x + r + 2, y: card.y - r - B.gap, r };
  return {
    w: W, h: H, scene: { x: 0, y: B.y0, w: W, h: Math.max(1, hy - B.y0 + strip * 0.1) }, card, choices, say, banner, story, pacer, font,
    wide: true, mode: 'side', k, touch, band: { x: B.x0, y: B.y0, w: bw, h: bh }, cardFree: card, pocket, street,
  };
}
