/**
 * Rozświetl (Light Up): a dark picture of a mood — loneliness, sadness, debt, fear, sickness, a storm,
 * chains, exhaustion — lies as a mosaic over the same place in the light (DESIGN §13.7, rooted in
 * Isaiah 60:1, "Arise, shine, for your light has come").  The player's attention is the light: in a
 * push block it presses on the aimed tile from behind (focus ×1…×3, its halo spilling onto the
 * neighbours), cracks run, a full tile bursts into shards and passes its light on (chains); held focus
 * fills the flare.  A rest block is gazing: calm warms the uncovered pieces and lays gold in their
 * seams (kintsugi), which carries the light in the next push.  A finished picture blooms, gets its card
 * and verse, and the next pair assembles.  The player's own photos can take turns with the eight.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the pairs and the strategies in content.ts, the meta in meta.ts, the firefly in talk.ts), the
 * pictures (scenes.ts on scenekit.ts; render.ts with layout.ts and paint.ts; preview.ts for the lobby and
 * the calibration), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { getImage, loadPixels, pixelsToCanvas } from '../kit/images';
import { buzz, clamp } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { detailWeight, edgeMap, veil, type Pixels } from '../kit/mosaic';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { RozSound } from './audio';
import { t, unit, type Key } from './i18n';
import { tapTargets } from './layout';
import { bestOf, freshProgress, migrate, type PicSrc, type RozProgress } from './meta';
import { progressPanel } from './panel';
import { RozIntro, drawPreview } from './preview';
import { RozView } from './render';
import { paintScene } from './scenes';
import { RozSim, type Coach, type CoachAt, type SimEvent } from './sim';

/** a finger that moves farther than this (px) drags; less is a tap */
const TAP_PX = 10;
/** a touch drag aims the light this far above the finger, so the finger never covers it */
const LIFT = 58;

class RozGame implements ArcadeGame {
  private readonly sim: RozSim;
  private readonly view: RozView;
  private readonly sound: RozSound;
  private readonly introScene = new RozIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private finger: number | null = null;
  private press: { x: number; y: number; moved: boolean } | null = null;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 2;
  /** how long the coach mark on screen stays (s) */
  private hintLeft = 0;
  /** own pairs whose pictures are loaded, and their detail maps */
  private readonly ready = new Set<string>();
  private readonly details = new Map<string, { edges: Float32Array; w: number; h: number }>();
  private alive = true;

