/**
 * The head seen from above, and a square centimetre of the scalp close up (DESIGN.md §15):
 *
 *   wir         the strands rise around the crown's whorl, from its middle outward, in a clockwise spiral
 *   strumienie  the hair is whole; streams of light run from the whorl forward over the forehead, sideways over
 *               the temples and down the nape
 *   jednostki   the skin close up: follicular units of 1–4 hairs open one by one (about 2 hairs a unit)
 *
 * Strands are many, so the ones already grown are kept in a layer that grows as they come (`StrandLayer`); a frame
 * draws that layer and the few still growing.
 */
import { clamp, ease } from '../kit/juice';
import { COLOUR, type HairColour } from './content';
import { ABOVE, WHORL, flow, hash, streams, strandPath, strands, units, type Pt, type Rect, type Strand, type Unit } from './geo';
import { GOLD, GOLD_HI, PEARL, TAU, glow, layer, mix, polyAt, polyLen, rgba, smoothPath, type Layer } from './paint';
import type { Cam, WorldState } from './world';

// ── the still head from above ────────────────────────────────────
/** The head from above, still: its shadow and the shoulders below it, the scalp, the ears, the tip of the nose. */
export function bakeAbove(ctx: CanvasRenderingContext2D): void {
  // the shoulders, far below, in the dark
  ctx.beginPath();
  ctx.ellipse(0, 50, 96, 30, 0, 0, TAU);
  const sh = ctx.createRadialGradient(0, 50, 10, 0, 50, 96);
  sh.addColorStop(0, 'rgba(120,80,140,.22)');
  sh.addColorStop(0.7, 'rgba(70,40,90,.14)');
  sh.addColorStop(1, 'rgba(40,20,60,0)');
  ctx.fillStyle = sh;
  ctx.fill();
  glow(ctx, '#ffb59a', ABOVE.cx, ABOVE.cy, 70, 0.12);
  // the ears and the tip of the nose, under the head's edge
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * (ABOVE.rx + 1.5), 6, 3.6, 8.5, 0, 0, TAU);
    ctx.fillStyle = 'rgba(232,150,140,.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,206,.45)';
    ctx.lineWidth = 0.45;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, ABOVE.cy - ABOVE.ry - 1.5, 4.2, 4, 0, 0, TAU);
  ctx.fillStyle = 'rgba(236,160,148,.6)';
  ctx.fill();
  // the scalp: warm skin, lit from above (the crown brightest), darker at its edges
  ctx.beginPath();
  ctx.ellipse(ABOVE.cx, ABOVE.cy, ABOVE.rx, ABOVE.ry, 0, 0, TAU);
  const g = ctx.createRadialGradient(WHORL[0] - 6, WHORL[1] - 14, 4, ABOVE.cx, ABOVE.cy, ABOVE.ry * 1.05);
  g.addColorStop(0, '#f6c8b4');
  g.addColorStop(0.55, '#d9958f');
  g.addColorStop(1, '#8f5a78');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,206,.55)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // the forehead's skin in front of the hairline, a little brighter
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ABOVE.cx, ABOVE.cy, ABOVE.rx, ABOVE.ry, 0, 0, TAU);
  ctx.clip();
  glow(ctx, '#ffe2d0', 0, ABOVE.cy - ABOVE.ry + 4, 22, 0.25);
  ctx.restore();
}

// ── the strands ──────────────────────────────────────────────────
/** How many strands a head from above shows on this screen (more on a big one). */
export const strandCount = (px: number): number => Math.round(Math.min(1500, Math.max(650, px * 170)));

let strandList: { n: number; list: Strand[] } | null = null;
export function strandsFor(n: number): Strand[] {
  if (strandList?.n !== n) strandList = { n, list: strands(n) };
  return strandList.list;
}

/** A strand's width on the screen: about a hair's share of the head, never thinner than a pixel, never a rope. */
const strandW = (px: number): number => clamp(0.32 * px, 0.75, 1.7) / px;

function strandStroke(ctx: CanvasRenderingContext2D, s: Strand, len: number, c: { strand: string; sheen: string }, px: number, pass: 0 | 1): void {
  if (pass === 1 && s.tone < 0.45) return;
  const pts = strandPath(s, s.len * len, 5);
  const p = new Path2D();
  smoothPath(p, pts);
  if (pass === 0) {
    ctx.strokeStyle = rgba(mix(c.strand, c.sheen, 0.06 + 0.3 * s.tone), 0.9);
    ctx.lineWidth = strandW(px);
  } else {
    // light from above: the sheen is brightest over the crown and fades toward the edges
    const r = Math.hypot((s.x - ABOVE.cx) / ABOVE.rx, (s.y - ABOVE.cy + 6) / ABOVE.ry);
    ctx.strokeStyle = rgba(c.sheen, (0.22 + 0.4 * (s.tone - 0.45)) * (1.1 - 0.6 * Math.min(1, r)));
    ctx.lineWidth = strandW(px) * 0.5;
  }
  ctx.stroke(p);
}

