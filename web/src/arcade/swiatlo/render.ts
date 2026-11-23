/**
 * Światło ciała's play view: the night, the picture through an easing camera (the figure, zoomed toward the element
 * in the light during a push and pulled back to the whole lit body in rest; or the brain), the turn of the figure
 * (front ↔ back) and of the brain (its face ↔ a cut through the middle) as a horizontal squeeze, the dive into the
 * head, sparks and floating lux, and the words of hud.ts (the "what to do now" line, the card, the buttons, the
 * narrator, the picker, the story cards).  A frame composes the baked night, a few dozen path fills through one
 * transform and a handful of baked glows: no shadowBlur, no filters.
 */
import { drawBreathGuide } from '../kit/breathguide';
import { clamp, ease, Particles } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { LISTS, isBrainView, type Element, type View } from './content';
import { geoBox } from './figure';
import {
  drawBubble, drawCard, drawControls, drawList, drawNow, drawPicker, drawStory, drawTag, guideSpot, luxFloat, toneOf,
} from './hud';
import {
  brainCam, camInv, camPt, easeCam, elementCam, figCam, fitCam, hitTest, layout, lerpCam, pickerRect, tapTargets,
  type Cam, type CtrlId, type Hit, type Layout, type Rect,
} from './layout';
import { GOLD, ICE, bakeNight, type Layer } from './paint';
import { drawBrain, drawFigure, type PicState } from './picture';
import { RULES } from './rules';
import type { SimEvent, SwiatloSim } from './sim';

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

/** How far the camera may zoom toward an element, per meditation (the limbs need the hands and the feet close). */
const MAX_Z: Readonly<Record<string, number>> = { narzady: 2.1, miesnie: 2.1, konczyny: 3.2, rownowaga: 1.9, mozg: 1 };
/** the head's box (figure units): where a dive into the brain goes */
const HEAD_BOX: readonly [number, number, number, number] = [-0.07, -0.01, 0.07, 0.14];

/**
 * Words that rise and fade ("+20 lx"): like the kit's floaters, but they never pop up from a tiny size — a floating
 * number is text too, and stays at its size (≥ 13 px) from its first frame.
 */
class Floats {
  private readonly items: { text: string; x: number; y: number; t: number; dur: number; color: string; size: number }[] = [];
  add(text: string, x: number, y: number, o: { color: string; size: number; dur: number }): void {
    this.items.push({ text, x, y, t: 0, ...o, size: Math.max(13, o.size) });
    if (this.items.length > 12) this.items.shift();
  }
  update(dt: number): void {
    for (const f of this.items) f.t += dt;
    while (this.items.length && this.items[0].t >= this.items[0].dur) this.items.shift();
  }
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.items) {
      const k = f.t / f.dur;
      ctx.globalAlpha = Math.min(1, k / 0.12) * (k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1);
      ctx.font = `800 ${Math.round(f.size)}px "Manrope Variable", Manrope, system-ui, sans-serif`;
      const y = f.y - 46 * ease.outCubic(k);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillText(f.text, f.x, y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }
}

const smooth = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

