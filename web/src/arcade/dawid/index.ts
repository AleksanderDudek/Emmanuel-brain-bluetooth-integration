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
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the numbers in
 * rules.ts, the data in content.ts, the meta in meta.ts and the lamb's bubble in talk.ts), the pictures
 * (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn
 * with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts.
 */
import { fmtNum } from '../../i18n';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { DawidSound } from './audio';
import { landName } from './content';
import { t, unit, xpText } from './i18n';
import { bestOf, freshProgress, migrate, type DawidProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { DawidView } from './render';
import { RULES } from './rules';
import { DawidSim, type Coach, type SimEvent } from './sim';

class DawidGame implements ArcadeGame {
  private readonly sim: DawidSim;
  private readonly view: DawidView;
  private readonly sound: DawidSound;
  /** the finger on the field: where it went down and when, how far it went */
  private touch: { id: number; x: number; y: number; at: number; far: number } | null = null;
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
    this.sound = new DawidSound(env.audio);
    // ?debug: the session in the console (and for screenshot scripts)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __dawid?: unknown }).__dawid = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.view.resize(w, h, dpr);
    this.view.setTop(this.env.hudTop());
    this.sim.setView(this.view.L.halfW, this.view.L.halfH);
  }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.view.setTop(this.env.hudTop());
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

  /**
   * A press: on a story card it moves on; on the camp's card a tab or a tile; on the bag it walks home;
   * on the great stone's dial it throws.  Elsewhere it is a floating joystick: a drag steers, and a short
   * tap sends David hunting (near him) or walking to the spot (farther).
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view, hud = view.hud, L = view.L;
    if (e.type === 'down') {
      if (sim.story) {
        sim.tap();
        this.drain();
        return;
      }
      if (hud.onCard(e.x, e.y)) {
        const tab = hud.tabAt(e.x, e.y);
        if (tab) sim.setTab(tab);
        else {
          const i = hud.tileAt(e.x, e.y);
          if (i >= 0) sim.campTap(i);
        }
        this.drain();
        return;
      }
      if (hud.bagAt(L, e.x, e.y)) {
        sim.goHome();
        this.drain();
        return;
      }
      if (sim.stoneReady && hud.stoneAt(L, e.x, e.y)) {
        sim.throwGreat();
        this.drain();
        return;
      }
      this.touch = { id: e.id, x: e.x, y: e.y, at: this.now, far: 0 };
      return;
    }
    const tc = this.touch;
    if (!tc || tc.id !== e.id) return;
    const dx = e.x - tc.x, dy = e.y - tc.y, d = Math.hypot(dx, dy);
    tc.far = Math.max(tc.far, d);
    if (e.type === 'up') {
      this.touch = null;
      view.stick = null;
      sim.steer(0, 0);
      if (this.now - tc.at <= RULES.tapSec && tc.far <= RULES.tapPx) {
        const w = view.toWorld(e.x, e.y);
        sim.tap(w.x, w.y);
        this.drain();
      }
      return;
    }
    if (d > RULES.stickDead) {
      // the joystick's origin follows a finger that goes past its rim (it never falls behind)
      if (d > RULES.stickPx * 1.4) {
        const k = (d - RULES.stickPx * 1.4) / d;
        tc.x += dx * k;
        tc.y += dy * k;
      }
      sim.steer((e.x - tc.x) / RULES.stickPx, (e.y - tc.y) / RULES.stickPx);
      view.stick = { ox: tc.x, oy: tc.y, x: e.x, y: e.y };
    } else sim.steer(0, 0);
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
      this.touch = null;
      this.view.stick = null;
    }
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
    const L = this.view.L;
    let at: { x: number; y: number };
    switch (h.what) {
      case 'bag': at = { x: L.bag.x, y: L.bag.y - L.bag.r }; break;
      case 'stone':
        if (!sim.stoneReady) { this.hints.shift(); return; }
        at = { x: L.stone.x, y: L.stone.y - L.stone.r };
        break;
      case 'quest': at = this.view.hud.arrowAt ?? { x: L.quest.x + Math.min(L.quest.w, 160 * L.u) / 2, y: L.quest.y + L.quest.h }; break;
      case 'level': at = { x: L.xp.x + 60 * L.u, y: L.xp.y }; break;
      case 'camp': {
        const c = this.view.hud.cardShown;
        if (!sim.inCamp) { this.hints.shift(); return; }
        at = c ? { x: c.x + c.w / 2, y: c.y } : { x: L.kx, y: L.ky };
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
    at = { x: Math.max(20, Math.min(L.w - 20, at.x)), y: Math.max(L.top + 10, Math.min(h.what === 'level' || h.what === 'bag' || h.what === 'stone' ? L.bottom - 10 : L.hp.y - 14, at.y)) };
    this.hints.shift();
    const ms = h.what === 'move' || h.what === 'sling' || h.what === 'harp' || h.what === 'camp' ? 5000 : 3800;
    this.hintCool = ms / 1000 + 0.6;
    this.env.hint(t(`coach.${h.what}`), at, ms);
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
    default: break;
  }
}

function howto(): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'drag', text: t('howto.move') },
      { gesture: 'tap', text: t('howto.tap') },
      { gesture: 'tap', text: t('howto.camp') },
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
