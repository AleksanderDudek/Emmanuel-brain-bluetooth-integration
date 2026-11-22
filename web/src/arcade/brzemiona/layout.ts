/**
 * Where Brzemiona's play view puts things (CSS px), phone first (DESIGN.md §12, §14, §18).  The runner's HUD covers
 * the canvas top (`insets().top`), the home indicator its bottom, a notch the sides; the sky runs under all of them,
 * the game's own bits stay inside.  Three shapes:
 *
 *   tall   anything upright, and a big screen's middle column: the picture on top, the words band under it (what to
 *          do now, whom, the prayer on the breath, the breath's guide; in rest the verse), the three controls — ≡ ◎ ▶ —
 *          in the thumb zone at the bottom
 *   side   a phone on its side: the picture on the left, the words and the controls in a column on the right
 *   wide   a wide desktop band: the picture on the left as big as it goes, the words and the controls (with their
 *          keys) in a column at a reading measure
 *
 * The triptych inside the picture goes by its shape (DESIGN §18, the brief's "design both"): **across** (the one
 * prayed for on the left, the Cross in the middle on its hill, the player on the right) when the picture is wider
 * than tall — the smallest phone's picture is about 344 × 176 — and **down** (the one prayed for above, the Cross in
 * the middle, the player below) when it is taller, as on an installed iPhone.  Pure: the tests run it at every
 * kit/mobile CHECK_SIZES entry.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, TAP_GAP, screenKind, uiScale, type Rect, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';

export type { Rect };
export type Shape = 'tall' | 'side' | 'wide';
export type Orient = 'across' | 'down';
export type Control = 'list' | 'widen' | 'next';
export const CONTROLS: readonly Control[] = ['list', 'widen', 'next'];

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape: Shape;
  touch: boolean;
  kind: ScreenKind;
  /** a desktop or a big screen with a mouse: keys under the controls, hover */
  desk: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop, up to DESK_MAX on a big screen */
  u: number;
  /** the picture (the triptych) and the way it runs */
  pic: Rect;
  orient: Orient;
  /** the words band, the narrator's place (over the picture's sky, or atop the column) */
  words: Rect;
  caption: Rect;
  ctl: Record<Control, Rect>;
  story: Rect;
  pickBox: Rect;
  font: { now: number; who: number; prayer: number; prayerMin: number; caption: number; verse: number; small: number; label: number; key: number };
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 24, h * 0.6);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const bw = right - left, bh = bottom - top;
  const kind = screenKind(w, h, touch);
  const desk = !touch && (kind === 'desktop' || kind === 'big');
  const side = bh < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w <= h * 1.05 || bw / bh < 1.75 ? 'tall' : 'wide';
  const u = shape === 'side' ? 1 : uiScale(w, h, 1.3);
  const font = {
    now: Math.max(13, Math.round(13.5 * u)), who: Math.max(13, Math.round(13 * u)), prayer: Math.round((desk ? 18 : 16) * u),
    prayerMin: 15, caption: Math.max(13, Math.round(13.5 * u)), verse: Math.max(13, Math.round(14.5 * u)), small: Math.max(13, Math.round(12 * u)),
    label: Math.max(13, Math.round(13 * u)), key: Math.max(12, Math.round(11.5 * u)),
  };
  const btn = Math.round(Math.max(MIN_TAP + 4, 48 * Math.min(u, 1.3)) * (desk ? Math.max(1, u / 1.3) : 1));
  const gap = Math.max(TAP_GAP + 10, Math.round(22 * u));
  const keyH = desk ? Math.round(font.key * 1.6) : 0;
  const row = (cx: number, y: number): Record<Control, Rect> => {
    const total = CONTROLS.length * btn + (CONTROLS.length - 1) * gap;
    const x0 = cx - total / 2;
    return Object.fromEntries(CONTROLS.map((c, i) => [c, { x: x0 + i * (btn + gap), y, w: btn, h: btn }])) as Record<Control, Rect>;
  };
  const storyW = Math.min(bw - 24, 540 * u);
  const story = { x: (left + right - storyW) / 2, y: top + 8, w: storyW, h: bh - 16 };
  const pickW = Math.min(bw - 20, (desk ? 620 : 520) * u);
  const pickBox = { x: (left + right - pickW) / 2, y: top + 8, w: pickW, h: bh - 16 };
  const capLine = Math.round(font.caption * 1.35);
  const orientOf = (r: Rect): Orient => (r.h >= r.w * 0.95 ? 'down' : 'across');

  if (shape === 'tall') {
    const ctlY = bottom - 10 - btn - keyH;
    // the words band: at least 112 px (the smallest phone), a reading measure on a big screen
    const wordsH = Math.round(clamp(bh * 0.28, 112, (desk ? 210 : 190) * u));
    const wordsW = Math.min(bw - 24, desk ? Math.round(34 * font.prayer) : bw - 24);
    const words = { x: (left + right - wordsW) / 2, y: ctlY - 8 - wordsH, w: wordsW, h: wordsH };
    const pic = { x: left + 6, y: top + 4, w: bw - 12, h: Math.max(90, words.y - 6 - (top + 4)) };
    const caption = { x: pic.x + 10, y: pic.y + 4, w: pic.w - 20, h: capLine * 2 + 6 };
    return { w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, pic, orient: orientOf(pic), words, caption, ctl: row((left + right) / 2, ctlY), story, pickBox, font };
  }

  if (shape === 'wide') {
    const colGap = Math.round(28 * u);
    const colW = Math.round(Math.max(280, Math.min(19 * font.prayer, bw * 0.36)));
    const pic = { x: left + 12, y: top + 8, w: Math.round(bw - 24 - colGap - colW), h: bh - 16 };
    const colX = pic.x + pic.w + colGap;
    const capH = capLine * 2 + 8;
    const wordsH = Math.round(clamp(bh - capH - btn - keyH - 60, 150, 11 * font.prayer));
    const groupH = capH + 10 + wordsH + 18 + btn + keyH;
    const y0 = Math.max(top + 10, Math.min(bottom - 10 - groupH, top + (bh - groupH) / 2));
    const caption = { x: colX, y: y0, w: colW, h: capH };
    const words = { x: colX, y: y0 + capH + 10, w: colW, h: wordsH };
    return {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, pic, orient: orientOf(pic), words, caption,
      ctl: row(colX + colW / 2, words.y + wordsH + 18), story, pickBox, font,
    };
  }

  // side: a phone on its side — the picture on the left, the column on the right
  const pic = { x: left + 6, y: top + 4, w: Math.round(bw * 0.56), h: bh - 8 };
  const colX = pic.x + pic.w + 10;
  const colW = right - 8 - colX;
  const ctlY = bottom - 8 - btn;
  const words = { x: colX, y: top + 6, w: colW, h: Math.max(90, ctlY - 8 - (top + 6)) };
  const caption = { x: pic.x + 8, y: pic.y + 2, w: pic.w - 16, h: capLine * 2 + 6 };
  return { w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, pic, orient: orientOf(pic), words, caption, ctl: row(colX + colW / 2, ctlY), story, pickBox, font };
}

