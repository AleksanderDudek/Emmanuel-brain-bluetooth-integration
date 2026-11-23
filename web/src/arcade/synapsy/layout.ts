/**
 * Where everything sits on Synapsy's canvas, phone first (DESIGN §12, §14): pure numbers, so the tests can check
 * every size the arcade is played on.
 *
 *   tall   a phone upright (the reference) and a tablet: the brain fills the band under the HUD; the lens
 *          (the gauge) in the bottom-left corner beside the occipital lobe, Oli's button in the bottom-right
 *          corner under the thumb, the sing-along line between them; the message strip (a lesson card, a
 *          Wiedza card) at the top of the band, over the frontal lobes for a few seconds.
 *   side   a phone on its side (and a tablet on its side): the brain in the middle at the band's full height;
 *          a column on the left for the lens and the message strip, a column on the right for Oli (bottom,
 *          under the right thumb) and her bubble; the song line at the bottom of the left column.
 *   desk   a mouse on a desktop or a big screen (kit/mobile `screenKind`, §14): the brain as tall as the band
 *          and the HUD in columns beside it, its type growing with `uiScale` (to 2.2 on a big monitor).  Where
 *          the band is wide (a laptop, a 1280 px window under the top HUD) the brain stands in the middle with
 *          the lens and the cards on its left and the song, Oli's words and Oli on its right; on a big
 *          screen's middle column (Full HD, QHD) a full-height brain leaves room for one column, on its right:
 *          the lens at the top, the cards, Oli's words, the song (the sung line and the next) and Oli at the
 *          foot, right by the brain, the O key's cap under her.
 *
 * The halves' plate sits on the corpus callosum itself, between its two lanes.  `u` is the kit's uiScale
 * (1 on any phone, up to 1.3; on a big screen's desk up to 2.2); `k` scales the HUD's type: the phone's caps
 * (1.15–1.2) everywhere but a desk, where it is u.
 */
import { MIN_TAP, screenKind, target, uiScale, type Rect } from '../kit/mobile';
import { overlaps, pacerBox, pacerLeast, pacerSize, pacerSpot, type Pt } from '../kit/pacerspot';
import type { Insets, TapTarget } from '../kit/types';
import { OUTLINE, halfWidth } from './brain';

export type Mode = 'tall' | 'side' | 'desk';

