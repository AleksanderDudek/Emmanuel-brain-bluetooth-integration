/**
 * Firmament's picture for the lobby's hero and the game card: the saga map in the night sky — the
 * player's constellation (in the lobby: its won stars gold, the current one ringed, Bubo perched on
 * it) with the next one waiting faintly above, drifting slowly as if the map scrolls — a little cluster
 * of sky bodies where a line of three lights up in turn, a comet crossing, and the telescope's lens
 * breathing gold around its dashed threshold.  Drawn every frame, so it stays cheap.
 */
import { drawFigure } from './hud';
import { migrate, type FirmamentProgress } from './meta';
import { C, hash, paintBody, paintOwl } from './paint';
import { figure } from './content';
import { RULES } from './rules';

const TAU = Math.PI * 2;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, raw?: FirmamentProgress): void {
  const p = raw ? migrate(raw) : undefined;
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, C.night0);
  g.addColorStop(0.6, C.night1);
  g.addColorStop(1, C.night2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 50; i++) {
    const x = hash(i * 7 + 3) * w, y = hash(i * 13 + 5) * h;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i)) + i);
    ctx.fillStyle = `rgba(255,250,235,${0.2 + 0.5 * tw})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + tw * 0.9, 0, TAU);
    ctx.fill();
  }
  // the saga map: this constellation, the next one above, a slow drift
  const c = p ? Math.floor(p.level / RULES.perConst) : 0;
  const lit = p ? p.level - c * RULES.perConst : 4;
  const drift = Math.sin(t * 0.25) * h * 0.02;
  const box = { x: w * 0.05, y: h * 0.2 + drift, w: w * 0.5, h: h * 0.6 };
  ctx.save();
  ctx.globalAlpha = 0.3;
  drawFigure(ctx, c + 1, { x: w * 0.1, y: -h * 0.42 + drift, w: w * 0.42, h: h * 0.5 }, 0, t, -1);
  ctx.restore();
  drawFigure(ctx, c, box, lit, t, -1);
  const cur = figure(c).stars[Math.min(RULES.perConst - 1, lit)];
  const ow = Math.max(8, Math.min(w, h) * 0.07);
  paintOwl(ctx, box.x + cur[0] * box.w, box.y + cur[1] * box.h - ow * 1.3, ow, { t, look: 0.4, hop: Math.abs(Math.sin(t * 1.6)) * 0.3 });
  // a cluster of bodies, a line of three lighting up in turn
  const cell = Math.max(14, Math.min(w, h) / 6.2);
  const ox = w * 0.64, oy = h * 0.44;
  const kinds = [[0, 2, 0], [3, 4, 1], [5, 0, 2]];
  const line = Math.floor(t / 1.6) % 3;
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
    const x = ox + q * cell, y = oy + r * cell + Math.sin(t * 1.5 + r + q) * cell * 0.03;
    if (kinds[r][q] === 0 && line === (r + q) % 3) {
      const hg = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.7);
      hg.addColorStop(0, 'rgba(255,220,140,.45)');
      hg.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(x - cell, y - cell, cell * 2, cell * 2);
    }
    paintBody(ctx, kinds[r][q], x, y, cell * 0.36);
  }
  // a comet crossing
  const k = (t * 0.25) % 1.4;
  if (k < 1) {
    const cx = -w * 0.1 + k * w * 1.2, cy = h * 0.12 + k * h * 0.2;
    const cg = ctx.createLinearGradient(cx - w * 0.15, cy - h * 0.04, cx, cy);
    cg.addColorStop(0, 'rgba(220,235,255,0)');
    cg.addColorStop(1, 'rgba(220,235,255,.9)');
    ctx.strokeStyle = cg;
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) / 80);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, cy - h * 0.04);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // the lens, breathing gold around its threshold
  const lr = Math.min(w, h) * 0.12, lx = w * 0.88, ly = h * 0.18;
  const level = 0.5 + 0.35 * Math.sin(t * 0.7);
  ctx.fillStyle = '#a57a33';
  ctx.beginPath();
  ctx.arc(lx, ly, lr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0a0e2c';
  ctx.beginPath();
  ctx.arc(lx, ly, lr * 0.76, 0, TAU);
  ctx.fill();
  const pr = lr * 0.76 * (0.1 + 0.9 * level);
  const pg = ctx.createRadialGradient(lx, ly, 0, lx, ly, pr);
  pg.addColorStop(0, 'rgba(255,255,240,.9)');
  pg.addColorStop(0.5, level > 0.5 ? 'rgba(255,206,110,.8)' : 'rgba(170,195,240,.7)');
  pg.addColorStop(1, 'rgba(255,206,110,0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(lx, ly, pr, 0, TAU);
  ctx.fill();
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = 'rgba(255,245,220,.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(lx, ly, lr * 0.76 * 0.5, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = Math.max(2, lr * 0.1);
  ctx.beginPath();
  ctx.arc(lx, ly, lr * 0.88, -Math.PI / 2, -Math.PI / 2 + TAU * ((t * 0.12) % 1));
  ctx.stroke();
}