/**
 * The strands already grown, kept in a layer at the picture's size under the camera that drew them: new strands are
 * added as they come; a step back (a scene again) starts it over.
 */
export class StrandLayer {
  private key = '';
  private c: Layer | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private n = 0;
  private box: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private cam: Cam = { cx: 0, cy: 0, s: 1 };

  /** The layer with the first `n` strands (of `list`) whole, for this box, camera and colour. */
  ensure(list: readonly Strand[], n: number, box: Rect, cam: Cam, dpr: number, colour: HairColour): void {
    const key = `${Math.round(box.w)}x${Math.round(box.h)}@${dpr}|${cam.cx.toFixed(2)},${cam.cy.toFixed(2)},${cam.s.toFixed(4)}|${colour}|${list.length}`;
    if (key !== this.key || n < this.n || !this.c) {
      this.key = key;
      this.box = { ...box };
      this.cam = { ...cam };
      const L = layer(box.w, box.h, dpr);
      this.c = L?.c ?? null;
      this.ctx = L?.ctx ?? null;
      this.n = 0;
      if (this.ctx) this.ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (box.w / 2 - cam.cx * cam.s), dpr * (box.h / 2 - cam.cy * cam.s));
    }
    const ctx = this.ctx;
    if (!ctx || n <= this.n) return;
    const c = COLOUR[colour];
    ctx.lineCap = 'round';
    for (const pass of [0, 1] as const) for (let i = this.n; i < n; i++) strandStroke(ctx, list[i], 1, c, cam.s, pass);
    this.n = n;
  }

  /** Draw the layer in world units (the context holds the camera's transform). */
  draw(ctx: CanvasRenderingContext2D, alpha = 1): void {
    if (!this.c || this.n === 0) return;
    const s = this.cam.s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.c, this.cam.cx - this.box.w / 2 / s, this.cam.cy - this.box.h / 2 / s, this.box.w / s, this.box.h / s);
    ctx.globalAlpha = 1;
  }

  get count(): number { return this.n; }
}

/** The strands that show at a growth: from the whorl outward; the last few still growing (their share of length). */
export function strandsShown(total: number, g: number): { whole: number; growing: { i: number; len: number }[] } {
  const span = 0.06;
  const whole = Math.max(0, Math.min(total, Math.floor(((g - span) / (1 - span)) * total)));
  const growing: { i: number; len: number }[] = [];
  for (let i = whole; i < total; i++) {
    const at = (i / total) * (1 - span);
    const len = clamp((g - at) / span);
    if (len <= 0) break;
    growing.push({ i, len });
  }
  return { whole, growing };
}

const streamCache: { list: Pt[][]; lens: number[] } = { list: [], lens: [] };
function streamLines(): { list: Pt[][]; lens: number[] } {
  if (!streamCache.list.length) {
    streamCache.list = streams();
    streamCache.lens = streamCache.list.map(polyLen);
  }
  return streamCache;
}

