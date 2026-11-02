/**
 * Posłaniec's play view, all on the canvas: a pseudo-3D Roman road seen from behind the messenger
 * (OutRun's projection: every point scaled by 1/z from a vanishing point, the road drawn in strips
 * from far to near, things sorted far → near), gently curving through the hills of Asia at dawn;
 * the obstacles, drachmas and gifts on it; cypresses, olives and milestones beside it; the
 * watchtowers of Strażnice with their fires; the heights' golden road above the road; the next city
 * on the far hills.  The signal in sight: the ribbon of dawn across the sky (ribbon.ts), the dawn
 * glow under the feet (the live level, a ring at the threshold) and the ladder of light beside the
 * runner (the hold).  It only reads the sim (sim.ts); the HUD lives in hud.ts, the calibration in
 * intro.ts.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { LAG_SEC } from '../kit/trace';
import type { Tool } from '../../tools';
import { CITIES, CITY_IDS, CLOAKS, missionById } from './content';
import { Hud } from './hud';
import { t } from './i18n';
import { PoslaniecIntro } from './intro';
import { layout, type Layout } from './layout';
import { cloakOf, type PoslaniecProgress } from './meta';
import {
  C, SERIF, font, hash, hex, mix, paintCity, paintCoin, paintFire, paintHills, paintRunner, paintSandals, paintSatchel, paintSky, rgb,
  skyAt, type RGB, type RunnerPose, type SkyLook,
} from './paint';
import { paintRibbon } from './ribbon';
import { RULES, type PoslaniecSim, type SimEvent, type Tower } from './sim';
import { groundAt, type Coin, type Obstacle, type Power } from './track';

const LW = RULES.laneW;
const ROAD = 2.55;
const SEG = 2.5;
const AHEAD = RULES.ahead - 5;
const TAU = Math.PI * 2;

const PAVE: [RGB, RGB] = [hex('#c7ad87'), hex('#b49873')];
const KERB: [RGB, RGB] = [hex('#e6d3ae'), hex('#8f7a5e')];
const GOLD_PAVE: [RGB, RGB] = [hex('#f4d78f'), hex('#e6bf68')];
const STONE: RGB = hex('#d4bf98');
const WOOD: RGB = hex('#8a5a34');

type ItemKind = 'ob' | 'coin' | 'power' | 'tower' | 'decor' | 'mile' | 'runner' | 'gone' | 'inn';
interface Item { z: number; kind: ItemKind; ref: Obstacle | Coin | Power | Tower | null; x: number; n: number }

/** The road's scenery per leg of the journey: which trees grow beside it. */
const LEG_TREES: readonly (readonly ('cypress' | 'olive' | 'poplar' | 'vine' | 'palm')[])[] = [
  ['cypress', 'olive'], ['olive', 'poplar'], ['poplar', 'vine'], ['olive', 'vine'], ['cypress', 'vine'], ['palm', 'olive'],
];

function roman(n: number): string {
  const R: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of R) while (n >= v) { out += s; n -= v; }
  return out;
}

