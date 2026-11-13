/**
 * A quiet picture of Rzeki żywej wody for the screens around play — the calibration intro and the lobby's
 * hero and card: the sky, the open heaven's rays, the egg of light, the figure, its column, the seven places
 * (those the player has lit glowing from the lobby's map), a stream of light walking down the column with the
 * two threads behind it, and one rose window opening as the stream reaches it.  Baked once per size.
 */
import { clamp, ease } from '../kit/juice';
import { PLACE, PLACES, type PlaceId } from './content';
import {
  GOLD, GOLD_HI, PEARL, SILVER, WATER, auraSprite, bakeFigure, bakeRays, bakeRoses, bakeSky, bloom, columnSprite, glow, poolSprite, rgbaPrefix,
  type FigureLayer, type Layer, type RoseLayers,
} from './paint';
import { fullPath } from './rose';

const TAU = Math.PI * 2;

export interface SceneBox { cx: number; top: number; H: number }

interface Baked { key: string; sky: Layer | null; rays: Layer | null; raysBox: { x: number; w: number; h: number }; fig: FigureLayer | null; roses: Partial<Record<PlaceId, RoseLayers>> }

export class QuietScene {
  private b: Baked | null = null;

  /**
   * Draw the picture into w × h with the figure in `box`.  `t` in seconds drives the stream; `walk` (0..1,
   * or null for the stream's own loop) where it is along the way; `glowOf(p)` how much a place glows from
   * the map (0..1); `heaven` how open the heaven is (0..1).
   */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, box: SceneBox, t: number,
    o: { walk?: number | null; glowOf?: (p: PlaceId) => number; tierOf?: (p: PlaceId) => number; heaven?: number; still?: boolean; stream?: boolean } = {}): void {
    const tiers = Object.fromEntries(PLACES.map(p => [p, o.tierOf ? o.tierOf(p) : 0])) as Record<PlaceId, number>;
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}|${Math.round(box.cx)},${Math.round(box.top)},${Math.round(box.H)}|${PLACES.map(p => tiers[p]).join('')}`;
    if (this.b?.key !== key) {
      const rw = Math.min(w, box.H * 1.3);
      this.b = {
        key,
        sky: bakeSky(w, h, dpr, { cx: box.cx, heavenY: box.top - box.H * 0.12, midY: box.top + box.H * 0.45, H: box.H }),
        rays: bakeRays(rw, Math.max(20, box.top + box.H * 0.06), dpr, rw / 2),
        raysBox: { x: box.cx - rw / 2, w: rw, h: Math.max(20, box.top + box.H * 0.06) },
        fig: bakeFigure(box, dpr),
        roses: bakeRoses(box.H * 0.075, dpr, tiers),
      };
    }
    const b = this.b, H = box.H, cx = box.cx;
    if (b.sky) ctx.drawImage(b.sky, 0, 0, w, h);
    else {
      ctx.fillStyle = '#120c34';
      ctx.fillRect(0, 0, w, h);
    }
    const heaven = clamp(o.heaven ?? 0.6);
    if (b.rays) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.6 * heaven;
      ctx.drawImage(b.rays, b.raysBox.x, 0, b.raysBox.w, b.raysBox.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const glowOf = o.glowOf ?? (() => 0);
    const litN = PLACES.reduce((n, p) => n + (glowOf(p) > 0 ? 1 : 0), 0);
    // the egg of light and the pool
    const aura = auraSprite(), pool = poolSprite();
    const breathe = o.still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.6);
    if (aura) {
      const g = 0.9 + 0.02 * litN + 0.03 * breathe;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.05 * litN;
      ctx.drawImage(aura, cx - H * 0.33 * g, box.top + H * 0.47 - H * 0.6 * g, H * 0.66 * g, H * 1.2 * g);
      if (pool) {
        ctx.globalAlpha = 0.45;
        ctx.drawImage(pool, cx - H * 0.2, box.top + H - H * 0.025, H * 0.4, H * 0.05);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (b.fig) ctx.drawImage(b.fig.c, b.fig.box.x, b.fig.box.y, b.fig.box.w, b.fig.box.h);
    // the stream walking down the column (its own loop: 9 s down, a breath in the light, again)
    const cyc = 12, q = (t % cyc) / cyc;
    const streaming = o.stream !== false;
    const walk = streaming ? o.walk ?? (q < 0.8 ? q / 0.8 : 1) : -1;
    const whole = streaming && o.walk == null && q >= 0.8 ? Math.sin(((q - 0.8) / 0.2) * Math.PI) : 0;
    const crown = box.top + PLACE.mind.y * H, feet = box.top + PLACE.feet.y * H;
    const y = crown + (feet - crown) * ease.inOutSine(clamp(walk));
    const col = columnSprite(PEARL);
    if (col) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22;
      ctx.drawImage(col, cx - H * 0.025, crown, H * 0.05, feet - crown);
      ctx.globalAlpha = streaming ? 0.55 : 0.3;
      ctx.drawImage(col, cx - H * 0.03, 0, H * 0.06, streaming ? y : crown);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // the threads behind the stream
    if (!o.still && streaming) {
      for (const side of [1, -1]) {
        const p = new Path2D();
        let first = true;
        for (let yy = crown; yy <= y; yy += 3) {
          const th = (TAU * (yy - crown)) / (H * 0.12) - t * TAU * 0.5;
          const taper = clamp((yy - crown) / (H * 0.03)) * clamp((y - yy) / (H * 0.03));
          const x = cx + side * H * 0.024 * taper * Math.sin(th);
          if (first) { p.moveTo(x, yy); first = false; } else p.lineTo(x, yy);
        }
        ctx.strokeStyle = `${rgbaPrefix(side > 0 ? GOLD : SILVER)}.8)`;
        ctx.lineWidth = Math.max(1, H * 0.004);
        ctx.stroke(p);
      }
    }
    // the places: lit by the stream as it passes (and from the map), the one it reaches opening
    for (const pl of PLACES) {
      const py = box.top + PLACE[pl].y * H, hue = PLACE[pl].hue;
      const passed = streaming && py <= y + 0.5;
      const map = glowOf(pl);
      const lit = Math.max(passed ? 1 : 0, map * 0.8, whole);
      const rose = b.roses[pl];
      if (lit > 0.05 && rose) {
        const near = 1 - clamp(Math.abs(py - y) / (H * 0.06));
        const R = H * (0.03 + 0.04 * near);
        bloom(ctx, hue, cx, py, R * 3.6, 0.35 + 0.3 * lit);
        const k = R / rose.R;
        ctx.save();
        ctx.translate(cx, py);
        ctx.scale(k, k);
        ctx.globalAlpha = clamp(lit);
        if (near > 0 && near < 1 && passed) {
          ctx.drawImage(rose.lead, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
          ctx.clip(fullPath(PLACE[pl].rose, rose.R, 0.35 + 0.65 * near));
        }
        ctx.drawImage(rose.glass, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
        // the light coming through the glass from behind
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(lit) * 0.28;
        ctx.drawImage(rose.glass, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
        ctx.restore();
        glow(ctx, '#ffffff', cx, py, R * 0.5, 0.26 * lit);
      } else {
        glow(ctx, hue, cx, py, Math.max(3, H * 0.014) * 3.4, 0.22);
        ctx.fillStyle = `${rgbaPrefix(hue)}.55)`;
        ctx.beginPath();
        ctx.arc(cx, py, Math.max(1.5, H * 0.008), 0, TAU);
        ctx.fill();
      }
    }
    if (!o.still && streaming && walk < 1) {
      glow(ctx, WATER, cx, y, H * 0.06, 0.7);
      glow(ctx, '#ffffff', cx, y, H * 0.02, 0.9);
    }
    if (whole > 0) glow(ctx, GOLD_HI, cx, box.top + H * 0.45, H * 0.8, 0.28 * whole);
    glow(ctx, GOLD_HI, cx, Math.max(0, box.top - H * 0.12), H * 0.25, 0.2 + 0.3 * heaven);
  }
}
