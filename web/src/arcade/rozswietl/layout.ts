/**
 * Where Rozświetl's play view puts things (CSS px), phone first (DESIGN §12, §13.7).  The runner's HUD
 * covers the top of the canvas (`insets().top`), a phone's home indicator its bottom, a notch the sides.
 * The picture is everything: it takes the whole band under the HUD in its own proportions (a phone upright
 * gets a near-square picture, a phone on its side or a desktop a wide one), framed by a dark wall whose
 * light glows around it; nothing to press sits in the outer 16 px of a phone's sides.
 *
 *   phone  upright: the frame 16 px in from the sides, the firefly at its lower left corner (over the
 *          picture), its bubble above it across the frame; the cards in the frame's lower part
 *   side   a phone on its side: the same, the frame wide and low
 *   wide   a tablet or a desktop: the frame grown (u up to 1.3), the firefly in the wall beside the
 *          frame when there is room
 *
 * The tiles themselves are the controls (a tap aims and knocks, a drag moves the light), so the play has
 * no buttons: `targets()` lists only a card while one waits for a tap.  Pure (tests run it at every
 * kit/mobile CHECK_SIZES entry).
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, uiScale } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export interface Rect { x: number; y: number; w: number; h: number }

export type Shape = 'phone' | 'side' | 'wide';

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  /** the play band: under the HUD, over the home indicator, inside a notch */
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape: Shape;
  touch: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** the room the frame may take (the band less its margins) */
  room: Rect;
  /** the aspect the next picture gets (the room's, kept inside RULES.aspect) */
  aspect: number;
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 0, h * 0.6);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const side = h < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w < 600 ? 'phone' : 'wide';
  const u = shape === 'wide' ? uiScale(w, h) : 1;
  // nothing to press in the outer 16 px of a phone's sides (Safari's back swipe); a little air under the HUD
  const mx = shape === 'wide' ? Math.round(22 * u) : 16;
  const mt = shape === 'side' ? 6 : Math.round(8 * u), mb = shape === 'side' ? 6 : Math.round(10 * u);
  const room = { x: left + mx, y: top + mt, w: Math.max(40, right - left - 2 * mx), h: Math.max(40, bottom - top - mt - mb) };
  const aspect = clamp(room.w / room.h, RULES.aspect[0], RULES.aspect[1]);
  return { w, h, ins, top, bottom, left, right, shape, touch, u, room, aspect };
}

/** The picture's frame for a picture of `aspect` (w / h): as large as fits the room, centred. */
export function frameFor(L: Layout, aspect: number): Rect {
  const a = clamp(aspect, RULES.aspect[0], RULES.aspect[1]);
  const r = L.room;
  let fw = r.w, fh = fw / a;
  if (fh > r.h) {
    fh = r.h;
    fw = fh * a;
  }
  return { x: Math.round(r.x + (r.w - fw) / 2), y: Math.round(r.y + (r.h - fh) / 2), w: Math.round(fw), h: Math.round(fh) };
}

/** The firefly's home (its centre) and how far its bubble may reach. */
export function flySpot(L: Layout, f: Rect): { x: number; y: number; r: number; outside: boolean; bubbleW: number } {
  const r = 9 * L.u;
  const gap = f.x - L.left;
  if (L.shape === 'wide' && gap >= 120 * L.u) {
    // in the wall beside the frame's lower left corner
    return { x: f.x - gap * 0.45, y: f.y + f.h - 46 * L.u, r, outside: true, bubbleW: Math.min(340 * L.u, f.w * 0.6) };
  }
  return { x: f.x + 22 * L.u, y: f.y + f.h - 22 * L.u, r, outside: false, bubbleW: Math.min(320 * L.u, f.w - 20) };
}

/** A picture's card (transformed: title and verse) over the frame's lower part; the opening card fills the frame. */
export function cardBox(L: Layout, f: Rect, kind: 'open' | 'done'): Rect {
  const pad = L.shape === 'side' ? 6 : 10;
  if (kind === 'open') return { x: f.x + pad, y: f.y + pad, w: f.w - 2 * pad, h: f.h - 2 * pad };
  const w = Math.min(f.w - 2 * pad, 520 * L.u);
  const h = Math.min(f.h - 2 * pad, Math.max(L.shape === 'side' ? 150 : 190, f.h * (L.shape === 'side' ? 0.8 : 0.58)));
  return { x: f.x + (f.w - w) / 2, y: f.y + f.h - pad - h, w, h };
}

/** The controls a finger can tap now: only a card waiting for its tap (the tiles are the free play area). */
export function tapTargets(card: Rect | null): TapTarget[] {
  if (!card) return [];
  const w = Math.max(MIN_TAP, card.w), h = Math.max(MIN_TAP, card.h);
  return [{ label: 'card', x: card.x, y: card.y, w, h }];
}
