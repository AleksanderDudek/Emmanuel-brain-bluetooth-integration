/**
 * Firmament (stars in threes): a match-3 saga in the night sky after Candy Crush Saga, rooted in
 * Psalm 147:4 — "He determines the number of the stars; He calls them each by name."  Bubo, a young
 * eagle-owl astronomer, wants to count them all.  Swap two neighbouring sky bodies (a drag, or a tap
 * and a tap) to line up three or more; four make a comet, an L or a T a supernova, five a pulsar, a
 * square a meteor; specials swapped together combine.  Each level is a star of a constellation on the
 * saga map, with one goal (a score, dark clouds, moons to bring down, bodies to collect, asteroids),
 * limited moves and three stars; a won level ends in a comet shower, running out of moves is a gentle
 * retry.  The band is the telescope: in an Obserwacja focus above the threshold fills its charge ring,
 * and a full ring is a tool (the star hammer, the ray, a shuffle, +5 moves, a pulsar after a long hold);
 * in the Cisza nocy calm brings falling stars that leave comets and two moves.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, the engine in
 * board.ts, the saga in levels.ts, the numbers in rules.ts, the meta in meta.ts), the pictures
 * (render.ts with hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn
 * with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the data in content.ts, the
 * words in i18n.ts.
 *
 * Under a finger (DESIGN §12): a swipe on a body swaps it with the neighbour it points to (from 10 px,
 * a third of a cell); a tap selects, a tap on a neighbour swaps, a tap on the selected one lets it go —
 * decided when the finger lifts, so a swipe from a body picked by a tap still swaps.  An aimed tool shows
 * its strike while the finger is down and strikes where it lifts.  A tool in the tray acts on the touch.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { FirmamentSound } from './audio';
import { AIMED } from './content';
import { t, unit, type Key } from './i18n';
import { FirmamentIntro } from './intro';
import { inRect, tapTargets } from './layout';
import { bestOf, freshProgress, migrate, type FirmamentProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { FirmamentView } from './render';
import { FirmamentSim, RULES, type SimEvent } from './sim';

/** The coach marks a finger reads in other words (no keys on a phone). */
const TOUCH_WORDS: Partial<Record<Key, Key>> = { 'hint.space': 'hint.space.touch' };

class FirmamentGame implements ArcadeGame {
  private readonly sim: FirmamentSim;
  private readonly view: FirmamentView;
  private readonly sound: FirmamentSound;
  private readonly introScene = new FirmamentIntro();
  private dpr = 1;
  private w = 1;
  private h = 1;
  /**
   * A finger (or the mouse) on a body: the cell it began on and where, what that body was when it came
   * down (the selected one, the selected one's neighbour, or a new pick), and whether it has swiped yet.
   */
  private press: { id: number; cell: number; x: number; y: number; was: 'selected' | 'neighbour' | 'new'; done: boolean } | null = null;
  /** an armed tool held over the board (it strikes where the finger lifts) */
  private aiming: number | null = null;
  /** a finger on a tray's slot (its pressed look) */
  private slotDown: { id: number; slot: number } | null = null;

  constructor(private readonly env: GameEnv<FirmamentProgress>) {
    migrate(env.progress);
    this.sim = new FirmamentSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new FirmamentView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg', touch: env.touch });
    this.sound = new FirmamentSound(env.audio);
    this.view.onStep = (st, shower) => this.sound.step(st, shower);
    // the app's ?debug view lets the screenshot scripts reach the rules (never in normal play)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __firmament?: FirmamentSim }).__firmament = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
    if (this.sim.started) this.view.start(this.sim);
  }