// ── the triptych ─────────────────────────────────────────────────
/** A figure's place: its feet (x, y) and its height H; the Cross's: its foot on the hill, its height and arm span. */
export interface FigPlace { x: number; y: number; H: number }
export interface CrossPlace { x: number; y: number; h: number; arm: number; cx: number; cy: number }
export interface Stage {
  person: FigPlace;
  player: FigPlace;
  cross: CrossPlace;
  /** the ground lines (a far ridge under the one prayed for, the hill, the near ground) */
  ridgeY: number;
  hillY: number;
  nearY: number;
  /** the whole world as a night globe where the one prayed for stood */
  globe: { x: number; y: number; r: number };
  /** where the many stand around the one (their feet, their height) */
  many: FigPlace[];
}

/** The triptych's places in the picture (CSS px). */
export function stageOf(L: Pick<Layout, 'pic' | 'orient' | 'u' | 'desk'>, manyCount = 0): Stage {
  const P = L.pic;
  if (L.orient === 'across') {
    const nearY = P.y + P.h * 0.86, ridgeY = P.y + P.h * 0.8, hillY = P.y + P.h * 0.8;
    const Hp = Math.min(P.h * 0.5, P.w * 0.24);
    const player: FigPlace = { x: P.x + P.w * 0.84, y: nearY, H: Hp };
    const person: FigPlace = { x: P.x + P.w * 0.17, y: ridgeY, H: Hp * 0.86 };
    const ch = Math.min(P.h * 0.56, Hp * 1.3);
    const foot = P.y + P.h * 0.745;
    const cross: CrossPlace = { x: P.x + P.w * 0.5, y: foot, h: ch, arm: ch * 0.42, cx: P.x + P.w * 0.5, cy: foot - ch * 0.73 };
    const r = Math.min(P.w * 0.12, P.h * 0.27);
    const globe = { x: person.x, y: person.y - person.H * 0.5, r };
    return { person, player, cross, ridgeY, hillY, nearY, globe, many: manyAround(person, manyCount, P.x + 6, cross.x - cross.arm * 0.7, 'across') };
  }
  const ridgeY = P.y + P.h * 0.31, hillY = P.y + P.h * 0.64, nearY = P.y + P.h * 0.975;
  const Hp = Math.min(P.h * 0.27, P.w * 0.48);
  const player: FigPlace = { x: P.x + P.w * 0.5, y: nearY, H: Hp };
  const person: FigPlace = { x: P.x + P.w * 0.5, y: ridgeY, H: Math.min(Hp * 0.8, P.h * 0.19) };
  const ch = Math.min(P.h * 0.27, Hp * 1.1);
  const cross: CrossPlace = { x: P.x + P.w * 0.5, y: hillY - P.h * 0.015, h: ch, arm: ch * 0.42, cx: P.x + P.w * 0.5, cy: hillY - P.h * 0.015 - ch * 0.73 };
  const r = Math.min(P.w * 0.3, P.h * 0.13);
  const globe = { x: person.x, y: person.y - person.H * 0.5, r };
  return { person, player, cross, ridgeY, hillY, nearY, globe, many: manyAround(person, manyCount, P.x + 8, P.x + P.w - 8, 'down') };
}

