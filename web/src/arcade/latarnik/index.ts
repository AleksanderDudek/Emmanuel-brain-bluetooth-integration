/**
 * Latarnik (DESIGN.md §9): a lighthouse keeper's night on the Baltic.  Tap when the turning beam
 * touches a boat to guide it home; concentration focuses the lens so the beam reaches farther
 * (far boats carry triple cargo), and in the calm between convoys the sea glows and washes up amber.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, meta.ts),
 * the pictures (render.ts for play with hud.ts and layout.ts, intro.ts for calibration, preview.ts
 * for the lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's progress card
 * (panel.ts); the data in content.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { LatarnikSound } from './audio';
import { boatWord } from './content';
import { freshProgress, type LatarnikProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { LatarnikView } from './render';
import { LatarnikSim, type SimEvent } from './sim';

class LatarnikGame implements ArcadeGame {
  private readonly sim: LatarnikSim;
  private readonly view: LatarnikView;
  private readonly sound: LatarnikSound;
  private keyHeld = false;

  constructor(private readonly env: GameEnv<LatarnikProgress>) {
    this.sim = new LatarnikSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg',
      tuning: env.tuning,
    });
    this.view = new LatarnikView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new LatarnikSound(env.audio);
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

  pointer(e: PointerInput): void {
    if (e.type === 'down') this.flash();
  }

  key(key: string, down: boolean): boolean {
    if (key !== ' ' && key !== 'Enter') return false;
    if (down && !this.keyHeld) this.flash();   // a held key flashes once, not on auto-repeat
    this.keyHeld = down;
    return true;
  }

  pause(paused: boolean): void {
    if (paused) this.keyHeld = false;
  }

  private flash(): void {
    this.sim.flash();
    this.drain();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The pad follows what the screen shows: the lamp, or the glow in a Cisza; still where nothing shows (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** Ended early: the sim settles like its dawn would; the view and the sound are about to go, so its events are dropped. */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { /* the runner stops the audio; nothing else holds resources */ }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'flash': buzz(e.full ? [20, 40, 20, 40, 30] : e.boats.length > 1 ? [12, 30, 12] : e.perfect ? 16 : 10); break;
    case 'reef': if (!e.free) buzz(40); break;
    case 'star': buzz([15, 50, 15]); break;
    case 'amber': if (e.isNew) buzz([10, 30, 10]); break;
    default: break;
  }
}

const mod: ArcadeModule<LatarnikProgress> = {
  freshProgress,
  create: env => new LatarnikGame(env),
  best: p => (p.sessions > 0 ? p.bestSession : null),
  unit: boatWord,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
