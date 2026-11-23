/**
 * Z głowy do serca's picture (DESIGN.md §18): a night of deep blue over the curve of the Earth, the figure of light
 * (kit/figure.ts) standing on its limb.  A light at the brow — where the band sits — among restless sparks (thoughts);
 * it moves down the midline only while focus is held, leaving a soft trail and small lights at the eyes, the mouth,
 * the throat, while the sparks slow and settle like snow.  In the heart a flame kindles inside a warm sphere (gold →
 * rose; it beats with the real pulse when Mendi gives one, else breathes with the breath), its glow fills the figure
 * from the heart outward and closes round it.  The camera eases out: five rings wait as ghosts — a house at dusk
 * (family), lamps in pairs and threes (friends), a town at night (the people I meet), grey thorns with cold stones
 * that blossom and become lamps (those who hurt me), and the Earth at night whose cities kindle continent by continent
 * (the world; in long sessions five named arcs round it).  One sun rises over all of them and lights every ring
 * equally; the four dimensions open; the light gathers back into the heart.  Reduced motion: no swarm, no camera
 * ease — cuts and fades.
 */
import { PLACE, alongPath, type P } from '../kit/figure';
import { Particles, clamp, ease } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { ARCS, DIMS, PLACES, RING_LOOK, arcName, dimName, ringName, ringStage, stageRing, type Ring } from './content';
import { cityOrder, earth, EARTH_FAR } from './earth';
import { drawCaption, drawCard, drawGuideBand, drawNow, drawStory, guideH, guideR } from './hud';
import { EARTH, HEART_Y, cameraFor, easeCam, layout, storyTarget, toScreen, type Camera, type Framing, type Layout } from './layout';
import { namesOf } from './meta';
import {
  EMBER, GOLD, GOLD_HI, ROSE, bakeFigure, bakeSky, figureWorldPath, font, glow, hash, mix, rgbaPrefix, rr, type FigureLayer, type Layer,
} from './paint';
import { RULES } from './rules';
import type { SerceSim, SimEvent, Words } from './sim';

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

interface Spark { x: number; y: number; vx: number; vy: number; a: number; s: number }
interface Ripple { x: number; y: number; t: number }

const TAU = Math.PI * 2;
const R: readonly number[] = RULES.ringR;
/** The midline of the descent, world units (the heart at the origin). */
const DESCENT: readonly P[] = PLACES.map(p => [0, PLACE[p][1] - HEART_Y] as P);
/** The head's centre (the sparks circle it). */
const HEAD: P = [0, 0.075 - HEART_Y];

/** A lamp's place in world units, and for the house its window. */
interface Lamp { x: number; y: number; a: number }

