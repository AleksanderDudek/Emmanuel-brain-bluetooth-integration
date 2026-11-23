/**
 * Drzewo nad wodą's play view (DESIGN §18): a cross-section at dusk — a soft sky with land and far hills at the
 * sides, the ground line, the earth's layers (browns and ochres) with their stones, and deep below a hidden stream of
 * cool cyan.  The figure of light (kit/figure.ts, seated on a smooth stone or standing) rests on the ground; while
 * focus is held, roots of light grow from its soles down between the stones to the stream; water rises through them
 * into the figure; a tree of light grows through it — the trunk along the body, the branches from the shoulders, the
 * arms and over the head, a crown of leaves in the season's colours — and the fruits of the Spirit ripen on the
 * crown's arc as jewels of light.  Wind and heat (or frost) pass; the tree stands.
 *
 * Every still part is baked once per size into an offscreen layer in world coordinates (the sky and the soil, the
 * roots up to their growth, the figure, the trunk and branches, the leaves), so a frame composes layers and draws a few
 * dozen small things — no shadowBlur, no filters.  The camera only pans (layout.ts `camFor`), so layers stay crisp.
 */
import { figurePath, footShapes, polygon, spline, type P } from '../kit/figure';
import { approach, clamp, ease } from '../kit/juice';
import type { Insets } from '../kit/types';
import { FRUIT, FRUITS, LAYER, type FruitId, type Posture, type Season } from './content';
import { drawHud, hudOn, type HudState } from './hud';
import { camFor, crownRect, inRect, layout, pickerParts, previewLayout, sx, sy, tapTargets, type Layout } from './layout';
import { GOLD, GOLD_HI, LEAF, TREE, WATER, drawFruit, glow, hash, layer, mix, rgbaPrefix, ribbon, type Layer } from './paint';
import { RULES } from './rules';
import type { DrzewoSim, SimEvent } from './sim';
import {
  BOTTOM, DEPTH, FRUIT_R, HALF_W, SEAT, SEATED_OUTLINE, STREAM_H, branchesFor, crownOf, dropOf, fruitPlace, grownTo, layerBands, leavesFor, rootsFor,
  seatedHands, stonesFor, tipsAt, trunkFor, worldTop, type Branch, type Framing, type Leaf, type Root, type Stone,
} from './tree';

const TAU = Math.PI * 2;

/** The sky by season: top, middle, the horizon's glow, the land. */
const SKY: Readonly<Record<Season, { top: string; mid: string; low: string; glow: string; land: string; grass: string }>> = {
  spring: { top: '#0e1a33', mid: '#2a4673', low: '#7d8fb8', glow: '#f2c6c0', land: '#1f3328', grass: '#8fd36a' },
  summer: { top: '#0c1a30', mid: '#24456e', low: '#6f93b5', glow: '#f3d79a', land: '#1c3424', grass: '#6fbf5a' },
  autumn: { top: '#121528', mid: '#3a3a62', low: '#8d7a8e', glow: '#f2b878', land: '#2e2a22', grass: '#b8a050' },
  winter: { top: '#0b1224', mid: '#25385a', low: '#7f93b0', glow: '#d9e4f2', land: '#2a3240', grass: '#e8eef6' },
};

/** The leaves' colours by season (winter: bare). */
const LEAVES: Readonly<Record<Season, readonly string[]>> = {
  spring: ['#c8f09a', '#a9e27e', '#dcf7b4'],
  summer: ['#7fcf62', '#9fdc72', '#5fb752'],
  autumn: ['#f2b33d', '#e8822e', '#d9583c', '#efcc58'],
  winter: [],
};

/** What a ripe fruit's flash and the floating words need. */
interface Burst { x: number; y: number; t: number; color: string }
interface Drop { root: number; u: number; v: number; crown: boolean }

