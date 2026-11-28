/**
 * Rozkwit's own picture (DESIGN.md §24): the whole person at once — the finale of the health visualisations.  The
 * figure is Lekkość i siła's (ksztalt/geo.ts: the same calm, featureless person of light, a woman's or a man's
 * silhouette for the player's look), seen from the front, standing; on it, everything the section's pictures
 * showed one by one lights together:
 *
 *   cells      thousands of small lights through the whole body (energy, repair, renewal)
 *   spine      the column from the skull's base to the sacrum, lit from below, discs aqua between the vertebrae,
 *              and a thread of light up from the crown (upright, lightly)
 *   hair       the hair round the head in its colour, growing from the root, a sheen gliding down it
 *   skin       the outline warm and alive, small lights travelling round it (the skin renewing)
 *   strength   soft coral light in the great muscles: shoulders, chest, the core, thighs, calves
 *   joy        (the second scene) light rising from the heart in rings, running to the crown, the hands and the
 *              feet; blossoms of light opening round the feet and in the air; and people near and far lit by it
 *
 * Units: the figure's own ×100 (ksztalt `F`): the crown at (0, 0), the soles at y ≈ 100, the viewer's left negative.
 * Still parts (the ghost of the figure, the floor's glow, the people's outlines) are baked; what grows is drawn.
 * Light is light: glow sprites and strokes, no shadowBlur, no filters, nothing erased on the frame (destination-out
 * only in the bake).
 */
