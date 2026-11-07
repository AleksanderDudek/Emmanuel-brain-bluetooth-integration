/**
 * Źródła's calibration scene and the lobby's picture: a small dry valley seen from above, the
 * spring's well-head, a winding channel of stones, and Kumka waiting in her straw hat.  While the
 * reference fills (`p` 0..1) the water creeps along the channel (the sluice opening as the band
 * settles); in the lobby the water runs the channel in a loop and the gardens green behind it.
 * The runner's calibration card covers the lower part of the screen, so the scene sits high.
 */
import { clamp } from '../kit/juice';
import type { Kind } from './grid';
import { C, paintContours, paintFrog, paintGreen, paintSpring, paintStone, paintWater, roundRect, type FrogPose } from './paint';

/** A fixed channel for the scene: cells (column, row) with the stone and the way through it. */
const WAY: { c: number; r: number; kind: Kind; a: number; b: number }[] = [
  { c: 1, r: 1, kind: 'h', a: 3, b: 1 },
  { c: 2, r: 1, kind: 'sw', a: 3, b: 2 },
  { c: 2, r: 2, kind: 'x', a: 0, b: 2 },
  { c: 2, r: 3, kind: 'ne', a: 0, b: 1 },
  { c: 3, r: 3, kind: 'h', a: 3, b: 1 },
  { c: 4, r: 3, kind: 'nw', a: 3, b: 0 },
  { c: 4, r: 2, kind: 'v', a: 2, b: 0 },
  { c: 4, r: 1, kind: 'se', a: 2, b: 1 },
  { c: 5, r: 1, kind: 'ph', a: 3, b: 1 },
];
const COLS = 7, ROWS = 5;

let landCache: { w: number; h: number; c: HTMLCanvasElement } | null = null;

/** The land with its contour lines, made once per size (CSS px; drawn scaled on hi-dpi screens). */
function landOf(w: number, h: number): HTMLCanvasElement | null {
  if (landCache && landCache.w === w && landCache.h === h) return landCache.c;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#efe3c9');
  grad.addColorStop(1, '#dcc7a0');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  paintContours(g, w, h, 7, { scale: 120, levels: 7, color: '#9c8458', alpha: 0.25, step: 9 });
  landCache = { w, h, c };
  return c;
}

const pose: FrogPose = { t: 0, blink: 0, talk: false, hop: 0, look: 0.3, cheer: false };

/**
 * The scene in a w × h box at the top of a canvas: `fill` 0..1 is how far along the channel the
 * water has run, `green` 0..1 how green the wet cells are.
 */
export function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, fill: number, green: number, top = 0, bottom = h): void {
  const land = landOf(w, h);
  if (land) ctx.drawImage(land, 0, 0, w, h);
  else {
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(0, 0, w, h);
  }
  const room = Math.max(40, bottom - top);
  const cs = Math.max(10, Math.floor(Math.min((w * 0.86) / COLS, (room * 0.82) / ROWS)));
  const bx = Math.round((w - cs * COLS) / 2), by = Math.round(top + (room - cs * ROWS) / 2);
  ctx.fillStyle = '#e2cfa6';
  ctx.beginPath();
  roundRect(ctx, bx - 4, by - 4, cs * COLS + 8, cs * ROWS + 8, 10);
  ctx.fill();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = (c + r) % 2 ? '#d8c296' : '#dcc79c';
    ctx.fillRect(bx + c * cs, by + r * cs, cs, cs);
  }
  const total = WAY.length + 0.5;
  const run = fill * total;
  WAY.forEach((s, i) => {
    const k = clamp(run - 0.5 - i);
    if (k >= 1 && green > 0) paintGreen(ctx, bx + s.c * cs, by + s.r * cs, cs, green, green > 0.9, i * 7, t);
  });
  paintSpring(ctx, bx, by + cs, cs, 1, { t, gate: 0, count: null, running: fill > 0, still: false, hidden: false });
  WAY.forEach((s, i) => paintStone(ctx, bx + s.c * cs, by + s.r * cs, cs, s.kind, 'laid', i * 3 + 1));
  // the water
  paintWater(ctx, bx + cs / 2, by + cs * 1.5, cs, -1, 1, 0, clamp(run / 0.5), { t, flow: 1, still: false });
  WAY.forEach((s, i) => {
    const k = clamp(run - 0.5 - i);
    if (k > 0) paintWater(ctx, bx + (s.c + 0.5) * cs, by + (s.r + 0.5) * cs, cs, s.a, s.b, 0, k, { t, flow: 1, still: false });
  });
  // the water also runs a second time through the cross (the loop)
  pose.t = t;
  pose.blink = (t % 3.3) < 0.12 ? 1 : 0;
  pose.hop = fill >= 0.999 ? Math.max(0, Math.sin(t * 5)) * 0.4 : 0;
  pose.cheer = fill >= 0.999;
  paintFrog(ctx, bx + cs * 6.1, by + cs * 4.6, cs * 1.2, pose);
  void C;
}

export class ZrodlaIntro {
  private t = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number): void {
    this.t += dt;
    paintScene(ctx, w, h, this.t, clamp(p * 1.05), 0, Math.min(70, h * 0.08), h * 0.62);
  }
}
