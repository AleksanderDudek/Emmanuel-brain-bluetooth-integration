/**
 * Źródła's pictures outside play: the lobby's hero and the game card.  With the player's progress the
 * lobby shows their road of the Songs of Ascents as a relief map winding up from the bottom left:
 * every closed valley a small oasis (its green from how green it grew, its pool from how deep, a pair
 * of birds where a pair nested, young where they hatched), the day's trees by the road at their
 * growth, the current valley's spring pulsing at the road's head and the next stage's hills beyond.
 * The card (no progress) is a close-up of one valley's corner drawn with the game's own painters: a
 * spring in rose rock pouring through a bend and a tee into terraced pools, green, flowers, two
 * sparrows on the rim.  Drawn every frame in the lobby, so the land is baked per size.
 */
import { clamp } from '../kit/juice';
import { TREES } from './content';
import { ValleyPainter, type BoardState } from './board';
import type { Layout } from './layout';
import { treeStage, type ZrodlaProgress } from './meta';
import { C, canvas, hash, paintBird, paintContours, paintNest, paintPilgrim, paintTree, poolColor, rgba } from './paint';
import { Run } from './sim';
import { FIELD, ROCK, STONE, Valley } from './valley';

const TAU = Math.PI * 2;

/** A point on the road at u (0 its foot, 1 its head), in a w × h box: a slow S rising from the bottom left. */
export function roadPoint(u: number, w: number, h: number, out: { x: number; y: number }): { x: number; y: number } {
  const k = clamp(u);
  const x0 = w * 0.06, y0 = h * 0.94, x3 = w * 0.94, y3 = h * 0.12;
  const x1 = w * 0.62, y1 = h * 1.02, x2 = w * 0.3, y2 = h * 0.08;
  const m = 1 - k;
  out.x = m * m * m * x0 + 3 * m * m * k * x1 + 3 * m * k * k * x2 + k * k * k * x3;
  out.y = m * m * m * y0 + 3 * m * m * k * y1 + 3 * m * k * k * y2 + k * k * k * y3;
  return out;
}

interface RoadCache { w: number; h: number; key: string; land: HTMLCanvasElement | null }
const caches = new Map<string, RoadCache>();

/**
 * The player's road (or a generic short one, `p` absent): the land with its contours and the road
 * baked per size and progress; `t` animates the head's spring, where pilgrims walk up (`withHead`; the
 * intro has its own camp instead).
 */
