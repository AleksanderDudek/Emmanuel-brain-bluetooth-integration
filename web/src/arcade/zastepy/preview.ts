/**
 * Zastępy's picture for the lobby's hero and the game card: the causeway between the two gates, a
 * small host walking out of the gate of light, shadows coming from the gate of ash, a flash where
 * they meet, banners along the far edge breathing gold.  In the lobby (with progress) the host is the
 * player's: a stronger gate sends more of it.  Drawn every frame, so it stays cheap.
 */
import { ageOf, migrate, type ZastepyProgress } from './meta';
import { C, POSE, paintAshGate, paintDemon, paintHost, paintLightGate, type Pose } from './paint';
import { HOST_IDS, type DemonId, type HostId } from './rules';

const pose: Pose = { ...POSE };
const DEMONS: DemonId[] = ['chochlik', 'cien', 'ogar'];

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: ZastepyProgress): void {
  const S = Math.max(9, Math.min(w / 16, h / 5.5));
  const roadY = h * 0.72;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#fff1c9');
  g.addColorStop(0.55, '#f2d4a0');
  g.addColorStop(1, '#5a3a4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.08, h * 0.2, 0, w * 0.08, h * 0.2, w * 0.5);
  sun.addColorStop(0, 'rgba(255,253,235,.9)');
  sun.addColorStop(1, 'rgba(255,253,235,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,248,236,.85)';
  ctx.fillRect(0, roadY + S * 0.5, w, h);
  ctx.fillStyle = C.stone;
  ctx.fillRect(0, roadY - S * 0.8, w, S);
  ctx.fillStyle = C.stoneShade;
  ctx.fillRect(0, roadY + S * 0.2, w, S * 0.35);
  // banners breathing gold along the far edge
  for (let i = 0; i < 12; i++) {
    const x = w * (0.16 + i * 0.06);
    const lv = 0.5 + 0.4 * Math.sin(t * 0.9 - i * 0.5);
    const hh = S * (0.6 + lv * 1.1);
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = Math.max(1, S * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, roadY - S * 0.8);
    ctx.lineTo(x, roadY - S * 0.8 - hh);
    ctx.stroke();
    ctx.fillStyle = lv > 0.5 ? C.gold : '#fbf3df';
    ctx.beginPath();
    ctx.moveTo(x, roadY - S * 0.8 - hh);
    ctx.lineTo(x + S * 0.45, roadY - S * 0.8 - hh + S * 0.14);
    ctx.lineTo(x, roadY - S * 0.8 - hh + S * 0.28);
    ctx.fill();
  }
  const age = p ? ageOf(migrate(p).battle) : 2;
  pose.age = age;
  paintLightGate(ctx, w * 0.12, roadY + S * 0.15, S, { glow: 0.5 + 0.3 * Math.sin(t), walls: 1, t, mend: 0, age });
  paintAshGate(ctx, w * 0.88, roadY + S * 0.15, S, { ash: 0.8, t, fall: 0, sealed: false });
  // the host and the shadows meeting in the middle
  const n = p ? Math.min(4, 2 + Math.floor((p.gate - 1) / 3)) : 3;
  const meet = w * 0.52;
  pose.t = t;
  for (let i = 0; i < n; i++) {
    pose.age = age;
    const id: HostId = HOST_IDS[[0, 2, 3, 1][i] ?? 0];
    pose.seed = i;
    pose.walk = 1;
    pose.step = (t * 2 + i * 0.7) % 2;
    pose.atk = i === 0 ? Math.max(0, Math.sin(t * 4)) : 0;
    const x = meet - S * (0.7 + i * 1.1) + Math.sin(t * 1.3 + i) * S * 0.08;
    paintHost(ctx, id, x, roadY - (i % 2) * S * 0.3, S, pose);
  }
  for (let i = 0; i < 3; i++) {
    pose.seed = 10 + i;
    pose.age = 0;
    pose.step = (t * 2 + i) % 2;
    pose.atk = i === 0 ? Math.max(0, Math.sin(t * 4 + 1.6)) : 0;
    const x = meet + S * (0.7 + i * 1.1) - Math.sin(t * 1.1 + i) * S * 0.08;
    paintDemon(ctx, DEMONS[i], x, roadY - (i % 2) * S * 0.3, S, pose);
  }
  pose.atk = 0;
  // the flash where the blades meet
  const f = Math.max(0, Math.sin(t * 4));
  ctx.fillStyle = `rgba(255,240,190,${0.6 * f})`;
  ctx.beginPath();
  ctx.arc(meet, roadY - S * 0.8, S * (0.2 + 0.3 * f), 0, Math.PI * 2);
  ctx.fill();
}
