/**
 * Ogień, ogień, ogień (Fire, Fire, Fire): a visualisation game after the founder's idea of 2026-11-12 —
 * "spark → candle → bonfire → ??? → a star → a mega star → Holy Spirit: concentration charges the successive
 * pictures, which light up, gain energy and grow; past a threshold they turn into something of a higher scale;
 * the charging goes with growing concentration".  Rooted in 2 Timothy 1:6, "fan into flame the gift of God".
 *
 * Focus charges the fire's ring (faster the higher the signal); a full ring is the change into the next, bigger
 * fire, with a "Powers of Ten" zoom-out, its name and its verse.  Rest banks light that rekindles the next push
 * and the flame breathes 4 in / 6 out.  The hands have one small task per scale.  The last fire is Pentecost:
 * the Spirit sent down as tongues of fire, a gift that meets the player's fire (DESIGN §13.4, §13.6).  Ignacy,
 * an old lamplighter, wonders at every scale.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in rules.ts,
 * the data in content.ts, the meta in meta.ts, Ignacy's bubble in talk.ts), the pictures (render.ts with
 * layout.ts, scenes.ts and paint.ts, intro.ts for calibration, preview.ts for the lobby), the sound (audio.ts)
 * and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz, clamp } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { OgienSound } from './audio';
import { rungShort } from './content';
import { sparksText, t, unit } from './i18n';
import { OgienIntro } from './intro';
import { tapTargets } from './layout';
import { bestFor, bestOf, freshProgress, migrate, type OgienProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { OgienView } from './render';
import { RULES } from './rules';
import { OgienSim, type Coach, type CoachAt, type SimEvent } from './sim';

/** a finger that moves farther than this (px) drags; less is a tap */
const TAP_PX = 10;

class OgienGame implements ArcadeGame {
  private readonly sim: OgienSim;
  private readonly view: OgienView;
  private readonly sound: OgienSound;
  private readonly introScene = new OgienIntro();
  private ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  /** the one finger the game follows: a new one takes over from a finger that went astray */
  private finger: number | null = null;
  private gathering = false;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 2;
  private readonly bestNow: number | null;

