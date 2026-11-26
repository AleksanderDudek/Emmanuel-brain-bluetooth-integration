/**
 * A health visualisation's play view (DESIGN.md §24, Każdy włos's render.ts generalised): the plum ground, the scene's
 * picture through its camera — a body standing free on the ground, tissue seen through a lens with a rim of light
 * (`WorldPainter.lens`) — the light of the gauge at the growing point (its edge follows the light, the threshold a
 * faint dashed ring, gold and sparkling while the picture grows), the parts named where the scene teaches them, the
 * world's counter, the words band, the four controls, the picker and the story cards (hud.ts).
 *
 * Moving between scenes the camera glides within a world; between worlds it dives — deeper (`WorldPainter.depth`) it
 * zooms into the library's portal point while the deeper picture opens from there, shallower it pulls out; worlds of
 * the same depth cross-fade.  Each world's still layer is baked per view, size, variant and look; a frame composes it
 * and draws what grows: no shadowBlur, no filters.
 */
import { clamp, ease, Floaters, Particles } from '../juice';
import type { Insets, TapTarget } from '../types';
import { applyCam, camFor, camLerp, toScreen, type Cam, type Rect } from './camera';
import { drawCaption, drawControls, drawCounter, drawLabels, drawPicker, drawStory, drawWords, type PlacedLabel } from './hud';
import { CONTROLS, hitAt, layout, tapTargets, type Control, type Layout } from './layout';
import { scenesGrown, type HealthProgress } from './meta';
import { GOLD, GOLD_HI, PEARL, SANS, bakeGround, drawLensRim, glow, layer, lensGround, lensPath, lensShade, starSprite, type Layer } from './paint';
import { RULES } from './rules';
import type { HealthSim, SimEvent } from './sim';
import type { WorldState } from './spec';

export interface ViewOpts {
  reducedMotion: boolean;
  touch: boolean;
  /** the library's light (HealthLibrary.tint.light): a soft glow of it behind the picture, baked with the ground */
  tint?: string;
}

/** A picture as drawn this frame: its scene, growth, camera (after any zoom of a dive) and alpha. */
interface Shot { scene: string; g: number; cam: Cam; alpha: number; zoom: number; at: { x: number; y: number } }

