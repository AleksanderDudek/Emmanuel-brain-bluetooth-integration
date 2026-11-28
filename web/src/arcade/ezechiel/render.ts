/**
 * Rzeka Ezechiela's view: the valley at dawn, the river rising up the figure of light, the dust and the washing, the
 * trees and their leaves, the leaves laid in prayer, the measuring lines, the mist of a blind push, the far sea
 * turning fresh at the end — and the words band (the stage, what to do now, the prayer and the verse), the ≡ button,
 * the place chooser and the story card.  It reads the sim and never changes it; the layers are baked per size
 * (paint.ts), so a frame composes them and draws a few dozen small shapes.
 */
import { breathAt, type BreathPhase, type BreathState } from '../kit/breath';
import { breathGuideBox, breathGuideRadius, drawBreathGuide, type BreathGuideOpts } from '../kit/breathguide';
import { figurePath } from '../kit/figure';
import { approach, clamp } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { passage, type PassageId } from '../kit/scripture';
import type { Insets, TapTarget } from '../kit/types';
import { MARK_Y, PLACES, placePoints, waterY, type MarkId, type PlaceId } from './content';
import { markName, placeName, stageName, t, type Key } from './i18n';
import { figPt, hitTest, layout, pickerRect, storyRect, tapTargets, type Hit, type Layout } from './layout';
import {
  AQUA, GOLD, GOLD_HI, LEAF, LEAF_HI, PEARL, bakeDust, bakeFigure, bakeLand, bakeTree, figureBox, font, fontPx, glow, hash, leafShape, polyPath, river,
  rr, treeGeo, treeSpecs, wrap, type Layer, type TreeGeo,
} from './paint';
import { RULES } from './rules';
import type { EzechielSim, SimEvent } from './sim';

const TAU = Math.PI * 2;

/** One styled line of the words band's body. */
interface BodyLine { text: string; font: string; color: string; h: number }

interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string }
interface Floater { text: string; x: number; y: number; t: number }

