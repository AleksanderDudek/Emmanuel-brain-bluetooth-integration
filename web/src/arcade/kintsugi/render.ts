/**
 * Złote serce's picture (DESIGN.md §21), canvas 2D, every frame from the sim:
 *
 *   the scene    deep night blue warming to dawn as the way goes; a vignette; soft bokeh; the dark velvet cloth
 *   the heart    porcelain pieces (paint.ts: one lit texture of the whole heart, each piece clipped from it, so laid
 *                together they make one glazed volume), the broken edges' white body, soot and ink stains on the
 *                pieces still on the cloth; the pieces laid home cached in a layer, their cracks dark hairlines
 *   the care     cupped hands of light (hands.ts) rise under a piece and lift it out of the dark, turning slowly; light
 *                like clear water pours over it and the soot dissolves from its edges inward, pixel by pixel, into
 *                motes that rise and turn to light, the word of pain fading with it; the hands carry it home, where it
 *                settles with a soft flash
 *   the gold     molten gold along the seams (stroked with the heart's own volume in gold, its width varying like
 *                lacquer), a bright leading edge, glints running along the gilded lines
 *   the beat     lub-dub: a 3–5 % swell and a ring of light; the heart turns from porcelain to gold as far as the gold
 *                poured
 *   radiance     layered additive glows — a white-gold centre (purity), a warm rose (love) — slow rays, rising sparks
 *                (joy); the qualities' words with their passages
 *   the words    the narrator, a passage, the blessing in the band; the breath guide in rests; the 0–10 row
 *
 * Reduced motion: no drifting, no swell — pieces fade from one place to the other, the beat is a glow.
 */
import { breathOf, breathGuideBox, drawBreathGuide } from '../kit/breathguide';
import { clamp, ease } from '../kit/juice';
import { MIN_TAP, hits, target } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageId, type PassageLayout } from '../kit/scripture';
import type { Insets, TapTarget } from '../kit/types';
import { HEART, along, clothSpots, seamFill, type HeartGeo, type Spot } from './heart';
import { drawHands } from './hands';
import { t, type Key } from './i18n';
import { HOLD, layout, toScreen, type Layout, type Rect } from './layout';
import {
  FONT, GOLD, GOLD_HI, INK, ROSE, SERIF, TEX, bakeHeart, distanceField, glow, glowSprite, heartPath, makeCanvas, noise, polyPath, rgba,
  skyAt, type HeartTex,
} from './paint';
import type { KintsugiSim, SimEvent } from './sim';

const TAU = Math.PI * 2;

interface Part { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; kind: 'mote' | 'spark' | 'drop' | 'joy' }
interface Glint { seam: number; pos: number; speed: number; life: number; age: number }
interface Ring { t0: number; strong: boolean }
interface WashBuf {
  id: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  img: ImageData;
  thr: Float32Array;
  a: Float32Array;
  last: number;
}

export interface Pose { x: number; y: number; rot: number; sc: number; lift: number; flat: number }

/** Pieces lying on the cloth are drawn at this share of their size, a little flattened (they lie, the eye looks down). */
const LIE = 0.82, FLAT = 0.8;

export class KintsugiView {
  private readonly ctx: CanvasRenderingContext2D | null;
  private l: Layout;
  private dpr = 1;
  private tex: HeartTex | null = null;
  private heartP: Path2D | null = null;
  private piecePaths: Path2D[] = [];
  private layer: HTMLCanvasElement | null = null;
  private seamLayer: HTMLCanvasElement | null = null;
  private layerBox = { x: 0, y: 0, w: 1, h: 1 };
  private layerDirty = true;
  private seamDirty = true;
  private cloth: HTMLCanvasElement | null = null;
  private goldPat: CanvasPattern | null = null;
  private vp: number[] = [];
  private wash: WashBuf | null = null;
  private readonly parts: Part[] = [];
  private readonly glints: Glint[] = [];
  private readonly rings: Ring[] = [];
  private settle = new Map<number, number>();
  private front = 0;
  private time = 0;
  private lub = 0;
  private bloom = 0;
  private sprites: Record<'gold' | 'white' | 'rose' | 'warm' | 'cool', HTMLCanvasElement | null> = { gold: null, white: null, rose: null, warm: null, cool: null };
  private verseCache = new Map<string, PassageLayout>();
  private readonly bokeh: { x: number; y: number; r: number; s: number; p: number }[] = [];
  private qualityT = -10;
  private rateFlash = 0;
  private spots: Spot[] = [];
  /** the heart's middle now (it moves to the scene's middle from the gold on) and the scale */
  private c = { cx: 0, cy: 0, s: 1 };
  private goldAt: number | null = null;
  private fullShown = 0;
  /** the heart's scale the layers were baked at, and when */
  private bakedS = 1;
  private bakedAt = -1;

  constructor(canvas: HTMLCanvasElement, private readonly geo: HeartGeo, private readonly o: { reducedMotion: boolean; touch: boolean; seed: number; tracks: boolean }) {
    this.ctx = canvas.getContext('2d');
    this.l = layout(1, 1, { top: 0, right: 0, bottom: 0, left: 0 }, o.tracks);
    this.vp = geo.pieces.map(() => 0);
    for (let i = 0; i < 22; i++) {
      this.bokeh.push({ x: hashf(o.seed + i * 3), y: hashf(o.seed + i * 5 + 1), r: 0.02 + 0.06 * hashf(o.seed + i * 7 + 2), s: 0.004 + 0.01 * hashf(i + 9), p: hashf(i + 31) * TAU });
    }
    if (typeof Path2D !== 'undefined') {
      this.heartP = heartPath();
      this.piecePaths = geo.pieces.map(p => polyPath(p.outline));
    }
  }

  get layoutNow(): Layout { return this.l; }
  /** Where the music's player card goes (null: no track will play). */
  get musicRect(): Rect | null { return this.o.tracks ? this.lCard.music : null; }

  /**
   * The music's player card is on screen now.  On a short phone held upright the card's reserved place would leave the
   * heart tiny, so there (only) the scene uses the whole height while no track plays and eases — never jumps — into the
   * card's layout over a second and a half when one starts (the card's own place never moves).
   */
  setCard(show: boolean): void { this.cardOn = show; }

  private lFull: Layout = layout(1, 1, { top: 0, right: 0, bottom: 0, left: 0 }, false);
  private lCard: Layout = this.lFull;
  private compact = false;
  private cardOn = false;
  private cardK = 0;
  private clothK = -1;

  private mixLayout(k: number): Layout {
    const a = this.lFull, b = this.lCard;
    const n = (x: number, y: number) => x + (y - x) * k;
    const r = (x: Rect, y: Rect): Rect => ({ x: n(x.x, y.x), y: n(x.y, y.y), w: n(x.w, y.w), h: n(x.h, y.h) });
    return {
      ...a, cx: n(a.cx, b.cx), cy: n(a.cy, b.cy), cyC: n(a.cyC, b.cyC), s: n(a.s, b.s), sC: n(a.sC, b.sC),
      cloth: { x0: n(a.cloth.x0, b.cloth.x0), x1: n(a.cloth.x1, b.cloth.x1), y0: n(a.cloth.y0, b.cloth.y0), y1: n(a.cloth.y1, b.cloth.y1) },
      scene: r(a.scene, b.scene), band: r(a.band, b.band), cyX: n(a.cyX, b.cyX), sX: n(a.sX, b.sX),
      guide: k < 0.5 ? a.guide : b.guide,
      music: b.music,
    };
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = Math.max(1, Math.min(3, dpr || 1));
    this.lFull = layout(w, h, ins, false);
    this.lCard = layout(w, h, ins, this.o.tracks);
    // a short screen: the card's layout leaves the heart small or the words cramped — ease into it only while a track plays
    this.compact = this.o.tracks && this.lCard.kind !== 'wide' && (this.lCard.s < 0.7 * this.lFull.s || this.lCard.band.h < 90);
    this.l = this.compact ? this.mixLayout(this.cardK) : this.lCard;
    this.clothK = this.cardK;
    this.verseCache.clear();
    const ps = Math.min(400, Math.max(80, Math.ceil(Math.max(this.lFull.s, this.lFull.sC, this.l.sC) * Math.min(2, this.dpr))));
    if (!this.tex || Math.abs(this.tex.ps - ps) > 24) {
      this.tex = bakeHeart(ps, this.o.seed % 100000);
      this.goldPat = null;
      this.wash = null;
    }
    if (!this.sprites.gold) {
      this.sprites = { gold: glowSprite(GOLD), white: glowSprite('#fff8e8'), rose: glowSprite(ROSE), warm: glowSprite('#ffd9a0'), cool: glowSprite('#cfe6ff') };
    }
    this.spots = clothSpots(this.geo.pieces, this.lFull.cloth, this.o.seed);
    this.c = { cx: this.l.cx, cy: this.l.cy, s: this.l.s };
    this.bakedS = this.c.s;
    this.cloth = this.bakeCloth();
    this.layerDirty = true;
    this.seamDirty = true;
  }

