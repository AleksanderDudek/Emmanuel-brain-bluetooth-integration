/**
 * Urodzaj (DESIGN.md §6, §10.5): Suika Game in Boaz's field.  Feliks the sparrow carries the next
 * fruit along the twine over a wicker basket; move him and let go — two alike fruit that touch join
 * into the next of eleven, olive to the great cluster of Eshcol.  The rim is the overflow line: over
 * it for 2 s and the basket goes to the table, a new one comes, every point stays.  In a push block
 * (Wiatr żniwny) focus is the wind: its strength is the rim's gauge, above the threshold it fills the
 * basket with light, and a full charge blows the harvest wind that settles the basket and draws alike
 * neighbours together.  In a rest block (Pokłosie) calm sets the gleaners' pace: they take the
 * smallest fruit off the heap to the table.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the numbers
 * in rules.ts, physics.ts, the data in content.ts, the meta in meta.ts, Feliks's bubble in talk.ts),
 * the pictures (render.ts with paint.ts and layout.ts, intro.ts for calibration, preview.ts for the
 * lobby), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { UrodzajSound } from './audio';
import { t, unit, type Key } from './i18n';
import { freshProgress, migrate, starsFor, type UrodzajProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { UrodzajView } from './render';
import { RULES } from './rules';
import { UrodzajSim, type SimEvent } from './sim';

const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);
const DROP = new Set([' ', 'Enter', 'ArrowDown', 's', 'S']);

class UrodzajGame implements ArcadeGame {
  private readonly sim: UrodzajSim;
  private readonly view: UrodzajView;
  private readonly sound: UrodzajSound;
  /** the pointer that aims (the first one down; a second finger is ignored until it lifts) */
  private pointerId: number | null = null;
  private left = false;
  private right = false;
  private dropHeld = false;

  constructor(private readonly env: GameEnv<UrodzajProgress>) {
    migrate(env.progress);
    this.sim = new UrodzajSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new UrodzajView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new UrodzajSound(env.audio);
    // ?debug: the basket in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __urodzaj?: unknown }).__urodzaj = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.hudTop()); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
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

  /** The runner draws every frame, the calibration too: until play starts the intro scene stays. */
  draw(): void { if (this.sim.started) this.view.draw(this.sim); }

  /** A press brings Feliks over the finger, a drag (or a hovering mouse) moves him, the release lets the fruit go. */
  pointer(e: PointerInput): void {
    const sim = this.sim, x = this.view.worldX(e.x);
    if (e.type === 'down') {
      if (this.pointerId !== null && this.pointerId !== e.id) return;
      this.pointerId = e.id;
      sim.pointerDown(x);
      this.drain();
      return;
    }
    if (e.type === 'move') {
      if (this.pointerId === null || this.pointerId === e.id) sim.pointerMove(x);
      return;
    }
    if (this.pointerId !== e.id) return;
    this.pointerId = null;
    sim.pointerUp(x);
    this.drain();
  }

  /** ← → or A D move Feliks (held: faster), Space, Enter or ↓ drops. */
  key(key: string, down: boolean): boolean {
    if (LEFT.has(key) || RIGHT.has(key)) {
      if (LEFT.has(key)) this.left = down;
      else this.right = down;
      this.sim.keyAim((this.right ? 1 : 0) - (this.left ? 1 : 0));
      return true;
    }
    if (DROP.has(key)) {
      if (down && !this.dropHeld) {
        this.sim.keyDrop();
        this.drain();
      }
      this.dropHeld = down;
      return true;
    }
    return false;
  }

  /** The runner releases held inputs before it pauses: the synthetic "up" must not drop a fruit. */
  pause(paused: boolean): void {
    if (!paused) return;
    this.pointerId = null;
    this.left = this.right = this.dropHeld = false;
    this.sim.release();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'hint') this.env.hint(t(`hint.${e.key}` as Key), this.view.anchor(e.at, e.x, e.y, this.sim), 4200);
      if (this.env.haptics) haptic(e);
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, for the runner's Mendi panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') {
      const nx = s.started && s.phase === 'play' && b?.kind === 'warmup' && s.telegraphed ? s.nextBlock : null;
      return { want: 'free', blind: false, next: nx ? (nx.kind === 'push' ? 'focus' : 'rest') : null, left: b && s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined };
    }
    const nx = s.telegraphed ? s.nextBlock : null;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: b.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nx ? (nx.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const stars = starsFor(s.basket.score, RULES.stars);
    const sub = s.phase === 'done' ? t('sub.done')
      : t('sub.basket', { n: s.basket.index, stars: '★'.repeat(stars) + '☆'.repeat(3 - stars) });
    return { value: s.score, sub };
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
    case 'merge': buzz(e.link >= 2 ? [10, 25, 10] : e.tier >= 7 ? 16 : 8); break;
    case 'pole': buzz([20, 40, 20, 40, 30]); break;
    case 'wind': buzz([15, 30, 15, 30, 15]); break;
    case 'basketEnd': buzz([12, 30, 12]); break;
    case 'glean': buzz(6); break;
    default: break;
  }
}

/** How to play (the runner's standard card), in this page load's language. */
export function howto(): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      { gesture: 'drag', text: t('how.aim') },
      { gesture: 'tap', text: t('how.drop') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<UrodzajProgress> = {
  freshProgress,
  create: env => new UrodzajGame(env),
  best: p => {
    const m = migrate(p);
    return m.sessions > 0 ? m.bestSession : null;
  },
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto,
};
export default mod;
