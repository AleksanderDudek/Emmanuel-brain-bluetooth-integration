/**
 * Where Drzewo nad wodą's play view puts things (CSS px), phone first (DESIGN §12, §14).  The runner's HUD covers
 * the canvas top (`insets().top`), the home indicator its bottom, a notch the sides; the sky and the soil run under
 * all of them, the game's own words and controls stay inside.  Three shapes:
 *
 *   tall   a phone held upright (the reference: 360 × 500 with a 134 px HUD): the cross-section in the stage, the
 *          words band at the bottom (the stage's name, what to do now, the prayer — or the breath and the verse, or
 *          a fruit's reflection), ≡ at the stage's lower right, above the band, in the thumb zone
 *   side   a phone on its side: the cross-section on the left, the words in a column on the right, ≡ under them
 *   wide   a tablet on its side, and a desktop or a big screen with a mouse (`desk`): the cross-section as tall as the
 *          band with a wide sky and land at the sides, the words in a column beside the crown at a reading measure
 *
 * The world is the figure's units (tree.ts): a point (x, y) is at (cx + x·H, oy + y·H).  The scale H fits the tree
 * (the crown to the ground) into the stage; where the whole cross-section — crown to stream — does not fit, the
 * camera **pans** between framings (the roots, the water rising, the tree), never zooms, so every baked layer stays
 * crisp.  Text is always drawn in screen space.  Everything here is pure: the tests run it at every CHECK_SIZES entry.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import type { Posture } from './content';
import { BOTTOM, FRUIT_R, HALF_W, framing, fruitPlace, worldTop, type Framing } from './tree';

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
  /** the world's scale and its midline on the screen */
  H: number;
  cx: number;
  /** the band the scene's framing fits into */
  stage: Rect;
  /** the camera pans between framings (the whole does not fit) */
  pan: boolean;
  /** the words: the band (tall) or the column (side, wide) */
  band: Rect;
  /** the narrator's caption (passive) */
  caption: Rect;
  /** ≡ */
  menu: Rect;
  /** the story card's box, the picker's box */
  story: Rect;
  picker: Rect;
  font: { label: number; line: number; lineMin: number; caption: number; small: number; now: number; name: number };
}

