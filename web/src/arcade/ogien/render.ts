/**
 * Ogień, ogień, ogień's view: the scene of the current fire (its backdrop cached, its live layers each
 * frame), the change between two fires — a flare, a soft white-out, the camera pulling back by orders of
 * magnitude ("Powers of Ten": the old world shrinks into the new fire's heart), the new fire igniting, its
 * name and verse; for Pentecost the camera comes down from the sky instead, and a new round zooms into one
 * flame that becomes the next spark — and the signal drawn on the fire itself:
 *
 *   the ring          the fire's charge: gold, filling clockwise from the top; the light banked in rest a
 *                     pale arc after it; a spark at its tip, sparks flying to it from the fire while focus
 *                     charges it
 *   the heat circle   in a push, a circle round the fire whose radius is the heat (the eased level), with the
 *                     threshold as a dashed circle: past it the circle turns gold and the ring fills
 *   the breath        in rest the circle breathes 4 in / 6 out, and the words say which
 *   the smoke         a blind block veils the ring and the heat; it lifts at the block's end
 *
 * Around them: the ladder of seven down the left edge, the scale's button and the bonfire's pile in the thumb
 * zone, Ignacy's bubble under the HUD, the cards.  No shadowBlur, no filters: light is baked sprites.
 */
import { ease } from '../kit/juice';
import { layoutPassage, drawPassage, passage, type PassageLayout } from '../kit/scripture';
import type { Insets } from '../kit/types';
import { RUNGS, actName, powText, rungName, scaleName, variantName } from './content';
import { t } from './i18n';
import { layout, type Layout, type Rect } from './layout';
import { CREAM, GOLD, GOLD_HI, TAU, clamp01, drawFlame, drawGlow, fitFont, font, fontPx, label, paintIgnacy, roundRect, wrap } from './paint';
import { RULES } from './rules';
import { ICON_PAL, SCENES, type Geo, type Live } from './scenes';
import type { CoachAt, OgienSim, SimEvent } from './sim';

/** a spark, an ember, a mote of light, a puff of breath or smoke, a spark flying to the ring */
interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: 0 | 1 | 2 | 3 | 4 | 5; rgb: readonly number[]; tx: number; ty: number }
const SPARK = 0, MOTE = 2, PUFF = 3, SMOKE = 4, HOME = 5;
const MOTE_CAP = 240;

interface Trans { t: number; from: { rung: number; variant: number }; to: { rung: number; variant: number }; kind: 'zoom' | 'descend' | 'cycle' }

export interface Drag { x: number; y: number; lift: number; moved: boolean; sx: number; sy: number }

export type Hit = { kind: 'card' } | { kind: 'btn' } | { kind: 'pile' } | { kind: 'field'; x: number; y: number };

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; size: number }

/**
 * Words that pop, rise and fade ("Osłonięta!", "+ polano") — like the kit's floaters, but the pop starts at
 * three quarters of the size, so a word is never drawn under the 11 px floor, not even for a frame.
 */
class Floats {
  readonly items: Float[] = [];

  add(text: string, x: number, y: number, o: { color?: string; size?: number; dur?: number } = {}): void {
    this.items.push({ text, x, y, t: 0, dur: o.dur ?? 1.1, color: o.color ?? '#fff', size: Math.max(13, o.size ?? 18) });
    if (this.items.length > 8) this.items.shift();
  }

  update(dt: number): void {
    for (const f of this.items) f.t += dt;
    while (this.items.length && this.items[0].t >= this.items[0].dur) this.items.shift();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const f of this.items) {
      const k = f.t / f.dur;
      const pop = k < 0.18 ? 0.75 + 0.25 * ease.outBack(k / 0.18) : 1;
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      label(ctx, f.text, f.x, f.y - 46 * ease.outCubic(k), Math.max(13, f.size * pop), f.color, 'center', 800);
    }
    ctx.globalAlpha = 1;
  }
}

