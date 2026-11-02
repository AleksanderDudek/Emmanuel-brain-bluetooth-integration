/**
 * Zastępy (the hosts): a lane battler after Revelation 12:7-8 — the gate of light on the left, the
 * gate of ash on the right, one road between them.  Light flows into a bar; a tap on a unit card (or
 * 1–6, Space for the cheapest ready one) sends that angel out of the gate, and the units walk and
 * fight on their own; the battle is won when the gate of ash falls (in the tenth battle of a circle,
 * when the Smok falls).  Gold from the demons beaten buys the gate's levels and the units' levels,
 * on the short card between battles or in the lobby.  The band only adds: in a Natarcie the level
 * speeds the flow of light (never below the base) and a held focus charges the trumpet (a tap or T
 * sounds it); in a Cisza the demons slow and calm mends the walls and lays shields of light; the
 * banners along the road keep the last 40 s.  If the gate of light falls the host withdraws, keeps
 * its gold and tries again with stronger walls.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the road
 * in battle.ts, the numbers in rules.ts and the meta in meta.ts), the pictures (render.ts with
 * hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn with
 * paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts and
 * content.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, PointerInput, SignalPhase } from '../kit/types';
import { ZastepySound } from './audio';
import { unit } from './i18n';
import { bestOf, freshProgress, type ZastepyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ZastepyView } from './render';
import { ZastepySim, type SimEvent } from './sim';

class ZastepyGame implements ArcadeGame {
  private readonly sim: ZastepySim;
  private readonly view: ZastepyView;
  private readonly sound: ZastepySound;

  constructor(private readonly env: GameEnv<ZastepyProgress>) {
    this.sim = new ZastepySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ZastepyView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg' });
    this.sound = new ZastepySound(env.audio);
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
    this.sound.update(dt);
  }

  draw(): void { this.view.draw(this.sim); }

  /** A tap on a card sends, on the trumpet sounds, on the card between battles buys or goes on; a drag on the road pans. */
  pointer(e: PointerInput): void {
    const hit = this.view.pointer(e.type, e.x, e.y, e.id, this.sim);
    if (!hit) return;
    if (hit.kind === 'card') this.sim.send(hit.id);
    else if (hit.kind === 'trumpet') this.sim.sound();
    else if (hit.kind === 'offer') this.sim.buy(hit.i);
    else this.sim.skip();
    this.drain();
  }

  /** 1–6 the cards (between battles 1–3 the offers), Space the cheapest, T the trumpet, Enter goes on. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.view.release();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, for the runner's signal dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || !b || b.kind === 'warmup') return { want: 'free', blind: false };
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip };
  }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.view.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'sent': buzz(8); break;
    case 'trumpet': buzz([20, 40, 20, 40, 30]); break;
    case 'trumpetReady': buzz([10, 30, 10]); break;
    case 'won': buzz([15, 30, 15, 30, 40]); break;
    case 'smok': buzz([40, 60, 40]); break;
    case 'nope': buzz(4); break;
    default: break;
  }
}

const mod: ArcadeModule<ZastepyProgress> = {
  freshProgress,
  create: env => new ZastepyGame(env),
  best: p => (p.sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
