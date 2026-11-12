/**
 * Nehemiasz: the wall of Jerusalem rebuilt in 52 days (Nehemiah 6:15), a build-and-defend game after
 * Lordrush (Century Games) and the genre its ads come from (Thronefall, Kingshot).  By day — a rest
 * block — Nehemiah walks the city and stands on the markers to build the wall's tiers, the gate,
 * watchtowers, fires, guard posts and the city's houses, bakery, well and stores; the builders lay
 * the wall course by course in a rhythm that calm sets (the headline: cubits raised).  By night — a
 * push block — raiders of Sanballat, Tobiah and Geshem come down three roads; the watch fires reach as
 * far as the focus, and towers and guards strike only what stands in their light; a held focus fills
 * the ram's horn, and a tap blows it where Nehemiah stands.  Ten gates of Nehemiah 3 make the
 * campaign; Tirza, Shallum's daughter, talks; Sanballat and Tobiah sneer from the hill.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the data in content.ts, the meta in meta.ts, the bubbles in talk.ts), the pictures
 * (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn
 * with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { NehSound } from './audio';
import { gateName } from './content';
import type { Press } from './hud';
import { cubits, t, unit, type Key } from './i18n';
import { inside } from './layout';
import { bestOf, freshProgress, migrate, type NehProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { NehView } from './render';
import { RULES } from './rules';
import { NehSim, type Coach, type SimEvent } from './sim';

class NehGame implements ArcadeGame {
  private readonly sim: NehSim;
  private readonly view: NehView;
  private readonly sound: NehSound;
  /** the finger down: where it went down and when, how far it went, the control it pressed (null: the field) */
  private finger: { id: number; x: number; y: number; at: number; last: number; far: number; press: Press } | null = null;
  private now = 0;
  /** first-time explanations waiting for a clear screen (one at a time, a few seconds apart) */
  private readonly hints: { what: Coach; x: number; y: number }[] = [];
  private hintCool = 0;

  constructor(private readonly env: GameEnv<NehProgress>) {
    migrate(env.progress);
    this.sim = new NehSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new NehView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg', touch: env.touch });
    this.sound = new NehSound(env.audio);
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __nehemiasz?: unknown }).__nehemiasz = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.setInsets(this.insets());
    this.view.resize(w, h, dpr);
  }

  /** The runner's insets (its HUD band at the top, the home indicator, a notch); older runners give only hudTop(). */
  private insets() {
    const e = this.env;
    return typeof e.insets === 'function' ? e.insets() : { top: e.hudTop(), right: 0, bottom: 0, left: 0 };
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.setInsets(this.insets());
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now += dt;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim, f);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * One finger (or the mouse) does everything, phone first.  A story card moves on at the press.  The
   * horn's button blows at the press (or shakes: not ready yet).  The other buttons — the choice cards,
   * the guide's "Następne" by day, "Na mur!" by night, a build site's badge — show pressed at once and
   * act when the finger lifts on them; a finger that slides off past the slop lets go of the button and
   * walks instead.  Anywhere else the press is a floating joystick: a drag walks Nehemiah, and a short tap
   * without a drag builds what the guide suggests by day, and by night blows a ready horn or sends
   * Nehemiah where it is hottest.  A tap on the panel's empty parts does nothing.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      // one finger at a time; a finger that goes down again, or one silent for a while, lost its lift
      if (this.finger && this.finger.id !== e.id && this.now - this.finger.last < 1) return;
      this.finger = null;
      view.stick = null;
      sim.steer(0, 0);
      if (sim.story) {
        sim.tap();
        this.drain();
        return;
      }
      let press: Press = null;
      if (sim.choice) {
        const i = view.hud.cardAt(e.x, e.y);
        press = i >= 0 ? { kind: 'card', i } : null;
      } else {
        press = view.pressAt(sim, e.x, e.y);
        if (press?.kind === 'horn') {
          if (sim.hornReady) sim.blowHorn();
          else {
            view.hornNotReady();
            if (this.env.haptics) buzz(6);
          }
          this.drain();
          return;
        }
        if (!press && !view.onPanel(e.x, e.y)) view.ripple(e.x, e.y);
      }
      this.finger = { id: e.id, x: e.x, y: e.y, at: this.now, last: this.now, far: 0, press };
      view.press = press;
      return;
    }
    const f = this.finger;
    if (!f || f.id !== e.id) return;
    f.last = this.now;
    const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy);
    f.far = Math.max(f.far, d);
    if (e.type === 'up') {
      this.finger = null;
      view.press = null;
      view.stick = null;
      sim.steer(0, 0);
      const tap = this.now - f.at <= RULES.tapSec && f.far <= RULES.tapPx;
      const p = f.press;
      if (p) {
        // a button acts when the finger lifts on it
        if (f.far <= RULES.tapPx || this.stillOn(p, e.x, e.y)) this.act(p);
      } else if (tap && !sim.frozen && !view.onPanel(f.x, f.y)) sim.tap(null);
      this.drain();
      return;
    }
    if (f.press) {
      // sliding off a button past the slop lets go of it (the card stays put; elsewhere the finger walks)
      if (d > RULES.tapPx && !this.stillOn(f.press, e.x, e.y)) {
        const was = f.press;
        f.press = null;
        view.press = null;
        if (was.kind === 'card') { this.finger = null; return; }
        f.x = e.x;
        f.y = e.y;
        f.far = RULES.tapPx + 1;
      }
      return;
    }
    if (sim.frozen) return;
    if (d > RULES.stickDead) {
      // the joystick's origin follows a finger that goes past its rim (it never falls behind)
      if (d > RULES.stickPx * 1.4) {
        const k = (d - RULES.stickPx * 1.4) / d;
        f.x += dx * k;
        f.y += dy * k;
      }
      const ddx = e.x - f.x, ddy = e.y - f.y;
      sim.steer(ddx / RULES.stickPx, ddy / RULES.stickPx);
      view.stick = { ox: f.x, oy: f.y, x: e.x, y: e.y };
    } else sim.steer(0, 0);
  }

  /** Whether a finger at (x, y) is still on the control it pressed. */
  private stillOn(p: NonNullable<Press>, x: number, y: number): boolean {
    const L = this.view.L;
    switch (p.kind) {
      case 'card': return this.view.hud.cardAt(x, y) === p.i;
      case 'guide': return inside(L.guide, x, y);
      case 'rush': return inside(L.rush, x, y);
      case 'bubble': return this.view.pressAt(this.sim, x, y)?.kind === 'bubble';
      case 'marker': return this.view.badges(this.sim).some(b => b.id === p.id && b.free && inside(b.box, x, y));
      default: return false;
    }
  }

  /** A pressed control lifted on: do what it does. */
  private act(p: NonNullable<Press>): void {
    const sim = this.sim;
    switch (p.kind) {
      case 'card': if (sim.choice) sim.tap(null, p.i); break;
      case 'guide': sim.tap(null); break;
      case 'rush': if (!sim.rush()) sim.tap(null); break;
      case 'marker': sim.build(p.id); break;
      case 'bubble': sim.talk.hush(); break;
      default: break;
    }
  }

  /** Every control the player can tap right now (kit/types: ArcadeGame.targets). */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  /** Arrows and WASD walk, Space and Enter build what the guide suggests (by night: the horn), 1–2 pick a card. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.finger = null;
      this.view.stick = null;
      this.view.press = null;
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, x: e.x, y: e.y });
      if (e.type === 'blockEnd' && e.block.kind === 'push' && e.block.blind) this.view.unveil(this.sim.t);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at the thing it explains — never over a card or the runner's banner, only in its own time of day. */
  private flushHints(): void {
    const sim = this.sim, h = this.hints[0];
    if (!h || this.hintCool > 0) return;
    if (sim.story || sim.bannerUp) return;
    const day = DAY_COACH.includes(h.what), night = NIGHT_COACH.includes(h.what);
    if ((day && !sim.dayTime) || (night && !sim.nightTime)) {
      // its moment has passed: forget it was given, so it comes again when it matters next
      this.hints.shift();
      const i = sim.p.seen.indexOf(h.what);
      if (i >= 0) sim.p.seen.splice(i, 1);
      return;
    }
    if (h.what === 'decree' || h.what === 'choice') {
      if (!sim.choice) { this.hints.shift(); return; }
      const card = this.view.hud.cards[0];
      if (!card) return;
      this.hints.shift();
      this.hintCool = 4.4;
      this.env.hint(this.coachText(h.what), { x: card.x + card.w / 2, y: card.y + 4 }, 3800);
      return;
    }
    if (sim.choice) return;
    if (h.what === 'horn' && !sim.hornReady) { this.hints.shift(); return; }
    const L = this.view.L;
    let at = h.what === 'horn' ? { x: L.horn.x, y: L.horn.y - L.horn.r - 4 } : h.what === 'guide' ? { x: L.guide.x + L.guide.w / 2, y: L.guide.y - 4 } : this.view.toScreen(h.x, h.y);
    // keep the bubble well inside the screen (it is wider than its arrow)
    at = { x: Math.max(L.w * 0.22, Math.min(L.w * 0.78, at.x)), y: Math.max(L.top + 10, Math.min(h.what === 'horn' || h.what === 'guide' ? at.y : L.bottom - 10, at.y)) };
    this.hints.shift();
    const ms = h.what === 'move' || h.what === 'light' || h.what === 'day' || h.what === 'night' ? 5000 : 3800;
    this.hintCool = ms / 1000 + 0.6;
    this.env.hint(this.coachText(h.what), at, ms);
  }

  /** A coach mark in the words for the hand the player has: a finger taps and drags, a desktop may use the keys. */
  private coachText(what: Coach): string {
    const keys = !this.env.touch && (what === 'move' || what === 'guide' || what === 'horn');
    return t((keys ? `coach.${what}Keys` : `coach.${what}`) as Key);
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
    const s = this.sim, p = s.p, score = s.headlineValue;
    const best = p.best[String(Math.round(s.plannedSec))] ?? 0;
    const toBest = best - score;
    const day = Math.max(1, p.day);
    const sub = best > 0 && toBest > 0 && toBest <= Math.max(20, best * 0.3)
      ? t('hud.subBest', { day, n: cubits(toBest) })
      : p.year > 0 ? t('hud.subYear', { year: p.year + 1, day, gate: gateName(p.gate) }) : t('hud.sub', { day, gate: gateName(p.gate) });
    return { value: score, sub };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

/** Coach marks that belong to the day (building) and to the night (the watch). */
const DAY_COACH: readonly Coach[] = ['guide', 'build', 'front', 'preview', 'day', 'decree', 'bread', 'choice'];
const NIGHT_COACH: readonly Coach[] = ['night', 'light', 'horn', 'breach', 'ono'];

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'pay': buzz(8); break;
    case 'missing': buzz([6, 50, 6]); break;
    case 'built': buzz(18); break;
    case 'tier': buzz([12, 30, 12]); break;
    case 'hornReady': buzz([10, 60, 10]); break;
    case 'horn': buzz([30, 40, 60]); break;
    case 'breach': buzz(40); break;
    case 'gateDone': buzz([20, 30, 20, 30, 60]); break;
    default: break;
  }
}

function howto(): HowTo {
  return {
    goal: t('howto.goal'),
    // a phone's card leaves the keys out (the runner drops a 'keys' row on touch)
    hands: [
      { gesture: 'drag', text: t('howto.move') },
      { gesture: 'tap', text: t('howto.tap') },
      { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<NehProgress> = {
  freshProgress,
  create: env => new NehGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto,
};
export default mod;
