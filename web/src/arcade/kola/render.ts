/**
 * Koła światła's picture (DESIGN.md §28), canvas 2D, every frame from the sim:
 *
 *   the night    a deep indigo sky with faint stars and a soft light round the figure (baked per size)
 *   the figure   the calm person in profile, standing or seated, a body of pearl light with a rim, the near arm, the
 *                spine's thread of light the wheels' tips sit on (baked once per size at the closest zoom, drawn scaled)
 *   the wheels   twelve funnels (wheel.ts): the back ones behind the body and softly dimmed, the front ones, the first
 *                (down) and the seventh (up) in front; the wheel the work is at lifted, a gold ring while focus brings it
 *                true, a flash when it turns true and when its pair balances
 *   the field    seven nested layers of the egg round the figure, filling one after another in the seven colours, then
 *                one white-gold light; motes of light streaming from the mouths out into it
 *   the camera   the whole figure for the arrival and the field; one centre (its front and back) for its wheels — eased
 *                (τ 0.9 s), a soft cut through the dark with reduced motion
 *   the words    the name card (the wheel's name and side, its place in the way, the qualities as chips), the narrator,
 *                the place's prayer, a passage, the field's prayer, the blessing; the breath guide in the rests
 */
import { breathGuideBox, breathOf, drawBreathGuide } from '../kit/breathguide';
import { approach, clamp } from '../kit/juice';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageId, type PassageLayout } from '../kit/scripture';
import type { Insets, TapTarget } from '../kit/types';
import { CENTRES, HUE, WHEELS, wheelOf, type CentreId, type Quality, type WheelId } from './content';
import { SPINE, STOOL, armOutline, bodyOutline, eggOf, floorOf, frameBox, wheelGeom, type Box } from './figure';
import { spline } from '../kit/figure';
import { t, type Key } from './i18n';
import { layout, type Layout, type Rect } from './layout';
import type { Posture } from './meta';
import { FONT, GOLD_HI, INK, NIGHT, PEARL, SERIF, TAU, centreSprites, glow, hash, makeCanvas, rgba, roundRect, sharedSprites, type Canvas2D } from './paint';
import type { KolaSim, SimEvent, WheelRun } from './sim';
import { drawWheel, spinOf, type ScreenGeom, type WheelLook } from './wheel';

interface Cam { x: number; y: number; s: number }
interface Mote { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; c: CentreId }

/** The closest the camera comes to a centre (px per figure unit): a mouth of ~70 px on the largest screen. */
const S_MAX = 1050;

export class KolaView {
  private readonly ctx: CanvasRenderingContext2D | null;
  private l: Layout;
  private dpr = 1;
  private time = 0;
  private cam: Cam = { x: 0, y: 0.45, s: 100 };
  private sWhole = 100;
  private aim: CentreId | 'whole' = 'whole';
  private veil = 0;
  private bg: Canvas2D | null = null;
  private fig: { c: Canvas2D; box: Box; s: number } | null = null;
  private figNear: { c: Canvas2D; box: Box; s: number } | null = null;
  private sNear = 100;
  private layers: { c: Canvas2D; box: Box; s: number }[] = [];
  private gold: { c: Canvas2D; box: Box; s: number } | null = null;
  private readonly phi = new Map<WheelId, number>();
  private readonly flash = new Map<WheelId, number>();
  private readonly goldK = new Map<WheelId, number>();
  private readonly motes: Mote[] = [];
  private moteAcc = 0;
  private verseCache = new Map<string, PassageLayout>();
  private fitCache = new Map<string, { size: number; lines: string[] }>();
  private lastWords = '';
  private readonly posture: Posture;
  private reshow = 0;

  constructor(canvas: HTMLCanvasElement, private readonly o: { reducedMotion: boolean; touch: boolean; posture: Posture }) {
    this.ctx = canvas.getContext('2d');
    this.posture = o.posture;
    this.l = layout(1, 1, { top: 0, right: 0, bottom: 0, left: 0 });
    for (const w of WHEELS) { this.phi.set(w.id, 0); this.flash.set(w.id, 0); this.goldK.set(w.id, 0); }
  }

