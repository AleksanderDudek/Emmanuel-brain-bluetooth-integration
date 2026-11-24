/**
 * Where Każda myśl's play view puts things (CSS px), phone first (DESIGN §12, §14).  The runner's HUD covers the
 * canvas top (`insets().top`), the home indicator its bottom, a notch the sides; the dark runs under all of them, the
 * game's own words and controls stay inside.  Three shapes:
 *
 *   tall   a phone held upright (the reference: 360 × 500 with a 134 px HUD): the thought's slip at the top of the
 *          stage, the flame below it, the words band at the bottom (what the thought is, what to do now, the prayer —
 *          or in rest the true word), "Nie moja" at the stage's lower right above the band, in the thumb zone
 *   side   a phone on its side: the slip and the flame on the left, the words in a column on the right, "Nie moja"
 *          under them
 *   wide   a tablet on its side, a desktop or a big screen: the slip and the flame in the middle of the stage, the
 *          words in a column beside them at a reading measure
 *
 * The rest's breath guide (kit/breathguide.ts, its word beside the ring) takes the slip's place; the finale's
 * closing card takes the stage and its "how heavy now" row the band's place.  Everything here is pure: the tests
 * run it at every CHECK_SIZES entry.
 */
import { breathGuideRadius } from '../kit/breathguide';
import { clamp } from '../kit/juice';
import { MIN_READ, MIN_TAP, NO_INSETS, TAP_GAP, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { t } from './i18n';

export interface Rect { x: number; y: number; w: number; h: number }
export type Shape = 'tall' | 'side' | 'wide';

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
  desk: boolean;
  u: number;
  /** the scene's band (the slip and the flame live in it) */
  stage: Rect;
  /** the flame: its point (where the eyes rest) and its size unit (the flame is about 2.2 × fs tall) */
  fx: number;
  fy: number;
  fs: number;
  /** the waiting thought's slip: its centre, its width, its tallest (three lines of its text at the least size) */
  slip: { cx: number; cy: number; w: number; maxH: number };
  /** the golden lights' orbit round the point (an ellipse) */
  orbit: { rx: number; ry: number };
  /** a set's stronghold: the wall behind the flame, under the slip (its stones are the set's pairs) */
  fort: Rect;
  /** the words: the band (tall) or the column (side, wide) */
  band: Rect;
  /** the narrator's caption (passive) */
  caption: Rect;
  /** "Nie moja" */
  skip: Rect;
  /** the opening story card's box */
  story: Rect;
  /** the rest's breath guide (row layout: the word beside the ring) */
  guide: { cx: number; cy: number; r: number; maxW: number };
  /** the finale: the closing card, and the "how heavy now" row */
  close: Rect;
  scale: Rect;
  font: { label: number; line: number; lineMin: number; caption: number; small: number; now: number; name: number; slip: number; slipMin: number; button: number };
}

/** The breath guide's height in its row layout for a ring of radius r (kit/breathguide.ts's metrics, estimated). */
export function guideH(r: number): number {
  const word = Math.max(20, Math.round(r * 0.62)), sub = Math.max(MIN_READ, Math.round(word * 0.64)), pad = Math.max(10, Math.round(r * 0.3));
  return Math.max(2 * r, word + sub * 1.3) + 2 * pad * 0.7;
}

