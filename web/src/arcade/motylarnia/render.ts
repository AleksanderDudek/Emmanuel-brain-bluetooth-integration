/**
 * Motylarnia's play screen.  Top-down while it eats (paper, the painted leaf with its bitten holes
 * showing soil-brown paper, pigment dots, treats, the caterpillar), a side view in afternoon light
 * for the spinning, the chrysalis and the emergence, and the glasshouse at sunset for the finale.
 * The HUD is drawn on the canvas: the species and its palette (top left), the wingspan and the
 * brain's meter (top right) — a strip above the leaf on tall screens, side columns on wide ones.
 * The runner's clock and pause button keep the top 64 px; a soft canopy shade keeps them legible.
 *
 * What does not move is painted once into offscreen canvases: the backgrounds, the leaf turned to the
 * screen (bites are punched into it as they happen), the side view's stage with its stem, the HUD
 * panels and egg cards with their shadows, the emergence card, the glows.  A frame is a few copies
 * and sprites; it makes no gradient.
 */
import { fmtNum } from '../../i18n';
import { Floaters, Particles, ease } from '../kit/juice';
import { PLANTS, SIZE_CLASSES, TIERS, capital, speciesById, type Species } from './content';
import {
  drawButterfly, drawChrysalis, drawSilhouette, paintWing, spriteOfRecord, wingMidY, type ButterflySprite, type ChrysalisLook, type WingBitmap,
} from './butterfly';
import {
  PANEL_FEED, PANEL_REST, STRIP, TOP, applyLeafTransform, computeLayout, inRect, sideArea, toLeaf, toScreen, type LeafBox, type Layout, type Rect, type SideArea,
} from './layout';
import { LEAF_H, LEAF_W, buildLeaf, type LeafModel } from './leaf';
import { SOURCE_TEXT, type EggOffer } from './meta';
import {
  INK, INK_SOFT, PAPER, SANS, SERIF, canvas, ctx2d, darken, drawCaterpillar, drawEgg, drawHangingLarva, fitFont, hash, lighten,
  mix, paintLeaf, paintLeafShadow, paintPaper, paintSoil, punchBites, rgba, roundRect, treatSprite, dotSprite, wrapLines,
  type BodyPoint,
} from './paint';
import { t } from './i18n';
import { drawStemLeaves, paintCornerLeaves, paintGlasshouse, paintSideBackdrop, paintStem, sideGeometry, type SideGeom } from './scenery';
import { PICK_GRACE, T_LEAF, T_SPIN, sizeClass, type MothSim, type Round } from './sim';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** the emergence card's height without tags, and what each row of tags adds (it hangs 6 px under the runner's top bar) */
const CARD_BASE = 70;
const CARD_ROW = 26;
/** room around a cached egg card or HUD panel for its shadow (CSS px) */
const SHADOW_PAD = 30;
/** the cloud shadow's puffs: offset (×R) and size */
const PUFFS = [0, 0, 1, 0.8, -0.25, 0.75, -0.75, 0.2, 0.8, 0.25, 0.35, 0.7];
/** the meters' colours (S: Śmiałe linie, B: Barwy) and the key of the full meter's gold */
const GOLD = 'gold';
const S_COLOUR = '#C2408F';
const B_COLOUR = '#3A5BD9';
/** HUD labels with shorter forms for narrow columns: the first that fits at a readable size is used */
const S_WAKING = [t('hud.linesWaking'), t('hud.waking')];
const S_NAME = [t('hud.lines'), t('hud.linesShort')];
const B_WAKING = [t('hud.coloursSettling'), t('hud.settling')];
const B_NAME = [t('hud.colours')];
const READABLE = 9.5;
const GOLDEN_HOUR = t('finale.title');

/** A name set in one line, or in two when one line would get too small: the lines, their size and line height. */
interface NameFit { lines: string[]; size: number; lh: number }

/**
 * The break of a name into two lines that balances them, at the current font: at a space, or after a
 * hyphen (which stays on the first line).  Null for a single word without a hyphen.
 */
export function splitName(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string): [string, string] | null {
  let best: [string, string] | null = null, bestW = Infinity;
  for (let i = 1; i < text.length - 1; i++) {
    const c = text[i];
    if (c !== ' ' && c !== '-') continue;
    const a = c === ' ' ? text.slice(0, i) : text.slice(0, i + 1), b = text.slice(i + 1);
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (w < bestW) {
      bestW = w;
      best = [a, b];
    }
  }
  return best;
}
/** the egg cards' telegraph: its track and the time left */
const TRACK = rgba(INK, 0.12);
const TRACK_LEFT = rgba(INK, 0.55);

/** The fonts the canvas text uses are in: what is painted with them may be kept. */
const fontsReady = (): boolean => typeof document === 'undefined' || !document.fonts
  || (document.fonts.check(`600 17px ${SERIF}`) && document.fonts.check(`800 10px ${SANS}`));

