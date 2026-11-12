/**
 * Where Chleby i ryby's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §12, §9.3
 * "Mobile first").  The reference is a phone held upright in one hand: the runner's HUD covers the
 * top band (`insets().top`), the sky and the lake run under it, and the play starts right below it —
 * the tables of the hungry at the lane's top (passive: their hunger bars), the lane up the hill filling
 * the width, the boy's basket low in the thumb zone, and along the bottom the row of baskets of crumbs
 * with the help button in the bottom-right corner, clear of the screen's edges.  The cards between
 * levels are bottom sheets there.  On a phone on its side the lane sits right of a left column (Mirka,
 * the baskets, and the side sheets, which slide the lane aside instead of covering it) with the help
 * button bottom right; a desktop keeps the lane in the middle with the sheets on its left.
 *
 * Everything that can be tapped is computed here, without a canvas, so the view's hit tests, the
 * game's `targets()` and the layout tests (every `CHECK_SIZES` entry) use the same rectangles.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, TAP_GAP, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { RULES } from './rules';

export type { Rect };

export interface Lane {
  /** the lane's centre line, its bottom (the basket, y = 0) and its top (the tables, y = laneH) */
  cx: number;
  yB: number;
  yT: number;
  /** half widths (px) at the bottom and at the top */
  hwB: number;
  hwT: number;
  /** perspective: the scale at the top is 1 / (1 + k) */
  k: number;
  /** px per u across the lane at the bottom */
  unit: number;
  /** px per u for the sprites at the bottom (never taller than the hill's depth allows) */
  su: number;
  /** the boy's size (px) */
  boy: number;
}

/** 'tall': a phone upright or a tablet; 'short': a phone on its side; 'wide': a desktop. */
export type Mode = 'tall' | 'short' | 'wide';

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop (kit/mobile.ts uiScale) */
  u: number;
  mode: Mode;
  lane: Lane;
  /** the sky down to the horizon, then the lake's depth, then the grass */
  horizon: number;
  lakeD: number;
  /** the band the runner's HUD covers (= ins.top) */
  hudTop: number;
  ins: Insets;
  /** the safe play area: inside the insets */
  play: Rect;
  /** the baskets of crumbs: `cols` × `rows` little baskets in this box */
  bank: Rect & { cols: number; rows: number };
  /** the bank's count: its anchor, alignment and baseline */
  bankLabel: { x: number; y: number; align: 'left' | 'right'; base: 'bottom' | 'middle' };
  /** the help button, a round button (its name on a ribbon across its foot) */
  help: { x: number; y: number; r: number };
  /** Mirka's post: its foot, and the side her bubble opens to */
  perch: { x: number; y: number; dir: 1 | -1 };
  /** floats and words centre here */
  cardX: number;
  cardY: number;
  /** where the game's own banners centre (below the runner's block banner) */
  bannerY: number;
  /** the cards between levels: a bottom sheet (upright) or a side sheet on the left */
  sheet: 'bottom' | 'side';
  /** the side sheets' width (0 for bottom sheets) */
  sideW: number;
  /** how far the lane slides right while a side sheet shows, so the sheet never covers it */
  slide: number;
}

/** An upright phone's outer edges: nothing to press in them (kit/mobile.ts). */
export const EDGE = 16;
/** The help button keeps this far from a side edge (its hit box ends 4 px inside the rule). */
const KEEP = EDGE + 4;

/** The hunger number's size over a table drawn at sprite size `s` (paint.ts paintTable). */
export const tableLabelPx = (s: number): number => Math.max(13, Math.max(6, s * 0.36) * 1.35);

/** How far the tables' band reaches above the lane's top line: the group, the bar, the number. */
export function tablesBand(s: number): number {
  const bh = Math.max(6, s * 0.36);
  return 2.1 * s + 0.7 * bh + tableLabelPx(s) + 4;
}

function mkLane(cx: number, yB: number, yT: number, hwB: number, k: number, boy: number): Lane {
  const unit = (2 * hwB) / RULES.laneW;
  const depth = (yB - yT) / RULES.laneH;
  return { cx, yB, yT, hwB, hwT: hwB / (1 + k), k, unit, su: Math.min(unit, depth * 2.6), boy };
}

/**
 * The lane between x0 and x1, its tables' band right under `roof` and the boy's feet on `feet`.  The
 * boy's size and the tables' band both follow the sprites' size, which follows the lane: a few passes
 * settle it.
 */
