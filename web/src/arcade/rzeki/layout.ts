/**
 * Where Rzeki żywej wody's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12, §13.14).
 * The runner's HUD covers the canvas top (`insets().top`), the home indicator its bottom, a notch the sides;
 * the sky runs under all of them, the game's own bits stay inside.  One layout in three shapes:
 *
 *   tall   anything upright, the reference being a phone held upright (360 × 500 with a 134 px HUD band): the
 *          figure tall in the middle, the prayer in the band below it (the eye goes from the station down to its
 *          words); a tablet upright is the same, grown (u ≤ 1.3)
 *   side   a phone on its side (one 68 px HUD row): the figure on the left, the caption and the prayer on the right
 *   wide   a tablet on its side: the side layout grown, the prayer column capped to read well
 *          — and a desktop or a big screen with a mouse (`desk`, kit/mobile `screenKind`, DESIGN §14): the figure
 *          as tall as the band allows, and the words in a column beside it at a reading measure, the figure and
 *          its words centred as one group; the words stand at the height of the station the light is at
 *          (`wordsAt`), so the eye goes straight across from the window to its prayer
 *
 * The figure is drawn in its own units: a point (fx, fy) is (cx + fx·H, top + fy·H) — the "world" of the body
 * framing.  A **camera** (`Cam`) moves that world on the screen: the stations above the head and the two shells
 * need room above it (the sky and the heavens), the hand map needs the hands near, the feet and the earth star the
 * ground; each station names its framing (content.ts) and the camera fits it into the stage, the band the figure
 * owns.  The view eases between framings; text is always drawn in screen space.
 *
 * A tap anywhere stays with the station, so the only target is the station's own circle (≥ 44 px) — or the story
 * card while one is up.  Everything here is pure: the tests run it at every kit/mobile CHECK_SIZES entry.
 */
import { clamp, ease } from '../kit/juice';
import { MIN_TAP, NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { STATION, type Framing, type StationId } from './content';
import { stationPts, type P } from './figure';

export interface Rect { x: number; y: number; w: number; h: number }

export type Shape = 'tall' | 'side' | 'wide';

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
  /** the kind of screen (kit/mobile `screenKind`) */
  kind: ScreenKind;
  /** a desktop or a big screen with a mouse: the figure fills the band, the words stand beside it at the station's height */
  desk: boolean;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop, up to DESK_MAX on a big screen */
  u: number;
  /** the figure in the body framing: its midline, its crown's y, its height (px) */
  fig: { cx: number; top: number; H: number };
  /** the band the figure owns: the camera fits a framing into it */
  stage: Rect;
  /** the narrator's caption (passive) */
  caption: Rect;
  /** the prayer's band */
  prayer: Rect;
  /** the story card's box */
  story: Rect;
  /** text sizes (px, never under the kit's floor) */
  font: { label: number; prayer: number; prayerMin: number; caption: number; verse: number; small: number };
}

/** The screen point of a figure point (in the body framing). */
export const figPt = (L: Pick<Layout, 'fig'>, fx: number, fy: number): { x: number; y: number } =>
  ({ x: L.fig.cx + fx * L.fig.H, y: L.fig.top + fy * L.fig.H });

/** A station's anchor in the body framing (its midline point, or the middle of a twin pair's). */
export const stationXY = (L: Pick<Layout, 'fig'>, s: StationId): { x: number; y: number } => figPt(L, STATION[s].x, STATION[s].y);

/** The radius of the current station's window at a fill (it grows as it opens), in the body framing. */
export const windowR = (L: Pick<Layout, 'fig'>, fill: number, s?: StationId): number =>
  L.fig.H * (0.055 + 0.05 * ease.outCubic(clamp(fill))) * (s ? STATION[s].size : 1);
/** The radius of a lit station's small window, and of a station still waiting. */
export const litR = (L: Pick<Layout, 'fig'>): number => L.fig.H * 0.026;
export const idleR = (L: Pick<Layout, 'fig'>): number => Math.max(2.5, L.fig.H * 0.012);
/** The biggest window radius (the layers are baked at it). */
export const maxWindowR = (L: Pick<Layout, 'fig'>): number => windowR(L, 1);

