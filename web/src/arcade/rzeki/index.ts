/**
 * Rzeki żywej wody (rivers of living water): a meditation of light (DESIGN.md §13.14), rooted in John 7:38-39.
 * Light comes down from an open heaven and rests at the stations of the two pictures the founder sent — the
 * gate and the stars above the head, the crown, the three channels, the brow, the throat, the heart, the hands,
 * the solar plexus, the Void, the sacral centre, the sacrum, the root, the feet, the earth star — one at a time,
 * on the map the player chose; at each the founder's prayer ("Przez Jezusa Chrystusa, Duchu Święty, wypełnij …
 * i niech popłynie …") or the player's own words.  Focus is the station's light: its halo grows past a faint ring
 * and turns gold, and only then does its glass load, piece by piece; full, the light flows on as living water.
 * Rest is abiding: the figure breathes 4 in / 6 out, the lit stations shine, drops of living water gather in a
 * pool at the feet and two rivers flow out of it.  Then the light rises again, as thanksgiving; the way goes on
 * next session where it stopped.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in rules.ts,
 * the stations and maps in content.ts, their glass piece by piece in tiles.ts, the meta in meta.ts, the narrator
 * in talk.ts), the pictures (render.ts with layout.ts and its camera, figure.ts, rose.ts, paint.ts and hud.ts;
 * intro.ts and preview.ts on scene.ts), the sound (audio.ts) and the quiet chorale (hymn.ts on kit/song.ts), the
 * lobby's card (panel.ts); the words in i18n.ts.
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
import { bestOf, freshProgress, migrate, type RzekiProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { RzekiView } from './render';
import { RULES } from './rules';
import { RzekiSim, type Coach, type CoachAt, type SimEvent } from './sim';

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
   * A tap anywhere stays with the station the light is at (its prayer glows again, a ring of light, a glass tone —
   * never light), or turns a story card's page.  It answers at once: a ring under the finger.
   */
  pointer(e: PointerInput): void {
    if (!this.env.touch) this.mouseAt(e);
    if (e.type !== 'down') return;
    if (!this.sim.story) this.view.touch(e.x, e.y);
    if (this.sim.stay() && this.env.haptics && !this.sim.story) buzz(5);
    this.drain();
  }

  /**
   * A desktop's mouse (DESIGN §14): the station a click would stay with answers with a ring of light, and the
   * cursor says a click does something — anywhere in the play (a click anywhere stays with it), on a story card.
   */
  private mouseAt(e: PointerInput): void {
    const v = this.view;
    v.hover(e.x, e.y);
    const on = this.sim.story ? v.overStory(e.x, e.y) : e.y >= v.L.top;
    this.env.canvas.style.cursor = on ? 'pointer' : '';
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
    return this.view.pointAt(at, this.sim);
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
    // where the light is on the way: the station's number on the map's route ("W dół · 9/17")
    const n = Math.min(s.route.length, s.idx + (s.stage === 'flow' ? 2 : 1));
    return { value: s.score, sub: `${t(s.dir === 'down' ? 'hud.subDown' : 'hud.subUp')} · ${n}/${s.route.length}` };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** Every control the player can tap now (the current station's area, or a story card), for the mobile audit. */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.song?.stop(0.4);
    this.song = null;
    this.env.canvas.style.cursor = '';
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

/** How to play, for the hand the player has: taps on a phone; a click, Space and Enter on a desktop. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.tap' : 'howto.click') },
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
