/**
 * Where Arka's parts sit on the canvas (CSS px), mobile first (DESIGN §6 "Arka, version 2", §12).  The runner's
 * HUD covers the top of the canvas (`insets().top`), a phone's home indicator or notch the other edges; the
 * sky and the water run under all of them, the game's own parts stay inside.  Sizes start from a 360 px phone
 * at u = 1 (kit/mobile `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall  (a phone upright, a tablet upright)  the deck's bar under the HUD (hearts, the level and its par, the
 *         raven on its rail), the deck as large as the band allows, the gangway, and at the bottom the new land
 *         where the first of each kind waits — with the dove's button, a labelled pill, in the bottom-right
 *         thumb zone
 *   side  (a phone on its side)  three columns under the HUD's one row: the bar and the raven on the left, the
 *         deck as tall as the band in the middle, the new land and the dove's button under the right thumb
 *   wide  (a desktop, a tablet on its side)  the deck in the middle column between the Mendi panel and the
 *         score, up to the top bar; the new land along the bottom with the dove at its right end.  On a big
 *         screen with a mouse (DESIGN §14: a Full HD monitor's middle column and up, where the runner's panel and
 *         score stand beside the canvas and only its top bar lies over it) the bar sits under the top bar and the
 *         deck takes the whole middle — the biggest deck's cells 48 → 71 px on Full HD — the raven beside it,
 *         every part and word grown with the UI scale (`tk`)
 *
 * The boards are portrait-shaped (3×4 … 9×11) and a phone's deck area is landscape-shaped, so the deck may
 * turn a quarter (`rot`) when that gives bigger cells: a pure mapping of the view — the board's cells and the
 * animals' directions stay the rules' own (`toScreen`, `toSim`, `sdir`).  Everything the player taps besides
 * the deck is a rectangle here (`tapTargets`), as the view hit-tests it and the mobile audit checks it.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, screenKind, uiScale, type ScreenKind } from '../kit/mobile';
import { pacerLeastOf, pacerRing, pacerSize, pacerSpot, safeBand, type PacerAt } from '../kit/pacerspot';
import type { Insets, TapTarget } from '../kit/types';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }
export type Mode = 'tall' | 'side' | 'wide';

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop, up to DESK_MAX on a big screen */
  u: number;
  /** the screen (kit/mobile `screenKind`): a big screen with a mouse gets its own `wide` (DESIGN §14) */
  kind: ScreenKind;
  /**
   * The scale of the words: the UI scale capped at 1.15 on a phone and a tablet (the bar, the dove's pill; the
   * cards and the raven at their phone's size) as before, the whole UI scale on a desktop and a big screen.
   */
  tk: number;
  ins: Insets;
  /** the HUD's lower edge (cards and bubbles keep under it) */
  top: number;
  /** the bar: hearts, the level and its par */
  bar: Rect;
  /** the deck's grid on screen; `rot`: turned a quarter clockwise (screen cell = (simRows − 1 − y, x)) */
  deck: Rect;
  cell: number;
  rot: boolean;
  /** the board's own size (cells) and the deck's on screen */
  simCols: number;
  simRows: number;
  cols: number;
  rows: number;
  /** the hull's rim around the deck (px) */
  rim: number;
  /** the new land, the gangway's foot on it (the deck's door), and the slots where the firsts of their kinds wait (their feet) */
  shore: Rect;
  door: Pt;
  slots: Pt[];
  /** the waiting animals' height */
  slotH: number;
  /** the dove's button: a pill with the bird and its name */
  dove: Rect;
  /** the raven's perch (its feet) and its size */
  raven: Pt & { s: number };
}

export const BAR_H = 34;
export const MAX_CELL = 68;

/** The cell size for a board of sc × sr screen cells in a w × h area. */
const fit = (w: number, h: number, sc: number, sr: number, max: number): number => Math.max(12, Math.floor(Math.min(w / sc, h / sr, max)));

