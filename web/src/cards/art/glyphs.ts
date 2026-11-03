/**
 * Hand-gesture glyphs of the exercise cards: the hand signs the cards ask for (cards 18, 27, 31)
 * and the legend of how to touch the big shapes (cards 03, 13, 21, 30), drawn flat in the cards'
 * style: skin fill, a slightly darker outline, rounded fingers, few inner lines.  Every glyph sits
 * in a 100×100 viewBox with a small margin and reads at 48 px (touch buttons) as well as 300 px.
 * The same data rasterised the corrected "Wersja 4K" cards, so the app and the cards match.
 *
 * Built with createElementNS only (no innerHTML).
 */

export type GlyphId =
  | 'palm' | 'fist' | 'edge' | 'twoTips' | 'twoFlat' | 'vSign' | 'okSign'
  | 'crossed' | 'thumbUp' | 'pinch' | 'threeUp' | 'indexUp' | 'spread';

export interface SvgNode {
  tag: 'path' | 'circle' | 'ellipse' | 'rect' | 'g';
  a: Readonly<Record<string, string | number>>;
  kids?: readonly SvgNode[];
}

/** Every glyph id, in a stable order (legend first, then the hand signs). */
export const GLYPH_IDS: readonly GlyphId[] = [
  'palm', 'fist', 'edge', 'twoTips', 'twoFlat', 'vSign', 'okSign',
  'crossed', 'thumbUp', 'pinch', 'threeUp', 'indexUp', 'spread',
];

/** Skin, its outline and the grey of the touch marks — sampled from the cards. */
export const GLYPH_SKIN = '#F4CBA8';
export const GLYPH_LINE = '#D9A07A';
export const GLYPH_MARK = '#9CA3AF';

const SW = 3; // outline width (viewBox units)
const DW = 2.2; // inner detail lines

type Pt = readonly [number, number];
const n1 = (v: number): string => (Math.round(v * 10) / 10).toString();

/** A finger: a capsule from base `a` to tip `b`, radius `r`. */
function finger(a: Pt, b: Pt, r: number): SvgNode {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * r, ny = (dx / len) * r;
  const d =
    `M${n1(a[0] + nx)} ${n1(a[1] + ny)}L${n1(b[0] + nx)} ${n1(b[1] + ny)}` +
    `A${n1(r)} ${n1(r)} 0 0 0 ${n1(b[0] - nx)} ${n1(b[1] - ny)}` +
    `L${n1(a[0] - nx)} ${n1(a[1] - ny)}A${n1(r)} ${n1(r)} 0 0 0 ${n1(a[0] + nx)} ${n1(a[1] + ny)}Z`;
  return { tag: 'path', a: { d } };
}

const shape = (d: string): SvgNode => ({ tag: 'path', a: { d } });
const detail = (d: string): SvgNode => ({ tag: 'path', a: { d, fill: 'none', 'stroke-width': DW } });
const mark = (n: SvgNode): SvgNode => ({ tag: n.tag, a: { ...n.a, fill: GLYPH_MARK, stroke: 'none' } });

/**
 * Everything inherits the skin fill and the outline from one group; the parts are drawn on a
 * 0–100 grid and the group shrinks it to 4–96 so every glyph keeps the same margin.
 */
const hand = (...kids: SvgNode[]): readonly SvgNode[] => [{
  tag: 'g',
  a: {
    transform: 'translate(4 4) scale(0.92)', fill: GLYPH_SKIN, stroke: GLYPH_LINE,
    'stroke-width': SW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  },
  kids,
}];

/* ---- shared parts (right hand, palm towards the viewer unless noted) ---- */

/** Palm and wrist, cut flat at the bottom like the cards' hands. */
const PALM = shape('M30 61C30 52 35 48 43 48L63 48C70 48 74 52 74 60L72.5 80C72 87 70 92 69 96L35 96C33.5 92 32 87 31.5 80Z');
/** Curled finger seen from the front: a short rounded knuckle standing on the palm. */
const curled = (x: number, r = 5.4): SvgNode => finger([x, 64], [x, 52], r);
/** Thumb folded across the curled fingers, from the left side of the palm to `tipX`. */
const thumbAcross = (tipX: number, tipY = 63): SvgNode => finger([31, 78], [tipX, tipY], 6.3);

const IDX = 38.5, MID = 49.5, RNG = 60, LIT = 69;

const vSign = hand(
  PALM,
  finger([IDX + 1, 56], [29, 13], 5.6),
  finger([MID + 1, 56], [62, 11], 5.6),
  curled(RNG), curled(LIT, 4.8),
  thumbAcross(60),
);

const crossed = hand(
  PALM,
  finger([IDX, 56], [53, 13], 5.6),
  finger([MID + 2, 56], [37, 15], 5.6),
  curled(RNG), curled(LIT, 4.8),
  thumbAcross(60),
);

const indexUp = hand(
  PALM,
  finger([IDX, 56], [IDX - 1, 9], 5.8),
  curled(MID), curled(RNG), curled(LIT, 4.8),
  thumbAcross(56),
);

const threeUp = hand(
  PALM,
  finger([IDX, 56], [31, 15], 5.5),
  finger([MID, 56], [49, 9], 5.5),
  finger([RNG, 56], [67, 14], 5.5),
  curled(LIT, 4.8),
  thumbAcross(68, 62),
);

