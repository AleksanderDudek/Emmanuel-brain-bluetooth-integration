/**
 * Rozświetl's pictures outside play: the lobby's hero and the game card (a mosaic half broken open, the
 * bright place showing through, light in the grout and a tile bursting every few seconds), and the
 * calibration intro (the day's dark picture on its tiles while the light gathers behind them).  Each
 * mosaic is painted once per size and kept (the lobby draws every frame).
 */
import { clamp, ease } from '../kit/juice';
import { cracks, insetPoly, makeMosaic, shards, type Mosaic, type Pt } from '../kit/mosaic';
import { dayKey, daySeed } from '../kit/progress';
import { PAIRS, pairTitle } from './content';
import { dayPair, type RozProgress } from './meta';
import { C, SERIF, font, glow, roundRect } from './paint';
import { paintScene, type PairId } from './scenes';
import { seeded } from './scenekit';

/** A small mosaic over a pair's two pictures, painted once per size. */
class Mini {
  readonly before: HTMLCanvasElement;
  readonly after: HTMLCanvasElement;
  readonly m: Mosaic;
  readonly full: Path2D[];
  readonly inset: Path2D[];
  readonly lines: Pt[][][];
  readonly pieces: Pt[][][];
  /** the tiles from the middle outward */
  readonly order: number[];

  constructor(readonly id: PairId, readonly w: number, readonly h: number, readonly dpr: number, n: number, seed: number) {
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    this.before = document.createElement('canvas');
    this.after = document.createElement('canvas');
    for (const [c, bright] of [[this.before, false], [this.after, true]] as const) {
      c.width = pw;
      c.height = ph;
      const ctx = c.getContext('2d');
      if (ctx) paintScene(ctx, pw, ph, id, bright);
    }
    const rnd = seeded(seed);
    this.m = makeMosaic(w, h, n, rnd, { relax: 2 });
    const path = (poly: readonly Pt[]) => {
      const p = new Path2D();
      poly.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
      p.closePath();
      return p;
    };
    const grout = clamp(Math.min(w, h) / 160, 1, 2.2);
    this.full = this.m.cells.map(c => path(c.poly));
    this.inset = this.m.cells.map(c => path(insetPoly(c.poly, grout)));
    this.lines = this.m.cells.map(c => cracks(c, { x: c.cx, y: c.cy }, 5, rnd));
    this.pieces = this.m.cells.map(c => shards(c, 6, rnd));
    this.order = this.m.cells.map(c => c.id).sort((a, b) => this.m.cells[a].ring - this.m.cells[b].ring);
  }

  /**
   * Draw at (x, y): the light behind (`light` 0..1), the open tiles' bright picture, the dark tiles inset,
   * cracks on `cracked` tiles at `crack` 0..1.
   */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, open: (i: number) => boolean, light: number, cracked: number[], crack: number, t: number): void {
    const { w, h } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, w / 2, h / 2, Math.max(w, h) * 0.75, '#ffb85a', 0.25 + 0.5 * light);
    glow(ctx, w / 2, h * 0.5, Math.min(w, h) * 0.45, '#fff1c0', 0.3 + 0.5 * light);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < this.m.cells.length; i++) {
      const o = open(i);
      ctx.save();
      ctx.clip(o ? this.full[i] : this.inset[i]);
      ctx.drawImage(o ? this.after : this.before, 0, 0, w, h);
      ctx.restore();
    }
    // gold in the seams of the open part
    ctx.strokeStyle = 'rgba(255,214,110,.85)';
    ctx.lineWidth = Math.max(1.2, Math.min(w, h) / 160);
    ctx.beginPath();
    for (const e of this.m.edges) {
      if (e.b < 0 || !open(e.a) || !open(e.b)) continue;
      ctx.moveTo(e.p.x, e.p.y);
      ctx.lineTo(e.q.x, e.q.y);
    }
    ctx.stroke();
    if (cracked.length && crack > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const p = new Path2D();
      for (const i of cracked) {
        const c = this.m.cells[i];
        glow(ctx, c.cx, c.cy, Math.sqrt(c.area) * (0.6 + 0.4 * crack), '#ffc86e', 0.25 + 0.5 * crack * crack);
        for (const ln of this.lines[i]) {
          const n = Math.max(2, Math.ceil(ln.length * crack));
          ln.slice(0, n).forEach((q, k) => (k ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
        }
      }
      ctx.strokeStyle = 'rgba(255,190,90,.4)';
      ctx.lineWidth = 3;
      ctx.stroke(p);
      ctx.strokeStyle = 'rgba(255,248,226,.95)';
      ctx.lineWidth = 1.1;
      ctx.stroke(p);
      ctx.globalCompositeOperation = 'source-over';
    }
    void t;
    ctx.restore();
  }
}

const cache = new Map<string, Mini>();

