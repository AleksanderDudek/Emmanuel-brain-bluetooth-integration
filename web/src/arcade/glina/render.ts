/**
 * Glina's play view, all on the canvas.  The camera has three places: the courtyard (the gate with
 * its neighbour, the kick wheel and the vessel with the dotted outline of its form, the 16 fit dots,
 * the chalk line, the ruler, the potter's hand beside the finger and the trueness arc on the wheel
 * head; the wire at the cut and the glaze dip), the kiln (the vessel in its glowing chamber with ash
 * runs growing, the wheel out of view, the courtyard dimmed; plugged with bricks for a closed
 * kiln; then the opening in steam on a turntable), and the street at sunset.  It pans between them
 * (cross-fades with reduced motion).  It only reads the sim (sim.ts); the HUD and the cards live
 * in hud.ts, the calibration scene in intro.ts.  Nothing ever shakes or wobbles because of focus:
 * trueness shows as a crisper sheen, a truer rim and the arc.
 */
import { Particles, approach, clamp, ease } from '../kit/juice';
import { RINGS, U, type ClayForm } from './clay';
import { HOUSES, WALL_CM, runBand } from './content';
import { Hud, LABEL } from './hud';
import { fmtCm } from './i18n';
import { KneadIntro } from './intro';
import { TOP, layout, stageScale, type Layout, type Rect } from './layout';
import { tallestOf, type GlinaProgress } from './meta';
import { C, SANS, font, hand, hash, mix } from './paint';
import { Courtyard, drawStreet, kilnDome, kilnDoor, neighbour } from './scene';
import type { GlinaSim, SimEvent } from './sim';
import { TILT, drawVessel, look, radiusAt, widest } from './vessel';

const TAU = Math.PI * 2;
type Place = 'yard' | 'kiln' | 'street';
const DOTTED = [0.01, 6];
const DASHED = [9, 6];
const NO_DASH: number[] = [];

/** Ash motes rising from the firebox and, with calm, settling on the shoulder (pooled). */
interface Mote { x: number; y: number; vy: number; life: number; size: number }

