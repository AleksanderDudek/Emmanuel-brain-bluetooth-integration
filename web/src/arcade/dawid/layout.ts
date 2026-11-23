/**
 * Where Dawid's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12): sized for a phone
 * 360 px wide held upright at u = 1, grown to a tablet or a desktop (u ≤ 1.3).  The runner's HUD covers the
 * top (`insets.top`), the home indicator the bottom (`insets.bottom`), a notch the sides; the map runs under
 * all of it, the game's own bits stay inside.
 *
 *   the top band      under the HUD, passive: the quest pill (a tap there sends David to the quest — a
 *                     shortcut, never needed) and the minimap
 *   the field         David stands in its middle; the camera follows him
 *   the bottom band   the thumb zone: the great stone and the bag as two big round buttons at the bottom
 *                     right, the party, health and the level's bar at the bottom left (stacked on a narrow
 *                     phone, one row where the screen is wide)
 *   the camp's sheet  in camp: from the bottom on a phone held upright or a tablet (two columns of tiles on a
 *                     phone, three or four on a tablet), from the right on a phone on its side or a desktop —
 *                     the field keeps the rest, with David in its middle
 *
 * A desktop with a mouse (DESIGN §14: `screenKind` says 'desktop' or 'big') gets a family of its own: the
 * camera zooms with a big canvas (about 14.5 × 11 u in view, David over 100 px tall on a Full HD monitor's
 * middle column), the great stone and the bag stand under David as an action bar with their keys, the party,
 * health and the level in the hero's frame at the bottom left, a larger minimap, the camp's sheet from the right.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import { pacerLeast, pacerSize, pacerSpot, safeBand, type Pt } from '../kit/pacerspot';
import type { Insets } from '../kit/types';

/** Nothing to press within this many px of the screen's left and right edges (Safari's back swipe, DESIGN §12.2). */
export const EDGE = 16;
/** A primary button's radius at u = 1 (a 60 px disc; a tablet's grows to 69). */
export const BUTTON_R = 30;
/** The camp sheet's tabs and tiles (at u = 1): at least a finger's 48 px. */
export const TAB_H = 48;
export const TILE_H = 60;

export interface Rect { x: number; y: number; w: number; h: number }

/** A round button: its centre and radius, and the rectangle a tap hits (its label under it included). */
export interface Button { x: number; y: number; r: number; hit: Rect }

export interface SheetLayout {
  /** docked at the bottom (a phone held upright, a tablet) or on the right (a phone on its side, a desktop) */
  dock: 'bottom' | 'right';
  /** the sheet fully open */
  x: number;
  y: number;
  w: number;
  h: number;
  pad: number;
  gap: number;
  /** the header row (the treasury) and the "Na łowy" button in it */
  head: Rect;
  hunt: Rect;
  /** the four tabs */
  tabs: Rect[];
  /** the tiles' window: it scrolls when a tab has more rows than fit */
  view: Rect;
  cols: number;
  tileW: number;
  tileH: number;
}

export interface Layout {
  w: number;
  h: number;
  /** what the runner and the device cover: the HUD band's lower edge, the home indicator's upper edge, a notch */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop, growing on a big screen (kit/mobile.ts) */
  u: number;
  /** the kind of screen (kit/mobile.ts) */
  kind: ScreenKind;
  /** the desktop family (a mouse on a desktop or a big screen): the action bar under David, key caps, hover */
  desk: boolean;
  /** a canvas wider than tall (a phone on its side, a desktop window) */
  side: boolean;
  /** the margin of the passive bits */
  m: number;
  /** px per u of the map, where David stands (px), and the half-size of the view (u) */
  s: number;
  kx: number;
  ky: number;
  halfW: number;
  halfH: number;
  /** where David stands while the camp's sheet is open */
  campKx: number;
  campKy: number;
  /** the field between the top band and the bottom band: bubbles, the quest's arrow and hints keep inside it */
  field: { top: number; bottom: number };
  /** the bottom band's bits: the level's badge and bar, health, the party, the treasury, the two buttons */
  lv: Rect;
  xp: Rect;
  hp: Rect;
  party: { x: number; y: number; r: number; gap: number };
  /** where the treasury's number ends (right-aligned) and its middle line */
  treasury: { x: number; y: number };
  /** the bottom band laid out in one row (a wide screen) rather than stacked (a narrow phone) */
  row: boolean;
  bag: Button;
  stone: Button;
  /** the top band: the quest pill (its widest; one line high, two when the words need it) and the minimap */
  quest: Rect;
  mini: Rect | null;
  sheet: SheetLayout;
  bannerY: number;
}

