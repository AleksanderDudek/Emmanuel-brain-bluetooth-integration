/**
 * Where Światło ciała's play view puts things (CSS px), phone first (DESIGN.md §12, §13.10, §14).  The runner's HUD
 * covers the canvas top (`insets().top`), the home indicator its bottom, a notch the sides; the night runs under all
 * of them, the game's own bits stay inside.  Every shape has the same parts:
 *
 *   now     one line at the top: what to do now (an icon and a few words)
 *   stage   the picture: the standing figure (tall) or the brain (wider)
 *   card    the element's words: its name, the Latin, the guidance, the fill — then its fact, the breath in rest
 *   ctrl    three round buttons: ≡ the meditations, ◀ back, ▶ on (in the thumb zone on a phone)
 *
 *   tall   anything upright, a phone the reference (360 × 366 band): the figure in the left column, the card on the
 *          right with the buttons under it; the brain over the full width, the card under it, the buttons beside it
 *   side   a phone on its side: the card left, the picture in the middle, the buttons right
 *   wide   a tablet on its side: the side layout grown (u ≤ 1.3)
 *   desk   a mouse on a desktop or a big screen (kit/mobile `screenKind`, §14): the card column, the picture as tall
 *          as the band, a right column with the narrator, the way's list and the buttons with their keys' names
 *
 * Everything here is pure: the tests run it at every kit/mobile CHECK_SIZES entry.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { BRAIN_BOX } from './brain';
import { FIG_HALF } from './figure';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Btn { x: number; y: number; r: number; hit: Rect }
export type Shape = 'tall' | 'side' | 'wide' | 'desk';
export type CtrlId = 'menu' | 'prev' | 'next';
export const CTRLS: readonly CtrlId[] = ['menu', 'prev', 'next'];

/** the figure's box in its units (with a margin for the glow): x ±(FIG_HALF + 0.02), y −0.02…1.02 */
export const FIG_BOX = { x0: -(FIG_HALF + 0.02), y0: -0.02, x1: FIG_HALF + 0.02, y1: 1.02 } as const;

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape: Shape;
  kind: ScreenKind;
  touch: boolean;
  /** laid out for the brain's wider picture */
  brain: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet, to 2.2 on a big screen; `k` the small type's scale */
  u: number;
  k: number;
  now: Rect;
  stage: Rect;
  /** where the picture may be drawn (the stage grown to the UI around it: a zoomed figure never runs under the card) */
  pic: Rect;
  card: Rect;
  ctrl: Record<CtrlId, Btn>;
  /** a desk shows the keys' names under the buttons and a list of the way */
  keys: boolean;
  list: Rect | null;
  /** the narrator's place (null: over the stage, at the end away from the element) */
  bubble: Rect | null;
  font: { name: number; latin: number; text: number; small: number; now: number; bubble: number; title: number; cap: number };
}

