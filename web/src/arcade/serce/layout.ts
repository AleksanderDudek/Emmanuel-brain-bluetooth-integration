/**
 * Z głowy do serca's layout, pure (DESIGN.md §12, §14): where the "now" line, the picture, the words card and the
 * story card go on every screen, and the camera that fits the way's current framing into the picture.
 *
 *   tall   a phone upright (and a tablet): the "now" line under the HUD, the picture, the words card at the bottom
 *          (in the thumb zone: a tap anywhere stays with the words)
 *   side   a phone on its side: the words card a column on the left, the picture on the right
 *   desk   a desktop: the picture wide, the blessings and verses in a column on the right
 *
 * World units are the figure's (H = 1 from the crown to the soles), with the heart at the origin; the Earth's limb
 * runs under the figure's feet.  The camera eases between framings (rules.ts `cameraTau`); with reduced motion it cuts.
 */
import { PLACE } from '../kit/figure';
import { clamp } from '../kit/juice';
import { MIN_READ, MIN_TAP, screenKind, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export type LayoutKind = 'tall' | 'side' | 'desk';

export interface Layout {
  w: number;
  h: number;
  kind: LayoutKind;
  ui: number;
  touch: boolean;
  ins: Insets;
  /** the "now" line */
  now: Rect;
  /** the picture: the camera fits its framing into it (the scene itself fills the canvas) */
  pic: Rect;
  /** the words card (the heart word, the blessing, the verse) */
  card: Rect;
  /** the largest a story card may be */
  story: Rect;
  /** font sizes (CSS px): the "now" line, the card's header, its main line, its verse's largest, small labels */
  fs: { now: number; head: number; main: number; verse: number; label: number; caption: number };
}

/** The heart's place in figure units (the world's origin), and the soles. */
export const HEART_Y = PLACE.heart[1];
export const SOLES = 1 - HEART_Y;
/** The Earth: its centre (world units) and radius; its limb touches the soles. */
export const EARTH = { cx: 0, cy: SOLES + RULES.earthR, r: RULES.earthR } as const;

export function layout(w: number, h: number, ins: Insets, touch: boolean): Layout {
  const ui = uiScale(w, h);
  const sk = screenKind(w, h, touch);
  const kind: LayoutKind = sk === 'phone-side' ? 'side' : sk === 'desktop' || sk === 'big' || (sk === 'tablet' && w > h * 1.15) ? 'desk' : 'tall';
  const top = ins.top, bottom = h - ins.bottom, left = ins.left, right = w - ins.right;
  const pad = Math.round(8 * ui);
  const fs = {
    now: Math.max(MIN_READ, Math.round(14 * ui)),
    head: Math.max(12, Math.round(12.5 * ui)),
    main: Math.round(18 * ui),
    verse: Math.round(17 * ui),
    label: Math.max(11, Math.round(12 * ui)),
    caption: Math.max(MIN_READ, Math.round(15 * ui)),
  };
  const nowH = Math.round(fs.now * 1.9);
  let now: Rect, pic: Rect, card: Rect;
  if (kind === 'tall') {
    const avail = bottom - top;
    const cardH = Math.round(clamp(avail * 0.31, 118, 230 * ui));
    now = { x: left + pad, y: top + 6, w: right - left - 2 * pad, h: nowH };
    card = { x: left + pad, y: bottom - pad - cardH, w: right - left - 2 * pad, h: cardH };
    pic = { x: left, y: now.y + now.h + 4, w: right - left, h: Math.max(60, card.y - 6 - (now.y + now.h + 4)) };
  } else if (kind === 'side') {
    const cw = Math.round(clamp((right - left) * 0.38, 220, 320));
    card = { x: left + pad, y: top + pad, w: cw, h: bottom - top - 2 * pad };
    now = { x: card.x + cw + pad, y: top + 4, w: right - (card.x + cw) - 2 * pad, h: nowH };
    pic = { x: card.x + cw + 4, y: now.y + now.h, w: right - (card.x + cw) - 4, h: bottom - (now.y + now.h) };
  } else {
    const cw = Math.round(clamp((right - left) * 0.3, 300, 480 * Math.min(ui, 1.6)));
    card = { x: right - pad * 2 - cw, y: top + pad * 2, w: cw, h: bottom - top - pad * 4 };
    now = { x: left + pad * 2, y: top + pad, w: card.x - left - pad * 4, h: nowH };
    pic = { x: left, y: now.y + now.h + 4, w: card.x - left - pad, h: bottom - (now.y + now.h + 4) };
  }
  const sw = Math.min(right - left - 2 * pad, Math.round(460 * Math.min(ui, 1.5)));
  const sh = Math.min(bottom - top - 2 * pad, Math.round(520 * Math.min(ui, 1.5)));
  const story: Rect = { x: (left + right) / 2 - sw / 2, y: top + (bottom - top) / 2 - sh / 2, w: sw, h: sh };
  return { w, h, kind, ui, touch, ins, now, pic, card, story, fs };
}

/** The story card's hit area (the whole card: a tap turns its page). */
export function storyTarget(r: Rect): TapTarget {
  return { label: 'story', x: r.x, y: r.y, w: Math.max(MIN_TAP, r.w), h: Math.max(MIN_TAP, r.h) };
}

// ── the camera ──────────────────────────────────────────────────

/** The framings the way uses: the head and chest, the whole figure in its field, a ring, the world, home. */
export type Framing = 'body' | 'figure' | 'ring1' | 'ring2' | 'ring3' | 'ring4' | 'world' | 'home';

/** A framing as a world box to fit: its centre and half-extents. */
export function frameBox(f: Framing): { cx: number; cy: number; hx: number; hy: number } {
  const R = RULES.ringR;
  switch (f) {
    case 'body': return { cx: 0, cy: 0.06, hx: 0.3, hy: 0.4 };
    case 'figure': return { cx: 0, cy: 0.06, hx: R[0] * 1.08, hy: R[0] * 1.08 };
    case 'ring1': case 'ring2': case 'ring3': case 'ring4': {
      const r = R[Number(f[4])] * 1.1;
      return { cx: 0, cy: 0, hx: r, hy: r };
    }
    case 'home': return { cx: 0, cy: 0, hx: R[2] * 1.1, hy: R[2] * 1.1 };
    case 'world': {
      const top = -R[4] * 1.08, bot = EARTH.cy + EARTH.r * 1.07;
      return { cx: 0, cy: (top + bot) / 2, hx: EARTH.r * 1.12, hy: (bot - top) / 2 };
    }
  }
}

export interface Camera { x: number; y: number; s: number }

/** The camera that fits a framing into the picture. */
export function cameraFor(L: Layout, f: Framing): Camera {
  const b = frameBox(f);
  const s = Math.min(L.pic.w / (2 * b.hx), L.pic.h / (2 * b.hy));
  return { x: b.cx, y: b.cy, s };
}

/** Ease the camera toward a target: position linear, scale in log space (a zoom feels even), `k` 0..1 this frame. */
export function easeCam(c: Camera, to: Camera, k: number): Camera {
  const ls = Math.log(c.s) + (Math.log(to.s) - Math.log(c.s)) * k;
  return { x: c.x + (to.x - c.x) * k, y: c.y + (to.y - c.y) * k, s: Math.exp(ls) };
}

/** A world point on screen. */
export function toScreen(L: Layout, c: Camera, x: number, y: number): { x: number; y: number } {
  return { x: L.pic.x + L.pic.w / 2 + (x - c.x) * c.s, y: L.pic.y + L.pic.h / 2 + (y - c.y) * c.s };
}