/** A rectangle grown to at least `min` on each side around its centre (a finger-sized hit area). */
export function grow(r: Rect, min = MIN_TAP): Rect {
  const w = Math.max(r.w, min), h = Math.max(r.h, min);
  return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
}

/**
 * The play view's layout for a canvas of w × h CSS px with the runner's insets; `touch`: the primary input is a
 * finger (a phone or a tablet keeps the phone's layout whatever its size; a mouse on a desktop-sized canvas
 * gets the desktop family).
 */
export function layout(w: number, h: number, ins: Insets = NO_INSETS, touch = true): Layout {
  const kind = screenKind(w, h, touch);
  if (kind === 'desktop' || kind === 'big') return deskLayout(w, h, ins, kind);
  const u = uiScale(w, h);
  const top = clamp(ins.top, 0, h * 0.6);
  const bottom = Math.max(top + 120, h - ins.bottom);
  const left = ins.left, right = w - ins.right;
  const side = w > h * 1.15;
  const m = 10 * u;
  // where a control may reach: EDGE from the screen's sides, inside a notch
  const xMin = Math.max(EDGE, left + 6), xMax = Math.min(w - EDGE, right - 6);

  // ── the bottom band: the two buttons at the bottom right ──────────
  const R = BUTTON_R * Math.min(u, 1.15);
  const hw = Math.max(R + 2, MIN_TAP / 2);
  const labelH = 18 * u;
  const bb = bottom - 8;
  const by = bb - labelH - 4 - R;
  const button = (cx: number): Button => ({ x: cx, y: by, r: R, hit: { x: cx - hw, y: by - hw, w: hw * 2, h: bb - (by - hw) } });
  const bag = button(xMax - hw);
  const stone = button(bag.x - hw * 2 - 12 * u);
  // ── the bottom band: the party, health and the level, at the bottom left ─────
  const bl = left + m, br = stone.hit.x - 10 * u;
  const row = br - bl >= 400 * u;
  const pr = 15 * u;
  let lv: Rect, xp: Rect, hp: Rect, party: Layout['party'], treasury: Layout['treasury'];
  const lvW = 64 * u, lvH = 26 * u, xpH = 17 * u, hpH = 16 * u;
  if (row) {
    // one row: the party, the level's badge and bar, health
    const cy = bb - lvH / 2;
    party = { x: bl + pr + 2, y: cy, r: pr, gap: pr * 2 + 7 * u };
    const x0 = bl + 3 * party.gap + 4 * u;
    lv = { x: x0, y: cy - lvH / 2, w: lvW, h: lvH };
    const rest = br - (lv.x + lv.w + 6 * u);
    xp = { x: lv.x + lv.w + 6 * u, y: cy - xpH / 2, w: rest * 0.56, h: xpH };
    hp = { x: xp.x + xp.w + 12 * u, y: cy - hpH / 2, w: rest * 0.44 - 12 * u, h: hpH };
    treasury = { x: bag.hit.x + bag.hit.w, y: bag.hit.y - 12 * u };
  } else {
    // stacked: the level's badge and bar at the bottom, health over it, the party and the treasury over that
    lv = { x: bl, y: bb - lvH, w: lvW, h: lvH };
    xp = { x: lv.x + lv.w + 6 * u, y: lv.y + (lvH - xpH) / 2, w: br - (lv.x + lv.w + 6 * u), h: xpH };
    hp = { x: bl, y: lv.y - 8 * u - hpH, w: br - bl, h: hpH };
    party = { x: bl + pr + 2, y: hp.y - 7 * u - pr, r: pr, gap: pr * 2 + 7 * u };
    treasury = { x: br, y: party.y };
  }
  // the band's upper edge in the screen's middle column, where David stands (in one row the buttons keep to the corner)
  const bandTop = row ? lv.y - 4 : Math.min(party.y - pr - 4, stone.hit.y);

  // ── the top band: the quest pill and the minimap ─────────────────
  const mw = w < 520 ? 84 * u : 112 * u;
  const mini = h - top < 260 ? null : { x: right - m - mw, y: top + 8, w: mw, h: mw * (42 / 64) };
  const qx = Math.max(left + m, xMin - 4);
  const quest = { x: qx, y: top + 8, w: Math.min(440 * u, (mini ? mini.x - 8 : right - m) - qx), h: 32 * u };

  // ── the field and the camera ─────────────────────────────────────
  const field = { top: quest.y + quest.h + 6, bottom: bandTop - 6 };
  // the map's scale: a phone sees about 11.5 u across and 8.5 u from the HUD to the band (the sling's reach on
  // either side); a tablet zooms in rather than showing the world small
  const s = clamp(Math.min((right - left) / 11.5, (bandTop - top) / 8.5), 28, 66);
  const kx = (left + right) / 2;
  const ky = top + (bandTop - top) * 0.56;
  const halfW = Math.max(kx - left, right - kx) / s;
  const halfH = Math.max(ky - top, bottom - ky) / s;

  // ── the camp's sheet ──────────────────────────────────────────────
  const sheet = sheetLayout(u, top, bottom, w, xMin, xMax, side, field.top);
  const campKx = sheet.dock === 'right' ? (left + sheet.x) / 2 : kx;
  // above a bottom sheet: David's feet low in the room left (his head clear of the quest pill)
  const campKy = sheet.dock === 'right' ? ky : Math.max(field.top + s * 1.75, field.top + (sheet.head.y - field.top) * 0.78);

  return {
    w, h, top, bottom, left, right, u, kind, desk: false, side, m, s, kx, ky, halfW, halfH, campKx, campKy, field,
    lv, xp, hp, party, treasury, row, bag, stone, quest, mini, sheet, bannerY: field.top + 40 * u,
  };
}

