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
 * the "what to do now" line, the opening card and the finale's writing.  Everything bright is drawn with
 * baked sprites.
 *
 * An own photo (round 11) keeps its own shape: a thin gallery frame instead of the stone arch, thin grout
 * instead of lead, a ring medallion on the frame's corner for the gauge, and at the finale the grout dissolves
 * and the photo itself shines through, glowing, with its aura.
 */
import { Particles, clamp, ease } from '../kit/juice';
import { isMoving, LivingPicture, LookInput, motionFor, type Look } from '../kit/living';
import { MIN_READ } from '../kit/mobile';
import { layoutPassage, drawPassage, passage, type PassageLayout } from '../kit/scripture';
import type { RGB } from './art';
import { DECLS, OWN_AURA, fragName, ownSentenceParts } from './content';
import { t } from './i18n';
import { ARCH, formButtons, layout, tu, windowAt, type Layout, type PicShape, type Rect } from './layout';
import {
  GOLD, LEAD, PAPER, TAU, blit, fitFont, fitLines, font, fontPx, glowSprite, layoutFinale, paintBubble, paintOculus, raySprite, roundRect, windowPath, wrap,
} from './paint';
import { paintPicture } from './pictures';
import type { Prepared } from './prep';
import { readSec } from './rules';
import type { JestemSim, NowIcon, SimEvent } from './sim';
import type { Insets } from '../kit/types';
import { NO_INSETS } from '../kit/mobile';

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
  private ins: Insets = NO_INSETS;
  /** the picture's shape and space (the layout follows it) */
  private space: PicShape = ARCH;
  private vis: Prepared | null = null;
  private word = '';
  private aura: RGB = OWN_AURA;
  private ray: RGB = [255, 226, 150];
  /** each cell's path in window-local px at the layout's scale */
  private paths: Path2D[] = [];
  private outer: number[] = [];
  private pic: HTMLCanvasElement | null = null;
  /**
   * An own photo brought to life (round 12, kit/living.ts): the lit cells, the blooms and the finale show its
   * frame of the moment instead of the still picture; the glass then holds only the panes' bevels and grace's
   * gold, and the lit cells are drawn through their outline (`litPath`, `gracePath`).  null: the picture is still.
   */
  private living: LivingPicture | null = null;
  private readonly look = new LookInput();
  private lookNow: Look | null = null;
  private lookMouse: { x: number; y: number } | null = null;
  private litPath: Path2D | null = null;
  private gracePath: Path2D | null = null;
  private litDirty = true;
  /** the living frame drawn this frame (memo: one frame per draw) */
  private frameAt = -1;
  private frameNow: HTMLCanvasElement | null = null;
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
  private finText: {
    a: string[]; b: string[]; size: number; sizeB: number; lhA: number; lhB: number; nA: number; nB: number; pass: PassageLayout | null; key: string;
  } | null = null;
  /** the "what to do now" line as drawn last (its words wrapped, memoised by text and width) */
  private nowMemo: { key: string; lines: string[]; size: number } | null = null;
  /** the path a drag is laying (cells, in order) */
  drag: number[] = [];
  /**
   * A desktop's mouse over the play (DESIGN §14): where it is, the cell a click there would act on (the game
   * sets it from the rules: the part the colour would go to, the glass that would glow), and the card's answer
   * under it.
   */
  mouse: { x: number; y: number } | null = null;
  hoverCell = -1;
  hoverForm: 0 | 1 | -1 = -1;
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
    this.ins = ins;
    this.relayout();
  }

  private relayout(): void {
    this.L = layout(this.w, this.h, this.ins, this.opts.touch, this.space);
    this.bg = null;
    this.finText = null;
    this.nowMemo = null;
    this.cardBox = null;
    this.paths2.clear();
    if (this.vis) this.build();
  }

  /** The prepared vision: its words, its shape, its aura's colours; the layers are baked now. */
  setVision(p: Prepared, word: string): void {
    this.vis = p;
    this.word = word;
    const d = p.decl ? DECLS[p.decl] : null;
    this.aura = d ? d.aura : OWN_AURA;
    this.ray = d ? d.ray : [255, 226, 150];
    this.baked = p.geo.cells.map(() => 0);
    this.space = { shape: p.geo.shape, w: p.geo.w, h: p.geo.h };
    this.relayout();
  }

  get ready(): boolean { return !!this.vis; }
  /** the window is an own photo's rectangle */
  get photo(): boolean { return this.space.shape === 'rect'; }

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
    // an own photo comes to life with its chosen motion (a device asking for less motion keeps it still)
    const motion = v.living ? motionFor(v.motion, v.living, this.opts.reducedMotion) : null;
    this.living = v.living && motion && isMoving(motion) ? new LivingPicture(this.pic, this.pic.width, this.pic.height, v.living, motion) : null;
    if (this.living && this.opts.touch) this.look.listen(() => this.clock);
    this.litDirty = true;
    this.frameAt = -1;
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
      // (a living picture is drawn live through the cell's outline instead)
      if (!this.living) g.drawImage(this.pic, 0, 0, this.L.win.w, this.L.win.h);
      g.globalAlpha = 0.12;
      g.fillStyle = GOLD;
      g.fill(path);
    } else if (!this.living) {
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
    this.litDirty = true;
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
    // finer mosaics take finer lead (48 cells: 0.9 of it, 144: 0.6)
    const fine = clamp(Math.sqrt(40 / Math.max(1, v.geo.cells.length)), 0.6, 1);
    const base = Math.max(1.4, 2.6 * k * (600 / 320) * fine) * Math.min(1.25, u);
    const shown = (id: number) => this.inGlass[id];
    if (this.photo) {
      // a photo's mosaic: thin grout, warm where the light has come, a hair inside a whole fragment
      const grout = Math.max(0.9, base * 0.42);
      for (const e of v.geo.edges) {
        const a = shown(e.a), b = e.b >= 0 ? shown(e.b) : false;
        if (e.b < 0) continue;   // the frame holds the edge
        const sameDone = a && b && v.geo.cells[e.a].frag === v.geo.cells[e.b].frag && sim.fragDone[v.geo.cells[e.a].frag];
        g.beginPath();
        g.moveTo(e.p.x * k, e.p.y * k);
        g.lineTo(e.q.x * k, e.q.y * k);
        if (sameDone) { g.strokeStyle = 'rgba(255,240,206,0.18)'; g.lineWidth = grout * 0.5; }
        else if (a && b) { g.strokeStyle = 'rgba(255,236,190,0.42)'; g.lineWidth = grout * 0.6; }
        else if (a || b) { g.strokeStyle = 'rgba(246,212,136,0.6)'; g.lineWidth = grout * 0.8; }
        else { g.strokeStyle = 'rgba(52,42,40,0.5)'; g.lineWidth = grout; }
        g.stroke();
      }
      this.leadDirty = false;
      return;
    }
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

  /** A caption stays long enough to read twice (round 11: 2.5 s + 70 ms a character, at least 4.5 s). */
  private caption(text: string, px: number, py: number, big: boolean): void {
    const L = this.L;
    this.captions.push({ text, x: L.win.x + px * L.k, y: L.win.y + py * L.k, t: 0, dur: readSec(text), big });
    if (this.captions.length > 3) this.captions.shift();
  }

  private captionCenter(text: string): void {
    const L = this.L;
    // a new centred caption replaces the one before it (they would stand on each other)
    this.captions = this.captions.filter(c => !(c.x === L.win.x + L.win.w / 2 && c.y === L.win.y + L.win.h * 0.55));
    this.captions.push({ text, x: L.win.x + L.win.w / 2, y: L.win.y + L.win.h * 0.55, t: 0, dur: readSec(text), big: false });
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
    if (this.living) {
      // a desktop's mouse over the picture steers the depth; else the phone's tilt, else the slow orbit
      if (!this.opts.touch && this.mouse && this.mouse !== this.lookMouse) {
        const w = this.L.win;
        this.look.point((this.mouse.x - (w.x + w.w / 2)) / (w.w / 2), (this.mouse.y - (w.y + w.h / 2)) / (w.h / 2), this.clock);
        this.lookMouse = this.mouse;
      }
      this.lookNow = this.look.get(this.clock, dt);
    }
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
      if (this.photo) {
        // a thin gallery frame: a dark moulding, a gold fillet next to the picture
        const m = 6 * L.u * sc;
        ctx.fillStyle = '#1d1619';
        ctx.fill(this.winPath(W, m));
        ctx.strokeStyle = 'rgba(255,236,200,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke(this.winPath(W, m));
        ctx.strokeStyle = 'rgba(246,212,136,0.75)';
        ctx.lineWidth = Math.max(1, 1.4 * L.u * sc);
        ctx.stroke(this.winPath(W, 1.2 * L.u * sc));
      } else {
        ctx.fillStyle = '#2b2226';
        const frame = this.winPath(W, 7 * L.u * sc);
        ctx.fill(frame);
        ctx.strokeStyle = 'rgba(246,212,136,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke(frame);
      }
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.clip(this.winPath(W, 0));
    ctx.drawImage(this.paper!, W.x, W.y, W.w, W.h);
    // a living photo: the lit cells show its moment, live (the glass over them keeps only the bevels)
    if (this.living) this.drawLit(ctx, sim, W, sc, finA);
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
      ctx.drawImage(this.frameOf(sim, finA), W.x, W.y, W.w, W.h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.photo && ft >= 0) {
      // an own photo: the mosaic gives way to the photo itself, whole and clear, glowing
      const reveal = smooth(ft, 0.1 * F, 0.3 * F);
      if (reveal > 0.01) {
        const pic = this.frameOf(sim, finA);
        ctx.globalAlpha = reveal;
        ctx.drawImage(pic, W.x, W.y, W.w, W.h);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = reveal * (0.08 + 0.05 * breath);
        ctx.drawImage(pic, W.x, W.y, W.w, W.h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
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
    const key = `${W.x.toFixed(1)},${W.y.toFixed(1)},${W.w.toFixed(1)},${W.h.toFixed(1)},${grow.toFixed(1)},${open},${this.space.shape}`;
    let p = this.paths2.get(key);
    if (!p) {
      if (this.paths2.size > 24) this.paths2.clear();
      p = windowPath(W, grow, open, this.space.shape);
      this.paths2.set(key, p);
    }
    return p;
  }

  /** The breath (0 → 1 → 0): a rest's from its start, whole breaths of 4 in, 6 out (kit/breath); a gentle one elsewhere. */
  private breath(sim: JestemSim): number { return sim.breath.k; }

  /**
   * The picture as it is now: a living photo's frame of this moment (computed once a frame; quieter while the
   * mosaic is coloured, whole in the finale — `finA`), else the still picture.
   */
  private frameOf(sim: JestemSim, finA: number): HTMLCanvasElement {
    if (!this.living) return this.pic!;
    if (this.frameAt !== this.clock || !this.frameNow) {
      this.frameNow = this.living.frame(this.clock, { breath: sim.breath.k, look: this.lookNow, strength: 0.55 + 0.45 * clamp(finA) });
      this.frameAt = this.clock;
    }
    return this.frameNow;
  }

  /** A living photo's lit cells: its moment through their outline (grace's cells at 0.9, as the still glass has them). */
  private drawLit(ctx: CanvasRenderingContext2D, sim: JestemSim, W: Rect, sc: number, finA: number): void {
    if (this.litDirty) {
      this.litDirty = false;
      const lit = new Path2D(), grace = new Path2D();
      let nl = 0, ng = 0;
      this.baked.forEach((b, id) => {
        const p = this.paths[id];
        if (!p) return;
        if (b === 1) { lit.addPath(p); nl++; } else if (b === 2) { grace.addPath(p); ng++; }
      });
      this.litPath = nl ? lit : null;
      this.gracePath = ng ? grace : null;
    }
    if (!this.litPath && !this.gracePath) return;
    const f = this.frameOf(sim, finA);
    ctx.save();
    ctx.translate(W.x, W.y);
    ctx.scale(sc, sc);
    for (const [path, a] of [[this.litPath, 1], [this.gracePath, 0.9]] as const) {
      if (!path) continue;
      ctx.save();
      ctx.clip(path);
      ctx.globalAlpha = a;
      ctx.drawImage(f, 0, 0, this.L.win.w, this.L.win.h);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Stop listening to the phone's tilt (the session ended). */
  dispose(): void { this.look.stop(); }

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
    ctx.fill(this.winPath(W, 7 * this.L.u));
    ctx.fillStyle = PAPER;
    ctx.fill(this.winPath(W, 0));
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
      ctx.drawImage(this.frameOf(sim, 0), 0, 0, this.L.win.w, this.L.win.h);
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
    // a desktop's hover: the part a click would act on, tinted warm and outlined in light over a dark edge (it
    // reads on the pale sketch and on the lit glass alike)
    const hc = this.hoverCell;
    if (hc >= 0 && this.paths[hc] && !this.drag.length) {
      ctx.fillStyle = sim.lit[hc] ? 'rgba(255,246,220,0.14)' : 'rgba(255,206,120,0.22)';
      ctx.fill(this.paths[hc]);
      ctx.strokeStyle = 'rgba(46,26,30,0.55)';
      ctx.lineWidth = 4.5 * this.L.u;
      ctx.stroke(this.paths[hc]);
      ctx.strokeStyle = 'rgba(255,238,196,0.98)';
      ctx.lineWidth = 2 * this.L.u;
      ctx.stroke(this.paths[hc]);
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
    const L = this.L, sc = W.w / L.win.w;
    const o = this.fin >= 0
      ? { x: W.x + (L.oculus.x - L.win.x) * sc, y: W.y + (L.oculus.y - L.win.y) * sc, r: L.oculus.r * sc }
      : L.oculus;
    // a rest: a ring of breath around the gauge, wide on the in-breath, narrow on the out-breath
    if (sim.restBlock && !sim.story) {
      ctx.strokeStyle = `rgba(214,222,255,${0.35 + 0.3 * breath})`;
      ctx.lineWidth = Math.max(1.5, o.r * 0.1);
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * (1.35 + 0.55 * breath), 0, TAU);
      ctx.stroke();
    }
    const col = sim.target >= 0 ? this.vis?.colors[sim.target] : null;
    const rgb = col ? `${col.r | 0},${col.g | 0},${col.b | 0}` : '255,220,160';
    let mode: 'push' | 'rest' | 'night' | 'idle' | 'light' = 'idle';
    let value: number | null = null;
    if (sim.playing && !sim.story) {
      if (sim.blind) mode = 'night';
      else if (sim.pushBlock) { mode = sim.complete ? 'light' : 'push'; value = sim.meter(); }
      else if (sim.restBlock) { mode = 'rest'; value = sim.meter(); }
    }
    paintOculus(ctx, o.x, o.y, o.r, { value, mode, rgb, t: this.clock, breath, plain: this.photo });
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
    // captions never stand on each other: a later one steps down (or up, at the window's foot) past an earlier one
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const c of this.captions) {
      const a = Math.min(1, c.t / 0.4, (c.dur - c.t) / 0.8);
      const k = Math.min(1, c.t / 2.4);
      const px = (c.big ? 21 : 17) * tu(L, 1.2);
      const maxW = L.win.w - 16;
      const size = fitFont(ctx, c.text, maxW, px, 13, 600, true, true);
      ctx.font = font(size, 600, true, true);
      const tw = ctx.measureText(c.text).width;
      const x = clamp(c.x, L.win.x + tw / 2 + 8, L.win.x + L.win.w - tw / 2 - 8);
      const lo = L.win.y + 24, hi = L.win.y + L.win.h - 16;
      let y = clamp(c.y - 18 * ease.outCubic(k), lo, hi);
      const hit = (yy: number) => placed.some(p => Math.abs(p.x - x) < (p.w + tw) / 2 + 6 && Math.abs(p.y - yy) < (p.h + size) * 0.75);
      for (let i = 1; i <= 4 && hit(y); i++) {
        const down = y + size * 1.6 * i, up = y - size * 1.6 * i;
        if (down <= hi && !hit(down)) { y = down; break; }
        if (up >= lo && !hit(up)) { y = up; break; }
      }
      placed.push({ x, y, w: tw, h: size });
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
      paintBubble(ctx, line.text, cx, top, maxW, L.u, a, L.desk);
    }
    if (L.side && this.vis && !sim.story && this.fin < 0) this.drawSide(ctx, sim);
    if (this.vis && this.fin < 0) this.drawNow(ctx, sim);
    if (sim.story) this.drawStory(ctx, sim);
  }

  /**
   * The "what to do now" line (round 11): an icon and a few words for the current phase, the push's cells as pips
   * (lit / to the rest) — under the window, or a subtitle over its lower edge.  It changes only when the action does.
   */
  private drawNow(ctx: CanvasRenderingContext2D, sim: JestemSim): void {
    const now = sim.now;
    if (!now) return;
    const L = this.L, N = L.now;
    const text = t(now.key);
    const b = sim.block;
    const pips = b.kind === 'push' && !b.blind && !sim.complete ? b.cells : 0;
    const px = 14 * (L.desk ? L.u : Math.min(L.u, 1.15));
    const ir = px * 0.62;                      // the icon's radius
    const pipR = Math.max(3, px * 0.24), pipGap = pipR * 2.8;
    const pipW = pips ? pips * pipGap + 6 : 0;
    const padX = 12, inner = N.maxW - 2 * padX - ir * 2 - 10 - pipW;
    const memoKey = `${text}|${Math.round(inner)}|${px}`;
    if (!this.nowMemo || this.nowMemo.key !== memoKey) {
      const f = fitLines(ctx, text, inner, fontPx(px) * 1.3 * 2 + 1, px, MIN_READ, { weight: 650, maxLines: 2 });
      this.nowMemo = { key: memoKey, lines: f.lines, size: f.size };
    }
    const M = this.nowMemo;
    ctx.font = font(M.size, 650);
    const lh = fontPx(M.size) * 1.3;
    const tw = Math.max(...M.lines.map(l => ctx.measureText(l).width));
    const w = Math.min(N.maxW, padX * 2 + ir * 2 + 10 + tw + pipW);
    const h = Math.max(N.h1, M.lines.length * lh + 12);
    const x = N.cx - w / 2;
    const y = N.anchor === 'top' ? N.y : N.y - h;
    ctx.save();
    roundRect(ctx, x, y, w, h, Math.min(h / 2, 16));
    ctx.fillStyle = 'rgba(16,10,20,0.82)';
    ctx.fill();
    ctx.strokeStyle = now.icon === 'breath' ? 'rgba(206,214,255,0.45)' : 'rgba(246,212,136,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    this.nowIcon(ctx, now.icon, x + padX + ir, y + h / 2, ir, sim);
    ctx.fillStyle = '#fbf2de';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tx = x + padX + ir * 2 + 10, ty = y + h / 2 - ((M.lines.length - 1) * lh) / 2;
    M.lines.forEach((l, i) => ctx.fillText(l, tx, ty + i * lh));
    // the push's cells: lit ones gold, the one filling now half, the rest an outline
    if (pips) {
      const lit = Math.min(sim.pushLit, pips);
      const c = sim.target, part = c >= 0 && this.vis ? clamp(sim.ink[c] / this.vis.geo.cells[c].cap) : 0;
      for (let i = 0; i < pips; i++) {
        const px0 = x + w - padX - (pips - i - 0.5) * pipGap, py0 = y + h / 2;
        ctx.beginPath();
        ctx.arc(px0, py0, pipR, 0, TAU);
        if (i < lit) { ctx.fillStyle = GOLD; ctx.fill(); }
        else {
          ctx.strokeStyle = 'rgba(246,212,136,0.7)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          if (i === lit && part > 0.02) {
            ctx.beginPath();
            ctx.moveTo(px0, py0);
            ctx.arc(px0, py0, pipR, -Math.PI / 2, -Math.PI / 2 + TAU * part);
            ctx.closePath();
            ctx.fillStyle = 'rgba(246,212,136,0.8)';
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  /** The now line's icon, drawn (no font needed): a hand's tap, a sun of focus, a moon, a star, a breathing ring, a band without signal. */
  private nowIcon(ctx: CanvasRenderingContext2D, icon: NowIcon, x: number, y: number, r: number, sim: JestemSim): void {
    ctx.save();
    ctx.lineCap = 'round';
    switch (icon) {
      case 'focus': case 'light': {
        const on = sim.flowing || icon === 'light';
        ctx.fillStyle = on ? '#ffd98a' : 'rgba(246,212,136,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.42, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1.2, r * 0.16);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + (on ? this.clock * 0.8 : 0);
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
          ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
          ctx.stroke();
        }
        break;
      }
      case 'breath': {
        const k = sim.breath.k;
        ctx.strokeStyle = 'rgba(214,222,255,0.95)';
        ctx.lineWidth = Math.max(1.4, r * 0.18);
        ctx.beginPath();
        ctx.arc(x, y, r * (0.35 + 0.6 * k), 0, TAU);
        ctx.stroke();
        break;
      }
      case 'night': {
        // a crescent: the disc less a second one, inside the first
        const disc = new Path2D();
        disc.arc(x, y, r * 0.8, 0, TAU);
        ctx.clip(disc);
        ctx.fillStyle = 'rgba(214,222,255,0.95)';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.8, 0, TAU);
        ctx.arc(x + r * 0.38, y - r * 0.22, r * 0.7, 0, TAU);
        ctx.fill('evenodd');
        break;
      }
      case 'tap': {
        const k = (this.clock % 1.6) / 1.6;
        ctx.strokeStyle = `rgba(255,240,200,${0.8 * (1 - k)})`;
        ctx.lineWidth = Math.max(1.2, r * 0.14);
        ctx.beginPath();
        ctx.arc(x, y, r * (0.4 + 0.55 * k), 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#fff1c8';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, TAU);
        ctx.fill();
        break;
      }
      case 'nosignal': {
        ctx.strokeStyle = 'rgba(255,240,214,0.7)';
        ctx.lineWidth = Math.max(1.2, r * 0.16);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.75, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, y + r * 0.5);
        ctx.lineTo(x + r * 0.5, y - r * 0.5);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  /** The column beside the window (wide): the declaration, and the picture's fragments with the lit ones in gold. */
  private drawSide(ctx: CanvasRenderingContext2D, sim: JestemSim): void {
    const L = this.L, S = L.side!, v = this.vis!;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,240,214,0.6)';
    // the whole affirmation (an own one up to 100 characters): wrapped, fitted down to the reading floor, never cut
    const a = sim.affirmation || '…';
    const px = 13 * tu(L, 1.15);
    // under the room Hanna's bubble may take (three lines at most); on a desktop the words stand a little above
    // the window's middle, beside it, rather than up in the corner
    const bubbleRoom = S.y + Math.max(74 * L.u, 98);
    const fit = fitLines(ctx, a, S.w, S.y + S.h - bubbleRoom - 4, 15 * tu(L, 1.2), MIN_READ, { weight: 500, serif: true, italic: true, lead: 1.35 });
    const lines = fit.lines, lh = fit.lh;
    const wordsH = lines.length * lh + 14 + v.geo.frags.length * px * 1.6;
    const top = L.desk ? Math.max(bubbleRoom, Math.min(S.y + (S.h - wordsH) * 0.4, S.y + S.h - wordsH)) : bubbleRoom;
    ctx.font = font(fit.size, 500, true, true);
    lines.forEach((l, i) => ctx.fillText(l, S.x, top + i * lh));
    let y = top + lines.length * lh + 14;
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
    const titlePx = 20 * tu(L, 1.15), textPx = 14 * tu(L, 1.1);
    ctx.font = font(textPx, 500);
    const textLines = wrap(ctx, t(this.photo ? 'story.textOwn' : 'story.text'), C.w - 2 * pad, 6);
    const lh = fontPx(textPx) * 1.4;
    const btnH = st.ask ? Math.max(48, 50 * L.u) : 0;
    const head = pad + titlePx * 1.4 + textLines.length * lh + 10;
    // a desktop's small print grows with the screen (k), a phone's stays at its 13 px
    const k = L.desk ? L.u : 1;
    const foot = st.ask ? 22 * k + btnH + pad + 8 : 34 * k;
    const verseH = Math.max(40, C.h - head - foot);
    const pass = passage('php2.9-10');
    const pl = layoutPassage(ctx, pass, C.w - 2 * pad, verseH, { max: 15 * tu(L, 1.1), min: 12 });
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
      ctx.font = font(13 * k, 600);
      ctx.textAlign = 'left';
      ctx.fillText(t('story.ask'), box.x + pad, b1.y - 20 * k);
      ([[b1, 'm'], [b2, 'f']] as const).forEach(([b, f], i) => {
        roundRect(ctx, b.x, b.y, b.w, b.h, 14);
        ctx.fillStyle = this.pressed === i ? 'rgba(246,212,136,0.35)' : this.hoverForm === i ? 'rgba(246,212,136,0.25)' : 'rgba(246,212,136,0.14)';
        ctx.fill();
        ctx.strokeStyle = GOLD;
        ctx.stroke();
        const word = this.formWord?.(f) ?? '';
        const text = t('label', { word });
        const sz = fitFont(ctx, text, b.w - 16, 15 * tu(L, 1.1), 12, 600, true);
        ctx.font = font(sz, 600, true);
        ctx.fillStyle = '#ffe9b0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2);
      });
    } else {
      ctx.fillStyle = 'rgba(244,234,216,0.6)';
      ctx.font = font(13 * k, 600);
      ctx.textAlign = 'center';
      ctx.fillText(t(this.opts.touch ? 'story.tap' : 'story.click'), box.x + box.w / 2, box.y + box.h - 26 * k);
    }
    ctx.restore();
  }

  /** The word in each Polish form, for the card's answers (set by the game). */
  formWord: ((f: 'm' | 'f') => string) | null = null;

  /** The finale's writing: the declaration letter by letter, in the serif, wrapped to its box, and its verse under it. */
  private drawFinale(ctx: CanvasRenderingContext2D, sim: JestemSim): void {
    const ft = this.fin, F = this.F;
    const L = this.L, T = L.finText;
    const start = 0.24 * F;
    if (ft < start) return;
    const word = this.word;
    const key = `${T.w}x${T.h}|${word}|${this.vis?.decl ?? 'own'}`;
    if (!this.finText || this.finText.key !== key) {
      // a declaration: "Przez potężne imię Jezusa" / "ja jestem kochany."; an own vision: "…" / "ja {continuation}."
      const [a, b] = this.vis?.decl ? [t('sentence.a'), t('sentence.b', { word })] : ownSentenceParts(word);
      const lay = layoutFinale(ctx, a, b, T.w, T.h, L.u);
      const pass = T.h - lay.height > 50 ? layoutPassage(ctx, passage(sim.verse), T.w, T.h - lay.height - 16, { max: 15 * tu(L, 1.15), min: 12 }) : null;
      const count = (ls: string[]) => ls.reduce((n, l) => n + [...l].length, 0);
      this.finText = { a: lay.a, b: lay.b, size: lay.sizeA, sizeB: lay.sizeB, lhA: lay.lhA, lhB: lay.lhB, nA: count(lay.a), nB: count(lay.b), pass, key };
    }
    const X = this.finText;
    // letters a second: at least 16, quicker when the finale is short or the words long (all written by 60 % of it)
    const cps = Math.max(16, (X.nA + X.nB) / (0.34 * F));
    const nA = Math.floor((ft - start) * cps);
    const nB = Math.floor((ft - start - X.nA / cps - 0.25) * cps * 0.85);
    const cx = T.x + T.w / 2;
    const textH = X.a.length * X.lhA + 8 + X.b.length * X.lhB;
    let y = T.y + (L.side ? Math.max(0, (T.h - (textH + 12 + (X.pass?.height ?? 0))) / 2) : 4);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.typeLines(ctx, X.a, nA, cx, y, X.size, X.lhA, 600, '#fbefd8');
    y += X.a.length * X.lhA + 8;
    this.typeLines(ctx, X.b, nB, cx, y, X.sizeB, X.lhB, 700, '#ffd98a');
    y += X.b.length * X.lhB + 12;
    const written = start + (X.nA + X.nB / 0.85) / cps + 0.3;
    const verseA = smooth(ft, written + 0.04 * F, written + 0.14 * F);
    if (X.pass && verseA > 0) {
      ctx.globalAlpha = verseA;
      drawPassage(ctx, passage(sim.verse), X.pass, cx, y, { text: 'rgba(255,240,214,0.92)', ref: 'rgba(255,236,200,0.62)' });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** Lines written letter by letter, each centred: the newest letter glows a little. */
  private typeLines(ctx: CanvasRenderingContext2D, lines: string[], n: number, cx: number, y: number, size: number, lh: number, weight: number, color: string): void {
    if (n <= 0) return;
    ctx.font = font(size, weight, true);
    ctx.fillStyle = color;
    let left = n;
    for (let i = 0; i < lines.length && left > 0; i++) {
      const chars = [...lines[i]];
      const full = ctx.measureText(lines[i]).width;
      const shown = chars.slice(0, Math.min(chars.length, left)).join('');
      const x0 = cx - full / 2, ly = y + i * lh;
      ctx.fillText(shown, x0, ly);
      if (left < chars.length + 3 && left <= chars.length) {
        const wNow = ctx.measureText(shown).width;
        blit(ctx, glowSprite('255,226,160'), x0 + wNow, ly + size * 0.5, size * 2.4, size * 2.4, 0.5);
      }
      left -= chars.length;
    }
  }

  /**
   * The picture coordinates under a point of the canvas, held to the window's edge: a tap beside the window
   * still sends the colour to the nearest part of it (null only above the band, under the HUD).
   */
  toPicture(x: number, y: number): { x: number; y: number } | null {
    const W = this.L.win;
    if (y < this.L.band.y) return null;
    return { x: clamp((x - W.x) / this.L.k, 0, this.space.w), y: clamp((y - W.y) / this.L.k, 0, this.space.h) };
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