function fitLane(roof: number, feet: number, x0: number, x1: number, k: number, ratio: number, margin: number, boyMin: number, boyMax: number): Lane {
  let boy = boyMin, crowd = 60;
  let lane = mkLane((x0 + x1) / 2, feet - 1.25 * boy, roof + crowd, 40, k, boy);
  for (let i = 0; i < 4; i++) {
    const yB = feet - 1.25 * boy, yT = roof + crowd;
    const hwB = Math.max(40, Math.min((x1 - x0) / 2 - margin, Math.max(20, yB - yT) * ratio));
    lane = mkLane((x0 + x1) / 2, yB, yT, hwB, k, boy);
    boy = clamp(lane.su * 1.1, boyMin, boyMax);
    crowd = tablesBand(lane.su / (1 + k));
  }
  return lane;
}

export function layout(w: number, h: number, ins: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const u = uiScale(W, H);
  const I: Insets = {
    top: clamp(ins.top, 0, H * 0.6), right: clamp(ins.right, 0, W * 0.2), bottom: clamp(ins.bottom, 0, H * 0.2), left: clamp(ins.left, 0, W * 0.2),
  };
  const left = I.left, right = W - I.right, bottom = H - I.bottom, top = I.top;
  const play = { x: left, y: top, w: right - left, h: bottom - top };
  const tall = W / H < 0.9;
  const mode: Mode = tall ? 'tall' : bottom - top < 340 ? 'short' : 'wide';
  const r = clamp(26 * u, 26, 32);
  // the tables' band starts right under the HUD: their bars and numbers are the top band's passive news
  const roof = top + 2;
  let lane: Lane, help: Layout['help'], bank: Layout['bank'], bankLabel: Layout['bankLabel'], perch: Layout['perch'];
  let sideW = 0, sideX = 0;
  if (mode === 'tall') {
    // the thumb zone: the help button in the bottom-right corner, the baskets of crumbs along the bottom
    // to its left, the boy standing on them
    help = { x: right - KEEP - r, y: bottom - 16 - r, r };
    const bh = clamp(22 * u, 22, 28);
    const bx = left + EDGE;
    bank = { x: bx, y: bottom - 10 - bh, w: Math.max(120, help.x - r - 14 - bx), h: bh, cols: 12, rows: 1 };
    bankLabel = { x: bank.x, y: bank.y - 5, align: 'left', base: 'bottom' };
    lane = fitLane(roof, bank.y - 4, left, right, 0.42, 0.75, 4, 30, 44 * u);
    perch = { x: Math.max(left + 24, lane.cx - lane.hwB + 18), y: lane.yB - (lane.yB - lane.yT) * 0.32, dir: 1 };
  } else if (mode === 'short') {
    // a phone on its side: a left column (Mirka, the baskets, the side sheets), the lane, the help button
    const col = clamp(play.w * 0.3, 150, 250);
    help = { x: right - KEEP - r, y: bottom - 16 - r, r };
    const cell = Math.min((col - 2 * EDGE) / 6, 30), rowH = 20;
    bank = { x: left + EDGE, y: bottom - 10 - (2 * rowH + 4), w: cell * 6, h: 2 * rowH + 4, cols: 6, rows: 2 };
    bankLabel = { x: bank.x, y: bank.y - 5, align: 'left', base: 'bottom' };
    lane = fitLane(roof, bottom - 6, left + col, help.x - r - 12, 0.3, 0.8, 6, 26, 36);
    perch = { x: lane.cx - lane.hwB - 26, y: lane.yB - (lane.yB - lane.yT) * 0.45, dir: 1 };
    sideW = clamp(play.w * 0.46, 260, 360);
    sideX = left + 8;
  } else {
    // a desktop: the lane in the middle, the baskets under it, the help button beside its foot
    const bh = clamp(22 * u, 22, 30);
    const rowY = bottom - 10 - bh;
    lane = fitLane(roof, rowY - 4, left + 40, right - 40, 0.45, 0.8, 30 * u, 30, 52);
    const bw = Math.min(lane.hwB * 2, 12 * bh * 1.9);
    bank = { x: lane.cx - bw / 2, y: rowY, w: bw, h: bh, cols: 12, rows: 1 };
    // the count after the row: a side sheet (bottom left) never covers it
    bankLabel = { x: bank.x + bank.w + 10, y: bank.y + bh / 2, align: 'left', base: 'middle' };
    help = { x: Math.min(right - KEEP - r, lane.cx + lane.hwB + 24 + r), y: lane.yB - r * 0.3, r };
    const leftRoom = lane.cx - lane.hwB - left;
    perch = { x: leftRoom < 60 * u ? lane.cx - lane.hwB + 18 * u : lane.cx - lane.hwB - 34 * u, y: lane.yB - (lane.yB - lane.yT) * 0.32, dir: 1 };
    sideW = clamp(play.w * 0.28, 300, 400);
    sideX = left + 24;
  }
  const short = mode === 'short';
  const horizon = short ? 0 : Math.max(24, top - 48 * u);
  const lakeD = short ? Math.max(8, top - 4) : clamp(top - horizon - 4, 18, 40 * u);
  const sheet = mode === 'tall' ? 'bottom' : 'side';
  const slide = sheet === 'side' ? Math.max(0, sideX + sideW + 10 - (lane.cx - lane.hwB)) : 0;
  return {
    w: W, h: H, u, mode, lane, horizon, lakeD, hudTop: top, ins: I, play, bank, bankLabel, help, perch,
    cardX: lane.cx, cardY: lane.yT + (lane.yB - lane.yT) * 0.48,
    bannerY: lane.yT + (lane.yB - lane.yT) * (mode === 'wide' ? 0.55 : 0.62),
    sheet, sideW, slide,
  };
}

