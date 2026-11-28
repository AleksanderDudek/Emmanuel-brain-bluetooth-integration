/**
 * Warstwy światła's view: the night, the Light above, the egg of seven layers with the figure in it (paint.ts), the
 * living light on each layer, the clinging things and their threads of light, the wounds closing, the words band with
 * the breath guide (kit/breathguide.ts) and the seven layers' dots.
 *
 * A frame blits the baked night and one composite of the layers (two while a layer closes: the dull one fades into the
 * clear one), then draws only what lives: ~50 small glow sprites, one dashed contour, the threads, the things.  The
 * next composite is baked in the background a layer a frame (paint.ts EggBaker), so a layer's closing never stalls.
 * Reduced motion: the light stays still (no drift, no wobble, no beads running); things still rise — the rise is the
 * progress — and wounds still close as fades.
 */
import { breathAt, type BreathState } from '../kit/breath';
import { breathGuideBox, breathGuideRadius, breathOf, drawBreathGuide, type BreathGuideOpts } from '../kit/breathguide';
import { approach, clamp, ease } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { passage, type PassageId } from '../kit/scripture';
import type { Insets, TapTarget } from '../kit/types';
import { LAYERS } from './content';
import { EGGS, bandPt, type Pt } from './egg';
import { t, type Key } from './i18n';
import { figPt, layout, type Layout } from './layout';
import { EggBaker, GOLD, WEB_PATH, bakeSky, crackLine, drawLight, drawThing, eggPath, font, fontPx, glow, hash, mapper, rgba, rr, wrap, type Layer } from './paint';
import { RULES } from './rules';
import type { Hook, LayerRun, SimEvent, WarstwySim } from './sim';
import { figurePath } from '../kit/figure';

const TAU = Math.PI * 2;

/** What the picture shows, from the session or from the lobby's preview. */
export interface SceneState {
  /** seconds, for the living light */
  time: number;
  /** each layer's state and glow; the layer open now (−1: none) */
  layers: readonly Pick<LayerRun, 'state' | 'healAt' | 'glow' | 'hooks'>[];
  open: number;
  /** the session's clock (for wounds and closings) */
  now: number;
  /** how bright the threads are (the light the focus gives, 0..1), and whether a thing is being drawn now */
  light: number;
  drawing: boolean;
  /** the push's lead-in or a rest: the thread of a half-drawn thing is dim */
  dim: boolean;
  /** 0..1: the whole in the light (the finale's radiance) */
  finale: number;
  /** the Light above flares (a thing arrived), 0..1 */
  flare: number;
  reduced: boolean;
}

interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string }
interface BodyLine { text: string; font: string; color: string; h: number }

const HOOK_PX = (L: Layout, size: number): number => Math.max(13, size * L.fig.H);

/** A thing's spot on the screen. */
const spotOf = (L: Layout, h: Pick<Hook, 'x' | 'y'>): { x: number; y: number } => figPt(L, h.x, h.y);

/** The thread from a spot up to the Light above: a gentle arc (quadratic), its point at u (0 the spot, 1 the Light). */
function threadAt(L: Layout, sx: number, sy: number, u: number, sway: number): { x: number; y: number } {
  const ex = L.light.x, ey = L.light.y + L.light.r * 0.4;
  const cx = sx * 0.55 + ex * 0.45 + sway, cy = sy * 0.3 + ey * 0.7;
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return { x: a * sx + b * cx + c * ex, y: a * sy + b * cy + c * ey };
}

/** The bit mask of layers closing or clear, and of the clear ones only. */
export function masks(layers: SceneState['layers']): { all: number; clear: number; healing: number[] } {
  let all = 0, clear = 0;
  const healing: number[] = [];
  layers.forEach((L, k) => {
    if (L.state === 'healing' || L.state === 'clear') all |= 1 << k;
    if (L.state === 'clear') clear |= 1 << k;
    if (L.state === 'healing') healing.push(k);
  });
  return { all, clear, healing };
}

/** The picture without the words: the night, the Light, the egg, the living light, the things and their threads. */
export class Scene {
  L: Layout;
  private sky: Layer | null = null;
  private baker: EggBaker | null = null;
  private rims: Path2D[] = [];
  private sil: Path2D | null = null;
  private scan: Path2D | null = null;
  private readonly sparks: Spark[] = [];