const EDGE = 12;

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true, brain = false): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 24, h * 0.6);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const kind = screenKind(w, h, touch);
  if (!touch && (kind === 'desktop' || kind === 'big') && w >= 1000) return deskLayout(w, h, ins, top, left, right, bottom, kind, brain);
  const bw = right - left, bh = bottom - top;
  const side = h < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w > h ? 'wide' : 'tall';
  const u = shape === 'side' ? 1 : uiScale(w, h, 1.3);
  const font = {
    name: Math.round(19 * u), latin: Math.max(12, Math.round(12 * u)), text: Math.round(14 * u), small: Math.max(13, Math.round(12.5 * u)),
    now: Math.round(14 * u), bubble: Math.round(14 * u), title: Math.round(20 * u), cap: 13,
  };
  const nowH = Math.round(font.now * 1.75);
  const r = Math.round(23 * Math.min(u, 1.2));
  const d = 2 * r + 4, gap = 6;
  const btn = (x: number, y: number): Btn => ({ x, y, r, hit: { x: x - d / 2, y: y - d / 2, w: d, h: d } });

  if (shape === 'tall') {
    const now = { x: left + EDGE, y: top + 4, w: bw - 2 * EDGE, h: nowH };
    const y0 = now.y + now.h + 6;
    if (brain) {
      // the brain over the full width; under it the card, the buttons in a column at the right edge
      const rb = Math.round(20 * Math.min(u, 1.2)), db = 2 * rb + 4, gb = 4;
      const colH = 3 * db + 2 * gb;
      const cardH = Math.max(colH, Math.round(bh * 0.36));
      const stage = { x: left + EDGE, y: y0, w: bw - 2 * EDGE, h: Math.min((bw - 2 * EDGE) * 0.95, bottom - 8 - cardH - 6 - y0) };
      const colX = right - EDGE - db / 2;
      const cy1 = bottom - 8 - db / 2;
      const b2 = (x: number, y: number): Btn => ({ x, y, r: rb, hit: { x: x - db / 2, y: y - db / 2, w: db, h: db } });
      const ctrl = { next: b2(colX, cy1), prev: b2(colX, cy1 - db - gb), menu: b2(colX, cy1 - 2 * (db + gb)) };
      const cardY = stage.y + stage.h + 6;
      const card = { x: left + EDGE, y: cardY, w: bw - 2 * EDGE - db - 8, h: bottom - 8 - cardY };
      const pic = { x: left, y: top, w: bw, h: card.y - 4 - top };
      return { w, h, ins, top, bottom, left, right, shape, kind, touch, brain, u, k: 1, now, stage, pic, card, ctrl, keys: false, list: null, bubble: null, font };
    }
    const cardW = clamp(bw * 0.45, 156, 270 * u);
    const cardX = right - EDGE - cardW;
    // the three buttons in a row under the card, in the thumb zone
    const rowW = 3 * d + 2 * gap;
    const cy = bottom - 12 - d / 2;
    const bx0 = cardX + (cardW - rowW) / 2 + d / 2;
    const ctrl = { menu: btn(bx0, cy), prev: btn(bx0 + d + gap, cy), next: btn(bx0 + 2 * (d + gap), cy) };
    const card = { x: cardX, y: y0, w: cardW, h: cy - d / 2 - 10 - y0 };
    const stage = { x: left + 4, y: y0, w: cardX - 8 - (left + 4), h: bottom - 4 - y0 };
    const pic = { x: left, y: top, w: cardX - 4 - left, h: bh };
    return { w, h, ins, top, bottom, left, right, shape, kind, touch, brain, u, k: 1, now, stage, pic, card, ctrl, keys: false, list: null, bubble: null, font };
  }

  // side and wide: the card on the left, the picture in the middle, the buttons in a column on the right
  const colR = d + 2 * EDGE;
  const cardW = clamp(bw * (brain ? 0.36 : 0.42), 190, 340 * u);
  const now = { x: left + EDGE, y: top + 4, w: cardW, h: nowH };
  const card = { x: left + EDGE, y: now.y + now.h + 6, w: cardW, h: bottom - 8 - (now.y + now.h + 6) };
  const sx = card.x + card.w + 10, sw = right - colR - sx;
  const stage = { x: sx, y: top + 4, w: sw, h: bottom - 4 - (top + 4) };
  const colX = right - EDGE - d / 2;
  const cy1 = bottom - 10 - d / 2;
  const ctrl = { next: btn(colX, cy1), prev: btn(colX, cy1 - d - gap), menu: btn(colX, cy1 - 2 * (d + gap)) };
  const pic = { x: card.x + card.w + 4, y: top, w: colX - d / 2 - 6 - (card.x + card.w + 4), h: bh };
  return { w, h, ins, top, bottom, left, right, shape, kind, touch, brain, u, k: 1, now, stage, pic, card, ctrl, keys: false, list: null, bubble: null, font };
}

