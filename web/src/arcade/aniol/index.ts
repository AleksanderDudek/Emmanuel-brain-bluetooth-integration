/**
 * Anioł Stróż (the guardian angel): a two-sided tap brawler at a child's bed after Psalm 91:11 and
 * Matthew 18:10 — Jesus sends you to keep a child's sleep, and each session is one night.  Zmory
 * (shadows of bad dreams) creep in from both sides; a tap on the left or right half strikes that
 * side with a sweep of light, the middle third and Space strike the nearer side.  The band is the
 * aura: in a Czuwanie its radius is the level (a dotted ring marks the threshold, gold beyond it),
 * it slows the Zmory, wounds them above the threshold and cracks their armour, and a held focus
 * fills the Płomień that banishes them all; in the Kołysanka calm lights stars in the child's dream
 * and Sen comes back; the window's sky and sill keep the last 40 s.  The child is never harmed: a
 * Zmora at the bed only dims Sen, and when it runs out the angel comforts the child.  Level-ups
 * offer three gifts while the night goes on in slow motion; the angel's rank grows across nights.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers
 * in rules.ts, the data in content.ts and the meta in meta.ts), the pictures (render.ts with hud.ts
 * and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn with paint.ts), the
 * sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { AniolSound } from './audio';
import { t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type AniolProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { AniolView } from './render';
import { AniolSim, type SimEvent } from './sim';

class AniolGame implements ArcadeGame {
  private readonly sim: AniolSim;
  private readonly view: AniolView;
  private readonly sound: AniolSound;

  constructor(private readonly env: GameEnv<AniolProgress>) {
    migrate(env.progress);
    // the screenshot scripts can visit a dream: ?debug&aniolNight=N (never in normal play)
    const visit = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search) ? /[?&]aniolNight=(\d+)/.exec(location.search) : null;
    if (visit) {
      env.progress.night = Number(visit[1]);
      env.progress.sessions = Math.max(1, env.progress.sessions);
    }
    this.sim = new AniolSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new AniolView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new AniolSound(env.audio);
    // the app's ?debug view lets the screenshot scripts reach the rules (never in normal play)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __aniol?: AniolSim }).__aniol = this.sim;
  }

  private size = { w: 1, h: 1, dpr: 1 };

  /** The HUD's band is read again at the start: the runner shows its panel only when play begins. */
  resize(w: number, h: number, dpr: number): void {
    this.size = { w, h, dpr };
    this.view.resize(w, h, dpr, this.env.hudTop());
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.resize(this.size.w, this.size.h, this.size.dpr, this.env.hudTop());
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

  /** A tap strikes at once (on the press, not the release): the left third, the right third, or the nearer side; on a gift card it picks it. */
  pointer(e: PointerInput): void {
    if (e.type !== 'down') return;
    if (this.sim.choice) {
      const i = this.view.hud.giftAt(e.x, e.y);
      if (i >= 0) {
        this.sim.pick(i);
        this.drain();
        return;
      }
    }
    this.sim.strike(this.view.sideAt(e.x));
    this.drain();
  }

  /** ←/→ and A/D strike a side, Space, Enter, ↑ and W the nearer one; 1–3 pick a gift. */
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
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      if (e.type === 'coach') this.env.hint(t(e.key), this.view.anchor(e.at, this.sim), 4200);
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, for the runner's panel, banner and dock. */
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
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'hit': buzz(e.perfect ? [6, 20, 10] : 8); break;
    case 'deflect': buzz(10); break;
    case 'grab': buzz([20, 30, 20]); break;
    case 'banish': buzz(e.kind === 'koszmar' ? [30, 40, 30, 40, 60] : 14); break;
    case 'boss': if (e.what === 'counter' || e.what === 'phase') buzz([20, 30, 30]); break;
    case 'bounce': buzz([6, 20, 6]); break;
    case 'flame': buzz([20, 30, 20, 30, 40]); break;
    case 'stir': buzz([10, 60, 10]); break;
    case 'level': buzz([12, 30, 12]); break;
    default: break;
  }
}

const mod: ArcadeModule<AniolProgress> = {
  freshProgress,
  create: env => new AniolGame(env),
  best: p => (p.sessions > 0 ? bestOf(migrate(p)) : null),
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: (): HowTo => ({
    goal: t('how.goal'),
    hands: [
      { gesture: 'tap', text: t('how.tap') },
      { gesture: 'tap', text: t('how.middle') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  }),
};
export default mod;
