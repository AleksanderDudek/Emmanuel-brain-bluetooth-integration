/**
 * Wzlot's play view (Canvas 2D): Tiny Wings' look made our own — a camera that keeps the eaglet a
 * third in from the left and zooms out as it climbs so the hills stay in sight; the sky turning
 * from afternoon to dusk to night as the day runs out; three parallax ranges and the grań's ground
 * in the colours of its land, with strata following the curve; the promyki, the podmuch, the cloud
 * deck, the thermals; the eaglet with its trail (golden in a Poryw), Leon the lark beside it, the
 * mother eagle when she catches; the night creeping in from the left.
 *
 * The band in the world: the sun on its arc across the sky is the day's clock, and in a push block
 * its halo is the gauge (the threshold dotted on the sun itself, the rim gold above it), the Poryw's
 * charge fills around it, and the arc behind the sun keeps the history — gold where focus held the
 * sun up, cool where the day ran through a rest.  In a blind block a cloud covers the sun.
 *
 * The runner's standard HUD (the Mendi panel, the score) covers the top band (`hudTop`): the play
 * stays below it.  hud.ts draws the words, the bubble and the cards.
 */
import { approach, clamp, Particles, Shake } from '../kit/juice';
import { NO_INSETS } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { fmtInt, t } from './i18n';
import { WzlotIntro } from './intro';
import { layout, type Layout } from './layout';
import { type WzlotProgress } from './meta';
import {
  C, LAND_LOOK, LANDS, LANDS_SEED, SANS, SERIF, font, hash, mix, mixInto, paintCloud, paintCoin, paintEagle, paintEaglet, paintLark, paintNestFamily, paintOrb,
  paintRange, paintSky, paintSpire, paintSunGauge, paintThermal, rgb, skyAt, type EagletPose, type Land, type LandLook, type RGB, type SkyLook,
} from './paint';
import { Hud } from './hud';
import { RULES } from './rules';
import type { Anchor, SimEvent, WzlotSim } from './sim';

const TAU = Math.PI * 2;
const TRAIL = 56;
const BINS = 48;
const NIGHT: RGB = [22, 26, 58];

