/**
 * Koła światła (Wheels of Light · Räder des Lichts · Ljusets hjul): a practice of the series "Serce i światło"
 * (DESIGN.md §28), rooted in Ephesians 4:16 — the whole body, joined and held together, growing through the work of
 * each part.  The well-known chart of the wheels, drawn anew: a calm person in profile, the first wheel opening down,
 * the seventh up, the five between to the front and to the back.  One after another the player's focus brings each
 * wheel to right working — it steadies, turns calmly and evenly clockwise, its petals even out, its colour clears, its
 * mouth takes a healthy size; after each, a prayer for that place in whole breaths; at the end all twelve turn together
 * and their light fills one egg-shaped field, layer by layer, into one white-gold light.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts on the plan in rules.ts; the
 * wheels, passages and moments in content.ts; the progress in meta.ts; the narrator in talk.ts), the picture
 * (render.ts on layout.ts, figure.ts, wheel.ts, paint.ts; preview.ts for the lobby and the cards), the sound (audio.ts),
 * the lobby's card (panel.ts), the words (i18n.ts).
 */
import { BREATH_PRESETS, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { KolaSound } from './audio';
import { breathWords, t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type KolaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { KolaView } from './render';
import { RULES, readTime, restInFor } from './rules';
import { KolaSim, type BlockKind, type Coach, type SimEvent } from './sim';

/** The breath of the last progress the module saw (the how-to and the rhythm's rest dial name it). */
let knownBreath: BreathPattern | null = null;
const seen = (p: KolaProgress): KolaProgress => {
  knownBreath = p.breath;
  return p;
};

class KolaGame implements ArcadeGame {
  private readonly sim: KolaSim;
  private readonly view: KolaView;
  private readonly sound: KolaSound;
  private now = 0;
  private readonly hints: Coach[] = [];
  private hintCool = 2;

  constructor(private readonly env: GameEnv<KolaProgress>) {
    seen(migrate(env.progress));
    this.sim = new KolaSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm ?? null });
    this.view = new KolaView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch, posture: env.progress.posture });
    this.sound = new KolaSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __kola: this.sim, __kolaView: this.view });
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr, this.env.insets());
  }

  /** The calibration's scene: the figure in the night, the wheels dim and out of true, turning unevenly. */
  intro(dt: number): void {
    this.view.update(dt, this.sim);
    this.view.draw(this.sim, true);
  }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    this.view.draw(this.sim);
  }

  /** A tap anywhere: the words glow again — never light. */
  pointer(e: PointerInput): void {
    if (e.type !== 'down') return;
    this.sim.stay();
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
      if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark: one at a time, never over a telegraph or the banner; it waits while the narrator speaks. */
  private flushHints(): void {
    const sim = this.sim;
    while (this.hints.length && !hintFits(this.hints[0], sim)) this.hints.shift();
    if (!this.hints.length || this.hintCool > 0) return;
    if (sim.telegraphed || sim.blockT < RULES.bannerSec) return;
    if (sim.talk.line) return;
    const what = this.hints.shift()!;
    const text = sim.coachWords(what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(text, null, ms);
  }

  /** The ambient pad follows the light in a sighted push and holds still in rest. */
  padLevel(): number | null { return this.sim.padLevel(); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain: the wheels are focus; the prayers, the arrival and the field are rest. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    if (!s.started || b.kind === 'free') return { want: 'free', blind: false, task: s.started ? s.tip : undefined };
    const left = b.kind === 'rest' ? Math.max(0, s.left) : undefined;
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: false, task: s.tip, left, next: s.telegraphed ? phaseOf(s.nextKind) : null };
  }

  meter(): number | null { return this.sim.meter(); }

  /** The breath the game guides (it draws its own guide: `ownBreath`). */
  breath(): BreathState | null { return this.sim.restBlock ? this.sim.breath : null; }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (s.pushBlock && best !== null && left > 0 && left <= 10 && s.score > 0) return { value: s.score, sub: t('sub.best', { n: left }) };
    return { value: s.score, sub: s.subLine };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] { return this.view.targets(); }

  destroy(): void {}
}

/** Whether a coach mark still fits the moment (it waited for a banner or the narrator). */
function hintFits(what: Coach, sim: KolaSim): boolean {
  switch (what) {
    case 'push': return sim.pushBlock;
    case 'rest': return sim.block.what === 'rest';
    case 'petal': return sim.pushBlock || sim.block.what === 'rest';
    default: return sim.block.what !== 'field' && sim.block.what !== 'close';
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'true': buzz([10, 40, 14]); break;
    case 'pair': buzz([8, 30, 8, 30, 12]); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts): focus "Koło" — a push's seconds (20 by design, 10–60, its lead-in
 * included; a push lasts until its wheels are true, this is its target) — and rest "Modlitwa" — the prayer's whole
 * breaths (2 by design, 1–5).  By design the plan fits both to the length (one breath at 3–5 minutes, up to four at
 * 60); a player who moved a dial keeps theirs where they fit (`restIn`: a session too short for a long prayer keeps
 * one breath).
 */
export function kolaRhythm(p?: KolaProgress): RhythmSpec {
  const b = p ? migrate(p).breath : knownBreath ?? BREATH_PRESETS.even;
  const cyc = breathCycle(breathOk(b) ? b : BREATH_PRESETS.even);
  const F = RULES.focus, R = RULES.rest;
  return {
    focus: secDial(F.def, t('rhythm.focus'), { min: F.min, max: F.max, step: F.step }),
    rest: breathDial(R.def, t('rhythm.rest'), cyc, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    // no "about N rests" count: the arrival and the field are rests the dials do not set
    restSec: n => n * cyc,
    restIn: (r, sec) => restInFor(r.focus, r.rest, sec, cyc),
  };
}

/** How to play, for the hand the player has: a tap on a phone; a click or Space on a desktop; the rest's breath. */
export function howto(touch = coarsePointer(), breath: BreathPattern | null = knownBreath): HowTo {
  const b = breath && breathOk(breath) ? breath : BREATH_PRESETS.even;
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.tap' : 'howto.click') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1', { breath: breathWords(b) }), t('howto.tip2')],
  };
}

const mod: ArcadeModule<KolaProgress> = {
  freshProgress,
  create: env => new KolaGame(env),
  best: p => {
    seen(migrate(p));
    return bestOf(p);
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => kolaRhythm(p),
  // the breath guide is the game's own (render.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
