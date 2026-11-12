/**
 * Where things sit on Motylarnia's screen, mobile first (DESIGN §3.3 "Mobile first", §12): the camera that
 * follows the caterpillar's head through the garden (zooming out as it grows, as in the original), the play
 * area below the runner's HUD band (`insets().top`), the flowerbed strip (the band's last 40 s) along the
 * bottom, and the passive things in the band under the HUD: Hieronim top left with his bubble hanging beside
 * him, the side goal's pill next to him, the twig with the chrysalises top right.  Sizes start from a 360 px
 * phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3.
 *
 * Nothing here is a button: the whole garden is the control — a floating stick wherever the thumb lands on a
 * touch screen (stick.ts), the pointer with a mouse.  The only targets are the cards that wait for a tap (the
 * opening story, a new garden's goals).  Pure numbers (and text measuring for the cards), no drawing.
 */
import { MIN_READ, NO_INSETS, uiScale } from '../kit/mobile';
import { layoutPassage, wrapLines as wrapKit, type Passage, type PassageLayout } from '../kit/scripture';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export interface Rect { x: number; y: number; w: number; h: number }
/** a box in the wing's leaf space (wing.ts maps a path from it) */
export interface LeafBox { x0: number; y0: number; x1: number; y1: number }

export type Shape = 'tall' | 'short' | 'wide';

export interface Layout {
  w: number;
  h: number;
  shape: Shape;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  ins: Insets;
  top: number;
  /** the side gutters: nothing to read nearer the screen's edges */
  x0: number;
  x1: number;
  /** the play area: below the HUD band, above the flowerbed */
  play: Rect;
  /** the flowerbed strip along the bottom (the signal's history), over the home indicator's strip */
  bed: Rect;
  /** the twig (its attachment line) and the chrysalis length on it */
  twig: { x0: number; x1: number; y: number; len: number };
  /** Hieronim the snail: where his foot is, and his size */
  snail: { x: number; y: number; s: number };
  /** his bubble: its left edge and top (it hangs beside him under the HUD), how wide it may be */
  bubble: { x: number; y: number; maxW: number };
  /** the side goal's pill: its left edge, top, height, widest (beside a full twig) */
  pill: { x: number; y: number; h: number; maxW: number };
  /** the bottom of the passive things in the band under the HUD (Hieronim, the pill): the play's arrows keep below it */
  band: number;
  /** the floating stick (touch): the base's radius, the knob's, the dead zone, the push that sprints */
  stick: { r: number; knob: number; dead: number; sprint: number };
  /** the box cards are centred in, and how wide they may be */
  card: Rect;
  cardW: number;
  /** px per world unit at the start length */
  zoom: number;
  /** where the camera holds the head across the play area's height: a little above the middle on a phone upright,
   *  so the thumb's stick in the lower part stays clear of the caterpillar */
  anchor: number;
  phone: boolean;
}

/** The layout for a canvas of w × h CSS px with these insets (a number: only the HUD band on top). */
export function computeLayout(w: number, h: number, insets: Insets | number = NO_INSETS): Layout {
  const ins0: Insets = typeof insets === 'number' ? { top: insets, right: 0, bottom: 0, left: 0 } : insets;
  const W = Math.max(1, w), H = Math.max(1, h);
  const shape: Shape = W / H < 0.9 ? 'tall' : H < 460 ? 'short' : 'wide';
  const u = uiScale(W, H);
  const phone = Math.min(W, H) < 600;
  const top = Math.min(H * 0.4, Math.max(0, ins0.top));
  const ins: Insets = { top, right: Math.max(0, ins0.right), bottom: Math.max(0, ins0.bottom), left: Math.max(0, ins0.left) };
  const edge = shape === 'tall' ? (W < 600 ? 16 : Math.round(24 * u)) : Math.round(12 * u);
  const x0 = ins.left + edge, x1 = W - ins.right - edge;
  // the flowerbed along the bottom; the home indicator's strip under it is soil too
  const bedH = phone ? 38 : 46;
  const bed: Rect = { x: 0, y: H - ins.bottom - bedH, w: W, h: bedH + ins.bottom };
  const play: Rect = { x: 0, y: top, w: W, h: Math.max(80, bed.y - top) };
  // the twig hangs from the right edge, under the score corner's band
  const len = Math.max(36, Math.min(76, Math.min(W, H) * 0.1));
  const twig = { x0: W - ins.right - Math.min(W * 0.42, 6 + len * 0.95 * (RULES.twigMax + 0.6)), x1: W - ins.right + 4, y: top + 10, len };
  // Hieronim top left under the HUD; the side goal's pill beside him; his bubble hangs beside him over it
  const s = phone ? 0.85 : Math.min(1.2, u);
  const snail = { x: x0 + 26 * s, y: top + 10 + 40 * s, s };
  const px = snail.x + 34 * s;
  const pill = { x: px, y: top + 10, h: Math.round(28 * u), maxW: Math.max(110, twig.x0 - 10 - px) };
  const bubble = { x: snail.x + 28 * s, y: top + 8, maxW: Math.max(170, Math.min(x1 - (snail.x + 28 * s), 380 * u)) };
  const band = Math.max(snail.y + 6, pill.y + pill.h) + 4;
  const r = Math.round(46 * u);
  const stick = { r, knob: Math.round(21 * u), dead: 10, sprint: Math.round(r * 1.15) };
  const cardW = Math.min(x1 - x0, 460 * u);
  const card: Rect = { x: x0, y: top + 6, w: x1 - x0, h: Math.max(80, bed.y - 6 - (top + 6)) };
  // a phone shows the garden at least at 1 px per unit (the caterpillar stays readable); a desktop as before
  const zoom = Math.max(shape === 'wide' ? 0.8 : 1, Math.min(2, Math.min(W, H * 1.1) / 430));
  const anchor = shape === 'tall' ? 0.44 : 0.5;
  return { w: W, h: H, shape, u, ins, top, x0, x1, play, bed, twig, snail, bubble, pill, band, stick, card, cardW, zoom, anchor, phone };
}

