/**
 * Odnowa's play view: the cell (cached), the engine lens with the ATP synthase turning in it, golden ATP flying
 * to the Energia bar, the DNA lane with its crews, the clean-up, Mito and his bubble, and — round 11, clarity —
 * the **what to do now** line and the **goal** (its sentence and the three needs as labelled bars), the drawn
 * gesture of the first tap, the story card and the new cell's toast.  What is not in play yet is dimmed (the
 * bars, the lane) or hidden (the clean-up), and appears with a highlight when the sim reveals it.
 *
 * It reads the sim and its events; it never changes the rules.  Light comes from baked glow sprites, static
 * layers are cached on resize, particles are pooled (DESIGN §12: no shadowBlur, no filter, ≤ 4 ms a frame).
 */
import { breathCycle } from '../kit/breath';
import { breathGuideBox, breathGuideRadius, breathOf, drawBreathGuide, type BreathGuideOpts } from '../kit/breathguide';
import { clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageLayout } from '../kit/scripture';
import type { Insets } from '../kit/types';
import { LESIONS, cardNum, cardSpec, cardText, cardTitle, cellName, lesionName, partName, stepName, type CardId, type NicheId } from './content';
import { t, type Key } from './i18n';
import { chipAt, inRect, laneU, laneX, layout, onLane, onLens, type Layout, type Rect } from './layout';
import {
  C, ENTRY_ANGLE, PUMP_ANGLES, SANS, fitFont, font, glow, hash, label, paintAtp, paintBubble, paintCellIcon, paintChipIcon,
  paintCity, paintCrew, paintGauge, paintHand, paintHelixStrip, paintLensBack, paintLensRim, paintLesion, paintLysosome,
  paintMended, paintMito, paintMitoSmall, paintMitosis, paintNowIcon, paintPart, paintPhagophore, paintTick, paintTurbine, rgba, rr,
  strands, type NowIcon,
} from './paint';
import { RULES, readSec } from './rules';
import type { CoachAt, Lesion, NowKind, OdnowaSim, Part, SimEvent, Sys } from './sim';

const TAU = Math.PI * 2;

interface Fly { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; kind: 'atp' | 'bead' | 'cell'; color: string; lift: number; rot: number }
interface Wave { x: number; y: number; r: number; t: number; color: string }
interface Proton { pump: number; k: number; wob: number }

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

/** The sing-along line the index hands over each frame. */
export interface Lyric { text: string; p: number }

/** The goal's three needs, in the order of the bars: energy, DNA repair, building material. */
export const NEED_SYS: readonly Sys[] = ['energy', 'dna', 'clean'];
/** Each bar's icon (paint's chip icons: 0 ATP, 1 building beads, 2 a helix) and colour. */
const NEED_ICON: readonly (0 | 1 | 2)[] = [0, 2, 1];
const NEED_COLOR = ['#ffd860', '#8ff0ff', C.mint] as const;
const NEED_SRC_ICON: readonly NowIcon[] = ['focus', 'tap', 'rest'];