  get layoutNow(): Layout { return this.l; }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = Math.max(1, Math.min(3, dpr || 1));
    this.l = layout(w, h, ins);
    this.verseCache.clear();
    this.fitCache.clear();
    const box = frameBox('whole', this.posture);
    const fr = this.l.frame;
    this.sWhole = Math.max(20, Math.min(fr.w / (box.x1 - box.x0), fr.h / (box.y1 - box.y0)));
    this.cam = this.camFor(this.aim);
    this.bake();
  }

  // ── the camera ─────────────────────────────────────────────────

  private camFor(what: CentreId | 'whole'): Cam {
    const b = frameBox(what, this.posture), fr = this.l.frame;
    const s = what === 'whole' ? this.sWhole : Math.min(fr.w / (b.x1 - b.x0), fr.h / (b.y1 - b.y0), S_MAX);
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s: Math.max(this.sWhole, s) };
  }

  private aimOf(sim: KolaSim): CentreId | 'whole' {
    if (!sim.started) return 'whole';
    const w = sim.block.what;
    if (w === 'arrive' || w === 'field' || w === 'close') return 'whole';
    if (w === 'rest' && sim.prayFor) return wheelOf(sim.prayFor.wheel).centre;
    return wheelOf(sim.wheel).centre;
  }

  private sx(x: number): number { const fr = this.l.frame; return fr.x + fr.w / 2 + (x - this.cam.x) * this.cam.s; }
  private sy(y: number): number { const fr = this.l.frame; return fr.y + fr.h / 2 + (y - this.cam.y) * this.cam.s; }

  // ── baking: the night, the figure, the field's layers ──────────

  private bake(): void {
    const l = this.l, d = this.dpr;
    // the night
    const bg = makeCanvas(l.w * d, l.h * d), g = bg?.getContext('2d');
    if (bg && g) {
      g.scale(d, d);
      const sky = g.createLinearGradient(0, 0, 0, l.h);
      sky.addColorStop(0, NIGHT[0]);
      sky.addColorStop(0.55, NIGHT[1]);
      sky.addColorStop(1, NIGHT[2]);
      g.fillStyle = sky;
      g.fillRect(0, 0, l.w, l.h);
      const st = l.stage;
      const cx = st.x + st.w / 2, cy = st.y + st.h * 0.48, R = Math.max(st.w, st.h) * 0.62;
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      halo.addColorStop(0, 'rgba(120,110,220,0.16)');
      halo.addColorStop(0.5, 'rgba(70,60,160,0.07)');
      halo.addColorStop(1, 'rgba(20,16,60,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, l.w, l.h);
      const n = Math.round((l.w * l.h) / 5200);
      for (let i = 0; i < n; i++) {
        const x = hash(i * 3 + 1) * l.w, y = hash(i * 7 + 2) * l.h, r = 0.4 + hash(i * 11 + 5) * 0.9;
        g.fillStyle = `rgba(230,226,255,${(0.12 + 0.4 * hash(i * 13 + 7)).toFixed(3)})`;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      const vig = g.createRadialGradient(l.w / 2, l.h / 2, Math.min(l.w, l.h) * 0.35, l.w / 2, l.h / 2, Math.hypot(l.w, l.h) * 0.62);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(2,2,10,0.55)');
      g.fillStyle = vig;
      g.fillRect(0, 0, l.w, l.h);
    }
    this.bg = bg;
    this.bakeFigure();
    this.bakeField();
  }

  /**
   * The figure baked twice: at the whole figure's scale and at the closest zoom (at most ~5 M device pixels), so its
   * rim of light keeps its fine width at both; the camera crossfades them as it zooms.
   */
  private bakeFigure(): void {
    this.sNear = Math.max(this.sWhole * 1.05, ...CENTRES.map(c => this.camFor(c).s));
    this.fig = this.bakeFigureAt(this.sWhole * this.dpr);
    this.figNear = this.bakeFigureAt(this.sNear * this.dpr);
  }

  private bakeFigureAt(scale: number): { c: Canvas2D; box: Box; s: number } | null {
    const box = frameBox('whole', this.posture);
    let s = scale;
    const area = (box.x1 - box.x0) * (box.y1 - box.y0) * s * s;
    if (area > 5e6) s *= Math.sqrt(5e6 / area);
    const c = makeCanvas((box.x1 - box.x0) * s, (box.y1 - box.y0) * s), g = c?.getContext('2d');
    if (!c || !g) return null;
    const map = (x: number, y: number): [number, number] => [(x - box.x0) * s, (y - box.y0) * s];
    // line widths in device pixels, a little bolder when near
    const px = this.dpr * Math.pow(s / (this.sWhole * this.dpr), 0.35);
    const post = this.posture;
    // the floor's soft light
    const fl = floorOf(post);
    const [fx, fy] = map(post === 'sit' ? 0.12 : 0.03, fl);
    g.save();
    g.translate(fx, fy);
    g.scale(1, 0.16);
    const floor = g.createRadialGradient(0, 0, 0, 0, 0, 0.32 * s);
    floor.addColorStop(0, 'rgba(170,160,255,0.22)');
    floor.addColorStop(1, 'rgba(170,160,255,0)');
    g.fillStyle = floor;
    g.beginPath();
    g.arc(0, 0, 0.32 * s, 0, TAU);
    g.fill();
    g.restore();
    // the stool of the seated posture: light wood, faint
    if (post === 'sit') {
      g.fillStyle = 'rgba(150,130,190,0.16)';
      g.strokeStyle = 'rgba(210,196,255,0.42)';
      g.lineWidth = 1.2 * px;
      const [sx0, sy0] = map(STOOL.seat.x0, STOOL.seat.y), [sx1, sy1] = map(STOOL.seat.x1, STOOL.seat.y + STOOL.seat.h);
      roundRect(g, sx0, sy0, sx1 - sx0, sy1 - sy0, 3 * px);
      g.fill();
      g.stroke();
      for (const [x0, y0, x1, y1] of STOOL.legs) {
        const [a, b] = map(x0, y0), [cc, dd] = map(x1, y1);
        g.beginPath();
        g.moveTo(a, b);
        g.lineTo(cc, dd);
        g.lineWidth = 3 * px;
        g.strokeStyle = 'rgba(190,176,240,0.26)';
        g.stroke();
      }
    }
    // the body of light: a soft aura, a pearl fill, the rim
    const body = new Path2D();
    spline(body, bodyOutline(post), map, true);
    g.save();
    g.shadowColor = 'rgba(170,160,255,0.55)';
    g.shadowBlur = 26 * px;
    const [cx0, cy0] = map(0, 0.3), [, cy1] = map(0, fl);
    const fill = g.createLinearGradient(0, cy0 - 0.3 * s, 0, cy1);
    fill.addColorStop(0, 'rgba(206,200,255,0.2)');
    fill.addColorStop(0.45, 'rgba(150,150,240,0.13)');
    fill.addColorStop(1, 'rgba(110,110,210,0.1)');
    g.fillStyle = fill;
    g.fill(body);
    g.restore();
    const inner = g.createRadialGradient(cx0, cy0, 0, cx0, cy0, 0.45 * s);
    inner.addColorStop(0, 'rgba(255,250,255,0.08)');
    inner.addColorStop(1, 'rgba(255,250,255,0)');
    g.fillStyle = inner;
    g.fill(body);
    g.strokeStyle = rgba(PEARL, 0.62);
    g.lineWidth = 1.8 * px;
    g.stroke(body);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 4.5 * px;
    g.globalCompositeOperation = 'lighter';
    g.stroke(body);
    g.globalCompositeOperation = 'source-over';
    // the near arm: a softer shape over the body
    const arm = new Path2D();
    spline(arm, armOutline(post), map, true);
    g.fillStyle = 'rgba(190,186,255,0.07)';
    g.fill(arm);
    g.strokeStyle = rgba(PEARL, 0.3);
    g.lineWidth = 1.2 * px;
    g.stroke(arm);
    // the spine's thread of light
    const spine = new Path2D();
    spline(spine, SPINE, map, false);
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(200,190,255,0.16)';
    g.lineWidth = 7 * px;
    g.stroke(spine);
    g.strokeStyle = 'rgba(240,236,255,0.38)';
    g.lineWidth = 1.6 * px;
    g.stroke(spine);
    g.globalCompositeOperation = 'source-over';
    return { c, box, s };
  }

  private bakeField(): void {
    this.layers = [];
    this.gold = null;
    const e = eggOf(this.posture);
    const box: Box = { x0: e.cx - e.rx * 1.08, y0: e.cy - e.ry * 1.08, x1: e.cx + e.rx * 1.08, y1: e.cy + e.ry * 1.08 };
    const s = Math.min(this.sWhole * this.dpr * 1.2, 1800 / (box.y1 - box.y0));
    const W = (box.x1 - box.x0) * s, H = (box.y1 - box.y0) * s;
    const ring = (paint: (g: CanvasRenderingContext2D) => void): Canvas2D | null => {
      const c = makeCanvas(W, H), g = c?.getContext('2d');
      if (!c || !g) return null;
      g.translate(W / 2, H / 2);
      g.scale(1, e.ry / e.rx);
      paint(g);
      return c;
    };
    const R = e.rx * s;
    CENTRES.forEach((c, i) => {
      const a = 0.42 + (0.58 * i) / 7, b = 0.42 + (0.58 * (i + 1)) / 7;
      const cv = ring(g => {
        const gr = g.createRadialGradient(0, 0, Math.max(0, (a - 0.07) * R), 0, 0, (b + 0.05) * R);
        gr.addColorStop(0, rgba(HUE[c].hue, 0));
        gr.addColorStop(0.45, rgba(HUE[c].hue, 0.42));
        gr.addColorStop(0.75, rgba(HUE[c].hue, 0.3));
        gr.addColorStop(1, rgba(HUE[c].hue, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, (b + 0.05) * R, 0, TAU);
        g.fill();
      });
      if (cv) this.layers.push({ c: cv, box, s });
    });
    const gc = ring(g => {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.04);
      gr.addColorStop(0, 'rgba(255,250,236,0.34)');
      gr.addColorStop(0.55, 'rgba(255,236,190,0.22)');
      gr.addColorStop(0.86, 'rgba(255,226,160,0.42)');
      gr.addColorStop(0.95, 'rgba(255,240,210,0.6)');
      gr.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, R * 1.04, 0, TAU);
      g.fill();
    });
    if (gc) this.gold = { c: gc, box, s };
  }

  /** A baked layer (figure units box at its own scale) drawn through the camera. */
  private blit(ctx: CanvasRenderingContext2D, b: { c: Canvas2D; box: Box }, alpha = 1): void {
    if (alpha <= 0.003) return;
    const x0 = this.sx(b.box.x0), y0 = this.sy(b.box.y0), x1 = this.sx(b.box.x1), y1 = this.sy(b.box.y1);
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * Math.min(1, alpha);
    ctx.drawImage(b.c, x0, y0, x1 - x0, y1 - y0);
    ctx.globalAlpha = was;
  }

  // ── events and time ────────────────────────────────────────────

  on(e: SimEvent, sim: KolaSim): void {
    switch (e.type) {
      case 'true':
        this.flash.set(e.wheel, 1);
        this.burst(e.wheel, 14);
        break;
      case 'pair':
        this.flash.set(`${e.centre}F` as WheelId, 1);
        this.flash.set(`${e.centre}B` as WheelId, 1);
        break;
      case 'tap':
        this.reshow = sim.t + 2.4;
        break;
      default:
        break;
    }
  }

  update(dt: number, sim: KolaSim): void {
    const step = Math.max(0, Math.min(0.1, dt));
    this.time += step;
    // the camera: ease to its aim (log-zoom); with reduced motion a soft cut through the dark
    const aim = this.aimOf(sim);
    const want = this.camFor(aim);
    if (aim !== this.aim) {
      this.aim = aim;
      if (this.o.reducedMotion) this.veil = 1;
    }
    if (this.o.reducedMotion) {
      if (this.veil > 0.5) this.cam = want;
      this.veil = Math.max(0, this.veil - step * 1.6);
    } else {
      const k = 1 - Math.exp(-step / 0.9);
      this.cam.x += (want.x - this.cam.x) * k;
      this.cam.y += (want.y - this.cam.y) * k;
      this.cam.s = Math.exp(Math.log(this.cam.s) + (Math.log(want.s) - Math.log(this.cam.s)) * k);
    }
    // each wheel turns at its own speed for its trueness; the flashes fade; the gold follows focus
    for (const w of sim.wheels) {
      const turn = sim.quality(w, 'turn');
      const sp = spinOf(w.fault, turn, this.time, this.o.reducedMotion);
      this.phi.set(w.id, (this.phi.get(w.id) ?? w.fault.phase) + sp * step);
      this.flash.set(w.id, Math.max(0, (this.flash.get(w.id) ?? 0) - step / 1.6));
      const on = sim.pushBlock && sim.rate > 0 && w.id === sim.wheel ? 1 : 0;
      this.goldK.set(w.id, approach(this.goldK.get(w.id) ?? 0, on, step, 0.35));
    }
    // the field's motes: light streaming from the mouths out into the egg
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += step;
      if (m.age >= m.life) { this.motes.splice(i, 1); continue; }
      m.x += m.vx * step;
      m.y += m.vy * step;
      m.vx *= 1 - 0.4 * step;
      m.vy *= 1 - 0.4 * step;
    }
    if (!this.o.reducedMotion && sim.block.what === 'field' && sim.fieldK < 0.9) {
      this.moteAcc += step * 22;
      while (this.moteAcc >= 1 && this.motes.length < 90) {
        this.moteAcc -= 1;
        const w = sim.wheels[Math.floor(hash(Math.floor(this.time * 97) + this.motes.length) * 12)];
        if (!w.r[0].done && hash(Math.floor(this.time * 31)) > 0.25) continue;
        const g = wheelGeom(w.id, this.posture);
        const sp = 0.07 + 0.05 * hash(Math.floor(this.time * 53));
        const sideways = (hash(Math.floor(this.time * 71)) - 0.5) * 0.08;
        this.motes.push({ x: g.mouth[0], y: g.mouth[1], vx: g.ax * sp - g.ay * sideways, vy: g.ay * sp + g.ax * sideways, age: 0, life: 2.4 + hash(this.motes.length) * 1.4, size: 0.008 + 0.008 * hash(this.motes.length + 9), c: w.centre });
      }
    }
  }

  private burst(id: WheelId, n: number): void {
    if (this.o.reducedMotion) return;
    const g = wheelGeom(id, this.posture);
    for (let i = 0; i < n && this.motes.length < 110; i++) {
      const a = (i / n) * TAU + hash(i + Math.floor(this.time * 10)) * 0.5;
      const sp = 0.05 + 0.05 * hash(i * 3 + Math.floor(this.time * 7));
      this.motes.push({ x: g.mouth[0], y: g.mouth[1], vx: Math.cos(a) * sp * 0.5 + g.ax * sp, vy: Math.sin(a) * sp + g.ay * sp, age: 0, life: 1.2 + hash(i) * 0.6, size: 0.006, c: wheelOf(id).centre });
    }
  }

  // ── drawing ───────────────────────────────────────────────────

  draw(sim: KolaSim, intro = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = this.l, d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    else {
      ctx.fillStyle = NIGHT[1];
      ctx.fillRect(0, 0, l.w * d, l.h * d);
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const fieldOn = sim.block.what === 'field' || sim.block.what === 'close';
    // the field's layers behind the figure
    if (fieldOn) {
      ctx.globalCompositeOperation = 'lighter';
      this.layers.forEach((L, i) => this.blit(ctx, L, sim.block.what === 'close' ? sim.layerFill(i) * (1 - 0.5 * sim.whole) : sim.layerFill(i) * (1 - 0.55 * sim.whole)));
      if (this.gold) this.blit(ctx, this.gold, sim.whole * 0.95);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the back wheels, behind the body
    ctx.globalCompositeOperation = 'lighter';
    for (const w of sim.wheels) if (w.side === 'back') this.drawOne(ctx, sim, w);
    ctx.globalCompositeOperation = 'source-over';
    // the figure: the whole's bake and the near one's, crossfaded by the zoom
    const k = clamp(Math.log(this.cam.s / this.sWhole) / Math.log(Math.max(1.0001, this.sNear / this.sWhole)));
    if (this.fig && k < 0.999) this.blit(ctx, this.fig, 1 - k);
    if (this.figNear && k > 0.001) this.blit(ctx, this.figNear, k);
    ctx.globalCompositeOperation = 'lighter';
    for (const w of sim.wheels) if (w.side !== 'back') this.drawOne(ctx, sim, w);
    // the white-gold over the figure too, and the motes
    if (fieldOn && this.gold) this.blit(ctx, this.gold, sim.whole * 0.35);
    this.drawMotes(ctx);
    ctx.globalCompositeOperation = 'source-over';
    if (this.veil > 0.01) {
      ctx.fillStyle = `rgba(4,4,16,${0.85 * this.veil})`;
      ctx.fillRect(0, 0, l.w, l.h);
    }
    if (!intro && sim.started) {
      this.drawTitle(ctx, sim);
      this.drawWords(ctx, sim);
    }
  }

  private geomOf(id: WheelId): ScreenGeom {
    const g = wheelGeom(id, this.posture);
    return { tx: this.sx(g.tip[0]), ty: this.sy(g.tip[1]), ax: g.ax, ay: g.ay, len: g.len * this.cam.s, r: g.r * this.cam.s };
  }

  private lookOf(sim: KolaSim, w: WheelRun): WheelLook {
    const q = (k: Quality): number => sim.quality(w, k);
    const current = sim.started && (sim.pushBlock || sim.block.what === 'rest') && w.id === sim.wheel;
    const prayed = sim.block.what === 'rest' && sim.prayFor?.wheel === w.id;
    const field = sim.block.what === 'field' || sim.block.what === 'close';
    const arrive = !sim.started || sim.block.what === 'arrive';
    const lift = field ? 0.35 + 0.4 * sim.whole : prayed ? 0.55 : current ? 0.6 : arrive ? 0.3 : 0;
    const dimBase = w.side === 'back' ? 1 : 0;
    const awaiting = !w.r[0].done && !current;
    return {
      centre: w.centre, axis: q('axis'), turn: q('turn'), petals: q('petals'), colour: q('colour'), size: q('size'),
      inner: q('inner'), deep: q('deep'), rays: q('rays'), halo: q('halo'), fault: w.fault,
      phi: this.phi.get(w.id) ?? 0, time: this.time + w.fault.phase * 3, lift, lit: w.lit[0],
      gold: this.goldK.get(w.id) ?? 0, flash: this.flash.get(w.id) ?? 0,
      dim: Math.min(1, dimBase * (current || prayed ? 0.4 : 1) + (awaiting && sim.started ? 0.2 : 0)),
      calm: prayed ? sim.calm : 0, reduced: this.o.reducedMotion,
    };
  }

  private drawOne(ctx: CanvasRenderingContext2D, sim: KolaSim, w: WheelRun): void {
    const S = centreSprites()[w.centre];
    drawWheel(ctx, this.geomOf(w.id), this.lookOf(sim, w), S, sharedSprites().white);
  }

  private drawMotes(ctx: CanvasRenderingContext2D): void {
    if (!this.motes.length) return;
    const sp = centreSprites();
    for (const m of this.motes) {
      const a = Math.sin((m.age / m.life) * Math.PI);
      const r = Math.max(1.2, m.size * this.cam.s);
      glow(ctx, sp[m.c].glow, this.sx(m.x), this.sy(m.y), r * 2.2, 0.7 * a);
    }
  }

  // ── the name card ──────────────────────────────────────────────

  private drawTitle(ctx: CanvasRenderingContext2D, sim: KolaSim): void {
    const l = this.l, b = sim.block, r = l.title;
    let name: string, sub: string, chips: { q: Quality; state: 0 | 1 | 2 }[] = [];
    let a = 1;
    if (b.what === 'arrive') {
      name = t('title.arrive');
      sub = t('title.arriveSub');
      a = clamp(sim.blockT / 1.2);
    } else if (b.what === 'field' || b.what === 'close') {
      name = t('title.field');
      sub = t('title.fieldSub');
      a = clamp(sim.blockT / 1.2);
    } else {
      const id = b.what === 'rest' && sim.prayFor ? sim.prayFor.wheel : sim.wheel;
      const wh = wheelOf(id);
      const round = b.what === 'rest' && sim.prayFor ? sim.prayFor.round : sim.round;
      name = `${t(`name.${wh.centre}` as Key)} · ${t(`side.${wh.side}` as Key)}`;
      const i = WHEELS.findIndex(x => x.id === id) + 1;
      const gift = t(`gift.${wh.centre}` as Key);
      const firstOfRound = b.what === 'push' && round > 1 && sim.plan.groups[b.group]?.wheels[0] === 'root' && sim.blockT < 6;
      sub = firstOfRound ? t(round === 2 ? 'title.round2' : 'title.round3')
        : sim.plan.rounds.length > 1 ? t('title.subR', { r: round, i, gift }) : t('title.sub', { i, gift });
      chips = this.chipsOf(sim, id, round);
    }
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    if (l.kind === 'tall') {
      const g = ctx.createLinearGradient(0, r.y - 6, 0, r.y + r.h + 8);
      g.addColorStop(0, 'rgba(4,4,16,0.62)');
      g.addColorStop(0.7, 'rgba(4,4,16,0.32)');
      g.addColorStop(1, 'rgba(4,4,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(r.x - 10, r.y - 6, r.w + 20, r.h + 14);
    } else {
      ctx.fillStyle = 'rgba(8,8,24,0.5)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 16);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tight = r.h < 70;
    const big = Math.round(l.kind === 'wide' ? Math.min(34, l.font * 1.65) : tight ? 19 : 22);
    const small = tight ? 13 : Math.max(13, Math.round(l.font - 1));
    const cx = r.x + r.w / 2;
    let y = r.y + (l.kind === 'tall' ? 2 : 10);
    ctx.font = `600 ${big}px ${SERIF}`;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fbf6ff';
    ctx.fillText(this.fitLine(ctx, name, r.w - 16), cx, y);
    y += big + 4;
    ctx.font = `500 ${small}px ${FONT}`;
    ctx.fillStyle = 'rgba(236,230,255,0.9)';
    ctx.fillText(this.fitLine(ctx, sub, r.w - 16), cx, y);
    y += small + 7;
    ctx.shadowBlur = 0;
    if (chips.length && y + small + 8 <= r.y + r.h + 10) this.drawChips(ctx, chips, cx, y, r.w - 12, small);
    ctx.restore();
  }

  /** The qualities of the wheel's round: done (1), now (2), still to come (0). */
  private chipsOf(sim: KolaSim, id: WheelId, round: 1 | 2 | 3): { q: Quality; state: 0 | 1 | 2 }[] {
    const w = sim.run(id), rr = w.r[round - 1];
    const now = rr.done ? -1 : rr.p.findIndex(x => x < 1);
    const out: { q: Quality; state: 0 | 1 | 2 }[] = [];
    rr.steps.forEach((qs, s) => { for (const q of qs) out.push({ q, state: rr.done || rr.p[s] >= 1 ? 1 : s === now && sim.pushBlock ? 2 : 0 }); });
    return out;
  }

  private drawChips(ctx: CanvasRenderingContext2D, chips: { q: Quality; state: 0 | 1 | 2 }[], cx: number, y: number, maxW: number, px: number): void {
    let size = Math.max(13, px - 1);
    let pad = 8, gap = 5;
    let widths: number[] = [];
    for (;;) {
      ctx.font = `600 ${size}px ${FONT}`;
      widths = chips.map(c => ctx.measureText(t(`q.${c.q}` as Key)).width + 2 * pad);
      const total = widths.reduce((s, w) => s + w, 0) + gap * (chips.length - 1);
      if (total <= maxW) break;
      if (size > 13) size -= 1;
      else if (pad > 5) { pad = 5; gap = 3; }
      else break;
    }
    const total = widths.reduce((s, w) => s + w, 0) + gap * (chips.length - 1);
    let x = cx - total / 2;
    const h = size + 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chips.forEach((c, i) => {
      const w = widths[i];
      roundRect(ctx, x, y, w, h, h / 2);
      if (c.state === 1) {
        ctx.fillStyle = 'rgba(245,198,106,0.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,241,196,0.9)';
      } else if (c.state === 2) {
        ctx.fillStyle = `rgba(245,198,106,${(0.16 + 0.1 * Math.sin(this.time * 3)).toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = GOLD_HI;
      } else {
        ctx.fillStyle = 'rgba(10,10,28,0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,214,255,0.32)';
      }
      ctx.lineWidth = c.state === 2 ? 1.6 : 1;
      ctx.stroke();
      ctx.fillStyle = c.state === 1 ? '#2a1c06' : c.state === 0 ? 'rgba(226,222,255,0.72)' : '#fff8e8';
      ctx.font = `600 ${size}px ${FONT}`;
      ctx.fillText(t(`q.${c.q}` as Key), x + w / 2, y + h / 2 + 0.5);
      x += w + gap;
    });
  }

  private fitLine(ctx: CanvasRenderingContext2D, s: string, w: number): string {
    if (ctx.measureText(s).width <= w) return s;
    let x = s;
    while (x.length > 3 && ctx.measureText(`${x}…`).width > w) x = x.slice(0, -1);
    return `${x.trimEnd()}…`;
  }

  // ── the band: the narrator, a prayer, a passage; the guide ──────

  private drawWords(ctx: CanvasRenderingContext2D, sim: KolaSim): void {
    const band = this.l.band, b = sim.block;
    const guided = b.what === 'rest' || b.what === 'field' || b.what === 'arrive';
    if (guided) this.drawGuide(ctx, sim);
    if (b.what === 'close') {
      const a = clamp(sim.blockT / 1.2);
      if (sim.closeShows === 'verse' && sim.card) this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8));
      else this.drawPrayer(ctx, [t('bless.end')], band, a);
      return;
    }
    if (b.what === 'field') {
      const fs = sim.fieldShows;
      if (fs === 'prayer') { this.drawPrayer(ctx, [t('prayer.field')], band, 1); return; }
      if (fs === 'verse' && sim.card) { this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8)); return; }
    }
    if (b.what === 'rest') {
      const rs = sim.restShows;
      if (rs === 'verse' && sim.card) { this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8)); return; }
      if (rs === 'prayer') {
        const text = sim.prayer;
        this.lastWords = text;
        this.drawPrayer(ctx, [text], band, clamp(sim.blockT / 1.2) * clamp(sim.left / 0.8));
        return;
      }
    }
    if (b.what === 'arrive' && sim.card) { this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8)); return; }
    const ln = sim.talk.line;
    if (ln) {
      this.lastWords = ln.text;
      this.drawLine(ctx, ln.text, band, clamp(ln.t / 0.5) * clamp((ln.dur - ln.t) / 0.6));
    } else if (sim.t < this.reshow && this.lastWords) this.drawLine(ctx, this.lastWords, band, clamp((this.reshow - sim.t) / 0.6));
  }

  private drawGuide(ctx: CanvasRenderingContext2D, sim: KolaSim): void {
    const g = this.l.guide;
    const n = Math.min(sim.breaths, sim.breath.n + 1);
    const a = clamp(sim.blockT / 0.8) * (sim.block.what === 'field' ? 1 : clamp(sim.left / 0.6 + 0.2));
    const sub = sim.block.what === 'field' ? undefined : breathOf(n, sim.breaths);
    drawBreathGuide(ctx, sim.breath, { cx: g.cx, cy: g.cy, r: g.r, layout: g.layout, maxW: g.maxW, sub, alpha: a, reducedMotion: this.o.reducedMotion, time: this.time });
  }

  private drawLine(ctx: CanvasRenderingContext2D, text: string, band: Rect, a: number): void {
    if (a <= 0.01) return;
    ctx.save();
    const { size, lines } = this.fitText(ctx, text, band, Math.round(this.l.font + 1), 1.4, 14, s => `500 ${s}px ${FONT}`);
    ctx.font = `500 ${size}px ${FONT}`;
    const lh = Math.round(size * 1.4);
    const top = band.y + Math.max(0, (band.h - lines.length * lh) / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = a;
    const w = Math.min(band.w, Math.max(...lines.map(s => ctx.measureText(s).width)) + 36);
    ctx.fillStyle = 'rgba(6,6,20,0.55)';
    roundRect(ctx, band.x + (band.w - w) / 2, top - 8, w, lines.length * lh + 14, 14);
    ctx.fill();
    ctx.fillStyle = INK;
    lines.forEach((s, i) => ctx.fillText(s, band.x + band.w / 2, top + i * lh));
    ctx.restore();
  }

  /** A prayer or a blessing: italic serif, whole (smaller rather than cut). */
  private drawPrayer(ctx: CanvasRenderingContext2D, paras: string[], band: Rect, a: number): void {
    if (a <= 0.01) return;
    const l = this.l;
    ctx.save();
    ctx.globalAlpha = a;
    const max = Math.round(Math.min(l.kind === 'wide' ? 26 : 20, l.font + (l.kind === 'wide' ? 5 : 3)));
    const { size, lines } = this.fitText(ctx, paras, band, max, 1.38, 0, s => `italic 500 ${s}px ${SERIF}`, 26);
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    const lh = Math.round(size * 1.38);
    const top = band.y + Math.max(0, (band.h - lines.length * lh) / 2);
    ctx.fillStyle = 'rgba(6,6,20,0.55)';
    roundRect(ctx, band.x, top - 10, band.w, lines.length * lh + 18, 16);
    ctx.fill();
    ctx.fillStyle = '#fbf3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((s, i) => ctx.fillText(s, band.x + band.w / 2, top + i * lh));
    ctx.restore();
  }

  /**
   * Text (one string, or paragraphs each starting a line) wrapped to `band`'s width less `pad`, at `max` px or smaller —
   * down to 13 — until its lines × `lead` (+ `extra`) fit the band's height.  Kept per text and band size.
   */
  private fitText(ctx: CanvasRenderingContext2D, text: string | string[], band: Rect, max: number, lead: number, extra: number, font: (px: number) => string, pad = 16): { size: number; lines: string[] } {
    const paras = typeof text === 'string' ? [text] : text;
    const key = `${paras.join('\n')}|${Math.round(band.w)}|${Math.round(band.h)}|${max}|${font(1)}`;
    const hit = this.fitCache.get(key);
    if (hit) return hit;
    let size = max, lines: string[] = [];
    for (;;) {
      ctx.font = font(size);
      lines = paras.flatMap(p => wrapLines(ctx, p, band.w - pad));
      if (size <= 13 || lines.length * Math.round(size * lead) + extra <= band.h) break;
      size -= 1;
    }
    const out = { size, lines };
    if (this.fitCache.size > 64) this.fitCache.clear();
    this.fitCache.set(key, out);
    return out;
  }

  private verseLayout(ctx: CanvasRenderingContext2D, id: PassageId, w: number, h: number, max: number): PassageLayout {
    const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
    let lay = this.verseCache.get(key);
    if (!lay) {
      lay = layoutPassage(ctx, passage(id), w, h, { max, min: 13 });
      this.verseCache.set(key, lay);
    }
    return lay;
  }

  private drawVerse(ctx: CanvasRenderingContext2D, id: PassageId, band: Rect, a: number): void {
    if (a <= 0.01) return;
    const max = this.l.kind === 'wide' ? 22 : 17;
    const lay = this.verseLayout(ctx, id, band.w - 24, band.h - 12, max);
    // a passage that would be cut is never shown (the summary carries a whole one)
    if (!lay.fits) return;
    const top = band.y + Math.max(0, (band.h - lay.height) / 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,6,20,0.55)';
    roundRect(ctx, band.x, top - 8, band.w, lay.height + 16, 16);
    ctx.fill();
    drawPassage(ctx, passage(id), lay, band.x + band.w / 2, top, { text: '#f8f2ff', ref: '#e8c77e' });
    ctx.restore();
  }

  // ── input ─────────────────────────────────────────────────────

  /** No buttons on the canvas: a tap anywhere makes the words glow again. */
  targets(): TapTarget[] { return []; }

  /** The guide's box (for the layout tests). */
  guideBox(ctx: CanvasRenderingContext2D, sim: KolaSim): { x: number; y: number; w: number; h: number } {
    const g = this.l.guide;
    return breathGuideBox(ctx, { cx: g.cx, cy: g.cy, r: g.r, layout: g.layout, maxW: g.maxW, sub: breathOf(1, sim.breaths) });
  }

  /** For the debug view: the camera and the colour of a wheel. */
  get debug(): Record<string, unknown> {
    return { aim: this.aim, cam: { ...this.cam }, sWhole: this.sWhole, motes: this.motes.length };
  }
}