export class MothRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  w = 1;
  h = 1;
  private dpr = 1;
  L: Layout = computeLayout(1, 1);
  /** the leaf box the layout was made for (identity: boxes are per plant) */
  private Lbox: LeafBox | null = null;
  /** the round's leaf: the screen under it (paper, its shadow, the soil in the holes), the leaf turned to the screen */
  private leafRound: Round | null = null;
  private base: HTMLCanvasElement | null = null;
  private leafLayer: HTMLCanvasElement | null = null;
  private leafCtx: CanvasRenderingContext2D | null = null;
  private punched = 0;
  /** leaves painted ahead, while the egg cards are up (keyed by plant, round and size) */
  private readonly prepared = new Map<string, { art: HTMLCanvasElement; base: HTMLCanvasElement }>();
  private paper: HTMLCanvasElement | null = null;
  private side: HTMLCanvasElement | null = null;
  private sideGold = false;
  /** the side view of a round: the backdrop with the host plant's stem painted in, and where things go */
  private stage: { round: Round; canvas: HTMLCanvasElement; g: SideGeom; area: SideArea } | null = null;
  private house: HTMLCanvasElement | null = null;
  private introBg: HTMLCanvasElement | null = null;
  private inner: { round: Round; pale: WingBitmap | null; deep: WingBitmap | null } | null = null;
  private readonly look: ChrysalisLook = { kind: 'hanging', color: '', accent: '', glass: 0, depth: 0, blind: false, pale: null, deep: null, warm: 0 };
  private hero: { round: Round; sprite: ButterflySprite; shell: string; seam: string; card: HTMLCanvasElement | null; cardH: number } | null = null;
  /** the finale's butterflies, painted a couple per frame */
  private readonly finale: ButterflySprite[] = [];
  private finalePx = 0;
  private readonly panels = new Map<number, HTMLCanvasElement>();
  private faces = new WeakMap<EggOffer, (HTMLCanvasElement | undefined)[]>();
  private readonly eggTints = new Map<Species, string>();
  private readonly names = new Map<Species, string>();
  /** how a name and a hint were set for a width (the HUD asks every frame; kept once the fonts are in) */
  private readonly nameFits = new Map<string, NameFit>();
  private readonly hintFits = new Map<string, { size: number; lines: string[] }>();
  private canopyFill: CanvasGradient | null = null;
  private readonly meterFills = new Map<string, CanvasGradient>();
  private glowArt: HTMLCanvasElement | null = null;
  /** the cloud shadow's small canvas and its puff (a unit radial gradient) */
  private puffArt: HTMLCanvasElement | null = null;
  private puffCtx: CanvasRenderingContext2D | null = null;
  private puffFill: CanvasGradient | null = null;
  readonly particles = new Particles(320);
  readonly floaters = new Floaters();
  private time = 0;
  private readonly body: BodyPoint[] = Array.from({ length: 16 }, () => ({ x: 0, y: 0 }));
  private readonly larva: BodyPoint[] = Array.from({ length: 11 }, () => ({ x: 0, y: 0 }));
  private cloud = 0;
  private cloudX = 0;
  private readonly slotPop = [0, 0, 0];
  private lastPalette = -1;
  private readonly pt = { x: 0, y: 0 };
  /** when the pick happened (phase seconds), per round */
  private readonly pickAt = new WeakMap<Round, number>();

  constructor(cv: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = cv.getContext('2d')!;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.base = this.leafLayer = this.paper = this.side = this.house = this.introBg = null;
    this.leafCtx = null;
    this.leafRound = null;
    this.stage = null;
    this.prepared.clear();
    this.panels.clear();
    this.nameFits.clear();
    this.hintFits.clear();
    this.faces = new WeakMap();
    if (this.hero) this.hero.card = null;
    this.finale.length = 0;
    // the words and sparks were placed on the old screen
    this.floaters.items.length = 0;
    this.particles.clear();
    this.L = computeLayout(w, h, this.Lbox ?? undefined);
  }

  /** The layout of the round's leaf (its box fills the play area; the HUD and cards do not depend on it). */
  private layoutFor(r: Round | null): Layout {
    const box = r?.leaf?.box ?? null;
    if (box && box !== this.Lbox) {
      this.L = computeLayout(this.w, this.h, box);
      this.Lbox = box;
    }
    return this.L;
  }

  /** Screen → leaf space for the current leaf. */
  toLeaf(sim: MothSim, x: number, y: number): { x: number; y: number } {
    return toLeaf(this.layoutFor(sim.round), x, y, { x: 0, y: 0 });
  }

  /** Which egg card is at a screen point (−1: none). */
  cardAt(x: number, y: number): number {
    const L = this.L;
    return inRect(L.cards[0], x, y) ? 0 : inRect(L.cards[1], x, y) ? 1 : -1;
  }

  // ── cached pictures ────────────────────────────────────────────
  private screenCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = canvas(this.w * this.dpr, this.h * this.dpr), x = ctx2d(c);
    x.scale(this.dpr, this.dpr);
    return [c, x];
  }

  private paperBg(): HTMLCanvasElement {
    if (!this.paper) {
      const [c, x] = this.screenCanvas();
      paintPaper(x, this.w, this.h);
      // soft green light from the glasshouse around the edges
      for (let i = 0; i < 14; i++) {
        const px = hash(i * 7) * this.w, py = hash(i * 13 + 2) * this.h, r = Math.min(this.w, this.h) * (0.12 + 0.2 * hash(i * 3));
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(141,191,90,${0.1 + 0.08 * hash(i)})`);
        g.addColorStop(1, 'rgba(141,191,90,0)');
        x.fillStyle = g;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      }
      paintCornerLeaves(x, this.w, this.h);
      this.paper = c;
    }
    return this.paper;
  }

  private artScaleFor(L: Layout): number {
    return Math.min(3, Math.max(0.8, L.scale * this.dpr));
  }

  private leafKey(m: LeafModel, r: Round, L: Layout): string {
    return `${m.plant}|${r.index}|${r.last}|${this.artScaleFor(L).toFixed(3)}|${this.w}x${this.h}`;
  }

  /**
   * A leaf's two pictures: the painted leaf (leaf space) and the screen base under it (paper, the
   * leaf's shadow, the soil seen through the holes).
   */
  private paintLeafAssets(m: LeafModel, r: Round, L: Layout): { art: HTMLCanvasElement; base: HTMLCanvasElement } {
    const [base, x] = this.screenCanvas();
    x.drawImage(this.paperBg(), 0, 0, this.w, this.h);
    x.save();
    applyLeafTransform(x, L);
    paintLeafShadow(x, m);
    paintSoil(x, m, r.index * 17);
    x.restore();
    return { art: paintLeaf(m, PLANTS[m.plant], this.artScaleFor(L), r.last, r.index * 31 + 7), base };
  }

  /** Paint an offered egg's leaf ahead of the pick (no hitch when it hatches). */
  private prepareOffer(r: Round, i: number): void {
    const o = r.offers[i];
    if (!o) return;
    const m = buildLeaf(speciesById(o.sp).plant), L = computeLayout(this.w, this.h, m.box), key = this.leafKey(m, r, L);
    if (!this.prepared.has(key)) this.prepared.set(key, this.paintLeafAssets(m, r, L));
  }

  /** The round's leaf in screen space, its new bites punched in (the leaf transform maps them, circles stay circles). */
  private ensureLeaf(r: Round, L: Layout): void {
    if (this.leafRound !== r || !this.leafLayer) {
      const m = r.leaf!, assets = this.prepared.get(this.leafKey(m, r, L)) ?? this.paintLeafAssets(m, r, L);
      this.prepared.clear();
      const [c, x] = this.screenCanvas();
      x.save();
      applyLeafTransform(x, L);
      x.drawImage(assets.art, 0, 0, LEAF_W, LEAF_H + 14);
      x.restore();
      this.base = assets.base;
      this.leafLayer = c;
      this.leafCtx = x;
      this.punched = 0;
      this.leafRound = r;
    }
    if (this.punched < r.bites.length) {
      const x = this.leafCtx!;
      x.save();
      applyLeafTransform(x, L);
      punchBites(x, r.bites, this.punched, r.bites.length, r.last ? '#EFE6B0' : '#E2EDB4');
      x.restore();
      this.punched = r.bites.length;
    }
  }

  /** The leaf is done with (the side view has taken over): its two screens go. */
  private dropLeaf(): void {
    this.base = this.leafLayer = null;
    this.leafCtx = null;
    this.leafRound = null;
  }

  private sideBg(golden: boolean): HTMLCanvasElement {
    if (!this.side || this.sideGold !== golden) {
      const [c, x] = this.screenCanvas();
      paintSideBackdrop(x, this.w, this.h, golden ? 1 : 0);
      this.side = c;
      this.sideGold = golden;
    }
    return this.side;
  }

  /** The round's side view: the backdrop with its stem (painted once, ahead, while it eats). */
  private sideStage(r: Round, sp: Species): { canvas: HTMLCanvasElement; g: SideGeom; area: SideArea } {
    if (!this.stage || this.stage.round !== r) {
      const area = sideArea(this.layoutFor(r)), g = sideGeometry(sp.pupa.kind, area);
      const [c, x] = this.screenCanvas();
      x.drawImage(this.sideBg(r.last), 0, 0, this.w, this.h);
      paintStem(x, g, sp.plant);
      this.stage = { round: r, canvas: c, g, area };
    }
    return this.stage;
  }

  private glasshouse(sunset: boolean): HTMLCanvasElement {
    if (!this.house) {
      const [c, x] = this.screenCanvas();
      paintGlasshouse(x, this.w, this.h, sunset ? 1 : 0);
      this.house = c;
    }
    return this.house;
  }

  /** A warm white glow (radial, opaque at the centre), drawn scaled with an alpha. */
  private glow(): HTMLCanvasElement {
    if (!this.glowArt) {
      const c = canvas(128, 128), x = ctx2d(c), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,248,222,1)');
      g.addColorStop(1, 'rgba(255,248,222,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      this.glowArt = c;
    }
    return this.glowArt;
  }

  /** A soft panel (paper, 82 % opaque) with its shadow, `w`×`h` CSS px, drawn at (x, y). */
  private panel(x: number, y: number, w: number, h: number): void {
    const key = Math.round(w) * 4096 + Math.round(h);
    let c = this.panels.get(key);
    if (!c) {
      const d = this.dpr;
      c = canvas((w + 2 * SHADOW_PAD) * d, (h + 2 * SHADOW_PAD) * d);
      const p = ctx2d(c);
      p.scale(d, d);
      p.shadowColor = 'rgba(60,44,20,.12)';
      p.shadowBlur = 7 * d;
      p.fillStyle = 'rgba(251,247,236,.82)';
      roundRect(p, SHADOW_PAD, SHADOW_PAD, w, h, 16);
      p.fill();
      this.panels.set(key, c);
    }
    this.ctx.drawImage(c, x - SHADOW_PAD, y - SHADOW_PAD, w + 2 * SHADOW_PAD, h + 2 * SHADOW_PAD);
  }

  private nameOf(sp: Species): string {
    let n = this.names.get(sp);
    if (!n) this.names.set(sp, (n = capital(sp.name)));
    return n;
  }

  /**
   * Fit a species name (the serif at 600) into `maxW`: one line from `size` down to `one` px, else two
   * lines balanced at a space or hyphen, from `two` px down to 10 (German "Schwarzkolbiger
   * Braun-Dickkopffalter" needs them); a single long word stays on one line, shrunk to 9 at the least.
   * Sets the context's font.
   */
  private fitName(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, one: number, two: number): NameFit {
    const key = `${text}|${Math.round(maxW)}|${size}|${one}|${two}`;
    let f = this.nameFits.get(key);
    if (!f) {
      const s1 = fitFont(ctx, text, maxW, size, 600, SERIF, one);
      const fits = ctx.measureText(text).width <= maxW;
      const split = fits ? null : splitName(ctx, text);
      if (!split) f = { lines: [text], size: fits ? s1 : fitFont(ctx, text, maxW, one, 600, SERIF, 9), lh: 0 };
      else {
        let s = Math.min(two, size);
        const wider = (): number => {
          ctx.font = `600 ${s}px ${SERIF}`;
          return Math.max(ctx.measureText(split[0]).width, ctx.measureText(split[1]).width);
        };
        while (s > 10 && wider() > maxW) s -= 0.5;
        f = { lines: split, size: s, lh: Math.round(s * 1.2) };
      }
      if (fontsReady()) this.nameFits.set(key, f);
    }
    ctx.font = `600 ${f.size}px ${SERIF}`;
    return f;
  }

  /** The lines of a fitted name, the first baseline at `y` (current font and alignment). */
  private drawName(ctx: CanvasRenderingContext2D, f: NameFit, x: number, y: number): void {
    for (let i = 0; i < f.lines.length; i++) ctx.fillText(f.lines[i], x, y + i * f.lh);
  }

  private eggTint(sp: Species): string {
    let t = this.eggTints.get(sp);
    if (!t) this.eggTints.set(sp, (t = mix(sp.larva.body, '#E8E0B0', 0.55)));
    return t;
  }

  // ── the intro while calibrating ────────────────────────────────
  intro(dt: number, p: number): void {
    const { ctx, w, h } = this;
    this.time += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // a short wide screen: the runner's calibration card fills the middle, so the egg sits left of it
    const side = w > h && h < 560;
    const ex = side ? w * 0.13 : w * 0.5, ey = side ? h * 0.46 : h * 0.3;
    if (!this.introBg) {
      const [c, x] = this.screenCanvas();
      paintPaper(x, w, h);
      const m = buildLeaf('pokrzywa'), s = Math.min(w / LEAF_W, h / LEAF_H) * 1.25;
      const art = paintLeaf(m, PLANTS.pokrzywa, Math.min(3, s * this.dpr), false, 3);
      x.save();
      x.translate(ex, ey + h * 0.06);
      x.rotate(-0.5);
      x.scale(s, s);
      x.translate(-LEAF_W / 2, -LEAF_H * 0.45);
      paintLeafShadow(x, m);
      x.drawImage(art, 0, 0, LEAF_W, LEAF_H + 14);
      x.restore();
      this.introBg = c;
    }
    ctx.drawImage(this.introBg, 0, 0, w, h);
    const r = Math.max(14, Math.min(w, h) * 0.06);
    const amp = this.opts.reducedMotion ? 0.02 : 0.04 + 0.16 * p * p;
    const rock = Math.sin(this.time * (3 + 6 * p)) * amp * (p > 0.05 ? 1 : 0);
    drawEgg(ctx, ex, ey, r, '#C9D88A', p > 0.55 ? (p - 0.55) / 0.45 : 0, rock, this.dpr);
    if (p >= 0.999) {
      // the tiny caterpillar chews its way out
      const k = Math.min(1, (this.time % 3) / 0.8);
      ctx.fillStyle = '#2B2A2E';
      ctx.beginPath();
      ctx.arc(ex + r * 0.1, ey - r * 0.25 - r * 0.3 * ease.outBack(k), r * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + r * 0.2, ey - r * 0.32 - r * 0.3 * ease.outBack(k), r * 0.07, 0, TAU);
      ctx.fill();
    }
    this.canopy();
  }

  // ── a frame of play ─────────────────────────────────────────────
  draw(sim: MothSim, dt: number): void {
    const { ctx } = this;
    this.time += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    this.particles.update(dt);
    this.floaters.update(dt);
    const r = sim.round;
    const unreliable = (sim.phase === 'feed' && r?.leafBlock && !r.leafBlock.reliable) || ((sim.phase === 'chrysalis' || sim.phase === 'spin') && r?.restBlock && !r.restBlock.reliable);
    this.cloud += ((unreliable ? 1 : 0) - this.cloud) * (1 - Math.exp(-dt / 0.8));
    this.cloudX += dt * 0.06;
    if (!r) {
      ctx.drawImage(this.paperBg(), 0, 0, this.w, this.h);
      this.canopy();
      return;
    }
    switch (sim.phase) {
      case 'leaf': this.drawNewLeaf(sim, r); break;
      case 'feed': this.drawFeed(sim, r, 1); break;
      case 'spin': {
        const k = clamp01(sim.phaseT / 0.9);
        if (k < 1) this.drawFeed(sim, r, 1);
        else this.dropLeaf();
        ctx.globalAlpha = this.opts.reducedMotion ? k : ease.inOutSine(k);
        this.drawSide(sim, r);
        ctx.globalAlpha = 1;
        break;
      }
      case 'chrysalis':
      case 'emerge':
        this.drawSide(sim, r);
        break;
      case 'finale':
        this.drawFinale(sim);
        break;
    }
    this.particles.draw(ctx);
    this.drawFloaters();
    this.canopy();
  }

  /** The words that pop ("Najedzona!"): paper-outlined so they read over leaf and light alike. */
  private drawFloaters(): void {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of this.floaters.items) {
      const k = f.t / f.dur;
      const pop = k < 0.18 ? ease.outBack(k / 0.18) : 1;
      const rise = this.opts.reducedMotion ? 0 : 40 * ease.outCubic(k);
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      const size = fitFont(ctx, f.text, this.w - 32, Math.round(f.size * pop), 600, SERIF, 12);
      ctx.strokeStyle = 'rgba(251,247,236,.92)';
      ctx.lineWidth = Math.max(3, size * 0.18);
      ctx.strokeText(f.text, f.x, f.y - rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - rise);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  /** The runner's clock and pause button sit on a soft shade at the top. */
  private canopy(): void {
    const { ctx } = this;
    if (!this.canopyFill) {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(30,42,22,.5)');
      g.addColorStop(1, 'rgba(30,42,22,0)');
      this.canopyFill = g;
    }
    ctx.fillStyle = this.canopyFill;
    ctx.fillRect(0, 0, this.w, 64);
  }

  /**
   * Bad signal: the shadow of a passing cloud drifts over the scene (the runner says why).  It is soft
   * all over, so it is composed at an eighth of the screen's size and laid over it in one copy.
   */
  private drawCloud(): void {
    if (this.cloud < 0.02) return;
    const { ctx, w, h } = this, alpha = ctx.globalAlpha, q = 8;
    if (!this.puffArt || !this.puffCtx || this.puffArt.width !== Math.ceil(w / q) || this.puffArt.height !== Math.ceil(h / q)) {
      this.puffArt = canvas(w / q, h / q);
      this.puffCtx = ctx2d(this.puffArt);
      const g = this.puffCtx.createRadialGradient(0, 0, 0.2, 0, 0, 1);
      g.addColorStop(0, 'rgba(36,44,58,.2)');
      g.addColorStop(1, 'rgba(36,44,58,0)');
      this.puffFill = g;
    }
    const c = this.puffArt, x2 = this.puffCtx, s = 1 / q;
    const R = Math.max(w, h) * 0.32, span = w + R * 3;
    const x = ((this.cloudX * w * 0.9) % span) - R * 1.5, y = h * 0.5;
    x2.setTransform(1, 0, 0, 1, 0, 0);
    x2.clearRect(0, 0, c.width, c.height);
    x2.fillStyle = 'rgba(110,118,130,.1)';
    x2.fillRect(0, 0, c.width, c.height);
    x2.fillStyle = this.puffFill!;
    for (let i = 0; i < PUFFS.length; i += 3) {
      // a unit radial gradient, placed and sized by the transform
      const r = R * PUFFS[i + 2] * s;
      x2.setTransform(r, 0, 0, r, (x + R * PUFFS[i]) * s, (y + R * PUFFS[i + 1]) * s);
      x2.fillRect(-1, -1, 2, 2);
    }
    ctx.globalAlpha = alpha * this.cloud;
    ctx.drawImage(c, 0, 0, w, h);
    ctx.globalAlpha = alpha;
  }

  // ── NOWY LIŚĆ ───────────────────────────────────────────────────
  private drawNewLeaf(sim: MothSim, r: Round): void {
    const { ctx, w, h } = this;
    const picked = r.pick >= 0;
    // after the pick, the new leaf fades in under the cards with the egg on it
    ctx.drawImage(this.paperBg(), 0, 0, w, h);
    const since = picked ? sim.phaseT - this.pickT(sim, r) : 0;
    if (picked && r.leaf) this.drawFeed(sim, r, clamp01(since / 0.5));
    // painted ahead while the cards stand still: the offered leaves, then the chrysalis' backdrop
    if (picked ? since > 0.3 : sim.phaseT > 1.4) this.sideBg(r.last);
    else if (!picked && sim.phaseT > 0.4) this.prepareOffer(r, sim.phaseT > 0.9 ? 1 : 0);
    const L = this.L;
    const out = picked ? clamp01((sim.phaseT - this.pickT(sim, r)) / 0.45) : 0;
    const appear = clamp01(sim.phaseT / 0.35);
    // title
    if (out < 1) {
      ctx.globalAlpha = (1 - out) * appear;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = INK;
      const title = r.last ? t('cards.last') : r.index === 1 ? t('cards.first') : t('cards.nth', { n: r.index });
      const ty = L.cards[0].y - 20;
      fitFont(ctx, title, w - 32, 22, 600, SERIF);
      ctx.fillText(title, w / 2, ty);
      const titleW = ctx.measureText(title).width;
      // the telegraph: a thin line that runs out when the left egg hatches by itself
      const left = clamp01(1 - sim.phaseT / (T_LEAF - PICK_GRACE)), lw = Math.min(260, w * 0.6);
      ctx.fillStyle = TRACK;
      roundRect(ctx, w / 2 - lw / 2, ty + 10, lw, 4, 2);
      ctx.fill();
      ctx.fillStyle = TRACK_LEFT;
      roundRect(ctx, w / 2 - lw / 2, ty + 10, lw * left, 4, 2);
      ctx.fill();
      ctx.fillStyle = INK_SOFT;
      const hy = L.cards[0].y + L.cards[0].h + 24;
      if (hy < h - 64) {
        const hint = t('cards.hint');
        fitFont(ctx, hint, w - 32, 13, 500, SANS);
        ctx.fillText(hint, w / 2, hy);
      } else {
        // no room under the cards (a short landscape screen): a short note after the title
        const note = t('cards.note'), nx = w / 2 + titleW / 2 + 16, room = w - nx - 16;
        fitFont(ctx, note, room, 12.5, 600, SANS, 10);
        if (ctx.measureText(note).width <= room) {
          ctx.textAlign = 'left';
          ctx.fillText(note, nx, ty - 1);
        }
      }
      ctx.globalAlpha = 1;
    }
    r.offers.forEach((o, i) => {
      const rect = L.cards[i];
      const chosen = i === r.pick, gone = picked && !chosen;
      const a = (1 - out) * appear * (gone ? 0.6 : 1);
      if (a <= 0.01) return;
      const lift = chosen ? ease.outCubic(out) * -40 : 0;
      const scale = (0.92 + 0.08 * ease.outBack(appear)) * (chosen ? 1 + 0.06 * out : 1);
      this.card(o, rect, a, scale, lift, !picked && r.highlight === i, i);
    });
  }

  private pickT(sim: MothSim, r: Round): number {
    let t = this.pickAt.get(r);
    if (t === undefined) {
      t = sim.phaseT;
      this.pickAt.set(r, t);
    }
    return t;
  }

  /** An egg card: its face (painted once per look and size), and the egg rocking in front of it. */
  private card(o: EggOffer, rect: Rect, alpha: number, scale: number, lift: number, focus: boolean, i: number): void {
    const { ctx } = this;
    const sp = speciesById(o.sp), face = this.cardFace(o, rect.w, rect.h, focus);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2 + lift);
    ctx.scale(scale, scale);
    ctx.drawImage(face, -rect.w / 2 - SHADOW_PAD, -rect.h / 2 - SHADOW_PAD, rect.w + 2 * SHADOW_PAD, rect.h + 2 * SHADOW_PAD);
    const artY = -rect.h / 2 + rect.h * 0.4, sz = Math.min(rect.w * 0.36, rect.h * 0.2);
    drawEgg(ctx, 0, artY + sz * 0.15, Math.max(8, sz * 0.36), this.eggTint(sp), 0, Math.sin(this.time * 2.4 + i) * 0.05, this.dpr);
    ctx.restore();
  }

  private cardFace(o: EggOffer, cw: number, ch: number, focus: boolean): HTMLCanvasElement {
    let faces = this.faces.get(o);
    if (!faces) this.faces.set(o, (faces = []));
    const k = focus ? 1 : 0;
    let c = faces[k];
    if (c) return c;
    const d = this.dpr;
    c = canvas((cw + 2 * SHADOW_PAD) * d, (ch + 2 * SHADOW_PAD) * d);
    const ctx = ctx2d(c);
    ctx.scale(d, d);
    ctx.translate(SHADOW_PAD + cw / 2, SHADOW_PAD + ch / 2);
    const sp = speciesById(o.sp), tier = TIERS[o.tier];
    const x = -cw / 2, y = -ch / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(60,44,20,.28)';
    ctx.shadowBlur = (focus ? 13 : 8) * d;
    ctx.shadowOffsetY = (focus ? 5 : 3) * d;
    ctx.fillStyle = '#FBF7EC';
    roundRect(ctx, x, y, cw, ch, 18);
    ctx.fill();
    ctx.restore();
    // tier tint
    const tint = ctx.createLinearGradient(0, y, 0, y + ch);
    tint.addColorStop(0, rgba(tier.color, o.tier ? 0.2 : 0.1));
    tint.addColorStop(0.6, rgba(tier.color, 0.02));
    ctx.fillStyle = tint;
    roundRect(ctx, x, y, cw, ch, 18);
    ctx.fill();
    ctx.strokeStyle = focus ? '#C9952E' : rgba(tier.color, o.tier ? 0.75 : 0.35);
    ctx.lineWidth = focus ? 3 : o.tier ? 2 : 1;
    roundRect(ctx, x + 1, y + 1, cw - 2, ch - 2, 17);
    ctx.stroke();
    const pad = Math.max(10, cw * 0.07), inner = cw - pad * 2;
    // tier and source share the top row when both fit; else the source takes a second row under it
    // (German "AUSSERGEWÖHNLICH" next to "Für Blütenstaub"), and the "new" badge moves down with it
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = darken(tier.color, 0.15);
    const tierText = tier.name.toUpperCase();
    fitFont(ctx, tierText, inner, 11, 800, SANS, 8);
    const tierW = ctx.measureText(tierText).width;
    ctx.fillText(tierText, x + pad, y + pad + 9);
    ctx.textAlign = 'right';
    ctx.fillStyle = INK_SOFT;
    const src = SOURCE_TEXT[o.source], room = inner - tierW - 10;
    fitFont(ctx, src, room, 10.5, 600, SANS, 8.5);
    const row2 = ctx.measureText(src).width > room ? 13 : 0;
    if (row2) fitFont(ctx, src, inner, 10.5, 600, SANS, 8);
    ctx.fillText(src, x + cw - pad, y + pad + 9 + row2);
    // the species silhouette (the egg rocks in front of it, drawn every frame)
    const artY = y + ch * 0.4, sz = Math.min(cw * 0.36, ch * 0.2);
    const halo = ctx.createRadialGradient(0, artY, 0, 0, artY, sz * 1.6);
    halo.addColorStop(0, rgba(tier.color, 0.16));
    halo.addColorStop(1, rgba(tier.color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-sz * 1.7, artY - sz * 1.7, sz * 3.4, sz * 3.4);
    drawSilhouette(ctx, sp, 0, artY - wingMidY(sp) * sz, sz, rgba(darken(sp.look.fore, 0.2), 0.28));
    // name (two lines when one would be too small), plant
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    const nf = this.fitName(ctx, this.nameOf(sp), inner, 17, 13, 14), half = nf.lh / 2;
    const ny = y + ch * 0.7;
    this.drawName(ctx, nf, 0, ny - half);
    ctx.fillStyle = INK_SOFT;
    const on = PLANTS[sp.plant].on;
    fitFont(ctx, on, inner, 12, 500, SANS);
    ctx.fillText(on, 0, ny + 18 + half);
    // the classic recipe, and "new"
    const ry = y + ch - pad - 6, dotR = Math.max(5, Math.min(8, cw * 0.04));
    sp.classic.forEach((p, k2) => {
      const s = dotSprite(p, dotR * d);
      ctx.drawImage(s, (k2 - 1) * dotR * 2.6 - s.width / d / 2, ry - s.height / d / 2, s.width / d, s.height / d);
    });
    if (o.isNew) {
      const word = t('cards.new');
      ctx.font = `800 10px ${SANS}`;
      const tw = ctx.measureText(word).width + 12;
      ctx.fillStyle = '#C9952E';
      roundRect(ctx, x + cw - pad - tw + 4, y + pad + 18 + row2, tw, 17, 8.5);
      ctx.fill();
      ctx.fillStyle = '#FFF8E6';
      ctx.textAlign = 'center';
      ctx.fillText(word, x + cw - pad - tw / 2 + 4, y + pad + 30 + row2);
    }
    if (fontsReady()) faces[k] = c;
    return c;
  }

  // ── ŻER ─────────────────────────────────────────────────────────
  private drawFeed(sim: MothSim, r: Round, alpha: number): void {
    const { ctx } = this;
    if (!r.leaf || !r.species) return;
    const L = this.layoutFor(r);
    this.ensureLeaf(r, L);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.base!, 0, 0, this.w, this.h);
    ctx.drawImage(this.leafLayer!, 0, 0, this.w, this.h);
    // dots and treats, crisp in screen space
    const px = L.scale, d = this.dpr;
    for (const dot of r.dots) {
      if (dot.eaten) continue;
      toScreen(L, dot.x, dot.y, this.pt);
      const s = dotSprite(dot.pigment, dot.r * px * d), bob = this.opts.reducedMotion ? 0 : Math.sin(this.time * 1.6 + dot.x) * 0.6;
      ctx.drawImage(s, this.pt.x - s.width / d / 2, this.pt.y - s.height / d / 2 + bob, s.width / d, s.height / d);
    }
    const beat = 1 + 0.06 * Math.sin(this.time * 2.2);
    for (const t of r.treats) {
      if (t.eaten) continue;
      toScreen(L, t.x, t.y, this.pt);
      const s = treatSprite(t.kind, t.r * px * d), sw = (s.width / d) * beat, sh = (s.height / d) * beat;
      ctx.drawImage(s, this.pt.x - sw / 2, this.pt.y - sh / 2, sw, sh);
    }
    // the caterpillar (or its egg before it hatches)
    ctx.save();
    applyLeafTransform(ctx, L);
    if (sim.phase === 'leaf') {
      const k = clamp01(sim.phaseT / T_LEAF);
      drawEgg(ctx, r.cat.x, r.cat.y - 10 * r.leaf.k, 11 * r.leaf.k, this.eggTint(r.species), k > 0.6 ? (k - 0.6) / 0.4 : 0, Math.sin(this.time * 9) * 0.06 * k, px * d);
    } else if (sim.phase === 'feed' || sim.phase === 'spin') {
      const c = r.cat, n = this.bodyPoints(r, sim);
      const munch = c.fresh < 0.3 ? 0.5 + 0.5 * Math.sin(this.time * TAU * (2 + 6 * c.a)) : 0;
      const grow = clamp01(c.hatchT / 0.6);
      if (grow < 1) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(0.5 + 0.5 * ease.outBack(grow), 0.5 + 0.5 * ease.outBack(grow));
        ctx.translate(-c.x, -c.y);
      }
      drawCaterpillar(ctx, this.body, c.girth, r.species.larva, munch, this.time, r.silkOn ? 0.7 + 0.3 * Math.sin(this.time * 6) : 0, n, px * d);
      if (grow < 1) ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (alpha >= 1) {
      this.drawCloud();
      if (sim.phase === 'feed') {
        this.hudFeed(sim, r);
        // the chrysalis' stage, painted ahead while it eats (no hitch when it spins)
        if (r.leafBlock && r.leafBlock.clock > 1.5) this.sideStage(r, r.species);
      }
    }
  }

  /** Body points from the trail ring buffer, head first; returns how many. */
  private bodyPoints(r: Round, sim: MothSim): number {
    const c = r.cat, k = r.leaf!.k;
    const share = sim.eatenShare(r);
    const n = Math.min(this.body.length, 9 + Math.round(4 * clamp01(share / 0.32)));
    const spacing = c.girth * 0.92, step = 2 * k;
    let idx = c.trailHead, travelled = 0, filled = 0;
    let px = c.x, py = c.y;
    this.body[0].x = c.x;
    this.body[0].y = c.y;
    filled = 1;
    for (let i = 0; i < c.trailCount - 1 && filled < n; i++) {
      const prev = (idx - 1 + c.trail.length / 2) % (c.trail.length / 2);
      const x = c.trail[prev * 2], y = c.trail[prev * 2 + 1];
      travelled += Math.hypot(x - px, y - py) || step;
      px = x;
      py = y;
      idx = prev;
      if (travelled >= spacing * filled) {
        const wob = this.opts.reducedMotion ? 0 : Math.sin(this.time * 8 - filled * 0.9) * c.girth * 0.06;
        this.body[filled].x = x + wob;
        this.body[filled].y = y - wob;
        filled++;
      }
    }
    for (let i = filled; i < n; i++) {
      this.body[i].x = this.body[filled - 1].x;
      this.body[i].y = this.body[filled - 1].y;
    }
    return n;
  }

  // ── the HUD ─────────────────────────────────────────────────────
  /** A small spaced-caps label: the first of `texts` that fits `maxW` at a readable size (else the last, shrunk). */
  private label(texts: string | readonly string[], x: number, y: number, maxW: number, align: CanvasTextAlign = 'left', colour = INK_SOFT): void {
    const { ctx } = this;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = colour;
    ctx.letterSpacing = '1px';
    ctx.fillText(this.fitLabel(texts, '', maxW), x, y);
    ctx.letterSpacing = '0px';
  }

  /** Pick the first of `texts` (followed by `tail`) that fits at a readable size, and set its font. */
  private fitLabel(texts: string | readonly string[], tail: string, maxW: number): string {
    const { ctx } = this;
    if (typeof texts === 'string') {
      fitFont(ctx, texts + tail, maxW, 10.5, 800, SANS, 8);
      return texts;
    }
    for (const t of texts) if (fitFont(ctx, t + tail, maxW, 10.5, 800, SANS, 8) >= READABLE) return t;
    const last = texts[texts.length - 1];
    fitFont(ctx, last + tail, maxW, 10.5, 800, SANS, 8);
    return last;
  }

  /** A right-aligned meter label "NAME · DRIVER", the driver (what the brain does to it) in the meter's colour. */
  private meterLabel(names: readonly string[], driver: string, right: number, y: number, maxW: number, colour: string): void {
    const { ctx } = this, tail = ` · ${driver}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = '1px';
    const name = this.fitLabel(names, tail, maxW);
    ctx.fillStyle = colour;
    ctx.fillText(tail, right, y);
    const tw = ctx.measureText(tail).width;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(name, right - tw, y);
    ctx.letterSpacing = '0px';
  }

  /** The meter's fill: a gradient across a unit width, scaled to the meter when it is used. */
  private meterFill(colour: string, gold: boolean): CanvasGradient {
    const key = gold ? GOLD : colour;
    let g = this.meterFills.get(key);
    if (!g) {
      g = this.ctx.createLinearGradient(0, 0, 1, 0);
      g.addColorStop(0, gold ? '#E7B64A' : lighten(colour, 0.2));
      g.addColorStop(1, gold ? '#F7DC8A' : colour);
      this.meterFills.set(key, g);
    }
    return g;
  }

  /** A pill meter; `gold` once it is full. */
  private meter(x: number, y: number, w: number, v: number, colour: string, gold: boolean): void {
    const { ctx } = this, hgt = 8, alpha = ctx.globalAlpha;
    ctx.fillStyle = 'rgba(60,48,30,.16)';
    roundRect(ctx, x, y, w, hgt, 4);
    ctx.fill();
    if (v > 0.001) {
      roundRect(ctx, x, y, Math.max(hgt, w * clamp01(v)), hgt, 4);
      // the path is fixed in place; the fill's gradient follows the transform at fill time
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(w, 1);
      ctx.fillStyle = this.meterFill(colour, gold);
      ctx.fill();
      ctx.restore();
    }
    if (gold) {
      ctx.fillStyle = 'rgb(255,236,170)';
      ctx.globalAlpha = alpha * (0.35 + 0.25 * Math.sin(this.time * 4));
      roundRect(ctx, x - 2, y - 2, w + 4, hgt + 4, 6);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
  }

  /** Palette slots (newest right) and the species' recipe; `cap`: the largest slot radius. */
  private palette(r: Round, x: number, y: number, maxW: number, withRecipe: boolean, cap = 11): void {
    const { ctx } = this, d = this.dpr;
    let sig = r.palette.length;
    for (const p of r.palette) sig = sig * 8 + p + 1;
    if (sig !== this.lastPalette) {
      if (r.palette.length) this.slotPop[Math.min(2, r.palette.length - 1)] = 1;
      this.lastPalette = sig;
    }
    const sr = Math.min(cap, maxW / 9);
    for (let i = 0; i < 3; i++) {
      const cx = x + sr + i * sr * 2.5, p = r.palette[i];
      this.slotPop[i] = Math.max(0, this.slotPop[i] - 0.05);
      if (p === undefined) {
        ctx.strokeStyle = 'rgba(80,64,40,.35)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, y, sr * 0.85, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const s = dotSprite(p, sr * (1 + 0.25 * this.slotPop[i]) * d);
        ctx.drawImage(s, cx - s.width / d / 2, y - s.height / d / 2, s.width / d, s.height / d);
      }
    }
    if (!withRecipe || !r.species) return;
    const rx = x + sr * 2.5 * 3 + 6, rr = sr * 0.5;
    if (rx + rr * 8 > x + maxW) return;
    ctx.strokeStyle = 'rgba(80,64,40,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, y - sr);
    ctx.lineTo(rx, y + sr);
    ctx.stroke();
    const alpha = ctx.globalAlpha;
    r.species.classic.forEach((p, k) => {
      const s = dotSprite(p, rr * d), cx = rx + 8 + rr + k * rr * 2.6;
      ctx.globalAlpha = alpha * (r.palette.includes(p) ? 1 : 0.45);
      ctx.drawImage(s, cx - s.width / d / 2, y - s.height / d / 2, s.width / d, s.height / d);
    });
    ctx.globalAlpha = alpha;
  }

  private hudFeed(sim: MothSim, r: Round): void {
    const L = this.L, sp = r.species!, b = r.leafBlock!;
    const left = Math.max(0, Math.ceil(b.len - b.clock));
    const lag = b.clock < sim.lag;
    const mm = sim.provisional ?? 0;
    const cls = SIZE_CLASSES[sizeClass(sim.eatenShare(r))];
    const { ctx } = this;
    if (L.wide) {
      const x = L.info.x, y = L.info.y, w = L.info.w;
      // a name on two lines pushes the column's rows (and its panel) down by a line
      const nf = this.fitName(ctx, this.nameOf(sp), w, 22, 14, 16), dy = nf.lines.length > 1 ? nf.lh : 0;
      this.hudFrame(PANEL_FEED + dy, PANEL_FEED - 20);
      this.label(t('hud.feed', { s: left }), x, y + 14, w);
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.font = `600 ${nf.size}px ${SERIF}`;
      this.drawName(ctx, nf, x, y + (dy ? 39 : 42));
      ctx.fillStyle = INK_SOFT;
      fitFont(ctx, PLANTS[sp.plant].on, w, 13, 500, SANS);
      ctx.fillText(PLANTS[sp.plant].on, x, y + 62 + dy);
      this.label(t('hud.pigments'), x, y + 94 + dy, w);
      this.palette(r, x, y + 116 + dy, w, false);
      this.label(t('hud.classic'), x, y + 152 + dy, w);
      const d = this.dpr, alpha = ctx.globalAlpha;
      sp.classic.forEach((p, k) => {
        const s = dotSprite(p, 7 * d);
        ctx.globalAlpha = alpha * (r.palette.includes(p) ? 1 : 0.42);
        ctx.drawImage(s, x + 8 + k * 20 - s.width / d / 2, y + 170 + dy - s.height / d / 2, s.width / d, s.height / d);
      });
      ctx.globalAlpha = alpha;
      const sx = L.stats.x, sw = L.stats.w, ry = L.stats.y;
      this.label(t('hud.span'), sx + sw, ry + 14, sw, 'right');
      ctx.textAlign = 'right';
      ctx.fillStyle = INK;
      ctx.font = `600 ${Math.min(40, sw * 0.24)}px ${SERIF}`;
      ctx.fillText(`${mm}`, sx + sw - 34, ry + 54);
      ctx.font = `600 15px ${SANS}`;
      ctx.fillStyle = INK_SOFT;
      ctx.fillText('mm', sx + sw, ry + 54);
      this.classBadge(cls, sx + sw - 16, ry + 76);
      if (lag) this.label(S_WAKING, sx + sw, ry + 112, sw, 'right');
      else this.meterLabel(S_NAME, t('hud.focus'), sx + sw, ry + 112, sw, S_COLOUR);
      this.meter(sx, ry + 120, sw, b.meter, S_COLOUR, b.meter >= 1);
      const total = fmtNum(sim.score);
      this.label([t('hud.today', { mm: total }), t('hud.todayShort', { mm: total })], sx + sw, ry + 156, sw, 'right');
    } else {
      const x = L.info.x, y = L.info.y, w = L.info.w;
      this.hudFrame(PANEL_FEED, PANEL_FEED - 20);
      this.label(t('hud.feed', { s: left }), x, y + 12, w);
      const slots = this.stripName(sp, x, y, w);
      this.palette(r, x, slots.y, w, true, slots.r);
      const sx = L.stats.x, sw = L.stats.w;
      ctx.textAlign = 'right';
      ctx.fillStyle = INK;
      ctx.font = `600 24px ${SERIF}`;
      const unitW = 26;
      ctx.fillText(`${mm}`, sx + sw - unitW - 30, y + 32);
      ctx.font = `600 12px ${SANS}`;
      ctx.fillStyle = INK_SOFT;
      ctx.fillText('mm', sx + sw - 30, y + 32);
      this.classBadge(cls, sx + sw - 12, y + 25);
      if (lag) this.label(t('hud.waking'), sx + sw, y + 48, sw, 'right');
      else this.meterLabel(S_NAME, t('hud.focus'), sx + sw, y + 48, sw, S_COLOUR);
      this.meter(sx + sw * 0.25, y + 54, sw * 0.75, b.meter, S_COLOUR, b.meter >= 1);
    }
    // the very first leaf: how to steer; the first two leaves of a session, once it has woken up: what
    // the brain does here (the calibration's tips are skipped when a calibration is reused)
    const steer = sim.p.total === 0 && r.index === 1 ? 6 : 0;
    if (b.clock < steer) {
      const k = clamp01(b.clock / 0.4) * clamp01((steer - b.clock) / 0.6);
      toScreen(L, r.cat.x, r.cat.y, this.pt);
      this.hint(t('hint.steer'), this.pt.x, this.pt.y - 46, k);
    }
    const from = Math.max(sim.lag, steer) + 0.3;
    if (r.index <= 2 && b.clock > from && b.clock < from + 4.6) {
      const k = clamp01((b.clock - from) / 0.4) * clamp01((from + 4.6 - b.clock) / 0.5);
      // above the runner's signal banner (bottom centre)
      this.hint(t('hint.focus'), this.w / 2, this.h - 96, k, true);
    }
  }

  /**
   * The species name in the strip of a tall screen, under its label: one line, or two smaller ones
   * when one would be too small (the palette under it then gets smaller slots).  Returns where the
   * palette's slots go: their centre line and largest radius.
   */
  private stripName(sp: Species, x: number, y: number, w: number): { y: number; r: number } {
    const { ctx } = this, nf = this.fitName(ctx, this.nameOf(sp), w, 17, 12, 12), two = nf.lines.length > 1;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    this.drawName(ctx, nf, x, two ? y + 25 : y + 33);
    return two ? { y: y + 55, r: 8.5 } : { y: y + 52, r: 11 };
  }

  private classBadge(cls: string, cx: number, cy: number): void {
    const { ctx } = this;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${cls.length > 1 ? 10 : 12}px ${SANS}`;
    ctx.fillText(cls, cx, cy + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  /** A soft paper panel behind the HUD so it reads over any leaf (column heights on wide screens). */
  private hudFrame(left: number, right: number): void {
    const L = this.L;
    if (L.wide) {
      this.panel(L.info.x - 10, L.info.y - 4, L.info.w + 20, left);
      this.panel(L.stats.x - 10, L.stats.y - 4, L.stats.w + 20, right);
    } else this.panel(8, L.info.y - 4, this.w - 16, STRIP);
  }

  /**
   * A dark rounded bubble: one line from 14 px down to 12.5, else wrapped at 13 px (German and Swedish
   * run long).  `centred`: a hint at the bottom centre, which on a wide screen may use the room between
   * the side columns for one longer line.
   */
  private hint(text: string, x: number, y: number, alpha: number, centred = false): void {
    if (alpha <= 0.01) return;
    const { ctx } = this, base = ctx.globalAlpha, L = this.L;
    ctx.globalAlpha = base * alpha;
    const between = centred && L.wide ? Math.min(520, L.stats.x - (L.info.x + L.info.w) - 40) : 0;
    const maxW = Math.min(this.w - 40, Math.max(320, between)), key = `${text}|${maxW}`;
    let fit = this.hintFits.get(key);
    if (!fit) {
      const size = fitFont(ctx, text, maxW, 14, 600, SANS, 12.5);
      if (ctx.measureText(text).width <= maxW) fit = { size, lines: [text] };
      else {
        ctx.font = `600 13px ${SANS}`;
        fit = { size: 13, lines: wrapLines(ctx, text, Math.min(this.w - 40, Math.max(300, maxW * 0.75))) };
      }
      if (fontsReady()) this.hintFits.set(key, fit);
    }
    ctx.font = `600 ${fit.size}px ${SANS}`;
    let tw = 0;
    for (const l of fit.lines) tw = Math.max(tw, ctx.measureText(l).width);
    tw += 24;
    const th = fit.lines.length * 18 + 14;
    const bx = Math.max(12, Math.min(this.w - tw - 12, x - tw / 2)), by = Math.max(TOP + 80, y - th);
    ctx.fillStyle = 'rgba(47,58,38,.88)';
    roundRect(ctx, bx, by, tw, th, 12);
    ctx.fill();
    ctx.fillStyle = '#FBF7EC';
    ctx.textAlign = 'center';
    fit.lines.forEach((l, i) => ctx.fillText(l, bx + tw / 2, by + 21 + i * 18));
    ctx.globalAlpha = base;
  }

  // ── PRZĘDZENIE, POCZWARKA, WYLOT ───────────────────────────────
  private drawSide(sim: MothSim, r: Round): void {
    const { ctx } = this;
    const sp = r.species;
    if (!sp) return;
    const { canvas: stage, g } = this.sideStage(r, sp);
    ctx.drawImage(stage, 0, 0, this.w, this.h);
    const sway = this.opts.reducedMotion ? 0.01 * Math.sin(this.time * 0.6) : 0.045 * Math.sin(this.time * 0.8) + 0.015 * Math.sin(this.time * 1.9);
    const lean = g.kind === 'hanging' ? sway : g.tilt + sway * 0.25;
    drawStemLeaves(ctx, g, sp.plant, sway * 0.3, this.dpr);
    const rb = r.restBlock;
    if (sim.phase === 'spin') {
      this.innerWings(r);   // painted one a frame while it spins, ready when the chrysalis shows
      const k = clamp01(sim.phaseT / T_SPIN), alpha = ctx.globalAlpha;
      if (k < 0.75) {
        ctx.globalAlpha = alpha * (1 - clamp01((k - 0.55) / 0.2));
        if (g.kind === 'hanging') drawHangingLarva(ctx, g.ax, g.ay, g.len * 0.95, sp.larva, k / 0.7, this.time, this.dpr);
        else this.girdledLarva(g, sp, k / 0.7);
      }
      if (k > 0.55) {
        ctx.globalAlpha = alpha * clamp01((k - 0.55) / 0.45);
        drawChrysalis(ctx, g.ax, g.ay, g.len, this.chrysalisLook(r, sp, 0.1), lean, this.dpr);
      }
      ctx.globalAlpha = alpha;
    } else if (sim.phase === 'chrysalis' && rb) {
      drawChrysalis(ctx, g.ax, g.ay, g.len, this.chrysalisLook(r, sp, r.glass), lean, this.dpr);
      // the last round's quiet chrysalis paints the finale's glasshouse ahead
      if (r.final && rb.clock > 3) this.glasshouse(true);
    } else if (sim.phase === 'emerge') {
      this.drawEmerge(sim, r, sp, g, lean);
    }
    this.motes();
    if (sim.phase !== 'emerge') {
      this.drawCloud();
      this.hudRest(sim, r);
    }
  }

  /** The caterpillar lying along the stem, wrapping itself in a silk girdle. */
  private girdledLarva(g: SideGeom, sp: Species, wrap: number): void {
    const { ctx } = this, pts = this.larva, n = pts.length;
    const len = g.len * 0.9, dx = Math.sin(g.tilt), dy = -Math.cos(g.tilt);
    for (let i = 0; i < n; i++) {
      const k = 1 - i / (n - 1);
      pts[i].x = g.ax + dx * len * k + Math.sin(this.time * 2 + i) * 0.6;
      pts[i].y = g.ay + dy * len * k;
    }
    drawCaterpillar(ctx, pts, g.len * 0.085, sp.larva, 0, this.time, 0, n, this.dpr);
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.7 * clamp01(wrap * 1.5);
    ctx.strokeStyle = 'rgb(255,252,240)';
    ctx.lineWidth = 1.2;
    const mid = pts[Math.floor(n * 0.45)];
    ctx.beginPath();
    for (let i = 0; i < Math.floor(2 + wrap * 8); i++) {
      const ex = mid.x - g.len * 0.06, ey = mid.y + i * 1.5, rx = g.len * 0.16;
      ctx.moveTo(ex + Math.cos(-0.3) * rx, ey + Math.sin(-0.3) * rx);
      ctx.ellipse(ex, ey, rx, g.len * 0.04, -0.3, 0, TAU);
    }
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  private chrysalisLook(r: Round, sp: Species, glass: number): ChrysalisLook {
    const inner = this.innerWings(r), lk = this.look;
    lk.kind = sp.pupa.kind;
    lk.color = sp.pupa.color;
    lk.accent = sp.pupa.accent;
    lk.glass = glass;
    lk.depth = r.restBlock?.meter ?? 0;
    lk.blind = r.blind;
    lk.pale = inner.pale;
    lk.deep = inner.deep;
    lk.warm = r.last ? 1 : 0;
    return lk;
  }

  /** The wing inside the chrysalis, pale and deep: painted once per round, one a frame (no hitch). */
  private innerWings(r: Round): { pale: WingBitmap | null; deep: WingBitmap | null } {
    if (!this.inner || this.inner.round !== r) this.inner = { round: r, pale: null, deep: null };
    const inner = this.inner;
    if (!inner.pale || !inner.deep) {
      const px = Math.min(220, Math.max(60, this.h * 0.28 * this.dpr));
      const spec = {
        species: r.species!, path: r.path, box: r.leaf!.box, pigments: r.palette, bold: (r.leafBlock?.meter ?? 0) >= 1,
        radiant: false, aberration: null, female: false, bare: true, depth: inner.pale ? 1 : 0,
      };
      if (!inner.pale) inner.pale = paintWing(spec, px);
      else inner.deep = paintWing(spec, px);
    }
    return inner;
  }

  private motes(): void {
    const { ctx, w, h } = this, alpha = ctx.globalAlpha;
    ctx.fillStyle = 'rgb(255,250,228)';
    for (let i = 0; i < 14; i++) {
      const sp = 0.012 + 0.02 * hash(i * 3);
      const x = ((hash(i * 7) + this.time * sp) % 1) * w, y = (hash(i * 11) * 0.8 + 0.1 + 0.03 * Math.sin(this.time * 0.7 + i)) * h;
      ctx.globalAlpha = alpha * Math.max(0, 0.35 + 0.35 * Math.sin(this.time * 1.3 + i * 2));
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + 1.4 * hash(i * 5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  private hudRest(sim: MothSim, r: Round): void {
    const L = this.layoutFor(r), sp = r.species!, b = r.restBlock;
    const { ctx } = this;
    const left = b ? Math.max(0, Math.ceil(b.len - b.clock)) : 0;
    const lag = !!b && b.clock < sim.lag;
    const title = sim.phase === 'spin' ? t('hud.spin') : t(r.blind ? 'hud.cocoon' : 'hud.chrysalis', { s: left });
    this.hudFrame(PANEL_REST, PANEL_REST);
    const x = L.info.x, y = L.info.y, w = L.info.w;
    if (L.wide) {
      this.label(title, x, y + 14, w);
      // a second line of the name fits above the palette's label
      const nf = this.fitName(ctx, this.nameOf(sp), w, 22, 14, 16);
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      this.drawName(ctx, nf, x, nf.lines.length > 1 ? y + 39 : y + 42);
      this.label(t('hud.pigments'), x, y + 94, w);
      this.palette(r, x, y + 116, w, false);
      const sx = L.stats.x, sw = L.stats.w, ry = L.stats.y;
      this.label(t('hud.span'), sx + sw, ry + 14, sw, 'right');
      ctx.textAlign = 'right';
      ctx.fillStyle = INK;
      ctx.font = `600 ${Math.min(40, sw * 0.24)}px ${SERIF}`;
      ctx.fillText(`${sim.provisional ?? 0}`, sx + sw - 34, ry + 54);
      ctx.font = `600 15px ${SANS}`;
      ctx.fillStyle = INK_SOFT;
      ctx.fillText('mm', sx + sw, ry + 54);
      if (b && !r.blind) {
        if (lag) this.label(B_WAKING, sx + sw, ry + 112, sw, 'right');
        else this.meterLabel(B_NAME, t('hud.calm'), sx + sw, ry + 112, sw, B_COLOUR);
        this.meter(sx, ry + 120, sw, b.meter, B_COLOUR, b.meter >= 1);
      } else if (r.blind) this.label(t('hud.blind'), sx + sw, ry + 112, sw, 'right');
    } else {
      this.label(title, x, y + 12, w);
      const slots = this.stripName(sp, x, y, w);
      this.palette(r, x, slots.y, w, false, slots.r);
      const sx = L.stats.x, sw = L.stats.w;
      if (b && !r.blind) {
        if (lag) this.label(t('hud.settling'), sx + sw, y + 30, sw, 'right');
        else this.meterLabel(B_NAME, t('hud.calm'), sx + sw, y + 30, sw, B_COLOUR);
        this.meter(sx + sw * 0.25, y + 38, sw * 0.75, b.meter, B_COLOUR, b.meter >= 1);
      } else if (r.blind) this.label(t('hud.blindLong'), sx + sw, y + 30, sw, 'right');
    }
    // the first two chrysalises, and the session's first blind cocoon, say how to rest
    if (sim.phase === 'chrysalis' && b && b.clock < 6.5 && (r.index <= 2 || (r.blind && sim.counts.blindN === 0))) {
      const k = clamp01((b.clock - 3.2) / 0.4) * clamp01((6.5 - b.clock) / 0.5);
      // above the runner's signal banner (bottom centre)
      this.hint(t(r.blind ? 'hint.blind' : 'hint.rest'), this.w / 2, this.h - 96, k, true);
    }
  }

  private drawEmerge(sim: MothSim, r: Round, sp: Species, g: SideGeom, lean: number): void {
    const { ctx, w, h } = this;
    const o = r.outcome;
    if (!o) return;
    if (!this.hero || this.hero.round !== r) {
      const px = Math.min(520, Math.max(120, Math.min(w * 0.4, h * 0.3) * this.dpr));
      this.hero = { round: r, sprite: spriteOfRecord(o.rec, px), shell: rgba(lighten(sp.pupa.color, 0.35), 0.8), seam: rgba(darken(sp.pupa.color, 0.3), 0.6), card: null, cardH: CARD_BASE + CARD_ROW };
    }
    const hero = this.hero, t = sim.phaseT, still = this.opts.reducedMotion;
    // the shell clears, shivers and splits; a blind cocoon's silk first melts away around it
    if (t < 1.1) {
      const shake = still || t > 0.7 ? 0 : Math.sin(t * 60) * 0.03 * (t / 0.7), fade = 1 - clamp01((t - 0.75) / 0.35);
      const look = this.chrysalisLook(r, sp, Math.min(1, (r.blind ? 0.3 : r.glass) + t));
      look.blind = false;
      ctx.globalAlpha = fade;
      drawChrysalis(ctx, g.ax, g.ay, g.len, look, lean + shake, this.dpr);
      if (r.blind) {
        look.blind = true;
        ctx.globalAlpha = fade * (1 - clamp01((t - 0.1) / 0.5));
        drawChrysalis(ctx, g.ax, g.ay, g.len, look, lean + shake, this.dpr);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.save();
      ctx.translate(g.ax, g.ay);
      ctx.rotate(lean);
      ctx.globalAlpha = 0.8 * (1 - clamp01((t - 3.5) / 1.2));
      const dir = g.kind === 'hanging' ? 1 : -1;
      ctx.fillStyle = hero.shell;
      ctx.strokeStyle = hero.seam;
      ctx.lineWidth = 1;
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.rotate(side * 0.16);
        ctx.scale(side, dir);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(g.len * 0.26, g.len * 0.3, g.len * 0.16, g.len * 0.62);
        ctx.lineTo(g.len * 0.1, g.len * 0.5);
        ctx.lineTo(g.len * 0.05, g.len * 0.56);
        ctx.lineTo(g.len * 0.02, g.len * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (t < 0.6) return;
    // the wings unfold, a first flap, and off it goes
    const a = this.sideStage(r, sp).area;
    const size = Math.min((a.x1 - a.x0) * 0.4, (a.y1 - a.y0) * 0.3, 240);
    const grow = still ? clamp01((t - 0.6) / 0.6) : ease.outCubic(clamp01((t - 0.6) / 2.6));
    const flyK = still ? 0 : clamp01((t - 3.9) / 1.1);
    // on a short screen it settles below the card as the card comes in
    const cardH = this.emergeCardArt(r).h;
    const below = Math.max(0, Math.min(TOP + 6 + cardH + 10 + size * 0.75, a.y1 - size * 0.75) - g.cy);
    const cx = g.cx + flyK * flyK * w * 0.35, cy = g.cy + below * ease.inOutSine(clamp01((t - 1.2) / 0.8)) - flyK * h * 0.5;
    let open = 1;
    if (!still && t > 3.2) open = 0.55 + 0.45 * Math.cos((t - 3.2) * 9);
    const crumple = 1 - grow;
    ctx.globalAlpha = 0.6 * grow * (1 - flyK);
    ctx.drawImage(this.glow(), cx - size * 1.6, cy - size * 1.6, size * 3.2, size * 3.2);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.3 + 0.7 * grow, 0.45 + 0.55 * grow);
    ctx.rotate(crumple * 0.12 * Math.sin(t * 5) - flyK * 0.25);
    drawButterfly(ctx, hero.sprite, 0, -wingMidY(sp) * size, size, open * (0.7 + 0.3 * grow), 0, 0.6 + 0.4 * grow);
    ctx.restore();
    if (Math.floor(t * 10) !== Math.floor((t - 1 / 60) * 10) && grow > 0.2 && grow < 0.98 && !still) {
      this.particles.burst(cx, cy, 3, { color: o.radiant ? '#FFE9A8' : '#FFF8E0', speed: 70, spread: TAU, life: 0.9, g: -20, shape: 'spark', size: 2 });
    }
    this.emergeCard(r, clamp01((t - 1.5) / 0.5));
  }

  /** The emergence card's picture and height (painted once per butterfly once the fonts are in). */
  private emergeCardArt(r: Round): { card: HTMLCanvasElement; h: number } {
    const hero = this.hero!;
    if (hero.card) return { card: hero.card, h: hero.cardH };
    const art = this.paintEmergeCard(r, Math.min(this.w - 24, 420));
    hero.cardH = art.h;
    if (fontsReady()) hero.card = art.card;
    return art;
  }

  /** The emergence card (species, size, its tags), sliding in with `k`. */
  private emergeCard(r: Round, k: number): void {
    if (!r.outcome || !this.hero || k <= 0) return;
    const { ctx, w } = this, d = this.dpr;
    const cw = Math.min(w - 24, 420), x = (w - cw) / 2, y = TOP + 6;
    const { card } = this.emergeCardArt(r);
    ctx.globalAlpha = k;
    ctx.drawImage(card, x - SHADOW_PAD, y - SHADOW_PAD + (1 - k) * -10, card.width / d, card.height / d);
    ctx.globalAlpha = 1;
  }

  /**
   * The card: the name, its size, and its tags, the special ones gold, in at most two rows (German and
   * Swedish tags run long); a tag that fits neither row stays off, and the least important come last.
   */
  private paintEmergeCard(r: Round, cw: number): { card: HTMLCanvasElement; h: number } {
    const o = r.outcome!, tags: { text: string; special: boolean }[] = [];
    const tag = (text: string, special = false) => tags.push({ text, special });
    if (o.isNew) tag(t('tag.new'), true);
    if (o.radiant) tag(t('tag.radiant'), true);
    if (o.aberration) tag(t('tag.aberration'), true);
    // the blind cocoon's result, revealed only now
    if (o.blind && o.deep) tag(t('tag.blind'), true);
    if (o.classic) tag(t('tag.classic'));
    if (o.record) tag(t('tag.record'));
    if (o.silk) tag(t('tag.silk'));
    if (o.daily) tag(t('tag.daily'));
    // rows of tags: [first tag, past the last, total width]
    const m = this.ctx, room = cw - 24, rows: [number, number, number][] = [];
    m.save();
    m.font = `700 11.5px ${SANS}`;
    const widths = tags.map(tg => m.measureText(tg.text).width + 18);
    m.restore();
    for (let i = 0; i < tags.length; i++) {
      const row = rows[rows.length - 1];
      if (row && row[2] + 6 + widths[i] <= room) {
        row[1] = i + 1;
        row[2] += 6 + widths[i];
      } else if (rows.length < 2 && widths[i] <= room) rows.push([i, i + 1, widths[i]]);
      else break;
    }
    const ch = CARD_BASE + rows.length * CARD_ROW, d = this.dpr;
    const c = canvas((cw + 2 * SHADOW_PAD) * d, (ch + 2 * SHADOW_PAD) * d), p = ctx2d(c);
    p.scale(d, d);
    p.translate(SHADOW_PAD, SHADOW_PAD);
    p.save();
    p.shadowColor = 'rgba(60,44,20,.2)';
    p.shadowBlur = 9 * d;
    p.fillStyle = 'rgba(251,247,236,.94)';
    roundRect(p, 0, 0, cw, ch, 18);
    p.fill();
    p.restore();
    p.textAlign = 'center';
    p.fillStyle = INK;
    const name = this.nameOf(o.species);
    fitFont(p, name, cw - 32, 24, 600, SERIF, 14);
    p.fillText(name, cw / 2, 32);
    p.fillStyle = INK_SOFT;
    const sub = t(o.pollen ? 'out.subPollen' : 'out.sub', { mm: o.rec.mm, cls: o.cls, pollen: o.pollen });
    fitFont(p, sub, cw - 32, 13, 600, SANS);
    p.fillText(sub, cw / 2, 54);
    p.font = `700 11.5px ${SANS}`;
    rows.forEach(([from, to, total], row) => {
      let tx = cw / 2 - total / 2;
      const ty = 66 + row * CARD_ROW;
      for (let i = from; i < to; i++) {
        const { text, special } = tags[i];
        p.fillStyle = special ? '#C9952E' : 'rgba(47,58,38,.12)';
        roundRect(p, tx, ty, widths[i], 20, 10);
        p.fill();
        p.fillStyle = special ? '#FFF8E6' : INK;
        p.fillText(text, tx + widths[i] / 2, ty + 14);
        tx += widths[i] + 6;
      }
    });
    return { card: c, h: ch };
  }

  // ── the finale: today's butterflies over the glasshouse ────────
  private drawFinale(sim: MothSim): void {
    const { ctx, w, h } = this;
    ctx.drawImage(this.glasshouse(true), 0, 0, w, h);
    const list = sim.done;
    const size = Math.min(w, h) * 0.07, px = Math.min(200, size * 2 * this.dpr);
    if (px !== this.finalePx) {
      this.finale.length = 0;
      this.finalePx = px;
    }
    // a couple of wings a frame: the butterflies join the spiral as they are ready
    for (let k = 0; k < 2 && this.finale.length < list.length; k++) this.finale.push(spriteOfRecord(list[this.finale.length].rec, px));
    for (let i = 0; i < this.finale.length; i++) {
      const k = (this.time * 0.05 + i / Math.max(1, list.length)) % 1;
      const ang = k * TAU * 1.5 + i;
      const x = w / 2 + Math.cos(ang) * w * 0.28 * (1 - k * 0.4), y = h * (0.9 - k * 0.75);
      const flap = this.opts.reducedMotion ? 0.75 + 0.25 * Math.abs(Math.cos(this.time * 1.5 + i)) : 0.35 + 0.65 * Math.abs(Math.cos(this.time * 7 + i));
      drawButterfly(ctx, this.finale[i], x, y, size * (0.8 + 0.4 * (1 - k)), flap, Math.sin(ang) * 0.3, clamp01(k * 6) * clamp01((1 - k) * 5));
    }
    const mm = list.reduce((s, o) => s + o.rec.mm, 0);
    const line = list.length ? t('finale.line', { n: list.length, mm: fmtNum(mm) }) : t('finale.none');
    const big = Math.min(46, Math.max(26, w * 0.05)), ty = Math.max(TOP + big + 20, h * 0.26);
    const gr = Math.min(w * 0.42, 380);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(this.glow(), w / 2 - gr, ty - big * 0.2 - gr * 0.42, gr * 2, gr * 2 * 0.42);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4A2E14';
    fitFont(ctx, GOLDEN_HOUR, w - 40, big, 600, SERIF);
    ctx.fillText(GOLDEN_HOUR, w / 2, ty);
    ctx.fillStyle = '#7A5230';
    fitFont(ctx, line, w - 40, Math.max(14, big * 0.4), 600, SANS);
    ctx.fillText(line, w / 2, ty + big * 0.75);
  }
}
