/**
 * Stop-klatka (Freeze Frame · Standbild · Frysbild): everyday provocations lived through the eyes, and the time frozen
 * to master the moment (DESIGN.md §28), rooted in Proverbs 16:32 — "he who rules his spirit than he who takes a city".
 * The founder: everyday stressful situations told as stories for the player's age group (11–19, 20–26, 27–35, 36–50,
 * 50+), multi-step, and at the trigger a freeze of 20–60 s to charge focus, come into here and now and learn to master
 * the emotion — "nadpisanie zachowania gniewu".  Each story is seen through the eyes; at the trigger the picture stops,
 * the colour drains, the camera steps out until the player sees themselves from aside (self-distancing), and the four
 * steps follow — breathe (focus charges the clarity and the colour comes back), name the feeling (affect labelling), a
 * second look (reappraisal), choose the answer (or a step away first); then time flows again through the eyes: the
 * answer, how it turns out, the lesson with whole breaths.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the session (sim.ts on rules.ts, stories.ts and the
 * stories' files, meta.ts; the words in i18n.ts, the "why" in why.ts), the picture (render.ts: scene.ts on places.ts,
 * people.ts and paint.ts; hud.ts on layout.ts), the sound (audio.ts), the lobby's card (panel.ts) and the preview.
 */
import type { BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { StopSound } from './audio';
import { t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type StopProgress } from './meta';
import { progressPanel } from './panel';
import { StopIntro, drawPreview } from './preview';
import { StopView } from './render';
import { RULES, readTime, restInFor } from './rules';
import { StopSim, type BlockKind, type Coach, type SimEvent } from './sim';
import { storiesFor } from './stories';

class StopGame implements ArcadeGame {
  readonly sim: StopSim;
  private readonly view: StopView;
  private readonly sound: StopSound;
  private readonly introScene = new StopIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private time = 0;
  private now = 0;
  private readonly hints: Coach[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<StopProgress>) {
    migrate(env.progress);
    this.sim = new StopSim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm ?? null,
      day: env.day, reduced: env.reducedMotion,
    });
    this.ctx = env.canvas.getContext('2d');
    this.view = new StopView(this.ctx, { reduced: env.reducedMotion, touch: env.touch });
    this.sound = new StopSound(env.audio, { reduced: env.reducedMotion });
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __stop: this.sim, __stopView: this.view });
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  intro(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, this.sim.p, this.env.reducedMotion);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.time += dt;
    this.sim.update(dt, f, t);
    this.drain();
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    this.view.draw(this.sim, this.time, this.dpr);
  }

  /** A tap: an age chip, a feeling, a way — or anywhere else in a story, read on. */
  pointer(e: PointerInput): void {
    const sim = this.sim;
    const hit = this.view.hit(sim, e.x, e.y);
    if (!this.env.touch) this.env.canvas.style.cursor = hit ? 'pointer' : '';
    if (e.type !== 'down') return;
    let used = false;
    if (hit?.kind === 'age') used = sim.pickAge(hit.i);
    else if (hit?.kind === 'chip') used = sim.nameAt(hit.i);
    else if (hit?.kind === 'way') used = sim.choose(hit.i);
    else used = sim.next();
    if (used && this.env.haptics) buzz(hit ? 8 : 5);
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.sound.on(e, this.sim);
      if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, one at a time, pointing at what it explains. */
  private flushHints(): void {
    const sim = this.sim;
    while (this.hints.length && !hintFits(this.hints[0], sim)) this.hints.shift();
    if (!this.hints.length || this.hintCool > 0) return;
    const what = this.hints.shift()!;
    const text = sim.coachWords(what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    const l = this.view.l;
    let at: { x: number; y: number } | null = null;
    const tg = this.view.targets(sim);
    if (l && tg.length && (what === 'name' || what === 'choose')) at = { x: tg[0].x + tg[0].w / 2, y: tg[0].y - 6 };
    else if (l && what === 'focus') at = { x: l.ring.cx, y: l.ring.cy + l.ring.r + 8 };
    else if (l && what === 'tap') at = { x: l.caption.x + l.caption.w / 2, y: l.caption.y };
    this.env.hint(text, at, ms);
  }

  /** The room tone: dim in the freeze's stop, brightening with the clarity; held still in the rests. */
  padLevel(): number | null {
    const s = this.sim;
    if (s.block.what === 'freeze') return s.sighted ? 0.15 + 0.85 * (s.cur?.shown ?? 0) : 0.05;
    if (s.block.what === 'tell' || s.block.what === 'after') return 0.35;
    return null;
  }

  canStop(): boolean { return this.sim.canStop(); }

  pause(): void { /* the sound is the kit's: the runner suspends it */ }

  /** What the block asks of the brain: the freeze is focus; the telling and the after are rest; the opening and the close free. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    if (!s.started) return { want: 'free', blind: false };
    const next = s.telegraphed && s.nextKind !== 'free' ? phaseOf(s.nextKind) : null;
    return { want: phaseOf(b.kind), blind: false, task: s.tip, left: Math.max(0, s.left), next };
  }

  meter(): number | null { return this.sim.meter(); }

  /** The breath of the freeze and of the lesson (the game draws its own guide: `ownBreath`). */
  breath(): BreathState | null { return this.sim.breath; }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best + 1 - s.score : 0;
    if (best !== null && s.score > 0 && left > 0 && left <= 2 && s.block.what !== 'close') return { value: s.score, sub: t('sub.best', { n: left }) };
    return { value: s.score, sub: s.subLine };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.env.canvas.style.cursor = '';
  }
}

function hintFits(what: Coach, sim: StopSim): boolean {
  switch (what) {
    case 'tap': return sim.block.what === 'tell';
    case 'focus': return sim.block.what === 'freeze' && !sim.cur?.chipsOpen;
    case 'name': return sim.chips.length > 0;
    case 'choose': return sim.ways.length > 0;
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'freeze': buzz([14, 60, 14]); break;
    case 'charged': buzz([8, 40, 8, 40, 16]); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts): the freeze's seconds (20–60 by 5 — the founder's bounds) and the
 * lesson's whole breaths after each story (1–4).  By design both grow with the session's length and the player's
 * sessions; the player's own are kept.
 */
export function stopRhythm(p?: StopProgress): RhythmSpec {
  const F = RULES.focus, R = RULES.rest;
  const order = p ? storiesFor(p.age, p.heavy) : storiesFor('adult', false);
  return {
    focus: secDial(F.def, t('rhythm.focus'), { min: F.min, max: F.max, step: F.step }),
    rest: breathDial(R.def, t('rhythm.rest'), RULES.cyc, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    restIn: (r, sec) => restInFor(r.focus, r.rest, sec, order),
  };
}

/** How to play, for the hand the player has. */
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

const reducedNow = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const mod: ArcadeModule<StopProgress> = {
  freshProgress,
  create: env => new StopGame(env),
  best: p => bestOf(migrate(p)),
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined, reducedNow()),
  howto: () => howto(),
  rhythm: p => stopRhythm(p ? migrate(p) : undefined),
  ownBreath: true,
};
export default mod;