/** A mouse on a desktop or a big screen: the card column, the picture, a right column for the narrator, the list and the buttons. */
function deskLayout(w: number, h: number, ins: Insets, top: number, left: number, right: number, bottom: number, kind: ScreenKind, brain: boolean): Layout {
  const bw = right - left;
  const u = uiScale(w, h, 1.3);
  const font = {
    name: Math.round(22 * u), latin: Math.round(13 * u), text: Math.round(15 * u), small: Math.round(13 * u), now: Math.round(15 * u),
    bubble: Math.round(15 * u), title: Math.round(22 * u), cap: Math.round(13 * u),
  };
  const y0 = top + 12, y1 = bottom - 12;
  const H = y1 - y0;
  // the picture: as tall as the band, as wide as its aspect (the figure's, or the brain's)
  const aspect = brain ? (BRAIN_BOX.x1 - BRAIN_BOX.x0) / (BRAIN_BOX.y1 - BRAIN_BOX.y0) : (FIG_BOX.x1 - FIG_BOX.x0) / (FIG_BOX.y1 - FIG_BOX.y0);
  const colMin = Math.max(260, 230 * u);
  const sw = Math.min(H * aspect * (brain ? 1 : 1.25), bw - 2 * colMin - 4 * EDGE);
  const colW = (bw - sw - 4 * EDGE) / 2;
  const stage = { x: left + EDGE + colW + EDGE, y: y0, w: sw, h: H };
  const cw = Math.min(colW, 400 * u);
  const cx = stage.x - EDGE - cw;
  const nowH = Math.round(font.now * 1.9);
  const now = { x: cx, y: y0, w: cw, h: nowH };
  const card = { x: cx, y: now.y + now.h + 10, w: cw, h: y1 - (now.y + now.h + 10) };
  // the right column: the narrator at the top, the way's list, the buttons at the foot with their keys
  const rx = stage.x + stage.w + EDGE, rw = Math.min(colW, 400 * u);
  const r = Math.round(26 * u);
  const d = 2 * r + 6, gap = Math.round(14 * u);
  const capH = Math.round(font.cap * 1.5) * 2 + 4;
  const cy = y1 - capH - d / 2;
  const btn = (x: number): Btn => ({ x, y: cy, r, hit: { x: x - d / 2, y: cy - d / 2, w: d, h: d + capH } });
  const rowW = 3 * d + 2 * gap;
  const bx0 = rx + (rw - rowW) / 2 + d / 2;
  const ctrl = { menu: btn(bx0), prev: btn(bx0 + d + gap), next: btn(bx0 + 2 * (d + gap)) };
  const bubbleH = Math.round(font.bubble * 1.45 * 3 + 30 * u);
  const bubble = { x: rx, y: y0, w: rw, h: bubbleH };
  const listY = bubble.y + bubble.h + 14;
  const list = { x: rx, y: listY, w: rw, h: cy - d / 2 - 14 - listY };
  const pic = { x: cx + cw + 6, y: top, w: rx - 6 - (cx + cw + 6), h: bottom - top };
  return {
    w, h, ins, top, bottom, left, right, shape: 'desk', kind, touch: false, brain, u, k: u, now, stage, pic, card, ctrl, keys: true,
    list: list.h >= 80 ? list : null, bubble, font,
  };
}

/** The picker's card (centred in the band): a title, five rows, a close button in its corner. */
export function pickerRect(L: Layout): { box: Rect; rows: Rect[]; close: Rect } {
  const u = L.u;
  const bw = L.right - L.left, bh = L.bottom - L.top;
  // a short, wide band (a phone on its side) takes the five rows in two columns
  const cols = bh < 360 && bw > 520 ? 2 : 1;
  const per = Math.ceil(5 / cols);
  const w = Math.min(bw - 24, (cols === 2 ? 620 : 440) * u);
  const head = Math.round(52 * u);
  const rowH = Math.max(48, Math.round(54 * u)), gap = 6;
  const hTotal = head + per * rowH + (per - 1) * gap + 14;
  const scale = hTotal > bh - 12 ? (bh - 12 - head - 14 - (per - 1) * gap) / (per * rowH) : 1;
  const rh = Math.max(46, Math.floor(rowH * scale));
  const h = head + per * rh + (per - 1) * gap + 14;
  const box = { x: L.left + (bw - w) / 2, y: L.top + Math.max(6, (bh - h) / 2), w, h };
  const cw = (box.w - 20 - (cols - 1) * 8) / cols;
  const rows = Array.from({ length: 5 }, (_, i) => {
    const c = Math.floor(i / per), r = i % per;
    return { x: box.x + 10 + c * (cw + 8), y: box.y + head + r * (rh + gap), w: cw, h: rh };
  });
  const cs = Math.max(44, Math.round(44 * u));
  const close = { x: box.x + box.w - cs - 4, y: box.y + 4, w: cs, h: cs };
  return { box, rows, close };
}

/** The story card's rectangle for a content height (centred in the band). */
export function storyRect(L: Layout, height: number): Rect {
  const bw = L.right - L.left, bh = L.bottom - L.top;
  const w = Math.min(bw - 24, 560 * L.u);
  const h = Math.min(height, bh - 16);
  return { x: L.left + (bw - w) / 2, y: L.top + (bh - h) / 2, w, h };
}

export interface TargetState {
  /** a story card is up (it takes every tap: the only target) */
  story: Rect | null;
  /** the picker is open */
  picker: boolean;
}