export function paintRoad(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: ZrodlaProgress | undefined, slot: string, dpr: number, withHead = true): void {
  const road = p?.road ?? [];
  const key = `${Math.round(w)}|${Math.round(h)}|${dpr}|${p ? `${p.roadIndex}|${road.length}|${p.trees.length}|${road.map(r => `${r.i}${r.d}${r.g}${r.n}${r.y}`).join('')}` : 'card'}`;
  let c = caches.get(slot);
  if (!c || c.key !== key) {
    c = { w, h, key, land: canvas(w * dpr, h * dpr) };
    caches.set(slot, c);
    const lx = c.land?.getContext('2d');
    if (lx) {
      lx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bakeRoad(lx, w, h, p);
    }
  }
  if (c.land) ctx.drawImage(c.land, 0, 0, w, h);
  if (!withHead) return;
  // the head of the road: the current valley's spring, pulsing
  const pt = { x: 0, y: 0 };
  const sites = siteCount(w, h);
  const head = Math.min(sites - 3, road.length);
  roadPoint((head + 0.5) / sites, w, h, pt);
  const s = Math.min(w, h) * 0.075;
  for (let k = 0; k < 3; k++) {
    const q = ((t * 0.7) / 3 + k / 3) % 1;
    ctx.strokeStyle = rgba(C.foam, 0.8 * (1 - q));
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, s * (0.3 + 1.1 * q), 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = C.water;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, s * 0.32, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(C.foam, 0.8);
  ctx.beginPath();
  ctx.arc(pt.x - s * 0.1, pt.y - s * 0.1, s * 0.1, 0, TAU);
  ctx.fill();
  // pilgrims walking up to it
  const ps = Math.max(3.5, s * 0.22);
  for (let i = 0; i < 3; i++) {
    roadPoint(Math.max(0, (head + 0.5) / sites - 0.04 - i * 0.018 + ((t * 0.004) % 0.012)), w, h, pt);
    paintPilgrim(ctx, pt.x, pt.y, ps, i, false);
  }
}

/** How many sites the road shows at a size: the closed valleys near the head, the head, two beyond. */
const siteCount = (w: number, h: number): number => (Math.min(w, h) < 300 ? 8 : 11);

function bakeRoad(ctx: CanvasRenderingContext2D, w: number, h: number, p: ZrodlaProgress | undefined): void {
  const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
  bg.addColorStop(0, '#efe3c9');
  bg.addColorStop(0.55, '#e0d0b2');
  bg.addColorStop(1, '#bfa98a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  paintContours(ctx, w, h, 77, { scale: Math.max(90, Math.min(w, h) * 0.32), levels: 9, color: C.ink, alpha: 0.12, step: 5 });
  // hills beyond the head: the next stage's rise, darker contours in the top right
  const hill = ctx.createRadialGradient(w * 0.86, h * 0.1, 0, w * 0.86, h * 0.1, Math.min(w, h) * 0.45);
  hill.addColorStop(0, 'rgba(201,143,122,.35)');
  hill.addColorStop(1, 'rgba(201,143,122,0)');
  ctx.fillStyle = hill;
  ctx.fillRect(0, 0, w, h);
  const pt = { x: 0, y: 0 };
  // the road
  ctx.save();
  ctx.strokeStyle = 'rgba(120,92,58,.55)';
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.018);
  ctx.lineCap = 'round';
  ctx.setLineDash([Math.min(w, h) * 0.022, Math.min(w, h) * 0.018]);
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    roadPoint(i / 60, w, h, pt);
    if (i) ctx.lineTo(pt.x, pt.y); else ctx.moveTo(pt.x, pt.y);
  }
  ctx.stroke();
  ctx.restore();
  const sites = siteCount(w, h);
  const s = Math.min(w, h) * 0.075;
  const road = p ? p.road.slice(-(sites - 3)) : DEMO;
  // the closed valleys: oases along the road
  road.forEach((rv, k) => {
    roadPoint((k + 0.5) / sites, w, h, pt);
    const side = k % 2 ? 1 : -1;
    const x = pt.x + side * s * 0.9, y = pt.y - s * 0.4;
    const green = 0.4 + 0.9 * (rv.g / 100);
    ctx.fillStyle = 'rgba(80,60,40,.18)';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.12, y + s * 0.2, s * (0.75 + green * 0.5), s * (0.5 + green * 0.35), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(C.sage, 0.85);
    ctx.beginPath();
    ctx.ellipse(x, y, s * (0.7 + green * 0.5), s * (0.45 + green * 0.35), 0.2, 0, TAU);
    ctx.fill();
    for (let j = 0; j < 14; j++) {
      const a = hash(k * 31 + j) * TAU, d = s * (0.4 + green * 0.5) * Math.sqrt(hash(k * 17 + j));
      ctx.fillStyle = j % 4 === 0 ? C.anemone : j % 3 ? C.olive : '#a9c08f';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, Math.max(0.8, s * (j % 4 === 0 ? 0.05 : 0.07)), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = poolColor(Math.max(1, rv.d));
    ctx.beginPath();
    ctx.ellipse(x, y, s * (0.25 + 0.06 * rv.d), s * (0.16 + 0.04 * rv.d), 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(C.foam, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x - s * 0.05, y - s * 0.03, s * 0.12, s * 0.06, 0.2, Math.PI, Math.PI * 1.8);
    ctx.stroke();
    if (rv.n) {
      paintNest(ctx, x + s * 0.55, y + s * 0.18, s * 0.3, rv.y === 1, 0);
      paintBird(ctx, rv.n === 1 ? 'sparrow' : 'swallow', x + s * 0.32, y + s * 0.02, s * 0.32, 1);
    }
  });
  // the next sites: dry hollows waiting
  for (let k = road.length + 1; k < sites; k++) {
    roadPoint((k + 0.5) / sites, w, h, pt);
    ctx.strokeStyle = 'rgba(120,92,58,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(pt.x + (k % 2 ? 1 : -1) * s * 0.9, pt.y - s * 0.4, s * 0.5, s * 0.32, 0.2, 0, TAU);
    ctx.stroke();
  }
  // the day's trees by the road (a few young ones on the cards)
  const trees = p ? p.trees.slice(-6) : [{ k: 0, d: '' }, { k: 4, d: '' }, { k: 2, d: '' }];
  const today = p?.lastDay || '';
  trees.forEach((tr, k) => {
    roadPoint((k + 1.05) / sites, w, h, pt);
    const stage = p ? treeStage(tr.d, today) : 2;
    paintTree(ctx, TREES[tr.k % TREES.length].kind, pt.x + (k % 2 ? -1 : 1) * s * 0.55, pt.y + s * 0.35, s * 0.55, stage, k + 1);
  });
  // a gentle dawn: light from the top right, shade toward the bottom left (the lobby's title sits there)
  const light = ctx.createLinearGradient(w, 0, 0, h);
  light.addColorStop(0, 'rgba(255,244,218,.25)');
  light.addColorStop(0.6, 'rgba(91,91,143,0)');
  light.addColorStop(1, 'rgba(60,52,90,.32)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);
}

/** A generic road for the cards: a few oases. */
const DEMO = [
  { i: 0, d: 2, g: 40, n: 1 as const, y: 0 as const }, { i: 1, d: 1, g: 25, n: 0 as const, y: 0 as const },
  { i: 2, d: 3, g: 60, n: 2 as const, y: 1 as const }, { i: 3, d: 2, g: 35, n: 0 as const, y: 0 as const },
];

// ── the card: a valley's corner ─────────────────────────────────
let corner: { run: Run; painter: ValleyPainter } | null = null;

/** A spring in the rose rock, a pre-set straight, a tee and a bend, two terraced pools watered and green; a pair of sparrows. */
function cornerValley(): { run: Run; painter: ValleyPainter } {
  if (corner) return corner;
  const S = STONE, F = FIELD, R = ROCK;
  const v = new Valley(3, 2, [S, S, S, R, F, F], [10, 14, 12, 0, 0, 0], [1, 0, 0, 0, 0, 0], [{ kind: 'spring', cell: 0, side: 3 }]);
  const run = new Run('road', 1, 4242, 0, v);
  run.closed = true;
  run.wet.fill(1);
  run.jars[0] = 11;
  run.jars[1] = 4;
  run.green[0] = 1.6;
  run.green[1] = 1.1;
  run.nest = { field: 0, bird: 'sparrow', young: false };
  corner = { run, painter: new ValleyPainter(run, { strips: false }) };
  return corner;
}

const STILL: BoardState = { t: 0, phi: 0.6, flowing: true, blind: false, gauge: false, veil: 0, haze: 0, curb: 2, hint: -1, cursor: -1, rest: false, reduced: false, nestIn: 1 };

/** The lobby's hero (with progress) or the card art (without): drawn every frame, cheap. */
export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: ZrodlaProgress): void {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  if (p) {
    paintRoad(ctx, w, h, t, p, 'lobby', dpr);
    return;
  }
  const { painter } = cornerValley();
  const S = Math.max(40, Math.min(h / 2.25, w / 2.35));
  const L: Layout = {
    w, h, u: 1, portrait: false, cols: 3, rows: 2, S, bx: Math.min(S * 0.42, w * 0.12), by: (h - 2 * S) / 2 + S * 0.08, bw: 3 * S, bh: 2 * S,
    rim: Math.round(S * 0.16), name: ZERO, tip: ZERO, score: ZERO, road: ZERO, card: ZERO, title: { x: 0, y: 0, w: 0 },
  };
  STILL.t = t;
  painter.update(1 / 60, false);
  painter.draw(ctx, L, dpr, STILL);
}

const ZERO = { x: 0, y: 0, w: 0, h: 0 };
