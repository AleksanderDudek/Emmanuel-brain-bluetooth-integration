/**
 * Złote serce's layout (DESIGN.md §21, mobile first, then the desk): where the heart is rebuilt, the dark cloth the
 * broken pieces lie on (under the heart), the words' band (the narrator, a passage, the qualities, the blessing), the
 * breath guide, the 0–10 row of the close, and the place of the music's player card — kept free whenever a track will
 * play, so nothing jumps when one starts (YouTube's player at least 200 × 200 CSS px plus its title line, never over
 * the heart).
 *
 *   tall   a phone upright: the heart, the cloth under it; at the bottom the card on the left, and beside it the
 *          band over the breath guide (without the card: the band, then the guide alone, its word beside the ring)
 *   side   a phone on its side: the heart and the cloth on the left; a column on the right with the band and the card
 *          (the guide under the scene); without the card the guide under the band
 *   wide   a tablet or the desk: the heart in the middle, the cloth under it; the band at the bottom centre, the guide
 *          left of it, the card in the lower right corner
 *
 * While the pieces are gathered the heart stands in the upper part of the scene, the cloth below; from the gold on the
 * cloth is gone and the heart moves to the scene's middle (`cyC`).  Pure numbers: every rectangle in canvas CSS px,
 * inside the insets, under the runner's HUD band.
 */
import { MIN_TAP, type Rect } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { HEART } from './heart';

export type { Rect };
export type LayoutKind = 'tall' | 'side' | 'wide';

export interface Layout {
  w: number;
  h: number;
  kind: LayoutKind;
  /** CSS px per heart unit */
  s: number;
  /** the heart's middle while the pieces are gathered, and from the gold on (then larger: `sC` px a unit) */
  cx: number;
  cy: number;
  cyC: number;
  sC: number;
  /** the cloth's band in heart units from the heart's middle (gathering): where the pieces lie */
  cloth: { x0: number; x1: number; y0: number; y1: number };
  /** the scene: the heart, the cloth, the hands */
  scene: Rect;
  /** the words' band */
  band: Rect;
  /** the breath guide: its ring's middle and radius, its words beside (row) or under (stack), the widest its words may be */
  guide: { cx: number; cy: number; r: number; layout: 'stack' | 'row'; maxW: number };
  /** the music's player card (only when a track will play) */
  music: Rect | null;
  /** the second card's place for a cross-fade between two tracks (both players on screen for a few seconds): beside
   * or above the first, over nothing the meditation shows — the heart at any stage, the cloth, the words, the guide;
   * null where the screen has no such room (then the music passes from track to track in the card's one place) */
  music2: Rect | null;
  /** the close's question line and its 0–10 buttons, the blessing's (and the closing verse's) place above them, and the
   * heart's middle and scale in the close (moved up out of their way where they reach into the scene) */
  rateQ: Rect;
  rate: Rect[];
  closeText: Rect;
  cyX: number;
  sX: number;
  /** the text's base size (CSS px) */
  font: number;
}

/** The heart's height in heart units. */
const HH = HEART.bottom - HEART.top;
/** The gap between the heart and the cloth, and the cloth's depth (heart units). */
const GAP = 0.06;
const CLOTH = { tall: 0.88, side: 0.8, wide: 0.8 } as const;

/** The player card's size: YouTube's least 200 × 200 and a title line; a little wider at a desk. */
export function cardSize(kind: LayoutKind, w: number): { w: number; h: number } {
  if (kind === 'wide' && w >= 1100) return { w: 264, h: 236 };
  return { w: 200, h: 228 };
}

/** The breath guide's height for a ring radius (its scrim, the word and the "oddech 2 z 3" line). */
export const guideHeight = (r: number, layout: 'stack' | 'row'): number => (layout === 'row' ? 2 * r + 26 : 2 * r + 78);

