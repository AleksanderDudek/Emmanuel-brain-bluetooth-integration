/**
 * Dolina (the valley): the pilgrim climbs out of the valley of the shadow (Psalm 23:4) floor by
 * floor, after Hell Escape — run, smash, build, climb, outrun the dark.  He runs by himself and his
 * sword strikes by itself what stands in front of him; a tap jumps, a second tap in the air is the
 * double jump (Ćma flaps him up), holding the press jumps higher, a swipe down stomps.  Broken stone
 * blocks fill his pack and the stones become the stair at each ledge; gates of light merge the sword
 * up (the high one only with both jumps); pens hold lost lambs; the tide of the dark follows.  The
 * band is the lamp: in a push block its reach is the level (the threshold is a dotted ring on the
 * light itself, the rim turns gold beyond it), and in that light shadows burn, the fog lifts and the
 * tide is pushed back; a held focus lights the Świt; in the meadow calm gathers pebbles for the next
 * stair and refills the oil.  Ćma talks.  Nothing ends a run early.
 *
 * Version 3: up to three companions found on the road run with him and fire their powers by
 * themselves (faster in the lamp's light above the threshold; calm in the meadow fills them), the
 * clock tower is a second mode of trial floors and keepers, and gear, chests, provisions, missions
 * and forms make the meta (the lobby's card picks the mode and the party).
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the numbers
 * in rules.ts, the data in content.ts, the meta in meta.ts and Ćma in companion.ts), the pictures
 * (render.ts with hud.ts, sprites.ts and layout.ts, intro.ts for calibration, preview.ts for the
 * lobby, all drawn with paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in
 * i18n.ts.  The runner's standard HUD shows the band's panel (signal(), meter()), the score
 * (headline()), the coach marks (env.hint, fed by the sim's `teach` events) and how to play (howto()).
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { DolinaSound } from './audio';
import { t } from './i18n';
import { bestOf, freshProgress, migrate, type DolinaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { DolinaView } from './render';
import { DolinaSim, type SimEvent } from './sim';

/**
 * A swipe down: this far (CSS px) and mostly down.  A finger's tap wobbles a few px, so a tap stays a tap
 * (the slop is twice the 10 px a tap may drift); a thumb's flick passes 20 px within its first 50 ms.
 */
export const SWIPE = 20;
/** A swipe read this soon after its own press takes back the double jump that press made (the stomp alone counts). */
export const UNDO_SEC = 0.25;

class DolinaGame implements ArcadeGame {
  private readonly sim: DolinaSim;
  private readonly view: DolinaView;
  private readonly sound: DolinaSound;
  /** the pointers down: where and when they began, whether they already swiped, whether their press was the double jump */
  private readonly touches = new Map<number, { x: number; y: number; t: number; swiped: boolean; flap: boolean }>();
  private time = 0;