import { frontOutline, frontPath, type Look, type P } from '../ksztalt/geo';
import { figureLight, motes, phase, pointOn, sparkle, wpx } from '../ksztalt/draw';
import { AQUA, GOLD, GOLD_HI, PEARL, ROSE, TAU, glow, glowEllipse, hash, mix, rgba, smoothPath } from '../kit/healthlib/paint';
import type { Pt, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { HAIR_COLOUR } from './world-hair';
import { COLOUR } from '../wlosy/content';

/** The silhouette for Rozkwit's look (Nowe siły's six since round 25: a man's `m…` is Lekkość i siła's `on`). */
const lookOf = (l: string): Look => (l === 'on' || l.startsWith('m') ? 'on' : 'ona');

// ── places on the figure (world units) ───────────────────────────
export const HEART: Pt = [1.8, 27];
export const CROWN: Pt = [0, 0.4];
export const LUMBAR: Pt = [0, 44];
export const CHEST: Pt = [0, 30];
export const SCALP: Pt = [2.2, 1.6];
export const ARM: Pt = [-14.2, 36];
export const LUNG: Pt = [-4.5, 29];
export const THIGH: Pt = [-6.2, 64];
export const HAIR_AT: Pt = [-5.4, 3.4];
export const SKIN_AT: Pt = [-12.6, 21.6];
export const FEET_Y = 99.6;
/** the hands' middle (the viewer's left, right) */
export const HANDS: readonly Pt[] = [[-16.6, 50.5], [16.6, 50.5]];

/** The views of the two scenes (cialo: the figure; rozkwit: with the blossoms and the people round it). */
export const BODY_VIEW = { x: -46, y: -8, w: 92, h: 112 };
export const BLOOM_VIEW = { x: -67, y: -14, w: 134, h: 120 };

// ── the spine, from the front ────────────────────────────────────
interface Vert { y: number; h: number; w: number }
/** 7 cervical, 12 thoracic, 5 lumbar vertebrae from the skull's base down; then the sacrum. */
export const VERTS: readonly Vert[] = (() => {
  const out: Vert[] = [];
  const run = (n: number, y0: number, y1: number, w0: number, w1: number): void => {
    const step = (y1 - y0) / n;
    for (let i = 0; i < n; i++) out.push({ y: y0 + step * (i + 0.5), h: step * 0.7, w: w0 + ((w1 - w0) * i) / Math.max(1, n - 1) });
  };
  run(7, 12.6, 19.4, 2.1, 2.5);
  run(12, 19.6, 38.6, 2.6, 3.4);
  run(5, 38.8, 47.8, 3.7, 4.3);
  return out;
})();
const SACRUM: readonly P[] = [[-2.8, 48.4], [2.8, 48.4], [1.9, 52.6], [0.6, 55.4], [-0.6, 55.4], [-1.9, 52.6]];

// ── the hair, from the front ─────────────────────────────────────
/** Pairs (inner, outer) down the viewer's right side from the top of the head (figure units); mirrored for the left. */
const HAIR_SIDE: Readonly<Record<Look, readonly (readonly [P, P])[]>> = {
  ona: [
    [[0, 0.027], [0, -0.009]], [[0.016, 0.022], [0.033, -0.001]], [[0.033, 0.032], [0.051, 0.024]], [[0.041, 0.062], [0.058, 0.06]],
    [[0.043, 0.102], [0.06, 0.1]], [[0.042, 0.15], [0.062, 0.152]], [[0.046, 0.196], [0.064, 0.19]],
  ],
  on: [
    [[0, 0.025], [0, -0.008]], [[0.016, 0.021], [0.034, 0.0]], [[0.033, 0.029], [0.052, 0.024]], [[0.044, 0.047], [0.057, 0.048]],
    [[0.048, 0.066], [0.055, 0.07]],
  ],
};

const F = 100;
const sc = (p: P): Pt => [p[0] * F, p[1] * F];

/** The hair's shape (both sides) and its strands (each a polyline from the top down), in world units. */
function hairOf(look: Look): { shape: Path2D; strands: Pt[][]; top: number; bottom: number } {
  const side = HAIR_SIDE[look];
  const outer = side.map(([, o]) => sc(o));
  const inner = side.map(([i]) => sc(i));
  const mirror = (p: Pt): Pt => [-p[0], p[1]];
  const ring: Pt[] = [...outer, ...[...inner].reverse(), ...inner.map(mirror).slice(1), ...[...outer].reverse().map(mirror).slice(0, -1)];
  const shape = new Path2D();
  smoothPath(shape, [...ring, ring[0]]);
  shape.closePath();
  const strands: Pt[][] = [];
  const N = look === 'ona' ? 9 : 7;
  for (const s of [1, -1] as const) {
    for (let j = 0; j < N; j++) {
      const f = 0.08 + (0.84 * j) / (N - 1);
      strands.push(side.map(([i, o]) => [s * (i[0] + (o[0] - i[0]) * f) * F, (i[1] + (o[1] - i[1]) * f) * F] as Pt));
    }
  }
  const ys = ring.map(p => p[1]);
  return { shape, strands, top: Math.min(...ys), bottom: Math.max(...ys) };
}

// ── the cells: small lights through the body ─────────────────────
function inside(poly: readonly P[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
interface Cell { x: number; y: number; r: number; ph: number; hue: string; k: number }
const CELL_HUES = [GOLD, GOLD_HI, PEARL, AQUA, ROSE];
function cellsOf(look: Look): Cell[] {
  const poly = frontOutline(look);
  const out: Cell[] = [];
  for (let i = 0; out.length < 150 && i < 4000; i++) {
    const x = (hash(i * 3.7 + 11) - 0.5) * 0.36, y = 0.02 + hash(i * 5.3 + 7) * 0.95;
    if (!inside(poly, x, y)) continue;
    // fewer in the head (the hair is there), the order of lighting: from the heart outward
    const d = Math.hypot(x - 0.018, (y - 0.27) * 0.55);
    out.push({ x: x * F, y: y * F, r: 0.32 + hash(i * 1.9) * 0.5, ph: hash(i * 2.3) * TAU, hue: CELL_HUES[i % CELL_HUES.length], k: Math.min(1, d / 0.32) });
  }
  return out;
}

// ── the strong muscles: soft coral light (world units: centre, radii, turn) ──
const MUSCLES: readonly (readonly [number, number, number, number, number])[] = [
  [-12.2, 21.4, 3.6, 2.6, -0.5], [12.2, 21.4, 3.6, 2.6, 0.5],
  [-5.2, 25.4, 4.8, 3.2, 0.1], [5.2, 25.4, 4.8, 3.2, -0.1],
  [-13.6, 29.6, 2.2, 5.4, 0.12], [13.6, 29.6, 2.2, 5.4, -0.12],
  [0, 37.6, 4.4, 7.4, 0],
  [-6.4, 63, 4.2, 10.6, 0.05], [6.4, 63, 4.2, 10.6, -0.05],
  [-5, 83.4, 2.4, 6.2, 0.04], [5, 83.4, 2.4, 6.2, -0.04],
];
const CORAL = '#ff9a86';

// ── the blossoms and the people of the second scene ──────────────
/** Flowers of light on the ground round the feet, each on a short stem (world units: the head's place, its size). */
interface Bloom { x: number; y: number; r: number; stem: number; hue: string; at: number; turn: number }
export const BLOOMS: readonly Bloom[] = (() => {
  const spots: [number, number, number][] = [
    // x, stem height, petal size — near the feet first, then outward
    [-11, 3.4, 2.6], [12, 4.2, 2.8], [-20, 6.2, 3.2], [21, 5.2, 3], [-30, 4, 2.7], [31, 6.8, 3.3], [-40, 5.6, 3],
    [41, 3.8, 2.6], [-49, 2.6, 2.2], [48, 3, 2.3], [-7, 1.8, 1.9], [26, 2.2, 2], [-34, 8.4, 2.4], [6, 2.4, 1.9],
  ];
  const hues = [GOLD, ROSE, PEARL, AQUA, '#ffc7a8', GOLD_HI, '#d8c4ff'];
  return spots.map(([x, stem, r], i) => ({
    x, y: FEET_Y + 1 - stem, r, stem, hue: hues[i % hues.length], at: 0.36 + 0.56 * hash(i * 9.1 + 3), turn: hash(i * 4.4) * TAU,
  }));
})();
/** Petals of light rising round the person as joy spreads (the unit the meditation counts). */
const PETALS = 18;
interface Person { x: number; s: number; look: Look; at: number }
export const PEOPLE: readonly Person[] = [
  { x: -40, s: 0.56, look: 'on', at: 0.62 }, { x: 40, s: 0.56, look: 'ona', at: 0.68 },
  { x: -56, s: 0.4, look: 'ona', at: 0.8 }, { x: 56, s: 0.4, look: 'on', at: 0.86 },
];
const personMap = (p: Person) => (x: number, y: number): [number, number] => [p.x + x * F * p.s, FEET_Y - (0.996 - y) * F * p.s];

// ── caches ───────────────────────────────────────────────────────
const paths = new Map<string, Path2D>();
function bodyPath(look: Look): Path2D {
  let p = paths.get(look);
  if (!p) { p = frontPath(look, (x, y) => [x * F, y * F]); paths.set(look, p); }
  return p;
}
function personPath(i: number): Path2D {
  const key = `p${i}`;
  let p = paths.get(key);
  if (!p) { p = frontPath(PEOPLE[i].look, personMap(PEOPLE[i])); paths.set(key, p); }
  return p;
}
const hairs = new Map<Look, ReturnType<typeof hairOf>>();
const hairFor = (l: Look) => hairs.get(l) ?? (hairs.set(l, hairOf(l)), hairs.get(l)!);
const cellLists = new Map<Look, Cell[]>();
const cellsFor = (l: Look) => cellLists.get(l) ?? (cellLists.set(l, cellsOf(l)), cellLists.get(l)!);

// ── how far each part shines in a scene at growth g ──────────────
export interface Shine { cells: number; spine: number; hair: number; skin: number; strength: number; joy: number; blooms: number; people: number }
export function shine(scene: string, g: number): Shine {
  if (scene === 'rozkwit') {
    // everything already lit softly (the scene before grew it), all of it rising together, and joy from the heart
    const all = 0.5 + 0.5 * phase(g, 0, 0.7);
    return { cells: all, spine: all, hair: all, skin: all, strength: all, joy: phase(g, 0.12, 0.85), blooms: g, people: g };
  }
  return {
    cells: phase(g, 0, 0.26), spine: phase(g, 0.18, 0.46), hair: phase(g, 0.4, 0.64), skin: phase(g, 0.58, 0.82), strength: phase(g, 0.76, 1),
    joy: 0, blooms: 0, people: 0,
  };
}

/** Where the growing point stands: along the order in which the parts light. */
const PATH_BODY: readonly (readonly [number, Pt])[] = [
  [0, CHEST], [0.2, [0, 52]], [0.44, [0, 13]], [0.52, SCALP], [0.64, [-5.6, 4]], [0.7, SKIN_AT], [0.84, [-13.6, 30]], [1, THIGH],
];
export function focusOf(scene: string, g: number): Pt {
  if (scene === 'rozkwit') return HEART;
  for (let i = 1; i < PATH_BODY.length; i++) {
    const [g1, p1] = PATH_BODY[i];
    if (g <= g1) {
      const [g0, p0] = PATH_BODY[i - 1];
      const k = phase(g, g0, g1);
      return [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
    }
  }
  return PATH_BODY[PATH_BODY.length - 1][1];
}

// ── the bake ─────────────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D, variant: string, lookId: string): void {
  const look = lookOf(lookId);
  // the floor's glow under the feet, and a soft halo round the person
  glowEllipse(ctx, '#c9a7ff', 0, FEET_Y + 0.6, 30, 4.2, 0, 0.3);
  glowEllipse(ctx, '#ffd9b0', 0, 48, 34, 62, 0, 0.07);
  if (variant === 'bloom') {
    glowEllipse(ctx, '#c9a7ff', 0, FEET_Y + 0.8, 70, 5, 0, 0.16);
    for (let i = 0; i < PEOPLE.length; i++) {
      const p = PEOPLE[i];
      glowEllipse(ctx, '#c9a7ff', p.x, FEET_Y + 0.4, 12 * p.s, 1.8 * p.s, 0, 0.18);
      figureLight(ctx, personPath(i), FEET_Y - 99.6 * p.s, FEET_Y, { alpha: 0.32 });
    }
  }
  figureLight(ctx, bodyPath(look), 0, 99.6, { alpha: 0.85 });
  // the ghost of the spine and of the hair, so what grows has a place to grow into
  ctx.save();
  ctx.clip(bodyPath(look));
  ctx.fillStyle = 'rgba(190,232,240,.07)';
  for (const v of VERTS) roundRect(ctx, -v.w / 2, v.y - v.h / 2, v.w, v.h, v.h * 0.35);
  ctx.restore();
  const hr = hairFor(look);
  ctx.fillStyle = 'rgba(160,120,96,.12)';
  ctx.fill(hr.shape);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

// ── the frame ────────────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const look = lookOf(st.look);
  const s = shine(st.scene, st.g);
  const t = st.time, R = st.reduced;
  const tw = (ph: number, sp = 1): number => (R ? 0.75 : 0.55 + 0.45 * Math.sin(t * 1.7 * sp + ph));
  const warm = 0.35 + 0.65 * st.deep;
  const body = bodyPath(look);

  // the inner light warms with all that shines, and with calm
  const lit = (s.cells + s.spine + s.hair + s.skin + s.strength) / 5;
  if (lit > 0.01) {
    glowEllipse(ctx, '#ffe2c4', 0, 34, 15, 30, 0, 0.12 * lit * (0.7 + 0.3 * warm));
    glowEllipse(ctx, '#ffd0b8', 0, 70, 10, 26, 0, 0.07 * lit);
  }

  // joy (the second scene): from the heart, before the rest so the body glows over it
  if (s.joy > 0.01) drawJoy(ctx, st, s.joy, s.people);
  if (s.blooms > 0.01) drawBlooms(ctx, st, s.blooms);

  // the cells: small lights from the heart outward
  if (s.cells > 0.01) {
    const cells = cellsFor(look);
    for (const c of cells) {
      const on = Math.max(0, Math.min(1, (s.cells * 1.35 - c.k * 0.35) / 1));
      if (on <= 0.02) continue;
      const a = on * tw(c.ph, 0.8 + c.r);
      glow(ctx, c.hue, c.x, c.y, c.r * 3.4, 0.34 * a);
      ctx.fillStyle = rgba(mix(c.hue, '#ffffff', 0.45), 0.85 * a);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.42, 0, TAU);
      ctx.fill();
    }
    if (st.growing && st.scene === 'cialo' && st.g < 0.3) for (let i = 0; i < 4; i++) {
      const c = cells[(Math.floor(t * 3) * 7 + i * 37) % cells.length];
      sparkle(ctx, c.x, c.y, 2.2, 0.7 * tw(i));
    }
  }

  // the spine: lit from the sacrum up, the discs aqua between, a thread of light up from the crown
  if (s.spine > 0.01) {
    ctx.save();
    ctx.clip(body);
    const n = VERTS.length;
    for (let i = n - 1; i >= 0; i--) {
      const v = VERTS[i];
      const on = Math.max(0, Math.min(1, s.spine * (n + 3) - (n - 1 - i)) / 1);
      const k = Math.min(1, on);
      if (k <= 0.01) continue;
      ctx.fillStyle = rgba('#fff1e0', 0.5 * k);
      roundRect(ctx, -v.w / 2, v.y - v.h / 2, v.w, v.h, v.h * 0.35);
      if (i > 0) {
        const dy = (v.y - v.h / 2 + VERTS[i - 1].y + VERTS[i - 1].h / 2) / 2;
        glowEllipse(ctx, AQUA, 0, dy, v.w * 0.62, 0.9, 0, 0.55 * k);
      }
    }
    const sk = Math.max(0, Math.min(1, s.spine * (n + 3) - n));
    if (sk > 0.01) {
      ctx.fillStyle = rgba('#fff1e0', 0.45 * sk);
      ctx.beginPath();
      SACRUM.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    glowEllipse(ctx, '#bfefff', 0, 33, 3.4, 22, 0, 0.16 * s.spine);
    // upright, lightly: a thread of light rising from the crown
    const up = phase(s.spine, 0.75, 1);
    if (up > 0.01) {
      const h = 7 * up;
      const gr = ctx.createLinearGradient(0, 0, 0, -h);
      gr.addColorStop(0, rgba(GOLD_HI, 0.7 * up));
      gr.addColorStop(1, rgba(GOLD_HI, 0));
      ctx.strokeStyle = gr;
      ctx.lineWidth = wpx(ctx, 1.6);
      ctx.beginPath();
      ctx.moveTo(0, -0.6);
      ctx.lineTo(0, -h);
      ctx.stroke();
      glow(ctx, GOLD_HI, 0, -1.2, 3.2, 0.3 * up);
    }
  }

  // the hair: grows from the root, its colour deepening, a sheen gliding down it
  if (s.hair > 0.01) drawHair(ctx, st, look, s.hair);

  // the skin: the outline warm and alive, small lights travelling round it
  if (s.skin > 0.01) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba('#ffc2a6', 0.16 * s.skin * (0.8 + 0.2 * warm));
    ctx.lineWidth = Math.max(wpx(ctx, 6), 1.8);
    ctx.stroke(body);
    ctx.strokeStyle = rgba('#ffe4d6', 0.55 * s.skin);
    ctx.lineWidth = Math.max(wpx(ctx, 1.6), 0.45);
    ctx.stroke(body);
    if (!R) {
      ctx.setLineDash([0.6, 9]);
      ctx.lineDashOffset = -t * 3.2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba('#fff6ee', 0.9 * s.skin);
      ctx.lineWidth = Math.max(wpx(ctx, 2.6), 0.7);
      ctx.stroke(body);
    }
    ctx.restore();
  }

  // strength: soft coral light in the great muscles, breathing slowly
  if (s.strength > 0.01) {
    ctx.save();
    ctx.clip(body);
    MUSCLES.forEach(([x, y, rx, ry, rot], i) => {
      const k = phase(s.strength, (i % 6) * 0.06, 0.7 + (i % 6) * 0.06);
      glowEllipse(ctx, CORAL, x, y, rx * 1.5, ry * 1.5, rot, 0.3 * k * tw(i * 1.3, 0.5));
      glowEllipse(ctx, '#ffd2c4', x, y, rx * 0.8, ry * 0.8, rot, 0.16 * k);
    });
    ctx.restore();
  }

  // a grown picture lives on gently: a few sparkles over the whole person
  if (st.g > 0.98 && !R) {
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.25 + i / 5) % 1;
      const ang = hash(i * 7.7 + Math.floor(t * 0.25 + i / 5)) * TAU;
      sparkle(ctx, Math.cos(ang) * 12 * (0.5 + k), 46 + Math.sin(ang) * 40 * (0.4 + 0.6 * k), 2 + 1.4 * Math.sin(Math.PI * k), 0.55 * Math.sin(Math.PI * k));
    }
  }
}

