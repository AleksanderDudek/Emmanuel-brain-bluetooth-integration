/**
 * Rzeki żywej wody's play view (DESIGN.md §13.14): deep space with an open heaven and its rays, the egg of
 * light around the figure, the pool of living water at its feet and the two rivers that flow from it as the
 * drops gather, the figure of light (it breathes 4 in / 6 out in rest), the column of light along its midline,
 * the two threads — gold and silver — spiralling along the lit part of the column, the seven places (waiting
 * orbs, small lit windows, gold-ringed when thanked), and the current place's rose window opening petal by
 * petal inside its halo of light, the threshold drawn on the place as a faint ring.  When a place is full the
 * light flows on as a stream of living water to the next place.  Drops fall down the column into the pool in
 * rest; motes drift; the prayer band, the narrator's caption and the story cards come from hud.ts.
 *
 * Per frame it composes cached layers (paint.ts) and draws a few dozen small shapes: no shadowBlur, no filters.
 */
import { clamp, ease, Floaters, Particles } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { PLACE, PLACES, tierName, type PlaceId } from './content';
import { CHEST } from './figure';
import { drawCaption, drawPrayer, drawStory, dropFloat } from './hud';
import { t } from './i18n';
import { idleR, layout, litR, maxWindowR, placeXY, tapTargets, windowR, type Layout, type Rect } from './layout';
import {
  GOLD, GOLD_HI, PEARL, SANS, SILVER, WATER, auraSprite, bakeFigure, bakeRays, bakeRose, bakeRoses, bakeSky, bloom, columnSprite, glow, glowSprite, hash,
  mix, poolSprite, rgbaPrefix, starSprite, type FigureLayer, type Layer, type RoseLayers,
} from './paint';
import { RING, fullPath, openness, partPath, petalAngle } from './rose';
import { RULES } from './rules';
import { LIT_UP, type RzekiSim, type SimEvent } from './sim';

const TAU = Math.PI * 2;

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

interface Mote { x: number; y: number; vy: number; r: number; a: number; ph: number }
/** A drop of living water falling down the column into the pool; `label` floats up beside the pool when it lands. */
interface Drop { y: number; vy: number; x: number; hue: string; from: number; big?: boolean; label?: string; labelColor?: string }
interface Ripple { t: number; k: number }

