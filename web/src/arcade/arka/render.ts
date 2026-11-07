/**
 * Arka's play view (v2): the ark's deck after the flood as a warm woodcut — walnut hull, oak planks,
 * the animals seen from above facing their ways (a cream chevron at the leader's nose says where it
 * will walk), files of young on a straw rope behind their mothers, sleepers under a "z", turning
 * goats with a little swirl, pens of wattle with a padlock and the key's carrier with a key on its
 * back.  Below, the gangway runs down to the new land, where the first of each kind waits for its
 * mate and the pairs walk off together.
 *
 * The band in the world:
 *   Mgła     the flood's mist rolls over the deck; a clear circle around the door is the focus (its
 *            radius is the level), the threshold drawn on the deck as a dashed gold ring.  Above it,
 *            the free animals inside the circle show their way out in golden hoof-prints.
 *   Tęcza    the rainbow rises over the deck as calm fills it; full, a heart flies to the bar and
 *            the bow's end lights one safe move.
 *
 * The runner draws the Mendi panel and the score; this view draws only the deck's own bar (hearts,
 * the level and its par, the dove's button), the raven and his bubble, and the cards (the opening,
 * a chapter, a level, a cleared deck).
 */
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageLayout } from '../kit/scripture';
import { rayCells } from './board';
import { KIND, chapter as chapterText, type KindId } from './content';
import { t } from './i18n';
import { ArkIntro } from './intro';
import { cellAt, cellCentre, inRect, layout, sightRadius, type Layout, type Pt } from './layout';
import type { ArkaProgress } from './meta';
import {
  C, KIND_COLOR, SANS, SERIF, font, glow, hash, paintAnimal, paintDove, paintHeart, paintKey, paintPen, paintPlanks, paintProfile,
  paintRainbow, paintRaven, paintStar,
} from './paint';
import { DX, DY, RULES, sightShare, type Dir } from './rules';
import type { ArkaSim, CoachAt, SimEvent } from './sim';

interface Leaver { kind: KindId; path: Pt[]; lead: number; len: number; s: number; v: number; dir: Dir; dove: boolean }
interface Walker { kind: KindId; x: number; t: number; heart: boolean }
type CardKind = 'open' | 'chapter' | 'level' | 'clear' | 'restart';
interface Card { kind: CardKind; t: number; dur: number; title: string; text: string; ev?: Extract<SimEvent, { type: 'clear' }> }

const TAU = Math.PI * 2;

