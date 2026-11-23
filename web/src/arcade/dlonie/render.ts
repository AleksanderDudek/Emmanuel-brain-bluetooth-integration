/**
 * Światło w dłoniach's view: the night, the two hands with the series' rim of light, the spark and the ball of
 * golden-white light with its slow inner swirls and its sparks, the threads of light between the fingertips while the
 * hands breathe, the incense rising to the soft light at the top where a lifted prayer blooms (and each prayer of the
 * session then circles as a small flame), the small figure of light (kit/figure.ts) when a hand is laid where it hurts;
 * then the words, the buttons, the picker and the opening card (hud.ts).  Reduced motion: the hands keep still and
 * the light pulses instead; a lifted prayer fades from the hands into the light above instead of travelling.
 */
import { figurePath, type P } from '../kit/figure';
import { approach, clamp, ease } from '../kit/juice';
import { fitText } from '../kit/mobile';
import { PLACES, PLACE_AT, nearestPlace, type Coach, type HurtPlace } from './content';
import { drawHand, drawSmallHand, tipsOf, type HandPose } from './hands';
import { drawBubble, drawControls, drawList, drawPicker, drawStory, drawWords, storyBox, veilWords } from './hud';
import { placeLabel } from './i18n';
import { CTRLS, hitTest, layout, scene, tapTargets, type CtrlId, type Hit, type Layout, type Rect, type Scene, type TargetState } from './layout';
import { walkOf } from './meta';
import { BALL, GOLD, IVORY, MUTED, RIM, RIM_HI, SANS, SMOKE, TAU, bakeNight, font, glow, hash, rgba, tintOf, type Layer } from './paint';
import type { DlonieSim, SimEvent } from './sim';

interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; a: number }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; c: string }
interface Floater { text: string; x: number; y: number; age: number }
interface TrailPt { x: number; y: number; t: number }

