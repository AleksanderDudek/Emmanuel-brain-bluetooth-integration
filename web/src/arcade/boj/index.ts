/**
 * Dobry bój (The Good Fight · Der gute Kampf · Den goda kampen): a boxing / MMA fight of quick-time moments and focus
 * (DESIGN.md §25), rooted in 2 Timothy 4:7 — "I have fought the good fight".  Popular combinations come at the player
 * or the opponent shows an opening; time slows almost to a stop, and for 10–30 s focus charges the energy while the
 * hand chooses the answer — a slip, a roll, a block, a counter, a combination.  Full energy: the move goes with all its
 * power; at the window's end it goes with what was charged.  Three lives (the three-knockdown rule): win by knockout
 * or by staying on the feet to the final bell; a lost fight is a lesson, and with time left a rematch.  A sport with
 * rules and respect — touching gloves, the embrace after, a knockout shown gently.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the fight (sim.ts on rules.ts, moves.ts and
 * content.ts; the progress in meta.ts; the coach in talk.ts; the words in i18n.ts), the ring (builder B: render.ts on
 * layout.ts, rig.ts and paint.ts; preview.ts; audio.ts), the cards over the ring (hud.ts), the calibration intro
 * (intro.ts) and the lobby's card (panel.ts).
 */
import type { BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { RingSound } from './audio';
import { playerLook } from './content';
import { Cards, optionAt, optionTargets } from './hud';
import { t, unit } from './i18n';
import { BojIntro } from './intro';
import { layout, type Layout } from './layout';
import { bestOf, freshProgress, migrate, type BojProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { RingView } from './render';
import { CYC, RULES, readBreathsIn, readTime } from './rules';
import { BojSim, KIND, optionWords, type CoachMark, type SimEvent, type Stage } from './sim';

class BojGame implements ArcadeGame {
  readonly sim: BojSim;
  private readonly ring: RingView;
  private readonly sound: RingSound;
  private readonly cards = new Cards();
  private readonly introView = new BojIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private l: Layout | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private time = 0;
  private lastDt = 0;
  private now = 0;
  private readonly hints: CoachMark[] = [];
  private hintCool = 2;
  /** the stage the coach mark on screen belongs to (it is taken down when the stage moves on) */
  private hintStage: Stage | null = null;

  constructor(private readonly env: GameEnv<BojProgress>) {
    migrate(env.progress);
    this.sim = new BojSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm ?? null });
    this.ring = new RingView({ reduced: env.reducedMotion });
    this.sound = new RingSound(env.audio, { reducedMotion: env.reducedMotion });
    this.ctx = env.canvas.getContext('2d');
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __boj: this.sim });
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.l = layout(w, h, this.env.insets(), this.env.touch);
    this.ring.resize(this.l, dpr);
  }

  /** The calibration's scene: the ring under its light, the player's fighter facing an opponent. */
  intro(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introView.draw(ctx, this.w, this.h, dt, this.sim.p);
  }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.lastDt = dt;
    this.time += dt;
    this.sim.update(dt, f, t);
    this.drain();
    const s = this.sim;
    this.sound.update(dt, { phase: s.phase, slow: s.slow, crowd: s.crowd, energy: s.ex?.energy ?? 0, breath: s.breath?.k ?? 0.5 });
    this.hintCool -= dt;
    if (this.hintStage && s.stage !== this.hintStage && this.now < s.hintUntil) {
      this.env.hint('');
      s.hintUntil = this.now;
      this.hintStage = null;
    }
    this.flushHints();
  }

  draw(): void {
    const ctx = this.ctx, l = this.l;
    if (!ctx || !l) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const v = this.sim.view(this.env.reducedMotion);
    this.ring.draw(ctx, v, this.lastDt, this.time);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cards.draw(ctx, this.sim, l, this.lastDt, this.env.reducedMotion);
  }

  /** A tap on an option of the slow motion chooses it (the energy goes into it); anywhere else nothing. */
  pointer(e: PointerInput): void {
    const l = this.l, ex = this.sim.ex;
    const open = this.sim.stage === 'slow' && !!ex && !ex.released;
    const i = l && open ? optionAt(l, ex!.opts.length, e.x, e.y) : -1;
    if (!this.env.touch) this.env.canvas.style.cursor = i >= 0 ? 'pointer' : '';
    if (e.type !== 'down' || i < 0) return;
    if (this.sim.choose(i) && this.env.haptics) buzz(8);
    this.drain();
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      if (e.type === 'cue') this.sound.cue(e.cue, e.strength);
      else if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark: one at a time, never over a banner; the choice's mark points at the options. */
  private flushHints(): void {
    const sim = this.sim;
    while (this.hints.length && !hintFits(this.hints[0], sim.stage)) this.hints.shift();
    if (!this.hints.length || this.hintCool > 0 || sim.banner) return;
    const what = this.hints.shift()!;
    const text = sim.coachWords(what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.hintStage = sim.stage;
    let at: { x: number; y: number } | null = null;
    const l = this.l;
    if (l && (what === 'chooseIn' || what === 'chooseOpen') && l.options.length) {
      const a = l.options[0], b = l.options[Math.min(2, l.options.length - 1)];
      at = { x: (a.x + b.x + b.w) / 2, y: Math.min(a.y, b.y) - 6 };
    }
    this.env.hint(text, at, ms);
  }

  padLevel(): number | null { return null; }

  canStop(): boolean { return this.sim.canStop(); }

  pause(on: boolean): void { this.sound.pause(on); }

  /** What the block asks of the brain: the slow motion and the count are focus; the read and the corner are rest. */
  signal(): SignalPhase {
    const s = this.sim;
    if (!s.started) return { want: 'free', blind: false };
    const k = KIND[s.stage];
    const left = Number.isFinite(s.blockDur) ? s.left : undefined;
    const next = s.nextKind;
    const want = k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free';
    return { want, blind: false, task: s.tip, left, next: next === 'push' ? 'focus' : next === 'rest' ? 'rest' : null };
  }

  meter(): number | null { return this.sim.meter(); }

  /** The breath of a rest (4 · 0 · 6 · 0 from its start): the runner's pacer follows it. */
  breath(): BreathState | null { return this.sim.breath; }

  /** The pacer's spot in a rest: the layout's own when it gives one (clear of the bars), else the runner's place. */
  pacerAt(): { x: number; y: number; ring?: boolean } | null {
    const p = (this.l as (Layout & { pacer?: { x: number; y: number; ring?: boolean } }) | null)?.pacer;
    return p ?? null;
  }

  headline(): Headline {
    const s = this.sim;
    return { value: s.score, sub: s.subLine };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
    this.sound.finish();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** The slow motion's options while they are open (the layout's slots). */
  targets(): TapTarget[] {
    const l = this.l, ex = this.sim.ex;
    if (!l || this.sim.stage !== 'slow' || !ex || ex.released) return [];
    return optionTargets(l, ex.opts.map(o => optionWords(o).label));
  }

  destroy(): void {
    this.sound.destroy();
    this.env.canvas.style.cursor = '';
  }
}

/** Whether a coach mark still fits the moment (it waited for a banner or another mark). */
function hintFits(what: CoachMark, stage: Stage): boolean {
  switch (what) {
    case 'slow':
    case 'chooseIn':
    case 'chooseOpen': return stage === 'slow';
    case 'count': return stage === 'count';
    case 'read': return stage === 'read';
    case 'corner': return stage === 'corner';
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'hit': if (e.on === 'player') buzz(e.force > 0.5 ? 22 : 10); break;
    case 'counter': buzz([10, 30, 14]); break;
    case 'knockdown': buzz(e.who === 'player' ? 40 : [12, 40, 12]); break;
    case 'fight': buzz(e.how === 'out' ? 30 : [14, 40, 14, 40, 24]); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts): the slow motion's window (20 s by design, 10–30 by 5; it ends sooner
 * when the energy fills) and the read's whole breaths of 4 · 0 · 6 · 0 (1 by design, 1–3; the corner between rounds
 * 2 breaths longer, 1 in a session under 10 minutes; under 5 minutes the read keeps at most 2).
 */
export function bojRhythm(): RhythmSpec {
  const F = RULES.focus, R = RULES.rest;
  return {
    focus: secDial(F.def, t('rhythm.focus'), { min: F.min, max: F.max, step: F.step }),
    rest: breathDial(R.def, t('rhythm.rest'), CYC, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    // a window and its sequence and resolve; a read in whole breaths
    focusSec: n => n + 5,
    restSec: n => n * CYC,
    restIn: (r, sec) => readBreathsIn(r.rest, sec),
  };
}

/** How to play, for the hand the player has: a tap on a phone; a click and the keys on a desktop. */
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

const mod: ArcadeModule<BojProgress> = {
  freshProgress,
  create: env => new BojGame(env),
  best: p => bestOf(migrate(p)),
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, time, p) => {
    const q = p ? migrate(p) : null;
    drawPreview(ctx, w, h, time, q ? playerLook(q.sex, q.skin, q.hair) : undefined, q?.style);
  },
  howto: () => howto(),
  rhythm: () => bojRhythm(),
};
export default mod;
