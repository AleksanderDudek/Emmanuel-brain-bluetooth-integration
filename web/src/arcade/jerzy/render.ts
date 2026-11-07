/**
 * Jerzy i smok's play view, all on the canvas: the arena from above (its ground, the cave, the fence
 * whose pennants hang the band's last 40 s — longer for a higher level, gold above the threshold,
 * blue in a Postój, an empty hook where the signal failed, smoke over a blind block, the band's
 * delay bracketed at "now"), the attacks' red telegraphs, the fire, the shield (its radius is the
 * level; a dotted ring marks the threshold, the rim turns gold beyond it), the Miecz światła's
 * gauge and the blade's glow, the knight, the dragon, Princess Linda and her speech bubble, the
 * skills that act by themselves (lances, the white horse, the squire's water), hit-stop, sparks,
 * steam and scales flying, and the HUD (hud.ts) on top.  It only reads the sim (sim.ts); the
 * calibration scene is intro.ts.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, traceBars } from '../kit/trace';
import { skillById } from './content';
import { Hud } from './hud';
import { t } from './i18n';
import { JerzyIntro } from './intro';
import { layout, type Layout } from './layout';
import type { JerzyProgress } from './meta';
import {
  C, SANS, font, glow, paintApple, paintArena, paintCave, paintDragon, paintFence, paintFireball, paintFlame, paintHorse,
  paintKnight, paintLinda, paintSurround, paintUnder, type DragonPose, type KnightPose, type LindaPose,
} from './paint';
import { RULES, shieldFor, type JerzySim, type SimEvent, type Zone } from './sim';

const TAU = Math.PI * 2;

const TXT = {
  quench: t('fx.quench'), sword: t('fx.sword'), swordReady: t('fx.swordReady'), flaw: t('fx.flaw'), flawTip: t('fx.flawTip'), phase: t('fx.phase'),
  down: t('fx.down'), apple: t('fx.apple'), up: t('fx.up'), reflect: t('fx.reflect'), horse: t('fx.horse'), squire: t('fx.squire'),
  nap: t('fx.nap'), wake: t('fx.wake'), retreat: t('fx.retreat'), retreatSub: t('fx.retreatSub'), smoke: t('fx.smoke'), tip: t('fx.tip'),
  spin: t('fx.spin'), tipName: t('hud.tip'), mark: t('mark'), shield: t('hud.shield'), sword_: t('hud.sword'), ready: t('hud.swordReady'), tipOn: t('hud.tipOn'),
};

const SCALE_COLOR: Record<string, string> = { zielony: '#e2b23c', bagienny: '#a7b45a', skrzydlaty: '#f0c8a0', trzyglowy: '#e2b23c' };

interface Ring { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
interface Plate { x: number; y: number; vx: number; vy: number; z: number; vz: number; rot: number; vr: number; t: number; color: string }
interface Toss { t: number; dur: number }

export class JerzyView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new JerzyIntro();
  private clock = 0;
  private started = false;
  private readonly parts = new Particles(700);
  private readonly steam = new Particles(260);
  private readonly rings: Ring[] = [];
  private readonly plates: Plate[] = [];
  private readonly shake: Shake;
  private readonly rnd = Math.random;
  private fade = 0;
  private flash = 0;
  private flashColor = 'rgba(255,240,200,';
  // the knight's animation
  private swing = 0;
  private step = 0;
  private walking = 0;
  private lastKx = 0;
  private lastKy = 0;
  // the dragon's
  private jaw = 0;
  private wings = 0;
  private roar = 0;
  // Linda's
  private lx: number = 0.8;
  private ly: number = RULES.arenaH - 0.3;
  private lStep = 0;
  private lWalk = 0;
  private lArm = 0;
  private apple: Toss | null = null;
  private dusk = 0;
  private smokeQuench = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
    this.hud.resize(this.L);
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h);
    this.hud.resize(this.L);
  }

  start(sim: JerzySim): void {
    this.started = true;
    this.fade = 1;
    this.lastKx = sim.knight.x;
    this.lastKy = sim.knight.y;
  }

  intro(dt: number, p: number, progress: JerzyProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── the arena's points ──────────────────────────────────────────
  private get S(): number { return this.L.S; }
  px(x: number): number { return this.L.ox + x * this.S; }
  py(y: number): number { return this.L.oy + y * this.S; }
  /** a point of the canvas (CSS px) in the arena (u) */
  toWorld(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.L.ox) / this.S, y: (y - this.L.oy) / this.S };
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: JerzySim): void {
    const u = this.L.u, rm = this.opts.reducedMotion, S = this.S;
    switch (e.type) {
      case 'strike': {
        this.swing = 1;
        const x = this.px(e.x), y = this.py(e.y) - S * 0.6;
        if (e.sword) {
          this.flashOn(0.9, 'rgba(255,240,190,');
          this.rings.push({ x, y, t: 0, dur: 0.6, r0: S * 0.3, r1: S * 3.2, color: 'rgba(255,230,150,', width: 8 });
          this.parts.burst(x, y, rm ? 12 : 60, { color: C.goldLight, size: 3 * u, speed: 420 * u, g: 200, drag: 2, life: 0.9, shape: 'spark', rnd: this.rnd });
          this.hud.float(`+${e.n} ${TXT.sword}`, x, y - 30 * u, C.goldLight, 22, 1.6, 40);
          this.shake.add(0.6);
        } else {
          this.parts.burst(x, y, rm ? 4 : 12, { color: '#fff4d6', size: 2.2 * u, speed: 240 * u, g: 300, drag: 3, life: 0.3, shape: 'spark', rnd: this.rnd });
          this.rings.push({ x, y, t: 0, dur: 0.2, r0: 4 * u, r1: 26 * u, color: 'rgba(255,244,214,', width: 3 });
          this.shake.add(e.flaw ? 0.18 : 0.08);
          if (e.flaw) this.hud.float(TXT.flawTip, x, y - 34 * u, C.goldLight, 18, 0.9, 30);
          else if (e.spin) this.hud.float(TXT.spin, x, y - 34 * u, '#cfe0ff', 14, 0.8, 24);
        }
        break;
      }
      case 'scales': {
        const d = sim.dragon, x = this.px(e.x), y = this.py(e.y) - S * 0.6;
        const n = Math.min(e.via === 'sword' ? 14 : 6, e.n + 1);
        for (let i = 0; i < (rm ? Math.min(2, n) : n); i++) this.plate(x, y, SCALE_COLOR[d.spec.kind] ?? C.gold);
        if (e.via !== 'sword') this.hud.float(`+${e.n}`, x + (this.rnd() - 0.5) * 20 * u, y - 18 * u, C.goldLight, 14, 0.8, 28);
        this.hud.popScore();
        break;
      }
      case 'quench': {
        const x = this.px(e.x), y = this.py(e.y);
        this.steam.burst(x, y - 4 * u, rm ? 2 : e.big ? 14 : 5, { color: 'rgba(240,244,248,.8)', size: (e.big ? 5 : 3.5) * u, speed: 50 * u, g: -60, drag: 2.5, life: 0.9, rnd: this.rnd });
        if (e.big || (this.smokeQuench++ % 5 === 0)) this.hud.float(TXT.quench, x, y - 20 * u, '#eaf4ff', e.big ? 16 : 12, 0.7, 22);
        if (e.squire) this.parts.burst(x, y, rm ? 3 : 12, { color: '#9fd0f0', size: 2.4 * u, speed: 140 * u, g: 400, drag: 1.5, life: 0.5, rnd: this.rnd });
        break;
      }
      case 'reflect': {
        const d = sim.dragon;
        this.parts.burst(this.px(e.x), this.py(e.y), rm ? 2 : 8, { color: C.fireHot, size: 2.2 * u, speed: 120 * u, g: 0, drag: 2, life: 0.4, shape: 'spark', rnd: this.rnd });
        this.hud.float(TXT.reflect, this.px(d.x), this.py(d.y) - S * 1.6, C.fireHot, 13, 0.8, 22);
        break;
      }
      case 'burn': {
        const x = this.px(e.x), y = this.py(e.y) - S * 0.6;
        this.parts.burst(x, y, rm ? 3 : 14, { color: C.fire, size: 2.6 * u, speed: 160 * u, g: -40, drag: 2.5, life: 0.6, rnd: this.rnd });
        this.flashOn(0.25, 'rgba(255,90,50,');
        this.shake.add(e.what === 'blob' ? 0.08 : 0.3);
        break;
      }
      case 'land': {
        const x = this.px(e.x), y = this.py(e.y);
        this.rings.push({ x, y, t: 0, dur: 0.4, r0: 4 * u, r1: RULES.splashR * S, color: 'rgba(255,140,60,', width: 4 });
        this.parts.burst(x, y, rm ? 3 : 14, { color: C.fire, size: 2.6 * u, speed: 150 * u, g: 120, drag: 2, life: 0.5, rnd: this.rnd });
        this.shake.add(0.06);
        break;
      }
      case 'roll':
        this.parts.burst(this.px(e.x), this.py(e.y), rm ? 2 : 8, { color: 'rgba(200,180,140,.7)', size: 3 * u, speed: 60 * u, g: 0, drag: 3, life: 0.4, rnd: this.rnd });
        break;
      case 'down':
        this.hud.float(TXT.down, this.px(sim.knight.x), this.py(sim.knight.y) - S * 1.5, '#ffd0c0', 15, 1.4, 20);
        this.apple = { t: 0, dur: 0.8 };
        this.lArm = 1;
        this.shake.add(0.3);
        break;
      case 'up':
        this.hud.float(TXT.up, this.px(sim.knight.x), this.py(sim.knight.y) - S * 1.5, C.goldLight, 15, 1, 24);
        break;
      case 'attack':
        if (e.pattern === 'sweep' || e.pattern === 'bite') this.shake.add(0.12);
        break;
      case 'surface':
        this.rings.push({ x: this.px(e.x), y: this.py(e.y), t: 0, dur: 0.5, r0: S * 0.4, r1: RULES.diveR * S * 1.2, color: 'rgba(200,235,230,', width: 5 });
        this.parts.burst(this.px(e.x), this.py(e.y), rm ? 4 : 24, { color: '#a8d0c8', size: 3 * u, speed: 220 * u, g: 500, drag: 1.5, life: 0.7, rnd: this.rnd });
        this.shake.add(0.3);
        break;
      case 'flaw':
        this.hud.float(e.tip ? TXT.flawTip : TXT.flaw, this.px(e.x), this.py(e.y) - S * 2.2, e.tip ? C.goldLight : '#f4e8c8', e.tip ? 19 : 14, 1.2, 20);
        break;
      case 'phase':
        this.roar = 1;
        this.rings.push({ x: this.px(e.x), y: this.py(e.y), t: 0, dur: 0.7, r0: S * 0.5, r1: S * 4, color: 'rgba(255,120,80,', width: 6 });
        this.hud.toast(TXT.phase, '', C.vermilionDeep);
        this.shake.add(0.5);
        break;
      case 'arrive':
        this.shake.add(0.2);
        break;
      case 'driven': {
        const d = sim.dragon, x = this.px(d.x), y = this.py(d.y) - S;
        this.flashOn(0.7, 'rgba(255,236,170,');
        const colors = [C.gold, C.vermilion, C.ultramarine, '#ffffff', C.sage];
        for (let i = 0; i < (rm ? 2 : 6); i++) {
          this.parts.burst(x, y, rm ? 6 : 20, { color: colors[i % colors.length], size: 3 * u, speed: 360 * u, g: 260, drag: 1.4, life: 1.6, shape: 'square', rnd: this.rnd });
        }
        this.shake.add(0.5);
        break;
      }
      case 'retreat':
        this.hud.toast(TXT.retreat, TXT.retreatSub, C.calmDeep);
        break;
      case 'nap':
        this.hud.float(TXT.nap, this.px(sim.dragon.x), this.py(sim.dragon.y) - S * 2, '#dfe8ff', 13, 1.4, 20);
        break;
      case 'wake':
        this.hud.float(TXT.wake, this.px(RULES.cave[0]) + S, this.py(0.4), '#ffd0b0', 15, 1.2, 20);
        break;
      case 'swordReady': {
        const k = sim.knight;
        this.rings.push({ x: this.px(k.x), y: this.py(k.y) - S * 0.6, t: 0, dur: 0.6, r0: S * 0.3, r1: S * 1.6, color: 'rgba(255,230,150,', width: 5 });
        this.hud.float(TXT.swordReady, this.px(k.x), this.py(k.y) - S * 1.7, C.goldLight, 16, 1.3, 24);
        break;
      }
      case 'level':
        this.hud.popLevel();
        break;
      case 'skill':
        this.hud.toast(t('card.skill', { name: skillById(e.id).name }), skillById(e.id).text, C.goldDeep);
        break;
      case 'horse':
        this.hud.float(TXT.horse, this.px(RULES.arenaW / 2), this.py(e.y) - S * 1.6, '#ffffff', 16, 1, 20);
        break;
      case 'squire':
        this.hud.float(TXT.squire, this.px(e.x), this.py(e.y) - 24 * u, '#bfe6ff', 13, 0.7, 20);
        break;
      case 'tip':
        this.hud.toast(TXT.tip, TXT.tipOn, C.goldDeep);
        break;
      case 'restPass':
        this.hud.float(t('card.restPass'), this.px(sim.knight.x), this.py(sim.knight.y) - S * 1.8, '#cfe0ff', 15, 1.3, 22);
        break;
      case 'smoke':
        this.hud.float(TXT.smoke, this.px(sim.knight.x), this.py(sim.knight.y) - S * 2, '#e8e2f0', 17, 1.6, 26);
        break;
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(sim, e.block.kind, e.block.blind, e.verdict, e.share, e.need, e.t0, e.t1, e.block.kind === 'rest' && sim.tipActive);
        break;
      default:
        break;
    }
  }

  private flashOn(a: number, color: string): void {
    if (this.opts.reducedMotion) a *= 0.4;
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }

  private plate(x: number, y: number, color: string): void {
    const u = this.L.u;
    this.plates.push({ x, y, vx: (this.rnd() - 0.5) * 220 * u, vy: (this.rnd() - 0.5) * 60 * u, z: 0, vz: (180 + this.rnd() * 160) * u, rot: this.rnd() * TAU, vr: (this.rnd() - 0.5) * 18, t: 0, color });
    if (this.plates.length > 60) this.plates.shift();
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: JerzySim): void {
    this.clock += dt;
    const w = dt * sim.timeScale;
    this.parts.update(w > 0 ? dt : dt * 0.2);
    this.steam.update(dt);
    let n = 0;
    for (const r of this.rings) if ((r.t += dt) < r.dur) this.rings[n++] = r;
    this.rings.length = n;
    n = 0;
    for (const p of this.plates) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= 900 * this.L.u * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z <= 0) { p.vx *= 0.6; p.vy *= 0.6; p.vr *= 0.6; }
      p.rot += p.vr * dt;
      if (p.t < 1.4) this.plates[n++] = p;
    }
    this.plates.length = n;
    this.swing = Math.max(0, this.swing - dt * 4);
    this.roar = Math.max(0, this.roar - dt * 1.2);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.fade = Math.max(0, this.fade - dt * 1.5);
    // the knight walks
    const k = sim.knight;
    const moved = Math.hypot(k.x - this.lastKx, k.y - this.lastKy);
    this.lastKx = k.x;
    this.lastKy = k.y;
    this.walking = approach(this.walking, moved > 0.002 && k.rollT <= 0 ? 1 : 0, dt, 0.08);
    this.step += moved * 9;
    // the dragon's jaw and wings
    const d = sim.dragon;
    const breath = d.pattern === 'breath' && (d.state === 'tele' || d.state === 'act');
    const bite = d.pattern === 'bite' && d.state === 'act';
    this.jaw = approach(this.jaw, breath || bite || d.state === 'roar' ? 1 : d.pattern === 'balls' && d.state === 'tele' ? 0.7 : 0, dt, 0.08);
    this.wings = approach(this.wings, d.air > 0.1 || d.state === 'roar' || (d.pattern === 'swoop' && d.state === 'tele') ? 1 : 0.15, dt, 0.15);
    // Linda: home in the corner; by the knight in a Postój; she throws the apple when he falls
    const rest = sim.restBlock;
    const side = k.x > RULES.arenaW / 2 ? -1 : 1;
    const tx = rest ? clamp(k.x + side * 0.85, 0.5, RULES.arenaW - 0.5) : 0.8, ty = rest ? clamp(k.y + 0.15, 0.6, RULES.arenaH - 0.25) : RULES.arenaH - 0.3;
    const ld = Math.hypot(tx - this.lx, ty - this.ly), ls = 2.6 * dt;
    if (ld > ls) {
      this.lx += ((tx - this.lx) / ld) * ls;
      this.ly += ((ty - this.ly) / ld) * ls;
      this.lStep += ls * 9;
    }
    this.lWalk = approach(this.lWalk, ld > ls ? 1 : 0, dt, 0.1);
    if (this.apple && (this.apple.t += dt) >= this.apple.dur) this.apple = null;
    const wave = sim.drivenNow.length > 0 && d.state === 'leave';
    this.lArm = approach(this.lArm, this.apple || wave ? 1 : sim.talk.line ? 0.35 : 0, dt, 0.12);
    this.dusk = approach(this.dusk, rest ? 1 : sim.blind ? 0.5 : 0, dt, 0.8);
    this.hud.update(dt, sim);
  }

  draw(sim: JerzySim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L, S = this.S;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const kind = sim.dragon.spec.arena;
    paintSurround(ctx, this.w, this.h, kind, { x: L.ox, y: L.oy - L.fenceH, w: RULES.arenaW * S, h: RULES.arenaH * S + L.fenceH }, S);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    paintArena(ctx, kind, L.ox, L.oy, RULES.arenaW, RULES.arenaH, S, this.clock);
    this.drawFence(sim);
    paintCave(ctx, this.px(RULES.cave[0]), this.py(RULES.cave[1] + 0.25), S, kind);
    this.drawTarget(sim);
    // the telegraphs stay on the arena's ground
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(L.ox, L.oy, RULES.arenaW * S, RULES.arenaH * S, S * 0.5);
    ctx.clip();
    this.drawZones(sim);
    this.drawBalls(sim, false);
    ctx.restore();
    this.drawShield(sim);
    // the figures, back to front
    const figs: { y: number; draw: () => void }[] = [
      { y: sim.knight.y, draw: () => this.drawKnight(sim) },
      { y: sim.dragon.y + sim.dragon.spec.r * 0.3, draw: () => this.drawDragon(sim) },
      { y: this.ly, draw: () => this.drawLinda(sim) },
    ];
    if (sim.horse) {
      const h = sim.horse, q = h.t / RULES.horseSec;
      const hx = h.dir > 0 ? -1 + q * (RULES.arenaW + 2) : RULES.arenaW + 1 - q * (RULES.arenaW + 2);
      figs.push({ y: h.y + 0.1, draw: () => paintHorse(ctx, this.px(hx), this.py(h.y + 0.15), S * 0.9, h.dir, this.clock) });
    }
    figs.sort((a, b) => a.y - b.y).forEach(f => f.draw());
    for (const f of sim.flames) paintFlame(ctx, this.px(f.x), this.py(f.y) - S * 0.25, f.r * S, this.clock, f.id);
    this.drawBalls(sim, true);
    this.drawLances(sim);
    this.drawApple(sim);
    this.drawPlates();
    // dusk over the arena in a Postój, smoke in a blind block
    if (this.dusk > 0.01) {
      ctx.fillStyle = sim.blind ? `rgba(110,104,120,${0.2 * this.dusk})` : `rgba(40,60,120,${0.2 * this.dusk})`;
      ctx.fillRect(L.ox, L.oy, RULES.arenaW * S, RULES.arenaH * S);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx);
    ctx.restore();
    this.steam.draw(ctx);
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.strokeStyle = `${r.color}${(1 - k) * 0.9})`;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), 0, TAU);
      ctx.stroke();
    }
    this.drawGauges(sim);
    if (sim.hint) this.drawHint(sim);
    ctx.restore();
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${this.flashColor}${0.5 * this.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    this.hud.draw(sim);
    this.drawBubble(sim);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(30,24,16,${this.fade})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // ── the fence and its pennants: the band's last 40 s ────────────
  private drawFence(sim: JerzySim): void {
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const x0 = this.px(2.7), x1 = this.px(RULES.arenaW - 0.15);
    const rail = L.oy - L.fenceH + 0.14 * S, maxLen = L.fenceH - 0.28 * S;
    paintFence(ctx, x0, x1, rail, S);
    const n = 40, step = (x1 - x0) / n;
    const bars = traceBars(sim.trace, sim.t, n);
    const lenOf = (level: number) => (0.12 + 0.88 * clamp(level)) * maxLen;
    // the threshold: a dashed rope where a banner at level 0.5 ends
    const ty = rail + lenOf(0.5);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(255,248,225,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, ty);
    ctx.lineTo(x1, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    bars.forEach((b, i) => {
      const x = x0 + (i + 0.15) * step, bw = step * 0.7;
      if (b.empty) return;
      // the hook
      ctx.fillStyle = '#5b3d25';
      ctx.fillRect(x + bw / 2 - 1, rail - 2, 2, 4);
      if (b.shown <= 0) {
        // veiled by smoke
        ctx.fillStyle = 'rgba(120,114,126,.85)';
        ctx.beginPath();
        ctx.arc(x + bw / 2, rail + maxLen * 0.35, bw * 0.7, 0, TAU);
        ctx.fill();
        return;
      }
      if (!b.reliable) {
        ctx.fillStyle = 'rgba(255,248,225,.5)';
        for (let k = 0; k < 3; k++) ctx.fillRect(x + bw / 2 - 0.75, rail + 4 + k * 4, 1.5, 1.5);
        return;
      }
      const len = lenOf(b.level);
      const color = b.above ? (b.phase === 'rest' ? '#cfe0ff' : C.gold) : b.phase === 'rest' ? '#7fa7e0' : '#efe2c4';
      ctx.globalAlpha = b.shown;
      if (b.above && b.phase !== 'rest') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,211,107,.3)';
        ctx.fillRect(x - 1, rail, bw + 2, len + 2);
        ctx.restore();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, rail);
      ctx.lineTo(x + bw, rail);
      ctx.lineTo(x + bw, rail + len);
      ctx.lineTo(x + bw / 2, rail + len - bw * 0.45);
      ctx.lineTo(x, rail + len);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // the threshold's name and the band's delay at "now"
    ctx.font = font(750, 9 * u, SANS);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,248,225,.9)';
    ctx.fillText(TXT.mark, x0 - 4 * u, ty + 4 * u);
    const lag = LAG_SEC[this.opts.eeg ? 'eeg' : 'fnirs'];
    const lagBars = Math.max(1, Math.round(lag));
    const bx0 = x0 + (n - lagBars) * step, by = rail + maxLen + 3 * u;
    ctx.strokeStyle = 'rgba(255,248,225,.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx0 + 1, by - 3 * u);
    ctx.lineTo(bx0 + 1, by);
    ctx.lineTo(x1 - 1, by);
    ctx.lineTo(x1 - 1, by - 3 * u);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(t('lag', { n: lag }), x1, by + 1);
  }

  // ── telegraphs ──────────────────────────────────────────────────
  private zonePath(z: Zone): void {
    const ctx = this.ctx, S = this.S;
    const x = this.px(z.x), y = this.py(z.y);
    ctx.beginPath();
    if (z.kind === 'cone') {
      ctx.moveTo(x, y);
      ctx.arc(x, y, z.len * S, z.a - z.r1, z.a + z.r1);
      ctx.closePath();
    } else if (z.kind === 'ring') {
      ctx.arc(x, y, z.r1 * S, 0, TAU);
      ctx.arc(x, y, z.r0 * S, 0, TAU, true);
    } else if (z.kind === 'lane') {
      const ux = Math.cos(z.a), uy = Math.sin(z.a), hw = (z.w / 2) * S;
      ctx.moveTo(x - uy * hw, y + ux * hw);
      ctx.lineTo(x - uy * hw + ux * z.len * S, y + ux * hw + uy * z.len * S);
      ctx.lineTo(x + uy * hw + ux * z.len * S, y - ux * hw + uy * z.len * S);
      ctx.lineTo(x + uy * hw, y - ux * hw);
      ctx.closePath();
    } else ctx.arc(x, y, z.r1 * S, 0, TAU);
  }

  private drawZones(sim: JerzySim): void {
    const ctx = this.ctx;
    for (const z of sim.zones) {
      const k = clamp(z.t / Math.max(0.01, z.dur));
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 18);
      this.zonePath(z);
      ctx.fillStyle = `${C.danger}${z.live ? 0.32 : 0.12 + 0.18 * k})`;
      ctx.fill('evenodd');
      ctx.strokeStyle = `${C.danger}${0.55 + 0.4 * pulse * k})`;
      ctx.lineWidth = 2;
      ctx.setLineDash(z.live ? [] : [6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // the fill sweeping toward the strike: how soon it lands
      if (!z.live && k > 0) {
        ctx.save();
        this.zonePath(z);
        ctx.clip('evenodd');
        const x = this.px(z.x), y = this.py(z.y), S = this.S;
        ctx.fillStyle = `${C.danger}0.22)`;
        ctx.beginPath();
        if (z.kind === 'cone' || z.kind === 'lane') ctx.arc(x, y, Math.max(1, k * (z.len || 1) * S), 0, TAU);
        else ctx.arc(x, y, Math.max(1, k * z.r1 * S), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ── the shield: the live gauge ──────────────────────────────────
  private drawShield(sim: JerzySim): void {
    const ctx = this.ctx, S = this.S, u = this.L.u, k = sim.knight;
    if (k.down > 0) return;
    const x = this.px(sim.shieldX), y = this.py(sim.shieldY), R = sim.shieldR * S;
    const look = sim.shieldLook;
    if (look === 'smoke') {
      // the shield in smoke: grey puffs drifting around the buckler, its size hidden
      const rr = Math.max(R, S * 0.55);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + this.clock * 0.6, wob = 1 + 0.15 * Math.sin(this.clock * 2 + i);
        ctx.fillStyle = 'rgba(170,164,176,.55)';
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr * 0.8, y + Math.sin(a) * rr * 0.8, (rr * 0.45 + 3 * u) * wob, 0, TAU);
        ctx.fill();
      }
      return;
    }
    const above = look === 'live' && sim.level >= 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(4, R));
    const col = look === 'grey' ? '200,200,210' : '255,236,180';
    const a = look === 'live' ? 0.22 + 0.22 * clamp(sim.level) : 0.16;
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.8, `rgba(${col},${a * 0.6})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, R), 0, TAU);
    ctx.fill();
    ctx.restore();
    // the threshold: a dotted ring where the level is 0.5 (in a Tarcza)
    if (look !== 'buckler') {
      const mark = shieldFor(0.5, sim.buckler) * S;
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = 'rgba(255,250,232,.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, mark, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(750, 9.5 * u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(30,24,16,.6)';
      // its name at the ring's top, toward the dragon's side of the knight
      const la = sim.knight.face - Math.sign(Math.cos(sim.knight.face) || 1) * 1.0;
      const lx = x + Math.cos(la) * mark, ly = y + Math.sin(la) * mark - 2 * u;
      ctx.strokeText(TXT.mark, lx, ly);
      ctx.fillStyle = 'rgba(255,250,232,.95)';
      ctx.fillText(TXT.mark, lx, ly);
    }
    // the rim: gold beyond the threshold, pale below, grey without signal, dashed while waiting
    ctx.strokeStyle = above ? '#ffd36b' : look === 'grey' ? 'rgba(190,190,205,.7)' : 'rgba(255,250,232,.9)';
    ctx.lineWidth = above ? 3.5 : 2.2;
    if (look === 'wait') ctx.setLineDash([7, 5]);
    if (above) {
      ctx.shadowColor = 'rgba(255,211,107,.9)';
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, R), 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
  }

  /** The shield's name and size under the disc (a Tarcza only), over the figures. */
  private shieldLabel(sim: JerzySim): void {
    const ctx = this.ctx, S = this.S, u = this.L.u, look = sim.shieldLook;
    if (sim.knight.down > 0 || !(look === 'live' || look === 'wait' || look === 'grey')) return;
    const x = this.px(sim.shieldX), y = this.py(sim.shieldY), R = sim.shieldR * S;
    const above = look === 'live' && sim.level >= 0.5;
    const pctTxt = look === 'live' ? `${TXT.shield} ${Math.round(clamp(sim.level) * 100)}%` : TXT.shield;
    ctx.font = font(800, 10.5 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(30,24,16,.65)';
    const ty = Math.min(y + Math.max(R, shieldFor(0.5, sim.buckler) * S) + 4 * u, this.L.oy + RULES.arenaH * S - 14 * u);
    ctx.strokeText(pctTxt, x, ty);
    ctx.fillStyle = above ? '#ffe7a3' : '#fffaf0';
    ctx.fillText(pctTxt, x, ty);
  }

  // ── the figures ─────────────────────────────────────────────────
  private readonly kPose: KnightPose = { flip: 1, step: 0, walking: 0, swing: 0, roll: 0, down: 0, hit: 0, charge: 0, ready: false, t: 0 };

  private drawKnight(sim: JerzySim): void {
    const k = sim.knight, p = this.kPose, S = this.S;
    p.flip = Math.cos(k.face) >= 0 ? 1 : -1;
    p.step = this.step;
    p.walking = this.walking;
    p.swing = this.swing;
    p.roll = k.rollT > 0 ? 1 - k.rollT / RULES.rollSec : 0;
    p.down = k.down > 0 ? 1 : 0;
    p.hit = k.hitT > 0.15 ? 1 : 0;
    p.charge = sim.charge;
    p.ready = sim.swordReady;
    p.t = this.clock;
    // blink while invulnerable after a hit
    if (k.safe > 0 && k.rollT <= 0 && k.down <= 0 && Math.sin(this.clock * 40) > 0.3) this.ctx.globalAlpha = 0.55;
    paintKnight(this.ctx, this.px(k.x), this.py(k.y) + S * 0.2, S * 1.22, p);
    this.ctx.globalAlpha = 1;
  }

  private readonly dPose: DragonPose = { kind: 'zielony', flip: 1, r: 1, air: 0, jaw: 0, wings: 0, hit: 0, scales: 1, sleep: 0, daze: 0, heads: 3, t: 0 };

  private drawDragon(sim: JerzySim): void {
    const ctx = this.ctx, d = sim.dragon, p = this.dPose, S = this.S, u = this.L.u;
    if (d.state === 'away') return;
    const x = this.px(d.x), y = this.py(d.y);
    if (d.under) {
      paintUnder(ctx, x, y, S, this.clock, d.spec.kind);
      return;
    }
    const nap = d.state === 'nap' || d.state === 'toCave' || d.state === 'fromCave';
    const small = nap ? 0.62 : 1;
    p.kind = d.spec.kind;
    p.flip = Math.cos(d.face) >= 0 ? 1 : -1;
    p.r = d.spec.r * small;
    p.air = d.air;
    p.jaw = this.jaw;
    p.wings = this.wings;
    p.hit = d.hitT > 0.06 ? 1 : 0;
    p.scales = d.phases[d.phase] > 0 ? d.left / d.phases[d.phase] : 0;
    p.sleep = d.state === 'nap' ? 1 : 0;
    p.daze = d.state === 'flaw' ? 1 : 0;
    p.heads = d.spec.kind === 'trzyglowy' ? Math.max(1, 3 - d.phase) : 1;
    p.t = this.clock;
    // the roar: a shudder
    const sx = this.roar > 0 ? Math.sin(this.clock * 60) * this.roar * 3 * u : 0;
    paintDragon(ctx, x + sx, y, S, p);
    const top = y - S * d.spec.r * 2.3 * small - d.air * S * 1.6;
    if (d.state === 'nap') this.zzz(x + S * 0.4, top + S * 0.4);
    if (d.state === 'flaw') {
      // coughing smoke or dizzy stars over its head
      const cough = d.spec.flaw === 'breath';
      for (let i = 0; i < 4; i++) {
        const a = this.clock * 4 + (i * TAU) / 4;
        if (cough) {
          const k2 = (this.clock * 1.5 + i / 4) % 1;
          ctx.fillStyle = `rgba(90,90,90,${0.5 * (1 - k2)})`;
          ctx.beginPath();
          ctx.arc(x + p.flip * S * (1.1 + k2 * 0.6), top + S * 0.5 - k2 * S * 0.8, S * (0.12 + k2 * 0.18), 0, TAU);
          ctx.fill();
        } else {
          ctx.fillStyle = '#ffe7a3';
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * S * 0.5, top + Math.sin(a) * S * 0.15, 3 * u, 0, TAU);
          ctx.fill();
        }
      }
      // Linda's tip: the open spot marked in gold
      if (sim.tipActive) {
        const pulse = 0.5 + 0.5 * Math.sin(this.clock * 8);
        ctx.strokeStyle = `rgba(255,211,107,${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y - S * d.spec.r * 0.4, S * d.spec.r * (1.25 + 0.1 * pulse), 0, TAU);
        ctx.stroke();
        ctx.font = font(900, 16 * u, SANS);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(30,24,16,.7)';
        ctx.strokeText('×2', x, top - 4 * u);
        ctx.fillStyle = '#ffd36b';
        ctx.fillText('×2', x, top - 4 * u);
      }
    }
  }

  private zzz(x: number, y: number): void {
    const ctx = this.ctx, u = this.L.u;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const k = (this.clock * 0.5 + i / 3) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.font = font(800, (10 + 6 * k) * u, SANS);
      ctx.fillStyle = '#e8eeff';
      ctx.fillText('z', x + k * 18 * u, y - k * 30 * u);
    }
    ctx.globalAlpha = 1;
  }

  private readonly lPose: LindaPose = { flip: 1, step: 0, walking: 0, arm: 0, sit: 0, talk: false, t: 0 };

  private drawLinda(sim: JerzySim): void {
    const p = this.lPose, k = sim.knight;
    p.flip = k.x >= this.lx ? 1 : -1;
    p.step = this.lStep;
    p.walking = this.lWalk;
    p.arm = this.lArm;
    p.sit = 0;
    p.talk = !!sim.talk.line;
    p.t = this.clock;
    paintLinda(this.ctx, this.px(this.lx), this.py(this.ly), this.S * 1.2, p);
  }

  private drawBubble(sim: JerzySim): void {
    const line = sim.talk.line;
    if (!line) return;
    const k = Math.min(line.t, Math.max(0, line.dur - line.t) * 1.5);
    this.hud.bubble(line.text, this.px(this.lx), this.py(this.ly) - this.S * 1.45, k);
  }

  // ── fire in the air, lances, the apple, the scales ──────────────
  private drawBalls(sim: JerzySim, air: boolean): void {
    const ctx = this.ctx, S = this.S;
    for (const b of sim.balls) {
      const k = clamp(b.t / b.dur);
      const x1 = this.px(b.x1), y1 = this.py(b.y1);
      if (!air) {
        // the landing spot: a red circle filling as it falls
        ctx.fillStyle = `${C.danger}${0.1 + 0.15 * k})`;
        ctx.beginPath();
        ctx.arc(x1, y1, RULES.splashR * S, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `${C.danger}${0.5 + 0.4 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x1, y1, RULES.splashR * S, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = `${C.danger}0.25)`;
        ctx.beginPath();
        ctx.arc(x1, y1, RULES.splashR * S * k, 0, TAU);
        ctx.fill();
        continue;
      }
      const gx = b.x0 + (b.x1 - b.x0) * k, gy = b.y0 + (b.y1 - b.y0) * k;
      const z = b.drop ? (1 - k) * 5 * S : Math.sin(Math.PI * k) * 2.2 * S;
      paintFireball(ctx, this.px(gx), this.py(gy), z, 0.22 * S, this.clock);
    }
  }

  private drawLances(sim: JerzySim): void {
    const ctx = this.ctx, S = this.S, d = sim.dragon;
    for (const l of sim.lances) {
      const k = clamp(l.t / l.dur);
      const x = this.px(l.x0 + (d.x - l.x0) * k), y = this.py(l.y0 + (d.y - l.y0) * k) - S * (0.7 + Math.sin(Math.PI * k) * 0.5);
      const a = Math.atan2(d.y - l.y0, d.x - l.x0);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#7a5434';
      ctx.fillRect(-S * 0.6, -S * 0.03, S * 0.9, S * 0.06);
      ctx.fillStyle = C.steel;
      ctx.beginPath();
      ctx.moveTo(S * 0.45, -S * 0.07);
      ctx.lineTo(S * 0.62, 0);
      ctx.lineTo(S * 0.45, S * 0.07);
      ctx.fill();
      ctx.fillStyle = C.vermilion;
      ctx.fillRect(-S * 0.2, -S * 0.12, S * 0.14, S * 0.1);
      ctx.restore();
    }
  }

  private drawApple(sim: JerzySim): void {
    if (!this.apple) return;
    const k = clamp(this.apple.t / this.apple.dur), kn = sim.knight, S = this.S;
    const x = this.px(this.lx + (kn.x - this.lx) * k), y = this.py(this.ly + (kn.y - this.ly) * k) - S * (0.9 + Math.sin(Math.PI * k) * 1.6);
    paintApple(this.ctx, x, y, S * 0.16);
  }

  private drawPlates(): void {
    const ctx = this.ctx, u = this.L.u;
    for (const p of this.plates) {
      ctx.save();
      ctx.globalAlpha = clamp((1.4 - p.t) / 0.4);
      ctx.translate(p.x, p.y - p.z);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -5 * u);
      ctx.quadraticCurveTo(5 * u, -1 * u, 0, 5 * u);
      ctx.quadraticCurveTo(-5 * u, -1 * u, 0, -5 * u);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── the knight's gauges: heart and the Miecz światła ────────────
  /**
   * The Postój's gauge, by Linda: a ring of calm around her scroll (a tick at the threshold, blue
   * beyond it) and the scroll filling with her tip; when it is full she knows the dragon's flaw.
   */
  private restGauge(sim: JerzySim): void {
    const a = this.dusk;
    if (a < 0.05 || sim.blind) return;
    const ctx = this.ctx, S = this.S, u = this.L.u;
    const side = this.lx >= sim.knight.x ? 1 : -1;
    const x = clamp(this.px(this.lx) + side * S * 0.85, this.L.ox + 22 * u, this.L.ox + RULES.arenaW * S - 22 * u);
    const y = Math.max(this.L.oy + 24 * u, this.py(this.ly) - S * 1.25);
    const r = Math.max(14 * u, S * 0.36);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(30,40,70,.75)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // the scroll, filling bottom-up with the tip
    const sw = r * 0.9, sh = r * 1.1, fill = clamp(sim.tipFill);
    ctx.fillStyle = '#efe2c4';
    ctx.fillRect(x - sw / 2, y - sh / 2, sw, sh);
    ctx.fillStyle = fill >= 1 ? '#ffd36b' : '#9dbcf0';
    ctx.fillRect(x - sw / 2, y + sh / 2 - sh * fill, sw, sh * fill);
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(x - sw / 2 - 2 * u, y - sh / 2 - 2 * u, sw + 4 * u, 3 * u);
    ctx.fillRect(x - sw / 2 - 2 * u, y + sh / 2 - 1 * u, sw + 4 * u, 3 * u);
    // the ring of calm: the live gauge of the rest, a tick at the threshold
    const rr = r + 4 * u, calm = sim.reliable ? clamp(sim.calm) : 0;
    ctx.lineWidth = 4 * u;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = calm >= 0.5 ? C.calm : 'rgba(210,210,230,.7)';
    ctx.beginPath();
    ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * calm);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,232,.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y + rr - 5 * u);
    ctx.lineTo(x, y + rr + 5 * u);
    ctx.stroke();
    ctx.font = font(800, 9.5 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,24,40,.7)';
    const label = `${TXT.tipName} ${Math.round(fill * 100)}%`;
    ctx.strokeText(label, x, y + rr + 6 * u);
    ctx.fillStyle = fill >= 1 ? '#ffe7a3' : '#dfe8ff';
    ctx.fillText(label, x, y + rr + 6 * u);
    ctx.restore();
  }

  private drawGauges(sim: JerzySim): void {
    this.shieldLabel(sim);
    this.restGauge(sim);
    const ctx = this.ctx, S = this.S, u = this.L.u, k = sim.knight;
    const x = this.px(k.x), y = this.py(k.y) + S * 0.2;
    // the hearts over his helmet
    const top = y - S * 1.85;
    const n = 5, hw = 9 * u;
    for (let i = 0; i < n; i++) {
      const fill = clamp(k.heart * n - i);
      const hx = x + (i - (n - 1) / 2) * hw, hy = top;
      heart(ctx, hx, hy, 3.6 * u, 'rgba(30,24,16,.45)');
      if (fill > 0) heart(ctx, hx, hy, 3.6 * u * (0.5 + 0.5 * fill), fill >= 1 ? '#e8503a' : '#f08a6a');
    }
    // the Miecz światła: a gauge beside him, on the side away from the dragon
    const side = Math.cos(k.face) >= 0 ? -1 : 1;
    const gx = x + side * S * 0.68, gy0 = y - S * 0.15, gh = S * 1.05, gw = Math.max(5, 6 * u);
    ctx.fillStyle = 'rgba(30,24,16,.55)';
    ctx.beginPath();
    ctx.roundRect(gx - gw / 2 - 1, gy0 - gh - 1, gw + 2, gh + 2, gw / 2);
    ctx.fill();
    const c = clamp(sim.charge);
    if (c > 0) {
      ctx.save();
      if (sim.swordReady) {
        ctx.shadowColor = 'rgba(255,220,120,1)';
        ctx.shadowBlur = 10 + 6 * Math.sin(this.clock * 9);
      }
      ctx.fillStyle = sim.swordReady ? '#fff2b8' : C.gold;
      ctx.beginPath();
      ctx.roundRect(gx - gw / 2, gy0 - gh * c, gw, gh * c, gw / 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(gx - gw, gy0 + 1, gw * 2, 2.5 * u);
    if (c > 0.02 || sim.pushBlock) {
      // its name beside the gauge's foot, away from the knight
      ctx.font = font(800, 9 * u, SANS);
      ctx.textAlign = side < 0 ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(30,24,16,.6)';
      const label = sim.swordReady ? TXT.ready : TXT.sword_;
      ctx.strokeText(label, gx + side * (gw + 3 * u), gy0 - 4 * u);
      ctx.fillStyle = sim.swordReady ? '#fff2b8' : '#ffe7a3';
      ctx.fillText(label, gx + side * (gw + 3 * u), gy0 - 4 * u);
    }
  }

  /** Where he walks: a small ring on the ground; a gold chevron over the dragon when he goes after it. */
  private drawTarget(sim: JerzySim): void {
    const ctx = this.ctx, k = sim.knight, u = this.L.u;
    if (!k.walking || k.engage || k.down > 0) return;
    const x = this.px(k.tx), y = this.py(k.ty);
    ctx.strokeStyle = 'rgba(255,248,225,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 9 * u, 4.5 * u, 0, 0, TAU);
    ctx.stroke();
  }

  /** The warm-up's ghost hand: a pulsing ring at the dragon — tap there and he goes after it. */
  private drawHint(sim: JerzySim): void {
    const ctx = this.ctx, d = sim.dragon, S = this.S, u = this.L.u;
    if (!sim.present) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 6);
    const x = this.px(d.x), y = this.py(d.y);
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.strokeStyle = C.goldLight;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, S * (d.spec.r + 0.3 + 0.15 * pulse), 0, TAU);
    ctx.stroke();
    ctx.fillStyle = C.goldLight;
    ctx.beginPath();
    ctx.arc(x + S * 0.9, y + S * 0.9 + pulse * 6 * u, 10 * u, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.5);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  ctx.fill();
}

void glow;