/** The spans of the framings for both postures (figure units). */
const SPAN_TREE = Math.max(framing('tree', 'stand').y1 - framing('tree', 'stand').y0, framing('roots', 'stand').y1 - framing('roots', 'stand').y0);
const SPAN_WHOLE = BOTTOM - worldTop('stand');
/** The world's width (the crown, the land beside it) that must fit across. */
const WORLD_W = 2 * HALF_W * 0.98;

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
    ? { label: Math.round(14 * u), line: Math.round(18.5 * u), lineMin: Math.max(15, Math.round(15 * u)), caption: Math.round(14 * u), small: Math.round(12.5 * u), now: Math.round(13.5 * u), name: Math.round(22 * u) }
    : { label: Math.round(13 * u), line: Math.round(17 * u), lineMin: 15, caption: Math.max(13, Math.round(13 * u)), small: Math.max(12, Math.round(12 * u)), now: Math.max(13, Math.round(13 * u)), name: Math.round(20 * u) };
  const btn = Math.round(Math.max(48, 48 * Math.min(u, 1.4)));
  const pickW = (avail: number) => Math.min(avail, Math.round(420 * Math.min(u, 1.5)));

  if (shape === 'tall') {
    const bandH = Math.round(clamp(bh * 0.3, 118, 176 * u));
    const band = { x: left + edge, y: bottom - bandH - 6, w: bw - 2 * edge, h: bandH };
    const stage = { x: left + edge, y: top + 4, w: bw - 2 * edge, h: band.y - 8 - (top + 4) };
    const fit = fitWorld(stage, kind === 'tablet' ? 0.6 : 0.9);
    const menu = { x: right - edge - btn, y: band.y - 8 - btn, w: btn, h: btn };
    // the narrator just above the band, left of ≡ (over the ground, never over the crown or the HUD)
    const capH = Math.round(font.caption * 1.35) * 2 + 8;
    const caption = { x: left + edge, y: band.y - 6 - capH, w: bw - 2 * edge - btn - 8, h: capH };
    const pw = pickW(bw - 2 * edge);
    return {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, ...fit, stage, band, caption, menu, font,
      story: { x: left + edge, y: top + 8, w: bw - 2 * edge, h: bh - 16 },
      picker: { x: (left + right - pw) / 2, y: top + 8, w: pw, h: bh - 16 },
    };
  }

  if (desk || shape === 'wide') {
    // the cross-section as tall as the band, the words beside the crown; the group centred
    const stage0 = { x: left + edge, y: top + 8, w: bw, h: bh - 16 };
    // the whole cross-section in view; on a short screen (a laptop under the HUD and the chart) the tree larger and
    // the view panning down to the roots, as on a phone
    const Hwhole = Math.min(stage0.h / SPAN_WHOLE, (bw * 0.6) / WORLD_W);
    const Htree = Math.min(stage0.h / SPAN_TREE, (bw * 0.55) / WORLD_W);
    const pan = Hwhole < 280 && Htree > Hwhole * 1.15;
    const H = Math.max(80, pan ? Htree : Hwhole);
    const colW = Math.round(Math.max(260, Math.min(17 * font.line, bw - 2 * edge - WORLD_W * H - 40 * u)));
    const groupW = WORLD_W * H + 36 * u + colW;
    const x0 = left + Math.max(edge, (bw - groupW) / 2);
    const cx = x0 + (WORLD_W * H) / 2;
    const stage = { x: x0, y: top + 8, w: WORLD_W * H, h: bh - 16 };
    const colX = Math.min(right - edge - colW, cx + (WORLD_W * H) / 2 + 36 * u);
    const bandH = Math.round(clamp(bh * 0.46, 200, 330 * u));
    const capH = Math.round(font.caption * 1.35) * 2 + 8;
    const band = { x: colX, y: top + Math.max(capH + 20, (bh - bandH) / 2), w: colW, h: bandH };
    const caption = { x: colX, y: band.y - capH - 8, w: colW, h: capH };
    const menu = { x: colX, y: Math.min(bottom - 12 - btn, band.y + band.h + 14), w: btn, h: btn };
    const pw = pickW(bw - 2 * edge);
    return {
      w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, H, cx, pan, stage, band, caption, menu, font,
      story: { x: (left + right - Math.min(bw - 2 * edge, 560 * u)) / 2, y: top + 8, w: Math.min(bw - 2 * edge, 560 * u), h: bh - 16 },
      picker: { x: (left + right - pw) / 2, y: top + 8, w: pw, h: bh - 16 },
    };
  }

  // a phone on its side: the cross-section left, the words right, ≡ under them
  const stageH = bh - 12;
  const H = Math.max(80, Math.min(stageH / SPAN_TREE, (bw * 0.42) / WORLD_W));
  const sw = WORLD_W * H;
  const stage = { x: left + 8, y: top + 6, w: sw, h: stageH };
  const fit = fitWorld(stage, 0.9, H);
  const colX = stage.x + sw + 14;
  const colW = right - edge - colX;
  const capH = Math.round(font.caption * 1.35) * 2 + 6;
  const menu = { x: right - edge - btn, y: bottom - 8 - btn, w: btn, h: btn };
  const band = { x: colX, y: top + capH + 12, w: colW, h: menu.y - 8 - (top + capH + 12) };
  const caption = { x: colX, y: top + 6, w: colW, h: capH };
  const pw = pickW(bw - 2 * edge);
  return {
    w, h, ins, top, bottom, left, right, shape, touch, kind, desk, u, ...fit, stage, band, caption, menu, font,
    story: { x: left + edge, y: top + 6, w: bw - 2 * edge, h: bh - 12 },
    picker: { x: (left + right - pw) / 2, y: top + 6, w: pw, h: bh - 12 },
  };
}

/** The world's scale in a stage: the tree's framing fitted (panning), or the whole when it fits at `keep` of that scale. */
function fitWorld(stage: Rect, keep: number, Hgiven?: number): { H: number; cx: number; pan: boolean } {
  const Htree = Hgiven ?? Math.max(60, Math.min(stage.h / SPAN_TREE, stage.w / WORLD_W));
  const Hwhole = Math.min(stage.h / SPAN_WHOLE, stage.w / WORLD_W);
  const whole = Hwhole >= keep * Htree;
  return { H: whole ? Hwhole : Htree, cx: stage.x + stage.w / 2, pan: !whole };
}

/** The camera: the screen y of the world's y = 0 for a framing (the whole when the layout does not pan). */
export function camFor(L: Layout, f: Framing, posture: Posture): number {
  const r = framing(L.pan ? f : 'whole', posture);
  const S = L.stage, H = L.H;
  const span = (r.y1 - r.y0) * H;
  let oy = S.y + (S.h - span) / 2 - r.y0 * H;
  // never show below the rock under the stream
  oy = Math.max(oy, S.y + S.h - BOTTOM * H);
  return oy;
}

/** World to screen. */
export const sx = (L: Pick<Layout, 'cx' | 'H'>, x: number): number => L.cx + x * L.H;
export const sy = (L: Pick<Layout, 'H'>, oy: number, y: number): number => oy + y * L.H;

/** The area a tap opens a fruit in: round the crown's arc of fruit (on the screen, clipped to the stage, clear of ≡). */
export function crownRect(L: Layout, oy: number, posture: Posture): Rect | null {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 9; i++) {
    for (const slot of [0, 2]) {
      const [x, y] = fruitPlace(i, slot, posture);
      x0 = Math.min(x0, x - FRUIT_R * 2); x1 = Math.max(x1, x + FRUIT_R * 2);
      y0 = Math.min(y0, y - FRUIT_R * 2); y1 = Math.max(y1, y + FRUIT_R * 2);
    }
  }
  const S = L.stage;
  const r = { x: sx(L, x0), y: sy(L, oy, y0), w: (x1 - x0) * L.H, h: (y1 - y0) * L.H };
  const cx0 = Math.max(r.x, S.x, L.left), cy0 = Math.max(r.y, S.y, L.top);
  const cx1 = Math.min(r.x + r.w, S.x + S.w, L.right), cy1 = Math.min(r.y + r.h, S.y + S.h, L.menu.y - 8 > cy0 && L.shape === 'tall' ? L.menu.y - 8 : S.y + S.h);
  if (cx1 - cx0 < MIN_TAP || cy1 - cy0 < MIN_TAP) return null;
  return { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 };
}

