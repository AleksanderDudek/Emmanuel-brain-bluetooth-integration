/**
 * Złota passa (Winning Streak · Siegesserie · Vinnarsvit): a day of wins, noticed and turned by focus (DESIGN.md
 * §26), rooted in Romans 8:28 — "all things work together for good to them that love God".  One day walked down one
 * street from dawn to evening: its moments come one after another as cards — a small joy to see and give thanks for, a
 * small trouble with a grey side and a gold one, and, only when the player asks for it, something that really hurts
 * (named first, then a humble hope or "not yet — I trust").  The hand picks how to see it; only real focus turns the
 * card from grey to gold.  Each card turned is a win — a light that flies up into the garland strung over the street
 * (the streak); a card focus did not turn goes gently into the pocket.  In the evening the garland of the day's wins
 * lights the darkening street and the identity is said: "Jestem na złotej passie — wszystko współdziała ku dobremu."
 *
 * Round 25 (DESIGN.md §29): the day is a film of a day in the life of the player's age group (shared with Stop-klatka,
 * kit/ages.ts), with mini sessions of attention on the senses and the things taken for granted (life.ts).
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the day (sim.ts on rules.ts, content.ts and sets.ts;
 * the progress in meta.ts; the narrator in talk.ts; the words in i18n.ts), the street (builder B: render.ts on
 * layout.ts, scene.ts and paint.ts; preview.ts; audio.ts), the cards over the street (hud.ts), the calibration intro
 * (intro.ts) and the lobby's card (panel.ts).
 */
