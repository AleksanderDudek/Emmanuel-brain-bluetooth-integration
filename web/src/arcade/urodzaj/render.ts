/**
 * Urodzaj's play view, all on the canvas: the hillside orchard as an early-Christian floor mosaic
 * (terraces of sage, ochre and olive stones, dark frame bands for the runner's clock and buttons),
 * the woven basket and its fruit (mosaic sprites, turning as they roll), the fruit hanging from the
 * olive twig with its aim line and landing ring, the vine along both borders (it grows with V in a
 * sighted Zbiór, its shoots with the steady hold) and its tendrils reaching between alike fruit
 * that almost touch, the linen over the basket in Rosa with the dew gathering on it, the payouts
 * (the vine's gather, the dew's settle and bridges), merges and chains in tesserae, the spill to the
 * gleaners at the field's edge, the great cluster carried to the table, the mist while the signal is
 * unreliable, and the evening: dusk, the basket carried off and the village table with its guests.
 *
 * It only reads the sim (sim.ts).  The HUD lives in hud.ts, the table and its people in table.ts,
 * the calibration intro in intro.ts, the lobby's picture in preview.ts.  The still scene is baked
 * once per size (mosaic.ts) and the fruit sprites are cached, so a frame mostly draws images.
 */
import { fmtNum } from '../../i18n';
import { Particles, approach, clamp, ease } from '../kit/juice';
import { MAX_TIER, TABLE_STEPS, fruit, guestById } from './content';
import { Hud, drop, font, plaque } from './hud';
import { cap, t } from './i18n';
import { UrodzajIntro } from './intro';
import { BOTTOM, DROP_MAX_R, TOP, layout, type Layout } from './layout';
import { tablePoints, tableState, type UrodzajProgress } from './meta';
import {
  C, DAY, DUSK, SERIF, TAU, bakeScene, fruitArt, hash, linenTile, mix, paintBasket, paintBorder, paintFrame, paintRim, paintVineLeaf, stone, type Baked,
} from './mosaic';
import { BASKET } from './physics';
import { RULES, type SimEvent, type UrodzajSim } from './sim';
import { paintGuest, paintTable } from './table';
import type { FigureLook } from './content';

const ENOUGH = t('evening.enough');
/** after a drop, the next fruit waits this long (s) before it buds, so it never shows over the one falling */
const BUD = 0.22;
/** The gleaners at the field's edge: two women with sheaves (no one in particular). */
const GLEANER: FigureLook = { skin: '#C08A5E', tunic: '#A9805A', cloth: '#E3D3B1', hair: '#3A2418', attr: 'sheaf', small: false };
const GLEANER2: FigureLook = { skin: '#B07E58', tunic: '#7F8A4A', cloth: '#C8A060', hair: '#3A2418', attr: 'stalks', small: false };

/** A fruit travelling off the basket: to the gleaners (a spill), with the old basket to the table, or the great cluster flying to the table. */
interface Flier { tier: number; x0: number; y0: number; x1: number; y1: number; r: number; angle: number; t: number; dur: number; delay: number; kind: 'glean' | 'great' }

interface Ring { x: number; y: number; r: number; t: number; dur: number; color: string }

