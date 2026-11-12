/**
 * Geoda's picture: the cave and the geode (cached per size), the 8×8 board of crystal tiles, rock,
 * jewels and the druses the band grows, the band's last 40 s as a row of crystal points on the
 * geode's foot, the tray of three pieces, the dragged piece lifted above the finger with its snap
 * ghost and the lines it would clear lit, the shine dial, the chamber's goal, the Szlif's bowl,
 * Bazyl with his bubble, and the story cards.  Juice: placed cells pop, cleared lines sweep and
 * burst into shards with a hit-stop, numbers and praise fly, the combo climbs, big clears shake.
 *
 * The runner draws the standard HUD (the Mendi panel, the score corner) above the canvas; nothing
 * important is drawn under it (`insets().top`).  Mobile first (DESIGN §3.1, §12): on a phone the dragged piece
 * floats clear of the thumb and snaps to the nearest spot it fits, the shine and the goal use the board's
 * margins on a small phone, every word is 13 px or more, and nothing blurs per frame (offset shapes instead).
 */
import { MIN_READ, NO_INSETS, fitText } from '../kit/mobile';
import { passage } from '../kit/scripture';
import { layoutPassage, REF_FONT, VERSE_FONT, type Passage, type PassageLayout } from '../kit/scripture';
import { traceBars } from '../kit/trace';
import type { Insets } from '../kit/types';
import { clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import { drawGeode, drawSpecimen, fitFont, fitLines, GEODE_REACH, rrect, sparkle, TileCache } from './art';
import { EMPTY, idx, N, ROCK, type TrayItem } from './board';
import { chamberName, chamberStory, GEMS, JEWELS, MINERALS, TIERS, type Piece } from './content';
import { fmt, pct, t } from './i18n';
import { boardAt, computeLayout, trayCellFor, type Box, type Layout } from './layout';
import { C, paintBowl, paintBubble, paintCave, paintDial, paintDruse, paintJewel, paintMole, paintShineColumn, paintSkyline, SANS, SERIF, type MolePose } from './paint';
import type { GeodaEvent, GeodaSim } from './sim';

/** The finger's part: a piece being dragged (where the finger is), or a tray slot pressed. */
export interface Hand {
  drag: { slot: number; x: number; y: number; t: number } | null;
  /** how long the player has been idle (s): the auto-place ghost shows after a while */
  idle: number;
}

interface Clearing { i: number; tile: number; jewel: number; t: number; delay: number }
interface Fly { kind: number; x: number; y: number; t: number }
interface Back { slot: number; item: TrayItem; x: number; y: number; t: number }

const POP = 0.28;

export class GeodaView {
  layout: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tiles = new TileCache();
  private readonly fx = new Particles(500);
  private readonly words = new Floaters();
  private readonly shake: Shake;
  private bg: HTMLCanvasElement | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private top = 0;
  private clock = 0;
  private stop = 0;
  private readonly pop = new Float32Array(N * N).fill(9);
  private clearing: Clearing[] = [];
  private flies: Fly[] = [];
  private backs: Back[] = [];
  private readonly trayIn = [9, 9, 9];
  private stuck = -1;
  private stuckT = 9;
  private multPop = 0;
  private dialShown = 0;
  private gemShow: { text: string; m: number; tier: number; t: number } | null = null;
  private verse: { lay: PassageLayout; w: number } | null = null;
  private readonly mole: MolePose = { t: 0, cheer: 0, oops: 0, talk: false, lamp: 0.4, face: 1 };
  private cheerT = 0;
  private oopsT = 0;
  private mood = 0;
  private flash = 0;
  private readonly touch: boolean;
  /** the tray slot a finger (or the mouse) is pressing: drawn pressed until it lifts */
  pressed = -1;

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; touch?: boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Geoda needs a 2D canvas');
    this.ctx = ctx;
    this.touch = !!opts.touch;
    this.shake = new Shake(opts.reducedMotion);
    this.layout = computeLayout(1, 1, NO_INSETS, this.touch);
  }

  resize(w: number, h: number, dpr: number, insets: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.top = insets.top;
    this.layout = computeLayout(w, h, insets, this.touch);
    this.tiles.setDpr(dpr);
    this.bg = null;
    this.verse = null;
  }

  /** The cave and the geode around the board, drawn once per size. */
  private background(): HTMLCanvasElement | null {
    if (this.bg) return this.bg;
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w * this.dpr));
    c.height = Math.max(1, Math.round(this.h * this.dpr));
    const g = c.getContext('2d');
    if (!g) return null;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    paintCave(g, this.w, this.h, 0, 0);
    drawGeode(g, this.layout.board, this.layout.rim);
    this.bg = c;
    return c;
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: GeodaEvent, sim: GeodaSim): void {
    const L = this.layout, cs = L.cell;
    const cx = (i: number) => L.board.x + (i % N + 0.5) * cs, cy = (i: number) => L.board.y + (Math.floor(i / N) + 0.5) * cs;
    switch (e.type) {
      case 'deal':
        for (let k = 0; k < 3; k++) this.trayIn[k] = -k * 0.06;
        this.stuck = -1;
        break;
      case 'place': {
        for (const i of e.placed.cells) this.pop[i] = 0;
        const mx = e.placed.cells.reduce((s, i) => s + cx(i), 0) / e.placed.cells.length;
        const my = e.placed.cells.reduce((s, i) => s + cy(i), 0) / e.placed.cells.length;
        const tile = GEMS[(e.item.tile - 1) % GEMS.length];
        this.fx.burst(mx, my, 6, { color: tile.light, size: 2, speed: 90, life: 0.4, g: 200 });
        if (e.lines) {
          for (const c of e.placed.cleared) {
            const d = Math.hypot(cx(c.i) - mx, cy(c.i) - my) / cs;
            this.clearing.push({ i: c.i, tile: c.tile, jewel: c.jewel, t: 0, delay: d * 0.022 });
          }
          this.stop = [0.04, 0.06, 0.09][Math.min(2, e.lines - 1)];
          this.shake.add(e.lines >= 3 ? 0.45 : e.lines === 2 ? 0.22 : 0.08);
          this.flash = Math.min(1, 0.25 + 0.15 * e.lines);
          const pts = e.points - e.item.piece.cells.length;
          const big = Math.min(46, 22 + e.lines * 4 + e.combo);
          if (!e.blind && pts > 0) this.words.add(`+${fmt(pts)}`, mx, my - cs * 0.3, { color: e.mult >= 3 ? C.gold : C.ink, size: big * 0.8, dur: 1.1 });
          if (e.blind) this.words.add('+?', mx, my - cs * 0.3, { color: '#a99bd0', size: big * 0.7 });
          if (e.mult >= 2 && !e.blind) this.words.add(`×${e.mult}`, mx + cs * 1.2, my - cs * 0.9, { color: C.gold, size: big * 0.6, dur: 0.9 });
          const praise = e.lines >= 2 ? t(`v.praise${Math.min(4, e.lines - 1)}` as 'v.praise1') : e.combo >= 3 ? t('v.praise1') : '';
          const bx = L.board.x + L.board.w / 2, by = L.board.y + L.board.h * 0.38;
          if (e.clean) this.words.add(t('v.clean'), bx, by, { color: C.gold, size: Math.min(48, cs * 0.9), dur: 1.8 });
          else if (praise) this.words.add(praise, bx, by, { color: '#fff1c2', size: Math.min(44, cs * 0.8), dur: 1.3 });
          if (e.combo >= 2) this.words.add(t('v.combo', { n: e.combo }), bx, by + cs * 0.9, { color: mixCombo(e.combo), size: Math.min(36, cs * 0.55 + e.combo), dur: 1.2 });
          if (e.lines >= 2 || e.combo >= 4) this.cheer();
        }
        if (e.druse > 0) {
          for (const i of e.placed.druseCells) this.fx.burst(cx(i), cy(i), 8, { color: C.gold, size: 2.4, speed: 140, life: 0.6, shape: 'spark', g: 120 });
          this.words.add(t('v.druse', { n: fmt(e.druse * (e.blind ? 1 : e.mult)) }), mx, my + cs * 0.6, { color: C.gold, size: 18, dur: 1.1 });
        }
        break;
      }
      case 'miss':
        this.oops();
        break;
      case 'stuck':
        this.stuck = e.slot;
        this.stuckT = 0;
        break;
      case 'jewel':
        this.flies.push({ kind: e.kind, x: cx(e.i), y: cy(e.i), t: 0 });
        break;
      case 'mult':
        if (e.up) this.multPop = 1;
        break;
      case 'turn':
        this.oops();
        this.shake.add(0.3);
        break;
      case 'level':
        this.cheer();
        for (let k = 0; k < 4; k++) this.fx.burst(L.card.x + L.card.w * (0.2 + 0.2 * k), L.card.y + L.card.h * 0.3, 18, { color: k % 2 ? C.gold : '#c8f3ff', size: 3, speed: 220, life: 1.2, shape: 'square' });
        break;
      case 'gem': {
        const m = MINERALS[e.mineral];
        const text = e.outcome === 'new' ? t('v.gemNew', { mineral: m.title }) : e.outcome === 'up' ? t('v.gemUp', { mineral: m.title, tier: TIERS[e.tier] }) : t('v.gemSame', { mineral: m.title, tier: TIERS[e.tier] });
        this.gemShow = { text, m: e.mineral, tier: e.tier, t: 0 };
        if (L.mode === 'columns') this.words.add(text, L.board.x + L.board.w / 2, L.board.y + L.board.h * 0.3, { color: C.gold, size: 16, dur: 2.4 });
        const b = L.bowl;
        this.fx.burst(b.x + b.w / 2, b.y + b.h * 0.4, 24, { color: e.polished ? C.gold : '#e8e0ff', size: 2.5, speed: 160, life: 1, shape: 'spark', g: 60 });
        if (e.points > 0) this.words.add(`+${fmt(e.points)}`, b.x + b.w / 2, b.y + b.h * 0.2, { color: C.gold, size: 24 });
        if (e.polished) this.cheer();
        break;
      }
      case 'reveal':
        if (e.points > 0) this.words.add(`${t('v.reveal', { n: e.mult })}  +${fmt(e.points)}`, L.board.x + L.board.w / 2, L.board.y + L.board.h * 0.45, { color: C.gold, size: Math.min(34, L.cell * 0.6), dur: 2 });
        break;
      default:
        break;
    }
    void sim;
  }

  private cheer(): void { this.cheerT = 0.9; }
  private oops(): void { this.oopsT = 0.8; }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, sim: GeodaSim): void {
    this.clock += dt;
    const live = this.stop > 0 ? 0 : dt;
    this.stop = Math.max(0, this.stop - dt);
    for (let i = 0; i < N * N; i++) if (this.pop[i] < 9) this.pop[i] += live;
    for (const c of this.clearing) c.t += live;
    const L = this.layout;
    for (const c of this.clearing) {
      if (c.t >= c.delay && c.t - live < c.delay) {
        const x = L.board.x + (c.i % N + 0.5) * L.cell, y = L.board.y + (Math.floor(c.i / N) + 0.5) * L.cell;
        const g = c.tile === ROCK ? { light: '#8a7d73', base: '#5b4f47' } : GEMS[(c.tile - 1) % GEMS.length];
        this.fx.burst(x, y, 7, { color: g.light, size: L.cell * 0.09, speed: L.cell * 4, life: 0.7, shape: 'square', g: 700 });
        this.fx.burst(x, y, 3, { color: g.base, size: L.cell * 0.06, speed: L.cell * 3, life: 0.5, shape: 'spark', g: 300 });
      }
    }
    this.clearing = this.clearing.filter(c => c.t < c.delay + 0.5);
    this.flies.forEach(f => (f.t += dt));
    this.flies = this.flies.filter(f => f.t < 0.9);
    this.backs.forEach(b => (b.t += dt));
    this.backs = this.backs.filter(b => b.t < 0.25);
    for (let k = 0; k < 3; k++) this.trayIn[k] += dt;
    this.stuckT += dt;
    this.fx.update(live);
    this.words.update(dt);
    this.multPop = Math.max(0, this.multPop - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.dialShown += (sim.dial - this.dialShown) * Math.min(1, dt * 8);
    if (this.gemShow) {
      this.gemShow.t += dt;
      if (this.gemShow.t > 4) this.gemShow = null;
    }
    this.cheerT = Math.max(0, this.cheerT - dt);
    this.oopsT = Math.max(0, this.oopsT - dt);
    this.mole.t = this.clock;
    this.mole.cheer = clamp(this.cheerT / 0.4);
    this.mole.oops = clamp(this.oopsT / 0.4);
    this.mole.talk = !!sim.talk.line;
    this.mole.lamp = sim.blind ? 0 : sim.sighted ? 0.3 + 0.7 * sim.dial : 0.3;
    const want = sim.sighted ? 0.4 + sim.dial * 0.8 : sim.restBlock ? -0.8 : 0;
    this.mood += (want - this.mood) * Math.min(1, dt * 2);
  }

  /** A dragged piece that did not land flies back to its slot. */
  sendBack(slot: number, item: TrayItem, x: number, y: number): void {
    this.backs.push({ slot, item, x, y, t: 0 });
  }

  /**
   * Where a dragged piece sits (its top-left, CSS px) for a finger at (x, y): centred over it, its lower edge
   * `layout.lift` above it — a cell under a mouse, clear of the thumb (56 px and more) under a finger.
   */
  dragOrigin(p: Piece, x: number, y: number): { x: number; y: number } {
    const L = this.layout, cs = L.cell;
    return { x: x - (p.w * cs) / 2, y: y - L.lift - p.h * cs };
  }

  /**
   * The board spot a dragged piece snaps to: the nearest spot where it fits, within 0.95 of a cell under a mouse
   * and 1.35 under a finger (a fingertip is not a cursor), or null.
   */
  snap(sim: GeodaSim, p: Piece, x: number, y: number): { gx: number; gy: number } | null {
    const L = this.layout, o = this.dragOrigin(p, x, y);
    const fx = (o.x - L.board.x) / L.cell, fy = (o.y - L.board.y) / L.cell;
    const reach = this.touch ? 1.35 : 0.95;
    let best: { gx: number; gy: number } | null = null, bd = Infinity;
    for (let gy = Math.round(fy) - 2; gy <= Math.round(fy) + 2; gy++) {
      for (let gx = Math.round(fx) - 2; gx <= Math.round(fx) + 2; gx++) {
        if (!sim.board.fits(p, gx, gy)) continue;
        const d = Math.hypot(gx - fx, gy - fy);
        if (d < bd && d <= reach) { bd = d; best = { gx, gy }; }
      }
    }
    return best;
  }

  /** A cell under a point (for taps), with a margin around the board. */
  cellAt(x: number, y: number): [number, number] | null { return boardAt(this.layout, x, y); }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: GeodaSim, hand: Hand): void {
    const ctx = this.ctx, L = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = this.background();
    if (bg) ctx.drawImage(bg, 0, 0, this.w, this.h);
    else paintCave(ctx, this.w, this.h, 0, this.clock);
    this.moodLight();
    const sh = this.shake.offset(1 / 60, Math.min(10, L.cell * 0.18));
    ctx.save();
    ctx.translate(sh.x, sh.y);
    this.drawBoard(sim);
    this.drawSkyline(sim);
    this.drawPreview(sim, hand);
    this.drawClearing();
    ctx.restore();
    this.drawTray(sim, hand);
    // the shine (a dial, or a column in a small phone's margin), the goal, the Szlif's bowl in a rest
    const rest = sim.restBlock || !!this.gemShow;
    if (L.mode === 'wide') {
      this.drawDial(sim);
      this.drawBowl(sim);
      this.drawGoal(sim);
    } else if (L.mode === 'strip') {
      this.drawDial(sim);
      if (rest) this.drawBowl(sim); else this.drawGoal(sim);
    } else {
      if (rest) this.drawBowlColumn(sim); else this.drawDial(sim);
      this.drawGoal(sim);
    }
    this.drawMole(sim, hand);
    this.drawFlies(sim);
    this.drawDragged(sim, hand);
    this.fx.draw(ctx);
    this.words.draw(ctx, SANS);
    if (sim.story) this.drawStory(sim);
  }

  private moodLight(): void {
    const ctx = this.ctx, L = this.layout;
    const m = this.mood;
    if (Math.abs(m) < 0.02 && this.flash <= 0) return;
    const cx = L.board.x + L.board.w / 2, cy = L.board.y + L.board.h / 2;
    const r = ctx.createRadialGradient(cx, cy, L.board.w * 0.3, cx, cy, Math.max(this.w, this.h) * 0.75);
    const k = Math.min(1, Math.abs(m));
    r.addColorStop(0, m > 0 ? `rgba(255,190,90,${(0.2 * k + 0.25 * this.flash).toFixed(3)})` : `rgba(120,190,255,${(0.16 * k + 0.2 * this.flash).toFixed(3)})`);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawBoard(sim: GeodaSim): void {
    const ctx = this.ctx, L = this.layout, cs = L.cell, b = sim.board;
    const clarity = sim.sighted && sim.mult >= 4 ? 3 : sim.blind ? 1 : 2;
    const clearingSet = new Set(this.clearing.filter(c => c.t < c.delay).map(c => c.i));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = idx(x, y), px = L.board.x + x * cs, py = L.board.y + y * cs;
        const v = b.cells[i];
        if (v === EMPTY && !clearingSet.has(i)) {
          this.tiles.draw(ctx, 'slate', (i * 7) % 8, 0, px, py, cs);
          if (b.seeded[i] && b.druse[i] > 0.01) paintDruse(ctx, px, py, cs, b.druse[i], i * 3.7, this.clock);
          continue;
        }
        if (v === EMPTY) continue;
        const k = this.pop[i] < POP ? 1 + 0.18 * Math.sin((this.pop[i] / POP) * Math.PI) : 1;
        if (v === ROCK) this.tiles.drawScaled(ctx, 'rock', (i * 5) % 8, 0, px, py, cs, k);
        else this.tiles.drawScaled(ctx, 'gem', v - 1, clarity, px, py, cs, k);
        if (b.jewel[i]) paintJewel(ctx, px + cs / 2, py + cs / 2, cs * 0.3, b.jewel[i], this.clock);
      }
    }
    // the shine across the crystals when it is gold
    if (sim.sighted && sim.mult >= 3) {
      const s = (this.clock * 0.35) % 1.6 - 0.3;
      const gx = L.board.x + L.board.w * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.board.x, L.board.y, L.board.w, L.board.h);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(gx - cs * 1.5, L.board.y, gx + cs * 1.5, L.board.y + L.board.h * 0.3);
      g.addColorStop(0, 'rgba(255,230,160,0)');
      g.addColorStop(0.5, `rgba(255,230,160,${(0.1 + 0.05 * (sim.mult - 3)).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(L.board.x, L.board.y, L.board.w, L.board.h);
      ctx.restore();
    }
  }

  private drawSkyline(sim: GeodaSim): void {
    const L = this.layout;
    const reach = L.rim * GEODE_REACH;
    const n = Math.max(16, Math.min(60, Math.round(L.board.w / 9)));
    const bars = traceBars(sim.trace, sim.t, n);
    paintSkyline(this.ctx, bars, L.board.x + L.cell * 0.3, L.board.y + L.board.h + reach - 3, L.board.w - L.cell * 0.6, reach * 0.62);
  }

  private drawPreview(sim: GeodaSim, hand: Hand): void {
    const ctx = this.ctx, L = this.layout, cs = L.cell;
    let slot = -1, gx = 0, gy = 0, ghost = 0.45;
    if (hand.drag) {
      const item = sim.tray[hand.drag.slot];
      if (!item) return;
      const s = this.snap(sim, item.piece, hand.drag.x, hand.drag.y);
      if (!s) return;
      slot = hand.drag.slot;
      gx = s.gx;
      gy = s.gy;
    } else if (hand.idle > 2.5 && !sim.story) {
      const a = sim.autoSpot();
      if (!a) return;
      slot = a.slot;
      gx = a.gx;
      gy = a.gy;
      ghost = 0.18 + 0.1 * Math.sin(this.clock * 4);
    } else return;
    const item = sim.tray[slot]!;
    const p = item.piece;
    const clear = sim.board.wouldClear(p, gx, gy);
    const tile = item.tile - 1;
    // the lines it would clear: their crystals take the piece's colour and glow
    if (hand.drag && (clear.rows.length || clear.cols.length)) {
      const g = GEMS[tile % GEMS.length];
      ctx.save();
      for (const r of clear.rows) for (let x = 0; x < N; x++) this.tiles.draw(ctx, 'gem', tile, 3, L.board.x + x * cs, L.board.y + r * cs, cs);
      for (const c of clear.cols) for (let y = 0; y < N; y++) this.tiles.draw(ctx, 'gem', tile, 3, L.board.x + c * cs, L.board.y + y * cs, cs);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,240,200,${(0.12 + 0.08 * Math.sin(this.clock * 10)).toFixed(3)})`;
      for (const r of clear.rows) ctx.fillRect(L.board.x, L.board.y + r * cs, L.board.w, cs);
      for (const c of clear.cols) ctx.fillRect(L.board.x + c * cs, L.board.y, cs, L.board.h);
      ctx.restore();
      void g;
    }
    ctx.save();
    ctx.globalAlpha = ghost;
    for (const [x, y] of p.cells) this.tiles.draw(ctx, 'gem', tile, 2, L.board.x + (gx + x) * cs, L.board.y + (gy + y) * cs, cs);
    ctx.restore();
    if (!hand.drag) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,236,190,.55)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      for (const [x, y] of p.cells) ctx.strokeRect(L.board.x + (gx + x) * cs + 3, L.board.y + (gy + y) * cs + 3, cs - 6, cs - 6);
      ctx.restore();
    }
  }

  private drawClearing(): void {
    const ctx = this.ctx, L = this.layout, cs = L.cell;
    for (const c of this.clearing) {
      const px = L.board.x + (c.i % N) * cs, py = L.board.y + Math.floor(c.i / N) * cs;
      if (c.t < c.delay) {
        // waiting for the sweep: lit up
        if (c.tile === ROCK) this.tiles.draw(ctx, 'rock', (c.i * 5) % 8, 0, px, py, cs);
        else this.tiles.draw(ctx, 'gem', c.tile - 1, 3, px, py, cs);
        ctx.fillStyle = 'rgba(255,250,230,.35)';
        rrect(ctx, px + 2, py + 2, cs - 4, cs - 4, cs * 0.15);
        ctx.fill();
        if (c.jewel) paintJewel(ctx, px + cs / 2, py + cs / 2, cs * 0.3, c.jewel, this.clock);
      } else {
        const k = clamp((c.t - c.delay) / 0.22);
        if (k >= 1) continue;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#fffbe8';
        const s = cs * (1 - 0.6 * k);
        rrect(ctx, px + (cs - s) / 2, py + (cs - s) / 2, s, s, s * 0.2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** A piece's cells at (x, y) with cell size s. */
  private piece(item: TrayItem, x: number, y: number, s: number, alpha = 1, clarity = 2): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    item.piece.cells.forEach(([cx, cy], k) => {
      this.tiles.draw(ctx, 'gem', item.tile - 1, clarity, x + cx * s, y + cy * s, s);
      if (k === item.jewelAt && item.jewel) paintJewel(ctx, x + (cx + 0.5) * s, y + (cy + 0.5) * s, s * 0.3, item.jewel, this.clock);
    });
    ctx.restore();
  }

  private drawTray(sim: GeodaSim, hand: Hand): void {
    const ctx = this.ctx, L = this.layout;
    for (let k = 0; k < 3; k++) {
      const s = L.slots[k];
      const item = sim.tray[k];
      const sel = k === sim.current && !hand.drag && !!item;
      const down = k === this.pressed && !!item && !hand.drag;
      // the slot's hollow (lit on touch-down)
      ctx.save();
      ctx.fillStyle = down ? 'rgba(255,211,107,.2)' : sel ? 'rgba(255,211,107,.10)' : 'rgba(255,255,255,.035)';
      ctx.strokeStyle = sel || down ? 'rgba(255,211,107,.6)' : 'rgba(255,255,255,.08)';
      ctx.lineWidth = sel || down ? 2 : 1;
      rrect(ctx, s.x + 4, s.y + 4, s.w - 8, s.h - 8, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (!item || (hand.drag && hand.drag.slot === k)) continue;
      if (this.backs.some(b => b.slot === k)) continue;
      const p = item.piece;
      const tc = trayCellFor(L, s, p.w, p.h);
      const inK = clamp(this.trayIn[k] / 0.3);
      const slide = (1 - ease.outBack(inK)) * (L.portrait ? s.h * 0.8 : s.w * 0.8);
      const fits = sim.board.fitsAnywhere(p);
      const ox = s.x + (s.w - p.w * tc) / 2 + (L.portrait ? 0 : slide), oy = s.y + (s.h - p.h * tc) / 2 + (L.portrait ? slide : 0);
      const wob = this.stuck === k && this.stuckT < 0.5 ? Math.sin(this.stuckT * 40) * 3 * (1 - this.stuckT * 2) : 0;
      if (down) {
        // a pressed piece rises a little toward the finger's drag
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1.08, 1.08);
        ctx.translate(-cx, -cy);
        this.piece(item, ox + wob, oy, tc, inK * (fits ? 1 : 0.35));
        ctx.restore();
      } else this.piece(item, ox + wob, oy, tc, inK * (fits ? 1 : 0.35));
      if (!fits) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        // one line down to 13 px, else two ("får inte / plats" in a small phone's slot)
        const room = s.w - 14;
        const two = fitLines(ctx, t('v.stuck'), Math.max(MIN_READ, Math.min(15, s.h * 0.16)), room, SANS, 700, MIN_READ, MIN_READ);
        const lines = two.lines.slice(0, 2);
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(20,14,28,.8)';
        ctx.fillStyle = 'rgba(255,190,170,.95)';
        lines.forEach((l, i) => {
          const word = fitText(ctx, l, room, two.size, 700, SANS, MIN_READ);
          const y = s.y + s.h - 10 - (lines.length - 1 - i) * two.size * 1.15;
          ctx.strokeText(word, s.x + s.w / 2, y);
          ctx.fillText(word, s.x + s.w / 2, y);
        });
        ctx.restore();
      }
    }
    for (const b of this.backs) {
      const s = L.slots[b.slot];
      const k = ease.outCubic(clamp(b.t / 0.25));
      const tc = trayCellFor(L, s, b.item.piece.w, b.item.piece.h);
      const tx = s.x + (s.w - b.item.piece.w * tc) / 2, ty = s.y + (s.h - b.item.piece.h * tc) / 2;
      const o = this.dragOrigin(b.item.piece, b.x, b.y);
      // drawn at the board's size and scaled (a sprite per in-between size would fill the tile cache)
      const sc = (L.cell + (tc - L.cell) * k) / L.cell;
      ctx.save();
      ctx.translate(o.x + (tx - o.x) * k, o.y + (ty - o.y) * k);
      ctx.scale(sc, sc);
      this.piece(b.item, 0, 0, L.cell, 0.9);
      ctx.restore();
    }
  }

  private drawDragged(sim: GeodaSim, hand: Hand): void {
    if (!hand.drag) return;
    const item = sim.tray[hand.drag.slot];
    if (!item) return;
    const L = this.layout, ctx = this.ctx, p = item.piece, cs = L.cell;
    const grow = ease.outCubic(clamp(hand.drag.t / 0.12));
    const s = L.slots[hand.drag.slot];
    const tc = trayCellFor(L, s, p.w, p.h);
    // it grows from the tray's size to the board's, scaled from the board-size sprites
    const k = (tc + (cs - tc) * grow) / cs;
    const o = this.dragOrigin(p, hand.drag.x, hand.drag.y);
    const cx = o.x + (p.w * cs) / 2, cy = o.y + (p.h * cs) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
    // its shadow: the cells' shapes, offset and dark (no blur per frame)
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    for (const [x, y] of p.cells) {
      rrect(ctx, o.x + x * cs + cs * 0.1, o.y + y * cs + cs * 0.24, cs * 0.92, cs * 0.92, cs * 0.18);
      ctx.fill();
    }
    this.piece(item, o.x, o.y, cs, 1, 3);
    ctx.restore();
  }

  private drawDial(sim: GeodaSim): void {
    const L = this.layout;
    const state = sim.blind ? 'dark' : !sim.pushBlock ? 'off' : sim.blockT < sim.lead ? 'wait' : sim.reliable ? 'live' : 'grey';
    const note = state === 'wait' ? t('v.wait') : state === 'grey' ? t('v.noSignal') : state === 'dark' ? t('v.dark') : '';
    const look = { value: this.dialShown, mult: state === 'off' ? 1 : sim.mult, state, pop: this.multPop, label: t('v.shine'), note, t: this.clock, compact: L.portrait } as const;
    if (L.mode === 'columns') paintShineColumn(this.ctx, L.column, look);
    else paintDial(this.ctx, L.dial.x, L.dial.y, L.dial.r, look);
  }

  private drawGoal(sim: GeodaSim): void {
    if (this.layout.mode === 'columns') {
      this.drawGoalColumn(sim);
      return;
    }
    const ctx = this.ctx, L = this.layout, g = L.goal;
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,28,.6)';
    rrect(ctx, g.x, g.y, g.w, g.h, 12);
    ctx.fill();
    const pad = 8;
    const title = sim.mode === 'adventure' ? t('v.chamber', { n: sim.spec.level + 1 }) : t('v.classic');
    const size = Math.max(MIN_READ, Math.min(16, g.h * 0.32));
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.inkSoft;
    // a narrow box leaves the chamber's name to the HUD's score corner ("Komnata 1 · 0/9") and keeps the jewels
    let tw = pad;
    if (g.w >= 200) {
      const head = fitText(ctx, title, g.w * 0.42, size, 700, SANS);
      ctx.fillText(head, g.x + pad, g.y + g.h / 2);
      tw = ctx.measureText(head).width + pad * 2;
    }
    if (sim.mode === 'adventure') {
      const n = sim.spec.goal.length;
      const cw = (g.w - tw - pad) / n;
      sim.spec.goal.forEach(([kind, need], k) => {
        const x = g.x + tw + k * cw;
        const got = Math.min(need, sim.got[k] ?? 0);
        const r = Math.min(g.h * 0.28, cw * 0.18);
        paintJewel(ctx, x + r + 2, g.y + g.h / 2, r, kind, this.clock);
        ctx.fillStyle = got >= need ? C.gold : C.ink;
        ctx.fillText(fitText(ctx, got >= need ? '✓' : `${got}/${need}`, cw - r * 2 - 10, size * 1.05, 800, SANS), x + r * 2 + 8, g.y + g.h / 2);
      });
    } else {
      ctx.fillStyle = C.ink;
      ctx.fillText(fitText(ctx, sim.headlineSub(), g.w - tw - pad, size * 1.05, 800, SANS), g.x + tw, g.y + g.h / 2);
    }
    ctx.restore();
  }

  /** A small phone's right margin: the chamber's jewels one under another, each with its count (the classic board: none). */
  private drawGoalColumn(sim: GeodaSim): void {
    if (sim.mode !== 'adventure') return;
    const ctx = this.ctx, g = this.layout.goal;
    const n = sim.spec.goal.length, row = 46;
    const h = Math.min(g.h, n * row + 10);
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,28,.62)';
    rrect(ctx, g.x, g.y, g.w, h, 12);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    sim.spec.goal.forEach(([kind, need], k) => {
      const cy = g.y + 8 + k * row;
      if (cy + row - 6 > g.y + h) return;
      const got = Math.min(need, sim.got[k] ?? 0);
      paintJewel(ctx, g.x + g.w / 2, cy + 12, 10, kind, this.clock);
      ctx.fillStyle = got >= need ? C.gold : C.ink;
      // the count across the plate's width at 13 px or more ("10/11" fits a 40 px plate), never cut
      const label = got >= need ? '✓' : `${got}/${need}`;
      const fit = fitText(ctx, label, g.w - 2, 14, 800, SANS, MIN_READ);
      ctx.fillText(fit === label ? fit : fitText(ctx, label, g.w - 2, 14, 800, SANS), g.x + g.w / 2, cy + 33);
    });
    ctx.restore();
  }

  private drawBowl(sim: GeodaSim): void {
    const ctx = this.ctx, L = this.layout, b = L.bowl;
    const bw = sim.bowl;
    const active = sim.restBlock && !!bw;
    const s = Math.min(b.w * 0.62, b.h * (L.portrait ? 1.6 : 0.62), 170);
    const cx = L.portrait ? b.x + s * 0.6 : b.x + b.w / 2;
    const by = L.portrait ? b.y + b.h - 2 : b.y + s * 0.95;
    ctx.save();
    if (!active && !this.gemShow) ctx.globalAlpha = 0.45;
    paintBowl(ctx, cx, by, s, bw?.polish ?? 0, active, this.clock);
    const m = bw ? bw.mineral : this.gemShow?.m ?? -1;
    if (m >= 0) {
      const tier = bw ? bw.tier : this.gemShow!.tier;
      drawSpecimen(ctx, cx, by - s * 0.45, s * 0.42, m, tier, this.clock);
      if (bw) {
        const p = bw.polish;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.6 * p;
        sparkle(ctx, cx + s * 0.12, by - s * 0.6, s * (0.04 + 0.08 * p) * (1 + 0.3 * Math.sin(this.clock * 6)), '#fff');
        ctx.restore();
      }
    }
    // the words under (or beside) it, fitted (never squeezed under 13 px)
    ctx.textAlign = L.portrait ? 'left' : 'center';
    ctx.textBaseline = 'top';
    const tx = L.portrait ? cx + s * 0.6 : cx, ty = L.portrait ? b.y + 2 : by + 6, maxW = L.portrait ? b.x + b.w - tx : b.w;
    const size = Math.max(14, Math.min(16, s * 0.13));
    ctx.fillStyle = active ? C.rest : C.inkSoft;
    ctx.fillText(fitText(ctx, t('v.bowl').toUpperCase(), maxW, size, 800, SANS, MIN_READ), tx, ty);
    ctx.fillStyle = C.ink;
    const line = this.gemShow ? this.gemShow.text : bw ? `${MINERALS[bw.mineral].title} · ${t('v.polish', { pct: pct(Math.round(bw.polish * 100)) })}` : t('v.bowlNext');
    // one line while it fits at 13 px and more, else two
    const two = fitLines(ctx, line, Math.round(size * 0.95), maxW, SANS, 600, MIN_READ, MIN_READ);
    two.lines.slice(0, 2).forEach((l, i) => ctx.fillText(fitText(ctx, l, maxW, two.size, 600, SANS, MIN_READ), tx, ty + size * 1.3 + i * two.size * 1.25));
    ctx.restore();
  }

  /** A small phone's left margin in a rest: the bowl with the round's gem, the word and the polish under it. */
  private drawBowlColumn(sim: GeodaSim): void {
    const ctx = this.ctx, c = this.layout.column, bw = sim.bowl;
    const active = sim.restBlock && !!bw;
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,28,.62)';
    rrect(ctx, c.x, c.y, c.w, Math.min(c.h, 132), 12);
    ctx.fill();
    const s = c.w * 0.95, cx = c.x + c.w / 2, by = c.y + 14 + s * 0.85;
    if (!active && !this.gemShow) ctx.globalAlpha = 0.5;
    paintBowl(ctx, cx, by, s, bw?.polish ?? 0, active, this.clock);
    const m = bw ? bw.mineral : this.gemShow?.m ?? -1;
    if (m >= 0) drawSpecimen(ctx, cx, by - s * 0.45, s * 0.42, m, bw ? bw.tier : this.gemShow!.tier, this.clock);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = active ? C.rest : C.inkSoft;
    // the word and the polish where they fit the margin at 13 px (a long word leaves the bowl and its ring
    // to speak)
    const word = fitText(ctx, t('v.bowl'), c.w - 4, MIN_READ, 800, SANS, MIN_READ);
    if (!word.endsWith('…')) ctx.fillText(word, cx, by + 8);
    if (bw) {
      ctx.fillStyle = C.ink;
      const polish = pct(Math.round(bw.polish * 100));
      const fit = fitText(ctx, polish, c.w - 4, 15, 800, SANS, MIN_READ);
      if (fit === polish) ctx.fillText(fit, cx, by + 26);
    }
    ctx.restore();
  }

  private drawMole(sim: GeodaSim, hand: Hand): void {
    const L = this.layout, m = L.mole, b = L.bubble;
    this.mole.face = L.portrait ? -1 : 1;
    paintMole(this.ctx, m.x, m.y, m.s, this.mole);
    const line = sim.talk.line;
    if (!line) return;
    // a piece in the air matters more than a joke: the bubble steps back while the finger drags
    const a = Math.min(1, line.t / 0.15, (line.dur - line.t) / 0.25) * (hand.drag ? 0.22 : 1);
    const size = Math.max(14, Math.min(16, m.s * 0.14));
    if (b.below) paintBubble(this.ctx, line.text, b.x, b.y, b.w, m.x - m.s * 0.2, m.y - m.s * 0.55, a, size, true, true);
    else if (L.mode === 'columns') paintBubble(this.ctx, line.text, b.x, b.y, b.w, m.x - m.s * 0.3, m.y - m.s * 0.78, a, size, false, true);
    else paintBubble(this.ctx, line.text, b.x, b.y, b.w, m.x + m.s * 0.1, m.y - m.s * 0.92, a, size);
  }

  private drawFlies(sim: GeodaSim): void {
    const L = this.layout, g = L.goal;
    for (const f of this.flies) {
      const k = ease.inOutSine(clamp(f.t / 0.8));
      const gi = sim.spec.goal.findIndex(([kind]) => kind === f.kind);
      const tx = g.x + g.w * (0.45 + 0.5 * ((gi + 0.5) / Math.max(1, sim.spec.goal.length))), ty = g.y + g.h / 2;
      const x = f.x + (tx - f.x) * k, y = f.y + (ty - f.y) * k - Math.sin(k * Math.PI) * L.cell * 1.5;
      paintJewel(this.ctx, x, y, L.cell * (0.3 + 0.15 * Math.sin(k * Math.PI)), f.kind, this.clock);
      if (f.t > 0.78 && f.t - 1 / 60 <= 0.78) this.fx.burst(tx, ty, 10, { color: JEWELS[f.kind - 1].light, size: 2.2, speed: 120, life: 0.5 });
    }
  }

  // ── story cards ─────────────────────────────────────────────────
  private drawStory(sim: GeodaSim): void {
    const s = sim.story!;
    const ctx = this.ctx, L = this.layout, c = L.card;
    const inK = ease.outCubic(clamp(s.t / 0.3)), out = clamp((s.dur - s.t) / 0.3);
    const a = Math.min(inK, out);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,9,22,.86)';
    const pad = Math.max(10, c.w * 0.05);
    rrect(ctx, c.x + pad * 0.3, c.y + pad * 0.3 + (1 - inK) * 20, c.w - pad * 0.6, c.h - pad * 0.6, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,107,.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cx = c.x + c.w / 2, w = c.w - pad * 2.4;
    let y = c.y + pad * 1.4;
    const title = (text: string, size: number, color = C.gold) => {
      fitFont(ctx, text, size, w, SERIF, 700, 16);
      ctx.fillStyle = color;
      ctx.fillText(text, cx, y);
      y += size * 1.35;
    };
    const body = (text: string, size: number) => {
      ctx.font = `500 ${size}px ${SANS}`;
      ctx.fillStyle = C.ink;
      for (const line of wrapText(ctx, text, w)) {
        ctx.fillText(line, cx, y);
        y += size * 1.35;
      }
    };
    const big = Math.max(20, Math.min(32, c.w * 0.07));
    const small = Math.max(15, Math.min(17, c.w * 0.042));
    if (s.kind === 'open') {
      title(t('open.title'), big);
      body(t('open.text'), small);
      y += small * 0.4;
      const box = { x: c.x + pad, y, w: c.w - pad * 2, h: c.y + c.h - pad * 2.6 - y };
      if (box.h > 40) {
        const p = passage('isa54.11-12');
        if (!this.verse || this.verse.w !== box.w) this.verse = { lay: layoutPassage(ctx, p, box.w, box.h, { max: Math.min(18, small + 1), min: MIN_READ }), w: box.w };
        drawVerse(ctx, p, this.verse.lay, cx, box.y);
      }
    } else if (s.kind === 'level') {
      title(t('v.levelTitle', { n: s.level + 1 }), big);
      // the stars
      const sr = Math.min(28, c.w * 0.07);
      for (let k = 0; k < 3; k++) {
        const on = k < s.stars;
        const pop = ease.outBack(clamp((s.t - 0.3 - k * 0.25) / 0.3));
        star(ctx, cx + (k - 1) * sr * 2.4, y + sr, sr * (on ? pop : 1), on ? C.gold : 'rgba(255,255,255,.15)');
      }
      y += sr * 2.6;
      body(t('v.levelPts', { n: fmt(s.points) }), small);
      y += small * 0.5;
      title(t('v.levelNext', { name: chamberName(s.next) }), small * 1.15, C.ink);
      body(chamberStory(s.next), small * 0.95);
    } else {
      title(t('v.turnTitle'), big);
      body(t('v.turnBoard', { n: fmt(s.points) }), small * 1.1);
      if (s.record) title(t('v.turnRecord'), small * 1.3);
      else if (s.toRecord !== null && s.toRecord > 0) body(t('v.turnTo', { n: fmt(s.toRecord) }), small);
    }
    ctx.font = `700 ${Math.max(14, small * 0.9)}px ${SANS}`;
    ctx.fillStyle = 'rgba(253,246,234,.78)';
    ctx.fillText(s.kind === 'open' ? t('open.tap') : t('v.tapOn'), cx, c.y + c.h - pad * 1.8);
    ctx.restore();
  }

  /** The calibration scene is drawn by intro.ts on the same canvas. */
  get context(): CanvasRenderingContext2D { return this.ctx; }
  get size(): { w: number; h: number; dpr: number; top: number } { return { w: this.w, h: this.h, dpr: this.dpr, top: this.top }; }
}

/** The story's passage: its lines at the layout's size (13 px and more), its reference at 13 px (the kit's would be 11). */
function drawVerse(ctx: CanvasRenderingContext2D, p: Passage, l: PassageLayout, cx: number, top: number): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f3e6ff';
  ctx.font = `italic 400 ${l.size}px ${VERSE_FONT}`;
  l.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * l.lineH));
  ctx.fillStyle = C.gold;
  ctx.font = `600 ${Math.max(MIN_READ, l.refSize)}px ${REF_FONT}`;
  ctx.fillText(`${p.ref} · ${p.bible}`, cx, top + l.lines.length * l.lineH + Math.round(l.size * 0.55));
  ctx.restore();
}

function mixCombo(n: number): string {
  const k = Math.min(1, (n - 2) / 8);
  return `hsl(${Math.round(45 - 45 * k)}, 100%, ${Math.round(72 - 10 * k)}%)`;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export type { Box };
