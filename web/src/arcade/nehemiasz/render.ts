/**
 * Nehemiasz's play view: the hills and the three roads outside, the band's history as the ridge of
 * the far hills (its last 40 s: gold peaks where the signal stood above the threshold, a cool tint
 * behind the days, a mist over a moonless night, the band's delay bracketed at "now"), the city and
 * the stretch of wall in depth order (the wall rises course by course, scaffolds while a tier is laid,
 * cracks and breaches), the people at their work, Nehemiah and Tirza, the raiders, and at night the
 * darkness with the watch fires' pools of light — the band, drawn large: each fire's light reaches as
 * far as the focus, its threshold a dotted ring on the ground, its edge gold above it.  By day each
 * build site carries a badge (what it builds, its next level) that takes a finger-sized tap.  Juice:
 * hit-stop (from the sim), particles, flying numbers, shakes (none with reduced motion), a pressed
 * look on touch-down, a ripple where a finger lands, the floating joystick under the thumb.
 */
import { fmtNum } from '../../i18n';
import { Floaters, Particles, Shake, approach, clamp, ease } from '../kit/juice';
import type { FocusFrame } from '../kit/focus';
import { NO_INSETS, target } from '../kit/mobile';
import { LAG_SEC, SignalTrace, type TracePhase } from '../kit/trace';
import type { Insets, TapTarget } from '../kit/types';
import {
  FIRE_IDS, GATE_SEG, MARKERS, POST_IDS, RAIDER_KINDS, ROUTES, ROUTE_IDS, SEGS, TOWER_IDS, gateName, kindName, markerSpec, routeAt,
  segAt, segMid, tierName, townName, type Kind, type RaiderKind,
} from './content';
import { Hud, type Banner, type Press } from './hud';
import { t } from './i18n';
import { NehIntro } from './intro';
import { K, badgeFree, badgeOf, cameraFor, inside, layout, overlaps, type Badge, type Layout, type Rect } from './layout';
import { heightOf, maxHp, stoneCap, type NehProgress } from './meta';
import {
  C, SANS, UP, bandColor, font, glow, hash, paintBakery, paintBrazier, paintChevron, paintFox, paintGate, paintGovernor, paintGranary,
  paintHouse, paintKindIcon, paintNehemiah, paintOfficer, paintOlive, paintPost, paintRaider, paintSanballat, paintStoneIcon, paintTents,
  paintTimberIcon, paintTirza, paintTobiah, paintTower, paintWallSeg, paintWell, paintWorker, paintYard, roundRect,
  wallHeightU, type Job,
} from './paint';
import { RULES } from './rules';
import type { MarkerView, NehSim, SimEvent } from './sim';
import { fireReach } from './sim';

const TAU = Math.PI * 2;
const VILLAINS = { x: 12.3, y: 1.95 };

/** A build badge on screen this frame: where it is, whether a finger may press it there. */
export interface BadgeView extends Badge { kind: Kind; mv: MarkerView; free: boolean }

