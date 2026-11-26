/**
 * Ogród o świcie's picture (DESIGN.md §23), canvas 2D, every frame from the sim:
 *
 *   the garden   scenery.ts: the sky from night to dawn, the hills, the wall and its gate, the olive, the pond with
 *                its reflections, the path, the bed, the bench; mist, fireflies, dew, rays — a panorama the camera
 *                walks (2.4 s between two places; reduced motion: a soft cut through the dark) and opens at dawn
 *   the acts     Łzy: a wave crossing the pond through a steady light, its word on it; the word sinks and rises as a
 *                drop of light into the clay vessel.  Dłoń: through the player's eyes, the hands of light on the heart
 *                and the belly over the softly blurred garden, warmth under them, the kind word written in light over
 *                the harsh one.  List: the letter (its first lines in a handwritten serif) folds into a paper boat with
 *                a small light, sails toward the dawn, drifts away as its words lift off as motes.  Furtka: beyond the
 *                gate the words that reopen the wound; the gate closes gently, a rose climbs over the latch, the words
 *                sink into mist.  Kamienie: the stone in the open hands; the fingers open, it falls, rings spread, the
 *                water clears, it glows on the bottom — or it stays held ("not yet").  Latarnie: paper lanterns on the
 *                path, each kindled, its name on its paper.  Nasiona: seeds pressed into the bed, sprouting, a rain of
 *                light.  The buds of the flowers grown by focus stand where their act happened, and open at dawn.
 *   the words    the station's name card, the narrator, a passage, a blessing or the prayer in the band; the breath
 *                guide in the rests; the name in light at dawn; the 0–10 row in the close
 */
import { breathGuideBox, breathOf, drawBreathGuide } from '../kit/breathguide';
import { clamp, ease } from '../kit/juice';
import { MIN_TAP, hits, target } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageId, type PassageLayout } from '../kit/scripture';
import type { Insets, TapTarget } from '../kit/types';
import { drawHands } from '../kintsugi/hands';
import { drawRestingHand } from './hands';
import { t, type Key } from './i18n';
import { layout, type Layout, type Rect } from './layout';
import { BLOOMS, FONT, GOLD, GOLD_HI, INK, SERIF, TAU, glow, hash, makeCanvas, pal, rgba, roundRect, type Canvas2D } from './paint';
import { Scenery, type Cam } from './scenery';
import type { ActRun, GardenSim, SimEvent } from './sim';
import type { StationId } from './stations';
import { BED, GATE, PLACES, POND, VESSEL, VIEW_Y, WALL, WORLD_W, lanternAt, pondAt, seedAt, type Spot } from './world';

interface Part { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; kind: 'mote' | 'rain' | 'splash' | 'spark' }
interface Ring { x: number; y: number; t0: number; big: boolean }

const MID_Y = (VIEW_Y.top + VIEW_Y.bottom) / 2;
/** The world y at the view's middle per place (the first-person stone looks down at the pond). */
const PLACE_Y: Partial<Record<Spot, number>> = { kamienie: 0.79, nasiona: 0.66, latarnie: 0.66, lzy: 0.63, list: 0.63 };

export class GardenView {
  private readonly ctx: CanvasRenderingContext2D | null;
  private l: Layout;
  private dpr = 1;
  private time = 0;
  private readonly scene: Scenery;
  private cam: Cam = { s: 100, x: 1.3, y: MID_Y, vx: 0, vy: 0 };
  private from = { x: 1.3, y: MID_Y, s: 100 };
  private walkT = 99;
  private spot: Spot = 'arrive';
  private veil = 0;
  private readonly vp: number[] = [];
  private readonly parts: Part[] = [];
  private readonly rings: Ring[] = [];
  private blur: Canvas2D | null = null;
  private blurAt = -1;
  private fp = 0;
  private verseCache = new Map<string, PassageLayout>();
  private fitCache = new Map<string, { size: number; lines: string[] }>();
  private rateFlash = 0;
  private dropAt = -1;
  private vesselPulse = 0;
  private bornGlow = new Map<number, number>();

  constructor(canvas: HTMLCanvasElement, private readonly o: { reducedMotion: boolean; touch: boolean; seed: number }) {
    this.ctx = canvas.getContext('2d');
    this.scene = new Scenery(o.reducedMotion);
    this.l = layout(1, 1, { top: 0, right: 0, bottom: 0, left: 0 });
  }

