/**
 * Jerzy i smok (George and the dragon): a survivors-like on the dragon's lands, after the legend of
 * Saint George and Ephesians 6:16, modelled on Knight Survivor and the genre it belongs to (Vampire
 * Survivors, Survivor.io).  A drag anywhere is a joystick (WASD and the arrows too); the knight's
 * weapons strike by themselves; the dragon's brood comes in growing waves and dissolves into smoke,
 * leaving scales; each level is a choice of one of three cards; a maxed pair evolves; the land's
 * dragon comes on a Tarcza with telegraphed fire.  The band is the shield's aura: in a Tarcza its
 * radius follows the level (the threshold a dotted ring on it), it throws the brood back and puts
 * out fire, and quenched fire charges the Miecz światła (a tap); in a Postój everything naps, calm
 * heals and the block's end gives a free card.  A run lost is a tally and a new run; the session's
 * scales stay.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers
 * in rules.ts, the data in content.ts, the meta in meta.ts and Linda's bubble in talk.ts), the
 * pictures (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby,
 * all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { target } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { JerzySound } from './audio';
import { Hud, REROLL } from './hud';
import { hand, t, unit, type Key } from './i18n';
import { sheet, tallyBox, type Rect, type Sheet } from './layout';
import { bestOf, freshProgress, migrate, type JerzyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { JerzyView } from './render';
import { RULES } from './rules';
import { JerzySim, type Coach, type SimEvent } from './sim';

/** a level-up's cards take a finger only this long after they came up (a thumb already on its way does not pick) */
const CARD_GUARD = 0.3;

const inRect = (r: Rect | null, x: number, y: number): boolean => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

class JerzyGame implements ArcadeGame {
  private readonly sim: JerzySim;
  private readonly view: JerzyView;
  private readonly sound: JerzySound;
  /** the finger on the field (the floating joystick): where it went down and when, how far it went */
  private finger: { id: number; x: number; y: number; at: number; far: number } | null = null;
  /** a finger on a card or on the reshuffle: pressed when it lands, taken when it lifts there */
  private press: { id: number; i: number } | null = null;
  private now = 0;
  /** first-time explanations waiting for a clear screen (one at a time, a few seconds apart) */
  private readonly hints: { what: Coach; x: number; y: number }[] = [];
  private hintCool = 0;
  /** the coach mark showing now points at the field (not at the cards) */
  private fieldHint = false;

  constructor(private readonly env: GameEnv<JerzyProgress>) {
    migrate(env.progress);
    this.sim = new JerzySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new JerzyView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg', touch: env.touch });
    this.sound = new JerzySound(env.audio);
    // ?debug: the run in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __jerzy?: unknown }).__jerzy = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr, this.env.insets());
    this.syncView();
  }