/** A key cap's room beside a control (the desktop family): its size at u. */
export const CAP = 19;

/**
 * The desktop family (a mouse on a desktop or a big screen, DESIGN §14).  The world fills the canvas: the camera
 * zooms with a big one (≈ 14.5 u across and 10.8 u down: ~80 px/u in a Full HD monitor's middle column, ~109 on a
 * 2560 × 1440 one), a desktop under the top HUD keeps ≈ 9.2 u of height (as close as the phone's family there).  The great stone and the bag are an
 * action bar right under David (the bottom's middle), each with its key cap; the party, health, the level's bar
 * and the treasury stack in the hero's frame at the bottom left (at most 340·u wide, never a bar across the whole
 * screen); the quest pill under the HUD on the left, a larger minimap on the right; the camp's sheet from the
 * right (three columns), David in the middle of the field it leaves.
 */
function deskLayout(w: number, h: number, ins: Insets, kind: ScreenKind): Layout {
  const u = uiScale(w, h);
  const big = kind === 'big';
  const top = clamp(ins.top, 0, h * 0.6);
  const bottom = Math.max(top + 120, h - ins.bottom);
  const left = ins.left, right = w - ins.right;
  const m = 12 * u;
  const xMin = Math.max(EDGE, left + 6), xMax = Math.min(w - EDGE, right - 6);
  const kx = (left + right) / 2;

  // ── the action bar under David: the great stone and the bag, side by side ─────
  const R = 27 * u;
  const hw = Math.max(R + 2, MIN_TAP / 2);
  const labelH = 18 * u;
  const bb = bottom - 10 * u;
  const by = bb - labelH - 4 - R;
  const button = (cx: number): Button => ({ x: cx, y: by, r: R, hit: { x: cx - hw, y: by - hw, w: hw * 2, h: bb - (by - hw) } });
  const gap = 22 * u;
  const stone = button(kx - hw - gap / 2);
  const bag = button(kx + hw + gap / 2);

  // ── the hero's frame at the bottom left: the party and the treasury, health, the level's badge and bar ─────
  const bl = left + m, br = Math.min(bl + 340 * u, stone.hit.x - CAP * u - 16 * u);
  const pr = 17 * u;
  const lvW = 66 * u, lvH = 26 * u, xpH = 17 * u, hpH = 16 * u;
  const lv = { x: bl, y: bb - lvH, w: lvW, h: lvH };
  const xp = { x: lv.x + lv.w + 6 * u, y: lv.y + (lvH - xpH) / 2, w: br - (lv.x + lv.w + 6 * u), h: xpH };
  const hp = { x: bl, y: lv.y - 8 * u - hpH, w: br - bl, h: hpH };
  const party = { x: bl + pr + 2, y: hp.y - 8 * u - pr, r: pr, gap: pr * 2 + 8 * u };
  const treasury = { x: br, y: party.y };
  const bandTop = stone.hit.y - CAP * u * 0.5;

  // ── the top band: the quest pill and a larger minimap ─────────────
  const mw = 150 * u;
  const mini = h - top < 260 ? null : { x: right - m - mw, y: top + 8, w: mw, h: mw * (42 / 64) };
  const qx = Math.max(left + m, xMin - 4);
  const quest = { x: qx, y: top + 8, w: Math.min(460 * u, (mini ? mini.x - 12 * u : right - m) - qx), h: 34 * u };

  // ── the field and the camera ─────────────────────────────────────
  const field = { top: quest.y + quest.h + 6, bottom: bandTop - 6 };
  const s = big
    ? clamp(Math.min((right - left) / 14.5, (bottom - top) / 10.8), 28, 170)
    : clamp(Math.min((right - left) / 12.5, (bottom - top) / 9.2), 28, 66);
  const ky = top + (bandTop - top) * 0.53;
  const halfW = Math.max(kx - left, right - kx) / s;
  const halfH = Math.max(ky - top, bottom - ky) / s;

  // ── the camp's sheet, from the right ──────────────────────────────
  const sheet = sheetLayout(u, top, bottom, w, xMin, xMax, true, field.top);
  const campKx = (left + sheet.x) / 2;

  return {
    w, h, top, bottom, left, right, u, kind, desk: true, side: true, m, s, kx, ky, halfW, halfH, campKx, campKy: ky, field,
    lv, xp, hp, party, treasury, row: false, bag, stone, quest, mini, sheet, bannerY: field.top + 40 * u,
  };
}

