/**
 * Dziewiątka (The Nine): a team battler after Hero Wars: Alliance, in the little town of Zacisze.
 * Five heroes named for the fruit of the Spirit (Galatians 5:22-23) fight the Din's shadows by
 * themselves on a side-view street; every blow and every wound fills their energy, and a full bar is
 * an ultimate the player fires with a tap on the portrait (a tap on the street or Space fires the one
 * that waited longest; the semi-auto fires it anyway after a while).  Missions of three waves through
 * six districts (three stars by who fell), a boss in every fifth, then the Bell Tower's floors.
 *
 * The band is the energy: in a sighted push block every gain is × (1 + 2·level), ×1…×3 with ×2 at
 * the threshold — gold bars, more ultimates — and a held focus fills Harmony, the bell: all five
 * ultimates in one chord.  A rest block is the well: calm heals, a tap sews gear on (six pieces = a
 * new colour rank), and the end offers one of three boons.  Klara, the bell-ringer's granddaughter,
 * talks; a lost fight is a stumble, and the session's hushed stay hushed.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (battle.ts, sim.ts, the
 * numbers in rules.ts, the data in content.ts, the meta in meta.ts and Klara in talk.ts), the
 * pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby,
 * all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { DziewiatkaSound } from './audio';
import { t, unit, type Key } from './i18n';
import { CHOICE_GUARD, inRect, slotAt, targetsFor, toScreen } from './layout';
import { bestOf, freshProgress, migrate, type DziewiatkaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { DziewiatkaView } from './render';
import { RULES } from './rules';
import { DziewiatkaSim, type Coach, type CoachAt, type SimEvent } from './sim';

class DziewiatkaGame implements ArcadeGame {
  private readonly sim: DziewiatkaSim;
  private readonly view: DziewiatkaView;
  private readonly sound: DziewiatkaSound;
  /** first-time explanations waiting for a clear screen (one at a time, a few seconds apart) */
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 0;
  /** a finger on a boon card: the card is taken when it lifts on the same card (a tap, not a brush) */
  private cardDown = -1;

  constructor(private readonly env: GameEnv<DziewiatkaProgress>) {
    migrate(env.progress);
    this.sim = new DziewiatkaSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new DziewiatkaView(env.canvas, { reducedMotion: env.reducedMotion });
    this.view.touch = env.touch;
    this.sound = new DziewiatkaSound(env.audio);
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __dziewiatka?: unknown }).__dziewiatka = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr);
    this.view.setInsets(this.env.insets());
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.setInsets(this.env.insets());
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim, f, t);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  /** Play only: before the start the calibration's intro scene stays on the canvas. */
  draw(): void { if (this.sim.started) this.view.draw(this.sim); }

  /**
   * Under a finger, from the moment it lands (the card squashes at once): a press on a story card closes it;
   * on a portrait fires that hero (at the well: sews a piece on), a press in the gap between two portraits
   * means the nearer one; on the bell rings Harmony (not full: the bell shakes its head); anywhere else on
   * the street fires the ultimate that has waited longest (at the well: sews a piece onto whoever is closest
   * to a new rank) and leaves a ring where it landed.  A boon card is taken when the finger lifts on it.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view, hud = view.hud, L = view.L;
    if (e.type === 'move') return;
    if (e.type === 'up') {
      const i = this.cardDown;
      this.cardDown = -1;
      hud.release();
      if (i >= 0 && sim.choice && hud.cardAt(L, e.x, e.y) === i && sim.pick(i)) {
        if (this.env.haptics) buzz(12);
        this.drain();
      }
      return;
    }
    if (sim.story || sim.tally) {
      sim.tap();
      this.drain();
      return;
    }
    if (sim.choice) {
      // a finger already on the glass when the sheet rose (sewing at the well) is not a choice: a fresh tap is
      const i = hud.cardAt(L, e.x, e.y);
      if (i >= 0 && sim.choice.t >= CHOICE_GUARD) {
        this.cardDown = i;
        hud.pressCard(i);
      }
      return;
    }
    const slot = slotAt(L, e.x, e.y);
    if (slot >= 0) {
      hud.pressSlot(slot);
      sim.tapSlot(slot);
    } else if (hud.bellAt(L, e.x, e.y)) {
      hud.pressBell();
      if (!sim.tapBell()) hud.bellNope();
    } else if (!inRect(L.dial, e.x, e.y)) {
      view.ripple(e.x, e.y);
      sim.tap();
    }
    this.drain();
  }

  /** What a finger can press right now (kit/mobile.ts): the story card, the boons, or the five and the bell. */
  targets(): TapTarget[] {
    const sim = this.sim;
    if (!sim.started || sim.phase === 'done') return [];
    if (sim.story) return targetsFor(this.view.L, 'story');
    if (sim.tally) return [];
    if (sim.choice) return targetsFor(this.view.L, 'choice', sim.choice.ids.length);
    return targetsFor(this.view.L, 'play');
  }

  /** Space and Enter fire (or take the first boon), 1–5 a portrait (or 1–3 a boon), B the bell. */
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

  /** A coach mark's words for the hand the player has: a finger never hears of keys. */
  private coachText(what: Coach): string {
    const touchKey = `coach.${what}.touch`;
    return t((this.env.touch && touchKey in TOUCH_COACH ? touchKey : `coach.${what}`) as Key);
  }

  /** The runner's coach mark, pointing at the thing it explains — never over a story card or the wipe's card. */
  private flushHints(): void {
    const sim = this.sim, h = this.hints[0];
    if (!h || this.hintCool > 0) return;
    if (sim.story || sim.tally) return;
    if (sim.choice && h.what !== 'boon') return;
    if (h.what === 'boon' && !sim.choice) { this.hints.shift(); return; }
    if (h.what === 'well' && !sim.atWell) { this.hints.shift(); return; }
    if (h.what === 'bell' && !sim.harmonyReady) { this.hints.shift(); return; }
    // the bell rings only in battle: its mark waits for the five to leave the well
    if (h.what === 'bell' && !sim.fighting) return;
    const L = this.view.L;
    let at: { x: number; y: number } | null = null;
    switch (h.at.at) {
      case 'slot': { const r = L.slots[h.at.slot]; at = r ? { x: r.x + r.w / 2, y: r.y + 4 } : null; break; }
      case 'bell': at = { x: L.bell.x + L.bell.w / 2, y: L.bell.y + 4 }; break;
      case 'dial': at = { x: L.dial.x + L.dial.w / 2, y: L.dial.y + 4 }; break;
      case 'card': { const r = L.cards[0]; at = { x: r.x + r.w / 2, y: r.y + 4 }; break; }
      case 'well': { const p = toScreen(L, RULES.wellX, 0.2, 2.4); at = { x: p.x, y: Math.max(L.top + 10, p.y) }; break; }
      case 'field': { const p = toScreen(L, h.at.x, h.at.y, 1.6); at = { x: Math.max(20, Math.min(L.w - 20, p.x)), y: Math.max(L.top + 10, Math.min(L.fieldBottom - 10, p.y)) }; break; }
      default: at = null;
    }
    this.hints.shift();
    const long = h.what === 'mult' || h.what === 'well' || h.what === 'ult';
    const ms = long ? 5000 : 3800;
    this.hintCool = ms / 1000 + 0.6;
    this.env.hint(this.coachText(h.what), at, ms);
    // Klara waits while the mark is up (her line on screen gives way to it)
    this.sim.coachT = ms / 1000;
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** A pause drops a finger's press (its lift may come while paused, and the runner sends no events then). */
  pause(paused: boolean): void {
    if (!paused) return;
    this.cardDown = -1;
    this.view.hud.release();
  }

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

  headline(): Headline { return { value: this.sim.score, sub: this.sim.headlineSub }; }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.hints.length = 0; }
}

/** The coach marks that speak of keys on a desktop and have their own words for a finger. */
const TOUCH_COACH: Readonly<Record<string, true>> = { 'coach.tap.touch': true };

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'ult': if (!e.auto && !e.chord) buzz(18); break;
    case 'chord': buzz([30, 40, 30, 40, 90]); break;
    case 'interrupt': buzz([12, 30, 12]); break;
    case 'fall': buzz(25); break;
    case 'won': buzz([15, 40, 15]); break;
    case 'wipe': buzz([40, 60, 40]); break;
    case 'equip': buzz(e.rankUp ? [20, 30, 20, 30, 50] : 8); break;
    default: break;
  }
}

/** How to play: taps only (a phone's card leaves the keys' row out). */
function howto(): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t('howto.ult') },
      { gesture: 'tap', text: t('howto.bell') },
      { gesture: 'tap', text: t('howto.well') },
      { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<DziewiatkaProgress> = {
  freshProgress,
  create: env => new DziewiatkaGame(env),
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
