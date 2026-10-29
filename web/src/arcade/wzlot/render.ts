/**
 * Wzlot's play view, all on the canvas: the wilderness by day in parallax (the sky turning from
 * dawn to dusk across the session, three ranges in the colours of the land under the eaglet), the
 * sandstone hills of the terrain with their crags and wadis, the thermals' warm columns, the
 * eaglet — wings folded tight while held (a dive), spread by the wings' lift while let go (a
 * glide) — and the parent eagle ahead of it in a Lekcja with its golden wake, circling back on a
 * lapse, hidden in a cloud in a blind block, swooping under the eaglet to carry it, and spreading
 * its wings over the nest at the finisher.  The mist of an unreliable signal fills the valleys.
 * It only reads the sim (sim.ts); the HUD lives in hud.ts, the calibration in intro.ts.
 *
 * The camera follows the eaglet: the ground under it rests low on the screen, and a climb zooms
 * out (never past the world made ahead, so the screen shows the same hills on every device).
 */
import { approach, clamp, ease } from '../kit/juice';
import { LANDS, STAGES, VISTAS, missionById, type Land } from './content';
import { Hud } from './hud';
import { t } from './i18n';
import { WzlotIntro } from './intro';
import { layout, type Layout } from './layout';
import type { WzlotProgress } from './meta';
import {
  C, LAND_LOOK, LANDS_SEED, SANS, SERIF, font, hash, mixInto, paintCloud, paintEagle, paintEaglet, paintNest, paintRange, paintSky,
  paintSpire, paintThermal, paintVista, rgb, skyAt, type EagletPose, type RGB, type SkyLook,
} from './paint';
import { RULES, type SimEvent, type WzlotSim } from './sim';

const TAU = Math.PI * 2;
const TXT = {
  smooth: t('fx.smooth'), soar: t('fx.soar'), crag: t('fx.crag'), back: t('fx.return'), beat: t('fx.wingbeat'), carried: t('fx.carried'),
  thermal: t('fx.thermal'), vista: t('fx.vista'), daily: t('daily.title'), finale: t('finale.title'), finaleSub: t('finale.sub'),
};

/** A bit of dust, a feather or a spark, in world units (it stays where it was made as the camera moves). */
interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number }

/** The colours of the land being flown, eased toward the next land's at a wadi. */
interface LandNow { far: RGB; mid: RGB; near: RGB; ground: RGB; strata: RGB; green: RGB }
const landNow = (): LandNow => ({ far: [0, 0, 0], mid: [0, 0, 0], near: [0, 0, 0], ground: [0, 0, 0], strata: [0, 0, 0], green: [0, 0, 0] });

const TRAIL = 48;

