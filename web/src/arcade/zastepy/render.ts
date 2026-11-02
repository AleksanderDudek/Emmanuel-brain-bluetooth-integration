/**
 * Zastępy's play view, all on the canvas: a dawn sky over a sea of clouds (painted once per size,
 * warm by the gate of light, dusky by the gate of ash), the causeway between the gates, the banners
 * along its far edge (the band's history, hud.ts), the gates (the light's tower with its lantern and
 * the glow of the flow; the basalt arch of ash with its embers and cracks), the fighters sorted by
 * depth (the fliers above), the strikes, arrows, fire, the beam, the embers, the trumpet's wave
 * rolling down the road, the ash and motes of the beaten, and the HUD on top.  It only reads the sim
 * (sim.ts); the calibration scene is intro.ts.
 *
 * The camera shows the whole road when the screen is wide enough; on a phone it follows the front
 * (where the host meets the demons) and a drag pans it for a few seconds.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import type { Fighter } from './battle';
import { DEMON_NAME } from './content';
import { gold as goldText, t } from './i18n';
import { ZastepyIntro } from './intro';
import { layout, type Layout } from './layout';
import type { ZastepyProgress } from './meta';
import { C, POSE, groundShadow, hash, paintAshGate, paintDemon, paintHost, paintLightGate, type Pose } from './paint';
import type { DemonId, HostId } from './rules';
import { RULES, type SimEvent, type ZastepySim } from './sim';
import { Hud, type Hit } from './hud';

const TAU = Math.PI * 2;

/** A projectile or a ray in flight, in world metres (y up from the road, negative is up). */
interface Bolt { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; kind: 'arrow' | 'fire' | 'ember' | 'beam' | 'breath' | 'dark' }
interface Slash { x: number; y: number; t: number; side: 1 | -1; big: boolean }

const TXT = {
  won: t('fx.won'), lost: t('fx.lost'), lostSub: t('fx.lostSub'), smok: t('fx.smok'), smokSub: t('fx.smokSub'), smokDown: t('fx.smokDown'),
  sealed: t('fx.sealed'), surge: t('fx.surge'), nope: t('fx.nope'), cool: t('fx.cool'), trumpet: t('fx.trumpet'),
  trumpetReady: t('fx.trumpetReady'), trumpetSub: t('fx.trumpetSub'), retry: t('fx.retry'), flier: t('fx.flier'),
};