/** The slip's tallest: three lines of its text at the least size, with its padding. */
const slipMaxH = (px: number): number => 3 * Math.round(px * 1.3) + 2 * Math.max(10, Math.round(px * 0.75));

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
    ? { label: Math.round(14 * u), line: Math.round(18.5 * u), lineMin: Math.max(15, Math.round(15 * u)), caption: Math.round(14 * u), small: Math.round(12.5 * u), now: Math.round(13.5 * u), name: Math.round(22 * u), slip: Math.round(20 * u), slipMin: 15, button: Math.round(15 * u) }
    : { label: Math.round(13 * u), line: Math.round(17 * u), lineMin: 15, caption: Math.max(13, Math.round(13 * u)), small: Math.max(12, Math.round(12 * u)), now: Math.max(13, Math.round(13 * u)), name: Math.round(20 * u), slip: Math.round(17 * u), slipMin: 14, button: Math.max(14, Math.round(14 * u)) };
  const btn = Math.round(Math.max(48, 48 * Math.min(u, 1.4)));
  // "✕ Nie moja" / "✕ Nicht meiner": as wide as its words need (at most the button's font), a finger's size at least
  const skipChars = [...t('skip.btn')].length + 2;
  const skipW = shape === 'wide' ? Math.round(Math.max(104, skipChars * 8.4 * Math.min(u, 1.4) + 24)) : Math.round(Math.max(100, skipChars * 8 + 20));
  /** the narrator's caption: three lines on a phone upright (it shares the row with "Nie moja"), two elsewhere */
  const capH = Math.round(font.caption * 1.35) * (shape === 'tall' ? 3 : 2) + 8;
  const gr0 = breathGuideRadius(w, h);

  /**
   * The flame and the slip in a stage, above `floor`: the slip over the flame, the point a calm distance below it
   * (never so far that the ring becomes the whole picture), the pair a little above the middle of the room there.
   */
  const scene = (stage: Rect, floor: number, slipW: number) => {
    const maxH = slipMaxH(font.slipMin);
    const avail = Math.max(24, floor - stage.y);
    const room = Math.max(24, avail - maxH - 12);
    const fs = clamp(Math.min(stage.w, stage.h) * 0.075, 10, Math.min(34 * u, room / 3.2));
    // from the slip's lower edge to the point: at least the flame's tip and a little air, at most ~130 px
    const gap = clamp(room * 0.55, 2.6 * fs, Math.max(2.6 * fs, 130 * Math.min(u, 1.4)));
    const total = maxH + gap + 1.2 * fs;
    const top0 = stage.y + Math.max(6, (avail - total) * 0.42);
    const slip = { cx: stage.x + stage.w / 2, cy: top0 + maxH / 2, w: slipW, maxH };
    const fy = top0 + maxH + gap;
    const rx = Math.min(stage.w * 0.42, fs * 4.4);
    const orbit = { rx, ry: Math.min(rx * 0.4, Math.max(8, floor - fy - fs * 0.4)) };
    // the guide in the slip's place, its ring no larger than the room there
    const r = Math.max(22, Math.min(gr0, (maxH + 2.1 * fs) / 2.6));
    const gh = guideH(r);
    const guide = { cx: slip.cx, cy: Math.max(stage.y + gh / 2 + 2, Math.min(slip.cy, fy - fs * 2.2 - gh / 2)), r, maxW: Math.min(stage.w - 2 * r - 40, 260 * u) };
    // the stronghold stands behind the flame, from just under the slip to a little below the point: taller than wide
    const fTop = top0 + maxH * 0.72;
    const fBot = Math.min(floor - 2, fy + fs * 1.5);
    const fh = Math.max(40, fBot - fTop);
    const fw = Math.min(stage.w * 0.86, fh * 1.15, 380 * Math.min(u, 1.5));
    const fort = { x: stage.x + (stage.w - fw) / 2, y: fBot - fh, w: fw, h: fh };
    return { fx: stage.x + stage.w / 2, fy, fs, slip, orbit, guide, fort };
  };

  if (shape === 'tall') {
    const bandH = Math.round(clamp(bh * 0.3, 118, 170 * u));
    const band = { x: left + edge, y: bottom - bandH - 6, w: bw - 2 * edge, h: bandH };
    const stage = { x: left + edge, y: top + 4, w: bw - 2 * edge, h: band.y - 8 - (top + 4) };
    const skip = { x: right - edge - skipW, y: band.y - 8 - btn, w: skipW, h: btn };
    const caption = { x: left + edge, y: band.y - 6 - capH, w: bw - 2 * edge - skipW - 8, h: capH };
    const sc = scene(stage, Math.min(skip.y, caption.y) - 4, Math.min(stage.w - 4, Math.round(360 * u)));
    const scaleH = scaleHeight(band.w, btn, font);
    const scale = { x: band.x, y: bottom - 6 - scaleH, w: band.w, h: scaleH };
    return {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, stage, ...sc, band, caption, skip, font,
      story: { x: left + edge, y: top + 8, w: bw - 2 * edge, h: bh - 16 },
      close: { x: stage.x, y: stage.y, w: stage.w, h: Math.max(80, scale.y - 10 - stage.y) },
      scale,
    };
  }

  if (shape === 'side') {
    // the scene on the left, the words in a column on the right, "Nie moja" under them
    const colW = Math.round(clamp(bw * 0.44, 230, 380));
    const stage = { x: left + 8, y: top + 6, w: bw - colW - 30, h: bh - 12 };
    const colX = stage.x + stage.w + 14;
    const skip = { x: right - edge - skipW, y: bottom - 8 - btn, w: skipW, h: btn };
    const caption = { x: colX, y: top + 6, w: right - edge - colX, h: capH };
    const band = { x: colX, y: caption.y + capH + 6, w: right - edge - colX, h: skip.y - 8 - (caption.y + capH + 6) };
    const sc = scene(stage, stage.y + stage.h - 4, Math.min(stage.w - 8, 340));
    const colH = bottom - 8 - (top + 6);
    return {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, stage, ...sc, band, caption, skip, font,
      story: { x: left + edge, y: top + 6, w: bw - 2 * edge, h: bh - 12 },
      close: stage,
      scale: { x: colX, y: top + 6, w: right - edge - colX, h: colH },
    };
  }

  // wide: the scene in the middle, the words in a column beside it, the group centred
  const colW = Math.round(Math.max(260, Math.min(17 * font.line, bw * 0.34)));
  const stageW = Math.min(bw - colW - 3 * edge, Math.round(820 * Math.min(u, 1.6)));
  const groupW = stageW + edge + colW;
  const x0 = left + Math.max(edge, (bw - groupW) / 2);
  const stage = { x: x0, y: top + 8, w: stageW, h: bh - 16 };
  const colX = x0 + stageW + edge;
  const bandH = Math.round(clamp(bh * 0.46, 200, 330 * u));
  const band = { x: colX, y: top + Math.max(capH + 20, (bh - bandH) / 2), w: colW, h: Math.min(bandH, bottom - 12 - btn - 14 - (top + Math.max(capH + 20, (bh - bandH) / 2))) };
  const caption = { x: colX, y: band.y - capH - 8, w: colW, h: capH };
  const skip = { x: colX, y: Math.min(bottom - 12 - btn, band.y + band.h + 14), w: skipW, h: btn };
  const sc = scene(stage, stage.y + stage.h - 8, Math.min(stage.w * 0.8, Math.round(460 * Math.min(u, 1.5))));
  const scaleH = scaleHeight(colW, btn, font);
  return {
    w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, stage, ...sc, band, caption, skip, font,
    story: { x: (left + right - Math.min(bw - 2 * edge, 560 * u)) / 2, y: top + 8, w: Math.min(bw - 2 * edge, 560 * u), h: bh - 16 },
    close: stage,
    scale: { x: colX, y: top + Math.max(8, (bh - scaleH) / 2), w: colW, h: Math.min(bh - 16, scaleH) },
  };
}

