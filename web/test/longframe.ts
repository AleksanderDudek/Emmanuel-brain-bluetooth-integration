/**
 * A frame-cost check for hour-long sessions (round 24, 45–60 minutes): a game module played on the runner's clock
 * for a whole session on a context that counts its calls, one frame drawn every second.  A frame late in the hour
 * should cost what a frame in the first minutes cost — what is drawn must not pile up with the session.
 * (happy-dom has no canvas: the drawing code runs, nothing is painted.)
 */
import { ArcadeAudio } from '../src/arcade/kit/audio';
import type { FocusFrame, FocusTuning } from '../src/arcade/kit/focus';
import type { ArcadeGame, ArcadeModule } from '../src/arcade/kit/types';
import { mulberry32 } from '../src/core/random';

/** A 2D context that accepts every call and counts them. */
function countingContext(canvas: unknown, count: () => void): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (t: string) => { count(); return { width: String(t).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }; };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient') return () => { count(); return gradient; };
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (prop === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (prop === 'createPattern') return () => ({ setTransform: () => undefined });
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop === 'getLineDash') return () => [];
      return () => { count(); };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export interface HourPlay<P extends object> {
  module: ArcadeModule<P>;
  progress: P;
  tuning: FocusTuning;
  /** the session's length (s), 3600 by default */
  planned?: number;
  /** the band this frame (the game in hand, its clock) */
  frame: (game: ArcadeGame, t: number) => FocusFrame;
  /** the player's hands after each update (taps, holds) */
  each?: (game: ArcadeGame, t: number) => void;
  /** after create/start (close an opening card, skip a lesson) */
  setup?: (game: ArcadeGame) => void;
  step?: number;
  size?: [number, number];
}

/** Play a whole session on the runner's clock, a frame drawn every second: the draw calls of the frames in minutes 1–6 and in the last five. */
export function hourFrames<P extends object>(o: HourPlay<P>): { early: number[]; late: number[]; game: ArcadeGame } {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  const g = globalThis as unknown as { Path2D?: unknown };
  const hadPath = 'Path2D' in g;
  let calls = 0;
  proto.getContext = function (this: HTMLCanvasElement) { return countingContext(this, () => { calls++; }); };
  if (!hadPath) g.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {} roundRect() {} arc() {} ellipse() {} rect() {} addPath() {} };
  try {
    const planned = o.planned ?? 3600, step = o.step ?? 0.05;
    const [w, h] = o.size ?? [390, 844];
    const game = o.module.create({
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: o.progress, rng: mulberry32(5), day: '2026-11-27', daySeed: 31, plannedSec: planned, tool: 'fnirs', simulated: true,
      reducedMotion: false, haptics: false, tuning: o.tuning, hint: () => {}, hudTop: () => 64, insets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
      touch: true,
    });
    game.resize(w, h, 2);
    game.start();
    o.setup?.(game);
    const early: number[] = [], late: number[] = [];
    const every = Math.round(1 / step);
    let k = 0;
    for (let t = step; t < planned + 1; t += step, k++) {
      game.update(step, o.frame(game, t), t);
      o.each?.(game, t);
      if (k % every === 0) {
        calls = 0;
        game.draw();
        if (t > 60 && t < 360) early.push(calls);
        if (t > planned - 300 && t < planned - 15) late.push(calls);
      }
    }
    // FRAME_LOG=1 prints the frames' draw calls (the round's design notes quote them)
    if (typeof process !== 'undefined' && process.env.FRAME_LOG) console.log('FRAME', Math.round(mean(early)), Math.max(...early), Math.round(mean(late)), Math.max(...late));
    return { early, late, game };
  } finally {
    proto.getContext = original;
    if (!hadPath) delete g.Path2D;
  }
}

export const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
