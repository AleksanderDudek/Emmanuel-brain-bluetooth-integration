/**
 * Posłaniec (DESIGN.md §7.3): an early-church messenger carries the apostle's letters along the
 * Roman road to the seven churches of Asia, after Isaiah 52:7 — Subway Surfers' three-lane run, seen
 * from behind in pseudo-3D.  Swipe or arrows: ←/→ a lane, ↑ jump, ↓ slide; a tap on the left or
 * right third steps a lane, a tap in the middle (and Space) jumps.  Focus climbs a ladder of light up
 * to the heights, a road above the road; calm kindles the watchtowers' fires; the band's signal runs
 * across the sky as a ribbon of dawn.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the road in
 * track.ts, the numbers in rules.ts, the meta game in meta.ts, the hands in input.ts), the pictures
 * (render.ts with hud.ts, ribbon.ts and layout.ts, intro.ts for calibration, preview.ts for the
 * lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's progress card (panel.ts); the
 * data in content.ts, the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { PoslaniecSound } from './audio';
import { Gestures, keyMove } from './input';
import { bestOf, freshProgress, type PoslaniecProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { PoslaniecView } from './render';
import { PoslaniecSim, type SimEvent } from './sim';

class PoslaniecGame implements ArcadeGame {
  private readonly sim: PoslaniecSim;
  private readonly view: PoslaniecView;
  private readonly sound: PoslaniecSound;
  private readonly hands = new Gestures();

  constructor(private readonly env: GameEnv<PoslaniecProgress>) {
    this.sim = new PoslaniecSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new PoslaniecView(env.canvas, { reducedMotion: env.reducedMotion, tool: env.tool });
    this.sound = new PoslaniecSound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr);
    this.hands.resize(w);
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start(this.env.progress);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  /** The runner draws during calibration too: the intro is the picture until play starts. */
  draw(): void { if (this.sim.started) this.view.draw(this.sim); }

  /** Swipes act as soon as they are long enough; a short tap acts by the third it lands in. */
  pointer(e: PointerInput): void {
    const m = this.hands.pointer(e.type, e.id, e.x, e.y, this.sim.t);
    if (m) {
      this.sim.act(m);
      this.drain();
    }
  }

  /** ←/→/A/D lanes, ↑/W/Space jump, ↓/S slide. */
  key(key: string, down: boolean): boolean {
    const m = keyMove(key);
    if (!m) return false;
    if (down) {
      this.sim.act(m);
      this.drain();
    }
    return true;
  }

  pause(paused: boolean): void {
    if (paused) this.hands.clear();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The pad follows the glow in a sighted push and holds still elsewhere (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.hands.clear(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'stumble': buzz(25); break;
    case 'land': if (e.hard) buzz(10); break;
    case 'heights': buzz([12, 30, 12, 30, 18]); break;
    case 'rung': buzz(6); break;
    case 'city': buzz([20, 40, 20, 40, 30]); break;
    case 'cloak': case 'mission': buzz([12, 30, 12]); break;
    case 'tower': if (e.lit) buzz(8); break;
    default: break;
  }
}

const mod: ArcadeModule<PoslaniecProgress> = {
  freshProgress,
  create: env => new PoslaniecGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
