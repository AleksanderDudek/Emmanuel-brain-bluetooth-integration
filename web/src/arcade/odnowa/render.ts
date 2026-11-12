/**
 * Odnowa's play view: the cell city (cached), the engine lens with the ATP synthase turning in it, golden
 * ATP flying to where energy is needed, the DNA lane with its crews, the clean-up, Mito and his bubble, the
 * division's chips, the sing-along line, the story card and the new cell's toast.  It reads the sim and its
 * events; it never changes the rules.  Light comes from baked glow sprites, static layers are cached on
 * resize, particles are pooled (DESIGN §12: no shadowBlur, no filter, ≤ 4 ms a frame on a desktop).
 */
import { clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import type { Insets } from '../kit/types';
import { LESIONS, cardNum, cardSpec, cardText, cardTitle, cellName, stepName, type CardId, type NicheId } from './content';
import { t } from './i18n';
import { inRect, laneX, layout, type Layout } from './layout';
import {
  C, ENTRY_ANGLE, PUMP_ANGLES, SANS, fitFont, font, glow, hash, label, paintAtp, paintBubble, paintCellIcon, paintChipIcon,
  paintCity, paintCrew, paintGauge, paintHelixStrip, paintLensBack, paintLensRim, paintLesion, paintLysosome, paintMended,
  paintMito, paintMitoSmall, paintMitosis, paintPart, paintPhagophore, paintTurbine, rgba, rr, strands,
} from './paint';
import { RULES } from './rules';
import type { CoachAt, OdnowaSim, Part, SimEvent } from './sim';

const TAU = Math.PI * 2;

interface Fly { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; kind: 'atp' | 'bead' | 'cell'; color: string; lift: number; rot: number }
interface Wave { x: number; y: number; r: number; t: number; color: string }
interface Proton { pump: number; k: number; wob: number }

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

/** The sing-along line the index hands over each frame. */
export interface Lyric { text: string; p: number }

export class OdnowaView {
  L: Layout = layout(360, 500);
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private city: HTMLCanvasElement | null = null;
  private lensBack: HTMLCanvasElement | null = null;
  private strip: HTMLCanvasElement | null = null;
  private P = 100;
  private niche: NicheId = 'gut';
  private readonly sparks = new Particles(340);
  private readonly floats = new Floaters();
  private readonly shake: Shake;
  private readonly flies: Fly[] = [];
  private readonly waves: Wave[] = [];
  private readonly protons: Proton[] = [];
  private beta: [number, number, number] = [0, 0, 0];
  private lensK = 1;
  private now = 0;
  private flash = 0;
  private kickT = 0;
  private press = 0;
  private chipPop: [number, number, number] = [0, 0, 0];
  private extraFlash: [number, number, number] = [0, 0, 0];
  private lysoFuse: number[] = [0, 0, 0];
  private blink = 0;
  private blinkT = 2;
  private joy = 0;
  private cleanT = 0;
  private bubbleA = 0;
  private lastLine = '';
  private storyLayout: PassageLayout | null = null;
  private storyKey = '';
  /** an autophagosome under a finger: where it is drawn (above the finger) */
  drag: { id: number; x: number; y: number } | null = null;
  lyric: Lyric | null = null;
  private cellNiche: NicheId = 'gut';
  /** Wiedza cards met in play, shown one at a time as a small toast */
  private readonly cardQ: CardId[] = [];
  private cardShow: { id: CardId; t: number } | null = null;
  private cardGap = 0;
  beat = 0;

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.shake = new Shake(o.reducedMotion);
    for (let i = 0; i < 40; i++) this.protons.push({ pump: i % 3, k: hash(i * 1.7), wob: hash(i * 3.1) });
  }

  resize(w: number, h: number, dpr: number, insets: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, insets);
    this.city = null;
    this.lensBack = null;
    this.strip = null;
    this.storyLayout = null;
  }

  start(sim: OdnowaSim): void {
    this.niche = sim.niche;
    this.city = null;
  }

  // ── caches ──────────────────────────────────────────────────────
  private canvasOf(w: number, h: number): HTMLCanvasElement | null {
    try {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * this.dpr));
      c.height = Math.max(1, Math.round(h * this.dpr));
      return c.getContext('2d') ? c : null;
    } catch {
      return null;
    }
  }

  private ensureCaches(): void {
    const L = this.L;
    if (!this.city) {
      const c = this.canvasOf(this.w, this.h);
      const g = c?.getContext('2d');
      if (c && g) {
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        paintCity(g, { w: this.w, h: this.h, lens: L.lens, lane: L.lane, nucleus: L.nucleus, top: L.top }, this.niche);
      }
      this.city = c;
    }
    if (!this.lensBack) {
      const r = L.lens.r;
      const c = this.canvasOf(r * 2, r * 2);
      const g = c?.getContext('2d');
      if (c && g) {
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        g.translate(r, r);
        paintLensBack(g, r);
      }
      this.lensBack = c;
    }
    if (!this.strip) {
      this.P = Math.round(L.amp * 4.4);
      const c = this.canvasOf(this.P, L.lane.h);
      const g = c?.getContext('2d');
      if (c && g) {
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        paintHelixStrip(g, this.P, L.lane.h, L.amp);
      }
      this.strip = c;
    }
  }

  // ── where things are ────────────────────────────────────────────
  /** The px of one lane unit. */
  get pxPerU(): number { return (this.L.ux1 - this.L.ux0) / RULES.laneU; }

  /** The helix's scroll offset (px) for the scan so far. */
  private scrollOff(sim: OdnowaSim): number {
    const off = (sim.scanned * this.pxPerU) % this.P;
    return -off;
  }

  /** A lesion's rung x (snapped to the helix's rungs, which scroll with it). */
  private rungX(sim: OdnowaSim, u: number): number {
    const x = laneX(this.L, u);
    const ox = this.L.ux0 + this.scrollOff(sim);
    const sp = this.P / 10;
    const j = Math.round((x - ox) / sp - 0.5);
    return ox + (j + 0.5) * sp;
  }

  private strandsAt(sim: OdnowaSim, x: number): [number, number] {
    const ox = this.L.ux0 + this.scrollOff(sim);
    const [a, b] = strands(this.L.laneMid, this.L.amp, this.P, x - ox);
    return [a, b];
  }

  /** Where a worn part is drawn now (the spot, on its way, at its lysosome, or above a finger). */
  partPos(p: Part): { x: number; y: number } {
    const L = this.L;
    if (this.drag && this.drag.id === p.id) return { x: this.drag.x, y: this.drag.y };
    const sp = L.spots[p.spot] ?? L.spots[0];
    const ly = L.lysos[p.lyso] ?? L.lysos[0];
    if (p.phase === 'tag' || p.phase === 'wrap' || p.phase === 'sealed') return { x: sp.x, y: sp.y + Math.sin(this.now * 1.1 + p.seed * 9) * 3 };
    if (p.phase === 'travel') {
      const k = ease.inOutSine(clamp(p.k));
      return { x: sp.x + (ly.x - sp.x) * k, y: sp.y + (ly.y - sp.y) * k - Math.sin(k * Math.PI) * 18 };
    }
    return { x: ly.x, y: ly.y };
  }

  /** The autophagosome under a point (generous: a finger), or null. */
  partAt(sim: OdnowaSim, x: number, y: number): number | null {
    let best: number | null = null, d = Infinity;
    const reach = Math.max(30, this.L.mito.r * 1.8);
    for (const p of sim.parts) {
      if (p.phase !== 'sealed' && p.phase !== 'travel') continue;
      const q = this.partPos(p);
      const dd = Math.hypot(q.x - x, q.y - y);
      if (dd < reach && dd < d) {
        d = dd;
        best = p.id;
      }
    }
    return best;
  }

  /** The lysosome a drop lands on (generous), or -1. */
  lysoAt(sim: OdnowaSim, x: number, y: number): number {
    let best = -1, d = Infinity;
    for (let i = 0; i < sim.lysoSlots; i++) {
      const l = this.L.lysos[i];
      const dd = Math.hypot(l.x - x, l.y - y);
      if (dd < Math.max(48, l.r * 3) && dd < d) {
        d = dd;
        best = i;
      }
    }
    return best;
  }

  /** Where a coach mark points. */
  anchor(at: CoachAt, sim: OdnowaSim): { x: number; y: number } {
    const L = this.L;
    switch (at.kind) {
      case 'lesion': {
        const l = sim.lesions.find(x => x.id === at.id);
        return l ? { x: this.rungX(sim, l.u), y: L.lane.y } : { x: L.lane.x + L.lane.w / 2, y: L.lane.y };
      }
      case 'part': {
        const p = sim.parts.find(x => x.id === at.id);
        return p ? this.partPos(p) : { x: L.spots[0].x, y: L.spots[0].y };
      }
      case 'recipe': return { x: L.chips[1].x + L.chips[1].w / 2, y: L.chips[1].y + L.chips[1].h };
      case 'lane': return { x: L.lane.x + L.lane.w / 2, y: L.lane.y };
      default: return { x: L.lens.x, y: L.lens.y - L.lens.r * 0.6 };
    }
  }

  // ── input feedback ───────────────────────────────────────────────
  pressLens(): void { this.press = 1; }

  /** A tap that found no lesion: a soft ripple where it landed. */
  ripple(x: number, y: number): void {
    this.sparks.burst(x, y, 6, { color: 'rgba(200,255,250,0.8)', size: 2, speed: 60, g: 0, drag: 3, life: 0.4, shape: 'ring' });
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: SimEvent, sim: OdnowaSim): void {
    const L = this.L;
    switch (e.type) {
      case 'atp': {
        if (e.src === 0) {
          const third = Math.floor(((sim.angle % 1) + 1) % 1 * 3) % 3;
          this.beta[third] = 1;
          const a = -Math.PI / 2 + third * (TAU / 3);
          const r = L.lens.r * this.lensK;
          this.atpFly(L.lens.x + Math.cos(a) * r * 0.27, L.lens.y + Math.sin(a) * r * 0.27);
        } else {
          const ex = L.extras[(e.src - 1) % 3];
          this.extraFlash[(e.src - 1) % 3] = 1;
          this.atpFly(ex.x, ex.y);
        }
        break;
      }
      case 'atpUse': {
        const x = laneX(L, e.u);
        for (let i = 0; i < e.n; i++) this.fly(L.lens.x, L.lens.y, x, L.laneMid, 'atp', C.gold, 0.55 + i * 0.12);
        break;
      }
      case 'kick':
        this.kickT = 1;
        this.sparks.burst(L.lens.x + L.lens.r * 0.7, L.lens.y, 6, { color: C.vane, size: 2.2, speed: 120, g: 0, drag: 3, life: 0.35, shape: 'spark' });
        break;
      case 'spawn':
        if (e.kind === 'dsb') this.shake.add(0.25);
        break;
      case 'repairStart': {
        const l = sim.lesions.find(x => x.id === e.id);
        if (l && e.by === 'tap') {
          const x = this.rungX(sim, l.u);
          this.sparks.burst(x, L.laneMid, 10, { color: C.mint, size: 2.2, speed: 150, g: 0, drag: 4, life: 0.4, shape: 'spark' });
          if (e.combo >= 2) this.floats.add(t('fx.combo', { n: e.combo }), x, L.lane.y - 6, { color: e.combo >= 4 ? C.gold : C.mint, size: Math.max(MIN_READ + 2, 15 * L.u + e.combo), dur: 0.9 });
        }
        break;
      }
      case 'repaired': {
        const l = sim.lesions.find(x => x.id === e.id);
        if (l) {
          const x = this.rungX(sim, l.u);
          this.sparks.burst(x, L.laneMid, e.by === 'tap' ? 16 : 8, { color: e.by === 'cell' ? '#bfe9ff' : C.mint, size: 2.6, speed: 170, g: 40, drag: 2.5, life: 0.6 });
          this.sparks.burst(x, L.laneMid, 6, { color: C.gold, size: 3, speed: 60, g: 0, drag: 2, life: 0.5, shape: 'ring' });
          this.chipPop[2] = 1;
        }
        break;
      }
      case 'gate':
        break;
      case 'miss':
        break;
      case 'sealed':
        break;
      case 'fuse':
        this.lysoFuse[e.lyso] = 1;
        if (e.sent) {
          const ly = L.lysos[e.lyso];
          this.sparks.burst(ly.x, ly.y, 12, { color: C.violet, size: 2.4, speed: 110, g: 0, drag: 3, life: 0.5 });
        }
        break;
      case 'recycled': {
        const ly = L.lysos[e.lyso] ?? L.lysos[0];
        const ch = L.chips[1];
        for (let i = 0; i < Math.min(8, e.mat * 2); i++) this.fly(ly.x, ly.y, ch.x + ch.w * 0.25, ch.y + ch.h / 2, 'bead', ['#7ff2c4', '#ffd36b', '#ff9fc6', '#8fd8ff'][i % 4], 0.7 + i * 0.07);
        this.floats.add(t('fx.mat', { n: e.mat }), ly.x, ly.y - ly.r - 8, { color: C.mint, size: Math.max(MIN_READ + 1, 15 * L.u), dur: 1.2 });
        break;
      }
      case 'ready':
        this.sparks.burst(L.lens.x, L.lens.y, 20, { color: C.gold, size: 2.6, speed: 180, g: 0, drag: 2, life: 0.7 });
        break;
      case 'surge':
        this.waves.push({ x: L.lens.x, y: L.lens.y, r: L.lens.r, t: 0, color: C.gold });
        this.flash = 1;
        this.shake.add(0.4);
        this.floats.add(t('fx.surge'), L.lens.x, L.lens.y - L.lens.r * 0.4, { color: C.goldHi, size: Math.max(MIN_READ + 6, 24 * L.u), dur: 1.4 });
        this.sparks.burst(L.lens.x, L.lens.y, 40, { color: C.gold, size: 3, speed: 260, g: 0, drag: 1.6, life: 0.9, shape: 'spark' });
        break;
      case 'divide':
        this.shake.add(0.2);
        this.flash = Math.max(this.flash, 0.5);
        break;
      case 'cell': {
        this.joy = 1;
        this.cellNiche = e.niche;
        this.fly(L.lens.x + L.lens.r * 0.4, L.lens.y, L.toast.x + L.toast.h * 0.5, L.toast.y + L.toast.h / 2, 'cell', C.mint, 0.9);
        this.waves.push({ x: L.lens.x, y: L.lens.y, r: L.lens.r, t: 0, color: C.mint });
        this.sparks.burst(L.lens.x, L.lens.y, 30, { color: C.mint, size: 3, speed: 200, g: 0, drag: 2, life: 0.9 });
        break;
      }
      case 'card':
        if (!this.cardQ.includes(e.id)) this.cardQ.push(e.id);
        break;
      case 'up':
        this.joy = 1;
        this.floats.add(t('fx.up'), L.mito.x, L.mito.y - L.mito.r - 8, { color: C.gold, size: Math.max(MIN_READ + 2, 16 * L.u), dur: 1.4 });
        break;
      default:
        break;
    }
  }

  private atpFly(x: number, y: number): void {
    const ch = this.L.chips[0];
    this.fly(x, y, ch.x + ch.w * 0.22, ch.y + ch.h / 2, 'atp', C.gold, 0.75 + Math.random() * 0.25);
  }

  private fly(x0: number, y0: number, x1: number, y1: number, kind: Fly['kind'], color: string, dur: number): void {
    if (this.flies.length >= 70) return;
    this.flies.push({ x0, y0, x1, y1, t: 0, dur, kind, color, lift: 30 + Math.random() * 50, rot: Math.random() * TAU });
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, sim: OdnowaSim): void {
    this.now += dt;
    const rest = sim.restBlock ? 1 : 0;
    this.lensK += ((rest ? 0.84 : 1) - this.lensK) * Math.min(1, dt * 3);
    for (let i = 0; i < 3; i++) {
      this.beta[i] = Math.max(0, this.beta[i] - dt * 2.8);
      this.chipPop[i] = Math.max(0, this.chipPop[i] - dt * 3);
      this.extraFlash[i] = Math.max(0, this.extraFlash[i] - dt * 3);
      this.lysoFuse[i] = Math.max(0, this.lysoFuse[i] - dt * 1.5);
    }
    this.flash = Math.max(0, this.flash - dt * (this.o.reducedMotion ? 1.2 : 2.2));
    this.kickT = Math.max(0, this.kickT - dt * 4);
    this.press = Math.max(0, this.press - dt * 6);
    this.joy = Math.max(0, this.joy - dt * 0.7);
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 1;
      this.blinkT = 2.5 + Math.random() * 3;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    // the protons stream from the pumps to the turbine's entry, faster as it spins
    for (const p of this.protons) {
      p.k += dt * (0.25 + sim.spin * 0.35) * (0.7 + p.wob * 0.6);
      if (p.k >= 1) {
        p.k -= 1;
        p.pump = (p.pump + 1) % 3;
      }
    }
    for (let i = this.waves.length - 1; i >= 0; i--) if ((this.waves[i].t += dt) > 0.9) this.waves.splice(i, 1);
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      f.t += dt;
      if (f.t >= f.dur) {
        if (f.kind === 'atp' && f.y1 < this.L.lens.y) this.chipPop[0] = 1;
        if (f.kind === 'bead') this.chipPop[1] = 1;
        this.sparks.burst(f.x1, f.y1, 3, { color: f.color, size: 1.8, speed: 50, g: 0, drag: 3, life: 0.3 });
        this.flies.splice(i, 1);
      }
    }
    if (!sim.openLesions.length && sim.scanV > RULES.scanSlow + 0.1) this.cleanT = Math.min(1, this.cleanT + dt * 2);
    else this.cleanT = Math.max(0, this.cleanT - dt * 3);
    this.sparks.update(dt);
    this.floats.update(dt);
    // the next Wiedza card, when no card or new cell's toast is up
    if (this.cardShow) {
      this.cardShow.t += dt;
      if (this.cardShow.t >= 3.6 || sim.cellCard || sim.story) {
        this.cardShow = null;
        this.cardGap = 1.2;
      }
    } else {
      this.cardGap = Math.max(0, this.cardGap - dt);
      const cc = this.cardQ.find(id => id !== sim.cellCard?.card);
      if (this.cardGap <= 0 && cc && !sim.cellCard && !sim.story && !sim.mitosis && !sim.talk.line && this.bubbleA < 0.05) {
        this.cardQ.splice(this.cardQ.indexOf(cc), 1);
        this.cardShow = { id: cc, t: 0 };
      }
      // a card the new cell's toast showed is not shown twice
      if (sim.cellCard?.card) { const i = this.cardQ.indexOf(sim.cellCard.card); if (i >= 0) this.cardQ.splice(i, 1); }
    }
    const line = sim.talk.line;
    this.bubbleA = clamp(this.bubbleA + (line ? dt * 6 : -dt * 6));
    if (line) this.lastLine = line.text;
  }

  draw(sim: OdnowaSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.ensureCaches();
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake.offset(1 / 60, 8);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    if (this.city) ctx.drawImage(this.city, 0, 0, this.w, this.h);
    else {
      ctx.fillStyle = '#0c2629';
      ctx.fillRect(0, 0, this.w, this.h);
    }
    const rest = sim.restBlock;
    // the calm of a rest block: a cool veil over the city
    if (rest) {
      ctx.fillStyle = 'rgba(30,60,110,0.16)';
      ctx.fillRect(0, L.top, this.w, this.h - L.top);
    }
    this.drawCallout(ctx);
    this.drawDrift(ctx, sim);
    this.drawExtras(ctx, sim);
    this.drawLens(ctx, sim);
    this.drawLysosomes(ctx, sim);
    this.drawParts(ctx, sim);
    this.drawLane(ctx, sim);
    this.drawFlies(ctx);
    for (const wv of this.waves) {
      const k = wv.t / 0.9;
      ctx.strokeStyle = rgba(wv.color, 0.7 * (1 - k));
      ctx.lineWidth = 3 + 6 * (1 - k);
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, wv.r * (1 + k * 1.4), 0, TAU);
      ctx.stroke();
    }
    this.sparks.draw(ctx);
    ctx.restore();
    this.drawMito(ctx, sim);
    this.drawChips(ctx, sim);
    this.drawLyric(ctx);
    this.floats.draw(ctx, `800 ${SANS}`);
    this.drawToast(ctx, sim);
    if (this.flash > 0) {
      ctx.fillStyle = this.o.reducedMotion ? `rgba(255,240,200,${0.25 * this.flash})` : `rgba(255,250,230,${0.45 * this.flash})`;
      ctx.fillRect(0, L.top, this.w, this.h - L.top);
    }
    if (sim.story) this.drawStory(ctx, sim);
  }

  // ── layers ──────────────────────────────────────────────────────
  /** A faint magnifier cone from Mito to the lens: the turbine is inside him. */
  private drawCallout(ctx: CanvasRenderingContext2D): void {
    const L = this.L, m = L.mito, c = L.lens;
    const a = Math.atan2(c.y - m.y, c.x - m.x);
    const r = c.r * this.lensK;
    ctx.fillStyle = 'rgba(255,190,160,0.05)';
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(c.x + Math.cos(a - Math.PI / 2) * r, c.y + Math.sin(a - Math.PI / 2) * r);
    ctx.lineTo(c.x + Math.cos(a + Math.PI / 2) * r, c.y + Math.sin(a + Math.PI / 2) * r);
    ctx.closePath();
    ctx.fill();
  }

  /** Vesicles drifting through the cytoplasm and a kinesin's cargo: the city breathes (slower in a rest). */
  private drawDrift(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, c = L.city;
    const slow = sim.restBlock ? 0.45 : 1;
    for (let i = 0; i < 11; i++) {
      const sx = hash(i * 4.1), sy = hash(i * 7.3);
      const x = c.x + ((sx * c.w + this.now * (6 + 10 * hash(i)) * slow * (i % 2 ? 1 : -1)) % c.w + c.w) % c.w;
      const y = c.y + sy * c.h + Math.sin(this.now * 0.5 + i) * 10;
      const r = 3 + 5 * hash(i * 2.9);
      const col = i % 3 === 0 ? '#ffd6a8' : i % 3 === 1 ? '#a8f0e0' : '#c8b8ff';
      glow(ctx, col, x, y, r * 3.2, 0.22);
      ctx.strokeStyle = rgba(col, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    }
  }

  private drawExtras(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const n = sim.mitoCount;
    for (let i = 0; i < n && i < 3; i++) {
      const e = this.L.extras[i];
      paintMitoSmall(ctx, e.x, e.y, e.r, this.now, sim.angle * 1.3 + i * 0.3, this.extraFlash[i], (i - 1) * 0.6);
    }
  }

  private drawLens(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, c = L.lens;
    const r = c.r * this.lensK * (1 - this.press * 0.03);
    const veiled = sim.blind;
    const m = sim.mitosis;
    const beatK = (1 - (this.beat % 1)) ** 3;
    // the ready full power breathes gold round the lens
    if (sim.ready) glow(ctx, C.gold, c.x, c.y, r * 1.7, sim.restBlock ? 0.15 : 0.35 + 0.25 * Math.sin(this.now * 6));
    glow(ctx, sim.surge > 0 ? C.gold : '#9f8cff', c.x, c.y, r * 1.45, 0.18 + sim.grad * 0.18 + beatK * 0.08 + (sim.surge > 0 ? 0.3 : 0));
    ctx.save();
    ctx.translate(c.x, c.y);
    if (this.lensBack) ctx.drawImage(this.lensBack, -r, -r, r * 2, r * 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    const fadeT = m ? clamp(m.t / 0.5) * clamp((RULES.mitosis.reduce((s, x) => s + x, 0) - m.t) / 0.5) : 0;
    if (fadeT < 1) {
      ctx.globalAlpha = 1 - fadeT;
      this.drawProtons(ctx, sim, r);
      paintTurbine(ctx, r, {
        angle: sim.angle, grad: sim.grad, spin: sim.spin, beta: this.beta, surge: sim.surge > 0 ? 1 : 0, t: this.now,
        veiled, rest: sim.restBlock ? 1 : 0,
      });
      ctx.globalAlpha = 1;
    }
    if (m) {
      ctx.globalAlpha = fadeT;
      let acc = 0, k = 0;
      for (let i = 0; i < RULES.mitosis.length; i++) {
        if (i === m.phase) {
          k = clamp((m.t - acc) / RULES.mitosis[i]);
          break;
        }
        acc += RULES.mitosis[i];
      }
      paintMitosis(ctx, r, m.phase, k, m.niche, this.now);
      ctx.globalAlpha = 1;
    }
    if (veiled && !m) {
      ctx.fillStyle = 'rgba(70,60,120,0.55)';
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
    // the gauge: what the band drives now (the gradient in a push, calm in a rest), the threshold at the top
    const gv = sim.meter();
    if (!veiled && !m) {
      const restG = sim.restBlock;
      paintGauge(ctx, c.x, c.y, r + Math.max(6, r * 0.08), gv, restG ? C.rest : C.vane, restG ? '#cfeaff' : C.gold);
    }
    const gold = sim.pushBlock && gv !== null && gv > 0.5 ? (gv - 0.5) * 2 : sim.surge > 0 ? 1 : 0;
    paintLensRim(ctx, c.x, c.y, r, gold);
    // words on the lens
    const fs = Math.max(MIN_READ, Math.round(13 * L.u));
    if (m) label(ctx, t(`mit.${Math.min(4, m.phase)}` as 'mit.0'), c.x, c.y - r * 0.82, fs + 1, C.cream);
    else if (veiled) label(ctx, t('lens.blind'), c.x, c.y, fs + 1, '#e6deff');
    else if (sim.ready && !sim.restBlock) {
      const txt = t(this.o.touch ? 'lens.ready' : 'lens.ready.keys');
      const px = fitFont(ctx, txt, r * 1.8, fs + 1, MIN_READ, 800);
      label(ctx, txt, c.x, c.y + r * 0.62, px, C.goldHi);
    } else if (sim.surge > 0) label(ctx, t('lens.surge'), c.x, c.y - r * 0.62, fs + 2, C.goldHi);
    else if (sim.restBlock) {
      const cyc = (this.now % 10) / 10;
      const inhale = cyc < 0.4;
      label(ctx, t(inhale ? 'breath.in' : 'breath.out'), c.x, c.y + r * 0.62, fs, '#d8eeff', 'center', 700);
    } else {
      // "3 ATP / turn" over the gauge's notch, where there is room
      const px = Math.max(MIN_READ, Math.round(13 * L.u));
      const y = c.y - r * 1.12 - px;
      const toast = !!sim.cellCard || !!this.cardShow;
      if (!toast && y - px / 2 >= L.city.y + 2) label(ctx, t('lens.per'), c.x, y, px, 'rgba(255,246,230,0.85)', 'center', 700);
    }
  }

  private drawProtons(ctx: CanvasRenderingContext2D, sim: OdnowaSim, r: number): void {
    const n = Math.round(4 + 32 * clamp(sim.grad) + (sim.surge > 0 ? 6 : 0));
    const hot = sim.blind ? 0.3 : 1;
    for (let i = 0; i < n && i < this.protons.length; i++) {
      const p = this.protons[i];
      const a0 = PUMP_ANGLES[p.pump], a1 = ENTRY_ANGLE;
      const a = a0 + (a1 - a0) * p.k;
      const rad = r * (0.84 + 0.06 * Math.sin(p.k * 9 + p.wob * 6));
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      glow(ctx, C.proton, x, y, r * 0.07, 0.6 * hot);
      ctx.fillStyle = rgba(C.proton, hot);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.4, r * 0.022), 0, TAU);
      ctx.fill();
    }
    // electrons hop along the chain: I → III → IV
    const e = (this.now * (0.6 + sim.grad * 1.6)) % 1;
    const seg = Math.min(1, Math.floor(e * 2));
    const k = (e * 2) % 1;
    const aa = PUMP_ANGLES[seg] + (PUMP_ANGLES[seg + 1] - PUMP_ANGLES[seg]) * k;
    glow(ctx, C.electron, Math.cos(aa) * r * 0.86, Math.sin(aa) * r * 0.86 - Math.sin(k * Math.PI) * r * 0.06, r * 0.08, 0.8 * (sim.blind ? 0.3 : 1));
  }

  private drawLysosomes(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const cyc = (this.now % 10) / 10;
    const breath = sim.restBlock ? (cyc < 0.4 ? ease.inOutSine(cyc / 0.4) : 1 - ease.inOutSine((cyc - 0.4) / 0.6)) : 0.3 + 0.1 * Math.sin(this.now);
    for (let i = 0; i < sim.lysoSlots; i++) {
      const l = this.L.lysos[i];
      const digest = sim.parts.some(p => p.lyso === i && p.phase === 'digest') ? 1 : 0;
      if (sim.restBlock) {
        // the calm ring: the breath guide (in 4, out 6) round each lysosome
        ctx.strokeStyle = `rgba(160,210,255,${0.25 + 0.3 * breath})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r * (1.5 + breath * 0.6), 0, TAU);
        ctx.stroke();
      }
      paintLysosome(ctx, l.x, l.y, l.r, this.now, breath, this.lysoFuse[i], digest);
    }
  }

  private drawParts(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L;
    const s = Math.max(14, L.mito.r * 1.05);
    for (const p of sim.parts) {
      if (p.phase === 'done' || p.phase === 'fuse' || p.phase === 'digest') {
        if (p.phase === 'fuse') {
          const q = this.partPos(p);
          ctx.globalAlpha = 1 - p.k;
          paintPart(ctx, p.kind, q.x, q.y, s * (1 - p.k * 0.6), this.now, p.seed, 0);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      const q = this.partPos(p);
      if (p.phase === 'tag') paintPart(ctx, p.kind, q.x, q.y, s, this.now, p.seed, p.k);
      else if (p.phase === 'wrap') {
        paintPart(ctx, p.kind, q.x, q.y, s, this.now, p.seed, 1);
        paintPhagophore(ctx, q.x, q.y, s * 1.35, p.k, this.now);
      } else {
        // the autophagosome: a double membrane round the part, on its way (or under a finger)
        const held = this.drag?.id === p.id;
        glow(ctx, '#ffd6be', q.x, q.y, s * (held ? 2.6 : 2), held ? 0.5 : 0.3);
        paintPart(ctx, p.kind, q.x, q.y, s * 0.8, this.now, p.seed, 1);
        paintPhagophore(ctx, q.x, q.y, s * 1.2, 1, this.now);
      }
    }
  }

  private drawLane(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, ln = L.lane;
    // the panel: a dark glass strip with a bright edge
    ctx.fillStyle = 'rgba(4,14,22,0.62)';
    rr(ctx, ln.x, ln.y, ln.w, ln.h, 14);
    ctx.fill();
    ctx.strokeStyle = sim.checkpoint ? rgba(C.amber, 0.8) : 'rgba(160,230,255,0.35)';
    ctx.lineWidth = sim.checkpoint ? 2 : 1.2;
    ctx.stroke();
    ctx.save();
    rr(ctx, ln.x + 1, ln.y + 1, ln.w - 2, ln.h - 2, 13);
    ctx.clip();
    const off = this.scrollOff(sim);
    if (this.strip) {
      for (let x = L.ux0 + off - this.P; x < ln.x + ln.w + this.P; x += this.P) ctx.drawImage(this.strip, x, ln.y, this.P, ln.h);
    }
    // the gate on the left: the checkpoint that holds an unrepaired lesion for the cell's own crew
    const gx = laneX(L, RULES.gateU);
    const held = sim.atGate;
    const gg = ctx.createLinearGradient(gx - 16, 0, gx + 4, 0);
    gg.addColorStop(0, 'rgba(255,200,120,0)');
    gg.addColorStop(1, held ? 'rgba(255,190,90,0.35)' : 'rgba(180,230,255,0.12)');
    ctx.fillStyle = gg;
    ctx.fillRect(gx - 16, ln.y, 20, ln.h);
    ctx.strokeStyle = held ? rgba(C.amber, 0.9) : 'rgba(200,240,255,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(gx, ln.y + 4);
    ctx.lineTo(gx, ln.y + ln.h - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    // the lesions and their crews
    const amp = L.amp;
    for (const l of sim.lesions) {
      if (l.u < -0.6 || l.u > RULES.laneU + 0.6) continue;
      const x = this.rungX(sim, l.u);
      const [ya, yb] = this.strandsAt(sim, x);
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 6 + l.seed * 10);
      if (l.kind === 'dsb' && l.state !== 'done') {
        // the break cuts the helix: a dark gap
        ctx.fillStyle = 'rgba(4,14,22,0.9)';
        ctx.fillRect(x - amp * 0.18, ln.y + 2, amp * 0.36, ln.h - 4);
      }
      if (l.state === 'done') {
        paintMended(ctx, x, ya, yb, amp, clamp(l.done / 1.2));
        continue;
      }
      paintLesion(ctx, l.kind, x, ya, yb, amp, l.state === 'fixing' ? 0.2 : pulse, l.state === 'wait');
      if (l.state === 'fixing') {
        const steps = LESIONS[l.kind].stages[Math.min(l.stage, LESIONS[l.kind].stages.length - 1)];
        const step = steps[Math.min(l.step, steps.length - 1)];
        const arrive = clamp(1 + l.st / RULES.crewIn);
        const cy = (ya + yb) / 2 - amp * 1.1 * (1 - ease.outCubic(arrive)) - amp * 0.15;
        const k = clamp(l.st / 0.3);
        paintCrew(ctx, step, x, cy, Math.max(12, amp * 0.75), k, this.now);
        if (l.by !== 'surge') {
          const px = Math.max(MIN_READ, Math.round(13 * L.u));
          label(ctx, stepName(step), x, ln.y + px * 0.75 + 2, px, l.by === 'cell' ? '#cfeaff' : C.cream, 'center', 700);
        }
      } else if (l.state === 'wait') {
        const px = Math.max(MIN_READ, Math.round(13 * L.u));
        label(ctx, t('lane.again'), x, ln.y + px * 0.75 + 2, px, C.amber, 'center', 800);
      }
    }
    // the cell's own crew coming to the gate
    if (held) {
      const k = clamp(held.gate / RULES.gateFix);
      ctx.strokeStyle = rgba(C.amber, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, ln.y + ln.h - 14, 8, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
    }
    // both ends fade into the dark
    for (const [x0, dir] of [[ln.x, 1], [ln.x + ln.w, -1]] as const) {
      const fg = ctx.createLinearGradient(x0, 0, x0 + dir * 26, 0);
      fg.addColorStop(0, 'rgba(4,14,22,0.95)');
      fg.addColorStop(1, 'rgba(4,14,22,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(dir > 0 ? x0 : x0 - 26, ln.y, 26, ln.h);
    }
    ctx.restore();
    if (this.cleanT > 0.05 && !sim.restBlock) {
      ctx.globalAlpha = this.cleanT;
      const px = Math.max(MIN_READ, Math.round(13 * L.u));
      label(ctx, t('lane.clean'), ln.x + ln.w - 12, ln.y + ln.h - px * 0.8, px, C.mint, 'right', 700);
      ctx.globalAlpha = 1;
    }
  }

  private drawFlies(ctx: CanvasRenderingContext2D): void {
    const s = Math.max(6, this.L.lens.r * 0.085);
    for (const f of this.flies) {
      const k = ease.inOutSine(clamp(f.t / f.dur));
      const x = f.x0 + (f.x1 - f.x0) * k;
      const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * f.lift;
      if (f.kind === 'atp') paintAtp(ctx, x, y, s, f.rot + k * 4);
      else if (f.kind === 'cell') paintCellIcon(ctx, this.cellNiche, x, y, s * 2.2);
      else {
        glow(ctx, f.color, x, y, s * 1.8, 0.6);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.45, 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawMito(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, m = L.mito;
    const line = sim.talk.line;
    paintMito(ctx, m.x, m.y, m.r, {
      t: this.now, talk: !!line, blink: this.blink, joy: Math.max(this.joy, sim.surge > 0 ? 1 : 0, sim.ready ? 0.6 : 0),
      tired: sim.restBlock ? 0.6 : 0, look: this.kickT > 0 ? 0.8 : Math.sin(this.now * 0.4) * 0.4,
    });
    if (this.bubbleA > 0.02 && this.lastLine) {
      const px = Math.max(14, Math.round(14 * L.u));
      const b = L.bubble;
      const tailX = m.x + (b.side === 'right' ? m.r * 0.8 : -m.r * 0.8), tailY = m.y - m.r * 0.6;
      const by = L.mode === 'wide' ? b.y - Math.round(px * 1.3) * 2 : b.y;
      paintBubble(ctx, this.lastLine, b.x, Math.max(L.top + 2, by), b.maxW, b.side, px, tailX, tailY, this.bubbleA);
    }
  }

  private drawChips(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L;
    const r = sim.recipe;
    const vals = [sim.stageAtp / r.atp, sim.material / r.mat, sim.scan / r.scan];
    const texts = [`${Math.min(sim.stageAtp, r.atp)}/${r.atp}`, `${Math.min(sim.material, r.mat)}/${r.mat}`, `${Math.round(clamp(vals[2]) * 100)}%`];
    const names = [t('hud.energy'), t('hud.material'), sim.checkpoint ? t('hud.check') : t('hud.dna')];
    for (let i = 0; i < 3; i++) {
      const c = L.chips[i], v = clamp(vals[i]), full = v >= 1;
      const pop = this.chipPop[i];
      const amber = i === 2 && sim.checkpoint;
      ctx.fillStyle = 'rgba(4,16,22,0.66)';
      rr(ctx, c.x, c.y, c.w, c.h, c.h / 2);
      ctx.fill();
      ctx.strokeStyle = amber ? rgba(C.amber, 0.95) : full ? rgba(C.gold, 0.9) : `rgba(180,240,255,${0.28 + pop * 0.5})`;
      ctx.lineWidth = full || amber ? 2 : 1.2;
      ctx.stroke();
      const s = c.h * 0.62;
      paintChipIcon(ctx, i as 0 | 1 | 2, c.x + c.h * 0.55, c.y + c.h / 2, s * (1 + pop * 0.15), this.now);
      // the bar along the chip's foot
      const bx = c.x + c.h * 1.05, bw = c.w - c.h * 1.05 - c.h * 0.4, byy = c.y + c.h * 0.74;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      rr(ctx, bx, byy, bw, 3.5, 2);
      ctx.fill();
      ctx.fillStyle = amber ? C.amber : full ? C.gold : i === 0 ? '#ffd860' : i === 1 ? C.mint : '#8ff0ff';
      rr(ctx, bx, byy, Math.max(3.5, bw * v), 3.5, 2);
      ctx.fill();
      // the words: the name where it fits at 13 px, the count always
      ctx.textBaseline = 'middle';
      const ty = c.y + c.h * 0.38;
      const valPx = Math.max(MIN_READ, Math.round(13 * L.u));
      ctx.font = font(valPx, 800);
      const vw = ctx.measureText(texts[i]).width;
      const room = bw - vw - 6;
      ctx.fillStyle = full ? C.goldHi : C.cream;
      ctx.textAlign = 'right';
      ctx.fillText(texts[i], bx + bw, ty);
      ctx.font = font(valPx, 700);
      if (room >= ctx.measureText(names[i]).width) {
        ctx.textAlign = 'left';
        ctx.fillStyle = amber ? C.amber : 'rgba(230,250,255,0.85)';
        ctx.fillText(names[i], bx, ty);
      }
    }
  }

  private drawLyric(ctx: CanvasRenderingContext2D): void {
    const ly = this.lyric;
    if (!ly) return;
    const L = this.L, b = L.lyric;
    const px = fitFont(ctx, ly.text, b.w - 24, Math.max(14, Math.round(15 * L.u)), MIN_READ, 600, true, true);
    const tw = ctx.measureText(ly.text).width;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.fillStyle = 'rgba(4,16,22,0.5)';
    rr(ctx, cx - tw / 2 - 12, b.y, tw + 24, b.h, b.h / 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,246,230,0.78)';
    ctx.fillText(ly.text, cx - tw / 2, cy + 1);
    // the karaoke fill: the words light up gold as the line is sung
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - tw / 2, b.y, tw * clamp(ly.p * 1.05), b.h);
    ctx.clip();
    ctx.fillStyle = C.goldHi;
    ctx.fillText(ly.text, cx - tw / 2, cy + 1);
    ctx.restore();
    // a note before the line
    label(ctx, '♪', cx - tw / 2 - 6, cy, px, C.gold, 'right', 700);
  }

  /** A Wiedza card met in play: its icon, its title, its number and the start of its sentence. */
  private drawCardToast(ctx: CanvasRenderingContext2D): void {
    const cs = this.cardShow;
    if (!cs) return;
    const L = this.L, b = L.toast;
    const a = clamp(cs.t / 0.3) * clamp((3.6 - cs.t) / 0.4);
    const slide = (1 - ease.outBack(clamp(cs.t / 0.4))) * -16;
    const y = b.y + slide;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,20,40,0.92)';
    rr(ctx, b.x, y, b.w, b.h, 14);
    ctx.fill();
    ctx.strokeStyle = rgba(C.gold, 0.75);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const g = cardSpec(cs.id).group;
    const ix = b.x + b.h * 0.5, iy = y + b.h / 2, is = b.h * 0.5;
    if (g === 'energy') paintChipIcon(ctx, 0, ix, iy, is, this.now);
    else if (g === 'repair') paintChipIcon(ctx, 2, ix, iy, is, this.now);
    else if (g === 'clean') paintChipIcon(ctx, 1, ix, iy, is, this.now);
    else paintCellIcon(ctx, this.niche, ix, iy, b.h * 0.24);
    const tx = b.x + b.h, tw = b.w - b.h - 10;
    const px = Math.max(MIN_READ, Math.round(14 * L.u));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const title = `${cardTitle(cs.id)} · ${cardNum(cs.id)}`;
    fitFont(ctx, title, tw, px + 1, MIN_READ, 800);
    ctx.fillStyle = C.goldHi;
    ctx.fillText(title, tx, y + b.h * 0.3);
    ctx.font = font(px - 1 >= MIN_READ ? px - 1 : MIN_READ, 600);
    const text = cardText(cs.id);
    let cut = text;
    while (cut.length > 8 && ctx.measureText(`${cut}…`).width > tw) cut = cut.slice(0, cut.lastIndexOf(' ', cut.length - 2));
    ctx.fillStyle = C.cream;
    ctx.fillText(cut === text ? text : `${cut}…`, tx, y + b.h * 0.7);
    ctx.globalAlpha = 1;
  }

  private drawToast(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const cc = sim.cellCard;
    if (!cc) {
      this.drawCardToast(ctx);
      return;
    }
    const L = this.L, b = L.toast;
    const a = clamp(cc.t / 0.3) * clamp((cc.dur - cc.t) / 0.4);
    const slide = (1 - ease.outBack(clamp(cc.t / 0.4))) * -16;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,24,28,0.9)';
    rr(ctx, b.x, b.y + slide, b.w, b.h, 14);
    ctx.fill();
    ctx.strokeStyle = rgba(C.mint, 0.8);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const ir = b.h * 0.3;
    paintCellIcon(ctx, cc.niche, b.x + b.h * 0.5, b.y + slide + b.h / 2, ir);
    const tx = b.x + b.h, tw = b.w - b.h - 10;
    const px = Math.max(MIN_READ, Math.round(14 * L.u));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const title = t('cellcard.title');
    fitFont(ctx, title, tw, px + 2, MIN_READ, 800);
    ctx.fillStyle = C.mint;
    ctx.fillText(title, tx, b.y + slide + b.h * 0.3);
    const line2 = cc.card ? `${cardTitle(cc.card)}: ${cardNum(cc.card)}` : t('cellcard.what', { cell: cellName(cc.niche), n: cc.n });
    fitFont(ctx, line2, tw, px, MIN_READ, 600);
    ctx.fillStyle = C.cream;
    ctx.fillText(line2, tx, b.y + slide + b.h * 0.7);
    ctx.globalAlpha = 1;
  }

  private drawStory(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, b = L.card;
    const st = sim.story!;
    const a = clamp(st.t / 0.35);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(2,10,14,0.55)';
    ctx.fillRect(0, L.top, this.w, this.h - L.top);
    ctx.fillStyle = 'rgba(8,30,34,0.96)';
    rr(ctx, b.x, b.y, b.w, b.h, 18);
    ctx.fill();
    ctx.strokeStyle = rgba(C.mint, 0.6);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const pad = Math.max(14, 18 * L.u);
    const cx = b.x + b.w / 2;
    let y = b.y + pad;
    const short = b.h < 440;
    const titlePx = short ? 20 : Math.max(20, Math.round(24 * L.u));
    const title = t('story.title');
    const tp = fitFont(ctx, title, b.w - 2 * pad, titlePx, 16, 800, true);
    ctx.fillStyle = C.goldHi;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, cx, y);
    y += tp * 1.35;
    const bodyPx = short ? 14 : Math.max(15, Math.round(16 * L.u));
    ctx.font = font(bodyPx, 600);
    const body = wrap(ctx, t('story.text'), b.w - 2 * pad);
    ctx.fillStyle = C.cream;
    for (const line of body) {
      ctx.fillText(line, cx, y);
      y += bodyPx * 1.32;
    }
    y += 6;
    const notePx = Math.max(MIN_READ, Math.round(13 * L.u));
    ctx.font = font(notePx, 600, false, true);
    ctx.fillStyle = 'rgba(200,240,235,0.85)';
    for (const line of wrap(ctx, t('story.note'), b.w - 2 * pad)) {
      ctx.fillText(line, cx, y);
      y += notePx * 1.3;
    }
    y += 8;
    // the root verse, 2 Corinthians 4:16
    const tapPx = Math.max(MIN_READ + 1, Math.round(15 * L.u));
    const room = b.y + b.h - pad - tapPx * 1.6 - y;
    const p = passage('2co4.16');
    const key = `${b.w}x${room}`;
    if (!this.storyLayout || this.storyKey !== key) {
      this.storyLayout = room > 40 ? layoutPassage(ctx, p, b.w - 2 * pad, room, { max: Math.round(17 * L.u), min: 13 }) : null;
      this.storyKey = key;
    }
    if (this.storyLayout) drawPassage(ctx, p, this.storyLayout, cx, y, { text: '#fff1c8', ref: 'rgba(255,230,180,0.8)' });
    const pulse = 0.7 + 0.3 * Math.sin(this.now * 4);
    ctx.globalAlpha = a * pulse;
    label(ctx, t(this.o.touch ? 'story.tap' : 'story.tap.keys'), cx, b.y + b.h - pad - tapPx * 0.5, tapPx, C.mint);
    ctx.globalAlpha = 1;
  }

  /** A Wiedza toast is on screen (Mito waits: one message at a time). */
  get toastUp(): boolean { return !!this.cardShow; }

  /** The story card's rectangle while it is up (a tap anywhere on it begins). */
  get cardBox(): { x: number; y: number; w: number; h: number } { return this.L.card; }

  /** Whether a point is inside a rectangle of the layout (for the index). */
  static inRect = inRect;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