export class EzechielView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private land: Layer | null = null;
  private landKey = '';
  private fig: Layer | null = null;
  private dust: Layer | null = null;
  private figKey = '';
  private sil: { lift: number; path: Path2D } | null = null;
  private trees: { geo: TreeGeo; layer: Layer | null; key: string }[] = [];
  private leafKey = '';
  private time = 0;
  private mist = 0;
  private washK = 0;
  private goldK = 0;
  private growing: { i: number; t: number } | null = null;
  private readonly sparks: Spark[] = [];
  private readonly floaters: Floater[] = [];
  private markerT = -10;
  private hoverAt: { x: number; y: number } | null = null;
  private storyCache: { key: string; h: number } | null = null;
  private bodyCache: { key: string; pages: BodyLine[][] } | null = null;
  private pageT = 0;
  private pageIdx = 0;
  /** beside the picture (side, desk) the words card is as tall as its words: where they ended last frame, and the card's eased height */
  private bandEnd = 0;
  private bandH = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, undefined, opts.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.opts.touch);
    this.landKey = '';
    this.figKey = '';
    this.sil = null;
    this.trees = treeSpecs(this.L).map(s => ({ geo: treeGeo(s), layer: null, key: '' }));
    this.leafKey = '';
    this.storyCache = null;
    this.bodyCache = null;
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: SimEvent, sim: EzechielSim): void {
    switch (e.type) {
      case 'leaf': {
        const i = sim.oldLeaves + e.n - 1;
        this.growing = { i, t: this.time };
        const p = this.leafPos(i);
        if (p) this.floaters.push({ text: '+1', x: p.x, y: p.y - 6, t: 0 });
        break;
      }
      case 'mark': {
        const yw = figPt(this.L, 0, MARK_Y[e.mark]).y;
        this.burst(this.L.fig.cx, yw, 14, GOLD_HI);
        break;
      }
      case 'place':
        this.markerT = this.time;
        break;
      case 'lay':
        this.markerT = -10;
        break;
      case 'fruit': {
        const tr = this.trees[(e.n - 1) % Math.max(1, this.trees.length)];
        const f = tr?.geo.fruits[Math.floor((e.n - 1) / Math.max(1, this.trees.length))];
        if (f) this.burst(f.x, f.y, 10, '#ffd27a');
        break;
      }
      case 'blindEnd':
        this.mist = Math.min(this.mist, 0.9);
        break;
      default:
        break;
    }
  }

  private burst(x: number, y: number, n: number, color: string): void {
    if (this.opts.reducedMotion) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + hash(i + this.time) * 0.4;
      const v = 18 + 30 * hash(i * 3 + this.time);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 10, t: 0, life: 0.9 + 0.5 * hash(i), color });
    }
    if (this.sparks.length > 120) this.sparks.splice(0, this.sparks.length - 120);
  }

  update(dt: number, sim: EzechielSim): void {
    this.time += dt;
    this.mist = approach(this.mist, sim.blind ? 1 : 0, dt, sim.blind ? 1.2 : 0.7);
    const washing = sim.step?.kind === 'wash' && (sim.rising || sim.reveal.t >= 0) ? 1
      : sim.restBlock && sim.block.why === 'wash' ? 0.35 : sim.restBlock && sim.block.why === 'mark' && sim.markReached >= 4 ? 0.2 : 0;
    this.washK = approach(this.washK, washing, dt, 0.8);
    this.goldK = approach(this.goldK, sim.goldOn ? 1 : 0, dt, 0.35);
    for (const s of this.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 20 * dt;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) if (this.sparks[i].t >= this.sparks[i].life) this.sparks.splice(i, 1);
    for (const f of this.floaters) f.t += dt;
    for (let i = this.floaters.length - 1; i >= 0; i--) if (this.floaters[i].t > 1.6) this.floaters.splice(i, 1);
    if (this.growing && this.time - this.growing.t > 0.9) this.growing = null;
    this.pageT += dt;
  }

  // ── geometry ────────────────────────────────────────────────────
  /** The figure's lift (figure units) while it floats, breathing with the rest. */
  lift(sim: EzechielSim): number {
    const br = sim.breath;
    return sim.floatK * (0.045 + 0.008 * (br ? br.k : 0.5));
  }

  /** Where the i-th leaf of the trees hangs (screen), or null when the trees are full. */
  leafPos(i: number): { x: number; y: number; a: number } | null {
    const at = leafSlot(this.trees.map(tr => tr.geo.leaves.length), i);
    if (!at) return null;
    const l = this.trees[at.tree].geo.leaves[at.slot];
    return l ? { x: l.x, y: l.y, a: l.a } : null;
  }

  private storyBox(sim: EzechielSim): { x: number; y: number; w: number; h: number } | null {
    if (!sim.story) return null;
    return storyRect(this.L, this.storyContentH(sim));
  }

  hit(sim: EzechielSim, x: number, y: number): Hit {
    return hitTest(this.L, { story: this.storyBox(sim), picker: sim.picker, lift: this.lift(sim) }, x, y);
  }

  targets(sim: EzechielSim): TapTarget[] {
    if (!sim.started || sim.phase === 'done') return [];
    return tapTargets(this.L, { story: this.storyBox(sim), picker: sim.picker, lift: this.lift(sim) });
  }

  hover(x: number, y: number): void {
    this.hoverAt = { x, y };
  }

  // ── baking ──────────────────────────────────────────────────────
  private ensure(sim: EzechielSim): void {
    const L = this.L;
    const far = Math.round(sim.farK * 10) / 10;
    const lk = `${L.w}x${L.h}@${this.dpr}:${far}`;
    if (lk !== this.landKey) {
      this.land = bakeLand(L, this.dpr, far);
      this.landKey = lk;
    }
    const fk = `${L.w}x${L.h}@${this.dpr}`;
    if (fk !== this.figKey) {
      this.fig = bakeFigure(L, this.dpr);
      this.dust = bakeDust(L, this.dpr);
      this.figKey = fk;
    }
    const n = this.trees.length;
    const shown = sim.oldLeaves + sim.leaves - (this.growing ? 1 : 0);
    const buds = sim.water >= 2.5;
    const want = `${sim.oldLeaves}:${shown}:${sim.fruits}:${buds}`;
    if (want === this.leafKey) return;
    this.leafKey = want;
    const caps = this.trees.map(tr => tr.geo.leaves.length);
    this.trees.forEach((tr, k) => {
      const old = leavesOn(caps, k, sim.oldLeaves);
      const all = leavesOn(caps, k, shown);
      const fruits = Math.ceil(Math.max(0, sim.fruits - k) / n);
      const key = `${old}:${all}:${fruits}:${this.dpr}`;
      if (key !== tr.key) {
        tr.layer = bakeTree(tr.geo, this.dpr, old, Math.max(0, all - old), fruits, buds);
        tr.key = key;
      }
    });
  }

  private silhouette(lift: number): Path2D | null {
    if (typeof Path2D === 'undefined') return null;
    const k = Math.round(lift * this.L.fig.H * 2) / 2;
    if (this.sil && this.sil.lift === k) return this.sil.path;
    const off = k / this.L.fig.H;
    const path = figurePath((x, y) => [this.L.fig.cx + x * this.L.fig.H, this.L.fig.top + (y - off) * this.L.fig.H]);
    this.sil = { lift: k, path };
    return path;
  }

  // ── the frame ───────────────────────────────────────────────────
  draw(sim: EzechielSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    this.ensure(sim);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.land) ctx.drawImage(this.land, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#e4c999';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    drawScene(ctx, L, {
      time: this.opts.reducedMotion ? 0 : this.time, water: sim.water, lift: this.lift(sim), dust: sim.dust, washK: this.washK, goldK: this.goldK,
      mist: this.mist, fig: this.fig, dust_: this.dust, trees: this.trees, sil: this.silhouette(this.lift(sim)), farK: sim.farK,
      markReached: sim.markReached, lineK: sim.lineT >= 0 ? clamp((sim.t - sim.lineT) / RULES.lineSec) : 1,
      leavesGreen: Math.min(1, (sim.oldLeaves + sim.leaves) / 20), reduced: this.opts.reducedMotion, finale: sim.phase !== 'play',
      behind: () => this.drawLaid(ctx, sim, 'behind'), onFigure: () => this.drawLaid(ctx, sim, 'on'),
    });
    this.drawGrowing(ctx);
    this.drawLaid(ctx, sim, 'flying');
    this.drawMarker(ctx, sim);
    this.drawSparks(ctx);
    this.drawBand(ctx, sim);
    this.drawList(ctx, sim);
    if (sim.picker) this.drawPicker(ctx, sim);
    if (sim.story) this.drawStory(ctx, sim);
  }

  /** The newest leaf on its tree unfolding (0.9 s), and the "+1" over it. */
  private drawGrowing(ctx: CanvasRenderingContext2D): void {
    const g = this.growing;
    if (g) {
      const p = this.leafPos(g.i);
      const tr = this.trees[g.i % Math.max(1, this.trees.length)];
      if (p && tr) {
        const k = this.opts.reducedMotion ? 1 : clamp((this.time - g.t) / 0.9);
        const len = tr.geo.spec.size * 0.085;
        glow(ctx, '#e6ffb8', p.x, p.y, len * (1.2 + 1.2 * (1 - k)), 0.5 * (1 - k) + 0.3);
        leafShape(ctx, p.x, p.y, p.a, len * (0.3 + 0.7 * k), LEAF, LEAF_HI, this.opts.reducedMotion ? k : 1);
      }
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(13 * this.L.u, 800);
    for (const f of this.floaters) {
      const a = clamp(1.6 - f.t) * clamp(f.t * 6);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(30,60,30,.55)';
      ctx.fillText(f.text, f.x + 1, f.y - f.t * 18 + 1);
      ctx.fillStyle = GOLD_HI;
      ctx.fillText(f.text, f.x, f.y - f.t * 18);
    }
    ctx.restore();
  }

  /** The leaves laid this session: on their way from a tree (or fading in), then resting on their place. */
  private drawLaid(ctx: CanvasRenderingContext2D, sim: EzechielSim, which: 'behind' | 'on' | 'flying'): void {
    const L = this.L, H = L.fig.H, lift = this.lift(sim);
    const count = new Map<PlaceId, number>();
    for (const l of sim.laid) {
      const k = count.get(l.place) ?? 0;
      count.set(l.place, k + 1);
      const fly = clamp((sim.t - l.t) / RULES.layFly);
      const pts = placePoints(l.place);
      pts.forEach(([px, py], j) => {
        const ang = k * 2.4 + j;
        // a rosette round the place; past the most a 30-minute session lays there, the leaves settle on its rim
        const rr0 = k ? 0.016 * Math.sqrt(Math.min(k, RULES.laidRing)) : 0;
        const to = figPt(L, px + Math.cos(ang) * rr0, py + Math.sin(ang) * rr0, lift);
        const len = 0.06 * H;
        const behind = l.place === 'back';
        if (fly < 1 && !this.opts.reducedMotion) {
          if (which !== 'flying') return;
          const from = this.leafPos(Math.max(0, sim.oldLeaves + l.i * 3 + j)) ?? { x: to.x + (px < 0 ? -0.6 : 0.6) * H, y: to.y - 0.2 * H, a: 0 };
          const e = 1 - (1 - fly) ** 2;
          const cxp = (from.x + to.x) / 2, cyp = Math.min(from.y, to.y) - 0.15 * H;
          const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cxp + e * e * to.x;
          const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cyp + e * e * to.y;
          glow(ctx, '#e6ffb8', x, y, len * 1.4, 0.55);
          leafShape(ctx, x, y, fly * 6 + j, len * (0.7 + 0.3 * e), LEAF, LEAF_HI);
          return;
        }
        if (which === 'flying' || (which === 'behind') !== behind) return;
        const a = this.opts.reducedMotion ? fly : 1;
        const pulse = 1 + 0.6 * clamp(1 - (sim.t - l.t - RULES.layFly) / 1.5);
        const col = l.place === 'matter' ? '#ffc9a8' : '#e6ffb8';
        glow(ctx, col, to.x, to.y, len * 1.3 * pulse, 0.55 * a);
        leafShape(ctx, to.x, to.y, -0.6 + ang * 0.3, len, behind ? '#a9e88e' : LEAF, LEAF_HI, behind ? 0.75 * a : a);
      });
    }
  }

  /** The place of the next leaf: a soft dashed ring (in the trees' pushes, the chooser, a moment after choosing). */
  private drawMarker(ctx: CanvasRenderingContext2D, sim: EzechielSim): void {
    const recent = this.time - this.markerT < 2.5;
    const trees = sim.pushBlock && sim.step?.kind === 'trees' && !sim.blind;
    let place: PlaceId | null = recent || trees || sim.picker ? sim.nextPlace : null;
    let label = false;
    // a desktop's mouse over the figure: the place under it answers (its ring and its name)
    if (!this.opts.touch && this.hoverAt && !sim.picker && !sim.story) {
      const h = this.hit(sim, this.hoverAt.x, this.hoverAt.y);
      if (h && h.startsWith('figure:')) {
        place = h.slice(7) as PlaceId;
        label = true;
      }
    }
    if (!place) return;
    const L = this.L, H = L.fig.H, lift = this.lift(sim);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(255,236,170,${0.6 + 0.3 * Math.sin(this.time * 3)})`;
    for (const [px, py] of placePoints(place)) {
      const p = figPt(L, px, py, lift);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.038 * H + 3, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (label || recent) {
      const [px, py] = placePoints(place)[0];
      const p = figPt(L, px, py, lift);
      const text = placeName(place);
      ctx.font = font(L.font.label, 700);
      const tw = ctx.measureText(text).width + 14;
      const x = Math.max(L.left, Math.min(L.right - tw, p.x - tw / 2)), y = p.y - 0.06 * H - 22;
      ctx.fillStyle = 'rgba(8,40,52,.8)';
      rr(ctx, x, y, tw, 22, 11);
      ctx.fill();
      ctx.fillStyle = GOLD_HI;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + tw / 2, y + 11);
    }
    ctx.restore();
  }

  private drawSparks(ctx: CanvasRenderingContext2D): void {
    for (const s of this.sparks) {
      const a = clamp(1 - s.t / s.life);
      glow(ctx, s.color, s.x, s.y, 5 * this.L.u, a * 0.8);
    }
  }

  // ── the words band ──────────────────────────────────────────────
  /** Row 1: the stage and its detail ("Wznoszenie · do kolan", "Obmycie · 1/2", "Liść · serce"). */
  label(sim: EzechielSim): string {
    const st = sim.stage;
    const name = stageName(st);
    const s = sim.stepAt(sim.block.step) ?? sim.step;
    if (st === 'rise') {
      const m = sim.restBlock ? sim.markReached : Math.min(4, s?.to ?? 1);
      return m >= 1 ? `${name} · ${markName(m as MarkId)}` : name;
    }
    if (st === 'wash' && s?.kind === 'wash') return `${name} · ${s.pass}/${s.of}`;
    if (st === 'trees' && s?.kind === 'trees') return `${name} · ${Math.min(s.leaves, Math.floor(sim.stepK * s.leaves + 1e-9))}/${s.leaves}`;
    const last = sim.laid[sim.laid.length - 1];
    const laidNow = !!last && sim.restBlock && last.t >= sim.t - sim.blockT - 0.01;
    if (last && (st === 'lay' || (st === 'float' && laidNow))) return `${stageName('lay')} · ${placeName(last.place)}`;
    return name;
  }

  /** Row 2: what to do now (it changes with the block only). */
  nowLine(sim: EzechielSim): string {
    if (sim.phase !== 'play') return t('now.close');
    const b = sim.block;
    if (b.kind === 'warmup') return t('now.warm');
    if (b.kind === 'rest') {
      if (sim.reveal.t >= 0) return t('now.reveal');
      const why = b.why;
      return t(why === 'lay' ? 'now.lay' : why === 'float' ? 'now.float' : why === 'valve' ? 'now.valve' : 'now.rest');
    }
    if (b.blind) return t('now.blind');
    if (sim.blockT < sim.leadIn) return t('now.lead');
    const s = sim.step;
    return t(s?.kind === 'wash' ? 'now.wash' : s?.kind === 'trees' ? 'now.trees' : 'now.rise');
  }

  /** The band's body: the prayer and the verse of the moment (as text lines with their styles). */
  private bodyParts(sim: EzechielSim): { prayer: string; goal: string; verse: PassageId | null; label: string } {
    const b = sim.block;
    let prayer = '', goal = '', label = '';
    if (sim.phase !== 'play') prayer = t('pray.close');
    else if (b.kind === 'warmup') prayer = t('pray.prog');
    else if (b.kind === 'push') {
      const s = sim.step;
      if (s?.kind === 'rise') goal = s.to >= 4 ? t('goal.river') : t('goal.rise', { mark: markName(Math.min(4, s.to) as MarkId) });
      else if (s?.kind === 'wash') goal = t('goal.wash', { n: s.pass, of: s.of });
      else if (s) goal = t('goal.trees', { n: Math.min(s.leaves, Math.floor(sim.stepK * s.leaves + 1e-9)), of: s.leaves });
      if (b.blind) goal = '';
      prayer = sim.stage === 'prog' ? t('pray.prog') : t(s?.kind === 'wash' ? 'pray.wash' : s?.kind === 'trees' ? 'pray.trees' : 'pray.rise');
    } else {
      const last = sim.laid[sim.laid.length - 1];
      const laidNow = !!last && last.t >= sim.t - sim.blockT - 0.01;
      if (b.why === 'lay' || (b.why === 'float' && laidNow)) {
        prayer = last?.place === 'matter' ? t('pray.layMatter') : t('pray.lay');
        if (last?.place === 'matter' && last.label) label = last.label;
      } else if (b.why === 'float') prayer = t('pray.float');
      else if (b.why === 'valve') prayer = t('pray.valve');
      else if (b.why === 'wash' || (b.why === 'mark' && sim.markReached >= 4 && sim.washes > 0 && sim.passes === 0)) prayer = t('pray.release');
      else prayer = t('pray.rise');
    }
    return { prayer, goal, verse: sim.verse, label };
  }

  private bodyLines(ctx: CanvasRenderingContext2D, sim: EzechielSim, w: number, h: number): BodyLine[][] {
    const L = this.L;
    const parts = this.bodyParts(sim);
    const key = `${parts.prayer}|${parts.goal}|${parts.verse}|${parts.label}|${w}|${h}`;
    if (this.bodyCache?.key === key) return this.bodyCache.pages;
    const lines: BodyLine[] = [];
    const add = (text: string, f: string, color: string, size: number, lead = 1.3) => {
      ctx.font = f;
      for (const ln of wrap(ctx, text, w)) lines.push({ text: ln, font: f, color, h: Math.round(size * lead) });
    };
    if (parts.goal) add(parts.goal, font(L.font.now, 600), '#bfeff3', L.font.now);
    if (parts.prayer) add(parts.prayer, font(L.font.prayer, 600, true), '#fff4dc', L.font.prayer, 1.28);
    if (parts.label) add(`„${parts.label}”`, font(L.font.prayer, 500, true, true), '#ffd6c0', L.font.prayer);
    if (parts.verse) {
      const p = passage(parts.verse);
      const vs = Math.max(MIN_READ, L.font.verse - 1);
      if (lines.length) lines.push({ text: '', font: font(vs), color: '', h: Math.round(vs * 0.45) });
      add(p.text, font(vs, 400, true, true), '#d8f3f6', vs, 1.32);
      const rs = Math.max(11, Math.round(vs * 0.72));
      lines.push({ text: `${p.ref} · ${p.bible}`, font: font(rs, 600), color: '#94cbd4', h: Math.round(rs * 1.5) });
    }
    // whole lines in pages that fit the body; a page never cuts a line
    const pages: BodyLine[][] = [];
    let cur: BodyLine[] = [], used = 0;
    for (const ln of lines) {
      if (cur.length && used + ln.h > h) {
        pages.push(cur);
        cur = [];
        used = 0;
        if (!ln.text) continue;
      }
      cur.push(ln);
      used += ln.h;
    }
    if (cur.length) pages.push(cur);
    this.bodyCache = { key, pages };
    // new words show at once (their change is the news); only a page turn fades
    this.pageT = 0.4;
    this.pageIdx = 0;
    return pages;
  }

  private drawBand(ctx: CanvasRenderingContext2D, sim: EzechielSim): void {
    const L = this.L, B = L.band, u = L.u, pad = L.pad;
    ctx.save();
    const fitH = L.shape === 'tall' || !this.bandEnd ? B.h : Math.min(B.h, this.bandEnd - B.y);
    this.bandH = this.bandH && L.shape !== 'tall' ? this.bandH + (fitH - this.bandH) * 0.2 : fitH;
    const cardH = Math.min(B.h, this.bandH);
    ctx.fillStyle = 'rgba(6,34,46,.8)';
    rr(ctx, B.x, B.y, B.w, cardH, 14 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,236,244,.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const x = B.x + pad, w = B.w - 2 * pad;
    let y = B.y + pad;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    // a rest: the kit's breath guide (round 15) — on a phone held upright in place of the stage's name and the line
    // of what to do now (the band is short there; the guide's word is the instruction), elsewhere between them
    const br = sim.restBlock ? breathAt(sim.breathP, sim.breathT) : null;
    const tallRest = !!br && L.shape === 'tall';
    // row 1: the stage — and where the next leaf goes while the trees grow, right-aligned
    if (!tallRest) {
      let right = '';
      if (!br && sim.pushBlock && sim.step?.kind === 'trees' && !sim.blind) right = t('next', { place: placeName(sim.nextPlace) });
      ctx.font = font(L.font.label, 700);
      let rw = right ? ctx.measureText(right).width : 0;
      const lab = this.label(sim);
      let lw = ctx.measureText(lab).width;
      if (lw + rw + 12 > w) {
        right = '';
        rw = 0;
      }
      ctx.fillStyle = GOLD;
      let labText = lab;
      if (lw + rw + 12 > w) {
        labText = stageName(sim.stage);
        lw = ctx.measureText(labText).width;
      }
      ctx.fillText(labText, x, y);
      if (right) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffe6b0';
        ctx.fillText(right, x + w, y);
        ctx.textAlign = 'left';
      }
      y += Math.round(L.font.label * 1.45);
    }
    if (br) {
      y += this.drawGuide(ctx, sim, br, B.x + B.w / 2, y, w) + 6 * u;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
    }
    // row 2: the narrator's line while it speaks, else what to do now (in a rest on a phone held upright, the guide)
    const line = sim.talk.line;
    const now = this.nowLine(sim);
    const glowIn = sim.reshow > 0 ? 1 : 0;
    const row2 = (text: string, weight: number, italic: boolean): number => {
      const size = this.fitLine(ctx, text, w, L.font.now, weight, italic, italic);
      ctx.font = font(size, weight, italic, italic);
      const lines = ctx.measureText(text).width > w ? wrap(ctx, text, w).slice(0, 2) : [text];
      lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * Math.round(size * 1.3)));
      return lines.length;
    };
    let rows = 1;
    if (line) {
      const a = clamp(line.t / 0.3) * clamp((line.dur - line.t) / 0.4);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      rows = row2(line.text, 500, true);
      ctx.globalAlpha = 1;
    } else if (!tallRest) {
      ctx.fillStyle = glowIn ? '#ffffff' : '#e8fbff';
      rows = row2(now, 700, false);
    } else rows = 0;
    if (rows) y += Math.round(L.font.now * (1.55 + 1.3 * (rows - 1)));
    // the body: the prayer and the verse, in pages of whole lines that turn slowly when they do not fit
    const bodyH = B.y + B.h - pad - y;
    if (bodyH > 12) {
      const pages = this.bodyLines(ctx, sim, w, bodyH);
      if (pages.length) {
        const chars = pages[this.pageIdx % pages.length].reduce((s, l) => s + l.text.length, 0);
        if (pages.length > 1 && this.pageT > Math.max(5, 2 + chars * 0.055)) {
          this.pageIdx = (this.pageIdx + 1) % pages.length;
          this.pageT = this.pageT > 30 ? 1 : 0;
        }
        const page = pages[this.pageIdx % pages.length];
        // the card ends under the tallest page (so it does not jump when a page turns), with room for the dots
        const tallest = Math.max(...pages.map(pg => pg.reduce((sum, l) => sum + l.h, 0)));
        this.bandEnd = y + tallest + pad + (pages.length > 1 ? 10 * u : 0);
        const fade = pages.length > 1 ? clamp(this.pageT / 0.4) : 1;
        ctx.globalAlpha = fade * (glowIn ? 1 : 0.97);
        for (const ln of page) {
          if (ln.text) {
            ctx.font = ln.font;
            ctx.fillStyle = ln.color;
            ctx.fillText(ln.text, x, y);
          }
          y += ln.h;
        }
        ctx.globalAlpha = 1;
        if (pages.length > 1) {
          // page dots at the band's bottom right
          for (let i = 0; i < pages.length; i++) {
            ctx.fillStyle = i === this.pageIdx % pages.length ? GOLD : 'rgba(200,236,240,.35)';
            ctx.beginPath();
            ctx.arc(B.x + B.w - pad - (pages.length - 1 - i) * 9 * u, B.y + cardH - 7 * u, 2.4 * u, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  /**
   * The breath guide in the band (kit/breathguide.ts, round 15): a row — the ring, the phase in a word beside it and
   * "oddech 2 z 3" under it — centred at (cx, top + its height / 2); its height returned.
   */
  private drawGuide(ctx: CanvasRenderingContext2D, sim: EzechielSim, br: BreathState, cx: number, top: number, w: number): number {
    const L = this.L;
    const r = Math.max(26, Math.min(breathGuideRadius(L.w, L.h), Math.round(w * 0.16)));
    const pad = Math.max(10, Math.round(r * 0.3));
    const of = sim.block.cycles;
    const words = Object.fromEntries((['in', 'holdIn', 'out', 'holdOut'] as const).map(k => [k, t(`ph.${k}` as Key)])) as Record<BreathPhase, string>;
    const o: BreathGuideOpts = {
      cx, cy: 0, r, layout: 'row', words, sub: of > 1 ? t('breathOf', { n: Math.min(of, br.n + 1), of }) : undefined,
      maxW: Math.max(80, w - (2 * r + 2.9 * pad)), reducedMotion: this.opts.reducedMotion, time: this.time, scrim: 0.5,
    };
    const h = breathGuideBox(ctx, o).h;
    drawBreathGuide(ctx, br, { ...o, cy: top + h / 2 });
    return h;
  }

  /** A one-line text's size: from `px` down to 13 px; at 13 px it is cut with "…" by the caller's width (rare). */
  private fitLine(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, weight: number, serif = false, italic = false): number {
    let size = fontPx(px);
    ctx.font = font(size, weight, serif, italic);
    while (size > MIN_READ && ctx.measureText(text).width > w) {
      size = Math.max(MIN_READ, size - 0.5);
      ctx.font = font(size, weight, serif, italic);
    }
    return size;
  }

  /** The ≡ button (the place chooser): a round leaf-green glass button in the thumb zone. */
  private drawList(ctx: CanvasRenderingContext2D, sim: EzechielSim): void {
    if (sim.story) return;
    const L = this.L, r = L.list, u = L.u;
    const hover = !this.opts.touch && this.hoverAt && this.hit(sim, this.hoverAt.x, this.hoverAt.y) === 'list';
    ctx.save();
    ctx.fillStyle = sim.picker || hover ? 'rgba(20,80,90,.92)' : 'rgba(6,40,52,.78)';
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = sim.picker || hover ? GOLD : 'rgba(190,240,246,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = PEARL;
    ctx.lineWidth = 2.2 * u;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * 0.32, r.y + r.h / 2 + i * 6.5 * u);
      ctx.lineTo(r.x + r.w * 0.68, r.y + r.h / 2 + i * 6.5 * u);
      ctx.stroke();
    }
    // a little leaf at its corner: the chooser is about where the leaves go
    leafShape(ctx, r.x + r.w * 0.82, r.y + r.h * 0.2, -0.7, 9 * u, LEAF, LEAF_HI);
    ctx.restore();
  }

  // ── the place chooser ───────────────────────────────────────────
  private drawPicker(ctx: CanvasRenderingContext2D, sim: EzechielSim): void {
    const L = this.L, P = pickerRect(L), u = L.u;
    ctx.save();
    ctx.fillStyle = 'rgba(4,20,28,.45)';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.fillStyle = 'rgba(8,40,52,.95)';
    rr(ctx, P.card.x, P.card.y, P.card.w, P.card.h, 16 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,138,.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD_HI;
    const title = t('picker.title');
    const ts = this.fitLine(ctx, title, P.card.w - 24 * u - 52, L.font.now + 1, 700);
    ctx.font = font(ts, 700);
    ctx.fillText(title, P.card.x + 12 * u, P.titleY);
    // close ×
    const c = P.close;
    ctx.strokeStyle = PEARL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x + c.w * 0.35, c.y + c.h * 0.35);
    ctx.lineTo(c.x + c.w * 0.65, c.y + c.h * 0.65);
    ctx.moveTo(c.x + c.w * 0.65, c.y + c.h * 0.35);
    ctx.lineTo(c.x + c.w * 0.35, c.y + c.h * 0.65);
    ctx.stroke();
    const next = sim.nextPlace;
    ctx.textAlign = 'center';
    for (const ch of P.chips) {
      const on = ch.place === next;
      ctx.fillStyle = on ? 'rgba(255,217,138,.22)' : 'rgba(170,236,244,.1)';
      rr(ctx, ch.r.x, ch.r.y, ch.r.w, ch.r.h, 10 * u);
      ctx.fill();
      ctx.strokeStyle = on ? GOLD : 'rgba(170,236,244,.35)';
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = on ? GOLD_HI : '#e8fbff';
      const name = placeName(ch.place);
      const num = this.opts.touch ? '' : `${PLACES.indexOf(ch.place) + 1} `;
      const text = `${num}${name}`;
      ctx.font = font(L.font.chip, 700);
      if (ctx.measureText(text).width > ch.r.w - 10) {
        // a long name on two lines rather than under 13 px
        const lines = wrap(ctx, text, ch.r.w - 10).slice(0, 2);
        const lh = L.font.chip * 1.15;
        lines.forEach((ln, i) => ctx.fillText(ln, ch.r.x + ch.r.w / 2, ch.r.y + ch.r.h / 2 + (i - (lines.length - 1) / 2) * lh));
      } else ctx.fillText(text, ch.r.x + ch.r.w / 2, ch.r.y + ch.r.h / 2);
    }
    ctx.fillStyle = 'rgba(200,236,240,.8)';
    const note = t(this.opts.touch ? 'picker.note' : 'picker.noteKeys');
    const ns = this.fitLine(ctx, note, P.card.w - 24 * u, L.font.label, 500);
    ctx.font = font(ns, 500);
    ctx.fillText(note, P.card.x + P.card.w / 2, P.noteY);
    ctx.restore();
  }

  // ── the story card ──────────────────────────────────────────────
  private storyContentH(sim: EzechielSim): number {
    const ctx = this.ctx, s = sim.story;
    if (!ctx || !s) return 200;
    const key = `${s.page}|${this.L.w}x${this.L.h}`;
    if (this.storyCache?.key === key) return this.storyCache.h;
    const h = this.storyLayout(ctx, sim, null);
    this.storyCache = { key, h };
    return h;
  }

  /** Lay out (and, with a box, draw) the story card's page; returns its content height. */
  private storyLayout(ctx: CanvasRenderingContext2D, sim: EzechielSim, box: { x: number; y: number; w: number; h: number } | null): number {
    const L = this.L, u = L.u, s = sim.story!;
    const w = Math.min(L.right - L.left, 460 * u) - 32 * u;
    let y = box ? box.y + 16 * u : 0;
    const x = box ? box.x + 16 * u : 0;
    const put = (text: string, f: string, color: string, size: number, lead = 1.32): void => {
      ctx.font = f;
      for (const ln of wrap(ctx, text, w)) {
        if (box) {
          ctx.fillStyle = color;
          ctx.fillText(ln, x, y);
        }
        y += Math.round(size * lead);
      }
    };
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const title = s.page === 0 ? t('story.open.title') : t('story.what.title');
    put(title, font(L.font.title, 700, true), GOLD_HI, L.font.title);
    y += 4 * u;
    if (s.page === 0) {
      put(t('story.open.lead'), font(L.font.now, 600), '#e8fbff', L.font.now);
      y += 6 * u;
      const p = passage('ezk47.1');
      const vs = Math.max(MIN_READ, L.font.verse - 1);
      put(p.text, font(vs, 400, true, true), '#d8f3f6', vs);
      put(`${p.ref} · ${p.bible}`, font(Math.max(11, vs * 0.72), 600), '#94cbd4', Math.max(11, vs * 0.72), 1.5);
    } else put(t('story.what.text'), font(L.font.now, 500), '#e8fbff', L.font.now, 1.4);
    y += 8 * u;
    put(t(this.opts.touch ? 'story.tap' : 'story.click'), font(L.font.label, 600), 'rgba(255,217,138,.85)', L.font.label);
    ctx.restore();
    return box ? y - box.y - 16 * u : y;
  }

  private drawStory(ctx: CanvasRenderingContext2D, sim: EzechielSim): void {
    const box = this.storyBox(sim);
    if (!box) return;
    const L = this.L, u = L.u;
    ctx.save();
    ctx.fillStyle = 'rgba(4,20,28,.4)';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.fillStyle = 'rgba(8,40,52,.95)';
    rr(ctx, box.x, box.y, box.w, box.h, 16 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,138,.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    this.storyLayout(ctx, sim, box);
    const s = sim.story!;
    for (let i = 0; i < s.pages; i++) {
      ctx.fillStyle = i === s.page ? GOLD : 'rgba(200,236,240,.35)';
      ctx.beginPath();
      ctx.arc(box.x + box.w - 16 * u - (s.pages - 1 - i) * 10 * u, box.y + box.h - 12 * u, 2.6 * u, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Where the i-th leaf grows: the trees come in pairs from the nearest (treeSpecs' order: a pair per row, left then
 * right), and a pair fills, side by side, before the next pair back gets leaves — so a session's leaves gather on the
 * trees in sight instead of one on each.  `caps`: each tree's leaf slots.
 */
export function leafSlot(caps: readonly number[], i: number): { tree: number; slot: number } | null {
  let base = 0;
  for (let k = 0; k < caps.length; k += 2) {
    const pair = caps.slice(k, k + 2);
    const room = pair.reduce((s, c) => s + c, 0);
    if (i < base + room) {
      let j = i - base;
      // alternate sides while both have room
      const both = 2 * Math.min(...pair);
      if (pair.length === 2 && j < both) return { tree: k + (j % 2), slot: Math.floor(j / 2) };
      if (pair.length === 2) {
        j -= both;
        const big = pair[0] >= pair[1] ? 0 : 1;
        return { tree: k + big, slot: Math.min(...pair) + j };
      }
      return { tree: k, slot: j };
    }
    base += room;
  }
  return null;
}

/** How many of the first `count` leaves grow on tree `k`. */
export function leavesOn(caps: readonly number[], k: number, count: number): number {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const at = leafSlot(caps, i);
    if (!at) break;
    if (at.tree === k) n++;
  }
  return n;
}

// ── the scene (shared with the lobby's picture and the intro) ──────

export interface SceneArgs {
  time: number;
  water: number;
  lift: number;
  dust: { above: number; below: number; front: number };
  washK: number;
  goldK: number;
  mist: number;
  fig: Layer | null;
  dust_: Layer | null;
  trees: { geo: TreeGeo; layer: Layer | null }[];
  sil: Path2D | null;
  farK: number;
  markReached: number;
  lineK: number;
  leavesGreen: number;
  reduced: boolean;
  finale: boolean;
  /** the figure's opacity (the intro fades it in) */
  figAlpha?: number;
  /** drawn behind the figure (a leaf on the back), and on it before the near water covers what is under it */
  behind?: () => void;
  onFigure?: () => void;
}

/** The river behind the figure, the trees, the figure with its dust and washing, the near water, the mist. */
export function drawScene(ctx: CanvasRenderingContext2D, L: Layout, a: SceneArgs): void {
  const H = L.fig.H, cx = L.fig.cx, tm = a.time;
  const yw = figPt(L, 0, waterY(a.water)).y;
  const R = river(L, a.water, yw);
  // the banks green as the water comes (and the trees with it)
  const green = clamp(a.water / 4 * 0.8 + a.leavesGreen * 0.4);
  ctx.save();
  ctx.lineJoin = 'round';
  if (green > 0.02) {
    ctx.strokeStyle = `rgba(110,170,80,${0.3 * green})`;
    ctx.lineWidth = 0.035 * H;
    for (const poly of R.floodK > 0.05 ? [R.flood] : R.downK > 0.3 ? [R.up, R.down] : [R.up]) {
      polyPath(ctx, poly);
      ctx.stroke();
    }
  }
  // the two arms: the far water reflects the dawn sky, nearer it turns turquoise
  const arm = ctx.createLinearGradient(0, L.horizon, 0, yw + 1);
  arm.addColorStop(0, '#d8f2ea');
  arm.addColorStop(0.5, '#9adbd8');
  arm.addColorStop(1, '#5cc2cc');
  ctx.fillStyle = arm;
  // the streams give way to the flood as the river grows wide; the arm to the sea comes as the water rises
  const streamA = 1 - 0.85 * R.floodK;
  for (const [poly, al] of [[R.up, streamA], [R.down, streamA * R.downK]] as const) {
    if (al <= 0.01) continue;
    ctx.globalAlpha = al;
    polyPath(ctx, poly);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (R.floodK > 0.01) {
    ctx.globalAlpha = R.floodK;
    polyPath(ctx, R.flood);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // glints riding the arms
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const k = ((i / 10 + tm * 0.03) % 1);
    const side = i % 2 || R.downK < 0.3 ? R.up : R.down;
    const p = side[Math.floor(k * (side.length / 2 - 1))];
    const q = side[side.length - 1 - Math.floor(k * (side.length / 2 - 1))];
    if (!p || !q) continue;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, ww = Math.abs(q[0] - p[0]) * 0.3;
    ctx.globalAlpha = 0.25 + 0.35 * Math.sin(tm * 2 + i);
    ctx.beginPath();
    ctx.moveTo(mx - ww / 2, my);
    ctx.lineTo(mx + ww / 2, my);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // the riverbed in front: wet sand and pebbles in turquoise light, under the figure's feet
  ctx.save();
  polyPath(ctx, R.near);
  const bed = ctx.createLinearGradient(0, yw, 0, L.h);
  bed.addColorStop(0, '#cfe6d6');
  bed.addColorStop(0.35, '#a9d3c8');
  bed.addColorStop(1, '#6fb0b0');
  ctx.fillStyle = bed;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 40; i++) {
    const x = cx + (hash(i * 2.3) * 2 - 1) * (R.half * 1.1 + 0.06 * H), y = yw + 0.01 * H + hash(i * 5.7) * (L.h - yw);
    const r = (0.004 + 0.01 * hash(i * 1.9)) * H + 0.6;
    ctx.fillStyle = hash(i * 3.3) > 0.5 ? 'rgba(120,150,140,.35)' : 'rgba(240,250,240,.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  a.behind?.();
  // the figure: lifted while it floats, its dust above and below the washing's front, the current over it
  const box = figureBox(L);
  const dy = -a.lift * H;
  ctx.save();
  ctx.globalAlpha = a.figAlpha ?? 1;
  if (a.fig) ctx.drawImage(a.fig, box.x, box.y + dy, box.w, box.h);
  if (a.dust_ && (a.dust.above > 0.01 || a.dust.below > 0.01)) {
    const fy = L.fig.top + a.dust.front * H + dy;
    const fe = a.dust.front > 0 ? 0.05 * H : 0;
    const strips: [number, number, number][] = [[box.y + dy, fy - fe, a.dust.above]];
    for (let i = 0; i < 6; i++) {
      const k0 = i / 6, k1 = (i + 1) / 6;
      strips.push([fy - fe + 2 * fe * k0, fy - fe + 2 * fe * k1, a.dust.above + (a.dust.below - a.dust.above) * (k0 + k1) / 2]);
    }
    strips.push([fy + fe, box.y + box.h + dy, a.dust.below]);
    for (const [y0, y1, al] of strips) {
      if (al <= 0.01 || y1 <= y0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, y0, box.w, y1 - y0);
      ctx.clip();
      ctx.globalAlpha = (a.figAlpha ?? 1) * al;
      ctx.drawImage(a.dust_, box.x, box.y + dy, box.w, box.h);
      ctx.restore();
    }
  }
  ctx.restore();
  if (a.washK > 0.01 && a.sil) drawWashing(ctx, L, a, dy);
  a.onFigure?.();

  // the near water over the legs: translucent bands, deeper below; caustics on the legs; the living surface
  ctx.save();
  polyPath(ctx, R.near);
  const nw = ctx.createLinearGradient(0, yw, 0, L.h);
  nw.addColorStop(0, 'rgba(150,232,236,.38)');
  nw.addColorStop(0.2, 'rgba(60,190,206,.34)');
  nw.addColorStop(1, 'rgba(24,128,156,.46)');
  ctx.fillStyle = nw;
  ctx.fill();
  ctx.strokeStyle = 'rgba(236,250,244,.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip();
  // the bed's caustics and the old measuring lines under the water
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(1, 0.004 * H);
  const span = R.half * 1.1 + 0.06 * H;
  for (let i = 0; i < 26; i++) {
    const fx = hash(i * 3.7), fy = hash(i * 9.1);
    const x0 = cx + (fx * 2 - 1) * span * (0.6 + 0.4 * fy), y0 = yw + 0.02 * H + fy * (L.h - yw);
    const len = (0.05 + 0.08 * hash(i * 1.3)) * H;
    const a = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(tm * 1.1 + i * 2.3));
    ctx.strokeStyle = `rgba(200,252,255,${a})`;
    ctx.beginPath();
    for (let j = 0; j <= 6; j++) {
      const x = x0 + (j / 6 - 0.5) * len, y = y0 + Math.sin(j * 1.3 + tm * 1.4 + i) * 0.008 * H;
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let m = 1; m <= Math.min(a.markReached, 4); m++) {
    const my = figPt(L, 0, MARK_Y[m]).y;
    if (my <= yw + 2) continue;
    ctx.strokeStyle = 'rgba(255,224,150,.3)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - R.half, my);
    ctx.lineTo(cx + R.half, my);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  // caustics on the figure under the water
  if (a.sil) {
    ctx.save();
    ctx.clip(a.sil);
    ctx.beginPath();
    ctx.rect(box.x, yw, box.w, L.h - yw);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, H * 0.004);
    for (let i = 0; i < 7; i++) {
      const y = yw + 4 + i * 0.045 * H;
      ctx.strokeStyle = `rgba(214,255,255,${0.42 - i * 0.04})`;
      ctx.beginPath();
      for (let x = box.x; x <= box.x + box.w; x += 4) {
        const yy = y + Math.sin(x * 0.09 + tm * 2.1 + i) * 0.008 * H + Math.sin(x * 0.21 - tm * 1.4 + i * 2) * 0.004 * H;
        if (x === box.x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // the surface: a living line, gold while the water rises; rings round the body
  const gold = a.goldK;
  ctx.save();
  ctx.lineWidth = 1.6 + 1.4 * gold;
  ctx.strokeStyle = gold > 0.05 ? `rgba(255,${Math.round(236 - 30 * gold)},${Math.round(200 - 90 * gold)},${0.75 + 0.25 * gold})` : 'rgba(236,252,255,.8)';
  ctx.beginPath();
  for (let x = cx - R.half; x <= cx + R.half; x += 6) {
    const yy = yw + Math.sin(x * 0.06 + tm * 1.8) * 0.0035 * H + Math.sin(x * 0.017 - tm * 0.7) * 0.002 * H;
    if (x === cx - R.half) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  if (gold > 0.05) {
    for (let i = 0; i < 6; i++) {
      const x = cx - R.half + ((i * 0.17 + tm * 0.11) % 1) * 2 * R.half;
      glow(ctx, GOLD_HI, x, yw, 0.02 * H + 3, 0.6 * gold * (0.5 + 0.5 * Math.sin(tm * 4 + i)));
    }
  }
  // the ripple rings where the water meets the body (both legs at the ankles and knees, the body higher)
  const wy = waterY(a.water);
  const twoLegs = wy > 0.56;
  const centres = twoLegs ? [-0.045, 0.045] : [0];
  for (const c0 of centres) {
    const rx0 = (twoLegs ? 0.032 : wy > 0.4 ? 0.1 : 0.115) * H;
    for (let k = 0; k < 2; k++) {
      const ph = a.reduced ? 0.4 + 0.3 * k : ((tm * 0.45 + k * 0.5) % 1);
      ctx.strokeStyle = `rgba(240,255,255,${0.55 * (1 - ph)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx + c0 * H, yw + 0.002 * H, rx0 * (1 + 0.9 * ph), rx0 * (0.16 + 0.12 * ph), 0, 0, TAU);
      ctx.stroke();
    }
  }
  // the measuring line of light laid across the water at a mark ("a thousand cubits")
  if (a.lineK < 1 && a.markReached > 0) {
    const my = figPt(L, 0, MARK_Y[Math.min(4, a.markReached)]).y;
    const x0 = cx - R.half - 0.05 * H, x1 = x0 + (2 * R.half + 0.1 * H) * (1 - (1 - a.lineK) ** 3);
    const fade = clamp((1 - a.lineK) * 3);
    ctx.strokeStyle = `rgba(255,226,150,${0.95 * fade + 0.05})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x0, my);
    ctx.lineTo(x1, my);
    ctx.stroke();
    for (let x = x0; x <= x1; x += 0.05 * H) {
      ctx.beginPath();
      ctx.moveTo(x, my - 4);
      ctx.lineTo(x, my + 4);
      ctx.stroke();
    }
    glow(ctx, GOLD_HI, x1, my, 0.04 * H + 4, 0.8 * fade);
  }
  ctx.restore();

  // the trees on both banks, standing at the river's edge (never under it)
  for (const tr of a.trees) if (tr.layer) ctx.drawImage(tr.layer, tr.geo.box.x, tr.geo.box.y, tr.geo.box.w, tr.geo.box.h);

  // the mist of a blind push: the river veiled, the water going on beneath it
  if (a.mist > 0.01) {
    ctx.save();
    const top = L.horizon - 0.15 * H;
    const mg = ctx.createLinearGradient(0, top, 0, L.h);
    mg.addColorStop(0, 'rgba(232,238,240,0)');
    mg.addColorStop(0.18, `rgba(226,234,238,${0.62 * a.mist})`);
    mg.addColorStop(1, `rgba(210,224,230,${0.74 * a.mist})`);
    ctx.fillStyle = mg;
    ctx.fillRect(0, top, L.w, L.h - top);
    // drifting banks of mist (soft ellipses, painted, not light)
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.27 + tm * 0.01) % 1.4 - 0.2) * L.w, y = L.horizon + (0.12 + 0.18 * i) * H;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, 0.45 * H);
      rg.addColorStop(0, `rgba(240,244,246,${0.3 * a.mist})`);
      rg.addColorStop(1, 'rgba(240,244,246,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x - 0.45 * H, y - 0.45 * H, 0.9 * H, 0.9 * H);
    }
    ctx.restore();
  }

  // where the river goes, at the end: birds over the valley, fish leaping in the far sea and the near water
  if (a.finale && a.farK > 0.3) {
    ctx.save();
    const k = clamp((a.farK - 0.3) / 0.7);
    ctx.strokeStyle = `rgba(70,60,60,${0.7 * k})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const p = a.reduced ? 0.3 + i * 0.12 : ((tm * 0.04 + i * 0.19) % 1);
      const x = L.w * (1.05 - 1.1 * p), y = L.horizon - (0.12 + 0.05 * Math.sin(i * 2.3)) * H - 0.04 * H * i;
      const s = 0.012 * H + 3, f = a.reduced ? 0.5 : Math.sin(tm * 6 + i) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.4 * f);
      ctx.quadraticCurveTo(x - s * 0.4, y, x, y + s * 0.15);
      ctx.quadraticCurveTo(x + s * 0.4, y, x + s, y - s * 0.4 * f);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const p = a.reduced ? 0.5 : ((tm * 0.5 + i * 0.37) % 1.6);
      if (p > 1) continue;
      const fx = cx + (hash(i * 7 + Math.floor(tm * 0.5 + i * 0.37)) - 0.5) * 2 * R.half, fy = yw + 0.04 * H + 0.08 * H * hash(i * 3);
      const s = 0.025 * H;
      ctx.strokeStyle = `rgba(230,240,245,${0.85 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, s, Math.PI * (1.1 + 0.8 * p), Math.PI * (1.25 + 0.8 * p));
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** The washing: a gentle current of clear water down the figure from the crown to the front, droplets at its sides. */
function drawWashing(ctx: CanvasRenderingContext2D, L: Layout, a: SceneArgs, dy: number): void {
  const H = L.fig.H, cx = L.fig.cx, k = a.washK, tm = a.time;
  const box = figureBox(L);
  const front = a.dust.front > 0 && a.dust.front < 1 ? a.dust.front : 1;
  const fy = L.fig.top + front * H + dy;
  ctx.save();
  ctx.clip(a.sil!);
  ctx.globalCompositeOperation = 'lighter';
  const sheet = ctx.createLinearGradient(0, L.fig.top + dy, 0, fy);
  sheet.addColorStop(0, `rgba(170,240,250,${0.08 * k})`);
  sheet.addColorStop(1, `rgba(200,250,255,${0.3 * k})`);
  ctx.fillStyle = sheet;
  ctx.fillRect(box.x, L.fig.top + dy - 4, box.w, fy - L.fig.top - dy + 4);
  // streaks running down
  ctx.lineWidth = Math.max(1, 0.006 * H);
  for (let i = 0; i < 9; i++) {
    const x = cx + (i / 8 - 0.5) * 0.34 * H;
    const p = a.reduced ? 0.5 : ((tm * 0.6 + hash(i) ) % 1);
    const y0 = L.fig.top + dy + p * (fy - L.fig.top - dy) - 0.08 * H, y1 = y0 + 0.08 * H;
    const sg = ctx.createLinearGradient(0, y0, 0, y1);
    sg.addColorStop(0, 'rgba(220,255,255,0)');
    sg.addColorStop(1, `rgba(230,255,255,${0.5 * k})`);
    ctx.strokeStyle = sg;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + Math.sin(i + tm) * 2, y1);
    ctx.stroke();
  }
  // the bright front where the current is now
  if (front < 1) {
    const fg = ctx.createLinearGradient(0, fy - 0.03 * H, 0, fy + 0.01 * H);
    fg.addColorStop(0, 'rgba(230,255,255,0)');
    fg.addColorStop(0.8, `rgba(240,255,255,${0.55 * k})`);
    fg.addColorStop(1, 'rgba(240,255,255,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(box.x, fy - 0.03 * H, box.w, 0.04 * H);
  }
  ctx.restore();
  // droplets falling from the hands and the elbows into the river
  if (!a.reduced) {
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const p = (tm * 0.9 + i * 0.37) % 1;
      const x = cx + side * (0.16 + 0.02 * (i % 3)) * H, y = L.fig.top + dy + (0.55 + 0.4 * p) * H;
      glow(ctx, AQUA, x, y, 0.012 * H + 2, 0.6 * k * (1 - p));
    }
  }
}
