/**
 * Urodzaj's calibration intro, "the floor is laid": while the reference fills (`p` 0..1) the
 * orchard's mosaic is set stone by stone on the bare cream bedding, from the middle outward, as a
 * mosaicist would lay it; the empty basket in the middle comes first, the hills and the sky after,
 * and at 1 the morning light falls across the finished floor.  The runner's calibration card covers
 * the lower part of the screen, so the basket sits high.  The finished floor is baked once per size;
 * a frame draws it and covers the stones not yet laid.
 */
import { clamp } from '../kit/juice';
import { fruit } from './content';
import type { UrodzajProgress } from './meta';
import { C, DAY, bakeScene, fruitArt, hash, mix, paintBasket, paintFrame, paintRim, paintVineLeaf, type Baked } from './mosaic';

export class UrodzajIntro {
  private clock = 0;
  private light = 0;
  private floor: Baked | null = null;
  private key = '';
  /** each cell's turn to be laid (0..1), by its distance from the middle with a little scatter */
  private order: Float32Array = new Float32Array(0);
  private cols = 0;
  private rows = 0;
  private tile = 10;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: UrodzajProgress, dpr: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.light = p >= 0.999 ? Math.min(1, this.light + dt / 0.8) : Math.max(0, this.light - dt);
    const key = `${w}|${h}|${dpr}`;
    if (!this.floor || key !== this.key) this.bake(w, h, dpr, progress);
    ctx.drawImage(this.floor!.c, 0, 0, w, h);
    // the stones still to lay: bare bedding, the next ones being pressed in
    const laid = clamp(p) * 1.04;
    const t = this.tile;
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const o = this.order[j * this.cols + i];
        if (o <= laid - 0.04) continue;
        const k = clamp((laid - o + 0.04) / 0.04);
        ctx.fillStyle = k > 0 ? mix(C.grout, C.ground, 1 - k) : (i + j) % 2 ? C.ground : '#ECE0C6';
        ctx.fillRect(i * t, j * t, t + 0.5, t + 0.5);
      }
    }
    // the morning light across the finished floor
    if (this.light > 0) {
      ctx.save();
      ctx.globalAlpha = this.light * 0.45;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(255,244,214,.9)');
      g.addColorStop(0.5, 'rgba(255,244,214,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  private bake(w: number, h: number, dpr: number, progress: UrodzajProgress): void {
    this.key = `${w}|${h}|${dpr}`;
    const tile = Math.round(Math.max(12, Math.min(w, h) / 34));
    const top = 64, bottom = 66;
    const horizon = h * (h > w ? 0.2 : 0.24);
    const b = bakeScene(w, h, dpr, horizon, Math.max(8, tile * 0.75), DAY, top, bottom);
    const g = b.c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFrame(g, w, h, top, bottom, Math.max(8, tile * 0.75), DAY.frame);
    // the empty basket, high in the middle, with the one olive every new basket holds
    const s = Math.min(w * 0.42, h * 0.3, 300);
    const cx = w / 2, floorY = h * (h > w ? 0.46 : 0.5);
    const X = (x: number) => cx + x * s, Y = (y: number) => floorY - y * s;
    paintBasket(g, X, Y, s, 'back');
    const olive = fruitArt(1, fruit(1).r * s, dpr);
    g.drawImage(olive.c, X(0) - olive.size / 2, Y(fruit(1).r) - olive.size / 2, olive.size, olive.size);
    // the player's best fruit beside it, waiting on the twig
    const best = Math.max(2, Math.min(7, progress.bestTier));
    const art = fruitArt(best, fruit(best).r * s, dpr);
    const twigY = Y(1.16) - 0.079 * s - 6;
    g.strokeStyle = C.brown;
    g.lineCap = 'round';
    g.lineWidth = Math.max(2, s * 0.01);
    g.beginPath();
    g.moveTo(X(-0.56), twigY + 3);
    g.quadraticCurveTo(cx, twigY - 4, X(0.56), twigY + 2);
    g.stroke();
    for (let i = 0; i < 7; i++) paintVineLeaf(g, X(-0.5 + i / 6), twigY - 3 + (i % 2) * 5, Math.max(3, s * 0.014), i % 2 ? 0.6 : -0.6);
    g.lineWidth = Math.max(1.2, s * 0.005);
    g.beginPath();
    g.moveTo(X(0.18), twigY);
    g.lineTo(X(0.18), Y(1.16) - fruit(best).r * s);
    g.stroke();
    g.drawImage(art.c, X(0.18) - art.size / 2, Y(1.16) - art.size / 2, art.size, art.size);
    paintBasket(g, X, Y, s, 'front');
    paintRim(g, X, Y, s);
    this.floor = b;
    this.tile = tile;
    this.cols = Math.ceil(w / tile);
    this.rows = Math.ceil(h / tile);
    this.order = new Float32Array(this.cols * this.rows);
    const midX = cx, midY = floorY - s * 0.5;
    const far = Math.hypot(Math.max(midX, w - midX), Math.max(midY, h - midY));
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const d = Math.hypot((i + 0.5) * tile - midX, (j + 0.5) * tile - midY) / far;
        this.order[j * this.cols + i] = clamp(d * 0.92 + (hash(i * 31.7 + j * 7.3) - 0.5) * 0.12);
      }
    }
  }
}