export class DlonieView {
  L: Layout;
  private sc: Scene;
  private night: Layer | null = null;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private time = 0;
  /** the hands' half-distance (px from the middle to each wrist), their lean, the rub's warmth */
  private off = 0;
  private tilt = 0.08;
  private warm = 0;
  private lift = 0;
  private layK = 0;
  private blindK = 0;
  private nameGlow = 0;
  private bright = 0.5;
  private wobble = 0;
  private sparkA = 0;
  private gone = 0;
  private bloom = -1;
  private bloomAt = { x: 0, y: 0 };
  private laidA = 0;
  private figK = 0;
  private readonly puffs: Puff[] = [];
  private readonly sparks: Spark[] = [];
  private readonly floaters: Floater[] = [];
  private readonly trail: TrailPt[] = [];
  private trailT = 0;
  private emitAcc = 0;
  private lastBall = { x: 0, y: 0, r: 0 };
  private flash = 0;
  readonly down: Record<CtrlId, number> = { menu: 0, prev: 0, next: 0 };
  hover: { x: number; y: number } | null = null;
  private storyR: Rect | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; touch: boolean }) {
    this.ctx = canvas.getContext?.('2d') ?? null;
    this.L = layout(360, 640, undefined, opts.touch);
    this.sc = scene(this.L, 0);
  }

  resize(w: number, h: number, dpr: number, insets: { top: number; right: number; bottom: number; left: number }): void {
    this.dpr = dpr;
    this.L = layout(w, h, insets, this.opts.touch);
    this.sc = scene(this.L, this.layK);
    const S = this.L.stage;
    this.night = bakeNight(w, h, dpr, S.x + S.w / 2, this.sc.ballY);
    this.off = this.restOff(0);
    this.storyR = null;
  }

  /** The wrists' distance from the middle: the palms clear of the ball, never closer than a hand's breadth apart. */
  private restOff(r: number): number {
    const L = this.sc.L;
    const inner = 0.45 + 0.62 * Math.sin(this.sc.tilt);
    return Math.max((inner + 0.42) * L, r + (inner + 0.1) * L);
  }

  // ── the moment's motion ───────────────────────────────────────
  update(dt: number, sim: DlonieSim): void {
    this.time += dt;
    const rm = this.opts.reducedMotion;
    for (const k of CTRLS) this.down[k] = Math.max(0, this.down[k] - dt * 5);
    const lay = sim.lay ? 1 : 0;
    const want = lay && (sim.step === 'offer' || sim.step === 'rest' || sim.step === 'name') ? 1 : 0;
    const k0 = this.layK;
    this.layK = approach(this.layK, want, dt, 0.5);
    if (Math.abs(this.layK - k0) > 1e-4) this.sc = scene(this.L, this.layK);
    const sc = this.sc;
    const R = sc.R * this.ballScale(sim);
    // the hands: apart with the in-breath, closer with the out-breath (fully in rest, gently in a push)
    const b = sim.breath;
    const rubbing = sim.step === 'rub' && !sim.story && sim.phase === 'play';
    const swing = rm ? 0 : sim.restBlock ? sc.swing : sim.pushBlock ? sc.swing * 0.35 : 0;
    let off = this.restOff(R) + swing * sc.L * (b.k - 0.5) * 2;
    let tilt = sc.tilt;
    if (rubbing) { off = 0.47 * sc.L; tilt = 0; }
    if (sim.blind) { off = 0.66 * sc.L; tilt = 0.42; }
    const lifting = sim.step === 'offer' && !sim.lay ? clamp(sim.riseShown * 3) : sim.step === 'rest' && !sim.lay && sim.phase === 'play' ? 1 : 0;
    tilt -= 0.06 * lifting;
    this.off = approach(this.off, off, dt, rubbing ? 0.25 : 0.55);
    this.tilt = approach(this.tilt, tilt, dt, 0.45);
    this.lift = approach(this.lift, lifting, dt, 0.8);
    this.blindK = approach(this.blindK, sim.blind ? 1 : 0, dt, 0.5);
    this.warm = approach(this.warm, rubbing ? clamp(sim.stepT / Math.max(1, sim.stepDur)) : 0, dt, rubbing ? 0.6 : 3);
    // the ball's light: brighter in held focus, a soft wobble and dim while it waits (its size never shrinks)
    const focusLit = sim.goldOn ? 1 : sim.sighted ? 0.55 : 0.7;
    this.bright = approach(this.bright, sim.restBlock ? 0.8 : focusLit, dt, 0.8);
    this.wobble = approach(this.wobble, sim.sighted && !sim.goldOn && !sim.blind ? 1 : 0, dt, 0.8);
    this.sparkA = approach(this.sparkA, sim.sparkOn ? 1 : 0, dt, 0.5);
    const nameAge = sim.namedAt >= 0 ? sim.t - sim.namedAt : 99;
    this.nameGlow = nameAge < 4 ? Math.max(this.nameGlow, 1 - nameAge / 4) : approach(this.nameGlow, 0, dt, 0.6);
    // a lifted prayer is gone into the light once it bloomed; a laid one rests on the place
    this.gone = sim.offeredNow && !sim.lay ? Math.min(1, this.gone + dt / 0.6) : 0;
    this.laidA = approach(this.laidA, sim.offeredNow && sim.lay ? 1 : 0, dt, 0.6);
    // above the hands on an upright phone, the figure steps down and smaller in the rest, so the passage has room
    this.figK = approach(this.figK, this.sc.above && sim.lay && sim.offeredNow ? 1 : 0, dt, 0.6);
    if (this.bloom >= 0) {
      this.bloom += dt;
      if (this.bloom > 3) this.bloom = -1;
    }
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.updateParticles(dt, sim);
  }

  private ballScale(sim: DlonieSim): number {
    const g = sim.growShown;
    return g > 0 ? 0.08 + 0.92 * g : 0.06;
  }

  /** Where the ball is now (px) and its radius: between the palms, rising to the light, or on its way to the place. */
  ballAt(sim: DlonieSim): { x: number; y: number; r: number } {
    const sc = this.sc;
    let x = sc.cx, y = sc.ballY - 0.06 * sc.L * this.lift;
    let r = sc.R * this.ballScale(sim);
    const breathe = this.opts.reducedMotion ? 0 : Math.sin(this.time * 0.9) * 0.015 * sc.L;
    y += breathe;
    const rise = sim.step === 'offer' || sim.offeredNow ? sim.riseShown : 0;
    if (rise > 0 && !sim.lay && !this.opts.reducedMotion) {
      const k = ease.inOutSine(rise);
      x += Math.sin(this.time * 0.8 + rise * 6) * 0.1 * sc.L * Math.sin(Math.PI * rise);
      y = y + (sc.lightY - y) * k;
      r *= 1 - 0.35 * k;
    } else if (rise > 0 && sim.lay && sim.place) {
      const p = this.placePt(sim.place);
      const k = ease.inOutSine(rise);
      const side = Math.abs(p.x - x) > sc.L;
      const cxp = (x + p.x) / 2, cyp = side ? Math.min(y, p.y) - 0.6 * sc.L : (y + p.y) / 2;
      const u = 1 - k;
      x = u * u * x + 2 * u * k * cxp + k * k * p.x;
      y = u * u * y + 2 * u * k * cyp + k * k * p.y;
      r *= 1 - 0.55 * k;
    }
    return { x, y, r };
  }

  /** The small figure's camera: figure units (H = 1 crown to soles) → px in its box. */
  /** The small figure's box now (it steps down in a laid prayer's rest when it stands above the hands). */
  private figBox(): Rect {
    const f = this.sc.fig;
    if (!this.sc.above || this.figK < 0.001) return f;
    const h = f.h + (f.h * 0.56 - f.h) * this.figK;
    return { x: f.x + f.w / 2 - h * 0.25, y: f.y + f.h - h, w: h * 0.5, h };
  }

  private figMap(): { s: number; ox: number; oy: number } {
    const f = this.figBox();
    return { s: f.h, ox: f.x + f.w / 2, oy: f.y };
  }

  private placePt(place: HurtPlace): { x: number; y: number } {
    const m = this.figMap();
    const [px, py] = PLACE_AT[place];
    return { x: m.ox + px * m.s, y: m.oy + py * m.s };
  }

  /** What the ball looks like for the one prayed for: its tint, and a mark (an initial, a heart, the globe). */
  private tint(sim: DlonieSim): string {
    const w = sim.who;
    if (w.kind === 'name') return tintOf(sim.whoText);
    if (w.kind === 'self') return '#ffc0a0';
    if (w.kind === 'world') return '#ffe6a8';
    return '#ffcf8c';
  }

  on(e: SimEvent, sim: DlonieSim): void {
    switch (e.type) {
      case 'offered': {
        if (!e.lay) {
          this.bloom = 0;
          this.bloomAt = { x: this.sc.lightX, y: this.sc.lightY };
          this.burst(this.sc.lightX, this.sc.lightY, 26, GOLD);
        } else if (e.place) {
          const p = this.placePt(e.place);
          this.burst(p.x, p.y, 14, '#ffe2b0');
        }
        this.flash = 1;
        break;
      }
      case 'grown': {
        const b = this.ballAt(sim);
        this.burst(b.x, b.y, 14, '#fff0c6');
        break;
      }
      case 'spark': {
        const b = this.ballAt(sim);
        this.burst(b.x, b.y, 6, '#fff7e0');
        break;
      }
      case 'flames':
        if (e.n >= 1) {
          const b = this.lastBall;
          const at = e.at === 'prayer' ? { x: this.sc.lightX, y: this.sc.lightY + 24 } : { x: b.x + b.r + 10, y: b.y - b.r * 0.5 };
          if (this.floaters.length < 6) this.floaters.push({ text: `+${e.n}`, x: at.x, y: at.y, age: 0 });
        }
        break;
      case 'step':
        if (e.step === 'ball' || e.step === 'rub') this.trail.length = 0;
        break;
      default:
        break;
    }
  }

  private burst(x: number, y: number, n: number, c: string): void {
    if (this.opts.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.sparks.length < 160; i++) {
      const a = Math.random() * TAU, v = 20 + Math.random() * 70;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, age: 0, life: 0.8 + Math.random() * 0.9, c });
    }
  }

  private updateParticles(dt: number, sim: DlonieSim): void {
    const rm = this.opts.reducedMotion;
    const b = this.ballAt(sim);
    const moved = Math.hypot(b.x - this.lastBall.x, b.y - this.lastBall.y);
    this.lastBall = b;
    const lifting = sim.step === 'offer' && !sim.lay && sim.riseShown > 0 && sim.riseShown < 1;
    // incense: puffs from the rising ball, a ribbon of its way
    if (!rm && (lifting || (sim.step === 'offer' && !sim.lay && sim.growing))) {
      this.emitAcc += dt * (5 + moved / Math.max(dt, 1e-3) * 0.06);
      while (this.emitAcc >= 1 && this.puffs.length < 90) {
        this.emitAcc -= 1;
        this.puffs.push({
          x: b.x + (Math.random() - 0.5) * b.r, y: b.y + b.r * 0.4, vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 14,
          r: b.r * (0.5 + Math.random() * 0.6), age: 0, life: 3.5 + Math.random() * 2.5, a: 0.1 + Math.random() * 0.06,
        });
      }
      this.trailT += dt;
      if (this.trailT >= 0.05) {
        this.trailT = 0;
        this.trail.push({ x: b.x, y: b.y, t: this.time });
        if (this.trail.length > 160) this.trail.shift();
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      p.x += (p.vx + Math.sin(this.time * 0.7 + i) * 6) * dt;
      p.y += p.vy * dt;
      p.r += dt * 7;
      if (p.age >= p.life) this.puffs.splice(i, 1);
    }
    while (this.trail.length && this.time - this.trail[0].t > 6) this.trail.shift();
    // sparks round the ball while it grows
    if (!rm && sim.growing && !sim.blind && this.sparks.length < 120 && Math.random() < dt * (6 + 14 * sim.growShown)) {
      const a = Math.random() * TAU, d = b.r * (0.9 + Math.random() * 0.5);
      this.sparks.push({ x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, vx: Math.cos(a + 1.4) * 18, vy: Math.sin(a + 1.4) * 18 - 14, age: 0, life: 1 + Math.random(), c: '#fff1c8' });
    }
    // the rub's warm sparks where the palms meet
    if (!rm && sim.step === 'rub' && !sim.story && this.sparks.length < 60 && Math.random() < dt * 10 * this.warm) {
      const sc = this.sc;
      this.sparks.push({ x: sc.cx + (Math.random() - 0.5) * 8, y: sc.wristY - sc.L * (0.3 + Math.random() * 1.2), vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, age: 0, life: 0.7 + Math.random() * 0.6, c: '#ffc98a' });
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - dt * 1.5;
      s.vy *= 1 - dt * 1.5;
      if (s.age >= s.life) this.sparks.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += dt;
      f.y -= dt * 18;
      if (f.age > 1.6) this.floaters.splice(i, 1);
    }
  }

  // ── drawing ───────────────────────────────────────────────────
  draw(sim: DlonieSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.night) ctx.drawImage(this.night, 0, 0, L.w, L.h);
    else { ctx.fillStyle = '#0c0705'; ctx.fillRect(0, 0, L.w, L.h); }
    this.drawScene(ctx, sim);
    veilWords(ctx, L, sim.step === 'rest' || sim.phase !== 'play' ? L.wordsMax : 0);
    drawWords(ctx, L, sim, this.nameGlow, this.sc.above && this.figK > 0.01 ? this.figBox().y - 8 : undefined, this.opts.reducedMotion, this.time);
    if (sim.lay && this.layK > 0.3 && sim.step !== 'rest' && !sim.offeredNow) this.drawPlaceHint(ctx, sim);
    drawControls(ctx, L, sim, this.down, this.hoverCtrl());
    drawBubble(ctx, L, sim);
    drawList(ctx, L, sim);
    if (sim.picker) drawPicker(ctx, L, sim);
    if (sim.story) drawStory(ctx, L, sim, this.opts.touch);
  }

  /** The picture alone (also the lobby's preview and the calibration scene use it). */
  drawScene(ctx: CanvasRenderingContext2D, sim: DlonieSim): void {
    const sc = this.sc;
    const L = this.L;
    const rm = this.opts.reducedMotion;
    ctx.save();
    // the soft light above, richer with every prayer offered this session; their small flames circle in it
    const n = sim.offered.filter(o => !o.lay).length;
    const lightA = 0.1 + 0.05 * Math.min(6, n) + 0.25 * this.lift * (sim.step === 'offer' ? sim.riseShown : 0) + (this.bloom >= 0 ? 0.4 * Math.max(0, 1 - this.bloom / 2.5) : 0);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#fff1d6', sc.lightX, sc.lightY, Math.min(L.stage.w, L.h) * 0.42, lightA);
    glow(ctx, '#fffaf0', sc.lightX, sc.lightY, Math.min(L.stage.w, L.h) * 0.12, lightA * 1.2);
    this.drawFlames(ctx, sim);
    this.drawBloom(ctx);
    this.drawSmoke(ctx);
    ctx.globalCompositeOperation = 'source-over';
    // the small figure when a hand is laid
    if (this.layK > 0.02) this.drawFigure(ctx, sim);
    // the hands and the ball (in a hidden push the hands close over it)
    const ball = this.ballAt(sim);
    const tint = this.tint(sim);
    const hidden = this.blindK;
    const showBall = !sim.offeredNow || sim.lay;
    const rubY = sim.step === 'rub' && !rm ? Math.sin(this.time * 2.4 * TAU) * 0.07 * sc.L * this.warm : 0;
    const left: HandPose = { x: sc.cx - this.off, y: sc.wristY + rubY, L: sc.L, tilt: this.tilt, side: 1 };
    const right: HandPose = { x: sc.cx + this.off, y: sc.wristY - rubY, L: sc.L, tilt: this.tilt, side: -1 };
    const atHands = sim.offeredNow ? 0 : 1 - (sim.lay ? 0 : clamp(sim.riseShown * 1.4));
    const lightOnHands = showBall && this.sparkA > 0.05 ? {
      x: ball.x, y: ball.y, r: Math.max(ball.r, sc.R * 0.25), a: (0.35 + 0.65 * sim.growShown) * this.bright * this.sparkA * (1 - 0.8 * hidden) * Math.max(0.15, atHands), color: tint,
    } : null;
    if (hidden > 0.5 && showBall) this.drawBall(ctx, sim, ball, tint, 1 - hidden);
    drawHand(ctx, left, lightOnHands, this.warm, 1);
    drawHand(ctx, right, lightOnHands, this.warm, 1);
    if (this.warm > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#ffb070', sc.cx, sc.wristY - sc.L * 0.7, sc.L * 1.1, 0.35 * this.warm);
      ctx.globalCompositeOperation = 'source-over';
    }
    this.drawThreads(ctx, sim, left, right);
    if (hidden > 0.5) {
      // light leaking between the closed fingers
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#ffd9a0', sc.cx, sc.ballY - sc.L * 0.2, sc.L * 0.9, 0.18 + 0.06 * Math.sin(this.time * 1.3));
      ctx.globalCompositeOperation = 'source-over';
    } else if (showBall) this.drawBall(ctx, sim, ball, tint, 1);
    // reduced motion: the lifted prayer fades into the light above instead of travelling
    if (rm && !sim.lay && sim.step === 'offer' && sim.riseShown > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#fff1d6', sc.lightX, sc.lightY, sc.R * 2.2, 0.6 * sim.riseShown);
      ctx.globalCompositeOperation = 'source-over';
    }
    this.drawSparks(ctx);
    this.drawFloaters(ctx);
    ctx.restore();
  }

  /** The ball: a halo, a golden-white body, slow swirls inside, the mark of the one it is for. */
  private drawBall(ctx: CanvasRenderingContext2D, sim: DlonieSim, b: { x: number; y: number; r: number }, tint: string, alpha: number): void {
    const rm = this.opts.reducedMotion;
    let a = alpha * this.sparkA;
    if (rm && !sim.lay && (sim.step === 'offer' || sim.offeredNow)) a *= 1 - sim.riseShown;
    if (sim.offeredNow && !sim.lay) a *= 1 - this.gone;
    if (a <= 0.01) return;
    const g = sim.growShown;
    const pulse = 1 + (rm ? 0 : 0.03 * Math.sin(this.time * 2.1));
    const wob = rm ? 0 : this.wobble * 0.035 * Math.sin(this.time * 3.3);
    const r = Math.max(2, b.r * pulse);
    const br = this.bright;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the halo and the spark's glint
    glow(ctx, tint, b.x, b.y, r * (2.6 + 0.6 * g), 0.45 * br * a);
    glow(ctx, '#fff6e0', b.x, b.y, r * 1.5, 0.5 * br * a);
    if (g < 0.15) {
      // the spark: a four-pointed glint
      const s = Math.max(6, this.sc.R * 0.5) * (0.6 + 0.4 * Math.sin(this.time * 5) ** 2);
      ctx.strokeStyle = rgba('#fffbea', 0.8 * a);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x - s, b.y); ctx.lineTo(b.x + s, b.y);
      ctx.moveTo(b.x, b.y - s); ctx.lineTo(b.x, b.y + s);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the body
    ctx.translate(b.x, b.y);
    ctx.scale(1 + wob, 1 - wob);
    const body = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r);
    body.addColorStop(0, rgba(BALL[0], a));
    body.addColorStop(0.4, rgba(BALL[1], 0.95 * a));
    body.addColorStop(0.78, rgba(tint, 0.85 * a * (0.75 + 0.25 * br)));
    body.addColorStop(1, rgba(BALL[3], 0));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    if (r > 10) {
      // slow swirls of light inside
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, TAU);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const sp = rm ? 0 : this.time;
      // soft lobes of brighter light turning slowly round the heart of the ball
      for (let i = 0; i < 3; i++) {
        const rot = sp * (0.32 + i * 0.1) * (i % 2 ? -1 : 1) + i * 2.1;
        const d = r * (0.32 + 0.12 * i);
        glow(ctx, '#fffaf0', Math.cos(rot) * d, Math.sin(rot) * d * 0.7, r * 0.55, 0.16 * a * br);
      }
      ctx.strokeStyle = rgba('#fffaf0', 0.08 * a * br);
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.62, r * 0.26, sp * 0.3, 0.4, 2.2);
      ctx.stroke();
      ctx.restore();
      // the mark of the one it is for, once it has the name
      if (sim.namedAt >= 0 && g > 0.5) this.drawMark(ctx, sim, r, a);
    }
    ctx.restore();
  }

  private drawMark(ctx: CanvasRenderingContext2D, sim: DlonieSim, r: number, a: number): void {
    const w = sim.who;
    const k = clamp((sim.t - sim.namedAt) / 1.5) * a;
    if (k <= 0.01) return;
    ctx.save();
    if (w.kind === 'name') {
      const ch = [...sim.whoText][0]?.toLocaleUpperCase() ?? '';
      ctx.font = `600 ${Math.max(11, Math.round(r * 0.95))}px "Fraunces Variable", Fraunces, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba('#a8642a', 0.32 * k);
      ctx.fillText(ch, 0, r * 0.06);
    } else if (w.kind === 'world') {
      ctx.strokeStyle = rgba('#b0743a', 0.28 * k);
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, 0, TAU);
      for (const e of [0.25, 0.55]) { ctx.moveTo(r * 0.62 * e, 0); ctx.ellipse(0, 0, r * 0.62 * e, r * 0.62, 0, 0, TAU); }
      ctx.moveTo(-r * 0.62, 0); ctx.lineTo(r * 0.62, 0);
      ctx.stroke();
    } else {
      // someone dear, or oneself: a small heart of warmer light
      ctx.fillStyle = rgba(w.kind === 'self' ? '#e9875f' : '#d88a4a', 0.28 * k);
      const s = r * 0.36;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.9);
      ctx.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.45);
      ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.3, -s * 0.1, 0, s * 0.9);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Threads of light between the fingertips while the hands breathe (and faintly while the ball grows). */
  private drawThreads(ctx: CanvasRenderingContext2D, sim: DlonieSim, l: HandPose, r: HandPose): void {
    const want = sim.step === 'breathe' || sim.step === 'name' || sim.step === 'wait' ? 1 : sim.step === 'ball' && !sim.blind ? 0.45 : sim.step === 'rest' ? 0.3 : 0;
    if (want <= 0.01 || sim.story) return;
    const a = want * (sim.step === 'breathe' ? clamp(sim.stepT / 3) : 1);
    const lt = tipsOf(l), rt = tipsOf(r);
    if (lt.length < 4) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const p = lt[i], q = rt[i];
      const sh = 0.5 + 0.5 * Math.sin(this.time * 2.2 + i * 1.7);
      const span = Math.hypot(q.x - p.x, q.y - p.y);
      const sag = span * (0.1 + 0.05 * i) + (this.opts.reducedMotion ? 0 : 3 * Math.sin(this.time * 1.1 + i));
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 + sag;
      ctx.strokeStyle = rgba('#ffe9c4', (0.07 + 0.12 * sh) * a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(mx, my, q.x, q.y);
      ctx.stroke();
      glow(ctx, '#fff0d0', p.x, p.y, 6, 0.3 * a);
      glow(ctx, '#fff0d0', q.x, q.y, 6, 0.3 * a);
      if (!this.opts.reducedMotion) {
        // a glint travelling along the thread
        const u = (this.time * (0.18 + 0.05 * i) + i * 0.37) % 1;
        const v = 1 - u;
        glow(ctx, '#fffbe8', v * v * p.x + 2 * u * v * mx + u * u * q.x, v * v * p.y + 2 * u * v * my + u * u * q.y, 5, 0.5 * a * Math.sin(Math.PI * u));
      }
    }
    ctx.restore();
  }

  private drawSmoke(ctx: CanvasRenderingContext2D): void {
    for (const p of this.puffs) {
      const k = p.age / p.life;
      glow(ctx, SMOKE, p.x, p.y, p.r, p.a * Math.sin(Math.PI * Math.min(1, k * 1.2)) * (1 - k));
    }
    if (this.trail.length < 3) return;
    // the ribbon of incense: two strands that curl as they age
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let s = 0; s < 2; s++) {
      ctx.beginPath();
      let first = true;
      for (const p of this.trail) {
        const age = this.time - p.t;
        const x = p.x + Math.sin(p.y * 0.045 + this.time * 0.9 + s * 2.4) * (3 + age * 7);
        if (first) { ctx.moveTo(x, p.y); first = false; } else ctx.lineTo(x, p.y);
      }
      ctx.strokeStyle = rgba('#f9ead2', 0.16 - s * 0.05);
      ctx.lineWidth = 2.2 - s * 0.8;
      ctx.stroke();
    }
  }

  private drawFlames(ctx: CanvasRenderingContext2D, sim: DlonieSim): void {
    const lifted = sim.offered.filter(o => !o.lay).length;
    const n = Math.min(12, lifted);
    if (!n) return;
    const sc = this.sc;
    const rad = Math.min(this.L.stage.w * 0.2, 110 * this.L.u);
    for (let i = 0; i < n; i++) {
      const ang = (this.opts.reducedMotion ? 0 : this.time * 0.22) + (i / n) * TAU;
      const x = sc.lightX + Math.cos(ang) * rad, y = sc.lightY + Math.sin(ang) * rad * 0.28;
      const fl = 0.8 + 0.2 * Math.sin(this.time * 7 + i * 3);
      const s = (5 + 2 * hash(i)) * this.L.u * fl;
      glow(ctx, GOLD, x, y, s * 3.2, 0.35);
      ctx.fillStyle = rgba('#fff2cf', 0.9);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.9);
      ctx.bezierCurveTo(x + s * 0.9, y - s * 0.6, x + s * 0.8, y + s * 0.6, x, y + s * 0.75);
      ctx.bezierCurveTo(x - s * 0.8, y + s * 0.6, x - s * 0.9, y - s * 0.6, x, y - s * 1.9);
      ctx.fill();
    }
  }

  private drawBloom(ctx: CanvasRenderingContext2D): void {
    if (this.bloom < 0) return;
    const k = clamp(this.bloom / 2.4);
    const e = ease.outCubic(k);
    const { x, y } = this.bloomAt;
    const R = Math.min(this.L.stage.w, this.L.h) * 0.22;
    const petals = 10;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + 0.3;
      const d = R * (0.15 + 0.85 * e);
      glow(ctx, '#fff0cc', x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, R * 0.32 * (1 - 0.4 * e), 0.5 * (1 - k));
    }
    glow(ctx, '#ffffff', x, y, R * (0.4 + 0.6 * e), 0.6 * (1 - k));
  }

  private drawSparks(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      const k = s.age / s.life;
      glow(ctx, s.c, s.x, s.y, 4 + 3 * (1 - k), 0.8 * (1 - k));
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      ctx.font = font(13, 700);
      ctx.fillStyle = rgba(GOLD, Math.max(0, 1 - f.age / 1.6));
      ctx.fillText(f.text, f.x, f.y);
    }
  }

  /** The small figure of light (kit/figure.ts) with its six places; the chosen one ringed; the laid hand. */
  private drawFigure(ctx: CanvasRenderingContext2D, sim: DlonieSim): void {
    const a = this.layK;
    const m = this.figMap();
    const map = (x: number, y: number): [number, number] => [m.ox + x * m.s, m.oy + y * m.s];
    const path = figurePath(map);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(RIM, 0.12);
    ctx.lineWidth = 8;
    ctx.stroke(path);
    ctx.strokeStyle = rgba(RIM_HI, 0.55);
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(32,19,10,0.92)';
    ctx.fill(path, 'nonzero');
    const place = sim.place;
    const breath = sim.breath.k;
    for (const p of PLACES) {
      const q = this.placePt(p);
      const on = p === place;
      if (on) {
        ctx.globalCompositeOperation = 'lighter';
        const laid = this.laidA;
        glow(ctx, '#ffd29a', q.x, q.y, m.s * (0.08 + 0.05 * laid + 0.02 * breath * laid), 0.4 + 0.5 * laid);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = rgba(GOLD, 0.85);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(5, m.s * 0.035), 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(IVORY, 0.35);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.8, 0, TAU);
        ctx.fill();
      }
    }
    if (place && this.laidA > 0.01) {
      const q = this.placePt(place);
      drawSmallHand(ctx, q.x, q.y, m.s * 0.11, this.laidA * 0.9);
    }
    ctx.restore();
  }

  /** Under the small figure, before the hand is laid: the place now, and a hint to tap another. */
  private drawPlaceHint(ctx: CanvasRenderingContext2D, sim: DlonieSim): void {
    const f = this.sc.fig;
    const place = sim.place;
    if (!place) return;
    ctx.save();
    ctx.globalAlpha = this.layK;
    ctx.font = font(13, 700);
    ctx.fillStyle = GOLD;
    if (this.sc.above) {
      // beside the place itself (under the figure lie the hands and the ball)
      const q = this.placePt(place);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const x = f.x + f.w * 0.78;
      ctx.fillText(fitText(ctx, `✋ ${placeLabel(place)}`, Math.max(60, this.L.right - x - 8), 13, 700, SANS, 13), x, q.y);
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const w = Math.max(f.w + 40, 96);
      const x = Math.min(this.L.right - w / 2 - 4, f.x + f.w / 2);
      ctx.fillText(fitText(ctx, `✋ ${placeLabel(place)}`, w, 13, 700, SANS, 13), x, f.y + f.h + 2);
    }
    ctx.restore();
  }

  private hoverCtrl(): CtrlId | null {
    if (!this.hover || this.opts.touch) return null;
    for (const c of CTRLS) {
      const r = this.L.ctrl[c].hit;
      if (this.hover.x >= r.x && this.hover.x <= r.x + r.w && this.hover.y >= r.y && this.hover.y <= r.y + r.h) return c;
    }
    return null;
  }

  // ── taps ──────────────────────────────────────────────────────
  private state(sim: DlonieSim): TargetState {
    let story: Rect | null = null;
    if (sim.story && this.ctx) story = this.storyR ?? (this.storyR = storyBox(this.ctx, this.L));
    const figOn = sim.lay && !sim.offeredNow && this.layK > 0.5 && sim.phase === 'play' && !sim.story && !sim.picker;
    const f = this.sc.fig;
    const fig = figOn ? { x: f.x - 6, y: f.y - 4, w: Math.max(44, f.w + 12), h: f.h + 8 } : null;
    return { story, picker: sim.picker ? walkOf(sim.p).length : null, fig };
  }

  hit(x: number, y: number, sim: DlonieSim): Hit { return hitTest(this.L, this.state(sim), x, y); }

  targets(sim: DlonieSim) { return sim.started && sim.phase !== 'done' ? tapTargets(this.L, this.state(sim)) : []; }

  /** The place nearest a tap on the small figure. */
  placeAt(x: number, y: number): HurtPlace | null {
    const m = this.figMap();
    return nearestPlace((x - m.ox) / m.s, (y - m.oy) / m.s, 0.16);
  }

  cursor(sim: DlonieSim): string {
    if (!this.hover) return 'default';
    const h = this.hit(this.hover.x, this.hover.y, sim);
    return h.kind === 'field' || h.kind === 'outside' ? 'default' : 'pointer';
  }

  /** Where a coach mark points. */
  point(what: Coach, sim: DlonieSim): { x: number; y: number } | null {
    if (what === 'who') { const b = this.L.ctrl.prev; return { x: b.x, y: b.y - b.r }; }
    if (what === 'lay') { const f = this.sc.fig; return { x: f.x + f.w / 2, y: f.y + f.h * 0.4 }; }
    const b = this.ballAt(sim);
    return { x: b.x, y: b.y - Math.max(b.r, 12) };
  }
}

export type { P };
export { MUTED };