export class SerceView {
  L: Layout;
  cam: Camera = { x: 0, y: 0, s: 100 };
  private framing: Framing = 'body';
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private sky: Layer | null = null;
  private fig: FigureLayer | null = null;
  private readonly sparks: Spark[] = [];
  private readonly parts = new Particles(220);
  private ripples: Ripple[] = [];
  private time = 0;
  private fade = 0;
  /** a cut's fade (reduced motion): 1 → 0 */
  private cutK = 0;
  private wordsKey = '';
  private wordsFade = 1;
  private beatPh = 0;
  private flashes: { x: number; y: number; t: number; c: string; r: number }[] = [];
  private lampMemo = new Map<string, Lamp[]>();
  private storyRect: { x: number; y: number; w: number; h: number } | null = null;
  /** Mendi's pulse this frame (null: none — never a made-up one) */
  pulse: number | null = null;
  private words: Words | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, { top: 0, right: 0, bottom: 0, left: 0 }, o.touch);
    this.base = this.L;
    for (let i = 0; i < 26; i++) {
      const a = hash(i * 5 + 1) * TAU, rr0 = 0.075 + 0.07 * hash(i * 5 + 2);
      this.sparks.push({ x: HEAD[0] + Math.cos(a) * rr0, y: HEAD[1] + Math.sin(a) * rr0 * 1.15, vx: 0, vy: 0, a: 0.5 + 0.5 * hash(i * 5 + 3), s: 0.6 + hash(i * 5 + 4) });
    }
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.base = layout(w, h, ins, this.o.touch);
    this.L = this.introMode ? this.introLayout() : this.base;
    this.sky = bakeSky(w, h, dpr);
    this.fig = null;
    this.cam = cameraFor(this.L, this.introMode ? 'figure' : this.framing);
  }

  /** The layout the game plays in (without the intro's full-canvas picture). */
  private base: Layout;
  private introMode = false;
  /**
   * How far the rest's guide band is open on a phone held upright (0..1): the picture gives it its height over the
   * card while a rest lasts (the camera eases to the smaller picture), and takes it back after.
   */
  private guideK = 0;

  /** The play layout with the guide's band open by k (a phone held upright; elsewhere the guide is in the card). */
  private restLayout(k: number): Layout {
    const b = this.base;
    if (b.kind !== 'tall' || k <= 0) return b;
    const gh = Math.round((guideH(guideR(b)) + 6) * k);
    return { ...b, pic: { ...b.pic, h: Math.max(60, b.pic.h - gh) } };
  }
  /** The calibration's intro: the scene alone, the figure centred in the whole canvas. */
  setIntro(on: boolean): void {
    if (on === this.introMode) return;
    this.introMode = on;
    this.L = on ? this.introLayout() : this.base;
    this.cam = cameraFor(this.L, on ? 'figure' : this.framing);
  }
  private introLayout(): Layout {
    const b = this.base, i = b.ins;
    return { ...b, pic: { x: i.left, y: i.top, w: b.w - i.left - i.right, h: b.h - i.top - i.bottom } };
  }

  private sp(x: number, y: number): { x: number; y: number } { return toScreen(this.L, this.cam, x, y); }

  // ── events ─────────────────────────────────────────────────────
  on(e: SimEvent, sim: SerceSim): void {
    const rm = this.o.reducedMotion;
    switch (e.type) {
      case 'place': {
        const p = this.sp(0, PLACE[e.place][1] - HEART_Y);
        this.flash(p.x, p.y, GOLD_HI, 0.05 * this.cam.s + 10);
        if (!rm) this.parts.burst(p.x, p.y, 10, { color: GOLD_HI, speed: 40, life: 0.8, size: 1.6, drag: 3 });
        break;
      }
      case 'kindled': case 'whole': case 'home': {
        const p = this.sp(0, 0);
        this.flash(p.x, p.y, e.type === 'kindled' ? EMBER : GOLD_HI, (e.type === 'whole' ? R[0] : 0.25) * this.cam.s + 20);
        if (!rm) this.parts.burst(p.x, p.y, 24, { color: e.type === 'kindled' ? ROSE : GOLD_HI, speed: 70, life: 1.2, size: 1.8, drag: 2 });
        break;
      }
      case 'lamp': {
        const lp = this.lampAt(sim, e.ring, e.i);
        if (!lp) break;
        const p = this.sp(lp.x, lp.y);
        this.flash(p.x, p.y, RING_LOOK[e.ring].lamp, 18);
        if (!rm) this.parts.burst(p.x, p.y, 6, { color: RING_LOOK[e.ring].lamp, speed: 28, life: 0.7, size: 1.3, drag: 3 });
        break;
      }
      case 'ringDone': case 'reach': case 'sunUp': {
        const c = this.sp(0, 0);
        this.flash(c.x, c.y, GOLD, 30);
        break;
      }
      case 'tap':
        break;
      default: break;
    }
  }

  private flash(x: number, y: number, c: string, r: number): void {
    this.flashes.push({ x, y, t: 0, c, r });
    if (this.flashes.length > 24) this.flashes.shift();
  }

  /** A tap answers at once: a ring under the finger. */
  touch(x: number, y: number): void {
    this.ripples.push({ x, y, t: 0 });
    if (this.ripples.length > 6) this.ripples.shift();
  }

  overStory(x: number, y: number): boolean {
    const r = this.storyRect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  targets(sim: SerceSim): TapTarget[] {
    if (sim.story && this.storyRect) return [storyTarget(this.storyRect)];
    return [];
  }

  // ── the camera ─────────────────────────────────────────────────
  /** The framing the way asks for now. */
  framingOf(sim: SerceSim): Framing {
    const rest = sim.rest;
    if (rest && sim.block.why !== 'valve') {
      if (rest.rest === 'stop' || rest.rest === 'grat') return 'body';
      if (rest.rest === 'bless') {
        const r = rest.rings[rest.rings.length - 1] ?? 0;
        return r === 0 ? 'figure' : r === 5 ? 'world' : (`ring${r}` as Framing);
      }
      if (rest.rest === 'sun') return 'world';
      if (rest.rest === 'amen') return 'home';
    }
    if (sim.warmBlock) return 'body';
    const st = sim.stage;
    if (st === 'descent' || st === 'heart') return 'body';
    if (st === 'field') return 'figure';
    if (st === 'back') return 'home';
    const r = stageRing(st);
    if (r && r <= 4) return `ring${r}` as Framing;
    return 'world';
  }

  update(dt: number, sim: SerceSim): void {
    this.time += dt;
    if (!this.introMode) {
      const want = sim.restBlock && !sim.story ? 1 : 0;
      this.guideK = this.o.reducedMotion ? want : this.guideK + (want - this.guideK) * Math.min(1, dt / 0.35);
      if (Math.abs(this.guideK - want) < 0.002) this.guideK = want;
      this.L = this.restLayout(this.guideK);
    }
    const f = this.introMode ? 'figure' : this.framingOf(sim);
    const to = cameraFor(this.L, f);
    if (f !== this.framing) {
      this.framing = f;
      if (this.o.reducedMotion) {
        this.cam = to;
        this.cutK = 1;
      }
    }
    if (!this.o.reducedMotion) this.cam = easeCam(this.cam, to, 1 - Math.exp(-dt / RULES.cameraTau));
    else this.cam = to;
    this.cutK = Math.max(0, this.cutK - dt / 0.7);
    this.fade = Math.min(1, this.fade + dt / 0.8);
    // the figure layer follows the scale (re-baked when the camera moved far from it)
    const want = Math.min(900, this.cam.s);
    if (!this.fig || want > this.fig.s * 1.45 || want < this.fig.s / 1.8) this.fig = bakeFigure(want, this.dpr);
    // the words: a change fades in
    const w = sim.words();
    if (w.key !== this.wordsKey) {
      this.wordsKey = w.key;
      this.wordsFade = 0;
    }
    this.words = w;
    this.wordsFade = Math.min(1, this.wordsFade + dt / 0.6);
    // the pulse's beat
    if (this.pulse !== null) this.beatPh += dt * (this.pulse / 60);
    this.updateSparks(dt, sim);
    if (!this.o.reducedMotion) this.parts.update(dt);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < 0.8);
    for (const fl of this.flashes) fl.t += dt;
    this.flashes = this.flashes.filter(fl => fl.t < 1.1);
  }

  /** The thoughts round the head: restless while the light is at the brow, slowing and settling like snow as it goes down. */
  private updateSparks(dt: number, sim: SerceSim): void {
    if (this.o.reducedMotion) return;
    const settle = this.settle(sim);
    const speed = 0.22 * (1 - settle) + 0.01;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i];
      const n = this.time * (1.7 + s.s) + i * 3.1;
      s.vx += (Math.sin(n * 1.9) * 2.2 - s.vx * 1.5) * dt * (1 - settle);
      s.vy += (Math.cos(n * 1.3) * 2.2 - s.vy * 1.5) * dt * (1 - settle);
      // keep them round the head (a band from 0.07 to 0.16 out)
      const dx = s.x - HEAD[0], dy = (s.y - HEAD[1]) / 1.15, d = Math.hypot(dx, dy) || 1;
      const pull = d < 0.07 ? 1.2 : d > 0.16 ? -1.2 : 0;
      s.vx += (dx / d) * pull * dt * (1 - settle);
      s.vy += (dy / d) * pull * dt * (1 - settle);
      // settling: they fall slowly and fade
      s.vy += settle * 0.05 * dt;
      s.vx *= 1 - settle * 0.9 * dt;
      s.x += s.vx * speed * dt;
      s.y += s.vy * speed * dt + settle * 0.025 * dt;
    }
  }

  /** How settled the thoughts are: the descent's progress, eased; 1 once the light is in the heart. */
  private settle(sim: SerceSim): number {
    return sim.prog.heart > 0 || sim.prog.descent >= 1 ? 1 : ease.inOutSine(clamp(sim.prog.descent * 1.15));
  }

  // ── the field and the lamps ────────────────────────────────────
  /** The heart's field radius now (world units): round the figure, then widening ring by ring, back into the heart. */
  fieldR(sim: SerceSim): number {
    const p = sim.prog;
    if (p.field < 0.8) return 0;
    const close = ease.outCubic(clamp((p.field - 0.8) / 0.2));
    let r = R[0] * close;
    for (const k of [1, 2, 3, 4, 5] as Ring[]) {
      if (sim.ringOut(k)) continue;
      const v = p[ringStage(k)];
      const target = k === 5 ? R[4] + 0.7 : R[k];
      // a resumed way: the rings walked in earlier sessions open with the field round the figure
      if (sim.remembered(k)) { r = Math.max(r, target * close); continue; }
      if (v <= 0) break;
      const reach = clamp(v / RULES.reachShare);
      r = r + (target - r) * ease.inOutSine(reach);
      if (k === 5 && v > RULES.reachShare) {
        const kk = (v - RULES.reachShare) / (1 - RULES.reachShare);
        r = r + (EARTH_FAR + 0.4 - r) * ease.inOutSine(clamp(kk));
      }
    }
    if (p.back > 0) r = r + (0.08 - r) * ease.inOutSine(p.back);
    return r;
  }

  /** The lamps of a ring (world units), from the top clockwise (cached per ring and count). */
  lamps(r: Ring, n: number): Lamp[] {
    const key = `${r}|${n}`;
    const hit = this.lampMemo.get(key);
    if (hit) return hit;
    const out: Lamp[] = [];
    const rad = R[r] ?? R[4];
    const look = RING_LOOK[r].layout;
    if (look === 'house') {
      const rows = n <= 3 ? 1 : 2, cols = Math.ceil(n / rows);
      const wx = 0.155, wy = 0.15;
      const top = -rad + 0.28;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols), col = i % cols;
        const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
        out.push({ x: (col - (inRow - 1) / 2) * wx, y: top + row * wy, a: -Math.PI / 2 });
      }
    } else if (look === 'pairs') {
      const groups: number[] = [];
      let left = n, g = 0;
      while (left > 0) { const m = Math.min(left, g % 2 ? 3 : 2); groups.push(m); left -= m; g++; }
      groups.forEach((m, gi) => {
        const ac = -Math.PI / 2 + (gi + 0.5) * (TAU / groups.length);
        for (let j = 0; j < m; j++) {
          const a = ac + (j - (m - 1) / 2) * 0.13;
          out.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, a });
        }
      });
    } else if (look === 'town' || look === 'thorns') {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i + 0.5) * (TAU / n);
        out.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, a });
      }
    } else {
      for (const c of cityOrder(n)) out.push({ x: c.at[0], y: c.at[1], a: 0 });
    }
    this.lampMemo.set(key, out);
    return out;
  }

  private lampAt(sim: SerceSim, r: Ring, i: number): Lamp | null {
    if (r === 5) {
      const n = sim.plan.lamps[5];
      if (i >= n) {
        const a = arcAngle(i - n);
        const rr0 = EARTH.r * 1.09;
        return { x: EARTH.cx + Math.sin(a) * rr0, y: EARTH.cy - Math.cos(a) * rr0, a };
      }
      return this.lamps(5, n)[i] ?? null;
    }
    return this.lamps(r, sim.plan.lamps[r] || sim.lampTotal(r))[i] ?? null;
  }

  // ── drawing ────────────────────────────────────────────────────
  /** Draw a frame; `hud` false draws the scene alone (the calibration's intro). */
  draw(sim: SerceSim, hud = true): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (this.sky) ctx.drawImage(this.sky, 0, 0, L.w, L.h);
    else { ctx.fillStyle = '#0b0a22'; ctx.fillRect(0, 0, L.w, L.h); }
    const fr = this.fieldR(sim);
    this.drawEarth(ctx, sim, fr);
    this.drawField(ctx, sim, fr);
    this.drawRings(ctx, sim);
    if (sim.plan.arcs) this.drawArcs(ctx, sim);
    this.drawSun(ctx, sim);
    this.drawPervade(ctx, sim);
    this.drawFigure(ctx, sim);
    this.drawBreath(ctx, sim, fr);
    this.drawEffects(ctx);
    if (!hud) return;
    // the words
    const talk = sim.talk.line;
    if (talk) drawCaption(ctx, L, talk.text, Math.min(1, talk.t / 0.4, (talk.dur - talk.t) / 0.5));
    drawNow(ctx, L, sim, this.fade);
    if (this.words) drawCard(ctx, L, sim, this.words, this.wordsFade, sim.reshow > 0 ? sim.reshow / RULES.reshowSec : 0, this.pulse, this.time, this.o.reducedMotion);
    if (L.kind === 'tall') drawGuideBand(ctx, L, sim, this.guideK * this.guideK, this.o.reducedMotion, this.time);
    this.storyRect = drawStory(ctx, L, sim, this.o.touch);
    if (this.cutK > 0) {
      ctx.globalAlpha = this.cutK * 0.55;
      ctx.fillStyle = '#05040f';
      ctx.fillRect(0, 0, L.w, L.h);
      ctx.globalAlpha = 1;
    }
  }

  /** The world transform: world units → device pixels. */
  private worldTransform(ctx: CanvasRenderingContext2D): void {
    const L = this.L, c = this.cam, d = this.dpr;
    ctx.setTransform(d * c.s, 0, 0, d * c.s, d * (L.pic.x + L.pic.w / 2 - c.x * c.s), d * (L.pic.y + L.pic.h / 2 - c.y * c.s));
  }
  private screenTransform(ctx: CanvasRenderingContext2D): void { ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  /** The Earth at night under the figure: its disc, the land, the atmosphere's rim, the cities and their dust of lights. */
  private drawEarth(ctx: CanvasRenderingContext2D, sim: SerceSim, fr: number): void {
    const c = this.sp(EARTH.cx, EARTH.cy), r = EARTH.r * this.cam.s;
    // off screen entirely?
    if (c.y - r > this.L.h || c.y + r < 0 || c.x - r > this.L.w || c.x + r < 0) return;
    const E = earth();
    ctx.save();
    // the atmosphere: a soft blue rim outside the limb
    glow(ctx, '#6fa8ff', c.x, c.y, r * 1.16, 0.22);
    ctx.globalAlpha = 1;
    const disc = ctx.createRadialGradient(c.x - r * 0.25, c.y - r * 0.35, r * 0.1, c.x, c.y, r);
    disc.addColorStop(0, '#13244a');
    disc.addColorStop(0.7, '#0b1734');
    disc.addColorStop(1, '#081024');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.fill();
    // the land (world units through the camera), clipped to the disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.clip();
    this.worldTransform(ctx);
    ctx.fillStyle = '#1c2c4c';
    ctx.strokeStyle = 'rgba(150,180,230,.16)';
    ctx.lineWidth = 1.2 / this.cam.s;
    for (const land of E.lands) {
      ctx.beginPath();
      land.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    this.screenTransform(ctx);
    // the field's light over the Earth (ring 5): a warm wash out to its radius
    if (fr > R[4] && this.framing === 'world') {
      const h0 = this.sp(0, 0);
      const g = ctx.createRadialGradient(h0.x, h0.y, 0, h0.x, h0.y, fr * this.cam.s);
      g.addColorStop(0, 'rgba(255,214,150,.16)');
      g.addColorStop(0.85, 'rgba(255,190,150,.08)');
      g.addColorStop(1, 'rgba(255,190,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - r, c.y - r, 2 * r, 2 * r);
    }
    ctx.restore();
    // the dust of small lights: brighter inside the field
    ctx.globalCompositeOperation = 'lighter';
    const s = this.cam.s;
    const dotR = Math.max(0.7, Math.min(1.6, s * 0.012));
    for (const d of E.dust) {
      const lit = d.d < fr;
      const p = this.sp(d.at[0], d.at[1]);
      if (p.x < -4 || p.y < -4 || p.x > this.L.w + 4 || p.y > this.L.h + 4) continue;
      ctx.globalAlpha = (lit ? 0.55 : 0.12) * d.b;
      ctx.fillStyle = lit ? '#ffd9a0' : '#9fb4e0';
      ctx.fillRect(p.x - dotR / 2, p.y - dotR / 2, dotR, dotR);
    }
    // the cities (ring 5's lamps)
    const n = sim.plan.lamps[5];
    const remembered = sim.remembered(5);
    const lit = remembered ? n : Math.min(n, sim.lit[5]);
    const list = this.lamps(5, n);
    const eq = this.sunK(sim);
    list.forEach((lp, i) => {
      const p = this.sp(lp.x, lp.y);
      if (i < lit) {
        const rr0 = Math.max(5, 0.2 * s);
        glow(ctx, '#ffcf7a', p.x, p.y, rr0, 0.75 + 0.25 * eq);
        for (let k = 0; k < 4; k++) {
          const ox = (hash(i * 31 + k) - 0.5) * 0.18 * s, oy = (hash(i * 31 + k + 9) - 0.5) * 0.14 * s;
          glow(ctx, GOLD_HI, p.x + ox, p.y + oy, Math.max(2, rr0 * 0.3), 0.7);
        }
      } else glow(ctx, '#8aa0d8', p.x, p.y, Math.max(3, 0.08 * s), 0.25);
    });
    // more lights for the world (after the way)
    const more = Math.min(E.dust.length, sim.moreLights * 3);
    for (let i = 0; i < more; i++) {
      const d = E.dust[(i * 37) % E.dust.length];
      const p = this.sp(d.at[0], d.at[1]);
      glow(ctx, '#ffd59a', p.x, p.y, Math.max(3, 0.07 * s), 0.8);
    }
    ctx.restore();
  }

  /** The sun's share now: 0 before its stage, 1 once it rose (every ring lit alike from then on). */
  private sunK(sim: SerceSim): number { return ease.inOutSine(clamp(sim.prog.sun)); }

  /** The heart's field beyond the figure: a soft warm disc with a brighter rim (its wavefront). */
  private drawField(ctx: CanvasRenderingContext2D, sim: SerceSim, fr: number): void {
    if (fr <= 0.02) return;
    const c = this.sp(0, 0), r = Math.min(fr, R[4] + 0.7) * this.cam.s;
    const g0 = 0.6 + 0.4 * sim.glow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, `rgba(255,220,170,${0.2 * g0})`);
    g.addColorStop(0.55, `rgba(255,186,170,${0.09 * g0})`);
    g.addColorStop(0.92, `rgba(255,170,180,${0.07 * g0})`);
    g.addColorStop(1, 'rgba(255,170,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,214,170,${0.22 * g0})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** Rings 1–4: ghosts until the field reaches them, then their line and their lamps; the current one named. */
  private drawRings(ctx: CanvasRenderingContext2D, sim: SerceSim): void {
    const s = this.cam.s, c = this.sp(0, 0);
    const cur = sim.ring;
    const eq = this.sunK(sim);
    const showRings = sim.prog.field >= 0.95 || sim.from > 1;
    if (!showRings) return;
    ctx.save();
    for (const k of [1, 2, 3, 4] as Ring[]) {
      const out = sim.ringOut(k);
      const v = sim.prog[ringStage(k)];
      const mem = sim.remembered(k);
      const reached = mem || v >= RULES.reachShare;
      const rad = R[k] * s;
      const look = RING_LOOK[k];
      const bright = cur === k ? 1 : mem ? 0.6 : 0.75;
      const b = bright + (1 - bright) * eq;
      // the ring's line
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = reached ? 1.6 : 1;
      ctx.setLineDash(reached || out ? [] : [3, 5]);
      ctx.strokeStyle = out ? 'rgba(200,196,220,.08)' : reached ? `${rgbaPrefix(look.line)}${0.42 * b})` : 'rgba(210,206,240,.16)';
      if (look.layout !== 'thorns' || out) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, rad, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if (out) continue;
      const n = sim.plan.lamps[k] || sim.lampTotal(k);
      const lit = mem ? n : sim.lit[k];
      // a ring far larger than the picture reads as a crack, not a ring: its ghost is the dashed line alone
      const huge = !reached && rad > 0.62 * Math.max(this.L.pic.w, this.L.pic.h);
      if (look.layout === 'thorns' && huge) {
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'rgba(210,206,240,.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rad, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (look.layout === 'thorns' && !huge) this.drawThorns(ctx, rad, reached ? clamp((v - RULES.reachShare) / (1 - RULES.reachShare)) : mem ? 1 : 0, reached);
      if (look.layout === 'house') this.drawHouse(ctx, n, reached, b);
      const lamps = this.lamps(k, n);
      ctx.globalCompositeOperation = 'lighter';
      lamps.forEach((lp, i) => {
        const p = this.sp(lp.x, lp.y);
        const on = i < lit;
        if (look.layout === 'house') {
          const ww = Math.max(4, 0.1 * s), wh = Math.max(4, 0.11 * s);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.fillStyle = on ? mix('#ffcf8a', look.lamp, 0.5) : 'rgba(60,52,90,.85)';
          rr(ctx, p.x - ww / 2, p.y - wh / 2, ww, wh, 1.5);
          ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          if (on) glow(ctx, look.lamp, p.x, p.y, Math.max(9, 0.22 * s), 0.55 * b);
        } else if (look.layout === 'town') {
          // a small building on the ring's outer side, its window the lamp
          const bw = Math.max(3, 0.05 * s), bh = Math.max(5, (0.08 + 0.07 * hash(i * 13)) * s);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(lp.a + Math.PI / 2);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = reached ? 0.75 : 0.35;
          ctx.fillStyle = '#2a2650';
          ctx.fillRect(-bw / 2, -bh, bw, bh);
          ctx.restore();
          ctx.globalCompositeOperation = 'lighter';
          const wp = this.sp(lp.x + Math.cos(lp.a) * 0.05, lp.y + Math.sin(lp.a) * 0.05);
          if (on) glow(ctx, look.lamp, wp.x, wp.y, Math.max(6, 0.13 * s), 0.8 * b);
          else glow(ctx, '#8c88b8', wp.x, wp.y, Math.max(3, 0.05 * s), 0.3);
        } else if (look.layout === 'thorns') {
          if (on) glow(ctx, look.lamp, p.x, p.y, Math.max(8, 0.2 * s), 0.85 * b);
          else {
            // a cold stone
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = reached ? 0.9 : 0.5;
            ctx.fillStyle = '#6f7484';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, Math.max(3, 0.05 * s), Math.max(2.4, 0.038 * s), lp.a, 0, TAU);
            ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
          }
        } else if (on) glow(ctx, look.lamp, p.x, p.y, Math.max(8, 0.2 * s), 0.85 * b);
        else glow(ctx, '#a09cc8', p.x, p.y, Math.max(3, 0.06 * s), reached ? 0.35 : 0.18);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // the current ring's name and the player's names by its lamps
      if (cur === k && this.framing !== 'world') {
        const below = c.y + rad + 8 + this.L.fs.label + 6 <= this.L.pic.y + this.L.pic.h;
        if (below) this.label(ctx, ringName(k), c.x, c.y + rad + 8, look.line, true);
        else this.label(ctx, ringName(k), c.x - rad, c.y - this.L.fs.label / 2 - 3, look.line, true, Math.max(90, rad * 0.9));
        this.drawNames(ctx, sim, k, lamps, lit);
      }
    }
    ctx.restore();
  }

  /** Ring 1: one house at dusk, its windows the family's lamps. */
  private drawHouse(ctx: CanvasRenderingContext2D, n: number, reached: boolean, b: number): void {
    const s = this.cam.s;
    const rows = n <= 3 ? 1 : 2, cols = Math.ceil(n / rows);
    const top = -R[1] + 0.28;
    const hw = (cols * 0.155) / 2 + 0.07;
    const y0 = top - 0.1, y1 = top + (rows - 1) * 0.15 + 0.1;
    const a = this.sp(-hw, y0), z = this.sp(hw, y1);
    const roof = this.sp(0, y0 - 0.2);
    ctx.save();
    ctx.globalAlpha = reached ? 0.9 : 0.45;
    ctx.fillStyle = reached ? '#2b2046' : '#1d1834';
    ctx.strokeStyle = reached ? `rgba(255,207,150,${0.45 * b})` : 'rgba(210,206,240,.2)';
    ctx.lineWidth = Math.max(1, 0.008 * s);
    ctx.beginPath();
    ctx.moveTo(a.x - 0.03 * s, a.y);
    ctx.lineTo(roof.x, roof.y);
    ctx.lineTo(z.x + 0.03 * s, a.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(a.x, a.y, z.x - a.x, z.y - a.y);
    ctx.strokeRect(a.x, a.y, z.x - a.x, z.y - a.y);
    ctx.restore();
  }

  /** Ring 4: a ring of grey-green thorns; as it kindles the thorns blossom (white-pink), never burn. */
  private drawThorns(ctx: CanvasRenderingContext2D, rad: number, bloom: number, reached: boolean): void {
    const c = this.sp(0, 0), s = this.cam.s;
    const N = 72;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = mix('#5d6b5a', '#8a9a7e', bloom);
    ctx.globalAlpha = reached ? 0.85 : 0.22;
    ctx.lineWidth = Math.max(1.2, 0.012 * s);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const rr0 = rad + Math.sin(i * 2.7) * 0.018 * s;
      const x = c.x + Math.cos(a) * rr0, y = c.y + Math.sin(a) * rr0;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // the thorns: short spikes, alternately out and in
    const spike = Math.max(3, 0.045 * s);
    ctx.lineWidth = Math.max(1, 0.008 * s);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + 0.03, dir = i % 2 ? 1 : -1;
      const bx = c.x + Math.cos(a) * rad, by = c.y + Math.sin(a) * rad;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + dir * 0.6) * spike * dir, by + Math.sin(a + dir * 0.6) * spike * dir);
    }
    ctx.stroke();
    // the blossoms
    const blooms = Math.round(bloom * 36);
    for (let i = 0; i < blooms; i++) {
      const a = (((i * 7) % 36) / 36) * TAU + 0.087;
      const bx = c.x + Math.cos(a) * rad, by = c.y + Math.sin(a) * rad;
      const pr = Math.max(2.2, 0.03 * s);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#ffe3ec';
      for (let k = 0; k < 5; k++) {
        const pa = a + (k / 5) * TAU;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(pa) * pr * 0.8, by + Math.sin(pa) * pr * 0.8, pr * 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(bx, by, pr * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The player's names by the lamps of the current ring (spread over its lamps; ring 1 in a line under the house). */
  private drawNames(ctx: CanvasRenderingContext2D, sim: SerceSim, k: Ring, lamps: Lamp[], lit: number): void {
    const names = namesOf(sim.p, k);
    if (!names.length || !lamps.length) return;
    const px = this.L.fs.label;
    if (RING_LOOK[k].layout === 'house') {
      const shown = names.filter((_, j) => Math.floor((j * lamps.length) / names.length) < lit);
      if (!shown.length) return;
      const y = this.sp(0, -R[1] + 0.28 + (lamps.length > 3 ? 0.15 : 0) + 0.2).y;
      this.label(ctx, shown.join(' · '), this.sp(0, 0).x, y, '#ffe2bd', false, Math.min(this.L.pic.w - 16, R[1] * 1.6 * this.cam.s));
      return;
    }
    names.forEach((nm, j) => {
      const i = Math.floor((j * lamps.length) / names.length);
      if (i >= lit) return;
      const lp = lamps[i];
      const out = 0.16 + px / this.cam.s;
      const p = this.sp(lp.x + Math.cos(lp.a) * out, lp.y + Math.sin(lp.a) * out);
      this.label(ctx, nm, p.x, p.y - px / 2, RING_LOOK[k].lamp, false, 110);
    });
  }

  /** A small label with a dark halo (never under 11 px), fitted to `maxW`. */
  private label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, bold: boolean, maxW = 260): void {
    const px = this.L.fs.label;
    ctx.save();
    ctx.font = font(px, bold ? 700 : 600);
    let s = text;
    while (s.length > 2 && ctx.measureText(s).width > maxW) s = `${s.slice(0, -2)}…`;
    const w = ctx.measureText(s).width;
    const P = this.L.pic;
    const lx = Math.max(P.x + 4 + w / 2, Math.min(P.x + P.w - 4 - w / 2, x));
    y = Math.max(P.y + 2, Math.min(P.y + P.h - px - 6, y));
    ctx.fillStyle = 'rgba(10,8,26,.6)';
    rr(ctx, lx - w / 2 - 6, y - 2, w + 12, px + 6, (px + 6) / 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(s, lx, y + 1);
    ctx.restore();
  }

  /** Ring 5's named arcs round the Earth (long sessions): those who suffer, the lonely, the sick, the dying, the newborn. */
  private drawArcs(ctx: CanvasRenderingContext2D, sim: SerceSim): void {
    if (this.framing !== 'world' && sim.stage !== 'ring5') return;
    const n = sim.plan.lamps[5];
    const lit = sim.remembered(5) ? 5 : Math.max(0, sim.lit[5] - n);
    const c = this.sp(EARTH.cx, EARTH.cy), r = EARTH.r * this.cam.s * 1.09;
    ctx.save();
    ARCS.forEach((a, i) => {
      const ac = arcAngle(i);
      const on = i < lit;
      ctx.globalCompositeOperation = on ? 'lighter' : 'source-over';
      ctx.strokeStyle = on ? 'rgba(255,214,150,.85)' : 'rgba(200,200,240,.16)';
      ctx.lineWidth = on ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, ac - Math.PI / 2 - 0.2, ac - Math.PI / 2 + 0.2);
      ctx.stroke();
      if (on) {
        const lx = c.x + Math.sin(ac) * (r + 10), ly = c.y - Math.cos(ac) * (r + 10);
        ctx.globalCompositeOperation = 'source-over';
        this.label(ctx, arcName(a), lx, ly - 6, GOLD_HI, false, 240);
      }
    });
    ctx.restore();
  }

  /** The one sun rising over the limb (the barrier stage): from then on every ring alike. */
  private drawSun(ctx: CanvasRenderingContext2D, sim: SerceSim): void {
    const k = this.sunK(sim);
    if (k <= 0.01) return;
    const a = 1.15;   // right of the top
    const rise = EARTH.r * (1.0 + 0.16 * k);
    const p = this.sp(EARTH.cx + Math.sin(a) * rise, EARTH.cy - Math.cos(a) * rise);
    const s = this.cam.s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#fff2c8', p.x, p.y, Math.max(40, 1.6 * s) * (0.5 + 0.5 * k), 0.9 * k);
    glow(ctx, '#ffd27a', p.x, p.y, Math.max(90, 4 * s) * (0.5 + 0.5 * k), 0.5 * k);
    // a golden crescent along the atmosphere near it
    const c = this.sp(EARTH.cx, EARTH.cy);
    ctx.strokeStyle = `rgba(255,214,140,${0.5 * k})`;
    ctx.lineWidth = Math.max(2, 0.05 * s);
    ctx.beginPath();
    ctx.arc(c.x, c.y, EARTH.r * s * 1.005, a - Math.PI / 2 - 0.55, a - Math.PI / 2 + 0.55);
    ctx.stroke();
    // rays
    if (!this.o.reducedMotion) {
      for (let i = 0; i < 12; i++) {
        const ra = (i / 12) * TAU + this.time * 0.05;
        const l = Math.max(60, 3 * s) * k;
        ctx.strokeStyle = `rgba(255,236,190,${0.08 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(ra) * l, p.y + Math.sin(ra) * l);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Ephesians 3:18: breadth (across), length (a ring lying flat), height (up), depth (down into the Earth). */
  private drawPervade(ctx: CanvasRenderingContext2D, sim: SerceSim): void {
    const k = sim.prog.pervade * (1 - sim.prog.back);
    if (k <= 0.01) return;
    const c = this.sp(0, 0), s = this.cam.s;
    const reach = (R[4] + 1.2) * s;
    const ph = (x: number) => ease.inOutSine(clamp(x));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ray = (dx: number, dy: number, f: number) => {
      if (f <= 0) return;
      const g = ctx.createLinearGradient(c.x, c.y, c.x + dx * reach * f, c.y + dy * reach * f);
      g.addColorStop(0, 'rgba(255,236,190,.7)');
      g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(2, 0.03 * s);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + dx * reach * f, c.y + dy * reach * f);
      ctx.stroke();
    };
    const b = ph(k / 0.4), l = ph((k - 0.25) / 0.4), hgt = ph((k - 0.5) / 0.35), d = ph((k - 0.6) / 0.35);
    ray(1, 0, b);
    ray(-1, 0, b);
    if (l > 0) {
      ctx.strokeStyle = `rgba(255,226,190,${0.45 * l})`;
      ctx.lineWidth = Math.max(1.5, 0.02 * s);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, reach * l, reach * 0.22 * l, 0, 0, TAU);
      ctx.stroke();
    }
    ray(0, -1, hgt);
    ray(0, 1, d);
    ctx.globalCompositeOperation = 'source-over';
    const lbl = (txt: string, x: number, y: number, a: number) => { if (a > 0.6 && sim.prog.back <= 0) this.label(ctx, txt, x, y, GOLD_HI, false, 140); };
    lbl(dimName(DIMS[0]), c.x + reach * b * 0.78, c.y - 22, b);
    lbl(dimName(DIMS[1]), c.x - reach * l * 0.6, c.y + reach * 0.22 * l + 4, l);
    lbl(dimName(DIMS[2]), c.x, c.y - reach * hgt * 0.8, hgt);
    lbl(dimName(DIMS[3]), c.x, c.y + reach * d * 0.75, d);
    ctx.restore();
  }

  /** The figure: its rim and translucent body, the light within, the trail, the places, the sparks, the heart. */
  private drawFigure(ctx: CanvasRenderingContext2D, sim: SerceSim): void {
    const s = this.cam.s;
    const fig = this.fig;
    const tl = this.sp(fig?.x0 ?? -0.27, fig?.y0 ?? -HEART_Y - 0.05);
    if (fig) {
      ctx.globalAlpha = 0.65 + 0.35 * clamp(sim.prog.field + 0.4 * sim.prog.heart);
      ctx.drawImage(fig.c, tl.x, tl.y, fig.w * s, fig.h * s);
      ctx.globalAlpha = 1;
    }
    const p = sim.prog;
    const g = sim.glow;
    // the heart's glow filling the figure from the heart outward (head, hands, feet last)
    const fill = p.field;
    const path = figureWorldPath();
    if (fill > 0 && path) {
      ctx.save();
      this.worldTransform(ctx);
      ctx.clip(path);
      const rad = 0.06 + fill * 0.78;
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      const a = (0.32 + 0.25 * g) * (1 - 0.6 * p.back);
      gr.addColorStop(0, `rgba(255,226,178,${a + 0.08})`);
      gr.addColorStop(0.6, `rgba(255,190,168,${a * 0.7})`);
      gr.addColorStop(0.9, `rgba(255,170,190,${a * 0.45})`);
      gr.addColorStop(1, 'rgba(255,170,190,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(-0.4, -0.4, 0.8, 1.3);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the trail and the moving light (the descent)
    const k = p.descent;
    const head = this.sp(0, DESCENT[0][1]);
    const at = alongPath(DESCENT, k);
    const lp = this.sp(at[0], at[1]);
    if (k > 0 && p.field < 1) {
      const gr = ctx.createLinearGradient(head.x, head.y, lp.x, lp.y);
      const fadeT = 1 - 0.85 * clamp(p.heart * 1.5);
      gr.addColorStop(0, `rgba(255,226,180,${0.18 * fadeT})`);
      gr.addColorStop(1, `rgba(255,230,190,${(0.55 + 0.3 * g) * fadeT})`);
      ctx.strokeStyle = gr;
      ctx.lineWidth = Math.max(1.5, 0.014 * s);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(head.x, head.y);
      ctx.lineTo(lp.x, lp.y);
      ctx.stroke();
    }
    // the places passed keep a small light
    for (const pl of PLACES.slice(1, -1)) {
      if (sim.placesPassed < PLACES.indexOf(pl)) continue;
      const q = this.sp(0, PLACE[pl][1] - HEART_Y);
      glow(ctx, GOLD_HI, q.x, q.y, Math.max(4, 0.035 * s), 0.6);
    }
    // the brow: where the band sits — the light starts here and keeps a soft glow
    glow(ctx, GOLD_HI, head.x, head.y, Math.max(5, 0.05 * s), k > 0 ? 0.35 : 0.8);
    // the moving light: brighter while it moves (a smoothed focus)
    if (p.descent < 1) {
      const moving = sim.moving ? 1 : 0.55;
      glow(ctx, '#fff6e0', lp.x, lp.y, Math.max(7, 0.07 * s) * (0.8 + 0.4 * g), 0.95 * moving);
      glow(ctx, GOLD, lp.x, lp.y, Math.max(16, 0.18 * s) * (0.8 + 0.4 * g), 0.45 * moving);
    }
    ctx.restore();
    this.drawSparks(ctx, sim);
    this.drawHeart(ctx, sim);
  }

  private drawSparks(ctx: CanvasRenderingContext2D, sim: SerceSim): void {
    const settle = this.settle(sim);
    // they fade as they settle: half gone by the mouth, gone by the throat
    const vis = 1 - clamp((settle - 0.3) / 0.5);
    if (vis <= 0.01) return;
    const s = this.cam.s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sp of this.sparks) {
      const p = this.sp(sp.x, sp.y);
      glow(ctx, '#d8e4ff', p.x, p.y, Math.max(2.5, Math.min(7, 0.018 * s * sp.s)), 0.55 * sp.a * vis);
    }
    ctx.restore();
  }

  /** The heart: a warm sphere (gold → rose; it beats with the real pulse, else breathes) and a flame in it. */
  private drawHeart(ctx: CanvasRenderingContext2D, sim: SerceSim): void {
    const p = sim.prog;
    const flame = clamp(p.heart);
    const arrived = p.descent >= 1 || flame > 0;
    if (!arrived) return;
    const s = this.cam.s, c = this.sp(0, 0), g = sim.glow;
    let beat = 0;
    if (this.pulse !== null) {
      const ph = this.beatPh % 1;
      beat = Math.exp(-ph * 7) * (1 - Math.exp(-ph * 60));
    } else {
      const b = sim.restBlock ? sim.breath.k : sim.wordBreath.k;
      beat = b * 0.6;
    }
    const scale = 1 + 0.1 * beat;
    const rad = (0.05 + 0.07 * flame) * s * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, ROSE, c.x, c.y, Math.max(14, rad * 3), 0.22 + 0.22 * flame);
    glow(ctx, GOLD, c.x, c.y, Math.max(10, rad * 1.5), 0.16 + 0.22 * flame * (0.7 + 0.3 * g));
    // the sphere's soft rim
    ctx.strokeStyle = `rgba(255,200,190,${0.25 + 0.3 * flame})`;
    ctx.lineWidth = Math.max(1, 0.006 * s);
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(6, rad), 0, TAU);
    ctx.stroke();
    // the flame: an outer tongue (amber to rose, its tip fading) and a white-gold core low in it; it sways and flickers
    if (flame > 0.02) {
      const rm = this.o.reducedMotion;
      const flick = rm ? 1 : 1 + 0.06 * Math.sin(this.time * 13.1) + 0.04 * Math.sin(this.time * 7.7);
      const hgt = Math.max(9, (0.05 + 0.08 * flame) * s) * (0.9 + 0.2 * g) * flick;
      const sway = rm ? 0 : Math.sin(this.time * 2.3) * 0.1 + Math.sin(this.time * 5.9) * 0.05;
      const tongue = (hh: number, ww: number, base: number, c0: string, c1: string, c2: string) => {
        const bx = c.x, by = c.y + base;
        const tx = bx + sway * hh, ty = by - hh;
        const fg = ctx.createLinearGradient(bx, by, tx, ty);
        fg.addColorStop(0, c0);
        fg.addColorStop(0.5, c1);
        fg.addColorStop(1, c2);
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.bezierCurveTo(bx + ww * 0.35, by - hh * 0.55, bx + ww, by - hh * 0.28, bx + ww * 0.55, by - ww * 0.1);
        ctx.quadraticCurveTo(bx, by + ww * 0.62, bx - ww * 0.55, by - ww * 0.1);
        ctx.bezierCurveTo(bx - ww, by - hh * 0.28, bx - ww * 0.35, by - hh * 0.55, tx, ty);
        ctx.fill();
      };
      glow(ctx, EMBER, c.x, c.y - hgt * 0.15, hgt * 1.2, 0.35 * flame);
      tongue(hgt, hgt * 0.36, hgt * 0.32, `rgba(255,186,96,${0.75 * flame + 0.15})`, `rgba(255,128,120,${0.6 * flame + 0.1})`, 'rgba(255,110,150,0)');
      tongue(hgt * 0.55, hgt * 0.2, hgt * 0.3, 'rgba(255,255,246,.95)', 'rgba(255,236,170,.85)', 'rgba(255,214,140,0)');
    }
    ctx.restore();
  }

  /** The breath guide in rest: a ring of light that widens with the in-breath and narrows with the out-breath. */
  private drawBreath(ctx: CanvasRenderingContext2D, sim: SerceSim, fr: number): void {
    if (!sim.restBlock) return;
    const k = sim.breath.k;
    const base = this.framing === 'body' ? 0.16 : this.framing === 'figure' ? R[0] : this.framing === 'world' ? R[4] + 0.5 : Math.max(fr, R[1]);
    const c = this.sp(0, 0), r = base * this.cam.s * (0.84 + 0.16 * k);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,226,180,${0.18 + 0.3 * k})`;
    ctx.lineWidth = 2 + 2 * k;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  private drawEffects(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const fl of this.flashes) {
      const a = Math.max(0, 1 - fl.t / 1.1);
      glow(ctx, fl.c, fl.x, fl.y, fl.r * (1 + 0.6 * fl.t), 0.6 * a);
    }
    ctx.globalAlpha = 1;
    if (!this.o.reducedMotion) this.parts.draw(ctx);
    for (const r of this.ripples) {
      const a = 1 - r.t / 0.8;
      ctx.strokeStyle = `rgba(255,226,180,${0.6 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + 40 * r.t, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** Where a named arc sits round the Earth (radians from the top, clockwise), away from the figure at the top. */
export function arcAngle(i: number): number {
  return [-1.35, 1.35, -2.2, 2.2, Math.PI][i % 5];
}

