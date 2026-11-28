/**
 * One wheel of light (DESIGN.md §28): a funnel whose fine tip sits on the spine and whose mouth is a rotating disc of
 * petals — a vortex seen a little from the side.  How true it is shapes it: out of true it wobbles off its axis, turns
 * too fast, too slowly or the wrong way and stutters, its petals are uneven and dim, its colour is a grey of its own
 * hue, its mouth pinched small or frayed wide; true, it turns calmly and evenly clockwise (as seen from outside: on the
 * screen too, with its outer face turned a little toward the viewer), its petals even, its colour clear and bright, its
 * mouth a healthy size.  Round 2 unfolds an inner ring and deepens the colour; round 3 lights a corona of rays and a
 * halo.  Pure drawing on the paint box's baked sprites (the cone) and a few paths a frame (the petals).
 */
import { HUE, type CentreId } from './content';
import { CONE_H, CONE_W, GOLD, TAU, mixHex, rgba, type CentreSprites, type Canvas2D } from './paint';
import type { Fault } from './sim';

/** How the eye sees a disc of petals: its width across the axis (the axis' share), a little turned toward the viewer. */
export const SQUASH = 0.48;
/** A true wheel's calm turn (rad/s): about one turn in seven seconds. */
export const SPIN = 0.9;

export interface WheelLook {
  centre: CentreId;
  /** each quality's trueness 0..1 */
  axis: number;
  turn: number;
  petals: number;
  colour: number;
  size: number;
  inner: number;
  deep: number;
  rays: number;
  halo: number;
  fault: Fault;
  /** the disc's angle now (rad), and the wheel's own clock (s) for the wobble and the stutter */
  phi: number;
  time: number;
  /** extra light: the wheel the work is at, the prayer's place, the field (0..1) */
  lift: number;
  /** petals of the outer ring lit by focus (the score), of the inner ring, of the rays */
  lit: number;
  /** the gold of focus loading it now (0..1), a flash when it turns true or its pair balances (0..1) */
  gold: number;
  flash: number;
  /** behind the body: softly dimmed (0..1) */
  dim: number;
  /** calm deepens the colour in the rest (0..1) */
  calm: number;
  reduced: boolean;
}

/** A wheel's funnel on the screen: the tip, the unit axis, the length to the mouth and the mouth's radius (px). */
export interface ScreenGeom { tx: number; ty: number; ax: number; ay: number; len: number; r: number }

const e = (x: number): number => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** The turn's speed now (rad/s) for its trueness: from its fault (backward, sluggish, racing) to the calm turn, stuttering out of true. */
export function spinOf(fault: Fault, turn: number, time: number, reduced: boolean): number {
  const k = e(turn);
  const base = lerp(fault.spin, 1, k) * SPIN;
  const stutter = (1 - k) * 0.55 * SPIN * Math.sin(time * 4.3 + fault.phase * 3) * (fault.spin > 1.5 ? 1.6 : 1);
  return (base + stutter) * (reduced ? 0.12 : 1);
}

/** The wheel's colour now: grey of its hue → its clear hue → (round 2) its jewel; calm deepens it a little. */
export function colourOf(L: Pick<WheelLook, 'centre' | 'colour' | 'deep' | 'calm'>): string {
  const h = HUE[L.centre];
  const c = mixHex(h.dull, h.hue, e(L.colour));
  return mixHex(c, h.deep, Math.min(0.75, 0.5 * e(L.deep) + 0.25 * L.calm));
}

