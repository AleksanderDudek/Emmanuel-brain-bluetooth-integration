/**
 * Nehemiasz's picture for the lobby's hero and the game card: night over a stretch of the wall with
 * its gate, a watch fire whose pool of light swells and ebbs with a focus that comes and goes (its
 * threshold a dotted ring, its edge gold beyond it), raiders coming down the road and turned back in
 * the light, pebbles from a tower, Nehemiah and Tirza with her lamp on the wall.  In the lobby (with
 * progress) the gate is the player's current one.  Drawn every frame, so it stays cheap: no state.
 */
import { clamp } from '../kit/juice';
import { gateName } from './content';
import type { NehProgress } from './meta';
import { C, font, glow, hash, paintBrazier, paintGate, paintNehemiah, paintRaider, paintTirza, paintTower, paintWallSeg } from './paint';

const TAU = Math.PI * 2;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: NehProgress): void {
  const S = Math.max(14, Math.min(w / 9, h / 5.2));
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, C.night0);
  sky.addColorStop(1, C.night1);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,248,225,.8)';
  for (let i = 0; i < 30; i++) ctx.fillRect(hash(i) * w, hash(i + 30) * h * 0.4, 1.4, 1.4);
  const yIn = h * 0.66, yOut = yIn - S * 0.32;
  // the hills and a road coming down
  ctx.fillStyle = C.nightGround;
  ctx.fillRect(0, h * 0.3, w, yOut - h * 0.3);
  ctx.strokeStyle = '#34324d';
  ctx.lineWidth = S * 0.35;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.28);
  ctx.quadraticCurveTo(w * 0.45, h * 0.42, w * 0.5, yOut);
  ctx.stroke();
  // the focus comes and goes: the fire's light breathes with it
  const level = 0.5 + 0.45 * Math.sin(t * 0.8);
  const fx = w * 0.5, fy = yOut - S * 0.15;
  const R = S * (1.0 + level * 3.0), mark = S * 2.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, fx, fy, R * 1.1, level > 0.5 ? 'rgba(255,200,100,' : 'rgba(255,170,90,', 0.3);
  ctx.restore();
  // raiders on the road: in the light they are struck and run
  for (let i = 0; i < 4; i++) {
    const cyc = (t * 0.22 + i * 0.25) % 1;
    const x = w * (0.62 - 0.12 * cyc) + (i % 2 ? -S * 0.4 : S * 0.3), y = h * 0.3 + (yOut - h * 0.3) * cyc;
    const d = Math.hypot((x - fx) / 1, (y - fy) / 0.8);
    const lit = d < R;
    ctx.globalAlpha = lit ? 1 : 0.45;
    paintRaider(ctx, x, y, S * 0.9, { kind: i === 2 ? 'drabina' : 'rabus', band: (['samaria', 'arabia', 'ammon'] as const)[i % 3], flip: -1, step: t * 9 + i, walking: 1, act: 0.3, hit: lit && Math.sin(t * 6 + i) > 0.8 ? 0.5 : 0, flee: lit && cyc > 0.82, seed: i, loot: false, climb: 0 });
    ctx.globalAlpha = 1;
  }
  // the wall, the gate, a tower
  const segW = w / 5;
  for (let i = 0; i < 5; i++) {
    if (i === 2) paintGate(ctx, i * segW, (i + 1) * segW, yOut, yIn, S, { tier: p ? 1 + Math.min(2, Math.floor((p.stars[p.gate] ?? 0) / 2)) : 2, h: 2, hp: 1, breach: false, working: null, night: true, open: false, t });
    else paintWallSeg(ctx, i * segW, (i + 1) * segW, yOut, yIn, S, { h: 1.6 + 0.3 * (i % 2), hp: 1, breach: false, working: i === 4 ? 0.5 : null, night: true, t, seed: i, done: 1 });
  }
  paintTower(ctx, segW * 2, yIn - S * 0.35, S, 2, 'far', true, t);
  ctx.fillStyle = '#2b2944';
  ctx.fillRect(0, yIn, w, h - yIn);
  // the threshold ring and the light's edge
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = 'rgba(255,250,232,.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(fx, fy, mark, mark * 0.8, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = level > 0.5 ? C.gold : 'rgba(255,236,200,.8)';
  ctx.lineWidth = level > 0.5 ? 3 : 2;
  ctx.beginPath();
  ctx.ellipse(fx, fy, R, R * 0.8, 0, Math.PI, TAU);
  ctx.stroke();
  paintBrazier(ctx, fx, fy + S * 0.1, S, 2, clamp(level), level > 0.5, 0, true, t);
  // a pebble from the tower now and then
  const pk = (t * 1.3) % 1;
  ctx.fillStyle = '#efe6d2';
  ctx.beginPath();
  ctx.arc(segW * 2 + (w * 0.56 - segW * 2) * pk, yIn - S * 1.2 - Math.sin(pk * Math.PI) * S * 0.8 - (h * 0.2) * pk, 2, 0, TAU);
  ctx.fill();
  paintNehemiah(ctx, w * 0.32, yIn + S * 0.55, S, { flip: 1, step: 0, walking: 0, arm: 0.3, build: 0, night: true, t });
  paintTirza(ctx, w * 0.24, yIn + S * 0.62, S, { flip: 1, step: 0, walking: 0, arm: 0.2, night: true, talk: false, t });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, w * 0.26, yIn + S * 0.2, S * 0.7, 'rgba(255,200,120,', 0.35);
  ctx.restore();
  if (p) {
    ctx.font = font(Math.max(11, S * 0.38), 750);
    ctx.fillStyle = 'rgba(255,240,210,.9)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(gateName(p.gate), w - 10, h - 8);
  }
}
