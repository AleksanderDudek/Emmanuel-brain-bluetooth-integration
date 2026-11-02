/**
 * Zacheusz's play view, all on the canvas: Jericho at noon in side view — the sky, the wilderness
 * hills, the procession's dust far ahead (its nearness is the hold), the skyline of palms (the
 * signal's last 40 s, one palm a second: its height the level, a gold crown above the threshold,
 * teal behind rest, a stump where the band had no signal, hidden by the crowd in a blind block and
 * growing back when it parts, the newest seconds bracketed as the band's delay), the town's roofs
 * in haze, and the street itself: mudbrick houses with ladders, stalls under striped awnings,
 * walls, crates, ditches and wells, the high way in its states, the denarii, the hens, dogs and
 * baskets he hops, the fig trees of the shade, the sycamore at a course's end and his own house at
 * the end of the day.  Zacchaeus' sightline toward the dust is the live gauge: its length is the
 * level, a notch marks the threshold.  It only reads the sim (sim.ts); the HUD is in hud.ts.
 */
import { approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, traceBars, type TraceBar } from '../kit/trace';
import { DOOR_X, TIERS, missionById, type Tier } from './content';
import { Hud, lagLabel } from './hud';
import { t } from './i18n';
import { ZacheuszIntro } from './intro';
import { layout, type Layout } from './layout';
import type { ZacheuszProgress } from './meta';
import {
  C, SANS, SERIF, eyeOf, font, hash, mixHex, paintAwning, paintBasket, paintChicken, paintCoin, paintCrate, paintDitch, paintDog,
  paintFigTree, paintGround, paintHigh, paintHills, paintHouse, paintPalm, paintPlain, paintPlank, paintProcession, paintSky, paintStall,
  paintStump, paintSycamore, paintWall, paintWell, paintZacchaeus, restPose, type Crown, type HeroPose,
} from './paint';
import { RULES, type SimEvent, type ZacheuszSim } from './sim';
import type { Plat } from './world';

const TAU = Math.PI * 2;
const STRIPES = [C.madder, C.indigo, C.saffron];

/** A bit of dust, a feather, a leaf or a spark, in world units. */
interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number; spark: boolean }