function mini(id: PairId, w: number, h: number, dpr: number, n: number, seed: number): Mini {
  const key = `${id}|${Math.round(w)}x${Math.round(h)}@${dpr}|${n}|${seed}`;
  let m = cache.get(key);
  if (!m) {
    if (cache.size > 6) cache.clear();
    m = new Mini(id, Math.round(w), Math.round(h), dpr, n, seed);
    cache.set(key, m);
  }
  return m;
}

const dprOf = (ctx: CanvasRenderingContext2D): number => {
  const tr = ctx.getTransform?.();
  return tr && Number.isFinite(tr.a) && tr.a > 0 ? Math.min(3, tr.a) : 1;
};

/**
 * The lobby's hero and the card art: a mosaic half broken open from the middle, the bright place through
 * it, gold in the open seams; every ~4 s the next tile cracks and bursts (pieces flying, a flash), and
 * after the whole picture the cycle starts over.  In the lobby, the day's picture; on cards, the first pair.
 */
export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: RozProgress): void {
  if (w < 4 || h < 4) return;
  const id: PairId = p ? dayPair(daySeed('rozswietl', dayKey())) : 'samotnosc';
  const m = mini(id, w, h, dprOf(ctx), 18, 5);
  const n = m.order.length;
  const cycle = 4;
  const steps = Math.floor(t / cycle);
  const k = (t % cycle) / cycle;
  // from a third open to all but one, then over again
  const openN = Math.floor(n / 3) + (steps % (n - Math.floor(n / 3)));
  const openSet = new Set(m.order.slice(0, openN));
  const next = m.order[Math.min(n - 1, openN)];
  const light = 0.45 + 0.35 * Math.sin(t * 1.1);
  m.draw(ctx, 0, 0, i => openSet.has(i), light, [next], ease.inOutSine(clamp(k / 0.8)), t);
  // the burst at the end of the cycle
  if (k > 0.8) {
    const q = (k - 0.8) / 0.2;
    const c = m.m.cells[next];
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, c.cx, c.cy, Math.sqrt(c.area) * (1.2 + 1.5 * q), PAIRS[id].light, (1 - q) * 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(40,46,62,.9)';
    for (const piece of m.pieces[next]) {
      let ax = 0, ay = 0;
      for (const v of piece) { ax += v.x; ay += v.y; }
      ax /= piece.length;
      ay /= piece.length;
      const dx = ax - c.cx, dy = ay - c.cy;
      ctx.save();
      ctx.translate(dx * q * 2.5, dy * q * 2.5 - 30 * q + 50 * q * q);
      ctx.globalAlpha = 1 - q;
      ctx.beginPath();
      piece.forEach((v, j) => (j ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // a soft vignette and the name on the hero
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (p && w >= 280 && h >= 150) {
    const size = Math.max(14, Math.min(20, w / 28));
    ctx.font = font(size, 600, SERIF);
    const name = pairTitle(id);
    const tw = ctx.measureText(name).width + 24;
    // at the top: the lobby writes the game's own name over the hero's lower part
    ctx.fillStyle = 'rgba(8,10,16,.66)';
    roundRect(ctx, w / 2 - tw / 2, 14, tw, size + 12, (size + 12) / 2);
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, 14 + (size + 12) / 2 + 1);
  }
}

/**
 * The calibration intro: the day's dark picture on its tiles, high on the screen (the runner's card covers
 * the lower part); while the reference fills (`p` 0..1) the light gathers behind the grout, and at the end
 * the middle tiles start to crack.
 */
export class RozIntro {
  private clock = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: RozProgress, daySeed: number, dpr: number): void {
    if (w < 4 || h < 4) return;
    this.clock += dt;
    ctx.fillStyle = C.wall;
    ctx.fillRect(0, 0, w, h);
    const id: PairId = progress.pick && (PAIRS as Record<string, unknown>)[progress.pick] ? progress.pick as PairId : dayPair(daySeed);
    const fw = Math.min(w - 32, 720), fh = Math.min(h * 0.46, fw * 0.62);
    const x = (w - fw) / 2, y = Math.max(16, h * 0.08);
    const m = mini(id, fw, fh, dpr, 16, 9);
    const k = clamp(p);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, w / 2, y + fh / 2, Math.max(fw, fh) * 0.8, '#ffc56a', 0.1 + 0.25 * k);
    ctx.globalCompositeOperation = 'source-over';
    const cracked = k > 0.6 ? m.order.slice(0, 2) : [];
    m.draw(ctx, x, y, () => false, 0.15 + 0.7 * k + 0.08 * Math.sin(this.clock * 1.4), cracked, clamp((k - 0.6) / 0.4), this.clock);
    ctx.strokeStyle = 'rgba(246,195,92,.5)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, x - 3.5, y - 3.5, fw + 7, fh + 7, 9);
    ctx.stroke();
  }
}
