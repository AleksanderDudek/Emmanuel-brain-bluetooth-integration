/**
 * Where Odporność's play view puts things (CSS px), mobile first (DESIGN §12, §13.9).  The runner's HUD
 * covers the top of the canvas (`insets().top`), a phone's home indicator or notch the other edges.
 *
 *   the strip     under the HUD: the stage's pill (six dots, the stage) and the „Co się dzieje?” button (it
 *                 shows the stage's card again); on a phone on its side and a desktop the goal line sits between
 *   the goal row  an upright phone: the persistent "what to do now" line — the gesture's icon, the stage's goal and
 *                 its progress („Zapal 5 miejsc na ścianie naczynia · 2/5”), „Odpocznij…” in a rest
 *   the song row  over the field's top (the air above the skin): the sing-along line, the rest's breathing guide,
 *                 Neo's bubble — one at a time
 *   the field     the slice of skin: the world's 126 units of height (the epidermis, the dermis, the venule)
 *                 at one uniform scale `k`, its width following the screen (80…240 units), centred; on a
 *                 tall screen the scale is capped and the air above the skin takes the rest
 *   the buttons   the respiratory burst and the NET: round, 60 px, in the thumb zone — the bottom corners of
 *                 an upright phone (over the vessel's ends), the side margins of a phone on its side or a
 *                 desktop when the world leaves room there
 *   the card      a bottom sheet on a phone upright, centred elsewhere
 *   a desk        a mouse on a desktop or a big screen (kit/mobile `screenKind`, §14): the world as tall as the
 *                 field (the phone's cap on the scale lifted: a Full HD monitor's slice of skin grows from 613 to
 *                 786 px, the cells with it), the buttons beside the world when it leaves margins (by the vessel,
 *                 not in the canvas's corners), the keys' caps on them, hover answers in the view
 *
 * Everything the player taps is a rectangle here (`tapTargets`), the same ones the view hit-tests and the
 * mobile audit checks: at least MIN_TAP on the short side, apart from each other, inside the insets.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, hitRect, screenKind, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export type { Rect };
export type Mode = 'tall' | 'short' | 'wide';

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** a mouse on a desktop or a big screen: the world fills the field, keys on the buttons, hover answers */
  desk: boolean;
  /** UI scale: 1 on a phone, up to 1.3 (a big screen's desk: up to 2.2) */
  u: number;
  ins: Insets;
  top: number;
  strip: Rect;
  /** the „Co się dzieje?” button (drawn) and its finger-sized hit rectangle */
  help: Rect;
  helpHit: Rect;
  /** the goal line: its own row on an upright phone, else between the stage's pill and the button (`inStrip`) */
  goal: Rect;
  goalInStrip: boolean;
  song: Rect;
  /** the field on screen and the world in it: px per unit, the origin of world (0, 0), the world's width in units */
  field: Rect;
  k: number;
  ox: number;
  oy: number;
  W: number;
  /** the world's rectangle on screen (x0..x1) and where the air above the skin begins */
  wx0: number;
  wx1: number;
  /** the two round buttons (centre, radius) and their hit rectangles */
  burst: { x: number; y: number; r: number };
  net: { x: number; y: number; r: number };
  /** the buttons sit in the side margins (else over the field's bottom corners) */
  sideButtons: boolean;
  /** Neo's portrait (centre, radius) and the room for his bubble */
  neo: { x: number; y: number; r: number; maxW: number };
  card: Rect;
  anchor: 'bottom' | 'centre';
  /** how far above the finger a drag leads the swarm (px) */
  lift: number;
}

/** the world's height: from the skin's surface to below the venule */
export const WORLD_H = RULES.floor - RULES.skinTop;

/**
 * `helpChars`: the length of the help button's words (the view passes its language's); they show when the strip
 * leaves room beside the stage's pill (about 0.58 em a character at 13.5 px), else the button is only a "?".
 */
