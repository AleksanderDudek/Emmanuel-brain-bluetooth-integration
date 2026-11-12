/**
 * Kocia straż's play view: the place's sky and field (cached per size), the pests and the chief, the
 * squad's shots and splashes, the wall with the cushions, the cats and the gatehouse's eye (the band's
 * gauge, drawn large with its threshold), and the game's own bits around them — the bar (the fish, the
 * stage), the chest, the buttons, Brother Anselm's bubble, toasts, story cards and the vintage's question.
 * The runner draws the Mendi panel, the score and the coach marks; this view keeps its controls and text
 * below the HUD (`insets().top`) and inside the phone's other insets (layout.ts).
 *
 * Mobile first (DESIGN §11.9): what the finger presses reacts on touch-down (a cell sinks, a button goes
 * down, a cat gets a ring), a dragged toy floats above the finger and snaps to the nearest cell or cat
 * (a mate to merge with glows gold), and no text is drawn under 11 px — what the player reads to play is
 * 13 px and more.
 *
 * It reads the sim's state and its events (`on`), and answers the index's hit tests (`hit`, `snapAt`,
 * `pestAt`).
 */
import { fitText, MIN_READ, MIN_TEXT } from '../kit/mobile';
import { approach, clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import type { SignalTrace } from '../kit/trace';
import type { Insets } from '../kit/types';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageLayout } from '../kit/scripture';
import {
  PESTS, big, bossName, catName, f1, famName, fishText, gradeColor, gradeName, goldText, placeName, trickName, type PlaceId, type Toy,
} from './content';
import { t } from './i18n';
import { BUYS, cellRect, confirmButtons, inRect, layout, seat, toPx, wallRow, type Layout, type Rect } from './layout';
import { aimMult, bowlMult, costOf, pawsMult, shopGrade, type BuyId } from './meta';
import {
  BADGE_MIN, CAT_POSE, CREAM, GOLD, INK, SANS, bubble, ell, fitFont, font, glow, label, paintBadge, paintBoss, paintBrother, paintCat,
  paintCushion, paintEye, paintFish, paintGrapes, paintGround, paintPaw, paintPest, paintSky, paintToy, paintToyCell, paintUpIcon, paintWall, rr,
  type CatPose,
} from './paint';
import { RULES } from './rules';
import { cushionX, starText, type CoachAt, type KotySim, type Loc, type SimEvent } from './sim';

export type Hit =
  | { kind: 'chest'; i: number } | { kind: 'slot'; i: number } | { kind: 'up'; id: BuyId } | { kind: 'paw' } | { kind: 'eye' }
  | { kind: 'vintage' } | { kind: 'yes' } | { kind: 'no' } | { kind: 'story' } | { kind: 'field'; x: number; y: number } | { kind: 'none' };

interface Toast { title: string; sub: string; color: string; t: number; dur: number }
interface Flyer { x: number; y: number; tx: number; ty: number; t: number; dur: number; gold: boolean }
/**
 * A toy on the move: where the finger is, whether it has left its place (past the tap slop), how high above
 * the finger it floats (px, eased in as the drag starts) and the place it would land on now.
 */
export interface Drag { from: Loc; toy: Toy; x: number; y: number; moved: boolean; lift: number; k: number; snap: Loc | null }

/** each upgrade's colour (its icon's), for the stripe on a narrow button */
const ACCENT: Readonly<Record<BuyId, string>> = { aim: '#e5533d', paws: '#f0d9b0', bowl: '#8fc8e8', toy: '#e0b85a' };

/** the same place */
const same =(a: Loc | null | undefined, b: Loc | null | undefined): boolean => !!a && !!b && a.kind === b.kind && a.i === b.i;

