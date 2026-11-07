/**
 * Posłaniec's picture (DESIGN.md §7.3, v2): the Roman road in pseudo-3D from behind and above the
 * messenger, three lanes converging to the horizon at dawn (evening on the watchtowers' road), the
 * wagons, ox-carts, fences and beams, the drachmas, power-ups and the day's letters, the relay
 * stations' gates, the towers and their fires, Bela the goat at the heels after a stumble, and Klekot
 * the stork — whose wings are the band's gauge: their spread is the lift with the threshold marked
 * at the top of the arc, the ring round him the flight's charge.
 *
 * The runner's standard HUD (the Mendi panel, the score) covers the top; this view keeps the play
 * below `hudTop()` and draws only what is the game's own: the stork's gauge, the companion's bubble,
 * the power-ups' timers, the day's word, the run's tally and the story cards.  The band's history
 * runs across the sky as the ribbon of dawn (ribbon.ts) when there is room for it.
 */
import { LAG_SEC } from '../kit/trace';
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageLayout } from '../kit/scripture';
import type { Tool } from '../../tools';
import { CITIES } from './content';
import { grouped, metres, t } from './i18n';
import { powerSecFor, routeAt, type PoslaniecProgress } from './meta';
import {
  C, SANS, SERIF, font, hash, hex, mix, paintCity, paintCoin, paintFire, paintGoat, paintHills, paintLetterTile, paintPostcard, paintRunner, paintSandals,
  paintSatchel, paintSeal, paintShield, paintSky, paintStork, rgb, skyAt, type RGB, type RunnerPose, type SkyLook,
} from './paint';
import { paintRibbon } from './ribbon';
import { RULES } from './rules';
import type { PoslaniecSim, SimEvent } from './sim';
import type { Obstacle } from './track';

const LW = RULES.laneW;
const ROAD = LW * 1.5 + 0.5;
const SEG = 3;
const AHEAD = 100;
const CAM_BACK = 10;
const TAU = Math.PI * 2;
const CANVAS: readonly string[] = ['#efe3c8', '#c8553d', '#2f4f8f', '#7d8b4a'];
const PAVE: [RGB, RGB] = [hex('#cdb38c'), hex('#bda27a')];
const PAVE_DUSK: [RGB, RGB] = [hex('#8e7c6a'), hex('#7f6d5d')];

export interface ViewOpts { reducedMotion: boolean; tool: Tool; hudTop: () => number }

interface Card { kind: 'story' | 'city' | 'mission' | 'mult' | 'verdict'; t: number; dur: number; text: string; sub?: string; city?: number }

