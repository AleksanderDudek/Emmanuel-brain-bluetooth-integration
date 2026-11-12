/**
 * Rozświetl's play view (DESIGN §13.7).  The picture is drawn in layers, so the light really comes from
 * behind:
 *
 *   the wall      a dark wall with the frame's gold edge and the glow of the light around it (cached)
 *   the light     behind the mosaic: a soft glow over the whole picture as strong as the band's light,
 *                 the halo at the aimed tile (its radius is the gauge), knocks, bursts, the flare's wave
 *   the mosaic    a cached layer: the dark tiles inset (the grout between them is open, so the light behind
 *                 shows through it), the uncovered pieces whole, warming as calm deepens them; redrawn only
 *                 tile by tile when one changes
 *   on top        each pressed tile's glow and its cracks growing with the pressure (the kit's crack lines,
 *                 two strokes: a warm wide one and a white-hot core), the gold in the seams, the aim, the
 *                 halo's rim and its dotted threshold ring, the shards (sprites of the dark picture flying,
 *                 spinning, turning into motes), flashes, numbers, the bloom of a finished picture
 *   the voice     the firefly by the frame (its light breathes 4/6 in a rest, its ring is the flare) and its
 *                 bubble; the cards
 *
 * No shadowBlur and no ctx.filter per frame: glows are baked sprites added with "lighter"; the scenes are
 * painted once per picture and size.
 */
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import { fitCover, insetPoly, shards as shardPolys, cracks as crackLines, type MosaicCell, type Pt } from '../kit/mosaic';
import type { PassageId } from '../kit/scripture';
import { PAIRS, pairTitle } from './content';
import { pct, t } from './i18n';
import { cardBox, flySpot, frameFor, layout, type Layout, type Rect } from './layout';
import type { PicSrc } from './meta';
import {
  C, SANS, SERIF, bubbleBox, cardLayout, font, glow, paintBubble, paintCard, paintFly, roundRect, type CardLayout, type CardText,
} from './paint';
import { RULES } from './rules';
import { paintScene } from './scenes';
import type { RozSim, SimEvent } from './sim';
import type { Insets } from '../kit/types';

/** The pictures of an own pair, ready to draw (the dark one is the player's "before" or the veiled "after"). */
export interface OwnPics { after: CanvasImageSource & { width: number; height: number }; before: CanvasImageSource & { width: number; height: number }; label: string }

interface Shard {
  sprite: HTMLCanvasElement;
  /** the sprite's offset from the piece's centre (CSS px) and size */
  ox: number; oy: number; sw: number; sh: number;
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  t: number; life: number; motes: boolean;
}

interface Flash { x: number; y: number; r: number; t: number; dur: number; color: string }

const SHARD_CAP = 150;

export class RozView {
  L: Layout;
  frame: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private w = 1;
  private h = 1;
  private dpr = 1;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly reduced: boolean;
  readonly touch: boolean;

  // the picture's canvases
  private picRef: object | null = null;
  private key = '';
  private before: HTMLCanvasElement | null = null;
  private after: HTMLCanvasElement | null = null;
  private layer: HTMLCanvasElement | null = null;
  private lctx: CanvasRenderingContext2D | null = null;
  private prevAfter: HTMLCanvasElement | null = null;
  private prevFrame: Rect | null = null;
  private wall: HTMLCanvasElement | null = null;
  private vignette: HTMLCanvasElement | null = null;
  /** per tile: what the layer shows of it (redrawn when this changes) */
  private shown: { drawn: boolean; open: boolean; warm: number }[] = [];
  private full: Path2D[] = [];
  private inset: Path2D[] = [];
  /** each tile's bounding box in frame-local CSS px (a redraw copies only that part of the picture) */
  private box: Rect[] = [];
  private cracks = new Map<number, Pt[][]>();
  private picVer = 0;
  private groutKey = '';
  private aimKey = '';
  private groutPath: Path2D | null = null;
  private aimPath: Path2D | null = null;

  // effects
  private readonly shards: Shard[] = [];
  private readonly pool: HTMLCanvasElement[] = [];
  private readonly flashes: Flash[] = [];
  private readonly motes = new Particles(320);
  private readonly words = new Floaters();
  private readonly shake: Shake;
  private wave: { x: number; y: number; t: number } | null = null;
  private reveal = 0;
  private stop = 0;
  private titleT = 99;
  private clock = 0;
  private rngS = 1;

  // the hand
  /** a touch drag's lens (CSS px), where the light is aimed from */
  lens: { x: number; y: number; fx: number; fy: number } | null = null;
  /** touch-down ripples (CSS px, age in s) */
  private readonly ripples: { x: number; y: number; t: number }[] = [];

  /** A press shows at once: a small ring of light where the finger came down. */
  ripple(x: number, y: number): void {
    this.ripples.push({ x, y, t: 0 });
    if (this.ripples.length > 6) this.ripples.shift();
  }

  // cards
  private cardKey = '';
  private cardL: CardLayout | null = null;
  private cardT: CardText | null = null;
  cardRect: Rect | null = null;