/** Every control the player can tap now, as `hitTest` tests them. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  if (s.picker) {
    const P = pickerRect(L);
    return [...P.rows.map((r, i) => ({ label: `pick${i + 1}`, ...r })), { label: 'close', ...P.close }];
  }
  return CTRLS.map(c => ({ label: c, ...L.ctrl[c].hit }));
}

export type Hit = { kind: 'story' } | { kind: 'ctrl'; id: CtrlId } | { kind: 'pick'; i: number } | { kind: 'close' } | { kind: 'outside' } | { kind: 'field'; x: number; y: number };

const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** What a tap at (x, y) lands on. */
export function hitTest(L: Layout, s: TargetState, x: number, y: number): Hit {
  if (s.story) return { kind: 'story' };
  if (s.picker) {
    const P = pickerRect(L);
    if (inside(P.close, x, y)) return { kind: 'close' };
    const i = P.rows.findIndex(r => inside(r, x, y));
    if (i >= 0) return { kind: 'pick', i };
    return inside(P.box, x, y) ? { kind: 'field', x, y } : { kind: 'outside' };
  }
  for (const c of CTRLS) if (inside(L.ctrl[c].hit, x, y)) return { kind: 'ctrl', id: c };
  return { kind: 'field', x, y };
}

// ── the camera: the picture's units → the stage ─────────────────────────────────
export interface Cam { s: number; ox: number; oy: number }

/** A camera that fits the box (in picture units) into the rect, centred. */
export function fitCam(r: Rect, x0: number, y0: number, x1: number, y1: number, pad = 0): Cam {
  const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
  const s = Math.min((r.w - 2 * pad) / bw, (r.h - 2 * pad) / bh);
  return { s, ox: r.x + r.w / 2 - ((x0 + x1) / 2) * s, oy: r.y + r.h / 2 - ((y0 + y1) / 2) * s };
}

/** The whole figure in the stage. */
export const figCam = (L: Layout): Cam => fitCam(L.stage, FIG_BOX.x0, FIG_BOX.y0, FIG_BOX.x1, FIG_BOX.y1, 4);
/** The whole brain in the stage. */
export const brainCam = (L: Layout): Cam => fitCam(L.stage, BRAIN_BOX.x0, BRAIN_BOX.y0, BRAIN_BOX.x1, BRAIN_BOX.y1, 6);

/**
 * The camera on an element of the figure: zoomed so that its box (grown to at least `minH` of the figure's height,
 * kept in the figure's proportions) fills the stage, never past `maxZ` × the whole figure, never showing more than the
 * figure's box beyond its edges.
 */
export function elementCam(L: Layout, box: readonly [number, number, number, number], maxZ = 3.2, minH = 0.3): Cam {
  const whole = figCam(L);
  const [ex0, ey0, ex1, ey1] = box;
  let h = Math.max(minH, (ey1 - ey0) * 1.5), w = Math.max((ex1 - ex0) * 1.4, 0.12);
  const cx = (ex0 + ex1) / 2, cy = (ey0 + ey1) / 2;
  const sMax = whole.s * maxZ;
  let s = Math.min(L.stage.w / w, L.stage.h / h, sMax);
  s = Math.max(s, whole.s);
  w = L.stage.w / s;
  h = L.stage.h / s;
  // keep the view on the figure: its centre clamped so the view stays within the figure's box where it can
  const fx0 = FIG_BOX.x0, fx1 = FIG_BOX.x1, fy0 = FIG_BOX.y0, fy1 = FIG_BOX.y1;
  const vx = w >= fx1 - fx0 ? (fx0 + fx1) / 2 : clamp(cx, fx0 + w / 2, fx1 - w / 2);
  const vy = h >= fy1 - fy0 ? (fy0 + fy1) / 2 : clamp(cy, fy0 + h / 2, fy1 - h / 2);
  return { s, ox: L.stage.x + L.stage.w / 2 - vx * s, oy: L.stage.y + L.stage.h / 2 - vy * s };
}

/** Ease a camera toward another (log-space zoom, the centre in screen space), time constant tau (s). */
export function easeCam(a: Cam, b: Cam, dt: number, tau: number): Cam {
  const k = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
  const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k);
  // ease the world point at the stage's centre, so the zoom does not swing
  return { s, ox: a.ox + (b.ox - a.ox) * k, oy: a.oy + (b.oy - a.oy) * k };
}

/** Interpolate two cameras (t 0 → a, 1 → b; the zoom in log space). */
export function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const k = clamp(t);
  return { s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k), ox: a.ox + (b.ox - a.ox) * k, oy: a.oy + (b.oy - a.oy) * k };
}

/** A picture point on the screen through a camera. */
export const camPt = (c: Cam, x: number, y: number): { x: number; y: number } => ({ x: c.ox + x * c.s, y: c.oy + y * c.s });
/** A screen point in the picture's units. */
export const camInv = (c: Cam, x: number, y: number): { x: number; y: number } => ({ x: (x - c.ox) / c.s, y: (y - c.oy) / c.s });