/** The deck: as large as the area allows, turned a quarter when that makes the cells larger. */
function deckIn(area: Rect, cols: number, rows: number, max: number, align: 'centre' | 'top' = 'centre'): { deck: Rect; cell: number; rot: boolean; sc: number; sr: number } {
  const straight = fit(area.w, area.h, cols, rows, max), turned = fit(area.w, area.h, rows, cols, max);
  const rot = turned > straight;
  const cell = rot ? turned : straight, sc = rot ? rows : cols, sr = rot ? cols : rows;
  const dw = cell * sc, dh = cell * sr;
  const y = align === 'top' ? area.y : area.y + (area.h - dh) / 2;
  return { deck: { x: Math.round(area.x + (area.w - dw) / 2), y: Math.round(y), w: dw, h: dh }, cell, rot, sc, sr };
}

/** `touch`: the player's hand (a finger by default, as the phone-first tests assume); a mouse on a big screen gets `big`. */
export function layout(w: number, h: number, insets: Insets | number = NO_INSETS, cols: number = 3, rows: number = 4, touch = true): Layout {
  const ins0: Insets = typeof insets === 'number' ? { top: insets, right: 0, bottom: 0, left: 0 } : insets;
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = uiScale(W, H);
  const top = clamp(ins0.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, ins0.right), bottom: Math.max(0, ins0.bottom), left: Math.max(0, ins0.left) };
  const mode: Mode = W / H < 0.95 ? 'tall' : H < 460 ? 'side' : 'wide';
  // the screen decides (DESIGN §14): a phone and a tablet keep their layouts and their words exactly
  const kind = screenKind(W, H, touch);
  const k = { kind, tk: kind === 'desktop' || kind === 'big' ? u : Math.min(u, 1.15) };
  if (mode === 'tall') return { ...tall(W, H, ins, u, cols, rows), ...k };
  if (mode === 'side') return { ...side(W, H, ins, u, cols, rows), ...k };
  return { ...(kind === 'big' ? big(W, H, ins, u, cols, rows) : wide(W, H, ins, u, cols, rows)), ...k };
}

type Parts = Omit<Layout, 'kind' | 'tk'>;

/** The dove's pill: as wide as its words at the label's size, at least a finger. */
const pillW = (u: number): number => Math.round(clamp(118 * u, 104, 150));

/** Slots on the new land for the waiting animals (their feet at y): from `x0` to `x1` a `step` apart, clear of the gangway. */
function slotsOn(x0: number, x1: number, y: number, step: number, gangway: [number, number] | null): Pt[] {
  const out: Pt[] = [];
  for (let x = x0; x <= x1; x += step) {
    if (gangway && x > gangway[0] - step * 0.45 && x < gangway[1] + step * 0.45) continue;
    out.push({ x, y });
  }
  return out;
}

/** The largest cell: a phone's 68 px grown with the UI scale, a quarter more on a screen whose short side passes 700 px. */
const maxCell = (W: number, H: number, u: number): number => MAX_CELL * u * (Math.min(W, H) > 700 ? 1.25 : 1);