// ── the finale's row: how heavy is it now, 0–10 ───────────────────

/** Buttons a row holds: all eleven when they fit at a finger's size, else two rows (0–5, 6–10), else three (4, 4, 3). */
const perRow = (innerW: number): number => {
  const fits = (n: number) => innerW >= n * MIN_TAP + (n - 1) * TAP_GAP;
  return fits(11) ? 11 : fits(6) ? 6 : 4;
};
const rowsOf = (n: number): number => Math.ceil(11 / n);

function scaleHeight(w: number, btn: number, f: Layout['font']): number {
  const rows = rowsOf(perRow(w - 16));
  return Math.round(f.label * 1.7) + rows * btn + (rows - 1) * 8 + Math.round(Math.max(MIN_READ, f.small) * 1.6) * 2 + 18;
}

export interface ScaleParts { ask: number; buttons: Rect[]; ends: number; thanks: number }

/** The row's parts: the question, eleven buttons (0–10) in one, two or three rows, the ends' words under them (or the thanks once answered). */
export function scaleParts(L: Layout): ScaleParts {
  const S = L.scale, pad = 8, gap = 8;
  const innerW = S.w - 2 * pad;
  const n = perRow(innerW);
  const bh = Math.round(Math.max(48, 48 * Math.min(L.u, 1.4)));
  const askH = Math.round(L.font.label * 1.7);
  const rows = rowsOf(n);
  const smallH = Math.round(Math.max(MIN_READ, L.font.small) * 1.6);
  const total = askH + rows * bh + (rows - 1) * gap + 2 * smallH + 10;
  let y = S.y + Math.max(4, (S.h - total) / 2);
  const ask = y + askH / 2;
  y += askH;
  const bw = Math.min(64 * Math.min(L.u, 1.4), (innerW - (n - 1) * TAP_GAP) / n);
  const buttons: Rect[] = [];
  for (let i = 0; i <= 10; i++) {
    const row = Math.floor(i / n), col = i % n;
    const inRow = Math.min(n, 11 - row * n);
    const rowW = inRow * bw + (inRow - 1) * TAP_GAP;
    buttons.push({ x: S.x + (S.w - rowW) / 2 + col * (bw + TAP_GAP), y: y + row * (bh + gap), w: bw, h: bh });
  }
  y += rows * bh + (rows - 1) * gap + 6;
  return { ask, buttons, ends: y + smallH / 2, thanks: y + smallH * 1.5 };
}

