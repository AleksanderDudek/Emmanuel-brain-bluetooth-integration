/**
 * Arka (DESIGN.md §9): an escape puzzle on the open deck of Noah's ark after the flood.  Tap an
 * animal and it walks straight out the way it faces; at the door it waits for its mate, and the two
 * go down the ramp together onto a washed new land.  By Day steady focus lets Noah's family lay
 * planks for a longer landing; in the Evening the deck sleeps under straw while the dove flies, and
 * calm brings it back with an olive leaf, a help for the next jam.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts, holds.ts,
 * meta.ts), the pictures (render.ts with hud.ts, land.ts and layout.ts, intro.ts for calibration,
 * preview.ts for the lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's progress
 * card (panel.ts); the data in content.ts, the words in i18n.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { ArkaSound } from './audio';
import { unit } from './i18n';
import { freshProgress, type ArkaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ArkaView } from './render';
import { ArkaSim, type SimEvent } from './sim';

const ARROWS: Readonly<Record<string, [number, number]>> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

class ArkaGame implements ArcadeGame {
  private readonly sim: ArkaSim;
  private readonly view: ArkaView;
  private readonly sound: ArkaSound;
  /** a touch pressed on an animal (its id and cell): released on the same cell it sends it */
  private press: { id: number; x: number; y: number; pointer: number } | null = null;
  private leafPress = false;
  private stallPress = -1;
  private sendHeld = false;

  constructor(private readonly env: GameEnv<ArkaProgress>) {
    this.sim = new ArkaSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ArkaView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new ArkaSound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim, this.view.hammerHit);
    if (this.press && !this.sim.active) this.press = null;
  }

  draw(): void { this.view.draw(this.sim, this.press?.id ?? null); }

  /**
   * Touch: a press on an animal shows its way out, the release on the same cell sends it, a drag
   * off the cell cancels.  The leaf chip arms an olive leaf; the next tap on a waiting animal uses it.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view;
    if (e.type === 'down') {
      this.leafPress = view.onLeaf(sim, e.x, e.y);
      this.stallPress = -1;
      this.press = null;
      if (this.leafPress) return;
      if (sim.leafArmed) {
        const b = view.stallBeast(sim, e.x, e.y);
        this.stallPress = b ? b.id : -1;
        if (!b) sim.armLeaf(false);   // a tap elsewhere puts the leaf away
        return;
      }
      if (!sim.active) return;
      const cell = view.cellAt(sim, e.x, e.y);
      const b = cell ? sim.beastAt(cell.x, cell.y) : null;
      if (b && b.state === 'deck') this.press = { id: b.id, x: cell!.x, y: cell!.y, pointer: e.id };
      return;
    }
    if (e.type === 'move') {
      const p = this.press;
      if (!p || p.pointer !== e.id) return;
      const cell = view.cellAt(sim, e.x, e.y);
      if (!cell || cell.x !== p.x || cell.y !== p.y) this.press = null;   // dragged off: cancelled
      return;
    }
    // up
    if (this.leafPress) {
      this.leafPress = false;
      if (view.onLeaf(sim, e.x, e.y)) sim.armLeaf();
      return;
    }
    if (this.stallPress >= 0) {
      const b = view.stallBeast(sim, e.x, e.y);
      if (b && b.id === this.stallPress) sim.useLeaf(b.id);
      this.stallPress = -1;
      return;
    }
    const p = this.press;
    this.press = null;
    if (!p || p.pointer !== e.id) return;
    const cell = view.cellAt(sim, e.x, e.y);
    if (cell && cell.x === p.x && cell.y === p.y) {
      sim.send(p.id);
      this.drain();
    }
  }

  /** Arrows move the cursor, Space or Enter sends, L uses a leaf, R held for a second gives the waiting animals back. */
  key(key: string, down: boolean): boolean {
    const sim = this.sim;
    const arrow = ARROWS[key];
    if (arrow) {
      if (down) sim.moveCursor(arrow[0], arrow[1]);
      return true;
    }
    if (key === ' ' || key === 'Enter') {
      if (down && !this.sendHeld) {
        sim.keySend();
        this.drain();
      }
      this.sendHeld = down;
      return true;
    }
    if (key === 'l' || key === 'L') {
      if (down) {
        sim.useLeaf();
        this.drain();
      }
      return true;
    }
    if (key === 'r' || key === 'R') {
      sim.restartKey(down);
      return true;
    }
    return false;
  }

  pause(paused: boolean): void {
    if (!paused) return;
    this.press = null;
    this.sendHeld = false;
    this.sim.restartKey(false);
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  /** The pad follows the hammer's level in a sighted Day and holds still elsewhere (sim.ts). */
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** Ended early: the sim settles at once; the view and the sound are about to go, so its events are dropped. */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { /* the runner stops the audio; the canvases go with the view */ }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'pair': buzz(e.chain >= 2 ? [12, 30, 12] : 12); break;
    case 'plank': if (!e.blind) buzz([10, 30, 10]); break;
    case 'clear': buzz([20, 40, 20, 40, 30]); break;
    case 'hand': buzz(15); break;
    case 'bump': buzz(6); break;
    default: break;
  }
}

const mod: ArcadeModule<ArkaProgress> = {
  freshProgress,
  create: env => new ArkaGame(env),
  best: p => (p.sessions > 0 ? p.bestSession : null),
  unit,
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
