/**
 * Anioł Stróż's play view, all on the canvas: the child's room at night in cross-section — or the
 * dream it has become (the attic, the forest, the sea, the clouds) — the window whose sky holds the
 * band's curve and whose sill holds its stars, the aura around the bed (its radius is the level; a
 * dotted ring marks the threshold, the rim turns gold beyond it), the reach marks on the floor with
 * the gold band of the perfect window, the bed with the sleeping child and the dream bubble (Sen,
 * the lullaby's stars, the calm gauge), Pan Guzik the teddy bear at its foot, the Zmory and their
 * ink drops, the dream's great nightmare with its tells and its light bar, the angel with the
 * Płomień's ring and Skrzydła ognia, the strikes' sweeps of light, hit-stop, sparks, motes and
 * feathers, and the words over it all (hud.ts).  It only reads the sim (sim.ts); the calibration
 * scene is intro.ts.  The runner draws the standard HUD on top (the panel, the score, the coach).
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import type { Insets } from '../kit/types';
import { bossName, giftById, type RoomItem } from './content';
import { Hud } from './hud';
import { feathers as feathersText, t } from './i18n';
import { AniolIntro } from './intro';
import { layout, type Layout, type Pad } from './layout';
import { roomItems, type AniolProgress } from './meta';
import {
  C, SANS, font, glow, paintAngel, paintBear, paintBed, paintBoss, paintDream, paintDrop, paintFeather, paintLamp, paintRoom, paintRoomItem,
  paintStar, paintZmora, type AngelPose, type BearPose, type BossPose, type ZPose,
} from './paint';
import { RULES, auraFor, type AniolSim, type CoachAt, type SimEvent, type Side } from './sim';

const TAU = Math.PI * 2;

const TXT = {
  whiff: t('fx.whiff'), bounce: t('fx.bounce'), crack: t('fx.crack'), flame: t('fx.flame'), flameSub: t('fx.flameSub'),
  stir: t('fx.stir'), comfort: t('fx.comfort'), shield: t('fx.shield'), touch: t('fx.touch'), split: t('fx.split'),
  burst: t('fx.burst'), mark: t('mark'), sen: t('hud.sen'), flameLabel: t('hud.flame'), perfect: t('fx.perfect'), close: t('fx.close'),
  deflect: t('fx.deflect'), glory: t('fx.glory'), counter: t('fx.counter'), grab: t('fx.grab'), flip: t('fx.flip'), feint: t('fx.feint'),
  turn: t('kz.turn'),
};

interface Sweep { side: Side; t: number; dur: number; hit: boolean; reach: number; spear: boolean }
interface Ring { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
interface Feather { x: number; y: number; vx: number; vy: number; rot: number; vr: number; t: number; dur: number; size: number }
interface Note { x: number; y: number; t: number; dur: number; dx: number }

export class AniolView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new AniolIntro();
  private clock = 0;
  private started = false;
  private readonly parts = new Particles(700);
  private readonly sweeps: Sweep[] = [];
  private readonly rings: Ring[] = [];
  private readonly feathers: Feather[] = [];
  private readonly notes: Note[] = [];
  private readonly shake: Shake;
  private readonly rnd = Math.random;
  private items: RoomItem[] = [];
  private chapter = 0;
  // the angel's animation
  private face = 1;
  private swing = 0;
  private comfort = 0;
  private sing = 0;
  private flash = 0;
  private flashColor = 'rgba(255,244,214,';
  private senShown = 1;
  private senPulse = 0;
  private starPop = 0;
  private dawn = 0;
  private night = 0;
  private fade = 0;
  private gloryA = 0;
  private bossBar = 0;
  private bossShown = 1;
  private bearHide = 0;
  private bearTalk = 0;
  /** the Szept's body shows in light: how much, per Zmora */
  private readonly reveal = new Map<number, number>();
  private readonly sideLit = { [-1]: 0, [1]: 0 } as Record<Side, number>;
  private head = { headX: 0, headY: 0 };

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx, opts.eeg, opts.touch);
    this.hud.resize(this.L);
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, insets: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, insets);
    this.hud.resize(this.L);
  }

  /** A finger down on a pad's column (index.ts): the pad shows pressed until it lifts. */
  press(pad: Pad, id: number): void { this.hud.press(pad, id); }
  /** A finger lifts (null: all of them, the pause). */
  release(id: number | null): void { this.hud.release(id); }
  /** A key pressed the pad's strike. */
  flashPad(pad: Pad): void { this.hud.flash(pad); }
  pressGift(i: number): void { this.hud.pressGift(i); }

  start(sim: AniolSim): void {
    this.started = true;
    this.fade = 1;
    this.items = roomItems(sim.rank);
    this.chapter = sim.chapterIndex;
  }

  intro(dt: number, p: number, progress: AniolProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── the room's points ───────────────────────────────────────────
  private get S(): number { return this.L.S; }
  /** text scale: 1 on a phone, a little more on a tablet or a desktop (hud.ts uses the same) */
  private get tu(): number { return 1 + (this.L.u - 1) * 0.6; }
  /** a point on the line across the room (side, distance from the bed's centre, height) in px */
  xOf(side: number, d: number): number { return this.L.cx + side * d * this.S; }
  yOf(z: number): number { return this.L.floorY - z * this.S; }
  private get angelX(): number { return this.L.cx; }
  private get angelY(): number { return this.L.floorY - this.S * (2.4 - 0.45 * ease.inOutSine(this.comfort)) + Math.sin(this.clock * 1.8) * this.S * 0.05; }
  private get bubble(): { x: number; y: number; r: number } {
    const S = this.S;
    return { x: this.L.cx - 1.62 * S, y: this.L.floorY - 1.78 * S, r: 0.42 * S };
  }
  private get bearAt(): { x: number; y: number; r: number } {
    const S = this.S;
    return { x: this.L.cx + 0.68 * S, y: this.L.floorY - 0.86 * S, r: 0.27 * S };
  }

  /** Where a coach mark points (CSS px), kept on the screen; null centres it over the play. */
  anchor(at: CoachAt, sim: AniolSim): { x: number; y: number } | null {
    if (!at) return null;
    const S = this.S, L = this.L;
    const half = Math.min(150, (L.roomX1 - L.roomX0) / 2);
    // the middle pad and the gift sheet: the mark sits over them (a pad is under the floor line)
    if ('ui' in at && (at.ui === 'mid' || at.ui === 'sheet')) {
      const x = at.ui === 'mid' ? L.pads.mid.x + L.pads.mid.w / 2 : (L.roomX0 + L.roomX1) / 2;
      return { x: clamp(x, L.roomX0 + half, L.roomX1 - half), y: at.ui === 'mid' ? L.pads.mid.y - 4 : Math.max(L.top + 40, L.sheetTitle - 4) };
    }
    let p: { x: number; y: number } | null = null;
    if ('z' in at) {
      const z = sim.zmory.find(x => x.id === at.z);
      if (z) p = { x: this.xOf(z.side, z.d), y: this.yOf(z.z) - S * 0.9 };
    } else if (at.ui === 'aura') p = { x: this.xOf(1, sim.auraR * 0.72), y: L.floorY - sim.auraR * 0.72 * 0.78 * S };
    else if (at.ui === 'flame') p = { x: this.angelX + S * 0.9, y: this.angelY - S * 1.1 };
    else if (at.ui === 'bubble') p = { x: this.bubble.x, y: this.bubble.y - this.bubble.r };
    else if (at.ui === 'combo') p = { x: L.combo.x + 20 * L.u, y: L.combo.y + 8 * L.u };
    else p = { x: this.xOf(at.ui === 'reachL' ? -1 : 1, sim.reach), y: L.floorY - S * 0.35 };
    if (!p) return null;
    return { x: clamp(p.x, L.roomX0 + half, L.roomX1 - half), y: clamp(p.y, L.roomTop + 30, L.floorY - 10) };
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: AniolSim): void {
    const u = this.L.u, rm = this.opts.reducedMotion, S = this.S;
    switch (e.type) {
      case 'story':
        this.hud.showStory(e.kind, e.chapter, e.night);
        break;
      case 'strike':
        this.face = e.side;
        this.swing = 1;
        this.sideLit[e.side] = 1;
        this.sweeps.push({ side: e.side, t: 0, dur: e.hit ? 0.26 : 0.2, hit: e.hit, reach: sim.glory > 0 ? 4.4 : sim.reach + (e.spear ? RULES.spearReach : 0), spear: e.spear });
        if (this.sweeps.length > 6) this.sweeps.shift();
        break;
      case 'hit': {
        const x = this.xOf(e.side, e.d), y = this.yOf(e.z + 0.45);
        this.parts.burst(x, y, rm ? 6 : e.perfect ? 26 : 16, { color: e.perfect ? '#ffe08a' : '#fff4d6', size: 2.4 * u, speed: (e.perfect ? 340 : 260) * u, g: 300, drag: 3, life: 0.35, shape: 'spark', angle: e.side > 0 ? 0 : Math.PI, spread: 2.2, rnd: this.rnd });
        this.parts.burst(x, y, rm ? 2 : 6, { color: C.gold, size: 2 * u, speed: 120 * u, g: 0, drag: 4, life: 0.4, rnd: this.rnd });
        this.rings.push({ x, y, t: 0, dur: 0.22, r0: 6 * u, r1: (e.perfect ? 50 : 34) * u, color: e.perfect ? 'rgba(255,214,120,' : 'rgba(255,244,214,', width: e.perfect ? 4 : 3 });
        if (e.perfect) this.hud.float(TXT.perfect, x, y - 40 * u, '#ffd36b', 16, 0.8, 26);
        this.shake.add(e.kind === 'koszmar' ? 0.22 : 0.12);
        this.hud.popCombo();
        break;
      }
      case 'bounce': {
        const x = this.xOf(e.side, e.d), y = this.yOf(0.5);
        this.parts.burst(x, y, rm ? 4 : 12, { color: '#cfcde6', size: 2 * u, speed: 220 * u, g: 500, drag: 2, life: 0.4, shape: 'spark', rnd: this.rnd });
        this.hud.float(TXT.bounce, x, y - 30 * u, '#cfcde6', 14, 0.8, 22);
        this.shake.add(0.16);
        break;
      }
      case 'crack': {
        const x = this.xOf(e.side, e.d), y = this.yOf(0.5);
        this.parts.burst(x, y, rm ? 5 : 16, { color: '#7d7aa0', size: 3 * u, speed: 200 * u, g: 600, drag: 1.5, life: 0.7, shape: 'square', rnd: this.rnd });
        this.hud.float(TXT.crack, x, y - 34 * u, C.goldLight, 16, 1, 26);
        this.rings.push({ x, y, t: 0, dur: 0.4, r0: 8 * u, r1: 50 * u, color: 'rgba(255,226,150,', width: 3 });
        break;
      }
      case 'banish': {
        const x = this.xOf(e.side, e.d), y = this.yOf(e.z + 0.45);
        const big = e.kind === 'koszmar';
        // the ink bursts into motes of light that rise
        this.parts.burst(x, y, rm ? 8 : big ? 80 : 26, { color: '#fff7dc', size: (big ? 3.5 : 2.6) * u, speed: (big ? 280 : 150) * u, g: -90, drag: 2.2, life: big ? 1.8 : 1, rnd: this.rnd });
        this.parts.burst(x, y, rm ? 4 : big ? 46 : 12, { color: C.gold, size: 2.2 * u, speed: (big ? 340 : 200) * u, g: -40, drag: 2.5, life: 0.8, shape: 'spark', rnd: this.rnd });
        this.parts.burst(x, y, rm ? 2 : 6, { color: '#3a3260', size: 4 * u, speed: 60 * u, g: -30, drag: 3, life: 0.5, rnd: this.rnd });
        this.rings.push({ x, y, t: 0, dur: big ? 0.9 : 0.4, r0: 10 * u, r1: (big ? 180 : 60) * u, color: 'rgba(255,240,190,', width: big ? 6 : 3 });
        const nf = Math.min(5, Math.max(1, Math.round(e.feathers / 2)));
        for (let i = 0; i < (rm ? 1 : nf); i++) this.feather(x, y);
        if (e.via !== 'flame' && e.via !== 'dawn') this.hud.float(`+${e.feathers}`, x, y - 26 * u, C.goldLight, 13, 0.8, 30);
        this.shake.add(big ? 0.6 : 0.16);
        if (big) this.flashOn(0.9);
        this.reveal.delete(e.id);
        break;
      }
      case 'split':
        this.hud.float(TXT.split, this.xOf(e.side, e.d), this.yOf(1.1), '#ffd9b0', 14, 0.9, 24);
        break;
      case 'flip':
        this.hud.float(TXT.flip, this.xOf(e.side, 1.4), this.yOf(1.9), '#ffd9b0', 14, 0.7, 20);
        break;
      case 'grab': {
        const x = this.xOf(e.side, RULES.bedHalf + 0.3);
        this.hud.float(TXT.grab, x, this.yOf(1.4), '#e0c8ff', 14, 1.1, 22);
        this.senPulse = 1;
        break;
      }
      case 'spit': {
        const x = this.xOf(e.side, e.d), y = this.yOf(0.6);
        this.parts.burst(x, y, rm ? 2 : 6, { color: '#2a2f66', size: 3 * u, speed: 80 * u, g: 200, drag: 2, life: 0.4, rnd: this.rnd });
        break;
      }
      case 'deflect': {
        const x = this.xOf(e.side, e.d), y = this.yOf(0.6);
        this.parts.burst(x, y, rm ? 6 : 18, { color: '#ffe08a', size: 2.4 * u, speed: 280 * u, g: 0, drag: 3, life: 0.35, shape: 'spark', angle: e.side > 0 ? 0 : Math.PI, spread: 1.2, rnd: this.rnd });
        this.rings.push({ x, y, t: 0, dur: 0.3, r0: 4 * u, r1: 40 * u, color: 'rgba(255,214,120,', width: 3 });
        this.hud.float(TXT.deflect, x, y - 30 * u, '#ffd36b', 15, 0.8, 24);
        this.hud.popCombo();
        this.shake.add(0.12);
        break;
      }
      case 'splash': {
        const b = this.bubble;
        this.senPulse = 1;
        this.parts.burst(this.xOf(e.side, RULES.bedHalf), this.yOf(0.5), rm ? 3 : 12, { color: '#101433', size: 3 * u, speed: 120 * u, g: 300, drag: 2, life: 0.6, rnd: this.rnd });
        this.rings.push({ x: b.x, y: b.y, t: 0, dur: 0.5, r0: b.r, r1: b.r * 1.6, color: 'rgba(120,110,170,', width: 3 });
        break;
      }
      case 'close':
        this.hud.float(TXT.close, this.xOf(e.side, e.d), this.yOf(1.5), '#ffb48a', 15, 0.9, 26);
        break;
      case 'whiff':
        // low, where the sweep met the empty floor (higher it would cover the dream bubble's "Sen" on a phone)
        this.hud.float(TXT.whiff, this.xOf(e.side, sim.reach * 0.75), this.yOf(0.3), 'rgba(220,214,240,.9)', 13, 0.6, 12);
        this.hud.whiff(e.side);
        break;
      case 'harp': {
        const x = this.angelX + e.side * S * 0.6, y = this.angelY - S * 0.3;
        this.notes.push({ x, y, t: 0, dur: 1.6, dx: e.side * 14 * u });
        this.parts.burst(x, y, rm ? 2 : 6, { color: C.goldLight, size: 1.8 * u, speed: 50 * u, g: -40, drag: 2, life: 0.8, rnd: this.rnd });
        break;
      }
      case 'combo':
        this.hud.float(t('fx.combo', { n: e.mult }), Math.min(this.L.cx + S * 1.9, this.w - 80 * u), this.L.floorY - S * 2.2, e.mult >= 4 ? '#ff9a6b' : e.mult >= 3 ? '#ffb070' : C.goldLight, 22, 1.2, 34);
        this.rings.push({ x: this.angelX, y: this.angelY, t: 0, dur: 0.5, r0: S * 0.5, r1: S * 1.8, color: 'rgba(255,214,120,', width: 4 });
        break;
      case 'touch': {
        const b = this.bubble;
        this.senPulse = 1;
        this.rings.push({ x: b.x, y: b.y, t: 0, dur: 0.5, r0: b.r, r1: b.r * 1.8, color: 'rgba(120,110,170,', width: 3 });
        this.hud.float(TXT.touch, b.x, b.y - b.r - 10 * u, '#c9c3ea', 12, 1, 18);
        this.parts.burst(this.xOf(e.side, RULES.bedHalf + 0.2), this.yOf(0.4), rm ? 3 : 10, { color: '#3a3260', size: 3 * u, speed: 80 * u, g: -20, drag: 2, life: 0.7, rnd: this.rnd });
        this.bearHide = 1;
        break;
      }
      case 'shield': {
        const x = this.xOf(e.side, RULES.bedHalf + 0.25), y = this.yOf(0.6);
        this.rings.push({ x, y, t: 0, dur: 0.45, r0: 10 * u, r1: 70 * u, color: 'rgba(255,250,235,', width: 4 });
        this.hud.float(TXT.shield, x, y - 40 * u, '#fffaf0', 15, 0.9, 24);
        for (let i = 0; i < 3; i++) this.feather(x, y);
        break;
      }
      case 'stir':
        this.comfort = 1.6;
        this.hud.toast(TXT.stir, TXT.comfort, C.calmDeep);
        this.rings.push({ x: this.L.cx, y: this.yOf(0.7), t: 0, dur: 0.9, r0: S * 0.4, r1: S * 3.8, color: 'rgba(200,220,255,', width: 4 });
        this.shake.add(0.2);
        break;
      case 'flame':
        this.flashOn(1);
        this.rings.push({ x: this.angelX, y: this.angelY, t: 0, dur: 0.9, r0: S * 0.6, r1: Math.hypot(this.w, this.h), color: 'rgba(255,214,120,', width: 10 });
        this.hud.toast(TXT.flame, TXT.flameSub, C.goldDeep);
        this.shake.add(0.55);
        break;
      case 'glory':
        if (e.on) this.hud.float(TXT.glory, this.angelX, this.angelY - S * 1.6, '#ffb347', 20, 1.4, 30);
        break;
      case 'level':
        this.hud.popLevel();
        this.rings.push({ x: this.angelX, y: this.angelY, t: 0, dur: 0.7, r0: S * 0.5, r1: S * 2.6, color: 'rgba(255,236,170,', width: 5 });
        if (!rm) this.parts.burst(this.angelX, this.angelY, 30, { color: C.goldLight, size: 2.5 * u, speed: 220 * u, g: 0, drag: 2.5, life: 1, shape: 'spark', rnd: this.rnd });
        break;
      case 'gift':
        this.hud.toast(t('card.gift', { name: giftById(e.id).name }), giftById(e.id).text, C.goldDeep);
        break;
      case 'star': {
        const b = this.bubble;
        this.starPop = 1;
        this.parts.burst(b.x, b.y, rm ? 3 : 10, { color: '#fff3c4', size: 2 * u, speed: 70 * u, g: 0, drag: 2.5, life: 0.8, shape: 'spark', rnd: this.rnd });
        this.feather(b.x, b.y - b.r);
        break;
      }
      case 'restPass':
        this.hud.toast(t('card.restPass', { feathers: feathersText(e.feathers) }), t('card.rest.pass'), C.calmDeep);
        break;
      case 'burst':
        this.rings.push({ x: this.L.cx, y: this.yOf(0.6), t: 0, dur: RULES.burstSec, r0: S * 0.5, r1: e.r * S, color: 'rgba(255,220,150,', width: 8 });
        this.flashOn(0.4 + 0.5 * e.share);
        this.hud.float(TXT.burst, this.L.cx, this.yOf(3.2), '#e0d4ff', 17, 1.6, 30);
        this.shake.add(0.3);
        break;
      case 'blockStart':
        if (e.block.kind === 'rest') {
          // the Zmory draw back: a soft wave of calm across the room
          this.rings.push({ x: this.L.cx, y: this.yOf(0.6), t: 0, dur: 1.4, r0: S, r1: S * 7, color: 'rgba(160,190,255,', width: 5 });
        }
        break;
      case 'boss': {
        const name = bossName(e.kind);
        const b = sim.zmory.find(z => z.boss);
        const bx = b ? this.xOf(b.side, b.d) : this.L.cx, by = this.yOf(1.6);
        if (e.what === 'come') this.hud.toast(t('boss.come', { name }), t(`bossSub.${e.kind}`), '#8a4a3a');
        else if (e.what === 'turn') this.hud.float(TXT.turn, this.xOf(e.side, 3), this.yOf(2), '#ffd9b0', 18, 1.2, 26);
        else if (e.what === 'phase') {
          this.hud.toast(t('boss.phase', { name }), '', '#8a4a3a');
          this.flashColor = 'rgba(255,180,120,';
          this.flashOn(0.35);
          this.shake.add(0.35);
        } else if (e.what === 'counter') {
          this.hud.float(TXT.counter, bx, by, '#ffd36b', 22, 1, 30);
          this.shake.add(0.4);
        } else if (e.what === 'wind' && e.feint) this.hud.float(TXT.feint, bx, by - 20 * u, '#ffd9b0', 15, 0.8, 20);
        else if (e.what === 'banished') this.hud.toast(t('boss.banished', { name }), '', C.goldDeep);
        else if (e.what === 'fled') this.hud.toast(t('boss.fled', { name }), '', C.calmDeep);
        if (e.what === 'come' || e.what === 'dash') this.shake.add(0.25);
        break;
      }
      case 'dayGift':
        this.hud.toast(t('card.dayGift', { feathers: feathersText(e.n) }), '', C.goldDeep);
        break;
      case 'rank':
        this.hud.toast(t('card.rank', { name: t(`rank.${e.rank}` as 'rank.0') }), '', C.goldDeep);
        break;
      default:
        break;
    }
    // a card just went up: Pan Guzik and the coach marks wait from the rules' very next step
    sim.busy = this.hud.busy;
  }

  private flashOn(a: number): void {
    if (this.opts.reducedMotion) a *= 0.4;
    this.flash = Math.max(this.flash, a);
  }

  private feather(x: number, y: number): void {
    const u = this.L.u;
    this.feathers.push({ x, y, vx: (this.rnd() - 0.5) * 80 * u, vy: -(60 + this.rnd() * 60) * u, rot: this.rnd() * TAU, vr: (this.rnd() - 0.5) * 4, t: 0, dur: 1.6 + this.rnd() * 0.6, size: (6 + this.rnd() * 3) * u });
    if (this.feathers.length > 40) this.feathers.shift();
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: AniolSim): void {
    this.clock += dt;
    this.parts.update(dt);
    let n = 0;
    for (const s of this.sweeps) if ((s.t += dt) < s.dur) this.sweeps[n++] = s;
    this.sweeps.length = n;
    n = 0;
    for (const r of this.rings) if ((r.t += dt) < r.dur) this.rings[n++] = r;
    this.rings.length = n;
    n = 0;
    for (const f of this.feathers) {
      f.t += dt;
      f.vx *= Math.exp(-1.5 * dt);
      f.vy = f.vy * Math.exp(-1.2 * dt) + 22 * this.L.u * dt;
      f.x += (f.vx + Math.sin(f.t * 4 + f.rot) * 18 * this.L.u) * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.t < f.dur) this.feathers[n++] = f;
    }
    this.feathers.length = n;
    n = 0;
    for (const o of this.notes) if ((o.t += dt) < o.dur) this.notes[n++] = o;
    this.notes.length = n;
    this.swing = approach(this.swing, 0, dt, 0.09);
    this.comfort = Math.max(0, this.comfort - dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.flash <= 0.01) this.flashColor = 'rgba(255,244,214,';
    this.senPulse = Math.max(0, this.senPulse - dt * 1.5);
    this.starPop = Math.max(0, this.starPop - dt * 2);
    this.fade = Math.max(0, this.fade - dt * 1.5);
    this.senShown = approach(this.senShown, sim.sen, dt, 0.25);
    this.sing = approach(this.sing, sim.restBlock ? 1 : 0, dt, 0.5);
    this.dawn = approach(this.dawn, sim.phase === 'done' ? 1 : 0, dt, 1.2);
    this.night = approach(this.night, sim.restBlock ? 1 : sim.blind ? 0.6 : 0, dt, 0.8);
    this.gloryA = approach(this.gloryA, sim.glory > 0 ? 1 : 0, dt, 0.15);
    this.bossBar = approach(this.bossBar, sim.phase === 'finale' && sim.boss ? 1 : 0, dt, 0.25);
    this.sideLit[-1] = Math.max(0, this.sideLit[-1] - dt * 2.5);
    this.sideLit[1] = Math.max(0, this.sideLit[1] - dt * 2.5);
    // the bear hides his eyes while something is right at the bed ("not scared")
    const near = sim.zmory.some(z => z.state === 'walk' && !z.boss && z.d - z.r - RULES.bedHalf < 0.5) || sim.boss?.move === 'open';
    this.bearHide = approach(this.bearHide, near ? 1 : 0, dt, near ? 0.08 : 0.4);
    this.bearTalk = approach(this.bearTalk, sim.said?.who === 'bear' ? 1 : 0, dt, 0.1);
    // the Szept shows in light: the aura, the lamp, a sweep on its side
    for (const z of sim.zmory) {
      if (z.kind !== 'szept') continue;
      const lit = z.inAura || z.d - z.r <= sim.auraR || this.sideLit[z.side] > 0.2 || this.dawn > 0.2;
      this.reveal.set(z.id, approach(this.reveal.get(z.id) ?? 0, lit ? 1 : 0, dt, 0.15));
    }
    // the lullaby's notes rise from the angel
    if (sim.restBlock && this.rnd() < dt * 1.6) {
      this.notes.push({ x: this.angelX + (this.rnd() - 0.5) * this.S, y: this.angelY - this.S * 0.8, t: 0, dur: 2.2, dx: (this.rnd() - 0.5) * 30 * this.L.u });
    }
    // Skrzydła ognia: embers fall from the wings
    if (sim.glory > 0 && !this.opts.reducedMotion && this.rnd() < dt * 30) {
      const sd = this.rnd() < 0.5 ? -1 : 1;
      this.parts.burst(this.angelX + sd * this.S * (0.5 + this.rnd() * 0.6), this.angelY - this.S * 0.3, 1, { color: '#ffb347', size: 2.2 * this.L.u, speed: 40 * this.L.u, g: 60, drag: 1, life: 0.9, shape: 'spark', rnd: this.rnd });
    }
    this.hud.update(dt, sim);
    // Pan Guzik and the coach marks wait while the view's cards are up (the next frame's rules read it)
    sim.busy = this.hud.busy;
  }

  draw(sim: AniolSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L, S = this.S;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    const box = { w: this.w, h: this.h, cx: L.cx, floorY: L.floorY, s: S, win: L.win };
    if (this.chapter === 0) this.paintRoomCached(ctx, box);
    else paintDream(ctx, this.chapter, box, this.clock, this.dawn);
    this.hud.drawWindow(sim, this.dawn, this.chapter === 0 && this.items.includes('curtain'));
    if (this.chapter === 0) this.drawItemsBack();
    const lamp = paintLamp(ctx, L.cx + 1.55 * S, L.floorY, S, 1, this.items.includes('book'));
    // the lamp's warm pool (dimmer in the lullaby, the room bluer)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, lamp.x, lamp.y, S * 3.2, C.lampGlow, 0.32 * (1 - 0.45 * this.night));
    ctx.restore();
    this.drawAura(sim);
    this.drawReach(sim);
    // the Ośmiornica rises out of the sea behind the bed
    const boss = sim.boss ? sim.zmory.find(z => z.id === sim.boss!.id) : undefined;
    if (boss && sim.boss!.kind === 'osmiornica') this.drawBoss(sim, boss);
    this.head = paintBed(ctx, L.cx, L.floorY, S, this.clock, clamp(this.comfort / 0.8) * (this.comfort > 0.8 ? 1 : this.comfort / 0.8), this.items.includes('blanket'));
    this.drawBear(sim);
    this.drawBubble(sim, this.head);
    this.drawZmory(sim);
    this.drawDrops(sim);
    this.drawAngel(sim);
    this.drawSweeps();
    if (sim.hint) this.drawHint(sim);
    // the lullaby's blue and the blind block's fog over the room
    if (this.night > 0.01) {
      ctx.fillStyle = sim.blind ? `rgba(90,80,140,${0.22 * this.night})` : `rgba(30,50,110,${0.18 * this.night})`;
      ctx.fillRect(0, L.roomTop - 10, this.w, this.h);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx);
    ctx.restore();
    for (const f of this.feathers) paintFeather(ctx, f.x, f.y, f.size, f.rot, Math.min(1, (f.dur - f.t) / 0.5));
    this.drawNotes();
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.strokeStyle = `${r.color}${(1 - k) * 0.9})`;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // the light of a Płomień, a dawn burst, a boss banished
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${this.flashColor}${0.55 * this.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    // the dawn: warm light from the window
    if (this.dawn > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, L.win.x + L.win.w / 2, L.win.y + L.win.h, Math.max(this.w, this.h) * 0.8, 'rgba(255,200,140,', 0.3 * this.dawn);
      ctx.restore();
    }
    this.drawBossBar(sim);
    this.hud.draw(sim);
    this.drawSaid(sim);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(18,18,43,${this.fade})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  /**
   * The child's room (the wall and its wallpaper, the floor, the rug, the wardrobe, the door, the dark at the
   * walls) does not move: it is painted once per size into an offscreen canvas and copied each frame — one fill
   * instead of four gradients and a few hundred dots, which a phone feels.  The dawn repaints it in 20 steps.
   */
  private room: { key: string; c: HTMLCanvasElement } | null = null;

  private paintRoomCached(ctx: CanvasRenderingContext2D, box: Parameters<typeof paintRoom>[1]): void {
    const dawn = Math.round(this.dawn * 20) / 20;
    const key = `${this.w}x${this.h}@${this.dpr}|${box.cx}|${box.floorY}|${box.s}|${dawn}`;
    if (!this.room || this.room.key !== key) {
      const c = this.room?.c ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null);
      const g = c?.getContext('2d') ?? null;
      if (!c || !g) {
        paintRoom(ctx, box, this.clock, this.dawn);
        return;
      }
      c.width = Math.max(1, Math.round(this.w * this.dpr));
      c.height = Math.max(1, Math.round(this.h * this.dpr));
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paintRoom(g, box, 0, dawn);
      this.room = { key, c };
    }
    ctx.drawImage(this.room.c, 0, 0, this.w, this.h);
  }

  // ── the room's cosy things ──────────────────────────────────────
  private drawItemsBack(): void {
    const ctx = this.ctx, L = this.L, S = this.S, has = (i: RoomItem) => this.items.includes(i);
    if (has('garland')) paintRoomItem(ctx, 'garland', L.cx, L.roomTop + S * 0.35, Math.min(this.w * 0.42, S * 4), this.clock);
    if (has('nightlight')) paintRoomItem(ctx, 'nightlight', L.cx - 2.9 * S, L.floorY - 1.15 * S, 0.22 * S, this.clock);
    if (has('mobile')) {
      const mx = L.cx + 2.7 * S, my = Math.max(L.roomTop + S * 0.6, L.floorY - 3.1 * S);
      ctx.strokeStyle = 'rgba(217,199,166,.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, L.roomTop - 6);
      ctx.lineTo(mx, my - 0.42 * S);
      ctx.stroke();
      paintRoomItem(ctx, 'mobile', mx, my, 0.42 * S, this.clock);
    }
    // toys on the floor: a ball and two blocks
    ctx.fillStyle = '#c97b84';
    ctx.beginPath();
    ctx.arc(L.cx - 3.5 * S, L.floorY - 0.14 * S, 0.14 * S, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5f8f8b';
    ctx.fillRect(L.cx + 3.3 * S, L.floorY - 0.24 * S, 0.24 * S, 0.24 * S);
    ctx.fillStyle = '#e3b26a';
    ctx.fillRect(L.cx + 3.42 * S, L.floorY - 0.44 * S, 0.2 * S, 0.2 * S);
  }

  // ── the aura: the live gauge, drawn large with its threshold ────
  private drawAura(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const look = sim.auraLook, R = sim.auraR * S;
    const cx = L.cx, cy = L.floorY;
    const ry = 0.78;
    const dome = (r: number) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * ry, 0, Math.PI, TAU);
    };
    if (look === 'blind') return;
    const above = look === 'live' && sim.level >= 0.5;
    // the light inside
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const k = look === 'live' ? 0.24 + 0.3 * clamp(sim.level) : look === 'lamp' ? 0.2 : look === 'candle' ? 0.12 : 0.1;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(4, R));
    const col = look === 'lamp' ? '255,200,120' : look === 'grey' ? '200,200,210' : '255,236,180';
    g.addColorStop(0, `rgba(${col},${k})`);
    g.addColorStop(0.75, `rgba(${col},${k * 0.45})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    if (look === 'candle') return;
    // the threshold: a dotted dome where the level is 0.5 (in a Czuwanie), its label on the dome
    if (look !== 'lamp') {
      const mark = auraFor(0.5, sim.auraWide) * S;
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = 'rgba(255,250,232,.8)';
      ctx.lineWidth = 2;
      dome(mark);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(800, 13 * this.tu, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const lx = cx + Math.cos(-Math.PI / 4) * mark, ly = cy + Math.sin(-Math.PI / 4) * mark * ry;
      // kept on the screen (on a phone the dome reaches past its edge)
      const tx = Math.min(lx + 5 * u, L.roomX1 - 8 - ctx.measureText(TXT.mark).width);
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(20,16,44,.7)';
      ctx.strokeText(TXT.mark, tx, ly - 2 * u);
      ctx.fillStyle = 'rgba(255,250,232,.95)';
      ctx.fillText(TXT.mark, tx, ly - 2 * u);
    }
    // the rim: gold beyond the threshold, pale below it, grey without signal, dashed while waiting
    ctx.strokeStyle = above ? '#ffd36b' : look === 'grey' ? 'rgba(190,190,205,.6)' : look === 'lamp' ? 'rgba(255,200,120,.7)' : 'rgba(255,250,232,.85)';
    if (above) {
      // the glow beyond the threshold: wide translucent strokes under the rim (no blur per frame)
      const rim = ctx.strokeStyle;
      ctx.strokeStyle = 'rgba(255,211,107,.16)';
      ctx.lineWidth = 16;
      dome(R);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,211,107,.28)';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = rim;
    }
    ctx.lineWidth = above ? 4.5 : 2.4;
    if (look === 'wait') ctx.setLineDash([8, 6]);
    dome(R);
    ctx.stroke();
    ctx.setLineDash([]);
    // where the aura meets the floor: two bright feet
    ctx.fillStyle = above ? '#ffd36b' : 'rgba(255,250,232,.8)';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sd * R, cy + 1, 6 * u, 2.6 * u, 0, 0, TAU);
      ctx.fill();
    }
  }

  /** The strike's reach: arrows on the floor at both sides, and the perfect window's gold band just inside them. */
  private drawReach(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const reach = sim.reach, band = sim.perfectBand;
    const g = ctx.createLinearGradient(0, L.floorY - 3 * u, 0, L.floorY + 8 * u);
    g.addColorStop(0, 'rgba(255,244,214,0)');
    g.addColorStop(1, 'rgba(255,244,214,.12)');
    ctx.fillStyle = g;
    ctx.fillRect(L.cx - reach * S, L.floorY - 3 * u, reach * S * 2, 11 * u);
    for (const sd of [-1, 1]) {
      // the perfect band
      const x0 = L.cx + sd * (reach - band) * S, x1 = L.cx + sd * reach * S;
      ctx.fillStyle = `rgba(255,211,107,${0.28 + 0.12 * Math.sin(this.clock * 4)})`;
      ctx.fillRect(Math.min(x0, x1), L.floorY - 2 * u, Math.abs(x1 - x0), 6 * u);
      ctx.strokeStyle = 'rgba(255,244,214,.75)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x1 - sd * 7 * u, L.floorY + 7 * u);
      ctx.lineTo(x1, L.floorY + 1);
      ctx.lineTo(x1 - sd * 7 * u, L.floorY - 5 * u);
      ctx.stroke();
    }
  }

  // ── Pan Guzik ───────────────────────────────────────────────────
  private readonly bearPose: BearPose = { talk: 0, cap: false, look: -1, hide: 0, t: 0 };

  private drawBear(sim: AniolSim): void {
    const b = this.bearAt, p = this.bearPose;
    p.talk = this.bearTalk;
    p.cap = this.items.includes('nightcap');
    p.look = sim.facing;
    p.hide = this.bearHide;
    p.t = this.clock;
    paintBear(this.ctx, b.x, b.y, b.r, p);
  }

  /** The line on screen: the bear's bubble over him, the child's sleep-talk over its head. */
  private drawSaid(sim: AniolSim): void {
    const s = sim.said;
    if (!s || sim.choice) return;
    const k = s.t / s.dur;
    if (s.who === 'bear') {
      const b = this.bearAt;
      this.hud.bubble(s.text, 'bear', b.x + b.r * 0.2, b.y - b.r * 1.1, k);
    } else this.hud.bubble(s.text, 'child', this.head.headX, this.head.headY - this.S * 0.3, k);
  }

  // ── the dream bubble: Sen, the lullaby's stars, the calm gauge ──
  private drawBubble(sim: AniolSim, head: { headX: number; headY: number }): void {
    const ctx = this.ctx, b = this.bubble, u = this.L.u;
    const pulse = 1 + 0.08 * this.senPulse * Math.sin(this.clock * 30) + 0.12 * ease.outBack(this.starPop) * this.starPop;
    const r = b.r * pulse;
    ctx.fillStyle = 'rgba(200,214,255,.55)';
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) / 4;
      ctx.beginPath();
      ctx.arc(head.headX + (b.x - head.headX) * k - 4 * u, head.headY - 6 * u + (b.y + b.r - head.headY) * k, (2 + i * 1.6) * u, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.fillStyle = 'rgba(28,30,72,.85)';
    ctx.fill();
    ctx.clip();
    const lvl = clamp(this.senShown);
    const top = b.y + r - 2 * r * lvl;
    const g = ctx.createLinearGradient(0, top, 0, b.y + r);
    g.addColorStop(0, lvl < 0.3 ? 'rgba(150,140,190,.85)' : 'rgba(186,206,255,.95)');
    g.addColorStop(1, 'rgba(120,140,220,.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - r, top);
    for (let i = 0; i <= 12; i++) {
      const x = b.x - r + (2 * r * i) / 12;
      ctx.lineTo(x, top + Math.sin(this.clock * 2.5 + i * 0.9) * r * 0.05);
    }
    ctx.lineTo(b.x + r, b.y + r);
    ctx.lineTo(b.x - r, b.y + r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.arc(b.x - r * 0.15, b.y + r * 0.2, r * 0.22, 0, TAU);
    ctx.arc(b.x + r * 0.12, b.y + r * 0.15, r * 0.27, 0, TAU);
    ctx.arc(b.x + r * 0.36, b.y + r * 0.24, r * 0.18, 0, TAU);
    ctx.fill();
    const nStars = sim.restBlock ? sim.stars : 0;
    for (let i = 0; i < nStars; i++) {
      const a = i * 2.39996, rr = r * 0.62 * Math.sqrt((i + 0.5) / RULES.starMax);
      paintStar(ctx, b.x + Math.cos(a) * rr, b.y - r * 0.15 + Math.sin(a) * rr * 0.8, r * 0.12, 0.95, C.goldLight);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(220,228,255,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.stroke();
    // the calm gauge (in a lullaby): an arc around the bubble, a tick at the threshold
    if (sim.restBlock) {
      const rr = r + 7 * u;
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.lineWidth = 5 * u;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rr, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      const calm = sim.reliable ? clamp(sim.calm) : 0;
      ctx.strokeStyle = calm >= 0.5 ? C.calm : 'rgba(200,200,230,.6)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * calm);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,232,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + rr - 6 * u);
      ctx.lineTo(b.x, b.y + rr + 6 * u);
      ctx.stroke();
    }
    // Sen in words under the bubble, on a plate: the child's sleep must read at a glance on a phone
    ctx.font = font(800, 13 * this.tu, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = `${TXT.sen} ${Math.round(lvl * 100)}%`;
    const tw = ctx.measureText(label).width, ph = 19 * u;
    const ly = b.y + r + (sim.restBlock ? 14 : 5) * u + ph / 2;
    const lx = clamp(b.x, this.L.roomX0 + tw / 2 + 10, this.L.roomX1 - tw / 2 - 10);
    ctx.fillStyle = lvl < 0.3 ? 'rgba(70,40,110,.82)' : 'rgba(20,18,50,.72)';
    ctx.beginPath();
    ctx.roundRect(lx - tw / 2 - 7 * u, ly - ph / 2, tw + 14 * u, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = lvl < 0.3 ? '#e4d8ff' : '#eef2ff';
    ctx.fillText(label, lx, ly + 0.5);
  }

  // ── the Zmory and their ink ─────────────────────────────────────
  private readonly pose: ZPose = { kind: 'mara', r: 0.3, side: 1, emerge: 1, hit: 0, armoured: false, crack: 0, burn: 0, inAura: false, t: 0, id: 0, fade: 0 };

  private drawZmory(sim: AniolSim): void {
    const ctx = this.ctx, S = this.S, p = this.pose, u = this.L.u;
    const list = sim.zmory.slice().sort((a, b) => b.d - a.d);
    for (const z of list) {
      if (z.boss) {
        if (sim.boss?.kind !== 'osmiornica') this.drawBoss(sim, z);
        continue;
      }
      const x = this.xOf(z.side, z.d), y = this.yOf(z.z);
      if (x < -S * 2 || x > this.w + S * 2) continue;
      p.kind = z.kind;
      p.r = z.r;
      p.side = z.side;
      p.emerge = clamp(z.age / RULES.emerge);
      p.hit = z.hitT;
      p.armoured = z.armoured;
      p.crack = z.armoured ? z.crack : z.kind === 'pancerna' ? 1 : 0;
      p.burn = z.maxHp > 0 ? z.burn / z.maxHp : 0;
      p.inAura = z.inAura;
      p.t = this.clock;
      p.id = z.id;
      p.fade = z.state === 'back' ? clamp((z.d - RULES.edge + 1.2) / 1.6) : 0;
      p.puff = z.kind === 'kleks' && z.wind > 0 ? 1 - z.wind / RULES.spitWind : 0;
      p.reveal = this.reveal.get(z.id) ?? 0;
      const sq = z.hitT > 0 ? 1 + z.hitT * 1.2 : 1;
      ctx.save();
      ctx.translate(x, y);
      if (z.flip > 0) {
        // a somersault over the bed
        const k = 1 - z.flip / RULES.flipSec;
        ctx.translate(0, -z.r * S);
        ctx.rotate(-Math.sign(z.flipTo) * k * TAU);
        ctx.translate(0, z.r * S);
      }
      ctx.scale(1 / Math.sqrt(sq), sq > 1 ? 1 / sq ** 0.3 : 1 + Math.min(0.15, z.z * 0.12));
      paintZmora(ctx, 0, 0, S * 1.2, p);
      ctx.restore();
      // the tells: a Fikołek's ← → pips, a Ciągutek's sticky strands to the bed, light pips for more than one hit
      if (z.state === 'walk' && z.flip <= 0) {
        if (z.kind === 'fikolek' && z.hp > 1) this.arrowPips(x, y - z.r * S * 2.6, z.side);
        if (z.grab) {
          ctx.strokeStyle = 'rgba(80,50,110,.85)';
          ctx.lineWidth = 2.5 * u;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x - z.side * z.r * S * 0.6, y - S * (0.2 + i * 0.12));
            ctx.quadraticCurveTo(x - z.side * z.r * S * 1.2, y - S * (0.05 + i * 0.15) + Math.sin(this.clock * 3 + i) * 3, this.xOf(z.side, RULES.bedHalf - 0.05), y - S * (0.3 + i * 0.1));
            ctx.stroke();
          }
        }
        if (z.maxHp > 1 && z.kind !== 'fikolek') {
          const n = Math.round(z.maxHp), left = Math.ceil(Math.max(0, z.hp) - 1e-6);
          for (let i = 0; i < n; i++) {
            ctx.fillStyle = i < left ? '#ff9a52' : 'rgba(255,255,255,.25)';
            ctx.beginPath();
            ctx.arc(x + (i - (n - 1) / 2) * 8 * u, y - z.r * S * 2.5, 2.6 * u, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
  }

  /** A Fikołek's tell: ← then → (it switches sides after the first hit). */
  private arrowPips(x: number, y: number, side: Side): void {
    const ctx = this.ctx, u = this.L.u;
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,44,.6)';
    ctx.beginPath();
    ctx.roundRect(x - 22 * u, y - 9 * u, 44 * u, 18 * u, 9 * u);
    ctx.fill();
    ctx.font = font(850, 13 * this.tu, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff9a52';
    ctx.fillText(side < 0 ? '←' : '→', x - 9 * u, y);
    ctx.fillStyle = '#7fc8ff';
    ctx.fillText(side < 0 ? '→' : '←', x + 9 * u, y);
    ctx.restore();
  }

  private drawDrops(sim: AniolSim): void {
    const r = Math.max(3, this.S * 0.11);
    for (const o of sim.drops) paintDrop(this.ctx, this.xOf(o.side, o.d), this.yOf(o.z), r, o.dir, o.side, this.clock);
  }

  // ── the dream's great nightmare ─────────────────────────────────
  private readonly bossPose: BossPose = { side: 1, t: 0, hit: 0, wind: 0, phase: 0, burn: 0, id: 0, fade: 0, dash: 0 };

  private drawBoss(sim: AniolSim, z: AniolSim['zmory'][number]): void {
    const b = sim.boss!, ctx = this.ctx, S = this.S, u = this.L.u;
    const fade = z.state === 'back' ? clamp((z.d - RULES.edge + 1.5) / 1.6) : 0;
    if (b.kind === 'koszmar') {
      const p = this.pose;
      Object.assign(p, { kind: 'koszmar', r: z.r, side: z.side, emerge: clamp(z.age / RULES.emerge), hit: z.hitT, armoured: false, crack: 0, burn: 0, inAura: false, t: this.clock, id: z.id, fade, puff: 0, reveal: 1 });
      const sq = z.hitT > 0 ? 1 + z.hitT * 1.2 : 1;
      ctx.save();
      ctx.translate(this.xOf(z.side, z.d), this.yOf(z.z));
      ctx.scale(1 / Math.sqrt(sq), sq > 1 ? 1 / sq ** 0.3 : 1);
      paintZmora(ctx, 0, 0, S * 1.2, p);
      ctx.restore();
      return;
    }
    const bp = this.bossPose;
    bp.side = z.side;
    bp.t = this.clock;
    bp.hit = z.hitT;
    bp.wind = b.move === 'wind' ? clamp(b.t / Math.max(0.1, b.dur)) : 0;
    bp.phase = b.phase;
    bp.id = z.id;
    bp.fade = fade;
    bp.dash = b.move === 'dash' ? 1 : b.move === 'open' ? 0.4 : 0;
    const x = b.kind === 'osmiornica' ? this.L.cx : this.xOf(z.side, z.d), y = b.kind === 'osmiornica' ? this.L.floorY - S * 0.1 : this.yOf(z.z);
    const s = S * (b.kind === 'osmiornica' ? 1.05 : 1.15);
    paintBoss(ctx, b.kind, x, y, s, bp);
    // the tell: a pulsing arrow on its side toward the bed while it winds up; a gold ring when it is open
    if (b.move === 'wind' && b.act !== 'spit') {
      const k = 0.5 + 0.5 * Math.sin(this.clock * 14);
      const ax = this.xOf(z.side, Math.max(1.6, sim.reach - 0.2)), ay = this.L.floorY - S * 1.2;
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * k;
      ctx.fillStyle = b.act === 'feint' ? '#ffd9b0' : '#ff9a52';
      ctx.beginPath();
      ctx.moveTo(ax - z.side * 18 * u, ay);
      ctx.lineTo(ax + z.side * 8 * u, ay - 14 * u);
      ctx.lineTo(ax + z.side * 8 * u, ay + 14 * u);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (b.move === 'open' && !this.opts.reducedMotion) {
      ctx.strokeStyle = `rgba(255,211,107,${0.6 + 0.4 * Math.sin(this.clock * 20)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - S * 0.45, S * 0.8, 0, TAU);
      ctx.stroke();
    }
  }

  /** The boss's light: a bar under the HUD with its name and the second phase's notch. */
  private drawBossBar(sim: AniolSim): void {
    if (this.bossBar < 0.02 || !sim.boss) return;
    const z = sim.zmory.find(x => x.id === sim.boss!.id);
    if (!z) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const { x, y, w, h } = L.boss;
    this.bossShown = approach(this.bossShown, clamp(z.hp / z.maxHp), 1 / 60, 0.15);
    ctx.save();
    ctx.globalAlpha = this.bossBar;
    ctx.font = font(800, 13 * this.tu, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,16,44,.75)';
    const name = bossName(sim.boss.kind);
    ctx.strokeText(name, x + w / 2, y - 3 * u);
    ctx.fillStyle = '#ffd9b0';
    ctx.fillText(name, x + w / 2, y - 3 * u);
    ctx.fillStyle = 'rgba(20,14,40,.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = sim.boss.phase > 0 ? '#ff8f6b' : '#ffb070';
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * this.bossShown), h, h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,232,.9)';
    ctx.fillRect(x + w * RULES.phaseAt - 1, y - 2 * u, 2, h + 4 * u);
    ctx.restore();
  }

  // ── the angel and the Płomień ───────────────────────────────────
  private readonly angelPose: AngelPose = { face: 1, swing: 0, beat: 0, open: 1, comfort: 0, sing: 0 };

  private drawAngel(sim: AniolSim): void {
    const ctx = this.ctx, S = this.S, u = this.L.u, p = this.angelPose;
    const ax = this.angelX + this.face * this.swing * S * 0.12, ay = this.angelY;
    p.face = this.face;
    p.swing = this.swing;
    p.beat = this.clock * (2.4 + 6 * this.swing + 3 * this.gloryA);
    p.open = 0.75 + 0.25 * Math.sin(this.clock * 1.2) ** 2 + 0.2 * this.swing + 0.2 * this.gloryA;
    p.comfort = this.comfort > 0 ? 1 : 0;
    p.sing = this.sing;
    // Skrzydła ognia: a warm glow behind the wings
    if (this.gloryA > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, ax, ay - S * 0.2, S * 1.9, 'rgba(255,170,80,', 0.55 * this.gloryA * (0.8 + 0.2 * Math.sin(this.clock * 9)));
      ctx.restore();
    }
    paintAngel(ctx, ax, ay, S * 1.05, p);
    // the Płomień's ring around the angel: it fills with the hold
    const k = sim.flameCharge;
    if (k > 0.01 || sim.sighted) {
      const r = S * 1.18;
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 4 * u;
      ctx.beginPath();
      ctx.arc(ax, ay - S * 0.25, r, 0, TAU);
      ctx.stroke();
      if (k > 0.01) {
        // its glow: a wide translucent arc under it (no blur per frame)
        ctx.strokeStyle = `rgba(255,190,90,${0.18 + 0.2 * k})`;
        ctx.lineWidth = (10 + 6 * k) * u;
        ctx.beginPath();
        ctx.arc(ax, ay - S * 0.25, r, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
        ctx.strokeStyle = k > 0.85 ? '#ffb347' : '#ffd36b';
        ctx.lineWidth = 4 * u;
        ctx.stroke();
        const hx = ax + Math.cos(-Math.PI / 2 + TAU * k) * r, hy = ay - S * 0.25 + Math.sin(-Math.PI / 2 + TAU * k) * r;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, hx, hy, 12 * u, 'rgba(255,200,110,', 0.9);
        ctx.restore();
      }
      ctx.font = font(800, 13 * this.tu, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(20,16,44,.72)';
      // right of the ring, kept on the screen
      const lw = ctx.measureText(TXT.flameLabel).width;
      const lx = Math.min(ax + Math.cos(0.5) * r + 6 * u, this.L.roomX1 - 8 - lw), ly = ay - S * 0.25 + Math.sin(0.5) * r;
      ctx.strokeText(TXT.flameLabel, lx, ly);
      ctx.fillStyle = k > 0.01 ? '#ffe2a0' : 'rgba(255,250,232,.82)';
      ctx.fillText(TXT.flameLabel, lx, ly);
    }
    // the wing shield, ready: a faint wing over the bed
    if (sim.shieldReady) {
      ctx.strokeStyle = 'rgba(255,250,235,.45)';
      ctx.lineWidth = 2;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(this.L.cx + sd * RULES.bedHalf * S, this.L.floorY - 0.2 * S, 0.5 * S, sd < 0 ? Math.PI * 0.7 : Math.PI * 1.85, sd < 0 ? Math.PI * 1.15 : Math.PI * 2.3);
        ctx.stroke();
      }
    }
  }

  /** The strikes: a crescent of light from the angel's hand down to the floor, out to the reach. */
  private drawSweeps(): void {
    const ctx = this.ctx, S = this.S, L = this.L, u = L.u;
    const ax = this.angelX, ay = this.angelY - S * 0.3;
    for (const s of this.sweeps) {
      const k = s.t / s.dur;
      const reach = Math.min(s.reach, (this.w / 2 - 10) / S);
      const tx = L.cx + s.side * reach * S, ty = L.floorY - 0.3 * S;
      const R = Math.hypot(tx - ax, ty - ay);
      const end = Math.atan2(ty - ay, tx - ax);
      const span = 1.35;
      const startA = end - s.side * span;
      const sweepK = ease.outCubic(clamp(k / 0.4));
      const head = startA + (end - startA) * sweepK;
      const tail = startA + (end - startA) * clamp(sweepK - 0.55 - k * 0.5);
      const fade = 1 - clamp((k - 0.4) / 0.6);
      const thick = (s.hit ? 0.42 : 0.26) * S;
      const n = 18;
      const warm = this.gloryA > 0.3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = tail + ((head - tail) * i) / n;
        ctx.lineTo(ax + Math.cos(a) * R, ay + Math.sin(a) * R);
      }
      for (let i = n; i >= 0; i--) {
        const a = tail + ((head - tail) * i) / n;
        const w = thick * Math.sin((i / n) * Math.PI * 0.5) ** 1.5;
        ctx.lineTo(ax + Math.cos(a) * (R - w), ay + Math.sin(a) * (R - w));
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(ax, ay, Math.max(1, R - thick), ax, ay, R);
      g.addColorStop(0, 'rgba(255,214,140,0)');
      g.addColorStop(1, warm ? `rgba(255,190,110,${0.9 * fade})` : `rgba(255,244,214,${(s.hit ? 0.85 : 0.45) * fade})`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,252,240,${(s.hit ? 0.95 : 0.5) * fade})`;
      ctx.lineWidth = (s.hit ? 2.6 : 1.6) * u;
      ctx.beginPath();
      ctx.arc(ax, ay, R, Math.min(tail, head), Math.max(tail, head));
      ctx.stroke();
      if (sweepK > 0.75) {
        const x0 = L.cx + s.side * RULES.bedHalf * S;
        const g2 = ctx.createLinearGradient(x0, 0, tx, 0);
        g2.addColorStop(0, 'rgba(255,240,200,0)');
        g2.addColorStop(1, `rgba(255,240,200,${(s.hit ? 0.5 : 0.22) * fade})`);
        ctx.fillStyle = g2;
        ctx.fillRect(Math.min(x0, tx), L.floorY - 0.45 * S, Math.abs(tx - x0), 0.4 * S);
        if (s.hit) glow(ctx, tx, L.floorY - 0.3 * S, 0.7 * S, C.light, 0.6 * fade);
      }
      ctx.restore();
    }
  }

  /** The warm-up's ghost hand: a pulsing arrow on the side whose Zmora is nearer, at the reach. */
  private drawHint(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const side = sim.nearerSide();
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 6);
    const x = L.cx + side * (sim.reach + 0.6) * S, y = L.floorY - 1.3 * S - pulse * 8 * u;
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.fillStyle = C.goldLight;
    ctx.beginPath();
    ctx.arc(x, y, 16 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.night;
    ctx.beginPath();
    ctx.moveTo(x + side * 7 * u, y);
    ctx.lineTo(x - side * 4 * u, y - 7 * u);
    ctx.lineTo(x - side * 4 * u, y + 7 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawNotes(): void {
    const ctx = this.ctx, u = this.L.u;
    ctx.fillStyle = C.goldLight;
    ctx.strokeStyle = C.goldLight;
    for (const o of this.notes) {
      const k = o.t / o.dur;
      const x = o.x + o.dx * k + Math.sin(o.t * 3) * 6 * u, y = o.y - 50 * u * k;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.5) * 0.85;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 * u, 3 * u, -0.4, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.4 * u;
      ctx.beginPath();
      ctx.moveTo(x + 3.6 * u, y);
      ctx.lineTo(x + 3.6 * u, y - 12 * u);
      ctx.quadraticCurveTo(x + 8 * u, y - 10 * u, x + 9 * u, y - 6 * u);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