export class ArkaView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private top = 0;
  L: Layout | null = null;
  private dims = '';
  private clock = 0;
  private readonly intro = new ArkIntro();
  private readonly parts = new Particles(520);
  private readonly floats = new Floaters();
  private readonly shake: Shake;
  private bg: { key: string; c: HTMLCanvasElement } | null = null;
  private deckC: { key: string; c: HTMLCanvasElement } | null = null;
  private fogC: HTMLCanvasElement | null = null;
  private fogTex: HTMLCanvasElement | null = null;
  private leavers: Leaver[] = [];
  private walkers: Walker[] = [];
  private bumps = new Map<number, { t: number; dist: number; lost: boolean }>();
  private jolts = new Map<number, number>();
  private turns = new Map<number, number>();
  private opens = new Map<number, number>();
  private wakes = new Map<number, number>();
  private card: Card | null = null;
  private cardQ: Card[] = [];
  private verse: { id: 'gen8.1'; l: PassageLayout | null; w: number } = { id: 'gen8.1', l: null, w: 0 };
  private hitStop = 0;
  private dove: { from: Pt; to: Pt; t: number } | null = null;
  private heartFx: { from: Pt; to: Pt; t: number; lost: boolean }[] = [];
  private ravenHop = 0;
  private ravenFlinch = 0;
  private shoreN = 0;
  private shorePop: number[] = [];
  private ringPulse = 0;
  private levelIn = 0;
  private openShown = false;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, top: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.top = top;
    this.dims = '';
    this.verse.l = null;
  }

  private lay(sim: ArkaSim): Layout {
    const key = `${this.w}|${this.h}|${this.top}|${sim.board.cols}|${sim.board.rows}`;
    if (key !== this.dims || !this.L) {
      this.dims = key;
      this.L = layout(this.w, this.h, this.top, sim.board.cols, sim.board.rows);
    }
    return this.L;
  }

  intro_(dt: number, p: number, progress: ArkaProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro.draw(ctx, this.w, this.h, dt, p, progress, this.dpr);
  }

  /** The first-ever session opens on the story card (the root passage under it). */
  start(sim: ArkaSim): void {
    if (sim.session === 1 && !this.openShown) {
      this.openShown = true;
      this.cardQ.unshift({ kind: 'open', t: 0, dur: 7.5, title: t('card.open.title'), text: t('card.open.text') });
    }
  }

  // ── input helpers for index.ts ─────────────────────────────────
  /** The deck cell under a point (null: off the deck). */
  cellAt(sim: ArkaSim, x: number, y: number): { x: number; y: number } | null {
    const L = this.lay(sim);
    const c = cellAt(L, x, y);
    if (c) return c;
    // a generous edge: a finger just outside the deck still means its border cell
    const pad = L.cell * 0.3;
    if (!inRect(L.deck, x, y, pad)) return null;
    return { x: Math.max(0, Math.min(L.cols - 1, Math.floor((x - L.deck.x) / L.cell))), y: Math.max(0, Math.min(L.rows - 1, Math.floor((y - L.deck.y) / L.cell))) };
  }

  onDove(sim: ArkaSim, x: number, y: number): boolean {
    const L = this.lay(sim);
    return Math.hypot(x - L.dove.x, y - L.dove.y) <= L.dove.r + 10;
  }

  /** A tap while a card is up: the opening and chapter cards close; true when the tap was the card's. */
  cardTap(): boolean {
    const c = this.card;
    if (!c) return false;
    if ((c.kind === 'open' || c.kind === 'chapter') && c.t >= 0.8) {
      c.t = Math.max(c.t, c.dur - 0.35);
      return true;
    }
    return c.kind === 'open' || c.kind === 'chapter';
  }

  /** Where a coach mark points (canvas px). */
  coachPoint(sim: ArkaSim, at: CoachAt): Pt | null {
    const L = this.lay(sim);
    if (at === null) return null;
    if (at === 'dove') return { x: L.dove.x, y: L.dove.y + L.dove.r };
    if (at === 'hearts') return { x: L.bar.x + 40, y: L.bar.y + L.bar.h };
    if (at === 'shore') return { x: L.shore.x + L.shore.w / 2, y: L.shore.y + 6 };
    if (at === 'ring') {
      const r = sightRadius(L, sightShare(0.5));
      return { x: L.door.x, y: Math.max(L.deck.y + 8, L.door.y - r) };
    }
    const a = sim.animals[at.animal];
    if (!a) return null;
    const c = cellCentre(L, a.cells[0].x, a.cells[0].y);
    // the runner's bubble is centred on the point: keep it whole on a narrow screen
    const edge = Math.min(130, this.w / 2);
    return { x: Math.max(edge, Math.min(this.w - edge, c.x)), y: c.y - L.cell * 0.35 };
  }

  get blocking(): boolean { return !!this.card && (this.card.kind === 'open' || this.card.kind === 'chapter' || this.card.kind === 'clear'); }

  // ── events ─────────────────────────────────────────────────────
  on(e: SimEvent, sim: ArkaSim): void {
    const L = this.lay(sim);
    const rm = this.opts.reducedMotion;
    switch (e.type) {
      case 'level': {
        this.leavers = [];
        this.bumps.clear();
        this.levelIn = 0;
        this.shoreN = 0;
        this.shorePop = [];
        if (e.chapter !== null) {
          const ch = chapterText(e.chapter);
          this.cardQ.push({ kind: 'chapter', t: 0, dur: 4.2, title: ch.title, text: ch.text });
        }
        const sub = e.retry ? t('card.retry') : e.mood === 'big' ? t('card.big') : e.mood === 'easy' ? t('card.easy') : '';
        this.cardQ.push({ kind: 'level', t: 0, dur: 1.5, title: t('card.level', { n: e.n }), text: sub });
        break;
      }
      case 'send': {
        const a = sim.animals[e.id];
        const lead = a.cells.length - 1;
        const path: Pt[] = [...a.cells].reverse().map(c => ({ x: c.x, y: c.y }));
        for (const c of rayCells(sim.board.cols, sim.board.rows, a.cells[0], e.dir)) path.push(c);
        const last = path[path.length - 1];
        for (let i = 1; i <= a.cells.length + 3; i++) path.push({ x: last.x + DX[e.dir] * i, y: last.y + DY[e.dir] * i });
        this.leavers.push({ kind: e.kind, path, lead, len: a.cells.length, s: 0, v: 7, dir: e.dir, dove: e.dove });
        const c = cellCentre(L, a.cells[0].x, a.cells[0].y);
        this.parts.burst(c.x - DX[e.dir] * L.cell * 0.4, c.y - DY[e.dir] * L.cell * 0.4, 8, { color: '#e8d6b0', size: 2.4, speed: 70, g: 40, life: 0.5, angle: Math.atan2(-DY[e.dir], -DX[e.dir]), spread: 1.6 });
        if (e.chain >= 3) this.floats.add(t('fx.chain', { n: e.chain }), c.x, c.y - L.cell * 0.4, { color: C.amber2, size: Math.min(30, 16 + e.chain) });
        if (this.bumps.has(e.id)) this.bumps.delete(e.id);
        break;
      }
      case 'bump': {
        this.bumps.set(e.id, { t: 0, dist: e.dist, lost: e.lost });
        if (e.lost) {
          this.hitStop = RULES.hitStop;
          this.shake.add(rm ? 0 : 0.28);
          const i = e.hearts;
          this.heartFx.push({ from: this.heartPos(L, i), to: { x: this.heartPos(L, i).x, y: this.heartPos(L, i).y + 40 }, t: 0, lost: true });
          this.ravenFlinch = 0.6;
        } else if (sim.practice) {
          const a = sim.animals[e.id];
          const c = cellCentre(L, a.cells[0].x, a.cells[0].y);
          this.floats.add(t('fx.practice'), c.x, c.y - L.cell * 0.5, { color: C.cream, size: 15, dur: 1.5 });
        }
        if (e.blocker >= 0) this.jolts.set(e.blocker, 0);
        break;
      }
      case 'pair': {
        const x = this.shoreSlotX(L, 0);
        this.walkers.push({ kind: e.kind, x, t: 0, heart: true });
        const p = { x, y: L.shore.y + L.shore.h * 0.55 };
        this.parts.burst(p.x, p.y - 10, e.bonus ? 16 : 8, { color: e.bonus ? C.amber : '#e98b8b', size: 3, speed: 90, g: -30, life: 0.9, shape: 'dot' });
        this.floats.add(e.bonus ? t('fx.bonus') : t('fx.pair'), Math.min(this.w - 60, p.x + 30), p.y - 22, { color: e.bonus ? C.amber2 : C.cream, size: e.bonus ? 26 : 20 });
        if (e.newKind) this.floats.add(t('fx.newKind', { name: KIND[e.kind].name }), this.w / 2, L.shore.y - 14, { color: C.cream, size: 16, dur: 2 });
        if (e.young) this.floats.add(t('fx.young', { young: KIND[e.kind].young }), this.w / 2, L.shore.y - 34, { color: C.amber2, size: 17, dur: 2.2 });
        break;
      }
      case 'wake': {
        this.wakes.set(e.id, 0);
        const a = sim.animals[e.id];
        const c = cellCentre(L, a.cells[0].x, a.cells[0].y);
        this.floats.add(t('fx.wake'), c.x, c.y - L.cell * 0.4, { color: C.cream, size: 17 });
        break;
      }
      case 'turn': this.turns.set(e.id, 0); break;
      case 'locked': {
        const a = sim.animals[e.id];
        const c = cellCentre(L, a.cells[0].x, a.cells[0].y);
        this.jolts.set(e.id, 0);
        this.floats.add(t('fx.locked'), c.x, c.y - L.cell * 0.4, { color: C.cream, size: 16 });
        break;
      }
      case 'unlock': {
        this.opens.set(e.id, 0);
        const a = sim.animals[e.id];
        const c = cellCentre(L, a.cells[0].x, a.cells[0].y);
        this.parts.burst(c.x, c.y, 12, { color: C.amber, size: 2.5, speed: 110, g: 60, life: 0.6, shape: 'spark' });
        this.floats.add(t('fx.open'), c.x, c.y - L.cell * 0.4, { color: C.amber2, size: 18 });
        break;
      }
      case 'clear': {
        this.cardQ.push({ kind: 'clear', t: 0, dur: RULES.clearSec, title: t('card.clear'), text: '', ev: e });
        this.ravenHop = 1;
        for (let i = 0; i < 26; i++) {
          const x = L.deck.x + hash(i + this.clock) * L.deck.w;
          this.parts.burst(x, L.deck.y + L.deck.h * 0.4, 1, { color: i % 3 ? C.leaf : C.olive, size: 4, speed: 140, g: 160, life: 1.4, shape: 'square' });
        }
        break;
      }
      case 'restart':
        this.cardQ.push({ kind: 'restart', t: 0, dur: RULES.restartSec, title: t('fx.restart'), text: '' });
        this.shake.add(rm ? 0 : 0.35);
        break;
      case 'dove': {
        const a = sim.animals[e.id];
        this.dove = { from: { x: L.dove.x, y: L.dove.y }, to: cellCentre(L, a.cells[0].x, a.cells[0].y), t: 0 };
        break;
      }
      case 'doveBusy':
        this.floats.add(t('fx.doveBusy'), Math.max(70, L.dove.x - 50), L.dove.y + L.dove.r + 22, { color: C.cream, size: 14, dur: 1.1 });
        break;
      case 'rainbow': {
        if (e.heart) {
          const to = this.heartPos(L, Math.max(0, sim.hearts - 1));
          this.heartFx.push({ from: { x: L.door.x, y: L.deck.y + L.deck.h * 0.3 }, to, t: 0, lost: false });
          this.floats.add(t('fx.heart'), to.x + 30, to.y + 24, { color: '#f2a7a0', size: 18 });
        }
        this.floats.add(t('fx.rainbow'), L.door.x, L.deck.y + L.deck.h * 0.3, { color: C.cream, size: 24, dur: 1.4 });
        for (let i = 0; i < 30; i++) {
          const a = Math.PI + (i / 29) * Math.PI;
          const r = this.bowR(L);
          this.parts.burst(L.door.x + Math.cos(a) * r, L.door.y + Math.sin(a) * r, 1, { color: ['#e9a7a1', '#efe2a2', '#b8d8a4', '#a7cde0'][i % 4], size: 2.5, speed: 40, g: 20, life: 1, shape: 'spark' });
        }
        break;
      }
      case 'sun': {
        const r = sightRadius(L, sightShare(sim.sight));
        this.ringPulse = 1;
        this.floats.add(t('fx.sun'), L.door.x, Math.max(L.deck.y + 20, L.door.y - r * 0.7), { color: C.amber2, size: 22 });
        for (let i = 0; i < 24; i++) {
          const a = Math.PI + (i / 23) * Math.PI;
          this.parts.burst(L.door.x + Math.cos(a) * r, L.door.y + Math.sin(a) * r, 1, { color: C.amber2, size: 2.2, speed: 50, g: -10, life: 0.9, shape: 'spark' });
        }
        break;
      }
      case 'blindReveal':
        this.floats.add(t('fx.blind', { n: Math.round(e.share * 100) }), L.door.x, L.deck.y + L.deck.h * 0.35, { color: C.cream, size: 18, dur: 2.4 });
        break;
      case 'say':
        this.ravenHop = Math.max(this.ravenHop, 0.5);
        break;
      default:
        break;
    }
  }

  private heartPos(L: Layout, i: number): Pt {
    const s = Math.min(26, L.bar.h * 0.62);
    return { x: L.bar.x + 14 + i * (s + 6), y: L.bar.y + L.bar.h / 2 };
  }

  private shoreSlotX(L: Layout, i: number): number {
    const step = Math.max(34, Math.min(64, L.cell * 1.1));
    const x0 = L.compact ? L.shore.x + 30 : L.door.x + step * 0.9;
    return x0 + i * step;
  }

  private bowR(L: Layout): number { return Math.max(L.deck.w * 0.55, Math.min(L.deck.h * 0.9, L.deck.w * 0.9)); }

  // ── the clock ──────────────────────────────────────────────────
  update(dt: number, sim: ArkaSim): void {
    if (!sim.started) return;
    this.clock += dt;
    this.lay(sim);
    let adt = dt;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      adt = dt * 0.15;
    }
    this.parts.update(adt);
    this.floats.update(dt);
    this.levelIn += dt;
    for (const l of this.leavers) {
      l.v = Math.min(RULES.slide * 1.3, l.v + RULES.slide * 3 * adt);
      l.s += l.v * adt;
    }
    this.leavers = this.leavers.filter(l => l.s < l.path.length - l.lead + 1);
    for (const [id, b] of this.bumps) {
      b.t += adt;
      if (b.t >= RULES.bumpSec) this.bumps.delete(id);
    }
    const tick = (m: Map<number, number>, max: number) => { for (const [k, v] of m) { if (v + adt >= max) m.delete(k); else m.set(k, v + adt); } };
    tick(this.jolts, 0.3);
    tick(this.turns, 0.28);
    tick(this.opens, 0.6);
    tick(this.wakes, 0.5);
    for (const w of this.walkers) w.t += dt;
    this.walkers = this.walkers.filter(w => w.t < 3);
    for (const hf of this.heartFx) hf.t += dt;
    this.heartFx = this.heartFx.filter(hf => hf.t < 0.8);
    if (this.dove) {
      this.dove.t += dt;
      if (this.dove.t > 1.2) this.dove = null;
    }
    this.ravenHop = Math.max(0, this.ravenHop - dt * 1.6);
    this.ravenFlinch = Math.max(0, this.ravenFlinch - dt * 1.5);
    this.ringPulse = Math.max(0, this.ringPulse - dt * 1.2);
    // the new land: a newly waiting animal pops into its slot
    if (sim.shore.length !== this.shoreN) {
      if (sim.shore.length > this.shoreN) this.shorePop[sim.shore.length - 1] = this.clock;
      this.shoreN = sim.shore.length;
    }
    // cards: one at a time
    if (this.card) {
      this.card.t += dt;
      if (this.card.t >= this.card.dur || (this.card.kind === 'clear' && sim.levelState !== 'clear')) this.card = null;
    }
    if (!this.card && this.cardQ.length) this.card = this.cardQ.shift()!;
    sim.cardOn = this.blocking;
  }

  // ── drawing ────────────────────────────────────────────────────
  draw(sim: ArkaSim): void {
    // before play the calibration intro paints the frame (intro_)
    if (!sim.started) return;
    const ctx = this.ctx;
    const L = this.lay(sim);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.background(L), 0, 0, this.w, this.h);
    const off = this.shake.offset(1 / 60, 8);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawShore(ctx, L, sim);
    this.drawDeck(ctx, L, sim);
    this.drawRainbow(ctx, L, sim);
    this.drawPrints(ctx, L, sim);
    this.drawAnimals(ctx, L, sim);
    this.drawLeavers(ctx, L);
    this.drawMist(ctx, L, sim);
    this.drawCursor(ctx, L, sim);
    this.drawDoveFx(ctx);
    this.parts.draw(ctx);
    ctx.restore();
    this.drawBar(ctx, L, sim);
    this.drawRaven(ctx, L, sim);
    this.floats.draw(ctx, SERIF);
    this.drawCard(ctx, L);
  }

  private background(L: Layout): HTMLCanvasElement {
    const key = `${this.w}|${this.h}|${this.dpr}|${L.deck.x}|${L.deck.y}|${L.deck.w}|${L.deck.h}|${L.shore.y}|${L.compact}`;
    if (this.bg && this.bg.key === key) return this.bg.c;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w * this.dpr));
    c.height = Math.max(1, Math.round(this.h * this.dpr));
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const w = this.w, h = this.h;
    // a washed morning sky over the receding water
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#cfe6ee');
    sky.addColorStop(0.45, '#f1e6cf');
    sky.addColorStop(1, '#e9d6ad');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // far mountains
    g.fillStyle = 'rgba(110,120,140,.35)';
    g.beginPath();
    g.moveTo(0, h * 0.42);
    for (let i = 0; i <= 12; i++) g.lineTo((i / 12) * w, h * (0.3 + 0.1 * hash(i + 3) + (i === 8 ? -0.12 : 0)));
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    // the water, its glints
    const wy = h * 0.5;
    const water = g.createLinearGradient(0, wy, 0, h);
    water.addColorStop(0, '#9cc3cf');
    water.addColorStop(1, '#6f9fb0');
    g.fillStyle = water;
    g.fillRect(0, wy, w, h - wy);
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) {
      const x = hash(i + 11) * w, y = wy + hash(i + 12) * (h - wy);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 8 + hash(i) * 14, y);
      g.stroke();
    }
    // the hull around the deck
    const d = L.deck, rim = Math.max(8, L.cell * 0.28);
    g.fillStyle = 'rgba(30,18,10,.35)';
    g.fillRect(d.x - rim + 4, d.y - rim + 8, d.w + rim * 2, d.h + rim * 2);
    paintPlanks(g, d.x - rim, d.y - rim, d.w + rim * 2, d.h + rim * 2, Math.max(10, rim * 0.9), [C.walnut, '#43301f', C.walnut2], 31);
    g.strokeStyle = '#1e140c';
    g.lineWidth = 2;
    g.strokeRect(d.x - rim, d.y - rim, d.w + rim * 2, d.h + rim * 2);
    // the gangway down to the new land
    if (!L.compact) {
      const gw = Math.max(18, L.cell * 0.7);
      paintPlanks(g, L.door.x - gw / 2, d.y + d.h + rim - 2, gw, Math.max(4, L.shore.y - (d.y + d.h + rim) + 8), gw / 3, ['#8a6440', '#7f5a36', C.fresh], 13, true);
    }
    this.bg = { key, c };
    return c;
  }

  private drawShore(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    const s = L.shore;
    // the new land: a green strip with a path
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    g.addColorStop(0, '#9cc56a');
    g.addColorStop(1, '#6e9c48');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + 8);
    for (let i = 0; i <= 10; i++) ctx.lineTo(s.x + (i / 10) * s.w, s.y + 4 * Math.sin(i * 1.7) + 4);
    ctx.lineTo(s.x + s.w, s.y + s.h);
    ctx.lineTo(s.x, s.y + s.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 30; i++) ctx.fillRect(s.x + hash(i + 70) * s.w, s.y + 8 + hash(i + 71) * (s.h - 10), 1.5, 3);
    // the waiting firsts of their kinds, each looking back up the gangway for its mate
    const ah = Math.min(s.h * 0.6, 40);
    const gy = L.compact ? s.y + Math.min(s.h - 6, ah + 12) : s.y + s.h * 0.78;
    sim.shore.forEach((k, i) => {
      const x = this.shoreSlotX(L, i);
      if (x > s.x + s.w - 10) return;
      const pop = this.shorePop[i] !== undefined ? clamp((this.clock - this.shorePop[i]) / 0.3) : 1;
      ctx.save();
      ctx.translate(x, gy);
      ctx.scale(ease.outBack(pop), ease.outBack(pop));
      paintProfile(ctx, k, 0, 0, ah, -1, 0);
      ctx.restore();
      // a little "?" — still waiting
      ctx.fillStyle = 'rgba(42,33,27,.6)';
      ctx.font = font(800, 12, SANS);
      ctx.textAlign = 'center';
      ctx.fillText('?', x, gy - ah - 4 + Math.sin(this.clock * 3 + i) * 2);
    });
    // pairs walking off together
    for (const w of this.walkers) {
      const x = w.x + w.t * 70;
      const a = clamp(3 - w.t);
      ctx.save();
      ctx.globalAlpha = a;
      paintProfile(ctx, w.kind, x, gy, ah, 1, 0);
      paintProfile(ctx, w.kind, x + ah * 0.9, gy, ah * 0.96, 1, 0);
      if (w.heart) paintHeart(ctx, x + ah * 0.45, gy - ah - 10 - w.t * 10, 12, { alpha: clamp(1.5 - w.t) });
      ctx.restore();
    }
  }

  private deckSprite(L: Layout): HTMLCanvasElement {
    const key = `${L.deck.w}|${L.deck.h}|${L.cell}|${this.dpr}`;
    if (this.deckC && this.deckC.key === key) return this.deckC.c;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(L.deck.w * this.dpr));
    c.height = Math.max(1, Math.round(L.deck.h * this.dpr));
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    paintPlanks(g, 0, 0, L.deck.w, L.deck.h, L.cell / 2, [C.oak2, '#94693f', '#7f5a36', '#8a6440'], 7);
    g.fillStyle = 'rgba(255,240,210,.08)';
    g.fillRect(0, 0, L.deck.w, L.deck.h);
    // the grid of cells: a faint checker and carved lines, so every animal's row and column read at a glance
    for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
      if ((x + y) % 2) continue;
      g.fillStyle = 'rgba(255,236,200,.07)';
      g.fillRect(x * L.cell, y * L.cell, L.cell, L.cell);
    }
    g.strokeStyle = 'rgba(30,18,10,.42)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 1; x < L.cols; x++) { g.moveTo(x * L.cell, 0); g.lineTo(x * L.cell, L.deck.h); }
    for (let y = 1; y < L.rows; y++) { g.moveTo(0, y * L.cell); g.lineTo(L.deck.w, y * L.cell); }
    g.stroke();
    this.deckC = { key, c };
    return c;
  }

  private drawDeck(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    const drop = sim.levelState === 'drop' ? ease.outCubic(clamp(this.levelIn / RULES.dropSec)) : 1;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.7 * drop;
    ctx.drawImage(this.deckSprite(L), L.deck.x, L.deck.y, L.deck.w, L.deck.h);
    ctx.restore();
  }

  private drawRainbow(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    const rest = sim.started && sim.phase === 'play' && sim.block.kind === 'rest';
    if (!rest && sim.rainbow <= 0) return;
    const r = this.bowR(L);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.deck.x - 40, 0, L.deck.w + 80, L.deck.y + L.deck.h);
    ctx.clip();
    // the whole bow faintly, the filled part bright: calm paints it colour by colour
    paintRainbow(ctx, L.door.x, L.door.y, r, 1, 0.22 + 0.25 * sim.glow);
    paintRainbow(ctx, L.door.x, L.door.y, r, sim.rainbow, 0.7 + 0.3 * sim.glow);
    // the bow's charging end sparkles
    if (sim.rainbow > 0.02) {
      const a = Math.PI + Math.PI * Math.min(1, sim.rainbow);
      const gs = 40 + 30 * sim.glow;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow('rgba(255,240,200,.9)'), L.door.x + Math.cos(a) * r * 0.88 - gs / 2, L.door.y + Math.sin(a) * r * 0.88 - gs / 2, gs, gs);
    }
    ctx.restore();
  }

  /** Above the threshold in a sighted Mgła, the free animals inside the clear circle show their way out in gold. */
  private drawPrints(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    const showSun = sim.sighted && sim.reliable && sim.sight > 0.5;
    const r = sightRadius(L, sightShare(sim.sight));
    const k = showSun ? clamp((sim.sight - 0.5) * 4) : 0;
    const shine = sim.shine >= 0 ? sim.animals[sim.shine] : null;
    if (k <= 0 && !shine) return;
    ctx.save();
    for (const id of sim.freeIds()) {
      const a = sim.animals[id];
      const isShine = shine && shine.id === id;
      const lc = cellCentre(L, a.cells[0].x, a.cells[0].y);
      const inside = Math.hypot(lc.x - L.door.x, lc.y - L.door.y) <= r;
      const alpha = isShine ? 0.95 : inside ? k * 0.85 : 0;
      if (alpha <= 0.02) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isShine ? '#fff3c4' : C.amber2;
      const cells = rayCells(sim.board.cols, sim.board.rows, a.cells[0], a.dir);
      cells.forEach((c, i) => {
        const p = cellCentre(L, c.x, c.y);
        const side = (i % 2 ? 1 : -1) * L.cell * 0.1;
        const px = p.x + (DY[a.dir] ? side : 0), py = p.y + (DX[a.dir] ? side : 0);
        const ph = Math.sin(this.clock * 6 - i * 0.8) * 0.25 + 0.75;
        ctx.beginPath();
        ctx.ellipse(px, py, L.cell * 0.07 * ph + 1, L.cell * 0.1 * ph + 1, a.dir % 2 ? Math.PI / 2 : 0, 0, TAU);
        ctx.fill();
      });
      // the animal itself glows
      ctx.globalAlpha = alpha * 0.55;
      const gs = L.cell * 1.5;
      ctx.drawImage(glow(isShine ? 'rgba(255,240,200,.9)' : 'rgba(255,200,90,.8)'), lc.x - gs / 2, lc.y - gs / 2, gs, gs);
    }
    ctx.restore();
  }

  private animalOffset(L: Layout, id: number, dir: Dir): Pt {
    const b = this.bumps.get(id);
    let o = 0;
    if (b) {
      const k = b.t / RULES.bumpSec;
      const reach = (b.dist + 0.32) * L.cell;
      o = k < 0.45 ? reach * ease.outCubic(k / 0.45) : reach * (1 - ease.inOutSine((k - 0.45) / 0.55));
    }
    const j = this.jolts.get(id);
    let jx = 0, jy = 0;
    if (j !== undefined) {
      const a = Math.sin(j * 50) * (1 - j / 0.3) * L.cell * 0.06;
      jx = a; jy = a * 0.5;
    }
    return { x: DX[dir] * o + jx, y: DY[dir] * o + jy };
  }

  private drawAnimals(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    const drop = sim.levelState === 'drop' ? clamp(this.levelIn / RULES.dropSec) : 1;
    const restart = sim.levelState === 'restart' ? clamp(sim.stateT / RULES.restartSec) : 0;
    const size = L.cell * 1.28;
    for (const a of sim.animals) {
      if (a.out) continue;
      const off = this.animalOffset(L, a.id, a.dir);
      const fall = (1 - ease.outBack(clamp(drop * 1.4 - (a.id % 7) * 0.05))) * L.cell * 0.8;
      ctx.save();
      ctx.globalAlpha = (1 - restart * 0.6) * clamp(drop * 2);
      ctx.translate(off.x, off.y - fall);
      // a straw mat in the kind's colour under every cell of the animal: pieces and pairs read at a glance
      const pad = Math.max(2, L.cell * 0.07);
      for (const c of a.cells) {
        const x = L.deck.x + c.x * L.cell + pad, y = L.deck.y + c.y * L.cell + pad;
        ctx.fillStyle = KIND_COLOR(a.kind);
        ctx.globalAlpha *= 0.32;
        roundRect(ctx, x, y, L.cell - 2 * pad, L.cell - 2 * pad, L.cell * 0.18);
        ctx.fill();
        ctx.globalAlpha /= 0.32;
      }
      // the file: a straw rope from the tail to the mother, the young along it
      if (a.cells.length > 1) {
        ctx.strokeStyle = 'rgba(217,164,65,.75)';
        ctx.lineWidth = Math.max(2, L.cell * 0.12);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        a.cells.forEach((c, i) => {
          const p = cellCentre(L, c.x, c.y);
          if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        });
        ctx.stroke();
        for (let i = a.cells.length - 1; i >= 1; i--) {
          const c = a.cells[i], n = a.cells[i - 1];
          const p = cellCentre(L, c.x, c.y);
          const d = n.x > c.x ? 1 : n.x < c.x ? 3 : n.y > c.y ? 2 : 0;
          paintAnimal(ctx, a.kind, p.x, p.y, d, size * 0.64, this.dpr, { squash: Math.sin(this.clock * 3 + i + a.id) * 0.02 });
        }
      }
      const c = cellCentre(L, a.cells[0].x, a.cells[0].y);
      const tt = this.turns.get(a.id);
      const dir = tt !== undefined ? a.dir - 1 + ease.outBack(tt / 0.28) : a.dir;
      const w = this.wakes.get(a.id);
      const breathe = a.asleep ? Math.sin(this.clock * 1.6 + a.id) * 0.03 : Math.sin(this.clock * 2.2 + a.id * 1.7) * 0.012;
      const squash = w !== undefined ? 0.2 * (1 - w / 0.5) : breathe;
      paintAnimal(ctx, a.kind, c.x, c.y, dir, size, this.dpr, { pose: a.asleep ? 'sleep' : 'stand', squash });
      if (!a.asleep) this.chevron(ctx, c, dir, L.cell, a.lockedBy >= 0 && !sim.animals[a.lockedBy].out);
      if (a.asleep) {
        ctx.fillStyle = C.cream;
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.font = font(800, Math.max(10, L.cell * 0.26), SERIF, true);
        ctx.textAlign = 'center';
        for (let i = 0; i < 2; i++) {
          const k = (this.clock * 0.6 + i * 0.5) % 1;
          ctx.globalAlpha = (1 - k) * (1 - restart * 0.6);
          const zx = c.x + L.cell * (0.2 + k * 0.2), zy = c.y - L.cell * (0.2 + k * 0.35);
          ctx.strokeText('z', zx, zy);
          ctx.fillText('z', zx, zy);
        }
        ctx.globalAlpha = 1 - restart * 0.6;
      }
      if (a.turner) this.swirl(ctx, c, L.cell);
      if (a.keyFor >= 0 && !sim.animals[a.keyFor].out) paintKey(ctx, c.x - L.cell * 0.18, c.y + L.cell * 0.22, L.cell * 0.36, -0.4);
      if (a.lockedBy >= 0) {
        const open = sim.animals[a.lockedBy].out ? (this.opens.has(a.id) ? this.opens.get(a.id)! / 0.6 : 1) : 0;
        if (open < 1) paintPen(ctx, L.deck.x + a.cells[0].x * L.cell, L.deck.y + a.cells[0].y * L.cell, L.cell, open);
      }
      ctx.restore();
    }
  }

  /** The nose's chevron: where the animal will walk (dim behind a closed pen). */
  private chevron(ctx: CanvasRenderingContext2D, c: Pt, dir: number, cell: number, dim: boolean): void {
    const a = (dir - 1) * (Math.PI / 2);
    ctx.save();
    ctx.translate(c.x + Math.cos(a) * cell * 0.43, c.y + Math.sin(a) * cell * 0.43);
    ctx.rotate(a);
    const s = cell * 0.11;
    ctx.globalAlpha *= dim ? 0.4 : 0.95;
    ctx.fillStyle = C.cream;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1, cell * 0.035);
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.7, -s);
    ctx.lineTo(-s * 0.25, 0);
    ctx.lineTo(-s * 0.7, s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** The turning goat's swirl, a quarter turn clockwise. */
  private swirl(ctx: CanvasRenderingContext2D, c: Pt, cell: number): void {
    const r = cell * 0.42;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,217,138,.85)';
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    ctx.setLineDash([cell * 0.08, cell * 0.06]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, -Math.PI * 0.9 + this.clock * 0.6, -Math.PI * 0.2 + this.clock * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  private drawLeavers(ctx: CanvasRenderingContext2D, L: Layout): void {
    const size = L.cell * 1.28;
    for (const l of this.leavers) {
      for (let i = 0; i < l.len; i++) {
        const pos = l.lead - i + l.s;
        const i0 = Math.max(0, Math.min(l.path.length - 1, Math.floor(pos)));
        const i1 = Math.min(l.path.length - 1, i0 + 1);
        const f = clamp(pos - i0);
        const cx = l.path[i0].x + (l.path[i1].x - l.path[i0].x) * f, cy = l.path[i0].y + (l.path[i1].y - l.path[i0].y) * f;
        const p = { x: L.deck.x + (cx + 0.5) * L.cell, y: L.deck.y + (cy + 0.5) * L.cell };
        const outside = Math.max(0, -cx - 0.5, cx - (L.cols - 0.5), -cy - 0.5, cy - (L.rows - 0.5));
        const alpha = clamp(1 - outside / 2.2);
        if (alpha <= 0) continue;
        const dx = l.path[i1].x - l.path[i0].x, dy = l.path[i1].y - l.path[i0].y;
        const d = i === 0 ? l.dir : dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0;
        paintAnimal(ctx, l.kind, p.x, p.y, d, i === 0 ? size : size * 0.64, this.dpr, { alpha, squash: -0.08 });
        if (i === 0 && l.s < 3) {
          // speed lines behind the leader
          ctx.save();
          ctx.globalAlpha = alpha * 0.5 * (1 - l.s / 3);
          ctx.strokeStyle = C.cream;
          ctx.lineWidth = 1.5;
          for (const k of [-0.2, 0, 0.2]) {
            ctx.beginPath();
            const bx = p.x - DX[l.dir] * L.cell * 0.55 + DY[l.dir] * L.cell * k, by = p.y - DY[l.dir] * L.cell * 0.55 + DX[l.dir] * L.cell * k;
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - DX[l.dir] * L.cell * 0.5, by - DY[l.dir] * L.cell * 0.5);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  }

  private fogTexture(): HTMLCanvasElement {
    if (this.fogTex) return this.fogTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e8e6df';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 3 + 1) * 256, y = hash(i * 3 + 2) * 256, r = 18 + hash(i * 3 + 3) * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const tone = i % 3 ? 'rgba(255,255,255,.55)' : 'rgba(170,180,190,.35)';
      gr.addColorStop(0, tone);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        g.save();
        g.translate(ox, oy);
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.restore();
      }
    }
    this.fogTex = c;
    return c;
  }

  /** The flood's mist over the deck, a clear circle around the door: its radius the focus, the threshold a dashed gold ring. */
  private drawMist(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    if (sim.mist <= 0.01) return;
    const pad = L.cell * 0.4;
    const W = Math.ceil(L.deck.w + pad * 2), H = Math.ceil(L.deck.h + pad * 2);
    if (!this.fogC || this.fogC.width !== Math.round(W * this.dpr) || this.fogC.height !== Math.round(H * this.dpr)) {
      this.fogC = document.createElement('canvas');
      this.fogC.width = Math.round(W * this.dpr);
      this.fogC.height = Math.round(H * this.dpr);
    }
    const g = this.fogC.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    const tex = this.fogTexture();
    const pat = g.createPattern(tex, 'repeat');
    if (pat) {
      const drift = this.opts.reducedMotion ? 0 : this.clock * 9;
      g.save();
      g.translate(-(drift % 256), -((drift * 0.4) % 256));
      g.fillStyle = pat;
      g.fillRect(0, 0, W + 512, H + 512);
      g.restore();
    }
    // cut the clear circle (soft edge)
    const r = sightRadius(L, sightShare(sim.sight));
    const cx = L.door.x - L.deck.x + pad, cy = L.door.y - L.deck.y + pad;
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createRadialGradient(cx, cy, Math.max(1, r * 0.82), cx, cy, r * 1.04);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, r * 1.05, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = 0.97 * sim.mist;
    ctx.drawImage(this.fogC, L.deck.x - pad, L.deck.y - pad, W, H);
    ctx.restore();
    // the rings: the threshold (dashed gold) and the circle's live edge
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.deck.x - pad, L.deck.y - pad, W, H);
    ctx.clip();
    const r5 = sightRadius(L, sightShare(0.5));
    ctx.globalAlpha = sim.mist;
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = sim.blind ? 'rgba(90,90,100,.6)' : 'rgba(232,182,74,.95)';
    ctx.beginPath();
    ctx.arc(L.door.x, L.door.y, r5, Math.PI, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!sim.blind) {
      const above = sim.sight >= 0.5;
      ctx.lineWidth = 3 + 4 * this.ringPulse;
      ctx.strokeStyle = above ? `rgba(255,217,138,${0.65 + 0.35 * this.ringPulse})` : 'rgba(247,240,225,.7)';
      ctx.beginPath();
      ctx.arc(L.door.x, L.door.y, r, Math.PI, TAU);
      ctx.stroke();
    }
    // the threshold's label on the ring
    const ly = L.door.y - r5;
    if (ly > L.deck.y + 6) {
      ctx.font = font(800, 11, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lx = L.door.x + 8;
      ctx.fillStyle = 'rgba(42,33,27,.7)';
      const tw = ctx.measureText(t('hud.ring')).width;
      ctx.fillRect(lx - 4, ly - 8, tw + 8, 16);
      ctx.fillStyle = C.amber2;
      ctx.fillText(t('hud.ring'), lx, ly);
    }
    ctx.restore();
  }

  private drawCursor(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    if (!sim.keyboard || sim.levelState !== 'play') return;
    const x = L.deck.x + sim.cursor.x * L.cell, y = L.deck.y + sim.cursor.y * L.cell;
    ctx.save();
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -this.clock * 20;
    ctx.strokeRect(x + 2, y + 2, L.cell - 4, L.cell - 4);
    ctx.restore();
  }

  private drawDoveFx(ctx: CanvasRenderingContext2D): void {
    const d = this.dove;
    if (!d) return;
    const k = ease.inOutSine(clamp(d.t / 0.45));
    const x = d.from.x + (d.to.x - d.from.x) * k, y = d.from.y + (d.to.y - d.from.y) * k - Math.sin(k * Math.PI) * 40;
    ctx.save();
    ctx.globalAlpha = clamp(1.2 - d.t);
    paintDove(ctx, x, y, 26, Math.sin(this.clock * 30), false, d.to.x < d.from.x ? -1 : 1);
    ctx.restore();
  }

  // ── the bar, the raven, the cards ──────────────────────────────
  private drawBar(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    const b = L.bar;
    ctx.save();
    // a soft plank under the bar
    ctx.fillStyle = 'rgba(42,33,27,.55)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    // hearts (a fourth from the rainbow, drawn in its colours)
    const hs = Math.min(26, b.h * 0.62);
    const n = Math.max(RULES.hearts, sim.hearts);
    for (let i = 0; i < n; i++) {
      const p = this.heartPos(L, i);
      const full = i < sim.hearts;
      const beat = full && sim.hearts === 1 ? 1 + 0.08 * Math.sin(this.clock * 8) : 1;
      paintHeart(ctx, p.x + hs / 2 - 4, p.y + 2, hs * beat, full ? { rainbow: i >= RULES.hearts } : { empty: true });
    }
    for (const hf of this.heartFx) {
      const k = clamp(hf.t / 0.8);
      if (hf.lost) {
        paintHeart(ctx, hf.from.x + hs / 2 - 4 - k * 10, hf.from.y + k * 40, hs * (1 - k * 0.3), { alpha: 1 - k, fill: '#8a2f28' });
      } else {
        const x = hf.from.x + (hf.to.x - hf.from.x) * ease.inOutSine(k), y = hf.from.y + (hf.to.y - hf.from.y) * ease.inOutSine(k) - Math.sin(k * Math.PI) * 60;
        paintHeart(ctx, x, y, hs, { rainbow: true, alpha: 1 - k * 0.3 });
      }
    }
    // the level and its par
    const label = `${t('hud.level', { n: sim.levelN })}`;
    const par = sim.par, over = sim.levelT > par;
    const heartsW = n * (hs + 6) + 20;
    const midX = Math.max(b.x + heartsW + 40, b.x + b.w / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.cream;
    ctx.font = font(700, Math.min(17, b.h * 0.42), SERIF);
    const room = L.dove.x - L.dove.r - (b.x + heartsW) - 10;
    if (room > 70) {
      ctx.fillText(label, midX, b.y + b.h * 0.36);
      ctx.font = font(700, 11, SANS);
      ctx.fillStyle = over || sim.doves || sim.bumps ? 'rgba(247,240,225,.45)' : C.amber2;
      const stars = sim.bumps === 0 && sim.doves === 0 && !over ? '★★★' : sim.bumps <= 1 ? '★★' : '★';
      ctx.fillText(`${stars} · ${t('hud.par', { n: Math.max(0, Math.ceil(par - sim.levelT)) })}`, midX, b.y + b.h * 0.74);
    }
    // the dove's button: a cooldown sweep while it rests
    const d = L.dove;
    ctx.fillStyle = 'rgba(247,240,225,.92)';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    paintDove(ctx, d.x + 2, d.y + 3, d.r * 1.1, Math.sin(this.clock * (sim.doveT > 0 ? 2 : 6)) * 0.5, false, -1);
    if (sim.doveT > 0) {
      ctx.fillStyle = 'rgba(42,33,27,.45)';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.arc(d.x, d.y, d.r, -Math.PI / 2, -Math.PI / 2 + TAU * (sim.doveT / RULES.doveRest));
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = font(800, 10, SANS);
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'right';
    if (b.w > 300) ctx.fillText(t('hud.dove'), d.x - d.r - 6, d.y);
    ctx.restore();
  }

  private drawRaven(ctx: CanvasRenderingContext2D, L: Layout, sim: ArkaSim): void {
    const R = L.raven;
    const line = sim.line;
    const talking = !!line;
    const talk = talking ? 0.5 + 0.5 * Math.sin(this.clock * 18) : 0;
    const idleHop = (this.clock % 5) < 0.4 ? (this.clock % 5) / 0.4 : 0;
    const hop = Math.max(this.ravenHop, idleHop);
    paintRaven(ctx, R.x, R.y, R.s, { bob: hop, talk, face: R.x > this.w / 2 ? -1 : 1, tilt: -this.ravenFlinch * 0.4 * Math.sin(this.clock * 20) });
    if (!line) return;
    const age = sim.now - line.t0;
    const a = clamp(Math.min(age / 0.18, (line.dur - age) / 0.3));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    const fs = this.w < 500 ? 13 : 14;
    ctx.font = font(650, fs, SANS);
    const maxW = Math.min(260, this.w * 0.56);
    const lines = wrapLines(ctx, line.text, maxW - 20);
    const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22);
    const bh = lines.length * (fs + 4) + 14;
    // beside the raven, on the side away from the deck when there is room there
    const roomR = this.w - (R.x + R.s * 0.4) - 8 >= bw && R.x > L.deck.x + L.deck.w;
    const left = !roomR && R.x > this.w / 2;
    let bx = left ? R.x - R.s * 0.3 - bw : R.x + R.s * 0.3;
    let by = R.y - R.s * 0.75 - bh;
    bx = Math.max(8, Math.min(this.w - bw - 8, bx));
    if (by < L.top) by = R.y + 6;
    if (by + bh > this.h - 4) by = this.h - bh - 4;
    ctx.fillStyle = 'rgba(247,240,225,.97)';
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.stroke();
    // the tail toward the raven's beak
    const tx = Math.max(bx + 12, Math.min(bx + bw - 12, R.x + (left ? -R.s * 0.2 : R.s * 0.2)));
    const below = by > R.y;
    ctx.beginPath();
    ctx.moveTo(tx - 7, below ? by : by + bh);
    ctx.lineTo(R.x + (left ? -R.s * 0.1 : R.s * 0.3), R.y - R.s * 0.6);
    ctx.lineTo(tx + 7, below ? by : by + bh);
    ctx.fillStyle = 'rgba(247,240,225,.97)';
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 8 + i * (fs + 4)));
    ctx.restore();
  }

  private drawCard(ctx: CanvasRenderingContext2D, L: Layout): void {
    const c = this.card;
    if (!c) return;
    const k = clamp(Math.min(c.t / 0.25, (c.dur - c.t) / 0.3));
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
    if (c.kind === 'level' || c.kind === 'restart') {
      const y = L.deck.y + L.deck.h * 0.42;
      ctx.font = font(800, Math.min(30, L.deck.w / 9), SERIF);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const s = 0.8 + 0.2 * ease.outBack(clamp(c.t / 0.3));
      ctx.translate(L.door.x, y);
      ctx.scale(s, s);
      const tw = Math.max(ctx.measureText(c.title).width, 120) + 40;
      ctx.fillStyle = 'rgba(42,33,27,.78)';
      roundRect(ctx, -tw / 2, -30, tw, c.text ? 66 : 50, 14);
      ctx.fill();
      ctx.fillStyle = c.kind === 'restart' ? C.cream : C.amber2;
      ctx.fillText(c.title, 0, c.text ? -10 : -5);
      if (c.text) {
        ctx.font = font(700, 13, SANS);
        ctx.fillStyle = C.cream;
        ctx.fillText(c.text, 0, 18);
      }
      ctx.restore();
      return;
    }
    // the big cards: a parchment panel over a dimmed deck
    ctx.fillStyle = 'rgba(20,14,8,.45)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pw = Math.min(this.w - 32, 460);
    // the panel fits its content: the title, the wrapped text and (on the opening card) the root passage
    ctx.font = font(500, 15, SANS);
    const textLines = c.kind === 'clear' ? [] : wrapLines(ctx, c.text, pw - 40);
    let ph = c.kind === 'clear' ? 200 : 66 + textLines.length * 21 + 14;
    if (c.kind === 'open') {
      if (!this.verse.l || this.verse.w !== pw) {
        this.verse.l = layoutPassage(ctx, passage(this.verse.id), pw - 48, Math.max(40, this.h - L.top - 40 - ph - 20), { max: 17, min: 11 });
        this.verse.w = pw;
      }
      ph += this.verse.l.height + 14;
    }
    ph = Math.min(ph, this.h - L.top - 14);
    const px = (this.w - pw) / 2;
    const py = Math.max(L.top + 4, Math.min(this.h - ph - 10, (this.h - ph) / 2 + 20));
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = C.walnut;
    ctx.lineWidth = 3;
    roundRect(ctx, px, py, pw, ph, 16);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 24, SERIF);
    ctx.fillText(c.title, this.w / 2, py + 16);
    if (c.kind === 'clear' && c.ev) {
      const e = c.ev;
      for (let i = 0; i < 3; i++) {
        const sk = clamp((c.t - 0.25 - i * 0.22) / 0.3);
        const filled = i < e.stars && sk > 0;
        paintStar(ctx, this.w / 2 + (i - 1) * 54, py + 82 - (i === 1 ? 8 : 0), 22 * (filled ? ease.outBack(sk) : 1), filled, filled ? (1 - sk) * 0.8 : 0);
      }
      ctx.font = font(700, 14, SANS);
      ctx.fillStyle = C.ink2;
      const what = [t('card.time', { sec: Math.round(e.sec), par: e.par }), e.bumps ? t('card.bumps', { n: e.bumps }) : t('card.noBump')];
      if (e.doves) what.push(t('card.dove'));
      ctx.fillText(what.join(' · '), this.w / 2, py + 118);
      ctx.font = font(600, 12, SANS);
      ctx.fillStyle = 'rgba(42,33,27,.6)';
      ctx.fillText(t('card.tap'), this.w / 2, py + ph - 28);
    } else {
      ctx.font = font(500, 15, SANS);
      ctx.fillStyle = C.ink2;
      textLines.forEach((l, i) => ctx.fillText(l, this.w / 2, py + 56 + i * 21));
      if (c.kind === 'open' && this.verse.l) {
        const p = passage(this.verse.id);
        const top = py + 66 + textLines.length * 21;
        drawPassage(ctx, p, this.verse.l, this.w / 2, top, { text: C.walnut2, ref: 'rgba(42,33,27,.6)' });
      }
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
