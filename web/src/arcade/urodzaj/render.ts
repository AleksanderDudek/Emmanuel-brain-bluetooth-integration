/**
 * Urodzaj's view: the field at golden hour, the basket and its fruit, Feliks with the next fruit, the
 * rim that is the wind's gauge, the charge rising in the weave, the gleaners, the table, the circle of
 * fruits, the wheat that keeps the band's last 40 s — and the juice: squash and stretch, pops, flying
 * points, a rising pitch (audio.ts), hit-stop (sim.ts), the camera's shake, the wind's sway.  The
 * runner draws the Mendi panel and the score; this view draws neither.
 */
import { fmtNum } from '../../i18n';
import { clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import { layoutPassage, drawPassage, passage, wrapLines, type PassageLayout } from '../kit/scripture';
import { traceBars } from '../kit/trace';
import { DECORS, MAX_TIER, decorName, festName, festivalAt, fruit } from './content';
import { t } from './i18n';
import { UrodzajIntro } from './intro';
import { computeLayout, sx, sy, worldX, type Layout } from './layout';
import { decorCount, reached, type UrodzajProgress } from './meta';
import {
  C, FONT, SERIF, FruitSprites, TAU, glow, paintBasketBack, paintBasketFront, paintBubble, paintCard, paintField, paintFruit,
  paintGleanBasket, paintGleaner, paintRim, paintSilhouette, paintSparrow, paintStar, paintTable, paintWheatTrace, roundRect,
  type BasketPaint, type Face, type SparrowPose,
} from './paint';
import { BASKET, RULES } from './rules';
import type { HintAt, SimEvent, UrodzajSim } from './sim';

interface Pop { x: number; y: number; r: number; t: number; color: string }

export class UrodzajView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  L: Layout = computeLayout(1, 1, 0);
  private readonly sprites = new FruitSprites();
  private readonly parts = new Particles(500);
  private readonly floats = new Floaters();
  private readonly shake: Shake;
  private readonly introScene = new UrodzajIntro();
  private readonly pops: Pop[] = [];
  /** squash per body id: when it began and how hard */
  private readonly squash = new Map<number, { t: number; k: number }>();
  private clock = 0;
  private dangerA = 0;
  private windA = 0;
  private burst = 0;
  private gleanBend = 0;
  private flap = 0;
  private beat = 0;
  private feliksX = 0;
  private face = 1;
  private blinkT = 2;
  private verse: { id: string; layout: PassageLayout; w: number } | null = null;
  private poleT = -1;
  private poleAt = { x: 0, y: 0 };
  private mission: { text: string; t: number } | null = null;
  private chainWord: { n: number; t: number } | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, hudTop: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    this.L = computeLayout(this.w, this.h, hudTop);
    this.sprites.setScale(this.L.S, dpr);
    this.verse = null;
  }

  worldX(px: number): number { return worldX(this.L, px); }

  intro(dt: number, p: number, progress: UrodzajProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(this.ctx, this.w, this.h, dt, p, progress, this.sprites);
  }

  start(sim: UrodzajSim): void {
    this.feliksX = sx(this.L, sim.hangX);
  }

  /** Where a coach mark points (CSS px). */
  anchor(at: HintAt, x: number, y: number, sim: UrodzajSim): { x: number; y: number } {
    const L = this.L;
    switch (at) {
      case 'feliks': return { x: this.feliksX, y: sy(L, BASKET.hang) - L.S * 0.12 };
      case 'next': return { x: L.next.x, y: L.next.y - L.next.r };
      case 'ring': return { x: L.ring.x, y: L.ring.y - L.ring.r };
      case 'rim': return { x: L.cx, y: sy(L, BASKET.rim) - 8 };
      case 'gleaners': return { x: L.glean.x, y: L.glean.y - L.glean.s };
      default: return { x: sx(L, x), y: sy(L, y || sim.world.heapTop() * 0.6) };
    }
  }

  // ── events ──
  on(e: SimEvent, sim: UrodzajSim): void {
    const L = this.L;
    switch (e.type) {
      case 'drop':
        this.flap = 1;
        break;
      case 'land': {
        const body = sim.world.bodies.find(b => b.tier === e.tier && Math.abs(b.x - e.x) < 1e-6);
        if (body) this.squash.set(body.id, { t: this.clock, k: Math.min(0.22, e.speed * 0.08) });
        this.parts.burst(sx(L, e.x), sy(L, e.y - fruit(e.tier).r), 4, { color: '#e8d2a0', speed: 50, angle: -Math.PI / 2, spread: 2, life: 0.4, size: 2, g: 300 });
        break;
      }
      case 'merge': {
        const x = sx(L, e.x), y = sy(L, e.y), f = fruit(e.tier), R = f.r * L.S;
        const nb = sim.world.bodies[sim.world.bodies.length - 1];
        if (nb && nb.tier === e.tier) this.squash.set(nb.id, { t: this.clock, k: 0.28 });
        this.pops.push({ x, y, r: R, t: 0, color: f.light });
        this.parts.burst(x, y, 8 + e.tier * 2, { color: f.base, speed: 80 + e.tier * 18, life: 0.6, size: 2.5 + e.tier * 0.25, g: 220, shape: e.tier % 2 ? 'dot' : 'square' });
        this.parts.burst(x, y, 6, { color: '#fff4cc', speed: 120, life: 0.4, size: 2, shape: 'spark', g: 0 });
        this.floats.add(`+${fmtNum(e.pts)}`, x, y - R * 0.4, { color: e.link > 0 ? C.gold : '#fffaf0', size: Math.min(34, 16 + e.tier * 1.6 + e.link * 2) });
        if (e.link >= 1) this.chainWord = { n: e.link + 1, t: 0 };
        if (e.tier >= 7) this.shake.add(0.18 + (e.tier - 7) * 0.08);
        if (e.first) this.floats.add(t('world.new'), x, y - R - 22, { color: C.gold, size: 22, dur: 1.6 });
        break;
      }
      case 'pole':
        this.poleT = 0;
        this.poleAt = { x: sx(L, e.x), y: sy(L, e.y) };
        this.parts.burst(this.poleAt.x, this.poleAt.y, 40, { color: C.gold, speed: 260, life: 1, size: 3 });
        this.floats.add(`+${fmtNum(e.pts)}`, this.poleAt.x, this.poleAt.y, { color: C.gold, size: 36, dur: 1.6 });
        this.shake.add(0.5);
        break;
      case 'windUp':
        this.burst = 0.6;
        break;
      case 'wind':
        this.burst = 1;
        this.shake.add(0.25);
        this.floats.add(t('world.windGo'), L.cx, sy(L, BASKET.rim * 0.6), { color: C.gold, size: 30, dur: 1.6 });
        for (let i = 0; i < 30; i++) this.parts.burst(sx(L, -0.5 + (i / 30)), sy(L, BASKET.rim * (i % 5) / 5), 1, { color: '#fff1b8', speed: 220, angle: 0, spread: 0.4, life: 0.8, size: 2, shape: 'spark', g: 0 });
        break;
      case 'glean': {
        const x = sx(L, e.x), y = sy(L, e.y);
        this.floats.add(`+${fmtNum(e.pts)}`, x, y - 20, { color: C.cool, size: 18 });
        this.parts.burst(x, y, 6, { color: '#fff6e0', speed: 60, life: 0.5, size: 2 });
        break;
      }
      case 'reveal':
        this.floats.add(t('world.reveal', { n: Math.round(Math.min(1, e.charge) * 100) }), L.cx, sy(L, BASKET.rim) - 30, { color: C.gold, size: 20, dur: 2 });
        break;
      case 'basketEnd':
        this.shake.add(0.15);
        break;
      case 'mission': {
        const m = festivalAt(e.fest).missions[e.mission];
        if (m) this.mission = { text: t('world.mission'), t: 0 };
        break;
      }
      default: break;
    }
  }

  // ── the frame ──
  update(dt: number, sim: UrodzajSim): void {
    this.clock += dt;
    this.parts.update(dt);
    this.floats.update(dt);
    for (let i = this.pops.length - 1; i >= 0; i--) {
      this.pops[i].t += dt;
      if (this.pops[i].t > 0.45) this.pops.splice(i, 1);
    }
    for (const [id, s] of this.squash) if (this.clock - s.t > 0.6) this.squash.delete(id);
    this.dangerA += ((sim.danger ? 1 : 0) - this.dangerA) * Math.min(1, dt * 8);
    const windOn = sim.pushBlock && sim.sighted && sim.reliable ? clamp((sim.w - 0.5) * 2) : 0;
    this.windA += (windOn + (sim.wind ? 1 : 0) - this.windA) * Math.min(1, dt * 3);
    this.burst = Math.max(0, this.burst - dt * 0.8);
    this.gleanBend += ((sim.flights.length ? 1 : sim.gleaning ? 0.3 : 0) - this.gleanBend) * Math.min(1, dt * 5);
    // Feliks follows the aim, flapping when he moves
    const target = sx(this.L, sim.hangX);
    const moved = Math.abs(target - this.feliksX);
    if (moved > 1.5) this.face = target > this.feliksX ? 1 : -1;
    this.feliksX += (target - this.feliksX) * Math.min(1, dt * 22);
    this.flap = Math.max(0.25, Math.min(1, this.flap - dt * 1.5 + moved * 0.02));
    this.beat += dt * (8 + 16 * this.flap);
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + (Math.sin(this.clock * 7.3) + 1) * 1.5;
    if (this.poleT >= 0) this.poleT += dt;
    if (this.poleT > 2) this.poleT = -1;
    if (this.mission) {
      this.mission.t += dt;
      if (this.mission.t > 2.4) this.mission = null;
    }
    if (this.chainWord) {
      this.chainWord.t += dt;
      if (this.chainWord.t > 1.1) this.chainWord = null;
    }
  }

  draw(sim: UrodzajSim): void {
    const ctx = this.ctx, L = this.L, w = this.w, h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    paintField(ctx, w, h, L.ground, this.clock);
    // the band's last 40 s: wheat along the ground
    const nBars = Math.max(20, Math.min(60, Math.round(w / 16)));
    paintWheatTrace(ctx, traceBars(sim.trace, sim.t, nBars), 8, w - 8, L.ground + 2, Math.min(46, L.S * 0.13), this.clock);
    const decor = DECORS.slice(0, decorCount(sim.progress));
    if (L.table.on) paintTable(ctx, L.table.x, L.table.y, L.table.w, decor, sim.progress.baskets, this.clock);
    this.drawRing(sim);
    const off = this.shake.offset(1 / 60, 10);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawBaskets(sim);
    this.drawGleaners(sim);
    this.drawFeliks(sim);
    this.drawNext(sim);
    this.drawWind(sim);
    this.parts.draw(ctx);
    this.drawPops();
    this.floats.draw(ctx, FONT);
    this.drawChain();
    ctx.restore();
    this.drawTally(sim);
    this.drawFestival(sim);
    this.drawMission();
    this.drawTalk(sim);
    this.drawStory(sim);
  }

  // ── the basket ──
  private basketPaint(sim: UrodzajSim, dx: number): BasketPaint {
    const L = this.L;
    const veiled = sim.blind;
    return {
      x0: sx(L, -BASKET.half) + dx, x1: sx(L, BASKET.half) + dx, floor: L.floor, rim: sy(L, BASKET.rim),
      wall: Math.max(8, L.S * 0.045), charge: clamp(sim.charge), veiled, burst: Math.max(this.burst, sim.charge >= 0.85 && !veiled ? 0.3 + 0.3 * Math.sin(this.clock * 8) : 0),
      t: this.clock,
    };
  }

  private drawBaskets(sim: UrodzajSim): void {
    const ctx = this.ctx, L = this.L, c = sim.change;
    // the wind's sway (still with reduced motion)
    let sway = 0;
    if (sim.world.shaking && !this.opts.reducedMotion) sway = Math.sin(2 * Math.PI * RULES.shakeHz * sim.world.t) * L.S * 0.012;
    if (c && !c.final && c.t >= RULES.tally) {
      // the slide: the full basket to the table (or off to the right), the new one in from the left
      const k = ease.inOutSine(clamp((c.t - RULES.tally) / RULES.slide));
      const away = (L.table.on ? L.table.x + L.table.w * 0.5 - L.cx : this.w * 0.75) * k;
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.6;
      const bpOld = this.basketPaint(sim, away);
      paintBasketBack(ctx, { ...bpOld, charge: 0, burst: 0 });
      for (const s of c.snaps) paintFruit(ctx, this.sprites, s.tier, sx(L, s.x) + away, sy(L, s.y), s.r * L.S, -s.angle, 0, 'happy');
      paintBasketFront(ctx, bpOld);
      ctx.restore();
      const inX = -(1 - k) * this.w * 0.7;
      const bp = this.basketPaint(sim, inX);
      paintBasketBack(ctx, bp);
      paintBasketFront(ctx, bp);
      paintRim(ctx, bp, { wind: null, live: false, danger: 0, over: 0, waiting: false, t: this.clock });
      return;
    }
    const bp = this.basketPaint(sim, sway);
    paintBasketBack(ctx, bp);
    // golden tendrils between pairs the wind draws together
    for (const p of sim.pulls) {
      ctx.strokeStyle = 'rgba(255,214,94,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx(L, p.a.x) + sway, sy(L, p.a.y));
      ctx.quadraticCurveTo(sx(L, (p.a.x + p.b.x) / 2) + sway, sy(L, Math.max(p.a.y, p.b.y) + 0.06), sx(L, p.b.x) + sway, sy(L, p.b.y));
      ctx.stroke();
      glow(ctx, sx(L, p.a.x) + sway, sy(L, p.a.y), p.a.r * L.S * 1.4, 'rgba(255,214,94,', 0.35);
    }
    const now = sim.world.t;
    const worriedY = BASKET.rim - 0.3;
    const fruitOf = (b: (typeof sim.world.bodies)[number]) => {
      const sq = this.squashOf(b.id);
      const face: Face = now - b.born < 0.7 || sim.wind ? 'happy' : sim.danger && b.y > worriedY ? 'worried' : 'calm';
      paintFruit(ctx, this.sprites, b.tier, sx(L, b.x) + sway, sy(L, b.y), b.r * L.S, -b.angle, sq, face);
    };
    for (const b of sim.world.bodies) fruitOf(b);
    paintBasketFront(ctx, bp);
    const push = sim.pushBlock;
    paintRim(ctx, bp, {
      wind: push && sim.reliable && !sim.blind ? sim.w : null, live: push, danger: this.dangerA, over: sim.overT / RULES.overflowSec,
      waiting: push && !sim.blind && sim.blockT < sim.lead, t: this.clock,
    });
    // what rises over the rim is in front of it (a falling fruit, a heap that is too high)
    for (const b of sim.world.bodies) if (b.y > BASKET.rim) fruitOf(b);
    // the pole: two men's pole with the two clusters, carried up and away
    if (this.poleT >= 0) {
      const k = clamp(this.poleT / 2);
      const y = this.poleAt.y - k * L.S * 0.8, a = 1 - k;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#6b4424';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.poleAt.x - L.S * 0.4, y);
      ctx.lineTo(this.poleAt.x + L.S * 0.4, y);
      ctx.stroke();
      const R = fruit(MAX_TIER).r * L.S * 0.55;
      paintFruit(ctx, this.sprites, MAX_TIER, this.poleAt.x - L.S * 0.18, y + R, R, 0, 0, 'happy', a);
      paintFruit(ctx, this.sprites, MAX_TIER, this.poleAt.x + L.S * 0.18, y + R, R, 0, 0, 'happy', a);
      ctx.globalAlpha = 1;
    }
  }

  private squashOf(id: number): number {
    const s = this.squash.get(id);
    if (!s) return 0;
    const tt = this.clock - s.t;
    return s.k * Math.exp(-tt * 7) * Math.cos(tt * 24);
  }

  private drawPops(): void {
    const ctx = this.ctx;
    for (const p of this.pops) {
      const k = p.t / 0.45;
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + k * 0.7), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawChain(): void {
    const cw = this.chainWord;
    if (!cw || cw.n < 2) return;
    const ctx = this.ctx, L = this.L;
    const k = cw.t / 1.1;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.font = `800 ${Math.round(18 + Math.min(4, cw.n) * 3)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = L.cx, y = sy(L, BASKET.rim) + L.S * 0.2;
    ctx.fillStyle = 'rgba(58,36,18,.45)';
    ctx.fillText(t('world.chain', { n: cw.n }), x + 2, y + 2);
    ctx.fillStyle = C.gold;
    ctx.fillText(t('world.chain', { n: cw.n }), x, y);
    ctx.globalAlpha = 1;
  }

  // ── Feliks, the hanging fruit, the guide ──
  private drawFeliks(sim: UrodzajSim): void {
    const ctx = this.ctx, L = this.L;
    const hy = sy(L, BASKET.hang);
    const x = this.feliksX;
    // the twine across the top
    ctx.strokeStyle = 'rgba(122,90,58,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx(L, -BASKET.half) - L.S * 0.04, hy - L.S * 0.11);
    ctx.quadraticCurveTo(L.cx, hy - L.S * 0.08, sx(L, BASKET.half) + L.S * 0.04, hy - L.S * 0.11);
    ctx.stroke();
    const hanging = sim.open && sim.cooldown <= 0;
    const R = fruit(sim.cur).r * L.S;
    if (hanging && sim.phase !== 'done') {
      // the guide: a dotted line straight down to where it lands
      const land = sim.world.dropY(sim.hangX, fruit(sim.cur).r);
      ctx.setLineDash([4, 6]);
      ctx.lineCap = 'butt';
      for (const [c, lw] of [['rgba(58,36,18,.35)', 4], ['rgba(255,250,232,.9)', 2]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x, hy + R);
        ctx.lineTo(x, sy(L, land));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,250,232,.5)';
      ctx.beginPath();
      ctx.ellipse(x, sy(L, land - fruit(sim.cur).r), R * 0.8, Math.max(2, R * 0.18), 0, 0, TAU);
      ctx.fill();
      paintFruit(ctx, this.sprites, sim.cur, x, hy, R, Math.sin(this.clock * 2) * 0.08, 0, 'calm');
    } else if (sim.open || sim.change) {
      // the next one is coming: it grows into his feet
      const k = clamp(1 - sim.cooldown / RULES.cooldown);
      if (k > 0.2 && !sim.change) paintFruit(ctx, this.sprites, sim.cur, x, hy, R * ease.outBack(clamp((k - 0.2) / 0.8)), 0, 0, 'calm');
    }
    const pose: SparrowPose = {
      flip: this.face, flap: this.flap, beat: this.beat, strain: clamp((sim.cur - 2) / 3) * (hanging ? 1 : 0),
      talk: !!sim.talk.line, blink: this.blinkT < 0, scared: sim.danger, t: this.clock,
    };
    paintSparrow(ctx, x, hy - (hanging ? R * 0.85 : 0), Math.max(26, L.S * 0.13), pose);
  }

  private drawNext(sim: UrodzajSim): void {
    const ctx = this.ctx, n = this.L.next;
    ctx.fillStyle = 'rgba(255,246,224,.92)';
    ctx.strokeStyle = 'rgba(184,128,63,.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const f = fruit(sim.next);
    const R = Math.min(n.r * 0.7, f.r * this.L.S);
    paintFruit(ctx, this.sprites, sim.next, n.x, n.y + n.r * 0.08, R, 0, 0, 'calm');
    ctx.font = `700 ${Math.max(10, Math.round(n.r * 0.36))}px ${FONT}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('world.next'), n.x, n.y - n.r - 3);
  }

  // ── the wind's streaks ──
  private drawWind(sim: UrodzajSim): void {
    const a = this.windA;
    if (a <= 0.02) return;
    const ctx = this.ctx, L = this.L;
    const x0 = sx(L, -BASKET.half) - L.S * 0.3, x1 = sx(L, BASKET.half) + L.S * 0.3;
    ctx.strokeStyle = `rgba(255,248,220,${0.35 * Math.min(1, a)})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y = sy(L, BASKET.rim * (0.1 + (i / 9) * 1.05));
      const len = L.S * (0.18 + 0.12 * Math.sin(i * 2.1));
      const span = x1 - x0 + len;
      const x = x0 + ((this.clock * L.S * (0.9 + 0.6 * a) + i * 97) % span) - len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5, y - 6 * Math.sin(this.clock * 3 + i), x + len, y);
      ctx.stroke();
    }
    void sim;
  }

  // ── the gleaners ──
  private drawGleaners(sim: UrodzajSim): void {
    const ctx = this.ctx, g = this.L.glean;
    const active = sim.restBlock;
    const bend = this.gleanBend;
    paintGleaner(ctx, g.x - g.s * 0.28, g.y, g.s * 0.92, bend * 0.8 + Math.sin(this.clock * 1.3) * 0.05, '#8c6a3e', '#d9c9a3', 1);
    paintGleaner(ctx, g.x + g.s * 0.02, g.y, g.s * 0.84, bend + Math.sin(this.clock * 1.1 + 1) * 0.05, '#b5523b', '#efe4cc', 1);
    paintGleanBasket(ctx, g.x - g.s * 0.6, g.y, g.s, active && sim.reliable ? clamp(sim.glean) : null, sim.gleaned);
    if (active) {
      ctx.font = `700 ${Math.max(10, Math.round(g.s * 0.12))}px ${FONT}`;
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t('world.gleaners'), g.x - g.s * 0.3, g.y - g.s * 1.02);
    }
  }

  // ── the circle of fruits ──
  private drawRing(sim: UrodzajSim): void {
    const ctx = this.ctx, r = this.L.ring;
    const got = Math.max(reached(sim.progress), sim.topTier(), sim.firstEver && sim.drops > 0 ? 5 : 0);
    const top = sim.basket.top;
    if (r.strip) {
      const step = r.w / MAX_TIER, R = Math.min(r.r, step * 0.42);
      for (let i = 0; i < MAX_TIER; i++) {
        const x = r.x - r.w / 2 + (i + 0.5) * step;
        if (i + 1 <= got) paintFruit(ctx, this.sprites, i + 1, x, r.y, R, 0, 0, 'none');
        else paintSilhouette(ctx, i + 1, x, r.y, R);
        if (i + 1 === top) {
          ctx.strokeStyle = C.gold;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, r.y, R + 3, 0, TAU);
          ctx.stroke();
        }
      }
      return;
    }
    ctx.fillStyle = 'rgba(255,246,224,.55)';
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r * 1.22, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(122,90,58,.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.stroke();
    const iconR = Math.min(r.r * 0.26, 16);
    for (let i = 0; i < MAX_TIER; i++) {
      const a = -Math.PI / 2 + (i / MAX_TIER) * TAU;
      const x = r.x + Math.cos(a) * r.r, y = r.y + Math.sin(a) * r.r;
      const R = iconR * (0.6 + 0.4 * (i / (MAX_TIER - 1)));
      if (i + 1 <= got) paintFruit(ctx, this.sprites, i + 1, x, y, R, 0, 0, 'none');
      else paintSilhouette(ctx, i + 1, x, y, R);
      if (i + 1 === top) {
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, R + 4, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.font = `700 ${Math.max(10, Math.round(r.r * 0.17))}px ${FONT}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('world.ring'), r.x, r.y - r.r * 0.12);
    ctx.font = `800 ${Math.max(11, Math.round(r.r * 0.22))}px ${FONT}`;
    ctx.fillText(`${got}/${MAX_TIER}`, r.x, r.y + r.r * 0.16);
  }

  // ── cards ──
  private drawTally(sim: UrodzajSim): void {
    const c = sim.change;
    if (!c || c.t >= RULES.tally + 0.2) return;
    const ctx = this.ctx, L = this.L;
    const k = clamp(c.t / 0.3), out = c.final ? 1 : clamp((RULES.tally + 0.2 - c.t) / 0.3);
    const cw = Math.min(L.w - 32, 320), ch = Math.min(150, Math.max(110, L.h * 0.42));
    const x = L.cx - cw / 2, y = Math.max(8, Math.min(L.h - ch - 8, sy(L, BASKET.rim * 0.6) - ch / 2));
    ctx.save();
    ctx.translate(L.cx, y + ch / 2);
    const s = 0.85 + 0.15 * ease.outBack(k);
    ctx.scale(s, s);
    ctx.translate(-L.cx, -(y + ch / 2));
    paintCard(ctx, x, y, cw, ch, Math.min(k, out));
    ctx.globalAlpha = Math.min(k, out);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(c.final ? t('tally.final') : t('tally.title', { n: c.index }), L.cx, y + 24);
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = C.goldDeep;
    ctx.fillText(fmtNum(c.score), L.cx, y + ch * 0.4);
    for (let i = 0; i < 3; i++) paintStar(ctx, L.cx + (i - 1) * 34, y + ch * 0.64, 13, i < c.stars && c.t > 0.3 + i * 0.25);
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = C.ink;
    const line = this.tallyLine(sim);
    if (line) ctx.fillText(line, L.cx, y + ch - 20);
    ctx.restore();
  }

  private tallyLine(sim: UrodzajSim): string {
    const c = sim.change!;
    const best = sim.progress.bestBasket;
    if (c.score >= best && c.score > 0 && sim.progress.baskets > 1) return t('tally.record');
    const next = RULES.stars.find(s => s > c.score);
    if (next !== undefined && next - c.score <= Math.max(40, next * 0.2)) return t('tally.toStar', { n: next - c.score });
    if (best > c.score && best - c.score <= Math.max(60, best * 0.25)) return t('tally.toRecord', { n: best - c.score });
    return c.final ? '' : t('tally.next');
  }

  private drawFestival(sim: UrodzajSim): void {
    const st = sim.story;
    if (!st || st.kind !== 'fest') return;
    const ctx = this.ctx, L = this.L;
    const k = clamp(st.t / 0.3) * clamp((st.dur - st.t) / 0.4);
    const f = festivalAt(st.fest);
    const cw = Math.min(L.w - 32, 340), ch = 74;
    const x = L.cx - cw / 2, y = L.top + 8;
    paintCard(ctx, x, y, cw, ch, k);
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.goldDeep;
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText(t('story.fest.title', { fest: festName(f) }), L.cx, y + 26);
    ctx.fillStyle = C.ink;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(t('story.fest.text', { decor: decorName(f.decor) }), L.cx, y + 50);
    ctx.globalAlpha = 1;
  }

  private drawMission(): void {
    const m = this.mission;
    if (!m) return;
    const ctx = this.ctx, L = this.L;
    const a = clamp(m.t / 0.25) * clamp((2.4 - m.t) / 0.4);
    ctx.globalAlpha = a;
    ctx.font = `800 14px ${FONT}`;
    const tw = ctx.measureText(m.text).width + 24;
    const x = L.cx - tw / 2, y = sy(L, BASKET.rim) + 18;
    ctx.fillStyle = 'rgba(58,36,18,.78)';
    roundRect(ctx, x, y, tw, 26, 13);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text, L.cx, y + 13);
    ctx.globalAlpha = 1;
  }

  private drawTalk(sim: UrodzajSim): void {
    const line = sim.talk.line;
    if (!line) return;
    const ctx = this.ctx, L = this.L;
    const a = clamp(line.t / 0.15) * clamp((line.dur - line.t) / 0.25);
    ctx.font = `600 13px ${FONT}`;
    const maxW = Math.min(220, L.w * 0.5);
    const lines = wrapLines(ctx, line.text, maxW - 20);
    const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20);
    const fx = this.feliksX, fy = sy(L, BASKET.hang) - L.S * 0.14;
    const right = fx < L.cx;
    const gap = Math.max(34, L.S * 0.12 + 18);
    let x = right ? fx + gap : fx - gap - bw;
    x = Math.max(8, Math.min(L.w - 8 - bw, x));
    const bh = lines.length * 17 + 14;
    let y = fy - bh / 2;
    // below the runner's top bar (time, ? and pause) even where the basket rises between the panel and the score
    y = Math.max(Math.max(L.top + 4, 58), Math.min(L.h - bh - 8, y));
    paintBubble(ctx, lines, x, y, bw, 17, fx + (right ? 10 : -10), fy, a);
  }

  private drawStory(sim: UrodzajSim): void {
    const st = sim.story;
    if (!st || st.kind !== 'open') return;
    const ctx = this.ctx, L = this.L;
    const a = clamp(st.t / 0.35);
    ctx.fillStyle = `rgba(58,36,18,${0.35 * a})`;
    ctx.fillRect(0, 0, L.w, L.h);
    const cw = Math.min(L.w - 32, 460);
    const pad = 20;
    ctx.font = `500 14px ${FONT}`;
    const lines = wrapLines(ctx, t('story.open.text'), cw - pad * 2);
    if (!this.verse || this.verse.w !== cw) {
      const pv = passage('deu8.10');
      this.verse = { id: 'deu8.10', w: cw, layout: layoutPassage(ctx, pv, cw - pad * 2, 120, { max: 17, min: 11 }) };
    }
    const vh = this.verse.layout.height;
    const ch = 46 + lines.length * 20 + 14 + vh + 40;
    const x = L.cx - cw / 2, y = Math.max(L.top + 6, (L.h - ch) / 2);
    paintCard(ctx, x, y, cw, ch, a);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.goldDeep;
    ctx.font = `800 20px ${SERIF}`;
    ctx.fillText(t('story.open.title'), L.cx, y + 16);
    ctx.fillStyle = C.ink;
    ctx.font = `500 14px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, L.cx, y + 48 + i * 20));
    drawPassage(ctx, passage('deu8.10'), this.verse.layout, L.cx, y + 48 + lines.length * 20 + 10, { text: '#5a3818', ref: '#9a6a3c' });
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = 'rgba(58,36,18,.6)';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('story.tap'), L.cx, y + ch - 12);
    ctx.globalAlpha = 1;
  }
}
