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
import { readSec } from './rules';
import { WzlotSim, type SimEvent } from './sim';
import type { Teach } from './meta';

export class WzlotGame implements ArcadeGame {
  readonly sim: WzlotSim;
  private readonly view: WzlotView;
  private readonly sound: WzlotSound;
  private w = 1;
  private h = 1;
  private dpr = 1;
  /** the mouse buttons down (a desktop): the cursor closes its hand while one holds the dive */
  private readonly held = new Set<number>();
  /** a mouse that leaves the canvas takes the world's answer with it */
  private readonly leave = (): void => this.view.hover(null);
  /** play is on (started, not paused): only then does a press outside the canvas hold */
  private live = false;
  /** holds begun outside the canvas (a big screen's side columns): their own ids, let go on any pointerup */
  private readonly outside = new Set<number>();
  /**
   * The hold must never stick or be lost (round 11, "hold anywhere"): no context menu on the canvas (a right-button
   * hold opened one and lost its pointerup — a dive that never ended; Android's long press fires one too); a lost
   * pointer capture and a pointerup anywhere let go; a press on the game's screen outside the canvas (a big screen's
   * side columns with the panel and the how-to) holds too.  The runner already lets go on pointercancel and blur.
   */
  private readonly noMenu = (e: Event): void => e.preventDefault();
  private readonly lost = (e: PointerEvent): void => this.letGo(e.pointerId);
  private readonly upAnywhere = (e: PointerEvent): void => {
    if (this.outside.delete(e.pointerId) || this.held.has(e.pointerId)) this.letGo(e.pointerId);
  };
  private readonly blur = (): void => {
    for (const id of this.outside) this.letGo(id);
    this.outside.clear();
  };
  private readonly downOutside = (e: PointerEvent): void => {
    const el = e.target as Element | null;
    if (!this.live || !el || el === this.env.canvas || e.button > 0) return;
    if (el.closest?.('button, a, input, select, textarea, label, [role="button"], .arcade-dock, .arcade-overlay')) return;
    this.outside.add(e.pointerId);
    this.sim.pointer('down', e.pointerId);
    this.drain();
  };
  private readonly frame: HTMLElement | null;

  constructor(private readonly env: GameEnv<WzlotProgress>) {
    this.sim = new WzlotSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new WzlotView(env.canvas, { reducedMotion: env.reducedMotion });
    this.view.hud.resize(this.view.layout, env.touch);
    this.sound = new WzlotSound(env.audio);
    if (!env.touch) env.canvas.addEventListener('pointerleave', this.leave);
    env.canvas.addEventListener('contextmenu', this.noMenu);
    env.canvas.addEventListener('lostpointercapture', this.lost);
    this.frame = env.canvas.parentElement;
    this.frame?.addEventListener('pointerdown', this.downOutside);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerup', this.upAnywhere, true);
      window.addEventListener('pointercancel', this.upAnywhere, true);
      window.addEventListener('blur', this.blur);
    }
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __wzlot?: unknown }).__wzlot = this.sim;
  }

  /** A pointer is up, whatever said so first (the runner, a lost capture, a pointerup outside the canvas). */
  private letGo(id: number): void {
    this.sim.pointer('up', id);
    if (this.held.delete(id) && !this.env.touch) this.env.canvas.style.cursor = this.held.size ? 'grabbing' : 'pointer';
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
    this.live = true;
    // a hold anywhere is the dive: with a mouse the cursor says the whole sky is the button
    if (!this.env.touch) this.env.canvas.style.cursor = 'pointer';
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * Any finger or mouse button down anywhere is the hold.  A mouse also answers: its cursor closes while it holds,
   * and resting on the sun, the night, a warm column, the grań's flag or a card lights it (move events come without
   * a button too).
   */
  pointer(e: PointerInput): void {
    if (!this.env.touch) {
      if (e.type === 'down') this.held.add(e.id);
      else if (e.type === 'up') this.held.delete(e.id);
      this.view.hover(e.x, e.y, this.held.size > 0);
      this.env.canvas.style.cursor = this.held.size ? 'grabbing' : 'pointer';
    }
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
    this.live = !paused;
    if (!paused) return;
    this.sim.release();
    this.held.clear();
    this.outside.clear();
    this.view.hover(null);
    if (!this.env.touch) this.env.canvas.style.cursor = 'pointer';
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      if (e.type === 'hint') {
        const at = this.view.anchor(e.at, this.sim);
        // long enough to read twice (2.5 s + 70 ms a character, never under 4.5 s)
        const text = hintText(e.key, this.env.touch), sec = readSec(text);
        this.env.hint(text, at, Math.round(sec * 1000));
        // the coach mark's bubble stands over the point (under it near the top), shown now or after the runner's
        // block banner (up to 4 s later): the game's banners keep off it meanwhile
        if (at) this.view.hud.coachAt(at.y < this.view.layout.h * 0.3 ? at.y + 50 : at.y - 50, sec + 4.3);
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

  destroy(): void {
    this.live = false;
    this.sim.release();
    // the canvas, its frame and the window keep no listener or cursor of this game's
    this.env.canvas.removeEventListener('pointerleave', this.leave);
    this.env.canvas.removeEventListener('contextmenu', this.noMenu);
    this.env.canvas.removeEventListener('lostpointercapture', this.lost);
    this.frame?.removeEventListener('pointerdown', this.downOutside);
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this.upAnywhere, true);
      window.removeEventListener('pointercancel', this.upAnywhere, true);
      window.removeEventListener('blur', this.blur);
    }
    this.env.canvas.style.cursor = '';
  }

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

/**
 * How to play: hold and let go anywhere.  A finger: the hold, then the let-go.  A mouse: one row (the runner names a
 * `tap` row "Kliknij" without a touch screen, and a let-go is no click), then Space and ↓ as shortcuts.
 */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('how.goal'),
    hands: touch
      ? [{ gesture: 'hold', text: t('how.hold') }, { gesture: 'tap', text: t('how.release') }]
      : [{ gesture: 'hold', text: t('how.hold.mouse') }, { gesture: 'keys', text: t('how.keys') }],
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
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto: () => howto(),
};
export default mod;
