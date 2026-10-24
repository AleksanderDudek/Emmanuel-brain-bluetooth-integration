/**
 * Arka — a placeholder until the game is built (the registry already lists it): a blank canvas
 * whose taps count, so the app and its smoke test run.
 */
import type { ArcadeGame, ArcadeModule, GameEnv } from '../kit/types';

interface StubProgress { v: 1; best: number }

function create(env: GameEnv<StubProgress>): ArcadeGame {
  const ctx = env.canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, score = 0;
  return {
    resize: (W, H, D) => { w = W; h = H; dpr = D; },
    intro: () => undefined,
    start: () => undefined,
    update: () => undefined,
    draw: () => {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#14161c';
      ctx.fillRect(0, 0, w, h);
    },
    pointer: e => { if (e.type === 'down') score++; },
    key: (k, down) => { if (down && k === ' ') score++; return k === ' '; },
    canStop: () => true,
    result: () => {
      env.progress.best = Math.max(env.progress.best, score);
      return { score, unit: '', record: false, stats: [], highlights: [] };
    },
    destroy: () => undefined,
  };
}

const mod: ArcadeModule<StubProgress> = {
  freshProgress: () => ({ v: 1, best: 0 }),
  create,
  best: p => (p.best > 0 ? p.best : null),
  progressPanel: () => document.createElement('div'),
  preview: (ctx, w, h) => {
    ctx.fillStyle = '#14161c';
    ctx.fillRect(0, 0, w, h);
  },
};
export default mod;
