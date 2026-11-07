/**
 * Chleby i ryby's picture for the lobby's hero and the game card: the path up the hillside, the
 * boy's basket pouring loaves up through a honey gate and the golden gate (its arch glowing, ×3),
 * a handful becoming a stream, the crowd at the top cheering, Mirka swooping in from the lake.  In
 * the lobby (with progress) the hillside is the player's chapter.  Drawn every frame, so it stays
 * cheap: no state.
 */
import { placeOf } from './hill';
import type { ChlebyProgress } from './meta';
import {
  PALETTES, paintBasket, paintBoy, paintGate, paintGoldGate, paintGrass, paintGroup, paintGull, paintLake, paintLoaf, paintPath, paintSky,
} from './paint';

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: ChlebyProgress): void {
  const pal = PALETTES[p ? placeOf(p.level).chapter % PALETTES.length : 0];
  const horizon = h * 0.16, lakeD = h * 0.07;
  paintSky(ctx, w, horizon, pal, t);
  paintLake(ctx, w, horizon, lakeD, pal, t);
  paintGrass(ctx, w, horizon + lakeD, h, pal, t);
  const cx = w / 2, yB = h * 0.88, yT = h * 0.34;
  const hwB = Math.min(w * 0.36, (yB - yT) * 0.8), hwT = hwB * 0.6;
  const at = (fx: number, fy: number) => {
    const s = 1 - 0.4 * fy;
    return { x: cx + fx * hwB * s, y: yB - (yB - yT) * fy, s };
  };
  paintPath(ctx, [[at(-1, 0), at(-1, 1)], [at(1, 0), at(1, 1)]], pal);
  const S = Math.max(6, hwB / 5);
  // the crowd at the top: one group cheering in turn
  const cheerI = Math.floor(t / 1.6) % 3;
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * hwT * 0.68;
    const k = (t % 1.6) / 1.6;
    paintGroup(ctx, x, yT - S * 0.4, hwT * 0.6, S * 0.75, { seed: i + 7, size: 50, fed: 0, cheer: i === cheerI ? k : 0, done: i === cheerI, t, rest: false, active: true });
  }
  // the gates
  const g1 = at(Math.sin(t * 0.7) * 0.35, 0.3), g2 = at(0, 0.66);
  paintGate(ctx, g1.x, g1.y, hwB * 0.5 * g1.s, S * g1.s, 'mul', '×2', 0, 0);
  paintGoldGate(ctx, g2.x, g2.y, hwB * 0.62 * g2.s, S * g2.s, { mult: '×3', level: 0.72, mode: 'live', flash: 0.5 + 0.5 * Math.sin(t * 6), t, thr: '', reliable: true });
  // the stream: a handful at the bottom, more after each gate
  for (let i = 0; i < 26; i++) {
    const f = ((t * 0.45 + i / 26) % 1);
    const lane = i % 6;
    const n = f < 0.3 ? 2 : f < 0.66 ? 4 : 6;
    if (lane >= n) continue;
    const spread = (lane - (n - 1) / 2) * 0.09 * (0.5 + f);
    const q = at(spread, f);
    paintLoaf(ctx, q.x, q.y - S * 0.3 - Math.abs(Math.sin(t * 9 + i)) * S * 0.12, S * 0.26 * q.s);
  }
  // the boy and his basket
  const b = at(Math.sin(t * 0.7) * 0.25, 0);
  paintBoy(ctx, b.x, b.y + S * 0.9, S * 1.4, { toss: Math.max(0, Math.sin(t * 9)), t, walk: t * 0.1 });
  paintBasket(ctx, b.x, b.y + S * 0.15, S * 0.85, { fill: 0.8 });
  // Mirka swooping across from the lake
  const gx = ((t * 0.18) % 1.4 - 0.2) * w, gy = h * 0.42 + Math.sin(t * 2) * h * 0.03;
  paintGull(ctx, gx, gy, S * 1.2, { flap: t * 10, dir: 1, mirka: true });
}
