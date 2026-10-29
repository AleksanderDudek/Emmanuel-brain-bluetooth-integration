/**
 * Wzlot's picture for the lobby's hero and the game card: the eaglet gliding over the wilderness
 * hills in parallax with the parent eagle ahead of it and its golden wake.  In the lobby (with the
 * player's progress) the eaglet wears the player's plumage and the land is the one their next
 * session opens on; on the cards (no progress) a downy eaglet over the Negev at morning.  Drawn
 * every frame in the lobby, so it stays cheap: a few paths, no sprites.
 */
import { LANDS, type Land } from './content';
import { stageOf, type WzlotProgress } from './meta';
import {
  LAND_LOOK, LANDS_SEED, mixInto, paintEagle, paintEaglet, paintRange, paintSky, rgb, skyAt, type EagletPose, type RGB, type SkyLook,
} from './paint';

const sky: SkyLook = skyAt(0.2);
const tmp: RGB = [0, 0, 0];
const pose: EagletPose = { stage: 1, fold: 0, spread: 0.7, flap: 0, glow: 0 };

/** The near hills of the preview: a gentle rolling profile (world x in hill units). */
const hill = (x: number): number => 0.5 + 0.35 * Math.sin(x * 1.9) + 0.12 * Math.sin(x * 4.3 + 1);

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: WzlotProgress): void {
  const land: Land = p ? LANDS[p.sessions % LANDS.length] : 'negev';
  const L = LAND_LOOK[land];
  const phase = p ? 0.12 + 0.06 * Math.sin(t * 0.05) : 0.2;
  skyAt(phase, sky);
  paintSky(ctx, 0, 0, w, h, phase, sky, t);
  const unit = Math.max(120, Math.min(h, w * 0.7));
  const seed = LANDS_SEED[land];
  const haze = (c: RGB, f: number) => mixInto(tmp, c, sky.mid, f);
  const run = t * 0.35;
  paintRange(ctx, w, run * 0.08, 1.6 / unit, h * 0.6, unit * 0.42, haze(L.far, 0.5), land, 0, seed, h + 2);
  paintRange(ctx, w, 3 + run * 0.2, 2.2 / unit, h * 0.72, unit * 0.3, haze(L.mid, 0.3), land, 1, seed + 10, h + 2);
  paintRange(ctx, w, 6 + run * 0.45, 3 / unit, h * 0.84, unit * 0.22, haze(L.near, 0.15), land, 2, seed + 20, h + 2);
  // the near hills the eaglet flies over
  const k = 2.6 / Math.max(160, w);
  const base = h * 0.98, amp = unit * 0.22;
  ctx.fillStyle = rgb(mixInto(tmp, L.ground, sky.light, 0.15));
  ctx.beginPath();
  ctx.moveTo(-2, h + 2);
  for (let px = -2; px <= w + 6; px += 6) ctx.lineTo(px, base - hill(run + px * k) * amp);
  ctx.lineTo(w + 6, h + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgb(mixInto(tmp, L.ground, [255, 244, 220], 0.5), 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let px = -2; px <= w + 6; px += 6) ctx.lineTo(px, base - hill(run + px * k) * amp);
  ctx.stroke();
  // the parent ahead, its golden wake, and the eaglet behind
  const ex = w * 0.36, ey = h * (0.5 + 0.06 * Math.sin(t * 0.9)) - unit * 0.05;
  const pxp = w * 0.64, pyp = h * (0.3 + 0.03 * Math.sin(t * 0.7 + 1));
  ctx.strokeStyle = 'rgba(255,214,120,.55)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, unit * 0.012);
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const q = i / 20;
    ctx.lineTo(pxp - q * (pxp - ex) * 0.85, pyp + q * (ey - pyp) * 0.7 + Math.sin(q * 5 + t) * 3);
  }
  ctx.stroke();
  paintEagle(ctx, pxp, pyp, Math.max(26, unit * 0.2), 0.04 * Math.sin(t), t * 2.2, 1, 1);
  pose.stage = p ? stageOf(p.feathers) : 1;
  pose.flap = Math.sin(t * 0.8) > 0.92 ? t * 18 : 0;
  pose.spread = 0.7 + 0.1 * Math.sin(t * 0.6);
  paintEaglet(ctx, ex, ey, Math.max(18, unit * 0.12), -0.08 + 0.1 * Math.sin(t * 0.9 + 1.4), pose);
  // a soft warm light from the morning sun
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, rgb(sky.light, 0.18));
  g.addColorStop(0.6, rgb(sky.light, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
