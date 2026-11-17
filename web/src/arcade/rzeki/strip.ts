/**
 * The map column (round 11, DESIGN §13.14): every station of the chosen map, top to bottom, as a column of small
 * jewels of church glass beside the figure — lit (its glass in colour; thanked: a gold rim), the one the light is at
 * (larger, a gold ring that fills as its glass loads), waiting (its tracery and a breath of its colour) — and the
 * count over it ("6/17").  The founder (2026-11-17): *"Rzeki wody żywej z jakiegoś względu dalej nie mają
 * wszystkich czakr (łącznie ich tam jest 12)"* — a session walks only a few stations, so the whole map must be in
 * sight from the first second, the twelve of picture 2 among them.  Picture 2's twelve are round jewels; the other
 * five (picture 1's three channels, the Void, the sacrum, the hands, and the feet) are lozenges.
 *
 * Drawn in screen space (no camera), from small sprites baked once per size, tier and state: a frame draws a
 * hairline, a dozen or so small images, a ring and a count.  Shared by the play view and the lobby's picture.
 */
import { clamp } from '../kit/juice';
import { MAP, STATION, type Dir, type MapId, type StationId } from './content';
import type { Rect } from './layout';
import { GOLD, GOLD_HI, INK, PEARL, bakeRose, font, glow, layer, rgbaPrefix, rr, type Layer } from './paint';

const TAU = Math.PI * 2;

/** What the column shows. */
export interface StripState {
  map: MapId;
  /** a station's light this round: 0 waiting, 1 lit going down, 2 thanked going up (bits); or a lobby glow > 0 */
  litOf: (s: StationId) => number;
  /** its window's craft tier */
  tierOf: (s: StationId) => number;
  /** the station the light is at (null: none), its fill, and where the marker is on its way (a fractional index of the map's list) */
  current: StationId | null;
  fill: number;
  at: number | null;
  dir: Dir;
  /** the count over the column: the map's stations lit (this round, or ever in the lobby) */
  lit: number;
}

/** The column's geometry for a box and a map: the jewels' centres, their radius, the header's centre. */
export interface StripGeom { xs: number; ys: number[]; r: number; head: { x: number; y: number; px: number }; step: number }

/** Where each jewel of the map sits in the box (top to bottom), how big, and where the count goes. */
export function stripGeom(box: Rect, map: MapId, u = 1): StripGeom {
  const list = MAP[map].stations;
  const px = Math.max(13, Math.round(12.5 * u));
  const headH = Math.round(px * 1.5);
  const step = Math.max(6, (box.h - headH) / list.length);
  const r = Math.max(3, Math.min(step * 0.36, 7.5 * u, box.w * 0.24));
  const xs = box.x + box.w / 2;
  const y0 = box.y + headH;
  return { xs, ys: list.map((_, i) => y0 + (i + 0.5) * step), r, head: { x: xs, y: box.y + headH / 2, px }, step };
}

/** Picture 2's twelve are round jewels; the others (channels, Void, sacrum, hands, feet) are lozenges. */
export const roundJewel = (s: StationId): boolean => STATION[s].map12;

const sprites = new Map<string, Layer>();

