/**
 * Brzemiona (Burdens): an intercession of the series "Serce i światło" (DESIGN.md §18), rooted in Galatians 6:2.  Tonglen's
 * "taking and giving" recast: the one prayed for stands on a far ridge, greyed in a cloud of smoke; on the in-breath
 * the grey lifts from them and drifts to the Cross of light in the middle — never to the player, who stands near as a
 * clear figure of light; while focus is held the smoke turns to gold at the Cross, and on the out-breath it returns
 * to them as peace and mercy, their cloud thinning, their figure brightening.  Without focus the smoke waits at the
 * Cross.  The circle widens to all who carry the same burden and to the whole world as a night globe of lights; a
 * rest of whole breaths follows each circle, and after the last everything is left at the Cross (1 Pet 5:7).
 *
 * Round 16 adds a second way, chosen first in the card: "Moje brzemiona" — the player simply gives their own burdens
 * to the Cross (a closed bundle beside them, the smoke lifting from the bundle to the Cross, the light returning to
 * them; a golden light at the foot of the Cross for each burden given), from their own list of topics with ready
 * suggestions — everyday themes and the 24 warownie as sets of wounds and people to forgive (topics.ts).  A fresh
 * progress starts there; a round-15 save keeps "Za innych", the intercession, which stays whole.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in rules.ts, whom
 * and the verses in content.ts, the progress in meta.ts, the narrator in talk.ts), the pictures (render.ts with
 * layout.ts, scene.ts, paint.ts and hud.ts; preview.ts for the lobby and the calibration), the sound (audio.ts), the
 * lobby's card (panel.ts); the words in i18n.ts.
 */
import { BREATH_PRESETS, breathCycle, breathOk, type BreathPattern } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { BrzSound } from './audio';
import { allCirclesOf, type Way } from './content';
import { breathWords, t, unit } from './i18n';
import { breathOf, freshProgress, migrate, bestOf, type BrzProgress } from './meta';
import { progressPanel } from './panel';
import { BrzIntro, drawPreview } from './preview';
import { BrzView } from './render';
import { RULES, readTime } from './rules';
import { BrzSim, type BlockKind, type Coach, type CoachAt, type SimEvent } from './sim';

/** The breath and the way of the last progress the module saw (the lobby's, the session's): the how-to names them. */
let knownBreath: BreathPattern | null = null;
let knownWay: Way = 'own';
const seen = (p: BrzProgress): BrzProgress => {
  knownBreath = breathOf(p);
  knownWay = p.way === 'others' ? 'others' : 'own';
  return p;
};

class BrzGame implements ArcadeGame {
  private readonly sim: BrzSim;
  private readonly view: BrzView;
  private readonly sound: BrzSound;
  private readonly introScene = new BrzIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<BrzProgress>) {
    seen(migrate(env.progress));
    this.sim = new BrzSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm });
    this.view = new BrzView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new BrzSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __brzemiona?: unknown }).__brzemiona = this.sim;
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
    if (this.sim.started) this.view.draw(this.sim);
  }

  /** A tap: a story card turns, the chooser answers, a control acts, anywhere else stays with them (never light). */
  pointer(e: PointerInput): void {
    if (!this.env.touch) this.env.canvas.style.cursor = this.view.hoverAt(e.x, e.y, this.sim) ? 'pointer' : '';
    if (e.type !== 'down') return;
    const hit = this.view.tap(e.x, e.y, this.sim);
    if (this.env.haptics && hit !== 'story') buzz(5);
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
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at what it explains — never over a card or the chooser, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.chooser) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.blockT < RULES.bannerSec)) return;
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

  /** What the block asks: a push lasts until its circle is turned (no `left`); a rest counts its whole breaths down. */
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
    // as the band says it: a circle reached by hand (◎) counts on the burden's whole ladder
    const list = s.circles.includes(s.circle) ? s.circles : allCirclesOf(s.item);
    return { value: s.score, sub: t('hud.sub', { n: list.indexOf(s.circle) + 1, of: list.length }) };
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
  if (e.type === 'circle') buzz([10, 40, 18]);
  else if (e.type === 'carried') buzz([20, 50, 30, 50, 40]);
}

/** A coach mark's words for the hand the player has. */
export function coachText(what: Coach, touch: boolean, sim: BrzSim): string {
  return sim.coachWords(what, touch);
}

/** How to play, for the hand the player has (taps on a phone; a click and keys on a desktop), the breath and the way as set. */
export function howto(touch = coarsePointer(), breath: BreathPattern | null = knownBreath, way: Way = knownWay): HowTo {
  const b = breath && breathOk(breath) ? breath : BREATH_PRESETS.even;
  const own = way === 'own';
  return {
    goal: t(own ? 'howto.ownGoal' : 'howto.goal'),
    hands: [
      { gesture: 'tap', text: t(own ? (touch ? 'howto.ownTap' : 'howto.ownClick') : touch ? 'howto.tap' : 'howto.click') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t(own ? 'howto.ownKeys' : 'howto.keys') }]),
    ],
    tips: [t(own ? 'howto.ownTip1' : 'howto.tip1', { breath: breathWords(b) }), t('howto.tip2')],
  };
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts, round 15): a rest after 1–3 circles turned (1 by design — with more,
 * the light widens, or the next burden is called, within the push) and its whole breaths of the player's own pattern
 * (2 by design for 10 minutes; as designed the session's own length is kept: about 12 s in 3 minutes, 30 in 30; the
 * rest after a burden's last circle a breath longer).
 */
export function brzRhythm(p?: BrzProgress): RhythmSpec {
  const cyc = breathCycle(breathOf(p ? migrate(p) : freshProgress()));
  return {
    focus: {
      def: RULES.restAfter, min: 1, max: RULES.restAfterMax, step: 1, name: t('rhythm.after'),
      format: n => t('rhythm.circles', { n }),
    },
    rest: breathDial(RULES.restDef, t('rhythm.rest'), cyc, { min: 1, max: RULES.restBreathsMax }),
    note: t('rhythm.note'),
    focusSec: n => n * RULES.circleSec,
    restSec: n => n * cyc,
  };
}

const mod: ArcadeModule<BrzProgress> = {
  freshProgress,
  create: env => new BrzGame(env),
  best: p => {
    seen(migrate(p));
    return bestOf(p);
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => brzRhythm(p),
  // the breath guide is the game's own (hud.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
