/**
 * Odnowa (Renewal): the series "Weź moc, obudź się", rooted in 2 Corinthians 4:16 — "our inner self is being
 * renewed day by day".  Help one stem cell renew itself and divide: it needs three things, each from one source —
 * **Energia** from the player's focus (the ATP synthase turns in the engine lens only while they are focused; ATP
 * is the headline), **Naprawa DNA** from their taps (damage glows on the double helix, a tap sends the real repair
 * crew), **Budulec** from rest (calm wraps worn parts, the lysosomes digest them into building material).  All
 * three full → the cell divides; one daughter stays a stem cell, the other joins the player's tissue — gut lining,
 * skin or blood — which grows from session to session.
 *
 * Round 11 (the founder: "nie rozumiem kompletnie co robię"): the goal and its three bars always on screen, a
 * persistent "what to do now" line, the systems shown one at a time with coach marks that stay until the thing
 * is done, plain words first; the full power, the turbine nudge, two-tap repairs, the streak, the gate and the
 * drag of autophagosomes went (DESIGN §13.12).  A visualisation and attention training — never a treatment.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, rules.ts, content.ts,
 * meta.ts, talk.ts), the pictures (render.ts with layout.ts and paint.ts, intro.ts for calibration, preview.ts
 * for the lobby), the sound (audio.ts, song.ts), the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { OdnowaSound } from './audio';
import { NICHES, type NicheId } from './content';
import { t, unit, type Key } from './i18n';
import { OdnowaIntro } from './intro';
import { inRect, laneU, onLane, tapTargets } from './layout';
import { bestOf, freshProgress, migrate, type OdnowaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { OdnowaView } from './render';
import { RULES, readSec } from './rules';
import { OdnowaSim, type Coach, type CoachAt, type SimEvent } from './sim';

/** The coach marks that stay until the player has done the thing (the sim's `coachDone`), and how long at most (s). */
const KEEP: Partial<Record<Coach, number>> = { turbine: 20, lane: 30, rest: 20, check: 20 };
/** The marks that belong in a rest (the others are about the push and wait for one — or are dropped). */
const STAY_IN_REST: ReadonlySet<Coach> = new Set<Coach>(['rest', 'divide', 'check']);
/** The small marks of a moment: past it (another block, or 20 s later) they are dropped. */
const STALE: ReadonlySet<Coach> = new Set<Coach>(['energy', 'repair', 'ring', 'blind']);

class OdnowaGame implements ArcadeGame {
  private readonly sim: OdnowaSim;
  private readonly view: OdnowaView;
  private readonly sound: OdnowaSound;
  private readonly introScene = new OdnowaIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  /** first-time explanations waiting for a clear screen (one at a time), and the one on screen */
  private readonly hints: { what: Coach; at: CoachAt; t: number; block: number }[] = [];
  private clock = 0;
  private hintNow: { what: Coach; t: number; min: number; max: number } | null = null;
  private hintCool = 1.2;
  private songDone = false;
  /** the mouse's cursor as last set (a desk: a hand on what a click acts on) */
  private cursor = '';
  /** the mouse left the canvas: no hover */
  private readonly leave = (): void => { this.view.hover = null; this.setCursor('default'); };

