/**
 * Chleby i ryby's play view (v2): a terrace of the hillside above the Sea of Galilee seen from
 * behind the boy's basket — the lane of worn earth up the slope, the tables of the hungry at the top
 * with their hunger bars, the gates across the lane (green, honey, grey, and the golden gate whose
 * arch is the band's gauge with the threshold notched at its top), the crowd of bread-bearers
 * running up, the gull waves waddling down, the Pelikan, the Big Basket, the boy with his basket and
 * the champion's ring around it, Mirka on her post, and the row of baskets of crumbs along the
 * bottom.  Juice: recoil, flying numbers, crumbs and feathers, confetti, a small shake (none with
 * reduced motion) and a hit-stop on the big moments.  Words and cards are drawn by hud.ts; the
 * runner draws the band's panel, the score and the coach marks.
 */
import { fmtNum } from '../../i18n';
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { HINTS } from './content';
import { placeOf, type Gate, type Gull, type Runner } from './field';
import { Hud } from './hud';
import { t } from './i18n';
import { ChlebyIntro } from './intro';
import { layout, laneX, toScreen, type Layout } from './layout';
import type { ChlebyProgress, Teach } from './meta';
import {
  C, PALETTES, SANS, font, glow, paintBasket, paintBigBasket, paintBoy, paintGate, paintGoldGate, paintGrass, paintGull, paintGullWalk,
  paintLake, paintMist, paintPath, paintPelikan, paintRunner, paintSky, paintTable,
} from './paint';
import { RULES, fmtX, type ChlebySim, type SimEvent } from './sim';

const TAU = Math.PI * 2;
const TXT = {
  thr: t('hud.thr'), big: t('hud.big'), bank: t('hud.bank'), climb: t('hud.climb'), fed: t('fx.fed'), won: t('fx.won'), peck: t('fx.peck'),
  shoo: t('fx.shoo'), wave: t('fx.wave'), fat: t('fx.fat'), pelikan: t('fx.pelikan'), sated: t('fx.sated'), help: t('fx.help'),
  bigGo: t('fx.big'), bigReady: t('fx.bigReady'), basket: t('fx.basket'), restPass: t('fx.restPass'), brk: t('fx.break'),
};
const CONFETTI = ['#e5584a', '#f2c94c', '#fbf6e8', '#7fae5a', '#d65a8c'];

export type Hit =
  | { kind: 'press'; x: number }
  | { kind: 'drag'; x: number }
  | { kind: 'release' }
  | { kind: 'offer'; i: number }
  | { kind: 'go' }
  | { kind: 'story' };

