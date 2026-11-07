/**
 * Dolina (the valley): a runner with hack-and-slash through the valley of the shadow after Psalm
 * 23:4 — a pilgrim with an oil lamp runs toward the dawn through three eras of the dark (Babel, a
 * burned fortress, a city of screens), each ending at its guardian.  He runs by himself; a tap on the
 * right two thirds slashes, a swipe up jumps, a swipe down slides, a tap on the left third raises the
 * lamp.  The band is the lamp: in a Światło its reach is the level (a dotted ring marks the threshold,
 * the rim turns gold beyond it), the shadows in its light slow down and burn, the sword reaches
 * further, a guardian's moves slow, and a held focus lights the Świt; in the Pastwisko calm refills
 * the oil; the ridge keeps the last 40 s as a row of lanterns.  Ćma the moth talks.  Nothing ends a
 * run early: with no oil the pilgrim falls and rises at a lantern post.  Sparks buy upgrades between
 * runs; the eras reached open as starts.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the numbers
 * in rules.ts, the data in content.ts, the meta in meta.ts and Ćma in companion.ts), the pictures
 * (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn
 * with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput, SignalPhase } from '../kit/types';
import { DolinaSound } from './audio';
import { bestOf, freshProgress, type DolinaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { DolinaView } from './render';
import { DolinaSim, type SimEvent } from './sim';

/** A swipe: this far (CSS px) mostly up or down. */
const SWIPE = 26;

class DolinaGame implements ArcadeGame {
  private readonly sim: DolinaSim;
  private readonly view: DolinaView;
  private readonly sound: DolinaSound;
  /** the pointers down: where they began, whether they already swiped, and on which side */
  private readonly touches = new Map<number, { x: number; y: number; swiped: boolean; zone: 'lamp' | 'slash' }>();

  constructor(private readonly env: GameEnv<DolinaProgress>) {
    this.sim = new DolinaSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new DolinaView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new DolinaSound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.hold = this.view.busy;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * A press on the right two thirds slashes at once (on the press, not the release); a drag of a few
   * pixels up or down jumps or slides; a tap on the left third raises the lamp when it lifts without
   * a swipe (so a swipe that starts there does not waste the lamp).
   */
  pointer(e: PointerInput): void {
    if (e.type === 'down') {
      const zone = this.view.zoneAt(e.x);
      this.touches.set(e.id, { x: e.x, y: e.y, swiped: false, zone });
      if (zone === 'slash') this.sim.slash();
    } else if (e.type === 'move') {
      const p = this.touches.get(e.id);
      if (!p || p.swiped) return;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (Math.abs(dy) >= SWIPE && Math.abs(dy) > Math.abs(dx) * 0.8) {
        p.swiped = true;
        if (dy < 0) this.sim.jump();
        else this.sim.slide();
      }
    } else {
      const p = this.touches.get(e.id);
      this.touches.delete(e.id);
      if (p && !p.swiped && p.zone === 'lamp') {
        const dy = e.y - p.y;
        if (Math.abs(dy) >= SWIPE) {
          if (dy < 0) this.sim.jump();
          else this.sim.slide();
        } else this.sim.burst();
      }
    }
    this.drain();
  }

  /** Space, Enter, →, D slash; ↑, W jump; ↓, S slide; ←, A, E raise the lamp. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.touches.clear();
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, for the runner's signal dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') return { want: 'free', blind: false };
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'kill': if (e.via === 'slash') buzz(12); break;
    case 'clink': buzz([6, 20, 6]); break;
    case 'harm': buzz([20, 40, 20]); break;
    case 'guardHit': buzz(16); break;
    case 'dawn': buzz([20, 30, 20, 30, 40]); break;
    case 'guard': if (e.what === 'beaten') buzz([30, 40, 30, 40, 60]); break;
    case 'fall': buzz([10, 60, 10]); break;
    case 'parry': buzz([8, 16, 8]); break;
    default: break;
  }
}

const mod: ArcadeModule<DolinaProgress> = {
  freshProgress,
  create: env => new DolinaGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
