/**
 * Każda myśl (Every Thought): a meditation on one point of light, and the burning of negative thoughts (DESIGN.md
 * §19), rooted in 2 Corinthians 10:5 — "we take captive every thought to make it obedient to Christ".  The player
 * rests their gaze and attention on a candle's flame (Christ the light, Jn 8:12); thoughts drift in from the dark on
 * slips of ash-paper — fears, sorrows, anger and their mixtures, everyday ones from a library of real worries, or the
 * player's own, kept only on the device — and wait; while focus holds, the flame's warm ring reaches each and it
 * burns, the ash rising as sparks that become golden lights round the point (beauty for ashes, Isa 61:3).  Rests are
 * whole breaths with the breath guide and a true word that answers the last thought.  Without focus a thought waits;
 * nothing is forced.  Attention and imagination training, not therapy.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts; the numbers and the plan in
 * rules.ts; the library, the emotions and the passages in content.ts; the meta in meta.ts; the narrator in talk.ts),
 * the pictures (render.ts on layout.ts and paint.ts; the words in hud.ts; preview.ts for the lobby, the cards and the
 * intro), the sound (audio.ts), the lobby's card (panel.ts), the rest's rhythm (kit/rhythm.ts: thoughts before a rest,
 * breaths in a rest); the words in i18n.ts.
 */
import { BREATH_DEFAULT, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { MysliSound } from './audio';
import { breathWords, t, unit } from './i18n';
import { bestOf, breathOf, freshProgress, migrate, type MysliProgress } from './meta';
import { progressPanel } from './panel';
import { MysliIntro, drawPreview } from './preview';
import { MysliView } from './render';
import { RULES, pushSecFor, readTime } from './rules';
import { MysliSim, type BlockKind, type Coach, type CoachAt, type SimEvent } from './sim';

/** The breath of the last progress the module saw: the how-to and the rhythm's rest dial name it. */
let knownBreath: BreathPattern | null = null;
const seen = (p: MysliProgress): MysliProgress => {
  knownBreath = breathOf(p);
  return p;
};

class MysliGame implements ArcadeGame {
  private readonly sim: MysliSim;
  private readonly view: MysliView;
  private readonly sound: MysliSound;
  private readonly introScene = new MysliIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<MysliProgress>) {
    seen(migrate(env.progress));
    this.sim = new MysliSim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm ?? null, day: env.day,
    });
    this.ctx = env.canvas.getContext('2d');
    this.view = new MysliView(this.ctx, { reducedMotion: env.reducedMotion, touch: env.touch, seed: Math.floor(env.rng() * 1e9) });
    this.sound = new MysliSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __mysli: this.sim, __mysliView: this.view });
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  intro(dt: number, p: number): void {
    if (!this.ctx) return;
    this.introScene.draw(this.ctx, this.w, this.h, dt, p, this.dpr, this.env.reducedMotion);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A tap: on the story card turns its page; on a number of the finale's row answers "how heavy now"; on "Nie moja"
   * sets the thought aside; anywhere else the words glow again — never burning.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, v = this.view;
    if (!this.env.touch) this.env.canvas.style.cursor = v.hover(sim, e.x, e.y) ? 'pointer' : '';
    if (e.type !== 'down') return;
    if (sim.story) {
      sim.stay();
      this.drain();
      return;
    }
    const n = v.scaleAt(sim, e.x, e.y);
    if (n >= 0) {
      sim.rate10(n);
      if (this.env.haptics) buzz(8);
    } else if (v.skipAt(sim, e.x, e.y)) {
      sim.skip();
      if (this.env.haptics) buzz(6);
    } else sim.stay();
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

  /** The runner's coach mark, pointing at what it explains — never over a card, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.phase !== 'play') return;
    if (sim.telegraphed || sim.blockT < RULES.bannerSec) return;
    if (sim.talk.line) return;
    const h = this.hints.shift()!;
    const text = sim.coachWords(h.what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(text, this.view.pointAt(h.at), ms);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain: a push lasts until its thoughts have burned; a rest counts its breaths down; the quiet its seconds. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' || k === 'quiet' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    const left = s.phase === 'play' && Number.isFinite(b.dur) ? Math.max(0, b.dur - s.blockT) : undefined;
    if (!s.started || s.phase !== 'play' || b.kind === 'settle') {
      const next = s.started && s.phase === 'play' && s.telegraphed ? phaseOf(s.nextKind) : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left, next };
    }
    return { want: b.kind === 'rest' ? 'rest' : 'focus', blind: s.blind, task: s.tip, left, next: s.telegraphed ? phaseOf(s.nextKind) : null };
  }

  meter(): number | null { return this.sim.meter(); }

  /** The breath the game guides (it draws its own guide: `ownBreath`; the runner's pacer stays away). */
  breath(): BreathState | null { return this.sim.restBlock ? this.sim.breath : null; }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= 2 && s.pushBlock) return { value: s.score, sub: t('hud.subBest', { n: left }) };
    if (s.phase !== 'play') return { value: s.score, sub: t('hud.subEnd') };
    if (s.settleBlock) return { value: s.score, sub: t('hud.subSettle') };
    if (s.quietBlock) return { value: s.score, sub: t('hud.subQuiet') };
    if (s.restBlock) return { value: s.score, sub: t('hud.subRest') };
    return { value: s.score, sub: t('hud.subThought', { i: s.score + 1 }) };
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

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'burned': buzz([10, 40, 18]); break;
    case 'blindEnd': if (e.gained > 0) buzz([14, 50, 14]); break;
    default: break;
  }
}

/** The rest's breath in words for the how-to. */
const breathTip = (p: BreathPattern | null): string => breathWords(p && breathOk(p) ? p : BREATH_DEFAULT);

/** How to play, for the hand the player has. */
export function howto(touch = coarsePointer(), breath: BreathPattern | null = knownBreath): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.tap' : 'howto.click') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1', { breath: breathTip(breath) }), t('howto.tip2')],
  };
}

/**
 * The rest's rhythm in this game's words (kit/rhythm.ts): a rest comes after N thoughts have burned (3 by default,
 * 1–6) and lasts whole breaths of the player's pattern (2 by default, 1–6).
 */
export function rhythm(breath: BreathPattern | null = knownBreath): RhythmSpec {
  const cyc = breathCycle(breath && breathOk(breath) ? breath : BREATH_DEFAULT);
  const F = RULES.focus, R = RULES.rest;
  return {
    focus: { def: F.def, min: F.min, max: F.max, step: 1, name: t('rhythm.focus'), format: n => t('rhythm.n', { n }) },
    rest: breathDial(R.def, t('rhythm.rest'), cyc, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    focusSec: n => pushSecFor(n),
    restSec: n => n * cyc,
  };
}

const mod: ArcadeModule<MysliProgress> = {
  freshProgress,
  create: env => new MysliGame(env),
  best: p => {
    seen(migrate(p));
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: () => rhythm(),
  ownBreath: true,
};
export default mod;
