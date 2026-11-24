/**
 * Z głowy do serca (From Head to Heart): the founder's own meditation, the flagship of the series "Serce i światło"
 * (DESIGN.md §18), rooted in 1 John 4:16.  A light at the brow — where the band sits — moves down the midline to the
 * heart only while focus is held; a flame kindles in the heart and its glow fills the whole person and closes round
 * them; then it widens circle by circle — family, friends, the people I work with and meet, those who hurt me, the
 * whole world — each circle's lamps lit by focus, each blessed in calm with whole breaths, one line per breath; one
 * sun rises over all of them alike, the four dimensions of Ephesians 3:18 open, and the light gathers back into the
 * heart under the Aaronic blessing.  The prayer of the heart of the hesychasts and the order of metta's circles,
 * prayed to God through Jesus.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts on the plan in plan.ts, the
 * numbers in rules.ts, the stages and words' keys in content.ts, the progress in meta.ts, the narrator in talk.ts),
 * the pictures (render.ts with layout.ts, earth.ts, paint.ts and hud.ts; preview.ts for the lobby), the sound
 * (audio.ts), the lobby's card (panel.ts); the words in i18n.ts.
 */
import { BREATH_PRESETS, breathCycle, breathOk, type BreathPattern } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { SerceSound } from './audio';
import { breathWords, lightsText, t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type SerceProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { SerceView } from './render';
import { RULES, readTime } from './rules';
import { SerceSim, type BlockKind, type Coach, type SimEvent } from './sim';

/** The breath of the last progress the module saw (the how-to names it). */
let knownBreath: BreathPattern | null = null;
const seen = (p: SerceProgress): SerceProgress => {
  knownBreath = p.breath;
  return p;
};

class SerceGame implements ArcadeGame {
  private readonly sim: SerceSim;
  private readonly view: SerceView;
  private readonly sound: SerceSound;
  private now = 0;
  private readonly hints: Coach[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<SerceProgress>) {
    seen(migrate(env.progress));
    this.sim = new SerceSim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, day: env.day, rhythm: env.rhythm,
    });
    this.view = new SerceView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new SerceSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __serce?: unknown }).__serce = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr, this.env.insets());
  }

  /** The calibration's scene: the figure, dim, the light at the brow among restless sparks (thoughts). */
  intro(dt: number): void {
    this.view.setIntro(true);
    this.view.update(dt, this.sim);
    this.view.draw(this.sim, false);
  }

  start(): void {
    this.view.setIntro(false);
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.pulse = this.env.body?.().heartRate ?? null;
    this.view.update(dt, this.sim);
    this.sound.update(dt);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /** A tap anywhere stays with the words (they glow again, a ring of light, a soft tone — never light), or turns a story card. */
  pointer(e: PointerInput): void {
    if (!this.env.touch) this.env.canvas.style.cursor = this.sim.story && this.view.overStory(e.x, e.y) ? 'pointer' : '';
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
      if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /**
   * The runner's coach mark: one at a time, never over a story card, a telegraph or a banner; a waiting mark quiets
   * the narrator (its line ends), and a mark whose moment has passed (ring 4's care once ring 4 is behind) is dropped.
   */
  private flushHints(): void {
    const sim = this.sim;
    while (this.hints.length && !hintFits(this.hints[0], sim)) this.hints.shift();
    if (!this.hints.length || this.hintCool > 0 || sim.story) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.blockT < RULES.bannerSec)) return;
    if (sim.talk.line) {
      sim.hintUntil = Math.max(sim.hintUntil, this.now + 0.3);
      return;
    }
    const what = this.hints.shift()!;
    const text = sim.coachWords(what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(text, null, ms);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    const left = s.phase === 'play' && Number.isFinite(b.dur) ? Math.max(0, b.dur - s.blockT) : undefined;
    if (!s.started || s.phase !== 'play' || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b.kind === 'warmup' && s.telegraphed ? phaseOf(s.nextKind) : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left, next };
    }
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: false, task: s.tip, left, next: s.telegraphed ? phaseOf(s.nextKind) : null };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(20, best * 0.2)) return { value: s.score, sub: t('sub.best', { left: lightsText(left) }) };
    // the stage ("Etap 4 z 9 · Krąg 1"), the re-entry, the world, the return
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

/** Whether a coach mark still fits the moment (it waited for a banner or the narrator). */
function hintFits(what: Coach, sim: SerceSim): boolean {
  switch (what) {
    // how the light moves: not while the player abides (nothing moves then)
    case 'light': return sim.pushBlock && !sim.abiding;
    case 'breath': return sim.restBlock;
    case 'names': return sim.restBlock && sim.rest?.rest === 'bless';
    case 'ring4': return sim.stage === 'ring4' || sim.ring === 4;
    default: return true;
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'kindled': buzz([12, 40, 18]); break;
    case 'ringDone': buzz([10, 40, 10]); break;
    case 'way': buzz([20, 40, 30, 40, 40]); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts; round 16): a stage's push length — 45–90 s, by design 45, its
 * shortest (a stage fits its pushes to its length around it: fewer, longer stretches of focus as it grows) — and each
 * rest's whole breaths of the player's own pattern (by design 2).  The stage length itself is the card's (panel.ts):
 * one place for it.  A round-15 save (a blessing after 1–3 circles) clamps to the dial's minimum, the design, so it
 * reads "jak zaprojektowano" and plays as designed.
 */
export function serceRhythm(p?: SerceProgress): RhythmSpec {
  const b = p ? migrate(p).breath : BREATH_PRESETS.even;
  const cyc = breathCycle(breathOk(b) ? b : BREATH_PRESETS.even);
  const D = RULES.pushDial;
  return {
    focus: secDial(D.def, t('rhythm.push'), { min: D.min, max: D.max, step: D.step }),
    rest: breathDial(RULES.restBreathsDef, undefined, cyc, { min: 1, max: RULES.restBreathsMax }),
    note: t('rhythm.note'),
    focusSec: n => n,
    restSec: n => n * cyc,
  };
}

/** How to play, for the hand the player has: a tap on a phone; a click, Space and Enter on a desktop; the rest's breath. */
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

const mod: ArcadeModule<SerceProgress> = {
  freshProgress,
  create: env => new SerceGame(env),
  best: p => {
    seen(migrate(p));
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => serceRhythm(p),
  // the breath guide is the game's own (hud.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
