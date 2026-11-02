/**
 * Anioł Stróż's play view, all on the canvas: the child's room at night in cross-section (the
 * wardrobe's shadow on the left, the door ajar on the right, the lamp's warm pool, the window whose
 * sky holds the band's curve and whose sill holds its stars), the aura around the bed (its radius
 * is the level; a dotted ring marks the threshold, the rim turns gold beyond it), the bed with the
 * sleeping child and the dream bubble (Sen, the lullaby's stars, the calm gauge), the Zmory walking
 * in from both sides, the angel over the bed with the Płomień's ring, the strikes' sweeps of light,
 * hit-stop, sparks, motes and feathers, and the HUD (hud.ts) on top.  It only reads the sim
 * (sim.ts); the calibration scene is intro.ts.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { roomItems } from './meta';
import { Hud } from './hud';
import { feathers as feathersText, t } from './i18n';
import { AniolIntro } from './intro';
import { layout, type Layout } from './layout';
import type { AniolProgress } from './meta';
import {
  C, SANS, font, glow, paintAngel, paintBed, paintFeather, paintLamp, paintRoom, paintRoomItem, paintStar, paintZmora,
  type AngelPose, type ZPose,
} from './paint';
import { RULES, auraFor, type AniolSim, type SimEvent, type Side } from './sim';
import { giftById, type RoomItem } from './content';

const TAU = Math.PI * 2;

const TXT = {
  whiff: t('fx.whiff'), bounce: t('fx.bounce'), crack: t('fx.crack'), flame: t('fx.flame'), flameSub: t('fx.flameSub'),
  stir: t('fx.stir'), comfort: t('fx.comfort'), shield: t('fx.shield'), touch: t('fx.touch'), split: t('fx.split'),
  burst: t('fx.burst'), mark: t('mark'), sen: t('hud.sen'), flameLabel: t('hud.flame'),
  kzCome: t('kz.come'), kzComeSub: t('kz.comeSub'), kzTurn: t('kz.turn'), kzBanished: t('kz.banished'), kzFled: t('kz.fled'),
  zhint: { skoczek: t('zhint.skoczek'), widmo: t('zhint.widmo'), pancerna: t('zhint.pancerna'), roj: t('zhint.roj') } as Record<string, string>,
};

interface Sweep { side: Side; t: number; dur: number; hit: boolean; reach: number; spear: boolean }
interface Ring { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
interface Feather { x: number; y: number; vx: number; vy: number; rot: number; vr: number; t: number; dur: number; size: number }
interface Note { x: number; y: number; t: number; dur: number; dx: number }

export class AniolView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new AniolIntro();
  private clock = 0;
  private started = false;
  private readonly parts = new Particles(600);
  private readonly sweeps: Sweep[] = [];
  private readonly rings: Ring[] = [];
  private readonly feathers: Feather[] = [];
  private readonly notes: Note[] = [];
  private readonly shake: Shake;
  private readonly rnd = Math.random;
  private items: RoomItem[] = [];
  // the angel's animation
  private face = 1;
  private swing = 0;
  private comfort = 0;
  private sing = 0;
  private flash = 0;
  private flashColor = 'rgba(255,244,214,';
  private senShown = 1;
  private senPulse = 0;
  private starPop = 0;
  private dawn = 0;
  private night = 0;
  private fade = 0;
  private readonly seen = new Set<string>();

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx, opts.eeg);
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

  start(sim: AniolSim): void {
    this.started = true;
    this.fade = 1;
    this.items = roomItems(sim.rank);
  }

  intro(dt: number, p: number, progress: AniolProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── the room's points ───────────────────────────────────────────
  private get S(): number { return this.L.S; }
  /** a point on the line across the room (side, distance from the bed's centre, height) in px */
  xOf(side: number, d: number): number { return this.L.cx + side * d * this.S; }
  yOf(z: number): number { return this.L.floorY - z * this.S; }
  private get angelX(): number { return this.L.cx; }
  private get angelY(): number { return this.L.floorY - this.S * (2.4 - 0.45 * ease.inOutSine(this.comfort)) + Math.sin(this.clock * 1.8) * this.S * 0.05; }
  private get bubble(): { x: number; y: number; r: number } {
    const S = this.S;
    return { x: this.L.cx - 1.62 * S, y: this.L.floorY - 1.78 * S, r: 0.42 * S };
  }

  /** The side of the screen a tap is on: the left third −1, the right third +1, the middle 0 (the nearer side). */
  sideAt(x: number): Side | 0 {
    const x0 = this.L.roomX0, k = (x - x0) / Math.max(1, this.w - x0);
    return k < 1 / 3 ? -1 : k > 2 / 3 ? 1 : 0;
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: AniolSim): void {
    const u = this.L.u, rm = this.opts.reducedMotion, S = this.S;
    switch (e.type) {
      case 'spawn':
        if (e.kind in TXT.zhint && !this.seen.has(e.kind)) {
          this.seen.add(e.kind);
          this.hud.float(TXT.zhint[e.kind], this.xOf(e.side, Math.min(4.2, (this.w / 2 - 70 * u) / S)), this.yOf(1.9), '#ffd9b0', 13, 2.6, 18);
        }
        break;
      case 'strike':
        this.face = e.side;
        this.swing = 1;
        this.sweeps.push({ side: e.side, t: 0, dur: e.hit ? 0.26 : 0.2, hit: e.hit, reach: sim.reach + (e.spear ? RULES.spearReach : 0), spear: e.spear });
        if (this.sweeps.length > 6) this.sweeps.shift();
        break;
      case 'hit': {
        const x = this.xOf(e.side, e.d), y = this.yOf(e.z + 0.45);
        this.parts.burst(x, y, rm ? 6 : 16, { color: '#fff4d6', size: 2.4 * u, speed: 260 * u, g: 300, drag: 3, life: 0.35, shape: 'spark', angle: e.side > 0 ? 0 : Math.PI, spread: 2.2, rnd: this.rnd });
        this.parts.burst(x, y, rm ? 2 : 6, { color: C.gold, size: 2 * u, speed: 120 * u, g: 0, drag: 4, life: 0.4, rnd: this.rnd });
        this.rings.push({ x, y, t: 0, dur: 0.22, r0: 6 * u, r1: 34 * u, color: 'rgba(255,244,214,', width: 3 });
        this.shake.add(e.kind === 'koszmar' ? 0.22 : 0.12);
        break;
      }
      case 'bounce': {
        const x = this.xOf(e.side, e.d), y = this.yOf(0.5);
        this.parts.burst(x, y, rm ? 4 : 12, { color: '#cfcde6', size: 2 * u, speed: 220 * u, g: 500, drag: 2, life: 0.4, shape: 'spark', rnd: this.rnd });
        this.hud.float(TXT.bounce, x, y - 30 * u, '#cfcde6', 14, 0.8, 22);
        this.shake.add(0.16);
        break;
      }
      case 'crack': {
        const x = this.xOf(e.side, e.d), y = this.yOf(0.5);
        this.parts.burst(x, y, rm ? 5 : 16, { color: '#7d7aa0', size: 3 * u, speed: 200 * u, g: 600, drag: 1.5, life: 0.7, shape: 'square', rnd: this.rnd });
        this.hud.float(TXT.crack, x, y - 34 * u, C.goldLight, 16, 1, 26);
        this.rings.push({ x, y, t: 0, dur: 0.4, r0: 8 * u, r1: 50 * u, color: 'rgba(255,226,150,', width: 3 });
        break;
      }
      case 'banish': {
        const x = this.xOf(e.side, e.d), y = this.yOf(e.z + 0.45);
        const big = e.kind === 'koszmar';
        // the ink bursts into motes of light that rise
        this.parts.burst(x, y, rm ? 8 : big ? 70 : 26, { color: '#fff7dc', size: (big ? 3.5 : 2.6) * u, speed: (big ? 260 : 150) * u, g: -90, drag: 2.2, life: big ? 1.6 : 1, rnd: this.rnd });
        this.parts.burst(x, y, rm ? 4 : big ? 40 : 12, { color: C.gold, size: 2.2 * u, speed: (big ? 320 : 200) * u, g: -40, drag: 2.5, life: 0.8, shape: 'spark', rnd: this.rnd });
        this.parts.burst(x, y, rm ? 2 : 6, { color: '#3a3260', size: 4 * u, speed: 60 * u, g: -30, drag: 3, life: 0.5, rnd: this.rnd });
        this.rings.push({ x, y, t: 0, dur: big ? 0.9 : 0.4, r0: 10 * u, r1: (big ? 160 : 60) * u, color: 'rgba(255,240,190,', width: big ? 6 : 3 });
        const nf = Math.min(5, Math.max(1, Math.round(e.feathers / 2)));
        for (let i = 0; i < (rm ? 1 : nf); i++) this.feather(x, y);
        if (e.via !== 'flame' && e.via !== 'dawn') this.hud.float(`+${e.feathers}`, x, y - 26 * u, C.goldLight, 13, 0.8, 30);
        this.hud.popScore();
        this.shake.add(big ? 0.6 : 0.16);
        if (big) this.flashOn(0.9);
        break;
      }
      case 'split':
        this.hud.float(TXT.split, this.xOf(e.side, e.d), this.yOf(1.1), '#ffd9b0', 14, 0.9, 24);
        break;
      case 'whiff':
        this.hud.float(TXT.whiff, this.xOf(e.side, sim.reach * 0.75), this.yOf(0.9), 'rgba(220,214,240,.9)', 12, 0.6, 16);
        break;
      case 'harp': {
        const x = this.angelX + e.side * S * 0.6, y = this.angelY - S * 0.3;
        this.notes.push({ x, y, t: 0, dur: 1.6, dx: e.side * 14 * u });
        this.parts.burst(x, y, rm ? 2 : 6, { color: C.goldLight, size: 1.8 * u, speed: 50 * u, g: -40, drag: 2, life: 0.8, rnd: this.rnd });
        break;
      }
      case 'combo':
        this.hud.float(t('fx.combo', { n: e.mult }), this.angelX, this.angelY - S * 1.4, e.mult >= 3 ? '#ffb070' : C.goldLight, 22, 1.2, 34);
        this.rings.push({ x: this.angelX, y: this.angelY, t: 0, dur: 0.5, r0: S * 0.5, r1: S * 1.8, color: 'rgba(255,214,120,', width: 4 });
        break;
      case 'touch': {
        const b = this.bubble;
        this.senPulse = 1;
        this.rings.push({ x: b.x, y: b.y, t: 0, dur: 0.5, r0: b.r, r1: b.r * 1.8, color: 'rgba(120,110,170,', width: 3 });
        this.hud.float(TXT.touch, b.x, b.y - b.r - 10 * u, '#c9c3ea', 12, 1, 18);
        this.parts.burst(this.xOf(e.side, RULES.bedHalf + 0.2), this.yOf(0.4), rm ? 3 : 10, { color: '#3a3260', size: 3 * u, speed: 80 * u, g: -20, drag: 2, life: 0.7, rnd: this.rnd });
        break;
      }
      case 'shield': {
        const x = this.xOf(e.side, RULES.bedHalf + 0.25), y = this.yOf(0.6);
        this.rings.push({ x, y, t: 0, dur: 0.45, r0: 10 * u, r1: 70 * u, color: 'rgba(255,250,235,', width: 4 });
        this.hud.float(TXT.shield, x, y - 40 * u, '#fffaf0', 15, 0.9, 24);
        for (let i = 0; i < 3; i++) this.feather(x, y);
        break;
      }
      case 'stir':
        this.comfort = 1.6;
        this.hud.toast(TXT.stir, TXT.comfort, C.calmDeep);
        this.rings.push({ x: this.L.cx, y: this.yOf(0.7), t: 0, dur: 0.9, r0: S * 0.4, r1: S * 3.8, color: 'rgba(200,220,255,', width: 4 });
        this.shake.add(0.2);
        break;
      case 'flame':
        this.flashOn(1);
        this.rings.push({ x: this.angelX, y: this.angelY, t: 0, dur: 0.9, r0: S * 0.6, r1: Math.hypot(this.w, this.h), color: 'rgba(255,214,120,', width: 10 });
        this.hud.toast(TXT.flame, TXT.flameSub, C.goldDeep);
        this.shake.add(0.55);
        break;
      case 'level':
        this.hud.popLevel();
        this.rings.push({ x: this.angelX, y: this.angelY, t: 0, dur: 0.7, r0: S * 0.5, r1: S * 2.6, color: 'rgba(255,236,170,', width: 5 });
        if (!rm) this.parts.burst(this.angelX, this.angelY, 30, { color: C.goldLight, size: 2.5 * u, speed: 220 * u, g: 0, drag: 2.5, life: 1, shape: 'spark', rnd: this.rnd });
        break;
      case 'gift':
        this.hud.toast(t('card.gift', { name: giftById(e.id).name }), giftById(e.id).text, C.goldDeep);
        break;
      case 'star': {
        const b = this.bubble;
        this.starPop = 1;
        this.parts.burst(b.x, b.y, rm ? 3 : 10, { color: '#fff3c4', size: 2 * u, speed: 70 * u, g: 0, drag: 2.5, life: 0.8, shape: 'spark', rnd: this.rnd });
        this.feather(b.x, b.y - b.r);
        break;
      }
      case 'restPass':
        this.hud.toast(t('card.restPass', { feathers: feathersText(e.feathers) }), t('card.rest.pass'), C.calmDeep);
        break;
      case 'burst':
        this.rings.push({ x: this.L.cx, y: this.yOf(0.6), t: 0, dur: RULES.burstSec, r0: S * 0.5, r1: e.r * S, color: 'rgba(255,220,150,', width: 8 });
        this.flashOn(0.4 + 0.5 * e.share);
        this.hud.float(TXT.burst, this.L.cx, this.yOf(3.2), '#e0d4ff', 17, 1.6, 30);
        this.shake.add(0.3);
        break;
      case 'blockStart':
        if (e.block.kind === 'rest') {
          // the Zmory draw back: a soft wave of calm across the room
          this.rings.push({ x: this.L.cx, y: this.yOf(0.6), t: 0, dur: 1.4, r0: S, r1: S * 7, color: 'rgba(160,190,255,', width: 5 });
        }
        break;
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(sim, e.block.kind, e.block.blind, e.verdict, e.share, e.need, e.t0, e.t1, e.stars);
        break;
      case 'koszmar':
        if (e.what === 'come') this.hud.toast(TXT.kzCome, TXT.kzComeSub, '#8a4a3a');
        else if (e.what === 'turn') this.hud.float(TXT.kzTurn, this.xOf(e.side, 3), this.yOf(2), '#ffd9b0', 18, 1.2, 26);
        else if (e.what === 'banished') this.hud.toast(TXT.kzBanished, '', C.goldDeep);
        else this.hud.toast(TXT.kzFled, '', C.calmDeep);
        if (e.what !== 'banished') this.shake.add(0.25);
        break;
      case 'dayGift':
        this.hud.toast(t('card.dayGift', { feathers: feathersText(e.n) }), '', C.goldDeep);
        break;
      case 'rank':
        this.hud.toast(t('card.rank', { name: t(`rank.${e.rank}` as 'rank.0') }), '', C.goldDeep);
        break;
      default:
        break;
    }
  }

  private flashOn(a: number): void {
    if (this.opts.reducedMotion) a *= 0.4;
    this.flash = Math.max(this.flash, a);
  }

  private feather(x: number, y: number): void {
    const u = this.L.u;
    this.feathers.push({ x, y, vx: (this.rnd() - 0.5) * 80 * u, vy: -(60 + this.rnd() * 60) * u, rot: this.rnd() * TAU, vr: (this.rnd() - 0.5) * 4, t: 0, dur: 1.6 + this.rnd() * 0.6, size: (6 + this.rnd() * 3) * u });
    if (this.feathers.length > 40) this.feathers.shift();
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: AniolSim): void {
    this.clock += dt;
    this.parts.update(dt);
    let n = 0;
    for (const s of this.sweeps) if ((s.t += dt) < s.dur) this.sweeps[n++] = s;
    this.sweeps.length = n;
    n = 0;
    for (const r of this.rings) if ((r.t += dt) < r.dur) this.rings[n++] = r;
    this.rings.length = n;
    n = 0;
    for (const f of this.feathers) {
      f.t += dt;
      f.vx *= Math.exp(-1.5 * dt);
      f.vy = f.vy * Math.exp(-1.2 * dt) + 22 * this.L.u * dt;
      f.x += (f.vx + Math.sin(f.t * 4 + f.rot) * 18 * this.L.u) * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.t < f.dur) this.feathers[n++] = f;
    }
    this.feathers.length = n;
    n = 0;
    for (const o of this.notes) if ((o.t += dt) < o.dur) this.notes[n++] = o;
    this.notes.length = n;
    this.swing = approach(this.swing, 0, dt, 0.09);
    this.comfort = Math.max(0, this.comfort - dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.senPulse = Math.max(0, this.senPulse - dt * 1.5);
    this.starPop = Math.max(0, this.starPop - dt * 2);
    this.fade = Math.max(0, this.fade - dt * 1.5);
    this.senShown = approach(this.senShown, sim.sen, dt, 0.25);
    this.sing = approach(this.sing, sim.restBlock ? 1 : 0, dt, 0.5);
    this.dawn = approach(this.dawn, sim.phase === 'done' ? 1 : 0, dt, 1.2);
    this.night = approach(this.night, sim.restBlock ? 1 : sim.blind ? 0.6 : 0, dt, 0.8);
    // the lullaby's notes rise from the angel
    if (sim.restBlock && this.rnd() < dt * 1.6) {
      this.notes.push({ x: this.angelX + (this.rnd() - 0.5) * this.S, y: this.angelY - this.S * 0.8, t: 0, dur: 2.2, dx: (this.rnd() - 0.5) * 30 * this.L.u });
    }
    this.hud.update(dt, sim);
  }

  draw(sim: AniolSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L, S = this.S;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    paintRoom(ctx, { w: this.w, h: this.h, cx: L.cx, floorY: L.floorY, s: S, win: L.win }, this.clock, this.dawn);
    this.hud.drawWindow(sim, this.dawn, this.items.includes('curtain'));
    this.drawItemsBack();
    const lamp = paintLamp(ctx, L.cx + 1.55 * S, L.floorY, S, 1, this.items.includes('book'));
    // the lamp's warm pool (dimmer in the lullaby, the room bluer)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, lamp.x, lamp.y, S * 3.2, C.lampGlow, 0.32 * (1 - 0.45 * this.night));
    ctx.restore();
    this.drawAura(sim);
    this.drawReach(sim);
    const head = paintBed(ctx, L.cx, L.floorY, S, this.clock, clamp(this.comfort / 0.8) * (this.comfort > 0.8 ? 1 : this.comfort / 0.8), this.items.includes('blanket'));
    if (this.items.includes('bear')) paintRoomItem(ctx, 'bear', L.cx - 1.45 * S, L.floorY - 0.24 * S, 0.3 * S);
    this.drawBubble(sim, head);
    this.drawZmory(sim);
    this.drawAngel(sim);
    this.drawSweeps(sim);
    if (sim.hint) this.drawHint(sim);
    // the lullaby's blue and the blind block's fog over the room
    if (this.night > 0.01) {
      ctx.fillStyle = sim.blind ? `rgba(90,80,140,${0.22 * this.night})` : `rgba(30,50,110,${0.18 * this.night})`;
      ctx.fillRect(0, L.hudBottom - 10, this.w, this.h);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx);
    ctx.restore();
    for (const f of this.feathers) paintFeather(ctx, f.x, f.y, f.size, f.rot, Math.min(1, (f.dur - f.t) / 0.5));
    this.drawNotes();
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.strokeStyle = `${r.color}${(1 - k) * 0.9})`;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // the light of a Płomień, a dawn burst, Koszmar banished
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${this.flashColor}${0.55 * this.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    // the dawn: warm light from the window
    if (this.dawn > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, L.win.x + L.win.w / 2, L.win.y + L.win.h, Math.max(this.w, this.h) * 0.8, 'rgba(255,200,140,', 0.3 * this.dawn);
      ctx.restore();
    }
    this.hud.draw(sim);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(18,18,43,${this.fade})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // ── the room's cosy things ──────────────────────────────────────
  private drawItemsBack(): void {
    const ctx = this.ctx, L = this.L, S = this.S, has = (i: RoomItem) => this.items.includes(i);
    if (has('garland')) paintRoomItem(ctx, 'garland', L.cx, L.hudBottom + S * 0.35, Math.min(this.w * 0.42, S * 4), this.clock);
    if (has('nightlight')) paintRoomItem(ctx, 'nightlight', L.cx - 2.9 * S, L.floorY - 1.15 * S, 0.22 * S, this.clock);
    if (has('mobile')) {
      const mx = L.cx + 2.7 * S, my = Math.max(L.hudBottom + S * 0.6, L.floorY - 3.1 * S);
      ctx.strokeStyle = 'rgba(217,199,166,.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, L.hudBottom - 6);
      ctx.lineTo(mx, my - 0.42 * S);
      ctx.stroke();
      paintRoomItem(ctx, 'mobile', mx, my, 0.42 * S, this.clock);
    }
    // toys on the floor: a ball and two blocks
    ctx.fillStyle = '#c97b84';
    ctx.beginPath();
    ctx.arc(L.cx - 3.5 * S, L.floorY - 0.14 * S, 0.14 * S, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5f8f8b';
    ctx.fillRect(L.cx + 3.3 * S, L.floorY - 0.24 * S, 0.24 * S, 0.24 * S);
    ctx.fillStyle = '#e3b26a';
    ctx.fillRect(L.cx + 3.42 * S, L.floorY - 0.44 * S, 0.2 * S, 0.2 * S);
  }

  // ── the aura: the live gauge ────────────────────────────────────
  private drawAura(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const look = sim.auraLook, R = sim.auraR * S;
    const cx = L.cx, cy = L.floorY;
    const ry = 0.78;
    const dome = (r: number) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * ry, 0, Math.PI, TAU);
    };
    if (look === 'blind') return;
    const above = look === 'live' && sim.level >= 0.5;
    // the light inside
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const k = look === 'live' ? 0.22 + 0.25 * clamp(sim.level) : look === 'lamp' ? 0.2 : look === 'candle' ? 0.12 : 0.1;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(4, R));
    const col = look === 'lamp' ? '255,200,120' : look === 'grey' ? '200,200,210' : '255,236,180';
    g.addColorStop(0, `rgba(${col},${k})`);
    g.addColorStop(0.75, `rgba(${col},${k * 0.45})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    if (look === 'candle') return;
    // the threshold: a dotted dome where the level is 0.5 (in a Czuwanie)
    if (look !== 'lamp') {
      const mark = auraFor(0.5, sim.auraWide) * S;
      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = 'rgba(255,250,232,.7)';
      ctx.lineWidth = 1.6;
      dome(mark);
      ctx.stroke();
      ctx.setLineDash([]);
      // its label at the top right of the dotted dome
      ctx.font = font(750, 10 * u, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const lx = cx + Math.cos(-Math.PI / 4) * mark, ly = cy + Math.sin(-Math.PI / 4) * mark * ry;
      ctx.fillStyle = 'rgba(255,250,232,.85)';
      ctx.fillText(TXT.mark, lx + 5 * u, ly - 2 * u);
    }
    // the rim: gold beyond the threshold, pale below it, grey without signal, dashed while waiting
    ctx.strokeStyle = above ? '#ffd36b' : look === 'grey' ? 'rgba(190,190,205,.6)' : look === 'lamp' ? 'rgba(255,200,120,.7)' : 'rgba(255,250,232,.85)';
    ctx.lineWidth = above ? 3.5 : 2.2;
    if (look === 'wait') ctx.setLineDash([8, 6]);
    if (above) {
      ctx.shadowColor = 'rgba(255,211,107,.9)';
      ctx.shadowBlur = 14;
    }
    dome(R);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    // where the aura meets the floor: two bright feet
    ctx.fillStyle = above ? '#ffd36b' : 'rgba(255,250,232,.8)';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sd * R, cy + 1, 5 * u, 2.2 * u, 0, 0, TAU);
      ctx.fill();
    }
  }

  /** The strike's reach: soft marks on the floor at both sides. */
  private drawReach(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const reach = sim.reach;
    ctx.strokeStyle = 'rgba(255,244,214,.45)';
    ctx.lineWidth = 2;
    for (const sd of [-1, 1]) {
      const x = L.cx + sd * reach * S;
      ctx.beginPath();
      ctx.moveTo(x - sd * 6 * u, L.floorY + 6 * u);
      ctx.lineTo(x, L.floorY + 1);
      ctx.lineTo(x - sd * 6 * u, L.floorY - 4 * u);
      ctx.stroke();
    }
    // the band between the bed and the reach, faintly lit: where a strike lands
    const g = ctx.createLinearGradient(0, L.floorY - 3 * u, 0, L.floorY + 8 * u);
    g.addColorStop(0, 'rgba(255,244,214,0)');
    g.addColorStop(1, 'rgba(255,244,214,.12)');
    ctx.fillStyle = g;
    ctx.fillRect(L.cx - reach * S, L.floorY - 3 * u, reach * S * 2, 11 * u);
  }

  // ── the dream bubble: Sen, the lullaby's stars, the calm gauge ──
  private drawBubble(sim: AniolSim, head: { headX: number; headY: number }): void {
    const ctx = this.ctx, b = this.bubble, u = this.L.u;
    const pulse = 1 + 0.08 * this.senPulse * Math.sin(this.clock * 30) + 0.12 * ease.outBack(this.starPop) * this.starPop;
    const r = b.r * pulse;
    // little bubbles from the head
    ctx.fillStyle = 'rgba(200,214,255,.55)';
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) / 4;
      ctx.beginPath();
      ctx.arc(head.headX + (b.x - head.headX) * k - 4 * u, head.headY - 6 * u + (b.y + b.r - head.headY) * k, (2 + i * 1.6) * u, 0, TAU);
      ctx.fill();
    }
    // the bubble and the dream's light rising in it (Sen)
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.fillStyle = 'rgba(28,30,72,.85)';
    ctx.fill();
    ctx.clip();
    const lvl = clamp(this.senShown);
    const top = b.y + r - 2 * r * lvl;
    const g = ctx.createLinearGradient(0, top, 0, b.y + r);
    g.addColorStop(0, lvl < 0.3 ? 'rgba(150,140,190,.85)' : 'rgba(186,206,255,.95)');
    g.addColorStop(1, 'rgba(120,140,220,.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - r, top);
    for (let i = 0; i <= 12; i++) {
      const x = b.x - r + (2 * r * i) / 12;
      ctx.lineTo(x, top + Math.sin(this.clock * 2.5 + i * 0.9) * r * 0.05);
    }
    ctx.lineTo(b.x + r, b.y + r);
    ctx.lineTo(b.x - r, b.y + r);
    ctx.closePath();
    ctx.fill();
    // a little cloud and moon: what the child dreams
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.arc(b.x - r * 0.15, b.y + r * 0.2, r * 0.22, 0, TAU);
    ctx.arc(b.x + r * 0.12, b.y + r * 0.15, r * 0.27, 0, TAU);
    ctx.arc(b.x + r * 0.36, b.y + r * 0.24, r * 0.18, 0, TAU);
    ctx.fill();
    // the lullaby's stars
    const nStars = sim.restBlock ? sim.stars : 0;
    for (let i = 0; i < nStars; i++) {
      const a = i * 2.39996, rr = r * 0.62 * Math.sqrt((i + 0.5) / RULES.starMax);
      paintStar(ctx, b.x + Math.cos(a) * rr, b.y - r * 0.15 + Math.sin(a) * rr * 0.8, r * 0.12, 0.95, C.goldLight);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(220,228,255,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.stroke();
    // the calm gauge (in a lullaby): an arc around the bubble, a tick at the threshold
    if (sim.restBlock) {
      const rr = r + 6 * u;
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.lineWidth = 4 * u;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rr, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      const calm = sim.reliable ? clamp(sim.calm) : 0;
      ctx.strokeStyle = calm >= 0.5 ? C.calm : 'rgba(200,200,230,.6)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * calm);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,232,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + rr - 5 * u);
      ctx.lineTo(b.x, b.y + rr + 5 * u);
      ctx.stroke();
    }
    // the label and Sen's share
    ctx.font = font(800, 10 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,16,44,.7)';
    const label = `${TXT.sen} ${Math.round(lvl * 100)}%`;
    ctx.strokeText(label, b.x, b.y + r + (sim.restBlock ? 13 : 5) * u);
    ctx.fillStyle = lvl < 0.3 ? '#d7c8ff' : '#e6ecff';
    ctx.fillText(label, b.x, b.y + r + (sim.restBlock ? 13 : 5) * u);
  }

  // ── the Zmory ───────────────────────────────────────────────────
  private readonly pose: ZPose = { kind: 'mara', r: 0.3, side: 1, emerge: 1, hit: 0, armoured: false, crack: 0, burn: 0, inAura: false, t: 0, id: 0, fade: 0 };

  private drawZmory(sim: AniolSim): void {
    const ctx = this.ctx, S = this.S, p = this.pose;
    const list = sim.zmory.slice().sort((a, b) => b.d - a.d);
    for (const z of list) {
      const x = this.xOf(z.side, z.d), y = this.yOf(z.z);
      if (x < -S * 2 || x > this.w + S * 2) continue;
      p.kind = z.kind;
      p.r = z.r;
      p.side = z.side;
      p.emerge = clamp(z.age / RULES.emerge);
      p.hit = z.hitT;
      p.armoured = z.armoured;
      p.crack = z.armoured ? z.crack : z.kind === 'pancerna' ? 1 : 0;
      p.burn = z.maxHp > 0 ? z.burn / z.maxHp : 0;
      p.inAura = z.inAura;
      p.t = this.clock;
      p.id = z.id;
      p.fade = z.state === 'back' && z.kind !== 'koszmar' ? clamp((z.d - RULES.edge + 1.2) / 1.6) : 0;
      // squash on a hit, a stretch in the air
      const sq = z.hitT > 0 ? 1 + z.hitT * 1.2 : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 / Math.sqrt(sq), sq > 1 ? 1 / sq ** 0.3 : 1 + Math.min(0.15, z.z * 0.12));
      paintZmora(ctx, 0, 0, S * 1.2, p);
      ctx.restore();
      // a Koszmar's light left: small pips over it
      if (z.kind === 'koszmar' && z.state === 'walk') {
        const n = z.maxHp, left = Math.ceil(Math.max(0, z.hp));
        const w = Math.min(S * 2, n * 9 * this.L.u), y0 = y - z.r * S * 2.2;
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = i < left ? '#ff9a52' : 'rgba(255,255,255,.2)';
          ctx.beginPath();
          ctx.arc(x - w / 2 + (i + 0.5) * (w / n), y0, 2.6 * this.L.u, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  // ── the angel and the Płomień ───────────────────────────────────
  private readonly angelPose: AngelPose = { face: 1, swing: 0, beat: 0, open: 1, comfort: 0, sing: 0 };

  private drawAngel(sim: AniolSim): void {
    const ctx = this.ctx, S = this.S, u = this.L.u, p = this.angelPose;
    const ax = this.angelX + this.face * this.swing * S * 0.12, ay = this.angelY;
    p.face = this.face;
    p.swing = this.swing;
    p.beat = this.clock * (2.4 + 6 * this.swing);
    p.open = 0.75 + 0.25 * Math.sin(this.clock * 1.2) ** 2 + 0.2 * this.swing;
    p.comfort = this.comfort > 0 ? 1 : 0;
    p.sing = this.sing;
    paintAngel(ctx, ax, ay, S * 1.05, p);
    // the Płomień's ring around the angel: it fills with the hold
    const k = sim.flameCharge;
    if (k > 0.01 || sim.sighted) {
      const r = S * 1.18;
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.lineWidth = 3.5 * u;
      ctx.beginPath();
      ctx.arc(ax, ay - S * 0.25, r, 0, TAU);
      ctx.stroke();
      if (k > 0.01) {
        ctx.strokeStyle = k > 0.85 ? '#ffb347' : '#ffd36b';
        ctx.shadowColor = 'rgba(255,190,90,.9)';
        ctx.shadowBlur = 10 + 10 * k;
        ctx.beginPath();
        ctx.arc(ax, ay - S * 0.25, r, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
        ctx.shadowBlur = 0;
        const hx = ax + Math.cos(-Math.PI / 2 + TAU * k) * r, hy = ay - S * 0.25 + Math.sin(-Math.PI / 2 + TAU * k) * r;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, hx, hy, 12 * u, 'rgba(255,200,110,', 0.9);
        ctx.restore();
      }
      // its name on the ring's right shoulder
      ctx.font = font(800, 9.5 * u, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,16,44,.6)';
      const lx = ax + Math.cos(0.5) * r + 6 * u, ly = ay - S * 0.25 + Math.sin(0.5) * r;
      ctx.strokeText(TXT.flameLabel, lx, ly);
      ctx.fillStyle = k > 0.01 ? '#ffe2a0' : 'rgba(255,250,232,.6)';
      ctx.fillText(TXT.flameLabel, lx, ly);
    }
    // the wing shield, ready: a faint wing over the bed
    if (sim.shieldReady) {
      ctx.strokeStyle = 'rgba(255,250,235,.45)';
      ctx.lineWidth = 2;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(this.L.cx + sd * RULES.bedHalf * S, this.L.floorY - 0.2 * S, 0.5 * S, sd < 0 ? Math.PI * 0.7 : Math.PI * 1.85, sd < 0 ? Math.PI * 1.15 : Math.PI * 2.3);
        ctx.stroke();
      }
    }
  }

  /** The strikes: a crescent of light from the angel's hand down to the floor, out to the reach. */
  private drawSweeps(sim: AniolSim): void {
    const ctx = this.ctx, S = this.S, L = this.L, u = L.u;
    const ax = this.angelX, ay = this.angelY - S * 0.3;
    for (const s of this.sweeps) {
      const k = s.t / s.dur;
      const tx = L.cx + s.side * s.reach * S, ty = L.floorY - 0.3 * S;
      const R = Math.hypot(tx - ax, ty - ay);
      const end = Math.atan2(ty - ay, tx - ax);
      const span = 1.35;
      const startA = end - s.side * span;
      const sweepK = ease.outCubic(clamp(k / 0.4));
      const head = startA + (end - startA) * sweepK;
      const tail = startA + (end - startA) * clamp(sweepK - 0.55 - k * 0.5);
      const fade = 1 - clamp((k - 0.4) / 0.6);
      const thick = (s.hit ? 0.42 : 0.26) * S;
      // the crescent: thick at its head, tapering to the tail
      const n = 18;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = tail + ((head - tail) * i) / n;
        ctx.lineTo(ax + Math.cos(a) * R, ay + Math.sin(a) * R);
      }
      for (let i = n; i >= 0; i--) {
        const a = tail + ((head - tail) * i) / n;
        const w = thick * Math.sin((i / n) * Math.PI * 0.5) ** 1.5;
        ctx.lineTo(ax + Math.cos(a) * (R - w), ay + Math.sin(a) * (R - w));
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(ax, ay, Math.max(1, R - thick), ax, ay, R);
      g.addColorStop(0, 'rgba(255,214,140,0)');
      g.addColorStop(1, `rgba(255,244,214,${(s.hit ? 0.85 : 0.45) * fade})`);
      ctx.fillStyle = g;
      ctx.fill();
      // the bright edge
      ctx.strokeStyle = `rgba(255,252,240,${(s.hit ? 0.95 : 0.5) * fade})`;
      ctx.lineWidth = (s.hit ? 2.6 : 1.6) * u;
      ctx.beginPath();
      ctx.arc(ax, ay, R, Math.min(tail, head), Math.max(tail, head));
      ctx.stroke();
      // the light running along the floor to the reach (through the whole line with the spear)
      if (sweepK > 0.75) {
        const x0 = L.cx + s.side * RULES.bedHalf * S;
        const g2 = ctx.createLinearGradient(x0, 0, tx, 0);
        g2.addColorStop(0, 'rgba(255,240,200,0)');
        g2.addColorStop(1, `rgba(255,240,200,${(s.hit ? 0.5 : 0.22) * fade})`);
        ctx.fillStyle = g2;
        ctx.fillRect(Math.min(x0, tx), L.floorY - 0.45 * S, Math.abs(tx - x0), 0.4 * S);
        if (s.hit) glow(ctx, tx, L.floorY - 0.3 * S, 0.7 * S, C.light, 0.6 * fade);
      }
      ctx.restore();
    }
    void sim;
  }

  /** The warm-up's ghost hand: a pulsing arrow on the side whose Zmora is nearer, at the reach. */
  private drawHint(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const side = sim.nearerSide();
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 6);
    const x = L.cx + side * (sim.reach + 0.6) * S, y = L.floorY - 1.3 * S - pulse * 8 * u;
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.fillStyle = C.goldLight;
    ctx.beginPath();
    ctx.arc(x, y, 16 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.night;
    ctx.beginPath();
    ctx.moveTo(x + side * 7 * u, y);
    ctx.lineTo(x - side * 4 * u, y - 7 * u);
    ctx.lineTo(x - side * 4 * u, y + 7 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawNotes(): void {
    const ctx = this.ctx, u = this.L.u;
    ctx.fillStyle = C.goldLight;
    ctx.strokeStyle = C.goldLight;
    for (const o of this.notes) {
      const k = o.t / o.dur;
      const x = o.x + o.dx * k + Math.sin(o.t * 3) * 6 * u, y = o.y - 50 * u * k;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.5) * 0.85;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 * u, 3 * u, -0.4, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.4 * u;
      ctx.beginPath();
      ctx.moveTo(x + 3.6 * u, y);
      ctx.lineTo(x + 3.6 * u, y - 12 * u);
      ctx.quadraticCurveTo(x + 8 * u, y - 10 * u, x + 9 * u, y - 6 * u);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
