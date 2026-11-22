/**
 * Rzeka Ezechiela's layout (pure, tested at every CHECK_SIZES entry): where the valley, the figure, the words band,
 * the ≡ button, the place chooser and the story card go, for three shapes —
 *
 *   tall   a phone upright (and a tablet upright): the figure tall in the middle, the river at its feet, the banks
 *          and their trees at the sides; the words band below the picture; ≡ in the thumb zone at the picture's
 *          bottom right
 *   side   a phone on its side: the picture on the left, the words in a column on the right
 *   desk   a desktop and a big screen (and a tablet on its side): the wide valley with trees on both banks, the
 *          figure a little left of the middle, the words in a side column at a reading measure
 *
 * Everything the player reads or taps stays inside the insets (below the runner's HUD band); the scene itself runs
 * under them.  Text never under 13 px where it is read (11 for a verse's reference, the kit's).
 */
import { FIG_HALF } from '../kit/figure';
import { MIN_READ, MIN_TAP, NO_INSETS, screenKind, target, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { BODY_PLACES, PLACES, nearestPlace, type PlaceId } from './content';

export type Shape = 'tall' | 'side' | 'desk';

export interface Layout {
  w: number;
  h: number;
  ins: Insets;
  touch: boolean;
  /** the UI scale (1 on a phone, up to the kit's DESK_MAX on a big screen) */
  u: number;
  shape: Shape;
  desk: boolean;
  /** the safe play area: inside the insets, with a margin */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** the picture's own area (the figure, the river around it) */
  stage: Rect;
  /** the figure: its midline, its crown, its height (1 figure unit) */
  fig: { cx: number; top: number; H: number };
  /** the horizon (screen y) */
  horizon: number;
  /** the words band */
  band: Rect;
  /** the ≡ button (the place chooser) */
  list: Rect;
  font: { label: number; now: number; prayer: number; verse: number; small: number; title: number; chip: number };
  /** the band's inner padding */
  pad: number;
}

/** The ≡ button's side (px at a UI scale of 1). */
export const BTN = 48;

export function layout(w: number, h: number, ins: Insets = NO_INSETS, touch = true): Layout {
  const kind = screenKind(w, h, touch);
  const desk = kind === 'desktop' || kind === 'big';
  const u = uiScale(w, h);
  const shape: Shape = h >= w ? 'tall' : kind === 'phone-side' ? 'side' : 'desk';
  const top = ins.top + 4 * u, bottom = h - ins.bottom - 6 * u;
  const left = ins.left + 8 * u, right = w - ins.right - 8 * u;
  const font = {
    label: Math.max(MIN_READ, 13 * u), now: Math.max(MIN_READ, 14 * u), prayer: Math.max(15, 16 * u), verse: Math.max(MIN_READ, 16 * u),
    small: Math.max(12, 12 * u), title: Math.max(17, 18 * u), chip: Math.max(MIN_READ, 14 * u),
  };
  const btn = BTN * u, pad = 10 * u;
  let stage: Rect, band: Rect;
  if (shape === 'tall') {
    const avail = bottom - top;
    const bandH = Math.round(Math.max(118, Math.min(avail * 0.34, 220 * u)));
    band = { x: left, y: bottom - bandH, w: right - left, h: bandH };
    stage = { x: left, y: top, w: right - left, h: band.y - 6 * u - top };
  } else {
    const measure = shape === 'side' ? Math.min(380, Math.max(220, (right - left) * 0.42)) : Math.min((right - left) * 0.36, Math.max(300, 19 * font.prayer));
    band = { x: right - measure, y: top, w: measure, h: bottom - top };
    stage = { x: left, y: top, w: band.x - 12 * u - left, h: bottom - top };
  }
  // the figure: as tall as the stage allows (the river's foreground below its feet, the crown in the stage), and
  // narrow enough that both hands and the ≡ button stay clear of each other
  const fitH = stage.h * (shape === 'desk' ? 0.86 : 0.88);
  const fitW = (stage.w - 2 * btn - 16 * u) / (2 * FIG_HALF);
  // beside a column of words the valley must stay wide enough for a tree on each bank (a near-square stage on a Full
  // HD monitor's middle column would otherwise fill with the figure alone)
  const fitWide = shape === 'tall' ? Infinity : stage.w / 1.6;
  const H = Math.max(60, Math.min(fitH, fitW, fitWide));
  const cx = shape === 'desk' ? stage.x + stage.w * 0.5 : stage.x + stage.w / 2;
  // room above the crown for the float's lift (the figure rises a little on the river at the end)
  const figTop = stage.y + Math.max(4 * u + 0.07 * H, (stage.h - H) * 0.32);
  const fig = { cx, top: figTop, H };
  const list = { x: stage.x + stage.w - btn, y: stage.y + stage.h - btn, w: btn, h: btn };
  return {
    w, h, ins, touch, u, shape, desk, top, bottom, left, right, stage, fig, horizon: figTop + 0.22 * H, band, list, font, pad,
  };
}

/** A figure point (figure units) on the screen, the figure lifted by `lift` figure units (floating). */
export function figPt(L: Layout, x: number, y: number, lift = 0): { x: number; y: number } {
  return { x: L.fig.cx + x * L.fig.H, y: L.fig.top + (y - lift) * L.fig.H };
}

/** A screen point in figure units (the figure lifted by `lift`). */
export function toFig(L: Layout, x: number, y: number, lift = 0): { x: number; y: number } {
  return { x: (x - L.fig.cx) / L.fig.H, y: (y - L.fig.top) / L.fig.H + lift };
}

/** The figure's box on the screen (the tap target for choosing a place). */
export function figRect(L: Layout, lift = 0): Rect {
  const H = L.fig.H;
  return { x: L.fig.cx - FIG_HALF * H, y: L.fig.top - (0.01 + lift) * H, w: 2 * FIG_HALF * H, h: 1.02 * H };
}

// ── the place chooser and the story card ─────────────────────────

/** The chooser's card and its parts: a title, nine chips in three rows, a note, a close button. */
export interface Picker { card: Rect; chips: { place: PlaceId; r: Rect }[]; close: Rect; titleY: number; noteY: number }

export function pickerRect(L: Layout): Picker {
  const u = L.u, gap = 8 * u, chipH = Math.max(MIN_TAP, 46 * u);
  const w = Math.min(L.right - L.left, 420 * u);
  const head = 52 * u, foot = 30 * u;
  const h = head + 3 * chipH + 2 * gap + foot + 12 * u;
  const x = (L.left + L.right) / 2 - w / 2;
  const y = Math.max(L.top, (L.top + L.bottom) / 2 - h / 2);
  const inner = w - 24 * u, cw = (inner - 2 * gap) / 3;
  const chips = PLACES.map((place, i) => ({
    place, r: { x: x + 12 * u + (i % 3) * (cw + gap), y: y + head + Math.floor(i / 3) * (chipH + gap), w: cw, h: chipH },
  }));
  const close = { x: x + w - MIN_TAP - 4 * u, y: y + 2 * u, w: MIN_TAP, h: MIN_TAP };
  return { card: { x, y, w, h }, chips, close, titleY: y + 24 * u, noteY: y + h - foot / 2 - 4 * u };
}

/** The story card: centred over the play area, as tall as its text needs (`contentH`). */
export function storyRect(L: Layout, contentH: number): Rect {
  const u = L.u;
  const w = Math.min(L.right - L.left, 460 * u);
  const h = Math.min(L.bottom - L.top, contentH + 32 * u);
  return { x: (L.left + L.right) / 2 - w / 2, y: Math.max(L.top, (L.top + L.bottom) / 2 - h / 2), w, h };
}

/** What the player can tap now (the mobile audit, the tests): a story card, the chooser's parts, or ≡ and the figure. */
export function tapTargets(L: Layout, s: { story: Rect | null; picker: boolean; lift?: number }): TapTarget[] {
  if (s.story) return [target('story', s.story)];
  if (s.picker) {
    const P = pickerRect(L);
    return [...P.chips.map(c => target(`place:${c.place}`, c.r)), target('close', P.close)];
  }
  return [target('≡', L.list), target('figure', figRect(L, s.lift ?? 0))];
}

export type Hit = 'list' | 'close' | 'story' | 'outside' | `chip:${PlaceId}` | `figure:${PlaceId}` | 'figure' | null;

const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** What a tap at (x, y) lands on. */
export function hitTest(L: Layout, s: { story: Rect | null; picker: boolean; lift?: number }, x: number, y: number): Hit {
  if (s.story) return inside(s.story, x, y) ? 'story' : 'outside';
  if (s.picker) {
    const P = pickerRect(L);
    if (inside(P.close, x, y)) return 'close';
    for (const c of P.chips) if (inside(c.r, x, y)) return `chip:${c.place}`;
    return inside(P.card, x, y) ? null : 'outside';
  }
  const g = target('≡', L.list);
  if (inside(g, x, y)) return 'list';
  if (inside(figRect(L, s.lift ?? 0), x, y)) {
    const f = toFig(L, x, y, s.lift ?? 0);
    const p = nearestPlace(f.x, f.y, 0.1);
    return p && BODY_PLACES.includes(p) ? `figure:${p}` : 'figure';
  }
  return null;
}
