/**
 * Światło ciała (the light of the body), the calm game of the series "Weź moc, obudź się" (DESIGN.md §13.10), rooted
 * in Matthew 6:22 ("your whole body will be full of light").  Round 11: five meditations to choose — the organs head
 * to toe, the largest muscles, the brain, the limbs one segment after another, and the nine homeostatic loops — in
 * each, the light comes to one element after another and only real focus fills it; full, it glows and shows a true
 * fact with its source, and a rest of whole breaths follows.  The hands walk (◀ ▶), choose (≡) and stay (a tap on
 * the picture); they never fill anything.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in rules.ts, the
 * data in content.ts and words-*.ts, the meta in meta.ts, Zofia's bubble in talk.ts), the pictures (render.ts with
 * layout.ts, picture.ts, figure.ts, brain.ts, paint.ts and hud.ts; intro.ts for calibration, preview.ts for the
 * lobby), the sound (audio.ts) and the lullaby (lullaby.ts on kit/song.ts), the lobby's card (panel.ts).
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { SongPlayer } from '../kit/song';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { SwiatloSound } from './audio';
import { VARIANTS, variantName } from './content';
import { luxText, t, unit } from './i18n';
import { SwiatloIntro } from './intro';
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
  /** first-time explanations waiting for a clear screen (one at a time, a little apart) */
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;
  private cursor = '';
  private readonly leave = (): void => { this.view.hover = null; this.setCursor('default'); };

  constructor(private readonly env: GameEnv<SwiatloProgress>) {
    migrate(env.progress);
    this.sim = new SwiatloSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, mouse: !env.touch });
    this.view = new SwiatloView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new SwiatloSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    if (!env.touch) env.canvas.addEventListener?.('pointerleave', this.leave);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) {
      (globalThis as { __swiatlo?: unknown }).__swiatlo = this.sim;
      (globalThis as { __swiatloView?: unknown }).__swiatloView = this.view;
    }
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets(), this.sim.variant === 'mozg');
  }

  intro(dt: number, p: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress, this.dpr);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets(), this.sim.variant === 'mozg');
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
    if (this.view.hover) this.setCursor(this.view.cursor(this.sim));
  }

  private setCursor(c: string): void {
    if (c === this.cursor) return;
    this.cursor = c;
    if (this.env.canvas.style) this.env.canvas.style.cursor = c;
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim, this.sim.pulse);
  }

  /**
   * A tap on a button walks (◀ ▶) or opens the meditations (≡); in the picker a row chooses one; on a story card it
   * turns the page; anywhere on the picture it stays with the element (its words again). Every press shows at once.
   */
  pointer(e: PointerInput): void {
    if (!this.env.touch) {
      const was = this.view.hover;
      if (!was || Math.hypot(was.x - e.x, was.y - e.y) > 2) this.view.hoverAge = 0;
      this.view.hover = { x: e.x, y: e.y };
      this.setCursor(this.view.cursor(this.sim));
    }
    if (e.type !== 'down') return;
    const sim = this.sim;
    const h = this.view.hit(e.x, e.y, sim);
    switch (h.kind) {
      case 'story':
        sim.stay();
        break;
      case 'ctrl':
        this.view.down[h.id] = 1;
        if (h.id === 'menu') sim.openPicker();
        else if (h.id === 'prev') sim.prev();
        else sim.next();
        if (this.env.haptics) buzz(6);
        break;
      case 'pick':
        sim.pick(VARIANTS[h.i]);
        if (this.env.haptics) buzz(8);
        break;
      case 'close':
      case 'outside':
        sim.closePicker();
        break;
      default:
        this.view.touch(e.x, e.y);
        sim.stay();
        break;
    }
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) {
      if (key === 'ArrowLeft') this.view.down.prev = 1;
      if (key === 'ArrowRight') this.view.down.next = 1;
      if (key.toLowerCase() === 'm') this.view.down.menu = 1;
      this.drain();
    }
    return used;
  }

  pause(): void {}

  private drain(): void {
    for (const e of this.sim.take()) {
      // the layout follows the meditation before the view places its sparks
      if (e.type === 'element' && (this.sim.variant === 'mozg') !== this.view.L.brain) this.view.resize(this.w, this.h, this.dpr, this.env.insets(), this.sim.variant === 'mozg');
      this.view.on(e, this.sim);
      this.sound.on(e, this.sim);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at what it explains — never over a story card or the picker, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.picker) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.blockT < RULES.bannerSec)) return;
    if (sim.talk.line) return;
    const h = this.hints.shift()!;
    const text = coachText(h.what, this.env.touch);
    const ms = Math.round(Math.max(RULES.readMin, RULES.readBase + RULES.readPerChar * text.length) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(text, this.view.point(h.at, sim), ms);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left (a rest) and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b.kind === 'warmup' && s.telegraphed ? 'focus' : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left: s.phase === 'play' && b.kind === 'warmup' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip,
      left: b.kind === 'rest' ? Math.max(0, b.dur - s.blockT) : undefined,
      next: s.telegraphed ? (b.kind === 'push' ? 'rest' : 'focus') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(60, best * 0.25)) {
      return { value: s.score, sub: t('hud.subBest', { n: s.idx + 1, of: s.count, left: luxText(left) }) };
    }
    return { value: s.score, sub: t('hud.sub', { med: variantName(s.variant), n: s.idx + 1, of: s.count }) };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.song?.stop(0.4);
    this.song = null;
    this.env.canvas.removeEventListener?.('pointerleave', this.leave);
    if (this.env.canvas.style) this.env.canvas.style.cursor = '';
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a mouse clicks. */
export function coachText(what: Coach, touch: boolean): string {
  if (!touch && what === 'nav') return t('coach.nav.mouse');
  return t(`coach.${what}` as 'coach.fill');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'lit': buzz([12, 30, 18]); break;
    case 'whole': buzz([30, 40, 60]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone; clicks and keys with a mouse. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.walk' : 'howto.walk.mouse') },
      { gesture: 'tap', text: t(touch ? 'howto.stay' : 'howto.stay.mouse') },
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
