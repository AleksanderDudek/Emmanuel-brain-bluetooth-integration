/**
 * Where everything of Stop-klatka stands on the canvas (DESIGN.md §28), at every size of kit/mobile `CHECK_SIZES`.
 *
 * Two arrangements:
 *
 *   upright   (a phone held upright, a tablet upright) the picture fills the canvas; the person facing the player is
 *             framed in the band's upper part, the speech bubble over them, the narration's caption at the foot.  In the
 *             freeze the steps' line and the urge stand at the top with the ring of clarity at the right, the step's
 *             content (the feelings, the second look, the two ways) at the foot — the picture between them shows the
 *             player from aside and the other person.
 *   side      (a phone on its side, a desk, a big screen) the picture fills the canvas, framed in its left part; a column
 *             on the right holds the caption, and in the freeze the steps, the ring and the content.
 *
 * Text is never under 13 px; every control is at least 44 px (MIN_TAP) and inside the insets.
 */
import { MIN_READ, MIN_TAP, TAP_GAP, uiScale, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';

export type { Rect };

export interface Layout {
  w: number;
  h: number;
  k: number;
  touch: boolean;
  mode: 'upright' | 'side';
  /** the safe band: under the HUD, inside the insets */
  band: Rect;
  /** where the picture's subject is framed (above the caption; left of the column) */
  view: Rect;
  /** the person facing the player through the eyes: their head's centre and radius */
  frame: { cx: number; headY: number; R: number };
  /** the observer's view: where the other person's head and the player's own head stand */
  out: { otherX: number; otherY: number; selfX: number; selfY: number };
  /** the caption's box at its largest (the text sits at its foot) */
  caption: Rect;
  /** the column on a wide screen (side), or the band (upright) */
  column: Rect;
  /** the freeze: the steps' line, the trigger/urge text, the ring of clarity, the step's content */
  steps: Rect;
  text: Rect;
  ring: { cx: number; cy: number; r: number };
  content: Rect;
  /** the cards of the opening and the close, the lesson's card */
  card: Rect;
  font: number;
  /** the height of a chip or a button */
  tapH: number;
  gap: number;
}

export function layout(w: number, h: number, ins: Insets, touch: boolean): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const k = uiScale(W, H);
  const pad = Math.round(12 * Math.min(k, 1.6));
  const band: Rect = { x: ins.left + pad, y: ins.top + Math.round(6 * k), w: Math.max(1, W - ins.left - ins.right - 2 * pad), h: Math.max(1, H - ins.top - ins.bottom - Math.round(6 * k) - Math.round(10 * Math.min(k, 1.4))) };
  const font = Math.max(MIN_READ + 2, Math.round(15.5 * Math.min(k, 1.6)));
  const tapH = Math.max(MIN_TAP, Math.round(46 * Math.min(k, 1.4)));
  const gap = Math.max(TAP_GAP + 2, Math.round(8 * k));
  const upright = H >= W * 0.95 || band.w < 520;
  return upright ? uprightLayout(W, H, k, touch, band, font, tapH, gap) : sideLayout(W, H, k, touch, band, font, tapH, gap);
}

function uprightLayout(W: number, H: number, k: number, touch: boolean, band: Rect, font: number, tapH: number, gap: number): Layout {
  const lh = Math.round(font * 1.38);
  // the caption: four lines of narration at most, with its padding
  const capH = Math.round(lh * 4 + 22 * Math.min(k, 1.4));
  const capW = Math.min(band.w, Math.round(560 * k));
  const caption: Rect = { x: band.x + (band.w - capW) / 2, y: band.y + band.h - capH, w: capW, h: capH };
  const view: Rect = { x: 0, y: band.y, w: W, h: Math.max(40, caption.y - band.y) };
  const R = Math.round(Math.max(16, Math.min(64, view.w * 0.1, view.h * 0.14)));
  const headY = view.y + Math.max(R * 2.6, view.h * 0.5);
  // the freeze: the steps' line, then the urge (left) beside the ring (right); the content at the foot
  const stepsH = Math.round(Math.max(26, font * 1.7));
  const steps: Rect = { x: band.x, y: band.y, w: band.w, h: stepsH };
  const r = Math.round(Math.max(26, Math.min(48, band.w * 0.075)));
  const ringD = r * 2 + Math.round(30 * Math.min(k, 1.4)) + Math.round(font * 1.4);
  // the breath guide's box is as wide as its longest word ("Zatrzymaj"): keep it inside the band
  const half = Math.max(r + 14, Math.round(58 * Math.min(k, 1.5)));
  const ring = { cx: band.x + band.w - half, cy: steps.y + stepsH + 6 + r + 8, r };
  const text: Rect = { x: band.x, y: steps.y + stepsH + 4, w: Math.max(80, ring.cx - half - 8 - band.x), h: ringD };
  const contentH = Math.min(Math.round(band.h * 0.42), Math.max(2 * tapH + gap + 30, Math.round(lh * 5 + 12)));
  const cw = Math.min(band.w, Math.round(520 * k));
  const content: Rect = { x: band.x + (band.w - cw) / 2, y: band.y + band.h - contentH, w: cw, h: contentH };
  // the observer's view: the other person in the band's middle, the player's head lower left, above the content
  const otherY = band.y + band.h * 0.5;
  const out = { otherX: band.x + band.w * 0.64, otherY, selfX: band.x + band.w * 0.22, selfY: Math.min(content.y + R * 0.2, otherY + R * 2.6) };
  const cardW = Math.min(band.w, Math.round(520 * k));
  const card: Rect = { x: band.x + (band.w - cardW) / 2, y: band.y + Math.round(band.h * 0.06), w: cardW, h: Math.round(band.h * 0.88) };
  return { w: W, h: H, k, touch, mode: 'upright', band, view, frame: { cx: W / 2, headY, R }, out, caption, column: band, steps, text, ring, content, card, font, tapH, gap };
}