export interface Layout {
  w: number;
  h: number;
  u: number;
  ins: Insets;
  mode: Mode;
  /** a mouse on a desktop or a big screen: hover answers, keys shown, the type grows with u */
  desk: boolean;
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
  /** a desk's key cap under Oli's button ("O"), else null */
  oliKey: Rect | null;
  /** the sing-along line (on a desk two lines: the sung one and the next) */
  song: Rect;
  /** the message strip: a lesson's card, a new Wiedza card */
  strip: Rect;
  /** Oli's bubble: where it may grow (it hangs from its bottom corner over Oli: right on a phone, left on a desk) */
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
export const SPAN_X = OUTLINE.half + 0.02;
export const SPAN_Y = OUTLINE.ry + 0.02;

/** The HUD's type scale: the phone's cap `cap` (1.15 or 1.2), or u on a desk. */
export const typeK = (L: Pick<Layout, 'u' | 'desk'>, cap = 1.15): number => (L.desk ? L.u : Math.min(cap, L.u));

export function layout(w: number, h: number, ins: Insets, spacing = 0.235, touch = true): Layout {
  const u = uiScale(w, h);
  const band: Rect = { x: ins.left, y: ins.top, w: Math.max(1, w - ins.left - ins.right), h: Math.max(1, h - ins.top - ins.bottom) };
  const kind = screenKind(w, h, touch);
  if (!touch && (kind === 'desktop' || kind === 'big') && band.w / band.h >= 1.15) return deskLayout(w, h, u, ins, band, spacing);
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
  return { w, h, u, ins, mode, desk: false, band, cx, cy, s, brain, lens, oli, oliKey: null, song, strip, bubble, plate, card, pick, soma };
}

/**
 * A desk: the brain as tall as the band (unless one readable column would not fit beside it) and the HUD in
 * columns — two when the band is wide enough for them (the brain in the middle), else one on the right.
 */
function deskLayout(w: number, h: number, u: number, ins: Insets, band: Rect, spacing: number): Layout {
  const edge = 16, gap = Math.round(14 * u);
  const colMin = Math.max(260, 220 * u);
  const top = band.y + 12, bottom = band.y + band.h - 12;
  const s = Math.max(40, Math.min((bottom - top) / 2 / SPAN_Y, (band.w - 2 * edge - colMin - gap) / 2 / SPAN_X));
  const bw = 2 * SPAN_X * s;
  const free = band.w - 2 * edge - bw;
  const two = free - 2 * gap >= 2 * colMin;
  let cx: number, colL: Rect | null, colR: Rect;
  if (two) {
    cx = band.x + band.w / 2;
    const cw = Math.min(440 * u, (free - 2 * gap) / 2);
    colL = { x: cx - bw / 2 - gap - cw, y: top, w: cw, h: bottom - top };
    colR = { x: cx + bw / 2 + gap, y: top, w: cw, h: bottom - top };
  } else {
    cx = band.x + edge + bw / 2;
    colL = null;
    const x = cx + bw / 2 + gap;
    colR = { x, y: top, w: Math.min(460 * u, band.x + band.w - edge - x), h: bottom - top };
  }
  const cy = band.y + band.h / 2;
  // Oli at the foot of the right column, by the brain, her name over her nest and the O key under it
  const oliSize = Math.round(64 * u);
  const keyH = Math.round(12 * u) + 12;
  const oli: Rect = { x: colR.x + 6, y: bottom - keyH - oliSize, w: oliSize, h: oliSize };
  const oliKey: Rect = { x: oli.x, y: oli.y + oli.h + 4, w: oli.w, h: keyH - 4 };
  const nameTop = oli.y - Math.round(13 * u) - 12;
  const lineH = Math.round(13.5 * u * 1.4);
  const songH = 2 * lineH + 6;
  // the lens at the top of the left column (or of the only one)
  const lc = colL ?? colR;
  const r = Math.round(Math.min(lc.w * 0.3, 82 * u, band.h * 0.16));
  const lens = { x: lc.x + lc.w / 2, y: top + r + 4, r };
  const lensBottom = lens.y + r + gap;
  let song: Rect, strip: Rect, bubble: Rect;
  if (colL) {
    // the left column: the lens and the cards under it; the right one: the song, Oli's words, Oli
    strip = { x: colL.x, y: lensBottom, w: colL.w, h: bottom - lensBottom };
    song = { x: colR.x, y: top, w: colR.w, h: songH };
    bubble = { x: colR.x, y: song.y + song.h + gap, w: colR.w, h: nameTop - gap - (song.y + song.h + gap) };
  } else {
    // one column: the lens, the cards, Oli's words, the song, Oli
    song = { x: colR.x, y: nameTop - gap - songH, w: colR.w, h: songH };
    const mid = song.y - gap - lensBottom;
    const stripH = Math.round(mid * 0.58);
    strip = { x: colR.x, y: lensBottom, w: colR.w, h: stripH };
    bubble = { x: colR.x, y: lensBottom + stripH + gap, w: colR.w, h: song.y - gap - (lensBottom + stripH + gap) };
  }
  const brain: Rect = { x: cx - SPAN_X * s, y: cy - SPAN_Y * s, w: 2 * SPAN_X * s, h: 2 * SPAN_Y * s };
  const soma = Math.max(5.5, Math.min(9 * u, s * 0.035));
  const pw = Math.round(Math.max(44, Math.min(78 * u, 2 * (0.28 * s - soma * 1.9 - 3))));
  const ph = Math.round(48 * u);
  const plate: Rect = { x: cx - pw / 2, y: cy + 0.13 * s - ph / 2, w: pw, h: ph };
  const cw = Math.min(band.w - 24, Math.round(470 * u));
  const ch = Math.min(band.h - 16, Math.round(330 * u));
  const card: Rect = { x: band.x + (band.w - cw) / 2, y: band.y + (band.h - ch) / 2, w: cw, h: ch };
  const pick = Math.max(22, Math.min(40, spacing * s * 0.62));
  return { w, h, u, ins, mode: 'desk', desk: true, band, cx, cy, s, brain, lens, oli, oliKey, song, strip, bubble, plate, card, pick, soma };
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

/** The brain's outline as 16 horizontal slabs that cover it (brain.ts `halfWidth`, at its widest within each). */
function brainSlabs(L: Layout): Rect[] {
  const n = 16, ry = OUTLINE.ry, out: Rect[] = [];
  for (let k = 0; k < n; k++) {
    const y0 = -ry + (2 * ry * k) / n, y1 = -ry + (2 * ry * (k + 1)) / n;
    const half = Math.max(halfWidth(y0), halfWidth(y1), y0 <= 0 && y1 >= 0 ? halfWidth(0) : 0) + 0.04;
    out.push({ x: L.cx - half * L.s, y: L.cy + y0 * L.s, w: 2 * half * L.s, h: (y1 - y0) * L.s });
  }
  return out;
}

/**
 * Where the runner's breath pacer stands in a rest (ArcadeGame.pacerAt; kit/pacerspot.ts): off the brain (its
 * neurons and paths stay in sight), the lens (the rest's consolidation fills it), Oli with her name and key, the
 * halves' plate and the sing-along line — in a column beside the brain (a desktop: under the lens where the cards
 * come, or over Oli where her words do), else in a corner the brain's round outline leaves (a phone: the band's top
 * corners), covering as few of its `neurons` (brain units) as there are — each counts ten times its outline's room,
 * a card's and Oli's words' room once.  A lesson's or a Wiedza card that comes meanwhile steps down under the pill
 * (`stripShift`).
 */
export function pacerAt(L: Layout, neurons: readonly { x: number; y: number }[] = []): Pt | null {
  const size = pacerSize(L.desk && L.u > 1.3);
  const band = L.band, u = L.u;
  const lens = { x: L.lens.x - L.lens.r - 6, y: L.lens.y - L.lens.r - 6, w: 2 * L.lens.r + 12, h: 2 * L.lens.r + 30 * u };
  const oli = { x: L.oli.x - 8, y: L.oli.y - 26 * u, w: L.oli.w + 16, h: L.oli.h + 26 * u + (L.oliKey ? L.oliKey.h + 6 : 0) };
  const hard = [lens, oli, L.song, L.plate];
  const brain = brainSlabs(L);
  const r = L.soma + 6;
  const cells = neurons.map(n => ({ x: L.cx + n.x * L.s - r, y: L.cy + n.y * L.s - r, w: 2 * r, h: 2 * r }));
  const weighted = cells.flatMap(c => [c, c, c, c, c, c, c, c, c, c]);
  return pacerSpot([band], [...hard, ...brain, L.strip, L.bubble], { size })
    ?? pacerSpot([band], [...hard, ...brain], { size })
    ?? pacerLeast([band], hard, [...weighted, ...brain, L.strip, L.bubble], { size });
}

/** How far a phone's message strip (a lesson's card, a Wiedza card) steps down in a rest, to show under the pacer where it took the strip's place (px). */
export function stripShift(L: Layout, at: Pt | null): number {
  if (!at || L.desk) return 0;
  const b = pacerBox(at, pacerSize(false));
  return overlaps(b, L.strip) ? Math.max(0, b.y + b.h + 6 - L.strip.y) : 0;
}