/**
 * The many who carry the same, around the one: smaller (further away), on the same ridge, left and right of them
 * and a little behind, never past `lo`…`hi` (across: never as far as the Cross).
 */
function manyAround(p: FigPlace, n: number, lo: number, hi: number, orient: Orient): FigPlace[] {
  const out: FigPlace[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const k = Math.floor(i / 2) + 1;
    const scale = 0.62 - 0.06 * Math.min(4, k - 1);
    const dx = side * p.H * (orient === 'across' ? 0.2 + 0.18 * k : 0.28 + 0.26 * k);
    const dy = -p.H * (0.06 + 0.035 * k) * (orient === 'across' ? 1 : 0.6);
    const x = clamp(p.x + dx, lo + p.H * 0.1, hi - p.H * 0.1);
    out.push({ x, y: p.y + dy, H: p.H * scale });
  }
  return out;
}

/** How many of the many a picture shows (a phone fewer, a big screen more). */
export const manyCount = (L: Pick<Layout, 'pic'>): number => (L.pic.w * L.pic.h > 300_000 ? 10 : L.pic.w * L.pic.h > 120_000 ? 8 : 6);

/**
 * The two lanes of the exchange (quadratic curves): the smoke from the one prayed for to the Cross (arching up
 * across, sweeping right going down), the light from the Cross back to them (the low lane across, the left lane
 * down).  Neither ever reaches the player: both end at the one prayed for or at the Cross.
 */
export interface Lane { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number }
export function lanes(S: Stage, orient: Orient, world: boolean): { smoke: Lane; light: Lane } {
  const from = world ? { x: S.globe.x, y: S.globe.y - S.globe.r * 0.7 } : { x: S.person.x, y: S.person.y - S.person.H * 0.72 };
  const to = { x: S.cross.cx, y: S.cross.cy };
  const back = world ? { x: S.globe.x, y: S.globe.y } : { x: S.person.x, y: S.person.y - S.person.H * 0.62 };
  if (orient === 'across') {
    const mx = (from.x + to.x) / 2;
    return {
      smoke: { x0: from.x, y0: from.y, cx: mx, cy: Math.min(from.y, to.y) - S.person.H * 0.75, x1: to.x, y1: to.y },
      light: { x0: to.x, y0: to.y + S.cross.h * 0.12, cx: mx, cy: Math.max(from.y, to.y) + S.person.H * 0.05, x1: back.x, y1: back.y },
    };
  }
  const my = (from.y + to.y) / 2, off = Math.max(40, S.person.H * 0.9);
  return {
    smoke: { x0: from.x, y0: from.y - S.person.H * 0.2, cx: to.x + off, cy: my - S.person.H * 0.3, x1: to.x + S.cross.arm * 0.1, y1: to.y },
    light: { x0: to.x - S.cross.arm * 0.1, y0: to.y, cx: to.x - off, cy: my, x1: back.x, y1: back.y },
  };
}

