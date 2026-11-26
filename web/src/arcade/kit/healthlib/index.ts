/**
 * The health visualisations' engine (DESIGN.md §24): Każdy włos's form (§15) made general, so that a game of the Games
 * tab's section "Wizualizacje zdrowotne" is only a `HealthLibrary` (spec.ts) — its meditations and scenes, its worlds
 * drawn in code, its words and its tune — and its module is one line:
 *
 *   export default makeHealthModule(LIBRARY);
 *
 * A library of short guided meditations about one part of the body, each a few scenes true to the physiology.  The
 * player's real focus grows each picture (and only focus: without it the picture waits, and what has grown stays);
 * rest deepens it with the breath.  The player chooses a meditation and a mode (in order · just this one · repeat),
 * walks back and on, repeats a scene; the next session resumes where this one stopped.  The headline is the
 * library's unit, counted only from focused growth.
 *
 * The parts: the rules (sim.ts, the numbers in rules.ts, the library as the engine reads it in lib.ts, the meta in
 * meta.ts, the narrator in talk.ts), the pictures (render.ts with layout.ts, hud.ts, paint.ts, camera.ts and the
 * game's worlds; picture.ts and preview.ts around play), the sound (audio.ts, the game's tune), the lobby's card
 * (panel.ts); the engine's words in i18n.ts.  For the games' tests: checkLibrary (check.ts) and simSession
 * (testing.ts).
 */
import type { FocusFrame } from '../focus';
import { nightLevel } from '../inner';
import { breathDial, secDial, type RhythmSpec } from '../rhythm';
import { buzz } from '../juice';
import { coarsePointer } from '../mobile';
import { SongPlayer } from '../song';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../types';
import { HealthSound } from './audio';
import { camFor, toScreen } from './camera';
import { libOf, type Lib, type Mode } from './lib';
import { bestOf, freshProgress, migrate, type HealthProgress } from './meta';
import { progressPanel } from './panel';
import { HealthIntro, drawPreview } from './preview';
import { HealthView } from './render';
import { BREATH, RULES } from './rules';
import { HealthSim, type Coach, type CoachAt, type SimEvent } from './sim';
import type { HealthLibrary } from './spec';

export type { HealthLibrary, LabelSpec, MedSpec, SceneSpec, WorldPainter, WorldState } from './spec';
export type { HealthProgress } from './meta';
export { checkLibrary } from './check';
export { simSession } from './testing';

class HealthGame implements ArcadeGame {
  private readonly lib: Lib;
  private readonly sim: HealthSim;
  private readonly view: HealthView;
  private readonly sound: HealthSound;
  private song: SongPlayer | null = null;
  private readonly introScene: HealthIntro;
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  /** first-time explanations waiting for a clear screen (one at a time, a little apart) */
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;
  /** the player's game volume at the start ("Przed snem" lowers it and fades it out; null: not touched) */
  private volume: number | null = null;

