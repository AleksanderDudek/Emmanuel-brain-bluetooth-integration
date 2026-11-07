/**
 * Chleby i ryby's play view, all on the canvas: the sky and the lake, the hillside with its path,
 * the hungry in their groups at the top (the front row and the next one stepping up), the gates
 * across the path (the golden gate's arch is the band's gauge: its fill is the level, the notch at
 * its top the threshold, the big number its multiplier now), the bread rolling up through them,
 * the gulls swooping in from the lake (Mirka perched on her post by the path when she is not
 * stealing), the pelican on a chapter's last level, the boy with his basket and the big basket's
 * ring (the hold), the row of little baskets along the bottom that holds the band's last 40 s, the
 * juice (crumbs, sparkles, splashes, confetti) and the HUD (hud.ts) on top.  It only reads the sim
 * (sim.ts); the calibration scene is intro.ts.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, traceBars } from '../kit/trace';
import { CHAPTERS } from './content';
import type { Gate } from './hill';
import { Hud, fmtX } from './hud';
import { grain as grainText, loaves as loavesText, t } from './i18n';
import { ChlebyIntro } from './intro';
import { laneX, layout, toScreen, type Layout } from './layout';
import type { ChlebyProgress } from './meta';
import {
  C, PALETTES, SANS, font, glow, hash, paintBasket, paintBoy, paintFish, paintGate, paintGoldGate, paintGrass, paintGroup, paintGull,
  paintHistBasket, paintLake, paintLoaf, paintMist, paintPath, paintPelikan, paintSky, type GoldMode, type Palette,
} from './paint';
import { RULES, type ChlebySim, type SimEvent } from './sim';

const TAU = Math.PI * 2;

const TXT = {
  fed: t('fx.fed'), leap: t('fx.leap'), brk: t('fx.break'), knock: t('fx.knock'), near: t('fx.near'), big: t('fx.big'),
  bigReady: t('fx.bigReady'), bigReadySub: t('fx.bigReadySub'), basket: t('fx.basket'), restPass: t('fx.restPass'), won: t('fx.won'),
  disciples: t('fx.disciples'), pelikan: t('fx.pelikan'), pelikanSub: t('fx.pelikanSub'), sated: t('fx.sated'), bigLabel: t('hud.big'),
  bigHold: t('hud.bigHold'), bigGo: t('hud.bigReady'), thr: t('hud.thr'), hist: t('hud.hist'), bought: t('upc.bought'),
};

interface Ring { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
interface Splash { x: number; y: number; t: number }

export type Hit =
  | { kind: 'press'; x: number }
  | { kind: 'drag'; x: number }
  | { kind: 'release' }
  | { kind: 'offer'; i: number }
  | { kind: 'go' };

export class ChlebyView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new ChlebyIntro();
  private clock = 0;
  private readonly parts = new Particles(700);
  private readonly rings: Ring[] = [];
  private readonly splashes: Splash[] = [];
  private readonly shake: Shake;
  private readonly rnd = Math.random;
  private pal: Palette = PALETTES[0];
  private gaugeLevel = 0;
  private wonT = -1;
  private wonStars = 0;
  private mirkaAway = 0;
  private readonly gateFloat = new Map<number, number>();
  private feedPop = 0;
  private pointerId: number | null = null;
  private fade = 0;
  private rowShown = 0;
  private bigPulse = 0;
  private started = false;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx, t('lag', { n: LAG_SEC[opts.eeg ? 'eeg' : 'fnirs'] }));
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

  intro(dt: number, p: number, progress: ChlebyProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  /** Where the companion speaks from: Mirka in flight or on her post; the boy over his basket. */
  private anchors(sim: ChlebySim): { mirka: { x: number; y: number }; boy: { x: number; y: number } } {
    const L = this.L.lane, u = this.L.u;
    const m = sim.hill.gulls.find(g => g.kind === 'mirka' && g.state !== 'gone');
    let mirka: { x: number; y: number };
    if (m) {
      const p = toScreen(L, m.x, m.y);
      mirka = { x: p.x, y: p.y - 1.6 * L.su * p.s };
    } else mirka = this.perch();
    const b = toScreen(L, sim.x, 0);
    return { mirka, boy: { x: b.x, y: b.y - 34 * u } };
  }

  /** Mirka's post by the path, low on the left. */
  private perch(): { x: number; y: number } {
    const L = this.L.lane;
    const p = toScreen(L, -0.55, 3.2);
    return { x: Math.max(26 * this.L.u, p.x - 10 * this.L.u), y: p.y - L.su * 1.2 };
  }

  // ── input ───────────────────────────────────────────────────────
  pointer(type: 'down' | 'move' | 'up', x: number, y: number, id: number, sim: ChlebySim): Hit | null {
    if (type === 'down') {
      if (sim.stage === 'upgrade') {
        const i = this.hud.offerRects.findIndex(r => inside(r, x, y));
        if (i >= 0) return { kind: 'offer', i };
        if (this.hud.goRect && inside(this.hud.goRect, x, y)) return { kind: 'go' };
        return null;
      }
      this.hud.hideStory();
      this.pointerId = id;
      return { kind: 'press', x: laneX(this.L.lane, x) };
    }
    if (id !== this.pointerId) return null;
    if (type === 'move') return { kind: 'drag', x: laneX(this.L.lane, x) };
    this.pointerId = null;
    return { kind: 'release' };
  }

  release(): void { this.pointerId = null; }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: ChlebySim): void {
    const Ln = this.L.lane, u = this.L.u, rm = this.opts.reducedMotion;
    const at = (x: number, y: number) => toScreen(Ln, x, y);
    switch (e.type) {
      case 'fire': {
        const p = at(e.x, 0);
        this.parts.burst(p.x, p.y - 6 * u, rm ? 1 : 3, { color: C.crumb, size: 1.8 * u, speed: 70 * u, g: 260, drag: 2, life: 0.35, angle: -Math.PI / 2, spread: 1.6, rnd: this.rnd });
        if (e.kind === 'big') {
          this.rings.push({ x: p.x, y: p.y, t: 0, dur: 0.5, r0: 10 * u, r1: 60 * u, color: 'rgba(255,214,110,', width: 4 });
          this.hud.float(TXT.big, p.x, p.y - 50 * u, C.goldLight, 20, 1.2, 40);
          this.shake.add(0.2);
        }
        break;
      }
      case 'gate': {
        const g = sim.hill.gates[e.gate];
        const p = at(e.x, e.y);
        const last = this.gateFloat.get(e.gate) ?? -9;
        if (e.kind === 'gold') {
          this.parts.burst(p.x, p.y - 20 * u * p.s, rm ? 1 : e.n >= 3 ? 4 : 2, { color: e.n >= 2 ? C.gold : '#fff6d0', size: 2 * u, speed: 90 * u, g: -40, drag: 2.5, life: 0.6, shape: 'spark', rnd: this.rnd });
          if (this.clock - last > 0.45 && e.n > 1) {
            this.gateFloat.set(e.gate, this.clock);
            const gp = at(g ? g.x : e.x, e.y);
            this.hud.float(fmtX(e.n), gp.x + (this.rnd() - 0.5) * 40 * u, gp.y - Ln.su * 2.4 * gp.s, C.goldLight, 17 + 3 * e.n, 0.9, 34);
          }
        } else if (this.clock - last > 0.35) {
          this.gateFloat.set(e.gate, this.clock);
          const label = e.kind === 'add' ? `+${e.n}` : `×${e.n}`;
          this.hud.float(label, p.x, p.y - Ln.su * 1.6 * p.s, e.kind === 'add' ? C.greenLight : C.honeyLight, 14, 0.7, 24);
        }
        break;
      }
      case 'swallow': {
        const p = at(e.x, e.y);
        this.parts.burst(p.x, p.y - 10 * u, rm ? 1 : 4, { color: C.crumb, size: 1.6 * u, speed: 60 * u, g: 300, drag: 2, life: 0.4, rnd: this.rnd });
        break;
      }
      case 'break': {
        const p = at(e.x, e.y);
        this.parts.burst(p.x, p.y - 14 * u, rm ? 4 : 18, { color: C.greyDark, size: 3 * u, speed: 160 * u, g: 600, drag: 1.5, life: 0.7, shape: 'square', rnd: this.rnd });
        this.hud.float(TXT.brk, p.x, p.y - 34 * u, C.greyLight, 16, 0.9, 26);
        this.shake.add(0.12);
        break;
      }
      case 'leap': {
        const p = at(e.x, e.y);
        this.hud.float(TXT.leap, p.x, p.y - 30 * u, '#d9f1ff', 12, 0.6, 18);
        break;
      }
      case 'split': {
        const p = at(e.x, e.y);
        this.parts.burst(p.x, p.y - 10 * u, rm ? 6 : 30, { color: C.crumb, size: 2.6 * u, speed: 220 * u, g: 380, drag: 1.6, life: 0.8, rnd: this.rnd });
        this.parts.burst(p.x, p.y - 10 * u, rm ? 3 : 14, { color: C.wicker, size: 2.4 * u, speed: 160 * u, g: 500, drag: 1.5, life: 0.7, shape: 'square', rnd: this.rnd });
        this.rings.push({ x: p.x, y: p.y, t: 0, dur: 0.55, r0: 8 * u, r1: 90 * u, color: 'rgba(255,236,190,', width: 5 });
        this.hud.float(loavesText(e.loaves), p.x, p.y - 44 * u, '#fff6e0', 18, 1.1, 34);
        this.shake.add(0.3);
        break;
      }
      case 'near': {
        const g = sim.hill.goldGate;
        if (!g) break;
        const p = at(e.x, e.y);
        this.hud.float(TXT.near, p.x, p.y - 26 * u, '#fff6e0', 13, 0.8, 18);
        break;
      }
      case 'feed': {
        const p = this.groupPos(sim, e.group);
        if (p) this.parts.burst(p.x + (this.rnd() - 0.5) * 30 * u, p.y, rm ? 0 : 1, { color: C.crumb, size: 1.6 * u, speed: 50 * u, g: 200, drag: 2, life: 0.35, rnd: this.rnd });
        if ((this.feedPop -= 1) <= 0) {
          this.feedPop = 6;
          this.hud.popScore();
        }
        break;
      }
      case 'fed': {
        const p = this.groupPos(sim, e.group);
        if (!p) break;
        this.confetti(p.x, p.y - 10 * u, rm ? 6 : 26, 200 * u);
        this.parts.burst(p.x, p.y - 10 * u, rm ? 3 : 12, { color: C.gold, size: 2.2 * u, speed: 160 * u, g: 120, drag: 2, life: 0.9, shape: 'spark', rnd: this.rnd });
        this.rings.push({ x: p.x, y: p.y, t: 0, dur: 0.6, r0: 10 * u, r1: 70 * u, color: 'rgba(255,240,190,', width: 4 });
        this.hud.float(TXT.fed, p.x, p.y - 30 * u, '#fff6e0', 17, 1.1, 30);
        this.hud.popScore();
        break;
      }
      case 'steal': {
        const p = at(e.x, e.y);
        const y = p.y - Ln.su * 1.4 * p.s;
        this.parts.burst(p.x, y, rm ? 2 : 6, { color: '#ffffff', size: 2.2 * u, speed: 80 * u, g: 60, drag: 2, life: 0.8, rnd: this.rnd });
        this.parts.burst(p.x, y, rm ? 1 : 4, { color: C.crumb, size: 1.6 * u, speed: 60 * u, g: 200, drag: 2, life: 0.5, rnd: this.rnd });
        break;
      }
      case 'knock': {
        const p = at(e.x, e.y);
        this.splashes.push({ x: p.x, y: p.y, t: 0 });
        this.parts.burst(p.x, p.y - Ln.su * p.s, rm ? 2 : 10, { color: '#ffffff', size: 2.4 * u, speed: 120 * u, g: 300, drag: 1.5, life: 0.7, rnd: this.rnd });
        this.hud.float(TXT.knock, p.x, p.y - 40 * u, '#d9f1ff', e.kind === 'mirka' ? 20 : 15, 1, 26);
        if (e.kind === 'mirka') this.mirkaAway = 4.5;
        this.shake.add(e.kind === 'mirka' ? 0.18 : 0.06);
        break;
      }
      case 'gulp': {
        const p = at(e.x, e.y);
        this.parts.burst(p.x, p.y - 20 * u, rm ? 0 : 2, { color: C.crumb, size: 1.6 * u, speed: 50 * u, g: 200, drag: 2, life: 0.4, rnd: this.rnd });
        break;
      }
      case 'pelikan':
        this.hud.toast(TXT.pelikan, TXT.pelikanSub, C.pouchDark);
        break;
      case 'sated': {
        const pk = sim.hill.pelikan;
        if (pk) {
          const p = at(pk.x, pk.y);
          this.confetti(p.x, p.y - 30 * u, rm ? 6 : 24, 180 * u);
        }
        this.hud.toast(TXT.sated, `+${grainText(RULES.grainPelikan)}`, C.goldDeep);
        break;
      }
      case 'levelStart': {
        this.pal = PALETTES[e.chapter % PALETTES.length];
        this.rowShown = 0;
        this.wonT = -1;
        this.hud.toast(t('fx.level', { n: e.level + 1 }), t('fx.levelSub', { name: CHAPTERS[e.chapter], hunger: e.hunger }), C.text, 2.4);
        break;
      }
      case 'story':
        this.hud.showStory(e.kind, e.chapter);
        break;
      case 'won': {
        this.wonT = 0;
        this.wonStars = e.stars;
        const cy = this.L.lane.yT - this.L.crowdH * 0.4;
        this.hud.float(e.byTime ? TXT.disciples : TXT.won, this.L.lane.cx, cy + 40 * u, '#fff6e0', e.byTime ? 16 : 22, 2.4, 20);
        this.hud.float(`+${grainText(e.grain)}`, this.L.lane.cx, cy + 70 * u, C.goldLight, 15, 2.2, 24);
        for (let i = 0; i < (rm ? 1 : 3); i++) {
          const x = this.L.lane.cx + (i - 1) * this.L.lane.hwT * 0.7;
          this.confetti(x, cy, rm ? 8 : 26, 240 * u);
        }
        this.shake.add(0.15);
        break;
      }
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(sim, e.block.kind, e.block.blind, e.verdict, e.share, e.need, e.t0, e.t1);
        break;
      case 'bigReady': {
        const p = at(sim.x, 0);
        this.bigPulse = 1;
        this.rings.push({ x: p.x, y: p.y, t: 0, dur: 0.7, r0: 14 * u, r1: 80 * u, color: 'rgba(255,214,110,', width: 5 });
        this.hud.float(TXT.bigReady, p.x, p.y - 60 * u, C.goldLight, 16, 1.6, 26);
        break;
      }
      case 'basket': {
        const r = this.L.strip;
        this.hud.float(e.pass ? TXT.restPass : `+1 · ${TXT.basket}`, r.x + r.w / 2, r.y + r.h + 18 * u, '#d4f2ff', 13, 1.3, 16);
        break;
      }
      case 'blindPay':
        if (e.loaves > 0) this.hud.toast(t('fx.blindPay', { loaves: loavesText(e.loaves) }), '', C.goldDeep, 2.2);
        break;
      case 'buy':
        this.hud.float(TXT.bought, this.L.cardX, this.L.cardY - 60 * u, C.goldDeep, 18, 1, 24);
        break;
      case 'say':
        this.hud.say(e.who, e.text, e.dur);
        break;
      case 'gift':
        this.hud.toast(t('card.gift', { grain: grainText(e.grain) }), '', C.goldDeep);
        break;
      default:
        break;
    }
  }

  private confetti(x: number, y: number, n: number, speed: number): void {
    const u = this.L.u, k = Math.max(1, Math.round(n / CONFETTI.length));
    for (const color of CONFETTI) this.parts.burst(x, y, k, { color, size: 2.6 * u, speed, g: 270, drag: 1.4, life: 1.2, shape: 'square', rnd: this.rnd });
  }

  /** The screen point of a group (its row in front or stepping up), or null when it is not drawn. */
  private groupPos(sim: ChlebySim, id: number): { x: number; y: number } | null {
    const g = sim.hill.groups[id];
    if (!g) return null;
    const L = this.L.lane;
    const p = toScreen(L, (g.x0 + g.x1) / 2, RULES.laneH);
    return { x: p.x, y: this.rowY(g.row - this.rowShown) };
  }

  /** The screen y of a row of the hungry (0 = the front row, 1 = the next, …; fractional while stepping). */
  private rowY(d: number): number {
    const L = this.L;
    return L.lane.yT - L.crowdH * (0.26 + 0.46 * clamp(d, -1, 1.2));
  }

  update(dt: number, sim: ChlebySim): void {
    this.clock += dt;
    this.fade = Math.max(0, this.fade - dt * 1.5);
    this.parts.update(dt);
    let n = 0;
    for (const r of this.rings) if ((r.t += dt) < r.dur) this.rings[n++] = r;
    this.rings.length = n;
    n = 0;
    for (const s of this.splashes) if ((s.t += dt) < 0.9) this.splashes[n++] = s;
    this.splashes.length = n;
    this.mirkaAway = Math.max(0, this.mirkaAway - dt);
    this.bigPulse = Math.max(0, this.bigPulse - dt * 1.5);
    if (this.wonT >= 0) this.wonT += dt;
    this.rowShown = approach(this.rowShown, sim.hill.row, dt, 0.25);
    // the gauge follows the band's level smoothly (it is already smooth; this only hides frame jitter)
    const target = sim.reliable ? sim.level : 0;
    this.gaugeLevel = approach(this.gaugeLevel, target, dt, 0.15);
    this.hud.update(dt, sim);
  }

  draw(sim: ChlebySim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, Lo = this.L, L = Lo.lane, u = Lo.u;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    const pal = this.pal;
    const lakeD = Lo.lakeD;
    paintSky(ctx, this.w, Lo.horizon, pal, this.clock);
    paintLake(ctx, this.w, Lo.horizon, lakeD, pal, this.clock);
    paintGrass(ctx, this.w, Lo.horizon + lakeD, this.h + 10, pal, this.clock);
    if (sim.restBlock) this.dozers(Lo.horizon + lakeD * 0.55, lakeD);
    this.path(pal);
    this.crowd(sim);
    this.world(sim);
    this.boy(sim);
    this.history(sim);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    this.parts.draw(ctx);
    for (const r of this.rings) {
      const k = ease.outCubic(r.t / r.dur);
      ctx.strokeStyle = `${r.color}${(1 - r.t / r.dur) * 0.9})`;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU);
      ctx.stroke();
    }
    for (const s of this.splashes) {
      const k = s.t / 0.9;
      ctx.strokeStyle = `rgba(200,235,250,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 8 * u + 30 * u * k, 3 * u + 9 * u * k, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    if (this.wonT >= 0 && this.wonT < RULES.wonHold + 0.4 && sim.stage !== 'level') {
      this.hud.drawStars(L.cx, this.rowY(0) - 26 * u, this.wonStars, this.wonT / 1.2);
    }
    ctx.restore();
    this.hud.draw(sim, this.anchors(sim));
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(255,246,224,${this.fade})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // ── the hill ────────────────────────────────────────────────────
  private path(pal: Palette): void {
    const L = this.L.lane, left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = (RULES.laneH * i) / 10;
      const a = toScreen(L, -0.15, y), b = toScreen(L, RULES.laneW + 0.15, y);
      const wob = (hash(i * 7) - 0.5) * 4;
      left.push({ x: a.x + wob, y: a.y });
      right.push({ x: b.x - wob, y: b.y });
    }
    left.push({ x: left[left.length - 1].x, y: L.yT - this.L.crowdH * 0.15 });
    right.push({ x: right[right.length - 1].x, y: L.yT - this.L.crowdH * 0.15 });
    left.unshift({ x: left[0].x - 6, y: L.yB + 40 * this.L.u });
    right.unshift({ x: right[0].x + 6, y: L.yB + 40 * this.L.u });
    paintPath(this.ctx, [left, right], pal);
    // pebbles, ruts and tufts on the path, the same every frame
    const ctx = this.ctx;
    for (let i = 0; i < 46; i++) {
      const x = hash(i * 5 + 1) * RULES.laneW, y = hash(i * 5 + 2) * RULES.laneH;
      const p = toScreen(L, x, y), r = L.su * p.s * (0.05 + 0.07 * hash(i * 5 + 3));
      if (hash(i * 5 + 4) < 0.7) {
        ctx.fillStyle = hash(i) < 0.5 ? pal.pathDark : 'rgba(255,255,255,.45)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.4, r * 0.8, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = pal.grassDark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - r, p.y);
        ctx.lineTo(p.x - r * 1.6, p.y - r * 2.6);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - r * 3.2);
        ctx.moveTo(p.x + r, p.y);
        ctx.lineTo(p.x + r * 1.6, p.y - r * 2.4);
        ctx.stroke();
      }
    }
    // two cart ruts up the middle
    ctx.strokeStyle = 'rgba(140,100,50,.16)';
    for (const fx of [0.36, 0.64]) {
      ctx.lineWidth = Math.max(2, L.su * 0.25);
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const q = toScreen(L, fx * RULES.laneW + Math.sin(i * 1.3) * 0.15, (RULES.laneH * i) / 8);
        if (i) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
    }
  }

  /** Gulls dozing on the lake in a rest. */
  private dozers(y: number, depth: number): void {
    const u = this.L.u;
    for (let i = 0; i < 5; i++) {
      const x = this.w * (0.08 + 0.18 * i + 0.05 * hash(i));
      paintGull(this.ctx, x, y + Math.sin(this.clock * 1.5 + i) * 1.5 + depth * 0.15 * hash(i * 3), 13 * u, { flap: 0, dir: i % 2 ? 1 : -1, float: true });
    }
  }

  /** The hungry: the front row and the next one, smaller, behind it. */
  private crowd(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L.lane, u = this.L.u, h = sim.hill;
    const rest = sim.restBlock;
    for (let d = 1; d >= 0; d--) {
      const row = h.row + d;
      const list = h.groups.filter(g => g.row === row || (d === 0 && g.row === h.row - 1 && this.rowShown < h.row - 0.05));
      for (const g of list) {
        const rel = g.row - this.rowShown;
        if (rel < -0.95) continue;
        const cxL = (g.x0 + g.x1) / 2;
        const top = toScreen(L, cxL, RULES.laneH);
        const scale = clamp(1 - 0.28 * rel, 0.6, 1.1);
        const gw = (toScreen(L, g.x1, RULES.laneH).x - toScreen(L, g.x0, RULES.laneH).x) * scale;
        const s = Math.min(gw / 2.7, this.L.crowdH * 0.46 * scale) * (g.size >= 100 ? 0.9 : 1);
        const y = this.rowY(rel);
        const a = rel < 0 ? clamp(1 + rel) : rel > 0.5 ? 0.8 : 1;
        ctx.globalAlpha = a;
        const cheer = g.done >= 0 ? clamp(g.done / 1.6) : 0;
        paintGroup(ctx, top.x, y, gw, s, { seed: g.id + 1 + h.level * 13, size: g.size, fed: g.fed, cheer: g.done >= 0 && cheer < 1 ? cheer : 0, done: g.done >= 0, t: this.clock, rest, active: rel < 0.5 });
        // the hunger badge over the group
        const left = g.size - g.fed;
        const by = y - s * 1.05;
        const br = Math.max(9 * u, s * 0.36);
        if (rel > 0.5) {
          // the next row waits its turn: no badge yet
        } else if (g.done < 0) {
          ctx.fillStyle = '#fff6e0';
          ctx.strokeStyle = 'rgba(150,100,50,.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(top.x - br * 1.25, by - br * 0.7, br * 2.5, br * 1.4, br * 0.7);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = C.text;
          ctx.font = font(850, br * 0.95, SANS);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(left), top.x, by + 0.5);
          // a thin bar of how much of the group has eaten
          if (g.fed > 0) {
            ctx.fillStyle = '#7fae5a';
            ctx.fillRect(top.x - br * 1.05, by + br * 0.45, br * 2.1 * (g.fed / g.size), 2);
          }
        } else {
          ctx.fillStyle = C.green;
          ctx.beginPath();
          ctx.arc(top.x, by, br * 0.62, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = Math.max(1.5, br * 0.18);
          ctx.beginPath();
          ctx.moveTo(top.x - br * 0.3, by);
          ctx.lineTo(top.x - br * 0.05, by + br * 0.25);
          ctx.lineTo(top.x + br * 0.32, by - br * 0.25);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Gates, the pelican and the bread, far to near; the gulls above them. */
  private world(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L.lane, u = this.L.u, h = sim.hill;
    const gates = h.gates.slice().sort((a, b) => b.y - a.y);
    const pk = h.pelikan;
    let pkDrawn = !pk || pk.state === 'gone';
    for (const g of gates) {
      if (!pkDrawn && pk && pk.y > g.y) {
        this.pelikan(sim);
        pkDrawn = true;
      }
      this.gate(sim, g);
    }
    if (!pkDrawn) this.pelikan(sim);
    // the bread, far first
    const ps = h.pieces;
    const order = ps.length > 1 ? ps.slice().sort((a, b) => b.y - a.y) : ps;
    for (const p of order) {
      const s = toScreen(L, p.x, p.y);
      const hop = Math.abs(Math.sin(p.age * 9 + p.id)) * L.su * 0.18 * s.s;
      const r = L.su * s.s * (p.kind === 'big' ? 0.75 : 0.26);
      ctx.fillStyle = 'rgba(40,40,20,.18)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + r * 0.4, r * 0.9, r * 0.3, 0, 0, TAU);
      ctx.fill();
      if (p.kind === 'fish') paintFish(ctx, s.x, s.y - hop - r * 0.3, r * 0.95, Math.sin(p.age * 18 + p.id));
      else if (p.kind === 'big') paintBasket(ctx, s.x, s.y - r * 0.9, r, { fill: 1, legs: p.age, gold: true });
      else paintLoaf(ctx, s.x, s.y - hop - r * 0.4, r, Math.sin(p.age * 6 + p.id) * 0.25, p.n);
    }
    // the gulls: shadows on the grass, birds above
    for (const g of h.gulls) {
      const s = toScreen(L, g.x, g.y);
      const lift = L.su * 1.3 * s.s * (g.state === 'fall' ? Math.max(0, 1 - g.t) : 1);
      ctx.fillStyle = 'rgba(30,40,20,.14)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2, L.su * 0.45 * s.s, L.su * 0.12 * s.s, 0, 0, TAU);
      ctx.fill();
      paintGull(ctx, s.x, s.y - lift, L.su * s.s, {
        flap: this.clock * (g.kind === 'mirka' ? 9 : 11) + g.id, dir: g.dir, mirka: g.kind === 'mirka', carry: g.carry > 0 && g.state !== 'fall',
        fall: g.state === 'fall' ? g.t : 0,
      });
    }
    // Mirka on her post when she is not out stealing
    const mirkaOut = h.gulls.some(g => g.kind === 'mirka');
    const post = this.perch();
    ctx.fillStyle = C.postDark;
    ctx.fillRect(post.x - 3 * u, post.y + 6 * u, 6 * u, L.yB - post.y);
    ctx.fillStyle = C.post;
    ctx.fillRect(post.x - 3 * u, post.y + 6 * u, 3 * u, L.yB - post.y);
    if (!mirkaOut && this.mirkaAway <= 0) {
      paintGull(ctx, post.x, post.y, L.su * 0.95, { flap: sim.restBlock ? 0 : this.clock * 0.6, dir: 1, mirka: true, float: true });
      if (sim.restBlock) {
        ctx.fillStyle = 'rgba(40,60,70,.7)';
        ctx.font = font(800, 10 * u, SANS);
        ctx.textAlign = 'left';
        const k = (this.clock * 0.5) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillText('z', post.x + 10 * u + k * 8 * u, post.y - 10 * u - k * 14 * u);
        ctx.globalAlpha = 1;
      }
    }
  }

  private gate(sim: ChlebySim, g: Gate): void {
    const ctx = this.ctx, L = this.L.lane;
    const c = toScreen(L, g.x, g.y);
    const a = toScreen(L, g.x - g.w / 2, g.y), b = toScreen(L, g.x + g.w / 2, g.y);
    const w = b.x - a.x, s = L.su * c.s;
    if (g.kind === 'gold') {
      const mode: GoldMode = sim.phase !== 'play' ? 'off' : sim.blind ? 'blind' : sim.restBlock ? 'rest'
        : sim.block.kind === 'push' ? (sim.blockT < sim.leadIn ? 'wait' : 'live') : 'off';
      paintGoldGate(ctx, c.x, c.y, w, s, {
        mult: fmtX(sim.gold), level: this.gaugeLevel, mode, flash: g.flash, t: this.clock, thr: TXT.thr, reliable: sim.reliable,
      });
      if (mode === 'blind') paintMist(ctx, c.x - w * 0.8, c.y - s * 3.4, w * 1.6, s * 3.6, this.clock, 1);
      return;
    }
    const label = g.kind === 'add' ? `+${g.n}` : g.kind === 'sub' ? `−${Math.max(0, Math.ceil(g.left))}` : `×${g.n}`;
    paintGate(ctx, c.x, c.y, w, s, g.kind === 'start' ? 'mul' : g.kind, label, g.flash, g.kind === 'sub' ? g.down : 0);
  }

  private pelikan(sim: ChlebySim): void {
    const pk = sim.hill.pelikan;
    if (!pk || pk.state === 'gone') return;
    const L = this.L.lane, p = toScreen(L, pk.x, pk.y), u = this.L.u;
    paintPelikan(this.ctx, p.x, p.y, L.su * p.s, { pouch: pk.pouch / pk.cap, gulp: pk.gulp, t: this.clock, leaving: pk.state === 'leave' });
    if (pk.state === 'sit') {
      // his pouch as a little bar: how much more he wants
      const w = 46 * u * p.s, x = p.x - w / 2, y = p.y + 8 * u;
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(58,42,24,.35)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 5 * u, 2.5 * u);
      ctx.fill();
      ctx.fillStyle = C.pouch;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(5 * u, w * (pk.pouch / pk.cap)), 5 * u, 2.5 * u);
      ctx.fill();
    }
  }

  /** The boy and his basket; around it the big basket's ring (the hold) and, when full, the big basket. */
  private boy(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L.lane, u = this.L.u;
    const p = toScreen(L, sim.x, 0);
    const s = L.boy;
    const toss = clamp(1 - sim.tossT / 0.18);
    paintBoy(ctx, p.x, p.y + s * 0.62, s, { toss, t: this.clock, walk: sim.x });
    const r = s * 0.62;
    const bx = p.x, by = p.y + s * 0.1 - toss * s * 0.12;
    const showRing = sim.charge > 0.01 || sim.bigReady || (sim.block?.kind === 'push' && sim.phase === 'play' && !sim.blind);
    if (sim.bigReady) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, bx, by - r * 0.4, r * 3, C.goldGlow, 0.35 + 0.2 * Math.sin(this.clock * 6) + this.bigPulse * 0.3);
      ctx.restore();
      paintBasket(ctx, bx, by - r * 0.3, r * 1.25, { fill: 1, gold: true, legs: this.clock * 0.3 });
    } else paintBasket(ctx, bx, by, r, { fill: 0.8 });
    if (showRing) {
      const R = r * 1.9;
      ctx.lineWidth = Math.max(3, 4 * u);
      ctx.strokeStyle = 'rgba(58,42,24,.25)';
      ctx.beginPath();
      ctx.arc(bx, by - r * 0.2, R, 0, TAU);
      ctx.stroke();
      const k = sim.bigReady ? 1 : sim.charge;
      if (k > 0) {
        ctx.strokeStyle = C.gold;
        ctx.beginPath();
        ctx.arc(bx, by - r * 0.2, R, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
      }
      const pushing = sim.phase === 'play' && sim.block.kind === 'push';
      const label = sim.bigReady ? `${TXT.bigLabel}: ${TXT.bigGo}` : pushing && !sim.blind ? `${TXT.bigLabel} · ${TXT.bigHold}` : TXT.bigLabel;
      ctx.font = font(800, 10 * u, SANS);
      const tw = ctx.measureText(label).width + 12 * u;
      const lx = clamp(bx + R + 6 * u, 6, this.w - tw - 6), ly = by - r * 0.2 - 8 * u;
      const flip = lx < bx;
      const x = flip ? clamp(bx - R - 6 * u - tw, 6, this.w - tw - 6) : lx;
      ctx.fillStyle = sim.bigReady ? 'rgba(243,193,63,.92)' : 'rgba(255,246,224,.85)';
      ctx.beginPath();
      ctx.roundRect(x, ly, tw, 16 * u, 8 * u);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 6 * u, ly + 8 * u + 0.5);
    }
  }

  /** The band's last 40 s as a row of little baskets along the bottom: gold where it lay above the threshold. */
  private history(sim: ChlebySim): void {
    const ctx = this.ctx, Lo = this.L, r = Lo.hist, u = Lo.u;
    const n = Lo.mode === 'tall' ? 16 : 20;
    const bars = traceBars(sim.trace, sim.t, n, 40);
    const step = r.w / n, rad = Math.min(step * 0.4, r.h * 0.55);
    ctx.fillStyle = 'rgba(255,246,224,.55)';
    ctx.beginPath();
    ctx.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 8 * u);
    ctx.fill();
    // the blocks behind: a cool band behind rests, a warm one behind pushes
    bars.forEach((b, i) => {
      if (b.empty) return;
      const c = b.phase === 'rest' ? 'rgba(90,160,184,.28)' : b.phase === 'focus' ? 'rgba(243,193,63,.16)' : '';
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(r.x + i * step, r.y - 3, step + 0.5, r.h + 6);
    });
    // the threshold: a dashed line where a basket is half full
    const thY = r.y + r.h * 0.62 - rad * 0.75;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(58,42,24,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x, thY);
    ctx.lineTo(r.x + r.w, thY);
    ctx.stroke();
    ctx.setLineDash([]);
    bars.forEach((b, i) => {
      const x = r.x + (i + 0.5) * step, y = r.y + r.h * 0.62;
      ctx.globalAlpha = b.shown < 1 ? 0.25 + 0.75 * b.shown : 1;
      paintHistBasket(ctx, x, y, rad, { level: b.level, above: b.above, reliable: b.reliable, empty: b.empty });
      ctx.globalAlpha = 1;
      if (b.shown < 1 && !b.empty) {
        ctx.fillStyle = `rgba(230,238,242,${0.85 * (1 - b.shown)})`;
        ctx.fillRect(r.x + i * step, r.y - 3, step + 0.5, r.h + 6);
      }
    });
    // the lag bracket at "now"
    const lag = LAG_SEC[this.opts.eeg ? 'eeg' : 'fnirs'];
    const x1 = r.x + r.w, x0 = x1 - (lag / 40) * r.w, by = r.y - 6;
    ctx.strokeStyle = 'rgba(58,42,24,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, by + 4);
    ctx.lineTo(x0, by);
    ctx.lineTo(x1, by);
    ctx.lineTo(x1, by + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(58,42,24,.8)';
    ctx.font = font(750, 9 * u, SANS);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.hud.lag, x1, by - 1);
    ctx.textAlign = 'left';
    ctx.fillText(TXT.hist, r.x, by - 1);
  }
}

const inside = (r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Confetti in the hillside's colours: poppies, chamomile, grass, gold. */
const CONFETTI = ['#e5584a', '#f2c94c', '#fbf6e8', '#7fae5a', '#d65a8c'];