function tall(W: number, H: number, ins: Insets, u: number, cols: number, rows: number): Parts {
  const L0 = ins.left, R0 = W - ins.right, mid = (L0 + R0) / 2;
  const edge = W < 600 ? 16 : Math.round(24 * u);
  const yTop = ins.top + 2, yBot = H - ins.bottom - 3;
  const barW = Math.min(R0 - L0 - 12, 640 * u);
  const bar: Rect = { x: Math.round(mid - barW / 2), y: yTop, w: Math.round(barW), h: Math.round(BAR_H * u) };
  // the new land at the bottom: tall enough for the dove's pill (52 px, a primary control) over the home indicator
  const pillH = Math.round(clamp(52 * u, 48, 64));
  const shoreH = pillH + Math.round(8 * u);
  const shore: Rect = { x: 0, y: yBot - shoreH, w: W, h: H - (yBot - shoreH) };
  const pw = pillW(u);
  const dove: Rect = { x: R0 - edge - pw, y: yBot - pillH - 2, w: pw, h: pillH };
  // the deck between the bar and the gangway, its hull's rim inside the room
  const rim0 = 9;
  const area: Rect = { x: L0 + rim0 + 2, y: bar.y + bar.h + rim0 + 2, w: R0 - L0 - 2 * (rim0 + 2), h: shore.y - Math.round(6 * u) - rim0 - (bar.y + bar.h + rim0 + 2) };
  const d = deckIn(area, cols, rows, maxCell(W, H, u));
  const rim = Math.max(8, Math.min(rim0 + 2, d.cell * 0.28));
  const door = { x: d.deck.x + d.deck.w / 2, y: d.deck.y + d.deck.h };
  // the waiting firsts: along the land left of the dove, clear of the gangway
  const slotH = Math.min(shoreH * 0.62, 40 * u);
  const step = clamp(slotH * 1.05, 34, 46 * u);
  const gw = Math.max(18, d.cell * 0.7);
  const slots = slotsOn(L0 + 24, dove.x - step * 0.6, shore.y + shoreH * 0.8, step, [door.x - gw / 2, door.x + gw / 2]);
  // the raven perches on the bar's right end, over the deck's corner
  const s = Math.round(clamp(30 * u, 26, 40));
  const raven = { x: bar.x + bar.w - s * 0.8, y: bar.y + bar.h - 2, s };
  return {
    w: W, h: H, mode: 'tall', u, ins, top: ins.top, bar, deck: d.deck, cell: d.cell, rot: d.rot, simCols: cols, simRows: rows, cols: d.sc, rows: d.sr, rim,
    shore, door, slots, slotH, dove, raven,
  };
}

function side(W: number, H: number, ins: Insets, u: number, cols: number, rows: number): Parts {
  const yTop = ins.top + 4, yBot = H - ins.bottom - 4;
  const L0 = ins.left + 8, R0 = W - ins.right - 8;
  const colW = Math.round(clamp(W * 0.19, 112, 168 * u));
  // the left column: the bar as a card (hearts over the level), the raven under it
  const bar: Rect = { x: L0, y: yTop, w: colW, h: Math.round(94 * u) };
  // the right column: the new land at the foot, the dove's pill under the right thumb
  const pillH = Math.round(clamp(52 * u, 48, 60));
  const dove: Rect = { x: R0 - colW, y: yBot - pillH, w: colW, h: pillH };
  const landH = Math.min(Math.round(140 * u), Math.round((yBot - yTop) * 0.55));
  const shore: Rect = { x: R0 - colW - 6, y: yBot - landH, w: W - (R0 - colW - 6), h: H - (yBot - landH) };
  const rim0 = 9;
  const area: Rect = { x: L0 + colW + 10 + rim0, y: yTop + rim0, w: (R0 - colW - 10 - rim0) - (L0 + colW + 10 + rim0), h: yBot - rim0 - (yTop + rim0) };
  const d = deckIn(area, cols, rows, maxCell(W, H, u));
  const rim = Math.max(8, Math.min(rim0, d.cell * 0.28));
  const door = { x: d.deck.x + d.deck.w / 2, y: d.deck.y + d.deck.h };
  // the waiting firsts: two rows on the land over the pill
  const slotH = Math.min(30 * u, (dove.y - shore.y - 16) / 2.2);
  const step = Math.max(32, Math.min(46 * u, (colW - 16) / 3));
  const per = Math.max(1, Math.floor((colW - 12) / step));
  const slots: Pt[] = [];
  for (let k = 0; k < per * 2; k++) slots.push({ x: shore.x + 6 + step / 2 + (k % per) * step, y: shore.y + 10 + slotH + Math.floor(k / per) * (slotH + 6) });
  const s = Math.round(clamp(28 * u, 24, 36));
  const raven = { x: L0 + s, y: bar.y + bar.h + s * 1.3 + 6, s };
  return {
    w: W, h: H, mode: 'side', u, ins, top: ins.top, bar, deck: d.deck, cell: d.cell, rot: d.rot, simCols: cols, simRows: rows, cols: d.sc, rows: d.sr, rim,
    shore, door, slots, slotH, dove, raven,
  };
}

