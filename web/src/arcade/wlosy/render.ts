/**
 * Każdy włos's play view (DESIGN.md §15): the plum ground, the scene's picture through its camera — the head and the
 * head from above standing free on the ground, the skin, the section and the follicle seen through a lens with a rim
 * of light — the light of the gauge at the growing point (its edge follows the light, the threshold a faint dashed
 * ring, gold and sparkling while the picture grows), the parts named where the scene teaches them, the words band,
 * the four controls, the picker and the story cards (hud.ts).
 *
 * Moving between scenes the camera glides within a picture; between pictures it dives — deeper (head → section →
 * follicle) it zooms into the place it came from while the lens opens from there, shallower it pulls out.  Each
 * picture's still parts are baked per view and size; a frame composes them and draws what grows: no shadowBlur, no
 * filters.
 *
 * Round 23, "Ciało słucha" (kit/innerdraw.ts, as the engine's games): a word received in calm dissolves into 12–18
 * gold motes that drift from the words band to the growing point (reduced motion: a soft fade); "Przed snem" lays a
 * dark veil and a warm wash over the picture — under the words and the controls — with a small crescent in its corner.
 */
import { InnerFx, drawNightMark, drawNightVeil } from '../kit/innerdraw';
import { clamp, ease, Floaters, Particles } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { DEPTH, SCENE, portal, sceneAt, type HairColour, type SceneId, type World } from './content';
import { NECK, hairsIn, type Phase, type Rect } from './geo';
import {
  drawCaption, drawControls, drawCounter, drawDial, drawLabels, drawLegend, drawPicker, drawStory, drawWords, type PlacedLabel,
} from './hud';
import { hairsText, t } from './i18n';
import { wt } from './inner';
import { CONTROLS, hitAt, layout, tapTargets, type Control, type Layout } from './layout';
import { scenesGrown, type WlosyProgress } from './meta';
import {
  GOLD, GOLD_HI, PEARL, SANS, bakeGround, drawLensRim, glow, layer, lensGround, lensPath, lensShade, starSprite, type Layer,
} from './paint';
import { RULES } from './rules';
import type { SimEvent, WlosySim } from './sim';
import { applyCam, camFor, camLerp, toScreen, type Cam, type WorldState } from './world';
import { StrandLayer, bakeAbove, bakeSkin, drawAbove, drawSkin, unitsShown, unitsAll } from './world-above';
import { bakeDermis, bakeEpidermis, drawFollicleOver, drawFollicleUnder, folFocus } from './world-follicle';
import { bakeHead, drawHead, headLift } from './world-head';
import { bakeSection, drawSection, mosaicCounts, type SecVariant } from './world-section';

const LENS: Readonly<Record<World, boolean>> = { head: false, above: false, skin: true, section: true, follicle: true };

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

/** A picture as drawn this frame: its scene, growth, camera (after any zoom of a dive) and alpha. */
interface Shot { scene: SceneId; g: number; cam: Cam; alpha: number; zoom: number; at: { x: number; y: number } }

