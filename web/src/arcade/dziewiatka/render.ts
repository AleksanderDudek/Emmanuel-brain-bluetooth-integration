/**
 * Dziewiątka's play view: the street of Zacisze in a side view (the houses' windows keep the band's
 * history), the five on the left and the Din's shadows on the right, ranged hits flying, each
 * ultimate's own picture (Patience's stone ring, Love's ribbon over the five, Joy's notes, Peace's
 * ring of water, Kindness's cups of tea, Goodness's beam along the street, Gentleness's seeds,
 * Faithfulness's silver thread, Self-control's dash), Harmony's chord (five notes rising, the far bell
 * swinging, a wave of quiet sweeping the street), the well in a rest with its water as the calm gauge,
 * Klara with her bubble, and the game's own bits (hud.ts).  Juice: the battle's hit-stop, particles,
 * flying numbers, shakes (none with reduced motion), a flash on every cast.
 */
import { fmtNum } from '../../i18n';
import { Floaters, Particles, Shake, approach, clamp, ease as easing } from '../kit/juice';
import { NO_INSETS } from '../kit/mobile';
import { SignalTrace, traceBars, type TracePhase } from '../kit/trace';
import type { FocusFrame } from '../kit/focus';
import type { Insets } from '../kit/types';
import type { Din, Hero } from './battle';
import { HEROES, RANK_COLOR, heroCry, heroName, rankName, windCry, dinName, pieceName, type HeroId } from './content';
import { Hud, fitLabel } from './hud';
import { t } from './i18n';
import { DziewiatkaIntro } from './intro';
import { layout, toScreen, type Layout } from './layout';
import { growth, type DziewiatkaProgress } from './meta';
import {
  C, INK, SANS, font, freshDinPose, freshHeroPose, freshStreetCache, glow, paintDin, paintHero, paintKlara, paintStreet, paintWell,
  type DinPose, type HeroPose, type StreetLook,
} from './paint';
import { RULES } from './rules';
import type { DziewiatkaSim, SimEvent } from './sim';

const TAU = Math.PI * 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

interface Fx { kind: HeroId | 'harmony' | 'special' | 'form' | 'hush' | 'touch'; t: number; dur: number; x: number; y: number; x2: number; y2: number; color: string; n: number }
interface Banner { text: string; color: string; t: number; dur: number; big: boolean }

