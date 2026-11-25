/**
 * Room for the runner's breath pacer (src/arcade/pacer.ts) in a game's own layout — `ArcadeGame.pacerAt()`.
 *
 * In a rest the runner shows a pill at the top centre of the play area, under the HUD band: about 200 × 66 px on a
 * desktop, 190 × 62 on a phone, ~230 × 78 on a big screen (DESIGN §14).  Where that covers what the rest is about
 * (a board's top row, a goal card, a control), a game says where the pill's top centre goes instead.  The helpers
 * here find such a spot in the game's layout: the first place, row by row from the top (or the foot), where the pill
 * with a margin fits inside one of the given free regions and clear of every rectangle the game keeps in sight — or,
 * where the play fills the band, the place clear of its controls that covers the least of the rest (`pacerLeast`).
 * Pure: tests run them at every kit/mobile CHECK_SIZES entry, and `pacerProblems` says in plain words what is wrong.
 */
import type { Insets } from './types';
import type { Rect } from './mobile';

export interface Pt { x: number; y: number }

/** A spot for the pacer; `ring`: the runner shows the ring alone there (its seconds, no phase word) — see `pacerRing`. */
export interface PacerAt extends Pt { ring?: boolean }

/** The pill a game keeps room for (CSS px): a little over its real size, any language. */
export const PACER_W = 210;
export const PACER_H = 70;
/** On a big screen with a mouse (kit/mobile `screenKind` 'big': the runner grows the pill there). */
export const PACER_BIG_W = 240;
export const PACER_BIG_H = 80;
/** The ring alone (`.arcade-breath.ring`: 50 px ring + 8 px padding, 76 px on a big screen) with a little room. */
export const PACER_RING = 72;
export const PACER_BIG_RING = 82;

export interface PacerSize { w: number; h: number }

export const pacerSize = (big: boolean, ring = false): PacerSize =>
  ring ? { w: big ? PACER_BIG_RING : PACER_RING, h: big ? PACER_BIG_RING : PACER_RING } : big ? { w: PACER_BIG_W, h: PACER_BIG_H } : { w: PACER_W, h: PACER_H };

/** The size of what stands at a spot: the ring alone where `at.ring`, else the pill. */
export const pacerSizeAt = (at: PacerAt | null, big: boolean): PacerSize => pacerSize(big, !!at?.ring);

/** The pill's rectangle for a spot (its top centre). */
export const pacerBox = (at: Pt, size: PacerSize = pacerSize(false)): Rect => ({ x: at.x - size.w / 2, y: at.y, w: size.w, h: size.h });

/** Whether two rectangles overlap by more than `slack` px each way. */
export function overlaps(a: Rect, b: Rect, slack = 0): boolean {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > slack && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > slack;
}

/**
 * A disc (or an ellipse `r` across and `ry` down) as `n` horizontal slabs that cover it, each as wide as the shape at
 * its widest within the slab: a round sea or field to keep clear of.
 */
export function discSlabs(cx: number, cy: number, r: number, n = 12, ry = r): Rect[] {
  const out: Rect[] = [];
  for (let k = 0; k < n; k++) {
    const y0 = cy - ry + (2 * ry * k) / n, y1 = cy - ry + (2 * ry * (k + 1)) / n;
    const near = y0 <= cy && y1 >= cy ? 0 : Math.min(Math.abs(y0 - cy), Math.abs(y1 - cy)) / ry;
    const half = r * Math.sqrt(Math.max(0, 1 - near * near));
    out.push({ x: cx - half, y: y0, w: 2 * half, h: y1 - y0 });
  }
  return out;
}

/** The canvas's safe band: under the HUD band, inside the insets. */
export const safeBand = (w: number, h: number, ins: Insets): Rect => ({ x: ins.left, y: ins.top, w: Math.max(0, w - ins.left - ins.right), h: Math.max(0, h - ins.top - ins.bottom) });

export interface SpotOpts {
  size?: PacerSize;
  /** px kept between the pill and what it avoids (default 6) and from a region's edges (default 4) */
  pad?: number;
  edge?: number;
  /** search each region from its top (default) or its foot */
  from?: 'top' | 'bottom';
  /** which x is tried first in a row: the region's middle (then outward, left before right), its left or its right */
  align?: 'centre' | 'left' | 'right';
}

