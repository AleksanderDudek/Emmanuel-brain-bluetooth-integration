/**
 * Where Światło w dłoniach puts things (CSS px), phone first (DESIGN.md §12, §14, §18).  The runner's HUD covers the
 * canvas top (`insets().top`), the home indicator its bottom, a notch the sides; the night runs under all of them, the
 * game's own bits stay inside.  Every shape has the same parts:
 *
 *   words  what to do now (a pill), the prayer's place and step, the name of the one prayed for (large), and one
 *          paragraph: the strategy or the narrator's line, the prayer's words while offering, the passage in rest
 *   stage  the hands, the ball, the incense rising to the soft light at the top, the small figure for a hand laid
 *   ctrl   three round buttons: ≡ the list, ◀ the one before, ▶ the next (in the thumb zone on a phone)
 *
 *   tall   anything upright (a phone the reference, 360 × 366 band): the words in the top third, the hands filling the
 *          lower two-thirds with their forearms running off the bottom, the buttons in a row at the foot
 *   side   a phone on its side: the words on the left, the hands in the middle, the buttons in a column on the right
 *   wide   a tablet on its side: the side layout grown (u ≤ 1.3)
 *   desk   a mouse on a desktop or a big screen: the words column, the hands centred, a right column with the narrator,
 *          the walk of names and the buttons with their keys' names
 *
 * Everything here is pure: the tests run it at every kit/mobile CHECK_SIZES entry.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Btn { x: number; y: number; r: number; hit: Rect }
export type Shape = 'tall' | 'side' | 'wide' | 'desk';
export type CtrlId = 'menu' | 'prev' | 'next';
export const CTRLS: readonly CtrlId[] = ['menu', 'prev', 'next'];

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
  /** UI scale: 1 on any phone, up to 1.3 on a tablet, to 2.2 on a big screen */
  u: number;
  words: Rect;
  /** the words may grow down to here in rest (the passage), over the stage's empty top */
  wordsMax: number;
  stage: Rect;
  ctrl: Record<CtrlId, Btn>;
  /** a desk shows the keys' names under the buttons, the narrator's place and the walk */
  keys: boolean;
  bubble: Rect | null;
  list: Rect | null;
  font: { now: number; cap: number; name: number; text: number; verse: number; small: number; bubble: number };
}

const EDGE = 12;

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 24, h * 0.6);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const kind = screenKind(w, h, touch);
  if (!touch && (kind === 'desktop' || kind === 'big') && w >= 1000) return deskLayout(w, h, ins, top, left, right, bottom, kind);
  const bw = right - left, bh = bottom - top;
  const side = h < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w > h ? 'wide' : 'tall';
  const u = shape === 'side' ? 1 : uiScale(w, h, 1.3);
  const font = {
    now: Math.round(14 * u), cap: Math.max(13, Math.round(12 * u)), name: Math.round(25 * u), text: Math.round(14.5 * u),
    verse: Math.round(16 * u), small: Math.max(13, Math.round(13 * u)), bubble: Math.round(14 * u),
  };
  const r = Math.round(23 * Math.min(u, 1.2));
  const d = 2 * r + 4, gap = 8;
  const btn = (x: number, y: number): Btn => ({ x, y, r, hit: { x: x - d / 2, y: y - d / 2, w: d, h: d } });

  if (shape === 'tall') {
    // the words: the pill, the caption, the name, three lines of text
    const wordsH = Math.round(font.now * 1.8 + 6 + font.cap * 1.35 + font.name * 1.25 + 3 * font.text * 1.32 + 8);
    const words = { x: left + EDGE, y: top + 4, w: bw - 2 * EDGE, h: Math.min(wordsH, bh * 0.42) };
    const cy = bottom - 12 - d / 2;
    const rowW = 3 * d + 2 * gap;
    const bx0 = left + bw / 2 - rowW / 2 + d / 2;
    const ctrl = { menu: btn(bx0, cy), prev: btn(bx0 + d + gap, cy), next: btn(bx0 + 2 * (d + gap), cy) };
    const stage = { x: left, y: words.y + words.h, w: bw, h: bottom - (words.y + words.h) };
    return { w, h, ins, top, bottom, left, right, shape, kind, touch, u, words, wordsMax: top + bh * 0.52, stage, ctrl, keys: false, bubble: null, list: null, font };
  }

  // side and wide: the words on the left, the hands in the middle, the buttons in a column on the right
  const colR = d + 2 * EDGE;
  const wordsW = clamp(bw * 0.36, 200, 360 * u);
  const words = { x: left + EDGE, y: top + 6, w: wordsW, h: bottom - 8 - (top + 6) };
  const colX = right - EDGE - d / 2;
  const cy1 = bottom - 10 - d / 2;
  const ctrl = { next: btn(colX, cy1), prev: btn(colX, cy1 - d - gap), menu: btn(colX, cy1 - 2 * (d + gap)) };
  const sx = words.x + words.w + 6;
  const stage = { x: sx, y: top, w: right - colR - sx, h: bh };
  return { w, h, ins, top, bottom, left, right, shape, kind, touch, u, words, wordsMax: words.y + words.h, stage, ctrl, keys: false, bubble: null, list: null, font };
}

