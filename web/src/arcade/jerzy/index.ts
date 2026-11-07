/**
 * Jerzy i smok (George and the dragon): a top-down roguelite boss fight after the legend of Saint
 * George and Ephesians 6:16 — a town held by a dragon, a princess who refuses to be helpless, a
 * knight with a shield.  A tap sets where Jerzy walks (on the dragon: he goes after it), a drag
 * steers, a swipe or Space rolls; he strikes by himself when the dragon is in reach, and every
 * strike knocks off a scale.  The band is the shield: in a Tarcza its radius is the level (a dotted
 * ring marks the threshold, the rim turns gold beyond it), fire that meets it goes out and charges
 * the Miecz światła, and a held focus charges it too; in a Postój the dragon naps, calm heals the
 * knight and fills Linda's tip; the fence's pennants keep the last 40 s.  Nothing ends the fight
 * early: a fall is an apple and half a heart, a dragon not beaten keeps its damage for next time.
 * Level-ups offer one of three skills while the fight slows down; the armoury keeps a few for good.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers
 * in rules.ts, the data in content.ts, the meta in meta.ts and Linda's bubble in talk.ts), the
 * pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby,
 * all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput, SignalPhase } from '../kit/types';
import { JerzySound } from './audio';
import { unit } from './i18n';
import { bestOf, freshProgress, type JerzyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { JerzyView } from './render';
import { RULES } from './rules';
import { JerzySim, type SimEvent } from './sim';

class JerzyGame implements ArcadeGame {
  private readonly sim: JerzySim;
  private readonly view: JerzyView;
  private readonly sound: JerzySound;
  /** the finger on the arena: where it went down, when, and whether it already rolled */
  private touch: { id: number; x: number; y: number; at: number; swiped: boolean } | null = null;
  private now = 0;

  constructor(private readonly env: GameEnv<JerzyProgress>) {
    this.sim = new JerzySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new JerzyView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new JerzySound(env.audio);
    // ?debug: the fight in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __jerzy?: unknown }).__jerzy = this.sim;
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
    this.now += dt;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /** A tap walks him there at once (on the press); a quick swipe rolls; a held drag steers; on a skill card it picks it. */
  pointer(e: PointerInput): void {
    if (e.type === 'down') {
      if (this.sim.choice) {
        const i = this.view.hud.skillAt(e.x, e.y);
        if (i >= 0) {
          this.sim.pick(i);
          this.drain();
        }
        return;
      }
      const w = this.view.toWorld(e.x, e.y);
      this.sim.tap(w.x, w.y);
      this.touch = { id: e.id, x: e.x, y: e.y, at: this.now, swiped: false };
      this.drain();
      return;
    }
    const tc = this.touch;
    if (!tc || tc.id !== e.id) return;
    if (e.type === 'up') {
      this.touch = null;
      return;
    }
    const dx = e.x - tc.x, dy = e.y - tc.y, d = Math.hypot(dx, dy);
    if (!tc.swiped && d >= RULES.swipePx && this.now - tc.at <= RULES.swipeSec) {
      tc.swiped = true;
      this.sim.roll(dx, dy);
      this.drain();
    } else if (!tc.swiped && this.now - tc.at > RULES.swipeSec) {
      const w = this.view.toWorld(e.x, e.y);
      this.sim.steer(w.x, w.y);
    }
  }

  /** Arrows and WASD walk, Space and Shift roll, Enter goes after the dragon, 1–3 pick a skill. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.touch = null;
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
    case 'strike': buzz(e.sword ? [30, 40, 60] : 8); break;
    case 'burn': buzz(e.what === 'blob' ? 6 : [20, 30, 20]); break;
    case 'phase': buzz([30, 40, 30]); break;
    case 'driven': buzz([30, 40, 30, 40, 80]); break;
    case 'down': buzz([10, 60, 10]); break;
    case 'level': buzz([12, 30, 12]); break;
    default: break;
  }
}

const mod: ArcadeModule<JerzyProgress> = {
  freshProgress,
  create: env => new JerzyGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
