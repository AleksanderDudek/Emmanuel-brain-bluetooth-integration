/**
 * Rzeki żywej wody (rivers of living water): a meditation of light (DESIGN.md §13.14), rooted in John 7:38-39.
 * Light comes down from an open heaven and rests in seven places of the body — the head, the eyes, the
 * mouth, the heart, the breath, the inner being, the feet — one at a time; at each the founder's prayer
 * ("Przez Jezusa Chrystusa, Duchu Święty, wypełnij … i niech popłynie …") or the player's own words.  Focus
 * is the place's light: its halo grows past a faint ring and its rose window of church glass opens petal by
 * petal; full, the light flows on as living water, two threads of gold and silver spiralling to the next
 * place.  Rest is abiding: the figure breathes 4 in / 6 out, the lit places shine, drops of living water
 * gather in a pool at the feet and two rivers flow out of it.  Then the light rises again, as thanksgiving.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the places in content.ts, the meta in meta.ts, the narrator in talk.ts), the pictures (render.ts
 * with layout.ts, figure.ts, rose.ts, paint.ts and hud.ts; intro.ts and preview.ts on scene.ts), the sound
 * (audio.ts) and the quiet chorale (hymn.ts on kit/song.ts), the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { SongPlayer } from '../kit/song';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { RzekiSound } from './audio';
import { buildHymn } from './hymn';
import { dropsText, t, unit } from './i18n';
import { RzekiIntro } from './intro';
import { figPt, placeXY, windowR } from './layout';
import { bestOf, freshProgress, migrate, type RzekiProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { RzekiView } from './render';
import { RULES } from './rules';
import { LIT_DOWN, LIT_UP, RzekiSim, type Coach, type CoachAt, type SimEvent } from './sim';
import { PLACES } from './content';

class RzekiGame implements ArcadeGame {
  private readonly sim: RzekiSim;
  private readonly view: RzekiView;
  private readonly sound: RzekiSound;
  private song: SongPlayer | null = null;
  private readonly introScene = new RzekiIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  /** first-time explanations waiting for a clear screen (one at a time, a little apart) */
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<RzekiProgress>) {
    migrate(env.progress);
    this.sim = new RzekiSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning });
    this.view = new RzekiView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new RzekiSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __rzeki?: unknown }).__rzeki = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  intro(dt: number, p: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress, this.dpr);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.sound.start(this.env.progress.song);
    if (this.env.progress.song) {
      this.song = new SongPlayer(this.env.audio, buildHymn(), 0.42);
      this.song.start();
    }
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    if (this.song) {
      this.song.level(this.sim.songLevel(f));
      if (this.sim.phase === 'done') {
        this.song.stop(2.5);
        this.song = null;
      }
    }
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt);
    if (this.view.splashes > 0) {
      this.sound.plink();
      this.view.splashes = 0;
    }
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A tap anywhere stays with the place the light is at (its prayer glows again, a little light is added), or
   * turns a story card's page.  It answers at once: a ring under the finger.
   */
  pointer(e: PointerInput): void {
    if (e.type !== 'down') return;
    if (!this.sim.story) this.view.touch(e.x, e.y);
    if (this.sim.stay() && this.env.haptics && !this.sim.story) buzz(5);
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e, this.sim);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at what it explains — never over a story card, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.blockT < RULES.bannerSec)) return;
    // the narrator finishes its line first; while the mark is up it waits (never two voices at once)
    if (sim.talk.line) return;
    const h = this.hints.shift()!;
    const ms = h.what === 'breath' || h.what === 'blind' ? 5200 : 4400;
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(coachText(h.what, this.env.touch), this.pointFor(h.at), ms);
  }

  private pointFor(at: CoachAt): { x: number; y: number } | null {
    const L = this.view.L, sim = this.sim;
    switch (at) {
      case 'place': {
        const c = placeXY(L, sim.place);
        return { x: c.x, y: c.y - windowR(L, sim.fill) * 1.3 };
      }
      case 'chest': return figPt(L, 0, 0.27);
      case 'pool': return figPt(L, 0, 0.98);
      default: return null;
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left: s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(60, best * 0.2)) return { value: s.score, sub: t('hud.subBest', { left: dropsText(left) }) };
    // the places this way has reached: lit going down, thanked going up
    const bit = s.dir === 'down' ? LIT_DOWN : LIT_UP;
    const n = PLACES.reduce((k, p) => k + (s.lit[p] & bit ? 1 : 0), 0);
    return { value: s.score, sub: `${t(s.dir === 'down' ? 'hud.subDown' : 'hud.subUp')} · ${n}/7` };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** Every control the player can tap now (the current place's circle, or a story card), for the mobile audit. */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.song?.stop(0.4);
    this.song = null;
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (what === 'tap' && !touch) return t('coach.tap.keys');
  return t(`coach.${what}` as 'coach.tap');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'full': buzz([10, 40, 18]); break;
    case 'whole': buzz([24, 40, 40, 40, 60]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone, Space and Enter on a keyboard. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t('howto.tap') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<RzekiProgress> = {
  freshProgress,
  create: env => new RzekiGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;
