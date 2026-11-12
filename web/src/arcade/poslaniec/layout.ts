/**
 * Where Posłaniec's play view puts things (CSS px), mobile first (DESIGN §7.3 "Mobile first", §12).  The
 * runner's HUD covers the top of the canvas (`insets().top`), a phone's home indicator or notch the other
 * edges; the game owns the rest.  Sizes start from a 360 px phone at u = 1 (kit/mobile `uiScale`) and grow
 * to 1.3 on a tablet or a desktop.
 *
 *   tall   (a phone upright, a tablet upright)  the road from a thin strip of sky under the HUD down to the
 *          bottom, the lanes a little wider and the cast a little larger than life; the messenger low in the
 *          picture, so a thumb swipes under and beside him (or on the dock's chart, which plays as the
 *          canvas's bottom edge).  The band under the HUD carries the passive things: Klekot's gauge top
 *          right over the grass, the quest pill top left (the day's word over the power-ups' timers), and
 *          Klekot's bubble between them while he talks
 *   short  (a phone on its side)  the same arrangement in a 290 px band: the road narrower than the screen,
 *          the pill over the left grass, the stork over the right
 *   wide   (desktops, tablets on their side)  the same, grown, and the ribbon of dawn (the band's last 40 s)
 *          in the open sky between the runner's panel and its score
 *
 * Nothing is pressed in play: a swipe anywhere (or a tap by thirds) moves the messenger, so the free play
 * area is not a target.  The only targets are the cards that wait for a tap — the opening story, which
 * holds the run at the milestone until the player sets off.
 */
import { clamp } from '../kit/juice';
import { MIN_READ, NO_INSETS, uiScale, type Rect } from '../kit/mobile';
import { layoutPassage, wrapLines, type Passage, type PassageLayout } from '../kit/scripture';
import type { Insets, TapTarget } from '../kit/types';
import { SANS, font } from './paint';

export type { Rect };
export type Shape = 'tall' | 'short' | 'wide';

export interface Layout {
  w: number;
  h: number;
  shape: Shape;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** what covers each edge (the HUD band on top) */
  ins: Insets;
  top: number;
  /** the side gutters: nothing to read or press nearer the screen's edges (a back swipe, a notch) */
  x0: number;
  x1: number;
  /** the middle of the safe width (the road's centre line on screen) */
  cx: number;
  /** the messenger's feet on screen, the horizon */
  runnerY: number;
  horizon: number;
  /** a lane's share of the width at the messenger's depth (the road's scale), and the cast's enlargement */
  lane: number;
  big: number;
  /** Klekot's gauge: the arc's centre and radius, and the plate round it (the flight's ring inside it) */
  stork: { x: number; y: number; r: number; plate: number };
  /** the top of the gauge's words under the plate */
  labelY: number;
  /** the quest pill, top left under the HUD: the day's word (its label over its tiles) */
  pill: { x: number; y: number; tile: number; gap: number; pad: number; label: number; h: number };
  /** the power-ups' timers: a row of round plates (centres from x, `step` apart); y with and without the pill above */
  powers: { x: number; yUnder: number; yTop: number; r: number; step: number };
  /** Klekot's bubble: its right edge (the tail reaches on to the plate), top, widest, at most this many lines */
  bubble: { right: number; y: number; maxW: number; lines: number; size: number };
  /** where the cards (a city reached, a mission done) stack from, and how wide they may be */
  cards: { y: number; maxW: number };
  /** the box the opening story and the run's tally are centred in */
  sheet: Rect;
  /** how wide the story and the tally may be */
  sheetW: number;
  /** the ribbon of dawn (the band's last 40 s across the sky), where there is room for it */
  ribbon: Rect | null;
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(200, w), H = Math.max(160, h);
  const shape: Shape = W / H < 0.9 ? 'tall' : H < 460 ? 'short' : 'wide';
  const u = uiScale(W, H);
  const top = clamp(insets.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  // nothing to read in the outer 16 px of a phone upright (the back swipe starts at the left edge)
  const edge = shape === 'tall' ? (W < 600 ? 16 : Math.round(24 * u)) : Math.round(12 * u);
  const x0 = ins.left + edge, x1 = W - ins.right - edge;
  const cx = (ins.left + W - ins.right) / 2;
  const bottom = H - ins.bottom;
  // the road: the messenger low, a thumb's room under him; a thin strip of sky under the HUD
  const runnerY = Math.min(H * 0.86, bottom - Math.max(40, H * 0.1));
  const horizon = Math.max(top + (shape === 'tall' ? 18 : 10) * u, H * 0.28);
  const lane = shape === 'tall' && W < 600 ? 0.29 : 0.27;
  const big = shape === 'tall' ? 1.25 : 1;
  // Klekot's gauge, top right under the HUD (over the grass beside the road)
  const r = Math.round((shape === 'short' ? 24 : 27) * u);
  const plate = r + Math.round(12 * u);
  const stork = { x: x1 - plate, y: top + 6 + plate, r, plate };
  const labelY = stork.y + plate + Math.round(4 * u);
  // the quest pill, top left: the day's word, the power-ups' timers under it
  const pad = Math.round(6 * u), label = Math.round(12 * u), tile = Math.round(22 * u), gap = Math.max(2, Math.round(3 * u));
  const pillH = pad + label + Math.round(4 * u) + tile + pad;
  const pill = { x: x0, y: top + 6, tile, gap, pad, label, h: pillH };
  // a timer's plate: its icon 0.8 of it, so the seal's "×2" reads at 11 px and up
  const pr = Math.round(20 * u);
  const powers = { x: x0 + pr, yUnder: pill.y + pillH + Math.round(8 * u) + pr, yTop: top + 6 + pr, r: pr, step: 2 * pr + Math.round(6 * u) };
  // Klekot's bubble, left of his gauge, at the top
  const right = stork.x - plate - Math.round(10 * u);
  const bubble = { right, y: top + 6, maxW: Math.max(120, Math.min(right - x0, (shape === 'short' ? 320 : 340) * u)), lines: 4, size: 14 * u };
  const cards = { y: top + 6, maxW: Math.min(x1 - x0, 420 * u) };
  const sheet: Rect = { x: x0, y: top + 6, w: x1 - x0, h: Math.max(80, bottom - 6 - (top + 6)) };
  const sheetW = Math.min(x1 - x0, (shape === 'short' ? 600 : 460) * u);
  // the ribbon: on a wide screen, in the open sky between the runner's panel and its score
  let ribbon: Rect | null = null;
  if (shape === 'wide') {
    const rx0 = 360, rx1 = W - 150, ry0 = 62, ry1 = horizon - 16 * u;
    if (rx1 - rx0 >= 300 && ry1 - ry0 >= 46) {
      const bw = Math.min(rx1 - rx0, 620), bh = Math.min(84, ry1 - ry0);
      ribbon = { x: rx0 + (rx1 - rx0 - bw) / 2, y: ry1 - bh, w: bw, h: bh };
    }
  }
  return { w: W, h: H, shape, u, ins, top, x0, x1, cx, runnerY, horizon, lane, big, stork, labelY, pill, powers, bubble, cards, sheet, sheetW, ribbon };
}

/** The quest pill's width for a word of `n` letters (tiles in a row, the label above them). */
export function pillWidth(L: Layout, n: number, labelW: number): number {
  const tiles = n * L.pill.tile + Math.max(0, n - 1) * L.pill.gap;
  return Math.max(tiles, labelW) + 2 * L.pill.pad;
}

/** What is on screen that decides the targets: the opening story's card (as drawn), or nothing. */
export interface TargetState {
  story: Rect | null;
}

/**
 * Every control the player can tap right now, as the game hit-tests it (ArcadeGame.targets): the opening
 * story's card while it holds the run (a tap anywhere sets off; the card is the target).  In play there are
 * none — a swipe anywhere or a tap by thirds moves the messenger, and the free area is not a target.
 */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (!s.story) return [];
  // the card, kept inside the safe area (it is at least a finger tall)
  const r = s.story;
  const x = Math.max(L.ins.left, r.x), y = Math.max(L.top, r.y);
  const x2 = Math.min(L.w - L.ins.right, r.x + r.w), y2 = Math.min(L.h - L.ins.bottom, r.y + r.h);
  return [{ label: 'story', x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) }];
}