function wide(W: number, H: number, ins: Insets, u: number, cols: number, rows: number): Parts {
  const yBot = H - ins.bottom - 6;
  const pillH = Math.round(clamp(52 * u, 48, 60));
  const shoreH = pillH + 10;
  const shore: Rect = { x: 0, y: yBot - shoreH, w: W, h: H - (yBot - shoreH) };
  // the Mendi panel (top left, ~340 px) and the score (top right, ~130 px) leave the middle column free up to
  // the top bar: the deck's bar rises into it (passive words), the deck under it
  const panelR = Math.min(352, W * 0.3) + 14, scoreL = W - 142;
  const half = Math.max(120, Math.min(W / 2 - panelR, scoreL - W / 2));
  const bar: Rect = { x: Math.round(W / 2 - half), y: 60, w: Math.round(half * 2), h: 40 };
  const rim0 = 10;
  const area: Rect = { x: bar.x + rim0, y: bar.y + bar.h + rim0, w: bar.w - 2 * rim0, h: shore.y - 4 - rim0 - (bar.y + bar.h + rim0) };
  const d = deckIn(area, cols, rows, maxCell(W, H, u));
  const rim = Math.max(8, Math.min(rim0, d.cell * 0.28));
  const door = { x: d.deck.x + d.deck.w / 2, y: d.deck.y + d.deck.h };
  const pw = pillW(u);
  const dove: Rect = { x: W - ins.right - Math.round(24 * u) - pw, y: yBot - pillH - 2, w: pw, h: pillH };
  const slotH = Math.min(shoreH * 0.6, 44 * u);
  const step = clamp(slotH * 1.1, 40, 56 * u);
  const gw = Math.max(18, d.cell * 0.7);
  const slots = slotsOn(door.x + gw / 2 + step * 0.9, dove.x - step * 0.6, shore.y + shoreH * 0.8, step, null);
  const s = Math.round(clamp(34 * u, 30, 46));
  const rx = Math.min(W - s * 1.2, d.deck.x + d.deck.w + Math.max(s * 1.1, Math.min(90, (W - d.deck.x - d.deck.w) * 0.3)));
  const raven = { x: rx, y: Math.max(ins.top + s * 1.2, d.deck.y + s * 1.6), s };
  return {
    w: W, h: H, mode: 'wide', u, ins, top: ins.top, bar, deck: d.deck, cell: d.cell, rot: d.rot, simCols: cols, simRows: rows, cols: d.sc, rows: d.sr, rim,
    shore, door, slots, slotH, dove, raven,
  };
}

/**
 * A big screen with a mouse (DESIGN §14): only the runner's top bar lies over the canvas (its panel and score stand
 * in side columns), so the bar sits right under it and the deck takes the whole middle, as large as the band allows
 * (turned a quarter where that gives larger cells, its cells up to 68 px of UI and a quarter more), centred, with
 * room on either side for the raven (on the right, talking above himself) — the new land along the foot, the dove's
 * pill at its right end grown with the UI, the waiting firsts on both sides of the gangway.
 */