export class WzlotView {
  readonly hud = new Hud();
  private readonly ctx: CanvasRenderingContext2D;
  private L: Layout = layout(800, 600);
  private dpr = 1;
  private ins: Insets = NO_INSETS;
  private readonly introScene = new WzlotIntro();
  private readonly particles = new Particles(520);
  private readonly shake: Shake;
  private time = 0;
  // the camera: world x at the eaglet's place, the world y at the screen's floor, px per sh
  private camX = 0;
  private floorY = -0.6;
  private S = 200;
  private span = 1.4;
  private snap = true;
  // the eaglet's trail (world), the drawn fold, Leon's place (px)
  private readonly trail = new Float32Array(TRAIL * 3);
  private trailN = 0;
  private trailI = 0;
  private trailT = 0;
  private fold = 0;
  private larkX = 0;
  private larkY = 0;
  private flash = 0;
  private skyPhase = 0.5;
  private readonly sky: SkyLook = skyAt(0.5);
  private readonly pose: EagletPose = { stage: 1, fold: 0, spread: 0.7, flap: 0, glow: 0 };
  private readonly tmp: RGB = [0, 0, 0];
  /** the sun's arc history: per bin, -1 untouched, else 0 plain, 1 held by focus, 2 a rest */
  private readonly track = new Int8Array(BINS).fill(-1);
  private sunPos = { x: 0, y: 0 };
  private lastThermal: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, insets: Insets = this.ins, touch = true): void {
    this.dpr = dpr;
    this.ins = insets;
    this.L = layout(w, h, insets);
    this.hud.resize(this.L, touch);
    this.snap = true;
  }

  intro(dt: number, p: number, progress: WzlotProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.L.w, this.L.h, dt, p, progress);
  }

  start(): void {
    this.snap = true;
  }

  // ── world ↔ screen ─────────────────────────────────────────────
  sx(x: number): number { return this.L.ex + (x - this.camX) * this.S; }
  sy(y: number): number { return this.L.bottom - (y - this.floorY) * this.S; }
  private wx(px: number): number { return this.camX + (px - this.L.ex) / this.S; }

  /** Where a coach mark points (CSS px), kept clear of the screen's sides so the bubble fits. */
  anchor(a: Anchor, sim: WzlotSim): { x: number; y: number } | null {
    const p = this.rawAnchor(a, sim);
    if (!p) return null;
    const m = Math.min(170 * this.L.u, this.L.w / 2);
    return { x: clamp(p.x, m, this.L.w - m), y: p.y };
  }

  private rawAnchor(a: Anchor, sim: WzlotSim): { x: number; y: number } | null {
    const L = this.L, e = sim.eaglet;
    switch (a) {
      case 'eaglet': return { x: this.sx(e.x), y: this.sy(e.y) - 18 * L.u };
      case 'sun': return { x: this.sunPos.x, y: this.sunPos.y + 24 * L.u };
      case 'crag': {
        const g = sim.terrain.byIndex(sim.granIdx);
        if (!g) return null;
        return { x: clamp(this.sx(g.crag), 40, L.w - 40), y: clamp(this.sy(g.cragY), L.top + 40, L.bottom - 20) };
      }
      case 'thermal': return this.lastThermal ? { x: clamp(this.sx(this.lastThermal.x), 40, L.w - 40), y: clamp(this.sy(this.lastThermal.y), L.top + 40, L.bottom - 20) } : null;
      case 'night': return { x: L.w * 0.12, y: L.cardY };
      default: return null;
    }
  }

  // ── events ─────────────────────────────────────────────────────
  on(e: SimEvent, sim: WzlotSim): void {
    const L = this.L, u = L.u, hud = this.hud;
    const ex = this.sx(sim.eaglet.x), ey = this.sy(sim.eaglet.y);
    const gold = '#ffd36b';
    switch (e.type) {
      case 'dawn':
        this.trailN = 0;
        this.track.fill(-1);
        this.snap = true;
        break;
      case 'takeoff':
        this.particles.burst(ex, ey, 14, { color: '#f4ecdc', size: 2.5, speed: 90, spread: Math.PI, angle: -Math.PI / 2, g: 120 });
        break;
      case 'perfect': {
        hud.float(e.chain > 1 ? t('fx.chain', { n: e.chain }) : t('fx.perfect'), ex, ey - 30 * u, gold, 18 + Math.min(6, e.chain));
        hud.float(`+${fmtInt(e.pts)}`, ex + 30 * u, ey - 6 * u, '#fff6dc', 15, 0.9);
        this.particles.burst(ex, ey, 18 + e.chain * 3, { color: gold, size: 3, speed: 170, shape: 'spark', g: 60, life: 0.7 });
        this.shake.add(0.12);
        break;
      }
      case 'fever':
        hud.say(e.band ? t('fx.bandFever') : t('fx.fever'), '×2', '#ffcf5a', 2);
        this.particles.burst(ex, ey, 60, { color: '#ffcf5a', size: 3.5, speed: 260, shape: 'spark', g: 40, life: 1 });
        this.flash = 1;
        this.shake.add(0.35);
        break;
      case 'feverEnd':
        hud.float(t('fx.feverEnd'), ex, ey - 26 * u, '#f6e6c8', 14);
        break;
      case 'bump':
        hud.float(t('fx.bump'), ex, ey - 24 * u, '#f2b28a', 17);
        this.particles.burst(ex, ey + 6, 16, { color: rgb(this.land(sim, sim.eaglet.x).ground), size: 3, speed: 120, angle: -Math.PI / 2, spread: 2, g: 420 });
        this.shake.add(0.3);
        break;
      case 'coin':
        this.particles.burst(this.sx(e.x), this.sy(e.y), 6, { color: '#ffe08a', size: 2, speed: 80, g: 0, life: 0.4 });
        if (e.streak >= 5 && e.streak % 5 === 0) hud.float(`×${e.streak}`, this.sx(e.x), this.sy(e.y) - 14, gold, 14, 0.7);
        break;
      case 'orb':
        hud.float(t('fx.orb'), this.sx(e.x), this.sy(e.y) - 20 * u, '#cdeeff', 17);
        this.particles.burst(this.sx(e.x), this.sy(e.y), 26, { color: '#d9f3ff', size: 2.5, speed: 200, shape: 'ring', g: 0, life: 0.6 });
        this.shake.add(0.15);
        break;
      case 'cloud':
        hud.float(`${t('fx.cloud')} +${fmtInt(e.pts)}`, ex, ey + 30 * u, '#ffffff', 17);
        this.particles.burst(ex, ey, 20, { color: 'rgba(255,255,255,.9)', size: 5, speed: 80, g: -10, drag: 2, life: 1 });
        break;
      case 'gran':
        hud.say(t('fx.gran', { n: e.index + 1 }), e.sun > 0 ? t('fx.sun', { n: Math.round(e.sun) }) : `+${fmtInt(e.pts)}`, '#ffe3a0');
        this.particles.burst(ex, ey, 30, { color: '#fff1c8', size: 3, speed: 160, shape: 'spark', g: 30, life: 0.9 });
        if (e.sun > 0) this.particles.burst(this.sunPos.x, this.sunPos.y, 24, { color: '#ffd36b', size: 2.5, speed: 120, shape: 'spark', g: 0, life: 0.8 });
        break;
      case 'leap':
        this.shake.add(0.2);
        this.particles.burst(ex, ey, 24, { color: '#fff1c8', size: 2.5, speed: 150, angle: Math.PI, spread: 1.4, g: 80 });
        break;
      case 'leapDone':
        hud.float(`${t('fx.leap')} +${fmtInt(e.pts)}`, ex, ey - 40 * u, gold, 19);
        break;
      case 'land':
        if (e.pts > 0) hud.float(`${t('fx.air', { n: e.air.toFixed(1) })} +${fmtInt(e.pts)}`, ex, ey - 22 * u, '#fff6dc', 14, 1);
        if (e.cls === 'smooth' || e.cls === 'near') this.particles.burst(ex, ey + 4, 8, { color: 'rgba(255,240,210,.9)', size: 2, speed: 70, angle: Math.PI, spread: 1, g: 100 });
        break;
      case 'catch':
        hud.float(t('fx.caught'), ex, ey - 30 * u, '#fff1d6', 17, 1.6);
        break;
      case 'thermalRise':
        this.lastThermal = { x: e.thermal.x, y: e.thermal.base + 0.5 };
        break;
      case 'thermal':
        hud.float(t('fx.thermal'), ex, ey - 26 * u, '#ffd8a8', 16);
        break;
      case 'climbTop':
        hud.float(`+${fmtInt(e.pts)}`, ex, ey - 20 * u, '#ffe7c0', 15);
        break;
      case 'nightfall':
        this.shake.add(0.1);
        break;
      case 'blockEnd':
        if (e.block.kind === 'push' && e.block.blind) hud.say(t('fx.blind', { n: Math.round(e.sunHeld) }), e.verdict ? `+${fmtInt(e.pts)}` : '', '#f3e7ff', 2.6);
        else if (e.verdict && e.block.kind === 'push') hud.float(`${t('fx.pushPass')} +${RULES.pushSun} s`, this.sunPos.x, this.sunPos.y + 46 * u, '#ffe08a', 18, 1.8);
        else if (e.verdict && e.block.kind === 'rest') hud.float(t('fx.restPass'), ex, ey - 40 * u, '#ffd8a8', 15, 1.6);
        break;
      case 'lesson':
        hud.say(t('fx.lesson', { text: e.text }), '', '#e6f4c8', 2.6);
        break;
      case 'nest':
        hud.say(t('fx.nest', { m: e.level }), t('tally.nest', { m: e.level }), '#ffe3a0', 2.8);
        break;
      case 'hatch':
        hud.say(t('hatch', { n: e.n }), '', '#fff1d6', 2.8);
        break;
      default:
        break;
    }
  }

  // ── the frame ──────────────────────────────────────────────────
  update(dt: number, sim: WzlotSim): void {
    this.time += dt;
    const L = this.L, e = sim.eaglet, T = sim.terrain;
    // the camera: fit the ground ahead and the eaglet, zoom out as it climbs
    const ahead = (L.w - L.ex) / this.S;
    const low = T.lowest(e.x - 0.5, e.x + Math.min(4, ahead));
    const top = Math.max(e.y, T.height(e.x)) + 0.4;
    const want = clamp(top - low + 0.25, 1.15, 3.8);
    this.span = this.snap ? want : approach(this.span, want, dt, want > this.span ? 0.25 : 0.9);
    const S = Math.min((L.bottom - L.top) / (this.span + 0.12), L.w / L.minWorldW, L.maxS);
    this.S = this.snap ? S : approach(this.S, S, dt, 0.2);
    this.camX = this.snap || Math.abs(e.x - this.camX) > 3 ? e.x : approach(this.camX, e.x, dt, 0.05);
    const floor = low - 0.12;
    this.floorY = this.snap ? floor : approach(this.floorY, floor, dt, 0.3);
    this.snap = false;
    // the trail
    this.trailT += dt;
    if (e.airborne || e.mode === 'ground') {
      if (this.trailT > 0.025) {
        this.trailT = 0;
        const i = this.trailI * 3;
        this.trail[i] = e.x;
        this.trail[i + 1] = e.y;
        this.trail[i + 2] = sim.fever ? 1 : 0;
        this.trailI = (this.trailI + 1) % TRAIL;
        this.trailN = Math.min(TRAIL, this.trailN + 1);
      }
    } else this.trailN = 0;
    this.fold = approach(this.fold, sim.held && sim.dayPhase === 'fly' ? 1 : 0, dt, 0.05);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    // the sky follows the day: afternoon to dusk, night at nightfall, dawn in the nest
    const phase = sim.dayPhase === 'nest' ? 0.12 : sim.dayPhase === 'fly' ? 0.5 + 0.5 * sim.sunAt : 1.35;
    this.skyPhase = approach(this.skyPhase, phase, dt, sim.dayPhase === 'nest' ? 0.6 : 1.2);
    skyAt(this.skyPhase, this.sky);
    // the sun's arc history
    if (sim.dayPhase === 'fly') {
      const b = Math.min(BINS - 1, Math.floor(this.sunQ(sim) * BINS));
      const mark = sim.inPush && sim.sunFrac > 0.25 && !sim.blind ? 1 : sim.inRest ? 2 : 0;
      this.track[b] = Math.max(this.track[b], mark) as -1 | 0 | 1 | 2;
    }
    // Leon: beside the eaglet, a little ahead and above (on the nest's rim at home)
    const home = sim.dayPhase === 'nest' || sim.dayPhase === 'tally';
    const nx = this.sx(0), ny = this.sy(T.height(0));
    const tx = home ? nx + 46 * L.u : this.sx(e.x) + 0.32 * this.S;
    const ty = home ? ny - 18 * L.u : this.sy(e.y) - 0.24 * this.S + Math.sin(this.time * 2.3) * 5;
    this.larkX = approach(this.larkX || tx, clamp(tx, 20, L.w - 20), dt, 0.18);
    this.larkY = approach(this.larkY || ty, clamp(ty, L.top + 30, L.bottom - 20), dt, 0.18);
    this.particles.update(dt);
    this.hud.update(dt, sim);
  }

  private sunQ(sim: WzlotSim): number { return 0.5 + 0.5 * sim.sunAt; }

  private land(sim: WzlotSim, x: number): LandLook {
    const g = sim.terrain.granAt(x);
    return LAND_LOOK[LANDS[(g?.index ?? 0) % LANDS.length]];
  }

  draw(sim: WzlotSim): void {
    const ctx = this.ctx, L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 10);
    ctx.save();
    ctx.translate(off.x, off.y);
    const night = this.sky.night;
    paintSky(ctx, -12, -12, L.w + 24, L.h + 24, this.skyPhase, this.sky, this.time, false);
    this.drawStars(ctx, night);
    const g0 = sim.terrain.granAt(this.camX);
    const land: Land = LANDS[(g0?.index ?? 0) % LANDS.length];
    this.drawRanges(ctx, land);
    // the cloud deck behind the sun: the sun is the band's gauge, and a camera zoomed out (a tablet, a high
    // flight) brings the deck up to its arc
    this.drawClouds(ctx);
    this.drawSun(ctx, sim);
    this.drawThermals(ctx, sim);
    this.drawGround(ctx, sim);
    this.drawNest(ctx, sim);
    this.drawPickups(ctx, sim);
    this.drawTrail(ctx);
    this.drawBirds(ctx, sim);
    this.particles.draw(ctx);
    this.drawNight(ctx, sim);
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,236,170,${(0.35 * this.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    this.hud.draw(ctx, sim, { x: this.larkX, y: this.larkY - 10 * L.u }, this.time);
  }

  private drawStars(ctx: CanvasRenderingContext2D, night: number): void {
    if (night <= 0.02) return;
    const L = this.L;
    ctx.fillStyle = '#fff8e6';
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = night * (0.3 + 0.5 * hash(i * 3 + 3)) * (0.75 + 0.25 * Math.sin(this.time * 1.7 + i));
      ctx.fillRect(hash(i * 3 + 1) * L.w, hash(i * 3 + 2) * L.h * 0.6, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  private shade(c: RGB, haze: number): RGB {
    mixInto(this.tmp, c, this.sky.mid, haze);
    mixInto(this.tmp, this.tmp, this.sky.light, 0.12);
    return mixInto(this.tmp, this.tmp, NIGHT, 0.6 * this.sky.night);
  }

  private drawRanges(ctx: CanvasRenderingContext2D, land: Land): void {
    const L = this.L, Lk = LAND_LOOK[land], seed = LANDS_SEED[land];
    const unit = Math.max(160, Math.min(L.h, L.w * 0.8));
    const base = L.bottom - (L.bottom - L.top) * 0.18;
    const x = this.camX;
    paintRange(ctx, L.w, x * 0.06, 1.5 / unit, base - unit * 0.1, unit * 0.34, this.shade(Lk.far, 0.5), land, 0, seed, L.h + 4);
    paintRange(ctx, L.w, 3 + x * 0.14, 2 / unit, base + unit * 0.02, unit * 0.3, this.shade(Lk.mid, 0.32), land, 1, seed + 10, L.h + 4);
    paintRange(ctx, L.w, 6 + x * 0.3, 2.8 / unit, base + unit * 0.14, unit * 0.22, this.shade(Lk.near, 0.18), land, 2, seed + 20, L.h + 4);
  }

  /** The sun on its arc, the arc's history, the night's end of it; the band's gauge on the sun. */
  private drawSun(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const L = this.L, u = L.u;
    const at = (q: number) => ({ x: L.arcX0 + (L.arcX1 - L.arcX0) * q, y: L.arcTop + L.arcH * (1 - Math.sin(Math.PI * q)) });
    // the track from noon to the night
    ctx.lineWidth = 3 * u;
    ctx.lineCap = 'round';
    for (let b = 0; b < BINS; b++) {
      const q0 = 0.5 + (0.5 * b) / BINS, q1 = 0.5 + (0.5 * (b + 1)) / BINS;
      const a = at(q0), c = at(q1);
      const m = this.track[b];
      ctx.strokeStyle = m === 1 ? 'rgba(255,200,70,.95)' : m === 2 ? 'rgba(140,200,235,.8)' : m === 0 ? 'rgba(255,250,235,.55)' : 'rgba(255,250,235,.22)';
      ctx.setLineDash(m < 0 ? [2, 6] : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    // the night waits at the arc's end
    const n = at(1);
    ctx.fillStyle = 'rgba(30,34,70,.75)';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 9 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f6edd2';
    ctx.beginPath();
    ctx.arc(n.x - 2 * u, n.y, 5 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,34,70,1)';
    ctx.beginPath();
    ctx.arc(n.x + 0.5 * u, n.y - 1.5 * u, 4.5 * u, 0, TAU);
    ctx.fill();
    if (sim.dayPhase === 'tally' || sim.dayPhase === 'dusk') {
      this.sunPos = at(1);
      return;
    }
    const p = at(this.sunQ(sim));
    this.sunPos = p;
    const meter = sim.inPush ? sim.meter() : null;
    const charge = sim.inPush && !sim.blind && !sim.fever ? sim.charge : 0;
    paintSunGauge(ctx, p.x, p.y, L.sunR, meter, charge, sim.blind, this.time, mix(this.sky.sun, [255, 190, 90], 0.35 * sim.sunAt));
    if (sim.blind) {
      // the veil's word on the cloud, on a pale plate: 12 px and more
      ctx.font = font(750, 12.5 * u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const veil = t('fx.veil'), vw = ctx.measureText(veil).width, vy = p.y + L.sunR * 0.4;
      ctx.fillStyle = 'rgba(255,252,246,.72)';
      ctx.beginPath();
      ctx.roundRect(p.x - vw / 2 - 6, vy - 9 * u, vw + 12, 18 * u, 9 * u);
      ctx.fill();
      ctx.fillStyle = 'rgba(70,60,92,.95)';
      ctx.fillText(veil, p.x, vy);
    }
  }

  private drawClouds(ctx: CanvasRenderingContext2D): void {
    const L = this.L, y = this.sy(RULES.cloudY);
    if (y < L.top - 80 || y > L.bottom) return;
    const step = 0.9, first = Math.floor(this.wx(-60) / step);
    for (let i = first; i < first + 40; i++) {
      const wx = i * step + hash(i) * 0.4;
      const px = this.sx(wx);
      if (px > L.w + 80) break;
      const k = 0.7 + 0.5 * hash(i + 9);
      paintCloud(ctx, px, y - 0.04 * this.S + hash(i + 3) * 0.06 * this.S, 0.6 * k * this.S, 0.2 * k * this.S, 0.85 * (1 - 0.6 * this.sky.night), i);
    }
  }

  private drawThermals(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    for (const th of sim.thermals) {
      const x = this.sx(th.x);
      if (x < -60 || x > this.L.w + 60) continue;
      const floor = this.sy(th.base), top = this.sy(th.base + 1 + 1.6 * sim.T);
      paintThermal(ctx, x, floor, top, RULES.thermalHalf * this.S, sim.T, this.time, clamp(th.age / 0.8) * (th.used ? 0.45 : 1), this.opts.reducedMotion);
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const L = this.L, T = sim.terrain;
    const x0 = this.wx(-4), x1 = this.wx(L.w + 4);
    const step = 4 / this.S;
    for (const g of T.granie) {
      const a = Math.max(x0, g.x0), b = Math.min(x1, g.gapX1);
      if (a >= b) continue;
      const lk = LAND_LOOK[LANDS[g.index % LANDS.length]];
      const ground = this.shade(lk.ground, 0.04).slice() as RGB;
      const strata = this.shade(lk.strata, 0.04).slice() as RGB;
      ctx.fillStyle = rgb(ground);
      ctx.beginPath();
      ctx.moveTo(this.sx(a), L.h + 4);
      for (let x = a; x <= b + step; x += step) ctx.lineTo(this.sx(Math.min(x, b)), this.sy(T.height(Math.min(x, b))));
      ctx.lineTo(this.sx(b), L.h + 4);
      ctx.closePath();
      ctx.fill();
      // strata following the curve, Tiny Wings' stripes in sandstone
      for (let k = 1; k <= 4; k++) {
        const d = 0.05 * k + 0.02 * k * k;
        ctx.strokeStyle = rgb(strata, 0.5 - k * 0.07);
        ctx.lineWidth = Math.max(1.5, (0.022 - 0.003 * k) * this.S);
        ctx.beginPath();
        for (let x = a; x <= b + step; x += step * 2) {
          const xx = Math.min(x, b);
          ctx.lineTo(this.sx(xx), this.sy(T.height(xx) - d));
        }
        ctx.stroke();
      }
      // the sunlit rim and its grass
      ctx.strokeStyle = rgb(mix(ground, [255, 246, 222], 0.55));
      ctx.lineWidth = Math.max(2, 0.012 * this.S);
      ctx.beginPath();
      for (let x = a; x <= b + step; x += step) {
        const xx = Math.min(x, b);
        ctx.lineTo(this.sx(xx), this.sy(T.height(xx)) + 1);
      }
      ctx.stroke();
      ctx.strokeStyle = rgb(this.shade(lk.green, 0.05), 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const gs = 0.11;
      for (let x = Math.ceil(a / gs) * gs; x < b; x += gs) {
        if (hash(Math.round(x / gs)) < 0.55 || T.slope(x) > 0.5) continue;
        const px = this.sx(x), py = this.sy(T.height(x));
        const hh = (4 + 5 * hash(Math.round(x / gs) + 3)) * this.L.u;
        ctx.moveTo(px, py);
        ctx.lineTo(px - 2, py - hh);
        ctx.moveTo(px, py);
        ctx.lineTo(px + 3, py - hh * 0.8);
      }
      ctx.stroke();
      // the crag's flag of light: the leap starts here
      const cx = this.sx(g.crag), cy = this.sy(g.cragY);
      if (cx > -20 && cx < L.w + 20) {
        ctx.strokeStyle = 'rgba(94,61,34,.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 0.16 * this.S);
        ctx.stroke();
        ctx.fillStyle = '#ffcf5a';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 0.16 * this.S);
        ctx.lineTo(cx + 0.09 * this.S, cy - 0.13 * this.S + Math.sin(this.time * 5) * 2);
        ctx.lineTo(cx, cy - 0.1 * this.S);
        ctx.closePath();
        ctx.fill();
      }
    }
    // the gorges' mist: soft puffs low in the gap
    for (const g of T.granie) {
      const a = this.sx(g.gapX0), b = this.sx(g.gapX1);
      if (b < -60 || a > L.w + 60) continue;
      const y = this.sy(g.catchY) + 0.08 * this.S, w = b - a;
      const drift = Math.sin(this.time * 0.4 + g.index) * 0.04 * w;
      for (let i = 0; i < 3; i++) paintCloud(ctx, a + w * (0.25 + 0.25 * i) + drift, y + (i % 2) * 0.05 * this.S, w * 0.55, 0.22 * this.S, 0.75 * (1 - 0.5 * this.sky.night), g.index * 7 + i, '250,246,240');
    }
  }

  private drawNest(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const x = this.sx(0), y = this.sy(sim.terrain.height(0));
    if (x < -120 || x > this.L.w + 120) return;
    const p = sim.p;
    // the nest's crag: a rocky spire under it, down to the floor of the screen
    const lk = LAND_LOOK[LANDS[0]];
    paintSpire(ctx, x - 0.12 * this.S, this.L.h + 4, y + 0.02 * this.S, 0.3 * this.S, this.shade(lk.near, 0.05).slice() as RGB, this.shade(lk.strata, 0.05).slice() as RGB);
    paintNestFamily(ctx, x - 0.02 * this.S, y + 0.01 * this.S, Math.max(46, 0.32 * this.S), p.nest, p.eggs, p.chicks, this.time);
  }

  private drawPickups(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const L = this.L, r = Math.max(4, 0.022 * this.S);
    for (const g of sim.terrain.granie) {
      if (this.sx(g.gapX1) < -20 || this.sx(g.x0) > L.w + 20) continue;
      for (const c of g.coins) {
        if (c.taken) continue;
        const px = this.sx(c.x);
        if (px < -10 || px > L.w + 10) continue;
        paintCoin(ctx, px, this.sy(c.y), r, this.time, 1);
      }
      for (const o of g.orbs) {
        if (o.taken) continue;
        const px = this.sx(o.x);
        if (px < -30 || px > L.w + 30) continue;
        paintOrb(ctx, px, this.sy(o.y), Math.max(10, 0.06 * this.S), this.time);
      }
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    const n = this.trailN;
    if (n < 2) return;
    ctx.lineCap = 'round';
    for (let k = 1; k < n; k++) {
      const i0 = ((this.trailI - n + k - 1 + TRAIL) % TRAIL) * 3, i1 = ((this.trailI - n + k + TRAIL) % TRAIL) * 3;
      const a = k / n;
      const fever = this.trail[i1 + 2] > 0;
      ctx.strokeStyle = fever ? `rgba(255,${190 + Math.round(40 * Math.sin(k * 0.5 + this.time * 8))},70,${(0.9 * a).toFixed(3)})` : `rgba(255,252,240,${(0.45 * a).toFixed(3)})`;
      ctx.lineWidth = (fever ? 7 : 3) * a * this.L.u;
      ctx.beginPath();
      ctx.moveTo(this.sx(this.trail[i0]), this.sy(this.trail[i0 + 1]));
      ctx.lineTo(this.sx(this.trail[i1]), this.sy(this.trail[i1 + 1]));
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  private drawBirds(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const L = this.L, e = sim.eaglet;
    const size = Math.max(26, 0.13 * this.S);
    const x = this.sx(e.x), y = this.sy(e.y);
    // the mother: under the eaglet in a catch, carrying it
    if (e.caught) {
      const k = e.mode === 'catch' ? clamp(e.catchT / RULES.swoop) : 1;
      paintEagle(ctx, x - (1 - k) * L.w * 0.4, y + size * 0.5 - (1 - k) * L.h * 0.3, size * 2, 0.05, this.time * 6, 1, 1);
    }
    const pose = this.pose;
    pose.stage = sim.plumage;
    pose.fold = sim.dayPhase === 'dusk' || e.mode === 'nest' ? 0.9 : this.fold;
    pose.spread = e.mode === 'climb' ? 0.95 : 0.7;
    pose.flap = e.mode === 'climb' ? this.time * 10 : 0;
    pose.glow = sim.fever ? 0.7 + 0.3 * Math.sin(this.time * 10) : 0;
    const lift = e.mode === 'ground' || e.mode === 'nest' ? size * 0.22 : 0;
    if (sim.fever) {
      const g = ctx.createRadialGradient(x, y - lift, 0, x, y - lift, size * 1.6);
      g.addColorStop(0, 'rgba(255,214,110,.5)');
      g.addColorStop(1, 'rgba(255,214,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - size * 2, y - lift - size * 2, size * 4, size * 4);
    }
    const squash = 1 + 0.12 * this.fold;
    ctx.save();
    ctx.translate(x, y - lift);
    ctx.scale(squash, 1 / squash);
    paintEaglet(ctx, 0, 0, size, e.mode === 'nest' ? 0 : e.angle, pose);
    ctx.restore();
    if (sim.dayPhase === 'dusk' || (e.mode === 'nest' && sim.dayPhase === 'tally')) {
      ctx.font = font(700, 15 * L.u, SERIF, true);
      ctx.fillStyle = 'rgba(255,248,230,.9)';
      ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const k = (this.time * 0.6 + i / 3) % 1;
        ctx.globalAlpha = Math.sin(Math.PI * k);
        ctx.fillText('z', x + size * 0.4 + k * 18, y - lift - size * 0.5 - k * 26);
      }
      ctx.globalAlpha = 1;
    }
    // Leon
    const home = sim.dayPhase === 'nest' || sim.dayPhase === 'tally';
    paintLark(ctx, this.larkX, this.larkY, Math.max(18, 0.075 * this.S), this.time * 16, home);
  }

  /** The night: it creeps in from the left as the day runs out, and covers all at nightfall. */
  private drawNight(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const L = this.L;
    if (sim.dayPhase !== 'fly') return;
    const k = clamp(1 - sim.dayLeft / 20);
    if (k <= 0) return;
    const w = L.w * (0.15 + 0.55 * k);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgba(18,20,48,${(0.85 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(18,20,48,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-12, -12, w + 12, L.h + 24);
    ctx.fillStyle = '#fff8e6';
    for (let i = 0; i < 18; i++) {
      const px = hash(i * 5 + 1) * w * 0.8;
      ctx.globalAlpha = k * (1 - px / w) * (0.5 + 0.5 * Math.sin(this.time * 2 + i));
      ctx.fillRect(px, L.top + hash(i * 5 + 2) * (L.bottom - L.top) * 0.6, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  /** Where things are (the hud and the targets read it). */
  get layout(): Layout { return this.L; }
}

export { C };
