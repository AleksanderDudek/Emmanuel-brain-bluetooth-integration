/**
 * Odporność's play view (DESIGN §13.9): a slice of skin like a living microscope slide.  The air and the
 * skin's surface with the wound at the top, the rose dermis with its collagen and fibroblasts, the venule
 * along the bottom with the blood flowing; in it the white cells — pearl, lilac-lobed, with eyes — and the
 * bacteria, the cytokine rings of the alarm (the band's quantity, with its gold threshold ring), the gold
 * antibodies, the NETs, and in the T-cell stage the lining of the nose.  Static layers are cached per size;
 * lights are baked sprites; particles and floating words are pooled (kit/juice).
 */
import { MIN_READ } from '../kit/mobile';
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import type { Insets } from '../kit/types';
import type { PassageLayout } from '../kit/scripture';
import { PATHOGEN, factTitle, pathogenName, unlockName, type CoachAt } from './content';
import { drawBreath, drawBubble, drawButtons, drawCard, drawSongLine, drawStrip } from './hud';
import { t } from './i18n';
import { layout, onButton, sx, sy, wx, wy, type Layout } from './layout';
import {
  PAL, SANS, TAU, circle, fitFont, font, glow, hash, paintBody, paintBug, paintDendritic, paintLymphocyte, paintMacrophage, paintMast, paintNet,
  paintNeutrophil, paintSplinter, paintVirion, paintY, rgbOf, rr,
} from './paint';
import { RULES } from './rules';
import type { Cell, OdpSim, SimEvent } from './sim';

export type Hit = { kind: 'card' } | { kind: 'burst' } | { kind: 'net' } | { kind: 'field'; x: number; y: number };

/** What the finger does right now (index.ts sets it): where it is, where it leads, what it draws. */
export interface Drag { x: number; y: number; lx: number; ly: number; mode: 'lead' | 'sweep' | 'stroke'; sx0: number; sy0: number }

export class OdpView {
  L: Layout;
  private dpr = 1;
  private bgKey = '';
  private bgCanvas: HTMLCanvasElement | null = null;
  readonly particles = new Particles(320);
  readonly floaters = new Floaters();
  private readonly shake: Shake;
  private now = 0;
  /** touch-down feedback: a ring where the finger landed */
  private touchAt: { x: number; y: number; t: number } | null = null;
  pressed: 'burst' | 'net' | null = null;
  private pressFlash = 0;
  drag: Drag | null = null;
  private burstFlash = 0;
  private stageFlash = 0;
  private closedGlow = 0;
  private nodeT = -1;
  private bubbleK = 0;
  private lastLine = '';
  private floaterGap = 0;
  private slipGap = 0;
  private readonly cardCache: { key: string; verse: PassageLayout | null } = { key: '', verse: null };
  /** recent pads lit, for a flash on the wall */
  private padFlash: { x: number; t: number }[] = [];
  /** the news of a moment (a card found, a cell joined, a stage done): one at a time, in a dark pill under the strip */
  private toasts: { text: string; color: string; t: number; dur: number }[] = [];

  /** the bottom of Neo's bubble while it shows (the toast goes under it) */
  private bubbleBottom = 0;

  private toast(text: string, color = '#fff8ef', dur = 2.4): void {
    if (this.toasts.some(x => x.text === text)) return;
    this.toasts.push({ text, color, t: 0, dur });
    if (this.toasts.length > 4) this.toasts.splice(1, 1);
  }