/**
 * The camp's sheet: the treasury and "Na łowy" (two plates on the sheet's top edge at the bottom, a row inside
 * it on the right), four tabs and the tiles, at least two columns.  At the bottom it keeps room above it for
 * David (84 px at least, about 40 % of the field where there is room); on the right it takes at most 60 % of
 * the width.  Its height does not change between the tabs (the longest has nine tiles).
 */
function sheetLayout(u: number, top: number, bottom: number, w: number, xMin: number, xMax: number, side: boolean, fieldTop: number): SheetLayout {
  const pad = 8 * u, gap = 8 * u;
  const earH = 36 * u, tabH = Math.max(TAB_H, 44 * u), tileH = TILE_H * u;
  const huntW = 120 * u;
  const rowsFor = (cols: number) => Math.ceil(9 / cols);
  let x: number, y: number, sw: number, sh: number, cols: number, headY: number;
  if (!side) {
    // from the bottom, full width (the tiles keep EDGE from the screen's sides); the plates straddle its top edge
    x = xMin - pad;
    sw = xMax + pad - x;
    cols = clamp(Math.floor((sw - 2 * pad + gap) / (150 * u + gap)), 2, 4);
    const fixed = earH / 2 + 10 * u + tabH + 8 * u + pad;
    const content = rowsFor(cols) * (tileH + gap) - gap;
    const most = bottom - (fieldTop + 84 + earH / 2);
    const want = Math.max(fixed + 2 * tileH + gap, (bottom - fieldTop) * 0.6);
    sh = Math.max(fixed + tileH, Math.min(most, want, fixed + content));
    y = bottom - sh;
    headY = y - earH / 2;
  } else {
    // from the right: two columns on a phone on its side, three where there is room; the plates inside it
    cols = w >= 1100 ? 3 : 2;
    const tileW = Math.max(150 * u, Math.min(190 * u, ((w * 0.5) - 2 * pad - (cols - 1) * gap) / cols));
    sw = Math.min(cols * tileW + (cols - 1) * gap + 2 * pad, (xMax - xMin) * 0.6);
    x = xMax + pad - sw;
    y = top + 6;
    const fixed = pad + earH + 10 * u + tabH + 8 * u + pad;
    const content = rowsFor(cols) * (tileH + gap) - gap;
    sh = Math.min(bottom - 6 - y, fixed + content);
    headY = y + pad;
  }
  const ix = x + pad, iw = sw - 2 * pad;
  const head = { x: ix, y: headY, w: iw, h: earH };
  const hunt = { x: ix + iw - huntW, y: headY, w: huntW, h: earH };
  const tw = (iw - 3 * 6 * u) / 4;
  const ty = headY + earH + 10 * u;
  const tabs = [0, 1, 2, 3].map(i => ({ x: ix + i * (tw + 6 * u), y: ty, w: tw, h: tabH }));
  const vy = ty + tabH + 8 * u;
  const view = { x: ix, y: vy, w: iw, h: Math.max(0, y + sh - pad - vy) };
  const tileW = (iw - (cols - 1) * gap) / cols;
  return { dock: side ? 'right' : 'bottom', x, y, w: sw, h: sh, pad, gap, head, hunt, tabs, view, cols, tileW, tileH };
}