  constructor(private readonly env: GameEnv<RozProgress>) {
    migrate(env.progress);
    this.view = new RozView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sim = new RozSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg',
      tuning: env.tuning, aspect: 1, ownReady: () => [...this.ready], weight: (src, w, h) => this.weightFor(src, w, h),
    });
    this.sound = new RozSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    void this.loadOwn();
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __rozswietl?: unknown }).__rozswietl = this.sim;
  }

  /** The player's own pairs: the "after" decoded, the "before" too or the "after" veiled in ash and rain. */
  private async loadOwn(): Promise<void> {
    for (const o of this.env.progress.own) {
      try {
        const a = await getImage(o.after);
        if (!a || !this.alive) continue;
        const after = await loadPixels(a.blob, 1280);
        let before: HTMLCanvasElement | null = null;
        if (o.before) {
          const b = await getImage(o.before);
          if (b) before = (await loadPixels(b.blob, 1280)).canvas;
        }
        if (!before) before = ashAndRain(pixelsToCanvas(veil(await small(after.canvas, 720), { dark: 0.38, desaturate: 0.9 })));
        const det = await small(after.canvas, 200);
        this.details.set(o.id, { edges: edgeMap(det), w: det.width, h: det.height });
        this.view.own.set(o.id, { after: after.canvas, before, label: o.label });
        this.ready.add(o.id);
      } catch { /* a picture that will not decode is left out of the rotation */ }
    }
  }

  /** Smaller tiles where the picture has detail (the faces, the hands), from its edges. */
  private weightFor(src: PicSrc, w: number, h: number): ((x: number, y: number) => number) | undefined {
    try {
      let d = this.details.get(src.id);
      if (!d && src.kind === 'pair' && typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = 180;
        c.height = Math.max(40, Math.round(180 * (h / w)));
        const x = c.getContext('2d', { willReadFrequently: true });
        if (!x) return undefined;
        paintScene(x, c.width, c.height, src.id, true);
        const px = x.getImageData(0, 0, c.width, c.height);
        d = { edges: edgeMap({ width: px.width, height: px.height, data: px.data }), w: px.width, h: px.height };
        this.details.set(src.id, d);
      }
      if (!d) return undefined;
      const f = detailWeight(d.edges, d.w, d.h, w, h);
      // gentler than the raw detail: the dark picture is still a mosaic of even pieces
      return (x, y) => 0.55 + 0.45 * f(x, y);
    } catch {
      return undefined;
    }
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
    this.sim.aspect = this.view.aspect;
  }

  intro(dt: number, p: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress, this.env.daySeed, this.dpr);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.aspect = this.view.aspect;
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.aspect = this.view.aspect;
    // a phone turned: the picture is cut again for the new frame (nothing lost)
    if (this.sim.started && this.press === null) this.sim.refit(this.view.aspect);
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.hintLeft = Math.max(0, this.hintLeft - dt);
    this.flushHints();
    this.sim.coachUp = this.hintLeft > 0;
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A press shows at once (a glow under the finger) and acts at once: a card closes, a ready flare goes off
   * there, a dark tile is aimed and knocked, an uncovered one takes gold while gazing.  A finger that moves
   * 10 px drags the light: it follows a lens drawn above the finger (under a mouse, the pointer itself).
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      if (this.finger !== null && this.finger !== e.id) this.letGo();
      this.finger = e.id;
      if (sim.story) {
        sim.tapCard();
        this.drain();
        return;
      }
      if (!view.inFrame(e.x, e.y, 12)) return;
      this.press = { x: e.x, y: e.y, moved: false };
      view.ripple(e.x, e.y);
      sim.tap(view.toPic(clamp(e.x, view.frame.x, view.frame.x + view.frame.w), clamp(e.y, view.frame.y, view.frame.y + view.frame.h)));
      this.drain();
      return;
    }
    if (e.id !== this.finger) return;
    const pr = this.press;
    if (e.type === 'move') {
      if (!pr) return;
      if (!pr.moved && Math.hypot(e.x - pr.x, e.y - pr.y) > TAP_PX) {
        pr.moved = true;
        if (this.env.haptics) buzz(6);
      }
      if (pr.moved) {
        const lift = this.env.touch ? LIFT : 0;
        const lx = clamp(e.x, view.frame.x, view.frame.x + view.frame.w), ly = clamp(e.y - lift, view.frame.y, view.frame.y + view.frame.h);
        view.lens = { x: lx, y: ly, fx: e.x, fy: e.y };
        sim.drag(view.toPic(lx, ly));
        this.drain();
      }
      return;
    }
    this.letGo();
  }

  private letGo(): void {
    this.finger = null;
    this.press = null;
    this.view.lens = null;
  }

  /** Space: close a card, release a ready flare, else knock on the aimed tile. */
  key(key: string, down: boolean): boolean {
    if (key !== ' ' && key !== 'Spacebar' && key !== 'Enter') return false;
    if (down) {
      this.sim.space();
      this.drain();
    }
    return true;
  }

  pause(paused: boolean): void {
    if (paused) this.letGo();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (e.type === 'story') this.env.hint('');
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at what it explains — never over a card; one at a time, a few seconds apart. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || this.press?.moved) return;
    for (let i = 0; i < this.hints.length; i++) {
      const h = this.hints[i];
      // a moment that has passed is let go; the flare's waits out a gazing block (it cannot go off then)
      if ((h.what === 'flare' && !sim.flareReady) || (h.what === 'rest' && !sim.restBlock)) {
        this.hints.splice(i--, 1);
        continue;
      }
      if (h.what === 'flare' && sim.restBlock) continue;
      this.hints.splice(i, 1);
      const at = h.at?.kind === 'tile' ? this.view.pointAt(sim, h.at.cell) : h.at?.kind === 'aim' ? this.view.pointAt(sim, null) : null;
      const ms = h.what === 'halo' || h.what === 'rest' || h.what === 'blind' ? 5200 : 4200;
      this.hintCool = ms / 1000 + 0.8;
      this.hintLeft = ms / 1000;
      this.sim.talk.hush();
      this.env.hint(coachText(h.what, this.env.touch), at, ms);
      return;
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b?.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.task || undefined, left: b && s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.task, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    if (!s.started) return { value: 0 };
    if (s.flareReady) return { value: s.score, sub: t('hud.subFlare') };
    const best = s.p.best;
    const left = best - s.score;
    if (s.session > 1 && best > 0 && left > 0 && left <= Math.max(10, best * 0.2)) return { value: s.score, sub: t('hud.subBest', { left }) };
    const pic = s.pic;
    const count = `${pic.open}/${pic.tiles.length}`;
    return { value: s.score, sub: pic.day ? `${count} · ${t('hud.day')}` : count };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome {
    return this.sim.result(id => this.env.progress.own.find(o => o.id === id)?.label || t('hud.own'));
  }

  targets(): TapTarget[] {
    if (!this.sim.started || !this.sim.story) return [];
    return tapTargets(this.view.cardRect);
  }

  destroy(): void {
    this.alive = false;
    this.letGo();
  }
}