  constructor(private readonly canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; touch: boolean }) {
    this.L = layout(canvas.clientWidth || 360, canvas.clientHeight || 500, undefined, opts.touch);
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, insets: Insets): void {
    this.L = layout(w, h, insets, this.opts.touch);
    this.dpr = dpr;
    this.bgKey = '';
    this.cardCache.key = '';
  }

  // ── reacting to the sim ──────────────────────────────────────────────────────────
  private p(x: number, y: number): { x: number; y: number } { return { x: sx(this.L, x), y: sy(this.L, y) }; }

  on(e: SimEvent, sim: OdpSim): void {
    const L = this.L, u = L.u, k = L.k;
    const fl = (text: string, x: number, y: number, color = '#fff8ef', size = 17) => this.floaters.add(text, x, y, { color, size: Math.max(MIN_READ, size * u) });
    switch (e.type) {
      case 'gulp': {
        const q = this.p(e.x, e.y);
        const col = PATHOGEN[e.kind].body;
        this.particles.burst(q.x, q.y, 5, { color: col, size: 1.6 * u, speed: 50 * u, g: 0, drag: 3, life: 0.45, shape: 'dot' });
        this.particles.burst(q.x, q.y, 1, { color: e.tagged ? PAL.gold : '#ffffff', size: 3 * u, speed: 0, g: 0, life: 0.35, shape: 'ring' });
        if (e.combo >= 3 && e.combo % 3 === 0) fl(t('w.combo', { n: e.combo }), q.x, q.y - 10 * u, e.combo >= 9 ? PAL.gold : '#fff8ef', 15 + Math.min(10, e.combo / 2));
        break;
      }
      case 'digest': {
        const q = this.p(e.x, e.y);
        this.particles.burst(q.x, q.y - 3 * u, 3, { color: '#bfefff', size: 1.3 * u, speed: 26 * u, angle: -Math.PI / 2, spread: 1.6, g: -30, drag: 2, life: 0.6, shape: 'spark' });
        break;
      }
      case 'slip':
        if (this.slipGap <= 0) {
          const q = this.p(e.x, e.y);
          fl(t('w.slip'), q.x, q.y - 12 * u, '#e6f7ff', 14);
          this.slipGap = 2.5;
        }
        break;
      case 'divide': {
        const q = this.p(e.x, e.y);
        this.particles.burst(q.x, q.y, 2, { color: '#e9ffd0', size: 1.2 * u, speed: 20 * u, g: 0, life: 0.4 });
        break;
      }
      case 'pad':
        this.padFlash.push({ x: e.x, t: 0 });
        if (e.lit === 1) this.toast(t('w.pads'), PAL.gold);
        break;
      case 'arrest': {
        const q = this.p(e.x, RULES.wallY + 2);
        this.particles.burst(q.x, q.y, 1, { color: PAL.gold, size: 5 * u, speed: 0, g: 0, life: 0.4, shape: 'ring' });
        break;
      }
      case 'squeeze': {
        const q = this.p(e.x, RULES.wallY);
        this.particles.burst(q.x, q.y, 4, { color: '#f7f2ff', size: 1.4 * u, speed: 30 * u, angle: -Math.PI / 2, spread: 1.2, g: 0, drag: 3, life: 0.5 });
        break;
      }
      case 'join':
        if (e.n <= 3 || e.n % 5 === 0) { const q = this.p(e.x, e.y); fl(t('w.join', { n: e.n }), q.x, q.y - 8 * u, '#f3ecff', 14); }
        break;
      case 'spent': { const q = this.p(e.x, e.y); fl(t('w.full'), q.x, q.y - 10 * u, '#e9e1f6', 13); break; }
      case 'tidy': {
        const q = this.p(e.x, e.y);
        this.particles.burst(q.x, q.y, 7, { color: PAL.growth, size: 1.6 * u, speed: 40 * u, g: -20, drag: 2, life: 0.8, shape: 'spark' });
        break;
      }
      case 'burst': {
        this.burstFlash = 1;
        this.shake.add(0.25);
        for (const c of sim.swarm) {
          const q = this.p(c.x, c.y);
          this.particles.burst(q.x, q.y, 4, { color: '#bfefff', size: 1.8 * u, speed: 70 * u, g: 0, drag: 2.5, life: 0.6, shape: 'spark' });
        }
        this.toast(t('w.burst'), '#d9f6ff', 1.8);
        break;
      }
      case 'net': {
        const q = this.p(e.x, e.y);
        this.shake.add(0.18);
        this.particles.burst(q.x, q.y, 14, { color: PAL.net, size: 1.6 * u, speed: e.r * k * 1.4, g: 0, drag: 3, life: 0.7, shape: 'spark' });
        fl(t('w.net'), q.x, q.y - e.r * k * 0.6, '#e6f7ff', 20);
        break;
      }
      case 'tag': {
        const q = this.p(e.x, e.y);
        this.particles.burst(q.x, q.y, 4, { color: e.by === 'c3' ? PAL.c3 : PAL.gold, size: 1.4 * u, speed: 30 * u, g: 0, drag: 3, life: 0.5 });
        break;
      }
      case 'dc':
        if (e.phase === 'node') this.nodeT = 0;
        break;
      case 'abWave':
        this.nodeT = Math.max(this.nodeT, 2.2);
        break;
      case 'infect': {
        const ep = sim.epi[e.i];
        if (ep) { const q = this.p(ep.x, RULES.epi.y); this.particles.burst(q.x, q.y, 4, { color: PAL.infected, size: 1.6 * u, speed: 20 * u, g: 0, life: 0.6 }); }
        break;
      }
      case 'virions': { const q = this.p(e.x, e.y); this.particles.burst(q.x, q.y, 6, { color: PATHOGEN[sim.virusKind].light, size: 1.4 * u, speed: 40 * u, g: 0, drag: 2, life: 0.5 }); break; }
      case 'neutralise': { const q = this.p(e.x, e.y); this.particles.burst(q.x, q.y, 3, { color: PAL.gold, size: 1.3 * u, speed: 20 * u, g: 0, life: 0.4 }); break; }
      case 'dock': { const q = this.p(e.x, e.y + RULES.epi.h / 2); this.particles.burst(q.x, q.y, 1, { color: '#9fd0ff', size: 6 * u, speed: 0, g: 0, life: 0.5, shape: 'ring' }); break; }
      case 'fold': {
        const q = this.p(e.x, e.y);
        this.particles.burst(q.x, q.y, 8, { color: '#efe3ff', size: 2 * u, speed: 36 * u, g: 10, drag: 2, life: 0.8 });
        fl(t('w.fold', { n: e.n }), q.x, q.y + 20 * u, '#f3e8ff', 18);
        break;
      }
      case 'noFlags': { const q = this.p(e.x, e.y); fl(t('w.noFlags'), q.x, q.y + 24 * u, '#f3e8ff', 14); break; }
      case 'collagen': {
        const f = e.f;
        for (let i = 0; i <= 4; i++) {
          const q = this.p(f.x1 + (f.x2 - f.x1) * (i / 4), f.y1 + (f.y2 - f.y1) * (i / 4));
          this.particles.burst(q.x, q.y, 1, { color: PAL.collagen, size: 1.6 * u, speed: 14 * u, g: 0, life: 0.6, shape: 'spark' });
        }
        break;
      }
      case 'closed': {
        this.closedGlow = 1;
        const q = this.p(sim.woundX, -4);
        this.particles.burst(q.x, q.y, 22, { color: PAL.gold, size: 2 * u, speed: 90 * u, angle: -Math.PI / 2, spread: 2.6, g: 40, drag: 1.5, life: 1.2, shape: 'spark' });
        this.toast(t('w.closed'), '#fff0c8', 3);
        break;
      }
      case 'stageDone':
        this.stageFlash = 1;
        this.toast(e.grace ? t('w.grace') : `${t('w.done')} ${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}`, e.grace ? '#fff8ef' : PAL.gold, 2.6);
        break;
      case 'fact': this.toast(t('w.newFact', { name: factTitle(e.id) }), '#fff3d6'); break;
      case 'unlock': this.toast(t('w.unlock', { name: unlockName(e.id) }), '#d9fff0', 3); break;
      case 'memory': this.toast(`${t('w.memory')} ${pathogenName(e.id)}`, '#ffe9b3', 2.6); break;
      case 'reveal': this.toast(t('w.reveal', { n: Math.round(e.share * 100) }), '#fff3d6', 3); break;
      case 'combo': break;
      default: break;
    }
  }

  /** A touch-down's ring (the screen answers at once). */
  touchDown(x: number, y: number): void { this.touchAt = { x, y, t: 0 }; }
  buttonDown(which: 'burst' | 'net'): void { this.pressed = which; this.pressFlash = 1; }

  update(dt: number): void {
    this.now += dt;
    this.particles.update(dt);
    this.floaters.update(dt);
    this.burstFlash = Math.max(0, this.burstFlash - dt * 1.4);
    this.stageFlash = Math.max(0, this.stageFlash - dt * 0.8);
    this.closedGlow = Math.max(0, this.closedGlow - dt * 0.35);
    this.pressFlash = Math.max(0, this.pressFlash - dt * 4);
    this.floaterGap = Math.max(0, this.floaterGap - dt);
    this.slipGap = Math.max(0, this.slipGap - dt);
    if (this.nodeT >= 0) { this.nodeT += dt; if (this.nodeT > 4.6) this.nodeT = -1; }
    if (this.toasts.length) { this.toasts[0].t += dt; if (this.toasts[0].t >= this.toasts[0].dur) this.toasts.shift(); }
    if (this.touchAt) { this.touchAt.t += dt; if (this.touchAt.t > 0.45) this.touchAt = null; }
    for (let i = this.padFlash.length - 1; i >= 0; i--) { this.padFlash[i].t += dt; if (this.padFlash[i].t > 1) this.padFlash.splice(i, 1); }
  }

  // ── hit-testing ──────────────────────────────────────────────────────────────────
  hit(x: number, y: number, sim: OdpSim): Hit {
    const L = this.L;
    if (sim.card) return { kind: 'card' };
    if (sim.burstShown && onButton(L.burst, x, y)) return { kind: 'burst' };
    if (sim.netShown && onButton(L.net, x, y)) return { kind: 'net' };
    return { kind: 'field', x: wx(L, x), y: wy(L, y) };
  }

  /** A coach mark's point on the canvas. */
  pointFor(at: CoachAt): { x: number; y: number } | null {
    const L = this.L;
    if (at.kind === 'world') return { x: sx(L, at.x), y: sy(L, at.y) };
    if (at.kind === 'burst') return { x: L.burst.x, y: L.burst.y - L.burst.r };
    if (at.kind === 'net') return { x: L.net.x, y: L.net.y - L.net.r };
    return null;
  }

  // ── drawing ──────────────────────────────────────────────────────────────────────
  draw(sim: OdpSim, song: { line: { text: string; p: number } | null; beat: number; chorus: boolean; on: boolean }): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    const bg = this.background(sim);
    if (bg) ctx.drawImage(bg, 0, 0, L.w, L.h);
    else { ctx.fillStyle = PAL.tissue[1]; ctx.fillRect(0, 0, L.w, L.h); }
    const pulse = 0.5 + 0.5 * Math.cos(((song.beat % 1) + 1) % 1 * TAU);
    if (sim.scene === 'skin') this.drawSkin(ctx, sim);
    else this.drawNose(ctx, sim);
    this.drawVessel(ctx, sim);
    this.drawRings(ctx, sim, pulse);
    this.drawNets(ctx, sim);
    this.drawBugs(ctx, sim);
    this.drawAbs(ctx, sim);
    this.drawCells(ctx, sim, pulse);
    this.drawMarks(ctx, sim);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.particles.draw(ctx);
    ctx.restore();
    if (this.nodeT >= 0) this.drawNode(ctx, sim);
    ctx.restore();
    // the light of the burst: a soft blue-white glow from the edges (never a white-out)
    if (this.burstFlash > 0 || sim.bursting > 0) {
      const a = (this.opts.reducedMotion ? 0.12 : 0.22) * Math.max(this.burstFlash, sim.bursting > 0 ? 0.5 : 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, L.w / 2, sy(L, 50), Math.max(L.w, L.h) * 0.7, '150,220,255', a);
      ctx.restore();
    }
    this.floaters.draw(ctx, `800 ${SANS}`);
    // the strip, the song or the bubble, the buttons, the card
    drawStrip(ctx, L, sim, this.now);
    const line = sim.talk.line;
    if (line) {
      if (line.text !== this.lastLine) { this.lastLine = line.text; this.bubbleK = 0; }
      this.bubbleK = Math.min(1, this.bubbleK + 1 / 12);
      const fade = clamp((line.dur - line.t) / 0.3);
      this.bubbleBottom = drawBubble(ctx, L, line.text, line.speaker, Math.min(this.bubbleK, fade), this.now);
    } else {
      this.bubbleBottom = 0;
      const br = sim.breath;
      if (br && !sim.card) drawBreath(ctx, L, br);
      else if (song.on && !sim.card) drawSongLine(ctx, L, song.line, pulse, song.chorus);
    }
    if (this.toasts.length && !sim.card) this.drawToast(ctx, this.toasts[0]);
    if (!sim.card) drawButtons(ctx, L, sim, this.pressed, this.now, this.pressFlash);
    if (this.touchAt) {
      const k = this.touchAt.t / 0.45;
      ctx.strokeStyle = `rgba(255,248,239,${0.6 * (1 - k)})`;
      ctx.lineWidth = 2;
      circle(ctx, this.touchAt.x, this.touchAt.y, (10 + 22 * ease.outCubic(k)) * L.u);
      ctx.stroke();
    }
    if (sim.card) drawCard(ctx, L, sim, sim.card, this.opts.touch, this.now, this.cardCache);
  }

  // ── the cached layers: air, skin, dermis, vessel (or the nose's lining) ───────────
  private background(sim: OdpSim): HTMLCanvasElement | null {
    const L = this.L;
    const key = `${sim.scene}|${L.w}|${L.h}|${this.dpr}|${L.W.toFixed(2)}|${L.k.toFixed(3)}`;
    if (key === this.bgKey && this.bgCanvas) return this.bgCanvas;
    if (typeof document === 'undefined') return null;
    const c = this.bgCanvas ?? document.createElement('canvas');
    c.width = Math.max(1, Math.round(L.w * this.dpr));
    c.height = Math.max(1, Math.round(L.h * this.dpr));
    const g = c.getContext('2d');
    if (!g) return null;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (sim.scene === 'skin') this.paintSkinBg(g); else this.paintNoseBg(g);
    this.paintVesselBg(g);
    // a soft vignette
    const vg = g.createRadialGradient(L.w / 2, L.h * 0.55, Math.min(L.w, L.h) * 0.3, L.w / 2, L.h * 0.55, Math.max(L.w, L.h) * 0.8);
    vg.addColorStop(0, 'rgba(60,10,30,0)');
    vg.addColorStop(1, 'rgba(60,10,30,0.28)');
    g.fillStyle = vg;
    g.fillRect(0, 0, L.w, L.h);
    this.bgCanvas = c;
    this.bgKey = key;
    return c;
  }

  private paintSkinBg(g: CanvasRenderingContext2D): void {
    const L = this.L, k = L.k;
    const skinY = sy(L, RULES.skinTop), y0 = sy(L, 0), wallY = sy(L, RULES.wallY);
    // the air above the skin
    const air = g.createLinearGradient(0, 0, 0, skinY);
    air.addColorStop(0, PAL.air[0]);
    air.addColorStop(1, PAL.air[1]);
    g.fillStyle = air;
    g.fillRect(0, 0, L.w, skinY + 1);
    if (skinY > 40) {
      // above the skin: a warm, out-of-focus room, a beam of light
      for (let i = 0; i < 12; i++) {
        const x = hash(i * 5.7 + 1) * L.w, y = hash(i * 2.9 + 3) * skinY, r = (10 + hash(i * 1.3) * 30) * k * 0.6;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,255,255,${0.25 + hash(i) * 0.2})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      const beam = g.createLinearGradient(L.w * 0.2, 0, L.w * 0.6, skinY);
      beam.addColorStop(0, 'rgba(255,240,210,0.35)');
      beam.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(L.w * 0.25, 0);
      g.lineTo(L.w * 0.45, 0);
      g.lineTo(L.w * 0.75, skinY);
      g.lineTo(L.w * 0.5, skinY);
      g.closePath();
      g.fill();
    }
    // the dermis: rose, deeper toward the vessel
    const der = g.createLinearGradient(0, y0, 0, wallY);
    der.addColorStop(0, PAL.tissue[0]);
    der.addColorStop(0.35, PAL.tissue[1]);
    der.addColorStop(0.75, PAL.tissue[2]);
    der.addColorStop(1, PAL.tissue[3]);
    g.fillStyle = der;
    g.fillRect(0, y0, L.w, wallY - y0 + 2);
    // depth: soft bokeh of out-of-focus cells
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 3.1) * L.w, y = y0 + hash(i * 7.7) * (wallY - y0), r = (6 + hash(i * 1.9) * 22) * k;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,236,232,${0.1 + hash(i) * 0.08})`);
      gr.addColorStop(1, 'rgba(255,236,232,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // collagen bundles: long soft waves; elastic fibres: thin dark wiggles
    g.lineCap = 'round';
    for (let i = 0; i < Math.round(L.w / 22); i++) {
      const y = y0 + (0.06 + hash(i * 5.3) * 0.88) * (wallY - y0);
      const x = -20 + hash(i * 2.1) * L.w;
      const len = (40 + hash(i * 9.1) * 70) * k;
      g.strokeStyle = PAL.fibre;
      g.lineWidth = (2 + hash(i * 4.4) * 3) * k * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + len * 0.3, y - 6 * k, x + len * 0.6, y + 6 * k, x + len, y - 2 * k);
      g.stroke();
      if (i % 3 === 0) {
        g.strokeStyle = 'rgba(120,40,70,0.18)';
        g.lineWidth = Math.max(0.8, 0.5 * k);
        g.beginPath();
        g.moveTo(x + 10, y + 8 * k);
        for (let j = 1; j <= 8; j++) g.lineTo(x + 10 + j * len * 0.08, y + 8 * k + Math.sin(j * 1.9 + i) * 2.5 * k);
        g.stroke();
      }
    }
    // resting fibroblasts: faint spindles
    for (let i = 0; i < Math.round(L.w / 70); i++) {
      const x = hash(i * 13.7) * L.w, y = y0 + (0.2 + hash(i * 3.3) * 0.7) * (wallY - y0);
      g.save();
      g.translate(x, y);
      g.rotate((hash(i * 2.2) - 0.5) * 0.8);
      g.fillStyle = 'rgba(255,222,214,0.35)';
      g.beginPath();
      g.ellipse(0, 0, 9 * k, 1.8 * k, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(176,90,110,0.3)';
      g.beginPath();
      g.ellipse(0, 0, 2.6 * k, 1.1 * k, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    // the epidermis: rows of keratinocytes like cobblestones, the horny layer on top
    const ep0 = skinY, ep1 = y0;
    g.fillStyle = PAL.epi;
    g.fillRect(0, ep0, L.w, ep1 - ep0 + 1);
    const rows = 3, rh = (ep1 - ep0) / rows;
    g.strokeStyle = PAL.epiLine;
    g.lineWidth = 1;
    for (let r = 0; r < rows; r++) {
      const cw = (7 + r * 1.5) * k;
      for (let x = -((r * 13) % cw); x < L.w; x += cw) {
        const jx = (hash(x * 0.37 + r) - 0.5) * cw * 0.2;
        rr(g, x + jx + 1, ep0 + r * rh + 1, cw - 2, rh - 2, Math.min(cw, rh) * 0.35);
        g.fillStyle = r === rows - 1 ? '#ecc3b1' : r === 0 ? '#f7e1d4' : PAL.epi;
        g.fill();
        g.stroke();
        if (r > 0) {
          g.fillStyle = 'rgba(190,120,110,0.35)';
          circle(g, x + jx + cw / 2, ep0 + r * rh + rh / 2, Math.min(cw, rh) * 0.16);
          g.fill();
        }
      }
    }
    g.fillStyle = PAL.corneum;
    g.fillRect(0, ep0 - 1.5 * k, L.w, 2.2 * k);
  }

  private paintNoseBg(g: CanvasRenderingContext2D): void {
    const L = this.L, k = L.k;
    const top = sy(L, RULES.skinTop), mem = sy(L, RULES.epi.y + RULES.epi.h / 2), wallY = sy(L, RULES.wallY);
    // the airway with its mucus
    const air = g.createLinearGradient(0, 0, 0, sy(L, RULES.epi.y - RULES.epi.h / 2));
    air.addColorStop(0, '#fffaf2');
    air.addColorStop(1, PAL.mucus[1]);
    g.fillStyle = air;
    g.fillRect(0, 0, L.w, sy(L, RULES.epi.y - RULES.epi.h / 2) + 1);
    for (let i = 0; i < 18; i++) {
      const x = hash(i * 4.1) * L.w, y = top + hash(i * 2.7) * (sy(L, 0) - top) * 0.9, r = (1 + hash(i) * 2.5) * k;
      g.strokeStyle = 'rgba(230,190,160,0.5)';
      g.lineWidth = 1;
      circle(g, x, y, r);
      g.stroke();
    }
    // the lamina propria: paler pink, small glands
    const lp = g.createLinearGradient(0, mem, 0, wallY);
    lp.addColorStop(0, '#fbd9de');
    lp.addColorStop(0.6, '#f0b2bf');
    lp.addColorStop(1, '#d9849a');
    g.fillStyle = lp;
    g.fillRect(0, mem, L.w, wallY - mem + 2);
    for (let i = 0; i < Math.round(L.w / 90); i++) {
      const x = hash(i * 6.3) * L.w, y = mem + (0.3 + hash(i * 1.7) * 0.5) * (wallY - mem);
      g.strokeStyle = 'rgba(255,240,244,0.5)';
      g.lineWidth = 1.2;
      for (let j = 0; j < 5; j++) { circle(g, x + Math.cos(j * 1.26) * 4 * k, y + Math.sin(j * 1.26) * 4 * k, 2.2 * k); g.stroke(); }
    }
    // the epithelium's row across the whole width (the live cells are drawn over it inside the world)
    const eTop = sy(L, RULES.epi.y - RULES.epi.h / 2), ew = RULES.epi.w * k * 0.9;
    for (let x = -((L.ox % ew) + ew); x < L.w + ew; x += ew) {
      rr(g, x + 1, eTop, ew - 2, mem - eTop, 5);
      g.fillStyle = '#fbd4dc';
      g.fill();
      g.strokeStyle = 'rgba(230,169,185,0.8)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = 'rgba(194,118,148,0.55)';
      g.beginPath();
      g.ellipse(x + ew / 2, mem - (mem - eTop) * 0.32, ew * 0.16, (mem - eTop) * 0.14, 0, 0, TAU);
      g.fill();
    }
    // the basement membrane under the epithelium
    g.strokeStyle = 'rgba(200,120,150,0.6)';
    g.lineWidth = Math.max(1, 0.6 * k);
    g.beginPath();
    g.moveTo(0, mem);
    g.lineTo(L.w, mem);
    g.stroke();
  }

  private paintVesselBg(g: CanvasRenderingContext2D): void {
    const L = this.L, k = L.k;
    const wall = sy(L, RULES.wallY), lt = sy(L, RULES.lumenTop), lb = sy(L, RULES.lumenBot), fl = sy(L, RULES.floor);
    const lum = g.createLinearGradient(0, lt, 0, lb);
    lum.addColorStop(0, PAL.lumen[0]);
    lum.addColorStop(0.5, PAL.lumen[1]);
    lum.addColorStop(1, PAL.lumen[0]);
    g.fillStyle = lum;
    g.fillRect(0, lt, L.w, lb - lt);
    // the walls: a row of flat endothelial cells, their nuclei bulging
    for (const [y0, y1, up] of [[wall, lt, true], [lb, lb + (lt - wall), false]] as const) {
      g.fillStyle = PAL.vesselWall;
      g.fillRect(0, y0, L.w, y1 - y0);
      const cw = 12 * k;
      for (let x = -((y0 * 7) % cw); x < L.w; x += cw) {
        g.strokeStyle = 'rgba(255,200,210,0.35)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y0);
        g.lineTo(x, y1);
        g.stroke();
        g.fillStyle = 'rgba(255,215,222,0.45)';
        g.beginPath();
        g.ellipse(x + cw / 2, up ? y1 - 0.3 * k : y0 + 0.3 * k, cw * 0.22, (y1 - y0) * 0.45, 0, 0, TAU);
        g.fill();
      }
    }
    g.fillStyle = PAL.tissue[3];
    g.fillRect(0, lb + (lt - wall), L.w, Math.max(0, fl - lb - (lt - wall)) + L.h);
  }

  // ── the skin and the wound ───────────────────────────────────────────────────────
  private drawSkin(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L, k = L.k;
    const wxs = sx(L, sim.woundX), top = sy(L, RULES.skinTop), base = sy(L, 0);
    // the wound bed shows the healing so far, and in the battle what the rests prepared under the surface
    const c = sim.stage === 'heal' ? sim.closure : Math.max(sim.closure, sim.prep);
    // inflammation: a warm glow around the wound that rises with the bacteria and settles with calm (breathing in a rest)
    const br = sim.breath, bv = br ? (br.inhale ? 0.5 - 0.5 * Math.cos(Math.PI * br.k) : 0.5 + 0.5 * Math.cos(Math.PI * br.k)) : 0.5;
    glow(ctx, wxs, sy(L, 18), 70 * k * (br ? 0.92 + 0.16 * bv : 1), PAL.inflam, 0.32 * sim.inflam);
    // the wound: a narrow puncture through the epidermis (no blood: a rose slit), closing as healing goes
    const open = 1 - ease.inOutSine(clamp((c - 0.35) / 0.65));
    const hw = 3.6 * k * open, depth = 16 * k * (1 - 0.6 * c);
    if (open > 0.01) {
      ctx.fillStyle = '#c4566e';
      ctx.beginPath();
      ctx.moveTo(wxs - hw, top);
      ctx.quadraticCurveTo(wxs - hw * 0.6, base, wxs, base + depth * 0.35);
      ctx.quadraticCurveTo(wxs + hw * 0.6, base, wxs + hw, top);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,200,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // a fine golden fibrin mesh plugs it first (haemostasis drawn as a net)
      ctx.strokeStyle = `rgba(255,214,140,${0.6 * (1 - c)})`;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(wxs - hw * 0.8, top + (i + 0.5) * (base - top) / 4);
        ctx.lineTo(wxs + hw * 0.8, top + (i + 1) * (base - top) / 4);
        ctx.stroke();
      }
    }
    // collagen in the wound bed: the strands the player laid and the ones healing weaves itself
    ctx.lineCap = 'round';
    for (const f of sim.fibres) {
      ctx.strokeStyle = 'rgba(255,242,230,0.85)';
      ctx.lineWidth = Math.max(1.5, 1.1 * k);
      ctx.beginPath();
      ctx.moveTo(sx(L, f.x1), sy(L, f.y1));
      ctx.quadraticCurveTo(sx(L, (f.x1 + f.x2) / 2), sy(L, (f.y1 + f.y2) / 2) - 3 * k, sx(L, f.x2), sy(L, f.y2));
      ctx.stroke();
    }
    // the wound bed: granulation tissue that fills with woven collagen, fibroblasts at work, capillary loops
    if (sim.stage === 'heal' || c > 0.05) {
      const bx = wxs, byy = sy(L, 15), rx = 26 * k, ry = 14 * k;
      const bedA = sim.stage === 'heal' ? 0.85 : 0.35 + 0.5 * c;
      glow(ctx, bx, byy, rx * 1.15, '232,120,138', 0.45 * bedA);
      // calm makes the bed glow warm gold while the body repairs
      if (sim.restBlock && sim.stage === 'heal') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, bx, byy, rx * 1.3, '255,214,150', 0.12 + 0.25 * sim.calm);
        ctx.restore();
      }
      // granulation: tiny capillary loops, more as it heals
      ctx.strokeStyle = 'rgba(214,80,100,0.55)';
      ctx.lineWidth = Math.max(1, 0.45 * k);
      const loops = Math.round(4 + 14 * c);
      for (let i = 0; i < loops; i++) {
        const a = hash(i * 7.3) * TAU, d = Math.sqrt(hash(i * 3.1));
        circle(ctx, bx + Math.cos(a) * rx * 0.85 * d, byy + Math.sin(a) * ry * 0.8 * d, 1.1 * k * (0.6 + hash(i)));
        ctx.stroke();
      }
      // collagen: strands woven across the bed, one by one as the wound closes
      const n = Math.round(c * 16);
      for (let i = 0; i < n; i++) {
        const dir = i % 2 ? 1 : -1, yy = byy + (hash(i * 5.1) - 0.5) * ry * 1.3;
        const w = rx * (0.55 + 0.4 * hash(i * 2.7));
        const shine = 0.55 + 0.35 * Math.sin(this.now * 1.5 + i);
        ctx.strokeStyle = `rgba(255,242,230,${(0.45 + 0.4 * c) * shine})`;
        ctx.lineWidth = Math.max(1.2, 0.85 * k);
        ctx.beginPath();
        ctx.moveTo(bx - w, yy - dir * 2 * k);
        ctx.bezierCurveTo(bx - w * 0.3, yy + dir * 3 * k, bx + w * 0.3, yy - dir * 3 * k, bx + w, yy + dir * 2 * k);
        ctx.stroke();
      }
      // fibroblasts weave it: spindles gliding across the bed
      if (sim.stage === 'heal' && c < 1) {
        for (let i = 0; i < 3; i++) {
          const fx = bx + Math.sin(this.now * 0.35 + i * 2.1) * rx * 0.75, fy = byy + (i - 1) * 4.5 * k;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(Math.cos(this.now * 0.35 + i * 2.1) * 0.25);
          ctx.fillStyle = '#ffe2cf';
          ctx.beginPath();
          ctx.ellipse(0, 0, 7 * k, 1.9 * k, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#e0a888';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#c9876a';
          ctx.beginPath();
          ctx.ellipse(0, 0, 2.2 * k, 1.1 * k, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.lineCap = 'butt';
    // capillaries sprout up from the vessel toward the healing wound (angiogenesis)
    if (sim.stage === 'heal' || c > 0.3) {
      const g = clamp(c * 1.3);
      ctx.strokeStyle = PAL.capillary;
      ctx.lineWidth = Math.max(1, 0.9 * k);
      for (let i = 0; i < 4; i++) {
        const x0 = wxs + (i - 1.5) * 16 * k, y0 = sy(L, RULES.wallY);
        const len = (RULES.wallY - 8) * k * g * (0.55 + 0.1 * i);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + 6 * k, y0 - len * 0.35, wxs + (i - 1.5) * 6 * k - 5 * k, y0 - len * 0.7, wxs + (i - 1.5) * 4 * k, y0 - len);
        ctx.stroke();
        // a tip cell leads each sprout (angiogenesis)
        glow(ctx, wxs + (i - 1.5) * 4 * k, y0 - len, 4 * k, '255,150,160', 0.5 * g);
      }
    }
    // the new epidermis closing over the top
    if (c > 0.45 && open < 1) {
      const k2 = clamp((c - 0.45) / 0.55);
      ctx.fillStyle = '#f6dccd';
      for (const s of [-1, 1]) {
        const x0 = wxs + s * (hw + 6 * k), x1 = wxs + s * (hw + 6 * k) * (1 - k2);
        rr(ctx, Math.min(x0, x1), top, Math.abs(x0 - x1) + 1, base - top, 3);
        ctx.fill();
      }
    }
    if (this.closedGlow > 0) glow(ctx, wxs, top + 4 * k, 40 * k, '255,226,150', 0.6 * this.closedGlow);
    if (sim.splinter) paintSplinter(ctx, wxs - 9 * k, top - 8 * k, wxs + 3 * k, sy(L, 15), 3.4 * k);
    // the mast cells' resting places are drawn with the cells
  }

  private drawNose(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L, k = L.k, E = RULES.epi;
    const yTop = sy(L, E.y - E.h / 2), yBot = sy(L, E.y + E.h / 2);
    const w = (sim.W / Math.max(1, sim.epi.length)) * k;
    sim.epi.forEach((e, i) => {
      const x = sx(L, e.x);
      let fill = PAL.epiNose, edge = PAL.epiNoseEdge, shrink = 0;
      if (e.state === 'infected' || e.state === 'hidden' || e.state === 'docked') { fill = PAL.infected; edge = '#b98ee6'; }
      if (e.state === 'fold') { fill = PAL.infected; shrink = clamp(e.t / RULES.tcell.fold); }
      if (e.state === 'gone') {
        // a basal cell grows back into the gap
        const g = clamp(e.t / 6);
        rr(ctx, x - w / 2 + 2, yBot - (yBot - yTop) * g, w - 4, (yBot - yTop) * g, 4);
        ctx.fillStyle = 'rgba(255,225,231,0.7)';
        ctx.fill();
        return;
      }
      const sw = w * (1 - 0.6 * shrink), sh = (yBot - yTop) * (1 - 0.5 * shrink);
      rr(ctx, x - sw / 2 + 1, yBot - sh, sw - 2, sh, 5 * (1 + shrink));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (shrink > 0) {
        // apoptosis: the cell folds itself into tidy bubbles
        for (let j = 0; j < 4; j++) {
          circle(ctx, x + (j - 1.5) * sw * 0.22, yBot - sh * (0.3 + 0.15 * (j % 2)), sw * 0.14 * (0.5 + shrink));
          ctx.fillStyle = '#f1e4ff';
          ctx.fill();
        }
        return;
      }
      // the nucleus, low in the cell
      ctx.fillStyle = PAL.epiNuc;
      ctx.beginPath();
      ctx.ellipse(x, yBot - (yBot - yTop) * 0.32, w * 0.16, (yBot - yTop) * 0.14, 0, 0, TAU);
      ctx.fill();
      // cilia on top, beating in a wave
      ctx.strokeStyle = PAL.cilia;
      ctx.lineWidth = 1;
      for (let j = 0; j < 4; j++) {
        const cx = x - w * 0.3 + j * w * 0.2;
        const sway = Math.sin(this.now * 6 - i * 0.7 - j * 0.4) * 2.2 * k * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, yTop + 1);
        ctx.quadraticCurveTo(cx + sway * 0.5, yTop - 2.4 * k, cx + sway, yTop - 4 * k);
        ctx.stroke();
      }
      if (e.state === 'infected' || e.state === 'docked') {
        // virus inside: a few virions assembling, and flags (viral peptides on MHC I) on the side facing the T cells
        const n = 1 + Math.floor(e.load * 5);
        for (let j = 0; j < n; j++) paintVirion(ctx, sim.virusKind, x + (hash(j + i * 7) - 0.5) * w * 0.5, yTop + (yBot - yTop) * (0.25 + hash(j * 3 + i) * 0.3), Math.max(1.6, 0.9 * k), this.now + j);
        for (let j = 0; j < 3; j++) {
          const fx = x - w * 0.3 + j * w * 0.3, fy = yBot;
          ctx.strokeStyle = '#7d4bc4';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx, fy + 3.2 * k);
          ctx.stroke();
          ctx.fillStyle = PAL.flag;
          ctx.beginPath();
          ctx.moveTo(fx, fy + 3.2 * k);
          ctx.lineTo(fx + 2.6 * k, fy + 2.4 * k);
          ctx.lineTo(fx, fy + 1.6 * k);
          ctx.fill();
        }
        // the load: how close it is to bursting
        ctx.strokeStyle = 'rgba(155,93,229,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, yTop + (yBot - yTop) * 0.5, w * 0.36, -Math.PI / 2, -Math.PI / 2 + TAU * e.load);
        ctx.stroke();
      } else if (e.state === 'hidden') {
        // no flags: only a faint shimmer gives it away
        glow(ctx, x, yTop + (yBot - yTop) * 0.5, w * 0.6, '200,160,255', 0.12 + 0.08 * Math.sin(this.now * 4 + i));
      } else if (e.protect > 0) {
        // interferon: an antiviral state, a faint lavender veil
        ctx.fillStyle = `rgba(220,192,255,${0.25 * clamp(e.protect / 3)})`;
        rr(ctx, x - w / 2 + 1, yTop, w - 2, yBot - yTop, 5);
        ctx.fill();
      }
    });
    for (const v of sim.virions) paintVirion(ctx, sim.virusKind, sx(L, v.x), sy(L, v.y), Math.max(2, 1.1 * k), this.now * 2 + v.x);
  }

  // ── the blood ────────────────────────────────────────────────────────────────────
  private drawVessel(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L, k = L.k;
    const lt = sy(L, RULES.lumenTop), lb = sy(L, RULES.lumenBot), mid = (lt + lb) / 2;
    // red cells flowing past (biconcave discs)
    const W = L.wx1 - L.wx0 + 40;
    for (let i = 0; i < 16; i++) {
      const x = L.wx0 - 20 + (((this.now * 42 * k + i * (W / 16) + hash(i) * 30) % W) + W) % W;
      const y = mid + (hash(i * 3.3) - 0.5) * (lb - lt) * 0.6;
      const rx = 2.6 * k, ry = 1.5 * k * (0.7 + 0.3 * Math.sin(this.now * 3 + i));
      ctx.fillStyle = PAL.rbc;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PAL.rbcLight;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 0.45, ry * 0.45, 0.2, 0, TAU);
      ctx.fill();
    }
    // the wall's selectin pads: lit where the alarm reached
    const wall = sy(L, RULES.wallY);
    for (const p of sim.pads) {
      const x = sx(L, p.x);
      ctx.fillStyle = p.lit >= 1 ? '#ffd27a' : `rgba(255,210,122,${0.15 + 0.5 * p.lit})`;
      rr(ctx, x - 3.5 * k, wall + 0.2 * k, 7 * k, 1.3 * k, 1);
      ctx.fill();
      if (p.lit > 0) glow(ctx, x, wall + k, (4 + 5 * p.lit) * k, '255,210,122', 0.25 * p.lit);
    }
    for (const f of this.padFlash) glow(ctx, sx(L, f.x), wall + k, 12 * k, '255,226,160', 0.7 * (1 - f.t));
    // the white cells in the blood: tumbling, rolling, stopping, squeezing through
    const r = RULES.neut.r * k * 0.85;
    for (const f of sim.flow) {
      const x = sx(L, f.x);
      const look = { t: this.now, seed: f.seed, dir: 0, speed: 0, eyes: k * RULES.neut.r >= 8 };
      if (f.state === 'flow') {
        paintNeutrophil(ctx, x, mid + Math.sin(this.now * 4 + f.seed * 9) * (lb - lt) * 0.18, r * 0.9, { ...look, dir: this.now * 3 + f.seed * 6, eyes: false });
      } else if (f.state === 'roll') {
        paintNeutrophil(ctx, x, lt + r * 0.95, r, { ...look, dir: this.now * 2.2 + f.seed * 6 });
        glow(ctx, x, lt, r * 1.4, '255,210,122', 0.25);
      } else if (f.state === 'arrest') {
        paintNeutrophil(ctx, x, lt + r * 0.8, r, { ...look, dir: -Math.PI / 2, speed: 0.4 });
      } else {
        // squeezing through the junction: half in the vessel, half in the tissue
        const p = clamp(f.t / RULES.recruit.squeeze);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - r * 2, wall - r * 3, r * 4, (lt - wall) + r * 3.2);
        ctx.clip();
        paintNeutrophil(ctx, x, wall - r * 1.1 * p + (1 - p) * r, r * (0.75 + 0.25 * p), { ...look, dir: -Math.PI / 2, speed: 1 });
        ctx.restore();
        ctx.fillStyle = '#f2e9ff';
        ctx.beginPath();
        ctx.ellipse(x, lt + r * 0.5 * (1 - p), r * 0.55 * (1 - p), r * 0.5 * (1 - p), 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ── the alarm: rings and the threshold ───────────────────────────────────────────
  private drawRings(ctx: CanvasRenderingContext2D, sim: OdpSim, pulse: number): void {
    const L = this.L, k = L.k;
    ctx.save();
    // the in-world gauge: around the signal's source, the reach now (soft) and the threshold (gold, dashed)
    const src = sim.scene === 'skin' ? sim.makro : undefined;
    const showGauge = !sim.blind && sim.phase === 'play' && sim.block.kind === 'push' && !sim.card;
    if (src && showGauge) {
      const x = sx(L, src.x), y = sy(L, src.y);
      const R = sim.reach * k, T = sim.reachAt * k;
      const above = sim.reach >= sim.reachAt;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y, R * 1.05, above ? '255,210,122' : '255,236,220', above ? 0.1 + 0.05 * pulse : 0.06);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = above ? 'rgba(255,214,120,0.75)' : 'rgba(255,248,239,0.45)';
      ctx.lineWidth = 2;
      circle(ctx, x, y, R);
      ctx.stroke();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,209,102,0.9)';
      ctx.lineWidth = 1.6;
      circle(ctx, x, y, T);
      ctx.stroke();
      ctx.setLineDash([]);
      // the threshold's tag on the ring
      const tag = t('w.threshold');
      const size = fitFont(ctx, tag, 80 * L.u, 13 * L.u, 13, 800);
      ctx.font = font(size, 800);
      const tw = ctx.measureText(tag).width + 8;
      const tx = clamp(x + T * Math.cos(-0.7), tw / 2 + 6, L.w - tw / 2 - 6), ty = Math.max(L.field.y + size, y + T * Math.sin(-0.7));
      rr(ctx, tx - tw / 2, ty - size * 0.7, tw, size * 1.4, size * 0.7);
      ctx.fillStyle = 'rgba(42,18,34,0.6)';
      ctx.fill();
      ctx.fillStyle = PAL.gold;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, tx, ty + 0.5);
    }
    // the waves themselves
    ctx.globalCompositeOperation = 'lighter';
    for (const r of sim.rings) {
      if (sim.blind && (r.kind === 'alarm' || r.kind === 'ifn')) continue;
      const a = clamp(1 - r.t / (RULES.ringGrow + 0.5));
      const col = r.kind === 'growth' ? PAL.growth : r.kind === 'ifn' ? PAL.ifn : r.kind === 'mast' ? PAL.mastRing : PAL.ring;
      const x = sx(L, r.x), y = sy(L, r.y), rad = r.r * k;
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.12 * a;
      ctx.lineWidth = 9;
      circle(ctx, x, y, rad);
      ctx.stroke();
      ctx.globalAlpha = 0.55 * a;
      ctx.lineWidth = r.kind === 'gulp' ? 3 : 1.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawNets(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L;
    for (const n of sim.netsUp) {
      const a = Math.min(1, n.life / 1.2, (n.max - n.life) / 0.3 + 0.2);
      paintNet(ctx, sx(L, n.x), sy(L, n.y), n.r * L.k * Math.min(1, (n.max - n.life) / 0.35 + 0.3), a, this.now, n.x * 0.1);
    }
  }

  private drawBugs(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L, k = L.k;
    for (const b of sim.bugs) {
      if (b.hidden) continue;
      const spec = PATHOGEN[b.kind];
      const r = (spec.shape === 'coccus' ? RULES.bug.coccus : RULES.bug.rodW * 1.25) * k;
      const x = sx(L, b.x), y = sy(L, b.y);
      if (b.tag >= 1) glow(ctx, x, y, r * 3.2, '255,209,102', 0.35);
      else glow(ctx, x, y, r * 2.6, rgbOf(spec.body), 0.18);
      const split = b.div < 0.8 && !b.grabbed ? 1 - b.div / 0.8 : 0;
      paintBug(ctx, b.kind, x, y, Math.max(2.2, r), {
        a: b.a, t: this.now, seed: (b.id % 97) / 97, tag: b.tag, c3: b.c3, capsule: b.capsule, netted: b.netted > 0, split,
        pop: b.age < 0.3 ? ease.outBack(b.age / 0.3) : 1, fade: b.netted > 0 ? clamp(1 - b.netted / RULES.net.dissolve) * 0.8 : 0,
      });
    }
  }

  private drawAbs(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L;
    for (const a of sim.abs) {
      const x = sx(L, a.x), y = sy(L, a.y);
      glow(ctx, x, y, 7 * L.u, '255,209,102', 0.3);
      paintY(ctx, x, y, Math.max(3, 1.5 * L.k), Math.atan2(a.vy, a.vx) + Math.PI / 2);
    }
  }

  private drawCells(ctx: CanvasRenderingContext2D, sim: OdpSim, pulse: number): void {
    const L = this.L, k = L.k;
    // bodies first (under the living), then the cells, the big ones last
    for (const c of sim.cells) if (c.kind === 'neut' && c.state === 'body') paintBody(ctx, sx(L, c.x), sy(L, c.y), c.r * k * 0.8, c.seed, clamp((c.st - (RULES.neut.bodySec - 3)) / 3));
    const order = sim.cells.filter(c => c.state !== 'gone' && c.state !== 'body').sort((a, b) => (a.kind === 'mac' ? 1 : 0) - (b.kind === 'mac' ? 1 : 0));
    for (const c of order) this.drawCell(ctx, c, sim, pulse);
  }

  private drawCell(ctx: CanvasRenderingContext2D, c: Cell, sim: OdpSim, pulse: number): void {
    const L = this.L, k = L.k;
    const x = sx(L, c.x), y = sy(L, c.y), r = c.r * k;
    const sp = Math.hypot(c.vx, c.vy);
    const dir = sp > 1 ? Math.atan2(c.vy, c.vx) : Math.PI / 2;
    const gut = c.gut.map(g => ({ color: PATHOGEN[g.kind].body, k: g.t / g.dur }));
    if (c.grab) gut.push({ color: PATHOGEN[c.grab.bug.kind].body, k: 0 });
    const gulp = c.grab ? Math.sin(clamp(c.grab.t / c.grab.dur) * Math.PI) : 0;
    const look = { t: this.now, seed: c.seed, dir, speed: clamp(sp / 30), gut, gulp };
    switch (c.kind) {
      case 'neut': {
        const spent = c.state === 'spent' ? clamp(c.st / RULES.neut.spentSec) : 0;
        // in a rest the swarm dozes: half-closed eyes, a slow breathing glow
        const doze = sim.restBlock && !c.grab && !c.gut.length ? 0.55 : 0;
        const br = sim.breath, bv = br ? (br.inhale ? 0.5 - 0.5 * Math.cos(Math.PI * br.k) : 0.5 + 0.5 * Math.cos(Math.PI * br.k)) : 0;
        glow(ctx, x, y, r * (2.2 + 0.5 * bv), sim.bursting > 0 ? '160,225,255' : '236,226,255', sim.bursting > 0 ? 0.55 : 0.22 + 0.05 * pulse + 0.1 * bv);
        paintNeutrophil(ctx, x, y, r, { ...look, spent, doze, burst: sim.bursting > 0 ? 1 : 0, anucleate: c.anucleate, eyes: r >= 6 });
        if (c.grab) {
          // pseudopods wrapping the bacterium
          const b = c.grab.bug, bx = sx(L, b.x), by = sy(L, b.y);
          ctx.strokeStyle = PAL.neutEdge;
          ctx.lineWidth = Math.max(1.5, r * 0.25);
          const p = clamp(c.grab.t / c.grab.dur);
          ctx.beginPath();
          ctx.arc(bx, by, r * 0.55, Math.atan2(y - by, x - bx) - Math.PI * p, Math.atan2(y - by, x - bx) + Math.PI * p);
          ctx.stroke();
        }
        break;
      }
      case 'mac':
        glow(ctx, x, y, r * 1.9, c.m2 > 0.5 ? '200,255,190' : '255,220,170', 0.2);
        paintMacrophage(ctx, x, y, r, { ...look, m2: c.m2 });
        break;
      case 'dc':
        glow(ctx, x, y, r * 2.4, '200,240,255', 0.25);
        paintDendritic(ctx, x, y, r, look);
        break;
      case 'tcell':
      case 'nk':
        glow(ctx, x, y, r * 2.1, c.kind === 'nk' ? '230,200,255' : '190,225,255', 0.25);
        paintLymphocyte(ctx, x, y, r, look, c.kind === 'nk');
        if (c.state === 'dock') {
          ctx.strokeStyle = 'rgba(159,208,255,0.8)';
          ctx.lineWidth = 2;
          circle(ctx, x, y - r * 0.9, r * (0.5 + 0.2 * Math.sin(this.now * 10)));
          ctx.stroke();
        }
        break;
      case 'mast':
        paintMast(ctx, x, y, r, this.now, c.seed, pulse);
        break;
      default:
        break;
    }
  }

  /** Where a tap sent the swarm, and where the finger leads (drawn above the finger). */
  private drawMarks(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L, u = L.u;
    if (sim.mark) {
      const k = clamp(sim.mark.t / 1.2), x = sx(L, sim.mark.x), y = sy(L, sim.mark.y);
      ctx.strokeStyle = `rgba(255,248,239,${0.8 * (1 - k)})`;
      ctx.lineWidth = 2;
      circle(ctx, x, y, (6 + 14 * ease.outCubic(k)) * u);
      ctx.stroke();
    }
    const d = this.drag;
    if (d && d.mode === 'lead') {
      ctx.strokeStyle = 'rgba(255,248,239,0.25)';
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.lx, d.ly);
      ctx.stroke();
      ctx.setLineDash([]);
      glow(ctx, d.lx, d.ly, 26 * u, '255,248,239', 0.18);
      ctx.strokeStyle = 'rgba(255,248,239,0.75)';
      ctx.lineWidth = 2;
      circle(ctx, d.lx, d.ly, 9 * u + Math.sin(this.now * 6) * 1.5);
      ctx.stroke();
    } else if (d && d.mode === 'stroke') {
      ctx.strokeStyle = 'rgba(255,242,230,0.75)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(d.sx0, d.sy0);
      ctx.lineTo(d.lx, d.ly);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  /** The news of a moment in a dark pill under the strip (readable over any cell). */
  private drawToast(ctx: CanvasRenderingContext2D, x: { text: string; color: string; t: number; dur: number }): void {
    const L = this.L, u = L.u;
    const a = Math.min(1, x.t / 0.2, (x.dur - x.t) / 0.35);
    if (a <= 0) return;
    const maxW = Math.min(L.field.w - 32 * u, 520 * u);
    const size = fitFont(ctx, x.text, maxW - 28 * u, 15 * u, MIN_READ, 800);
    ctx.font = font(size, 800);
    const w = Math.min(maxW, ctx.measureText(x.text).width + 28 * u), h = size + 14 * u;
    const cx = L.w / 2, cy = Math.max(L.song.y + L.song.h, L.strip.y + L.strip.h, this.bubbleBottom) + 10 * u + h / 2 + (1 - Math.min(1, x.t / 0.25)) * -6 * u;
    ctx.save();
    ctx.globalAlpha = a;
    rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(38,14,30,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = x.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(x.text, cx, cy + 0.5);
    ctx.restore();
  }

  /** The trip to the lymph node, in an inset: a B cell meets the piece, plasma cells send antibodies out. */
  private drawNode(ctx: CanvasRenderingContext2D, sim: OdpSim): void {
    const L = this.L, u = L.u;
    const tN = this.nodeT;
    const a = Math.min(1, tN / 0.4, (4.6 - tN) / 0.5);
    const w = Math.min(160 * u, L.field.w * 0.42), h = w * 0.62;
    const x = Math.min(L.field.x + L.field.w - w - 12 * u, L.wx1 - w - 6 * u), y = sy(L, 30);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    rr(ctx, x, y, w, h, 14 * u);
    ctx.fillStyle = 'rgba(38,24,56,0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(205,238,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // the node: a bean with follicles
    const cx = x + w / 2, cy = y + h * 0.58;
    ctx.fillStyle = '#5b3f7a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.36, h * 0.3, 0, 0, TAU);
    ctx.fill();
    const look = { t: this.now, seed: 0.4, dir: 0, speed: 0, eyes: false };
    paintLymphocyte(ctx, cx - w * 0.14, cy, h * 0.13, look, false);
    paintDendritic(ctx, cx - w * 0.3, cy - h * 0.05, h * 0.09, { ...look, seed: 0.8 });
    // antibodies flying out (after the B cell lights)
    if (tN > 1.4) for (let i = 0; i < 5; i++) {
      const p = ((tN - 1.4) * 0.8 + i * 0.2) % 1;
      paintY(ctx, cx + w * 0.05 + p * w * 0.35, cy - h * 0.1 + Math.sin(i * 2 + p * 4) * h * 0.12, Math.max(3, h * 0.05), 0.3);
    }
    const title = t('fact.dendrytyczna');
    const size = fitFont(ctx, title, w - 16 * u, 13 * u, 11, 800);
    ctx.font = font(size, 800);
    ctx.fillStyle = '#e6f7ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, cx, y + 7 * u);
    ctx.restore();
    void sim;
  }
}
