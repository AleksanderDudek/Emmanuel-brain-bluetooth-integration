/**
 * The lobby's hero picture and the card art: the calm person in profile in the night, the twelve wheels turning true
 * in their seven colours, the egg of the full field glowing round them.  No names; with the player's progress, the
 * figure keeps the posture they chose and the field is white-gold once they reached a full field.  The figure and the
 * night are baked once per size; the wheels turn every frame.
 */
import { spline } from '../kit/figure';
import { CENTRES, HUE, WHEELS } from './content';
import { SPINE, armOutline, bodyOutline, eggOf, frameBox, wheelGeom } from './figure';
import type { KolaProgress, Posture } from './meta';
import { NIGHT, PEARL, TAU, centreSprites, hash, makeCanvas, rgba, sharedSprites, type Canvas2D } from './paint';
import type { Fault } from './sim';
import { SPIN, drawWheel, type WheelLook } from './wheel';

/** The baked night, field and figure per size (a few: the lobby's hero and the cards). */
const baked = new Map<string, Canvas2D | null>();

/** A true wheel's fault (all qualities right): even petals, the calm turn. */
const TRUE_FAULT = (n: number, ph: number): Fault => ({
  wobble: 0, wobblePhase: 0, spin: 1, petalLen: Array.from({ length: n }, () => 1), petalLit: Array.from({ length: n }, () => 1), dull: 0, size: 1, phase: ph,
});
const FAULTS = WHEELS.map((w, i) => TRUE_FAULT({ root: 4, sacral: 6, plexus: 10, heart: 12, throat: 16, brow: 8, crown: 20 }[w.centre], i * 0.7));

/** The fit of the whole figure with its field into a box of w × h: its scale and origin. */
function fitOf(w: number, h: number, posture: Posture): { s: number; ox: number; oy: number } {
  const b = frameBox('whole', posture);
  const s = Math.min(w / (b.x1 - b.x0), (h * 0.94) / (b.y1 - b.y0));
  return { s, ox: w / 2 - ((b.x0 + b.x1) / 2) * s, oy: h / 2 - ((b.y0 + b.y1) / 2) * s };
}

function bake(w: number, h: number, posture: Posture, whole: boolean, k: number): Canvas2D | null {
  const key = `${Math.round(w)}x${Math.round(h)}|${posture}|${whole}|${k}`;
  if (baked.has(key)) return baked.get(key) ?? null;
  if (baked.size > 4) baked.clear();
  const c = makeCanvas(w * k, h * k), g = c?.getContext('2d');
  if (!c || !g) { baked.set(key, null); return null; }
  g.scale(k, k);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, NIGHT[0]);
  sky.addColorStop(0.55, NIGHT[1]);
  sky.addColorStop(1, NIGHT[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const n = Math.round((w * h) / 3600);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(230,226,255,${(0.1 + 0.35 * hash(i * 13 + 7)).toFixed(3)})`;
    g.beginPath();
    g.arc(hash(i * 3 + 1) * w, hash(i * 7 + 2) * h, 0.4 + hash(i * 11 + 5) * 0.8, 0, TAU);
    g.fill();
  }
  const { s, ox, oy } = fitOf(w, h, posture);
  const map = (x: number, y: number): [number, number] => [ox + x * s, oy + y * s];
  // the field: the seven layers (or the white-gold), round the figure
  const e = eggOf(posture);
  g.save();
  g.translate(ox + e.cx * s, oy + e.cy * s);
  g.scale(1, e.ry / e.rx);
  g.globalCompositeOperation = 'lighter';
  const R = e.rx * s;
  if (whole) {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, 'rgba(255,248,230,0.22)');
    gr.addColorStop(0.8, 'rgba(255,226,160,0.2)');
    gr.addColorStop(0.95, 'rgba(255,240,210,0.42)');
    gr.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
  }
  CENTRES.forEach((cid, i) => {
    const a = 0.42 + (0.58 * i) / 7, b = 0.42 + (0.58 * (i + 1)) / 7;
    const gr = g.createRadialGradient(0, 0, Math.max(0, (a - 0.07) * R), 0, 0, (b + 0.05) * R);
    const k = whole ? 0.16 : 0.24;
    gr.addColorStop(0, rgba(HUE[cid].hue, 0));
    gr.addColorStop(0.5, rgba(HUE[cid].hue, k));
    gr.addColorStop(1, rgba(HUE[cid].hue, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, (b + 0.05) * R, 0, TAU);
    g.fill();
  });
  g.restore();
  // the figure of light
  const body = new Path2D();
  spline(body, bodyOutline(posture), map, true);
  g.save();
  g.shadowColor = 'rgba(170,160,255,0.5)';
  g.shadowBlur = Math.max(6, s * 0.03);
  g.fillStyle = 'rgba(170,166,250,0.16)';
  g.fill(body);
  g.restore();
  g.strokeStyle = rgba(PEARL, 0.6);
  g.lineWidth = Math.max(1, s * 0.0035);
  g.stroke(body);
  const arm = new Path2D();
  spline(arm, armOutline(posture), map, true);
  g.strokeStyle = rgba(PEARL, 0.28);
  g.stroke(arm);
  const spine = new Path2D();
  spline(spine, SPINE, map, false);
  g.strokeStyle = 'rgba(240,236,255,0.36)';
  g.lineWidth = Math.max(1, s * 0.003);
  g.stroke(spine);
  baked.set(key, c);
  return c;
}

/** The picture at a moment `t` (s): the wheels turning true; `whole` the white-gold field. */
export function drawPicture(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, o: { posture?: Posture; whole?: boolean; still?: boolean } = {}): void {
  const posture = o.posture ?? 'stand';
  const tr = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const k = Math.max(1, Math.min(2, Math.round((tr?.a ?? 1) * 2) / 2));
  const c = bake(w, h, posture, !!o.whole, k);
  if (c) ctx.drawImage(c, 0, 0, w, h);
  else {
    ctx.fillStyle = NIGHT[1];
    ctx.fillRect(0, 0, w, h);
  }
  const { s, ox, oy } = fitOf(w, h, posture);
  const sp = centreSprites(), white = sharedSprites().white;
  const time = o.still ? 0 : t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const order = [...WHEELS.filter(x => x.side === 'back'), ...WHEELS.filter(x => x.side !== 'back')];
  for (const wh of order) {
    const i = WHEELS.indexOf(wh);
    const g = wheelGeom(wh.id, posture);
    const look: WheelLook = {
      centre: wh.centre, axis: 1, turn: 1, petals: 1, colour: 1, size: 1, inner: 1, deep: 0.6, rays: 0, halo: 0,
      fault: FAULTS[i], phi: FAULTS[i].phase + time * SPIN, time: time + i, lift: 0.2, lit: FAULTS[i].petalLen.length,
      gold: 0, flash: 0, dim: wh.side === 'back' ? 0.6 : 0, calm: 0, reduced: !!o.still,
    };
    drawWheel(ctx, { tx: ox + g.tip[0] * s, ty: oy + g.tip[1] * s, ax: g.ax, ay: g.ay, len: g.len * s, r: g.r * s }, look, sp[wh.centre], white);
  }
  ctx.restore();
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: KolaProgress): void {
  drawPicture(ctx, w, h, t, { posture: p?.posture ?? 'stand', whole: !!p && p.fields > 0 });
}