// ── the picker ───────────────────────────────────────────────────

export interface PickerParts { card: Rect; title: number; posture: Rect[]; season: Rect[]; close: Rect; labels: { posture: number; season: number }; note: number }

/** The picker's parts: its card, the two posture buttons, the five season buttons (in two rows on a narrow card), close. */
export function pickerParts(L: Layout): PickerParts {
  const P = L.picker, pad = Math.round(14 * Math.min(L.u, 1.4));
  const bh = Math.max(MIN_TAP, Math.round(46 * Math.min(L.u, 1.4))), gap = 8;
  const innerW = P.w - 2 * pad;
  const lab = Math.round(L.font.label * 1.6);
  const titleH = Math.round(L.font.name * 1.5);
  const seasonsPerRow = innerW / 5 - gap >= 58 ? 5 : 3;
  const seasonRows = seasonsPerRow === 5 ? 1 : 2;
  const core = pad + titleH + lab + bh + 10 + lab + seasonRows * bh + (seasonRows - 1) * gap + 10 + 6 + bh + pad;
  // the note on dizziness where there is room for it (a phone on its side has none: the lobby's card says it too)
  const noteFull = Math.round(Math.max(13, L.font.small) * 1.35) * 2 + 4;
  const noteH = core + noteFull <= P.h ? noteFull : 0;
  const height = core + noteH;
  const card = { x: P.x, y: P.y + Math.max(0, (P.h - height) / 2), w: P.w, h: Math.min(P.h, height) };
  let y = card.y + pad;
  const title = y + titleH / 2;
  y += titleH;
  const lp = y + lab / 2;
  y += lab;
  const pw = (innerW - gap) / 2;
  const posture = [0, 1].map(i => ({ x: card.x + pad + i * (pw + gap), y, w: pw, h: bh }));
  y += bh + 10;
  const ls = y + lab / 2;
  y += lab;
  const sw = (innerW - (seasonsPerRow - 1) * gap) / seasonsPerRow;
  const season = [0, 1, 2, 3, 4].map(i => {
    const row = Math.floor(i / seasonsPerRow), col = i % seasonsPerRow;
    return { x: card.x + pad + col * (sw + gap), y: y + row * (bh + gap), w: sw, h: bh };
  });
  y += seasonRows * bh + (seasonRows - 1) * gap + 10;
  const note = noteH ? y + noteH / 2 : -1;
  y += noteH + 6;
  const cw = Math.min(innerW, Math.max(140, innerW * 0.5));
  const close = { x: card.x + (card.w - cw) / 2, y, w: cw, h: bh };
  return { card, title, posture, season, close, labels: { posture: lp, season: ls }, note };
}

// ── the targets ──────────────────────────────────────────────────

export interface TargetState {
  story: Rect | null;
  picker: boolean;
  card: boolean;
  /** the crown's fruit area when a ripe fruit hangs there */
  crown: Rect | null;
  menu: boolean;
}

/** Every control the player can tap now (as `hit` tests them). */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.story) return [{ label: 'story', ...s.story }];
  if (s.picker) {
    const p = pickerParts(L);
    return [
      ...p.posture.map((r, i) => ({ label: `posture${i}`, ...r })),
      ...p.season.map((r, i) => ({ label: `season${i}`, ...r })),
      { label: 'close', ...p.close },
    ];
  }
  const out: TapTarget[] = [];
  if (s.menu) out.push({ label: 'menu', ...L.menu });
  if (s.card) out.push({ label: 'card', ...L.band });
  if (s.crown && !s.card) out.push({ label: 'crown', ...s.crown });
  return out;
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * The lobby's hero and the game card (no words, no controls): the tree — crown, figure, the ground — in the upper part
 * of the picture, where the lobby's title does not cover it, the soil and the stream going on below under the title;
 * on a picture wider than tall, the tree a little right of the middle (the title starts on the left).
 */
export function previewLayout(w: number, h: number): Layout {
  const base = layout(Math.max(200, w), Math.max(200, h), { top: 24, right: 0, bottom: 0, left: 0 }, true);
  const span = 1.12 - worldTop('stand');
  const H = Math.max(10, Math.min((h * 0.6) / span, (w * 0.96) / WORLD_W));
  const cx = w > h * 1.2 ? w * 0.62 : w / 2;
  const stage = { x: cx - (WORLD_W * H) / 2, y: Math.max(4, h * 0.03), w: WORLD_W * H, h: span * H };
  return { ...base, w, h, top: 0, bottom: h, left: 0, right: w, H, cx, pan: true, stage };
}