  constructor(private readonly spec: HealthLibrary, private readonly env: GameEnv<HealthProgress>) {
    this.lib = libOf(spec);
    migrate(env.progress, spec);
    this.sim = new HealthSim({ lib: spec, progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm });
    this.view = new HealthView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch, tint: spec.tint.light });
    this.sound = new HealthSound(env.audio);
    this.introScene = new HealthIntro(spec);
    this.ctx = env.canvas.getContext('2d');
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __health?: unknown }).__health = this.sim;
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
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress, this.dpr);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    const tune = this.env.progress.song ? this.spec.tune() : null;
    this.sound.start(!tune);
    if (tune) {
      this.song = new SongPlayer(this.env.audio, tune, 0.4);
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
    this.nightSound();
    this.hintCool -= dt;
    // a coach mark still on screen when the picker or a card opens would cover its buttons: it goes at once
    if ((this.sim.story || this.sim.picker) && this.now < this.sim.hintUntil) {
      this.sim.hintUntil = 0;
      this.env.hint('', null, 0);
    }
    this.flushHints();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /** Before sleep: the whole sound at NIGHT.level, fading to silence over the session's last NIGHT.fadeSec. */
  private nightSound(): void {
    const a = this.env.audio;
    if (!this.sim.inner.night || !a.on) return;
    if (this.volume === null) this.volume = a.level;
    const v = this.volume * nightLevel(this.now, this.sim.plannedSec);
    if (Math.abs(v - a.level) > 0.004) a.setVolume(v);
  }

  /**
   * A tap: on a story card it turns the page; on a control it walks (◀ ↻ ▶, ≡ the picker); in the picker it picks a
   * meditation or a mode, or closes it; anywhere on the picture it stays with it (its words glow again).
   */
  pointer(e: PointerInput): void {
    if (!this.env.touch) this.mouseAt(e);
    if (e.type !== 'down') return;
    const sim = this.sim;
    if (sim.story) {
      sim.stay();
      this.drain();
      return;
    }
    const hit = this.view.hit(sim, e.x, e.y);
    let used = true;
    if (hit === 'prev') used = sim.prevScene();
    else if (hit === 'next') used = sim.nextScene();
    else if (hit === 'again') used = sim.again();
    else if (hit === 'list') used = sim.togglePicker();
    else if (hit === 'close' || hit === 'outside') sim.closePicker();
    else if (hit?.startsWith('mode:')) used = sim.setMode(hit.slice(5) as Mode);
    else if (hit?.startsWith('med:')) used = sim.pick(hit.slice(4));
    else if (hit === 'card') used = false;
    else {
      this.view.touch(e.x, e.y);
      used = sim.stay();
    }
    if (used && this.env.haptics) buzz(hit ? 8 : 5);
    this.drain();
  }

  /** A desktop's mouse (DESIGN §14): what a click would do answers (a brighter control, its name), and the cursor says so. */
  private mouseAt(e: PointerInput): void {
    this.view.hover(e.x, e.y);
    const hit = this.sim.story ? (this.view.overStory(e.x, e.y) ? 'story' : null) : this.view.hit(this.sim, e.x, e.y);
    const active = !!hit && hit !== 'card';
    this.env.canvas.style.cursor = active ? 'pointer' : '';
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

  /** The runner's coach mark, pointing at what it explains — never over a story card or the picker, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.picker) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.blockT < RULES.bannerSec)) return;
    if (sim.talk.line) return;
    const h = this.hints.shift()!;
    const ms = h.what === 'breath' || h.what === 'blind' ? 5200 : 4600;
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(coachText(this.lib, h.what, this.env.touch), this.pointFor(h.at), ms);
  }

  private pointFor(at: CoachAt): { x: number; y: number } | null {
    const L = this.view.L;
    switch (at) {
      case 'focus': {
        const sc = this.lib.scene(this.sim.scene);
        const f = this.lib.focusAt(this.sim.scene, this.sim.shown);
        const s = toScreen(camFor(sc.view, L.pic), L.pic, f[0], f[1]);
        return { x: s.x, y: s.y - 24 * L.u };
      }
      case 'controls': {
        const a = L.ctl.prev, b = L.ctl.next;
        return { x: (a.x + b.x + b.w) / 2, y: a.y - 6 };
      }
      case 'list': return { x: L.ctl.list.x + L.ctl.list.w / 2, y: L.ctl.list.y - 6 };
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
    if (best !== null && left > 0 && left <= Math.max(60, best * 0.2)) return { value: s.score, sub: this.lib.t('hud.subBest', { left: this.lib.unitsText(left) }) };
    // the scene's place first: on a small phone the line is clamped, and a long name loses its end, not the place
    return { value: s.score, sub: `${s.idx + 1}/${s.count} · ${this.lib.medName(s.med)}` };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** Every control the player can tap now (the four controls, the picker's parts, or a story card), for the mobile audit. */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.song?.stop(0.4);
    this.song = null;
    this.env.canvas.style.cursor = '';
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(lib: Lib, what: Coach, touch: boolean): string {
  if ((what === 'nav' || what === 'pick') && !touch) return lib.t(`coach.${what}.keys`);
  return lib.t(`coach.${what}`);
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'grown': buzz([10, 40, 18]); break;
    case 'whole': buzz([24, 40, 40, 40, 60]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone; a click and the keys on a desktop. */
export function howto(lib: Lib, touch = coarsePointer()): HowTo {
  const t = lib.t;
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.tap' : 'howto.click') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

/**
 * The rest's rhythm in the lobby (kit/rhythm): seconds of Wzrost (the picture grows with focus) before a rest — 40 by
 * design, 20–120 — and whole breaths of Głębia (the picture deepens with calm) — 3 by design (30 s), 1–6.
 */
export function rhythm(lib: Lib): RhythmSpec {
  return {
    focus: secDial(RULES.push[0], lib.t('rhythm.focus')),
    rest: breathDial(RULES.restBreaths, lib.t('rhythm.rest'), BREATH, RULES.restBreathsDial),
    note: lib.t('rhythm.note'),
    focusSec: n => n,
    restSec: n => n * BREATH,
  };
}

/** A game of the section, from its library: the arcade runner's module (kit/types.ts). */
export function makeHealthModule(spec: HealthLibrary): ArcadeModule<HealthProgress> {
  const lib = (): Lib => libOf(spec);
  return {
    freshProgress: () => freshProgress(spec),
    create: env => new HealthGame(spec, env),
    best: p => {
      migrate(p, spec);
      return p.sessions > 0 ? bestOf(p) : null;
    },
    unit: n => lib().unit(n),
    progressPanel: (p, save) => progressPanel(spec, migrate(p, spec), save),
    preview: (ctx, w, h, time, p) => drawPreview(spec, ctx, w, h, time, p ? migrate(p, spec) : undefined),
    howto: () => howto(lib()),
    rhythm: () => rhythm(lib()),
    // the rest's breath is the kit's guide in the words band (hud.ts drawWords): the runner adds no pacer of its own
    ownBreath: true,
  };
}