export class DziewiatkaView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ins: Insets = { ...NO_INSETS, top: 64 };
  L: Layout = layout(800, 600, this.ins);
  readonly hud: Hud;
  /** the player's primary input is a finger (the words on the boons' sheet) */
  touch = false;
  private readonly street = freshStreetCache();
  private readonly fx = new Particles(560);
  private readonly floaters = new Floaters();
  private readonly shake: Shake;
  private readonly introScene = new DziewiatkaIntro();
  readonly trace = new SignalTrace(44, 0.1);
  private readonly effects: Fx[] = [];
  private readonly hushes: { kind: Din['kind']; x: number; y: number; size: number; t: number; seed: number }[] = [];
  private readonly heroPose = new Map<number, HeroPose>();
  private readonly dinPose = new Map<number, DinPose>();
  private clock = 0;
  private flash = 0;
  private goldFlash = 0;
  private banner: Banner | null = null;
  private restShown = 0;
  private wellShown = 0;
  private bellSwing = 0;
  private bellGold = 0;
  private klaraRing = 0;
  private noise = 0;
  /** where each hero stood last frame (their walk) */
  private readonly lastX = new Map<number, number>();

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
    this.hud = new Hud(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, this.ins);
  }

  /** What covers the canvas's edges (the runner's insets(), read in resize): the HUD band, the home indicator, a notch. */
  setInsets(ins: Insets): void {
    const o = this.ins;
    if (Math.abs(o.top - ins.top) < 0.5 && Math.abs(o.bottom - ins.bottom) < 0.5 && Math.abs(o.left - ins.left) < 0.5 && Math.abs(o.right - ins.right) < 0.5) return;
    this.ins = { ...ins };
    this.L = layout(this.w, this.h, this.ins);
  }

  /** A finger on the street: a ring where it landed (a tap always answers, even when nothing was ready). */
  ripple(x: number, y: number): void {
    this.effects.push({ kind: 'touch', t: 0, dur: 0.4, x, y, x2: 0, y2: 0, color: '#fff6e3', n: 0 });
  }

  /** A street point (u) to the canvas (px). */
  at(x: number, y: number, lift = 0): { x: number; y: number } { return toScreen(this.L, x, y, lift); }

  intro(dt: number, p: number, progress: DziewiatkaProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, progress);
  }

  private say(text: string, color = C.cream, dur = 1.6, big = false): void {
    this.banner = { text, color, t: 0, dur, big };
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: SimEvent, sim: DziewiatkaSim): void {
    const fx = this.fx, L = this.L, s = L.s * L.k;
    switch (e.type) {
      case 'hit': {
        const p = this.at(e.x, e.y, e.onHero ? 0.9 : 0.6);
        if (e.big || e.crit) this.floaters.add(fmtNum(e.dmg), p.x + (Math.random() - 0.5) * 14, p.y - s * 0.3, { color: e.onHero ? '#ffb3a1' : e.crit ? C.goldLight : '#ffffff', size: (e.crit ? 20 : 15) * L.u, dur: 0.7 });
        fx.burst(p.x, p.y, e.big ? 6 : 3, { color: e.onHero ? '#ffd0c4' : '#fff4d6', size: 2, speed: 140, life: 0.25, g: 0, shape: 'spark' });
        break;
      }
      case 'heal': {
        if (e.v < 6) break;
        const p = this.at(e.x, 0.6, 1.4);
        this.floaters.add(`+${fmtNum(e.v)}`, p.x, p.y, { color: '#a7f0a7', size: 14 * L.u, dur: 0.8 });
        break;
      }
      case 'hush': {
        const p = this.at(e.x, e.y, 0.5);
        this.hushes.push({ kind: e.kind, x: e.x, y: e.y, size: e.size, t: 0, seed: Math.random() * 10 });
        fx.burst(p.x, p.y, e.boss ? 60 : 12, { color: '#efeaf6', size: e.boss ? 4 : 2.6, speed: e.boss ? 260 : 120, life: e.boss ? 1.4 : 0.8, g: -50, shape: 'dot', drag: 2 });
        fx.burst(p.x, p.y, e.boss ? 18 : 4, { color: C.goldLight, size: 2.5, speed: 90, life: 0.9, g: -80, shape: 'ring' });
        this.floaters.add(`+${e.worth}`, p.x, p.y - s * 0.6, { color: C.goldLight, size: (e.worth > 1 ? 22 : 16) * L.u, dur: 0.9 });
        if (e.boss) {
          this.shake.add(0.5);
          this.flash = Math.max(this.flash, 0.5);
          this.say(t('hud.boss', { name: cap(dinName(e.kind)) }), C.goldLight, 1.6);
        }
        break;
      }
      case 'form': {
        const p = this.at(e.x, e.y, e.size * 0.4);
        fx.burst(p.x, p.y, 10, { color: 'rgba(110,95,140,1)', size: 2.4, speed: 80, life: 0.5, g: 0, shape: 'spark' });
        break;
      }
      case 'split': {
        const p = this.at(e.x, e.y, 0.6);
        fx.burst(p.x, p.y, 12, { color: '#8a78a8', size: 2.5, speed: 160, life: 0.5, g: 200, shape: 'square' });
        break;
      }
      case 'swell':
        break;
      case 'ult': {
        const h = sim.battle.heroBySlot(e.slot);
        this.hud.fired(e.slot);
        this.flash = Math.max(this.flash, e.chord ? 0.15 : 0.32);
        const p = this.at(e.x, h?.y ?? 0.5, 0.9);
        const col = HEROES[e.kind].color;
        fx.burst(p.x, p.y, 18, { color: col, size: 3, speed: 200, life: 0.6, g: 40, shape: 'spark' });
        if (!e.chord) this.floaters.add(heroCry(e.kind), p.x, p.y - s * 1.0, { color: '#ffffff', size: 17 * L.u, dur: 1.0 });
        this.ultFx(e.kind, e.x, h?.y ?? 0.5, sim);
        break;
      }
      case 'wallAnswer': {
        const p = this.at(e.x, 0.5, 0.5);
        this.effects.push({ kind: 'cierpliwosc', t: 0, dur: 0.6, x: p.x, y: p.y, x2: p.x + s * 4.5, y2: p.y, color: '#b6e08a', n: 2 });
        this.shake.add(0.25);
        break;
      }
      case 'revive': {
        const h = sim.battle.heroBySlot(e.slot);
        const p = this.at(e.x, h?.y ?? 0.5, 0.8);
        fx.burst(p.x, p.y, 24, { color: '#fff1c4', size: 3, speed: 150, life: 0.9, g: -60, shape: 'spark' });
        this.floaters.add(t('hud.revive'), p.x, p.y - s * 0.9, { color: C.goldLight, size: 15 * L.u, dur: 1.1 });
        break;
      }
      case 'fall': {
        const p = this.at(e.x, 0.5, 0.6);
        fx.burst(p.x, p.y, 10, { color: '#8a78a8', size: 2.5, speed: 90, life: 0.7, g: -30, shape: 'spark' });
        this.shake.add(0.2);
        break;
      }
      case 'wind': {
        const p = this.at(e.x, e.y, e.boss ? 2.6 : 1.4);
        this.floaters.add(windCry(e.kind), p.x, p.y, { color: '#ffb3a1', size: (e.boss ? 22 : 16) * L.u, dur: 1.4 });
        break;
      }
      case 'special': {
        const p = this.at(e.x, 0.5, 1);
        this.effects.push({ kind: 'special', t: 0, dur: 0.7, x: p.x, y: p.y, x2: 0, y2: 0, color: '#c55a7a', n: 0 });
        this.shake.add(e.special === 'whisper' ? 0.05 : 0.45);
        break;
      }
      case 'interrupt': {
        const p = this.at(e.x, 0.5, e.boss ? 2.4 : 1.4);
        this.floaters.add(t('hud.interrupt'), p.x, p.y, { color: C.goldLight, size: (e.boss ? 24 : 18) * L.u, dur: 1.2 });
        fx.burst(p.x, p.y, 20, { color: C.goldLight, size: 3, speed: 200, life: 0.6, g: 0, shape: 'spark' });
        break;
      }
      case 'steal': {
        const h = sim.battle.heroBySlot(e.slot);
        const p = this.at(e.x, h?.y ?? 0.5, 0.9);
        fx.burst(p.x, p.y, 5, { color: C.energy, size: 2, speed: 80, life: 0.5, g: -40, shape: 'dot' });
        break;
      }
      case 'yawn': {
        const p = this.at(e.x, e.y, 1);
        this.floaters.add('aaah…', p.x, p.y, { color: '#d9d2ea', size: 14 * L.u, dur: 1.1 });
        break;
      }
      case 'copy': {
        const p = this.at(e.x, e.y, 1.2);
        this.floaters.add(t('hud.copied'), p.x, p.y, { color: '#a5e8a5', size: 14 * L.u, dur: 1 });
        break;
      }
      case 'whisper': {
        const h = sim.battle.heroBySlot(e.slot);
        const p = this.at(e.x, h?.y ?? 0.5, 1.6);
        this.floaters.add(t('hud.silenced'), p.x, p.y, { color: '#d9d2ea', size: 14 * L.u, dur: 1.1 });
        break;
      }
      case 'mirrorBreak': {
        const p = this.at(e.x, e.y, 0.6);
        fx.burst(p.x, p.y, 22, { color: '#e3e9ff', size: 3, speed: 220, life: 0.6, g: 260, shape: 'square' });
        break;
      }
      case 'parry': case 'miss': {
        const p = this.at(e.x, 0.5, 1.2);
        this.floaters.add(t(e.type === 'parry' ? 'hud.parry' : 'hud.miss'), p.x, p.y, { color: '#e7e2f2', size: 13 * L.u, dur: 0.7 });
        break;
      }
      case 'chord':
        this.goldFlash = 1;
        this.bellSwing = 1;
        this.hud.rang();
        this.klaraRing = 1.5;
        this.shake.add(0.6);
        this.say(t('hud.harmony'), C.goldLight, 2.2, true);
        this.chordFx(sim);
        break;
      case 'harmonyReady':
        this.bellGold = 1;
        break;
      case 'surge':
        this.say(t('hud.surge'), '#ffd0c4', 1.6);
        break;
      case 'wave':
        if (e.n > 1) this.say(t('hud.wave', { n: e.n, all: e.all }), C.cream, 1.2);
        break;
      case 'won':
        this.say(e.floor > 0 ? t('hud.floorWon', { n: e.floor }) : `${t('hud.won')} ${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}`, C.goldLight, 2, true);
        this.klaraRing = 1.2;
        for (let i = 0; i < 3; i++) fx.burst(L.w * (0.3 + i * 0.2), L.top + (L.fieldBottom - L.top) * 0.35, 14, { color: i < e.stars ? C.gold : '#ddd', size: 3.5, speed: 200, life: 1.1, g: 160, shape: 'square' });
        break;
      case 'equip': {
        const r = e.slot >= 0 ? this.L.slots[e.slot] : null;
        if (r) {
          fx.burst(r.x + r.w / 2, r.y + r.h * 0.3, e.rankUp ? 40 : 10, { color: e.rankUp ? (RANK_COLOR[e.rank] ?? C.gold) : C.goldLight, size: e.rankUp ? 3.5 : 2.5, speed: e.rankUp ? 240 : 110, life: 0.8, g: 120, shape: e.rankUp ? 'square' : 'spark' });
          if (e.kind >= 0) this.floaters.add(`+${pieceName(e.kind)}`, r.x + r.w / 2, r.y + r.h * 0.3, { color: C.cream, size: 15 * L.u, dur: 0.9 });
        }
        if (e.rankUp) {
          const h = sim.battle.heroBySlot(e.slot);
          if (h) this.say(t('hud.rankUp', { name: heroName(h.kind), rank: rankName(e.rank) }), RANK_COLOR[e.rank] ?? C.goldLight, 2, true);
        }
        break;
      }
      case 'piece': {
        const p = this.at(e.x, e.y, 0.5);
        fx.burst(p.x, p.y, 8, { color: C.goldLight, size: 2.5, speed: 120, life: 0.7, g: 120, shape: 'square' });
        break;
      }
      case 'level': {
        const r = this.L.slots[e.slot];
        if (r) this.floaters.add(`${t('panel.lv', { n: e.lv })}!`, r.x + r.w / 2, r.y + r.h * 0.3, { color: '#a7f0a7', size: 15 * L.u, dur: 1.0 });
        break;
      }
      case 'star':
        this.say(t('hud.star', { name: heroName(e.hero), n: e.stars }), C.goldLight, 1.8);
        break;
      case 'chest':
        this.say(t('hud.chest', { what: `+${e.pieces}` }), C.goldLight, 1.6);
        break;
      case 'nope':
        this.hud.nope(e.slot);
        break;
      case 'wipe':
        this.shake.add(0.5);
        this.klaraRing = 2;
        break;
      case 'standUp':
        this.say(t('hud.standUp'), C.goldLight, 1.4);
        break;
      case 'mission':
        if (sim.mission.spec.boss) this.say(t('card.boss', { name: cap(dinName(sim.mission.spec.boss)) }), '#ffd0c4', 2, true);
        break;
      default:
        break;
    }
  }

  /** each ultimate's own picture */
  private ultFx(kind: HeroId, x: number, y: number, sim: DziewiatkaSim): void {
    const L = this.L, s = L.s * L.k, p = this.at(x, y, 0.8);
    const col = HEROES[kind].color;
    const push = (o: Partial<Fx>) => this.effects.push({ kind, t: 0, dur: 0.8, x: p.x, y: p.y, x2: p.x, y2: p.y, color: col, n: 0, ...o });
    switch (kind) {
      case 'dobroc': push({ dur: 0.55, x2: L.w + 20, y2: p.y }); this.shake.add(0.2); break;
      case 'lagodnosc':
        for (let i = 0; i < 40; i++) this.fx.burst(p.x + s * 0.3, p.y - s * 0.3, 1, { color: '#ffffff', size: 2.2, speed: 150 + Math.random() * 120, angle: -0.15, spread: 0.7, life: 1.6, g: -8, drag: 0.6, shape: 'dot' });
        break;
      case 'radosc':
        for (const h of sim.battle.standing) {
          const q = this.at(h.x, h.y, 1.2);
          push({ dur: 0.8, x2: q.x, y2: q.y, n: h.slot });
        }
        break;
      case 'milosc': push({ dur: 1.0, n: 5 }); break;
      case 'pokoj': push({ dur: 0.9 }); break;
      case 'cierpliwosc': push({ dur: 0.7 }); break;
      case 'uprzejmosc':
        for (const d of sim.battle.din.filter(dd => dd.tea > 0).slice(0, 3)) {
          const q = this.at(d.x, d.y, 1);
          push({ dur: 0.6, x2: q.x, y2: q.y });
        }
        break;
      case 'wiernosc': push({ dur: 0.7 }); break;
      case 'opanowanie': {
        const h = sim.battle.heroes.find(hh => hh.kind === 'opanowanie');
        const q = h ? this.at(h.dashTo, 0.5, 0.8) : p;
        push({ dur: 0.35, x2: q.x, y2: q.y });
        this.shake.add(0.3);
        break;
      }
    }
  }

  private chordFx(sim: DziewiatkaSim): void {
    const L = this.L;
    for (const h of sim.battle.heroes) {
      const p = this.at(h.x, h.y, 1.1);
      this.effects.push({ kind: 'harmony', t: 0, dur: 1.6, x: p.x, y: p.y, x2: L.w / 2, y2: L.top + 30, color: HEROES[h.kind].color, n: h.slot });
    }
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: DziewiatkaSim, f: FocusFrame, t: number): void {
    this.clock += dt;
    // the band's history (the houses' windows)
    const phase: TracePhase = sim.phase !== 'play' ? 'free' : sim.block.kind === 'push' ? 'focus' : sim.block.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(t, f, phase, sim.blind);
    this.fx.update(dt);
    this.floaters.update(dt);
    this.hud.update(dt, sim);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.goldFlash = Math.max(0, this.goldFlash - dt * 1.2);
    this.bellSwing = Math.max(0, this.bellSwing - dt * 0.6);
    this.bellGold = approach(this.bellGold, sim.harmonyReady ? 1 : 0, dt, 0.4);
    this.klaraRing = Math.max(0, this.klaraRing - dt);
    this.restShown = approach(this.restShown, sim.atWell ? 1 : 0, dt, 0.6);
    this.wellShown = approach(this.wellShown, sim.atWell ? 1 : 0, dt, 0.35);
    const live = sim.battle.din.filter(d => d.enter <= 0).length;
    this.noise = approach(this.noise, sim.atWell ? 0.15 : Math.min(1, live / 6), dt, 0.8);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) if ((this.effects[i].t += dt) >= this.effects[i].dur) this.effects.splice(i, 1);
    for (let i = this.hushes.length - 1; i >= 0; i--) if ((this.hushes[i].t += dt) >= 0.9) this.hushes.splice(i, 1);
    // poses follow the battle
    for (const h of sim.battle.heroes) {
      let p = this.heroPose.get(h.id);
      if (!p) { p = freshHeroPose(); p.seed = h.slot * 1.7; this.heroPose.set(h.id, p); }
      p.t = this.clock;
      p.act = h.act > 0 ? 1 - h.act / 0.28 : 0;
      p.cast = h.cast > 0 ? Math.min(1, h.cast / 0.4) : 0;
      p.hit = h.hit / 0.18;
      p.down = h.down;
      p.ready = sim.battle.ready(h) && sim.fighting;
      p.silenced = h.silence > 0;
      p.wall = approach(p.wall, h.wall > 0 ? 1 : 0, dt, 0.15);
      const target = sim.atWell ? sim.battle.wellSeat(h) : h.home;
      p.sit = approach(p.sit, sim.atWell && Math.abs(h.x - target) < 0.15 ? 1 : 0, dt, 0.25);
      const lx = this.lastX.get(h.id) ?? h.x;
      p.walk = approach(p.walk, Math.abs(h.x - lx) > 0.002 ? 1 : 0, dt, 0.1);
      this.lastX.set(h.id, h.x);
      p.flip = sim.atWell ? (h.x < RULES.wellX ? 1 : -1) : 1;
      p.rankColor = RANK_COLOR[growth(sim.p, h.kind).rank] ?? null;
    }
    for (const d of sim.battle.din) {
      let p = this.dinPose.get(d.id);
      if (!p) { p = freshDinPose(); p.seed = (d.id % 7) * 1.3; this.dinPose.set(d.id, p); }
      p.t = this.clock;
      p.hit = d.hit;
      p.act = d.act > 0 ? 1 - d.act / 0.3 : 0;
      p.wind = d.windT >= 0 ? clamp(d.windT / d.windDur) : -1;
      p.sleep = d.sleep;
      p.tea = d.tea > 0;
      p.form = d.enter > 0 ? 1 : clamp(d.form / RULES.formSec);
      p.swell = d.swell;
      p.mirror = d.mirrorMax > 0 ? clamp(d.mirror / d.mirrorMax) : 0;
      p.daze = d.daze > 0;
      p.doze = d.doze;
      p.copied = d.copyHaste > 0 || d.copyUp > 0;
      p.phase = d.phase;
    }
    if (this.dinPose.size > 80) {
      const ids = new Set(sim.battle.din.map(d => d.id));
      for (const id of [...this.dinPose.keys()]) if (!ids.has(id)) this.dinPose.delete(id);
    }
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: DziewiatkaSim): void {
    const ctx = this.ctx, L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake.offset(1 / 60, 9);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    const n = Math.max(8, Math.min(16, Math.round(L.w / Math.max(60, L.s * 1.1))));
    const look: StreetLook = {
      chapter: sim.mission.spec.chapter, tower: sim.inTower, bars: traceBars(this.trace, sim.t, n),
      bellSwing: this.bellSwing, bellGold: this.bellGold, rest: this.restShown, noise: this.noise,
      fog: sim.blind ? 1 : 0,
    };
    const S = L.s * L.k;
    paintStreet(ctx, L.w, L.h, L.streetY, L.fieldBottom, S, this.clock, look, L.x0, this.street, this.dpr);
    // the well in a rest
    const wp = this.at(RULES.wellX, 0.2);
    paintWell(ctx, wp.x, wp.y, S, sim.calmShown, this.wellShown, this.clock);
    // everyone by depth (back rows first)
    const items: { y: number; draw: () => void }[] = [];
    for (const h of sim.battle.heroes) {
      const p = this.heroPose.get(h.id);
      if (!p) continue;
      const q = this.at(h.x, h.y);
      items.push({ y: q.y, draw: () => paintHero(ctx, h.kind, q.x, q.y, S, p) });
    }
    for (const d of sim.battle.din) {
      const p = this.dinPose.get(d.id);
      if (!p || d.enter > 0) continue;
      const q = this.at(d.x, d.y);
      items.push({ y: q.y, draw: () => { paintDin(ctx, d.kind, q.x, q.y, S, d.spec.size, p); this.dinBar(ctx, d, q.x, q.y); } });
    }
    for (const hs of this.hushes) {
      const q = this.at(hs.x, hs.y);
      const p = { ...freshDinPose(), t: this.clock, hush: hs.t / 0.9, seed: hs.seed };
      items.push({ y: q.y, draw: () => paintDin(ctx, hs.kind, q.x, q.y, S, hs.size, p) });
    }
    const kx = Math.max(RULES.klaraX, L.x0 + 0.45);
    const kq = this.at(kx, 0.05);
    items.push({ y: kq.y, draw: () => paintKlara(ctx, kq.x, kq.y, S * 0.92, { t: this.clock, ring: Math.min(1, this.klaraRing), talk: !!sim.talk.line, flip: 1 }) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    this.drawShots(sim);
    this.drawEffects(sim);
    // hero bars over their heads (health, a thin energy line)
    for (const h of sim.battle.heroes) if (!h.down && !sim.atWell) this.heroBar(ctx, h);
    this.fx.draw(ctx);
    this.drawFloaters(ctx);
    ctx.restore();
    // flashes
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,248,230,${0.25 * this.flash})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    if (this.goldFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,200,90,${0.32 * this.goldFlash})`;
      ctx.fillRect(0, 0, L.w, L.h);
      // the wave of quiet sweeping the street
      const k = 1 - this.goldFlash;
      const wx = L.w * (k * 1.3 - 0.15);
      const g = ctx.createLinearGradient(wx - 120, 0, wx + 40, 0);
      g.addColorStop(0, 'rgba(255,240,200,0)');
      g.addColorStop(0.8, 'rgba(255,240,200,.55)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(wx - 120, L.top, 160, L.fieldBottom - L.top);
      ctx.restore();
    }
    // the game's own bits
    this.hud.drawPill(ctx, L, sim);
    this.hud.drawStrip(ctx, L, sim, this.clock);
    this.drawBanner();
    const line = sim.talk.line;
    if (line) {
      const a = clamp(line.t / 0.2) * clamp((line.dur - line.t) / 0.3);
      const head = this.at(kx, 0.05, 1.3);
      const boss = sim.battle.boss;
      const minY = L.pill.y + L.pill.h + 6 + (boss && boss.enter <= 0 ? L.bossBar.h + 9 : 0);
      this.hud.drawBubble(ctx, L, line.text, head.x + L.s * L.k * 0.1, head.y, a, minY);
    }
    this.hud.drawWipe(ctx, L, sim);
    this.hud.drawChoice(ctx, L, sim, this.clock, this.touch);
    this.hud.drawStory(ctx, L, sim, this.clock);
  }

  private heroBar(ctx: CanvasRenderingContext2D, h: Hero): void {
    const L = this.L, q = this.at(h.x, h.y, 1.72 * (h.kind === 'radosc' ? 0.9 : 1));
    const w = L.s * L.k * 0.72, bh = Math.max(3, L.s * L.k * 0.06);
    ctx.fillStyle = 'rgba(43,34,56,.45)';
    ctx.fillRect(q.x - w / 2, q.y, w, bh);
    const k = clamp(h.hp / h.max);
    ctx.fillStyle = k < 0.3 ? C.hpLow : C.hp;
    ctx.fillRect(q.x - w / 2, q.y, w * k, bh);
    if (h.shield > 0) {
      ctx.fillStyle = 'rgba(220,235,255,.85)';
      ctx.fillRect(q.x - w / 2, q.y - 2, w * clamp(h.shield / h.max), 2);
    }
    ctx.fillStyle = C.energy;
    ctx.fillRect(q.x - w / 2, q.y + bh + 1, w * clamp(h.energy / RULES.energyMax), Math.max(2, bh * 0.6));
  }

  private dinBar(ctx: CanvasRenderingContext2D, d: Din, x: number, y: number): void {
    if (d.windT >= 0 && d.form <= 0) this.windMark(ctx, d, x, y);
    if (d.spec.boss || d.hp >= d.max - 0.5 || d.form > 0) return;
    const L = this.L, w = L.s * L.k * 0.6, top = y - d.spec.size * L.s * L.k * (d.spec.fly ? 1.55 : 1.15);
    ctx.fillStyle = 'rgba(43,34,56,.5)';
    ctx.fillRect(x - w / 2, top, w, 3);
    ctx.fillStyle = '#c99ad6';
    ctx.fillRect(x - w / 2, top, w * clamp(d.hp / d.max), 3);
    if (d.windT >= 0) {
      ctx.fillStyle = '#ff6b4a';
      ctx.fillRect(x - w / 2, top - 5, w * clamp(d.windT / d.windDur), 3);
    }
  }

  /** A wind-up, unmissable: a red "!" over the shadow with a ring that closes as the special comes — break it now. */
  private windMark(ctx: CanvasRenderingContext2D, d: Din, x: number, y: number): void {
    const L = this.L, S = L.s * L.k;
    const k = clamp(d.windT / d.windDur);
    const r = Math.max(9, S * 0.22) * (1 + 0.08 * Math.sin(this.clock * 14));
    const cy = y - d.spec.size * S * (d.spec.fly ? 1.7 : 1.3) - r;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, cy, r * 2.2, 'rgba(255,90,60,', 0.35);
    ctx.restore();
    ctx.fillStyle = '#ff5a3c';
    ctx.strokeStyle = '#fff7e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffd6c8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k));
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = font(r * 1.4, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, cy + 1);
  }

  private drawShots(sim: DziewiatkaSim): void {
    const ctx = this.ctx, L = this.L, S = L.s * L.k;
    for (const s of sim.battle.shots) {
      const p = this.at(s.x, s.y, 0.75);
      const k = clamp(s.t / s.dur);
      const arc = Math.sin(k * Math.PI) * S * 0.3;
      if (s.hero) {
        const col = HEROES[s.kind as HeroId]?.color ?? '#fff';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, p.x, p.y - arc, S * 0.18, 'rgba(255,240,200,', 0.6);
        ctx.restore();
        ctx.fillStyle = col;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (s.kind === 'radosc') {
          ctx.font = font(S * 0.32, 900);
          ctx.textAlign = 'center';
          ctx.fillText('♪', p.x, p.y - arc);
        } else if (s.kind === 'dobroc') {
          ctx.strokeStyle = '#fff3c4';
          ctx.lineWidth = 2;
          ctx.moveTo(p.x - S * 0.3, p.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          ctx.arc(p.x, p.y - arc, Math.max(2.5, S * 0.07), 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(80,66,104,.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 6, p.y - arc);
        ctx.lineTo(p.x + 2, p.y - arc - 3);
        ctx.lineTo(p.x - 2, p.y - arc + 2);
        ctx.lineTo(p.x - 6, p.y - arc - 2);
        ctx.stroke();
      }
    }
  }

  private drawEffects(sim: DziewiatkaSim): void {
    const ctx = this.ctx, L = this.L, s = L.s * L.k;
    for (const e of this.effects) {
      const k = clamp(e.t / e.dur);
      const a = 1 - k;
      ctx.save();
      switch (e.kind) {
        case 'dobroc': {
          ctx.globalCompositeOperation = 'lighter';
          const th = s * 0.35 * (1 - k * 0.6);
          const g = ctx.createLinearGradient(0, e.y - th, 0, e.y + th);
          g.addColorStop(0, 'rgba(255,230,140,0)');
          g.addColorStop(0.5, `rgba(255,245,200,${0.9 * a})`);
          g.addColorStop(1, 'rgba(255,230,140,0)');
          ctx.fillStyle = g;
          ctx.fillRect(e.x, e.y - th, e.x2 - e.x, th * 2);
          break;
        }
        case 'cierpliwosc': {
          ctx.strokeStyle = `rgba(182,224,138,${a})`;
          ctx.lineWidth = s * 0.12 * a + 1;
          ctx.beginPath();
          ctx.ellipse(e.x, e.y + s * 0.4, s * (0.5 + k * (e.n === 2 ? 4.5 : 2.2)), s * (0.18 + k * 0.6), 0, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'milosc': {
          // the ribbon over the five
          const hs = sim.battle.standing;
          if (hs.length < 2) break;
          ctx.strokeStyle = `rgba(232,86,106,${a})`;
          ctx.lineWidth = s * 0.1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          const pts = hs.map(h => this.at(h.x, h.y, 1.0 + 0.25 * Math.sin(this.clock * 4 + h.slot))).sort((p1, p2) => p1.x - p2.x);
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mx = (pts[i - 1].x + pts[i].x) / 2;
            ctx.quadraticCurveTo(mx, Math.min(pts[i - 1].y, pts[i].y) - s * 0.6 * (1 - k * 0.5), pts[i].x, pts[i].y);
          }
          ctx.stroke();
          break;
        }
        case 'radosc': {
          const x = e.x + (e.x2 - e.x) * k, y = e.y + (e.y2 - e.y) * k - Math.sin(k * Math.PI) * s * 0.9;
          ctx.fillStyle = `rgba(255,214,90,${a + 0.2})`;
          ctx.font = font(s * 0.4, 900);
          ctx.textAlign = 'center';
          ctx.fillText('♪', x, y);
          break;
        }
        case 'pokoj': {
          ctx.strokeStyle = `rgba(143,211,244,${a})`;
          ctx.lineWidth = s * 0.08 * a + 1;
          ctx.beginPath();
          ctx.ellipse(e.x, e.y + s * 0.4, s * (0.5 + k * 5), s * (0.15 + k * 0.6), 0, 0, TAU);
          ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, e.x, e.y, s * (1 + k * 3), 'rgba(160,220,255,', 0.35 * a);
          break;
        }
        case 'uprzejmosc': {
          const x = e.x + (e.x2 - e.x) * k, y = e.y + (e.y2 - e.y) * k - Math.sin(k * Math.PI) * s * 0.8;
          ctx.fillStyle = '#fbf6ec';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(x, y, s * 0.13, s * 0.09, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'wiernosc': {
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, e.x, e.y - s * 0.6, s * (0.8 + k * 1.6), 'rgba(210,225,255,', 0.6 * a);
          break;
        }
        case 'opanowanie': {
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = s * 0.08 * a + 1;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + (e.x2 - e.x) * Math.min(1, k * 2), e.y2);
          ctx.stroke();
          if (k > 0.4) {
            ctx.strokeStyle = `rgba(63,183,168,${a})`;
            ctx.lineWidth = s * 0.06;
            ctx.beginPath();
            ctx.moveTo(e.x2 - s * 0.5, e.y2 - s * 0.5);
            ctx.lineTo(e.x2 + s * 0.5, e.y2 + s * 0.3);
            ctx.stroke();
          }
          break;
        }
        case 'harmony': {
          // five notes rising into a chord
          const x = e.x + (e.x2 - e.x + (e.n - 2) * s * 0.5) * ease(k), y = e.y + (e.y2 - e.y) * ease(k);
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, x, y, s * 0.6, hexRgb(e.color), 0.8 * (1 - k * 0.6));
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = e.color;
          ctx.font = font(s * 0.5, 900);
          ctx.textAlign = 'center';
          ctx.fillText('♪', x, y);
          break;
        }
        case 'touch': {
          // where a finger landed on the street: a ring that opens and fades
          ctx.strokeStyle = `rgba(255,246,227,${0.85 * a})`;
          ctx.lineWidth = 3 * a + 1;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 10 + 26 * easing.outCubic(k), 0, TAU);
          ctx.stroke();
          break;
        }
        case 'special': {
          ctx.strokeStyle = `rgba(197,90,122,${a})`;
          ctx.lineWidth = 3;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(e.x, e.y, s * (0.6 + k * (2 + i)), Math.PI * 0.6, Math.PI * 1.4);
            ctx.stroke();
          }
          break;
        }
        default: break;
      }
      ctx.restore();
    }
  }

  /**
   * The flying numbers and words (kit Floaters' items): a valid bold font (the kit's draw takes a family only),
   * an ink outline for busy art, popping in and rising like the kit's.
   */
  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(43,34,56,.8)';
    for (const f of this.floaters.items) {
      const k = f.t / f.dur;
      const pop = k < 0.18 ? Math.max(0.6, easing.outBack(k / 0.18)) : 1;
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      const px = Math.max(13, f.size) * pop;
      ctx.font = font(px, 800);
      const y = f.y - 46 * easing.outCubic(k);
      ctx.lineWidth = Math.max(2.5, px * 0.16);
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.restore();
  }

  private drawBanner(): void {
    const b = this.banner;
    if (!b) return;
    const ctx = this.ctx, L = this.L;
    const k = b.t / b.dur;
    const a = k < 0.12 ? k / 0.12 : k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
    const pop = k < 0.12 ? 0.8 + 0.2 * (k / 0.12) : 1;
    const px = (b.big ? 28 : 20) * L.u * pop;
    const y = Math.max(L.pill.y + L.pill.h + px * 0.8 + 8, L.top + (L.fieldBottom - L.top) * (b.big ? 0.36 : 0.28));
    ctx.save();
    ctx.globalAlpha = a;
    const text = fitLabel(ctx, b.text, L.w - 2 * L.padL, px, 900, SANS, 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, px * 0.18);
    ctx.strokeStyle = 'rgba(43,34,56,.75)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, L.w / 2, y);
    ctx.fillStyle = b.color;
    ctx.fillText(text, L.w / 2, y);
    ctx.restore();
  }
}

const ease = (k: number): number => 1 - (1 - k) ** 3;
const hexRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},`;
};