  // ── events and time ────────────────────────────────────────────

  on(e: SimEvent, sim: KintsugiSim): void {
    switch (e.type) {
      case 'placed':
        this.layerDirty = true;
        this.settle.set(e.id, this.time);
        if (this.wash?.id === e.id) this.wash = null;
        this.burst(e.id, sim, 14, 'spark');
        break;
      case 'cleaned':
        this.burst(e.id, sim, 10, 'drop');
        break;
      case 'grace':
        // the grace washes by a fade: the pixel wash of a piece in the hands stops where it was
        this.wash = null;
        break;
      case 'seam':
        this.seamDirty = true;
        break;
      case 'beat':
        this.rings.push({ t0: this.time, strong: e.strong });
        if (e.strong) this.lub = 1;
        break;
      case 'quality':
        this.qualityT = this.time;
        this.bloom = 1;
        break;
      case 'stage':
        if (e.stage === 'radiance') this.bloom = 1;
        if (e.stage === 'gold') this.goldAt = this.time;
        break;
      case 'rated':
        this.rateFlash = 1;
        break;
      default: break;
    }
  }

  update(dt: number, sim: KintsugiSim): void {
    const step = Math.min(0.1, Math.max(0, dt));
    this.time += step;
    // a short phone upright: the layout eases into the card's while a track plays (setCard)
    if (this.compact) {
      const want = this.cardOn ? 1 : 0;
      const k = this.o.reducedMotion ? want : this.cardK + (want - this.cardK) * (1 - Math.exp(-step / 0.45));
      this.cardK = Math.abs(want - k) < 0.002 ? want : k;
      this.l = this.mixLayout(this.cardK);
      if (Math.abs(this.cardK - this.clothK) > 0.06 || (this.cardK === want && this.clothK !== want)) {
        this.clothK = this.cardK;
        this.cloth = this.bakeCloth();
        this.verseCache.clear();
      }
    }
    // the heart moves to the scene's middle as the cloth goes (from the gold on)
    const l = this.l;
    const shift = sim.stage === 'arrive' || sim.stage === 'gather' ? 0
      : sim.stage === 'gold' && this.goldAt !== null && !this.o.reducedMotion ? ease.inOutSine(clamp((this.time - this.goldAt) / 4)) : 1;
    this.c = { cx: l.cx, cy: l.cy + (l.cyC - l.cy) * shift, s: l.s + (l.sC - l.s) * shift };
    // the close: the heart makes room for the blessing and the 0–10 where they reach into the scene
    if (sim.stage === 'close') {
      const k = this.o.reducedMotion ? 1 : ease.inOutSine(clamp(sim.blockT / 2.5));
      this.c = { cx: l.cx, cy: l.cyC + (l.cyX - l.cyC) * k, s: l.sC + (l.sX - l.sC) * k };
    }
    // the layers follow the heart's size: baked again when it has grown a little (and once it has settled)
    const off = Math.abs(this.c.s - this.bakedS) / Math.max(1, this.bakedS);
    if ((off > 0.04 && this.time - this.bakedAt > 0.25) || (off > 0.001 && shift >= 1)) { this.layerDirty = true; this.seamDirty = true; }
    // the visual progress of each piece's motion follows the sim's, softly
    sim.pieces.forEach((pc, i) => {
      const target = pc.state === 'lift' || pc.state === 'lay' ? clamp(pc.p) : pc.state === 'cloth' ? 0 : 1;
      const tau = pc.grace ? 0.12 : 0.45;
      this.vp[i] = pc.state === 'lay' && this.vp[i] > target + 0.3 ? target : this.vp[i] + (target - this.vp[i]) * (1 - Math.exp(-step / tau));
    });
    this.front += (sim.front - this.front) * (1 - Math.exp(-step / 0.6));
    if (sim.front - this.front < 1e-4) this.front = sim.front;
    // a seam the shown gold has just filled goes into the gilded layer
    let full = 0;
    for (const sm of this.geo.seams) if (seamFill(sm, this.front) >= 0.999) full++;
    if (full !== this.fullShown) { this.fullShown = full; this.seamDirty = true; }
    this.lub = Math.max(0, this.lub - step * 3.2);
    this.bloom = Math.max(0, this.bloom - step * 0.4);
    this.rateFlash = Math.max(0, this.rateFlash - step * 1.5);
    for (let i = this.rings.length - 1; i >= 0; i--) if (this.time - this.rings[i].t0 > 2.2) this.rings.splice(i, 1);
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += step;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      if (!this.o.reducedMotion) {
        p.x += p.vx * step;
        p.y += p.vy * step;
        if (p.kind === 'mote') { p.vy -= 6 * step; p.vx += Math.sin(this.time * 2 + i) * 4 * step; }
        if (p.kind === 'drop') p.vy += 60 * step;
        if (p.kind === 'joy') p.vx += Math.sin(this.time * 1.5 + i * 0.7) * 8 * step;
      }
    }
    // the washing piece: its soot dissolving, motes from the front
    const held = sim.held !== null ? sim.pieces[sim.held] : null;
    const washing = sim.pieces.find(pc => pc.state === 'wash' && !pc.grace);
    if (washing) this.washFrame(washing.id, washing.washed, sim);
    else if (held && held.state === 'clean' && this.wash?.id === held.id) this.wash = null;
    // glints along the gilded lines
    if (sim.stage !== 'arrive' && sim.stage !== 'gather' && !this.o.reducedMotion) {
      const full = this.geo.seams.filter(s => seamFill(s, this.front) > 0.98);
      // now and then, never a constant sparkle: at most two at once, one every ~3 s on average, slow
      const want = full.length > 6 ? 2 : 1;
      if (full.length && this.glints.length < want && Math.random() < step * 0.35) {
        const s = full[Math.floor(Math.random() * full.length)];
        this.glints.push({ seam: s.id, pos: 0, speed: 0.12 + Math.random() * 0.1, life: s.len, age: 0 });
      }
    }
    for (let i = this.glints.length - 1; i >= 0; i--) {
      const g = this.glints[i];
      g.pos += g.speed * step;
      if (g.pos > g.life) this.glints.splice(i, 1);
    }
    // joy: sparks rising from the heart in the radiance
    if ((sim.stage === 'radiance' || sim.stage === 'close') && this.parts.length < 320) {
      const rate = (this.o.reducedMotion ? 3 : 12) * (0.6 + 0.4 * sim.goldFrac);
      let n = rate * step;
      while (n > 0) {
        if (Math.random() < n) {
          const a = Math.random() * TAU, r = Math.random() * 0.7;
          const [x, y] = toScreen(this.c, Math.cos(a) * r, Math.sin(a) * r * 0.8);
          this.parts.push({ x, y, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 30, age: 0, life: 2.5 + Math.random() * 2.5, size: 1 + Math.random() * 2.2, kind: 'joy' });
        }
        n -= 1;
      }
    }
  }

  /** A few sparks or drops from a piece where it is now. */
  private burst(id: number, sim: KintsugiSim, n: number, kind: Part['kind']): void {
    const pose = this.pose(id, sim);
    const pc = this.geo.pieces[id];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = pc.r * pose.sc * (0.3 + 0.7 * Math.random());
      this.parts.push({
        x: pose.x + Math.cos(a) * r, y: pose.y + Math.sin(a) * r * 0.7,
        vx: Math.cos(a) * (kind === 'drop' ? 18 : 26), vy: kind === 'drop' ? 10 + Math.random() * 20 : -14 - Math.random() * 20,
        age: 0, life: kind === 'drop' ? 0.9 : 1.2 + Math.random() * 0.6, size: kind === 'drop' ? 1.6 : 1.4 + Math.random() * 1.6, kind,
      });
    }
  }

  // ── where a piece is ───────────────────────────────────────────

  /** How large a piece is held up in the light (× its size at home). */
  private holdScale(id: number): number {
    return clamp(0.5 / this.geo.pieces[id].r, 0.85, 2.2);
  }

  /** A piece's place on the screen now: its middle, turn, scale (px per heart unit) and how far it is lifted (0..1). */
  pose(id: number, sim: KintsugiSim): Pose {
    const pc = this.geo.pieces[id], run = sim.pieces[id], l = this.c, s = l.s;
    const sp = this.spots[id] ?? { x: pc.cx, y: pc.cy, rot: 0 };
    const v = ease.inOutSine(clamp(this.vp[id]));
    const H = this.holdScale(id);
    const sway = this.o.reducedMotion ? 0 : 0.16 * Math.sin(this.time * 0.45 + id) + 0.05 * Math.sin(this.time * 1.1 + id * 2);
    const float = this.o.reducedMotion ? 0 : 0.018 * Math.sin(this.time * 0.9 + id);
    const [hx, hy] = toScreen(l, HOLD.x, HOLD.y + float);
    // gathered by grace: straight from the cloth home in one gentle arc, washed on the way
    if (run.grace && run.state !== 'home' && run.state !== 'cloth') {
      const u = ease.inOutSine(clamp((sim.t - run.graceFrom) / Math.max(0.1, run.graceTo - run.graceFrom)));
      const [x1, y1] = toScreen(l, pc.cx, pc.cy);
      if (run.graceHeld) {
        const H = this.holdScale(id);
        return { x: hx + (x1 - hx) * u, y: hy + (y1 - hy) * u, rot: 0, sc: s * (H + (1 - H) * u), lift: 1 - u, flat: 1 };
      }
      const [x0, y0] = toScreen(l, sp.x, sp.y);
      const arc = Math.sin(Math.PI * u) * 0.3 * s;
      return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u - arc, rot: sp.rot * (1 - u), sc: s * (LIE + (1 - LIE) * u + 0.12 * Math.sin(Math.PI * u)), lift: Math.sin(Math.PI * u), flat: FLAT + (1 - FLAT) * u };
    }
    switch (run.state) {
      case 'cloth': {
        const [x, y] = toScreen(l, sp.x, sp.y);
        return { x, y, rot: sp.rot, sc: s * LIE, lift: 0, flat: FLAT };
      }
      case 'lift': {
        const [x0, y0] = toScreen(l, sp.x, sp.y);
        const arc = Math.sin(Math.PI * v) * 0.1 * s;
        return {
          x: x0 + (hx - x0) * v, y: y0 + (hy - y0) * v - arc, rot: sp.rot + (sway - sp.rot) * v, sc: s * (LIE + (H - LIE) * v), lift: v,
          flat: FLAT + (1 - FLAT) * v,
        };
      }
      case 'held': case 'wash': case 'clean':
        return { x: hx, y: hy, rot: sway, sc: s * H, lift: 1, flat: 1 };
      case 'lay': {
        const [x1, y1] = toScreen(l, pc.cx, pc.cy);
        const arc = Math.sin(Math.PI * v) * 0.08 * s;
        return { x: hx + (x1 - hx) * v, y: hy + (y1 - hy) * v - arc, rot: sway * (1 - v), sc: s * (H + (1 - H) * v), lift: 1 - v, flat: 1 };
      }
      default: {
        const [x, y] = toScreen(l, pc.cx, pc.cy);
        return { x, y, rot: 0, sc: s, lift: 0, flat: 1 };
      }
    }
  }

  // ── the wash, pixel by pixel ───────────────────────────────────

  private washFrame(id: number, w: number, sim: KintsugiSim): void {
    const tex = this.tex;
    if (!tex) return;
    if (!this.wash || this.wash.id !== id) this.wash = this.makeWash(id);
    const b = this.wash;
    if (!b) return;
    const k = clamp(w) * 1.14 - 0.07;
    if (Math.abs(k - b.last) < 0.004) return;
    b.last = k;
    const d = b.img.data;
    for (let i = 0; i < b.a.length; i++) {
      const a = b.a[i];
      if (a <= 0) { d[i * 4 + 3] = 0; continue; }
      const q = clamp((b.thr[i] - k) / 0.07 + 0.5);
      d[i * 4 + 3] = Math.round(a * q * 255);
    }
    b.g.putImageData(b.img, 0, 0);
    // motes from the dissolving front
    const pose = this.pose(id, sim), pc = this.geo.pieces[id];
    const cos = Math.cos(pose.rot), sin = Math.sin(pose.rot);
    void pose.flat;
    const tries = this.o.reducedMotion ? 2 : 9;
    for (let n = 0; n < tries; n++) {
      const i = Math.floor(Math.random() * b.a.length);
      if (b.a[i] < 0.3 || Math.abs(b.thr[i] - k) > 0.05) continue;
      const px = i % b.bw, py = Math.floor(i / b.bw);
      const ux = TEX.x0 + (b.bx + px) / tex.ps - pc.cx, uy = TEX.y0 + (b.by + py) / tex.ps - pc.cy;
      const x = pose.x + (ux * cos - uy * sin) * pose.sc, y = pose.y + (ux * sin + uy * cos) * pose.sc;
      this.parts.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 14, age: 0, life: 1.8 + Math.random() * 1.6, size: 1 + Math.random() * 1.8, kind: 'mote' });
    }
  }

  private makeWash(id: number): WashBuf | null {
    const tex = this.tex, pp = this.piecePaths[id], hp = this.heartP;
    if (!tex || !pp || !hp) return null;
    const pc = this.geo.pieces[id];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pc.outline) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    x0 = Math.max(x0, TEX.x0); y0 = Math.max(y0, TEX.y0); x1 = Math.min(x1, TEX.x0 + TEX.w); y1 = Math.min(y1, TEX.y0 + TEX.h);
    const bx = Math.max(0, Math.floor((x0 - TEX.x0) * tex.ps)), by = Math.max(0, Math.floor((y0 - TEX.y0) * tex.ps));
    const bw = Math.max(1, Math.min(tex.w - bx, Math.ceil((x1 - x0) * tex.ps) + 2)), bh = Math.max(1, Math.min(tex.h - by, Math.ceil((y1 - y0) * tex.ps) + 2));
    const canvas = makeCanvas(bw, bh), g = canvas?.getContext('2d');
    if (!canvas || !g) return null;
    // the piece's mask in its box
    g.setTransform(tex.ps, 0, 0, tex.ps, -(TEX.x0 * tex.ps + bx), -(TEX.y0 * tex.ps + by));
    g.save();
    g.clip(hp);
    g.fillStyle = '#fff';
    g.fill(pp);
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const md = g.getImageData(0, 0, bw, bh).data;
    const mask = new Uint8Array(bw * bh);
    for (let i = 0; i < bw * bh; i++) mask[i] = md[i * 4 + 3] > 100 ? 1 : 0;
    const dist = distanceField(mask, bw, bh);
    let max = 1;
    for (let i = 0; i < dist.length; i++) max = Math.max(max, dist[i]);
    const thr = new Float32Array(bw * bh), a = new Float32Array(bw * bh);
    const img = g.createImageData(bw, bh);
    const sc = tex.ps * 0.07;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (!mask[i]) continue;
      const ti = (by + y) * tex.w + (bx + x);
      const n = noise((bx + x) / sc, (by + y) / sc, tex.seed + 41) * 0.65 + noise((bx + x) / (sc * 0.4), (by + y) / (sc * 0.4), tex.seed + 43) * 0.35;
      thr[i] = clamp(0.58 * Math.sqrt(dist[i] / max) + 0.42 * n);
      a[i] = tex.sootA[ti];
      img.data[i * 4] = tex.sootRGB[ti * 4];
      img.data[i * 4 + 1] = tex.sootRGB[ti * 4 + 1];
      img.data[i * 4 + 2] = tex.sootRGB[ti * 4 + 2];
      img.data[i * 4 + 3] = Math.round(a[i] * 255);
    }
    g.putImageData(img, 0, 0);
    return { id, bx, by, bw, bh, canvas, g, img, thr, a, last: -1 };
  }

  // ── the baked layers ───────────────────────────────────────────

  /** The dark velvet cloth under the heart where the pieces lie: a soft oval in perspective, a faint sheen on its far edge. */
  private bakeCloth(): HTMLCanvasElement | null {
    const l = this.l, cl = l.cloth;
    const w = Math.ceil(l.w), h = Math.ceil(l.h);
    const c = makeCanvas(w * this.dpr, h * this.dpr), g = c?.getContext('2d');
    if (!c || !g) return null;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const [cx, cy] = toScreen(l, (cl.x0 + cl.x1) / 2, (cl.y0 + cl.y1) / 2 + 0.02);
    const rx = ((cl.x1 - cl.x0) / 2 + 0.32) * l.s, ry = ((cl.y1 - cl.y0) / 2 + 0.16) * l.s;
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(22,16,30,0.96)');
    gr.addColorStop(0.62, 'rgba(15,11,22,0.9)');
    gr.addColorStop(0.86, 'rgba(10,8,16,0.5)');
    gr.addColorStop(1, 'rgba(10,8,16,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.fill();
    // the velvet's sheen on its far edge, where the heart's light falls
    g.globalCompositeOperation = 'lighter';
    const sh = g.createRadialGradient(0, -rx * 0.55, rx * 0.1, 0, -rx * 0.55, rx * 0.85);
    sh.addColorStop(0, 'rgba(120,96,150,0.12)');
    sh.addColorStop(1, 'rgba(120,96,150,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(0, 0, rx * 0.92, 0, TAU);
    g.fill();
    g.restore();
    return c;
  }

  /** The layer box, from the heart's middle (CSS px): the heart's box and a margin round it. */
  private box(): { x: number; y: number; w: number; h: number } {
    const s = this.bakedS;
    const x0 = Math.floor(-1.06 * s), y0 = Math.floor((HEART.top - 0.06) * s);
    return { x: x0, y: y0, w: Math.ceil(1.06 * s) - x0 + 2, h: Math.ceil((HEART.bottom + 0.06) * s) - y0 + 2 };
  }

  private heartUnits(g: CanvasRenderingContext2D, box: { x: number; y: number }): void {
    const d = this.dpr, s = this.bakedS;
    g.setTransform(d * s, 0, 0, d * s, -box.x * d, -box.y * d);
  }

  private bakeLayer(sim: KintsugiSim): void {
    const tex = this.tex, hp = this.heartP;
    this.layerDirty = false;
    if (!tex || !hp) return;
    this.bakedS = this.c.s;
    this.bakedAt = this.time;
    const box = this.box();
    this.layerBox = box;
    const c = this.layer && this.layer.width === Math.ceil(box.w * this.dpr) && this.layer.height === Math.ceil(box.h * this.dpr)
      ? this.layer : makeCanvas(box.w * this.dpr, box.h * this.dpr);
    const g = c?.getContext('2d');
    if (!c || !g) return;
    this.layer = c;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    this.heartUnits(g, box);
    const home = sim.pieces.map(pc => pc.state === 'home');
    for (const pc of this.geo.pieces) {
      if (!home[pc.id]) continue;
      g.save();
      g.clip(hp);
      g.clip(this.piecePaths[pc.id]);
      g.drawImage(tex.porcelain, TEX.x0, TEX.y0, TEX.w, TEX.h);
      // the edge of a piece whose neighbour is not home yet: the white body of the break
      g.strokeStyle = 'rgba(255,252,246,0.9)';
      g.lineWidth = 2.2 / this.bakedS;
      g.stroke(this.piecePaths[pc.id]);
      g.restore();
    }
    // the cracks between two pieces home: a dark hairline with a light lip
    g.save();
    g.clip(hp);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const sm of this.geo.seams) {
      if (!home[sm.a] || !home[sm.b]) continue;
      const p = linePath(sm.pts);
      const S = this.bakedS;
      g.strokeStyle = 'rgba(46,32,28,0.85)';
      g.lineWidth = Math.max(1.1, 0.011 * S) / S;
      g.stroke(p);
      g.save();
      g.translate(-0.8 / S, -0.8 / S);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 0.7 / S;
      g.stroke(p);
      g.restore();
    }
    g.restore();
  }

  private pattern(g: CanvasRenderingContext2D): CanvasPattern | string {
    const tex = this.tex;
    if (!tex) return GOLD;
    if (!this.goldPat) {
      const p = g.createPattern(tex.gold, 'no-repeat');
      if (p && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix([1 / tex.ps, 0, 0, 1 / tex.ps, TEX.x0, TEX.y0]));
      this.goldPat = p;
    }
    return this.goldPat ?? GOLD;
  }

  /** One seam's gold from its start to `upto` (heart units along it), in heart units. */
  private goldStroke(g: CanvasRenderingContext2D, id: number, upto: number, s = this.c.s): void {
    const sm = this.geo.seams[id];
    if (upto <= 0.002) return;
    const base = Math.max(2.8, 0.03 * s) / s;
    const chunk = 0.05;
    const n = Math.max(1, Math.ceil(upto / chunk));
    const pat = this.pattern(g);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const pass of [-1, 0, 1, 2]) {
      for (let k = 0; k < n; k++) {
        const a = k * chunk, b = Math.min(upto, (k + 1) * chunk);
        const w = base * (0.72 + 0.6 * noise(id * 3.1 + k * 0.55, 0.5, 7));
        const p = new Path2D();
        const steps = 4;
        for (let j = 0; j <= steps; j++) {
          const q = along(sm.pts, sm.cum, a + ((b - a) * j) / steps);
          if (j) p.lineTo(q.x, q.y); else p.moveTo(q.x, q.y);
        }
        if (pass === -1) {
          // the crack's depth: a hairline of shadow beside the gold, away from the light
          g.save();
          g.translate(1.1 / s, 1.4 / s);
          g.strokeStyle = 'rgba(38,24,12,0.42)';
          g.lineWidth = w + 1.2 / s;
          g.stroke(p);
          g.restore();
          continue;
        }
        if (pass === 0) {
          g.strokeStyle = 'rgba(70,44,10,0.9)';
          g.lineWidth = w + 1.6 / s;
        } else if (pass === 1) {
          g.strokeStyle = pat;
          g.lineWidth = w;
        } else {
          g.strokeStyle = 'rgba(255,248,222,0.75)';
          g.lineWidth = w * 0.3;
          g.save();
          g.translate(-w * 0.18, -w * 0.22);
          g.stroke(p);
          g.restore();
          continue;
        }
        g.stroke(p);
      }
    }
  }

  private bakeSeams(): void {
    const hp = this.heartP;
    this.seamDirty = false;
    if (!hp) return;
    const box = this.box();
    const c = this.seamLayer && this.seamLayer.width === Math.ceil(box.w * this.dpr) && this.seamLayer.height === Math.ceil(box.h * this.dpr)
      ? this.seamLayer : makeCanvas(box.w * this.dpr, box.h * this.dpr);
    const g = c?.getContext('2d');
    if (!c || !g) return;
    this.seamLayer = c;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    this.heartUnits(g, box);
    g.save();
    g.clip(hp);
    for (const sm of this.geo.seams) if (seamFill(sm, this.front) >= 0.999) this.goldStroke(g, sm.id, sm.len, this.bakedS);
    g.restore();
  }

  // ── drawing ────────────────────────────────────────────────────

  draw(sim: KintsugiSim, intro = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = this.l, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawSky(ctx, sim);
    if (this.layerDirty) this.bakeLayer(sim);
    if (this.seamDirty) this.bakeSeams();
    const gather = sim.stage === 'arrive' || sim.stage === 'gather';
    // the cloth fades as the gold comes
    const clothA = gather ? 1 : sim.stage === 'gold' ? clamp(1 - sim.blockT / 6) * 0.8 : 0;
    if (this.cloth && clothA > 0.01) {
      ctx.globalAlpha = clothA;
      ctx.drawImage(this.cloth, 0, 0, l.w, l.h);
      ctx.globalAlpha = 1;
    }
    // the ghost of the whole heart, fading as it fills
    const homeN = sim.pieces.filter(p => p.state === 'home').length;
    if (gather && this.heartP) {
      const k = 1 - homeN / Math.max(1, sim.pieces.length);
      ctx.save();
      ctx.translate(this.c.cx, this.c.cy);
      ctx.scale(l.s, l.s);
      ctx.setLineDash([0.02, 0.03]);
      ctx.strokeStyle = `rgba(255,226,190,${0.1 + 0.12 * k})`;
      ctx.lineWidth = 1.2 / l.s;
      ctx.stroke(this.heartP);
      ctx.setLineDash([]);
      ctx.restore();
    }
    this.drawHeart(ctx, sim);
    if (gather || sim.block.what === 'grace') this.drawCloth(ctx, sim);
    this.drawActive(ctx, sim);
    this.drawParts(ctx);
    if (!intro) this.drawWords(ctx, sim);
  }

  private drawSky(ctx: CanvasRenderingContext2D, sim: KintsugiSim): void {
    const l = this.l;
    const k = this.dawn(sim);
    const [a, b, c] = skyAt(k);
    const g = ctx.createLinearGradient(0, 0, 0, l.h);
    g.addColorStop(0, a);
    g.addColorStop(0.55, b);
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, l.w, l.h);
    // the dawn's warmth behind the heart
    if (k > 0.05) {
      const [x, y] = toScreen(this.c, 0, 0.1);
      const r = Math.max(l.w, l.h) * 0.75;
      const wg = ctx.createRadialGradient(x, y, 0, x, y, r);
      wg.addColorStop(0, `rgba(255,196,130,${0.2 * k})`);
      wg.addColorStop(1, 'rgba(255,190,140,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, l.w, l.h);
    }
    // bokeh
    ctx.globalCompositeOperation = 'lighter';
    const spr = k > 0.5 ? this.sprites.warm : this.sprites.cool;
    for (const b2 of this.bokeh) {
      const x = ((b2.x + (this.o.reducedMotion ? 0 : this.time * b2.s * 0.3)) % 1) * l.w;
      const y = b2.y * l.h + (this.o.reducedMotion ? 0 : Math.sin(this.time * 0.2 + b2.p) * 6);
      const r = b2.r * Math.min(l.w, l.h);
      glow(ctx, spr, x, y, r, (0.06 + 0.05 * k) + 0.04 * Math.sin(this.time * 0.5 + b2.p));
    }
    ctx.globalCompositeOperation = 'source-over';
    // the vignette
    const vg = ctx.createRadialGradient(l.w / 2, l.h * 0.45, Math.min(l.w, l.h) * 0.3, l.w / 2, l.h * 0.45, Math.hypot(l.w, l.h) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${0.5 - 0.14 * k})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, l.w, l.h);
  }

  /** Night (0) to dawn (1) as the way goes. */
  private dawn(sim: KintsugiSim): number {
    const P = sim.plan, t = sim.t;
    switch (sim.stage) {
      case 'arrive': return 0;
      case 'gather': return 0.22 * clamp((t - P.arriveEnd) / Math.max(1, P.gatherEnd - P.arriveEnd));
      case 'gold': return 0.22 + 0.2 * clamp(sim.blockT / 30) + 0.1 * sim.goldFrac;
      case 'beat': return 0.52 + 0.2 * clamp((t - (sim.beatStart ?? t)) / Math.max(1, sim.beatEnd - (sim.beatStart ?? t)));
      default: return Math.min(1, 0.72 + 0.28 * clamp(sim.blockT / 20));
    }
  }

  /** The heart's swell now (1 at rest). */
  private swell(): number {
    if (this.o.reducedMotion) return 1;
    let k = 1;
    for (const r of this.rings) {
      const u = this.time - r.t0;
      if (u < 0.5) k += (r.strong ? 0.042 : 0.024) * Math.sin(Math.PI * clamp(u / 0.32)) * Math.exp(-u * 3);
    }
    return k;
  }

  private drawHeart(ctx: CanvasRenderingContext2D, sim: KintsugiSim): void {
    const l = this.c, hp = this.heartP;
    const kz = l.s / Math.max(1e-6, this.bakedS);
    const box = { x: l.cx + this.layerBox.x * kz, y: l.cy + this.layerBox.y * kz, w: this.layerBox.w * kz, h: this.layerBox.h * kz };
    const k = this.swell();
    const radiant = sim.stage === 'radiance' || sim.stage === 'close';
    // the aura behind the heart
    if (radiant || sim.stage === 'beat') this.drawAura(ctx, sim, k);
    ctx.save();
    ctx.translate(l.cx, l.cy);
    ctx.scale(k, k);
    ctx.translate(-l.cx, -l.cy);
    if (this.layer) ctx.drawImage(this.layer, box.x, box.y, box.w, box.h);
    // the golden glaze, as far as the gold poured
    const tint = sim.tint;
    if (tint > 0.01 && this.tex && hp) {
      ctx.save();
      ctx.translate(l.cx, l.cy);
      ctx.scale(l.s, l.s);
      ctx.clip(hp);
      ctx.globalAlpha = clamp(tint) * 0.82;
      ctx.drawImage(this.tex.gold, TEX.x0, TEX.y0, TEX.w, TEX.h);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (this.seamLayer) {
      ctx.drawImage(this.seamLayer, box.x, box.y, box.w, box.h);
      // on a golden heart the seams shine brighter than the body, so they stay its most beautiful part
      if (tint > 0.25) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp((tint - 0.25) * 0.9);
        ctx.drawImage(this.seamLayer, box.x, box.y, box.w, box.h);
        ctx.restore();
      }
    }
    // the gold flowing now, and its molten front
    if (sim.stage === 'gold' && hp) {
      ctx.save();
      ctx.translate(l.cx, l.cy);
      ctx.scale(l.s, l.s);
      ctx.clip(hp);
      for (const sm of this.geo.seams) {
        const f = seamFill(sm, this.front);
        if (f <= 0 || f >= 0.999) continue;
        this.goldStroke(ctx, sm.id, f * sm.len);
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      for (const sm of this.geo.seams) {
        const f = seamFill(sm, this.front);
        if (f <= 0 || f >= 0.999) continue;
        const q = along(sm.pts, sm.cum, f * sm.len);
        const [x, y] = toScreen(l, q.x, q.y);
        const fl = 0.75 + 0.25 * Math.sin(this.time * 9 + sm.id);
        glow(ctx, this.sprites.warm, x, y, 0.08 * l.s, 0.55 * fl * (0.5 + sim.light));
        glow(ctx, this.sprites.white, x, y, 0.028 * l.s, 0.95);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // glints along the gilded lines
    if (this.glints.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.glints) {
        const sm = this.geo.seams[g.seam];
        const q = along(sm.pts, sm.cum, g.pos);
        const [x, y] = toScreen(l, q.x, q.y);
        const a = Math.sin(Math.PI * clamp(g.pos / g.life));
        glow(ctx, this.sprites.warm, x, y, 0.09 * l.s, 0.35 * a);
        glow(ctx, this.sprites.white, x, y, 0.035 * l.s, 0.8 * a);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // a piece just home: a soft flash along its outline
    if (hp && this.settle.size) {
      ctx.save();
      ctx.translate(l.cx, l.cy);
      ctx.scale(l.s, l.s);
      ctx.globalCompositeOperation = 'lighter';
      for (const [id, t0] of this.settle) {
        const u = (this.time - t0) / 1.2;
        if (u >= 1) { this.settle.delete(id); continue; }
        ctx.save();
        ctx.clip(hp);
        ctx.strokeStyle = `rgba(255,236,196,${0.75 * (1 - u)})`;
        ctx.lineWidth = (2 + 6 * u) / l.s;
        ctx.stroke(this.piecePaths[id]);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    ctx.restore();
    // the beat's rings of light
    if (hp && this.rings.length && (sim.stage === 'beat' || radiant)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const r of this.rings) {
        if (!r.strong) continue;
        const u = clamp((this.time - r.t0) / 2);
        const sc = 1.02 + (this.o.reducedMotion ? 0 : 0.5 * ease.outCubic(u));
        ctx.save();
        ctx.translate(l.cx, l.cy);
        ctx.scale(l.s * sc, l.s * sc);
        const a = (1 - u) * (0.4 + 0.6 * sim.tint);
        ctx.strokeStyle = rgba(GOLD_HI, 0.1 * a);
        ctx.lineWidth = (10 - 6 * u) / (l.s * sc);
        ctx.stroke(hp);
        ctx.strokeStyle = rgba(GOLD_HI, 0.22 * a);
        ctx.lineWidth = (2.4 - 1.4 * u) / (l.s * sc);
        ctx.stroke(hp);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  private drawAura(ctx: CanvasRenderingContext2D, sim: KintsugiSim, swell: number): void {
    const l = this.c;
    const radiant = sim.stage === 'radiance' || sim.stage === 'close';
    const g = sim.goldFrac;
    const grow = radiant ? clamp(sim.stage === 'close' ? 1 : sim.blockT / 8) : clamp(sim.tint) * 0.45;
    const size = (0.75 + 0.45 * g + 0.2 * sim.sessionLight) * (1 + 0.04 * (swell - 1) * 20) ;
    const br = sim.breath.k;
    const [x, y] = toScreen(l, 0, 0.06);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // love: a warm rose, widest
    glow(ctx, this.sprites.rose, x, y, l.s * 2.3 * size * (0.95 + 0.05 * br), 0.32 * grow);
    // the gold between
    glow(ctx, this.sprites.gold, x, y, l.s * 1.55 * size, 0.38 * grow + 0.25 * this.bloom * grow);
    // slow rays
    if (radiant) {
      const n = 22;
      const rot = this.o.reducedMotion ? 0 : this.time * 0.025;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU + 0.12 * Math.sin(i * 2.3);
        const len = l.s * (1.5 + 0.9 * hashf(i + 3)) * size;
        const wv = 0.035 + 0.045 * hashf(i + 7);
        const pulse = 0.65 + 0.35 * Math.sin(this.time * 0.4 + i * 1.7);
        const gr = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
        gr.addColorStop(0, 'rgba(255,236,190,0)');
        gr.addColorStop(0.3, `rgba(255,236,190,${0.11 * grow * pulse})`);
        gr.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a - wv) * len, y + Math.sin(a - wv) * len);
        ctx.lineTo(x + Math.cos(a + wv) * len, y + Math.sin(a + wv) * len);
        ctx.closePath();
        ctx.fill();
      }
    }
    // purity: a white-gold centre
    glow(ctx, this.sprites.white, x, y, l.s * 0.95 * size, 0.42 * grow + 0.2 * this.bloom);
    ctx.restore();
  }

  /** The pieces still on the cloth: sooty, their broken edges grey. */
  private drawCloth(ctx: CanvasRenderingContext2D, sim: KintsugiSim): void {
    for (const pc of sim.pieces) {
      if (pc.state !== 'cloth') continue;
      if (pc.grace && sim.t >= pc.graceFrom) continue;
      const pose = this.pose(pc.id, sim);
      const glowA = 0.25 + 0.15 * Math.sin(this.time * 0.7 + pc.id);
      this.drawPiece(ctx, pc.id, pose, 1, glowA * 0.4, sim.held !== null ? 0.72 : 1);
    }
  }

  /** One piece at its pose: shadow, the shard's thickness, porcelain, soot (`soot` 0..1, or the wash buffer), the broken edge. */
  private drawPiece(ctx: CanvasRenderingContext2D, id: number, pose: Pose, soot: number, rimGlow = 0, alpha = 1): void {
    const tex = this.tex, hp = this.heartP, pp = this.piecePaths[id];
    if (!tex || !hp || !pp) return;
    const pc = this.geo.pieces[id];
    const wash = this.wash && this.wash.id === id ? this.wash : null;
    const clean = wash ? clamp(wash.last) : 1 - soot;
    const place = (dx: number, dy: number): void => {
      ctx.translate(pose.x + dx, pose.y + dy);
      ctx.scale(1, pose.flat);
      ctx.rotate(pose.rot);
      ctx.scale(pose.sc, pose.sc);
      ctx.translate(-pc.cx, -pc.cy);
    };
    ctx.save();
    ctx.globalAlpha = alpha;
    // its shadow on the cloth (deeper as it lies, softer and further as it rises)
    const off = (0.025 + 0.1 * pose.lift) * this.c.s;
    for (const [k, a] of [[1.8, 0.16], [1.2, 0.2], [0.7, 0.26]] as const) {
      ctx.save();
      place(off * 0.35 * k, off * k);
      ctx.clip(hp);
      ctx.fillStyle = `rgba(0,0,0,${a * (1 - 0.6 * pose.lift)})`;
      ctx.fill(pp);
      ctx.restore();
    }
    // the shard's thickness: its broken side, below the face
    const thick = Math.max(1.5, 0.024 * pose.sc);
    ctx.save();
    place(0, thick);
    ctx.clip(hp);
    ctx.fillStyle = clean > 0.5 ? '#cbbfae' : '#5a5048';
    ctx.fill(pp);
    ctx.restore();
    // the face: the glaze, the grime
    ctx.save();
    place(0, 0);
    ctx.clip(hp);
    ctx.clip(pp);
    ctx.drawImage(tex.porcelain, TEX.x0, TEX.y0, TEX.w, TEX.h);
    if (wash) ctx.drawImage(wash.canvas, TEX.x0 + wash.bx / tex.ps, TEX.y0 + wash.by / tex.ps, wash.bw / tex.ps, wash.bh / tex.ps);
    else if (soot > 0.01) {
      ctx.globalAlpha = alpha * soot;
      ctx.drawImage(tex.soot, TEX.x0, TEX.y0, TEX.w, TEX.h);
      ctx.globalAlpha = alpha;
    }
    // the broken edge: a bevel where the light clay body shows at the fracture (dimmed a little by the soot)
    ctx.strokeStyle = clean > 0.5 ? 'rgba(255,252,246,0.95)' : 'rgba(224,210,190,0.82)';
    ctx.lineWidth = 3.2 / pose.sc;
    ctx.stroke(pp);
    ctx.strokeStyle = clean > 0.5 ? 'rgba(150,132,112,0.35)' : 'rgba(40,32,30,0.55)';
    ctx.lineWidth = 0.9 / pose.sc;
    ctx.save();
    ctx.translate(1.6 / pose.sc, 1.6 / pose.sc);
    ctx.stroke(pp);
    ctx.restore();
    ctx.restore();
    if (rimGlow > 0.01) {
      ctx.save();
      place(0, 0);
      ctx.clip(hp);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,214,170,${rimGlow * 0.35})`;
      ctx.lineWidth = 3 / pose.sc;
      ctx.stroke(pp);
      ctx.restore();
    }
    ctx.restore();
  }

  /** The piece in the hands (and the grace's pieces): the hands, the water of light, the piece, its word. */
  private drawActive(ctx: CanvasRenderingContext2D, sim: KintsugiSim): void {
    const active = sim.pieces.filter(pc => pc.state === 'lift' || pc.state === 'held' || pc.state === 'wash' || pc.state === 'clean' || pc.state === 'lay');
    // the grace: one great pair of hands under the whole heart gathers what is left
    if (sim.block.what === 'grace') {
      const u = clamp(sim.blockT / Math.max(0.5, sim.block.dur));
      const a = Math.sin(Math.PI * clamp(u * 1.1)) ** 0.5;
      const [gx, gy] = toScreen(this.c, 0, HEART.bottom - 0.25);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.sprites.warm, gx, gy - this.c.s * 0.5, this.c.s * 1.6, 0.3 * a);
      ctx.globalCompositeOperation = 'source-over';
      drawHands(ctx, gx, gy, this.c.s * 0.95, 0.85 * a);
    }
    for (const pc of active) {
      const pose = this.pose(pc.id, sim);
      const pd = this.geo.pieces[pc.id];
      const R = pd.r * pose.sc;
      // the hands rise under it, brighter with the focus
      const handsA = pc.grace ? 0 : pc.state === 'lift' ? 0.45 + 0.55 * clamp(this.vp[pc.id] * 3 + 0.25) : pc.state === 'lay' ? 1 - 0.8 * clamp((this.vp[pc.id] - 0.6) / 0.4) : 0.95;
      const hpx = clamp(R * 1.25, this.c.s * 0.4, this.c.s * 0.72);
      const lightK = sim.pushBlock ? 0.3 + 0.7 * clamp(sim.light) : 0.5;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.sprites.warm, pose.x, pose.y + R * 0.3, R * 2.2, 0.28 * handsA * lightK);
      ctx.globalCompositeOperation = 'source-over';
      drawHands(ctx, pose.x, pose.y + R * 0.55, hpx, handsA);
      // the water of light, while washing
      if (pc.state === 'wash' && !pc.grace) this.drawWater(ctx, pose, R, pc.washed);
      const soot = pc.grace ? 1 - clamp(pc.washed) : pc.state === 'wash' ? 0 : pc.state === 'clean' || pc.state === 'lay' ? 0 : 1;
      if (this.o.reducedMotion && (pc.grace || pc.state === 'lift' || pc.state === 'lay')) {
        // fades instead of motion: the piece where it was, and where it goes
        const v = pc.grace ? clamp((sim.t - pc.graceFrom) / Math.max(0.1, pc.graceTo - pc.graceFrom)) : clamp(this.vp[pc.id]);
        const from = pc.grace || pc.state === 'lift' ? this.restPose(pc.id, 'cloth') : this.restPose(pc.id, 'hold');
        const to = pc.grace || pc.state === 'lay' ? this.restPose(pc.id, 'home') : this.restPose(pc.id, 'hold');
        this.drawPiece(ctx, pc.id, from, soot, 0, 1 - v);
        this.drawPiece(ctx, pc.id, to, soot, 0, v);
      } else this.drawPiece(ctx, pc.id, pose, soot, pc.state === 'clean' ? 0.8 : 0.3);
      // the word of pain under it, fading in the wash
      if (pc.word && !pc.grace) {
        const fade = pc.state === 'wash' ? 1 - clamp(pc.washed * 1.3) : pc.state === 'lift' || pc.state === 'held' ? 1 : 0;
        const re = sim.t < sim.reshowUntil ? 0.25 : 0;
        if (fade > 0.01) this.drawWord(ctx, pc.word, pose.x, pose.y + R * 0.9 + 14, fade, re);
      }
    }
  }

  private restPose(id: number, where: 'cloth' | 'hold' | 'home'): Pose {
    const pc = this.geo.pieces[id], l = this.c;
    if (where === 'cloth') {
      const sp = this.spots[id] ?? { x: pc.cx, y: pc.cy, rot: 0 };
      const [x, y] = toScreen(l, sp.x, sp.y);
      return { x, y, rot: sp.rot, sc: l.s * LIE, lift: 0, flat: FLAT };
    }
    if (where === 'home') {
      const [x, y] = toScreen(l, pc.cx, pc.cy);
      return { x, y, rot: 0, sc: l.s, lift: 0, flat: 1 };
    }
    const [x, y] = toScreen(l, HOLD.x, HOLD.y);
    return { x, y, rot: 0, sc: l.s * this.holdScale(id), lift: 1, flat: 1 };
  }

  private drawWater(ctx: CanvasRenderingContext2D, pose: Pose, R: number, w: number): void {
    const l = this.l;
    const env = Math.sin(Math.PI * clamp(w * 1.05)) ** 0.6;
    const top = l.scene.y - 10;
    const x = pose.x, y = pose.y - R * 0.6;
    const half = R * 0.75;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, top, 0, y + R * 1.4);
    g.addColorStop(0, 'rgba(200,230,255,0)');
    g.addColorStop(0.4, `rgba(214,236,255,${0.16 * env})`);
    g.addColorStop(0.85, `rgba(235,246,255,${0.26 * env})`);
    g.addColorStop(1, 'rgba(235,246,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - half * 0.55, top);
    ctx.lineTo(x + half * 0.55, top);
    ctx.lineTo(x + half * 1.15, y + R * 1.4);
    ctx.lineTo(x - half * 1.15, y + R * 1.4);
    ctx.closePath();
    ctx.fill();
    // falling streaks like clear water
    if (!this.o.reducedMotion) {
      ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const sx = x + (hashf(i * 13 + 1) - 0.5) * half * 1.4;
        const len = 18 + 26 * hashf(i * 7 + 2);
        const sp = 90 + 60 * hashf(i * 5 + 3);
        const span = y - top + R;
        const yy = top + ((this.time * sp + hashf(i * 11) * span) % span);
        const wob = Math.sin(this.time * 3 + i) * 2;
        ctx.strokeStyle = `rgba(230,244,255,${0.32 * env})`;
        ctx.lineWidth = 1 + hashf(i + 40) * 1.4;
        ctx.beginPath();
        ctx.moveTo(sx + wob, yy);
        ctx.lineTo(sx + wob * 0.5, yy + len);
        ctx.stroke();
      }
      // sparkle where it meets the piece
      for (let i = 0; i < 5; i++) {
        const a = this.time * 2.2 + i * 1.3;
        const px = x + Math.cos(a * 1.7 + i) * R * 0.6, py = y + Math.sin(a) * R * 0.2;
        glow(ctx, this.sprites.cool, px, py, 6 + 4 * Math.sin(a * 3), 0.5 * env);
      }
    }
    ctx.restore();
  }

  /** The word of pain under the held piece, on a dark pill: it fades as the piece is washed. */
  private drawWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, a: number, extra: number): void {
    const l = this.l;
    const size = Math.max(15, Math.min(22, l.font + 3));
    ctx.save();
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(word).width;
    const yy = Math.min(y, l.scene.y + l.scene.h - size);
    const xx = Math.max(l.scene.x + tw / 2 + 14, Math.min(l.scene.x + l.scene.w - tw / 2 - 14, x));
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = 'rgba(8,6,14,0.62)';
    roundRect(ctx, xx - tw / 2 - 12, yy - size * 0.75, tw + 24, size * 1.5, size * 0.75);
    ctx.fill();
    ctx.fillStyle = `rgba(214,204,220,${Math.min(1, 0.92 + extra)})`;
    ctx.fillText(word, xx, yy + 1);
    ctx.restore();
  }

  private drawParts(ctx: CanvasRenderingContext2D): void {
    if (!this.parts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const u = p.age / p.life;
      const a = Math.sin(Math.PI * u);
      if (p.kind === 'mote') {
        // soot turning to light as it rises
        const k = clamp(u * 1.6);
        const r = Math.round(90 + 165 * k), g = Math.round(84 + 150 * k), b = Math.round(96 + 100 * k);
        ctx.fillStyle = `rgba(${r},${g},${b},${0.8 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.7 + 0.5 * k), 0, TAU);
        ctx.fill();
        if (k > 0.6) glow(ctx, this.sprites.warm, p.x, p.y, p.size * 4, 0.35 * a);
      } else if (p.kind === 'drop') {
        ctx.fillStyle = `rgba(220,240,255,${0.8 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      } else {
        const tw = p.kind === 'joy' ? 0.6 + 0.4 * Math.sin(this.time * 8 + p.x) : 1;
        glow(ctx, this.sprites.gold, p.x, p.y, p.size * 3.2, 0.7 * a * tw);
        ctx.fillStyle = `rgba(255,246,214,${0.9 * a * tw})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── the words ──────────────────────────────────────────────────

  private drawWords(ctx: CanvasRenderingContext2D, sim: KintsugiSim): void {
    const l = this.l;
    const band = l.band;
    if (sim.stage === 'close') {
      this.drawClose(ctx, sim, l.closeText);
      return;
    }
    const rest = sim.restBlock;
    if (rest) this.drawGuide(ctx, sim);
    if (sim.stage === 'radiance' && sim.qualities.length) {
      this.drawQuality(ctx, sim, band);
      return;
    }
    if (rest && sim.card) {
      this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8));
      return;
    }
    if (sim.talk.line) {
      const ln = sim.talk.line;
      const a = clamp(ln.t / 0.5) * clamp((ln.dur - ln.t) / 0.6);
      this.drawLine(ctx, ln.text, band, a);
    }
  }

  private drawGuide(ctx: CanvasRenderingContext2D, sim: KintsugiSim): void {
    const g = this.l.guide;
    const n = Math.min(sim.breaths, sim.breath.n + 1);
    const a = clamp(sim.blockT / 0.8) * clamp((sim.block.dur - sim.blockT) / 0.6 + 0.2);
    drawBreathGuide(ctx, sim.breath, { cx: g.cx, cy: g.cy, r: g.r, layout: g.layout, maxW: g.maxW, sub: breathOf(n, sim.breaths), alpha: a, reducedMotion: this.o.reducedMotion, time: this.time });
  }

  private drawLine(ctx: CanvasRenderingContext2D, text: string, band: Rect, a: number): void {
    if (a <= 0.01) return;
    const size = Math.round(this.l.font + 1);
    ctx.save();
    ctx.font = `500 ${size}px ${FONT}`;
    const lines = wrapLines(ctx, text, band.w - 16).slice(0, 3);
    const lh = Math.round(size * 1.4);
    const top = band.y + Math.max(0, (band.h - lines.length * lh) / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = a;
    // a soft scrim for contrast on any scene
    const w = Math.min(band.w, Math.max(...lines.map(s => ctx.measureText(s).width)) + 36);
    ctx.fillStyle = 'rgba(6,6,16,0.42)';
    roundRect(ctx, band.x + (band.w - w) / 2, top - 8, w, lines.length * lh + 14, 14);
    ctx.fill();
    ctx.fillStyle = INK;
    lines.forEach((s, i) => ctx.fillText(s, band.x + band.w / 2, top + i * lh));
    ctx.restore();
  }

  private verseLayout(ctx: CanvasRenderingContext2D, id: PassageId, w: number, h: number, max: number): PassageLayout {
    const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
    let lay = this.verseCache.get(key);
    if (!lay) {
      lay = layoutPassage(ctx, passage(id), w, h, { max, min: 13 });
      this.verseCache.set(key, lay);
    }
    return lay;
  }

  private drawVerse(ctx: CanvasRenderingContext2D, id: PassageId, band: Rect, a: number): void {
    if (a <= 0.01) return;
    const max = this.l.kind === 'wide' ? 22 : 17;
    const lay = this.verseLayout(ctx, id, band.w - 24, band.h - 12, max);
    // a passage that would be cut is never shown (the summary carries a whole one)
    if (!lay.fits) return;
    const top = band.y + Math.max(0, (band.h - lay.height) / 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,6,16,0.42)';
    roundRect(ctx, band.x, top - 8, band.w, lay.height + 16, 16);
    ctx.fill();
    drawPassage(ctx, passage(id), lay, band.x + band.w / 2, top, { text: '#fbf3e4', ref: '#e8c77e' });
    ctx.restore();
  }

  private drawQuality(ctx: CanvasRenderingContext2D, sim: KintsugiSim, band: Rect): void {
    const q = sim.qualities[sim.qualities.length - 1];
    const a = clamp((this.time - this.qualityT) / 1.2);
    const size = Math.round(Math.min(40, this.l.font * 2));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `600 ${size}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = rgba(GOLD_HI, 1);
    ctx.shadowColor = 'rgba(255,200,120,0.6)';
    ctx.shadowBlur = 14;
    ctx.fillText(t(`q.${q}` as Key), band.x + band.w / 2, band.y);
    ctx.restore();
    if (sim.card) {
      const rest: Rect = { x: band.x, y: band.y + size + 8, w: band.w, h: Math.max(30, band.h - size - 8) };
      this.drawVerse(ctx, sim.card.id, rest, clamp((sim.t - sim.card.t0 - 0.6) / 0.8));
    }
  }

  private drawClose(ctx: CanvasRenderingContext2D, sim: KintsugiSim, band: Rect): void {
    const l = this.l;
    const a = clamp(sim.blockT / 1.2);
    if (sim.blessing) {
      ctx.save();
      ctx.globalAlpha = a;
      const size = Math.round(Math.min(22, l.font + 2));
      ctx.font = `italic 500 ${size}px ${SERIF}`;
      const lines = [...wrapLines(ctx, t('bless.1'), band.w - 20), ...wrapLines(ctx, t('bless.2'), band.w - 20)];
      const lh = Math.round(size * 1.35);
      const fit = Math.max(1, Math.floor(band.h / lh));
      const shown = lines.slice(0, fit);
      const top = band.y + Math.max(0, (band.h - shown.length * lh) / 2);
      ctx.fillStyle = 'rgba(6,6,16,0.42)';
      roundRect(ctx, band.x, top - 8, band.w, shown.length * lh + 14, 16);
      ctx.fill();
      ctx.fillStyle = '#fff6e6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      shown.forEach((s, i) => ctx.fillText(s, band.x + band.w / 2, top + i * lh));
      ctx.restore();
    } else if (sim.card) this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8));
    // how much does it hurt now (0–10)
    const q = l.rateQ;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // a soft scrim: the question reads on the brightest dawn too
    const subPx = Math.max(13, Math.round(l.font - 2));
    ctx.font = `500 ${subPx}px ${FONT}`;
    const qw = Math.min(q.w, Math.max(ctx.measureText(t('rate.sub')).width, 200) + 40);
    ctx.fillStyle = 'rgba(6,6,16,0.42)';
    roundRect(ctx, q.x + (q.w - qw) / 2, q.y - 3, qw, Math.round(l.font + 8) + subPx + 6, 12);
    ctx.fill();
    ctx.font = `600 ${Math.round(l.font + 1)}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(sim.rating === null ? t('rate.q') : t('rate.done', { n: sim.rating }), q.x + q.w / 2, q.y + 2);
    ctx.font = `500 ${subPx}px ${FONT}`;
    ctx.fillStyle = 'rgba(240,232,218,0.88)';
    ctx.fillText(t('rate.sub'), q.x + q.w / 2, q.y + Math.round(l.font + 6));
    l.rate.forEach((r, i) => {
      const on = sim.rating === i;
      ctx.fillStyle = on ? rgba(GOLD, 0.9) : 'rgba(14,10,24,0.5)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = on ? rgba(GOLD_HI, 1) : 'rgba(255,236,206,0.4)';
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = on ? '#2a1a06' : '#fbf3e4';
      ctx.font = `700 ${Math.round(l.font + 2)}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), r.x + r.w / 2, r.y + r.h / 2 + 1);
      ctx.textBaseline = 'top';
    });
    ctx.restore();
  }

  // ── input ─────────────────────────────────────────────────────

  /** The 0–10 button under a point (−1: none). */
  rateAt(sim: KintsugiSim, x: number, y: number): number {
    if (!sim.rateOpen || sim.rating !== null) return -1;
    return this.l.rate.findIndex(r => hits(r, x, y));
  }

  hover(sim: KintsugiSim, x: number, y: number): boolean { return this.rateAt(sim, x, y) >= 0; }

  targets(sim: KintsugiSim): TapTarget[] {
    if (!sim.rateOpen || sim.rating !== null) return [];
    return this.l.rate.map((r, i) => target(t('rate.label', { n: i }), r, MIN_TAP));
  }

  /** The guide's box (for the audit's text check). */
  guideBox(ctx: CanvasRenderingContext2D, sim: KintsugiSim): { x: number; y: number; w: number; h: number } {
    const g = this.l.guide;
    return breathGuideBox(ctx, { cx: g.cx, cy: g.cy, r: g.r, layout: g.layout, maxW: g.maxW, sub: breathOf(1, sim.breaths) });
  }
}

function hashf(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function linePath(pts: readonly { x: number; y: number }[]): Path2D {
  const p = new Path2D();
  pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
  return p;
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