/** The heart and its cloth fitted into the scene, the whole composition centred. */
function fit(scene: Rect, kind: LayoutKind): Pick<Layout, 's' | 'cx' | 'cy' | 'cyC' | 'sC' | 'cloth'> {
  const depth = CLOTH[kind];
  const wantW = kind === 'wide' ? 3.0 : 2.45;
  // (the shards' thickness and shadows below the cloth's last row)
  const totalH = HH + GAP + depth + 0.06;
  const s = Math.max(28, Math.min(scene.w / wantW, scene.h / totalH));
  const top = scene.y + Math.max(0, (scene.h - totalH * s) / 2);
  const cy = top - HEART.top * s;
  // alone in the scene (the cloth gone) the heart may grow, its aura round it
  const sC = Math.max(s, Math.min(scene.w / 2.7, scene.h / (HH + 0.42), s * 1.3));
  const cyC = scene.y + scene.h / 2 + 0.03 * sC;
  const halfW = Math.min(kind === 'wide' ? 2.1 : 1.5, scene.w / 2 / s - 0.08);
  const y0 = HEART.bottom + GAP, y1 = y0 + depth;
  return { s, cx: scene.x + scene.w / 2, cy, cyC, sC, cloth: { x0: -halfW, x1: halfW, y0, y1 } };
}

/** The 0–10 row: one row of eleven where it fits at MIN_TAP, else two (6 + 5), else three (4 + 4 + 3). */
function rateRow(area: Rect): Rect[] {
  const gap = 6;
  const out: Rect[] = [];
  const per = rateCols(area.w);
  const rows = Math.ceil(11 / per);
  const bw = Math.max(MIN_TAP, Math.min(56, (area.w - (per - 1) * gap) / per));
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const k = Math.min(per, 11 - n);
    const total = k * bw + (k - 1) * gap;
    const x0 = area.x + (area.w - total) / 2;
    for (let i = 0; i < k; i++) out.push({ x: x0 + i * (bw + gap), y: area.y + r * (MIN_TAP + gap), w: bw, h: MIN_TAP });
    n += k;
  }
  return out;
}

/** Buttons a row of the 0–10 holds for a width: 11, 6 or 4. */
const rateCols = (w: number): number => (w >= 11 * MIN_TAP + 60 ? 11 : w >= 6 * MIN_TAP + 30 ? 6 : 4);

/** The height the 0–10 row takes for a width. */
const rateH = (w: number): number => { const rows = Math.ceil(11 / rateCols(w)); return rows * MIN_TAP + (rows - 1) * 6; };