function sideLayout(W: number, H: number, k: number, touch: boolean, band: Rect, font: number, tapH: number, gap: number): Layout {
  const lh = Math.round(font * 1.38);
  const colW = Math.round(Math.max(250, Math.min(band.w * 0.42, 470 * Math.min(k, 1.6))));
  const column: Rect = { x: band.x + band.w - colW, y: band.y, w: colW, h: band.h };
  const view: Rect = { x: 0, y: band.y, w: Math.max(60, column.x - 8), h: band.h };
  const R = Math.round(Math.max(16, Math.min(72, view.w * 0.085, view.h * 0.14)));
  const headY = view.y + Math.max(R * 2.4, view.h * 0.42);
  const capH = Math.min(column.h, Math.round(lh * 5 + 26 * Math.min(k, 1.4)));
  const caption: Rect = { x: column.x, y: column.y + column.h - capH, w: colW, h: capH };
  const stepsH = Math.round(Math.max(26, font * 1.7));
  const steps: Rect = { x: column.x, y: column.y, w: colW, h: stepsH };
  // the ring of clarity stands at the picture's top right, beside the column; the urge under the steps, the column wide
  const r = Math.round(Math.max(26, Math.min(52, column.h * 0.1)));
  const half = Math.max(r + 14, Math.round(58 * Math.min(k, 1.5)));
  const ring = { cx: column.x - half - 10, cy: band.y + r + 12, r };
  const text: Rect = { x: column.x, y: steps.y + stepsH + 6, w: colW, h: Math.round(font * 0.86 * 1.32 * 3 + 18) };
  const contentY = text.y + text.h + gap;
  const content: Rect = { x: column.x, y: contentY, w: colW, h: Math.max(tapH * 2 + gap, column.y + column.h - contentY) };
  const out = { otherX: view.x + view.w * 0.64, otherY: view.y + view.h * 0.42, selfX: view.x + view.w * 0.24, selfY: Math.min(view.y + view.h - R * 1.2, view.y + view.h * 0.42 + R * 2.8) };
  const cardW = Math.min(band.w, Math.round(620 * k));
  const card: Rect = { x: band.x + (band.w - cardW) / 2, y: band.y + Math.round(band.h * 0.05), w: cardW, h: Math.round(band.h * 0.9) };
  return { w: W, h: H, k, touch, mode: 'side', band, view, frame: { cx: view.x + view.w / 2, headY, R }, out, caption, column, steps, text, ring, content, card, font, tapH, gap };
}

/** The rects of `n` chips (the feelings) in the content: two a row, the last row centred. */
export function chipRects(l: Layout, n: number, top = 0): Rect[] {
  const c = l.content;
  const cols = n <= 1 ? 1 : 2;
  const cw = Math.floor((c.w - (cols - 1) * l.gap) / cols);
  const rows = Math.ceil(n / cols);
  const y0 = c.y + top + Math.max(0, (c.h - top - rows * l.tapH - (rows - 1) * l.gap) - 2);
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), col = i % cols;
    const rowW = inRow * cw + (inRow - 1) * l.gap;
    out.push({ x: c.x + (c.w - rowW) / 2 + col * (cw + l.gap), y: y0 + row * (l.tapH + l.gap), w: cw, h: l.tapH });
  }
  return out;
}

/** The rects of the two ways in the content: stacked full width at its foot, each tall enough for its words. */
export function wayRects(l: Layout, heights: readonly number[]): Rect[] {
  const c = l.content;
  const out: Rect[] = [];
  let y = c.y + c.h;
  for (let i = heights.length - 1; i >= 0; i--) {
    const h = Math.max(l.tapH, heights[i]);
    y -= h;
    out.unshift({ x: c.x, y, w: c.w, h });
    y -= l.gap;
  }
  return out;
}

/** The five age chips on the opening card: a row of five (or 3 + 2) inside `r`. */
export function ageRects(l: Layout, r: Rect): Rect[] {
  const n = 5;
  const one = Math.floor((r.w - (n - 1) * l.gap) / n);
  if (one >= 62) return Array.from({ length: n }, (_, i) => ({ x: r.x + i * (one + l.gap), y: r.y, w: one, h: l.tapH }));
  const cw = Math.floor((r.w - 2 * l.gap) / 3);
  return Array.from({ length: n }, (_, i) => {
    const row = i < 3 ? 0 : 1, col = i < 3 ? i : i - 3, inRow = row ? 2 : 3;
    const rowW = inRow * cw + (inRow - 1) * l.gap;
    return { x: r.x + (r.w - rowW) / 2 + col * (cw + l.gap), y: r.y + row * (l.tapH + l.gap), w: cw, h: l.tapH };
  });
}