  constructor(private readonly env: GameEnv<OgienProgress>) {
    migrate(env.progress);
    this.bestNow = bestFor(env.progress, env.plannedSec);
    this.sim = new OgienSim({ progress: env.progress, rng: env.rng, day: env.day, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning });
    this.view = new OgienView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new OgienSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __ogien?: unknown }).__ogien = this.sim;
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
    this.introScene.draw(ctx, this.w, this.h, this.dpr, dt, p, this.env.progress);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.sound.start(this.sim.rung);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  /** Before play the runner's intro() has painted the calibration scene this frame; after it, the fire. */
  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  private units(x: number, y: number): { x: number; y: number } {
    const L = this.view.L;
    return { x: (x - L.cx) / L.R, y: (y - L.cy) / L.R };
  }

  /**
   * A press on a card closes it; on the button, the scale's task on its best target (held at the candle, it
   * shelters); on the pile, a log picked up (drag it onto the fire — it floats above the finger; a tap throws
   * it on); on the scene, the task there: blow, shelter (hold), poke the bonfire, light the tent, fuse the pair,
   * pull the gas (drag to gather), pass the flame on.  Every press shows on touch-down.  One finger at a time.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      if (this.finger !== null && this.finger !== e.id) this.letGo();
      this.finger = e.id;
      const hit = view.hit(e.x, e.y, sim);
      switch (hit.kind) {
        case 'card':
          sim.closeCard();
          break;
        case 'btn':
          view.pressButton();
          if (sim.task === 'shield') sim.holdStart();
          sim.tap(null);
          break;
        case 'pile':
          if (sim.pickLog()) {
            const lift = this.env.touch ? clamp(view.L.R * 0.5, 48, 80) : 12;
            view.drag = { x: e.x, y: e.y, lift, moved: false, sx: e.x, sy: e.y };
            if (this.env.haptics) buzz(8);
          } else sim.tap(null);
          break;
        case 'field': {
          const u = { x: hit.x, y: hit.y };
          if (sim.task === 'shield') sim.holdStart();
          if (sim.task === 'gather') {
            this.gathering = true;
            view.trailAt(e.x, e.y);
          }
          sim.tap(u);
          break;
        }
      }
      this.drain();
      return;
    }
    if (e.id !== this.finger) return;
    if (e.type === 'move') {
      const d = view.drag;
      if (d) {
        d.x = e.x;
        d.y = e.y;
        if (!d.moved && Math.hypot(e.x - d.sx, e.y - d.sy) > TAP_PX) d.moved = true;
      } else if (this.gathering) {
        view.trailAt(e.x, e.y);
        if (sim.drag(this.units(e.x, e.y)) > 0 && this.env.haptics) buzz(5);
      }
      return;
    }
    this.release();
    this.drain();
  }

  /** The finger lifted: a log lands (on the fire it burns, elsewhere it goes back), the shelter ends. */
  private release(): void {
    const sim = this.sim, view = this.view;
    const d = view.drag;
    if (d) {
      const L = view.L;
      const onFire = !d.moved || Math.hypot(d.x - L.cx, d.y - d.lift - (L.cy + L.R * 0.2)) < L.R * 0.75;
      sim.dropLog(onFire);
      view.drag = null;
    }
    sim.holdEnd();
    this.gathering = false;
    this.finger = null;
  }

  /** Whatever the finger held is let go (a log goes back to the pile). */
  private letGo(): void {
    if (this.view.drag) {
      this.sim.dropLog(false);
      this.view.drag = null;
    }
    this.sim.holdEnd();
    this.gathering = false;
    this.finger = null;
  }

  /** Space and Enter: close a card, else the scale's task (held at the candle, it shelters). */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) this.view.pressButton();
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.letGo();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e, this.sim);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (e.type === 'card') this.env.hint('');
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at the thing it explains — never over a card or the change. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.card || this.view.changing || this.view.drag) return;
    for (let i = 0; i < this.hints.length; i++) {
      const h = this.hints[i];
      const v = this.hintNow(h.what);
      if (v === 'drop') { this.hints.splice(i--, 1); continue; }
      if (v === 'wait') continue;
      this.hints.splice(i, 1);
      const ms = h.what === 'ring' || h.what === 'rest' ? 5600 : 4400;
      this.hintCool = ms / 1000 + 1;
      this.env.hint(coachText(h.what, this.env.touch), this.view.pointFor(h.at), ms);
      this.sim.quietUntil = this.sim.t + ms / 1000;
      if (h.at?.kind === 'button') this.view.coachGlow(h.at, ms);
      return;
    }
  }

  /** Whether a first-time explanation fits the moment: show it, let it wait, or drop it. */
  private hintNow(what: Coach): 'show' | 'wait' | 'drop' {
    const s = this.sim;
    if (s.talkBlocked && s.phase === 'play' && s.block.kind !== 'warmup' && s.blockT < RULES.bannerSec) return 'wait';
    switch (what) {
      case 'ring': return s.sighted ? 'show' : 'drop';
      case 'rest':
      case 'breath': return s.restBlock ? 'show' : 'drop';
      case 'blind': return s.blind ? 'show' : 'drop';
      case 'shield': return s.task === 'shield' && s.gust.phase !== 'wait' ? 'show' : 'drop';
      case 'feed': return s.task === 'feed' ? (s.handsOn ? 'show' : 'wait') : 'drop';
      case 'tents': return s.task === 'tents' ? (s.handsOn ? 'show' : 'wait') : 'drop';
      case 'fuse': return s.task === 'fuse' ? (s.handsOn ? 'show' : 'wait') : 'drop';
      case 'gather': return s.task === 'gather' ? (s.handsOn ? 'show' : 'wait') : 'drop';
      case 'pass': return s.task === 'pass' ? (s.handsOn ? 'show' : 'wait') : 'drop';
      case 'light': return s.pushBlock ? 'show' : 'drop';
      default: return 'show';
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left: s.started && s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim, value = Math.floor(s.sparks);
    const rung = rungShort(s.rung);
    const best = this.bestNow;
    if (best !== null && value < best && best - value <= Math.max(40, best * 0.2)) return { value, sub: t('hud.subBest', { rung, left: sparksText(best - value) }) };
    if (s.cycle > 0) return { value, sub: t('hud.subCycle', { rung, n: s.cycle + 1 }) };
    return { value, sub: t('hud.sub', { rung, pct: t('pct', { n: Math.round(clamp(s.ring) * 100) }) }) };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** Every control the player can tap now (as `hit` tests them), for the mobile audit. */
  targets(): TapTarget[] {
    const s = this.sim, v = this.view;
    if (!s.started) return [];
    return tapTargets(v.L, { card: v.cardShown(s) && v.cardBox ? v.cardBox : null, pile: s.task === 'feed' && s.handsOn });
  }

  destroy(): void {
    this.letGo();
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (!touch && (what === 'blow' || what === 'shield' || what === 'gather')) return t(`coach.${what}.keys` as 'coach.blow.keys');
  return t(`coach.${what}` as 'coach.blow');
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'task': buzz(e.kind === 'feed' || e.kind === 'shield' || e.kind === 'pass' ? 14 : 6); break;
    case 'change': buzz([20, 50, 30, 50, 80]); break;
    case 'gust': if (e.shielded) buzz(12); break;
    case 'near': buzz(10); break;
    case 'bonus': buzz([10, 30, 10]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: tap, hold and drag on a phone; the keys as a desktop's shortcut. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: touch
      ? [{ gesture: 'tap', text: t('howto.tap') }, { gesture: 'hold', text: t('howto.hold') }, { gesture: 'drag', text: t('howto.drag') }]
      : [{ gesture: 'tap', text: t('howto.tap') }, { gesture: 'drag', text: t('howto.drag') }, { gesture: 'keys', text: t('howto.keys') }],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<OgienProgress> = {
  freshProgress,
  create: env => new OgienGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: p => progressPanel(migrate(p)),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;
