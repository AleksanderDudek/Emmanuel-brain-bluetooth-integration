/**
 * Synapsy's picture, from the sim's state: a violet night, the two hemispheres seen from above with their gyri
 * and the dendrites of every neuron (a static layer, drawn once per size), and over it each frame —
 *
 *   the band     the frontal poles glow with what the headband reads there (a push block's level), the two
 *                optodes of the band on the forehead; the halves' rhythms ripple out of each hemisphere and
 *                fall into step when the halves are even
 *   links        axons as soft curves, thicker with every synapse, gold where they grow, a pearl myelin sheath
 *                with bright nodes of Ranvier, a fine gold core once consolidated; a new link grows across
 *                with a growth cone; a pruned one fades into motes
 *   thoughts     warm sparks running along the paths (they hop node to node on myelin), lilac habit thoughts,
 *                aqua replays in rest; an arrival flares at the hand or the voice
 *   rest         the glymphatic wash: aqua waves from the midline outward with a 4/6 breath, the waste motes
 *                of the work fading as it passes
 *   the bridge   the corpus callosum's fibres along the midline, its two lanes, gold when the halves are in
 *                step, and its plate (the balance, or "no reading")
 *   Oli          at home in her button (thumb zone), or flying out to wrap an axon; her bubble
 *   the lens     a synapse up close: the spine swells with the growth (the gauge, threshold dashed)
 *   words        the sing-along line, the message strip (a lesson, a Wiedza card), the opening story
 */