  get layoutNow(): Layout { return this.l; }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = Math.max(1, Math.min(3, dpr || 1));
    this.l = layout(w, h, ins);
    this.verseCache.clear();
    this.fitCache.clear();
    const c = this.camFor(this.spot);
    this.cam = { ...c, vx: this.l.view.x + this.l.view.w / 2, vy: this.l.view.y + this.l.view.h / 2 };
    this.from = { x: c.x, y: c.y, s: c.s };
    this.blur = null;
  }

  // ── the camera ─────────────────────────────────────────────────

  private camFor(spot: Spot): { x: number; y: number; s: number } {
    const l = this.l;
    if (spot === 'dawn') return { x: WORLD_W / 2, y: MID_Y - 0.04, s: l.sDawn };
    const p = PLACES[spot];
    return { x: p.x, y: PLACE_Y[spot] ?? MID_Y, s: l.s * p.zoom };
  }

  /** The camera's x kept so the canvas never shows past the garden's ends. */
  private clampX(x: number, s: number): number {
    const l = this.l, vx = l.view.x + l.view.w / 2;
    const lo = -0.25 + vx / s, hi = WORLD_W + 0.25 - (l.w - vx) / s;
    return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, x));
  }

  private spotOf(sim: GardenSim): Spot {
    const p = sim.place;
    return p === 'close' || p === 'dawn' ? 'dawn' : p;
  }

  // ── events and time ────────────────────────────────────────────

  on(e: SimEvent, sim: GardenSim): void {
    switch (e.type) {
      case 'place': {
        const spot = this.spotOf(sim);
        if (spot !== this.spot) {
          this.from = { x: this.cam.x, y: this.cam.y, s: this.cam.s };
          this.spot = spot;
          this.walkT = 0;
        }
        break;
      }
      case 'done': {
        const a = sim.acts[e.act];
        if (e.by === 'focus') this.burstAt(a, sim, 12, 'spark');
        if (a.kind === 'drop' && e.by === 'focus') {
          this.dropAt = this.time;
        }
        break;
      }
      case 'flower':
        this.bornGlow.set(e.n - 1, this.time);
        break;
      case 'cue':
        if (e.cue === 'drop') this.vesselPulse = 1;
        break;
      case 'rated':
        this.rateFlash = 1;
        break;
      default: break;
    }
  }

  update(dt: number, sim: GardenSim): void {
    const step = Math.min(0.1, Math.max(0, dt));
    this.time += step;
    const l = this.l;
    // the camera: the walk between places (reduced motion: a soft cut through the dark)
    const spot = this.spotOf(sim);
    if (spot !== this.spot) {
      this.from = { x: this.cam.x, y: this.cam.y, s: this.cam.s };
      this.spot = spot;
      this.walkT = 0;
    }
    this.walkT += step;
    const to = this.camFor(this.spot);
    const walk = this.spot === 'dawn' ? 3.6 : 2.4;
    let k: number;
    if (this.o.reducedMotion) {
      k = this.walkT < 0.45 ? 0 : 1;
      this.veil = this.walkT < 0.9 ? 1 - Math.abs(this.walkT - 0.45) / 0.45 : 0;
    } else {
      k = ease.inOutSine(clamp(this.walkT / walk));
      this.veil = 0;
    }
    let x = this.from.x + (to.x - this.from.x) * k;
    const y = this.from.y + (to.y - this.from.y) * k;
    const s = this.from.s + (to.s - this.from.s) * k;
    // the dawn: a slow drift over a garden wider than the screen
    if (this.spot === 'dawn' && !this.o.reducedMotion) x += Math.sin(this.time * 0.05) * 0.25 * clamp((this.walkT - walk) / 4);
    this.cam = { s, x: this.clampX(x, s), y, vx: l.view.x + l.view.w / 2, vy: l.view.y + l.view.h / 2 };
    // the acts' shown progress follows the sim's, softly (grace a little quicker)
    sim.acts.forEach((a, i) => {
      const want = a.p;
      const v = this.vp[i] ?? 0;
      const tau = a.done === 'grace' ? 0.6 : 0.35;
      this.vp[i] = this.o.reducedMotion ? want : v + (want - v) * (1 - Math.exp(-step / tau));
    });
    this.rateFlash = Math.max(0, this.rateFlash - step * 1.5);
    this.vesselPulse = Math.max(0, this.vesselPulse - step * 0.6);
    // the first person: the hands' station fades in and out
    const fpWant = sim.station === 'dlon' && sim.block.what !== 'open' ? 1 : sim.station === 'dlon' ? clamp(sim.blockT / 2) : 0;
    this.fp += (fpWant - this.fp) * (1 - Math.exp(-step / 0.5));
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += step;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      if (this.o.reducedMotion && p.kind !== 'rain') continue;
      p.x += p.vx * step;
      p.y += p.vy * step;
      if (p.kind === 'mote') { p.vy -= 0.02 * step; p.vx += Math.sin(this.time * 2 + i) * 0.01 * step; }
      if (p.kind === 'splash') p.vy += 0.25 * step;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) if (this.time - this.rings[i].t0 > 4) this.rings.splice(i, 1);
    this.emitAmbient(sim, step);
  }

  /** Motes off the drifting boat, the rain of light over the bed, rings as a wave passes the light. */
  private emitAmbient(sim: GardenSim, dt: number): void {
    const a = sim.act;
    if (!a || this.parts.length > 260) return;
    const b = sim.block.what;
    if (a.id === 'list' && b === 'settle' && a.i === sim.actsAt(a.station).length - 1) {
      const p = this.boatAt(sim, a);
      if (Math.random() < dt * 9) this.parts.push({ x: p.x + (Math.random() - 0.5) * 0.02, y: p.y - 0.015, vx: (Math.random() - 0.5) * 0.01, vy: -0.03 - Math.random() * 0.03, age: 0, life: 2.4 + Math.random() * 1.5, size: 0.004 + Math.random() * 0.004, kind: 'mote' });
    }
    if (a.id === 'nasiona' && b === 'settle') {
      const rate = 26 + 4 * Math.min(8, sim.tears);
      let n = rate * dt;
      while (n > 0) {
        if (Math.random() < n) this.parts.push({ x: BED.x0 - 0.02 + (BED.x1 - BED.x0 + 0.04) * Math.random(), y: BED.y0 - 0.25 - Math.random() * 0.08, vx: -0.004, vy: 0.22 + Math.random() * 0.08, age: 0, life: 1.15, size: 0.0025, kind: 'rain' });
        n -= 1;
      }
    }
    if (a.id === 'lzy' && b === 'act') {
      const i = sim.acts.indexOf(a);
      const v = this.vp[i] ?? 0;
      const prev = (this as unknown as { _wv?: number })._wv ?? 0;
      if (prev < 0.5 && v >= 0.5) this.rings.push({ x: POND.x, y: POND.y, t0: this.time, big: false });
      (this as unknown as { _wv?: number })._wv = v;
    }
  }

  private burstAt(a: ActRun, sim: GardenSim, n: number, kind: Part['kind']): void {
    const p = this.actPoint(a, sim);
    for (let i = 0; i < n; i++) {
      const an = Math.random() * TAU;
      this.parts.push({ x: p.x, y: p.y, vx: Math.cos(an) * 0.05, vy: Math.sin(an) * 0.03 - 0.04, age: 0, life: 1 + Math.random() * 0.6, size: 0.003 + Math.random() * 0.003, kind });
    }
  }

  /** Where an act happens in the world (for its sparks). */
  private actPoint(a: ActRun, sim: GardenSim): { x: number; y: number } {
    switch (a.id) {
      case 'lzy': return { x: POND.x + POND.rx * 0.6, y: POND.y - 0.02 };
      case 'list': return this.boatAt(sim, a);
      case 'furtka': return { x: GATE.x, y: 0.5 };
      case 'kamienie': return { x: POND.x, y: POND.y };
      case 'latarnie': { const q = lanternAt(a.item, sim.view.lanterns.length); return { x: q.x, y: q.y - 0.09 * q.s }; }
      case 'nasiona': { const q = seedAt(Math.min(a.item, sim.view.seeds.length - 1), Math.max(1, sim.view.seeds.length)); return { x: q.x, y: q.y - 0.02 }; }
      default: return { x: this.cam.x, y: this.cam.y };
    }
  }

  // ── world ↔ screen ─────────────────────────────────────────────

  private X(wx: number): number { return this.cam.vx + (wx - this.cam.x) * this.cam.s; }
  private Y(wy: number): number { return this.cam.vy + (wy - this.cam.y) * this.cam.s; }
  private screen(ctx: CanvasRenderingContext2D): void { ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  // ── the frame ──────────────────────────────────────────────────

  draw(sim: GardenSim, intro = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = this.l;
    const k = sim.sky;
    const fp = this.fp > 0.02;
    if (fp) this.drawBlurred(ctx, sim, k);
    if (!fp || this.fp < 0.98) {
      if (fp) {
        // the blurred garden is under the sharp one as it fades in (and out)
        ctx.save();
        ctx.globalAlpha = 1 - this.fp;
      }
      this.drawGarden(ctx, sim, k, this.dpr, this.cam);
      if (fp) ctx.restore();
    }
    this.screen(ctx);
    if (fp) this.drawDlon(ctx, sim);
    if (sim.station === 'kamienie') this.drawStoneHands(ctx, sim);
    this.drawSceneWords(ctx, sim);
    if (this.veil > 0.01) {
      ctx.fillStyle = `rgba(4,6,16,${0.85 * this.veil})`;
      ctx.fillRect(0, 0, l.w, l.h);
    }
    if (!intro) {
      this.drawTitle(ctx, sim);
      this.drawWords(ctx, sim);
    }
  }

  /** The whole garden into `ctx` at device scale `d` (the main canvas, or the small one blurred for the first person). */
  private drawGarden(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number, d: number, c: Cam): void {
    const l = this.l, S = this.scene, time = this.time;
    S.sky(ctx, l.w, l.h, k, time, c, d);
    S.beyond(ctx, k, c, d);
    S.garden(ctx, k, c, d);
    this.drawGate(ctx, sim, k, c, d);
    S.olive(ctx, k, c, d, time);
    S.ground(ctx, k, c, d);
    this.drawBed(ctx, sim, k, c, d);
    S.pond(ctx, k, c, d, time, this.murk(sim));
    this.drawPondActs(ctx, sim, k, c, d);
    S.vessel(ctx, k, c, d, sim.tears, this.vesselPulse);
    this.drawLanterns(ctx, sim, k, c, d);
    this.drawFlowers(ctx, sim, k, c, d);
    S.air(ctx, k, c, d, time);
    this.drawParts(ctx, c, d);
    S.light(ctx, k, c, d, time, l.w, l.h, sim.place === 'dawn' || sim.place === 'close' ? 1 : 0);
    S.front(ctx, k, c, d, l.w, l.h);
  }

  /** The garden softly blurred behind the hands (a small copy scaled up, refreshed a few times a second). */
  private drawBlurred(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number): void {
    const l = this.l, q = 0.16;
    if (!this.blur) this.blur = makeCanvas(Math.max(8, l.w * q), Math.max(8, l.h * q));
    const b = this.blur, g = b?.getContext('2d');
    if (!b || !g) return;
    if (this.time - this.blurAt > 0.25 || this.blurAt < 0) {
      this.blurAt = this.time;
      this.drawGarden(g, sim, k, q, this.cam);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, 0, 0, l.w * this.dpr, l.h * this.dpr);
  }

  /** The pond's water made murky in the stones' station, clearing in each settle after a stone falls. */
  private murk(sim: GardenSim): number {
    if (sim.station !== 'kamienie') return 0;
    const a = sim.act;
    if (!a) return 0.4;
    if (sim.block.what === 'settle' && a.done === 'focus' && a.kind === 'drop') return 0.4 * (1 - clamp(sim.blockK * 1.3));
    return 0.4;
  }

  // ── the gate (Furtka) ──────────────────────────────────────────

  private gateState(sim: GardenSim): { close: number; rose: number; roses: number; words: number; mist: number } {
    const acts = sim.acts.filter(a => a.id === 'furtka');
    if (!acts.length) return { close: 0, rose: 0, roses: 0, words: 0, mist: 0 };
    const vp = (a: ActRun) => this.vp[sim.acts.indexOf(a)] ?? 0;
    let close = 0, rose = 0, roses = 0;
    for (const a of acts) {
      if (a.kind === 'close') close = Math.max(close, vp(a));
      if (a.kind === 'closeRose') { close = Math.max(close, clamp(vp(a) / 0.55)); rose = Math.max(rose, clamp((vp(a) - 0.55) / 0.45)); }
      if (a.kind === 'rose') {
        if (a.i === 1) rose = Math.max(rose, vp(a));
        else roses += vp(a);
      }
    }
    // the words beyond the gate: there while it is open; after it closes they rise over the wall and sink into mist
    const here = sim.station === 'furtka';
    const cur = sim.act;
    const settleK = here && sim.block.what === 'settle' && cur?.id === 'furtka' ? sim.blockK : 0;
    const past = sim.block.station > acts[0].station || sim.place === 'dawn' || sim.place === 'close';
    const mist = past ? 1 : close >= 0.999 ? (cur && cur.i === 0 ? settleK : 1) : 0;
    const words = past ? 0 : here || sim.block.station === acts[0].station ? 1 - mist : 0.5;
    return { close, rose, roses, words, mist };
  }

  private drawGate(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number, c: Cam, d: number): void {
    const arch = this.scene.archPath;
    if (!arch) return;
    const st = this.gateState(sim);
    this.scene.setWorld(ctx, c, d);
    const a = GATE.w / 2 - 0.02, spring = 0.45, base = WALL.base;
    // beyond the gate: the misty field outside the garden, seen through the opening
    ctx.save();
    ctx.clip(arch);
    const mg = ctx.createLinearGradient(0, spring - a, 0, base);
    mg.addColorStop(0, rgba(pal('mist', k), 0.32));
    mg.addColorStop(1, rgba(pal('mist', k), 0.12));
    ctx.fillStyle = mg;
    ctx.fillRect(GATE.x - a, spring - a - 0.01, 2 * a, base - spring + a + 0.02);
    ctx.restore();
    // the two leaves: hinged at the sides, swung open toward the garden, closing as the focus goes
    const th = (1 - st.close) * 1.25;
    const leafW = a * Math.cos(th);
    const wood = pal('wood', k), woodHi = pal('woodHi', k);
    for (const side of [-1, 1] as const) {
      const hx = GATE.x + side * a;
      const ex = hx - side * leafW;
      // a leaf swung open seems a little taller at its free edge (it comes toward us)
      const grow = 0.012 * Math.sin(th);
      ctx.beginPath();
      ctx.moveTo(hx, base);
      ctx.lineTo(hx, spring);
      // the leaf's top follows the arch (closed) or is square (open)
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        const x = hx - side * leafW * u;
        const archY = spring - Math.sqrt(Math.max(0, a * a - (x - GATE.x) ** 2));
        const y = st.close > 0.98 ? archY : spring + (archY - spring) * Math.cos(th) - grow * u;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(ex, base + grow * 0.5);
      ctx.closePath();
      ctx.fillStyle = wood;
      ctx.fill();
      // the planks and a brace
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = rgba('#000000', 0.35);
      ctx.lineWidth = 1 / c.s;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        const x = hx - side * leafW * (i / 4);
        ctx.moveTo(x, spring - a);
        ctx.lineTo(x, base + 0.02);
      }
      ctx.stroke();
      ctx.fillStyle = woodHi;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(Math.min(hx, ex), 0.488, Math.abs(hx - ex), 0.008);
      ctx.fillRect(Math.min(hx, ex), 0.535, Math.abs(hx - ex), 0.008);
      ctx.restore();
    }
    // the latch: a ring of light when the gate is closed
    if (st.close > 0.98) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.scene.sprites.gold, GATE.x, 0.515, 0.03, 0.35 + 0.25 * Math.sin(this.time * 1.5) ** 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = rgba('#d8b878', 0.6 + 0.4 * st.close);
    ctx.lineWidth = 1.6 / c.s;
    ctx.beginPath();
    ctx.arc(GATE.x + 0.006, 0.515, 0.006, 0, TAU);
    ctx.stroke();
    // the rose: up the right pillar, over the arch, down to the latch; more blooms in a longer session
    if (st.rose > 0.001) this.drawRose(ctx, st.rose, st.roses, k, c);
  }

  private rosePts: { x: number; y: number }[] | null = null;
  private drawRose(ctx: CanvasRenderingContext2D, p: number, more: number, k: number, c: Cam): void {
    if (!this.rosePts) {
      const pts: { x: number; y: number }[] = [];
      const a = GATE.w / 2 - 0.02, spring = 0.45;
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        if (u < 0.35) {
          const v = u / 0.35;
          pts.push({ x: GATE.x + a + 0.03 + 0.006 * Math.sin(v * 12), y: WALL.base - v * (WALL.base - spring + 0.01) });
        } else if (u < 0.75) {
          const v = (u - 0.35) / 0.4, an = -v * Math.PI * 0.62;
          pts.push({ x: GATE.x + Math.cos(an) * (a + 0.03), y: spring + Math.sin(an) * (a + 0.03) });
        } else {
          const v = (u - 0.75) / 0.25;
          const sx = GATE.x + Math.cos(-Math.PI * 0.62) * (a + 0.03), sy = spring + Math.sin(-Math.PI * 0.62) * (a + 0.03);
          pts.push({ x: sx + (GATE.x + 0.008 - sx) * v, y: sy + (0.505 - sy) * ease.inOutSine(v) });
        }
      }
      this.rosePts = pts;
    }
    const pts = this.rosePts, n = Math.max(2, Math.round(p * (pts.length - 1)) + 1);
    ctx.strokeStyle = pal('ivy', Math.max(0.4, k));
    ctx.lineWidth = 2.2 / c.s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.slice(0, n).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    ctx.fillStyle = pal('ivyHi', Math.max(0.45, k));
    for (let i = 3; i < n; i += 4) {
      const q = pts[i], side = i % 8 < 4 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(q.x + side * 0.008, q.y, 0.008, 0.004, side * 0.6, 0, TAU);
      ctx.fill();
    }
    const bloom = (x: number, y: number, r: number, open: number) => {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.scene.sprites.rose, x, y, r * 3, 0.35 * open);
      ctx.globalCompositeOperation = 'source-over';
      for (let ring = 0; ring < 3; ring++) {
        const rr = r * (1 - ring * 0.28) * (0.4 + 0.6 * open);
        ctx.fillStyle = ['#c84a66', '#e06a84', '#f590a6'][ring];
        for (let i = 0; i < 5; i++) {
          const an = (i / 5) * TAU + ring * 0.6;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(an) * rr * 0.45, y + Math.sin(an) * rr * 0.4, rr * 0.55, rr * 0.42, an, 0, TAU);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#ffd4a0';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.18, 0, TAU);
      ctx.fill();
    };
    if (p > 0.85) {
      const q = pts[pts.length - 1];
      bloom(q.x + 0.004, q.y - 0.012, 0.016, clamp((p - 0.85) / 0.15));
    }
    // more roses along the vine (the longer session's acts)
    const spots = [0.62, 0.44, 0.8, 0.28];
    for (let i = 0; i < spots.length && more > i; i++) {
      const q = pts[Math.round(spots[i] * (pts.length - 1))];
      bloom(q.x, q.y - 0.006, 0.012, clamp(more - i));
    }
  }

  // ── the pond's acts: the waves (Łzy), the boat (List), the stone and its rings (Kamienie) ──

  private drawPondActs(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number, c: Cam, d: number): void {
    const water = this.scene.waterPath;
    if (!water) return;
    this.scene.setWorld(ctx, c, d);
    const a = sim.act;
    // the steady light on the water (Łzy): a soft pool of warm light and a faint column above it
    if (sim.station === 'lzy') {
      const strong = sim.block.what === 'act' ? 0.45 + 0.55 * clamp(sim.light) : 0.35;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.scene.sprites.warm, POND.x, POND.y, 0.13, 0.5 * strong, 0.04);
      glow(ctx, this.scene.sprites.white, POND.x, POND.y, 0.04, 0.35 * strong, 0.012);
      glow(ctx, this.scene.sprites.warm, POND.x, POND.y - 0.11, 0.035, 0.16 * strong, 0.13);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the wave crossing (Łzy): a swell of lighter water, its crests curved by the pond's perspective, through the light
    if (a && a.id === 'lzy' && sim.block.what === 'act') {
      const v = this.vp[sim.acts.indexOf(a)] ?? 0;
      const x = POND.x - POND.rx * 0.92 + v * POND.rx * 1.84;
      const inLight = 1 - clamp(Math.abs(x - POND.x) / 0.18);
      const fade = clamp(sim.blockT / 1.2) * (1 - clamp((v - 0.92) / 0.08));
      ctx.save();
      ctx.clip(water);
      // the swell: a soft brighter band
      const g = ctx.createLinearGradient(x - 0.09, 0, x + 0.02, 0);
      g.addColorStop(0, rgba('#cfdcff', 0));
      g.addColorStop(0.75, rgba(inLight > 0.3 ? '#ffe8c0' : '#dfe8ff', (0.14 + 0.12 * inLight) * fade));
      g.addColorStop(1, rgba('#dfe8ff', 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 0.09, POND.y - POND.ry, 0.11, 2 * POND.ry);
      // the crests: thin curved lines, the first the brightest
      for (let i = 0; i < 4; i++) {
        const xx = x - i * 0.022;
        ctx.strokeStyle = rgba(inLight > 0.3 ? '#fff2d8' : '#eef3ff', (0.55 - i * 0.12) * (0.6 + 0.4 * inLight) * fade);
        ctx.lineWidth = (1.8 - i * 0.3) / c.s;
        ctx.beginPath();
        ctx.moveTo(xx - 0.01, POND.y - POND.ry);
        ctx.quadraticCurveTo(xx + 0.018, POND.y, xx - 0.01, POND.y + POND.ry);
        ctx.stroke();
      }
      ctx.restore();
    }
    // the drop of light rising from the water to the vessel (a wave's settle)
    if (a && a.id === 'lzy' && sim.block.what === 'settle') {
      const kk = sim.blockK;
      if (kk > 0.3 && kk < 0.58) {
        const u = (kk - 0.3) / 0.28;
        const sx = POND.x + POND.rx * 0.5, sy = POND.y, ex = VESSEL.x, ey = VESSEL.y - 0.04;
        const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 0.12;
        const x = (1 - u) ** 2 * sx + 2 * (1 - u) * u * mx + u * u * ex, y = (1 - u) ** 2 * sy + 2 * (1 - u) * u * my + u * u * ey;
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.gold, x, y, 0.022, 0.9);
        glow(ctx, this.scene.sprites.white, x, y, 0.008, 1);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // the stones let fall glow on the bottom
    const fallen = sim.acts.filter(s => s.kind === 'drop' && s.done === 'focus');
    if (fallen.length) {
      ctx.save();
      ctx.clip(water);
      ctx.globalCompositeOperation = 'lighter';
      fallen.forEach((s, i) => {
        const dropK = s === sim.act && sim.block.what === 'settle' ? clamp(sim.blockK * 1.5) : 1;
        glow(ctx, this.scene.sprites.gold, POND.x + (i - (fallen.length - 1) / 2) * 0.05, POND.y + 0.01, 0.04, 0.35 * dropK, 0.016);
      });
      ctx.restore();
    }
    // rings on the water
    for (const r of this.rings) {
      const u = (this.time - r.t0) / 4;
      for (let j = 0; j < (r.big ? 3 : 2); j++) {
        const uu = u - j * 0.12;
        if (uu <= 0) continue;
        const rx = (r.big ? 0.26 : 0.14) * ease.outCubic(clamp(uu)), ry = rx * (POND.ry / POND.rx) * 1.3;
        ctx.strokeStyle = rgba('#eef4ff', 0.5 * (1 - clamp(uu)));
        ctx.lineWidth = 1.4 / c.s;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rx, ry, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // the stone falling from the hands into the water, and its splash
    if (this.dropAt >= 0) {
      const u = (this.time - this.dropAt) / 0.9;
      if (u >= 1 && u < 1.1 && !this.rings.some(r => r.t0 >= this.dropAt + 0.85)) {
        this.rings.push({ x: POND.x, y: POND.y, t0: this.time, big: true });
        for (let i = 0; i < 18; i++) {
          const an = -Math.PI * (0.15 + 0.7 * Math.random());
          this.parts.push({ x: POND.x, y: POND.y, vx: Math.cos(an) * 0.08, vy: Math.sin(an) * 0.12, age: 0, life: 0.7, size: 0.003, kind: 'splash' });
        }
      }
      if (u > 3) this.dropAt = -1;
    }
    // the boat (List)
    this.drawBoat(ctx, sim, k, c);
  }

  /** Where the boat is (world), its size (its share of the near size), how folded, and its fade. */
  private boatAt(sim: GardenSim, a: ActRun): { x: number; y: number; s: number; fold: number; alpha: number } {
    const acts = sim.actsAt(a.station);
    const v = (x: ActRun) => this.vp[sim.acts.indexOf(x)] ?? 0;
    let fold = 0, sail = 0;
    for (const x of acts) {
      if (x.kind === 'fold') fold = Math.max(fold, v(x));
      if (x.kind === 'sail') { fold = 1; sail = Math.max(sail, v(x)); }
      if (x.kind === 'foldSail') { fold = Math.max(fold, clamp(v(x) / 0.45)); sail = Math.max(sail, clamp((v(x) - 0.45) / 0.55)); }
    }
    const last = acts[acts.length - 1];
    const drift = sim.block.what === 'settle' && sim.act === last ? sim.blockK : sim.block.station > a.station || sim.place === 'dawn' || sim.place === 'close' ? 1 : 0;
    const L0 = { x: POND.x - 0.12, y: POND.y + 0.05 }, L1 = { x: POND.x + 0.24, y: POND.y - 0.045 }, L2 = { x: POND.x + 0.4, y: POND.y - 0.07 };
    const e = ease.inOutSine(sail);
    let x = L0.x + (L1.x - L0.x) * e, y = L0.y + (L1.y - L0.y) * e, s = 1 - 0.45 * e;
    if (drift > 0) {
      x += (L2.x - L1.x) * drift * sail;
      y += (L2.y - L1.y) * drift * sail;
      s -= 0.2 * drift * sail;
    }
    return { x, y, s, fold, alpha: 1 - clamp((drift - 0.7) / 0.3) * (sim.block.station > a.station || sim.place !== 'arrive' && sim.block.station !== a.station ? 1 : 0.85) };
  }

  private drawBoat(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number, c: Cam): void {
    const list = sim.acts.find(a => a.id === 'list');
    if (!list) return;
    const here = sim.block.station === list.station;
    if (!here) return;
    const b = this.boatAt(sim, list);
    if (b.fold < 0.3 || b.alpha <= 0.01) return;
    const show = clamp((b.fold - 0.3) / 0.4);
    const W = 0.07 * b.s;
    ctx.save();
    ctx.globalAlpha = show * b.alpha;
    ctx.translate(b.x, b.y);
    // its reflection
    ctx.save();
    ctx.scale(1, -0.6);
    ctx.globalAlpha *= 0.35;
    this.boatShape(ctx, W, '#c9c2b4');
    ctx.restore();
    this.boatShape(ctx, W, '#f5efe2');
    // the small light in it
    ctx.globalCompositeOperation = 'lighter';
    const fl = this.o.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(this.time * 7) * Math.sin(this.time * 3.1);
    glow(ctx, this.scene.sprites.warm, 0, -W * 0.18, W * 1.4, 0.75 * fl);
    glow(ctx, this.scene.sprites.white, 0, -W * 0.2, W * 0.25, 0.9);
    ctx.restore();
    void k;
    void c;
  }

  private boatShape(ctx: CanvasRenderingContext2D, W: number, col: string): void {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-W * 0.5, 0);
    ctx.lineTo(W * 0.5, 0);
    ctx.lineTo(W * 0.34, W * 0.2);
    ctx.lineTo(-W * 0.34, W * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(col, 0.92);
    ctx.beginPath();
    ctx.moveTo(-W * 0.26, 0);
    ctx.lineTo(0, -W * 0.42);
    ctx.lineTo(W * 0.26, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,80,0.45)';
    ctx.lineWidth = W * 0.02;
    ctx.beginPath();
    ctx.moveTo(0, -W * 0.42);
    ctx.lineTo(0, W * 0.2);
    ctx.stroke();
  }

  // ── the lanterns (Latarnie) ────────────────────────────────────

  /** How lit each lantern is (0..1). */
  private lit(sim: GardenSim): number[] {
    const n = sim.view.lanterns.length;
    const out = new Array<number>(n).fill(0);
    const acts = sim.acts.filter(a => a.id === 'latarnie');
    if (!acts.length) return out;
    for (const a of acts) out[a.item] = Math.max(out[a.item], this.vp[sim.acts.indexOf(a)] ?? 0);
    // the lanterns no act reached kindle softly with the last one's blessing
    const last = acts[acts.length - 1];
    const others = sim.block.station > last.station || sim.place === 'dawn' || sim.place === 'close' ? 1
      : sim.act === last && sim.block.what === 'settle' ? clamp(sim.blockK * 1.4) : 0;
    if (acts.length < n) for (let i = 0; i < n; i++) if (!acts.some(a => a.item === i)) out[i] = others;
    return out;
  }

  private drawLanterns(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number, c: Cam, d: number): void {
    if (!sim.acts.some(a => a.id === 'latarnie')) return;
    this.scene.setWorld(ctx, c, d);
    const n = sim.view.lanterns.length, lit = this.lit(sim);
    for (let i = 0; i < n; i++) {
      const q = lanternAt(i, n), L = lit[i];
      const s = q.s, x = q.x, top = q.y - 0.1 * s;
      // the post
      ctx.fillStyle = pal('wood', k);
      ctx.fillRect(x - 0.003 * s, top, 0.006 * s, 0.1 * s);
      ctx.fillRect(x - 0.012 * s, top - 0.004 * s, 0.024 * s, 0.005 * s);
      // the light on the ground
      const fl = this.o.reducedMotion ? 1 : 0.9 + 0.1 * Math.sin(this.time * 6 + i * 2) * Math.sin(this.time * 2.3 + i);
      if (L > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.warm, x, q.y, 0.09 * s, 0.32 * L * fl, 0.025 * s);
        glow(ctx, this.scene.sprites.warm, x, top - 0.03 * s, 0.1 * s, 0.45 * L * fl);
        ctx.globalCompositeOperation = 'source-over';
      }
      // the paper lantern: pale by moonlight, warm when lit
      const cy = top - 0.032 * s, rx = 0.024 * s, ry = 0.03 * s;
      const paper = L > 0.01 ? `rgb(${Math.round(214 + 41 * L)},${Math.round(206 + 10 * L)},${Math.round(190 - 60 * L)})` : '#d6cebe';
      ctx.globalAlpha = 0.45 + 0.55 * Math.max(L, k * 0.6);
      ctx.fillStyle = paper;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba('#5a4030', 0.45);
      ctx.lineWidth = 0.8 / c.s;
      ctx.beginPath();
      for (let r = -2; r <= 2; r++) {
        const yy = cy + (r / 3) * ry;
        const half = rx * Math.sqrt(Math.max(0, 1 - ((yy - cy) / ry) ** 2));
        ctx.moveTo(x - half, yy);
        ctx.quadraticCurveTo(x, yy + 0.004 * s, x + half, yy);
      }
      ctx.stroke();
      ctx.fillStyle = pal('wood', k);
      ctx.fillRect(x - rx * 0.45, cy - ry - 0.004 * s, rx * 0.9, 0.006 * s);
      ctx.fillRect(x - rx * 0.45, cy + ry - 0.002 * s, rx * 0.9, 0.006 * s);
      if (L > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.gold, x, cy, rx * 1.3, 0.85 * L * fl);
        glow(ctx, this.scene.sprites.white, x, cy + ry * 0.15, rx * 0.35, L);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  // ── the bed (Nasiona) ──────────────────────────────────────────

  private drawBed(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number, c: Cam, d: number): void {
    const acts = sim.acts.filter(a => a.id === 'nasiona');
    if (!acts.length) return;
    this.scene.setWorld(ctx, c, d);
    const seeds = sim.view.seeds.length || 1;
    const sow = acts.filter(a => a.kind === 'sow');
    const tend = acts.filter(a => a.kind === 'tend').reduce((s, a) => s + (this.vp[sim.acts.indexOf(a)] ?? 0), 0);
    const cur = sim.act;
    const rainGrow = cur && cur.id === 'nasiona' && sim.block.what === 'settle' ? sim.blockK * 0.2 : 0;
    const here = sim.station === 'nasiona';
    sow.forEach(a => {
      const v = this.vp[sim.acts.indexOf(a)] ?? 0;
      const q = seedAt(a.item, Math.max(seeds, sow.length));
      const begun = a.done || sim.act === a || (here && sim.block.what !== 'open') || sim.block.station > a.station || sim.place === 'dawn';
      if (!begun && !here) return;
      const settled = sow.indexOf(a) < sow.indexOf(cur as ActRun) || (cur !== a && a.done) ? 1 : 0;
      // the seed descends into the soil, then the sprout rises
      const dv = clamp(v / 0.5), gv = clamp((v - 0.5) / 0.5);
      const growth = gv * (0.6 + 0.4 * Math.min(1, tend / Math.max(1, acts.length - sow.length) + rainGrow + settled * 0.1)) + 0.3 * tend;
      if (dv < 1) {
        const y = q.y - 0.05 * (1 - ease.inOutSine(dv));
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.gold, q.x, y, 0.02, 0.7);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#f4d58a';
        ctx.beginPath();
        ctx.ellipse(q.x, y, 0.0045, 0.0065, 0.3, 0, TAU);
        ctx.fill();
      }
      if (gv > 0) this.drawSprout(ctx, q.x, q.y, Math.min(1.6, growth), k, c);
    });
  }

  private drawSprout(ctx: CanvasRenderingContext2D, x: number, y: number, g: number, k: number, c: Cam): void {
    const h = 0.045 * g;
    ctx.strokeStyle = pal('ivyHi', Math.max(0.5, k));
    ctx.lineWidth = 1.8 / c.s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 0.004, y - h * 0.5, x, y - h);
    ctx.stroke();
    ctx.fillStyle = '#8ccf6a';
    const leaf = (an: number, L: number, yy: number) => {
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(an) * L * 0.5, yy, L * 0.5, L * 0.22, an, 0, TAU);
      ctx.fill();
    };
    const open = clamp(g * 1.5);
    leaf(-0.4, 0.016 * open, y - h);
    leaf(Math.PI + 0.4, 0.016 * open, y - h);
    if (g > 0.9) { leaf(-0.6, 0.012 * (g - 0.9) * 2, y - h * 0.55); leaf(Math.PI + 0.6, 0.012 * (g - 0.9) * 2, y - h * 0.6); }
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, this.scene.sprites.gold, x, y - h, 0.012, 0.25 * (1 - k * 0.5));
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── the flowers grown by focus: buds in the night, opening at dawn ──

  private drawFlowers(ctx: CanvasRenderingContext2D, sim: GardenSim, k: number, c: Cam, d: number): void {
    const F = sim.flowers;
    if (!F.length) return;
    this.scene.setWorld(ctx, c, d);
    const n = F.length;
    const order = F.map((f, i) => ({ f, i })).sort((a, b) => a.f.spot.y - b.f.spot.y);
    for (const { f, i } of order) {
      const open = sim.bloomOf(i, n);
      const sp = f.spot, s = sp.s;
      const r = 0.02 * s, stem = 0.044 * s;
      const col = BLOOMS[sp.hue % BLOOMS.length];
      // the stem and two leaves
      ctx.strokeStyle = pal('ivyHi', Math.max(0.3, k));
      ctx.lineWidth = 1.2 / c.s;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.quadraticCurveTo(sp.x + 0.003 * s, sp.y - stem * 0.5, sp.x, sp.y - stem);
      ctx.stroke();
      ctx.fillStyle = pal('ivyHi', Math.max(0.3, k));
      ctx.beginPath();
      ctx.ellipse(sp.x - 0.008 * s, sp.y - stem * 0.32, 0.01 * s, 0.0035 * s, -0.5, 0, TAU);
      ctx.ellipse(sp.x + 0.008 * s, sp.y - stem * 0.5, 0.01 * s, 0.0035 * s, 0.5, 0, TAU);
      ctx.fill();
      const fx = sp.x, fy = sp.y - stem;
      // a newborn bud's small light
      const born = this.bornGlow.get(i);
      if (born !== undefined && this.time - born < 2.5) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.gold, fx, fy, 0.03 * s, 0.8 * (1 - (this.time - born) / 2.5));
        ctx.globalCompositeOperation = 'source-over';
      }
      if (open < 0.02) {
        // the bud, closed: a teardrop with a hint of its colour
        ctx.fillStyle = mixCol(pal('ivyHi', Math.max(0.3, k)), col.deep, 0.35 + 0.25 * k);
        ctx.beginPath();
        ctx.ellipse(fx, fy - r * 0.35, r * 0.32, r * 0.6, 0, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.gold, fx, fy - r * 0.3, r * 1.2, 0.18);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      // the bloom: five petals unfolding, its heart
      const e = ease.outCubic(open);
      const petals = 5 + (sp.hue % 2);
      for (let p = 0; p < petals; p++) {
        const an = (p / petals) * TAU - Math.PI / 2 + i;
        const L = r * (0.45 + 0.75 * e);
        ctx.fillStyle = p % 2 ? col.deep : col.petal;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(an) * L * 0.55, fy + Math.sin(an) * L * 0.42, L * 0.55, L * 0.3, an, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = col.heart;
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.22, 0, TAU);
      ctx.fill();
      if (k > 0.7) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.white, fx, fy, r * 1.4, 0.12 * e);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  private drawParts(ctx: CanvasRenderingContext2D, c: Cam, d: number): void {
    if (!this.parts.length) return;
    this.scene.setWorld(ctx, c, d);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const u = p.age / p.life, a = Math.sin(Math.PI * u);
      if (p.kind === 'rain') {
        ctx.strokeStyle = rgba('#fff0c0', 0.7 * a);
        ctx.lineWidth = 1.3 / c.s;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.05, p.y - 0.02);
        ctx.stroke();
      } else if (p.kind === 'splash') {
        ctx.fillStyle = rgba('#e8f2ff', 0.8 * a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      } else {
        glow(ctx, this.scene.sprites.gold, p.x, p.y, p.size * 3, 0.8 * a);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── through the player's eyes: the hands on the heart (Dłoń) ───

  private drawDlon(ctx: CanvasRenderingContext2D, sim: GardenSim): void {
    const l = this.l, a = this.fp;
    // a warm, dim veil over the blurred garden
    ctx.fillStyle = `rgba(10,8,18,${0.38 * a})`;
    ctx.fillRect(0, 0, l.w, l.h);
    const acts = sim.acts.filter(x => x.id === 'dlon');
    if (!acts.length) return;
    const cur = sim.act && sim.act.id === 'dlon' ? sim.act : null;
    const n = acts.length;
    const done = acts.filter(x => x.done).length;
    const v = cur ? this.vp[sim.acts.indexOf(cur)] ?? 0 : 0;
    // the warmth grows in each settle, and with the words written
    const settle = sim.block.what === 'settle' ? sim.blockK : 0;
    const warm = clamp(0.25 + 0.45 * ((done + (cur && sim.block.what === 'act' ? v : 0)) / n) + 0.3 * settle);
    const H = l.hands, px = H.px;
    const breath = sim.restBlock ? sim.breath.k : 0.5;
    const bob = this.o.reducedMotion ? 0 : (breath - 0.5) * px * 0.06;
    const hx = H.cx, heartY = H.cy - px * 0.2, bellyY = H.cy + px * 0.42;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, this.scene.sprites.rose, hx + px * 0.05, heartY - bob, px * (0.7 + 0.2 * warm), (0.25 + 0.45 * warm) * a);
    glow(ctx, this.scene.sprites.warm, hx - px * 0.05, bellyY - bob * 0.7, px * (0.65 + 0.2 * warm), (0.2 + 0.4 * warm) * a);
    ctx.globalCompositeOperation = 'source-over';
    drawRestingHand(ctx, hx + px * 0.12, heartY - bob, px * 0.62, -0.22, true, a * (0.75 + 0.25 * warm));
    drawRestingHand(ctx, hx - px * 0.14, bellyY - bob * 0.7, px * 0.62, 0.22, false, a * (0.75 + 0.25 * warm));
    // the harsh word fading, the kind word written in light over it
    const view = sim.view;
    const top = l.view.y + l.title.h + 10;
    const midY = Math.min(heartY - px * 0.42, top + (heartY - px * 0.42 - top) * 0.55);
    const size = Math.round(Math.max(20, Math.min(34, l.font * 1.8)));
    const fadeH = clamp((done + (cur && sim.block.what === 'act' ? v : 0)) / Math.max(1, Math.min(n, 2)));
    if (view.harsh) {
      ctx.save();
      ctx.font = `italic 400 ${Math.round(size * 0.72)}px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = this.wrapped(ctx, view.harsh, l.view.w - 40);
      ctx.globalAlpha = a * (1 - fadeH) * 0.85;
      ctx.fillStyle = '#9c98a6';
      lines.forEach((s, i) => ctx.fillText(s, l.view.x + l.view.w / 2, midY - size * 0.95 - (lines.length - 1 - i) * size * 0.8));
      ctx.restore();
    }
    // the kind word: written letter by letter with focus; once written it stays, brighter with each writing
    const kind = view.kind;
    const writtenOnce = acts.some(x => x.done);
    const chars = cur && sim.block.what === 'act' && !(writtenOnce && cur.i > 0) ? v * [...kind].length : [...kind].length;
    const shown = writtenOnce || (cur && sim.block.what === 'act') || sim.block.what === 'settle';
    if (shown) this.drawWritten(ctx, kind, l.view.x + l.view.w / 2, midY, size, chars, a, warm, cur && sim.block.what === 'act' ? v : 1, writtenOnce && !!cur && cur.i > 0 && sim.block.what === 'act');
  }

  /** The kind word written in light: `chars` of it shown (a fraction for the letter being written), a pen of light. */
  private drawWritten(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, chars: number, a: number, warm: number, v: number, retrace: boolean): void {
    ctx.save();
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    ctx.textBaseline = 'middle';
    const l = this.l;
    const lines = this.wrapped(ctx, text, l.view.w - 32);
    const lh = size * 1.18;
    let left = chars;
    const y0 = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, li) => {
      const cs = [...line];
      const w = ctx.measureText(line).width;
      let x = cx - w / 2;
      const y = y0 + li * lh;
      ctx.shadowColor = 'rgba(255,190,110,0.75)';
      ctx.shadowBlur = 14 + 10 * warm;
      for (let i = 0; i < cs.length; i++) {
        const ch = cs[i];
        const cw = ctx.measureText(ch).width;
        const vis = clamp(left);
        if (vis > 0) {
          ctx.globalAlpha = a * vis;
          ctx.fillStyle = retrace ? mixCol('#fff1c4', '#ffd27a', v) : GOLD_HI;
          ctx.fillText(ch, x, y);
          if (vis < 1 && !retrace) {
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, this.scene.sprites.gold, x + cw, y, size * 0.7, a);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        left -= 1;
        x += cw;
      }
      left -= 0;
    });
    ctx.restore();
  }

  // ── through the player's eyes: the stone in the open hands (Kamienie) ──

  private drawStoneHands(ctx: CanvasRenderingContext2D, sim: GardenSim): void {
    const l = this.l, H = l.hands, px = H.px;
    const a = sim.act && sim.act.id === 'kamienie' ? sim.act : null;
    const inAct = a && sim.block.what === 'act';
    const inSettle = a && sim.block.what === 'settle';
    const fade = sim.block.what === 'open' ? clamp(sim.blockT / 1.5) : 1;
    // the edges darken: the eyes are on the hands and the water
    const vg = ctx.createRadialGradient(l.view.x + l.view.w / 2, l.view.y + l.view.h * 0.45, Math.min(l.w, l.h) * 0.3, l.view.x + l.view.w / 2, l.view.y + l.view.h * 0.45, Math.hypot(l.w, l.h) * 0.6);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(4,4,12,${0.5 * fade})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, l.w, l.h);
    if (!a && sim.block.what !== 'open') return;
    const v = a ? this.vp[sim.acts.indexOf(a)] ?? 0 : 0;
    const drop = a && a.kind === 'drop';
    const fell = drop && a!.done === 'focus';
    const open = drop ? (fell ? 1 : v) : 0;
    const warm = a && a.kind === 'hold' ? v : a && a.done === 'kept' ? 1 : 0;
    const breath = sim.restBlock ? sim.breath.k : 0.5;
    const bob = this.o.reducedMotion ? 0 : (breath - 0.5) * px * 0.03;
    const x = H.cx, y = H.cy - bob;
    // the hands: the cupped pair, parting as the fingers open; warmer while held
    const hpx = px * 0.92;
    const handA = fade * (fell && inSettle ? 1 - clamp(sim.blockK * 2) : 1);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, this.scene.sprites.warm, x, y - hpx * 0.1, hpx * (0.6 + 0.3 * warm), (0.15 + 0.4 * warm) * handA);
    ctx.globalCompositeOperation = 'source-over';
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.beginPath();
      if (side < 0) ctx.rect(0, 0, x, l.h);
      else ctx.rect(x, 0, l.w - x, l.h);
      ctx.clip();
      const pivX = x + side * hpx * 0.35, pivY = y + hpx * 0.6;
      ctx.translate(pivX, pivY);
      ctx.rotate(side * open * 0.42);
      ctx.translate(-pivX, -pivY);
      drawHands(ctx, x, y, hpx, handA);
      ctx.restore();
    }
    if (!a) return;
    // the stone: resting in the hands, sliding as they open, falling into the water
    const restY = y - hpx * 0.06;
    let sx = x, sy = restY + open * hpx * 0.12, sr = hpx * 0.17, sa = 1;
    if (fell) {
      const u = clamp((this.time - this.dropAt) / 0.9);
      if (this.dropAt < 0 || u >= 1) sa = 0;
      else {
        const ex = this.X(POND.x), ey = this.Y(POND.y);
        sx = sx + (ex - sx) * u;
        sy = sy + (ey - sy) * ease.outCubic(u) - Math.sin(Math.PI * u) * hpx * 0.15;
        sr = sr * (1 - 0.8 * u);
      }
    }
    if (sa > 0) {
      const g = ctx.createRadialGradient(sx - sr * 0.35, sy - sr * 0.35, sr * 0.1, sx, sy, sr * 1.1);
      g.addColorStop(0, '#9aa0b0');
      g.addColorStop(0.55, '#5c6274');
      g.addColorStop(1, '#2c303e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr * 1.25, sr * 0.82, -0.12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(sx - sr * 0.4, sy - sr * 0.35, sr * 0.4, sr * 0.16, -0.4, 0, TAU);
      ctx.fill();
      if (warm > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, this.scene.sprites.warm, sx, sy, sr * 2, 0.3 * warm);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // the stone's word, over it (gone with it when it falls)
    if (a.word && sa > 0 && !(fell && this.dropAt >= 0 && this.time - this.dropAt > 0.2)) {
      this.wordPill(ctx, a.word, x, restY - hpx * 0.42, fade, 1);
    }
    // "not yet": said gently, never a pressure
    const caption = a.kind === 'hold' && inAct ? t('scene.notYet') : a.done === 'kept' && inSettle ? t('scene.keep') : '';
    if (caption) {
      ctx.save();
      const size = Math.max(14, Math.round(l.font));
      ctx.font = `italic 500 ${size}px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffe9c8';
      ctx.globalAlpha = fade * clamp(sim.blockT / 1.2);
      ctx.fillText(caption, x, Math.max(l.view.y + l.title.h + size, restY - hpx * 0.75), l.view.w - 20);
      ctx.restore();
    }
  }

  // ── the words in the garden ────────────────────────────────────

  /** A word in a gentle serif on a soft dark pill (the player's words in the scene). */
  private wordPill(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, a: number, extra: number, size0?: number): void {
    const l = this.l;
    const size = size0 ?? Math.max(15, Math.min(22, l.font + 3));
    ctx.save();
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = l.view.w - 24;
    let text = word;
    while (ctx.measureText(text).width > maxW && text.length > 3) text = `${text.slice(0, -2)}…`;
    const tw = ctx.measureText(text).width;
    const xx = Math.max(l.view.x + tw / 2 + 14, Math.min(l.view.x + l.view.w - tw / 2 - 14, x));
    const yy = Math.max(l.view.y + size, Math.min(l.view.y + l.view.h - size, y));
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = 'rgba(8,8,20,0.58)';
    roundRect(ctx, xx - tw / 2 - 12, yy - size * 0.75, tw + 24, size * 1.5, size * 0.75);
    ctx.fill();
    ctx.fillStyle = `rgba(250,240,224,${Math.min(1, 0.9 + 0.1 * extra)})`;
    ctx.fillText(text, xx, yy + 1);
    ctx.restore();
  }

  /** The words of the scene in screen px: the wave's feeling, the letter, the bounds beyond the gate, the lanterns' and the seeds' names, the name at dawn. */
  private drawSceneWords(ctx: CanvasRenderingContext2D, sim: GardenSim): void {
    const l = this.l, a = sim.act;
    const glowUp = sim.t < sim.reshowUntil ? 1 : 0;
    // Łzy: the feeling on its wave; in the settle it sinks
    if (a && a.id === 'lzy') {
      const v = this.vp[sim.acts.indexOf(a)] ?? 0;
      if (sim.block.what === 'act') {
        const x = this.X(POND.x - POND.rx * 0.92 + v * POND.rx * 1.84);
        const inLight = 1 - clamp(Math.abs(v - 0.5) / 0.25);
        const fadeOut = 1 - clamp((v - 0.9) / 0.1);
        this.waterWord(ctx, a.word, x, this.Y(POND.y) - 16, clamp(sim.blockT / 1) * fadeOut, inLight, glowUp);
      } else if (sim.block.what === 'settle' && sim.blockK < 0.32) {
        const u = sim.blockK / 0.32;
        this.waterWord(ctx, a.word, this.X(POND.x + POND.rx * 0.5), this.Y(POND.y) - 16 + u * 14, 1 - u, 0, glowUp);
      }
    }
    // List: the letter, close up, before it folds
    const list = sim.acts.find(x => x.id === 'list');
    if (list && sim.block.station === list.station) this.drawLetter(ctx, sim, list);
    // Furtka: what keeps reopening the wound, beyond the gate (fading into mist once it is closed)
    const fa = sim.acts.find(x => x.id === 'furtka');
    if (fa && (sim.block.station === fa.station)) {
      const st = this.gateState(sim);
      const words = sim.view.bounds;
      const k0 = sim.block.what === 'open' ? clamp(sim.blockT / 1.5) : 1;
      words.forEach((w, i) => {
        const n = words.length;
        const wx = GATE.x + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.5) + (this.o.reducedMotion ? 0 : 0.01 * Math.sin(this.time * 0.4 + i));
        const rise = st.mist * 0.08;
        const wy = WALL.top - 0.05 - (i % 2) * 0.045 - rise;
        const al = k0 * (st.close < 0.999 ? 0.85 : 0.85 * (1 - st.mist));
        if (al > 0.01) this.mistWord(ctx, w, this.X(wx), this.Y(wy), al);
      });
      // "for the time of healing", on the closed gate
      if (st.close > 0.9) {
        ctx.save();
        const size = Math.max(14, Math.round(l.font));
        ctx.font = `italic 500 ${size}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = clamp((st.close - 0.9) / 0.1);
        ctx.fillStyle = '#ffe6c0';
        ctx.fillText(t('scene.healing'), this.X(GATE.x), Math.min(this.Y(WALL.base) + size * 1.3, l.view.y + l.view.h - size));
        ctx.restore();
      }
    }
    // Latarnie: each lantern's name on its paper (at the path)
    const la = sim.acts.find(x => x.id === 'latarnie');
    if (la && sim.block.station === la.station) {
      const n = sim.view.lanterns.length, lit = this.lit(sim);
      const cur = a && a.id === 'latarnie' ? a.item : -1;
      for (let i = 0; i < n; i++) {
        const q = lanternAt(i, n);
        const x = this.X(q.x), y = this.Y(q.y - 0.1 * q.s - 0.075 * q.s);
        this.tag(ctx, sim.lanternText(i), x, y, i === cur ? 1 : 0.62 + 0.38 * lit[i], i === cur);
      }
    }
    // Nasiona: each seed's word on a little stick
    const na = sim.acts.find(x => x.id === 'nasiona');
    if (na && sim.block.station === na.station) {
      const seeds = sim.view.seeds;
      seeds.forEach((w, i) => {
        if (!sim.acts.some(x => x.id === 'nasiona' && x.kind === 'sow' && x.item === i)) return;
        const q = seedAt(i, seeds.length);
        const cur = a && a.kind === 'sow' && a.item === i;
        this.tag(ctx, w, this.X(q.x), this.Y(q.y + 0.045), cur ? 1 : 0.8, !!cur);
      });
    }
    // the dawn: the name in light
    if (sim.block.what === 'call' && sim.callPhase === 'name' && sim.name) this.drawName(ctx, sim, sim.name);
  }

  /** A word on the water: a gentle serif, a dark halo, golden in the light. */
  private waterWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, a: number, light: number, extra: number): void {
    if (!word || a <= 0.01) return;
    const l = this.l;
    const size = Math.max(16, Math.min(26, l.font + 5));
    ctx.save();
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(word).width;
    const xx = Math.max(l.view.x + tw / 2 + 8, Math.min(l.view.x + l.view.w - tw / 2 - 8, x));
    ctx.globalAlpha = clamp(a);
    ctx.shadowColor = 'rgba(0,0,10,0.9)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = mixCol('#eef2ff', '#ffe2a0', clamp(light + extra * 0.4));
    ctx.fillText(word, xx, y);
    if (light > 0.05) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = rgba('#ffc870', 0.8 * light);
      ctx.fillText(word, xx, y);
    }
    ctx.restore();
  }

  /** A word beyond the wall: pale, in the mist. */
  private mistWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, a: number): void {
    const l = this.l;
    const size = Math.max(14, Math.min(20, l.font + 1));
    ctx.save();
    ctx.font = `italic 400 ${size}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(word).width;
    const xx = Math.max(l.view.x + tw / 2 + 6, Math.min(l.view.x + l.view.w - tw / 2 - 6, x));
    const yy = Math.max(l.view.y + l.title.h + size, y);
    ctx.globalAlpha = clamp(a);
    ctx.shadowColor = 'rgba(0,0,12,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#d8deef';
    ctx.fillText(word, xx, yy);
    ctx.restore();
  }

  /** A small paper tag with a name (a lantern's, a seed's). */
  private tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, a: number, on: boolean): void {
    if (!text) return;
    const l = this.l;
    const size = on ? Math.max(15, Math.round(l.font + 1)) : Math.max(13, Math.round(l.font - 1));
    ctx.save();
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // a long name ("Dla wszystkich ze złamanym sercem") wraps to a second line rather than losing its end; only what
    // still does not fit two lines ends in "…"
    const maxW = Math.min(220, l.view.w * 0.6);
    const lines: string[] = [];
    let cur = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && ctx.measureText(next).width > maxW) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    if (lines.length > 2) lines.splice(1, lines.length - 1, lines.slice(1).join(' '));
    for (let i = 0; i < lines.length; i++) {
      let t = lines[i];
      while (ctx.measureText(t).width > maxW && t.length > 3) t = `${t.slice(0, -2)}…`;
      lines[i] = t;
    }
    const lh = size * 1.18;
    const tw = Math.max(...lines.map(t => ctx.measureText(t).width));
    const th = size * 1.44 + (lines.length - 1) * lh;
    const xx = Math.max(l.view.x + tw / 2 + 10, Math.min(l.view.x + l.view.w - tw / 2 - 10, x));
    // the tag grows upward from where a one-line tag would stand
    const y1 = y - ((lines.length - 1) * lh) / 2;
    const yy = Math.max(l.view.y + l.title.h + th / 2, Math.min(l.view.y + l.view.h - th / 2, y1));
    ctx.globalAlpha = clamp(a);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = on ? '#fff3dc' : '#efe4cf';
    roundRect(ctx, xx - tw / 2 - 9, yy - th / 2, tw + 18, th, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (on) {
      ctx.strokeStyle = rgba(GOLD, 0.9);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#3a2618';
    lines.forEach((t, i) => ctx.fillText(t, xx, yy - ((lines.length - 1) * lh) / 2 + i * lh + 1));
    ctx.restore();
  }

  /** The letter, close up: its first lines in a handwritten serif, the rest fading; it folds and goes to the water. */
  private drawLetter(ctx: CanvasRenderingContext2D, sim: GardenSim, list: ActRun): void {
    const l = this.l;
    const b = this.boatAt(sim, list);
    if (b.fold >= 0.75) return;
    const open = sim.block.what === 'open' ? clamp((sim.blockT - 1.5) / 1.5) : 1;
    const f = b.fold;
    const W0 = Math.min(l.view.w * 0.72, 400), H0 = W0 * 0.66;
    const cx0 = l.view.x + l.view.w / 2, cy0 = l.view.y + l.title.h + 8 + H0 / 2;
    const tx = this.X(b.x), ty = this.Y(b.y);
    const e = ease.inOutSine(clamp(f / 0.75));
    const cx = cx0 + (tx - cx0) * e, cy = cy0 + (ty - cy0) * e;
    const sc = 1 - 0.85 * e;
    const W = W0 * sc, H = H0 * sc * (1 - 0.5 * clamp((f - 0.3) / 0.45));
    const alpha = open * (1 - clamp((f - 0.55) / 0.2));
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(-0.025 * (1 - e));
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f3ecdc';
    ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.shadowBlur = 0;
    // the paper's warm edge, and a faint fold across it
    const pg = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
    pg.addColorStop(0, 'rgba(255,250,236,0.6)');
    pg.addColorStop(1, 'rgba(200,180,150,0.25)');
    ctx.fillStyle = pg;
    ctx.fillRect(-W / 2, -H / 2, W, H);
    const text = sim.letter.trim();
    if (!text) {
      // a sealed letter without words: a seal of light
      ctx.strokeStyle = 'rgba(140,110,80,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-W / 2, -H / 2);
      ctx.lineTo(0, H * 0.08);
      ctx.lineTo(W / 2, -H / 2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.scene.sprites.gold, 0, H * 0.08, W * 0.12, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#c8823a';
      ctx.beginPath();
      ctx.arc(0, H * 0.08, Math.max(4, W * 0.04), 0, TAU);
      ctx.fill();
    } else if (f < 0.35) {
      // the first lines, the rest fading
      const size = Math.max(13, Math.min(18, Math.round(W / 22)));
      ctx.font = `italic 400 ${size}px ${SERIF}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const pad = Math.max(12, W * 0.07);
      const lines = this.wrapped(ctx, text.replace(/\s+/g, ' '), W - 2 * pad);
      const lh = size * 1.38;
      const fit = Math.max(1, Math.floor((H - 2 * pad) / lh));
      const shown = lines.slice(0, fit);
      shown.forEach((s, i) => {
        const fadeLine = i < fit - 2 ? 1 : i === fit - 2 ? 0.6 : 0.3;
        ctx.globalAlpha = alpha * (1 - f / 0.35) * fadeLine;
        ctx.fillStyle = '#3c2c22';
        ctx.fillText(s, -W / 2 + pad, -H / 2 + pad + i * lh);
      });
    }
    ctx.restore();
  }

  /** The name, called at dawn: large, in light. */
  private drawName(ctx: CanvasRenderingContext2D, sim: GardenSim, name: string): void {
    const l = this.l, r = l.name;
    // the name comes after the gardener's words (62 % of the call) — but a short call (under 9 s: the sim goes straight
    // to the name and its sound) shows it at once
    const from = sim.dur < 9 ? 0 : 0.62;
    const k = clamp((sim.blockK - from) / 0.12) * clamp((1 - sim.blockK) / 0.05 + 0.2);
    if (k <= 0.01) return;
    ctx.save();
    let size = Math.round(Math.min(72, r.h * 0.7, l.font * 3.6));
    ctx.font = `italic 600 ${size}px ${SERIF}`;
    while (ctx.measureText(name).width > r.w - 24 && size > 20) {
      size -= 2;
      ctx.font = `italic 600 ${size}px ${SERIF}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = r.x + r.w / 2, y = r.y + r.h / 2;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, this.scene.sprites.gold, x, y, Math.min(r.w * 0.5, size * 3), 0.45 * k);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = k;
    ctx.shadowColor = 'rgba(255,200,120,0.9)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(name, x, y);
    ctx.restore();
  }

  // ── the station's name card ────────────────────────────────────

  private drawTitle(ctx: CanvasRenderingContext2D, sim: GardenSim): void {
    const l = this.l, b = sim.block;
    let name = '', sub = '', a = 0;
    const st = sim.station;
    if (st && (b.what === 'open' || (b.what === 'act' && b.act === 0 && sim.blockT < 3))) {
      name = t(`st.${st}` as Key);
      sub = `${t('station.of', { i: b.station + 1, n: sim.plan.stations.length })} · ${t(`stsub.${st}` as Key)}`;
      a = b.what === 'open' ? clamp(sim.blockT / 1.2) : clamp((3 - sim.blockT) / 1.2);
    } else if (b.what === 'arrive' && sim.blockT < 6) {
      name = t('st.arrive');
      a = clamp(sim.blockT / 1.2) * clamp((6 - sim.blockT) / 1.2);
    } else if (b.what === 'sunrise' && sim.blockT < 6) {
      name = t('st.dawn');
      sub = t('stsub.dawn');
      a = clamp(sim.blockT / 1.2) * clamp((6 - sim.blockT) / 1.2);
    }
    if (a <= 0.01 || !name) return;
    const r = l.title;
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, r.y - 6, 0, r.y + r.h + 10);
    g.addColorStop(0, 'rgba(4,6,16,0.5)');
    g.addColorStop(1, 'rgba(4,6,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y - 6, r.w, r.h + 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const big = Math.round(Math.min(32, Math.max(22, l.font * 1.6)));
    ctx.font = `600 ${big}px ${SERIF}`;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff4e2';
    ctx.fillText(name, r.x + r.w / 2, r.y + 2, r.w - 16);
    if (sub) {
      const small = Math.max(13, Math.round(l.font - 1));
      ctx.font = `500 ${small}px ${FONT}`;
      ctx.fillStyle = 'rgba(244,234,216,0.92)';
      const s = this.fitLine(ctx, sub, r.w - 16);
      ctx.fillText(s, r.x + r.w / 2, r.y + 6 + big);
    }
    ctx.restore();
  }

  private fitLine(ctx: CanvasRenderingContext2D, s: string, w: number): string {
    if (ctx.measureText(s).width <= w) return s;
    let x = s;
    while (x.length > 3 && ctx.measureText(`${x}…`).width > w) x = x.slice(0, -1);
    return `${x.trimEnd()}…`;
  }

  private wrapped(ctx: CanvasRenderingContext2D, text: string, w: number): string[] {
    return wrapLines(ctx, text, Math.max(40, w));
  }

  // ── the band: the narrator, a passage, a blessing, the prayer; the guide; the close ──

  private drawWords(ctx: CanvasRenderingContext2D, sim: GardenSim): void {
    const l = this.l;
    const band = l.band;
    if (sim.block.what === 'close') {
      this.drawClose(ctx, sim, l.closeText);
      return;
    }
    const rest = sim.restBlock;
    if (rest) this.drawGuide(ctx, sim);
    if (sim.block.what === 'prayer') {
      this.drawPrayer(ctx, [t('prayer.1'), t('prayer.2')], band, clamp(sim.blockT / 1.2));
      return;
    }
    if (rest && sim.card) {
      this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8));
      return;
    }
    const bless = sim.blessing;
    if (bless) {
      this.drawPrayer(ctx, [bless], band, clamp(sim.blockT / 1.2) * clamp((sim.left) / 0.8));
      return;
    }
    if (sim.talk.line) {
      const ln = sim.talk.line;
      const a = clamp(ln.t / 0.5) * clamp((ln.dur - ln.t) / 0.6);
      this.drawLine(ctx, ln.text, band, a);
    }
  }

  private drawGuide(ctx: CanvasRenderingContext2D, sim: GardenSim): void {
    const g = this.l.guide;
    const n = Math.min(sim.breaths, sim.breath.n + 1);
    const a = clamp(sim.blockT / 0.8) * clamp(sim.left / 0.6 + 0.2);
    drawBreathGuide(ctx, sim.breath, { cx: g.cx, cy: g.cy, r: g.r, layout: g.layout, maxW: g.maxW, sub: breathOf(n, sim.breaths), alpha: a, reducedMotion: this.o.reducedMotion, time: this.time });
  }

  private drawLine(ctx: CanvasRenderingContext2D, text: string, band: Rect, a: number): void {
    if (a <= 0.01) return;
    ctx.save();
    const { size, lines } = this.fitText(ctx, text, band, Math.round(this.l.font + 1), 1.4, 14, s => `500 ${s}px ${FONT}`);
    ctx.font = `500 ${size}px ${FONT}`;
    const lh = Math.round(size * 1.4);
    const top = band.y + Math.max(0, (band.h - lines.length * lh) / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = a;
    const w = Math.min(band.w, Math.max(...lines.map(s => ctx.measureText(s).width)) + 36);
    ctx.fillStyle = 'rgba(6,6,16,0.5)';
    roundRect(ctx, band.x + (band.w - w) / 2, top - 8, w, lines.length * lh + 14, 14);
    ctx.fill();
    ctx.fillStyle = INK;
    lines.forEach((s, i) => ctx.fillText(s, band.x + band.w / 2, top + i * lh));
    ctx.restore();
  }

  /** A prayer or a blessing: italic serif, whole (smaller rather than cut). */
  private drawPrayer(ctx: CanvasRenderingContext2D, paras: string[], band: Rect, a: number): void {
    if (a <= 0.01) return;
    const l = this.l;
    ctx.save();
    ctx.globalAlpha = a;
    const { size, lines } = this.fitText(ctx, paras, band, Math.round(Math.min(22, l.font + 2)), 1.35, 0, s => `italic 500 ${s}px ${SERIF}`, 24);
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    const lh = Math.round(size * 1.35);
    const top = band.y + Math.max(0, (band.h - lines.length * lh) / 2);
    ctx.fillStyle = 'rgba(6,6,16,0.5)';
    roundRect(ctx, band.x, top - 8, band.w, lines.length * lh + 14, 16);
    ctx.fill();
    ctx.fillStyle = '#fff6e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((s, i) => ctx.fillText(s, band.x + band.w / 2, top + i * lh));
    ctx.restore();
  }

  /**
   * Text (one string, or paragraphs each starting a line) wrapped to `band`'s width less `pad`, at `max` px or smaller —
   * down to 13 — until its lines × `lead` (+ `extra`) fit the band's height.  Kept per text and band size.
   */
  private fitText(ctx: CanvasRenderingContext2D, text: string | string[], band: Rect, max: number, lead: number, extra: number, font: (px: number) => string, pad = 16): { size: number; lines: string[] } {
    const paras = typeof text === 'string' ? [text] : text;
    const key = `${paras.join('\n')}|${Math.round(band.w)}|${Math.round(band.h)}|${max}|${font(1)}`;
    const hit = this.fitCache.get(key);
    if (hit) return hit;
    let size = max, lines: string[] = [];
    for (;;) {
      ctx.font = font(size);
      lines = paras.flatMap(p => wrapLines(ctx, p, band.w - pad));
      if (size <= 13 || lines.length * Math.round(size * lead) + extra <= band.h) break;
      size -= 1;
    }
    const out = { size, lines };
    if (this.fitCache.size > 64) this.fitCache.clear();
    this.fitCache.set(key, out);
    return out;
  }

  private verseLayout(ctx: CanvasRenderingContext2D, id: PassageId, w: number, h: number, max: number): PassageLayout {
    const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
    let lay = this.verseCache.get(key);
    if (!lay) {
      lay = layoutPassage(ctx, passage(id), w, h, { max, min: 13 });
      this.verseCache.set(key, lay);
    }
    return lay;
  }

  private drawVerse(ctx: CanvasRenderingContext2D, id: PassageId, band: Rect, a: number): void {
    if (a <= 0.01) return;
    const max = this.l.kind === 'wide' ? 22 : 17;
    const lay = this.verseLayout(ctx, id, band.w - 24, band.h - 12, max);
    // a passage that would be cut is never shown (the summary carries a whole one)
    if (!lay.fits) return;
    const top = band.y + Math.max(0, (band.h - lay.height) / 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,6,16,0.5)';
    roundRect(ctx, band.x, top - 8, band.w, lay.height + 16, 16);
    ctx.fill();
    drawPassage(ctx, passage(id), lay, band.x + band.w / 2, top, { text: '#fbf3e4', ref: '#e8c77e' });
    ctx.restore();
  }

  private drawClose(ctx: CanvasRenderingContext2D, sim: GardenSim, band: Rect): void {
    const l = this.l;
    const a = clamp(sim.blockT / 1.2);
    const what = sim.closeText;
    if (what === 'prayer') this.drawPrayer(ctx, [t('prayer.1'), t('prayer.2')], band, a);
    else if (what === 'bless') this.drawPrayer(ctx, [t('bless.end')], band, a);
    else if (sim.card) this.drawVerse(ctx, sim.card.id, band, clamp((sim.t - sim.card.t0) / 0.8));
    // how heavy is your heart now (0–10)
    const q = l.rateQ;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const subPx = Math.max(13, Math.round(l.font - 2));
    ctx.font = `500 ${subPx}px ${FONT}`;
    const sub = this.fitLine(ctx, t('rate.sub'), q.w - 16);
    const qw = Math.min(q.w, Math.max(ctx.measureText(sub).width, 200) + 40);
    ctx.fillStyle = 'rgba(6,6,16,0.5)';
    roundRect(ctx, q.x + (q.w - qw) / 2, q.y - 3, qw, Math.round(l.font + 8) + subPx + 6, 12);
    ctx.fill();
    ctx.font = `600 ${Math.round(l.font + 1)}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(this.fitLine(ctx, sim.rating === null ? t('rate.q') : t('rate.done', { n: sim.rating }), q.w - 16), q.x + q.w / 2, q.y + 2);
    ctx.font = `500 ${subPx}px ${FONT}`;
    ctx.fillStyle = 'rgba(240,232,218,0.9)';
    ctx.fillText(sub, q.x + q.w / 2, q.y + Math.round(l.font + 6));
    l.rate.forEach((r, i) => {
      const on = sim.rating === i;
      ctx.fillStyle = on ? rgba(GOLD, 0.92) : 'rgba(14,10,24,0.55)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = on ? rgba(GOLD_HI, 1) : 'rgba(255,236,206,0.42)';
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = on ? '#2a1a06' : '#fbf3e4';
      ctx.font = `700 ${Math.round(l.font + 2)}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), r.x + r.w / 2, r.y + r.h / 2 + 1);
      ctx.textBaseline = 'top';
    });
    ctx.restore();
    void this.rateFlash;
  }

  // ── input ─────────────────────────────────────────────────────

  /** The 0–10 button under a point (−1: none). */
  rateAt(sim: GardenSim, x: number, y: number): number {
    if (!sim.rateOpen || sim.rating !== null) return -1;
    return this.l.rate.findIndex(r => hits(r, x, y));
  }

  hover(sim: GardenSim, x: number, y: number): boolean { return this.rateAt(sim, x, y) >= 0; }

  targets(sim: GardenSim): TapTarget[] {
    if (!sim.rateOpen || sim.rating !== null) return [];
    return this.l.rate.map((r, i) => target(t('rate.label', { n: i }), r, MIN_TAP));
  }

  /** The guide's box (for the audit's text check). */
  guideBox(ctx: CanvasRenderingContext2D, sim: GardenSim): { x: number; y: number; w: number; h: number } {
    const g = this.l.guide;
    return breathGuideBox(ctx, { cx: g.cx, cy: g.cy, r: g.r, layout: g.layout, maxW: g.maxW, sub: breathOf(1, sim.breaths) });
  }
}

/** Mix two "#rrggbb" colours (or a "#rrggbb" and an "rgb(…)" from pal) as "#rrggbb". */
function mixCol(a: string, b: string, k: number): string {
  const parse = (c: string): [number, number, number] => {
    if (c.startsWith('#')) { const v = parseInt(c.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
    const m = c.match(/\d+/g) ?? ['0', '0', '0'];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const p = parse(a), q = parse(b), u = clamp(k);
  return `rgb(${Math.round(p[0] + (q[0] - p[0]) * u)},${Math.round(p[1] + (q[1] - p[1]) * u)},${Math.round(p[2] + (q[2] - p[2]) * u)})`;
}

export type { StationId };
void hash;
void pondAt;
