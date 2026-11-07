/**
 * Chleby i ryby (five loaves and two fish): a crowd cannon after John 6:9 — the boy whose basket it
 * was helps the disciples hand out the bread to the people sitting in groups on the green hillside.
 * Drag to aim the basket, hold to pour (a tap throws a handful, Space too): the loaves and fish roll
 * up the hill through gates that slide across the path — green adds, honey multiplies, grey takes
 * away — and feed the groups of fifty and a hundred at the top; gulls swoop in from the lake and
 * steal (Mirka, their leader and the game's talking companion, takes five), and each chapter's last
 * hillside has a pelican to feed.  The band is the golden gate: in a Rozdawanie its multiplier is
 * the level (×1 below the threshold, ×2 at it, up to ×5), drawn as the gauge on its arch, and a
 * held focus fills the Big Basket; on the grass calm gathers the crumbs into baskets.  Levels of
 * three stars, grain for upgrades, story cards between chapters; time running out is never a loss
 * (the disciples feed the rest).
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the hill
 * in hill.ts, the numbers in rules.ts and the meta in meta.ts), the pictures (render.ts with hud.ts
 * and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn with paint.ts), the
 * sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts and content.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput, SignalPhase } from '../kit/types';
import { ChlebySound } from './audio';
import { unit } from './i18n';
import { bestOf, freshProgress, type ChlebyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ChlebyView } from './render';
import { ChlebySim, type SimEvent } from './sim';

class ChlebyGame implements ArcadeGame {
  private readonly sim: ChlebySim;
  private readonly view: ChlebyView;
  private readonly sound: ChlebySound;

  constructor(private readonly env: GameEnv<ChlebyProgress>) {
    this.sim = new ChlebySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ChlebyView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new ChlebySound(env.audio);
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
    this.sim.cardOn = this.view.hud.storyOn;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /** A press aims and throws, a hold pours, a drag aims; on the card between levels a tap buys or goes on. */
  pointer(e: PointerInput): void {
    const hit = this.view.pointer(e.type, e.x, e.y, e.id, this.sim);
    if (!hit) return;
    switch (hit.kind) {
      case 'press': this.sim.press(hit.x); break;
      case 'drag': this.sim.drag(hit.x); break;
      case 'release': this.sim.release(); break;
      case 'offer': this.sim.buy(hit.i); break;
      case 'go': this.sim.skip(); break;
    }
    this.drain();
  }

  /** ←/→ (A/D) move the basket, Space throws, Enter goes on, 1–3 buy on the card between levels. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.view.release();
      this.sim.release();
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

  destroy(): void { this.view.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'fire': if (e.kind === 'big') buzz([20, 30, 20]); break;
    case 'split': buzz(25); break;
    case 'fed': buzz(12); break;
    case 'knock': buzz(15); break;
    case 'bigReady': buzz([10, 30, 10]); break;
    case 'won': buzz([15, 30, 15, 30, 40]); break;
    case 'break': buzz(10); break;
    default: break;
  }
}

const mod: ArcadeModule<ChlebyProgress> = {
  freshProgress,
  create: env => new ChlebyGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
