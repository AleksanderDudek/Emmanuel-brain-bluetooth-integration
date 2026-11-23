/**
 * Rzeka Ezechiela (Ezekiel's River), a meditation of the series "Serce i światło" (DESIGN §18), rooted in Ezekiel
 * 47:9 — "wherever the river goes, every living creature will live".  The river from the temple rises up a figure of
 * light from the ankles to swimming depth only while focus is held (and waits, never falls, without it), washes the
 * grey dust off it, and the trees on its banks put out leaves that the player lays in prayer where body or heart
 * needs God ("Panie, Ty znasz to miejsce. Dotknij go."); at the end the figure floats and far downstream the dead sea
 * turns fresh.  Drawn from self-healing imagery and the "sweeping" of pranic practice, recast as washing and prayer:
 * the water and the leaves picture prayer; the game never says they heal.  The headline is the leaves (liście).
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers and the plan of the
 * way in rules.ts, the marks, places and passages in content.ts, the meta in meta.ts, the narrator in talk.ts), the
 * pictures (render.ts with layout.ts and paint.ts; preview.ts around play), the sound (audio.ts), the lobby's card
 * (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { breathCycle } from '../kit/breath';
import { coarsePointer } from '../kit/mobile';
import { breathDial, secDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { EzechielSound } from './audio';
import { placePoints, type PlaceId } from './content';
import { leavesText, stageName, t, unit } from './i18n';
import { figPt } from './layout';
import { bestOf, breathOf, freshProgress, migrate, type EzechielProgress } from './meta';
import { progressPanel } from './panel';
import { EzechielIntro, drawPreview } from './preview';
import { EzechielView } from './render';
import { RULES } from './rules';
import { EzechielSim, type Coach, type CoachAt, type SimEvent } from './sim';

class EzechielGame implements ArcadeGame {
  private readonly sim: EzechielSim;
  private readonly view: EzechielView;
  private readonly sound: EzechielSound;
  private readonly introScene = new EzechielIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<EzechielProgress>) {
    migrate(env.progress);
    this.sim = new EzechielSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, rhythm: env.rhythm });
    this.view = new EzechielView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new EzechielSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __ezechiel?: unknown }).__ezechiel = this.sim;
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

  /** A tap: a story card turns its page; ≡ opens the chooser; a chip chooses; the figure chooses its nearest place; elsewhere the words glow again. */
  pointer(e: PointerInput): void {
    if (!this.env.touch) this.mouseAt(e);
    if (e.type !== 'down') return;
    const sim = this.sim;
    const hit = this.view.hit(sim, e.x, e.y);
    let used = true;
    if (sim.story) used = sim.stay();
    else if (hit === 'list') used = sim.togglePicker();
    else if (hit === 'close' || hit === 'outside') sim.closePicker();
    else if (hit?.startsWith('chip:')) used = sim.choose(hit.slice(5) as PlaceId);
    else if (hit?.startsWith('figure:')) used = sim.choose(hit.slice(7) as PlaceId);
    else if (hit === null && sim.picker) used = false;
    else used = sim.stay();
    if (used && this.env.haptics) buzz(hit ? 8 : 5);
    this.drain();
  }

  /** A desktop's mouse (DESIGN §14): what a click would do answers (≡ brightens, a place shows its ring and name), and the cursor says so. */
  private mouseAt(e: PointerInput): void {
    this.view.hover(e.x, e.y);
    const hit = this.view.hit(this.sim, e.x, e.y);
    const active = !!hit && hit !== 'outside' && hit !== 'figure';
    this.env.canvas.style.cursor = active ? 'pointer' : '';
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

  /** The runner's coach mark, pointing at what it explains — never over a story card or the chooser, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.picker) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.blockT < RULES.bannerSec)) return;
    if (sim.talk.line) return;
    const h = this.hints.shift()!;
    const ms = h.what === 'breath' || h.what === 'blind' ? 5200 : 4800;
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(coachText(h.what, this.env.touch), this.pointFor(h.at), ms);
  }

  private pointFor(at: CoachAt): { x: number; y: number } | null {
    const L = this.view.L, sim = this.sim;
    switch (at) {
      case 'water': {
        const s = sim.step;
        const p = figPt(L, 0.12, s?.kind === 'rise' ? [0.985, 0.935, 0.752, 0.5, 0.3][Math.min(4, s.to)] : 0.3);
        return { x: p.x, y: p.y - 10 * L.u };
      }
      case 'figure': return { x: L.fig.cx, y: L.fig.top + 0.3 * L.fig.H };
      case 'list': return { x: L.list.x + L.list.w / 2, y: L.list.y - 6 };
      case 'trees': {
        const p = this.view.leafPos(sim.oldLeaves + sim.leaves);
        return p ? { x: p.x, y: p.y - 8 } : null;
      }
      default: {
        const [x, y] = placePoints('heart')[0];
        const p = figPt(L, x, y);
        return { x: p.x, y: p.y };
      }
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const nextOf = (k: string | null): SignalPhase['next'] => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    if (!s.started || s.phase !== 'play' || b.kind === 'warmup') {
      const left = s.phase === 'play' && b.kind === 'warmup' ? Math.max(0, b.dur - s.blockT) : undefined;
      return { want: 'free', blind: false, task: s.tip || undefined, left, next: s.started && s.phase === 'play' && s.telegraphed ? 'focus' : null };
    }
    const left = b.kind === 'rest' ? Math.max(0, b.dur - s.blockT) : undefined;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left,
      next: s.telegraphed ? nextOf(b.kind === 'push' ? 'rest' : (b.why === 'float' || b.last) ? null : 'push') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(6, best * 0.2)) return { value: s.score, sub: t('sub.best', { left: leavesText(left) }) };
    return { value: s.score, sub: stageName(s.stage) };
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

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (what === 'place' && !touch) return t('coach.place.keys');
  return t(`coach.${what}` as 'coach.rise');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'mark': buzz([10, 40, 18]); break;
    case 'lay': buzz([8, 30, 8]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone; a click and the keys on a desktop. */
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

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts, round 15): how long one step of the way lasts for an average player
 * (30 s by design, a 10-minute session's), and the whole breaths of the rest after it (2 of the player's pattern).
 * As designed, the way keeps its curves for the session's length (21 s steps in 3 minutes, 36 s in 30).
 */
export function ezechielRhythm(p?: EzechielProgress): RhythmSpec {
  const cyc = breathCycle(breathOf(p ? migrate(p) : freshProgress()));
  return {
    focus: secDial(RULES.focusDef, t('rhythm.focus'), { min: RULES.focusMin, max: RULES.focusMax, step: 5 }),
    rest: breathDial(RULES.restDef, t('rhythm.rest'), cyc, { min: 1, max: RULES.restBreathsMax }),
    note: t('rhythm.note'),
    focusSec: n => n,
    restSec: n => n * cyc,
  };
}

const mod: ArcadeModule<EzechielProgress> = {
  freshProgress,
  create: env => new EzechielGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => ezechielRhythm(p),
  // the breath guide is the game's own (render.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
