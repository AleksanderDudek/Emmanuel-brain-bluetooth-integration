/**
 * Arka's play view, all on the canvas: the ark's open deck in cool morning light (walnut hull, oak
 * deck, the rail around it), the animals walking out the way they face, the landing by the door
 * with its stalls and the family laying the next plank, the new land beyond the door; the Evening,
 * when straw covers the sleeping deck and the camera pans up to the valley at dusk where the dove
 * flies; the finisher's rainbow; and the juice on every rule's event.  It only reads the sim
 * (sim.ts).  The HUD lives in hud.ts, the calibration intro in intro.ts, the lobby in preview.ts.
 *
 * The deck's still parts are drawn once per layout into a sprite; a frame allocates nothing in its
 * loops (points go through scratch arrays).
 */
import { Particles, approach, clamp, ease } from '../kit/juice';
import { KIND, STAGES } from './content';
import { Hud } from './hud';
import { t } from './i18n';
import { ArkIntro } from './intro';
import { LandPainter, type LandLook } from './land';
import { SLOTS, cellAt, cellUnder, inRect, layout, railCoord, railGate, railPoint, railRect, stallAt, stallUnder, type Layout, type Pt, type Rect } from './layout';
import { homestead, type ArkaProgress } from './meta';
import { C, SERIF, SANS, font, glow, hash, paintAnimal, paintDove, paintFigure, paintHand, paintPlanks, paintRainbow, strawSprite } from './paint';
import { RULES, type ArkaSim, type Beast, type SimEvent } from './sim';
import { DX, DY, toEdge } from './holds';

const TAU = Math.PI * 2;
const ENOUGH = t('finale.enough');

/** Where an animal is drawn this frame. */
interface Spot { x: number; y: number; ang: number; size: number; alpha: number; squash: number; sleep: boolean }

