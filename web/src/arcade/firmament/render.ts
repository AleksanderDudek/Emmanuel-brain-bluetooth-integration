/**
 * Firmament's play view: the night sky, the board and its bodies, and every move played back on the
 * rules' clock (rules.ts) — the swap's slide, a bounce, the clears with their sparks and flying
 * points, the comets' beams, the supernovae's rings, the pulsar's lines, the meteors' flights, the
 * clouds thinning, the asteroids cracking, the ink dissolving into light, the fall and the refill,
 * the cascade's words (Ładnie! Jasno! Promiennie! Gwiezdnie!), hit-stop on the big ones and a shake
 * (none with reduced motion).  The telescope, the goal card, the tray, Bubo and the cards are drawn
 * by hud.ts on top.
 *
 * Under a finger (DESIGN §12): the body pressed lifts and leans toward the swipe before it swaps, an armed
 * tool shows where it will strike while the finger is down (the ray its whole row), a touch a little off
 * the board takes the nearest body.  On a phone's budget: the board's glass is one cached layer, the dark
 * clouds are sprites, no blur in a frame.
 */
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import { NO_INSETS } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { type Blast, type Resolution, type Sp, type Step, MOON } from './board';
import { t } from './i18n';
import { HudDraw, type Hit } from './hud';
import { layout, inRect, type Layout } from './layout';
import { C, KIND_COLOR, SANS, SERIF, Sprites, font, hash, paintCometMark, paintExit, paintInk, paintLock, paintMeteorMark, paintMoon, paintNovaMark, paintPulsar, paintRock, paintSkyLayer, paintStar } from './paint';
import { RULES, type FirmamentSim, type SimEvent } from './sim';

interface Vis {
  id: number;
  kind: number;
  sp: Sp;
  /** position in cells (column, row), and a tween */
  x: number;
  y: number;
  fx: number; fy: number; tx: number; ty: number; t0: number; t1: number; easeOut: boolean;
  /** shrinking away (s left), popping in (s left) */
  die: number;
  pop: number;
  flash: number;
}
interface Beam { kind: Blast['kind']; x: number; y: number; x2: number; y2: number; t: number; dur: number; cells: number[] }
interface Play { res: Resolution; i: number; t: number; swapLeft: number; started: boolean; fast: boolean; via: string }
interface StarFx { x0: number; y0: number; at: number; id: number; sp: Sp; t: number; dur: number; gold: boolean }

