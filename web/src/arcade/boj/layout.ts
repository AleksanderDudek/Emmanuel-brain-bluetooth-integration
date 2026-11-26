/**
 * Where everything of Dobry bój stands on the canvas (DESIGN.md §25, builder B), for every size of kit/mobile
 * `CHECK_SIZES` — phone upright first, on its side, tablet, desk, big screens.  The signature is the contract: the
 * fight (builder A) hit-tests the options with `options` and lists them in `targets()`.
 *
 * Two arrangements, and the one that keeps the fighters larger wins:
 *
 *   under   the bars under the runner's HUD band, the ring across the middle, the "why" line on the ring's front floor,
 *           the three options in a row at the bottom inside the insets (the thumb zone); the coach speaks from the
 *           same bottom band while no options are open (A: the coach is silent in the slow motion)
 *   column  the bars over the ring, the ring at the left, a column at the right: the "why" line at its top, the options
 *           stacked at its foot (a phone on its side: the thumb's side; a desk: the mouse's, beside the play — §14.3);
 *           the coach speaks in the column while no options are open
 *
 * An upright phone always takes `under`.  Text is never under 13 px; the options are at least 56 px tall.
 */
import { MIN_READ, MIN_TAP, TAP_GAP, uiScale } from '../kit/mobile';
import type { Insets } from '../kit/types';
import type { Rect } from './view';

export interface Layout {
  w: number;
  h: number;
  /** the ring's floor band where the two fighters stand (below the runner's HUD) */
  ring: Rect;
  /** the two health bars with their lives and names */
  bars: { player: Rect; foe: Rect };
  /** three slots for the slow motion's options, in the thumb zone (each ≥ MIN_TAP; fewer options use the first ones) */
  options: Rect[];
  /** the coach's bubble, the "why" line, the big banner, the referee's count */
  coach: Rect;
  why: Rect;
  banner: Rect;
  count: Rect;
  /** the base font size (CSS px) and whether the screen is wide (side / desk) */
  font: number;
  wide: boolean;
  /** the box the two fighters are framed in (inside `ring`: above the "why" line in `under`) */
  stage?: Rect;
  /** which arrangement (see the file's header) */
  mode?: 'under' | 'column';
  /** the UI scale (1 on a phone, up to 2.2 on a big screen) */
  k?: number;
  /** where the runner's breath pacer stands in the read and the corner (the pill's top centre; ring: the ring alone) */
  pacer?: { x: number; y: number; ring?: boolean };
  /** where builder A's hud draws the story card and the verse cards (the ring's upper middle) */
  card?: Rect;
  /** the read's calm framing: the fighters stand below this y so the pacer's pill clears their heads (under) */
  readTop?: number;
}

/** The smallest option height (a primary control in the thumb zone). */
export const OPTION_H = 56;
/** The runner's pacer pill (kit/pacerspot: 210 × 70; 240 × 80 on a big screen). */
const PILL_W = 210, PILL_H = 70, RING_D = 66;

/** How large the fighters can be drawn in a stage (px per unit of a standing height). */
export function fighterScale(stage: Rect): number {
  return Math.max(40, Math.min(stage.h / 1.06, stage.w / 1.8));
}

export function layout(w: number, h: number, ins: Insets, touch: boolean): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const k = uiScale(W, H);
  const upright = H >= W * 0.95;
  const a = under(W, H, ins, k);
  if (upright && touch) return a;
  const b = column(W, H, ins, k);
  if (!b) return a;
  return fighterScale(b.stage!) > fighterScale(a.stage!) * 1.04 ? b : a;
}

interface Box { x0: number; x1: number; y0: number; y1: number; pad: number; gap: number }

function box(W: number, H: number, ins: Insets, k: number): Box {
  const pad = Math.round(10 * Math.min(k, 1.6));
  return {
    x0: ins.left + pad, x1: W - ins.right - pad,
    y0: ins.top + Math.round(6 * k), y1: H - ins.bottom - pad,
    pad, gap: Math.max(TAP_GAP + 2, Math.round(8 * k)),
  };
}

/** The two bars side by side over a width, at most 780 × k wide in all. */
function barsAt(x0: number, x1: number, y: number, k: number): { player: Rect; foe: Rect; h: number } {
  const total = Math.min(x1 - x0, 780 * k);
  const cx = (x0 + x1) / 2;
  const gap = Math.round(14 * k);
  const bw = (total - gap) / 2;
  const bh = Math.round(42 * k);
  return { player: { x: cx - total / 2, y, w: bw, h: bh }, foe: { x: cx + gap / 2, y, w: bw, h: bh }, h: bh };
}