/** A small jewel of a station's glass (lit) or its tracery (waiting), cut round or as a lozenge; baked once per size. */
function jewel(s: StationId, r: number, dpr: number, tier: number, lit: boolean): Layer | null {
  const R = Math.round(r * 4) / 4;
  const key = `${s}|${R}|${dpr}|${tier}|${lit ? 1 : 0}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  if (sprites.size > 400) sprites.clear();
  const half = Math.ceil(R * 1.5);
  const L = layer(half * 2, half * 2, dpr);
  const rose = bakeRose(s, R * 1.08, dpr, tier);
  if (!L || !rose) return null;
  const c = L.ctx, st = STATION[s];
  c.translate(half, half);
  const shape = (k: number) => {
    c.beginPath();
    if (roundJewel(s)) c.arc(0, 0, R * k, 0, TAU);
    else {
      const q = R * k * 1.12;
      c.moveTo(0, -q);
      c.lineTo(q, 0);
      c.lineTo(0, q);
      c.lineTo(-q, 0);
      c.closePath();
    }
  };
  c.save();
  shape(1);
  c.clip();
  c.fillStyle = lit ? st.deep : 'rgba(16,11,44,.9)';
  c.fillRect(-half, -half, 2 * half, 2 * half);
  c.globalAlpha = lit ? 1 : 0.9;
  c.drawImage(lit ? rose.glass : rose.lead, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
  if (!lit) {
    // a breath of the station's colour, so a waiting jewel still says which centre it is
    c.globalAlpha = 0.34;
    c.fillStyle = st.hue;
    c.fillRect(-half, -half, 2 * half, 2 * half);
  }
  c.restore();
  // the rim: the station's colour, brighter once lit
  shape(1);
  c.lineWidth = Math.max(0.8, R * 0.16);
  c.strokeStyle = `${rgbaPrefix(st.hue)}${lit ? '.95' : '.55'})`;
  c.stroke();
  sprites.set(key, L.c);
  return L.c;
}

const layers = new Map<string, { c: Layer; x: number; y: number; w: number; h: number }>();

/** The column's still part — its ground, its hairline, its count and every jewel but the current one — baked once per state. */
function stillLayer(box: Rect, st: StripState, g: StripGeom, u: number, dpr: number, curI: number, veil: boolean): { c: Layer; x: number; y: number; w: number; h: number } | null {
  const list = MAP[st.map].stations;
  const bits = list.map(s => `${st.litOf(s) & 3}${st.tierOf(s)}`).join('');
  const key = `${st.map}|${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.w)},${Math.round(box.h)}|${u}|${dpr}|${bits}|${st.lit}|${curI}|${veil ? 1 : 0}`;
  const hit = layers.get(key);
  if (hit) return hit;
  if (layers.size > 12) layers.clear();
  const { xs, ys, r } = g;
  const w = Math.max(box.w, r * 3.6) + 24, x = xs - w / 2, y = box.y - 4, h = box.h + 8;
  const L = layer(w, h, dpr);
  if (!L) return null;
  const ctx = L.ctx;
  ctx.translate(-x, -y);
  // a soft dark ground behind the column, never a hard box
  if (veil) {
    const top = ys[0] - g.step, bottom = ys[ys.length - 1] + g.step / 2;
    const vg = ctx.createLinearGradient(0, top - 10, 0, bottom + 10);
    vg.addColorStop(0, 'rgba(8,5,26,0)');
    vg.addColorStop(0.06, 'rgba(8,5,26,.62)');
    vg.addColorStop(0.94, 'rgba(8,5,26,.62)');
    vg.addColorStop(1, 'rgba(8,5,26,0)');
    ctx.fillStyle = vg;
    const vw = Math.max(box.w, r * 3.6);
    rr(ctx, xs - vw / 2, top - 10, vw, bottom - top + 20, vw / 2);
    ctx.fill();
  }
  // the hairline the jewels hang on
  ctx.strokeStyle = 'rgba(255,217,138,.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xs, ys[0]);
  ctx.lineTo(xs, ys[ys.length - 1]);
  ctx.stroke();
  // the count over the column
  ctx.font = font(g.head.px, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  const count = `${st.lit}/${list.length}`;
  ctx.strokeText(count, g.head.x, g.head.y);
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(count, g.head.x, g.head.y);
  // the jewels
  for (let i = 0; i < list.length; i++) {
    if (i === curI) continue;
    const s = list[i], b = st.litOf(s);
    const spr = jewel(s, r, dpr, st.tierOf(s), b > 0);
    if (b > 0) glow(ctx, STATION[s].hue, xs, ys[i], r * 2.4, 0.32);
    if (spr) {
      const half = spr.width / dpr / 2;
      ctx.drawImage(spr, xs - half, ys[i] - half, 2 * half, 2 * half);
    }
    if (b & 2) {
      ctx.strokeStyle = 'rgba(255,217,138,.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(xs, ys[i], r * 1.32, 0, TAU);
      ctx.stroke();
    }
  }
  const out = { c: L.c, x, y, w, h };
  layers.set(key, out);
  return out;
}

/**
 * Draw the column into its box: its still part from a baked layer, then where the light is (the current jewel, its
 * ring and its fill, gliding with the stream).  Returns its geometry (the mouse's names, the coach mark).
 */
export function drawStrip(ctx: CanvasRenderingContext2D, box: Rect, st: StripState, u: number, dpr: number, time: number,
  o: { veil?: boolean; still?: boolean } = {}): StripGeom {
  const list = MAP[st.map].stations;
  const g = stripGeom(box, st.map, u);
  const { xs, ys, r } = g;
  if (!list.length) return g;
  const curI = st.current ? list.indexOf(st.current) : -1;
  const still = stillLayer(box, st, g, u, dpr, curI, o.veil !== false);
  if (still) ctx.drawImage(still.c, still.x, still.y, still.w, still.h);
  // where the light is: the marker glides with the stream; the current jewel larger, a gold ring filling with its glass
  if (st.at !== null && Number.isFinite(st.at)) {
    const k = clamp(st.at, 0, list.length - 1);
    const i0 = Math.floor(k), f = k - i0;
    const y = ys[i0] + (ys[Math.min(list.length - 1, i0 + 1)] - ys[i0]) * f;
    const pulse = o.still ? 0.5 : 0.5 + 0.5 * Math.sin(time * 2.2);
    const R = r * 1.5;
    glow(ctx, GOLD, xs, y, R * 2.8, 0.3 + 0.2 * pulse);
    if (curI >= 0 && f < 0.02) {
      const s = list[curI];
      const spr = jewel(s, R, dpr, st.tierOf(s), st.fill >= 1 || st.litOf(s) > 0);
      if (spr) {
        const half = spr.width / dpr / 2;
        ctx.drawImage(spr, xs - half, y - half, 2 * half, 2 * half);
      }
      // the station's glass so far: a gold arc around it
      if (st.fill > 0.005 && st.fill < 1) {
        ctx.strokeStyle = 'rgba(255,231,170,.95)';
        ctx.lineWidth = Math.max(1.5, R * 0.22);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(xs, y, R * 1.42, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(st.fill));
        ctx.stroke();
      }
    }
    ctx.strokeStyle = `rgba(255,217,138,${(0.55 + 0.35 * pulse).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(xs, y, R * 1.42, 0, TAU);
    ctx.stroke();
    // a small pointer toward the figure
    const px = xs + R * 1.42 + 3, ps = Math.max(3, R * 0.5);
    ctx.fillStyle = GOLD_HI;
    ctx.beginPath();
    ctx.moveTo(px + ps, y);
    ctx.lineTo(px, y - ps * 0.8);
    ctx.lineTo(px, y + ps * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  return g;
}

/** The jewel under a point (a desktop's mouse), or null. */
export function stripHit(g: StripGeom, map: MapId, x: number, y: number): StationId | null {
  const list = MAP[map].stations;
  if (Math.abs(x - g.xs) > Math.max(g.r * 2, 14)) return null;
  for (let i = 0; i < list.length; i++) if (Math.abs(y - g.ys[i]) <= g.step / 2) return list[i];
  return null;
}

/** A station's name beside its jewel (the desktop's hover): a small dark pill to the right of the column. */
export function drawStripName(ctx: CanvasRenderingContext2D, g: StripGeom, map: MapId, s: StationId, text: string, px: number): void {
  const i = MAP[map].stations.indexOf(s);
  if (i < 0) return;
  ctx.font = font(px, 700);
  const w = ctx.measureText(text).width + 16, h = Math.round(px * 1.7);
  const x = g.xs + g.r * 2.2 + 6, y = g.ys[i] - h / 2;
  ctx.fillStyle = 'rgba(14,10,38,.92)';
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = `${rgbaPrefix(STATION[s].hue)}.8)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PEARL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 8, g.ys[i]);
}
