/**
 * Dawid: the shepherd boy of Bethlehem who becomes a king, an open-world action RPG after XP Hero.  A
 * drag anywhere is a joystick (WASD and the arrows too); a tap sends David hunting by himself (or walking
 * where it points); his sling throws by itself, his companions' kit skills fire on their own; beasts
 * run off into the hills leaving XP and silver; the bag carries the silver to the camp, where the
 * bonfire, the forge and the buildings turn it into strength; each land's guardian holds its gate.  The
 * band is the sling's whirl: in a push the level whirls the stone and multiplies damage and XP (×1…×4),
 * a held focus polishes the great stone from the brook; in a rest David plays the harp by the fire —
 * the beasts doze, calm heals and fills rested XP.
 *
 * Phone first (src/arcade/DESIGN.md §12): one thumb plays it.  A finger down on the field shows the
 * joystick at once; the great stone and the bag are big buttons in the thumb zone, pressed on touch-down
 * and done on lift (a thumb that slides off a button steers instead); the camp's sheet scrolls under a drag
 * and buys on a tap; the quest pill follows the quest.  Words speak of tapping to a finger and of clicks and
 * keys to a mouse.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the data in content.ts, the meta in meta.ts and the lamb's bubble in talk.ts), the pictures
 * (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn
 * with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import { fmtNum } from '../../i18n';
import type { FocusFrame } from '../kit/focus';
import { buzz, clamp } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { DawidSound } from './audio';
import { landName } from './content';
import { TABS, inRect, type SheetHit } from './hud';
import { t, unit, xpText, type Key } from './i18n';
import { grow } from './layout';
import { bestOf, freshProgress, migrate, type DawidProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { DawidView } from './render';
import { RULES } from './rules';
import { DawidSim, type Coach, type SimEvent } from './sim';

/** A drag shorter than this (px) is still a tap on a button or a tile (DESIGN §12: a slop of at least 10). */
const SLOP = 10;

/** What a finger (or the mouse) does since it went down. */
type Press =
  | { kind: 'field'; id: number; x0: number; y0: number; ox: number; oy: number; at: number; far: number }
  | { kind: 'button'; what: 'bag' | 'stone' | 'quest'; id: number; x0: number; y0: number; far: number }
  | { kind: 'sheet'; hit: SheetHit; id: number; x0: number; y0: number; far: number; scroll0: number; scrolling: boolean; lastY: number; lastT: number; v: number };

/** The coach marks and cards that speak of the hands: a finger's words, and a mouse's and keys' (`.keys`). */
const HANDS = ['coach.move', 'coach.hunt', 'coach.bag', 'coach.camp', 'coach.stone', 'coach.quest'] as const;

class DawidGame implements ArcadeGame {
  private readonly sim: DawidSim;
  private readonly view: DawidView;
  private readonly sound: DawidSound;
  private press: Press | null = null;
  private now = 0;
  /** first-time explanations waiting for a clear screen (one at a time, a few seconds apart) */
  private readonly hints: { what: Coach; x: number; y: number }[] = [];
  private hintCool = 0;
  /** the first session repeats "drag" and "tap" until each has been done once */
  private nudged = { move: 0, hunt: 0 };