const twoTips = hand(
  mark({ tag: 'circle', a: { cx: 33, cy: 13, r: 8.5 } }),
  mark({ tag: 'circle', a: { cx: 60, cy: 13, r: 8.5 } }),
  PALM,
  finger([IDX + 1, 56], [34, 21], 5.6),
  finger([MID + 3, 56], [59, 21], 5.6),
  curled(RNG + 2), curled(LIT + 1, 4.8),
  thumbAcross(60),
);

const twoFlat = hand(
  mark({ tag: 'rect', a: { x: 10, y: 20, width: 80, height: 14, rx: 7 } }),
  PALM,
  finger([IDX + 2, 56], [IDX + 2, 11], 5.6),
  finger([MID + 3.2, 56], [MID + 3.2, 11], 5.6),
  curled(RNG + 2), curled(LIT + 1, 4.8),
  thumbAcross(60),
);

const okSign = hand(
  PALM,
  finger([MID, 56], [51, 9], 5.4),
  finger([RNG, 56], [66, 13], 5.3),
  finger([LIT, 58], [80, 23], 4.7),
  // thumb and index meeting in a ring
  finger([31, 76], [27, 56], 6.2),
  { tag: 'path', a: { d: 'M31 26a15 15 0 1 0 0.01 0ZM31 33.5a7.5 7.5 0 1 1 -0.01 0Z', 'fill-rule': 'evenodd' } },
);

const thumbUp = hand(
  // back of the fist and wrist
  shape('M40 42L72 42C80 42 84 48 84 56L84 92L48 92C42 92 38 88 38 82Z'),
  finger([42, 50], [41, 9], 7),
  finger([26, 52], [56, 52], 5.4),
  finger([26, 63], [58, 63], 5.4),
  finger([28, 74], [58, 74], 5.4),
  finger([30, 85], [56, 85], 5),
);

const fist = hand(
  PALM,
  finger([30, 46], [30, 33], 6.4),
  finger([43, 46], [43, 29], 6.4),
  finger([56, 46], [56, 29], 6.4),
  finger([68.5, 47], [68.5, 34], 6),
  finger([24, 58], [58, 52], 7.2),
  detail('M37 42v6M50 40v6M62.5 42v5'),
);

const pinch = hand(
  PALM,
  finger([67, 56], [53, 15], 5.2),
  finger([59, 54], [51, 10], 5.4),
  finger([49, 54], [49, 9], 5.4),
  finger([39, 56], [47, 12], 5.4),
  finger([30, 70], [44, 18], 6.2),
);

const spread = hand(
  finger([33, 70], [13, 46], 6.2),
  finger([40, 54], [31, 11], 5.4),
  finger([50, 52], [51, 8], 5.6),
  finger([60, 54], [68, 11], 5.4),
  finger([68, 60], [83, 27], 4.9),
  PALM,
  detail('M37 72c8 6 20 6 28 -2'),
  detail('M42 62c6 3 14 3 20 0'),
);

const palm = hand(
  finger([33, 72], [17, 50], 6.2),
  finger([IDX, 56], [IDX, 14], 5.6),
  finger([MID, 56], [MID, 10], 5.6),
  finger([RNG, 56], [RNG, 13], 5.6),
  finger([LIT + 1, 58], [LIT + 1, 22], 5),
  PALM,
  // nails: the back of the hand faces the viewer
  detail('M35.5 12.5v3a3 3 0 0 0 6 0v-3M46.5 8.5v3a3 3 0 0 0 6 0v-3M57.0 11.5v3a3 3 0 0 0 6 0v-3M67.4 20.5v3a2.6 2.6 0 0 0 5.2 0v-3'),
);

const edge = hand(
  // the hand turned on its little-finger side, upright as for a karate chop: a narrow blade,
  // the other fingertips peeking out behind the little finger, the thumb tucked on the palm side
  finger([58, 62], [58.5, 12], 6.4),
  finger([42, 72], [35.5, 50], 5.6),
  shape('M41 96L41.5 27A7 7 0 0 1 55.5 27L55.5 41C60 42 63.5 46 63.5 52L62.5 96Z'),
  detail('M42.5 45.5c3.5 1.6 8 1.6 12.5 -0.5'),
  detail('M43.5 31c2.6 1.1 5.4 1.1 8 0'),
);

/** The drawing of each glyph as plain SVG data (viewBox 0 0 100 100), e.g. for canvas or tests. */
export const GLYPHS: Readonly<Record<GlyphId, readonly SvgNode[]>> = {
  palm, fist, edge, twoTips, twoFlat, vSign, okSign, crossed, thumbUp, pinch, threeUp, indexUp, spread,
};

const SVGNS = 'http://www.w3.org/2000/svg';

function build(n: SvgNode): SVGElement {
  const el = document.createElementNS(SVGNS, n.tag);
  for (const [k, v] of Object.entries(n.a)) el.setAttribute(k, String(v));
  for (const kid of n.kids ?? []) el.append(build(kid));
  return el;
}

/** The glyph as an <svg> (viewBox 0 0 100 100): labelled with `title`, or hidden from assistive tech without one. */
export function glyphSvg(id: GlyphId, title?: string): SVGSVGElement {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', `glyph glyph-${id}`);
  if (title) {
    svg.setAttribute('role', 'img');
    const t = document.createElementNS(SVGNS, 'title');
    t.textContent = title;
    svg.append(t);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const n of GLYPHS[id]) svg.append(build(n));
  return svg;
}