export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true): Layout {
  const ins = { ...insets };
  const top = clamp(ins.top || 64, 24, h * 0.6);
  ins.top = top;
  const left = Math.max(0, ins.left), right = w - Math.max(0, ins.right), bottom = h - Math.max(0, ins.bottom);
  const bw = right - left, bh = bottom - top;
  const side = h < 470 && w > h * 1.3;
  const shape: Shape = side ? 'side' : w > h ? 'wide' : 'tall';
  const kind = screenKind(w, h, touch);
  const desk = shape === 'wide' && (kind === 'desktop' || kind === 'big');
  const u = shape === 'side' ? 1 : uiScale(w, h, 1.3);
  const edge = 16;
  const font = desk
    // a desktop reads from further away than a phone: the prayer a little larger than the rest grown with the screen
    ? {
      label: Math.round(14 * u), prayer: Math.round(18.5 * u), prayerMin: Math.max(15, Math.round(15 * u)), caption: Math.round(14.5 * u),
      verse: Math.round(16.5 * u), small: Math.round(12.5 * u),
    }
    : {
      label: Math.round(13 * u), prayer: Math.round(17 * u), prayerMin: 15, caption: Math.max(13, Math.round(13.5 * u)),
      verse: Math.round(15 * u), small: Math.max(11, Math.round(12 * u)),
    };

  if (shape === 'tall') {
    // the narrator speaks in the prayer band's top row here (a caption above the figure would cover the crown)
    const prH = Math.round(clamp(bh * 0.27, 100, 170 * u));
    const prayer = { x: left + edge, y: bottom - prH - 8, w: bw - 2 * edge, h: prH };
    const caption = { x: prayer.x, y: prayer.y, w: prayer.w, h: Math.round(20 * u) * 2 };
    const yB = prayer.y - 6;
    // the crown's window sits just above the head and opens there (0.125 H of room: it never slips under the
    // HUD), the feet stand at H, the pool lies below them
    const H = Math.max(120, Math.min((yB - top - 4) / 1.185, (bw - 2 * edge) / 0.5));
    const fig = { cx: (left + right) / 2, top: top + 4 + 0.125 * H + Math.max(0, (yB - top - 4 - 1.185 * H) / 2), H };
    const stage = { x: left + edge, y: top + 4, w: bw - 2 * edge, h: yB - top - 4 };
    return { w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, fig, stage, caption, prayer, story: { x: left + edge, y: top + 8, w: bw - 2 * edge, h: bh - 16 }, font };
  }

  if (desk) {
    // the figure as tall as the band allows: on a big screen room above the head for the crown's open window
    // (it never slips under the bar), a little less on a desktop under the top HUD (its middle is free there);
    // the pool and the rivers' near ends lie under the feet (to 1.06 H)
    const head = kind === 'big' ? 0.13 : 0.075, foot = 1.06;
    const H = Math.max(120, Math.min((bh - 16) / (head + foot), bw * 0.62));
    // the words beside it at a reading measure (about 34 characters of the prayer a line), the figure's egg of
    // light (± 0.34 H) and the column centred as one group: the figure left of the middle, the words right of it
    const egg = 0.34 * H, gap = Math.round(36 * u);
    const colW = Math.round(Math.max(240, Math.min(17 * font.prayer, bw - 2 * edge - 2 * egg - gap)));
    const x0 = left + Math.max(edge, (bw - (2 * egg + gap + colW)) / 2);
    const cx = x0 + egg;
    const fig = { cx, top: top + 8 + head * H + Math.max(0, (bh - 16 - (head + foot) * H) / 2), H };
    const colX = Math.min(right - edge - colW, cx + egg + gap);
    const prH = Math.round(clamp(9.5 * font.prayer, 160, bh * 0.5));
    const capH = Math.round(font.caption * 1.35) * 2 + 8;
    // centred on the chest until the view moves it to the station's height (wordsAt)
    const prayer = { x: colX, y: 0, w: colW, h: prH };
    const caption = { x: colX, y: 0, w: colW, h: capH };
    const storyW = Math.min(bw - 2 * edge, 560 * u);
    const stage = { x: Math.max(left, cx - egg - gap / 2), y: top + 8, w: 2 * egg + gap, h: bh - 16 };
    const base: Layout = {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, fig, stage, caption, prayer,
      story: { x: (left + right - storyW) / 2, y: top + 8, w: storyW, h: bh - 16 }, font,
    };
    return wordsAt(base, fig.top + 0.3 * H);
  }

  // side and wide: the figure on the left, the caption and the prayer on the right
  const H = Math.max(120, Math.min((bh - 14) / 1.1, bw * 0.62));
  // the egg of light (±0.33 H) fits beside the left edge; on a big screen the figure stands in the left third
  const cx = left + (shape === 'side' ? edge + 0.36 * H : Math.max(edge + 0.36 * H, bw * 0.3));
  const fig = { cx, top: top + 8 + 0.03 * H + Math.max(0, (bh - 14 - 1.1 * H) / 2), H };
  const colX = cx + 0.3 * H + 14;
  const colW = Math.min(right - edge - colX, (shape === 'side' ? 420 : 600) * u);
  const x0 = colX + Math.max(0, (right - edge - colX - colW) / 2);
  const prH = Math.round(clamp(bh * 0.46, 110, 240 * u));
  const capH = Math.round(20 * u) * 2 + 6;
  const prayer = { x: x0, y: top + Math.max(capH + 14, (bh - prH) / 2 + capH * 0.4), w: colW, h: prH };
  if (prayer.y + prayer.h > bottom - 8) prayer.y = Math.max(top + capH + 10, bottom - 8 - prayer.h);
  const caption = { x: x0, y: prayer.y - capH - 6, w: colW, h: capH };
  const storyW = Math.min(bw - 2 * edge, 560 * u);
  const sx = Math.max(left, cx - 0.36 * H);
  const stage = { x: sx, y: top + 8, w: Math.max(40, Math.min(colX - 8, cx + 0.36 * H) - sx), h: bh - 16 };
  return {
    w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, fig, stage, caption, prayer,
    story: { x: (left + right - storyW) / 2, y: top + 8, w: storyW, h: bh - 16 }, font,
  };
}