function big(W: number, H: number, ins: Insets, u: number, cols: number, rows: number): Parts {
  const L0 = ins.left, R0 = W - ins.right;
  const m = Math.round(16 * u);
  const yTop = ins.top + Math.round(6 * u), yBot = H - ins.bottom - Math.round(8 * u);
  const pillH = Math.round(clamp(52 * u, 48, 100));
  const shoreH = pillH + Math.round(16 * u);
  const shore: Rect = { x: 0, y: yBot - shoreH, w: W, h: H - (yBot - shoreH) };
  const barH = Math.round(44 * u);
  // the raven's size, and his room beside the deck (the same on the other side keeps the deck centred)
  const s = Math.round(clamp(38 * u, 30, 80));
  const side = Math.round(s * 2.6);
  const rim0 = Math.round(10 * u);
  const ay = yTop + barH + Math.round(8 * u) + rim0;
  const area: Rect = { x: L0 + m + side + rim0, y: ay, w: R0 - L0 - 2 * (m + side + rim0), h: shore.y - Math.round(8 * u) - rim0 - ay };
  const d = deckIn(area, cols, rows, maxCell(W, H, u));
  const rim = Math.max(8, Math.min(rim0, d.cell * 0.28));
  const barW = Math.round(clamp(d.deck.w + 2 * rim, 420 * u, R0 - L0 - 2 * m));
  const bar: Rect = { x: Math.round(d.deck.x + d.deck.w / 2 - barW / 2), y: yTop, w: barW, h: barH };
  const door = { x: d.deck.x + d.deck.w / 2, y: d.deck.y + d.deck.h };
  const pw = Math.round(clamp(118 * u, 104, 240));
  const dove: Rect = { x: R0 - m - pw, y: yBot - pillH - 2, w: pw, h: pillH };
  // the waiting firsts on the land, both sides of the gangway, left of the dove
  const slotH = Math.min(shoreH * 0.62, 44 * u);
  const step = clamp(slotH * 1.1, 40, 60 * u);
  const gw = Math.max(18, d.cell * 0.7);
  const slots = slotsOn(L0 + m + step, dove.x - step * 0.6, shore.y + shoreH * 0.8, step, [door.x - gw / 2, door.x + gw / 2]);
  // the raven right of the hull, a third down the deck
  const raven = { x: Math.min(R0 - s * 1.2, d.deck.x + d.deck.w + rim + s * 1.2), y: d.deck.y + Math.max(s * 1.8, d.deck.h * 0.32), s };
  return {
    w: W, h: H, mode: 'wide', u, ins, top: ins.top, bar, deck: d.deck, cell: d.cell, rot: d.rot, simCols: cols, simRows: rows, cols: d.sc, rows: d.sr, rim,
    shore, door, slots, slotH, dove, raven,
  };
}

// ── the deck's mapping: the rules' cells and directions ↔ the screen ──
/** A board point (cells, may be fractional or off the board) on the screen's grid. */
export const toScreen = (L: Layout, x: number, y: number): Pt => (L.rot ? { x: L.simRows - 1 - y, y: x } : { x, y });

/** A screen grid point back on the board. */
export const toSim = (L: Layout, sx: number, sy: number): Pt => (L.rot ? { x: sy, y: L.simRows - 1 - sx } : { x: sx, y: sy });

/** A rules' direction (0 N, 1 E, 2 S, 3 W; fractional while turning) as drawn. */
export const sdir = (L: Layout, d: number): number => (L.rot ? d + 1 : d);

/** The centre of a board cell in canvas px. */
export function cellCentre(L: Layout, x: number, y: number): Pt {
  const p = toScreen(L, x, y);
  return { x: L.deck.x + (p.x + 0.5) * L.cell, y: L.deck.y + (p.y + 0.5) * L.cell };
}

/** A board cell's square in canvas px. */
export function cellRect(L: Layout, x: number, y: number): Rect {
  const p = toScreen(L, x, y);
  return { x: L.deck.x + p.x * L.cell, y: L.deck.y + p.y * L.cell, w: L.cell, h: L.cell };
}

/** The board cell under a canvas point (null: off the deck). */
export function cellAt(L: Layout, px: number, py: number): { x: number; y: number } | null {
  const sx = Math.floor((px - L.deck.x) / L.cell), sy = Math.floor((py - L.deck.y) / L.cell);
  if (sx < 0 || sy < 0 || sx >= L.cols || sy >= L.rows) return null;
  return toSim(L, sx, sy);
}