export class PoslaniecView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new PoslaniecIntro();
  private readonly fx = new Particles(360);
  private readonly shake: Shake;
  private clock = 0;
  private fadeIn = 1;
  // the camera
  private camZ = -RULES.ahead;
  private camX = 0;
  private camY = 2.8;
  private ground = 0;
  private K = 0;
  private hillOff = 0;
  private readonly P = { x: 0, y: 0, s: 0 };
  // the light and the signal's pictures
  private dusk = 0;
  private mist = 0;
  private haze = 0;
  private heightsA = 0;
  private glowA = 0;
  private ladderA = 0;
  private rungFlash = 0;
  private sky: SkyLook = skyAt(0);
  private readonly tmp: RGB = [0, 0, 0];
  private readonly items: Item[] = [];
  private nItems = 0;
  private readonly towerFlash = new Map<number, number>();
  private innZ = -1;
  private flash = 0;
  private flashColor = '255,214,120';
  private cloak = 0;
  private readonly pose: RunnerPose = { stride: 0, air: 0, slide: 0, lean: 0, squash: 0, stumble: 0, wool: CLOAKS[0].wool, trim: CLOAKS[0].trim, t: 0, alpha: 1 };
  private lastX = 0;
  private lean = 0;
  private readonly lag: number;
  private readonly lagLabel: string;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; tool: Tool }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
    this.hud.resize(this.L);
    this.shake = new Shake(opts.reducedMotion);
    this.lag = LAG_SEC[opts.tool];
    this.lagLabel = t('hud.lag', { n: this.lag });
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h);
    this.hud.resize(this.L);
  }

  start(p: PoslaniecProgress): void {
    this.fadeIn = 0.7;
    this.cloak = cloakOf(p);
  }

  intro(dt: number, p: number, progress: PoslaniecProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── world → screen ──────────────────────────────────────────────
  /** The road's bend at `dz` m ahead (m sideways): visual only, the lanes stay straight in the rules. */
  private bend(dz: number): number { return this.K * dz * dz * 0.0032; }

  private proj(x: number, y: number, z: number): boolean {
    const dz = z - this.camZ;
    if (dz < 0.35) return false;
    const s = this.L.f / dz;
    this.P.s = s;
    this.P.x = this.L.cx + (x + this.bend(dz) - this.camX) * s;
    this.P.y = this.L.horizon - (y - this.camY) * s;
    return true;
  }

  /** How visible a thing at z is: it fades in out of the haze far ahead. */
  private fog(z: number): number { return clamp((AHEAD - (z - this.camZ)) / 22); }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: PoslaniecSim): void {
    const u = this.L.u, rm = this.opts.reducedMotion;
    const feet = this.proj(sim.x * LW, sim.y, sim.z) ? { x: this.P.x, y: this.P.y, s: this.P.s } : { x: this.w / 2, y: this.h * 0.8, s: 60 };
    const dust = (n: number, color = 'rgba(214,190,150,.9)') =>
      this.fx.burst(feet.x, feet.y, rm ? Math.ceil(n / 3) : n, { color, size: 3 * u, speed: 90 * u, angle: -Math.PI / 2, spread: 2.4, g: 300, life: 0.5 });
    switch (e.type) {
      case 'jump': dust(6); break;
      case 'land': dust(e.hard ? 12 : 6); if (e.hard) this.shake.add(0.18); break;
      case 'slide': dust(10, 'rgba(200,175,135,.85)'); break;
      case 'bump': this.shake.add(0.12); break;
      case 'stumble':
        this.shake.add(0.45);
        dust(16, 'rgba(190,160,120,.95)');
        this.hud.float(t('fx.stumble'), feet.x, feet.y - feet.s * 2, '#f2d2b0', 15, 1);
        break;
      case 'mule':
        this.hud.card(t('fx.mule'), '', { rank: 1, dur: 2.4 });
        break;
      case 'clear':
        this.fx.burst(feet.x, feet.y - feet.s * 0.8, rm ? 2 : 6, { color: 'rgba(255,240,210,.9)', shape: 'spark', size: 2.5 * u, speed: 140 * u, g: 0, life: 0.35 });
        break;
      case 'coin': {
        const c = e.coin;
        const ok = this.proj(c.lane * LW, c.y, Math.max(c.z, this.camZ + 2));
        this.fx.burst(ok ? this.P.x : feet.x, ok ? this.P.y : feet.y - 40, rm ? 2 : 5, { color: C.silver, shape: 'spark', size: 2.2 * u, speed: 120 * u, g: 0, life: 0.3 });
        this.hud.popCoin();
        break;
      }
      case 'combo':
        this.hud.float(t('fx.combo', { n: e.n, bonus: e.bonus }), feet.x, feet.y - feet.s * 2.4, '#e8ecff', 16, 1.2);
        break;
      case 'power':
        this.hud.float(t(e.kind === 'sandals' ? 'fx.sandals' : 'fx.satchel'), feet.x, feet.y - feet.s * 2.3, C.gold2, 16, 1.4);
        this.fx.burst(feet.x, feet.y - feet.s, rm ? 4 : 16, { color: C.gold2, shape: 'ring', size: 5 * u, speed: 120 * u, g: 0, life: 0.6 });
        break;
      case 'rung':
        this.rungFlash = 1;
        break;
      case 'heights':
        this.flash = 1;
        this.flashColor = '255,214,120';
        this.shake.add(0.2);
        this.fx.burst(feet.x, feet.y - feet.s, rm ? 8 : 36, { color: C.gold2, shape: 'spark', size: 3.5 * u, speed: 260 * u, g: -40, life: 0.9 });
        this.hud.float(e.bonus ? t('fx.bonus', { n: e.sec }) : t('fx.heights'), this.w / 2, this.L.horizon - 20 * u, C.gold2, e.bonus ? 17 : 22, 1.6, 40);
        this.hud.popScore();
        break;
      case 'tower': {
        this.towerFlash.set(e.tower.id, this.clock);
        if (e.lit) {
          for (const side of [-1, 1]) {
            if (this.proj(side * (ROAD + 1.7), 4.6, e.tower.z + 0.7)) {
              this.fx.burst(this.P.x, this.P.y, rm ? 3 : 10, { color: '#ffc04a', shape: 'spark', size: 2.5 * u, speed: 110 * u, g: -60, life: 0.8 });
            }
          }
        }
        break;
      }
      case 'blockEnd': {
        const b = e.block;
        if (b.kind === 'warmup') break;
        const kind = b.kind === 'rest' ? 'rest' : b.blind ? 'blind' : 'push';
        const verdict = e.verdict === null ? t('verdict.none') : t(`verdict.${kind}.${e.verdict ? 'pass' : 'near'}`);
        const tone = e.verdict === null ? '#7a7466' : e.verdict ? (b.kind === 'rest' ? '#3d5a8c' : '#b5650f') : '#7a5a3a';
        const samples = sim.trace.samples.filter(s => s.t >= e.t0 && s.t <= e.t1 + 0.01);
        const name = b.kind === 'rest' ? t('block.rest') : b.blind ? t('block.blind') : t('block.push');
        this.hud.blockCard({ name, verdict, tone, pay: e.pay, samples, blind: b.blind, t: 0, dur: 3.2 });
        if (b.kind === 'rest' && e.verdict) {
          this.hud.card(t('card.song'), t('card.pay', { n: e.pay }), { rank: 1, dur: 2.2, color: '#3d5a8c' });
        }
        break;
      }
      case 'blindReveal':
        this.flash = 0.6;
        this.flashColor = '236,236,244';
        break;
      case 'drachmas':
        if (e.why === 'combo') break;
        this.hud.float(`+${e.n}`, this.L.scoreX - 60 * u, this.L.scoreY + 110 * u, C.silver, 15, 1.3);
        break;
      case 'city': {
        const c = CITIES[e.city];
        this.hud.card(t(e.city === CITIES.length - 1 ? 'card.lap' : 'card.city', { city: c.name }), `${c.name} · ${c.ref}`, { rank: 0, dur: 3.4, color: '#7a3f12' });
        this.flash = 0.8;
        this.flashColor = '255,226,184';
        this.hud.popScore();
        break;
      }
      case 'cloak':
        this.cloak = e.index;
        this.hud.card(t('card.cloak', { name: CLOAKS[e.index].name }), '', { rank: 0, dur: 2.8, color: CLOAKS[e.index].wool });
        this.fx.burst(feet.x, feet.y - feet.s, rm ? 6 : 24, { color: CLOAKS[e.index].trim, size: 3 * u, speed: 160 * u, g: 60, life: 1 });
        break;
      case 'mission':
        this.hud.card(t('card.mission', { name: missionById(e.id)?.name ?? e.id }), t('card.pay', { n: RULES.missionPay }), { rank: 1, dur: 2.8 });
        break;
      case 'gift':
        this.hud.card(t('card.gift', { n: e.n }), '', { rank: 2, dur: 2.4 });
        break;
      case 'finale':
        this.innZ = sim.z + Math.max(18, sim.v * RULES.finale * 0.55);
        this.hud.card(t('finale.title'), t('finale.sub'), { rank: 2, dur: 3.6, color: '#7a3f12' });
        break;
      default:
        break;
    }
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: PoslaniecSim): void {
    this.clock += dt;
    this.fadeIn = Math.max(0, this.fadeIn - dt * 2);
    const L = this.L;
    // the camera rides behind the runner, follows its lane a little and rises with the heights
    this.camZ = sim.z - L.back;
    this.camX = approach(this.camX, sim.x * LW * 0.55, dt, 0.12);
    const floor = sim.onHeights ? sim.y : Math.min(sim.y, groundAt(sim.track.obstacles, sim.x, sim.z)) * 0.7;
    this.ground = approach(this.ground, floor, dt, sim.onHeights ? 0.25 : 0.18);
    this.camY = this.ground + L.high;
    const z = sim.z;
    const K = 0.85 * Math.sin(z / 230) * (0.55 + 0.45 * Math.sin(z / 83 + 1.3));
    this.K = approach(this.K, this.opts.reducedMotion ? K * 0.4 : K, dt, 0.4);
    this.hillOff += (this.K * 55 + 4) * dt * (sim.v / 10);
    // the light: evening in the watchtowers' blocks, mist in a blind block, haze when the signal fails
    this.dusk = approach(this.dusk, sim.resting ? 1 : sim.phase !== 'play' ? 0.75 : 0, dt, 1.4);
    this.mist = approach(this.mist, sim.blind ? 1 : 0, dt, 0.8);
    this.haze = approach(this.haze, sim.reliable || sim.phase !== 'play' ? 0 : 1, dt, 0.8);
    this.sky = skyAt(this.dusk, this.sky);
    this.heightsA = approach(this.heightsA, sim.onHeights ? 1 : 0, dt, 0.18);
    this.glowA = approach(this.glowA, sim.sighted ? 1 : 0, dt, 0.4);
    this.ladderA = approach(this.ladderA, sim.sighted || (sim.onHeights && sim.block?.kind === 'push' && !sim.block.blind) ? 1 : 0, dt, 0.3);
    this.rungFlash = Math.max(0, this.rungFlash - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    // the runner's lean into a lane change
    const vx = (sim.x - this.lastX) / Math.max(1e-3, dt);
    this.lastX = sim.x;
    this.lean = approach(this.lean, clamp(vx * 0.04, -0.22, 0.22), dt, 0.06);
    this.fx.update(dt);
    this.hud.update(dt, sim);
  }

  draw(sim: PoslaniecSim): void {
    const { ctx, L } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake.offset(1 / 60, 10);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    this.drawSky(sim);
    this.drawHills(sim);
    this.drawGround();
    this.drawRoad(0, PAVE, 1);
    this.drawTowerLight(sim);
    this.collect(sim);
    const onH = sim.heights === 'rise' || sim.heights === 'high' || sim.heights === 'glide';
    this.drawItems(sim, !onH);
    if (this.heightsA > 0.01) this.drawHeights(sim);
    if (onH) {
      this.drawGlow(sim);
      this.drawRunner(sim);
    }
    this.drawLadder(sim);
    this.fx.draw(ctx);
    this.drawOverlays(sim);
    ctx.restore();
    // the HUD does not shake
    paintRibbon(ctx, sim.trace.layout(L.ribbon, sim.t, { span: 40, minSpan: 4 }), { lagSec: this.lag, lagLabel: this.lagLabel, t: this.clock, u: L.u, alpha: 1 });
    this.hud.draw(sim);
    if (this.fadeIn > 0) {
      ctx.fillStyle = `rgba(255,226,184,${this.fadeIn})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // ── the backdrop ────────────────────────────────────────────────
  private drawSky(sim: PoslaniecSim): void {
    const L = this.L;
    const sun = 0.25 + 0.75 * clamp(sim.t / Math.max(30, sim.plannedSec)) - 0.5 * this.dusk;
    const sunX = L.cx + L.w * 0.18 - this.hillOff * 0.05 % L.w;
    paintSky(this.ctx, L.w, L.horizon, this.sky, ((sunX % (L.w * 1.4)) + L.w * 1.4) % (L.w * 1.4) - L.w * 0.2, sun, this.clock, this.hillOff);
    // stars come out in the evening
    if (this.dusk > 0.3) {
      const ctx = this.ctx;
      ctx.fillStyle = `rgba(255,248,230,${(this.dusk - 0.3) * 0.9})`;
      for (let i = 0; i < 40; i++) {
        const x = hash(i) * L.w, y = hash(i + 50) * L.horizon * 0.55;
        const r = 0.6 + hash(i + 99) * 1.1 + 0.3 * Math.sin(this.clock * 2 + i);
        ctx.fillRect(x, y, r, r);
      }
    }
  }

  private drawHills(sim: PoslaniecSim): void {
    const { ctx, L } = this;
    const hz = L.horizon, s = this.sky;
    const bottom = hz + 4;
    const scale = L.f / 500;
    paintHills(ctx, L.w, hz + 2, 70 * scale, this.hillOff * 0.15, s.hill[0], 1.7, bottom);
    // the next city on the far hills, nearer as the leg runs on
    const r = sim.route;
    const k = clamp(r.into / r.leg);
    const id = CITY_IDS[r.next];
    const cityX = L.cx + L.w * 0.22 - this.hillOff * 0.15 * 0.6;
    const wrap = ((cityX % (L.w * 1.5)) + L.w * 1.5) % (L.w * 1.5) - L.w * 0.25;
    paintCity(ctx, id, wrap, hz - 18 * scale, (40 + 120 * k * k) * scale, rgb(mix(s.hill[1], s.top, 0.25)));
    paintHills(ctx, L.w, hz + 2, 44 * scale, this.hillOff * 0.35 + 300, s.hill[1], 4.1, bottom, 14 * scale);
    paintHills(ctx, L.w, hz + 3, 22 * scale, this.hillOff * 0.7 + 900, s.hill[2], 2.9, bottom, 22 * scale);
  }

  private drawGround(): void {
    const { ctx, L } = this;
    const g = ctx.createLinearGradient(0, L.horizon, 0, L.h);
    g.addColorStop(0, rgb(mix(this.sky.ground, this.sky.glow, 0.25)));
    g.addColorStop(1, rgb(this.sky.ground2));
    ctx.fillStyle = g;
    ctx.fillRect(0, L.horizon, L.w, L.h - L.horizon + 20);
  }

  // ── the road ────────────────────────────────────────────────────
  private quad(x0: number, x1: number, y: number, z0: number, z1: number, color: string): void {
    const P = this.P, ctx = this.ctx;
    if (!this.proj(x0, y, z0)) return;
    const ax = P.x, ay = P.y;
    this.proj(x1, y, z0);
    const bx = P.x, by = P.y;
    this.proj(x1, y, z1);
    const cx = P.x, cy = P.y;
    this.proj(x0, y, z1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.lineTo(P.x, P.y);
    ctx.closePath();
    ctx.fill();
  }

  /** The road at height `y` in strips from far to near; the paving alternates, kerbs and ruts mark it. */
  private drawRoad(y: number, pave: [RGB, RGB], alpha: number): void {
    const glow = this.sky.glow, tmp = this.tmp, ctx = this.ctx;
    const z0 = Math.floor(this.camZ / SEG) * SEG;
    const n = Math.ceil(AHEAD / SEG) + 1;
    ctx.globalAlpha = alpha;
    for (let i = n; i >= 0; i--) {
      const za = Math.max(z0 + i * SEG, this.camZ + 0.4), zb = z0 + (i + 1) * SEG;
      if (zb <= za) continue;
      const stripe = Math.floor(za / SEG + 1e-6) & 1;
      const far = clamp((za - this.camZ) / AHEAD);
      const haze = far * far * 0.85;
      if (y === 0) {
        // the verge: banded grass that sells the speed
        const v = stripe ? this.sky.ground : mix(this.sky.ground, this.sky.ground2, 0.14);
        this.quad(-ROAD - 16, ROAD + 16, y - 0.01, za, zb, rgb(mixInto3(tmp, v, glow, haze * 0.6)));
      }
      this.quad(-ROAD, ROAD, y, za, zb, rgb(mixInto3(tmp, pave[stripe], glow, haze)));
      const kerb = rgb(mixInto3(tmp, KERB[stripe], glow, haze));
      this.quad(-ROAD - 0.32, -ROAD, y + 0.02, za, zb, kerb);
      this.quad(ROAD, ROAD + 0.32, y + 0.02, za, zb, kerb);
      // ruts worn by cartwheels between the lanes
      const rut = `rgba(90,70,50,${0.2 * (1 - haze)})`;
      for (const x of [-LW / 2, LW / 2]) this.quad(x - 0.05, x + 0.05, y + 0.005, za, zb, rut);
      if (stripe && y === 0 && far < 0.7) {
        // joints between the paving stones
        const j = `rgba(80,60,40,${0.18 * (1 - far)})`;
        this.quad(-ROAD, ROAD, y + 0.004, zb - 0.06, zb, j);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The towers' fires light the road around them in the evening. */
  private drawTowerLight(sim: PoslaniecSim): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const tw of sim.towers) {
      if (tw.fire === null || tw.fire < 0.05) continue;
      for (const side of [-1, 1]) {
        if (!this.proj(side * (ROAD + 0.6), 0, tw.z + 0.7)) continue;
        const r = this.P.s * (1.5 + 3 * tw.fire);
        const g = ctx.createRadialGradient(this.P.x, this.P.y, 0, this.P.x, this.P.y, r);
        g.addColorStop(0, `rgba(255,150,60,${0.28 * tw.fire * this.fog(tw.z)})`);
        g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(this.P.x, this.P.y, r, r * 0.35, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── things on and beside the road ───────────────────────────────
  private push(z: number, kind: ItemKind, ref: Item['ref'], x = 0, n = 0): void {
    let it = this.items[this.nItems];
    if (!it) this.items.push((it = { z, kind, ref, x, n }));
    it.z = z; it.kind = kind; it.ref = ref; it.x = x; it.n = n;
    this.nItems++;
  }

  private collect(sim: PoslaniecSim): void {
    this.nItems = 0;
    const zMin = this.camZ + 0.5, zMax = this.camZ + AHEAD;
    for (const o of sim.track.obstacles) if (o.z + o.len > zMin && o.z < zMax) this.push(Math.max(o.z, zMin), 'ob', o);
    for (const c of sim.track.coins) if (!c.taken && !c.high && c.z > zMin && c.z < zMax) this.push(c.z, 'coin', c);
    for (const p of sim.track.powers) if (!p.taken && p.z > zMin && p.z < zMax) this.push(p.z, 'power', p);
    for (const g of sim.track.gone) if (g.kind === 'ob' && g.item.z < zMax && g.item.z > zMin) this.push(g.item.z, 'gone', g.item as Obstacle, 0, g.t);
    for (const tw of sim.towers) if (tw.z > zMin && tw.z < zMax) { this.push(tw.z, 'tower', tw, -1); this.push(tw.z, 'tower', tw, 1); }
    // trees, rocks and milestones beside the road (a slot every 5 m)
    const k0 = Math.ceil(zMin / 5), k1 = Math.floor(zMax / 5);
    for (let k = k0; k <= k1; k++) {
      if (k % 20 === 0) this.push(k * 5, 'mile', null, -(ROAD + 0.9), k / 20);
      const r = hash(k * 13.7);
      if (r < 0.5) {
        const side = hash(k + 0.3) < 0.5 ? -1 : 1;
        const near = sim.resting ? 3.5 : 1.3;
        this.push(k * 5 + hash(k + 7) * 3, 'decor', null, side * (ROAD + near + hash(k + 5) * 6), k);
      }
    }
    if (this.innZ > 0 && this.innZ < zMax && this.innZ > zMin) this.push(this.innZ, 'inn', null);
    if (!(sim.heights === 'rise' || sim.heights === 'high' || sim.heights === 'glide')) this.push(sim.z, 'runner', null);
    // far → near (the runner before what passed it)
    const its = this.items;
    const view = its.slice(0, this.nItems);
    view.sort((a, b) => b.z - a.z || (a.kind === 'runner' ? 1 : b.kind === 'runner' ? -1 : 0));
    for (let i = 0; i < view.length; i++) its[i] = view[i];
  }

  private drawItems(sim: PoslaniecSim, withRunner: boolean): void {
    const legTrees = LEG_TREES[Math.max(0, Math.min(LEG_TREES.length - 1, sim.route.next - 1))];
    for (let i = 0; i < this.nItems; i++) {
      const it = this.items[i];
      switch (it.kind) {
        case 'ob': this.drawObstacle(it.ref as Obstacle, sim, 1); break;
        case 'gone': this.drawObstacle(it.ref as Obstacle, sim, clamp(1 - (sim.t - it.n) / 0.5)); break;
        case 'coin': this.drawCoin(it.ref as Coin); break;
        case 'power': this.drawPower(it.ref as Power); break;
        case 'tower': this.drawTower(it.ref as Tower, it.x); break;
        case 'decor': this.drawTree(it.z, it.x, legTrees[it.n % legTrees.length], it.n); break;
        case 'mile': this.drawMilestone(it.z, it.x, it.n); break;
        case 'inn': this.drawInn(it.z); break;
        case 'runner':
          if (withRunner) {
            this.drawGlow(sim);
            this.drawRunner(sim);
          }
          break;
      }
    }
  }

  /** A box in the world, its visible faces shaded: front (near), top, and the side toward the camera. */
  private box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, front: string, top: string, side: string): void {
    const ctx = this.ctx, P = this.P;
    z0 = Math.max(z0, this.camZ + 0.45);
    if (z1 <= z0) return;
    const pts: number[] = [];
    const put = (x: number, y: number, z: number) => { this.proj(x, y, z); pts.push(P.x, P.y); };
    // the near face's corners and the far face's
    put(x0, y0, z0); put(x1, y0, z0); put(x1, y1, z0); put(x0, y1, z0);
    put(x0, y0, z1); put(x1, y0, z1); put(x1, y1, z1); put(x0, y1, z1);
    const poly = (a: number, b: number, c: number, d: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pts[a * 2], pts[a * 2 + 1]);
      ctx.lineTo(pts[b * 2], pts[b * 2 + 1]);
      ctx.lineTo(pts[c * 2], pts[c * 2 + 1]);
      ctx.lineTo(pts[d * 2], pts[d * 2 + 1]);
      ctx.closePath();
      ctx.fill();
    };
    const dz = z0 - this.camZ, off = this.bend(dz);
    if (x1 + off < this.camX) poly(1, 5, 6, 2, side);
    if (x0 + off > this.camX) poly(0, 4, 7, 3, side);
    if (y1 < this.camY) poly(3, 2, 6, 7, top);
    else if (y0 > this.camY) poly(0, 1, 5, 4, top);
    poly(0, 1, 2, 3, front);
  }

  private shade(c: RGB, k: number, z: number): string {
    const far = clamp((z - this.camZ) / AHEAD);
    mixInto3(this.tmp, c, k >= 0 ? [255, 244, 225] : [30, 22, 30], Math.abs(k));
    mixInto3(this.tmp, this.tmp, this.sky.glow, far * far * 0.8);
    if (this.dusk > 0) mixInto3(this.tmp, this.tmp, [40, 36, 70], this.dusk * 0.35);
    return rgb(this.tmp);
  }

  private drawObstacle(o: Obstacle, sim: PoslaniecSim, fade: number): void {
    const ctx = this.ctx, R = RULES;
    // what the runner has passed fades as it slides under the camera, so it never hides the runner
    const passed = o.z + o.len < sim.z - 0.2 ? clamp((o.z + o.len - this.camZ - 1) / (this.L.back - 1)) * 0.7 : 1;
    const a = this.fog(o.z) * clamp((sim.t - o.born) / 0.35 + (o.born <= 0 ? 1 : 0)) * fade * passed * (o.hit && sim.ghost ? 0.55 : 1);
    if (a <= 0.01) return;
    ctx.globalAlpha = a;
    const x = o.lane * LW, z0 = o.z, z1 = o.z + o.len;
    const half = o.width === 3 ? ROAD - 0.1 : 0.62;
    switch (o.kind) {
      case 'wall': {
        this.box(x - half, x + half, 0, R.wallTop, z0, z1, this.shade(STONE, -0.05, z0), this.shade(STONE, 0.25, z0), this.shade(STONE, -0.25, z0));
        // the mortar between the stones
        if (this.proj(x - half, R.wallTop * 0.5, z0)) {
          const s = this.P.s, lx = this.P.x, ly = this.P.y;
          ctx.strokeStyle = 'rgba(90,70,50,.35)';
          ctx.lineWidth = Math.max(1, s * 0.03);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + half * 2 * s, ly);
          for (let k = 1; k < 4; k++) {
            const sx = lx + (k / 4) * half * 2 * s + (k & 1 ? 0.1 * s : 0);
            ctx.moveTo(sx, ly - (k & 1 ? 0 : R.wallTop * 0.5 * s));
            ctx.lineTo(sx, ly + (k & 1 ? R.wallTop * 0.5 * s : 0));
          }
          ctx.stroke();
        }
        break;
      }
      case 'column': {
        // a fallen marble column lying across the lane
        const top = R.wallTop, mid = top / 2;
        if (!this.proj(x - half, mid, z0 + o.len / 2)) break;
        const lx = this.P.x, ly = this.P.y, s = this.P.s;
        this.proj(x + half, mid, z0 + o.len / 2);
        const rx = this.P.x, ry = this.P.y, r = mid * s;
        const g = ctx.createLinearGradient(0, ly - r, 0, ly + r);
        g.addColorStop(0, this.shade(hex('#f3ead8'), 0.2, z0));
        g.addColorStop(0.5, this.shade(hex('#e2d4b8'), 0, z0));
        g.addColorStop(1, this.shade(hex('#a8977a'), -0.1, z0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(lx, ly - r);
        ctx.lineTo(rx, ry - r);
        ctx.lineTo(rx, ry + r);
        ctx.lineTo(lx, ly + r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,100,80,.3)';
        ctx.lineWidth = Math.max(1, s * 0.02);
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(lx, ly + k * r * 0.35);
          ctx.lineTo(rx, ry + k * r * 0.35);
          ctx.stroke();
        }
        // its broken drums
        ctx.fillStyle = this.shade(hex('#d9cbb0'), 0.1, z0);
        for (const ex of [lx, rx]) {
          ctx.beginPath();
          ctx.ellipse(ex, (ly + ry) / 2, r * 0.32, r, 0, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'arch': {
        // piers and a low stone arch (slide under); an aqueduct's arches across the whole road
        const n = o.width === 3 ? 3 : 1;
        const lintel = R.archGap;
        for (let k = 0; k < n; k++) {
          const cx = n === 3 ? (k - 1) * LW : x;
          const hw = LW / 2;
          this.box(cx - hw, cx - hw + 0.22, 0, lintel + 0.9, z0, z1, this.shade(STONE, -0.12, z0), this.shade(STONE, 0.2, z0), this.shade(STONE, -0.3, z0));
          this.box(cx + hw - 0.22, cx + hw, 0, lintel + 0.9, z0, z1, this.shade(STONE, -0.12, z0), this.shade(STONE, 0.2, z0), this.shade(STONE, -0.3, z0));
        }
        const x0 = n === 3 ? -1.5 * LW : x - LW / 2, x1 = n === 3 ? 1.5 * LW : x + LW / 2;
        this.box(x0, x1, lintel, lintel + 0.9, z0, z1, this.shade(hex('#cdb489'), 0, z0), this.shade(STONE, 0.25, z0), this.shade(STONE, -0.3, z0));
        // the arch's curve on its face and a keystone
        for (let k = 0; k < n; k++) {
          const cx = n === 3 ? (k - 1) * LW : x;
          if (!this.proj(cx, lintel, z0)) continue;
          const s = this.P.s, px = this.P.x, py = this.P.y;
          ctx.strokeStyle = 'rgba(80,60,40,.45)';
          ctx.lineWidth = Math.max(1, s * 0.05);
          ctx.beginPath();
          ctx.ellipse(px, py, (LW / 2 - 0.22) * s, 0.55 * s, 0, Math.PI, 0);
          ctx.stroke();
          ctx.fillStyle = this.shade(hex('#e8d8b6'), 0.1, z0);
          ctx.fillRect(px - 0.12 * s, py - 0.75 * s, 0.24 * s, 0.32 * s);
        }
        break;
      }
      case 'branch': {
        // an olive tree at the roadside reaching a low branch over the lane
        const side = x >= 0 ? 1 : -1;
        const tx = side * (ROAD + 0.5), zm = z0 + o.len / 2;
        if (!this.proj(tx, 0, zm)) break;
        const s = this.P.s, bx = this.P.x, by = this.P.y;
        this.proj(x - side * 0.7, R.archGap + 0.25, zm);
        const ex = this.P.x, ey = this.P.y;
        ctx.strokeStyle = this.shade(hex('#5e4430'), 0, zm);
        ctx.lineCap = 'round';
        ctx.lineWidth = 0.32 * s;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - side * 0.1 * s, by - 2.2 * s, bx - side * 0.5 * s, by - 2.3 * s);
        ctx.stroke();
        ctx.lineWidth = 0.17 * s;
        ctx.beginPath();
        ctx.moveTo(bx - side * 0.4 * s, by - 2.2 * s);
        ctx.quadraticCurveTo((bx + ex) / 2, ey - 0.8 * s, ex, ey);
        ctx.stroke();
        ctx.fillStyle = this.shade(hex('#7d8c5a'), 0, zm);
        for (let k = 0; k < 9; k++) {
          const q = k / 8;
          const lx = bx + (ex - bx) * q + Math.sin(k * 2.3) * 0.2 * s, ly = by - 2.3 * s + (ey - by + 2.3 * s) * q + 0.15 * s;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 0.36 * s, 0.24 * s, k, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'cart': {
        const top = R.cartTop;
        this.box(x - 0.6, x + 0.6, 0.45, 1.2, z0, z1, this.shade(WOOD, -0.05, z0), this.shade(WOOD, 0.15, z0), this.shade(WOOD, -0.3, z0));
        // a load of sacks and amphorae
        this.box(x - 0.52, x + 0.52, 1.2, top, z0 + 0.3, z1 - 0.2, this.shade(hex('#d8c29a'), 0, z0), this.shade(hex('#e8d6b0'), 0.15, z0), this.shade(hex('#b8a27a'), -0.2, z0));
        if (this.proj(x, 1.2, z0)) {
          const s = this.P.s, px = this.P.x, py = this.P.y;
          ctx.fillStyle = this.shade(hex('#b5603a'), 0, z0);
          for (const dx of [-0.3, 0, 0.3]) {
            ctx.beginPath();
            ctx.ellipse(px + dx * s, py - 0.42 * s, 0.13 * s, 0.26 * s, 0, 0, TAU);
            ctx.fill();
          }
          // the wheels
          ctx.fillStyle = this.shade(hex('#4a3020'), 0, z0);
          for (const dx of [-0.66, 0.66]) {
            this.proj(x + dx, 0.45, z0 + o.len * 0.3);
            ctx.beginPath();
            ctx.ellipse(this.P.x, this.P.y, 0.08 * this.P.s, 0.45 * this.P.s, 0, 0, TAU);
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(40,25,15,.5)';
          ctx.lineWidth = Math.max(1, s * 0.03);
          ctx.strokeRect(px - 0.6 * s, py, 1.2 * s, 0.75 * s);
        }
        break;
      }
      case 'wagon': {
        const top = R.wagonTop, body0 = z0 + (o.ramp ? R.rampLen : 0);
        if (o.ramp) {
          // the ramp of planks up to the roof
          const P = this.P;
          const pts: number[] = [];
          for (const [xx, yy, zz] of [[x - 0.55, 0, z0], [x + 0.55, 0, z0], [x + 0.55, top, body0], [x - 0.55, top, body0]] as const) {
            this.proj(xx, yy, Math.max(zz, this.camZ + 0.45));
            pts.push(P.x, P.y);
          }
          ctx.fillStyle = this.shade(hex('#a8794c'), 0.05, z0);
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (let k = 2; k < 8; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(70,45,25,.45)';
          ctx.lineWidth = 1;
          for (let k = 1; k < 6; k++) {
            const q = k / 6;
            ctx.beginPath();
            ctx.moveTo(pts[0] + (pts[6] - pts[0]) * q, pts[1] + (pts[7] - pts[1]) * q);
            ctx.lineTo(pts[2] + (pts[4] - pts[2]) * q, pts[3] + (pts[5] - pts[3]) * q);
            ctx.stroke();
          }
        }
        this.box(x - 0.66, x + 0.66, 0.4, top, body0, z1, this.shade(hex('#7d5233'), -0.05, body0), this.shade(hex('#a77a4f'), 0.2, body0), this.shade(hex('#5e3d24'), -0.2, body0));
        // painted bands along its side
        if (this.proj(x, 1.15, body0)) {
          const s = this.P.s;
          ctx.fillStyle = this.shade(hex('#b8412e'), 0, body0);
          ctx.fillRect(this.P.x - 0.66 * s, this.P.y - 0.06 * s, 1.32 * s, 0.12 * s);
        }
        break;
      }
      case 'goat': {
        const gx = o.lane * LW, zm = z0 + o.len / 2;
        if (!this.proj(gx, 0, zm)) break;
        const s = this.P.s, px = this.P.x, py = this.P.y, d = o.dir || 1;
        const step = Math.sin(sim.t * 14) * 0.08 * s;
        ctx.strokeStyle = this.shade(hex('#3a2a20'), 0, zm);
        ctx.lineWidth = 0.07 * s;
        for (const lx of [-0.25, -0.1, 0.12, 0.27]) {
          ctx.beginPath();
          ctx.moveTo(px + lx * s, py - 0.4 * s);
          ctx.lineTo(px + lx * s + (lx > 0 ? step : -step), py);
          ctx.stroke();
        }
        ctx.fillStyle = this.shade(hex('#4a3428'), 0, zm);
        ctx.beginPath();
        ctx.ellipse(px, py - 0.55 * s, 0.4 * s, 0.2 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = this.shade(hex('#efe6d4'), 0, zm);
        ctx.beginPath();
        ctx.ellipse(px - d * 0.08 * s, py - 0.55 * s, 0.14 * s, 0.13 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = this.shade(hex('#4a3428'), 0, zm);
        ctx.beginPath();
        ctx.ellipse(px + d * 0.42 * s, py - 0.75 * s, 0.13 * s, 0.1 * s, d * 0.5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = this.shade(hex('#cbb894'), 0, zm);
        ctx.lineWidth = 0.04 * s;
        ctx.beginPath();
        ctx.moveTo(px + d * 0.4 * s, py - 0.82 * s);
        ctx.quadraticCurveTo(px + d * 0.32 * s, py - 1.05 * s, px + d * 0.2 * s, py - 0.98 * s);
        ctx.stroke();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawCoin(c: Coin): void {
    if (!this.proj(c.lane * LW, c.y + 0.12 * Math.sin(this.clock * 4 + c.id), c.z)) return;
    const a = this.fog(c.z);
    paintCoin(this.ctx, this.P.x, this.P.y, Math.max(1.5, 0.27 * this.P.s), this.clock * 4 + c.id * 0.7, a);
  }

  private drawPower(p: Power): void {
    const y = 1 + Math.sin(this.clock * 3 + p.id) * 0.12;
    if (!this.proj(p.lane * LW, y, p.z)) return;
    const ctx = this.ctx, s = this.P.s, px = this.P.x, py = this.P.y;
    ctx.globalAlpha = this.fog(p.z);
    const g = ctx.createRadialGradient(px, py, 0, px, py, 0.7 * s);
    g.addColorStop(0, 'rgba(255,231,168,.75)');
    g.addColorStop(1, 'rgba(255,231,168,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, 0.7 * s, 0, TAU);
    ctx.fill();
    if (p.kind === 'sandals') paintSandals(ctx, px, py, 0.32 * s);
    else paintSatchel(ctx, px, py, 0.34 * s);
    ctx.globalAlpha = 1;
  }

  private drawTower(tw: Tower, side: number): void {
    const x = side * (ROAD + 1.7), z0 = tw.z, z1 = tw.z + 1.4, H = 4.3;
    const ctx = this.ctx;
    ctx.globalAlpha = this.fog(z0);
    const stone = hex('#9c8a72');
    this.box(x - 0.7, x + 0.7, 0, H, z0, z1, this.shade(stone, -0.05, z0), this.shade(stone, 0.2, z0), this.shade(stone, -0.3, z0));
    for (const dx of [-0.55, -0.05, 0.45]) this.box(x + dx, x + dx + 0.22, H, H + 0.35, z0, z0 + 0.3, this.shade(stone, 0, z0), this.shade(stone, 0.2, z0), this.shade(stone, -0.3, z0));
    if (this.proj(x, H * 0.55, z0)) {
      // a slit window
      const s = this.P.s;
      ctx.fillStyle = tw.fire !== null && tw.fire > 0.3 ? 'rgba(255,170,80,.8)' : 'rgba(30,22,30,.6)';
      ctx.fillRect(this.P.x - 0.07 * s, this.P.y - 0.3 * s, 0.14 * s, 0.6 * s);
    }
    if (this.proj(x, H + 0.05, z0 + 0.7)) {
      const s = this.P.s;
      ctx.fillStyle = this.shade(hex('#4a3a2c'), 0, z0);
      ctx.beginPath();
      ctx.ellipse(this.P.x, this.P.y, 0.42 * s, 0.14 * s, 0, 0, TAU);
      ctx.fill();
      const flashAt = this.towerFlash.get(tw.id);
      const pulse = flashAt !== undefined ? clamp(1 - (this.clock - flashAt) / 0.6) : 0;
      const k = tw.fire === null ? 0 : tw.fire * (1 + 0.4 * pulse);
      paintFire(ctx, this.P.x, this.P.y, 0.55 * s, k, this.clock + tw.id);
    }
    ctx.globalAlpha = 1;
  }

  private drawTree(z: number, x: number, kind: 'cypress' | 'olive' | 'poplar' | 'vine' | 'palm', n: number): void {
    if (!this.proj(x, 0, z)) return;
    const ctx = this.ctx, s = this.P.s, px = this.P.x, py = this.P.y;
    if (px < -6 * s || px > this.L.w + 6 * s) return;
    ctx.globalAlpha = this.fog(z);
    const v = 0.8 + 0.4 * hash(n + 0.5);
    switch (kind) {
      case 'cypress': {
        const h = 5.5 * v * s, w = 0.75 * s;
        ctx.fillStyle = this.shade(hex('#3e5a3a'), -0.1, z);
        ctx.beginPath();
        ctx.moveTo(px - w, py);
        ctx.quadraticCurveTo(px - w * 1.15, py - h * 0.55, px, py - h);
        ctx.quadraticCurveTo(px + w * 1.15, py - h * 0.55, px + w, py);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,230,190,.12)';
        ctx.beginPath();
        ctx.moveTo(px, py - h);
        ctx.quadraticCurveTo(px + w * 1.15, py - h * 0.55, px + w, py);
        ctx.lineTo(px + w * 0.3, py);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'poplar': {
        const h = 7 * v * s, w = 0.6 * s;
        ctx.fillStyle = this.shade(hex('#6f8a4a'), 0, z);
        ctx.beginPath();
        ctx.ellipse(px, py - h * 0.55, w, h * 0.48, 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'olive': case 'palm': case 'vine': {
        if (kind === 'vine') {
          // a row of vines on stakes
          ctx.strokeStyle = this.shade(hex('#6e5236'), 0, z);
          ctx.lineWidth = Math.max(1, 0.08 * s);
          ctx.fillStyle = this.shade(hex('#6f8d3e'), 0, z);
          for (const dz of [0, 1.6]) {
            if (!this.proj(x, 0, z + dz)) continue;
            const qx = this.P.x, qy = this.P.y, q = this.P.s;
            ctx.beginPath();
            ctx.moveTo(qx, qy);
            ctx.lineTo(qx, qy - 1.3 * q);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(qx, qy - 1.1 * q, 0.5 * q, 0.38 * q, 0, 0, TAU);
            ctx.fill();
          }
          break;
        }
        const trunk = kind === 'palm' ? 4.2 * v : 1.4 * v;
        ctx.strokeStyle = this.shade(hex('#5e4632'), 0, z);
        ctx.lineCap = 'round';
        ctx.lineWidth = (kind === 'palm' ? 0.2 : 0.3) * s;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 0.3 * s, py - trunk * 0.5 * s, px + (kind === 'palm' ? 0.4 : 0.1) * s, py - trunk * s);
        ctx.stroke();
        const cy = py - trunk * s;
        if (kind === 'palm') {
          ctx.strokeStyle = this.shade(hex('#5d7a3a'), 0, z);
          ctx.lineWidth = 0.14 * s;
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * TAU;
            ctx.beginPath();
            ctx.moveTo(px + 0.4 * s, cy);
            ctx.quadraticCurveTo(px + 0.4 * s + Math.cos(a) * 1.0 * s, cy - 0.6 * s, px + 0.4 * s + Math.cos(a) * 1.6 * s, cy + 0.4 * s);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = this.shade(hex('#8a9a6a'), 0, z);
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.ellipse(px + (k - 1.5) * 0.55 * s, cy - (k % 2) * 0.35 * s, 0.9 * s, 0.6 * s, 0, 0, TAU);
            ctx.fill();
          }
        }
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawMilestone(z: number, x: number, n: number): void {
    if (!this.proj(x, 0, z)) return;
    const ctx = this.ctx, s = this.P.s, px = this.P.x, py = this.P.y;
    ctx.globalAlpha = this.fog(z);
    ctx.fillStyle = this.shade(hex('#e3d5b8'), 0, z);
    ctx.beginPath();
    ctx.roundRect(px - 0.2 * s, py - 1.1 * s, 0.4 * s, 1.1 * s, [0.2 * s, 0.2 * s, 0, 0]);
    ctx.fill();
    if (s > 14 && n > 0) {
      ctx.fillStyle = 'rgba(70,50,30,.75)';
      ctx.font = font(700, Math.min(14, 0.2 * s), SERIF);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roman(Math.min(3999, n)), px, py - 0.7 * s, 0.38 * s);
    }
    ctx.globalAlpha = 1;
  }

  /** The inn by the road where the finisher ends: whitewashed walls, a tiled roof, lit windows, a lamp. */
  private drawInn(z: number): void {
    const x = ROAD + 3.6;
    const wall = hex('#efe2c8');
    this.box(x - 2.4, x + 2.4, 0, 3, z, z + 6, this.shade(wall, 0, z), this.shade(wall, 0.2, z), this.shade(wall, -0.25, z));
    this.box(x - 2.6, x + 2.6, 3, 3.5, z - 0.2, z + 6.2, this.shade(hex('#b5583a'), 0, z), this.shade(hex('#c86a46'), 0.1, z), this.shade(hex('#8a3f2a'), -0.2, z));
    const ctx = this.ctx;
    for (const dx of [-1.2, 1.2]) {
      if (!this.proj(x + dx, 1.6, z)) continue;
      const s = this.P.s;
      ctx.fillStyle = 'rgba(255,190,100,.9)';
      ctx.fillRect(this.P.x - 0.35 * s, this.P.y - 0.4 * s, 0.7 * s, 0.8 * s);
    }
    if (this.proj(ROAD + 0.6, 2.4, z - 1)) {
      const s = this.P.s;
      paintFire(ctx, this.P.x, this.P.y, 0.3 * s, 0.6, this.clock);
    }
  }

  // ── the runner and its signal ───────────────────────────────────
  private drawGlow(sim: PoslaniecSim): void {
    if (this.glowA < 0.02) return;
    const groundY = sim.onHeights ? (sim.heights === 'high' ? RULES.heightsY : sim.y) : groundAt(sim.track.obstacles, sim.x, sim.z);
    if (!this.proj(sim.x * LW, groundY, sim.z)) return;
    const ctx = this.ctx, s = this.P.s, px = this.P.x, py = this.P.y;
    const lv = clamp(sim.glow);
    const r = (0.35 + 1.1 * lv) * s, ring = (0.35 + 1.1 * 0.5) * s;
    ctx.save();
    ctx.globalAlpha = this.glowA;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,214,120,${0.25 + 0.5 * lv})`);
    g.addColorStop(0.6, `rgba(255,170,80,${0.12 + 0.25 * lv})`);
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // the threshold's ring: the glow reaching past it is above the threshold
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = lv >= 0.5 ? 'rgba(255,231,168,.85)' : 'rgba(255,240,220,.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(px, py, ring, ring * 0.3, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawRunner(sim: PoslaniecSim): void {
    const ctx = this.ctx;
    const groundY = sim.onHeights ? (sim.heights === 'high' ? RULES.heightsY : 0) : groundAt(sim.track.obstacles, sim.x, sim.z);
    const x = sim.x * LW;
    // the shadow on the ground under the runner
    if (this.proj(x, groundY, sim.z) && sim.heights !== 'rise' && sim.heights !== 'glide') {
      const s = this.P.s, k = clamp(1 - (sim.y - groundY) / 3);
      ctx.fillStyle = `rgba(30,20,20,${0.28 * k})`;
      ctx.beginPath();
      ctx.ellipse(this.P.x, this.P.y, 0.42 * s * (0.6 + 0.4 * k), 0.12 * s, 0, 0, TAU);
      ctx.fill();
    }
    const riding = sim.muleT > 0;
    const y = riding ? 0.75 : sim.y;
    if (!this.proj(x, y, sim.z)) return;
    const s = this.P.s, px = this.P.x, py = this.P.y;
    if (riding) this.drawMule(sim, x);
    const cloak = CLOAKS[this.cloak];
    const p = this.pose;
    p.stride = sim.stride;
    p.air = riding ? 0.7 : sim.airborne ? clamp(sim.vy > 0 ? 1 - sim.vy / 12 : 1) * 0.9 : 0;
    p.slide = sim.sliding ? 1 : 0;
    p.lean = this.lean;
    p.squash = ease.outCubic(sim.land);
    p.stumble = clamp(sim.stumbleT / RULES.stumbleSec);
    p.wool = cloak.wool;
    p.trim = cloak.trim;
    p.t = this.clock;
    p.alpha = sim.ghost && sim.stumbleT > 0 ? 0.65 + 0.35 * Math.sin(this.clock * 40) : 1;
    if (sim.sandalsT > 0 || sim.satchelT > 0) {
      // a gift's soft aura
      const g = ctx.createRadialGradient(px, py - 0.9 * s, 0, px, py - 0.9 * s, 1.2 * s);
      g.addColorStop(0, sim.sandalsT > 0 ? 'rgba(255,231,168,.3)' : 'rgba(233,234,242,.3)');
      g.addColorStop(1, 'rgba(255,231,168,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - 1.2 * s, py - 2.1 * s, 2.4 * s, 2.4 * s);
    }
    paintRunner(ctx, px, py, s, p);
  }

  /** A fellow traveller's mule cart carrying the messenger. */
  private drawMule(sim: PoslaniecSim, x: number): void {
    const z = sim.z, ctx = this.ctx;
    this.box(x - 0.55, x + 0.55, 0.3, 0.75, z - 0.6, z + 1.1, this.shade(WOOD, 0, z), this.shade(WOOD, 0.2, z), this.shade(WOOD, -0.3, z));
    if (this.proj(x, 0.9, z + 2.4)) {
      const s = this.P.s, px = this.P.x, py = this.P.y;
      const bob = Math.sin(this.clock * 10) * 0.05 * s;
      ctx.fillStyle = '#6b5a4c';
      ctx.beginPath();
      ctx.ellipse(px, py + bob, 0.32 * s, 0.4 * s, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px, py - 0.5 * s + bob, 0.16 * s, 0.2 * s, 0, 0, TAU);
      ctx.fill();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(px + side * 0.12 * s, py - 0.78 * s + bob, 0.05 * s, 0.18 * s, side * 0.3, 0, TAU);
        ctx.fill();
      }
    }
  }

  /** The ladder of light beside the runner: a rung a second of hold, the heights at its top. */
  private drawLadder(sim: PoslaniecSim): void {
    if (this.ladderA < 0.02) return;
    const x = sim.x * LW + 0.95;
    const groundY = sim.heights === 'high' ? RULES.heightsY : 0;
    if (!this.proj(x, groundY, sim.z)) return;
    const ctx = this.ctx, s = this.P.s, bx = this.P.x, by = this.P.y;
    const n = sim.need, H = 2.6 * s, w = 0.32 * s;
    const fill = sim.onHeights ? n : sim.ladder * n;
    ctx.save();
    ctx.globalAlpha = this.ladderA * 0.95;
    ctx.strokeStyle = 'rgba(255,236,200,.45)';
    ctx.lineWidth = Math.max(1, 0.035 * s);
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, by);
    ctx.lineTo(bx - w / 2, by - H);
    ctx.moveTo(bx + w / 2, by);
    ctx.lineTo(bx + w / 2, by - H);
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const y = by - ((i + 1) / (n + 0.4)) * H;
      const k = clamp(fill - i);
      ctx.strokeStyle = 'rgba(255,240,220,.22)';
      ctx.lineWidth = Math.max(2, 0.07 * s);
      ctx.beginPath();
      ctx.moveTo(bx - w / 2, y);
      ctx.lineTo(bx + w / 2, y);
      ctx.stroke();
      if (k > 0) {
        const top = i === Math.ceil(fill) - 1 ? this.rungFlash : 0;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(bx, y, 0, bx, y, w * (0.9 + top));
        g.addColorStop(0, `rgba(255,190,90,${0.4 * k})`);
        g.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - w * 1.6, y - w, w * 3.2, w * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(232,160,48,${0.5 + 0.5 * k})`;
        ctx.lineWidth = Math.max(3, (0.1 + 0.05 * top) * s);
        ctx.beginPath();
        ctx.moveTo(bx - (w / 2) * (0.4 + 0.6 * k), y);
        ctx.lineTo(bx + (w / 2) * (0.4 + 0.6 * k), y);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,236,170,${0.6 * k})`;
        ctx.lineWidth = Math.max(1, 0.035 * s);
        ctx.stroke();
      }
    }
    // the top: a small sun for the heights
    const ty = by - H;
    ctx.fillStyle = sim.onHeights || fill >= n ? 'rgba(255,231,168,.95)' : 'rgba(255,240,220,.3)';
    ctx.beginPath();
    ctx.arc(bx, ty, 0.09 * s, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ── the heights ─────────────────────────────────────────────────
  private drawHeights(sim: PoslaniecSim): void {
    const ctx = this.ctx, L = this.L, a = this.heightsA;
    // the world below sinks into a warm mist
    ctx.fillStyle = `rgba(255,226,184,${0.28 * a})`;
    ctx.fillRect(0, L.horizon, L.w, L.h - L.horizon);
    // light pillars under the golden road
    ctx.save();
    ctx.globalAlpha = a;
    const z0 = Math.ceil(this.camZ / 8) * 8;
    for (let z = z0 + 8 * Math.ceil(AHEAD / 8); z >= z0; z -= 8) {
      if (z < this.camZ + 1) continue;
      for (const side of [-1, 1]) {
        if (!this.proj(side * ROAD, RULES.heightsY, z)) continue;
        const tx = this.P.x, ty = this.P.y;
        this.proj(side * ROAD, 0, z);
        const g = ctx.createLinearGradient(tx, ty, this.P.x, this.P.y);
        g.addColorStop(0, `rgba(255,214,120,${0.55 * this.fog(z)})`);
        g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1, 0.18 * this.P.s);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(this.P.x, this.P.y);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.drawRoad(RULES.heightsY, GOLD_PAVE, a);
    // the heights' drachmas, far → near
    const coins = sim.track.coins.filter(c => c.high && !c.taken && c.z > this.camZ + 0.5 && c.z < this.camZ + AHEAD).sort((p, q) => q.z - p.z);
    for (const c of coins) this.drawCoin(c);
    // speed streaks of light
    if (!this.opts.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.35 * a;
      ctx.strokeStyle = '#fff3cf';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const k = (this.clock * 1.6 + hash(i)) % 1;
        const side = i % 2 ? 1 : -1;
        const x = L.cx + side * (0.2 + 0.6 * k) * L.w * 0.6;
        const y = L.horizon + (0.1 + 0.9 * k) * (L.h - L.horizon) * 0.8 - 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + side * 30 * k, y + 18 * k);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ── overlays ────────────────────────────────────────────────────
  private drawOverlays(sim: PoslaniecSim): void {
    const ctx = this.ctx, L = this.L;
    // the mist on the pass (a blind block): banks of cloud over the road
    if (this.mist > 0.01) {
      const g = ctx.createLinearGradient(0, L.horizon - 80, 0, L.h);
      g.addColorStop(0, `rgba(232,232,240,${0.65 * this.mist})`);
      g.addColorStop(0.4, `rgba(232,232,240,${0.25 * this.mist})`);
      g.addColorStop(1, `rgba(232,232,240,${0.08 * this.mist})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, L.w, L.h);
      ctx.fillStyle = `rgba(245,245,250,${0.22 * this.mist})`;
      for (let i = 0; i < 6; i++) {
        const x = ((hash(i) * L.w * 1.4 + this.clock * (12 + i * 5)) % (L.w * 1.4)) - L.w * 0.2;
        ctx.beginPath();
        ctx.ellipse(x, L.horizon + (i - 2) * 26, L.w * 0.3, 22, 0, 0, TAU);
        ctx.fill();
      }
    }
    // a soft haze while the band has no signal (nothing is lost)
    if (this.haze > 0.01) {
      ctx.fillStyle = `rgba(200,196,214,${0.18 * this.haze})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${0.35 * this.flash})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    // a soft vignette
    const v = ctx.createRadialGradient(L.cx, L.h * 0.55, Math.min(L.w, L.h) * 0.35, L.cx, L.h * 0.55, Math.max(L.w, L.h) * 0.8);
    v.addColorStop(0, 'rgba(20,10,20,0)');
    v.addColorStop(1, `rgba(20,10,30,${0.28 + 0.12 * this.dusk})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, L.w, L.h);
    void sim;
  }
}

function mixInto3(out: RGB, a: RGB, b: RGB, t: number): RGB {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

