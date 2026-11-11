/**
 * Chleby i ryby's picture for the lobby's hero and the game card: a terrace of the hillside, the
 * boy's basket pouring a stream of bread-bearers up the lane, a honey ×2 doubling them and the
 * golden gate (its arch glowing, ×3) tripling them, a small gull wave waddling down to meet them,
 * the champion walking up through it all, the table of the hungry at the top with its hunger bar
 * emptying, and Mirka swooping in from the lake.  In the lobby (with progress) the hillside is the
 * player's chapter and the champion is the one in their loadout.  Drawn every frame, so it stays
 * cheap: no state.
 */
import type { MistrzId } from './cards';
import { placeOf } from './field';
import type { ChlebyProgress } from './meta';
import {
  PALETTES, paintBasket, paintBigBasket, paintBoy, paintGate, paintGoldGate, paintGrass, paintGull, paintGullWalk, paintLake, paintPath,
  paintRunner, paintSky, paintTable,
} from './paint';
import { paintCamel, paintCart, paintDonkey, paintGiant } from './sprites';

function champ(ctx: CanvasRenderingContext2D, id: MistrzId, x: number, y: number, s: number, t: number): void {
  switch (id) {
    case 'osiol': paintDonkey(ctx, x, y, s, { step: t * 9, t, worth: 16 }); break;
    case 'woz': paintCart(ctx, x, y, s, { step: t * 14, t, worth: 22 }); break;
    case 'olbrzym': paintGiant(ctx, x, y, s, { step: t * 9, t, fuse: 0.6, burst: 34 }); break;
    case 'wielblad': paintCamel(ctx, x, y, s, { step: t * 6, t, worth: 70 }); break;
    default: paintBigBasket(ctx, x, y, s, { step: t * 10, w: 30, t });
  }
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: ChlebyProgress): void {
  const pal = PALETTES[p ? placeOf(p.level ?? 0).chapter % PALETTES.length : 0];
  const horizon = h * 0.16, lakeD = h * 0.07;
  paintSky(ctx, w, horizon, pal, t);
  paintLake(ctx, w, horizon, lakeD, pal, t);
  paintGrass(ctx, w, horizon + lakeD, h, pal, t);
  const cx = w / 2, yB = h * 0.9, yT = h * 0.36;
  const hwB = Math.min(w * 0.36, (yB - yT) * 0.8);
  const at = (fx: number, fy: number) => {
    const s = 1 - 0.38 * fy;
    return { x: cx + fx * hwB * s, y: yB - (yB - yT) * fy, s };
  };
  paintPath(ctx, [[at(-1, 0), at(-1, 1)], [at(1, 0), at(1, 1)]], pal);
  const S = Math.max(6, hwB / 5);
  // the table at the top, its hunger emptying and filling again
  const k = (t * 0.12) % 1;
  const top = at(0, 1);
  paintTable(ctx, top.x, top.y - S * 0.1, hwB * 0.9 * top.s, S * 0.85, {
    seed: 3, hunger: Math.round(120 * (1 - k)), full: 120, fed: k > 0.93, bite: (t * 7) % 1, cheer: k > 0.93 ? (k - 0.93) * 20 : 9,
    rest: false, t, label: String(Math.round(120 * (1 - k))),
  });
  // the gates
  const g1 = at(Math.sin(t * 0.7) * 0.3, 0.24), g2 = at(0, 0.58);
  // the stream: a handful at the bottom, twice as many past the ×2, three times past the gold
  const items: { y: number; draw: () => void }[] = [];
  for (let i = 0; i < 30; i++) {
    const f = (t * 0.32 + i / 30) % 1;
    const lane = i % 6;
    const n = f < 0.24 ? 1 : f < 0.58 ? 2 : 6;
    if (lane >= n) continue;
    const spread = (lane - (n - 1) / 2) * 0.12 * (0.6 + f) + Math.sin(i * 1.7) * 0.05;
    const q = at(spread + (f < 0.24 ? Math.sin(t * 0.7) * 0.3 * (f / 0.24) : 0), f);
    items.push({ y: f, draw: () => paintRunner(ctx, q.x, q.y, S * 1.4 * q.s, { kind: 'loaf', step: t * 16 + i, w: 1, gold: f > 0.58 }) });
  }
  // a small gull wave coming down
  for (let i = 0; i < 4; i++) {
    const f = 0.82 - ((t * 0.05) % 0.3) - (i % 2) * 0.05;
    const q = at(-0.45 + (i % 2) * 0.18 + Math.floor(i / 2) * 0.1, f);
    items.push({ y: f, draw: () => paintGullWalk(ctx, q.x, q.y, S * 1.4 * q.s, { kind: 'gull', step: t * 9 + i, doze: false, t }) });
  }
  items.push({ y: 0.24, draw: () => paintGate(ctx, g1.x, g1.y, hwB * 0.46 * g1.s, S * g1.s, 'mul', '×2', 0, 0) });
  // the champion, slowly up the lane
  const cf = 0.08 + ((t * 0.06) % 0.8);
  const cq = at(0.32, cf);
  items.push({ y: cf, draw: () => champ(ctx, p?.loadout?.mistrz ?? 'kosz', cq.x, cq.y, S * 1.15 * cq.s, t) });
  items.push({ y: 0.58, draw: () => paintGoldGate(ctx, g2.x, g2.y, hwB * 0.6 * g2.s, S * g2.s, { mult: '×3', level: 0.72, mode: 'live', flash: 0.5 + 0.5 * Math.sin(t * 6), t, thr: '', reliable: true }) });
  items.sort((a, b) => b.y - a.y);
  for (const it of items) it.draw();
  // the boy and his basket
  const b = at(Math.sin(t * 0.7) * 0.3, 0);
  paintBoy(ctx, b.x, b.y + S * 0.6, S * 1.4, { toss: Math.max(0, Math.sin(t * 9)), t, walk: t * 0.1 });
  paintBasket(ctx, b.x, b.y - S * 0.15, S * 0.85, { fill: 0.8 });
  // Mirka swooping across from the lake
  const gx = ((t * 0.18) % 1.4 - 0.2) * w, gy = h * 0.3 + Math.sin(t * 2) * h * 0.03;
  paintGull(ctx, gx, gy, S * 1.2, { flap: t * 10, dir: 1, mirka: true });
}
