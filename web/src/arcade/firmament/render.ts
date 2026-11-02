/**
 * Firmament's play view, all on the canvas: the night sky (painted once per size, its stars
 * twinkling and brightening with calm in the night), the board on its glass (stardust, asteroids,
 * the bodies and their specials), the moves played back step by step on the rules' own clock (the
 * swap, the pops and the blasts, the fall and the refill, the cascades), the hint, the selection and
 * the keyboard's cursor, the falling stars, and the HUD (hud.ts) on top.  It only reads the sim
 * (sim.ts) and its events; the calibration scene is intro.ts.
 *
 * The rules resolve a move at once; the view keeps its own copy of the board (which piece sits
 * where) and moves it along the resolution's steps, then settles onto the sim's board when the last
 * step has played, so a missed frame can never leave a wrong picture behind.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import type { Blast, Resolution, Sp, Step, ToolKind } from './board';
import { TOOL_NAME, constName } from './content';
import { Hud } from './hud';
import { t } from './i18n';
import { FirmamentIntro } from './intro';
import { layout, type Layout } from './layout';
import type { FirmamentProgress } from './meta';
import { C, KIND_COLOR, Sprites, hash, paintCometMark, paintDust, paintNovaMark, paintPulsar, paintRock, paintSat, paintSkyLayer } from './paint';
import { RULES, type FirmamentSim, type SimEvent } from './sim';

const TAU = Math.PI * 2;

/** A piece as drawn: where it is (in cells, column and row), what it is, how it moves. */
interface D {
  id: number; kind: number; sp: Sp; armed: boolean;
  x: number; y: number;
  /** a fall: from (row) → to (row), its clock and length */
  fy0: number; fy1: number; ft: number; fd: number;
  /** a slide (swap, shuffle): from → to (cells), its clock and length */
  sx0: number; sy0: number; sx1: number; sy1: number; st: number; sd: number;
  /** born (0 → 1), landed (a squash that fades), dying (s since its clear; −1 alive), leaving (a satellite home) */
  born: number; land: number; dying: number; leaving: boolean;
}

interface Seg { dur: number; t: number; begun: boolean; begin: () => void }

interface Fx { kind: 'line' | 'ring' | 'beam' | 'flash' | 'streak'; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; color: string; width: number }

