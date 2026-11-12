/**
 * Pasterz (the shepherd): Crowd City on the Judean hills, after Luke 15:4-6.  After a spring storm
 * the village's sheep are scattered over the hills; the shepherd and five rival shepherd kids race
 * to gather the most.  Drag anywhere to walk (a floating joystick, shown under the thumb from the
 * touch-down; arrows and WASD too); left alone, Łatek the sheepdog leads the shepherd to the nearest
 * loose sheep; Łatek's button in the thumb zone, a tap anywhere, Space or Enter whistles and Łatek
 * herds the sheep he reaches.  Loose sheep join whatever flock touches them, and where two
 * flocks meet the bigger wins the smaller one's sheep at the contact; a rival left alone sulks till
 * the round ends.  Rounds of two days and two nights on one hill, a live ranking, a crown for the
 * first, a lost lamb far away worth ten.  The band: in a Wołanie the call ring's radius is the
 * focus (a dotted circle marks the threshold, gold beyond it) and pulls loose sheep in, a held focus
 * sends the Głos across the hill; in a Nocna straż every flock beds down and calm lights stars, each
 * a straggler Łatek fetches.  The shepherd is the parable's man, not a picture of Christ.
 *
 * This module wires the parts to the arcade runner (kit/types.ts) and feeds its standard HUD
 * (signal, meter, headline, howto, coach marks): the rules (sim.ts on the hill of world.ts, the
 * numbers in rules.ts, the data in content.ts, the meta in meta.ts, Łatek's bubble in talk.ts),
 * the pictures (render.ts with ground.ts, hud.ts and layout.ts, intro.ts for calibration,
 * preview.ts for the lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's card
 * (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz, clamp } from '../kit/juice';
import { hits } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { PasterzSound } from './audio';
import { hand, t, unit, type HandKey } from './i18n';
import { bestOf, freshProgress, type PasterzProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { PasterzView } from './render';
import { RULES } from './rules';
import { PasterzSim, type BlockKind, type SimEvent } from './sim';

const want = (k: BlockKind | undefined): 'focus' | 'rest' | 'free' => (k === 'call' ? 'focus' : k === 'watch' ? 'rest' : 'free');

/**
 * A finger on the screen: on Łatek's button (pressed at once, a whistle on the lift; a thumb that slides off
 * steers instead) or on the field (the floating joystick from the touch-down; a short tap whistles).
 * `ox`/`oy` is the joystick's base (it trails a finger that runs past its rim), `far` the farthest the finger
 * went from where it came down.
 */
interface Press { id: number; kind: 'button' | 'field'; x0: number; y0: number; ox: number; oy: number; at: number; far: number }

class PasterzGame implements ArcadeGame {
  private readonly sim: PasterzSim;
  private readonly view: PasterzView;
  private readonly sound: PasterzSound;
  private press: Press | null = null;
  private now = 0;