/**
 * The pill's top centre in the first region (in order) where it fits whole, `edge` px inside the region and `pad` px
 * clear of every rectangle in `avoid`; null when none has room.  Rows are tried from the top (or the foot), and in a
 * row the x positions from `align`: a grid of ~40 rows and ~25 columns per region, plus the rows and columns right
 * beside each obstacle (a gap just the pill's size is found).  A few thousand tests: keep the answer per layout.
 */
export function pacerSpot(regions: readonly Rect[], avoid: readonly Rect[], o: SpotOpts = {}): Pt | null {
  const size = o.size ?? pacerSize(false);
  const pad = o.pad ?? 6, edge = o.edge ?? 4;
  const walls = avoid.filter(r => r.w > 0 && r.h > 0).map(r => ({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad }));
  for (const r0 of regions) {
    const r = { x: r0.x + edge, y: r0.y + edge, w: r0.w - 2 * edge, h: r0.h - 2 * edge };
    if (r.w < size.w || r.h < size.h) continue;
    const xs = xsIn(r, size.w, o.align ?? 'centre', walls);
    for (const y of ysIn(r, size.h, o.from ?? 'top', walls)) {
      for (const x of xs) {
        const box = { x: x - size.w / 2, y, w: size.w, h: size.h };
        if (!walls.some(b => overlaps(box, b))) return { x: Math.round(x), y: Math.round(y) };
      }
    }
  }
  return null;
}

/** The rows to try in region `r` for a pill `ph` tall: a grid from the top (or the foot), and every row that sits right under or over a wall. */
function ysIn(r: Rect, ph: number, from: 'top' | 'bottom', walls: readonly Rect[]): number[] {
  const lo = r.y, hi = r.y + r.h - ph;
  const step = Math.max(3, (hi - lo) / 40);
  const out: number[] = [];
  for (let y = lo; y <= hi + 0.01; y += step) out.push(y);
  for (const b of walls) for (const y of [b.y + b.h + 0.5, b.y - ph - 0.5]) if (y >= lo - 0.01 && y <= hi + 0.01) out.push(y);
  return out.sort((a, b) => (from === 'bottom' ? b - a : a - b));
}

/**
 * Where the pill has no room clear of the play (a small phone, a phone on its side): the ring alone — the lungs and
 * the phase's seconds, the phase in its colour, without the word — in the first place it fits whole, clear of every
 * rectangle in `avoid` (the same list as the pill's `pacerSpot`, so it covers nothing the rest is about); null when
 * even the ring has no room (then `pacerLeast` with the pill).  The ring is a third of the pill's area: it fits into
 * the corners and the gaps beside a board that the pill does not.
 */
export function pacerRing(regions: readonly Rect[], avoid: readonly Rect[], o: SpotOpts & { big?: boolean } = {}): PacerAt | null {
  const at = pacerSpot(regions, avoid, { ...o, size: pacerSize(!!o.big, true) });
  return at ? { ...at, ring: true } : null;
}

/**
 * `pacerLeast` for the pill and for the ring alone: the one that covers less of `soft` (the same weights), the pill on
 * a tie (its phase word helps).  The pacer takes no taps (pointer-events: none), so what it covers still plays; the
 * ring over a board covers about a third of what the pill would.
 */
export function pacerLeastOf(regions: readonly Rect[], hard: readonly Rect[], soft: readonly Rect[], o: SpotOpts & { big?: boolean } = {}): PacerAt | null {
  const big = !!o.big;
  const pill = pacerLeast(regions, hard, soft, { ...o, size: pacerSize(big) });
  const ring = pacerLeast(regions, hard, soft, { ...o, size: pacerSize(big, true) });
  if (!ring) return pill;
  const on = (at: Pt, size: PacerSize) => soft.reduce((s, b) => s + area(pacerBox(at, size), b), 0);
  return !pill || on(ring, pacerSize(big, true)) < on(pill, pacerSize(big)) - 1 ? { ...ring, ring: true } : pill;
}

