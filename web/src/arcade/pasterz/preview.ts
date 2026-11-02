/**
 * Pasterz's picture for the lobby's hero and the game card: the hillside from above, the shepherd
 * walking a slow loop with his call ring breathing gold around him and the flock trailing him in a
 * soft line, a few sheep still grazing by a rock and a thorn bush.  In the lobby (with progress)
 * the flock is the player's: more sheep follow as it grows toward the hundred.  Drawn every frame,
 * so it stays cheap: a few paths, no state.
 */
import type { PasterzProgress } from './meta';
import { C, hash, paintBush, paintRock, paintSheep, paintShepherd, type SheepPose } from './paint';

const pose: SheepPose = { small: false, bob: 0, walking: 1, lie: 0, look: 0, graze: 0 };

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: PasterzProgress): void {
  const S = Math.max(14, Math.min(w, h) / 11);
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, '#c4c983');
  g.addColorStop(1, '#93a457');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = hash(i * 7 + 3) * w, y = hash(i * 13 + 5) * h;
    if (i % 9 === 0) {
      ctx.fillStyle = '#c63a2c';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, S * 0.05), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.strokeStyle = i % 3 ? 'rgba(96,112,52,.55)' : 'rgba(225,228,170,.6)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.5, y - S * 0.15);
    ctx.moveTo(x + 2.5, y);
    ctx.lineTo(x + 3.5, y - S * 0.17);
    ctx.stroke();
  }
  paintRock(ctx, w * 0.83, h * 0.24, 0.8, 11, S);
  paintBush(ctx, w * 0.14, h * 0.76, 0.7, 23, S, t);
  // the shepherd's loop
  const at = (q: number) => ({ x: w * 0.5 + Math.cos(q * 0.45) * w * 0.27, y: h * 0.4 + Math.sin(q * 0.9) * h * 0.16 });
  const head = at(t), ahead = at(t + 0.05);
  const dir = Math.atan2(ahead.y - head.y, ahead.x - head.x);
  // grazing sheep, heads down
  pose.walking = 0;
  pose.graze = 1;
  for (let i = 0; i < 3; i++) paintSheep(ctx, w * (0.76 + i * 0.06), h * (0.74 + (i % 2) * 0.07), S, 2 + i, pose);
  // the call ring, breathing gold
  const level = 0.5 + 0.35 * Math.sin(t * 0.7);
  const r = S * (1.6 + level * 1.4);
  ctx.fillStyle = 'rgba(255,214,110,.12)';
  ctx.beginPath();
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([2, 6]);
  ctx.strokeStyle = 'rgba(255,250,232,.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(head.x, head.y, S * 2.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = level > 0.5 ? C.gold : 'rgba(255,250,232,.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
  ctx.stroke();
  // the flock behind him (more of it as the player's flock grows)
  const n = p ? Math.min(12, 5 + Math.floor((p.flock + p.season * 100) / 12)) : 7;
  pose.graze = 0;
  pose.walking = 1;
  // walk back along the loop: one sheep every ~0.8 m of path, a little to either side
  const spots: { x: number; y: number; d: number }[] = [];
  let q = t, prev = head, run = 0;
  for (let k = 0; k < 4000 && spots.length < n; k++) {
    q -= 0.004;
    const a = at(q);
    run += Math.hypot(a.x - prev.x, a.y - prev.y);
    prev = a;
    if (run >= S * (1.1 + 0.8 * spots.length)) {
      const b = at(q + 0.03);
      spots.push({ x: a.x, y: a.y, d: Math.atan2(b.y - a.y, b.x - a.x) });
    }
  }
  for (let i = spots.length - 1; i >= 0; i--) {
    const s = spots[i];
    const side = (hash(i + 1) - 0.5) * S * 1.1;
    pose.small = i % 5 === 4;
    pose.bob = t * 3 + i;
    paintSheep(ctx, s.x - Math.sin(s.d) * side, s.y + Math.cos(s.d) * side, S, s.d, pose);
  }
  paintShepherd(ctx, head.x, head.y, S * 1.5, dir, t * 2.2, 1, false);
}
