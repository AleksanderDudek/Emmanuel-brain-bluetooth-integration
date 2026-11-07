/**
 * Źródła's picture: the valley seen from above (limestone with contour lines, cached per size), its
 * grid of dry earth, rocks, the spring's well-head with the sluice gate, the garden, the channel
 * stones as they are laid (they drop in), the water running through them stretch by stretch with
 * ripples that slow when the sluice holds, still waters glinting, the open end of the way pulsing
 * (coral when the water is close), Space's ghost, the gardens calm grows, the dispenser of five,
 * the spring's gauge, the reeds of the band's history, Kumka with her bubble, the story cards.
 * Juice: splashes on every filled cell, rings on loops, petals on blooms, a big splash and a shake
 * on a spill, a flying score, Kumka hops and cheers.
 *
 * The runner draws the standard HUD (the Mendi panel, the score corner) above the canvas; nothing
 * important is drawn above `hudTop`.
 */
import { fmtNum } from '../../i18n';
import { clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { traceBars } from '../kit/trace';
import { STATION_VERSE, psalmOf, stationName } from './content';
import { GARDEN, isPool, PIPE, ROCK, SPRING, type Kind } from './grid';
import { fmt, t } from './i18n';
import { cellCentre, computeLayout, type Box, type Layout } from './layout';
import {
  C, font, hash, paintBubble, paintContours, paintFrog, paintGardenEnd, paintGauge, paintGreen, paintPilgrim, paintPoolFill, paintReeds, paintRock,
  paintSpring, paintStone, paintWater, roundRect, rgba, SANS, SERIF, wayPoint, type FrogPose,
} from './paint';
import { RULES } from './rules';
import type { ZrodlaEvent, ZrodlaSim } from './sim';

const TAU = Math.PI * 2;

export class ZrodlaView {
  layout: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fx = new Particles(500);
  private readonly words = new Floaters();
  private readonly shake: Shake;
  private bg: HTMLCanvasElement | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private top = 0;
  private cols = 7;
  private rows = 5;
  private clock = 0;
  private qShift = 0;
  private flash = 0;
  private spillAt: { x: number; y: number; t: number } | null = null;
  private verse: { id: PassageId; lay: PassageLayout; w: number } | null = null;
  private readonly frog: FrogPose = { t: 0, blink: 0, talk: false, hop: 0, look: 0, cheer: false };
  private hopT = 9;
  private cheerT = 9;
  private blinkT = 2;
  private bubbleA = 0;
  private bubbleText = '';
  private gaugePop = 0;

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Źródła needs a 2D canvas');
    this.ctx = ctx;
    this.shake = new Shake(opts.reducedMotion);
    this.layout = computeLayout(1, 1, 0, 7, 5);
  }

  get context(): CanvasRenderingContext2D { return this.ctx; }
  get size(): { w: number; h: number; dpr: number; top: number } { return { w: this.w, h: this.h, dpr: this.dpr, top: this.top }; }

  resize(w: number, h: number, dpr: number, top: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.top = top;
    this.relayout();
    this.bg = null;
  }

  private relayout(): void {
    this.layout = computeLayout(this.w, this.h, this.top, this.cols, this.rows);
    this.verse = null;
  }

  /** The limestone valley with its contour lines, drawn once per size. */
  private background(): HTMLCanvasElement | null {
    if (this.bg) return this.bg;
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w * this.dpr));
    c.height = Math.max(1, Math.round(this.h * this.dpr));
    const g = c.getContext('2d');
    if (!g) return null;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, '#efe3c9');
    grad.addColorStop(1, '#dcc7a0');
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
    paintContours(g, this.w, this.h, 7, { scale: 140, levels: 9, color: '#9c8458', alpha: 0.28 });
    // a few olive trees and pilgrims along the edges
    for (let i = 0; i < 9; i++) {
      const x = hash(i * 3 + 1) * this.w, y = this.top + hash(i * 7 + 2) * (this.h - this.top);
      const b = this.layout.board;
      if (x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 40) continue;
      g.globalAlpha = 0.55;
      paintPilgrim(g, x, y, 5, i, i % 3 === 0);
    }
    g.globalAlpha = 1;
    this.bg = c;
    return c;
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: ZrodlaEvent, sim: ZrodlaSim): void {
    const L = this.layout, cs = L.cell;
    const at = (i: number) => cellCentre(L, i);
    switch (e.type) {
      case 'valley':
        if (e.spec.cols !== this.cols || e.spec.rows !== this.rows) {
          this.cols = e.spec.cols;
          this.rows = e.spec.rows;
          this.relayout();
          this.bg = null;
        }
        this.spillAt = null;
        break;
      case 'lay': {
        const p = at(e.cell);
        this.qShift = 1;
        this.fx.burst(p.x, p.y, e.replaced ? 10 : 5, { color: e.replaced ? '#a58a62' : '#efe2c6', size: 2.4, speed: e.replaced ? 160 : 80, life: 0.45, g: 260 });
        if (e.replaced) this.words.add(t('fx.swap'), p.x, p.y - cs * 0.3, { color: '#7a5a36', size: 15, dur: 0.8 });
        break;
      }
      case 'deny': {
        if (e.cell >= 0) {
          const p = at(e.cell);
          this.fx.burst(p.x, p.y, 4, { color: '#c98f7a', size: 2, speed: 60, life: 0.3, g: 0 });
        }
        break;
      }
      case 'flow': {
        const p = at(sim.valley.spring);
        this.words.add(t('fx.go'), p.x, p.y - cs * 0.5, { color: C.pool, size: 22 });
        this.fx.burst(p.x, p.y, 14, { color: C.foam, size: 2.6, speed: 120, life: 0.6, g: 120 });
        break;
      }
      case 'fill': {
        const p = at(e.seg.cell);
        this.fx.burst(p.x, p.y, e.fast ? 3 : 5, { color: C.foam, size: 2, speed: 70, life: 0.4, g: 160 });
        const col = e.fast ? '#ffd27a' : '#ffffff';
        this.words.add(`+${fmt(e.points)}`, p.x, p.y - cs * 0.15, { color: col, size: e.loop ? 22 : 15, dur: 0.8 });
        if (e.loop) {
          this.words.add(t('fx.loop'), p.x, p.y - cs * 0.6, { color: C.gold, size: 26 });
          this.fx.burst(p.x, p.y, 1, { shape: 'ring', color: C.gold, size: cs * 0.3, speed: 0, life: 0.6, g: 0 });
          this.fx.burst(p.x, p.y, 16, { color: C.gold, shape: 'spark', size: 2.5, speed: 200, life: 0.5, g: 0 });
          this.shake.add(0.2);
          this.cheer();
        }
        if (e.aqueduct) this.words.add(t('fx.aqueduct'), p.x, p.y - cs * 0.6, { color: C.rose, size: 18 });
        break;
      }
      case 'poolDone': {
        const p = at(e.cell);
        this.words.add(`${t('fx.pool')} +${fmt(e.points)}`, p.x, p.y - cs * 0.5, { color: C.pool, size: 20 });
        this.fx.burst(p.x, p.y, 1, { shape: 'ring', color: C.foam, size: cs * 0.35, speed: 0, life: 0.7, g: 0 });
        this.hop();
        break;
      }
      case 'goal': {
        const b = L.board;
        this.words.add(t('fx.goal'), b.x + b.w / 2, b.y + b.h * 0.12, { color: C.olive, size: 24 });
        this.hop();
        break;
      }
      case 'spill': {
        const from = at(e.from);
        const dx = [0, 1, 0, -1][(e.side + 2) % 4], dy = [-1, 0, 1, 0][(e.side + 2) % 4];
        const x = from.x + dx * cs * 0.55, y = from.y + dy * cs * 0.55;
        this.spillAt = { x, y, t: 0 };
        this.fx.burst(x, y, 22, { color: C.water, size: 3, speed: 170, life: 0.7, g: 240 });
        this.fx.burst(x, y, 12, { color: '#c9a873', size: 2.5, speed: 120, life: 0.6, g: 300 });
        this.words.add(t('fx.spill'), x, y - cs * 0.4, { color: '#9e6656', size: 20 });
        this.shake.add(0.35);
        break;
      }
      case 'garden': {
        const p = at(e.cell);
        this.words.add(t('fx.garden'), p.x, p.y - cs * 0.6, { color: C.olive, size: 28 });
        this.fx.burst(p.x, p.y, 26, { color: '#8fc46e', shape: 'square', size: 2.6, speed: 180, life: 0.9, g: 120 });
        this.flash = 0.6;
        this.cheer();
        break;
      }
      case 'valleyEnd':
        if (e.won) this.cheer();
        break;
      case 'fast': {
        const p = at(sim.valley.spring);
        this.words.add(t('fx.fast'), p.x, p.y - cs * 0.6, { color: '#e9a23b', size: 22 });
        break;
      }
      case 'still': {
        if (e.on) {
          const b = L.board;
          this.words.add(t('fx.still'), b.x + b.w / 2, b.y + b.h * 0.4, { color: C.pool, size: 30, dur: 1.6 });
          this.fx.burst(L.gauge.x, L.gauge.y, 20, { color: C.still, shape: 'spark', size: 2.5, speed: 160, life: 0.8, g: 0 });
          this.flash = 0.5;
          this.gaugePop = 1;
          this.cheer();
        }
        break;
      }
      case 'bloom': {
        const p = at(e.cell);
        this.fx.burst(p.x, p.y, 12, { color: [C.anemone, C.crocus, C.oleander][e.cell % 3], shape: 'square', size: 2.2, speed: 110, life: 0.8, g: 60 });
        this.words.add(`+${fmt(e.points)}`, p.x, p.y - cs * 0.2, { color: C.olive, size: 18 });
        break;
      }
      case 'reveal':
        this.words.add(t('fx.reveal', { n: e.sec }), L.gauge.x, L.gauge.y - L.gauge.r * 1.4, { color: '#7a5a36', size: 16, dur: 2.2 });
        break;
      default:
        break;
    }
  }

  private hop(): void { this.hopT = 0; }
  private cheer(): void { this.hopT = 0; this.cheerT = 0; }

  update(dt: number, sim: ZrodlaSim): void {
    this.clock += dt;
    this.fx.update(dt);
    this.words.update(dt);
    this.qShift = Math.max(0, this.qShift - dt / 0.18);
    this.flash = Math.max(0, this.flash - dt);
    this.gaugePop = Math.max(0, this.gaugePop - dt * 2);
    if (this.spillAt) this.spillAt.t += dt;
    // Kumka
    const f = this.frog;
    f.t = this.clock;
    this.hopT += dt;
    this.cheerT += dt;
    f.hop = this.hopT < 0.45 ? Math.sin((this.hopT / 0.45) * Math.PI) : 0;
    f.cheer = this.cheerT < 1.2;
    this.blinkT -= dt;
    if (this.blinkT < 0) this.blinkT = 2 + hash(Math.floor(this.clock)) * 3;
    f.blink = this.blinkT < 0.12 ? 1 : 0;
    const line = sim.talk.line;
    f.talk = !!line && line.t < line.dur - 0.3;
    if (line) {
      this.bubbleText = line.text;
      this.bubbleA = Math.min(1, this.bubbleA + dt * 6);
    } else this.bubbleA = Math.max(0, this.bubbleA - dt * 5);
    const w = sim.water;
    if (w) {
      const p = cellCentre(this.layout, w.cell);
      f.look = clamp((p.x - this.layout.frog.x) / 300, -1, 1);
    }
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: ZrodlaSim, idle: number): void {
    const ctx = this.ctx, L = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = this.background();
    if (bg) ctx.drawImage(bg, 0, 0, this.w, this.h);
    else {
      ctx.fillStyle = C.lime;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    const off = this.shake.offset(1 / 60, 8);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawBoard(sim, idle);
    paintReeds(ctx, traceBars(sim.trace, sim.t, Math.max(16, Math.min(70, Math.round(L.reeds.w / 8)))), L.reeds.x, L.reeds.y, L.reeds.w, L.reeds.h);
    if (sim.blind) {
      ctx.fillStyle = 'rgba(120,90,60,.55)';
      ctx.fillRect(L.reeds.x + L.reeds.w * 0.7, L.reeds.y, L.reeds.w * 0.3, L.reeds.h);
    }
    ctx.restore();
    this.drawQueue(sim);
    this.drawGauge(sim);
    this.drawFrog(sim);
    this.fx.draw(ctx);
    this.words.draw(ctx, SANS);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(L.board.x, L.board.y, L.board.w, L.board.h);
    }
    if (sim.story) this.drawStory(sim);
  }

  private drawBoard(sim: ZrodlaSim, idle: number): void {
    const ctx = this.ctx, L = this.layout, cs = L.cell, b = L.board, val = sim.valley;
    // the valley's frame and its dry earth
    ctx.fillStyle = 'rgba(90,64,40,.22)';
    ctx.beginPath();
    roundRect(ctx, b.x - 6, b.y - 4, b.w + 12, b.h + 12, 14);
    ctx.fill();
    ctx.fillStyle = '#e2cfa6';
    ctx.beginPath();
    roundRect(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 12);
    ctx.fill();
    for (let i = 0; i < val.n; i++) {
      const x = b.x + val.col(i) * cs, y = b.y + val.row(i) * cs;
      ctx.fillStyle = (val.col(i) + val.row(i)) % 2 ? '#d8c296' : '#dcc79c';
      ctx.fillRect(x, y, cs, cs);
      // cracks in the dry earth
      ctx.strokeStyle = 'rgba(150,120,80,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const hx = hash(i * 13 + 1);
      ctx.moveTo(x + cs * (0.2 + hx * 0.3), y + cs * 0.2);
      ctx.lineTo(x + cs * (0.4 + hx * 0.2), y + cs * 0.45);
      ctx.lineTo(x + cs * (0.3 + hx * 0.4), y + cs * 0.8);
      ctx.stroke();
    }
    // the gardens calm grew
    for (let i = 0; i < val.n; i++) {
      const c = val.cells[i];
      if (c.green > 0) paintGreen(ctx, b.x + val.col(i) * cs, b.y + val.row(i) * cs, cs, c.green, c.bloom, i * 7, this.clock);
    }
    // stones, rocks, the spring, the garden
    const now = sim.t;
    const running = sim.phase === 'flow';
    for (let i = 0; i < val.n; i++) {
      const c = val.cells[i];
      const x = b.x + val.col(i) * cs, y = b.y + val.row(i) * cs;
      if (c.type === ROCK) paintRock(ctx, x, y, cs, i + 3);
      else if (c.type === SPRING) {
        paintSpring(ctx, x, y, cs, c.dir, {
          t: this.clock, gate: sim.acting ? clamp((sim.sluice - 0.5) / 0.5) : 0, count: sim.phase === 'count' ? clamp(sim.countLeft / sim.countDur) : null,
          running, still: sim.still > 0, hidden: sim.blind,
        });
      } else if (c.type === GARDEN) paintGardenEnd(ctx, x, y, cs, c.dir, c.wet !== 0, this.clock);
      else if (c.type === PIPE && c.kind) {
        const age = now - c.laidAt;
        const k = c.fixed || age > 0.2 || age < 0 ? 1 : 1 + 0.25 * (1 - ease.outBack(clamp(age / 0.2)));
        ctx.save();
        if (k !== 1) {
          ctx.translate(x + cs / 2, y + cs / 2);
          ctx.scale(k, k);
          ctx.translate(-x - cs / 2, -y - cs / 2);
        }
        paintStone(ctx, x, y, cs, c.kind, c.aqueduct ? 'aqueduct' : 'laid', i * 5 + 1, c.oneway);
        ctx.restore();
      }
    }
    // the water
    const flow = sim.pace;
    const still = sim.still > 0;
    const color = still ? '#5fd0e0' : sim.acting && sim.sluice > 0.5 && !sim.blind ? mixWater(clamp((sim.sluice - 0.5) / 0.5)) : C.water;
    sim.segs.forEach((s, k) => {
      const last = k === sim.segs.length - 1;
      const u1 = last && sim.phase === 'flow' ? sim.prog : 1;
      const p = cellCentre(L, s.cell);
      const kind = val.cells[s.cell].kind as Kind | null;
      paintWater(ctx, p.x, p.y, cs, s.entry, s.exit, 0, u1, { t: this.clock, flow, still, color });
      if (isPool(kind) && s.entry >= 0) paintPoolFill(ctx, p.x, p.y, cs, last && sim.phase === 'flow' ? u1 : 1, this.clock);
      if (last && sim.phase === 'flow' && !still) {
        const [fx, fy] = wayPoint(s.entry, s.exit, cs, u1);
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath();
        ctx.arc(p.x + fx, p.y + fy, cs * (0.07 + 0.02 * Math.sin(this.clock * 12)), 0, TAU);
        ctx.fill();
      }
    });
    if (still) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (const s of sim.segs) {
        const p = cellCentre(L, s.cell);
        const k = (Math.sin(this.clock * 5 + s.cell) + 1) / 2;
        ctx.globalAlpha = k;
        ctx.beginPath();
        ctx.arc(p.x + (hash(s.cell) - 0.5) * cs * 0.3, p.y + (hash(s.cell * 3) - 0.5) * cs * 0.3, 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // the way's open end: a pulsing ring (coral when the water is close)
    const end = sim.wayEnd;
    if (sim.phase !== 'over' && end.cell >= 0 && end.kind !== 'garden') {
      const p = cellCentre(L, end.cell);
      const near = sim.phase === 'flow' && sim.lead2end < 1.6;
      const k = 0.5 + 0.5 * Math.sin(this.clock * (near ? 10 : 4));
      ctx.strokeStyle = near ? rgba('#e0604a', 0.5 + 0.4 * k) : rgba('#f4c76b', 0.35 + 0.3 * k);
      ctx.lineWidth = near ? 3 : 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      roundRect(ctx, p.x - cs * 0.44, p.y - cs * 0.44, cs * 0.88, cs * 0.88, cs * 0.16);
      ctx.stroke();
      ctx.setLineDash([]);
      // an arrow from the side the water will come in by
      const [ax, ay] = wayPoint(end.side, (end.side + 2) % 4, cs, 0.18);
      ctx.fillStyle = near ? '#e0604a' : 'rgba(47,179,196,.7)';
      ctx.beginPath();
      ctx.arc(p.x + ax, p.y + ay, cs * 0.06, 0, TAU);
      ctx.fill();
    }
    // Space's ghost (after a pause, or always in the first valleys)
    if (!sim.story && sim.phase !== 'over' && !sim.wayDone && (idle > 2.2 || sim.v < 2)) {
      const spot = sim.autoSpot();
      if (spot >= 0) {
        const x = b.x + val.col(spot) * cs, y = b.y + val.row(spot) * cs;
        ctx.save();
        ctx.globalAlpha = 0.28 + 0.14 * Math.sin(this.clock * 4);
        paintStone(ctx, x, y, cs, sim.queue[0], 'ghost', 1);
        ctx.restore();
      }
    }
    // the keyboard's cursor
    if (sim.cursor >= 0) {
      const x = b.x + val.col(sim.cursor) * cs, y = b.y + val.row(sim.cursor) * cs;
      ctx.strokeStyle = C.pool;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, x + 2, y + 2, cs - 4, cs - 4, 8);
      ctx.stroke();
    }
    // the puddle of a spill
    if (this.spillAt && sim.phase === 'over') {
      const k = clamp(this.spillAt.t / 0.6);
      ctx.fillStyle = rgba(C.water, 0.45 * (1 - clamp((this.spillAt.t - 1.5) / 1.5)));
      ctx.beginPath();
      ctx.ellipse(this.spillAt.x, this.spillAt.y, cs * 0.45 * ease.outCubic(k), cs * 0.3 * ease.outCubic(k), 0, 0, TAU);
      ctx.fill();
    }
  }

  private drawQueue(sim: ZrodlaSim): void {
    const ctx = this.ctx, L = this.layout;
    const q = L.queue;
    ctx.save();
    ctx.fillStyle = 'rgba(255,250,236,.72)';
    ctx.beginPath();
    roundRect(ctx, q.x, q.y, q.w, q.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,116,80,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    const s0 = L.slots[0];
    const step = L.portrait ? (L.slots[1].x - s0.x) : (L.slots[1].y - s0.y);
    sim.queue.forEach((k, i) => {
      const s = L.slots[i];
      if (!s) return;
      const off = this.qShift * (i === 0 ? step * 0.6 : (L.portrait ? L.slots[1].w + 6 : L.slots[1].h + 6));
      const x = L.portrait ? s.x + off : s.x, y = L.portrait ? s.y : s.y + off;
      if (i === 0) {
        ctx.fillStyle = 'rgba(244,199,107,.35)';
        ctx.beginPath();
        roundRect(ctx, x - 4, y - 4, s.w + 8, s.h + 8, 12);
        ctx.fill();
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.globalAlpha = i === 0 ? 1 : 0.92 - i * 0.08;
      paintStone(ctx, x, y, s.w, k, 'queue', i + 1);
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 12, SANS);
    ctx.textBaseline = 'bottom';
    ctx.textAlign = L.portrait ? 'left' : 'center';
    if (L.portrait) ctx.fillText(t('g.next'), s0.x, s0.y - 6);
    else ctx.fillText(t('g.next'), s0.x + s0.w / 2, s0.y - 7);
    ctx.restore();
  }

  private drawGauge(sim: ZrodlaSim): void {
    const ctx = this.ctx, L = this.layout, g = L.gauge;
    const rest = sim.restBlock;
    const pace = sim.pace;
    const r = g.r * (1 + 0.08 * ease.outCubic(this.gaugePop));
    paintGauge(ctx, g.x, g.y, r, {
      value: sim.sighted && sim.reliable ? sim.sluice : null,
      charge: sim.blind ? 0 : sim.charge,
      still: sim.still,
      count: sim.phase === 'count' && !sim.story ? sim.countLeft : null,
      green: rest ? sim.calmShown : null,
      hidden: sim.blind,
      label: rest ? t('g.green') : t('g.sluice'),
      thr: t('g.threshold'),
      sub: sim.blind ? t('g.hidden') : sim.still > 0 ? t('g.still') : `×${fmtNum(pace, 1)}`,
      t: this.clock,
    });
    // the goal under the gauge (landscape) or beside the dispenser (portrait), and what Space does
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const goal = sim.spec.goal, have = sim.cells + (sim.phase === 'over' ? 0 : 0);
    const label = `${t('g.goal')} ${Math.min(have, 999)}/${goal}`;
    const space = sim.wayDone ? t('g.fast') : t('g.help');
    if (!L.portrait) {
      const y = g.y + g.r * 1.42 + 6;
      ctx.fillStyle = sim.cells >= goal ? C.olive : C.ink;
      ctx.font = font(800, 15, SANS);
      ctx.fillText(label, g.x, y);
      this.drops(g.x, y + 22, Math.min(1, sim.cells / goal), Math.min(1, (sim.cells + sim.ahead.length) / goal), Math.min(160, g.r * 2.2));
      ctx.fillStyle = C.inkSoft;
      ctx.font = font(600, 12, SANS);
      ctx.fillText(space, g.x, y + 36);
    } else {
      const q = L.queue;
      ctx.textAlign = 'left';
      ctx.fillStyle = sim.cells >= goal ? C.olive : C.ink;
      ctx.font = font(800, 13, SANS);
      const s0 = L.slots[0];
      ctx.fillText(label, L.slots[1].x, s0.y - 18);
      this.drops(L.slots[1].x + (q.w - (L.slots[1].x - q.x)) / 2 - 10, s0.y + s0.h + 4, Math.min(1, sim.cells / goal), Math.min(1, (sim.cells + sim.ahead.length) / goal), Math.max(60, q.w - (L.slots[1].x - q.x) - 20));
    }
    ctx.restore();
  }

  /** The goal's bar: water so far, the way laid ahead (faint), the rest dry. */
  private drops(cx: number, y: number, wet: number, laid: number, w: number): void {
    const ctx = this.ctx, x = cx - w / 2, h = 7;
    ctx.fillStyle = 'rgba(120,100,70,.25)';
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 3.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(47,179,196,.35)';
    ctx.beginPath();
    roundRect(ctx, x, y, w * laid, h, 3.5);
    ctx.fill();
    ctx.fillStyle = C.water;
    ctx.beginPath();
    roundRect(ctx, x, y, w * wet, h, 3.5);
    ctx.fill();
  }

  private drawFrog(sim: ZrodlaSim): void {
    const ctx = this.ctx, L = this.layout, f = L.frog;
    const shown = f.s >= 26;
    if (shown) paintFrog(ctx, f.x, f.y, f.s, this.frog);
    if (this.bubbleA > 0.01 && this.bubbleText) {
      const right = this.w - (L.board.x + L.board.w) - 16;
      const maxW = L.portrait ? Math.min(this.w - 20, 300) : Math.max(170, Math.min(300, right));
      const ty = shown ? f.y - f.s * 0.95 : L.gauge.y + L.gauge.r * 1.3;
      paintBubble(ctx, this.bubbleText, f.x, ty, maxW, this.w, this.bubbleA, shown);
    }
    void sim;
  }

  // ── the cards ───────────────────────────────────────────────────
  private drawStory(sim: ZrodlaSim): void {
    const s = sim.story!;
    const ctx = this.ctx, L = this.layout;
    const k = ease.outCubic(clamp(s.t / 0.3));
    const out = s.dur - s.t < 0.25 ? clamp((s.dur - s.t) / 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = k * out;
    ctx.fillStyle = 'rgba(40,30,20,.35)';
    ctx.fillRect(0, this.top, this.w, this.h - this.top);
    const cw = Math.min(L.portrait ? this.w - 24 : 460, this.w - 24);
    const ch = s.kind === 'open' ? Math.min(380, this.h - this.top - 24) : s.kind === 'station' ? Math.min(330, this.h - this.top - 24) : 220;
    const cx = this.w / 2 - cw / 2;
    const cy = Math.max(this.top + 10, L.board.y + L.board.h / 2 - ch / 2) + (1 - k) * 20;
    const box: Box = { x: cx, y: cy, w: cw, h: ch };
    ctx.fillStyle = '#fbf4e2';
    ctx.beginPath();
    roundRect(ctx, box.x, box.y, box.w, box.h, 18);
    ctx.fill();
    ctx.strokeStyle = s.kind === 'spill' ? '#c9a873' : C.water;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const mid = box.x + box.w / 2;
    let y = box.y + 18;
    const title = (text: string, size = 24) => {
      ctx.fillStyle = C.ink;
      ctx.font = font(700, size, SERIF);
      ctx.fillText(text, mid, y, box.w - 30);
      y += size + 10;
    };
    const line = (text: string, size = 15, color: string = C.ink, weight = 600) => {
      ctx.fillStyle = color;
      ctx.font = font(weight, size, SANS);
      ctx.fillText(text, mid, y, box.w - 30);
      y += size + 8;
    };
    switch (s.kind) {
      case 'open': {
        title(t('card.open.title'));
        ctx.font = font(500, 15, SANS);
        ctx.fillStyle = C.ink;
        for (const l of wrap(ctx, t('card.open.text'), box.w - 40)) { ctx.fillText(l, mid, y); y += 21; }
        y += 6;
        this.passage(ctx, 'psa84.5-6', mid, y, box.w - 40, box.y + box.h - y - 34);
        break;
      }
      case 'tally': {
        title(t('card.tally.title', { n: s.v + 1 }));
        this.stars(mid, y + 18, s.stars, s.t);
        y += 44;
        line(`${t('card.cells', { n: s.cells })} · ${t('card.goal', { n: s.goal })}`);
        const extra: string[] = [];
        if (s.loops) extra.push(t('card.loops', { n: s.loops }));
        if (s.blooms) extra.push(t('card.blooms', { n: s.blooms }));
        if (extra.length) line(extra.join(' · '), 14, C.inkSoft);
        line(t('card.points', { n: `+${fmt(s.points)}` }), 17, C.pool, 800);
        break;
      }
      case 'spill': {
        title(t('card.spill.title'));
        line(s.short > 0 ? t('card.spill.short', { n: s.short }) : t('card.spill.garden'), 17, '#9e6656', 800);
        line(`${t('card.cells', { n: s.cells })} · ${t('card.goal', { n: s.goal })}`, 14, C.inkSoft);
        y += 6;
        line(t('card.again'), 15, C.olive, 700);
        break;
      }
      case 'station': {
        title(t('card.station.title', { n: s.station + 1, name: stationName(s.station) }), 22);
        line(t('card.station.psalm', { n: psalmOf(s.station) }), 14, C.inkSoft);
        const id = STATION_VERSE[s.station];
        if (id) this.passage(ctx, id, mid, y + 4, box.w - 40, box.y + box.h - y - 40);
        else {
          ctx.font = font(500, 15, SANS);
          ctx.fillStyle = C.ink;
          for (const l of wrap(ctx, t('card.station.line'), box.w - 40)) { y += 4; ctx.fillText(l, mid, y); y += 18; }
        }
        break;
      }
    }
    if (s.t >= RULES.cardMin) {
      ctx.fillStyle = C.inkSoft;
      ctx.font = font(600, 12, SANS);
      ctx.textBaseline = 'bottom';
      ctx.fillText(t('card.tap'), mid, box.y + box.h - 10);
    }
    ctx.restore();
  }

  private passage(ctx: CanvasRenderingContext2D, id: PassageId, cx: number, top: number, w: number, h: number): void {
    if (h < 30) return;
    if (!this.verse || this.verse.id !== id || this.verse.w !== w) {
      this.verse = { id, w, lay: layoutPassage(ctx, passage(id), w, h, { max: 17, min: 11 }) };
    }
    drawPassage(ctx, passage(id), this.verse.lay, cx, top, { text: '#3c3424', ref: '#7a6a4a' });
  }

  private stars(cx: number, cy: number, n: number, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const on = i < n;
      const k = on ? ease.outBack(clamp((t - 0.25 - i * 0.18) / 0.3)) : 1;
      const x = cx + (i - 1) * 40, y = cy + (i === 1 ? -6 : 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.fillStyle = on ? C.gold : 'rgba(140,116,80,.3)';
      ctx.strokeStyle = on ? '#b98e3a' : 'rgba(140,116,80,.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const a = -Math.PI / 2 + (j / 10) * TAU, r = j % 2 ? 7 : 16;
        if (j) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Water under a closed sluice: deeper and calmer. */
function mixWater(k: number): string {
  const a = [47, 179, 196], b = [28, 110, 150];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k * 0.7)).join(',')})`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const nx = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(nx).width > maxW) { out.push(line); line = w; } else line = nx;
  }
  if (line) out.push(line);
  return out;
}