/** The perspective scale at lane height y (1 at the basket, 1 / (1 + k) at the tables). */
export const scaleAt = (L: Lane, y: number): number => 1 / (1 + L.k * (y / RULES.laneH));

/** Lane (x, y) in u → screen px, and the scale there. */
export function toScreen(L: Lane, x: number, y: number): { x: number; y: number; s: number } {
  const s = scaleAt(L, y), s1 = 1 / (1 + L.k);
  const g = (1 - s) / (1 - s1);
  return { x: L.cx + (x / RULES.laneW - 0.5) * 2 * L.hwB * s, y: L.yB - (L.yB - L.yT) * g, s };
}

/** A screen x at the basket's row → lane x (u). */
export const laneX = (L: Lane, sx: number): number => ((sx - L.cx) / (2 * L.hwB) + 0.5) * RULES.laneW;

// ── the sheets between levels ──────────────────────────────────────────────────────────────────

/**
 * A card between levels with `h` px of content: a bottom sheet on an upright phone or a tablet (full
 * width on a phone, at most 560 px), a side sheet on the left on a phone on its side or a desktop
 * (`wide`: a story card on its side spans the play area — it holds the hands anyway).
 */
export function sheetBox(L: Layout, h: number, wide = false): Rect {
  const P = L.play;
  const hh = Math.min(h, P.h - 12);
  if (L.sheet === 'bottom') {
    const w = Math.min(P.w - 16, 560);
    return { x: P.x + (P.w - w) / 2, y: P.y + P.h - 8 - hh, w, h: hh };
  }
  if (wide && L.mode === 'short') return { x: P.x + 8, y: P.y + Math.max(6, (P.h - hh) / 2), w: P.w - 16, h: hh };
  return { x: P.x + (L.mode === 'wide' ? 24 : 8), y: P.y + P.h - 8 - hh, w: L.sideW, h: hh };
}

/** The "level fed" sheet: the title, the stars, the baskets earned and the path of hillsides. */
export function wonBox(L: Layout): Rect {
  return sheetBox(L, (L.mode === 'short' ? 178 : 198) * L.u);
}

export interface VillageGeo {
  box: Rect;
  pad: number;
  /** the title and the bank's line above the rows */
  head: number;
  rows: Rect[];
  go: Rect;
}

/** The village sheet: its title, `n` buildings to raise (each a finger-sized row) and "Dalej". */
export function villageGeo(L: Layout, n: number): VillageGeo {
  const u = L.u, short = L.mode === 'short';
  const pad = (short ? 10 : 12) * u, gap = 8 * u;
  const head = (short ? 40 : 54) * u;
  const goH = Math.round(Math.max(MIN_TAP + 4, 48 * u));
  let rowH = Math.max(MIN_TAP + 8, (short ? 52 : 64) * u);
  const fixed = 2 * pad + head + gap + goH;
  const room = L.play.h - 12;
  if (n > 0 && fixed + n * rowH + (n - 1) * gap > room) rowH = Math.max(MIN_TAP + 4, (room - fixed - (n - 1) * gap) / n);
  const h = fixed + n * rowH + Math.max(0, n - 1) * gap;
  const box = sheetBox(L, h);
  const rows = Array.from({ length: n }, (_, i) => ({ x: box.x + pad, y: box.y + pad + head + i * (rowH + gap), w: box.w - 2 * pad, h: rowH }));
  const go = { x: box.x + pad, y: box.y + box.h - pad - goH, w: box.w - 2 * pad, h: goH };
  return { box, pad, head, rows, go };
}

