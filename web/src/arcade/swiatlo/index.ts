/**
 * Placeholder for swiatlo (DESIGN.md §13) until its builder lands the game: a dark canvas whose score
 * follows the clock and the focus, so the app, the cards and the smoke run while it is being built.
 */
import { t } from '../../i18n/arcade';
import type { ArcadeGame, ArcadeModule, GameEnv } from '../kit/types';

interface Progress { ver: 1; sessions: number }

function create(env: GameEnv<Progress>): ArcadeGame {
  const ctx = env.canvas.getContext('2d')!;
  let w = 1, h = 1, score = 0;
  const draw = () => {
    ctx.fillStyle = '#14121c';
    ctx.fillRect(0, 0, w, h);
  };
  return {
    resize(nw, nh) { w = nw; h = nh; },
    intro: () => draw(),
    start: () => { env.progress.sessions++; },
    update: (dt, f) => { score += dt * (1 + (f.reliable ? f.level : 0)); },
    draw,
    canStop: () => true,
    headline: () => ({ value: Math.floor(score) }),
    result: () => ({ score: Math.floor(score), unit: t('swiatlo.unit'), record: false, stats: [], highlights: [] }),
    destroy: () => undefined,
  };
}

const mod: ArcadeModule<Progress> = {
  freshProgress: () => ({ ver: 1, sessions: 0 }),
  best: () => null,
  create,
  progressPanel: () => document.createElement('div'),
  preview(ctx, w, h) {
    ctx.fillStyle = '#14121c';
    ctx.fillRect(0, 0, w, h);
  },
};

export default mod;
