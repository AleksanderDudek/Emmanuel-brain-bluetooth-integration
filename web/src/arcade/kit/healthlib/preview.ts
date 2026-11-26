/**
 * A library's pictures around play (DESIGN.md §24, Każdy włos's preview.ts): the lobby's hero — the scene where the
 * player will resume (or, before the first session, the library's last scene: the whole walked in one), growing
 * slowly again and again — the calibration intro (the same picture high on the screen, its light gathering as the
 * reference fills), and the library's tiles in the lobby's card (each meditation's telling picture: its last scene,
 * grown).  The ground takes the library's tint.
 */
import { approach, clamp, ease } from '../juice';
import { libOf } from './lib';
import type { HealthProgress } from './meta';
import { bakeGround, glow, type Layer } from './paint';
import { PictureCache, paintScene } from './picture';
import type { HealthLibrary } from './spec';

const caches = new Map<string, { cache: PictureCache; ground: Layer | null }>();

function slot(lib: HealthLibrary, w: number, h: number, dpr: number): { cache: PictureCache; ground: Layer | null } {
  const key = `${lib.id}|${Math.round(w)}x${Math.round(h)}@${dpr}`;
  let s = caches.get(key);
  if (!s) {
    if (caches.size > 8) caches.clear();
    s = { cache: new PictureCache(), ground: bakeGround(w, h, dpr, { x: w / 2, y: h / 2, r: Math.min(w, h) * 0.6 }) };
    if (s.ground) {
      // the library's own light behind the picture (its part of the body)
      const c = s.ground.getContext('2d');
      if (c) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.globalCompositeOperation = 'lighter';
        glow(c, lib.tint.light, w / 2, h / 2, Math.max(w, h) * 0.5, 0.1);
        c.globalCompositeOperation = 'source-over';
      }
    }
    caches.set(key, s);
  }
  return s;
}

const pixelRatio = (): number => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** A meditation's telling picture: its last scene. */
export const tellingScene = (lib: HealthLibrary, med: string): string => {
  const list = libOf(lib).med(med).scenes;
  return list[list.length - 1];
};

/** The scene the lobby shows: where the next session resumes, or the library's last scene before the first one. */
export function heroScene(lib: HealthLibrary, p?: HealthProgress): string {
  const L = libOf(lib);
  if (!p || p.sessions === 0 || !L.isMed(p.pos.med)) return tellingScene(lib, L.meds[L.meds.length - 1]);
  return L.sceneAt(p.pos.med, p.pos.scene);
}

/** A growth that loops slowly: grows over 13 s, holds 4 s in its light, starts again. */
const loopG = (t: number): number => {
  const q = (t % 17) / 17;
  return q < 0.76 ? 0.12 + 0.88 * ease.inOutSine(q / 0.76) : 1;
};

export function drawPreview(lib: HealthLibrary, ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: HealthProgress): void {
  if (w < 4 || h < 4) return;
  const dpr = pixelRatio();
  const s = slot(lib, w, h, dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (s.ground) ctx.drawImage(s.ground, 0, 0, w, h);
  else {
    ctx.fillStyle = lib.tint.ground;
    ctx.fillRect(0, 0, w, h);
  }
  const scene = heroScene(lib, p);
  const bh = h - 20, bw = Math.min(w - 20, bh * 1.45);
  const box = { x: (w - bw) / 2, y: 10, w: bw, h: bh };
  const g = loopG(t);
  paintScene(ctx, s.cache, lib, box, dpr, scene, g, p?.look ?? lib.looks[0] ?? '', t, { deep: 0.35, growing: g < 1, after: g >= 1 ? 2 : 0 });
}

/** The calibration intro: the resume picture high on the screen, its growth gathering a little as the reference fills. */
export class HealthIntro {
  private clock = 0;
  private shown = 0;

  constructor(private readonly lib: HealthLibrary) {}

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: HealthProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.5);
    const s = slot(this.lib, w, h, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s.ground) ctx.drawImage(s.ground, 0, 0, w, h);
    const bh = Math.min(h * 0.5, w * 0.9), bw = Math.min(w - 24, bh * 1.3);
    const box = { x: (w - bw) / 2, y: h * 0.06, w: bw, h: bh };
    const scene = heroScene(this.lib, progress);
    const g = progress.sessions ? Math.max(0.2, progress.pos.g) : 0.3;
    paintScene(ctx, s.cache, this.lib, box, dpr, scene, Math.min(1, g + 0.3 * this.shown), progress.look, this.clock, { deep: 0.25 + 0.5 * this.shown });
  }
}

const tiles = new PictureCache();

/** A library tile (the lobby's card): a meditation's telling picture, still, in the player's look. */
export function drawTile(lib: HealthLibrary, c: HTMLCanvasElement, med: string, look: string, lit: boolean): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = pixelRatio();
  const w = c.width / dpr, h = c.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = lib.tint.ground || '#160b26';
  ctx.fillRect(0, 0, w, h);
  paintScene(ctx, tiles, lib, { x: 3, y: 3, w: w - 6, h: h - 6 }, dpr, tellingScene(lib, med), lit ? 1 : 0.8, look, 4, { deep: lit ? 0.5 : 0.15, after: lit ? 3 : 0 });
  if (!lit) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(14,6,26,.3)';
    ctx.fillRect(0, 0, w, h);
  }
}