  constructor(private readonly env: GameEnv<DolinaProgress>) {
    migrate(env.progress);
    this.sim = new DolinaSim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new DolinaView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new DolinaSound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.insets()); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start(this.sim);
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.time += dt;
    this.sim.hold = this.view.busy;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * One thumb, anywhere on the field: a press jumps on the press itself (not the release), in the air it is
   * the double jump; holding goes higher, letting go cuts a rising jump; a swipe down stomps.  A swipe begins
   * as a press, so a swipe read on the finger that just made the double jump takes that flap back — a
   * stomp never costs the double jump.  A press on a card or a toast also closes it (it still jumps).
   */
  pointer(e: PointerInput): void {
    if (e.type === 'down') {
      const air = this.sim.airUsed;
      this.sim.press();
      this.touches.set(e.id, { x: e.x, y: e.y, t: this.time, swiped: false, flap: this.sim.airUsed > air });
      this.view.press(e.x, e.y);
    } else if (e.type === 'move') {
      const p = this.touches.get(e.id);
      if (!p || p.swiped) return;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dy >= SWIPE && dy > Math.abs(dx) * 1.2) {
        p.swiped = true;
        if (p.flap && this.time - p.t <= UNDO_SEC) this.sim.undoAirJump();
        this.sim.stomp();
        this.view.swiped(e.x, e.y);
      }
    } else {
      this.touches.delete(e.id);
      if (!this.touches.size) this.sim.releasePress();
    }
    this.drain();
  }

  /** Space, ↑, W, Enter jump (held: higher); ↓, S stomp. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.sim.release();
      this.touches.clear();
    }
  }

  /** The field is the control (a press anywhere); only a card or a toast on screen is a target (a tap closes it). */
  targets(): TapTarget[] { return this.view.targets(); }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'teach') this.env.hint(this.teachText(e.what), this.view.toScreen(e.x, e.y, this.sim), 3600);
      if (this.env.haptics) haptic(e);
    }
  }

  /** A coach mark's words: a finger's on a phone; on a desktop the hands' first three name their keys too. */
  private teachText(what: Extract<SimEvent, { type: 'teach' }>['what']): string {
    if (!this.env.touch && (what === 'jump' || what === 'double' || what === 'stomp')) return t(`teach.${what}.keys`);
    return t(`teach.${what}`);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and, during the telegraph, the block after it. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') {
      const nb = s.started && s.phase === 'play' && b?.kind === 'warmup' ? s.next : null;
      const left = s.started && s.phase === 'play' && b ? b.dur - s.blockT : undefined;
      return { want: 'free', blind: false, left, next: nb && left !== undefined && left <= 4 ? (nb.kind === 'push' ? 'focus' : 'rest') : null };
    }
    const left = Math.max(0, b.dur - s.blockT);
    const nb = s.next;
    const next = left <= 4 ? (nb ? (nb.kind === 'push' ? 'focus' : nb.kind === 'rest' ? 'rest' : 'free') : 'free') : null;
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left, next };
  }

  /** The panel's gauge: the lamp's reach (0.5 at its threshold ring) in a push, calm in the meadow. */
  meter(): number | null { return this.sim.meter(); }

  /** The score corner: metres of the valley; under it the level and floor (in the tower: the floor and the clock), or how far the record is. */
  headline(): Headline {
    const s = this.sim;
    const best = s.bestBefore;
    let sub: string;
    if (best !== null && s.score > best) sub = t('hud.record');
    else if (best !== null && best - s.score <= 150) sub = t('hud.toRecord', { n: best - s.score });
    else sub = s.tower ? t('hud.floor', { n: s.floor, time: s.clock }) : t('hud.sub', { n: s.level, s: s.stage });
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
    case 'break': buzz(e.tall ? 18 : 10); break;
    case 'stomp': buzz(14); break;
    case 'jump': if (e.air) buzz(8); break;
    case 'gate': buzz([8, 20, 8]); break;
    case 'harm': buzz([20, 40, 20]); break;
    case 'caught': buzz([30, 30, 30]); break;
    case 'dawn': buzz([20, 30, 20, 30, 40]); break;
    case 'guard': if (e.what === 'beaten') buzz([30, 40, 30, 40, 60]); break;
    case 'level': buzz([10, 30, 10, 30, 30]); break;
    case 'fall': buzz([10, 60, 10]); break;
    case 'mate': if (e.what === 'join') buzz([20, 30, 20, 30, 50]); break;
    case 'power': buzz(e.power === 'huk' ? [24, 20, 24] : 14); break;
    case 'shield': buzz([10, 20, 10]); break;
    case 'chest': buzz([15, 25, 15, 25, 40]); break;
    case 'floorDone': buzz([10, 30, 10]); break;
    case 'shock': buzz(18); break;
    default: break;
  }
}

const mod: ArcadeModule<DolinaProgress> = {
  freshProgress,
  create: env => new DolinaGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  // the hands in finger words (a phone's card leaves the keys' row out; a desktop shows it as shortcuts)
  howto: (): HowTo => ({
    goal: t('how.goal'),
    hands: [
      { gesture: 'tap', text: t('how.tap') },
      { gesture: 'hold', text: t('how.hold') },
      { gesture: 'swipe', text: t('how.down') },
      { gesture: 'keys', text: t('how.keys') },
    ],
    tips: [t('how.tip1'), t('how.tip2')],
  }),
};
export default mod;