export class GlinaView {
  private readonly ctx: CanvasRenderingContext2D;
  private L: Layout = layout(390, 844);
  private dpr = 1;
  private started = false;
  private clock = 0;
  private readonly yard = new Courtyard();
  private readonly hud: Hud;
  private readonly intro = new KneadIntro();
  private readonly v = look();
  private readonly tmpR = new Float64Array(RINGS);
  private readonly lumpR = new Float64Array(RINGS);
  /** px per cm of the form on the wheel (fixed per throw) */
  private scale = 12;
  private scaleFor: ClayForm | null = null;
  private rot = 0;
  private spin = 0;
  // the camera
  private place: Place = 'yard';
  private prev: Place = 'yard';
  private pan = 1;
  // moments
  private gateK = 0;
  private wire = -1;
  private cloud = 0;
  private ringT = -1;
  private fadeIn = 1;
  private readonly particles = new Particles(260);
  private readonly motes: Mote[] = Array.from({ length: 60 }, () => ({ x: 0, y: 0, vy: 0, life: 0, size: 1 }));
  private glint = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
  }

  resize(w: number, h: number, dpr: number): void {
    this.L = layout(w, h);
    this.dpr = dpr;
    this.scaleFor = null;
    this.hud.resize(this.L);
  }

  /** Play begins: the courtyard fades in from the calibration's bench. */
  start(): void {
    this.started = true;
    this.fadeIn = 1;
  }

  /** The stage for the pointer: the layout and the px per cm of the form on the wheel. */
  stage(sim: GlinaSim): { L: Layout; scale: number } {
    this.fitScale(sim);
    return { L: this.L, scale: this.scale };
  }

  /** The glaze buckets' rects at the cut (for taps). */
  buckets(n: number): Rect[] { return this.hud.bucketsAt(n); }

  private fitScale(sim: GlinaSim): void {
    const o = sim.order;
    if (o && this.scaleFor !== o.clay) {
      this.scaleFor = o.clay;
      this.scale = stageScale(this.L, o.clay);
    }
  }

  intro_(dt: number, p: number, progress: GlinaProgress): void {
    const { ctx } = this;
    if (this.started) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro.draw(ctx, this.L.w, this.L.h, dt, p, progress, this.opts.reducedMotion);
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: GlinaSim): void {
    const { L } = this, u = L.u;
    this.fitScale(sim);
    const clay = sim.clay;
    const rimY = clay ? L.foot - clay.H * this.scale : L.foot;
    switch (e.type) {
      case 'gate':
        this.gateK = 0;
        this.go('yard');
        this.scaleFor = null;
        this.fitScale(sim);
        break;
      case 'pull':
        if (e.tap && clay) this.particles.burst(L.axis + (hash(this.clock) - 0.5) * 20, rimY, 4, { color: C.wet, speed: 70, spread: 1.4, angle: -Math.PI / 2, g: 420, life: 0.5, size: 1.6, drag: 1.5 });
        break;
      case 'contact':
        this.particles.burst(L.axis + this.scaleR(sim) + 4, L.foot - sim.lineShown * this.scale, 8, { color: '#FFFFFF', speed: 40, spread: TAU, g: 60, life: 0.6, size: 1.4, drag: 2.5 });
        break;
      case 'slump':
        if (clay) this.particles.burst(L.axis, L.foot - clay.beforeH * this.scale * 0.5, 14, { color: C.wet, speed: 110, spread: Math.PI, angle: -Math.PI / 2, g: 520, life: 0.7, size: 2.2 });
        break;
      case 'centre':
        this.hud.float(LABEL.centre, L.axis, L.foot + 4 * u, '#5A3A28', 17 * u, 1.8);
        break;
      case 'cut':
        this.wire = 0;
        break;
      case 'glaze':
        break;
      case 'fire':
        this.go('kiln');
        break;
      case 'open':
        this.ringT = 0;
        this.steam();
        break;
      case 'alive':
        break;
      case 'finale':
        this.go('street');
        this.glint = 1;
        break;
      default:
        break;
    }
    if (e.type === 'slump') this.hud.float(LABEL.second, L.axis, L.foot + 4 * u, '#6B5B73', 16 * u, 1.6);
  }

  private go(p: Place): void {
    if (p === this.place) return;
    this.prev = this.place;
    this.place = p;
    this.pan = 0;
  }

  private steam(): void {
    const k = this.kilnRect(), d = kilnDoor(k);
    for (let i = 0; i < 18; i++) {
      this.particles.burst(d.x + d.w * (0.2 + 0.6 * hash(i + this.clock)), d.y + d.h * 0.5, 1, {
        color: 'rgba(255,255,255,.75)', speed: 30, angle: -Math.PI / 2, spread: 0.8, g: -30, drag: 0.6, life: 1.8, size: 9, shape: 'dot',
      });
    }
  }

  /** The vessel's radius at the line's height (px), for chalk dust. */
  private scaleR(sim: GlinaSim): number {
    const c = sim.clay;
    return c ? radiusAt(c.r, 1) * this.scale : 0;
  }

  update(dt: number, sim: GlinaSim): void {
    this.clock += dt;
    this.fitScale(sim);
    const turning = sim.phase === 'throw' || sim.phase === 'gate';
    this.spin = approach(this.spin, turning ? (sim.phase === 'gate' ? 4.5 : 3.2) : sim.phase === 'open' ? 0 : 0, dt, turning ? 0.6 : 0.4);
    this.rot += this.spin * dt;
    if (sim.phase === 'open') this.rot += (sim.phaseT < 2 ? (TAU / 2) * ease.inOutSine(Math.min(1, sim.phaseT / 2)) * dt * 2 : 0) * (this.opts.reducedMotion ? 0 : 1);
    this.pan = Math.min(1, this.pan + dt / (this.opts.reducedMotion ? 0.3 : 0.8));
    this.gateK = Math.min(1, this.gateK + dt / 0.9);
    if (this.wire >= 0) this.wire += dt;
    if (this.ringT >= 0) this.ringT += dt;
    this.glint = Math.max(0, this.glint - dt * 0.8);
    this.cloud = approach(this.cloud, sim.reliable || sim.phase === 'finale' || sim.phase === 'done' ? 0 : 1, dt, 0.8);
    this.fadeIn = Math.max(0, this.fadeIn - dt / 0.6);
    this.particles.update(dt);
    this.ash(dt, sim);
    this.hud.update(dt, sim);
  }

  /** The ash rising in the chamber, settling more as calm melts the runs (pooled, nothing allocated). */
  private ash(dt: number, sim: GlinaSim): void {
    if (sim.phase !== 'fire' || sim.closed) {
      for (const m of this.motes) m.life = Math.max(0, m.life - dt);
      return;
    }
    const d = kilnDoor(this.kilnRect());
    const settle = sim.shownG;
    for (const m of this.motes) {
      if (m.life <= 0) {
        if (hash(this.clock * 13 + m.size) < dt * 6) {
          m.x = d.x + d.w * (0.15 + 0.7 * Math.random());
          m.y = d.y + d.h;
          m.vy = -(14 + 22 * Math.random()) * (1 - 0.65 * settle) * this.L.u;
          m.life = 2 + Math.random() * 1.6;
          m.size = 0.8 + Math.random() * 1.4;
        }
        continue;
      }
      m.life -= dt;
      m.y += m.vy * dt;
      m.x += Math.sin(this.clock * 1.3 + m.size * 7) * 6 * dt;
    }
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: GlinaSim): void {
    const { ctx, L } = this;
    if (L.w < 2 || L.h < 2 || !this.started) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const k = ease.inOutSine(this.pan);
    if (k >= 1 || this.prev === this.place) this.drawPlace(this.place, sim, 0, 1);
    else if (this.opts.reducedMotion) {
      this.drawPlace(this.prev, sim, 0, 1);
      this.drawPlace(this.place, sim, 0, k);
    } else {
      // a pan: the old place slides out, the new one in (the kiln and the street lie to the right)
      this.drawPlace(this.prev, sim, -k * L.w, 1);
      this.drawPlace(this.place, sim, (1 - k) * L.w, 1);
    }
    this.particles.draw(ctx);
    this.hud.drawBand(sim, this.clock);
    this.hud.drawCards(sim, this.clock);
    const clay = sim.clay;
    if (this.place === 'yard' && clay) this.hud.drawHint(sim, L.foot - clay.H * this.scale, this.clock);
    else if (this.place === 'kiln' && sim.hint === 'kiln') this.hud.drawHint(sim, kilnDoor(this.kilnRect()).y, this.clock);
    this.hud.drawFloats();
    if (this.fadeIn > 0) {
      ctx.globalAlpha = ease.inOutSine(this.fadeIn);
      ctx.fillStyle = C.whitewash;
      ctx.fillRect(0, 0, L.w, L.h);
      ctx.globalAlpha = 1;
    }
  }

  private drawPlace(p: Place, sim: GlinaSim, dx: number, alpha: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (dx) ctx.translate(dx, 0);
    if (p === 'yard') this.drawYard(sim);
    else if (p === 'kiln') this.drawKiln(sim);
    else this.drawStreetScene(sim);
    ctx.restore();
  }

  private drawYard(sim: GlinaSim): void {
    const { ctx, L } = this, u = L.u;
    const p = sim.p;
    this.yard.draw(ctx, L, this.dpr, {
      t: this.clock, light: sim.light, cloud: this.cloud, still: this.opts.reducedMotion,
      gifts: p.gifts, treat: p.giftDay === sim.day && p.gifts.length ? todayTreat(p) : null,
    });
    const o = sim.order;
    if (o && sim.phase === 'gate') neighbour(ctx, L.gate, ease.outCubic(this.gateK), o.house === null, u);
    this.drawWheel(sim);
    const clay = sim.clay;
    if (!clay || !o) return;
    const s = this.scale;
    const throwing = sim.phase === 'throw', cut = sim.phase === 'cut';
    const v = this.v;
    v.x = L.axis;
    v.y = L.foot;
    v.scale = s;
    v.H = clay.H;
    v.r = clay.r;
    v.porcelain = o.porcelain;
    v.glaze = sim.phase === 'cut' ? sim.buckets[sim.pick] ?? o.glaze : o.glaze;
    v.fired = 0;
    v.gloss = 0.35 + 0.65 * sim.shownT;
    v.wavy = 0.008 * clay.H * (1 - sim.shownT);
    v.runs = 0;
    v.gift = null;
    v.wall = cut && sim.cutCard ? WALL_CM[sim.cutCard.wall] : 0.6;
    v.rot = this.rot;
    v.attach = cut ? o.form.attach : null;
    v.glow = 0;
    v.rows = 140;
    v.specks = true;
    v.alpha = 1;
    v.body = cut ? 'leather' : 'wet';
    if (clay.slump > 0) this.slumpShape(sim);
    if (throwing && !sim.blind) this.drawLine(sim, false);
    // the dip: the glaze climbs the vessel in the cut's last half second
    const dip = cut ? clamp((sim.phaseT - (sim.phaseDur - 0.65)) / 0.5) : 0;
    if (dip > 0) {
      drawVessel(ctx, v);
      const top = L.foot - clay.H * s * dip;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top, L.w, L.h - top);
      ctx.clip();
      v.body = 'glazed';
      drawVessel(ctx, v);
      ctx.restore();
    } else drawVessel(ctx, v);
    if (clay.slump > 0) v.r = clay.r;
    if (throwing) {
      this.drawOutline(sim);
      if (sim.blind) this.drawLine(sim, true);
      this.drawHand(sim);
      if (!sim.blind) this.drawArc(sim);
    }
    if (cut) this.drawWire(sim);
    if (throwing || cut) this.drawRuler(sim);
  }

  /** The wall twisting and slumping, then gathered into the lump (the sim already holds the lump). */
  private slumpShape(sim: GlinaSim): void {
    const clay = sim.clay!, v = this.v;
    const s = 1 - clay.slump / 1.2;
    const sag = this.opts.reducedMotion ? ease.outCubic(Math.min(1, s / 0.33)) : ease.inOutSine(Math.min(1, s / 0.55));
    const gather = clamp((s - 0.55) / 0.45);
    const H0 = clay.H;
    const Hs = clay.beforeH * (1 - 0.6 * sag) + (H0 - clay.beforeH * 0.4) * 0;
    for (let k = 0; k < RINGS; k++) {
      const sagged = clay.before[k] * (1 + 0.45 * sag * (1 - U[k]) * (1 - U[k]));
      this.tmpR[k] = sagged + (clay.r[k] - sagged) * ease.inOutSine(gather);
    }
    v.H = Hs + (H0 - Hs) * ease.inOutSine(gather);
    v.r = this.tmpR;
    if (this.opts.reducedMotion) v.alpha = 1 - 0.3 * sag * (1 - gather);
    void this.lumpR;
  }

  private drawWheel(sim: GlinaSim): void {
    const { ctx, L } = this, u = L.u;
    const x = L.axis, y = L.foot;
    const rx = Math.min(L.halfW * 0.82, 78 * u), ry = rx * TILT;
    // the kick wheel below, and its shaft
    ctx.fillStyle = 'rgba(107,91,115,.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 70 * u, rx * 1.5, ry * 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(C.wood, '#3A2A20', 0.35);
    ctx.fillRect(x - 4 * u, y, 8 * u, 56 * u);
    ctx.fillStyle = mix(C.wood, '#2A1D16', 0.2);
    ctx.beginPath();
    ctx.ellipse(x, y + 58 * u, rx * 1.25, ry * 1.25, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(C.wood, '#E0B88A', 0.2);
    ctx.beginPath();
    ctx.ellipse(x, y + 54 * u, rx * 1.25, ry * 1.25, 0, 0, TAU);
    ctx.fill();
    // the splash pan's wooden ring and the wheel head with its slip
    ctx.fillStyle = mix(C.wood, '#5A3A26', 0.25);
    ctx.beginPath();
    ctx.ellipse(x, y + 6 * u, rx * 1.18, ry * 1.25 + 6 * u, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8E7B6A';
    ctx.beginPath();
    ctx.ellipse(x, y + 3 * u, rx, ry + 3 * u, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix('#8E7B6A', C.wet, 0.35);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
    // the turn: a few slip streaks travelling round the head
    ctx.strokeStyle = 'rgba(255,240,220,.18)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = this.rot * 1.2 + (i * TAU) / 5;
      if (Math.sin(a) < -0.2) continue;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * (0.55 + 0.08 * i), ry * (0.55 + 0.08 * i), 0, a, a + 0.5);
      ctx.stroke();
    }
    void sim;
  }

  /** The dotted outline of the form at the current height, and its 16 chalk dots on the right (lit where the wall fits). */
  private drawOutline(sim: GlinaSim): void {
    const { ctx, L } = this, clay = sim.clay!, s = this.scale, u = L.u;
    const q = clay.form.q, H = clay.H;
    ctx.save();
    ctx.strokeStyle = C.chalk;
    ctx.lineWidth = 2.2 * u;
    ctx.lineCap = 'round';
    ctx.setLineDash(DOTTED.map(d => d * u));
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let j = 0; j <= 30; j++) {
        const uu = j / 30, x = L.axis + side * radiusAt(q, uu) * H * s, y = L.foot - uu * H * s;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash(NO_DASH);
    for (let k = 0; k < RINGS; k++) {
      const x = L.axis + q[k] * H * s + 7 * u, y = L.foot - U[k] * H * s;
      const on = clay.fits(k);
      ctx.beginPath();
      ctx.arc(x, y, (on ? 3.2 : 2.4) * u, 0, TAU);
      ctx.fillStyle = on ? '#FFFFFF' : 'rgba(255,255,255,.25)';
      ctx.fill();
      ctx.strokeStyle = on ? C.ink : 'rgba(59,42,34,.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The chalk line (dashed; grey and dotted while the signal fails; shimmering in the lag), or the blind throw's dusk line. */
  private drawLine(sim: GlinaSim, dusk: boolean): void {
    const { ctx, L } = this, u = L.u, s = this.scale;
    const H = dusk ? sim.duskLine : sim.lineShown;
    const y = L.foot - H * s;
    const x0 = L.axis - L.halfW * 0.92, x1 = L.ruler + 2;
    ctx.save();
    ctx.lineCap = 'round';
    if (dusk) {
      ctx.strokeStyle = C.sand;
      ctx.lineWidth = 3 * u;
      ctx.setLineDash(DOTTED.map(d => d * u * 1.3));
    } else if (!sim.reliable) {
      ctx.strokeStyle = 'rgba(150,140,150,.8)';
      ctx.lineWidth = 2 * u;
      ctx.setLineDash(DOTTED.map(d => d * u));
    } else {
      const lag = sim.blockT < (sim.order ? 5 : 0) && sim.F <= 0;
      ctx.strokeStyle = lag ? `rgba(255,255,255,${(0.55 + 0.3 * Math.sin(this.clock * 5)).toFixed(3)})` : C.chalk;
      ctx.lineWidth = 2.6 * u;
      ctx.setLineDash(DASHED.map(d => d * u));
      ctx.shadowColor = 'rgba(59,42,34,.35)';
      ctx.shadowBlur = 2;
    }
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.restore();
  }

  /** The potter's hand on the wall at the finger's height and side (never under the finger); a sponge at the rim at the end. */
  private drawHand(sim: GlinaSim): void {
    const { ctx, L } = this, clay = sim.clay!, s = this.scale, u = L.u;
    if (sim.sponge) {
      const rr = radiusAt(clay.r, 1) * s, y = L.foot - clay.H * s;
      ctx.fillStyle = '#E3C16F';
      ctx.beginPath();
      ctx.ellipse(L.axis + rr * 0.6, y - 4 * u, 12 * u, 7 * u, -0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,120,40,.4)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(L.axis + rr * 0.6 + (hash(i) - 0.5) * 16 * u, y - 4 * u + (hash(i + 5) - 0.5) * 8 * u, 1.2 * u, 0, TAU);
        ctx.fill();
      }
      hand(ctx, L.axis + rr * 0.6 + 10 * u, y - 10 * u, 26 * u, 1, 0.2);
      return;
    }
    if (clay.slump > 0) {
      // both hands gather the clay
      const k = 1 - clay.slump / 1.2;
      const r0 = radiusAt(this.v.r, 0.3) * s;
      hand(ctx, L.axis - r0 - 6 * u, L.foot - this.v.H * s * 0.35, 30 * u, -1, k);
      hand(ctx, L.axis + r0 + 6 * u, L.foot - this.v.H * s * 0.35, 30 * u, 1, k);
      return;
    }
    const uf = clay.hand, side = clay.side;
    const rr = radiusAt(clay.r, uf) * s;
    const y = L.foot - uf * clay.H * s;
    hand(ctx, L.axis + side * (rr + 2 * u), y, 30 * u, side, clay.strain);
    // the hand's height tick on the wall
    ctx.strokeStyle = C.chalk;
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(L.axis - side * (rr + 2 * u), y);
    ctx.lineTo(L.axis - side * (rr + 9 * u), y);
    ctx.stroke();
  }

  /** The trueness arc on the wheel head: fills with T, a tick at Na środku (visible throws only). */
  private drawArc(sim: GlinaSim): void {
    const { ctx, L } = this, u = L.u;
    const rx = Math.min(L.halfW * 0.82, 78 * u) * 1.08, ry = rx * TILT + 3 * u;
    const T = sim.shownT;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.ellipse(L.axis, L.foot + 2 * u, rx, ry, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    if (T > 0.005) {
      ctx.strokeStyle = T >= 0.5 ? '#FFFFFF' : 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.ellipse(L.axis, L.foot + 2 * u, rx, ry, 0, Math.PI * 0.9 - Math.PI * 0.8 * T, Math.PI * 0.9);
      ctx.stroke();
    }
    // the tick at 0.5
    const a = Math.PI * 0.5;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L.axis + Math.cos(a) * rx, L.foot + 2 * u + Math.sin(a) * ry - 4 * u);
    ctx.lineTo(L.axis + Math.cos(a) * rx, L.foot + 2 * u + Math.sin(a) * ry + 4 * u);
    ctx.stroke();
    ctx.restore();
  }

  /** The wire's zip under the foot as the cut begins. */
  private drawWire(sim: GlinaSim): void {
    if (this.wire < 0 || this.wire > 0.6) return;
    const { ctx, L } = this, u = L.u;
    const k = ease.outCubic(Math.min(1, this.wire / 0.35));
    const span = Math.min(L.halfW, 120 * u);
    const x = L.axis - span + 2 * span * k, y = L.foot - 1;
    ctx.save();
    ctx.globalAlpha = 1 - clamp((this.wire - 0.4) / 0.2);
    ctx.strokeStyle = 'rgba(40,30,24,.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 30 * u, y + 6 * u);
    ctx.lineTo(x + 30 * u, y - 2 * u);
    ctx.stroke();
    ctx.fillStyle = C.wood;
    ctx.fillRect(x - 34 * u, y + 3 * u, 6 * u, 10 * u);
    ctx.fillRect(x + 28 * u, y - 6 * u, 6 * u, 10 * u);
    ctx.restore();
    void sim;
  }

  /** The ruler beside the stage: cm ticks, the line's label, the height at the rim, the form's best as a short tick. */
  private drawRuler(sim: GlinaSim): void {
    const { ctx, L } = this, u = L.u, s = this.scale, clay = sim.clay!;
    const x = L.ruler, w = 11 * u;
    const top = Math.max(TOP + 8, L.top - 10 * u);
    ctx.save();
    ctx.fillStyle = 'rgba(214,184,138,.92)';
    ctx.fillRect(x, top, w, L.foot - top);
    ctx.fillStyle = 'rgba(120,84,52,.35)';
    ctx.fillRect(x + w - 1.5, top, 1.5, L.foot - top);
    const step = s >= 6 ? 1 : s >= 3 ? 2 : 5, label = s >= 9 ? 5 : 10;
    ctx.strokeStyle = 'rgba(59,42,34,.65)';
    ctx.lineWidth = 1;
    for (let cm = 0; L.foot - cm * s >= top; cm += step) {
      const y = L.foot - cm * s;
      const long = cm % label === 0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (long ? w * 0.75 : w * 0.4), y);
      ctx.stroke();
      if (long && cm > 0) this.hud.rulerLabel(String(cm), x + w * 0.5, y - 6 * u, 'rgba(59,42,34,.7)', 8.5 * u, 'center');
    }
    const lx = x + w + 3 * u;
    const room = L.w - lx - 4;
    const labelSize = 10.5 * u;
    // the form's best height, a short terracotta tick
    const best = tallestOf(sim.p, clay === null ? 'kubek' : sim.order!.form.id);
    if (best > 0 && L.foot - best * s >= top) {
      const y = L.foot - best * s;
      ctx.strokeStyle = C.terracotta;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(x - 4 * u, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      if (room > 30 * u) this.hud.rulerLabel(LABEL.best, lx, y, C.terracotta, 9 * u);
    }
    // the line (or the dusk line), labelled with its height
    const blind = sim.blind && sim.phase === 'throw';
    const lineH = blind ? sim.duskLine : sim.phase === 'cut' ? clay.H : sim.lineShown;
    const ly = L.foot - lineH * s;
    ctx.strokeStyle = blind ? C.sand : '#FFFFFF';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(x - 6 * u, ly);
    ctx.lineTo(x + w + 2 * u, ly);
    ctx.stroke();
    if (room > 24 * u) {
      const text = blind ? LABEL.dusk : `${fmtCm(lineH)}`;
      this.hud.rulerLabel(text, lx, ly - 7 * u, blind ? '#6B5B73' : C.ink, labelSize);
    }
    // the height at the rim: a small ink marker
    if (sim.phase === 'throw') {
      const hy = L.foot - clay.H * s;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.moveTo(x - 1, hy);
      ctx.lineTo(x - 7 * u, hy - 4 * u);
      ctx.lineTo(x - 7 * u, hy + 4 * u);
      ctx.closePath();
      ctx.fill();
      if (room > 24 * u && Math.abs(hy - ly) > 14 * u) this.hud.rulerLabel(fmtCm(clay.H), lx, hy + 2 * u, C.muted, 9.5 * u);
    }
    ctx.restore();
  }

  // ── the kiln ───────────────────────────────────────────────────
  private kilnRect(): Rect {
    const { L } = this;
    const avail = L.foot - Math.max(L.top - 20 * L.u, L.kind === 'portrait' ? L.card.y + L.card.h + 8 : TOP + 20);
    const w = Math.min(L.w * (L.kind === 'portrait' ? 0.92 : 0.5), avail * 1.25);
    const h = w * 0.82;
    return { x: L.axis - w / 2, y: L.foot - h, w, h };
  }

  private drawKiln(sim: GlinaSim): void {
    const { ctx, L } = this, u = L.u;
    const p = sim.p;
    // the courtyard behind, veiled: the rest is not spent on the wheel
    this.yard.draw(ctx, L, this.dpr, { t: this.clock, light: sim.light, cloud: this.cloud, still: this.opts.reducedMotion, gifts: p.gifts, treat: null });
    ctx.fillStyle = 'rgba(48,34,40,.42)';
    ctx.fillRect(0, 0, L.w, L.h);
    const r = this.kilnRect();
    const firing = sim.phase === 'fire';
    const opening = sim.phase === 'open';
    const closed = firing && sim.closed;
    const heat = firing ? 0.75 + 0.25 * Math.sin(this.clock * (closed ? 2 : 3.1 + 2 * hash(Math.floor(this.clock * 3)))) * (this.opts.reducedMotion ? 0.3 : 1) : 0.3;
    // the floor glow in front of the door
    const d = kilnDoor(r);
    if (firing && !closed) {
      const g = ctx.createRadialGradient(d.x + d.w / 2, r.y + r.h, 0, d.x + d.w / 2, r.y + r.h, r.w * 0.7);
      g.addColorStop(0, `rgba(255,154,77,${(0.35 * heat).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,154,77,0)');
      ctx.fillStyle = g;
      ctx.fillRect(r.x - r.w * 0.3, r.y + r.h * 0.4, r.w * 1.6, L.h - r.y - r.h * 0.4);
    }
    kilnDome(ctx, r, closed ? 'plugged' : firing ? 'glow' : 'open', heat);
    const v = this.v, o = sim.order, clay = sim.clay;
    if (!o || !clay) return;
    if (firing && !closed) {
      // the vessel in the chamber, glowing, its glaze maturing and the runs growing with calm
      const ks = Math.min((d.h * 0.78) / Math.max(1, clay.H), (d.w * 0.4) / Math.max(0.5, widest(clay.r)), this.scale);
      this.vesselFrom(sim, d.x + d.w / 2, d.y + d.h - 6 * u, ks);
      v.body = 'glazed';
      v.fired = clamp(sim.blockT / Math.max(1, sim.phaseDur));
      v.runs = sim.shownG;
      v.glow = 0.55 + 0.25 * heat;
      v.rows = 90;
      drawVessel(ctx, v);
      // ash motes
      ctx.fillStyle = 'rgba(255,236,190,.8)';
      for (const m of this.motes) {
        if (m.life <= 0) continue;
        ctx.globalAlpha = Math.min(1, m.life);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * u, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!this.opts.reducedMotion) this.shimmer(d);
    } else if (opening) {
      // the opening: the door planks set aside, steam, the vessel turning on a turntable in front
      ctx.fillStyle = mix(C.wood, '#3A2A20', 0.2);
      for (let i = 0; i < 4; i++) ctx.fillRect(r.x + r.w * 0.86 + i * 7 * u, r.y + r.h * 0.5 - i * 3 * u, 6 * u, r.h * 0.5 + i * 3 * u);
      const tx = L.axis, ty = L.foot - 6 * u;
      ctx.fillStyle = mix(C.wood, '#2A1D16', 0.25);
      ctx.beginPath();
      ctx.ellipse(tx, ty + 6 * u, Math.min(L.halfW * 0.7, 70 * u), Math.min(L.halfW * 0.7, 70 * u) * TILT + 4 * u, 0, 0, TAU);
      ctx.fill();
      this.vesselFrom(sim, tx, ty, this.scale);
      const card = sim.openCard;
      v.body = 'glazed';
      v.fired = 1;
      v.runs = card ? card.rec.runs / 100 : sim.G;
      v.gift = card?.gift ?? null;
      v.glow = Math.max(0, 0.35 - sim.phaseT * 0.25);
      drawVessel(ctx, v);
      if (this.ringT >= 0 && this.ringT < 1.6) {
        ctx.strokeStyle = `rgba(255,248,230,${(0.5 * (1 - this.ringT / 1.6)).toFixed(3)})`;
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.ellipse(tx, ty - clay.H * this.scale * 0.5, (30 + this.ringT * 60) * u, (30 + this.ringT * 60) * u * 0.55, 0, 0, TAU);
        ctx.stroke();
      }
    }
    void runBand;
  }

  /** The vessel as the sim holds it, at (x, y) and scale `s`. */
  private vesselFrom(sim: GlinaSim, x: number, y: number, s: number): void {
    const v = this.v, clay = sim.clay!, o = sim.order!;
    v.x = x;
    v.y = y;
    v.scale = s;
    v.H = clay.H;
    v.r = clay.r;
    v.porcelain = o.porcelain;
    v.glaze = sim.glaze;
    v.gloss = 0.6;
    v.wavy = 0;
    v.gift = null;
    v.wall = sim.cutCard ? WALL_CM[sim.cutCard.wall] : 0.6;
    v.rot = this.rot;
    v.attach = o.form.attach;
    v.rows = 120;
    v.specks = false;
    v.alpha = 1;
  }

  /** Heat over the door's arch: a few wavering translucent lines. */
  private shimmer(d: Rect): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,170,.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = d.y - 8 - i * 9;
      ctx.beginPath();
      for (let x = 0; x <= d.w; x += 6) {
        const yy = y + Math.sin(x * 0.12 + this.clock * 3 + i) * 2.5;
        if (x === 0) ctx.moveTo(d.x + x, yy); else ctx.lineTo(d.x + x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── the street ─────────────────────────────────────────────────
  private drawStreetScene(sim: GlinaSim): void {
    const { ctx, L } = this;
    const dusk = clamp(0.55 + sim.phaseT / 4);
    const alive = HOUSES.filter(h => sim.p.steps[h] >= 4);
    const lamps = sim.made.some(r => r.f === 'lampka');
    drawStreet(ctx, { x: 0, y: 0, w: L.w, h: L.h }, sim.p, { t: this.clock, dusk, glint: this.glint, alive, lamps });
  }
}

/** Today's treat on the bench, when today's gift was one. */
function todayTreat(p: GlinaProgress) {
  const last = p.gifts[p.gifts.length - 1];
  return last === 'figi' || last === 'oliwki' || last === 'chleb' ? last : null;
}

export { font, SANS };
