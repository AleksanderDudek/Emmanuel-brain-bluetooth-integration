/**
 * Kocia straż's play view: the place's sky and field (cached per size), the pests and the chief, the
 * squad's shots and splashes, the wall with the cushions, the cats and the gatehouse's eye (the band's
 * gauge, drawn large with its threshold), and the game's own bits around them — the stage's bar, the
 * fish, the chest, the buttons, Brother Anselm's bubble, toasts, story cards and the vintage's question.
 * The runner draws the Mendi panel, the score and the coach marks; this view keeps below `hudTop` and
 * out of the simulator switch's corner.
 *
 * It reads the sim's state and its events (`on`), and answers the index's hit tests (`hit`).
 */
import { approach, clamp, ease, Floaters, Particles, Shake } from '../kit/juice';
import type { SignalTrace } from '../kit/trace';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageLayout } from '../kit/scripture';
import {
  PESTS, big, bossName, catName, f1, famName, fishText, gradeColor, gradeName, goldText, placeName, trickName, type PlaceId, type Toy,
} from './content';
import { t } from './i18n';
import { cellRect, inRect, layout, seat, toPx, type Layout, type Rect } from './layout';
import { aimMult, bowlMult, costOf, pawsMult, shopGrade, type BuyId } from './meta';
import {
  CAT_POSE, CREAM, GOLD, INK, bubble, ell, fitFont, font, glow, label, paintBadge, paintBoss, paintBrother, paintCat, paintCushion,
  paintEye, paintFish, paintGrapes, paintGround, paintPaw, paintPest, paintSky, paintToy, paintToyCell, paintUpIcon, paintWall, rr,
  SERIF, type CatPose,
} from './paint';
import { RULES } from './rules';
import { starText, type CoachAt, type KotySim, type Loc, type SimEvent } from './sim';

export type Hit =
  | { kind: 'chest'; i: number } | { kind: 'slot'; i: number } | { kind: 'up'; id: BuyId } | { kind: 'paw' } | { kind: 'eye' }
  | { kind: 'vintage' } | { kind: 'yes' } | { kind: 'no' } | { kind: 'story' } | { kind: 'field'; x: number; y: number } | { kind: 'none' };

interface Toast { title: string; sub: string; color: string; t: number; dur: number }
interface Flyer { x: number; y: number; tx: number; ty: number; t: number; dur: number; gold: boolean }
export interface Drag { from: Loc; toy: Toy; x: number; y: number; moved: boolean }