/** A mouse on a desktop or a big screen: the words column, the hands centred, the narrator, the walk and the buttons. */
function deskLayout(w: number, h: number, ins: Insets, top: number, left: number, right: number, bottom: number, kind: ScreenKind): Layout {
  const bw = right - left;
  const u = uiScale(w, h, 1.3);
  const font = {
    now: Math.round(15 * u), cap: Math.round(13 * u), name: Math.round(30 * u), text: Math.round(16 * u),
    verse: Math.round(19 * u), small: Math.round(13 * u), bubble: Math.round(15 * u),
  };
  const y0 = top + 12, y1 = bottom - 12;
  const H = y1 - y0;
  const colMin = Math.max(260, 240 * u);
  // the hands' stage: as tall as the band, about as wide as tall (and the figure beside the hands when a hand is laid)
  const sw = Math.min(H * 1.15, bw - 2 * colMin - 4 * EDGE);
  const colW = (bw - sw - 4 * EDGE) / 2;
  const stage = { x: left + EDGE + colW + EDGE, y: top, w: sw, h: bottom - top };
  const cw = Math.min(colW, 420 * u);
  const words = { x: stage.x - EDGE - cw, y: y0, w: cw, h: H };
  const rx = stage.x + stage.w + EDGE, rw = Math.min(colW, 400 * u);
  const r = Math.round(26 * u);
  const d = 2 * r + 6, gap = Math.round(14 * u);
  const capH = Math.round(font.small * 1.5) + 4;
  const cy = y1 - capH - d / 2;
  const btn = (x: number): Btn => ({ x, y: cy, r, hit: { x: x - d / 2, y: cy - d / 2, w: d, h: d + capH } });
  const rowW = 3 * d + 2 * gap;
  const bx0 = rx + (rw - rowW) / 2 + d / 2;
  const ctrl = { menu: btn(bx0), prev: btn(bx0 + d + gap), next: btn(bx0 + 2 * (d + gap)) };
  const bubble = { x: rx, y: y0, w: rw, h: Math.round(font.bubble * 1.45 * 3 + 28 * u) };
  const listY = bubble.y + bubble.h + 14;
  const list = { x: rx, y: listY, w: rw, h: cy - d / 2 - 14 - listY };
  return {
    w, h, ins, top, bottom, left, right, shape: 'desk', kind, touch: false, u, words, wordsMax: words.y + words.h, stage, ctrl, keys: true,
    bubble, list: list.h >= 90 ? list : null, font,
  };
}

// ── the scene inside the stage ───────────────────────────────────

export interface Scene {
  /** the hands' size: a palm from the wrist to the knuckles (px) */
  L: number;
  /** the middle between the hands, and where the wrists sit */
  cx: number;
  wristY: number;
  /** how far the hands lean toward each other at rest (rad): more on an upright phone, where they cradle the light */
  tilt: number;
  /** how far the breath moves each hand (× L) */
  swing: number;
  /** the ball's centre (at rest between the palms) and its largest radius */
  ballY: number;
  R: number;
  /** the soft light above, where a lifted prayer blooms */
  lightX: number;
  lightY: number;
  /** the small figure for a hand laid (figure units → px): its box, and whether it stands above the hands */
  fig: Rect;
  above: boolean;
}

/**
 * The scene for a stage: `lay` (0..1) moves the hands aside and brings the small figure in.  On an upright phone
 * the hands fill the lower part and their forearms run off the bottom, the soft light waits between them and the
 * words; elsewhere the hands are centred under the light.
 */
export function scene(L0: Layout, lay = 0): Scene {
  const S = L0.stage;
  const tall = L0.shape === 'tall';
  const tilt = tall ? 0.18 : 0.08;
  const swing = tall ? 0.1 : 0.16;
  // the hands' height: fingertips to wrists ≈ 1.95 L; across: two hands, the breath and the ball ≈ 3.2–3.7 L (on an
  // upright phone the outer edges of the palms may leave the screen: a close view of your own hands)
  const handsTop = tall ? S.y + 4 : S.y + S.h * 0.2;
  const place = (k: number) => {
    let wristY = tall ? L0.bottom - Math.max(26, (L0.bottom - S.y) * 0.08) : S.y + S.h * 0.95;
    // a phone shows the hands close (the outer palms may leave the screen); a tablet shows them whole
    const Lw = S.w / ((tall ? (S.w > 520 ? 3.8 : 3.15) : 3.7) + 1.3 * k);
    let L = Math.max(22, Math.min((wristY - handsTop) / 1.95, Lw, 250 * L0.u));
    if (tall) {
      // the whole ball stays above the buttons' row (the forearms may run behind it)
      wristY = Math.min(wristY, L0.ctrl.menu.hit.y - 4 + 0.24 * L);
      L = Math.max(22, Math.min((wristY - handsTop) / 1.95, Lw, 250 * L0.u));
    }
    return { wristY, L };
  };
  // a hand laid: on an upright phone with room above the hands, the small figure stands there, over the hands;
  // elsewhere it stands beside them and the hands move aside
  const p0 = place(0);
  const tips0 = p0.wristY - 1.85 * p0.L;
  const room = tips0 - (S.y + 6);
  const above = tall && room >= 130;
  const k = above ? 0 : clamp(lay);
  const { wristY, L } = above ? p0 : place(k);
  const cx = S.x + S.w * (0.5 - 0.14 * k);
  const ballY = wristY - 0.66 * L;
  const R = 0.42 * L;
  const tipsY = wristY - 1.85 * L;
  const lightY = tall ? Math.max(S.y + 18, (S.y + tipsY) / 2) : Math.max(S.y + 40, Math.min(S.y + S.h * 0.12, tipsY - 40));
  let fig: Rect;
  if (above) {
    const figH = Math.min(room - 8, S.h * 0.6);
    const figW = figH * 0.5;
    fig = { x: cx - figW / 2, y: S.y + 6 + (room - figH) / 2, w: figW, h: figH };
  } else {
    const figTop = tall ? Math.max(S.y + 4, tipsY - 10) : S.y + S.h * 0.14;
    const figH = Math.min(S.h * (tall ? 0.62 : 0.7), (ballY + R) - figTop + 10);
    const figW = figH * 0.5;
    const fx = Math.min(S.x + S.w - figW - 6, cx + 2.05 * L);
    fig = { x: fx, y: figTop, w: figW, h: figH };
  }
  return { L, cx, wristY, tilt, swing, ballY, R, lightX: S.x + S.w / 2, lightY, fig, above };
}