  /** the player's own pictures, by own pair id */
  own: Map<string, OwnPics> = new Map();

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d');
    this.reduced = opts.reducedMotion;
    this.touch = opts.touch;
    this.shake = new Shake(opts.reducedMotion);
    this.L = layout(1, 1);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.touch);
    this.key = '';
    this.wall = null;
    this.cardKey = '';
  }

  /** The aspect the next picture should take (the room's). */
  get aspect(): number { return this.L.aspect; }

  // ── coordinates ────────────────────────────────────────────────
  private get k(): number { return this.frame.w / Math.max(1e-6, this.mw); }
  private mw = 100;

  /** Mosaic units → CSS px. */
  sx(x: number): number { return this.frame.x + x * this.k; }
  sy(y: number): number { return this.frame.y + y * this.k; }
  /** CSS px → mosaic units. */
  toPic(x: number, y: number): Pt { return { x: (x - this.frame.x) / this.k, y: (y - this.frame.y) / this.k }; }
  inFrame(x: number, y: number, slack = 0): boolean {
    const f = this.frame;
    return x >= f.x - slack && x <= f.x + f.w + slack && y >= f.y - slack && y <= f.y + f.h + slack;
  }

  /** Where a coach mark about a tile or the aim points (CSS px). */
  pointAt(sim: RozSim, cell: number | null): { x: number; y: number } {
    const c = sim.pic.mosaic.cells[cell ?? sim.aim];
    return { x: this.sx(c.cx), y: this.sy(c.cy) };
  }

  // ── the picture's canvases ─────────────────────────────────────
  private ensure(sim: RozSim): void {
    const pic = sim.pic;
    const aspect = pic.mosaic.w / pic.mosaic.h;
    const f = frameFor(this.L, aspect);
    const key = `${pic.src.kind}:${pic.src.id}:${pic.ver}:${f.w}x${f.h}@${this.dpr}`;
    if (pic === this.picRef && key === this.key) return;
    const fresh = pic !== this.picRef;
    const refit = !fresh && this.picVer !== pic.ver;
    this.picVer = pic.ver;
    if (fresh && this.after && this.picRef) {
      this.prevAfter = this.after;
      this.prevFrame = this.frame;
    }
    this.picRef = pic;
    this.key = key;
    this.frame = f;
    this.mw = pic.mosaic.w;
    const pw = Math.max(1, Math.round(f.w * this.dpr)), ph = Math.max(1, Math.round(f.h * this.dpr));
    this.before = this.picture(pic.src, pw, ph, false);
    this.after = this.picture(pic.src, pw, ph, true);
    this.layer = this.layer && this.layer.width === pw && this.layer.height === ph ? this.layer : document.createElement('canvas');
    this.layer.width = pw;
    this.layer.height = ph;
    this.lctx = this.layer.getContext('2d');
    this.lctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // the tiles' paths in frame-local CSS px
    const k = f.w / pic.mosaic.w;
    const grout = clamp(k * 0.55, 1.1, 2.4);
    this.full = pic.mosaic.cells.map(c => this.path(c.poly, k));
    this.inset = pic.mosaic.cells.map(c => this.path(insetPoly(c.poly, grout / k), k));
    this.box = pic.mosaic.cells.map(c => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of c.poly) { x0 = Math.min(x0, q.x * k); x1 = Math.max(x1, q.x * k); y0 = Math.min(y0, q.y * k); y1 = Math.max(y1, q.y * k); }
      const x = Math.max(0, Math.floor(x0) - 2), y = Math.max(0, Math.floor(y0) - 2);
      return { x, y, w: Math.min(f.w, Math.ceil(x1) + 2) - x, h: Math.min(f.h, Math.ceil(y1) + 2) - y };
    });
    this.shown = pic.mosaic.cells.map(() => ({ drawn: false, open: false, warm: -1 }));
    if (fresh || refit) this.cracks.clear();
    if (fresh) this.titleT = 0;
    this.groutKey = '';
    this.wall = null;
  }

  /** The grout between dark tiles as one path (it carries the light), rebuilt when a tile opens. */
  private grout(sim: RozSim): void {
    const pic = sim.pic;
    const key = `${pic.ver}|${pic.open}|${this.key}`;
    if (key !== this.groutKey) {
      this.groutKey = key;
      const p = new Path2D();
      for (const e of pic.mosaic.edges) {
        if (e.b < 0) continue;
        if (pic.tiles[e.a].open && pic.tiles[e.b].open) continue;
        p.moveTo(this.sx(e.p.x), this.sy(e.p.y));
        p.lineTo(this.sx(e.q.x), this.sy(e.q.y));
      }
      this.groutPath = p;
      this.aimKey = '';
    }
    const ak = `${key}|${sim.aim}`;
    if (ak !== this.aimKey) {
      this.aimKey = ak;
      const p = new Path2D();
      for (const si of pic.seamsOf[sim.aim] ?? []) {
        const e = pic.seams[si];
        p.moveTo(this.sx(e.p.x), this.sy(e.p.y));
        p.lineTo(this.sx(e.q.x), this.sy(e.q.y));
      }
      this.aimPath = p;
    }
  }

  private path(poly: readonly Pt[], k: number): Path2D {
    const p = new Path2D();
    poly.forEach((q, i) => (i ? p.lineTo(q.x * k, q.y * k) : p.moveTo(q.x * k, q.y * k)));
    p.closePath();
    return p;
  }

  /** A picture's dark or bright state at w × h device px: a painted place, or the player's photo (cover). */
  private picture(src: PicSrc, w: number, h: number, bright: boolean): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    if (src.kind === 'pair') paintScene(ctx, w, h, src.id, bright);
    else {
      const o = this.own.get(src.id);
      const img = o ? (bright ? o.after : o.before) : null;
      if (img) {
        const fit = fitCover(img.width, img.height, w, h);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, fit.sx, fit.sy, fit.sw, fit.sh, 0, 0, w, h);
      } else paintScene(ctx, w, h, 'samotnosc', bright);
    }
    return c;
  }

  /** The wall around the frame and the frame's edge; the vignette over the picture. */
  private bakeWall(): void {
    const w = Math.max(1, Math.round(this.w * this.dpr)), h = Math.max(1, Math.round(this.h * this.dpr));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const f = this.frame;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#0d0f18');
    g.addColorStop(1, '#07080d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    // a faint pattern of old plaster
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,240,220,.025)' : 'rgba(0,0,0,.18)';
      ctx.fillRect(rnd() * this.w, rnd() * this.h, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    // the light behind the picture spills around the frame
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h) * 0.8, '#ffc56a', 0.14);
    ctx.globalCompositeOperation = 'source-over';
    // the frame's edge: a thin gold line in a dark mount
    ctx.fillStyle = '#05060a';
    roundRect(ctx, f.x - 3, f.y - 3, f.w + 6, f.h + 6, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,195,92,.5)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, f.x - 3.5, f.y - 3.5, f.w + 7, f.h + 7, 9);
    ctx.stroke();
    this.wall = c;
    // the vignette over the picture
    const v = document.createElement('canvas');
    v.width = Math.max(1, Math.round(f.w * this.dpr));
    v.height = Math.max(1, Math.round(f.h * this.dpr));
    const vc = v.getContext('2d');
    if (vc) {
      vc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const r = vc.createRadialGradient(f.w / 2, f.h / 2, Math.min(f.w, f.h) * 0.35, f.w / 2, f.h / 2, Math.hypot(f.w, f.h) * 0.58);
      r.addColorStop(0, 'rgba(0,0,0,0)');
      r.addColorStop(1, 'rgba(0,0,0,.34)');
      vc.fillStyle = r;
      vc.fillRect(0, 0, f.w, f.h);
    }
    this.vignette = v;
  }

  /** Bring the cached layer up to the picture's state, a few tiles a frame at most (all of them on a rebuild). */
  private syncLayer(sim: RozSim): void {
    const pic = sim.pic, ctx = this.lctx;
    if (!ctx || !this.before || !this.after) return;
    // assembling: the tiles arrive from the middle outward
    const order = pic.state === 'assemble' ? Math.min(1, pic.stateT / RULES.assembleSec) : 1;
    let budget = this.shown.some(s => s.drawn) ? 10 : 9999;
    for (let i = 0; i < pic.tiles.length && budget > 0; i++) {
      const s = this.shown[i], tile = pic.tiles[i], cell = pic.mosaic.cells[i];
      if (!s.drawn && cell.ring > order * 1.05) continue;
      const warm = tile.open ? Math.round(tile.warm * 8) / 8 : -1;
      if (s.drawn && s.open === tile.open && s.warm === warm) continue;
      const opened = tile.open && !s.open;
      this.drawTile(ctx, i, tile.open, tile.warm);
      s.drawn = true;
      s.open = tile.open;
      s.warm = warm;
      budget--;
      // an uncovered piece heals the edges of its uncovered neighbours
      if (opened) for (const j of cell.neighbors) if (pic.tiles[j].open && this.shown[j].drawn) this.drawTile(ctx, j, true, pic.tiles[j].warm);
    }
  }

  private drawTile(ctx: CanvasRenderingContext2D, i: number, open: boolean, warm: number): void {
    const before = this.before!, after = this.after!;
    const fw = this.frame.w, fh = this.frame.h;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(this.full[i]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clip(open ? this.full[i] : this.inset[i]);
    // only the tile's part of the picture (device px of the source, CSS px of the layer)
    const b = this.box[i], d = this.dpr;
    const src = open ? after : before;
    if (b && b.w > 0 && b.h > 0) ctx.drawImage(src, b.x * d, b.y * d, b.w * d, b.h * d, b.x, b.y, b.w, b.h);
    else ctx.drawImage(src, 0, 0, fw, fh);
    if (open) {
      // a newly uncovered piece is a little pale; calm warms it to its full colour
      const pale = 0.3 * (1 - clamp(warm));
      if (pale > 0.01) {
        ctx.fillStyle = `rgba(232,226,214,${pale.toFixed(3)})`;
        ctx.fill(this.full[i]);
      }
    } else {
      // dark glass: a sheen from the upper left, a darker rim
      const g = ctx.createLinearGradient(0, 0, fw, fh);
      g.addColorStop(0, 'rgba(255,255,255,.07)');
      g.addColorStop(1, 'rgba(0,0,0,.12)');
      ctx.fillStyle = g;
      ctx.fill(this.inset[i]);
      ctx.strokeStyle = 'rgba(190,200,230,.08)';
      ctx.lineWidth = 1.2;
      ctx.stroke(this.inset[i]);
    }
    ctx.restore();
  }

  // ── events ─────────────────────────────────────────────────────
  on(e: SimEvent, sim: RozSim): void {
    const pic = sim.pic;
    switch (e.type) {
      case 'burst': this.burst(sim, e.cell, e.shards, e.depth, e.double); break;
      case 'knock': {
        const x = this.sx(e.x), y = this.sy(e.y);
        if (e.power > 0) {
          this.flashes.push({ x, y, r: 26 + 22 * e.power, t: 0, dur: 0.22, color: '#fff1c0' });
          this.motes.burst(x, y, 4, { color: '#ffe3a0', size: 1.6, speed: 70, life: 0.45, g: 60, drag: 2.5, rnd: () => this.rnd() });
        }
        break;
      }
      case 'crack': {
        if (!this.cracks.has(e.cell)) this.makeCracks(sim, e.cell);
        break;
      }
      case 'flare': {
        this.wave = { x: this.sx(e.x), y: this.sy(e.y), t: 0 };
        this.flashes.push({ x: this.wave.x, y: this.wave.y, r: Math.max(this.frame.w, this.frame.h) * 0.6, t: 0, dur: this.reduced ? 0.6 : 0.4, color: '#fff1c0' });
        this.shake.add(0.5);
        this.stop = 0.08;
        break;
      }
      case 'chain':
        if (e.n >= 2) {
          const c = pic.mosaic.cells[sim.aim];
          this.words.add(t('hud.chain', { n: e.n }), this.sx(c.cx), this.sy(c.cy) - 18, { color: C.honey, size: 20 + Math.min(10, e.n * 1.5), dur: 1.3 });
          if (e.n >= 3) this.shake.add(0.25);
        }
        break;
      case 'gold': {
        const s = pic.seams[e.seam];
        const x = this.sx((s.p.x + s.q.x) / 2), y = this.sy((s.p.y + s.q.y) / 2);
        this.motes.burst(x, y, 5, { color: '#ffd76a', size: 1.5, speed: 40, life: 0.8, g: -30, drag: 2, rnd: () => this.rnd() });
        break;
      }
      case 'gild': {
        const c = pic.mosaic.cells[e.cell];
        this.flashes.push({ x: this.sx(c.cx), y: this.sy(c.cy), r: 40, t: 0, dur: 0.5, color: '#ffd76a' });
        break;
      }
      case 'reserve':
        this.flashes.push({ x: this.frame.x + this.frame.w / 2, y: this.frame.y + this.frame.h / 2, r: Math.max(this.frame.w, this.frame.h) * 0.5, t: 0, dur: 0.7, color: '#ffd98a' });
        break;
      case 'reveal':
        this.reveal = 1;
        break;
      case 'done':
        this.shake.add(0.2);
        for (let i = 0; i < 40; i++) {
          const x = this.frame.x + this.rnd() * this.frame.w, y = this.frame.y + this.frame.h * (0.3 + this.rnd() * 0.7);
          this.motes.burst(x, y, 1, { color: '#ffe6a8', size: 2, speed: 30, angle: -Math.PI / 2, spread: 1, life: 2.2, g: -40, drag: 0.5, rnd: () => this.rnd() });
        }
        break;
      default: break;
    }
  }

  private rnd(): number {
    this.rngS = (this.rngS * 16807) % 2147483647;
    return this.rngS / 2147483647;
  }

  private makeCracks(sim: RozSim, i: number): void {
    const tile = sim.pic.tiles[i], cell = sim.pic.mosaic.cells[i];
    const from = tile.from ?? { x: cell.cx, y: cell.cy };
    const n = clamp(Math.round(4 + Math.sqrt(cell.area) / (sim.pic.meanR * 0.9)), 4, 8);
    this.cracks.set(i, crackLines(cell, from, n, () => this.rnd()));
  }

  /** A burst: the tile's pieces fly as sprites of the dark picture, a flash, motes, the number. */
  private burst(sim: RozSim, i: number, shards: number, depth: number, double: boolean): void {
    const pic = sim.pic, cell = pic.mosaic.cells[i];
    const cx = this.sx(cell.cx), cy = this.sy(cell.cy);
    const tileR = Math.sqrt(cell.area / Math.PI) * this.k;
    this.flashes.push({ x: cx, y: cy, r: tileR * (this.reduced ? 1.8 : 2.6), t: 0, dur: this.reduced ? 0.45 : 0.28, color: PAIRS[pic.src.kind === 'pair' ? pic.src.id : 'samotnosc'].light });
    if (depth >= 2) this.stop = Math.max(this.stop, 0.05);
    if (!this.reduced) this.shake.add(Math.min(0.22, 0.06 + depth * 0.04));
    this.cracks.delete(i);
    const k = clamp(Math.round(4 + shards / 3), 4, 9);
    const pieces = shardPolys(cell, k, () => this.rnd());
    for (const poly of pieces) this.spawnShard(poly, cell, tileR);
    this.motes.burst(cx, cy, this.reduced ? 6 : 14, { color: '#ffe3a0', size: 2, speed: 120, life: 0.9, g: -20, drag: 1.6, rnd: () => this.rnd() });
    this.words.add(`+${shards}`, cx, cy - 6, { color: double ? C.goldHi : C.honey, size: 21 + Math.min(9, depth * 2), dur: 1.1 });
    if (double) this.words.add(t('hud.double'), cx + 26, cy - 24, { color: C.gold, size: 15, dur: 0.9 });
  }

  private spawnShard(poly: Pt[], cell: MosaicCell, tileR: number): void {
    if (this.shards.length >= SHARD_CAP || !this.before) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, ax = 0, ay = 0;
    for (const p of poly) {
      const x = p.x * this.k, y = p.y * this.k;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      ax += x; ay += y;
    }
    ax /= poly.length;
    ay /= poly.length;
    const sw = Math.max(2, maxX - minX + 2), sh = Math.max(2, maxY - minY + 2);
    const sprite = this.pool.pop() ?? document.createElement('canvas');
    sprite.width = Math.ceil(sw * this.dpr);
    sprite.height = Math.ceil(sh * this.dpr);
    const c = sprite.getContext('2d');
    if (!c) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.translate(-minX + 1, -minY + 1);
    c.beginPath();
    poly.forEach((p, j) => (j ? c.lineTo(p.x * this.k, p.y * this.k) : c.moveTo(p.x * this.k, p.y * this.k)));
    c.closePath();
    c.save();
    c.clip();
    const d = this.dpr, bx = Math.max(0, minX - 1), by = Math.max(0, minY - 1);
    const bw = Math.min(this.frame.w - bx, sw), bh = Math.min(this.frame.h - by, sh);
    if (bw > 0 && bh > 0) c.drawImage(this.before, bx * d, by * d, bw * d, bh * d, bx, by, bw, bh);
    c.restore();
    // lit from behind: a bright rim
    c.strokeStyle = 'rgba(255,236,190,.85)';
    c.lineWidth = 1.2;
    c.stroke();
    const dx = ax - cell.cx * this.k, dy = ay - cell.cy * this.k;
    const len = Math.hypot(dx, dy) || 1;
    const sp = (this.reduced ? 70 : 150) + this.rnd() * (this.reduced ? 40 : 140);
    this.shards.push({
      sprite, ox: minX - 1 - ax, oy: minY - 1 - ay, sw, sh,
      x: this.frame.x + ax, y: this.frame.y + ay, vx: (dx / len) * sp, vy: (dy / len) * sp - 90 - this.rnd() * 60,
      rot: 0, vr: (this.rnd() - 0.5) * (this.reduced ? 3 : 9), t: 0, life: 0.75 + this.rnd() * 0.3 + Math.min(0.3, tileR / 400), motes: false,
    });
  }

  // ── a frame ────────────────────────────────────────────────────
  update(dt: number, sim: RozSim): void {
    this.clock += dt;
    this.titleT += dt;
    this.reveal = Math.max(0, this.reveal - dt * 0.6);
    const still = this.stop > 0;
    this.stop = Math.max(0, this.stop - dt);
    const w = still ? dt * 0.15 : dt;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.t += w;
      s.vy += 520 * w;
      s.vx *= Math.exp(-0.8 * w);
      s.x += s.vx * w;
      s.y += s.vy * w;
      s.rot += s.vr * w;
      if (!s.motes && s.t > s.life * 0.6) {
        s.motes = true;
        this.motes.burst(s.x, s.y, 3, { color: '#ffd98a', size: 1.6, speed: 30, life: 0.9, g: -50, drag: 1.5, rnd: () => this.rnd() });
      }
      if (s.t >= s.life) {
        this.pool.push(s.sprite);
        this.shards.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) if ((this.flashes[i].t += dt) >= this.flashes[i].dur) this.flashes.splice(i, 1);
    for (let i = this.ripples.length - 1; i >= 0; i--) if ((this.ripples[i].t += dt) >= 0.35) this.ripples.splice(i, 1);
    if (this.wave && (this.wave.t += dt) > 0.9) this.wave = null;
    this.motes.update(w);
    this.words.update(dt);
    // the motes of a blooming picture keep rising
    if (sim.pic.state === 'bloom' && this.rnd() < dt * 18) {
      const f = this.frame;
      this.motes.burst(f.x + this.rnd() * f.w, f.y + f.h * (0.4 + this.rnd() * 0.6), 1, { color: '#ffe6a8', size: 1.8, speed: 25, angle: -Math.PI / 2, spread: 0.8, life: 2, g: -35, drag: 0.4, rnd: () => this.rnd() });
    }
  }

  draw(sim: RozSim): void {
    const ctx = this.ctx;
    if (!ctx || !sim.started) return;
    this.ensure(sim);
    if (!this.wall) this.bakeWall();
    this.syncLayer(sim);
    const f = this.frame, pic = sim.pic;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.wall) ctx.drawImage(this.wall, 0, 0, this.w, this.h);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    ctx.save();
    roundRect(ctx, f.x, f.y, f.w, f.h, 6);
    ctx.clip();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(f.x, f.y, f.w, f.h);
    this.drawLight(ctx, sim);
    // the previous picture fades out while the new mosaic assembles over the dark
    if (this.prevAfter && pic.state === 'assemble') {
      const a = 1 - clamp(pic.stateT / 0.6);
      if (a > 0) {
        ctx.globalAlpha = a;
        const pf = this.prevFrame ?? f;
        ctx.drawImage(this.prevAfter, pf.x, pf.y, pf.w, pf.h);
        ctx.globalAlpha = 1;
      } else this.prevAfter = null;
    } else if (pic.state !== 'assemble') this.prevAfter = null;
    if (this.layer) ctx.drawImage(this.layer, f.x, f.y, f.w, f.h);
    this.drawGrout(ctx, sim);
    this.drawPressure(ctx, sim);
    this.drawGold(ctx, sim);
    this.drawBloom(ctx, sim);
    if (this.vignette) ctx.drawImage(this.vignette, f.x, f.y, f.w, f.h);
    this.drawAim(ctx, sim);
    ctx.restore();
    // the flashes, then the shards flying out over the frame's edge, then the motes
    ctx.globalCompositeOperation = 'lighter';
    const cap = Math.min(f.w, f.h) * 0.32;
    for (const fl of this.flashes) {
      const k = fl.t / fl.dur;
      glow(ctx, fl.x, fl.y, Math.min(fl.r, cap * (fl.r > cap * 1.5 ? 2.2 : 1)) * (0.7 + 0.5 * ease.outCubic(k)), fl.color, (1 - k) * (1 - k) * (this.reduced ? 0.45 : 0.85));
    }
    ctx.globalCompositeOperation = 'source-over';
    this.drawShards(ctx);
    ctx.globalCompositeOperation = 'lighter';
    this.motes.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    this.words.draw(ctx, `800 ${SANS}`);
    this.drawTitle(ctx, sim);
    this.drawFly(ctx, sim);
    this.drawLens(ctx);
    this.drawCard(ctx, sim);
  }

  /** The light behind the mosaic: everywhere as strong as the band's light, the halo at the aim, the flare's wave. */
  private drawLight(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const f = this.frame, pic = sim.pic;
    const on = sim.lightOn, l = on ? sim.light : 0;
    const gazing = sim.restBlock;
    ctx.globalCompositeOperation = 'lighter';
    const breathe = 0.5 + 0.5 * Math.sin(this.clock * 1.3);
    const base = gazing ? 0.16 : 0.2 + 0.4 * l + (sim.blind ? 0 : 0.04 * breathe);
    glow(ctx, f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h) * 0.85, '#ffb85a', base);
    if (pic.state === 'play' || pic.state === 'assemble' || pic.state === 'finishing') {
      const c = pic.mosaic.cells[sim.aim];
      const x = this.sx(c.cx), y = this.sy(c.cy);
      const r = sim.haloR * this.k;
      glow(ctx, x, y, r * 1.6, l >= 0.5 ? '#ffd98a' : '#ffe8c0', 0.75 + 0.25 * l);
      glow(ctx, x, y, r * 0.7, '#fff6d8', 0.5 + 0.4 * l);
    }
    if (this.reveal > 0) glow(ctx, f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h), '#fff1c0', this.reveal * 0.5);
    if (this.wave) {
      const k = this.wave.t / 0.9;
      const R = RULES.flareReach * pic.meanR * this.k * (0.2 + 0.9 * ease.outCubic(k));
      ctx.strokeStyle = `rgba(255,236,180,${(0.9 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 14 * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(this.wave.x, this.wave.y, R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * The light seeping through the grout: the whole network glimmers (more with the band's light in a push,
   * less while gazing, the base only in a blind push), the aimed tile's edges burn brightest.
   */
  private drawGrout(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const pic = sim.pic;
    if (pic.state === 'bloom') return;
    this.grout(sim);
    if (!this.groutPath) return;
    const l = sim.lightOn ? sim.light : 0;
    const breathe = 0.5 + 0.5 * Math.sin(this.clock * 1.2);
    const A = sim.restBlock ? 0.2 + 0.05 * breathe : 0.26 + 0.5 * l + 0.05 * breathe;
    // white-warm light, never gold: gold is the kintsugi of the gazing blocks
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,214,150,${(0.16 * A).toFixed(3)})`;
    ctx.lineWidth = 5;
    ctx.stroke(this.groutPath);
    ctx.strokeStyle = `rgba(255,246,228,${(0.5 * A).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke(this.groutPath);
    if (this.aimPath && (pic.state === 'play' || pic.state === 'assemble') && !sim.restBlock) {
      const B = 0.45 + 0.45 * l;
      ctx.strokeStyle = `rgba(255,226,170,${(0.22 * B).toFixed(3)})`;
      ctx.lineWidth = 6;
      ctx.stroke(this.aimPath);
      ctx.strokeStyle = `rgba(255,250,236,${(0.7 * B).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke(this.aimPath);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Pressed tiles glow from behind and crack: the kit's crack lines, a growing share of each. */
  private drawPressure(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const pic = sim.pic;
    const wide = new Path2D(), core = new Path2D();
    let any = false;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pic.tiles.length; i++) {
      const tile = pic.tiles[i];
      if (tile.open || tile.press < 0.04 || !this.shown[i]?.drawn) continue;
      const cell = pic.mosaic.cells[i];
      const p = Math.min(1, tile.press);
      const x = this.sx(cell.cx), y = this.sy(cell.cy);
      const r = Math.sqrt(cell.area / Math.PI) * this.k;
      const quiver = p > 0.85 ? 0.5 + 0.5 * Math.sin(this.clock * 28 + i) : 0;
      glow(ctx, x, y, r * (0.9 + 0.5 * p), '#ffc86e', 0.1 + 0.32 * p * p + 0.12 * quiver + 0.4 * tile.knock);
      if (p < 0.1) continue;
      let lines = this.cracks.get(i);
      if (!lines) {
        this.makeCracks(sim, i);
        lines = this.cracks.get(i)!;
      }
      const share = clamp((p - 0.08) / 0.85) ** 0.8;
      for (const ln of lines) {
        let total = 0;
        for (let j = 1; j < ln.length; j++) total += Math.hypot(ln[j].x - ln[j - 1].x, ln[j].y - ln[j - 1].y);
        let left = total * share;
        for (const P of [wide, core]) P.moveTo(this.sx(ln[0].x), this.sy(ln[0].y));
        for (let j = 1; j < ln.length && left > 0; j++) {
          const a = ln[j - 1], b = ln[j];
          const seg = Math.hypot(b.x - a.x, b.y - a.y);
          const q = seg > left ? left / seg : 1;
          const x2 = this.sx(a.x + (b.x - a.x) * q), y2 = this.sy(a.y + (b.y - a.y) * q);
          wide.lineTo(x2, y2);
          core.lineTo(x2, y2);
          left -= seg;
        }
      }
      any = true;
    }
    if (any) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,176,80,.3)';
      ctx.lineWidth = 2.8;
      ctx.stroke(wide);
      ctx.strokeStyle = 'rgba(255,244,214,.82)';
      ctx.lineWidth = 0.9;
      ctx.stroke(core);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Kintsugi: gold in the seams of the uncovered pieces, wider and brighter as it fills, a slow shimmer along it. */
  private drawGold(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const pic = sim.pic;
    const B = 4;
    const buckets: Path2D[] = Array.from({ length: B }, () => new Path2D());
    const used = new Array<boolean>(B).fill(false);
    for (const s of pic.seams) {
      if (s.gold < 0.03) continue;
      const b = Math.min(B - 1, Math.floor(s.gold * B));
      // gold creeps along the seam from one end as it fills
      const g = Math.min(1, s.gold * 1.15);
      const x1 = s.p.x + (s.q.x - s.p.x) * g, y1 = s.p.y + (s.q.y - s.p.y) * g;
      buckets[b].moveTo(this.sx(s.p.x), this.sy(s.p.y));
      buckets[b].lineTo(this.sx(x1), this.sy(y1));
      used[b] = true;
    }
    ctx.lineCap = 'round';
    const shimmer = 0.85 + 0.15 * Math.sin(this.clock * 2.2);
    // the gold's own glow first (added light), then the metal: a dark bed, the bright gold on it
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 1; b < B; b++) {
      if (!used[b]) continue;
      const k = (b + 1) / B;
      ctx.strokeStyle = `rgba(255,190,80,${(0.16 * k * shimmer).toFixed(3)})`;
      ctx.lineWidth = 5 + 3 * k;
      ctx.stroke(buckets[b]);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let b = 0; b < B; b++) {
      if (!used[b]) continue;
      const k = (b + 1) / B;
      ctx.strokeStyle = `rgba(150,96,24,${(0.7 * k).toFixed(3)})`;
      ctx.lineWidth = 1.6 + 2.2 * k;
      ctx.stroke(buckets[b]);
      ctx.strokeStyle = `rgba(255,${200 + Math.round(30 * k)},${90 + Math.round(40 * k)},${(0.55 + 0.4 * k * shimmer).toFixed(3)})`;
      ctx.lineWidth = 0.9 + 1.3 * k;
      ctx.stroke(buckets[b]);
    }
  }

  /** A transformed picture blooms: its own light added over it, fading. */
  private drawBloom(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const pic = sim.pic;
    if (pic.state !== 'bloom' || !this.after) return;
    const k = clamp(pic.stateT / RULES.bloomSec);
    // a quick swell of the picture's own light, then a long soft fade
    const swell = k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85) ** 2;
    const f = this.frame;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28 * swell * (this.reduced ? 0.6 : 1);
    ctx.drawImage(this.after, f.x, f.y, f.w, f.h);
    ctx.globalAlpha = 1;
    glow(ctx, f.x + f.w / 2, f.y + f.h * 0.42, Math.max(f.w, f.h) * 0.6, PAIRS[pic.src.kind === 'pair' ? pic.src.id : 'samotnosc'].light, 0.22 * swell);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** The aimed tile's edge, the halo's rim (its radius is the light) and the dotted threshold ring. */
  private drawAim(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const pic = sim.pic;
    if (pic.state !== 'play' && pic.state !== 'assemble') return;
    const c = pic.mosaic.cells[sim.aim];
    const x = this.sx(c.cx), y = this.sy(c.cy);
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 4);
    ctx.save();
    ctx.translate(this.frame.x, this.frame.y);
    ctx.strokeStyle = `rgba(255,236,196,${(0.25 + 0.25 * pulse).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    if (this.inset[sim.aim]) ctx.stroke(this.inset[sim.aim]);
    ctx.restore();
    // the in-world gauge, around the aimed tile: the gold rim is the light, the dotted ring the threshold —
    // only where the band acts (a push block), never in a blind one
    if (!sim.pushBlock || sim.blind) return;
    const tileR = Math.sqrt(c.area / Math.PI) * this.k;
    const ring = (l: number) => Math.min(tileR, 90) * (0.55 + 0.9 * clamp(l));
    const thr = ring(0.5);
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(255,230,170,.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, thr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (sim.lightOn) {
      const r = ring(sim.light);
      const above = sim.light >= 0.5;
      ctx.strokeStyle = above ? `rgba(246,195,92,${(0.7 + 0.2 * pulse).toFixed(3)})` : 'rgba(220,226,240,.45)';
      ctx.lineWidth = above ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawShards(ctx: CanvasRenderingContext2D): void {
    for (const s of this.shards) {
      const k = s.t / s.life;
      const a = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      const sc = 1 - 0.35 * Math.max(0, k - 0.4);
      ctx.scale(sc, sc);
      ctx.drawImage(s.sprite, s.ox, s.oy, s.sw, s.sh);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** The place's name when a picture begins (out of the banner's way), on a dark plate at the frame's top. */
  private drawTitle(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const tt = this.titleT;
    if (tt > 4.5 || sim.story || sim.bannerUp) return;
    const a = tt < 0.6 ? tt / 0.6 : tt > 3.6 ? Math.max(0, (4.5 - tt) / 0.9) : 1;
    const pic = sim.pic;
    const name = pic.src.kind === 'pair' ? pairTitle(pic.src.id) : this.own.get(pic.src.id)?.label || t('hud.own');
    const f = this.frame, u = this.L.u;
    const size = Math.max(15, 18 * u);
    ctx.font = font(size, 600, SERIF);
    const tw = Math.min(f.w - 24, ctx.measureText(name).width + 28);
    const x = f.x + f.w / 2, y = f.y + 12 * u;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,10,16,.72)';
    roundRect(ctx, x - tw / 2, y, tw, size + 14, (size + 14) / 2);
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, y + (size + 14) / 2 + 1, tw - 20);
    if (pic.day) {
      ctx.font = font(13 * u, 700);
      ctx.fillStyle = C.gold;
      ctx.fillText(t('hud.day'), x, y + size + 26 * u);
    }
    ctx.globalAlpha = 1;
  }

  private drawFly(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const f = this.frame, u = this.L.u;
    const spot = flySpot(this.L, f);
    const br = sim.breath();
    const glowK = br ? (br.inhale ? ease.inOutSine(br.k) : 1 - ease.inOutSine(br.k)) : 0.5 + 0.2 * Math.sin(this.clock * 1.6);
    const wander = this.reduced ? 0 : Math.sin(this.clock * 0.5) * 6 * u;
    const x = spot.x + wander, y = spot.y + Math.cos(this.clock * 0.37) * 3 * u;
    paintFly(ctx, x, y, spot.r, { t: this.clock, glow: glowK, charge: sim.flare, ready: sim.flareReady, talk: !!sim.talk.line, dim: sim.blind });
    // the breath guide's word under the firefly
    if (br && !sim.story) {
      ctx.font = font(13 * u, 600);
      ctx.textAlign = spot.outside ? 'center' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(8,10,16,.6)';
      const word = br.inhale ? t('hud.breathIn') : t('hud.breathOut');
      const wx = spot.outside ? x : x + spot.r * 2.8, wy = spot.outside ? y + spot.r * 3.4 : y;
      const ww = ctx.measureText(word).width;
      roundRect(ctx, spot.outside ? wx - ww / 2 - 8 : wx - 8, wy - 11, ww + 16, 22, 11);
      ctx.fill();
      ctx.fillStyle = br.inhale ? '#e9f7c0' : '#c9d6f0';
      ctx.fillText(word, wx, wy + 1);
    }
    // its bubble
    const line = sim.talk.line;
    if (line && !sim.story) {
      const a = Math.min(1, line.t / 0.2, (line.dur - line.t) / 0.3);
      const bounds = this.L.shape === 'wide' ? { x: this.L.left + 8, y: this.L.top + 6, w: this.L.right - this.L.left - 16, h: this.L.bottom - this.L.top - 12 } : f;
      const b = bubbleBox(ctx, line.text, x, y - spot.r * 1.6, spot.bubbleW, bounds, u);
      paintBubble(ctx, b, x, y - spot.r, a, u);
    }
  }

  private drawLens(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      const k = r.t / 0.35;
      ctx.strokeStyle = `rgba(255,240,205,${(0.8 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + 22 * ease.outCubic(k), 0, Math.PI * 2);
      ctx.stroke();
    }
    const l = this.lens;
    if (!l) return;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, l.x, l.y, 30, '#ffe6a8', 0.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,240,200,.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    if (this.touch) {
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(l.x, l.y + 16);
      ctx.lineTo(l.fx, l.fy - 22);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── cards ──────────────────────────────────────────────────────
  private drawCard(ctx: CanvasRenderingContext2D, sim: RozSim): void {
    const st = sim.story;
    if (!st) {
      this.cardRect = null;
      return;
    }
    const box = cardBox(this.L, this.frame, st.kind);
    const title = st.kind === 'open' ? t('card.open.title')
      : st.src?.kind === 'pair' ? pairTitle(st.src.id) : (st.src ? this.own.get(st.src.id)?.label : '') || t('hud.own');
    const kicker = st.kind === 'open' ? t('name.firefly') : st.src?.kind === 'own' ? t('card.own') : t('card.done');
    const text = st.kind === 'open' ? t('card.open.text') : st.gold >= 5 ? t('card.gold', { pct: pct(st.gold) }) : null;
    const hint = this.touch ? t('card.tap') : t('card.click');
    const key = `${st.kind}|${title}|${text}|${st.verse}|${box.x},${box.y},${box.w},${box.h}`;
    if (key !== this.cardKey) {
      this.cardKey = key;
      this.cardT = { kicker, title, text, verse: st.verse as PassageId, hint };
      this.cardL = cardLayout(ctx, box, this.cardT, this.L.u);
    }
    const a = Math.min(1, st.t / 0.35, (st.dur - st.t) / 0.4);
    if (this.cardL && this.cardT) paintCard(ctx, this.cardL, this.cardT, a, this.L.u);
    this.cardRect = box;
  }
}
