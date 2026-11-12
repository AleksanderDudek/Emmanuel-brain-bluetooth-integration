/**
 * Światło ciała's play view: the night, the glass figure with its organs (baked per size and depth in
 * paint.ts), each organ's glow when it is in balance, the band of light scanning the body — clipped to
 * the silhouette, its thickness and colour the light (cool, gold above the threshold, violet in rest,
 * silver when blind), the threshold drawn on it as two dashed lines — the live picture of the organ in
 * the light (sweat and shivers, CO₂ bubbles, the beat, sugar going home, the cortisol wave, water through
 * the kidneys, the gut's wave and new cells, the skin's mantle, calcium), the systems' paths at the third
 * depth, motes and sparks, flying lux, and the HUD of hud.ts.  Per frame it only composes cached layers
 * and draws a few dozen small shapes: no shadowBlur, no filters.
 */
import { clamp, ease, Floaters, Particles } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { ORGAN, ORGANS, type Depth, type OrganId } from './content';
import { HYPOTHALAMUS, ORGAN_SPOT, PITUITARY, SYSTEMS, organAt, spline } from './figure';
import {
  bandColor, bubbleBox, drawBubble, drawButton, drawLine, drawPanel, drawStory, luxFloat, panelBox,
} from './hud';
import { figPt, hitTest, layout, tapTargets, type Hit, type Layout, type Rect } from './layout';
import { CYAN, GOLD, ICE, REST, SANS, bakeFigure, bakeNight, bandSprite, glow, mapper, rgbaPrefix, type FigureLayers, type Layer } from './paint';
import { RULES } from './rules';
import type { SimEvent, SwiatloSim } from './sim';

const TAU = Math.PI * 2;

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