export class ZastepyView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new ZastepyIntro();
  private clock = 0;
  private camX = RULES.road / 2;
  private manualT = 0;
  private drag: { x: number; cam: number; id: number; moved: boolean } | null = null;
  private sky: HTMLCanvasElement | null = null;
  private skyKey = '';
  private readonly parts = new Particles(700);
  private readonly bolts: Bolt[] = [];
  private readonly slashes: Slash[] = [];
  private readonly hurtT = new Map<number, number>();
  private wave = -1;
  private fall = 0;
  private dark = 0;
  private restTint = 0;
  private fogTint = 0;
  private gateFlash = 0;
  private lastSealed = -9;
  private lastFlier = -99;
  private readonly shake: Shake;
  private readonly pose: Pose = { ...POSE };
  private readonly rnd = Math.random;
  private started = false;
  private fade = 0;

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

  start(): void {
    this.started = true;
    this.fade = 1;
  }

  intro(dt: number, p: number, progress: ZastepyProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── world ↔ screen ──────────────────────────────────────────────
  private get S(): number { return this.L.S; }
  sx(x: number): number { return this.L.w / 2 + (x - this.camX) * this.S; }
  /** the feet of a fighter in its lane (0 = the front edge, 1 = the far edge) */
  private laneY(lane: number): number { return this.L.roadY - lane * (this.L.roadY - this.L.roadBack) * 0.8; }
  private fy(f: Fighter): number {
    const y = this.laneY(f.lane);
    if (f.kind === 'smok') return this.L.roadY - 0.55 * this.S + Math.sin(this.clock * 1.6) * 0.08 * this.S;
    return f.fly ? y - 1.9 * this.S + Math.sin(this.clock * 3 + f.id) * 0.08 * this.S : y;
  }
  /** a world point (m along the road, m above the front edge) for particles */
  private wy(py: number): number { return (py - this.L.roadY) / this.S; }

  // ── the hands: a tap on the HUD acts at once, a drag on the road pans ─
  pointer(type: 'down' | 'move' | 'up', x: number, y: number, id: number, sim: ZastepySim): Hit | null {
    if (type === 'down') {
      const hit = this.hud.hit(x, y, sim);
      if (hit) return hit;
      this.drag = { x, cam: this.camX, id, moved: false };
      return null;
    }
    const d = this.drag;
    if (!d || d.id !== id) return null;
    if (type === 'move') {
      if (Math.abs(x - d.x) > 8) d.moved = true;
      if (d.moved && !this.fits) {
        this.camX = this.clampCam(d.cam - (x - d.x) / this.S);
        this.manualT = 4;
      }
    } else this.drag = null;
    return null;
  }

  release(): void { this.drag = null; }

  /** the whole road (and a little of both gates) fits the screen */
  private get fits(): boolean { return this.L.viewM >= RULES.road + 3; }
  private clampCam(x: number): number {
    const half = this.L.viewM / 2;
    return this.fits ? RULES.road / 2 : clamp(x, half - 2.6, RULES.road + 2.6 - half);
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: ZastepySim): void {
    const rm = this.opts.reducedMotion, S = this.S, u = this.L.u, b = sim.battle;
    const L = this.L;
    switch (e.type) {
      case 'sent': {
        this.hud.pressCard(e.kind);
        this.parts.burst(0.4, -0.7, rm ? 4 : 12, { color: C.goldLight, size: 0.07, speed: 2.4, g: -1, drag: 3, life: 0.6, shape: 'spark', rnd: this.rnd });
        this.gateFlash = 1;
        break;
      }
      case 'spawn':
        this.parts.burst(b.road - 0.3, -0.8, rm ? 3 : 10, { color: C.smoke, size: 0.14, speed: 1.2, g: -0.6, drag: 2, life: 0.9, rnd: this.rnd });
        break;
      case 'strike': {
        const f = this.find(sim, e.id);
        const y0 = f ? this.wy(this.fy(f)) - (f.fly ? 0.3 : 0.75) : -0.75;
        const ty = e.ty === 'gate' ? -1.2 : e.flyTarget ? this.wy(L.roadY - 1.9 * S) - 0.3 : -0.7;
        if (e.ranged) {
          const kind: Bolt['kind'] = e.kind === 'lucznik' ? 'arrow' : e.kind === 'serafin' ? 'fire' : e.kind === 'smok' ? 'breath' : 'dark';
          const dir = e.side;
          this.bolts.push({ x0: e.x + dir * (e.kind === 'smok' ? 1.8 : 0.3), y0: e.kind === 'smok' ? -1.9 : y0, x1: e.tx, y1: ty, t: 0, dur: kind === 'breath' ? 0.45 : 0.18 + Math.abs(e.tx - e.x) * 0.02, kind });
        } else this.slashes.push({ x: e.x + e.side * 0.45, y: e.ty === 'gate' ? -1 : y0 + 0.15, t: 0, side: e.side, big: e.kind === 'bestia' || e.kind === 'archaniol' || e.kind === 'jezdziec' });
        if (e.ty === 'gate' && e.side === 1) this.parts.burst(e.tx, -1.1 - this.rnd() * 1.2, rm ? 1 : 3, { color: C.emberCore, size: 0.05, speed: 2, g: 3, drag: 2, life: 0.4, shape: 'spark', rnd: this.rnd });
        break;
      }
      case 'hurt':
        this.hurtT.set(e.id, 0.18);
        if (e.shield) this.parts.burst(e.x, -0.8, rm ? 1 : 4, { color: '#cfe0ff', size: 0.05, speed: 1.6, g: 0, drag: 3, life: 0.35, shape: 'ring', rnd: this.rnd });
        break;
      case 'beaten': {
        const yy = e.kind === 'smok' ? -1.4 : e.fly ? this.wy(L.roadY - 1.9 * S) - 0.3 : -0.6;
        const big = e.kind === 'smok' ? 4 : e.kind === 'bestia' ? 2 : 1;
        // ash falls, embers die, motes of light rise: the shadow comes apart
        this.parts.burst(e.x, yy, (rm ? 6 : 16) * big, { color: C.ash, size: 0.07, speed: 1.2, g: 1.2, drag: 2.2, life: 1.1, shape: 'square', rnd: this.rnd });
        this.parts.burst(e.x, yy, (rm ? 3 : 8) * big, { color: C.ember, size: 0.045, speed: 2.2, g: 0.5, drag: 2.5, life: 0.6, shape: 'spark', rnd: this.rnd });
        this.parts.burst(e.x, yy, (rm ? 3 : 9) * big, { color: C.goldLight, size: 0.05, speed: 1.1, g: -1.4, drag: 1.6, life: 1.2, rnd: this.rnd });
        if (e.gold > 0) this.hud.float(`+${e.gold}`, this.sx(e.x), L.roadY + yy * S - 18 * u, C.goldDeep, 12, 0.9, 22);
        this.hud.popScore();
        if (e.kind === 'smok') {
          this.hud.toast(TXT.smokDown, '', C.goldDeep, 3);
          this.shake.add(0.6);
        } else this.shake.add(e.kind === 'bestia' ? 0.18 : 0.04);
        break;
      }
      case 'fallen':
        // an angel is not hurt: it goes back into the light
        this.parts.burst(e.x, -0.8, rm ? 4 : 12, { color: C.white, size: 0.06, speed: 1, g: -2, drag: 1.5, life: 1, rnd: this.rnd });
        this.parts.burst(e.x, -0.8, rm ? 2 : 6, { color: C.goldLight, size: 0.05, speed: 0.8, g: -2.5, drag: 1.5, life: 1.2, shape: 'spark', rnd: this.rnd });
        break;
      case 'beam':
        this.bolts.push({ x0: -1.1, y0: -5.2, x1: e.x, y1: e.fly ? this.wy(L.roadY - 1.9 * S) - 0.3 : -0.7, t: 0, dur: 0.22, kind: 'beam' });
        this.parts.burst(e.x, -0.7, rm ? 2 : 6, { color: C.goldLight, size: 0.05, speed: 2, g: 1, drag: 2, life: 0.4, shape: 'spark', rnd: this.rnd });
        this.gateFlash = Math.max(this.gateFlash, 0.6);
        break;
      case 'ember':
        this.bolts.push({ x0: b.road + 1.2, y0: -4.4, x1: e.x, y1: e.fly ? this.wy(L.roadY - 1.9 * S) - 0.3 : -0.7, t: 0, dur: 0.3, kind: 'ember' });
        break;
      case 'gateHit':
        if (e.side === 1) {
          this.shake.add(0.03);
          this.parts.burst(0.1, -1 - this.rnd() * 2, rm ? 1 : 3, { color: C.stoneShade, size: 0.06, speed: 1.4, g: 4, drag: 1.5, life: 0.6, shape: 'square', rnd: this.rnd });
        }
        break;
      case 'sealed':
        if (this.clock - this.lastSealed > 3) {
          this.lastSealed = this.clock;
          this.hud.float(TXT.sealed, this.sx(b.road) - 20 * u, L.roadY - 3.4 * S, '#7a2e1e', 14, 1.4, 20);
        }
        break;
      case 'surge':
        this.hud.toast(TXT.surge, '', '#7a2e1e', 1.8);
        this.shake.add(0.2);
        break;
      case 'smok':
        this.hud.toast(TXT.smok, TXT.smokSub, '#7a2e1e', 3.2);
        this.shake.add(0.5);
        this.dark = 1;
        break;
      case 'trumpet':
        this.wave = 0;
        this.hud.toast(TXT.trumpet, '', C.goldDeep, 1.6);
        this.shake.add(0.45);
        break;
      case 'won':
        this.fall = 0.001;
        this.shake.add(0.5);
        if (!rm) for (const col of [C.goldLight, C.white, C.gold]) this.parts.burst(b.road + 1, -2.4, 24, { color: col, size: 0.09, speed: 4, g: 0.5, drag: 1.6, life: 1.6, shape: 'square', rnd: this.rnd });
        break;
      case 'winGold':
        this.hud.toast(TXT.won, t('card.win', { gold: goldText(e.gold) }), C.goldDeep, 2.6);
        break;
      case 'lost':
        this.hud.toast(TXT.lost, TXT.lostSub, C.blueDeep, 2.8);
        break;
      case 'battleStart':
        this.fall = 0;
        this.dark = 0;
        this.bolts.length = 0;
        this.slashes.length = 0;
        this.wave = -1;
        if (e.retry > 0) this.hud.toast(TXT.retry, t('fx.retrySub', { n: RULES.wallsPerRetreat * e.retry }), C.blueDeep, 2.4);
        else this.hud.toast(e.smok ? t('hud.smok') : t('fx.battle', { n: (e.battle % RULES.circle) + 1 }), t('fx.battleSub', { hp: sim.battle.ashMax }), e.smok ? '#7a2e1e' : C.ink, 2.4);
        this.camX = this.clampCam(0);
        this.manualT = 0;
        break;
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(sim, e.block.kind, e.block.blind, e.verdict, e.share, e.need, e.t0, e.t1, e.light);
        break;
      case 'trumpetReady':
        this.hud.toast(TXT.trumpetReady, TXT.trumpetSub, C.goldDeep, 2.4);
        this.hud.popTrumpet();
        break;
      case 'nope': {
        this.hud.shakeCard(e.id);
        const cool = sim.battle.cool[e.id] > 0;
        this.hud.float(cool ? TXT.cool : TXT.nope, L.w / 2, L.cards.y - 12 * u, '#8a4a3a', 13, 0.9, 16);
        break;
      }
      case 'buy':
        this.hud.bought();
        break;
      case 'blindPay':
        if (e.light > 0) this.hud.float(`+${e.light}`, L.light.x + L.light.w / 2, L.light.y - 6 * u, C.goldDeep, 18, 1.6, 26);
        break;
      case 'gift':
        this.hud.toast(t('card.gift', { gold: goldText(e.gold) }), '', C.goldDeep);
        break;
      default:
        break;
    }
    // a flier the blades cannot reach: say it once in a while, at the first ones
    if (e.type === 'spawn' && e.kind === 'skrzydlak' && this.clock - this.lastFlier > 90) {
      this.lastFlier = this.clock;
      this.hud.toast(DEMON_NAME.skrzydlak, TXT.flier, C.ink, 2.4);
    }
  }

  private find(sim: ZastepySim, id: number): Fighter | undefined {
    return sim.battle.fighters.find(f => f.id === id);
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: ZastepySim): void {
    this.clock += dt;
    const b = sim.battle;
    // the camera: the whole road, or the front where the host meets the demons
    const x0 = this.camX;
    this.manualT = Math.max(0, this.manualT - dt);
    if (!this.fits && this.manualT <= 0 && !this.drag) {
      const host = b.front(1), dem = b.front(-1);
      const target = b.count(1) ? (host + Math.min(dem, host + this.L.viewM * 0.55)) / 2 + 1 : Math.min(dem, b.road) - this.L.viewM * 0.3;
      this.camX = approach(this.camX, this.clampCam(target), dt, 0.9);
    } else if (this.fits) this.camX = RULES.road / 2;
    this.hud.shiftFloats(-(this.camX - x0) * this.S);
    this.parts.update(dt);
    let n = 0;
    for (const o of this.bolts) if ((o.t += dt) < o.dur) this.bolts[n++] = o;
    this.bolts.length = n;
    n = 0;
    for (const o of this.slashes) if ((o.t += dt) < 0.22) this.slashes[n++] = o;
    this.slashes.length = n;
    for (const [id, v] of this.hurtT) (v - dt <= 0 ? this.hurtT.delete(id) : this.hurtT.set(id, v - dt));
    if (this.wave >= 0) {
      this.wave += dt * 1.6;
      if (this.wave > 1.2) this.wave = -1;
    }
    if (this.fall > 0) this.fall = Math.min(1, this.fall + dt * 0.8);
    this.dark = Math.max(0, this.dark - dt * 0.4);
    this.gateFlash = Math.max(0, this.gateFlash - dt * 2.5);
    this.fade = Math.max(0, this.fade - dt * 1.4);
    this.restTint = approach(this.restTint, sim.restBlock ? 1 : 0, dt, 1.2);
    this.fogTint = approach(this.fogTint, sim.blind ? 1 : 0, dt, 1);
    this.hud.update(dt, sim);
  }

  draw(sim: ZastepySim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L, S = this.S, b = sim.battle;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawSky(sim);
    this.drawRoad();
    if (this.fits) this.hud.banners(sim, Math.max(L.banners.x0, this.sx(0) + 0.6 * S), Math.min(L.banners.x1, this.sx(RULES.road) - 0.6 * S));
    else this.hud.banners(sim);
    // the gates
    const glow = clamp(0.25 + (sim.mult - 1) / (RULES.flowTop - 1) * 0.75 + this.gateFlash * 0.3);
    paintLightGate(ctx, this.sx(0), L.roadY + 0.15 * S, S, { glow, walls: b.walls / b.wallsMax, t: this.clock, mend: sim.calmNow });
    paintAshGate(ctx, this.sx(b.road), L.roadY + 0.15 * S, S, { ash: b.smokBattle ? 1 : b.ash / b.ashMax, t: this.clock, fall: ease.inOutSine(this.fall), sealed: b.smokBattle && b.outcome === null });
    this.drawFighters(sim);
    this.drawBolts();
    this.drawSlashes();
    this.drawWave();
    ctx.save();
    ctx.translate(this.sx(0), L.roadY);
    ctx.scale(S, S);
    this.parts.draw(ctx);
    ctx.restore();
    // the Smok's shadow over the sky
    if (this.dark > 0) {
      ctx.fillStyle = `rgba(30,18,30,${0.25 * this.dark})`;
      ctx.fillRect(-10, -10, this.w + 20, this.h + 20);
    }
    ctx.restore();
    this.hud.draw(sim);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(255,241,201,${ease.inOutSine(this.fade) * 0.85})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // ── the sky and the road ────────────────────────────────────────
  private drawSky(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L;
    const key = `${this.w}x${this.h}x${this.dpr}`;
    if (this.skyKey !== key || !this.sky) this.paintSky(key);
    if (this.sky) ctx.drawImage(this.sky, 0, 0, this.w, this.h);
    // drifting clouds below the road, a slow parallax of the camera
    const par = this.camX * this.S * 0.25;
    for (let i = 0; i < 9; i++) {
      const cw = (90 + hash(i * 7) * 140) * L.u;
      const span = this.w + cw * 2;
      const x = ((hash(i * 3) * span - par * (0.4 + hash(i) * 0.6) + this.clock * (4 + hash(i * 5) * 6)) % span + span) % span - cw;
      const y = L.roadY + (0.9 + hash(i * 11) * 2.4) * this.S;
      this.cloud(x, y, cw, 0.75);
    }
    // the stillness cools the sky; a blind block's fog creeps over it
    if (this.restTint > 0.01) {
      ctx.fillStyle = `rgba(70,95,150,${0.2 * this.restTint})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.fogTint > 0.01) {
      const g = ctx.createLinearGradient(0, 0, 0, L.roadY);
      g.addColorStop(0, `rgba(120,100,150,${0.45 * this.fogTint})`);
      g.addColorStop(1, `rgba(120,100,150,${0.15 * this.fogTint})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, L.roadY);
    }
    void sim;
  }

  /** The sky, once per size: dawn by the gate of light, dusk by the gate of ash, a sea of clouds below. */
  private paintSky(key: string): void {
    this.skyKey = key;
    const c = this.sky ?? document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w * this.dpr));
    c.height = Math.max(1, Math.round(this.h * this.dpr));
    this.sky = c;
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = this.w, h = this.h, L = this.L;
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, '#f7d9a0');
    v.addColorStop(0.45, '#fff1c9');
    v.addColorStop(1, '#f6e2c8');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    // dusk toward the gate of ash
    const hz = g.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, 'rgba(255,240,200,0)');
    hz.addColorStop(0.55, 'rgba(160,90,90,0.08)');
    hz.addColorStop(1, 'rgba(60,32,52,0.55)');
    g.fillStyle = hz;
    g.fillRect(0, 0, w, h);
    // the sun's glow over the gate of light
    const sun = g.createRadialGradient(w * 0.08, L.roadY - L.S * 5, 0, w * 0.08, L.roadY - L.S * 5, Math.max(w, h) * 0.6);
    sun.addColorStop(0, 'rgba(255,253,235,.95)');
    sun.addColorStop(0.25, 'rgba(255,236,180,.5)');
    sun.addColorStop(1, 'rgba(255,236,180,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    // rays from it
    g.save();
    g.globalAlpha = 0.12;
    g.fillStyle = '#fffbe8';
    for (let i = 0; i < 7; i++) {
      const a = -0.35 + i * 0.13;
      g.beginPath();
      g.moveTo(w * 0.08, L.roadY - L.S * 5);
      g.lineTo(w * 0.08 + Math.cos(a) * w * 1.2, L.roadY - L.S * 5 + Math.sin(a) * w * 1.2);
      g.lineTo(w * 0.08 + Math.cos(a + 0.05) * w * 1.2, L.roadY - L.S * 5 + Math.sin(a + 0.05) * w * 1.2);
      g.fill();
    }
    g.restore();
    // far cloud banks on the horizon, smoke over the ash's side
    for (let i = 0; i < 16; i++) {
      const x = hash(i * 13 + 1) * w, y = L.roadBack - (0.3 + hash(i * 7 + 2) * 1.6) * L.S, r = (30 + hash(i * 5) * 50) * L.u;
      const dusk = x / w;
      g.fillStyle = `rgba(${Math.round(255 - 70 * dusk)},${Math.round(248 - 100 * dusk)},${Math.round(236 - 80 * dusk)},${0.3 + 0.12 * dusk})`;
      g.beginPath();
      g.ellipse(x, y, r * 1.6, r * 0.45, 0, 0, TAU);
      g.fill();
    }
    // the sea of clouds below the road
    const sea = g.createLinearGradient(0, L.roadY, 0, h);
    sea.addColorStop(0, '#fff6e6');
    sea.addColorStop(1, '#f1d8c4');
    g.fillStyle = sea;
    g.fillRect(0, L.roadY + L.S * 0.4, w, h);
    for (let i = 0; i < 30; i++) {
      const x = hash(i * 17 + 3) * w, y = L.roadY + (0.6 + hash(i * 19) * 4) * L.S, r = (30 + hash(i * 23) * 60) * L.u;
      g.fillStyle = i % 3 ? 'rgba(255,250,240,.8)' : 'rgba(236,210,190,.5)';
      g.beginPath();
      g.ellipse(x, y, r * 1.5, r * 0.5, 0, 0, TAU);
      g.fill();
    }
    const ashSea = g.createLinearGradient(w * 0.55, 0, w, 0);
    ashSea.addColorStop(0, 'rgba(70,40,60,0)');
    ashSea.addColorStop(1, 'rgba(70,40,60,.35)');
    g.fillStyle = ashSea;
    g.fillRect(w * 0.55, L.roadY, w * 0.45, h);
  }

  private cloud(x: number, y: number, w: number, a: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,251,242,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, TAU);
    ctx.ellipse(x - w * 0.22, y - w * 0.06, w * 0.24, w * 0.12, 0, 0, TAU);
    ctx.ellipse(x + w * 0.16, y - w * 0.08, w * 0.22, w * 0.13, 0, 0, TAU);
    ctx.fill();
  }

  /** The causeway: its top of pale stone (joints every metre), its face, the pillars down into the clouds. */
  private drawRoad(): void {
    const ctx = this.ctx, L = this.L, S = this.S;
    const xa = this.sx(-3), xb = this.sx(RULES.road + 3);
    const top = L.roadBack, front = L.roadY + 0.2 * S, base = front + 0.55 * S;
    // the pillars
    for (let m = -1; m <= RULES.road + 1; m += 5) {
      const x = this.sx(m);
      if (x < -S * 2 || x > this.w + S * 2) continue;
      const g = ctx.createLinearGradient(0, base, 0, base + S * 3);
      g.addColorStop(0, C.stoneShade);
      g.addColorStop(1, 'rgba(201,180,143,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 0.45 * S, base);
      ctx.lineTo(x - 0.3 * S, base + S * 3);
      ctx.lineTo(x + 0.3 * S, base + S * 3);
      ctx.lineTo(x + 0.45 * S, base);
      ctx.fill();
    }
    // the face
    const fg = ctx.createLinearGradient(0, front, 0, base);
    fg.addColorStop(0, C.stoneShade);
    fg.addColorStop(1, C.stoneDark);
    ctx.fillStyle = fg;
    ctx.fillRect(xa, front, xb - xa, base - front);
    // the top
    const tg = ctx.createLinearGradient(0, top, 0, front);
    tg.addColorStop(0, '#f7eedc');
    tg.addColorStop(1, C.stone);
    ctx.fillStyle = tg;
    ctx.fillRect(xa, top, xb - xa, front - top);
    // light from the gate of light warms the near end, the ash's dusk the far end
    const warm = ctx.createLinearGradient(this.sx(0), 0, this.sx(RULES.road), 0);
    warm.addColorStop(0, 'rgba(255,236,170,.25)');
    warm.addColorStop(0.6, 'rgba(255,236,170,0)');
    warm.addColorStop(1, 'rgba(70,40,60,.28)');
    ctx.fillStyle = warm;
    ctx.fillRect(xa, top, xb - xa, base - top);
    // the joints
    ctx.strokeStyle = 'rgba(156,133,102,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let m = Math.floor(this.camX - this.L.viewM / 2) - 1; m <= this.camX + this.L.viewM / 2 + 1; m++) {
      if (m < -3 || m > RULES.road + 3) continue;
      const x = this.sx(m);
      ctx.moveTo(x, top);
      ctx.lineTo(x - 0.25 * S, front);
      const xf = this.sx(m + 0.5);
      ctx.moveTo(xf, front);
      ctx.lineTo(xf, base);
    }
    ctx.moveTo(xa, front);
    ctx.lineTo(xb, front);
    ctx.stroke();
    // the far rim
    ctx.strokeStyle = 'rgba(185,127,31,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xa, top);
    ctx.lineTo(xb, top);
    ctx.stroke();
  }

  // ── the fighters ────────────────────────────────────────────────
  private drawFighters(sim: ZastepySim): void {
    const ctx = this.ctx, S = this.S, b = sim.battle;
    const list = b.fighters.slice().sort((a, c) => (a.fly === c.fly ? c.lane - a.lane : a.fly ? 1 : -1));
    const p = this.pose;
    for (const f of list) {
      const x = this.sx(f.x);
      if (x < -S * 4 || x > this.w + S * 4) continue;
      const y = this.fy(f);
      p.t = this.clock;
      p.seed = f.id;
      p.walk = f.state === 'walk' && f.knock <= 0 ? 1 : 0;
      p.step = (this.clock * f.speed * 1.6 + hash(f.id)) % 2;
      p.atk = f.atkT < 0.3 ? 1 - f.atkT / 0.3 : 0;
      p.hurt = (this.hurtT.get(f.id) ?? 0) / 0.18;
      p.shield = f.shield > 0 ? clamp(f.shield / (f.maxHp * RULES.shieldMax)) : 0;
      p.gone = f.state === 'gone' ? clamp(f.goneT / RULES.fade) : 0;
      if (!f.fly || f.kind === 'smok') groundShadow(ctx, x, this.laneY(f.lane) + 0.02 * S, (f.kind === 'smok' ? 2.2 : f.kind === 'jezdziec' || f.kind === 'bestia' ? 0.6 : 0.36) * S, 0.2 * (1 - p.gone));
      else groundShadow(ctx, x, this.laneY(f.lane), 0.3 * S, 0.1);
      const k = f.kind === 'smok' ? S * 1.1 : S * 1.2;
      if (f.side === 1) paintHost(ctx, f.kind as HostId, x, y, k, p);
      else paintDemon(ctx, f.kind as DemonId, x, y, k, p);
      // a thin health line over the hurt (never for the dissolving)
      if (f.state !== 'gone' && f.hp < f.maxHp) {
        const top = y - (f.kind === 'smok' ? 2.6 : f.kind === 'archaniol' ? 2.5 : f.kind === 'bestia' ? 2.1 : f.fly ? 1.1 : 1.9) * S;
        const w = (f.kind === 'smok' ? 2.4 : 0.6) * S, hh = Math.max(2, 0.06 * S);
        ctx.fillStyle = 'rgba(42,31,46,.35)';
        ctx.fillRect(x - w / 2, top, w, hh);
        ctx.fillStyle = f.side === 1 ? C.gold : C.ember;
        ctx.fillRect(x - w / 2, top, w * clamp(f.hp / f.maxHp), hh);
      }
    }
  }

  // ── strikes, bolts, the trumpet's wave ──────────────────────────
  private drawBolts(): void {
    const ctx = this.ctx, S = this.S, L = this.L;
    for (const o of this.bolts) {
      const k = o.t / o.dur;
      const X = (x: number) => this.sx(x), Y = (y: number) => L.roadY + y * S;
      if (o.kind === 'beam' || o.kind === 'ember') {
        const a = 1 - k;
        ctx.save();
        ctx.strokeStyle = o.kind === 'beam' ? `rgba(255,248,214,${a})` : `rgba(255,138,61,${a})`;
        ctx.shadowColor = o.kind === 'beam' ? 'rgba(255,224,138,.95)' : 'rgba(255,100,40,.9)';
        ctx.shadowBlur = 12;
        ctx.lineWidth = (o.kind === 'beam' ? 0.12 : 0.08) * S * (1 - k * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(X(o.x0), Y(o.y0));
        if (o.kind === 'ember') {
          const mx = (o.x0 + o.x1) / 2, my = Math.min(o.y0, o.y1) - 1.2;
          const e = ease.outCubic(Math.min(1, k * 2));
          ctx.quadraticCurveTo(X(mx), Y(my), X(o.x0 + (o.x1 - o.x0) * e), Y(o.y0 + (o.y1 - o.y0) * e));
        } else ctx.lineTo(X(o.x1), Y(o.y1));
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (o.kind === 'breath') {
        // the Smok's breath: a cone of ember fire along the road
        const a = Math.sin(k * Math.PI);
        const g = ctx.createLinearGradient(X(o.x0), 0, X(o.x1), 0);
        g.addColorStop(0, `rgba(255,220,140,${0.85 * a})`);
        g.addColorStop(1, `rgba(255,100,40,${0.15 * a})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(X(o.x0), Y(o.y0));
        ctx.lineTo(X(o.x1), Y(o.y1) - 0.9 * S);
        ctx.lineTo(X(o.x1), Y(0));
        ctx.closePath();
        ctx.fill();
        continue;
      }
      const e = ease.outCubic(k);
      const x = o.x0 + (o.x1 - o.x0) * e, y = o.y0 + (o.y1 - o.y0) * e - Math.sin(k * Math.PI) * (o.kind === 'arrow' ? 0.6 : 0.3);
      const px = X(x), py = Y(y);
      if (o.kind === 'arrow') {
        const dir = Math.sign(o.x1 - o.x0) || 1;
        ctx.strokeStyle = C.white;
        ctx.shadowColor = 'rgba(255,224,138,.95)';
        ctx.shadowBlur = 8;
        ctx.lineWidth = Math.max(1.5, 0.05 * S);
        ctx.beginPath();
        ctx.moveTo(px - dir * 0.45 * S, py + 0.05 * S);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        const fire = o.kind === 'fire';
        const r = (fire ? 0.22 : 0.14) * S;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, fire ? '#fffdf0' : '#ffb27a');
        g.addColorStop(0.5, fire ? 'rgba(255,210,122,.9)' : 'rgba(120,40,60,.85)');
        g.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.fill();
        if (fire && k > 0.85) {
          ctx.fillStyle = `rgba(255,236,170,${(1 - k) * 4})`;
          ctx.beginPath();
          ctx.arc(X(o.x1), Y(o.y1), 1.4 * S * (k - 0.6), 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  private drawSlashes(): void {
    const ctx = this.ctx, S = this.S, L = this.L;
    for (const o of this.slashes) {
      const k = o.t / 0.22;
      const x = this.sx(o.x), y = L.roadY + o.y * S;
      const r = (o.big ? 0.75 : 0.5) * S;
      ctx.strokeStyle = o.side === 1 ? `rgba(255,240,190,${1 - k})` : `rgba(120,30,40,${0.85 * (1 - k)})`;
      ctx.lineWidth = (o.big ? 0.14 : 0.09) * S * (1 - k * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const a0 = o.side === 1 ? -1.3 : Math.PI + 1.3, sweep = 1.8 * ease.outCubic(Math.min(1, k * 1.6));
      if (o.side === 1) ctx.arc(x, y, r, a0, a0 + sweep);
      else ctx.arc(x, y, r, a0 - sweep, a0);
      ctx.stroke();
    }
  }

  /** The trumpet's wave: an arc of light rolling from the gate of light down the whole road. */
  private drawWave(): void {
    if (this.wave < 0) return;
    const ctx = this.ctx, S = this.S, L = this.L;
    const k = this.wave;
    const x = this.sx(-1 + (RULES.road + 3) * ease.outCubic(Math.min(1, k)));
    const a = Math.max(0, 1 - k * 0.8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cy = L.roadY - 1.3 * S;
    const g = ctx.createRadialGradient(x - 0.6 * S, cy, 0, x - 0.6 * S, cy, 2.6 * S);
    g.addColorStop(0, `rgba(255,236,170,${0.5 * a})`);
    g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x - 0.6 * S, cy, 1.6 * S, 2.6 * S, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,250,225,${0.9 * a})`;
    ctx.lineWidth = 0.12 * S;
    ctx.beginPath();
    ctx.ellipse(x - 0.4 * S, cy, 0.6 * S, 2.4 * S, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();
  }
}
