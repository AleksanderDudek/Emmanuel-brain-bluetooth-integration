/**
 * Motylarnia (the butterfly house) — a Slither-like garden after Snake and Slither.io, rooted in
 * 2 Corinthians 5:17.  The caterpillar crawls by itself and turns toward where the player steers: on a
 * touch screen a floating stick wherever the thumb lands (the drag's direction; pushed past its rim, a
 * sprint; a quick tap turns toward the tapped point), with a mouse the pointer (holding the button
 * sprints); ←/→ turn it and Space sprints too.  It grows with every leaf and flower, its
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
import { coarsePointer } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { MothSound } from './audio';
import { speciesById } from './content';
import { t, type Key } from './i18n';
import { tapTargets } from './layout';
import { freshProgress, migrate, type MothProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { MothView } from './render';
import { RULES } from './rules';
import { MothSim, type SimEvent, type Teach } from './sim';
import { Stick } from './stick';

class Motylarnia implements ArcadeGame {
  private readonly sim: MothSim;
  private readonly view: MothView;
  private readonly sound: MothSound;
  /** the mouse button down (no touch screen): when — held long enough, it sprints */
  private press: { id: number; at: number } | null = null;
  /** the floating stick under the thumb (a touch screen), and whether its push sprints now */
  private readonly stick: Stick;
  private thumbSprint = false;
  private now = 0;

  constructor(private readonly env: GameEnv<MothProgress>) {
    this.sim = new MothSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new MothView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg', touch: env.touch });
    this.stick = new Stick(this.view.L.stick);
    this.sound = new MothSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __motylarnia?: unknown }).__motylarnia = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr, this.env.insets());
    this.stick.size = this.view.L.stick;
  }

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
    // a mouse button held long enough is a sprint (a click only steers); a thumb sprints by pushing the stick
    if (this.press && this.now - this.press.at >= RULES.holdSec) this.sim.sprint(true);
    this.view.stick = this.stick.s;
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
    if (this.env.touch) {
      this.thumb(e);
      return;
    }
    if (e.type === 'down') {
      this.sim.tapCard();
      this.aimAt(e.x, e.y);
      this.press = { id: e.id, at: this.now };
      return;
    }
    if (e.type === 'move') {
      // a drag steers; so does a hovering mouse, as in the original
      if (!this.press || this.press.id === e.id) this.aimAt(e.x, e.y);
      return;
    }
    if (this.press && this.press.id === e.id) {
      this.press = null;
      this.sim.sprint(false);
    }
  }

  /**
   * A finger: the floating stick.  It lands anywhere (the base appears under it), the drag's direction steers,
   * a push past the rim sprints, lifting keeps the heading; a quick tap without a drag turns toward the tapped
   * point.  The finger never has to cover the caterpillar or the garden ahead of it.
   */
  private thumb(e: PointerInput): void {
    if (e.type === 'down') {
      this.sim.tapCard();
      this.stick.down(e.id, e.x, e.y, this.now);
      return;
    }
    if (e.type === 'move') {
      const m = this.stick.move(e.id, e.x, e.y);
      if (!m) return;
      if (m.aim !== null) this.sim.aim(m.aim);
      if (m.sprint !== this.thumbSprint) {
        this.thumbSprint = m.sprint;
        this.sim.sprint(m.sprint);
        if (m.sprint && this.env.haptics) buzz(10);
      }
      return;
    }
    const up = this.stick.up(e.id, this.now);
    if (!up) return;
    if (up.tap) this.aimAt(e.x, e.y);
    if (up.sprintEnds || this.thumbSprint) {
      this.thumbSprint = false;
      this.sim.sprint(false);
    }
  }

  /** The card that waits for a tap (the opening story, a new garden's goals); in play nothing: the garden is the control. */
  targets(): TapTarget[] {
    return tapTargets(this.view.L, this.view.cardBox(this.sim));
  }

  key(key: string, down: boolean): boolean {
    return this.sim.key(key, down);
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.press = null;
      this.stick.clear();
      this.thumbSprint = false;
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
    // (low enough for a two-line bubble above the point under the HUD)
    at = { x: Math.max(side, Math.min(L.w - side, at.x)), y: Math.max(L.play.y + 76 * L.u, Math.min(L.play.y + L.play.h - 10, at.y)) };
    this.env.hint(teachText(what, this.env.touch), at, 4200);
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

  destroy(): void {
    this.sim.release();
    this.stick.clear();
  }
}

/** A coach mark's words for the hand the player has: a finger hears of dragging, a mouse of pointing and the keys. */
export function teachText(what: Teach, touch: boolean): string {
  const keys = !touch && (what === 'steer' || what === 'sprint');
  return t((keys ? `teach.${what}.keys` : `teach.${what}`) as Key);
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

/** How to play, for the hand the player has: a thumb's stick on a touch screen, the pointer and the keys with a mouse. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('how.goal'),
    hands: touch
      ? [{ gesture: 'steer', text: t('how.steer') }, { gesture: 'drag', text: t('how.sprint') }]
      : [{ gesture: 'steer', text: t('how.steer.mouse') }, { gesture: 'hold', text: t('how.sprint.mouse') }, { gesture: 'keys', text: t('how.keys') }],
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
  howto: () => howto(),
};
export default mod;
