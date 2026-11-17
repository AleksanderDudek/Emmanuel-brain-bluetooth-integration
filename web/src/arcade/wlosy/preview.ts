/**
 * Każdy włos's pictures around play (DESIGN.md §15): the lobby's hero — the scene where the player will resume (or the
 * last scene of "Cała głowa", the head held high, before the first session), growing slowly again and again — the
 * calibration intro (the same picture high on the screen, its light gathering as the reference fills), and the
 * library's tiles in the lobby's card.
 */
import { approach, clamp, ease } from '../kit/juice';
import { MED, sceneAt, type HairColour, type MedId, type SceneId } from './content';
import type { WlosyProgress } from './meta';
import { bakeGround, type Layer } from './paint';
import { PictureCache, paintScene } from './picture';

const caches = new Map<string, { cache: PictureCache; ground: Layer | null }>();

function slot(w: number, h: number, dpr: number): { cache: PictureCache; ground: Layer | null } {
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
  let s = caches.get(key);
  if (!s) {
    if (caches.size > 6) caches.clear();
    s = { cache: new PictureCache(), ground: bakeGround(w, h, dpr, { x: w / 2, y: h / 2, r: Math.min(w, h) * 0.6 }) };
    caches.set(key, s);
  }
  return s;
}

const pixelRatio = (): number => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** The scene the lobby shows: where the next session resumes, or the head held high before the first one. */
export function heroScene(p?: WlosyProgress): SceneId {
  if (!p || p.sessions === 0) return 'glowa';
  return sceneAt(p.pos.med, p.pos.scene);
}

/** A growth that loops slowly: grows over 13 s, holds 4 s in its light, starts again. */
const loopG = (t: number): number => {
  const q = (t % 17) / 17;
  return q < 0.76 ? 0.12 + 0.88 * ease.inOutSine(q / 0.76) : 1;
};

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: WlosyProgress): void {
  if (w < 4 || h < 4) return;
  const dpr = pixelRatio();
  const s = slot(w, h, dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (s.ground) ctx.drawImage(s.ground, 0, 0, w, h);
  const scene = heroScene(p);
  const bh = h - 20, bw = Math.min(w - 20, bh * 1.45);
  const box = { x: (w - bw) / 2, y: 10, w: bw, h: bh };
  paintScene(ctx, s.cache, box, dpr, scene, loopG(t), p?.colour ?? 'brown', t, { deep: 0.35, growing: true });
}

/** The calibration intro: the resume picture high on the screen, its growth gathering a little as the reference fills. */
export class WlosyIntro {
  private clock = 0;
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: WlosyProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.5);
    const s = slot(w, h, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s.ground) ctx.drawImage(s.ground, 0, 0, w, h);
    const bh = Math.min(h * 0.5, w * 0.9), bw = Math.min(w - 24, bh * 1.3);
    const box = { x: (w - bw) / 2, y: h * 0.06, w: bw, h: bh };
    const scene = heroScene(progress);
    const g = progress.sessions ? Math.max(0.2, progress.pos.g) : 0.3;
    paintScene(ctx, s.cache, box, dpr, scene, Math.min(1, g + 0.3 * this.shown), progress.colour, this.clock, { deep: 0.25 + 0.5 * this.shown });
  }
}

const tiles = new PictureCache();

/** A library tile (the lobby's card): a meditation's most telling picture, still, in the player's colour. */
export function drawTile(c: HTMLCanvasElement, med: MedId, colour: HairColour, lit: boolean): void {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = pixelRatio();
  const w = c.width / dpr, h = c.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#160b26';
  ctx.fillRect(0, 0, w, h);
  const list = MED[med].scenes;
  const scene = list[Math.min(list.length - 1, 1)];
  paintScene(ctx, tiles, { x: 3, y: 3, w: w - 6, h: h - 6 }, dpr, scene, lit ? 1 : 0.7, colour, 4, { deep: lit ? 0.5 : 0.15 });
  if (!lit) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(14,6,26,.35)';
    ctx.fillRect(0, 0, w, h);
  }
}