export class SwiatloView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private night: Layer | null = null;
  private fig: FigureLayers | null = null;
  private figDepth: Depth = 1;
  private readonly parts = new Particles(220);
  private readonly floats = new Floaters();
  private moteT = 0;
  /** the panel and the bubble as last drawn (for taps and the mobile audit) */
  panelRect: Rect | null = null;
  storyRect: Rect | null = null;
  /** touch-down looks */
  buttonDown = 0;
  panelDown = 0;
  private flash = 0;
  private flashHue = GOLD;
  private stop = 0;
  private bubbleK = 0;
  private lastLine = '';
  private time = 0;
  private sweepFrom = 0;

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, { top: 134, right: 0, bottom: 0, left: 0 }, o.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.o.touch);
    const L = this.L;
    this.night = bakeNight(w, h, dpr, L.fig.cx, L.fig.top + L.fig.H * 0.45);
    this.fig = null;
  }

  private figure(depth: Depth): FigureLayers | null {
    if (!this.fig || this.figDepth !== depth) {
      this.fig = bakeFigure(this.L.fig, depth, this.dpr);
      this.figDepth = depth;
    }
    return this.fig;
  }

  /** The screen y of the band. */
  bandY(sim: SwiatloSim): number {
    return this.L.fig.top + sim.scanV * this.L.fig.H;
  }

  // ── events → juice ─────────────────────────────────────────────
  on(e: SimEvent, sim: SwiatloSim): void {
    const L = this.L, H = L.fig.H;
    switch (e.type) {
      case 'help': {
        const at = e.organ ? this.organXY(e.organ) : { x: L.fig.cx, y: this.bandY(sim) };
        const hue = e.organ ? ORGAN[e.organ].hue : ICE;
        this.parts.burst(at.x, at.y, e.good ? 7 : 3, { color: hue, speed: H * 0.18, life: 0.6, size: 2, g: -20, drag: 2.4, shape: 'dot' });
        if (e.kind === 'beat' && e.good) this.parts.burst(at.x, at.y, 1, { color: '#ffc2cf', speed: 0, life: 0.5, size: H * 0.02, g: 0, drag: 0, shape: 'ring' });
        break;
      }
      case 'balanced': {
        const at = this.organXY(e.organ);
        const hue = ORGAN[e.organ].hue;
        this.parts.burst(at.x, at.y, e.rating === 3 ? 26 : 14, { color: e.rating === 3 ? GOLD : hue, speed: H * 0.3, life: 1.1, size: 2.4, g: -30, drag: 1.6, shape: e.rating === 3 ? 'spark' : 'dot' });
        this.parts.burst(at.x, at.y, 1, { color: hue, speed: 0, life: 0.8, size: H * 0.05, g: 0, drag: 0, shape: 'ring' });
        this.floats.add(luxFloat(e.lux), at.x + (Math.random() - 0.5) * 24, at.y - H * 0.02, { color: e.rating === 3 ? GOLD : '#d8f6ff', size: 15 * L.u, dur: 1.3 });
        this.stop = Math.max(this.stop, e.rating === 3 ? 0.07 : 0.04);
        if (e.rating === 3 && !this.o.reducedMotion) { this.flash = 0.5; this.flashHue = GOLD; }
        break;
      }
      case 'scanDone':
        this.sweepFrom = 1;
        this.flash = this.o.reducedMotion ? 0.25 : 0.8;
        this.flashHue = GOLD;
        for (let i = 0; i < 18; i++) {
          const p = figPt(L, (Math.random() - 0.5) * 0.3, Math.random());
          this.parts.burst(p.x, p.y, 2, { color: i % 3 ? GOLD : ICE, speed: H * 0.12, life: 1.6, size: 2.2, g: -40, drag: 1, shape: 'dot' });
        }
        this.floats.add(luxFloat(e.lux), L.fig.cx, L.fig.top + H * 0.5, { color: GOLD, size: 18 * L.u, dur: 1.6 });
        break;
      case 'lux':
        if (e.at === 'rest') {
          const c = figPt(L, 0, 0.27);
          this.floats.add(luxFloat(e.n), c.x - H * 0.1 + (Math.random() - 0.5) * 20, c.y - H * 0.04, { color: '#d6dcff', size: 14 * L.u, dur: 1.6 });
        }
        if (e.at === 'block') this.floats.add(luxFloat(e.n), L.fig.cx - H * 0.12, this.bandY(sim) - H * 0.06, { color: '#d8f6ff', size: 14 * L.u, dur: 1.2 });
        break;
      case 'blindEnd':
        if (e.lux > 0) this.floats.add(luxFloat(e.lux), L.fig.cx, this.bandY(sim) - H * 0.05, { color: '#e0e6f4', size: 15 * L.u, dur: 1.4 });
        break;
      case 'breathTap':
        if (e.good) {
          const c = figPt(L, 0, 0.26);
          this.parts.burst(c.x, c.y, 1, { color: REST, speed: 0, life: 0.9, size: H * 0.08, g: 0, drag: 0, shape: 'ring' });
          this.floats.add(luxFloat(RULES.luxRhythm), c.x + H * 0.1 + (Math.random() - 0.5) * 16, c.y + H * 0.03, { color: '#d6dcff', size: 13, dur: 1 });
        }
        break;
      case 'arrive': {
        const at = this.organXY(e.organ);
        this.parts.burst(at.x, at.y, 1, { color: ORGAN[e.organ].hue, speed: 0, life: 0.9, size: H * 0.06, g: 0, drag: 0, shape: 'ring' });
        break;
      }
      default:
        break;
    }
  }

  /** A touch-down on the open field: a soft ring of light under the finger, at once. */
  touch(x: number, y: number): void {
    this.parts.burst(x, y, 1, { color: ICE, speed: 0, life: 0.45, size: 9, g: 0, drag: 0, shape: 'ring' });
  }

  /** An organ's centre on screen (for a pair: the side nearer the panel's column). */
  organXY(o: OrganId): { x: number; y: number } {
    const s = ORGAN_SPOT[o];
    const x = s.pair && this.L.panel.x < this.L.fig.cx ? -s.x : s.x;
    return figPt(this.L, x, s.y);
  }

  update(dt: number, sim: SwiatloSim): void {
    this.time += dt;
    if (this.stop > 0) {
      this.stop -= dt;
      dt *= 0.15;
    }
    this.parts.update(dt);
    this.floats.update(dt);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.buttonDown = Math.max(0, this.buttonDown - dt * 5);
    this.panelDown = Math.max(0, this.panelDown - dt * 5);
    this.sweepFrom = Math.max(0, this.sweepFrom - dt / RULES.sweepSec);
    const line = sim.talk.line;
    this.bubbleK = line ? Math.min(1, this.bubbleK + dt * 5) : Math.max(0, this.bubbleK - dt * 6);
    if (line) this.lastLine = line.text;
    // motes rise from the band, more of them in brighter light
    if (sim.started && !sim.story) {
      const L = this.L, H = L.fig.H;
      const rate = sim.restBlock ? 3 : 4 + 14 * sim.light;
      this.moteT += dt * rate;
      const col = bandColor(sim);
      while (this.moteT >= 1) {
        this.moteT -= 1;
        const x = L.fig.cx + (Math.random() - 0.5) * H * 0.3;
        this.parts.burst(x, this.bandY(sim), 1, { color: col.core.startsWith('#') ? col.core : col.hex, speed: H * 0.05, angle: -Math.PI / 2, spread: 0.8, life: 1.2, size: 1.4, g: -12, drag: 0.6, shape: 'dot' });
      }
    }
  }

  // ── drawing ────────────────────────────────────────────────────
  draw(sim: SwiatloSim, now: number, song: { text: string; p: number } | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L, H = L.fig.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.night) ctx.drawImage(this.night, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#0b1430';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    const bandY = this.bandY(sim);
    // rest: the figure's breath as rings of soft light
    if (sim.restBlock) this.drawBreathAura(ctx, sim);
    const fig = this.figure(sim.depth);
    // the figure breathes: with the guide in rest, barely otherwise
    const chest = figPt(L, 0, 0.3);
    const breathe = sim.restBlock ? 1 + 0.01 * sim.breath.k : 1 + (this.o.reducedMotion ? 0 : 0.0025 * Math.sin(now * 0.9));
    ctx.save();
    ctx.translate(chest.x, chest.y);
    ctx.scale(breathe, breathe);
    ctx.translate(-chest.x, -chest.y);
    if (fig) ctx.drawImage(fig.base, fig.box.x, fig.box.y, fig.box.w, fig.box.h);
    // the body fills with light as the scan goes on (and stays bright through the whole-body sweep)
    if (fig) {
      const fill = Math.max(sim.done / ORGANS.length, this.sweepFrom);
      if (fill > 0.02) {
        ctx.save();
        ctx.clip(fig.clip);
        glow(ctx, sim.restBlock ? REST : '#cfefff', L.fig.cx, L.fig.top + H * 0.42, H * 0.62, 0.05 + 0.2 * fill);
        ctx.restore();
      }
    }
    // the organs that are in balance glow; the one in the band glows with the band's light
    if (fig) {
      for (const o of ORGANS) {
        const s = fig.lit[o];
        if (!s) continue;
        let a = sim.glow[o];
        if (sim.loop?.organ === o) a = Math.max(a, 0.25 + 0.45 * sim.light * (sim.restBlock ? 0.5 : 1));
        if (this.sweepFrom > 0) {
          // the whole body in light: the sweep passes up from the feet
          const sy = L.fig.top + H * (1 - ease.inOutSine(1 - this.sweepFrom));
          if (s.y + s.h / 2 >= sy) a = Math.max(a, 0.9 * this.sweepFrom + 0.3);
        }
        if (a <= 0.01) continue;
        ctx.globalAlpha = clamp(a);
        ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
        ctx.globalAlpha = 1;
      }
    }
    if (sim.depth >= 3) this.drawSystems(ctx, sim, now);
    this.drawProcess(ctx, sim, now);
    this.drawHeartBeat(ctx, sim);
    if (sim.started && !sim.story) this.drawRail(ctx, sim, bandY, now);
    if (sim.started && !sim.story) this.drawBand(ctx, sim, fig, bandY);
    if (this.sweepFrom > 0) this.drawSweep(ctx);
    ctx.restore();
    this.parts.draw(ctx);
    this.floats.draw(ctx, `800 ${SANS}`);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.flashHue, L.fig.cx, L.fig.top + H * 0.45, H * 0.8, this.flash * 0.35);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the HUD
    drawLine(ctx, L, song, sim.story ? 0 : 1);
    const pb = panelBox(ctx, L, sim, bandY);
    this.panelRect = pb ? pb.rect : null;
    if (pb) drawPanel(ctx, sim, pb, now, this.panelDown);
    if (sim.started && !sim.story) drawButton(ctx, L, sim, this.buttonDown, now);
    if (this.bubbleK > 0.01 && this.lastLine && !sim.story) drawBubble(ctx, bubbleBox(ctx, L, this.lastLine, bandY), this.bubbleK);
    this.storyRect = drawStory(ctx, L, sim);
  }

  /** The band of light: a soft halo across the night, a bright core inside the body, the scan line, the threshold. */
  private drawBand(ctx: CanvasRenderingContext2D, sim: SwiatloSim, fig: FigureLayers | null, y: number): void {
    const L = this.L, H = L.fig.H;
    const col = bandColor(sim);
    const light = sim.restBlock ? RULES.restLight : sim.light;
    const th = H * (0.026 + 0.07 * light);
    const half = H * 0.205;
    const x0 = L.fig.cx - half, w = 2 * half;
    const spr = bandSprite(col.hex);
    // the halo across the band of the night
    if (spr) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 + 0.22 * light;
      ctx.drawImage(spr, L.left, y - th * 1.8, L.right - L.left, th * 3.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // the core inside the body
    if (fig && spr) {
      ctx.save();
      ctx.clip(fig.clip);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + 0.45 * light;
      ctx.drawImage(spr, x0, y - th, w, th * 2);
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    // the scan line
    ctx.strokeStyle = sim.blind ? 'rgba(220,226,240,.55)' : `${rgbaPrefix(col.hex)}.9)`;
    ctx.lineWidth = Math.max(1, H * 0.003);
    ctx.beginPath();
    ctx.moveTo(x0 - H * 0.03, y);
    ctx.lineTo(x0 + w + H * 0.03, y);
    ctx.stroke();
    // the threshold on the band itself: two dashed lines where the core reaches at the threshold
    if (sim.pushBlock && !sim.blind) {
      const tth = H * (0.026 + 0.07 * RULES.gold);
      ctx.setLineDash([H * 0.012, H * 0.01]);
      ctx.strokeStyle = sim.goldOn ? 'rgba(255,226,150,.85)' : 'rgba(220,240,255,.5)';
      ctx.lineWidth = Math.max(1, H * 0.0028);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x0 - H * 0.05, y + s * tth);
        ctx.lineTo(x0 + w + H * 0.05, y + s * tth);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // the band's lamp at its side (the gauge on the thing itself), on the side away from the panel, where it fits
      const r = Math.max(7, H * 0.022);
      const rail = this.railX(r);
      const lx = rail ?? 0;
      if (rail !== null) {
      ctx.beginPath();
      ctx.arc(lx, y, r, 0, TAU);
      ctx.fillStyle = 'rgba(8,14,34,.8)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.light));
      ctx.strokeStyle = sim.goldOn ? GOLD : CYAN;
      ctx.lineWidth = Math.max(2, r * 0.35);
      ctx.stroke();
      // the notch at the threshold (half way round)
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, y + r * 0.55);
      ctx.lineTo(lx, y + r * 1.35);
      ctx.stroke();
      if (sim.goldOn) glow(ctx, GOLD, lx, y, r * 2.4, 0.5);
      }
    }
  }

  /** Where the band's lamp rides (the side away from the panel), or null where there is no room. */
  private railX(r: number): number | null {
    const L = this.L, H = L.fig.H;
    const away = L.panel.x > L.fig.cx ? -1 : 1;
    const x = L.fig.cx + away * (H * 0.205 + H * 0.07);
    const fits = away < 0 ? x - r >= L.left + 8 : x + r <= Math.min(L.right - 8, L.bubble.x + L.bubble.w);
    return fits ? x : null;
  }

  /** The scan's rail beside the figure: the nine stations as dots that light in their colours (gold-ringed when golden). */
  private drawRail(ctx: CanvasRenderingContext2D, sim: SwiatloSim, bandY: number, now: number): void {
    const L = this.L, H = L.fig.H;
    const x = this.railX(Math.max(7, H * 0.022));
    if (x === null) return;
    const y0 = L.fig.top + RULES.startV * H, y1 = L.fig.top + RULES.endV * H;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(190,235,255,.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    const col = bandColor(sim);
    ctx.strokeStyle = `${rgbaPrefix(col.hex)}.5)`;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, Math.max(y0, bandY));
    ctx.stroke();
    for (const o of ORGANS) {
      const y = L.fig.top + ORGAN[o].v * H;
      const lit = sim.lit[o], here = sim.loop?.organ === o;
      const r = here ? 4.5 + 1.2 * Math.sin(now * 4) : 3.5;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, r), 0, TAU);
      ctx.fillStyle = lit > 0 ? ORGAN[o].hue : here ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.16)';
      ctx.fill();
      if (lit >= 3) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** The whole body in light: a gold line rising from the soles to the crown. */
  private drawSweep(ctx: CanvasRenderingContext2D): void {
    const L = this.L, H = L.fig.H;
    const k = ease.inOutSine(1 - this.sweepFrom);
    const y = L.fig.top + H * (1 - k);
    const spr = bandSprite(GOLD);
    if (!spr || !this.fig) return;
    ctx.save();
    ctx.clip(this.fig.clip);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9 * Math.sin(Math.PI * k) + 0.1;
    ctx.drawImage(spr, L.fig.cx - H * 0.22, y - H * 0.08, H * 0.44, H * 0.16);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** Rest: rings of light around the chest that grow with the in-breath and settle with the out-breath. */
  private drawBreathAura(ctx: CanvasRenderingContext2D, sim: SwiatloSim): void {
    const L = this.L, H = L.fig.H;
    const b = sim.breath;
    const c = figPt(L, 0, 0.27);
    const calm = sim.reliable ? sim.calmShown : 0.4;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const r = H * (0.12 + 0.07 * i + 0.09 * b.k);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.strokeStyle = `rgba(169,184,255,${(0.08 + 0.1 * calm - 0.025 * i + 0.08 * b.k).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, H * (0.004 - 0.001 * i));
      ctx.stroke();
    }
    glow(ctx, REST, c.x, c.y, H * (0.25 + 0.12 * b.k), 0.14 + 0.18 * calm);
    // the whole body's glow deepens with calm: every organ in balance shines softly
    for (const o of ORGANS) if (sim.lit[o] > 0) {
      const p = this.organXY(o);
      glow(ctx, ORGAN[o].hue, p.x, p.y, H * 0.06, 0.1 + 0.25 * calm * (0.6 + 0.4 * b.k));
    }
    ctx.restore();
  }

  /** The figure's heart beats always — at the player's pulse when Mendi gives one. */
  private drawHeartBeat(ctx: CanvasRenderingContext2D, sim: SwiatloSim): void {
    const H = this.L.fig.H;
    const p = figPt(this.L, ORGAN_SPOT.heart.x, ORGAN_SPOT.heart.y);
    const k = Math.max(0, 1 - sim.sinceBeat / 0.3);
    const at = sim.loop?.organ === 'heart';
    const real = sim.realPulse;
    glow(ctx, real ? '#ff8fa6' : ORGAN.heart.hue, p.x, p.y, H * (0.035 + 0.03 * k) * (at ? 1.4 : 1), (at ? 0.35 : 0.14) + (at ? 0.45 : 0.22) * k);
  }

  /** The systems depth: signals travelling along the vagus, the HPA axis and the aorta. */
  private drawSystems(ctx: CanvasRenderingContext2D, sim: SwiatloSim, now: number): void {
    const L = this.L, H = L.fig.H;
    const map = mapper(L.fig);
    ctx.save();
    ctx.lineCap = 'round';
    for (const [kind, lines] of Object.entries(SYSTEMS)) {
      const hue = kind === 'vagus' ? '#ffe9a8' : kind === 'hpa' ? '#ffc078' : '#ff9aa8';
      ctx.strokeStyle = `${rgbaPrefix(hue)}${sim.restBlock && kind === 'vagus' ? '.9' : '.6'})`;
      ctx.lineWidth = Math.max(1.2, H * 0.004);
      ctx.setLineDash([H * 0.008, H * 0.05]);
      ctx.lineDashOffset = -now * H * (kind === 'aorta' ? 0.12 : 0.07) * (sim.restBlock && kind === 'vagus' ? 1.8 : 1);
      for (const pts of lines) {
        const p = new Path2D();
        spline(p, pts, map, false);
        ctx.stroke(p);
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** The organ in the band, alive: what the body does to bring it home. */
  private drawProcess(ctx: CanvasRenderingContext2D, sim: SwiatloSim, now: number): void {
    const l = sim.loop;
    if (!l || l.balanced) return;
    const L = this.L, H = L.fig.H;
    const o = l.organ, hue = ORGAN[o].hue;
    const k = l.settled ? 1 : 1 - l.s;   // 0 at arrival → 1 home
    const away = 1 - k;
    const P = (x: number, y: number) => figPt(L, x, y);
    ctx.save();
    switch (o) {
      case 'brain': {
        const hot = l.kick === 'bath';
        const h = P(HYPOTHALAMUS.x, HYPOTHALAMUS.y);
        glow(ctx, hot ? '#ff9a7a' : '#8fc8ff', h.x, h.y, H * 0.03, 0.5 + 0.3 * Math.sin(now * 6));
        // the skin answers: drops of sweat that rise as vapour, or the shiver of the muscles
        for (let i = 0; i < 10; i++) {
          const side = i % 2 ? 1 : -1;
          const fy = 0.2 + (i * 0.073) % 0.6;
          const fx = side * (0.09 + 0.02 * Math.sin(i));
          const p = P(fx, fy);
          if (hot) {
            const rise = ((now * 0.5 + i * 0.13) % 1);
            ctx.fillStyle = `rgba(190,235,255,${(0.6 * away * (1 - rise)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x + side * rise * H * 0.03, p.y - rise * H * 0.04, Math.max(1.2, H * 0.005), 0, TAU);
            ctx.fill();
          } else {
            const j = Math.sin(now * 40 + i) * H * 0.002 * away;
            ctx.strokeStyle = `rgba(160,200,255,${(0.45 * away).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x + j, p.y, H * 0.012, 0, TAU);
            ctx.stroke();
          }
        }
        break;
      }
      case 'lungs': {
        const c = P(0, 0.245);
        glow(ctx, hue, c.x, c.y, H * (0.08 + 0.01 * Math.sin(now * 2.2)), 0.25);
        for (const b of sim.bubbles) {
          const side = b.u < 0.5 ? -1 : 1;
          const fx = side * (0.02 + 0.045 * Math.abs(b.u - 0.5) * 2);
          const fy = 0.2 + 0.09 * b.w;
          const p = P(fx, fy);
          const rise = b.pop > 0 ? b.pop : 0;
          const y = p.y - rise * H * 0.16;
          const x = p.x + (L.fig.cx - p.x) * rise;
          const a = b.pop > 0 ? 1 - rise : clamp(b.age * 3);
          ctx.strokeStyle = `rgba(200,180,255,${(0.85 * a).toFixed(3)})`;
          ctx.fillStyle = `rgba(120,100,200,${(0.35 * a).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y + Math.sin(now * 3 + b.id) * 1.5, Math.max(2.5, H * 0.008), 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        // oxygen coming in: small warm dots drifting down the airway
        for (let i = 0; i < 5; i++) {
          const q = (now * 0.6 + i / 5) % 1;
          const p = P(0, 0.13 + 0.07 * q);
          ctx.fillStyle = `rgba(255,200,170,${(0.7 * (1 - q) * (0.4 + 0.6 * k)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x + Math.sin(i * 2) * H * 0.006, p.y, Math.max(1.2, H * 0.004), 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'heart': {
        const p = P(ORGAN_SPOT.heart.x, ORGAN_SPOT.heart.y);
        const beat = Math.max(0, 1 - sim.sinceBeat / 0.25);
        ctx.strokeStyle = `rgba(255,190,205,${(0.5 + 0.4 * beat).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, H * (0.04 + 0.02 * beat), 0, TAU);
        ctx.stroke();
        // the vagus' brake: a thread of light from the brainstem to the heart
        const top = P(0.006, 0.09);
        ctx.strokeStyle = `rgba(255,236,170,${(0.25 + 0.5 * k).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, H * 0.003);
        ctx.setLineDash([H * 0.008, H * 0.012]);
        ctx.lineDashOffset = -now * H * 0.08;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo(top.x + H * 0.02, (top.y + p.y) / 2, p.x - H * 0.01, p.y - H * 0.02);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'liver': {
        // sugar in the blood (gold dots) going home into the liver (or out of it, for glucagon)
        const into = l.kick === 'meal';
        const c = P(-0.03, 0.326);
        for (let i = 0; i < 12; i++) {
          const q = (now * 0.35 + i / 12) % 1;
          const ang = (i / 12) * TAU;
          const rad = H * (into ? 0.11 * (1 - q) + 0.02 : 0.02 + 0.11 * q);
          const n = Math.round(12 * (0.25 + 0.75 * away));
          if (i >= n) continue;
          ctx.fillStyle = `rgba(255,214,120,${(0.85 * (into ? q : 1 - q)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(c.x + Math.cos(ang) * rad, c.y + Math.sin(ang) * rad * 0.6, Math.max(1.3, H * 0.0045), 0, TAU);
          ctx.fill();
        }
        // the pancreas signals (insulin or glucagon): a pulse from the islets
        const pc = P(0.02, 0.352);
        glow(ctx, '#ffe39a', pc.x, pc.y, H * 0.03, 0.3 + 0.3 * Math.sin(now * 5));
        break;
      }
      case 'adrenal': {
        // the cortisol wave over the adrenals, and the feedback climbing the HPA axis to the brain
        for (const side of [-1, 1]) {
          const p = P(side * 0.048, 0.36);
          glow(ctx, '#ffb347', p.x, p.y, H * (0.03 + 0.05 * away), 0.25 + 0.4 * away);
        }
        const q = (now * 0.5) % 1;
        const a = P(0.04 * (1 - q), 0.36 - (0.36 - 0.078) * q);
        glow(ctx, '#ffe39a', a.x, a.y, H * 0.02, 0.6);
        const pit = P(PITUITARY.x, PITUITARY.y);
        glow(ctx, '#ffe39a', pit.x, pit.y, H * 0.02, 0.3 + 0.3 * k);
        break;
      }
      case 'kidney': {
        // water through the filters: drops falling in, most of them coming back to the blood
        for (const side of [-1, 1]) {
          const c = P(side * 0.05, 0.388);
          for (let i = 0; i < 5; i++) {
            const q = (now * 0.7 + i / 5) % 1;
            const back = i % 4 !== 0;
            const y = c.y - H * 0.03 + q * H * 0.05;
            const x = c.x + (back ? -side * q * H * 0.02 : 0);
            ctx.fillStyle = `rgba(140,200,255,${(0.75 * (1 - q)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(1.2, H * 0.004), 0, TAU);
            ctx.fill();
          }
        }
        break;
      }
      case 'gut': {
        // the gut's wave travelling along the colon, and new cells rising from the crypts
        const q = (now * 0.25) % 1;
        const pts: [number, number][] = [[-0.044, 0.476], [-0.054, 0.44], [-0.052, 0.41], [-0.02, 0.402], [0.02, 0.402], [0.052, 0.41], [0.054, 0.44], [0.048, 0.47]];
        const i = Math.floor(q * (pts.length - 1)), f = q * (pts.length - 1) - i;
        const [x, y] = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
        const p = P(x, y);
        glow(ctx, hue, p.x, p.y, H * 0.03, 0.7);
        for (let j = 0; j < 8; j++) {
          const r = (now * 0.4 + j / 8) % 1;
          const c = P(-0.03 + (j / 7) * 0.06, 0.47 - 0.05 * r);
          ctx.fillStyle = `rgba(255,220,190,${(0.7 * (1 - r) * (0.3 + 0.7 * away)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(c.x, c.y, Math.max(1.2, H * 0.0042), 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'skin': {
        for (const side of [-1, 1]) {
          const c = P(side * 0.168, 0.522);
          for (let j = 0; j < 3; j++) {
            const r = ((now * 0.6 + j / 3) % 1);
            ctx.strokeStyle = `rgba(198,245,255,${(0.6 * (1 - r)).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(c.x, c.y, H * (0.012 + 0.03 * r), 0, TAU);
            ctx.stroke();
          }
        }
        break;
      }
      case 'bone': {
        // the parathyroids in the neck send PTH; calcium sparkles move from the bone to the blood
        for (const side of [-1, 1]) {
          const n = P(side * 0.012, 0.135);
          glow(ctx, '#ffe9a8', n.x, n.y, H * 0.015, 0.4 + 0.4 * Math.sin(now * 5 + side));
          for (let j = 0; j < 5; j++) {
            const r = (now * 0.5 + j / 5) % 1;
            const b = P(side * (0.052 - 0.004 * j), 0.52 + j * 0.04);
            ctx.fillStyle = `rgba(250,248,255,${(0.8 * (1 - r) * (0.3 + 0.7 * away)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(b.x - side * r * H * 0.02, b.y - r * H * 0.02, Math.max(1.1, H * 0.0035), 0, TAU);
            ctx.fill();
          }
        }
        break;
      }
    }
    ctx.restore();
  }

  // ── input ──────────────────────────────────────────────────────
  /** What a tap at (x, y) lands on; on the field, also which organ of the figure (if any). */
  hit(x: number, y: number, sim: SwiatloSim): Hit & { organ?: OrganId | null } {
    const h = hitTest(this.L, { story: sim.story ? (this.storyRect ?? this.L.story) : null, panel: this.panelRect }, x, y);
    if (h.kind !== 'field') return h;
    const L = this.L, H = L.fig.H;
    const fx = (x - L.fig.cx) / H, fy = (y - L.fig.top) / H;
    // a finger is wide: an organ counts from 22 px around its spot
    return { ...h, organ: organAt(fx, fy, 22 / H) };
  }

  targets(sim: SwiatloSim): TapTarget[] {
    if (!sim.started) return [];
    return tapTargets(this.L, { story: sim.story ? (this.storyRect ?? this.L.story) : null, panel: this.panelRect });
  }
}