  constructor(L: Layout) { this.L = L; }

  resize(L: Layout, dpr: number): void {
    this.L = L;
    this.sky = bakeSky(L, dpr);
    this.baker = new EggBaker(L, dpr);
    this.rims = EGGS.map(e => eggPath(L, e));
    this.sil = typeof Path2D === 'undefined' ? null : figurePath(mapper(L));
    const mid = { a: (EGGS[3].a + EGGS[4].a) / 2, b: (EGGS[3].b + EGGS[4].b) / 2 };
    this.scan = eggPath(L, mid);
  }

  /** A release: a soft burst of light where the thing arrived. */
  burst(x: number, y: number, n: number, color: string, reduced: boolean): void {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + hash(i + x) * 0.5;
      const v = 14 + 26 * hash(i * 3 + y);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 + 6, t: 0, life: 0.9 + 0.6 * hash(i), color });
    }
    if (this.sparks.length > 140) this.sparks.splice(0, this.sparks.length - 140);
  }

  update(dt: number): void {
    for (const s of this.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.exp(-dt * 0.8);
      s.vy *= Math.exp(-dt * 0.8);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) if (this.sparks[i].t >= this.sparks[i].life) this.sparks.splice(i, 1);
  }

  /** Ask the baker for what comes next (the open layer cleared), a step of its work a frame. */
  prepare(s: SceneState): void {
    const b = this.baker;
    if (!b) return;
    const m = masks(s.layers);
    const next = s.open >= 0 && s.open < 7 ? m.all | (1 << s.open) : m.all;
    b.keep([m.clear, m.all, next]);
    b.want(m.all);
    b.want(next);
    b.step();
  }

  draw(ctx: CanvasRenderingContext2D, s: SceneState): void {
    const L = this.L, H = L.fig.H;
    const time = s.reduced ? 0 : s.time;
    if (this.sky) ctx.drawImage(this.sky, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#0b0e2a';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    // the egg: the composite of the cleared layers; a closing layer fades from dull to clear
    const m = masks(s.layers);
    const box = L.egg;
    const base = this.baker?.get(m.healing.length ? m.clear : m.all) ?? null;
    if (base) ctx.drawImage(base, box.x, box.y, box.w, box.h);
    if (m.healing.length && this.baker) {
      const k = Math.min(...m.healing.map(i => clamp((s.now - s.layers[i].healAt) / RULES.healSec)));
      const top = this.baker.get(m.all);
      if (top && k > 0) {
        ctx.globalAlpha = ease.inOutSine(k);
        ctx.drawImage(top, box.x, box.y, box.w, box.h);
        ctx.globalAlpha = 1;
      }
    }
    // the layers' own light: cleared rims glow with calm, the open one pulses
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    s.layers.forEach((Ly, k) => {
      const clear = Ly.state === 'healing' || Ly.state === 'clear';
      if (!clear || k === 0) return;
      const a = (0.06 + 0.2 * Ly.glow) * (1 + 0.6 * s.finale);
      ctx.strokeStyle = rgba(LAYERS[k].hue, a);
      ctx.lineWidth = Math.max(2, H * 0.012);
      ctx.stroke(this.rims[k]);
    });
    if (s.open >= 0 && s.open < 7 && s.layers[s.open].state === 'open') {
      const k = s.open, hue = LAYERS[k].hue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.3);
      if (k === 0 && this.sil) {
        ctx.strokeStyle = rgba(hue, 0.1 + 0.08 * pulse);
        ctx.lineWidth = H * 0.06;
        ctx.stroke(this.sil);
      } else if (k > 0) {
        ctx.strokeStyle = rgba(hue, 0.08 + 0.06 * pulse);
        ctx.lineWidth = Math.max(5, H * 0.03);
        ctx.stroke(this.rims[k]);
        ctx.strokeStyle = rgba(hue, 0.4 + 0.25 * pulse);
        ctx.lineWidth = Math.max(1.2, H * 0.005);
        ctx.stroke(this.rims[k]);
      }
    }
    ctx.restore();
    this.living(ctx, s, time);
    // a layer closing: a ring of its light opens out from its rim
    for (const k of m.healing) {
      const q = clamp((s.now - s.layers[k].healAt) / RULES.healSec);
      if (k === 0 || q >= 1) continue;
      const cx = L.fig.cx, cy = L.fig.top + 0.5 * H, sc = 1 + 0.05 * ease.outCubic(q);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -cy);
      ctx.strokeStyle = rgba(LAYERS[k].hue, 0.6 * (1 - q));
      ctx.lineWidth = Math.max(1.5, H * 0.008);
      ctx.stroke(this.rims[k]);
      ctx.restore();
    }
    // the Light above, brighter as things arrive and at the end
    drawLight(ctx, L, time, 0.6 + 0.6 * s.flare + 0.5 * s.finale, s.reduced);
    if (s.finale > 0) {
      const cx = L.fig.cx, cy = L.fig.top + 0.48 * H;
      glow(ctx, '#fff4dc', cx, cy, H * (0.75 + 0.03 * Math.sin(time * 0.8)), 0.16 * s.finale);
      glow(ctx, '#ffe6b0', cx, cy - 0.1 * H, H * 0.42, 0.18 * s.finale);
    }
    this.things(ctx, s, time);
    for (const sp of this.sparks) glow(ctx, sp.color, sp.x, sp.y, Math.max(2, H * 0.012), 0.8 * clamp(1 - sp.t / sp.life));
  }

  /** The living light of each layer: glints on the web, drifting glows, the blueprint's scan, opal glints, gold twinkles. */
  private living(ctx: CanvasRenderingContext2D, s: SceneState, time: number): void {
    const L = this.L, H = L.fig.H;
    const at = (p: Pt) => figPt(L, p[0], p[1]);
    const clearOf = (k: number) => (s.layers[k].state === 'clear' || s.layers[k].state === 'healing' ? 1 : 0);
    const lift = 1 + 0.5 * s.finale;
    // 0: glints running along the body's web
    {
      const c = clearOf(0), n = 8, len = WEB_PATH.length;
      for (let j = 0; j < n; j++) {
        const u = ((time * 0.018 + j / n) % 1 + 1) % 1;
        const f = u * len, i = Math.floor(f) % len, i2 = (i + 1) % len, r = f - Math.floor(f);
        const p = at([WEB_PATH[i][0] + (WEB_PATH[i2][0] - WEB_PATH[i][0]) * r, WEB_PATH[i][1] + (WEB_PATH[i2][1] - WEB_PATH[i][1]) * r]);
        glow(ctx, c ? '#cfeeff' : '#7f8ea4', p.x, p.y, H * 0.018, (c ? 0.55 : 0.18) * lift);
      }
    }
    // 1–3, 5: glows drifting slowly in their bands
    const drift = (k: number, n: number, col: (j: number) => string, r: number, a: number, w: number): void => {
      const c = clearOf(k);
      for (let j = 0; j < n; j++) {
        const th = (j / n) * TAU + time * w * (j % 2 ? 1 : -0.7) + hash(k * 13 + j) * 0.8;
        const d = 0.5 + 0.32 * Math.sin(time * 0.21 + j * 1.7);
        const p = at(bandPt(k, th, d));
        glow(ctx, col(j), p.x, p.y, H * r * (0.8 + 0.4 * hash(k + j * 3)), a * (c ? 1 : 0.3) * lift);
      }
    };
    const pal = ['#ff9ec7', '#b79cff', '#7fd6c8', '#ffc27a', '#8fc4ff', '#ff8fa0'];
    drift(1, 7, j => pal[j % pal.length], 0.07, 0.22, 0.025);
    drift(2, 6, () => '#fff1a0', 0.06, 0.2, 0.018);
    drift(3, 6, j => (j % 2 ? '#ffa9c8' : '#ff7aa8'), 0.06, 0.22, 0.02);
    const opal = ['#ffd6e6', '#fff0c8', '#d6ffe6', '#cfeaff', '#e6d8ff'];
    drift(5, 10, j => opal[(j + Math.floor(time * 0.3)) % opal.length], 0.03, 0.4, 0.03);
    // 4: the blueprint's scan running along a contour
    if (this.scan) {
      const c = clearOf(4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.setLineDash([H * 0.05, H * 0.22]);
      ctx.lineDashOffset = -time * H * 0.05;
      ctx.strokeStyle = rgba('#cfe0ff', (c ? 0.5 : 0.12) * lift);
      ctx.lineWidth = Math.max(1, H * 0.005);
      ctx.stroke(this.scan);
      ctx.restore();
    }
    // 6: gold twinkles on the lattice's nodes
    {
      const c = clearOf(6), n = 14;
      for (let j = 0; j < n; j++) {
        const th = hash(600 + j * 7.3) * TAU;
        const tw = Math.max(0, Math.sin(time * (0.7 + 0.5 * hash(j)) + j * 2.1)) ** 4;
        const p = at(bandPt(6, th, j % 2 ? 0 : 0.98));
        glow(ctx, '#fff3cf', p.x, p.y, H * 0.03, (c ? 0.15 + 0.7 * tw : 0.05 + 0.12 * tw) * lift);
      }
    }
  }

  /** The things: clinging (with their cracks), loosening, rising on their threads; and the wounds they leave, closing. */
  private things(ctx: CanvasRenderingContext2D, s: SceneState, time: number): void {
    const L = this.L, H = L.fig.H;
    s.layers.forEach((Ly, k) => {
      const spec = LAYERS[k];
      for (const h of Ly.hooks) {
        const sp = spotOf(L, h);
        const px = HOOK_PX(L, h.size);
        if (h.state === 'gone') {
          const q = clamp((s.now - h.goneAt) / RULES.woundSec);
          if (q >= 1) continue;
          if (spec.thing === 'crack') {
            crackLine(ctx, h.seed, sp.x, sp.y, px, h.rot, q, 1 - clamp((q - 0.6) / 0.4));
            glow(ctx, GOLD, sp.x, sp.y, px * (0.6 + 0.6 * q), 0.5 * (1 - q));
          } else {
            // a small wound where it was, closing; a ring of the layer's light
            ctx.save();
            ctx.globalAlpha = 0.6 * (1 - q);
            ctx.fillStyle = '#120e1e';
            ctx.beginPath();
            ctx.ellipse(sp.x, sp.y, px * 0.28 * (1 - q), px * 0.1 * (1 - q) + 0.5, h.rot, 0, TAU);
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = rgba(spec.hue, 0.7 * (1 - q));
            ctx.lineWidth = Math.max(1, px * 0.06);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, px * (0.2 + 0.45 * ease.outCubic(q)), 0, TAU);
            ctx.stroke();
            ctx.restore();
            glow(ctx, spec.hue, sp.x, sp.y, px * 0.8, 0.45 * (1 - q));
          }
          continue;
        }
        const waiting = s.layers[k].state === 'wait';
        const p = h.p;
        const loose = clamp(p / RULES.loosen);
        const u = clamp((p - RULES.loosen) / (1 - RULES.loosen));
        if (spec.thing === 'crack') crackLine(ctx, h.seed, sp.x, sp.y, px, h.rot, 0, waiting ? 0.55 : 1);
        // its thread, while it is being drawn or waits half-drawn, or the Light takes it
        const active = k === s.open && Ly.state === 'open' && Ly.hooks.find(x => x.state !== 'gone' && !x.grace) === h;
        const sway = s.reduced ? 0 : Math.sin(time * 0.5 + h.seed) * H * 0.03;
        if (h.grace || (active && (s.drawing || p > 0))) {
          const bright = h.grace ? 0.75 : s.dim ? 0.18 : 0.25 + 0.6 * clamp(s.light);
          this.thread(ctx, sp.x, sp.y, bright, sway, h.grace ? '#fff6e0' : spec.hue, time, s.reduced, u);
        }
        let x = sp.x, y = sp.y, sc = 1, rot = h.rot, lit = 0.15 * loose, alpha = waiting ? 0.7 : 1;
        if (u > 0) {
          const e = ease.inOutSine(u);
          const q = threadAt(L, sp.x, sp.y, e, sway);
          x = q.x;
          y = q.y;
          // it keeps its shape as it rises, turning to light only near the top, a halo behind it so it reads on any layer
          sc = 1 - 0.4 * e;
          lit = 0.12 + 0.88 * e * e;
          rot = h.rot * (1 - e);
          alpha = u > 0.85 ? clamp(1 - (u - 0.85) / 0.15) : 1;
          glow(ctx, '#fff6e0', x, y, px * (1 + 0.6 * e), 0.35 + 0.45 * e);
        } else if (loose > 0 && !s.reduced) {
          // loosening: it trembles a little in place, a halo of light around it
          const wob = Math.sin(time * 9 + h.seed) * px * 0.05 * loose;
          x += wob * Math.cos(h.rot);
          y += wob * Math.sin(h.rot);
        }
        if (loose > 0 && u <= 0) glow(ctx, spec.hue, sp.x, sp.y, px * (0.7 + 0.4 * loose), 0.15 + 0.3 * loose);
        if (active && !h.grace && u <= 0 && s.drawing) glow(ctx, spec.hue, sp.x, sp.y, px * 0.9, 0.12 + 0.2 * clamp(s.light));
        drawThing(ctx, spec.thing, h.variant, h.seed, x, y, px * sc, rot, lit, alpha, spec.hue);
      }
    });
  }

  /** A thread of light from a spot up to the Light above, with beads of light running up it. */
  private thread(ctx: CanvasRenderingContext2D, sx: number, sy: number, bright: number, sway: number, hue: string, time: number, reduced: boolean, from: number): void {
    const L = this.L, H = L.fig.H;
    const ex = L.light.x, ey = L.light.y + L.light.r * 0.4;
    const cx = sx * 0.55 + ex * 0.45 + sway, cy = sy * 0.3 + ey * 0.7;
    // a thing already rising: the thread runs from where it is now
    const u0 = from > 0 ? ease.inOutSine(from) : 0;
    const p0 = threadAt(L, sx, sy, u0, sway);
    // the part of the curve from u0 to 1 (de Casteljau split)
    const c1x = (1 - u0) * cx + u0 * ex, c1y = (1 - u0) * cy + u0 * ey;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(c1x, c1y, ex, ey);
    ctx.strokeStyle = rgba(hue, 0.08 * bright);
    ctx.lineWidth = Math.max(9, H * 0.045);
    ctx.stroke();
    ctx.strokeStyle = rgba(hue, 0.2 * bright);
    ctx.lineWidth = Math.max(4, H * 0.016);
    ctx.stroke();
    ctx.strokeStyle = rgba('#fffaf0', 0.8 * bright);
    ctx.lineWidth = Math.max(1.6, H * 0.0055);
    ctx.stroke();
    ctx.restore();
    // beads of light running up
    const n = 3;
    for (let i = 0; i < n; i++) {
      const v = reduced ? (i + 0.5) / n : ((time * 0.22 + i / n) % 1);
      const uu = u0 + (1 - u0) * v;
      const q = threadAt(L, sx, sy, uu, sway);
      glow(ctx, '#ffffff', q.x, q.y, Math.max(4, H * 0.02), 0.7 * bright * Math.sin(Math.PI * v));
    }
  }

  /** Where a thing clings on the screen (for a burst, a coach mark). */
  posOf(h: Pick<Hook, 'x' | 'y'>): { x: number; y: number } {
    return spotOf(this.L, h);
  }
}

