/**
 * Zacheusz's play view: Jericho at noon in side view, the camera running with him.  Back to front:
 * the sky, the hills, the skyline of palms along the horizon (the band's last 40 s, one palm a
 * second — the in-world history: a gold crown above the threshold, blue-green in a rest block, a
 * stump where the signal failed, the crowd's backs veiling a blind block), the town's silhouettes
 * with the townsfolk who cheer a stylish move, then the street itself — pits, stalls, walls,
 * houses, crates, the crowd, awnings and planks, the inlaid stones, the fig orchard's shade and
 * trees, the finish palm or the sycamore — the band's road of light with its growing tip and the
 * dotted mark of where it reaches at the threshold, the springs, the coins and the special denarii,
 * the geese and goats, Zacchaeus (in his bubble, on the rope, on the trunk), Mela trotting behind
 * with her speech bubble, particles and flying words, and the overlays of hud.ts.
 *
 * The runner draws the Mendi panel and the score; nothing here duplicates them.
 */
import type { TraceBar } from '../kit/trace';
import { traceBars } from '../kit/trace';
import { Floaters, Particles, Shake, approach, clamp } from '../kit/juice';
import { HOMES, levelName } from './content';
import { t } from './i18n';
import { ZacheuszIntro } from './intro';
import { layout, type Layout } from './layout';
import type { ZacheuszProgress } from './meta';
import {
  C, SANS, hash, paintAwning, paintBubble, paintCoin, paintCrate, paintCrowd, paintDitch, paintFigTree, paintFinishPalm, paintGoat,
  paintGoose, paintGround, paintHills, paintHouse, paintLightPlank, paintPalm, paintPlank, paintProcession, paintSky, paintSpring,
  paintStall, paintStone, paintStump, paintSycamore, paintWall, paintWell, paintZacchaeus, restPose, type HeroPose,
} from './paint';
import { RULES } from './rules';
import { REACH_MARK, nextLevelName, type SimEvent, type ZacheuszSim } from './sim';
import { StoryCard, drawBanner, drawButton, drawLevelCard, drawSpeech, drawStrip, drawTally, tierKind } from './hud';

const TAU = Math.PI * 2;
const STRIPES = [C.madder, C.indigo, C.saffron];