export class PoslaniecView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private u = 1;
  /** the cast drawn a little larger than life on a tall screen, where the lanes are narrow */
  private big = 1;
  private top = 0;
  private horizon = 1;
  private f = 1;
  private camH = 3.4;
  private cx = 0;
  private camX = 0;
  private camY = 3.4;
  private camZ = 0;
  private clock = 0;
  private stride = 0;
  private dusk = 0;
  private roll = 0;
  private squash = 0;
  private lean = 0;
  private stumbleFx = 0;
  private flap = 0;
  private shieldFx = 0;
  private storkX = 0;
  private storkY = 0;
  private readonly particles = new Particles(360);
  private readonly floaters = new Floaters();
  private readonly shake: Shake;
  private readonly cards: Card[] = [];
  private story = 0;
  private readonly look: SkyLook = skyAt(0);
  private readonly pose: RunnerPose = { stride: 0, air: 0, slide: 0, lean: 0, squash: 0, stumble: 0, wool: '#b8412e', trim: '#e8b04a', t: 0, alpha: 1 };
  private storyLayout: PassageLayout | null = null;
  private progress: PoslaniecProgress | null = null;
  private readonly lagLabel: string;

  constructor(canvas: HTMLCanvasElement, private readonly opts: ViewOpts) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
    this.lagLabel = `≈${LAG_SEC[opts.tool]} s`;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.u = clamp(Math.min(w, h) / 640, 0.62, 1.25);
    this.big = h > w * 1.2 ? 1.25 : 1;
    this.top = Math.max(0, this.opts.hudTop());
    this.cx = w / 2;
    const runnerY = h * 0.86;
    this.horizon = Math.max(this.top + 10 * this.u, h * 0.28);
    const fH = ((runnerY - this.horizon) * CAM_BACK) / 4.2;
    const fW = (w * 0.27 * CAM_BACK) / LW;
    this.f = Math.min(fH, fW);
    this.camH = ((runnerY - this.horizon) * CAM_BACK) / this.f;
    this.camY = this.camH;
    this.storyLayout = null;
  }

  start(p: PoslaniecProgress, firstEver: boolean): void {
    this.progress = p;
    if (firstEver) this.story = 7.5;
  }

  /** Where a thing on the road shows on the canvas (CSS px), for the coach marks. */
  pointAt(z: number, lane: number, y = 1): { x: number; y: number } {
    const d = Math.max(1.5, z - this.camZ);
    const s = this.f / d;
    return { x: this.cx + (lane * LW - this.camX) * s, y: Math.max(this.top + 30, this.horizon + (this.camY - y) * s) };
  }

  /** The stork's gauge (for the coach mark about the wings). */
  storkAt(): { x: number; y: number } {
    // left of the gauge, so the runner's bubble (centred on the point) stays on the screen
    return { x: Math.min(this.storkX - 50 * this.u, this.w - 200 * this.u), y: this.storkY + 10 * this.u };
  }

  update(dt: number, sim: PoslaniecSim): void {
    this.clock += dt;
    const r = sim.r;
    this.stride += (sim.v * dt) / 2.1;
    this.particles.update(dt);
    this.floaters.update(dt);
    this.roll += ((r.rollT > 0 ? 1 : 0) - this.roll) * Math.min(1, dt * 22);
    this.squash = Math.max(0, this.squash - dt * 4);
    this.stumbleFx = Math.max(0, this.stumbleFx - dt);
    this.shieldFx = Math.max(0, this.shieldFx - dt);
    this.lean += ((r.lane * LW - r.x) * -0.12 - this.lean) * Math.min(1, dt * 14);
    this.flap += dt * (sim.flying ? 9 : 4 + sim.lift * 7);
    this.story = Math.max(0, this.story - dt);
    const want = sim.block.kind === 'rest' ? 0.78 : sim.block.kind === 'finale' ? 0.35 : 0;
    this.dusk += (want - this.dusk) * Math.min(1, dt * 0.6);
    skyAt(this.dusk, this.look);
    // the camera follows the runner across a little, and up onto the roofs and into the sky
    this.camX += (r.x * 0.62 - this.camX) * Math.min(1, dt * 7);
    const lift = sim.flying ? r.y : r.roof ? RULES.wagonTop * 0.85 : Math.min(r.y, 1) * 0.3;
    this.camY += (this.camH + lift - this.camY) * Math.min(1, dt * (sim.flying ? 3 : 5));
    this.camZ = sim.z - CAM_BACK;
    for (const c of this.cards) c.t += dt;
    while (this.cards.length && this.cards[0].t >= this.cards[0].dur) this.cards.shift();
  }

  private card(c: Omit<Card, 't'>): void {
    // one card of a kind at a time; the newest replaces the older
    const i = this.cards.findIndex(x => x.kind === c.kind);
    if (i >= 0) this.cards.splice(i, 1);
    this.cards.push({ ...c, t: 0 });
  }

  /** What the sim just did, in particles, words, shakes and cards. */
  on(e: SimEvent, sim: PoslaniecSim): void {
    const me = this.pointAt(sim.z + 0.5, 0, sim.r.y + 1);
    me.x = this.cx + (sim.r.x - this.camX) * (this.f / CAM_BACK);
    const u = this.u;
    switch (e.type) {
      case 'jump':
        this.particles.burst(me.x, me.y + 60 * u, 6, { color: '#e8d6b0', size: 3 * u, speed: 80 * u, angle: Math.PI / 2, spread: 2, life: 0.4, g: 200 });
        break;
      case 'land':
        this.squash = 1;
        this.particles.burst(me.x, me.y + 70 * u, e.hard ? 12 : 6, { color: '#e8d6b0', size: 3 * u, speed: 120 * u, angle: -Math.PI / 2, spread: 2.6, life: 0.45, g: 300 });
        break;
      case 'roll':
      case 'slam':
        this.particles.burst(me.x, me.y + 70 * u, 8, { color: '#d8c6a0', size: 2.5 * u, speed: 140 * u, angle: Math.PI, spread: 0.8, life: 0.4, g: 0 });
        break;
      case 'bump':
        this.shake.add(0.15);
        break;
      case 'stumble':
        this.stumbleFx = 0.8;
        this.shake.add(e.caught ? 0.6 : 0.4);
        this.floaters.add(t('fx.stumble'), me.x, me.y - 20 * u, { color: '#ffd9c8', size: 26 * u });
        this.particles.burst(me.x, me.y, 14, { color: '#f3e6c4', shape: 'square', size: 3 * u, speed: 200 * u, life: 0.7 });
        break;
      case 'shieldBreak':
        this.shieldFx = 0.6;
        this.shake.add(0.25);
        this.floaters.add(t('fx.shieldBreak'), me.x, me.y - 20 * u, { color: C.gold2, size: 26 * u });
        this.particles.burst(me.x, me.y, 22, { color: '#f1d08a', shape: 'spark', size: 3 * u, speed: 260 * u, life: 0.6, g: 0 });
        break;
      case 'coin': {
        const p = this.pointAt(e.z, e.lane, e.y);
        this.particles.burst(p.x, p.y, 4, { color: C.silver, shape: 'spark', size: 2 * u, speed: 120 * u, life: 0.35, g: 0 });
        break;
      }
      case 'cleared':
        if (e.tight) this.floaters.add(t('fx.near'), me.x, me.y - 30 * u, { color: C.gold2, size: 24 * u, dur: 0.9 });
        break;
      case 'power':
        this.floaters.add(t(`power.${e.kind}`), me.x, me.y - 40 * u, { color: C.gold2, size: 28 * u });
        this.particles.burst(me.x, me.y, 18, { color: C.gold, shape: 'ring', size: 6 * u, speed: 160 * u, life: 0.6, g: 0 });
        break;
      case 'letter':
        this.floaters.add(e.ch, me.x, me.y - 40 * u, { color: C.gold2, size: 40 * u });
        break;
      case 'word':
        this.floaters.add(t('fx.word', { n: grouped(e.pts) }), this.cx, this.h * 0.45, { color: C.gold2, size: 30 * u, dur: 1.8 });
        this.burstGold(this.cx, this.h * 0.45, 40);
        break;
      case 'station':
        this.floaters.add(t('fx.station', { n: grouped(e.pts) }), this.cx, this.h * 0.5, { color: '#fff4d6', size: 24 * u, dur: 1.4 });
        break;
      case 'city':
        this.card({ kind: 'city', dur: 5, text: t('story.city', { city: CITIES[e.city].name }), sub: CITIES[e.city].ref, city: e.city });
        this.burstGold(this.cx, this.top + 60 * u, 50);
        break;
      case 'full':
        this.floaters.add(t('fx.full'), this.storkX, this.storkY + 70 * u, { color: C.gold2, size: 24 * u });
        break;
      case 'good':
        this.floaters.add(t('fx.good'), this.storkX, this.storkY + 70 * u, { color: C.gold2, size: 20 * u, dur: 0.9 });
        break;
      case 'flight':
        if (e.stage === 'start') {
          this.floaters.add(t('fx.flight'), this.cx, this.h * 0.42, { color: C.gold2, size: 40 * u, dur: 1.4 });
          this.burstGold(me.x, me.y, 36);
          this.shake.add(0.2);
        }
        break;
      case 'reveal':
        this.floaters.add(t('fx.reveal', { n: Math.round(e.charge * 100) }), this.storkX - 40 * u, this.storkY + 80 * u, { color: '#eef0ff', size: 20 * u, dur: 1.8 });
        break;
      case 'fire':
        if (e.lit) {
          const p = this.pointAt(e.z, 2.2, 6);
          this.floaters.add(t('fx.fire', { n: grouped(RULES.firePts * sim.mult) }), p.x, p.y, { color: '#ffcf8a', size: 20 * u });
          this.particles.burst(p.x, p.y, 14, { color: '#ffb35c', size: 3 * u, speed: 120 * u, life: 0.8, g: -60 });
        }
        break;
      case 'shieldGift':
        this.floaters.add(t('fx.shieldGift'), this.cx, this.h * 0.48, { color: C.gold2, size: 26 * u, dur: 1.6 });
        this.shieldFx = 0.8;
        break;
      case 'mission':
        this.card({ kind: 'mission', dur: 2.8, text: t('fx.mission', { text: e.text }) });
        break;
      case 'mult':
        this.card({ kind: 'mult', dur: 2.2, text: t('fx.mult', { n: e.mult }) });
        this.burstGold(this.cx, this.h * 0.4, 60);
        this.shake.add(0.2);
        break;
      case 'verdict':
        if (e.pass !== null) {
          const key = e.kind === 'push' ? (e.pass ? 'v.push.pass' : 'v.push.miss') : (e.pass ? 'v.rest.pass' : 'v.rest.miss');
          const pay = e.pass ? (e.kind === 'push' ? RULES.pushPay : RULES.songPay) : 0;
          this.card({ kind: 'verdict', dur: 2.6, text: t(key), sub: pay ? t('fx.pay', { n: pay }) : undefined });
        }
        break;
      case 'caught':
        this.shake.add(0.5);
        break;
      default:
        break;
    }
  }

  private burstGold(x: number, y: number, n: number): void {
    this.particles.burst(x, y, n, { color: C.gold, shape: 'spark', size: 3 * this.u, speed: 280 * this.u, life: 0.9, g: 120 });
  }

  // ── drawing ───────────────────────────────────────────────────
  draw(sim: PoslaniecSim): void {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake.offset(1 / 60, 10 * this.u);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    this.drawSky(sim);
    this.drawGround();
    this.drawWorld(sim);
    ctx.restore();
    this.particles.draw(ctx);
    this.floaters.draw(ctx, SANS);
    this.drawGauge(sim);
    this.drawBubble(sim);
    this.drawPowers(sim);
    this.drawWord(sim);
    this.drawCards(sim);
    if (sim.tally) this.drawTally(sim);
    if (this.story > 0) this.drawStory();
    void w;
    void h;
  }

  private drawSky(sim: PoslaniecSim): void {
    const ctx = this.ctx, w = this.w, L = this.look, hz = this.horizon;
    paintSky(ctx, w, hz, L, w * 0.62 - this.camX * 6, 0.55 - this.dusk * 0.5, this.clock, sim.z * 0.6);
    // the ribbon of dawn: the band's last 40 s across the open sky between the panel and the score
    // (on a narrow screen the panel fills the top, and the dock's chart is the history)
    const x0 = 360, x1 = w - 150, y0 = 62, y1 = hz - 16 * this.u;
    if (x1 - x0 >= 300 && y1 - y0 >= 46) {
      const bw = Math.min(x1 - x0, 620), bh = Math.min(84, y1 - y0);
      const box = { x: x0 + (x1 - x0 - bw) / 2, y: y1 - bh, w: bw, h: bh };
      paintRibbon(ctx, sim.trace.layout(box, sim.t, { span: 40, minSpan: 4 }), { lagSec: LAG_SEC[this.opts.tool], lagLabel: this.lagLabel, t: this.clock, u: this.u, alpha: 0.95 });
    }
    // the next city on the horizon, nearer as the leg runs out
    const p = this.progress;
    if (p) {
      const r = routeAt(p.metres);
      const k = clamp(r.into / r.leg);
      const city = CITIES[r.next % CITIES.length];
      paintCity(ctx, city.id, w * 0.5 - this.camX * 4, hz + 2, (60 + 160 * k) * this.u, rgb(mix(L.hill[0], [60, 40, 70], 0.35), 0.85));
    }
    const off = this.camX * 10 + sim.z * 0.4;
    paintHills(ctx, w, hz + 4, 40 * this.u, off * 0.3, L.hill[0], 1.3, hz + 30, 0);
    paintHills(ctx, w, hz + 10, 26 * this.u, off * 0.6, L.hill[1], 2.7, hz + 40, 16 * this.u);
    paintHills(ctx, w, hz + 14, 14 * this.u, off, L.hill[2], 4.1, hz + 50, 10 * this.u);
  }

  private P(x: number, y: number, z: number): [number, number, number] {
    const d = Math.max(0.6, z - this.camZ);
    const s = this.f / d;
    return [this.cx + (x - this.camX) * s, this.horizon + (this.camY - y) * s, s];
  }

  private quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number], fill: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  }

  private drawGround(): void {
    const ctx = this.ctx, w = this.w, h = this.h, hz = this.horizon + 14 * this.u, L = this.look;
    const g = ctx.createLinearGradient(0, hz, 0, h);
    g.addColorStop(0, rgb(L.ground));
    g.addColorStop(1, rgb(L.ground2));
    ctx.fillStyle = g;
    ctx.fillRect(0, hz - 1, w, h - hz + 1);
    const near = this.camZ + 0.8, far = this.camZ + AHEAD;
    const pave = this.dusk > 0.01 ? [mix(PAVE[0], PAVE_DUSK[0], this.dusk), mix(PAVE[1], PAVE_DUSK[1], this.dusk)] : PAVE;
    // the road, then its stripes of paving, the kerbs and the lane joints
    this.quad(this.P(-ROAD, 0, near), this.P(ROAD, 0, near), this.P(ROAD, 0, far), this.P(-ROAD, 0, far), rgb(pave[0]));
    const k0 = Math.floor(near / SEG), k1 = Math.floor(far / SEG);
    for (let k = k1; k >= k0; k--) {
      const za = Math.max(near, k * SEG), zb = Math.min(far, (k + 1) * SEG);
      if (zb <= za) continue;
      if (k % 2 === 0) this.quad(this.P(-ROAD, 0, za), this.P(ROAD, 0, za), this.P(ROAD, 0, zb), this.P(-ROAD, 0, zb), rgb(pave[1]));
      const kerb = k % 2 ? '#e9dcc0' : '#8f7a5e';
      for (const side of [-1, 1]) this.quad(this.P(side * ROAD, 0, za), this.P(side * (ROAD + 0.35), 0, za), this.P(side * (ROAD + 0.35), 0, zb), this.P(side * ROAD, 0, zb), kerb);
      if (k % 3 !== 0) for (const lx of [-LW / 2, LW / 2]) this.quad(this.P(lx - 0.05, 0, za), this.P(lx + 0.05, 0, za), this.P(lx + 0.05, 0, zb), this.P(lx - 0.05, 0, zb), 'rgba(90,70,50,.32)');
    }
    // the haze of distance
    const fogY = this.P(0, 0, this.camZ + 34)[1];
    const fg = ctx.createLinearGradient(0, hz - 14 * this.u, 0, fogY);
    fg.addColorStop(0, rgb(L.glow, 0.55));
    fg.addColorStop(1, rgb(L.glow, 0));
    ctx.fillStyle = fg;
    ctx.fillRect(0, hz - 14 * this.u, w, fogY - hz + 14 * this.u);
  }

  /** Everything on and beside the road, far to near, the runner and the goat in their places. */
  private drawWorld(sim: PoslaniecSim): void {
    const items: { z: number; k: number; i: number }[] = [];
    const camZ = this.camZ, far = camZ + AHEAD;
    // roadside: trees every 7 m, a milestone every 100 m
    for (let z = Math.ceil((camZ + 1) / 7) * 7; z < far; z += 7) items.push({ z, k: 0, i: z });
    sim.towers.forEach((tw, i) => { if (tw.z > camZ + 1 && tw.z < far) items.push({ z: tw.z, k: 1, i }); });
    if (sim.nextStation < far) items.push({ z: sim.nextStation, k: 2, i: 0 });
    for (const zz of sim.stations) if (zz > camZ + 1) items.push({ z: zz, k: 2, i: 1 });
    sim.track.obstacles.forEach((o, i) => {
      const z1 = o.z + o.len;
      if (z1 < camZ + 0.8 || o.z - RULES.rampLen > far) return;
      items.push({ z: z1 > sim.z + 0.3 ? Math.max(o.z, sim.z + 0.31) : o.z, k: 3, i });
    });
    sim.track.coins.forEach((c, i) => { if (!c.taken && c.z > camZ + 1 && c.z < far) items.push({ z: c.z, k: 4, i }); });
    sim.track.powers.forEach((p, i) => { if (!p.taken && p.z > camZ + 1 && p.z < far) items.push({ z: p.z, k: 5, i }); });
    sim.track.letters.forEach((l, i) => { if (!l.taken && l.z > camZ + 1 && l.z < far) items.push({ z: l.z, k: 6, i }); });
    items.push({ z: sim.z + 0.3, k: 7, i: 0 });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      switch (it.k) {
        case 0: this.drawSide(it.z); break;
        case 1: this.drawTower(sim, sim.towers[it.i]); break;
        case 2: this.drawStation(it.z, it.i === 1); break;
        case 3: this.drawObstacle(sim, sim.track.obstacles[it.i]); break;
        case 4: this.drawCoin(sim.track.coins[it.i]); break;
        case 5: this.drawPower(sim.track.powers[it.i]); break;
        case 6: this.drawLetter(sim, sim.track.letters[it.i]); break;
        case 7: this.drawRunner(sim); break;
      }
    }
    this.drawGoat(sim);
  }

  private fade(z: number): number { return clamp((this.camZ + AHEAD - z) / 18); }

  private drawSide(z: number): void {
    const ctx = this.ctx;
    for (const side of [-1, 1]) {
      const hh = hash(z * 0.37 + side * 11);
      const x = side * (ROAD + 1.6 + hh * 5);
      const [sx, sy, s] = this.P(x, 0, z);
      ctx.globalAlpha = this.fade(z);
      if (Math.round(z) % 98 === 0 && side > 0) {
        // a milestone
        ctx.fillStyle = '#d9c9a6';
        ctx.fillRect(sx - 0.18 * s, sy - 1.1 * s, 0.36 * s, 1.1 * s);
        ctx.fillStyle = '#b8a47e';
        ctx.fillRect(sx - 0.22 * s, sy - 1.2 * s, 0.44 * s, 0.14 * s);
      } else if (hh < 0.55) {
        // a cypress
        const th = (3.5 + hh * 3) * s;
        ctx.fillStyle = rgb(mix(hex('#2f4a2e'), this.look.hill[2], 0.3 + this.dusk * 0.3));
        ctx.beginPath();
        ctx.moveTo(sx - 0.45 * s, sy);
        ctx.quadraticCurveTo(sx - 0.6 * s, sy - th * 0.6, sx, sy - th);
        ctx.quadraticCurveTo(sx + 0.6 * s, sy - th * 0.6, sx + 0.45 * s, sy);
        ctx.closePath();
        ctx.fill();
      } else if (hh < 0.8) {
        // an olive tree
        ctx.fillStyle = '#6b5236';
        ctx.fillRect(sx - 0.12 * s, sy - 1.2 * s, 0.24 * s, 1.2 * s);
        ctx.fillStyle = rgb(mix(hex('#8a9a6a'), this.look.hill[2], 0.25 + this.dusk * 0.3));
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1.7 * s, 1.2 * s, 0.75 * s, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTower(sim: PoslaniecSim, tw: PoslaniecSim['towers'][number]): void {
    const ctx = this.ctx;
    // the fire before it is passed shows the calm now (the live gauge), a dashed ring its threshold
    const near = !tw.judged && tw.z - sim.z < 34;
    const live = near && sim.bandOn && sim.f.reliable ? clamp(sim.f.calm) : 0;
    for (const side of [-1, 1]) {
      const x = side * (ROAD + 1.3);
      const [bx, by, s] = this.P(x, 0, tw.z);
      ctx.globalAlpha = this.fade(tw.z);
      ctx.fillStyle = '#b8a07a';
      ctx.beginPath();
      ctx.moveTo(bx - 0.9 * s, by);
      ctx.lineTo(bx - 0.7 * s, by - 5.6 * s);
      ctx.lineTo(bx + 0.7 * s, by - 5.6 * s);
      ctx.lineTo(bx + 0.9 * s, by);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8f7a5e';
      for (let i = 0; i < 3; i++) ctx.fillRect(bx - 0.8 * s + i * 0.6 * s, by - 6.0 * s, 0.35 * s, 0.4 * s);
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(bx - 0.2 * s, by - 2.2 * s, 0.4 * s, 0.7 * s);
      const fy = by - 6.0 * s;
      const k = tw.lit === true ? 1 : near ? live : 0;
      paintFire(ctx, bx, fy, 0.8 * s, k, this.clock + side);
      if (near && sim.block.kind === 'rest') {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,220,160,.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bx, fy - 0.35 * s, 0.8 * s * (0.35 + 0.9 * 0.5), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawStation(z: number, passed: boolean): void {
    const ctx = this.ctx;
    const [lx, ly, s] = this.P(-ROAD - 0.2, 0, z), [rx] = this.P(ROAD + 0.2, 0, z);
    ctx.globalAlpha = this.fade(z) * (passed ? 0.9 : 1);
    ctx.fillStyle = '#c9b48e';
    ctx.fillRect(lx - 0.5 * s, ly - 5.4 * s, 0.6 * s, 5.4 * s);
    ctx.fillRect(rx - 0.1 * s, ly - 5.4 * s, 0.6 * s, 5.4 * s);
    ctx.fillStyle = '#b39d76';
    ctx.fillRect(lx - 0.7 * s, ly - 6.2 * s, rx - lx + 1.4 * s, 0.9 * s);
    ctx.fillStyle = '#7a3b2a';
    ctx.beginPath();
    ctx.moveTo(lx - 0.9 * s, ly - 6.2 * s);
    ctx.lineTo((lx + rx) / 2, ly - 7.3 * s);
    ctx.lineTo(rx + 0.9 * s, ly - 6.2 * s);
    ctx.closePath();
    ctx.fill();
    const fs = Math.max(6, 0.55 * s);
    if (fs > 7) {
      ctx.fillStyle = '#fff4d6';
      ctx.font = font(800, fs, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('w.station'), (lx + rx) / 2, ly - 5.75 * s);
    }
    ctx.globalAlpha = 1;
  }

  private drawObstacle(sim: PoslaniecSim, o: Obstacle): void {
    const ctx = this.ctx;
    const X = o.lane * LW, hw = LW * 0.42;
    const z0 = Math.max(o.z, this.camZ + 0.7), z1 = o.z + o.len;
    if (z1 <= z0) return;
    ctx.globalAlpha = this.fade(o.z) * (o.hit ? 0.35 : 1);
    if (o.kind === 'low') {
      const P = (x: number, y: number) => this.P(X + x, y, z0);
      const [, , s] = P(0, 0);
      if (o.look % 2) {
        // a fallen column, fluted
        const a = P(-hw, 0.9), b = P(hw, 0.05);
        ctx.fillStyle = '#e4d6b8';
        ctx.beginPath();
        ctx.roundRect(a[0], a[1], b[0] - a[0], b[1] - a[1], 0.4 * s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,100,70,.4)';
        ctx.lineWidth = Math.max(1, 0.04 * s);
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(a[0] + 0.3 * s, a[1] + (b[1] - a[1]) * (i / 4));
          ctx.lineTo(b[0] - 0.3 * s, a[1] + (b[1] - a[1]) * (i / 4));
          ctx.stroke();
        }
      } else {
        // a wooden fence, two rails on posts
        ctx.fillStyle = C.wood2;
        for (const px of [-hw, 0, hw]) { const p0 = P(px, 0), p1 = P(px, RULES.lowTop); ctx.fillRect(p0[0] - 0.07 * s, p1[1], 0.14 * s, p0[1] - p1[1]); }
        ctx.fillStyle = C.wood;
        for (const ry of [0.35, 0.75]) { const a = P(-hw, ry + 0.14), b = P(hw, ry); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
        ctx.fillStyle = '#e8b04a';
        const a = P(-hw, 0.8), b = P(hw, 0.72);
        for (let i = 0; i < 4; i++) ctx.fillRect(a[0] + (b[0] - a[0]) * (i / 4 + 0.05), a[1], (b[0] - a[0]) * 0.12, b[1] - a[1]);
      }
    } else if (o.kind === 'high') {
      const P = (x: number, y: number) => this.P(X + x, y, z0);
      const [, , s] = P(0, 0);
      ctx.fillStyle = C.wood2;
      for (const px of [-hw, hw]) { const p0 = P(px, 0), p1 = P(px, RULES.highTop); ctx.fillRect(p0[0] - 0.09 * s, p1[1], 0.18 * s, p0[1] - p1[1]); }
      // the beam, striped, and a sign hanging above it
      const a = P(-hw - 0.1, RULES.highGap + 0.45), b = P(hw + 0.1, RULES.highGap);
      ctx.fillStyle = '#f2e4c4';
      ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      ctx.fillStyle = '#c8553d';
      for (let i = 0; i < 5; i++) ctx.fillRect(a[0] + (b[0] - a[0]) * (i / 5), a[1], (b[0] - a[0]) * 0.1, b[1] - a[1]);
      const sa = P(-hw * 0.5, RULES.highGap + 1.35), sb = P(hw * 0.5, RULES.highGap + 0.6);
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(sa[0], sa[1], sb[0] - sa[0], sb[1] - sa[1]);
      ctx.strokeStyle = '#f3e6c4';
      ctx.lineWidth = Math.max(1, 0.05 * s);
      // a painted arrow down: roll under
      const mx = (sa[0] + sb[0]) / 2, my = (sa[1] + sb[1]) / 2, k = (sb[1] - sa[1]) * 0.3;
      ctx.beginPath();
      ctx.moveTo(mx, my - k);
      ctx.lineTo(mx, my + k);
      ctx.moveTo(mx - k * 0.7, my + k * 0.2);
      ctx.lineTo(mx, my + k);
      ctx.lineTo(mx + k * 0.7, my + k * 0.2);
      ctx.stroke();
    } else this.drawBox(sim, o, X, hw, z0, z1);
    ctx.globalAlpha = 1;
  }

  /** A wagon or an ox-cart: a box in perspective, the canvas roof, wheels; a ramp; the ox. */
  private drawBox(sim: PoslaniecSim, o: Obstacle, X: number, hw: number, z0: number, z1: number): void {
    const ctx = this.ctx;
    const H = o.kind === 'cart' ? RULES.wagonTop - 0.3 : RULES.wagonTop;
    const wood = o.kind === 'cart' ? '#7a5434' : '#8a5a34', wood2 = '#5e3b20';
    const cover = o.kind === 'cart' ? '#e4c86a' : CANVAS[o.look % CANVAS.length];
    // the side toward the camera
    const sideX = X - hw > this.camX ? X - hw : X + hw < this.camX ? X + hw : null;
    if (sideX !== null) {
      this.quad(this.P(sideX, 0.3, z0), this.P(sideX, 0.3, z1), this.P(sideX, H * 0.62, z1), this.P(sideX, H * 0.62, z0), wood2);
      this.quad(this.P(sideX, H * 0.62, z0), this.P(sideX, H * 0.62, z1), this.P(sideX, H, z1), this.P(sideX, H, z0), rgb(mix(hex(cover), [40, 30, 30], 0.25)));
      // wheels
      for (const wz of [z0 + 0.9, z1 - 0.9]) {
        if (wz <= z0) continue;
        const [wx, wy, s] = this.P(sideX, 0.45, wz);
        ctx.fillStyle = '#3b2a1c';
        ctx.beginPath();
        ctx.ellipse(wx, wy, 0.18 * s, 0.45 * s, 0, 0, TAU);
        ctx.fill();
      }
    }
    // the roof (seen from above) with its ribs
    if (this.camY > H) {
      this.quad(this.P(X - hw, H, z0), this.P(X + hw, H, z0), this.P(X + hw, H, z1), this.P(X - hw, H, z1), cover);
      ctx.strokeStyle = 'rgba(80,50,30,.28)';
      ctx.lineWidth = 1;
      for (let z = Math.ceil(z0 / 1.5) * 1.5; z < z1; z += 1.5) {
        const a = this.P(X - hw, H, z), b = this.P(X + hw, H, z);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
    // the front
    if (o.z > this.camZ + 0.7) {
      const a = this.P(X - hw, H, o.z), b = this.P(X + hw, 0.3, o.z), s = a[2];
      ctx.fillStyle = wood;
      ctx.fillRect(a[0], a[1] + (b[1] - a[1]) * 0.38, b[0] - a[0], (b[1] - a[1]) * 0.62);
      ctx.fillStyle = cover;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] + (b[1] - a[1]) * 0.4);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - 0.5 * s, b[0], a[1] + (b[1] - a[1]) * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,25,15,.35)';
      ctx.lineWidth = Math.max(1, 0.03 * s);
      for (let i = 1; i < 4; i++) {
        const y = a[1] + (b[1] - a[1]) * (0.38 + 0.155 * i);
        ctx.beginPath();
        ctx.moveTo(a[0], y);
        ctx.lineTo(b[0], y);
        ctx.stroke();
      }
      if (o.kind === 'cart') this.drawOx(o, X, s);
    }
    // the ramp up to the roof
    if (o.ramp && o.z > this.camZ + 0.7) {
      const zr = Math.max(o.z - RULES.rampLen, this.camZ + 0.7);
      const yr = H * (zr - (o.z - RULES.rampLen)) / RULES.rampLen;
      this.quad(this.P(X - hw * 0.9, yr, zr), this.P(X + hw * 0.9, yr, zr), this.P(X + hw * 0.9, H, o.z), this.P(X - hw * 0.9, H, o.z), '#a77b4f');
      ctx.strokeStyle = 'rgba(60,35,20,.45)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const z = zr + (o.z - zr) * (i / 6), y = yr + (H - yr) * (i / 6);
        const a = this.P(X - hw * 0.9, y, z), b = this.P(X + hw * 0.9, y, z);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      // gold chevrons: "up here"
      const m = this.P(X, H * 0.5, o.z - RULES.rampLen * 0.5);
      ctx.strokeStyle = 'rgba(255,214,120,.9)';
      ctx.lineWidth = Math.max(1.5, 0.08 * m[2]);
      ctx.beginPath();
      ctx.moveTo(m[0] - 0.4 * m[2], m[1] + 0.15 * m[2]);
      ctx.lineTo(m[0], m[1] - 0.2 * m[2]);
      ctx.lineTo(m[0] + 0.4 * m[2], m[1] + 0.15 * m[2]);
      ctx.stroke();
    }
    void sim;
  }

  /** The ox pulling a cart toward the runner, and its swinging lantern. */
  private drawOx(o: Obstacle, X: number, s: number): void {
    const ctx = this.ctx;
    const [ox, oy] = this.P(X, 0, o.z - 0.8);
    const bob = Math.sin(this.clock * 8 + o.id) * 0.05 * s;
    ctx.fillStyle = '#6e4a2c';
    ctx.beginPath();
    ctx.ellipse(ox, oy - 1.0 * s + bob, 0.55 * s, 0.5 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.ellipse(ox, oy - 0.95 * s + bob, 0.3 * s, 0.35 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#efe3c8';
    ctx.lineWidth = 0.09 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox - 0.25 * s, oy - 1.3 * s + bob);
    ctx.quadraticCurveTo(ox - 0.6 * s, oy - 1.45 * s + bob, ox - 0.55 * s, oy - 1.7 * s + bob);
    ctx.moveTo(ox + 0.25 * s, oy - 1.3 * s + bob);
    ctx.quadraticCurveTo(ox + 0.6 * s, oy - 1.45 * s + bob, ox + 0.55 * s, oy - 1.7 * s + bob);
    ctx.stroke();
    ctx.fillStyle = '#f2d6c4';
    ctx.beginPath();
    ctx.ellipse(ox, oy - 0.72 * s + bob, 0.2 * s, 0.13 * s, 0, 0, TAU);
    ctx.fill();
    const lx = ox + 0.7 * s + Math.sin(this.clock * 4) * 0.1 * s, ly = oy - 1.9 * s;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 0.9 * s);
    g.addColorStop(0, 'rgba(255,210,120,.8)');
    g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, 0.9 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe7a8';
    ctx.fillRect(lx - 0.1 * s, ly - 0.15 * s, 0.2 * s, 0.3 * s);
  }

  private drawCoin(c: PoslaniecSim['track']['coins'][number]): void {
    const [x, y, s] = this.P(c.lane * LW, c.y, c.z);
    const r = 0.32 * s;
    if (r < 0.8) return;
    this.ctx.globalAlpha = this.fade(c.z);
    paintCoin(this.ctx, x, y, r, this.clock * 5 + c.z * 0.3, this.fade(c.z));
    this.ctx.globalAlpha = 1;
  }

  private drawPower(p: PoslaniecSim['track']['powers'][number]): void {
    const ctx = this.ctx;
    const [x, y0, s] = this.P(p.lane * LW, p.y, p.z);
    const y = y0 - Math.sin(this.clock * 4 + p.z) * 0.12 * s;
    const r = 0.5 * s;
    ctx.globalAlpha = this.fade(p.z);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
    g.addColorStop(0, 'rgba(255,214,120,.55)');
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2, 0, TAU);
    ctx.fill();
    if (p.kind === 'magnet') paintSatchel(ctx, x, y, r);
    else if (p.kind === 'sandals') paintSandals(ctx, x, y, r);
    else if (p.kind === 'double') paintSeal(ctx, x, y, r);
    else paintShield(ctx, x, y, r);
    ctx.globalAlpha = 1;
  }

  private drawLetter(sim: PoslaniecSim, l: PoslaniecSim['track']['letters'][number]): void {
    const [x, y, s] = this.P(l.lane * LW, l.y, l.z);
    const ch = sim.word[Math.min(sim.word.length - 1, sim.p.wordGot)] ?? '?';
    this.ctx.globalAlpha = this.fade(l.z);
    paintLetterTile(this.ctx, x, y - Math.sin(this.clock * 3) * 0.1 * s, 0.38 * s, ch, this.clock);
    this.ctx.globalAlpha = 1;
  }

  private drawRunner(sim: PoslaniecSim): void {
    const ctx = this.ctx, r = sim.r;
    const [x, y, s] = this.P(r.x, r.y, sim.z);
    // the shadow on the road (or roof) beneath
    const groundY = sim.flying ? 0 : r.roof ? RULES.wagonTop : 0;
    const [, gy] = this.P(r.x, groundY, sim.z);
    ctx.fillStyle = 'rgba(40,25,15,.25)';
    ctx.beginPath();
    ctx.ellipse(x, gy, 0.42 * s * (1 - Math.min(0.6, (r.y - groundY) / 6)), 0.12 * s, 0, 0, TAU);
    ctx.fill();
    // the shield's bubble
    if (sim.shield || this.shieldFx > 0) {
      const k = sim.shield ? 0.35 + 0.1 * Math.sin(this.clock * 5) : this.shieldFx;
      ctx.strokeStyle = `rgba(241,208,138,${k})`;
      ctx.fillStyle = `rgba(241,208,138,${k * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - 0.85 * s * (1 - 0.45 * this.roll), 0.65 * s, 1.0 * s * (1 - 0.4 * this.roll), 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    const p = this.pose;
    p.stride = this.stride;
    p.air = sim.flying ? 0.6 : r.grounded ? 0 : clamp(r.y / 1.2);
    p.slide = this.roll;
    p.lean = this.lean;
    p.squash = this.squash;
    p.stumble = clamp(this.stumbleFx);
    p.t = this.clock;
    p.alpha = r.safeT > 0 && !sim.flying && Math.sin(this.clock * 40) > 0.3 ? 0.55 : 1;
    if (sim.flying) {
      // carried: the stork above, the messenger holding its legs
      const k = this.big;
      paintStork(ctx, x + 0.1 * s, y - 2.15 * s * k, s * 1.05 * k, this.flap, 1, 0.6, true);
      paintRunner(ctx, x, y, s * k, p);
      this.storkX = x;
      this.storkY = y - 2.15 * s * k;
    } else paintRunner(ctx, x, y, s * this.big, p);
  }

  private drawGoat(sim: PoslaniecSim): void {
    const caught = sim.phase === 'caught';
    const gap = caught ? 0 : sim.goatGap;
    if (gap > 0.97) return;
    const z = sim.z - 1.2 - gap * 7;
    const d = z - this.camZ;
    if (d < 0.9) return;
    const x = sim.r.x + (caught ? 0.5 : 0.75) * (sim.r.x > 0 ? -1 : 1);
    const [sx, sy, s] = this.P(x, 0, z);
    paintGoat(this.ctx, sx, sy, s * this.big, this.clock, caught ? 1 : 0);
  }

  // ── the game's own HUD ────────────────────────────────────────
  /** Klekot's gauge: the lift's arc with the threshold at its top, the flight's ring; the horn in a rest. */
  private drawGauge(sim: PoslaniecSim): void {
    if (sim.flying) return;
    const ctx = this.ctx, u = this.u;
    const R = 42 * u;
    const gx = this.w - R - 26 * u + Math.sin(this.clock * 0.9) * 4 * u;
    const gy = this.top + R + 22 * u + Math.sin(this.clock * 1.3) * 3 * u;
    this.storkX = gx;
    this.storkY = gy;
    const rest = sim.block.kind === 'rest';
    const blind = sim.blind;
    const f = sim.f;
    const live = f.reliable && !blind;
    const v = rest ? clamp(f.calm) : clamp(sim.lift);
    ctx.save();
    ctx.fillStyle = 'rgba(24,20,40,.42)';
    ctx.beginPath();
    ctx.arc(gx, gy, R + 12 * u, 0, TAU);
    ctx.fill();
    // the arc: left (0) over the top to the right (1); the threshold at the top
    const a0 = Math.PI, a1 = TAU;
    ctx.lineCap = 'round';
    ctx.lineWidth = 6 * u;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.arc(gx, gy, R, a0, a1);
    ctx.stroke();
    if (live) {
      const on = v >= 0.5;
      ctx.strokeStyle = rest ? (on ? '#ffb35c' : '#9fb6e6') : on ? C.gold : '#f2b9c0';
      ctx.beginPath();
      ctx.arc(gx, gy, R, a0, a0 + Math.PI * Math.max(0.02, v));
      ctx.stroke();
    }
    // the threshold mark
    ctx.strokeStyle = C.gold2;
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.moveTo(gx, gy - R - 7 * u);
    ctx.lineTo(gx, gy - R + 7 * u);
    ctx.stroke();
    // the flight's ring (push) or the horn's notches (rest)
    if (!rest) {
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath();
      ctx.arc(gx, gy, R + 9 * u, 0, TAU);
      ctx.stroke();
      if (!blind && sim.charge > 0) {
        ctx.strokeStyle = C.gold;
        ctx.beginPath();
        ctx.arc(gx, gy, R + 9 * u, -Math.PI / 2, -Math.PI / 2 + TAU * sim.charge);
        ctx.stroke();
      }
    }
    const gold = live && !rest && v > 0.5 ? (v - 0.5) * 2 : 0;
    paintStork(ctx, gx - 4 * u, gy + 6 * u, R * 1.15, this.flap, live && !rest ? v : 0.35, gold);
    if (blind) {
      ctx.fillStyle = 'rgba(232,234,244,.82)';
      ctx.beginPath();
      ctx.arc(gx, gy, R + 12 * u, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath();
        ctx.ellipse(gx + Math.sin(this.clock * 0.6 + k * 1.7) * R * 0.6, gy + Math.cos(this.clock * 0.4 + k) * R * 0.5, R * 0.5, R * 0.18, 0, 0, TAU);
        ctx.fill();
      }
    }
    // the label under it
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    const ly = gy + R + 16 * u;
    const label = blind ? t('w.mist') : rest ? t('w.horn') : t('w.wings');
    ctx.font = font(800, 10.5 * u, SANS);
    ctx.fillText(label, gx + 1, ly + 1);
    ctx.fillStyle = '#fff6e4';
    ctx.fillText(label, gx, ly);
    let sub = '';
    if (rest) {
      for (let i = 0; i < RULES.hornNotches; i++) {
        ctx.fillStyle = i < sim.notches ? '#ffb35c' : 'rgba(255,255,255,.25)';
        ctx.beginPath();
        ctx.arc(gx + (i - 1) * 13 * u, ly + 20 * u, 4.5 * u, 0, TAU);
        ctx.fill();
      }
    } else if (!blind) sub = `${t('w.ring')} ${Math.round(sim.charge * 100)}%`;
    if (sub) {
      ctx.font = font(700, 10 * u, SANS);
      ctx.fillStyle = sim.charge > 0 ? C.gold2 : 'rgba(255,246,228,.75)';
      ctx.fillText(sub, gx, ly + 13 * u);
    }
    if (sim.block.kind === 'push' && sim.blockT < sim.lead && !blind) {
      ctx.font = font(600, 9.5 * u, SANS, true);
      ctx.fillStyle = 'rgba(255,246,228,.8)';
      ctx.fillText(t('w.lead'), gx - 20 * u, ly + 27 * u);
    }
    ctx.restore();
  }

  /** Klekot's speech bubble, beside his gauge. */
  private drawBubble(sim: PoslaniecSim): void {
    const line = sim.talk.current;
    if (!line || sim.tally) return;
    const ctx = this.ctx, u = this.u;
    const k = Math.min(1, line.t / 0.18, (line.dur - line.t) / 0.25);
    if (k <= 0) return;
    ctx.save();
    ctx.font = font(600, 14 * u, SANS);
    const right = this.storkX - 50 * u;
    const maxW = Math.min(300 * u, right - 16 * u);
    if (maxW < 120 * u) { ctx.restore(); this.drawBubbleBelow(line.text, k); return; }
    const lines = wrapLines(ctx, line.text, maxW - 20 * u);
    const lh = 18 * u, bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22 * u), bh = lines.length * lh + 14 * u;
    const x = right - bw, y = this.storkY - bh / 2;
    ctx.globalAlpha = k;
    ctx.translate(right, this.storkY);
    ctx.scale(0.85 + 0.15 * ease.outBack(Math.min(1, line.t / 0.25)), 0.85 + 0.15 * ease.outBack(Math.min(1, line.t / 0.25)));
    ctx.translate(-right, -this.storkY);
    ctx.fillStyle = 'rgba(255,248,232,.96)';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 10 * u);
    ctx.moveTo(right - 2, this.storkY - 6 * u);
    ctx.lineTo(right + 12 * u, this.storkY);
    ctx.lineTo(right - 2, this.storkY + 6 * u);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + 11 * u, y + 7 * u + i * lh));
    ctx.restore();
  }

  /** On a narrow screen the bubble hangs under the stork. */
  private drawBubbleBelow(text: string, k: number): void {
    const ctx = this.ctx, u = this.u;
    ctx.save();
    ctx.font = font(600, 13 * u, SANS);
    const maxW = Math.min(this.w - 24 * u, 320 * u);
    const lines = wrapLines(ctx, text, maxW - 20 * u);
    const lh = 16 * u, bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20 * u), bh = lines.length * lh + 12 * u;
    const x = Math.max(12 * u, Math.min(this.w - bw - 12 * u, this.storkX - bw + 40 * u)), y = this.storkY + 70 * u;
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(255,248,232,.96)';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 9 * u);
    ctx.moveTo(this.storkX - 6 * u, y + 1);
    ctx.lineTo(this.storkX, y - 10 * u);
    ctx.lineTo(this.storkX + 6 * u, y + 1);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + 10 * u, y + 6 * u + i * lh));
    ctx.restore();
  }

  /** The power-ups at work: their icons with the time left as a ring, bottom left. */
  private drawPowers(sim: PoslaniecSim): void {
    const ctx = this.ctx, u = this.u;
    let x = 26 * u;
    const y = this.h - 26 * u;
    const draw = (k: number, paint: (r: number) => void) => {
      ctx.fillStyle = 'rgba(24,20,40,.5)';
      ctx.beginPath();
      ctx.arc(x, y, 18 * u, 0, TAU);
      ctx.fill();
      paint(11 * u);
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(x, y, 18 * u, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
      x += 44 * u;
    };
    const ups = sim.p.ups;
    if (sim.powers.magnet > 0) draw(sim.powers.magnet / powerSecFor(ups.magnet), r => paintSatchel(ctx, x, y, r));
    if (sim.powers.sandals > 0) draw(sim.powers.sandals / powerSecFor(ups.sandals), r => paintSandals(ctx, x, y, r));
    if (sim.powers.double > 0) draw(sim.powers.double / powerSecFor(ups.double), r => paintSeal(ctx, x, y, r));
    if (sim.shield) draw(1, r => paintShield(ctx, x, y, r));
  }

  /** The day's word: its letters, the ones found filled, bottom right. */
  private drawWord(sim: PoslaniecSim): void {
    const word = sim.word;
    if (!word || (sim.p.wordDone && !sim.wordDoneNow)) return;
    const ctx = this.ctx, u = this.u;
    const n = word.length, s = 20 * u, gap = 4 * u;
    const total = n * s + (n - 1) * gap;
    const x0 = this.w - total - 16 * u, y = this.h - 16 * u - s;
    ctx.save();
    ctx.font = font(800, 9 * u, SANS);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,246,228,.85)';
    ctx.fillText(t('w.word'), this.w - 16 * u, y - 3 * u);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (s + gap);
      const got = i < sim.p.wordGot;
      ctx.fillStyle = got ? C.parchment : 'rgba(24,20,40,.45)';
      ctx.strokeStyle = got ? C.edge : 'rgba(255,255,255,.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, 4 * u);
      ctx.fill();
      ctx.stroke();
      if (got) {
        ctx.fillStyle = C.ink;
        ctx.font = font(800, 13 * u, SERIF);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(word[i], x + s / 2, y + s / 2 + 1);
      }
    }
    ctx.restore();
  }

  /** The cards: a city reached, a mission done, the multiplier, a block's verdict. */
  private drawCards(sim: PoslaniecSim): void {
    const ctx = this.ctx, u = this.u, w = this.w;
    let y = this.top + 8 * u;
    for (const c of this.cards) {
      const k = Math.min(1, c.t / 0.25, (c.dur - c.t) / 0.35);
      if (k <= 0) continue;
      ctx.save();
      ctx.globalAlpha = k;
      if (c.kind === 'mult') {
        const sc = ease.outBack(Math.min(1, c.t / 0.4));
        ctx.translate(this.cx, this.h * 0.4);
        ctx.scale(sc, sc);
        ctx.font = font(800, 40 * u, SERIF);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6 * u;
        ctx.strokeStyle = 'rgba(60,30,10,.6)';
        ctx.strokeText(c.text, 0, 0);
        ctx.fillStyle = C.gold2;
        ctx.fillText(c.text, 0, 0);
        ctx.restore();
        continue;
      }
      if (c.kind === 'city' && c.city !== undefined) {
        const cw = Math.min(w - 32 * u, 380 * u), ch = 74 * u;
        const x = (w - cw) / 2 - (1 - k) * 0;
        ctx.fillStyle = 'rgba(247,234,210,.97)';
        ctx.strokeStyle = C.edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, cw, ch, 10 * u);
        ctx.fill();
        ctx.stroke();
        paintPostcard(ctx, CITIES[c.city].id, c.city, x + 8 * u, y + 8 * u, 86 * u, ch - 16 * u, true);
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = font(800, 16 * u, SERIF);
        ctx.fillText(c.text, x + 104 * u, y + 12 * u, cw - 112 * u);
        ctx.font = font(600, 12 * u, SANS);
        ctx.fillStyle = '#6b5236';
        ctx.fillText(c.sub ?? '', x + 104 * u, y + 36 * u, cw - 112 * u);
        const nx = CITIES[(c.city + 1) % CITIES.length];
        ctx.fillText(t('story.next', { city: nx.name }), x + 104 * u, y + 52 * u, cw - 112 * u);
        y += ch + 8 * u;
        ctx.restore();
        continue;
      }
      ctx.font = font(700, 14 * u, SANS);
      const text = c.kind === 'mission' ? `✓ ${c.text}` : c.text;
      const tw = Math.min(w - 32 * u, ctx.measureText(text).width + 28 * u + (c.sub ? 80 * u : 0));
      const x = (w - tw) / 2, hh = 30 * u;
      const by = c.kind === 'verdict' ? this.h * 0.3 : y;
      ctx.fillStyle = c.kind === 'mission' ? 'rgba(47,79,143,.92)' : 'rgba(24,20,40,.72)';
      ctx.beginPath();
      ctx.roundRect(x, by, tw, hh, hh / 2);
      ctx.fill();
      ctx.fillStyle = '#fff6e4';
      ctx.textAlign = c.sub ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, c.sub ? x + 14 * u : w / 2, by + hh / 2, tw - 20 * u);
      if (c.sub) {
        ctx.fillStyle = C.gold2;
        ctx.textAlign = 'right';
        ctx.fillText(c.sub, x + tw - 14 * u, by + hh / 2);
      }
      if (c.kind !== 'verdict') y += hh + 6 * u;
      ctx.restore();
    }
    void sim;
  }

  /** The run's tally after Bela got the letter: the score, the metres, the record line, the next run coming. */
  private drawTally(sim: PoslaniecSim): void {
    const tl = sim.tally!;
    const ctx = this.ctx, u = this.u, w = this.w;
    const cw = Math.min(w - 32 * u, 360 * u), ch = 170 * u;
    const x = (w - cw) / 2, y = Math.max(this.top + 10 * u, this.h * 0.32 - ch / 2);
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,30,.35)';
    ctx.fillRect(0, 0, w, this.h);
    ctx.fillStyle = 'rgba(247,234,210,.98)';
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 14 * u);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#b9412e';
    ctx.font = font(800, 20 * u, SERIF);
    ctx.fillText(t('tally.title'), w / 2, y + 12 * u, cw - 20 * u);
    ctx.fillStyle = '#6b5236';
    ctx.font = font(600, 12 * u, SANS);
    ctx.fillText(t('tally.run', { n: tl.n }), w / 2, y + 40 * u);
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 34 * u, SERIF);
    ctx.fillText(t('pts', { n: grouped(tl.score) }), w / 2, y + 58 * u);
    ctx.font = font(600, 13 * u, SANS);
    ctx.fillText(`${metres(tl.metres)} · ${t('fx.pay', { n: tl.coins })}`, w / 2, y + 100 * u);
    ctx.fillStyle = tl.best ? '#b07a12' : '#6b5236';
    ctx.font = font(700, 13 * u, SANS);
    ctx.fillText(tl.best ? t('tally.best') : t('tally.toBest', { n: grouped(tl.toBest) }), w / 2, y + 122 * u, cw - 20 * u);
    // the next run coming: a bar
    const caughtT = clamp(sim.caughtLeft / RULES.caughtSec);
    ctx.fillStyle = 'rgba(107,82,54,.2)';
    ctx.fillRect(x + 24 * u, y + ch - 18 * u, cw - 48 * u, 4 * u);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x + 24 * u, y + ch - 18 * u, (cw - 48 * u) * (1 - caughtT), 4 * u);
    ctx.restore();
  }

  /** The opening card, the first time: the story in three sentences and the root passage. */
  private drawStory(): void {
    const ctx = this.ctx, u = this.u, w = this.w;
    const k = Math.min(1, (7.5 - this.story) / 0.4, this.story / 0.6);
    const cw = Math.min(w - 28 * u, 460 * u);
    const x = (w - cw) / 2;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = font(500, 14 * u, SANS);
    const lines = wrapLines(ctx, t('story.body'), cw - 36 * u);
    const p = passage('isa52.7');
    if (!this.storyLayout) this.storyLayout = layoutPassage(ctx, p, cw - 40 * u, 90 * u, { max: 15 * u, min: 10 });
    const L = this.storyLayout;
    const ch = 46 * u + lines.length * 19 * u + 12 * u + L.height + 18 * u;
    const y = Math.max(this.top + 8 * u, this.h * 0.36 - ch / 2);
    ctx.fillStyle = 'rgba(247,234,210,.97)';
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 14 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font(800, 20 * u, SERIF);
    ctx.fillText(t('story.title'), w / 2, y + 14 * u);
    ctx.font = font(500, 14 * u, SANS);
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y + 46 * u + i * 19 * u));
    drawPassage(ctx, p, L, w / 2, y + 46 * u + lines.length * 19 * u + 12 * u, { text: '#5a4630', ref: '#8a6a44' });
    ctx.restore();
  }
}
