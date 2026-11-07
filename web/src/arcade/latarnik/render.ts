/**
 * Latarnik's play view, all on the canvas: a radial night sea around the lighthouse, the turning
 * beam and its reach, boats, fog when the signal fails, the Cisza glow and its amber, the
 * finisher's dawn, and the juice on every rule's event.  It only reads the sim (sim.ts).  The HUD
 * and its overlays live in hud.ts, the calibration intro in intro.ts, the lobby's picture in preview.ts.
 * The reach ring and its label show only in a Konwój with its ring: in a Cisza the ring stays
 * faint and still, so the glow is the one thing the band changes there; at dawn the rings fade.
 * A reach past the horizon draws its ring at the edge and brightens the horizon instead, so it
 * never leaves the screen.  A frame allocates nothing: points go through one scratch pair.
 */
import { Particles, approach, clamp, ease } from '../kit/juice';
import { LETTERS, UPGRADE_NAME, UPGRADE_WHAT, VILLAGE } from './content';
import { Hud, NumText, age, fitSlot, font } from './hud';
import { cap, nightName, t } from './i18n';
import { DuskIntro } from './intro';
import { BOTTOM, TOP, layout, type Layout } from './layout';
import { starsOf, village, type LatarnikProgress } from './meta';
import {
  C, HARBOUR, NO_DASH, SANS, SERIF, amberSprite, hash, paintBadge, paintBeam, paintBoat, paintBubbles, paintBuoy, paintIsland, paintIsolines, paintRain,
  paintSandbank, paintWhale, sprites, type AmberSprite, type BoatLook, type IslandLook,
} from './paint';
import { UPGRADE_MAX } from './rules';
import { DEG, RULES, TAU, angDiff, reachFor, type Boat, type LatarnikSim, type Nugget, type SimEvent } from './sim';

/** a crate or a piece of amber flying along a curve; `t` starts below 0 for a staggered start */
interface Flier { x0: number; y0: number; x1: number; y1: number; bend: number; t: number; dur: number; kind: 'crate' | 'amber' }
/** a point of the finisher's constellation, in the sea's own coordinates (survives a resize) */
interface Star { a: number; r: number; delay: number; link: number }

/** The reach ring stays inside the screen: beyond this (R) the horizon brightens instead. */
const RING_MAX = 1.03;
/** The beam's drawn length at most (R). */
const BEAM_MAX = 1.05;
const GHOST_DASH = [3, 7];
/** Words drawn every frame of a moment, looked up once. */
const DAWN_TITLE = t('block.dawn');
const THRESHOLD = t('ring.threshold');
/** a ring that spreads on the water (the bell where a fog-bound boat hides, a found boat) */
interface Ripple { a: number; r: number; t: number; dur: number; color: string }

