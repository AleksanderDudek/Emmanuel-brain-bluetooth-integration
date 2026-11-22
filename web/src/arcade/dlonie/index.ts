/**
 * PLACEHOLDER (round 13 foundation): the builder replaces this whole folder with the game (DESIGN §18).
 * It only keeps the registry, the types and the build whole until then.
 */
import type { ArcadeGame, ArcadeModule } from '../kit/types';

interface Progress { best: number | null }

const mod: ArcadeModule<Progress> = {
  freshProgress: () => ({ best: null }),
  best: p => p.best,
  progressPanel: () => document.createElement('div'),
  preview(ctx, w, h, t) {
    ctx.fillStyle = '#120f1e';
    ctx.fillRect(0, 0, w, h);
    const r = Math.min(w, h) * (0.18 + 0.02 * Math.sin(t * 1.3));
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
    g.addColorStop(0, 'rgba(255,240,210,0.95)');
    g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  create(env): ArcadeGame {
    const ctx = env.canvas.getContext('2d')!;
    let W = 0, H = 0, lit = 0;
    return {
      resize(w, h, dpr) { W = w; H = h; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); },
      intro() { /* the calibration scene */ },
      start() { lit = 0; },
      update(dt: number, f: { level: number }) { if (f.level > 0.5) lit += dt; },
      draw() { mod.preview(ctx, W, H, lit); },
      canStop: () => true,
      destroy() { /* nothing to release */ },
      result: () => ({ score: Math.round(lit), unit: '', record: false, stats: [], highlights: [] }),
    };
  },
};

export default mod;