/** How many px² of `a` lie on `b`. */
const area = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Where no region has room: the spot clear of every rectangle in `hard` (controls, cards, what must stay readable)
 * that covers the least of the ones in `soft` (a board's cells), the first such in the search order; null when even
 * `hard` leaves no place.  For the odd screen where the play fills the band (a small phone on its side).
 */
export function pacerLeast(regions: readonly Rect[], hard: readonly Rect[], soft: readonly Rect[], o: SpotOpts = {}): Pt | null {
  const size = o.size ?? pacerSize(false);
  const pad = o.pad ?? 6, edge = o.edge ?? 4;
  const walls = hard.filter(r => r.w > 0 && r.h > 0).map(r => ({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad }));
  let best: Pt | null = null, least = Infinity;
  for (const r0 of regions) {
    const r = { x: r0.x + edge, y: r0.y + edge, w: r0.w - 2 * edge, h: r0.h - 2 * edge };
    if (r.w < size.w || r.h < size.h) continue;
    const xs = xsIn(r, size.w, o.align ?? 'centre', walls);
    for (const y of ysIn(r, size.h, o.from ?? 'top', walls)) {
      for (const x of xs) {
        const box = { x: x - size.w / 2, y, w: size.w, h: size.h };
        if (walls.some(b => overlaps(box, b))) continue;
        const a = soft.reduce((s, b) => s + area(box, b), 0);
        if (a < least - 1) {
          least = a;
          best = { x: Math.round(x), y: Math.round(y) };
        }
      }
    }
  }
  return best;
}

/** The x centres to try in a row of region `r` for a pill `pw` wide: from `align`, then every one right beside a wall. */
function xsIn(r: Rect, pw: number, align: 'centre' | 'left' | 'right', walls: readonly Rect[]): number[] {
  const lo = r.x + pw / 2, hi = r.x + r.w - pw / 2;
  if (hi - lo < 1) return [(lo + hi) / 2];
  const out = gridXs(lo, hi, align);
  for (const b of walls) for (const x of [b.x + b.w + pw / 2 + 0.5, b.x - pw / 2 - 0.5]) if (x >= lo - 0.01 && x <= hi + 0.01) out.push(x);
  return out;
}

function gridXs(lo: number, hi: number, align: 'centre' | 'left' | 'right'): number[] {
  const step = Math.max(6, (hi - lo) / 24);
  const out: number[] = [];
  if (align === 'left') for (let x = lo; x <= hi + 0.01; x += step) out.push(x);
  else if (align === 'right') for (let x = hi; x >= lo - 0.01; x -= step) out.push(x);
  else {
    const mid = (lo + hi) / 2;
    out.push(mid);
    for (let k = 1; mid - k * step >= lo - 0.01 || mid + k * step <= hi + 0.01; k++) {
      if (mid - k * step >= lo - 0.01) out.push(mid - k * step);
      if (mid + k * step <= hi + 0.01) out.push(mid + k * step);
    }
  }
  return out;
}

/**
 * What is wrong with a spot, in plain words (empty: all good) — for tests: the pill whole on the canvas, under the
 * HUD band and inside the other insets, clear of every rectangle in `keep` (the board, the targets, the cards).
 */
export function pacerProblems(at: Pt | null, w: number, h: number, ins: Insets, keep: readonly (Rect & { label?: string })[], size: PacerSize = pacerSize(false)): string[] {
  if (!at) return [];
  const out: string[] = [];
  const b = pacerBox(at, size);
  const r1 = (v: number) => Math.round(v);
  if (b.x < ins.left - 0.5 || b.x + b.w > w - ins.right + 0.5 || b.y < ins.top - 0.5 || b.y + b.h > h - ins.bottom + 0.5) {
    out.push(`the pacer at ${r1(b.x)},${r1(b.y)} ${b.w}×${b.h} leaves the safe band (${r1(ins.left)}..${r1(w - ins.right)} × ${r1(ins.top)}..${r1(h - ins.bottom)})`);
  }
  keep.forEach((k, i) => {
    if (k.w > 0 && k.h > 0 && overlaps(b, k, 0.5)) out.push(`the pacer at ${r1(b.x)},${r1(b.y)} covers "${k.label ?? `#${i}`}" (${r1(k.x)},${r1(k.y)} ${r1(k.w)}×${r1(k.h)})`);
  });
  return out;
}
