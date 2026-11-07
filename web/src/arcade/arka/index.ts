/**
 * Arka (v2, after Arrows – Puzzle Escape; DESIGN.md §6, "Arka, version 2"): Noah's ark has come to rest after the
 * flood and the deck is packed with animals, each facing its own way.  Tap one and it slides out the
 * way it faces if the way to the edge is clear, its file of young behind it, and walks down to the
 * new land to wait for its mate; if someone stands in the way it bumps into them and a heart goes.
 * Three hearts a deck; none left, Noah leads everyone back and the deck starts again (the pairs
 * already out stay counted).  Decks grow into a saga with stars.  The band: in a Mgła the flood's
 * mist hides the far deck and focus widens the clear circle around the door (the threshold a gold
 * ring on the deck; above it the free animals show their way out in gold); in a Tęcza calm fills the
 * rainbow, which gives a heart back and lights one safe move.  The raven comments, mostly wrongly.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with board.ts,
 * the numbers in rules.ts, the data in content.ts, the meta in meta.ts), the pictures (render.ts
 * with layout.ts and paint.ts, intro.ts for calibration, preview.ts for the lobby), the sound
 * (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { ArkaSound } from './audio';
import { t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type ArkaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ArkaView } from './render';
import { ArkaSim, type SimEvent } from './sim';

const ARROWS: Readonly<Record<string, [number, number]>> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

class ArkaGame implements ArcadeGame {
  private readonly sim: ArkaSim;
  private readonly view: ArkaView;
  private readonly sound: ArkaSound;
  private w = 1;
  private h = 1;
  private dpr = 1;

  constructor(private readonly env: GameEnv<ArkaProgress>) {
    this.sim = new ArkaSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ArkaView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new ArkaSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __arka?: unknown }).__arka = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.hudTop());
  }

  intro(dt: number, p: number): void { this.view.intro_(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    // the HUD band is laid out by now: measure it again
    this.view.resize(this.w, this.h, this.dpr, this.env.hudTop());
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

  /** A tap: a card first (the opening and chapter cards close, the stars card moves on), the dove's button, else the deck's cell. */
  pointer(e: PointerInput): void {
    if (e.type !== 'down') return;
    const sim = this.sim, view = this.view;
    if (view.cardTap()) return;
    if (sim.levelState === 'clear') {
      sim.skip();
      this.drain();
      return;
    }
    if (view.onDove(sim, e.x, e.y)) {
      sim.dove();
      this.drain();
      return;
    }
    const c = view.cellAt(sim, e.x, e.y);
    if (c) {
      sim.tapCell(c.x, c.y);
      this.drain();
    }
  }

  /** Arrows move the cursor, Enter sends the animal under it, Space (or H) calls the dove. */
  key(key: string, down: boolean): boolean {
    const sim = this.sim;
    const arrow = ARROWS[key];
    if (arrow) {
      if (down) sim.moveCursor(arrow[0], arrow[1]);
      return true;
    }
    if (key === 'Enter') {
      if (down && !this.view.cardTap()) sim.sendCursor();
      this.drain();
      return true;
    }
    if (key === ' ' || key === 'h' || key === 'H') {
      if (down && !this.view.cardTap()) sim.dove();
      this.drain();
      return true;
    }
    return false;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      if (e.type === 'coach') this.env.hint(t(`coach.${e.key}` as Parameters<typeof t>[0]), this.view.coachPoint(this.sim, e.at), 4200);
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim;
    if (!s.started || s.phase !== 'play') return { want: 'free', blind: false };
    const want = s.want;
    const next = s.nextBlock;
    return {
      want, blind: s.blind, task: s.tip, left: want === 'free' ? undefined : s.blockLeft,
      next: next ? (next.kind === 'push' ? 'focus' : next.kind === 'rest' ? 'rest' : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline { return this.sim.headline(); }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { /* the runner stops the audio; the canvas goes with the stage */ }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'send': buzz(e.chain >= 5 ? 12 : 8); break;
    case 'bump': buzz(e.lost ? [20, 30, 40] : 10); break;
    case 'pair': buzz(e.bonus ? [12, 30, 12, 30, 20] : [12, 30, 12]); break;
    case 'clear': buzz([20, 40, 20, 40, 30]); break;
    case 'restart': buzz([40, 60, 40]); break;
    case 'rainbow': buzz([10, 30, 10]); break;
    default: break;
  }
}

function howto(): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      { gesture: 'tap', text: t('how.tap') },
      { gesture: 'keys', text: t('how.dove') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<ArkaProgress> = {
  freshProgress,
  create: env => new ArkaGame(env),
  best: p => bestOf(migrate(p)),
  unit,
  progressPanel: p => progressPanel(migrate(p)),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto,
};
export default mod;