export class HealthView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private ground: Layer | null = null;
  private readonly bases = new Map<string, Layer | null>();
  private readonly parts = new Particles(180);
  private readonly floats = new Floaters();
  private time = 0;
  private lastDt = 1 / 60;
  // the camera's way between scenes
  private cur: string | null = null;
  private out: { scene: string; g: number; cam: Cam } | null = null;
  private panFrom: Cam | null = null;
  private dive: { deeper: boolean; at: { x: number; y: number } } | null = null;
  private lastCam: Cam | null = null;
  // juice
  private pop = 0;
  private flash = 0;
  private captionK = 0;
  private lastCaption = '';
  private readonly labelK = new Map<string, number>();
  /** the story card and the picker as last drawn (taps and the audit) */
  storyRect: Rect | null = null;
  pickRect: Rect | null = null;
  /** a desktop's mouse (DESIGN §14): where it is and what it is over */
  private mouse: { x: number; y: number } | null = null;
  private progress: HealthProgress | null = null;

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, { top: 134, right: 0, bottom: 0, left: 0 }, o.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.o.touch);
    const P = this.L.pic;
    this.ground = bakeGround(w, h, dpr, { x: P.x + P.w / 2, y: P.y + P.h / 2, r: Math.max(P.w, P.h) * 0.6 });
    const gc = this.o.tint && this.ground ? this.ground.getContext('2d') : null;
    if (gc && this.o.tint) {
      gc.setTransform(dpr, 0, 0, dpr, 0, 0);
      glow(gc, this.o.tint, P.x + P.w / 2, P.y + P.h / 2, Math.max(P.w, P.h) * 0.55, 0.08);
    }
    this.bases.clear();
    this.lastCam = null;
  }

  /** The camera a scene rests at in this layout. */
  private camOf(sim: HealthSim, scene: string): Cam { return camFor(sim.lib.scene(scene).view, this.L.pic); }

  // ── events → the camera and the juice ──────────────────────────
  on(e: SimEvent, sim: HealthSim): void {
    const L = this.L, lib = sim.lib;
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
        const wA = lib.scene(was).world, wB = lib.scene(e.scene).world;
        const camNow = this.lastCam ?? this.camOf(sim, was);
        if (wA === wB) {
          this.panFrom = camNow;
          this.out = null;
          this.dive = null;
        } else {
          this.panFrom = null;
          this.out = { scene: was, g: e.fromG, cam: camNow };
          const dA = lib.world(was)?.depth ?? 0, dB = lib.world(e.scene)?.depth ?? 0;
          const deeper = dB > dA;
          const pt = dA === dB ? null : (lib.spec.portal?.(deeper ? was : e.scene, deeper ? e.scene : was) ?? null);
          const cam = deeper ? camNow : this.camOf(sim, e.scene);
          const at = pt ? toScreen(cam, L.pic, pt[0], pt[1]) : { x: L.pic.x + L.pic.w / 2, y: L.pic.y + L.pic.h / 2 };
          // the same depth (or no portal): a cross-fade in place; else a dive in or a pull out
          this.dive = dA === dB ? null : { deeper, at };
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
      case 'units': {
        const f = this.focusScreen(sim);
        const side = f.x > L.pic.x + L.pic.w * 0.6 ? -1 : 1;
        this.floats.add(`+${e.n}`, clamp(f.x + side * 44 * L.u, L.pic.x + 24, L.pic.x + L.pic.w - 24), clamp(f.y - 10, L.pic.y + 60 * L.u, L.pic.y + L.pic.h - 10), { color: GOLD_HI, size: 15 * L.u, dur: 1.6 });
        break;
      }
      case 'blindEnd': {
        const f = this.focusScreen(sim);
        this.parts.burst(f.x, f.y, 16, { color: '#e6e8f6', speed: 90 * L.u, life: 1, size: 1.8, g: -6, drag: 1.8, shape: 'spark' });
        if (e.gained > 0.005) this.floats.add(lib.t('hud.revealed', { pct: lib.t('pct', { n: Math.round(Math.min(1, e.gained) * 100) }) }), f.x, f.y - 24 * L.u, { color: '#eef0ff', size: 14 * L.u, dur: 2.4 });
        break;
      }
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
  hit(sim: HealthSim, x: number, y: number): string | null {
    if (sim.story) return 'story';
    return hitAt(this.L, { story: null, picker: sim.picker, live: sim.canWalk, meds: sim.lib.meds }, x, y);
  }

  overStory(x: number, y: number): boolean {
    const r = this.storyRect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  update(dt: number, sim: HealthSim): void {
    this.time += dt;
    this.lastDt = dt;
    this.parts.update(dt);
    this.floats.update(dt);
    this.pop = Math.max(0, this.pop - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 0.6);
    const line = sim.talk.line;
    this.captionK = line ? Math.min(1, this.captionK + dt * 4) : Math.max(0, this.captionK - dt * 3);
    if (line) this.lastCaption = line.text;
    // sparkles rise from the growing point while the picture grows
    if (sim.growing && !sim.blind && !this.o.reducedMotion && Math.random() < dt * 9) {
      const f = this.focusScreen(sim);
      this.parts.burst(f.x + (Math.random() - 0.5) * 18 * this.L.u, f.y, 1, { color: Math.random() < 0.5 ? GOLD : GOLD_HI, speed: 24 * this.L.u, angle: -Math.PI / 2, spread: 0.9, life: 1.1, size: 1.5, g: -14, drag: 0.8, shape: 'dot' });
    }
    // the labels fade in as the scene teaches them
    const sc = sim.lib.scene(sim.scene);
    for (const lb of sc.labels) {
      const key = `${sim.scene}|${lb.part}|${lb.at[0]}`;
      const want = (sim.shown >= lb.from && (lb.to === undefined || sim.shown < lb.to)) || (sim.stage === 'after' && lb.to === undefined) ? 1 : 0;
      const k = this.labelK.get(key) ?? 0;
      this.labelK.set(key, want > k ? Math.min(1, k + dt * 1.6) : Math.max(0, k - dt * 2));
    }
  }

  // ── where things are ───────────────────────────────────────────
  /** The camera of the current picture now (gliding within a world). */
  private camNow(sim: HealthSim): Cam {
    const target = this.camOf(sim, sim.scene);
    if (this.panFrom && sim.stage === 'move') return camLerp(this.panFrom, target, sim.moveK);
    return target;
  }

  /** The growing point on the screen. */
  focusScreen(sim: HealthSim): { x: number; y: number } {
    const cam = this.lastCam ?? this.camOf(sim, sim.scene);
    const f = sim.lib.focusAt(sim.scene, sim.shown);
    return toScreen(cam, this.L.pic, f[0], f[1]);
  }

  // ── baking ─────────────────────────────────────────────────────
  /** A world's still layer for a scene's view at this size, variant and look. */
  private base(sim: HealthSim, scene: string): { layer: Layer | null; cam: Cam } {
    const sc = sim.lib.scene(scene);
    const cam = this.camOf(sim, scene);
    const P = this.L.pic;
    const variant = sc.variant ?? '';
    const look = sim.p.look;
    const key = `${sc.world}|${variant}|${sc.view.x},${sc.view.y},${sc.view.w},${sc.view.h}|${Math.round(P.w)}x${Math.round(P.h)}@${this.dpr}|${look}`;
    if (!this.bases.has(key)) {
      if (this.bases.size > 24) this.bases.clear();
      const Lr = layer(P.w, P.h, this.dpr);
      const world = sim.lib.spec.worlds[sc.world];
      if (Lr && world) {
        const c = Lr.ctx;
        c.setTransform(this.dpr * cam.s, 0, 0, this.dpr * cam.s, this.dpr * (P.w / 2 - cam.cx * cam.s), this.dpr * (P.h / 2 - cam.cy * cam.s));
        try {
          world.bake(c, variant, look);
        } catch (err) {
          console.error(`healthlib: ${sim.lib.id} world ${sc.world} bake failed`, err);
        }
      }
      this.bases.set(key, Lr?.c ?? null);
    }
    return { layer: this.bases.get(key) ?? null, cam };
  }

  // ── drawing ────────────────────────────────────────────────────
  draw(sim: HealthSim): void {
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
    if (this.out && sim.stage === 'move') {
      if (this.dive) {
        const Z = this.o.reducedMotion ? 1 : 3.2;
        const e = ease.inOutSine(k);
        const outZoom = this.dive.deeper ? 1 + (Z - 1) * e : 1 / (1 + (Z - 1) * e);
        const inZoom = this.dive.deeper ? 1 / (1 + (Z - 1) * (1 - e)) : 1 + (Z - 1) * (1 - e);
        shots.push({ scene: this.out.scene, g: this.out.g, cam: this.out.cam, alpha: 1 - smooth(0.32, 0.82, k), zoom: outZoom, at: this.dive.at });
        shots.push({ scene: sim.scene, g: sim.shown, cam: camIn, alpha: smooth(0.22, 0.72, k), zoom: inZoom, at: this.dive.at });
      } else {
        // two worlds of one depth: a cross-fade in place
        shots.push({ scene: this.out.scene, g: this.out.g, cam: this.out.cam, alpha: 1 - smooth(0.2, 0.75, k), zoom: 1, at: mid });
        shots.push({ scene: sim.scene, g: sim.shown, cam: camIn, alpha: smooth(0.25, 0.8, k), zoom: 1, at: mid });
      }
    } else {
      const fadeIn = sim.via === 'start' && sim.stage === 'move' ? smooth(0, 0.8, k) : 1;
      shots.push({ scene: sim.scene, g: sim.shown, cam: camIn, alpha: fadeIn, zoom: 1, at: mid });
      if (sim.stage !== 'move') this.out = null;
    }
    for (const s of shots) if (s.alpha > 0.01) this.drawShot(ctx, sim, s);
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
    const capK = sim.story || sim.picker ? 0 : this.captionK;
    drawCaption(ctx, L, this.lastCaption, capK);
    drawWords(ctx, L, sim, this.lastDt, { text: this.lastCaption, k: capK });
    const ts = { story: null, picker: false, live: sim.canWalk, meds: sim.lib.meds };
    const hv = this.mouse && !sim.story && !sim.picker ? (hitAt(L, ts, this.mouse.x, this.mouse.y) as Control | null) : null;
    drawControls(ctx, L, sim, hv && (CONTROLS as readonly string[]).includes(hv) ? hv : null, this.time);
    const spec = sim.lib.spec;
    this.pickRect = sim.picker && !sim.story
      ? drawPicker(ctx, L, sim, this.mouse ? hitAt(L, { ...ts, picker: true, live: true }, this.mouse.x, this.mouse.y) : null,
        m => (this.progress ? Math.max(scenesGrown(spec, this.progress, m), sim.grownIn(m)) : sim.grownIn(m)), m => (this.progress?.whole[m] ?? 0))
      : null;
    this.storyRect = drawStory(ctx, L, sim, !!this.mouse && this.overStory(this.mouse.x, this.mouse.y));
  }

  /** One picture: through the lens (tissue) or free on the ground (a body), its still layer, what grows. */
  private drawShot(ctx: CanvasRenderingContext2D, sim: HealthSim, s: Shot): void {
    const L = this.L, P = L.pic, dpr = this.dpr;
    const world = sim.lib.world(s.scene);
    if (!world) return;
    const lens = world.lens;
    const at = s.at, z = s.zoom;
    const box: Rect = { x: at.x + (P.x - at.x) * z, y: at.y + (P.y - at.y) * z, w: P.w * z, h: P.h * z };
    const cam: Cam = { cx: s.cam.cx, cy: s.cam.cy, s: s.cam.s * z };
    const st = this.state(sim, s.scene, s.g, cam.s);
    const base = this.base(sim, s.scene);
    ctx.save();
    ctx.globalAlpha = s.alpha;
    const R = Math.round(16 * L.u * z);
    if (lens) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clip(lensPath(box.x, box.y, box.w, box.h, R));
      lensGround(ctx, box.x, box.y, box.w, box.h);
    }
    applyCam(ctx, cam, box, dpr);
    if (base.layer) {
      const bc = base.cam;
      ctx.drawImage(base.layer, bc.cx - P.w / 2 / bc.s, bc.cy - P.h / 2 / bc.s, P.w / bc.s, P.h / bc.s);
    }
    ctx.globalAlpha = s.alpha;
    try {
      world.draw(ctx, st);
    } catch (err) {
      if (!this.drawErr) console.error(`healthlib: ${sim.lib.id} scene ${s.scene} draw failed`, err);
      this.drawErr = true;
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

  private drawErr = false;

  private state(sim: HealthSim, scene: string, g: number, px: number): WorldState {
    return {
      scene, g, deep: sim.deep, light: sim.blind ? RULES.baseLight : sim.light, growing: sim.growing && scene === sim.scene && !sim.blind,
      time: this.time, after: sim.afterSec, breath: sim.restBlock ? sim.breath.k : 0.5, blind: sim.blind,
      reduced: this.o.reducedMotion, px, look: sim.p.look,
    };
  }

  /**
   * The gauge on the picture itself: a halo at the growing point whose edge follows the light, the threshold as a
   * faint dashed ring in a sighted push — gold once past it, and gold sparks while the picture grows.  Rest: a soft
   * glow that breathes; blind: nothing that tells.
   */
  private drawGauge(ctx: CanvasRenderingContext2D, sim: HealthSim, cam: Cam): void {
    if (sim.blind || sim.story) return;
    const L = this.L;
    const fw = sim.lib.focusAt(sim.scene, sim.shown);
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

  /** The names of the parts and the world's counter. */
  private drawOnPicture(ctx: CanvasRenderingContext2D, sim: HealthSim, cam: Cam, alpha: number): void {
    const L = this.L, P = L.pic, lib = sim.lib;
    if (sim.picker || sim.story) return;
    const sc = lib.scene(sim.scene);
    const list: PlacedLabel[] = [];
    for (const lb of sc.labels) {
      const s = toScreen(cam, P, lb.at[0], lb.at[1]);
      const a = (this.labelK.get(`${sim.scene}|${lb.part}|${lb.at[0]}`) ?? 0) * alpha;
      list.push({ text: lib.partName(lb.part), ax: s.x, ay: s.y, side: lb.side, dy: lb.dy ?? 0, a });
    }
    drawLabels(ctx, L, list, P);
    const counter = lib.world(sim.scene)?.counter?.(sim.scene, sim.shown) ?? null;
    if (counter) drawCounter(ctx, L, P, counter);
  }

  /** Every control the player can tap now, for the audit. */
  targets(sim: HealthSim): TapTarget[] {
    if (!sim.started) return [];
    return tapTargets(this.L, { story: sim.story ? (this.storyRect ?? this.L.story) : null, picker: sim.picker, live: sim.canWalk, meds: sim.lib.meds });
  }
}

const smooth = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
