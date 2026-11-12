/**
 * Ja jestem…'s play view (DESIGN §13.8): a chapel wall in the dusk and the window in it.  The window is
 * drawn from layers baked when they change — never per frame:
 *
 *   the picture   the vision at the window's size (a declaration repainted crisp, a photo cropped)
 *   the paper     its pencil sketch on warm paper (what is not coloured yet)
 *   the glass     the lit cells: the picture in each, with a bevel of light like a real pane
 *   the glow      each lit cell's own light (calm makes it grow), added on top
 *   the leading   dark lead between the cells; gold where the light has come; gone inside a whole fragment
 *
 * Per frame only what moves: the watercolour bloom in the cell being filled, the stream from the oculus
 * (the gauge: its width is the band's level), flashes, sparkles and motes, the aura behind the window
 * (its halo, the rings of the rests, the rays of the pushes), the night's veil, captions, Hanna's bubble,
 * the opening card and the finale's writing.  Everything bright is drawn with baked sprites.
 */
import { Particles, clamp, ease } from '../kit/juice';
import { layoutPassage, drawPassage, passage, type PassageLayout } from '../kit/scripture';
import type { RGB } from './art';
import { DECLS, OWN_AURA, fragName, sentence } from './content';
import { t } from './i18n';
import { formButtons, layout, windowAt, type Layout, type Rect } from './layout';
import {
  GOLD, LEAD, PAPER, TAU, blit, fitFont, font, fontPx, glowSprite, paintBubble, paintOculus, raySprite, roundRect, windowPath, wrap,
} from './paint';
import { paintPicture } from './pictures';
import type { Prepared } from './prep';
import { RULES } from './rules';
import type { JestemSim, SimEvent } from './sim';
import type { Insets } from '../kit/types';

