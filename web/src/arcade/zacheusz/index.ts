/**
 * Zacheusz (DESIGN.md §7.4): the short tax collector runs through Jericho to see, after Luke
 * 19:3-4 — Super Mario Run's verb.  He runs by himself; a tap jumps, a longer press jumps higher,
 * a tap against a wall kicks off it; baskets, hens and sleeping dogs are hopped on their own.  In
 * Wypatrywanie the band unfolds the high way over the roofs (each piece decided 1.5 s ahead of
 * him), a held view brings the procession's dust nearer and a Widok of denarii; in Cień sykomory
 * calm ripens the figs; in Tłum the crowd hides the palms until it parts.  A fall is caught by a
 * neighbour's rope; each course ends at a sycamore-fig, the higher the better; the denarii restore
 * Jericho's households (Luke 19:8).
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the run
 * in hero.ts on the street of world.ts, the numbers in rules.ts, the meta in meta.ts), the
 * pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the
 * lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the data
 * in content.ts, the words in i18n.ts.  Any pointer anywhere, Space, ↑, W or Enter jump.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { ZacheuszSound } from './audio';
import { unit } from './i18n';
import { bestOf, freshProgress, type ZacheuszProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ZacheuszView } from './render';
import { ZacheuszSim, type SimEvent } from './sim';

class ZacheuszGame implements ArcadeGame {
  private readonly sim: ZacheuszSim;
  private readonly view: ZacheuszView;
  private readonly sound: ZacheuszSound;

  constructor(private readonly env: GameEnv<ZacheuszProgress>) {
    this.sim = new ZacheuszSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ZacheuszView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new ZacheuszSound(env.audio);
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
    if (e.type === 'move') return;
    this.sim.pointer(e.type, e.id);
    this.drain();
  }

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

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'special': buzz([10, 30, 10]); break;
    case 'bounce': buzz(8); break;
    case 'wallJump': buzz(10); break;
    case 'finish': buzz([12, 30, 12, 30, 18]); break;
    case 'home': buzz([20, 40, 20]); break;
    case 'view': buzz([10, 25, 10]); break;
    case 'rope': buzz(15); break;
    default: break;
  }
}

const mod: ArcadeModule<ZacheuszProgress> = {
  freshProgress,
  create: env => new ZacheuszGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