export class DrzewoView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private w = 1;
  private h = 1;
  /** the camera (screen y of the world's y = 0), eased toward the framing's */
  private oy = 0;
  private oyInit = false;
  private time = 0;
  private sway = 0;
  private seasonK = 0;
  private seasonNow: Season = 'summer';
  // the world's things
  private stones: Stone[] = [];
  private roots: Root[] = [];
  private branches: Branch[] = [];
  private trunk: Branch | null = null;
  private leaves: Leaf[] = [];
  private layersKey = '';
  // the baked layers
  private bg: { c: Layer; y0: number; key: string } | null = null;
  private rootL: { c: Layer; g: number; wet: boolean; key: string } | null = null;
  private fig: { c: Layer; key: string; x0: number; y0: number } | null = null;
  private treeL: { c: Layer; g: number; key: string } | null = null;
  private leafL: { c: Layer; g: number; key: string } | null = null;
  // the motion
  private readonly bursts: Burst[] = [];
  private readonly drops: Drop[] = [];
  private dropAcc = 0;
  private flakes: { x: number; y: number; s: number; v: number }[] = [];
  private wet = false;
  private ring = 0;
  private ringXY = { x: 0, y: 0 };
  private hoverFruit: FruitId | null = null;
  /** what the hud draws beside the sim (the caption eased in and out) */
  readonly hud: HudState = { capK: 0, capText: '', bandGlow: 0 };

  constructor(ctx: CanvasRenderingContext2D | null, private readonly opts: { reducedMotion: boolean; touch: boolean; seed: number; preview?: boolean }) {
    this.ctx = ctx;
    this.L = layout(360, 640, undefined, opts.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = this.opts.preview ? previewLayout(w, h) : layout(w, h, ins, this.opts.touch);
    this.bg = null;
    this.rootL = null;
    this.fig = null;
    this.treeL = null;
    this.leafL = null;
    this.oyInit = false;
  }

  /** The world's things for the session's layers and posture (rebuilt when they change). */
  private world(sim: DrzewoSim): void {
    const key = `${sim.plan.layers}|${sim.posture}`;
    if (key === this.layersKey) return;
    const counts = sim.layers.map(l => LAYER[l].stones);
    if (!this.stones.length || this.layersKey.split('|')[0] !== String(sim.plan.layers)) {
      this.stones = stonesFor(counts, this.opts.seed);
      this.roots = rootsFor(this.opts.seed, this.stones);
      this.rootL = null;
      this.bg = null;
    }
    this.trunk = trunkFor(sim.posture);
    this.branches = branchesFor(sim.posture);
    this.leaves = leavesFor(sim.posture);
    this.fig = null;
    this.treeL = null;
    this.leafL = null;
    this.layersKey = key;
  }

  /** The framing the moment asks for. */
  framingOf(sim: DrzewoSim): Framing {
    if (!sim.started || sim.phase !== 'play') return 'tree';
    const b = sim.block;
    if (b.kind === 'rest') return b.rest === 'water' ? 'water' : b.rest === 'soil' ? 'roots' : 'tree';
    if (b.kind === 'push') return sim.kind === 'roots' ? 'roots' : 'tree';
    return 'tree';
  }

  get camY(): number { return this.oy; }

  on(e: SimEvent, sim: DrzewoSim): void {
    switch (e.type) {
      case 'ripe': {
        const i = FRUITS.indexOf(e.fruit);
        const slot = sim.hang.filter(h => h.fruit === e.fruit).length - 1;
        const [x, y] = fruitPlace(i, slot, sim.posture);
        this.bursts.push({ x, y, t: 0, color: FRUIT[e.fruit].color });
        break;
      }
      case 'stream':
        this.bursts.push({ x: 0, y: 1 + DEPTH + STREAM_H / 2, t: 0, color: WATER });
        break;
      case 'crown':
        this.bursts.push({ x: 0, y: crownOf(sim.posture).cy, t: 0, color: LEAF });
        break;
      case 'blockStart':
        if (e.block.rest === 'water') this.wet = true;
        break;
      default: break;
    }
  }

  /** A tap: the ripe fruit nearest the finger (on the crown), or null. */
  fruitAt(sim: DrzewoSim, x: number, y: number): FruitId | null {
    const L = this.L;
    const ripe = sim.ripeOnTree;
    if (!ripe.length) return null;
    let best: FruitId | null = null, bd = Infinity;
    for (const hng of ripe) {
      const [fx, fy] = fruitPlace(FRUITS.indexOf(hng.fruit), hng.slot, sim.posture);
      const d = Math.hypot(sx(L, fx) - x, sy(L, this.oy, fy) - y);
      if (d < bd) { bd = d; best = hng.fruit; }
    }
    const cr = crownRect(L, this.oy, sim.posture);
    const near = Math.max(40, FRUIT_R * L.H * 3);
    return bd <= near || (cr && inRect(cr, x, y)) ? best : null;
  }

  /** A desktop's mouse over a fruit: it brightens. */
  hover(sim: DrzewoSim, x: number, y: number): FruitId | null {
    this.hoverFruit = this.fruitAt(sim, x, y);
    return this.hoverFruit;
  }

  touch(x: number, y: number): void {
    this.ring = 1;
    this.ringXY = { x, y };
  }

  /** The controls tappable now (layout.ts `tapTargets`). */
  targets(sim: DrzewoSim) {
    const L = this.L;
    return tapTargets(L, {
      story: sim.story ? L.story : null,
      picker: sim.picker,
      card: !!sim.card,
      crown: sim.ripeOnTree.length && !sim.story ? crownRect(L, this.oy, sim.posture) : null,
      menu: sim.started && sim.phase !== 'done',
    });
  }

  /** Where a coach mark points. */
  pointAt(at: 'roots' | 'chest' | 'crown' | 'menu', sim: DrzewoSim): { x: number; y: number } | null {
    const L = this.L, d = dropOf(sim.posture);
    if (at === 'menu') return { x: L.menu.x + L.menu.w / 2, y: L.menu.y };
    if (at === 'roots') return { x: L.cx, y: Math.max(L.stage.y + 30, sy(L, this.oy, 1.08)) };
    if (at === 'chest') return { x: L.cx, y: sy(L, this.oy, 0.3 + d) };
    return { x: L.cx, y: Math.max(L.stage.y + 20, sy(L, this.oy, crownOf(sim.posture).cy - 0.1)) };
  }

  /** The picker's buttons: which one a tap hits (or null). */
  pickerHit(x: number, y: number): { what: 'posture' | 'season' | 'close' | 'card' | 'out'; i: number } {
    const p = pickerParts(this.L);
    for (let i = 0; i < p.posture.length; i++) if (inRect(p.posture[i], x, y)) return { what: 'posture', i };
    for (let i = 0; i < p.season.length; i++) if (inRect(p.season[i], x, y)) return { what: 'season', i };
    if (inRect(p.close, x, y)) return { what: 'close', i: 0 };
    return inRect(p.card, x, y) ? { what: 'card', i: 0 } : { what: 'out', i: 0 };
  }

  // ── the frame ──────────────────────────────────────────────────
  update(dt: number, sim: DrzewoSim): void {
    this.time += dt;
    this.world(sim);
    const L = this.L;
    const want = camFor(L, this.framingOf(sim), sim.posture);
    if (!this.oyInit || this.opts.reducedMotion) {
      this.oy = want;
      this.oyInit = true;
    } else this.oy = approach(this.oy, want, dt, 0.9);
    // the season, eased (a turn of the year fades over 3 s)
    const s = sim.season;
    if (s !== this.seasonNow) {
      this.seasonNow = s;
      this.seasonK = this.seasonK > 0 ? 1 - this.seasonK : 0;
      this.leafL = null;
      this.bg = null;
    }
    this.seasonK = Math.min(1, this.seasonK + dt / 3);
    // the wind: a gentle sway, gusts in the wind's rest
    const windK = sim.restKind === 'wind' ? ease.inOutSine(clamp(Math.min(sim.restK * 3, (1 - sim.restK) * 4))) : 0;
    const base = this.opts.reducedMotion ? 0 : 0.006 * Math.sin(this.time * 0.7);
    const gust = this.opts.reducedMotion ? 0 : windK * (0.03 + 0.02 * Math.sin(this.time * 1.7) + 0.015 * Math.sin(this.time * 4.3));
    this.sway = base + gust;
    // water rising through the roots: into the figure in the water's rest; in every later rest, slowly, on up the
    // trunk to the crown (the lobby's line: "the water rises from the roots to the fruit")
    const rate = sim.restKind === 'water' ? 7 : sim.restBlock && this.wet && sim.restKind !== 'valve' ? 2 : 0;
    if (rate > 0 && !this.opts.reducedMotion) {
      this.dropAcc += dt * rate;
      while (this.dropAcc >= 1) {
        this.dropAcc--;
        const mains = this.roots.filter(r => r.order === 0);
        if (mains.length) this.drops.push({ root: Math.floor(Math.random() * mains.length), u: 0, v: 0.25 + Math.random() * 0.15, crown: sim.restKind !== 'water' });
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.u += dt * d.v;
      if (d.u >= 1.35) this.drops.splice(i, 1);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].t += dt;
      if (this.bursts[i].t > 1.6) this.bursts.splice(i, 1);
    }
    this.ring = Math.max(0, this.ring - dt * 2.2);
    // snow in winter (and frost in the wind)
    if (this.seasonNow === 'winter' && !this.opts.reducedMotion) {
      if (this.flakes.length < 46) this.flakes.push({ x: Math.random() * this.w, y: -4, s: 1 + Math.random() * 1.6, v: 12 + Math.random() * 18 });
      for (const f of this.flakes) { f.y += f.v * dt; f.x += Math.sin(this.time + f.s * 3) * 6 * dt + gust * 300 * dt; }
      this.flakes = this.flakes.filter(f => f.y < this.h + 4);
    } else if (this.flakes.length) this.flakes = [];
    // the caption eases in and out with the narrator's line
    const line = sim.talk.line;
    if (line) this.hud.capText = line.text;
    this.hud.capK = approach(this.hud.capK, line ? 1 : 0, dt, 0.25);
    this.hud.bandGlow = sim.reshow > 0 ? Math.min(1, sim.reshow / RULES.reshowSec) : 0;
    this.hud.time = this.time;
    this.hud.still = this.opts.reducedMotion;
  }

  draw(sim: DrzewoSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.world(sim);
    const oy = this.oy;
    this.drawBackground(ctx, sim, oy);
    this.drawStream(ctx, sim, oy);
    this.drawRoots(ctx, sim, oy);
    this.drawTree(ctx, sim, oy);
    this.drawFigure(ctx, sim, oy);
    this.drawLight(ctx, sim, oy);
    this.drawCrown(ctx, sim, oy);
    this.drawFruits(ctx, sim, oy);
    this.drawGauge(ctx, sim, oy);
    this.drawWeather(ctx, sim, oy);
    this.drawBursts(ctx, oy);
    if (sim.blind) {
      ctx.fillStyle = 'rgba(4,6,14,.62)';
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.ring > 0) {
      ctx.strokeStyle = `rgba(255,241,201,${0.6 * this.ring})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.ringXY.x, this.ringXY.y, 10 + (1 - this.ring) * 26, 0, TAU);
      ctx.stroke();
    }
    if (hudOn(sim)) drawHud(ctx, L, sim, this.hud);
  }

  // ── the background: sky, land, soil, stones, the stream's bed ─
  private bgRange(sim: DrzewoSim): { y0: number; y1: number } {
    const L = this.L;
    let y0 = Infinity, y1 = -Infinity;
    for (const f of ['whole', 'tree', 'roots', 'water'] as const) {
      const oy = camFor(L, f, sim.posture);
      y0 = Math.min(y0, -oy / L.H);
      y1 = Math.max(y1, (this.h - oy) / L.H);
    }
    return { y0: Math.min(y0, worldTop(sim.posture)) - 0.02, y1: Math.max(y1, BOTTOM) + 0.02 };
  }

  private bakeBg(sim: DrzewoSim): void {
    const L = this.L, H = L.H;
    const season = this.seasonNow;
    const key = `${this.w}x${this.h}|${H}|${season}|${sim.plan.layers}|${sim.posture}`;
    if (this.bg?.key === key) return;
    const range = this.bgRange(sim);
    const hpx = (range.y1 - range.y0) * H;
    const B = layer(this.w, hpx, this.dpr);
    if (!B) { this.bg = null; return; }
    const c = B.ctx, w = this.w;
    const Y = (y: number) => (y - range.y0) * H;
    const X = (x: number) => sx(L, x);
    const sk = SKY[season];
    // the sky: deep at the top, the dusk glowing at the horizon
    const g = c.createLinearGradient(0, Y(range.y0), 0, Y(1));
    g.addColorStop(0, sk.top);
    g.addColorStop(clamp((Y(-0.2) - Y(range.y0)) / Math.max(1, Y(1) - Y(range.y0))), sk.mid);
    g.addColorStop(clamp((Y(0.75) - Y(range.y0)) / Math.max(1, Y(1) - Y(range.y0))), sk.low);
    g.addColorStop(1, sk.glow);
    c.fillStyle = g;
    c.fillRect(0, 0, w, Y(1) + 2);
    // a few stars high up
    for (let i = 0; i < 40; i++) {
      const x = hash(i * 3.1) * w, y = Y(range.y0) + hash(i * 7.3) * (Y(-0.1) - Y(range.y0));
      if (y > Y(-0.1)) continue;
      c.fillStyle = `rgba(255,250,235,${0.25 + 0.5 * hash(i * 1.7)})`;
      c.fillRect(x, y, 1.2, 1.2);
    }
    // the dusk's glow behind the land
    const hg = c.createRadialGradient(X(0), Y(1), 0, X(0), Y(1), Math.max(w, H) * 0.9);
    hg.addColorStop(0, `${rgbaPrefix(sk.glow)}.42)`);
    hg.addColorStop(1, `${rgbaPrefix(sk.glow)}0)`);
    c.fillStyle = hg;
    c.fillRect(0, Y(range.y0), w, Y(1) - Y(range.y0));
    // far hills and their trees at the sides (a wide screen shows a whole landscape)
    for (const [k, col, amp, base] of [[0, mix(sk.land, sk.low, 0.45), 0.07, 0.93], [1, sk.land, 0.05, 0.975]] as const) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, Y(1) + 1);
      for (let x = 0; x <= w; x += 8) {
        const u = x / Math.max(1, H);
        const y = base - amp * (0.5 + 0.5 * Math.sin(u * 2.1 + k * 2 + 0.6) * Math.cos(u * 0.9 + k));
        c.lineTo(x, Y(y));
      }
      c.lineTo(w, Y(1) + 1);
      c.closePath();
      c.fill();
    }
    for (let i = 0; i < 18; i++) {
      const u = hash(i * 13.7);
      const x = u * w;
      if (Math.abs(x - L.cx) < HALF_W * H * 1.05) continue;
      const hh = (0.04 + hash(i * 2.9) * 0.05) * H;
      const y = Y(0.975 - 0.02 * hash(i * 5.3));
      c.fillStyle = mix(sk.land, '#000000', 0.25);
      c.beginPath();
      c.ellipse(x, y - hh * 0.65, hh * 0.38, hh * 0.6, 0, 0, TAU);
      c.fill();
      c.fillRect(x - 0.6, y - hh * 0.2, 1.2, hh * 0.25);
    }
    // the soil's layers
    const bands = layerBands(sim.plan.layers);
    sim.layers.forEach((id, i) => {
      const b = bands[i], Lr = LAYER[id];
      const lg = c.createLinearGradient(0, Y(b.y0), 0, Y(b.y1));
      lg.addColorStop(0, Lr.top);
      lg.addColorStop(1, Lr.bottom);
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(0, Y(b.y0));
      for (let x = 0; x <= w; x += 10) c.lineTo(x, Y(b.y0) + (i ? Math.sin(x / (H * 0.09) + i * 1.7) * H * 0.006 : 0));
      c.lineTo(w, Y(b.y1) + 2);
      c.lineTo(0, Y(b.y1) + 2);
      c.closePath();
      c.fill();
      // its grain: specks
      const n = Math.round((w * (b.y1 - b.y0) * H) / 260);
      for (let k = 0; k < n; k++) {
        const x = hash(i * 1000 + k * 3.3) * w, y = Y(b.y0) + hash(i * 1000 + k * 7.1) * (b.y1 - b.y0) * H;
        c.fillStyle = hash(k * 1.3 + i) < 0.5 ? 'rgba(255,240,210,.05)' : 'rgba(0,0,0,.09)';
        c.fillRect(x, y, 1.5, 1.5);
      }
    });
    // the stones, lit a little from above
    for (const s of this.stones) {
      const st = LAYER[sim.layers[Math.min(s.layer, sim.layers.length - 1)]].stone;
      c.save();
      c.translate(X(s.x), Y(s.y));
      c.rotate(s.a);
      const sg = c.createRadialGradient(-s.rx * H * 0.35, -s.ry * H * 0.45, 0, 0, 0, s.rx * H * 1.2);
      sg.addColorStop(0, mix(st, '#ffffff', 0.25));
      sg.addColorStop(1, mix(st, '#000000', 0.35));
      c.fillStyle = sg;
      c.beginPath();
      c.ellipse(0, 0, s.rx * H, s.ry * H, 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,.28)';
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }
    // the stream's bed and the rock under it (the water itself is drawn live)
    const s0 = Y(1 + DEPTH), s1 = Y(1 + DEPTH + STREAM_H);
    const wg = c.createLinearGradient(0, s0, 0, s1);
    wg.addColorStop(0, '#0d3b48');
    wg.addColorStop(0.5, '#155a6a');
    wg.addColorStop(1, '#0b2e38');
    c.fillStyle = wg;
    c.fillRect(0, s0, w, s1 - s0);
    c.fillStyle = '#1c1a1a';
    c.fillRect(0, s1, w, hpx - s1);
    for (let k = 0; k < 30; k++) {
      c.fillStyle = 'rgba(255,255,255,.04)';
      c.beginPath();
      c.ellipse(hash(k * 9.1) * w, s1 + 4 + hash(k * 4.2) * (hpx - s1), 6 + hash(k) * 12, 3 + hash(k * 2) * 4, 0, 0, TAU);
      c.fill();
    }
    // the ground line: grass (or snow), the season's colour
    c.fillStyle = mix(sk.land, '#000000', 0.1);
    c.fillRect(0, Y(1) - 1, w, Math.max(2, H * 0.012));
    c.strokeStyle = sk.grass;
    c.lineWidth = 1;
    c.globalAlpha = season === 'winter' ? 0.9 : 0.7;
    for (let x = 0; x < w; x += 3) {
      const hh = (0.008 + 0.012 * hash(x * 0.37)) * H;
      c.beginPath();
      c.moveTo(x, Y(1));
      c.lineTo(x + (hash(x) - 0.5) * 3, Y(1) - hh);
      c.stroke();
    }
    c.globalAlpha = 1;
    if (season === 'winter') {
      c.fillStyle = 'rgba(240,246,255,.85)';
      c.fillRect(0, Y(1) - H * 0.008, w, H * 0.012);
    }
    this.bg = { c: B.c, y0: range.y0, key };
  }

  private drawBackground(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    this.bakeBg(sim);
    const top = SKY[this.seasonNow].top;
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, this.w, this.h);
    if (this.bg) {
      const y = oy + this.bg.y0 * this.L.H, hh = this.bg.c.height / this.dpr;
      ctx.drawImage(this.bg.c, 0, y, this.w, hh);
      if (y + hh < this.h) {
        ctx.fillStyle = '#1c1a1a';
        ctx.fillRect(0, y + hh - 1, this.w, this.h - y - hh + 1);
      }
    }
  }

  /** The hidden stream: dim until the roots reach it, then lit, its glints running. */
  private drawStream(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    const L = this.L, H = L.H;
    const y0 = sy(L, oy, 1 + DEPTH), y1 = sy(L, oy, 1 + DEPTH + STREAM_H);
    if (y0 > this.h || y1 < 0) return;
    const lit = sim.streamReached ? 1 : 0.12 + 0.28 * sim.rootG;
    ctx.fillStyle = `rgba(80,210,230,${0.12 + 0.28 * lit})`;
    ctx.fillRect(0, y0 + (y1 - y0) * 0.2, this.w, (y1 - y0) * 0.6);
    const n = Math.round(this.w / 40);
    const speed = this.opts.reducedMotion ? 0 : 26;
    for (let i = 0; i < n; i++) {
      const x = ((hash(i) * this.w + this.time * speed * (0.6 + hash(i * 3))) % (this.w + 40)) - 20;
      const y = y0 + (y1 - y0) * (0.3 + 0.4 * hash(i * 5));
      ctx.fillStyle = `rgba(200,250,255,${(0.15 + 0.4 * lit) * (0.5 + 0.5 * Math.sin(this.time * 2 + i))})`;
      ctx.fillRect(x, y, 8 + 10 * hash(i * 2), 1.2);
    }
    if (sim.streamReached) {
      for (const r of this.roots) if (r.order === 0) {
        const e = r.pts[r.pts.length - 1];
        glow(ctx, WATER, sx(L, e[0]), sy(L, oy, e[1]), H * 0.06, 0.45);
      }
    }
  }

  // ── the roots ──────────────────────────────────────────────────
  private bakeRoots(sim: DrzewoSim): void {
    const L = this.L, H = L.H;
    const g = sim.rootG;
    const key = `${this.w}|${H}|${this.layersKey}`;
    if (this.rootL && this.rootL.key === key && Math.abs(this.rootL.g - g) < 0.003 && this.rootL.wet === this.wet && (g < 1 || this.rootL.g >= 1)) return;
    const y0 = 0.97;
    const B = this.rootL?.key === key ? { c: this.rootL.c, ctx: this.rootL.c.getContext('2d')! } : layer(this.w, (BOTTOM - y0) * H, this.dpr);
    if (!B) return;
    const c = B.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, (BOTTOM - y0) * H + 2);
    const toP = (p: P): [number, number] => [sx(L, p[0]), (p[1] - y0) * H];
    for (const r of this.roots) {
      const at = grownTo(r, g);
      if (!at) continue;
      const pts = r.pts.slice(0, at.i + 1).map(toP);
      if (at.i < r.pts.length - 1 && at.k > 0) {
        const a = r.pts[at.i], b = r.pts[at.i + 1];
        pts.push(toP([a[0] + (b[0] - a[0]) * at.k, a[1] + (b[1] - a[1]) * at.k]));
      }
      if (pts.length < 2) continue;
      const share = (pts.length - 1) / Math.max(1, r.pts.length - 1);
      const w1 = r.w0 + (r.w1 - r.w0) * share;
      // a soft halo, the root of light, a bright core
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = r.order === 0 ? 'rgba(255,226,150,.12)' : 'rgba(255,226,150,.08)';
      c.lineWidth = Math.max(2, r.w0 * H * 3.2);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = r.order === 0 ? 'rgba(246,232,170,.92)' : r.order === 1 ? 'rgba(238,224,160,.8)' : 'rgba(230,214,150,.65)';
      ribbon(c, pts, Math.max(1.2, r.w0 * H), Math.max(0.6, w1 * H));
      c.fill();
      if (this.wet && r.order < 2) {
        c.strokeStyle = r.order === 0 ? 'rgba(150,240,255,.75)' : 'rgba(150,240,255,.45)';
        c.lineWidth = Math.max(0.8, r.w0 * H * 0.32);
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      }
    }
    this.rootL = { c: B.c, g, wet: this.wet, key };
  }

  private drawRoots(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    const L = this.L, H = L.H;
    this.bakeRoots(sim);
    if (this.rootL) ctx.drawImage(this.rootL.c, 0, sy(L, oy, 0.97), this.w, this.rootL.c.height / this.dpr);
    // the growing tips: gold while they grow
    if (sim.kind === 'roots' && sim.rootG < 1 && sim.pushBlock && !sim.blind) {
      const tips = tipsAt(this.roots, sim.rootG);
      const k = sim.goldOn ? 1 : 0.35;
      for (const [x, y] of tips.slice(0, 24)) glow(ctx, sim.goldOn ? GOLD : '#e9dcc0', sx(L, x), sy(L, oy, y), H * 0.022, 0.5 * k);
    }
    // water rising through the roots into the figure (the water's rest)
    if (this.drops.length) {
      const mains = this.roots.filter(r => r.order === 0);
      const heart = 0.3 + dropOf(sim.posture), crownY = crownOf(sim.posture).cy;
      for (const d of this.drops) {
        const top = d.crown ? crownY : heart;
        const r = mains[d.root % mains.length];
        if (!r) continue;
        let p: P;
        if (d.u <= 1) {
          const i = Math.max(0, Math.min(r.pts.length - 1, Math.round((1 - d.u) * (r.pts.length - 1))));
          p = r.pts[i];
        } else {
          // on up the trunk to the heart
          const k = (d.u - 1) / 0.35;
          p = [r.pts[0][0] * (1 - k), 1 - k * (1 - top)];
        }
        glow(ctx, WATER, sx(L, p[0]), sy(L, oy, p[1]), H * 0.03, 0.75);
      }
    }
  }

  // ── the tree: trunk and branches ──────────────────────────────
  private bakeTree(sim: DrzewoSim): void {
    const L = this.L, H = L.H;
    const g = sim.treeG;
    const key = `${this.w}|${H}|${this.layersKey}`;
    if (this.treeL && this.treeL.key === key && Math.abs(this.treeL.g - g) < 0.003 && (g < 1 || this.treeL.g >= 1)) return;
    const top = worldTop(sim.posture);
    const hpx = (1.02 - top) * H;
    const B = this.treeL?.key === key ? { c: this.treeL.c, ctx: this.treeL.c.getContext('2d')! } : layer(this.w, hpx, this.dpr);
    if (!B) return;
    const c = B.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, hpx + 2);
    const toP = (p: P): [number, number] => [sx(L, p[0]), (p[1] - top) * H];
    const grow = (b: Branch): [number, number][] | null => {
      const k = clamp((g - b.g0) / (b.g1 - b.g0));
      if (k <= 0) return null;
      const n = Math.max(2, Math.round(1 + k * (b.pts.length - 1)));
      return b.pts.slice(0, n).map(toP);
    };
    const all = [this.trunk!, ...this.branches];
    for (const b of all) {
      const pts = grow(b);
      if (!pts || pts.length < 2) continue;
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(230,240,170,.1)';
      c.lineWidth = b.w0 * H * 2.6;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      c.globalCompositeOperation = 'source-over';
      const lg = c.createLinearGradient(0, pts[0][1], 0, pts[pts.length - 1][1]);
      lg.addColorStop(0, 'rgba(214,226,150,.78)');
      lg.addColorStop(1, 'rgba(246,236,170,.9)');
      c.fillStyle = lg;
      ribbon(c, pts, b.w0 * H, Math.max(0.8, (b.w0 + (b.w1 - b.w0) * ((pts.length - 1) / (b.pts.length - 1))) * H));
      c.fill();
    }
    // the trunk's grain of light
    const tp = grow(this.trunk!);
    if (tp) {
      c.strokeStyle = 'rgba(255,250,220,.55)';
      c.lineWidth = Math.max(1, H * 0.006);
      c.beginPath();
      tp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
    this.treeL = { c: B.c, g, key };
  }

  private drawTree(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    if (sim.treeG <= 0) return;
    this.bakeTree(sim);
    if (!this.treeL) return;
    const L = this.L;
    ctx.drawImage(this.treeL.c, 0, sy(L, oy, worldTop(sim.posture)), this.w, this.treeL.c.height / this.dpr);
  }

  // ── the figure of light ───────────────────────────────────────
  private bakeFig(sim: DrzewoSim): void {
    const L = this.L, H = L.H;
    const key = `${H}|${sim.posture}|${this.w}`;
    if (this.fig?.key === key) return;
    const x0 = -0.3, y0 = -0.06, x1 = 0.3, y1 = 1.04;
    const B = layer((x1 - x0) * H, (y1 - y0) * H, this.dpr);
    if (!B) return;
    const c = B.ctx;
    const map = (x: number, y: number): [number, number] => [(x - x0) * H, (y - y0) * H];
    const sil = figurePathFor(sim.posture, map);
    const [, ya] = map(0, dropOf(sim.posture)), [, yb] = map(0, 1);
    // the seat: a smooth stone by the water, behind the figure
    if (sim.posture === 'sit') {
      const [scx, scy] = map(SEAT.cx, SEAT.cy);
      // a low boulder resting on the ground, wider than the hips: mossy grey, lit softly from the dusk above
      const rx = SEAT.rx * H, ry = SEAT.ry * H, bot = scy + ry;
      const sg = c.createLinearGradient(0, scy - ry, 0, bot);
      sg.addColorStop(0, '#8f8b7e');
      sg.addColorStop(0.5, '#68655b');
      sg.addColorStop(1, '#3b3934');
      c.fillStyle = sg;
      c.beginPath();
      c.moveTo(scx - rx, bot);
      c.bezierCurveTo(scx - rx * 1.04, scy - ry * 0.1, scx - rx * 0.86, scy - ry * 0.86, scx - rx * 0.42, scy - ry * 0.95);
      c.bezierCurveTo(scx - rx * 0.1, scy - ry * 1.02, scx + rx * 0.25, scy - ry * 0.9, scx + rx * 0.55, scy - ry * 0.82);
      c.bezierCurveTo(scx + rx * 0.9, scy - ry * 0.7, scx + rx * 1.05, scy - ry * 0.05, scx + rx, bot);
      c.closePath();
      c.fill();
      // moss along its top, a thin rim of light
      c.strokeStyle = 'rgba(150,170,110,.35)';
      c.lineWidth = Math.max(1.5, H * 0.008);
      c.beginPath();
      c.moveTo(scx - rx * 0.8, scy - ry * 0.62);
      c.bezierCurveTo(scx - rx * 0.4, scy - ry * 1.0, scx + rx * 0.3, scy - ry * 0.92, scx + rx * 0.75, scy - ry * 0.6);
      c.stroke();
      c.strokeStyle = 'rgba(255,236,200,.22)';
      c.lineWidth = 1;
      c.stroke();
    }
    // the rim of light: a wide soft halo, a glow and a crisp line warm at the head, silver lower down
    const rim = c.createLinearGradient(0, ya, 0, yb);
    rim.addColorStop(0, 'rgba(255,232,176,.95)');
    rim.addColorStop(0.35, 'rgba(244,236,214,.8)');
    rim.addColorStop(1, 'rgba(206,222,236,.62)');
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,240,200,.09)';
    c.lineWidth = Math.max(6, H * 0.03);
    c.stroke(sil);
    c.strokeStyle = 'rgba(255,240,210,.2)';
    c.lineWidth = Math.max(3, H * 0.013);
    c.stroke(sil);
    c.strokeStyle = rim;
    c.lineWidth = Math.max(1.6, H * 0.0058);
    c.stroke(sil);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    c.fill(sil);
    c.globalCompositeOperation = 'source-over';
    // the body: translucent, the tree's light shows through it
    const body = c.createLinearGradient(0, ya, 0, yb);
    body.addColorStop(0, 'rgba(250,240,220,.16)');
    body.addColorStop(0.6, 'rgba(220,226,214,.12)');
    body.addColorStop(1, 'rgba(200,214,220,.12)');
    c.fillStyle = body;
    c.fill(sil);
    this.fig = { c: B.c, key, x0, y0 };
  }

  private drawFigure(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    this.bakeFig(sim);
    const L = this.L, H = L.H;
    if (!this.fig) return;
    ctx.drawImage(this.fig.c, sx(L, this.fig.x0), sy(L, oy, this.fig.y0), this.fig.c.width / this.dpr, this.fig.c.height / this.dpr);
    const d = dropOf(sim.posture);
    // the posture's cue: the soles, then the shoulders and hands, then the crown of the head glow in turn
    if (sim.started && sim.postureBlock) {
      const k = 0.5 + 0.3 * Math.sin(this.time * 2);
      const cue = sim.cue;
      const spots: P[] = cue === 0 ? [[-0.044, 0.99], [0.044, 0.99]] : cue === 1 ? [[-0.1, 0.2 + d], [0.1, 0.2 + d], [-0.17, 0.53 + d], [0.17, 0.53 + d]] : [[0, 0.005 + d]];
      for (const [x, y] of spots) glow(ctx, GOLD_HI, sx(L, x), sy(L, oy, y), H * 0.05, k);
    }
    // the breath in rest: a glow in the chest swelling with the lungs
    if (sim.started && sim.restBlock) {
      const b = sim.breath.k;
      glow(ctx, '#fff0d8', sx(L, 0), sy(L, oy, 0.28 + d), H * (0.07 + 0.05 * b), 0.25 + 0.3 * b);
    }
  }

  /** The trunk's light through the body (additive, so it reads "through"), up to where it has grown. */
  private drawLight(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    const L = this.L, H = L.H;
    if (sim.treeG <= 0 || !this.trunk) return;
    const k = clamp(sim.treeG / 0.42);
    const pts = this.trunk.pts;
    const n = Math.max(1, Math.round(k * (pts.length - 1)));
    for (let i = 0; i <= n; i += 2) glow(ctx, TREE, sx(L, pts[i][0]), sy(L, oy, pts[i][1]), H * 0.045, 0.1);
    // growing: the trunk's top or the branches' tips shine gold
    if (sim.kind === 'trunk' && sim.pushBlock && !sim.blind) {
      const tip = pts[n];
      glow(ctx, sim.goldOn ? GOLD : '#efe6c8', sx(L, tip[0]), sy(L, oy, tip[1]), H * 0.05, sim.goldOn ? 0.8 : 0.35);
    }
  }

  // ── the crown ──────────────────────────────────────────────────
  private bakeLeaves(sim: DrzewoSim): void {
    const L = this.L, H = L.H;
    const g = sim.treeG;
    const key = `${this.w}|${H}|${this.layersKey}|${this.seasonNow}`;
    if (this.leafL && this.leafL.key === key && Math.abs(this.leafL.g - g) < 0.003 && (g < 1 || this.leafL.g >= 1)) return;
    const top = worldTop(sim.posture);
    const hpx = (0.5 + dropOf(sim.posture) - top) * H;
    const B = this.leafL?.key === key ? { c: this.leafL.c, ctx: this.leafL.c.getContext('2d')! } : layer(this.w, hpx, this.dpr);
    if (!B) return;
    const c = B.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, hpx + 2);
    const season = this.seasonNow;
    const cols = LEAVES[season];
    if (cols.length) {
      // the crown's own glow under the leaves
      const cr = crownOf(sim.posture);
      const show = clamp((g - 0.74) / 0.26);
      if (show > 0) {
        const gx = sx(L, cr.cx), gy = (cr.cy - top) * H;
        const rg = c.createRadialGradient(gx, gy, 0, gx, gy, cr.rx * H * 1.1);
        rg.addColorStop(0, `${rgbaPrefix(cols[0])}${0.2 * show})`);
        rg.addColorStop(1, `${rgbaPrefix(cols[0])}0)`);
        c.fillStyle = rg;
        c.fillRect(gx - cr.rx * H * 1.2, gy - cr.rx * H * 1.2, cr.rx * H * 2.4, cr.rx * H * 2.4);
      }
      for (const lf of this.leaves) {
        const k = clamp((g - lf.g) / 0.05);
        if (k <= 0) continue;
        const x = sx(L, lf.x), y = (lf.y - top) * H, s = lf.s * H * (0.4 + 0.6 * k);
        const col = mix(cols[Math.floor(lf.tone * cols.length) % cols.length], '#fff6d0', 0.22);
        c.fillStyle = `${rgbaPrefix(col)}${0.6 * k})`;
        c.beginPath();
        c.ellipse(x, y, s, s * 0.46, lf.a, 0, TAU);
        c.fill();
        c.strokeStyle = `rgba(255,255,230,${0.22 * k})`;
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x - Math.cos(lf.a) * s, y - Math.sin(lf.a) * s);
        c.lineTo(x + Math.cos(lf.a) * s, y + Math.sin(lf.a) * s);
        c.stroke();
        if (season === 'spring' && lf.blossom && k >= 1) {
          c.fillStyle = 'rgba(255,236,240,.92)';
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            c.beginPath();
            c.arc(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.42, s * 0.3, 0, TAU);
            c.fill();
          }
          c.fillStyle = '#ffd98a';
          c.beginPath();
          c.arc(x, y, s * 0.18, 0, TAU);
          c.fill();
        }
      }
    } else {
      // winter: bare branches, rimed with frost
      c.strokeStyle = 'rgba(235,245,255,.55)';
      c.lineWidth = 1;
      for (const b of this.branches) {
        const k = clamp((g - b.g0) / (b.g1 - b.g0));
        if (k < 1) continue;
        c.beginPath();
        b.pts.forEach(([x, y], i) => (i ? c.lineTo(sx(L, x), (y - top) * H - 1) : c.moveTo(sx(L, x), (y - top) * H - 1)));
        c.stroke();
      }
    }
    this.leafL = { c: B.c, g, key };
  }

  /** The crown sways about the trunk's top (gently; in the wind more). */
  private swayAbout(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    const L = this.L;
    const px = sx(L, 0), py = sy(L, oy, 0.32 + dropOf(sim.posture));
    ctx.translate(px, py);
    ctx.rotate(this.sway);
    ctx.translate(-px, -py);
  }

  private drawCrown(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    if (sim.treeG < 0.74) return;
    this.bakeLeaves(sim);
    if (!this.leafL) return;
    const L = this.L;
    ctx.save();
    this.swayAbout(ctx, sim, oy);
    ctx.drawImage(this.leafL.c, 0, sy(L, oy, worldTop(sim.posture)), this.w, this.leafL.c.height / this.dpr);
    ctx.restore();
  }

  // ── the fruits ─────────────────────────────────────────────────
  private drawFruits(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    const L = this.L, H = L.H;
    const show = sim.crownShownK;
    if (!sim.hang.length || show <= 0) return;
    const lamp = this.seasonNow === 'winter';
    ctx.save();
    this.swayAbout(ctx, sim, oy);
    for (const hng of sim.hang) {
      if (hng.slot >= RULES.perKind) continue;
      const i = FRUITS.indexOf(hng.fruit);
      const [x, y] = fruitPlace(i, hng.slot, sim.posture);
      const growing = !hng.before && hng.ripe < 1 && sim.kind === 'fruit' && sim.fruit === hng.fruit;
      const bob = this.opts.reducedMotion ? 0 : Math.sin(this.time * 1.3 + i) * H * 0.002;
      const hidden = growing && sim.blind;
      const r = FRUIT_R * H * (this.hoverFruit === hng.fruit && hng.ripe >= 1 ? 1.15 : 1);
      if (!hidden) drawFruit(ctx, hng.fruit, sx(L, x), sy(L, oy, y) + bob, r, hng.ripe, lamp, hng.before ? show : 1);
      if (growing && !sim.blind && sim.pushBlock) {
        glow(ctx, sim.goldOn ? GOLD : '#efe6c8', sx(L, x), sy(L, oy, y), r * 3.2, sim.goldOn ? 0.6 : 0.22);
      }
      if (sim.card && sim.card.fruit === hng.fruit) {
        ctx.strokeStyle = 'rgba(255,241,201,.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx(L, x), sy(L, oy, y), r * 1.9, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * The gauge on the picture (a sighted push past its lead-in): a soft halo at the growing point whose edge follows
   * the band's level, a faint dashed ring at the threshold, gold while it grows.
   */
  private drawGauge(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    if (!sim.sighted || !sim.reliable) return;
    const L = this.L, H = L.H;
    let p: P;
    if (sim.kind === 'roots') {
      const tips = tipsAt(this.roots.filter(r => r.order === 0), sim.rootG);
      p = tips.length ? [tips.reduce((a, q) => a + q[0], 0) / tips.length, Math.max(...tips.map(q => q[1]))] : [0, 1.02];
    } else if (sim.kind === 'trunk') {
      const pts = this.trunk!.pts;
      p = sim.treeG < 0.42 ? pts[Math.round(clamp(sim.treeG / 0.42) * (pts.length - 1))] : [0, crownOf(sim.posture).cy];
    } else p = fruitPlace(FRUITS.indexOf(sim.fruit), Math.max(0, sim.hang.filter(h => h.fruit === sim.fruit).length - 1), sim.posture);
    const x = sx(L, p[0]), y = sy(L, oy, p[1]);
    const R0 = H * 0.07;
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(255,241,201,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, R0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const r = R0 * (0.55 + 0.9 * clamp(sim.light));
    ctx.strokeStyle = sim.goldOn ? 'rgba(255,217,138,.85)' : 'rgba(230,226,214,.45)';
    ctx.lineWidth = sim.goldOn ? 2 : 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // ── wind and heat, frost, falling leaves ──────────────────────
  private drawWeather(ctx: CanvasRenderingContext2D, sim: DrzewoSim, oy: number): void {
    const L = this.L, H = L.H;
    const wind = sim.restKind === 'wind';
    const k = wind ? ease.inOutSine(clamp(Math.min(sim.restK * 3, (1 - sim.restK) * 4))) : 0;
    if (k > 0.01) {
      if (this.seasonNow !== 'winter') {
        // the sun beating down, upper left; the air warm
        const sxp = L.stage.x + L.stage.w * 0.12, syp = Math.max(L.top + 30, sy(L, oy, worldTop(sim.posture) + 0.05));
        glow(ctx, '#ffd27a', sxp, syp, H * 0.5, 0.45 * k);
        glow(ctx, '#fff4d0', sxp, syp, H * 0.12, 0.9 * k);
        ctx.fillStyle = `rgba(255,190,110,${0.08 * k})`;
        ctx.fillRect(0, 0, this.w, sy(L, oy, 1));
      }
      if (!this.opts.reducedMotion) {
        // streaks of wind across the sky
        ctx.strokeStyle = `rgba(255,255,255,${0.22 * k})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
          const y = sy(L, oy, worldTop(sim.posture) + 0.1 + hash(i * 3) * 0.8);
          const x = ((this.time * (180 + 90 * hash(i)) + hash(i * 7) * this.w) % (this.w + 200)) - 100;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 40, y - 6, x + 90, y);
          ctx.stroke();
        }
      }
    }
    // the season's small motion: falling leaves in autumn, petals in spring, snow in winter
    if (!this.opts.reducedMotion && sim.treeG >= 1 && (this.seasonNow === 'autumn' || this.seasonNow === 'spring')) {
      const cols = this.seasonNow === 'autumn' ? LEAVES.autumn : ['#ffe6ee', '#fff6f0'];
      const cr = crownOf(sim.posture);
      for (let i = 0; i < 6; i++) {
        const ph = (this.time * 0.12 + hash(i * 5.7)) % 1;
        const x = cr.cx + (hash(i * 2.3) - 0.5) * 2 * cr.rx + Math.sin(this.time + i) * 0.04 + ph * 0.25 * (wind ? 2 : 0.4);
        const y = cr.cy + ph * (1 - cr.cy);
        ctx.fillStyle = `${rgbaPrefix(cols[i % cols.length])}${0.8 * (1 - ph)})`;
        ctx.beginPath();
        ctx.ellipse(sx(L, x), sy(L, oy, y), H * 0.008, H * 0.004, this.time * 2 + i, 0, TAU);
        ctx.fill();
      }
    }
    if (this.flakes.length) {
      ctx.fillStyle = 'rgba(245,250,255,.8)';
      for (const f of this.flakes) {
        if (f.y > sy(L, oy, 1)) continue;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.s, 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawBursts(ctx: CanvasRenderingContext2D, oy: number): void {
    const L = this.L, H = L.H;
    for (const b of this.bursts) {
      const k = b.t / 1.6;
      const x = sx(L, b.x), y = sy(L, oy, b.y);
      glow(ctx, b.color, x, y, H * (0.05 + 0.2 * ease.outCubic(k)), 0.8 * (1 - k));
      if (this.opts.reducedMotion) continue;
      ctx.strokeStyle = `${rgbaPrefix(mix(b.color, '#ffffff', 0.4))}${0.7 * (1 - k)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, H * (0.03 + 0.12 * ease.outCubic(k)), 0, TAU);
      ctx.stroke();
    }
  }
}

/** The figure's silhouette for a posture: kit/figure's standing one, or the seated one (tree.ts), with hands and feet. */
export function figurePathFor(posture: Posture, map: (x: number, y: number) => [number, number]): Path2D {
  if (posture === 'stand') return figurePath(map);
  const p = new Path2D();
  spline(p, SEATED_OUTLINE, map, true);
  for (const side of [1, -1] as const) {
    for (const s of seatedHands(side)) if (s.smooth) spline(p, s.pts, map, true); else polygon(p, s.pts, map);
    for (const s of footShapes(side)) if (s.smooth) spline(p, s.pts, map, true); else polygon(p, s.pts, map);
  }
  return p;
}
