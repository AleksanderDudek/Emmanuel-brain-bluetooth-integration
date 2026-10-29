/**
 * Urodzaj (DESIGN.md §9): a physics merge on a hillside orchard laid as an early-church floor
 * mosaic.  Aim the fruit hanging from the olive twig and let it go; two alike fruit that touch join
 * into the next of nine, olive to the great cluster.  In Zbiór steady focus sends the vine to draw
 * alike fruit together; in Rosa the basket rests under linen while calm gathers the dew that settles
 * it.  What spills goes to the gleaners and every point stays; the evening ends at the village table.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, physics.ts,
 * meta.ts), the pictures (render.ts with hud.ts, table.ts and layout.ts, intro.ts for calibration,
 * preview.ts for the lobby, all in mosaic.ts's stones), the sound (audio.ts) and the lobby's
 * progress card (panel.ts); the data in content.ts, the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { UrodzajSound } from './audio';
import { unit } from './i18n';
import { freshProgress, type UrodzajProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { UrodzajView } from './render';
import { UrodzajSim, type SimEvent } from './sim';

const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);
const DROP = new Set([' ', 'Enter', 'ArrowDown', 's', 'S']);

class UrodzajGame implements ArcadeGame {
  private readonly sim: UrodzajSim;
  private readonly view: UrodzajView;
  private readonly sound: UrodzajSound;
  /** the pointer that aims (the first one down; a second finger is ignored until it lifts) */
  private pointerId: number | null = null;
  private left = false;
  private right = false;
  private dropHeld = false;

  constructor(private readonly env: GameEnv<UrodzajProgress>) {
    this.sim = new UrodzajSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new UrodzajView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new UrodzajSound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * Touch or mouse: a press eases the aim to the finger, a drag (or a hovering mouse) moves it, the
   * release lets the fruit go.  Only the first finger down aims.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, x = this.view.worldX(e.x);
    if (e.type === 'down') {
      if (this.pointerId !== null && this.pointerId !== e.id) return;
      this.pointerId = e.id;
      sim.pointerDown(x);
      return;
    }
    if (e.type === 'move') {
      if (this.pointerId === null || this.pointerId === e.id) sim.pointerMove(x);
      return;
    }
    if (this.pointerId !== e.id) return;
    this.pointerId = null;
    sim.pointerUp(x);
  }

  /** ← → or A D aim (held: faster), Space, Enter or ↓ drops. */
  key(key: string, down: boolean): boolean {
    if (LEFT.has(key) || RIGHT.has(key)) {
      if (LEFT.has(key)) this.left = down;
      else this.right = down;
      this.sim.keyAim((this.right ? 1 : 0) - (this.left ? 1 : 0));
      return true;
    }
    if (DROP.has(key)) {
      if (down && !this.dropHeld) this.sim.keyDrop();
      this.dropHeld = down;
      return true;
    }
    return false;
  }

  /** The runner releases held inputs before it pauses: the synthetic "up" must not drop a fruit. */
  pause(paused: boolean): void {
    if (!paused) return;
    this.pointerId = null;
    this.left = this.right = this.dropHeld = false;
    this.sim.disarm();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The pad follows the vine in a sighted Zbiór and holds still in Rosa, blind blocks and the evening (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** Ended early: the sim settles at once; the view and the sound are about to go, so its events are dropped. */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { /* the runner stops the audio; the canvases go with the view */ }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'merge': buzz(e.link >= 2 ? [10, 25, 10] : e.tier >= 6 ? 16 : 8); break;
    case 'great': buzz([20, 40, 20, 40, 30]); break;
    case 'spill': buzz([12, 30, 12]); break;
    case 'stamp': if (e.kind !== 'almost') buzz([10, 30, 10]); break;
    case 'guest': if (e.isNew) buzz(15); break;
    default: break;
  }
}

const mod: ArcadeModule<UrodzajProgress> = {
  freshProgress,
  create: env => new UrodzajGame(env),
  best: p => (p.sessions > 0 ? p.bestSession : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