export function layout(w: number, h: number, ins: Insets, tracks: boolean): Layout {
  const W = Math.max(1, w), H = Math.max(1, h);
  const L = ins.left + 10, R = W - ins.right - 10, T = ins.top + 6, B = H - ins.bottom - 8;
  const kind: LayoutKind = W >= 900 && H >= 560 ? 'wide' : W > H * 1.15 ? 'side' : 'tall';
  const font = kind === 'wide' ? Math.min(20, 15 + (Math.min(W, 1600) - 900) / 140) : 15;
  const card = cardSize(kind, W);
  let scene: Rect, band: Rect, music: Rect | null = null;
  let guide: Layout['guide'];
  let closeArea: Rect;

  if (kind === 'tall') {
    const bandH = Math.max(88, Math.min(120, H * 0.16));
    // the close's place: the band and the guide's row at the foot (the card is gone by then: the outro is ambient),
    // and at least ~5 lines for the blessing over the 0–10 rows (the heart moves up out of its way)
    const closeY = Math.min(B - guideHeight(28, 'row') - 8 - bandH, B - rateH(R - L) - 52 - 118);
    if (tracks) {
      // the card at the foot on the left, and beside it a column: the words over the breath guide — the scene keeps
      // the whole width and everything above the card (under a band of words over the card a short phone's heart
      // was half its size)
      music = { x: L, y: B - card.h, w: card.w, h: card.h };
      const cx0 = music.x + music.w + 10, cw = Math.max(60, R - cx0);
      const r = Math.max(18, Math.min(28, cw * 0.15)), gH = guideHeight(r, 'stack');
      guide = { cx: cx0 + cw / 2, cy: B - gH + r + 8, r, layout: 'stack', maxW: Math.max(60, cw - 8) };
      band = { x: cx0, y: music.y, w: cw, h: Math.max(56, music.h - gH - 6) };
      scene = { x: L, y: T, w: R - L, h: Math.max(80, music.y - 8 - T) };
    } else {
      const r = 28, gH = guideHeight(r, 'row');
      guide = { cx: (L + R) / 2 - 44, cy: B - gH / 2, r, layout: 'row', maxW: (R - L) / 2 };
      band = { x: L, y: B - gH - 8 - bandH, w: R - L, h: bandH };
      scene = { x: L, y: T, w: R - L, h: Math.max(80, band.y - 6 - T) };
    }
    closeArea = { x: L, y: closeY, w: R - L, h: B - closeY };
  } else if (kind === 'side') {
    const colW = Math.max(card.w + 8, Math.min(320, (R - L) * 0.42));
    const colX = R - colW;
    const r = Math.max(18, Math.min(24, (B - T) * 0.07)), gH = guideHeight(r, 'row');
    if (tracks) {
      music = { x: R - card.w, y: B - card.h, w: card.w, h: card.h };
      const avail = music.y - 8 - T;
      const sceneW = Math.max(80, colX - 10 - L);
      if (avail >= 90) {
        band = { x: colX, y: T, w: colW, h: avail };
        scene = { x: L, y: T, w: sceneW, h: Math.max(80, B - T - gH - 4) };
        guide = { cx: scene.x + scene.w / 2 - 40, cy: B - gH / 2, r, layout: 'row', maxW: scene.w / 2 };
      } else {
        // too short for the words above the card: a strip under the scene — the guide on its left, the words beside
        const stripH = Math.max(84, gH);
        const gw = Math.min(170, sceneW * 0.42);
        guide = { cx: L + r + 8, cy: B - stripH / 2, r, layout: 'row', maxW: gw - 2 * r - 16 };
        band = { x: L + gw, y: B - stripH, w: Math.max(60, sceneW - gw), h: stripH };
        scene = { x: L, y: T, w: sceneW, h: Math.max(80, B - stripH - 6 - T) };
      }
    } else {
      band = { x: colX, y: T, w: colW, h: Math.max(56, B - T - gH - 6) };
      scene = { x: L, y: T, w: Math.max(80, colX - 10 - L), h: B - T };
      guide = { cx: colX + colW / 2 - 40, cy: B - gH / 2, r, layout: 'row', maxW: colW / 2 };
    }
    closeArea = { x: colX, y: T, w: colW, h: B - T };
  } else {
    const bandH = Math.max(104, Math.min(140, H * 0.14));
    const bandW = Math.min(820, (R - L) - 2 * (card.w + 24));
    band = { x: (W - bandW) / 2, y: B - bandH, w: bandW, h: bandH };
    if (tracks) music = { x: R - card.w, y: B - card.h, w: card.w, h: card.h };
    const r = Math.max(28, Math.min(38, bandH * 0.24)), gH = guideHeight(r, 'stack');
    guide = { cx: Math.max(L + 80, band.x - 24 - 80), cy: B - gH + 10 + r, r, layout: 'stack', maxW: 160 };
    scene = { x: L, y: T, w: R - L, h: Math.max(120, band.y - 10 - T) };
    closeArea = { x: band.x, y: band.y - 30, w: band.w, h: B - band.y + 30 };
  }

  const heart = fit(scene, kind);
  // the close: its question line and the row at the bottom of its area
  const rh = rateH(closeArea.w);
  const rateArea: Rect = { x: closeArea.x, y: closeArea.y + closeArea.h - rh, w: closeArea.w, h: rh };
  const rateQ: Rect = { x: closeArea.x, y: rateArea.y - 46, w: closeArea.w, h: 42 };
  const textH = kind === 'wide' ? 112 : Math.max(60, rateQ.y - 6 - closeArea.y);
  const closeText: Rect = { x: closeArea.x, y: rateQ.y - 6 - textH, w: closeArea.w, h: textH };
  // the heart in the close: where the blessing reaches into the scene (the desk; a phone whose scene runs down
  // beside the card), it moves up and a little smaller
  let sX = heart.sC, cyX = heart.cyC;
  const room = closeText.y - 10 - scene.y;
  if (heart.cyC + HEART.bottom * heart.sC > closeText.y - 10) {
    sX = Math.max(28, Math.min(heart.sC, room / (HH + 0.24)));   // (room for the beat's swell)
    cyX = scene.y + Math.max(0, (room - HH * sX) / 2) - HEART.top * sX;
  }
  const base = { w: W, h: H, kind, ...heart, scene, band, guide, music, rateQ, rate: rateRow(rateArea), closeText, cyX, sX, font };
  return { ...base, music2: music ? secondPlace(base, music, { L, R, T, B }) : null };
}

