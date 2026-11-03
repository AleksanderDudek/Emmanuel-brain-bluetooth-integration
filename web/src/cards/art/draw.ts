/**
 * Drawing the cards' items as SVG (src/cards/DESIGN.md §3): the board's cues and the pad's buttons
 * are made by the same functions, so a coral dot, a fist or a die looks the same on both screens
 * and on the printed cards.  Everything is built with createElementNS (no innerHTML, CSP-safe).
 */
import type { PadItem } from '../duo/protocol';
import { COLORS, COLOR_MARK, ON_COLOR, SHAPE_PATH } from '../palette';
import { glyphSvg } from './glyphs';

export const SVGNS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: (SVGElement | null)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const k of kids) if (k) el.append(k);
  return el;
}

const text = (s: string, attrs: Record<string, string | number>): SVGTextElement => {
  const t = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', ...attrs });
  t.textContent = s;
  return t;
};

/** The connector brown and the die's colour on the cards. */
export const BROWN = '#8A7160';
export const DIE = '#8A6F5C';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export interface DrawOpts {
  /** colour marks for colour-blind players (palette.ts COLOR_MARK) */
  marks?: boolean;
  /** an accessible name; without it the drawing is decorative */
  title?: string;
}

/** The crosshair's quarters (radius 40 around the centre), for look: 'quarter'. */
const QUARTER: Record<string, string> = {
  tl: 'M50 50L50 10A40 40 0 0 0 10 50Z', tr: 'M50 50L90 50A40 40 0 0 0 50 10Z',
  bl: 'M50 50L10 50A40 40 0 0 0 50 90Z', br: 'M50 50L50 90A40 40 0 0 0 90 50Z',
};

/**
 * One item as an `<svg viewBox="0 0 100 100">`: a dot, a crosshair ring, a shape, a gesture (on a
 * coloured disc when it has a colour), a number on a coloured tile, or a die.
 */
export function itemSvg(it: PadItem, o: DrawOpts = {}): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'k-item' });
  if (o.title) {
    svg.setAttribute('role', 'img');
    const t = svgEl('title');
    t.textContent = o.title;
    svg.append(t);
  } else svg.setAttribute('aria-hidden', 'true');
  const fill = it.color ? COLORS[it.color] : null;
  const mark = (): SVGElement[] => (o.marks && it.color && !it.label ? [text(COLOR_MARK[it.color], {
    x: 50, y: it.shape ? 56 : 50, 'font-size': it.shape || it.glyph ? 22 : 30, fill: ON_COLOR[it.color], class: 'k-mark',
  })] : []);
  if (it.pips) {
    svg.append(svgEl('rect', { x: 6, y: 6, width: 88, height: 88, rx: 16, fill: DIE }));
    for (const [x, y] of PIPS[it.pips] ?? []) svg.append(svgEl('circle', { cx: x, cy: y, r: 8.5, fill: '#fff' }));
  } else if (it.look === 'cross') {
    const c = fill ?? COLORS.ink;
    svg.append(svgEl('circle', { cx: 50, cy: 50, r: 40, fill: 'none', stroke: c, 'stroke-width': 6 }),
      svgEl('path', { d: 'M50 10V90M10 50H90', stroke: c, 'stroke-width': 5 }), ...mark());
  } else if (it.look === 'quarter') {
    const q = QUARTER[it.id] ?? '';
    svg.append(svgEl('path', { d: q, fill: COLORS.navy }),
      svgEl('circle', { cx: 50, cy: 50, r: 40, fill: 'none', stroke: COLORS.navy, 'stroke-width': 5 }),
      svgEl('path', { d: 'M50 10V90M10 50H90', stroke: COLORS.navy, 'stroke-width': 5 }));
  } else if (it.shape) {
    svg.append(svgEl('path', { d: SHAPE_PATH[it.shape], fill: fill ?? COLORS.ink }), ...mark());
  } else if (it.glyph) {
    if (fill) svg.append(svgEl('circle', { cx: 50, cy: 50, r: 47, fill }));
    const g = glyphSvg(it.glyph);
    for (const [k, v] of Object.entries(fill ? { x: 14, y: 14, width: 72, height: 72 } : { x: 2, y: 2, width: 96, height: 96 })) g.setAttribute(k, String(v));
    svg.append(g);
    if (fill && o.marks && it.color) svg.append(text(COLOR_MARK[it.color], { x: 84, y: 16, 'font-size': 18, fill: ON_COLOR[it.color], class: 'k-mark' }));
  } else if (it.label !== undefined) {
    const bg = fill ?? COLORS.navy;
    svg.append(svgEl('circle', { cx: 50, cy: 50, r: 46, fill: bg }),
      text(it.label, { x: 50, y: 52, 'font-size': it.label.length > 1 ? 44 : 56, 'font-weight': 600, fill: it.color ? ON_COLOR[it.color] : '#fff' }));
  } else {
    svg.append(svgEl('circle', { cx: 50, cy: 50, r: 46, fill: fill ?? COLORS.grey }), ...mark());
  }
  if (it.done) svg.classList.add('k-done');
  return svg;
}