export class SwiatloView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 360;
  private h = 640;
  private dpr = 1;
  private ins: Insets = { top: 134, right: 0, bottom: 0, left: 0 };
  private night: Layer | null = null;
  private cam: Cam | null = null;
  private readonly parts = new Particles(220);
  private readonly floats = new Floats();
  /** the card, the story card and the bubble as last drawn (for taps and coach marks) */
  cardRect: Rect | null = null;
  storyRect: Rect | null = null;
  bubbleRect: Rect | null = null;
  /** where a mouse rests over the canvas (a desk: hover answers), null when it left or on a touch screen */
  hover: { x: number; y: number } | null = null;
  hoverAge = 0;
  /** touch-down looks of the buttons */
  readonly down: Partial<Record<CtrlId, number>> = {};
  private bubbleK = 0;
  private lastLine = '';
  private time = 0;
  private flash = 0;
  /** each element's glow as drawn (eases in when it is lit) */
  private readonly litK = new Map<string, number>();

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, this.ins, o.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets, brain = this.L.brain): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.ins = ins;
    this.L = layout(w, h, ins, this.o.touch, brain);
    const s = this.L.stage;
    this.night = bakeNight(w, h, dpr, s.x + s.w / 2, s.y + s.h * 0.45);
    this.cam = null;
  }

  /** The layout follows the meditation (the brain's picture is wider). */
  private follow(sim: SwiatloSim): void {
    const brain = sim.variant === 'mozg';
    if (brain !== this.L.brain) this.resize(this.w, this.h, this.dpr, this.ins, brain);
  }

  /** Where the camera should look now: the element in a push, the whole picture in rest, a turn, the finale. */
  private camGoal(sim: SwiatloSim): Cam {
    const L = this.L;
    const e = sim.element;
    // a rest whose breath guide stands under the picture: the whole picture in the stage less the guide's strip
    const spot = sim.restBlock && sim.phase === 'play' && this.ctx ? guideSpot(this.ctx, L, sim) : null;
    const LL = spot && !spot.inCard ? { ...L, stage: { ...L.stage, h: L.stage.h - spot.strip } } : L;
    if (isBrainView(e.view)) return brainCam(LL);
    const whole = figCam(LL);
    if (!sim.started || sim.story || sim.restBlock || sim.phase !== 'play' || sim.stage === 'turn' || sim.stage === 'whole') return whole;
    // a big screen shows the figure large already: it zooms less
    const z = MAX_Z[sim.variant] ?? 2;
    return elementCam(L, geoBox(e.geo), L.shape === 'desk' ? Math.min(z, sim.variant === 'konczyny' ? 2.2 : 1.5) : z);
  }

  // ── events → juice ─────────────────────────────────────────────
  on(e: SimEvent, sim: SwiatloSim): void {
    const L = this.L;
    const at = (el: Element): { x: number; y: number } => {
      const c = this.cam ?? this.camGoal(sim);
      return camPt(c, el.geo.c[0], el.geo.c[1]);
    };
    switch (e.type) {
      case 'lit': {
        const el = LISTS[sim.variant].find(x => x.id === e.id);
        if (!el) break;
        const p = at(el);
        this.parts.burst(p.x, p.y, this.o.reducedMotion ? 8 : 22, { color: el.hue, speed: 90 * L.u, life: 1.1, size: 2.4, g: -30, drag: 1.6, shape: 'spark' });
        this.parts.burst(p.x, p.y, 1, { color: GOLD, speed: 0, life: 0.8, size: 40 * L.u, g: 0, drag: 0, shape: 'ring' });
        this.floats.add(luxFloat(e.lux), p.x, p.y - 26 * L.u, { color: GOLD, size: 15 * L.u, dur: 1.4 });
        if (!this.o.reducedMotion) this.flash = 0.35;
        break;
      }
      case 'tick': {
        const p = at(sim.element);
        this.parts.burst(p.x, p.y, 3, { color: '#fff0c4', speed: 40 * L.u, life: 0.6, size: 1.6, g: -20, drag: 2, shape: 'dot' });
        break;
      }
      case 'whole': {
        const s = L.stage;
        for (let i = 0; i < 24; i++) this.parts.burst(s.x + Math.random() * s.w, s.y + Math.random() * s.h, 1, { color: i % 3 ? GOLD : ICE, speed: 40 * L.u, life: 1.6, size: 2.2, g: -40, drag: 1, shape: 'dot' });
        this.floats.add(luxFloat(e.lux), s.x + s.w / 2, s.y + s.h * 0.45, { color: GOLD, size: 18 * L.u, dur: 1.6 });
        this.flash = this.o.reducedMotion ? 0.2 : 0.6;
        break;
      }
      case 'lux': {
        const p = at(sim.element);
        const color = e.at === 'rest' ? '#d6dcff' : e.at === 'block' ? '#d8f6ff' : '#fff0c4';
        this.floats.add(luxFloat(e.n), p.x + (Math.random() - 0.5) * 30 * L.u, p.y - 18 * L.u, { color, size: 13 * L.u, dur: 1.3 });
        break;
      }
      case 'blindEnd':
        if (e.lux > 0) {
          const p = at(sim.element);
          this.floats.add(luxFloat(e.lux), p.x, p.y - 30 * L.u, { color: '#e0e6f4', size: 15 * L.u, dur: 1.4 });
        }
        break;
      case 'element':
        this.cam = this.cam ?? this.camGoal(sim);
        break;
      default:
        break;
    }
  }

  /** A touch-down on the open field: a soft ring of light under the finger, at once. */
  touch(x: number, y: number): void {
    this.parts.burst(x, y, 1, { color: ICE, speed: 0, life: 0.45, size: 9, g: 0, drag: 0, shape: 'ring' });
  }

  update(dt: number, sim: SwiatloSim): void {
    this.follow(sim);
    this.time += dt;
    this.hoverAge += dt;
    this.parts.update(dt);
    this.floats.update(dt);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    for (const k of Object.keys(this.down) as CtrlId[]) this.down[k] = Math.max(0, (this.down[k] ?? 0) - dt * 5);
    const goal = this.camGoal(sim);
    this.cam = this.cam ? easeCam(this.cam, goal, dt, this.o.reducedMotion ? 0.05 : 0.75) : goal;
    for (const e of LISTS[sim.variant]) {
      const want = sim.isLit(e.id) && e.id !== sim.element.id ? 1 : 0;
      const was = this.litK.get(e.id) ?? want;
      this.litK.set(e.id, want > was ? Math.min(1, was + dt / 0.8) : want);
    }
    const line = sim.talk.line;
    this.bubbleK = line ? Math.min(1, this.bubbleK + dt * 5) : Math.max(0, this.bubbleK - dt * 6);
    if (line) this.lastLine = line.text;
    // motes rise from the element while focus fills it
    if (sim.filling && Math.random() < dt * 10) {
      const c = this.cam;
      const p = camPt(c, sim.element.geo.c[0], sim.element.geo.c[1]);
      this.parts.burst(p.x + (Math.random() - 0.5) * 30 * this.L.u, p.y, 1, { color: '#fff0c4', speed: 30 * this.L.u, angle: -Math.PI / 2, spread: 0.7, life: 1.1, size: 1.5, g: -10, drag: 0.6, shape: 'dot' });
    }
  }

  /** The picture's state for picture.ts. */
  private picState(sim: SwiatloSim): PicState {
    return {
      current: sim.story || sim.phase !== 'play' && sim.stage !== 'at' ? null : sim.element.id,
      fill: sim.shown,
      lit: id => this.litK.get(id) ?? 0,
      filling: sim.filling,
      blind: sim.blind,
      rest: sim.restBlock || sim.phase === 'finale',
      breath: sim.restBlock ? sim.breath.k : sim.phase === 'finale' ? 0.5 + 0.5 * Math.sin(this.time * 0.63) : 0,
      time: this.time,
      reducedMotion: this.o.reducedMotion,
    };
  }

  // ── drawing ────────────────────────────────────────────────────
  draw(sim: SwiatloSim, pulse: number | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.night) ctx.drawImage(this.night, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#0b1430';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    this.drawPicture(ctx, sim);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,220,150,${(0.1 * this.flash).toFixed(3)})`;
      ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    this.parts.draw(ctx);
    this.floats.draw(ctx);
    // a rest's breath guide under the picture, where the card has no room for it beside a fact (hud.ts guideSpot)
    if (sim.restBlock && sim.phase === 'play' && !sim.story) {
      const spot = guideSpot(ctx, L, sim);
      if (!spot.inCard) {
        const a = Math.min(1, sim.blockT / 0.6, Math.max(0, sim.block.dur - sim.blockT) / 0.6);
        drawBreathGuide(ctx, sim.breath, { ...spot.o, alpha: a, reducedMotion: this.o.reducedMotion, time: sim.t });
      }
    }
    // the words
    drawNow(ctx, L, sim.doNow(), toneOf(sim));
    this.cardRect = sim.started ? drawCard(ctx, L, sim, pulse, this.o.reducedMotion) : null;
    drawList(ctx, L, sim);
    const hoverCtrl = this.hoverCtrl(sim);
    drawControls(ctx, L, this.down, hoverCtrl, !!sim.story);
    this.drawHoverTag(ctx, sim);
    // the narrator: a desk's own place, else over the stage at the end away from the element
    this.bubbleRect = null;
    if (this.bubbleK > 0.01 && this.lastLine && !sim.story && !sim.picker) {
      if (L.bubble) this.bubbleRect = drawBubble(ctx, L, L.bubble, true, this.lastLine, this.bubbleK);
      else {
        const c = this.cam ?? figCam(L);
        const e = sim.element;
        const ey = camPt(c, e.geo.c[0], e.geo.c[1]).y;
        const s = L.stage;
        this.bubbleRect = drawBubble(ctx, L, { x: L.pic.x + 4, y: s.y + 2, w: L.pic.w - 8, h: s.h - 4 }, ey > s.y + s.h * 0.42, this.lastLine, this.bubbleK);
      }
    }
    if (sim.picker) drawPicker(ctx, L, sim, this.hoverPick());
    this.storyRect = sim.story ? drawStory(ctx, L, sim.story, this.o.touch) : null;
  }

  private drawPicture(ctx: CanvasRenderingContext2D, sim: SwiatloSim): void {
    const L = this.L;
    const st = this.picState(sim);
    const cam = this.cam ?? this.camGoal(sim);
    const list = LISTS[sim.variant];
    const of = (v: View): Element[] => list.filter(e => e.view === v);
    const view = sim.element.view;
    ctx.save();
    // keep the picture inside its stage (a zoomed figure never runs under the card)
    const s = L.stage;
    // the picture runs under the glass cards (never under the runner's HUD), so a zoom never shows a hard edge
    ctx.beginPath();
    ctx.rect(0, L.top, L.w, L.bottom - L.top);
    ctx.clip();
    if (sim.stage === 'dive') {
      const k = this.o.reducedMotion ? (sim.wayK > 0.5 ? 1 : 0) : sim.wayK;
      const into = isBrainView(view);
      const kk = into ? k : 1 - k;
      const whole = figCam(L), head = fitCam(L.stage, HEAD_BOX[0], HEAD_BOX[1], HEAD_BOX[2], HEAD_BOX[3]);
      const fcam = lerpCam(whole, head, ease.inOutSine(kk));
      const bview = (into ? view : sim.fromView) as 'lat' | 'med';
      const bc = brainCam(L);
      const bs = 0.25 + 0.75 * ease.outCubic(kk);
      const bcam = { s: bc.s * bs, ox: s.x + s.w / 2 - (s.w / 2 - (bc.ox - s.x)) * bs, oy: s.y + s.h / 2 - (s.h / 2 - (bc.oy - s.y)) * bs };
      const fview = (into ? (isBrainView(sim.fromView) ? 'front' : sim.fromView) : view) as 'front' | 'back';
      const figList = into ? LISTS[sim.variant === 'mozg' ? 'narzady' : sim.variant].filter(e => e.view === fview) : of(fview);
      drawFigure(ctx, this.dpr, fcam, fview === 'back', sim.variant === 'mozg' ? [] : figList, st, 1 - smooth(0.55, 1, kk));
      drawBrain(ctx, this.dpr, bcam, bview, LISTS.mozg.filter(e => e.view === bview), { ...st, current: into ? st.current : null }, smooth(0.35, 0.95, kk));
    } else if (sim.stage === 'turn') {
      const k = sim.wayK;
      const first = k < 0.5;
      const v = (first ? sim.fromView : view);
      const sq = this.o.reducedMotion ? 1 : Math.abs(Math.cos(Math.PI * k));
      const st2 = first ? { ...st, current: null } : st;
      if (isBrainView(v)) drawBrain(ctx, this.dpr, brainCam(L), v as 'lat' | 'med', of(v), st2, this.o.reducedMotion ? (first ? 1 - k * 2 : k * 2 - 1) : 1, sq);
      else drawFigure(ctx, this.dpr, cam, v === 'back', of(v), st2, 1, sq);
    } else if (isBrainView(view)) {
      drawBrain(ctx, this.dpr, cam, view as 'lat' | 'med', of(view), st);
    } else {
      drawFigure(ctx, this.dpr, cam, view === 'back', of(view), st);
    }
    ctx.restore();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ── the hands ──────────────────────────────────────────────────
  /** What a tap at (x, y) lands on. */
  hit(x: number, y: number, sim: SwiatloSim): Hit {
    return hitTest(this.L, { story: sim.story ? this.storyRect ?? { x: 0, y: 0, w: this.L.w, h: this.L.h } : null, picker: sim.picker }, x, y);
  }

  /** Every control the player can tap now (as `hit` tests them), for the mobile audit. */
  targets(sim: SwiatloSim): TapTarget[] {
    if (!sim.started) return [];
    return tapTargets(this.L, { story: sim.story ? this.storyRect : null, picker: sim.picker });
  }

  private hoverCtrl(sim: SwiatloSim): CtrlId | null {
    if (!this.hover || this.o.touch || sim.story || sim.picker) return null;
    const h = this.hit(this.hover.x, this.hover.y, sim);
    return h.kind === 'ctrl' ? h.id : null;
  }

  private hoverPick(): number {
    if (!this.hover || this.o.touch) return -1;
    const P = pickerRect(this.L);
    return P.rows.findIndex(r => this.hover!.x >= r.x && this.hover!.x <= r.x + r.w && this.hover!.y >= r.y && this.hover!.y <= r.y + r.h);
  }

  /** The element of the picture under a screen point (null: none). */
  elementAt(sim: SwiatloSim, x: number, y: number): Element | null {
    const c = this.cam;
    if (!c || sim.stage === 'dive' || sim.stage === 'turn') return null;
    const s = this.L.stage;
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return null;
    const p = camInv(c, x, y);
    let best: Element | null = null, bd = Infinity;
    for (const e of LISTS[sim.variant]) {
      if (e.view !== sim.element.view) continue;
      const [cx, cy] = e.geo.c;
      const xs = e.geo.mirror && Math.abs(cx) < 1e-6 ? [cx] : [cx];
      for (const ex of xs) {
        const d = Math.hypot(p.x - ex, p.y - cy) / Math.max(0.02, e.geo.r);
        if (d <= 1 && d < bd) { bd = d; best = e; }
      }
    }
    return best;
  }

  private drawHoverTag(ctx: CanvasRenderingContext2D, sim: SwiatloSim): void {
    const hv = this.hover;
    if (!hv || this.o.touch || sim.story || sim.picker || this.hoverAge > 3) return;
    const e = this.elementAt(sim, hv.x, hv.y);
    if (!e) return;
    drawTag(ctx, this.L, hv.x, hv.y, e, e.id === sim.element.id ? 'here' : sim.isLit(e.id) ? 'lit' : 'wait');
  }

  /** The mouse's cursor: a hand over what a click acts on (the buttons, the picker, a story card, the picture). */
  cursor(sim: SwiatloSim): string {
    if (!this.hover) return 'default';
    const h = this.hit(this.hover.x, this.hover.y, sim);
    if (h.kind === 'field') {
      const s = this.L.stage;
      return this.hover.x >= s.x && this.hover.x <= s.x + s.w && this.hover.y >= s.y && this.hover.y <= s.y + s.h ? 'pointer' : 'default';
    }
    return h.kind === 'outside' ? 'default' : 'pointer';
  }

  /** The screen point a coach mark points at. */
  point(at: 'element' | 'card' | 'controls' | 'picker', sim: SwiatloSim): { x: number; y: number } | null {
    const L = this.L;
    switch (at) {
      case 'element': {
        const c = this.cam ?? this.camGoal(sim);
        const e = sim.element;
        return camPt(c, e.geo.c[0], e.geo.c[1] - e.geo.r);
      }
      case 'card': {
        const r = this.cardRect;
        return r ? { x: r.x + r.w / 2, y: r.y + 4 } : null;
      }
      case 'controls': return { x: L.ctrl.prev.x, y: L.ctrl.prev.y - L.ctrl.prev.r };
      default: return null;
    }
  }

  /** The camera now (tests and the debug view). */
  get camera(): Cam | null { return this.cam; }
  /** seconds per frame budget check helper: the reveal of a blind push takes this long */
  static readonly revealSec = RULES.revealSec;
}