/** What the second card must never cover (canvas CSS px): the heart wherever it stands, the cloth, the words, the guide. */
export function keepClear(l: Omit<Layout, 'music2'>): Rect[] {
  const box = (cx: number, cy: number, s: number): Rect => ({ x: cx - 1.08 * s, y: cy + (HEART.top - 0.06) * s, w: 2.16 * s, h: (HH + 0.12) * s });
  const g = l.guide, gh = guideHeight(g.r, g.layout);
  return [
    box(l.cx, l.cy, l.s), box(l.cx, l.cyC, l.sC), box(l.cx, l.cyX, l.sX),
    { x: l.cx + l.cloth.x0 * l.s, y: l.cy + l.cloth.y0 * l.s, w: (l.cloth.x1 - l.cloth.x0) * l.s, h: (l.cloth.y1 - l.cloth.y0 + 0.1) * l.s },
    l.band,
    g.layout === 'row' ? { x: g.cx - g.r - 4, y: g.cy - gh / 2, w: 2 * g.r + 8 + g.maxW, h: gh } : { x: g.cx - Math.max(g.r, g.maxW / 2), y: g.cy - g.r - 4, w: 2 * Math.max(g.r, g.maxW / 2), h: gh },
  ];
}

const meets = (a: Rect, b: Rect, pad = 0): boolean => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** The second card's place: above the first, else to its left, else to its right — inside the screen, over nothing kept clear. */
function secondPlace(l: Omit<Layout, 'music2'>, m: Rect, box: { L: number; R: number; T: number; B: number }): Rect | null {
  const gap = 12;
  const tries: Rect[] = [
    { x: m.x, y: m.y - gap - m.h, w: m.w, h: m.h },
    { x: m.x - gap - m.w, y: m.y, w: m.w, h: m.h },
    { x: m.x + m.w + gap, y: m.y, w: m.w, h: m.h },
  ];
  const clear = keepClear(l);
  return tries.find(r => r.x >= box.L - 0.5 && r.x + r.w <= box.R + 0.5 && r.y >= box.T - 0.5 && r.y + r.h <= box.B + 0.5 && !clear.some(c => meets(r, c, 6))) ?? null;
}

/** A heart point (heart units) on the screen for a heart centred at (cx, cy). */
export const toScreen = (l: Pick<Layout, 'cx' | 'cy' | 's'>, x: number, y: number): [number, number] => [l.cx + x * l.s, l.cy + y * l.s];

/** Where the hands hold a piece up in the light (heart units): before the heart, a little below its middle. */
export const HOLD = { x: 0, y: 0.16 };