/**
 * A desk layout's words — the narrator's caption over the prayer's band — standing at the height `y` (the
 * station the light is at, or the stream on its way), kept whole inside the band.  Other layouts as they are.
 */
export function wordsAt(L: Layout, y: number): Layout {
  if (!L.desk) return L;
  const capH = L.caption.h, gap = 6;
  // the band's words start at its top here (hud.ts): its first row — the station's name — level with the station
  const lo = L.top + 8 + capH + gap, hi = L.bottom - 8 - L.prayer.h;
  const py = clamp(y - labelRowH(L) / 2, lo, Math.max(lo, hi));
  return { ...L, caption: { ...L.caption, y: py - gap - capH }, prayer: { ...L.prayer, y: py } };
}

/** The height of the prayer band's first row (the label: the station's name), as hud.ts draws it. */
export const labelRowH = (L: Pick<Layout, 'font'>): number => Math.round(Math.max(13, L.font.label) * 1.5);

/** The story card's rectangle for a content height (centred in its box). */
export function storyRect(L: Layout, height: number): Rect {
  const h = Math.min(height, L.story.h);
  return { x: L.story.x, y: L.story.y + (L.story.h - h) / 2, w: L.story.w, h };
}

// ── the camera ────────────────────────────────────────────────────

/** The camera: the world (the body framing's coordinates) to the screen, screen = world × s + (ox, oy). */
export interface Cam { s: number; ox: number; oy: number }
export const NO_CAM: Cam = { s: 1, ox: 0, oy: 0 };

/**
 * What each framing shows, in figure units (with room for the windows open in full): the sky above the head for
 * the soul and solar stars, the whole egg for the two shells, the hands near for the hand map, the ground for the
 * feet and the earth star.  The body framing is the layout itself.
 */
export const FRAMES: Readonly<Record<Exclude<Framing, 'body'>, { x0: number; x1: number; y0: number; y1: number }>> = {
  sky: { x0: -0.4, x1: 0.4, y0: -0.47, y1: 1.08 },
  heavens: { x0: -0.56, x1: 0.56, y0: -0.665, y1: 1.33 },
  hands: { x0: -0.225, x1: 0.225, y0: 0.43, y1: 0.65 },
  ground: { x0: -0.24, x1: 0.24, y0: 0.82, y1: 1.18 },
};
/** The camera's zoom limits (the smallest phone's hand map nears to 2.7×; the heavens shrink to half at most). */
export const CAM_MIN = 0.45;
export const CAM_MAX = 2.7;
/**
 * How near a framing needs to come, in px on the screen, for what it shows to read: a hand 75 px tall (its seven
 * lights apart), the feet and the earth star's window 60 px.  A big screen already shows them so: it does not zoom.
 */