export interface RevealGeo {
  box: Rect;
  pad: number;
  /** the title (and "+ N more" under it) above the tiles, the line under them */
  head: number;
  foot: number;
  per: number;
  tw: number;
  th: number;
  cells: Rect[];
  /** at most this many tiles fit (the last one says how many more) */
  max: number;
}

/** The bundles' reveal: up to six tiles on a phone (three a row), eight on a tablet or a desktop. */
export function revealGeo(L: Layout, tiles: number, sub: boolean): RevealGeo {
  const u = L.u, short = L.mode === 'short';
  const pad = (short ? 10 : 12) * u, gap = 8 * u;
  const w0 = sheetBox(L, 100).w;
  const narrow = w0 < 480;
  const max = narrow ? 6 : 8;
  const per = narrow ? 3 : 4;
  const n = Math.max(1, Math.min(max, tiles));
  const tw = Math.min(118 * u, (w0 - 2 * pad - (per - 1) * gap) / per);
  const rows = Math.ceil(n / per);
  const head = (sub ? (short ? 40 : 46) : (short ? 26 : 30)) * u;
  const foot = (short ? 18 : 22) * u;
  const fixed = 2 * pad + head + (rows - 1) * gap + gap + foot;
  // as tall as a tile wants, but the sheet never outgrows the play area (a phone on its side)
  const th = Math.max(80, Math.min(clamp(tw * 1.1, 92, 136 * u), (L.play.h - 12 - fixed) / rows));
  const box = sheetBox(L, fixed + rows * th);
  const gx = box.x + (box.w - (per * tw + (per - 1) * gap)) / 2;
  const cells = Array.from({ length: n }, (_, i) => ({ x: gx + (i % per) * (tw + gap), y: box.y + pad + head + Math.floor(i / per) * (th + gap), w: tw, h: th }));
  return { box, pad, head, foot, per, tw, th, cells, max };
}

// ── what can be tapped ─────────────────────────────────────────────────────────────────────────

/** The help button's hit box (a 52–64 px square round the button). */
export function helpRect(L: Layout): Rect {
  const b = L.help;
  return { x: b.x - b.r, y: b.y - b.r, w: 2 * b.r, h: 2 * b.r };
}

/**
 * The giant loaf's tap area round its body at (x, y) with radius r (a moving target: generous), kept
 * out of the basket's zone (a tap there pours) and off the help button; null while there is no room
 * for a finger (it has only just left the basket).
 */
export function giantRect(L: Layout, x: number, y: number, r: number): Rect | null {
  const R = Math.max(r, 30);
  const minX = L.play.x + (L.mode === 'tall' ? EDGE : 0), maxX = L.play.x + L.play.w - (L.mode === 'tall' ? EDGE : 0);
  const w = Math.min(2 * R, maxX - minX);
  const x0 = clamp(x - R, minX, maxX - w);
  let y0 = Math.max(y - R, L.play.y + 2), y1 = Math.min(y + R, L.lane.yB - L.lane.boy * 1.4);
  const hr = helpRect(L);
  if (x0 + w > hr.x - TAP_GAP && x0 < hr.x + hr.w + TAP_GAP) y1 = Math.min(y1, hr.y - TAP_GAP);
  y0 = Math.min(y0, y1);
  if (w < MIN_TAP || y1 - y0 < MIN_TAP) return null;
  return { x: x0, y: y0, w, h: y1 - y0 };
}

/** What decides the targets right now (the view fills it from the sim). */
export interface TargetState {
  stage: 'level' | 'climb' | 'won' | 'pack' | 'card';
  /** the session's play is over (the evening), or a story card holds the hands */
  idle: boolean;
  /** the village sheet's rows */
  offers: number;
  /** the giant loaf on the lane: its body (screen px) */
  giant: { x: number; y: number; r: number } | null;
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * Every control the player can tap now (ArcadeGame.targets): the help button and the giant loaf
 * while a level plays; the buildings and "Dalej" on the village sheet.  A tap anywhere else pours (or
 * goes on past a reveal or a story card): that is the free play area, not a target.
 */
export function chlebyTargets(L: Layout, s: TargetState): TapTarget[] {
  if (s.idle) return [];
  if (s.stage === 'card') {
    const v = villageGeo(L, s.offers);
    return [...v.rows.map((r, i) => ({ label: `build ${i + 1}`, ...r })), { label: 'go on', ...v.go }];
  }
  if (s.stage !== 'level') return [];
  const out: TapTarget[] = [{ label: 'help', ...helpRect(L) }];
  const g = s.giant ? giantRect(L, s.giant.x, s.giant.y, s.giant.r) : null;
  if (g) out.push({ label: 'giant loaf', ...g });
  return out;
}