import { fmtNum } from '../../i18n';
import { Floaters, Particles, Shake, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import type { Insets } from '../kit/types';
import { HEMI, halfWidth as halfWidthAt, keyOf, type Brain, type IoKind } from './brain';
import { cardSrc, cardText, cardTitle, ioName, lessonLine, lessonTitle, mpsText, type CardId } from './content';
import { t } from './i18n';
import { layout, toScreen, type Layout } from './layout';
import {
  C, SANS, ctx2d, fitFont, fitLines, font, glow, gyri, hash, hemiPath, ioIcon, makeCanvas, mix, neuronBody, paintLens, paintOli, plate, rr, somaCore, withAlpha,
} from './paint';
import { RULES, speedOf } from './rules';
import type { Link, SimEvent, SynapsySim } from './sim';

const TAU = Math.PI * 2;
const SEGS = 14;

interface Geo { pts: { x: number; y: number }[]; len: number }
interface Msg { kind: 'lesson' | 'card' | 'reveal'; title: string; text: string; src?: string; t: number; dur: number }
interface Flare { x: number; y: number; t: number; dur: number; color: string; r: number }

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

export class SynapsyView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private layer: HTMLCanvasElement | OffscreenCanvas | null = null;
  private readonly geo = new Map<string, Geo>();
  readonly parts = new Particles(260);
  private readonly shake: Shake;
  readonly floats = new Floaters();
  private readonly flares: Flare[] = [];
  private msg: Msg | null = null;
  private readonly queue: Msg[] = [];
  private clock = 0;
  /** the halves' rhythm phases (they lock when in step) */
  private phL = 0;
  private phR = 0.9;
  private stepGlow = 0;
  private washK = 0;
  private storyLayout: PassageLayout | null = null;
  private storyKey = '';
  /** Oli pressed (touch-down) and a drag of her toward an axon */
  oliDown = false;
  oliDrag: { x: number; y: number; key: string | null } | null = null;
  /** a drag drawing a path: from the pending neuron to the tip */
  chain: { x: number; y: number } | null = null;
  /** seconds since the player last did anything (the suggestion's ghost shows after a while) */
  idle = 0;
  /** first session: show the suggested pair from the start */
  teach = false;
  /** the song's line is shown (the setting) */
  songOn = true;
  private oliBlink = 0;
  private outFlash = new Map<number, number>();
  /** a learned path: gold light sweeps along it from the input to the output */
  private sweep: { path: number[]; t: number } | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly brain: Brain, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.shake = new Shake(o.reducedMotion);
    this.L = layout(1, 1, { top: 0, right: 0, bottom: 0, left: 0 }, brain.spacing);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.brain.spacing);
    this.geo.clear();
    this.storyKey = '';
    this.bake();
  }

  // ── the static layer ───────────────────────────────────────────
  private bake(): void {
    const L = this.L, d = this.dpr;
    const c = makeCanvas(Math.round(L.w * d), Math.round(L.h * d)), g = ctx2d(c);
    this.layer = c && g ? c : null;
    if (!g) return;
    g.setTransform(d, 0, 0, d, 0, 0);
    // the night
    const bg = g.createRadialGradient(L.cx, L.cy, L.s * 0.2, L.cx, L.cy, Math.max(L.w, L.h) * 0.8);
    bg.addColorStop(0, C.bg2);
    bg.addColorStop(0.55, C.bg1);
    bg.addColorStop(1, C.bg0);
    g.fillStyle = bg;
    g.fillRect(0, 0, L.w, L.h);
    // distant motes
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(200,185,255,${0.05 + hash(i * 3) * 0.12})`;
      g.beginPath();
      g.arc(hash(i) * L.w, hash(i + 99) * L.h, 0.6 + hash(i + 7) * 1.2, 0, TAU);
      g.fill();
    }
    // the hemispheres: tissue, a rim of light, the gyri
    for (const side of [-1, 1] as const) {
      const p = hemiPath(L.cx, L.cy, L.s, side);
      const hx = L.cx + side * HEMI.cx * L.s;
      const tg = g.createRadialGradient(hx - side * L.s * 0.1, L.cy - L.s * 0.2, L.s * 0.05, hx, L.cy, L.s * 1.05);
      tg.addColorStop(0, C.tissue2);
      tg.addColorStop(1, C.tissue);
      g.fillStyle = tg;
      g.fill(p);
      gyri(g, L.cx, L.cy, L.s, side, side < 0 ? 3 : 8);
      g.lineWidth = Math.max(1.5, L.s * 0.012);
      g.strokeStyle = withAlpha(C.rim, 0.55);
      g.stroke(p);
    }
    // the corpus callosum: fibres across the midline between its two lanes
    const [ya, yb] = this.laneYs();
    for (let i = 0; i < 14; i++) {
      const y = ya - 0.06 * L.s + (i / 13) * (yb - ya + 0.12 * L.s);
      const span = L.s * (0.16 + 0.05 * Math.sin(i * 1.7));
      g.beginPath();
      g.moveTo(L.cx - span, y);
      g.quadraticCurveTo(L.cx, y + L.s * 0.02 * Math.sin(i), L.cx + span, y);
      g.lineWidth = Math.max(1, L.s * 0.008);
      g.strokeStyle = withAlpha(C.bridge, 0.28);
      g.stroke();
    }
    // the dendrites and the bodies of the neurons
    for (const n of this.brain.neurons) {
      const p = toScreen(L, n.x, n.y);
      if (!n.io) neuronBody(g, p.x, p.y, L.soma, n.seed, n.region === 'bridge' ? C.bridge : C.halo);
    }
  }

  private laneYs(): [number, number] {
    const [a, b] = this.brain.bridges;
    const L = this.L, N = this.brain.neurons;
    return [L.cy + N[a[0]].y * L.s, L.cy + N[b[0]].y * L.s];
  }

  // ── geometry of a link ─────────────────────────────────────────
  geoOf(Lk: Link): Geo {
    let g = this.geo.get(Lk.key);
    if (g) return g;
    const L = this.L, N = this.brain.neurons;
    const a = toScreen(L, N[Lk.from].x, N[Lk.from].y);
    const other = Lk.from === Lk.a ? Lk.b : Lk.a;
    const b = toScreen(L, N[other].x, N[other].y);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const bow = (hash(Lk.a * 41 + Lk.b) - 0.5) * 0.36 * (Lk.lane >= 0 ? 0.3 : 1);
    const mx = (a.x + b.x) / 2 - (dy / d) * d * bow, my = (a.y + b.y) / 2 + (dx / d) * d * bow;
    const pts: { x: number; y: number }[] = [];
    let len = 0;
    for (let i = 0; i <= SEGS; i++) {
      const k = i / SEGS, q = 1 - k;
      const p = { x: q * q * a.x + 2 * q * k * mx + k * k * b.x, y: q * q * a.y + 2 * q * k * my + k * k * b.y };
      if (i) len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      pts.push(p);
    }
    g = { pts, len };
    this.geo.set(Lk.key, g);
    return g;
  }

  /** A point along a link's curve at k (0..1) from `start` (a neuron at one end). */
  pointOn(Lk: Link, k: number, start: number): { x: number; y: number } {
    const g = this.geoOf(Lk);
    const kk = clamp(start === Lk.from ? k : 1 - k);
    const f = kk * SEGS, i = Math.min(SEGS - 1, Math.floor(f)), r = f - i;
    const a = g.pts[i], b = g.pts[i + 1];
    return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  }

  neuronXY(n: number): { x: number; y: number } {
    const N = this.brain.neurons[n];
    return toScreen(this.L, N.x, N.y);
  }

  // ── events ─────────────────────────────────────────────────────
  on(e: SimEvent, sim: SynapsySim): void {
    const rm = this.o.reducedMotion;
    switch (e.type) {
      case 'pair': {
        const a = this.neuronXY(e.a), b = this.neuronXY(e.b);
        this.parts.burst((a.x + b.x) / 2, (a.y + b.y) / 2, e.fresh ? 10 : 6, { color: e.beat ? C.gold : C.linkHi, speed: 70, g: 0, life: 0.6, size: 2, drag: 2.5 });
        if (e.beat) this.floats.add(t('hud.beat'), (a.x + b.x) / 2, (a.y + b.y) / 2 - 10, { color: C.gold, size: 15, dur: 0.9 });
        this.idle = 0;
        break;
      }
      case 'linked': {
        const Lk = sim.links.get(e.key);
        if (Lk) {
          const p = this.pointOn(Lk, 1, Lk.from);
          this.flare(p.x, p.y, C.linkHi, this.L.soma * 4, 0.5);
          this.parts.burst(p.x, p.y, 12, { color: C.goldHi, speed: 90, g: 0, life: 0.7, size: 2.2, drag: 2 });
          this.floats.add('+1', p.x, p.y - 8, { color: C.goldHi, size: 17, dur: 1 });
        }
        break;
      }
      case 'synapse': {
        const Lk = sim.links.get(e.key);
        if (Lk) {
          const p = this.pointOn(Lk, 0.5, Lk.from);
          this.parts.burst(p.x, p.y, 8, { color: C.gold, speed: 60, g: 0, life: 0.6, size: 2, drag: 2.2, shape: 'spark' });
          this.floats.add('+1', p.x, p.y - 6, { color: C.gold, size: 15, dur: 0.9 });
        }
        break;
      }
      case 'arrive': {
        const p = this.neuronXY(e.to);
        this.outFlash.set(e.to, 1);
        if (e.counted) {
          this.flare(p.x, p.y, C.gold, this.L.soma * 7, 0.7);
          this.parts.burst(p.x, p.y, 16, { color: C.goldHi, speed: 120, g: 0, life: 0.8, size: 2.4, drag: 1.8 });
          this.floats.add(`${sim.done}/${sim.lesson.goal}`, p.x, p.y - 18, { color: C.text, size: 16, dur: 1.1 });
        } else this.flare(p.x, p.y, e.lesson ? C.rest : C.habit, this.L.soma * 4, 0.5);
        break;
      }
      case 'slow': {
        const to = sim.io(sim.lesson.to);
        const p = this.neuronXY(to);
        this.floats.add(t('hud.slow'), p.x, p.y - 20, { color: C.rest, size: 14, dur: 1.2 });
        break;
      }
      case 'lost': {
        const p = this.neuronXY(e.at);
        this.parts.burst(p.x, p.y, 5, { color: e.why === 'weak' ? '#c9b8ff' : '#8f80c8', speed: 30, g: 0, life: 0.6, size: 1.6, drag: 3 });
        break;
      }
      case 'far': {
        const p = this.neuronXY(e.b);
        this.floats.add(t('hud.far'), p.x, p.y - 16, { color: C.dim, size: 13, dur: 1 });
        break;
      }
      case 'full': {
        const p = this.neuronXY(e.n);
        this.floats.add(t('hud.full'), p.x, p.y - 16, { color: C.dim, size: 13, dur: 1 });
        break;
      }
      case 'wrapped': {
        const Lk = sim.links.get(e.key);
        if (Lk) {
          const p = this.pointOn(Lk, 0.5, Lk.from);
          this.flare(p.x, p.y, C.node, this.L.soma * 5, 0.6);
          this.floats.add(mpsText(e.mps), p.x, p.y - 14, { color: C.node, size: 15, dur: 1.4 });
        }
        break;
      }
      case 'bloom': {
        const L = this.L;
        this.shake.add(0.35);
        this.flare(L.cx, L.cy, C.gold, L.s * 1.3, 1.1);
        this.floats.add(t('hud.bloom'), L.cx, L.cy - L.s * 0.3, { color: C.goldHi, size: 22, dur: 1.6 });
        for (const Lk of sim.links.values()) {
          if (Lk.glow < 0.9) continue;
          const p = this.pointOn(Lk, 0.5, Lk.from);
          this.parts.burst(p.x, p.y, 6, { color: C.gold, speed: 80, g: -10, life: 0.9, size: 2.2, drag: 1.5 });
        }
        break;
      }
      case 'consolidated': {
        const Lk = sim.links.get(e.key);
        if (Lk) {
          const p = this.pointOn(Lk, 0.5, Lk.from);
          this.floats.add(t('hud.kept'), p.x, p.y - 10, { color: C.goldHi, size: 13, dur: 1.1 });
        }
        break;
      }
      case 'prune': {
        const Lk = sim.links.get(e.key);
        if (Lk) {
          const p = this.pointOn(Lk, 0.5, Lk.from);
          this.parts.burst(p.x, p.y, 10, { color: '#b9a9ec', speed: 25, g: -6, life: 2, size: 1.8, drag: 0.8 });
        }
        break;
      }
      case 'learned': {
        const p = this.neuronXY(sim.io(e.lesson.to));
        this.shake.add(0.3);
        const route = sim.lessonRoute();
        if (route) this.sweep = { path: route, t: 0 };
        this.flare(p.x, p.y, C.goldHi, this.L.s * 0.5, 1);
        this.floats.add(t('hud.learned'), this.L.cx, this.L.cy - this.L.s * 0.45, { color: C.goldHi, size: 24, dur: 1.8 });
        this.parts.burst(p.x, p.y, 30, { color: C.gold, speed: 170, g: 40, life: 1.2, size: 2.6, drag: 1.2, shape: 'spark' });
        break;
      }
      case 'lesson':
        this.push({ kind: 'lesson', title: `${t('hud.lesson', { n: e.lesson.index + 1 })} · ${lessonTitle(e.lesson.id)}`, text: lessonLine(e.lesson.id), t: 0, dur: RULES.cardSec + 1.5 });
        break;
      case 'card':
        this.push({ kind: 'card', title: `${t('hud.card')}: ${cardTitle(e.id)}`, text: cardText(e.id as CardId), src: cardSrc(e.id as CardId), t: 0, dur: 6.5 });
        break;
      case 'blind':
        this.push({ kind: 'reveal', title: t('hud.revealed', { n: Math.round(e.share * 100) }), text: '', t: 0, dur: 3.5 });
        break;
      case 'step':
        if (e.on && !rm) this.flare(this.L.cx, (this.laneYs()[0] + this.laneYs()[1]) / 2, C.bridgeOn, this.L.s * 0.4, 0.8);
        break;
      default:
        break;
    }
  }

  private flare(x: number, y: number, color: string, r: number, dur: number): void {
    this.flares.push({ x, y, t: 0, dur, color, r });
    if (this.flares.length > 24) this.flares.shift();
  }

  private push(m: Msg): void {
    // a lesson's card goes ahead of a waiting Wiedza card
    if (m.kind === 'lesson') this.queue.unshift(m); else this.queue.push(m);
    if (this.queue.length > 6) this.queue.length = 6;
  }

  /** The message strip is busy (the coach marks wait for it). */
  get busy(): boolean { return !!this.msg; }

  // ── a frame ────────────────────────────────────────────────────
  update(dt: number, sim: SynapsySim): void {
    this.clock += dt;
    this.idle += dt;
    this.parts.update(dt);
    this.floats.update(dt);
    for (let i = this.flares.length - 1; i >= 0; i--) {
      this.flares[i].t += dt;
      if (this.flares[i].t >= this.flares[i].dur) this.flares.splice(i, 1);
    }
    if (this.sweep) {
      this.sweep.t += dt;
      if (this.sweep.t > 1.8) this.sweep = null;
    }
    for (const [k, v] of this.outFlash) {
      const nv = v - dt * 1.5;
      if (nv <= 0) this.outFlash.delete(k); else this.outFlash.set(k, nv);
    }
    // the message strip: one at a time, never over a telegraph or the runner's banner
    if (this.msg) {
      // the runner's block banner covers the top of the play: the card waits under it and shows in full after
      if (!sim.bannerUp) this.msg.t += dt;
      if (this.msg.t >= this.msg.dur) this.msg = null;
    } else if (this.queue.length && !sim.talkBlocked && !sim.story) {
      this.msg = this.queue.shift()!;
    }
    // the halves' rhythms: in step they lock, out of step they drift
    const w = 1.1;
    this.phL += dt * w;
    this.phR += dt * (sim.inStep ? w : w * 1.23);
    if (sim.inStep) this.phR += (this.phL - this.phR) * Math.min(1, dt * 1.5);
    this.stepGlow += ((sim.inStep ? 1 : 0) - this.stepGlow) * Math.min(1, dt * 2);
    this.washK += ((sim.restBlock ? 1 : 0) - this.washK) * Math.min(1, dt * 1.2);
    this.oliBlink -= dt;
    if (this.oliBlink < -3 - hash(Math.floor(this.clock)) * 3) this.oliBlink = 0.14;
  }

  draw(sim: SynapsySim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    const sh = this.shake.offset(1 / 60, 7);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, sh.x * this.dpr, sh.y * this.dpr);
    if (this.layer) ctx.drawImage(this.layer as CanvasImageSource, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = C.bg1;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    // rest is the brain's night: a soft blue dusk over the tissue (the links and the light stay bright over it)
    if (this.washK > 0.01) {
      ctx.fillStyle = `rgba(8,18,52,${0.28 * this.washK})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    this.drawBand(ctx, sim);
    this.drawRhythms(ctx, sim);
    if (this.washK > 0.01) this.drawWash(ctx, sim);
    this.drawWaste(ctx, sim);
    this.drawBridge(ctx, sim);
    this.drawLinks(ctx, sim);
    this.drawGhost(ctx, sim);
    this.drawPending(ctx, sim);
    this.drawPulses(ctx, sim);
    if (this.sweep) this.drawSweep(ctx, sim);
    this.drawNeurons(ctx, sim);
    this.drawFlares(ctx);
    this.drawPlate(ctx, sim);
    this.drawLens(ctx, sim);
    this.drawOli(ctx, sim);
    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
    this.floats.draw(ctx, `800 ${SANS}`);
    this.drawSong(ctx, sim);
    if (!sim.bannerUp) this.drawStrip(ctx);
    this.drawBubble(ctx, sim);
    if (sim.story) this.drawStory(ctx, sim);
  }

  // ── the band at the forehead ───────────────────────────────────
  private drawBand(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L;
    const lvl = sim.growth;
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1] as const) {
      const x = L.cx + side * 0.42 * L.s, y = L.cy - 0.78 * L.s;
      // the prefrontal cortex lights with the reading (a sighted push block)
      if (lvl > 0.02) glow(ctx, lvl >= 0.5 ? C.gold : C.halo, x, y, L.s * (0.3 + 0.35 * lvl), 0.25 + 0.5 * lvl);
    }
    ctx.globalCompositeOperation = 'source-over';
    // the headband over the forehead: an arc and its two optodes (left and right)
    const y0 = L.cy - (HEMI.ry + 0.07) * L.s;
    ctx.beginPath();
    ctx.ellipse(L.cx, y0 + L.s * 0.2, L.s * 0.62, L.s * 0.2, 0, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineWidth = Math.max(2, L.s * 0.03);
    ctx.strokeStyle = 'rgba(220,210,255,0.22)';
    ctx.stroke();
    const bal = sim.balance;
    for (const side of [-1, 1] as const) {
      const ox = L.cx + side * L.s * 0.36, oy = y0 + L.s * 0.035;
      const k = bal === null ? 0.25 : clamp(0.4 + (side > 0 ? bal - 0.5 : 0.5 - bal) * 3);
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(2.5, L.s * 0.022), 0, TAU);
      ctx.fillStyle = mix('#6b5fa8', '#dff4ff', k);
      ctx.fill();
    }
  }

  private drawRhythms(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    if (this.o.reducedMotion) return;
    const L = this.L;
    ctx.save();
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.clip(hemiPath(L.cx, L.cy, L.s, side));
      const ph = side < 0 ? this.phL : this.phR;
      const hx = L.cx + side * HEMI.cx * L.s;
      for (let i = 0; i < 2; i++) {
        const k = ((ph / TAU + i / 2) % 1 + 1) % 1;
        ctx.beginPath();
        ctx.ellipse(hx, L.cy, k * HEMI.rx * L.s * 1.1, k * HEMI.ry * L.s, 0, 0, TAU);
        ctx.lineWidth = Math.max(1.5, L.s * 0.02);
        ctx.strokeStyle = sim.inStep ? `rgba(255,224,138,${0.12 * (1 - k)})` : `rgba(170,150,255,${0.07 * (1 - k)})`;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ── rest: the wash and the waste ───────────────────────────────
  private drawWash(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L;
    // the breath: out (6 s) the wave spreads from the midline to the edges, in (4 s) it gathers softly
    const cyc = RULES.breathIn + RULES.breathOut;
    const ph = sim.breath * cyc;
    const k = ph < RULES.breathIn ? 0.15 * ease.inOutSine(ph / RULES.breathIn) : 0.15 + 0.85 * ease.inOutSine((ph - RULES.breathIn) / RULES.breathOut);
    const a = 0.22 * this.washK;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.clip(hemiPath(L.cx, L.cy, L.s, side));
      for (let i = 0; i < 7; i++) {
        const y = L.cy + (-0.85 + i * 0.28) * L.s;
        const x = L.cx + side * (0.08 + k * 0.95) * L.s;
        glow(ctx, C.csf, x, y + Math.sin(this.clock + i) * L.s * 0.04, L.s * 0.26, a);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawWaste(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L;
    // the waste of the work: dull motes between the cells, more as the network works; the wash carries them off
    const n = Math.round(sim.waste * 90);
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const y = -0.88 + hash(i * 7 + 2) * 1.76;
      const x = side * (0.06 + hash(i * 3 + 1) * (halfWidthAt(y) - 0.1));
      const p = toScreen(L, x + Math.sin(this.clock * 0.4 + i) * 0.015, y + Math.cos(this.clock * 0.3 + i) * 0.015);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.4, L.s * (0.008 + hash(i) * 0.008)), 0, TAU);
      ctx.fillStyle = withAlpha(i % 3 ? C.waste : '#a08a6e', 0.5 + 0.25 * hash(i + 5));
      ctx.fill();
    }
  }

  // ── the bridge ─────────────────────────────────────────────────
  private drawBridge(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L;
    const [ya, yb] = this.laneYs();
    const g = this.stepGlow;
    const follow = sim.balance === null ? sim.growth : 0;
    const on = Math.max(g, follow * 0.7);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const y = ya + (i / 4) * (yb - ya);
      glow(ctx, on > 0.3 ? C.bridgeOn : C.bridge, L.cx, y, L.s * (0.16 + 0.08 * on), 0.18 + 0.45 * on);
    }
    ctx.globalCompositeOperation = 'source-over';
    // the two lanes: bundles of fibres between the bridge ends
    for (const lane of [0, 1]) {
      const [l, r] = this.brain.bridges[lane];
      const Lk = sim.link(l, r);
      if (!Lk) continue;
      const geo = this.geoOf(Lk);
      ctx.beginPath();
      geo.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(3, L.s * 0.035);
      ctx.strokeStyle = mix(C.bridge, C.bridgeOn, on);
      ctx.stroke();
      this.drawMyelin(ctx, Lk, geo);
    }
  }

  /** The halves' plate on the bridge: the balance between L and R with the even band, and its words ("no reading" when there is none). */
  private drawPlate(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const P = this.L.plate, u = Math.min(1.15, this.L.u);
    const bal = sim.balance;
    const label = bal === null ? t('hud.noReading') : sim.inStep ? t('hud.inStep') : t('hud.halves');
    const words = fitLines(ctx, label, P.w - 6, 2, 13 * u, 11, 800);
    const lh = Math.round(words.size * 1.15);
    const h = 16 * u + words.lines.length * lh + 6;
    const y = P.y + (P.h - h) / 2;
    plate(ctx, P.x, y, P.w, h, 8, sim.inStep ? withAlpha(C.bridgeOn, 0.8) : C.plateEdge);
    // the bar: L and R at its ends, the even band in its middle, the reading's dot
    const barY = y + 9 * u, bx = P.x + 11 * u, bw = P.w - 22 * u;
    ctx.font = font(11, 800);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.dim;
    ctx.textAlign = 'left';
    ctx.fillText(t('hud.left'), P.x + 2.5 * u, barY);
    ctx.textAlign = 'right';
    ctx.fillText(t('hud.right'), P.x + P.w - 2.5 * u, barY);
    ctx.fillStyle = 'rgba(190,175,255,0.25)';
    ctx.fillRect(bx, barY - 1.5, bw, 3);
    ctx.fillStyle = sim.inStep ? C.bridgeOn : 'rgba(255,224,138,0.55)';
    ctx.fillRect(bx + bw * 0.47, barY - 2.5, Math.max(2, bw * 0.06), 5);
    if (bal !== null) {
      ctx.beginPath();
      ctx.arc(bx + bw * clamp(bal), barY, 3.5 * u, 0, TAU);
      ctx.fillStyle = sim.inStep ? C.bridgeOn : C.text;
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font(words.size, 800);
    ctx.fillStyle = sim.inStep ? C.bridgeOn : bal === null ? C.dim : C.text;
    words.lines.forEach((s, i) => ctx.fillText(s, P.x + P.w / 2, y + 16 * u + i * lh));
  }

  // ── links ──────────────────────────────────────────────────────
  private drawLinks(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L, u = L.u;
    const route = sim.lessonRoute();
    const onRoute = new Set<string>();
    if (route) for (let i = 0; i + 1 < route.length; i++) onRoute.add(keyOf(route[i], route[i + 1]));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const Lk of sim.links.values()) {
      if (Lk.lane >= 0) continue;
      const geo = this.geoOf(Lk);
      const fade = Lk.prune > 0 ? 1 - Lk.prune : 1;
      const grown = Lk.sprout < 1 ? Lk.sprout : 1;
      const n = Math.max(1, Math.round(grown * SEGS));
      const width = (1.3 + 0.75 * Math.max(1, Lk.syn)) * Math.min(1.2, u);
      ctx.globalAlpha = fade;
      // the glow under the link: heat (in use) and growth (gold)
      if (Lk.heat > 0.05 || Lk.glow > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        const mid = geo.pts[Math.min(n, SEGS >> 1)];
        glow(ctx, Lk.glow > Lk.heat * 0.6 ? C.gold : C.halo, mid.x, mid.y, Math.max(14, geo.len * 0.45), 0.12 + 0.22 * Math.max(Lk.heat, Lk.glow));
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const p = geo.pts[i];
        if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      }
      const base = onRoute.has(Lk.key) ? mix(C.link, C.linkHi, 0.35) : C.link;
      ctx.lineWidth = width;
      ctx.strokeStyle = mix(base, C.gold, Math.min(0.85, Lk.glow));
      ctx.stroke();
      if (Lk.sprout < 1) {
        // the growth cone at the tip
        const tip = geo.pts[n];
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, C.goldHi, tip.x, tip.y, 9 * u, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        this.drawMyelin(ctx, Lk, geo);
        // consolidated: a fine gold core
        if (Lk.cons >= 1) {
          ctx.beginPath();
          geo.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.lineWidth = Math.max(1, width * 0.28);
          ctx.strokeStyle = withAlpha(C.goldHi, 0.9);
          ctx.stroke();
        } else if (Lk.cons > 0.05) {
          ctx.beginPath();
          const m = Math.max(1, Math.round(Lk.cons * SEGS));
          for (let i = 0; i <= m; i++) { const p = geo.pts[i]; if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
          ctx.lineWidth = Math.max(1, width * 0.22);
          ctx.strokeStyle = withAlpha(C.goldHi, 0.55);
          ctx.stroke();
        }
        // the synapse's bouton at the receiving end
        const end = geo.pts[SEGS];
        ctx.beginPath();
        ctx.arc(end.x, end.y, Math.max(1.6, width * 0.75), 0, TAU);
        ctx.fillStyle = mix(C.linkHi, C.gold, Math.min(1, Lk.glow));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Oli at work: the axon she wraps shows its speed
    const o = sim.oli;
    if (o.state === 'wrap' && o.target) {
      const Lk = sim.links.get(o.target);
      if (Lk) {
        const p = this.pointOn(Lk, 0.5, Lk.from);
        const txt = mpsText(speedOf(Lk.myelin));
        ctx.font = font(13, 800);
        const w = ctx.measureText(txt).width + 12;
        plate(ctx, p.x - w / 2, p.y + 10, w, 20, 8, withAlpha(C.node, 0.6));
        ctx.fillStyle = C.node;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, p.x, p.y + 20);
      }
    }
  }

  /** The myelin sheath: pearl internodes appearing one by one as it is wrapped, the nodes of Ranvier between them. */
  private drawMyelin(ctx: CanvasRenderingContext2D, Lk: Link, geo: Geo): void {
    if (Lk.myelin <= 0.01) return;
    const segs = 6;
    const shown = Lk.myelin * segs;
    const w = (2.8 + 0.6 * Math.max(1, Lk.syn)) * Math.min(1.2, this.L.u);
    ctx.lineCap = 'round';
    for (let s = 0; s < segs; s++) {
      const part = clamp(shown - s);
      if (part <= 0) break;
      const a = (s + 0.12) / segs, b = a + (0.76 / segs) * part;
      ctx.beginPath();
      const ia = a * SEGS, ib = b * SEGS;
      const p0 = this.lerpPts(geo, ia);
      ctx.moveTo(p0.x, p0.y);
      for (let i = Math.ceil(ia); i < ib; i++) ctx.lineTo(geo.pts[i].x, geo.pts[i].y);
      const p1 = this.lerpPts(geo, ib);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineWidth = w + 2;
      ctx.strokeStyle = withAlpha(C.myelinEdge, 0.8);
      ctx.stroke();
      ctx.lineWidth = w;
      ctx.strokeStyle = C.myelin;
      ctx.stroke();
    }
  }

  private lerpPts(geo: Geo, f: number): { x: number; y: number } {
    const i = Math.max(0, Math.min(SEGS - 1, Math.floor(f))), r = clamp(f - i);
    const a = geo.pts[i], b = geo.pts[i + 1];
    return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  }

  /** The next pair the lesson needs, as a faint dotted line (after a while of nothing, or the first session). */
  private drawGhost(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    if (!this.teach && this.idle < 6 && sim.t - sim.hinted > 2.5) return;
    if (sim.story || sim.lessonGap > 0) return;
    const s = sim.suggest();
    if (!s || sim.link(s[0], s[1])) return;
    const a = this.neuronXY(s[0]), b = this.neuronXY(s[1]);
    const k = 0.35 + 0.25 * Math.sin(this.clock * 3);
    ctx.save();
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -this.clock * 20;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = 2;
    ctx.strokeStyle = withAlpha(C.goldHi, k);
    ctx.stroke();
    ctx.restore();
  }

  private drawPending(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const pend = sim.pending;
    if (!pend) return;
    const a = this.neuronXY(pend.n);
    const k = clamp(1 - (sim.t - pend.t) / RULES.hebbSec);
    ctx.beginPath();
    ctx.arc(a.x, a.y, this.L.soma * 2.4 + (1 - k) * 6, 0, TAU);
    ctx.lineWidth = 2;
    ctx.strokeStyle = withAlpha(C.goldHi, 0.25 + 0.6 * k);
    ctx.stroke();
    if (this.chain) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(this.chain.x, this.chain.y);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = withAlpha(C.goldHi, 0.7);
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, C.goldHi, this.chain.x, this.chain.y, 16, 0.9);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ── thoughts ───────────────────────────────────────────────────
  private drawPulses(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const u = this.L.u;
    ctx.globalCompositeOperation = 'lighter';
    for (const P of sim.pulses) {
      if (P.k < 0) continue;
      const a = P.path[P.seg], b = P.path[P.seg + 1];
      const Lk = sim.link(a, b);
      if (!Lk) continue;
      let k = P.k;
      // on myelin the signal hops from node to node (saltatory conduction)
      if (Lk.myelin > 0.3) {
        const nodes = 6;
        const f = k * nodes;
        k = (Math.floor(f) + ease.outCubic(clamp((f % 1) * 2.4))) / nodes;
      }
      const p = this.pointOn(Lk, clamp(k), a);
      const color = P.kind === 'replay' ? C.replay : P.kind === 'habit' ? C.habit : C.thought;
      const r = (P.kind === 'replay' ? 9 : 12) * u;
      // a short trail
      for (let i = 1; i <= 3; i++) {
        const q = this.pointOn(Lk, clamp(k - i * 0.06), a);
        glow(ctx, color, q.x, q.y, r * (1 - i * 0.2), 0.35 - i * 0.08);
      }
      glow(ctx, P.kind === 'thought' ? C.gold : color, p.x, p.y, r * 1.8, 0.55);
      glow(ctx, '#ffffff', p.x, p.y, r * 0.55, 0.95);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** A learned path lights up: gold light runs from the input to the output and lingers a moment. */
  private drawSweep(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const sw = this.sweep;
    if (!sw) return;
    const segs = sw.path.length - 1;
    const head = Math.min(segs, (sw.t / 0.9) * segs);
    const fade = sw.t < 1.2 ? 1 : Math.max(0, 1 - (sw.t - 1.2) / 0.6);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < segs; i++) {
      const Lk = sim.link(sw.path[i], sw.path[i + 1]);
      if (!Lk) continue;
      const lit = clamp(head - i);
      for (let k = 0; k <= 6; k++) {
        const q = k / 6;
        if (q > lit) break;
        const p = this.pointOn(Lk, q, sw.path[i]);
        glow(ctx, C.gold, p.x, p.y, 16 * this.L.u, 0.5 * fade);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── neurons ────────────────────────────────────────────────────
  private drawNeurons(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L;
    const lesson = sim.lesson;
    const want = new Set([sim.io(lesson.from), sim.io(lesson.to), sim.io(lesson.via)]);
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.brain.neurons) {
      const f = sim.flash[n.id];
      if (f > 0.02) {
        const p = toScreen(L, n.x, n.y);
        glow(ctx, n.io ? C.goldHi : C.soma, p.x, p.y, L.soma * (3 + 3 * f), 0.6 * f);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const n of this.brain.neurons) {
      const p = toScreen(L, n.x, n.y);
      if (n.io) {
        const active = want.has(n.id);
        const lit = this.outFlash.get(n.id) ?? 0;
        const r = L.soma * (active ? 1.9 : 1.45);
        if (active) {
          const pulse = 0.5 + 0.5 * Math.sin(this.clock * 3);
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, C.gold, p.x, p.y, r * (2.4 + pulse * 0.6), 0.35 + 0.3 * lit);
          ctx.globalCompositeOperation = 'source-over';
        }
        ioIcon(ctx, n.io as IoKind, p.x, p.y, r, active ? mix(C.goldHi, '#ffffff', lit) : '#bcaef0', '#1c1450');
        // the label under the icon, or over it near the back of the brain (the occipital edge is the band's bottom)
        if (active) this.ioLabel(ctx, n.io as IoKind, n.side, p.x, p.y, r, n.y > 0.6, lesson.via && n.id === sim.io(lesson.via));
      } else {
        somaCore(ctx, p.x, p.y, L.soma, sim.flash[n.id]);
      }
    }
  }

  private ioLabel(ctx: CanvasRenderingContext2D, kind: IoKind, side: -1 | 1, x: number, cy: number, r: number, above: boolean, via: boolean | undefined): void {
    const txt = ioName(kind, side < 0 ? 'L' : 'R') + (via ? ` · ${t('hud.via')}` : '');
    const size = fitFont(ctx, txt, Math.min(170, this.L.w * 0.42), 13 * Math.min(1.15, this.L.u), 11, 800);
    ctx.font = font(size, 800);
    const w = ctx.measureText(txt).width + 10;
    const y = above ? cy - r - 5 - (size + 7) : cy + r + 4;
    const bx = Math.max(this.L.band.x + 2, Math.min(this.L.band.x + this.L.band.w - w - 2, x - w / 2));
    plate(ctx, bx, y, w, size + 7, 7);
    ctx.fillStyle = C.goldHi;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, bx + w / 2, y + (size + 7) / 2 + 0.5);
  }

  private drawFlares(ctx: CanvasRenderingContext2D): void {
    if (!this.flares.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flares) {
      const k = f.t / f.dur;
      glow(ctx, f.color, f.x, f.y, f.r * (0.6 + 0.6 * ease.outCubic(k)), (1 - k) * 0.9);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── the lens ───────────────────────────────────────────────────
  private drawLens(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const l = this.L.lens;
    const mode = sim.blind ? 'blind' : sim.restBlock ? 'rest' : sim.pushBlock ? 'grow' : 'idle';
    const value = mode === 'grow' ? (sim.sighted && sim.reliable ? sim.level : null) : mode === 'rest' ? (sim.reliable ? sim.calm : null) : null;
    // in rest the lens breathes with the 4/6 guide: it swells on the in-breath and settles on the out-breath
    let r = l.r, label = mode === 'blind' ? t('hud.blind') : t('hud.lens');
    if (mode === 'rest') {
      const ph = sim.breath * (RULES.breathIn + RULES.breathOut);
      const inBreath = ph < RULES.breathIn;
      const k = inBreath ? ease.inOutSine(ph / RULES.breathIn) : 1 - ease.inOutSine((ph - RULES.breathIn) / RULES.breathOut);
      if (!this.o.reducedMotion) r = l.r * (0.9 + 0.1 * k);
      label = inBreath ? t('hud.in') : t('hud.out');
    }
    paintLens(ctx, l.x, l.y, r, { mode, value, t: this.clock, charge: sim.blind ? 0 : sim.charge }, label, Math.min(1.2, this.L.u));
  }

  // ── Oli ────────────────────────────────────────────────────────
  private drawOli(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L, B = L.oli;
    const hx = B.x + B.w / 2, hy = B.y + B.h / 2;
    // her button: a round nest in the thumb zone
    ctx.beginPath();
    ctx.arc(hx, hy, B.w / 2, 0, TAU);
    const pressed = this.oliDown;
    ctx.fillStyle = pressed ? 'rgba(80,64,170,0.92)' : 'rgba(30,22,78,0.9)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = sim.oli.state === 'home' ? withAlpha(C.oliEdge, 0.9) : withAlpha(C.oliEdge, 0.4);
    ctx.stroke();
    const o = sim.oli;
    const r = B.w * 0.3 * (pressed ? 0.92 : 1);
    if (o.state === 'home' && !this.oliDrag) {
      paintOli(ctx, hx, hy, r, this.clock, { blink: this.oliBlink > 0, happy: 0.6 });
    } else {
      paintOli(ctx, hx, hy, r * 0.8, this.clock, { dim: true });
    }
    // her name over the nest: a button's label (13 px)
    ctx.font = font(13, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8,6,24,0.85)';
    ctx.strokeText(t('hud.oli'), hx, B.y - 7);
    ctx.fillStyle = C.text;
    ctx.fillText(t('hud.oli'), hx, B.y - 7);
    // dragged toward an axon: drawn above the finger
    if (this.oliDrag) {
      paintOli(ctx, this.oliDrag.x, this.oliDrag.y, r * 0.9, this.clock, { wrap: 0.3, happy: 0.9 });
      if (this.oliDrag.key) {
        const Lk = sim.links.get(this.oliDrag.key);
        if (Lk) {
          const geo = this.geoOf(Lk);
          ctx.beginPath();
          geo.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.lineWidth = 6;
          ctx.strokeStyle = withAlpha(C.node, 0.5);
          ctx.stroke();
        }
      }
      return;
    }
    if (o.state === 'home') return;
    // out: flying from the nest to her axon and back, or wrapping it
    const Lk = o.target ? sim.links.get(o.target) : undefined;
    if (!Lk) return;
    const mid = this.pointOn(Lk, 0.5, Lk.from);
    const k = ease.inOutSine(clamp(o.k));
    const x = hx + (mid.x - hx) * k, y = hy + (mid.y - hy) * k - Math.sin(k * Math.PI) * L.s * 0.15;
    if (o.state === 'wrap') {
      const orbit = this.o.reducedMotion ? 0 : Math.sin(this.clock * 5) * 4;
      paintOli(ctx, mid.x + orbit, mid.y - r * 0.6, r * 0.85, this.clock, { wrap: 1, happy: 0.8 });
    } else {
      paintOli(ctx, x, y, r * 0.85, this.clock, { happy: 0.7 });
    }
  }

  private drawBubble(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const line = sim.talk.line;
    if (!line || sim.story) return;
    const L = this.L, B = L.bubble, u = L.u;
    const k = Math.min(1, line.t / 0.18), out = Math.max(0, (line.t - line.dur + 0.25) / 0.25);
    const fit = fitLines(ctx, line.text, B.w - 24, 3, 14 * Math.min(1.15, u), 13, 650);
    const lh = Math.round(fit.size * 1.3);
    const h = fit.lines.length * lh + 16;
    const widest = Math.max(...fit.lines.map(s => { ctx.font = font(fit.size, 650); return ctx.measureText(s).width; }));
    const w = Math.min(B.w, widest + 24);
    const x = B.x + B.w - w, y = B.y + B.h - h;
    ctx.save();
    ctx.globalAlpha = k * (1 - out);
    plate(ctx, x, y, w, h, 12, withAlpha(C.oliEdge, 0.7), 'rgba(24,18,60,0.92)');
    // the tail toward Oli's nest
    ctx.beginPath();
    const tx = Math.min(x + w - 18, L.oli.x + L.oli.w / 2);
    ctx.moveTo(tx - 7, y + h);
    ctx.lineTo(tx + 3, y + h + 9);
    ctx.lineTo(tx + 7, y + h);
    ctx.fillStyle = 'rgba(24,18,60,0.92)';
    ctx.fill();
    ctx.font = font(fit.size, 650);
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    fit.lines.forEach((s, i) => ctx.fillText(s, x + 12, y + 8 + i * lh));
    ctx.restore();
  }

  // ── words ──────────────────────────────────────────────────────
  private drawSong(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    if (!this.songOn) return;
    const line = sim.songLine();
    if (!line) return;
    const S = this.L.song;
    const size = fitFont(ctx, line.text, S.w - 8, 13.5 * Math.min(1.2, this.L.u), 11, 650, true);
    ctx.font = font(size, 650, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = S.x + S.w / 2, cy = S.y + S.h / 2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8,6,24,0.8)';
    ctx.strokeText(line.text, cx, cy);
    ctx.fillStyle = withAlpha('#efe6ff', 0.92);
    ctx.fillText(line.text, cx, cy);
    // how far through the line: a thin gold thread under it
    const tw = Math.min(S.w - 8, ctx.measureText(line.text).width);
    ctx.fillStyle = withAlpha(C.gold, 0.7);
    ctx.fillRect(cx - tw / 2, cy + size * 0.72, tw * clamp(line.p), 1.5);
  }

  private drawStrip(ctx: CanvasRenderingContext2D): void {
    const m = this.msg;
    if (!m) return;
    const L = this.L, S = L.strip, u = Math.min(1.15, L.u);
    const k = Math.min(1, m.t / 0.25), out = Math.max(0, (m.t - m.dur + 0.4) / 0.4);
    ctx.save();
    ctx.globalAlpha = k * (1 - out);
    const titleSize = fitFont(ctx, m.title, S.w - 20, 14.5 * u, 13, 800);
    const body = m.text ? fitLines(ctx, m.text, S.w - 20, L.mode === 'tall' ? 4 : 6, 13.5 * u, 13, 600) : { lines: [], size: 13 };
    const lh = Math.round(body.size * 1.28);
    const srcH = m.src ? 14 : 0;
    const h = 10 + titleSize + 4 + body.lines.length * lh + srcH + 8;
    const y = S.y;
    plate(ctx, S.x, y, S.w, h, 12, m.kind === 'card' ? withAlpha(C.gold, 0.6) : withAlpha(C.oliEdge, 0.6), 'rgba(16,11,44,0.9)');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = font(titleSize, 800);
    ctx.fillStyle = m.kind === 'card' ? C.goldHi : C.text;
    ctx.fillText(m.title, S.x + 10, y + 8);
    ctx.font = font(body.size, 600);
    ctx.fillStyle = C.text;
    body.lines.forEach((s, i) => ctx.fillText(s, S.x + 10, y + 8 + titleSize + 4 + i * lh));
    if (m.src) {
      const ss = fitFont(ctx, m.src, S.w - 20, 11, 11, 600);
      ctx.font = font(ss, 600);
      ctx.fillStyle = C.dim;
      ctx.fillText(m.src, S.x + 10, y + h - 8 - 12);
    }
    ctx.restore();
  }

  private drawStory(ctx: CanvasRenderingContext2D, sim: SynapsySim): void {
    const L = this.L, P = L.card, u = Math.min(1.2, L.u);
    ctx.fillStyle = 'rgba(6,4,20,0.55)';
    ctx.fillRect(0, 0, L.w, L.h);
    plate(ctx, P.x, P.y, P.w, P.h, 16, withAlpha(C.gold, 0.55), 'rgba(18,12,48,0.96)');
    let y = P.y + 16;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font(24 * u, 800, true);
    ctx.fillStyle = C.goldHi;
    ctx.fillText(t('story.title'), P.x + P.w / 2, y);
    y += 24 * u + 10;
    const body = fitLines(ctx, t('story.text'), P.w - 32, 6, 15.5 * u, 13.5, 600);
    ctx.font = font(body.size, 600);
    ctx.fillStyle = C.text;
    const lh = Math.round(body.size * 1.32);
    body.lines.forEach((s, i) => ctx.fillText(s, P.x + P.w / 2, y + i * lh));
    y += body.lines.length * lh + 10;
    const tapY = P.y + P.h - 26;
    const p = passage('rom12.2');
    const key = `${P.w}x${P.h}:${y}`;
    if (this.storyKey !== key) {
      this.storyKey = key;
      this.storyLayout = layoutPassage(ctx, p, P.w - 36, Math.max(30, tapY - 8 - y), { max: Math.round(15 * u), min: 13 });
    }
    if (this.storyLayout) drawPassage(ctx, p, this.storyLayout, P.x + P.w / 2, y, { text: '#e9ddff', ref: C.dim });
    const tap = this.o.touch ? t('story.tap') : t('story.tapKeys');
    ctx.font = font(fitFont(ctx, tap, P.w - 24, 14 * u, 13, 800), 800);
    ctx.fillStyle = C.gold;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.clock * 4);
    ctx.fillText(tap, P.x + P.w / 2, tapY + 6);
    ctx.globalAlpha = 1;
    void sim;
  }

  /** Where a coach mark should point (px), or null for the middle. */
  pointFor(at: import('./sim').CoachAt, sim: SynapsySim): { x: number; y: number } | null {
    const L = this.L;
    switch (at.kind) {
      case 'neuron': return at.n >= 0 ? this.neuronXY(at.n) : null;
      case 'link': {
        const Lk = sim.links.get(at.key);
        return Lk ? this.pointOn(Lk, 0.5, Lk.from) : null;
      }
      case 'oli': return { x: L.oli.x + L.oli.w / 2, y: L.oli.y };
      case 'lens': return { x: L.lens.x, y: L.lens.y - L.lens.r };
      case 'bridge': return { x: L.plate.x + L.plate.w / 2, y: L.plate.y };
      default: return null;
    }
  }

  /** The text width test for the summary of a stat (for tests): a number formatted the page's way. */
  static num(v: number): string { return fmtNum(v); }

  /** Draw a rounded rectangle path (exported for the preview). */
  static rr = rr;
}
