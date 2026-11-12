/**
 * Synapsy (the mind renewed, Romans 12:2): the body series' building puzzle.  A brain seen from above, two
 * hemispheres of neurons and the corpus callosum between them.  Two neurons fired one after the other wire
 * (Hebb), a pair fired again grows a synapse thicker, Oli the oligodendrocyte wraps chosen axons in myelin, and
 * thoughts run on the song's beat from an input (an eye, an ear) to an output (a hand, the voice) along the
 * paths the player built — through the hippocampus and across the bridge when a lesson asks.
 *
 * The band: in a push block focus is growth (every growth × up to 3, active links thicken by themselves, a held
 * focus fills the BDNF bloom); in a rest block calm is consolidation (the session's paths replay and are kept
 * for the next session, weak unused links are pruned, the glymphatic wash clears the brain).  The band's two
 * prefrontal halves in balance (`env.body().balance`, `isEven`) light the bridge; without a reading it follows
 * focus alone and says so.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, numbers in rules.ts, the
 * brain in brain.ts, data in content.ts, the meta in meta.ts, Oli's bubble in talk.ts), the pictures (render.ts
 * with layout.ts and paint.ts, intro.ts, preview.ts), the sound and the song (audio.ts, music.ts), the lobby's
 * card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz, clamp } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { SynapsySound } from './audio';
import { t, unit } from './i18n';
import { SynapsyIntro } from './intro';
import { onOli, tapTargets, toBrain } from './layout';
import { bestOf, freshProgress, migrate, type SynapsyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { SynapsyView } from './render';
import { SynapsySim, type Coach, type CoachAt, type SimEvent } from './sim';

/** a finger that moves farther than this (px) drags; less is a tap */
const TAP_PX = 10;

class SynapsyGame implements ArcadeGame {
  private readonly sim: SynapsySim;
  private readonly view: SynapsyView;
  private readonly sound: SynapsySound;
  private readonly introScene = new SynapsyIntro();
  private ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private finger: number | null = null;
  private press: { kind: 'oli' | 'neuron' | 'field'; x: number; y: number; moved: boolean; n: number } | null = null;
  private readonly hints: { what: Coach; at: CoachAt; t: number }[] = [];
  private hintCool = 2;