// ── the picker and the opening card ──────────────────────────────

/** The picker's card (centred in the band): a title, a grid of chips (the walk), a close button in its corner. */
export function pickerRect(L: Layout, n: number): { box: Rect; chips: Rect[]; close: Rect } {
  const u = L.u;
  const bw = L.right - L.left, bh = L.bottom - L.top;
  const cols = bw >= 700 ? 4 : bw >= 520 ? 4 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));
  const w = Math.min(bw - 24, (cols === 4 ? 640 : 440) * u);
  const head = Math.round(50 * u);
  const gap = 6;
  const want = Math.max(46, Math.round(52 * u));
  const room = bh - 12 - head - 12 - (rows - 1) * gap;
  const ch = Math.max(44, Math.min(want, Math.floor(room / rows)));
  const h = head + rows * ch + (rows - 1) * gap + 12;
  const box = { x: L.left + (bw - w) / 2, y: L.top + Math.max(6, (bh - h) / 2), w, h };
  const cw = (box.w - 20 - (cols - 1) * gap) / cols;
  const chips = Array.from({ length: n }, (_, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    return { x: box.x + 10 + c * (cw + gap), y: box.y + head + r * (ch + gap), w: cw, h: ch };
  });
  const cs = Math.max(44, Math.round(44 * u));
  const close = { x: box.x + box.w - cs - 4, y: box.y + 3, w: cs, h: cs };
  return { box, chips, close };
}

/** The opening card's rectangle for a content height (centred in the band). */
export function storyRect(L: Layout, height: number): Rect {
  const bw = L.right - L.left, bh = L.bottom - L.top;
  const w = Math.min(bw - 24, 520 * L.u);
  const hh = Math.min(height, bh - 16);
  return { x: L.left + (bw - w) / 2, y: L.top + (bh - hh) / 2, w, h: hh };
}

export interface TargetState {
  /** the opening card is up (it takes every tap: the only target) */
  story: Rect | null;
  /** the picker is open, with this many entries */
  picker: number | null;
  /** the small figure takes a tap (a hand to be laid) */
  fig: Rect | null;
}

/** Every control the player can tap now, as `hitTest` tests them. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  if (s.picker !== null) {
    const P = pickerRect(L, s.picker);
    return [...P.chips.map((r, i) => ({ label: `pick${i + 1}`, ...r })), { label: 'close', ...P.close }];
  }
  const out: TapTarget[] = CTRLS.map(c => ({ label: c, ...L.ctrl[c].hit }));
  if (s.fig) out.push({ label: 'figure', ...s.fig });
  return out;
}

export type Hit =
  | { kind: 'story' } | { kind: 'ctrl'; id: CtrlId } | { kind: 'pick'; i: number } | { kind: 'close' } | { kind: 'outside' }
  | { kind: 'figure'; x: number; y: number } | { kind: 'field'; x: number; y: number };

export const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** What a tap at (x, y) lands on. */
export function hitTest(L: Layout, s: TargetState, x: number, y: number): Hit {
  if (s.story) return { kind: 'story' };
  if (s.picker !== null) {
    const P = pickerRect(L, s.picker);
    if (inside(P.close, x, y)) return { kind: 'close' };
    const i = P.chips.findIndex(r => inside(r, x, y));
    if (i >= 0) return { kind: 'pick', i };
    return inside(P.box, x, y) ? { kind: 'field', x, y } : { kind: 'outside' };
  }
  for (const c of CTRLS) if (inside(L.ctrl[c].hit, x, y)) return { kind: 'ctrl', id: c };
  if (s.fig && inside(s.fig, x, y)) return { kind: 'figure', x, y };
  return { kind: 'field', x, y };
}