function drawHair(ctx: CanvasRenderingContext2D, st: WorldState, look: Look, k: number): void {
  const hr = hairFor(look);
  const col = COLOUR[HAIR_COLOUR];
  const span = hr.bottom - hr.top;
  // the mass, deeper as it grows
  const fill = ctx.createLinearGradient(0, hr.top, 0, hr.bottom);
  fill.addColorStop(0, rgba(mix(col.strand, col.sheen, 0.25), 0.55 + 0.35 * k));
  fill.addColorStop(1, rgba(col.strand, 0.4 + 0.45 * k));
  ctx.save();
  ctx.globalAlpha *= Math.min(1, k * 1.6);
  ctx.fillStyle = fill;
  ctx.fill(hr.shape);
  ctx.restore();
  ctx.save();
  ctx.clip(hr.shape);
  // the strands grow from the root (the top) down to their length
  const grow = 0.3 + 0.7 * k;
  const sheenY = hr.top + span * (st.reduced ? 0.35 : 0.15 + 0.7 * ((st.time * 0.09) % 1));
  const sheen = ctx.createLinearGradient(0, sheenY - span * 0.16, 0, sheenY + span * 0.16);
  sheen.addColorStop(0, rgba(col.sheen, 0));
  sheen.addColorStop(0.5, rgba(col.sheen, 0.8 * k));
  sheen.addColorStop(1, rgba(col.sheen, 0));
  ctx.lineCap = 'round';
  for (const strand of hr.strands) {
    const pts: Pt[] = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) pts.push(pointOn(strand, (i / steps) * grow));
    ctx.beginPath();
    smoothPath(ctx, pts);
    ctx.strokeStyle = rgba(mix(col.strand, '#000000', 0.25), 0.55 * k);
    ctx.lineWidth = Math.max(wpx(ctx, 1.1), 0.34);
    ctx.stroke();
    ctx.strokeStyle = sheen;
    ctx.lineWidth = Math.max(wpx(ctx, 1.2), 0.38);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, col.sheen, 0, hr.top + span * 0.25, 8, 0.16 * k);
}