const BUYS: readonly BuyId[] = ['aim', 'paws', 'bowl', 'toy'];

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
  private readonly reduced: boolean;
  drag: Drag | null = null;
  /** the card on screen (its box sizes to its words), for the vintage question's buttons */
  private cardBox: Rect | null = null;
  /** buttons held down (the index repeats purchases) */
  pressed: BuyId | null = null;

  private readonly simulated: boolean;

  constructor(canvas: HTMLCanvasElement, o: { reducedMotion: boolean; simulated?: boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('koty: no 2d context');
    this.ctx = ctx;
    this.reduced = o.reducedMotion;
    this.simulated = o.simulated ?? false;
    this.shake = new Shake(o.reducedMotion);
    this.L = layout(canvas.clientWidth || 800, canvas.clientHeight || 600, 120, this.simulated);
  }

  resize(w: number, h: number, dpr: number, hudTop: number): void {
    this.dpr = dpr;
    this.L = layout(w, h, hudTop, this.simulated);
    this.cacheKey = '';
    this.verse = null;
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
        if (e.boss || e.crit || Math.random() < 0.18) this.floats.add(big(e.dmg), p.x + (Math.random() - 0.5) * 16, p.y - L.s * 0.7, { color: e.crit ? GOLD : '#fff8e6', size: (e.crit ? 20 : e.boss ? 17 : 13) * u, dur: 0.75 });
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
          const tgt = { x: L.fish.x + L.fish.h * 0.45, y: L.fish.y + L.fish.h / 2 };
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
        else this.floats.add(t('hud.stage', { n: e.n }), L.bar.x + L.bar.w / 2, L.bar.y + L.bar.h * 2.2, { color: CREAM, size: 15 * u, dur: 1.1 });
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
          this.parts.burst(p.x, p.y - L.s, 30, { color: GOLD, size: 3.5, speed: 220, life: 1, g: 120, shape: 'spark' });
          for (let i = 0; i < 6; i++) this.flyers.push({ x: p.x + (Math.random() - 0.5) * 40, y: p.y - L.s, tx: L.fish.x + L.fish.h * 0.45, ty: L.fish.y + L.fish.h / 2, t: -i * 0.06, dur: 0.7, gold: true });
        }
        this.toastShow(t('hud.chased'), `${bossName(e.id)} ${starText(e.stars)}`, GOLD, 2.2);
        this.shake.add(0.45);
        break;
      }
      case 'bossBacks':
        this.toastShow(t('hud.backs', { name: bossName(e.id) }), '', '#ffd9b8', 1.8);
        break;
      case 'merge': {
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
            this.floats.add(t('hud.found', { name: c?.cat ? catName(c.cat) : '' }), r.x + r.w / 2, r.y - 22 * u, { color: GOLD, size: 13 * u, dur: 1.4 });
          }
        }
        break;
      }
      case 'full':
        this.floats.add(t('hud.full'), L.chest.x + L.chest.w / 2, L.chest.y - 8, { color: '#ffd0b8', size: 13 * u, dur: 1 });
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
        const x = L.field.x + Math.random() * L.field.w, y = L.field.y + L.field.h * (0.3 + Math.random() * 0.5);
        this.parts.burst(x, y, 5, { color: '#c9a2e8', size: 2.4, speed: 50, life: 0.9, g: -20 });
        this.floats.add(`+${big(e.v)}`, x, y, { color: '#e9dcff', size: 13 * u, dur: 1.2 });
        if (this.flyers.length < 14) this.flyers.push({ x, y, tx: L.fish.x + L.fish.h * 0.45, ty: L.fish.y + L.fish.h / 2, t: 0, dur: 0.8, gold: false });
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
        this.floats.add(who ? `${catName(who)} · ${t('hud.purr')}` : t('hud.purr'), s.x, s.y - L.cat * 1.1, { color: '#ffd0dc', size: 13 * u, dur: 1.1 });
        break;
      }
      case 'clap': {
        const p = toPx(L, e.x, e.y);
        this.floats.add(t('hud.psst'), p.x, p.y - 8, { color: CREAM, size: 13 * u, dur: 0.6 });
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

  private toastShow(title: string, sub: string, color: string, dur: number): void {
    this.toast = { title, sub, color, t: 0, dur };
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
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt / f.dur;
      if (f.t >= 1) {
        this.flyers.splice(i, 1);
        this.fishPop = 1;
      }
    }
    this.fishPop = Math.max(0, this.fishPop - dt * 3);
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
    const key = `${place}|${L.w}x${L.h}|${this.dpr}|${L.mode}`;
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
    if (L.mode !== 'short') {
      // the ground under the chest and the buttons
      const y0 = L.wall.y + L.wall.h;
      if (L.mode === 'tall') {
        const gr = g.createLinearGradient(0, y0, 0, L.h);
        gr.addColorStop(0, '#5c4330');
        gr.addColorStop(1, '#3a2a1e');
        g.fillStyle = gr;
        g.fillRect(0, y0, L.w, L.h - y0);
      } else {
        const x0 = L.field.x + L.field.w;
        const gr = g.createLinearGradient(x0, 0, L.w, 0);
        gr.addColorStop(0, '#5c4330');
        gr.addColorStop(1, '#3a2a1e');
        g.fillStyle = gr;
        g.fillRect(x0, 0, L.w - x0, L.h);
        g.fillStyle = '#3a2a1e';
        g.fillRect(0, y0, x0, L.h - y0);
      }
    } else {
      g.fillStyle = '#4a3626';
      g.fillRect(0, 0, L.field.x - 2, L.h);
      g.fillRect(L.field.x + L.field.w + 2, 0, L.w - L.field.x - L.field.w - 2, L.h);
    }
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
      const s = Math.max(40, L.s * b.spec.r * 2.8);
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
    for (const s of sim.shots) {
      const p = toPx(L, s.x, s.y);
      const g = sim.cushions[s.slot]?.toy?.g ?? 1;
      const r = Math.max(2.5, L.s * 0.1) * (1 + 0.06 * (g - 1));
      switch (s.pattern) {
        case 'pierce': {
          const o = toPx(L, s.sx, s.sy);
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
          const k = clamp(s.t);
          const lift = Math.sin(k * Math.PI) * L.s * 2.2;
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
    for (let i = 0; i < n; i++) {
      const c = sim.cushions[i];
      if (!c.spec) continue;
      const pos = this.catPos[i] ?? seat(L, i, n);
      const pop = this.cellPop.get(`slot${i}`) ?? 0;
      const look = this.lookOf(sim, i);
      const pose: CatPose = {
        ...CAT_POSE, look, alert: sim.alertLevel, gold: sim.golden, sleep: sim.napK, recoil: c.recoil, purr: c.purr > 0 ? 1 : 0,
        blink: this.blink[i] ?? 0, t: this.clock + i * 1.7, leap: c.leap ? 1 : 0,
      };
      const h = L.cat * (1 + pop * 0.12);
      paintCat(ctx, pos.x, pos.y, h, c.spec, pose);
      if (sim.napK > 0.6) {
        const k = (this.clock * 0.45 + i * 0.37) % 1;
        ctx.globalAlpha = (1 - k) * sim.napK;
        label(ctx, 'z', pos.x + h * (0.25 + k * 0.2), pos.y - h * (0.55 + k * 0.5), h * (0.18 + k * 0.1), '#e8f2ff', 'center', 900);
        ctx.globalAlpha = 1;
      }
      if (c.toy && sim.napK < 0.5 && !(this.drag && this.drag.from.kind === 'slot' && this.drag.from.i === i)) {
        paintToy(ctx, pos.x + h * 0.27, pos.y - h * 0.42, h * 0.42, c.toy.fam, c.toy.g, look * 0.8 - 0.25);
      }
      if (c.toy) paintBadge(ctx, seat(L, i, n).x - L.cat * 0.32, L.seatY + L.cat * 0.12, Math.max(6, L.cat * 0.12), c.toy.g);
      // on a wide wall each cat's name sits on the stones under its cushion
      if (L.mode === 'wide' && c.cat) {
        ctx.globalAlpha = 0.85;
        label(ctx, catName(c.cat), seat(L, i, n).x, L.seatY + L.cat * 0.3, Math.max(10, 11 * L.u), CREAM, 'center', 750);
        ctx.globalAlpha = 1;
      }
    }
    // the gatehouse's eye
    paintEye(ctx, L.eye.x, L.eye.y, L.eye.r, {
      value: sim.blind ? null : this.eyeV, mode: sim.blind ? 'dusk' : sim.restBlock ? 'nap' : 'alert', charge: sim.charge, ready: sim.huntReady && !sim.napping,
      ghost: sim.pushBlock && !sim.blind && sim.blockT < sim.leadIn && sim.reliable ? sim.level : null,
      mult: `×${f1(sim.alert)}`, t: this.clock, hunting: sim.hunting > 0,
    });
    const u = L.u;
    // in a nap the eye sleeps (a ready hunt waits for the next push)
    const lbl = sim.restBlock ? t('hud.nap') : sim.huntReady ? t('hud.huntReady') : sim.blind ? t('hud.dusk') : `×${f1(sim.alert)}`;
    label(ctx, lbl, L.eye.x, L.eye.y + L.eye.r * 1.32, Math.max(11, 13 * u), !sim.restBlock && (sim.huntReady || sim.golden) ? GOLD : CREAM);
    if (sim.pushBlock && !sim.blind && sim.blockT >= sim.leadIn) {
      // the threshold's name by its notch (once the band drives the eye)
      ctx.font = font(Math.max(9, 10 * u), 700);
      ctx.fillStyle = 'rgba(255,244,220,.85)';
      ctx.textAlign = 'center';
      ctx.fillText(t('hud.mark'), L.eye.x, L.eye.y - L.eye.r * 1.3);
    }
    // the hunt: the field glows gold
    if (sim.hunting > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, L.field.x + L.field.w / 2, L.field.y + L.field.h / 2, Math.max(L.field.w, L.field.h) * 0.7, 'rgba(255,214,110,', 0.12);
      ctx.restore();
    }
    this.parts.draw(ctx);
    this.floats.draw(ctx, SANS_FONT);
    // fish flying to the bowl
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const k = ease.outCubic(clamp(f.t));
      const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 40;
      paintFish(ctx, x, y, 6 * u, f.gold);
    }
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

  /** How much a place glows while a toy is dragged: a mate to merge with, or an empty place. */
  private dropHot(l: Loc, sim: KotySim): number {
    const d = this.drag;
    if (!d || !d.moved) return 0;
    if (d.from.kind === l.kind && d.from.i === l.i) return 0;
    const toy = sim.toyAt(l);
    if (toy && toy.g === d.toy.g && toy.g < RULES.grades) return 0.6 + 0.4 * Math.sin(this.clock * 8);
    if (!toy) return 0.25;
    return 0;
  }

  // ── the game's own HUD ──────────────────────────────────────────
  private drawHud(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u;
    this.drawBar(ctx, sim);
    // the fish in the bowl
    const fp = L.fish;
    rr(ctx, fp.x, fp.y, fp.w, Math.min(fp.h, 40 * u), 12 * u);
    ctx.fillStyle = 'rgba(30,20,14,.72)';
    ctx.fill();
    const fh = Math.min(fp.h, 40 * u);
    const fr = Math.min(fh * 0.3, 11 * u) * (1 + this.fishPop * 0.25);
    const vertical = fp.w < 64 * u;
    if (vertical) {
      paintFish(ctx, fp.x + fp.w / 2, fp.y + fh * 0.32, fr);
      fitAndFill(ctx, big(sim.p.fish), fp.x + fp.w / 2, fp.y + fh * 0.74, fp.w - 4, 12 * u, CREAM, 'center');
    } else {
      paintFish(ctx, fp.x + fr * 1.5, fp.y + fh / 2, fr);
      fitAndFill(ctx, big(sim.p.fish), fp.x + fr * 3, fp.y + fh / 2, fp.w - fr * 3.4, 16 * u, CREAM, 'left');
    }
    // the chest
    rr(ctx, L.chest.x - 5, L.chest.y - 5, L.chest.w + 10, L.chest.h + 10, 12);
    ctx.fillStyle = 'rgba(30,20,14,.5)';
    ctx.fill();
    for (let i = 0; i < RULES.chest; i++) {
      const r = cellRect(L, i);
      const toy = sim.p.chest[i];
      const pop = this.cellPop.get(`chest${i}`) ?? 0;
      const dragged = this.drag?.from.kind === 'chest' && this.drag.from.i === i && this.drag.moved;
      ctx.save();
      if (pop > 0) {
        const k = 1 + 0.15 * pop;
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.scale(k, k);
        ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      }
      paintToyCell(ctx, r.x, r.y, r.w, dragged ? null : toy, this.dropHot({ kind: 'chest', i }, sim), false);
      ctx.restore();
    }
    if (sim.gifts.length) {
      // gifts waiting for room: a parcel over the chest
      const x = L.chest.x + L.chest.w - 10, y = L.chest.y - 12;
      rr(ctx, x - 10, y - 10, 20, 16, 3);
      ctx.fillStyle = '#d9765f';
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - 2, y - 10, 4, 16);
      label(ctx, `${sim.gifts.length}`, x + 12, y - 8, 11 * u, GOLD);
    }
    // the buttons
    for (const id of BUYS) this.drawBuy(ctx, sim, id, L.ups[id]);
    this.drawPaw(ctx, sim);
    if (sim.vintageOpen) this.drawVintage(ctx, sim);
    // Brother Anselm and his line
    const br = L.brother, line = sim.talk.line;
    const talking = !!line && !sim.story && !sim.confirm;
    if (L.mode !== 'short' || talking) paintBrother(ctx, br.x, br.y, br.r, talking, this.clock);
    if (talking && line) {
      const fsz = Math.max(11, 13 * u);
      ctx.font = font(fsz, 650);
      const lines = wrapLines(ctx, line.text, br.maxW - 20);
      const w = Math.min(br.maxW, Math.max(...lines.map(s => ctx.measureText(s).width)) + 22);
      const h = lines.length * fsz * 1.25 + 14;
      const right = br.side === 'right';
      const bx = right ? br.x + br.r + 12 : Math.min(br.x + br.r + 8, L.field.x + L.field.w - w - 6);
      const by = right ? Math.max(L.field.y + 2, br.y - h / 2) : Math.max(L.field.y + 2, br.y - br.r - h - 4);
      const a = Math.min(1, line.t / 0.2, (line.dur - line.t) / 0.3);
      ctx.globalAlpha = clamp(a);
      // the bubble's tail points at his face: from its left edge (beside him) or its foot (above him)
      if (right) bubble(ctx, bx, by, w, h, br.x + br.r * 0.9, Math.max(by + h + 6, br.y + br.r * 0.6));
      else bubble(ctx, bx, by, w, h, br.x + br.r * 0.6, br.y - br.r * 0.8);
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((s, i) => ctx.fillText(s, bx + 11, by + 7 + i * fsz * 1.25));
      ctx.globalAlpha = 1;
    }
    // the dragged toy over everything
    const d = this.drag;
    if (d && d.moved) {
      const sz = L.cell * 1.05;
      ctx.globalAlpha = 0.92;
      paintToy(ctx, d.x, d.y - sz * 0.15, sz * 0.75, d.toy.fam, d.toy.g);
      paintBadge(ctx, d.x - sz * 0.3, d.y - sz * 0.45, sz * 0.15, d.toy.g);
      ctx.globalAlpha = 1;
    }
    // the toast
    const tt = this.toast;
    if (tt && !sim.story && !sim.confirm) {
      const k = tt.t / tt.dur;
      const a = Math.min(1, tt.t / 0.15, (tt.dur - tt.t) / 0.35);
      const pop = k < 0.12 ? ease.outBack(k / 0.12) : 1;
      const y = L.field.y + L.field.h * 0.3;
      ctx.globalAlpha = clamp(a);
      const size = Math.min(30 * u, L.field.w / Math.max(6, tt.title.length * 0.62)) * pop;
      label(ctx, tt.title, L.field.x + L.field.w / 2, y, size, tt.color);
      if (tt.sub) label(ctx, tt.sub, L.field.x + L.field.w / 2, y + size * 0.95, Math.max(11, size * 0.5), CREAM, 'center', 700);
      ctx.globalAlpha = 1;
    }
  }

  private drawBar(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u, b = L.bar;
    const info = sim.info;
    const boss = sim.boss && sim.boss.state !== 'away' ? sim.boss : null;
    rr(ctx, b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fillStyle = 'rgba(30,20,14,.66)';
    ctx.fill();
    const fz = Math.max(9, b.h * 0.62);
    if (boss) {
      // the chief: his courage (left) and his patience (right)
      const name = bossName(boss.id);
      const nw = Math.min(b.w * 0.42, 150 * u);
      fitAndFill(ctx, name, b.x + 10, b.y + b.h / 2, nw - 10, fz, '#ffd0b8', 'left');
      const cx = b.x + nw + 4, cw = b.w * 0.58 - nw + b.w * 0.22, ch = b.h * 0.42;
      rr(ctx, cx, b.y + (b.h - ch) / 2, cw, ch, ch / 2);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fill();
      rr(ctx, cx, b.y + (b.h - ch) / 2, Math.max(ch, cw * clamp(boss.hp / boss.max)), ch, ch / 2);
      ctx.fillStyle = '#ff8a5c';
      ctx.fill();
      const px = cx + cw + 8, pw = b.x + b.w - px - 10;
      if (pw > 20) {
        rr(ctx, px, b.y + (b.h - ch) / 2, pw, ch, ch / 2);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.fill();
        rr(ctx, px, b.y + (b.h - ch) / 2, Math.max(ch, pw * clamp(boss.patience / boss.patienceMax)), ch, ch / 2);
        ctx.fillStyle = sim.napping ? '#b8d4ff' : '#8fd0ff';
        ctx.fill();
      }
      return;
    }
    const left = `${t('hud.stage', { n: sim.p.stage })} · ${placeName(info.place.id)}`;
    const wave = sim.wave;
    const right = t('hud.wave', { left: Math.min(wave.chased, wave.all), all: wave.all });
    ctx.font = font(fz, 800);
    const rw = ctx.measureText(right).width;
    fitAndFill(ctx, left, b.x + 10, b.y + b.h / 2, b.w * 0.6 - 14, fz, CREAM, 'left');
    const px = b.x + b.w * 0.6, pw = b.w * 0.4 - rw - 22, ph = b.h * 0.36;
    if (pw > 16) {
      rr(ctx, px, b.y + (b.h - ph) / 2, pw, ph, ph / 2);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fill();
      rr(ctx, px, b.y + (b.h - ph) / 2, Math.max(ph, pw * clamp(wave.chased / Math.max(1, wave.all))), ph, ph / 2);
      ctx.fillStyle = info.boss ? '#ffb08a' : '#bfe08f';
      ctx.fill();
    }
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(right, b.x + b.w - 10, b.y + b.h / 2 + 0.5);
  }

  private drawBuy(ctx: CanvasRenderingContext2D, sim: KotySim, id: BuyId, r: Rect): void {
    const L = this.L, u = L.u;
    const cost = costOf(sim.p, id);
    const can = cost !== null && sim.p.fish >= cost && !(id === 'toy' && sim.chestFull);
    const pop = this.buyPop.get(id) ?? 0;
    ctx.save();
    const k = 1 + Math.max(0, pop) * 0.08 - (this.pressed === id ? 0.04 : 0);
    ctx.translate(r.x + r.w / 2 + (pop < 0 ? Math.sin(this.clock * 60) * 3 * -pop : 0), r.y + r.h / 2);
    ctx.scale(k, k);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    rr(ctx, r.x, r.y, r.w, r.h, 12 * u);
    ctx.fillStyle = can ? '#7a4f2f' : 'rgba(70,50,36,.8)';
    ctx.fill();
    ctx.strokeStyle = can ? 'rgba(255,214,140,.75)' : 'rgba(255,255,255,.15)';
    ctx.lineWidth = can ? 2 : 1;
    ctx.stroke();
    const p = sim.p;
    const name = t(`up.${id}` as 'up.aim');
    const fx = id === 'aim' ? t('up.aim.fx', { x: f1(aimMult(p.up.aim)) })
      : id === 'paws' ? t('up.paws.fx', { x: f1(pawsMult(p.up.paws)) })
        : id === 'bowl' ? t('up.bowl.fx', { x: f1(bowlMult(p.up.bowl)) })
          : t('up.toy.fx', { g: shopGrade(p) });
    const narrow = r.w < 96 * u || r.h < 46;
    const ir = Math.min(r.h * 0.22, 12 * u);
    ctx.globalAlpha = can ? 1 : 0.62;
    if (narrow && L.mode === 'tall') {
      // a phone upright: icon over the name, then the cost
      paintUpIcon(ctx, id, r.x + r.w / 2, r.y + r.h * 0.25, ir);
      fitAndFill(ctx, name, r.x + r.w / 2, r.y + r.h * 0.55, r.w - 6, 10.5 * u, CREAM, 'center', 750);
      this.cost(ctx, cost, r.x + r.w / 2, r.y + r.h * 0.82, r.w - 8, 10.5 * u, 'center');
    } else {
      paintUpIcon(ctx, id, r.x + ir + 8, r.y + r.h / 2, ir);
      const tx = r.x + ir * 2 + 14, tw = r.x + r.w - tx - 6;
      const lv = id === 'toy' ? '' : ` · ${t('hud.lvl', { n: p.up[id as 'aim'] })}`;
      fitAndFill(ctx, name + lv, tx, r.y + r.h * 0.3, tw, Math.min(13 * u, r.h * 0.3), CREAM, 'left', 800);
      fitAndFill(ctx, fx, tx, r.y + r.h * 0.55, tw, Math.min(10.5 * u, r.h * 0.24), 'rgba(255,240,210,.75)', 'left', 650);
      this.cost(ctx, cost, tx, r.y + r.h * 0.8, tw, Math.min(12 * u, r.h * 0.27), 'left');
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private cost(ctx: CanvasRenderingContext2D, cost: number | null, x: number, y: number, w: number, px: number, align: 'left' | 'center'): void {
    if (cost === null) {
      fitAndFill(ctx, t('hud.max'), x, y, w, px, GOLD, align);
      return;
    }
    const text = big(cost);
    ctx.font = font(px, 800);
    const tw = ctx.measureText(text).width;
    const fr = px * 0.45;
    const x0 = align === 'center' ? x - (tw + fr * 2.6) / 2 : x;
    paintFish(ctx, x0 + fr, y, fr);
    ctx.fillStyle = '#bfe6ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + fr * 2.6, y + 0.5);
  }

  private drawPaw(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, r = L.paw, u = L.u;
    const pop = Math.max(this.pawPop, this.nope * 0.5);
    ctx.save();
    ctx.translate(r.x + r.w / 2 + Math.sin(this.clock * 50) * 3 * this.nope, r.y + r.h / 2);
    ctx.scale(1 + pop * 0.06, 1 + pop * 0.06);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    rr(ctx, r.x, r.y, r.w, r.h, 12 * u);
    ctx.fillStyle = '#5a7a3a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,180,.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const pr = Math.min(r.h * 0.24, 13 * u);
    if (r.w < 96 * u) {
      paintPaw(ctx, r.x + r.w / 2, r.y + r.h * 0.38, pr, '#f6ffe6');
      fitAndFill(ctx, t('hud.paw'), r.x + r.w / 2, r.y + r.h * 0.8, r.w - 6, 10.5 * u, CREAM, 'center', 800);
    } else {
      paintPaw(ctx, r.x + pr + 10, r.y + r.h / 2, pr, '#f6ffe6');
      fitAndFill(ctx, `${t('hud.paw')}${L.mode === 'wide' ? ' · ␣' : ''}`, r.x + pr * 2 + 18, r.y + r.h / 2, r.w - pr * 2 - 22, 13 * u, CREAM, 'left', 800);
    }
    ctx.restore();
    void sim;
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
    const gr = Math.min(r.h * 0.3, 12 * u);
    paintGrapes(ctx, r.x + gr + 8, r.y + r.h * 0.55, gr);
    const tx = r.x + gr * 2 + 14, tw = r.x + r.w - tx - 6;
    fitAndFill(ctx, t('hud.vintage'), tx, r.y + r.h * 0.34, tw, Math.min(12 * u, r.h * 0.32), CREAM, 'left', 800);
    fitAndFill(ctx, t('hud.vintageGo', { n: big(sim.vintageNow) }), tx + 12 * u, r.y + r.h * 0.72, tw - 12 * u, Math.min(12 * u, r.h * 0.32), GOLD, 'left', 800);
    paintFish(ctx, tx + 5 * u, r.y + r.h * 0.72, 5 * u, true);
  }

  // ── cards ───────────────────────────────────────────────────────
  private drawCards(ctx: CanvasRenderingContext2D, sim: KotySim): void {
    const L = this.L, u = L.u;
    const st = sim.story, cf = sim.confirm;
    if (!st && !cf) { this.cardBox = null; return; }
    ctx.fillStyle = 'rgba(20,12,8,.45)';
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
    // measure first: the card is as tall as what it says (at most the layout's card)
    const max = L.card, pad = 18 * u;
    const icon = st?.kind === 'open' ? 0 : 30 * u;
    const ts = fitFont(ctx, title, max.w - pad * 2, 24 * u, 14, 600);
    const bodySize = Math.max(11, Math.min(15 * u, max.h / 14));
    ctx.font = font(bodySize, 600);
    const lines = wrapLines(ctx, text, max.w - pad * 2);
    const lineH = bodySize * 1.32;
    const foot = (cf ? 58 : 28) * u;
    let verseH = 0;
    if (verseId) {
      const room = Math.max(40, max.h - pad - icon - ts * 1.35 - lines.length * lineH - 8 * u - foot);
      const key = `${verseId}|${max.w}|${room}`;
      if (!this.verse || this.verse.key !== key) this.verse = { key, layout: layoutPassage(ctx, passage(verseId), max.w - pad * 2, room, { max: 15 * u, min: 10 }) };
      verseH = this.verse.layout.height + 8 * u;
    }
    const need = pad + icon + ts * 1.35 + lines.length * lineH + 8 * u + verseH + foot;
    const ch = Math.min(max.h, need);
    const c: Rect = { x: max.x, y: max.y + (max.h - ch) / 2, w: max.w, h: ch };
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
    ctx.font = `600 ${ts}px ${SERIF}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, c.x + c.w / 2, y);
    y += ts * 1.35;
    ctx.font = font(bodySize, 600);
    const fit = Math.max(2, Math.floor((c.y + c.h - foot - verseH - y) / lineH));
    ctx.fillStyle = '#4a3528';
    lines.slice(0, fit).forEach((line, i) => ctx.fillText(line, c.x + c.w / 2, y + i * lineH));
    y += Math.min(lines.length, fit) * lineH + 8 * u;
    if (verseId && this.verse) drawPassage(ctx, passage(verseId), this.verse.layout, c.x + c.w / 2, y, { text: '#5a3e6e', ref: '#8a6a50' });
    if (cf) {
      const { yes, no } = this.confirmButtons(c);
      rr(ctx, yes.x, yes.y, yes.w, yes.h, 12 * u);
      ctx.fillStyle = '#6b3f7a';
      ctx.fill();
      fitAndFill(ctx, t('vintage.yes'), yes.x + yes.w / 2, yes.y + yes.h / 2, yes.w - 10, 15 * u, GOLD, 'center', 800);
      rr(ctx, no.x, no.y, no.w, no.h, 12 * u);
      ctx.fillStyle = '#a08060';
      ctx.fill();
      fitAndFill(ctx, t('vintage.no'), no.x + no.w / 2, no.y + no.h / 2, no.w - 10, 15 * u, CREAM, 'center', 800);
    } else {
      ctx.font = font(Math.max(10, 12 * u), 700);
      ctx.fillStyle = '#a07a58';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t('story.tap'), c.x + c.w / 2, c.y + c.h - 10 * u);
    }
    ctx.globalAlpha = 1;
  }

  /** The vintage question's two buttons inside its card. */
  private confirmButtons(c: Rect): { yes: Rect; no: Rect } {
    const u = this.L.u, pad = 18 * u, bw = (c.w - pad * 3) / 2, bh = 40 * u, by = c.y + c.h - pad - bh;
    return { yes: { x: c.x + pad, y: by, w: bw, h: bh }, no: { x: c.x + pad * 2 + bw, y: by, w: bw, h: bh } };
  }

  // ── hit tests and points ────────────────────────────────────────
  hit(x: number, y: number, sim: KotySim): Hit {
    const L = this.L;
    if (sim.confirm) {
      const { yes, no } = this.confirmButtons(this.cardBox ?? L.card);
      if (inRect(yes, x, y, 4)) return { kind: 'yes' };
      if (inRect(no, x, y, 4)) return { kind: 'no' };
      return { kind: 'none' };
    }
    if (sim.story) return { kind: 'story' };
    for (let i = 0; i < RULES.chest; i++) if (inRect(cellRect(L, i), x, y, 2)) return { kind: 'chest', i };
    for (const id of BUYS) if (inRect(L.ups[id], x, y)) return { kind: 'up', id };
    if (inRect(L.paw, x, y)) return { kind: 'paw' };
    if (sim.vintageOpen && inRect(L.vintage, x, y)) return { kind: 'vintage' };
    if (Math.hypot(x - L.eye.x, y - L.eye.y) <= L.eye.r * 1.2) return { kind: 'eye' };
    const n = sim.cushions.length;
    for (let i = 0; i < n; i++) {
      const s = seat(L, i, n);
      if (Math.abs(x - s.x) <= L.cat * 0.45 && y <= s.y + L.cat * 0.25 && y >= s.y - L.cat * 1.05) return { kind: 'slot', i };
    }
    if (inRect(L.field, x, y)) return { kind: 'field', x: (x - L.field.x) / L.sx, y: (y - L.field.y) / L.sy };
    return { kind: 'none' };
  }

  /** The canvas point a coach mark points at. */
  pointFor(at: CoachAt, sim: KotySim): { x: number; y: number } {
    const L = this.L;
    switch (at.kind) {
      case 'field': return toPx(L, at.x, at.y);
      case 'chest': { const r = cellRect(L, at.i); return { x: r.x + r.w / 2, y: r.y + 2 }; }
      case 'slot': { const s = seat(L, at.i, sim.cushions.length || 1); return { x: s.x, y: s.y - L.cat * 0.95 }; }
      case 'up': { const r = L.ups[at.id]; return { x: r.x + r.w / 2, y: r.y + 2 }; }
      case 'paw': return { x: L.paw.x + L.paw.w / 2, y: L.paw.y + 2 };
      case 'vintage': return { x: L.vintage.x + L.vintage.w / 2, y: L.vintage.y + L.vintage.h };
      case 'eye': return { x: L.eye.x, y: L.eye.y - L.eye.r * 1.1 };
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

  /** Where on the toys a point is (a chest cell or an open cushion), for a drop. */
  locAt(x: number, y: number, sim: KotySim): Loc | null {
    const h = this.hit(x, y, sim);
    if (h.kind === 'chest') return { kind: 'chest', i: h.i };
    if (h.kind === 'slot') return { kind: 'slot', i: h.i };
    // a drop near a cat counts (fingers are wide)
    const L = this.L, n = sim.cushions.length;
    for (let i = 0; i < n; i++) {
      const s = seat(L, i, n);
      if (Math.hypot(x - s.x, y - (s.y - L.cat * 0.4)) <= L.cat * 0.75) return { kind: 'slot', i };
    }
    return null;
  }

  pawPressed(): void { this.pawPop = 1; }
}

const SANS_FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';

/** Text fitted into a width (the font shrinks to 8 px), with a soft edge where it sits on art. */
function fitAndFill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, px: number, color: string, align: CanvasTextAlign, weight = 800): void {
  const size = fitFont(ctx, text, Math.max(10, maxW), px, 8, weight);
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

/** For the debug view: what a toy is called with its grade. */
export const toyLabel = (toy: Toy): string => `${famName(toy.fam)} ${toy.g} (${gradeName(toy.g)})`;