const rgbS = (c: RGB): string => `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
const smooth = (x: number, a: number, b: number): number => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

interface Flash { cell: number; t: number; dur: number; gold: boolean }
interface Caption { text: string; x: number; y: number; t: number; dur: number; big: boolean }
interface Ripple { x: number; y: number; t: number }

export class JestemView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private vis: Prepared | null = null;
  private word = '';
  private aura: RGB = OWN_AURA;
  private ray: RGB = [255, 226, 150];
  /** each cell's path in window-local px at the layout's scale */
  private paths: Path2D[] = [];
  private outer: number[] = [];
  private pic: HTMLCanvasElement | null = null;
  private paper: HTMLCanvasElement | null = null;
  private glass: HTMLCanvasElement | null = null;
  private glowL: HTMLCanvasElement | null = null;
  private lead: HTMLCanvasElement | null = null;
  private bg: HTMLCanvasElement | null = null;
  private inGlass: boolean[] = [];
  /** what each cell was baked as (0 not yet, 1 its colour, 2 grace's light): a resize bakes the glass again from it */
  private baked: number[] = [];
  private leadDirty = true;
  private glowAt = 0;
  private glowSum = -1;
  private readonly parts = new Particles(320);
  private readonly motes = new Particles(60);
  private flashes: Flash[] = [];
  private captions: Caption[] = [];
  private ripples: Ripple[] = [];
  /** cells the dawn lights, shown one by one */
  private dawnQueue: { cell: number; at: number }[] = [];
  private hidden = new Set<number>();
  private clock = 0;
  /** the night's veil (0..1) and the dawn's warm wash */
  private night = 0;
  private dawn = 0;
  private fin = -1;
  private finText: { a: string; b: string; size: number; sizeB: number; pass: PassageLayout | null; key: string } | null = null;
  /** the path a drag is laying (cells, in order) */
  drag: number[] = [];
  /** the card's box as drawn (the hit test reads it) */
  cardBox: Rect | null = null;
  pressed: 0 | 1 | -1 = -1;

  constructor(readonly canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(1, 1);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, ins);
    this.bg = null;
    this.finText = null;
    this.cardBox = null;
    if (this.vis) this.build();
  }

  /** The prepared vision: its word, its aura's colours; the layers are baked now. */
  setVision(p: Prepared, word: string): void {
    this.vis = p;
    this.word = word;
    const d = p.decl ? DECLS[p.decl] : null;
    this.aura = d ? d.aura : OWN_AURA;
    this.ray = d ? d.ray : [255, 226, 150];
    this.baked = p.geo.cells.map(() => 0);
    this.build();
  }

  get ready(): boolean { return !!this.vis; }

  // ── the layers ──────────────────────────────────────────────────
  private layer(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.L.win.w * this.dpr));
    c.height = Math.max(1, Math.round(this.L.win.h * this.dpr));
    return c;
  }

  private build(): void {
    const v = this.vis!, L = this.L;
    const k = L.k;
    this.paths = v.geo.cells.map(c => {
      const p = new Path2D();
      c.poly.forEach((q, i) => (i ? p.lineTo(q.x * k, q.y * k) : p.moveTo(q.x * k, q.y * k)));
      p.closePath();
      return p;
    });
    this.outer = v.geo.cells.map(c => Math.max(...c.poly.map(q => Math.hypot(q.x - c.cx, q.y - c.cy))) * k);
    // the picture, crisp at this size
    this.pic = this.layer();
    const pc = this.pic.getContext('2d')!;
    if (v.decl) paintPicture(v.decl, pc, this.pic.width, this.pic.height);
    else if (v.photo && v.crop) {
      pc.imageSmoothingQuality = 'high';
      pc.drawImage(v.photo, v.crop.sx, v.crop.sy, v.crop.sw, v.crop.sh, 0, 0, this.pic.width, this.pic.height);
    } else pc.drawImage(v.picture, 0, 0, this.pic.width, this.pic.height);
    // the paper: the sketch, warmed toward the edges
    this.paper = this.layer();
    const pp = this.paper.getContext('2d')!;
    pp.imageSmoothingQuality = 'high';
    pp.drawImage(v.sketch, 0, 0, this.paper.width, this.paper.height);
    const vg = pp.createRadialGradient(this.paper.width / 2, this.paper.height * 0.45, this.paper.width * 0.2, this.paper.width / 2, this.paper.height * 0.5, this.paper.height * 0.75);
    vg.addColorStop(0, 'rgba(255,248,230,0)');
    vg.addColorStop(1, 'rgba(150,110,80,0.22)');
    pp.fillStyle = vg;
    pp.fillRect(0, 0, this.paper.width, this.paper.height);
    // each cell a pane of frosted glass: a breath of its future colour and a bevel of light
    pp.save();
    pp.scale(this.dpr, this.dpr);
    v.geo.cells.forEach((c, i) => {
      const col = v.colors[i];
      const path = this.paths[i], r = this.outer[i];
      if (col) {
        pp.fillStyle = `rgba(${col.r | 0},${col.g | 0},${col.b | 0},0.1)`;
        pp.fill(path);
      }
      const lg = pp.createLinearGradient(c.cx * k - r, c.cy * k - r, c.cx * k + r, c.cy * k + r);
      lg.addColorStop(0, 'rgba(255,255,255,0.28)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0)');
      lg.addColorStop(1, 'rgba(90,60,40,0.1)');
      pp.fillStyle = lg;
      pp.fill(path);
    });
    pp.restore();
    this.glass = this.layer();
    this.glowL = this.layer();
    this.lead = this.layer();
    this.inGlass = v.geo.cells.map(() => false);
    // a new size: the glass is baked again from what was lit (a phone turned on its side keeps its window)
    this.baked.forEach((b, id) => { if (b) this.toGlass(id, b === 2); });
    this.leadDirty = true;
    this.glowSum = -1;
  }

  /** Bake a lit cell into the glass: the picture in it, a pane's bevel of light; grace's cells as a light wash. */
  private toGlass(id: number, grace: boolean): void {
    const g = this.glass?.getContext('2d');
    if (!g || !this.pic) return;
    const s = this.dpr, path = this.paths[id];
    g.save();
    g.scale(s, s);
    g.clip(path);
    if (grace) {
      // grace: the picture's colours nearly whole, touched with gold light — the vision ends complete
      // and beautiful; the headline still counts only the player's own pieces
      g.globalAlpha = 0.9;
      g.drawImage(this.pic, 0, 0, this.L.win.w, this.L.win.h);
      g.globalAlpha = 0.12;
      g.fillStyle = GOLD;
      g.fill(path);
    } else {
      g.drawImage(this.pic, 0, 0, this.L.win.w, this.L.win.h);
    }
    // a pane's bevel: light from the upper left, a shade to the lower right
    const c = this.vis!.geo.cells[id], k = this.L.k, r = this.outer[id];
    const lg = g.createLinearGradient(c.cx * k - r, c.cy * k - r, c.cx * k + r, c.cy * k + r);
    lg.addColorStop(0, 'rgba(255,255,255,0.2)');
    lg.addColorStop(0.45, 'rgba(255,255,255,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.14)');
    g.globalAlpha = 1;
    g.fillStyle = lg;
    g.fill(path);
    g.restore();
    this.inGlass[id] = true;
    this.baked[id] = grace ? 2 : 1;
    this.leadDirty = true;
    this.glowSum = -1;
  }

  /** The leading: dark lead between unlit cells, gold-touched where light has come, faded inside a whole fragment. */
  private bakeLead(sim: JestemSim): void {
    const g = this.lead?.getContext('2d');
    const v = this.vis;
    if (!g || !v) return;
    const s = this.dpr, k = this.L.k, u = this.L.u;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.lead!.width, this.lead!.height);
    g.setTransform(s, 0, 0, s, 0, 0);
    g.lineCap = 'round';
    const base = Math.max(1.8, 2.6 * k * (RULES.PW / 320)) * Math.min(1.25, u);
    const shown = (id: number) => this.inGlass[id];
    for (const e of v.geo.edges) {
      const a = shown(e.a), b = e.b >= 0 ? shown(e.b) : false;
      const sameDone = e.b >= 0 && a && b && v.geo.cells[e.a].frag === v.geo.cells[e.b].frag && sim.fragDone[v.geo.cells[e.a].frag];
      g.beginPath();
      g.moveTo(e.p.x * k, e.p.y * k);
      g.lineTo(e.q.x * k, e.q.y * k);
      if (sameDone) {
        // one pane: the lead between two cells of a whole fragment fades to a thread of gold
        g.strokeStyle = 'rgba(246,212,136,0.22)';
        g.lineWidth = base * 0.4;
        g.stroke();
        continue;
      }
      if (a && b) {
        // two lit neighbours become one pane: the lead between them thins to a fine line of gold
        g.strokeStyle = 'rgba(58,40,28,0.7)';
        g.lineWidth = base * 0.5;
        g.stroke();
        g.strokeStyle = 'rgba(246,212,136,0.8)';
        g.lineWidth = base * 0.24;
        g.stroke();
        continue;
      }
      g.strokeStyle = LEAD;
      g.lineWidth = base;
      g.stroke();
      if (a || b) {
        g.strokeStyle = 'rgba(246,212,136,0.5)';
        g.lineWidth = base * 0.38;
        g.stroke();
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.1)';
        g.lineWidth = base * 0.25;
        g.stroke();
      }
    }
    this.leadDirty = false;
  }

  /** The glow: each lit cell filled with its own light, as strong as its glow. */
  private bakeGlow(sim: JestemSim): void {
    const g = this.glowL?.getContext('2d');
    const v = this.vis;
    if (!g || !v) return;
    const s = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.glowL!.width, this.glowL!.height);
    g.setTransform(s, 0, 0, s, 0, 0);
    v.geo.cells.forEach((_c, i) => {
      if (!this.inGlass[i]) return;
      const col = v.colors[i] ?? { r: 255, g: 240, b: 200 };
      const gl = clamp(sim.glow[i] ?? 0);
      g.fillStyle = `rgba(${(col.r + 255 * 1.2) / 2.2 | 0},${(col.g + 255 * 1.1) / 2.1 | 0},${(col.b + 220) / 2 | 0},${0.06 + 0.3 * gl})`;
      g.fill(this.paths[i]);
    });
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: SimEvent): void {
    const v = this.vis;
    switch (e.type) {
      case 'lit': {
        if (!v) break;
        if (e.by === 'dawn') {
          // the dawn shows them one by one
          this.hidden.add(e.cell);
          const last = this.dawnQueue.length ? this.dawnQueue[this.dawnQueue.length - 1].at : this.clock + 0.6;
          this.dawnQueue.push({ cell: e.cell, at: last + 0.14 });
          break;
        }
        this.toGlass(e.cell, e.by === 'grace');
        this.flash(e.cell, e.by !== 'grace');
        if (e.by !== 'grace') this.burst(e.cell, 14);
        break;
      }
      case 'fragment': {
        if (!v) break;
        const f = v.geo.frags[e.frag];
        const n = v.geo.frags.length;
        this.caption(fragName(f.key, e.frag + 1, n), f.cx, f.cy, true);
        for (const id of f.cells) this.flashes.push({ cell: id, t: -0.05 * Math.random(), dur: 1.1, gold: true });
        this.leadDirty = true;
        break;
      }
      case 'complete':
        this.captionCenter(t('cap.complete'));
        if (v) for (const c of v.geo.cells) this.flashes.push({ cell: c.id, t: -c.heartD / 600, dur: 1.4, gold: true });
        break;
      case 'splash': {
        if (!v) break;
        const c = v.geo.cells[e.cell];
        this.parts.burst(this.L.win.x + c.cx * this.L.k, this.L.win.y + c.cy * this.L.k, 8, {
          color: this.cellCss(e.cell), size: 2.4, speed: 60, g: 90, life: 0.6, drag: 3,
        });
        break;
      }
      case 'touchLight':
        this.flash(e.cell, true);
        break;
      case 'ray':
        this.captionCenter(t('cap.ray'));
        break;
      case 'ring':
        this.captionCenter(t('cap.ring'));
        break;
      case 'night':
        this.captionCenter(t('cap.night'));
        break;
      case 'dawn':
        this.dawn = 1;
        this.captionCenter(t('cap.dawn'));
        break;
      case 'finale':
        this.fin = 0;
        break;
      default:
        break;
    }
  }

  private cellCss(id: number): string {
    const c = this.vis?.colors[id];
    return c ? `rgb(${c.r | 0},${c.g | 0},${c.b | 0})` : '#f6d488';
  }

  private flash(cell: number, gold: boolean): void {
    this.flashes.push({ cell, t: 0, dur: this.opts.reducedMotion ? 0.9 : 0.6, gold });
    if (this.flashes.length > 90) this.flashes.shift();
  }

  private burst(cell: number, n: number): void {
    const v = this.vis!, c = v.geo.cells[cell];
    const x = this.L.win.x + c.cx * this.L.k, y = this.L.win.y + c.cy * this.L.k;
    this.parts.burst(x, y, this.opts.reducedMotion ? Math.ceil(n / 2) : n, { color: '#ffe7a8', size: 2.2, speed: 90, g: -20, life: 0.9, drag: 2.2, shape: 'spark' });
    this.parts.burst(x, y, 6, { color: this.cellCss(cell), size: 2.6, speed: 40, g: -10, life: 1.1, drag: 2 });
  }

  private caption(text: string, px: number, py: number, big: boolean): void {
    const L = this.L;
    this.captions.push({ text, x: L.win.x + px * L.k, y: L.win.y + py * L.k, t: 0, dur: 2.8, big });
    if (this.captions.length > 3) this.captions.shift();
  }

  private captionCenter(text: string): void {
    const L = this.L;
    this.captions.push({ text, x: L.win.x + L.win.w / 2, y: L.win.y + L.win.h * 0.55, t: 0, dur: 2.4, big: false });
    if (this.captions.length > 3) this.captions.shift();
  }

  /** A touch shows at once: a ring where the finger went down. */
  ripple(x: number, y: number): void {
    this.ripples.push({ x, y, t: 0 });
    if (this.ripples.length > 6) this.ripples.shift();
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: JestemSim): void {
    this.clock += dt;
    this.parts.update(dt);
    this.motes.update(dt);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter(f => f.t < f.dur);
    for (const c of this.captions) c.t += dt;
    this.captions = this.captions.filter(c => c.t < c.dur);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < 0.5);
    // the dawn's cells, one by one
    while (this.dawnQueue.length && this.dawnQueue[0].at <= this.clock) {
      const d = this.dawnQueue.shift()!;
      this.hidden.delete(d.cell);
      this.toGlass(d.cell, false);
      this.flash(d.cell, true);
      if (this.vis) this.burst(d.cell, 10);
    }
    const nightOn = sim.blind;
    this.night = clamp(this.night + (nightOn ? dt / 1.2 : -dt / 1.6));
    this.dawn = Math.max(0, this.dawn - dt / 2.2);
    if (this.fin >= 0) this.fin = sim.finaleT;
    this.F = sim.finaleSec;
    // motes in the window's light
    if (this.vis && this.motes.count < 36 && Math.random() < dt * 7) {
      const L = this.L, W = this.fin >= 0 ? windowAt(L, this.finK()) : L.win;
      const x = W.x + Math.random() * W.w, y = W.y + W.h * (0.3 + Math.random() * 0.8);
      const rise = this.fin > 0.15 * this.F;
      this.motes.burst(x, y, 1, { color: rise ? '#fff1c8' : '#f3e2c0', size: rise ? 1.8 : 1.2, speed: rise ? 26 : 8, angle: -Math.PI / 2, spread: 1.2, g: rise ? -14 : -2, life: rise ? 3.2 : 4, drag: 0.2 });
    }
    // the glow layer follows the cells' glow, a few times a second
    if (this.vis) {
      let sum = 0;
      for (let i = 0; i < sim.glow.length; i++) if (this.inGlass[i]) sum += sim.glow[i];
      if (Math.abs(sum - this.glowSum) > 0.02 && this.clock - this.glowAt > 0.2) {
        this.glowSum = sum;
        this.glowAt = this.clock;
        this.bakeGlow(sim);
      }
    }
  }

  /** The finale's length: its moments scale with it (20 s in a real session, 8 s in a short test). */
  private F = 20;

  private finK(): number { return this.L.mode === 'tall' || !this.L.side ? smooth(this.fin, 0.2 * this.F, 0.28 * this.F) : 0; }

  draw(sim: JestemSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.drawBg(ctx);
    if (!this.vis) {
      this.drawSketching(ctx, L.win);
      this.drawOverlays(ctx, sim);
      return;
    }
    if (this.leadDirty) this.bakeLead(sim);
    const ft = this.fin;
    const W = ft >= 0 ? windowAt(L, this.finK()) : L.win;
    const sc = W.w / L.win.w;
    const breath = this.breath(sim);
    const lit = (sim.litPlayer + sim.graced) / Math.max(1, sim.cells);
    const glowM = sim.glowMean;
    // ── the aura, behind the window ──
    const F = this.F;
    const finA = ft >= 0 ? smooth(ft, 0.12 * F, 0.35 * F) : 0;
    const auraK = clamp(0.15 + 0.55 * lit * (0.4 + 0.6 * glowM) + 0.6 * finA);
    // the window's coloured light falls on the floor below it, as much as the glass is lit and glowing
    const spill = clamp(lit * (0.5 + 0.5 * glowM) + finA) * (0.85 + 0.15 * breath);
    if (spill > 0.02) {
      const sill = W.y + W.h, a = rgbS(this.aura);
      const g = ctx.createLinearGradient(0, sill, 0, this.h);
      g.addColorStop(0, `rgba(${a},${0.16 * spill})`);
      g.addColorStop(1, `rgba(${a},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W.x, sill);
      ctx.lineTo(W.x + W.w, sill);
      ctx.lineTo(W.x + W.w * 1.5, this.h);
      ctx.lineTo(W.x - W.w * 0.5, this.h);
      ctx.closePath();
      ctx.fill();
    }
    const cx = W.x + W.w / 2, cy = W.y + W.h * 0.48;
    blit(ctx, glowSprite(rgbS(this.aura)), cx, cy, W.w * (2.1 + 0.4 * finA), W.h * (1.6 + 0.3 * finA), auraK * (0.55 + 0.12 * breath));
    const rays = sim.rays;
    if (rays > 0 || finA > 0) {
      const ra = clamp(0.06 * rays + 0.65 * finA) * (0.85 + 0.15 * breath);
      const size = Math.max(W.w, W.h) * (2 + 0.3 * finA);
      ctx.save();
      ctx.translate(cx, W.y + W.h * 0.42);
      ctx.rotate(this.opts.reducedMotion ? 0 : this.clock * 0.025);
      blit(ctx, raySprite(rgbS(this.ray), 10 + 2 * Math.min(6, rays)), 0, 0, size, size, ra);
      ctx.restore();
    }
    // the rings of the rests: arches of light around the window
    const rings = sim.rings + (ft >= 0 ? Math.round(3 * finA) : 0);
    for (let i = 0; i < Math.min(8, rings); i++) {
      const a = (0.22 + 0.12 * breath) * (1 - i * 0.08) * (i < sim.rings ? 1 : finA);
      ctx.strokeStyle = `rgba(${rgbS(this.ray)},${a})`;
      ctx.lineWidth = 1.4 * L.u;
      ctx.stroke(this.winPath(W, (14 + i * 9) * L.u * sc, true));
    }
    // ── the frame and the window ──
    const frameA = ft >= 0 ? 1 - 0.75 * smooth(ft, 0.1 * F, 0.25 * F) : 1;
    if (frameA > 0.01) {
      ctx.globalAlpha = frameA;
      ctx.fillStyle = '#2b2226';
      const frame = this.winPath(W, 7 * L.u * sc);
      ctx.fill(frame);
      ctx.strokeStyle = 'rgba(246,212,136,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke(frame);
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.clip(this.winPath(W, 0));
    ctx.drawImage(this.paper!, W.x, W.y, W.w, W.h);
    ctx.drawImage(this.glass!, W.x, W.y, W.w, W.h);
    // the watercolour blooms of the cells being filled
    if (ft < 0) this.drawBlooms(ctx, sim, W, sc);
    // the glass's own light
    const gA = (0.45 + 0.3 * glowM) * (sim.restBlock ? 0.85 + 0.25 * breath : 1) + finA * 0.12;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(gA * 0.7, 0, 0.62);
    ctx.drawImage(this.glowL!, W.x, W.y, W.w, W.h);
    if (finA > 0) {
      // the finale: the picture glows from within (its own colours, a breath of them)
      ctx.globalAlpha = 0.1 * finA * (0.75 + 0.25 * breath);
      ctx.drawImage(this.pic!, W.x, W.y, W.w, W.h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // flashes of newly lit cells
    this.drawFlashes(ctx, W, sc);
    // the leading (it dissolves in the finale)
    const leadA = ft >= 0 ? 1 - smooth(ft, 0.07 * F, 0.22 * F) : 1;
    if (leadA > 0.01) {
      ctx.globalAlpha = leadA;
      ctx.drawImage(this.lead!, W.x, W.y, W.w, W.h);
      ctx.globalAlpha = 1;
    }
    // the night's veil and the dawn's warmth
    if (this.night > 0.01) {
      ctx.fillStyle = `rgba(10,16,48,${0.62 * this.night})`;
      ctx.fillRect(W.x, W.y, W.w, W.h);
      ctx.fillStyle = `rgba(255,250,230,${0.8 * this.night})`;
      for (let i = 0; i < 14; i++) {
        const sx = W.x + ((i * 97) % 89) / 89 * W.w, sy = W.y + ((i * 53) % 61) / 61 * W.h * 0.7;
        const tw = 0.5 + 0.5 * Math.sin(this.clock * 2 + i);
        ctx.globalAlpha = this.night * tw;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
    if (this.dawn > 0.01) {
      const g = ctx.createLinearGradient(0, W.y + W.h, 0, W.y);
      g.addColorStop(0, `rgba(255,200,140,${0.35 * this.dawn})`);
      g.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(W.x, W.y, W.w, W.h);
    }
    ctx.restore();
    // ── what lives over the window ──
    if (ft < 0) {
      this.drawTarget(ctx, sim, W);
      this.drawStream(ctx, sim, W);
      this.drawOculus(ctx, sim, W, breath);
    } else if (ft < 0.25 * F) {
      this.drawOculus(ctx, sim, W, breath);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.motes.draw(ctx);
    this.parts.draw(ctx);
    ctx.restore();
    this.drawRipples(ctx);
    this.drawCaptions(ctx);
    if (ft >= 0) this.drawFinale(ctx, sim);
    this.drawOverlays(ctx, sim);
  }

  /** The window's path grown by `grow` px: cached while the window stays where it is (in play it never moves). */
  private paths2 = new Map<string, Path2D>();
  private winPath(W: Rect, grow: number, open = false): Path2D {
    const key = `${W.x.toFixed(1)},${W.y.toFixed(1)},${W.w.toFixed(1)},${grow.toFixed(1)},${open}`;
    let p = this.paths2.get(key);
    if (!p) {
      if (this.paths2.size > 24) this.paths2.clear();
      p = windowPath(W, grow, open);
      this.paths2.set(key, p);
    }
    return p;
  }

  /** The rest's breath: in for 4, out for 6 (0 → 1 → 0), slow and steady. */
  private breath(sim: JestemSim): number {
    const cyc = RULES.breathIn + RULES.breathOut;
    const x = (sim.t % cyc + cyc) % cyc;
    return x < RULES.breathIn ? ease.inOutSine(x / RULES.breathIn) : 1 - ease.inOutSine((x - RULES.breathIn) / RULES.breathOut);
  }

  private drawBg(ctx: CanvasRenderingContext2D): void {
    if (!this.bg || this.bg.width !== Math.round(this.w * this.dpr)) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(this.w * this.dpr));
      c.height = Math.max(1, Math.round(this.h * this.dpr));
      const g = c.getContext('2d')!;
      g.scale(this.dpr, this.dpr);
      const L = this.L, cx = L.win.x + L.win.w / 2, cy = L.win.y + L.win.h * 0.5;
      const rg = g.createRadialGradient(cx, cy, Math.min(L.win.w, L.win.h) * 0.3, cx, cy, Math.max(this.w, this.h) * 0.85);
      rg.addColorStop(0, '#3a2a4e');
      rg.addColorStop(0.45, '#22182c');
      rg.addColorStop(1, '#0e0a12');
      g.fillStyle = rg;
      g.fillRect(0, 0, this.w, this.h);
      // the chapel wall: courses of stone, faint
      g.strokeStyle = 'rgba(255,236,210,0.035)';
      g.lineWidth = 1;
      const row = 34 * L.u;
      for (let y = 0, r = 0; y < this.h; y += row, r++) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(this.w, y);
        g.stroke();
        for (let x = (r % 2) * 40 * L.u; x < this.w; x += 80 * L.u) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + row);
          g.stroke();
        }
      }
      // the window's light on the sill and the floor
      const sill = L.win.y + L.win.h;
      const lg = g.createLinearGradient(0, sill, 0, this.h);
      lg.addColorStop(0, 'rgba(255,214,160,0.12)');
      lg.addColorStop(1, 'rgba(255,214,160,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(L.win.x, sill);
      g.lineTo(L.win.x + L.win.w, sill);
      g.lineTo(L.win.x + L.win.w * 1.35, this.h);
      g.lineTo(L.win.x - L.win.w * 0.35, this.h);
      g.closePath();
      g.fill();
      this.bg = c;
    }
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);
  }

  /** Before the vision is ready: the empty paper in the window, a pencil at work. */
  private drawSketching(ctx: CanvasRenderingContext2D, W: Rect): void {
    ctx.fillStyle = '#2b2226';
    ctx.fill(windowPath(W, 7 * this.L.u));
    ctx.fillStyle = PAPER;
    ctx.fill(windowPath(W));
    const a = this.clock * 1.7;
    const x = W.x + W.w * (0.5 + 0.28 * Math.cos(a)), y = W.y + W.h * (0.5 + 0.22 * Math.sin(a * 1.3));
    ctx.strokeStyle = 'rgba(62,50,46,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26, y - 30);
    ctx.stroke();
    ctx.font = font(14, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(62,50,46,0.8)';
    ctx.fillText(t('intro.sketch'), W.x + W.w / 2, W.y + W.h * 0.82);
  }

  /** The cells being filled: a watercolour bloom from the centre, the picture's own colours, a darker rim. */
  private drawBlooms(ctx: CanvasRenderingContext2D, sim: JestemSim, W: Rect, sc: number): void {
    const v = this.vis!, k = this.L.k;
    let n = 0;
    for (let i = 0; i < sim.ink.length && n < 6; i++) {
      if (sim.lit[i] || this.hidden.has(i) || !(sim.ink[i] > 0)) continue;
      n++;
      const c = v.geo.cells[i];
      const f = clamp(sim.ink[i] / c.cap);
      const R = this.outer[i] * (0.12 + 0.98 * Math.sqrt(f));
      const ox = c.cx * k, oy = c.cy * k;
      const blob = new Path2D();
      const live = i === sim.target ? this.clock : 0;
      for (let q = 0; q <= 20; q++) {
        const a = (q / 20) * TAU;
        const wob = 1 + 0.09 * Math.sin(a * 3 + i + live * 1.3) + 0.05 * Math.sin(a * 7 + i * 2 - live);
        const x = ox + Math.cos(a) * R * wob, y = oy + Math.sin(a) * R * wob;
        if (q) blob.lineTo(x, y); else blob.moveTo(x, y);
      }
      blob.closePath();
      ctx.save();
      ctx.translate(W.x, W.y);
      ctx.scale(sc, sc);
      ctx.clip(this.paths[i]);
      ctx.save();
      ctx.clip(blob);
      ctx.globalAlpha = 0.86;
      ctx.drawImage(this.pic!, 0, 0, this.L.win.w, this.L.win.h);
      ctx.restore();
      // the rim where the paint pools as it dries
      const col = v.colors[i] ?? { r: 120, g: 100, b: 90 };
      ctx.strokeStyle = `rgba(${col.r * 0.55 | 0},${col.g * 0.55 | 0},${col.b * 0.55 | 0},0.5)`;
      ctx.lineWidth = 1.6;
      ctx.stroke(blob);
      ctx.restore();
    }
  }

  private drawFlashes(ctx: CanvasRenderingContext2D, W: Rect, sc: number): void {
    if (!this.flashes.length) return;
    ctx.save();
    ctx.translate(W.x, W.y);
    ctx.scale(sc, sc);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      if (f.t < 0) continue;
      const k = f.t / f.dur;
      const a = (1 - k) * (f.gold ? 0.55 : 0.3) * (this.opts.reducedMotion ? 0.6 : 1);
      ctx.fillStyle = f.gold ? `rgba(255,226,150,${a})` : `rgba(255,255,255,${a})`;
      ctx.fill(this.paths[f.cell]);
    }
    ctx.restore();
  }

  /** The cell the colour flows into: a soft gold outline that breathes; the path a drag laid, dashed. */
  private drawTarget(ctx: CanvasRenderingContext2D, sim: JestemSim, W: Rect): void {
    const sc = W.w / this.L.win.w;
    ctx.save();
    ctx.translate(W.x, W.y);
    ctx.scale(sc, sc);
    ctx.lineJoin = 'round';
    const pulse = 0.55 + 0.35 * Math.sin(this.clock * 4);
    if (sim.target >= 0 && sim.pouring) {
      ctx.strokeStyle = `rgba(246,212,136,${pulse})`;
      ctx.lineWidth = 2.6 * this.L.u;
      ctx.stroke(this.paths[sim.target]);
    }
    const queued = this.drag.length ? this.drag : sim.path;
    if (queued.length) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255,240,200,0.75)';
      ctx.lineWidth = 2 * this.L.u;
      for (const id of queued) if (id >= 0 && !sim.lit[id]) ctx.stroke(this.paths[id]);
      ctx.setLineDash([]);
    }
    if (sim.marked >= 0 && !sim.lit[sim.marked]) {
      ctx.strokeStyle = `rgba(206,214,255,${0.4 + 0.3 * pulse})`;
      ctx.lineWidth = 2.2 * this.L.u;
      ctx.stroke(this.paths[sim.marked]);
    }
    ctx.restore();
  }

  /** The stream from the oculus to the cell being coloured: its width is the band's level, gold above the threshold. */
  private drawStream(ctx: CanvasRenderingContext2D, sim: JestemSim, W: Rect): void {
    const v = this.vis!, L = this.L;
    if (!sim.pouring && !sim.lighting) return;
    const o = L.oculus;
    let tx: number, ty: number, rgb: string;
    if (sim.lighting) {
      tx = W.x + W.w / 2;
      ty = W.y + W.h * 0.55;
      rgb = '255,236,190';
    } else {
      const c = sim.target >= 0 ? v.geo.cells[sim.target] : null;
      if (!c) return;
      tx = W.x + c.cx * L.k;
      ty = W.y + c.cy * L.k;
      const col = v.colors[sim.target];
      rgb = col ? `${Math.min(255, col.r * 0.6 + 110) | 0},${Math.min(255, col.g * 0.6 + 100) | 0},${Math.min(255, col.b * 0.6 + 90) | 0}` : '255,236,190';
    }
    const night = sim.blind;
    const warm = sim.block.kind === 'warmup';
    const lv = night ? 0 : warm ? 0.45 : sim.flow;
    const gold = !night && !warm && lv >= 0.5;
    if (gold) rgb = '255,218,130';
    if (night) rgb = '200,210,240';
    const wid = (night ? 1.4 : 2 + 9 * lv) * L.u;
    const x0 = o.x, y0 = o.y + o.r * 0.8;
    const c1x = x0, c1y = y0 + (ty - y0) * 0.45, c2x = tx, c2y = ty - (ty - y0) * 0.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
    ctx.strokeStyle = `rgba(${rgb},${night ? 0.25 : 0.22})`;
    ctx.lineWidth = wid * 2.2;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${night ? 0.45 : 0.7})`;
    ctx.lineWidth = Math.max(1, wid * 0.55);
    ctx.stroke();
    // drops travelling down it, quicker with a stronger flow
    const speed = 0.35 + 1.2 * lv;
    const n = night ? 3 : 5 + Math.round(5 * lv);
    for (let i = 0; i < n; i++) {
      const tt = (this.clock * speed + i / n) % 1;
      const m = 1 - tt;
      const bx = m * m * m * x0 + 3 * m * m * tt * c1x + 3 * m * tt * tt * c2x + tt * tt * tt * tx;
      const by = m * m * m * y0 + 3 * m * m * tt * c1y + 3 * m * tt * tt * c2y + tt * tt * tt * ty;
      ctx.fillStyle = `rgba(${rgb},${0.9})`;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(1.2, wid * 0.4), 0, TAU);
      ctx.fill();
      if (gold && i % 2 === 0) blit(ctx, glowSprite('255,220,140'), bx, by, wid * 5, wid * 5, 0.5, false);
    }
    ctx.restore();
  }

  private drawOculus(ctx: CanvasRenderingContext2D, sim: JestemSim, W: Rect, breath: number): void {
    const L = this.L;
    const o = this.fin >= 0 ? { x: W.x + W.w / 2, y: W.y + L.oculus.r * 0.15 * (W.w / L.win.w), r: L.oculus.r * (W.w / L.win.w) } : L.oculus;
    const col = sim.target >= 0 ? this.vis?.colors[sim.target] : null;
    const rgb = col ? `${col.r | 0},${col.g | 0},${col.b | 0}` : '255,220,160';
    let mode: 'push' | 'rest' | 'night' | 'idle' | 'light' = 'idle';
    let value: number | null = null;
    if (sim.playing && !sim.story) {
      if (sim.blind) mode = 'night';
      else if (sim.pushBlock) { mode = sim.complete ? 'light' : 'push'; value = sim.meter(); }
      else if (sim.restBlock) { mode = 'rest'; value = sim.meter(); }
    }
    paintOculus(ctx, o.x, o.y, o.r, { value, mode, rgb, t: this.clock, breath });
  }

  private drawRipples(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      const k = r.t / 0.5;
      ctx.strokeStyle = `rgba(255,240,200,${0.7 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + 26 * ease.outCubic(k), 0, TAU);
      ctx.stroke();
    }
  }

  private drawCaptions(ctx: CanvasRenderingContext2D): void {
    const L = this.L;
    for (const c of this.captions) {
      const k = c.t / c.dur;
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      const px = (c.big ? 21 : 17) * Math.min(L.u, 1.2);
      const maxW = L.win.w - 16;
      const size = fitFont(ctx, c.text, maxW, px, 13, 600, true, true);
      ctx.font = font(size, 600, true, true);
      const tw = ctx.measureText(c.text).width;
      const x = clamp(c.x, L.win.x + tw / 2 + 8, L.win.x + L.win.w - tw / 2 - 8);
      const y = clamp(c.y - 18 * ease.outCubic(k), L.win.y + 24, L.win.y + L.win.h - 16);
      blit(ctx, glowSprite('20,12,24'), x, y, tw * 1.5 + 40, size * 3.2, 0.75 * a, false);
      ctx.globalAlpha = clamp(a);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(c.text, x, y);
      ctx.globalAlpha = 1;
    }
  }

  /** Hanna's line and the opening card. */
  private drawOverlays(ctx: CanvasRenderingContext2D, sim: JestemSim): void {
    const L = this.L;
    const line = sim.talk.line;
    if (line && !sim.story) {
      const a = Math.min(1, line.t / 0.25, (line.dur - line.t) / 0.4);
      const top = L.side ? L.side.y + 4 : L.bubble.y;
      const cx = L.side ? L.side.x + Math.min(L.side.w, 420 * L.u) / 2 : L.bubble.x;
      const maxW = L.side ? Math.min(L.side.w, 420 * L.u) : L.bubble.maxW;
      paintBubble(ctx, line.text, cx, top, maxW, L.u, a);
    }
    if (L.side && this.vis && !sim.story && this.fin < 0) this.drawSide(ctx, sim);
    if (sim.story) this.drawStory(ctx, sim);
  }

  /** The column beside the window (wide): the declaration, and the picture's fragments with the lit ones in gold. */
  private drawSide(ctx: CanvasRenderingContext2D, sim: JestemSim): void {
    const L = this.L, S = L.side!, v = this.vis!;
    // under the room Hanna's bubble may take (three lines at most)
    const top = S.y + Math.max(74 * L.u, 98);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,240,214,0.6)';
    const a = sentence(this.word || '…');
    ctx.font = font(15 * Math.min(L.u, 1.2), 500, true, true);
    const lines = wrap(ctx, a, S.w, 3);
    const lh = 15 * Math.min(L.u, 1.2) * 1.35;
    lines.forEach((l, i) => ctx.fillText(l, S.x, top + i * lh));
    let y = top + lines.length * lh + 14;
    const px = 13 * Math.min(L.u, 1.15);
    ctx.font = font(px, 600);
    for (let i = 0; i < v.geo.frags.length && y < S.y + S.h - px; i++) {
      const f = v.geo.frags[i];
      const done = sim.fragDone[i];
      const litN = f.cells.filter(id => sim.lit[id]).length;
      ctx.fillStyle = done ? GOLD : 'rgba(255,240,214,0.5)';
      ctx.fillText(`${done ? '✦' : '·'} ${fragName(f.key, i + 1, v.geo.frags.length)}`, S.x, y);
      if (!done && litN > 0) {
        const tw = ctx.measureText(`· ${fragName(f.key, i + 1, v.geo.frags.length)}`).width;
        ctx.fillStyle = 'rgba(255,240,214,0.4)';
        ctx.fillText(`${litN}/${f.cells.length}`, S.x + tw + 8, y);
      }
      y += px * 1.6;
    }
  }

  /** The opening card: Hanna, the root verse, and (in Polish) how to speak to the player. */
  private drawStory(ctx: CanvasRenderingContext2D, sim: JestemSim): void {
    const L = this.L, st = sim.story!;
    const C = L.card;
    const a = Math.min(1, st.t / 0.4);
    const pad = 16;
    const titlePx = 20 * Math.min(L.u, 1.15), textPx = 14 * Math.min(L.u, 1.1);
    ctx.font = font(textPx, 500);
    const textLines = wrap(ctx, t('story.text'), C.w - 2 * pad, 6);
    const lh = fontPx(textPx) * 1.4;
    const btnH = st.ask ? Math.max(48, 50 * L.u) : 0;
    const head = pad + titlePx * 1.4 + textLines.length * lh + 10;
    const foot = st.ask ? 22 + btnH + pad + 8 : 34;
    const verseH = Math.max(40, C.h - head - foot);
    const pass = passage('php2.9-10');
    const pl = layoutPassage(ctx, pass, C.w - 2 * pad, verseH, { max: 15 * Math.min(L.u, 1.1), min: 12 });
    const h = Math.min(C.h, head + pl.height + 10 + foot);
    const y = L.anchor === 'bottom' ? C.y + C.h - h : C.y + (C.h - h) / 2;
    const box: Rect = { x: C.x, y, w: C.w, h };
    this.cardBox = box;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,5,10,0.45)';
    ctx.fillRect(0, 0, this.w, this.h);
    roundRect(ctx, box.x, box.y, box.w, box.h, 18);
    ctx.fillStyle = 'rgba(26,18,30,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,212,136,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = GOLD;
    ctx.font = font(titlePx, 600, true);
    ctx.fillText(t('story.title'), box.x + pad, box.y + pad);
    ctx.fillStyle = '#f4ead8';
    ctx.font = font(textPx, 500);
    textLines.forEach((l, i) => ctx.fillText(l, box.x + pad, box.y + pad + titlePx * 1.4 + i * lh));
    drawPassage(ctx, pass, pl, box.x + box.w / 2, box.y + head, { text: 'rgba(255,236,200,0.9)', ref: 'rgba(255,236,200,0.6)' });
    if (st.ask) {
      const [b1, b2] = formButtons(L, box);
      ctx.fillStyle = 'rgba(244,234,216,0.75)';
      ctx.font = font(13, 600);
      ctx.textAlign = 'left';
      ctx.fillText(t('story.ask'), box.x + pad, b1.y - 20);
      ([[b1, 'm'], [b2, 'f']] as const).forEach(([b, f], i) => {
        roundRect(ctx, b.x, b.y, b.w, b.h, 14);
        ctx.fillStyle = this.pressed === i ? 'rgba(246,212,136,0.35)' : 'rgba(246,212,136,0.14)';
        ctx.fill();
        ctx.strokeStyle = GOLD;
        ctx.stroke();
        const word = this.formWord?.(f) ?? '';
        const text = t('label', { word });
        const sz = fitFont(ctx, text, b.w - 16, 15 * Math.min(L.u, 1.1), 12, 600, true);
        ctx.font = font(sz, 600, true);
        ctx.fillStyle = '#ffe9b0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2);
      });
    } else {
      ctx.fillStyle = 'rgba(244,234,216,0.6)';
      ctx.font = font(13, 600);
      ctx.textAlign = 'center';
      ctx.fillText(t(this.opts.touch ? 'story.tap' : 'story.click'), box.x + box.w / 2, box.y + box.h - 26);
    }
    ctx.restore();
  }

  /** The word in each Polish form, for the card's answers (set by the game). */
  formWord: ((f: 'm' | 'f') => string) | null = null;

  /** The finale's writing: the declaration letter by letter, in the serif, and its verse under it. */
  private drawFinale(ctx: CanvasRenderingContext2D, sim: JestemSim): void {
    const ft = this.fin, F = this.F;
    const L = this.L, T = L.finText;
    const start = 0.24 * F;
    if (ft < start) return;
    const word = this.word;
    const key = `${T.w}x${T.h}|${word}`;
    if (!this.finText || this.finText.key !== key) {
      const a = t('sentence.a'), b = word ? t('sentence.b', { word }) : t('sentence.b', { word: '…' }).replace(/\s…\.$/, '…');
      const sizeA = fitFont(ctx, a, T.w, Math.min(26 * L.u, T.w / 11), 14, 600, true);
      const sizeB = fitFont(ctx, b, T.w, Math.min(34 * L.u, T.w / 8), 16, 700, true);
      const used = sizeA * 1.5 + sizeB * 1.5 + 16;
      const pass = T.h - used > 50 ? layoutPassage(ctx, passage(sim.verse), T.w, T.h - used - 6, { max: 15 * Math.min(L.u, 1.15), min: 12 }) : null;
      this.finText = { a, b, size: sizeA, sizeB, pass, key };
    }
    const X = this.finText;
    // letters a second: at least 16, quicker when the finale is short (all written by 60 % of it)
    const cps = Math.max(16, (X.a.length + X.b.length) / (0.34 * F));
    const nA = Math.floor((ft - start) * cps);
    const nB = Math.floor((ft - start - X.a.length / cps - 0.25) * cps * 0.85);
    const cx = T.x + T.w / 2;
    let y = T.y + (L.side ? Math.max(0, (T.h - (X.size * 1.5 + X.sizeB * 1.5 + 16 + (X.pass?.height ?? 0))) / 2) : 4);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.typewrite(ctx, X.a, nA, cx, y, X.size, 600, '#fbefd8');
    y += X.size * 1.5;
    this.typewrite(ctx, X.b, nB, cx, y, X.sizeB, 700, '#ffd98a');
    y += X.sizeB * 1.5 + 12;
    const written = start + (X.a.length + X.b.length) / cps + 0.3;
    const verseA = smooth(ft, written + 0.04 * F, written + 0.14 * F);
    if (X.pass && verseA > 0) {
      ctx.globalAlpha = verseA;
      drawPassage(ctx, passage(sim.verse), X.pass, cx, y, { text: 'rgba(255,240,214,0.92)', ref: 'rgba(255,236,200,0.62)' });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** A line written letter by letter: each new letter fades in with a little light. */
  private typewrite(ctx: CanvasRenderingContext2D, text: string, n: number, cx: number, y: number, size: number, weight: number, color: string): void {
    if (n <= 0) return;
    ctx.font = font(size, weight, true);
    const full = ctx.measureText(text).width;
    const shown = text.slice(0, Math.min(text.length, n));
    const x0 = cx - full / 2;
    ctx.fillStyle = color;
    ctx.fillText(shown, x0, y);
    if (n < text.length + 3) {
      const wNow = ctx.measureText(shown).width;
      blit(ctx, glowSprite('255,226,160'), x0 + wNow, y + size * 0.5, size * 2.4, size * 2.4, 0.5);
    }
  }

  /**
   * The picture coordinates under a point of the canvas, held to the window's edge: a tap beside the window
   * still sends the colour to the nearest part of it (null only above the band, under the HUD).
   */
  toPicture(x: number, y: number): { x: number; y: number } | null {
    const W = this.L.win;
    if (y < this.L.band.y) return null;
    return { x: clamp((x - W.x) / this.L.k, 0, RULES.PW), y: clamp((y - W.y) / this.L.k, 0, RULES.PH) };
  }

  /** Whether a point lies on the window (or within a finger of it): a drag lays a path only there. */
  onWindow(x: number, y: number): boolean {
    const W = this.L.win, m = 14;
    return x >= W.x - m && x <= W.x + W.w + m && y >= W.y - m && y <= W.y + W.h + m;
  }

  /** Which form button is under a point of the card (-1: none). */
  formAt(x: number, y: number): 0 | 1 | -1 {
    const box = this.cardBox;
    if (!box) return -1;
    const [a, b] = formButtons(this.L, box);
    const inR = (r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    return inR(a) ? 0 : inR(b) ? 1 : -1;
  }
}