function under(W: number, H: number, ins: Insets, k: number): Layout {
  const B = box(W, H, ins, k);
  const bars = barsAt(B.x0, B.x1, B.y0, k);
  // the options: tall enough for the label and a sub-line in two short lines (a narrow phone's buttons are ~105 wide)
  const oh = Math.round((OPTION_H + 18) * Math.min(k, 1.15));
  // the options: a row, at most 3 × 300 × k wide, centred, at the foot of the safe area
  const rowW = Math.min(B.x1 - B.x0, 920 * k);
  const ow = (rowW - 2 * B.gap) / 3;
  const ox = (B.x0 + B.x1) / 2 - rowW / 2;
  const oy = B.y1 - oh;
  const options = [0, 1, 2].map(i => ({ x: ox + i * (ow + B.gap), y: oy, w: ow, h: oh }));
  // the why line: two lines over the options, on the ring's front floor
  const font = Math.max(MIN_READ + 2, Math.round(15 * k));
  const whyH = Math.round(font * 2.6 + 6);
  const why = { x: ox, y: oy - B.gap - whyH, w: rowW, h: whyH };
  const ringTop = B.y0 + bars.h + Math.round(6 * k);
  const ring = { x: 0, y: ringTop, w: W, h: Math.max(60, oy - ringTop) };
  const stage = { x: B.x0, y: ringTop + 4, w: B.x1 - B.x0, h: Math.max(60, why.y - ringTop - 8) };
  // the coach: the bottom band (the options' and the why's place while no options are open)
  const cw = Math.min(B.x1 - B.x0, 640 * k);
  let coach = { x: (B.x0 + B.x1) / 2 - cw / 2, y: why.y, w: cw, h: B.y1 - why.y };
  const cx = W / 2;
  const banner = { x: B.x0, y: stage.y + stage.h * 0.18, w: B.x1 - B.x0, h: Math.round(64 * k) };
  const cs = Math.round(Math.min(110 * k, stage.h * 0.4));
  const count = { x: cx - cs / 2, y: stage.y + Math.round(4 * k), w: cs, h: cs };
  const cardW = Math.min(B.x1 - B.x0, 560 * k);
  const card = { x: cx - cardW / 2, y: stage.y + 2, w: cardW, h: Math.round(Math.min(stage.h * 0.55, 200 * k)) };
  // the read's pill at the stage's top centre, the fighters framed below it — on a short stage (a small phone) that
  // would shrink them to a third: the ring alone at the bottom band's left, the coach's bubble beside it
  const pillH = k >= 1.35 ? 80 : PILL_H;
  let pacer: Layout['pacer'] = { x: cx, y: stage.y + 2 };
  let readTop = stage.y + pillH + 6;
  if (stage.h < 330) {
    const bandH = B.y1 - why.y;
    pacer = { x: B.x0 + RING_D / 2, y: why.y + Math.max(0, (bandH - RING_D) / 2), ring: true };
    const cx0 = B.x0 + RING_D + B.gap;
    coach = { x: cx0, y: why.y, w: B.x1 - cx0, h: bandH };
    readTop = stage.y;
  }
  return {
    w: W, h: H, ring, bars: { player: bars.player, foe: bars.foe }, options, coach, why, banner, count,
    font, wide: W > H, stage, mode: 'under', k, pacer, card, readTop,
  };
}

function column(W: number, H: number, ins: Insets, k: number): Layout | null {
  const B = box(W, H, ins, k);
  const colW = Math.round(Math.min(Math.max(PILL_W + 8, 216 * Math.min(k, 1.5)), (B.x1 - B.x0) * 0.4));
  if (colW < 180) return null;
  const colX = B.x1 - colW;
  const ringX1 = colX - B.gap;
  const bars = barsAt(B.x0, ringX1, B.y0, k);
  const ringTop = B.y0 + bars.h + Math.round(6 * k);
  const oh = Math.round(Math.max(OPTION_H, OPTION_H * Math.min(k, 1.5)));
  const colTop = B.y0;
  const optsH = 3 * oh + 2 * B.gap;
  if (B.y1 - colTop < optsH + 40) return null;
  const options = [0, 1, 2].map(i => ({ x: colX, y: B.y1 - optsH + i * (oh + B.gap), w: colW, h: oh }));
  const font = Math.max(MIN_READ + 2, Math.round(15 * k));
  const why = { x: colX, y: colTop, w: colW, h: Math.max(MIN_TAP, options[0].y - B.gap - colTop) };
  // the coach under the breath's pill (both show in a read)
  const pillH0 = k >= 1.35 ? 80 : PILL_H;
  const coachY = colTop + pillH0 + B.gap;
  const coach = { x: colX, y: coachY, w: colW, h: Math.max(MIN_TAP, B.y1 - coachY) };
  const ring = { x: 0, y: ringTop, w: ringX1 + B.pad, h: Math.max(60, H - ins.bottom - ringTop) };
  const stage = { x: B.x0, y: ringTop + 4, w: ringX1 - B.x0, h: Math.max(60, B.y1 - ringTop - 4) };
  const cx = stage.x + stage.w / 2;
  const banner = { x: stage.x, y: stage.y + stage.h * 0.2, w: stage.w, h: Math.round(64 * k) };
  const cs = Math.round(Math.min(110 * k, stage.h * 0.4));
  const count = { x: cx - cs / 2, y: stage.y + Math.round(4 * k), w: cs, h: cs };
  const cardW = Math.min(stage.w - 8, 560 * k);
  const card = { x: cx - cardW / 2, y: stage.y + 2, w: cardW, h: Math.round(Math.min(stage.h * 0.55, 200 * k)) };
  // the pill in the column's top (the column is empty in a read), else the ring alone
  const pillW = k >= 1.35 ? 240 : PILL_W;
  const pacer = colW >= pillW + 4 ? { x: colX + colW / 2, y: colTop } : { x: colX + colW / 2, y: colTop + 2, ring: true };
  return {
    w: W, h: H, ring, bars: { player: bars.player, foe: bars.foe }, options, coach, why, banner, count,
    font, wide: true, stage, mode: 'column', k, pacer, card, readTop: stage.y,
  };
}
