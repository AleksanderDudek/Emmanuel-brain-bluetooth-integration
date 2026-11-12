/**
 * Wzlot (DESIGN.md §6, rebuilt in v2 after Tiny Wings): an eaglet learns to fly over the wilderness
 * granie, after Deuteronomy 32:11.  Hold anywhere and it gets heavy and dives down the slope, let go
 * and it is light and launches off the crest; a dive down and a release up is a perfect slide, three
 * in a row light the Poryw.  The sun sinks along its arc and the night chases the eaglet; every grań
 * reached pushes the dusk back.  When the night catches it, the mother carries it to the nest: the
 * day's tally, and a new day over the same granie.  The band is the sun: in a push block focus holds
 * it up (the night comes slower) and a held focus lights the Poryw; in a rest block calm warms the
 * thermals that lift the eaglet.  Leon the lark comments on everything.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the flight
 * in flight.ts, the ground in terrain.ts, the numbers in rules.ts, the meta in meta.ts and Leon in
 * talk.ts), the pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts
 * for the lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the
 * data in content.ts, the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer, target } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { WzlotSound } from './audio';
import { t, unit, type Key } from './i18n';
import { bestOf, freshProgress, type WzlotProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { WzlotView } from './render';
import { WzlotSim, type SimEvent } from './sim';
import type { Teach } from './meta';

export class WzlotGame implements ArcadeGame {
  readonly sim: WzlotSim;
  private readonly view: WzlotView;
  private readonly sound: WzlotSound;
  private w = 1;
  private h = 1;
  private dpr = 1;

  constructor(private readonly env: GameEnv<WzlotProgress>) {
    this.sim = new WzlotSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new WzlotView(env.canvas, { reducedMotion: env.reducedMotion });
    this.view.hud.resize(this.view.layout, env.touch);
    this.sound = new WzlotSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __wzlot?: unknown }).__wzlot = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets(), this.env.touch);
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    // the HUD is laid out by now: read its band again
    this.view.resize(this.w, this.h, this.dpr, this.env.insets(), this.env.touch);
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

  /** Any finger or mouse button down anywhere is the hold. */
  pointer(e: PointerInput): void {
    if (e.type === 'move') return;
    this.sim.pointer(e.type, e.id);
    this.drain();
  }

  /** Space, ↓, Enter or S held: the hold. */
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
      if (e.type === 'hint') {
        const at = this.view.anchor(e.at, this.sim);
        this.env.hint(hintText(e.key, this.env.touch), at, 4200);
        // the coach mark's bubble stands over the point (under it near the top), shown now or after the runner's
        // block banner (up to 4 s later): the game's banners keep off it meanwhile
        if (at) this.view.hud.coachAt(at.y < this.view.layout.h * 0.3 ? at.y + 50 : at.y - 50, 8.5);
        continue;
      }
      if (e.type === 'perfect') this.sim.hitStop(0.05);
      else if (e.type === 'fever') this.sim.hitStop(0.09);
      else if (e.type === 'leap') this.sim.hitStop(0.06);
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }
  canStop(): boolean { return this.sim.canStop(); }
  signal(): SignalPhase { return this.sim.signal(); }
  meter(): number | null { return this.sim.meter(); }
  headline(): Headline { return this.sim.headline(); }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }

  /**
   * The free play area — a hold anywhere — is no target.  While a card or the dawn prompt shows, it is the one
   * thing to tap (a tap anywhere does it): the story card, the dawn's "tap for sunrise", the day's tally.
   */
  targets(): TapTarget[] {
    const b = this.view.hud.box;
    return b ? [target(b.kind, b.r)] : [];
  }
}

/** A coach mark's words for the hand the player has: a finger holds; a keyboard hears of Space as a shortcut. */
export function hintText(key: Teach, touch: boolean): string {
  return key === 'hold' && !touch ? t('hint.hold.keys') : t(`hint.${key}` as Key);
}

/** How to play: hold and let go anywhere; on a keyboard Space and ↓ as shortcuts (the runner drops the keys' row for a finger). */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      { gesture: 'hold', text: t('how.hold') },
      { gesture: 'tap', text: t('how.release') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('how.keys') }]),
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'perfect': buzz(e.chain >= 3 ? [8, 24, 8] : 8); break;
    case 'fever': buzz([10, 30, 10, 30, 14]); break;
    case 'bump': buzz(20); break;
    case 'catch': buzz(15); break;
    case 'gran': buzz([12, 30, 12]); break;
    case 'nest': buzz([20, 40, 20]); break;
    default: break;
  }
}

const mod: ArcadeModule<WzlotProgress> = {
  freshProgress,
  create: env => new WzlotGame(env),
  best: p => bestOf(p),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto: () => howto(),
};
export default mod;