export class ZacheuszView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800, 0);
  private readonly intro0 = new ZacheuszIntro();
  private readonly story = new StoryCard();
  private readonly parts = new Particles(500);
  private readonly words = new Floaters();
  private readonly shake: Shake;
  private clock = 0;
  private fade = 1;
  private camX = 0;
  private camY = 0;
  private camReady = false;
  private readonly pose: HeroPose = restPose();
  private runPh = 0;
  private squash = 0;
  private bars: TraceBar[] = [];
  // moments
  private levelT = 99;
  private levelReplay = false;
  private grabY = 0;
  private cheer = 0;
  private toss = 0;
  private slotPop = 0;
  private btnPress = 0;
  private banner: { text: string; t: number; color: string } | null = null;
  private melaX = 0;
  private melaHop = 0;
  private readonly honks = new Map<number, number>();
  private roadFlash = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, hudTop: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, hudTop);
  }

  start(): void { this.fade = 1; }

  intro(dt: number, p: number, progress: ZacheuszProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── world ↔ screen ──────────────────────────────────────────────
  private get S(): number { return this.L.S; }
  sx(x: number): number { return this.L.hx + (x - this.camX) * this.S; }
  sy(y: number): number { return this.L.gy - (y - this.camY) * this.S; }
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: clamp(this.sx(x), 30, this.L.w - 30), y: clamp(this.sy(y), this.L.hudTop + 30, this.L.h - 30) };
  }

  /** The bubble button (bottom right). */
  hitButton(x: number, y: number): boolean {
    const b = this.L.btn;
    const d = Math.hypot(x - b.x, y - b.y) <= b.r + 10;
    if (d) this.btnPress = 1;
    return d;
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: ZacheuszSim): void {
    const rm = this.opts.reducedMotion, u = this.L.u, S = this.S;
    const h = sim.hero;
    switch (e.type) {
      case 'coin':
        this.parts.burst(this.sx(e.x), this.sy(e.y), rm ? 2 : 5, { color: e.light ? '#fff2b0' : C.coin, size: 2.5, speed: 90, g: 120, life: 0.4 });
        if (e.chain > 0 && e.chain % 10 === 0) this.words.add(`×${e.chain}`, this.sx(e.x), this.sy(e.y) - 10, { color: C.gold2, size: 16 * u });
        break;
      case 'special':
        this.parts.burst(this.sx(e.x), this.sy(e.y), rm ? 8 : 24, { color: tierKind(e.tier) === 'purple' ? C.purple : tierKind(e.tier) === 'gold' ? C.gold : C.silver, size: 3.5, speed: 220, shape: 'spark' });
        this.words.add(`${e.got}/5`, this.sx(e.x), this.sy(e.y) - 16, { color: tierKind(e.tier) === 'purple' ? C.purple2 : C.gold2, size: 24 * u, dur: 1.3 });
        this.slotPop = 1;
        this.shake.add(0.15);
        break;
      case 'set':
        this.banner = { text: t('fx.set', { n: e.pay }), t: 0, color: C.gold };
        this.shake.add(0.3);
        break;
      case 'jump':
        this.parts.burst(this.sx(h.x), this.sy(h.y), rm ? 1 : 4, { color: '#d9b48a', size: 3, speed: 60, g: 80, angle: -Math.PI / 2, spread: 2.4, life: 0.4 });
        break;
      case 'land':
        if (e.fall > 0.8) {
          this.squash = clamp(e.fall / 3);
          this.parts.burst(this.sx(h.x), this.sy(h.y), rm ? 2 : 6, { color: '#d9b48a', size: 3, speed: 80, g: 60, angle: -Math.PI / 2, spread: 3, life: 0.45 });
        }
        break;
      case 'wallJump':
        this.parts.burst(this.sx(e.x), this.sy(e.y + 0.5), rm ? 2 : 7, { color: C.cream, size: 2.5, speed: 140, shape: 'spark', life: 0.35 });
        break;
      case 'spin':
        this.parts.burst(this.sx(e.x), this.sy(e.y + 0.5), rm ? 2 : 10, { color: '#fff4d0', size: 2, speed: 120, shape: 'ring', life: 0.4, g: 0 });
        break;
      case 'bounce':
        if (e.on === 'crowd') this.toss = 1;
        this.parts.burst(this.sx(e.x), this.sy(e.y), rm ? 2 : 6, { color: e.on === 'crowd' ? C.frond2 : C.cream, size: 3, speed: 120, life: 0.5 });
        break;
      case 'spring':
        this.parts.burst(this.sx(e.x), this.sy(e.y + 0.4), rm ? 4 : 16, { color: C.gold, size: 3, speed: 200, shape: 'spark', angle: -Math.PI / 2, spread: 1.2 });
        break;
      case 'vault':
        if (e.kind === 'goose') this.honk(sim, e.x, e.y + 0.9);
        break;
      case 'bonk':
        this.parts.burst(this.sx(e.x), this.sy(e.y + 0.7), rm ? 4 : 14, { color: '#fff', size: 3, speed: 160, shape: 'square', life: 0.5 });
        this.words.add(`${t('style.bonk')} +${e.pay}`, this.sx(e.x), this.sy(e.y + 1.4), { color: C.madder, size: (18 + 3 * e.chain) * u });
        this.words.add(e.kind === 'goose' ? t('fx.honk') : t('fx.meh'), this.sx(e.x) + 30 * u, this.sy(e.y + 0.6), { color: C.ink, size: 13 * u, dur: 0.9 });
        this.shake.add(0.12 + 0.05 * e.chain);
        break;
      case 'legUp':
        this.words.add(t('fx.legUp'), this.sx(h.x), this.sy(h.y + 1.6), { color: C.wood2, size: 14 * u });
        break;
      case 'tile':
        if (e.kind === 'pause') this.words.add(t('fx.pause'), this.sx(e.x), this.sy(e.y + 1.8), { color: C.indigo, size: 16 * u, dur: 1.4 });
        this.parts.burst(this.sx(e.x), this.sy(e.y), rm ? 2 : 8, { color: e.kind === 'pause' ? C.indigo2 : e.kind === 'back' ? C.madder : C.saffron, size: 3, speed: 120 });
        break;
      case 'longJump':
        this.parts.burst(this.sx(h.x), this.sy(h.y), rm ? 3 : 12, { color: C.saffron, size: 3, speed: 180, shape: 'spark', angle: Math.PI, spread: 1 });
        break;
      case 'style':
        this.cheer = Math.min(1, this.cheer + 0.4 + 0.1 * e.n);
        this.words.add(`${t(`style.${e.trick}`)}${e.n > 1 ? ` ×${e.n}` : ''}`, this.sx(e.x), this.sy(e.y + 0.6), { color: e.n > 1 ? C.purple2 : C.indigo, size: (15 + 2 * Math.min(4, e.n)) * u, dur: 1 });
        break;
      case 'fall':
        if (!e.bubble) this.words.add(t('fx.rope'), this.sx(h.x), this.sy(1.4), { color: C.wood2, size: 15 * u, dur: 1.4 });
        break;
      case 'pop':
        this.parts.burst(this.sx(e.x), this.sy(e.y + 0.6), rm ? 6 : 18, { color: 'rgba(170,215,240,.9)', size: 3, speed: 150, shape: 'ring', g: 0, life: 0.5 });
        break;
      case 'trunk': {
        this.grabY = e.y;
        const top = e.band >= 4;
        this.parts.burst(this.sx(e.x), this.sy(e.y + 0.6), rm ? 8 : 34, { color: top ? C.gold : C.frond2, size: 3.5, speed: 240, shape: 'square', life: 1 });
        this.words.add(`${t('fx.band', { n: e.band + 1 })} +${e.pay}`, this.sx(e.x), this.sy(e.y + 1.8), { color: top ? C.gold2 : C.wood2, size: 20 * u, dur: 1.6 });
        if (top) this.banner = { text: t('fx.top'), t: 0, color: C.gold };
        this.shake.add(top ? 0.4 : 0.2);
        break;
      }
      case 'levelStart':
        this.levelT = 0;
        this.levelReplay = e.replay;
        this.camReady = false;
        this.fade = 0.6;
        break;
      case 'road':
        if (e.on) this.roadFlash = 1;
        break;
      case 'view':
        this.banner = { text: t('fx.view'), t: 0, color: C.gold };
        break;
      case 'orchard':
        break;
      case 'figs':
        this.parts.burst(this.sx(e.x), this.sy(2.4), rm ? 3 : 10, { color: C.figRipe, size: 3, speed: 90, g: 200 });
        this.words.add(t('fx.figs', { n: e.n }) + (e.bubble ? ` · ${t('fx.bubble')}` : ''), this.sx(e.x), this.sy(2.8), { color: C.figRipe, size: 16 * u, dur: 1.4 });
        break;
      case 'reveal':
        if (e.len > 0) this.words.add(t('fx.reveal'), this.L.w / 2, this.L.cardY, { color: C.gold2, size: 20 * u, dur: 2 });
        break;
      case 'restPass':
        this.words.add(t('fx.restPass', { n: e.pay }), this.sx(h.x), this.sy(h.y + 2.2), { color: C.figRipe, size: 17 * u, dur: 1.6 });
        break;
      case 'pushPass':
        this.words.add(t('fx.pushPass', { n: e.pay }), this.sx(h.x), this.sy(h.y + 2.2), { color: C.gold2, size: 17 * u, dur: 1.6 });
        break;
      case 'home':
        this.words.add(t('fx.home', { name: HOMES[e.index].name }), this.L.w / 2, this.L.cardY - 30 * u, { color: C.brickDark, size: 18 * u, dur: 2.4 });
        break;
      case 'gift':
        this.words.add(t('fx.gift', { n: e.n }), this.L.w / 2, this.L.cardY + 20 * u, { color: C.gold2, size: 17 * u, dur: 2.2 });
        break;
      default: break;
    }
    void S;
  }

  private honk(sim: ZacheuszSim, x: number, y: number): void {
    const c = sim.world.critters.find(k => Math.abs(k.x - x) < 0.1);
    if (c) this.honks.set(c.id, this.clock);
    this.words.add(t('fx.honk'), this.sx(x), this.sy(y), { color: C.ink, size: 12 * this.L.u, dur: 0.8 });
  }

  update(dt: number, sim: ZacheuszSim): void {
    this.clock += dt;
    this.fade = Math.max(0, this.fade - dt * 2.5);
    this.levelT += dt;
    this.cheer = Math.max(0, this.cheer - dt * 0.7);
    this.toss = Math.max(0, this.toss - dt * 2.5);
    this.slotPop = Math.max(0, this.slotPop - dt * 2);
    this.btnPress = Math.max(0, this.btnPress - dt * 4);
    this.roadFlash = Math.max(0, this.roadFlash - dt * 1.5);
    this.squash = Math.max(0, this.squash - dt * 5);
    if (this.banner && (this.banner.t += dt) > 1.6) this.banner = null;
    this.parts.update(dt);
    this.words.update(dt);
    const h = sim.hero, p = this.heroAt(sim);
    // the camera: him at a fixed x, up when he climbs above what fits
    const S = this.S, L = this.L;
    const wantY = Math.max(0, p.y + 1.6 - (L.gy - L.hudTop - 10) / S);
    if (!this.camReady) {
      this.camX = p.x;
      this.camY = wantY;
      this.camReady = true;
    } else {
      this.camX = approach(this.camX, p.x, dt, sim.stage === 'bubble' ? 0.25 : 0.06);
      this.camY = approach(this.camY, wantY, dt, 0.3);
    }
    // the pose
    const speed = Math.abs(h.vx);
    this.runPh += dt * speed * 2.6 * (h.vx < 0 ? -1 : 1);
    this.pose.run = this.runPh;
    this.pose.stride = h.ground && sim.stage === 'run' && h.pauseT < 0 ? clamp(speed / RULES.run) : 0;
    this.pose.air = h.ground ? 0 : h.vy > 0 ? 1 : -1;
    this.pose.squash = this.squash;
    this.pose.slide = h.sliding;
    this.pose.climb = sim.stage === 'finish';
    this.pose.hang = sim.stage === 'rope';
    this.pose.sit = false;
    this.pose.look = h.pauseT >= 0 ? -0.2 : h.dir < 0 ? Math.PI : -0.35;
    // Mela trots behind him on the street
    const want = p.x - 1.8;
    this.melaX = this.melaX === 0 || Math.abs(want - this.melaX) > 12 ? want : approach(this.melaX, want, dt, 0.25);
    this.melaHop = sim.world.inPit(this.melaX) ? 1 : Math.max(0, this.melaHop - dt * 3);
    this.bars = traceBars(sim.trace, sim.t, 40);
  }

  /** Where he is drawn: in the bubble, on the rope, sliding down the trunk. */
  private heroAt(sim: ZacheuszSim): { x: number; y: number } {
    const h = sim.hero;
    if (sim.stage === 'bubble' && sim.bubble) {
      const b = sim.bubble, k = clamp(sim.stageT / RULES.floatSec);
      const e = k * k * (3 - 2 * k);
      return { x: b.x0 + (b.x1 - b.x0) * e, y: b.y0 + (b.y1 + 1.2 - b.y0) * e + Math.sin(sim.stageT * 3) * 0.1 * k };
    }
    if (sim.stage === 'rope' && sim.rope) {
      const r = sim.rope, k = clamp(sim.stageT / RULES.ropeSec);
      return { x: r.x0 + (r.x1 - r.x0) * k, y: r.y0 + (r.y1 - r.y0) * Math.sin(k * Math.PI / 2) + Math.sin(k * Math.PI) * 1.2 };
    }
    if (sim.stage === 'finish') return { x: h.x, y: Math.max(0, this.grabY * (1 - clamp(sim.stageT / RULES.slideSec) ** 2)) };
    return { x: h.x, y: h.y };
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: ZacheuszSim): void {
    const ctx = this.ctx, L = this.L, S = this.S;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 8);
    const orchard = sim.world.orchards.find(o => o.x0 - 4 < this.camX + L.w / S && o.x1 + 4 > this.camX - 4);
    const shade = orchard ? clamp(1 - Math.max(0, Math.max(orchard.x0 - this.camX, this.camX - orchard.x1)) / 6) : 0;
    ctx.fillStyle = C.hillFar;
    ctx.fillRect(0, 0, L.w, L.h);
    paintSky(ctx, L.w, L.h, L.horizon, shade * 0.6);
    ctx.save();
    ctx.translate(off.x, off.y);
    paintHills(ctx, L.w, L.horizon + S * 0.3, S * 0.8, this.camX * S * 0.05, C.hillFar, 1.3, L.h);
    this.drawSkyline(ctx, sim);
    if (sim.level.finish === 'sycamore') paintProcession(ctx, L.w * 0.86, L.horizon + S * 0.2, S * 0.9, this.clock, clamp(sim.hero.x / sim.world.finish.x));
    this.drawTown(ctx, sim);
    this.drawStreet(ctx, sim);
    this.drawRoad(ctx, sim);
    this.drawThings(ctx, sim);
    this.drawMela(ctx, sim);
    this.drawHero(ctx, sim);
    this.parts.draw(ctx);
    ctx.restore();
    this.words.draw(ctx, `800 ${SANS}`);
    this.drawOverlays(ctx, sim);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(251,241,220,${this.fade.toFixed(3)})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
  }

  /** The skyline of palms: the band's last 40 s along the horizon, one palm a second. */
  private drawSkyline(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const L = this.L, S = this.S, n = this.bars.length;
    if (!n) return;
    const x0 = L.w * 0.04, x1 = L.w * 0.96, step = (x1 - x0) / n;
    const base = L.horizon + S * 0.35;
    const size = Math.min(step * 1.3, S * 0.6);
    for (let i = 0; i < n; i++) {
      const b = this.bars[i];
      if (b.empty) continue;
      const x = x0 + (i + 0.5) * step;
      if (!b.reliable) { paintStump(ctx, x, base, size); continue; }
      const hgt = S * 1.15 * (0.25 + 0.75 * clamp(b.level));
      const crown = b.phase === 'rest' ? 'teal' : b.above ? 'gold' : 'green';
      paintPalm(ctx, x, base, hgt * Math.max(0.15, b.shown), size, b.shown < 1 ? 'pale' : crown, Math.sin(this.clock * 1.2 + i) * 0.25, 0.85);
      if (b.shown < 1) paintCrowd(ctx, x - step / 2, x + step / 2, base, S * 0.6, S * 0.5, i, this.clock, 0);
    }
    // the band's delay at "now": a bracket over the last seconds
    const lag = this.opts.eeg ? 1 : 5;
    const bx0 = x1 - step * lag, by = base - S * 1.5;
    ctx.strokeStyle = 'rgba(42,30,23,.4)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx0, by + 5);
    ctx.lineTo(bx0, by);
    ctx.lineTo(x1, by);
    ctx.lineTo(x1, by + 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(42,30,23,.55)';
    ctx.font = `700 ${Math.round(10 * L.u)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`≈${lag} s`, (bx0 + x1) / 2, by - 1);
    void sim;
  }

  /** The town behind the street, with the townsfolk who cheer a stylish move. */
  private drawTown(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const L = this.L, S = this.S;
    const par = 0.3, span = S * 2.6;
    const base = L.gy - S * 0.9 + this.camY * S * 0.4;
    const first = Math.floor((this.camX * S * par - L.w) / span) - 1;
    for (let i = first; i < first + Math.ceil(L.w * 2 / span) + 3; i++) {
      const x = i * span - this.camX * S * par + L.w * 0.5;
      if (x > L.w + span || x < -span) continue;
      const r = hash(i * 3 + 1), hh = S * (1.1 + r * 1.1), bw = span * (0.7 + 0.2 * r);
      ctx.fillStyle = mixLight('#b98fa0', 0.55);
      ctx.fillRect(x, base - hh, bw, hh + S);
      ctx.fillStyle = mixLight('#9c7a8c', 0.5);
      ctx.fillRect(x - 2, base - hh - S * 0.06, bw + 4, S * 0.08);
      ctx.fillStyle = 'rgba(90,60,80,.18)';
      for (let k = 0; k < 2; k++) ctx.fillRect(x + bw * (0.25 + 0.4 * k), base - hh * 0.6, S * 0.16, S * 0.22);
      // the townsfolk on the roof (two or three heads), arms up when they cheer
      const n = 1 + Math.floor(r * 3);
      for (let k = 0; k < n; k++) {
        const px = x + span * 0.18 + k * S * 0.45, jump = this.cheer * Math.abs(Math.sin(this.clock * 9 + i + k)) * S * 0.18;
        const py = base - hh - S * 0.12 - jump;
        ctx.fillStyle = ['#8d6b8f', '#b0623e', '#6f86b5'][(i + k) % 3];
        ctx.fillRect(px - S * 0.12, py - S * 0.25, S * 0.24, S * 0.3);
        ctx.fillStyle = '#e1c39a';
        ctx.beginPath();
        ctx.arc(px, py - S * 0.34, S * 0.11, 0, TAU);
        ctx.fill();
        if (this.cheer > 0.15) {
          ctx.strokeStyle = '#e1c39a';
          ctx.lineWidth = Math.max(1.5, S * 0.05);
          ctx.beginPath();
          ctx.moveTo(px - S * 0.1, py - S * 0.2);
          ctx.lineTo(px - S * 0.2, py - S * 0.5);
          ctx.moveTo(px + S * 0.1, py - S * 0.2);
          ctx.lineTo(px + S * 0.2, py - S * 0.5);
          ctx.stroke();
        }
      }
    }
    void sim;
  }

  private visible(x0: number, x1: number): boolean {
    const a = this.sx(x0), b = this.sx(x1);
    return b > -this.S * 2 && a < this.L.w + this.S * 2;
  }

  private drawStreet(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const w = sim.world, S = this.S, L = this.L;
    const bottom = L.h + 4;
    // the orchard's shade: a canopy band and its gate posts
    for (const o of w.orchards) {
      if (!this.visible(o.x0, o.x1)) continue;
      ctx.fillStyle = 'rgba(31,79,87,.16)';
      ctx.fillRect(this.sx(o.x0), this.sy(4.5), (o.x1 - o.x0) * S, this.sy(0) - this.sy(4.5));
      for (const gx of [o.x0, o.x1]) {
        ctx.strokeStyle = C.leaf;
        ctx.lineWidth = Math.max(3, S * 0.12);
        ctx.beginPath();
        ctx.moveTo(this.sx(gx - 0.8), this.sy(0));
        ctx.quadraticCurveTo(this.sx(gx), this.sy(3.6), this.sx(gx + 0.8), this.sy(0));
        ctx.stroke();
      }
      ctx.fillStyle = C.leaf;
      ctx.font = `800 ${Math.round(12 * L.u)}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('fx.orchard'), this.sx(o.x0), this.sy(3.4));
    }
    for (const tr of w.trees) {
      if (!this.visible(tr.x - 2, tr.x + 2)) continue;
      paintFigTree(ctx, this.sx(tr.x), this.sy(0), S, sim.ripe, tr.picked, Math.sin(this.clock + tr.x));
    }
    // the finish: the palm, or the sycamore at a world's end
    const f = w.finish;
    if (this.visible(f.x - 4, f.x + 4)) {
      const lit = sim.band >= 0 ? sim.band + 1 : 0;
      if (f.kind === 'sycamore') paintSycamore(ctx, this.sx(f.x), this.sx(f.x + 1.1), this.sy(0), S, lit, this.clock);
      else paintFinishPalm(ctx, this.sx(f.x), this.sx(f.x + 1.1), this.sy(0), S, lit, this.clock);
    }
    for (const s of w.solids) {
      if (s.kind === 'trunk' || !this.visible(s.x0, s.x1)) continue;
      const x0 = this.sx(s.x0), x1 = this.sx(s.x1), top = this.sy(s.top), base = this.sy(0);
      switch (s.kind) {
        case 'ground': paintGround(ctx, Math.max(-10, x0), Math.min(L.w + 10, x1), top, bottom, S, s.seed, 0); break;
        case 'house': paintHouse(ctx, x0, x1, top, base, S, s.seed, false); break;
        case 'stall': paintStall(ctx, x0, x1, top, base, S, s.seed); break;
        case 'wall': paintWall(ctx, x0, x1, top, base, S); break;
        case 'crate': paintCrate(ctx, x0, x1, top, base, S); break;
        case 'crowd': paintCrowd(ctx, x0, x1, base, base - top, S, s.seed, this.clock, this.toss); break;
        default: break;
      }
    }
    for (const p of w.pits) {
      if (!this.visible(p.x0, p.x1)) continue;
      if (p.kind === 'well') paintWell(ctx, this.sx(p.x0), this.sx(p.x1), this.sy(0), bottom, S);
      else paintDitch(ctx, this.sx(p.x0), this.sx(p.x1), this.sy(0), bottom, S, this.clock);
    }
    for (const p of w.plats) {
      if (p.kind === 'road' || !this.visible(p.x0, p.x1)) continue;
      if (p.kind === 'awning') {
        const under = w.solids.find(s => s.kind === 'stall' && s.x0 < p.x1 && s.x1 > p.x0);
        paintAwning(ctx, this.sx(p.x0), this.sx(p.x1), this.sy(p.y), S, STRIPES[Math.floor(hash(p.x0) * 3) % 3], p.squash, under ? this.sy(under.top) : this.sy(0));
      } else if (p.kind === 'plank') paintPlank(ctx, this.sx(p.x0), this.sx(p.x1), this.sy(p.y), S);
    }
    for (const tl of w.tiles) {
      if (!this.visible(tl.x0, tl.x1)) continue;
      paintStone(ctx, this.sx(tl.x0), this.sx(tl.x1), this.sy(tl.y), S, tl.kind, Math.max(tl.glow, tl.used ? 0 : 0.3 + 0.2 * Math.sin(this.clock * 4)), tl.y > 0, this.clock);
    }
  }

  /** The band's road of light: its planks, its growing tip, and where it reaches at the threshold. */
  private drawRoad(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const w = sim.world, S = this.S, lane = RULES.lane;
    for (const p of w.plats) {
      if (p.kind !== 'road' || !this.visible(p.x0, p.x1)) continue;
      const fresh = clamp(1 - (sim.t - p.born) / 0.6);
      const a = p.passed >= 0 ? clamp(1 - (sim.t - p.passed) / RULES.plankFade) : 1;
      const grow = clamp((sim.t - p.born) / 0.18);
      paintLightPlank(ctx, this.sx(p.x0), this.sx(p.x0 + (p.x1 - p.x0) * grow), this.sy(lane), S, fresh, a);
    }
    for (const s of w.springs) if (this.visible(s.x - 1, s.x + 1)) paintSpring(ctx, this.sx(s.x), this.sy(s.y), S, s.squash, this.clock);
    const look = sim.roadLook, h = sim.hero;
    if (look === 'off' || sim.stage !== 'run') return;
    // the gauge on the thing: dotted planks ahead to where the road reaches at the threshold, and
    // a glowing post where it reaches now
    const from = Math.max(h.x + 1, sim.roadTip), mark = h.x + REACH_MARK;
    const yy = this.sy(lane);
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = look === 'live' ? 'rgba(217,150,28,.75)' : 'rgba(120,110,100,.5)';
    if (from < mark) {
      ctx.beginPath();
      ctx.moveTo(this.sx(from), yy + S * 0.08);
      ctx.lineTo(this.sx(mark), yy + S * 0.08);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the threshold's flag on the lane
    const fx = this.sx(mark);
    ctx.strokeStyle = 'rgba(42,30,23,.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, yy + S * 0.3);
    ctx.lineTo(fx, yy - S * 0.75);
    ctx.stroke();
    ctx.fillStyle = look === 'live' ? C.gold : '#c9bfae';
    ctx.beginPath();
    ctx.moveTo(fx, yy - S * 0.75);
    ctx.lineTo(fx + S * 0.38, yy - S * 0.62);
    ctx.lineTo(fx, yy - S * 0.49);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (look === 'live') {
      const rx = this.sx(h.x + sim.reach), on = sim.building;
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = on ? S * 0.8 : 0;
      ctx.fillStyle = on ? '#fff3c0' : 'rgba(255,243,192,.45)';
      ctx.beginPath();
      ctx.arc(rx, yy, S * (0.16 + (on ? 0.05 * Math.sin(this.clock * 10) : 0) + 0.15 * this.roadFlash), 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (look === 'blind') {
      paintCrowd(ctx, this.sx(h.x + 2), this.sx(h.x + 2 + REACH_MARK), yy + S * 0.4, S * 0.9, S * 0.55, 77, this.clock, 0);
    }
    ctx.restore();
  }

  private drawThings(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const w = sim.world, S = this.S;
    for (const c of w.coins) {
      if (c.taken || !this.visible(c.x, c.x)) continue;
      const x = this.sx(c.x), y = this.sy(c.y);
      if (c.kind === 'light') {
        ctx.save();
        ctx.shadowColor = C.gold;
        ctx.shadowBlur = S * 0.3;
        paintCoin(ctx, x, y, S * 0.16, 'denar', this.clock * 3 + c.x);
        ctx.restore();
      } else paintCoin(ctx, x, y, S * 0.15, 'denar', this.clock * 3 + c.x);
    }
    for (const s of w.specials) {
      if (!this.visible(s.x, s.x)) continue;
      const x = this.sx(s.x), y = this.sy(s.y) + Math.sin(this.clock * 2 + s.x) * S * 0.06;
      if (s.taken) continue;
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = S * 0.3;
      paintCoin(ctx, x, y, S * 0.3, tierKind(sim.tier), Math.sin(this.clock * 1.6 + s.x) * 1.2);
      ctx.restore();
    }
    for (const c of w.critters) {
      if (!this.visible(c.x - 1, c.x + 1)) continue;
      const dizzy = c.state === 'bonked' ? 1 : 0;
      const a = c.state === 'bonked' && c.t > 2 ? clamp((2.6 - c.t) / 0.6) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      const honk = this.clock - (this.honks.get(c.id) ?? -9) < 0.4 ? 1 : 0;
      if (c.kind === 'goose') paintGoose(ctx, this.sx(c.x), this.sy(c.y), S, this.clock + c.id, c.state === 'bonked' ? c.dir : c.dir, dizzy, honk);
      else paintGoat(ctx, this.sx(c.x), this.sy(c.y), S, this.clock + c.id, c.state === 'bonked' ? c.dir : -1, { dizzy, chew: 1, run: c.state === 'bonked' && c.t > 0.7 ? 1 : 0 });
      ctx.restore();
    }
  }

  private drawMela(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const S = this.S, w = sim.world;
    const x = this.melaX;
    const surf = Math.max(0, Math.min(w.surfaceAt(x) ?? 0, 0));
    const hop = this.melaHop > 0 ? Math.abs(Math.sin(this.clock * 8)) * 0.6 : 0;
    const running = sim.stage === 'run' && sim.hero.pauseT < 0;
    paintGoat(ctx, this.sx(x), this.sy(surf + hop), S * 0.95, this.clock, 1, { bell: true, run: running ? 1 : 0, chew: running ? 0 : 1 });
  }

  private drawHero(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const S = this.S, p = this.heroAt(sim);
    const x = this.sx(p.x), y = this.sy(p.y);
    if (sim.stage === 'rope' && sim.rope) {
      ctx.strokeStyle = C.rope;
      ctx.lineWidth = Math.max(1.5, S * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, y - S * 0.9);
      ctx.lineTo(this.sx(sim.rope.x1 + 0.6), this.sy(4));
      ctx.stroke();
    }
    ctx.save();
    if (sim.hero.dir < 0 && sim.stage === 'run') {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    paintZacchaeus(ctx, x, y, S, this.pose);
    ctx.restore();
    if (sim.stage === 'bubble') paintBubble(ctx, x, y - S * 0.5, S * 0.85, this.clock);
  }

  private drawOverlays(ctx: CanvasRenderingContext2D, sim: ZacheuszSim): void {
    const L = this.L;
    const got = sim.world.specials.map(s => s.taken);
    while (got.length < RULES.specials) got.push(false);
    drawStrip(ctx, L, sim.levelIndex, sim.tier, got, this.slotPop, this.clock);
    if (this.levelT < 2.6 && sim.stage === 'run') drawLevelCard(ctx, L, sim.levelIndex, sim.tier, this.levelReplay, this.levelT / 2.6);
    drawButton(ctx, L, sim.bubbles, this.clock, this.btnPress);
    if (this.banner) drawBanner(ctx, L, this.banner.text, this.banner.t / 1.6, this.banner.color);
    const line = sim.talk.current;
    if (line && sim.stage !== 'story') {
      const mx = this.sx(this.melaX), my = this.sy(1.3);
      const hp = this.heroAt(sim);
      drawSpeech(ctx, L, line.text, mx, my, line.t / line.dur, { x: this.sx(hp.x), y: this.sy(hp.y) });
    }
    if (sim.stage === 'tally' && sim.lastResult) drawTally(ctx, L, sim.lastResult, sim.stageT / RULES.tallySec, nextLevelName(sim));
    if (sim.stage === 'story' && sim.story) this.story.draw(ctx, L, sim.story.kind, sim.story.world, sim.stageT / RULES.storySec);
    void levelName;
  }
}

/** A colour lightened toward the haze (the town behind the street). */
function mixLight(c: string, k: number): string {
  const n = parseInt(c.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const hz = [241, 221, 176];
  return `rgb(${Math.round(r + (hz[0] - r) * k)},${Math.round(g + (hz[1] - g) * k)},${Math.round(b + (hz[2] - b) * k)})`;
}
