/**
 * Zacheusz (DESIGN.md §7.4): the short tax collector runs through Jericho to see, after Luke
 * 19:3-4 — Super Mario Run's World Tour.  He runs by himself; a tap jumps, a longer press jumps
 * higher, a tap in the air spins, a tap against a wall kicks off it; geese and goats are vaulted on
 * their own and bonked from above; pause stones stop him to plan, arrow stones turn him back or
 * dash; five special denarii hide in every hand-made level (silver, then gold, then purple sets);
 * the finish palm pays by the height he grabs it; a fall is a bubble that rewinds.  The band is the
 * path: in a push block focus raises a road of light over the roofs (its reach is the level, a flag
 * marks the threshold on the lane), in a rest block calm ripens the figs of an orchard; the skyline
 * of palms keeps the last 40 s.  Mela the goat talks.  The denarii restore Jericho's households.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the run
 * in hero.ts on the street of world.ts, the numbers in rules.ts, the levels in content.ts, the meta
 * in meta.ts, Mela in companion.ts), the pictures (render.ts with hud.ts and layout.ts, intro.ts for
 * calibration, preview.ts for the lobby, all drawn with paint.ts), the sound (audio.ts) and the
 * lobby's card with the level map (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { ZacheuszSound } from './audio';
import { t, unit, type Key } from './i18n';
import { bestOf, freshProgress, migrate, type ZacheuszProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ZacheuszView } from './render';
import { ZacheuszSim, type SimEvent, type Teach } from './sim';

/** The coach marks that name the keys on a desktop (a finger's words on a phone). */
const KEYED: ReadonlySet<Teach> = new Set<Teach>(['tap', 'hold', 'button']);

class ZacheuszGame implements ArcadeGame {
  private readonly sim: ZacheuszSim;
  private readonly view: ZacheuszView;
  private readonly sound: ZacheuszSound;
  private readonly downs = new Set<number>();
  private w = 1280;
  private h = 800;
  private dpr = 1;

  constructor(private readonly env: GameEnv<ZacheuszProgress>) {
    this.sim = new ZacheuszSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ZacheuszView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new ZacheuszSound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    // the HUD has its final size now: lay out again with its insets (the runner's resolution kept)
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.sound.start();
    this.view.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t0: number): void {
    this.sim.update(dt, f, t0);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  /** Before play the intro scene is on the canvas (the runner calls draw() every frame). */
  draw(): void { if (this.sim.started) this.view.draw(this.sim); }

  /**
   * One thumb, anywhere: a press jumps on the press itself (not the release) and a ring answers under the
   * finger; holding goes higher, letting go cuts the rise.  The bubble button rewinds — and a press on it
   * that cannot rewind (no bubbles, a card up) is an ordinary press, so a tap is never swallowed.
   */
  pointer(e: PointerInput): void {
    if (e.type === 'down') {
      if (this.view.onButton(e.x, e.y) && this.sim.bubbleNow()) this.view.pressButton();
      else {
        this.downs.add(e.id);
        this.sim.press();
        this.view.touch(e.x, e.y);
      }
    } else if (e.type === 'up') {
      if (this.downs.delete(e.id) && this.downs.size === 0) this.sim.release();
    }
    this.drain();
  }

  /** The bubble button while he runs; the tally or the story card once it takes a tap (the street is free play). */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  /** Space, ↑, W, Enter jump (held: higher); B or ← use a bubble. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.downs.clear();
      this.sim.release();
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'hint') this.env.hint(this.hintText(e.key), e.key === 'button' ? this.view.buttonTip() : this.view.toScreen(e.x, e.y), 3800);
      if (this.env.haptics) haptic(e);
    }
  }

  /** A coach mark's words: a finger's on a phone; on a desktop the jump's marks name their keys too. */
  private hintText(key: Teach): string {
    return t((!this.env.touch && KEYED.has(key) ? `hint.${key}.keys` : `hint.${key}`) as Key);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase { return this.sim.signal(); }

  meter(): number | null { return this.sim.meter(); }

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
    case 'special': buzz([10, 30, 10]); break;
    case 'bonk': buzz(14); break;
    case 'wallJump': buzz(10); break;
    case 'spring': buzz(12); break;
    case 'trunk': buzz(e.band >= 4 ? [12, 30, 12, 30, 24] : [12, 30, 12]); break;
    case 'set': buzz([20, 40, 20, 40, 30]); break;
    case 'home': buzz([20, 40, 20]); break;
    case 'pop': buzz(8); break;
    case 'fall': if (e.bubble) buzz(12); break;
    default: break;
  }
}

/** The hands in a finger's words; the keys in their own row (a phone's card leaves it out, a desktop shows it). */
function howto(): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      { gesture: 'tap', text: t('how.tap') },
      { gesture: 'hold', text: t('how.hold') },
      { gesture: 'tap', text: t('how.bubble') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<ZacheuszProgress> = {
  freshProgress,
  create: env => new ZacheuszGame(env),
  best: p => (migrate(p).sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t0, p) => drawPreview(ctx, w, h, t0, p ? migrate(p) : undefined),
  howto,
};
export default mod;
