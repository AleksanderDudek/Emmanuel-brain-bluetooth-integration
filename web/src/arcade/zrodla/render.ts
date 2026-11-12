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
 * The runner draws the standard HUD (the Mendi panel, the score corner) above the canvas; nothing the
 * player taps or reads is drawn under it (layout.ts lays everything out phone first).  Where the valley is
 * bigger than its window (an eight-wide valley on a 360 px phone) the camera pans it: it keeps the way's open
 * end and the water's head in sight, holds still under a finger, and a finger aiming at the window's edge
 * nudges it on.  A finger on a cell shows the next stone there (and, on a touch screen, lifted over the
 * finger) before the lift lays it.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import { MIN_READ, MIN_TAP, NO_INSETS, fitText, target } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { drawPassage, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { traceBars } from '../kit/trace';
import { STATION_VERSE, psalmOf, stationName } from './content';
import { GARDEN, isPool, PIPE, ROCK, SPRING, type Kind } from './grid';
import { fmt, t } from './i18n';
import { cellBox, cellCentre, computeLayout, type Box, type Layout } from './layout';
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
  private ins: Insets = NO_INSETS;
  private cols = 7;
  private rows = 5;
  /** the camera: how far the valley is panned in its window (px) */
  private camX = 0;
  private camY = 0;
  /** the cell a finger aims at (−1: none), and whether a finger is down on the valley (the camera holds) */
  aim = -1;
  holding = false;
  /** the finger's point while it aims (for the nudge at the window's edge) */
  aimAt: { x: number; y: number } | null = null;
  /** the next stone or the dial held down (pressed), and their shake when a tap could do nothing */
  pressed: 'next' | 'dial' | null = null;
  /** the primary input is a finger: the aimed stone is drawn over the finger too */
  touch = false;
  /** where Kumka's bubble went this frame */
  private bubbleBox: Box | null = null;
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
    this.layout = computeLayout(1, 1, NO_INSETS, 7, 5);
  }

  get context(): CanvasRenderingContext2D { return this.ctx; }
  get size(): { w: number; h: number; dpr: number; top: number } { return { w: this.w, h: this.h, dpr: this.dpr, top: this.ins.top }; }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.ins = ins;
    this.relayout();
    this.bg = null;
  }

  /** The runner's insets settled (the HUD band is measured once play begins): lay out again. */
  setInsets(ins: Insets): void {
    this.ins = ins;
    this.relayout();
    this.bg = null;
  }

  private relayout(): void {
    this.layout = computeLayout(this.w, this.h, this.ins, this.cols, this.rows);
    this.verse = null;
    this.camX = clamp(this.camX, 0, this.layout.panX);
    this.camY = clamp(this.camY, 0, this.layout.panY);
    this.place();
  }

  /** The whole valley under its window at the camera's pan. */
  private place(): void {
    const L = this.layout;
    L.board.x = L.view.x - this.camX;
    L.board.y = L.view.y - this.camY;
  }

  /**
   * The camera: where the valley is bigger than its window (by less than a cell each way), it rests at either
   * end of each pan, so the window always shows whole cells, and goes to the end that shows the way's open end
   * (the next stone's place; else the water's head, the keyboard's cursor, the spring).  Under a finger it
   * holds still, except that a finger aiming at the window's edge nudges it on; let go, it settles at an end.
   */
  private follow(dt: number, sim: ZrodlaSim): void {
    const L = this.layout, cs = L.cell, v = L.view;
    if (L.panX <= 0 && L.panY <= 0) {
      this.camX = this.camY = 0;
      this.place();
      return;
    }
    if (this.holding) {
      const a = this.aimAt;
      if (a) {
        const edge = cs * 0.5, step = 160 * dt;
        if (a.x < v.x + edge) this.camX -= step;
        else if (a.x > v.x + v.w - edge) this.camX += step;
        if (a.y < v.y + edge) this.camY -= step;
        else if (a.y > v.y + v.h - edge) this.camY += step;
      }
    } else {
      const val = sim.valley, keep: number[] = [];
      const w = sim.water;
      if (w) keep.push(w.cell);
      if (sim.cursor >= 0) keep.push(sim.cursor);
      if (sim.wayEnd.cell >= 0) keep.push(sim.wayEnd.cell);
      else if (!w) keep.push(val.spring);
      // the nearer end, unless a cell to keep is cut at it (the last one asked wins)
      let tx = this.camX < L.panX / 2 ? 0 : L.panX, ty = this.camY < L.panY / 2 ? 0 : L.panY;
      for (const i of keep) {
        const x0 = val.col(i) * cs, y0 = val.row(i) * cs;
        if (x0 < tx) tx = 0;
        else if (x0 + cs > tx + v.w) tx = L.panX;
        if (y0 < ty) ty = 0;
        else if (y0 + cs > ty + v.h) ty = L.panY;
      }
      this.camX = approach(this.camX, tx, dt, 0.1);
      this.camY = approach(this.camY, ty, dt, 0.1);
      if (Math.abs(this.camX - tx) < 0.5) this.camX = tx;
      if (Math.abs(this.camY - ty) < 0.5) this.camY = ty;
    }
    this.camX = clamp(this.camX, 0, L.panX);
    this.camY = clamp(this.camY, 0, L.panY);
    this.place();
  }

  /**
   * What the player can tap now: on a story card the card; else every cell a stone can go on that the window
   * shows whole enough (a finger-sized part of it), the next stone (Kumka's help) and the spring's dial.
   */
  targets(sim: ZrodlaSim): TapTarget[] {
    const L = this.layout;
    if (sim.story) return [{ label: 'story', ...this.storyBox(sim) }];
    const out: TapTarget[] = [];
    if (sim.phase !== 'over' && !sim.ended) {
      const val = sim.valley;
      for (let i = 0; i < val.n; i++) {
        if (!val.canLay(i)) continue;
        const b = cellBox(L, i).shown;
        if (b && b.w >= MIN_TAP - 0.5 && b.h >= MIN_TAP - 0.5) out.push({ label: `cell ${val.col(i)},${val.row(i)}`, ...b });
      }
    }
    out.push(target(t('g.next'), L.next), target(sim.restBlock ? t('g.green') : t('g.sluice'), L.dial));
    return out;
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
      const x = hash(i * 3 + 1) * this.w, y = this.ins.top + hash(i * 7 + 2) * (this.h - this.ins.top);
      const b = this.layout.view;
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
        {
          // the camera starts at the ends nearer the spring
          const L = this.layout, sp = sim.valley.spring;
          this.camX = sim.valley.col(sp) * 2 + 1 > sim.valley.cols ? L.panX : 0;
          this.camY = sim.valley.row(sp) * 2 + 1 > sim.valley.rows ? L.panY : 0;
          this.place();
        }
        this.spillAt = null;
        this.aim = -1;
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
        const b = L.view;
        this.words.add(t('fx.goal'), b.x + b.w / 2, b.y + b.h * 0.12 + 14, { color: C.olive, size: 24 });
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
          const b = L.view;
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
    this.follow(dt, sim);
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
      ctx.fillRect(L.view.x, L.view.y, L.view.w, L.view.h);
    }
    if (sim.story) this.drawStory(sim);
  }

  private drawBoard(sim: ZrodlaSim, idle: number): void {
    const ctx = this.ctx, L = this.layout, cs = L.cell, b = L.board, v = L.view, val = sim.valley;
    // the valley's frame (around its window) and its dry earth; the valley is clipped to the window
    ctx.fillStyle = 'rgba(90,64,40,.22)';
    ctx.beginPath();
    roundRect(ctx, v.x - 6, v.y - 4, v.w + 12, v.h + 12, 14);
    ctx.fill();
    ctx.fillStyle = '#e2cfa6';
    ctx.beginPath();
    roundRect(ctx, v.x - 5, v.y - 5, v.w + 10, v.h + 10, 12);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, v.h);
    ctx.clip();
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
    // the aim: the next stone shown in the cell under a finger, before the lift lays it
    const aiming = this.aim >= 0 && !sim.story && sim.phase !== 'over';
    if (aiming) {
      const box = cellBox(L, this.aim).full, ok = val.canLay(this.aim);
      ctx.save();
      ctx.globalAlpha = ok ? 0.62 : 0.28;
      paintStone(ctx, box.x, box.y, cs, sim.queue[0], 'ghost', 1);
      ctx.restore();
      ctx.strokeStyle = ok ? C.gold : C.rose;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, box.x + 2, box.y + 2, cs - 4, cs - 4, 8);
      ctx.stroke();
    }
    ctx.restore();
    // where the valley goes on past its window: a small arrow on the frame
    if (L.panX > 0 || L.panY > 0) {
      ctx.fillStyle = 'rgba(90,64,40,.55)';
      const arrow = (x: number, y: number, a: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(-3, -6);
        ctx.lineTo(-3, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
      if (this.camX > 1) arrow(v.x - 2.5, v.y + v.h / 2, Math.PI);
      if (this.camX < L.panX - 1) arrow(v.x + v.w + 2.5, v.y + v.h / 2, 0);
      if (this.camY > 1) arrow(v.x + v.w / 2, v.y - 2, -Math.PI / 2);
      if (this.camY < L.panY - 1) arrow(v.x + v.w / 2, v.y + v.h + 3, Math.PI / 2);
    }
    // on a touch screen the aimed stone also floats over the finger (the finger hides the cell)
    if (aiming && this.touch) {
      const box = cellBox(L, this.aim).full, sz = Math.round(cs * 0.86);
      const x = clamp(box.x + cs / 2 - sz / 2, 4, this.w - sz - 4);
      let y = box.y - sz - cs * 0.42;
      if (y < L.top + 4) y = box.y + cs * 0.5 - sz / 2;
      const side = y === box.y + cs * 0.5 - sz / 2;
      const xx = side ? (box.x + cs + sz + 10 < this.w ? box.x + cs + 10 : box.x - sz - 10) : x;
      ctx.save();
      ctx.fillStyle = 'rgba(40,30,20,.22)';
      ctx.beginPath();
      roundRect(ctx, xx + 3, y + 5, sz, sz, sz * 0.18);
      ctx.fill();
      paintStone(ctx, xx, y, sz, sim.queue[0], 'queue', 1);
      ctx.strokeStyle = val.canLay(this.aim) ? C.gold : C.rose;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      roundRect(ctx, xx - 2, y - 2, sz + 4, sz + 4, sz * 0.2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * The dispenser: its plate, the next stone in a gold frame (pressed while a finger holds it: a tap on it is
   * Kumka's help) and the four after it; they slide one place on when a stone is laid.  Its word over it.
   */
  private drawQueue(sim: ZrodlaSim): void {
    const ctx = this.ctx, L = this.layout, q = L.queue, u = L.u;
    ctx.save();
    ctx.fillStyle = 'rgba(255,250,236,.78)';
    ctx.beginPath();
    roundRect(ctx, q.x, q.y, q.w, q.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,116,80,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const n = L.slots.length;
    sim.queue.forEach((k, i) => {
      const s = L.slots[i];
      if (!s) return;
      // where this stone came from: the slot after it (the last one from past the end)
      const from = L.slots[i + 1] ?? { x: s.x + (s.x - L.slots[n - 2].x), y: s.y + (s.y - L.slots[n - 2].y) };
      const x = s.x + (from.x - s.x) * this.qShift, y = s.y + (from.y - s.y) * this.qShift;
      if (i === 0) {
        const pr = this.pressed === 'next';
        ctx.fillStyle = pr ? 'rgba(244,199,107,.6)' : 'rgba(244,199,107,.35)';
        ctx.beginPath();
        roundRect(ctx, s.x - 4, s.y - 4, s.w + 8, s.h + 8, 12);
        ctx.fill();
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = pr ? 3.5 : 2.5;
        ctx.stroke();
        if (pr) {
          ctx.save();
          ctx.translate(x + s.w / 2, y + s.h / 2);
          ctx.scale(0.92, 0.92);
          ctx.translate(-(x + s.w / 2), -(y + s.h / 2));
          paintStone(ctx, x, y, s.w, k, 'queue', 1);
          ctx.restore();
          return;
        }
      }
      ctx.globalAlpha = i === 0 ? 1 : 0.92 - i * 0.08;
      paintStone(ctx, x, y, s.w, k, 'queue', i + 1);
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const word = fitText(ctx, t('g.next'), Math.max(L.slots[0].w + 24 * u, 70 * u), 13.5 * Math.min(u, 1.15), 800, SANS, MIN_READ);
    ctx.fillText(word, L.nextLabel.x, L.nextLabel.y);
    ctx.restore();
  }

  private drawGauge(sim: ZrodlaSim): void {
    const ctx = this.ctx, L = this.layout, g = L.gauge, u = L.u;
    const rest = sim.restBlock;
    const pace = sim.pace;
    const r = g.r * (1 + 0.08 * ease.outCubic(this.gaugePop)) * (this.pressed === 'dial' ? 0.93 : 1);
    paintGauge(ctx, g.x, g.y, r, {
      value: sim.sighted && sim.reliable ? sim.sluice : null,
      charge: sim.blind ? 0 : sim.charge,
      still: sim.still,
      count: sim.phase === 'count' && !sim.story ? sim.countLeft : null,
      green: rest ? sim.calmShown : null,
      hidden: sim.blind,
      label: L.dialLabel ? (rest ? t('g.green') : t('g.sluice')) : '',
      thr: t('g.threshold'),
      sub: sim.blind ? t('g.hidden') : sim.still > 0 ? t('g.still') : `×${fmtNum(pace, 1)}`,
      t: this.clock,
    });
    // the goal ("Cel 3/6") with its bar: water so far, the way laid ahead
    ctx.save();
    const goal = sim.spec.goal, G = L.goal;
    const label = `${t('g.goal')} ${Math.min(sim.cells, 999)}/${goal}`;
    const size = (L.portrait ? 14 : 15) * Math.min(u, 1.15);
    ctx.textBaseline = 'middle';
    ctx.textAlign = G.align;
    ctx.fillStyle = sim.cells >= goal ? C.olive : C.ink;
    ctx.fillText(fitText(ctx, label, G.w, size, 800, SANS, MIN_READ), G.x, G.y);
    const wet = Math.min(1, sim.cells / goal), laid = Math.min(1, (sim.cells + sim.ahead.length) / goal);
    this.drops(G.align === 'right' ? G.x - G.w / 2 : G.x, G.y + size * 0.6 + 4 * u, wet, laid, G.w);
    // what a tap on the stone (or Space) does now: on a desktop, under the goal
    if (L.helpLine) {
      ctx.textAlign = 'center';
      ctx.fillStyle = C.inkSoft;
      const help = t(sim.wayDone ? (this.touch ? 'g.fast.touch' : 'g.fast') : (this.touch ? 'g.help.touch' : 'g.help'));
      ctx.fillText(fitText(ctx, help, G.w, 13.5 * Math.min(u, 1.15), 650, SANS, MIN_READ), L.helpLine.x, L.helpLine.y);
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
      const tx = shown ? f.x + (L.talkAbove ? 0 : f.s * 0.45) : L.gauge.x, ty = shown ? f.y - f.s * (L.talkAbove ? 0.95 : 0.55) : L.gauge.y - L.gauge.r;
      // over the valley it steps back while the water's head, the way's end or a finger's aim is under it
      let alpha = this.bubbleA;
      const p = this.bubbleBox, val = sim.valley;
      if (p) {
        const near = [sim.water?.cell ?? -1, sim.wayEnd.cell, this.aim].some(i => {
          if (i < 0) return false;
          const c = cellBox(this.layout, i).full;
          return c.x < p.x + p.w && c.x + c.w > p.x && c.y < p.y + p.h && c.y + c.h > p.y;
        });
        if (near) alpha *= 0.25;
      }
      void val;
      this.bubbleBox = paintBubble(ctx, this.bubbleText, tx, ty, L.talk, alpha, !L.talkAbove, 14 * Math.min(L.u, 1.15));
    } else this.bubbleBox = null;
  }

  // ── the cards ───────────────────────────────────────────────────
  /** Where a story card sits (the open, a valley's tally, a spill, a station): over the valley's window. */
  storyBox(sim: ZrodlaSim): Box {
    const s = sim.story, L = this.layout, top = this.ins.top;
    const cw = Math.min(L.card.w, this.w - 24);
    const room = L.bottom - top - 20;
    const ch = Math.min(room, s?.kind === 'open' ? 390 : s?.kind === 'station' ? 340 : 230);
    const cx = clamp(L.view.x + L.view.w / 2 - cw / 2, L.left + 8, Math.max(L.left + 8, L.right - cw - 8));
    const cy = Math.max(top + 10, Math.min(L.bottom - 10 - ch, L.view.y + L.view.h / 2 - ch / 2));
    return { x: cx, y: cy, w: cw, h: ch };
  }

  private drawStory(sim: ZrodlaSim): void {
    const s = sim.story!;
    const ctx = this.ctx;
    const k = ease.outCubic(clamp(s.t / 0.3));
    const out = s.dur - s.t < 0.25 ? clamp((s.dur - s.t) / 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = k * out;
    ctx.fillStyle = 'rgba(40,30,20,.35)';
    ctx.fillRect(0, this.ins.top, this.w, this.h - this.ins.top);
    const b0 = this.storyBox(sim);
    const box: Box = { ...b0, y: b0.y + (1 - k) * 20 };
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
      ctx.font = font(650, 13.5, SANS);
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