export class OgienView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private readonly cache = new Map<string, HTMLCanvasElement | null>();
  private clock = 0;
  private readonly motes: Mote[] = [];
  readonly floaters = new Floats();
  // what the fire shows, eased
  private heat = 0.5;
  private ring = 0;
  private light = 0;
  private glow = 0.4;
  private bend = 0;
  private warn = 0;
  private shield = 0;
  private flare = 0;
  private veil = 0;
  private breathK = 0;
  private sparkT = 0;
  private homeT = 0;
  private trans: Trans | null = null;
  private ripples: { x: number; y: number; t: number }[] = [];
  private trail: { x: number; y: number; t: number }[] = [];
  private tickFlash = 0;
  private btnDown = 0;
  /** hit-stop: the world holds its breath for a moment at the change's flare */
  private freeze = 0;
  /** a log in the finger's hand (the bonfire) */
  drag: Drag | null = null;
  pressed = false;
  private passageCache: { key: string; lay: PassageLayout; h: number } | null = null;
  cardBox: Rect | null = null;
  /** how far the last card's words would run past its box (px; 0 = they fit), for the tests */
  cardOverflow = 0;
  private coachRing: { at: CoachAt; until: number } | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640);
  }

  resize(w: number, h: number, dpr: number, insets: Insets): void {
    this.L = layout(w, h, insets);
    this.dpr = dpr;
    this.cache.clear();
    this.passageCache = null;
  }

  private geo(): Geo {
    const L = this.L;
    return { w: L.w, h: L.h, cx: L.cx, cy: L.cy, R: L.R, top: L.top, bottom: L.bottom, u: L.u, dpr: this.dpr };
  }

  /** A scene's backdrop at this size, painted once. */
  private back(rung: number, variant: number): HTMLCanvasElement | null {
    const key = `${rung}:${variant}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    // the current world, the next and one before: a full-screen canvas each, so no more
    if (this.cache.size > 2) this.cache.delete(this.cache.keys().next().value as string);
    let c: HTMLCanvasElement | null = null;
    if (typeof document !== 'undefined') {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(this.L.w * this.dpr));
      c.height = Math.max(1, Math.round(this.L.h * this.dpr));
      const g = c.getContext('2d');
      if (g) {
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        SCENES[rung].back(g, this.geo(), variant);
      } else c = null;
    }
    this.cache.set(key, c);
    return c;
  }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, sim: OgienSim): void {
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.trans) this.trans.t += dt * 0.15;
      return;
    }
    this.clock += dt;
    const L = this.L;
    const rest = sim.restBlock, blind = sim.blind;
    const heatWant = blind ? 0.5 : sim.heat;
    this.heat += (heatWant - this.heat) * (1 - Math.exp(-dt / 0.25));
    if (!this.trans || this.trans.t >= RULES.changeSec * 0.62) this.ring += (sim.ring - this.ring) * (1 - Math.exp(-dt / 0.22));
    this.light += (sim.light - this.light) * (1 - Math.exp(-dt / 0.3));
    this.veil += ((blind ? 1 : 0) - this.veil) * (1 - Math.exp(-dt / 0.5));
    this.breathK = rest ? sim.breath.k : this.breathK * Math.exp(-dt / 0.6);
    const glowWant = rest ? 0.35 + 0.45 * sim.calmShown + 0.1 * this.breathK : clamp01(0.22 + 0.5 * this.heat + 0.32 * this.ring + 0.2 * this.flare);
    this.glow += (glowWant - this.glow) * (1 - Math.exp(-dt / 0.35));
    this.flare = Math.max(0, this.flare - dt * 1.6);
    this.tickFlash = Math.max(0, this.tickFlash - dt * 2.5);
    this.btnDown = Math.max(0, this.btnDown - dt * 5);
    // the candle: the draught bends the flame, the hands come up
    const g = sim.gust;
    const blowing = sim.task === 'shield' && g.phase === 'blow';
    const bendWant = blowing ? g.side * (sim.shielding ? 0.12 : 0.85) : 0;
    this.bend += (bendWant - this.bend) * (1 - Math.exp(-dt / (blowing ? 0.12 : 0.35)));
    this.warn += ((sim.task === 'shield' && g.phase === 'tele' ? 1 : 0) - this.warn) * (1 - Math.exp(-dt / 0.3));
    this.shield += ((sim.task === 'shield' && sim.shielding ? 1 : 0) - this.shield) * (1 - Math.exp(-dt / 0.12));
    if (this.trans) {
      this.trans.t += dt;
      if (this.trans.t >= RULES.changeSec) this.trans = null;
    }
    // sparks rise from an earth fire, motes drift from a star; sparks fly to the ring while focus charges it
    const scene = SCENES[sim.rung];
    const live = sim.live && !blind;
    const k = live ? Math.max(0, (this.heat - 0.5) * 2) : 0;
    const rate = rest ? 1.5 : (scene.earth ? 3 + 16 * Math.max(0, this.heat - 0.4) + 9 * this.ring : 1.5 + 6 * k + 3 * this.ring);
    this.sparkT += dt * rate * (this.opts.reducedMotion ? 0.6 : 1);
    while (this.sparkT >= 1) {
      this.sparkT -= 1;
      this.emitSpark(sim);
    }
    if (k > 0.02) {
      this.homeT += dt * (2 + 9 * k);
      while (this.homeT >= 1) {
        this.homeT -= 1;
        this.emitHome();
      }
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.life -= dt;
      if (m.life <= 0) {
        this.motes[i] = this.motes[this.motes.length - 1];
        this.motes.pop();
        continue;
      }
      if (m.kind === HOME) {
        const q = 1 - m.life / m.max;
        const e = q * q;
        m.x += (m.tx - m.x) * Math.min(1, dt * 6 * (0.3 + e));
        m.y += (m.ty - m.y) * Math.min(1, dt * 6 * (0.3 + e));
        m.y -= Math.sin(q * Math.PI) * dt * L.R * 0.6;
        continue;
      }
      const drag = m.kind === SPARK ? 0.6 : m.kind === PUFF ? 2.4 : 0.3;
      m.vx *= Math.exp(-drag * dt);
      m.vy *= Math.exp(-drag * dt);
      if (m.kind === SPARK) m.vx += Math.sin(this.clock * 3 + m.y * 0.05) * L.R * 0.4 * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    this.floaters.update(dt);
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].t += dt;
      if (this.ripples[i].t > 0.9) this.ripples.splice(i, 1);
    }
    while (this.trail.length && this.clock - this.trail[0].t > 0.5) this.trail.shift();
  }

  private push(m: Omit<Mote, 'tx' | 'ty'> & Partial<Pick<Mote, 'tx' | 'ty'>>): void {
    if (this.motes.length >= MOTE_CAP) return;
    this.motes.push({ tx: 0, ty: 0, ...m });
  }

  /** Where the fire's sparks start, by scene (px). */
  private sparkFrom(rung: number): { x: number; y: number; spread: number } {
    const L = this.L, R = L.R;
    switch (rung) {
      case 0: return { x: L.cx, y: L.cy + R * 0.02, spread: R * 0.08 };
      case 1: return { x: L.cx, y: L.cy - R * 0.3, spread: R * 0.04 };
      case 2: return { x: L.cx, y: L.cy - R * 0.25, spread: R * 0.35 };
      case 3: return { x: L.cx, y: L.cy + R * 0.3, spread: R * 0.4 };
      default: return { x: L.cx, y: L.cy, spread: R * 0.5 };
    }
  }

  private emitSpark(sim: OgienSim): void {
    const L = this.L, R = L.R, sc = SCENES[sim.rung];
    const f = this.sparkFrom(sim.rung);
    const r = Math.random;
    if (sc.earth) {
      const up = R * (0.5 + 0.9 * r()) * (0.7 + 0.6 * this.heat) * (sim.rung === 1 ? 0.5 : 1);
      this.push({ x: f.x + (r() - 0.5) * f.spread, y: f.y, vx: (r() - 0.5) * R * 0.3, vy: -up, life: 0.8 + r() * 1.2, max: 2, size: R * (0.012 + r() * 0.02), kind: SPARK, rgb: r() < 0.7 ? [255, 180, 80] : [255, 230, 150] });
    } else {
      const a = r() * TAU, rr = R * (0.55 + r() * 0.2);
      this.push({ x: L.cx + Math.cos(a) * rr, y: L.cy + Math.sin(a) * rr, vx: Math.cos(a) * R * 0.18, vy: Math.sin(a) * R * 0.18, life: 1.5 + r() * 1.5, max: 3, size: R * (0.015 + r() * 0.02), kind: MOTE, rgb: sc.light });
    }
  }

  /** A spark flying from the fire to the ring's tip: focus charging it, in sight. */
  private emitHome(): void {
    const L = this.L, R = L.R;
    const a = -Math.PI / 2 + this.ring * TAU;
    const r = Math.random;
    this.push({ x: L.cx + (r() - 0.5) * R * 0.3, y: L.cy - R * 0.1, vx: 0, vy: 0, life: 0.7, max: 0.7, size: R * 0.03, kind: HOME, rgb: [255, 214, 120], tx: L.cx + Math.cos(a) * R, ty: L.cy + Math.sin(a) * R });
  }

  /** A burst at a spot (px). */
  burst(x: number, y: number, n: number, rgb: readonly number[], speed = 1): void {
    const R = this.L.R, r = Math.random;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, s = R * (0.3 + r() * 0.9) * speed;
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - R * 0.3, life: 0.5 + r() * 0.7, max: 1.2, size: R * (0.012 + r() * 0.022), kind: SPARK, rgb });
    }
  }

  /** A sim event's picture. */
  on(e: SimEvent, sim: OgienSim): void {
    const L = this.L, R = L.R;
    const U = (x: number, y: number) => ({ x: L.cx + x * R, y: L.cy + y * R });
    switch (e.type) {
      case 'puff': {
        // a breath from below, streaks converging on the ember
        for (let i = 0; i < 5; i++) {
          const x = L.cx + (i - 2) * R * 0.22, y = L.cy + R * (1.1 + Math.random() * 0.2);
          this.push({ x, y, vx: (L.cx - x) * 1.6, vy: -R * 1.9, life: 0.45, max: 0.45, size: R * 0.09, kind: PUFF, rgb: [220, 232, 255] });
        }
        this.flare = Math.min(1, this.flare + 0.25);
        break;
      }
      case 'task': {
        const p = U(e.x, e.y);
        const big = e.kind === 'feed' || e.kind === 'shield' || e.kind === 'pass' || e.kind === 'fuse';
        this.burst(p.x, p.y, big ? 16 : 6, SCENES[sim.rung].light, big ? 1.2 : 0.7);
        this.flare = Math.min(1, this.flare + (big ? 0.6 : 0.25));
        const word: Partial<Record<string, string>> = { feed: t('fx.log'), shield: t('fx.shielded'), tents: t('fx.lamp'), fuse: t('fx.fuse'), gather: t('fx.gas'), pass: t('fx.pass') };
        const w = word[e.kind];
        if (w) this.floaters.add(w, p.x, p.y - R * 0.25, { color: GOLD_HI, size: Math.round(16 * L.u), dur: 1.1 });
        break;
      }
      case 'ripple': {
        const p = U(e.x, e.y);
        this.ripples.push({ x: p.x, y: p.y, t: 0 });
        break;
      }
      case 'gust':
        if (!e.shielded) this.burst(L.cx, L.cy - R * 0.4, 5, [255, 200, 120], 0.6);
        break;
      case 'tongue':
        this.flare = Math.min(1, this.flare + 0.2);
        break;
      case 'arrive': {
        const f = sim.figures[e.i];
        if (f) this.burst(L.cx + f.x * R, L.cy + (f.y - f.h) * R, 8, [255, 220, 140], 0.6);
        break;
      }
      case 'change': {
        this.trans = {
          t: 0, from: { rung: e.from, variant: e.fromVariant }, to: { rung: e.to, variant: e.variant },
          kind: e.to === 0 && e.from === RUNGS.length - 1 ? 'cycle' : e.to === RUNGS.length - 1 ? 'descend' : 'zoom',
        };
        this.ring = 1;
        this.freeze = this.opts.reducedMotion ? 0 : 0.09;
        this.burst(L.cx, L.cy, 40, [255, 236, 180], 1.8);
        this.floaters.add(t('fx.full'), L.cx, L.cy - R * 0.6, { color: GOLD_HI, size: Math.round(22 * L.u), dur: 1.3 });
        // the next backdrop now, before the zoom needs it
        this.back(e.to, e.variant);
        break;
      }
      case 'tick':
        this.tickFlash = 1;
        break;
      case 'bonus':
        this.floaters.add(t('fx.bonus'), L.cx, L.cy - R * 0.95, { color: GOLD_HI, size: Math.round(17 * L.u), dur: 1.6 });
        this.flare = Math.min(1, this.flare + 0.5);
        break;
      case 'ember':
        this.floaters.add(t('fx.ember'), L.cx, L.cy + R * 0.7, { color: '#ffb070', size: Math.round(16 * L.u), dur: 1.6 });
        break;
      case 'pour':
        this.floaters.add(t('fx.light'), L.cx + R * 0.75, L.cy - R * 0.85, { color: '#e6efff', size: Math.round(16 * L.u), dur: 1.4 });
        break;
      case 'reveal':
        this.burst(L.cx, L.cy - R, 14, [230, 230, 240], 0.8);
        break;
      case 'record':
        this.floaters.add(t('fx.record'), L.cx, L.cy - R * 1.05, { color: GOLD_HI, size: Math.round(20 * L.u), dur: 1.8 });
        this.burst(L.cx, L.cy - R, 20, [255, 230, 150], 1.2);
        break;
      default:
        break;
    }
  }

  /** The finger's path through the nebula (a faint trail of light). */
  trailAt(x: number, y: number): void {
    this.trail.push({ x, y, t: this.clock });
    if (this.trail.length > 24) this.trail.shift();
  }

  pressButton(): void { this.btnDown = 1; }

  /** A first-time explanation about a control: the control itself glows for a while. */
  coachGlow(at: CoachAt, ms: number): void { this.coachRing = { at, until: this.clock + ms / 1000 }; }

  // ── hits ────────────────────────────────────────────────────────
  hit(x: number, y: number, sim: OgienSim): Hit {
    const L = this.L;
    if (this.cardBox && this.cardShown(sim) && inside(this.cardBox, x, y)) return { kind: 'card' };
    if (inside(L.btn, x, y)) return { kind: 'btn' };
    if (sim.task === 'feed' && inside(L.pile, x, y)) return { kind: 'pile' };
    return { kind: 'field', x: (x - L.cx) / L.R, y: (y - L.cy) / L.R };
  }

  /** Whether the card is on screen now (it waits for the change's picture). */
  cardShown(sim: OgienSim): boolean {
    const c = sim.card;
    if (!c) return false;
    if (c.kind === 'open') return true;
    return !this.trans || this.trans.t >= RULES.changeSec * 0.62;
  }

  /** Where a coach mark points (CSS px). */
  pointFor(at: CoachAt): { x: number; y: number } | null {
    const L = this.L;
    if (!at) return null;
    switch (at.kind) {
      case 'fire': return { x: L.cx, y: L.cy - L.R - 8 * L.u };
      case 'ring': return { x: L.cx + L.R * 0.71, y: L.cy - L.R * 0.71 };
      case 'button': return { x: L.btn.x + L.btn.w / 2, y: L.btn.y };
      case 'pile': return { x: L.pile.x + L.pile.w / 2, y: L.pile.y };
      case 'unit': return { x: L.cx + at.x * L.R, y: L.cy + at.y * L.R };
    }
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: OgienSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const tr = this.trans;
    if (tr) this.drawChange(ctx, sim, tr);
    else this.drawScene(ctx, sim, sim.rung, sim.variant, 1, true);
    this.drawMotes(ctx);
    this.drawRipples(ctx);
    this.drawGauge(ctx, sim);
    this.drawLadder(ctx, sim);
    if (sim.task === 'feed' && sim.handsOn) this.drawPile(ctx, sim);
    this.drawButton(ctx, sim);
    if (this.drag) this.drawDraggedLog(ctx);
    this.floaters.draw(ctx);
    this.drawBubble(ctx, sim);
    this.drawCard(ctx, sim);
    if (tr) this.drawPowers(ctx, tr);
  }

  /** The live state the scene's layers draw from. */
  private live(sim: OgienSim, grow: number, variant: number): Live {
    const rest = sim.restBlock;
    return {
      t: this.clock, heat: this.heat, charge: this.ring, glow: this.glow, grow,
      energy: rest ? 0.2 : sim.phase === 'play' && sim.block.kind === 'warmup' ? 0.5 : 0.3 + 0.9 * Math.max(0, this.heat - 0.3),
      rest, breath: this.breathK, calm: sim.calmShown, bend: this.bend, warn: this.warn, shield: this.shield, flare: this.flare,
      variant, reduced: this.opts.reducedMotion, sim,
    };
  }

  private drawScene(ctx: CanvasRenderingContext2D, sim: OgienSim, rung: number, variant: number, grow: number, withOver: boolean): void {
    const L = this.L, g = this.geo(), sc = SCENES[rung];
    const img = this.back(rung, variant);
    if (img) ctx.drawImage(img, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#120a10';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    const lv = this.live(sim, grow, variant);
    ctx.globalCompositeOperation = 'lighter';
    sc.under(ctx, g, lv);
    ctx.globalCompositeOperation = 'source-over';
    sc.fire(ctx, g, lv);
    if (withOver) sc.over(ctx, g, lv);
  }

  /** The change: flare, white-out, the zoom (or the descent, or the dive into one flame), the ignition. */
  private drawChange(ctx: CanvasRenderingContext2D, sim: OgienSim, tr: Trans): void {
    const L = this.L;
    const T = clamp01(tr.t / RULES.changeSec);
    const reduced = this.opts.reducedMotion;
    const fx = L.cx, fy = L.cy;
    const A = 0.18, B = 0.62;
    let white: number;
    if (reduced) {
      // a soft cross-fade, no motion, no flash
      const k = clamp01((T - 0.1) / 0.6);
      ctx.globalAlpha = 1;
      this.drawScene(ctx, sim, tr.from.rung, tr.from.variant, 1, false);
      ctx.globalAlpha = ease.inOutSine(k);
      this.drawScene(ctx, sim, tr.to.rung, tr.to.variant, 0.6 + 0.4 * k, k > 0.5);
      ctx.globalAlpha = 1;
      white = 0.35 * Math.sin(Math.min(1, T * 1.4) * Math.PI);
    } else if (T < A) {
      const e = ease.outCubic(T / A);
      this.drawScene(ctx, sim, tr.from.rung, tr.from.variant, 1 + 0.6 * e, false);
      white = 0.78 * e;
    } else if (T < B) {
      const z = ease.inOutSine((T - A) / (B - A));
      if (tr.kind === 'descend') {
        // the camera comes down from the sky: the new world slides in from above, the old one shrinks to a point
        ctx.save();
        ctx.translate(0, -(1 - z) * L.h * 0.85);
        this.drawScene(ctx, sim, tr.to.rung, tr.to.variant, 0.4 + 0.3 * z, false);
        ctx.restore();
        ctx.save();
        const s = Math.max(0.02, 1 - z);
        ctx.translate(fx, fy - z * L.h * 0.3);
        ctx.scale(s, s);
        ctx.translate(-fx, -fy);
        ctx.beginPath();
        ctx.arc(fx, fy, Math.min(L.w, L.h) * 0.5, 0, TAU);
        ctx.clip();
        ctx.globalAlpha = 1 - z;
        this.drawScene(ctx, sim, tr.from.rung, tr.from.variant, 1.4, false);
        ctx.restore();
      } else if (tr.kind === 'cycle') {
        // into one flame: the old world grows past the eye, the new spark waits inside the light
        this.drawScene(ctx, sim, tr.to.rung, tr.to.variant, 0.5 + 0.3 * z, false);
        ctx.save();
        const s = 1 + 14 * z * z;
        ctx.translate(fx, fy);
        ctx.scale(s, s);
        ctx.translate(-fx, -fy);
        ctx.globalAlpha = 1 - z;
        this.drawScene(ctx, sim, tr.from.rung, tr.from.variant, 1.3, false);
        ctx.restore();
      } else {
        // Powers of Ten: the new world from ×F to ×1, the old one inside it from ×1 to ×1/F, seen through a lens of
        // light that closes on the new fire's heart
        const F = 14;
        const sN = F ** (1 - z);
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(sN, sN);
        ctx.translate(-fx, -fy);
        this.drawScene(ctx, sim, tr.to.rung, tr.to.variant, 0.35, false);
        ctx.restore();
        const sO = sN / F;
        const lens = Math.min(L.w, L.h) * 0.5;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(sO, sO);
        ctx.translate(-fx, -fy);
        ctx.beginPath();
        ctx.arc(fx, fy, lens, 0, TAU);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, (1 - z) * 1.6);
        this.drawScene(ctx, sim, tr.from.rung, tr.from.variant, 1.4, false);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,226,170,${(0.6 * (1 - z)).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, 10 * L.u * sO + 2);
        ctx.beginPath();
        ctx.arc(fx, fy, lens * sO, 0, TAU);
        ctx.stroke();
        drawGlow(ctx, fx, fy, lens * sO * 1.15, [255, 220, 160], 0.35 * (1 - z));
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      white = 0.78 * (1 - z * 0.8);
    } else {
      const k = (T - B) / (1 - B);
      const grow = 0.3 + 0.7 * ease.outBack(Math.min(1, k * 1.3));
      this.drawScene(ctx, sim, tr.to.rung, tr.to.variant, grow, true);
      // the ignition's shockwave
      ctx.globalCompositeOperation = 'lighter';
      const rr = L.R * (0.2 + 1.8 * ease.outCubic(k));
      ctx.strokeStyle = `rgba(255,236,190,${(0.5 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, L.R * 0.05 * (1 - k));
      ctx.beginPath();
      ctx.arc(fx, fy, rr, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      white = 0.21 * (1 - k);
    }
    if (white > 0.003) {
      // the white-out is warm light pouring from the fire, not a flash: bright at the heart, softer at the edges
      const rr = Math.hypot(L.w, L.h) * 0.62;
      const wg = ctx.createRadialGradient(fx, fy, 0, fx, fy, rr);
      wg.addColorStop(0, `rgba(255,250,236,${Math.min(1, white * 1.05).toFixed(3)})`);
      wg.addColorStop(0.35, `rgba(255,236,200,${(white * 0.7).toFixed(3)})`);
      wg.addColorStop(1, `rgba(255,214,160,${(white * 0.3).toFixed(3)})`);
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, L.w, L.h);
    }
  }

  /** The zoom's counter: the new frame's width as a power of ten ("10⁹ m"), or "from above". */
  private drawPowers(ctx: CanvasRenderingContext2D, tr: Trans): void {
    const L = this.L;
    const T = tr.t / RULES.changeSec;
    const a = clamp01((T - 0.22) / 0.12) * clamp01((0.92 - T) / 0.12);
    if (a <= 0) return;
    const spec = RUNGS[tr.to.rung], from = RUNGS[tr.from.rung];
    const big = spec.pow === null ? t('card.from') : powText(spec.pow);
    const small = spec.pow !== null && from.pow !== null && spec.pow > from.pow ? `×${powText(spec.pow - from.pow).replace(' m', '')}` : scaleName(tr.to.rung);
    ctx.globalAlpha = a;
    const y = L.top + Math.round(34 * L.u);
    label(ctx, big, L.cx, y, 28 * L.u, GOLD_HI, 'center', 800, true);
    label(ctx, small, L.cx, y + Math.round(26 * L.u), 14 * L.u, CREAM, 'center', 700);
    ctx.globalAlpha = 1;
  }

  private drawMotes(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const a = clamp01(m.life / m.max);
      if (m.kind === SMOKE) continue;
      if (m.kind === PUFF) {
        drawGlow(ctx, m.x, m.y, m.size * (1 + (1 - a)), m.rgb, 0.22 * a);
        continue;
      }
      const s = m.kind === HOME ? m.size * (0.7 + 0.5 * a) : m.size;
      drawGlow(ctx, m.x, m.y, s * 3.2, m.rgb, 0.55 * a);
      drawGlow(ctx, m.x, m.y, s, [255, 250, 230], 0.9 * a, 0.6);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawRipples(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      const k = r.t / 0.9;
      ctx.strokeStyle = `rgba(255,240,210,${(0.45 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, 3 * this.L.u * (1 - k));
      ctx.beginPath();
      ctx.arc(r.x, r.y, this.L.R * (0.1 + 0.35 * ease.outCubic(k)), 0, TAU);
      ctx.stroke();
    }
    if (this.trail.length > 1) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        const k = clamp01(1 - (this.clock - b.t) / 0.5);
        ctx.strokeStyle = `rgba(220,200,255,${(0.35 * k).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, 7 * this.L.u * k);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** The ring (the charge), the heat circle and its threshold, the breath, the smoke. */
  private drawGauge(ctx: CanvasRenderingContext2D, sim: OgienSim): void {
    const L = this.L, u = L.u, R = L.R, cx = L.cx, cy = L.cy;
    if (this.trans && this.trans.t < RULES.changeSec * 0.62) return;
    const fade = this.trans ? clamp01((this.trans.t / RULES.changeSec - 0.62) / 0.2) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    const top = -Math.PI / 2;
    // the track and its tenths
    ctx.strokeStyle = 'rgba(10,6,8,.28)';
    ctx.lineWidth = Math.max(4, 6 * u);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,220,.15)';
    ctx.lineWidth = Math.max(1.5, 2 * u);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,220,.3)';
    ctx.lineWidth = Math.max(1, 1.4 * u);
    for (let i = 0; i < 10; i++) {
      const a = top + (i / 10) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R + 4 * u), cy + Math.sin(a) * (R + 4 * u));
      ctx.lineTo(cx + Math.cos(a) * (R + 8 * u), cy + Math.sin(a) * (R + 8 * u));
      ctx.stroke();
    }
    const ring = clamp01(this.ring);
    const veil = this.veil;
    // almost full: the whole ring breathes gold
    if (ring >= RULES.nearAt && veil < 0.5) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,200,100,${(0.12 + 0.12 * Math.sin(this.clock * 7)).toFixed(3)})`;
      ctx.lineWidth = Math.max(5, 9 * u);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    const end = top + ring * TAU;
    ctx.lineCap = 'round';
    if (ring > 0.002) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,190,80,${(0.2 * (1 - veil * 0.7)).toFixed(3)})`;
      ctx.lineWidth = Math.max(6, 10 * u);
      ctx.beginPath();
      ctx.arc(cx, cy, R, top, end);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = veil > 0.5 ? 'rgba(220,190,140,.55)' : GOLD;
      ctx.lineWidth = Math.max(2.5, 3.5 * u);
      ctx.beginPath();
      ctx.arc(cx, cy, R, top, end);
      ctx.stroke();
    }
    // the light banked in rest, after the gold
    const lightArc = Math.min(clamp01(this.light), 1 - ring);
    if (lightArc > 0.002) {
      ctx.strokeStyle = `rgba(226,236,255,${(0.55 + 0.25 * Math.sin(this.clock * 2)).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, 3 * u);
      ctx.beginPath();
      ctx.arc(cx, cy, R, end, end + lightArc * TAU);
      ctx.stroke();
    }
    // the tip: a spark that brightens while focus charges
    const charging = sim.live && !sim.blind && this.heat > 0.5;
    const tx = cx + Math.cos(end) * R, ty = cy + Math.sin(end) * R;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, tx, ty, (charging ? 16 : 9) * u * (1 + 0.25 * Math.sin(this.clock * 9) + this.tickFlash * 0.6), [255, 210, 120], charging ? 0.95 : 0.5);
    drawGlow(ctx, tx, ty, 4 * u, [255, 252, 235], 1, 0.6);
    ctx.globalCompositeOperation = 'source-over';
    // the heat circle and the threshold (a sighted push), the breath (rest)
    const rest = sim.restBlock;
    if (sim.pushBlock && !sim.blind) {
      const r0 = R * 0.3, r1 = R * 0.9;
      const rth = r0 + (r1 - r0) * 0.5;
      ctx.setLineDash([3 * u, 5 * u]);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.beginPath();
      ctx.arc(cx, cy, rth, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (sim.live || sim.blockT >= sim.lead) {
        const rh = r0 + (r1 - r0) * clamp01(this.heat);
        const above = this.heat >= 0.5;
        ctx.strokeStyle = 'rgba(10,6,8,.22)';
        ctx.lineWidth = Math.max(3, 4 * u);
        ctx.beginPath();
        ctx.arc(cx, cy, rh, 0, TAU);
        ctx.stroke();
        if (above) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255,190,90,.18)';
          ctx.lineWidth = Math.max(4, 7 * u);
          ctx.beginPath();
          ctx.arc(cx, cy, rh, 0, TAU);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = above ? `rgba(255,220,130,${(0.8 + 0.15 * Math.sin(this.clock * 6)).toFixed(3)})` : 'rgba(255,160,100,.6)';
        ctx.lineWidth = Math.max(1.5, 1.8 * u);
        ctx.beginPath();
        ctx.arc(cx, cy, rh, 0, TAU);
        ctx.stroke();
      }
    } else if (rest) {
      const rb = R * (0.42 + 0.3 * this.breathK);
      ctx.strokeStyle = `rgba(226,236,255,${(0.35 + 0.3 * sim.calmShown).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, 2.2 * u);
      ctx.beginPath();
      ctx.arc(cx, cy, rb, 0, TAU);
      ctx.stroke();
      const b = sim.breath;
      label(ctx, b.in ? t('hud.in') : t('hud.out'), cx, L.under, 14 * u, '#e6efff', 'center', 700);
    }
    // the smoke over a blind block's ring
    if (veil > 0.02) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + this.clock * 0.08;
        const wob = 1 + 0.08 * Math.sin(this.clock * 0.7 + i * 1.9);
        drawGlow(ctx, cx + Math.cos(a) * R * wob, cy + Math.sin(a) * R * wob, R * 0.36, [128, 122, 136], 0.62 * veil);
      }
      for (let i = 0; i < 5; i++) {
        const k = ((this.clock * 0.12 + i / 5) % 1);
        drawGlow(ctx, cx + Math.sin(this.clock * 0.5 + i * 2) * R * 0.3, cy - R * (0.2 + 0.9 * k), R * (0.25 + 0.3 * k), [110, 106, 120], 0.35 * veil * Math.sin(k * Math.PI));
      }
      if (veil > 0.5) label(ctx, t('hud.smoke'), cx, L.under, 13 * u, '#d8d4de', 'center', 700);
    }
    // the ember bed after a passed rest
    if (sim.ember && sim.pushBlock) label(ctx, `✦ ${t('hud.ember')}`, cx, cy + R + 9 * u + fontPx(12 * u), 12 * u, '#ffb070', 'center', 700);
    ctx.restore();
  }

  /** The ladder of seven fires down the left edge: past ones gold, this one with its charge, the rest to come. */
  private drawLadder(ctx: CanvasRenderingContext2D, sim: OgienSim): void {
    const L = this.L, { x, y0, y1, r } = L.ladder;
    const n = RUNGS.length;
    const yAt = (i: number) => y1 - ((y1 - y0) * i) / (n - 1);
    ctx.strokeStyle = 'rgba(255,240,220,.18)';
    ctx.lineWidth = Math.max(1, 1.5 * L.u);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y0);
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const y = yAt(i);
      const cur = i === sim.rung, past = i < sim.rung;
      if (cur) {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, x, y, r * 3.2, [255, 190, 90], 0.55);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(20,10,10,.75)';
        ctx.beginPath();
        ctx.arc(x, y, r * 1.55, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = Math.max(1.5, 2 * L.u);
        ctx.beginPath();
        ctx.arc(x, y, r * 1.55, -Math.PI / 2, -Math.PI / 2 + clamp01(this.ring) * TAU);
        ctx.stroke();
        drawFlame(ctx, x, y + r * 0.7, r * 0.9, r * 1.9, this.clock, 0.6, ICON_PAL[i], 0, i);
      } else {
        ctx.fillStyle = past ? GOLD : 'rgba(10,6,8,.55)';
        ctx.strokeStyle = past ? 'rgba(255,240,200,.9)' : 'rgba(255,240,220,.4)';
        ctx.lineWidth = Math.max(1, 1.2 * L.u);
        ctx.beginPath();
        ctx.arc(x, y, r * (past ? 0.85 : 0.75), 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (sim.cycle > 0) label(ctx, `×${sim.cycle + 1}`, x, y1 + r * 3.2, 11 * L.u, GOLD_HI, 'center', 800);
  }

  /** The scale's button (bottom right): its icon and verb; dimmed while the hands rest. */
  private drawButton(ctx: CanvasRenderingContext2D, sim: OgienSim): void {
    const L = this.L, b = L.btn, u = L.u;
    const on = sim.handsOn;
    const press = this.btnDown;
    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.5;
    const s = 1 - 0.04 * press;
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(s, s);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    const glow = this.coachRing && this.coachRing.at?.kind === 'button' && this.clock < this.coachRing.until;
    if (glow) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.8, [255, 200, 110], 0.4 + 0.2 * Math.sin(this.clock * 5));
      ctx.globalCompositeOperation = 'source-over';
    }
    roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fillStyle = press > 0.1 ? 'rgba(70,36,22,.9)' : 'rgba(26,14,14,.78)';
    ctx.fill();
    ctx.strokeStyle = `rgba(255,206,120,${(0.6 + 0.3 * press).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, 2 * u);
    ctx.stroke();
    // the icon: the scene's own small flame in a disc
    const ix = b.x + b.h / 2, iy = b.y + b.h / 2, ir = b.h * 0.34;
    ctx.fillStyle = 'rgba(255,190,90,.16)';
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, TAU);
    ctx.fill();
    drawFlame(ctx, ix, iy + ir * 0.62, ir * 0.9, ir * 1.5, this.clock, 0.7, ICON_PAL[sim.rung], 0, 3);
    const text = actName(sim.task);
    const maxW = b.w - b.h - 14 * u;
    const size = fitFont(ctx, text, maxW, 16 * u, 13, 800);
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(size, 800);
    ctx.fillText(text, b.x + b.h - 2 * u, b.y + b.h / 2 + 1);
    ctx.restore();
  }

  /** The bonfire's pile of logs (bottom left), the next log ready to drag. */
  private drawPile(ctx: CanvasRenderingContext2D, sim: OgienSim): void {
    const L = this.L, p = L.pile, u = L.u;
    roundRect(ctx, p.x, p.y, p.w, p.h, 14 * u);
    ctx.fillStyle = 'rgba(26,14,14,.55)';
    ctx.fill();
    const ready = sim.logs > 0;
    ctx.strokeStyle = ready ? `rgba(255,206,120,${(0.45 + 0.25 * Math.sin(this.clock * 3)).toFixed(3)})` : 'rgba(255,240,220,.2)';
    ctx.lineWidth = Math.max(1.2, 1.6 * u);
    ctx.stroke();
    const lw = p.w * 0.7, lh = Math.max(10, p.h * 0.2);
    for (let i = 0; i < RULES.logs; i++) {
      const have = i < sim.logs;
      const x = p.x + p.w / 2 - lw / 2 + (i % 2 ? lw * 0.08 : 0), y = p.y + p.h - 8 * u - (i + 1) * (lh + 2 * u);
      this.paintLog(ctx, x, y, lw, lh, have ? 1 : 0.18);
    }
  }

  private paintLog(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number): void {
    ctx.globalAlpha = a;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = '#5a3620';
    ctx.fill();
    ctx.strokeStyle = '#2e1a10';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + h * 0.6, y + h * 0.35);
    ctx.lineTo(x + w * 0.8, y + h * 0.35);
    ctx.moveTo(x + h, y + h * 0.7);
    ctx.lineTo(x + w * 0.65, y + h * 0.7);
    ctx.stroke();
    ctx.fillStyle = '#c99a62';
    ctx.beginPath();
    ctx.ellipse(x + w - h * 0.45, y + h / 2, h * 0.36, h * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a6038';
    ctx.beginPath();
    ctx.ellipse(x + w - h * 0.45, y + h / 2, h * 0.18, h * 0.22, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** A log in the finger's hand: drawn above the finger, so the thumb never covers it. */
  private drawDraggedLog(ctx: CanvasRenderingContext2D): void {
    const d = this.drag!, L = this.L;
    const w = L.pile.w * 0.8, h = Math.max(12, L.pile.h * 0.24);
    const x = d.x - w / 2, y = d.y - d.lift - h / 2;
    const near = Math.hypot(d.x - L.cx, d.y - d.lift - (L.cy + L.R * 0.2)) < L.R * 0.75;
    if (near) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, L.cx, L.cy + L.R * 0.2, L.R * 0.8, [255, 170, 80], 0.5);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.translate(d.x, y + h / 2);
    ctx.rotate(-0.12);
    ctx.translate(-d.x, -(y + h / 2));
    this.paintLog(ctx, x, y, w, h, 1);
    ctx.restore();
  }

  /** Ignacy's bubble under the HUD: his portrait and the line, fading in and out. */
  private drawBubble(ctx: CanvasRenderingContext2D, sim: OgienSim): void {
    const line = sim.talk.line;
    if (!line) return;
    const L = this.L, u = L.u, B = L.bubble;
    const a = clamp01(line.t / 0.25) * clamp01((line.dur - line.t) / 0.35);
    if (a <= 0) return;
    const pr = Math.round(18 * u);
    const size = fontPx(14 * u);
    ctx.font = font(size, 600);
    const textW = Math.min(B.maxW - pr * 2 - 26 * u, 460 * u);
    const lines = wrap(ctx, line.text, textW).slice(0, 4);
    const lh = Math.round(size * 1.32);
    const w = Math.min(B.maxW, pr * 2 + 24 * u + Math.max(...lines.map(s => ctx.measureText(s).width)));
    const h = Math.max(pr * 2 + 10 * u, lines.length * lh + 16 * u);
    ctx.save();
    ctx.globalAlpha = a;
    roundRect(ctx, B.x, B.y, w, h, 14 * u);
    ctx.fillStyle = 'rgba(22,12,14,.84)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,150,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    paintIgnacy(ctx, B.x + pr + 6 * u, B.y + h / 2, pr, this.clock);
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(size, 600);
    const tx = B.x + pr * 2 + 16 * u;
    const ty = B.y + h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((s, i) => ctx.fillText(s, tx, ty + i * lh));
    ctx.restore();
  }

  /** The cards: the opening (story + root verse), a new fire (its name, scale and verse), a new round. */
  private drawCard(ctx: CanvasRenderingContext2D, sim: OgienSim): void {
    const c = sim.card;
    this.cardBox = null;
    if (!c || !this.cardShown(sim)) return;
    const L = this.L, u = L.u, box = L.card;
    const shownT = c.kind === 'open' ? c.t : c.t - RULES.changeSec * 0.62;
    const a = clamp01(shownT / 0.35) * clamp01((c.dur - c.t) / 0.4);
    if (a <= 0) return;
    const pad = Math.round(16 * u);
    const innerW = box.w - pad * 2;
    // the words
    let eyebrow: string, title: string, text: string;
    if (c.kind === 'open') {
      eyebrow = t('guide');
      title = t('story.open.title');
      text = t('story.open.text');
    } else if (c.kind === 'cycle') {
      eyebrow = t('card.cycle', { n: c.cycle + 1 });
      title = t('story.cycle.title');
      text = t('story.cycle.text');
    } else {
      const spec = RUNGS[c.rung];
      eyebrow = `${spec.pow === null ? t('card.from') : powText(spec.pow)} · ${scaleName(c.rung)}`;
      title = rungName(c.rung);
      text = c.variant > 0 ? variantName(c.rung, c.variant) : t(`desc.${spec.id}` as 'desc.iskra');
    }
    const p = passage(c.verse);
    ctx.save();
    const titlePx = fitFont(ctx, title, innerW, (L.mode === 'tall' && u <= 1 ? 25 : 28) * u, 18, 700, true);
    const fresh = c.fresh && c.kind !== 'open';
    const tagH = fresh ? Math.round(13 * u) + 6 * u : 0;
    ctx.font = font(15 * u, 600);
    const lh = Math.round(fontPx(15 * u) * 1.35);
    const foot = Math.round(13 * u) + 12 * u;
    // the words take what is left after a verse of three lines; the verse gets the rest, so nothing overlaps
    const fixed = tagH + Math.round(13 * u) + 8 * u + titlePx * 1.15 + 6 * u + 10 * u;
    const avail = box.h - pad * 2 - foot - fixed;
    const maxText = Math.max(1, Math.min(4, Math.floor((avail - 72) / lh)));
    let textLines = wrap(ctx, text, innerW);
    if (textLines.length > maxText) {
      textLines = textLines.slice(0, maxText);
      textLines[maxText - 1] = `${textLines[maxText - 1].replace(/[\s,;:.]+$/, '')}…`;
    }
    const head = fixed + textLines.length * lh;
    const verseRoom = Math.max(40, avail - textLines.length * lh);
    const key = `${c.kind}:${c.rung}:${c.verse}:${innerW}:${verseRoom}`;
    if (!this.passageCache || this.passageCache.key !== key) {
      const lay = layoutPassage(ctx, p, innerW, verseRoom, { max: Math.round((L.mode === 'tall' && u <= 1 ? 15.5 : 17) * u), min: 13 });
      this.passageCache = { key, lay, h: lay.height };
    }
    const lay = this.passageCache.lay;
    const needed = Math.round(pad * 2 + head + lay.height + foot);
    const hh = Math.min(box.h, needed);
    this.cardOverflow = needed - hh;
    const y0 = L.anchor === 'bottom' ? box.y + box.h - hh : box.y + (box.h - hh) / 2;
    const rect = { x: box.x, y: y0, w: box.w, h: hh };
    this.cardBox = rect;
    const slide = L.anchor === 'bottom' ? (1 - ease.outCubic(clamp01(shownT / 0.35))) * 24 * u : 0;
    ctx.globalAlpha = a;
    ctx.translate(0, slide);
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18 * u);
    const bg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    bg.addColorStop(0, 'rgba(34,18,18,.92)');
    bg.addColorStop(1, 'rgba(16,8,12,.94)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,206,120,.55)';
    ctx.lineWidth = Math.max(1, 1.4 * u);
    ctx.stroke();
    let y = rect.y + pad;
    const cx = rect.x + rect.w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (fresh) {
      ctx.fillStyle = '#ffe6a8';
      const tag = `✦ ${t('card.new')} ✦`;
      const tp = fitFont(ctx, tag, innerW, 13 * u, 13, 800);
      ctx.font = font(tp, 800);
      ctx.fillText(tag, cx, y);
      y += tagH;
    }
    ctx.fillStyle = GOLD;
    const ebPx = fitFont(ctx, eyebrow, innerW, 13 * u, 13, 800);
    ctx.font = font(ebPx, 800);
    ctx.fillText(eyebrow, cx, y);
    y += Math.round(13 * u) + 8 * u;
    ctx.fillStyle = GOLD_HI;
    ctx.font = font(titlePx, 700, true);
    ctx.fillText(title, cx, y);
    y += titlePx * 1.15 + 6 * u;
    ctx.fillStyle = 'rgba(255,244,220,.9)';
    ctx.font = font(15 * u, 600);
    textLines.forEach((s, i) => ctx.fillText(s, cx, y + i * lh));
    y += textLines.length * lh + 10 * u;
    drawPassage(ctx, p, lay, cx, y, { text: '#fff1d6', ref: 'rgba(255,214,150,.85)' });
    ctx.textBaseline = 'alphabetic';
    const hint = this.opts.touch ? t('card.tap') : t('card.click');
    ctx.fillStyle = 'rgba(255,240,220,.6)';
    const hp = fitFont(ctx, hint, innerW, 13, 13, 600);
    ctx.font = font(hp, 600);
    ctx.textAlign = 'center';
    ctx.fillText(hint, cx, rect.y + rect.h - pad * 0.7);
    ctx.restore();
  }

  /** For the tests: the motes alive. */
  get moteCount(): number { return this.motes.length; }
  get changing(): boolean { return this.trans !== null; }
  /** the heat as shown (blind: neutral), for the tests */
  get heatShown(): number { return this.heat; }
}

const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
