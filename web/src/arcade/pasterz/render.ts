/**
 * Pasterz's play view, all on the canvas: the hill seen from above (the grass painted once per
 * pasture into a ground layer; tufts, anemones, the stream's shimmer, rocks, thorn bushes and
 * terrace walls drawn live), the footprints behind the shepherd coloured by the band (gold above
 * the threshold, blue in a night, dotted grey without signal, veiled at dusk and revealed after),
 * the call ring around him (its radius is the level, a dotted circle marks the threshold, gold
 * beyond it), the sheep sorted by depth, the fold and its count, the night with its fire and its
 * stars, the compass marks at the screen's edge, and the HUD (hud.ts) on top.  It only reads the
 * sim (sim.ts); the calibration scene is intro.ts.
 *
 * The camera follows the shepherd with a little look-ahead, never past the hill's edge.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { LAMBS } from './content';
import type { Sheep } from './flock';
import { Hud } from './hud';
import { sheep as sheepText, t } from './i18n';
import { PasterzIntro } from './intro';
import { layout, type Layout } from './layout';
import type { PasterzProgress } from './meta';
import { C, SANS, font, hash, paintBush, paintFire, paintFold, paintRock, paintSheep, paintShepherd, paintStar, paintWall, type SheepPose } from './paint';
import { RING_MARK, RULES, type PasterzSim, type SimEvent } from './sim';

const TAU = Math.PI * 2;
/** the ground layer's resolution (px per metre) and the margin painted around the hill (m) */
const G = 12;
const MARGIN = 6;

const TXT = {
  join: t('fx.join'), voice: t('fx.voice'), voiceSub: t('fx.voiceSub'), snag: t('fx.snag'), free: t('fx.free'), lamb: t('fx.lamb'),
  carry: t('fx.carry'), dawn: t('fx.dawn'), foldTitle: t('fold.title'), fold: t('bar.fold'), all: t('fold.all'), next: t('fold.next'),
  foldMark: t('hint.fold'),
};