/** A canvas's picture at most `side` px on its longer side, as pixels (for the veil and the detail map). */
async function small(src: HTMLCanvasElement, side: number): Promise<Pixels> {
  const k = Math.min(1, side / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k));
  c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(src, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data };
}

/** The veiled "after" as a dark "before": ash drifting and rain across it. */
function ashAndRain(c: HTMLCanvasElement): HTMLCanvasElement {
  const x = c.getContext('2d');
  if (!x) return c;
  const u = Math.min(c.width, c.height) / 100;
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.strokeStyle = 'rgba(160,172,196,.3)';
  x.lineWidth = Math.max(1, u * 0.18);
  x.lineCap = 'round';
  x.beginPath();
  const n = Math.round((c.width * c.height) / (u * u) * 0.08);
  for (let i = 0; i < n; i++) {
    const px = rnd() * c.width, py = rnd() * c.height, len = u * (2 + rnd() * 3);
    x.moveTo(px, py);
    x.lineTo(px - len * 0.25, py + len);
  }
  x.stroke();
  for (let i = 0; i < n * 0.4; i++) {
    x.fillStyle = rnd() < 0.5 ? 'rgba(120,124,132,.35)' : 'rgba(30,32,40,.4)';
    x.fillRect(rnd() * c.width, rnd() * c.height, u * (0.3 + rnd() * 0.6), u * (0.3 + rnd() * 0.5));
  }
  return c;
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (!touch && (what === 'flare' || what === 'drag')) return t(`coach.${what}.keys` as Key);
  return t(`coach.${what}` as Key);
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'burst': buzz(e.depth >= 1 ? [10, 20, 14] : 14); break;
    case 'knock': if (e.power > 0) buzz(6); break;
    case 'flareReady': buzz(20); break;
    case 'flare': buzz([30, 40, 60]); break;
    case 'done': buzz([20, 30, 20, 30, 60]); break;
    case 'gild': buzz(8); break;
    default: break;
  }
}

/** How to play, for the hand the player has: a flare by a tap on a phone, Space on a keyboard. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t('howto.tap') },
      { gesture: 'drag', text: touch ? t('howto.drag') : t('howto.drag.mouse') },
      touch ? { gesture: 'tap', text: t('howto.flare') } : { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<RozProgress> = {
  freshProgress,
  create: env => new RozGame(env),
  best: p => bestOf(migrate(p)),
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;
