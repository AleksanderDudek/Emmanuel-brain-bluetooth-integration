/**
 * Posłaniec's picture for the lobby's hero and the game card: the messenger running away from us
 * down the Roman road into the dawn hills, drachmas glinting ahead, the ribbon of dawn across the
 * sky.  In the lobby (with the player's progress) he wears the player's cloak and the next city
 * stands on the far hills; on the cards (no progress) Smyrna in undyed wool.  Drawn every frame in
 * the lobby, so it stays cheap.  `paintRoadView` is shared with the calibration intro.
 */
import { CITY_IDS, CLOAKS, type CityId } from './content';
import { cloakOf, routeAt, type PoslaniecProgress } from './meta';
import { hex, mix, paintCity, paintCoin, paintHills, paintRunner, paintSky, rgb, skyAt, type RGB, type RunnerPose, type SkyLook } from './paint';

const sky: SkyLook = skyAt(0);
const pose: RunnerPose = { stride: 0, air: 0, slide: 0, lean: 0, squash: 0, stumble: 0, wool: CLOAKS[0].wool, trim: CLOAKS[0].trim, t: 0, alpha: 1 };
const PAVE: [RGB, RGB] = [hex('#c7ad87'), hex('#b49873')];

/** A straight road from the bottom edge to the vanishing point, its paving scrolling with `run` (m). */
export function paintRoadView(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, s: SkyLook, run: number, city: CityId | null, cityK: number, t: number): { K: number; F: number } {
  paintSky(ctx, w, horizon, s, w * 0.68, 0.4, t);
  const scale = Math.max(0.5, Math.min(w, h * 1.4) / 600);
  paintHills(ctx, w, horizon + 2, 60 * scale, t * 3, s.hill[0], 1.7, horizon + 4);
  if (city) paintCity(ctx, city, w * 0.7, horizon - 14 * scale, (50 + 90 * cityK) * scale, rgb(mix(s.hill[1], s.top, 0.25)));
  paintHills(ctx, w, horizon + 2, 38 * scale, t * 7 + 300, s.hill[1], 4.1, horizon + 4, 12 * scale);
  paintHills(ctx, w, horizon + 3, 18 * scale, t * 12 + 900, s.hill[2], 2.9, horizon + 4, 18 * scale);
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, rgb(mix(s.ground, s.glow, 0.25)));
  g.addColorStop(1, rgb(s.ground2));
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);
  // the road: strips in perspective (depth d → y = horizon + K / d, half-width F / d)
  const half = 2.6, K = (h - horizon) * 2.4, F = (w * 0.42 * 2.4) / half, cx = w / 2;
  for (let d0 = 70; d0 > 2.4; d0 -= 2.5) {
    const d1 = Math.max(2.2, d0 - 2.5);
    const y0 = horizon + K / d0, y1 = horizon + K / d1;
    const x0 = (half * F) / d0, x1 = (half * F) / d1;
    const stripe = Math.floor((d0 + run) / 2.5) & 1;
    ctx.fillStyle = rgb(mix(PAVE[stripe], s.glow, Math.min(0.8, (d0 / 70) ** 2)));
    ctx.beginPath();
    ctx.moveTo(cx - x0, y0);
    ctx.lineTo(cx + x0, y0);
    ctx.lineTo(cx + x1, y1);
    ctx.lineTo(cx - x1, y1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = stripe ? 'rgba(230,211,174,.9)' : 'rgba(143,122,94,.9)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * x0, y0);
      ctx.lineTo(cx + side * x0 * 1.12, y0);
      ctx.lineTo(cx + side * x1 * 1.12, y1);
      ctx.lineTo(cx + side * x1, y1);
      ctx.closePath();
      ctx.fill();
    }
  }
  return { K, F };
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: PoslaniecProgress): void {
  skyAt(0.05 + 0.04 * Math.sin(t * 0.07), sky);
  const horizon = h * 0.5;
  const r = p ? routeAt(p.metres) : null;
  const run = t * 9;
  const { K, F } = paintRoadView(ctx, w, h, horizon, sky, run, r ? CITY_IDS[r.next] : 'smyrna', r ? r.into / r.leg : 0.3, t);
  // the ribbon of dawn across the sky (a picture of it)
  const y0 = h * 0.2, amp = h * 0.06;
  ctx.lineCap = 'round';
  for (const [lw, a] of [[6, 0.2], [2.2, 0.95]] as const) {
    ctx.lineWidth = lw;
    for (let i = 0; i < 40; i++) {
      const x0 = w * (0.1 + 0.8 * i / 40), x1 = w * (0.1 + 0.8 * (i + 1) / 40);
      const v = (x: number) => Math.sin((x / w) * 9 - t * 0.6) * 0.6 + Math.sin((x / w) * 4.1 + 1) * 0.4;
      const up = v(x0) > 0.05;
      ctx.strokeStyle = up ? `rgba(255,207,110,${a})` : `rgba(242,185,192,${a})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0 - v(x0) * amp);
      ctx.lineTo(x1, y0 - v(x1) * amp);
      ctx.stroke();
    }
  }
  // drachmas ahead on the road
  for (let i = 0; i < 4; i++) {
    const d = ((i * 6 - run) % 24 + 24) % 24 + 6;
    const m = F / d;   // px per metre at that depth
    paintCoin(ctx, w / 2, horizon + K / d - 0.6 * m, Math.max(1.5, 0.27 * m), t * 4 + i);
  }
  // the messenger
  const cloak = CLOAKS[p ? cloakOf(p) : 0];
  pose.stride = t * 2.6;
  pose.wool = cloak.wool;
  pose.trim = cloak.trim;
  pose.t = t;
  const s = Math.max(22, h * 0.19);
  ctx.fillStyle = 'rgba(30,20,20,.25)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.93, s * 0.4, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  paintRunner(ctx, w / 2, h * 0.93, s, pose);
  // a warm light from the low sun
  const g = ctx.createLinearGradient(w, 0, 0, h);
  g.addColorStop(0, 'rgba(255,226,184,.18)');
  g.addColorStop(0.6, 'rgba(255,226,184,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