/**
 * Where the runner's breath pacer stands in a Harfa (ArcadeGame.pacerAt; kit/pacerspot.ts): off the quest pill (a
 * tap there follows the quest) and the minimap in the top band, the bottom band (the buttons, health, the level, the
 * party), David at the fire with his harp, and the camp's sheet while it is open — the map's open field over David,
 * clear of the line the game's banners stand on where the field has the room (a desktop: the top's middle between the
 * quest pill and the minimap, as before), else under him; in camp on a small phone, the room over the sheet.
 */
export function pacerAt(L: Layout, camp = false): Pt | null {
  const size = pacerSize(L.kind === 'big');
  const band = safeBand(L.w, L.h, { top: L.top, right: L.w - L.right, bottom: L.h - L.bottom, left: L.left });
  const u = L.u, s = L.s;
  // the quest pill at its tallest (two lines), the minimap; the bottom band; David by the fire (his feet at kx, ky)
  const quest = { x: L.quest.x, y: L.quest.y, w: L.quest.w, h: L.quest.h * 1.8 };
  const p = L.party;
  const party = { x: p.x - p.r, y: p.y - p.r, w: 2 * p.r + 2 * p.gap, h: 2 * p.r };
  const kx = camp ? L.campKx : L.kx, ky = camp ? L.campKy : L.ky;
  const david = { x: kx - s * 0.9, y: ky - s * 1.5, w: s * 1.8, h: s * 1.9 };
  const ui = [quest, ...(L.mini ? [L.mini] : []), L.lv, L.xp, L.hp, party, L.bag.hit, L.stone.hit, ...(camp ? [L.sheet] : [])];
  const banner = { x: L.left, y: L.bannerY - 20 * u, w: L.right - L.left, h: 40 * u };
  const over = { x: band.x, y: band.y, w: band.w, h: Math.max(0, david.y - band.y) };
  return pacerSpot([over], [...ui, david, banner], { size })
    ?? pacerSpot([over], [...ui, david], { size })
    ?? pacerSpot([band], [...ui, david, banner], { size })
    ?? pacerLeast([band], ui, [david], { size, pad: 2 });
}
