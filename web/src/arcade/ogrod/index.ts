/**
 * Ogród o świcie (Garden at Dawn · Garten im Morgenlicht · Trädgården i gryningen): a meditation of the series "Serce i
 * światło" (DESIGN.md §23), rooted in Psalm 30:6 — weeping for the night, joy in the morning.  A walled garden at night
 * after rain, which turns to dawn as the way is walked: the player with a broken heart walks the stations of their way
 * — the waves of feeling on the pond, the hands on the heart and a kind word, the unsent letter sailing away as a paper
 * boat, the gate closed gently for the time of healing, the stone let fall or held, the lanterns blessed, the seeds of
 * what is good sown — each act done only by real focus, each settling in whole breaths; at dawn the flowers the focus
 * grew open all over the garden and someone in the garden calls the player by name.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts on the plan in rules.ts and the
 * lead's frame in stations.ts; the passages in content.ts; the progress in meta.ts; the narrator in talk.ts; the
 * garden's geometry in world.ts), the picture (render.ts on layout.ts, scenery.ts, paint.ts, hands.ts; preview.ts for
 * the lobby and the cards), the lobby's card (panel.ts with builder B's prep-panel.ts), the sound (builder B's
 * audio.ts), the words (i18n.ts).
 */
import { BREATH_PRESETS, breathCycle, breathOk, type BreathPattern, type BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { GardenSound } from './audio';
import { breathWords, t, unit } from './i18n';
import { bestOf, freshProgress, migrate, type OgrodProgress } from './meta';
import { progressPanel } from './panel';
import { prepView } from './prep';
import { drawPreview } from './preview';
import { GardenView } from './render';
import { RULES, readTime, restInFor } from './rules';
import { GardenSim, type BlockKind, type Coach, type SimEvent } from './sim';

/** The breath of the last progress the module saw (the how-to and the rhythm's rest dial name it). */
let knownBreath: BreathPattern | null = null;
const seen = (p: OgrodProgress): OgrodProgress => {
  knownBreath = p.breath;
  return p;
};

class GardenGame implements ArcadeGame {
  private readonly sim: GardenSim;
  private readonly view: GardenView;
  private readonly sound: GardenSound;
  private now = 0;
  private readonly hints: Coach[] = [];
  private hintCool = 2;
  private finished = false;

  constructor(private readonly env: GameEnv<OgrodProgress>) {
    seen(migrate(env.progress));
    this.sim = new GardenSim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm ?? null, day: env.day,
    });
    this.view = new GardenView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch, seed: Math.floor(env.rng() * 1e9) });
    this.sound = new GardenSound(env.audio, { reducedMotion: env.reducedMotion });
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __ogrod: this.sim, __ogrodView: this.view });
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr, this.env.insets());
  }

  /** The calibration's scene: the night garden after rain, the bench by the pond. */
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
    const s = this.sim;
    this.sound.update(dt, { place: s.place, dawn: s.sky, rest: s.restBlock, light: s.sighted ? s.light : 0, breath: s.restBlock ? s.breath : null });
    // the close's end: the sound fades over a few seconds
    if (!this.finished && s.t >= s.T) {
      this.finished = true;
      this.sound.finish();
    }
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    this.view.draw(this.sim);
  }

  /** A tap: on the 0–10 row answers "how heavy is your heart now"; anywhere else the words glow again — never light. */
  pointer(e: PointerInput): void {
    const sim = this.sim, v = this.view;
    if (!this.env.touch) this.env.canvas.style.cursor = v.hover(sim, e.x, e.y) ? 'pointer' : '';
    if (e.type !== 'down') return;
    const n = v.rateAt(sim, e.x, e.y);
    if (n >= 0) {
      sim.rate10(n);
      if (this.env.haptics) buzz(8);
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
      if (e.type === 'cue') this.sound.cue(e.cue);
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

  /** The meditation holds the runner's pad still: its own soundscape follows the garden. */
  padLevel(): number | null { return null; }

  canStop(): boolean { return this.sim.canStop(); }

  pause(on: boolean): void { this.sound.pause(on); }

  /** What the block asks of the brain: the acts are focus; the settles, the arrival and the dawn are rest. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    const left = s.started ? Math.max(0, s.left) : undefined;
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
    if (s.place !== 'dawn' && s.place !== 'close' && best !== null && left > 0 && left <= 3 && s.score > 0) return { value: s.score, sub: t('sub.best', { n: left }) };
    return { value: s.score, sub: s.subLine };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
    if (!this.finished) {
      this.finished = true;
      this.sound.finish();
    }
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.sound.destroy();
    this.env.canvas.style.cursor = '';
  }
}

/** Whether a coach mark still fits the moment (it waited for a banner or the narrator). */
function hintFits(what: Coach, sim: GardenSim): boolean {
  switch (what) {
    case 'act': return sim.block.what === 'act';
    case 'settle': return sim.block.what === 'settle';
    case 'flower': return sim.block.what === 'act' || sim.block.what === 'settle';
    default: return sim.place !== 'dawn' && sim.place !== 'close';
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'done': if (e.by === 'focus') buzz([10, 40, 14]); else if (e.by === 'grace') buzz(6); break;
    case 'flower': buzz(6); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts): an act's seconds (20 by design, 15–45; its lead-in included) and a
 * settle's whole breaths of the player's pattern (2 by design, 1–4; a session under 10 minutes builds on one breath so
 * the prepared acts fit, then lengthens the settles with the time left — 3 breaths at 3 and 5 minutes; the note says
 * the design fits itself to the length).  A long session lengthens the design's settles and pushes; the player's own
 * are kept (`restIn`: a session too short for a long settle shortens it, and the lobby says so — read on the player's
 * way and words as they are when the lobby asks, since "Twoja droga" changes them on the same card).
 */
export function gardenRhythm(p?: OgrodProgress): RhythmSpec {
  const b = p ? migrate(p).breath : knownBreath ?? BREATH_PRESETS.even;
  const cyc = breathCycle(breathOk(b) ? b : BREATH_PRESETS.even);
  const F = RULES.focus, R = RULES.rest;
  return {
    focus: secDial(F.def, t('rhythm.focus'), { min: F.min, max: F.max, step: F.step }),
    rest: breathDial(R.def, t('rhythm.rest'), cyc, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    // no "about N rests" count: the arrival and the dawn are rests the dials do not set
    restSec: n => n * cyc,
    restIn: (r, sec) => {
      if (!p) return restInFor(r.focus, r.rest, sec, cyc);
      const v = prepView(p.prep);
      const counts = { feelings: v.feelings.length, stones: v.stones.length, lanterns: v.lanterns.length, seeds: v.seeds.length };
      return restInFor(r.focus, r.rest, sec, cyc, p.prep.way, counts);
    },
  };
}

/** How to play, for the hand the player has: a tap on a phone; a click, Space and 0–9 on a desktop; the rest's breath. */
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

const mod: ArcadeModule<OgrodProgress> = {
  freshProgress,
  create: env => new GardenGame(env),
  best: p => {
    seen(migrate(p));
    return bestOf(p);
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => gardenRhythm(p),
  // the breath guide is the game's own (render.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