/** A point on a lane at u (0..1). */
export function laneAt(l: Lane, u: number): [number, number] {
  const v = 1 - u;
  return [v * v * l.x0 + 2 * v * u * l.cx + u * u * l.x1, v * v * l.y0 + 2 * v * u * l.cy + u * u * l.y1];
}

// ── the story card and the chooser ───────────────────────────────
export function storyRect(L: Layout, height: number): Rect {
  const h = Math.min(height, L.story.h);
  return { x: L.story.x, y: L.story.y + (L.story.h - h) / 2, w: L.story.w, h };
}

export interface ChooserLayout {
  card: Rect;
  titleY: number;
  close: Rect;
  items: Rect[];
  /** the page buttons (only when the list has more than one page) */
  prev: Rect | null;
  nextPage: Rect | null;
  cols: number;
}

/** The chooser as a card over the picture: a title with a close button, up to six entries a page, the pages' arrows. */
export function chooserLayout(L: Layout, count: number, pages: number): ChooserLayout {
  const B = L.pickBox, u = L.desk ? L.u : Math.min(L.u, 1.3);
  const pad = Math.round(12 * u);
  const cols = L.shape === 'tall' && !L.desk ? 2 : 3;
  const n = Math.max(1, Math.min(6, count));
  const rows = Math.ceil(n / cols);
  const titleH = Math.round(Math.max(MIN_TAP, 40 * u));
  const g = Math.max(TAP_GAP, Math.round(8 * u));
  const itemH = Math.round(Math.max(MIN_TAP + 4, (L.desk ? 58 : 52) * u));
  const pageH = pages > 1 ? Math.round(Math.max(MIN_TAP, 44 * u)) : 0;
  const want = pad + titleH + g + rows * itemH + (rows - 1) * g + (pageH ? g + pageH : 0) + pad;
  const h = Math.min(B.h, want);
  const card = { x: B.x, y: B.y + (B.h - h) / 2, w: B.w, h };
  const inner = card.w - 2 * pad;
  const close = { x: card.x + card.w - pad - titleH, y: card.y + pad, w: titleH, h: titleH };
  const iy = card.y + pad + titleH + g;
  const roomH = card.y + card.h - pad - (pageH ? g + pageH : 0) - iy;
  const ih = Math.max(MIN_TAP, Math.min(itemH, (roomH - (rows - 1) * g) / rows));
  const itemW = (inner - (cols - 1) * g) / cols;
  const items = Array.from({ length: n }, (_, i) => ({ x: card.x + pad + (i % cols) * (itemW + g), y: iy + Math.floor(i / cols) * (ih + g), w: itemW, h: ih }));
  const py = card.y + card.h - pad - pageH;
  const pw = Math.max(MIN_TAP, Math.round(64 * u));
  const prev = pageH ? { x: card.x + pad, y: py, w: pw, h: pageH } : null;
  const nextPage = pageH ? { x: card.x + card.w - pad - pw, y: py, w: pw, h: pageH } : null;
  return { card, titleY: card.y + pad + titleH / 2, close, items, prev, nextPage, cols };
}

// ── the targets ──────────────────────────────────────────────────
export interface TargetState {
  story: Rect | null;
  /** the chooser is open: its entries on this page, and the pages */
  chooser: { count: number; pages: number } | null;
  live: boolean;
}

export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  if (!s.live) return [];
  if (s.chooser) {
    const C = chooserLayout(L, s.chooser.count, s.chooser.pages);
    return [
      { label: 'close', ...C.close },
      ...C.items.map((r, i) => ({ label: `item:${i}`, ...r })),
      ...(C.prev ? [{ label: 'page:prev', ...C.prev }] : []),
      ...(C.nextPage ? [{ label: 'page:next', ...C.nextPage }] : []),
    ];
  }
  return CONTROLS.map(c => ({ label: c, ...L.ctl[c] }));
}

/** What a tap at (x, y) lands on: a control, a chooser's part ('card' inside it, 'outside'), or the picture (null). */
export function hitAt(L: Layout, s: TargetState, x: number, y: number): string | null {
  const inside = (r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (const tg of tapTargets(L, s)) if (inside(tg)) return tg.label;
  if (s.chooser && !s.story) return inside(chooserLayout(L, s.chooser.count, s.chooser.pages).card) ? 'card' : 'outside';
  return null;
}