export class ChlebyView {
  readonly hud: Hud;
  private readonly ctx: CanvasRenderingContext2D;
  private L = layout(800, 600, 120);
  private dpr = 1;
  private t = 0;
  private readonly parts = new Particles(500);
  private readonly shake: Shake;
  private readonly introScene = new ChlebyIntro();
  private pointerId: number | null = null;
  /** seconds of hit-stop left (the index slows the field while > 0) */
  hitStop = 0;
  /** the terrace slide: climbing out (0..1) and coming in (0..1) */
  private enter = 1;
  private readonly cheer = new Map<number, number>();
  private readonly gateFloat = new Map<number, { n: number; t: number }>();
  private feedAcc = 0;
  private feedAt = { x: 0, y: 0 };
  private feedT = 0;
  private snatchT = 0;
  private gulpAcc = 0;
  private ring = 0;
  private bankPop = 0;
  private mist = 0;
  private restK = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean; hudTop: () => number }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas unavailable');
    this.ctx = ctx;
    this.hud = new Hud(ctx);
    this.shake = new Shake(opts.reducedMotion);
    this.hud.resize(this.L);
  }

  resize(w: number, h: number, dpr: number): void {
    this.dpr = dpr;
    this.L = layout(w, h, this.opts.hudTop());
    this.hud.resize(this.L);
  }

  get layout(): Layout { return this.L; }

  intro(dt: number, p: number, progress: ChlebyProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.L.w, this.L.h, dt, p, progress);
  }

  start(): void { this.t = 0; }

  // ── where things are ─────────────────────────────────────────────
  private P(x: number, y: number): { x: number; y: number; s: number } {
    const q = toScreen(this.L.lane, x, y);
    return { x: q.x, y: q.y + this.slideY(), s: q.s };
  }

  private slideY(): number {
    const L = this.L.lane;
    return -(1 - ease.outCubic(this.enter)) * (L.yB - L.yT) * 0.35;
  }

  /** The basket's place on screen. */
  private basketAt(sim: ChlebySim): { x: number; y: number } {
    const q = toScreen(this.L.lane, sim.x, 0);
    return { x: q.x, y: q.y - this.L.lane.boy * 0.15 };
  }

  /** Where a coach mark points (CSS px), or null when the thing is not on screen. */
  anchor(w: Teach, sim: ChlebySim): { x: number; y: number } | null {
    const f = sim.field, L = this.L;
    const gateAt = (g: Gate | undefined) => (g ? this.P(g.x, g.y) : null);
    switch (w) {
      case 'tap':
      case 'hold':
      case 'big': {
        const b = this.basketAt(sim);
        return { x: b.x, y: b.y - L.lane.boy * 1.3 };
      }
      case 'drag': return gateAt(f.gates.find(g => g.kind === 'mul'));
      case 'gold': {
        const q = gateAt(f.gold);
        return q ? { x: q.x, y: q.y - L.lane.su * q.s * 1.8 } : null;
      }
      case 'sub': return gateAt(f.gates.find(g => g.kind === 'sub'));
      case 'add': return gateAt(f.gates.find(g => g.kind === 'add'));
      case 'gull': {
        const g = f.gulls.find(x => x.state === 'walk');
        return g ? this.P(g.x, g.y) : null;
      }
      case 'pelikan': return f.pelikan ? this.P(f.pelikan.x, f.pelikan.y) : null;
      case 'rest': return { x: L.bank.x + L.bank.w / 2, y: L.bank.y - 4 };
    }
  }

  hintText(w: Teach): string { return HINTS[w]; }

  // ── input ────────────────────────────────────────────────────────
  pointer(type: 'down' | 'move' | 'up', x: number, y: number, id: number, sim: ChlebySim): Hit | null {
    if (type === 'down' && this.hud.storyOn) {
      this.hud.hideStory();
      return { kind: 'story' };
    }
    if (type === 'down' && sim.stage === 'card') {
      const i = this.hud.offerRects.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (i >= 0) return { kind: 'offer', i };
      const g = this.hud.goRect;
      if (g && x >= g.x - 6 && x <= g.x + g.w + 6 && y >= g.y - 6 && y <= g.y + g.h + 6) return { kind: 'go' };
      return null;
    }
    const lx = clamp(laneX(this.L.lane, x), 0, RULES.laneW);
    if (type === 'down') {
      this.pointerId = id;
      return { kind: 'press', x: lx };
    }
    if (id !== this.pointerId) return null;
    if (type === 'move') return { kind: 'drag', x: lx };
    this.pointerId = null;
    return { kind: 'release' };
  }

  release(): void { this.pointerId = null; }

  // ── events ───────────────────────────────────────────────────────
  on(e: SimEvent, sim: ChlebySim): void {
    const hud = this.hud, L = this.L, u = L.u;
    switch (e.type) {
      case 'fire': {
        const b = this.basketAt(sim);
        if (e.kind === 'big') {
          hud.float(TXT.bigGo, b.x, b.y - L.lane.boy * 1.6, C.goldLight, 22, 1.4, 50);
          this.parts.burst(b.x, b.y - L.lane.boy * 0.6, 26, { color: C.gold, speed: 220, size: 3, life: 0.8, shape: 'spark' });
          this.shake.add(0.35);
          this.hitStop = Math.max(this.hitStop, 0.08);
        } else if (Math.random() < 0.3) this.parts.burst(b.x, b.y - L.lane.boy * 0.5, 2, { color: C.crumb, speed: 70, size: 1.8, life: 0.4, angle: -Math.PI / 2, spread: 1.2 });
        break;
      }
      case 'gate': {
        const g = this.gateFloat.get(e.kind === 'gold' ? 99 : Math.round(e.y * 10)) ?? { n: 0, t: 0 };
        g.n += e.made;
        this.gateFloat.set(e.kind === 'gold' ? 99 : Math.round(e.y * 10), g);
        if (e.kind === 'gold' && e.n > 1) {
          const q = this.P(e.x, e.y);
          this.parts.burst(q.x, q.y - L.lane.su * q.s, 4, { color: C.goldLight, speed: 110, size: 2.2, life: 0.6, shape: 'spark', g: 60 });
        }
        if (e.kind === 'add') {
          const q = this.P(e.x, e.y);
          hud.float(`+${e.n}`, q.x, q.y - L.lane.su * q.s * 1.6, '#c9f2a8', 17, 0.9, 26);
          this.parts.burst(q.x, q.y - L.lane.su * q.s, 10, { color: C.greenLight, speed: 140, size: 2.4, life: 0.5 });
        }
        break;
      }
      case 'feed': {
        const q = this.P(e.x, RULES.laneH);
        this.feedAcc += e.n;
        this.feedAt = q;
        this.parts.burst(q.x, q.y - 6 * u, e.big ? 30 : 2, { color: C.crumb, speed: e.big ? 200 : 80, size: 2, life: 0.5, g: 200 });
        if (e.big) {
          hud.float(`+${e.n}`, q.x, q.y - 30 * u, C.goldLight, 26, 1.3, 40);
          this.shake.add(0.3);
          this.feedAcc = 0;
        }
        break;
      }
      case 'tableFed': {
        const tb = sim.field.tables[e.table];
        const q = this.P(e.x, RULES.laneH);
        this.cheer.set(e.table, 0);
        hud.float(TXT.fed, q.x, q.y - 40 * u, '#fff6e0', 22, 1.3, 30);
        this.parts.burst(q.x, q.y - 20 * u, 40, { color: CONFETTI[0], speed: 240, size: 3, life: 1.2, shape: 'square', g: 300 });
        this.parts.burst(q.x, q.y - 20 * u, 30, { color: CONFETTI[1], speed: 220, size: 3, life: 1.2, shape: 'square', g: 300 });
        if (tb) this.shake.add(0.2);
        this.hitStop = Math.max(this.hitStop, 0.07);
        break;
      }
      case 'snatch': {
        const q = this.P(e.x, e.y);
        this.parts.burst(q.x, q.y - 8 * u * q.s, 3, { color: '#ffffff', speed: 90, size: 2, life: 0.6, g: 80 });
        this.snatchT -= 1;
        if (this.snatchT <= 0) {
          this.snatchT = 6;
          hud.float(`−${e.n}`, q.x, q.y - 16 * u, '#ffd0c8', 13, 0.7, 18);
        }
        break;
      }
      case 'peck': {
        const b = this.basketAt(sim);
        hud.float(TXT.peck, b.x, b.y - L.lane.boy * 1.4, '#ffd0c8', 18, 0.9, 24);
        this.parts.burst(b.x, b.y - L.lane.boy * 0.5, 8, { color: '#ffffff', speed: 120, size: 2.2, life: 0.6 });
        this.shake.add(0.25);
        break;
      }
      case 'shoo': {
        const q = this.P(e.x, e.y);
        if (Math.random() < 0.4) hud.float(TXT.shoo, q.x, q.y - 20 * u, '#e6f3f8', 13, 0.8, 22);
        break;
      }
      case 'wave': {
        const q = this.P(e.x, RULES.laneH - 1);
        hud.float(e.fat ? TXT.fat : TXT.wave, q.x, q.y + 10 * u, '#ffffff', e.fat ? 20 : 16, 1.1, 18);
        break;
      }
      case 'gulp': {
        this.gulpAcc += e.n;
        const P = sim.field.pelikan;
        if (P && this.gulpAcc >= 5) {
          const q = this.P(P.x, P.y);
          hud.float(`+${this.gulpAcc}`, q.x + 20 * u, q.y - L.lane.su * q.s * 2.4, '#ffd08a', 14, 0.8, 20);
          this.gulpAcc = 0;
        }
        break;
      }
      case 'pelikan':
        hud.showBanner(TXT.pelikan, t('hint.pelikan'), true, 2.6);
        break;
      case 'sated': {
        const q = this.P(e.x, e.y);
        hud.float(TXT.sated, q.x, q.y - 50 * u, '#ffd08a', 24, 1.5, 40);
        this.parts.burst(q.x, q.y - 30 * u, 50, { color: CONFETTI[1], speed: 260, size: 3, life: 1.3, shape: 'square', g: 300 });
        this.shake.add(0.35);
        this.hitStop = Math.max(this.hitStop, 0.09);
        break;
      }
      case 'spill': {
        const q = this.P(e.x, e.y);
        hud.float(`+${e.n}`, q.x, q.y - 30 * u, C.goldLight, 20, 1, 30);
        this.parts.burst(q.x, q.y - 14 * u, 20, { color: C.crumb, speed: 200, size: 2.6, life: 0.7 });
        break;
      }
      case 'swallow': {
        const q = this.P(e.x, e.y);
        this.parts.burst(q.x, q.y - 6 * u, 3, { color: C.greyLight, speed: 60, size: 2, life: 0.5 });
        break;
      }
      case 'break': {
        const q = this.P(e.x, e.y);
        hud.float(TXT.brk, q.x, q.y - 30 * u, '#f3f3ee', 16, 0.9, 24);
        this.parts.burst(q.x, q.y - 10 * u, 18, { color: C.greyDark, speed: 180, size: 2.6, life: 0.7, shape: 'square' });
        this.shake.add(0.15);
        break;
      }
      case 'help':
        hud.float(TXT.help, L.cardX, L.lane.yT + 40 * u, '#fff6e0', 15, 2, 20);
        break;
      case 'cleared':
        if (sim.stage === 'climb') hud.showBanner(TXT.climb, '', false, 1.5);
        break;
      case 'terrace':
        this.enter = e.index > 0 ? 0 : 1;
        if (e.index > 0) hud.showBanner(t('fx.terrace', { i: e.index + 1, of: e.of }), '', false, 1.6);
        this.cheer.clear();
        break;
      case 'levelStart': {
        this.enter = 0;
        const { chapter } = placeOf(e.level);
        const sub = e.terraces > 1 ? `${CHAPTER(chapter)} · ${t('fx.terrace', { i: 1, of: e.terraces })}` : CHAPTER(chapter);
        hud.showBanner(t('fx.level', { n: e.level + 1 }), sub, e.boss, 2.2);
        break;
      }
      case 'won': {
        this.parts.burst(L.cardX, L.lane.yT + 20 * u, 60, { color: CONFETTI[3], speed: 300, size: 3, life: 1.5, shape: 'square', g: 300 });
        this.parts.burst(L.cardX, L.lane.yT + 20 * u, 60, { color: CONFETTI[4], speed: 300, size: 3, life: 1.5, shape: 'square', g: 300 });
        this.hitStop = Math.max(this.hitStop, 0.09);
        break;
      }
      case 'bigReady': {
        const b = this.basketAt(sim);
        hud.float(TXT.bigReady, b.x, b.y - L.lane.boy * 1.7, C.goldLight, 15, 1.6, 26);
        this.ring = 1;
        break;
      }
      case 'basket':
        this.bankPop = 1;
        hud.float(e.pass ? TXT.restPass : TXT.basket, L.bank.x + L.bank.w / 2, L.bank.y - 14 * u, '#fff6e0', 14, 1.2, 22);
        break;
      case 'blindPay':
        hud.float(t('fx.blindPay', { n: e.runners }), L.cardX, L.lane.yT + (L.lane.yB - L.lane.yT) * 0.45, C.goldLight, 20, 1.6, 30);
        break;
      case 'say':
        hud.say(e.who, e.text, e.dur);
        break;
      case 'story':
        hud.showStory(e.kind, e.chapter);
        break;
      default:
        break;
    }
  }

  // ── a frame ──────────────────────────────────────────────────────
  update(dt: number, sim: ChlebySim): void {
    this.t += dt;
    this.hitStop = Math.max(0, this.hitStop - dt);
    this.parts.update(dt);
    this.hud.update(dt, sim);
    this.enter = Math.min(1, this.enter + dt / 0.55);
    for (const [k, v] of this.cheer) this.cheer.set(k, v + dt);
    this.ring = Math.max(0, this.ring - dt * 0.8);
    this.bankPop = Math.max(0, this.bankPop - dt * 2.5);
    this.mist = approach(this.mist, sim.blind ? 1 : 0, dt, 0.5);
    this.restK = approach(this.restK, sim.restBlock ? 1 : 0, dt, 0.6);
    // the numbers flying off the gates, gathered so a flood reads as one number
    for (const [k, g] of this.gateFloat) {
      g.t += dt;
      if (g.t >= 0.35 && g.n > 0) {
        const gate = k === 99 ? sim.field.gold : sim.field.gates.find(x => Math.round(x.y * 10) === k);
        if (gate && gate.kind !== 'add') {
          const q = this.P(gate.x, gate.y);
          const gold = gate.kind === 'gold';
          this.hud.float(`+${fmtNum(g.n)}`, q.x, q.y - this.L.lane.su * q.s * (gold ? 2.6 : 1.8), gold ? C.goldLight : '#ffe2b0', gold ? 18 : 14, 0.8, 24);
        }
        this.gateFloat.delete(k);
      }
    }
    // the tables' munching: one number per moment
    this.feedT += dt;
    if (this.feedT >= 0.45 && this.feedAcc > 0) {
      this.feedT = 0;
      this.hud.float(`+${fmtNum(this.feedAcc)}`, this.feedAt.x, this.feedAt.y - 26 * this.L.u, '#fff6e0', 15, 0.8, 22);
      this.feedAcc = 0;
    }
  }

  draw(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, lane = L.lane, u = L.u, t = this.t;
    const dt = 1 / 60;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pal = PALETTES[sim.field.plan.chapter % PALETTES.length];
    const sh = this.shake.offset(dt, 8 * u);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    // the world behind
    paintSky(ctx, L.w, L.horizon, pal, t);
    paintLake(ctx, L.w, L.horizon, L.lakeD, pal, t);
    paintGrass(ctx, L.w, L.horizon + L.lakeD, L.h + 10, pal, t);
    // the lane up the hill
    const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const y = (RULES.laneH + 0.6) * (i / 8);
      const a = toScreen(lane, -0.3, y), b = toScreen(lane, RULES.laneW + 0.3, y);
      left.push({ x: a.x, y: a.y }); right.push({ x: b.x, y: b.y });
    }
    left.unshift({ x: left[0].x - 6 * u, y: L.h }); right.unshift({ x: right[0].x + 6 * u, y: L.h });
    paintPath(ctx, [left, right], pal);
    // mown stripes across the lane (depth cues)
    ctx.strokeStyle = 'rgba(120,80,30,.08)';
    ctx.lineWidth = 2;
    for (let y = 2; y < RULES.laneH; y += 2) {
      const a = toScreen(lane, 0, y), b = toScreen(lane, RULES.laneW, y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    this.drawField(sim);
    this.drawBoy(sim);
    this.drawMirka(sim);
    this.drawBank(sim);
    this.parts.draw(ctx);
    ctx.restore();
    this.hud.draw(sim, { mirka: this.mirkaAt(), boy: { x: this.basketAt(sim).x, y: this.basketAt(sim).y - lane.boy * 0.9 } });
  }

  // ── the field ────────────────────────────────────────────────────
  private drawField(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, lane = L.lane, t = this.t, f = sim.field;
    const fade = sim.stage === 'climb' ? 1 - clamp(sim.stageT / RULES.climb) : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, fade * clamp(this.enter * 1.5));
    // the tables at the top
    for (const tb of f.tables) {
      const q = this.P(tb.x, RULES.laneH);
      const w = tb.half * 2 * lane.unit * q.s;
      const S = lane.su * q.s;
      paintTable(ctx, q.x, q.y - S * 0.2, w, S, {
        seed: tb.id + f.plan.level * 7 + f.plan.index * 3, hunger: tb.hunger, full: tb.full, fed: tb.fed, bite: tb.bite,
        cheer: this.cheer.get(tb.id) ?? 9, rest: sim.restBlock, t, label: fmtNum(Math.max(0, Math.ceil(tb.hunger))),
      });
    }
    // everything on the lane, far to near
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const g of f.gates) items.push({ y: g.y + 0.01, draw: () => this.drawGate(g, sim) });
    for (const g of f.gulls) items.push({ y: g.y, draw: () => this.drawGull(g) });
    for (const r of f.runners) items.push({ y: r.y, draw: () => this.drawRunner(r, sim) });
    const P = f.pelikan;
    if (P) {
      items.push({
        y: P.y, draw: () => {
          const q = this.P(P.x, P.y);
          const S = lane.su * q.s * 1.25;
          paintPelikan(ctx, q.x, q.y, S, { pouch: 1 - P.pouch / Math.max(1, P.full), gulp: clamp(1 - P.gulp * 4), t, leaving: P.state === 'sated' });
          if (P.state !== 'sated' && P.pouch > 0) {
            ctx.font = font(900, Math.max(11, S * 0.5), SANS);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(90,40,0,.75)';
            ctx.strokeText(fmtNum(P.pouch), q.x, q.y - S * 2.4);
            ctx.fillStyle = '#ffd08a';
            ctx.fillText(fmtNum(P.pouch), q.x, q.y - S * 2.4);
          }
        },
      });
    }
    items.sort((a, b) => b.y - a.y);
    for (const it of items) it.draw();
    ctx.restore();
  }

  private drawGate(g: Gate, sim: ChlebySim): void {
    const ctx = this.ctx, lane = this.L.lane;
    const q = this.P(g.x, g.y);
    const S = lane.su * q.s;
    const w = g.half * 2 * lane.unit * q.s;
    if (g.kind === 'gold') {
      const b = sim.block;
      const mode = sim.phase !== 'play' || b.kind === 'warmup' ? 'off' : sim.blind ? 'blind' : b.kind === 'rest' ? 'rest' : sim.sighted ? 'live' : 'wait';
      const S2 = S * 1.2;
      paintGoldGate(ctx, q.x, q.y, w, S2, { mult: fmtX(sim.gold), level: sim.focus, mode, flash: g.flash, t: this.t, thr: this.L.mode === 'short' ? '' : TXT.thr, reliable: sim.reliable });
      if (this.mist > 0.02) paintMist(ctx, q.x - w * 0.8, q.y - S2 * 3, w * 1.6, S2 * 3.2, this.t, this.mist);
      return;
    }
    const look = g.kind === 'start' ? 'start' : g.kind;
    const label = g.kind === 'sub' ? `−${g.left}` : g.kind === 'add' ? `+${g.n}` : `×${g.n}`;
    ctx.save();
    if (g.kind === 'add' && g.charge < 1) ctx.globalAlpha *= 0.45 + 0.4 * g.charge;
    paintGate(ctx, q.x, q.y, w, S, look, label, g.flash, g.kind === 'sub' ? g.down : 0);
    ctx.restore();
  }

  private drawGull(g: Gull): void {
    const ctx = this.ctx, lane = this.L.lane;
    const q = this.P(g.x, g.y);
    const S = lane.su * q.s;
    if (g.state === 'fly') {
      const k = clamp(g.t / 1.6);
      ctx.save();
      ctx.globalAlpha *= 1 - k * 0.8;
      paintGull(ctx, q.x, q.y - S * (0.8 + k * 2), S * 0.9, { flap: this.t * 14, dir: g.dir, mirka: g.kind === 'mirka', carry: g.carry });
      ctx.restore();
      return;
    }
    paintGullWalk(ctx, q.x, q.y, S, { kind: g.kind, step: this.t * 9 + g.id, doze: g.state === 'doze', t: this.t });
  }

  private drawRunner(r: Runner, sim: ChlebySim): void {
    const lane = this.L.lane;
    const q = this.P(r.x, r.y);
    const S = lane.su * q.s;
    if (r.kind === 'big') {
      paintBigBasket(this.ctx, q.x, q.y, S, { step: r.age * 10, w: r.w, t: this.t });
      return;
    }
    const gold = sim.sighted && (r.mask & (1 << sim.field.gold.id)) !== 0 && sim.gold > 1;
    paintRunner(this.ctx, q.x, q.y, S, { kind: r.kind, step: r.age * 16 + r.id, w: r.w, gold });
  }

  // ── the boy and his basket-cannon ────────────────────────────────
  private drawBoy(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, lane = L.lane, u = L.u;
    const b = this.basketAt(sim);
    const boy = lane.boy;
    const recoil = clamp(1 - sim.shotT / 0.12);
    const jam = sim.jam > 0 ? Math.sin(this.t * 40) * 3 * u : 0;
    // the aim: a soft dotted line up the lane while pouring
    if (sim.pressing && sim.stage === 'level') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,246,224,.55)';
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([4 * u, 6 * u]);
      ctx.beginPath();
      const a = toScreen(lane, sim.x, 1), c = toScreen(lane, sim.x, 7);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();
    }
    paintBoy(ctx, b.x + jam, b.y + boy * 0.35, boy, { toss: recoil, t: this.t, walk: sim.x });
    // the champion's ring around the basket: it fills with a held focus (and slowly with pouring)
    const by = b.y - boy * 0.25 - recoil * boy * 0.12;
    const R = boy * 0.95;
    const ready = sim.bigReady;
    if (ready) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, b.x, by, R * 2.2, C.goldGlow, 0.35 + 0.15 * Math.sin(this.t * 6) + this.ring * 0.4);
      ctx.restore();
    }
    ctx.lineWidth = Math.max(3, 5 * u);
    ctx.strokeStyle = 'rgba(60,40,15,.35)';
    ctx.beginPath();
    ctx.arc(b.x, by, R, 0, TAU);
    ctx.stroke();
    if (sim.charge > 0.004) {
      ctx.strokeStyle = ready ? C.gold : '#f3d27a';
      ctx.beginPath();
      ctx.arc(b.x, by, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.charge));
      ctx.stroke();
    }
    paintBasket(ctx, b.x + jam, by, boy * 0.62, { fill: ready ? 1 : 0.75, gold: ready });
    // its name under the ring, small
    if (L.mode !== 'short') {
      ctx.font = font(800, 10 * u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = ready ? '#fff3c0' : 'rgba(255,246,224,.85)';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(50,30,10,.55)';
      const label = `${TXT.big} ${Math.round(clamp(sim.charge) * 100)}%`;
      ctx.strokeText(label, b.x + R + 34 * u, by - 6 * u);
      ctx.fillText(label, b.x + R + 34 * u, by - 6 * u);
    }
  }

  // ── Mirka on her post ────────────────────────────────────────────
  private mirkaAt(): { x: number; y: number } {
    const p = this.L.perch;
    return { x: p.x, y: p.y - this.L.lane.boy * 1.9 };
  }

  private drawMirka(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, p = L.perch, boy = L.lane.boy;
    const postH = boy * 1.2;
    ctx.fillStyle = C.postDark;
    ctx.fillRect(p.x - 3, p.y - postH, 6, postH);
    ctx.fillStyle = C.post;
    ctx.fillRect(p.x - 3, p.y - postH, 3, postH);
    // she is out leading a wave: the post is empty
    if (sim.field.gulls.some(g => g.kind === 'mirka' && g.state !== 'fly' && g.state !== 'gone')) return;
    paintGullWalk(ctx, p.x, p.y - postH, boy * 0.95, { kind: 'mirka', step: Math.sin(this.t * 2) * 0.5, doze: this.restK > 0.6, t: this.t });
  }

  // ── the bank: twelve baskets of crumbs ───────────────────────────
  private drawBank(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, B = L.bank, u = L.u;
    const n = 12, step = B.w / n, r = Math.min(step * 0.4, B.h * 0.75);
    const filled = Math.min(n, sim.basketsNow);
    const pop = 1 + 0.25 * ease.outCubic(this.bankPop);
    for (let i = 0; i < n; i++) {
      const x = B.x + step * (i + 0.5), y = B.y + B.h * 0.55;
      const fill = i < filled ? 1 : i === filled ? sim.p.crumbs : 0;
      ctx.save();
      if (i === Math.max(0, filled - 1) && this.bankPop > 0) {
        ctx.translate(x, y);
        ctx.scale(pop, pop);
        ctx.translate(-x, -y);
      }
      ctx.globalAlpha = i < filled ? 1 : 0.55;
      paintBasket(ctx, x, y, r, { fill, gold: i < filled && this.restK > 0.5 });
      ctx.restore();
    }
    // the bank's count at the row's start
    ctx.font = font(850, 11 * u, SANS);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(50,30,10,.55)';
    const label = `${TXT.bank}: ${fmtNum(sim.p.bank)}`;
    // beside the row on wide screens, over its right end on an upright phone
    const lx = L.mode === 'tall' ? B.x + B.w : Math.max(ctx.measureText(label).width + 6, B.x - 6 * u);
    const ly = L.mode === 'tall' ? B.y - 9 * u : B.y + B.h * 0.4;
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(label, lx, ly);
  }
}

const CHAPTER = (c: number): string => t(`chapter.${(c % 6) + 1}` as 'chapter.1');