export class NehView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ins: Insets = NO_INSETS;
  L: Layout = layout(800, 600, { ...NO_INSETS, top: 64 });
  readonly hud: Hud;
  /** what a finger presses right now (index.ts sets it): drawn pressed until it lifts */
  press: Press = null;
  private readonly ripples: { x: number; y: number; t: number }[] = [];
  /** what a speech bubble must not cover this frame (the build badges, the cost card) */
  private avoid: Rect[] = [];
  /** the speech bubble on screen (a tap on it hushes it; the badges under it wait) */
  private bubbleRect: Rect | null = null;
  /** the preview's row of chips under the HUD on a narrow screen (the badges under it wait) */
  private previewRect: Rect | null = null;
  /** the officers' last positions (they walk when they move) */
  private readonly guardPrev = new Map<number, { x: number; y: number; walking: number }>();
  private readonly fx = new Particles(640);
  private readonly floaters = new Floaters();
  private readonly shake: Shake;
  private readonly introScene = new NehIntro();
  readonly trace = new SignalTrace(40, 0.1);
  private clock = 0;
  private started = false;
  camX = 9;
  camY = 6;
  private nightK = 0;
  private duskK = 0;
  private flash = 0;
  private banner: Banner | null = null;
  private readonly banners: Banner[] = [];
  private dark: HTMLCanvasElement | null = null;
  private stepN = 0;
  /** routs in quick succession: a combo that climbs */
  private combo = 0;
  private comboT = -9;
  private stepZ = 0;
  private readonly newcomers: { x: number; y: number; t: number; seed: number }[] = [];
  private readonly flying: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; kind: 'stone' | 'timber' }[] = [];
  /** the joystick's ring (CSS px), while a finger steers */
  stick: { ox: number; oy: number; x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
    this.hud = new Hud(opts.touch);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, this.ins);
    this.dark = null;
  }

  /** What covers the canvas's edges: the runner's HUD band at the top, the home indicator, a notch (read in resize). */
  setInsets(ins: Insets): void {
    const o = this.ins;
    if (Math.abs(o.top - ins.top) < 0.5 && Math.abs(o.bottom - ins.bottom) < 0.5 && Math.abs(o.left - ins.left) < 0.5 && Math.abs(o.right - ins.right) < 0.5) return;
    this.ins = { ...ins };
    this.L = layout(this.w, this.h, this.ins);
  }

  /** World (u) → canvas (CSS px). */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.L.cx + (x - this.camX) * this.L.s, y: this.L.cy + (y - this.camY) * this.L.s * K };
  }

  /** Canvas (CSS px) → world (u). */
  toWorld(x: number, y: number): { x: number; y: number } {
    return { x: this.camX + (x - this.L.cx) / this.L.s, y: this.camY + (y - this.L.cy) / (this.L.s * K) };
  }

  intro(dt: number, p: number, progress: NehProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, progress);
  }

  start(sim: NehSim): void {
    this.started = true;
    this.followCamera(sim, 1);
  }

  private say(text: string, color = '#fff3d6', dur = 1.8, big = false): void {
    const b: Banner = { text, color, t: 0, dur, big };
    if (!this.banner) this.banner = b;
    else if (this.banners.length < 3) this.banners.push(b);
  }

  /**
   * The camera follows Nehemiah where the world is wider or taller than the band.  By day it keeps the
   * wall's badges in sight while he works in the city; by night it looks up toward the hills (the roads,
   * the ridge of the band's history), never losing him.
   */
  private followCamera(sim: NehSim, k: number): void {
    const c = cameraFor(this.L, sim.neh.x, sim.neh.y, sim.nightTime || sim.showPreview);
    this.camX += (c.x - this.camX) * k;
    this.camY += (c.y - this.camY) * k;
  }

  // ── what a finger can press ─────────────────────────────────────
  /** The build badges on screen this frame (by day, a build there now), with whether each may be pressed. */
  badges(sim: NehSim): BadgeView[] {
    if (!sim.dayTime || sim.frozen) return [];
    const L = this.L, out: BadgeView[] = [];
    for (const m of MARKERS) {
      const mv = sim.markerView(m.id);
      if (mv.next === null) continue;
      const b = badgeOf(L, this.camX, this.camY, m);
      if (b.box.x > L.w || b.box.x + b.box.w < 0 || b.box.y > L.h || b.box.y + b.box.h < 0) continue;
      const under = (!!this.bubbleRect && overlaps(b.box, this.bubbleRect)) || (!!this.previewRect && overlaps(b.box, this.previewRect));
      out.push({ ...b, kind: m.kind, mv, free: badgeFree(L, b) && !under });
    }
    return out;
  }

  /** The control under a finger that goes down here (null: the free field — a drag walks, a tap does what the guide says). */
  pressAt(sim: NehSim, x: number, y: number): Press {
    const L = this.L;
    if (!sim.started || sim.phase === 'done' || sim.frozen) return null;
    if (this.bubbleRect && inside(this.bubbleRect, x, y)) return { kind: 'bubble' };
    if (sim.nightTime) {
      if (Math.hypot(x - L.horn.x, y - L.horn.y) <= L.horn.r + 6) return { kind: 'horn' };
      if (inside(L.rush, x, y)) return { kind: 'rush' };
      return null;
    }
    if (inside(L.guide, x, y)) return { kind: 'guide' };
    for (const b of this.badges(sim)) if (b.free && inside(b.box, x, y)) return { kind: 'marker', id: b.id };
    return null;
  }

  /** Whether a point is on the panel (the thumb zone's bar): a tap there that hits no button does nothing. */
  onPanel(x: number, y: number): boolean { return y >= this.L.panel.y && x >= 0 && x <= this.L.w; }

  /** Every control the player can tap right now, as the hit rectangles the taps test (kit/types: ArcadeGame.targets). */
  targets(sim: NehSim): TapTarget[] {
    const L = this.L;
    if (!this.started || !sim.started || sim.phase === 'done') return [];
    this.hud.layoutCards(this.ctx, sim, L);
    if (sim.story) return this.hud.storyRect ? [target('story card', this.hud.storyRect)] : [];
    if (sim.choice) return this.hud.cards.map((c, i) => target(`choice ${i + 1}`, c));
    const out: TapTarget[] = this.bubbleRect && sim.talk.line ? [target('speech bubble', this.bubbleRect)] : [];
    if (sim.nightTime) {
      const h = L.horn;
      out.push(target('to the wall', L.rush), target('horn', { x: h.x - h.r, y: h.y - h.r, w: h.r * 2, h: h.r * 2 }));
      return out;
    }
    if (!sim.dayTime) return out;
    out.push(target('next build', L.guide));
    for (const b of this.badges(sim)) if (b.free) out.push(target(`build ${b.id}`, b.box));
    return out;
  }

  /** A finger landed on the free field: a ring answers at once. */
  ripple(x: number, y: number): void {
    if (this.opts.reducedMotion) return;
    this.ripples.push({ x, y, t: 0 });
    if (this.ripples.length > 4) this.ripples.shift();
  }

  /** The horn was pressed before it was ready. */
  hornNotReady(): void { this.hud.hornNotReady(); }

  // ── events: juice ───────────────────────────────────────────────
  on(e: SimEvent, sim: NehSim): void {
    const fx = this.fx, u = this.L.u, s = this.L.s;
    const P = (x: number, y: number) => this.toScreen(x, y);
    switch (e.type) {
      case 'pay': {
        // stones and beams fly from the yard to the marker
        const yard = markerSpec('yard')!;
        for (let i = 0; i < Math.min(6, e.stone); i++) this.flying.push({ x0: yard.x, y0: yard.y, x1: e.x, y1: e.y, t: -i * 0.07, dur: 0.55, kind: 'stone' });
        for (let i = 0; i < Math.min(4, e.timber); i++) this.flying.push({ x0: 0.2, y0: 9.5, x1: e.x, y1: e.y, t: -0.1 - i * 0.08, dur: 0.6, kind: 'timber' });
        break;
      }
      case 'built': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.3, 22, { color: '#f3dcab', size: 3, speed: 150, life: 0.6, g: 220, shape: 'square' });
        fx.burst(p.x, p.y - s * 0.3, 10, { color: C.goldLight, size: 2.5, speed: 120, life: 0.7, g: -30, shape: 'spark' });
        const m = markerSpec(e.id)!;
        const name = m.kind === 'wall' || m.kind === 'gate' ? tierName(m.kind, e.level) : kindName(m.kind);
        this.floaters.add(name, p.x, p.y - s * 0.9, { color: C.goldLight, size: 15 * u, dur: 1.3 });
        this.shake.add(0.12);
        break;
      }
      case 'missing': {
        const p = P(e.x, e.y);
        const parts: string[] = [];
        if (e.stone > 0) parts.push(`−${e.stone}▪`);
        if (e.timber > 0) parts.push(`−${e.timber}═`);
        this.floaters.add(parts.join(' '), p.x, p.y - s * 0.6, { color: '#ffb39a', size: 14 * u, dur: 1.1 });
        break;
      }
      case 'tier': {
        const p = P(e.x, RULES.wallY);
        fx.burst(p.x, p.y - s * 0.4, 30, { color: C.goldLight, size: 3, speed: 200, life: 0.9, g: 90, shape: 'spark' });
        this.floaters.add(tierName(e.seg === GATE_SEG ? 'gate' : 'wall', e.level), p.x, p.y - s * 1.2, { color: C.gold, size: 17 * u, dur: 1.5 });
        this.shake.add(0.18);
        break;
      }
      case 'dressed': {
        const p = P(e.x, RULES.wallY);
        this.floaters.add(`+${e.n}`, p.x, p.y - s * 0.8, { color: C.goldLight, size: 18 * u, dur: 1.2 });
        break;
      }
      case 'mend': {
        const p = P(e.x, RULES.wallY);
        fx.burst(p.x, p.y - s * 0.2, 14, { color: '#f3dcab', size: 2.5, speed: 100, life: 0.5, g: 160, shape: 'square' });
        break;
      }
      case 'timber':
        this.say(t('hud.timberIn', { n: e.n }), '#f3dcab', 2.2);
        for (let i = 0; i < Math.min(5, e.n); i++) this.flying.push({ x0: -0.5, y0: 9.8, x1: markerSpec('yard')!.x, y1: markerSpec('yard')!.y, t: -0.3 - i * 0.12, dur: 1.1, kind: 'timber' });
        break;
      case 'newcomers':
        for (let i = 0; i < Math.min(6, e.n); i++) this.newcomers.push({ x: -0.6 - i * 0.45, y: 9.75 + (i % 2) * 0.22, t: 0, seed: i + Math.floor(this.clock * 7) });
        this.say(t('hud.newcomers', { town: townName(e.town), n: e.n }), '#d9f0c0', 2);
        break;
      case 'hunger':
        this.say(t('hud.hunger'), '#ffb39a', 2);
        break;
      case 'sabbath':
        this.say(t('hud.sabbath'), C.goldLight, 2.6);
        break;
      case 'sling': {
        const a = P(e.x, e.y), b = P(e.tx, e.ty);
        fx.burst(a.x, a.y - s * 0.4, 1, { color: '#d8d0c0', size: 2, speed: Math.hypot(b.x - a.x, b.y - a.y) * 2, angle: Math.atan2(b.y - a.y, b.x - a.x), spread: 0.05, life: 0.45, g: 0, drag: 0 });
        break;
      }
      case 'dim': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.4, 8, { color: C.ember, size: 2, speed: 90, life: 0.4, g: 120, shape: 'spark' });
        break;
      }
      case 'bonk': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.45, e.volley ? 6 : 4, { color: '#fff6dc', size: 2, speed: 110, life: 0.3, g: 60, shape: 'spark' });
        if (e.volley || Math.random() < 0.3) this.floaters.add('bonk!', p.x, p.y - s * 0.75, { color: '#fff6dc', size: 13 * u, dur: 0.6 });
        break;
      }
      case 'jab': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.4, 3, { color: '#e8eef6', size: 2, speed: 80, life: 0.2, g: 0, shape: 'spark' });
        break;
      }
      case 'driven': {
        const p = P(e.x, e.y);
        this.combo = this.clock - this.comboT < 1.8 ? this.combo + 1 : 1;
        this.comboT = this.clock;
        fx.burst(p.x, p.y - s * 0.3, 10 + this.combo * 2, { color: '#e8dcc4', size: 2.5, speed: 90, life: 0.6, g: -10 });
        if (this.combo >= 2) this.floaters.add(`×${this.combo}`, p.x, p.y - s * 1.0, { color: C.gold, size: (14 + Math.min(10, this.combo * 2)) * u, dur: 0.9 });
        else this.floaters.add(t('hud.fled'), p.x, p.y - s * 0.9, { color: '#fff3d6', size: 14 * u, dur: 0.8 });
        if (this.combo >= 4) this.shake.add(0.08);
        break;
      }
      case 'breach': {
        const p = P(e.x, RULES.wallY);
        fx.burst(p.x, p.y - s * 0.2, 26, { color: C.rubble, size: 3.5, speed: 160, life: 0.8, g: 260, shape: 'square' });
        this.say(t('hud.breach'), '#ffb39a', 1.6);
        this.shake.add(0.3);
        break;
      }
      case 'grab': {
        const p = P(e.x, e.y);
        this.floaters.add(`−${e.n}`, p.x, p.y - s * 0.7, { color: '#ffb39a', size: 13 * u, dur: 0.9 });
        break;
      }
      case 'recovered': {
        const p = P(e.x, e.y);
        this.floaters.add(`${t('hud.recovered')} +${e.n}`, p.x, p.y - s * 0.8, { color: '#d9f0c0', size: 13 * u, dur: 1 });
        break;
      }
      case 'hornReady':
        this.flash = Math.max(this.flash, 0.15);
        break;
      case 'horn': {
        const p = P(e.x, e.y);
        this.flash = Math.max(this.flash, 0.55);
        this.say(t('hud.horned'), C.gold, 1.6, true);
        fx.burst(p.x, p.y - s * 0.6, 60, { color: C.goldLight, size: 3, speed: 330, life: 1, g: 40, shape: 'spark' });
        this.shake.add(0.5);
        break;
      }
      case 'report':
        if (e.share !== null) this.say(t('hud.moonReveal', { n: Math.round(e.share * 100) }), C.calm, 2.6);
        else this.say(e.held ? t('hud.held') : t('hud.dawn', { pct: Math.round(e.standing * 100) }), e.held ? C.gold : '#fff3d6', 2.4, e.held);
        break;
      case 'dayBonus':
        this.say(t('hud.dayBonus', { n: e.n }), C.calm, 2.2);
        break;
      case 'nightHeld':
        this.say(t('hud.nightHeld'), C.gold, 2);
        break;
      case 'night':
        if (e.captain) this.say(t('hud.captain'), '#ffb39a', 2.4, true);
        else if (e.blind) this.say(t('hud.moonless'), C.calm, 2.2);
        break;
      case 'ono':
        if (e.answered) {
          this.say(t('hud.onoNo'), C.gold, 2.6);
          this.flash = Math.max(this.flash, 0.25);
        }
        break;
      case 'fox':
        this.say(t('hud.foxNo'), C.goldLight, 2);
        break;
      case 'gateDone':
        this.say(`${gateName(e.gate)} ${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}`, C.gold, 2.6, true);
        break;
      case 'hero':
        this.say(t('hud.hero', { name: t(e.hero === 'hanani' ? 'hero.hanani' : 'hero.hananiah') }), '#d9f0c0', 2.2);
        break;
      default:
        break;
    }
    void sim;
  }

  update(dt: number, sim: NehSim, f: FocusFrame | null): void {
    this.clock += dt;
    const live = !sim.frozen;
    if (live) this.followCamera(sim, 1 - Math.exp(-dt / 0.25));
    this.nightK = approach(this.nightK, sim.nightTime ? 1 : 0, dt, 0.7);
    const dusk = sim.phase === 'play' && sim.block.kind !== 'push' && sim.next?.kind === 'push' ? clamp((sim.blockT - (sim.block.dur - 8)) / 8) : 0;
    this.duskK = approach(this.duskK, dusk, dt, 0.5);
    this.fx.update(dt);
    this.floaters.update(dt);
    this.hud.update(dt);
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].t += dt;
      if (this.ripples[i].t > 0.35) this.ripples.splice(i, 1);
    }
    this.flash = Math.max(0, this.flash - dt * 1.6);
    const runnerBanner = sim.phase === 'play' && sim.blockIndex > 0 && sim.blockT < RULES.bannerSec;
    if (this.banner && !(runnerBanner && this.banner.t === 0)) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = this.banners.shift() ?? null;
    }
    this.stepN += dt * (sim.neh.walking ? 10 : 0);
    this.stepZ += dt * (sim.tirza.walking ? 11 : 0);
    for (let i = this.newcomers.length - 1; i >= 0; i--) {
      const n = this.newcomers[i];
      n.t += dt;
      n.x += dt * 1.6;
      if (n.x > 1.4 + (i % 3) * 0.3) this.newcomers.splice(i, 1);
    }
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const fl = this.flying[i];
      fl.t += dt;
      if (fl.t >= fl.dur) this.flying.splice(i, 1);
    }
    if (f && sim.started && sim.phase !== 'done') {
      const phase: TracePhase = sim.phase === 'play' && sim.block.kind === 'push' ? 'focus' : sim.phase === 'play' && sim.block.kind === 'rest' ? 'rest' : 'free';
      this.trace.push(sim.t, f, phase, sim.blind);
    }
  }

  /** a blind night ended: lift the ridge's mist */
  unveil(now: number): void { this.trace.unveil(now); }

  // ── the frame ───────────────────────────────────────────────────
  draw(sim: NehSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake.offset(1 / 60, 8);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    this.background(sim);
    this.roads(sim);
    this.cityGround(sim);
    this.groundMarks(sim);
    this.scene(sim);
    this.avoid = [];
    this.buildBadges(sim);
    this.night(sim);
    this.ridge(sim);
    this.projectiles(sim);
    this.flyingStuff(sim);
    this.fx.draw(ctx);
    this.floaters.draw(ctx, SANS);
    this.preview(sim);
    this.bubbles(sim);
    this.offscreen(sim);
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,236,180,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    const hold = sim.phase === 'play' && sim.blockIndex > 0 && sim.blockT < RULES.bannerSec && this.banner?.t === 0;
    this.hud.draw(ctx, sim, L, hold ? null : this.banner, this.press);
    // where a finger landed: a ring that answers at once
    for (const r of this.ripples) {
      const k = r.t / 0.35;
      ctx.strokeStyle = `rgba(255,246,222,${0.7 * (1 - k)})`;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + 22 * ease.outCubic(k), 0, TAU);
      ctx.stroke();
    }
    // the floating joystick: its base under the thumb, the knob where the thumb is
    if (this.stick) {
      const st = this.stick, R = RULES.stickPx;
      ctx.fillStyle = 'rgba(20,14,10,.22)';
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, R + 6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,246,222,.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, R, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,246,222,.85)';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 17, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,30,.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private Y(y: number): number { return this.L.cy + (y - this.camY) * this.L.s * K; }
  private X(x: number): number { return this.L.cx + (x - this.camX) * this.L.s; }

  // ── the land ────────────────────────────────────────────────────
  private background(sim: NehSim): void {
    const ctx = this.ctx, L = this.L, n = this.nightK, d = this.duskK * (1 - n);
    // the sky: dawn-gold by day, rose at dusk, indigo at night
    const g = ctx.createLinearGradient(0, 0, 0, this.Y(1.2));
    g.addColorStop(0, n > 0.5 ? C.night0 : d > 0.3 ? '#f2a77a' : C.sky0);
    g.addColorStop(1, n > 0.5 ? C.night1 : d > 0.3 ? '#f6c48e' : C.sky1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.w, this.Y(1.2) + 2);
    if (n > 0.5) {
      // stars, and the moon unless the night is moonless
      ctx.fillStyle = 'rgba(255,250,230,.75)';
      for (let i = 0; i < 40; i++) {
        const x = hash(i) * L.w, y = hash(i + 50) * this.Y(0.6);
        const tw = 0.5 + 0.5 * Math.sin(this.clock * (1 + hash(i + 9) * 2) + i);
        ctx.globalAlpha = 0.3 + 0.6 * tw;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      if (!sim.blind) {
        const mx = L.w * 0.82, my = Math.max(L.top * 0.5, this.Y(-0.6));
        glow(ctx, mx, my, 40, 'rgba(255,248,220,', 0.25);
        ctx.fillStyle = '#fff6dc';
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, TAU);
        ctx.fill();
      }
    }
    // the hills outside, down to the wall
    const gh = ctx.createLinearGradient(0, this.Y(0.6), 0, this.Y(RULES.wallOut));
    gh.addColorStop(0, n > 0.5 ? C.nightHill : C.hill1);
    gh.addColorStop(1, n > 0.5 ? C.nightGround : C.hill0);
    ctx.fillStyle = gh;
    ctx.fillRect(0, this.Y(0.6), L.w, this.Y(RULES.wallOut) - this.Y(0.6) + 2);
    // terraces, rocks and olive trees (fixed in the world)
    ctx.strokeStyle = n > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(120,90,50,.18)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const y = this.Y(1 + i * 0.55);
      ctx.beginPath();
      for (let x = -0.5; x <= RULES.worldW + 0.5; x += 0.5) {
        const yy = y + Math.sin(x * 0.9 + i * 1.7) * this.L.s * 0.06;
        if (x === -0.5) ctx.moveTo(this.X(x), yy); else ctx.lineTo(this.X(x), yy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 3 + 1) * RULES.worldW, y = 1.2 + hash(i * 5 + 2) * 2.6;
      if (ROUTE_IDS.some(r => Math.abs(routeAtY(r, y) - x) < 0.8)) continue;
      if (i % 3 === 0) paintOlive(ctx, this.X(x), this.Y(y), this.L.s, n > 0.5, i);
      else {
        ctx.fillStyle = n > 0.5 ? '#2b2a44' : C.hill2;
        ctx.beginPath();
        ctx.ellipse(this.X(x), this.Y(y), this.L.s * 0.14, this.L.s * 0.08, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  /**
   * The band's history (the last 40 s) as the ridge of the far hills: the skyline is the signal (time
   * runs left to right, "now" at the right edge), its threshold a dashed snow line, the ridge lit gold
   * where it stands above it, a cool tint behind the days, a mist over a moonless night until dawn, a
   * dotted gap where the band had no signal, and the band's delay bracketed at "now".
   */
  private ridge(sim: NehSim): void {
    const ctx = this.ctx, L = this.L, s = L.s;
    const night = this.nightK > 0.5;
    const bottom = this.Y(1.25), hgt = Math.max(26, s * 0.95);
    const box = { x: 0, y: bottom - hgt, w: L.w, h: hgt };
    const lay = this.trace.layout(box, sim.t, { minSpan: 5 });
    const pts = lay.points;
    ctx.save();
    // the bands behind days, the veil over a moonless night
    for (const b of lay.bands) {
      if (b.phase === 'rest') {
        ctx.fillStyle = night ? 'rgba(120,180,220,.14)' : 'rgba(110,170,210,.18)';
        ctx.fillRect(b.x0, box.y - 4, Math.max(1, b.x1 - b.x0), hgt + 4);
      }
    }
    // the hills under the curve
    ctx.fillStyle = night ? '#323a66' : '#c3a26a';
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    let first = true;
    for (const p of pts) {
      const y = Number.isFinite(p.y) && p.shown > 0 ? p.y : bottom - hgt * 0.25;
      if (first) { ctx.lineTo(p.x, y); first = false; } else ctx.lineTo(p.x, y);
    }
    if (pts.length) ctx.lineTo(pts[pts.length - 1].x, bottom);
    ctx.lineTo(L.w, bottom);
    ctx.closePath();
    ctx.fill();
    // the threshold: a dashed snow line
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = night ? 'rgba(255,250,232,.45)' : 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.ty) : ctx.moveTo(p.x, p.ty)));
    ctx.stroke();
    ctx.setLineDash([]);
    // the ridge line: gold where above the threshold
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const shown = Math.min(a.shown, b.shown);
      if (!a.reliable || !b.reliable || shown <= 0) continue;
      ctx.globalAlpha = shown;
      ctx.strokeStyle = a.above && b.above ? C.gold : night ? 'rgba(200,205,235,.7)' : 'rgba(120,90,50,.7)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // gaps: a dotted floor
    ctx.strokeStyle = night ? 'rgba(255,255,255,.4)' : 'rgba(90,60,30,.4)';
    ctx.setLineDash([1, 5]);
    ctx.lineWidth = 1.5;
    let gap: number | null = null;
    for (let i = 0; i <= pts.length; i++) {
      const p = pts[i];
      const g = p && !p.reliable && p.shown > 0;
      if (g && gap === null) gap = p.x;
      if (!g && gap !== null) {
        ctx.beginPath();
        ctx.moveTo(gap, bottom - 3);
        ctx.lineTo(p ? p.x : pts[pts.length - 1].x, bottom - 3);
        ctx.stroke();
        gap = null;
      }
    }
    ctx.setLineDash([]);
    // the mist over a moonless night, until dawn lifts it
    for (const b of lay.bands) {
      if (!b.veiled) continue;
      ctx.fillStyle = 'rgba(190,200,230,.8)';
      ctx.fillRect(b.x0, box.y - 4, Math.max(1, b.x1 - b.x0), hgt + 4);
    }
    // the band's delay at "now"
    const lag = LAG_SEC[this.opts.eeg ? 'eeg' : 'fnirs'];
    if (pts.length > 1) {
      const last = pts[pts.length - 1];
      const x0 = lay.xOf(last.t - lag);
      ctx.strokeStyle = night ? 'rgba(255,240,210,.6)' : 'rgba(80,55,30,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, box.y + 2);
      ctx.lineTo(x0, box.y - 3);
      ctx.lineTo(last.x - 1, box.y - 3);
      ctx.lineTo(last.x - 1, box.y + 2);
      ctx.stroke();
      if (last.reliable && last.shown > 0) {
        ctx.fillStyle = last.above ? C.gold : '#fff6dc';
        ctx.beginPath();
        ctx.arc(last.x - 2, last.y, 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private roads(sim: NehSim): void {
    const ctx = this.ctx, s = this.L.s, night = this.nightK > 0.5;
    for (const id of ROUTE_IDS) {
      const pts = smoothRoad(ROUTES[id].pts).filter(([, y]) => y >= 1.1);
      for (const [col, wdt] of [[night ? '#2d2b46' : 'rgba(169,130,79,.55)', 0.4], [night ? '#33314e' : 'rgba(200,160,106,.8)', 0.28]] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = s * wdt * K;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(this.X(x), this.Y(y)) : ctx.moveTo(this.X(x), this.Y(y))));
        ctx.stroke();
      }
      // a band's pennant where the road comes over the ridge
      const head = routeAt(id, 0.9);
      const hx = this.X(head.x + 0.55), hy = this.Y(head.y);
      ctx.strokeStyle = night ? '#4a4660' : C.timberDark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx, hy - s * 0.5);
      ctx.stroke();
      ctx.fillStyle = bandColor(ROUTES[id].band);
      ctx.beginPath();
      ctx.moveTo(hx, hy - s * 0.5);
      ctx.lineTo(hx + s * 0.3, hy - s * 0.42 + Math.sin(this.clock * 3 + hx) * 2);
      ctx.lineTo(hx, hy - s * 0.32);
      ctx.closePath();
      ctx.fill();
    }
    void sim;
  }

  private cityGround(sim: NehSim): void {
    const ctx = this.ctx, L = this.L, s = L.s, night = this.nightK > 0.5;
    // the wall's footprint: packed earth between its faces (seen where the wall is still rubble)
    ctx.fillStyle = night ? '#2f2d48' : '#cdb27c';
    ctx.fillRect(0, this.Y(RULES.wallOut) - 1, L.w, this.Y(RULES.wallIn) - this.Y(RULES.wallOut) + 2);
    const top = this.Y(RULES.wallIn - 0.1);
    const g = ctx.createLinearGradient(0, top, 0, this.Y(RULES.worldH));
    g.addColorStop(0, night ? '#34314e' : C.groundDark);
    g.addColorStop(1, night ? '#2b2944' : C.ground);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, L.w, L.h - top);
    // the main street from the gate to the governor's house, and a cross street
    ctx.fillStyle = night ? 'rgba(255,255,255,.04)' : 'rgba(255,240,205,.45)';
    ctx.beginPath();
    ctx.moveTo(this.X(8.3), top);
    ctx.lineTo(this.X(9.7), top);
    ctx.lineTo(this.X(9.9), this.Y(10));
    ctx.lineTo(this.X(8.1), this.Y(10));
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(this.X(0), this.Y(9.3), this.X(18) - this.X(0), s * 0.5 * K);
    // the camp of tents (bottom left): newcomers come here
    paintTents(ctx, this.X(1.0), this.Y(9.75), s, Math.min(6, Math.max(2, Math.ceil(sim.p.people / 5))), night);
  }

  // ── the build sites (by day) ────────────────────────────────────
  /** The spots on the ground where Nehemiah stands to build (a dashed ring), and his build's ring filling. */
  private groundMarks(sim: NehSim): void {
    if (!sim.dayTime || sim.frozen) return;
    const ctx = this.ctx, s = this.L.s;
    for (const m of MARKERS) {
      const mv = sim.markerView(m.id);
      if (mv.next === null && mv.working === null) continue;
      const x = this.X(m.x), y = this.Y(m.y);
      const guide = sim.guideId === m.id;
      const r = s * 0.42;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = guide ? 2.5 : 1.5;
      ctx.strokeStyle = mv.working !== null ? 'rgba(255,215,120,.5)' : guide ? C.gold : mv.can ? 'rgba(255,236,190,.85)' : 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * K * 0.62, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      if (sim.neh.build?.id === m.id) {
        const k = clamp(sim.neh.build.t / RULES.buildSec);
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.1, r * K * 0.7, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
      }
    }
  }

  /**
   * The build badges: a disc with what the site builds and its next level as pips — cream where the stores
   * can pay, dark where they cannot, gold and bobbing under a chevron for the guide's pick; pressed, it
   * sinks and shows its cost.  One cost card at a time: the pressed badge, else the site Nehemiah stands
   * by, else the guide's.
   */
  private buildBadges(sim: NehSim): void {
    const list = this.badges(sim);
    if (!list.length) return;
    const ctx = this.ctx;
    const pressId = this.press?.kind === 'marker' ? this.press.id : null;
    const near = sim.markerNear(sim.neh.x, sim.neh.y, RULES.standR * 1.6);
    let card: BadgeView | null = null;
    for (const b of list) {
      const guide = sim.guideId === b.id, pressed = pressId === b.id;
      const bob = guide && !pressed ? Math.sin(this.clock * 4) * 1.5 : 0;
      const r = b.r * (pressed ? 0.86 : 1);
      const can = b.mv.can;
      ctx.save();
      ctx.globalAlpha = b.free ? 1 : 0.5;
      ctx.translate(b.x, b.y + bob);
      ctx.fillStyle = 'rgba(30,18,8,.28)';
      ctx.beginPath();
      ctx.arc(0, 2, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = can ? (guide ? '#ffe39a' : '#fff3d6') : 'rgba(36,27,20,.8)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = guide || pressed ? 2.5 : 1.5;
      ctx.strokeStyle = pressed ? C.gold : guide ? '#c9902e' : can ? 'rgba(165,116,58,.9)' : 'rgba(255,236,200,.5)';
      ctx.stroke();
      paintKindIcon(ctx, b.kind, 0, -r * 0.1, r * 0.56, can ? '#5a3c1e' : 'rgba(255,240,215,.85)');
      const pips = b.mv.next ?? 1;
      ctx.fillStyle = can ? '#a5743a' : 'rgba(255,240,215,.75)';
      for (let i = 0; i < pips; i++) {
        ctx.beginPath();
        ctx.arc((i - (pips - 1) / 2) * r * 0.3, r * 0.64, Math.max(1.4, r * 0.09), 0, TAU);
        ctx.fill();
      }
      if (sim.neh.build?.id === b.id) {
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.neh.build.t / RULES.buildSec));
        ctx.stroke();
      }
      ctx.restore();
      if (guide && !sim.neh.build && b.free) paintChevron(ctx, b.x, b.y - b.r - 9 - Math.abs(Math.sin(this.clock * 4)) * 5, Math.max(6, b.r * 0.45), C.gold);
      if (pressed) card = b;
      if (b.free) this.avoid.push(b.box);
      if (b.free && guide) this.avoid.push(b.box, b.box);
    }
    // the card: the pressed badge, else the site Nehemiah stands on (standing builds it), else — where the
    // guide's button does not already say it (wider screens) — the guide's pick
    // (those two only where they cover no other badge a finger may want)
    const pressedCard = !!card;
    if (!card) card = list.find(b => b.id === near?.id && b.free) ?? (this.L.phone ? null : list.find(b => b.id === sim.guideId && b.free)) ?? null;
    if (card && card.mv.cost && card.mv.next !== null) {
      const others = pressedCard ? null : list.filter(b => b.free && b.id !== card!.id).map(b => b.box);
      this.costCard(card, tierName(card.kind, card.mv.next), card.mv.cost, sim.p.stone, sim.p.timber, others);
    }
  }

  /** A badge's cost card: above it, or below where the HUD leaves no room; with `clear`, only where it covers none of those. */
  private costCard(b: Badge, name: string, cost: { stone: number; timber: number }, stone: number, timber: number, clear: Rect[] | null): void {
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.save();
    ctx.font = font(13 * u, 750);
    const nameW = ctx.measureText(name).width;
    const r = 7 * u;
    const parts: [number, boolean, 'stone' | 'timber'][] = [];
    if (cost.stone > 0) parts.push([cost.stone, stone >= cost.stone, 'stone']);
    if (cost.timber > 0) parts.push([cost.timber, timber >= cost.timber, 'timber']);
    const costW = parts.reduce((s2, [n]) => s2 + r * 2 + 8 + ctx.measureText(String(n)).width + 6, 0);
    const w = Math.min(L.right - L.left, Math.max(nameW, costW) + 18 * u), h = 42 * u;
    const bx = clamp(b.x - w / 2, L.left, L.right - w);
    let by = b.y - b.r - 12 - h;
    if (by < L.top + 4) by = b.y + b.r + 8;
    const rect = { x: bx, y: by, w, h };
    if (clear?.some(r => overlaps(r, rect))) {
      ctx.restore();
      return;
    }
    this.avoid.push(rect);
    ctx.fillStyle = 'rgba(255,246,227,.96)';
    roundRect(ctx, bx, by, w, h, 9 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(165,116,58,.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let label = name;
    while (label.length > 4 && ctx.measureText(label).width > w - 12) label = `${label.slice(0, -2)}…`;
    ctx.fillText(label, bx + w / 2, by + 5 * u);
    let cx = bx + w / 2 - costW / 2;
    const cy = by + 29 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const [n, ok, kind] of parts) {
      if (kind === 'stone') paintStoneIcon(ctx, cx + r, cy, r);
      else paintTimberIcon(ctx, cx + r, cy, r);
      cx += r * 2 + 4;
      ctx.fillStyle = ok ? C.ink : C.red;
      ctx.fillText(String(n), cx, cy + 1);
      cx += ctx.measureText(String(n)).width + 10;
    }
    ctx.restore();
  }

  // ── the scene, in depth order ───────────────────────────────────
  private scene(sim: NehSim): void {
    const ctx = this.ctx, s = this.L.s, p = sim.p, night = this.nightK > 0.5, t = this.clock;
    const items: { y: number; draw: () => void }[] = [];
    const add = (y: number, draw: () => void) => items.push({ y, draw });
    // the wall: six sections and the gate (their inner face stands at wallIn)
    const yOut = this.Y(RULES.wallOut), yIn = this.Y(RULES.wallIn);
    SEGS.forEach((sg, i) => {
      const w = p.wall[i];
      const h = heightOf(i, w), mh = maxHp(i, w);
      const breach = w.hp <= 0 && h >= RULES.openBelow;
      const working = w.tier > w.done ? w.prog / Math.max(1, (sg.gate ? RULES.gateCubits : RULES.segCubits)[w.done + 1]) : null;
      add(RULES.wallIn, () => {
        if (sg.gate) paintGate(ctx, this.X(sg.x0), this.X(sg.x1), yOut, yIn, s, { tier: w.done, h, hp: mh > 0 ? w.hp / mh : 1, breach, working, night, open: !sim.nightTime, t });
        else paintWallSeg(ctx, this.X(sg.x0), this.X(sg.x1), yOut, yIn, s, { h, hp: mh > 0 ? w.hp / mh : 1, breach, working, night, t, seed: i * 13 + p.gate * 7, done: w.done });
      });
    });
    const wallTop = (x: number): number => yIn - wallHeightU(heightOf(segAt(x), p.wall[segAt(x)])) * UP * s;
    // towers and fires stand on the wall
    for (const id of TOWER_IDS) {
      const lv = p.stretch[id] ?? 0;
      if (!lv) continue;
      const m = markerSpec(id)!;
      add(RULES.wallIn + 0.01, () => {
        const top = paintTower(ctx, this.X(m.x), wallTop(m.x) + s * 0.25, s, lv, p.towerKind[id] ?? '', night, t);
        const men = sim.nightTime ? sim.manned[id] ?? 0 : Math.min(2, RULES.towerSlingers[lv]);
        for (let k = 0; k < men; k++) paintWorker(ctx, this.X(m.x) + (k - (men - 1) / 2) * s * 0.26, top, s * 0.85, 'slinger', t + k, k + 3, k % 2 ? -1 : 1);
      });
    }
    for (const id of FIRE_IDS) {
      const lv = p.stretch[id] ?? 0;
      if (!lv) continue;
      const m = markerSpec(id)!;
      add(RULES.wallIn + 0.02, () => {
        const base = fireReach(lv, 0), extra = fireReach(lv, 1) - base;
        const flame = extra > 0 ? clamp(((sim.fireR[id] ?? base) - base) / extra) : 0;
        paintBrazier(ctx, this.X(m.x), wallTop(m.x) + s * 0.08, s, lv, flame, sim.strongLight, sim.fireDim[id] ?? 0, this.nightK > 0.3, t);
      });
    }
    // the city
    const cityItem = (id: string, draw: (x: number, y: number) => void) => {
      const m = markerSpec(id)!;
      add(m.y, () => draw(this.X(m.x), this.Y(m.y)));
    };
    cityItem('yard', (x, y) => paintYard(ctx, x, y, s, p.city.yard ?? 1, night, p.stone, stoneCap(p)));
    cityItem('well', (x, y) => paintWell(ctx, x, y, s, p.city.well ?? 0, night, t));
    cityItem('bakery', (x, y) => paintBakery(ctx, x, y, s, p.city.bakery ?? 0, night, t, p.bread));
    cityItem('granary', (x, y) => paintGranary(ctx, x, y, s, p.city.granary ?? 0, night));
    cityItem('gov', (x, y) => paintGovernor(ctx, x, y, s, p.city.gov ?? 1, night));
    for (const id of ['h0', 'h1', 'h2', 'h3']) cityItem(id, (x, y) => paintHouse(ctx, x, y, s, p.city[id] ?? 0, night, id.charCodeAt(1)));
    for (const id of POST_IDS) {
      const lv = p.stretch[id] ?? 0;
      if (!lv) continue;
      cityItem(id, (x, y) => paintPost(ctx, x, y, s, lv, night));
    }
    // the dressed stones waiting by the gate
    if (p.dressed > 1) add(6.3, () => {
      const n = Math.min(10, Math.ceil(p.dressed / 4));
      for (let i = 0; i < n; i++) paintStoneIcon(ctx, this.X(10.8 + (i % 5) * 0.22), this.Y(6.3) - Math.floor(i / 5) * s * 0.14, s * 0.1);
    });
    // people at work (by day) and the guards (by night)
    this.workers(sim, add);
    // the raiders
    for (const r of sim.raiders) {
      if (r.y < 0.95) continue;
      add(r.y, () => {
        const x = this.X(r.x), y = this.Y(r.y);
        ctx.globalAlpha = clamp((r.y - 0.95) / 0.5);
        const climb = r.state === 'climb' ? (1 - clamp(r.t / (r.kind === 'drabina' ? RULES.climbLadder : RULES.climbLow))) * s * 0.7 : 0;
        const walking = r.state === 'walk' || r.state === 'foot' || r.state === 'inside' || r.state === 'out' || r.state === 'flee' ? 1 : 0;
        const act = r.state === 'pry' ? 0.5 + 0.5 * Math.sin(t * 9 + r.seed * 7) : r.state === 'sling' ? (t * 1.6 + r.seed) % 1 : r.state === 'grab' ? 0.8 : 0.2;
        paintRaider(ctx, x, y, s, { kind: r.kind, band: r.band, flip: r.face, step: t * (r.state === 'flee' ? 16 : 9) + r.seed * 6, walking, act, hit: r.hit, flee: r.state === 'flee', seed: Math.floor(r.seed * 100), loot: !!r.loot, climb });
        // courage pips over a struck raider
        if (r.state !== 'flee' && r.courage < r.max && r.seen) {
          const k = clamp(r.courage / r.max);
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.fillRect(x - s * 0.22, y - s * 0.95 - climb, s * 0.44, 3);
          ctx.fillStyle = '#ffd36b';
          ctx.fillRect(x - s * 0.22, y - s * 0.95 - climb, s * 0.44 * k, 3);
        }
        ctx.globalAlpha = 1;
      });
    }
    // the messenger with the invitation to Ono
    const msg = sim.messenger;
    if (msg) add(msg.y, () => {
      paintRaider(ctx, this.X(msg.x), this.Y(msg.y), s, { kind: 'rabus', band: 'samaria', flip: msg.state === 'go' ? -1 : 1, step: t * 10, walking: msg.state === 'wait' ? 0 : 1, act: 0.9, hit: 0, flee: false, seed: 1, loot: false, climb: 0 });
      ctx.fillStyle = C.paper;
      roundRect(ctx, this.X(msg.x) + s * 0.12, this.Y(msg.y) - s * 0.95, s * 0.16, s * 0.24, 3);
      ctx.fill();
    });
    // Nehemiah (on the wall walk he stands on the wall) and Tirza
    const nehOnWall = sim.neh.y < RULES.wallIn - 0.02;
    const nehY = nehOnWall ? Math.min(this.Y(sim.neh.y), wallTop(sim.neh.x) + s * 0.25) : this.Y(sim.neh.y);
    add(nehOnWall ? RULES.wallIn + 0.03 : sim.neh.y, () => paintNehemiah(ctx, this.X(sim.neh.x), nehY, s, {
      flip: sim.neh.face, step: this.stepN, walking: sim.neh.walking, arm: sim.hornReady ? 0.6 : 0, build: sim.neh.build ? 1 : 0, night: sim.nightTime, t,
    }));
    const z = sim.tirza;
    const zOn = z.y < RULES.wallIn - 0.02;
    const zY = zOn ? Math.min(this.Y(z.y), wallTop(z.x) + s * 0.25) : this.Y(z.y);
    add(zOn ? RULES.wallIn + 0.035 : z.y, () => {
      paintTirza(ctx, this.X(z.x), zY, s, { flip: z.face, step: this.stepZ, walking: z.walking, arm: 0, night: sim.nightTime, talk: sim.talk.line?.speaker === 'tirza', t });
      if (sim.nightTime) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.X(z.x) + z.face * s * 0.12, zY - s * 0.3, s * 0.5, 'rgba(255,200,120,', 0.3);
        ctx.restore();
      }
    });
    // the villains on the hill
    if (sim.villains > 0.02) {
      const vx = this.X(VILLAINS.x), vy = this.Y(VILLAINS.y);
      add(VILLAINS.y, () => {
        ctx.save();
        ctx.globalAlpha = clamp(sim.villains);
        const rise = (1 - sim.villains) * s * 0.4;
        ctx.fillStyle = this.nightK > 0.5 ? '#2b2a44' : C.hill2;
        ctx.beginPath();
        ctx.ellipse(vx + s * 0.35, vy + s * 0.05, s * 0.9, s * 0.2, 0, 0, TAU);
        ctx.fill();
        const talkS = sim.talk.line?.speaker;
        paintSanballat(ctx, vx, vy + rise, s * 0.95, t, talkS === 'sanballat', sim.nightsHeld > 0 ? 0.4 : 0);
        paintTobiah(ctx, vx + s * 0.75, vy + rise, s * 0.95, t, talkS === 'tobiah');
        paintFox(ctx, vx + s * 1.12, vy + rise + s * 0.05, s * 0.8, t, -1, 0);
        ctx.restore();
      });
    }
    // Tobiah's fox on the wall
    const fox = sim.fox;
    if (fox && fox.t > 0) add(RULES.wallIn + 0.04, () => paintFox(ctx, this.X(fox.x), wallTop(clamp(fox.x, 0, 17.9)) + s * 0.18, s * 0.9, t, 1, 1));
    // the newcomers walking in
    for (const nc of this.newcomers) add(nc.y, () => paintWorker(ctx, this.X(nc.x), this.Y(nc.y), s, 'newcomer', t, nc.seed, 1, 1));
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
  }

  /** The people at work by day (builders at the front, stone carriers, bakers, the water carrier) and the guards. */
  private workers(sim: NehSim, add: (y: number, draw: () => void) => void): void {
    const ctx = this.ctx, s = this.L.s, t = this.clock, p = sim.p;
    const j = sim.jobsNow;
    const put = (x: number, y: number, job: Job, seed: number, flip: 1 | -1 = 1, walking = 0) => add(y, () => paintWorker(ctx, this.X(x), this.Y(y), s, job, t, seed, flip, walking));
    if (!sim.nightTime) {
      const seg = sim.mendSeg >= 0 ? sim.mendSeg : sim.front;
      const nb = Math.min(10, j.builders);
      for (let i = 0; i < nb; i++) {
        if (seg >= 0) {
          const sg = SEGS[seg];
          const x = sg.x0 + 0.25 + ((i + 0.5) / nb) * (sg.x1 - sg.x0 - 0.5);
          put(x, RULES.wallIn + 0.18 + (i % 2) * 0.22, 'builder', i, i % 2 ? -1 : 1);
        } else put(10.5 + (i % 5) * 0.3, 6.55 + Math.floor(i / 5) * 0.3, 'builder', i, i % 2 ? -1 : 1);
      }
      const yard = markerSpec('yard')!;
      for (let i = 0; i < Math.min(4, j.quarry); i++) put(yard.x - 0.5 + i * 0.35, yard.y + 0.45, 'quarry', i + 10, i % 2 ? -1 : 1);
      const bak = markerSpec('bakery')!;
      for (let i = 0; i < Math.min(4, j.bakers); i++) put(bak.x - 0.45 + i * 0.32, bak.y + 0.45, 'baker', i + 20);
      const well = markerSpec('well')!;
      for (let i = 0; i < Math.min(2, j.water); i++) {
        const k = (Math.sin(t * 0.5 + i * 2) + 1) / 2;
        const fx = segMid(sim.front >= 0 ? sim.front : GATE_SEG);
        put(well.x + (fx - well.x) * k, well.y + 0.3 + (RULES.wallIn + 0.6 - well.y - 0.3) * k, 'water', i + 30, Math.cos(t * 0.5 + i * 2) > 0 ? 1 : -1, 1);
      }
      for (const id of POST_IDS) {
        const lv = p.stretch[id] ?? 0;
        if (!lv) continue;
        const m = markerSpec(id)!;
        for (let k = 0; k < Math.min(2, RULES.postGuards[lv]); k++) put(m.x - 0.3 + k * 0.6, m.y + 0.3, 'guard', k + 40);
      }
      return;
    }
    for (const g of sim.guards) {
      if (!g.hero) {
        add(g.y, () => paintWorker(ctx, this.X(g.x), this.Y(g.y), s, 'guard', t, g.id, g.face));
        continue;
      }
      // Nehemiah's officers: their own figures; they walk while they move
      const prev = this.guardPrev.get(g.id);
      const moved = prev ? Math.hypot(g.x - prev.x, g.y - prev.y) : 0;
      const walking = approach(prev?.walking ?? 0, moved > 0.004 ? 1 : 0, 1 / 60, 0.08);
      this.guardPrev.set(g.id, { x: g.x, y: g.y, walking });
      const hero = g.hero;
      add(g.y, () => paintOfficer(ctx, this.X(g.x), this.Y(g.y), s, hero, { flip: g.face, step: t * 10 + g.id, walking, t }));
    }
  }

  // ── the night: darkness, the fires' light and their rings ──────
  private night(sim: NehSim): void {
    const n = this.nightK;
    if (n < 0.02 && this.duskK < 0.02) return;
    const ctx = this.ctx, L = this.L, s = L.s;
    if (this.duskK > 0.02 && n < 0.5) {
      ctx.fillStyle = `rgba(200,90,60,${0.14 * this.duskK})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    if (n < 0.02) return;
    if (!this.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = Math.max(1, Math.round(L.w * this.dpr));
      this.dark.height = Math.max(1, Math.round(L.h * this.dpr));
    }
    const o = this.dark.getContext('2d');
    if (!o) return;
    o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, L.w, L.h);
    o.fillStyle = `rgba(8,12,34,${0.58 * n})`;
    o.fillRect(0, 0, L.w, L.h);
    o.globalCompositeOperation = 'destination-out';
    // the city keeps a little lamplight
    const yIn = this.Y(RULES.wallIn);
    const cg = o.createLinearGradient(0, yIn - s * 0.4, 0, yIn + s * 1.5);
    cg.addColorStop(0, 'rgba(0,0,0,0)');
    cg.addColorStop(1, 'rgba(0,0,0,.6)');
    o.fillStyle = cg;
    o.fillRect(0, yIn - s * 0.4, L.w, L.h);
    const hole = (x: number, y: number, r: number, a = 1) => {
      if (r <= 0) return;
      o.save();
      o.translate(x, y);
      o.scale(1, K);
      const g = o.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.72, `rgba(0,0,0,${a * 0.85})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = g;
      o.beginPath();
      o.arc(0, 0, r, 0, TAU);
      o.fill();
      o.restore();
    };
    for (const id of FIRE_IDS) {
      const r = sim.fireR[id] ?? 0;
      if (r > 0) hole(this.X(markerSpec(id)!.x), this.Y(RULES.wallY), r * s * 1.08);
    }
    hole(this.X(sim.tirza.x), this.Y(sim.tirza.y), RULES.lamp * s * 1.2, 0.8);
    // Nehemiah's torch: the player is never lost in the dark
    hole(this.X(sim.neh.x), this.Y(sim.neh.y) - s * 0.3, s * 1.05, 0.85);
    ctx.drawImage(this.dark, 0, 0, L.w, L.h);
    // raiders in the dark: only the whites of their eyes catch a glint
    ctx.fillStyle = `rgba(255,250,230,${0.75 * n})`;
    for (const r of sim.raiders) {
      if (r.seen || r.state === 'flee' || r.y < 1.1) continue;
      const blink = Math.sin(this.clock * 2.3 + r.seed * 20) > 0.93 ? 0.3 : 1;
      const ex = this.X(r.x) + r.face * s * 0.05, ey = this.Y(r.y) - s * 0.5;
      ctx.fillRect(ex - s * 0.05, ey, Math.max(1.5, s * 0.035), Math.max(1.2, s * 0.03 * blink));
      ctx.fillRect(ex + s * 0.02, ey, Math.max(1.5, s * 0.035), Math.max(1.2, s * 0.03 * blink));
    }
    // warmth in the light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const id of FIRE_IDS) {
      const r = sim.fireR[id] ?? 0;
      if (r <= 0) continue;
      glow(ctx, this.X(markerSpec(id)!.x), this.Y(RULES.wallY), r * s * 0.7, sim.strongLight ? 'rgba(255,190,90,' : 'rgba(255,160,80,', 0.12 * n);
    }
    ctx.restore();
    // the band, drawn large: each fire's light edge (gold above the threshold) and its threshold, a dotted
    // ring; above it the ring between them glows gold, below it the gap still to reach reads dark.  The
    // strokes grow with the zoom so a phone reads them at a glance.
    if (!sim.nightTime) return;
    const thin = Math.max(2, s * 0.045), bold = Math.max(3, s * 0.075);
    let label: { x: number; y: number } | null = null, labelD = Infinity;
    ctx.save();
    for (const id of FIRE_IDS) {
      const lv = sim.p.stretch[id] ?? 0;
      if (!lv) continue;
      const fx = this.X(markerSpec(id)!.x), fy = this.Y(RULES.wallY);
      const mark = fireReach(lv, 0.5) * s, live = (sim.fireR[id] ?? 0) * s;
      if (fx + mark < -20 || fx - mark > L.w + 20) continue;
      if (sim.blind) {
        // a moonless night: smoke where the light would be
        ctx.strokeStyle = 'rgba(200,210,235,.3)';
        ctx.setLineDash([3, 7]);
        ctx.lineWidth = thin;
        ctx.beginPath();
        ctx.ellipse(fx, fy, mark, mark * K, 0, Math.PI, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const above = sim.strongLight && live > mark;
      // the band between the threshold and the light's edge
      ctx.beginPath();
      ctx.ellipse(fx, fy, Math.max(live, mark), Math.max(live, mark) * K, 0, Math.PI, TAU);
      ctx.ellipse(fx, fy, Math.min(live, mark), Math.min(live, mark) * K, 0, TAU, Math.PI, true);
      ctx.closePath();
      ctx.fillStyle = above ? 'rgba(255,205,90,.16)' : 'rgba(6,8,24,.22)';
      ctx.fill();
      ctx.setLineDash([thin * 1.6, thin * 2.6]);
      ctx.strokeStyle = 'rgba(255,250,232,.85)';
      ctx.lineWidth = thin;
      ctx.beginPath();
      ctx.ellipse(fx, fy, mark, mark * K, 0, Math.PI, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // the light's edge: a soft wide stroke under a crisp one (no blur)
      ctx.strokeStyle = above ? 'rgba(255,211,107,.3)' : 'rgba(255,236,200,.18)';
      ctx.lineWidth = bold * 2.6;
      ctx.beginPath();
      ctx.ellipse(fx, fy, live, live * K, 0, Math.PI, TAU);
      ctx.stroke();
      ctx.strokeStyle = above ? C.gold : 'rgba(255,236,200,.85)';
      ctx.lineWidth = above ? bold : thin * 1.2;
      ctx.stroke();
      // the threshold's name, on the ring nearest the middle of the screen
      const d = Math.abs(fx - L.w / 2);
      if (d < labelD) { labelD = d; label = { x: fx, y: fy - mark * K }; }
    }
    if (label) {
      ctx.font = font(13 * L.u, 800);
      const text = t('hud.mark');
      const tw = ctx.measureText(text).width + 12 * L.u, th = 18 * L.u;
      const lx = clamp(label.x, L.left + tw / 2, L.right - tw / 2), ly = Math.max(L.top + th, label.y - 4);
      ctx.fillStyle = 'rgba(16,14,34,.72)';
      roundRect(ctx, lx - tw / 2, ly - th, tw, th, th / 2);
      ctx.fill();
      ctx.fillStyle = '#fff6dc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, lx, ly - th / 2 + 1);
    }
    ctx.restore();
  }

  private projectiles(sim: NehSim): void {
    const ctx = this.ctx, s = this.L.s;
    ctx.save();
    for (const pb of sim.pebbles) {
      const k = clamp(pb.t / pb.dur);
      const x = this.X(pb.x0 + (pb.tx - pb.x0) * k);
      const y = this.Y(pb.y0 + (pb.ty - pb.y0) * k) - Math.sin(k * Math.PI) * s * 0.6 - s * 0.35 * k;
      ctx.fillStyle = pb.volley ? C.goldLight : '#efe6d2';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.6, s * 0.05), 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(232,238,246,.85)';
    ctx.lineWidth = 2;
    for (const j of sim.jabs) {
      const k = Math.sin(clamp(j.t / 0.22) * Math.PI);
      const ax = this.X(j.x), ay = this.Y(j.y) - s * 0.45;
      const bx = this.X(j.tx), by = this.Y(j.ty) - s * 0.45;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
      ctx.stroke();
    }
    for (const r of sim.rings) {
      const k = clamp(r.t / r.dur);
      const x = this.X(r.x), y = this.Y(r.y);
      const rr = r.r * s * ease.outCubic(k);
      ctx.strokeStyle = r.kind === 'horn' ? `rgba(255,214,107,${1 - k})` : r.kind === 'breach' ? `rgba(255,150,120,${1 - k})` : `rgba(255,236,190,${0.8 * (1 - k)})`;
      ctx.lineWidth = r.kind === 'horn' ? 5 * (1 - k) + 1 : 2;
      ctx.beginPath();
      ctx.ellipse(x, y, rr, rr * K, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private flyingStuff(sim: NehSim): void {
    const ctx = this.ctx, s = this.L.s;
    for (const fl of this.flying) {
      if (fl.t < 0) continue;
      const k = ease.outCubic(clamp(fl.t / fl.dur));
      const x = this.X(fl.x0 + (fl.x1 - fl.x0) * k);
      const y = this.Y(fl.y0 + (fl.y1 - fl.y0) * k) - Math.sin(k * Math.PI) * s * 1.2;
      if (fl.kind === 'stone') paintStoneIcon(ctx, x, y, s * 0.1);
      else paintTimberIcon(ctx, x, y, s * 0.12);
    }
    void sim;
  }

  // ── the night's preview, the bubbles, off-screen raiders ────────
  /** Tonight's raiders at the head of each road (Thronefall's preview): their kinds and counts. */
  private preview(sim: NehSim): void {
    this.previewRect = null;
    if (!sim.showPreview || !sim.preview.length) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const a = clamp((sim.blockT - (sim.block.dur - RULES.previewSec)) / 0.6);
    const chipH = 30 * u;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(13 * u, 800);
    const make = (compact: boolean) => sim.preview.map(pv => {
      // compact (a narrow row): the road's strongest kind and its whole count
      const all = RAIDER_KINDS.filter(k => (pv.counts[k] ?? 0) > 0);
      const kinds = compact ? all.slice(-1) : all;
      const count = (k: RaiderKind) => (compact ? pv.total : pv.counts[k] ?? 0);
      const w = kinds.reduce((sum, k) => sum + 22 * u + ctx.measureText(`×${count(k)}`).width, 12 * u);
      const head = routeAt(pv.route, 1.4);
      return { pv, kinds, count, w, hx: this.X(head.x), hy: this.Y(head.y) };
    });
    let chips = make(false);
    // where every road's head is on screen the chips stand there; otherwise (a phone's narrow view) they
    // line up under the HUD in the roads' order, each with an arrow toward its road
    const atHeads = chips.every(c => c.hx - c.w / 2 >= L.left && c.hx + c.w / 2 <= L.right && c.hy - chipH / 2 >= L.top + 4);
    const rowW = (cs: typeof chips) => cs.reduce((sum, c) => sum + c.w + 22 * u, 0) + (cs.length - 1) * 6 * u;
    if (!atHeads && rowW(chips) > L.right - L.left) chips = make(true);
    const total = rowW(chips);
    let rowX = L.w / 2 - total / 2;
    if (!atHeads) this.previewRect = { x: rowX, y: L.top + 8, w: total, h: chipH };
    for (const c of chips) {
      const band = ROUTES[c.pv.route].band;
      let bx: number, by: number, arrow = 0;
      if (atHeads) {
        bx = c.hx - c.w / 2;
        by = c.hy - chipH / 2;
      } else {
        arrow = c.hx < 0 ? -1 : c.hx > L.w ? 1 : 0;
        bx = rowX + (arrow < 0 ? 22 * u : 0);
        by = L.top + 8;
        rowX += c.w + 22 * u + 6 * u;
      }
      ctx.fillStyle = 'rgba(30,18,18,.8)';
      roundRect(ctx, bx, by, c.w, chipH, chipH / 2);
      ctx.fill();
      ctx.strokeStyle = bandColor(band);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (arrow !== 0) {
        // an arrow toward the road off the screen's side
        const ax = arrow < 0 ? bx - 6 * u : bx + c.w + 6 * u, ay = by + chipH / 2;
        ctx.fillStyle = bandColor(band);
        ctx.beginPath();
        ctx.moveTo(ax + arrow * 12 * u, ay);
        ctx.lineTo(ax, ay - 8 * u);
        ctx.lineTo(ax, ay + 8 * u);
        ctx.closePath();
        ctx.fill();
      }
      let cx = bx + 9 * u;
      for (const k of c.kinds) {
        this.kindIcon(k, cx + 7 * u, by + chipH / 2, 7.5 * u, band);
        cx += 16 * u;
        ctx.fillStyle = '#fff4dc';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        const txt = `×${c.count(k)}`;
        ctx.fillText(txt, cx, by + chipH / 2 + 1);
        cx += ctx.measureText(txt).width + 6 * u;
      }
    }
    ctx.restore();
  }

  private kindIcon(k: RaiderKind, x: number, y: number, r: number, band: 'samaria' | 'arabia' | 'ammon'): void {
    const ctx = this.ctx;
    ctx.fillStyle = bandColor(band);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.raider;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.45, r * 0.6, r * 0.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#fff4dc';
    ctx.lineWidth = 1.2;
    if (k === 'drabina') {
      ctx.beginPath();
      ctx.moveTo(x + r * 0.7, y + r * 0.6); ctx.lineTo(x + r * 1.0, y - r * 0.8);
      ctx.stroke();
    } else if (k === 'taran') {
      ctx.fillStyle = '#a0703f';
      ctx.fillRect(x - r, y + r * 0.1, r * 2, r * 0.35);
    } else if (k === 'procarz') {
      ctx.beginPath();
      ctx.arc(x + r * 0.75, y - r * 0.6, r * 0.3, 0, TAU);
      ctx.stroke();
    } else if (k === 'kapitan') {
      ctx.fillStyle = C.gold;
      ctx.fillRect(x - r * 0.35, y - r * 1.1, r * 0.7, r * 0.3);
    }
  }

  /** The speech bubble: Tirza's over her head, the villains' over the hill, the messenger's at the gate. */
  private bubbles(sim: NehSim): void {
    const line = sim.talk.line;
    this.bubbleRect = null;
    if (!line || sim.frozen) return;
    const ctx = this.ctx, L = this.L, s = L.s, u = L.u;
    let ax: number, ay: number;
    if (line.speaker === 'tirza') { ax = this.X(sim.tirza.x); ay = this.Y(sim.tirza.y) - s * 0.75; }
    else if (line.speaker === 'messenger' && sim.messenger) { ax = this.X(sim.messenger.x); ay = this.Y(sim.messenger.y) - s * 0.9; }
    else { ax = this.X(VILLAINS.x + (line.speaker === 'tobiah' ? 0.75 : 0)); ay = this.Y(VILLAINS.y) - s * 0.95; }
    const name = t(line.speaker === 'tirza' ? 'name.tirza' : line.speaker === 'sanballat' ? 'name.sanballat' : line.speaker === 'tobiah' ? 'name.tobiah' : 'name.messenger');
    const k = clamp(line.t / 0.18), out = clamp((line.dur - line.t) / 0.25);
    ctx.save();
    ctx.globalAlpha = Math.min(k, out);
    const px = (L.phone ? 14 : 15) * u;
    ctx.font = font(px, 650);
    const maxW = Math.min((L.phone ? 260 : 290) * u, L.right - L.left);
    const words = line.text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const next = cur ? `${cur} ${wd}` : wd;
      if (cur && ctx.measureText(next).width > maxW - 24 * u) { lines.push(cur); cur = wd; } else cur = next;
    }
    if (cur) lines.push(cur);
    const lh = Math.round(px * 1.3);
    const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 24 * u);
    const h = lines.length * lh + 31 * u;
    // the first place that covers no build badge (nor the cost card): above the speaker, below, to a side,
    // up under the HUD; never over the panel's buttons
    const spot = (x: number, y: number) => ({ x: Math.round(clamp(x, L.left, L.right - w)), y: Math.max(L.top + 4, Math.min(y, L.bottom - h - 6)) });
    const up = ay - h - 8 * u, down = ay + s * 1.0;
    const tries = [
      spot(ax - w / 2, up), spot(ax - w + 26, up), spot(ax - 26, up),
      spot(ax - w / 2, down), spot(ax - w + 26, down), spot(ax - 26, down),
      spot(L.left, L.top + 4), spot(L.right - w, L.top + 4), spot(L.left, L.bottom), spot(L.right - w, L.bottom),
    ];
    const cover = (p: { x: number; y: number }) => this.avoid.reduce((sum, r) => {
      const ox = Math.min(p.x + w, r.x + r.w) - Math.max(p.x, r.x), oy = Math.min(p.y + h, r.y + r.h) - Math.max(p.y, r.y);
      return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
    }, 0);
    let best = tries[0], bestC = cover(best);
    for (const p of tries) {
      if (bestC === 0) break;
      const c = cover(p);
      if (c < bestC) { best = p; bestC = c; }
    }
    const bx = best.x, by = best.y;
    const below = by > ay;
    if (Math.min(k, out) > 0.5) this.bubbleRect = { x: bx, y: by, w, h };
    const pop = ease.outBack(k);
    ctx.translate(ax, below ? by : by + h);
    ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop);
    ctx.translate(-ax, -(below ? by : by + h));
    const villain = line.speaker !== 'tirza';
    ctx.fillStyle = villain ? '#efe3f7' : '#fff7e3';
    roundRect(ctx, bx, by, w, h, 12 * u);
    ctx.fill();
    ctx.beginPath();
    const tx = clamp(ax, bx + 14, bx + w - 14);
    if (below) { ctx.moveTo(tx - 7, by); ctx.lineTo(tx, by - 9); ctx.lineTo(tx + 7, by); } else { ctx.moveTo(tx - 7, by + h); ctx.lineTo(tx, by + h + 9); ctx.lineTo(tx + 7, by + h); }
    ctx.fill();
    ctx.fillStyle = villain ? '#6b4a8a' : '#a5432c';
    ctx.font = font(13 * u, 800);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(name.toUpperCase(), bx + 12 * u, by + 7 * u);
    ctx.fillStyle = C.ink;
    ctx.font = font(px, 650);
    lines.forEach((l, i) => ctx.fillText(l, bx + 12 * u, by + 24 * u + i * lh));
    ctx.restore();
  }

  /** Arrows at the screen's edge for raiders the camera does not show (phones). */
  private offscreen(sim: NehSim): void {
    if (!this.L.panX && !this.L.panY) return;
    if (!sim.nightTime) return;
    const ctx = this.ctx, L = this.L;
    let left = 0, right = 0;
    for (const r of sim.raiders) {
      if (r.state === 'flee') continue;
      const x = this.X(r.x);
      if (x < -8) left++;
      else if (x > L.w + 8) right++;
    }
    const y = clamp(this.Y(RULES.wallY - 1.2), L.top + 30, L.bottom - 40);
    ctx.save();
    ctx.font = font(13 * L.u, 800);
    ctx.textBaseline = 'middle';
    for (const [n, side] of [[left, -1], [right, 1]] as const) {
      if (!n) continue;
      const x = side < 0 ? 16 : L.w - 16;
      ctx.fillStyle = 'rgba(210,85,63,.92)';
      ctx.beginPath();
      ctx.moveTo(x + side * 12, y);
      ctx.lineTo(x - side * 5, y - 13);
      ctx.lineTo(x - side * 5, y + 13);
      ctx.closePath();
      ctx.fill();
      const txt = String(n), tw = ctx.measureText(txt).width + 10;
      const tx = side < 0 ? x - 6 : x + 6 - tw;
      ctx.fillStyle = 'rgba(30,18,18,.75)';
      roundRect(ctx, tx, y + 14, tw, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#fff4dc';
      ctx.textAlign = 'center';
      ctx.fillText(txt, tx + tw / 2, y + 23);
    }
    ctx.restore();
  }

  /** A number formatted for the view. */
  static n(v: number): string { return fmtNum(v); }
}

/** A road's polyline made round (Chaikin's corner cutting, twice). */
function smoothRoad(pts: readonly (readonly [number, number])[]): [number, number][] {
  let out: [number, number][] = pts.map(([x, y]) => [x, y]);
  for (let k = 0; k < 2; k++) {
    const next: [number, number][] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, ay] = out[i], [bx, by] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** The x of a road at a height (for keeping scenery off it). */
function routeAtY(id: (typeof ROUTE_IDS)[number], y: number): number {
  const pts = ROUTES[id].pts;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if ((y >= ay && y <= by) || (y >= by && y <= ay)) {
      const k = by !== ay ? (y - ay) / (by - ay) : 0;
      return ax + (bx - ax) * k;
    }
  }
  return pts[pts.length - 1][0];
}

