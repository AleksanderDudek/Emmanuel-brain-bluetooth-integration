/**
 * Chleby i ryby (five loaves and two fish), v2: a crowd cannon after Mob Control, told after John
 * 6:9 — the boy whose basket it was helps the disciples feed the people sitting on the hillside.
 * Hold to pour a stream of bread-bearers (loaves on little legs) from the basket, drag to aim: they
 * run up the terrace through gates that multiply them (honey ×2/×3, green bursts, grey takers, the
 * golden gate) to the tables of the hungry at the top, each with its hunger bar; gull waves waddle
 * down to snatch them one for one (Gerwazy the fat gull, Mirka herself now and then), and each
 * chapter ends at the Pelikan, who gulps until he is full.  The band is the core: in a Rozdawanie
 * focus sets the golden gate's multiplier (×1 below the threshold, ×2 at it, up to ×5) and a held
 * focus fills the Big Basket, the champion; on the grass calm sits the crowd down, the gulls doze
 * and the crumbs fill the baskets that buy the upgrades.  Levels of one to three terraces with
 * three stars, story cards, a path of hillsides; nothing is ever lost (the disciples help).
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the
 * terrace in field.ts, the numbers in rules.ts and the meta in meta.ts), the pictures (render.ts
 * with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn with
 * paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts and content.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { ChlebySound } from './audio';
import { t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type ChlebyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ChlebyView } from './render';
import { ChlebySim, type SimEvent } from './sim';

class ChlebyGame implements ArcadeGame {
  private readonly sim: ChlebySim;
  private readonly view: ChlebyView;
  private readonly sound: ChlebySound;

  constructor(private readonly env: GameEnv<ChlebyProgress>) {
    this.sim = new ChlebySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ChlebyView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg', hudTop: () => env.hudTop() });
    this.sound = new ChlebySound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.cardOn = this.view.hud.storyOn;
    this.sim.slow = this.view.hitStop > 0 ? 0.15 : 1;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /** A press aims and fires a burst, a hold pours, a drag aims; on the card between levels a tap buys or goes on. */
  pointer(e: PointerInput): void {
    const hit = this.view.pointer(e.type, e.x, e.y, e.id, this.sim);
    if (!hit) return;
    switch (hit.kind) {
      case 'press': this.sim.press(hit.x); break;
      case 'drag': this.sim.drag(hit.x); break;
      case 'release': this.sim.release(); break;
      case 'offer': this.sim.buy(hit.i); break;
      case 'go': this.sim.skip(); break;
      default: break;
    }
    this.drain();
  }

  /** ←/→ (A/D) move the basket, Space fires a burst, Enter goes on, 1–3 buy on the card between levels. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.view.release();
      this.sim.release();
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      if (e.type === 'teach') {
        this.env.hint(this.view.hintText(e.what), this.view.anchor(e.what, this.sim), 3800);
        continue;
      }
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

  destroy(): void { this.view.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'fire': if (e.kind === 'big') buzz([20, 30, 20]); break;
    case 'tableFed': buzz([12, 20, 12]); break;
    case 'peck': buzz(15); break;
    case 'bigReady': buzz([10, 30, 10]); break;
    case 'sated': buzz([15, 30, 30]); break;
    case 'won': buzz([15, 30, 15, 30, 40]); break;
    case 'break': buzz(10); break;
    default: break;
  }
}

const mod: ArcadeModule<ChlebyProgress> = {
  freshProgress,
  create: env => new ChlebyGame(env),
  best: p => (migrate(p).sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto: (): HowTo => ({
    goal: t('howto.goal'),
    hands: [
      { gesture: 'hold', text: t('howto.hold') },
      { gesture: 'drag', text: t('howto.drag') },
      { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  }),
};
export default mod;
