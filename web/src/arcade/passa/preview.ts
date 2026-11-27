/**
 * Złota passa's lobby hero and the calibration intro (DESIGN.md §26, builder B): the street at the golden hour turning
 * to dusk — the sun just gone behind the church, the first windows warm — under the garland with `lights` bulbs lit
 * (the player's streak), the day-streak's number on the café's sign when there is one.  A phone's hero and a card
 * carry the title over their lower part, so the street's end and the garland stand in the upper two thirds; a desk's
 * hero is as tall as the lobby card beside it: the street is framed at its top (at most as tall as it is wide) and
 * the road runs on below.
 */
import { GARLAND_MAX } from './moments';
import { Garland } from './garland';
import { glow, lightAt, rgba, rr } from './paint';
import { Street, project, type Cam } from './scene';
import { SIGN } from './world';

/** The hero's moment of the day: the sun just set behind the church, the sky still gold at the street's end. */
export const PREVIEW_DAY = 0.8;

let street: Street | null = null;
let garland: Garland | null = null;
let shown = -1;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, lights = 12, days = 0): void {
  if (!(w > 0) || !(h > 0)) return;
  if (!street) street = new Street(false);
  const n = Math.max(0, Math.min(GARLAND_MAX * 2, Math.floor(Number.isFinite(lights) ? lights : 12)));
  // a new count: a fresh garland (no flare in the lobby)
  if (!garland || n !== shown) { garland = new Garland(); shown = n; }
  const t = Number.isFinite(time) ? time : 0;
  const dpr = ctx.getTransform?.().a || 1;
  // the frame: the street in the upper part (a phone's hero and a card), at the top of a tall desk hero
  const hv = Math.min(h, w);
  const narrow = w < 560;
  const hy = narrow ? hv * 0.6 : hv * 0.7;
  const f = Math.max(80, Math.min(w * 0.6, hy / 0.62));
  const cam: Cam = { cx: w / 2 + w * 0.015, hy, f };
  street.resize(w, h, dpr, cam);
  ctx.save();
  street.sky(ctx, PREVIEW_DAY, t);
  street.street(ctx, PREVIEW_DAY);
  street.life(ctx, PREVIEW_DAY, t, 1 / 60);
  const Lt = lightAt(PREVIEW_DAY);
  garland.draw(ctx, cam, { lights: n, flying: null, time: t, reduced: false, calm: 0.5 + 0.2 * Math.sin(t * 0.6), dusk: Math.max(0.7, Lt.dusk), breath: 0.5, from: null, k: 1 });
  // the day-streak's number on the café's sign (a sun and the number: the lobby says the words)
  if (days > 0) sign(ctx, cam, w, h, Math.floor(days));
  // a soft vignette
  const vg = ctx.createRadialGradient(w / 2, hv * 0.5, Math.min(w, hv) * 0.3, w / 2, hv * 0.5, Math.hypot(w, h) * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, rgba('#06060f', 0.45));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function sign(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, days: number): void {
  const [hx, hy] = project(cam, SIGN.x - 0.15, SIGN.y + 0.3, SIGN.z);
  const px = Math.max(11, Math.min(15, (cam.f * 0.2) / SIGN.z));
  ctx.save();
  ctx.font = `700 ${px}px "Manrope Variable", Manrope, system-ui, sans-serif`;
  const text = String(days);
  const bw = ctx.measureText(text).width + px * 2.6, bh = px * 2;
  const bx = Math.max(4, Math.min(w - 4 - bw, hx - bw / 2)), by = hy + px * 0.6;
  if (by + bh > h || by < 0) { ctx.restore(); return; }
  ctx.strokeStyle = '#1c2420';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.25, hy); ctx.lineTo(bx + bw * 0.25, by);
  ctx.moveTo(bx + bw * 0.75, hy); ctx.lineTo(bx + bw * 0.75, by);
  ctx.stroke();
  ctx.fillStyle = '#234538';
  rr(ctx, bx, by, bw, bh, px * 0.3);
  ctx.fill();
  ctx.fillStyle = '#f5d58a';
  const sx = bx + px * 0.95, sy = by + bh / 2;
  ctx.beginPath();
  ctx.arc(sx, sy, px * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + px * 1.6, sy + 0.5);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, '#ffd890', bx + bw / 2, sy, bw * 0.7, 0.12);
  ctx.restore();
}