export function layout(w: number, h: number, insets: Insets = NO_INSETS, touch = true, helpChars = 14): Layout {
  const W0 = Math.max(240, w), H0 = Math.max(200, h);
  const u = uiScale(W0, H0);
  const top = clamp(insets.top, 0, H0 * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  const mode: Mode = W0 / H0 < 0.9 ? 'tall' : H0 < 460 ? 'short' : 'wide';
  const kind = screenKind(W0, H0, touch);
  const desk = !touch && mode === 'wide' && (kind === 'desktop' || kind === 'big');
  const edge = mode === 'tall' && W0 < 600 ? 16 : Math.round(16 * u);
  const x0 = ins.left, x1 = W0 - ins.right;
  // the strip (the stage's pill, the help button), the goal row on an upright phone, then the field; the song
  // row lies over the field's top (the air above the skin), so the world keeps its height
  const stripH = Math.round(32 * u), goalH = Math.round(28 * u), songH = Math.round(22 * u), gap = Math.round(4 * u);
  const strip: Rect = { x: x0 + edge, y: top + Math.round(6 * u), w: x1 - x0 - 2 * edge, h: stripH };
  const goalInStrip = mode !== 'tall';
  const goal: Rect = goalInStrip ? { ...strip } : { x: strip.x, y: strip.y + stripH + gap, w: strip.w, h: goalH };
  // the button: a pill at the strip's right end (its words where they fit beside the stage's widest pill, about
  // 190 px, else only the "?"), hit at MIN_TAP
  const room = strip.w - 196 * u;
  const wordsW = Math.round(helpChars * 13.5 * 0.58 * u + stripH * 0.68 + 22 * u + (desk ? 26 * u : 0));
  // (a phone on its side shares the row with the goal line: the goal's words first, the button only a "?")
  const helpW = mode !== 'short' && wordsW <= room ? wordsW : stripH;
  const help: Rect = { x: strip.x + strip.w - helpW, y: strip.y, w: helpW, h: stripH };
  const helpHit = hitRect(help);
  const fTop = (goalInStrip ? strip.y + stripH : goal.y + goalH) + gap, fBot = H0 - ins.bottom;
  const song: Rect = { x: strip.x, y: fTop + Math.round(2 * u), w: strip.w, h: songH };
  const field: Rect = { x: x0, y: fTop, w: x1 - x0, h: Math.max(80, fBot - fTop) };
  // one uniform scale: the world's full height in the field, capped on tall screens (the air takes the rest);
  // a desk lifts the cap — a big screen's field is wide, and the world fills it (the cells grow with it)
  const kMax = desk ? 14 * u : 3.6 * u;
  const k = Math.min(field.h / WORLD_H, kMax);
  const W = clamp(field.w / k, RULES.minW, RULES.maxW);
  const worldPx = W * k;
  const ox = field.x + (field.w - worldPx) / 2;
  const oy = fBot - RULES.floor * k;   // the world's bottom on the field's bottom (the vessel by the thumb)
  // the buttons: in the side margins when they fit there, else the bottom corners
  const r = Math.round(30 * u);
  const margin = (field.w - worldPx) / 2;
  const sideButtons = margin >= 2 * r + 2 * Math.round(8 * u);
  const by = fBot - Math.round(10 * u) - r;
  let burst: Layout['burst'], net: Layout['net'];
  if (sideButtons && desk) {
    // a desk: beside the world, by the vessel's ends (the hand works in the world, not at the canvas's edge)
    const gap = Math.round(14 * u);
    burst = { x: ox - gap - r, y: by, r };
    net = { x: ox + worldPx + gap + r, y: by, r };
  } else if (sideButtons) {
    burst = { x: x0 + margin / 2, y: by, r };
    net = { x: x1 - margin / 2, y: by, r };
  } else {
    burst = { x: x0 + edge + r, y: by, r };
    net = { x: x1 - edge - r, y: by, r };
  }
  // Neo talks from the top left of the field, his bubble over the song row
  const nr = Math.round(17 * u);
  const neo = { x: strip.x + nr, y: song.y + song.h / 2 + Math.round(6 * u), r: nr, maxW: Math.min(strip.w - 2 * nr - Math.round(10 * u), 520 * u) };
  // cards: a bottom sheet on a phone upright, else centred over the field
  let card: Rect, anchor: Layout['anchor'];
  const band = fBot - top;
  if (mode === 'tall' && W0 < 600) {
    // (round 11: a stage's card has a picture and three lines — nearly the whole band on a small phone)
    const ch = Math.round(clamp(band - 12, 220, 480));
    card = { x: x0 + 10, y: fBot - ch - 8, w: x1 - x0 - 20, h: ch };
    anchor = 'bottom';
  } else {
    const cw = Math.min(field.w - 24, 560 * u), ch = Math.min(band - 16, 360 * u);
    card = { x: x0 + (field.w - cw) / 2, y: top + (band - ch) / 2, w: cw, h: ch };
    anchor = 'centre';
  }
  const lift = touch ? Math.round(clamp(64 * u, 56, 84)) : 0;
  return {
    w: W0, h: H0, mode, desk, u, ins, top, strip, help, helpHit, goal, goalInStrip, song, field, k, ox, oy, W, wx0: ox, wx1: ox + worldPx,
    burst, net, sideButtons, neo, card, anchor, lift,
  };
}

/** world units → screen px */
export const sx = (L: Layout, x: number): number => L.ox + x * L.k;
export const sy = (L: Layout, y: number): number => L.oy + y * L.k;
/** screen px → world units */
export const wx = (L: Layout, px: number): number => (px - L.ox) / L.k;
export const wy = (L: Layout, py: number): number => (py - L.oy) / L.k;

export const circleRect = (c: { x: number; y: number; r: number }): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: 2 * c.r, h: 2 * c.r });

/** whether a screen point is on a round button (its finger-sized square) */
export const onButton = (c: { x: number; y: number; r: number }, x: number, y: number): boolean =>
  Math.abs(x - c.x) <= Math.max(c.r, MIN_TAP / 2) && Math.abs(y - c.y) <= Math.max(c.r, MIN_TAP / 2);

/** whether a screen point is on the „Co się dzieje?” button */
export const onHelp = (L: Layout, x: number, y: number): boolean =>
  x >= L.helpHit.x && x <= L.helpHit.x + L.helpHit.w && y >= L.helpHit.y && y <= L.helpHit.y + L.helpHit.h;

/** The controls the player can tap now, as the view hit-tests them. */
export function tapTargets(L: Layout, s: { burst: boolean; net: boolean; card: boolean; help?: boolean }): TapTarget[] {
  if (s.card) return [{ label: 'card', x: L.card.x, y: L.card.y, w: L.card.w, h: L.card.h }];
  const out: TapTarget[] = [];
  if (s.help !== false) out.push({ label: 'help', ...L.helpHit });
  if (s.burst) out.push({ label: 'burst', ...circleRect(L.burst) });
  if (s.net) out.push({ label: 'net', ...circleRect(L.net) });
  return out;
}
