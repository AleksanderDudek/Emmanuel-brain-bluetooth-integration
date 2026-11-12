/**
 * Motylarnia's picture: a camera over the garden that follows the caterpillar's head and zooms out
 * as it grows (as in the original), the lawn, beds and hedge, the food, the rivals and the birds
 * (with their swoop shadows), the caterpillar itself, and around its head the band's thing: the
 * appetite circle (Apetyt), its radius the reach, a dotted ring at the threshold, its rim gold
 * beyond it, food streaking in.  Over the world: the twig with the waiting chrysalises (their
 * colours deepen with calm in a siesta), the flowerbed strip with the last 40 s, Hieronim and his
 * bubble, an arrow to the rare flower, the side goal's pill, the cards, the hatching butterflies and
 * the juice (particles, floating words, shake).  The runner's standard HUD (the Mendi panel, the
 * score) sits on top; the play keeps below it and the passive things (Hieronim, the side goal's pill, the
 * twig) sit in the band right under it, out of the thumb's way (layout.ts, mobile first).  On a touch
 * screen the floating stick is drawn where the thumb steers (stick.ts).  Every word at 11 px and up,
 * everything to read at 13 and up.
 */
import { passage } from '../../content/scripture';
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import { MIN_READ, fitText } from '../kit/mobile';
import type { Insets } from '../kit/types';
import { LAG_SEC, traceBars } from '../kit/trace';
import {
  drawButterfly, drawChrysalis, paintWing, spriteOfRecord, wingMidY, type ButterflySprite, type ChrysalisLook, type WingBitmap,
} from './butterfly';
import { PIGMENTS, capital, gardenAt, speciesById, type Species } from './content';
import { drawBird, drawBubble, drawDecor, drawFlowerbed, drawHedge, drawSnail, drawSwoop, foodSprite, gardenDecor, lawnTile, type Decor } from './garden';
import { t } from './i18n';
import { buildLeaf } from './leaf';
import { camAt, computeLayout, gardenCardBox, openCard, toScreen, toWorld, zoomFor, type Camera, type Layout, type OpenCard, type Rect } from './layout';
import { INK, PAPER, SANS, SERIF, darken, font, fontPx, rgba, roundRect } from './paint';
import { drawCaterpillar, type BodyPoint } from './paint';
import { REACH_MARK, RULES } from './rules';
import type { Chrysalis, MothSim, SimEvent, Worm } from './sim';
import { decodePath } from './wing';
import { MothIntro } from './intro';
import type { StickState } from './stick';

const TAU = Math.PI * 2;

interface Flier { s: ButterflySprite; sp: Species; x: number; y: number; vx: number; vy: number; t: number; size: number }

/** The side goal in words with its count ("3/5 kwiaty"). */
export function sideText(sim: MothSim): string {
  const g = sim.garden;
  if (g.side === 'rare') return t('side.rare');
  const done = Math.min(sim.sideCount, g.n);
  const word = t(g.side === 'curl' ? 'side.curl' : g.side === 'dew' ? 'side.dew' : 'side.flowers', { n: g.n });
  return `${done}/${word}`;
}

export class MothView {
  readonly particles = new Particles(600);
  readonly floaters = new Floaters();
  private readonly shake: Shake;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly intro0 = new MothIntro();
  L: Layout = computeLayout(1, 1, 0);
  private w = 1;
  private h = 1;
  private dpr = 1;
  readonly cam: Camera = { x: RULES.worldW / 2, y: RULES.worldH / 2, z: 1 };
  private clock = 0;
  private decor: Decor[] = [];
  private decorFor = -1;
  private munch = 0;
  private flash = 0;
  private scared = 0;
  private dust = 0;
  private fliers: Flier[] = [];
  private readonly wings = new Map<number, { pale: WingBitmap; deep: WingBitmap }>();
  private readonly arrive = new Map<number, number>();
  /** the opening card as laid out for this screen */
  private open: OpenCard | null = null;
  /** the floating stick under the thumb (touch), as the game holds it */
  stick: StickState | null = null;
  private readonly curlPts: BodyPoint[] = Array.from({ length: 140 }, () => ({ x: 0, y: 0 }));
  private goldT = 0;

  constructor(readonly canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean; touch: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, insets: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = computeLayout(w, h, insets);
    this.open = null;
    this.particles.clear();
    this.floaters.items.length = 0;
  }