/** The head from above: the strands (from the layer and growing), the whorl's light, the streams of light. */
export function drawAbove(ctx: CanvasRenderingContext2D, st: WorldState, cache: StrandLayer, box: Rect, cam: Cam, dpr: number): void {
  const list = strandsFor(strandCount(cam.s));
  const c = COLOUR[st.colour];
  const whorlGrow = st.scene === 'wir';
  const g = whorlGrow ? st.g : 1;
  const shown = strandsShown(list.length, g);
  // the hair's body under its strands, deepening as it fills (the scalp shows through where it has not grown)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ABOVE.cx, ABOVE.cy + 1, ABOVE.rx + 2, ABOVE.ry + 1.5, 0, 0, TAU);
  ctx.clip();
  const cr = ctx.createRadialGradient(WHORL[0], WHORL[1], 2, WHORL[0], WHORL[1], 30 + 40 * g);
  cr.addColorStop(0, rgba(c.strand, 0.62 * g));
  cr.addColorStop(0.8, rgba(c.strand, 0.5 * g));
  cr.addColorStop(1, rgba(c.strand, 0));
  ctx.fillStyle = cr;
  ctx.fillRect(ABOVE.cx - 50, ABOVE.cy - 60, 100, 120);
  ctx.restore();
  cache.ensure(list, shown.whole, box, cam, dpr, st.colour);
  cache.draw(ctx);
  ctx.lineCap = 'round';
  for (const pass of [0, 1] as const) for (const s of shown.growing) strandStroke(ctx, list[s.i], s.len, c, cam.s, pass);
  // the whorl: a turning spiral of light at the crown, gold while the picture grows
  const spin = st.reduced ? 0 : st.time * (st.growing ? 0.5 : 0.18);
  const wk = whorlGrow ? 0.35 + 0.65 * st.g : 0.5;
  glow(ctx, st.growing ? GOLD : '#ffd6b0', WHORL[0], WHORL[1], 9 + 3 * st.light, 0.35 * wk + 0.15 * st.deep);
  ctx.strokeStyle = rgba(GOLD_HI, 0.5 * wk);
  ctx.lineWidth = Math.max(0.35, 1.2 / cam.s);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let j = 0; j <= 24; j++) {
      const a = spin + (k * TAU) / 3 + j * 0.16;
      const r = 1 + j * 0.28;
      const x = WHORL[0] + Math.cos(a) * r, y = WHORL[1] + Math.sin(a) * r;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (st.scene === 'strumienie') drawStreams(ctx, st);
  // rest: a sheen passes over the hair with the breath
  if (st.deep > 0.02) glow(ctx, c.sheen, WHORL[0] - 4, WHORL[1] - 10, 40, 0.12 * st.deep * (0.6 + 0.4 * st.breath));
}

/** The streams of light from the whorl: each one runs out in turn, light flowing along it, an arrow at its end. */
function drawStreams(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const { list, lens } = streamLines();
  const op = ctx.globalCompositeOperation;
  ctx.lineCap = 'round';
  list.forEach((pts, i) => {
    const k = ease.inOutSine(clamp((st.g - i * 0.12) / 0.4));
    if (k <= 0.001) return;
    const p = new Path2D();
    smoothPath(p, pts);
    const L = lens[i] * 1.05;
    ctx.setLineDash([L * k, L * 2]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(GOLD, 0.2);
    ctx.lineWidth = 3.2;
    ctx.stroke(p);
    ctx.strokeStyle = rgba(GOLD_HI, 0.75);
    ctx.lineWidth = 0.7;
    ctx.stroke(p);
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = op;
    for (let j = 0; j < 3; j++) {
      const q = ((st.time * 0.22 + j / 3 + i * 0.13) % 1) * k;
      const [x, y] = polyAt(pts, q);
      glow(ctx, GOLD_HI, x, y, 2.4, 0.7);
    }
    if (k > 0.97) {
      // an arrowhead along the stream at its end
      const [x1, y1] = polyAt(pts, 1);
      const [x0, y0] = polyAt(pts, 0.93);
      const a = Math.atan2(y1 - y0, x1 - x0);
      ctx.strokeStyle = rgba(GOLD_HI, 0.85);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x1 + Math.cos(a + 2.5) * 2.6, y1 + Math.sin(a + 2.5) * 2.6);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(a - 2.5) * 2.6, y1 + Math.sin(a - 2.5) * 2.6);
      ctx.stroke();
    }
  });
}

// ── a square centimetre close up ─────────────────────────────────
let unitList: Unit[] | null = null;
export const unitsAll = (): Unit[] => (unitList ??= units());