export class FirmamentView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new FirmamentIntro();
  private readonly sprites = new Sprites();
  private sky: HTMLCanvasElement | null = null;
  private clock = 0;
  private readonly parts = new Particles(700);
  private readonly fx: Fx[] = [];
  private readonly shake: Shake;
  // the board as drawn
  private readonly ds = new Map<number, D>();
  private grid: (number | null)[] = [];
  private rock: number[] = [];
  private dust: number[] = [];
  private mask: boolean[] = [];
  private queue: Seg[] = [];
  private synced = false;
  private boardKey = '';
  private bounce: { a: number; b: number; t: number } | null = null;
  private boardA = 0;
  private skyGlow = 0;
  private toolPulse = 0;
  private readonly gifts: { id: number; sp: Sp; t: number }[] = [];
  /** the sound hears each step as it plays */
  onStep: ((st: Step, bonus: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx, opts.eeg);
    this.hud.resize(this.L);
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h);
    this.hud.resize(this.L);
    this.sprites.ensure(this.L.cell * 0.92, dpr);
    this.sky = null;
  }

  private started = false;

  start(): void {
    this.started = true;
    this.boardA = 0;
  }

  intro(dt: number, p: number, progress: FirmamentProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── cells ↔ screen ──────────────────────────────────────────────
  private cx(col: number): number { return this.L.bx + (col + 0.5) * this.L.cell; }
  private cy(row: number): number { return this.L.by + (row + 0.5) * this.L.cell; }
  private cellXY(sim: FirmamentSim, i: number): { x: number; y: number } { return { x: this.cx(sim.board.c(i)), y: this.cy(sim.board.r(i)) }; }

  /** What a point of the canvas touches: a cell, a slot of the tray, the rescue's restart, or nothing. */
  hit(sim: FirmamentSim, x: number, y: number): { cell: number } | { slot: number } | { restart: true } | null {
    if (this.hud.restartHit(x, y)) return { restart: true };
    const L = this.L;
    for (let i = 0; i < sim.tray.length; i++) {
      const s = L.slot(i, sim.traySize);
      if (x >= s.x - 4 && x <= s.x + s.w + 4 && y >= s.y - 4 && y <= s.y + s.h + 4) return { slot: i };
    }
    const c = Math.floor((x - L.bx) / L.cell), r = Math.floor((y - L.by) / L.cell);
    if (c >= 0 && r >= 0 && c < sim.board.cols && r < sim.board.rows) return { cell: sim.board.at(r, c) };
    return null;
  }

  get cellSize(): number { return this.L.cell; }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: FirmamentSim): void {
    const u = this.L.u, rm = this.opts.reducedMotion;
    switch (e.type) {
      case 'level':
        this.queue = [];
        this.synced = false;
        this.boardA = 0;
        this.hud.levelCard(e.level, constName(e.level.constellation), e.attempt, e.newTools.map(x => TOOL_NAME[x]));
        break;
      case 'resolve':
        this.playResolution(sim, e.res, e.via, e.tool, e.at);
        break;
      case 'bounce':
        this.bounce = { a: e.a, b: e.b, t: 0 };
        break;
      case 'instrument': {
        const s = this.L.slot(e.slot, sim.traySize);
        {
          this.parts.burst(s.x + s.w / 2, s.y + s.h / 2, rm ? 6 : 26, { color: C.gold, size: 2.4 * u, speed: 150 * u, g: 0, drag: 2.5, life: 0.8, shape: 'spark', rnd: Math.random });
          this.fx.push({ kind: 'beam', x0: this.L.lens.x, y0: this.L.lens.y, x1: s.x + s.w / 2, y1: s.y + s.h / 2, t: 0, dur: 0.6, color: 'rgba(255,214,120,', width: 4 * u });
        }
        this.hud.toast(t('fx.tool'), TOOL_NAME[e.tool], e.tool === 'pulsar' ? C.cool : C.gold, e.tool);
        break;
      }
      case 'falling': {
        const to = this.cellXY(sim, e.at);
        const x0 = to.x - this.L.cell * 3 - 60 * u, y0 = Math.max(0, this.L.by - 80 * u);
        this.fx.push({ kind: 'streak', x0, y0, x1: to.x, y1: to.y, t: 0, dur: 0.7, color: 'rgba(220,235,255,', width: 3 * u });
        this.gifts.push({ id: e.id, sp: e.sp, t: 0.7 });
        this.hud.float(t('fx.falling'), to.x, to.y - this.L.cell * 0.7, C.cool, 14, 1.4);
        break;
      }
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(sim, e.block.kind, e.block.blind, e.verdict, e.share, e.need, e.t0, e.t1, e.tools);
        break;
      case 'won':
        this.hud.wonCard(e.level, e.stars, e.constDone ? constName(e.level.constellation) : null, e.bonus > 0);
        if (!rm) for (const col of [C.gold, C.cream, C.cool, C.violet]) this.parts.burst(this.L.bx + this.L.cell * 4, this.L.by + this.L.cell * 3, 24, { color: col, size: 2.6 * u, speed: 260 * u, g: 60, drag: 1.6, life: 1.6, shape: 'spark', rnd: Math.random });
        this.shake.add(0.25);
        break;
      case 'lost':
        this.hud.lostCard();
        break;
      case 'rescue':
        this.hud.float(t('rescue.done', { n: e.moves }), this.L.goals.x + this.L.goals.w * 0.2, this.L.goals.y + this.L.goals.h / 2, C.mint, 18, 1.6);
        break;
      case 'gift':
        this.hud.toast(t('card.gift', { name: TOOL_NAME[e.tool] }), '', C.gold, e.tool);
        break;
      case 'arm':
        this.toolPulse = 1;
        break;
      case 'toolMiss': {
        const p = this.cellXY(sim, e.at);
        this.fx.push({ kind: 'ring', x0: p.x, y0: p.y, x1: this.L.cell * 0.2, y1: this.L.cell * 0.5, t: 0, dur: 0.3, color: 'rgba(255,140,120,', width: 2 });
        break;
      }
      default:
        break;
    }
    this.hud.on(e);
  }

  /** A move's resolution as segments: the swap, then each step's clear and fall, then the reshuffle. */
  private playResolution(sim: FirmamentSim, res: Resolution, via: string, tool?: ToolKind, at?: number): void {
    const R = RULES;
    if (res.swap && (via === 'swap' || via === 'free')) {
      const [a, b] = res.swap;
      this.push(R.swapSec, () => {
        const ia = this.grid[a], ib = this.grid[b];
        this.slide(ia, b, R.swapSec);
        this.slide(ib, a, R.swapSec);
        this.grid[a] = ib ?? null;
        this.grid[b] = ia ?? null;
      });
    }
    if (via === 'tool' && at !== undefined) {
      this.push(R.toolSec * 0.5, () => {
        const p = this.cellXY(sim, at);
        this.fx.push({ kind: 'beam', x0: this.L.lens.x, y0: this.L.lens.y, x1: p.x, y1: p.y, t: 0, dur: R.toolSec, color: tool === 'pulsar' ? 'rgba(180,230,255,' : 'rgba(255,214,120,', width: 5 * this.L.u });
      });
    }
    res.steps.forEach(st => this.playStep(sim, st, via === 'bonus'));
    if (res.shuffle) {
      const moves = res.shuffle;
      this.push(0.5, () => {
        const next: (number | null)[] = this.grid.map(() => null);
        for (let i = 0; i < this.grid.length; i++) {
          const id = this.grid[i];
          if (id !== null && !moves.some(m => m.id === id)) next[i] = id;
        }
        for (const m of moves) {
          next[m.to] = m.id;
          this.slide(m.id, m.to, 0.5);
        }
        this.grid = next;
        this.hud.float(t('fx.shuffle'), this.L.bx + this.L.cell * 4, this.L.by + this.L.cell * 4, C.cool, 18, 1.4);
      });
    }
  }

  private push(dur: number, begin: () => void): void { this.queue.push({ dur, t: 0, begun: false, begin }); }

  private slide(id: number | null | undefined, to: number, dur: number): void {
    if (id === null || id === undefined) return;
    const d = this.ds.get(id);
    if (!d) return;
    const cols = RULES.cols;
    d.sx0 = d.x;
    d.sy0 = d.y;
    d.sx1 = to % cols;
    d.sy1 = Math.floor(to / cols);
    d.st = 0;
    d.sd = dur;
  }

  private playStep(sim: FirmamentSim, st: Step, bonus: boolean): void {
    const R = RULES, cols = RULES.cols;
    const clearDur = R.clearSec + (st.blasts.length ? R.blastSec : 0);
    this.push(clearDur, () => {
      const u = this.L.u, rm = this.opts.reducedMotion, cell = this.L.cell;
      for (const b of st.blasts) this.blastFx(sim, b);
      for (const c of st.changed) {
        const d = this.ds.get(c.id);
        if (d) {
          d.sp = c.sp;
          d.armed = c.armed;
          d.born = 0.4;
        }
      }
      let sx = 0, sy = 0;
      for (const c of st.cleared) {
        const d = this.ds.get(c.id);
        if (d) d.dying = 0;
        if (this.grid[c.at] === c.id) this.grid[c.at] = null;
        const x = this.cx(c.at % cols), y = this.cy(Math.floor(c.at / cols));
        sx += x;
        sy += y;
        const col = c.kind >= 0 ? KIND_COLOR[c.kind].main : '#e8f6ff';
        this.parts.burst(x, y, rm ? 2 : 7, { color: col, size: 2.2 * u, speed: 110 * u, g: 90, drag: 2.2, life: 0.55, shape: 'spark', rnd: Math.random });
        if (!rm) this.parts.burst(x, y, 2, { color: '#ffffff', size: 1.6 * u, speed: 40 * u, g: 0, drag: 3, life: 0.4, rnd: Math.random });
      }
      for (const b of st.born) {
        const d = this.make(b.id, b.kind, b.sp, b.at % cols, Math.floor(b.at / cols));
        d.born = 0;
        this.grid[b.at] = b.id;
        const x = this.cx(b.at % cols), y = this.cy(Math.floor(b.at / cols));
        this.fx.push({ kind: 'ring', x0: x, y0: y, x1: cell * 0.2, y1: cell * 0.9, t: 0, dur: 0.45, color: 'rgba(255,240,200,', width: 3 * u });
        const word = b.sp === 'pulsar' ? t('fx.pulsar') : b.sp === 'nova' ? t('fx.nova') : t('fx.comet');
        this.hud.float(word, x, y - cell * 0.6, b.sp === 'pulsar' ? C.cool : C.gold, 16, 1.2);
      }
      for (const r of st.rocks) {
        this.rock[r.at] = r.hp;
        const x = this.cx(r.at % cols), y = this.cy(Math.floor(r.at / cols));
        this.parts.burst(x, y, rm ? 3 : r.hp ? 6 : 16, { color: '#b8a48f', size: 2.6 * u, speed: (r.hp ? 90 : 170) * u, g: 260, drag: 1.4, life: 0.7, shape: 'square', rnd: Math.random });
        if (!r.hp) this.hud.float(t('fx.rock'), x, y - cell * 0.5, C.gold, 13, 1);
      }
      for (const dd of st.dust) {
        this.dust[dd.at] = dd.layers;
        const x = this.cx(dd.at % cols), y = this.cy(Math.floor(dd.at / cols));
        this.parts.burst(x, y, rm ? 2 : 8, { color: C.dust, size: 1.8 * u, speed: 70 * u, g: -20, drag: 2, life: 0.8, rnd: Math.random });
      }
      if (st.cleared.length && st.points > 0) {
        const n = st.cleared.length;
        this.hud.float(`+${st.points}`, sx / n, sy / n, st.cascade >= 3 ? C.gold : C.cream, 15 + Math.min(8, st.cascade * 1.5), 1);
      }
      if (st.cascade >= 2 && !bonus) {
        const words = [t('fx.nice.1'), t('fx.nice.2'), t('fx.nice.3')];
        this.hud.cascade(st.cascade, st.cascade >= 3 ? words[Math.min(2, st.cascade - 3)] : '');
        this.shake.add(Math.min(0.3, 0.06 * st.cascade));
      }
      if (st.blasts.length) this.shake.add(Math.min(0.45, 0.12 + 0.05 * st.blasts.length));
      this.onStep?.(st, bonus);
    });
    const fallDur = Math.max(0, st.dur - clearDur);
    this.push(fallDur, () => {
      // satellites slide to the floor and leave
      for (const s of st.sats) {
        const d = this.ds.get(s.id);
        if (!d) continue;
        d.leaving = true;
        d.fy0 = d.y;
        d.fy1 = Math.floor(s.at / cols) + 0.9;
        d.ft = 0;
        d.fd = Math.max(0.15, fallDur);
        for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === s.id) this.grid[i] = null;
        const x = this.cx(s.at % cols), y = this.cy(Math.floor(s.at / cols));
        this.hud.float(t('fx.sat'), x, y - this.L.cell * 0.5, C.mint, 15, 1.4);
        this.fx.push({ kind: 'ring', x0: x, y0: y + this.L.cell * 0.4, x1: this.L.cell * 0.3, y1: this.L.cell * 1.3, t: 0, dur: 0.6, color: 'rgba(143,227,184,', width: 3 * this.L.u });
      }
      const next = this.grid.slice();
      for (const m of st.moves) if (next[m.from] === m.id) next[m.from] = null;
      for (const m of st.moves) {
        next[m.to] = m.id;
        const d = this.ds.get(m.id);
        if (!d) continue;
        d.fy0 = d.y;
        d.fy1 = Math.floor(m.to / cols);
        d.x = m.to % cols;
        d.ft = 0;
        d.fd = Math.max(R.fallMin, (d.fy1 - d.fy0) * R.fallCell + 0.06);
      }
      for (const s of st.spawns) {
        const d = this.make(s.id, s.kind, s.sp, s.to % cols, s.fromRow);
        d.fy0 = s.fromRow;
        d.fy1 = Math.floor(s.to / cols);
        d.ft = 0;
        d.fd = Math.max(R.fallMin, (d.fy1 - d.fy0) * R.fallCell + 0.06);
        next[s.to] = s.id;
      }
      this.grid = next;
    });
  }

  private blastFx(sim: FirmamentSim, b: Blast): void {
    const L = this.L, cell = L.cell, u = L.u;
    const p = this.cellXY(sim, b.at);
    const left = L.bx, right = L.bx + cell * 8, top = L.by, bottom = L.by + cell * 8;
    const line = (x0: number, y0: number, x1: number, y1: number, w = 7) =>
      this.fx.push({ kind: 'line', x0, y0, x1, y1, t: 0, dur: 0.38, color: 'rgba(235,245,255,', width: w * u });
    const rows = (d: number) => line(left, p.y + d * cell, right, p.y + d * cell);
    const colsF = (d: number) => line(p.x + d * cell, top, p.x + d * cell, bottom);
    switch (b.kind) {
      case 'row': rows(0); break;
      case 'col': colsF(0); break;
      case 'cross': rows(0); colsF(0); break;
      case 'big': for (const d of [-1, 0, 1]) { rows(d); colsF(d); } break;
      case 'nova': case 'nova5': {
        const r = b.kind === 'nova' ? 1.6 : 2.6;
        this.fx.push({ kind: 'ring', x0: p.x, y0: p.y, x1: cell * 0.3, y1: cell * r, t: 0, dur: 0.42, color: 'rgba(255,214,140,', width: 8 * u });
        this.fx.push({ kind: 'flash', x0: p.x, y0: p.y, x1: cell * r, y1: 0, t: 0, dur: 0.3, color: 'rgba(255,240,200,', width: 0 });
        break;
      }
      case 'kind': case 'all':
        for (const c of b.cells.slice(0, 40)) {
          const q = this.cellXY(sim, c);
          this.fx.push({ kind: 'beam', x0: p.x, y0: p.y, x1: q.x, y1: q.y, t: 0, dur: 0.4, color: 'rgba(190,235,255,', width: 2.5 * u });
        }
        this.fx.push({ kind: 'flash', x0: p.x, y0: p.y, x1: cell * (b.kind === 'all' ? 8 : 2.5), y1: 0, t: 0, dur: 0.4, color: 'rgba(200,240,255,', width: 0 });
        break;
      case 'ray':
        this.fx.push({ kind: 'beam', x0: p.x, y0: top - cell, x1: p.x, y1: p.y, t: 0, dur: 0.3, color: 'rgba(255,224,140,', width: 6 * u });
        break;
    }
  }

  private make(id: number, kind: number, sp: Sp, x: number, y: number): D {
    const d: D = { id, kind, sp, armed: false, x, y, fy0: y, fy1: y, ft: 1, fd: 0, sx0: x, sy0: y, sx1: x, sy1: y, st: 1, sd: 0, born: 1, land: 0, dying: -1, leaving: false };
    this.ds.set(id, d);
    return d;
  }

  /** Settle onto the sim's board: every piece where the rules say, nothing extra. */
  private sync(sim: FirmamentSim): void {
    const B = sim.board;
    const key = `${sim.level.index}:${sim.attempt}`;
    if (key !== this.boardKey) {
      this.ds.clear();
      this.boardKey = key;
    }
    const seen = new Set<number>();
    this.grid = B.cells.map(() => null);
    B.cells.forEach((p, i) => {
      if (!p) return;
      seen.add(p.id);
      let d = this.ds.get(p.id);
      if (!d) d = this.make(p.id, p.kind, p.sp, B.c(i), B.r(i));
      d.kind = p.kind;
      d.sp = p.sp;
      d.armed = p.armed;
      d.x = B.c(i);
      d.y = B.r(i);
      d.ft = d.fd = 1;
      d.st = d.sd = 1;
      d.dying = -1;
      d.leaving = false;
      this.grid[i] = p.id;
    });
    for (const id of [...this.ds.keys()]) if (!seen.has(id)) this.ds.delete(id);
    this.rock = B.rock.slice();
    this.dust = B.dust.slice();
    this.mask = B.mask.slice();
    this.synced = true;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: FirmamentSim): void {
    this.clock += dt;
    if (!this.synced && !this.queue.length) this.sync(sim);
    // the queue of segments: one at a time
    let left = dt;
    while (this.queue.length && left > 0) {
      const s = this.queue[0];
      if (!s.begun) {
        s.begun = true;
        s.begin();
      }
      const use = Math.min(left, s.dur - s.t);
      s.t += use;
      left -= use;
      this.tickPieces(use);
      if (s.t >= s.dur - 1e-9) {
        this.queue.shift();
        if (!this.queue.length) this.synced = false;
      }
    }
    if (left > 0) this.tickPieces(left);
    if (!this.queue.length && !this.synced) this.sync(sim);
    if (this.bounce) {
      this.bounce.t += dt;
      if (this.bounce.t >= RULES.bounceSec) this.bounce = null;
    }
    for (let i = this.gifts.length - 1; i >= 0; i--) {
      const g = this.gifts[i];
      g.t -= dt;
      if (g.t <= 0) {
        const d = this.ds.get(g.id);
        if (d) {
          d.sp = g.sp;
          d.born = 0.3;
          const x = this.cx(d.x), y = this.cy(d.y);
          this.parts.burst(x, y, this.opts.reducedMotion ? 4 : 18, { color: '#e8f2ff', size: 2.2 * this.L.u, speed: 140 * this.L.u, g: 0, drag: 2.5, life: 0.7, shape: 'spark', rnd: Math.random });
        }
        this.gifts.splice(i, 1);
      }
    }
    this.parts.update(dt);
    let n = 0;
    for (const f of this.fx) if ((f.t += dt) < f.dur) this.fx[n++] = f;
    this.fx.length = n;
    this.boardA = approach(this.boardA, 1, dt, 0.25);
    this.skyGlow = approach(this.skyGlow, sim.sky, dt, 0.5);
    this.toolPulse = Math.max(0, this.toolPulse - dt * 2);
    this.hud.update(dt, sim);
  }

  private tickPieces(dt: number): void {
    for (const [id, d] of this.ds) {
      if (d.dying >= 0) {
        d.dying += dt;
        if (d.dying > RULES.clearSec + 0.05) this.ds.delete(id);
        continue;
      }
      if (d.born < 1) d.born = Math.min(1, d.born + dt / 0.25);
      if (d.st < d.sd) {
        d.st = Math.min(d.sd, d.st + dt);
        const k = ease.outCubic(d.st / d.sd);
        d.x = d.sx0 + (d.sx1 - d.sx0) * k;
        d.y = d.sy0 + (d.sy1 - d.sy0) * k;
      } else if (d.ft < d.fd) {
        d.ft = Math.min(d.fd, d.ft + dt);
        const k = d.ft / d.fd;
        d.y = d.fy0 + (d.fy1 - d.fy0) * k * k;
        if (d.ft >= d.fd) {
          d.y = d.fy1;
          if (d.leaving) this.ds.delete(id);
          else d.land = 1;
        }
      }
      if (d.land > 0) d.land = Math.max(0, d.land - dt * 5);
    }
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: FirmamentSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky();
    this.hud.drawMilky(sim);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawBoard(sim);
    ctx.restore();
    this.parts.draw(ctx);
    this.drawFx();
    this.hud.draw(sim);
  }

  private drawSky(): void {
    const ctx = this.ctx, w = this.w, h = this.h;
    if (!this.sky || this.sky.width !== Math.round(w * this.dpr) || this.sky.height !== Math.round(h * this.dpr)) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      const sctx = c.getContext('2d');
      if (sctx) {
        sctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        paintSkyLayer(sctx, w, h, 3);
      }
      this.sky = c;
    }
    ctx.drawImage(this.sky, 0, 0, w, h);
    // twinkling bright stars, brighter in a calm night
    const glow = this.skyGlow;
    for (let i = 0; i < 46; i++) {
      const x = hash(i * 11 + 5) * w, y = hash(i * 23 + 9) * h;
      const tw = 0.5 + 0.5 * Math.sin(this.clock * (0.8 + hash(i) * 2) + i * 2.1);
      const a = (0.25 + 0.5 * tw) * (0.6 + 0.6 * glow);
      const r = (0.8 + hash(i * 3) * 1.4) * (1 + glow * 0.6);
      ctx.fillStyle = `rgba(255,250,235,${Math.min(1, a)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (hash(i * 7) > 0.8) {
        ctx.strokeStyle = `rgba(255,250,235,${Math.min(1, a) * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - r * 3, y);
        ctx.lineTo(x + r * 3, y);
        ctx.moveTo(x, y - r * 3);
        ctx.lineTo(x, y + r * 3);
        ctx.stroke();
      }
    }
    // the night's calm: a deep blue glow rising from the horizon
    if (glow > 0.02) {
      const g = ctx.createLinearGradient(0, h, 0, h * 0.2);
      g.addColorStop(0, `rgba(80,130,230,${0.28 * glow})`);
      g.addColorStop(1, 'rgba(80,130,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawBoard(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, cell = L.cell, u = L.u;
    const B = sim.board;
    if (!this.mask.length) this.sync(sim);
    const k = ease.outCubic(this.boardA);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 18 * u);
    // the glass behind the cells
    const pad = 6 * u;
    ctx.fillStyle = 'rgba(8,10,34,.55)';
    ctx.strokeStyle = sim.armedTool ? `rgba(255,214,120,${0.55 + 0.35 * Math.sin(this.clock * 6)})` : 'rgba(180,200,255,.22)';
    ctx.lineWidth = sim.armedTool ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.roundRect(L.bx - pad, L.by - pad, cell * 8 + 2 * pad, cell * 8 + 2 * pad, 14 * u);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < B.n; i++) {
      if (!this.mask[i]) continue;
      const r = B.r(i), c = B.c(i), x = L.bx + c * cell, y = L.by + r * cell;
      ctx.fillStyle = (r + c) % 2 ? 'rgba(120,140,220,.10)' : 'rgba(120,140,220,.05)';
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, cell - 3, cell - 3, cell * 0.16);
      ctx.fill();
      if (this.dust[i] > 0) paintDust(ctx, x + cell / 2, y + cell / 2, cell, this.dust[i], this.clock, i + 1);
    }
    // the satellites' landing row: a soft green line along the floor of each column
    if (sim.level.sats > 0) {
      ctx.strokeStyle = 'rgba(143,227,184,.45)';
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([4 * u, 4 * u]);
      for (let c = 0; c < B.cols; c++) {
        const f = B.floorOf(c);
        if (f < 0) continue;
        const y = L.by + (B.r(f) + 1) * cell - 2 * u;
        ctx.beginPath();
        ctx.moveTo(L.bx + c * cell + 4, y);
        ctx.lineTo(L.bx + (c + 1) * cell - 4, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    for (let i = 0; i < B.n; i++) if (this.rock[i] > 0) paintRock(ctx, this.cx(B.c(i)), this.cy(B.r(i)), cell * 0.44, this.rock[i], i + 7);
    this.drawHint(sim);
    // the pieces, clipped to the board so the refill comes in from above it
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.bx - pad, L.by - 1, cell * 8 + 2 * pad, cell * 8 + pad + 1);
    ctx.clip();
    for (const d of this.ds.values()) this.drawPiece(d);
    ctx.restore();
    this.drawSelection(sim);
    ctx.restore();
  }

  private drawPiece(d: D): void {
    const ctx = this.ctx, cell = this.L.cell;
    let x = this.cx(d.x), y = this.cy(d.y);
    // the bounce of a swap that made nothing
    if (this.bounce) {
      const b = this.bounce, cols = RULES.cols;
      const ida = this.grid[b.a], idb = this.grid[b.b];
      if (d.id === ida || d.id === idb) {
        const from = d.id === ida ? b.a : b.b, to = d.id === ida ? b.b : b.a;
        const k = Math.sin(clamp(b.t / RULES.bounceSec) * Math.PI) * 0.45;
        x += ((to % cols) - (from % cols)) * cell * k;
        y += (Math.floor(to / cols) - Math.floor(from / cols)) * cell * k;
      }
    }
    let s = 1, sx = 1, sy = 1, a = 1;
    if (d.born < 1) s = ease.outBack(d.born);
    if (d.dying >= 0) {
      const k = clamp(d.dying / RULES.clearSec);
      s = 1 + 0.35 * k;
      a = 1 - k;
    }
    if (d.land > 0) {
      sx = 1 + 0.12 * d.land;
      sy = 1 - 0.12 * d.land;
      y += cell * 0.06 * d.land;
    }
    if (d.leaving) a = clamp(1 - (d.ft / Math.max(0.01, d.fd)) * 0.8);
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    ctx.scale(s * sx, s * sy);
    const r = cell * 0.4;
    const t = this.clock + d.id * 0.37;
    if (d.sp === 'sat') paintSat(ctx, 0, 0, r * 0.95, t);
    else if (d.sp === 'pulsar') paintPulsar(ctx, 0, 0, r, t);
    else {
      if (d.sp === 'nova') paintNovaMark(ctx, 0, 0, r, t, d.armed);
      this.sprites.body(ctx, d.kind, 0, 0, 1);
      if (d.sp === 'row' || d.sp === 'col') paintCometMark(ctx, 0, 0, r, d.sp, t);
    }
    ctx.restore();
  }

  private drawHint(sim: FirmamentSim): void {
    if (!sim.hintShown || !sim.hint || this.queue.length || sim.stage !== 'play' || sim.phase !== 'play') return;
    const ctx = this.ctx, cell = this.L.cell, u = this.L.u;
    const a = this.cellXY(sim, sim.hint.a), b = this.cellXY(sim, sim.hint.b);
    const p = 0.5 + 0.5 * Math.sin(this.clock * 5);
    const night = sim.nightBlock;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of [a, b]) {
      const g = ctx.createRadialGradient(q.x, q.y, cell * 0.1, q.x, q.y, cell * 0.75);
      g.addColorStop(0, night ? `rgba(140,190,255,${0.3 + 0.25 * p})` : `rgba(255,220,140,${0.28 + 0.25 * p})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(q.x - cell, q.y - cell, cell * 2, cell * 2);
    }
    ctx.restore();
    // a small arrow from the one to the other
    ctx.save();
    ctx.strokeStyle = night ? 'rgba(170,205,255,.9)' : 'rgba(255,226,160,.9)';
    ctx.lineWidth = 2.5 * u;
    ctx.lineCap = 'round';
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = (b.x - a.x) / cell, dy = (b.y - a.y) / cell;
    const len = cell * 0.18 * (1 + 0.2 * p);
    ctx.beginPath();
    ctx.moveTo(mx - dx * len, my - dy * len);
    ctx.lineTo(mx + dx * len, my + dy * len);
    ctx.lineTo(mx + dx * len * 0.3 - dy * len * 0.6, my + dy * len * 0.3 + dx * len * 0.6);
    ctx.moveTo(mx + dx * len, my + dy * len);
    ctx.lineTo(mx + dx * len * 0.3 + dy * len * 0.6, my + dy * len * 0.3 - dx * len * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  private drawSelection(sim: FirmamentSim): void {
    const ctx = this.ctx, cell = this.L.cell, u = this.L.u;
    if (sim.selected >= 0) {
      const p = this.cellXY(sim, sim.selected);
      const k = 0.5 + 0.5 * Math.sin(this.clock * 7);
      ctx.strokeStyle = `rgba(255,236,180,${0.7 + 0.3 * k})`;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.roundRect(p.x - cell / 2 + 2, p.y - cell / 2 + 2, cell - 4, cell - 4, cell * 0.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,236,180,.12)';
      ctx.fill();
    }
    if (sim.cursor >= 0 && sim.cursor !== sim.selected) {
      const p = this.cellXY(sim, sim.cursor);
      ctx.strokeStyle = 'rgba(158,197,255,.85)';
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([5 * u, 4 * u]);
      ctx.beginPath();
      ctx.roundRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6, cell * 0.18);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawFx(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const f of this.fx) {
      const k = clamp(f.t / f.dur), a = 1 - k;
      switch (f.kind) {
        case 'line': {
          ctx.strokeStyle = `${f.color}${0.9 * a})`;
          ctx.lineWidth = f.width * (1 + k);
          ctx.beginPath();
          ctx.moveTo(f.x0, f.y0);
          ctx.lineTo(f.x1, f.y1);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = f.width * 0.35;
          ctx.stroke();
          break;
        }
        case 'ring':
          ctx.strokeStyle = `${f.color}${a})`;
          ctx.lineWidth = f.width * a + 0.5;
          ctx.beginPath();
          ctx.arc(f.x0, f.y0, f.x1 + (f.y1 - f.x1) * ease.outCubic(k), 0, TAU);
          ctx.stroke();
          break;
        case 'flash': {
          const g = ctx.createRadialGradient(f.x0, f.y0, 0, f.x0, f.y0, f.x1);
          g.addColorStop(0, `${f.color}${0.6 * a})`);
          g.addColorStop(1, `${f.color}0)`);
          ctx.fillStyle = g;
          ctx.fillRect(f.x0 - f.x1, f.y0 - f.x1, f.x1 * 2, f.x1 * 2);
          break;
        }
        case 'beam': {
          const head = ease.outCubic(Math.min(1, k * 2));
          ctx.strokeStyle = `${f.color}${a})`;
          ctx.lineWidth = f.width;
          ctx.beginPath();
          ctx.moveTo(f.x0, f.y0);
          ctx.lineTo(f.x0 + (f.x1 - f.x0) * head, f.y0 + (f.y1 - f.y0) * head);
          ctx.stroke();
          break;
        }
        case 'streak': {
          const head = ease.inOutSine(k), tail = Math.max(0, head - 0.35);
          const hx = f.x0 + (f.x1 - f.x0) * head, hy = f.y0 + (f.y1 - f.y0) * head;
          const g = ctx.createLinearGradient(f.x0 + (f.x1 - f.x0) * tail, f.y0 + (f.y1 - f.y0) * tail, hx, hy);
          g.addColorStop(0, `${f.color}0)`);
          g.addColorStop(1, `${f.color}0.95)`);
          ctx.strokeStyle = g;
          ctx.lineWidth = f.width;
          ctx.beginPath();
          ctx.moveTo(f.x0 + (f.x1 - f.x0) * tail, f.y0 + (f.y1 - f.y0) * tail);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.95)';
          ctx.beginPath();
          ctx.arc(hx, hy, f.width * 1.2, 0, TAU);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
  }
}
