/**
 * Motylarnia — steer a very hungry caterpillar across a leaf: the path it eats becomes the pattern
 * of its wings, focus makes it eat faster and draw bolder lines, and calm in the chrysalis deepens
 * the colours.  This module ties the pure rules (sim.ts) to the picture (render.ts), the sound
 * (audio.ts) and the lobby (preview.ts, panel.ts) under the arcade contract (kit/types.ts).
 */
import { mulberry32 } from '../../core/random';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, GameEnv, PointerInput } from '../kit/types';
import { PIGMENTS, RASPBERRY_POLLEN, SIZE_CLASSES } from './content';
import { MothSound } from './audio';
import { toScreen } from './layout';
import { freshProgress, type MothProgress } from './meta';
import { INK } from './paint';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { MothRenderer } from './render';
import { MothSim, type SimEvent } from './sim';

class Motylarnia implements ArcadeGame {
  private readonly sim: MothSim;
  private readonly view: MothRenderer;
  private readonly sound: MothSound;
  private dt = 0;
  private readonly pt = { x: 0, y: 0 };

  constructor(private readonly env: GameEnv<MothProgress>) {
    this.sim = new MothSim({ progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, tool: env.tool });
    this.view = new MothRenderer(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new MothSound(env.audio, mulberry32(Math.floor(env.rng() * 2 ** 31)));
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void { this.view.intro(dt, p); }

  start(): void {
    this.sim.start();
    this.sound.start();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.dt = dt;
    this.sim.update(dt, f, t);
    for (const e of this.sim.drain()) this.onEvent(e);
    this.sound.tick(dt, this.sim);
  }

  draw(): void {
    if (!this.sim.started) return;   // calibration and countdown: intro() has drawn the frame
    this.view.draw(this.sim, this.dt);
    this.dt = 0;
  }

  private haptic(ms: number | number[]): void {
    if (this.env.haptics) buzz(ms);
  }

  /** Juice for what the rules report: particles, words, sound, a buzz. */
  private onEvent(e: SimEvent): void {
    this.sound.event(e);
    const v = this.view, fl = v.floaters;
    const at = (x: number, y: number) => toScreen(v.L, x, y, this.pt);
    switch (e.type) {
      case 'pick':
        this.haptic(10);
        break;
      case 'dot': {
        const p = at(e.x, e.y);
        v.particles.burst(p.x, p.y, 14, { color: PIGMENTS[e.pigment].color, speed: 120, life: 0.7, g: 120, shape: 'dot', size: 3 });
        this.haptic(8);
        break;
      }
      case 'treat': {
        const p = at(e.x, e.y);
        v.particles.burst(p.x, p.y, 18, { color: e.kind === 'malina' ? '#D23452' : '#FFFFFF', speed: e.kind === 'malina' ? 120 : 60, life: 1.1, g: e.kind === 'malina' ? 160 : -30, shape: e.kind === 'malina' ? 'dot' : 'spark', size: 2.5 });
        fl.add(e.kind === 'malina' ? `+${RASPBERRY_POLLEN} pyłku` : 'Większe skrzydła', p.x, p.y - 20, { color: e.kind === 'malina' ? '#A3243D' : INK, size: 20 });
        this.haptic(12);
        break;
      }
      case 'class':
        fl.add(`Rozmiar ${SIZE_CLASSES[e.cls]}`, v.w / 2, v.h * 0.32, { color: INK, size: 26 });
        this.haptic(15);
        break;
      case 'bold':
        fl.add('Śmiałe linie!', v.w / 2, v.h * 0.38, { color: '#8E2C67', size: 28, dur: 1.6 });
        break;
      case 'silk':
        fl.add('Jedwabna nić!', v.w / 2, v.h * 0.44, { color: '#8A6A12', size: 26, dur: 1.6 });
        break;
      case 'full':
        fl.add('Najedzona!', v.w / 2, v.h * 0.5, { color: INK, size: 36, dur: 1.4 });
        this.haptic(25);
        break;
      case 'deep':
        fl.add('Głębokie barwy', v.w / 2, v.h * 0.62, { color: '#22378F', size: 26, dur: 1.8 });
        break;
      case 'emerge':
        this.haptic([20, 40, 30]);
        break;
      default:
        break;
    }
  }

  pointer(e: PointerInput): void {
    const sim = this.sim;
    if (sim.phase === 'leaf') {
      if (e.type === 'down') {
        const i = this.view.cardAt(e.x, e.y);
        if (i >= 0) sim.pick(i);
      }
      return;
    }
    if (sim.phase !== 'feed' && e.type !== 'up') return;
    const p = this.view.toLeaf(sim, e.x, e.y);
    sim.pointer(e.type, p.x, p.y);
  }

  key(key: string, down: boolean): boolean { return this.sim.key(key, down); }

  canStop(): boolean { return this.sim.canStop(); }

  /** The pad follows the appetite and a seen chrysalis' clearing, and holds still in a blind cocoon. */
  padLevel(): number | null { return this.sim.padLevel(); }

  finish(): void { this.sim.finish(); }

  result() { return this.sim.result(); }

  destroy(): void { /* the renderer's canvases go with the game */ }
}

const mod: ArcadeModule<MothProgress> = {
  freshProgress,
  create: env => new Motylarnia(env),
  best: p => (p.total > 0 || p.bestSession > 0 ? p.bestSession : null),
  progressPanel: p => progressPanel(p),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
};
export default mod;