/** The line's look for each kind: its icon, its colour, its words. */
const NOW: Readonly<Record<NowKind, { icon: NowIcon; color: string }>> = {
  wait: { icon: 'focus', color: C.cream },
  energy: { icon: 'focus', color: C.goldHi },
  dna: { icon: 'tap', color: '#ffb0a0' },
  rest: { icon: 'rest', color: '#bfe3ff' },
  blind: { icon: 'blind', color: '#e0d6ff' },
  check: { icon: 'check', color: C.amber },
  divide: { icon: 'divide', color: C.mint },
  nosignal: { icon: 'nosignal', color: 'rgba(220,230,235,0.9)' },
  end: { icon: 'end', color: C.cream },
};

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
  private readonly sparks = new Particles(300);
  private readonly floats = new Floaters();
  private readonly shake: Shake;
  private readonly flies: Fly[] = [];
  private readonly waves: Wave[] = [];
  private readonly protons: Proton[] = [];
  private beta: [number, number, number] = [0, 0, 0];
  private lensK = 1;
  private now = 0;
  private flash = 0;
  private chipPop: [number, number, number] = [0, 0, 0];
  /** a system just shown: its highlight (1 → 0) */
  private readonly lit: Record<Sys, number> = { energy: 0, dna: 0, clean: 0, divide: 0 };
  /** each system's presence (0 dim/hidden → 1 in play), eased */
  private readonly pres: Record<Sys, number> = { energy: 0, dna: 0, clean: 0, divide: 0 };
  private extraFlash: [number, number, number] = [0, 0, 0];
  private lysoFuse: number[] = [0, 0, 0];
  private blink = 0;
  private blinkT = 2;
  private joy = 0;
  private bubbleA = 0;
  private lastLine = '';
  /** the line: what it says now and what it said (a crossfade), and its pop when it changes */
  private nowKind: NowKind = 'wait';
  private nowWas: NowKind = 'wait';
  private nowFade = 1;
  private storyLayout: PassageLayout | null = null;
  private storyKey = '';
  /** the latest crew at work: its label over the lane */
  private crewId = -1;
  /** the gesture of the first tap is drawn while this is on (the index sets it with the coach mark) */
  hand = false;
  /** an autophagosome is never carried in round 11; kept for the index's cursor */
  drag: { id: number; x: number; y: number } | null = null;
  /** where a mouse rests (a desk: hover answers), null when it left or on a touch screen */
  hover: { x: number; y: number } | null = null;
  /** seconds since the mouse last moved (a resting mouse's tag fades) */
  hoverAge = 0;
  lyric: Lyric | null = null;
  private cellNiche: NicheId = 'gut';
  /** Wiedza cards met in play, shown one at a time — only in a rest, one a rest, for their reading time */
  private readonly cardQ: CardId[] = [];
  private cardShow: { id: CardId; t: number; dur: number } | null = null;
  private cardBlock = -1;
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
    this.L = layout(w, h, insets, this.o.touch);
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
    return -((sim.scanned * this.pxPerU) % this.P);
  }

  /** A lesion's rung x (snapped to the helix's rungs, which scroll with it). */
  rungX(sim: OdnowaSim, u: number): number {
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

  /** Where a worn part is drawn now (the spot, on its way, at its lysosome). */
  partPos(p: Part): { x: number; y: number } {
    const L = this.L;
    const sp = L.spots[p.spot] ?? L.spots[0];
    const ly = L.lysos[p.lyso] ?? L.lysos[0];
    if (p.phase === 'tag' || p.phase === 'wrap' || p.phase === 'sealed') return { x: sp.x, y: sp.y + Math.sin(this.now * 1.1 + p.seed * 9) * 3 };
    if (p.phase === 'travel') {
      const k = ease.inOutSine(clamp(p.k));
      return { x: sp.x + (ly.x - sp.x) * k, y: sp.y + (ly.y - sp.y) * k - Math.sin(k * Math.PI) * 18 };
    }
    return { x: ly.x, y: ly.y };
  }

  /** The worn part under a point (a desk's hover), or null. */
  partAt(sim: OdnowaSim, x: number, y: number): number | null {
    let best: number | null = null, d = Infinity;
    const reach = Math.max(28, this.L.mito.r * 1.6);
    for (const p of sim.parts) {
      if (p.phase === 'done' || p.phase === 'fuse' || p.phase === 'digest') continue;
      const q = this.partPos(p);
      const dd = Math.hypot(q.x - x, q.y - y);
      if (dd < reach && dd < d) { d = dd; best = p.id; }
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
      case 'chip': {
        const c = L.chips[at.i];
        return { x: c.x + c.w / 2, y: L.mode === 'tall' ? c.y + c.h : c.y + c.h / 2 };
      }
      case 'goal': return { x: L.goal.x + L.goal.w / 2, y: L.mode === 'tall' ? L.goal.y + L.goal.h : L.goal.y + L.goal.h / 2 };
      case 'lane': return { x: L.lane.x + L.lane.w / 2, y: L.lane.y };
      case 'ring': return { x: L.lens.x, y: L.lens.y - L.lens.r * 1.08 };
      // the turbine: its lower rim, so the bubble over it leaves the head in sight
      default: return { x: L.lens.x, y: L.lens.y + L.lens.r * 0.92 };
    }
  }

  // ── input feedback ───────────────────────────────────────────────
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
          const third = Math.floor((((sim.angle % 1) + 1) % 1) * 3) % 3;
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
      case 'gold':
        this.waves.push({ x: L.lens.x, y: L.lens.y, r: L.lens.r, t: 0, color: C.gold });
        this.sparks.burst(L.lens.x, L.lens.y, 24, { color: C.gold, size: 2.6, speed: 180, g: 0, drag: 2, life: 0.7 });
        this.floats.add(t('fx.gold'), L.lens.x, L.lens.y - L.lens.r * 0.45, { color: C.goldHi, size: Math.max(MIN_READ + 3, 18 * L.u), dur: 1.6 });
        break;
      case 'spawn': {
        if (e.kind === 'dsb') this.shake.add(0.25);
        const l = sim.lesions.find(x => x.id === e.id);
        if (l) this.sparks.burst(this.rungX(sim, l.u), L.laneMid, 10, { color: '#ff8f7a', size: 2.4, speed: 90, g: 0, drag: 3, life: 0.5, shape: 'ring' });
        break;
      }
      case 'repairStart': {
        this.crewId = e.id;
        const l = sim.lesions.find(x => x.id === e.id);
        if (l && e.by === 'tap') this.sparks.burst(this.rungX(sim, l.u), L.laneMid, 10, { color: C.mint, size: 2.2, speed: 150, g: 0, drag: 4, life: 0.4, shape: 'spark' });
        break;
      }
      case 'repaired': {
        const l = sim.lesions.find(x => x.id === e.id);
        if (l) {
          const x = this.rungX(sim, l.u);
          this.sparks.burst(x, L.laneMid, e.by === 'tap' ? 16 : 8, { color: e.by === 'cell' ? '#bfe9ff' : C.mint, size: 2.6, speed: 170, g: 40, drag: 2.5, life: 0.6 });
          const ch = L.chips[1];
          this.fly(x, L.laneMid, ch.x + ch.h * 0.5, ch.y + ch.h * 0.5, 'bead', '#8ff0ff', 0.7);
          this.floats.add(t('fx.dna'), x, L.lane.y - 6, { color: '#bff6ff', size: Math.max(MIN_READ + 1, 15 * L.u), dur: 1.1 });
        }
        break;
      }
      case 'fuse':
        this.lysoFuse[e.lyso] = 1;
        break;
      case 'recycled': {
        const ly = L.lysos[e.lyso] ?? L.lysos[0];
        const ch = L.chips[2];
        for (let i = 0; i < Math.min(8, e.mat * 2); i++) this.fly(ly.x, ly.y, ch.x + ch.h * 0.5, ch.y + ch.h / 2, 'bead', ['#7ff2c4', '#ffd36b', '#ff9fc6', '#8fd8ff'][i % 4], 0.7 + i * 0.07);
        this.floats.add(t('fx.mat', { n: e.mat }), ly.x, ly.y - ly.r - 8, { color: C.mint, size: Math.max(MIN_READ + 1, 15 * L.u), dur: 1.3 });
        break;
      }
      case 'full':
        this.chipPop[e.need] = 1;
        this.sparks.burst(L.chips[e.need].x + L.chips[e.need].w / 2, L.chips[e.need].y + L.chips[e.need].h / 2, 14, { color: C.gold, size: 2.2, speed: 120, g: 0, drag: 3, life: 0.6 });
        break;
      case 'reveal':
        this.lit[e.sys] = 1;
        break;
      case 'blindEnd':
        if (e.n > 0) {
          this.floats.add(t('fx.blind', { n: e.n }), L.lens.x, L.lens.y - L.lens.r * 0.3, { color: C.goldHi, size: Math.max(MIN_READ + 4, 20 * L.u), dur: 2.4 });
          this.chipPop[0] = 1;
          this.sparks.burst(L.lens.x, L.lens.y, 30, { color: C.gold, size: 2.8, speed: 220, g: 0, drag: 2, life: 0.8 });
        }
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
    this.fly(x, y, ch.x + ch.h * 0.5, ch.y + ch.h / 2, 'atp', C.gold, 0.75 + Math.random() * 0.25);
  }

  private fly(x0: number, y0: number, x1: number, y1: number, kind: Fly['kind'], color: string, dur: number): void {
    if (this.flies.length >= 70) return;
    this.flies.push({ x0, y0, x1, y1, t: 0, dur, kind, color, lift: 30 + Math.random() * 50, rot: Math.random() * TAU });
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, sim: OdnowaSim): void {
    this.now += dt;
    this.hoverAge += dt;
    const rest = sim.restBlock ? 1 : 0;
    this.lensK += ((rest ? 0.86 : 1) - this.lensK) * Math.min(1, dt * 3);
    for (let i = 0; i < 3; i++) {
      this.beta[i] = Math.max(0, this.beta[i] - dt * 2.8);
      this.chipPop[i] = Math.max(0, this.chipPop[i] - dt * 2);
      this.extraFlash[i] = Math.max(0, this.extraFlash[i] - dt * 3);
      this.lysoFuse[i] = Math.max(0, this.lysoFuse[i] - dt * 1.5);
    }
    for (const s of ['energy', 'dna', 'clean', 'divide'] as const) {
      this.lit[s] = Math.max(0, this.lit[s] - dt / 1.8);
      this.pres[s] += ((sim.shown(s) ? 1 : 0) - this.pres[s]) * Math.min(1, dt * 2.5);
    }
    this.flash = Math.max(0, this.flash - dt * (this.o.reducedMotion ? 1.2 : 2.2));
    this.joy = Math.max(0, this.joy - dt * 0.7);
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 1;
      this.blinkT = 2.5 + Math.random() * 3;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    // the protons stream from the pumps to the turbine's entry, faster as it spins
    for (const p of this.protons) {
      p.k += dt * (0.12 + sim.spin * 0.4) * (0.7 + p.wob * 0.6);
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
        if (f.kind === 'atp') this.chipPop[0] = Math.max(this.chipPop[0], 0.6);
        if (f.kind === 'bead') this.chipPop[f.color === '#8ff0ff' ? 1 : 2] = Math.max(this.chipPop[f.color === '#8ff0ff' ? 1 : 2], 0.7);
        this.sparks.burst(f.x1, f.y1, 3, { color: f.color, size: 1.8, speed: 50, g: 0, drag: 3, life: 0.3 });
        this.flies.splice(i, 1);
      }
    }
    this.sparks.update(dt);
    this.floats.update(dt);
    // the line: a change crossfades
    if (sim.now !== this.nowKind) {
      this.nowWas = this.nowKind;
      this.nowKind = sim.now;
      this.nowFade = 0;
    }
    this.nowFade = Math.min(1, this.nowFade + dt / 0.5);
    // a Wiedza card: only in a rest, one a rest, when nothing else speaks
    if (this.cardShow) {
      this.cardShow.t += dt;
      if (this.cardShow.t >= this.cardShow.dur || sim.cellCard || sim.story || (!sim.restBlock && sim.phase === 'play')) this.cardShow = null;
    } else {
      const cc = this.cardQ[0];
      if (cc && sim.restBlock && sim.blockIndex !== this.cardBlock && sim.blockT > RULES.bannerSec + 1 && sim.shown('divide')
        && !sim.cellCard && !sim.story && !sim.mitosis && !sim.talk.line && !sim.hintUp && this.bubbleA < 0.05
        && sim.block.dur - sim.blockT > 7) {
        this.cardQ.shift();
        this.cardBlock = sim.blockIndex;
        const text = `${cardTitle(cc)} ${cardNum(cc)} ${cardText(cc)}`;
        this.cardShow = { id: cc, t: 0, dur: Math.min(readSec(text), sim.block.dur - sim.blockT - 0.5) };
      }
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
    // the calm of a rest block: a cool veil over the cell
    if (sim.restBlock) {
      ctx.fillStyle = 'rgba(30,60,110,0.16)';
      ctx.fillRect(0, L.top, this.w, this.h - L.top);
    }
    this.drawDrift(ctx, sim);
    this.drawExtras(ctx, sim);
    this.drawLens(ctx, sim);
    this.drawCleanup(ctx, sim);
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
    this.drawHover(ctx, sim);
    this.drawMito(ctx, sim);
    this.drawGoal(ctx, sim);
    this.drawNow(ctx, sim);
    this.drawLyric(ctx);
    this.floats.draw(ctx, `800 ${SANS}`);
    this.drawToast(ctx, sim);
    if (this.hand) this.drawHand(ctx, sim);
    if (this.flash > 0) {
      ctx.fillStyle = this.o.reducedMotion ? `rgba(255,240,200,${0.25 * this.flash})` : `rgba(255,250,230,${0.45 * this.flash})`;
      ctx.fillRect(0, L.top, this.w, this.h - L.top);
    }
    if (sim.story) this.drawStory(ctx, sim);
  }

  // ── layers ──────────────────────────────────────────────────────
  /** Vesicles drifting through the cytoplasm: the cell breathes (slower in a rest). */
  private drawDrift(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const c = this.L.city;
    const slow = sim.restBlock ? 0.45 : 1;
    for (let i = 0; i < 9; i++) {
      const sx = hash(i * 4.1), sy = hash(i * 7.3);
      const x = c.x + ((sx * c.w + this.now * (6 + 10 * hash(i)) * slow * (i % 2 ? 1 : -1)) % c.w + c.w) % c.w;
      const y = c.y + sy * c.h + Math.sin(this.now * 0.5 + i) * 10;
      const r = 3 + 5 * hash(i * 2.9);
      const col = i % 3 === 0 ? '#ffd6a8' : i % 3 === 1 ? '#a8f0e0' : '#c8b8ff';
      glow(ctx, col, x, y, r * 3.2, 0.18);
      ctx.strokeStyle = rgba(col, 0.4);
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

  /**
   * The rest's breath guide in the lens (kit/breathguide, round 15): stacked on the lens's centre, its ring as large as
   * the screen asks but its whole box inside the lens (never under 26 px), the sub line "oddech n z m".
   */
  lensGuide(ctx: CanvasRenderingContext2D, sim: OdnowaSim): BreathGuideOpts | null {
    const c = this.L.lens;
    const R = c.r * this.lensK;
    const b = sim.breathNow;
    if (!b) return null;
    const cyc = breathCycle(sim.breath);
    const of = Math.max(1, Math.round(sim.block.dur / cyc));
    const sub = breathOf(Math.min(of, b.n + 1), of);
    let o: BreathGuideOpts = { cx: c.x, cy: c.y, r: breathGuideRadius(this.L.w, this.L.h), sub, maxW: R * 1.5, scrim: 0.72 };
    for (;;) {
      const box = breathGuideBox(ctx, o);
      if ((box.h <= R * 1.7 && box.w <= R * 1.7) || o.r <= 26) return { ...o, cy: c.y - (box.y + box.h / 2 - c.y) };
      o = { ...o, r: Math.max(26, o.r - 2) };
    }
  }

  private drawLens(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, c = L.lens;
    const r = c.r * this.lensK;
    const veiled = sim.blind;
    const m = sim.mitosis;
    const beatK = (1 - (this.beat % 1)) ** 3;
    if (this.lit.energy > 0) glow(ctx, C.goldHi, c.x, c.y, r * 1.9, 0.5 * this.lit.energy);
    glow(ctx, sim.gold > 0.3 ? C.gold : '#9f8cff', c.x, c.y, r * 1.45, 0.14 + sim.drive * 0.22 + beatK * 0.06 + sim.gold * 0.25);
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
      // a stopped rotor shivers a little (Brownian), never turning: no focus, no turn
      const jig = sim.spin < 0.05 && !this.o.reducedMotion ? Math.sin(this.now * 7.3) * 0.004 : 0;
      paintTurbine(ctx, r, {
        angle: sim.angle + jig, grad: sim.drive, spin: sim.spin, beta: this.beta, gold: sim.gold, t: this.now,
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
      ctx.fillStyle = 'rgba(70,60,120,0.6)';
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
    // the gauge: the band where it drives the turbine (or calm in a rest); the threshold at the top
    const gv = sim.meter();
    if (!veiled && !m) {
      const restG = sim.restBlock;
      paintGauge(ctx, c.x, c.y, r + Math.max(6, r * 0.08), gv, restG ? C.rest : C.vane, restG ? '#cfeaff' : C.gold);
    }
    paintLensRim(ctx, c.x, c.y, r, sim.gold > 0.05 ? sim.gold : 0);
    // words on the lens: what it does now (plain), never more than one line
    const fs = Math.max(MIN_READ, Math.round(13 * L.u));
    const low = c.y + r * 0.66;
    const breath = sim.restBlock ? sim.breathNow : null;
    if (breath) {
      // the rest's breath: the kit's guide in the lens (round 15) — the idle turbine, or a division, under its scrim
      const o = this.lensGuide(ctx, sim);
      if (o) drawBreathGuide(ctx, breath, { ...o, alpha: Math.min(1, sim.blockT / 0.6, Math.max(0, sim.block.dur - sim.blockT) / 0.6), reducedMotion: this.o.reducedMotion, time: this.now });
    } else if (m) {
      const ph = Math.min(4, m.phase);
      const title = t('mit.title');
      label(ctx, title, c.x, c.y - r * 0.8, fitFont(ctx, title, r * 1.4, fs + 2, MIN_READ, 800), C.cream);
      const sub = t(`mit.${ph}` as Key);
      label(ctx, sub, c.x, low, fitFont(ctx, sub, r * 1.6, fs, MIN_TEXT + 1, 700), C.mint, 'center', 700);
    } else if (veiled) label(ctx, t('lens.blind'), c.x, c.y, fs + 1, '#e6deff');
    else if (sim.energyOn && this.pres.energy > 0.5) {
      const idle = sim.spin < 0.05;
      const txt = t(idle ? 'lens.idle' : sim.gold > 0.6 ? 'lens.gold' : 'lens.per');
      const px = fitFont(ctx, txt, r * 1.7, fs, MIN_READ, 700);
      label(ctx, txt, c.x, low, px, idle ? 'rgba(230,240,255,0.92)' : sim.gold > 0.6 ? C.goldHi : 'rgba(255,246,230,0.92)', 'center', 700);
    }
  }

  private drawProtons(ctx: CanvasRenderingContext2D, sim: OdnowaSim, r: number): void {
    const n = Math.round(3 + 30 * clamp(sim.drive) + sim.gold * 6);
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
    // electrons hop along the chain: I → III → IV (only while the turbine works)
    if (sim.drive > 0.05) {
      const e = (this.now * (0.6 + sim.drive * 1.6)) % 1;
      const seg = Math.min(1, Math.floor(e * 2));
      const k = (e * 2) % 1;
      const aa = PUMP_ANGLES[seg] + (PUMP_ANGLES[seg + 1] - PUMP_ANGLES[seg]) * k;
      glow(ctx, C.electron, Math.cos(aa) * r * 0.86, Math.sin(aa) * r * 0.86 - Math.sin(k * Math.PI) * r * 0.06, r * 0.08, 0.8 * (sim.blind ? 0.3 : 1) * clamp(sim.drive * 3));
    }
  }

  /** The clean-up: lysosomes and the worn parts on their way — hidden until the sim shows it. */
  private drawCleanup(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const a = this.pres.clean;
    if (a < 0.02) return;
    const L = this.L;
    ctx.save();
    ctx.globalAlpha = a;
    const b = sim.breathNow;
    const breath = b ? b.k : 0.3 + 0.1 * Math.sin(this.now);
    for (let i = 0; i < sim.lysoSlots; i++) {
      const l = L.lysos[i];
      const digest = sim.parts.some(p => p.lyso === i && p.phase === 'digest') ? 1 : 0;
      if (this.lit.clean > 0) glow(ctx, '#c7a8ff', l.x, l.y, l.r * 3, 0.5 * this.lit.clean);
      if (b) {
        // the calm ring: the breath guide round each lysosome
        ctx.strokeStyle = `rgba(160,210,255,${0.25 + 0.35 * breath})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r * (1.5 + breath * 0.6), 0, TAU);
        ctx.stroke();
      }
      paintLysosome(ctx, l.x, l.y, l.r, this.now, breath, this.lysoFuse[i], digest);
    }
    const s = Math.max(14, L.mito.r * 1.05);
    const wrapping = sim.restBlock || sim.phase === 'finale';
    for (const p of sim.parts) {
      if (p.phase === 'done' || p.phase === 'digest') continue;
      const q = this.partPos(p);
      if (p.phase === 'fuse') {
        ctx.globalAlpha = a * (1 - p.k);
        paintPart(ctx, p.kind, q.x, q.y, s * (1 - p.k * 0.6), this.now, p.seed, 0);
        ctx.globalAlpha = a;
        continue;
      }
      // a part waiting for the next rest rests dim
      if (p.phase === 'wrap' && !wrapping) ctx.globalAlpha = a * 0.55;
      if (p.phase === 'tag') paintPart(ctx, p.kind, q.x, q.y, s, this.now, p.seed, p.k);
      else if (p.phase === 'wrap') {
        paintPart(ctx, p.kind, q.x, q.y, s, this.now, p.seed, 1);
        paintPhagophore(ctx, q.x, q.y, s * 1.35, p.k, this.now);
      } else {
        glow(ctx, '#ffd6be', q.x, q.y, s * 2, 0.3);
        paintPart(ctx, p.kind, q.x, q.y, s * 0.8, this.now, p.seed, 1);
        paintPhagophore(ctx, q.x, q.y, s * 1.2, 1, this.now);
      }
      ctx.globalAlpha = a;
    }
    ctx.restore();
  }

  private drawLane(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, ln = L.lane;
    const a = 0.3 + 0.7 * this.pres.dna;
    // the panel: a dark glass strip with a bright edge
    ctx.fillStyle = 'rgba(4,14,22,0.62)';
    rr(ctx, ln.x, ln.y, ln.w, ln.h, 14);
    ctx.fill();
    const hot = sim.checkpoint || sim.now === 'dna';
    ctx.strokeStyle = sim.checkpoint ? rgba(C.amber, 0.85) : hot ? 'rgba(255,170,150,0.6)' : `rgba(160,230,255,${0.2 + 0.2 * this.pres.dna})`;
    ctx.lineWidth = hot ? 2 : 1.2;
    ctx.stroke();
    if (this.lit.dna > 0) {
      ctx.strokeStyle = rgba(C.goldHi, this.lit.dna);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.save();
    rr(ctx, ln.x + 1, ln.y + 1, ln.w - 2, ln.h - 2, 13);
    ctx.clip();
    ctx.globalAlpha = a;
    const off = this.scrollOff(sim);
    if (this.strip) {
      for (let x = L.ux0 + off - this.P; x < ln.x + ln.w + this.P; x += this.P) ctx.drawImage(this.strip, x, ln.y, this.P, ln.h);
    }
    ctx.globalAlpha = 1;
    // the lesions and their crews
    const amp = L.amp;
    for (const l of sim.lesions) {
      if (l.u < -0.6 || l.u > RULES.laneU + 0.6) continue;
      const x = this.rungX(sim, l.u);
      const [ya, yb] = this.strandsAt(sim, x);
      if (l.kind === 'dsb' && l.state !== 'done') {
        // the break cuts the helix: a dark gap
        ctx.fillStyle = 'rgba(4,14,22,0.9)';
        ctx.fillRect(x - amp * 0.18, ln.y + 2, amp * 0.36, ln.h - 4);
      }
      if (l.state === 'done') {
        paintMended(ctx, x, ya, yb, amp, clamp(l.done / 1.2));
        continue;
      }
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 6 + l.seed * 10);
      if (l.state === 'open') {
        // it glows: the thing to tap
        const k = clamp(l.t / 0.4);
        glow(ctx, '#ff6a52', x, (ya + yb) / 2, amp * (1.5 + 0.4 * pulse), (0.45 + 0.3 * pulse) * k * (sim.restBlock ? 0.5 : 1));
      }
      paintLesion(ctx, l.kind, x, ya, yb, amp, l.state === 'fixing' ? 0.2 : pulse, false);
      if (l.state === 'fixing') {
        const steps = LESIONS[l.kind].steps;
        const step = steps[Math.min(l.step, steps.length - 1)];
        const arrive = clamp(1 + l.st / RULES.crewIn);
        const cy = (ya + yb) / 2 - amp * 1.1 * (1 - ease.outCubic(arrive)) - amp * 0.15;
        paintCrew(ctx, step, x, cy, Math.max(12, amp * 0.75), clamp(l.st / 0.3), this.now);
      }
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
    // one crew's words at a time: plain first, the enzyme second ("ekipa naprawcza · ligaza")
    const px = Math.max(MIN_READ, Math.round(13 * L.u));
    const cl = sim.lesions.find(x => x.id === this.crewId && x.state === 'fixing');
    if (cl) {
      const steps = LESIONS[cl.kind].steps;
      const step = steps[Math.min(cl.step, steps.length - 1)];
      const txt = t(cl.by === 'cell' ? 'lane.cell' : 'lane.crew', { step: stepName(step) });
      const x = clamp(this.rungX(sim, cl.u), ln.x + 70 * L.u, ln.x + ln.w - 70 * L.u);
      const fpx = fitFont(ctx, txt, ln.w * 0.8, px, MIN_READ, 700);
      label(ctx, txt, x, ln.y + fpx * 0.8 + 2, fpx, cl.by === 'cell' ? '#cfeaff' : C.cream, 'center', 700);
    } else if (this.pres.dna > 0.5 && sim.dna >= sim.needs.dna && !sim.liveLesions.length && !sim.mitosis) {
      // the stage's repairs are done: no more damage comes until the division
      label(ctx, t('lane.done'), ln.x + ln.w - 14, ln.y + ln.h - px * 0.85, px, C.mint, 'right', 700);
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
      t: this.now, talk: !!line, blink: this.blink, joy: Math.max(this.joy, sim.gold > 0.8 ? 0.8 : 0),
      tired: sim.restBlock ? 0.6 : 0, look: Math.sin(this.now * 0.4) * 0.4,
    });
    if (this.bubbleA > 0.02 && this.lastLine) {
      const px = Math.max(14, Math.round(14 * L.u));
      const b = L.bubble;
      const up = b.anchor === 'bottom';
      const tailX = up ? m.x : m.x + (b.side === 'right' ? m.r * 0.8 : -m.r * 0.8), tailY = up ? m.y - m.r * 0.9 : m.y - m.r * 0.6;
      // a line held back (a banner, a coach mark) waits faded, never cut half-read
      const held = sim.talkBlocked ? 0.35 : 1;
      paintBubble(ctx, this.lastLine, b.x, up ? b.y : Math.max(L.top + 2, b.y), b.maxW, b.side, px, tailX, tailY, this.bubbleA * held, up, L.top + 2);
    }
  }

  // ── the goal and the line ────────────────────────────────────────
  /** The goal: its sentence and the three needs (a name, its source, a bar, a count) — dim until each is in play. */
  private drawGoal(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L, u = L.u;
    const shares = sim.shares;
    const n = sim.needs;
    const counts = [`${Math.min(sim.stageAtp, n.atp)}/${n.atp}`, `${Math.min(sim.dna, n.dna)}/${n.dna}`, `${Math.min(sim.material, n.mat)}/${n.mat}`];
    const names = [t('need.energy'), t('need.dna'), t('need.mat')];
    const srcs = [t('src.energy'), t(this.o.touch ? 'src.dna' : 'src.dna.mouse'), t('src.mat')];
    const wide = L.chipStyle === 'bar';
    // the goal's sentence
    const gt = L.goalTitle;
    const titleTxt = t(wide ? 'goal.title' : 'goal.short');
    const tpx = Math.max(MIN_READ, Math.round((wide ? 15 : 13) * u));
    ctx.textBaseline = 'middle';
    if (L.mode === 'tall') {
      const px = fitFont(ctx, titleTxt, gt.w, tpx, MIN_READ, 800);
      label(ctx, titleTxt, gt.x + gt.w / 2, gt.y + gt.h / 2, px, C.cream, 'center', 800);
    } else {
      ctx.font = font(tpx, 800);
      let lines = wrapLines(ctx, titleTxt, gt.w);
      let px = tpx;
      while (lines.length > 2 && px > MIN_READ) {
        px -= 0.5;
        ctx.font = font(px, 800);
        lines = wrapLines(ctx, titleTxt, gt.w);
      }
      const lh = gt.h / 2;
      lines.slice(0, 2).forEach((ln, i) => label(ctx, ln, gt.x, gt.y + lh * (i + 0.5) + (lines.length === 1 ? lh / 2 : 0), px, C.cream, 'left', 800));
    }
    for (let i = 0; i < 3; i++) {
      const c = L.chips[i], v = shares[i], full = v >= 1;
      const on = this.pres[NEED_SYS[i]];
      const dim = 0.4 + 0.6 * on;
      const pop = this.chipPop[i], lit = this.lit[NEED_SYS[i]];
      const amber = i === 1 && sim.checkpoint;
      ctx.save();
      ctx.globalAlpha = dim;
      if (lit > 0) glow(ctx, C.goldHi, c.x + c.w / 2, c.y + c.h / 2, c.w * 0.7, 0.5 * lit);
      ctx.fillStyle = full ? 'rgba(40,32,8,0.78)' : 'rgba(4,16,22,0.72)';
      rr(ctx, c.x, c.y, c.w, c.h, Math.min(14, c.h / 2));
      ctx.fill();
      ctx.strokeStyle = amber ? rgba(C.amber, 0.95) : full ? rgba(C.gold, 0.95) : `rgba(180,240,255,${0.3 + Math.max(pop, lit) * 0.6})`;
      ctx.lineWidth = full || amber || lit > 0.3 ? 2 : 1.2;
      ctx.stroke();
      const pad = Math.round(7 * u);
      if (wide) {
        // a panel's bar: the icon, the name and its source, the count, the bar along the foot
        const is = c.h * 0.36;
        paintChipIcon(ctx, NEED_ICON[i], c.x + pad + is * 0.6, c.y + c.h * 0.42, is * (1 + pop * 0.15), this.now);
        const tx = c.x + pad * 2 + is * 1.2, right = c.x + c.w - pad;
        const npx = Math.max(MIN_READ, Math.round(14 * u)), spx = Math.max(MIN_READ, Math.round(12.5 * u));
        const ty = c.y + c.h * 0.38;
        ctx.font = font(npx, 800);
        const cw = on > 0.5 ? ctx.measureText(counts[i]).width : 0;
        if (on > 0.5) {
          ctx.textAlign = 'right';
          ctx.fillStyle = full ? C.goldHi : C.cream;
          ctx.fillText(counts[i], right - (full ? spx * 1.3 : 0), ty);
          if (full) paintTick(ctx, right - spx * 0.45, ty, spx, C.gold);
        }
        const room = right - tx - cw - 10 - (full ? spx * 1.3 : 0);
        const nw = Math.min(room, ctx.measureText(names[i]).width);
        const fpx = fitFont(ctx, names[i], room, npx, MIN_READ, 800);
        ctx.textAlign = 'left';
        ctx.fillStyle = amber ? C.amber : C.cream;
        ctx.fillText(names[i], tx, ty);
        const srcRoom = room - nw - 8;
        ctx.font = font(spx, 600);
        if (srcRoom > ctx.measureText(`· ${srcs[i]}`).width && fpx >= npx) {
          ctx.fillStyle = 'rgba(220,240,245,0.75)';
          ctx.fillText(`· ${srcs[i]}`, tx + nw + 6, ty + 0.5);
        }
        this.bar(ctx, tx, c.y + c.h * 0.72, right - tx, Math.max(4, 5 * u), on > 0.5 ? v : 0, NEED_COLOR[i], full, amber);
      } else if (L.chipStyle === 'line') {
        // a phone on its side: one line — the source's sign, the name, the count — and the bar along the foot
        const gs = Math.min(c.h * 0.44, 14), y1 = c.y + c.h * 0.42;
        paintNowIcon(ctx, NEED_SRC_ICON[i], c.x + pad + gs / 2, y1, gs, 'rgba(220,240,245,0.85)', this.now);
        const cpx = MIN_READ;
        ctx.font = font(cpx, 800);
        let right = c.x + c.w - pad;
        if (on > 0.5) {
          if (full) { paintTick(ctx, right - cpx * 0.5, y1, cpx, C.gold); right -= cpx * 1.2; }
          else {
            ctx.textAlign = 'right';
            ctx.fillStyle = C.cream;
            ctx.fillText(counts[i], right, y1 + 0.5);
            right -= ctx.measureText(counts[i]).width + 6;
          }
        }
        const tx = c.x + pad + gs + 5;
        fitFont(ctx, names[i], right - tx, MIN_READ, MIN_TEXT + 1, 800);
        ctx.textAlign = 'left';
        ctx.fillStyle = amber ? C.amber : C.cream;
        ctx.fillText(names[i], tx, y1 + 0.5);
        this.bar(ctx, c.x + pad, c.y + c.h - 6, c.w - 2 * pad, 3.5, on > 0.5 ? v : 0, NEED_COLOR[i], full, amber);
      } else {
        // a phone upright: the name on top (with its icon where there is room), under it the source's sign, the bar, the count
        const y1 = c.y + c.h * 0.31, y2 = c.y + c.h * 0.71;
        let tx = c.x + pad;
        if (c.w >= 150 * u) {
          const is = c.h * 0.34;
          paintChipIcon(ctx, NEED_ICON[i], c.x + pad + is * 0.5, y1, is * (1 + pop * 0.15), this.now);
          tx += is + 6;
        }
        fitFont(ctx, names[i], c.x + c.w - pad - tx, Math.max(MIN_READ, Math.round(13 * u)), MIN_TEXT + 1, 800);
        ctx.textAlign = 'left';
        ctx.fillStyle = amber ? C.amber : C.cream;
        ctx.fillText(names[i], tx, y1 + 0.5);
        const gs = Math.min(c.h * 0.34, 14 * u);
        paintNowIcon(ctx, NEED_SRC_ICON[i], c.x + pad + gs / 2, y2, gs, 'rgba(220,240,245,0.85)', this.now);
        const cpx = Math.max(MIN_READ, Math.round(13 * u));
        ctx.font = font(cpx, 800);
        let barEnd = c.x + c.w - pad;
        if (on > 0.5) {
          if (full) {
            paintTick(ctx, barEnd - cpx * 0.5, y2, cpx, C.gold);
            barEnd -= cpx * 1.2;
          } else {
            ctx.textAlign = 'right';
            ctx.fillStyle = C.cream;
            ctx.fillText(counts[i], barEnd, y2 + 0.5);
            barEnd -= ctx.measureText(counts[i]).width + 5;
          }
        }
        const bx = c.x + pad + gs + 4;
        this.bar(ctx, bx, y2, barEnd - bx, Math.max(4, 5 * u), on > 0.5 ? v : 0, NEED_COLOR[i], full, amber);
      }
      ctx.restore();
    }
    // what a division brings (a wide panel)
    const oc = L.outcome;
    if (oc) {
      const on = this.pres.divide;
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.6 * on;
      if (this.lit.divide > 0) glow(ctx, C.mint, oc.x + oc.w / 2, oc.y + oc.h / 2, oc.w * 0.6, 0.45 * this.lit.divide);
      const is = oc.h * 0.62;
      paintCellIcon(ctx, sim.niche, oc.x + is * 0.6, oc.y + oc.h / 2, is * 0.5);
      const tx = oc.x + is * 1.3, tw = oc.w - is * 1.3;
      const txt = t('goal.outcome', { n: sim.p.tissue[sim.niche] + sim.cellsNow[sim.niche] });
      const px = Math.max(MIN_READ, Math.round(12.5 * u));
      ctx.font = font(px, 700);
      const lines = wrapLines(ctx, txt, tw);
      const lh = Math.round(px * 1.25);
      const y0 = oc.y + oc.h / 2 - (lines.length - 1) * lh / 2;
      lines.slice(0, 2).forEach((ln, i) => label(ctx, ln, tx, y0 + i * lh, px, sim.readyToDivide ? C.mint : 'rgba(225,245,240,0.9)', 'left', 700));
      ctx.restore();
    }
  }

  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, color: string, full: boolean, amber: boolean): void {
    if (w <= 4) return;
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    rr(ctx, x, y - h / 2, w, h, h / 2);
    ctx.fill();
    if (v <= 0) return;
    ctx.fillStyle = amber ? C.amber : full ? C.gold : color;
    rr(ctx, x, y - h / 2, Math.max(h, w * clamp(v)), h, h / 2);
    ctx.fill();
  }

  /** The line: what to do now — an icon and a few words, crossfading when the action changes. */
  private drawNow(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    if (sim.story) return;
    const L = this.L, b = L.now, u = L.u;
    const k = ease.outCubic(this.nowFade);
    const draw = (kind: NowKind, a: number, dy: number) => {
      if (kind === 'wait' || a <= 0.01) return;
      const look = NOW[kind];
      const txt = t(nowKey(kind, this.o.touch));
      const is = b.h * 0.6;
      const px = fitFont(ctx, txt, b.w - is - 30 * u, Math.max(14, Math.round(15.5 * u)), MIN_READ, 800);
      const tw = ctx.measureText(txt).width;
      const w = Math.min(b.w, tw + is + 30 * u), x = b.x + (b.w - w) / 2, y = b.y + dy;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(4,16,22,0.8)';
      rr(ctx, x, y, w, b.h, b.h / 2);
      ctx.fill();
      ctx.strokeStyle = rgba(look.color.startsWith('#') ? look.color : '#dde6ea', 0.55 + 0.4 * (1 - k));
      ctx.lineWidth = 1.5;
      ctx.stroke();
      paintNowIcon(ctx, look.icon, x + 10 * u + is / 2, y + b.h / 2, is, look.color, this.now);
      ctx.font = font(px, 800);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = look.color;
      ctx.fillText(txt, x + 16 * u + is, y + b.h / 2 + 0.5);
      ctx.restore();
    };
    // the old words leave first, then the new ones come (never two lines over each other)
    if (this.nowFade < 0.5) draw(this.nowWas, 1 - this.nowFade * 2, -6 * this.nowFade * 2);
    else draw(this.nowKind, (this.nowFade - 0.5) * 2, 6 * (1 - (this.nowFade - 0.5) * 2));
  }

  private drawLyric(ctx: CanvasRenderingContext2D): void {
    const ly = this.lyric, b = this.L.lyric;
    if (!ly || !b) return;
    const L = this.L;
    const px = fitFont(ctx, ly.text, b.w - 30, Math.max(14, Math.round(14 * L.u)), MIN_READ, 600, true, true);
    const tw = ctx.measureText(ly.text).width;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.fillStyle = 'rgba(4,16,22,0.5)';
    rr(ctx, cx - tw / 2 - 14, b.y, tw + 28, b.h, b.h / 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,246,230,0.72)';
    ctx.fillText(ly.text, cx - tw / 2 + 4, cy + 1);
    // the karaoke fill: the words light up gold as the line is sung
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - tw / 2 + 4, b.y, tw * clamp(ly.p * 1.05), b.h);
    ctx.clip();
    ctx.fillStyle = C.goldHi;
    ctx.fillText(ly.text, cx - tw / 2 + 4, cy + 1);
    ctx.restore();
    label(ctx, '♪', cx - tw / 2 - 2, cy, px, C.gold, 'right', 700);
  }

  /** The gesture of the first tap, drawn on the damage that has waited longest (or the lane's middle). */
  private drawHand(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const L = this.L;
    const l = sim.nextAim();
    if (!l) return;
    const x = this.rungX(sim, l.u), y = L.laneMid;
    paintHand(ctx, x, y, Math.max(34, L.lane.h * 0.55), this.now);
  }

  /** A Wiedza card met in play: its icon, its title, its number and its sentence (a desk: and its source). */
  private drawCardToast(ctx: CanvasRenderingContext2D): void {
    const cs = this.cardShow;
    if (!cs) return;
    const L = this.L, b = L.toast;
    const a = clamp(cs.t / 0.3) * clamp((cs.dur - cs.t) / 0.4);
    const slide = (1 - ease.outBack(clamp(cs.t / 0.4))) * -16;
    const y = b.y + slide;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,20,40,0.93)';
    rr(ctx, b.x, y, b.w, b.h, 14);
    ctx.fill();
    ctx.strokeStyle = rgba(C.gold, 0.75);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (L.desk) {
      this.drawDeskCard(ctx, cs.id, y);
      ctx.globalAlpha = 1;
      return;
    }
    const g = cardSpec(cs.id).group;
    const ix = b.x + b.h * 0.45, iy = y + b.h / 2, is = b.h * 0.42;
    if (g === 'energy') paintChipIcon(ctx, 0, ix, iy, is, this.now);
    else if (g === 'repair') paintChipIcon(ctx, 2, ix, iy, is, this.now);
    else if (g === 'clean') paintChipIcon(ctx, 1, ix, iy, is, this.now);
    else paintCellIcon(ctx, this.niche, ix, iy, b.h * 0.22);
    const tx = b.x + b.h * 0.85, tw = b.w - b.h * 0.85 - 10;
    const px = Math.max(MIN_READ, Math.round(13 * L.u));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const title = `${cardTitle(cs.id)} · ${cardNum(cs.id)}`;
    fitFont(ctx, title, tw, px + 1, MIN_READ, 800);
    ctx.fillStyle = C.goldHi;
    ctx.fillText(title, tx, y + b.h * 0.24);
    // the sentence whole on two lines (it stays long enough to read twice)
    ctx.font = font(px, 600);
    let lines = wrapLines(ctx, cardText(cs.id), tw);
    let p2 = px;
    while (lines.length > 2 && p2 > MIN_TEXT + 1) {
      p2 -= 0.5;
      ctx.font = font(p2, 600);
      lines = wrapLines(ctx, cardText(cs.id), tw);
    }
    ctx.fillStyle = C.cream;
    if (lines.length > 2) lines = [lines[0], `${lines[1].replace(/[\s,;:.]+$/, '')}…`];
    lines.forEach((ln, i) => ctx.fillText(ln, tx, y + b.h * (0.55 + i * 0.27)));
    ctx.globalAlpha = 1;
  }

  /** A desk's Wiedza card, whole: the title and its number, the sentence, the source (the words take the card's width). */
  private drawDeskCard(ctx: CanvasRenderingContext2D, id: CardId, y: number): void {
    const L = this.L, b = L.toast, u = L.u;
    const pad = Math.round(14 * u);
    const tx = b.x + pad, tw = b.w - 2 * pad;
    const px = Math.max(MIN_READ, Math.round(13.5 * u));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let ty = y + pad;
    const title = `${cardTitle(id)} · ${cardNum(id)}`;
    const tp = fitFont(ctx, title, tw, px + 2, MIN_READ, 800);
    ctx.fillStyle = C.goldHi;
    ctx.fillText(title, tx, ty);
    ty += Math.round(tp * 1.3);
    ctx.font = font(px, 600);
    const lines = wrapLines(ctx, cardText(id), tw).slice(0, 3);
    ctx.fillStyle = C.cream;
    for (const line of lines) { ctx.fillText(line, tx, ty); ty += Math.round(px * 1.28); }
    const sp = Math.max(MIN_READ, Math.round(12 * u));
    const src = cardSpec(id).src;
    fitFont(ctx, src, tw, sp, MIN_READ, 600);
    ctx.fillStyle = 'rgba(230,250,255,0.62)';
    ctx.fillText(src, tx, Math.min(ty + 2, y + b.h - pad - sp));
  }

  // ── a desk's mouse ───────────────────────────────────────────────
  /**
   * What the mouse rests on: the story card, Mito, a need of the goal, a worn part, the lane (the lesion a click
   * there would mend), the turbine, or nothing.  Never on a touch screen (a finger has no hover).
   */
  overPart(sim: OdnowaSim): { part: 'story' | 'lens' | 'mito' | 'part' | 'lesion' | 'chip' | null; id: number; lesion: Lesion | null } {
    const hv = this.hover;
    const none = { part: null, id: -1, lesion: null };
    if (!hv || this.o.touch || !sim.started || sim.phase === 'done') return none;
    if (sim.story) return { part: 'story', id: -1, lesion: null };
    const L = this.L;
    if (inRect(L.mitoHit, hv.x, hv.y)) return { part: 'mito', id: -1, lesion: null };
    const ci = chipAt(L, hv.x, hv.y);
    if (ci >= 0) return { part: 'chip', id: ci, lesion: null };
    if (onLane(L, hv.x, hv.y) && this.pres.dna > 0.5) {
      const l = sim.laneAim(laneU(L, hv.x));
      return l ? { part: 'lesion', id: l.id, lesion: l } : none;
    }
    const p = this.pres.clean > 0.5 ? this.partAt(sim, hv.x, hv.y) : null;
    if (p !== null) return { part: 'part', id: p, lesion: null };
    if (onLens(L, hv.x, hv.y)) return { part: 'lens', id: -1, lesion: null };
    return none;
  }

  /** The cursor for the mouse: a hand on what a click acts on (Mito, the damage a click would mend). */
  cursor(sim: OdnowaSim): string {
    const p = this.overPart(sim).part;
    return p === 'mito' || p === 'lesion' || p === 'story' ? 'pointer' : 'default';
  }

  /** What the mouse rests on, ringed, with a tag: its name, what it is, what it does (in gold). */
  private drawHover(ctx: CanvasRenderingContext2D, sim: OdnowaSim): void {
    const o = this.overPart(sim);
    if (!o.part || o.part === 'story') return;
    const L = this.L, u = L.u;
    const k = clamp((3 - this.hoverAge) / 0.6);
    let x: number, y: number, r: number, title: string, sub: string, act: string, up = false;
    if (o.part === 'lens') {
      x = L.lens.x; y = L.lens.y; r = L.lens.r * this.lensK + Math.max(8, L.lens.r * 0.1);
      title = t('aim.turbine'); sub = t('aim.turbine.sub'); act = t('aim.turbine.act');
    } else if (o.part === 'mito') {
      x = L.mito.x; y = L.mito.y; r = L.mito.r * 1.35;
      title = t('aim.mito'); sub = ''; act = t('aim.mito.act');
    } else if (o.part === 'chip') {
      const c: Rect = L.chips[o.id];
      const n = sim.needs, i = o.id;
      x = c.x + c.w / 2; y = c.y + c.h / 2; r = 0;
      title = [t('need.energy'), t('need.dna'), t('need.mat')][i];
      sub = [t('src.energy'), t('src.dna.mouse'), t('src.mat')][i];
      act = t(`aim.need.${i}` as Key, { have: [Math.min(sim.stageAtp, n.atp), Math.min(sim.dna, n.dna), Math.min(sim.material, n.mat)][i], of: [n.atp, n.dna, n.mat][i] });
    } else if (o.part === 'part') {
      const p = sim.parts.find(q => q.id === o.id);
      if (!p) return;
      const q = this.partPos(p);
      x = q.x; y = q.y; r = Math.max(14, L.mito.r * 1.05) * 1.25;
      title = partName(p.kind); title = title.charAt(0).toUpperCase() + title.slice(1);
      sub = t('aim.part.sub'); act = t('aim.part.act');
    } else {
      const l = o.lesion!;
      x = this.rungX(sim, l.u); y = L.laneMid; r = L.amp * 0.95; up = true;
      title = lesionName(l.kind);
      title = title.charAt(0).toUpperCase() + title.slice(1);
      sub = t('aim.lesion.crew', { steps: LESIONS[l.kind].steps.map(stepName).join(' → ') });
      act = t('aim.lesion.act');
    }
    if (r > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,246,230,0.9)';
      ctx.lineWidth = Math.max(1.5, 1.6 * u);
      ctx.setLineDash([5 * u, 4 * u]);
      ctx.lineDashOffset = -this.now * 14 * u;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (k > 0.01) {
      if (o.part === 'chip') {
        const c = L.chips[o.id];
        this.aimTag(ctx, L.mode === 'wide' ? c.x : c.x + c.w / 2, L.mode === 'tall' ? c.y + c.h : c.y + c.h / 2, 8 * u, title, sub, act, k, L.mode === 'tall' ? 'down' : 'left');
      } else this.aimTag(ctx, x, y, r + 8 * u, title, sub, act, k, up ? 'up' : o.part === 'lens' && L.mode !== 'tall' ? 'left' : 'side');
    }
  }

  /** A tag beside a point (above it for the lane, under it for a phone's chip, left of a panel's bar). */
  private aimTag(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, title: string, sub: string, act: string, a: number, where: 'up' | 'side' | 'down' | 'left'): void {
    const L = this.L, u = L.u, pad = Math.round(8 * u);
    const tp = Math.max(MIN_READ, 13.5 * u), sp = Math.max(MIN_READ, 12.5 * u);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(tp, 800);
    const tw = ctx.measureText(title).width;
    ctx.font = font(sp, 600);
    const sw = sub ? ctx.measureText(sub).width : 0;
    ctx.font = font(sp, 700);
    const aw = ctx.measureText(act).width;
    const w = Math.min(L.w - 16, Math.max(tw, sw, aw) + 2 * pad);
    const lh = Math.round(sp * 1.3);
    const h = 2 * pad + Math.round(tp * 1.25) + (sub ? lh : 0) + lh;
    let bx: number, by: number;
    if (where === 'up') {
      bx = Math.max(8, Math.min(L.w - 8 - w, x - w / 2));
      by = y - gap - h;
    } else if (where === 'down') {
      bx = Math.max(8, Math.min(L.w - 8 - w, x - w / 2));
      by = y + gap;
    } else if (where === 'left') {
      bx = Math.max(8, x - gap - w);
      by = Math.max(L.top + 4, Math.min(L.h - h - 4, y - h / 2));
    } else {
      bx = x + gap;
      if (bx + w > L.w - 8) bx = x - gap - w;
      by = Math.max(L.top + 4, Math.min(L.h - h - 4, y - h / 2));
    }
    rr(ctx, bx, by, w, h, 10 * u);
    ctx.fillStyle = 'rgba(6,22,26,0.92)';
    ctx.fill();
    ctx.strokeStyle = rgba(C.gold, 0.6);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = font(fitFont(ctx, title, w - 2 * pad, tp, MIN_READ, 800), 800);
    ctx.fillStyle = C.cream;
    ctx.fillText(title, bx + pad, by + pad);
    let ty = by + pad + Math.round(tp * 1.25);
    if (sub) {
      ctx.font = font(fitFont(ctx, sub, w - 2 * pad, sp, MIN_READ, 600), 600);
      ctx.fillStyle = 'rgba(230,250,255,0.8)';
      ctx.fillText(sub, bx + pad, ty);
      ty += lh;
    }
    ctx.font = font(fitFont(ctx, act, w - 2 * pad, sp, MIN_READ, 700), 700);
    ctx.fillStyle = C.gold;
    ctx.fillText(act, bx + pad, ty);
    ctx.restore();
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
    const h = Math.min(b.h, Math.round(64 * L.u));
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,24,28,0.92)';
    rr(ctx, b.x, b.y + slide, b.w, h, 14);
    ctx.fill();
    ctx.strokeStyle = rgba(C.mint, 0.8);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    paintCellIcon(ctx, cc.niche, b.x + h * 0.5, b.y + slide + h / 2, h * 0.3);
    const tx = b.x + h, tw = b.w - h - 10;
    const px = Math.max(MIN_READ, Math.round(14 * L.u));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const title = t('cellcard.title');
    fitFont(ctx, title, tw, px + 2, MIN_READ, 800);
    ctx.fillStyle = C.mint;
    ctx.fillText(title, tx, b.y + slide + h * 0.3);
    const line2 = t('cellcard.what', { cell: cellName(cc.niche), n: cc.n });
    fitFont(ctx, line2, tw, px, MIN_READ, 600);
    ctx.fillStyle = C.cream;
    ctx.fillText(line2, tx, b.y + slide + h * 0.7);
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
    y += tp * 1.4;
    const bodyPx = short ? 15 : Math.max(16, Math.round(17 * L.u));
    ctx.font = font(bodyPx, 600);
    const body = wrapLines(ctx, t('story.text'), b.w - 2 * pad);
    ctx.fillStyle = C.cream;
    for (const line of body) {
      ctx.fillText(line, cx, y);
      y += bodyPx * 1.34;
    }
    // the three needs, drawn as the goal draws them (their icons in a row)
    const rowY = y + 10 + 14 * L.u;
    const gapX = Math.min(110 * L.u, (b.w - 2 * pad) / 3);
    for (let i = 0; i < 3; i++) {
      const ix = cx + (i - 1) * gapX;
      paintChipIcon(ctx, NEED_ICON[i], ix, rowY, 22 * L.u, this.now);
      const nm = [t('need.energy'), t('need.dna'), t('need.mat')][i];
      const px = fitFont(ctx, nm, gapX - 8, Math.max(MIN_READ, Math.round(13 * L.u)), MIN_TEXT + 1, 700);
      label(ctx, nm, ix, rowY + 22 * L.u, px, C.cream, 'center', 700);
    }
    y = rowY + 40 * L.u;
    // the root verse, 2 Corinthians 4:16
    const tapPx = Math.max(MIN_READ + 1, Math.round(15 * L.u));
    const room = b.y + b.h - pad - tapPx * 1.8 - y;
    const p = passage('2co4.16');
    const key = `${b.w}x${Math.round(room)}`;
    if (!this.storyLayout || this.storyKey !== key) {
      this.storyLayout = room > 40 ? layoutPassage(ctx, p, b.w - 2 * pad, room, { max: Math.round(16 * L.u), min: 13 }) : null;
      this.storyKey = key;
    }
    if (this.storyLayout) drawPassage(ctx, p, this.storyLayout, cx, y, { text: '#fff1c8', ref: 'rgba(255,230,180,0.8)' });
    const pulse = 0.7 + 0.3 * Math.sin(this.now * 4);
    ctx.globalAlpha = a * pulse;
    label(ctx, t(this.o.touch ? 'story.tap' : 'story.tap.keys'), cx, b.y + b.h - pad - tapPx * 0.5, tapPx, C.mint);
    ctx.globalAlpha = 1;
  }

  /** A Wiedza card is on screen (Mito waits: one message at a time). */
  get toastUp(): boolean { return !!this.cardShow; }

  /** The story card's rectangle while it is up (a tap anywhere on it begins). */
  get cardBox(): { x: number; y: number; w: number; h: number } { return this.L.card; }
}

/** The line's words for a kind and the hand the player has (a mouse clicks). */
export function nowKey(kind: NowKind, touch: boolean): Key {
  if (!touch && (kind === 'dna' || kind === 'check')) return `now.${kind}.mouse` as Key;
  return `now.${kind}` as Key;
}