  constructor(private readonly env: GameEnv<SynapsyProgress>) {
    migrate(env.progress);
    this.sim = new SynapsySim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
      seed: Math.floor(env.rng() * 2147483646) + 1,
    });
    this.view = new SynapsyView(env.canvas, this.sim.brain, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new SynapsySound(env.audio, this.sim.song, this.sim.brain);
    this.ctx = env.canvas.getContext('2d');
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __synapsy?: unknown }).__synapsy = this.sim;
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
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.view.teach = this.sim.session === 1;
    this.view.songOn = this.env.progress.song;
    this.sound.start(this.env.progress.song);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t, this.env.body?.() ?? null);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
    if (this.sim.phase === 'done') this.sound.stop();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /** How far above the finger a dragged thing rides: clear of a fingertip on a phone, none under a mouse. */
  private lift(dist: number): number {
    if (!this.env.touch) return 0;
    return 46 * clamp((dist - TAP_PX) / 30);
  }

  /**
   * A press on a neuron fires it (with a partner fired a moment before, the two wire); dragged on, the path
   * follows the finger and every neuron its lifted tip passes wires to the one before.  A tap on the free
   * field thickens the link under it or wires the pair the lesson needs next.  Oli's button: a tap sends her
   * with myelin to the barest axon of the path; dragged onto an axon, she wraps that one.  The story card
   * closes on any tap.  One finger at a time.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view, L = view.L;
    if (e.type === 'down') {
      if (this.finger !== null && this.finger !== e.id) this.letGo();
      this.finger = e.id;
      view.idle = 0;
      if (sim.story) {
        sim.closeStory();
        this.drain();
        return;
      }
      if (onOli(L, e.x, e.y)) {
        this.press = { kind: 'oli', x: e.x, y: e.y, moved: false, n: -1 };
        view.oliDown = true;
        if (this.env.haptics) buzz(6);
        return;
      }
      const b = toBrain(L, e.x, e.y);
      const n = sim.neuronAt(b.x, b.y, L.pick / L.s);
      if (n >= 0) {
        sim.touchNeuron(n);
        if (this.env.haptics) buzz(5);
      }
      this.press = { kind: n >= 0 ? 'neuron' : 'field', x: e.x, y: e.y, moved: false, n };
      this.drain();
      return;
    }
    if (e.id !== this.finger || !this.press) return;
    const pr = this.press;
    const dist = Math.hypot(e.x - pr.x, e.y - pr.y);
    if (!pr.moved && dist > TAP_PX) pr.moved = true;
    if (e.type === 'move') {
      if (!pr.moved) return;
      const tipY = e.y - this.lift(dist);
      if (pr.kind === 'oli') {
        const b = toBrain(L, e.x, tipY);
        const near = sim.linkAt(b.x, b.y, 0.2);
        view.oliDrag = { x: e.x, y: tipY, key: near && near.myelin < 1 ? near.key : null };
        return;
      }
      // drawing a path: the tip wires every neuron it passes to the one before
      const b = toBrain(L, e.x, tipY);
      const m = sim.neuronAt(b.x, b.y, (L.pick * 0.85) / L.s);
      if (m >= 0 && m !== pr.n) {
        sim.touchNeuron(m);
        pr.n = m;
        if (this.env.haptics) buzz(6);
        this.drain();
      }
      view.chain = sim.pending ? { x: e.x, y: tipY } : null;
      return;
    }
    // up
    if (pr.kind === 'oli') {
      const key = view.oliDrag?.key ?? null;
      if (!pr.moved) sim.sendOli();
      else if (key) sim.sendOli(key);
      view.oliDown = false;
      view.oliDrag = null;
    } else if (pr.kind === 'field' && !pr.moved) {
      const b = toBrain(L, e.x, e.y);
      sim.fieldTap(b.x, b.y, Math.max(0.1, (L.pick * 0.9) / L.s));
    }
    this.letGo();
    this.drain();
  }

  private letGo(): void {
    this.finger = null;
    this.press = null;
    this.view.chain = null;
    this.view.oliDown = false;
    this.view.oliDrag = null;
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) {
      this.view.idle = 0;
      this.drain();
    }
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.letGo();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e, this.sim);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at, t: this.sim.t });
      if (this.env.haptics) haptic(e);
    }
  }

  /**
   * The runner's coach mark, one at a time, pointing at the thing it explains — never over the story card, a
   * telegraph or a banner.  A mark whose moment has gone is dropped (the lens's mark belongs to a push block,
   * the rest's to a rest block), one that waits for its moment lets the others pass, and Oli keeps quiet while
   * a mark is up.
   */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.talkBlocked) return;
    for (let i = 0; i < this.hints.length; i++) {
      const h = this.hints[i];
      const v = sim.t - h.t > 25 ? 'drop' : this.hintNow(h.what);
      if (v === 'drop') { this.hints.splice(i--, 1); continue; }
      if (v === 'wait') continue;
      this.hints.splice(i, 1);
      const at = this.view.pointFor(h.at, sim);
      const ms = h.what === 'pair' || h.what === 'lens' || h.what === 'bridge' ? 5200 : 4200;
      this.hintCool = ms / 1000 + 1.2;
      sim.holdTalk(ms / 1000 + 0.3);
      this.env.hint(coachText(h.what, this.env.touch), at, ms);
      return;
    }
  }

  /** Whether a first-time explanation fits the moment: show it, let it wait, or drop it. */
  private hintNow(what: Coach): 'show' | 'wait' | 'drop' {
    const s = this.sim;
    switch (what) {
      case 'lens': return s.sighted ? 'show' : s.pushBlock ? 'wait' : 'drop';
      case 'rest': return s.restBlock ? 'show' : 'drop';
      case 'blind': return s.blind ? 'show' : 'drop';
      case 'speed': return s.lesson.limitMs !== null ? 'show' : 'drop';
      case 'via': return s.lesson.via ? 'show' : 'drop';
      case 'chain': case 'pair': return s.lessonRoute() ? 'drop' : 'show';
      default: return 'show';
    }
  }

  /** The ambient pad (the song carries the music here): the level in a sighted push, held elsewhere (rest, blind, no signal). */
  padLevel(f: FocusFrame): number | null { return this.sim.sighted && f.reliable ? f.level : null; }

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
    const s = this.sim, L = s.lesson;
    if (s.lessonGap > 0) return { value: s.score, sub: t('hud.subNext', { n: L.index + 2 }) };
    const best = s.bestBefore;
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(6, best * 0.25)) return { value: s.score, sub: t('hud.subBest', { n: L.index + 1, left }) };
    return { value: s.score, sub: t('hud.sub', { n: L.index + 1, done: s.done, goal: L.goal }) };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
    this.sound.stop();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] {
    if (!this.sim.started || this.sim.phase === 'done') return [];
    return tapTargets(this.view.L, { story: !!this.sim.story });
  }

  destroy(): void {
    this.letGo();
    this.sound.stop();
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (!touch && (what === 'pair' || what === 'oli' || what === 'speed')) return t(`coach.${what}.keys` as 'coach.pair.keys');
  return t(`coach.${what}` as 'coach.pair');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'linked': buzz(12); break;
    case 'arrive': if (e.counted) buzz(14); break;
    case 'learned': buzz([20, 40, 30, 40, 60]); break;
    case 'bloom': buzz([30, 40, 60]); break;
    case 'wrapped': buzz(12); break;
    case 'step': if (e.on) buzz(10); break;
    default: break;
  }
}

/** How to play, for the hand the player has: Oli's button on a phone, keys as a desktop's shortcuts. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t('howto.tap') },
      touch ? { gesture: 'drag', text: t('howto.drag') } : { gesture: 'keys', text: t('howto.keys') },
      { gesture: 'tap', text: t('howto.oli') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<SynapsyProgress> = {
  freshProgress,
  create: env => new SynapsyGame(env),
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