function drawJoy(ctx: CanvasRenderingContext2D, st: WorldState, k: number, people: number): void {
  const [hx, hy] = HEART;
  const t = st.time;
  const breath = st.breath;
  // the warm light of the heart
  glow(ctx, '#ffd98a', hx, hy, 8 + 24 * k * (0.92 + 0.16 * breath), 0.5 * k);
  glow(ctx, '#fff1c9', hx, hy, 3 + 4 * k, 0.8 * k);
  // rings rising outward from it
  ctx.save();
  const n = 3;
  for (let i = 0; i < n; i++) {
    const p = st.reduced ? (i + 0.5) / n : ((t * 0.16) + i / n) % 1;
    const r = 4 + p * 80 * (0.4 + 0.6 * k);
    const a = k * (1 - p) * 0.5;
    if (a <= 0.01) continue;
    ctx.strokeStyle = rgba(i % 2 ? '#ffc7a8' : GOLD, a);
    ctx.lineWidth = wpx(ctx, 1.4);
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  // light running from the heart to the crown, the hands and the feet
  const ends: Pt[] = [CROWN, HANDS[0], HANDS[1], [-4.4, 97.2], [4.4, 97.2]];
  for (let i = 0; i < ends.length; i++) {
    const e = ends[i];
    const mid: Pt = [(hx + e[0]) / 2 + (e[1] > hy ? 0 : 0), (hy + e[1]) / 2];
    motes(ctx, [HEART, mid, e], 3, t, 0.9, 0.9, i % 2 ? GOLD_HI : '#ffc7a8', k, i * 11, st.reduced);
  }
  // the people near and far, lit as the light reaches them
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const on = phase(people, p.at, Math.min(1, p.at + 0.14));
    if (on <= 0.01) continue;
    const path = personPath(i);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = rgba('#ffe6cc', 0.14 * on);
    ctx.fill(path);
    ctx.strokeStyle = rgba('#ffe1c2', 0.75 * on);
    ctx.lineWidth = wpx(ctx, 1.2);
    ctx.stroke(path);
    ctx.restore();
    const [cx, cy] = [p.x + 1.8 * p.s, FEET_Y - (0.996 - 0.27) * F * p.s];
    glow(ctx, GOLD, cx, cy, 10 * p.s + 6 * on * p.s, 0.45 * on);
  }
}