  constructor(private readonly env: GameEnv<PasterzProgress>) {
    this.sim = new PasterzSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new PasterzView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new PasterzSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __pasterz?: unknown }).__pasterz = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.insets()); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.setInsets(this.env.insets());
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now += dt;
    if (!this.view.hitStop(dt)) {
      this.sim.update(dt, f, t);
      this.drain();
    }
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  /** (The runner also draws during calibration, after intro(): the intro scene stays until play begins.) */
  draw(): void { if (this.sim.started) this.view.draw(this.sim); }

  /** Łatek's button while it is on screen (the field itself is the joystick). */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  /**
   * A press.  On Łatek's button: pressed at once, a whistle on the lift (a thumb that slides off steers from
   * there).  Anywhere else: the floating joystick, shown under the finger from the touch-down — a drag
   * steers, a short tap whistles.  One finger plays; a second waits.
   */
  pointer(e: PointerInput): void {
    const view = this.view, hud = view.hud;
    if (e.type === 'down') {
      if (this.press) return;
      const onButton = hud.whistleLive(this.sim) && hits(view.L.whistle.hit, e.x, e.y);
      this.press = { id: e.id, kind: onButton ? 'button' : 'field', x0: e.x, y0: e.y, ox: e.x, oy: e.y, at: this.now, far: 0 };
      if (onButton) {
        hud.pressed = true;
        if (this.env.haptics) buzz(6);
        return;
      }
      this.sim.drag(0, 0);
      view.stick = { ox: e.x, oy: e.y, x: e.x, y: e.y, on: false };
      return;
    }
    const pr = this.press;
    if (!pr || pr.id !== e.id) return;
    pr.far = Math.max(pr.far, Math.hypot(e.x - pr.x0, e.y - pr.y0));
    const tap = pr.far < RULES.deadPx && this.now - pr.at <= RULES.tapSec + 0.25;
    if (pr.kind === 'button') {
      if (e.type === 'up') {
        this.press = null;
        hud.pressed = false;
        if (pr.far < RULES.deadPx) this.whistle();
        return;
      }
      if (pr.far >= RULES.deadPx) {
        // the thumb slid off the button: from here it steers, as if it had come down on the field
        hud.pressed = false;
        pr.kind = 'field';
        pr.at = -99;
        this.steer(pr, e);
      }
      return;
    }
    if (e.type === 'up') {
      this.press = null;
      view.stick = null;
      this.sim.drag(null);
      if (tap) this.whistle();
      return;
    }
    this.steer(pr, e);
  }

  /** The joystick follows the finger: past 1.4 × its rim the base is dragged along (it never falls behind). */
  private steer(pr: Press, e: PointerInput): void {
    const R = RULES.stickPx;
    let dx = e.x - pr.ox, dy = e.y - pr.oy;
    const d = Math.hypot(dx, dy);
    if (d > R * 1.4) {
      const k = (d - R * 1.4) / d;
      pr.ox += dx * k;
      pr.oy += dy * k;
      dx = e.x - pr.ox;
      dy = e.y - pr.oy;
    }
    const on = pr.far >= RULES.deadPx;
    this.sim.drag(on ? dx : 0, on ? dy : 0);
    this.view.stick = { ox: pr.ox, oy: pr.oy, x: e.x, y: e.y, on };
  }

  /** A whistle for Łatek (the button, a tap on the field): too soon, and the button shakes. */
  private whistle(): void {
    const sim = this.sim;
    if (sim.whistleCool > 0 && !sim.asleep && !sim.frozen) {
      this.view.hud.notReady();
      if (this.env.haptics) buzz(4);
      return;
    }
    sim.whistle();
    this.drain();
  }

  /** Arrows and WASD walk, Space and Enter whistle. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.press = null;
      this.view.stick = null;
      this.view.hud.pressed = false;
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'hint') this.hint(e);
      if (this.env.haptics) haptic(e);
    }
  }

  /**
   * A coach mark pointing at the thing, in the words of the hand the player has (a finger: no keys).  The
   * point stays low enough in the field for the bubble above it to clear the runner's HUD; the whistle's
   * points at Łatek's button on a touch screen.
   */
  private hint(e: Extract<SimEvent, { type: 'hint' }>): void {
    const view = this.view, L = view.L, u = L.u;
    let at: { x: number; y: number };
    if (e.key === 'whistle' && this.env.touch && view.hud.whistleOn(this.sim)) at = { x: L.whistle.x, y: L.whistle.hit.y };
    else {
      const p = view.toScreen(e.x, e.y);
      at = { x: clamp(p.x, L.left + 24, L.right - 24), y: clamp(p.y, L.field.top + 96 * u, L.field.bottom - 10) };
    }
    this.env.hint(hand(`hint.${e.key}` as HandKey, this.env.touch), at, 4300);
    // Łatek's bubble steps aside for the coach mark (both would speak over the same spot), and so does the
    // ranking when the mark's bubble comes up over the top band
    this.sim.hushUntil = this.sim.t + 4.3;
    if (at.y < L.rank.y + L.rank.h + 110 * u) view.hud.quietRankUntil = this.sim.t + 4.3;
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b) return { want: 'free', blind: false };
    const left = Math.max(0, b.dur - s.blockT);
    const next = s.telegraphing ? want(s.nextBlock?.kind) : null;
    if (b.kind === 'warmup') return { want: 'free', blind: false, left, next };
    return { want: want(b.kind), blind: s.blind, task: s.tip, left, next };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    let sub: string;
    if (s.frozen || s.phase !== 'play') sub = t('sub.tally');
    else if (s.nightBlock) sub = t('sub.night', { n: s.stars });
    else sub = t('sub.place', { n: s.place, of: s.shepherds.length });
    return { value: s.score, sub };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'herd': buzz(10); break;
    case 'steal': if (e.to === 0) buzz(4); break;
    case 'out': if (e.by === 0) buzz([20, 40, 30]); break;
    case 'tumble': buzz([30, 50, 30]); break;
    case 'voice': buzz([12, 30, 12, 30, 18]); break;
    case 'lambFound': buzz([20, 40, 20]); break;
    case 'crown': if (e.who === 0) buzz([10, 30, 10, 30, 24]); break;
    case 'roundEnd': buzz([10, 30, 10, 30, 24]); break;
    default: break;
  }
}

/** How to play: the drag and the tap in words for a finger; the keys on a row of their own (dropped on a touch screen). */
export function howto(): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      { gesture: 'drag', text: t('how.drag') },
      { gesture: 'tap', text: t('how.tap') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<PasterzProgress> = {
  freshProgress,
  create: env => new PasterzGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto,
};
export default mod;