/** The camera's zoom for a caterpillar of `len` segments (it zooms out as it grows). */
export const zoomFor = (L: Layout, len: number): number => L.zoom * (1 - 0.32 * Math.min(1, Math.max(0, (len - RULES.startLen) / 60)));

export interface Camera { x: number; y: number; z: number }

/** Where the camera's centre (cam.x, cam.y) shows on the screen: across the middle, down at the layout's anchor. */
export const camAt = (L: Layout): { x: number; y: number } => ({ x: L.play.x + L.play.w / 2, y: L.play.y + L.play.h * L.anchor });

/** World → screen with a camera centred on (cam.x, cam.y). */
export function toScreen(L: Layout, cam: Camera, x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = L.play.x + L.play.w / 2 + (x - cam.x) * cam.z;
  out.y = L.play.y + L.play.h * L.anchor + (y - cam.y) * cam.z;
  return out;
}

export function toWorld(L: Layout, cam: Camera, sx: number, sy: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = cam.x + (sx - L.play.x - L.play.w / 2) / cam.z;
  out.y = cam.y + (sy - L.play.y - L.play.h * L.anchor) / cam.z;
  return out;
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ── the cards ───────────────────────────────────────────────────
/** The opening story's card as laid out (sizes fitted to the play area, never under MIN_READ). */
export interface OpenCard {
  box: Rect;
  pad: number;
  titleSize: number;
  bodySize: number;
  bodyLH: number;
  body: string[];
  verse: PassageLayout;
  refSize: number;
  tapSize: number;
  /** tops from the card's top: the body, the verse, its reference, the tap line */
  yBody: number;
  yVerse: number;
  yRef: number;
  yTap: number;
}

/**
 * The opening card, laid out for this screen: the title, the story and 2 Corinthians 5:17 at 16 px where they
 * fit, half a pixel smaller step by step where they do not, never under MIN_READ; the reference at 13 and
 * up; the line that says how to begin.  `ctx` only measures; `font(px, weight, family)` as paint.ts's.
 */
export function openCard(ctx: CanvasRenderingContext2D, L: Layout, words: { body: string }, p: Passage, font: (px: number, weight?: number, family?: string) => string): OpenCard {
  const u = L.u, cw = L.cardW, pad = Math.round(18 * u), inner = cw - 2 * pad, room = L.card.h;
  let out: OpenCard | null = null;
  ctx.save();
  for (let size = Math.round(16 * u * 2) / 2; size >= MIN_READ; size -= 0.5) {
    const titleSize = Math.max(20, Math.round(size * 1.6));
    ctx.font = font(size, 500);
    const body = wrapKit(ctx, words.body, inner);
    const bodyLH = Math.round(size * 1.32);
    const tapSize = Math.max(MIN_READ + 1, Math.round(size * 0.94));
    const yBody = pad + Math.round(titleSize * 1.25) + Math.round(6 * u);
    const gap = Math.round(12 * u);
    const foot = gap + Math.round(tapSize * 1.35) + pad;
    const left = room - yBody - body.length * bodyLH - gap - foot;
    const verse = layoutPassage(ctx, p, inner, Math.max(24, left - 4), { max: size, min: MIN_READ });
    const refSize = Math.max(MIN_READ, Math.round(verse.size * 0.8));
    const yVerse = yBody + body.length * bodyLH + gap;
    const yRef = yVerse + verse.lines.length * verse.lineH + Math.round(verse.size * 0.45);
    const yTap = yRef + refSize + gap;
    const total = yTap + Math.round(tapSize * 1.35) + pad;
    out = { box: { x: L.card.x + (L.card.w - cw) / 2, y: 0, w: cw, h: total }, pad, titleSize, bodySize: size, bodyLH, body, verse, refSize, tapSize, yBody, yVerse, yRef, yTap };
    if (verse.fits && total <= room) break;
  }
  ctx.restore();
  const c = out!;
  c.box.h = Math.min(c.box.h, room);
  c.box.y = L.card.y + Math.max(0, (room - c.box.h) * 0.45);
  return c;
}

/**
 * A new garden's card (its name, the three stars' goals; a title of 22 px, rows of 15): on a phone upright a
 * sheet over the flowerbed, clear of the runner's block banner (a new garden often starts with a block), near
 * the thumb that closes it; elsewhere a little above the middle.
 */
export function gardenCardBox(L: Layout): Rect {
  const u = L.u, cw = L.cardW, ch = Math.min(Math.round(150 * u), L.card.h);
  const x = L.card.x + (L.card.w - cw) / 2;
  const y = L.shape === 'tall' ? L.card.y + L.card.h - ch : L.card.y + Math.max(8, (L.card.h - ch) * 0.3);
  return { x, y, w: cw, h: ch };
}

/**
 * Every control the player can tap right now (ArcadeGame.targets): a card while it waits for a tap — the
 * story or a garden's goals (a tap anywhere closes it; the card is the target).  The garden itself is the
 * free play area (the stick starts wherever the thumb lands), so it is not a target.
 */
export function tapTargets(L: Layout, card: Rect | null): TapTarget[] {
  if (!card) return [];
  const x = Math.max(L.ins.left, card.x), y = Math.max(L.top, card.y);
  const x2 = Math.min(L.w - L.ins.right, card.x + card.w), y2 = Math.min(L.h - L.ins.bottom, card.y + card.h);
  return [{ label: 'card', x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) }];
}