import type { BreathState } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { dayKey } from '../kit/progress';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { StreetSound } from './audio';
import { Cards, askAt, askTargets, choiceAt, choiceTargets } from './hud';
import { t, unit } from './i18n';
import { PassaIntro, lightsOf } from './intro';
import { choiceRects, layout, type Layout } from './layout';
import { bestOf, freshProgress, migrate, syncAge, type PassaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { StreetView } from './render';
import { RULES, readTime, restInFor, streakNow } from './rules';
import { PassaSim, type BlockKind, type Coach, type SimEvent } from './sim';

class PassaGame implements ArcadeGame {
  readonly sim: PassaSim;
  private readonly street: StreetView;
  private readonly sound: StreetSound;
  private readonly cards = new Cards();
  private readonly introView = new PassaIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private l: Layout | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private time = 0;
  private lastDt = 0;
  private now = 0;
  private finished = false;
  private readonly hints: Coach[] = [];
  private hintCool = 2;

  constructor(private readonly env: GameEnv<PassaProgress>) {
    migrate(env.progress);
    // the age group this device chose (here or in Stop-klatka) tells the day
    syncAge(env.progress);
    this.sim = new PassaSim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
      rhythm: env.rhythm ?? null, day: env.day, reduced: env.reducedMotion,
    });
    this.street = new StreetView({ reduced: env.reducedMotion });
    this.sound = new StreetSound(env.audio, { reducedMotion: env.reducedMotion });
    this.ctx = env.canvas.getContext('2d');
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) Object.assign(globalThis, { __passa: this.sim });
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.l = layout(w, h, this.env.insets(), this.env.touch);
    this.street.resize(this.l, dpr);
  }

  /** The calibration's scene: the street at golden hour under its garland. */
  intro(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introView.draw(ctx, this.w, this.h, dt, this.sim.p, this.env.day);
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
    // (round 25) the place of the film and a sense or given moment's close-up shape the street's sound too
    const heard = { phase: s.phase, day: s.day01, glow: s.glow, breath: s.breath?.k ?? 0.5, place: s.place, life: s.lifeView(), motif: s.cur?.motif ?? null };
    this.sound.update(dt, heard);
    // the evening's end: the sound fades over a few seconds
    if (!this.finished && s.t >= s.T) {
      this.finished = true;
      this.sound.finish();
    }
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    const ctx = this.ctx, l = this.l;
    if (!ctx || !l) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.street.draw(ctx, this.sim.view(), this.lastDt, this.time);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cards.draw(ctx, this.sim, l, this.lastDt, this.env.reducedMotion);
  }

  /** A tap on a choice picks it (a reframe, a hope, trust — or the evening's "for what most"); taps never turn a card. */
  pointer(e: PointerInput): void {
    const l = this.l;
    // the opening card's age chips (a session whose group was never chosen)
    if (l && this.sim.askOpen) {
      const a = askAt(l, e.x, e.y);
      if (!this.env.touch) this.env.canvas.style.cursor = a >= 0 ? 'pointer' : '';
      if (e.type === 'down' && a >= 0 && this.sim.pickAge(a) && this.env.haptics) buzz(8);
      this.drain();
      return;
    }
    const n = this.sim.choiceLabels.length;
    const i = l && n ? choiceAt({ ...l, choices: choiceRects(l, n) }, n, e.x, e.y) : -1;
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
      if (e.type === 'cue') this.sound.cue(e.cue, e.n);
      else if (e.type === 'coach') this.hints.push(e.what);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark: one at a time, never over a telegraph; it waits while the narrator speaks. */
  private flushHints(): void {
    const sim = this.sim;
    while (this.hints.length && !hintFits(this.hints[0], sim)) this.hints.shift();
    if (!this.hints.length || this.hintCool > 0 || sim.talk.line) return;
    const what = this.hints.shift()!;
    const text = sim.coachWords(what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    let at: { x: number; y: number } | null = null;
    const l = this.l, n = sim.choiceLabels.length;
    if (l && what === 'choose' && n) {
      const r = choiceRects(l, n);
      at = { x: r[0].x + r[0].w / 2, y: r[0].y - 6 };
    } else if (l && (what === 'turn' || what === 'sense' || what === 'given')) at = { x: l.card.x + l.card.w / 2, y: l.card.y - 6 };
    this.env.hint(text, at, ms);
  }

  /** The street's own sound follows the day: the runner's pad holds still. */
  padLevel(): number | null { return null; }

  canStop(): boolean { return this.sim.canStop(); }

  pause(on: boolean): void { this.sound.pause(on); }

  /** What the block asks of the brain: the turn is focus; a heavy moment's name, the after-rest and the evening's rests are rest. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    if (!s.started) return { want: 'free', blind: false };
    const left = Math.max(0, s.left);
    // the telegraph of a block that asks something (the arrive is the turn's); a free part next needs none
    const next = s.telegraphed && s.nextKind !== 'free' ? phaseOf(s.nextKind) : null;
    return { want: phaseOf(b.kind), blind: false, task: s.tip, left, next };
  }

  meter(): number | null { return this.sim.meter(); }

  /** The breath of a rest (4 · 0 · 6 · 0 from its start): the runner's pacer follows it. */
  breath(): BreathState | null { return this.sim.breath; }

  /** The pacer's spot in a rest: the layout's own (clear of the card, the story and the choices). */
  pacerAt(): { x: number; y: number; ring?: boolean } | null { return this.l?.pacer ?? null; }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best + 1 - s.score : 0;
    if (s.inRow < 2 && best !== null && s.score > 0 && left > 0 && left <= 2 && s.phase !== 'evening' && s.phase !== 'end') {
      return { value: s.score, sub: t('sub.best', { n: left }) };
    }
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

  /** The choices while they are open (the layout's slots in use). */
  targets(): TapTarget[] {
    if (this.l && this.sim.askOpen) return askTargets(this.l);
    const l = this.l, labels = this.sim.choiceLabels;
    if (!l || !labels.length) return [];
    return choiceTargets({ ...l, choices: choiceRects(l, labels.length) }, labels);
  }

  destroy(): void {
    this.sound.destroy();
    this.env.canvas.style.cursor = '';
  }
}

/** Whether a coach mark still fits the moment (it waited for the narrator). */
function hintFits(what: Coach, sim: PassaSim): boolean {
  switch (what) {
    case 'turn': return sim.block.what === 'turn' && !sim.cur?.done;
    case 'choose': return sim.choiceLabels.length > 1;
    case 'savor': return sim.phase === 'savor';
    case 'carry': return sim.phase === 'carry';
    case 'sense': return sim.block.what === 'turn' && sim.cur?.kind === 'sense' && !sim.cur.done;
    case 'given': return (sim.block.what === 'without' || sim.block.what === 'turn') && sim.cur?.kind === 'given' && !sim.cur.done;
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'turned': buzz(e.trust ? [8, 50, 8] : [10, 40, 16]); break;
    case 'carried': buzz(6); break;
    default: break;
  }
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts): the turn's window (20 s by design, 15–40 by 5; its lead-in included)
 * and the "thank you" after it in whole breaths of 4 · 0 · 6 · 0 (1 by design, 1–4).  By design a longer session
 * lengthens both (2 breaths from 10 minutes, a 25 s turn from 20, 30 s and 3 breaths from 25); the player's own are
 * kept, and always fit (`restIn` says what a session keeps).
 */
export function passaRhythm(): RhythmSpec {
  const F = RULES.focus, R = RULES.rest;
  return {
    focus: secDial(F.def, t('rhythm.focus'), { min: F.min, max: F.max, step: F.step }),
    rest: breathDial(R.def, t('rhythm.rest'), RULES.cyc, { min: R.min, max: R.max }),
    note: t('rhythm.note'),
    // a card's arrival and its turn; a "thank you" in whole breaths
    focusSec: n => n + RULES.arriveSec,
    restSec: n => n * RULES.cyc,
    restIn: (r, sec) => restInFor(r.focus, r.rest, sec),
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

const mod: ArcadeModule<PassaProgress> = {
  freshProgress,
  create: env => new PassaGame(env),
  best: p => bestOf(migrate(p)),
  unit,
  progressPanel: (p, save) => {
    const q = migrate(p);
    syncAge(q);
    return progressPanel(q, save);
  },
  preview: (ctx, w, h, time, p) => {
    const q = p ? migrate(p) : null;
    drawPreview(ctx, w, h, time, lightsOf(q), q ? streakNow(q.streak, dayKey()).days : 0);
  },
  howto: () => howto(),
  rhythm: () => passaRhythm(),
};
export default mod;
