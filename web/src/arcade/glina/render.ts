/**
 * Glina's play view (canvas 2D): the potter's house with the customer at the counter and the order
 * ticket (the ghost silhouette, the glaze, the band, the live match and its stars), the wheel with
 * the turning clay (lit row by row in vessel.ts), the order's dashed outline on the stage, the
 * master's golden guide line and its arrow, the potter's hand at the finger, the spirit level on
 * the wheel's frame (the band's steadiness: the bubble inside the threshold marks when steady), the
 * throwing rings on the wheel head (the band's last 40 s), the master's hand ring, the Gotowe
 * button; the glazing wheel with the palette; the kiln with its heat gauge (the even heat widens
 * the green, the threshold ticks on the dial); the sale with the customer's reaction and the coins;
 * Szamot on the shelf with his bubble; the story cards.  Juice: hit-stop on a perfect firing and a
 * master's spin, clay splashes, sparkles, flying coins and numbers, a pitch-rising streak.
 */
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import { MIN_READ, fitText, target } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { traceBars } from '../kit/trace';
import { FORM, GLAZE_NAME, PATTERN_NAME, type GlazeId } from './content';
import { cap, coinsText, quote, t } from './i18n';
import { layout, palette, stageScale, type Layout, type Palette, type Rect } from './layout';
import { C, GLAZE, SANS, SERIF, cardBox, font, hand, mix, star } from './paint';
import { RULES, zoneOf } from './rules';
import { Room, cat, coin, customer, kilnDome, kilnDoor, type CatPose, type Mood } from './scene';
import { RINGS, type Target } from './shape';
import { reactionText, type GlinaEvent, type GlinaSim, type Piece } from './sim';
import { drawVessel, look, radiusAt, type VesselLook } from './vessel';

const TAU = Math.PI * 2;

interface Flyer { x: number; y: number; vx: number; vy: number; t: number; tx: number; ty: number }

