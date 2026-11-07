/**
 * Motylarnia (the butterfly house) — a Slither-like garden after Snake and Slither.io, rooted in
 * 2 Corinthians 5:17.  The caterpillar crawls by itself and turns toward where the player points
 * (←/→ turn it too); holding the finger or Space sprints.  It grows with every leaf and flower, its
 * own tail, a rival's side and a bird's beak are stumbles (never a lost session), and rivals that run
 * into its side curl up into crumbs.  The band is the appetite circle in an Apetyt block (focus
 * widens it and it pulls food in; above the threshold the sprint is free) and the colours of the
 * chrysalises in a Sjesta (calm deepens them; they hatch at its end into the atlas).
 *
 * This module wires the parts to the runner (kit/types.ts): the rules (sim.ts, numbers in rules.ts,
 * data in content.ts, the meta in meta.ts, Hieronim's lines in talk.ts), the picture (render.ts with
 * garden.ts, layout.ts and the butterfly art in butterfly.ts / wing.ts / paint.ts, intro.ts for
 * calibration, preview.ts for the lobby), the sound (audio.ts), the lobby card (panel.ts), the words
 * in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { MothSound } from './audio';
import { speciesById } from './content';
import { t } from './i18n';
import { freshProgress, migrate, type MothProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { MothView } from './render';
import { RULES } from './rules';
import { MothSim, type SimEvent, type Teach } from './sim';

class Motylarnia implements ArcadeGame {
  private readonly sim: MothSim;
  private readonly view: MothView;
  private readonly sound: MothSound;
  /** the finger (or mouse button) down: when, and whether it has turned into a sprint */
  private touch: { id: number; at: number } | null = null;
  private now = 0;

  constructor(private readonly env: GameEnv<MothProgress>) {
    this.sim = new MothSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new MothView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg', hudTop: () => env.hudTop() });
    this.sound = new MothSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __motylarnia?: unknown }).__motylarnia = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void {
    const last = this.env.progress.butterflies[this.env.progress.butterflies.length - 1];
    this.view.intro(dt, p, speciesById(last ? last.sp : 'pawik'));
  }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now += dt;
    // a press held long enough is a sprint (a tap only steers)
    if (this.touch && this.now - this.touch.at >= RULES.holdSec) this.sim.sprint(true);
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /** Steer toward a point on the screen: the direction from the head to it. */
  private aimAt(x: number, y: number): void {
    const h = this.view.headScreen(this.sim), dx = x - h.x, dy = y - h.y;
    if (Math.hypot(dx, dy) < 10) return;
    this.sim.aim(Math.atan2(dy, dx));
  }

  pointer(e: PointerInput): void {
    if (e.type === 'down') {
      this.sim.tapCard();
      this.aimAt(e.x, e.y);
      this.touch = { id: e.id, at: this.now };
      return;
    }
    if (e.type === 'move') {
      // a drag steers; so does a hovering mouse, as in the original
      if (!this.touch || this.touch.id === e.id) this.aimAt(e.x, e.y);
      return;
    }
    if (this.touch && this.touch.id === e.id) {
      this.touch = null;
      this.sim.sprint(false);
    }
  }

  key(key: string, down: boolean): boolean {
    return this.sim.key(key, down);
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
      if (e.type === 'teach') this.teach(e.what, e.x, e.y);
      if (this.env.haptics) haptic(e);
    }
  }

  /** A coach mark at the thing it is about (kept inside the play area). */
  private teach(what: Teach, x: number, y: number): void {
    const L = this.view.L;
    let at: { x: number; y: number };
    if (what === 'rest') at = this.sim.twig.length ? this.view.twigSpot() : this.view.headScreen(this.sim);
    else at = this.view.worldToScreen(x, y);
    // the bubble is centred on its point: keep it whole on the screen and inside the play area
    const side = Math.min(150, L.w / 2 - 10);
    at = { x: Math.max(side, Math.min(L.w - side, at.x)), y: Math.max(L.play.y + 40, Math.min(L.play.y + L.play.h - 10, at.y)) };
    this.env.hint(t(`teach.${what}` as 'teach.steer'), at, 4200);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase === 'finale' || s.phase === 'done' || b.kind === 'warmup') return { want: 'free', blind: false };
    const left = Math.max(0, b.dur - s.blockT);
    const nb = s.plan[s.blockIndex + 1];
    const next = left <= RULES.telegraph ? (nb ? (nb.kind === 'push' ? 'focus' : nb.kind === 'rest' ? 'rest' : 'free') : 'free') : null;
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left, next };
  }

  meter(): number | null { return this.sim.meterValue(); }

  headline(): Headline { return this.sim.headline(); }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'eat': if (e.kind === 'rare') buzz([20, 30, 40]); else if (e.kind === 'flower') buzz(6); break;
    case 'stumble': buzz([30, 40, 30]); break;
    case 'curl': buzz([15, 20, 15]); break;
    case 'goal': buzz([20, 40, 20, 40, 60]); break;
    case 'hatch': buzz([10, 30, 10]); break;
    default: break;
  }
}

function howto(): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      { gesture: 'steer', text: t('how.steer') },
      { gesture: 'hold', text: t('how.sprint') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<MothProgress> = {
  freshProgress,
  create: env => new Motylarnia(env),
  best: p => {
    const q = migrate(p);
    return q.sessions > 0 ? q.bestSession : null;
  },
  unit: () => t('unit'),
  progressPanel: p => progressPanel(migrate(p)),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p),
  howto,
};
export default mod;