// ── the targets ──────────────────────────────────────────────────

export interface TargetState {
  story: Rect | null;
  /** "Nie moja" can be tapped now */
  skip: boolean;
  /** the finale's row is up */
  scale: boolean;
}

/** Every control the player can tap now (as the view's hit tests test them). */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  if (s.scale) return scaleParts(L).buttons.map((r, i) => ({ label: `w${i}`, ...r }));
  return s.skip ? [{ label: 'skip', ...L.skip }] : [];
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * The lobby's hero and the game card (no words of the HUD, no controls): the flame a little low in the middle — a
 * little right of it on a picture wider than tall, where the lobby's title does not cover it — a slip above it.
 */
export function previewLayout(w: number, h: number): Layout {
  const base = layout(Math.max(200, w), Math.max(200, h), { top: 24, right: 0, bottom: 0, left: 0 }, true);
  const cx = w > h * 1.2 ? w * 0.62 : w / 2;
  const fs = clamp(Math.min(w, h) * 0.07, 8, 34);
  const slipW = Math.min(w * (w > h * 1.2 ? 0.5 : 0.8), 360);
  const maxH = slipMaxH(Math.max(13, Math.min(18, h * 0.05)));
  const fy = h * 0.62;
  const stage = { x: cx - slipW / 2 - 20, y: Math.max(4, h * 0.04), w: slipW + 40, h: h * 0.9 };
  const sy = Math.max(maxH / 2 + 6, fy - fs * 2.4 - maxH / 2 - fs * 1.6);
  const fh = Math.max(30, fy + fs * 1.5 - (sy + maxH * 0.22)), fw = Math.min(slipW, fh * 1.15);
  return {
    ...base, w, h, top: 0, bottom: h, left: 0, right: w, stage, fx: cx, fy, fs,
    fort: { x: cx - fw / 2, y: fy + fs * 1.5 - fh, w: fw, h: fh },
    slip: { cx, cy: sy, w: slipW, maxH },
    orbit: { rx: Math.min(w * 0.3, fs * 4.4), ry: Math.min(w * 0.3, fs * 4.4) * 0.4 },
  };
}
