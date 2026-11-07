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
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { FirmamentSound } from './audio';
import { t, unit } from './i18n';
import { FirmamentIntro } from './intro';
import { bestOf, freshProgress, migrate, type FirmamentProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { FirmamentView } from './render';
import { FirmamentSim, RULES, type SimEvent } from './sim';

class FirmamentGame implements ArcadeGame {
  private readonly sim: FirmamentSim;
  private readonly view: FirmamentView;
  private readonly sound: FirmamentSound;
  private readonly introScene = new FirmamentIntro();
  private dpr = 1;
  private w = 1;
  private h = 1;
  /** a drag in progress: the cell it began on and where */
  private drag: { id: number; cell: number; x: number; y: number; done: boolean } | null = null;

  constructor(private readonly env: GameEnv<FirmamentProgress>) {
    migrate(env.progress);
    this.sim = new FirmamentSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new FirmamentView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new FirmamentSound(env.audio);
    this.view.onStep = (st, shower) => this.sound.step(st, shower);
    // the app's ?debug view lets the screenshot scripts reach the rules (never in normal play)
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __firmament?: FirmamentSim }).__firmament = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.hudTop());
    if (this.sim.started) this.view.start(this.sim);
  }

  intro(dt: number, p: number): void {
    const ctx = this.env.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.hudTop());
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

  /** A tap selects, uses a tool or swaps with the selected neighbour; a drag swaps toward where it goes; on a card it goes on. */
  pointer(e: PointerInput): void {
    const sim = this.sim;
    if (e.type === 'down') {
      const hit = this.view.hit(sim, e.x, e.y);
      this.drag = null;
      if (!hit) {
        if (sim.stage === 'play') sim.tap(-1);
      } else if ('button' in hit) {
        if (hit.button === 'use') sim.useOutMoves();
        else if (hit.button === 'retry') { if (sim.stageT >= RULES.outMin) sim.retry(); }
        else sim.advance();
      } else if ('slot' in hit) sim.pickTool(hit.slot);
      else {
        sim.tap(hit.cell);
        if (sim.selected === hit.cell) this.drag = { id: e.id, cell: hit.cell, x: e.x, y: e.y, done: false };
      }
    } else if (e.type === 'move') {
      const d = this.drag;
      if (!d || d.done || d.id !== e.id || sim.selected !== d.cell) return;
      const dx = e.x - d.x, dy = e.y - d.y, reach = this.view.cellSize * RULES.dragCell;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < reach) return;
      d.done = true;
      const B = sim.board;
      const r = B.r(d.cell) + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0);
      const c = B.c(d.cell) + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0);
      if (B.inside(r, c)) sim.tap(B.at(r, c));
    } else if (this.drag?.id === e.id) this.drag = null;
    this.drain();
  }

  /** Arrows and Enter move the cursor and swap, Space plays the best move, 1–4 pick a tool. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.drag = null;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      if (e.type === 'coach') {
        const at = e.at === null ? null : 'cell' in e.at ? this.view.cellXY(e.at.cell, this.sim.board.cols) : this.view.uiPoint(e.at.ui);
        // the runner's bubble is centred on the point: keep it on the screen
        if (at) at.x = Math.max(Math.min(160, this.w / 2), Math.min(this.w - Math.min(160, this.w / 2), at.x));
        this.env.hint(t(e.key), at, 4200);
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

  destroy(): void { this.drag = null; }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'resolve': buzz(e.res.tally.cascades > 2 || e.res.tally.combo ? [8, 30, 8, 30, 12] : 8); break;
    case 'bounce': buzz(14); break;
    case 'tool': buzz([12, 40, 12, 40, 20]); break;
    case 'changed': buzz([6, 30, 10]); break;
    case 'won': buzz([10, 30, 10, 30, 30]); break;
    case 'moves': buzz([20, 40, 20]); break;
    default: break;
  }
}

const mod: ArcadeModule<FirmamentProgress> = {
  freshProgress,
  create: env => new FirmamentGame(env),
  best: p => (p.sessions > 0 ? bestOf(migrate(p)) : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p),
  howto: (): HowTo => ({
    goal: t('how.goal'),
    hands: [
      { gesture: 'drag', text: t('how.swap') },
      { gesture: 'tap', text: t('how.tool') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  }),
};
export default mod;