export class UrodzajView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 390;
  private h = 844;
  private dpr = 1;
  L: Layout = layout(390, 844);
  readonly hud: Hud;
  private readonly particles = new Particles(360);
  private readonly intro0 = new UrodzajIntro();
  private day: Baked | null = null;
  private dusk: Baked | null = null;
  private sceneKey = '';
  private duskKey = '';
  private linen: CanvasPattern | null = null;
  private linenKey = '';
  private started = false;
  private clock = 0;
  // moments
  private fadeIn = 1;
  private duskK = 0;
  private vineK = 0.2;
  private vineFlash = 0;
  private settleT = -1;
  private shake = 0;
  private warnPulse = 0;
  private gleaned = 0;
  private readonly gleanTiers: number[] = [];
  private readonly fliers: Flier[] = [];
  private readonly rings: Ring[] = [];
  private lastChange: unknown = null;
  private enoughT = -1;
  private readonly arriving = new Map<string, number>();
  private beadPop = 0;
  /** the basket's offset (screen px) and alpha this frame: a change slides it, the evening carries it off */
  private ox = 0;
  private oy = 0;
  private bA = 1;
  private readonly X = (x: number): number => this.L.cx + this.ox + x * this.L.s;
  private readonly Y = (y: number): number => this.L.floorY + this.oy - y * this.L.s;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx, opts.reducedMotion);
    this.hud.resize(this.L, 1);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h);
    this.hud.resize(this.L, dpr);
  }

  start(): void {
    this.started = true;
    this.fadeIn = 1;
  }

  /** A pointer's screen x in the basket's world (W). */
  worldX(x: number): number { return (x - this.L.cx) / this.L.s; }

  // ── the still scene ────────────────────────────────────────────
  private tile(): number { return clamp(Math.min(this.w, this.h) / 40, 8, 14); }

  private horizon(): number {
    const L = this.L;
    return L.portrait ? Math.max(TOP + 40, L.tip.y + L.tip.h * 0.5) : Math.max(TOP + 40, L.rimY - 0.55 * L.s);
  }

  private scene(dusk: boolean): Baked {
    const key = `${this.w}|${this.h}|${this.dpr}`;
    if (!dusk) {
      if (!this.day || this.sceneKey !== key) {
        this.sceneKey = key;
        this.day = this.bake(DAY);
      }
      return this.day;
    }
    if (!this.dusk || this.duskKey !== key) {
      this.duskKey = key;
      this.dusk = this.bake(DUSK);
    }
    return this.dusk;
  }

  private bake(pal: typeof DAY): Baked {
    const b = bakeScene(this.w, this.h, this.dpr, this.horizon(), this.tile(), pal, TOP, BOTTOM);
    const g = b.c.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    paintFrame(g, this.w, this.h, TOP, BOTTOM, this.tile(), pal.frame);
    return b;
  }

  private linenPattern(): CanvasPattern | null {
    const key = `${this.dpr}|${this.L.u}`;
    if (!this.linen || this.linenKey !== key) {
      this.linenKey = key;
      const tile = linenTile(this.dpr, this.L.u);
      this.linen = this.ctx.createPattern(tile, 'repeat');
      this.linen?.setTransform?.(new DOMMatrix([1 / this.dpr, 0, 0, 1 / this.dpr, 0, 0]));
    }
    return this.linen;
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: UrodzajSim): void {
    const L = this.L, u = L.u, rm = this.opts.reducedMotion, hud = this.hud;
    switch (e.type) {
      case 'drop':
        hud.popNext();
        break;
      case 'land':
        if (e.speed > 0.6 && !rm) {
          this.particles.burst(this.X(e.x), this.Y(e.y - fruit(e.tier).r), 4, { color: C.sand, speed: 40 * u, spread: Math.PI, angle: -Math.PI / 2, g: 160, drag: 3, life: 0.35, size: 1.6 * u, shape: 'square' });
        }
        break;
      case 'merge': {
        const f = fruit(e.tier), x = this.X(e.x), y = this.Y(e.y);
        const n = rm ? 4 : 8 + Math.min(14, e.tier * 2);
        this.particles.burst(x, y, n, { color: f.light, speed: 90 * u, spread: TAU, g: 220, drag: 1.8, life: 0.6, size: 2.2 * u, shape: 'square' });
        this.particles.burst(x, y, Math.ceil(n / 2), { color: f.base, speed: 70 * u, spread: TAU, g: 200, drag: 2, life: 0.55, size: 2 * u, shape: 'square' });
        if (e.via !== 'touch') this.particles.burst(x, y, 6, { color: e.via === 'dew' ? C.dew : C.leaf, speed: 50 * u, spread: TAU, g: 40, drag: 2, life: 0.7, size: 2 * u, shape: 'dot' });
        this.rings.push({ x, y, r: f.r * L.s, t: 0, dur: 0.45, color: f.light });
        hud.popScore();
        const pts = t('fx.points', { n: e.pts });
        hud.float(e.link > 0 ? `${pts} ${t('fx.chain', { n: fmtNum(e.mult, e.mult % 1 ? 2 : 0) })}` : pts, x, y - f.r * L.s - 6 * u,
          e.link > 0 ? C.terracotta : mix(f.dark, C.dark, 0.3), 15 + Math.min(6, e.tier) + Math.min(4, e.link), 1.1);
        if (e.first && e.tier >= 3) hud.card(t('hl.record.tier', { name: f.name }), '', { icon: 'fruit', tier: e.tier, rank: 2, dur: 2 });
        break;
      }
      case 'great': {
        const x = this.X(e.x), y = this.Y(e.y);
        this.particles.burst(x, y, rm ? 8 : 40, { color: C.gold, speed: 160 * u, spread: TAU, g: 80, drag: 1.4, life: 1.2, size: 2.6 * u, shape: 'spark' });
        this.rings.push({ x, y, r: fruit(MAX_TIER).r * L.s * 1.2, t: 0, dur: 0.8, color: C.gold });
        if (!rm) this.shake = 0.35;
        hud.float(t('fx.great'), x, y - 50 * u, mix(C.gold, C.dark, 0.35), 22, 1.6, 30);
        // the cluster flies to the table (the panel when wide, the harvest number on a phone)
        const to = L.table ? { x: L.table.x + L.table.w / 2, y: L.table.y + L.table.h * 0.6 } : { x: L.score.x + 30 * u, y: L.score.y + 20 * u };
        this.fliers.push({ tier: MAX_TIER, x0: x, y0: y, x1: to.x, y1: to.y, r: fruit(MAX_TIER).r * L.s, angle: 0, t: 0, dur: 1.1, delay: 0.25, kind: 'great' });
        break;
      }
      case 'greatBasket':
        hud.float(t('fx.toTable', { pts: t('pts', { n: e.pts }) }), L.cx, L.rimY - 30 * u, C.olive, 16, 1.8, 26);
        break;
      case 'spill':
        hud.float(t('fx.spill'), L.gleaners.x + 40 * u, L.gleaners.y - 40 * u, C.terracotta, 15, 1.8, 24);
        break;
      case 'newBasket':
        if (sim.baskets > 1) hud.float(t('fx.newBasket'), L.cx, L.floorY - 0.5 * L.s, C.muted, 13, 1.2, 20);
        break;
      case 'warnTick':
        this.warnPulse = 1;
        break;
      case 'blockStart': {
        const b = e.block;
        if (b.kind === 'warmup') break;
        const name = b.kind === 'zbior' ? t(b.blind ? 'block.zbiorBlind' : 'block.zbior') : t(b.blind ? 'block.rosaBlind' : 'block.rosa');
        hud.card(name, sim.tip, { icon: b.kind === 'zbior' ? (b.blind ? 'cloud' : 'leaf') : b.blind ? 'dusk' : 'drop', rank: 1, dur: 2.6, color: b.kind === 'zbior' ? C.vine : C.lapis });
        break;
      }
      case 'stamp':
        if (e.kind === 'almost') hud.card(t('stamp.almost'), t('stamp.almostLine', { have: fmtNum(e.have, e.have % 1 ? 1 : 0), need: fmtNum(e.need, e.need % 1 ? 1 : 0) }), { icon: 'almost', rank: 0, dur: 2.6, color: C.muted });
        else if (e.kind === 'leaf') hud.card(t('stamp.leaf'), t('stamp.leafLine'), { icon: 'leaf', rank: 0, dur: 2.6, color: C.vine });
        else hud.card(t('stamp.drop'), t('stamp.dropLine'), { icon: 'drop', rank: 0, dur: 2.6, color: C.lapis });
        break;
      case 'revealZbior':
        hud.card(e.pairs > 0 ? t('reveal.zbior', { pairs: t('pairs', { n: e.pairs }) }) : t('reveal.zbiorNone'), '', { icon: 'cloud', rank: 0, dur: 2.8, color: C.vine });
        break;
      case 'revealRosa':
        hud.card(t('reveal.rosa', { pct: t('pct', { n: e.pct }) }), '', { icon: 'dusk', rank: 0, dur: 2.8, color: C.lapis });
        break;
      case 'gather':
        this.vineFlash = 1;
        break;
      case 'gathered':
        if (e.first && e.merged > 0) hud.card(t('fx.gatherFirst'), '', { icon: 'leaf', rank: 1, dur: 2.6, color: C.vine });
        break;
      case 'settle':
        this.settleT = 0;
        if (!e.blind && e.dew > 0.05) hud.float(t('fx.settle'), L.cx, L.rimY - 24 * u, C.lapis, 14, 1.6, 20);
        break;
      case 'saved':
        hud.float(t('fx.saved'), L.cx, L.rimY - 46 * u, C.lapis, 15, 1.8, 22);
        break;
      case 'shoot':
        if (!e.blind) {
          for (const side of [0, 1]) {
            const x = side ? L.w - L.border / 2 : L.border / 2;
            this.particles.burst(x, TOP + 30 * u, rm ? 2 : 6, { color: C.leaf, speed: 40 * u, spread: TAU, g: 30, drag: 2, life: 0.8, size: 2 * u, shape: 'dot' });
          }
          hud.float(t('fx.shoot'), L.portrait ? L.cx : L.ladder.x + L.ladder.w / 2, L.portrait ? L.hangY - 0.12 * L.s : L.tip.y + L.tip.h + 10 * u, C.vine, 13, 1.4, 18);
        }
        break;
      case 'bead':
        this.beadPop = 1;
        break;
      case 'tableStep':
        hud.card(t('table.step', { name: TABLE_STEPS[e.step].name }), '', { icon: 'table', step: e.step, rank: 1, dur: 2.6, color: C.terracotta });
        break;
      case 'lesson':
        hud.card(t('lesson.merge'), '', { icon: 'fruit', tier: 2, rank: 0, dur: 3 });
        break;
      case 'evening':
        hud.clearCards();
        break;
      case 'loaf':
        hud.card(t('table.loaf'), '', { icon: 'loaf', rank: 1, dur: 2.4, color: C.terracotta });
        break;
      case 'guest': {
        const g = guestById(e.id);
        if (!g) break;
        if (e.isNew) this.arriving.set(e.id, this.clock);
        const title = e.id === 'rut' && e.via === 'story' ? t('evening.ruth') : e.id === 'noemi' && e.via === 'story' ? t('evening.naomi')
          : e.isNew ? `${t(e.via === 'craft' ? 'card.craft' : 'card.new')}: ${g.name}` : `${cap(g.name)} · ${t('card.dup', { grain: t('grain', { n: e.grain }) })}`;
        const sub = g.ref ? `${g.line} (${t('guest.after', { ref: g.ref })})` : g.line;
        hud.card(title, sub, { icon: 'guest', look: g.look, rank: 1, dur: 3.2, color: C.dark });
        break;
      }
      case 'enough':
        this.enoughT = 0;
        break;
      default:
        break;
    }
  }

  // ── a frame ──────────────────────────────────────────────────────
  update(dt: number, sim: UrodzajSim): void {
    this.clock += dt;
    this.particles.update(dt);
    this.hud.update(dt, sim);
    const b = sim.block;
    const want = sim.phase !== 'play' ? 0.8 : b?.kind === 'rosa' ? (b.blind ? 0.85 : 0.45) : 0;
    this.duskK = approach(this.duskK, want, dt, 0.9);
    const vt = sim.vineLive ? 0.25 + 0.75 * sim.V : b?.kind === 'zbior' ? 0.25 : 0.18;
    this.vineK = approach(this.vineK, vt, dt, 0.5);
    this.vineFlash = Math.max(0, this.vineFlash - dt * 1.2);
    this.warnPulse = Math.max(0, this.warnPulse - dt * 3);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.5);
    this.beadPop = Math.max(0, this.beadPop - dt * 2.5);
    if (this.settleT >= 0) {
      this.settleT += dt;
      if (this.settleT > RULES.settle + 0.4) this.settleT = -1;
    }
    if (this.enoughT >= 0) this.enoughT += dt;
    for (const r of this.rings) r.t += dt;
    let n = 0;
    for (const r of this.rings) if (r.t < r.dur) this.rings[n++] = r;
    this.rings.length = n;
    // a new basket change: the spilled fruit roll to the gleaners
    const c = sim.change;
    if (c && c !== this.lastChange) {
      this.lastChange = c;
      const L = this.L, u = L.u;
      let i = 0;
      for (const s of c.snaps) {
        if (!s.spill) continue;
        const tx = L.gleaners.x - L.gleaners.size * 0.2 + (hash(i * 3.3) - 0.5) * 20 * u, ty = L.gleaners.y + L.gleaners.size * 0.4;
        this.fliers.push({ tier: s.tier, x0: this.X(s.x), y0: this.Y(s.y), x1: tx, y1: ty, r: s.r * L.s, angle: s.angle, t: 0, dur: 0.9, delay: i * 0.05, kind: 'glean' });
        i++;
      }
    }
    n = 0;
    for (const f of this.fliers) {
      f.t += dt;
      if (f.t < f.delay + f.dur) {
        this.fliers[n++] = f;
        continue;
      }
      if (f.kind === 'glean') {
        this.gleaned++;
        this.gleanTiers.push(f.tier);
        if (this.gleanTiers.length > 9) this.gleanTiers.shift();
      }
    }
    this.fliers.length = n;
  }

  draw(sim: UrodzajSim): void {
    const { ctx } = this;
    if (this.w < 2 || this.h < 2 || !this.started) return;
    const L = this.L, rm = this.opts.reducedMotion;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    if (this.shake > 0 && !rm) ctx.translate(Math.sin(this.clock * 61) * this.shake * 4, Math.sin(this.clock * 47 + 1) * this.shake * 3);
    ctx.drawImage(this.scene(false).c, 0, 0, this.w, this.h);
    if (this.duskK > 0.01) {
      ctx.globalAlpha = this.duskK;
      ctx.drawImage(this.scene(true).c, 0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
    this.drawVine(sim);
    this.drawGleaners();
    // the basket's place this frame: a change slides the old one off and the new one in, the evening carries it to the table
    this.placeBasket(sim);
    const evening = sim.phase !== 'play';
    const carry = evening ? clamp((sim.phaseT - RULES.carryAt) / 0.9) : 0;
    if (this.bA > 0.01 && carry < 1) {
      ctx.save();
      ctx.globalAlpha = this.bA * (1 - (rm ? carry : 0));
      if (!rm && carry > 0) {
        this.ox += ease.inOutSine(carry) * this.w * 0.75;
      }
      paintBasket(ctx, this.X, this.Y, L.s, 'back');
      this.drawSnaps(sim);
      this.drawFruit(sim);
      this.drawTendrils(sim);
      this.drawPulls(sim);
      paintBasket(ctx, this.X, this.Y, L.s, 'front');
      paintRim(ctx, this.X, this.Y, L.s);
      this.drawWarning(sim);
      this.drawSettle();
      this.drawVeil(sim);
      ctx.restore();
    }
    this.ox = 0;
    this.oy = 0;
    if (sim.phase === 'play') this.drawHanging(sim);
    if (evening) this.drawEvening(sim);
    this.drawFliers();
    this.drawRings();
    this.particles.draw(ctx);
    ctx.globalAlpha = 1;
    this.drawMist(sim);
    ctx.restore();
    this.hud.draw(sim);
    if (this.enoughT >= 0) this.drawEnough();
    if (this.fadeIn > 0) {
      ctx.globalAlpha = ease.inOutSine(this.fadeIn);
      ctx.fillStyle = '#2A2622';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
  }

  private placeBasket(sim: UrodzajSim): void {
    const c = sim.change, rm = this.opts.reducedMotion;
    this.ox = 0;
    this.oy = 0;
    this.bA = 1;
    if (!c) return;
    if (c.t < RULES.fresh) {
      // the old basket goes off toward the table
      const k = clamp(c.t / RULES.fresh);
      if (!rm) this.ox = ease.inOutSine(k) * this.w * 0.6;
      this.bA = 1 - k;
    } else {
      // the new one is set down
      const k = clamp((c.t - RULES.fresh) / (RULES.change - RULES.fresh));
      if (!rm) this.oy = -(1 - ease.outCubic(k)) * 0.25 * this.L.s;
      this.bA = k;
    }
  }

  // ── the basket's contents ───────────────────────────────────────
  private fruitAt(tier: number, x: number, y: number, r: number, r1: number, angle: number): void {
    const { ctx, dpr } = this;
    const art = fruitArt(tier, r1, dpr);
    const k = r / Math.max(1e-6, art.r);
    const size = art.size * k;
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(-angle);
    ctx.drawImage(art.c, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private drawFruit(sim: UrodzajSim): void {
    const { ctx, L } = this;
    const s = L.s;
    const glisten = sim.glisten, base = ctx.globalAlpha;
    for (const b of sim.world.bodies) {
      if (b.dead) continue;
      const x = this.X(b.x), y = this.Y(b.y);
      this.fruitAt(b.tier, x, y, b.r * s, b.r1 * s, b.angle);
      if (glisten > 0.02) {
        // the dew's glisten: a few white stones that come and go
        for (let i = 0; i < 2; i++) {
          const a = hash(b.id * 7 + i) * TAU, rr = b.r * s * 0.55;
          const tw = 0.5 + 0.5 * Math.sin(this.clock * 3 + b.id + i * 2);
          ctx.globalAlpha = glisten * tw * base;
          stone(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, Math.max(1.6, 2.4 * L.u), 0.785, '#FFFFFF');
        }
        ctx.globalAlpha = base;
      }
    }
  }

  /** During a change, the old basket's fruit (those that did not spill) go with it. */
  private drawSnaps(sim: UrodzajSim): void {
    const c = sim.change;
    if (!c || c.t >= RULES.fresh) return;
    const s = this.L.s;
    for (const sn of c.snaps) if (!sn.spill) this.fruitAt(sn.tier, this.X(sn.x), this.Y(sn.y), sn.r * s, sn.r * s, sn.angle);
  }

  /** The vine's tendrils between alike fruit that almost touch: they reach as far as the allowance A; joined ones glow. */
  private drawTendrils(sim: UrodzajSim): void {
    if (!sim.vineLive || !sim.vine.length) return;
    const { ctx, L } = this;
    const u = L.u;
    const A = sim.allowance;
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of sim.vine) {
      const { a, b } = p;
      if (a.dead || b.dead) continue;
      const ax = this.X(a.x), ay = this.Y(a.y), bx = this.X(b.x), by = this.Y(b.y);
      const d = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / d, uy = (by - ay) / d;
      const sa = ax + ux * a.r * L.s, sb = bx - ux * b.r * L.s;
      const sya = ay + uy * a.r * L.s, syb = by - uy * b.r * L.s;
      const gap = Math.max(1, Math.hypot(sb - sa, syb - sya));
      const reach = clamp((A * p.r) / Math.max(1e-6, p.gap));
      const joined = reach >= 1;
      const half = 0.5 * reach;
      ctx.strokeStyle = joined ? C.leaf : mix(C.vine, C.leaf, 0.3);
      ctx.lineWidth = (joined ? 2.6 : 1.8) * u;
      ctx.globalAlpha = (joined ? 0.95 : 0.65) * this.bA;
      for (const [x0, y0, dir] of [[sa, sya, 1], [sb, syb, -1]] as const) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
          const k = (i / steps) * half;
          const wob = Math.sin(k * 14 + this.clock * 2 + a.id) * 3 * u * (1 - k);
          ctx.lineTo(x0 + dir * ux * gap * k - uy * wob, y0 + dir * uy * gap * k + ux * wob);
        }
        ctx.stroke();
      }
      if (joined) paintVineLeaf(ctx, (sa + sb) / 2, (sya + syb) / 2 - 3 * u, 4.5 * u, 0.4);
    }
    ctx.restore();
  }

  /** The payout's pulls: the vine carries a fruit to its partner (green), the dew slides one along a bridge of drops (blue). */
  private drawPulls(sim: UrodzajSim): void {
    if (!sim.pulls.length) return;
    const { ctx, L } = this;
    const u = L.u;
    ctx.save();
    ctx.lineCap = 'round';
    for (const pl of sim.pulls) {
      if (pl.a.dead || pl.b.dead) continue;
      const ax = this.X(pl.a.x), ay = this.Y(pl.a.y), bx = this.X(pl.b.x), by = this.Y(pl.b.y);
      if (pl.kind === 'vine') {
        ctx.strokeStyle = C.vine;
        ctx.lineWidth = 3 * u;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 16 * u, ax, ay);
        ctx.stroke();
        ctx.strokeStyle = C.leaf;
        ctx.lineWidth = 1.4 * u;
        ctx.stroke();
      } else {
        const n = 6;
        for (let i = 0; i <= n; i++) {
          const k = i / n;
          ctx.globalAlpha = 0.85;
          drop(ctx, ax + (bx - ax) * k, ay + (by - ay) * k, 2.2 * u);
        }
      }
    }
    ctx.restore();
  }

  /** The rim's warning: a zigzag of terracotta stones across the basket's mouth, stronger as the 2 s run out. */
  private drawWarning(sim: UrodzajSim): void {
    const k = sim.warning;
    if (k <= 0 && this.warnPulse <= 0) return;
    const { ctx, L } = this;
    const t = clamp(L.s * 0.02, 3, 8);
    const n = Math.round((L.s * 1.0) / (t * 1.4));
    ctx.save();
    ctx.globalAlpha = clamp(0.35 + 0.65 * k + 0.3 * this.warnPulse) * this.bA;
    for (let i = 0; i <= n; i++) {
      const xw = -0.5 + i / n;
      const yy = this.Y(BASKET.rim) + (i % 2 ? -t * 0.7 : t * 0.7);
      stone(ctx, this.X(xw), yy, t, 0.785, i % 2 ? C.terracotta : C.ochre);
    }
    ctx.restore();
  }

  /** The dew settling the heap: a soft blue light that sinks through the basket. */
  private drawSettle(): void {
    if (this.settleT < 0) return;
    const { ctx, L } = this;
    const k = clamp(this.settleT / (RULES.settle + 0.4));
    const y = this.Y(1.1) + (this.Y(0) - this.Y(1.1)) * ease.outCubic(k);
    const g = ctx.createLinearGradient(0, y - 0.3 * L.s, 0, y);
    g.addColorStop(0, 'rgba(207,227,242,0)');
    g.addColorStop(1, `rgba(207,227,242,${0.35 * (1 - k)})`);
    ctx.fillStyle = g;
    ctx.fillRect(this.X(-0.52), y - 0.3 * L.s, 1.04 * L.s, 0.3 * L.s);
  }

  /**
   * The linen over the basket in Rosa: it unrolls from the twig down over the basket's shape, with
   * woven borders and a medallion in the middle.  The dew gathers on it in rings around one drop at
   * the centre (the place to look softly at), which swells with the dew; in a blind Rosa the cloth is
   * bare until the reveal.
   */
  private drawVeil(sim: UrodzajSim): void {
    const v = sim.veil;
    if (v <= 0) return;
    const { ctx, L } = this;
    const u = L.u, s = L.s, rm = this.opts.reducedMotion;
    const k = rm ? v : ease.inOutSine(v);
    const yTop = 1.12, yFull = -0.06;
    const yBot = yTop + (yFull - yTop) * k;
    const half = (y: number) => 0.585 - 0.08 * (1 - (y - yFull) / (yTop - yFull));
    const top = this.Y(yTop), bottom = this.Y(yBot);
    ctx.save();
    if (rm) ctx.globalAlpha *= v;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(this.X(-half(yTop)), top);
      ctx.lineTo(this.X(half(yTop)), top);
      ctx.lineTo(this.X(half(yBot)), bottom);
      const waves = 7, hb = half(yBot);
      for (let i = waves; i > 0; i--) {
        const xa = -hb + ((i - 0.5) / waves) * 2 * hb, xb = -hb + ((i - 1) / waves) * 2 * hb;
        ctx.quadraticCurveTo(this.X(xa), bottom + 7 * u, this.X(xb), bottom);
      }
      ctx.closePath();
    };
    // its shadow, the cloth, its edge
    ctx.save();
    ctx.translate(3, 5);
    path();
    ctx.fillStyle = 'rgba(42,38,34,.25)';
    ctx.fill();
    ctx.restore();
    path();
    ctx.fillStyle = this.linenPattern() ?? '#F2EBDD';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,80,.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    path();
    ctx.clip();
    // soft folds from the rim
    ctx.strokeStyle = 'rgba(150,130,100,.13)';
    ctx.lineWidth = 6 * u;
    for (let i = 1; i < 5; i++) {
      const x = this.X(-0.5 + i / 5);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.quadraticCurveTo(x + (i - 2.5) * 6 * u, (top + bottom) / 2, x + (i - 2.5) * 10 * u, bottom);
      ctx.stroke();
    }
    const bt = clamp(5 * u, 3, 7);
    paintBorder(ctx, this.X(-0.6), this.X(0.6), top + bt * 1.3, bt);
    if (bottom - top > bt * 8) paintBorder(ctx, this.X(-0.6), this.X(0.6), bottom - bt * 2.8, bt, 2);
    ctx.restore();
    if (k > 0.55) {
      const a = clamp((k - 0.55) / 0.45);
      ctx.globalAlpha *= a;
      const cx = this.X(0), cy = this.Y(0.52);
      // the medallion: a lozenge of blue and terracotta stitches, a ring of ochre inside
      const R = 0.17 * s;
      const n = 28;
      for (let i = 0; i < n; i++) {
        const q = i / n;
        const side = Math.floor(q * 4), f = q * 4 - side;
        const corners = [[0, -1], [1, 0], [0, 1], [-1, 0], [0, -1]];
        const [x0, y0] = corners[side], [x1, y1] = corners[side + 1];
        stone(ctx, cx + (x0 + (x1 - x0) * f) * R, cy + (y0 + (y1 - y0) * f) * R * 1.15, bt * 0.85, 0.785, i % 2 ? C.blue : C.terracotta);
      }
      for (let i = 0; i < 16; i++) {
        const q = (i / 16) * TAU;
        stone(ctx, cx + Math.cos(q) * R * 0.42, cy + Math.sin(q) * R * 0.48, bt * 0.6, q, mix(C.ochre, C.white, 0.15));
      }
      const b = sim.block;
      if (b?.kind === 'rosa') {
        // the drop at the centre swells with the dew (unseen in a blind Rosa: a bare stitch instead)
        if (b.blind) stone(ctx, cx, cy, bt, 0.785, mix(C.blue, C.ground, 0.5));
        else {
          const pulse = rm ? 1 : 1 + 0.04 * Math.sin(this.clock * 1.4);
          drop(ctx, cx, cy, (4 + 7 * sim.D) * u * pulse);
          // the beads in rings around the medallion: 6, 12, 18
          for (let i = 0; i < sim.beads; i++) {
            const ring = i < 6 ? 0 : i < 18 ? 1 : 2;
            const idx = ring === 0 ? i : ring === 1 ? i - 6 : i - 18;
            const cnt = 6 * (ring + 1);
            const q = (idx / cnt) * TAU + ring * 0.4 + hash(i) * 0.12;
            const rr = R * (1.35 + ring * 0.5);
            const bx = cx + Math.cos(q) * rr, by = cy + Math.sin(q) * rr * 1.2;
            if (by < top + bt * 4 || by > bottom - bt * 4) continue;
            const pop = i === sim.beads - 1 && this.beadPop > 0 && !rm ? 1 + 0.7 * this.beadPop : 1;
            drop(ctx, bx, by, (2.6 + 0.8 * hash(i * 1.9)) * u * pop);
          }
        }
      }
    }
    ctx.restore();
  }

  // ── the hanging fruit and its aim ───────────────────────────────
  private drawHanging(sim: UrodzajSim): void {
    const { ctx, L } = this;
    const u = L.u;
    // the olive twig across the top of the basket
    const twigY = L.hangY - DROP_MAX_R * L.s - 6 * u;
    ctx.save();
    ctx.strokeStyle = C.brown;
    ctx.lineWidth = 3 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.X(-0.56), twigY + 3 * u);
    ctx.quadraticCurveTo(L.cx, twigY - 4 * u, this.X(0.56), twigY + 2 * u);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const x = this.X(-0.5 + i / 6);
      paintVineLeaf(ctx, x, twigY - 3 * u + (i % 2) * 5 * u, 4 * u, (i % 2 ? 0.6 : -0.6));
    }
    if (!sim.open) {
      ctx.restore();
      return;
    }
    const tier = sim.hanging ?? sim.tierOf(0);
    // the next fruit buds on the stem only once the one just dropped has fallen clear of the twig
    const grow = sim.hanging !== null ? 1 : clamp((RULES.cooldown - sim.cooldown - BUD) / (RULES.cooldown - BUD));
    const f = fruit(tier);
    const r = f.r * L.s;
    const hx = this.X(sim.hangX), hy = this.Y(BASKET.hang);
    const land = this.Y(sim.world.dropY(sim.hangX, f.r));
    if (sim.hanging !== null && land > hy + r + 4) {
      // the aim line down to where it would first touch, and a ring there
      ctx.strokeStyle = 'rgba(42,38,34,.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4 * u, 5 * u]);
      ctx.beginPath();
      ctx.moveTo(hx, hy + r + 3);
      ctx.lineTo(hx, land);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,248,232,.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, land, r, 0, TAU);
      ctx.stroke();
    }
    // the stem from the twig
    ctx.strokeStyle = C.brown;
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.moveTo(hx, twigY);
    ctx.lineTo(hx, hy - r * Math.max(0.2, grow));
    ctx.stroke();
    ctx.restore();
    if (grow > 0.02) this.fruitAt(tier, hx, hy, r * (this.opts.reducedMotion ? grow : ease.outBack(grow)), r, 0);
  }

  // ── the borders, the gleaners, the fliers ───────────────────────
  /** The vine along both borders: its leaves come with V, its shoots (top) with the steady hold; a flash on the gather. */
  private drawVine(sim: UrodzajSim): void {
    const { ctx, L } = this;
    const u = L.u, bw = L.border;
    const top = TOP + 6, bottom = this.h - BOTTOM - 6;
    const n = Math.max(6, Math.floor((bottom - top) / (34 * u)));
    const lit = Math.round(this.vineK * n);
    const blind = sim.block?.kind === 'zbior' && sim.block.blind && sim.phase === 'play';
    ctx.save();
    for (const side of [0, 1]) {
      const cx = side ? this.w - bw / 2 : bw / 2;
      ctx.fillStyle = mix(C.dark, C.vine, 0.25);
      ctx.fillRect(side ? this.w - bw : 0, top - 6, bw, bottom - top + 12);
      // the stem
      for (let y = top; y < bottom; y += 4.2 * u) {
        const x = cx + Math.sin(y * 0.035 + side * 2) * bw * 0.18;
        stone(ctx, x, y, 3.4 * u, 0.3, mix(C.vine, C.brown, 0.35));
      }
      // the leaves, from the bottom up
      for (let i = 0; i < n; i++) {
        const y = bottom - (i + 0.5) * ((bottom - top) / n);
        const x = cx + Math.sin(y * 0.035 + side * 2) * bw * 0.18;
        const on = i < lit;
        // the leaves spill inward over the scene, so the vine's growth reads at a glance
        const inward = side ? -1 : 1;
        ctx.globalAlpha = on ? 1 : 0.22;
        paintVineLeaf(ctx, x + inward * bw * (i % 2 ? 0.55 : 0.25), y, bw * (on ? 0.62 : 0.45), inward * (i % 2 ? 0.7 : 0.2), on && this.vineFlash > 0);
        if (on && i % 3 === 2) {
          ctx.fillStyle = mix(C.lilac, C.dark, 0.45);
          for (let g = 0; g < 3; g++) {
            ctx.beginPath();
            ctx.arc(x + inward * bw * (0.35 + (g % 2) * 0.2), y + bw * (0.55 + g * 0.18), bw * 0.13, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      // the shoots at the top
      if (sim.vineLive) {
        for (let k = 0; k < sim.shoots; k++) {
          const y = top + 10 * u + k * 12 * u;
          stone(ctx, cx + (k % 2 ? 1 : -1) * bw * 0.25, y, 4 * u, 0.785, k === sim.shoots - 1 ? C.gold : C.leaf);
        }
      }
      if (this.vineFlash > 0) {
        ctx.globalAlpha = this.vineFlash * 0.4;
        ctx.fillStyle = '#E9F2C4';
        ctx.fillRect(side ? this.w - bw : 0, top, bw, bottom - top);
        ctx.globalAlpha = 1;
      }
      if (blind) {
        // a cloud over the vine: it grows, unseen
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = '#ECE8EF';
        ctx.fillRect(side ? this.w - bw : 0, top, bw, bottom - top);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /** Two gleaners at the field's edge, the spilled fruit in a small heap at their feet. */
  private drawGleaners(): void {
    const { ctx, L } = this;
    const g = L.gleaners;
    ctx.save();
    paintGuest(ctx, GLEANER, g.x, g.y + g.size * 0.5, g.size, 1);
    paintGuest(ctx, GLEANER2, g.x - g.size * 0.42, g.y + g.size * 0.55, g.size * 0.9, 1, 0.95);
    // the gleaned fruit: a little heap that grows (the newest nine)
    const r = g.size * 0.1;
    this.gleanTiers.forEach((tier, i) => {
      const row = i < 4 ? 0 : i < 7 ? 1 : 2;
      const col = row === 0 ? i : row === 1 ? i - 4 : i - 7;
      const x = g.x - g.size * 0.2 + (col - (row === 0 ? 1.5 : row === 1 ? 1 : 0.5)) * r * 2.1;
      const y = g.y + g.size * 0.5 - r - row * r * 1.8;
      this.fruitAt(Math.min(tier, 6), x, y, r, r, 0);
    });
    ctx.restore();
  }

  private drawFliers(): void {
    const { ctx } = this;
    for (const f of this.fliers) {
      const k = clamp((f.t - f.delay) / f.dur);
      if (f.t < f.delay) continue;
      const e = ease.inOutSine(k);
      if (f.kind === 'glean') {
        // a roll and a hop over the wall to the field's edge
        const x = f.x0 + (f.x1 - f.x0) * e;
        const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * k) * 40 * this.L.u;
        const r = f.r * (1 - 0.5 * k);
        this.fruitAt(f.tier, x, y, r, f.r, f.angle + k * 6);
      } else {
        const x = f.x0 + (f.x1 - f.x0) * e;
        const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * k) * 60 * this.L.u;
        ctx.globalAlpha = 1 - k * 0.4;
        this.fruitAt(f.tier, x, y, f.r * (1 - 0.6 * k), f.r, 0);
        ctx.globalAlpha = 1;
        if (!this.opts.reducedMotion && Math.random() < 0.5) this.particles.burst(x, y, 1, { color: C.gold, speed: 20, spread: TAU, g: 30, drag: 2, life: 0.5, size: 2, shape: 'spark' });
      }
    }
  }

  private drawRings(): void {
    const { ctx } = this;
    ctx.save();
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (1 + 0.6 * ease.outCubic(k)), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** While the signal is unreliable a soft mist drifts over the orchard (the runner's banner says why). */
  private drawMist(sim: UrodzajSim): void {
    const m = sim.mist;
    if (m < 0.02) return;
    const { ctx } = this;
    const rm = this.opts.reducedMotion;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const y = TOP + (this.h - TOP - BOTTOM) * (0.2 + 0.22 * i);
      const dx = rm ? 0 : Math.sin(this.clock * 0.25 + i * 1.7) * 40;
      const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
      g.addColorStop(0, 'rgba(244,240,234,0)');
      g.addColorStop(0.5, `rgba(244,240,234,${0.32 * m})`);
      g.addColorStop(1, 'rgba(244,240,234,0)');
      ctx.fillStyle = g;
      ctx.fillRect(dx - 60, y - 60, this.w + 120, 120);
    }
    ctx.restore();
  }

  // ── the evening at the table ────────────────────────────────────
  private drawEvening(sim: UrodzajSim): void {
    const { ctx, L } = this;
    const k = clamp((sim.phaseT - RULES.carryAt - 0.3) / 0.9);
    if (k <= 0) return;
    const rm = this.opts.reducedMotion;
    const st = tableState(tablePoints(sim.p));
    // the end seats reach 1.14 half-widths and a figure beyond: the table fits them on a phone
    const tw = Math.min((this.w - 2 * L.border - 24) / 1.36, L.s * 1.05, 620);
    const ty = L.floorY - L.s * 0.5;
    ctx.save();
    ctx.globalAlpha = rm ? k : 1;
    const rise = rm ? 0 : (1 - ease.outCubic(k)) * 40 * L.u;
    // the lamps' warm glow on the ground
    const g = ctx.createRadialGradient(L.cx, ty, 0, L.cx, ty, tw * 0.8);
    g.addColorStop(0, `rgba(255,214,140,${0.35 * k})`);
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(L.cx - tw, ty - tw * 0.8, tw * 2, tw * 1.6);
    for (const [id, t0] of this.arriving) this.arrivingK.set(id, clamp((this.clock - t0) / 0.8));
    paintTable(ctx, L.cx, ty + rise, tw, { built: Math.max(1, st.built), guests: sim.p.guests, t: this.clock, arriving: this.arrivingK, bowl: Math.max(2, sim.p.bestTier), still: rm });
    ctx.restore();
  }

  private readonly arrivingK = new Map<string, number>();

  private drawEnough(): void {
    const { ctx, w, L } = this;
    const k = clamp(this.enoughT / 0.9);
    if (k <= 0) return;
    const u = L.u;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 32 * u;
    ctx.font = font(500, size, SERIF, true);
    let tw = ctx.measureText(ENOUGH).width;
    if (tw > w - 80) {
      size = Math.max(16, (size * (w - 80)) / tw);
      ctx.font = font(500, size, SERIF, true);
      tw = ctx.measureText(ENOUGH).width;
    }
    const y = L.portrait ? Math.max(L.tip.y + L.tip.h + size * 1.6, L.floorY - L.s * 1.05) : L.floorY - L.s * 1.05;
    const pw = tw + 48 * u, ph = size + 26 * u;
    plaque(ctx, w / 2 - pw / 2, y - ph / 2, pw, ph, 14 * u, 0.94);
    ctx.fillStyle = mix(C.lilac, C.dark, 0.45);
    ctx.fillText(ENOUGH, w / 2, y + 1);
    ctx.restore();
  }

  /** The calibration intro: the orchard's mosaic laid stone by stone as the reference fills (intro.ts). */
  intro(dt: number, p: number, progress: UrodzajProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress, this.dpr);
  }
}
