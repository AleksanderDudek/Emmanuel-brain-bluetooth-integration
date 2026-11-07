/**
 * Dolina's play view, all on the canvas: the valley of the shadow in parallax (the sky, the era's far
 * silhouettes, the things beside the road, the road with its pits, beams and lantern posts), the
 * shadows and the guardian, the fog of the dark with a hole of lamplight around the pilgrim — its
 * radius is the lamp's reach (the live gauge: a dotted ring marks the threshold, the rim turns gold
 * beyond it, the Świt's charge rings the lamp) — the pilgrim with his lamp and sword, Ćma fluttering
 * by the lamp with her speech bubble, slashes, hit-stop, motes, sparks and shake, and the HUD
 * (hud.ts) on top.  It only reads the sim (sim.ts); the calibration scene is intro.ts.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { passage } from '../kit/scripture';
import { eraName, guardName, type EraId } from './content';
import { Hud } from './hud';
import { sparks as sparksText, t } from './i18n';
import { DolinaIntro } from './intro';
import { layout, type Layout } from './layout';
import type { DolinaProgress } from './meta';
import {
  C, PAL, SANS, TAU, font, glow, mixPal, paintBeam, paintBrick, paintEyes, paintFar, paintGuard, paintMid, paintMoth, paintPilgrim,
  paintPit, paintPost, paintRoad, paintShadow, paintSky, type Palette, type Scene,
} from './paint';
import { LAMP_MARK, RULES, above, type DolinaSim, type SimEvent } from './sim';

const TXT = {
  clink: t('fx.clink'), shield: t('fx.shield'), pit: t('fx.pit'), beam: t('fx.beam'), near: t('fx.near'), parry: t('fx.parry'),
  dawn: t('fx.dawn'), dawnSub: t('fx.dawnSub'), flash: t('fx.flash'), fall: t('fx.fall'), burst: t('fx.burst'), burstWait: t('fx.burstWait'),
  drop: t('fx.drop'), pull: t('fx.pull'), mark: t('mark'), open: t('gd.open'), gate: t('gate.title'), gateText: t('gate.text'),
  story: t('story.title'), storyText: t('story.text'), reach: t('hud.reach'),
};

interface Ring { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
interface Slash { t: number; dur: number; reach: number; y: number }
interface Ghost { kind: string; x: number; y: number; t: number; id: number }

export class DolinaView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new DolinaIntro();
  private clock = 0;
  private started = false;
  private readonly parts = new Particles(700);
  private readonly rings: Ring[] = [];
  private readonly slashes: Slash[] = [];
  private readonly ghosts: Ghost[] = [];
  private readonly shake: Shake;
  private readonly rnd = Math.random;
  private readonly seen = new Set<string>();
  // the pilgrim's animation
  private runPh = 0;
  private lampUp = 0;
  private fallK = 0;
  private flash = 0;
  private flashColor = 'rgba(255,236,190,';
  private fade = 0;
  // the scene
  private palFrom: Palette = PAL.babel;
  private palTo: Palette = PAL.babel;
  private palK = 1;
  private scene: Scene = 'babel';
  private meadow = 0;
  private dawnK = 0;
  private lampShown: number = RULES.flame;
  private moth = { x: 0, y: 0, vx: 0, vy: 0 };
  private mothFace = 1;
  private bubbleA = 0;
  private bubbleText = '';
  private wow = 0;

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

  start(sim: DolinaSim): void {
    this.started = true;
    this.fade = 1;
    this.scene = sim.era;
    this.palFrom = this.palTo = PAL[sim.era];
    this.moth = { x: this.L.runX + this.L.S, y: this.L.floorY - this.L.S * 1.8, vx: 0, vy: 0 };
    if (sim.session === 1) this.hud.story(TXT.story, TXT.storyText, RULES.storySec, 'psa23.4');
    else this.hud.story(eraName(sim.era), t(`era.${sim.era}.text`), 3.2);
  }

  intro(dt: number, p: number, progress: DolinaProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── the valley's points ─────────────────────────────────────────
  private get S(): number { return this.L.S; }
  /** a world x (u) on screen, against the pilgrim */
  private sx(x: number, sim: DolinaSim): number { return this.L.runX + (x - sim.px) * this.S; }
  private sy(y: number): number { return this.L.floorY - y * this.S; }
  /** where the lamp's light sits (px) */
  private lampAt(sim: DolinaSim): { x: number; y: number } {
    const S = this.S;
    const slide = sim.sliding ? 0.35 : 0;
    return { x: this.L.runX + S * 0.5, y: this.sy(sim.py + 0.7 - slide) };
  }

  /** A card is up over the valley (Ćma waits for it). */
  get busy(): boolean { return this.hud.cardUp; }

  /** What a tap does by where it lands: the left third of the valley raises the lamp, the rest slashes. */
  zoneAt(x: number): 'lamp' | 'slash' {
    const x0 = this.L.x0, k = (x - x0) / Math.max(1, this.w - x0);
    return k < 1 / 3 ? 'lamp' : 'slash';
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: DolinaSim): void {
    const u = this.L.u, rm = this.opts.reducedMotion, S = this.S;
    switch (e.type) {
      case 'spawn': {
        const key = `s.${e.kind}`;
        if (!this.seen.has(key) && e.kind !== 'glinianek') {
          this.seen.add(key);
          if (sim.session <= 3) this.hud.float(t(`sh.${e.kind}` as 'sh.kruk'), this.L.runX + 4 * S, this.sy(2.6), '#ffd9b0', 13, 2.6, 16);
        }
        break;
      }
      case 'pop':
        this.rings.push({ x: this.sx(e.x, sim), y: this.sy(e.y + 0.3), t: 0, dur: 0.3, r0: 4 * u, r1: 30 * u, color: 'rgba(111,227,232,', width: 3 });
        break;
      case 'slash':
        this.slashes.push({ t: 0, dur: RULES.slashSec, reach: e.reach, y: sim.py });
        if (this.slashes.length > 4) this.slashes.shift();
        break;
      case 'hit': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.parts.burst(x, y, rm ? 5 : 14, { color: '#fff4d6', size: 2.4 * u, speed: 260 * u, g: 300, drag: 3, life: 0.35, shape: 'spark', angle: 0, spread: 2.2, rnd: this.rnd });
        this.shake.add(0.1);
        break;
      }
      case 'clink': {
        const x = e.guard ? this.L.runX + (sim.guard ? sim.guard.rel : 1) * S : this.sx(e.x, sim), y = this.sy(e.y);
        this.parts.burst(x, y, rm ? 4 : 12, { color: '#d9dce6', size: 2 * u, speed: 240 * u, g: 500, drag: 2, life: 0.35, shape: 'spark', rnd: this.rnd });
        this.hud.float(TXT.clink, x, y - 24 * u, '#d9dce6', 13, 0.7, 20);
        this.shake.add(0.12);
        break;
      }
      case 'shieldBreak': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.parts.burst(x, y, rm ? 5 : 16, { color: '#6a6278', size: 3 * u, speed: 200 * u, g: 600, drag: 1.5, life: 0.7, shape: 'square', rnd: this.rnd });
        this.hud.float(TXT.shield, x, y - 30 * u, C.goldLight, 15, 1, 24);
        break;
      }
      case 'kill': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        if (e.via === 'touch' || e.via === 'fade') {
          this.parts.burst(x, y, rm ? 3 : 10, { color: '#2e2540', size: 4 * u, speed: 60 * u, g: -40, drag: 2.5, life: 0.6, rnd: this.rnd });
          break;
        }
        // the ink bursts into motes of light that rise
        this.parts.burst(x, y, rm ? 8 : 26, { color: '#fff7dc', size: 2.6 * u, speed: 160 * u, g: -90, drag: 2.2, life: 1, rnd: this.rnd });
        this.parts.burst(x, y, rm ? 4 : 12, { color: C.gold, size: 2.2 * u, speed: 220 * u, g: -40, drag: 2.5, life: 0.8, shape: 'spark', rnd: this.rnd });
        this.parts.burst(x, y, rm ? 2 : 6, { color: '#3a2f52', size: 4 * u, speed: 70 * u, g: -30, drag: 3, life: 0.5, rnd: this.rnd });
        this.rings.push({ x, y, t: 0, dur: 0.35, r0: 8 * u, r1: 50 * u, color: 'rgba(255,240,190,', width: 3 });
        this.ghosts.push({ kind: e.kind, x: e.x, y: e.y, t: 0, id: e.id });
        if (e.sparks > 0 && e.via !== 'dawn') this.hud.float(`+${e.sparks} ✦`, x, y - 22 * u, C.goldLight, e.combo >= 8 ? 15 : 13, 0.8, 30);
        this.hud.popSparks();
        this.shake.add(e.via === 'slash' ? 0.14 : 0.06);
        break;
      }
      case 'throw':
        this.hud.float('!', this.sx(e.x, sim), this.sy(1.8), '#ffb070', 14, 0.5, 10);
        break;
      case 'shotBreak': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        const col = e.kind === 'pling' ? '#6fe3e8' : '#a65a3a';
        this.parts.burst(x, y, rm ? 4 : 12, { color: col, size: 2.6 * u, speed: e.via === 'ground' ? 90 * u : 220 * u, g: 600, drag: 1.5, life: 0.55, shape: 'square', rnd: this.rnd });
        if (e.via === 'slash') {
          this.rings.push({ x, y, t: 0, dur: 0.25, r0: 5 * u, r1: 30 * u, color: 'rgba(255,240,200,', width: 3 });
          this.shake.add(0.08);
        }
        break;
      }
      case 'harm': {
        const x = this.L.runX, y = this.sy(sim.py + 0.6);
        this.parts.burst(x, y, rm ? 4 : 14, { color: '#e8a25a', size: 2.5 * u, speed: 160 * u, g: 400, drag: 2, life: 0.6, rnd: this.rnd });
        this.hud.float(e.kind === 'beam' ? TXT.beam : `−${Math.round(RULES.harm[e.kind] * 100)}%`, x, y - 30 * u, '#ffb08a', 14, 0.8, 22);
        this.hud.pulseOil();
        this.flashOn(0.25, 'rgba(255,120,80,');
        this.shake.add(0.3);
        if (e.kind === 'scroll') this.hud.float(TXT.pull, x + 40 * u, y - 50 * u, '#6fe3e8', 14, 1, 20);
        break;
      }
      case 'pit':
        this.hud.float(TXT.pit, this.L.runX, this.sy(1), '#e8d0b0', 13, 0.9, 16);
        this.shake.add(0.2);
        break;
      case 'climb':
        this.parts.burst(this.L.runX, this.L.floorY, rm ? 3 : 10, { color: '#8a6a5a', size: 2.5 * u, speed: 90 * u, g: 300, drag: 2, life: 0.5, rnd: this.rnd });
        break;
      case 'jump':
        this.parts.burst(this.L.runX, this.L.floorY, rm ? 2 : 6, { color: '#8a7a70', size: 2 * u, speed: 70 * u, angle: -Math.PI / 2, spread: 1.6, g: 200, drag: 3, life: 0.4, rnd: this.rnd });
        break;
      case 'land':
        this.parts.burst(this.L.runX, this.L.floorY, rm ? 2 : 7, { color: '#8a7a70', size: 2 * u, speed: 90 * u, angle: -Math.PI / 2, spread: 2.6, g: 300, drag: 3, life: 0.35, rnd: this.rnd });
        break;
      case 'slide':
        this.parts.burst(this.L.runX + 0.3 * S, this.L.floorY, rm ? 3 : 9, { color: '#8a7a70', size: 2 * u, speed: 120 * u, angle: Math.PI, spread: 0.9, g: 200, drag: 2.5, life: 0.4, rnd: this.rnd });
        break;
      case 'dodge':
        if (e.near) this.hud.float(TXT.near, this.L.runX + 0.5 * S, this.sy(2.2), C.goldLight, 15, 0.9, 22);
        break;
      case 'burst': {
        if (!e.ready) {
          this.hud.float(TXT.burstWait, this.L.runX, this.sy(2.4), '#d9cfe8', 12, 0.8, 14);
          break;
        }
        this.lampUp = 1;
        const l = this.lampAt(sim);
        this.rings.push({ x: l.x, y: l.y, t: 0, dur: 0.45, r0: 6 * u, r1: RULES.burstReach * S, color: 'rgba(255,236,170,', width: 5 });
        this.flashOn(0.35);
        this.hud.float(TXT.burst, l.x + 30 * u, l.y - 30 * u, C.goldLight, 15, 0.7, 20);
        break;
      }
      case 'combo':
        this.hud.float(t('fx.combo', { n: e.mult }), this.L.runX + S, this.sy(2.8), e.mult >= 3 ? '#ffb070' : C.goldLight, 22, 1.2, 34);
        this.rings.push({ x: this.L.runX, y: this.sy(1), t: 0, dur: 0.5, r0: S * 0.5, r1: S * 2, color: 'rgba(255,214,120,', width: 4 });
        break;
      case 'dawn': {
        const l = this.lampAt(sim);
        this.flashOn(1);
        this.wow = 2;
        this.rings.push({ x: l.x, y: l.y, t: 0, dur: 0.9, r0: S * 0.6, r1: Math.hypot(this.w, this.h), color: 'rgba(255,214,120,', width: 10 });
        this.hud.toast(TXT.dawn, e.guard ? t('fx.dawnGuard', { n: t('lag', { n: RULES.dawnOpen }) }) : TXT.dawnSub, C.goldDeep);
        this.shake.add(0.5);
        break;
      }
      case 'flash': {
        const l = this.lampAt(sim);
        this.rings.push({ x: l.x, y: l.y, t: 0, dur: RULES.flashSec, r0: S * 0.5, r1: e.r * S, color: 'rgba(255,220,150,', width: 8 });
        this.flashOn(0.4 + 0.5 * e.share);
        this.hud.float(TXT.flash, this.L.runX + 2 * S, this.sy(3), '#e0d4ff', 17, 1.6, 30);
        this.shake.add(0.25);
        break;
      }
      case 'fall': {
        const p = passage('mic7.8');
        this.hud.toast(TXT.fall, t('fx.fallSub', { ref: p.ref }), C.calmDeep, 3);
        this.shake.add(0.35);
        break;
      }
      case 'rise':
        this.rings.push({ x: this.L.runX, y: this.sy(0.8), t: 0, dur: 0.8, r0: S * 0.3, r1: S * 3, color: 'rgba(255,220,160,', width: 4 });
        this.parts.burst(this.L.runX, this.sy(0.8), rm ? 6 : 20, { color: C.goldLight, size: 2.2 * u, speed: 120 * u, g: -60, drag: 2, life: 0.9, rnd: this.rnd });
        break;
      case 'drop': {
        const l = this.lampAt(sim);
        this.parts.burst(l.x, l.y - S * 0.8, rm ? 2 : 6, { color: '#ffe0a0', size: 2.4 * u, speed: 40 * u, g: 200, drag: 1, life: 0.6, rnd: this.rnd });
        this.hud.float(`+${RULES.dropSparks} ✦`, l.x + 20 * u, l.y - S * 0.9, '#ffe0a0', 12, 0.9, 20);
        this.hud.pulseOil();
        break;
      }
      case 'chime': {
        const l = this.lampAt(sim);
        this.parts.burst(l.x, l.y, rm ? 2 : 6, { color: C.goldLight, size: 1.8 * u, speed: 60 * u, g: -40, drag: 2, life: 0.8, rnd: this.rnd });
        this.moth.vy -= 220 * u;
        break;
      }
      case 'restPass':
        this.hud.toast(t('card.rest.pass'), t('card.restPass', { sparks: sparksText(e.sparks) }), C.calmDeep);
        break;
      case 'pushPass':
        this.hud.toast(t('card.push.pass'), t('card.pushPass', { sparks: sparksText(e.sparks) }), C.goldDeep);
        break;
      case 'blockStart':
        if (e.block.kind === 'rest') this.rings.push({ x: this.L.runX, y: this.sy(0.6), t: 0, dur: 1.4, r0: S, r1: S * 9, color: 'rgba(170,220,210,', width: 5 });
        break;
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(sim, e.block.kind, e.block.blind, e.verdict, e.share, e.need, e.t0, e.t1, e.drops);
        break;
      case 'guard': {
        const name = guardName(e.id);
        const gx = this.L.runX + (sim.guard ? sim.guard.rel : 2) * S + S;
        if (e.what === 'come') {
          this.hud.toast(t('gd.come', { name }), t(`gd.sub.${e.id}`), '#8a4a3a', 3.4);
          this.shake.add(0.3);
        } else if (e.what === 'angry') {
          this.hud.float(t('gd.angry', { name }), gx, this.sy(3.4), '#ffb08a', 16, 1.4, 20);
          this.shake.add(0.3);
        } else if (e.what === 'open') {
          this.rings.push({ x: gx, y: this.sy(1.6), t: 0, dur: 0.5, r0: S * 0.3, r1: S * 1.8, color: 'rgba(255,211,107,', width: 5 });
        } else if (e.what === 'beaten') {
          this.flashOn(0.9);
          this.wow = 2;
          for (let i = 0; i < 4; i++) this.parts.burst(gx, this.sy(0.6 + i * 0.7), rm ? 6 : 30, { color: i % 2 ? '#fff7dc' : C.gold, size: 3 * u, speed: 260 * u, g: -80, drag: 2, life: 1.5, rnd: this.rnd });
          this.rings.push({ x: gx, y: this.sy(1.5), t: 0, dur: 1, r0: S * 0.5, r1: S * 7, color: 'rgba(255,240,190,', width: 7 });
          this.hud.toast(t('gd.beaten', { name }), `+${sparksText(RULES.guardSparks * Math.max(1, sim.lap))}`, C.goldDeep, 2.4);
          this.shake.add(0.7);
        } else if (e.what === 'leave') this.hud.toast(t('gd.leave', { name }), '', C.calmDeep);
        break;
      }
      case 'guardHit': {
        if (e.via !== 'slash') break;
        const gx = this.L.runX + (sim.guard ? sim.guard.rel : 1) * S + S * 0.4;
        this.parts.burst(gx, this.sy(1.6), rm ? 6 : 20, { color: C.gold, size: 2.6 * u, speed: 260 * u, g: 200, drag: 2.5, life: 0.6, shape: 'spark', rnd: this.rnd });
        this.rings.push({ x: gx, y: this.sy(1.6), t: 0, dur: 0.3, r0: 8 * u, r1: 60 * u, color: 'rgba(255,230,160,', width: 4 });
        this.hud.float(`${e.combo}`, gx + 20 * u, this.sy(2.4), C.goldLight, 16, 0.6, 20);
        this.shake.add(0.2);
        break;
      }
      case 'parry': {
        const x = this.L.runX + S * 0.9;
        this.hud.float(TXT.parry, x, this.sy(2.3), '#e8f0ff', 16, 0.9, 22);
        this.flashOn(0.2, 'rgba(220,230,255,');
        break;
      }
      case 'era':
        this.setScene(e.era);
        this.hud.story(eraName(e.era), t(`era.${e.era}.text`), 3.2);
        break;
      case 'gate':
        this.hud.story(TXT.gate, TXT.gateText, 3.6, '1pe2.9');
        this.flashOn(0.8, 'rgba(255,214,170,');
        break;
      case 'post':
        if (e.lit === 'gold') this.rings.push({ x: this.sx(e.x + 0.3, sim), y: this.sy(1.68), t: 0, dur: 0.5, r0: 4 * u, r1: 26 * u, color: 'rgba(255,214,120,', width: 3 });
        break;
      case 'dayGift':
        this.hud.toast(t('card.dayGift', { sparks: sparksText(e.n) }), '', C.goldDeep);
        break;
      case 'look':
        this.hud.toast(t('card.look', { name: t(`look.${e.look}` as 'look.0') }), '', C.goldDeep);
        break;
      default:
        break;
    }
  }

  private setScene(era: EraId): void {
    this.palFrom = mixPal(this.palFrom, this.palTo, this.palK);
    this.palTo = PAL[era];
    this.palK = 0;
    this.scene = era;
  }

  private flashOn(a: number, color = 'rgba(255,236,190,'): void {
    if (this.opts.reducedMotion) a *= 0.4;
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: DolinaSim): void {
    this.clock += dt;
    this.parts.update(dt);
    let n = 0;
    for (const r of this.rings) if ((r.t += dt) < r.dur) this.rings[n++] = r;
    this.rings.length = n;
    n = 0;
    for (const s of this.slashes) if ((s.t += dt) < s.dur) this.slashes[n++] = s;
    this.slashes.length = n;
    n = 0;
    for (const g of this.ghosts) if ((g.t += dt) < 0.45) this.ghosts[n++] = g;
    this.ghosts.length = n;
    this.runPh += dt * (sim.speed * 2.1) * (sim.timeScale || 0);
    this.lampUp = Math.max(0, this.lampUp - dt * 2.5);
    this.fallK = approach(this.fallK, sim.state === 'fallen' && sim.stateT < RULES.fallSec - 0.4 ? 1 : 0, dt, 0.12);
    if (this.fallK < 0.01) this.fallK = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.fade = Math.max(0, this.fade - dt * 1.5);
    this.wow = Math.max(0, this.wow - dt);
    this.palK = Math.min(1, this.palK + dt / 2);
    this.meadow = approach(this.meadow, sim.restBlock ? 1 : 0, dt, 0.9);
    this.dawnK = approach(this.dawnK, sim.phase !== 'play' ? 1 : 0, dt, 1.4);
    this.lampShown = approach(this.lampShown, sim.lampR, dt, 0.08);
    // Ćma flutters by the lamp, sits by it in the meadow, darts to it on a Świt
    const l = this.lampAt(sim), S = this.S;
    const tx = l.x + S * (0.55 + 0.35 * Math.sin(this.clock * 1.7)), ty = l.y - S * (0.75 + 0.25 * Math.cos(this.clock * 2.3)) - (this.meadow > 0.5 ? -S * 0.2 : 0);
    const k = this.opts.reducedMotion ? 4 : 9;
    this.moth.vx += ((tx - this.moth.x) * k - this.moth.vx * 3.2) * dt;
    this.moth.vy += ((ty - this.moth.y) * k - this.moth.vy * 3.2) * dt;
    this.moth.x += this.moth.vx * dt;
    this.moth.y += this.moth.vy * dt;
    if (Math.abs(this.moth.vx) > 20) this.mothFace = this.moth.vx > 0 ? 1 : -1;
    // her line
    const line = sim.talk.current;
    if (line && !this.hud.storyUp) this.bubbleText = line.text;
    this.bubbleA = approach(this.bubbleA, line && !this.hud.storyUp && line.t < line.dur - 0.15 ? 1 : 0, dt, 0.07);
    // meadow fireflies
    if (this.meadow > 0.5 && this.rnd() < dt * 3) {
      this.parts.burst(this.L.x0 + this.rnd() * (this.w - this.L.x0), this.L.floorY - this.rnd() * S * 2.5, 1, { color: '#e8f5a0', size: 1.6 * this.L.u, speed: 12, g: -6, drag: 0.5, life: 2.2, rnd: this.rnd });
    }
    this.hud.update(dt, sim);
  }

  draw(sim: DolinaSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pal = mixPal(mixPal(mixPal(this.palFrom, this.palTo, ease.inOutSine(this.palK)), PAL.meadow, this.meadow), PAL.dawn, this.dawnK);
    const farScene: Scene = this.dawnK > 0.6 ? 'dawn' : this.meadow > 0.5 ? 'meadow' : this.scene;
    // the sky and the far valley stay still under the shake; the road and its things shake
    paintSky(ctx, this.w, this.h, L.floorY, pal, this.clock, this.meadow * (1 - this.dawnK), this.dawnK);
    ctx.save();
    if (L.x0 > 0) {
      ctx.beginPath();
      ctx.rect(L.x0 - 8, 0, this.w, this.h);
      ctx.clip();
    }
    const px = sim.px * S;
    paintFar(ctx, farScene, this.w, L.floorY - S * 0.1, S * 0.8, px * 0.15, this.clock, pal, 1);
    paintMid(ctx, farScene, this.w, L.floorY, S, px * 0.5, this.clock, pal, 0.95);
    const off = this.shake.offset(1 / 60, 8);
    ctx.translate(off.x, off.y);
    paintRoad(ctx, this.w, this.h, L.floorY, S, px, pal, this.meadow, this.clock);
    // the road's things
    for (const f of sim.features) {
      const x0 = this.sx(f.x0, sim), x1 = this.sx(f.x1, sim);
      if (x1 < L.x0 - 40 || x0 > this.w + 40) continue;
      if (f.kind === 'pit') paintPit(ctx, x0, x1, L.floorY, this.h, S);
    }
    for (const p of sim.posts) {
      const x = this.sx(p.x, sim);
      if (x > L.x0 - 30 && x < this.w + 30) paintPost(ctx, x, L.floorY, S, p.lit, this.clock);
    }
    const nextPostX = this.sx(Math.ceil((sim.px + 0.01) / RULES.postEvery) * RULES.postEvery, sim);
    if (nextPostX < this.w + 30) paintPost(ctx, nextPostX, L.floorY, S, 'none', this.clock);
    for (const f of sim.features) {
      if (f.kind !== 'beam') continue;
      const x0 = this.sx(f.x0, sim), x1 = this.sx(f.x1, sim);
      if (x1 < L.x0 - 40 || x0 > this.w + 40) continue;
      paintBeam(ctx, x0, x1 - x0, L.floorY, S, RULES.beamLow, this.scene, f.hit);
    }
    // the shadows, the bricks
    this.drawShadows(sim, false);
    this.drawShots(sim);
    // the dark beyond the lamp's reach, then what always shows through it
    this.drawFog(sim, pal);
    this.drawGuard(sim);
    this.drawShadows(sim, true);
    this.drawTelegraphs(sim);
    this.drawGauge(sim);
    // the pilgrim, his slash and Ćma
    const lamp = paintPilgrim(ctx, L.runX, this.sy(Math.max(-1.2, sim.py)), S, {
      look: sim.look, run: this.runPh, pace: clamp(sim.speed / RULES.run), air: !sim.grounded && sim.state === 'run', slide: sim.sliding ? 1 : 0,
      fall: this.fallK, slash: this.slashes.length ? clamp(this.slashes[this.slashes.length - 1].t / RULES.slashSec) : -1, lampUp: this.lampUp,
      flicker: sim.oil < 0.3 ? 1 - sim.oil / 0.3 : 0,
    });
    this.drawDawnRing(sim, lamp);
    this.drawSlashes(sim);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx);
    ctx.restore();
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.strokeStyle = `${r.color}${(1 - k) * 0.9})`;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), 0, TAU);
      ctx.stroke();
    }
    const mood = this.wow > 0 ? 'wow' : this.meadow > 0.7 && sim.calm > 0.6 ? 'sleep' : sim.live && sim.level < 0.35 ? 'sulk' : 'happy';
    paintMoth(ctx, this.moth.x, this.moth.y, S * 0.3, this.clock, mood, this.mothFace);
    ctx.restore();
    // the light of a Świt, a lifted mist, a guardian's fall
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${this.flashColor}${0.5 * this.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    this.hud.drawRidge(sim, this.dawnK);
    this.hud.draw(sim);
    this.hud.bubble(this.bubbleText, this.moth.x, this.moth.y - S * 0.15, this.bubbleA);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(22,19,31,${this.fade})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    void u;
  }

  // ── the shadows ─────────────────────────────────────────────────
  /** The shadows' bodies (under the fog) or only their eyes and outlines (over it). */
  private drawShadows(sim: DolinaSim, over: boolean): void {
    const ctx = this.ctx, S = this.S, L = this.L;
    for (const s of sim.shadows) {
      if (s.state !== 'walk') continue;
      const x = this.sx(s.x, sim);
      if (x < L.x0 - 40 || x > this.w + 40) continue;
      const yBase = this.sy(s.y);
      if (!over) {
        paintShadow(ctx, x, s.kind === 'pling' ? this.sy(s.y + s.h) : s.kind === 'kruk' ? this.sy(s.y + 0.4) : yBase, S, {
          kind: s.kind, t: this.clock, id: s.id, hit: s.hitT, stun: s.stun, inLight: s.inLight, shield: s.shield, crack: s.crack, dive: s.dive, fade: 0,
          pop: s.kind === 'pling' ? clamp(s.age / 0.25) : 1,
        });
      } else if (!s.inLight && Math.abs(s.x - sim.px) > this.lampShown) {
        // beyond the light: a faint outline and the ember eyes, never a trap
        ctx.strokeStyle = 'rgba(255,190,140,.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, yBase - s.h * S * 0.5, s.r * S, s.h * S * 0.55, 0, 0, TAU);
        ctx.stroke();
        if (s.kind !== 'kruk') paintEyes(ctx, x - S * 0.1, yBase - s.h * S * 0.68, S * 0.05, this.clock, s.id, s.stun);
      }
    }
    if (over) return;
    // the dissolving ones
    for (const g of this.ghosts) {
      const x = this.sx(g.x, sim);
      paintShadow(ctx, x, this.sy(g.y) + S * 0.45, S, {
        kind: g.kind as never, t: this.clock, id: g.id, hit: 0.1, stun: 0, inLight: true, shield: false, crack: 0, dive: 0, fade: clamp(g.t / 0.45), pop: 1,
      });
    }
  }

  private drawShots(sim: DolinaSim): void {
    const ctx = this.ctx, S = this.S;
    for (const s of sim.shots) {
      const x = this.sx(s.x, sim), y = this.sy(s.y);
      if (s.kind === 'pling') {
        paintShadow(ctx, x, y - s.r * S, S * 0.85, { kind: 'pling', t: this.clock, id: s.id, hit: 0, stun: 0, inLight: false, shield: false, crack: 0, dive: 0, fade: 0, pop: clamp(s.t / 0.25) });
        continue;
      }
      if (s.kind === 'rain' && s.wait > 0) {
        // the falling brick's telegraph: its shadow on the road grows and pulses
        const k = 1 - s.wait / RULES.moves.rain.tele;
        ctx.fillStyle = `rgba(10,6,14,${0.25 + 0.35 * k})`;
        ctx.beginPath();
        ctx.ellipse(x, this.L.floorY + 2, S * (0.15 + 0.3 * k), S * 0.08, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,190,120,${0.4 + 0.5 * Math.abs(Math.sin(this.clock * 12))})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, this.L.floorY + 2, S * 0.45, S * 0.12, 0, 0, TAU);
        ctx.stroke();
      }
      paintBrick(ctx, x, y, s.r * S, s.kind === 'roll' ? -s.t * 12 : s.t * 6);
    }
  }

  private drawGuard(sim: DolinaSim): void {
    const g = sim.guard;
    if (!g) return;
    const S = this.S;
    const x = this.L.runX + g.rel * S;
    const mv = sim.move;
    const spec = mv ? RULES.moves[mv] : null;
    const teleK = mv && spec && spec.tele > 0 && !g.acted ? clamp(g.moveT / spec.tele) : 0;
    paintGuard(this.ctx, x, this.L.floorY, S, {
      id: g.id, t: this.clock, open: sim.guardOpen, tele: g.acted ? null : mv, teleK, hit: g.hitT, angry: g.angry,
      fade: g.state === 'beaten' ? clamp(g.st / 1.2) : g.state === 'leave' ? clamp(g.st / 1.2) : 0,
    });
  }

  /** The guardian's tells over the fog: the heavy blow's line on the road, the beam's line at head height. */
  private drawTelegraphs(sim: DolinaSim): void {
    const g = sim.guard;
    if (!g || g.state !== 'fight') return;
    const ctx = this.ctx, S = this.S, L = this.L;
    const mv = g.seq[g.i];
    const spec = RULES.moves[mv];
    const k = spec.tele > 0 ? clamp(g.moveT / spec.tele) : 1;
    const gx = L.runX + g.rel * S;
    if ((mv === 'heavy' || mv === 'sweep') && (!g.acted || g.sweep > 0)) {
      const y = mv === 'heavy' ? L.floorY - S * 0.12 : this.sy(1.0);
      const live = g.sweep > 0;
      ctx.strokeStyle = live ? (mv === 'heavy' ? 'rgba(255,90,60,.95)' : 'rgba(111,227,232,.95)') : mv === 'heavy' ? `rgba(255,90,60,${0.3 + 0.5 * k})` : `rgba(111,227,232,${0.3 + 0.5 * k})`;
      ctx.lineWidth = live ? S * 0.22 : Math.max(2, S * 0.05);
      ctx.setLineDash(live ? [] : [S * 0.2, S * 0.12]);
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(L.runX - S * 1.4, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (mv === 'strike' && !g.acted && k > 0.4) {
      ctx.fillStyle = `rgba(255,240,200,${k})`;
      ctx.font = font(900, 20 * L.u * (0.8 + 0.4 * k), SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', gx + S * 0.3, this.sy(3.6));
    }
  }

  /** The dark beyond the lamp: a fog with a hole of light around the lamp (lighter in the meadow, gone at dawn). */
  private drawFog(sim: DolinaSim, pal: Palette): void {
    const ctx = this.ctx, L = this.L, S = this.S;
    const dark = 0.78 * (1 - 0.6 * this.meadow) * (1 - this.dawnK);
    if (dark < 0.02) return;
    const l = this.lampAt(sim);
    const r = Math.max(S * 0.8, this.lampShown * S);
    const f = pal.fog;
    const g = ctx.createRadialGradient(l.x, l.y, r * 0.55, l.x, l.y, r * 1.18);
    g.addColorStop(0, `rgba(${f[0]},${f[1]},${f[2]},0)`);
    g.addColorStop(0.75, `rgba(${f[0]},${f[1]},${f[2]},${dark * 0.55})`);
    g.addColorStop(1, `rgba(${f[0]},${f[1]},${f[2]},${dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(L.x0 - 20, 0, this.w + 40, this.h + 20);
    // the warm pool of lamplight
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, l.x, l.y, r * 1.05, 'rgba(255,190,110,', 0.16 + 0.1 * (sim.live ? above(sim.level) : 0));
    ctx.restore();
  }

  /** The live gauge: the light's rim (gold beyond the threshold) and the dotted ring at the threshold. */
  private drawGauge(sim: DolinaSim): void {
    const look = sim.lampLook;
    if (look === 'flame' || look === 'blind') return;
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const l = this.lampAt(sim);
    const R = this.lampShown * S, mark = (LAMP_MARK + sim.ups.lamp * RULES.lampStep) * S;
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.x0, L.sceneTop - 4, this.w - L.x0, L.floorY - L.sceneTop + 4);
    ctx.clip();
    // the threshold: dotted
    ctx.setLineDash([3 * u, 6 * u]);
    ctx.strokeStyle = look === 'live' ? 'rgba(255,246,220,.7)' : 'rgba(255,246,220,.35)';
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.arc(l.x, l.y, mark, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // the rim: gold beyond the threshold, grey while it waits or has no signal
    const over = look === 'live' && sim.level >= 0.5;
    ctx.strokeStyle = look === 'grey' ? 'rgba(180,176,190,.6)' : look === 'wait' ? 'rgba(255,236,190,.45)' : over ? '#ffd36b' : 'rgba(255,236,190,.75)';
    ctx.lineWidth = (over ? 3.5 : 2) * u;
    if (over) {
      ctx.shadowColor = 'rgba(255,200,90,.8)';
      ctx.shadowBlur = 12 * u;
    }
    ctx.beginPath();
    ctx.arc(l.x, l.y, R, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // the labels: the threshold's name on its ring, the reach on the rim, up and ahead of the lamp
    ctx.font = font(800, 10 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ang = -Math.PI / 4;
    const mx = l.x + Math.cos(ang) * mark, my = l.y + Math.sin(ang) * mark;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,14,26,.8)';
    ctx.strokeText(TXT.mark, mx, my);
    ctx.fillStyle = 'rgba(255,246,220,.9)';
    ctx.fillText(TXT.mark, mx, my);
    const pct = `${TXT.reach} ${Math.round(clamp(sim.level) * 100)}%`;
    const rx = l.x + Math.cos(-Math.PI / 2.6) * R, ry = Math.max(L.sceneTop + 10 * u, l.y + Math.sin(-Math.PI / 2.6) * R - 10 * u);
    if (look === 'live') {
      ctx.font = font(800, 11 * u, SANS);
      ctx.strokeText(pct, rx, ry);
      ctx.fillStyle = over ? '#ffd36b' : 'rgba(255,246,220,.9)';
      ctx.fillText(pct, rx, ry);
    }
    ctx.restore();
  }

  /** The Świt's charge as a ring around the lamp. */
  private drawDawnRing(sim: DolinaSim, lamp: { x: number; y: number }): void {
    if (sim.dawnCharge < 0.02) return;
    const ctx = this.ctx, S = this.S;
    const r = S * 0.34;
    ctx.strokeStyle = 'rgba(255,240,200,.25)';
    ctx.lineWidth = S * 0.06;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = sim.dawnCharge > 0.95 ? '#fff4c0' : '#ffd36b';
    ctx.lineWidth = S * 0.08;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * sim.dawnCharge);
    ctx.stroke();
    if (sim.dawnCharge > 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, lamp.x, lamp.y, r * 2.4, 'rgba(255,214,120,', 0.3 * sim.dawnCharge);
      ctx.restore();
    }
  }

  /** The sword's arc: a crescent of light in front of the pilgrim, as long as its reach. */
  private drawSlashes(sim: DolinaSim): void {
    const ctx = this.ctx, S = this.S;
    for (const s of this.slashes) {
      const k = s.t / s.dur;
      const cx = this.L.runX + S * 0.1, cy = this.sy(sim.py + 0.75);
      const r = (RULES.halfW + s.reach) * S;
      const a0 = -1.25 + k * 0.5, a1 = a0 + 1.55 * ease.outCubic(Math.min(1, k * 2.2));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,244,214,${0.7 * (1 - k)})`;
      ctx.lineWidth = S * 0.09 * (1 - k * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, a0, a1);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,211,107,${0.45 * (1 - k)})`;
      ctx.lineWidth = S * 0.035;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0 + 0.1, a1);
      ctx.stroke();
      ctx.restore();
    }
  }
}