export class ZacheuszView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new ZacheuszIntro();
  private started = false;
  private clock = 0;
  private fadeIn = 1;
  private camX = 0;
  private camY = 0;
  private camReady = false;
  private shadeK = 0;
  private mist = 0;
  private dustShown = 0;
  private gauge = 0;
  // the hero's picture
  private readonly pose: HeroPose = restPose();
  private runPh = 0;
  private squash = 0;
  private trailT = 0;
  // moments
  private readonly bits: Bit[] = [];
  private readonly awn = new Map<number, number>();
  private readonly pops = new Map<number, number>();
  private revealSec: number | null = null;
  private doorT = -1;
  private finishT = -1;
  private finishBranch = 0;
  private bars: TraceBar[] = [];
  private readonly lag: string;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
    this.hud.resize(this.L);
    this.lag = lagLabel(opts.eeg);
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

  intro(dt: number, p: number, progress: ZacheuszProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── world ↔ screen ──────────────────────────────────────────────
  private get S(): number { return this.L.S; }
  private sx(x: number): number { return this.L.hx + (x - this.camX) * this.S; }
  private sy(y: number): number { return this.L.gy - (y - this.camY) * this.S; }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: ZacheuszSim): void {
    const hero = sim.hero, u = this.L.u, rm = this.opts.reducedMotion;
    const hx = this.sx(hero.x), hy = this.sy(hero.y);
    switch (e.type) {
      case 'coin':
        this.spark(e.coin.x, e.coin.y, rm ? 2 : 5, C.coin);
        if (e.chain > 0 && e.chain % 10 === 0) this.hud.float(`×${e.chain}`, this.sx(e.coin.x), this.sy(e.coin.y) - 14 * u, C.gold2, 15);
        break;
      case 'special': {
        this.spark(e.coin.x, e.coin.y, rm ? 6 : 18, e.tier === 'silver' ? C.silver : e.tier === 'gold' ? C.gold : C.purple);
        this.hud.float(t('fx.special', { n: e.got }), this.sx(e.coin.x), this.sy(e.coin.y) - 20 * u, e.tier === 'purple' ? C.purple2 : C.gold2, 19, 1.3, 40);
        this.hud.popSlot(e.coin.special);
        this.hud.popScore();
        break;
      }
      case 'jump':
        this.dust(hero.x, hero.y, rm ? 1 : 3);
        break;
      case 'wallJump':
        this.spark(hero.x + RULES.halfW, hero.y + 0.5, rm ? 2 : 6, C.cream);
        this.hud.float(t('fx.wall'), hx, hy - 70 * u, C.indigo, 13, 0.8, 24);
        break;
      case 'bounce':
        this.awn.set(e.plat.id, this.clock);
        this.dust(hero.x, hero.y, 2);
        break;
      case 'vault':
        if (e.kind === 'chicken') for (let i = 0; i < (rm ? 3 : 8); i++) this.bit({ x: e.x, y: 0.35, vx: (Math.random() - 0.3) * 3, vy: 1 + Math.random() * 2.5, life: 0.9, max: 0.9, size: 0.06, color: '#f4ede0', g: 2.5, spark: false });
        break;
      case 'land':
        if (e.fall > 0.6) {
          this.squash = clamp(e.fall / 3);
          this.dust(hero.x, hero.y, rm ? 2 : Math.round(3 + e.fall * 2));
        }
        break;
      case 'legUp':
        this.hud.float(t('fx.legUp'), hx, hy - 60 * u, C.wood2, 14, 1.1);
        break;
      case 'rope':
        this.hud.float(t('fx.rope'), hx, hy - 50 * u, C.wood2, 15, 1.4);
        break;
      case 'plank':
        this.hud.float(t('fx.plank'), this.sx((e.pit.x0 + e.pit.x1) / 2), this.sy(0) - 40 * u, C.wood2, 14, 1.8);
        break;
      case 'lock':
        if (e.plat.state === 'solid') {
          this.pops.set(e.plat.id, this.clock);
          this.spark((e.plat.x0 + e.plat.x1) / 2, e.plat.y + 0.1, rm ? 2 : 6, C.gold);
        }
        break;
      case 'view':
        this.hud.card(t('fx.view'), t('card.view'), { icon: 'view', rank: 1, color: C.gold2, dur: 2.2 });
        this.hud.float(t('fx.view'), hx + 60 * u, hy - 90 * u, C.gold2, 22, 1.4, 40);
        break;
      case 'pass':
        this.hud.float(t('fx.pass', { n: e.coins }), hx + 80 * u, hy - 80 * u, C.gold2, 15, 1.6);
        break;
      case 'basket':
        this.hud.float(t('fx.basket', { n: e.pay }), hx, hy - 80 * u, C.figRipe, 16, 1.6);
        this.hud.popScore();
        break;
      case 'blindReveal':
        this.revealSec = e.sec;
        if (e.solid > 0) this.hud.card(t('card.blind'), t('card.reveal', { n: e.solid }), { icon: 'view', rank: 1, color: '#6a5f74' });
        break;
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(e.block, e.t0, e.t1, e.verdict, e.share, e.need, e.block.kind === 'push' && e.block.blind ? this.revealSec : null);
        this.revealSec = null;
        break;
      case 'figs':
        for (let i = 0; i < (rm ? 2 : 6); i++) this.bit({ x: e.tree.x, y: 2.4, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, life: 1.2, max: 1.2, size: 0.07, color: i % 2 ? C.leaf2 : C.figRipe, g: 3, spark: false });
        if (e.n > 0) this.hud.float(t('fx.figs', { n: e.n }), this.sx(e.tree.x), this.sy(2.2), C.figRipe, 16, 1.3);
        break;
      case 'courseStart': {
        const c = e.course;
        this.hud.card(c.name, c.index < 0 ? t('card.dailySub') : t('card.course', { n: c.index + 1, total: RULES.courses }), { icon: 'course', rank: 2, dur: 2.4 });
        break;
      }
      case 'finish': {
        this.finishT = this.clock;
        this.finishBranch = e.branch;
        for (let i = 0; i < (rm ? 6 : 28); i++) {
          const a = Math.random() * TAU;
          this.bit({ x: hero.x, y: hero.y + 0.6, vx: Math.cos(a) * 3, vy: 2 + Math.sin(a) * 3, life: 1.4, max: 1.4, size: 0.06, color: [C.gold, C.frond2, C.madder, C.cream][i % 4], g: 4, spark: false });
        }
        this.hud.float(t('fx.branch', { n: e.branch }), hx, hy - 40 * u, C.gold2, 20, 1.5, 44);
        this.hud.popScore();
        this.hud.card(t('card.finish', { n: e.branch, pay: e.pay }), t('card.voice'), { icon: 'tree', rank: 0, dur: 3, color: C.leaf });
        if (e.completed) {
          const next = TIERS[TIERS.indexOf(e.completed) + 1] as Tier | undefined;
          this.hud.card(t('card.tier', { tier: t(`tier.${e.completed}`) }), next ? t('card.tierNext', { tier: t(`tier.${next}`) }) : '', { icon: 'coin', tier: e.completed, rank: 1 });
        }
        if (e.first && e.course.index >= 0 && e.course.index < RULES.courses - 1) this.hud.card(t('card.unlock'), '', { icon: 'course', rank: 2, dur: 2 });
        break;
      }
      case 'home':
        this.hud.card(t('card.home'), `${e.home.name} — ${e.home.fix}`, { icon: 'home', rank: 0, dur: 3, color: C.brickDark });
        break;
      case 'mission':
        this.hud.card(t('card.mission', { name: missionById(e.id)?.name ?? e.id }), t('card.missionPay', { n: RULES.missionPay }), { icon: 'mission', rank: 1 });
        break;
      case 'gift':
        this.hud.card(t('card.gift', { n: e.pay }), '', { icon: 'home', rank: 2 });
        break;
      case 'treeEnd':
        this.hud.float(t('fx.onward'), hx + 40 * u, hy - 70 * u, C.brickDark, 14, 1.8, 30);
        break;
      case 'door':
        this.doorT = this.clock;
        break;
      default:
        break;
    }
  }

  private dust(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) this.bit({ x: x + (Math.random() - 0.5) * 0.4, y: y + 0.05, vx: (Math.random() - 0.7) * 1.6, vy: Math.random() * 0.8, life: 0.5, max: 0.5, size: 0.08 + Math.random() * 0.06, color: 'rgba(222,190,140,.8)', g: -0.5, spark: false });
  }

  private spark(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = 1.5 + Math.random() * 2.5;
      this.bit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45, max: 0.45, size: 0.05, color, g: 0, spark: true });
    }
  }

  private bit(b: Bit): void {
    if (this.bits.length > 260) this.bits.shift();
    this.bits.push(b);
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: ZacheuszSim): void {
    this.clock += dt;
    this.fadeIn = Math.max(0, this.fadeIn - dt * 2);
    const h = sim.hero, L = this.L;
    const tx = h.x - L.hx / this.S;
    const ty = Math.max(0, h.y - (L.tall ? 2.2 : 1.2));
    if (!this.camReady) {
      this.camX = tx;
      this.camY = ty;
      this.camReady = true;
    }
    this.camX = approach(this.camX, tx, dt, sim.rope ? 0.12 : 0.03);
    this.camY = approach(this.camY, ty, dt, 0.45);
    const z = sim.zone;
    this.shadeK = approach(this.shadeK, z?.kind === 'shade' ? 1 : 0, dt, 0.9);
    this.mist = approach(this.mist, sim.reliable ? 0 : 1, dt, 0.6);
    this.dustShown = approach(this.dustShown, sim.dust, dt, 0.4);
    const showGauge = sim.phase === 'play' && sim.block.kind === 'push' && !sim.block.blind;
    this.gauge = approach(this.gauge, showGauge ? clamp(sim.L) : 0, dt, 0.25);
    // the run cycle and the squash
    const p = this.pose;
    const speed = Math.abs(h.vx);
    this.runPh += dt * speed * 3.1;
    p.run = this.runPh;
    p.stride = approach(p.stride, h.ground && h.mode === 'run' ? clamp(speed / RULES.run) : 0, dt, 0.08);
    p.air = h.mode === 'run' && !h.ground ? (h.vy > 0 ? 1 : -1) : 0;
    p.slide = h.sliding;
    p.climb = h.mode === 'climb';
    p.hang = h.mode === 'rope';
    p.sit = h.mode === 'tree';
    p.look = sim.sighted ? -0.6 : -0.3;
    this.squash = Math.max(0, this.squash - dt * 5);
    p.squash = this.opts.reducedMotion ? 0 : this.squash;
    // dust from his heels as he runs
    this.trailT += dt;
    if (h.standing && speed > 3 && this.trailT > 0.12 && !this.opts.reducedMotion) {
      this.trailT = 0;
      this.dust(h.x - 0.15, h.y, 1);
    }
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
    this.bars = traceBars(sim.trace, Math.floor(sim.t), 40, 40);
    this.hud.update(dt, sim);
  }

  draw(sim: ZacheuszSim): void {
    const { ctx, w, h } = this;
    if (w < 2 || h < 2 || !this.started) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBack(sim);
    this.drawSkyline(sim);
    this.drawTown();
    this.drawShade(sim);
    this.drawStreet(sim);
    this.drawSightline(sim);
    this.drawHero(sim);
    this.drawBits();
    if (this.mist > 0.02) {
      ctx.fillStyle = `rgba(236,232,222,${0.18 * this.mist})`;
      ctx.fillRect(0, 0, w, h);
    }
    this.hud.draw(sim);
    this.drawFinaleText();
    if (this.fadeIn > 0) {
      ctx.fillStyle = `rgba(42,30,23,${this.fadeIn * 0.8})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ── the far world ───────────────────────────────────────────────
  private drawBack(sim: ZacheuszSim): void {
    const { ctx, L, w, h } = this;
    const S = this.S, lift = this.camY * S;
    const hor = L.horizon + lift * 0.15;
    paintSky(ctx, w, h, hor + L.palmMax * 0.1, this.shadeK);
    ctx.fillStyle = mixHex(C.skyLow, '#dcd2a8', this.shadeK * 0.5);
    ctx.fillRect(0, hor, w, h - hor);
    paintHills(ctx, w, hor + 2, L.palmMax * 0.55, this.camX * S * 0.03, mixHex(C.hillFar, '#a9b7ad', this.shadeK * 0.4), 1.3, h);
    // the procession's dust far ahead: nearer as he holds his view
    const d = this.dustShown;
    const px = w * (0.93 - 0.3 * d), r = Math.max(10, S * (0.5 + 0.8 * d)) * (L.tall ? 0.8 : 1);
    paintProcession(ctx, px, hor + 2, r, this.clock, d);
    paintPlain(ctx, w, hor + L.palmMax * 0.1, h, this.camX * S * 0.12, this.shadeK);
    void sim;
  }

  /** Where the sightline aims: the dust on the horizon. */
  private dustPoint(): { x: number; y: number } {
    const L = this.L, d = this.dustShown;
    const r = Math.max(10, this.S * (0.5 + 0.8 * d)) * (L.tall ? 0.8 : 1);
    return { x: this.w * (0.93 - 0.3 * d), y: L.horizon + this.camY * this.S * 0.15 + 2 - r * 0.45 };
  }

  /**
   * The skyline of palms: the last 40 s of the signal, one palm a second (kit/trace.ts traceBars),
   * scrolling left with time.  Height = the second's level; crown gold above the threshold, teal in
   * rest, green below; a stump with a dotted ring where the band had no signal; the crowd over a
   * blind block, the palms growing back when it parts; the band's delay bracketed at the new end.
   */
  private drawSkyline(sim: ZacheuszSim): void {
    const { ctx, L } = this;
    const bars = this.bars;
    if (!bars.length) return;
    const lift = this.camY * this.S * 0.15;
    const base = L.horizon + lift + L.palmMax * 0.14;
    const x0 = L.skyX0, x1 = L.skyX1;
    const pps = (x1 - x0) / 40;
    const now = sim.t, sec0 = Math.floor(now) - 40;
    const xOf = (i: number) => x1 - (now - (sec0 + i + 0.5)) * pps;
    const hOf = (lv: number) => L.palmMax * (0.22 + 0.78 * clamp(lv));
    const size = Math.max(7, Math.min(pps * 1.35, L.palmMax * 0.42));
    const lagN = LAG_SEC[sim.eeg ? 'eeg' : 'fnirs'];
    ctx.save();
    // the cool band behind rest seconds, the threshold's height as a faint dashed line
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if (b.empty || b.phase !== 'rest' || b.shown <= 0) continue;
      ctx.fillStyle = 'rgba(79,163,154,.2)';
      ctx.fillRect(xOf(i) - pps / 2, base - L.palmMax * 1.08, pps + 0.5, L.palmMax * 1.08);
    }
    ctx.strokeStyle = 'rgba(122,82,30,.45)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, base - hOf(0.5));
    ctx.lineTo(x1, base - hOf(0.5));
    ctx.stroke();
    ctx.setLineDash([]);
    const sway = this.opts.reducedMotion ? 0 : Math.sin(this.clock * 1.3) * 0.4;
    let crowd0 = -1;
    for (let i = 0; i <= bars.length; i++) {
      const b = bars[i];
      const x = i < bars.length ? xOf(i) : 0;
      const veiled = !!b && !b.empty && b.shown <= 0;
      if (veiled && crowd0 < 0) crowd0 = x - pps / 2;
      if (!veiled && crowd0 >= 0) {
        this.crowd(crowd0, (i < bars.length ? x : x1 + pps) - pps / 2, base, size);
        crowd0 = -1;
      }
      if (!b || b.empty || veiled || x < x0 - pps || x > x1 + pps) continue;
      const young = i >= bars.length - lagN;
      if (!b.reliable) {
        paintStump(ctx, x, base, size);
        ctx.strokeStyle = 'rgba(90,70,50,.55)';
        ctx.setLineDash([1, 3]);
        ctx.beginPath();
        ctx.arc(x, base - size * 0.62, size * 0.2, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const crown: Crown = b.phase === 'rest' ? 'teal' : b.above ? 'gold' : 'green';
      const grow = b.shown < 1 ? ease.outBack(b.shown) : 1;
      paintPalm(ctx, x, base, hOf(b.level) * grow, size * (young ? 0.75 : 1), crown, sway + Math.sin(i * 1.7) * 0.2, young ? 0.55 : 1);
    }
    // the band's delay at the new end: "≈ 5 s" — where the effort of now will show
    const lx0 = x1 - lagN * pps - (now - Math.floor(now)) * pps, lx1 = x1;
    const by = base - L.palmMax * 1.12;
    ctx.strokeStyle = 'rgba(42,30,23,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx0, by + 5);
    ctx.lineTo(lx0, by);
    ctx.lineTo(lx1, by);
    ctx.lineTo(lx1, by + 5);
    ctx.stroke();
    ctx.font = font(700, 10 * L.u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(42,30,23,.8)';
    ctx.fillText(this.lag, (lx0 + lx1) / 2, by - 2);
    ctx.restore();
  }

  /** The crowd over a blind block's palms: people shoulder to shoulder, a few raised branches (they hide the view). */
  private crowd(xa: number, xb: number, base: number, size: number): void {
    const { ctx, L } = this;
    const bw = Math.max(6, size * 0.5);
    const cols = ['#7a5a8a', '#b0623e', '#cdb48f', '#4d64a3', '#8a6a4a', '#5d3a72'];
    for (let x = xa + bw * 0.5, i = 0; x < xb; x += bw * 0.82, i++) {
      const hh = L.palmMax * (0.5 + 0.18 * hash(i + Math.floor(xa)));
      const bob = Math.sin(this.clock * 3 + i * 1.3) * 1.2;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, base - hh + bob, bw, hh, bw * 0.4);
      ctx.fill();
      ctx.fillStyle = i % 3 ? '#e9dcc0' : '#d9b48a';
      ctx.beginPath();
      ctx.arc(x, base - hh - bw * 0.32 + bob, bw * 0.4, 0, TAU);
      ctx.fill();
      if (i % 4 === 1) {
        ctx.strokeStyle = C.frond;
        ctx.lineWidth = Math.max(1.5, bw * 0.15);
        ctx.beginPath();
        ctx.moveTo(x + bw * 0.3, base - hh + bob);
        ctx.quadraticCurveTo(x + bw * 0.6, base - hh - L.palmMax * 0.3, x + bw * (0.5 + 0.3 * Math.sin(this.clock * 2 + i)), base - hh - L.palmMax * 0.5);
        ctx.stroke();
      }
    }
  }

  /** The town in haze behind the street: flat roofs with parapets and dark windows, a tower, a dome, scrolling slower than the street. */
  private drawTown(): void {
    const { ctx, w } = this;
    const S = this.S * 0.55;
    const off = this.camX * this.S * 0.32;
    const base = this.sy(0) - this.camY * this.S * 0.55;
    const step = S * 2.1;
    const i0 = Math.floor(off / step) - 1;
    const far = mixHex('#e6c49a', '#bfcab6', this.shadeK * 0.5);
    const near = mixHex('#d9ae7f', '#a9b9a6', this.shadeK * 0.5);
    for (let pass = 0; pass < 2; pass++) {
      const k = pass ? 1 : 0.55;
      for (let i = i0; i < i0 + Math.ceil(w / step) + 3; i++) {
        const r = hash(i * 3.7 + 11 + pass * 50);
        const x = i * step - off * k - pass * S * 0.9;
        const bw = S * (1.4 + r * 1.1), bh = S * (pass ? 0.9 + hash(i + 5) * 1.2 : 1.6 + hash(i + 7) * 1.4);
        ctx.fillStyle = pass ? near : far;
        ctx.fillRect(x, base - bh, bw, bh + this.h);
        ctx.fillRect(x - S * 0.05, base - bh - S * 0.08, bw + S * 0.1, S * 0.1);
        if (r > 0.8 && !pass) ctx.fillRect(x + bw * 0.3, base - bh - S * 1.1, bw * 0.4, S * 1.2);
        if (r < 0.14) {
          ctx.beginPath();
          ctx.arc(x + bw / 2, base - bh, bw * 0.32, Math.PI, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = pass ? 'rgba(90,55,35,.35)' : 'rgba(110,70,45,.2)';
        for (let wx = x + S * 0.3; wx < x + bw - S * 0.3; wx += S * 0.7) ctx.fillRect(wx, base - bh + S * 0.35, S * 0.18, S * 0.24);
      }
    }
  }

  // ── the street ──────────────────────────────────────────────────
  private visible(x0: number, x1: number): boolean {
    const a = this.camX - this.L.hx / this.S - 1, b = this.camX + (this.w - this.L.hx) / this.S + 1;
    return x1 >= a && x0 <= b;
  }

  private drawStreet(sim: ZacheuszSim): void {
    const { ctx, h } = this;
    const S = this.S, w = sim.world, now = this.clock;
    const bottom = h + 4;
    // the finale's house and the decor palms first (behind the street's pieces)
    for (const z of w.zones) {
      if (z.kind === 'finale' && this.visible(z.x0, z.x1)) this.homeAtDusk(z.x0 + DOOR_X, sim);
    }
    for (const p of w.palms) if (this.visible(p.x - 2, p.x + 2)) paintPalm(ctx, this.sx(p.x), this.sy(0), (p.h + 0.9) * S, S * 1.6, 'green', Math.sin(now * 0.8 + p.x) * 0.3);
    for (const f of w.figs) if (this.visible(f.x - 2, f.x + 2)) paintFigTree(ctx, this.sx(f.x), this.sy(0), S, f.picked >= 0 ? 1 : sim.ripe, f.picked, Math.sin(now + f.x));
    // pits under the street
    for (const p of w.pits) {
      if (!this.visible(p.x0, p.x1)) continue;
      if (p.kind === 'well') paintWell(ctx, this.sx(p.x0), this.sx(p.x1), this.sy(0), bottom, S);
      else paintDitch(ctx, this.sx(p.x0), this.sx(p.x1), this.sy(0), bottom, S, now);
    }
    for (const s of w.solids) {
      if (!this.visible(s.x0, s.x1)) continue;
      const x0 = this.sx(s.x0), x1 = this.sx(s.x1), top = this.sy(s.top), base = this.sy(Math.max(0, s.bottom));
      switch (s.kind) {
        case 'ground': paintGround(ctx, x0, x1, top, bottom, S, s.id, this.shadeK); break;
        case 'house': paintHouse(ctx, x0, x1, top, base, S, s.id, s.ladder); break;
        case 'stall': paintStall(ctx, x0, x1, top, base, S, s.id); break;
        case 'wall': paintWall(ctx, x0, x1, top, base, S); break;
        case 'crate': paintCrate(ctx, x0, x1, top, base, S); break;
        case 'trunk': paintSycamore(ctx, x0, x1, base, S, this.finishT >= 0 && now - this.finishT < RULES.treeSec ? this.finishBranch : 0, now); break;
      }
    }
    for (const p of w.plats) {
      if (!this.visible(p.x0, p.x1)) continue;
      this.plat(p, sim);
    }
    // the things he hops over
    for (const v of w.vaults) {
      if (!this.visible(v.x - 1, v.x + 1)) continue;
      const x = this.sx(v.x), y = this.sy(0), since = v.at >= 0 ? sim.t - v.at : -1;
      if (v.kind === 'basket') paintBasket(ctx, x, y, S);
      else if (v.kind === 'chicken') paintChicken(ctx, x, y, S, now + v.x, since < 0 ? 0 : clamp(since / 0.8));
      else paintDog(ctx, x, y, S, since < 0 ? 0 : clamp(since / 0.4));
    }
    // denarii
    const tier = sim.tier;
    for (const c of w.coins) {
      if (!this.visible(c.x - 0.5, c.x + 0.5)) continue;
      const sp = c.special >= 0;
      const kind = sp ? tier : 'denar';
      const r = S * (sp ? 0.27 : 0.16);
      if (c.got) {
        const k = (sim.t - c.gotAt) / 0.35;
        if (k >= 1) continue;
        ctx.globalAlpha = 1 - k;
        paintCoin(ctx, this.sx(c.x), this.sy(c.y + k * 0.8), r * (1 - 0.4 * k), kind, now * 12);
        ctx.globalAlpha = 1;
        continue;
      }
      const born = c.born >= 0 ? clamp((sim.t - c.born) / 0.35) : 1;
      if (born <= 0) continue;
      const bob = Math.sin(now * 3 + c.x) * S * 0.04;
      if (sp) {
        ctx.fillStyle = tier === 'purple' ? 'rgba(155,89,208,.25)' : 'rgba(255,240,190,.35)';
        ctx.beginPath();
        ctx.arc(this.sx(c.x), this.sy(c.y) + bob, r * (1.5 + 0.15 * Math.sin(now * 4)), 0, TAU);
        ctx.fill();
      }
      paintCoin(ctx, this.sx(c.x), this.sy(c.y) + bob, r * ease.outBack(born), kind, now * 2.4 + c.x);
    }
  }

  private plat(p: Plat, sim: ZacheuszSim): void {
    const { ctx } = this;
    const S = this.S, x0 = this.sx(p.x0), x1 = this.sx(p.x1), y = this.sy(p.y);
    if (p.kind === 'awning') {
      const since = this.awn.has(p.id) ? this.clock - this.awn.get(p.id)! : 9;
      const sq = since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * (1 - since / 0.5) : 0;
      const poles = this.sy(Math.max(0, sim.world.topAt(p.x0, p.x0 + 0.2, p.y - 0.01)));
      paintAwning(ctx, x0, x1, y, S, STRIPES[p.id % 3], this.opts.reducedMotion ? 0 : sq, poles);
    } else if (p.kind === 'plank') paintPlank(ctx, x0, x1, y, S);
    else if (p.high) {
      const since = this.pops.has(p.id) ? this.clock - this.pops.get(p.id)! : 9;
      paintHigh(ctx, p.kind as 'bridge' | 'frond' | 'roofawn', x0, x1, y, S, p.state, sim.sighted ? clamp(sim.L) : 0, this.clock, since < 0.35 && !this.opts.reducedMotion ? since / 0.35 : 0);
    }
  }

  /** His own house at the day's end: a lamp in the doorway, a table set for a guest. */
  private homeAtDusk(x: number, sim: ZacheuszSim): void {
    const { ctx } = this;
    const S = this.S;
    const x0 = this.sx(x - 2.6), x1 = this.sx(x + 2.6), top = this.sy(2.8), base = this.sy(0);
    paintHouse(ctx, x0, x1, top, base, S, 77, false);
    const dx = this.sx(x), dw = S * 0.8, dh = S * 1.5;
    const glow = this.doorT >= 0 ? clamp((this.clock - this.doorT) / 1) : 0.4;
    const g = ctx.createRadialGradient(dx, base - dh * 0.5, 0, dx, base - dh * 0.5, S * 2.5);
    g.addColorStop(0, `rgba(255,214,120,${0.55 * glow})`);
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(dx - S * 2.5, base - S * 3, S * 5, S * 3);
    ctx.fillStyle = '#ffd88a';
    ctx.fillRect(dx - dw / 2, base - dh, dw, dh);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.strokeRect(dx - dw / 2, base - dh, dw, dh);
    // the table and its bread and a cup
    ctx.fillStyle = C.wood2;
    ctx.fillRect(dx - dw * 0.35, base - S * 0.45, dw * 0.7, S * 0.08);
    ctx.fillRect(dx - dw * 0.3, base - S * 0.45, S * 0.06, S * 0.45);
    ctx.fillRect(dx + dw * 0.3 - S * 0.06, base - S * 0.45, S * 0.06, S * 0.45);
    ctx.fillStyle = '#d9a35b';
    ctx.beginPath();
    ctx.ellipse(dx - dw * 0.12, base - S * 0.5, S * 0.12, S * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.madder;
    ctx.fillRect(dx + dw * 0.08, base - S * 0.6, S * 0.08, S * 0.14);
    // the lamp
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.arc(dx + dw * 0.75, base - dh * 0.9, S * (0.08 + 0.01 * Math.sin(this.clock * 9)), 0, TAU);
    ctx.fill();
    void sim;
  }

  /** The sycamore's shade over the street: a cool tint, soft at both ends, and dappled light. */
  private drawShade(sim: ZacheuszSim): void {
    const { ctx } = this;
    const S = this.S;
    for (const z of sim.world.zones) {
      if (z.kind !== 'shade' || !this.visible(z.x0, z.x1)) continue;
      const x0 = this.sx(z.x0), x1 = this.sx(z.x1);
      {
        const top = this.sy(5.5), bot = this.sy(0), fade = S * 2;
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        const k = Math.min(0.45, fade / Math.max(1, x1 - x0));
        g.addColorStop(0, 'rgba(31,79,87,0)');
        g.addColorStop(k, 'rgba(31,79,87,.18)');
        g.addColorStop(1 - k, 'rgba(31,79,87,.18)');
        g.addColorStop(1, 'rgba(31,79,87,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, top, x1 - x0, bot - top);
        // dappled light on the street
        ctx.fillStyle = 'rgba(255,240,190,.22)';
        for (let i = 0; i < (z.x1 - z.x0) / 1.4; i++) {
          const x = z.x0 + 0.5 + i * 1.4 + hash(z.id + i) * 0.6;
          ctx.beginPath();
          ctx.ellipse(this.sx(x), this.sy(0) + S * 0.12, S * (0.25 + 0.2 * hash(i + 3)), S * 0.06, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  // ── Zacchaeus and his sightline ─────────────────────────────────
  /**
   * The live gauge: a dashed line from his eyes toward the procession's dust, as long as the level
   * (all the way to the dust at full), a notch at the threshold, gold beyond it.  Pale and dotted
   * while the band has no signal (held where it was); hidden by the crowd and in rest.
   */
  private drawSightline(sim: ZacheuszSim): void {
    const k = this.gauge;
    if (k < 0.01 && !(sim.phase === 'play' && sim.block.kind === 'push' && !sim.block.blind)) return;
    const { ctx } = this;
    const h = sim.hero, S = this.S;
    const e = eyeOf(S);
    const ex = this.sx(h.x) + e.x, ey = this.sy(h.y) + e.y;
    const d = this.dustPoint();
    const dx = d.x - ex, dy = d.y - ey, len = Math.hypot(dx, dy);
    if (len < 10) return;
    const ux = dx / len, uy = dy / len;
    const live = sim.sighted;
    const a = live ? 1 : 0.45;
    const reach = len * k, notch = len * 0.5;
    ctx.save();
    ctx.lineCap = 'round';
    // the full way to the dust, faint
    ctx.strokeStyle = `rgba(255,248,230,${0.22 * a})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
    // the sightline itself
    const mist = !sim.reliable;
    ctx.setLineDash(mist ? [1.5, 5] : [7, 5]);
    ctx.lineDashOffset = -this.clock * 18;
    ctx.lineWidth = Math.max(2, S * 0.05);
    const cut = Math.min(reach, notch);
    ctx.strokeStyle = mist ? 'rgba(240,240,236,.6)' : `rgba(255,248,230,${0.85 * a})`;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + ux * cut, ey + uy * cut);
    ctx.stroke();
    if (reach > notch) {
      ctx.strokeStyle = mist ? 'rgba(240,240,236,.6)' : `rgba(242,193,78,${a})`;
      ctx.beginPath();
      ctx.moveTo(ex + ux * notch, ey + uy * notch);
      ctx.lineTo(ex + ux * reach, ey + uy * reach);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the notch at the threshold
    const nx = ex + ux * notch, ny = ey + uy * notch;
    ctx.strokeStyle = `rgba(42,30,23,${0.75 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nx - uy * 7, ny + ux * 7);
    ctx.lineTo(nx + uy * 7, ny - ux * 7);
    ctx.stroke();
    // the tip: a glint where his look reaches
    const tx = ex + ux * reach, ty = ey + uy * reach;
    ctx.fillStyle = reach > notch && !mist ? C.gold : C.cream;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(2.5, S * 0.06) * (1 + 0.15 * Math.sin(this.clock * 6)), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawHero(sim: ZacheuszSim): void {
    const { ctx } = this;
    const h = sim.hero, S = this.S;
    const x = this.sx(h.x), y = this.sy(h.y);
    // his shadow on what is under him
    const top = sim.world.topAt(h.x - 0.2, h.x + 0.2, h.y + 0.01);
    if (Number.isFinite(top) && h.mode !== 'rope') {
      const gap = clamp((h.y - top) / 3);
      ctx.fillStyle = `rgba(42,30,23,${0.25 * (1 - gap)})`;
      ctx.beginPath();
      ctx.ellipse(x, this.sy(top), S * 0.26 * (1 - gap * 0.5), S * 0.06, 0, 0, TAU);
      ctx.fill();
    }
    if (sim.rope) {
      // the neighbour's rope from above
      ctx.strokeStyle = C.rope;
      ctx.lineWidth = Math.max(2, S * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(this.clock * 5) * 4, -10);
      ctx.lineTo(x, y - S * 1.1);
      ctx.stroke();
    }
    paintZacchaeus(ctx, x, y, S, this.pose);
  }

  private drawBits(): void {
    const { ctx } = this;
    const S = this.S;
    for (const b of this.bits) {
      const a = Math.max(0, b.life / b.max);
      ctx.globalAlpha = a;
      if (b.spark) {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = Math.max(1.2, S * 0.03);
        ctx.beginPath();
        ctx.moveTo(this.sx(b.x), this.sy(b.y));
        ctx.lineTo(this.sx(b.x - b.vx * 0.05), this.sy(b.y - b.vy * 0.05));
        ctx.stroke();
      } else {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(this.sx(b.x), this.sy(b.y), Math.max(1, b.size * S * (0.5 + 0.5 * a)), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFinaleText(): void {
    if (this.doorT < 0) return;
    const { ctx, L } = this;
    const k = clamp((this.clock - this.doorT) / 0.8);
    if (k <= 0) return;
    const u = L.u;
    ctx.save();
    ctx.globalAlpha = ease.outCubic(k);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = L.cardY;
    ctx.font = font(500, 34 * u, SERIF, true);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(251,241,220,.85)';
    ctx.strokeText(t('finale.title'), L.w / 2, y);
    ctx.fillStyle = C.ink;
    ctx.fillText(t('finale.title'), L.w / 2, y);
    ctx.font = font(650, 14 * u, SANS);
    ctx.strokeText(t('finale.sub'), L.w / 2, y + 30 * u);
    ctx.fillStyle = C.brickDark;
    ctx.fillText(t('finale.sub'), L.w / 2, y + 30 * u);
    ctx.restore();
  }
}
