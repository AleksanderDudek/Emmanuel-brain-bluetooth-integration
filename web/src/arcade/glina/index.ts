/**
 * Glina (DESIGN.md §9): a potter's courtyard in a Judean hill town, after Jeremiah 18:1-6.  A
 * neighbour waits at the gate with an order; you pull the clay up on the kick wheel and shape it to
 * the dotted outline; an even, steady attention lifts the chalk line the walls may rise to and
 * trues the clay, and a quiet rest by the kiln melts the ash into glaze.  The vessel goes to its
 * neighbour, and the street fills with your work in use.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the clay
 * model in clay.ts and the meta game in meta.ts), the pictures (render.ts for play with hud.ts,
 * scene.ts, vessel.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn
 * with paint.ts), the sound (audio.ts) and the lobby's progress card (panel.ts); the data in
 * content.ts.  Here a pointer becomes a gesture: a tap (under 8 px and 0.3 s) is a small pull — or
 * picks a glaze bucket at the cut — and a drag pulls up and shapes sideways at the finger's height.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { GlinaSound } from './audio';
import { t } from './i18n';
import { hit, inPlay, vesselU } from './layout';
import { freshProgress, type GlinaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { GlinaView } from './render';
import { GlinaSim, type SimEvent } from './sim';

/** A finger on the glass: where it went down and when, where it is, and whether it became a drag. */
interface Touch { id: number; x0: number; y0: number; x: number; y: number; t0: number; drag: boolean }

const TAP_PX = 8;
const TAP_SEC = 0.3;

class GlinaGame implements ArcadeGame {
  private readonly sim: GlinaSim;
  private readonly view: GlinaView;
  private readonly sound: GlinaSound;
  private touchNow: Touch | null = null;
  private readonly held = new Set<string>();
  private clock = 0;

  constructor(private readonly env: GameEnv<GlinaProgress>) {
    this.sim = new GlinaSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg',
      tuning: env.tuning,
    });
    this.view = new GlinaView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new GlinaSound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void { this.view.intro_(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.clock += dt;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  // ── touch ───────────────────────────────────────────────────────
  pointer(e: PointerInput): void {
    const sim = this.sim, { L, scale } = this.view.stage(sim);
    const H = sim.clay?.H ?? 1;
    if (e.type === 'down') {
      if (this.touchNow || !inPlay(L, e.x, e.y)) return;
      this.touchNow = { id: e.id, x0: e.x, y0: e.y, x: e.x, y: e.y, t0: performance.now() / 1000, drag: false };
      sim.touch(vesselU(L, scale, H, e.y), e.x >= L.axis ? 1 : -1);
      return;
    }
    const tc = this.touchNow;
    if (!tc || e.id !== tc.id) return;
    if (e.type === 'move') {
      let dx = e.x - tc.x, dy = e.y - tc.y;
      if (!tc.drag && (Math.hypot(e.x - tc.x0, e.y - tc.y0) >= TAP_PX || performance.now() / 1000 - tc.t0 >= TAP_SEC)) {
        tc.drag = true;
        dx = e.x - tc.x0;   // the slop before the drag counts too
        dy = e.y - tc.y0;
      }
      if (tc.drag && (dx || dy)) {
        const side = e.x >= L.axis ? 1 : -1;
        sim.drag(dx * side, -dy, e.y, vesselU(L, scale, H, e.y), scale);
        this.drain();
      }
      tc.x = e.x;
      tc.y = e.y;
      return;
    }
    // up: a short, still touch is a tap
    if (!tc.drag && Math.hypot(e.x - tc.x0, e.y - tc.y0) < TAP_PX && performance.now() / 1000 - tc.t0 < TAP_SEC) this.tap(e.x, e.y);
    sim.release();
    this.touchNow = null;
    this.drain();
  }

  private tap(x: number, y: number): void {
    const sim = this.sim;
    if (sim.phase === 'cut') {
      const bs = this.view.buckets(sim.buckets.length);
      for (let i = 0; i < bs.length; i++) if (hit(bs[i], x, y)) sim.pickGlaze(i);
      return;
    }
    sim.tap();
  }

  // ── keys ────────────────────────────────────────────────────────
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const handled = k === ' ' || k === 'ArrowUp' || k === 'Enter' || k === 'ArrowLeft' || k === 'ArrowRight' || k === 'w' || k === 's'
      || k === '1' || k === '2' || k === '3';
    if (!handled) return false;
    // a held key acts once per press, then continuously: the browser's auto-repeat is ignored
    if (down && this.held.has(k)) return true;
    if (down) this.held.add(k); else this.held.delete(k);
    const sim = this.sim;
    switch (k) {
      case ' ': case 'ArrowUp': case 'Enter':
        sim.pressKey(down);
        break;
      case 'ArrowLeft': case 'ArrowRight':
        sim.shapeKey(this.held.has('ArrowRight') ? 1 : this.held.has('ArrowLeft') ? -1 : 0);
        break;
      case 'w': case 's':
        sim.handKey(this.held.has('w') ? 1 : this.held.has('s') ? -1 : 0);
        break;
      default:
        if (down) sim.pickGlaze(Number(k) - 1);
    }
    this.drain();
    return true;
  }

  pause(paused: boolean): void {
    if (!paused) return;
    this.held.clear();
    this.touchNow = null;
    this.sim.releaseAll();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e, this.sim);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The pad follows the chalk line in a visible throw; still everywhere else (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** Ended early: the sim settles the vessel on the wheel and the day; the view and the sound are about to go. */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { /* the runner stops the audio; nothing else holds resources */ }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'contact': buzz(8); break;
    case 'slump': buzz([20, 40, 30]); break;
    case 'centre': buzz([10, 30, 10]); break;
    case 'cut': buzz(12); break;
    case 'open': if (e.card.gift || e.card.isNew) buzz([12, 40, 12]); break;
    default: break;
  }
}

const mod: ArcadeModule<GlinaProgress> = {
  freshProgress,
  create: env => new GlinaGame(env),
  best: p => (p.sessions > 0 ? p.bestSession : null),
  unit: () => t('unit'),
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