export class WzlotView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new WzlotIntro();
  private started = false;
  private clock = 0;
  private fadeIn = 1;
  // the camera
  private camX = 0;
  private camY = 0;
  private zoom = 1;
  private ground = 0;
  private camReady = false;
  // the land's colours
  private land: Land = 'negev';
  private readonly cur = landNow();
  private landInit = false;
  private readonly sky: SkyLook = skyAt(0);
  private readonly tmp: RGB = [0, 0, 0];
  private ridgeSeen = -1;
  // the eaglet and the parent
  private fold = 0;
  private flap = 0;
  private flapT = 0;
  private glow = 0;
  private readonly pose: EagletPose = { stage: 1, fold: 0, spread: 0.55, flap: 0, glow: 0 };
  private px = 0;
  private py = 0;
  private pAlpha = 0;
  private pFace = 1;
  private pFlap = 0;
  private readonly trail = new Ring(TRAIL);
  private trailT = 0;
  private readonly wake = new Ring(TRAIL);
  private wakeGold = 0;
  private cloudK = 0;
  private mist = 0;
  // moments
  private readonly bits: Bit[] = [];
  private readonly usedFade = new Map<number, number>();
  private vistaT = -1;
  private vistaLand: Land = 'negev';
  private vistaLight: 'dawn' | 'dusk' = 'dawn';
  private finaleT = -1;
  private nestT = -1;
  private bump = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
    this.hud.resize(this.L);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h);
    this.hud.resize(this.L);
  }

  start(): void {
    this.started = true;
    this.fadeIn = 1;
  }

  intro(dt: number, p: number, progress: WzlotProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── world ↔ screen ──────────────────────────────────────────────
  private get S(): number { return this.L.base * this.zoom; }
  private sx(x: number): number { return this.L.ex + (x - this.camX) * this.S; }
  private sy(y: number): number { return this.L.gy - (y - this.camY) * this.S; }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: WzlotSim): void {
    const eg = sim.eaglet, rm = this.opts.reducedMotion;
    const ex = this.sx(eg.x), ey = this.sy(eg.y);
    const u = this.L.u;
    switch (e.type) {
      case 'land': {
        const n = e.cls === 'smooth' ? 8 : e.cls === 'stall' ? 10 : 5;
        this.dust(eg.x, eg.y, rm ? 2 : n, e.cls === 'smooth' ? 'rgba(255,236,196,.9)' : 'rgba(214,180,130,.9)');
        if (e.cls === 'smooth') this.hud.float(e.chain >= 2 ? `${TXT.smooth} ×${e.chain}` : TXT.smooth, ex, ey - 34 * u, '#3f7a3a', 15, 1.1);
        else if (e.cls === 'near') this.hud.float(t('fx.near', { deg: Math.round(e.deg) }), ex, ey - 34 * u, '#8a6a2a', 13, 1.1);
        if (e.cls === 'stall') this.bump = 1;
        break;
      }
      case 'soar':
        this.hud.float(TXT.soar, ex, ey - 54 * u, '#b6781e', 19, 1.5, 44);
        this.sparks(eg.x, eg.y, rm ? 4 : 14);
        this.hud.popScore();
        break;
      case 'crag':
        this.hud.float(TXT.crag, ex + 20 * u, ey - 46 * u, '#7a4a22', 16, 1.2);
        break;
      case 'catch':
        this.dust(eg.x, eg.y, rm ? 2 : 6, 'rgba(230,214,190,.8)');
        break;
      case 'carried':
        break;
      case 'step':
        this.hud.float(t('fx.step', { n: Math.round(e.bonus * 100) }), this.sx(this.px), this.sy(this.py) - 26 * u, '#b6781e', 13, 1.3);
        break;
      case 'return':
        this.hud.float(TXT.back, this.sx(this.px), this.sy(this.py) - 30 * u, e.gold ? '#c48a12' : '#7a4a22', e.gold ? 18 : 15, 1.5, 40);
        this.wakeGold = 1;
        if (!rm) this.sparks(this.px, this.py, 10);
        break;
      case 'thermal':
        this.hud.float(TXT.thermal, ex, ey - 40 * u, '#8a3f16', 14, 1.3);
        break;
      case 'climbTop':
        break;
      case 'vistaSeen':
        this.vistaT = 0;
        this.vistaLand = this.land;
        this.vistaLight = e.light;
        break;
      case 'vista': {
        const v = VISTAS[e.index];
        const title = !e.isNew ? t('card.vistaDup', { name: v.name, down: RULES.dupDown }) : e.via === 'craft' ? t('card.vistaCraft', { name: v.name }) : t('card.vista', { name: v.name });
        this.hud.card(title, '', { rank: 1, dur: 3, vista: { land: v.land, light: v.light } });
        break;
      }
      case 'feather':
        this.hud.popFeather();
        if (e.why === 'mission' || e.why === 'session') this.hud.float(t('fx.feather', { n: e.why === 'session' ? RULES.featherSession : RULES.featherMission }), this.L.scoreX - 50 * u, this.L.scoreY + 100 * u, '#8a5a34', 13, 1.4);
        break;
      case 'blockEnd': {
        const b = e.block;
        if (b.kind === 'warmup' || e.verdict === null) break;
        if (e.verdict) {
          this.hud.card(t('card.feather'), b.kind === 'wzn' ? t('card.feather.wzn') : t('card.feather.lekcja'), { rank: 0, dur: 2.8, icon: 'feather' });
          if (b.kind === 'wzn') this.hud.card(t('card.strong'), '', { rank: 1, dur: 2.4, icon: 'thermal' });
        } else {
          this.hud.card(t('card.near', { share: Math.round(e.share * 100), need: Math.round(e.need * 100) }), '', { rank: 0, dur: 2.4, color: '#6d5a3a' });
        }
        break;
      }
      case 'blindReveal':
        this.hud.card(t('blind.reveal', { n: e.sec }), '', { rank: 0, dur: 2.8, icon: 'thermal' });
        break;
      case 'blockStart': {
        const b = e.block;
        if (b.stretch) this.hud.card(t('block.stretch'), t('tip.stretch'), { rank: 2, dur: 2.6 });
        break;
      }
      case 'mission': {
        this.hud.card(t('card.mission', { name: missionById(e.id)?.name ?? e.id }), '', { rank: 1, dur: 2.8, icon: 'log' });
        break;
      }
      case 'stage': {
        const st = STAGES[e.stage - 1];
        this.hud.card(t('card.stage', { name: st.name }), st.skill, { rank: 0, dur: 3.2, icon: 'stage' });
        if (!rm) this.sparks(eg.x, eg.y, 18);
        break;
      }
      case 'gift':
        this.hud.card(t('card.gift', { n: e.feathers }), '', { rank: 2, dur: 2.4, icon: 'feather' });
        break;
      case 'wingbeat':
        this.flapT = 0.45;
        this.hud.float(TXT.beat, ex, ey - 40 * u, '#7a4a22', 14, 1.1);
        this.dust(eg.x, eg.y - 0.02, rm ? 2 : 6, 'rgba(255,248,230,.8)');
        break;
      case 'finale':
        this.finaleT = 0;
        this.hud.clearCards();
        break;
      case 'nest':
        this.nestT = 0;
        if (!rm) this.sparks(eg.x, eg.y + 0.05, 16);
        break;
      default:
        break;
    }
  }

  private dust(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (Math.random() - 0.5) * 1.6;
      const s = 0.25 + Math.random() * 0.35;
      this.bit({ x, y, vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s * 0.6 + 0.1, life: 0.6, max: 0.6, size: 2 + Math.random() * 2, color, g: -0.4 });
    }
  }

  private sparks(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = 0.2 + Math.random() * 0.4;
      this.bit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.9, max: 0.9, size: 1.5 + Math.random() * 1.8, color: '#ffd98a', g: 0.15 });
    }
  }

  private bit(b: Bit): void {
    if (this.bits.length >= 120) this.bits.shift();
    this.bits.push(b);
  }

  // ── a frame ──────────────────────────────────────────────────────
  update(dt: number, sim: WzlotSim): void {
    this.clock += dt;
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.5);
    this.hud.update(dt, sim);
    const e = sim.eaglet, T = sim.terrain, L = this.L;
    // the land under the eaglet: each ridge is one of the four, in turn
    const ridge = T.ridgeAt(e.x);
    const idx = ridge?.index ?? 0;
    this.land = LANDS[idx % LANDS.length];
    if (ridge && idx !== this.ridgeSeen) {
      if (this.ridgeSeen >= 0 && ridge.spec.daily) this.hud.card(TXT.daily, '', { rank: 2, dur: 2 });
      this.ridgeSeen = idx;
    }
    const target = LAND_LOOK[this.land];
    const k = this.landInit ? 1 - Math.exp(-dt / 1.4) : 1;
    this.landInit = true;
    for (const key of ['far', 'mid', 'near', 'ground', 'strata', 'green'] as const) mixInto(this.cur[key], this.cur[key], target[key], k);
    // the camera: the ground under the eaglet (smoothed) rests at gy; a climb zooms out, then lifts the view
    let gsum = 0;
    for (let i = 0; i < 5; i++) gsum += T.height(e.x - 0.2 + i * 0.35);
    const g = gsum / 5;
    const fin = sim.finale;
    const focusY = fin && sim.phase !== 'play' ? Math.max(e.y, fin.ny + 0.15) : e.y;
    if (!this.camReady) {
      this.ground = g;
      this.camX = e.x;
      this.camY = g;
      this.camReady = true;
    }
    this.ground = approach(this.ground, g, dt, 0.45);
    const room = L.gy - L.ceiling;
    const alt = Math.max(0, focusY - this.ground);
    const zMin = (L.w - L.ex) / (L.ahead * L.base);
    const zWant = clamp(room / Math.max(1e-3, alt * L.base + 30), zMin, 1);
    this.zoom = approach(this.zoom, zWant, dt, zWant < this.zoom ? 0.35 : 0.8);
    const S = L.base * this.zoom;
    const over = Math.max(0, alt * S - room) / S;
    this.camY = approach(this.camY, this.ground + over, dt, over > 0 ? 0.1 : 0.3);
    // never under the HUD: a fast climb pulls the view up with it
    const hi = focusY - (L.gy - L.ceiling) / S;
    if (this.camY < hi) this.camY = hi;
    const xWant = fin && sim.phase !== 'play' ? e.x + (fin.nx - e.x) * 0.35 : e.x;
    this.camX = approach(this.camX, xWant, dt, e.caught ? 0.25 : 0.08);
    // the wings: folded while held, opening as the glide begins; a beat flaps them
    this.fold = approach(this.fold, sim.held && e.mode !== 'climb' ? 1 : 0, dt, 0.06);
    if (this.flapT > 0) this.flapT = Math.max(0, this.flapT - dt);
    const climbing = e.mode === 'climb' || (sim.phase !== 'play' && this.nestT < 0);
    this.flap = this.flapT > 0 ? this.flap + dt * 22 : climbing ? this.flap + dt * 7 : approach(this.flap, Math.round(this.flap / TAU) * TAU, dt, 0.15);
    this.glow = approach(this.glow, sim.soaring ? 1 : 0, dt, 0.3);
    this.wakeGold = Math.max(0, this.wakeGold - dt / Math.max(0.5, RULES.retDur));
    this.bump = Math.max(0, this.bump - dt * 3);
    this.cloudK = approach(this.cloudK, sim.parent === 'cloud' ? 1 : 0, dt, 0.6);
    this.mist = approach(this.mist, sim.fog, dt, 0.4);
    if (this.vistaT >= 0 && (this.vistaT += dt) > 3.6) this.vistaT = -1;
    if (this.finaleT >= 0) this.finaleT += dt;
    if (this.nestT >= 0) this.nestT += dt;
    this.parentTick(dt, sim);
    // a thermal ridden fades slowly (the climb is still in it)
    for (const th of sim.thermals) {
      const f = this.usedFade.get(th.id) ?? 1;
      if (th.used && e.mode !== 'climb') this.usedFade.set(th.id, Math.max(0.25, f - dt / 2.5));
      else if (!this.usedFade.has(th.id)) this.usedFade.set(th.id, 1);
    }
    if (this.usedFade.size > 12) for (const id of this.usedFade.keys()) if (!sim.thermals.some(th => th.id === id)) this.usedFade.delete(id);
    // the trails: the eaglet's (soaring) and the parent's wake
    this.trailT += dt;
    if (this.trailT >= 1 / 40) {
      this.trailT = 0;
      this.trail.push(e.x, e.y);
      this.wake.push(this.px - 0.06, this.py);
    }
    // world bits
    let n = 0;
    for (const b of this.bits) {
      b.life -= dt;
      if (b.life <= 0) continue;
      b.vy -= b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.bits[n++] = b;
    }
    this.bits.length = n;
  }

  /** Where the parent flies for its mode; it eases there (and sits right under the eaglet in a carry). */
  private parentTick(dt: number, sim: WzlotSim): void {
    const e = sim.eaglet, T = sim.terrain, c = this.clock;
    let tx = e.x + 3, ty = e.y + 2.4, ta = 0, tau = 0.6;
    switch (sim.parent) {
      case 'ahead': {
        tx = e.x + 0.9;
        ty = Math.max(e.y + 0.3, T.height(tx) + 0.45) + 0.04 * Math.sin(c * 1.3);
        ta = 1;
        tau = 0.45;
        break;
      }
      case 'telegraph':
        tx = e.x + 1.5;
        ty = e.y + 0.85;
        ta = 0.8;
        tau = 0.9;
        break;
      case 'circling':
        tx = e.x + 0.6 + 0.32 * Math.cos(c * 1.7);
        ty = Math.max(e.y, T.height(e.x + 0.6) + 0.3) + 0.5 + 0.18 * Math.sin(c * 1.7);
        ta = 1;
        tau = 0.35;
        break;
      case 'cloud':
        tx = e.x + 1.2;
        ty = e.y + 1.1;
        ta = 0;
        break;
      case 'catch':
        if (e.mode === 'carry' || e.mode === 'catch') {
          tx = e.x - (e.mode === 'catch' ? 0.05 : 0.01);
          ty = e.y - 0.05;
          ta = 1;
          tau = e.mode === 'carry' ? 0.02 : 0.12;
        } else {
          tx = e.x + 0.4;
          ty = e.y + 0.4;
          ta = 1;
        }
        break;
      case 'nest': {
        const f = sim.finale;
        if (this.nestT >= 0 && f) {
          // over the nest with its wings spread
          tx = f.nx + 0.02;
          ty = f.ny + 0.42 + 0.02 * Math.sin(c * 2);
        } else {
          tx = e.x - 0.25;
          ty = e.y + 0.18;
        }
        ta = 1;
        tau = 0.35;
        break;
      }
      default:
        break;
    }
    // never under the HUD: at most this high on the screen
    const top = this.camY + (this.L.gy - this.L.ceiling - 12 * this.L.u) / this.S;
    if (sim.parent !== 'catch') ty = Math.min(ty, top);
    if (this.pAlpha < 0.02 && ta > 0) {
      // it comes in from high up ahead
      this.px = e.x + 1.8;
      this.py = e.y + 1.2;
    }
    const ox = this.px;
    this.px = approach(this.px, tx, dt, tau);
    this.py = approach(this.py, ty, dt, tau);
    if (sim.parent !== 'catch') this.py = Math.min(this.py, top);
    this.pAlpha = approach(this.pAlpha, ta, dt, ta > this.pAlpha ? 0.4 : 0.6);
    const vx = (this.px - ox) / Math.max(1e-4, dt);
    if (sim.parent === 'circling') this.pFace = Math.sin(c * 1.7) > 0 ? -1 : 1;
    else if (Math.abs(vx - (e.speed || 0)) > 0.05 || sim.parent !== 'catch') this.pFace = vx < -0.3 ? -1 : 1;
    this.pFlap += dt * (sim.parent === 'circling' ? 4 : sim.parent === 'nest' && this.nestT >= 0 ? 3 : 2.4);
  }

  draw(sim: WzlotSim): void {
    const { ctx } = this;
    if (this.w < 2 || this.h < 2 || !this.started) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const rm = this.opts.reducedMotion;
    const phase = this.finaleT >= 0 ? 1 + 0.35 * clamp(this.finaleT / 4.5) : sim.dayPhase;
    const sky = skyAt(phase, this.sky);
    ctx.save();
    if (this.bump > 0 && !rm) ctx.translate(0, Math.sin(this.clock * 50) * this.bump * 2.5);
    paintSky(ctx, -4, -4, this.w + 8, this.h + 8, phase, sky, this.clock);
    this.drawSkyClouds(sky, rm);
    this.drawRanges(sky);
    this.drawThermals(sim, rm);
    this.drawNest(sim);
    this.drawGround(sim, sky);
    this.drawNestTop(sim);
    this.drawMist(sim);
    this.drawWake(sim);
    this.drawTrail();
    // the parent under the eaglet in a carry (the eaglet rides on its wings), else above
    const e = sim.eaglet;
    const carrying = e.caught;
    if (carrying) this.drawParent();
    this.drawEaglet(sim);
    if (!carrying) this.drawParent();
    this.drawBits();
    if (this.cloudK > 0.01) this.drawCloud();
    if (this.vistaT >= 0) this.drawVistaGlow();
    // the light of the hour over everything
    if (sky.night > 0) {
      ctx.fillStyle = `rgba(16,20,48,${(0.38 * sky.night).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.restore();
    this.drawGhostHand();
    this.hud.draw(sim);
    if (this.nestT >= 0) this.drawFinaleText();
    if (this.fadeIn > 0) {
      ctx.globalAlpha = ease.inOutSine(this.fadeIn);
      ctx.fillStyle = '#1c1610';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
  }

  // ── the backdrop ─────────────────────────────────────────────────
  private drawSkyClouds(sky: SkyLook, rm: boolean): void {
    const { ctx, w } = this;
    const drift = rm ? 0 : this.clock * 4;
    for (let i = 0; i < 4; i++) {
      const span = w + 300;
      const x = ((hash(i + 40) * span - this.camX * 18 * (0.5 + 0.3 * i) - drift * (1 + i * 0.3)) % span + span) % span - 150;
      const y = this.L.ceiling * 0.6 + hash(i + 41) * this.h * 0.3;
      paintCloud(ctx, x, y, 140 + 80 * hash(i + 42), 40 + 20 * hash(i + 43), 0.5 * (1 - sky.night * 0.7), i + 1, '255,250,244');
    }
  }

  /**
   * Three ranges in the land's colours, hazed by the sky, each moving slower than the ground.  They
   * are sized by the sky's room on the screen (not the zoom), so a climb never makes them loom.
   */
  private drawRanges(sky: SkyLook): void {
    const { ctx, w, h } = this;
    const L = this.L;
    const seed = LANDS_SEED[this.land];
    const room = L.gy - L.ceiling * 0.7;
    const lift = Math.min(room * 0.5, (this.camY - this.ground) * this.S);   // a climb lifts the view: the ranges sink a little
    const layers: [number, number, number, number, number, RGB, number][] = [
      // parallax, density, foot above gy (share of the room), height (share), vertical follow, colour, haze
      [0.06, 1.4, 0.34, 0.5, 0.25, this.cur.far, 0.5],
      [0.16, 2.0, 0.17, 0.36, 0.45, this.cur.mid, 0.32],
      [0.34, 2.8, 0.02, 0.26, 0.7, this.cur.near, 0.16],
    ];
    layers.forEach(([par, dens, foot, height, follow, color, haze], i) => {
      const k = dens / L.base;
      const x0 = this.camX * par * dens * 1.5 + i * 7.3 - L.ex * k;
      const base = L.gy - foot * room + lift * follow;
      mixInto(this.tmp, color, sky.mid, haze);
      mixInto(this.tmp, this.tmp, sky.light, 0.12);
      if (sky.night > 0) mixInto(this.tmp, this.tmp, [30, 32, 60], 0.5 * sky.night);
      paintRange(ctx, w, x0, k, base, height * room, this.tmp, this.land, i as 0 | 1 | 2, seed + i * 10, h + 4);
    });
  }

  /** A vista opens: the land's panorama glows in the sky for a moment. */
  private drawVistaGlow(): void {
    const { ctx, L } = this;
    const k = this.vistaT;
    const a = Math.min(1, k / 0.6, (3.6 - k) / 0.8);
    if (a <= 0) return;
    const u = L.u;
    const vw = Math.min(this.w - 40, 420 * u), vh = vw * 0.36;
    const x = (this.w - vw) / 2, y = L.cardY - vh / 2 - 10 * u;
    ctx.save();
    ctx.globalAlpha = a * 0.95;
    ctx.fillStyle = 'rgba(43,34,25,.25)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 3, vw, vh, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x, y, vw, vh, 14);
    ctx.clip();
    paintVista(ctx, this.vistaLand, this.vistaLight, x, y, vw, vh);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(251,243,228,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, vw, vh, 14);
    ctx.stroke();
    // its caption on a paper strip under the frame
    ctx.font = font(650, 14 * u, SANS);
    const tw = ctx.measureText(TXT.vista).width;
    const pw = tw + 24 * u, ph = 26 * u;
    ctx.fillStyle = 'rgba(251,243,228,.94)';
    ctx.beginPath();
    ctx.roundRect(this.w / 2 - pw / 2, y + vh - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a22';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TXT.vista, this.w / 2, y + vh + 0.5);
    ctx.restore();
  }

  // ── the ground ──────────────────────────────────────────────────
  private drawGround(sim: WzlotSim, sky: SkyLook): void {
    const { ctx, w, h } = this;
    const T = sim.terrain, S = this.S;
    const end = T.end;
    const ground = this.cur.ground, strata = this.cur.strata;
    mixInto(this.tmp, ground, sky.light, 0.18);
    if (sky.night > 0) mixInto(this.tmp, this.tmp, [40, 38, 70], 0.45 * sky.night);
    const top = rgb(this.tmp);
    const g = ctx.createLinearGradient(0, this.sy(this.ground + 0.3), 0, this.sy(this.ground - 1.2));
    g.addColorStop(0, top);
    mixInto(this.tmp, strata, [60, 34, 20], 0.35);
    if (sky.night > 0) mixInto(this.tmp, this.tmp, [30, 28, 56], 0.5 * sky.night);
    g.addColorStop(1, rgb(this.tmp));
    const step = 4;
    const heights = this.heights(sim, step);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-step, h + 4);
    for (let i = 0; i < heights.length; i++) ctx.lineTo(i * step - step, heights[i]);
    ctx.lineTo(w + step * 2, h + 4);
    ctx.closePath();
    ctx.fill();
    // strata: lines following the slope, deeper and fainter
    ctx.lineWidth = 1.5;
    for (let s = 1; s <= 3; s++) {
      ctx.strokeStyle = rgb(strata, 0.42 - s * 0.08);
      ctx.beginPath();
      const off = s * 0.07 * S;
      for (let i = 0; i < heights.length; i++) ctx.lineTo(i * step - step, heights[i] + off + Math.sin(i * 0.09 + s) * 1.5);
      ctx.stroke();
    }
    // the sunlit rim
    mixInto(this.tmp, ground, [255, 244, 220], 0.5);
    ctx.strokeStyle = rgb(this.tmp, sky.night > 0 ? 0.9 - 0.6 * sky.night : 0.9);
    ctx.lineWidth = Math.max(2, S * 0.008);
    ctx.beginPath();
    for (let i = 0; i < heights.length; i++) ctx.lineTo(i * step - step, heights[i]);
    ctx.stroke();
    // the wadis: shadow in the gorge; the crags: a cairn of stones
    for (const r of T.ridges) {
      const x0 = this.sx(r.wadiX0), x1 = this.sx(r.wadiX1);
      if (x1 < -10 || x0 > w + 10) continue;
      if (!r.spec.gentle) {
        // the gorge's shaded walls: a band under its surface, fading down
        const band = S * 0.3;
        const gg = ctx.createLinearGradient(0, this.sy(r.rimY), 0, this.sy(r.rimY) + S * 0.9);
        gg.addColorStop(0, 'rgba(60,32,22,.4)');
        gg.addColorStop(1, 'rgba(60,32,22,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        for (let x = x0; x <= x1 + 0.5; x += step) ctx.lineTo(x, this.sy(T.height(r.wadiX0 + (x - x0) / S)));
        for (let x = x1; x >= x0 - 0.5; x -= step) ctx.lineTo(x, this.sy(T.height(r.wadiX0 + (x - x0) / S)) + band);
        ctx.closePath();
        ctx.fill();
      }
      const cx = this.sx(r.crag), cy = this.sy(r.cragY);
      if (cx > -20 && cx < w + 20) this.cairn(cx - S * 0.05, cy, S * 0.05, r.spec.daily);
    }
    // a few tufts in the green lands' troughs
    const green = this.cur.green;
    if (this.land === 'jordan' || this.land === 'hermon' || this.land === 'wadi') {
      ctx.strokeStyle = rgb(green, 0.85);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const left = this.camX - this.L.ex / S, right = left + w / S;
      for (const r of T.ridges) for (const tx of r.troughs) {
        if (tx < left - 0.1 || tx > right + 0.1 || tx > end) continue;
        const px = this.sx(tx), py = this.sy(T.height(tx));
        for (let j = 0; j < 5; j++) {
          const ox = (hash(tx * 13 + j) - 0.5) * S * 0.12;
          const hh = S * (0.02 + 0.02 * hash(tx * 7 + j));
          ctx.moveTo(px + ox, py + 1);
          ctx.lineTo(px + ox + hh * 0.3, py - hh);
        }
      }
      ctx.stroke();
    }
  }

  private heightsBuf = new Float32Array(0);
  /** The ground's screen y every `step` px across the screen (one lookup per column, reused). */
  private heights(sim: WzlotSim, step: number): Float32Array {
    const n = Math.ceil(this.w / step) + 4;
    if (this.heightsBuf.length !== n) this.heightsBuf = new Float32Array(n);
    const T = sim.terrain, S = this.S, end = T.end;
    for (let i = 0; i < n; i++) {
      const px = i * step - step;
      const wx = Math.min(end, this.camX + (px - this.L.ex) / S);
      this.heightsBuf[i] = this.sy(T.height(wx));
    }
    return this.heightsBuf;
  }

  private cairn(x: number, y: number, s: number, daily: boolean): void {
    const { ctx } = this;
    ctx.fillStyle = '#8f7356';
    for (let i = 0; i < 3; i++) {
      const r = s * (0.42 - i * 0.1);
      ctx.beginPath();
      ctx.ellipse(x, y - s * (0.25 + i * 0.55) * 0.7, r, r * 0.7, 0, 0, TAU);
      ctx.fill();
    }
    if (daily) {
      // the day's ridge: a pale ribbon on its cairn
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.5);
      ctx.quadraticCurveTo(x + s * 0.6, y - s * 1.9, x + s * 1.2, y - s * 1.6);
      ctx.stroke();
    }
  }

  // ── thermals, the nest, the mist ────────────────────────────────
  private drawThermals(sim: WzlotSim, rm: boolean): void {
    const S = this.S;
    for (const th of sim.thermals) {
      const x = this.sx(th.x);
      if (x < -S || x > this.w + S) continue;
      const k = sim.strengthOf(th);
      const a = clamp(th.age / 1.2) * (this.usedFade.get(th.id) ?? 1);
      const floor = this.sy(th.base - 0.05), top = this.sy(th.base + 1.1 + 2.4 * k);
      paintThermal(this.ctx, x, floor, top, RULES.thermalHalf * S, k, this.clock + th.id, a, rm);
    }
  }

  private drawNest(sim: WzlotSim): void {
    const f = sim.finale;
    if (!f) return;
    const S = this.S, T = sim.terrain;
    const x = this.sx(f.nx);
    if (x < -S || x > this.w + S) return;
    const foot = this.sy(T.height(f.nx) - 0.12), top = this.sy(f.ny - 0.03);
    paintSpire(this.ctx, x, foot, top, S * 0.12, this.cur.near, this.cur.strata);
  }

  /** The nest on its spire, over the ground (drawn after it). */
  private drawNestTop(sim: WzlotSim): void {
    const f = sim.finale;
    if (!f) return;
    const S = this.S, x = this.sx(f.nx);
    if (x < -S || x > this.w + S) return;
    paintNest(this.ctx, x, this.sy(f.ny - 0.03) + S * 0.005, S * 0.2);
  }

  private drawMist(sim: WzlotSim): void {
    if (this.mist < 0.02) return;
    const { ctx } = this;
    const step = 6;
    const heights = this.heights(sim, step);
    const fogY = this.sy(this.ground + 0.14);
    const a = this.mist;
    ctx.save();
    const g = ctx.createLinearGradient(0, fogY - 30, 0, fogY + this.S * 0.3);
    g.addColorStop(0, 'rgba(244,240,234,0)');
    g.addColorStop(0.25, `rgba(244,240,234,${(0.7 * a).toFixed(3)})`);
    g.addColorStop(1, `rgba(236,232,226,${(0.85 * a).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-step, Math.min(fogY - 30, heights[0]));
    for (let i = 0; i < heights.length; i++) ctx.lineTo(i * step - step, Math.min(fogY - 30 + Math.sin(i * 0.15 + this.clock * 0.6) * 4, heights[i]));
    for (let i = heights.length - 1; i >= 0; i--) ctx.lineTo(i * step - step, heights[i]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── the birds ───────────────────────────────────────────────────
  private drawWake(sim: WzlotSim): void {
    if (this.pAlpha < 0.05 || this.wake.n < 3) return;
    const sighted = sim.sighted && sim.parent === 'ahead';
    const k = clamp(sim.follow / RULES.stepMax);
    const a = this.pAlpha * (sighted ? 0.18 + 0.55 * k : 0.08) + 0.5 * this.wakeGold;
    if (a < 0.03) return;
    this.ribbon(this.wake, `rgba(255,214,120,${Math.min(0.9, a).toFixed(3)})`, (2 + 4 * k + 3 * this.wakeGold) * this.L.u);
  }

  private drawTrail(): void {
    if (this.glow < 0.05 || this.trail.n < 3) return;
    this.ribbon(this.trail, `rgba(255,220,140,${(0.7 * this.glow).toFixed(3)})`, 3 * this.L.u);
  }

  /** A fading ribbon through a ring of world points, newest brightest. */
  private ribbon(r: Ring, color: string, width: number): void {
    const { ctx } = this;
    const n = r.n;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      ctx.globalAlpha = 1 - i / n;
      ctx.lineWidth = width * (1 - i / n) + 0.5;
      ctx.beginPath();
      ctx.moveTo(this.sx(r.x(i - 1)), this.sy(r.y(i - 1)));
      ctx.lineTo(this.sx(r.x(i)), this.sy(r.y(i)));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEaglet(sim: WzlotSim): void {
    const e = sim.eaglet, S = this.S;
    const size = Math.max(30, S * 0.13);
    const p = this.pose;
    p.stage = sim.stage;
    p.fold = e.mode === 'ground' && !sim.held ? Math.max(this.fold, 0.55) : this.fold;
    p.spread = clamp(sim.wShown, 0.4, 1);
    p.flap = this.flap;
    p.glow = this.glow;
    const nested = this.nestT >= 0;
    if (nested) p.fold = 1;
    const x = this.sx(e.x), y = this.sy(e.y) - size * (nested ? 0.12 : 0.28);
    // a dive's speed lines
    if (sim.held && e.speed > 2 && !this.opts.reducedMotion) {
      const { ctx } = this;
      ctx.strokeStyle = 'rgba(255,250,240,.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const oy = (i - 1) * size * 0.25, len = size * (0.8 + 0.4 * hash(i + Math.floor(this.clock * 12)));
        ctx.moveTo(x - size * 0.7, y + oy);
        ctx.lineTo(x - size * 0.7 - len, y + oy + Math.sin(e.angle) * len);
      }
      ctx.stroke();
    }
    paintEaglet(this.ctx, x, y, size, e.angle, p);
  }

  private drawParent(): void {
    if (this.pAlpha < 0.02) return;
    const S = this.S;
    const size = Math.max(38, S * 0.18);
    paintEagle(this.ctx, this.sx(this.px), this.sy(this.py), size, 0.05 * Math.sin(this.clock), this.pFlap, this.pFace, this.pAlpha);
  }

  private drawBits(): void {
    const { ctx } = this;
    for (const b of this.bits) {
      ctx.globalAlpha = Math.max(0, b.life / b.max);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(this.sx(b.x), this.sy(b.y), b.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The blind block's cloud: a soft veil over the sky, the parent somewhere inside it. */
  private drawCloud(): void {
    const { ctx, w, L } = this;
    const a = this.cloudK;
    const g = ctx.createLinearGradient(0, 0, 0, L.gy);
    g.addColorStop(0, `rgba(236,238,242,${(0.75 * a).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(236,238,242,${(0.3 * a).toFixed(3)})`);
    g.addColorStop(1, 'rgba(236,238,242,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, L.gy);
    const drift = this.opts.reducedMotion ? 0 : Math.sin(this.clock * 0.2) * 20;
    for (let i = 0; i < 3; i++) paintCloud(ctx, w * (0.35 + i * 0.3) + drift * (i - 1), L.ceiling + 30 * L.u + i * 18, w * 0.45, 90 * L.u, a * 0.85, i + 7, '246,246,248');
  }

  private drawGhostHand(): void {
    const a = this.hud.hintAlpha;
    if (a < 0.02) return;
    const { ctx, L } = this;
    const k = (this.clock % 1.6) / 1.6;
    const press = k < 0.5;
    const x = L.w / 2, y = L.h * 0.6;
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = 'rgba(251,243,228,.9)';
    ctx.strokeStyle = 'rgba(43,34,25,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, (press ? 16 : 22) * L.u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (press) {
      ctx.globalAlpha = a * (1 - k * 2) * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, (22 + 30 * k) * L.u, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFinaleText(): void {
    const { ctx, w, L } = this;
    const k = clamp((this.nestT - 0.3) / 0.9);
    if (k <= 0) return;
    const u = L.u;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 34 * u;
    ctx.font = font(500, size, SERIF, true);
    const tw = ctx.measureText(TXT.finale).width;
    if (tw > w - 40) {
      size = Math.max(16, (size * (w - 40)) / tw);
      ctx.font = font(500, size, SERIF, true);
    }
    const y = L.tall ? L.h * 0.34 : L.h * 0.3;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,20,46,.45)';
    ctx.strokeText(TXT.finale, w / 2, y);
    ctx.fillStyle = '#fff8ea';
    ctx.fillText(TXT.finale, w / 2, y);
    ctx.font = font(650, 14 * u, SANS);
    ctx.fillStyle = 'rgba(255,248,234,.92)';
    ctx.fillText(TXT.finaleSub, w / 2, y + size * 0.95);
    ctx.restore();
  }
}

/** The last few world points of a trail; index 0 is the newest. */
class Ring {
  private readonly buf: Float32Array;
  private head = 0;
  n = 0;
  constructor(private readonly cap: number) { this.buf = new Float32Array(cap * 2); }
  push(x: number, y: number): void {
    this.buf[this.head * 2] = x;
    this.buf[this.head * 2 + 1] = y;
    this.head = (this.head + 1) % this.cap;
    this.n = Math.min(this.cap, this.n + 1);
  }
  private at(i: number): number { return ((this.head - 1 - i) % this.cap + this.cap) % this.cap; }
  x(i: number): number { return this.buf[this.at(i) * 2]; }
  y(i: number): number { return this.buf[this.at(i) * 2 + 1]; }
}
