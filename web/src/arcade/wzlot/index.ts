/**
 * Wzlot (DESIGN.md §9): an eaglet learns to fly over the biblical wilderness, after Deuteronomy
 * 32:11.  Hold to fold the wings and dive down a slope, let go to glide off the crest (Tiny Wings'
 * verb); land along the slope and the landings chain into soaring.  In a Lekcja lotu the parent
 * flies ahead and attention opens the eaglet's wings; in Wznoszenie calm strengthens the warm air
 * rising from the valleys; when the eaglet stalls or drops into a wadi, the parent catches it.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the
 * flight in flight.ts, the ground in terrain.ts, the numbers in rules.ts and the meta game in
 * meta.ts), the pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration,
 * preview.ts for the lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's progress
 * card (panel.ts); the data in content.ts, the words in i18n.ts.  Any pointer anywhere and Space
 * (or ↓, Enter) held are the hold; two quick taps or ↑ / W are the third plumage's wingbeat.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { WzlotSound } from './audio';
import { freshProgress, type WzlotProgress } from './meta';
import { bestOf, progressPanel } from './panel';
import { drawPreview } from './preview';
import { WzlotView } from './render';
import { WzlotSim, type SimEvent } from './sim';

class WzlotGame implements ArcadeGame {
  private readonly sim: WzlotSim;
  private readonly view: WzlotView;
  private readonly sound: WzlotSound;

  constructor(private readonly env: GameEnv<WzlotProgress>) {
    this.sim = new WzlotSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new WzlotView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new WzlotSound(env.audio);
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

  /** Any finger or mouse button down anywhere folds the wings; up opens them. */
  pointer(e: PointerInput): void {
    if (e.type === 'move') return;
    this.sim.pointer(e.type, e.id);
    this.drain();
  }

  /** Space, ↓ or Enter held fold the wings; ↑ or W is the wingbeat (third plumage stage). */
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

  /** The pad follows the wings in a sighted Lekcja and holds still elsewhere (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** Ended early: the sim settles at once; the view and the sound are about to go, so its events are dropped. */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'land': if (e.cls === 'smooth') buzz(e.chain >= 3 ? [8, 24, 8] : 8); break;
    case 'soar': buzz([10, 30, 10, 30, 14]); break;
    case 'catch': buzz(15); break;
    case 'feather': buzz([12, 30, 12]); break;
    case 'vista': if (e.isNew) buzz([20, 40, 20]); break;
    case 'wingbeat': buzz(10); break;
    default: break;
  }
}

const mod: ArcadeModule<WzlotProgress> = {
  freshProgress,
  create: env => new WzlotGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