export class ArkaView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 390;
  private h = 844;
  private dpr = 1;
  L: Layout = layout(390, 844, 4, 4, true);
  private layoutKey = '';
  private started = false;
  private clock = 0;
  private readonly particles = new Particles(320);
  private readonly strip = new LandPainter();
  private readonly big = new LandPainter();
  readonly hud: Hud;
  private readonly intro0 = new ArkIntro();
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private straw: HTMLCanvasElement | null = null;
  private strawKey = '';
  // moments
  private cam = 0;
  private strawK = 0;
  private dusk = 0;
  private lanterns = 0;
  private doorLight = 0;
  private dawnDoor = 0;
  private hitStop = 0;
  private slideK = 0;
  private plankAnim = 0;
  private hammerPhase = 0;
  private hammerArm = 0;
  /** the hammer struck this frame (the sound taps with it) */
  hammerHit = false;
  private shake = 0;
  private fadeIn = 1;
  private mist = 0;
  private morning = 0;
  private finaleT = -1;
  private finaleLine = '';
  private doveSeen = false;
  private readonly spot: Spot = { x: 0, y: 0, ang: 0, size: 0, alpha: 1, squash: 0, sleep: false };
  private readonly pt: Pt = { x: 0, y: 0 };
  private readonly pt2: Pt = { x: 0, y: 0 };
  /** a rail path's points (x, y pairs) and their running lengths */
  private readonly path = new Float32Array(24);
  private readonly lens = new Float32Array(12);
  private readonly look: LandLook = { settled: {}, young: [], olives: 0, built: 0 };

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.layoutKey = '';
  }

  start(): void {
    this.started = true;
    this.fadeIn = 1;
  }

  /** The layout for the hold showing (made again when the screen or the hold changes). */
  private relayout(sim: ArkaSim): Layout {
    const h = sim.hold;
    const anchored = h.recipe === 'warm';
    const key = `${this.w}|${this.h}|${h.cols}|${h.rows}|${anchored}`;
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.L = layout(this.w, this.h, h.cols, h.rows, anchored);
      this.hud.resize(this.L, this.dpr);
    }
    return this.L;
  }

  // ── hit-testing (index.ts maps touches through it) ───────────────
  cellAt(sim: ArkaSim, x: number, y: number): { x: number; y: number } | null {
    return cellUnder(this.relayout(sim), x, y);
  }

  /** The waiting animal in the stall under a point (null: none). */
  stallBeast(sim: ArkaSim, x: number, y: number): Beast | null {
    const i = stallUnder(this.relayout(sim), x, y);
    if (i < 0) return null;
    const b = sim.slots[i];
    return b && b.state === 'stall' && !b.mate ? b : null;
  }

  onLeaf(sim: ArkaSim, x: number, y: number): boolean { return inRect(this.relayout(sim).leaf, x, y, 6); }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: ArkaSim): void {
    const L = this.relayout(sim);
    const u = L.u, rm = this.opts.reducedMotion;
    switch (e.type) {
      case 'pair': {
        stallAt(L, Math.max(0, e.a.stall), this.pt);
        this.particles.burst(this.pt.x, this.pt.y, 10, { color: C.straw2, speed: 70, spread: TAU, g: 120, drag: 2, life: 0.7, size: 2, shape: 'square' });
        this.particles.burst(this.pt.x, this.pt.y - L.stall * 0.3, 6, { color: C.leaf, speed: 50, angle: -Math.PI / 2, spread: 1.6, g: 60, drag: 1.5, life: 0.9, size: 2.4, shape: 'dot' });
        this.hud.popScore();
        if (e.chain >= 2) this.hud.float(t('fx.chain', { n: e.chain }), this.pt.x, this.pt.y - L.stall * 0.7, '#8a4f22', 16, 1.3);
        break;
      }
      case 'bump': {
        const b = e.beast;
        cellAt(L, b.x, b.y, this.pt);
        const k = b.dist + 0.5;
        this.particles.burst(this.pt.x + DX[b.dir] * k * L.c, this.pt.y + DY[b.dir] * k * L.c, 5, { color: 'rgba(240,225,190,.8)', speed: 40, spread: TAU, g: 30, drag: 3, life: 0.45, size: 2 });
        break;
      }
      case 'full': {
        const b = e.beast;
        cellAt(L, b.x, b.y, this.pt);
        const k = toEdge(L.cols, L.rows, b.x, b.y, b.dir) + 0.5;
        this.hud.float(t('fx.full'), this.pt.x + DX[b.dir] * k * L.c, this.pt.y + DY[b.dir] * k * L.c - 18 * u, '#9c4f32', 15, 1.2);
        break;
      }
      case 'wait': {
        stallAt(L, e.beast.stall, this.pt);
        this.particles.burst(this.pt.x, this.pt.y + L.stall * 0.3, 6, { color: C.straw, speed: 30, spread: Math.PI, angle: -Math.PI / 2, g: 90, drag: 2, life: 0.5, size: 1.6, shape: 'square' });
        break;
      }
      case 'hand':
        stallAt(L, Math.max(0, e.beast.was), this.pt);
        this.hud.float(t(e.leaf ? 'fx.leaf' : 'fx.hand'), this.pt.x, this.pt.y - L.stall * 0.6, e.leaf ? '#4f7a2e' : '#6b4a2f', 15, 1.4);
        if (e.leaf) this.hud.popLeaf();
        else this.hud.popStars();
        break;
      case 'plank': {
        if (e.blind) break;
        this.plankAnim = 1;
        this.hitStop = 0.1;
        stallAt(L, Math.min(SLOTS - 1, RULES.stalls + e.planks - 1), this.pt);
        this.particles.burst(this.pt.x, this.pt.y, 16, { color: C.fresh2, speed: 90, spread: TAU, g: 160, drag: 1.6, life: 0.8, size: 2, shape: 'square' });
        if (sim.ftue !== 'plank') this.hud.float(t('fx.plank'), this.pt.x, this.pt.y - L.stall * 0.65, '#8a5a24', 15, 1.4);
        break;
      }
      case 'blindReveal':
        this.hud.card(e.planks > 0 ? t('fx.blind', { planks: t('planks', { n: e.planks }) }) : t('fx.blindNone'), '', { icon: e.planks > 0 ? 'plank' : 'none', rank: 0, dur: 2.8 });
        if (e.planks > 0) this.plankAnim = 1;
        break;
      case 'clear': {
        this.doorLight = 1;
        this.hud.card(t('fx.clear'), e.planks > 0 ? t('fx.carried', { planks: t('planks', { n: e.planks }) }) : '', { icon: 'stars', stars: e.stars, rank: 1, dur: 2.4 });
        const d = L.door;
        if (!rm) {
          this.particles.burst(d.x + d.w / 2, d.y + d.h * 0.3, 26, { color: '#fff1c4', speed: 120, angle: -Math.PI / 2, spread: 2.2, g: 40, drag: 1.4, life: 1.2, size: 2.4, shape: 'spark' });
          this.particles.burst(d.x + d.w / 2, d.y, 14, { color: C.leaf, speed: 90, angle: -Math.PI / 2, spread: 1.8, g: 50, drag: 1.2, life: 1.4, size: 2.6, shape: 'dot' });
          this.shake = 0.35;
        }
        break;
      }
      case 'hold':
        this.slideK = 1;
        if (e.hold.daily) this.hud.card(t('daily.title'), '', { rank: 1, dur: 1.8 });
        else if (e.hold.recipe === 'great') this.hud.card(t('hud.great').charAt(0) + t('hud.great').slice(1).toLowerCase(), '', { rank: 1, dur: 1.8 });
        break;
      case 'post':
        this.hud.card(t('fx.post'), t('fx.postSub'), { icon: 'post', rank: 0, dur: 2.8 });
        break;
      case 'almost':
        this.hud.card(t(e.have >= e.need * 0.5 ? 'fx.almost' : 'fx.later', { have: e.have, need: e.need }), '', { rank: 0, dur: 2.6, color: '#6b4a2f' });
        break;
      case 'dove': {
        const sub = e.olive ? t('fx.olive') : e.leaf && !e.stored ? t('fx.leavesFull') : '';
        this.hud.card(e.leaf ? t('fx.dove') : t('fx.noLeaf'), sub, { icon: e.leaf ? (e.olive ? 'olive' : 'leaf') : 'none', rank: 0, dur: 3 });
        if (e.leaf && e.stored) this.hud.popLeaf();
        break;
      }
      case 'kind':
        this.hud.card(t('fx.newKind', { name: e.kinds.map(k => KIND[k].name).join(', ') }), '', { rank: 2, dur: 2.6 });
        break;
      case 'young':
        this.hud.card(t('fx.young', { name: KIND[e.kind].young }), '', { rank: 2, dur: 2.4 });
        break;
      case 'built':
        this.hud.card(t('fx.built', { name: STAGES[e.stage].name }), '', { rank: 1, dur: 2.6 });
        break;
      case 'gift':
        this.hud.card(t('fx.gift', { n: e.points }), '', { rank: 3, dur: 2.4, icon: 'plank' });
        break;
      case 'finale':
        this.finaleT = 0;
        this.finaleLine = t('finale.line', { pairs: t('pairs', { n: sim.score }) });
        this.hud.clearCards();
        break;
      default:
        break;
    }
  }

  // ── a frame ──────────────────────────────────────────────────────
  update(dt: number, sim: ArkaSim): void {
    this.clock += dt;
    this.relayout(sim);
    this.particles.update(dt);
    this.hud.update(dt, sim);
    const b = sim.block;
    const evening = sim.phase !== 'play' || b.kind === 'evening';
    const next = sim.next;
    // the Day's telegraph in an Evening brings the deck back; the finisher stays on the land
    const toDay = sim.phase === 'play' && b.kind === 'evening' && next && sim.toNext !== null && sim.toNext <= RULES.telegraph;
    const veiled = evening && !toDay;
    const into = sim.phase === 'play' ? sim.now - b.start : 9;
    // the straw falls first, then the camera pans up; back again in the other order
    this.strawK = approach(this.strawK, veiled ? 1 : 0, dt, 0.25);
    const camWant = veiled && (into > 0.6 || sim.phase !== 'play') ? 1 : 0;
    this.cam = approach(this.cam, camWant, dt, camWant ? 0.45 : 0.35);
    const toEvening = sim.phase === 'play' && b.kind === 'day' && next && sim.toNext !== null && sim.toNext <= RULES.telegraph;
    this.dusk = approach(this.dusk, evening || toEvening ? 1 : 0, dt, 0.8);
    this.lanterns = approach(this.lanterns, evening || toEvening ? 1 : 0, dt, 0.5);
    this.dawnDoor = approach(this.dawnDoor, toDay ? 1 : 0, dt, 0.5);
    this.doorLight = Math.max(0, this.doorLight - dt * 0.8);
    this.plankAnim = Math.max(0, this.plankAnim - dt * 1.6);
    this.slideK = Math.max(0, this.slideK - dt / RULES.slide);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.5);
    this.mist = approach(this.mist, sim.fog, dt, 0.4);
    this.morning = approach(this.morning, sim.blindNow ? 1 : 0, dt, 0.6);
    if (this.finaleT >= 0) this.finaleT += dt;
    // the hammer: at the level's tempo in a sighted Day while a stall is being built
    this.hammerHit = false;
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dt);
    else if (sim.active && !sim.blindNow && sim.reliable && sim.hold.planks + sim.hold.pending < RULES.maxPlanks && sim.now - b.start >= 1) {
      this.hammerPhase += dt * sim.hammer;
      if (this.hammerPhase >= 1) {
        this.hammerPhase -= 1;
        this.hammerHit = true;
        const L = this.L;
        stallAt(L, Math.min(SLOTS - 1, sim.capacity), this.pt);
        if (!this.opts.reducedMotion) this.particles.burst(this.pt.x, this.pt.y + L.stall * 0.25, 3, { color: C.fresh2, speed: 40, angle: -Math.PI / 2, spread: 1.5, g: 150, drag: 2, life: 0.4, size: 1.4, shape: 'square' });
      }
    }
    this.hammerArm = this.hammerPhase < 0.25 ? 1 - this.hammerPhase / 0.25 : (this.hammerPhase - 0.25) / 0.75;
  }

  draw(sim: ArkaSim, press: number | null): void {
    const { ctx } = this;
    if (this.w < 2 || this.h < 2 || !this.started) return;
    this.relayout(sim);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const p = sim.p;
    this.look.settled = p.settled;
    this.look.young = p.young;
    this.look.olives = p.olives;
    this.look.built = homestead(p.home).built;
    const rm = this.opts.reducedMotion;
    const cam = rm ? (this.cam > 0.5 ? 1 : 0) : ease.inOutSine(this.cam);
    const crossfade = rm ? this.cam : 0;
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(this.clock * 61) * this.shake * 4, Math.sin(this.clock * 47 + 1) * this.shake * 3);
    if (cam < 0.999) {
      ctx.save();
      if (!rm) ctx.translate(0, cam * this.h * 0.85);
      this.drawDeckView(sim, press);
      ctx.restore();
    }
    if (cam > 0.001 || crossfade > 0) {
      ctx.save();
      if (rm) ctx.globalAlpha = crossfade;
      else ctx.translate(0, -(1 - cam) * this.h);
      this.drawLandView(sim);
      ctx.restore();
    }
    ctx.restore();
    this.particles.draw(ctx);
    const light = this.cam > 0.5 ? 1 : 0;
    this.hud.draw(sim, sim.now, light);
    if (this.finaleT >= 0) this.drawFinaleText();
    if (this.fadeIn > 0) {
      ctx.globalAlpha = ease.inOutSine(this.fadeIn);
      ctx.fillStyle = '#1c140e';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
  }

  // ── the deck view ────────────────────────────────────────────────
  private drawDeckView(sim: ArkaSim, press: number | null): void {
    const { ctx, L } = this;
    this.background();
    ctx.drawImage(this.bg!, 0, 0, this.w, this.h);
    // the new land beyond the door
    this.strip.draw(ctx, L.land.x, L.land.y, L.land.w, L.land.h, this.clock, this.look, { dusk: this.dusk * 0.8, still: this.opts.reducedMotion }, this.dpr);
    if (this.doveSeen || sim.dove.state === 'out' || sim.dove.state === 'home') this.drawStripDove(sim);
    this.drawLanding(sim);
    const slide = this.slideK > 0 ? ease.inOutSine(this.slideK) : 0;
    ctx.save();
    if (slide > 0) {
      ctx.translate(slide * this.w * 0.5, 0);
      ctx.globalAlpha = 1 - slide;
    }
    this.drawDeckCells(sim);
    if (press !== null) this.drawPress(sim, press);
    this.drawCursor(sim);
    this.drawBeasts(sim, false);
    ctx.restore();
    this.drawBeasts(sim, true);
    if (this.strawK > 0.01) this.drawStraw();
    this.drawLight(sim);
  }

  /** The hull, the deck's planks with the grid carved in, the rail, the landing's boards and the door: once per layout. */
  private background(): void {
    const L = this.L;
    const key = `${this.layoutKey}|${this.dpr}`;
    if (this.bg && this.bgKey === key) return;
    this.bgKey = key;
    const c = this.bg ?? document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w * this.dpr));
    c.height = Math.max(1, Math.round(this.h * this.dpr));
    const g = c.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // the hull: dark walnut boards everywhere
    paintPlanks(g, 0, 0, this.w, this.h, Math.max(18, L.c * 0.45), [C.walnut, '#3f2d20', C.walnut2, '#362619'], 3);
    // a cool morning light from above, darker toward the bottom
    const light = g.createLinearGradient(0, 0, 0, this.h);
    light.addColorStop(0, 'rgba(210,228,240,.10)');
    light.addColorStop(0.5, 'rgba(0,0,0,0)');
    light.addColorStop(1, 'rgba(10,6,4,.35)');
    g.fillStyle = light;
    g.fillRect(0, 0, this.w, this.h);
    const d = L.deck, r = railRect(L);
    // the rail: a raised beam around the deck
    g.fillStyle = 'rgba(12,8,5,.45)';
    g.fillRect(r.x - L.rail / 2 + 3, r.y - L.rail / 2 + 5, r.w + L.rail, r.h + L.rail);
    paintPlanks(g, r.x - L.rail / 2, r.y - L.rail / 2, r.w + L.rail, r.h + L.rail, L.rail * 0.5, ['#5a3d26', '#634329', '#523722'], 11);
    // the deck: oak boards, one row of cells each, the grid carved
    paintPlanks(g, d.x, d.y, d.w, d.h, L.c, [C.oak2, '#94693f', '#7f5a36', '#8f6744'], 7);
    g.fillStyle = 'rgba(255,236,200,.06)';
    g.fillRect(d.x, d.y, d.w, d.h);
    g.strokeStyle = 'rgba(30,18,10,.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 1; i < L.cols; i++) {
      g.moveTo(d.x + i * L.c, d.y + 2);
      g.lineTo(d.x + i * L.c, d.y + d.h - 2);
    }
    g.stroke();
    g.strokeStyle = 'rgba(255,240,210,.12)';
    g.beginPath();
    for (let i = 1; i < L.cols; i++) {
      g.moveTo(d.x + i * L.c + 1.2, d.y + 2);
      g.lineTo(d.x + i * L.c + 1.2, d.y + d.h - 2);
    }
    g.stroke();
    g.strokeStyle = C.ink;
    g.lineWidth = 2;
    g.strokeRect(d.x, d.y, d.w, d.h);
    // corner posts of the rail
    for (const [px, py] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
      g.fillStyle = '#3a281a';
      g.fillRect(px - L.rail * 0.45, py - L.rail * 0.45, L.rail * 0.9, L.rail * 0.9);
      g.fillStyle = 'rgba(255,230,190,.18)';
      g.fillRect(px - L.rail * 0.45, py - L.rail * 0.45, L.rail * 0.9, 2);
    }
    // the walkway from the rail to the landing
    railGate(L, r, this.pt);
    const gx = this.pt.x, gy = this.pt.y;
    g.strokeStyle = '#5a3d26';
    g.lineWidth = L.rail * 0.9;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(gx, gy);
    g.lineTo(L.gate.x, L.gate.y);
    g.stroke();
    g.strokeStyle = 'rgba(30,18,10,.6)';
    g.lineWidth = 1;
    g.stroke();
    // the landing: its boards (the first three stalls' worth, the rest open framework until planks come)
    const ld = L.landing;
    g.fillStyle = 'rgba(12,8,5,.45)';
    g.fillRect(ld.x + 3, ld.y + 5, ld.w, ld.h);
    paintPlanks(g, ld.x, ld.y, L.door.w + RULES.stalls * L.stall, ld.h, L.stall * 0.34, ['#8a6440', '#7f5a36', '#94693f'], 19, true);
    // the open framework where new stalls will be laid
    g.strokeStyle = 'rgba(160,120,80,.55)';
    g.lineWidth = 2;
    const fx = ld.x + L.door.w + RULES.stalls * L.stall;
    g.beginPath();
    g.moveTo(fx, ld.y + 3);
    g.lineTo(ld.x + ld.w, ld.y + 3);
    g.moveTo(fx, ld.y + ld.h - 3);
    g.lineTo(ld.x + ld.w, ld.y + ld.h - 3);
    for (let i = 0; i <= SLOTS - RULES.stalls; i++) {
      g.moveTo(fx + i * L.stall, ld.y + 3);
      g.lineTo(fx + i * L.stall, ld.y + ld.h - 3);
    }
    g.stroke();
    // the door: a dark frame at the landing's end, the ramp beyond it up to the land
    const dr = L.door;
    g.fillStyle = '#1f150e';
    g.fillRect(dr.x + dr.w * 0.18, dr.y + 4, dr.w * 0.64, dr.h - 8);
    g.strokeStyle = '#6b4a2f';
    g.lineWidth = Math.max(3, dr.w * 0.12);
    g.strokeRect(dr.x + dr.w * 0.18, dr.y + 4, dr.w * 0.64, dr.h - 8);
    g.strokeStyle = C.ink;
    g.lineWidth = 1.5;
    g.strokeRect(dr.x + dr.w * 0.1, dr.y + 1, dr.w * 0.8, dr.h - 2);
    // the ramp
    g.fillStyle = '#7f5a36';
    g.beginPath();
    g.moveTo(dr.x + dr.w * 0.2, dr.y + 2);
    g.lineTo(dr.x + dr.w * 0.8, dr.y + 2);
    g.lineTo(dr.x + dr.w * 0.72, L.land.y + L.land.h - 4);
    g.lineTo(dr.x + dr.w * 0.28, L.land.y + L.land.h - 4);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30,18,10,.6)';
    g.lineWidth = 1;
    g.stroke();
    this.bg = c;
  }

  /** The stalls: rough-board partitions for every stall built, the next one being laid, the family at work. */
  private drawLanding(sim: ArkaSim): void {
    const { ctx, L } = this;
    const ld = L.landing;
    const cap = sim.capacity;
    const x0 = ld.x + L.door.w;
    // new stalls, built of fresh planks
    for (let i = RULES.stalls; i < cap; i++) {
      const sx = x0 + i * L.stall;
      const fresh = i === cap - 1 ? this.plankAnim : 0;
      ctx.save();
      if (fresh > 0) ctx.translate(fresh * L.stall * 0.6, 0);
      ctx.globalAlpha = 1 - fresh * 0.7;
      paintPlanks(ctx, sx, ld.y, L.stall, ld.h, L.stall * 0.34, [C.fresh, '#cfae7e', C.fresh2], 40 + i, true);
      ctx.restore();
    }
    // the stall being built: its boards appear as the plank grows
    if (cap < SLOTS && sim.phase === 'play') {
      const sx = x0 + cap * L.stall;
      const boards = 3;
      const prog = sim.blindNow ? 0 : sim.progress;
      for (let k = 0; k < boards; k++) {
        const q = clamp(prog * boards - k);
        if (q <= 0) break;
        const bw = L.stall / boards;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65 * q;
        ctx.translate((1 - q) * bw * 1.4, 0);
        ctx.fillStyle = C.fresh;
        ctx.fillRect(sx + k * bw + 1, ld.y + 3, bw - 2, ld.h - 6);
        ctx.strokeStyle = 'rgba(42,33,27,.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + k * bw + 1, ld.y + 3, bw - 2, ld.h - 6);
        ctx.restore();
      }
      // the plank bar (sighted Days only): a thin line under the stall being built
      if (!sim.blindNow && sim.block.kind === 'day') {
        ctx.fillStyle = 'rgba(20,12,6,.55)';
        ctx.fillRect(sx + 3, ld.y + ld.h + 4, L.stall - 6, 4);
        ctx.fillStyle = C.fresh2;
        ctx.fillRect(sx + 3, ld.y + ld.h + 4, (L.stall - 6) * clamp(prog), 4);
      }
      // the family laying planks, seen from behind (the arm swings with the hammer)
      const fh = Math.min(L.stall * 0.95, 44 * L.u);
      if (!sim.blindNow) {
        const arm = sim.active && sim.reliable ? this.hammerArm : 0.2;
        paintFigure(ctx, sx + L.stall * 0.55, ld.y + ld.h - 2, fh, arm, 1, true);
        if (cap + 1 < SLOTS) paintFigure(ctx, sx + L.stall * 1.25, ld.y + ld.h - 4, fh * 0.92, 0.1 + 0.05 * Math.sin(this.clock * 1.3), 2, false);
      }
    }
    // partitions between the stalls in use
    ctx.strokeStyle = '#4a3220';
    ctx.lineWidth = Math.max(2, L.stall * 0.07);
    ctx.beginPath();
    for (let i = 0; i <= cap; i++) {
      const px = x0 + i * L.stall;
      ctx.moveTo(px, ld.y + 2);
      ctx.lineTo(px, ld.y + ld.h - 2);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,18,10,.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ld.x, ld.y, L.door.w + cap * L.stall, ld.h);
    // Noah at the door, seen from behind
    const nh = Math.min(L.stall * 0.9, 42 * L.u);
    const reach = sim.hold.beasts.some(b => b.state === 'back') ? 0.8 : 0.15;
    paintFigure(ctx, L.door.x + L.door.w * 0.5, L.door.y + L.door.h - 2, nh, reach, 0, false);
    // the dove on its post above the door, by Day
    if (sim.dove.state === 'rail') paintDove(ctx, L.door.x + L.door.w * 0.5, L.door.y - 4, Math.max(14, L.stall * 0.42), 0, false, 1);
    // morning mist over the plank work in a blind Day
    if (this.morning > 0.01) this.mistOver(ctx, x0 + cap * L.stall - L.stall * 0.3, ld.y - 10, (SLOTS - cap) * L.stall + L.stall * 0.6, ld.h + 26, this.morning * 0.92, 2);
    // mist over the landing while the signal is unreliable
    if (this.mist > 0.01) this.mistOver(ctx, ld.x - 10, ld.y - 14, ld.w + 20, ld.h + 30, this.mist * 0.8, 9);
  }

  /** Soft white mist over a rectangle, drifting. */
  private mistOver(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, seed: number): void {
    const sp = glow('rgba(246,244,236,.9)');
    ctx.save();
    ctx.globalAlpha = a;
    const n = Math.max(4, Math.round(w / 40));
    for (let i = 0; i < n; i++) {
      const r = h * (0.7 + 0.4 * hash(seed + i));
      const px = x + (i + 0.5) * (w / n) + Math.sin(this.clock * 0.3 + i) * 6;
      const py = y + h * (0.4 + 0.25 * hash(seed + i + 4));
      ctx.drawImage(sp, px - r, py - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /** The deck's empty cells stay plain; the cell an animal left keeps a faint mark of straw. */
  private drawDeckCells(sim: ArkaSim): void {
    const { ctx, L } = this;
    ctx.fillStyle = 'rgba(217,164,65,.18)';
    for (const b of sim.hold.beasts) {
      if (b.state === 'deck' || b.state === 'bump' || b.state === 'full' || b.state === 'back') continue;
      cellAt(L, b.x, b.y, this.pt);
      ctx.beginPath();
      ctx.ellipse(this.pt.x, this.pt.y, L.c * 0.3, L.c * 0.16, hash(b.id) * 3, 0, TAU);
      ctx.fill();
    }
  }

  /** A press shows the way out ahead of the head as a faint dotted line (to the edge, or to the animal in the way). */
  private drawPress(sim: ArkaSim, id: number): void {
    const b = sim.hold.beasts.find(x => x.id === id);
    if (!b || b.state !== 'deck') return;
    const { ctx, L } = this;
    const k = sim.blockedOf(b);
    const n = k > 0 ? k - 0.5 : toEdge(L.cols, L.rows, b.x, b.y, b.dir) + 0.5;
    cellAt(L, b.x, b.y, this.pt);
    ctx.save();
    ctx.fillStyle = k > 0 ? 'rgba(156,79,50,.8)' : 'rgba(255,246,220,.85)';
    const step = L.c * 0.22;
    for (let d = L.c * 0.5; d <= n * L.c + 0.01; d += step) {
      ctx.beginPath();
      ctx.arc(this.pt.x + DX[b.dir] * d, this.pt.y + DY[b.dir] * d, Math.max(1.6, L.c * 0.035), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCursor(sim: ArkaSim): void {
    if (!sim.cursor.shown || !sim.active) return;
    const { ctx, L } = this;
    const x = L.deck.x + sim.cursor.x * L.c, y = L.deck.y + sim.cursor.y * L.c;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,240,200,.95)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([L.c * 0.18, L.c * 0.1]);
    ctx.lineDashOffset = -this.clock * 12;
    ctx.strokeRect(x + 3, y + 3, L.c - 6, L.c - 6);
    ctx.restore();
  }

  /** Every animal where its state puts it: `landing` false draws the deck's, true the landing's and the walkers'. */
  private drawBeasts(sim: ArkaSim, landing: boolean): void {
    const { ctx } = this;
    const sleep = this.strawK > 0.5;
    for (const b of sim.hold.beasts) {
      if (b.state === 'gone') continue;
      const onDeck = b.state === 'deck' || b.state === 'bump' || b.state === 'full';
      if (onDeck === landing) continue;
      const s = this.where(sim, b, this.spot);
      if (s.alpha <= 0.01) continue;
      paintAnimal(ctx, b.kind, s.x, s.y, 1, s.size, this.dpr, { pose: sleep && onDeck ? 'sleep' : 'stand', alpha: s.alpha, squash: s.squash, tilt: s.ang });
      if (b.state === 'back' && b.t < b.dur) {
        // Noah's hand leads it back (a leaf's help shows as the same hand)
        paintHand(ctx, s.x - Math.cos(s.ang) * s.size * 0.45, s.y - Math.sin(s.ang) * s.size * 0.45 - s.size * 0.25, s.size * 0.5, s.ang, clamp(Math.min(b.t / 0.15, (b.dur - b.t) / 0.2)));
      }
      if (b.state === 'stall' && sim.leafArmed && !b.mate) {
        ctx.strokeStyle = `rgba(111,154,69,${0.6 + 0.4 * Math.sin(this.clock * 7)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.55, 0, TAU);
        ctx.stroke();
      }
    }
  }

  /**
   * Where an animal is now, as `ang` (its heading on screen, 0 = east), size and alpha.  On the deck
   * it walks its own way; on the rail it follows the ring to the walkway and its stall; it waits in
   * its stall facing the door; a pair bows and walks to the door and up the ramp; led back, it walks
   * the same way home.
   */
  private where(sim: ArkaSim, b: Beast, out: Spot): Spot {
    const L = this.L;
    const c = L.c;
    const rm = this.opts.reducedMotion;
    out.alpha = 1;
    out.squash = 0;
    out.sleep = false;
    out.ang = (b.dir - 1) * (Math.PI / 2);
    out.size = c * 0.94;
    cellAt(L, b.x, b.y, this.pt);
    const dx = DX[b.dir], dy = DY[b.dir];
    switch (b.state) {
      case 'deck': {
        out.x = this.pt.x;
        out.y = this.pt.y;
        if (!rm) out.squash = 0.012 * Math.sin(this.clock * 2.1 + b.id);
        return out;
      }
      case 'bump': {
        const q = b.t / b.dur;
        const d = b.dist * (q < 0.5 ? ease.outCubic(q * 2) : 1 - ease.inOutSine((q - 0.5) * 2));
        out.x = this.pt.x + dx * d * c;
        out.y = this.pt.y + dy * d * c;
        out.squash = q > 0.4 && q < 0.6 ? 0.08 : 0;
        return out;
      }
      case 'full': {
        const tw = (b.dur - RULES.look) / 2;
        const d = b.t < tw ? b.dist * ease.inOutSine(b.t / tw) : b.t < tw + RULES.look ? b.dist : b.dist * (1 - ease.inOutSine((b.t - tw - RULES.look) / tw));
        out.x = this.pt.x + dx * d * c;
        out.y = this.pt.y + dy * d * c;
        if (b.t >= tw && b.t < tw + RULES.look) out.ang += Math.sin((b.t - tw) * 20) * 0.12;   // it looks at the full landing
        return out;
      }
      case 'out': {
        const d = Math.min(b.dist, b.t * RULES.walk);
        out.x = this.pt.x + dx * d * c;
        out.y = this.pt.y + dy * d * c;
        if (!rm) out.squash = 0.04 * Math.abs(Math.sin(b.t * 16));
        return out;
      }
      case 'rail': {
        const n = this.railPath(b, b.stall, sim);
        this.along(n, ease.inOutSine(clamp(b.t / b.dur)), out);
        out.size = c * 0.94 + (L.stall * 0.86 - c * 0.94) * clamp(b.t / b.dur);
        if (!rm) out.squash = 0.04 * Math.abs(Math.sin(b.t * 18));
        return out;
      }
      case 'stall': {
        stallAt(L, b.stall, out);
        out.ang = Math.PI;   // facing the door
        out.size = L.stall * 0.86;
        if (!b.owner) out.x += L.stall * 0.14;   // the second of a pair waits beside its mate's place
        if (!rm && this.hitStop <= 0) out.squash = 0.015 * Math.sin(this.clock * 1.7 + b.id);
        return out;
      }
      case 'pair': {
        stallAt(L, b.stall < 0 ? 0 : b.stall, this.pt2);
        const side = b.owner ? -1 : 1;
        const sz = L.stall * 0.86;
        out.size = sz;
        if (b.t < RULES.bow) {
          out.x = this.pt2.x + side * L.stall * 0.14;
          out.y = this.pt2.y;
          out.ang = Math.PI;
          out.squash = 0.12 * Math.sin((b.t / RULES.bow) * Math.PI);   // a bow
          return out;
        }
        const q = clamp((b.t - RULES.bow) / (RULES.pair - RULES.bow));
        const dxr = L.door.x + L.door.w * 0.5, dyr = L.door.y + L.door.h * 0.5;
        const tx = dxr, ty = L.land.y + L.land.h - 6;
        // to the door, then up the ramp onto the land
        if (q < 0.55) {
          const k = ease.inOutSine(q / 0.55);
          out.x = this.pt2.x + (dxr - this.pt2.x) * k;
          out.y = this.pt2.y + (dyr - this.pt2.y) * k + side * L.stall * 0.12;
          out.ang = Math.atan2(dyr - this.pt2.y, dxr - this.pt2.x);
        } else {
          const k = (q - 0.55) / 0.45;
          out.x = dxr + (tx - dxr) * k + side * L.stall * 0.14;
          out.y = dyr + (ty - dyr) * k;
          out.ang = -Math.PI / 2;
          out.size = sz * (1 - 0.45 * k);
          out.alpha = 1 - k;
        }
        return out;
      }
      case 'back': {
        const n = this.railPath(b, b.was, sim);
        const q = clamp(b.t / b.dur);
        if (q < 0.8) {
          this.along(n, 1 - ease.inOutSine(q / 0.8), out);
          out.ang += Math.PI;
        } else {
          // the last steps from the deck's edge into its cell
          const k = ease.outCubic((q - 0.8) / 0.2);
          const edge = toEdge(L.cols, L.rows, b.x, b.y, b.dir) + 0.5;
          out.x = this.pt.x + dx * edge * c * (1 - k);
          out.y = this.pt.y + dy * edge * c * (1 - k);
          out.ang = (b.dir - 1) * (Math.PI / 2) + Math.PI * (1 - k);
        }
        out.size = c * 0.94;
        return out;
      }
      default:
        out.x = this.pt.x;
        out.y = this.pt.y;
        return out;
    }
  }

  /**
   * The way from the deck's edge to a stall: onto the rail, around it the shorter way to the
   * walkway, along it to the landing, into the stall.  Written into `path`; returns the points.
   */
  private railPath(b: Beast, stall: number, sim: ArkaSim): number {
    const L = this.L, P = this.path;
    const r = railRect(L);
    cellAt(L, b.x, b.y, this.pt);
    const edge = toEdge(L.cols, L.rows, b.x, b.y, b.dir) + 0.5;
    let n = 0;
    const push = (x: number, y: number) => {
      if (n < 12) {
        P[n * 2] = x;
        P[n * 2 + 1] = y;
        n++;
      }
    };
    const ex = this.pt.x + DX[b.dir] * edge * L.c, ey = this.pt.y + DY[b.dir] * edge * L.c;
    push(ex, ey);
    const rx = ex + DX[b.dir] * L.rail * 0.5, ry = ey + DY[b.dir] * L.rail * 0.5;
    push(rx, ry);
    railGate(L, r, this.pt2);
    const gx = this.pt2.x, gy = this.pt2.y;
    const per = 2 * (r.w + r.h);
    const s0 = railCoord(r, rx, ry), s1 = railCoord(r, gx, gy);
    const fwd = (((s1 - s0) % per) + per) % per;
    const dir = fwd <= per / 2 ? 1 : -1;
    const span = dir > 0 ? fwd : per - fwd;
    // the ring's corners on the way
    const corners = [0, r.w, r.w + r.h, 2 * r.w + r.h];
    const passed: number[] = [];
    for (const cs of corners) {
      const d = dir > 0 ? (((cs - s0) % per) + per) % per : (((s0 - cs) % per) + per) % per;
      if (d > 0.5 && d < span - 0.5) passed.push(d);
    }
    passed.sort((a, b2) => a - b2);
    for (const d of passed) {
      railPoint(r, s0 + dir * d, this.pt2);
      push(this.pt2.x, this.pt2.y);
    }
    push(gx, gy);
    push(L.gate.x, L.gate.y);
    stallAt(L, Math.max(0, stall), this.pt2);
    push(this.pt2.x, this.pt2.y);
    void sim;
    // running lengths
    this.lens[0] = 0;
    for (let i = 1; i < n; i++) this.lens[i] = this.lens[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
    return n;
  }

  /** The point at share `q` of the path's length, and the heading there. */
  private along(n: number, q: number, out: Spot): void {
    const P = this.path, total = this.lens[n - 1];
    const at = q * total;
    let i = 1;
    while (i < n - 1 && this.lens[i] < at) i++;
    const seg = Math.max(1e-6, this.lens[i] - this.lens[i - 1]);
    const k = clamp((at - this.lens[i - 1]) / seg);
    const x0 = P[i * 2 - 2], y0 = P[i * 2 - 1], x1 = P[i * 2], y1 = P[i * 2 + 1];
    out.x = x0 + (x1 - x0) * k;
    out.y = y0 + (y1 - y0) * k;
    out.ang = Math.atan2(y1 - y0, x1 - x0);
  }

  /** The Evening's straw over the sleeping deck. */
  private drawStraw(): void {
    const { ctx, L } = this;
    const r = railRect(L);
    const key = `${this.layoutKey}|${this.dpr}`;
    if (!this.straw || this.strawKey !== key) {
      this.strawKey = key;
      this.straw = strawSprite(r.w + L.rail, r.h + L.rail, this.dpr, 7);
    }
    ctx.save();
    ctx.globalAlpha = this.strawK;
    ctx.fillStyle = 'rgba(70,44,22,.35)';
    ctx.fillRect(r.x - L.rail / 2, r.y - L.rail / 2, r.w + L.rail, r.h + L.rail);
    const fall = (1 - ease.outCubic(this.strawK)) * 30;
    ctx.drawImage(this.straw, r.x - L.rail / 2, r.y - L.rail / 2 - fall, r.w + L.rail, r.h + L.rail);
    ctx.restore();
  }

  /** The light over the deck: the Evening reddens it and kindles the lanterns, a cleared hold floods the door. */
  private drawLight(sim: ArkaSim): void {
    const { ctx, L } = this;
    if (this.dusk > 0.01) {
      ctx.save();
      // everything but the land strip (its own dusk is painted in): below it when upright, around it when wide
      ctx.beginPath();
      if (L.mode === 'stack') ctx.rect(0, L.land.y + L.land.h, this.w, this.h);
      else {
        ctx.rect(0, 0, this.w, this.h);
        ctx.rect(L.land.x, L.land.y, L.land.w, L.land.h);
      }
      ctx.globalAlpha = this.dusk * 0.5;
      ctx.fillStyle = C.dusk;
      ctx.fill('evenodd');
      ctx.globalAlpha = this.dusk * 0.18;
      ctx.fillStyle = '#ff9a4a';
      ctx.fill('evenodd');
      ctx.restore();
    }
    if (this.lanterns > 0.01) {
      const sp = glow('rgba(255,181,71,.85)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ld = L.landing;
      const pts: [number, number][] = [[ld.x + L.door.w, ld.y], [ld.x + L.door.w + sim.capacity * L.stall, ld.y], [L.deck.x - L.rail / 2, L.deck.y - L.rail / 2], [L.deck.x + L.deck.w + L.rail / 2, L.deck.y - L.rail / 2]];
      for (const [x, y] of pts) {
        const r = L.stall * (0.9 + 0.08 * Math.sin(this.clock * 3 + x));
        ctx.globalAlpha = this.lanterns * 0.8;
        ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
      for (const [x, y] of pts) {
        ctx.fillStyle = '#3a281a';
        ctx.fillRect(x - 3, y - 9, 6, 9);
        ctx.fillStyle = `rgba(255,${200 + 30 * this.lanterns},120,${0.3 + 0.7 * this.lanterns})`;
        ctx.fillRect(x - 2, y - 8, 4, 6);
      }
    }
    if (this.doorLight > 0.01 || this.dawnDoor > 0.01) {
      const d = L.door;
      const k = Math.max(this.doorLight, this.dawnDoor * 0.6);
      const r = d.h * (1.6 + this.doorLight);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.drawImage(glow('rgba(255,240,190,.95)'), d.x + d.w / 2 - r, d.y + d.h / 2 - r, r * 2, r * 2);
      ctx.restore();
    }
  }

  /** The dove over the land strip: out at dusk (when the deck shows), home to its post. */
  private drawStripDove(sim: ArkaSim): void {
    const { ctx, L } = this;
    const d = sim.dove;
    const ls = L.land;
    let x: number, y: number;
    const postX = L.door.x + L.door.w * 0.5, postY = L.door.y - 4;
    if (d.state === 'out') {
      x = ls.x + ls.w * (0.12 + 0.75 * d.far);
      y = ls.y + ls.h * (0.55 - 0.35 * d.high) + Math.sin(this.clock * 2) * 3;
    } else if (d.state === 'home') {
      const k = ease.inOutSine(clamp(d.t / 1.6));
      const fx = ls.x + ls.w * (0.12 + 0.75 * d.far), fy = ls.y + ls.h * (0.55 - 0.35 * d.high);
      x = fx + (postX - fx) * k;
      y = fy + (postY - fy) * k - Math.sin(k * Math.PI) * ls.h * 0.2;
    } else return;
    paintDove(ctx, x, y, Math.max(14, L.stall * 0.42), Math.sin(this.clock * 9), d.state === 'home' && d.leaf, d.state === 'home' ? -1 : 1);
  }

  // ── the land view: the Evening and the finisher ──────────────────
  private drawLandView(sim: ArkaSim): void {
    const { ctx, w, h } = this;
    const fin = this.finaleT >= 0 ? clamp(this.finaleT / 3) : 0;
    // dusk in the Evening, a golden clearing in the finisher
    this.big.draw(ctx, 0, 0, w, h, this.clock, this.look, { dusk: 0.9 - fin * 0.55, zoom: 0.42, still: this.opts.reducedMotion }, this.dpr);
    if (fin > 0) {
      ctx.save();
      ctx.globalAlpha = fin * 0.35;
      ctx.fillStyle = '#ffd9a0';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      paintRainbow(ctx, w * 0.58, h * 0.78, Math.min(w, h * 1.2) * 0.62, ease.outCubic(clamp((this.finaleT - 0.6) / 2.4)), 0.6);
    }
    // the ark's rail in the foreground: Noah watching, the lanterns lit
    const railY = h * 0.86;
    ctx.fillStyle = '#2c1f15';
    ctx.fillRect(0, railY, w * 0.42, h - railY);
    paintPlanks(ctx, 0, railY, w * 0.42, h - railY, Math.max(14, h * 0.03), ['#3b2a1e', '#43301f', '#33241a'], 21);
    ctx.fillStyle = '#4a3220';
    ctx.fillRect(0, railY - 8, w * 0.44, 10);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, railY - 8, w * 0.44, 10);
    const postX = w * 0.3;
    ctx.fillStyle = '#3a281a';
    ctx.fillRect(postX - 4, railY - 44, 8, 40);
    const sp = glow('rgba(255,181,71,.9)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    const lr = 40 + 4 * Math.sin(this.clock * 3);
    ctx.drawImage(sp, postX - lr, railY - 52 - lr, lr * 2, lr * 2);
    ctx.restore();
    ctx.fillStyle = C.amber2;
    ctx.fillRect(postX - 4, railY - 58, 8, 10);
    paintFigure(ctx, w * 0.17, railY - 6, Math.min(70, h * 0.1), sim.dove.state === 'out' ? 0.15 : 0.7, 0, false);
    // the dove
    const d = sim.dove;
    const startX = w * 0.2, startY = railY - Math.min(70, h * 0.1) * 0.9;
    let x = startX, y = startY, face = 1, show = true, leaf = false, size = Math.max(22, Math.min(w, h) * 0.06);
    if (d.state === 'out') {
      x = startX + d.far * w * 0.68;
      y = h * (0.6 - 0.36 * d.high) + Math.sin(this.clock * 1.6) * 8;
    } else if (d.state === 'home') {
      const k = ease.inOutSine(clamp(d.t / 1.8));
      const fx = startX + d.far * w * 0.68, fy = h * (0.6 - 0.36 * d.high);
      x = fx + (startX - fx) * k;
      y = fy + (startY - fy) * k - Math.sin(k * Math.PI) * h * 0.08;
      face = -1;
      leaf = d.leaf;
    } else if (d.state === 'away') {
      // the finisher: it flies out and does not return
      const k = clamp(d.t / 4.5);
      x = startX + ease.inOutSine(k) * w * 0.85;
      y = startY - ease.outCubic(k) * h * 0.55;
      size *= 1 - 0.7 * k;
      show = k < 0.98;
    }
    if (show) paintDove(ctx, x, y, size, Math.sin(this.clock * (d.state === 'rail' ? 0 : 8)), leaf, face);
    this.doveSeen = d.state === 'out';
  }

  private drawFinaleText(): void {
    const { ctx, w, h } = this;
    const k = clamp((this.finaleT - 1.6) / 0.9);
    if (k <= 0) return;
    const u = this.L.u;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 34 * u;
    ctx.font = font(500, size, SERIF, true);
    const tw = ctx.measureText(ENOUGH).width;
    if (tw > w - 40) {
      size = Math.max(16, (size * (w - 40)) / tw);
      ctx.font = font(500, size, SERIF, true);
    }
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(46,36,64,.35)';
    ctx.strokeText(ENOUGH, w / 2, h * 0.24);
    ctx.fillStyle = '#fff8ea';
    ctx.fillText(ENOUGH, w / 2, h * 0.24);
    ctx.font = font(650, 14 * u, SANS);
    ctx.fillStyle = 'rgba(255,248,234,.92)';
    ctx.fillText(this.finaleLine, w / 2, h * 0.24 + size * 0.95);
    ctx.restore();
  }

  /** The calibration intro: the dim hold, its covering lifting as the reference fills (intro.ts). */
  intro(dt: number, p: number, progress: ArkaProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress, this.dpr);
  }
}

export type { Rect };