/** The session's picture and the words band. */
export class WarstwyView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly scene: Scene;
  private dpr = 1;
  private time = 0;
  private flare = 0;
  private finale = 0;
  private bodyCache: { key: string; pages: BodyLine[][] } | null = null;
  private pageT = 0;
  private pageIdx = 0;
  private bandEnd = 0;
  private bandH = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, undefined, opts.touch);
    this.scene = new Scene(this.L);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.opts.touch);
    this.scene.resize(this.L, dpr);
    this.bodyCache = null;
    this.bandEnd = 0;
    this.bandH = 0;
  }

  on(e: SimEvent, sim: WarstwySim): void {
    if (e.type === 'drawn') {
      this.flare = 1;
      const L = this.L;
      this.scene.burst(L.light.x, L.light.y + L.light.r * 0.4, e.grace ? 8 : 14, e.grace ? '#fff6e0' : LAYERS[e.k].hue, this.opts.reducedMotion);
    } else if (e.type === 'healed') {
      for (const h of sim.layers[e.k].hooks.slice(0, 3)) {
        const p = this.scene.posOf(h);
        this.scene.burst(p.x, p.y, 6, LAYERS[e.k].hue, this.opts.reducedMotion);
      }
      this.flare = Math.max(this.flare, 0.6);
    }
  }

  update(dt: number, sim: WarstwySim): void {
    this.time += dt;
    this.flare = approach(this.flare, 0, dt, 0.8);
    this.finale = approach(this.finale, sim.stage === 'whole' || sim.stage === 'close' ? 1 : 0, dt, 2.5);
    this.scene.update(dt);
    this.pageT += dt;
  }

  /** The scene's state from the session. */
  private state(sim: WarstwySim): SceneState {
    const L = sim.layer;
    return {
      time: this.time, layers: sim.layers, open: sim.stage === 'layers' ? sim.k : -1, now: sim.t,
      light: sim.light, drawing: sim.pushBlock && !!L, dim: !sim.sighted, finale: this.finale, flare: this.flare, reduced: this.opts.reducedMotion,
    };
  }

  draw(sim: WarstwySim, intro = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const s = this.state(sim);
    this.scene.prepare(s);
    this.scene.draw(ctx, s);
    if (!intro) this.drawBand(ctx, sim);
  }

  targets(): TapTarget[] { return []; }

  /** Where a coach mark points: the thing being drawn now ('draw'), the breath guide in the band ('rest'). */
  coachAt(what: string, sim: WarstwySim): { x: number; y: number } | null {
    if (what === 'draw') {
      const h = sim.active();
      if (!h) return null;
      const p = this.scene.posOf(h);
      return { x: p.x, y: p.y - 0.03 * this.L.fig.H };
    }
    if (what === 'rest') {
      const B = this.L.band;
      return { x: B.x + B.w / 2, y: B.y + 8 * this.L.u };
    }
    return null;
  }

  // ── the words band ──────────────────────────────────────────────

  /** Row 1: the layer's number and plain name, and the tradition's name after it; or the stage. */
  private label(sim: WarstwySim): { main: string; trad: string } {
    if (sim.stage === 'layers' && sim.k < 7) {
      const id = sim.layers[sim.k].id;
      return { main: t('label', { i: sim.k + 1, name: t(`layer.${id}` as Key) }), trad: t(`trad.${id}` as Key) };
    }
    return { main: t(sim.stage === 'arrive' ? 'stage.arrive' : sim.stage === 'whole' ? 'stage.whole' : 'stage.close'), trad: '' };
  }

  /** Row 2: what to do now (it changes with the block only). */
  private nowLine(sim: WarstwySim): string {
    switch (sim.stage) {
      case 'arrive': return t('now.arrive');
      case 'whole': return t('now.whole');
      case 'close': return t('now.close');
      default: break;
    }
    if (sim.restBlock) return t(sim.graceOn ? 'now.grace' : 'now.rest');
    if (sim.allOut) return t('now.heal');
    if (sim.blockT < sim.lead) return t('now.lead');
    return t(sim.graceOn ? 'now.grace' : 'now.draw');
  }

  /** The band's body: the push's picture in words, the thanks, the prayer, the own line, the passage. */
  private bodyLines(ctx: CanvasRenderingContext2D, sim: WarstwySim, w: number, h: number): BodyLine[][] {
    const L = this.L;
    const goal = sim.goal, thanks = sim.thanks, prayer = sim.prayer, own = sim.own;
    const verse: PassageId | null = sim.restBlock || sim.stage === 'whole' || sim.stage === 'close' || sim.stage === 'arrive' ? sim.card : null;
    const key = `${goal}|${thanks}|${prayer}|${own}|${verse}|${w}|${h}`;
    if (this.bodyCache?.key === key) return this.bodyCache.pages;
    const lines: BodyLine[] = [];
    // a tight band (the smallest phone in a rest, its breath guide in it) sets the prayer a size smaller: more of it
    // stands together on a page
    const pr = h < 4.2 * L.font.prayer ? Math.max(MIN_READ + 1, L.font.now) : L.font.prayer;
    const add = (text: string, f: string, color: string, size: number, lead = 1.3) => {
      ctx.font = f;
      for (const ln of wrap(ctx, text, w)) lines.push({ text: ln, font: f, color, h: Math.round(size * lead) });
    };
    if (goal) add(goal, font(L.font.now, 600), '#d8e6ff', L.font.now);
    if (thanks) add(thanks, font(pr, 600, true), '#ffe9b8', pr, 1.28);
    if (prayer) add(prayer, font(pr, 600, true), '#fff4dc', pr, 1.28);
    if (own) add(`${t('own.label')} „${own}”`, font(pr, 500, true, true), '#ffd6e6', pr);
    if (verse) {
      const p = passage(verse);
      const vs = Math.max(MIN_READ, L.font.verse);
      if (lines.length) lines.push({ text: '', font: font(vs), color: '', h: Math.round(vs * 0.45) });
      add(p.text, font(vs, 400, true, true), '#e2e4ff', vs, 1.32);
      const rs = Math.max(11, Math.round(vs * 0.74));
      lines.push({ text: `${p.ref} · ${p.bible}`, font: font(rs, 600), color: '#a6a8d8', h: Math.round(rs * 1.5) });
    }
    const pages: BodyLine[][] = [];
    let cur: BodyLine[] = [], used = 0;
    for (const ln of lines) {
      if (cur.length && used + ln.h > h) {
        pages.push(cur);
        cur = [];
        used = 0;
        if (!ln.text) continue;
      }
      cur.push(ln);
      used += ln.h;
    }
    if (cur.length) pages.push(cur);
    this.bodyCache = { key, pages };
    this.pageT = 0.4;
    this.pageIdx = 0;
    return pages;
  }

  private drawBand(ctx: CanvasRenderingContext2D, sim: WarstwySim): void {
    const L = this.L, B = L.band, u = L.u, pad = L.pad;
    ctx.save();
    const fitH = L.shape === 'tall' || !this.bandEnd ? B.h : Math.min(B.h, this.bandEnd - B.y);
    this.bandH = this.bandH && L.shape !== 'tall' ? this.bandH + (fitH - this.bandH) * 0.2 : fitH;
    const cardH = Math.min(B.h, this.bandH);
    ctx.fillStyle = 'rgba(8,10,34,.82)';
    rr(ctx, B.x, B.y, B.w, cardH, 14 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,196,255,.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const x = B.x + pad, w = B.w - 2 * pad;
    let y = B.y + pad;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const br: BreathState | null = sim.restBlock ? breathAt(sim.breathPattern, sim.blockT) : null;
    const tallRest = !!br && L.shape === 'tall';
    if (!tallRest) {
      // row 1: the layer (its plain name, the tradition's after it) and the seven dots at the right
      const dotsW = this.dots(ctx, sim, x + w, y + L.font.label * 0.55);
      const lab = this.label(sim);
      const room = w - dotsW - 10 * u;
      ctx.font = font(L.font.label, 700);
      ctx.fillStyle = GOLD;
      const mainW = ctx.measureText(lab.main).width;
      ctx.fillText(lab.main, x, y);
      if (lab.trad) {
        ctx.font = font(L.font.label, 500, false, true);
        const tr = ` — ${lab.trad}`;
        if (mainW + ctx.measureText(tr).width <= room) {
          ctx.fillStyle = '#b8b4e8';
          ctx.fillText(tr, x + mainW, y);
        }
      }
      y += Math.round(L.font.label * 1.45);
    }
    if (br) {
      y += this.drawGuide(ctx, sim, br, B.x + B.w / 2, y, w) + 6 * u;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
    }
    // row 2: the narrator while it speaks, else what to do now
    const line = sim.talk.line;
    const glowIn = sim.t < sim.reshowUntil;
    const row2 = (text: string, weight: number, italic: boolean): number => {
      const size = this.fitLine(ctx, text, w, L.font.now, weight, italic, italic);
      ctx.font = font(size, weight, italic, italic);
      const lines = ctx.measureText(text).width > w ? wrap(ctx, text, w).slice(0, 2) : [text];
      lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * Math.round(size * 1.3)));
      return lines.length;
    };
    let rows = 1;
    if (line) {
      ctx.globalAlpha = clamp(line.t / 0.3) * clamp((line.dur - line.t) / 0.4);
      ctx.fillStyle = '#ffffff';
      rows = row2(line.text, 500, true);
      ctx.globalAlpha = 1;
    } else if (!tallRest) {
      ctx.fillStyle = glowIn ? '#ffffff' : '#e8eaff';
      rows = row2(this.nowLine(sim), 700, false);
    } else rows = 0;
    if (rows) y += Math.round(L.font.now * (1.55 + 1.3 * (rows - 1)));
    // the body, in pages of whole lines that turn slowly when they do not fit
    const bodyH = B.y + B.h - pad - y;
    if (bodyH > 12) {
      const pages = this.bodyLines(ctx, sim, w, bodyH);
      if (pages.length) {
        const chars = pages[this.pageIdx % pages.length].reduce((s, l) => s + l.text.length, 0);
        if (pages.length > 1 && this.pageT > Math.max(5, 2 + chars * 0.055)) {
          this.pageIdx = (this.pageIdx + 1) % pages.length;
          this.pageT = this.pageT > 30 ? 1 : 0;
        }
        const page = pages[this.pageIdx % pages.length];
        const tallest = Math.max(...pages.map(pg => pg.reduce((sum, l) => sum + l.h, 0)));
        this.bandEnd = y + tallest + pad + (pages.length > 1 ? 10 * u : 0);
        ctx.globalAlpha = (pages.length > 1 ? clamp(this.pageT / 0.4) : 1) * (glowIn ? 1 : 0.97);
        for (const ln of page) {
          if (ln.text) {
            ctx.font = ln.font;
            ctx.fillStyle = ln.color;
            ctx.fillText(ln.text, x, y);
          }
          y += ln.h;
        }
        ctx.globalAlpha = 1;
        if (pages.length > 1) {
          for (let i = 0; i < pages.length; i++) {
            ctx.fillStyle = i === this.pageIdx % pages.length ? GOLD : 'rgba(210,206,255,.35)';
            ctx.beginPath();
            ctx.arc(B.x + B.w - pad - (pages.length - 1 - i) * 9 * u, B.y + cardH - 7 * u, 2.4 * u, 0, TAU);
            ctx.fill();
          }
        }
      } else this.bandEnd = y + pad;
    }
    ctx.restore();
  }

  /** The seven layers as dots, right-aligned at (right, cy): clear filled, open ringed and pulsing, waiting dim. */
  private dots(ctx: CanvasRenderingContext2D, sim: WarstwySim, right: number, cy: number): number {
    const u = this.L.u, r = 3.6 * u, gap = 10 * u;
    const n = 7, w = (n - 1) * gap + 2 * r;
    const x0 = right - w + r;
    for (let k = 0; k < n; k++) {
      const Ly = sim.layers[k], hue = LAYERS[k].hue, x = x0 + k * gap;
      const clear = Ly.state === 'healing' || Ly.state === 'clear';
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, TAU);
      if (clear) {
        ctx.fillStyle = hue;
        ctx.fill();
      } else if (Ly.state === 'open' || Ly.state === 'grace') {
        ctx.fillStyle = rgba(hue, 0.35 + 0.25 * Math.sin(this.time * 2.4));
        ctx.fill();
        ctx.strokeStyle = hue;
        ctx.lineWidth = 1.4 * u;
        ctx.stroke();
      } else {
        ctx.strokeStyle = rgba(hue, 0.4);
        ctx.lineWidth = 1 * u;
        ctx.stroke();
      }
    }
    return w;
  }

  /** The breath guide in the band (kit/breathguide.ts): a row — the ring, the phase in a word, "oddech 2 z 3". */
  private drawGuide(ctx: CanvasRenderingContext2D, sim: WarstwySim, br: BreathState, cx: number, top: number, w: number): number {
    const L = this.L;
    const r = Math.max(26, Math.min(breathGuideRadius(L.w, L.h), Math.round(w * 0.16)));
    const pad = Math.max(10, Math.round(r * 0.3));
    const of = sim.breaths;
    const o: BreathGuideOpts = {
      cx, cy: 0, r, layout: 'row', sub: of > 1 ? breathOf(Math.min(of, br.n + 1), of) : undefined,
      maxW: Math.max(80, w - (2 * r + 2.9 * pad)), reducedMotion: this.opts.reducedMotion, time: this.time, scrim: 0.45,
    };
    const h = breathGuideBox(ctx, o).h;
    drawBreathGuide(ctx, br, { ...o, cy: top + h / 2 });
    return h;
  }

  /** A one-line text's size: from `px` down to 13 px. */
  private fitLine(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, weight: number, serif = false, italic = false): number {
    let size = fontPx(px);
    ctx.font = font(size, weight, serif, italic);
    while (size > MIN_READ && ctx.measureText(text).width > w) {
      size = Math.max(MIN_READ, size - 0.5);
      ctx.font = font(size, weight, serif, italic);
    }
    return size;
  }
}