export class KotyView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private readonly parts = new Particles(520);
  private readonly floats = new Floaters();
  private readonly shake: Shake;
  private readonly flyers: Flyer[] = [];
  private toast: Toast | null = null;
  private clock = 0;
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';
  private verse: { key: string; layout: PassageLayout } | null = null;
  /** button labels wrapped to fit (they change only with the language, a level or the size) */
  private readonly lines = new Map<string, { lines: string[]; size: number }>();
  /** eased numbers for the drawing */
  private eyeV = 0;
  private fishPop = 0;
  private readonly blink: number[] = [];
  private readonly blinkT: number[] = [];
  private readonly catPos: { x: number; y: number }[] = [];
  private readonly buyPop = new Map<BuyId, number>();
  private readonly cellPop = new Map<string, number>();
  private pawPop = 0;
  private nope = 0;
  /** the open cushions (the cats' row is laid out for this many) */
  private slots = 0;
  private readonly reduced: boolean;
  /** the primary input is a finger: no key hints, and a dragged toy floats higher above it */
  readonly touch: boolean;
  drag: Drag | null = null;
  /** a cell or a cat under the finger before it moves (its pressed look) */
  press: Loc | null = null;
  /** the card on screen (its box sizes to its words), for the vintage question's buttons and the targets */
  cardBox: Rect | null = null;
  /** buttons held down (the index repeats purchases), the paw pressed */
  pressed: BuyId | null = null;
  pawDown = false;
  /** a control a coach mark talks about: it glows while the runner's bubble says what to do with it */
  private ring: { at: CoachAt; t: number; dur: number } | null = null;
  /** seconds the runner's coach mark stays up: Brother Anselm's bubble steps aside meanwhile */
  private hintLeft = 0;
  /** a pair that could merge, shimmering when the hands have rested a while (seconds since the last merge) */
  private pair: { from: Loc; to: Loc } | null = null;
  private idle = 0;
  private pairCheck = 0;

  constructor(canvas: HTMLCanvasElement, o: { reducedMotion: boolean; touch?: boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('koty: no 2d context');
    this.ctx = ctx;
    this.reduced = o.reducedMotion;
    this.touch = o.touch ?? false;
    this.shake = new Shake(o.reducedMotion);
    this.L = layout(canvas.clientWidth || 800, canvas.clientHeight || 600, { top: 120, right: 0, bottom: 0, left: 0 });
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins);
    this.cacheKey = '';
    this.verse = null;
    this.lines.clear();
    this.catPos.length = 0;
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: SimEvent, sim: KotySim): void {
    const L = this.L, u = L.u;
    switch (e.type) {
      case 'hit': {
        const p = toPx(L, e.x, e.y);
        if (e.boss || e.crit || this.parts.count < 380) {
          this.parts.burst(p.x, p.y - L.s * 0.3, e.boss ? 4 : 2, { color: e.fam === 'konewka' || e.fam === 'sikawka' ? '#9fd6ff' : e.fam === 'banki' ? '#d8f0ff' : '#fff4c8', size: 2.2, speed: 90, life: 0.4, g: 200 });
        }
        // a number over the hit, inside the field (a flier still coming in from the side would put it over a column)
        const inside = p.x >= L.field.x + 8 && p.x <= L.field.x + L.field.w - 8;
        if (inside && e.dmg >= 1 && (e.boss || e.crit || Math.random() < 0.18)) {
          this.floats.add(big(e.dmg), clamp(p.x + (Math.random() - 0.5) * 16, L.field.x + 14, L.field.x + L.field.w - 14), p.y - L.s * 0.7, { color: e.crit ? GOLD : '#fff8e6', size: (e.crit ? 20 : e.boss ? 17 : 13) * u, dur: 0.75 });
        }
        break;
      }
      case 'shot': {
        if (this.parts.count < 300 && Math.random() < 0.5) {
          const s = seat(L, e.slot, sim.cushions.length);
          this.parts.burst(s.x + L.cat * 0.3, s.y - L.cat * 0.62, 2, { color: e.fam === 'konewka' || e.fam === 'sikawka' ? '#bfe6ff' : '#fff4d8', size: 1.8, speed: 60, life: 0.25, g: 0, angle: -Math.PI / 2, spread: 1.2 });
        }
        break;
      }
      case 'chased': {
        const p = toPx(L, e.x, e.y);
        const spec = PESTS[e.kind];
        const air = spec.trait === 'air';
        this.parts.burst(p.x, p.y - L.s * 0.2, air ? 7 : 6, {
          color: air ? '#f3e7d2' : e.kind === 'rybik' ? '#dfe7ef' : '#d8c29a', size: air ? 3 : 2.6, speed: 120, life: 0.6, g: air ? 40 : 160,
          shape: air ? 'square' : 'dot',
        });
        if (this.flyers.length < 14) {
          const tgt = this.fishTarget();
          this.flyers.push({ x: p.x, y: p.y - L.s * 0.3, tx: tgt.x, ty: tgt.y, t: 0, dur: 0.55 + Math.random() * 0.2, gold: e.elite });
        }
        if (e.elite) this.floats.add(t('hud.elite'), p.x, p.y - L.s, { color: GOLD, size: 18 * u });
        break;
      }
      case 'splash': {
        const p = toPx(L, e.x, e.y);
        const col = e.kind === 'bubble' ? '#dff4ff' : e.kind === 'apple' ? '#e5533d' : '#9fd6ff';
        this.parts.burst(p.x, p.y, e.kind === 'apple' ? 8 : 6, { color: col, size: 2.4, speed: 110, life: 0.5, g: 220 });
        break;
      }
      case 'stage':
        if (e.newPlace) this.toastShow(placeName(e.place), t('hud.stage', { n: e.n }), '#ffe9b0', 2.2);
        else this.floats.add(t('hud.stage', { n: e.n }), L.stage.x + L.stage.w / 2, L.bar.y + L.bar.h * 2.2, { color: CREAM, size: 15 * u, dur: 1.1 });
        break;
      case 'boss':
        this.toastShow(t('hud.boss', { name: bossName(e.id) }), t('hud.patience'), '#ffb08a', 2.2);
        this.shake.add(0.25);
        break;
      case 'bossTrick': {
        const b = sim.boss;
        if (b) {
          const p = toPx(L, b.x, b.y);
          this.floats.add(trickName(e.trick), p.x, p.y - L.s * 2, { color: '#ffd0b8', size: 15 * u, dur: 1.2 });
        }
        break;
      }
      case 'bossChased': {
        const b = sim.boss;
        if (b) {
          const p = toPx(L, b.x, b.y);
          const tgt = this.fishTarget();
          this.parts.burst(p.x, p.y - L.s, 30, { color: GOLD, size: 3.5, speed: 220, life: 1, g: 120, shape: 'spark' });
          for (let i = 0; i < 6; i++) this.flyers.push({ x: p.x + (Math.random() - 0.5) * 40, y: p.y - L.s, tx: tgt.x, ty: tgt.y, t: -i * 0.06, dur: 0.7, gold: true });
        }
        this.toastShow(t('hud.chased'), `${bossName(e.id)} ${starText(e.stars)}`, GOLD, 2.2);
        this.shake.add(0.45);
        break;
      }
      case 'bossBacks':
        this.toastShow(t('hud.backs', { name: bossName(e.id) }), '', '#ffd9b8', 1.8);
        break;
      case 'merge': {
        this.idle = 0;
        this.pair = null;
        const p = this.locCentre(e.at, sim);
        this.parts.burst(p.x, p.y, 16, { color: e.fresh ? GOLD : '#fff2c8', size: 3, speed: 150, life: 0.6, g: 60, shape: 'spark' });
        this.floats.add(t('hud.merge', { g: e.toy.g }), p.x, p.y - 20 * u, { color: e.fresh ? GOLD : CREAM, size: (e.fresh ? 19 : 15) * u, dur: 1 });
        this.cellPop.set(`${e.at.kind}${e.at.i}`, 1);
        break;
      }
      case 'equip':
        this.cellPop.set(`slot${e.at.i}`, 1);
        break;
      case 'toy': {
        if (e.at && e.at.kind === 'slot') {
          this.cellPop.set(`slot${e.at.i}`, 1);
          break;
        }
        if (e.at) {
          this.cellPop.set(`chest${e.at.i}`, 1);
          const r = cellRect(L, e.at.i);
          if (e.source === 'nap' || e.source === 'boss' || e.source === 'away') this.floats.add(t('hud.newToy'), r.x + r.w / 2, r.y - 6, { color: GOLD, size: 14 * u, dur: 1.1 });
          if (e.source === 'found') {
            const c = sim.cushions.find(x => x.spec?.gift === 'finder');
            this.floats.add(t('hud.found', { name: c?.cat ? catName(c.cat) : '' }), r.x + r.w / 2, r.y - 22 * u, { color: GOLD, size: 14 * u, dur: 1.4 });
          }
        }
        break;
      }
      case 'full':
        this.floats.add(t('hud.full'), L.chest.x + L.chest.w / 2, L.chest.y - 8, { color: '#ffd0b8', size: 14 * u, dur: 1 });
        break;
      case 'buy':
        this.buyPop.set(e.id, 1);
        this.fishPop = Math.max(this.fishPop, 0.4);
        break;
      case 'cant':
        this.buyPop.set(e.id, -1);
        break;
      case 'nope':
        this.nope = 1;
        break;
      case 'huntReady':
        this.parts.burst(L.eye.x, L.eye.y, 18, { color: GOLD, size: 3, speed: 140, life: 0.7, g: 0, shape: 'spark' });
        break;
      case 'hunt':
        this.toastShow(t('hud.hunt'), '', GOLD, 1.8);
        this.shake.add(0.5);
        break;
      case 'pounce': {
        const p = toPx(L, e.x, e.y);
        this.parts.burst(p.x, p.y, 8, { color: '#ffe7a8', size: 3, speed: 160, life: 0.5, g: 100 });
        break;
      }
      case 'ripe': {
        const x = L.field.x + L.field.w * (0.1 + Math.random() * 0.8), y = L.field.y + L.field.h * (0.3 + Math.random() * 0.5);
        this.parts.burst(x, y, 5, { color: '#c9a2e8', size: 2.4, speed: 50, life: 0.9, g: -20 });
        this.floats.add(`+${big(e.v)}`, x, y, { color: '#e9dcff', size: 14 * u, dur: 1.2 });
        const tgt = this.fishTarget();
        if (this.flyers.length < 14) this.flyers.push({ x, y, tx: tgt.x, ty: tgt.y, t: 0, dur: 0.8, gold: false });
        break;
      }
      case 'napEnd':
        if (e.toy) this.floats.add(t('hud.gift'), L.chest.x + L.chest.w / 2, L.chest.y - 10, { color: GOLD, size: 15 * u, dur: 1.5 });
        break;
      case 'cat':
        this.toastShow(t('hud.cat', { name: catName(e.id) }), '', '#ffe9b0', 2.2);
        break;
      case 'cushion':
        this.parts.burst(L.wall.x + L.wall.w / 2, L.seatY, 12, { color: '#fff2c8', size: 3, speed: 140, life: 0.6, g: 40, shape: 'spark' });
        break;
      case 'pet': {
        const s = seat(L, e.slot, sim.cushions.length);
        const who = sim.cushions[e.slot]?.cat;
        this.floats.add(who ? `${catName(who)} · ${t('hud.purr')}` : t('hud.purr'), s.x, s.y - L.cat * 1.1, { color: '#ffd0dc', size: 14 * u, dur: 1.1 });
        break;
      }
      case 'clap': {
        const p = toPx(L, e.x, e.y);
        this.floats.add(t('hud.psst'), p.x, p.y - 8, { color: CREAM, size: 14 * u, dur: 0.6 });
        break;
      }
      case 'vintage':
        this.toastShow(t('hud.vintage'), `+${goldText(e.gold)}`, GOLD, 2.4);
        break;
      case 'dusk':
        this.toastShow(t('hud.dusky', { n: Math.round(e.share * 100) }), t('hud.dusk'), '#d8ccff', 2.4);
        break;
      default:
        break;
    }
  }

  /** where fish fly to: the bowl's fish icon */
  private fishTarget(): { x: number; y: number } {
    const f = this.L.fish;
    return { x: f.x + Math.min(f.h, 40) * 0.5, y: f.y + f.h / 2 };
  }

  private toastShow(title: string, sub: string, color: string, dur: number): void {
    this.toast = { title, sub, color, t: 0, dur };
  }

  /** A coach mark talks about a control in the thumb zone: the control glows for as long as the mark shows. */
  coachRing(at: CoachAt, ms: number): void {
    this.ring = { at, t: 0, dur: ms / 1000 };
  }

  /** The runner shows a coach mark for `ms`: the brother's bubble keeps out of its way. */
  coachShown(ms: number): void {
    this.hintLeft = ms / 1000;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: KotySim): void {
    this.clock += dt;
    this.parts.update(dt);
    this.floats.update(dt);
    if (this.toast) {
      this.toast.t += dt;
      if (this.toast.t >= this.toast.dur) this.toast = null;
    }
    if (this.ring) {
      this.ring.t += dt;
      if (this.ring.t >= this.ring.dur || sim.story || sim.confirm) this.ring = null;
    }
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt / f.dur;
      if (f.t >= 1) {
        this.flyers.splice(i, 1);
        this.fishPop = 1;
      }
    }
    this.fishPop = Math.max(0, this.fishPop - dt * 3);
    this.hintLeft = Math.max(0, this.hintLeft - dt);
    this.pawPop = Math.max(0, this.pawPop - dt * 3);
    this.nope = Math.max(0, this.nope - dt * 3);
    for (const [k, v] of this.buyPop) {
      const nv = v > 0 ? Math.max(0, v - dt * 3) : Math.min(0, v + dt * 3);
      if (nv === 0) this.buyPop.delete(k); else this.buyPop.set(k, nv);
    }
    for (const [k, v] of this.cellPop) {
      const nv = Math.max(0, v - dt * 2.5);
      if (nv === 0) this.cellPop.delete(k); else this.cellPop.set(k, nv);
    }
    const d = this.drag;
    if (d) d.k = d.moved ? approach(d.k, 1, dt, this.reduced ? 0 : 0.05) : 0;
    this.idle += dt;
    this.pairCheck -= dt;
    if (this.pairCheck <= 0) {
      this.pairCheck = 1;
      this.pair = this.idle > 6 && !sim.frozen ? sim.firstPair(true) : null;
    }
    const want = this.eyeValue(sim) ?? 0;
    this.eyeV = approach(this.eyeV, want, dt, 0.25);
    // blinks and the cats' places (the hunt's leaps)
    const n = sim.cushions.length;
    for (let i = 0; i < n; i++) {
      if (this.blinkT[i] === undefined) { this.blinkT[i] = 1 + Math.random() * 4; this.blink[i] = 0; }
      this.blinkT[i] -= dt;
      if (this.blinkT[i] <= 0) { this.blink[i] = 1; this.blinkT[i] = 2.5 + Math.random() * 4; }
      this.blink[i] = Math.max(0, this.blink[i] - dt * 7);
      const home = seat(this.L, i, n);
      const c = sim.cushions[i];
      const tgt = c.leap ? toPx(this.L, c.leap.x, c.leap.y) : home;
      const cur = this.catPos[i] ?? { ...home };
      const k = c.leap ? 0.07 : 0.12;
      cur.x = approach(cur.x, tgt.x, dt, k);
      cur.y = approach(cur.y, tgt.y, dt, k);
      this.catPos[i] = cur;
    }
    this.catPos.length = n;
    this.slots = n;
  }

  /** The eye's value: alertness in a push, calm in a nap, null at dusk or without signal. */
  private eyeValue(sim: KotySim): number | null {
    if (sim.blind) return null;
    if (sim.restBlock) return sim.reliable ? sim.calmShown : null;
    return sim.alertLevel;
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: KotySim, trace?: SignalTrace, now = 0): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 7);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawWorld(ctx, sim);
    if (trace) this.drawPrints(ctx, trace, now);
    ctx.restore();
    this.drawHud(ctx, sim);
    this.drawCards(ctx, sim);
  }

  private ensureCache(place: PlaceId): void {
    const L = this.L;
    const key = `${place}|${L.w}x${L.h}|${this.dpr}|${L.mode}|${L.top}`;
    if (key === this.cacheKey && this.cache) return;
    const c = this.cache ?? document.createElement('canvas');
    c.width = Math.max(1, Math.round(L.w * this.dpr));
    c.height = Math.max(1, Math.round(L.h * this.dpr));
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#2a2018';
    g.fillRect(0, 0, L.w, L.h);
    paintSky(g, place, L.sky.x, L.sky.w, L.field.y, L.s);
    paintGround(g, place, L.field.x, L.field.y, L.field.w, L.field.h, L.s);
    paintWall(g, L.wall.x, L.wall.y, L.wall.w, L.wall.h, L.s);
    const y0 = L.wall.y + L.wall.h;
    if (L.mode === 'tall') {
      // the ground under the chest and the buttons
      const gr = g.createLinearGradient(0, y0, 0, L.h);
      gr.addColorStop(0, '#5c4330');
      gr.addColorStop(1, '#3a2a1e');
      g.fillStyle = gr;
      g.fillRect(0, y0, L.w, L.h - y0);
    } else if (L.mode === 'wide') {
      const x0 = L.field.x + L.field.w;
      const gr = g.createLinearGradient(x0, 0, L.w, 0);
      gr.addColorStop(0, '#5c4330');
      gr.addColorStop(1, '#3a2a1e');
      g.fillStyle = gr;
      g.fillRect(x0, 0, L.w - x0, L.h);
      if (y0 < L.h) {
        g.fillStyle = '#3a2a1e';
        g.fillRect(0, y0, x0, L.h - y0);
      }
    } else {
      // a phone on its side: the chest's and the buttons' columns on warm wood, and the strip under the wall
      g.fillStyle = '#4a3626';
      g.fillRect(0, 0, L.field.x - 2, L.h);
      g.fillRect(L.field.x + L.field.w + 2, 0, L.w - L.field.x - L.field.w - 2, L.h);
      g.fillStyle = '#3a2a1e';
      g.fillRect(L.field.x - 2, y0, L.field.w + 4, L.h - y0);
    }
    // the chest's frame and its empty trays: drawn once, the toys on them every frame
    rr(g, L.chest.x - 5, L.chest.y - 5, L.chest.w + 10, L.chest.h + 10, 12);
    g.fillStyle = 'rgba(30,20,14,.5)';
    g.fill();
    this.cache = c;
    this.cacheKey = key;
  }

  private drawWorld(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, info = sim.info;
    this.ensureCache(info.place.id);
    if (this.cache) ctx.drawImage(this.cache, 0, 0, L.w, L.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.field.x, 0, L.field.w, L.wall.y + L.wall.h * 0.3);
    ctx.clip();
    // the nap's sun patches and the dusk's veil over the field
    if (sim.napK > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const drift = this.reduced ? 0 : Math.sin(this.clock * 0.3 + i) * 10;
        const x = L.field.x + L.field.w * (0.15 + i * 0.24) + drift, y = L.field.y + L.field.h * (0.35 + (i % 2) * 0.3);
        glow(ctx, x, y, L.s * 2.6, 'rgba(255,196,120,', 0.1 * sim.napK);
      }
      ctx.restore();
    }
    // pests: the far ones first
    const order = [...sim.pests].sort((a, b) => a.y - b.y);
    for (const pe of order) {
      const p = toPx(L, pe.x, pe.y);
      const s = Math.max(22, L.s * (pe.spec.r * 2.3 + 0.3));
      paintPest(ctx, p.x, p.y, s, pe.kind, {
        dir: pe.dir, t: pe.t, hit: pe.hit / RULES.flinch, flee: pe.state === 'flee', doze: sim.napK, frozen: pe.freeze > 0, elite: pe.elite,
        move: pe.state === 'come' && sim.napK < 0.5 ? 1 : 0, seed: pe.seed,
      });
      if (pe.state !== 'flee' && pe.hp < pe.max && sim.napK < 0.5) {
        // the courage bar
        const w = Math.max(18, s * 0.9);
        ctx.fillStyle = 'rgba(40,24,14,.55)';
        ctx.fillRect(p.x - w / 2, p.y - s * 0.95, w, 4);
        ctx.fillStyle = pe.elite ? GOLD : '#ffb36b';
        ctx.fillRect(p.x - w / 2, p.y - s * 0.95, w * clamp(pe.hp / pe.max), 4);
      }
      if (sim.target === pe.id) this.crosshair(ctx, p.x, p.y - s * 0.35, s * 0.6);
    }
    // the chief
    const b = sim.boss;
    if (b && b.state !== 'away') {
      const p = toPx(L, b.x, b.y);
      const s = this.bossSize(b.spec.r);
      paintBoss(ctx, p.x, p.y, s, b.id, {
        dir: b.dir, t: this.clock, hit: b.hit / RULES.flinch, tele: b.state === 'tele' ? clamp(b.st / RULES.trickTele) : 0,
        trick: b.state === 'trick' ? 1 : 0, doze: sim.napK, flee: b.state === 'chased' || b.state === 'leave',
        air: b.state === 'trick' && b.spec.trick === 'fly' ? Math.sin(clamp(b.st / b.spec.trickSec) * Math.PI) : 0,
      });
      if (sim.target === -1) this.crosshair(ctx, p.x, p.y - s * 0.5, s * 0.5);
    }
    // splashes, shots, beams
    for (const sp of sim.splashes) {
      const p = toPx(L, sp.x, sp.y), k = sp.t / 0.6;
      const r = sp.r * L.s * (0.4 + 0.8 * ease.outCubic(k));
      ctx.globalAlpha = 1 - k;
      if (sp.kind === 'pounce') paintPaw(ctx, p.x, p.y, r * 0.8, 'rgba(255,214,110,.9)');
      else {
        ctx.strokeStyle = sp.kind === 'apple' ? '#b98a5a' : sp.kind === 'psst' ? CREAM : sp.kind === 'puff' ? '#d8d0c8' : sp.kind === 'bubble' ? '#e8f8ff' : '#8fd0ff';
        ctx.lineWidth = 2;
        ell(ctx, p.x, p.y, r, r * 0.55);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const n = sim.cushions.length;
    for (const bm of sim.beams) {
      const s0 = seat(L, bm.slot, n), p = toPx(L, bm.tx, bm.ty);
      const a = 1 - bm.t / 0.14;
      ctx.strokeStyle = `rgba(255,240,170,${0.75 * a})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y - L.cat * 0.55);
      ctx.lineTo(p.x, p.y - L.s * 0.3);
      ctx.stroke();
      glow(ctx, p.x, p.y - L.s * 0.3, L.s * 0.5, 'rgba(255,240,170,', 0.6 * a);
    }
    // the sim fires from its own cushion spots; a fresh shot leaves the drawn cat and eases onto its path
    const launchY = RULES.FH - 0.7;
    for (const s of sim.shots) {
      const k0 = clamp(s.t);
      let dx = 0, dy = 0, fade = 0;
      if (!s.chain.length && Math.abs(s.sy - launchY) < 1e-6) {
        const from = toPx(L, cushionX(s.slot, n || 1), launchY), mine = seat(L, s.slot, n);
        dx = mine.x + L.cat * 0.2 - from.x;
        dy = mine.y - L.cat * 0.55 - from.y;
        fade = 1 - ease.outCubic(k0);
      }
      const q = toPx(L, s.x, s.y);
      const p = { x: q.x + dx * fade, y: q.y + dy * fade };
      const g = sim.cushions[s.slot]?.toy?.g ?? 1;
      const r = Math.max(2.5, L.s * 0.1) * (1 + 0.06 * (g - 1));
      switch (s.pattern) {
        case 'pierce': {
          const o0 = toPx(L, s.sx, s.sy);
          const o = { x: o0.x + dx, y: o0.y + dy };
          ctx.strokeStyle = 'rgba(140,205,255,.85)';
          ctx.lineWidth = Math.max(2, L.s * 0.1);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(o.x + (p.x - o.x) * 0.55, o.y + (p.y - o.y) * 0.55);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          break;
        }
        case 'spray':
          ell(ctx, p.x, p.y, r * 0.8, r);
          ctx.fillStyle = '#8fd0ff';
          ctx.fill();
          break;
        case 'bounce':
          ell(ctx, p.x, p.y, r * 1.2, r * 1.2);
          ctx.fillStyle = '#e8708a';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.7)';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        case 'splash':
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(210,240,255,.35)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(150,200,240,.9)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          break;
        case 'lob': {
          const lift = Math.sin(k0 * Math.PI) * L.s * 2.2;
          ell(ctx, p.x, p.y - lift, r * 1.4, r * 1.4);
          ctx.fillStyle = '#e5533d';
          ctx.fill();
          break;
        }
        default:
          ell(ctx, p.x, p.y, r, r);
          ctx.fillStyle = s.crit ? GOLD : g >= 6 ? gradeColor(g) : '#8ccf5a';
          ctx.fill();
          ctx.strokeStyle = 'rgba(59,42,32,.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
      }
    }
    if (sim.blind) {
      ctx.fillStyle = 'rgba(54,40,92,.38)';
      ctx.fillRect(L.field.x, 0, L.field.w, L.wall.y + L.wall.h);
    }
    ctx.restore();
    // the wall's cushions and the cats
    for (let i = 0; i < n; i++) {
      const c = sim.cushions[i];
      const st = seat(L, i, n);
      const hot = this.dropHot({ kind: 'slot', i }, sim);
      paintCushion(ctx, st.x, st.y, L.cat * 0.95, i, !c.cat, hot);
    }
    const u = L.u;
    for (let i = 0; i < n; i++) {
      const c = sim.cushions[i];
      if (!c.spec) continue;
      const pos = this.catPos[i] ?? seat(L, i, n);
      const home = seat(L, i, n);
      const pop = this.cellPop.get(`slot${i}`) ?? 0;
      const look = this.lookOf(sim, i);
      const pose: CatPose = {
        ...CAT_POSE, look, alert: sim.alertLevel, gold: sim.golden, sleep: sim.napK, recoil: c.recoil, purr: c.purr > 0 ? 1 : 0,
        blink: this.blink[i] ?? 0, t: this.clock + i * 1.7, leap: c.leap ? 1 : 0,
      };
      const h = L.cat * (1 + pop * 0.12);
      // pressed or the drop's landing place: a ring of light under the finger
      const pressed = same(this.press, { kind: 'slot', i }) && !this.drag?.moved;
      const landing = !!this.drag?.moved && same(this.drag.snap, { kind: 'slot', i });
      if (pressed || landing) {
        const merge = landing && this.isMate({ kind: 'slot', i }, sim);
        ctx.strokeStyle = merge ? GOLD : 'rgba(255,244,220,.9)';
        ctx.lineWidth = 3;
        ell(ctx, home.x, home.y - L.cat * 0.4, L.cat * 0.56, L.cat * 0.62);
        ctx.stroke();
      }
      paintCat(ctx, pos.x, pos.y, h, c.spec, pose);
      if (sim.napK > 0.6) {
        const k = (this.clock * 0.45 + i * 0.37) % 1;
        ctx.globalAlpha = (1 - k) * sim.napK;
        label(ctx, 'z', pos.x + h * (0.25 + k * 0.2), pos.y - h * (0.55 + k * 0.5), Math.max(MIN_TEXT, h * (0.2 + k * 0.1)), '#e8f2ff', 'center', 900);
        ctx.globalAlpha = 1;
      }
      if (c.toy && sim.napK < 0.5 && !(this.drag?.moved && same(this.drag.from, { kind: 'slot', i }))) {
        paintToy(ctx, pos.x + h * 0.27, pos.y - h * 0.42, h * 0.42, c.toy.fam, c.toy.g, look * 0.8 - 0.25);
      }
      if (c.toy) paintBadge(ctx, home.x - L.cat * 0.34, L.seatY + L.cat * 0.1, Math.max(BADGE_MIN, L.cat * 0.13), c.toy.g);
      // on a wide wall each cat's name sits on the stones under its cushion
      if (L.mode === 'wide' && c.cat) {
        ctx.globalAlpha = 0.9;
        label(ctx, catName(c.cat), home.x, L.seatY + L.cat * 0.32, Math.max(MIN_TEXT, 11 * u), CREAM, 'center', 750);
        ctx.globalAlpha = 1;
      }
    }
    // the gatehouse's eye
    paintEye(ctx, L.eye.x, L.eye.y, L.eye.r, {
      value: sim.blind ? null : this.eyeV, mode: sim.blind ? 'dusk' : sim.restBlock ? 'nap' : 'alert', charge: sim.charge, ready: sim.huntReady && !sim.napping,
      ghost: sim.pushBlock && !sim.blind && sim.blockT < sim.leadIn && sim.reliable ? sim.level : null,
      mult: `×${f1(sim.alert)}`, t: this.clock, hunting: sim.hunting > 0,
    });
    // in a nap the eye sleeps (a ready hunt waits for the next push)
    const lbl = sim.restBlock ? t('hud.nap') : sim.huntReady ? t('hud.huntReady') : sim.blind ? t('hud.dusk') : `×${f1(sim.alert)}`;
    label(ctx, lbl, L.eye.x, L.eye.y + L.eye.r * 1.3, Math.max(MIN_READ, 13 * u), !sim.restBlock && (sim.huntReady || sim.golden) ? GOLD : CREAM);
    if (sim.pushBlock && !sim.blind && sim.blockT >= sim.leadIn) {
      // the threshold's name by its notch (once the band drives the eye)
      ctx.globalAlpha = 0.92;
      label(ctx, t('hud.mark'), L.eye.x, L.eye.y - L.eye.r * 1.32, Math.max(MIN_TEXT, 11 * u), 'rgba(255,244,220,1)', 'center', 750);
      ctx.globalAlpha = 1;
    }
    // the hunt: the field glows gold
    if (sim.hunting > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, L.field.x + L.field.w / 2, L.field.y + L.field.h / 2, Math.max(L.field.w, L.field.h) * 0.7, 'rgba(255,214,110,', 0.12);
      ctx.restore();
    }
    this.parts.draw(ctx);
    this.floats.draw(ctx, SANS);
    // fish flying to the bowl
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const k = ease.outCubic(clamp(f.t));
      const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 40;
      paintFish(ctx, x, y, 6 * u, f.gold);
    }
  }

  /** a chief's sprite size (px) */
  private bossSize(r: number): number {
    return Math.max(40, this.L.s * r * 2.8);
  }

  /**
   * The band's last 40 s as the cats' paw prints along the foot of the wall, "now" at the right: gold
   * where the signal was above the threshold, blue for a calm nap, a faint dot where the band lost the
   * signal (never a low value), a dark veil over dusk until it ends.
   */
  private drawPrints(ctx: CanvasRenderingContext2D, trace: SignalTrace, now: number): void {
    const L = this.L, w = L.wall, n = trace.samples.length;
    if (!n) return;
    const r = Math.max(2.4, Math.min(5, w.h * 0.075));
    const y0 = w.y + w.h * 0.9;
    for (let i = 0; i < n; i++) {
      const s = trace.samples[i];
      const age = now - s.t;
      if (age > 40 || age < 0) continue;
      const x = w.x + 10 + (w.w - 20) * (1 - age / 40);
      const y = y0 + (i % 2 ? -r * 0.8 : r * 0.8);
      const fade = Math.min(1, (40 - age) / 6);
      if (s.veiled) {
        ctx.globalAlpha = 0.5 * fade;
        paintPaw(ctx, x, y, r, '#4a3a6a');
      } else if (!s.reliable || s.activity === null) {
        ctx.globalAlpha = 0.45 * fade;
        ctx.fillStyle = '#8a7a6a';
        ell(ctx, x, y, r * 0.3, r * 0.3);
        ctx.fill();
      } else {
        const above = s.activity >= s.threshold;
        const color = s.phase === 'rest' ? (s.calm >= 0.5 ? '#9fcaff' : '#7a6a5a') : above ? GOLD : '#7a5a3a';
        ctx.globalAlpha = (above || s.phase === 'rest' ? 0.95 : 0.55) * fade;
        paintPaw(ctx, x, y, r, color);
      }
    }
    ctx.globalAlpha = 1;
  }

  private lookOf(sim: KotySim, i: number): number {
    const L = this.L;
    let shot = null as null | { tx: number; ty: number };
    for (let k = sim.shots.length - 1; k >= 0; k--) if (sim.shots[k].slot === i) { shot = sim.shots[k]; break; }
    if (!shot) return 0;
    const s = seat(L, i, sim.cushions.length), p = toPx(L, shot.tx, shot.ty);
    return clamp(Math.atan2(p.x - s.x, s.y - p.y), -1.1, 1.1);
  }

  private crosshair(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ell(ctx, x, y, r, r);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + this.clock * 1.5;
      ctx.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
      ctx.lineTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25);
    }
    ctx.stroke();
  }

  /** Whether the dragged toy would merge with the toy at `l`. */
  private isMate(l: Loc, sim: KotySim): boolean {
    const d = this.drag;
    if (!d || same(d.from, l)) return false;
    const toy = sim.toyAt(l);
    return !!toy && toy.g === d.toy.g && toy.g < RULES.grades;
  }

  /**
   * How much a place glows: while a toy is dragged, where it would land, a mate to merge with, an empty place;
   * at rest, the two halves of a pair that could merge, slowly, once the hands have rested a while.
   */
  private dropHot(l: Loc, sim: KotySim): number {
    const d = this.drag;
    if (!d) {
      const p = this.pair;
      return p && (same(p.from, l) || same(p.to, l)) ? 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(this.clock * 3.5)) : 0;
    }
    if (!d.moved || same(d.from, l)) return 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 8);
    if (same(d.snap, l)) return 1;
    if (this.isMate(l, sim)) return 0.35 + 0.3 * pulse;
    if (!sim.toyAt(l)) return 0.18;
    return 0;
  }

  // ── the game's own HUD ──────────────────────────────────────────
  private drawHud(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u;
    this.drawBar(ctx, sim);
    this.drawFish(ctx, sim);
    // the chest (its frame and trays are in the cached background)
    const d = this.drag;
    for (let i = 0; i < RULES.chest; i++) {
      const r = cellRect(L, i);
      const loc: Loc = { kind: 'chest', i };
      const toy = sim.p.chest[i];
      const pop = this.cellPop.get(`chest${i}`) ?? 0;
      const lifted = !!d?.moved && same(d.from, loc);
      const down = same(this.press, loc) && !d?.moved;
      ctx.save();
      if (pop > 0) {
        const k = 1 + 0.15 * pop;
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.scale(k, k);
        ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      }
      paintToyCell(ctx, r.x, r.y, r.w, lifted ? null : toy, this.dropHot(loc, sim), lifted);
      if (down) {
        // pressed: the tray sinks under the finger
        rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.18);
        ctx.fillStyle = 'rgba(20,12,8,.28)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,236,190,.95)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (sim.gifts.length) {
      // gifts waiting for room: a parcel over the chest
      const x = L.chest.x + L.chest.w - 12, y = L.chest.y - 14;
      rr(ctx, x - 11, y - 9, 22, 17, 3);
      ctx.fillStyle = '#d9765f';
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - 2, y - 9, 4, 17);
      label(ctx, `${sim.gifts.length}`, x - 22, y, Math.max(MIN_TEXT, 12 * u), GOLD);
    }
    // the buttons
    for (const id of BUYS) this.drawBuy(ctx, sim, id, L.ups[id]);
    this.drawPaw(ctx, sim);
    if (sim.vintageOpen) this.drawVintage(ctx, sim);
    this.drawRing(ctx, sim);
    // Brother Anselm and his line
    const br = L.brother, line = sim.talk.line;
    const talking = !!line && !sim.story && !sim.confirm && this.hintLeft <= 0;
    if (L.mode !== 'short' || talking) paintBrother(ctx, br.x, br.y, br.r, talking, this.clock);
    if (talking && line) {
      const fsz = Math.max(14, 14 * u);
      ctx.font = font(fsz, 650);
      const bx = br.x + br.r + 12;
      // his bubble keeps clear of the vintage's button
      const vin = sim.vintageOpen && L.vintage.y < br.y + br.r + 40 && L.vintage.x > bx ? L.vintage.x - 8 - bx : Infinity;
      const maxW = Math.max(120, Math.min(br.maxW, vin));
      const lines = wrapLines(ctx, line.text, maxW - 22);
      const w = Math.min(maxW, Math.max(...lines.map(s => ctx.measureText(s).width)) + 22);
      const h = lines.length * fsz * 1.25 + 14;
      const by = Math.max(L.bar.y + L.bar.h + 4, br.y - h / 2);
      // a toy on its way to a cat: the bubble fades so the cats under it show
      const a = Math.min(1, line.t / 0.2, (line.dur - line.t) / 0.3) * (this.drag?.moved ? 0.25 : 1);
      ctx.globalAlpha = clamp(a);
      // the bubble's tail points at his face from its foot
      bubble(ctx, bx, by, w, h, br.x + br.r * 0.9, Math.max(by + h + 6, br.y + br.r * 0.6));
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((s, i) => ctx.fillText(s, bx + 11, by + 7 + i * fsz * 1.25));
      ctx.globalAlpha = 1;
    }
    // the dragged toy over everything, above the finger
    if (d && d.moved) {
      const p = this.dragPoint();
      const sz = L.cell * 1.12;
      // lifted: a soft shadow under it, a light disc, its rim gold over a mate
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#1a100a';
      ell(ctx, p.x + 3, p.y + sz * 0.42, sz * 0.4, sz * 0.13);
      ctx.fill();
      ctx.globalAlpha = 0.96;
      ell(ctx, p.x, p.y, sz * 0.5, sz * 0.5);
      ctx.fillStyle = 'rgba(150,104,62,.9)';
      ctx.fill();
      ctx.strokeStyle = d.snap && this.isMate(d.snap, sim) ? GOLD : 'rgba(255,236,190,.9)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      paintToy(ctx, p.x, p.y + sz * 0.04, sz * 0.62, d.toy.fam, d.toy.g);
      const br2 = Math.max(BADGE_MIN, sz * 0.15);
      paintBadge(ctx, p.x - sz * 0.36, p.y - sz * 0.36, br2, d.toy.g);
      ctx.globalAlpha = 1;
    }
    // the toast
    const tt = this.toast;
    if (tt && !sim.story && !sim.confirm) {
      const k = tt.t / tt.dur;
      const a = Math.min(1, tt.t / 0.15, (tt.dur - tt.t) / 0.35);
      const pop = k < 0.12 ? ease.outBack(k / 0.12) : 1;
      const y = L.field.y + L.field.h * 0.32;
      ctx.globalAlpha = clamp(a);
      const size = Math.max(16, Math.min(30 * u, (L.field.w - 24) / Math.max(6, tt.title.length * 0.62))) * pop;
      label(ctx, tt.title, L.field.x + L.field.w / 2, y, size, tt.color);
      if (tt.sub) label(ctx, tt.sub, L.field.x + L.field.w / 2, y + Math.max(size, 20) * 0.95, Math.max(MIN_READ, size * 0.5), CREAM, 'center', 700);
      ctx.globalAlpha = 1;
    }
  }

  /** Where the dragged toy is drawn (and where it lands): above the finger, pulled a little toward its landing place. */
  dragPoint(): { x: number; y: number } {
    const d = this.drag;
    if (!d) return { x: 0, y: 0 };
    const x = d.x, y = d.y - d.lift * d.k;
    if (!d.snap) return { x, y };
    const c = this.snapCentre(d.snap);
    return { x: x + (c.x - x) * 0.3, y: y + (c.y - y) * 0.3 };
  }

  private drawFish(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u, fp = L.fish;
    rr(ctx, fp.x, fp.y, fp.w, fp.h, Math.min(fp.h / 2, 14 * u));
    ctx.fillStyle = 'rgba(30,20,14,.74)';
    ctx.fill();
    const fr = Math.min(fp.h * 0.3, 11 * u) * (1 + this.fishPop * 0.25);
    const cx = fp.x + Math.min(fp.h, 40) * 0.5;
    paintFish(ctx, cx, fp.y + fp.h / 2, fr);
    const tx = cx + fr * 1.6;
    fitAndFill(ctx, big(sim.p.fish), tx, fp.y + fp.h / 2, fp.x + fp.w - tx - 8, Math.max(15, fp.h * 0.52), CREAM, 'left', 800, MIN_READ);
  }

  private drawBar(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u, b = L.stage;
    const info = sim.info;
    const boss = sim.boss && sim.boss.state !== 'away' ? sim.boss : null;
    rr(ctx, b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fillStyle = 'rgba(30,20,14,.7)';
    ctx.fill();
    const fz = Math.max(MIN_READ, Math.min(13 * u, b.h * 0.56));
    if (boss) {
      // the chief: his courage (orange) and his patience (blue)
      const name = bossName(boss.id);
      const nw = Math.min(b.w * 0.44, 170 * u);
      fitAndFill(ctx, name, b.x + 10, b.y + b.h / 2, nw - 10, fz, '#ffd0b8', 'left', 800);
      const ch = Math.max(6, b.h * 0.34);
      const cx = b.x + nw + 4, rest = b.x + b.w - 10 - cx;
      const cw = rest * 0.58, pw = rest * 0.42 - 6;
      rr(ctx, cx, b.y + (b.h - ch) / 2, cw, ch, ch / 2);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fill();
      rr(ctx, cx, b.y + (b.h - ch) / 2, Math.max(ch, cw * clamp(boss.hp / boss.max)), ch, ch / 2);
      ctx.fillStyle = '#ff8a5c';
      ctx.fill();
      const px = cx + cw + 6;
      if (pw > 14) {
        rr(ctx, px, b.y + (b.h - ch) / 2, pw, ch, ch / 2);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.fill();
        rr(ctx, px, b.y + (b.h - ch) / 2, Math.max(ch, pw * clamp(boss.patience / boss.patienceMax)), ch, ch / 2);
        ctx.fillStyle = sim.napping ? '#b8d4ff' : '#8fd0ff';
        ctx.fill();
      }
      return;
    }
    const wave = sim.wave;
    const right = t('hud.wave', { left: Math.min(wave.chased, wave.all), all: wave.all });
    ctx.font = font(fz, 800);
    const rw = ctx.measureText(right).width;
    // the words first, the wave's bar takes what is left (40 px at least); a narrow pill (German on a small
    // phone) keeps the place's whole name and leaves the stage's number to the score's corner, which shows it too
    const full = `${t('hud.stage', { n: sim.p.stage })} · ${placeName(info.place.id)}`;
    const left = ctx.measureText(full).width <= b.w - rw - 78 ? full : placeName(info.place.id);
    const lw = Math.min(ctx.measureText(left).width + 22, b.w - rw - 64);
    fitAndFill(ctx, left, b.x + 10, b.y + b.h / 2, lw - 14, fz, CREAM, 'left', 800);
    const px = b.x + lw, pw = b.x + b.w - rw - 18 - px, ph = Math.max(5, b.h * 0.3);
    if (pw > 16) {
      rr(ctx, px, b.y + (b.h - ph) / 2, pw, ph, ph / 2);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fill();
      rr(ctx, px, b.y + (b.h - ph) / 2, Math.max(ph, pw * clamp(wave.chased / Math.max(1, wave.all))), ph, ph / 2);
      ctx.fillStyle = info.boss ? '#ffb08a' : '#bfe08f';
      ctx.fill();
    }
    ctx.font = font(fz, 800);
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(right, b.x + b.w - 10, b.y + b.h / 2 + 0.5);
  }

  /** A button's label in one line, or two at a space, from `px` down to `min` (then cut). */
  private labelLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min: number, weight: number): { lines: string[]; size: number } {
    const key = `${text}|${Math.round(maxW)}|${px}|${min}|${weight}`;
    const known = this.lines.get(key);
    if (known) return known;
    let out: { lines: string[]; size: number } | null = null;
    const words = text.split(' ');
    for (let size = px; size >= min && !out; size -= 0.5) {
      ctx.font = font(size, weight);
      if (ctx.measureText(text).width <= maxW) { out = { lines: [text], size }; break; }
      let best: string[] | null = null, bw = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (w < bw) { bw = w; best = [a, b]; }
      }
      if (best && bw <= maxW) out = { lines: best, size };
    }
    if (!out) {
      const cut = fitText(ctx, text, maxW, min, weight, SANS, min);
      out = { lines: [cut], size: min };
    }
    this.lines.set(key, out);
    return out;
  }

  private drawBuy(ctx: CanvasRenderingContext2D, sim: KotySim, id: BuyId, r0: Rect): void {
    const L = this.L, u = L.u;
    const cost = costOf(sim.p, id);
    const can = cost !== null && sim.p.fish >= cost && !(id === 'toy' && sim.chestFull);
    const pop = this.buyPop.get(id) ?? 0;
    const down = this.pressed === id;
    // pressed: the button goes down and darkens (no shrinking, so its words keep their size)
    const r = down ? { ...r0, y: r0.y + 2 } : r0;
    ctx.save();
    const k = 1 + Math.max(0, pop) * 0.06;
    ctx.translate(r.x + r.w / 2 + (pop < 0 ? Math.sin(this.clock * 60) * 3 * -pop : 0), r.y + r.h / 2);
    ctx.scale(k, k);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    if (!down) {
      rr(ctx, r.x, r.y + 3, r.w, r.h, 12 * u);
      ctx.fillStyle = 'rgba(20,12,8,.45)';
      ctx.fill();
    }
    rr(ctx, r.x, r.y, r.w, r.h, 12 * u);
    ctx.fillStyle = down ? (can ? '#5e3b22' : 'rgba(50,36,26,.9)') : can ? '#7a4f2f' : 'rgba(70,50,36,.9)';
    ctx.fill();
    ctx.strokeStyle = can ? 'rgba(255,214,140,.8)' : 'rgba(255,255,255,.16)';
    ctx.lineWidth = can ? 2 : 1;
    ctx.stroke();
    const p = sim.p;
    const name = t(`up.${id}` as 'up.aim');
    const fx = id === 'aim' ? t('up.aim.fx', { x: f1(aimMult(p.up.aim)) })
      : id === 'paws' ? t('up.paws.fx', { x: f1(pawsMult(p.up.paws)) })
        : id === 'bowl' ? t('up.bowl.fx', { x: f1(bowlMult(p.up.bowl)) })
          : t('up.toy.fx', { g: shopGrade(p) });
    const textA = can ? 1 : 0.7;
    if (!L.rich) {
      // a phone upright: the name (one or two lines) over the cost, a stripe of the upgrade's colour on top
      ctx.globalAlpha = can ? 0.95 : 0.45;
      rr(ctx, r.x + 12, r.y + 3, r.w - 24, 3, 1.5);
      ctx.fillStyle = ACCENT[id];
      ctx.fill();
      ctx.globalAlpha = textA;
      const lab = this.labelLines(ctx, name, r.w - 6, 13 * u, 11, 750);
      const lh = lab.size * 1.06;
      const cy = r.y + r.h * 0.37;
      ctx.font = font(lab.size, 750);
      ctx.fillStyle = CREAM;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lab.lines.forEach((s, i) => ctx.fillText(s, r.x + r.w / 2, cy + (i - (lab.lines.length - 1) / 2) * lh + 0.5));
      this.cost(ctx, cost, r.x + r.w / 2, r.y + r.h - Math.max(11, r.h * 0.2), r.w - 6, 13 * u, 'center');
    } else {
      const ir = Math.min(r.h * 0.22, 13 * u);
      ctx.globalAlpha = textA;
      paintUpIcon(ctx, id, r.x + ir + 9, r.y + r.h / 2, ir);
      const tx = r.x + ir * 2 + 16, tw = r.x + r.w - tx - 5;
      // the name on one line, with the effect (and the level when it fits) under it; a long name takes two
      // lines and leaves the effect out (German on a phone on its side)
      const lab = this.labelLines(ctx, name, tw, Math.min(14 * u, r.h * 0.3), 11.5, 800);
      ctx.font = font(lab.size, 800);
      ctx.fillStyle = CREAM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (lab.lines.length > 1) {
        const lh = lab.size * 1.06;
        lab.lines.forEach((s, i) => ctx.fillText(s, tx, r.y + r.h * 0.37 + (i - 0.5) * lh + 0.5));
      } else {
        ctx.fillText(lab.lines[0], tx, r.y + r.h * 0.27 + 0.5);
        const lv = id === 'toy' ? '' : ` · ${t('hud.lvl', { n: p.up[id as 'aim'] })}`;
        ctx.font = font(Math.max(MIN_TEXT, Math.min(11.5 * u, r.h * 0.24)), 650);
        const fxt = lv && ctx.measureText(fx + lv).width <= tw ? fx + lv : fx;
        fitAndFill(ctx, fxt, tx, r.y + r.h * 0.53, tw, Math.min(11.5 * u, r.h * 0.24), 'rgba(255,240,210,.8)', 'left', 650, MIN_TEXT);
      }
      this.cost(ctx, cost, tx, r.y + r.h * 0.79, tw, Math.min(13 * u, r.h * 0.28), 'left');
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private cost(ctx: CanvasRenderingContext2D, cost: number | null, x: number, y: number, w: number, px: number, align: 'left' | 'center'): void {
    const size = Math.max(MIN_READ, px);
    if (cost === null) {
      fitAndFill(ctx, t('hud.max'), x, y, w, size, GOLD, align, 800, MIN_TEXT);
      return;
    }
    const fr = size * 0.42;
    const text = fitText(ctx, big(cost), Math.max(10, w - fr * 2.6), size, 800, SANS, MIN_TEXT);
    const tw = ctx.measureText(text).width;
    const x0 = align === 'center' ? x - (tw + fr * 2.6) / 2 : x;
    paintFish(ctx, x0 + fr, y, fr);
    ctx.fillStyle = '#bfe6ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + fr * 2.6, y + 0.5);
  }

  private drawPaw(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u;
    const r = this.pawDown ? { ...L.paw, y: L.paw.y + 2 } : L.paw;
    // the paw is Space on a button: it lets a ready hunt loose first
    const hunt = sim.huntReady && !sim.napping;
    const pop = Math.max(this.pawPop, this.nope * 0.5);
    ctx.save();
    ctx.translate(r.x + r.w / 2 + Math.sin(this.clock * 50) * 3 * this.nope, r.y + r.h / 2);
    ctx.scale(1 + pop * 0.06, 1 + pop * 0.06);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    if (!this.pawDown) {
      rr(ctx, r.x, r.y + 3, r.w, r.h, 12 * u);
      ctx.fillStyle = 'rgba(20,12,8,.45)';
      ctx.fill();
    }
    rr(ctx, r.x, r.y, r.w, r.h, 12 * u);
    const beat = 0.5 + 0.5 * Math.sin(this.clock * 9);
    ctx.fillStyle = hunt ? (this.pawDown ? '#b8862a' : '#d9a23a') : this.pawDown ? '#46602d' : '#5a7a3a';
    ctx.fill();
    ctx.strokeStyle = hunt ? `rgba(255,240,170,${0.6 + 0.4 * beat})` : 'rgba(220,255,180,.6)';
    ctx.lineWidth = hunt ? 3 : 2;
    ctx.stroke();
    const word = hunt ? t('hud.huntReady') : t('hud.paw');
    const ink = hunt ? INK : CREAM;
    const pr = Math.min(r.h * 0.24, 13 * u);
    if (!L.rich) {
      paintPaw(ctx, r.x + r.w / 2, r.y + r.h * 0.34, pr, hunt ? INK : '#f6ffe6');
      fitAndFill(ctx, word, r.x + r.w / 2, r.y + r.h - Math.max(11, r.h * 0.2), r.w - 6, 13 * u, ink, 'center', 800, MIN_TEXT);
    } else {
      paintPaw(ctx, r.x + pr + 10, r.y + r.h / 2, pr, hunt ? INK : '#f6ffe6');
      // the key is a desktop's shortcut; a finger has no Space
      const key = this.touch ? '' : ' · ␣';
      fitAndFill(ctx, `${word}${key}`, r.x + pr * 2 + 18, r.y + r.h / 2, r.w - pr * 2 - 24, 14 * u, ink, 'left', 800, MIN_TEXT);
    }
    ctx.restore();
  }

  private drawVintage(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, r = L.vintage, u = L.u;
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 3);
    rr(ctx, r.x, r.y, r.w, r.h, 12 * u);
    ctx.fillStyle = '#6b3f7a';
    ctx.fill();
    ctx.strokeStyle = `rgba(255,214,110,${0.5 + 0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (r.w < 100) {
      // compact (a phone upright): the grapes over the golden fish it brings
      paintGrapes(ctx, r.x + r.w / 2, r.y + r.h * 0.42, Math.min(r.h * 0.26, 13 * u));
      fitAndFill(ctx, t('hud.vintageGo', { n: big(sim.vintageNow) }), r.x + r.w / 2, r.y + r.h * 0.8, r.w - 8, 13 * u, GOLD, 'center', 800, MIN_TEXT);
      return;
    }
    const gr = Math.min(r.h * 0.3, 12 * u);
    paintGrapes(ctx, r.x + gr + 8, r.y + r.h * 0.56, gr);
    const tx = r.x + gr * 2 + 14, tw = r.x + r.w - tx - 6;
    const fz = Math.max(MIN_READ, Math.min(13 * u, r.h * 0.32));
    fitAndFill(ctx, t('hud.vintage'), tx, r.y + r.h * 0.31, tw, fz, CREAM, 'left', 800, MIN_TEXT);
    const fr = fz * 0.4;
    paintFish(ctx, tx + fr, r.y + r.h * 0.71, fr, true);
    fitAndFill(ctx, t('hud.vintageGo', { n: big(sim.vintageNow) }), tx + fr * 2.6, r.y + r.h * 0.71, tw - fr * 2.6, fz, GOLD, 'left', 800, MIN_TEXT);
  }

  /** The control a coach mark talks about, glowing (the runner's bubble stays clear of the thumb zone). */
  private drawRing(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const g = this.ring;
    if (!g || sim.story || sim.confirm) return;
    const r = this.ringRect(g.at);
    if (!r) return;
    const a = Math.min(1, g.t / 0.2, (g.dur - g.t) / 0.4) * (0.55 + 0.45 * Math.sin(this.clock * 7));
    ctx.globalAlpha = clamp(a);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 14 * this.L.u);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private ringRect(at: CoachAt): Rect | null {
    const L = this.L;
    switch (at.kind) {
      case 'up': return L.ups[at.id];
      case 'paw': return L.paw;
      case 'vintage': return L.vintage;
      case 'chest': return cellRect(L, at.i);
      default: return null;
    }
  }

  // ── cards ───────────────────────────────────────────────────────
  private drawCards(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u;
    const st = sim.story, cf = sim.confirm;
    if (!st && !cf) { this.cardBox = null; return; }
    ctx.fillStyle = 'rgba(20,12,8,.5)';
    ctx.fillRect(0, L.top, L.w, L.h - L.top);
    let title = '', text = '', verseId: 'sng2.15' | null = null;
    if (cf) {
      title = t('vintage.title');
      text = t('vintage.text', { from: cf.from, gold: goldText(cf.gold) });
    } else if (st) {
      if (st.kind === 'open') { title = t('story.open.title'); text = t('story.open'); verseId = 'sng2.15'; }
      else if (st.kind === 'place' && st.place) {
        title = `${t(`story.${st.place}.title` as 'story.open.title')} ${st.stars ? starText(st.stars) : ''}`.trim();
        text = t(`story.${st.place}` as 'story.open');
      }
      else if (st.kind === 'year') { title = t('story.year.title'); text = t('story.year', { from: st.from ?? 1 }); }
      else if (st.kind === 'away') {
        title = t('story.away.title');
        text = `${t('story.away', { fish: fishText(st.fish ?? 0) })}${st.toy ? ` ${t('story.awayToy')}` : ''}`;
        if (st.cats?.length) text += ` ${t('story.trip', { names: st.cats.map(catName).join(', ') })}`;
      } else if (st.kind === 'trip') {
        title = t('story.trip.title');
        text = t('story.trip', { names: (st.cats ?? []).map(catName).join(', ') });
      }
    }
    // measure first: the card is as tall as what it says (at most the layout's room), its words 14–16 px
    const max = L.card, pad = Math.round(18 * u);
    const inner = max.w - pad * 2;
    const icon = st?.kind === 'open' ? 0 : Math.round(30 * u);
    const ts = fitFont(ctx, title, inner, 22 * u, 16, 600, true);
    const foot = cf ? confirmButtons(L, { ...max, h: 200 }).yes.h + pad * 1.4 : Math.round(30 * u);
    let bodySize = Math.max(15, 15 * u), lines: string[] = [], lineH = 0, verseH = 0, need = 0;
    for (; bodySize >= 14; bodySize -= 0.5) {
      ctx.font = font(bodySize, 600);
      lines = wrapLines(ctx, text, inner);
      lineH = bodySize * 1.32;
      verseH = 0;
      if (verseId) {
        const room = Math.max(60, max.h - pad - icon - ts * 1.35 - lines.length * lineH - 10 - foot);
        const key = `${verseId}|${inner}|${Math.round(room)}`;
        if (!this.verse || this.verse.key !== key) {
          const l = layoutPassage(ctx, passage(verseId), inner, room, { max: 16 * u, min: MIN_READ });
          // the reference reads at 12 px at least (the kit's own floor is 10)
          const ref = Math.max(12, l.refSize);
          this.verse = { key, layout: { ...l, refSize: ref, height: l.height + ref - l.refSize } };
        }
        verseH = this.verse.layout.height + 10;
      }
      need = pad + icon + ts * 1.35 + lines.length * lineH + 10 + verseH + foot;
      if (need <= max.h) break;
    }
    bodySize = Math.max(14, bodySize);
    const ch = Math.min(max.h, need);
    const c: Rect = { x: max.x, y: L.anchor === 'bottom' ? max.y + max.h - ch : max.y + (max.h - ch) / 2, w: max.w, h: ch };
    this.cardBox = c;
    const a = st ? Math.min(1, st.t / 0.25) : 1;
    ctx.globalAlpha = a;
    rr(ctx, c.x, c.y, c.w, c.h, 18 * u);
    ctx.fillStyle = '#fbf0d6';
    ctx.fill();
    ctx.strokeStyle = '#c9a26b';
    ctx.lineWidth = 3;
    ctx.stroke();
    let y = c.y + pad;
    if (st?.kind === 'place' || st?.kind === 'year' || cf) paintGrapes(ctx, c.x + c.w / 2, y + 16 * u, 14 * u);
    else if (st?.kind === 'away' || st?.kind === 'trip') paintFish(ctx, c.x + c.w / 2, y + 10 * u, 12 * u);
    y += icon;
    ctx.font = font(ts, 600, true);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, c.x + c.w / 2, y);
    y += ts * 1.35;
    ctx.font = font(bodySize, 600);
    const fit = Math.max(2, Math.floor((c.y + c.h - foot - verseH - y) / lineH));
    ctx.fillStyle = '#4a3528';
    lines.slice(0, fit).forEach((line, i) => ctx.fillText(line, c.x + c.w / 2, y + i * lineH));
    y += Math.min(lines.length, fit) * lineH + 10;
    if (verseId && this.verse) drawPassage(ctx, passage(verseId), this.verse.layout, c.x + c.w / 2, y, { text: '#5a3e6e', ref: '#8a6a50' });
    if (cf) {
      const { yes, no } = confirmButtons(L, c);
      rr(ctx, yes.x, yes.y, yes.w, yes.h, 12 * u);
      ctx.fillStyle = '#6b3f7a';
      ctx.fill();
      fitAndFill(ctx, t('vintage.yes'), yes.x + yes.w / 2, yes.y + yes.h / 2, yes.w - 12, 16 * u, GOLD, 'center', 800, MIN_READ);
      rr(ctx, no.x, no.y, no.w, no.h, 12 * u);
      ctx.fillStyle = '#a08060';
      ctx.fill();
      fitAndFill(ctx, t('vintage.no'), no.x + no.w / 2, no.y + no.h / 2, no.w - 12, 16 * u, CREAM, 'center', 800, MIN_READ);
    } else {
      ctx.font = font(Math.max(MIN_READ, 13 * u), 700);
      ctx.fillStyle = '#8a6448';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t('story.tap'), c.x + c.w / 2, c.y + c.h - 12 * u);
    }
    ctx.globalAlpha = 1;
  }

  // ── hit tests and points ────────────────────────────────────────
  /**
   * What a press lands on: the layout's own rectangles (tapTargets), each grown into half the gap around it so
   * a finger between two cells still lands on one; a story card takes any tap.
   */
  hit(x: number, y: number, sim: KotySim): Hit {
    const L = this.L, pad = L.gap / 2;
    if (sim.confirm) {
      const { yes, no } = confirmButtons(L, this.cardBox ?? L.card);
      if (inRect(yes, x, y, pad)) return { kind: 'yes' };
      if (inRect(no, x, y, pad)) return { kind: 'no' };
      return { kind: 'none' };
    }
    if (sim.story) return { kind: 'story' };
    for (let i = 0; i < RULES.chest; i++) if (inRect(cellRect(L, i), x, y, pad)) return { kind: 'chest', i };
    for (const id of BUYS) if (inRect(L.ups[id], x, y, pad)) return { kind: 'up', id };
    if (inRect(L.paw, x, y, pad)) return { kind: 'paw' };
    if (sim.vintageOpen && inRect(L.vintage, x, y, pad)) return { kind: 'vintage' };
    const row = wallRow(L, sim.cushions.length);
    for (let i = 0; i < row.hit.length; i++) if (inRect(row.hit[i], x, y, pad)) return { kind: 'slot', i };
    if (row.eye && inRect(row.eye, x, y, pad)) return { kind: 'eye' };
    if (inRect(L.field, x, y)) return { kind: 'field', x: (x - L.field.x) / L.sx, y: (y - L.field.y) / L.sy };
    return { kind: 'none' };
  }

  /**
   * The pest (or the chief) a tap on the field means, in the field's units: the nearest one on screen within a
   * finger's reach of the tap (the field is squashed on a phone, so this is measured in px, not in field units).
   */
  pestAt(x: number, y: number, sim: KotySim): { x: number; y: number } | null {
    const L = this.L;
    let best: { x: number; y: number } | null = null, bd = Infinity;
    const b = sim.boss;
    if (b && sim.bossHere) {
      const s = this.bossSize(b.spec.r), p = toPx(L, b.x, b.y);
      const d = Math.hypot(x - p.x, y - (p.y - s * 0.4));
      if (d <= Math.max(34, s * 0.6)) { best = { x: b.x, y: b.y }; bd = d * 0.8; }
    }
    for (const pe of sim.pests) {
      if (pe.state === 'flee') continue;
      const s = Math.max(22, L.s * (pe.spec.r * 2.3 + 0.3)), p = toPx(L, pe.x, pe.y);
      const d = Math.hypot(x - p.x, y - (p.y - s * 0.35));
      if (d <= Math.max(30, s * 0.75) && d < bd) { bd = d; best = { x: pe.x, y: pe.y }; }
    }
    return best;
  }

  /** The place a dragged toy would land on from (x, y): the nearest chest cell or cat within reach (never where it came from). */
  snapAt(x: number, y: number, sim: KotySim, from: Loc): Loc | null {
    const L = this.L;
    let best: Loc | null = null, bd = Infinity;
    const consider = (l: Loc, r: number): void => {
      if (same(l, from)) return;
      const c = this.snapCentre(l, sim.cushions.length);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d <= r && d < bd) { bd = d; best = l; }
    };
    for (let i = 0; i < RULES.chest; i++) consider({ kind: 'chest', i }, L.cell * 0.85);
    const row = wallRow(L, sim.cushions.length);
    for (let i = 0; i < row.hit.length; i++) consider({ kind: 'slot', i }, Math.max(L.cat * 0.85, row.hit[i].w * 0.7));
    return best;
  }

  /** The middle of a landing place: a cell's centre, a cat's chest. */
  private snapCentre(l: Loc, n?: number): { x: number; y: number } {
    if (l.kind === 'chest') {
      const r = cellRect(this.L, l.i);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    const s = seat(this.L, l.i, n ?? this.slots);
    return { x: s.x, y: s.y - this.L.cat * 0.45 };
  }

  /**
   * The canvas point a coach mark points at, or null to have the runner centre it over the field.  The bubble sits
   * above its point, so a mark about the chest points at its top edge on a phone upright, and one about a button
   * (or anything in a column) is centred instead while the control glows (`coachRing`): no bubble over the controls.
   */
  pointFor(at: CoachAt, sim: KotySim): { x: number; y: number } | null {
    const L = this.L;
    switch (at.kind) {
      case 'field': {
        // the bubble stands above its point: low enough in the field that it stays under the HUD (and, on a
        // phone upright, clear of the bar, the vintage and the brother at the field's top)
        const p = toPx(L, at.x, at.y);
        const lo = L.mode === 'tall' ? Math.max(L.top + 86, L.wall.y - 24) : L.top + 86, hi = L.wall.y + L.wall.h * 0.2;
        if (hi < lo) return null;
        return { x: clamp(p.x, L.field.x + 24, L.field.x + L.field.w - 24), y: clamp(p.y, lo, hi) };
      }
      case 'chest': {
        if (L.mode !== 'tall') return null;
        const r = cellRect(L, at.i);
        return { x: r.x + r.w / 2, y: L.chest.y - 6 };
      }
      case 'slot': { const s = seat(L, at.i, sim.cushions.length || 1); return { x: s.x, y: s.y - L.cat * 0.98 }; }
      case 'up': return null;
      case 'paw': return null;
      case 'vintage': return null;
      case 'eye': return { x: L.eye.x, y: L.eye.y - L.eye.r * 1.25 };
    }
  }

  /** The centre of a chest cell or a cushion (px). */
  locCentre(l: Loc, sim: KotySim): { x: number; y: number } {
    if (l.kind === 'chest') {
      const r = cellRect(this.L, l.i);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    const s = seat(this.L, l.i, sim.cushions.length || 1);
    return { x: s.x, y: s.y - this.L.cat * 0.5 };
  }

  pawPressed(): void { this.pawPop = 1; }
}

/** Text fitted into a width (down to `min`, never under MIN_TEXT, then cut with "…"). */
function fitAndFill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, px: number, color: string, align: CanvasTextAlign, weight = 800, min = MIN_TEXT): void {
  const s = fitText(ctx, text, Math.max(10, maxW), Math.max(min, px), weight, SANS, Math.max(MIN_TEXT, min));
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y + 0.5);
}

/** For the debug view: what a toy is called with its grade. */
export const toyLabel = (toy: Toy): string => `${famName(toy.fam)} ${toy.g} (${gradeName(toy.g)})`;