interface Ripple { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
type Drawable = { y: number; k: 0 | 1 | 3; i: number };

export class PasterzView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  L: Layout = layout(1280, 800);
  readonly hud: Hud;
  private readonly intro0 = new PasterzIntro();
  private clock = 0;
  private camX = 0;
  private camY = 0;
  private camReady = false;
  private ground: HTMLCanvasElement | null = null;
  private groundSeed = -1;
  private readonly parts = new Particles(500);
  private readonly ripples: Ripple[] = [];
  private readonly pops = new Map<number, number>();
  private readonly snags = new Set<number>();
  private lastBaa = -1;
  private fade = 0;
  private foldA = 0;
  private starPop = 0;
  private lambBell: string | null = null;
  private readonly shake: Shake;
  private readonly draws: Drawable[] = [];
  private readonly rnd = Math.random;
  private walkA = 0;
  private started = false;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx, opts.eeg);
    this.hud.resize(this.L);
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h);
    this.hud.resize(this.L);
  }

  start(): void {
    this.started = true;
    this.fade = 1;
  }

  intro(dt: number, p: number, progress: PasterzProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  // ── world ↔ screen ──────────────────────────────────────────────
  private get S(): number { return this.L.S; }
  sx(x: number): number { return this.L.cx + (x - this.camX) * this.S; }
  sy(y: number): number { return this.L.cy + (y - this.camY) * this.S; }
  /** A point of the screen (CSS px) on the hill (m). */
  toWorld(x: number, y: number): { x: number; y: number } {
    return { x: this.camX + (x - this.L.cx) / this.S, y: this.camY + (y - this.L.cy) / this.S };
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: PasterzSim): void {
    const u = this.L.u, rm = this.opts.reducedMotion, sh = sim.shepherd;
    switch (e.type) {
      case 'join': {
        this.pops.set(e.id, 0);
        this.parts.burst(e.x, e.y, rm ? 3 : 8, { color: C.wool, size: 0.09, speed: 1.6, g: 0, drag: 3, life: 0.6, rnd: this.rnd });
        if (this.clock - this.lastBaa > 0.18) {
          this.lastBaa = this.clock;
          this.hud.float(e.via === 'morning' ? t('lambs', { n: 1 }) : TXT.join, this.sx(e.x), this.sy(e.y) - 18 * u, e.via === 'voice' ? C.goldDeep : C.ink, 13, 0.9, 26);
        }
        this.hud.popScore();
        break;
      }
      case 'call':
        this.ripples.push({ x: sh.x, y: sh.y, t: 0, dur: RULES.callSec, r0: sim.ring, r1: sim.ring * 1.45, color: 'rgba(255,250,232,', width: 3 });
        break;
      case 'voice':
        for (let i = 0; i < 3; i++) this.ripples.push({ x: sh.x, y: sh.y, t: -i * 0.18, dur: 1.5, r0: sim.ring, r1: Math.hypot(this.w, this.h) / this.S, color: 'rgba(255,214,110,', width: 5 - i });
        this.hud.toast(TXT.voice, TXT.voiceSub, C.goldDeep);
        this.shake.add(0.25);
        break;
      case 'snag':
        this.snags.add(e.id);
        this.hud.float(TXT.snag, this.sx(e.x), this.sy(e.y) - 20 * u, C.thorn, 13, 1);
        this.parts.burst(e.x, e.y, rm ? 2 : 6, { color: C.bushLight, size: 0.06, speed: 1.2, g: 0, drag: 3, life: 0.5, shape: 'square', rnd: this.rnd });
        break;
      case 'free':
        this.snags.delete(e.id);
        this.pops.set(e.id, 0);
        this.hud.float(TXT.free, this.sx(e.x), this.sy(e.y) - 20 * u, '#4f7a2a', 13, 1);
        this.parts.burst(e.x, e.y, rm ? 3 : 10, { color: C.gold, size: 0.05, speed: 2, g: 0, drag: 3, life: 0.6, shape: 'spark', rnd: this.rnd });
        break;
      case 'lambFound':
        this.hud.float(TXT.lamb, this.sx(e.x), this.sy(e.y) - 30 * u, C.goldDeep, 20, 1.6, 40);
        this.hud.toast(TXT.lamb, TXT.carry, C.goldDeep);
        this.parts.burst(e.x, e.y, rm ? 5 : 22, { color: C.gold, size: 0.07, speed: 2.6, g: 0, drag: 2.5, life: 0.9, shape: 'spark', rnd: this.rnd });
        this.shake.add(0.2);
        break;
      case 'pastureEnd':
        this.foldA = 0;
        this.hud.toast(TXT.foldTitle, TXT.fold, C.goldDeep);
        break;
      case 'folded':
        this.hud.popCount();
        this.parts.burst(e.x, e.y, rm ? 2 : 5, { color: C.wool, size: 0.08, speed: 1.4, g: 0, drag: 3, life: 0.5, rnd: this.rnd });
        break;
      case 'step':
        this.hud.flashStep();
        this.shake.add(0.12);
        break;
      case 'lambNamed': {
        const l = LAMBS[e.index];
        this.lambBell = l.bell;
        this.hud.toast(e.isNew ? t('lamb.named', { name: l.name }) : t('lamb.home', { name: l.name }), TXT.carry, C.ink, l.bell);
        break;
      }
      case 'pastureDone': {
        const f = sim.fold;
        if (f) {
          this.hud.float(e.all ? TXT.all : sheepText(e.folded), this.sx(f.x), this.sy(f.y) - 70 * u, C.goldDeep, 22, 1.8, 30);
          if (!rm) for (const col of [C.gold, C.cream, '#c8553d']) this.parts.burst(f.x, f.y, 14, { color: col, size: 0.08, speed: 4, g: 0, drag: 2, life: 1.2, shape: 'square', rnd: this.rnd });
        }
        this.shake.add(0.2);
        break;
      }
      case 'newPasture':
        this.fade = 1;
        this.camReady = false;
        this.snags.clear();
        this.pops.clear();
        this.ripples.length = 0;
        this.parts.clear();
        this.lambBell = null;
        this.hud.toast(TXT.next, t('bar.pasture', { n: e.index + 1 }), C.ink);
        break;
      case 'blockEnd':
        if (e.block.kind !== 'warmup') this.hud.blockCard(sim, e.block.kind, e.block.blind, e.verdict, e.share, e.need, e.t0, e.t1, e.stars);
        break;
      case 'star':
        this.starPop = 1;
        break;
      case 'morning':
        this.hud.toast(t('card.morning', { lambs: t('lambs', { n: e.n }) }), t('card.watch.pass'), '#3f6aa8');
        break;
      case 'flare':
        this.ripples.push({ x: sh.x, y: sh.y, t: 0, dur: RULES.flareSec, r0: RULES.r0, r1: e.r, color: 'rgba(255,214,110,', width: 6 });
        this.hud.float(TXT.dawn, this.sx(sh.x), this.sy(sh.y) - 46 * u, '#6a4fa0', 17, 1.6, 34);
        break;
      case 'mission':
        this.hud.toast(t('card.mission', { name: MISSION_NAME(e.id) }), '', C.goldDeep);
        break;
      case 'gift':
        this.hud.toast(t('card.gift', { sheep: sheepText(e.n) }), '', C.goldDeep);
        break;
      case 'hundred':
        this.hud.toast(t('card.hundred', { n: e.season + 1 }), '', C.goldDeep);
        break;
      default:
        break;
    }
  }

  /** A tap on the hill: a small ring where the shepherd is going. */
  tapAt(x: number, y: number): void {
    this.ripples.push({ x, y, t: 0, dur: 0.45, r0: 0.15, r1: 0.7, color: 'rgba(255,250,232,', width: 2.5 });
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: PasterzSim): void {
    this.clock += dt;
    const sh = sim.shepherd, H = sim.hill, S = this.S;
    sim.viewW = this.w / 2 / S;
    sim.viewH = this.h / 2 / S;
    // the camera: the shepherd with a little look-ahead, never past the hill's edge
    let tx = sh.x + sh.vx * 0.35, ty = sh.y + sh.vy * 0.35;
    const hw = this.w / 2 / S, hh = this.h / 2 / S;
    tx = H.w > 2 * hw ? clamp(tx, hw - 1, H.w - hw + 1) : H.w / 2;
    ty = H.h > 2 * hh ? clamp(ty, hh - 3, H.h - hh + 1) : H.h / 2;
    const x0 = this.camX, y0 = this.camY;
    if (!this.camReady) {
      this.camX = tx;
      this.camY = ty;
      this.camReady = true;
    } else {
      this.camX = approach(this.camX, tx, dt, 0.28);
      this.camY = approach(this.camY, ty, dt, 0.28);
    }
    this.hud.shiftFloats(-(this.camX - x0) * S, -(this.camY - y0) * S);
    this.parts.update(dt);
    let n = 0;
    for (const r of this.ripples) if ((r.t += dt) < r.dur) this.ripples[n++] = r;
    this.ripples.length = n;
    for (const [id, a] of this.pops) {
      if (a + dt > 0.5) this.pops.delete(id);
      else this.pops.set(id, a + dt);
    }
    this.fade = Math.max(0, this.fade - dt * 1.4);
    this.starPop = Math.max(0, this.starPop - dt * 1.5);
    this.foldA = sim.fold ? Math.min(1, this.foldA + dt * 2.5) : 0;
    this.walkA = approach(this.walkA, clamp(sh.speed / 2), dt, 0.1);
    this.hud.update(dt, sim);
  }

  draw(sim: PasterzSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, S = this.S;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 6);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawGround(sim);
    this.drawDetails(sim);
    this.drawPrints(sim);
    for (const w of sim.hill.walls) paintWall(ctx, w, S, x => this.sx(x), y => this.sy(y));
    if (sim.fold) paintFold(ctx, this.sx(sim.fold.x), this.sy(sim.fold.y), S, Math.atan2(sim.fold.gy, sim.fold.gx), ease.outBack(this.foldA));
    this.drawRing(sim);
    const goal = sim.shepherd.goal;
    if (goal && sim.handsFree) {
      ctx.strokeStyle = 'rgba(255,250,232,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.sx(goal.x), this.sy(goal.y), S * 0.18, 0, TAU);
      ctx.stroke();
    }
    this.drawLamb(sim);
    this.drawSorted(sim);
    this.drawMarks(sim);
    // particles in world units
    ctx.save();
    ctx.translate(this.sx(0), this.sy(0));
    ctx.scale(S, S);
    this.parts.draw(ctx);
    ctx.restore();
    this.drawRipples(sim);
    this.drawNight(sim);
    ctx.restore();
    this.drawCompass(sim);
    if (sim.fold) this.hud.drawCount(sim, this.sx(sim.fold.x), this.sy(sim.fold.y) - (RULES.foldR + 1.2) * S);
    this.hud.draw(sim);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(246,239,220,${ease.inOutSine(this.fade) * 0.85})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // ── the ground ──────────────────────────────────────────────────
  private drawGround(sim: PasterzSim): void {
    const ctx = this.ctx, H = sim.hill;
    if (this.groundSeed !== H.seed || !this.ground) this.paintGround(sim);
    ctx.fillStyle = '#7f8f4a';
    ctx.fillRect(0, 0, this.w, this.h);
    if (this.ground) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.ground, this.sx(-MARGIN), this.sy(-MARGIN), (H.w + 2 * MARGIN) * this.S, (H.h + 2 * MARGIN) * this.S);
    }
  }

  /** The grass, its patches of dry earth and lush green, the terraces' shadows, the stream: once per pasture. */
  private paintGround(sim: PasterzSim): void {
    const H = sim.hill;
    this.groundSeed = H.seed;
    const W = (H.w + 2 * MARGIN) * G, Hh = (H.h + 2 * MARGIN) * G;
    const c = this.ground ?? document.createElement('canvas');
    c.width = W;
    c.height = Hh;
    this.ground = c;
    const g = c.getContext('2d');
    if (!g) return;
    const X = (x: number) => (x + MARGIN) * G;
    g.fillStyle = C.grass;
    g.fillRect(0, 0, W, Hh);
    // a gentle light across the slope: lighter uphill (north), deeper downhill
    const slope = g.createLinearGradient(0, 0, W * 0.3, Hh);
    slope.addColorStop(0, 'rgba(255,248,210,.16)');
    slope.addColorStop(1, 'rgba(40,60,20,.14)');
    g.fillStyle = slope;
    g.fillRect(0, 0, W, Hh);
    for (const p of H.patches) {
      const col = p.tone < 0.45 ? '215,196,140' : p.tone < 0.8 ? '147,171,88' : '194,199,127';
      const rg = g.createRadialGradient(X(p.x), X(p.y), 0, X(p.x), X(p.y), p.r * G);
      rg.addColorStop(0, `rgba(${col},.55)`);
      rg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = rg;
      g.fillRect(X(p.x - p.r), X(p.y - p.r), p.r * 2 * G, p.r * 2 * G);
    }
    // the terraces: a step of deeper green below each wall, a lit lip above it
    for (const w of H.walls) {
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(70,90,40,.2)';
      g.lineWidth = 1.6 * G;
      g.beginPath();
      g.moveTo(X(w.x0), X(w.y0) + 0.9 * G);
      g.lineTo(X(w.x1), X(w.y1) + 0.9 * G);
      g.stroke();
      g.strokeStyle = 'rgba(255,250,215,.14)';
      g.lineWidth = 0.7 * G;
      g.beginPath();
      g.moveTo(X(w.x0), X(w.y0) - 0.55 * G);
      g.lineTo(X(w.x1), X(w.y1) - 0.55 * G);
      g.stroke();
      g.restore();
    }
    // speckles: the grass's grain
    let seed = H.seed;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(70,86,34,.18)' : 'rgba(240,236,190,.16)';
      g.fillRect(rnd() * W, rnd() * Hh, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    // the stream: banks, water, a light edge
    const line = (dy: number) => {
      g.beginPath();
      for (let x = -MARGIN; x <= H.w + MARGIN; x += 0.5) {
        const y = H.streamY(x) + dy;
        if (x === -MARGIN) g.moveTo(X(x), X(y));
        else g.lineTo(X(x), X(y));
      }
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = C.bank;
    g.lineWidth = (RULES.streamHalf * 2 + 1) * G;
    line(0.1);
    g.stroke();
    g.strokeStyle = '#5d8c9c';
    g.lineWidth = RULES.streamHalf * 2 * G;
    line(0);
    g.stroke();
    g.strokeStyle = C.water;
    g.lineWidth = RULES.streamHalf * 1.4 * G;
    line(-0.08);
    g.stroke();
    g.strokeStyle = 'rgba(200,232,236,.45)';
    g.lineWidth = 0.12 * G;
    line(-RULES.streamHalf * 0.55);
    g.stroke();
    // the hill's edge fades into deeper scrub
    g.strokeStyle = 'rgba(80,96,44,.55)';
    g.lineWidth = MARGIN * G * 1.2;
    g.strokeRect(0, 0, W, Hh);
  }

  /** Grass tufts, anemones and pebbles in the cells in view; the stream's shimmer and the fords' stones. */
  private drawDetails(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S, H = sim.hill;
    const x0 = Math.floor(this.camX - this.w / 2 / S) - 1, x1 = Math.ceil(this.camX + this.w / 2 / S) + 1;
    const y0 = Math.floor(this.camY - this.h / 2 / S) - 1, y1 = Math.ceil(this.camY + this.h / 2 / S) + 1;
    const cell = 1.4;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, S * 0.035);
    for (let cy = Math.floor(y0 / cell); cy <= y1 / cell; cy++) {
      for (let cx = Math.floor(x0 / cell); cx <= x1 / cell; cx++) {
        const k = (cx * 73856093) ^ (cy * 19349663) ^ H.seed;
        const r = hash(k);
        const wx = (cx + hash(k + 1)) * cell, wy = (cy + hash(k + 2)) * cell;
        if (wx < 0 || wy < 0 || wx > H.w || wy > H.h) continue;
        if (Math.abs(wy - H.streamY(wx)) < RULES.streamHalf + 0.5) continue;
        const px = this.sx(wx), py = this.sy(wy);
        if (r < 0.5) {
          ctx.strokeStyle = r < 0.25 ? 'rgba(96,112,52,.75)' : 'rgba(205,210,140,.7)';
          ctx.beginPath();
          for (let i = -1; i <= 1; i++) {
            ctx.moveTo(px + i * S * 0.06, py);
            ctx.lineTo(px + i * S * 0.12 + Math.sin(this.clock * 1.5 + k) * S * 0.02, py - S * (0.16 + 0.05 * (1 - Math.abs(i))));
          }
          ctx.stroke();
        } else if (r < 0.56) {
          // a red anemone of the spring hills
          ctx.fillStyle = '#c63a2c';
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            ctx.beginPath();
            ctx.arc(px + Math.cos(a) * S * 0.05, py + Math.sin(a) * S * 0.05, S * 0.045, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#2b1c22';
          ctx.beginPath();
          ctx.arc(px, py, S * 0.025, 0, TAU);
          ctx.fill();
        } else if (r < 0.6) {
          ctx.fillStyle = r < 0.58 ? '#fff4d6' : '#f2cf4a';
          ctx.beginPath();
          ctx.arc(px, py, S * 0.035, 0, TAU);
          ctx.fill();
        } else if (r < 0.66) {
          ctx.fillStyle = 'rgba(214,204,176,.85)';
          ctx.beginPath();
          ctx.ellipse(px, py, S * 0.07, S * 0.05, r * 9, 0, TAU);
          ctx.fill();
        }
      }
    }
    // the stream's shimmer
    ctx.strokeStyle = 'rgba(225,245,248,.55)';
    ctx.lineWidth = Math.max(1, S * 0.03);
    for (let x = Math.max(0, x0); x <= Math.min(H.w, x1); x += 1.1) {
      const ph = (this.clock * 0.7 + x * 0.37) % 1;
      const wx = x + ph * 0.8, wy = H.streamY(wx) + Math.sin(x * 3.1) * RULES.streamHalf * 0.45;
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      ctx.beginPath();
      ctx.moveTo(this.sx(wx), this.sy(wy));
      ctx.lineTo(this.sx(wx + 0.35), this.sy(wy));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const f of H.fords) {
      for (const st of f.stones) {
        const px = this.sx(st.x), py = this.sy(st.y), r = st.r * S;
        ctx.fillStyle = 'rgba(40,70,80,.35)';
        ctx.beginPath();
        ctx.ellipse(px + r * 0.15, py + r * 0.25, r, r * 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = C.stone;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 0.82, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,240,.5)';
        ctx.beginPath();
        ctx.ellipse(px - r * 0.25, py - r * 0.25, r * 0.4, r * 0.25, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ── the history on the ground: footprints ───────────────────────
  private drawPrints(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S, samples = sim.trace.samples, now = sim.t;
    if (!sim.prints.length) return;
    let j = 0;
    for (const p of sim.prints) {
      const age = now - p.t;
      if (age > sim.trace.windowSec) continue;
      const a = age < 30 ? 1 : Math.max(0, 1 - (age - 30) / 10);
      while (j < samples.length - 1 && samples[j + 1].t <= p.t) j++;
      const s = samples[j];
      const px = this.sx(p.x), py = this.sy(p.y);
      if (px < -20 || py < -20 || px > this.w + 20 || py > this.h + 20) continue;
      let col = 'rgba(64,78,34,', glow = false, dots = false, alpha = 0.5;
      if (!s || s.t > p.t + 0.3) { /* before the first sample: plain */ }
      else if (s.veiled) { col = 'rgba(84,72,110,'; alpha = 0.55; }
      else if (!s.reliable) dots = true;
      else if (s.phase === 'rest') { col = 'rgba(96,142,214,'; alpha = 0.8; }
      else if (s.activity !== null && s.activity >= s.threshold) { col = 'rgba(236,170,30,'; alpha = 0.95; glow = true; }
      let reveal = 1;
      if (s && s.revealedAt !== null) reveal = clamp((now - s.revealedAt) / 1.2);
      if (dots) {
        ctx.fillStyle = `rgba(120,116,104,${0.6 * a})`;
        for (const k of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(px + Math.cos(p.dir) * k * S * 0.06, py + Math.sin(p.dir) * k * S * 0.06, Math.max(0.8, S * 0.025), 0, TAU);
          ctx.fill();
        }
        continue;
      }
      if (glow && reveal > 0) {
        ctx.fillStyle = `rgba(255,214,110,${0.16 * a * reveal})`;
        ctx.beginPath();
        ctx.arc(px, py, S * 0.13, 0, TAU);
        ctx.fill();
      }
      if (reveal < 1) {
        // the veil lifting: dusk-purple fading into the print's own colour
        ctx.fillStyle = `rgba(84,72,110,${0.55 * a * (1 - reveal)})`;
        this.sole(px, py, p.dir, S);
      }
      ctx.fillStyle = `${col}${alpha * a * reveal})`;
      this.sole(px, py, p.dir, S);
    }
  }

  /** A sandal's print: the sole and the heel. */
  private sole(x: number, y: number, dir: number, S: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(dir) * S * 0.03, y + Math.sin(dir) * S * 0.03, S * 0.062, S * 0.032, dir, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - Math.cos(dir) * S * 0.065, y - Math.sin(dir) * S * 0.065, S * 0.032, S * 0.027, dir, 0, TAU);
    ctx.fill();
  }

  // ── the call ring: the live gauge ───────────────────────────────
  private drawRing(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S, sh = sim.shepherd;
    const x = this.sx(sh.x), y = this.sy(sh.y);
    const r = sim.ringR * S, mark = RING_MARK * S;
    const look = sim.ringLook;
    const gold = look === 'live' && sim.ringR >= RING_MARK;
    ctx.save();
    // the ground inside the ring, faintly lit
    const fill = look === 'live' ? (gold ? 'rgba(255,214,110,.13)' : 'rgba(255,248,225,.1)') : look === 'rest' ? 'rgba(170,200,245,.08)' : 'rgba(255,248,225,.05)';
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // the threshold: a dotted circle (only where the ring can answer the band)
    if (look === 'live' || look === 'grey') {
      ctx.setLineDash([2, 7]);
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = look === 'live' ? 'rgba(255,250,232,.8)' : 'rgba(220,216,206,.45)';
      ctx.beginPath();
      ctx.arc(x, y, mark, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the ring itself, slowly turning
    const col = gold ? C.gold : look === 'live' ? 'rgba(255,250,232,.95)' : look === 'grey' ? 'rgba(206,200,190,.6)'
      : look === 'rest' ? 'rgba(170,200,245,.6)' : look === 'blind' ? 'rgba(130,112,165,.5)' : 'rgba(255,250,232,.75)';
    if (gold) {
      ctx.shadowColor = 'rgba(255,200,80,.85)';
      ctx.shadowBlur = 12;
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = gold ? 4 : 3;
    const seg = Math.max(8, (TAU * r) / 32);
    ctx.setLineDash([seg * 0.86, seg * 0.14]);
    ctx.lineDashOffset = this.opts.reducedMotion ? 0 : -this.clock * 14;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    // the flare after a blind block
    if (sim.flareT > 0) {
      const k = sim.flareT / RULES.flareSec;
      ctx.strokeStyle = `rgba(255,214,110,${0.9 * k})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(255,200,80,.9)';
      ctx.shadowBlur = 16 * k;
      ctx.beginPath();
      ctx.arc(x, y, sim.ring * S, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // ── the lost lamb, hidden among its rocks ───────────────────────
  private drawLamb(sim: PasterzSim): void {
    const l = sim.lamb;
    if (l.state === 'carried') return;
    const x = this.sx(l.x), y = this.sy(l.y);
    if (x < -40 || y < -40 || x > this.w + 40 || y > this.h + 40) return;
    const bleat = l.bleat > 0 ? 1 : 0;
    paintSheep(this.ctx, x, y, this.S, -0.6, {
      small: true, bob: this.clock * 2, walking: bleat * 0.4, lie: l.state === 'home' ? 0 : 1, look: bleat, graze: 0,
      bell: l.state === 'home' ? this.lambBell ?? undefined : undefined,
    });
  }

  // ── the bodies, sorted by depth ─────────────────────────────────
  private drawSorted(sim: PasterzSim): void {
    const S = this.S, H = sim.hill, d = this.draws, m = 2 * S;
    d.length = 0;
    const vis = (x: number, y: number) => {
      const px = this.sx(x), py = this.sy(y);
      return px > -m && py > -m && px < this.w + m && py < this.h + m;
    };
    H.circles.forEach((c, i) => { if (vis(c.x, c.y)) d.push({ y: c.y + c.r * 0.3, k: 0, i }); });
    sim.sheep.forEach((s, i) => { if (vis(s.x, s.y)) d.push({ y: s.y, k: 1, i }); });
    if (sim.fire) d.push({ y: sim.fire.y - 0.2, k: 3, i: 0 });
    d.sort((a, b) => a.y - b.y);
    const ctx = this.ctx;
    for (const o of d) {
      if (o.k === 0) {
        const c = H.circles[o.i];
        if (c.kind === 'rock') paintRock(ctx, this.sx(c.x), this.sy(c.y), c.r, c.seed, S);
        else paintBush(ctx, this.sx(c.x), this.sy(c.y), c.r, c.seed, S, this.clock);
      } else if (o.k === 1) this.drawSheep(sim.sheep[o.i]);
      else if (sim.fire) paintFire(ctx, this.sx(sim.fire.x), this.sy(sim.fire.y), S, this.clock, clamp(sim.night * 1.5));
    }
    // the shepherd over his flock, always in sight (Crowd City's leader)
    const sh = sim.shepherd;
    paintShepherd(ctx, this.sx(sh.x), this.sy(sh.y), S * 1.5, sh.dir, sh.stepT, this.walkA, sh.carrying);
  }

  private readonly pose: SheepPose = { small: false, bob: 0, walking: 0, lie: 0, look: 0, graze: 0 };

  private drawSheep(s: Sheep): void {
    const ctx = this.ctx, S = this.S, p = this.pose;
    const sp = Math.hypot(s.vx, s.vy);
    p.small = s.small;
    p.bob = s.stepT;
    p.walking = clamp(sp / 1.2);
    p.lie = s.lie;
    p.look = clamp(s.look * 2);
    p.graze = s.state === 'graze' && sp < 0.15 ? 1 : 0;
    p.bell = undefined;
    const x = this.sx(s.x), y = this.sy(s.y);
    const pop = this.pops.get(s.id);
    if (pop !== undefined) {
      const k = pop / 0.5;
      const sc = 1 + 0.35 * Math.sin(Math.PI * k) * (1 - k * 0.5);
      ctx.save();
      ctx.translate(x, y - Math.sin(Math.PI * k) * S * 0.3);
      ctx.scale(sc, sc);
      paintSheep(ctx, 0, 0, S, s.dir, p);
      ctx.restore();
    } else paintSheep(ctx, x, y, S, s.dir, p);
  }

  /** Over the bodies: the thorn badge of a snagged sheep, the look-up marks. */
  private drawMarks(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S, u = this.L.u;
    for (const s of sim.sheep) {
      if (s.state !== 'snag') continue;
      const x = this.sx(s.x), y = this.sy(s.y) - S * 0.75 - Math.abs(Math.sin(this.clock * 5)) * 3 * u;
      ctx.fillStyle = 'rgba(255,248,230,.95)';
      ctx.strokeStyle = C.thorn;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 9 * u, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3a4220';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 5 * u, y + 3 * u);
      ctx.lineTo(x + 5 * u, y - 3 * u);
      for (const k of [-0.5, 0, 0.5]) {
        ctx.moveTo(x + k * 8 * u, y - k * 5 * u);
        ctx.lineTo(x + k * 8 * u - 2 * u, y - k * 5 * u - 4 * u);
      }
      ctx.stroke();
    }
  }

  private drawRipples(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S;
    for (const r of this.ripples) {
      if (r.t < 0) continue;
      const k = r.t / r.dur;
      const rad = (r.r0 + (r.r1 - r.r0) * ease.outCubic(k)) * S;
      ctx.strokeStyle = `${r.color}${(1 - k) * 0.85})`;
      ctx.lineWidth = r.width * (1 - k * 0.5);
      ctx.beginPath();
      ctx.arc(this.sx(r.x), this.sy(r.y), rad, 0, TAU);
      ctx.stroke();
    }
    void sim;
  }

  // ── the night ───────────────────────────────────────────────────
  private drawNight(sim: PasterzSim): void {
    const n = sim.night;
    if (n < 0.01) return;
    const ctx = this.ctx, S = this.S, L = this.L;
    // dusk is violet, the night deep blue
    const k = clamp((n - 0.3) / 0.5);
    const r = 70 + (16 - 70) * k, g = 46 + (24 - 46) * k, b = 96 + (58 - 96) * k;
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.62 * n})`;
    ctx.fillRect(-10, -10, this.w + 20, this.h + 20);
    if (sim.fire) {
      const fx = this.sx(sim.fire.x), fy = this.sy(sim.fire.y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flick = 1 + Math.sin(this.clock * 11) * 0.04 + Math.sin(this.clock * 7.3) * 0.03;
      const rg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 5 * S * flick);
      rg.addColorStop(0, `rgba(255,170,80,${0.42 * n})`);
      rg.addColorStop(0.4, `rgba(220,120,50,${0.16 * n})`);
      rg.addColorStop(1, 'rgba(200,100,40,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(fx - 6 * S, fy - 6 * S, 12 * S, 12 * S);
      ctx.restore();
      paintFire(ctx, fx, fy, S, this.clock, clamp(n * 1.5));
    }
    // the sleeping lambs' Zzz
    if (n > 0.5) {
      ctx.font = font(800, 11 * L.u, SANS);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(220,230,255,${(n - 0.5) * 1.6})`;
      for (const s of sim.sheep) {
        if (!s.asleep) continue;
        const ph = (this.clock * 0.6 + hash(s.id) ) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * (n - 0.5) * 2;
        ctx.fillText(ph < 0.5 ? 'z' : 'Z', this.sx(s.x) + ph * 10 * L.u, this.sy(s.y) - S * 0.5 - ph * 16 * L.u);
      }
      ctx.globalAlpha = 1;
    }
    // the stars, one by one with calm (only in the night itself)
    if (sim.nightBlock || sim.stars > 0) {
      const top = L.hudBottom + 16 * L.u, bot = Math.max(top + 60, this.h * 0.42);
      for (let i = 0; i < RULES.starMax; i++) {
        const x = 24 + hash(i * 3 + 11) * (this.w - 48), y = top + hash(i * 5 + 7) * (bot - top);
        const lit = i < sim.stars;
        const tw = 0.85 + 0.15 * Math.sin(this.clock * 2 + i);
        const pop = lit && i === sim.stars - 1 ? this.starPop : 0;
        paintStar(ctx, x, y, (lit ? 5 : 2.5) * L.u * (1 + pop * 0.8), (lit ? tw : 0.25) * k);
      }
    }
  }

  // ── the compass marks at the screen's edge ──────────────────────
  private drawCompass(sim: PasterzSim): void {
    const f = sim.fold;
    if (f && sim.stage === 'fold') this.mark(f.gateX, f.gateY, C.gold, TXT.foldMark, 'fold');
    if (sim.compassT > 0 && sim.lamb.state === 'hidden') this.mark(sim.lamb.x, sim.lamb.y, C.cream, '', 'lamb', Math.min(1, sim.compassT));
  }

  /** A mark over a place of the hill, or at the screen's edge pointing to it. */
  private mark(wx: number, wy: number, color: string, label: string, kind: 'fold' | 'lamb', a = 1): void {
    const ctx = this.ctx, L = this.L, u = L.u;
    const x = this.sx(wx), y = this.sy(wy);
    const top = L.hudBottom + 22 * u, bot = this.h - 66 - 22 * u, left = 26 * u, right = this.w - 26 * u;
    const inside = x > left && x < right && y > top && y < bot;
    ctx.save();
    ctx.globalAlpha = a;
    const bob = Math.sin(this.clock * 5) * 4 * u;
    if (inside) {
      // a chevron bouncing over it
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(58,40,20,.6)';
      ctx.lineWidth = 1.5;
      const yy = y - 30 * u + bob;
      ctx.beginPath();
      ctx.moveTo(x - 9 * u, yy - 8 * u);
      ctx.lineTo(x + 9 * u, yy - 8 * u);
      ctx.lineTo(x, yy + 4 * u);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const cx = this.w / 2, cy = (top + bot) / 2;
      const dx = x - cx, dy = y - cy;
      const k = Math.min((right - cx) / Math.max(1e-6, Math.abs(dx)), (bot - cy) / Math.max(1e-6, Math.abs(dy)));
      const ex = cx + dx * k, ey = cy + dy * k, ang = Math.atan2(dy, dx);
      ctx.translate(ex, ey);
      ctx.fillStyle = 'rgba(246,239,220,.94)';
      ctx.strokeStyle = color === C.cream ? C.goldDeep : color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 17 * u, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color === C.cream ? C.goldDeep : color;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 26 * u, Math.sin(ang) * 26 * u);
      ctx.lineTo(Math.cos(ang + 0.45) * 18 * u, Math.sin(ang + 0.45) * 18 * u);
      ctx.lineTo(Math.cos(ang - 0.45) * 18 * u, Math.sin(ang - 0.45) * 18 * u);
      ctx.closePath();
      ctx.fill();
      if (kind === 'lamb') paintSheep(ctx, 0, 1 * u, 26 * u, -Math.PI / 2, { small: true, bob: 0, walking: 0, lie: 0, look: 1, graze: 0 });
      else {
        ctx.strokeStyle = C.rockDark;
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.arc(0, 0, 8 * u, -Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6 + TAU);
        ctx.stroke();
      }
      if (label) {
        ctx.font = font(750, 10.5 * u, SANS);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,250,235,.9)';
        const ly = ey > cy ? -36 * u : 22 * u;
        ctx.strokeText(label, 0, ly);
        ctx.fillStyle = C.ink;
        ctx.fillText(label, 0, ly);
      }
    }
    ctx.restore();
  }
}

/** A mission's name for its toast. */
const MISSION_NAME = (id: string): string => t(`mission.${id}` as 'mission.lamb');
