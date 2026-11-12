/**
 * Jerzy i smok's play view: the endless field of the land around the knight (the camera follows
 * him), the band's history as footprints on the ground (gold where the signal was above the
 * threshold), the dragon's attacks telegraphed in red on the ground (a cone, lanes, circles, the
 * ring of fire with its gap, the mark of a dive), caltrops, scales, apples and chests, the shield's
 * aura — the band, drawn large: a disc of light around Jerzy with its threshold as a dotted ring and
 * a gold rim beyond it — the brood, the knight, Linda, the companions, Bartek's palisades, the land's
 * dragon (under the ground in a dive, glowing as he cools, gobbling, gold-lit while his weak spot is
 * open), the weapons' strokes, fire and steam, light thrown by the mirror and by Iskierka, and the
 * game's own bits (hud.ts).  Juice: hit-stop (from the sim), particles, flying numbers (gold for a
 * critical blow), shakes (none with reduced motion), flashes.
 */
import { fmtNum } from '../../i18n';
import { Floaters, Particles, Shake, approach, clamp } from '../kit/juice';
import { NO_INSETS } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { dragonName, duetName, evoName, flawName, roadName, treasureName, WEAPONS, type CompanionId, type WeaponId } from './content';
import { paintCaltrop, paintCoin, paintHammer, paintPal, paintWall, type PalPose } from './figures';
import { Hud } from './hud';
import { t } from './i18n';
import { JerzyIntro } from './intro';
import { layout, sheet, type Layout } from './layout';
import type { JerzyProgress } from './meta';
import {
  C, SANS, font, glow, paintApple, paintBrood, paintChest, paintDragon, paintFalcon, paintField, paintFireball, paintFlame,
  paintHorse, paintKnight, paintLinda, paintScale, paintSmoke, paintUnder, type DragonPose, type KnightPose, type LindaPose,
} from './paint';
import { RULES } from './rules';
import type { JerzySim, SimEvent } from './sim';

const TAU = Math.PI * 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

interface Banner { text: string; color: string; t: number; dur: number }
interface Streak { x0: number; y0: number; x1: number; y1: number; t: number; gold: boolean }
interface PalView { pose: PalPose; lx: number; ly: number }

