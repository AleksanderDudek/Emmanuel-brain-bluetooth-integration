/**
 * Firmament's picture for the lobby's hero and the game card: the night sky, the constellation
 * (in the lobby, the player's own, its won levels in gold), a little cluster of sky bodies twinkling
 * — a line of three lighting up now and then — a comet crossing, and the telescope's lens breathing
 * gold around its dashed threshold.  Drawn every frame, so it stays cheap: no state, no sprites.
 */
import { figureOf } from './levels';
import type { FirmamentProgress } from './meta';
import { C, hash, paintBody, paintStar } from './paint';
import { RULES } from './rules';

const TAU = Math.PI * 2;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: FirmamentProgress): void {
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
  // the constellation
  const c = p ? Math.floor(p.level / RULES.perConst) : 0;
  const fig = figureOf(c);
  const fx = w * 0.06, fy = h * 0.08, fw = w * 0.5, fh = h * 0.55;
  ctx.strokeStyle = 'rgba(158,197,255,.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const [a, b] of fig.lines) {
    ctx.moveTo(fx + fig.pts[a][0] * fw, fy + fig.pts[a][1] * fh);
    ctx.lineTo(fx + fig.pts[b][0] * fw, fy + fig.pts[b][1] * fh);
  }
  ctx.stroke();
  const S = Math.max(3, Math.min(w, h) / 40);
  fig.pts.forEach(([px, py], i) => {
    const won = p ? (p.stars[c * RULES.perConst + i] ?? 0) > 0 : i < 4;
    paintStar(ctx, fx + px * fw, fy + py * fh, S * (won ? 1.2 : 0.9), won ? 1 : 0.5, won ? C.gold : '#dfe6f8');
  });
  // a cluster of bodies, a line of three lighting up in turn
  const cell = Math.max(14, Math.min(w, h) / 6.2);
  const ox = w * 0.62, oy = h * 0.42;
  const kinds = [[0, 2, 0], [3, 4, 1], [5, 0, 2]];
  const line = Math.floor(t / 1.6) % 3;
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
    const x = ox + q * cell, y = oy + r * cell + Math.sin(t * 1.5 + r + q) * cell * 0.03;
    const hot = kinds[r][q] === 0 && line === (r + q) % 3;
    if (hot) {
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
    const cx = -w * 0.1 + k * w * 1.2, cy = h * 0.2 + k * h * 0.25;
    const cg = ctx.createLinearGradient(cx - w * 0.15, cy - h * 0.04, cx, cy);
    cg.addColorStop(0, 'rgba(220,235,255,0)');
    cg.addColorStop(1, 'rgba(220,235,255,.9)');
    ctx.strokeStyle = cg;
    ctx.lineWidth = Math.max(1.5, S * 0.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, cy - h * 0.04);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // the lens, breathing gold around its threshold
  const lr = Math.min(w, h) * 0.12, lx = w * 0.88, ly = h * 0.17;
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
  ctx.arc(lx, ly, lr * 0.76 * 0.55, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = Math.max(2, lr * 0.1);
  ctx.beginPath();
  ctx.arc(lx, ly, lr * 0.88, -Math.PI / 2, -Math.PI / 2 + TAU * ((t * 0.12) % 1));
  ctx.stroke();
}