export class WlosyView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private ground: Layer | null = null;
  private readonly bases = new Map<string, Layer | null>();
  private readonly strands = new StrandLayer();
  private readonly strandsOut = new StrandLayer();
  private readonly parts = new Particles(180);
  private readonly floats = new Floaters();
  private time = 0;
  private lastDt = 1 / 60;
  // the camera's way between scenes
  private cur: SceneId | null = null;
  private out: { scene: SceneId; g: number; cam: Cam } | null = null;
  private panFrom: Cam | null = null;
  private dive: { deeper: boolean; at: { x: number; y: number } } | null = null;
  private lastCam: Cam | null = null;
  // juice
  private pop = 0;
  private flash = 0;
  private captionK = 0;
  private lastCaption = '';
  private labelK = new Map<string, number>();
  /** the inner layer's effects (round 23): the word's dissolve and its motes; the night's veil fading in */
  readonly fx: InnerFx;
  private nightK = 0;
  /** the story card and the picker as last drawn (taps and the audit) */
  storyRect: Rect | null = null;
  pickRect: Rect | null = null;
  /** a desktop's mouse (DESIGN §14): where it is and what it is over */
  private mouse: { x: number; y: number } | null = null;
  private progress: WlosyProgress | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, { top: 134, right: 0, bottom: 0, left: 0 }, o.touch);
    this.fx = new InnerFx(o.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.o.touch);
    const P = this.L.pic;
    this.ground = bakeGround(w, h, dpr, { x: P.x + P.w / 2, y: P.y + P.h / 2, r: Math.max(P.w, P.h) * 0.6 });
    this.bases.clear();
    this.lastCam = null;
  }

  /** The camera a scene rests at in this layout. */
  private camOf(scene: SceneId): Cam { return camFor(SCENE[scene].view, this.L.pic); }

  // ── events → the camera and the juice ──────────────────────────
  on(e: SimEvent, sim: WlosySim): void {
    const L = this.L;
    this.progress = sim.p;
    switch (e.type) {
      case 'scene': {
        const was = this.cur;
        this.cur = e.scene;
        if (!was || e.via === 'start') {
          this.out = null;
          this.panFrom = null;
          this.dive = null;
          break;
        }
        const wA = SCENE[was].world, wB = SCENE[e.scene].world;
        const camNow = this.lastCam ?? this.camOf(was);
        if (wA === wB) {
          this.panFrom = camNow;
          this.out = null;
          this.dive = null;
        } else {
          this.panFrom = null;
          this.out = { scene: was, g: e.fromG, cam: camNow };
          const deeper = DEPTH[wB] > DEPTH[wA];
          const shallow = deeper ? wA : wB;
          const deep = deeper ? wB : wA;
          const pt = DEPTH[wA] === DEPTH[wB] ? null : portal(shallow, deep);
          const cam = deeper ? camNow : this.camOf(e.scene);
          const at = pt ? toScreen(cam, L.pic, pt[0], pt[1]) : { x: L.pic.x + L.pic.w / 2, y: L.pic.y + L.pic.h / 2 };
          this.dive = { deeper: DEPTH[wB] >= DEPTH[wA], at };
        }
        break;
      }
      case 'tick': {
        const f = this.focusScreen(sim);
        this.parts.burst(f.x, f.y, 3, { color: GOLD_HI, speed: 40 * L.u, life: 0.7, size: 1.6, g: -20, drag: 2, shape: 'dot' });
        break;
      }
      case 'grown': {
        const f = this.focusScreen(sim);
        this.pop = 1;
        this.parts.burst(f.x, f.y, 22, { color: GOLD, speed: 110 * L.u, life: 1.1, size: 2, g: -16, drag: 1.8, shape: 'spark' });
        this.parts.burst(f.x, f.y, 1, { color: '#ffffff', speed: 0, life: 0.9, size: 26 * L.u, g: 0, drag: 0, shape: 'ring' });
        break;
      }
      case 'whole':
        this.flash = this.o.reducedMotion ? 0.5 : 1;
        break;
      case 'hairs': {
        const f = this.focusScreen(sim);
        const side = f.x > L.pic.x + L.pic.w * 0.6 ? -1 : 1;
        this.floats.add(`+${e.n}`, clamp(f.x + side * 44 * L.u, L.pic.x + 24, L.pic.x + L.pic.w - 24), clamp(f.y - 10, L.pic.y + 60 * L.u, L.pic.y + L.pic.h - 10), { color: GOLD_HI, size: 15 * L.u, dur: 1.6 });
        break;
      }
      case 'blindEnd': {
        const f = this.focusScreen(sim);
        this.parts.burst(f.x, f.y, 16, { color: '#e6e8f6', speed: 90 * L.u, life: 1, size: 1.8, g: -6, drag: 1.8, shape: 'spark' });
        if (e.gained > 0.005) this.floats.add(t('hud.revealed', { pct: t('pct', { n: Math.round(Math.min(1, e.gained) * 100) }) }), f.x, f.y - 24 * L.u, { color: '#eef0ff', size: 14 * L.u, dur: 2.4 });
        break;
      }
      case 'received':
        // the word goes into the picture as light (reduced motion: it fades with a soft glow)
        this.fx.received(e.text, this.focusScreen(sim));
        break;
      case 'gold':
        if (e.on) {
          const f = this.focusScreen(sim);
          this.parts.burst(f.x, f.y, 8, { color: GOLD, speed: 60 * L.u, life: 0.8, size: 1.6, g: -6, drag: 2, shape: 'dot' });
        }
        break;
      default:
        break;
    }
  }

  /** A touch-down on the picture: a soft ring of light under the finger, at once. */
  touch(x: number, y: number): void {
    this.parts.burst(x, y, 1, { color: PEARL, speed: 0, life: 0.5, size: 12, g: 0, drag: 0, shape: 'ring' });
  }

  hover(x: number, y: number): void {
    if (this.o.touch) return;
    this.mouse = { x, y };
  }

  /** What is under a point now: a control, a picker part, the story card, or the picture (null). */
  hit(sim: WlosySim, x: number, y: number): string | null {
    if (sim.story) return 'story';
    return hitAt(this.L, { story: null, picker: sim.picker, live: sim.canWalk }, x, y);
  }

  overStory(x: number, y: number): boolean {
    const r = this.storyRect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  update(dt: number, sim: WlosySim): void {
    this.time += dt;
    this.lastDt = dt;
    this.parts.update(dt);
    this.floats.update(dt);
    this.fx.update(dt);
    this.nightK = sim.inner.night ? Math.min(1, this.nightK + dt / 2) : 0;
    this.pop = Math.max(0, this.pop - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 0.6);
    const line = sim.talk.line;
    this.captionK = line ? Math.min(1, this.captionK + dt * 4) : Math.max(0, this.captionK - dt * 3);
    if (line) this.lastCaption = line.text;
    // sparkles rise from the growing point while the picture grows
    if (sim.growing && !this.o.reducedMotion && Math.random() < dt * 9) {
      const f = this.focusScreen(sim);
      this.parts.burst(f.x + (Math.random() - 0.5) * 18 * this.L.u, f.y, 1, { color: Math.random() < 0.5 ? GOLD : GOLD_HI, speed: 24 * this.L.u, angle: -Math.PI / 2, spread: 0.9, life: 1.1, size: 1.5, g: -14, drag: 0.8, shape: 'dot' });
    }
    // the labels fade in as the scene teaches them
    const sc = SCENE[sim.scene];
    for (const lb of sc.labels) {
      const key = `${sim.scene}|${lb.part}|${lb.at[0]}`;
      const want = sim.shown >= lb.from || sim.stage === 'after' ? 1 : 0;
      const k = this.labelK.get(key) ?? 0;
      this.labelK.set(key, want > k ? Math.min(1, k + dt * 1.6) : Math.max(0, k - dt * 2));
    }
  }

  // ── where things are ───────────────────────────────────────────
  /** The camera of the current picture now (gliding within a picture). */
  private camNow(sim: WlosySim): Cam {
    const target = this.camOf(sim.scene);
    if (this.panFrom && sim.stage === 'move') return camLerp(this.panFrom, target, sim.moveK);
    return target;
  }

  /** The growing point on the screen. */
  private focusScreen(sim: WlosySim): { x: number; y: number } {
    const cam = this.lastCam ?? this.camOf(sim.scene);
    const f = this.focusWorld(sim.scene, sim.shown);
    return toScreen(cam, this.L.pic, f[0], f[1]);
  }

  private focusWorld(scene: SceneId, g: number): readonly [number, number] {
    const sc = SCENE[scene];
    if (sc.world === 'follicle') return folFocus(scene, g);
    return sc.focus;
  }

  // ── baking ─────────────────────────────────────────────────────
  private variant(scene: SceneId): string {
    const w = SCENE[scene].world;
    if (w === 'head') return scene === 'glowa' ? 'bare' : 'ghost';
    if (w === 'section') return scene === 'wyrastanie' ? 'noshaft' : scene === 'mozaika' ? 'bare' : scene === 'naskorek' ? 'epi' : 'anagen';
    return 'one';
  }

  /** A picture's still layer for a scene's view at this size (and the follicle's epidermis over it). */
  private base(scene: SceneId, colour: HairColour, part: 'under' | 'over' = 'under'): { layer: Layer | null; cam: Cam } {
    const sc = SCENE[scene];
    const cam = this.camOf(scene);
    const P = this.L.pic;
    const variant = this.variant(scene);
    const key = `${sc.world}|${part}|${variant}|${sc.view.x},${sc.view.y},${sc.view.w},${sc.view.h}|${Math.round(P.w)}x${Math.round(P.h)}@${this.dpr}|${sc.world === 'section' ? colour : ''}`;
    if (!this.bases.has(key)) {
      if (this.bases.size > 24) this.bases.clear();
      const Lr = layer(P.w, P.h, this.dpr);
      if (Lr) {
        const c = Lr.ctx;
        c.setTransform(this.dpr * cam.s, 0, 0, this.dpr * cam.s, this.dpr * (P.w / 2 - cam.cx * cam.s), this.dpr * (P.h / 2 - cam.cy * cam.s));
        if (sc.world === 'head') bakeHead(c, variant === 'ghost' ? 0.09 : 0);
        else if (sc.world === 'above') bakeAbove(c);
        else if (sc.world === 'skin') bakeSkin(c);
        else if (sc.world === 'section') bakeSection(c, variant as SecVariant, colour);
        else if (part === 'over') bakeEpidermis(c);
        else bakeDermis(c);
      }
      this.bases.set(key, Lr?.c ?? null);
    }
    return { layer: this.bases.get(key) ?? null, cam };
  }

  // ── drawing ────────────────────────────────────────────────────
  draw(sim: WlosySim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L, P = L.pic, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.ground) ctx.drawImage(this.ground, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#160b26';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    if (!sim.started) return;
    const k = sim.moveK;
    const camIn = this.camNow(sim);
    const shots: Shot[] = [];
    const mid = { x: P.x + P.w / 2, y: P.y + P.h / 2 };
    if (this.out && sim.stage === 'move' && this.dive) {
      const Z = this.o.reducedMotion ? 1 : 3.2;
      const e = ease.inOutSine(k);
      const outZoom = this.dive.deeper ? 1 + (Z - 1) * e : 1 / (1 + (Z - 1) * e);
      const inZoom = this.dive.deeper ? 1 / (1 + (Z - 1) * (1 - e)) : 1 + (Z - 1) * (1 - e);
      shots.push({ scene: this.out.scene, g: this.out.g, cam: this.out.cam, alpha: 1 - smooth(0.32, 0.82, k), zoom: outZoom, at: this.dive.at });
      shots.push({ scene: sim.scene, g: sim.shown, cam: camIn, alpha: smooth(0.22, 0.72, k), zoom: inZoom, at: this.dive.at });
    } else {
      const fadeIn = sim.via === 'start' && sim.stage === 'move' ? smooth(0, 0.8, k) : 1;
      shots.push({ scene: sim.scene, g: sim.shown, cam: camIn, alpha: fadeIn, zoom: 1, at: mid });
      if (sim.stage !== 'move') this.out = null;
    }
    for (const s of shots) if (s.alpha > 0.01) this.drawShot(ctx, sim, s, s.scene === sim.scene ? this.strands : this.strandsOut);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lastCam = camIn;
    const live = shots[shots.length - 1];
    if (live.alpha > 0.3) {
      this.drawGauge(ctx, sim, camIn);
      this.drawOnPicture(ctx, sim, camIn, live.alpha);
    }
    this.parts.draw(ctx);
    this.floats.draw(ctx, `800 ${SANS}`);
    if (this.flash > 0) glow(ctx, GOLD_HI, mid.x, mid.y, Math.max(P.w, P.h) * 0.6, 0.28 * Math.sin(Math.PI * Math.min(1, this.flash)));
    if (sim.blind) {
      ctx.fillStyle = 'rgba(6,3,16,.36)';
      ctx.fillRect(P.x - 4, P.y - 4, P.w + 8, P.h + 8);
    }
    // before sleep: darker and warmer — over the picture and its ground, under the words and the controls
    if (this.nightK > 0) {
      drawNightVeil(ctx, 0, 0, L.w, L.h, this.nightK);
      if (!sim.story && !sim.picker) drawNightMark(ctx, wt('hud.night'), P.x + P.w - 12, P.y + 16, 0.78 * this.nightK);
    }
    const capK = sim.story || sim.picker ? 0 : this.captionK;
    drawCaption(ctx, L, this.lastCaption, capK);
    drawWords(ctx, L, sim, this.lastDt, { text: this.lastCaption, k: capK }, this.fx);
    this.fx.drawMotes(ctx);
    const hv = this.mouse && !sim.story && !sim.picker ? (hitAt(L, { story: null, picker: false, live: sim.canWalk }, this.mouse.x, this.mouse.y) as Control | null) : null;
    drawControls(ctx, L, sim, hv && (CONTROLS as readonly string[]).includes(hv) ? hv : null, this.time);
    this.pickRect = sim.picker && !sim.story
      ? drawPicker(ctx, L, sim, this.mouse ? hitAt(L, { story: null, picker: true, live: true }, this.mouse.x, this.mouse.y) : null,
        m => (this.progress ? Math.max(scenesGrown(this.progress, m), sim.grownIn(m)) : sim.grownIn(m)), m => (this.progress?.whole[m] ?? 0))
      : null;
    this.storyRect = drawStory(ctx, L, sim, !!this.mouse && this.overStory(this.mouse.x, this.mouse.y));
  }

  /** One picture: through the lens (the tissues) or free on the ground (the head), its still layer, what grows. */
  private drawShot(ctx: CanvasRenderingContext2D, sim: WlosySim, s: Shot, cache: StrandLayer): void {
    const L = this.L, P = L.pic, dpr = this.dpr;
    const sc = SCENE[s.scene];
    const lens = LENS[sc.world];
    const at = s.at, z = s.zoom;
    const box: Rect = { x: at.x + (P.x - at.x) * z, y: at.y + (P.y - at.y) * z, w: P.w * z, h: P.h * z };
    const cam: Cam = { cx: s.cam.cx, cy: s.cam.cy, s: s.cam.s * z };
    const st = this.state(sim, s.scene, s.g, cam.s);
    const base = this.base(s.scene, sim.p.colour);
    ctx.save();
    ctx.globalAlpha = s.alpha;
    const R = Math.round(16 * L.u * z);
    if (lens) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clip(lensPath(box.x, box.y, box.w, box.h, R));
      lensGround(ctx, box.x, box.y, box.w, box.h);
    }
    applyCam(ctx, cam, box, dpr);
    const lift = sc.world === 'head' ? headLift(s.scene, s.g) : 0;
    if (lift) {
      ctx.translate(NECK[0], NECK[1]);
      ctx.rotate(lift);
      ctx.translate(-NECK[0], -NECK[1]);
    }
    if (base.layer) {
      const bc = base.cam;
      ctx.drawImage(base.layer, bc.cx - P.w / 2 / bc.s, bc.cy - P.h / 2 / bc.s, P.w / bc.s, P.h / bc.s);
    }
    ctx.globalAlpha = s.alpha;
    if (sc.world === 'head') drawHead(ctx, st);
    // the strands' layer is kept under the picture's resting camera (a dive's zoom scales it instead of redrawing it)
    else if (sc.world === 'above') drawAbove(ctx, st, cache, P, s.cam, dpr);
    else if (sc.world === 'skin') drawSkin(ctx, st);
    else if (sc.world === 'section') drawSection(ctx, st);
    else {
      drawFollicleUnder(ctx, st);
      const over = this.base(s.scene, sim.p.colour, 'over');
      if (over.layer) {
        const oc = over.cam;
        ctx.drawImage(over.layer, oc.cx - P.w / 2 / oc.s, oc.cy - P.h / 2 / oc.s, P.w / oc.s, P.h / oc.s);
      }
      drawFollicleOver(ctx, st);
    }
    if (lens) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lensShade(ctx, box.x, box.y, box.w, box.h);
    }
    ctx.restore();
    if (lens) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawLensRim(ctx, box.x, box.y, box.w, box.h, R, s.alpha);
    }
  }

  private state(sim: WlosySim, scene: SceneId, g: number, px: number): WorldState {
    return {
      scene, g, deep: sim.deep, light: sim.blind ? RULES.baseLight : sim.light, growing: sim.growing && scene === sim.scene && !sim.blind,
      time: this.time, colour: sim.p.colour, after: sim.afterSec, breath: sim.restBlock ? sim.breath.k : 0.5, blind: sim.blind,
      reduced: this.o.reducedMotion, px,
    };
  }

  /**
   * The gauge on the picture itself: a halo at the growing point whose edge follows the light, the threshold as a
   * faint dashed ring in a sighted push — gold once past it, and gold sparks while the picture grows.  Rest: a soft
   * glow that breathes; blind: nothing that tells.
   */
  private drawGauge(ctx: CanvasRenderingContext2D, sim: WlosySim, cam: Cam): void {
    if (sim.blind || sim.story) return;
    const L = this.L;
    const fw = this.focusWorld(sim.scene, sim.shown);
    const f = toScreen(cam, L.pic, fw[0], fw[1]);
    const R0 = Math.max(10, Math.min(L.pic.w, L.pic.h) * 0.06) * (1 + 0.12 * Math.sin(Math.PI * this.pop));
    if (sim.restBlock) {
      glow(ctx, '#ffb7a0', f.x, f.y, R0 * (2 + 0.6 * sim.breath.k), 0.12 + 0.2 * sim.deep);
      return;
    }
    const light = sim.light;
    const edge = R0 * (1 + 1.2 * light);
    glow(ctx, sim.growing ? GOLD : PEARL, f.x, f.y, edge / 0.55, 0.12 + 0.28 * light);
    if (sim.sighted) {
      const th = R0 * (1 + 1.2 * RULES.gold);
      ctx.save();
      ctx.lineWidth = 1.2;
      if (sim.goldOn) ctx.strokeStyle = 'rgba(255,217,138,.75)';
      else {
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = this.time * 6;
        ctx.strokeStyle = 'rgba(240,232,255,.42)';
      }
      ctx.beginPath();
      ctx.arc(f.x, f.y, th, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (sim.growing) {
        const spr = starSprite();
        if (spr && !this.o.reducedMotion) {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 4; i++) {
            const a = this.time * 0.7 + (i * Math.PI) / 2;
            const r = edge * (0.75 + 0.15 * Math.sin(this.time * 2 + i));
            const s = 5 + 3 * Math.sin(this.time * 3 + i * 1.7);
            ctx.globalAlpha = 0.55;
            ctx.drawImage(spr, f.x + Math.cos(a) * r - s, f.y + Math.sin(a) * r - s, 2 * s, 2 * s);
          }
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
  }

  /** The names of the parts, the cycle's dial, the mosaic's legend, the counter of a square centimetre. */
  private drawOnPicture(ctx: CanvasRenderingContext2D, sim: WlosySim, cam: Cam, alpha: number): void {
    const L = this.L, P = L.pic;
    const sc = SCENE[sim.scene];
    const lift = sc.world === 'head' ? headLift(sim.scene, sim.shown) : 0;
    const list: PlacedLabel[] = [];
    for (const lb of sc.labels) {
      let [x, y] = lb.at;
      if (lift) {
        const dx = x - NECK[0], dy = y - NECK[1];
        x = NECK[0] + dx * Math.cos(lift) - dy * Math.sin(lift);
        y = NECK[1] + dx * Math.sin(lift) + dy * Math.cos(lift);
      }
      const s = toScreen(cam, P, x, y);
      const a = (this.labelK.get(`${sim.scene}|${lb.part}|${lb.at[0]}`) ?? 0) * alpha;
      list.push({ part: lb.part, ax: s.x, ay: s.y, side: lb.side, dy: lb.dy ?? 0, a });
    }
    if (sim.picker || sim.story) return;
    drawLabels(ctx, L, list, P);
    const g = sim.shown;
    if (sim.scene === 'anagen' || sim.scene === 'katagen' || sim.scene === 'nowy') {
      const { at, phase } = cycleAt(sim.scene, g);
      drawDial(ctx, L, P, at, phase);
    } else if (sim.scene === 'mozaika') drawLegend(ctx, L, P, mosaicCounts(g));
    else if (sim.scene === 'jednostki') {
      const n = hairsIn(unitsAll(), Math.floor(unitsShown(g)));
      drawCounter(ctx, L, P, `${hairsText(n)} · ${t('part.cm')}`);
    }
  }

  /** Every control the player can tap now, for the audit. */
  targets(sim: WlosySim): TapTarget[] {
    if (!sim.started) return [];
    return tapTargets(this.L, { story: sim.story ? (this.storyRect ?? this.L.story) : null, picker: sim.picker, live: sim.canWalk });
  }

  /** The scene a session at this place would show (the intro and the tests). */
  static sceneOf(sim: WlosySim): SceneId { return sceneAt(sim.med, sim.idx); }
}

const smooth = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Where the cycle's dial stands in a cycle scene: anagen runs through its arc, catagen into telogen, a new anagen begins. */
export function cycleAt(scene: SceneId, g: number): { at: number; phase: Phase } {
  const A = 36 / 39.7, C = 0.7 / 39.7;
  if (scene === 'anagen') return { at: 0.04 + (A - 0.08) * g, phase: 'anagen' };
  if (scene === 'katagen') {
    const k1 = clamp(g / 0.62);
    if (k1 < 1) return { at: A + C * k1, phase: 'catagen' };
    return { at: A + C + (1 - A - C) * 0.8 * clamp((g - 0.62) / 0.38), phase: 'telogen' };
  }
  const at = g < 0.2 ? 0.96 + 0.04 * (g / 0.2) : 0.02 * ((g - 0.2) / 0.8);
  return { at: at % 1, phase: g < 0.2 ? 'telogen' : 'anagen' };
}