  constructor(private readonly env: GameEnv<OdnowaProgress>) {
    migrate(env.progress);
    // the screenshot scripts may visit a niche or a grown cell: ?debug&odnowaNiche=skin&odnowaAtp=12000 (never in normal play)
    const debug = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search);
    let niche: NicheId | undefined;
    if (debug) {
      const n = location.search.match(/[?&]odnowaNiche=(\w+)/)?.[1];
      if (n && (NICHES as readonly string[]).includes(n)) niche = n as NicheId;
      const atp = location.search.match(/[?&]odnowaAtp=(\d+)/)?.[1];
      if (atp) env.progress.atpTotal = Number(atp);
    }
    this.sim = new OdnowaSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, niche, mouse: !env.touch });
    this.view = new OdnowaView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new OdnowaSound(env.audio, env.progress.song);
    this.ctx = env.canvas.getContext('2d');
    if (!env.touch) env.canvas.addEventListener?.('pointerleave', this.leave);
    if (debug) {
      (globalThis as { __odnowa?: unknown }).__odnowa = this.sim;
      (globalThis as { __odnowaView?: unknown }).__odnowaView = this.view;
    }
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

  /** The HUD's band is read again at the start: the runner shows its panel only when play begins. */
  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.view.start(this.sim);
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.clock = t;
    this.sim.holdTalk = this.view.toastUp;
    this.sim.update(dt, f, t);
    this.drain();
    this.sound.level(this.sim.songLevel(f));
    this.sound.update(dt);
    this.view.beat = this.sound.beat;
    const p = this.env.progress;
    const line = p.song && p.lyrics ? this.sound.line() : null;
    this.view.lyric = line ? { text: line.text, p: line.p } : null;
    this.view.update(dt, this.sim);
    this.flushHints(dt);
    if (this.sim.phase === 'done' && !this.songDone) {
      this.songDone = true;
      this.sound.stop();
    }
    if (this.view.hover) this.setCursor(this.view.cursor(this.sim));
  }

  private setCursor(c: string): void {
    if (c === this.cursor) return;
    this.cursor = c;
    if (this.env.canvas.style) this.env.canvas.style.cursor = c;
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A press answers at once (on touch-down): on the story card it begins; on Mito he says what to do now; anywhere
   * else in the cell the repair crew goes — on the lane to the nearest damage, elsewhere to the damage that has
   * waited longest (generous: never a precision tap).  A tap with nothing to mend ripples.
   */
  pointer(e: PointerInput): void {
    const s = this.sim, v = this.view, L = v.L;
    if (!this.env.touch) {
      const was = v.hover;
      if (!was || Math.hypot(was.x - e.x, was.y - e.y) > 2) v.hoverAge = 0;
      v.hover = { x: e.x, y: e.y };
    }
    if (e.type !== 'down') return;
    if (s.story) {
      s.tap();
      return;
    }
    if (s.phase === 'done') return;
    if (inRect(L.mitoHit, e.x, e.y)) s.askHelp();
    else if (!s.tapAt(onLane(L, e.x, e.y) ? laneU(L, e.x) : null)) v.ripple(e.x, e.y);
    this.drain();
  }

  /** Space and Enter: close the card, or mend the damage that has waited longest. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) this.drain();
    return used;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at, t: this.clock, block: this.sim.blockIndex });
    }
  }

  /**
   * One coach mark at a time, never over the story card nor a block's banner, after Mito's line: each stays its
   * reading time (≥ 2.5 s + 70 ms a character); the key ones (the turbine, the damage, the rest) stay until the
   * player has done the thing.  While one is up Mito waits, and the first tap's gesture is drawn on the damage.
   */
  private flushHints(dt: number): void {
    const s = this.sim;
    s.hintQueued = this.hints.length > 0;
    const cur = this.hintNow;
    if (cur) {
      cur.t += dt;
      const done = s.coachDone(cur.what);
      if ((done && cur.t >= cur.min) || cur.t >= cur.max || s.phase === 'done' || s.story) {
        if (cur.t < cur.max) this.env.hint('');
        this.hintNow = null;
        this.hintCool = 1.4;
        this.view.hand = false;
        s.hintUp = false;
      }
      return;
    }
    this.hintCool -= dt;
    if (!this.hints.length || this.hintCool > 0 || s.story || s.cellCard) return;
    const b = s.block;
    if (s.phase === 'play' && b && b.kind !== 'warmup' && (s.telegraphed || s.blockT < RULES.bannerSec)) return;
    // the narrator finishes his line first (never two voices at once)
    if (s.talk.line) return;
    // a prompt to act (the first damage, the checkpoint) goes before an explanation that waits
    const urgent = this.hints.findIndex(x => x.what === 'lane' || x.what === 'check');
    const h = this.hints.splice(urgent > 0 ? urgent : 0, 1)[0];
    const keep = KEEP[h.what];
    // a prompt whose thing is already done is not shown at all (the explanations still are: the turbine's name, the
    // rest's); a mark about the push is never shown in a rest, nor a small one that waited past its moment
    if ((h.what === 'lane' || h.what === 'check') && s.coachDone(h.what)) return;
    if (!STAY_IN_REST.has(h.what) && s.restBlock) return;
    if (STALE.has(h.what) && (s.blockIndex !== h.block || this.clock - h.t > 20)) return;
    const text = coachText(h.what, this.env.touch);
    const min = readSec(text), max = keep ? Math.max(keep, min) : min;
    this.env.hint(text, this.view.anchor(h.at, s), Math.round(max * 1000));
    this.hintNow = { what: h.what, t: 0, min, max };
    this.view.hand = h.what === 'lane';
    s.hintUp = true;
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b?.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left: b && s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const p = Math.round(s.progress * 100);
    if (s.blind) return { value: s.atp, sub: t('hud.subBlind') };
    if (s.mitosis) return { value: s.atp, sub: t('hud.subDivide') };
    if (s.checkpoint) return { value: s.atp, sub: t('hud.subCheck') };
    const best = bestOf(s.p);
    const left = best !== null ? best - s.atp : 0;
    if (best !== null && left > 0 && left <= Math.max(40, best * 0.2)) return { value: s.atp, sub: t('hud.subBest', { left }) };
    return { value: s.atp, sub: s.divisionsNow > 0 ? t('hud.subCells', { n: s.divisionsNow, p }) : t('hud.sub', { p }) };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** Mito (or the story card while it is up), for the mobile audit. */
  targets(): TapTarget[] {
    return tapTargets(this.view.L, { card: !!this.sim.story, started: this.sim.started });
  }

  destroy(): void {
    this.sound.stop();
    this.env.hint('');
    this.env.canvas.removeEventListener?.('pointerleave', this.leave);
    if (this.env.canvas.style) this.env.canvas.style.cursor = '';
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a mouse clicks (and has keys). */
export function coachText(what: Coach, touch: boolean): string {
  if (!touch && what === 'lane') return t('coach.lane.keys');
  return t(`coach.${what}` as Key);
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'repairStart': if (e.by === 'tap') buzz(8); break;
    case 'gold': buzz(20); break;
    case 'spawn': if (e.kind === 'dsb') buzz(30); break;
    case 'full': buzz([10, 30, 14]); break;
    case 'cell': buzz([20, 40, 20, 40, 60]); break;
    case 'up': buzz([12, 30, 12]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone, clicks and Space on a desktop. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('how.goal'),
    hands: touch
      ? [{ gesture: 'tap', text: t('how.tap') }, { gesture: 'tap', text: t('how.mito') }]
      : [{ gesture: 'tap', text: t('how.tap.mouse') }, { gesture: 'tap', text: t('how.mito.mouse') }, { gesture: 'keys', text: t('how.keys') }],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<OdnowaProgress> = {
  freshProgress,
  create: env => new OdnowaGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;
