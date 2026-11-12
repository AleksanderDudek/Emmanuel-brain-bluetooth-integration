/**
 * Ogień's picture for the lobby's hero and the game card.  On the card (no progress): a fire on a dark hill
 * whose sparks rise and become stars, under a sky already full of them — the game's whole idea in one look.
 * In the lobby (with progress): the player's own night sky — one star for every session, as bright and as
 * warm as the highest fire it reached (meta.ts `skyPlace`, `starLook`) — over the hill, and the fire of their
 * best so far burning on it.  The static sky is cached per size and per number of stars; every frame adds
 * only the twinkle, the fire and its sparks.
 */
import { RUNGS } from './content';
import { fireOf, skyPlace, starLook, type OgienProgress } from './meta';
import { FIRE, SPIRIT, drawBlaze, drawFlame, drawGlow, drawGlowEllipse, seeded } from './paint';

let cache: { key: string; c: HTMLCanvasElement | null } | null = null;

function sky(w: number, h: number, p: OgienProgress | undefined): HTMLCanvasElement | null {
  const n = p?.sky.length ?? -1;
  const key = `${Math.round(w)}x${Math.round(h)}|${n}|${p?.sky.at(-1)?.top ?? -1}`;
  if (cache?.key === key) return cache.c;
  let c: HTMLCanvasElement | null = null;
  if (typeof document !== 'undefined') {
    c = document.createElement('canvas');
    const s = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(s, 0, 0, s, 0, 0);
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#05061a');
      bg.addColorStop(0.65, '#151338');
      bg.addColorStop(1, '#2c1a30');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // the Milky Way, faint, across the sky
      g.save();
      g.translate(w * 0.5, h * 0.38);
      g.rotate(-0.5);
      for (let i = 0; i < 12; i++) drawGlowEllipse(g, (i - 6) * w * 0.09, Math.sin(i * 1.7) * h * 0.02, w * 0.12, h * 0.05, [150, 140, 210], 0.09);
      g.restore();
      // faint background stars (the same everywhere)
      const rnd = seeded(5);
      for (let i = 0; i < Math.round(w * h / 900); i++) {
        g.fillStyle = `rgba(230,230,255,${(0.15 + rnd() * 0.4).toFixed(3)})`;
        g.fillRect(rnd() * w, rnd() * h * 0.8, 1, 1);
      }
      // the far hills
      g.fillStyle = '#0e0c20';
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += w / 24) g.lineTo(x, h * 0.8 - Math.sin(x / w * 5 + 1) * h * 0.04 - Math.sin(x / w * 13) * h * 0.015);
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    } else c = null;
  }
  cache = { key, c };
  return c;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: OgienProgress): void {
  const back = sky(w, h, p);
  if (back) ctx.drawImage(back, 0, 0, w, h);
  else {
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(0, 0, w, h);
  }
  const s = Math.min(w, h);
  // the stars of the player's sessions (or, on the card, a sky the sparks are becoming)
  ctx.globalCompositeOperation = 'lighter';
  const skyH = h * 0.74;
  if (p && p.sky.length) {
    for (const st of p.sky) {
      const pl = skyPlace(st.n), look = starLook(st.top);
      const x = pl.x * w, y = pl.y * skyH;
      const tw = 0.8 + 0.2 * Math.sin(t * (1.1 + (st.n % 5) * 0.3) + st.n);
      const r = s * (0.012 + 0.03 * look.size) * tw;
      drawGlow(ctx, x, y, r * 3.2, look.rgb, 0.45);
      drawGlow(ctx, x, y, r, [255, 252, 240], 0.95, 0.6);
      if (look.rays) {
        ctx.strokeStyle = `rgba(${look.rgb.join(',')},${(0.35 * tw).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - r * 4, y);
        ctx.lineTo(x + r * 4, y);
        ctx.moveTo(x, y - r * 4);
        ctx.lineTo(x, y + r * 4);
        ctx.stroke();
      }
    }
  } else {
    const rnd = seeded(17);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * skyH * 0.85;
      const r = s * (0.006 + rnd() * 0.014) * (0.8 + 0.2 * Math.sin(t * 1.3 + i));
      drawGlow(ctx, x, y, r * 3, [255, 220, 170], 0.4);
      drawGlow(ctx, x, y, r, [255, 250, 235], 0.9, 0.6);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // the hill and the fire on it
  const hx = w * 0.5, hy = h * 0.86;
  ctx.fillStyle = '#07060e';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.96);
  ctx.quadraticCurveTo(w * 0.25, hy - h * 0.02, hx, hy);
  ctx.quadraticCurveTo(w * 0.75, hy - h * 0.02, w, h * 0.95);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  const best = p && p.bestTop >= 0 ? fireOf(p.bestTop) : 2;
  const fs = s * 0.15;
  ctx.globalCompositeOperation = 'lighter';
  drawGlowEllipse(ctx, hx, hy, fs * 3.2, fs * 0.8, [255, 120, 40], 0.4);
  drawGlow(ctx, hx, hy - fs * 0.5, fs * 2.6, [255, 130, 50], 0.4);
  ctx.globalCompositeOperation = 'source-over';
  if (best >= 4) {
    // a star's fire: a small sun resting over the hill
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, hx, hy - fs * 0.9, fs * 1.6, [255, 200, 130], 0.6);
    drawGlow(ctx, hx, hy - fs * 0.9, fs * 0.7, [255, 246, 220], 1, 0.5);
    ctx.globalCompositeOperation = 'source-over';
  } else if (best === 3) drawBlaze(ctx, hx, hy, fs * 0.45, fs * 2.4, t, 0.8, FIRE, 3, 0, 1);
  else drawBlaze(ctx, hx, hy, fs * 1.1, fs * 1.5, t, 0.8, FIRE, 6, 0, 1);
  if (best === RUNGS.length - 1) drawFlame(ctx, hx, hy - fs * 1.9, fs * 0.25, fs * 0.5, t, 0.8, SPIRIT, 0, 4);
  // sparks rising, the highest becoming stars
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const k = (t * (0.09 + (i % 4) * 0.012) + i / 14) % 1;
    const x = hx + Math.sin(i * 2.3 + t * 0.6) * w * 0.06 * k + (i - 7) * w * 0.01 * k;
    const y = hy - fs - k * h * 0.62;
    const r = s * 0.007 * (1 + k);
    const a = (k > 0.75 ? 0.65 : 0.85) * (1 - Math.max(0, k - 0.9) * 10);
    drawGlow(ctx, x, y + r * 4, r * 1.8, [255, 140, 60], a * 0.35);
    drawGlow(ctx, x, y, r * 3, k > 0.75 ? [255, 236, 200] : [255, 160, 70], a);
  }
  ctx.globalCompositeOperation = 'source-over';
}