  /** The field in sight (u) and the room above the knight, for the sim (the brood comes in from beyond it). */
  private syncView(): void {
    const L = this.view.L;
    this.sim.setView(L.halfW, L.halfH, L.up);
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.setInsets(this.env.insets());
    this.syncView();
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now += dt;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * One thumb does everything.  On a story card or the tally a touch moves on.  On the level-up's
   * cards a touch presses a card (or the reshuffle) and lifting it there takes it.  On the Miecz
   * światła's dial a touch releases a ready sword at once.  Anywhere else the touch is a floating
   * joystick: its base shows where the thumb came down, a drag steers, and a short tap without a drag
   * releases a ready sword too (and otherwise does nothing: a tap never hurts).
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      if (sim.story || sim.tally) {
        sim.tap();
        this.drain();
        return;
      }
      if (sim.choice) {
        if (sim.choice.t < CARD_GUARD) return;
        const sh = this.sheetNow();
        const i = Hud.rerollAt(sh, e.x, e.y) ? REROLL : Hud.cardAt(sh, e.x, e.y);
        if (i !== -1) {
          this.press = { id: e.id, i };
          view.hud.pressed = i;
        }
        return;
      }
      const L = view.L;
      if (inRect(L.swordHit, e.x, e.y)) {
        view.dialPress = 1;
        if (sim.swordReady && sim.knight.down <= 0) {
          sim.tap();
          this.drain();
          return;
        }
      }
      this.finger = { id: e.id, x: e.x, y: e.y, at: this.now, far: 0 };
      view.stick = { ox: e.x, oy: e.y, x: e.x, y: e.y, live: false };
      return;
    }
    const pr = this.press;
    if (pr && pr.id === e.id) {
      const sh = this.sheetNow();
      const over = pr.i === REROLL ? Hud.rerollAt(sh, e.x, e.y) : Hud.cardAt(sh, e.x, e.y) === pr.i;
      if (e.type === 'move') {
        view.hud.pressed = over ? pr.i : -1;
        return;
      }
      this.press = null;
      view.hud.pressed = -1;
      if (over && sim.choice) {
        if (pr.i === REROLL) sim.reroll();
        else sim.tap(pr.i);
        this.drain();
      }
      return;
    }
    const tc = this.finger;
    if (!tc || tc.id !== e.id) return;
    const dx = e.x - tc.x, dy = e.y - tc.y, d = Math.hypot(dx, dy);
    tc.far = Math.max(tc.far, d);
    if (e.type === 'up') {
      this.finger = null;
      view.stick = null;
      sim.steer(0, 0);
      // a tap (no drag) lets a ready sword go; one that began before a card came up never takes a card
      if (this.now - tc.at <= RULES.tapSec && tc.far <= RULES.tapPx && !sim.frozen) {
        sim.tap();
        this.drain();
      }
      return;
    }
    if (d > RULES.stickDead) {
      // the joystick's base follows a finger that goes past its rim (it never falls behind)
      if (d > RULES.stickPx * 1.4) {
        const k = (d - RULES.stickPx * 1.4) / d;
        tc.x += dx * k;
        tc.y += dy * k;
      }
      const ddx = e.x - tc.x, ddy = e.y - tc.y;
      sim.steer(ddx / RULES.stickPx, ddy / RULES.stickPx);
      view.stick = { ox: tc.x, oy: tc.y, x: e.x, y: e.y, live: true };
    } else {
      sim.steer(0, 0);
      view.stick = { ox: tc.x, oy: tc.y, x: e.x, y: e.y, live: false };
    }
  }

  /** The level-up's sheet as the view lays it out now (null without a choice). */
  private sheetNow(): Sheet | null {
    const ch = this.sim.choice;
    return ch ? sheet(this.view.L, ch.cards.length, this.sim.run.rerolls) : null;
  }

  /**
   * What a finger can tap right now (kit/types ArcadeGame.targets): the story card's button, the
   * tally's, the level-up's cards and the reshuffle, or in play the Miecz światła's dial.  The field
   * itself (the floating joystick) is not a target.
   */
  targets(): TapTarget[] {
    const sim = this.sim, L = this.view.L;
    if (!sim.started || sim.phase === 'done') return [];
    if (sim.story) {
      const b = this.view.hud.storyBtn;
      return b ? [target('story', b)] : [];
    }
    if (sim.tally) return [target('next run', tallyBox(L, sim.tally.top.length).btn)];
    const sh = this.sheetNow();
    if (sh) {
      const out = sh.cards.map((r, i) => target(`card ${i + 1}`, r));
      if (sh.reroll) out.push(target('reshuffle', sh.reroll));
      return out;
    }
    return [target('Miecz światła', L.swordHit)];
  }

  /** Arrows and WASD walk, Space and Enter release the sword or pick the first card, 1–3 pick a card, R reshuffles. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.finger = null;
      this.press = null;
      this.view.hud.pressed = -1;
      this.view.stick = null;
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, x: e.x, y: e.y });
      // the cards come up: a coach mark about the field must not sit over them
      if (e.type === 'choice' && this.fieldHint) {
        this.env.hint('');
        this.fieldHint = false;
      }
      if (this.env.haptics) haptic(e);
    }
  }

  /**
   * The runner's coach mark, pointing at the thing it explains — never over a story card or the
   * tally; the cards' marks point at the first card once the choice is drawn.
   */
  private flushHints(): void {
    const sim = this.sim, h = this.hints[0];
    if (!h || this.hintCool > 0) return;
    const L = this.view.L;
    // a mark on the field stays in the play band, under the status and clear of the edges
    const onField = (p: { x: number; y: number }) => ({ x: Math.max(L.left + 24, Math.min(L.right - 24, p.x)), y: Math.max(L.statBottom + 10, Math.min(L.bottom - 10, p.y)) });
    let at: { x: number; y: number } | null;
    if (h.what === 'choose' || h.what === 'evolve' || h.what === 'reroll') {
      const sh = this.sheetNow();
      if (!sim.choice || !sh) { this.hints.shift(); return; }
      if (h.what === 'reroll') {
        if (!sh.reroll) { this.hints.shift(); return; }
        at = { x: sh.reroll.x + sh.reroll.w / 2, y: sh.reroll.y };
      } else if (sh.stacked) {
        // a phone's sheet fills the band: the mark sits on its title row, never over a card
        at = { x: sh.head.x + Math.min(sh.head.w / 2, 120), y: sh.head.y };
      } else at = { x: sh.cards[0].x + sh.cards[0].w / 2, y: sh.cards[0].y + 4 };
    } else if (h.what === 'fatal' || h.what === 'ring') {
      if (sim.story || sim.tally || sim.choice) return;
      at = onField(h.what === 'fatal' ? this.view.toScreen(sim.boss.x, sim.boss.y - 1.6) : this.view.toScreen(sim.knight.x, sim.knight.y - 1));
    } else if (h.what === 'pal') {
      if (sim.story || sim.tally || sim.choice) return;
      const pl = sim.pals[0];
      if (!pl) { this.hints.shift(); return; }
      at = onField(this.view.toScreen(pl.x, pl.y - 0.6));
    } else {
      if (h.what === 'sword' && !sim.swordReady) { this.hints.shift(); return; }
      if (sim.story || sim.tally || sim.choice) return;
      // the sword's mark points at the dial (over its label), the others at their spot on the field
      at = h.what === 'sword' ? { x: Math.min(L.sword.x, L.right - 24), y: L.sword.y - L.sword.r - 28 * L.u } : onField(this.view.toScreen(h.x, h.y));
    }
    this.hints.shift();
    this.fieldHint = !['choose', 'evolve', 'reroll'].includes(h.what);
    const ms = h.what === 'move' || h.what === 'aura' || h.what === 'rest' || h.what === 'fatal' || h.what === 'ring' ? 5000 : 3800;
    this.hintCool = ms / 1000 + 0.6;
    if (this.fieldHint) sim.quiet = ms / 1000;
    this.env.hint(hand(`coach.${h.what}` as Key, this.env.touch), at, ms);
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
    const s = this.sim, r = s.run, best = s.p.bestRun;
    const toBest = best - r.scales;
    const sub = best > 0 && toBest > 0 && toBest <= Math.max(20, best * 0.4)
      ? t('hud.subBest', { lv: r.level, n: toBest })
      : t('hud.sub', { lv: r.level, run: r.n });
    return { value: s.score, sub };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.sim.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'hurt': buzz(20); break;
    case 'pick': buzz(12); break;
    case 'reroll': buzz([10, 40, 10]); break;
    case 'chest': buzz(15); break;
    case 'sword': buzz([30, 40, 60]); break;
    case 'level': buzz([12, 30, 12]); break;
    case 'evolve': buzz([20, 30, 20, 30, 60]); break;
    case 'driven': buzz([30, 40, 30, 40, 80]); break;
    case 'down': buzz([10, 60, 10]); break;
    case 'roar': buzz(60); break;
    case 'fatal': buzz([20, 30, 20, 30, 20]); break;
    case 'treasure': buzz([15, 25, 15, 25, 40]); break;
    case 'duet': buzz([15, 30, 30]); break;
    case 'ringOut': buzz([40, 30, 60]); break;
    default: break;
  }
}

/** How to play: a drag and a tap for a finger; the keys row (shortcuts on a desktop) the runner leaves out on a touch screen. */
function howto(): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'drag', text: t('howto.move') },
      { gesture: 'tap', text: t('howto.cards') },
      { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<JerzyProgress> = {
  freshProgress,
  create: env => new JerzyGame(env),
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
