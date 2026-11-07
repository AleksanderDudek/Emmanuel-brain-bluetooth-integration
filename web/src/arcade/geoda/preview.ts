/**
 * Geoda's lobby picture and card art: the geode with its board of crystals, a line that lights up
 * and bursts every few seconds while druses glint, and Bazyl with his lamp at the side.  With the
 * player's progress the board shows rock and jewels of their next chamber.
 */
import { drawGeode, GEODE_REACH, sparkle, TileCache } from './art';
import { chamberBoard, EMPTY, idx, N, ROCK } from './board';
import { chamber, migrate, type GeodaProgress } from './meta';
import { paintCave, paintJewel, paintMole, type MolePose } from './paint';
import { seeded } from './sim';

const tiles = new TileCache();
const pose: MolePose = { t: 0, cheer: 0, oops: 0, talk: false, lamp: 0.7, face: -1 };

/** A fixed picture of a board in play: tiles, rock and jewels, with row 5 one cell short of a clear. */
function boardFor(p?: GeodaProgress): Uint8Array[] {
  const spec = chamber(p ? migrate(p).level : 0);
  const b = chamberBoard(seeded(spec.seed), Math.round(spec.rock * 0.7), spec.goal.map(g => g[0]), 4);
  const rnd = seeded(41);
  for (let i = 0; i < N * N; i++) if (b.cells[i] === EMPTY && rnd() < 0.3) b.cells[i] = 1 + Math.floor(rnd() * 5);
  for (let x = 0; x < N; x++) if (b.cells[idx(x, 5)] === EMPTY) b.cells[idx(x, 5)] = 1 + (x % 5);
  b.cells[idx(6, 5)] = EMPTY;
  return [b.cells, b.jewel];
}

let cache: { key: number; cells: Uint8Array; jewel: Uint8Array } | null = null;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: GeodaProgress): void {
  if (w < 4 || h < 4) return;
  const key = p ? migrate(p).level : -1;
  if (!cache || cache.key !== key) {
    const [cells, jewel] = boardFor(p);
    cache = { key, cells, jewel };
  }
  tiles.setDpr(Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  paintCave(ctx, w, h, 0.5 + 0.3 * Math.sin(t * 0.8), t);
  const S0 = Math.min(h * 0.74, w * 0.5);
  const cell = Math.max(4, Math.floor(S0 / N)), S = cell * N;
  const rim = Math.max(3, S * 0.035);
  const bx = Math.round(w * 0.42 - S / 2), by = Math.round((h - S) / 2);
  drawGeode(ctx, { x: bx, y: by, w: S, h: S }, rim);
  // the loop: the gap fills at 1 s, the row bursts at 1.4 s, back at 3.6 s
  const loop = t % 4.2;
  const filled = loop > 1 && loop < 1.4;
  const gone = loop >= 1.4 && loop < 3.6;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = idx(x, y), px = bx + x * cell, py = by + y * cell;
      let v = cache.cells[i];
      if (y === 5 && x === 6 && filled) v = 3;
      if (y === 5 && gone) v = EMPTY;
      if (v === EMPTY) tiles.draw(ctx, 'slate', (i * 7) % 8, 0, px, py, cell);
      else if (v === ROCK) tiles.draw(ctx, 'rock', (i * 5) % 8, 0, px, py, cell);
      else tiles.draw(ctx, 'gem', v - 1, y === 5 && filled ? 3 : 2, px, py, cell);
      if (cache.jewel[i] && v !== EMPTY) paintJewel(ctx, px + cell / 2, py + cell / 2, cell * 0.3, cache.jewel[i], t);
    }
  }
  if (loop >= 1.4 && loop < 2) {
    const k = (loop - 1.4) / 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,236,190,${(0.6 * (1 - k)).toFixed(3)})`;
    ctx.fillRect(bx, by + 5 * cell, S, cell);
    for (let x = 0; x < N; x++) sparkle(ctx, bx + (x + 0.5) * cell, by + 5.5 * cell - k * cell * 1.5, cell * 0.25 * (1 - k), '#fff8dc');
    ctx.restore();
  }
  pose.t = t;
  pose.cheer = loop >= 1.4 && loop < 2.2 ? 0.8 : 0;
  const ms = Math.min(h * 0.5, w * 0.22);
  paintMole(ctx, Math.min(w - ms * 0.45, bx + S + rim * GEODE_REACH + ms * 0.55), by + S + rim, ms, pose);
}
