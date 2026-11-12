/**
 * Odnowa (Renewal): the series "Weź moc, obudź się", rooted in 2 Corinthians 4:16 — "our inner self is being
 * renewed day by day".  Inside one stem cell the player runs and repairs the cell's machine: the ATP synthase
 * turns in the engine lens (8 protons a turn, 3 ATP a turn: the headline), damage glows on the double helix
 * and a tap sends the real repair crew, and in the calm the cell recycles its worn parts (autophagy).  Energy,
 * building material and a checked genome make a division: one daughter stays a stem cell, the other joins
 * the player's tissue — gut lining, skin or blood — which grows from session to session.
 *
 * The band: in a sighted push the gauge is the proton gradient (the turbine speeds up, the crews work faster,
 * a held focus charges Pełna moc); in a rest calm wraps the worn parts; a blind push hides the gauge and pays
 * its share at the end.  Without a signal everything runs at its neutral pace.  Mito, a cheerful nerdy
 * mitochondrion, talks; the song (song.ts) fills with focus.  A visualisation and attention training — never
 * a treatment.
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
import { inRect, laneU, onLane, onLens, tapTargets } from './layout';
import { bestOf, freshProgress, migrate, type OdnowaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { OdnowaView } from './render';
import { OdnowaSim, type Coach, type CoachAt, type SimEvent } from './sim';

/** a finger that moves farther than this (px) drags; less is a tap */
const TAP_PX = 10;

class OdnowaGame implements ArcadeGame {
  private readonly sim: OdnowaSim;
  private readonly view: OdnowaView;
  private readonly sound: OdnowaSound;
  private readonly introScene = new OdnowaIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  /** the one finger the game follows, and an autophagosome it holds */
  private finger: number | null = null;
  private press: { x: number; y: number; part: number; moved: boolean } | null = null;
  /** first-time explanations waiting for a clear screen (one at a time, a few seconds apart) */
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 2;
  private songDone = false;

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
    this.sim = new OdnowaSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, niche });
    this.view = new OdnowaView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new OdnowaSound(env.audio, env.progress.song);
    this.ctx = env.canvas.getContext('2d');
    if (debug) (globalThis as { __odnowa?: unknown }).__odnowa = this.sim;
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
    this.hintCool -= dt;
    this.flushHints();
    if (this.sim.phase === 'done' && !this.songDone) {
      this.songDone = true;
      this.sound.stop();
    }
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A press answers at once (on touch-down): on the story card it begins; on the turbine it releases the full
   * power or nudges it one proton on; on Mito he tells a fact; on an autophagosome it picks it up (a tap sends
   * it to its lysosome, a drag carries it — drawn above the finger — to the one it is dropped on); on the lane
   * the crew goes to the nearest damage; anywhere else in the cell to the most urgent one.
   */
  pointer(e: PointerInput): void {
    const s = this.sim, v = this.view, L = v.L;
    const lift = this.env.touch ? Math.round(52 * L.u) : 0;
    if (e.type === 'down') {
      if (this.finger !== null && this.finger !== e.id) this.letGo();
      this.finger = e.id;
      if (s.story) {
        s.tap();
        return;
      }
      if (s.phase === 'done') return;
      if (onLens(L, e.x, e.y)) {
        v.pressLens();
        s.tapTurbine();
      } else if (inRect(L.mitoHit, e.x, e.y)) {
        s.talk.ask('fact', 2, 3);
      } else {
        const part = v.partAt(s, e.x, e.y);
        if (part !== null) {
          this.press = { x: e.x, y: e.y, part, moved: false };
          s.holdPart(part, true);
          v.drag = { id: part, x: e.x, y: e.y };
        } else if (onLane(L, e.x, e.y)) {
          if (!s.tapLane(laneU(L, e.x))) v.ripple(e.x, e.y);
        } else if (!s.repairNext()) v.ripple(e.x, e.y);
      }
      this.drain();
      return;
    }
    if (e.id !== this.finger) return;
    const pr = this.press;
    if (e.type === 'move') {
      if (pr) {
        if (!pr.moved && Math.hypot(e.x - pr.x, e.y - pr.y) >= TAP_PX) pr.moved = true;
        if (pr.moved) v.drag = { id: pr.part, x: e.x, y: e.y - lift };
      }
      return;
    }
    // up
    if (pr) {
      this.press = null;
      v.drag = null;
      if (!pr.moved) s.sendPart(pr.part);
      else {
        const ly = v.lysoAt(s, e.x, e.y - lift);
        if (ly >= 0) s.dropPart(pr.part, ly);
        else s.holdPart(pr.part, false);
      }
      this.drain();
    }
    this.finger = null;
  }

  private letGo(): void {
    if (this.press) this.sim.holdPart(this.press.part, false);
    this.press = null;
    this.view.drag = null;
    this.finger = null;
  }

  /** Space and Enter: close the card, take a ready full power, mend the most urgent lesion, or nudge the turbine. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down) {
      if (this.sim.ready || this.sim.surge > 0) this.view.pressLens();
      this.drain();
    }
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.letGo();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
    }
  }

  /** One coach mark at a time, never over the story card, a few seconds apart. */
  private flushHints(): void {
    if (this.sim.story || this.hintCool > 0 || !this.hints.length) return;
    const h = this.hints.shift()!;
    this.env.hint(coachText(h.what, this.env.touch), this.view.anchor(h.at, this.sim), 4200);
    this.hintCool = 4.6;
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
    if (s.surge > 0) return { value: s.atp, sub: t('hud.subSurge') };
    if (s.mitosis) return { value: s.atp, sub: t('hud.subDivide') };
    if (s.checkpoint) return { value: s.atp, sub: t('hud.subCheck') };
    const best = bestOf(s.p);
    const left = best !== null ? best - s.atp : 0;
    if (best !== null && left > 0 && left <= Math.max(40, best * 0.2)) return { value: s.atp, sub: t('hud.subBest', { left }) };
    return { value: s.atp, sub: t('hud.sub', { n: s.stage, p: Math.round(s.progress * 100) }) };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** The turbine and Mito (or the story card while it is up), for the mobile audit. */
  targets(): TapTarget[] {
    return tapTargets(this.view.L, { card: !!this.sim.story, started: this.sim.started });
  }

  destroy(): void {
    this.letGo();
    this.sound.stop();
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys, a keyboard may. */
export function coachText(what: Coach, touch: boolean): string {
  if (!touch && (what === 'lane' || what === 'surge')) return t(`coach.${what}.keys` as Key);
  return t(`coach.${what}` as Key);
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'repairStart': if (e.by === 'tap') buzz(e.combo >= 4 ? [6, 18, 8] : 8); break;
    case 'kick': buzz(4); break;
    case 'surge': buzz([30, 40, 60]); break;
    case 'ready': buzz(20); break;
    case 'spawn': if (e.kind === 'dsb') buzz(30); break;
    case 'cell': buzz([20, 40, 20, 40, 60]); break;
    case 'fuse': if (e.sent) buzz(12); break;
    case 'up': buzz([12, 30, 12]); break;
    default: break;
  }
}

/** How to play, for the hand the player has: taps on a phone, the keys too on a desktop. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('how.goal'),
    hands: touch
      ? [{ gesture: 'tap', text: t('how.tap') }, { gesture: 'tap', text: t('how.turbine') }, { gesture: 'drag', text: t('how.drag') }]
      : [{ gesture: 'tap', text: t('how.tap') }, { gesture: 'tap', text: t('how.turbine') }, { gesture: 'keys', text: t('how.keys') }],
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