  intro(dt: number, p: number): void {
    const ctx = this.env.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.start();
    this.view.start(this.sim);
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * A touch: on a card it goes on (or presses its button); on a tool it picks it; on a body it presses it —
   * a swipe swaps it toward where it goes, a tap selects, swaps with the selected neighbour or lets go; with
   * an aimed tool armed it aims, and strikes where the finger lifts.  The free sky lets the selection go.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      this.letGo();
      const hit = view.hit(sim, e.x, e.y);
      if (!hit) {
        if (sim.stage === 'play') sim.tap(-1);
        view.hush();
      } else if ('button' in hit) {
        if (hit.button === 'use') sim.useOutMoves();
        else if (hit.button === 'retry') { if (sim.stageT >= RULES.outMin) sim.retry(); }
        else sim.advance();
      } else if ('slot' in hit) {
        sim.pickTool(hit.slot);
        this.slotDown = { id: e.id, slot: hit.slot };
        view.pressSlot = hit.slot;
      } else {
        view.hush();
        const B = sim.board, cell = hit.cell, tool = sim.armedTool;
        if (sim.stage === 'play' && tool && AIMED.includes(tool)) {
          this.aiming = e.id;
          view.aim = cell;
        } else if (sim.stage === 'play' && B.free(cell)) {
          const was = sim.selected === cell ? 'selected' : sim.selected >= 0 && B.adjacent(sim.selected, cell) ? 'neighbour' : 'new';
          // a new pick lights at once; a tap on the selected body or its neighbour waits for the lift (it may be a swipe)
          if (was === 'new') sim.tap(cell);
          this.press = { id: e.id, cell, x: e.x, y: e.y, was, done: false };
          view.press = { cell, dx: 0, dy: 0 };
        } else sim.tap(cell);
      }
    } else if (e.type === 'move') {
      if (this.aiming === e.id) view.aim = view.cellAt(sim, e.x, e.y);
      const p = this.press;
      if (p && p.id === e.id && !p.done) {
        const dx = e.x - p.x, dy = e.y - p.y;
        view.press = { cell: p.cell, dx, dy };
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= view.L.reach) {
          p.done = true;
          view.press = null;
          const B = sim.board;
          const r = B.r(p.cell) + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0);
          const c = B.c(p.cell) + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0);
          if (B.inside(r, c)) sim.swipe(p.cell, B.at(r, c));
        }
      }
      const sd = this.slotDown;
      if (sd && sd.id === e.id && !inRect(view.L.tray[sd.slot], e.x, e.y, 10)) view.pressSlot = -1;
    } else {
      if (this.aiming === e.id) {
        const at = view.aim;
        this.aiming = null;
        view.aim = -1;
        if (at >= 0) sim.tap(at);
      }
      const p = this.press;
      if (p && p.id === e.id) {
        if (!p.done) {
          // a tap: on the selected body it lets go, on its neighbour it swaps (a new pick lit on the way down)
          if (p.was === 'selected' && sim.selected === p.cell) sim.tap(p.cell);
          else if (p.was === 'neighbour' && sim.selected >= 0 && sim.selected !== p.cell) sim.tap(p.cell);
        }
        this.press = null;
        view.press = null;
      }
      if (this.slotDown?.id === e.id) {
        this.slotDown = null;
        view.pressSlot = -1;
      }
    }
    this.drain();
  }

  /** Forget a gesture in progress (a new touch, a pause). */
  private letGo(): void {
    this.press = null;
    this.aiming = null;
    this.slotDown = null;
    this.view.press = null;
    this.view.aim = -1;
    this.view.pressSlot = -1;
  }

  /** Arrows and Enter move the cursor and swap, Space plays the best move, 1–4 pick a tool. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
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
      if (e.type === 'coach') {
        // a mark about the play as a whole points at the sky's upper middle (the board, never the columns or the dock)
        const B = this.view.L.board;
        const at = e.at === null ? { x: B.x + B.w / 2, y: B.y + B.h * 0.3 } : 'cell' in e.at ? this.view.cellXY(e.at.cell, this.sim.board.cols) : this.view.uiPoint(e.at.ui);
        // the runner's bubble is centred on the point: keep it on the screen
        at.x = Math.max(Math.min(160, this.w / 2), Math.min(this.w - Math.min(160, this.w / 2), at.x));
        this.env.hint(t((this.env.touch && TOUCH_WORDS[e.key]) || e.key), at, 4200);
      }
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase { return this.sim.signal(); }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline { return this.sim.headline(); }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  /** The tray's tools in play, a card (a tap goes on), or out of moves its two buttons (layout.ts). */
  targets(): TapTarget[] {
    const sim = this.sim, L = this.view.L;
    if (!L || !sim.started || sim.phase !== 'play') return [];
    return tapTargets(L, { stage: sim.stage, tools: Math.min(sim.tray.length, sim.traySize), can: sim.tray.includes('moves') });
  }

  destroy(): void { this.letGo(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'resolve': buzz(e.res.tally.cascades > 2 || e.res.tally.combo ? [8, 30, 8, 30, 12] : 8); break;
    case 'bounce': buzz(14); break;
    case 'tool': buzz([12, 40, 12, 40, 20]); break;
    case 'toolUsed': buzz(12); break;
    case 'changed': buzz([6, 30, 10]); break;
    case 'won': buzz([10, 30, 10, 30, 30]); break;
    case 'moves': buzz([20, 40, 20]); break;
    default: break;
  }
}

/** How to play, in the words of the hand the player has: a swipe on a phone, a drag and the keys on a desktop. */
export function howto(touch: boolean): HowTo {
  return {
    goal: t('how.goal'),
    hands: [
      touch ? { gesture: 'swipe', text: t('how.swipe') } : { gesture: 'drag', text: t('how.swap') },
      { gesture: 'tap', text: t('how.tool') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  };
}

const mod: ArcadeModule<FirmamentProgress> = {
  freshProgress,
  create: env => new FirmamentGame(env),
  best: p => (p.sessions > 0 ? bestOf(migrate(p)) : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p),
  howto: (): HowTo => howto(coarsePointer()),
};
export default mod;
