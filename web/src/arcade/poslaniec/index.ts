/**
 * Posłaniec (DESIGN.md §7.3, v2): an early-church messenger carries the apostle's letters along the
 * Roman road to the seven churches of Asia, after Isaiah 52:7 — Subway Surfers' three-lane endless
 * run, seen from behind in pseudo-3D.  Swipe or keys: ←/→ a lane, ↑ jump, ↓ roll; a tap on the left
 * or right third steps a lane, a tap in the middle (and Space) jumps.  Focus fills the stork's wings
 * and he carries the messenger over the roofs; calm lights the watchtowers, which throw a shield;
 * Bela the goat wants the letters.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the road in
 * track.ts, the numbers in rules.ts, the meta in meta.ts, the hands in input.ts, Klekot in talk.ts),
 * the pictures (render.ts with ribbon.ts, intro.ts for calibration, preview.ts for the lobby, all
 * drawn with paint.ts), the sound (audio.ts) and the lobby's progress card (panel.ts); the data in
 * content.ts, the words in i18n.ts.  The runner draws the standard HUD from signal(), meter() and
 * headline(); the first session's coach marks go through env.hint().
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { PoslaniecSound } from './audio';
import { t } from './i18n';
import { Gestures, hintText, keyMove } from './input';
import { PoslaniecIntro } from './intro';
import { layout, tapTargets, type Layout } from './layout';
import { freshProgress, migrate, type PoslaniecProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { PoslaniecView } from './render';
import { RULES } from './rules';
import { PoslaniecSim, type SimEvent } from './sim';

class PoslaniecGame implements ArcadeGame {
  private readonly sim: PoslaniecSim;
  private readonly view: PoslaniecView;
  private readonly sound: PoslaniecSound;
  private readonly intro_ = new PoslaniecIntro();
  private readonly hands = new Gestures();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private L: Layout = layout(1280, 800);
  /** a short freeze on a hit (hit-stop) */
  private freeze = 0;

  constructor(private readonly env: GameEnv<PoslaniecProgress>) {
    this.sim = new PoslaniecSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new PoslaniecView(env.canvas, { reducedMotion: env.reducedMotion, tool: env.tool, touch: env.touch });
    this.sound = new PoslaniecSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, this.env.insets());
    this.view.resize(w, h, dpr, this.L);
    // the thirds of a tap divide the safe width (a notch on its side is not the road)
    this.hands.resize(w, this.L.ins.left, w - this.L.ins.right);
  }

  intro(dt: number, p: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro_.draw(ctx, this.w, this.h, dt, p, this.env.progress);
  }

  start(): void {
    this.resize(this.w, this.h, this.dpr);   // the HUD's band is known now
    this.sim.start();
    // the first time, the opening story holds the run at the milestone until a tap
    if (this.sim.firstEver) this.sim.hold(RULES.storyHold);
    this.sound.start();
    this.view.start(this.sim.p, this.sim.firstEver);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    if (this.freeze > 0) {
      this.freeze -= dt;
      this.view.update(dt * 0.15, this.sim);
      return;
    }
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim, this.sim.z / 2.1);
  }

  draw(): void { if (this.sim.started) this.view.draw(this.sim); }

  /**
   * Swipes act the moment they are long enough; a short tap acts by the third it lands in.  A ring answers
   * every finger the moment it goes down.  While the opening story holds the run, any tap sets off.
   */
  pointer(e: PointerInput): void {
    if (e.type === 'down') this.view.touch(e.x, e.y);
    if (this.sim.held > 0) {
      if (e.type === 'up') this.setOff();
      return;
    }
    const m = this.hands.pointer(e.type, e.id, e.x, e.y, this.sim.t);
    if (m) {
      this.sim.act(m);
      this.drain();
    }
  }

  /** ←/→/A/D lanes, ↑/W/Space jump, ↓/S roll (and any of them, or Enter, sets off from the story). */
  key(key: string, down: boolean): boolean {
    const m = keyMove(key);
    if (this.sim.held > 0 && (m || key === 'Enter')) {
      if (down) this.setOff();
      return true;
    }
    if (!m) return false;
    if (down) {
      this.sim.act(m);
      this.drain();
    }
    return true;
  }

  /** The story is read: the messenger sets off. */
  private setOff(): void {
    this.hands.clear();
    this.sim.release();
    if (this.env.haptics) buzz(10);
    this.drain();
  }

  /** The opening story's card while it holds the run; in play nothing (a swipe anywhere is the control). */
  targets(): TapTarget[] {
    return tapTargets(this.L, { story: this.sim.held > 0 ? this.view.storyBox : null });
  }

  pause(paused: boolean): void {
    if (paused) this.hands.clear();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      if (e.type === 'stumble' || e.type === 'shieldBreak') this.freeze = Math.max(this.freeze, e.type === 'stumble' && e.caught ? 0.12 : 0.07);
      if (e.type === 'teach') {
        const at = e.what === 'wings' ? this.view.storkAt() : e.what === 'goat' ? this.view.pointAt(this.sim.z + 2, this.sim.r.lane, 1.5)
          : this.view.pointAt(e.z, e.lane, e.what === 'roll' ? 2 : 1);
        this.env.hint(hintText(e.what, this.env.touch), at, e.what.startsWith('power') ? 3200 : 3800);
      }
    }
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

  destroy(): void { this.hands.clear(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'power': buzz(10); break;
    case 'letter': buzz(8); break;
    case 'bump': buzz(8); break;
    case 'stumble': buzz(e.caught ? [30, 40, 30] : 25); break;
    case 'shieldBreak': buzz([15, 25, 15]); break;
    case 'land': if (e.hard) buzz(10); break;
    case 'flight': if (e.stage === 'start') buzz([12, 30, 12, 30, 18]); break;
    case 'city': case 'mult': buzz([20, 40, 20, 40, 30]); break;
    case 'mission': case 'word': buzz([12, 30, 12]); break;
    case 'fire': if (e.lit) buzz(8); break;
    default: break;
  }
}

const mod: ArcadeModule<PoslaniecProgress> = {
  freshProgress,
  create: env => {
    migrate(env.progress);
    return new PoslaniecGame(env);
  },
  best: p => {
    migrate(p);
    return p.sessions > 0 ? p.best : null;
  },
  unit: () => t('unit'),
  progressPanel: (p, save) => {
    migrate(p);
    return progressPanel(p, save);
  },
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p),
  howto: (): HowTo => ({
    goal: t('how.goal'),
    hands: [
      { gesture: 'swipe', text: t('how.swipe') },
      { gesture: 'tap', text: t('how.tap') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  }),
};
export default mod;