/** A number tile (card 20): a rounded rectangle in the colour with the number on it. */
export function tileSvg(it: PadItem, o: DrawOpts = {}): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 160 100', class: 'k-item k-tile', 'aria-hidden': 'true' });
  const c = it.color ?? 'navy';
  svg.append(svgEl('rect', { x: 4, y: 4, width: 152, height: 92, rx: 22, fill: COLORS[c] }),
    text(it.label ?? '', { x: 80, y: 54, 'font-size': 66, 'font-weight': 500, fill: ON_COLOR[c] }));
  if (o.marks) svg.append(text(COLOR_MARK[c], { x: 140, y: 22, 'font-size': 18, fill: ON_COLOR[c], class: 'k-mark' }));
  return svg;
}

/** Two colours on one tile, split on the diagonal (card 10). */
export function splitTileSvg(left: PadItem, right: PadItem, o: DrawOpts = {}): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'k-item k-split', 'aria-hidden': 'true' });
  const l = left.color ?? 'grey', r = right.color ?? 'grey';
  svg.append(svgEl('path', { d: 'M4 4H96L4 96Z', fill: COLORS[l] }), svgEl('path', { d: 'M96 4V96H4Z', fill: COLORS[r] }));
  if (o.marks) svg.append(text(COLOR_MARK[l], { x: 30, y: 30, 'font-size': 18, fill: ON_COLOR[l] }), text(COLOR_MARK[r], { x: 70, y: 70, 'font-size': 18, fill: ON_COLOR[r] }));
  return svg;
}

// ── the pad's special arrangements ───────────────────────────────

/** Card 07's hand, palm down, fingers up: where the five fingertips sit (0..100), thumb first. */
export const HAND_TIPS: readonly [number, number][] = [[13, 58], [31, 21], [51, 12], [69, 19], [86, 33]];
const HAND_BASES: readonly [number, number][] = [[33, 70], [38, 52], [50, 50], [61, 52], [70, 58]];

/** The hand's outline (brown, as on card 07) under the fingertip buttons. */
export function handOutline(): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'k-hand', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
  const g = svgEl('g', { fill: 'none', stroke: BROWN, 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  HAND_TIPS.forEach(([x, y], i) => {
    const [bx, by] = HAND_BASES[i];
    const nx = -(y - by), ny = x - bx, len = Math.hypot(nx, ny) || 1, w = i === 0 ? 4.2 : 3.6;
    const ox = (nx / len) * w, oy = (ny / len) * w;
    g.append(svgEl('path', { d: `M${bx + ox} ${by + oy}L${x + ox} ${y + oy}M${bx - ox} ${by - oy}L${x - ox} ${y - oy}` }));
  });
  g.append(svgEl('path', { d: 'M29 73C31 83 36 92 40 97M74 60C73 74 69 86 66 97M40 97H66' }));
  svg.append(g);
  return svg;
}
