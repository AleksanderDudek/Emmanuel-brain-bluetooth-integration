/**
 * Pasterz (the shepherd): a crowd game on the Judean hills after Luke 15:4-6 — Crowd City's and Mob
 * Control's feel.  Walk the shepherd with a finger (a tap sets a goal, a drag steers, the arrows
 * walk, Space calls); every grazing sheep inside the call ring joins the flock, which trails him
 * in a soft crowd to the fold at the pasture's end, where it files through the gate and the count
 * runs up.  The ring is the band's live gauge: in a Wołanie its radius is the level (a dotted
 * circle marks the threshold, gold beyond it) and a held focus sends the voice across the hill; in
 * the Nocna straż calm lights the stars; the footprints and the tally strip keep the last 40 s.
 * The shepherd is the parable's man, not a picture of Christ.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the hill
 * in hill.ts, the bodies in flock.ts, the numbers in rules.ts and the meta in meta.ts), the
 * pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the
 * lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the data
 * in content.ts, the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput, SignalPhase } from '../kit/types';
import { PasterzSound } from './audio';
import { unit } from './i18n';
import { bestOf, freshProgress, type PasterzProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { PasterzView } from './render';
import { PasterzSim, type SimEvent } from './sim';

class PasterzGame implements ArcadeGame {
  private readonly sim: PasterzSim;
  private readonly view: PasterzView;
  private readonly sound: PasterzSound;

  constructor(private readonly env: GameEnv<PasterzProgress>) {
    this.sim = new PasterzSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new PasterzView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new PasterzSound(env.audio);
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

  /** A tap sets the shepherd's goal, a drag steers him (screen points become points of the hill). */
  pointer(e: PointerInput): void {
    const w = this.view.toWorld(e.x, e.y);
    this.sim.pointer(e.type, w.x, w.y, e.id);
    if (e.type === 'down' && this.sim.handsFree) this.view.tapAt(w.x, w.y);
  }

  /** The arrows and WASD walk, Space and Enter call. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.sim.release();
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
    return { want: b.kind === 'call' ? 'focus' : 'rest', blind: this.sim.blind };
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
    case 'join': buzz(6); break;
    case 'voice': buzz([12, 30, 12, 30, 18]); break;
    case 'lambFound': buzz([20, 40, 20]); break;
    case 'step': buzz(14); break;
    case 'pastureDone': buzz([10, 30, 10, 30, 24]); break;
    case 'snag': buzz(8); break;
    default: break;
  }
}

const mod: ArcadeModule<PasterzProgress> = {
  freshProgress,
  create: env => new PasterzGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