/** The opening story's card as laid out for the screen (its sizes fitted to the band, never under MIN_READ). */
export interface StoryLay {
  box: Rect;
  pad: number;
  titleSize: number;
  bodySize: number;
  bodyLH: number;
  body: string[];
  verse: PassageLayout;
  refSize: number;
  tapSize: number;
  tap: string;
  /** the tops (from the card's top) of the body, the verse, the verse's reference, the tap line */
  yBody: number;
  yVerse: number;
  yRef: number;
  yTap: number;
}

/**
 * The opening story, laid out for this screen: the title, the three sentences and the root passage at
 * 16 px where they fit the band (a small phone's 366 px), half a pixel smaller step by step where they do
 * not, never under MIN_READ; the passage's reference at 13 and up; the line that says how to set off.
 * `ctx` only measures.
 */
export function storyLayout(ctx: CanvasRenderingContext2D, L: Layout, words: { body: string; tap: string }, p: Passage): StoryLay {
  const u = L.u;
  const cw = L.sheetW, pad = Math.round(16 * u), inner = cw - 2 * pad;
  const room = L.sheet.h;
  let out: StoryLay | null = null;
  ctx.save();
  for (let size = Math.round(16 * u * 2) / 2; size >= MIN_READ; size -= 0.5) {
    const titleSize = Math.max(18, Math.round(size * 1.4));
    ctx.font = font(500, size, SANS);
    const body = wrapLines(ctx, words.body, inner);
    const bodyLH = Math.round(size * 1.32);
    const tapSize = Math.max(MIN_READ, Math.round(size * 0.94));
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
    out = {
      box: { x: L.cx - cw / 2, y: 0, w: cw, h: total }, pad, titleSize, bodySize: size, bodyLH, body, verse, refSize, tapSize, tap: words.tap,
      yBody, yVerse, yRef, yTap,
    };
    if (verse.fits && total <= room) break;
  }
  ctx.restore();
  const S = out!;
  S.box.h = Math.min(S.box.h, room);
  S.box.y = L.sheet.y + Math.max(0, (room - S.box.h) * 0.4);
  return S;
}