function drawBlooms(ctx: CanvasRenderingContext2D, st: WorldState, g: number): void {
  const t = st.time;
  for (const b of BLOOMS) {
    const open = phase(g, b.at - 0.3, b.at + 0.06);
    if (open <= 0.01) continue;
    const sway = st.reduced ? 0 : 0.1 * Math.sin(t * 0.8 + b.turn);
    // the stem and a leaf, rising first
    const rise = phase(open, 0, 0.5);
    const tipX = b.x + sway * b.stem * 0.6, tipY = FEET_Y + 1 - b.stem * rise;
    ctx.strokeStyle = rgba('#bfe8c8', 0.5 * rise);
    ctx.lineWidth = Math.max(wpx(ctx, 1), 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, FEET_Y + 1);
    ctx.quadraticCurveTo(b.x + sway * b.stem * 0.2, FEET_Y + 1 - b.stem * 0.5 * rise, tipX, tipY);
    ctx.stroke();
    if (b.stem > 3) {
      ctx.fillStyle = rgba('#bfe8c8', 0.32 * rise);
      ctx.beginPath();
      ctx.ellipse(b.x + 0.9, FEET_Y + 1 - b.stem * 0.42 * rise, 1.1, 0.42, -0.5, 0, TAU);
      ctx.fill();
    }
    // the flower opening
    const k = phase(open, 0.3, 1);
    if (k <= 0.01) continue;
    glow(ctx, b.hue, tipX, tipY, b.r * 3.2, 0.32 * k);
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(b.turn + sway);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(TAU / 5);
      const len = b.r * (0.35 + 0.65 * k);
      ctx.beginPath();
      ctx.ellipse(0, -len * 0.55, len * 0.34 * (0.6 + 0.4 * k), len * 0.56, 0, 0, TAU);
      ctx.fillStyle = rgba(mix(b.hue, '#ffffff', 0.3), 0.6 * k);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.22, 0, TAU);
    ctx.fillStyle = rgba(GOLD_HI, 0.95 * k);
    ctx.fill();
    ctx.restore();
  }
  // petals of light rising round the person, more as joy spreads
  const n = Math.round(PETALS * phase(g, 0.2, 0.9));
  for (let i = 0; i < n; i++) {
    const life = st.reduced ? 0.5 : (t * 0.06 + hash(i * 3.1)) % 1;
    const side = i % 2 ? 1 : -1;
    const x = side * (9 + 28 * hash(i * 7.3)) + (st.reduced ? 0 : 3 * Math.sin(t * 0.7 + i));
    const y = FEET_Y - 6 - life * 86;
    const a = Math.sin(Math.PI * life) * 0.7;
    const hue = [GOLD, ROSE, PEARL, '#ffc7a8'][i % 4];
    glow(ctx, hue, x, y, 2.6, 0.22 * a);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hash(i) * TAU + (st.reduced ? 0 : t * (0.3 + hash(i * 2) * 0.5)));
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.55, 1.15, 0, 0, TAU);
    ctx.fillStyle = rgba(mix(hue, '#ffffff', 0.35), a);
    ctx.fill();
    ctx.restore();
  }
}

export const WHOLE_WORLD: WorldPainter = {
  depth: 0,
  lens: false,
  bake,
  draw,
  focusAt: focusOf,
};