  constructor(private readonly env: GameEnv<DawidProgress>) {
    migrate(env.progress);
    this.sim = new DawidSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new DawidView(env.canvas, { reducedMotion: env.reducedMotion });
    this.view.touch = env.touch;
    this.sound = new DawidSound(env.audio);
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __dawid?: unknown }).__dawid = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr, this.env.insets());
    this.sim.setView(this.view.L.halfW, this.view.L.halfH);
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.setInsets(this.env.insets());
    this.sim.setView(this.view.L.halfW, this.view.L.halfH);
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
    this.sim.hush = this.hintCool > 0.6;
    this.nudge();
    this.flushHints();
  }

  draw(): void { this.view.draw(this.sim); }

  /** The controls the player can tap now: the two buttons, the quest pill, the camp's sheet, a story card. */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  /**
   * A press.  On a story card it moves on.  On the camp's sheet: a tab, a tile, "Na łowy" — pressed at once,
   * done on lift; a drag scrolls the tiles (and flings).  On the great stone, the bag or the quest pill:
   * pressed at once, done on lift; a thumb that slides off steers instead.  Elsewhere it is the floating
   * joystick, shown under the finger at once: a drag steers, a short tap sends David hunting (near him) or
   * walking to the spot (farther).
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view, hud = view.hud, L = view.L;
    if (e.type === 'down') {
      if (this.press) return;   // one finger plays; a second one waits
      if (sim.story) {
        sim.tap();
        this.drain();
        return;
      }
      if (view.sheetOpen(sim)) {
        const hit = hud.sheetAt(e.x, e.y);
        if (hit) {
          this.press = { kind: 'sheet', hit, id: e.id, x0: e.x, y0: e.y, far: 0, scroll0: hud.scroll, scrolling: false, lastY: e.y, lastT: clock(), v: 0 };
          hud.fling = 0;
          if (hit.kind === 'hunt') hud.pressed = { kind: 'hunt', i: 0 };
          else if (hit.kind === 'tab') hud.pressed = { kind: 'tab', i: hit.i };
          else if (hit.kind === 'tile' && hit.whole) hud.pressed = { kind: 'tile', i: hit.i };
          return;
        }
      } else if (view.campOpen < 0.5) {
        const what = inRect(L.stone.hit, e.x, e.y) ? 'stone' : inRect(L.bag.hit, e.x, e.y) ? 'bag' : null;
        if (what) {
          this.press = { kind: 'button', what, id: e.id, x0: e.x, y0: e.y, far: 0 };
          hud.pressed = { kind: what, i: 0 };
          if (this.env.haptics) buzz(6);
          return;
        }
      }
      if (hud.questBox && inRect(grow(hud.questBox), e.x, e.y)) {
        this.press = { kind: 'button', what: 'quest', id: e.id, x0: e.x, y0: e.y, far: 0 };
        hud.pressed = { kind: 'quest', i: 0 };
        return;
      }
      this.press = { kind: 'field', id: e.id, x0: e.x, y0: e.y, ox: e.x, oy: e.y, at: this.now, far: 0 };
      view.stick = { ox: e.x, oy: e.y, x: e.x, y: e.y, on: false };
      return;
    }
    const pr = this.press;
    if (!pr || pr.id !== e.id) return;
    const dy = e.y - pr.y0;
    pr.far = Math.max(pr.far, Math.hypot(e.x - pr.x0, dy));
    if (pr.kind === 'button') {
      if (e.type === 'up') {
        this.press = null;
        hud.pressed = null;
        if (pr.far <= SLOP) this.button(pr.what);
        return;
      }
      if (pr.far > SLOP) {
        // the thumb slid off the button: from here it steers, as if it had gone down on the field
        hud.pressed = null;
        this.press = { kind: 'field', id: pr.id, x0: pr.x0, y0: pr.y0, ox: pr.x0, oy: pr.y0, at: -1, far: pr.far };
        view.stick = { ox: pr.x0, oy: pr.y0, x: e.x, y: e.y, on: false };
        this.steer(this.press, e);
      }
      return;
    }
    if (pr.kind === 'sheet') {
      if (!pr.scrolling && pr.far > SLOP) {
        pr.scrolling = true;
        hud.pressed = null;
      }
      if (pr.scrolling) {
        const max = hud.sheetShown?.maxScroll ?? 0;
        hud.scroll = clamp(pr.scroll0 - dy, 0, max);
        const now = clock(), gap = now - pr.lastT;
        if (gap > 0.004) {
          pr.v = 0.5 * pr.v + 0.5 * (-(e.y - pr.lastY) / gap);
          pr.lastY = e.y;
          pr.lastT = now;
        }
      }
      if (e.type === 'up') {
        this.press = null;
        hud.pressed = null;
        if (pr.scrolling) hud.fling = clock() - pr.lastT < 0.1 ? clamp(pr.v, -2400, 2400) : 0;
        else this.sheetTap(pr.hit);
      }
      return;
    }
    // the field: the floating joystick
    if (e.type === 'up') {
      this.press = null;
      view.dropStick();
      sim.steer(0, 0);
      if (pr.at >= 0 && this.now - pr.at <= RULES.tapSec && pr.far <= RULES.tapPx) {
        const w = view.toWorld(e.x, e.y);
        sim.tap(w.x, w.y);
        this.drain();
        this.markMode();
      }
      return;
    }
    this.steer(pr, e);
  }

  /** The joystick follows the finger: its base trails a finger past its rim (it never falls behind). */
  private steer(pr: Extract<Press, { kind: 'field' }>, e: PointerInput): void {
    const view = this.view;
    let dx = e.x - pr.ox, dy = e.y - pr.oy;
    const d = Math.hypot(dx, dy);
    if (d > RULES.stickPx * 1.4) {
      const k = (d - RULES.stickPx * 1.4) / d;
      pr.ox += dx * k;
      pr.oy += dy * k;
      dx = e.x - pr.ox;
      dy = e.y - pr.oy;
    }
    const on = pr.far > RULES.stickDead && Math.hypot(dx, dy) > RULES.stickDead;
    this.sim.steer(on ? dx / RULES.stickPx : 0, on ? dy / RULES.stickPx : 0);
    view.stick = { ox: pr.ox, oy: pr.oy, x: e.x, y: e.y, on: on || !!view.stick?.on };
  }

  /** The great stone, the bag, the quest pill, lifted where they were pressed. */
  private button(what: 'bag' | 'stone' | 'quest'): void {
    const sim = this.sim, view = this.view, hp = this.env.haptics;
    if (what === 'bag') {
      if (sim.goHome()) {
        if (hp) buzz(10);
      } else view.hud.shake('bag');   // by the harp, or down: not now
    } else if (what === 'quest') {
      if (sim.followQuest()) {
        if (hp) buzz(8);
        this.markMode();
      } else view.hud.shake('quest');
    } else if (sim.stoneReady && sim.stoneTarget()) {
      sim.throwGreat();
      if (hp) buzz(20);
    } else {
      // not polished yet, or nothing in sight to throw it at: it says so
      view.hud.shake('stone');
      view.note(sim.stoneReady ? t('hud.noMark') : t('hud.stoneWait', { n: Math.round(sim.charge * 100) }));
      if (hp) buzz([6, 40, 6]);
    }
    this.drain();
  }

  /** A tap on the camp's sheet: "Na łowy", a tab, a tile (a tile cut by the window's edge scrolls into view first). */
  private sheetTap(hit: SheetHit): void {
    const sim = this.sim, view = this.view, hp = this.env.haptics;
    if (hit.kind === 'hunt') {
      if (sim.hunt()) {
        if (hp) buzz(10);
        this.markMode();
      }
    } else if (hit.kind === 'tab') {
      sim.setTab(TABS[hit.i]);
      if (hp) buzz(6);
    } else if (hit.kind === 'tile') {
      if (!hit.whole) view.hud.reveal(hit.i);
      else {
        view.boughtTile = hit.i;
        const ok = sim.campTap(hit.i);
        if (ok) {
          if (hp) buzz(14);
        } else {
          view.boughtTile = -1;
          view.hud.shake('tile', hit.i);
          if (hp) buzz([8, 40, 8]);
        }
      }
    }
    this.drain();
  }

  /** A ring where David is now headed (a tap's spot, the quest) or round him when he goes hunting. */
  private markMode(): void {
    const sim = this.sim;
    if (sim.mode === 'go') this.view.mark('go', sim.goal.x, sim.goal.y);
    else if (sim.mode === 'hunt') this.view.mark('hunt', sim.david.x, sim.david.y);
  }

  /** Arrows and WASD walk; Space and Enter throw a ready stone, buy the first tile in camp, else hunt; 1–4 pick the camp's tab. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.press = null;
      this.view.hud.pressed = null;
      this.view.dropStick();
    }
  }

  /** A coach mark's words for the hand the player has: a finger's, or a mouse's and keys' (`.keys`). */
  private words(what: Coach): string {
    const key = `coach.${what}`;
    if (!this.env.touch && (HANDS as readonly string[]).includes(key)) return t(`${key}.keys` as Key);
    return t(key as Key);
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, x: e.x, y: e.y });
      if (this.env.haptics) haptic(e);
    }
  }

  /** The first session keeps teaching "drag" and "tap" until each has been done (at most twice more). */
  private nudge(): void {
    const sim = this.sim, seen = sim.p.seen;
    if (sim.session !== 1 || sim.story || !sim.started) return;
    if (!seen.includes('moved') && this.nudged.move < 2 && this.now > 12 + this.nudged.move * 14 && this.hintCool <= 0) {
      this.nudged.move++;
      this.hints.push({ what: 'move', x: sim.david.x, y: sim.david.y });
    }
    if (!seen.includes('hunted') && seen.includes('moved') && this.nudged.hunt < 2 && this.now > 26 + this.nudged.hunt * 16 && this.hintCool <= 0) {
      this.nudged.hunt++;
      this.hints.push({ what: 'hunt', x: sim.david.x, y: sim.david.y });
    }
  }

  /** The runner's coach mark, pointing at the thing it explains — never over a story card. */
  private flushHints(): void {
    const sim = this.sim, h = this.hints[0];
    if (!h || this.hintCool > 0 || sim.story) return;
    const L = this.view.L, hud = this.view.hud;
    let at: { x: number; y: number };
    let band = false;
    switch (h.what) {
      case 'bag': at = { x: L.bag.x, y: L.bag.y - L.bag.r - 4 }; band = true; break;
      case 'stone':
        if (!sim.stoneReady) { this.hints.shift(); return; }
        at = { x: L.stone.x, y: L.stone.y - L.stone.r - 4 };
        band = true;
        break;
      case 'quest': {
        const q = hud.questBox;
        at = hud.arrowAt ?? (q ? { x: q.x + q.w / 2, y: q.y + q.h } : { x: L.quest.x + 80 * L.u, y: L.quest.y + L.quest.h });
        break;
      }
      case 'level': at = { x: L.xp.x + L.xp.w / 2, y: L.xp.y - 4 }; band = true; break;
      case 'camp': {
        if (!sim.inCamp) { this.hints.shift(); return; }
        const g = hud.sheetShown;
        at = g ? { x: g.frame.x + g.frame.w / 2, y: g.head.y } : this.view.toScreen(sim.david.x, sim.david.y - 1.2);
        band = !!g;
        break;
      }
      case 'guard': case 'bearer': {
        if (!sim.guardFighting) { this.hints.shift(); return; }
        const g = h.what === 'bearer' ? sim.bearer : sim.guard;
        at = this.view.toScreen(g.x, g.y - 1.5);
        break;
      }
      case 'thief':
        if (!sim.thief) { this.hints.shift(); return; }
        at = this.view.toScreen(sim.thief.x, sim.thief.y - 0.6);
        break;
      case 'gate':
        if (!sim.gateOpen || sim.inCave) { this.hints.shift(); return; }
        at = this.view.toScreen(sim.land.gate[0], sim.land.gate[1] - 1.5);
        break;
      case 'cave':
        if (!sim.inCave) { this.hints.shift(); return; }
        at = this.view.toScreen(sim.david.x, sim.david.y - 1.2);
        break;
      default: at = this.view.toScreen(h.x, h.y - 1.2);
    }
    // in the field (or at the bottom band for its own bits), never under the HUD
    at = { x: clamp(at.x, L.left + 20, L.right - 20), y: clamp(at.y, L.top + 10, band ? L.bottom - 10 : L.field.bottom) };
    this.hints.shift();
    const ms = h.what === 'move' || h.what === 'sling' || h.what === 'harp' || h.what === 'camp' ? 5000 : 3800;
    this.hintCool = ms / 1000 + 0.6;
    this.env.hint(this.words(h.what), at, ms);
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
    const s = this.sim, p = s.p;
    const best = Math.max(0, ...Object.values(p.best).filter(v => typeof v === 'number'));
    const toBest = best - s.score;
    let sub: string;
    if (s.ringLook === 'live' && s.mult > 1) sub = t('hud.subMult', { lv: p.level, m: fmtNum(s.mult, Number.isInteger(s.mult) ? 0 : 1) });
    else if (s.score > 0 && best > 0 && toBest > 0 && toBest <= Math.max(150, best * 0.3)) sub = t('hud.subBest', { lv: p.level, n: xpText(toBest) });
    else sub = t('hud.sub', { lv: p.level, land: landName(s.land.id) });
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

/** Seconds on the page's clock (a drag's speed between two frames). */
const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'hurt': buzz(18); break;
    case 'level': buzz([12, 30, 12]); break;
    case 'stoneHit': buzz([30, 40, 70]); break;
    case 'guardDriven': buzz([30, 40, 30, 40, 90]); break;
    case 'down': buzz([10, 60, 10]); break;
    case 'guardWake': buzz(60); break;
    case 'deliver': buzz(15); break;
    case 'thiefCaught': buzz([15, 25, 15]); break;
    case 'joined': buzz([12, 30, 20]); break;
    case 'questDone': buzz(12); break;
    default: break;
  }
}

/** How to play: a finger's words; the keys in a row of their own, which a phone's card leaves out (mendi.ts). */
function howto(): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'drag', text: t('howto.move') },
      { gesture: 'tap', text: t('howto.tap') },
      { gesture: 'tap', text: t('howto.camp') },
      { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<DawidProgress> = {
  freshProgress,
  create: env => new DawidGame(env),
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
