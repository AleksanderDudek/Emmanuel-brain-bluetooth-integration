/**
 * Złote serce's lobby picture and card art (DESIGN.md §21): the heart made whole — glazed porcelain with its cracks
 * filled with gold, glints running along the seams, a slow beat, the warm aura — on the night warming to dawn.  The
 * lobby shows it a little more golden for a player who has gilded a whole heart.  The textures are baked once per size
 * (paint.ts) and kept, so a frame only draws.
 */
import { clamp } from '../kit/juice';
import { HEART, along, buildHeart, type HeartGeo } from './heart';
import type { KintsugiProgress } from './meta';
import { GOLD, ROSE, TEX, bakeHeart, glowSprite, heartPath, noise, polyPath, rgba, skyAt, softGlow, type HeartTex } from './paint';

const TAU = Math.PI * 2;

interface Cache { geo: HeartGeo; tex: HeartTex | null; ps: number; heart: Path2D; pieces: Path2D[]; pat: CanvasPattern | null; spr: HTMLCanvasElement | null }
let cache: Cache | null = null;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function ready(ps: number): Cache | null {
  if (typeof Path2D === 'undefined') return null;
  const want = Math.max(60, Math.min(260, Math.round(ps / 20) * 20));
  if (cache && cache.ps === want) return cache;
  const geo = cache?.geo ?? buildHeart(7, seeded(1717));
  cache = { geo, tex: bakeHeart(want, 4242), ps: want, heart: heartPath(), pieces: geo.pieces.map(p => polyPath(p.outline)), pat: null, spr: glowSprite('#fff6dc', 64) };
  return cache;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, p?: KintsugiProgress): void {
  ctx.save();
  // the sky, from the night to the first warmth
  const [a, b, c] = skyAt(0.62);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, a);
  sky.addColorStop(0.6, b);
  sky.addColorStop(1, c);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const s = Math.min(w / 2.9, h / 2.6);
  const cx = w / 2, cy = h * 0.5;
  const beat = 1 + 0.035 * Math.max(0, Math.sin(time * 2.4)) ** 6;
  const golden = p ? clamp(p.golden / 3) : 0.3;
  // the aura
  softGlow(ctx, ROSE, cx, cy, s * 2.1, 0.22);
  softGlow(ctx, GOLD, cx, cy, s * 1.4, 0.3);
  softGlow(ctx, '#fff4dc', cx, cy, s * 0.8, 0.22);
  // slow rays
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    const ang = time * 0.04 + (i / 12) * TAU;
    const len = s * (1.7 + 0.4 * Math.sin(i * 2.1));
    const gr = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    gr.addColorStop(0, 'rgba(255,232,190,0.12)');
    gr.addColorStop(1, 'rgba(255,232,190,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang - 0.07) * len, cy + Math.sin(ang - 0.07) * len);
    ctx.lineTo(cx + Math.cos(ang + 0.07) * len, cy + Math.sin(ang + 0.07) * len);
    ctx.fill();
  }
  ctx.restore();
  const C = ready(s * 1.6);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s * beat, s * beat);
  if (C?.tex) {
    const tex = C.tex;
    ctx.save();
    ctx.clip(C.heart);
    ctx.drawImage(tex.porcelain, TEX.x0, TEX.y0, TEX.w, TEX.h);
    ctx.globalAlpha = 0.25 + 0.5 * golden;
    ctx.drawImage(tex.gold, TEX.x0, TEX.y0, TEX.w, TEX.h);
    ctx.globalAlpha = 1;
    // the golden seams
    if (!C.pat) {
      C.pat = ctx.createPattern(tex.gold, 'no-repeat');
      if (C.pat && typeof DOMMatrix !== 'undefined') C.pat.setTransform(new DOMMatrix([1 / tex.ps, 0, 0, 1 / tex.ps, TEX.x0, TEX.y0]));
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const base = Math.max(2, 0.022 * s) / s;
    for (const sm of C.geo.seams) {
      const path = new Path2D();
      sm.pts.forEach((q, i) => (i ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
      ctx.strokeStyle = 'rgba(70,44,10,0.9)';
      ctx.lineWidth = base + 1.4 / s;
      ctx.stroke(path);
      ctx.strokeStyle = C.pat ?? GOLD;
      ctx.lineWidth = base * (0.85 + 0.3 * noise(sm.id, 0.3, 5));
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255,248,222,0.7)';
      ctx.lineWidth = base * 0.3;
      ctx.save();
      ctx.translate(-base * 0.2, -base * 0.2);
      ctx.stroke(path);
      ctx.restore();
    }
    ctx.restore();
  } else {
    // without a canvas to bake on: a plain heart
    ctx.fillStyle = '#f3e7d2';
    ctx.fill(heartPath());
  }
  ctx.restore();
  // glints running along the seams
  if (C) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    C.geo.seams.forEach((sm, i) => {
      const u = ((time * 0.35 + i * 0.37) % 1.6) / 1.6;
      if (u > 1) return;
      const q = along(sm.pts, sm.cum, u * sm.len);
      const x = cx + q.x * s * beat, y = cy + q.y * s * beat;
      const al = Math.sin(Math.PI * u) * 0.8;
      if (C.spr) {
        ctx.globalAlpha = al;
        const r = Math.max(4, 0.06 * s);
        ctx.drawImage(C.spr, x - r, y - r, 2 * r, 2 * r);
        ctx.globalAlpha = 1;
      }
    });
    // rising sparks of joy
    for (let i = 0; i < 18; i++) {
      const u = ((time * 0.12 + i * 0.137) % 1);
      const x = cx + Math.sin(i * 12.9) * s * 0.9 + Math.sin(time * 0.8 + i) * 6;
      const y = cy + s * 0.6 - u * s * 2;
      ctx.fillStyle = rgba('#fff0c8', Math.sin(Math.PI * u) * 0.75);
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // the rim of light round the heart
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s * beat, s * beat);
  ctx.strokeStyle = 'rgba(255,236,196,0.35)';
  ctx.lineWidth = 1.5 / s;
  ctx.stroke(heartPath());
  ctx.restore();
  void HEART;
  ctx.restore();
}