/** Draw the wheel: its cone, its vortex lines and its disc of petals (additive: call inside 'lighter'). */
export function drawWheel(ctx: CanvasRenderingContext2D, g: ScreenGeom, L: WheelLook, S: CentreSprites, white: Canvas2D | null): void {
  const f = L.fault;
  const h = HUE[L.centre];
  const t = L.time;
  const red = L.reduced ? 0.25 : 1;
  const wob = f.wobble * (1 - e(L.axis)) * red;
  const clear = e(L.colour);
  const bright = (0.42 + 0.58 * clear) * (1 - 0.38 * L.dim) * (1 + 0.4 * L.lift + 0.2 * L.calm);
  const sizeK = lerp(f.size, 1, e(L.size));
  const fray = f.size > 1 ? (1 - e(L.size)) : 0;
  const pulse = L.reduced ? 1 + 0.035 * Math.sin(t * 1.6 + f.phase) : 1;
  const r = Math.max(2, g.r * sizeK * pulse);
  // the axis wobbles off its line and the mouth sways across it
  const th0 = Math.atan2(g.ay, g.ax);
  const th = th0 + wob * 0.22 * Math.sin(t * 1.7 + f.wobblePhase);
  const ux = Math.cos(th), uy = Math.sin(th), vx = -uy, vy = ux;
  const off = wob * 0.2 * g.r * Math.sin(t * 2.3 + f.wobblePhase * 1.3);
  const mx = g.tx + ux * g.len + vx * off, my = g.ty + uy * g.len + vy * off;
  const k = SQUASH * (1 + 0.32 * wob * Math.sin(t * 1.3 + f.wobblePhase * 1.7));
  const col = colourOf(L);
  const lite = mixHex(col, h.core, 0.45);

  // the cone, from the tip to the mouth (dull and clear sprites blended by the colour's clearing)
  const cl = Math.hypot(mx - g.tx, my - g.ty);
  ctx.save();
  ctx.translate(g.tx, g.ty);
  ctx.rotate(Math.atan2(my - g.ty, mx - g.tx));
  ctx.scale(cl / CONE_W, (r * 1.02) / (CONE_H / 2));
  const was = ctx.globalAlpha;
  if (S.coneDull && clear < 0.99) { ctx.globalAlpha = was * Math.min(1, bright * (1 - clear) * 0.95); ctx.drawImage(S.coneDull, 0, -CONE_H / 2); }
  if (S.cone && clear > 0.01) { ctx.globalAlpha = was * Math.min(1, bright * clear * 0.95); ctx.drawImage(S.cone, 0, -CONE_H / 2); }
  ctx.globalAlpha = was;
  ctx.restore();

  // the vortex: four lines from the tip to the rim, turning with the disc
  ctx.lineWidth = Math.max(1, r * 0.035);
  for (let j = 0; j < 4; j++) {
    const a = L.phi + (j * TAU) / 4;
    const ca = Math.cos(a), sa = Math.sin(a);
    const px = mx + ux * (k * r * ca) + vx * (r * sa), py = my + uy * (k * r * ca) + vy * (r * sa);
    const tw = Math.sin(a + 0.9) * r * 0.45;
    const cx = g.tx + ux * cl * 0.62 + vx * tw, cy = g.ty + uy * cl * 0.62 + vy * tw;
    ctx.strokeStyle = rgba(lite, 0.22 * bright * (0.45 + 0.55 * (0.5 + 0.5 * ca)));
    ctx.beginPath();
    ctx.moveTo(g.tx, g.ty);
    ctx.quadraticCurveTo(cx, cy, px, py);
    ctx.stroke();
  }

  // the disc, seen a little from the side: its frame along the axis, squashed, turning
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(th);
  ctx.scale(k, 1);
  if (S.glow) {
    ctx.globalAlpha = was * Math.min(1, 0.55 * bright);
    ctx.drawImage(clear > 0.5 && L.deep > 0.3 && S.deep ? S.deep : S.glow, -r * 1.35, -r * 1.35, r * 2.7, r * 2.7);
    ctx.globalAlpha = was;
  }
  ctx.rotate(L.phi);
  const P = f.petalLen.length;
  const even = e(L.petals);
  const step = TAU / P;
  const halfW = Math.min(0.36 * r, ((TAU * r * 0.62) / P) * 0.62);
  for (let i = 0; i < P; i++) {
    const a = i * step;
    let len = lerp(f.petalLen[i], 1, even);
    if (fray > 0) len *= 1 + 0.22 * fray * Math.sin(t * 6.1 + i * 1.7) * red;
    const lit = lerp(f.petalLit[i], 1, even);
    const rIn = 0.26 * r, rOut = Math.max(rIn + 2, r * 0.98 * len);
    const on = i < L.lit;
    const alpha = Math.min(1, bright * (0.22 + 0.5 * lit) * (on ? 1.25 : 0.85));
    petal(ctx, a, rIn, rOut, halfW * (0.75 + 0.25 * len), on ? mixHex(col, h.core, 0.28) : col, alpha);
    if (on) {
      ctx.strokeStyle = rgba(h.core, 0.5 * bright);
      ctx.lineWidth = Math.max(0.8, r * 0.02);
      ctx.stroke();
    }
  }
  // round 2: the inner ring unfolds, between the outer petals
  const inner = e(L.inner);
  if (inner > 0.01) {
    for (let i = 0; i < P; i++) {
      const a = i * step + step / 2;
      petal(ctx, a, 0.14 * r, r * (0.3 + 0.32 * inner), halfW * 0.62, mixHex(h.core, h.deep, 0.35), Math.min(1, bright * 0.75 * inner));
    }
  }
  // round 3: a corona of fine rays and a halo
  const rays = e(L.rays);
  if (rays > 0.01) {
    ctx.strokeStyle = rgba(lite, Math.min(1, 0.65 * rays * bright));
    ctx.lineWidth = Math.max(0.8, r * 0.025);
    ctx.beginPath();
    for (let i = 0; i < 2 * P; i++) {
      const a = (i * step) / 2 + step / 4;
      const r1 = r * (1.04 + 0.04 * (i % 2)), r2 = r * (1.16 + 0.28 * rays * (i % 2 ? 0.7 : 1));
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    }
    ctx.stroke();
  }
  const halo = e(L.halo);
  if (halo > 0.01) {
    ctx.strokeStyle = rgba(h.core, Math.min(1, 0.32 * halo * bright));
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, 0, TAU);
    ctx.stroke();
  }
  // the heart of the disc
  if (white) {
    const cr = r * (0.34 + 0.12 * inner);
    ctx.globalAlpha = was * Math.min(1, bright * (0.35 + 0.5 * clear));
    ctx.drawImage(white, -cr, -cr, 2 * cr, 2 * cr);
    ctx.globalAlpha = was;
  }
  // gold: focus is bringing this wheel true now
  if (L.gold > 0.01) {
    ctx.strokeStyle = rgba(GOLD, L.gold * (0.5 + 0.2 * Math.sin(t * 4)));
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.16, 0, TAU);
    ctx.stroke();
  }
  // a flash: it turned true, or its pair came into balance
  if (L.flash > 0.01) {
    ctx.strokeStyle = rgba('#ffffff', 0.7 * L.flash);
    ctx.lineWidth = Math.max(1.5, r * 0.07 * L.flash);
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.05 + 0.7 * (1 - L.flash)), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** One petal along angle `a`: a pointed leaf from `rIn` to `rOut`, `w` its half-width. */
function petal(ctx: CanvasRenderingContext2D, a: number, rIn: number, rOut: number, w: number, color: string, alpha: number): void {
  const ca = Math.cos(a), sa = Math.sin(a);
  const mid = rIn + (rOut - rIn) * 0.48;
  const px = -sa, py = ca;
  ctx.beginPath();
  ctx.moveTo(ca * rIn, sa * rIn);
  ctx.bezierCurveTo(ca * mid + px * w, sa * mid + py * w, ca * (rOut - (rOut - rIn) * 0.15) + px * w * 0.55, sa * (rOut - (rOut - rIn) * 0.15) + py * w * 0.55, ca * rOut, sa * rOut);
  ctx.bezierCurveTo(ca * (rOut - (rOut - rIn) * 0.15) - px * w * 0.55, sa * (rOut - (rOut - rIn) * 0.15) - py * w * 0.55, ca * mid - px * w, sa * mid - py * w, ca * rIn, sa * rIn);
  ctx.closePath();
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
}
