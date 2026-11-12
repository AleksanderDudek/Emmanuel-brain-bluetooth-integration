/**
 * Światło ciała (the light of the body): a body scan made a game, the calm one of the series "Weź moc,
 * obudź się" (DESIGN.md §13.10), rooted in Matthew 6:22 ("your whole body will be full of light").  A band
 * of light scans a serene figure from the crown to the soles; at each of nine organs a real homeostatic
 * loop is pushed out of its range by an everyday thing and the body brings it back — focus brightens the
 * band and the organ in its light returns faster, the hands help (on the heart's beat, breathing out the
 * lungs' CO₂), rest is the vagus' rest with a breath guide in 4 / out 6 while the heart slows (with Mendi,
 * the player's own pulse beats in the figure).  Organs settle and light up, Wiedza cards open with real
 * numbers and their sources, whole scans go deeper (organs → cells → systems) and fill the body map.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the physiology in content.ts, the meta in meta.ts, Zofia's bubble in talk.ts), the pictures
 * (render.ts with layout.ts, figure.ts, paint.ts and hud.ts; intro.ts for calibration, preview.ts for the
 * lobby), the sound (audio.ts) and the lullaby (lullaby.ts on kit/song.ts), the lobby's card (panel.ts);
 * the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { SongPlayer } from '../kit/song';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { SwiatloSound } from './audio';
import { ORGANS, depthName } from './content';
import { ORGAN_SPOT } from './figure';
import { luxText, t, unit } from './i18n';
import { SwiatloIntro } from './intro';
import { figPt } from './layout';
import { buildSong } from './lullaby';
import { bestOf, freshProgress, migrate, type SwiatloProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { SwiatloView } from './render';
import { RULES } from './rules';
import { SwiatloSim, type Coach, type CoachAt, type SimEvent } from './sim';

class SwiatloGame implements ArcadeGame {
  private readonly sim: SwiatloSim;
  private readonly view: SwiatloView;
  private readonly sound: SwiatloSound;
  private song: SongPlayer | null = null;
  private readonly introScene = new SwiatloIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  private finger: number | null = null;
  /** first-time explanations waiting for a clear screen (one at a time, a little apart) */
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<SwiatloProgress>) {
    migrate(env.progress);
    const d = new Date();
    this.sim = new SwiatloSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg',
      tuning: env.tuning, hour: d.getHours() + d.getMinutes() / 60,
    });
    this.view = new SwiatloView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new SwiatloSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __swiatlo?: unknown }).__swiatlo = this.sim;
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
      this.song = new SongPlayer(this.env.audio, buildSong());
      this.song.start();
    }
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    let hr: number | null = null;
    try { hr = this.env.body?.().heartRate ?? null; } catch { hr = null; }
    this.sim.update(dt, f, t, hr);
    if (this.song) {
      this.song.level(this.sim.songLevel(f));
      if (this.sim.phase === 'done') {
        this.song.stop(2);
        this.song = null;
      }
    }
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim, this.now, this.song?.line() ?? null);
  }

  /**
   * A tap on the round button or the body helps the organ in the light (the heart: on the beat; the
   * lungs: a CO₂ bubble out; between organs: a step on; in rest: the breath's turn); on the panel it opens
   * or closes the organ's Wiedza card (as a tap on the organ in the band does once it has settled); on a
   * story card, it closes it.  Every press shows on touch-down.
   */
  pointer(e: PointerInput): void {
    if (e.type !== 'down') {
      if (e.type === 'up' && e.id === this.finger) this.finger = null;
      return;
    }
    this.finger = e.id;
    const sim = this.sim, view = this.view;
    const h = view.hit(e.x, e.y, sim);
    switch (h.kind) {
      case 'story':
        sim.help();
        break;
      case 'button':
        view.buttonDown = 1;
        sim.help();
        if (this.env.haptics) buzz(6);
        break;
      case 'panel':
        view.panelDown = 1;
        sim.tapPanel();
        if (this.env.haptics) buzz(5);
        break;
      default:
        view.touch(e.x, e.y);
        sim.tapOrgan(h.organ ?? null);
        break;
    }
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down && (key === ' ' || key === 'Spacebar')) this.view.buttonDown = 1;
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.finger = null;
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
    // Zofia finishes her line first; while the mark is up she waits (never two bubbles at once)
    if (sim.talk.line) return;
    const h = this.hints.shift()!;
    const ms = h.what === 'loop' || h.what === 'breath' || h.what === 'typical' ? 5200 : 4200;
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(coachText(h.what, this.env.touch), this.pointFor(h.at), ms);
  }

  private pointFor(at: CoachAt): { x: number; y: number } | null {
    const L = this.view.L, sim = this.sim;
    switch (at) {
      case 'button': return { x: L.button.x, y: L.button.y - L.button.r };
      case 'panel': {
        const r = this.view.panelRect;
        return r ? { x: r.x + r.w / 2, y: r.y } : null;
      }
      case 'band': return { x: L.fig.cx, y: this.view.bandY(sim) - L.fig.H * 0.04 };
      case 'heart': return figPt(L, ORGAN_SPOT.heart.x, ORGAN_SPOT.heart.y - 0.03);
      case 'lungs': return figPt(L, -0.04, 0.2);
      case 'chest': return figPt(L, 0, 0.2);
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
    if (best !== null && left > 0 && left <= Math.max(60, best * 0.25)) {
      return { value: s.score, sub: t('hud.subBest', { done: s.done, all: ORGANS.length, left: luxText(left) }) };
    }
    return { value: s.score, sub: t('hud.sub', { depth: depthName(s.depth), done: s.done, all: ORGANS.length }) };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** Every control the player can tap now (as `hit` tests them), for the mobile audit. */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.song?.stop(0.4);
    this.song = null;
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (what === 'help' && !touch) return t('coach.help.keys');
  return t(`coach.${what}` as 'coach.help');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'balanced': buzz(e.rating === 3 ? [16, 30, 26] : 12); break;
    case 'scanDone': buzz([30, 40, 60]); break;
    case 'help': if (e.kind === 'beat' && e.good) buzz(8); break;
    case 'breathTap': if (e.good) buzz(6); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone, Space and Enter on a keyboard. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t('howto.help') },
      { gesture: 'tap', text: t('howto.card') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<SwiatloProgress> = {
  freshProgress,
  create: env => new SwiatloGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;

