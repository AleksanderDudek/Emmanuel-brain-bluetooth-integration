/**
 * Brzemiona's pictures outside play: the lobby's hero and the game card (a quiet loop of the exchange on a 5 · 5
 * breath — smoke lifts from the one prayed for to the Cross, turns gold there, returns to them as light; the circle
 * widens to the many and to the night globe, and again), and the calibration intro (the Cross on its hill brightening
 * as the reference fills, the player near, the one prayed for appearing faintly at its end — the call).  The
 * runner's calibration card covers the lower part of the screen, so the intro's picture sits high.
 */
import { breathAt } from '../kit/breath';
import { approach, clamp } from '../kit/juice';
import { t } from './i18n';
import { manyCount, type Layout } from './layout';
import type { BrzProgress } from './meta';
import { Scene, type SceneState } from './scene';

const scenes = new Map<string, Scene>();
const sceneFor = (key: string): Scene => {
  let s = scenes.get(key);
  if (!s) {
    if (scenes.size > 6) scenes.clear();
    s = new Scene();
    scenes.set(key, s);
  }
  return s;
};

type Pic = Pick<Layout, 'pic' | 'orient' | 'u' | 'desk' | 'w' | 'h'>;
const picOf = (w: number, h: number, box: { x: number; y: number; w: number; h: number }): Pic => ({
  w, h, u: 1, desk: false, pic: box, orient: box.h >= box.w * 0.95 ? 'down' : 'across',
});

const EVEN = { in: 5, holdIn: 0, out: 5, holdOut: 0 } as const;

/** The loop's state at time t: 16 s a circle (one, many, the world), the light growing over each. */
function loopState(tm: number, lightOnly: boolean): SceneState {
  const cyc = 16, k = (tm % (cyc * 3)) / cyc;
  const circle = Math.floor(k), x = clamp((k - circle) * 1.15 - 0.05);
  const b = breathAt(EVEN, tm);
  return {
    time: tm, warm: 0.25 + 0.2 * Math.sin(tm * 0.05), appear: 1,
    light: circle === 0 ? x : 1, cloud: 1 - x, lightMany: circle === 1 ? x : circle === 2 ? 1 : 0, lightWorld: circle === 2 ? x : 0,
    many: circle >= 1 ? clamp((k - 1) * 4) : 0, world: circle === 2 ? clamp((k - 2) * 4) : 0,
    waiting: x < 0.95 ? 0.8 : 0, gold: b.phase === 'in' ? 0.15 * b.p : 0.15 * (1 - b.p), glow: x > 0.05 && x < 0.95 ? 0.75 : 0.1, rest: x >= 0.95 ? 0.7 : 0,
    phase: b.phase, p: b.p, k: b.k, flows: x < 0.97, lightOnly, reduced: false, player: 0.6, touch: 0,
    whoLabel: null, youLabel: null, labelPx: 13,
  };
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, tm: number, p?: BrzProgress): void {
  if (w < 4 || h < 4) return;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const L = picOf(w, h, { x: 0, y: 0, w, h: h * (p ? 0.82 : 1) });
  const scene = sceneFor(`${Math.round(w)}x${Math.round(h)}@${dpr}|${p ? 1 : 0}`);
  scene.draw(ctx, L, dpr, loopState(Math.max(0, tm), !!p?.lightOnly), manyCount(L));
}

/** The calibration intro: the Cross brightens as the reference fills; the one prayed for appears at its end. */
export class BrzIntro {
  private clock = 0;
  private shown = 0;
  private readonly scene = new Scene();

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: BrzProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.5);
    const L = picOf(w, h, { x: 0, y: 0, w, h: h * 0.62 });
    const b = breathAt(EVEN, this.clock);
    const st: SceneState = {
      time: this.clock, warm: 0.08 + 0.12 * this.shown, appear: clamp((this.shown - 0.55) * 2.2) * 0.8,
      light: 0, cloud: progress.lightOnly ? 0 : 1, lightMany: 0, lightWorld: 0, many: 0, world: 0,
      waiting: 0, gold: 0, glow: 0.25 * this.shown, rest: 0.6 * this.shown,
      phase: b.phase, p: b.p, k: b.k, flows: false, lightOnly: progress.lightOnly, reduced: false, player: 0.5 + 0.4 * this.shown, touch: 0,
      whoLabel: null, youLabel: this.shown > 0.2 ? t('who.you') : null, labelPx: 13,
    };
    ctx.clearRect(0, 0, w, h);
    this.scene.draw(ctx, L, dpr, st, manyCount(L));
  }
}
