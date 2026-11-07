/**
 * Jerzy i smok (George and the dragon): a survivors-like on the dragon's lands, after the legend of
 * Saint George and Ephesians 6:16, modelled on Knight Survivor and the genre it belongs to (Vampire
 * Survivors, Survivor.io).  A drag anywhere is a joystick (WASD and the arrows too); the knight's
 * weapons strike by themselves; the dragon's brood comes in growing waves and dissolves into smoke,
 * leaving scales; each level is a choice of one of three cards; a maxed pair evolves; the land's
 * dragon comes on a Tarcza with telegraphed fire.  The band is the shield's aura: in a Tarcza its
 * radius follows the level (the threshold a dotted ring on it), it throws the brood back and puts
 * out fire, and quenched fire charges the Miecz światła (a tap); in a Postój everything naps, calm
 * heals and the block's end gives a free card.  A run lost is a tally and a new run; the session's
 * scales stay.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers
 * in rules.ts, the data in content.ts, the meta in meta.ts and Linda's bubble in talk.ts), the
 * pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby,
 * all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { JerzySound } from './audio';
import { t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type JerzyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { JerzyView } from './render';
import { RULES } from './rules';
import { JerzySim, type Coach, type SimEvent } from './sim';

class JerzyGame implements ArcadeGame {
  private readonly sim: JerzySim;
  private readonly view: JerzyView;
  private readonly sound: JerzySound;
  /** the finger on the field: where it went down and when, how far it went */
  private touch: { id: number; x: number; y: number; at: number; far: number } | null = null;
  private now = 0;
  /** first-time explanations waiting for a clear screen (one at a time, a few seconds apart) */
  private readonly hints: { what: Coach; x: number; y: number }[] = [];
  private hintCool = 0;

  constructor(private readonly env: GameEnv<JerzyProgress>) {
    migrate(env.progress);
    this.sim = new JerzySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new JerzyView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new JerzySound(env.audio);
    // ?debug: the run in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __jerzy?: unknown }).__jerzy = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr);
    this.view.setTop(this.env.hudTop());
    this.sim.setView(this.view.L.halfW, this.view.L.halfH, (this.view.L.ky - this.view.L.top) / this.view.L.s);
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.setTop(this.env.hudTop());
    this.sim.setView(this.view.L.halfW, this.view.L.halfH, (this.view.L.ky - this.view.L.top) / this.view.L.s);
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now += dt;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * A press on a card picks it; on a story card or the tally it moves on.  Elsewhere the press is a
   * floating joystick: a drag steers, and a short tap without a drag releases a ready Miecz światła
   * (and otherwise does nothing — a tap never hurts).
   */
  pointer(e: PointerInput): void {
    const sim = this.sim;
    if (e.type === 'down') {
      if (sim.story || sim.tally) {
        sim.tap();
        this.drain();
        return;
      }
      if (sim.choice) {
        const i = this.view.hud.cardAt(e.x, e.y);
        if (i >= 0) sim.tap(i);
        this.drain();
        return;
      }
      this.touch = { id: e.id, x: e.x, y: e.y, at: this.now, far: 0 };
      return;
    }
    const tc = this.touch;
    if (!tc || tc.id !== e.id) return;
    const dx = e.x - tc.x, dy = e.y - tc.y, d = Math.hypot(dx, dy);
    tc.far = Math.max(tc.far, d);
    if (e.type === 'up') {
      this.touch = null;
      this.view.stick = null;
      sim.steer(0, 0);
      if (this.now - tc.at <= RULES.tapSec && tc.far <= RULES.tapPx) {
        sim.tap();
        this.drain();
      }
      return;
    }
    if (d > RULES.stickDead) {
      // the joystick's origin follows a finger that goes past its rim (it never falls behind)
      if (d > RULES.stickPx * 1.4) {
        const k = (d - RULES.stickPx * 1.4) / d;
        tc.x += dx * k;
        tc.y += dy * k;
      }
      const ddx = e.x - tc.x, ddy = e.y - tc.y;
      sim.steer(ddx / RULES.stickPx, ddy / RULES.stickPx);
      this.view.stick = { ox: tc.x, oy: tc.y, x: e.x, y: e.y };
    } else sim.steer(0, 0);
  }

  /** Arrows and WASD walk, Space and Enter release the sword or pick the first card, 1–3 pick a card. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.touch = null;
      this.view.stick = null;
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, x: e.x, y: e.y });
      if (this.env.haptics) haptic(e);
    }
  }

  /**
   * The runner's coach mark, pointing at the thing it explains — never over a story card or the
   * tally; the cards' marks point at the first card once the choice is drawn.
   */
  private flushHints(): void {
    const sim = this.sim, h = this.hints[0];
    if (!h || this.hintCool > 0) return;
    const L = this.view.L;
    let at: { x: number; y: number } | null;
    if (h.what === 'choose' || h.what === 'evolve') {
      const card = this.view.hud.cards[0];
      if (!sim.choice) { this.hints.shift(); return; }
      if (!card) return;
      at = { x: card.x + card.w / 2, y: card.y + 4 };
    } else {
      if (h.what === 'sword' && !sim.swordReady) { this.hints.shift(); return; }
      if (sim.story || sim.tally || sim.choice) return;
      at = h.what === 'sword' ? { x: L.sword.x, y: L.sword.y - L.sword.r } : this.view.toScreen(h.x, h.y);
      at = { x: Math.max(20, Math.min(L.w - 20, at.x)), y: Math.max(L.top + 10, Math.min(L.bottom - 10, at.y)) };
    }
    this.hints.shift();
    const ms = h.what === 'move' || h.what === 'aura' || h.what === 'rest' ? 5000 : 3800;
    this.hintCool = ms / 1000 + 0.6;
    this.env.hint(t(`coach.${h.what}`), at, ms);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b?.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left: b && s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim, r = s.run, best = s.p.bestRun;
    const toBest = best - r.scales;
    const sub = best > 0 && toBest > 0 && toBest <= Math.max(20, best * 0.4)
      ? t('hud.subBest', { lv: r.level, n: toBest })
      : t('hud.sub', { lv: r.level, run: r.n });
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
    case 'hurt': buzz(20); break;
    case 'sword': buzz([30, 40, 60]); break;
    case 'level': buzz([12, 30, 12]); break;
    case 'evolve': buzz([20, 30, 20, 30, 60]); break;
    case 'driven': buzz([30, 40, 30, 40, 80]); break;
    case 'down': buzz([10, 60, 10]); break;
    case 'roar': buzz(60); break;
    default: break;
  }
}

function howto(): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'drag', text: t('howto.move') },
      { gesture: 'tap', text: t('howto.cards') },
      { gesture: 'tap', text: t('howto.tap') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<JerzyProgress> = {
  freshProgress,
  create: env => new JerzyGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto,
};
export default mod;
