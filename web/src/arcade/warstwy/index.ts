/**
 * Warstwy światła (Layers of Light · Schichten des Lichts · Ljusets lager): a meditation of the series "Serce i
 * światło" (DESIGN §28), rooted in 1 Thessalonians 5:23 — "your whole spirit, soul and body".  The figure of light
 * stands in seven nested layers — the body's fine web, the clouds of feeling, the haze of thought, the rose light of
 * relationships, the blueprint of the will, the shimmer of joy, the golden lattice of the spirit — and on each
 * something clings, pictured in Scripture's own images: thorns, stains, flaming darts, cords, chains and knots, ashes,
 * cracks.  The player's focus draws each out; it rises on a thread of light and dissolves in the Light above — given
 * to Jesus, who takes it — and the layer closes, clears and brightens; in rest a short prayer entrusts the layer to
 * Jesus and calm deepens its glow; at the end the seven layers shine together.  Drawn from the esoteric picture of
 * the aura and its subtle bodies, prayed here before God; the game never says it cleanses or heals.  The headline is
 * the threads of light (things drawn out with focus).
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts on the plan in rules.ts; the
 * layers in content.ts and egg.ts; the progress in meta.ts; the narrator in talk.ts), the picture (render.ts on
 * layout.ts and paint.ts; preview.ts for the lobby and the cards), the sound (audio.ts), the lobby's card (panel.ts),
 * the words (i18n.ts).
 */
import { BREATH_PRESETS, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { WarstwySound } from './audio';
import { breathWords, t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type WarstwyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { WarstwyView } from './render';
import { RULES, readTime } from './rules';
import { WarstwySim, type BlockKind, type Coach, type SimEvent } from './sim';

/** The breath of the last progress the module saw (the how-to and the rhythm's rest dial name it). */
let knownBreath: BreathPattern | null = null;
const seen = (p: WarstwyProgress): WarstwyProgress => {
  knownBreath = p.breath;
  return p;
};

class WarstwyGame implements ArcadeGame {
  private readonly sim: WarstwySim;
  private readonly view: WarstwyView;
  private readonly sound: WarstwySound;
  private now = 0;
  private w = 360;
  private h = 640;
  private dpr = 1;
  private readonly hints: Coach[] = [];
  private hintCool = 2;

  constructor(private readonly env: GameEnv<WarstwyProgress>) {
    seen(migrate(env.progress));
    this.sim = new WarstwySim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm ?? null });
    this.view = new WarstwyView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new WarstwySound(env.audio);
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __warstwy: this.sim, __warstwyView: this.view });
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  /** The calibration's scene: the night, the Light above, the figure in its seven dim layers. */
  intro(dt: number): void {
    this.view.update(dt, this.sim);
    this.view.draw(this.sim, true);
  }

  start(): void {
    // the HUD's band may have changed since the calibration: the layout reads the insets again
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
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    this.view.draw(this.sim);
  }

  /** A tap: the words glow again — never light. */
  pointer(e: PointerInput): void {
    if (e.type !== 'down') return;
    if (this.sim.stay() && this.env.haptics) buzz(5);
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
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /**
   * The runner's coach mark: one at a time, never over a telegraph or the banner; it waits while the narrator speaks;
   * it points at the thing being drawn, or at the breath guide.
   */
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
    this.env.hint(text, this.view.coachAt(what, sim), ms);
  }

  /** The pad brightens with the light of a push; in a rest it holds still (no feedback leaks through the sound). */
  padLevel(f: FocusFrame): number | null { return this.sim.pushBlock && f.reliable ? f.level : null; }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain: drawing out is focus; entrusting and the whole are rest. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    const left = s.started && Number.isFinite(b.dur) ? Math.max(0, b.dur - s.blockT) : undefined;
    if (!s.started || b.kind === 'free') return { want: 'free', blind: false, task: s.started ? s.tip : undefined, left };
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: false, task: s.tip, left, next: s.telegraphed ? phaseOf(s.nextKind) : null };
  }

  meter(): number | null { return this.sim.meter(); }

  /** The breath the game guides (it draws its own guide: `ownBreath`). */
  breath(): BreathState | null { return this.sim.restBlock ? this.sim.breath : null; }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (s.stage === 'layers' && best !== null && left > 0 && left <= 3) return { value: s.score, sub: t('sub.best', { n: left }) };
    return { value: s.score, sub: s.subLine };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] { return this.view.targets(); }

  destroy(): void {
    this.env.canvas.style.cursor = '';
  }
}

/** Whether a coach mark still fits the moment (it waited for a banner or the narrator). */
function hintFits(what: Coach, sim: WarstwySim): boolean {
  switch (what) {
    case 'draw': return sim.block.what === 'draw';
    case 'rest': return sim.block.what === 'entrust';
    default: return sim.stage === 'arrive' || sim.stage === 'layers';
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'drawn': if (!e.grace) buzz([8, 30, 12]); break;
    case 'healed': buzz([10, 40, 10, 40, 16]); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts): a push's seconds (30 by design, 20–60; its lead-in included) and a
 * rest's whole breaths of the player's pattern (by design 1 under 10 minutes, 2 up to 45, then 3; the dial 1–4).
 */
export function warstwyRhythm(p?: WarstwyProgress): RhythmSpec {
  const b = p ? migrate(p).breath : knownBreath ?? BREATH_PRESETS.even;
  const cyc = breathCycle(breathOk(b) ? b : BREATH_PRESETS.even);
  const F = RULES.focus, R = RULES.rest;
  return {
    focus: secDial(F.def, t('rhythm.focus'), { min: F.min, max: F.max, step: F.step }),
    rest: breathDial(R.def, t('rhythm.rest'), cyc, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    // no "about N rests" count: by design a session's rests follow its length (1–3 breaths), not the dial's default
    restSec: n => n * cyc,
  };
}

/** How to play, for the hand the player has: a tap on a phone; a click and Space on a desktop; the rest's breath. */
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

const mod: ArcadeModule<WarstwyProgress> = {
  freshProgress,
  create: env => new WarstwyGame(env),
  best: p => {
    seen(migrate(p));
    return bestOf(p);
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => warstwyRhythm(p),
  // the breath guide is the game's own (render.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
