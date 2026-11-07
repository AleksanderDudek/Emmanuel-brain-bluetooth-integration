/**
 * Źródła's lobby picture and card art: the valley scene of intro.ts with the water running its
 * channel in a loop and the gardens greening behind it, and (in the lobby, with the player's
 * progress) the road of the fifteen stations along the bottom, the ones passed lit.
 */
import { clamp } from '../kit/juice';
import { paintScene } from './intro';
import { migrate, stationsDone, type ZrodlaProgress } from './meta';
import { C } from './paint';
import { RULES } from './rules';

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: ZrodlaProgress): void {
  const cycle = 9, k = (t % cycle) / cycle;
  const fill = clamp(k / 0.6);
  const green = clamp((k - 0.6) / 0.3);
  const road = p ? 22 : 0;
  paintScene(ctx, w, h - road, t, fill, green);
  if (!p) return;
  const q = migrate(JSON.parse(JSON.stringify(p)) as ZrodlaProgress);
  const done = stationsDone(q);
  const y = h - road / 2, x0 = 16, x1 = w - 16;
  ctx.fillStyle = '#e8dcc4';
  ctx.fillRect(0, h - road, w, road);
  ctx.strokeStyle = 'rgba(140,116,80,.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < RULES.stations; i++) {
    const x = x0 + ((x1 - x0) * i) / (RULES.stations - 1);
    ctx.fillStyle = i < done ? C.water : i === done ? C.gold : '#c9b98a';
    ctx.beginPath();
    ctx.arc(x, y, i === done ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