  intro(dt: number, p: number, sp: Species): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(ctx, this.w, this.h, dt, p, sp, this.dpr);
  }

  start(sim: MothSim): void {
    const h = sim.player.segs[0];
    this.cam.x = h.x;
    this.cam.y = h.y;
    this.cam.z = zoomFor(this.L, sim.len);
  }

  /** The head's place on the screen (CSS px). */
  headScreen(sim: MothSim): { x: number; y: number } {
    const h = sim.player.segs[0];
    return this.worldToScreen(h.x, h.y);
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const s = toScreen(this.L, this.cam, x, y, { x: 0, y: 0 });
    return s;
  }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    return toWorld(this.L, this.cam, x, y, { x: 0, y: 0 });
  }

  /** Where the twig's first chrysalis hangs (CSS px): the coach mark for the siesta. */
  twigSpot(): { x: number; y: number } {
    const tw = this.L.twig;
    return { x: tw.x1 - tw.len * 0.8, y: tw.y + tw.len * 0.9 };
  }

  update(dt: number, sim: MothSim): void {
    this.clock += dt;
    this.particles.update(dt);
    this.floaters.update(dt);
    this.munch = Math.max(0, this.munch - dt * 5);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.scared = Math.max(0, this.scared - dt * 0.8);
    if (sim.phase === 'finale' || sim.phase === 'done') this.goldT = Math.min(1, this.goldT + dt * 0.6);
    // the camera follows the head (looking a little ahead), zooms out as it grows
    const h = sim.player.segs[0], ahead = 40;
    const tx = h.x + Math.cos(sim.player.dir) * ahead, ty = h.y + Math.sin(sim.player.dir) * ahead;
    const k = 1 - Math.exp(-dt / 0.18);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.z += (zoomFor(this.L, sim.len) - this.cam.z) * (1 - Math.exp(-dt / 0.8));
    // never show much more than the hedge beyond the garden
    const P = this.L.play, z = this.cam.z, over = RULES.hedge * 2.5;
    const hw = P.w / 2 / z, up = (P.h * this.L.anchor) / z, down = (P.h * (1 - this.L.anchor)) / z;
    this.cam.x = RULES.worldW + 2 * over > 2 * hw ? clamp(this.cam.x, hw - over, RULES.worldW - hw + over) : RULES.worldW / 2;
    this.cam.y = RULES.worldH + 2 * over > up + down ? clamp(this.cam.y, up - over, RULES.worldH - down + over) : RULES.worldH / 2;
    // a sprint kicks up dust behind the tail
    if (sim.sprinting && sim.player.curl <= 0) {
      this.dust -= dt;
      if (this.dust <= 0) {
        this.dust = 0.05;
        const tail = sim.player.segs[sim.player.segs.length - 1], s = this.worldToScreen(tail.x, tail.y);
        this.particles.burst(s.x, s.y, 2, { color: sim.freeSprint ? '#FFE07A' : 'rgba(240,230,200,.8)', speed: 40, life: 0.5, g: -10, size: 2.5 });
      }
    }
    for (const f of this.fliers) {
      f.t += dt;
      f.x += f.vx * dt + Math.sin(f.t * 3) * 20 * dt;
      f.y += f.vy * dt;
      f.vy -= 8 * dt;
    }
    this.fliers = this.fliers.filter(f => f.t < 5 && f.y > -80);
    for (const [id, v] of this.arrive) this.arrive.set(id, Math.min(1, v + dt * 1.6));
  }

  on(e: SimEvent, sim: MothSim): void {
    const fl = this.floaters, P = this.particles;
    const at = (x: number, y: number) => this.worldToScreen(x, y);
    switch (e.type) {
      case 'eat': {
        this.munch = 1;
        const s = at(e.x, e.y);
        const col = e.kind === 'flower' || e.kind === 'rare' ? PIGMENTS[Math.max(0, e.pig) % 5].color : e.kind === 'dew' ? '#BFE6FF' : '#8DC35A';
        P.burst(s.x, s.y, e.kind === 'rare' ? 30 : e.kind === 'flower' ? 10 : 4, { color: col, speed: e.kind === 'rare' ? 200 : 90, life: 0.6, g: 60, size: e.kind === 'rare' ? 4 : 2.5 });
        if (e.kind === 'rare' || e.kind === 'flower' || (e.mult > 1 && e.chain % 3 === 0)) {
          fl.add(`+${e.pts}${e.mult > 1 ? ` ×${e.mult}` : ''}`, s.x, s.y - 14, { color: e.mult >= 3 ? '#FFD34D' : '#FFFBEF', size: e.kind === 'rare' ? 30 : 18 + 2 * e.mult, dur: 0.9 });
        }
        break;
      }
      case 'moult': {
        const s = this.headScreen(sim);
        fl.add(t('fl.moult'), s.x, s.y - 30, { color: '#FFF2B0', size: 24 });
        P.burst(s.x, s.y, 18, { color: '#FFF6D0', speed: 120, life: 0.7, g: 0, shape: 'ring', size: 4 });
        break;
      }
      case 'stumble': {
        const s = this.headScreen(sim);
        this.shake.add(0.45);
        this.flash = 0.6;
        P.burst(s.x, s.y, 16, { color: '#E9E1C8', speed: 160, life: 0.6, g: 200, size: 3 });
        fl.add(t(e.cause === 'self' ? 'fl.self' : e.cause === 'bird' ? 'fl.peck' : 'fl.stumble'), s.x, s.y - 26, { color: '#FFE3D6', size: 26 });
        break;
      }
      case 'curl': {
        const s = at(e.x, e.y);
        this.shake.add(0.25);
        P.burst(s.x, s.y, 24, { color: '#FFE07A', speed: 180, life: 0.7, g: 80, shape: 'spark', size: 3 });
        fl.add(`${t('fl.curl')} +${e.pts}`, s.x, s.y - 20, { color: '#FFE07A', size: 24 });
        break;
      }
      case 'near': {
        const s = at(e.x, e.y);
        fl.add(t('fl.near'), s.x, s.y - 36, { color: '#D8F2FF', size: 22 });
        break;
      }
      case 'peck': {
        const s = at(e.x, e.y);
        P.burst(s.x, s.y, 10, { color: '#B49A6E', speed: 110, life: 0.5, g: 150, size: 2.5 });
        if (e.hit) this.scared = 1;
        break;
      }
      case 'swoop': this.scared = Math.max(this.scared, 0.6); break;
      case 'side': fl.add(t('fl.side'), this.w / 2, this.L.play.y + this.L.play.h * 0.3, { color: '#FFE07A', size: 30, dur: 1.6 }); break;
      case 'goal': {
        const s = at(e.x, e.y);
        this.shake.add(0.2);
        fl.add(t('fl.goal'), s.x, s.y - 50, { color: '#FFF2B0', size: 34, dur: 1.6 });
        fl.add('★'.repeat(e.stars) + '☆'.repeat(3 - e.stars), s.x, s.y - 14, { color: '#FFD34D', size: 34, dur: 1.8 });
        P.burst(s.x, s.y, 40, { color: '#FFF4C8', speed: 220, life: 1, g: 40, shape: 'spark', size: 3 });
        break;
      }
      case 'spun': this.arrive.set(e.c.id, 0); break;
      case 'feast': {
        const s = at(e.x, e.y);
        fl.add(t('fl.feast'), s.x, s.y - 40, { color: '#FFE07A', size: 32, dur: 1.5 });
        P.burst(s.x, s.y, 36, { color: '#FFF0A0', speed: 200, life: 0.9, g: 0, shape: 'spark', size: 3 });
        break;
      }
      case 'hatch': {
        const rec = sim.p.butterflies.find(r => r.id === e.b.rec.id);
        const tw = this.L.twig, x = tw.x1 - (e.slot + 0.8) * tw.len * 0.95, y = tw.y + tw.len;
        if (rec) {
          const size = Math.max(22, Math.min(46, this.L.zoom * 34)) * (0.8 + 0.1 * e.b.cls);
          this.fliers.push({ s: spriteOfRecord(rec, size * this.dpr * 1.2), sp: e.b.sp, x, y, vx: -40 - 30 * Math.random(), vy: -40, t: 0, size });
        }
        const words = [capital(e.b.sp.name)];
        if (e.b.isNew) words.push(t('fl.new'));
        if (e.b.radiant) words.push(t('fl.radiant'));
        fl.add(words.join(' · '), Math.min(this.w - 140, Math.max(140, x - 60)), y + 30, { color: e.b.radiant ? '#FFE07A' : '#FFFBEF', size: 20, dur: 2.4 });
        P.burst(x, y, 24, { color: '#FFFFFF', speed: 120, life: 0.9, g: -20, shape: 'spark', size: 2.5 });
        break;
      }
      default: break;
    }
  }

  // ── drawing ────────────────────────────────────────────────────
  draw(sim: MothSim): void {
    const ctx = this.ctx, L = this.L, dpr = this.dpr;
    if (!sim.started) return;
    if (this.decorFor !== sim.gardenIndex) {
      this.decor = gardenDecor(sim.gardenIndex);
      this.decorFor = sim.gardenIndex;
    }
    const sh = this.shake.offset(1 / 60, 10);
    const z = this.cam.z, c = camAt(L), cx = c.x + sh.x, cy = c.y + sh.y;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cx - this.cam.x * z), dpr * (cy - this.cam.y * z));
    const x0 = this.cam.x - cx / z, x1 = this.cam.x + (this.w - cx) / z, y0 = this.cam.y - cy / z, y1 = this.cam.y + (this.h - cy) / z;
    this.drawWorld(ctx, sim, x0, y0, x1, y1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawOverlay(ctx, sim);
  }

  private drawWorld(ctx: CanvasRenderingContext2D, sim: MothSim, x0: number, y0: number, x1: number, y1: number): void {
    const g = sim.garden, now = this.clock;
    // the lawn
    const pat = ctx.createPattern(lawnTile(g), 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(Math.max(0, x0), Math.max(0, y0), Math.min(RULES.worldW, x1) - Math.max(0, x0), Math.min(RULES.worldH, y1) - Math.max(0, y0));
    }
    for (const d of this.decor) {
      if (d.x + d.w < x0 - 40 || d.x - 40 > x1 || d.y + 80 < y0 || d.y - 80 > y1) continue;
      drawDecor(ctx, d, g);
    }
    drawHedge(ctx, x0, y0, x1, y1);
    // the swoop shadows under everything that moves
    for (const b of sim.birds) if (b.state === 'warn') drawSwoop(ctx, b.px, b.py, RULES.peckR, clamp(b.timer / RULES.swoopWarn), now);
    // food
    const head = sim.player.segs[0], reachR = sim.reach + sim.girth;
    const showReach = sim.block.kind === 'push' && !sim.blind && (sim.phase === 'play' || sim.phase === 'spin');
    if (showReach) this.drawReach(ctx, sim, head.x, head.y, reachR);
    for (const f of sim.food) {
      if (f.x < x0 - 30 || f.x > x1 + 30 || f.y < y0 - 30 || f.y > y1 + 30) continue;
      const spr = foodSprite(f.kind, f.pig);
      const bob = f.kind === 'dew' ? Math.sin(now * 3 + f.id) * 0.08 : 0;
      const pop = Math.min(1, f.age * 4);
      let r = f.r * (1 + bob) * (0.4 + 0.6 * ease.outBack(pop));
      if (f.kind === 'rare') {
        r *= 1 + 0.08 * Math.sin(now * 4);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r * 4);
        gl.addColorStop(0, 'rgba(255,240,170,.55)');
        gl.addColorStop(1, 'rgba(255,240,170,0)');
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 4, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      if (f.pulled) {
        ctx.strokeStyle = 'rgba(255,236,150,.55)';
        ctx.lineWidth = 2;
        const dx = head.x - f.x, dy = head.y - f.y, d = Math.hypot(dx, dy) || 1;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x - (dx / d) * 14, f.y - (dy / d) * 14);
        ctx.stroke();
      }
      const rot = f.kind === 'leaf' ? (f.id * 1.7) % TAU : f.kind === 'rare' ? now * 0.4 : 0;
      if (rot) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(rot);
        ctx.drawImage(spr, -r * 1.33, -r * 1.33, r * 2.67, r * 2.67);
        ctx.restore();
      } else ctx.drawImage(spr, f.x - r * 1.33, f.y - r * 1.33, r * 2.67, r * 2.67);
    }
    // rivals
    for (const r of sim.rivals) {
      if (r.away > 0 && r.curl <= 0) continue;
      const rh = r.segs[0];
      if (rh.x < x0 - 400 || rh.x > x1 + 400 || rh.y < y0 - 400 || rh.y > y1 + 400) continue;
      this.drawWorm(ctx, r, speciesById(r.sp), now, 0, false, r.curl > 0 ? 1 - r.curl / 0.8 : 0);
    }
    // the player
    const p = sim.player, sp = speciesById(p.sp);
    if (sim.phase === 'spin') this.drawSpin(ctx, sim, sp);
    else {
      const k = p.curl > 0 ? Math.sin((1 - p.curl / RULES.curlSec) * Math.PI) : 0;
      const blink = p.safe > 0 && p.curl <= 0 ? 0.55 + 0.45 * Math.sin(now * 20) : 1;
      ctx.globalAlpha = blink;
      // a soft light under the player, so it reads among rivals
      ctx.fillStyle = `rgba(255,250,220,${(0.18 + 0.25 * sim.depth).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, sim.girth * 2.2, 0, TAU);
      ctx.fill();
      this.drawWorm(ctx, p, sp, now, sim.sprinting && sim.freeSprint ? 1 : 0.15 + 0.5 * sim.depth, true, k);
      ctx.globalAlpha = 1;
      if (p.curl <= 0) this.drawAim(ctx, sim);
    }
    // birds above everything on the ground
    for (const b of sim.birds) {
      if (b.state === 'roost') continue;
      if (b.state === 'warn') {
        // the bird drops in from the sky in the last third of the warning
        const k = clamp((b.timer / RULES.swoopWarn - 0.6) / 0.4);
        if (k > 0) drawBird(ctx, b.px, b.py - (1 - k) * 160, b.dir, RULES.birdR * 2.4 * (2 - k), 1, 0);
        continue;
      }
      const hop = b.state === 'walk' && b.hop > 0.25 ? Math.abs(Math.sin(b.timer * 9)) : 0;
      drawBird(ctx, b.x, b.y, b.dir, RULES.birdR * 2.4, b.state === 'peck' ? 0.7 : 0, hop);
    }
  }

  private drawReach(ctx: CanvasRenderingContext2D, sim: MothSim, x: number, y: number, r: number): void {
    const mark = REACH_MARK + sim.girth, over = sim.reach >= REACH_MARK, now = this.clock;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,240,170,0)');
    g.addColorStop(1, over ? 'rgba(255,214,90,.22)' : 'rgba(255,250,230,.14)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // the threshold: dots on a ring
    ctx.fillStyle = over ? 'rgba(255,214,90,.95)' : 'rgba(255,255,245,.9)';
    const n = Math.max(16, Math.round(mark / 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + now * 0.15;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * mark, y + Math.sin(a) * mark, 2.4, 0, TAU);
      ctx.fill();
    }
    // the rim: gold beyond the threshold
    ctx.strokeStyle = over ? '#FFD34D' : 'rgba(255,252,240,.75)';
    ctx.lineWidth = over ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    if (over) {
      ctx.strokeStyle = 'rgba(255,214,90,.35)';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, TAU);
      ctx.stroke();
    }
  }

  /** A caterpillar; `curl` 0..1 rolls it into a spiral round its head. */
  private drawWorm(ctx: CanvasRenderingContext2D, w: Worm, sp: Species, now: number, glow: number, player: boolean, curl: number): void {
    const segs = w.segs, n = Math.min(segs.length, this.curlPts.length);
    let pts: readonly BodyPoint[] = segs;
    const g = Math.min(RULES.girth[2], RULES.girth[0] + RULES.girth[1] * segs.length);
    if (curl > 0.01) {
      const h = segs[0], e = ease.inOutSine(clamp(curl));
      for (let i = 0; i < n; i++) {
        const a = i * 0.55 + w.dir, rr = g * (0.4 + i * 0.16);
        const q = this.curlPts[i];
        q.x = segs[i].x + (h.x + Math.cos(a) * rr - segs[i].x) * e;
        q.y = segs[i].y + (h.y + Math.sin(a) * rr - segs[i].y) * e;
      }
      pts = this.curlPts;
    }
    if (!player) {
      // rivals wear a darker outline so they read as "not you"
      ctx.strokeStyle = 'rgba(40,25,10,.35)';
      ctx.lineWidth = g * 2.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    drawCaterpillar(ctx, pts, g, sp.larva, player ? this.munch : 0.3 + 0.3 * Math.sin(now * 6 + w.id), now, glow, n, this.dpr * this.cam.z);
  }

  /** A small chevron ahead of the head toward where it is turning. */
  private drawAim(ctx: CanvasRenderingContext2D, sim: MothSim): void {
    const p = sim.player, h = p.segs[0], g = sim.girth, a = p.want;
    const d = g * 2.6 + 6;
    const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.strokeStyle = 'rgba(255,255,245,.7)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(1, 0);
    ctx.lineTo(-5, 6);
    ctx.stroke();
    ctx.restore();
  }

  /** The goal: the caterpillar curls up and silk wraps it into a chrysalis. */
  private drawSpin(ctx: CanvasRenderingContext2D, sim: MothSim, sp: Species): void {
    const k = clamp(sim.spinT / RULES.spinSec), p = sim.player, h = p.segs[0];
    this.drawWorm(ctx, p, sp, this.clock, 1, true, Math.min(1, k * 2.2));
    const wrap = clamp((k - 0.35) / 0.65), g = sim.girth;
    if (wrap > 0) {
      ctx.fillStyle = `rgba(250,246,232,${(0.85 * wrap).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, g * (1.6 + 1.6 * (1 - wrap)), g * (2.6 + 1.4 * (1 - wrap)), 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 10 * wrap; i++) {
        const a = i * 0.7 + this.clock * 4;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, g * 2.4, g * 0.9, a, 0, TAU);
        ctx.stroke();
      }
    }
  }

  // ── the overlay (screen space) ─────────────────────────────────
  private drawOverlay(ctx: CanvasRenderingContext2D, sim: MothSim): void {
    const L = this.L, w = this.w, h = this.h;
    const rest = sim.block.kind === 'rest' && sim.phase === 'play';
    if (rest) {
      // the siesta: a warm noon haze
      ctx.fillStyle = 'rgba(255,246,214,.12)';
      ctx.fillRect(0, 0, w, h);
    }
    if (sim.blind) {
      const gm = ctx.createRadialGradient(w / 2, L.play.y + L.play.h / 2, Math.min(w, h) * 0.2, w / 2, L.play.y + L.play.h / 2, Math.max(w, h) * 0.7);
      gm.addColorStop(0, 'rgba(245,245,240,0)');
      gm.addColorStop(1, 'rgba(245,245,240,.55)');
      ctx.fillStyle = gm;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,120,90,${(0.18 * this.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.goldT > 0) {
      ctx.fillStyle = `rgba(255,170,70,${(0.22 * this.goldT).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    this.drawRareArrow(ctx, sim);
    this.drawTwig(ctx, sim, rest);
    this.particles.draw(ctx);
    this.floaters.draw(ctx, SANS);
    for (const f of this.fliers) {
      const open = 0.3 + 0.7 * Math.abs(Math.cos(f.t * 9));
      drawButterfly(ctx, f.s, f.x, f.y - wingMidY(f.sp) * f.size, f.size, open, Math.sin(f.t * 2) * 0.2, Math.min(1, (5 - f.t) / 1));
    }
    // the flowerbed: the band's last 40 s
    const n = Math.max(20, Math.min(60, Math.floor(w / 16)));
    const bars = traceBars(sim.trace, sim.t, n, 40);
    const lag = LAG_SEC[this.opts.eeg ? 'eeg' : 'fnirs'];
    drawFlowerbed(ctx, bars, L.bed.x, L.bed.y, L.bed.w, L.bed.h - L.ins.bottom, lag / 40, `~${lag} s`, this.clock);
    if (L.ins.bottom > 0) {
      // the home indicator's strip under the flowerbed is soil too
      ctx.fillStyle = '#6E5134';
      ctx.fillRect(L.bed.x, L.bed.y + L.bed.h - L.ins.bottom, L.bed.w, L.ins.bottom);
    }
    this.drawSidePill(ctx, sim);
    // Hieronim top left under the HUD, his line hanging beside him (over the pill while he talks)
    const s = L.snail, line = sim.talk;
    drawSnail(ctx, s.x, s.y, s.s, this.clock, !!line, this.scared);
    if (line && !sim.card) {
      const k = Math.min(1, line.t / 0.15, (line.dur - line.t) / 0.25);
      drawBubble(ctx, line.text, L.bubble.x, L.bubble.y, L.bubble.maxW, clamp(k), true);
    }
    this.drawStick(ctx);
    if (sim.card) this.drawCard(ctx, sim);
  }

  /** The floating stick where the thumb steers: its base, the sprint's rim (gold, solid while sprinting), the knob. */
  private drawStick(ctx: CanvasRenderingContext2D): void {
    const s = this.stick;
    if (!s) return;
    const S = this.L.stick;
    ctx.save();
    ctx.fillStyle = 'rgba(30,45,20,.14)';
    ctx.beginPath();
    ctx.arc(s.bx, s.by, S.sprint, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,252,240,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.bx, s.by, S.r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = s.sprint ? 'rgba(255,211,77,.95)' : 'rgba(255,211,77,.55)';
    ctx.lineWidth = s.sprint ? 4 : 2;
    if (!s.sprint) ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(s.bx, s.by, S.sprint, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // the knob at the finger, held within the far edge (the base follows a finger pulled further)
    const dx = s.x - s.bx, dy = s.y - s.by, d = Math.hypot(dx, dy), far = S.sprint + S.r * 0.35;
    const k = d > far ? far / d : 1;
    ctx.fillStyle = s.sprint ? 'rgba(255,211,77,.9)' : 'rgba(255,252,240,.8)';
    ctx.beginPath();
    ctx.arc(s.bx + dx * k, s.by + dy * k, S.knob, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** Where the twig's branch starts on the left: as far as its chrysalises (and one free slot) need. */
  private twigLeft(sim: MothSim): number {
    const tw = this.L.twig, rest = sim.block.kind === 'rest' && sim.phase === 'play';
    const len = tw.len * (rest ? 1.15 : 1);
    return Math.max(tw.x0, tw.x1 - (Math.max(1, sim.twig.length) + 1.1) * len * 0.95);
  }

  /** The card on screen that waits for a tap (the game's one target then), as drawn. */
  cardBox(sim: MothSim): Rect | null {
    const c = sim.card;
    if (!c || c.t >= c.dur) return null;
    if (c.kind === 'open') return (this.open ??= this.layOpen()).box;
    return gardenCardBox(this.L);
  }

  private layOpen(): OpenCard {
    return openCard(this.ctx, this.L, { body: t('card.open.text') }, passage('2co5.17'), font);
  }

  private drawRareArrow(ctx: CanvasRenderingContext2D, sim: MothSim): void {
    const r = sim.rare;
    if (!r || sim.phase !== 'play') return;
    // on the edge of the play's inner box: below Hieronim and the pill in the band under the HUD
    const s = this.worldToScreen(r.x, r.y), P = this.L.play, m = 34;
    const x0 = P.x + m, x1 = P.x + P.w - m, y0 = Math.max(P.y + m, this.L.band + 22), y1 = P.y + P.h - m;
    if (s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1) return;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, a = Math.atan2(s.y - cy, s.x - cx);
    const kx = (x1 - x0) / 2 / Math.max(1e-6, Math.abs(Math.cos(a))), ky = (y1 - y0) / 2 / Math.max(1e-6, Math.abs(Math.sin(a)));
    const d = Math.min(kx, ky), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const pulse = 1 + 0.1 * Math.sin(this.clock * 5);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,250,235,.92)';
    ctx.beginPath();
    ctx.arc(0, 0, 18 * pulse, 0, TAU);
    ctx.fill();
    ctx.drawImage(foodSprite('rare', r.pig), -14, -14, 28, 28);
    ctx.rotate(a);
    ctx.fillStyle = '#C46A1C';
    ctx.beginPath();
    ctx.moveTo(26 * pulse, 0);
    ctx.lineTo(17 * pulse, -7);
    ctx.lineTo(17 * pulse, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private wingsOf(c: Chrysalis, px: number): { pale: WingBitmap; deep: WingBitmap } {
    let w = this.wings.get(c.id);
    if (!w) {
      const species = speciesById(c.sp), path = decodePath(c.path), box = buildLeaf(species.plant).box;
      const base = { species, path, box, pigments: c.pig, bold: false, radiant: false, aberration: null, female: false, bare: true };
      w = { pale: paintWing({ ...base, depth: 0 }, px), deep: paintWing({ ...base, depth: 1 }, px) };
      this.wings.set(c.id, w);
      if (this.wings.size > 12) this.wings.delete(this.wings.keys().next().value!);
    }
    return w;
  }

  private drawTwig(ctx: CanvasRenderingContext2D, sim: MothSim, rest: boolean): void {
    const tw = this.L.twig;
    if (!sim.twig.length && !rest) return;
    const len = tw.len * (rest ? 1.15 : 1);
    // the branch from the right edge, as long as its chrysalises need and a slot more
    const bx0 = this.twigLeft(sim);
    ctx.strokeStyle = '#6E4B2E';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tw.x1, tw.y - 4);
    ctx.quadraticCurveTo((bx0 + tw.x1) / 2, tw.y + 6, bx0, tw.y);
    ctx.stroke();
    ctx.fillStyle = '#6FA548';
    for (let i = 0; i < 4; i++) {
      const x = bx0 + ((tw.x1 - bx0) * (i + 0.5)) / 4;
      ctx.beginPath();
      ctx.ellipse(x, tw.y - 7, 9, 4, -0.5 + i * 0.3, 0, TAU);
      ctx.fill();
    }
    if (rest) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gx = tw.x1 - Math.max(1, sim.twig.length) * len * 0.5, gy = tw.y + len * 0.7;
      const gl = ctx.createRadialGradient(gx, gy, 4, gx, gy, len * 2.2);
      gl.addColorStop(0, 'rgba(255,240,190,.4)');
      gl.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(gx - len * 2.4, gy - len * 2.4, len * 4.8, len * 4.8);
      ctx.restore();
    }
    sim.twig.forEach((c, i) => {
      const x = tw.x1 - (i + 0.8) * len * 0.95, sp = speciesById(c.sp);
      const pop = ease.outBack(this.arrive.get(c.id) ?? 1);
      const wg = this.wingsOf(c, len * 0.6 * this.dpr);
      const look: ChrysalisLook = {
        kind: 'hanging', color: sp.pupa.color, accent: sp.pupa.accent, glass: 0.25 + 0.75 * c.depth, depth: c.depth, blind: false,
        pale: wg.pale, deep: wg.deep, warm: 0,
      };
      drawChrysalis(ctx, x, tw.y + 2, len * pop, look, Math.sin(this.clock * 1.3 + i) * 0.05, this.dpr);
      if (rest) {
        // the colour depth, as a ring that fills
        const ry = tw.y + len * 1.25;
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, ry, 9, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = c.depth >= RULES.radiantDepth ? '#FFD34D' : '#F4E6C4';
        ctx.beginPath();
        ctx.arc(x, ry, 9, -Math.PI / 2, -Math.PI / 2 + TAU * c.depth);
        ctx.stroke();
      }
    });
    if (rest && !sim.twig.length) {
      // nothing spun yet: the place of the next chrysalis, its colours (the caterpillar's) deepening already
      const x = tw.x1 - 0.8 * len * 0.95, sp = speciesById(sim.player.sp);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(70,50,25,.6)';
      ctx.fillStyle = rgba(sp.pupa.color, 0.15 + 0.6 * sim.depth);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, tw.y + len * 0.5, len * 0.2, len * 0.45, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const ry = tw.y + len * 1.25;
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, ry, 9, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#F4E6C4';
      ctx.beginPath();
      ctx.arc(x, ry, 9, -Math.PI / 2, -Math.PI / 2 + TAU * sim.depth);
      ctx.stroke();
    }
    if (rest) {
      // the twig's word on a plate, inside the gutter
      const word = sim.twig.length ? t('hud.hatchAt') : t('hud.rest');
      const right = this.L.x1, maxW = Math.max(80, Math.min(280 * this.L.u, right - this.L.x0));
      const text = fitText(ctx, word, maxW, 13, 700, SANS, MIN_READ);
      const tw2 = ctx.measureText(text).width, ty = tw.y + len * 1.45;
      ctx.fillStyle = 'rgba(255,251,239,.78)';
      roundRect(ctx, right - tw2 - 8, ty - 2, tw2 + 12, 19, 9);
      ctx.fill();
      ctx.fillStyle = 'rgba(40,30,15,.85)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(text, right - 2, ty);
    }
  }

  /** The side goal's pill, in the band under the HUD beside Hieronim (passive: nothing to press). */
  private drawSidePill(ctx: CanvasRenderingContext2D, sim: MothSim): void {
    if (sim.phase !== 'play') return;
    const P = this.L.pill, u = this.L.u;
    // beside the twig while it shows (chrysalises on it, or a siesta), else the row to the gutter
    const twig = sim.twig.length > 0 || (sim.block.kind === 'rest' && sim.phase === 'play');
    const maxW = Math.max(P.maxW, (twig ? this.twigLeft(sim) - 10 : this.L.x1) - P.x);
    const raw = `${sim.sideDone ? '✓ ' : ''}${t('hud.side', { side: sideText(sim) })}`;
    const text = fitText(ctx, raw, maxW - 20 * u, 14 * u, 700, SANS, MIN_READ);
    const tw = ctx.measureText(text).width + 20 * u;
    ctx.fillStyle = sim.sideDone ? 'rgba(255,214,90,.92)' : 'rgba(255,251,239,.88)';
    roundRect(ctx, P.x, P.y, tw, P.h, P.h / 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, P.x + 10 * u, P.y + P.h / 2 + 0.5);
  }

  /**
   * The cards that wait for a tap: the opening story (the title, the story, 2 Corinthians 5:17 fitted to the
   * play area at 16 px where they fit, never under 13) and a new garden's goals (on a phone a sheet over the
   * flowerbed, clear of the runner's block banner).
   */
  private drawCard(ctx: CanvasRenderingContext2D, sim: MothSim): void {
    const c = sim.card!, L = this.L, u = L.u;
    const a = Math.min(1, c.t / 0.25, (c.dur - c.t) / 0.3);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (c.kind === 'open') {
      const O = (this.open ??= this.layOpen()), b = O.box, cx = b.x + b.w / 2, iw = b.w - 2 * O.pad;
      this.panel(ctx, b.x, b.y, b.w, b.h);
      ctx.fillStyle = INK;
      ctx.fillText(fitText(ctx, t('card.open.title'), iw, O.titleSize, 700, SERIF, MIN_READ), cx, b.y + O.pad);
      ctx.font = font(O.bodySize, 500);
      O.body.forEach((l, i) => ctx.fillText(l, cx, b.y + O.yBody + i * O.bodyLH));
      ctx.fillStyle = '#4A3B28';
      ctx.font = `italic 400 ${fontPx(O.verse.size)}px ${SERIF}`;
      O.verse.lines.forEach((l, i) => ctx.fillText(l, cx, b.y + O.yVerse + i * O.verse.lineH));
      const p = passage('2co5.17');
      ctx.fillStyle = '#8A7558';
      ctx.font = font(O.refSize, 600);
      ctx.fillText(`${p.ref} · ${p.bible}`, cx, b.y + O.yRef);
      ctx.fillStyle = '#7A5A2E';
      ctx.globalAlpha = clamp(a) * (0.75 + 0.25 * Math.sin(this.clock * 3.2));
      ctx.fillText(fitText(ctx, `${this.opts.touch ? t('card.tap') : t('card.tap.keys')}  ›`, iw, O.tapSize, 700, SANS, MIN_READ), cx, b.y + O.yTap);
    } else {
      const g = gardenAt(c.garden), b = gardenCardBox(L), cx = b.x + b.w / 2, iw = b.w - 36 * u;
      this.panel(ctx, b.x, b.y, b.w, b.h);
      ctx.fillStyle = INK;
      ctx.fillText(fitText(ctx, t('card.garden', { n: c.garden + 1, name: g.name }), iw, 22 * u, 700, SERIF, MIN_READ), cx, b.y + 16 * u);
      ctx.fillStyle = '#5A4A34';
      const side = g.side === 'rare' ? t('side.rare') : t(g.side === 'curl' ? 'side.curl' : g.side === 'dew' ? 'side.dew' : 'side.flowers', { n: g.n });
      const rows = [`★ ${t('goal.len', { n: g.len })}`, `★★ ${t('star.two')}`, `★★★ ${side}`];
      rows.forEach((r, i) => ctx.fillText(fitText(ctx, r, iw, 15 * u, 600, SANS, MIN_READ), cx, b.y + 52 * u + i * 26 * u));
    }
    ctx.restore();
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = 'rgba(40,30,10,.25)';
    roundRect(ctx, x + 3, y + 5, w, h, 18);
    ctx.fill();
    ctx.fillStyle = PAPER;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = rgba(darken(PAPER, 0.3), 0.6);
    ctx.lineWidth = 1.5;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 14);
    ctx.stroke();
  }
}