export class RzekiView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private sky: Layer | null = null;
  private rays: Layer | null = null;
  private raysBox = { x: 0, y: 0, w: 1, h: 1 };
  private fig: FigureLayer | null = null;
  private roses: Partial<Record<PlaceId, RoseLayers>> = {};
  /** the craft tier each window is baked at, and the radius they are baked at */
  private roseTier: Record<PlaceId, number> = { mind: 0, eyes: 0, mouth: 0, heart: 0, breath: 0, inner: 0, feet: 0 };
  private roseR = 1;
  private riverPts: [number, number][][] = [];
  private readonly parts = new Particles(140);
  private readonly floats = new Floaters();
  private motes: Mote[] = [];
  private drops: Drop[] = [];
  private ripples: Ripple[] = [];
  private dropT = 0;
  private incenseT = 0;
  private floatSide = 1;
  /** splashes in the pool since the last read (the sound's plinks) */
  splashes = 0;
  private openKey = '';
  private openFull: Path2D | null = null;
  /** juice: the window's pop when it fills, the whole body's glow, the heaven's brightness */
  private pop = 0;
  private flash = 0;
  private heavenK = 0;
  private time = 0;
  private lastDt = 1 / 60;
  private captionK = 0;
  private lastCaption = '';
  /** the story card as last drawn (for taps and the audit) */
  storyRect: Rect | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, { top: 134, right: 0, bottom: 0, left: 0 }, o.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.o.touch);
    const L = this.L, H = L.fig.H;
    this.sky = bakeSky(w, h, dpr, { cx: L.fig.cx, heavenY: L.top - H * 0.02, midY: L.fig.top + H * 0.45, H });
    const rw = Math.min(w, H * 1.3);
    this.raysBox = { x: L.fig.cx - rw / 2, y: 0, w: rw, h: Math.max(20, L.fig.top + H * 0.06) };
    this.rays = bakeRays(this.raysBox.w, this.raysBox.h, dpr, rw / 2);
    this.fig = bakeFigure(L.fig, dpr);
    this.roseR = maxWindowR(L);
    this.roses = bakeRoses(this.roseR, dpr, this.roseTier);
    this.openKey = '';
    // the two rivers from the pool to the sides, meandering a little toward the viewer
    const ground = L.fig.top + H, cx = L.fig.cx;
    this.riverPts = [-1, 1].map(s => {
      // both run to the edges: on a wide screen the ground lies below the prayer's column
      const end = s < 0 ? L.left - 12 : L.right + 12;
      const span = Math.abs(end - (cx + s * H * 0.16));
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        pts.push([cx + s * (H * 0.16 + u * span), ground + H * (0.014 + 0.045 * u * u) + Math.sin(u * 7 + s) * H * 0.01 * u]);
      }
      return pts;
    });
    // motes in and around the egg of light
    this.motes = [];
    for (let i = 0; i < 34; i++) this.motes.push(this.newMote(i, true));
  }

  private newMote(i: number, anywhere: boolean): Mote {
    const L = this.L, H = L.fig.H;
    const x = L.fig.cx + (hash(i * 3 + this.time) - 0.5) * H * 0.8;
    const y = anywhere ? L.fig.top - H * 0.05 + hash(i * 7 + this.time) * H * 1.05 : L.fig.top + H * (0.9 + 0.15 * hash(i + this.time));
    return { x, y, vy: -(4 + 10 * hash(i * 11 + this.time)) * (H / 400), r: 0.8 + 1.8 * hash(i * 13 + this.time), a: 0.25 + 0.5 * hash(i * 17 + this.time), ph: hash(i * 19) * TAU };
  }

  // ── events → juice ─────────────────────────────────────────────
  on(e: SimEvent, sim: RzekiSim): void {
    const L = this.L, H = L.fig.H;
    switch (e.type) {
      case 'petal': {
        const c = placeXY(L, e.place), R = windowR(L, sim.fill), rose = PLACE[e.place].rose;
        const innerN = rose.inner;
        const k = e.n - 1;
        const a = k < innerN ? petalAngle(k, innerN) : petalAngle(k - innerN, rose.outer, rose.twist);
        const rr = (k < innerN ? (RING.c + RING.i) / 2 : (RING.i + RING.o) / 2) * R;
        this.parts.burst(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, 3, { color: PLACE[e.place].rose.glass[k < innerN ? 1 : 2], speed: H * 0.06, life: 0.6, size: 1.6, g: 0, drag: 2.5, shape: 'dot' });
        break;
      }
      case 'full': {
        const c = placeXY(L, e.place), hue = PLACE[e.place].hue;
        this.pop = 1;
        this.parts.burst(c.x, c.y, 22, { color: hue, speed: H * 0.22, life: 1.1, size: 2, g: -10, drag: 1.8, shape: 'spark' });
        this.parts.burst(c.x, c.y, 1, { color: '#ffffff', speed: 0, life: 0.9, size: H * 0.07, g: 0, drag: 0, shape: 'ring' });
        // a bright drop falls from the place down the column into the pool; its "+15" rises there, by the water
        this.drops.push({ y: c.y, vy: H * 0.12, x: L.fig.cx, hue, from: c.y, big: true, label: dropFloat(e.drops), labelColor: WATER });
        break;
      }
      case 'whole': {
        this.flash = this.o.reducedMotion ? 0.5 : 1;
        this.poolFloat(dropFloat(e.drops), GOLD_HI, 18);
        // the thanks rise from the crown into the open heaven (Ps 141:2); the gift pours down to the feet
        const c = placeXY(L, e.dir === 'up' ? 'mind' : 'feet');
        this.parts.burst(c.x, c.y, 34, e.dir === 'up'
          ? { color: GOLD, speed: H * 0.25, angle: -Math.PI / 2, spread: 0.9, life: 2.2, size: 2, g: -H * 0.05, drag: 0.8, shape: 'dot' }
          : { color: WATER, speed: H * 0.2, angle: -Math.PI / 2, spread: 2.6, life: 1.6, size: 1.8, g: H * 0.25, drag: 0.9, shape: 'dot' });
        break;
      }
      case 'enter':
        if (e.dir === 'down') this.heavenK = 1;
        break;
      case 'tier': {
        // new glass in the window: gold sparks and its name
        const c = placeXY(L, e.place);
        this.parts.burst(c.x, c.y, 28, { color: GOLD, speed: H * 0.2, life: 1.4, size: 2, g: -12, drag: 1.4, shape: 'spark' });
        this.sideFloat(tierName(e.tier), c.y, GOLD_HI);
        break;
      }
      case 'tap': {
        const c = placeXY(L, e.place);
        this.parts.burst(c.x, c.y, 1, { color: PLACE[e.place].hue, speed: 0, life: 0.7, size: windowR(L, sim.fill) * 0.9, g: 0, drag: 0, shape: 'ring' });
        if (e.eff > 0.5) this.parts.burst(c.x, c.y, 4, { color: GOLD_HI, speed: H * 0.08, life: 0.7, size: 1.5, g: -8, drag: 2, shape: 'dot' });
        break;
      }
      case 'drops':
        this.poolFloat(dropFloat(e.n), WATER, 14);
        break;
      case 'blindEnd': {
        const c = placeXY(L, sim.place);
        if (e.drops > 0) this.poolFloat(dropFloat(e.drops), SILVER, 15);
        if (e.gained > 0.005) {
          const pct = t('pct', { n: Math.round(Math.min(1, e.gained) * 100) });
          this.sideFloat(t('hud.revealed', { pct }), c.y, '#e6e8f6');
        }
        this.parts.burst(c.x, c.y, 16, { color: SILVER, speed: H * 0.16, life: 1, size: 1.8, g: -6, drag: 1.8, shape: 'spark' });
        break;
      }
      case 'gold':
        if (e.on) {
          const c = placeXY(L, sim.place);
          this.parts.burst(c.x, c.y, 8, { color: GOLD, speed: H * 0.1, life: 0.8, size: 1.6, g: -6, drag: 2, shape: 'dot' });
        }
        break;
      default:
        break;
    }
  }

  /** A number that rises beside the pool, where the drops fall — never over the column and its windows. */
  private poolFloat(text: string, color: string, px: number): void {
    const L = this.L, H = L.fig.H;
    this.floatSide = -this.floatSide;
    const x = L.fig.cx + this.floatSide * H * (0.27 + 0.03 * Math.random());
    this.floats.add(text, x, L.fig.top + H * 0.97, { color, size: px * L.u, dur: 1.7 });
  }

  /**
   * A word beside the column at a place's height, beyond the hands: on an upright phone to the right, on a wide
   * screen to the left (the prayer's column is on the right), kept inside the picture.
   */
  private sideFloat(text: string, y: number, color: string): void {
    const L = this.L, H = L.fig.H;
    const x = L.shape === 'tall' ? Math.min(L.fig.cx + H * 0.3, L.right - 64) : Math.max(L.fig.cx - H * 0.3, L.left + 64);
    this.floats.add(text, x, y, { color, size: 14 * L.u, dur: 2.4 });
  }

  /** A touch-down anywhere: a soft ring of light under the finger, at once. */
  touch(x: number, y: number): void {
    this.parts.burst(x, y, 1, { color: PEARL, speed: 0, life: 0.5, size: 12, g: 0, drag: 0, shape: 'ring' });
  }

  update(dt: number, sim: RzekiSim): void {
    this.time += dt;
    this.lastDt = dt;
    this.parts.update(dt);
    this.floats.update(dt);
    this.pop = Math.max(0, this.pop - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 0.6);
    this.heavenK = Math.max(sim.stage === 'enter' && sim.dir === 'down' ? 1 : 0, this.heavenK - dt * 0.35);
    const line = sim.talk.line;
    this.captionK = line ? Math.min(1, this.captionK + dt * 4) : Math.max(0, this.captionK - dt * 3);
    if (line) this.lastCaption = line.text;
    const L = this.L, H = L.fig.H;
    // motes drift up through the egg of light
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.y += m.vy * dt * (sim.restBlock ? 0.6 : 1);
      m.ph += dt;
      if (m.y < L.fig.top - H * 0.12) this.motes[i] = this.newMote(i + Math.floor(this.time * 7), false);
    }
    // drops of living water fall down the column into the pool, more in calm rest
    if (sim.started && !sim.story && sim.restBlock) {
      this.dropT += dt * (0.8 + 1.6 * sim.calmShown);
      const lit = PLACES.filter(p => sim.lit[p]);
      while (this.dropT >= 1 && this.drops.length < 24) {
        this.dropT -= 1;
        const from = lit.length ? lit[Math.floor(Math.random() * lit.length)] : sim.place;
        const y = placeXY(L, from).y;
        this.drops.push({ y, vy: H * 0.05, x: L.fig.cx + (Math.random() - 0.5) * H * 0.012, hue: PLACE[from].hue, from: y });
      }
    }
    const ground = L.fig.top + H * 0.995;
    for (const d of this.drops) {
      d.vy += H * 0.5 * dt;
      d.y += d.vy * dt;
    }
    const keep: Drop[] = [];
    for (const d of this.drops) {
      if (d.y < ground) { keep.push(d); continue; }
      // into the pool: a ripple, a plink, and the drop's number rising beside the water
      this.splashes++;
      this.ripples.push({ t: 0, k: d.big ? 1.35 : 0.6 + 0.4 * Math.random() });
      if (d.label) this.poolFloat(d.label, d.labelColor ?? WATER, 15);
    }
    this.drops = keep;
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < 1.6);
    // the way up: thanks rise from the thanked places like incense, slow gold motes drifting up
    if (sim.started && !sim.story && sim.dir === 'up' && !this.o.reducedMotion) {
      this.incenseT += dt * 3;
      while (this.incenseT >= 1) {
        this.incenseT -= 1;
        const up = PLACES.filter(p => sim.lit[p] & LIT_UP);
        if (!up.length) break;
        const p = up[Math.floor(Math.random() * up.length)];
        const c = placeXY(L, p);
        this.parts.burst(c.x + (Math.random() - 0.5) * H * 0.02, c.y, 1, { color: Math.random() < 0.5 ? GOLD : GOLD_HI, speed: H * 0.03, angle: -Math.PI / 2, spread: 0.6, life: 2.4, size: 1.6, g: -H * 0.03, drag: 0.4, shape: 'dot' });
      }
    }
    // the stream's spray while it flows
    if (sim.stage === 'flow' && !this.o.reducedMotion && Math.random() < dt * 20) {
      const y = this.streamY(sim);
      this.parts.burst(L.fig.cx, y, 1, { color: WATER, speed: H * 0.08, angle: sim.dir === 'down' ? Math.PI / 2 : -Math.PI / 2, spread: 2.4, life: 0.7, size: 1.4, g: H * 0.2, drag: 1.5, shape: 'dot' });
    }
  }

  /** The head of the stream of light: where the light is on its way between places (or coming in). */
  private streamY(sim: RzekiSim): number {
    const L = this.L, H = L.fig.H;
    const at = placeXY(L, sim.place).y;
    if (sim.stage === 'flow') {
      const to = placeXY(L, sim.nextPlace ?? sim.place).y;
      return at + (to - at) * ease.inOutSine(clamp(sim.stageT / RULES.flowSec));
    }
    if (sim.stage === 'enter') {
      const k = ease.inOutSine(clamp(sim.stageT / RULES.heavenSec));
      const from = sim.dir === 'down' ? L.top - H * 0.04 : L.fig.top + H * 1.04;
      return from + (at - from) * k;
    }
    return at;
  }

  // ── drawing ────────────────────────────────────────────────────
  /** Re-bake a window whose craft tier changed (the session's start, or a new tier earned). */
  private syncTiers(sim: RzekiSim): void {
    for (const p of PLACES) {
      const k = sim.tiers[p];
      if (k === this.roseTier[p]) continue;
      this.roseTier[p] = k;
      const r = bakeRose(p, this.roseR, this.dpr, k);
      if (r) this.roses[p] = r;
    }
  }

  draw(sim: RzekiSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.syncTiers(sim);
    const L = this.L, H = L.fig.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.sky) ctx.drawImage(this.sky, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#120c34';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    const rest = sim.restBlock;
    const breathe = rest ? sim.breath.k : this.o.reducedMotion ? 0.5 : 0.5 + 0.12 * Math.sin(this.time * 0.6);
    this.drawTwinkles(ctx);
    this.drawHeaven(ctx, sim);
    this.drawAura(ctx, sim, breathe);
    this.drawGround(ctx, sim);
    // the figure breathes around the chest
    const chest = { x: L.fig.cx + CHEST[0] * H, y: L.fig.top + CHEST[1] * H };
    const s = 1 + (rest ? 0.012 : 0.004) * (breathe - 0.5);
    ctx.save();
    ctx.translate(chest.x, chest.y);
    ctx.scale(s, s);
    ctx.translate(-chest.x, -chest.y);
    if (this.fig) ctx.drawImage(this.fig.c, this.fig.box.x, this.fig.box.y, this.fig.box.w, this.fig.box.h);
    this.drawInnerLight(ctx, sim);
    ctx.restore();
    this.drawColumn(ctx, sim, breathe);
    this.drawThreads(ctx, sim, false);
    this.drawPlaces(ctx, sim, breathe);
    this.drawThreads(ctx, sim, true);
    this.drawStream(ctx, sim);
    this.drawDrops(ctx);
    this.drawMotes(ctx);
    this.parts.draw(ctx);
    this.floats.draw(ctx, `800 ${SANS}`);
    if (this.flash > 0) glow(ctx, GOLD_HI, L.fig.cx, L.fig.top + H * 0.45, H * 0.85, 0.32 * Math.sin(Math.PI * Math.min(1, this.flash)));
    if (sim.blind) this.drawVeil(ctx);
    // the words: the narrator in its own column (or in the band's top row on a phone held upright), the prayer
    const k = sim.story ? 0 : this.captionK;
    if (L.shape !== 'tall') drawCaption(ctx, L, this.lastCaption, k);
    drawPrayer(ctx, L, sim, this.lastDt, { text: this.lastCaption, k });
    this.storyRect = drawStory(ctx, L, sim);
  }

  /** A dozen stars that twinkle slowly (the rest of the sky is baked). */
  private drawTwinkles(ctx: CanvasRenderingContext2D): void {
    const spr = starSprite();
    if (!spr || this.o.reducedMotion) return;
    const L = this.L;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const x = hash(i * 29 + 901) * L.w, y = L.top * 0.4 + hash(i * 31 + 902) * (L.h - L.top * 0.4);
      const k = 0.5 + 0.5 * Math.sin(this.time * (0.5 + hash(i + 903)) + i * 2.1);
      const r = 3 + 5 * k * hash(i + 904);
      ctx.globalAlpha = 0.15 + 0.6 * k * k;
      ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** The open heaven: its rays shine strongest as the light comes down, and breathe softly all along. */
  private drawHeaven(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    if (!this.rays) return;
    const k = this.heavenK;
    const live = sim.dir === 'down' ? 0.35 + 0.25 * (sim.idx === 0 && sim.stage === 'at' ? sim.light : 0.3) : 0.3;
    const a = clamp(live + 0.5 * k) * (0.85 + 0.15 * Math.sin(this.time * 0.7));
    const r = this.raysBox;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.drawImage(this.rays, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // the opening's warmth stays above the head (the head is lit by its own places, never washed white)
    glow(ctx, GOLD_HI, this.L.fig.cx, this.L.top - this.L.fig.H * 0.07, this.L.fig.H * (0.15 + 0.08 * k), 0.12 + 0.25 * k);
  }

  /** The egg of light around the body: it grows with each place lit, deepens with calm, swells with the breath. */
  private drawAura(ctx: CanvasRenderingContext2D, sim: RzekiSim, breathe: number): void {
    const spr = auraSprite();
    if (!spr) return;
    const L = this.L, H = L.fig.H;
    const lit = sim.litCount;
    const grow = 0.86 + 0.02 * lit + 0.03 * breathe;
    const rx = H * 0.33 * grow, ry = H * 0.6 * grow;
    const cy = L.fig.top + H * 0.47;
    const a = clamp(0.32 + 0.07 * lit + (sim.restBlock ? 0.3 * sim.calmShown : 0) + 0.25 * this.flash, 0, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.drawImage(spr, L.fig.cx - rx, cy - ry, 2 * rx, 2 * ry);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * The ground of light under the feet, the pool of living water with its shimmer and ripples, and the two
   * rivers flowing out of it: ribbons of water-light that meander toward the viewer, their edges soft (four
   * widths of light laid over each other), glints riding the current outward, their far ends thinning out.
   */
  private drawGround(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    const L = this.L, H = L.fig.H, cx = L.fig.cx, ground = L.fig.top + H * 1.004;
    const reach = sim.river, t = this.time;
    if (reach > 0.04) {
      ctx.globalCompositeOperation = 'lighter';
      // the rivers come in softly as they first run out of the pool; their glints wait until there is a current
      const fadeIn = clamp((reach - 0.04) / 0.12);
      ctx.globalAlpha = fadeIn;
      this.riverPts.forEach((pts, side) => {
        const last = pts.length - 1;
        const n = Math.max(2, Math.floor(last * reach));
        const c: [number, number][] = [], hw: number[] = [];
        for (let i = 0; i <= n; i++) {
          const u = i / last, v = i / n;
          const [x, y] = pts[i];
          // a slow undulation, larger toward the viewer
          c.push([x, y + Math.sin(u * 13 - t * 0.7 + side * 2) * H * 0.004 * (0.3 + u)]);
          const grow = Math.min(1, v / 0.08), thin = Math.min(1, (1 - v) / 0.24);
          hw.push(H * (0.007 + 0.02 * u) * grow * thin + 0.3);
        }
        for (const [k, col] of RIVER_LAYERS) {
          ctx.fillStyle = col;
          ctx.fill(ribbon(c, hw, k));
        }
        // highlights flowing outward with the current (once the river is long enough to carry them)
        for (let j = 0; n >= 6 && j < 7; j++) {
          const q = (t * (0.05 + 0.011 * j) + j / 7) % 1;
          const fi = q * n, i0 = Math.floor(fi);
          if (i0 >= n) continue;
          const f = fi - i0;
          const x = c[i0][0] + (c[i0 + 1][0] - c[i0][0]) * f, y = c[i0][1] + (c[i0 + 1][1] - c[i0][1]) * f;
          glow(ctx, '#ffffff', x, y, Math.max(2.5, hw[i0] * 1.8), 0.55 * Math.sin(Math.PI * q) * fadeIn);
        }
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // the pool: wider and brighter as the drops gather, a reflection of the column's light in it
    const spr = poolSprite(), col = columnSprite(PEARL);
    const pw = H * (0.36 + 0.14 * reach), ph = H * 0.05;
    ctx.globalCompositeOperation = 'lighter';
    if (spr) {
      ctx.globalAlpha = 0.34 + 0.4 * reach + (sim.restBlock ? 0.12 : 0);
      ctx.drawImage(spr, cx - pw / 2, ground - ph / 2, pw, ph);
    }
    if (col) {
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 1.3);
      ctx.drawImage(col, cx - H * 0.02, ground, H * 0.04, H * 0.05);
    }
    ctx.globalAlpha = 1;
    // a gentle shimmer across the water: short arcs of light that come and go
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = 0.5 + 0.5 * Math.sin(t * (0.9 + 0.3 * i) + i * 2.1);
      ctx.strokeStyle = `rgba(226,248,255,${(0.1 + 0.3 * k).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx + (i - 1) * pw * 0.16, ground + (i - 1) * ph * 0.12, pw * (0.08 + 0.05 * k), ph * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the line of the ground, faint
    const g = ctx.createLinearGradient(cx - H * 0.5, 0, cx + H * 0.5, 0);
    g.addColorStop(0, 'rgba(200,220,255,0)');
    g.addColorStop(0.5, 'rgba(220,230,255,.3)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - H * 0.5, ground - 0.5, H, 1);
    // ripples where the drops land
    for (const r of this.ripples) {
      const k = r.t / 1.6;
      ctx.strokeStyle = `rgba(200,240,255,${(0.55 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, ground, H * (0.02 + 0.13 * k * r.k), H * (0.005 + 0.02 * k * r.k), 0, 0, TAU);
      ctx.stroke();
    }
  }

  /**
   * Inside the body: the body slowly fills with light from its lit places, each in its own colour (the head's
   * kept soft, so its three windows stay apart), a warm wash when it is nearly all lit; and the body around the
   * current place warms with its light.
   */
  private drawInnerLight(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    const L = this.L, H = L.fig.H;
    const whole = sim.stage === 'whole' ? 1 : 0;
    const calm = sim.restBlock ? sim.calmShown : 0;
    if (this.fig) {
      ctx.save();
      ctx.clip(this.fig.clip);
      for (const p of PLACES) {
        if (!sim.lit[p]) continue;
        const c = placeXY(L, p);
        const head = PLACE[p].y < 0.2;
        bloom(ctx, PLACE[p].hue, c.x, c.y, H * (head ? 0.12 : 0.3), (head ? 0.08 : 0.17) + 0.08 * calm + 0.12 * this.flash);
      }
      const fillK = sim.litCount / PLACES.length;
      const wash = Math.max(whole, (fillK - 0.5) * 2);
      if (wash > 0) bloom(ctx, GOLD_HI, L.fig.cx, L.fig.top + H * 0.58, H * 0.55, 0.06 + 0.12 * wash + 0.18 * this.flash);
      ctx.restore();
    }
    if (sim.stage === 'at' || sim.stage === 'hold') {
      const c = placeXY(L, sim.place);
      const light = sim.blind ? RULES.baseLight : sim.light;
      const head = PLACE[sim.place].y < 0.2;
      glow(ctx, PLACE[sim.place].hue, c.x, c.y, H * (head ? 0.08 + 0.04 * light : 0.12 + 0.12 * light + 0.05 * sim.fill), 0.1 + 0.25 * light);
    }
  }

  /** The column of light along the midline: faint all the way, bright where the light has come. */
  private drawColumn(ctx: CanvasRenderingContext2D, sim: RzekiSim, breathe: number): void {
    const L = this.L, H = L.fig.H, cx = L.fig.cx;
    const pearl = columnSprite(PEARL), gold = columnSprite(GOLD_HI);
    if (!pearl || !gold) return;
    const crown = L.fig.top + PLACE.mind.y * H, feet = L.fig.top + PLACE.feet.y * H;
    const w = H * 0.05 * (0.9 + 0.2 * breathe);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2;
    ctx.drawImage(pearl, cx - w / 2, crown, w, feet - crown);
    // the lit stretch: from heaven to the light (down), from the feet to the light (up), the whole when whole
    const y = this.streamY(sim);
    let y0: number, y1: number;
    if (sim.stage === 'whole') { y0 = L.top; y1 = feet; }
    else if (sim.dir === 'down') { y0 = L.top; y1 = y; }
    else { y0 = y; y1 = feet; }
    if (y1 > y0 + 1) {
      const lightK = sim.blind ? 0.4 : clamp(sim.light);
      ctx.globalAlpha = clamp(0.45 + 0.35 * lightK + (sim.restBlock ? 0.15 * breathe : 0));
      ctx.drawImage(sim.dir === 'up' ? gold : pearl, cx - w * 0.6, y0, w * 1.2, y1 - y0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * The two threads, gold and silver, spiralling along the lit stretch of the column (their back halves under
   * the places, their front halves over them): the spiral runs down as the light is received and up as thanks
   * rise, slowly in rest, fast while the stream flows.
   */
  private drawThreads(ctx: CanvasRenderingContext2D, sim: RzekiSim, front: boolean): void {
    if (!sim.started) return;
    const L = this.L, H = L.fig.H, cx = L.fig.cx;
    const crown = L.fig.top + PLACE.mind.y * H, feet = L.fig.top + PLACE.feet.y * H;
    const y = this.streamY(sim);
    let y0: number, y1: number;
    if (sim.stage === 'whole') { y0 = crown; y1 = feet; }
    else if (sim.dir === 'down') { y0 = Math.min(crown, y); y1 = y; }
    else { y0 = y; y1 = feet; }
    if (y1 - y0 < 4) return;
    const speed = sim.stage === 'flow' ? 1.6 : sim.restBlock ? 0.25 : 0.55;
    const phase = (sim.dir === 'down' ? -1 : 1) * this.time * TAU * speed;
    const lam = H * 0.12;
    const A = H * (0.024 + (sim.restBlock ? 0.006 * sim.breath.k : 0));
    for (const side of [1, -1]) {
      const path = new Path2D();
      let open = false;
      for (let yy = y0; yy <= y1 + 0.1; yy += 3) {
        const th = (TAU * (yy - y0)) / lam + phase;
        const taper = clamp((yy - y0) / (H * 0.03)) * clamp((y1 - yy) / (H * 0.03));
        const x = cx + side * A * taper * Math.sin(th);
        const z = side * Math.cos(th);
        if ((z > 0) === front) {
          if (!open) { path.moveTo(x, yy); open = true; } else path.lineTo(x, yy);
        } else open = false;
      }
      const hue = side > 0 ? GOLD : SILVER;
      ctx.lineCap = 'round';
      if (front) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `${rgbaPrefix(hue)}.22)`;
        ctx.lineWidth = Math.max(3, H * 0.012);
        ctx.stroke(path);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `${rgbaPrefix(hue)}.95)`;
        ctx.lineWidth = Math.max(1.2, H * 0.004);
        ctx.stroke(path);
      } else {
        ctx.strokeStyle = `${rgbaPrefix(hue)}.32)`;
        ctx.lineWidth = Math.max(0.8, H * 0.0028);
        ctx.stroke(path);
      }
    }
  }

  /** The seven places: waiting orbs, small lit windows (gold-ringed when thanked), and the current place's window. */
  private drawPlaces(ctx: CanvasRenderingContext2D, sim: RzekiSim, breathe: number): void {
    const L = this.L;
    const current = sim.stage === 'at' || sim.stage === 'hold' ? sim.place : null;
    for (const p of PLACES) {
      if (p === current) continue;
      const c = placeXY(L, p), hue = PLACE[p].hue;
      if (sim.lit[p]) {
        // a jewel of light: its colour blooming onto the body, the glass lit from behind, a white-hot core
        const r = litR(L) * (1 + 0.05 * breathe);
        const head = PLACE[p].y < 0.2;
        bloom(ctx, hue, c.x, c.y, r * (head ? 2.8 : 3.6), (head ? 0.32 : 0.46) + 0.14 * breathe + 0.2 * this.flash);
        this.drawWindow(ctx, p, c.x, c.y, r, 1, 1, 0.28);
        glow(ctx, '#ffffff', c.x, c.y, r * 0.5, 0.26 + 0.1 * breathe);
        if (sim.lit[p] & LIT_UP) {
          ctx.strokeStyle = 'rgba(255,217,138,.85)';
          ctx.lineWidth = Math.max(1, L.fig.H * 0.003);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r * 1.28, 0, TAU);
          ctx.stroke();
          glow(ctx, GOLD, c.x, c.y, r * 2, 0.2);
        }
      } else {
        const r = idleR(L);
        const mem = sim.memory[p] ? 0.12 : 0;
        glow(ctx, hue, c.x, c.y, r * 3.4, 0.2 + mem);
        ctx.fillStyle = `${rgbaPrefix(hue)}${(0.55 + mem).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * 0.55, 0, TAU);
        ctx.fill();
      }
    }
    if (current) this.drawCurrent(ctx, sim, current);
  }

  /**
   * The current place: a halo whose size is the light (the gauge on the place itself), the threshold as a faint
   * ring the halo passes to turn gold, and the rose window opening petal by petal with the place's fill.
   */
  private drawCurrent(ctx: CanvasRenderingContext2D, sim: RzekiSim, p: PlaceId): void {
    const L = this.L, H = L.fig.H;
    const c = placeXY(L, p), hue = PLACE[p].hue;
    const R = windowR(L, sim.fill) * (1 + 0.1 * Math.sin(Math.PI * this.pop));
    const blind = sim.blind;
    const light = blind ? RULES.baseLight : sim.light;
    // the halo: its visible edge at R × (1 + 1.2 × light); the threshold ring where the light is 0.5
    const edge = R * (1 + 1.2 * light);
    glow(ctx, hue, c.x, c.y, edge / 0.55, 0.3 + 0.45 * light);
    if (!blind && sim.goldOn) glow(ctx, GOLD, c.x, c.y, edge / 0.6, 0.25 + 0.6 * (light - RULES.gold));
    bloom(ctx, mix(hue, '#ffffff', 0.35), c.x, c.y, R * 1.9, 0.18 + 0.35 * sim.fill);
    if (sim.pushBlock && !blind) {
      const th = R * (1 + 1.2 * RULES.gold);
      ctx.save();
      ctx.lineWidth = Math.max(1, H * 0.003);
      if (sim.goldOn) {
        ctx.strokeStyle = 'rgba(255,217,138,.7)';
      } else {
        ctx.setLineDash([Math.max(2, H * 0.008), Math.max(3, H * 0.012)]);
        ctx.lineDashOffset = this.time * H * 0.01;
        ctx.strokeStyle = 'rgba(236,232,255,.34)';
      }
      ctx.beginPath();
      ctx.arc(c.x, c.y, th, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    this.drawWindow(ctx, p, c.x, c.y, R, sim.fill, blind ? 0.7 : 1, blind ? 0.1 : 0.26);
    glow(ctx, '#ffffff', c.x, c.y, R * (0.3 + 0.2 * sim.fill), 0.24 + 0.26 * sim.fill);
  }

  /**
   * A rose window at (x, y) of radius R, open to `fill` (the tracery waits for the rest); `shine` adds its open
   * glass once more additively — the light coming through it from behind.
   */
  private drawWindow(ctx: CanvasRenderingContext2D, p: PlaceId, x: number, y: number, R: number, fill: number, alpha: number, shine = 0): void {
    const rose = this.roses[p];
    if (!rose) {
      glow(ctx, PLACE[p].hue, x, y, R, alpha);
      return;
    }
    const k = R / rose.R, half = rose.half;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.globalAlpha = alpha;
    if (fill >= 1) {
      ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
      if (shine > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * shine;
        ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
      }
      ctx.restore();
      return;
    }
    ctx.drawImage(rose.lead, -half, -half, 2 * half, 2 * half);
    // the glass open so far: the whole petals (cached by count), then the petal filling now
    const o = openness(PLACE[p].rose, fill);
    const key = `${p}|${rose.R}|${Math.floor(o.inner + 1e-9)}|${Math.floor(o.outer + 1e-9)}|${o.oculus > 0 ? 1 : 0}`;
    if (key !== this.openKey || !this.openFull) {
      this.openKey = key;
      this.openFull = fullPath(PLACE[p].rose, rose.R, fill);
    }
    ctx.save();
    ctx.clip(this.openFull);
    ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
    if (shine > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * shine;
      ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
    }
    ctx.restore();
    const part = partPath(PLACE[p].rose, rose.R, fill);
    if (part) {
      ctx.save();
      ctx.clip(part);
      ctx.globalAlpha = alpha * 0.9;
      ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
      ctx.restore();
    }
    ctx.restore();
  }

  /** The stream of living water on its way: a bright head with a soft spray. */
  private drawStream(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    if (sim.stage !== 'flow' && sim.stage !== 'enter') return;
    const L = this.L, H = L.fig.H;
    const y = this.streamY(sim);
    glow(ctx, WATER, L.fig.cx, y, H * 0.07, 0.75);
    glow(ctx, '#ffffff', L.fig.cx, y, H * 0.025, 0.9);
    if (sim.stage === 'enter' && sim.dir === 'down') glow(ctx, GOLD_HI, L.fig.cx, y, H * 0.12, 0.35);
  }

  private drawDrops(ctx: CanvasRenderingContext2D): void {
    const spr = glowSprite(WATER);
    if (!spr || !this.drops.length) return;
    const H = this.L.fig.H;
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.drops) {
      if (d.big) {
        // a place's drop: its own colour around a bright core, a little trail of light above it
        const r = Math.max(3, H * 0.02);
        const hs = glowSprite(d.hue);
        if (hs) {
          ctx.globalAlpha = 0.9;
          ctx.drawImage(hs, d.x - r * 1.4, d.y - r * 2.2, 2.8 * r, 3.4 * r);
          ctx.globalAlpha = 0.35;
          ctx.drawImage(hs, d.x - r * 0.6, d.y - r * 4.6, 1.2 * r, 3.6 * r);
        }
        ctx.globalAlpha = 0.95;
        ctx.drawImage(spr, d.x - r * 0.5, d.y - r * 0.7, r, 1.4 * r);
        continue;
      }
      const r = Math.max(2, H * 0.011);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(spr, d.x - r, d.y - r * 1.3, 2 * r, 2.6 * r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawMotes(ctx: CanvasRenderingContext2D): void {
    const spr = glowSprite(PEARL);
    if (!spr) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.ph * 1.7));
      const r = m.r * 2.2;
      ctx.drawImage(spr, m.x - r, m.y - r, 2 * r, 2 * r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** A blind block: a soft veil of night over the figure (the light gathers unseen). */
  private drawVeil(ctx: CanvasRenderingContext2D): void {
    const L = this.L;
    ctx.fillStyle = 'rgba(6,4,22,.32)';
    ctx.fillRect(0, L.top, L.w, L.prayer.y - L.top);
  }

  /** Every control the player can tap now (a story card, or the current place's circle), for the audit. */
  targets(sim: RzekiSim): TapTarget[] {
    if (!sim.started) return [];
    const place = sim.stage === 'flow' ? sim.nextPlace : sim.stage === 'whole' ? null : sim.place;
    return tapTargets(this.L, { story: sim.story ? (this.storyRect ?? this.L.story) : null, place, fill: sim.stage === 'at' || sim.stage === 'hold' ? sim.fill : 0 });
  }
}

/** The rivers' layers of light: (width × the ribbon's half-width, colour), widest and faintest first. */
const RIVER_LAYERS: readonly (readonly [number, string])[] = [
  [2.6, 'rgba(100,180,255,.06)'], [1.7, 'rgba(130,210,255,.1)'], [1, 'rgba(180,236,255,.2)'], [0.38, 'rgba(240,252,255,.3)'],
];

/** A ribbon along a centreline with a half-width at each point (× k): its left edge forward, its right edge back. */
function ribbon(c: readonly (readonly [number, number])[], hw: readonly number[], k: number): Path2D {
  const p = new Path2D();
  const n = c.length - 1;
  const side = (i: number, sgn: number): [number, number] => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], len = Math.hypot(tx, ty) || 1;
    return [c[i][0] - (ty / len) * hw[i] * k * sgn, c[i][1] + (tx / len) * hw[i] * k * sgn];
  };
  const [x0, y0] = side(0, 1);
  p.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) p.lineTo(...side(i, 1));
  for (let i = n; i >= 0; i--) p.lineTo(...side(i, -1));
  p.closePath();
  return p;
}