/** The mist's clear circle: centred on the door, its radius a share of the farthest corner's distance. */
export function sightRadius(L: Layout, share: number): number {
  const far = Math.hypot(L.deck.w / 2, L.deck.h);
  return far * share;
}

export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean =>
  x >= r.x - pad && y >= r.y - pad && x <= r.x + r.w + pad && y <= r.y + r.h + pad;

/** How far a finger may land off an animal and still take it (px): the cells grown to a finger, at least a few px. */
export const reachOf = (L: Layout): number => Math.max(6, (MIN_TAP - L.cell) / 2 + 4);

/**
 * Where the runner's breath pacer stands in a Tęcza (ArcadeGame.pacerAt; kit/pacerspot.ts): the deck is the play in a
 * rest too (the rainbow lights a safe move on it), so the pill keeps off the hull, the bar with the hearts the rainbow
 * gives back, the dove's pill, the raven, the gangway and the waiting firsts — in the sky beside or above the deck (a
 * desktop: under the Mendi panel; a big screen: left of the hull; a phone on its side: over the new land's column
 * when the deck leaves it the width).  An upright phone has no such room: the pill stands at the foot, on the new
 * land's left end over the waiting firsts and the gangway's foot, clear of the deck's cells and the dove.  A small
 * phone on its side whose deck fills the band between its two narrow columns, and a big screen's widest deck, get
 * the spot clear of the hearts, the raven and the dove that covers the least of the deck (a corner of it, or its
 * hull's rim over the new land).
 */
export function pacerAt(L: Layout): PacerAt | null {
  const size = pacerSize(L.kind === 'big');
  const band = safeBand(L.w, L.h, L.ins);
  const hull = { x: L.deck.x - L.rim - 2, y: L.deck.y - L.rim - 2, w: L.deck.w + 2 * L.rim + 4, h: L.deck.h + 2 * L.rim + 4 };
  // the dove's pill with its "resting" word over it; the raven on his perch
  const dove = { x: L.dove.x, y: L.dove.y - 26, w: L.dove.w, h: L.dove.h + 26 };
  const s = L.raven.s;
  const raven = { x: L.raven.x - s * 0.9, y: L.raven.y - s * 1.35, w: s * 1.8, h: s * 1.45 };
  const gw = Math.max(18, L.cell * 0.7);
  const gangway = { x: L.door.x - gw / 2 - 4, y: L.door.y, w: gw + 8, h: Math.max(0, L.shore.y + L.shore.h * 0.85 - L.door.y) };
  const xs = L.slots.map(p => p.x);
  const waiting = xs.length ? { x: Math.min(...xs) - L.slotH * 0.6, y: L.slots[0].y - L.slotH - 24, w: Math.max(...xs) - Math.min(...xs) + L.slotH * 1.2, h: L.slotH + 26 } : null;
  const hard = [L.bar, dove, raven];
  const clear = waiting ? [...hard, hull, gangway, waiting] : [...hard, hull, gangway];
  return pacerSpot([band], clear, { size })
    // an upright phone: the foot, the new land's left end
    ?? (L.mode === 'tall' ? pacerSpot([band], [...hard, L.deck], { size, from: 'bottom', align: 'left', pad: 2, edge: 2 }) : null)
    // a small phone on its side: the ring alone beside the hull
    ?? pacerRing([band], clear, { big: L.kind === 'big' })
    // (the cells count twice, the hull's rim, the gangway and the waiting firsts once)
    ?? pacerLeastOf([band], hard, waiting ? [L.deck, hull, gangway, waiting] : [L.deck, hull, gangway], { big: L.kind === 'big', align: 'right' });
}

/** What on screen decides the targets: a card that takes a tap (its rectangle), else the dove's button in play. */
export interface TargetState { card: Rect | null; dove: boolean }

/** The controls a player can tap now besides the deck (the deck is the play field): a card, or the dove's button. */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.card) return [{ label: 'card', ...s.card }];
  return s.dove ? [{ label: 'dove', ...L.dove }] : [];
}
