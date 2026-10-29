/**
 * Źródła (Wellsprings): a rotate-to-connect puzzle on the pilgrims' road of Psalm 84.  Turn carved
 * channel stones until the springs' water reaches every terraced field of a dry valley; steady
 * attention in the Nurt sets how much water the springs pour, and calm in the Sela lets it soak in
 * so the valley turns green.  The hands build, the band fills.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (valley.ts, sim.ts,
 * meta.ts), the pictures (render.ts with board.ts, hud.ts and layout.ts, intro.ts for calibration,
 * preview.ts for the lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's progress
 * card (panel.ts); the data in content.ts, the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { ZrodlaSound } from './audio';
import { unit } from './i18n';
import { cellAt } from './layout';
import { freshProgress, type ZrodlaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ZrodlaView } from './render';
import { ZrodlaSim, type SimEvent } from './sim';

/** Keys whose auto-repeat is ignored: one turn per press. */
const TURN_KEYS: Record<string, 1 | -1> = { ' ': 1, Enter: 1, e: 1, E: 1, q: -1, Q: -1 };
const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

class ZrodlaGame implements ArcadeGame {
  private readonly sim: ZrodlaSim;
  private readonly view: ZrodlaView;
  private readonly sound: ZrodlaSound;
  private readonly held = new Set<string>();

  constructor(private readonly env: GameEnv<ZrodlaProgress>) {
    this.sim = new ZrodlaSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ZrodlaView(env.canvas, { reducedMotion: env.reducedMotion, plannedSec: env.plannedSec });
    this.sound = new ZrodlaSound(env.audio);
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
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /** A tap (any button) on a stone turns it a quarter clockwise; the whole cell is the target. */
  pointer(e: PointerInput): void {
    if (e.type !== 'down' || !this.sim.started) return;
    this.sim.tap(cellAt(this.view.layoutOf(this.sim.run), e.x, e.y));
    this.drain();
  }

  /** Arrows move the cursor (auto-repeat allowed); Space, Enter and E turn its stone clockwise, Q counter-clockwise, once per press. */
  key(key: string, down: boolean): boolean {
    const turn = TURN_KEYS[key], move = ARROWS[key];
    if (turn === undefined && !move) return false;
    if (!down) {
      this.held.delete(key);
      return true;
    }
    if (move) this.sim.moveCursor(move[0], move[1]);
    else if (!this.held.has(key)) {
      this.held.add(key);
      this.sim.turnCursor(turn);
    }
    this.drain();
    return true;
  }

  pause(paused: boolean): void {
    if (paused) this.held.clear();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The pad follows how much water runs; still in a Sela, a blind Nurt and while the signal is out (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** Ended early: the sim settles like its finale would; the view and the sound are about to go, so its events are dropped. */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { /* the runner stops the audio; nothing else holds resources */ }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'turn': buzz(6); break;
    case 'closed': buzz([15, 40, 15, 40, 25]); break;
    case 'nest': buzz([10, 30, 10]); break;
    case 'card': buzz([12, 30, 12]); break;
    default: break;
  }
}

const mod: ArcadeModule<ZrodlaProgress> = {
  freshProgress,
  create: env => new ZrodlaGame(env),
  best: p => (p.sessions > 0 ? p.bestSession : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