const NEED: Partial<Record<Framing, { px: number; size: number }>> = { hands: { px: 75, size: 0.1 }, ground: { px: 60, size: 0.1 } };

/**
 * The camera for a framing in a layout: the framing's world rectangle fitted into the stage, no nearer than the
 * screen needs — zoomed about the framing's middle (the figure's midline kept where it is, so the words beside it
 * stay clear) and moved no further than it takes to bring the whole framing inside the stage.
 */
export function cameraFor(L: Layout, f: Framing): Cam {
  if (f === 'body') return NO_CAM;
  const r = FRAMES[f], H = L.fig.H, S = L.stage;
  const x0 = L.fig.cx + r.x0 * H, x1 = L.fig.cx + r.x1 * H, y0 = L.fig.top + r.y0 * H, y1 = L.fig.top + r.y1 * H;
  // the midline stays put, so the framing's half-width must fit on the narrower side of the stage around it
  const halfW = Math.max(1, Math.min(L.fig.cx - S.x, S.x + S.w - L.fig.cx));
  const need = NEED[f];
  const most = need ? Math.max(1, need.px / (need.size * H)) : CAM_MAX;
  const s = clamp(Math.min(halfW / ((x1 - x0) / 2), S.h / (y1 - y0), most), CAM_MIN, CAM_MAX);
  // zoom about the framing's middle, then the least move that brings it whole into the stage
  const pivot = (y0 + y1) / 2;
  const lo = S.y - y0 * s, hi = S.y + S.h - y1 * s;
  const oy = lo <= hi ? clamp(pivot * (1 - s), lo, hi) : S.y + S.h / 2 - pivot * s;
  return { s, ox: L.fig.cx * (1 - s), oy };
}

/** Ease a camera toward another (the world point at the stage's centre moves, the zoom changes in log space). */
export function easeCam(L: Layout, from: Cam, to: Cam, k: number): Cam {
  const cx = L.stage.x + L.stage.w / 2, cy = L.stage.y + L.stage.h / 2;
  const wa = { x: (cx - from.ox) / from.s, y: (cy - from.oy) / from.s };
  const wb = { x: (cx - to.ox) / to.s, y: (cy - to.oy) / to.s };
  const s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * k);
  const wx = wa.x + (wb.x - wa.x) * k, wy = wa.y + (wb.y - wa.y) * k;
  return { s, ox: cx - wx * s, oy: cy - wy * s };
}

export const toScreen = (c: Cam, x: number, y: number): { x: number; y: number } => ({ x: x * c.s + c.ox, y: y * c.s + c.oy });
export const toWorld = (c: Cam, x: number, y: number): { x: number; y: number } => ({ x: (x - c.ox) / c.s, y: (y - c.oy) / c.s });

/** The framing a station is looked at in. */
export const framingOf = (s: StationId): Framing => STATION[s].frame;

// ── the targets ───────────────────────────────────────────────────

/**
 * The current station's tap area as a target (≥ 44 px), on the screen through the camera, kept inside the safe
 * area: a circle around its window — or one area over both hands, both feet.
 */
export function stationTarget(L: Layout, s: StationId, fill: number, cam: Cam = NO_CAM): TapTarget {
  const pts: readonly P[] = stationPts(s);
  const sp = pts.map(([fx, fy]) => { const q = figPt(L, fx, fy); return toScreen(cam, q.x, q.y); });
  const size = Math.max(MIN_TAP, 2 * windowR(L, fill, s) * 0.9 * cam.s);
  const xs = sp.map(q => q.x), ys = sp.map(q => q.y);
  const w = Math.max(size, Math.max(...xs) - Math.min(...xs) + size), hh = Math.max(size, Math.max(...ys) - Math.min(...ys) + size);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const tw = Math.min(w, L.right - L.left), th = Math.min(hh, L.bottom - L.top);
  const x = clamp(cx - tw / 2, L.left, L.right - tw);
  const y = clamp(cy - th / 2, L.top, L.bottom - th);
  return { label: 'place', x, y, w: tw, h: th };
}

export interface TargetState {
  /** a story card is up (it takes every tap: the only target) */
  story: Rect | null;
  /** the station the light is at (null between ways) and its fill */
  place: StationId | null;
  fill: number;
  cam?: Cam;
}

/** Every control the player can tap now, as `hit` tests them. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  return s.place ? [stationTarget(L, s.place, s.fill, s.cam ?? NO_CAM)] : [];
}