export class FirmamentView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private ins: Insets = NO_INSETS;
  private slots: number = RULES.tray;
  L!: Layout;
  private sky: HTMLCanvasElement | null = null;
  /** the board's glass and rim for this level and size, painted once */
  private glass: { key: string; c: HTMLCanvasElement | null } | null = null;
  /** a body under a finger (its cell, how far the finger has moved), and an armed tool's aim */
  press: { cell: number; dx: number; dy: number } | null = null;
  aim = -1;
  private readonly sprites = new Sprites();
  private readonly parts = new Particles(500);
  private readonly floats = new Floaters();
  private readonly shake: Shake;
  private readonly hud: HudDraw;
  private vis = new Map<number, Vis>();
  private queue: Play[] = [];
  private beams: Beam[] = [];
  private stars: StarFx[] = [];
  private pendingSp = new Map<number, Sp>();
  private bounce: { a: number; b: number; t: number } | null = null;
  private shuffleT = 0;
  private pendingShuffle: { id: number; to: number }[] | null = null;
  private stop = 0;
  private word: { text: string; t: number; big: boolean } | null = null;
  /** the board's layers as the picture shows them (they change when a step plays) */
  private cloud: number[] = [];
  private rock: number[] = [];
  private ink: number[] = [];
  private lock: number[] = [];
  private inkFade = new Map<number, number>();
  private levelKey = '';
  clock = 0;
  onStep: ((st: Step, shower: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
    this.hud = new HudDraw(opts);
  }

  resize(w: number, h: number, dpr: number, insets: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.ins = { ...insets };
    this.sky = null;
    this.glass = null;
    if (this.L) {
      this.L = layout(w, h, this.ins, this.L.rows, this.L.cols, this.slots);
      this.sprites.ensure(this.L.cell, this.dpr);
    }
  }

  /** The slot under a finger, for its pressed look (-1: none). */
  set pressSlot(k: number) { this.hud.pressSlot = k; }

  /** A touch on the sky: Bubo's bubble steps aside. */
  hush(): void { this.hud.hush(this.clock); }

  get cellSize(): number { return this.L?.cell ?? 40; }

  /** A cell's centre in canvas px. */
  cellXY(i: number, cols = this.L.cols): { x: number; y: number } {
    const L = this.L;
    return { x: L.board.x + ((i % cols) + 0.5) * L.cell, y: L.board.y + (Math.floor(i / cols) + 0.5) * L.cell };
  }

  private px(cx: number, cy: number): { x: number; y: number } {
    return { x: this.L.board.x + (cx + 0.5) * this.L.cell, y: this.L.board.y + (cy + 0.5) * this.L.cell };
  }

  /** Where a coach mark about a part of the screen points. */
  uiPoint(ui: 'goal' | 'scope' | 'tray' | 'moves'): { x: number; y: number } {
    const L = this.L;
    if (ui === 'scope') return { x: L.scope.x, y: L.scope.y - L.scope.r };
    if (ui === 'tray') return { x: L.tray[0].x + L.tray[0].w / 2, y: L.tray[0].y };
    if (ui === 'moves') return { x: L.goal.x + Math.min(L.goal.w, L.goal.h) * 0.45, y: L.goal.y + L.goal.h * 0.5 };
    return { x: L.goal.x + L.goal.w / 2, y: L.goal.y + L.goal.h };
  }

  // ── the level ───────────────────────────────────────────────────
  /** Take the board as it is (a new level, a retry, after a resolution): every body where the rules have it. */
  private sync(sim: FirmamentSim, hard: boolean): void {
    const B = sim.board;
    if (hard || !this.L || this.L.rows !== B.rows || this.L.cols !== B.cols || this.slots !== sim.traySize) {
      this.slots = sim.traySize;
      this.L = layout(this.w, this.h, this.ins, B.rows, B.cols, this.slots);
      this.sprites.ensure(this.L.cell, this.dpr);
    }
    if (hard) {
      this.vis.clear();
      this.cloud = B.cloud.slice();
      this.rock = B.rock.slice();
      this.ink = B.ink.slice();
      this.lock = B.lock.slice();
    }
    const live = new Set<number>();
    B.cells.forEach((p, i) => {
      if (!p) return;
      live.add(p.id);
      const cx = i % B.cols, cy = Math.floor(i / B.cols);
      let v = this.vis.get(p.id);
      if (!v) {
        v = { id: p.id, kind: p.kind, sp: p.sp, x: cx, y: cy, fx: cx, fy: cy, tx: cx, ty: cy, t0: 0, t1: 0, easeOut: false, die: 0, pop: hard ? 0 : 0.2, flash: 0 };
        this.vis.set(p.id, v);
      }
      if (!this.pendingSp.has(p.id)) { v.sp = p.sp; v.kind = p.kind; }
      if (this.clock >= v.t1) { v.x = cx; v.y = cy; v.tx = cx; v.ty = cy; }
      v.die = 0;
    });
    for (const [id, v] of this.vis) if (!live.has(id) && v.die <= 0) this.vis.delete(id);
    if (!hard) {
      this.cloud = B.cloud.slice();
      this.rock = B.rock.slice();
      this.ink = B.ink.slice();
      this.lock = B.lock.slice();
    }
  }

  start(sim: FirmamentSim): void {
    this.sync(sim, true);
    this.levelKey = `${sim.level.index}:${sim.attempt}`;
  }

  get busy(): boolean { return this.queue.length > 0; }

  // ── events ──────────────────────────────────────────────────────
  on(e: SimEvent, sim: FirmamentSim): void {
    switch (e.type) {
      case 'intro': case 'story':
        if (`${sim.level.index}:${sim.attempt}` !== this.levelKey) {
          this.queue = [];
          this.beams = [];
          this.stars = [];
          this.pendingSp.clear();
          this.start(sim);
        }
        this.hud.card(e.type, this.clock);
        break;
      case 'resolve':
        this.queue.push({ res: e.res, i: 0, t: 0, swapLeft: e.res.swap ? RULES.swapSec : 0, started: false, fast: e.via === 'shower', via: e.via });
        if (e.via === 'shower') this.say(t('shower'), true);
        break;
      case 'bounce':
        this.bounce = { a: e.a, b: e.b, t: 0 };
        break;
      case 'shuffle':
        if (this.queue.length) { this.pendingShuffle = e.moves; break; }
        for (const m of e.moves) {
          const v = this.vis.get(m.id);
          if (!v) continue;
          const B = sim.board;
          this.tween(v, m.to % B.cols, Math.floor(m.to / B.cols), 0.45, false);
        }
        this.shuffleT = 0.5;
        if (!this.queue.length) this.floats.add(t('ev.shuffle'), this.L.board.x + this.L.board.w / 2, this.L.board.y + this.L.board.h * 0.45, { color: C.mint, size: 20 * this.L.u, dur: 1.4 });
        break;
      case 'changed': {
        // a falling star (or the telescope's light) brings the special
        const v = this.vis.get(e.id);
        this.pendingSp.set(e.id, e.sp);
        const fromLeft = hash(e.at + this.clock * 7) < 0.5;
        this.stars.push({ x0: fromLeft ? -20 : this.w + 20, y0: -20, at: e.at, id: e.id, sp: e.sp, t: 0, dur: e.why === 'tool' ? 0.25 : 0.7, gold: e.why !== 'star' });
        if (v) v.flash = 0;
        break;
      }
      case 'moves': {
        const p = this.uiPoint('moves');
        this.floats.add(t('ev.moves', { n: e.n }), p.x + 30 * this.L.u, p.y, { color: '#9fe8ff', size: 24 * this.L.u, dur: 1.5 });
        this.parts.burst(p.x, p.y, 18, { color: '#bfefff', speed: 160, g: 0, life: 0.7, shape: 'spark' });
        break;
      }
      case 'tool': {
        const slot = this.L.tray[Math.min(e.slot, this.L.tray.length - 1)];
        this.parts.burst(slot.x + slot.w / 2, slot.y + slot.h / 2, 26, { color: C.gold, speed: 200, g: 0, life: 0.8, shape: 'spark' });
        this.hud.flashTool(e.slot, this.clock);
        break;
      }
      case 'won':
        this.hud.card('won', this.clock);
        this.parts.burst(this.L.board.x + this.L.board.w / 2, this.L.board.y + this.L.board.h * 0.4, 60, { color: C.gold, speed: 320, g: 120, life: 1.4, shape: 'spark' });
        break;
      case 'out':
        this.hud.card('out', this.clock);
        break;
      case 'say':
        this.hud.say(e.text, this.clock);
        break;
      case 'star':
        this.hud.starPip(e.n, this.clock);
        break;
      case 'toolMiss': {
        const p = this.cellXY(e.at, sim.board.cols);
        this.parts.burst(p.x, p.y, 6, { color: '#ffffff', speed: 60, g: 0, life: 0.3 });
        break;
      }
      default:
        break;
    }
  }

  private say(text: string, big: boolean): void {
    this.word = { text, t: 0, big };
  }

  private tween(v: Vis, tx: number, ty: number, dur: number, easeOut: boolean): void {
    v.fx = v.x;
    v.fy = v.y;
    v.tx = tx;
    v.ty = ty;
    v.t0 = this.clock;
    v.t1 = this.clock + Math.max(0.01, dur);
    v.easeOut = easeOut;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: FirmamentSim): void {
    this.clock += dt;
    this.parts.update(dt);
    this.floats.update(dt);
    this.hud.update(dt);
    if (this.word) { this.word.t += dt; if (this.word.t > 1.3) this.word = null; }
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter(b => b.t < b.dur);
    for (const [at, k] of this.inkFade) { if (k - dt <= 0) this.inkFade.delete(at); else this.inkFade.set(at, k - dt); }
    if (this.bounce) { this.bounce.t += dt; if (this.bounce.t >= RULES.bounceSec) this.bounce = null; }
    this.shuffleT = Math.max(0, this.shuffleT - dt);
    // falling stars land
    for (const s of this.stars) {
      s.t += dt;
      if (s.t >= s.dur && s.dur > 0) {
        s.dur = -1;
        const v = this.vis.get(s.id);
        const sp = this.pendingSp.get(s.id);
        this.pendingSp.delete(s.id);
        if (v && sp) { v.sp = sp; if (sp === 'pulsar') v.kind = -1; v.flash = 0.5; }
        const p = this.cellXY(s.at, sim.board.cols);
        this.parts.burst(p.x, p.y, 22, { color: s.gold ? C.gold : '#cfe6ff', speed: 180, g: 0, life: 0.6, shape: 'spark' });
        this.floats.add(t('ev.star'), p.x, p.y - this.L.cell * 0.6, { color: '#cfe6ff', size: 16 * this.L.u, dur: 1 });
      }
    }
    this.stars = this.stars.filter(s => s.dur > 0 || s.t < 0.4);
    for (const v of this.vis.values()) {
      if (v.die > 0) v.die = Math.max(0, v.die - dt);
      if (v.pop > 0) v.pop = Math.max(0, v.pop - dt);
      if (v.flash > 0) v.flash = Math.max(0, v.flash - dt);
      if (this.clock < v.t1) {
        const k = clamp((this.clock - v.t0) / (v.t1 - v.t0));
        const e = v.easeOut ? ease.outCubic(k) : k * k * (3 - 2 * k) * 0.3 + k * k * 0.7;
        v.x = v.fx + (v.tx - v.fx) * e;
        v.y = v.fy + (v.ty - v.fy) * e;
      } else { v.x = v.tx; v.y = v.ty; }
    }
    for (const [id, v] of this.vis) if (v.die <= 0 && v.t1 < 0) this.vis.delete(id);
    this.playQueue(dt, sim);
  }

  private playQueue(dt: number, sim: FirmamentSim): void {
    if (this.stop > 0) { this.stop -= dt; return; }
    let budget = dt;
    while (budget > 0 && this.queue.length) {
      const q = this.queue[0];
      if (q.swapLeft > 0) {
        if (!q.started) {
          q.started = true;
          const [a, b] = q.res.swap!;
          this.swapTween(a, b, sim);
        }
        const used = Math.min(budget, q.swapLeft);
        q.swapLeft -= used;
        budget -= used;
        continue;
      }
      const st = q.res.steps[q.i];
      if (!st) {
        this.queue.shift();
        if (!this.queue.length) {
          const sh = this.pendingShuffle;
          this.pendingShuffle = null;
          if (sh) {
            for (const m of sh) {
              const v = this.vis.get(m.id);
              if (v) this.tween(v, m.to % sim.board.cols, Math.floor(m.to / sim.board.cols), 0.45, false);
            }
            this.floats.add(t('ev.shuffle'), this.L.board.x + this.L.board.w / 2, this.L.board.y + this.L.board.h * 0.45, { color: C.mint, size: 20 * this.L.u, dur: 1.4 });
          }
          this.sync(sim, false);
        }
        continue;
      }
      if (q.t === 0) this.startStep(st, q, sim);
      const before = q.t;
      const used = Math.min(budget, st.dur - q.t);
      q.t += used;
      budget -= used;
      if (before < st.fall && q.t >= st.fall) this.fallStep(st, sim);
      if (q.t >= st.dur - 1e-6) {
        q.i++;
        q.t = 0;
      }
      if (this.stop > 0) break;
    }
  }

  private swapTween(a: number, b: number, sim: FirmamentSim): void {
    const B = sim.board, cols = B.cols;
    // the bodies now at a and b came from b and a (or were taken by a combo); slide them across
    const ids = [...this.vis.values()];
    const at = (i: number) => ids.find(v => Math.round(v.x) === i % cols && Math.round(v.y) === Math.floor(i / cols) && v.die <= 0);
    const va = at(a), vb = at(b);
    if (va) this.tween(va, b % cols, Math.floor(b / cols), RULES.swapSec, true);
    if (vb) this.tween(vb, a % cols, Math.floor(a / cols), RULES.swapSec, true);
  }

  private startStep(st: Step, q: Play, sim: FirmamentSim): void {
    const B = sim.board, cols = B.cols, L = this.L, u = L.u;
    this.onStep?.(st, q.fast);
    // the words of the move
    if (q.i === 0 && !q.fast) {
      const combo = q.res.tally.combo;
      const born = st.born[0]?.sp;
      if (combo && combo !== 'pulsar') {
        const w = combo === 'comet+comet' ? 'combo.cross' : combo === 'comet+nova' ? 'combo.big' : combo === 'nova+nova' ? 'combo.nova' : combo === 'pulsar+pulsar' ? 'combo.all' : combo.startsWith('meteor') ? 'combo.meteor' : 'combo.pulsar';
        this.say(t(w as 'combo.cross'), true);
        this.stop = 0.09;
      } else if (born && born !== 'none') this.say(t(`sp.${born}` as 'sp.nova'), false);
    } else if (!q.fast && st.cascade >= 2) {
      this.say(t(`word.${Math.min(4, st.cascade - 1)}` as 'word.1'), st.cascade >= 4);
    }
    // matched bodies: points fly
    for (const m of st.matches) {
      const p = this.cellXY(m.at, cols);
      this.floats.add(`+${m.points}`, p.x, p.y, { color: KIND_COLOR[m.kind]?.light ?? '#fff', size: (15 + Math.min(10, st.cascade * 2)) * u, dur: 0.9 });
    }
    for (const c of st.cleared) {
      const v = this.vis.get(c.id);
      if (v) { v.die = RULES.clearSec * (q.fast ? 0.6 : 1); v.t1 = -1; }
      const p = this.cellXY(c.at, cols);
      const col = c.kind >= 0 ? KIND_COLOR[c.kind].main : '#e6f6ff';
      this.parts.burst(p.x, p.y, q.fast ? 4 : 8, { color: col, speed: 150 * u + 40, g: 160, life: 0.55, size: 2.6 * u + 0.6, shape: 'spark' });
    }
    for (const b of st.blasts) this.blastFx(b, cols, q.fast);
    if (st.blasts.length) this.shake.add(Math.min(0.45, 0.12 * st.blasts.length));
    for (const c of st.clouds) {
      this.cloud[c.at] = c.layers;
      const p = this.cellXY(c.at, cols);
      this.parts.burst(p.x, p.y, 10, { color: '#b9a8ff', speed: 90, g: -30, life: 0.8, size: 4 * u, drag: 2 });
    }
    for (const r of st.rocks) {
      this.rock[r.at] = r.hp;
      const p = this.cellXY(r.at, cols);
      this.parts.burst(p.x, p.y, r.hp === 0 ? 18 : 8, { color: '#b8a48f', speed: 180, g: 380, life: 0.7, size: 3 * u, shape: 'square' });
    }
    for (const k of st.inks) {
      this.ink[k.at] = k.on ? 1 : 0;
      if (!k.on) {
        this.inkFade.set(k.at, 0.6);
        const p = this.cellXY(k.at, cols);
        this.parts.burst(p.x, p.y, 16, { color: '#fff2c8', speed: 120, g: -40, life: 0.8, shape: 'spark' });
      }
    }
    for (const at of st.locks) {
      this.lock[at] = 0;
      const p = this.cellXY(at, cols);
      this.parts.burst(p.x, p.y, 10, { color: '#e8eefc', speed: 160, g: 200, life: 0.5, shape: 'ring' });
    }
    for (const ch of st.changed) {
      const v = this.vis.get(ch.id);
      if (v) { v.sp = ch.sp; v.flash = 0.35; if (ch.sp === 'pulsar') v.kind = -1; }
    }
    for (const b of st.born) {
      const cx = b.at % cols, cy = Math.floor(b.at / cols);
      this.vis.set(b.id, { id: b.id, kind: b.sp === 'pulsar' ? -1 : b.kind, sp: b.sp, x: cx, y: cy, fx: cx, fy: cy, tx: cx, ty: cy, t0: 0, t1: 0, easeOut: false, die: 0, pop: 0.32, flash: 0.5 });
      const p = this.cellXY(b.at, cols);
      this.parts.burst(p.x, p.y, 20, { color: C.gold, speed: 140, g: 0, life: 0.6, shape: 'ring' });
    }
  }

  private fallStep(st: Step, sim: FirmamentSim): void {
    const cols = sim.board.cols;
    const fall = Math.max(0.08, st.dur - st.fall);
    for (const m of st.moves) {
      const v = this.vis.get(m.id);
      if (!v) continue;
      v.x = m.from % cols;
      v.y = Math.floor(m.from / cols);
      this.tween(v, m.to % cols, Math.floor(m.to / cols), fall, false);
    }
    for (const s of st.spawns) {
      const cx = s.to % cols;
      const v: Vis = { id: s.id, kind: s.sp === 'pulsar' ? -1 : s.kind, sp: s.sp, x: cx, y: s.fromRow, fx: cx, fy: s.fromRow, tx: cx, ty: Math.floor(s.to / cols), t0: 0, t1: 0, easeOut: false, die: 0, pop: 0, flash: 0 };
      this.vis.set(s.id, v);
      this.tween(v, cx, Math.floor(s.to / cols), fall, false);
    }
    for (const m of st.moons) {
      const v = this.vis.get(m.id);
      if (v) { v.die = 0.5; v.t1 = -1; }
      const p = this.cellXY(m.at, cols);
      this.floats.add(t('ev.moon'), p.x, p.y, { color: '#fff4c8', size: 18 * this.L.u, dur: 1.4 });
      this.parts.burst(p.x, p.y + this.L.cell * 0.4, 30, { color: '#fff4c8', speed: 200, g: 60, life: 1, shape: 'spark' });
    }
  }

  private blastFx(b: Blast, cols: number, fast: boolean): void {
    const p = this.cellXY(b.at, cols), L = this.L;
    const dur = fast ? 0.32 : 0.5;
    const beam = (kind: Blast['kind']) => this.beams.push({ kind, x: p.x, y: p.y, x2: p.x, y2: p.y, t: 0, dur, cells: b.cells });
    switch (b.kind) {
      case 'row': case 'col': case 'cross': case 'cross3': beam(b.kind); break;
      case 'nova': case 'nova5': beam(b.kind); this.parts.burst(p.x, p.y, 24, { color: '#ffd9a0', speed: 260, g: 0, life: 0.5, shape: 'spark' }); break;
      case 'kind': case 'all': beam(b.kind); this.stop = Math.max(this.stop, 0.06); break;
      case 'meteor': {
        const from = this.cellXY(b.from ?? b.at, cols);
        this.beams.push({ kind: 'meteor', x: from.x, y: from.y, x2: p.x, y2: p.y, t: 0, dur: RULES.flySec + 0.2, cells: b.cells });
        break;
      }
      case 'hammer': case 'star':
        this.beams.push({ kind: 'hammer', x: p.x, y: p.y, x2: p.x, y2: p.y, t: 0, dur: 0.4, cells: b.cells });
        this.parts.burst(p.x, p.y, 20, { color: C.gold, speed: 220, g: 200, life: 0.5, shape: 'spark' });
        break;
    }
    void L;
  }

  // ── hands ───────────────────────────────────────────────────────
  /** What a touch at (x, y) lands on: a card's button, a tool, or a body (a finger a little off the board takes the nearest one). */
  hit(sim: FirmamentSim, x: number, y: number): Hit | null {
    const h = this.hud.hit(x, y, this.L, sim);
    if (h) return h;
    const cell = this.cellAt(sim, x, y);
    return cell >= 0 ? { cell } : null;
  }

  /** The cell under (x, y), snapped from up to the layout's slop outside the board; -1 in the free sky. */
  cellAt(sim: FirmamentSim, x: number, y: number): number {
    const L = this.L, B = sim.board;
    if (!inRect(L.board, x, y, L.slop)) return -1;
    const c = clamp(Math.floor((x - L.board.x) / L.cell), 0, B.cols - 1), r = clamp(Math.floor((y - L.board.y) / L.cell), 0, B.rows - 1);
    return r * B.cols + c;
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: FirmamentSim): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(sim);
    if (!this.L) return;
    const off = this.shake.offset(1 / 60, 10);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawBoard(sim);
    this.drawBeams();
    this.drawStars();
    this.parts.draw(ctx);
    this.drawFloats();
    this.drawWord();
    ctx.restore();
    this.hud.draw(ctx, this.L, sim, this.clock);
  }

  /** The flying points and words: bold, with a shadow, popping in (never under the 11 px floor). */
  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats.items) {
      const k = f.t / f.dur;
      const pop = k < 0.18 ? 0.6 + 0.4 * ease.outBack(k / 0.18) : 1;
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      ctx.font = font(800, f.size * pop, SANS);
      const y = f.y - 46 * ease.outCubic(k);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillText(f.text, f.x, y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.restore();
  }

  private drawSky(sim: FirmamentSim): void {
    const ctx = this.ctx, w = this.w, h = this.h;
    if (!this.sky || this.sky.width !== Math.round(w * this.dpr)) {
      if (typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = Math.round(w * this.dpr);
        c.height = Math.round(h * this.dpr);
        const g = c.getContext('2d');
        if (g) { g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); paintSkyLayer(g, w, h, 3); }
        this.sky = c;
      }
    }
    if (this.sky) ctx.drawImage(this.sky, 0, 0, w, h);
    // calm brightens the sky: a soft blue dawn from below; focus warms the telescope's side
    if (sim.sky > 0.02) {
      const g = ctx.createLinearGradient(0, h, 0, h * 0.2);
      g.addColorStop(0, `rgba(90,150,255,${0.28 * sim.sky})`);
      g.addColorStop(1, 'rgba(90,150,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // a few twinkling stars of our own
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 13 + 1) * w, y = hash(i * 7 + 5) * h;
      const tw = 0.5 + 0.5 * Math.sin(this.clock * (1 + hash(i) * 2) + i);
      ctx.fillStyle = `rgba(255,248,220,${0.15 + 0.5 * tw * (0.5 + sim.sky)})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + tw * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** The board's glass, cell by cell, and the rim round the sky's shape: one layer per level and size. */
  private drawGlass(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, B = sim.board, s = L.cell;
    const paint = (g: CanvasRenderingContext2D, ox: number, oy: number) => {
      for (let i = 0; i < B.n; i++) {
        if (!B.mask[i]) continue;
        const x = ox + ((i % B.cols) + 0.5) * s, y = oy + (Math.floor(i / B.cols) + 0.5) * s;
        const odd = (Math.floor(i / B.cols) + (i % B.cols)) % 2;
        g.fillStyle = odd ? 'rgba(30,36,92,.72)' : 'rgba(22,27,74,.72)';
        g.beginPath();
        g.roundRect(x - s / 2 + 1, y - s / 2 + 1, s - 2, s - 2, s * 0.18);
        g.fill();
      }
      g.strokeStyle = 'rgba(255,220,150,.16)';
      g.lineWidth = 1;
      g.strokeRect(ox - 3, oy - 3, L.board.w + 6, L.board.h + 6);
    };
    const key = `${this.levelKey}|${L.board.x},${L.board.y},${s}|${this.dpr}`;
    if (!this.glass || this.glass.key !== key) {
      let c: HTMLCanvasElement | null = null;
      if (typeof document !== 'undefined') {
        c = document.createElement('canvas');
        c.width = Math.ceil((L.board.w + 8) * this.dpr);
        c.height = Math.ceil((L.board.h + 8) * this.dpr);
        const g = c.getContext('2d');
        if (g) { g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); paint(g, 4, 4); } else c = null;
      }
      this.glass = { key, c };
    }
    if (this.glass.c) ctx.drawImage(this.glass.c, L.board.x - 4, L.board.y - 4, L.board.w + 8, L.board.h + 8);
    else paint(ctx, L.board.x, L.board.y);
  }

  private drawBoard(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, B = sim.board, s = L.cell, T = this.clock;
    this.drawGlass(sim);
    for (let i = 0; i < B.n; i++) {
      if (!B.mask[i] || !(this.cloud[i] > 0)) continue;
      const { x, y } = this.cellXY(i, B.cols);
      this.sprites.cloud(ctx, x, y, this.cloud[i], i + 1);
    }
    // exits for the moons
    if (sim.level.goal === 'moons') {
      for (let i = 0; i < B.n; i++) if (B.exit[i] && B.mask[i] && Math.floor(i / B.cols) === B.rows - 1) {
        const { x, y } = this.cellXY(i, B.cols);
        paintExit(ctx, x, y + s * 0.5 + 2, s, T);
      }
    }
    // the hint, the selection and a finger's press under the bodies (a wide faint stroke for the glow, no blur)
    const ringCell = (i: number, color: string, glow: string | null) => {
      const { x, y } = this.cellXY(i, B.cols);
      ctx.beginPath();
      ctx.roundRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s - 6, s * 0.18);
      if (glow) {
        ctx.strokeStyle = glow;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };
    const idle = sim.stage === 'play' && !this.busy && sim.busyT <= 0;
    ctx.save();
    if (idle && sim.hintShown && sim.hint) {
      const k = 0.5 + 0.5 * Math.sin(T * 5);
      const c = `rgba(255,236,170,${0.35 + 0.5 * k})`, g = `rgba(255,236,170,${0.12 + 0.18 * k})`;
      ringCell(sim.hint.a, c, g);
      ringCell(sim.hint.b, c, g);
    }
    if (sim.selected >= 0) ringCell(sim.selected, '#ffffff', 'rgba(255,255,255,.25)');
    const press = this.press && sim.stage === 'play' ? this.press : null;
    if (press && press.cell !== sim.selected) ringCell(press.cell, 'rgba(255,255,255,.7)', 'rgba(255,255,255,.14)');
    ctx.restore();
    // bodies
    const bounce = this.bounce;
    // a pressed body leans toward the swipe (a quarter of a cell at most) and lifts a little
    let lean: { id: number; x: number; y: number } | null = null;
    if (press && B.cells[press.cell]) {
      const ax = Math.abs(press.dx) >= Math.abs(press.dy);
      const d = clamp((ax ? press.dx : press.dy) / s, -0.22, 0.22);
      lean = { id: B.cells[press.cell]!.id, x: ax ? d : 0, y: ax ? 0 : d };
    }
    for (const v of this.vis.values()) {
      let cx = v.x, cy = v.y;
      if (bounce) {
        const k = Math.sin(clamp(bounce.t / RULES.bounceSec) * Math.PI) * 0.45;
        const ai = Math.round(v.y) * B.cols + Math.round(v.x);
        const other = ai === bounce.a ? bounce.b : ai === bounce.b ? bounce.a : -1;
        if (other >= 0) {
          cx += ((other % B.cols) - v.x) * k;
          cy += (Math.floor(other / B.cols) - v.y) * k;
        }
      }
      let lift = 1;
      if (lean && lean.id === v.id && this.clock >= v.t1) {
        cx += lean.x;
        cy += lean.y;
        lift = 1.08;
      }
      if (cy < -0.6) continue;
      const p = this.px(cx, cy);
      let k = 1;
      if (v.die > 0) k = v.die / RULES.clearSec;
      else if (v.pop > 0) k = 1 + Math.sin((1 - v.pop / 0.32) * Math.PI) * 0.35;
      if (k <= 0.02) continue;
      const clipTop = L.board.y - s * 0.1;
      if (p.y < clipTop) continue;
      this.drawPiece(v, p.x, p.y, s, k * lift);
    }
    // what sits on top of a cell: locks, asteroids, ink
    for (let i = 0; i < B.n; i++) {
      if (!B.mask[i]) continue;
      if (!this.lock[i] && !(this.rock[i] > 0) && !this.ink[i] && !this.inkFade.has(i)) continue;
      const { x, y } = this.cellXY(i, B.cols);
      if (this.lock[i]) paintLock(ctx, x, y, s * 0.4, T + i);
      if (this.rock[i] > 0) paintRock(ctx, x, y, s * 0.44, this.rock[i], i + 3);
      if (this.ink[i]) paintInk(ctx, x, y, s, T, i);
      const fade = this.inkFade.get(i);
      if (fade !== undefined) {
        ctx.save();
        ctx.globalAlpha = fade / 0.6;
        ctx.fillStyle = '#fff3cf';
        ctx.beginPath();
        ctx.arc(x, y, s * 0.5 * (1.6 - fade), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // the keyboard's cursor
    if (sim.cursor >= 0 && sim.stage === 'play' && !this.opts.touch) {
      const { x, y } = this.cellXY(sim.cursor, B.cols);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4);
      ctx.restore();
    }
    // an armed tool: the board's frame pulses, and while a finger is down it shows where the tool will strike
    const tool = sim.armedTool;
    if (tool) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,210,122,${0.5 + 0.4 * Math.sin(T * 6)})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(L.board.x - 5, L.board.y - 5, L.board.w + 10, L.board.h + 10);
      ctx.setLineDash([]);
      if (this.aim >= 0 && this.aim < B.n && B.mask[this.aim]) {
        const { x, y } = this.cellXY(this.aim, B.cols);
        ctx.fillStyle = 'rgba(255,210,122,.22)';
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 2.5;
        if (tool === 'ray') {
          ctx.beginPath();
          ctx.roundRect(L.board.x + 2, y - s / 2 + 2, L.board.w - 4, s - 4, s * 0.2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.roundRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4, s * 0.2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  private drawPiece(v: Vis, x: number, y: number, s: number, k: number): void {
    const ctx = this.ctx, T = this.clock;
    const r = s * 0.4 * k;
    if (v.kind === MOON) { paintMoon(ctx, x, y, r * 0.95, T + v.id); return; }
    if (v.sp === 'pulsar' || v.kind < 0) { paintPulsar(ctx, x, y, r * 1.05, T); return; }
    // a breath of life: bodies bob very slightly
    const bob = this.opts.reducedMotion ? 0 : Math.sin(T * 2 + v.id) * s * 0.012;
    this.sprites.body(ctx, v.kind, x, y + bob, k);
    if (v.sp === 'row' || v.sp === 'col') paintCometMark(ctx, x, y + bob, r, v.sp, T);
    else if (v.sp === 'nova') paintNovaMark(ctx, x, y + bob, r, T, false);
    else if (v.sp === 'meteor') paintMeteorMark(ctx, x, y + bob, r, T);
    if (v.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, v.flash * 2);
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBeams(): void {
    const ctx = this.ctx, L = this.L, s = L.cell;
    for (const b of this.beams) {
      const k = b.t / b.dur, a = 1 - k;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const line = (x0: number, y0: number, x1: number, y1: number, wd: number) => {
        ctx.strokeStyle = `rgba(255,240,200,${0.85 * a})`;
        ctx.lineWidth = wd * (1 - k * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = wd * 0.3;
        ctx.stroke();
      };
      const reach = ease.outCubic(clamp(k * 2.2));
      const bx0 = L.board.x, bx1 = L.board.x + L.board.w, by0 = L.board.y, by1 = L.board.y + L.board.h;
      const row = (y: number) => line(b.x - (b.x - bx0) * reach, y, b.x + (bx1 - b.x) * reach, y, s * 0.42);
      const col = (x: number) => line(x, b.y - (b.y - by0) * reach, x, b.y + (by1 - b.y) * reach, s * 0.42);
      switch (b.kind) {
        case 'row': row(b.y); break;
        case 'col': col(b.x); break;
        case 'cross': row(b.y); col(b.x); break;
        case 'cross3': for (const d of [-1, 0, 1]) { row(b.y + d * s); col(b.x + d * s); } break;
        case 'nova': case 'nova5': {
          const R = s * (b.kind === 'nova' ? 1.6 : 2.6) * ease.outCubic(clamp(k * 1.6));
          const g = ctx.createRadialGradient(b.x, b.y, R * 0.2, b.x, b.y, R);
          g.addColorStop(0, `rgba(255,236,190,${0.8 * a})`);
          g.addColorStop(1, 'rgba(255,150,80,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255,220,160,${a})`;
          ctx.lineWidth = 3;
          ctx.stroke();
          break;
        }
        case 'kind': case 'all':
          for (const c of b.cells.slice(0, 64)) {
            const p = this.cellXY(c);
            line(b.x, b.y, b.x + (p.x - b.x) * reach, b.y + (p.y - b.y) * reach, s * 0.12);
          }
          if (b.kind === 'all') { ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`; ctx.fillRect(bx0, by0, L.board.w, L.board.h); }
          break;
        case 'meteor': {
          const kk = ease.inOutSine(clamp(b.t / RULES.flySec));
          const arc = Math.sin(kk * Math.PI) * s * 1.6;
          const x = b.x + (b.x2 - b.x) * kk, y = b.y + (b.y2 - b.y) * kk - arc;
          const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.6);
          g.addColorStop(0, 'rgba(255,230,160,1)');
          g.addColorStop(1, 'rgba(255,110,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
          ctx.fill();
          if (b.t > RULES.flySec) {
            const R = s * 1.2 * clamp((b.t - RULES.flySec) / 0.2);
            ctx.strokeStyle = `rgba(255,200,120,${a * 2})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(b.x2, b.y2, R, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }
        case 'hammer': case 'star': {
          paintStar(ctx, b.x, b.y - s * 0.8 * (1 - ease.outCubic(clamp(k * 3))), s * 0.45, a, C.gold);
          ctx.strokeStyle = `rgba(255,220,140,${a})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(b.x, b.y, s * 0.9 * k, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
  }

  private drawStars(): void {
    const ctx = this.ctx;
    for (const s of this.stars) {
      if (s.dur <= 0) continue;
      const k = ease.inOutSine(clamp(s.t / s.dur));
      const p = this.cellXY(s.at);
      const x = s.x0 + (p.x - s.x0) * k, y = s.y0 + (p.y - s.y0) * k;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(s.x0 + (p.x - s.x0) * Math.max(0, k - 0.25), s.y0 + (p.y - s.y0) * Math.max(0, k - 0.25), x, y);
      g.addColorStop(0, 'rgba(200,225,255,0)');
      g.addColorStop(1, s.gold ? 'rgba(255,225,150,1)' : 'rgba(220,235,255,1)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x0 + (p.x - s.x0) * Math.max(0, k - 0.25), s.y0 + (p.y - s.y0) * Math.max(0, k - 0.25));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      paintStar(ctx, x, y, 9, 1, s.gold ? C.gold : '#e6f0ff');
    }
  }

  private drawWord(): void {
    const wd = this.word;
    if (!wd) return;
    const ctx = this.ctx, L = this.L;
    const k = wd.t / 1.3;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const size = (wd.big ? 44 : 34) * L.u * pop;
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.font = font(700, size, SERIF, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = L.board.x + L.board.w / 2, y = L.board.y + L.board.h * 0.42 - k * 20;
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.strokeStyle = 'rgba(40,20,80,.85)';
    ctx.strokeText(wd.text, x, y);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#fff7d6');
    g.addColorStop(1, '#ffb44a');
    ctx.fillStyle = g;
    ctx.fillText(wd.text, x, y);
    ctx.restore();
  }

  /** The telescope's tray pick needs the slot under a point (the hud knows). */
  toolAt(x: number, y: number): number {
    return this.L.tray.findIndex(r => inRect(r, x, y, 4));
  }

  /** For index.ts: the canvas size the view lays out for. */
  get size(): { w: number; h: number } { return { w: this.w, h: this.h }; }
}