/** The skin close up, still: warm skin lit from above with its fine furrows and pores, the frame of one square centimetre. */
export function bakeSkin(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(44, 38, 4, 50, 50, 86);
  g.addColorStop(0, '#e7aa9a');
  g.addColorStop(0.55, '#c4808a');
  g.addColorStop(1, '#7a4466');
  ctx.fillStyle = g;
  ctx.fillRect(-60, -60, 220, 220);
  glow(ctx, '#ffe6d8', 42, 34, 46, 0.18);
  // the skin's furrows: a fine net, each with a light edge beside its shadow
  for (let i = 0; i < 220; i++) {
    const x = -20 + hash(i * 3 + 1) * 140, y = -20 + hash(i * 5 + 2) * 140;
    const a = hash(i * 7 + 3) * Math.PI, l = 5 + 9 * hash(i * 11 + 4);
    const p = new Path2D();
    p.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
    p.quadraticCurveTo(x + 1.2 * hash(i), y - 1.2 * hash(i + 1), x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
    ctx.strokeStyle = 'rgba(96,40,64,.22)';
    ctx.lineWidth = 0.32;
    ctx.stroke(p);
    ctx.save();
    ctx.translate(0.25, 0.3);
    ctx.strokeStyle = 'rgba(255,232,222,.12)';
    ctx.lineWidth = 0.25;
    ctx.stroke(p);
    ctx.restore();
  }
  // sweat pores, tiny
  ctx.fillStyle = 'rgba(100,40,64,.28)';
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.arc(hash(i * 13 + 5) * 100, hash(i * 17 + 6) * 100, 0.42, 0, TAU);
    ctx.fill();
  }
  // the frame of one square centimetre
  ctx.strokeStyle = 'rgba(255,240,226,.38)';
  ctx.lineWidth = 0.35;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(4, 4, 92, 92);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,240,226,.85)';
  ctx.lineWidth = 0.6;
  for (const [x, y, dx, dy] of [[4, 4, 1, 1], [96, 4, -1, 1], [4, 96, 1, -1], [96, 96, -1, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx * 7, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 7);
    ctx.stroke();
  }
}

/** The units that show at a growth (in their order, from the middle out), the newest still opening. */
export const unitsShown = (g: number): number => clamp(g) * unitsAll().length;

/** The skin close up: each follicular unit opens and its 1–4 hairs come out along the stream, fine and curving. */
export function drawSkin(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const list = unitsAll();
  const c = COLOUR[st.colour];
  const k = unitsShown(st.g);
  ctx.lineCap = 'round';
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    const open = clamp(k - i);
    if (open <= 0) break;
    // the opening: a small dimple, a darker crescent with light on its far edge
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.rotate(u.ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, 1 + 0.32 * u.n, 0.72 + 0.16 * u.n, 0, 0, TAU);
    ctx.fillStyle = `rgba(96,34,58,${(0.42 * open).toFixed(3)})`;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 1 + 0.32 * u.n, 0.72 + 0.16 * u.n, 0, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = `rgba(255,226,214,${(0.4 * open).toFixed(3)})`;
    ctx.lineWidth = 0.22;
    ctx.stroke();
    ctx.restore();
    if (open < 1) glow(ctx, GOLD_HI, u.x, u.y, 7, 0.55 * (1 - open) + 0.15);
    // the hairs: fine, curving along the stream, a little fanned, thicker at the root
    for (let h = 0; h < u.n; h++) {
      const spread = (h - (u.n - 1) / 2) * 0.2 + 0.08 * (hash(i * 7 + h) - 0.5);
      const a = u.ang + spread;
      const len = (11 + 6 * hash(i * 5 + h)) * ease.outCubic(open);
      const bend = 0.25 * (hash(i * 3 + h) - 0.35);
      const x0 = u.x + Math.cos(a) * 0.5, y0 = u.y + Math.sin(a) * 0.5;
      const mx = x0 + Math.cos(a) * len * 0.55, my = y0 + Math.sin(a) * len * 0.55;
      const x1 = x0 + Math.cos(a + bend) * len, y1 = y0 + Math.sin(a + bend) * len;
      const p = new Path2D();
      p.moveTo(x0, y0);
      p.quadraticCurveTo(mx, my, x1, y1);
      ctx.strokeStyle = rgba(mix(c.strand, c.sheen, 0.12), 0.95);
      ctx.lineWidth = 0.62;
      ctx.stroke(p);
      const q = new Path2D();
      q.moveTo(x0, y0);
      q.quadraticCurveTo((x0 + mx) / 2, (y0 + my) / 2, mx, my);
      ctx.lineWidth = 0.85;
      ctx.stroke(q);
      ctx.save();
      ctx.translate(0.18, -0.18);
      ctx.strokeStyle = rgba(c.sheen, 0.45 + 0.2 * st.deep);
      ctx.lineWidth = 0.2;
      ctx.stroke(p);
      ctx.restore();
    }
  }
  // the first unit is the one the label names: a soft ring around it
  if (k > 0.5) {
    const u = list[0];
    ctx.strokeStyle = rgba(PEARL, 0.6);
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 6.5, 0, TAU);
    ctx.stroke();
  }
  // the stream's direction, faint, across the patch
  const [fx, fy] = flow(14, 4);
  glow(ctx, GOLD, 50 + fx * 30, 50 + fy * 30, 10, 0.08 + 0.12 * st.light * (st.growing ? 1 : 0.4));
}