export class LatarnikView {
  private readonly ctx: CanvasRenderingContext2D;
  private L: Layout = layout(390, 844);
  private dpr = 1;
  /** the runner draws during calibration too: until play begins the intro owns the canvas */
  private started = false;
  private clock = 0;
  private readonly particles = new Particles(360);
  private readonly fliers: Flier[] = [];
  private flare = 0;
  private dim = 0;
  /** a tap that found a boat only beyond the reach: the light's tip flickers */
  private short = 0;
  private pulse: { color: string; at: 'horizon' | 'shore'; t: number } | null = null;
  private lights = 0;
  private flat = 0;
  private beamLen: number = RULES.warmReach;
  /** the rings' presence: they fade away at dawn */
  private rings = 1;
  private dawn = 0;
  private stars: Star[] | null = null;
  private dawnLine = '';
  private fadeIn = 1;
  private shake = 0;
  private fog: HTMLCanvasElement | null = null;
  /** the ring labels step back while a title passes over them; the time between two draws */
  private readonly labelAlpha = [1, 1];
  private drawnAt = 0;
  private drawDt = 0;
  private grad: { bg: CanvasGradient; moon: CanvasGradient; vignette: CanvasGradient; dawn: CanvasGradient } | null = null;
  /** made once per size: the dashes of the reef and the reach ring, the labels' fonts */
  private reefDash = NO_DASH;
  private reachDash = NO_DASH;
  private thresholdDash = NO_DASH;
  private labelFonts = ['', ''];
  private readonly reachTxt = new NumText(n => t('ring.reach', { n }));
  private ghostText = '';
  private ghostW = 0;
  private readonly dawnTitle = fitSlot();
  private readonly dawnSub = fitSlot();
  /** the island as the progress builds it (remade when the crates change), and the amber on the seabed */
  private readonly look: IslandLook = { built: 0, partial: 0, lamp: 1, windows: 1 };
  private cratesSeen = -1;
  private readonly boatLook: BoatLook = { light: 0, lit: false, dark: false, alpha: 1 };
  private readonly nuggetArt = new WeakMap<Nugget, { art: AmberSprite; R: number; dpr: number }>();
  /** px() writes here: a point on the sea in CSS px */
  private readonly at = { x: 0, y: 0 };
  private readonly dusk = new DuskIntro();
  private readonly hud: Hud;
  private readonly ripples: Ripple[] = [];
  /** the squall's wind: its warning streaks and its blow (0..1), its side (+1 clockwise) */
  private wind = 0;
  private windDir = 1;
  private rain = 0;
  private whaleLit = 0;
  private hudTop = TOP + 60;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
  }

  resize(w: number, h: number, dpr: number, hudTop = this.hudTop): void {
    this.hudTop = hudTop;
    const L = (this.L = layout(w, h, hudTop));
    this.dpr = dpr;
    this.grad = null;
    this.fog = null;
    this.reefDash = [L.R * 0.012, L.R * 0.03];
    this.reachDash = [0.01, Math.max(7, L.R * 0.024)];
    this.thresholdDash = [2, Math.max(5, L.R * 0.016)];
    this.labelFonts = [font(650, 11 * L.u, SANS), font(650, 10.5 * L.u, SANS)];
    this.reachTxt.reset();
    this.ghostText = '';
    this.hud.resize(L, dpr);
  }

  /** Play begins: the sea fades in from the dusk. */
  start(): void {
    this.started = true;
    this.fadeIn = 1;
  }

  /** What the title over the sea and the card slot show now, and where the card is (tests and debugging). */
  get showing() { return this.hud.showing; }

  /** Where things are (index.ts points its coach marks at them). */
  get layout(): Layout { return this.L; }

  /** A point on the sea in CSS px (a copy). */
  point(a: number, r: number): { x: number; y: number } {
    const p = this.px(a, r);
    return { x: p.x, y: p.y };
  }

  /** The point at bearing `a` and distance `r` (R) on the sea, in the scratch pair. */
  private px(a: number, r: number): { x: number; y: number } {
    const { cx, cy, R } = this.L;
    this.at.x = cx + Math.cos(a) * r * R;
    this.at.y = cy + Math.sin(a) * r * R;
    return this.at;
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: LatarnikSim): void {
    const { u, cx, cy, R, s } = this.L;
    const hx = cx + s * HARBOUR.x, hy = cy + s * HARBOUR.y;
    switch (e.type) {
      case 'flash': {
        this.flare = this.opts.reducedMotion ? 0 : 1;
        let szereg = 0;
        for (const b of e.boats) {
          const { x, y } = this.px(b.a, b.r);
          this.particles.burst(x, y, 10, { color: C.cream, speed: 60, spread: TAU, g: 0, drag: 2.5, life: 0.6, size: 2, shape: 'spark' });
          this.particles.burst(x, y, 1, { color: C.gold, speed: 0, life: 0.7, size: 7, shape: 'ring', g: 0 });
          if (b.kind === 'butelka') continue;
          szereg++;
          this.hud.float(`+${b.cargo}`, x, y - 10 * u, C.gold, 17 * u);
          if (b.kind === 'mgla') this.hud.float(t('fx.found'), x, y - 30 * u, '#d8e6ff', 15 * u, true, 1.2);
        }
        const { x: fx, y: fy } = this.px(e.boats[0].a, e.boats[0].r);
        if (e.full) {
          this.hud.title(t('title.full'), C.cream, 26 * u, { dur: 1.5, min: 1, rank: 2, keep: 1.5 });
          if (!this.opts.reducedMotion) this.particles.burst(cx, cy, 1, { color: C.gold, speed: 0, life: 1, size: R * 0.45, shape: 'ring', g: 0 });
        } else if (e.perfect) this.hud.float(t('fx.perfect'), fx, fy - 34 * u, C.cream, 21 * u, true);
        if (szereg >= 2 && !e.full) this.hud.float(t('fx.row', { n: szereg }), fx, fy - 58 * u, C.coral, 19 * u, true, 1.3);
        break;
      }
      case 'empty':
        this.dim = 1;
        this.particles.burst(cx, cy, 6, { color: 'rgba(200,210,230,.6)', speed: 30, spread: TAU, g: -10, drag: 2, life: 0.5, size: 2 });
        break;
      case 'short': {
        // the light fell short of a boat: no cost; its tip flickers where it ends, and in a Konwój
        // with its ring the boat says how much was missing
        this.short = 1;
        if (!e.hint) break;
        const { x, y } = this.px(e.boat.a, e.boat.r);
        this.hud.float(t('fx.short', { n: Math.max(1, Math.round(e.short * 100)) }), x, y - 16 * u, 'rgba(255,210,122,.85)', 13 * u, false, 1.3);
        break;
      }
      case 'armed':
        this.hud.title(t('title.armed'), C.gold, 21 * u, { dur: 1.6, min: 1, rank: 2, keep: 2 });
        break;
      case 'home':
        if (e.boat.kind !== 'butelka') {
          this.particles.burst(hx, hy, 4 + e.boat.cargo * 2, { color: '#c89a5a', speed: 70, angle: -Math.PI / 2, spread: 1.6, g: 160, life: 0.7, size: 2.2, shape: 'square' });
          for (let i = 0; i < e.boat.cargo; i++) this.fly(hx, hy, cx + (hash(i + e.boat.id) - 0.5) * s * 1.2, cy + s * (0.1 + 0.4 * hash(i + 7 + e.boat.id)), 'crate', 0.55, i * 0.12);
        }
        break;
      case 'reef': {
        const { x, y } = this.px(e.boat.a, e.boat.r);
        this.particles.burst(x, y, 1, { color: e.free ? C.cream : C.coral, speed: 0, life: 0.8, size: 9, shape: 'ring', g: 0 });
        if (e.free) break;   // a warm-up boat only turns back
        this.hud.popLantern(e.lanterns);
        this.shake = this.opts.reducedMotion ? 0 : 0.5;
        break;
      }
      case 'bottle': {
        const { x, y } = this.px(e.boat.a, e.boat.r);
        this.hud.float(t('bottle', { n: e.letter, total: LETTERS.length }), x, y - 30 * u, '#bfe8cf', 17 * u, true, 2.2);
        break;
      }
      case 'tallShip': {
        const { x, y } = this.px(e.boat.a, e.boat.r);
        this.hud.float(t('fx.tall'), x, y - 52 * u, C.cream, 22 * u, true, 1.8);
        break;
      }
      case 'nightStart':
        if (sim.story) break;   // the opening card names the first night's place already
        this.hud.title(`${t('sub.night', { n: e.spec.n + 1, got: 0, goal: 0 }).split(' · ')[0]} · ${nightName(e.spec.kind)}`, e.spec.boss ? '#ffb39c' : C.cream, 26 * u,
          { dur: 2, min: 1.2, rank: 1 });
        this.hud.popLanterns();
        this.rain = e.spec.boss ? 0.5 : 0;
        break;
      case 'nightWon':
        this.particles.burst(cx, cy, 40, { color: C.gold, speed: 160, spread: TAU, g: 30, drag: 1.4, life: 1.3, size: 2.4, shape: 'spark' });
        if (!this.opts.reducedMotion) this.particles.burst(cx, cy, 1, { color: C.cream, speed: 0, life: 1.1, size: R * 0.7, shape: 'ring', g: 0 });
        this.hud.gull.cheer = 2;
        this.rain = 0;
        break;
      case 'rewind':
        this.hud.popLanterns();
        this.hud.gull.flap = 1;
        break;
      case 'progress':
        this.hud.popGoal();
        break;
      case 'order': {
        const { x, y } = this.px(e.boat.a, e.boat.r);
        this.hud.float(t('fx.order', { n: e.want }), x, y - 18 * u, C.gold, 15 * u, false, 1.2);
        break;
      }
      case 'spotted':
        this.ripples.push({ a: e.boat.a, r: e.boat.r, t: 0, dur: 0.9, color: 'rgba(255,233,168,.8)' });
        break;
      case 'ring':
        this.ripples.push({ a: e.boat.a, r: e.boat.r, t: 0, dur: 1.6, color: 'rgba(190,230,255,.55)' });
        break;
      case 'bump': {
        const { x, y } = this.px(e.boat.a, e.boat.r);
        this.hud.float(t('fx.bump'), x, y - 14 * u, C.cream, 14 * u, true, 1.1);
        break;
      }
      case 'rescue': {
        const { x, y } = this.px(e.boat.a0, e.boat.r0);
        this.hud.float(t('fx.rescue'), x, y - 40 * u, '#bfe8cf', 19 * u, true, 1.8);
        this.hud.gull.cheer = 1.5;
        break;
      }
      case 'flotilla':
        if (e.counted) this.hud.floatIsland(t('fx.flotilla'), C.gold, 15 * u, 1.8);
        break;
      case 'whaleWarn':
        break;
      case 'whale': {
        const { x, y } = this.px(e.whale.a, e.whale.r);
        this.whaleLit = 1;
        this.particles.burst(x, y - R * 0.04, 26, { color: '#e8f4ff', speed: 120, angle: -Math.PI / 2, spread: 1.2, g: 160, life: 0.9, size: 2.2, shape: 'spark' });
        this.hud.float(`${t('fx.whale')} +${e.crates}`, x, y - 36 * u, '#cfe6ff', 21 * u, true, 1.8);
        this.hud.gull.cheer = 1.2;
        break;
      }
      case 'gustWarn':
        this.windDir = e.kind === 'fast' ? 1 : -1;
        this.hud.title(t(e.kind === 'fast' ? 'fx.gustFast' : 'fx.gustBack'), '#ffb39c', 20 * u, { dur: RULES.gustWarn, min: 1, rank: 0 });
        break;
      case 'gust':
        this.shake = this.opts.reducedMotion ? 0 : 0.35;
        break;
      case 'upgrade':
        this.hud.note(t('fx.upgrade', { name: cap(UPGRADE_NAME[e.upgrade]), lv: e.level, max: UPGRADE_MAX[e.upgrade] }), cap(UPGRADE_WHAT[e.upgrade]));
        this.particles.burst(cx, cy, 30, { color: C.cream, speed: 110, spread: TAU, g: 0, drag: 2, life: 1, size: 2, shape: 'spark' });
        break;
      case 'telegraph':
        this.pulse = { color: e.next === 'cisza' ? C.teal : C.coral, at: e.next === 'cisza' ? 'shore' : 'horizon', t: 0 };
        break;
      case 'blockStart':
        // the runner's banner names the block; the sea answers with its telegraph's colour only
        break;
      case 'steady': {
        // under the reach's label: the lens tightens a notch
        const p = this.hud.under(0, this.at) ? this.at : this.px(-0.75, sim.reach);
        this.hud.float(t('fx.steady', { n: Math.round(e.bonus * 100) }), p.x, p.y + 10 * u, C.gold, 14 * u, false, 1.6);
        break;
      }
      case 'star': {
        this.hud.title(t('title.star'), C.gold, 24 * u, { dur: 1.8, min: 0.9, rank: 0 });
        this.hud.popLantern(e.lanterns - 1);
        // the convoy's cargo comes in from the horizon as one stream
        const { x, y } = this.px(hash(sim.starsWon * 7 + 1) * TAU, 0.96);
        for (let i = 0; i < RULES.starCrates; i++) this.fly(x, y, hx, hy, 'crate', 1.1, i * 0.14);
        break;
      }
      case 'blindReveal':
        this.hud.reveal(e.far);
        break;
      case 'reveal': {
        const { x, y } = this.px(e.nugget.a, e.nugget.r);
        this.particles.burst(x, y, 8, { color: C.honey, speed: 40, spread: TAU, g: 0, drag: 2, life: 0.7, size: 1.8, shape: 'spark' });
        break;
      }
      case 'washUp': {
        e.nuggets.forEach((n, i) => {
          const { x, y } = this.px(n.a, n.r);
          const { x: tx, y: ty } = this.px(n.a, 0.15);
          this.fly(x, y, tx, ty, 'amber', 0.9, i * 0.15);
        });
        this.hud.floatIsland(`+${t('crumbs', { n: e.nuggets.length })}`, C.honey, 15 * u, 2);
        break;
      }
      case 'amber':
        this.hud.card(e.piece, e.isNew, e.via);
        break;
      case 'built':
        this.particles.burst(cx, cy + s * 0.3, 24, { color: C.gold, speed: 90, spread: TAU, g: 40, drag: 1.5, life: 1.1, size: 2.2, shape: 'spark' });
        this.hud.floatIsland(t('port.grows', { names: VILLAGE[e.step].name }), C.gold, 15 * u, 2.2);
        break;
      case 'finale':
        this.hud.clearTitles();   // "Świt" takes the title's place
        this.dawnLine = t('dawn.line', { boats: t('boats', { n: sim.score }) });
        this.buildConstellation(sim);
        break;
      default:
        break;
    }
  }

  private fly(x0: number, y0: number, x1: number, y1: number, kind: Flier['kind'], dur: number, delay = 0): void {
    if (this.fliers.length > 40) return;
    this.fliers.push({ x0, y0, x1, y1, bend: (hash(this.fliers.length + x0) - 0.5) * 0.3, t: -delay, dur, kind });
  }

  private buildConstellation(sim: LatarnikSim): void {
    const n = Math.min(40, Math.max(3, sim.score));
    const pts: Star[] = [];
    for (let i = 0; i < n; i++) {
      // a sunflower spread, each star tied to its nearest earlier one
      const a = i * 2.39996 - Math.PI / 2;
      const r = 0.3 + 0.52 * Math.sqrt((i + 0.5) / n);
      let link = -1, best = Infinity;
      for (let j = 0; j < i; j++) {
        const d = (Math.cos(pts[j].a) * pts[j].r - Math.cos(a) * r) ** 2 + (Math.sin(pts[j].a) * pts[j].r - Math.sin(a) * r) ** 2;
        if (d < best) { best = d; link = j; }
      }
      pts.push({ a, r, delay: (i / n) * 1.4, link });
    }
    this.stars = pts;
  }

  // ── a frame ──────────────────────────────────────────────────────
  update(dt: number, sim: LatarnikSim): void {
    this.clock += dt;
    this.particles.update(dt);
    age(this.fliers, dt);
    age(this.ripples, dt);
    const g = sim.gust;
    this.wind = approach(this.wind, g.state === 'blow' ? 1 : g.state === 'warn' ? 0.55 : 0, dt, 0.25);
    this.rain = approach(this.rain, sim.spec.boss && sim.phase === 'play' ? 0.45 + 0.6 * this.wind : 0, dt, 0.6);
    this.whaleLit = Math.max(0, this.whaleLit - dt * 0.8);
    this.hud.update(dt);
    if (this.pulse && (this.pulse.t += dt) > RULES.telegraph) this.pulse = null;
    this.flare = Math.max(0, this.flare - dt * 3.5);
    this.short = Math.max(0, this.short - dt * 3);
    this.dim = sim.recharge > 0 ? 1 : Math.max(0, this.dim - dt * 4);
    this.lights = approach(this.lights, this.pulse?.at === 'horizon' ? 1 : 0, dt, 0.5);
    const calmish = sim.block?.kind === 'cisza' || this.pulse?.at === 'shore';
    this.flat = approach(this.flat, calmish ? 1 : 0, dt, 1.5);
    this.beamLen = approach(this.beamLen, sim.blind ? 1.02 : sim.reach, dt, 0.25);
    const dawn = sim.phase === 'finale' || sim.phase === 'done';
    this.rings = approach(this.rings, dawn ? 0 : 1, dt, 0.35);
    const dawnWant = dawn ? 1 : sim.phase === 'between' ? 0.3 : 0;
    this.dawn = approach(this.dawn, dawnWant, dt, dawnWant > this.dawn ? 0.7 : 0.5);
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.4);
    this.shake = Math.max(0, this.shake - dt * 2);
  }

  draw(sim: LatarnikSim): void {
    const { ctx, L } = this;
    const { w, h, cx, cy, R } = L;
    if (w < 2 || h < 2 || !this.started) return;
    this.drawDt = Math.min(0.1, Math.max(0, this.clock - this.drawnAt));
    this.drawnAt = this.clock;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = this.gradients();
    const t = this.clock;
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(t * 61) * this.shake * 4, Math.sin(t * 47 + 1) * this.shake * 4);
    ctx.fillStyle = g.bg;
    ctx.fillRect(-10, -10, w + 20, h + 20);
    ctx.fillStyle = g.moon;
    ctx.fillRect(0, 0, w, h);
    this.drawGlow(sim, t);
    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    paintIsolines(ctx, cx, cy, R, maxR, this.opts.reducedMotion ? 0 : t, this.flat, 1 - 0.35 * sim.fog);
    this.drawGlints(t);
    ctx.fillStyle = g.vignette;
    ctx.fillRect(-10, -10, w + 20, h + 20);
    this.drawDecor(t);
    this.drawNuggets(sim, t);
    this.drawRings(sim, t);
    this.drawWhale(sim, t);
    this.drawBoats(sim, t, false);
    this.drawRipples();
    this.drawFog(sim, t);
    paintIsland(ctx, cx, cy, L.s, t, this.island(starsOf(sim.p)));
    this.drawBeam(sim, t);
    this.drawLamp(sim, t);
    this.drawBoats(sim, t, true);
    this.drawLesson(sim, t);
    this.drawFliers();
    this.particles.draw(ctx);
    this.drawWind(t);
    this.drawDawn(sim, t);
    ctx.restore();
    this.hud.draw(sim, t);
    if (this.fadeIn > 0) {
      ctx.globalAlpha = ease.inOutSine(this.fadeIn);
      ctx.fillStyle = C.ink;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  /** The island's look for the village the crates have built (worked out again only when they change). */
  private island(stars: number): IslandLook {
    if (stars !== this.cratesSeen) {
      this.cratesSeen = stars;
      const v = village(stars);
      this.look.built = v.built;
      this.look.partial = v.next ? v.have / v.need : 0;
    }
    return this.look;
  }

  private gradients() {
    if (this.grad) return this.grad;
    const { ctx, L } = this;
    const { cx, cy, R, w, h } = L;
    const bg = ctx.createRadialGradient(cx, cy - R * 0.15, 0, cx, cy, Math.max(R * 1.7, Math.hypot(w, h) * 0.6));
    bg.addColorStop(0, '#15284f');
    bg.addColorStop(0.33, '#0e1c3c');
    bg.addColorStop(0.62, '#0a142e');
    bg.addColorStop(1, C.ink);
    const moon = ctx.createRadialGradient(cx - R * 0.5, cy - R * 0.55, 0, cx - R * 0.5, cy - R * 0.55, R * 0.75);
    moon.addColorStop(0, 'rgba(160,185,255,.11)');
    moon.addColorStop(1, 'rgba(160,185,255,0)');
    const vignette = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.5);
    vignette.addColorStop(0, 'rgba(3,6,15,0)');
    vignette.addColorStop(0.25, 'rgba(3,6,15,.45)');
    vignette.addColorStop(1, 'rgba(3,6,15,.75)');
    const dawn = ctx.createLinearGradient(w, 0, 0, h);
    dawn.addColorStop(0, 'rgba(255,170,150,.55)');
    dawn.addColorStop(0.5, 'rgba(240,140,160,.32)');
    dawn.addColorStop(1, 'rgba(120,90,170,.18)');
    this.grad = { bg, moon, vignette, dawn };
    return this.grad;
  }

  private drawGlow(sim: LatarnikSim, t: number): void {
    if (sim.glow < 0.004) return;
    const { ctx } = this;
    const { cx, cy, R } = this.L;
    const r = (RULES.glowFrom + sim.glow) * R;
    const sp = sprites();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 + 0.12 * Math.sin(t * 0.9);
    ctx.drawImage(sp.bloom, cx - r, cy - r, r * 2, r * 2);
    // plankton: tiny lights that twinkle inside the glow
    ctx.fillStyle = '#c4fff4';
    for (let i = 0; i < 160; i++) {
      const pr = (0.17 + 0.62 * Math.sqrt(hash(i * 2 + 1))) * R;
      if (pr > r) continue;
      const pa = hash(i * 5 + 3) * TAU + t * 0.01 * (hash(i) - 0.5);
      const tw = 0.5 + 0.5 * Math.sin(t * (1.1 + hash(i + 9) * 1.6) + i);
      ctx.globalAlpha = 0.75 * tw * Math.min(1, (r - pr) / (R * 0.04));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(pa) * pr, cy + Math.sin(pa) * pr, 0.8 + 0.9 * hash(i + 77), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The sea's small life: seals on a sandbank and two channel buoys, always in the same places. */
  private drawDecor(t: number): void {
    const { ctx } = this;
    const { R, boat } = this.L;
    const sp = sprites();
    let p = this.px(2.45, 0.66);
    paintSandbank(ctx, p.x, p.y, R * 0.16, this.opts.reducedMotion ? 0 : t);
    p = this.px(-0.95, 0.8);
    paintBuoy(ctx, p.x, p.y, boat * 0.28, false, t, sp.coralGlow);
    p = this.px(0.62, 0.74);
    paintBuoy(ctx, p.x, p.y, boat * 0.28, true, t, sp.greenGlow);
  }

  /** Moonlight catching the swell: a few points that twinkle across the sea. */
  private drawGlints(t: number): void {
    const { ctx } = this;
    const { cx, cy, R } = this.L;
    ctx.fillStyle = '#dfe8ff';
    for (let i = 0; i < 46; i++) {
      const a = hash(i + 800) * TAU, r = (0.24 + 0.8 * hash(i + 801)) * R;
      const tw = Math.sin(t * (0.7 + 0.9 * hash(i + 802)) + i * 2.3);
      if (tw < 0.55) continue;
      ctx.globalAlpha = (tw - 0.55) * 0.75 * (r < R ? 1 : 0.4);
      ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
  }

  /** The amber the glow has revealed on the seabed, each piece drawn once into its own sprite. */
  private drawNuggets(sim: LatarnikSim, t: number): void {
    const { ctx, dpr } = this;
    const { R } = this.L;
    const sp = sprites();
    for (const n of sim.nuggets) {
      if (!n.revealed) continue;
      const { x, y } = this.px(n.a, n.r);
      const sz = R * 0.024 * n.size;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2 + n.a * 5);
      ctx.drawImage(sp.honey, x - sz * 3, y - sz * 3, sz * 6, sz * 6);
      ctx.restore();
      let kept = this.nuggetArt.get(n);
      if (!kept || kept.R !== R || kept.dpr !== dpr) {
        kept = { art: amberSprite(sz * 2.2, sz * 1.7, dpr, null, 'honey', n.a * 9), R, dpr };
        this.nuggetArt.set(n, kept);
      }
      ctx.drawImage(kept.art.c, x - kept.art.w / 2, y - kept.art.h / 2, kept.art.w, kept.art.h);
    }
  }

  private drawRings(sim: LatarnikSim, t: number): void {
    const { ctx } = this;
    const { cx, cy, R, u } = this.L;
    ctx.save();
    // the horizon and the reef
    ctx.strokeStyle = 'rgba(150,175,235,.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(225,238,255,.22)';
    ctx.lineWidth = Math.max(1, R * 0.006);
    ctx.setLineDash(this.reefDash);
    ctx.lineDashOffset = t * R * 0.01;
    ctx.beginPath();
    ctx.arc(cx, cy, RULES.reef * R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
    ctx.fillStyle = 'rgba(8,12,24,.55)';
    for (let i = 0; i < 9; i++) {
      const a = hash(i + 50) * TAU, rr = RULES.reef * R * (0.98 + 0.06 * hash(i + 60));
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * 0.008, R * 0.005, a, 0, TAU);
      ctx.fill();
    }
    // the telegraph: a ring pulse and lights on the horizon
    if (this.pulse) {
      const k = this.pulse.t / RULES.telegraph;
      const at = this.pulse.at === 'horizon' ? R : R * 0.24;
      ctx.strokeStyle = this.pulse.color;
      for (let i = 0; i < 2; i++) {
        const q = (k * 2 + i * 0.5) % 1;
        ctx.globalAlpha = 0.5 * (1 - q) * Math.min(1, (1 - k) * 4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, at + (this.pulse.at === 'horizon' ? -q * R * 0.08 : q * R * 0.12), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (this.lights > 0.01) {
      ctx.fillStyle = C.cream;
      for (let i = 0; i < 7; i++) {
        const a = hash(i + 90 + Math.floor(t / 8)) * TAU;
        ctx.globalAlpha = this.lights * (0.4 + 0.6 * Math.max(0, Math.sin(t * 5 + i * 1.7)));
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R * 0.985, cy + Math.sin(a) * R * 0.985, 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // the reach is feedback only in a Konwój with its ring: there yesterday's best reach, faint, and
    // today's as a living dotted ring with its number; in a Cisza it holds, faint and still; at dawn
    // the rings fade away.  Past the horizon the ring stays at its edge and the horizon brightens.
    const kind = sim.block?.kind, fade = this.rings;
    let ghost = false, reach = false;
    if (fade > 0.02 && kind === 'konwoj' && !sim.blind) {
      if (sim.ghost) {
        const gr = Math.min(sim.ghost.reach, RING_MAX) * R;
        ctx.globalAlpha = fade;
        ctx.strokeStyle = 'rgba(230,236,255,.2)';
        ctx.setLineDash(GHOST_DASH);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, gr, 0, TAU);
        ctx.stroke();
        ctx.setLineDash(NO_DASH);
        ctx.font = this.labelFonts[1];
        if (this.ghostText !== sim.ghost.label) {
          this.ghostText = sim.ghost.label;
          this.ghostW = ctx.measureText(this.ghostText).width;
        }
        this.ringLabel(1, this.ghostText, this.ghostW, gr, -2.35, 'rgba(230,236,255,.45)', 10.5 * u, fade);
        ghost = true;
      }
      // the threshold, marked on the sea itself: the reach the band's threshold gives (0.71 R); the light
      // past it turns the ring gold and its ticks bright
      const tr = reachFor(0.5) * R, over = sim.reach >= reachFor(0.5);
      ctx.globalAlpha = fade * (sim.reliable ? 1 : 0.4);
      ctx.strokeStyle = over ? 'rgba(255,210,122,.55)' : 'rgba(200,214,240,.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash(this.thresholdDash);
      ctx.beginPath();
      ctx.arc(cx, cy, tr, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
      ctx.lineWidth = over ? 2.2 : 1.4;
      ctx.strokeStyle = over ? C.gold : 'rgba(220,230,250,.5)';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.13;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (tr - 4 * u), cy + Math.sin(a) * (tr - 4 * u));
        ctx.lineTo(cx + Math.cos(a) * (tr + 4 * u), cy + Math.sin(a) * (tr + 4 * u));
        ctx.stroke();
      }
      ctx.font = this.labelFonts[1];
      ctx.globalAlpha = fade * 0.75;
      ctx.fillStyle = over ? C.gold : 'rgba(220,230,250,.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(THRESHOLD, cx + Math.cos(2.2) * (tr + 12 * u), cy + Math.sin(2.2) * (tr + 12 * u));
      ctx.globalAlpha = 1;
      const rr = Math.min(sim.reach, RING_MAX) * R;
      if (sim.reach > 1) {
        // the light reaches past the horizon: the horizon itself lights up, the more the farther
        const k = clamp((sim.reach - 1) / 0.15);
        ctx.strokeStyle = C.gold;
        ctx.globalAlpha = fade * (sim.reliable ? 0.1 + 0.12 * k : 0.06);
        ctx.lineWidth = 3 + 5 * k;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = fade * (sim.reliable ? 0.35 + 0.45 * k : 0.2);
        ctx.lineWidth = 1 + 1.2 * k;
        ctx.stroke();
      }
      this.reachRing(rr, sim.reliable ? 'rgba(255,214,140,.75)' : 'rgba(255,214,140,.3)', -t * 6, fade);
      ctx.font = this.labelFonts[0];
      const text = this.reachTxt.get(Math.round(sim.reach * 100), ctx);
      this.ringLabel(0, text, this.reachTxt.w, rr, -0.75, sim.reliable ? 'rgba(255,220,160,.85)' : 'rgba(255,220,160,.4)', 11 * u, fade);
      reach = true;
    } else if (fade > 0.02 && kind === 'cisza') this.reachRing(Math.min(sim.reach, RING_MAX) * R, 'rgba(255,214,140,.2)', 0, fade);
    if (!ghost) this.hud.release(1);
    if (!reach) this.hud.release(0);
    ctx.restore();
  }

  private reachRing(r: number, color: string, offset: number, alpha: number): void {
    const { ctx } = this;
    const { cx, cy, R } = this.L;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, R * 0.0065);
    ctx.setLineDash(this.reachDash);
    ctx.lineDashOffset = offset;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
    ctx.globalAlpha = 1;
  }

  /** A ring's label beside it (slot 0 the reach, 1 the last day's), `tw` px wide in the font already set, kept clear of floating words. */
  private ringLabel(slot: 0 | 1, text: string, tw: number, r: number, a: number, color: string, size: number, fade: number): void {
    const { ctx } = this;
    const { cx, cy, u } = this.L;
    // beside the ring, kept on the canvas and out of the runner's strips
    const ax = cx + Math.cos(a) * (r + 12 * u);
    const left = Math.cos(a) > 0.2 ? ax : Math.cos(a) < -0.2 ? ax - tw : ax - tw / 2;
    const x = clamp(left, 10, this.L.w - 10 - tw);
    const y = clamp(cy + Math.sin(a) * (r + 12 * u), TOP + size, this.L.h - BOTTOM - size);
    this.hud.reserve(slot, x - 4, y - size * 0.75, x + tw + 4, y + size * 0.75);
    // a title over the sea passes in front: the label steps back meanwhile
    const want = this.hud.overTitle(x, y - size / 2, x + tw, y + size / 2) ? 0.12 : 1;
    this.labelAlpha[slot] = approach(this.labelAlpha[slot], want, this.drawDt, 0.12);
    ctx.globalAlpha = this.labelAlpha[slot] * fade;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(5,10,24,.55)';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  private drawBoats(sim: LatarnikSim, t: number, home: boolean): void {
    const { ctx } = this;
    const { R, boat } = this.L;
    const sp = sprites();
    const look = this.boatLook;
    const reachPx = this.beamLen;
    for (const b of sim.boats) {
      if ((b.state === 'home') !== home) continue;
      if (b.state === 'home') {
        this.drawHomeBoat(b, sp.cream);
        continue;
      }
      let x: number, y: number, heading: number, alpha = 1;
      if (b.state === 'leaving') {
        const p = this.px(b.a0, b.r);
        x = p.x;
        y = p.y;
        const turn = Math.min(1, b.t / 0.6);
        heading = b.a0 + Math.PI * (1 - ease.inOutSine(turn));
        alpha = clamp(1 - (b.t - 0.6) / 1.8);
      } else {
        const p = this.px(b.a, b.r);
        const bob = this.opts.reducedMotion ? 0 : Math.sin(t * 1.7 + b.phase) * R * 0.004;
        x = p.x - Math.sin(b.a) * bob;
        y = p.y + Math.cos(b.a) * bob;
        heading = b.a + Math.PI + Math.sin(t * 0.9 + b.phase) * 0.07;
      }
      if (b.r > RULES.far) alpha *= 1 - 0.55 * sim.fog;
      if (b.hidden && b.state === 'sea') {
        // a fog-bound boat or the rowboat: seen only while the light has found it
        const k = clamp(b.seen / 0.5);
        this.hiddenHint(b, x, y, t, k);
        alpha *= k;
        if (alpha <= 0.01) continue;
      }
      // the beam lights a boat as it passes over it (if the light reaches it)
      let light = 0;
      if (b.state === 'sea' && b.r <= reachPx + 0.01) {
        const d = Math.abs(angDiff(b.a, sim.beam));
        light = clamp(1.25 - d / (RULES.wedge * 1.1));
      }
      if (sim.lesson === 'hold' && b.anchored) light = 1;
      look.light = light;
      look.lit = false;
      look.dark = b.dark;
      look.alpha = alpha;
      paintBoat(ctx, b.kind, x, y, heading, boat, look, sp.cream);
      if (b.state === 'leaving' && b.t < 0.9 && b.kind !== 'butelka') {
        ctx.globalAlpha = 0.8 * (Math.sin(b.t * 18) > 0 ? 1 : 0.2);
        ctx.fillStyle = b.practice ? C.cream : C.coral;   // a warm-up boat turns back at no cost
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.8, boat * 0.09), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (b.order > 0 && b.state === 'sea') {
        const now = sim.flotilla?.id === b.group && sim.flotilla.next === b.order;
        paintBadge(ctx, x, y - boat * 0.75, Math.max(7, boat * 0.3), b.order, now, alpha * (now ? 0.85 + 0.15 * Math.sin(t * 6) : 0.85));
      }
      if (b.kind === 'butelka' && b.state === 'sea') {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3 + b.phase);
        ctx.strokeStyle = '#bfe8cf';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, boat * 0.55, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /** A lit boat sails a curve (a quadratic Bézier around the island) into the harbour, its lantern on and a wake behind it. */
  private drawHomeBoat(b: Boat, glow: HTMLCanvasElement): void {
    const { ctx, L } = this;
    const { cx, cy, s, boat } = L;
    const hx = cx + s * HARBOUR.x, hy = cy + s * HARBOUR.y;
    const x0 = cx + Math.cos(b.a0) * b.r0 * L.R, y0 = cy + Math.sin(b.a0) * b.r0 * L.R;
    const dx = hx - x0, dy = hy - y0;
    // go around the island, on the side the boat is on
    const side = (x0 < cx ? -1 : 1) * (dy < 0 ? -1 : 1);
    const mx = (x0 + hx) / 2 - dy * 0.42 * side, my = (y0 + hy) / 2 + dx * 0.42 * side;
    const q = ease.inOutSine(clamp(b.t / b.dur));
    let k = 1 - q;
    const x = k * k * x0 + 2 * k * q * mx + q * q * hx, y = k * k * y0 + 2 * k * q * my + q * q * hy;
    const q2 = Math.min(1, q + 0.02);
    k = 1 - q2;
    const heading = Math.atan2(k * k * y0 + 2 * k * q2 * my + q2 * q2 * hy - y, k * k * x0 + 2 * k * q2 * mx + q2 * q2 * hx - x);
    ctx.fillStyle = 'rgba(230,240,255,.5)';
    for (let i = 1; i <= 9; i++) {
      const qq = q - i * 0.022;
      if (qq <= 0) break;
      k = 1 - qq;
      ctx.globalAlpha = 0.4 * (1 - i / 10);
      ctx.beginPath();
      ctx.arc(k * k * x0 + 2 * k * qq * mx + qq * qq * hx, k * k * y0 + 2 * k * qq * my + qq * qq * hy, Math.max(0.8, boat * 0.07 * (1 - i / 12)), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const look = this.boatLook;
    look.light = 0;
    look.lit = true;
    look.dark = false;
    look.alpha = q > 0.9 ? clamp((1 - q) / 0.1) : 1;
    paintBoat(ctx, b.kind, x, y, heading, boat * (1 - 0.35 * q), look, glow);
  }

  /** Where a hidden boat is, a hint only: a mist puff over a fog-bound boat, oar splashes by the rowboat. */
  private hiddenHint(b: Boat, x: number, y: number, t: number, seen: number): void {
    const { ctx } = this;
    const { boat } = this.L;
    ctx.save();
    if (b.kind === 'mgla') {
      const sp = sprites().cream;
      ctx.globalAlpha = 0.16 * (1 - seen * 0.6) * (0.8 + 0.2 * Math.sin(t * 0.8 + b.phase));
      ctx.drawImage(sp, x - boat * 1.6, y - boat * 1.1, boat * 3.2, boat * 2.2);
    } else {
      // two little splashes of the oars, now and then
      const q = (t * 0.7 + b.phase) % 1;
      if (q < 0.3) {
        ctx.globalAlpha = (1 - q / 0.3) * 0.7 * (1 - seen);
        ctx.fillStyle = '#e8f1ff';
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(x + Math.cos(b.a + Math.PI / 2) * boat * 0.45 * sgn, y + Math.sin(b.a + Math.PI / 2) * boat * 0.45 * sgn, 1.2 + q * 4, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  private drawRipples(): void {
    const { ctx } = this;
    const { boat } = this.L;
    if (!this.ripples.length) return;
    ctx.save();
    ctx.lineWidth = 1.4;
    for (const r of this.ripples) {
      const k = r.t / r.dur;
      const { x, y } = this.px(r.a, r.r);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      ctx.arc(x, y, boat * (0.5 + 1.6 * ease.outCubic(k)), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The whale: bubbles while it comes up, then its back and spout; lit for a moment after a flash. */
  private drawWhale(sim: LatarnikSim, t: number): void {
    const w = sim.whale;
    if (w.state === 'idle' && this.whaleLit <= 0) return;
    const { x, y } = this.px(w.a, w.r);
    const size = this.L.boat * 2.4;
    if (w.state === 'warn') paintBubbles(this.ctx, x, y, size, clamp(w.t / RULES.whaleWarn), t);
    else if (w.state === 'up') {
      const up = Math.min(clamp(w.t / 0.4), clamp((RULES.whaleUp - w.t) / 0.5));
      // the beam over it warms it
      const d = Math.abs(angDiff(w.a, sim.beam));
      paintWhale(this.ctx, x, y, size, up, t, d < RULES.wedge * 1.2 && w.r <= sim.reach ? 1 : 0);
    }
  }

  /** The squall: rain over everything, and in a gust's warning and blow, streaks of wind across the sea. */
  private drawWind(t: number): void {
    const { ctx } = this;
    const { w, h, cx, cy, R } = this.L;
    paintRain(ctx, w, h, this.opts.reducedMotion ? t * 0.4 : t, this.rain, this.windDir);
    if (this.wind < 0.02) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(220,235,255,.5)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 14; i++) {
      const r = (0.3 + 0.68 * hash(i + 950)) * R;
      const a0 = hash(i + 951) * TAU + this.windDir * t * (0.9 + 0.6 * hash(i + 952));
      const len = (0.25 + 0.3 * hash(i + 953)) * this.wind;
      ctx.globalAlpha = this.wind * (0.35 + 0.4 * hash(i + 954));
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + len * this.windDir, this.windDir < 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFog(sim: LatarnikSim, t: number): void {
    // a fog night keeps banks of mist over the far sea, whatever the signal
    const mist = sim.spec.kind === 'mgla' && !sim.ended ? 0.55 : 0;
    if (sim.fog < 0.01 && mist === 0) return;
    const { ctx } = this;
    const { cx, cy, R } = this.L;
    if (!this.fog) this.fog = fogSprite(R);
    const size = R * 3.4;
    ctx.save();
    ctx.globalAlpha = Math.max(sim.fog * 0.95, mist);
    ctx.translate(cx, cy);
    ctx.rotate(this.opts.reducedMotion ? 0 : t * 0.015);
    ctx.drawImage(this.fog, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private drawBeam(sim: LatarnikSim, t: number): void {
    const { ctx } = this;
    const { cx, cy, R } = this.L;
    const len = Math.max(R * 0.2, Math.min(this.beamLen, BEAM_MAX) * R);
    // the lamp shows the level only where the sim lets it (sim.lens): steady in a Cisza and a blind Konwój
    const intensity = clamp((0.62 + 0.38 * sim.lens) * (1 - 0.45 * this.dim) * (sim.reliable ? 1 : 0.62) + this.flare * 0.3 + (sim.blind ? 0.1 : 0), 0, 1.25);
    // gold, turning part-way to coral as the lens concentrates toward full reach
    const coral = sim.blind ? 0 : 0.6 * clamp((sim.reach - 0.85) / 0.25);
    paintBeam(ctx, cx, cy, sim.beam, len, intensity, coral);
    // the workshop's second beam, opposite and shorter
    if (sim.second) paintBeam(ctx, cx, cy, sim.beam + Math.PI, Math.max(R * 0.15, Math.min(this.beamLen * RULES.secondReach, BEAM_MAX) * R), intensity * 0.7, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.short > 0 && !sim.blind) {
      // the light's tip flickers where it ends: the boat lay beyond it
      ctx.globalAlpha = this.short * 0.7;
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(sim.reach, RING_MAX) * R, sim.beam - 8 * DEG, sim.beam + 8 * DEG);
      ctx.stroke();
    }
    // dust motes drifting through the light
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 34; i++) {
      const r = 0.16 + 0.86 * hash(i + 300);
      if (r > this.beamLen) continue;
      const a = hash(i + 400) * TAU + t * (0.03 + 0.05 * hash(i + 500)) * (i % 2 ? 1 : -1);
      const d = Math.abs(angDiff(a, sim.beam));
      if (d > 11 * DEG) continue;
      ctx.globalAlpha = intensity * 0.65 * (1 - d / (11 * DEG));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * R, cy + Math.sin(a) * r * R, 0.7 + 0.8 * hash(i + 600), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLamp(sim: LatarnikSim, t: number): void {
    const { ctx } = this;
    const { cx, cy, R, s } = this.L;
    const sp = sprites();
    const k = 0.55 + 0.45 * sim.lens;
    const r = s * (0.5 + 0.45 * k) * (1 + 0.3 * this.flare);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (sim.reliable ? 0.9 : 0.5) * (1 - 0.4 * this.dim);
    ctx.drawImage(sp.cream, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.6, s * 0.11), 0, TAU);
    ctx.fill();
    if (sim.recharge > 0) {
      ctx.strokeStyle = 'rgba(255,170,140,.75)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.36 + 3, -Math.PI / 2, -Math.PI / 2 + TAU * (sim.recharge / RULES.recharge));
      ctx.stroke();
    }
    if (sim.armed) {
      const p = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.strokeStyle = C.gold;
      ctx.globalAlpha = 0.45 + 0.4 * p;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.7 + p * 4, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * s * 0.85, cy + Math.sin(a) * s * 0.85);
        ctx.lineTo(cx + Math.cos(a) * (s * 0.85 + R * 0.025), cy + Math.sin(a) * (s * 0.85 + R * 0.025));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawLesson(sim: LatarnikSim, t: number): void {
    if (sim.lesson === 'done') return;
    let b: Boat | null = null;
    for (const x of sim.boats) if (x.anchored && x.state === 'sea') b = x;
    if (!b) return;
    const { ctx } = this;
    const { boat, u } = this.L;
    const { x, y } = this.px(b.a, b.r);
    const hold = sim.lesson === 'hold';
    const p = 0.5 + 0.5 * Math.sin(t * (hold ? 7 : 3));
    ctx.save();
    ctx.strokeStyle = hold ? C.cream : 'rgba(255,233,168,.6)';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = hold ? 0.6 + 0.4 * p : 0.3 + 0.3 * p;
    ctx.beginPath();
    ctx.arc(x, y, boat * (0.9 + 0.25 * p), 0, TAU);
    ctx.stroke();
    if (hold) {
      // a second ring closing in: "now" (the coach mark says it in words)
      const q = (t * 1.6) % 1;
      ctx.globalAlpha = 0.7 * (1 - q);
      ctx.beginPath();
      ctx.arc(x, y, boat * (2.2 - 1.2 * q) * (0.9 + 0.1 * u), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFliers(): void {
    const { ctx } = this;
    const size = Math.max(3, this.L.boat * 0.28);
    const honey = sprites().honey;
    for (const f of this.fliers) {
      if (f.t < 0) continue;
      const q = ease.inOutSine(clamp(f.t / f.dur));
      const mx = (f.x0 + f.x1) / 2 + (f.y1 - f.y0) * f.bend, my = (f.y0 + f.y1) / 2 - (f.x1 - f.x0) * f.bend - Math.abs(f.x1 - f.x0) * 0.15;
      const k = 1 - q;
      const x = k * k * f.x0 + 2 * k * q * mx + q * q * f.x1, y = k * k * f.y0 + 2 * k * q * my + q * q * f.y1;
      ctx.globalAlpha = q > 0.85 ? (1 - q) / 0.15 : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.55;
      ctx.drawImage(honey, x - size * 2.2, y - size * 2.2, size * 4.4, size * 4.4);
      ctx.restore();
      if (f.kind === 'crate') {
        ctx.fillStyle = '#b8864c';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = '#e1b878';
        ctx.fillRect(x - size / 2, y - size / 2, size, size * 0.32);
      } else {
        ctx.fillStyle = C.honey;
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.55, size * 0.42, 0.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The finisher: the sky turns pink and tonight's lanterns rise as a constellation. */
  private drawDawn(sim: LatarnikSim, t: number): void {
    if (this.dawn < 0.01) return;
    const { ctx } = this;
    const { w, h, cx, cy, R, u } = this.L;
    const g = this.gradients();
    ctx.save();
    ctx.globalAlpha = this.dawn * 0.85;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g.dawn;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    if (!this.stars || (sim.phase !== 'finale' && sim.phase !== 'done')) return;
    const T = sim.phase === 'done' ? RULES.finale + sim.phaseT : sim.phaseT;
    ctx.save();
    for (const st of this.stars) {
      const q = clamp((T - st.delay) / 1.1);
      if (q <= 0) continue;
      const e = ease.outCubic(q);
      let p = this.px(st.a, st.r);
      const x = cx + (p.x - cx) * e, y = cy + (p.y - cy) * e;
      if (st.link >= 0 && q >= 1) {
        p = this.px(this.stars[st.link].a, this.stars[st.link].r);
        ctx.strokeStyle = 'rgba(255,236,200,.35)';
        ctx.lineWidth = 1;
        ctx.globalAlpha = clamp((T - st.delay - 1.1) / 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const tw = 0.75 + 0.25 * Math.sin(t * 3 + st.a * 7);
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.arc(x, y, (1.6 + 1.2 * tw) * (q < 1 ? 1.4 : 1), 0, TAU);
      ctx.fill();
    }
    const k = clamp((T - 0.4) / 0.8);
    if (k > 0) {
      ctx.globalAlpha = k;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // as wide as the line under it: "Morgendämmerung" needs the room, and it stays over the sea
      const big = this.hud.fitIn(this.dawnTitle, DAWN_TITLE, Math.min(w - 32, R * 1.9), 44 * u, 500, SERIF, true);
      ctx.font = this.dawnTitle.font;
      ctx.fillStyle = 'rgba(40,20,40,.35)';
      ctx.fillText(DAWN_TITLE, cx + 1.5, cy - R * 0.5 + 2);
      ctx.fillStyle = '#fff3e6';
      ctx.fillText(DAWN_TITLE, cx, cy - R * 0.5);
      this.hud.fitIn(this.dawnSub, this.dawnLine, Math.min(w - 32, R * 1.9), 16 * u, 600, SANS);
      ctx.font = this.dawnSub.font;
      ctx.fillStyle = 'rgba(255,243,230,.9)';
      ctx.fillText(this.dawnLine, cx, cy - R * 0.5 + big * 0.85);
    }
    ctx.restore();
  }

  /** The calibration intro: the lighthouse at dusk (intro.ts). */
  intro(dt: number, p: number, progress: LatarnikProgress): void {
    const { w, h } = this.L;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.dusk.draw(this.ctx, w, h, dt, p, this.island(starsOf(progress)).built);
  }
}

/** Fog for an unreliable signal: soft banks over the far ring (rendered once per size, at low resolution). */
function fogSprite(R: number): HTMLCanvasElement {
  const scale = 0.3;
  const span = 3.4;   // the sprite covers ±1.7 R, so no bank is cut by its edge
  const size = Math.max(64, Math.round(R * span * scale));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const m = size / 2, k = size / span;   // k: R in sprite pixels
  // a soft veil over the far ring, then banks drifting in it
  const veil = g.createRadialGradient(m, m, k * 0.55, m, m, k * 1.45);
  veil.addColorStop(0, 'rgba(170,186,220,0)');
  veil.addColorStop(0.45, 'rgba(170,186,220,.16)');
  veil.addColorStop(0.75, 'rgba(170,186,220,.12)');
  veil.addColorStop(1, 'rgba(170,186,220,0)');
  g.fillStyle = veil;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const a = hash(i + 700) * TAU, r = (0.72 + 0.42 * hash(i + 701)) * k, br = (0.1 + 0.14 * hash(i + 702)) * k;
    const x = m + Math.cos(a) * r, y = m + Math.sin(a) * r;
    const gr = g.createRadialGradient(x, y, 0, x, y, br);
    gr.addColorStop(0, 'rgba(186,200,230,.16)');
    gr.addColorStop(1, 'rgba(186,200,230,0)');
    g.fillStyle = gr;
    g.fillRect(x - br, y - br, br * 2, br * 2);
  }
  return c;
}