export class JerzyView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ins: Insets = NO_INSETS;
  /** the primary input is a finger (the words and the hints follow it) */
  private readonly touch: boolean;
  L: Layout = layout(800, 600, { ...NO_INSETS, top: 64 }, true);
  readonly hud = new Hud();
  private readonly fx = new Particles(560);
  private readonly floaters = new Floaters();
  private readonly shake: Shake;
  private readonly introScene = new JerzyIntro();
  private clock = 0;
  private camX = 0;
  private camY = 0;
  private flash = 0;
  private flashGold = false;
  private hurtFlash = 0;
  private levelPop = 0;
  private banner: Banner | null = null;
  private restTint = 0;
  private stepPhase = 0;
  private lindaStep = 0;
  private swingT = 1;
  private readonly streaks: Streak[] = [];
  private readonly palViews = new Map<CompanionId, PalView>();
  /** the floating joystick (CSS px): its base where the finger came down, its knob under the finger; live once it steers */
  stick: { ox: number; oy: number; x: number; y: number; live: boolean } | null = null;
  /** a finger just came down on the Miecz światła's dial (1 → 0) */
  dialPress = 0;
  /** the dragon's bar (and the status making room for it) eases in and out (0..1) */
  private bossK = 0;
  private hurtGrad: { w: number; h: number; g: CanvasGradient } | null = null;
  private readonly kp: KnightPose = { flip: 1, step: 0, walking: 0, swing: 0, roll: 0, down: 0, hit: 0, charge: 0, ready: false, t: 0 };
  private readonly lp: LindaPose = { flip: 1, step: 0, walking: 0, arm: 0, sit: 0, talk: false, t: 0 };
  private readonly dp: DragonPose = { kind: 'zielony', flip: 1, r: 1, air: 0, jaw: 0, wings: 0, hit: 0, scales: 1, sleep: 0, daze: 0, heads: 3, t: 0, hot: 0 };

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; eeg: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
    this.touch = opts.touch;
  }

  resize(w: number, h: number, dpr: number, ins: Insets = this.ins): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.ins = { ...ins };
    this.L = layout(w, h, this.ins, this.touch);
  }

  /** What covers the canvas's edges (the runner's insets: the HUD band, the home indicator, a notch); read in resize. */
  setInsets(ins: Insets): void {
    const a = this.ins;
    if (Math.abs(a.top - ins.top) < 0.5 && Math.abs(a.right - ins.right) < 0.5 && Math.abs(a.bottom - ins.bottom) < 0.5 && Math.abs(a.left - ins.left) < 0.5) return;
    this.ins = { ...ins };
    this.L = layout(this.w, this.h, this.ins, this.touch);
  }

  /** World (u) → canvas (CSS px). */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.L.kx + (x - this.camX) * this.L.s, y: this.L.ky + (y - this.camY) * this.L.s };
  }

  intro(dt: number, p: number, progress: JerzyProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, progress);
  }

  start(sim: JerzySim): void {
    this.camX = sim.knight.x;
    this.camY = sim.knight.y;
  }

  private say(text: string, color = '#fff3d6', dur = 1.8): void {
    this.banner = { text, color, t: 0, dur };
  }

  private palView(id: CompanionId): PalView {
    let v = this.palViews.get(id);
    if (!v) this.palViews.set(id, (v = { pose: { flip: 1, step: 0, walking: 0, t: 0, act: 0, roll: 0, nap: 0 }, lx: 0, ly: 0 }));
    return v;
  }

  on(e: SimEvent, sim: JerzySim): void {
    const fx = this.fx;
    const P = (x: number, y: number) => this.toScreen(x, y);
    const u = this.L.u, s = this.L.s;
    switch (e.type) {
      case 'hit': {
        const p = P(e.x, e.y);
        if (e.crit) this.floaters.add(`${fmtNum(Math.round(e.dmg))}!`, p.x + (Math.random() - 0.5) * 16, p.y - s * 0.7, { color: C.goldLight, size: (e.boss ? 22 : 17) * u, dur: 0.8 });
        else if (e.boss || e.dmg >= 6) this.floaters.add(fmtNum(Math.round(e.dmg)), p.x + (Math.random() - 0.5) * 16, p.y - s * 0.6, { color: e.flaw ? C.goldLight : '#fff', size: (e.boss ? 18 : 14) * u, dur: 0.7 });
        fx.burst(p.x, p.y - s * 0.4, e.boss || e.crit ? 5 : 3, { color: e.crit ? C.goldLight : '#fff7e0', size: 2, speed: 120, life: 0.25, g: 0, shape: 'spark' });
        break;
      }
      case 'gone': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.3, e.elite ? 26 : 7, { color: '#ffe9a8', size: e.elite ? 3 : 2, speed: 140, life: 0.6, g: -40, shape: 'spark' });
        if (e.elite) this.shake.add(0.25);
        break;
      }
      case 'scale':
        this.levelPop = Math.min(1, this.levelPop + 0.08);
        break;
      case 'level':
        this.levelPop = 1;
        fx.burst(this.L.kx, this.L.ky - s * 0.6, 24, { color: C.goldLight, size: 3, speed: 220, life: 0.8, g: 80, shape: 'square' });
        break;
      case 'pick':
        if (e.card.kind !== 'apple' && e.card.kind !== 'scales' && e.card.kind !== 'treasure') this.floaters.add(`${sim.cardTitle(e.card)} ${e.card.kind === 'new' ? '+' : e.card.to}`, this.L.kx, this.L.ky - s * 1.6, { color: C.goldLight, size: 18 * u });
        break;
      case 'chest': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.4, 30, { color: C.goldLight, size: 3, speed: 240, life: 0.9, g: 120, shape: 'square' });
        e.ups.filter(c => c.kind !== 'evo' && c.kind !== 'treasure').forEach((c, i) => this.floaters.add(`${sim.cardTitle(c)}${c.kind === 'up' ? ` ${c.to}` : ''}`, this.L.kx, this.L.ky - s * (1.6 + 0.5 * i), { color: '#fff', size: 16 * u, dur: 1.6 }));
        if (!e.ups.some(c => c.kind === 'evo' || c.kind === 'treasure')) this.say(t('hud.chest'), C.goldLight, 1.4);
        break;
      }
      case 'treasure': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.5, 40, { color: C.goldLight, size: 3.5, speed: 260, life: 1.1, g: 60, shape: 'spark' });
        this.say(e.first ? t('hud.treasureNew', { name: treasureName(e.id) }) : t('hud.treasure', { name: treasureName(e.id) }), C.goldLight, 2.2);
        this.flash = Math.max(this.flash, 0.25);
        this.flashGold = true;
        break;
      }
      case 'duet':
        this.say(t('hud.duet', { name: duetName(e.id) }), C.goldLight, 2.2);
        fx.burst(this.L.kx, this.L.ky - s * 0.6, 30, { color: '#fff3c8', size: 3, speed: 200, life: 0.9, g: 40, shape: 'spark' });
        break;
      case 'evolve':
        this.say(t('hud.evolve', { name: evoName(e.id as WeaponId) }), C.goldLight, 2.4);
        this.flash = Math.max(this.flash, 0.5);
        this.flashGold = false;
        fx.burst(this.L.kx, this.L.ky - s * 0.6, 50, { color: C.goldLight, size: 3.5, speed: 300, life: 1.1, g: 60, shape: 'spark' });
        this.shake.add(0.4);
        break;
      case 'quench': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.3, e.big ? 8 : 3, { color: 'rgba(240,244,248,.9)', size: e.big ? 5 : 3, speed: 50, life: 0.7, g: -60, drag: 2, shape: 'ring' });
        if (e.big && Math.random() < 0.3) this.floaters.add(t('hud.quench'), p.x, p.y - s * 0.4, { color: '#eaf4ff', size: 14 * u, dur: 0.7 });
        break;
      }
      case 'spark':
        this.streaks.push({ x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, t: 0, gold: e.from === 'mirror' });
        if (this.streaks.length > 24) this.streaks.shift();
        break;
      case 'swordReady':
        this.floaters.add(t('hud.sword'), Math.min(this.L.sword.x - 30 * u, this.L.right - 70), this.L.sword.y - this.L.sword.r - 34 * u, { color: C.goldLight, size: 16 * u });
        break;
      case 'sword':
        this.flash = 1;
        this.flashGold = false;
        this.shake.add(0.6);
        this.say(t('hud.swordFx'), C.goldLight, 1.4);
        break;
      case 'hurt':
        this.hurtFlash = 1;
        this.shake.add(0.2);
        break;
      case 'down':
        this.say(t('hud.down'), '#ffd7c8', 1.4);
        break;
      case 'apple': {
        const p = P(e.x, e.y);
        if (e.revive) {
          this.say(t('hud.revive'), '#ffd7c8', 1.6);
          fx.burst(this.L.kx, this.L.ky - s * 0.5, 30, { color: '#ffd0c0', size: 3, speed: 200, life: 0.8, g: 60 });
        } else this.floaters.add(t('hud.apple'), p.x, p.y - s * 0.5, { color: '#ffd0c0', size: 16 * u });
        break;
      }
      case 'gust':
        this.say(t('hud.gust'), '#eaf4ff', 1.2);
        break;
      case 'wave':
        this.say(t('hud.wave', { n: e.n }), '#ffd7a8', 1.5);
        break;
      case 'elite':
        this.say(t('hud.elite'), C.goldLight, 1.5);
        break;
      case 'boss':
        this.say(e.tier > 0 ? `${t('hud.boss', { name: cap(dragonName(e.kind)) })} · ${roadName(e.tier)}` : t('hud.boss', { name: cap(dragonName(e.kind)) }), '#ffb8a0', 2.2);
        this.shake.add(0.35);
        break;
      case 'bossAct': {
        const b = sim.boss, p = P(b.x, b.y);
        if (e.pattern === 'dive' || e.pattern === 'sweep') {
          this.shake.add(0.45);
          fx.burst(p.x, p.y, 26, { color: e.pattern === 'dive' ? 'rgba(120,100,70,.9)' : '#e9d9b0', size: 4, speed: 220, life: 0.7, g: 180 });
        } else if (e.pattern === 'coins') {
          fx.burst(p.x, p.y - s * 0.8, 16, { color: C.goldLight, size: 2.5, speed: 160, life: 0.5, g: 60, shape: 'spark' });
        } else if (e.pattern !== 'breath' && e.pattern !== 'ring') this.shake.add(0.25);
        break;
      }
      case 'flaw': {
        const p = P(sim.boss.x, sim.boss.y);
        this.floaters.add(t('hud.flaw'), p.x, p.y - s * 2, { color: C.goldLight, size: 18 * u });
        break;
      }
      case 'fatal': {
        const p = P(sim.boss.x, sim.boss.y);
        const k = fmtNum(sim.boss.k, sim.boss.k % 1 ? 1 : 0);
        this.say(e.first ? t('hud.found', { flaw: flawName(e.flaw) }) : t('hud.fatal', { flaw: flawName(e.flaw), k }), C.goldLight, 2.4);
        fx.burst(p.x, p.y - s * 1.2, 44, { color: e.flaw === 'greed' ? C.goldLight : 'rgba(240,244,248,.95)', size: 4, speed: 220, life: 1.0, g: -40, shape: e.flaw === 'greed' ? 'spark' : 'ring' });
        this.flash = Math.max(this.flash, 0.35);
        this.flashGold = true;
        this.shake.add(0.5);
        break;
      }
      case 'ringOut': {
        const p = P(e.x, e.y);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          fx.burst(p.x + Math.cos(a) * e.r * s, p.y + Math.sin(a) * e.r * s, 2, { color: 'rgba(240,244,248,.9)', size: 5, speed: 40, life: 0.9, g: -50, drag: 2, shape: 'ring' });
        }
        this.say(t('hud.ringOut'), '#eaf4ff', 2);
        break;
      }
      case 'block': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.3, 8, { color: '#c9a67a', size: 3, speed: 90, life: 0.5, g: 120 });
        this.floaters.add(t('hud.block'), p.x, p.y - s * 0.6, { color: '#fff3d6', size: 13 * u, dur: 0.6 });
        break;
      }
      case 'pal': {
        const v = this.palView(e.id), p = P(e.x, e.y);
        v.pose.act = 1;
        if (e.what === 'fetch') this.floaters.add(t('hud.fetch'), p.x, p.y - s * 0.7, { color: '#fff3d6', size: 13 * u, dur: 0.7 });
        else if (e.what === 'eat') {
          this.floaters.add(t('hud.eat'), p.x, p.y - s * 0.9, { color: C.goldLight, size: 13 * u, dur: 0.6 });
          fx.burst(p.x, p.y - s * 0.4, 6, { color: C.fireHot, size: 2.5, speed: 60, life: 0.4, g: -40, shape: 'spark' });
        } else if (e.what === 'wall') fx.burst(p.x, p.y - s * 0.3, 14, { color: '#c9a67a', size: 2.5, speed: 150, life: 0.6, g: 200, shape: 'square' });
        break;
      }
      case 'roar':
        this.say(t('hud.roar'), '#ffb8a0', 1.2);
        this.shake.add(0.5);
        break;
      case 'nap':
        this.say(t('hud.nap', { name: cap(dragonName(sim.boss.spec.kind)) }), '#cfe0ff', 2);
        break;
      case 'driven':
        this.flash = 0.6;
        this.flashGold = true;
        this.shake.add(0.6);
        fx.burst(this.L.kx, this.L.ky - s, 60, { color: C.goldLight, size: 3.5, speed: 320, life: 1.3, g: 80, shape: 'square' });
        break;
      case 'smoke':
        this.say(t('hud.smoke', { n: Math.round(e.share * 100) }), '#eaeaf0', 2);
        break;
      case 'blockStart':
        if (e.block.kind === 'rest') this.say(t('hud.drowsy'), '#cfe0ff', 2.4);
        break;
      default:
        break;
    }
  }

  update(dt: number, sim: JerzySim): void {
    this.clock += dt;
    const k = sim.knight;
    this.camX = approach(this.camX, k.x, dt, 0.12);
    this.camY = approach(this.camY, k.y, dt, 0.12);
    const w = dt * sim.timeScale;
    this.fx.update(w > 0 ? dt : dt * 0.2);
    this.floaters.update(dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.dialPress = Math.max(0, this.dialPress - dt * 5);
    this.bossK = approach(this.bossK, sim.boss.state !== 'away' ? 1 : 0, dt, 0.12);
    this.levelPop = Math.max(0, this.levelPop - dt * 2.5);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) if ((this.streaks[i].t += dt) > 0.28) this.streaks.splice(i, 1);
    this.restTint = approach(this.restTint, sim.restBlock ? 1 : 0, dt, 0.8);
    const moving = Math.hypot(k.mx, k.my) > 0.05 && k.down <= 0;
    this.stepPhase += w * (moving ? 11 : 0);
    this.lindaStep += w * (sim.linda.walking ? 11 : 0);
    this.kp.walking = approach(this.kp.walking, moving ? 1 : 0, dt, 0.08);
    if (Math.abs(Math.cos(k.face)) > 0.15) this.kp.flip = Math.cos(k.face) >= 0 ? 1 : -1;
    const sw = sim.sweeps[sim.sweeps.length - 1];
    this.swingT = sw ? sw.t / 0.22 : Math.min(1, this.swingT + dt * 4);
    // the companions' poses: how far each moved this frame, their own bursts fading
    for (const pl of sim.pals) {
      const v = this.palView(pl.id), d = Math.hypot(pl.x - v.lx, pl.y - v.ly);
      v.lx = pl.x;
      v.ly = pl.y;
      v.pose.walking = approach(v.pose.walking, w > 0 && d > 0.004 ? 1 : 0, dt, 0.1);
      v.pose.step += d * 9;
      v.pose.roll += d * 4.5 * (pl.face >= 0 ? 1 : -1);
      v.pose.flip = pl.face >= 0 ? 1 : -1;
      v.pose.act = Math.max(0, v.pose.act - dt * 2.5);
      v.pose.nap = sim.restBlock && pl.id !== 'jez' && pl.id !== 'iskierka' ? 1 : 0;
      v.pose.t = this.clock;
    }
    // a gold shimmer from a big aura above the threshold
    if (w > 0 && sim.auraLook === 'live' && sim.auraR >= sim.auraMark && Math.random() < dt * 8) {
      const a = Math.random() * TAU, p = this.toScreen(k.x + Math.cos(a) * sim.auraR, k.y + Math.sin(a) * sim.auraR);
      this.fx.burst(p.x, p.y, 1, { color: C.goldLight, size: 2, speed: 20, life: 0.6, g: -40, shape: 'spark' });
    }
    // steam over the Ember Dragon cooling, crumbs over the Golden one gobbling
    const b = sim.boss;
    if (w > 0 && (b.hot > 0 || b.eating) && Math.random() < dt * 10) {
      const p = this.toScreen(b.x + (Math.random() - 0.5) * 1.6, b.y);
      this.fx.burst(p.x, p.y - this.L.s * 1.6, 1, b.hot > 0 ? { color: 'rgba(240,240,246,.75)', size: 7, speed: 30, life: 0.9, g: -60, drag: 1.5, shape: 'ring' } : { color: C.goldLight, size: 2.5, speed: 60, life: 0.5, g: 60, shape: 'spark' });
    }
  }

  draw(sim: JerzySim): void {
    const ctx = this.ctx, L = this.L, s = L.s, now = this.clock;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 10);
    ctx.save();
    ctx.translate(off.x, off.y);
    const land = sim.boss.spec.arena;
    paintField(ctx, land, this.camX, this.camY, L.kx, L.ky, s, this.w, this.h, now);
    const P = (x: number, y: number) => this.toScreen(x, y);
    this.drawPrints(ctx, sim);
    this.drawZones(ctx, sim, now);
    // the caltrops lie on the ground
    const evoCaltrops = sim.itemLevel('kolce') >= 6;
    for (const ct of sim.caltrops) {
      const p = P(ct.x, ct.y);
      if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
      paintCaltrop(ctx, p.x, p.y, Math.max(6, ct.r * s * 0.9), ct.t / ct.life, evoCaltrops);
    }
    // water from the squire
    for (const sp of sim.splashes) {
      const p = P(sp.x, sp.y), k = clamp(sp.t / 0.5);
      if (sp.pool > 0 && sp.t < sp.pool) {
        ctx.fillStyle = `rgba(127,182,224,${0.35 * (1 - sp.t / sp.pool) + 0.1})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, sp.r * s, sp.r * s * 0.6, 0, 0, TAU);
        ctx.fill();
      }
      if (k < 1) {
        ctx.strokeStyle = `rgba(200,230,255,${1 - k})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, sp.r * s * (0.4 + 0.6 * k), sp.r * s * 0.6 * (0.4 + 0.6 * k), 0, 0, TAU);
        ctx.stroke();
      }
    }
    // pickups
    for (const sc of sim.scales) {
      const p = P(sc.x, sc.y);
      if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
      paintScale(ctx, p.x, p.y - s * 0.12, s * (sc.v >= 10 ? 0.2 : sc.v >= 3 ? 0.16 : 0.13), sc.v, now);
    }
    for (const d of sim.drops) {
      const p = P(d.x, d.y), bob = Math.sin(now * 4 + d.id) * s * 0.06;
      if (d.kind === 'apple') paintApple(ctx, p.x, p.y - s * 0.2 + bob, s * 0.17);
      else if (d.kind === 'gust') {
        ctx.strokeStyle = '#eaf4ff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(p.x, p.y - s * 0.3 + bob, s * (0.1 + 0.08 * i), now * 6 + i, now * 6 + i + 4);
          ctx.stroke();
        }
      } else paintChest(ctx, p.x, p.y + bob * 0.3, s, d.kind === 'bigChest', now);
    }
    // the dragon under the ground (a dive): a ridge moving under the turf
    const b = sim.boss;
    if (b.state !== 'away' && b.under) {
      const p = P(b.x, b.y);
      paintUnder(ctx, p.x, p.y, s, now, b.spec.kind);
    }
    this.drawAura(ctx, sim, now);
    // the figures, back to front
    type Fig = { y: number; f: () => void };
    const figs: Fig[] = [];
    const land2 = b.spec.kind;
    const drowsy = this.restTint;
    for (const c of sim.brood) {
      const p = P(c.x, c.y);
      if (p.x < -60 || p.x > this.w + 60 || p.y < -60 || p.y > this.h + 80) continue;
      figs.push({
        y: c.y, f: () => {
          if (c.hatch && c.age < 0.6) {
            ctx.fillStyle = `rgba(90,70,50,${0.5 * (1 - c.age / 0.6)})`;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, s * c.r * 1.4, s * c.r * 0.5, 0, 0, TAU);
            ctx.fill();
          }
          ctx.save();
          if (c.age < 0.35) ctx.globalAlpha = c.age / 0.35;
          paintBrood(ctx, p.x, p.y, s * 1.2, {
            kind: c.kind, land: land2, r: c.r, flip: sim.knight.x >= c.x ? 1 : -1, t: now, hit: c.hit, elite: c.elite, drowsy,
            spit: c.spec.spit ? 1 - c.spitT / 0.8 : 0, seed: c.id,
          });
          ctx.restore();
        },
      });
    }
    for (const wl of sim.walls) {
      const ca = Math.cos(wl.a), sa = Math.sin(wl.a);
      const p0 = P(wl.x - ca * wl.len / 2, wl.y - sa * wl.len / 2), p1 = P(wl.x + ca * wl.len / 2, wl.y + sa * wl.len / 2);
      figs.push({ y: wl.y, f: () => paintWall(ctx, p0.x, p0.y, p1.x, p1.y, s, wl.t, wl.life) });
    }
    const k = sim.knight, kp = P(k.x, k.y);
    figs.push({
      y: k.y, f: () => {
        const kpo = this.kp;
        kpo.step = this.stepPhase;
        kpo.swing = Math.max(0, 1 - this.swingT);
        kpo.down = k.down > 0 ? 1 - k.down / RULES.downSec + 0.4 : 0;
        kpo.hit = k.hit > 0 ? 1 : 0;
        kpo.charge = sim.charge;
        kpo.ready = sim.swordReady;
        kpo.t = now;
        ctx.save();
        if (k.safe > 0 && k.down <= 0 && Math.floor(now * 14) % 2 === 0) ctx.globalAlpha = 0.6;
        paintKnight(ctx, kp.x, kp.y, s * 1.05, kpo);
        ctx.restore();
      },
    });
    const li = sim.linda, lpp = P(li.x, li.y);
    figs.push({
      y: li.y, f: () => {
        const l = this.lp;
        l.flip = li.face;
        l.step = this.lindaStep;
        l.walking = li.walking;
        l.arm = sim.talk.line ? 0.5 + 0.3 * Math.sin(now * 6) : 0.1;
        l.talk = !!sim.talk.line;
        l.sit = sim.tally ? 1 : 0;
        l.t = now;
        paintLinda(ctx, lpp.x, lpp.y, s * 0.95, l);
      },
    });
    for (const pl of sim.pals) {
      const p = P(pl.x, pl.y), v = this.palView(pl.id);
      figs.push({ y: pl.y, f: () => paintPal(ctx, pl.id, p.x, p.y, s * (pl.id === 'iskierka' ? 1.05 : 1.1), v.pose) });
    }
    const bossGround = b.state !== 'away' && b.air < 0.3 && !b.under;
    if (bossGround) figs.push({ y: b.y, f: () => this.drawBoss(ctx, sim, now) });
    figs.sort((a, c) => a.y - c.y);
    for (const f of figs) f.f();
    for (const sm of sim.smokes) {
      const p = P(sm.x, sm.y);
      paintSmoke(ctx, p.x, p.y, s, sm.r, sm.t / 0.9, sm.dir, sm.id);
    }
    // the horses gallop through
    for (const hh of sim.horses) {
      const p = P(hh.x, hh.y);
      paintHorse(ctx, p.x, p.y, s * 0.9, hh.dir, now);
    }
    this.drawStrokes(ctx, sim, now);
    // fire and hot coins
    for (const fb of sim.balls) {
      const p = P(fb.x, fb.y);
      if (fb.coin) paintCoin(ctx, p.x, p.y, s * 0.35, s * fb.r, now);
      else paintFireball(ctx, p.x, p.y, s * 0.35, s * fb.r, now);
    }
    for (const fl of sim.flames) {
      const p = P(fl.x, fl.y);
      paintFlame(ctx, p.x, p.y - s * 0.2, s * fl.r, now, fl.id);
    }
    for (const r of sim.rain) {
      if (r.t < 0) continue;
      const p = P(r.x, r.y), z = (1 - clamp(r.t / r.dur)) * s * 4;
      paintFireball(ctx, p.x, p.y, z, s * 0.24, now);
    }
    // light thrown by the mirror and by Iskierka
    ctx.save();
    ctx.lineCap = 'round';
    for (const st of this.streaks) {
      const a = P(st.x0, st.y0), c = P(st.x1, st.y1), k2 = 1 - st.t / 0.28;
      ctx.strokeStyle = st.gold ? `rgba(255,236,160,${k2})` : `rgba(255,170,80,${k2})`;
      ctx.lineWidth = (st.gold ? 3 : 2.4) * k2 + 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - s * 0.4);
      ctx.lineTo(c.x, c.y - s * 0.4);
      ctx.stroke();
    }
    ctx.restore();
    if (b.state !== 'away' && !bossGround && !b.under) this.drawBoss(ctx, sim, now);
    if (sim.leaving) {
      const lv = sim.leaving, kk = clamp(lv.t / 2.2);
      const p = P(lv.x + (lv.tx - lv.x) * kk, lv.y + (lv.ty - lv.y) * kk);
      Object.assign(this.dp, { kind: lv.kind, flip: 1, r: lv.kind === 'trzyglowy' || lv.kind === 'zloty' ? 1.15 : 1, air: Math.min(1, kk * 2), jaw: 0, wings: Math.sin(now * 12) * 0.5 + 0.5, hit: 0, scales: 0.2, sleep: 0, daze: 0.5, heads: 3, t: now, hot: 0 });
      ctx.save();
      ctx.globalAlpha = 1 - kk * 0.7;
      paintDragon(ctx, p.x, p.y, s, this.dp);
      ctx.restore();
    }
    this.fx.draw(ctx);
    this.floaters.draw(ctx, SANS);
    ctx.restore();
    // the Postój's dusk
    if (this.restTint > 0.01) {
      ctx.fillStyle = `rgba(40,60,110,${0.16 * this.restTint})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.flash > 0) {
      ctx.fillStyle = this.flashGold ? `rgba(255,226,140,${0.45 * this.flash})` : `rgba(255,248,220,${0.7 * this.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.hurtFlash > 0) {
      // the red edge of a hit (its gradient made once per canvas size)
      let hg = this.hurtGrad;
      if (!hg || hg.w !== this.w || hg.h !== this.h) {
        const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
        g.addColorStop(0, 'rgba(200,40,30,0)');
        g.addColorStop(1, 'rgba(200,40,30,0.35)');
        hg = this.hurtGrad = { w: this.w, h: this.h, g };
      }
      ctx.globalAlpha = this.hurtFlash;
      ctx.fillStyle = hg.g;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
    // the game's own bits: the status band and the dragon's bar under the HUD, the dial in the thumb zone
    const sheetUp = !!(sim.choice || sim.story);
    this.hud.drawStatus(ctx, L, sim, now, this.levelPop, this.bossK);
    this.hud.drawBoss(ctx, L, sim, now, this.bossK);
    if (!sheetUp) this.hud.drawDial(ctx, L, sim, now, this.dialPress);
    const line = sim.talk.line;
    if (line && !sheetUp) this.hud.drawBubble(ctx, L, line.text, lpp.x, lpp.y - s * 1.2, line.t);
    // a banner goes under the knight while the runner's block banner covers the upper half
    const low = sim.phase === 'play' && !!sim.block && sim.block.kind !== 'warmup' && sim.blockT < RULES.bannerSec + 0.4;
    if (this.banner && !sim.frozen) this.hud.drawBanner(ctx, L, this.banner.text, this.banner.t / this.banner.dur, this.banner.color, low);
    if (this.stick && !sim.frozen) this.drawStick(ctx);
    this.hud.drawChoice(ctx, L, sim, sim.choice && !sim.story ? sheet(L, sim.choice.cards.length, sim.run.rerolls) : null, now);
    this.hud.drawTally(ctx, L, sim, now);
    this.hud.drawStory(ctx, L, sim);
  }

  /** The band's history: two footprints a step, gold where it was above the threshold, blue for a calm rest. */
  private drawPrints(ctx: CanvasRenderingContext2D, sim: JerzySim): void {
    const s = this.L.s;
    for (const pr of sim.prints) {
      const age = (sim.t - pr.t) / RULES.stepKeep;
      if (age >= 1) continue;
      const p = this.toScreen(pr.x, pr.y);
      if (p.x < -10 || p.x > this.w + 10 || p.y < -10 || p.y > this.h + 10) continue;
      const a = (1 - age) * 0.85;
      const color = pr.veiled ? `rgba(120,120,130,${a * 0.6})`
        : pr.above ? (pr.phase === 'rest' ? `rgba(140,180,240,${a})` : `rgba(255,205,90,${a})`)
          : `rgba(70,55,40,${a * 0.45})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.07, s * 0.11, 0, 0, TAU);
      ctx.fill();
      if (pr.above && !pr.veiled && age < 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, p.x, p.y, s * 0.25, pr.phase === 'rest' ? 'rgba(140,180,240,' : 'rgba(255,205,90,', 0.25 * (1 - age / 0.4));
        ctx.restore();
      }
    }
  }

  /** The dragon's telegraphs: red shapes pulsing on the ground, bright when the fire comes; the ring of fire with its gap. */
  private drawZones(ctx: CanvasRenderingContext2D, sim: JerzySim, now: number): void {
    const s = this.L.s;
    for (const z of sim.zones) {
      const p = this.toScreen(z.x, z.y);
      const k = clamp(z.t / Math.max(0.01, z.dur));
      const a = z.live ? 0.55 : 0.18 + 0.14 * Math.sin(now * 14) + 0.25 * k;
      ctx.save();
      if (z.kind === 'ring') {
        const r = (z.r ?? RULES.ringFrom) * s, gap = z.gap ?? 0, gw = (z.gapW ?? 1) / 2;
        // the gap: a calm wedge of light, the way out
        ctx.fillStyle = 'rgba(255,250,232,.12)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, r + z.w * s, gap - gw, gap + gw);
        ctx.closePath();
        ctx.fill();
        ctx.lineCap = 'butt';
        ctx.lineWidth = z.w * s * (z.live ? 1 : 0.85);
        ctx.strokeStyle = z.live ? `rgba(255,128,40,${0.75})` : `rgba(214,52,36,${a})`;
        ctx.setLineDash(z.live ? [] : [10, 7]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, r), gap + gw, gap - gw + TAU);
        ctx.stroke();
        if (z.live) {
          // flames along the ring
          const n = Math.max(10, Math.round((r * TAU) / (s * 0.55)));
          for (let i = 0; i < n; i++) {
            const ang = gap + gw + ((TAU - 2 * gw) * (i + 0.5)) / n;
            paintFlame(ctx, p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, s * 0.16, now, i * 7 + z.id);
          }
        }
        ctx.restore();
        continue;
      }
      ctx.fillStyle = z.live ? `rgba(255,120,40,${a})` : `rgba(214,52,36,${a})`;
      ctx.strokeStyle = 'rgba(255,230,200,.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash(z.live ? [] : [8, 6]);
      ctx.beginPath();
      if (z.kind === 'cone') {
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, z.len * s, z.a - z.w, z.a + z.w);
        ctx.closePath();
      } else if (z.kind === 'lane') {
        ctx.translate(p.x, p.y);
        ctx.rotate(z.a);
        ctx.rect(0, -z.w * s / 2, z.len * s, z.w * s);
      } else {
        ctx.arc(p.x, p.y, z.w * s, 0, TAU);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * The band, drawn large: a disc of light around Jerzy (its radius is the aura), the threshold as a
   * dotted ring with its name, the rim gold beyond it; grey without signal, smoke in Dym, faint in
   * the lead-in.
   */
  private drawAura(ctx: CanvasRenderingContext2D, sim: JerzySim, now: number): void {
    const s = this.L.s, k = sim.knight, p = this.toScreen(k.x, k.y);
    const cy = p.y - s * 0.35;
    const R = sim.auraR * s, mark = sim.auraMark * s;
    const look = sim.auraLook, above = sim.auraR >= sim.auraMark - 0.02 && look === 'live';
    ctx.save();
    if (look === 'smoke') {
      for (let i = 0; i < 8; i++) {
        const a = now * 0.6 + i * 0.8;
        ctx.fillStyle = 'rgba(150,150,160,.18)';
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * mark * 0.6, cy + Math.sin(a) * mark * 0.4, mark * 0.45, mark * 0.3, 0, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, cy, R * 1.15, look === 'grey' ? 'rgba(200,200,210,' : above ? 'rgba(255,224,150,' : 'rgba(255,240,200,', look === 'live' ? 0.32 : 0.18);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the threshold ring (in a Tarcza)
    if (sim.pushBlock) {
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255,250,232,.75)';
      ctx.beginPath();
      ctx.ellipse(p.x, cy, mark, mark * 0.8, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(700, 13 * this.L.u, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(30,20,20,.45)';
      ctx.strokeText(t('hud.mark'), p.x + mark * 0.72 + 4, cy - mark * 0.62);
      ctx.fillStyle = 'rgba(255,250,232,.95)';
      ctx.fillText(t('hud.mark'), p.x + mark * 0.72 + 4, cy - mark * 0.62);
    }
    // the rim
    if (look !== 'smoke') {
      ctx.lineWidth = above ? 3.2 : 2;
      ctx.strokeStyle = look === 'grey' ? 'rgba(200,200,210,.6)' : above ? '#ffd36b' : 'rgba(255,250,232,.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, cy, R, R * 0.8, 0, 0, TAU);
      ctx.stroke();
    }
    // the beat, the horn, a roar, a burst, steam
    for (const r of sim.rings) {
      const kk = clamp(r.t / 0.6);
      const color = r.kind === 'pulse' ? `rgba(255,236,170,${0.7 * (1 - kk)})` : r.kind === 'horn' ? `rgba(255,230,180,${0.8 * (1 - kk)})`
        : r.kind === 'roar' ? `rgba(255,140,90,${0.7 * (1 - kk)})` : r.kind === 'apple' ? `rgba(255,190,170,${0.8 * (1 - kk)})`
          : r.kind === 'burst' ? `rgba(230,200,150,${0.8 * (1 - kk)})` : r.kind === 'steam' ? `rgba(240,244,248,${0.85 * (1 - kk)})` : `rgba(255,250,220,${0.9 * (1 - kk)})`;
      const rr = (r.kind === 'pulse' ? r.r * (0.9 + 0.25 * kk) : r.r * (0.2 + 0.8 * kk)) * s;
      ctx.strokeStyle = color;
      ctx.lineWidth = r.kind === 'sword' ? 10 : r.kind === 'steam' ? 7 : 3;
      ctx.beginPath();
      const bx = r.kind === 'roar' || r.kind === 'burst' || r.kind === 'steam' ? this.toScreen(sim.boss.x, sim.boss.y) : { x: p.x, y: cy };
      ctx.ellipse(bx.x, bx.y, rr, rr * 0.8, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The weapons' strokes: the sword's arc, the lances and bolts, the hammers, the falcons. */
  private drawStrokes(ctx: CanvasRenderingContext2D, sim: JerzySim, now: number): void {
    const s = this.L.s, k = sim.knight, p = this.toScreen(k.x, k.y);
    for (const sw of sim.sweeps) {
      const kk = clamp(sw.t / 0.22);
      ctx.save();
      ctx.globalAlpha = 1 - kk;
      ctx.strokeStyle = sw.evo ? C.goldLight : '#fffbe8';
      ctx.lineWidth = s * 0.16 * (1 - kk * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const a0 = sw.a - sw.arc, a1 = sw.a - sw.arc + 2 * sw.arc * Math.min(1, kk * 1.6);
      ctx.ellipse(p.x, p.y - s * 0.35, sw.r * s * 0.95, sw.r * s * 0.8, 0, a0, a1);
      ctx.stroke();
      ctx.restore();
    }
    for (const l of sim.lances) {
      const q = this.toScreen(l.x, l.y), a = Math.atan2(l.vy, l.vx);
      ctx.save();
      ctx.translate(q.x, q.y - s * 0.4);
      ctx.rotate(a);
      ctx.strokeStyle = l.bolt ? '#4a3a2c' : '#7a5434';
      ctx.lineWidth = Math.max(2, s * (l.bolt ? 0.045 : 0.06));
      ctx.beginPath();
      ctx.moveTo(-s * (l.bolt ? 0.35 : 0.7), 0);
      ctx.lineTo(s * 0.2, 0);
      ctx.stroke();
      if (l.bolt) {
        ctx.strokeStyle = 'rgba(255,250,232,.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-s * 0.9, 0);
        ctx.lineTo(-s * 0.4, 0);
        ctx.stroke();
      }
      ctx.fillStyle = C.steel;
      ctx.beginPath();
      ctx.moveTo(s * (l.bolt ? 0.32 : 0.45), 0);
      ctx.lineTo(s * 0.15, -s * 0.08);
      ctx.lineTo(s * 0.15, s * 0.08);
      ctx.fill();
      ctx.restore();
    }
    for (const hm of sim.hammers) {
      const q = this.toScreen(hm.x, hm.y);
      paintHammer(ctx, q.x, q.y - s * 0.5, s, hm.spin, hm.evo);
    }
    const Ls = sim.itemLevel('sokol');
    if (Ls) {
      const spec = WEAPONS.sokol, i = Math.min(5, Ls - 1), n = sim.birdCount, r = spec.area[i];
      const birdA = sim.birdA;
      for (let j = 0; j < n; j++) {
        const a = birdA + (j / n) * TAU;
        const q = this.toScreen(k.x + Math.cos(a) * r, k.y + Math.sin(a) * r);
        ctx.save();
        ctx.translate(q.x, q.y - s * 0.9);
        ctx.rotate(a + Math.PI);
        paintFalcon(ctx, 0, 0, s * 0.9, now * 14 + j, Ls >= 6);
        ctx.restore();
      }
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D, sim: JerzySim, now: number): void {
    const b = sim.boss, s = this.L.s, p = this.toScreen(b.x, b.y);
    const d = this.dp;
    const L = this.L;
    // the marks over his head never go up under the status band and the dragon's bar (or the runner's HUD)
    const ceil = L.statBottom + 10;
    const labelY = Math.max(p.y - s * 2.85, ceil + s * 0.3);
    const starsY = labelY + s * 0.55;
    d.kind = b.spec.kind;
    d.flip = b.face >= 0 ? 1 : -1;
    d.r = b.spec.kind === 'trzyglowy' || b.spec.kind === 'zloty' ? 1.15 : 1;
    d.air = b.air;
    d.jaw = b.eating ? 0.5 + 0.5 * Math.abs(Math.sin(now * 14)) : b.state === 'tele' ? 0.5 + 0.5 * Math.sin(now * 20) * 0.3 : b.state === 'act' && (b.pattern === 'breath' || b.pattern === 'coins') ? 1 : 0.15;
    d.wings = b.air > 0 ? 0.5 + 0.5 * Math.sin(now * 12) : b.state === 'roar' ? 1 : 0.2;
    d.hit = b.hit > 0 ? 1 : 0;
    d.scales = 1 - b.damage / b.all;
    d.sleep = 0;
    d.daze = b.state === 'flaw' ? 1 : 0;
    d.heads = b.spec.kind === 'trzyglowy' && b.fatal && b.state === 'flaw' ? 1 : 3;
    d.t = now;
    d.hot = b.hot > 0 ? clamp(b.hot / RULES.heatSec) : 0;
    const open = b.state === 'flaw';
    if (open) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y - s, s * (b.fatal ? 2.8 : 2), 'rgba(255,214,107,', (b.fatal ? 0.45 : 0.3) + 0.1 * Math.sin(now * 8));
      ctx.restore();
    }
    paintDragon(ctx, p.x, p.y, s, d);
    if (open) {
      // dizzy stars (more, and gold, while his weak spot is open)
      const n = b.fatal ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = now * 4 + (i * TAU) / n;
        ctx.fillStyle = b.fatal ? '#fff3c8' : C.goldLight;
        ctx.font = font(800, s * (b.fatal ? 0.42 : 0.35), SANS);
        ctx.textAlign = 'center';
        ctx.fillText('★', p.x + Math.cos(a) * s * 0.8, starsY + Math.sin(a) * s * 0.22);
      }
      if (b.fatal) {
        ctx.font = font(900, s * 0.5, SANS);
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(60,30,10,.6)';
        const label = `×${fmtNum(b.k, b.k % 1 ? 1 : 0)}`;
        ctx.strokeText(label, p.x, labelY);
        ctx.fillStyle = C.goldLight;
        ctx.fillText(label, p.x, labelY);
      }
    }
    if (b.state === 'tele') {
      ctx.fillStyle = '#ffe1c8';
      ctx.font = font(900, s * 0.6, SANS);
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, starsY + s * 0.1 - Math.abs(Math.sin(now * 10)) * s * 0.2);
    }
  }

  /**
   * The floating joystick: its base where the finger came down (shown at once, so the touch answers),
   * the knob under the finger, a wedge toward where the knight walks; brighter once it steers.
   */
  private drawStick(ctx: CanvasRenderingContext2D): void {
    const st = this.stick!;
    const R = RULES.stickPx, on = st.live ? 1 : 0.6;
    const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    ctx.save();
    ctx.fillStyle = `rgba(20,16,28,${0.22 * on})`;
    ctx.beginPath();
    ctx.arc(st.ox, st.oy, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,250,232,${0.55 * on})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (st.live && d > 4) {
      const a = Math.atan2(dy, dx);
      ctx.fillStyle = 'rgba(255,231,163,.5)';
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, R - 2, a - 0.38, a + 0.38);
      ctx.arc(st.ox, st.oy, R * 0.62, a + 0.38, a - 0.38, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,250,232,${0.45 + 0.35 * on})`;
    ctx.beginPath();
    ctx.arc(st.ox + dx * k, st.oy + dy * k, R * 0.42, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,34,51,.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