export class GlinaView {
  readonly ctx: CanvasRenderingContext2D;
  size = { w: 1, h: 1, dpr: 1 };
  L: Layout = layout(800, 600, 120);
  private readonly room = new Room();
  private readonly fx = new Particles(500);
  private readonly floats = new Floaters();
  private readonly shake: Shake;
  private readonly reduced: boolean;
  private readonly pot: VesselLook = look();
  private readonly small: VesselLook = look();
  private t = 0;
  private stop = 0;
  /** the customer at the counter: who, how far in (0..1), mood, the reaction on show */
  private who: Piece['order']['customer'] | null = null;
  private walk = 0;
  private mood: Mood = 'wait';
  private react: { text: string; stars: number; coins: number; t: number; who: Piece['order']['customer'] } | null = null;
  private catPose: CatPose = 'sit';
  private catPoseT = 0;
  private spinGlow = 0;
  private dipT = 9;
  private fireText: { text: string; t: number; good: boolean } | null = null;
  private banner: { text: string; t: number; color: string } | null = null;
  private coins: Flyer[] = [];
  private cut: { piece: Piece; t: number; market: boolean } | null = null;
  private stroke = 0;
  private salePiece: Piece | null = null;
  /** the glazing palette for the counts owned */
  private pal: { nc: number; np: number; p: Palette } | null = null;
  /** the card on screen as last drawn (a tap there goes on) */
  private cardRect: Rect | null = null;
  /** the control last pressed, how long ago (s), and whether a finger still holds it */
  private pressed: { key: string; t: number; held: boolean } | null = null;

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
    this.reduced = opts.reducedMotion;
    this.shake = new Shake(opts.reducedMotion);
  }

  get context(): CanvasRenderingContext2D { return this.ctx; }

  resize(w: number, h: number, dpr: number, insets: Insets | number): void {
    this.size = { w, h, dpr };
    this.L = layout(w, h, insets);
    this.pal = null;
  }

  // ── geometry the input needs ────────────────────────────────────
  /** px per cm of the current order on the throwing stage. */
  scaleFor(tg: Target): number { return stageScale(this.L, tg); }

  /** The glazing palette for the glazes and patterns owned (made once per size and count). */
  palette(sim: GlinaSim): Palette {
    const nc = sim.p.glazes.length, np = sim.p.patterns.length;
    if (!this.pal || this.pal.nc !== nc || this.pal.np !== np) this.pal = { nc, np, p: palette(this.L, nc, np) };
    return this.pal.p;
  }

  /** The glazing stage's top: under the (compact, upright) ticket, or the throwing stage's top. */
  private glazeTop(sim: GlinaSim): number {
    const P = this.palette(sim);
    return this.L.portrait ? P.ticket.y + P.ticket.h + 12 : this.L.floor - this.L.stageH;
  }

  /** the glazing stage's scale (the palette takes the bottom) */
  glazeScale(tg: Target, sim: GlinaSim): number {
    return stageScale(this.L, tg, Math.max(60, this.palette(sim).floor - this.glazeTop(sim)));
  }

  /** A finger on the clay (touch): where it is, drawn as a ring with a thread to the hand above it. */
  finger: { x: number; y: number } | null = null;

  /**
   * What the player can tap right now (kit/mobile auditTargets): a card on screen (a tap goes on); the
   * glazing palette's colours, patterns and Gotowe; the wheel's Gotowe while shaping.  The clay, the kiln's
   * needle (a tap anywhere stops it) and the sale (a tap anywhere hurries it) are the free play area.
   */
  targets(sim: GlinaSim): TapTarget[] {
    if (!sim.started || sim.ended) return [];
    if (sim.card) return this.cardRect && (sim.card.kind !== 'open' || sim.card.t >= 0.6) ? [target('card', this.cardRect)] : [];
    const pc = sim.glazing;
    if (pc) {
      const P = this.palette(sim);
      return [
        ...P.colors.map((c, i) => target(`glaze ${sim.p.glazes[i]}`, { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 })),
        ...P.patterns.map((r, i) => target(`pattern ${sim.p.patterns[i]}`, r)),
        target('glazing Gotowe', P.done),
      ];
    }
    if (sim.wheel === 'shape' && sim.pot && sim.order) return [target('Gotowe', this.L.done)];
    return [];
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: GlinaEvent, sim: GlinaSim): void {
    const L = this.L;
    switch (e.type) {
      case 'walk':
        this.who = e.order.customer;
        this.walk = 0;
        this.mood = 'wait';
        this.react = null;
        break;
      case 'order':
        this.fx.burst(L.axis, L.floor - 10, 14, { color: C.wet, size: 3, speed: 140, angle: -Math.PI / 2, spread: 2.4, g: 500 });
        break;
      case 'assist':
        this.banner = { text: t('ui.assist'), t: 0, color: C.gold };
        break;
      case 'spin':
        this.spinGlow = 1;
        this.stop = 0.09;
        this.shake.add(0.25);
        this.banner = { text: t('ui.spin'), t: 0, color: '#F2B53A' };
        this.fx.burst(L.axis, L.floor - L.stageH * 0.4, 40, { color: '#FFD86B', shape: 'spark', speed: 320, g: 0, drag: 2, life: 1 });
        this.catPose = 'shock';
        this.catPoseT = 1.4;
        break;
      case 'cut':
        this.cut = { piece: e.piece, t: 0, market: e.market };
        this.fx.burst(L.axis, L.floor - 6, 10, { color: '#B9B1A6', shape: 'spark', speed: 220, g: 0, angle: 0, spread: 0.5, life: 0.4 });
        if (e.piece.match >= RULES.shapeStars[1]) this.floats.add('★★★', L.axis, L.floor - 40, { color: '#F2B53A', size: 30 });
        break;
      case 'dip':
        this.dipT = 0;
        this.fx.burst(L.axis, this.palette(sim).floor - 20, 18, { color: GLAZE[e.glaze].c, size: 3.5, speed: 160, g: 600 });
        break;
      case 'band':
        this.fx.burst(L.axis + 30, this.palette(sim).floor - 40, 6, { color: GLAZE[e.glaze].c, size: 2.5, speed: 90, g: 300 });
        break;
      case 'heat':
        this.fx.burst(L.kiln.x + L.kiln.w / 2, L.kiln.y + L.kiln.h * 0.7, 16, { color: '#FFB060', shape: 'spark', speed: 140, g: -40, life: 0.8 });
        break;
      case 'fire': {
        const good = e.grade === 'perfect' || e.grade === 'good';
        this.fireText = { text: t(`ui.fire.${e.grade}` as 'ui.fire.good'), t: 0, good };
        if (e.grade === 'perfect') {
          this.stop = 0.08;
          this.shake.add(0.2);
          const g = this.gaugeGeom(sim);
          this.fx.burst(g.x, g.y - g.r * 0.6, 34, { color: '#FFD86B', shape: 'spark', speed: 300, g: 0, drag: 2.5 });
          this.catPose = 'happy';
          this.catPoseT = 1.6;
        }
        break;
      }
      case 'open':
        this.fx.burst(L.kiln.x + L.kiln.w / 2, L.kiln.y + L.kiln.h * 0.6, 26, { color: 'rgba(240,235,230,.8)', size: 6, speed: 80, g: -60, drag: 1.5, life: 1.4 });
        break;
      case 'sale': {
        const pc = e.piece;
        this.who = pc.order.customer;
        this.walk = 1;
        this.mood = pc.stars === 3 ? 'wow' : pc.stars === 2 ? 'happy' : 'meh';
        this.react = { text: reactionText(pc), stars: pc.stars, coins: pc.price + pc.tip, t: 0, who: pc.order.customer };
        this.salePiece = pc;
        const c = this.counterTop();
        for (let i = 0; i < Math.min(12, 3 + Math.round((pc.price + pc.tip) / 6)); i++) {
          this.coins.push({ x: c.x + (Math.random() - 0.5) * 40, y: c.y - 10, vx: (Math.random() - 0.3) * 160, vy: -180 - Math.random() * 120, t: -i * 0.04, tx: this.L.w - 70, ty: Math.max(20, this.L.top - 40) });
        }
        this.floats.add(`+${pc.price + pc.tip}`, c.x, c.y - 30, { color: '#F2B53A', size: 30 });
        if (e.streak >= 2) this.floats.add(t('ui.streak', { n: e.streak }), c.x, c.y - 70, { color: '#E2572B', size: 24, dur: 1.4 });
        if (pc.stars === 3) this.shake.add(0.08);
        break;
      }
      case 'market':
        this.floats.add(`${t('ui.market', { n: e.n })} +${e.coins}`, L.axis, L.floor - L.stageH * 0.5, { color: '#F2B53A', size: 22, dur: 1.6 });
        break;
      case 'newForm':
        this.banner = { text: t('ui.newForm', { form: FORM[e.form].name }), t: 0, color: C.terracotta };
        break;
      case 'unlock':
        this.banner = { text: t('ui.unlock', { form: FORM[e.form].name }), t: 0, color: '#3F6E9C' };
        break;
      case 'gift':
        this.banner = { text: t('ui.gift', { gift: giftName(e.gift) }), t: 0, color: C.blush };
        this.floats.add(`+${e.coins}`, L.kiln.x + L.kiln.w / 2, L.kiln.y, { color: '#F2B53A', size: 26 });
        break;
      case 'reveal':
        this.banner = { text: t('ui.reveal', { pct: Math.round(e.share * 100) }), t: 0, color: '#6B5B73' };
        if (e.coins) this.floats.add(`+${e.coins}`, L.axis, L.floor - L.stageH * 0.6, { color: '#F2B53A', size: 26 });
        break;
      case 'stroke':
        this.stroke = 0.2;
        break;
      default:
        break;
    }
  }

  private counterTop(): { x: number; y: number } {
    const c = this.L.customer;
    return { x: c.x, y: c.y - c.s * 0.42 };
  }

  update(dt: number, sim: GlinaSim): void {
    if (this.stop > 0) {
      this.stop -= dt;
      dt *= 0.15;
    }
    this.t += dt;
    this.fx.update(dt);
    this.floats.update(dt);
    this.walk = Math.min(1, this.walk + dt / RULES.walkSec);
    this.spinGlow = Math.max(0, this.spinGlow - dt * 0.6);
    this.dipT += dt;
    this.stroke = Math.max(0, this.stroke - dt);
    if (this.pressed && !this.pressed.held && (this.pressed.t += dt) > 0.3) this.pressed = null;
    if (this.catPoseT > 0) this.catPoseT -= dt;
    if (this.react) {
      this.react.t += dt;
      if (this.react.t > 3.2) this.react = null;
    }
    if (this.fireText) {
      this.fireText.t += dt;
      if (this.fireText.t > 2.2) this.fireText = null;
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 2.4) this.banner = null;
    }
    if (this.cut) {
      this.cut.t += dt;
      if (this.cut.t > 0.8) this.cut = null;
    }
    for (const c of this.coins) {
      c.t += dt;
      if (c.t < 0) continue;
      if (c.t < 0.45) {
        c.vy += 700 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      } else {
        const k = Math.min(1, (c.t - 0.45) * 3);
        c.x += (c.tx - c.x) * k;
        c.y += (c.ty - c.y) * k;
      }
    }
    this.coins = this.coins.filter(c => c.t < 1.1);
    // clay splashes while a finger works the wall
    if (sim.finger && sim.wheel === 'shape' && Math.random() < dt * 14) {
      const p = this.fingerPx(sim);
      if (p) this.fx.burst(p.x, p.y, 1, { color: 'rgba(110,70,50,.8)', size: 2, speed: 120, angle: p.x > this.L.axis ? 0 : Math.PI, spread: 1.2, g: 500, life: 0.5 });
    }
    // the cat: asleep in a calm kiln, talking when he talks
    if (this.catPoseT <= 0) this.catPose = sim.talk.line ? 'talk' : sim.restBlock && sim.heat > 0.7 && sim.kiln !== 'fire' ? 'sleep' : 'sit';
  }

  // ── the frame ───────────────────────────────────────────────────
  draw(sim: GlinaSim): void {
    const { ctx, L } = this;
    const { w, h, dpr } = this.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const sh = this.shake.offset(1 / 60, 8);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    this.room.draw(ctx, L, dpr);
    this.drawShelf(sim);
    this.drawKiln(sim);
    this.drawCustomer(sim);
    const glazing = sim.glazing;
    if (glazing) this.drawGlazing(sim, glazing);
    else this.drawWheel(sim);
    this.drawGauge(sim);
    this.drawSalePiece();
    this.drawTicket(sim);
    this.drawCat(sim);
    this.fx.draw(ctx);
    for (const c of this.coins) if (c.t >= 0) coin(ctx, c.x, c.y, 7 * L.u + 2, this.t * 9 + c.vx);
    ctx.restore();
    this.floats.draw(ctx, SERIF);
    this.drawBanner();
    this.drawCard(sim);
  }

  // ── the shelf: the batch drying, the market basket ───────────────
  private drawShelf(sim: GlinaSim): void {
    const { ctx, L } = this, s = L.shelf;
    const pieces = sim.batch.filter(p => !p.sold && (sim.kiln === 'cold' || sim.kiln === 'cool' || sim.kiln === 'glaze') && p !== sim.glazing);
    const n = Math.max(1, sim.cap);
    const slot = Math.min(60 * L.u, s.w / (n + 1.2));
    for (let i = 0; i < n; i++) {
      const x = s.x + slot * (i + 0.7);
      ctx.strokeStyle = 'rgba(59,42,34,.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, s.y, slot * 0.3, slot * 0.07, 0, 0, TAU);
      ctx.stroke();
      const pc = pieces[i];
      if (!pc) continue;
      const sc = (slot * 0.7) / Math.max(pc.H, maxR(pc.r) * 2.2);
      Object.assign(this.small, look(), {
        x, y: s.y, scale: sc, H: pc.H, r: pc.r, body: pc.glaze ? 'glazed' : 'leather', glaze: pc.glaze, fired: 0.7, rows: 30, specks: false,
        bands: pc.bands.map(b => ({ u: b.u, glaze: b.glaze, pattern: b.pattern, k: b.t })), attach: FORM[pc.order.form].attach,
      });
      drawVessel(ctx, this.small);
    }
    // the market basket at the shelf's end
    if (sim.market.length) {
      const bx = Math.min(s.x + s.w - slot * 0.4, L.portrait ? s.x + s.w - slot * 0.4 : L.cat.x - L.cat.s * 0.8 - slot * 0.4), by = s.y;
      ctx.fillStyle = '#B08850';
      ctx.beginPath();
      ctx.moveTo(bx - slot * 0.4, by - slot * 0.3);
      ctx.lineTo(bx + slot * 0.4, by - slot * 0.3);
      ctx.lineTo(bx + slot * 0.3, by);
      ctx.lineTo(bx - slot * 0.3, by);
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.font = font(800, 14 * L.u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t('ui.market', { n: sim.market.length }), Math.min(bx, L.right - ctx.measureText(t('ui.market', { n: sim.market.length })).width / 2), s.y + s.h + 6);
    }
    if (sim.station === 'wheel' && !L.portrait) {
      ctx.fillStyle = C.muted;
      ctx.font = font(700, 13 * L.u, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(t('ui.shelf', { n: Math.min(sim.batch.length, sim.cap), cap: sim.cap }), s.x, s.y + s.h + 6);
    }
  }

  // ── the kiln ─────────────────────────────────────────────────────
  private drawKiln(sim: GlinaSim): void {
    const { ctx, L } = this;
    const hot = sim.kiln === 'heat' || sim.kiln === 'fire' ? 1 : sim.kiln === 'open' ? 0.7 : sim.kiln === 'sell' ? 0.35 : sim.kiln === 'glaze' && sim.restBlock ? 0.3 : 0.05;
    const flick = 0.5 + 0.5 * Math.sin(this.t * (9 - 5 * sim.heat)) * (1 - sim.heat * 0.7);
    kilnDome(ctx, L.kiln, hot, flick);
    // the batch inside while it fires
    if (sim.kiln === 'heat' || sim.kiln === 'fire' || sim.kiln === 'open') {
      const d = kilnDoor(L.kiln), list = sim.batch.filter(p => !p.sold).slice(0, 4);
      list.forEach((pc, i) => {
        const x = d.x + d.w * ((i + 0.5) / list.length), sc = (d.h * 0.55) / Math.max(pc.H, maxR(pc.r) * 3);
        Object.assign(this.small, look(), {
          x, y: d.y + d.h - 4, scale: sc, H: pc.H, r: pc.r, body: 'glazed', glaze: pc.glaze, fired: sim.kiln === 'open' ? 1 : 0.5, rows: 20,
          specks: false, glow: sim.kiln === 'open' ? 0.3 : 0.8, alpha: 0.95,
        });
        drawVessel(ctx, this.small);
      });
    }
  }

  /** The heat gauge: big at the stage while the kiln fires, small over the kiln while it heats. */
  private gaugeGeom(sim: GlinaSim): { x: number; y: number; r: number; big: boolean } {
    const L = this.L;
    const big = sim.kiln === 'heat' || sim.kiln === 'fire' || (sim.kiln === 'open' && !!this.fireText);
    if (big) {
      const r = Math.min(L.stageW * 1.25, L.stageH * 0.55, L.w * 0.4);
      return { x: L.axis, y: L.floor - L.stageH * 0.18, r, big };
    }
    return { x: L.gauge.x, y: L.gauge.y, r: L.gauge.r, big };
  }

  private drawGauge(sim: GlinaSim): void {
    if (sim.kiln === 'cold' || sim.kiln === 'sell' || (sim.kiln === 'cool' && !sim.restBlock)) return;
    if (sim.kiln === 'open' && !this.fireText) return;
    const { ctx } = this;
    const g = this.gaugeGeom(sim);
    if (!g.big && this.L.portrait) return;
    const z = zoneOf(sim.heat, sim.p.kiln);
    const a0 = Math.PI, a1 = TAU;
    const ang = (x: number) => a0 + (a1 - a0) * x;
    ctx.save();
    // the dial's face
    ctx.fillStyle = 'rgba(42,29,24,.86)';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * 1.08, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    const lw = g.r * 0.2;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    // cold → hot ramp
    for (let i = 0; i < 24; i++) {
      const k = i / 24;
      ctx.strokeStyle = mix('#3F6E9C', '#E2572B', k);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * 0.8, ang(k), ang(k + 1 / 24) + 0.01);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the green and its gold heart
    ctx.strokeStyle = '#6FBF4A';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * 0.8, ang(z.lo), ang(z.hi));
    ctx.stroke();
    ctx.strokeStyle = '#F2C230';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * 0.8, ang(z.glo), ang(z.ghi));
    ctx.stroke();
    // the threshold ticks: where the green's edges sit at even heat 0.5 (calm above it widens past them)
    const zt = zoneOf(0.5, sim.p.kiln);
    ctx.strokeStyle = '#FFF4DC';
    ctx.lineWidth = Math.max(1.5, g.r * 0.03);
    for (const x of [zt.lo, zt.hi]) {
      const a = ang(x);
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(a) * g.r * 0.62, g.y + Math.sin(a) * g.r * 0.62);
      ctx.lineTo(g.x + Math.cos(a) * g.r * 1.02, g.y + Math.sin(a) * g.r * 1.02);
      ctx.stroke();
    }
    // the needle
    if (sim.kiln === 'fire' || (sim.kiln === 'open' && sim.fired)) {
      const x = sim.kiln === 'fire' ? sim.needle : sim.fired!.x;
      const a = ang(x);
      ctx.strokeStyle = '#FFF8EC';
      ctx.lineWidth = Math.max(2, g.r * 0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(a) * g.r * 0.95, g.y + Math.sin(a) * g.r * 0.95);
      ctx.stroke();
      ctx.fillStyle = '#FFF8EC';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * 0.08, 0, TAU);
      ctx.fill();
    }
    // the label: the even heat in words, and what to do
    ctx.fillStyle = '#FFF4DC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = font(800, Math.max(14 * this.L.u, g.r * (g.big ? 0.12 : 0.17)), SANS);
    const label = sim.kiln === 'heat' ? t('ui.heating') : sim.kiln === 'fire' ? t('ui.tapFire') : t('ui.heat');
    ctx.fillText(label, g.x, g.y - g.r * 0.2);
    // flames under the gauge: calm and blue-gold with even heat, flickering orange without
    if (g.big) {
      for (let i = 0; i < 7; i++) {
        const fx = g.x + (i - 3) * g.r * 0.12;
        const fl = 0.6 + 0.4 * Math.sin(this.t * (12 - 8 * sim.heat) + i * 1.7) * (1 - 0.7 * sim.heat);
        const fh = g.r * 0.22 * fl;
        ctx.fillStyle = mix('#E2572B', '#F2C230', sim.heat);
        ctx.beginPath();
        ctx.moveTo(fx - g.r * 0.05, g.y + g.r * 0.12);
        ctx.quadraticCurveTo(fx, g.y + g.r * 0.12 - fh * 2, fx + g.r * 0.05, g.y + g.r * 0.12);
        ctx.fill();
      }
    }
    if (this.fireText && g.big) {
      const k = this.fireText.t;
      ctx.font = font(900, g.r * 0.2 * (k < 0.2 ? ease.outBack(k / 0.2) : 1), SERIF);
      ctx.fillStyle = this.fireText.good ? '#F2C230' : '#F2A65A';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.fireText.text, g.x, g.y - g.r * 1.25);
    }
    ctx.restore();
  }

  // ── the customer at the counter ─────────────────────────────────
  private drawCustomer(sim: GlinaSim): void {
    const { ctx, L } = this, c = L.customer;
    const glazing = sim.glazing;
    const who = glazing && !this.react ? glazing.order.customer : this.who ?? sim.order?.customer ?? null;
    const show = who && (sim.wheel !== 'idle' || this.react || sim.kiln === 'sell' || !!glazing);
    if (show && who) {
      const k = ease.outCubic(this.walk);
      const x = c.x - (1 - k) * c.s * 1.2;
      const bob = this.walk < 1 ? Math.sin(this.t * 14) : this.mood === 'wow' ? Math.sin(this.t * 10) * 0.6 : 0;
      customer(ctx, who, x, c.y, c.s, this.mood, bob, k);
    }
    // the counter in front
    const cw = L.portrait ? c.s * 0.8 : Math.min(c.s * 1.4, 220), ch = c.s * 0.36;
    const cx = c.x - cw / 2, cy = c.y - ch;
    ctx.fillStyle = mix(C.wood, '#000000', 0.05);
    ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = mix(C.wood, '#E9D8BC', 0.25);
    ctx.fillRect(cx - 6, cy - 6, cw + 12, 8);
    ctx.fillStyle = 'rgba(59,42,34,.22)';
    for (let i = 1; i < 4; i++) ctx.fillRect(cx + (cw * i) / 4, cy + 4, 2, ch - 6);
  }

  /** The piece just sold: from the kiln's door to the counter, then turning there. */
  private drawSalePiece(): void {
    const { ctx, L } = this, c = L.customer;
    const cw = L.portrait ? c.s * 0.8 : Math.min(c.s * 1.4, 220), ch = c.s * 0.36;
    const cx = c.x - cw / 2, cy = c.y - ch;
    // the piece just sold, set on the counter
    const sp = this.salePiece;
    if (sp && this.react) {
      // it flies from the kiln's door to the counter, then sits there turning
      const f = Math.min(1, this.react.t / 0.45), k = ease.outCubic(f);
      const room = c.s * 0.55;
      const sc = room / Math.max(sp.H, maxR(sp.r) * 2.2);
      const d = kilnDoor(L.kiln);
      const x0 = d.x + d.w / 2, y0 = d.y + d.h, x1 = cx + cw * (L.portrait ? 0.7 : 0.78), y1 = cy - 4;
      Object.assign(this.small, look(), {
        x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k - Math.sin(f * Math.PI) * L.stageH * 0.35, scale: sc * (0.5 + 0.5 * k), H: sp.H, r: sp.r, body: 'glazed', glaze: sp.glaze, fired: 1, rows: 60,
        specks: false, gift: sp.gift, rot: this.t * 0.6, attach: FORM[sp.order.form].attach, gloss: 0.7,
        bands: sp.bands.map(b => ({ u: b.u, glaze: b.glaze, pattern: b.pattern, k: 1 })),
      });
      drawVessel(ctx, this.small);
    }
  }

  // ── the ticket ──────────────────────────────────────────────────
  /**
   * The order ticket under the HUD: ZAMÓWIENIE and the stars, the customer, the silhouette with the glaze and
   * the band asked, the live match.  Upright while glazing it shrinks to the customer and the glaze line (the
   * palette takes the bottom).  Phone sizes: 13 px label, 16 px name, 14 px glaze and band, 17 px match.
   */
  private drawTicket(sim: GlinaSim): void {
    const { ctx, L } = this;
    if (this.react && (sim.kiln === 'sell' || sim.kiln === 'cool' || sim.kiln === 'cold' || !sim.order)) {
      this.drawReaction(L.ticket);
      return;
    }
    const pc = sim.glazing;
    const o = pc ? pc.order : sim.wheel !== 'idle' ? sim.order : null;
    if (!o) {
      if (sim.restBlock && sim.kiln !== 'sell') this.drawWaiting(sim, L.ticket);
      return;
    }
    const compact = !!pc && L.portrait;
    const r = compact ? this.palette(sim).ticket : L.ticket;
    cardBox(ctx, r.x, r.y, r.w, r.h, 1, 12);
    const u = L.u, pad = 10 * u;
    const f1 = 13 * u, f2 = 16 * u, f3 = 14 * u;
    const inner = r.w - pad * 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const shaping = sim.wheel === 'shape' || sim.wheel === 'assist' || sim.wheel === 'spin';
    const m = sim.pot?.match ?? 0;
    const st = m >= RULES.shapeStars[1] ? 3 : m >= RULES.shapeStars[0] ? 2 : 1;
    if (compact) {
      // the customer and the piece's number, then the glaze and the band asked
      const all = sim.batch.length, n = Math.min(all, sim.glazeIdx + 1);
      ctx.font = font(800, f1, SANS);
      // "Szkliwienie 1/2" when the name still has room, else just "1/2"
      let count = t('ui.glazeN', { n, m: all });
      if (ctx.measureText(count).width > inner * 0.42) count = `${n}/${all}`;
      const cw = ctx.measureText(count).width;
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      ctx.fillText(count, r.x + r.w - pad, r.y + pad + 2);
      ctx.textAlign = 'left';
      ctx.fillStyle = C.ink;
      ctx.fillText(fitText(ctx, cap(t(`who.${o.customer}` as 'who.karczma')), inner - cw - 8, 15 * u, 700, SERIF, MIN_READ), r.x + pad, r.y + pad);
      this.askLine(o, r.x + pad, r.y + r.h - pad - f3 * 0.6, inner, f3);
      return;
    }
    ctx.fillStyle = C.terracotta;
    ctx.fillText(fitText(ctx, t('ui.order').toUpperCase(), inner - 66 * u, f1, 800, SANS, MIN_READ), r.x + pad, r.y + pad);
    if (shaping) for (let i = 0; i < 3; i++) star(ctx, r.x + r.w - pad - 7 * u - (2 - i) * 19 * u, r.y + pad + f1 * 0.55, 7 * u + 1, i < st, '#D9A441');
    ctx.fillStyle = C.ink;
    ctx.fillText(fitText(ctx, cap(t(`who.${o.customer}` as 'who.karczma')), inner, f2, 700, SERIF, MIN_READ), r.x + pad, r.y + pad + f1 + 5 * u);
    const midTop = r.y + pad + f1 + f2 + 12 * u;
    // on its side and on a desktop the match has its own row at the foot
    const footH = shaping && !L.portrait ? 24 * u : 0;
    const midH = Math.max(28, r.y + r.h - pad - footH - midTop);
    // the silhouette, in its own box
    const bw = Math.min(r.w * 0.34, midH * 1.15);
    ctx.fillStyle = 'rgba(176,122,85,.12)';
    ctx.beginPath();
    ctx.roundRect(r.x + pad, midTop, bw, midH, 8);
    ctx.fill();
    const scale = Math.min((midH - 8) / o.target.H, (bw * 0.42) / Math.max(1, maxR(o.target.r)));
    ghost(ctx, r.x + pad + bw / 2, midTop + midH - 4, scale, o.target, 'rgba(110,70,50,.22)', C.wet, 1.5, [4, 3]);
    // the match, big at the right while the wheel turns
    let matchW = 0;
    if (shaping) {
      ctx.font = font(900, 17 * u, SERIF);
      const label = L.portrait ? `${Math.round(m * 100)}%` : t('ui.match', { n: Math.round(m * 100) });
      matchW = ctx.measureText(label).width;
      ctx.fillStyle = m >= RULES.shapeStars[1] ? '#B8862E' : m >= RULES.shapeStars[0] ? C.fig : C.ink;
      ctx.textAlign = L.portrait ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      if (L.portrait) ctx.fillText(label, r.x + r.w - pad, midTop + midH / 2);
      else ctx.fillText(label, r.x + pad, r.y + r.h - pad - footH / 2);
      if (!L.portrait) matchW = 0;
      ctx.textAlign = 'left';
    }
    // the glaze and the band asked, beside the silhouette
    const ix = r.x + pad + bw + 10 * u, iw = r.x + r.w - pad - ix - (matchW ? matchW + 8 * u : 0);
    const rowH = Math.min(24 * u, midH / (o.band ? 2 : 1));
    const y0 = o.band ? midTop + midH / 2 - rowH / 2 : midTop + midH / 2;
    this.askLine(o, ix, y0, iw, f3, true, rowH);
  }

  /** The glaze asked (a swatch and its name) and the band (a chip and its pattern): in one line, or `stacked`. */
  private askLine(o: { glaze: GlazeId; band: { glaze: GlazeId; pattern: string } | null }, x: number, y: number, w: number, size: number, stacked = false, rowH = 0): void {
    const { ctx } = this;
    const sw = Math.max(6, size * 0.5);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const half = stacked || !o.band ? w : w / 2 - 4;
    swatch(ctx, x + sw, y, sw, o.glaze);
    ctx.fillStyle = C.ink;
    ctx.fillText(fitText(ctx, cap(GLAZE_NAME[o.glaze]), half - sw * 2 - 6, size, 700, SANS, MIN_READ), x + sw * 2 + 6, y);
    if (o.band) {
      const bx = stacked ? x : x + half + 8, by = stacked ? y + rowH : y;
      bandChip(ctx, bx, by - sw * 0.6, sw * 2, sw * 1.2, o.band.glaze, o.band.pattern);
      ctx.fillStyle = C.ink;
      ctx.fillText(fitText(ctx, cap(PATTERN_NAME[o.band.pattern as keyof typeof PATTERN_NAME]), half - sw * 2 - 6, size, 700, SANS, MIN_READ), bx + sw * 2 + 6, by);
    }
  }

  private drawWaiting(sim: GlinaSim, r: Rect): void {
    const { ctx, L } = this;
    const n = sim.batch.filter(p => !p.sold).length;
    if (!n) return;
    const h = Math.min(r.h, 44 * L.u + 8);
    cardBox(ctx, r.x, r.y, r.w, h, 0.9, 12);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, `${t('ui.waits')} · ${n}`, r.w - 20, 14 * L.u, 700, SANS, MIN_READ), r.x + 10, r.y + h / 2);
  }

  private drawReaction(r: Rect): void {
    const { ctx, L } = this, re = this.react!;
    const k = Math.min(1, re.t / 0.25), pop = ease.outBack(k);
    const u = L.u;
    const h = Math.min(Math.max(r.h, 96 * u), 132 * u);
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + h / 2);
    ctx.scale(pop, pop);
    cardBox(ctx, -r.w / 2, -h / 2, r.w, h, 1, 12);
    for (let i = 0; i < 3; i++) star(ctx, -r.w / 2 + 18 * u + i * 22 * u, -h / 2 + 20 * u, 9 * u + 1, i < re.stars, '#D9A441');
    ctx.fillStyle = '#B8862E';
    ctx.font = font(900, 18 * u, SERIF);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${coinsText(re.coins)}`, r.w / 2 - 10 * u, -h / 2 + 20 * u);
    ctx.fillStyle = C.ink;
    const size = 14 * u, lh = Math.round(size * 1.3);
    ctx.font = font(600, size, SERIF, true);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const room = Math.max(1, Math.floor((h - 40 * u - 8) / lh));
    const lines = wrap(ctx, quote(re.text), r.w - 20 * u);
    if (lines.length > room) {
      lines.length = room;
      lines[room - 1] = `${lines[room - 1].replace(/[\s,;:.]+$/, '')}…`;
    }
    lines.forEach((l, i) => ctx.fillText(l, -r.w / 2 + 10 * u, -h / 2 + 36 * u + i * lh));
    ctx.restore();
  }

  // ── the wheel ───────────────────────────────────────────────────
  private drawWheel(sim: GlinaSim): void {
    const { ctx, L } = this, wh = L.wheel;
    const steady = sim.steady;
    // the frame and the kick wheel below
    ctx.fillStyle = mix(C.wood, '#000000', 0.15);
    ctx.fillRect(wh.x - 8, wh.y, 16, L.h - wh.y);
    ctx.fillStyle = mix(C.wood, '#000000', 0.3);
    ctx.beginPath();
    ctx.ellipse(wh.x, Math.min(L.h - 6, wh.y + 40 * L.u), wh.rx * 0.9, wh.ry * 0.9, 0, 0, TAU);
    ctx.fill();
    // the wheel head
    ctx.fillStyle = '#7A5A44';
    ctx.beginPath();
    ctx.ellipse(wh.x, wh.y + 4, wh.rx, wh.ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8E6A50';
    ctx.beginPath();
    ctx.ellipse(wh.x, wh.y, wh.rx, wh.ry, 0, 0, TAU);
    ctx.fill();
    this.drawRings(sim);
    // spin marks
    ctx.strokeStyle = 'rgba(255,240,220,.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = sim.rot + i * 2.1;
      ctx.beginPath();
      ctx.ellipse(wh.x, wh.y, wh.rx * 0.82, wh.ry * 0.82, 0, a, a + 0.6);
      ctx.stroke();
    }
    this.drawCharge(sim);
    // the pot
    const o = sim.order, pot = sim.pot;
    if (o && pot && (sim.wheel === 'shape' || sim.wheel === 'assist' || sim.wheel === 'spin')) {
      const sc = this.scaleFor(o.target);
      const wob = (1 - Math.min(1, steady)) * (this.reduced ? 1 : 3) * L.u;
      const ox = Math.sin(sim.rot * 1.7) * wob;
      // the order's dashed outline, and the guide line
      ghost(ctx, L.axis, L.floor, sc, o.target, null, 'rgba(59,42,34,.55)', 2, [7, 6]);
      Object.assign(this.pot, look(), {
        x: L.axis + ox, y: L.floor, scale: sc, H: pot.H, r: pot.r, body: 'wet', gloss: 0.25 + 0.6 * clamp((steady - 0.3) / 0.7),
        wavy: (1 - steady) * 0.25, rot: sim.rot, specks: true, rows: 140,
      });
      if (this.spinGlow > 0) this.halo(L.axis, L.floor - pot.H * sc * 0.5, Math.max(pot.H * sc, maxR(pot.r) * sc * 2) * 0.8, this.spinGlow);
      drawVessel(ctx, this.pot);
      if (sim.guide) this.drawGuide(sim, sc);
      if (sim.finger) {
        const p = this.fingerPx(sim);
        if (p) {
          // a finger on the glass: a ring where it is and a thread up to the hand it moves (drawn above it)
          const f = this.finger;
          if (f && Math.hypot(f.x - p.x, f.y - p.y) > 10) {
            ctx.strokeStyle = 'rgba(255,248,236,.75)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 16, 0, TAU);
            ctx.stroke();
          }
          hand(ctx, p.x, p.y, 40 * L.u, p.x >= L.axis ? 1 : -1, this.stroke > 0 ? 1 : 0.5, 1);
        }
      }
      if (sim.wheel === 'shape') this.drawDone(L.done, this.pressK('Gotowe'));
    } else if (this.cut && this.cut.t < 0.8) {
      const pc = this.cut.piece, k = ease.outCubic(this.cut.t / 0.8);
      const sc = this.scaleFor(pc.order.target);
      const slot = Math.min(60 * L.u, L.shelf.w / (Math.max(1, sim.cap) + 1.2));
      const end = (slot * 0.7) / Math.max(pc.H, maxR(pc.r) * 2.2);
      const i = Math.max(0, Math.min(sim.cap - 1, sim.batch.indexOf(pc)));
      const tx = this.cut.market ? (L.portrait ? L.shelf.x + L.shelf.w - slot * 0.4 : L.cat.x - L.cat.s * 0.8 - slot * 0.4) : L.shelf.x + slot * (i + 0.7), ty = L.shelf.y;
      Object.assign(this.pot, look(), {
        x: L.axis + (tx - L.axis) * k, y: L.floor + (ty - L.floor) * k, scale: sc + (end - sc) * k, H: pc.H, r: pc.r, body: 'leather', rows: 80,
        alpha: 1 - k * 0.6, attach: FORM[pc.order.form].attach,
      });
      drawVessel(ctx, this.pot);
    } else if (sim.wheel === 'walk' && o) {
      // the lump lands on the wheel
      const k = clamp(this.walk);
      const sc = this.scaleFor(o.target);
      ctx.fillStyle = C.wet;
      ctx.beginPath();
      ctx.ellipse(L.axis, L.floor - (1 - k) * 60 - 8 * sc / 4, 30 * L.u, 16 * L.u, 0, 0, TAU);
      ctx.fill();
    }
    this.drawLevel(sim);
  }

  /** The band's last 40 s as throwing rings on the wheel head: gold above the threshold, cool in rest. */
  private drawRings(sim: GlinaSim): void {
    const { ctx, L } = this, wh = L.wheel;
    const n = 14;
    const bars = traceBars(sim.trace, sim.t, n);
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty || b.shown < 0.5) continue;
      const k = 0.3 + 0.68 * ((i + 1) / n);
      ctx.strokeStyle = !b.reliable ? 'rgba(255,255,255,.12)'
        : b.above ? `rgba(242,194,48,${(0.35 + 0.5 * b.level).toFixed(3)})`
          : b.phase === 'rest' ? 'rgba(120,170,200,.35)' : 'rgba(59,42,34,.22)';
      ctx.lineWidth = b.above ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.ellipse(wh.x, wh.y, wh.rx * k, wh.ry * k, 0, 0, TAU);
      ctx.stroke();
    }
  }

  /** The spirit level on the wheel's frame: the bubble sits inside the threshold marks when steady. */
  private drawLevel(sim: GlinaSim): void {
    const { ctx, L } = this, r = L.level;
    ctx.fillStyle = mix(C.wood, '#000000', 0.25);
    ctx.beginPath();
    ctx.roundRect(r.x - 6, r.y - 5, r.w + 12, r.h + 10, 6);
    ctx.fill();
    const steady = Math.min(1, sim.steady), above = steady >= 0.5;
    const vial = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    vial.addColorStop(0, above && sim.sighted ? '#F7E7A0' : '#D8E7B8');
    vial.addColorStop(1, above && sim.sighted ? '#E2C24F' : '#9DBA6C');
    ctx.fillStyle = vial;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    const cx = r.x + r.w / 2, maxOff = r.w / 2 - r.h * 0.6;
    // the threshold marks: where the bubble sits at steadiness 0.5
    ctx.strokeStyle = '#3B2A22';
    ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * maxOff * 0.5 + s * r.h * 0.5, r.y + 2);
      ctx.lineTo(cx + s * maxOff * 0.5 + s * r.h * 0.5, r.y + r.h - 2);
      ctx.stroke();
    }
    if (sim.blind) {
      // a linen cloth over it
      ctx.fillStyle = '#E9DFC9';
      ctx.beginPath();
      ctx.moveTo(r.x - 10, r.y - 8);
      ctx.quadraticCurveTo(cx, r.y - 14, r.x + r.w + 10, r.y - 8);
      ctx.lineTo(r.x + r.w + 6, r.y + r.h + 10);
      ctx.quadraticCurveTo(cx, r.y + r.h + 4, r.x - 6, r.y + r.h + 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(59,42,34,.2)';
      ctx.stroke();
      return;
    }
    const sway = Math.sin(this.t * 1.3) * 0.7 + Math.sin(this.t * 3.1) * 0.3 * (1 - steady);
    const bx = cx + (1 - steady) * maxOff * Math.sign(sway || 1) * Math.min(1, 0.6 + Math.abs(sway) * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.ellipse(bx, r.y + r.h / 2, r.h * 0.55, r.h * 0.34, 0, 0, TAU);
    ctx.fill();
    // its name under it on its side and on a desktop, where the floor band has the room
    if (!L.portrait && L.bottom - (r.y + r.h + 6) >= 15 * L.u) {
      ctx.fillStyle = C.ink;
      ctx.font = font(800, 13 * L.u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t('hint.level').split(':')[0], cx, r.y + r.h + 4);
    }
  }

  /** The master's hand: a ring filling gold with held focus. */
  private drawCharge(sim: GlinaSim): void {
    if (!sim.pushBlock && sim.charge <= 0) return;
    const { ctx, L } = this, c = L.charge;
    ctx.save();
    ctx.fillStyle = 'rgba(42,29,24,.55)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.lineWidth = c.r * 0.22;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 0.78, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = sim.charge >= 1 ? '#FFD86B' : '#F2B53A';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 0.78, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.charge));
    ctx.stroke();
    sparkle(ctx, c.x, c.y, c.r * 0.5, sim.charge >= 1 ? '#FFD86B' : 'rgba(255,236,190,.85)');
    if (!L.portrait) {
      ctx.fillStyle = C.ink;
      ctx.font = font(800, 13 * L.u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(t('ui.master'), c.x, c.y + c.r + 4);
    }
    ctx.restore();
  }

  /** The master's guide: the order's outline in gold, and an arrow at the ring furthest off. */
  private drawGuide(sim: GlinaSim, sc: number): void {
    const { ctx, L } = this, pot = sim.pot!, o = sim.order!;
    // a soft wide stroke under the crisp one (a glow without shadowBlur)
    ghost(ctx, L.axis, L.floor, sc, o.target, null, 'rgba(242,181,58,.3)', 8, []);
    ghost(ctx, L.axis, L.floor, sc, o.target, null, 'rgba(242,194,48,.95)', 2.4, []);
    const w = pot.worst();
    if (w.err < 0.05) return;
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 8);
    ctx.fillStyle = `rgba(242,181,58,${pulse.toFixed(3)})`;
    if (w.k < 0) {
      const y = L.floor - o.target.H * sc;
      arrow(ctx, L.axis, L.floor - pot.H * sc - 6, L.axis, y, 12 * L.u);
    } else {
      const u = w.k / (RINGS - 1), y = L.floor - u * pot.H * sc;
      const x0 = L.axis + pot.r[w.k] * sc, x1 = L.axis + o.target.r[w.k] * sc;
      arrow(ctx, x0 + (w.dir > 0 ? 4 : 18 * L.u), y, x1 + (w.dir > 0 ? 0 : 4), y, 12 * L.u);
    }
  }

  /** The Gotowe button: a pill with an offset shadow (no shadowBlur), darker and lower while pressed. */
  private drawDone(r: Rect, press = 0): void {
    const { ctx, L } = this;
    const dy = 2 * press;
    ctx.fillStyle = 'rgba(59,42,34,.28)';
    ctx.beginPath();
    ctx.roundRect(r.x + 1, r.y + 4, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.fillStyle = press > 0 ? mix(C.fig, '#000000', 0.18 * press) : C.fig;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y + dy, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.fillStyle = '#FFF8EC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, `✓ ${t('ui.done')}`, r.w - 16, 17 * L.u, 800, SANS, MIN_READ), r.x + r.w / 2, r.y + r.h / 2 + 1 + dy);
  }

  /** How pressed a control is (1 at touch-down, fading over 0.25 s): the hand's answer before the release. */
  private pressK(key: string): number {
    const p = this.pressed;
    return p && p.key === key ? (p.held ? 1 : Math.max(0, 1 - p.t / 0.25)) : 0;
  }

  /** A control took a press: it shows pressed for a moment (`held`: until unpress()). */
  press(key: string, held = false): void { this.pressed = { key, t: 0, held }; }

  /** The finger left the control (it fades back). */
  unpress(): void { if (this.pressed) { this.pressed.held = false; this.pressed.t = 0; } }

  // ── glazing ─────────────────────────────────────────────────────
  private drawGlazing(sim: GlinaSim, pc: Piece): void {
    const { ctx, L } = this;
    const P = this.palette(sim);
    const sc = this.glazeScale(pc.order.target, sim);
    // the banding wheel
    ctx.fillStyle = '#7A5A44';
    ctx.beginPath();
    ctx.ellipse(L.axis, P.floor + 4, L.wheel.rx * 0.7, L.wheel.ry * 0.7, 0, 0, TAU);
    ctx.fill();
    const dip = this.dipT < 0.5 ? Math.sin((this.dipT / 0.5) * Math.PI) : 0;
    Object.assign(this.pot, look(), {
      x: L.axis, y: P.floor - dip * 14, scale: sc, H: pc.H, r: pc.r, body: pc.glaze ? 'glazed' : 'leather', glaze: pc.glaze,
      fired: 0.7, rot: sim.rot, rows: 120, attach: FORM[pc.order.form].attach,
      bands: pc.bands.map(b => ({ u: b.u, glaze: b.glaze, pattern: b.pattern, k: b.t })),
    });
    drawVessel(ctx, this.pot);
    // the palette: upright a sheet under the thumb
    if (L.portrait) {
      ctx.fillStyle = 'rgba(59,42,34,.14)';
      ctx.beginPath();
      ctx.roundRect(L.left - 8, P.top - 8, L.right - L.left + 16, L.bottom - P.top + 4, 16);
      ctx.fill();
    }
    // the colours: the brush's ringed, the ones the order asks for marked
    sim.p.glazes.forEach((g, i) => {
      const s = P.colors[i];
      if (!s) return;
      const press = this.pressK(`glaze ${g}`);
      swatch(ctx, s.x, s.y, s.r * (1 - 0.1 * press), g);
      if (sim.brush.glaze === g) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + 4, 0, TAU);
        ctx.stroke();
      }
      if (pc.order.glaze === g || pc.order.band?.glaze === g) {
        ctx.fillStyle = C.terracotta;
        ctx.beginPath();
        ctx.arc(s.x + s.r * 0.75, s.y - s.r * 0.75, Math.max(4, s.r * 0.24), 0, TAU);
        ctx.fill();
      }
    });
    // the patterns: a chip each, drawn in the brush's colour
    sim.p.patterns.forEach((p, i) => {
      const r = P.patterns[i];
      if (!r) return;
      const on = sim.brush.pattern === p, press = this.pressK(`pattern ${p}`);
      ctx.fillStyle = on ? '#FFF8EC' : press > 0 ? 'rgba(255,248,236,.92)' : 'rgba(255,248,236,.72)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      bandChip(ctx, r.x + r.w * 0.16, r.y + r.h * 0.32, r.w * 0.68, r.h * 0.36, sim.brush.glaze, p);
      if (pc.order.band?.pattern === p) {
        ctx.fillStyle = C.terracotta;
        ctx.beginPath();
        ctx.arc(r.x + r.w - 6, r.y + 6, 4, 0, TAU);
        ctx.fill();
      }
    });
    this.drawDone(P.done, this.pressK('glazing Gotowe'));
  }

  // ── Szamot ──────────────────────────────────────────────────────
  private drawCat(sim: GlinaSim): void {
    const { ctx, L } = this;
    const cx = L.cat.x, cy = L.cat.y;
    cat(ctx, cx, cy, L.cat.s, this.t, this.catPose);
    const line = sim.talk.line;
    if (!line) return;
    const a = Math.min(1, line.t / 0.15, (line.dur - line.t) / 0.25);
    if (a <= 0) return;
    // his bubble hangs at the room the layout keeps for it (upright under the kiln on the right, on its side under
    // the shelf), its tail up to him; 15 px on a phone
    const T = L.talk;
    bubble(ctx, line.text, cx, cy + 6, T.x, T.y, T.maxW, a, Math.round(15 * L.u), L.left);
  }

  // ── banners and cards ───────────────────────────────────────────
  private drawBanner(): void {
    const b = this.banner;
    if (!b) return;
    const { ctx, L } = this;
    const k = b.t < 0.25 ? ease.outBack(b.t / 0.25) : 1;
    const a = b.t > 2 ? Math.max(0, 1 - (b.t - 2) / 0.4) : 1;
    const y = L.floor - L.stageH * 0.85;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(900, (20 * L.u + 6) * k, SERIF);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = Math.min(L.w - 20, ctx.measureText(b.text).width + 36);
    ctx.fillStyle = 'rgba(42,29,24,.78)';
    ctx.beginPath();
    ctx.roundRect(L.axis - tw / 2, y - 22 * L.u - 4, tw, 44 * L.u + 8, 22);
    ctx.fill();
    ctx.fillStyle = b.color === C.ink ? '#FFF8EC' : mix(b.color, '#FFFFFF', 0.35);
    ctx.fillText(fit(ctx, b.text, L.w - 40), L.axis, y);
    ctx.restore();
  }

  private drawCard(sim: GlinaSim): void {
    const c = sim.card;
    this.cardRect = null;
    if (!c) return;
    const { ctx, L } = this;
    const a = Math.min(1, c.t / 0.3, (c.dur - c.t) / 0.3);
    if (a <= 0) return;
    const w = Math.min(L.right - L.left, 460 * L.u), x = (L.left + L.right - w) / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,29,24,.35)';
    if (c.kind === 'open') ctx.fillRect(0, 0, L.w, L.h);
    let title = '', text = '';
    if (c.kind === 'open') { title = t('card.open.title'); text = t('card.open.text'); }
    else if (c.kind === 'tally') { title = t('card.tally.title'); text = `${t('card.tally.text', { n: c.n, three: c.three })} · +${coinsText(c.coins)}`; }
    else { title = t('card.story.title', { who: cap(t(`who.${c.house}` as 'who.karczma')), n: c.step }); text = c.text; }
    const u = L.u, cx = x + w / 2;
    ctx.font = font(500, 15 * u + 2, SERIF);
    const lines = wrap(ctx, text, w - 40);
    const lh = Math.round(20 * u + 3);
    const starsH = c.kind === 'tally' ? 26 * u : 0;
    const textTop = 16 + 23 * u + 14 + starsH;
    // every card says how it goes on: a tap anywhere (the open card after a moment)
    const h = textTop + lines.length * lh + 14 + 22 * u;
    const y = c.kind === 'open' ? Math.max(L.top + 10, (L.h - h) / 2) : L.top + 12;
    this.cardRect = { x, y, w, h };
    cardBox(ctx, x, y, w, h, 1, 18);
    ctx.fillStyle = C.terracotta;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fitText(ctx, title, w - 30, 20 * u + 3, 800, SERIF, 17), cx, y + 16);
    if (c.kind === 'tally') for (let i = 0; i < 3; i++) star(ctx, cx - 24 * u + i * 24 * u, y + 16 + 23 * u + 14 + 9 * u, 9 * u, i < Math.min(3, c.three), '#D9A441');
    ctx.fillStyle = C.ink;
    ctx.font = font(500, 15 * u + 2, SERIF);
    lines.forEach((l, i) => ctx.fillText(l, cx, y + textTop + i * lh));
    ctx.fillStyle = C.muted;
    ctx.font = font(700, 14 * u, SANS);
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('ui.tapOn'), cx, y + h - 10);
    ctx.restore();
  }

  private halo(x: number, y: number, r: number, k: number): void {
    const { ctx } = this;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,216,107,${(0.55 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,216,107,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** Where the finger works the clay (px), from the sim's finger. */
  fingerPx(sim: GlinaSim): { x: number; y: number } | null {
    const f = sim.finger, pot = sim.pot, o = sim.order;
    if (!f || !pot || !o) return null;
    const sc = this.scaleFor(o.target), L = this.L;
    if (f.mode === 'rim') return { x: L.axis + pot.at(1) * sc, y: L.floor - pot.H * sc };
    const y = L.floor - f.u * pot.H * sc;
    return { x: L.axis + this.fingerSide * radiusAt(pot.r, f.u) * sc, y };
  }

  /** which side of the axis the finger is on (the input sets it) */
  fingerSide = 1;
}

// ── small drawing helpers ────────────────────────────────────────
const maxR = (r: ArrayLike<number>): number => {
  let m = 0;
  for (let k = 0; k < r.length; k++) m = Math.max(m, r[k]);
  return m;
};

function giftName(g: 'blush' | 'speckle' | 'moon'): string {
  return t(`gift.${g}` as 'gift.blush');
}

/** An order's outline (both sides, dashed), from its foot at (x, y). */
function ghost(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, tg: Target, fill: string | null, stroke: string, lw: number, dash: number[]): void {
  const n = 40;
  ctx.beginPath();
  ctx.moveTo(x - tg.r[0] * sc, y);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    ctx.lineTo(x - radiusAt(tg.r, u) * sc, y - u * tg.H * sc);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    ctx.lineTo(x + radiusAt(tg.r, u) * sc, y - u * tg.H * sc);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.setLineDash(dash);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.setLineDash([]);
}

function swatch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: GlazeId): void {
  const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  gr.addColorStop(0, mix(GLAZE[g].c, '#FFFFFF', 0.45));
  gr.addColorStop(0.6, GLAZE[g].c);
  gr.addColorStop(1, GLAZE[g].pool);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,42,34,.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A small sample of a band: the pattern in its colour, on a clay strip. */
function bandChip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, g: GlazeId, p: string): void {
  ctx.fillStyle = C.leather;
  ctx.fillRect(x, y, w, h);
  const col = GLAZE[g].c;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.5, h * 0.3);
  ctx.lineCap = 'round';
  const cy = y + h / 2;
  if (p === 'pas') ctx.fillRect(x, y + h * 0.2, w, h * 0.6);
  else if (p === 'kropki') for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + (i + 0.5) * (w / 5), cy, h * 0.28, 0, TAU); ctx.fill(); }
  else if (p === 'fala' || p === 'zygzak') {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const k = i / 20, ph = k * 3;
      const off = p === 'fala' ? Math.sin(ph * TAU) : Math.abs(((ph * 2) % 2) - 1) * 2 - 1;
      if (i === 0) ctx.moveTo(x + k * w, cy + off * h * 0.32); else ctx.lineTo(x + k * w, cy + off * h * 0.32);
    }
    ctx.stroke();
  } else {
    for (let i = 0; i < 3; i++) {
      const lx = x + (i + 0.5) * (w / 3);
      ctx.lineWidth = Math.max(1, h * 0.12);
      ctx.beginPath();
      ctx.moveTo(lx - h * 0.4, cy + h * 0.3);
      ctx.lineTo(lx + h * 0.4, cy - h * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(lx, cy, h * 0.32, h * 0.14, -0.6, 0, TAU);
      ctx.fill();
    }
  }
}

/** A four-pointed sparkle (the master's hand). */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4, rr = i % 2 ? r * 0.3 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, s: number): void {
  const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 2) return;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.18);
  ctx.lineTo(Math.max(0, len - s), -s * 0.18);
  ctx.lineTo(Math.max(0, len - s), -s * 0.5);
  ctx.lineTo(len, 0);
  ctx.lineTo(Math.max(0, len - s), s * 0.5);
  ctx.lineTo(Math.max(0, len - s), s * 0.18);
  ctx.lineTo(0, s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Lines of `text` that fit `maxW` (the canvas breaks only at plain spaces). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const nx = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(nx).width > maxW) {
      out.push(line);
      line = w;
    } else line = nx;
  }
  if (line) out.push(line);
  return out;
}

/** A label cut with an ellipsis to fit. */
function fit(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxW) out = out.slice(0, -1);
  return `${out}…`;
}


/**
 * The cat's speech bubble: right-aligned to `right` at `top` (at most `maxW` wide, never left of `minX`), its
 * tail up toward him at (tx, ty).  An offset shape for its shadow (no shadowBlur).
 */
function bubble(ctx: CanvasRenderingContext2D, text: string, tx: number, ty: number, right: number, top: number, maxW: number, alpha: number, size: number, minX: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font(600, size, SANS);
  const pad = Math.round(size * 0.75);
  const lines = wrap(ctx, text, maxW - pad * 2);
  const lh = Math.round(size * 1.3);
  const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2);
  const bh = lines.length * lh + pad * 1.2;
  const bx = Math.max(minX, right - bw), by = top;
  ctx.fillStyle = 'rgba(59,42,34,.2)';
  ctx.beginPath();
  ctx.roundRect(bx + 1, by + 4, bw, bh, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,248,236,.98)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 12);
  ctx.fill();
  // the tail, toward him (he sits above the bubble)
  if (ty < by) {
    const cx = Math.max(bx + 14, Math.min(bx + bw - 14, tx));
    ctx.beginPath();
    ctx.moveTo(cx - 7, by + 1);
    ctx.lineTo(Math.max(bx + 6, Math.min(bx + bw - 6, tx)), Math.max(ty, by - 14));
    ctx.lineTo(cx + 7, by + 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#2B1B12';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad * 0.6 + i * lh));
  ctx.restore();
}
