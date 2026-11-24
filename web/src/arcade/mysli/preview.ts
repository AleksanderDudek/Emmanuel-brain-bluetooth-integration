/**
 * Każda myśl's picture for the lobby's hero and the game card, and the calibration's intro: the warm dark room and the
 * one point of light.  In the lobby a loop of the meditation — a thought drifts in on its slip (a library thought in
 * the page's language, a different one each turn), waits, the flame's ring reaches it, it burns from the edge nearest
 * the flame, its truth unfolds on a golden slip in the same place and fills with light (round 16), and a golden light
 * flies to the point and joins the ones the player has gathered; on the cards a still of the same, half burned.  The intro is the flame alone, brightening a little as the reference fills — nothing
 * burns before play.  The ctx comes scaled to CSS px (the lobby, the cards); the intro scales itself.
 */
import { clamp, ease } from '../kit/juice';
import { LIBRARY, flameTones, thoughtById, type ThoughtDef } from './content';
import { t, type Key } from './i18n';
import type { MysliProgress } from './meta';
import { bakeGoldSlip, bakeSlip, drawFlame, glow, GOLD_HI, type GoldSlip, type Slip } from './paint';
import { drawBurningSlip, drawGoldSlip, drawLights, drawRing, paintRoom } from './render';

/** The thoughts the lobby's loop shows in turn: everyday ones, each emotion. */
const SHOWN = ['future.cant', 'close.understand', 'work.lose', 'self.ruin', 'alone.wave', 'world.rage'];
const LOOP = 14;

interface Cache { key: string; slips: Map<string, Slip | null>; golds: Map<string, GoldSlip | null> }
const caches = new WeakMap<HTMLCanvasElement, Cache>();

function slipFor(ctx: CanvasRenderingContext2D, d: ThoughtDef, w: number, px: number): Slip | null {
  const key = `${Math.round(w)}|${px}`;
  let c = caches.get(ctx.canvas);
  if (!c || c.key !== key) {
    c = { key, slips: new Map(), golds: new Map() };
    caches.set(ctx.canvas, c);
  }
  if (!c.slips.has(d.id)) {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    c.slips.set(d.id, bakeSlip(t(`th.${d.id}` as Key), d.mix, Math.round(w), px, Math.min(px, 13), dpr, SHOWN.indexOf(d.id) * 13 + 7));
  }
  return c.slips.get(d.id) ?? null;
}

function goldFor(ctx: CanvasRenderingContext2D, d: ThoughtDef, w: number, px: number): GoldSlip | null {
  const c = caches.get(ctx.canvas);
  if (!c) return null;
  if (!c.golds.has(d.id)) {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    c.golds.set(d.id, bakeGoldSlip(t(`tr.${d.id}` as Key), Math.round(w), px, Math.min(px, 13), dpr, SHOWN.indexOf(d.id) * 17 + 3));
  }
  return c.golds.get(d.id) ?? null;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, p?: MysliProgress): void {
  if (w < 4 || h < 4) return;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = w > h * 1.2;
  const fx = wide ? w * 0.64 : w / 2, fy = h * 0.66;
  const fs = clamp(Math.min(w, h) * 0.065, 7, 30);
  ctx.save();
  paintRoom(ctx, w, h, fx, fy);
  // the loop (the lobby) or a still half burned (the cards)
  const u = p ? Math.max(0, time) % LOOP : 5.8;
  const turn = p ? Math.floor(Math.max(0, time) / LOOP) : 0;
  const d = thoughtById(SHOWN[turn % SHOWN.length]) ?? LIBRARY[0];
  const slipW = Math.min(w * (wide ? 0.46 : 0.78), 340);
  const px = clamp(h * 0.05, 13, 18);
  const s = slipFor(ctx, d, slipW, px);
  const gathered = p ? Math.min(12, 3 + p.burned) : 6;
  const flown = u > 12.8 ? 1 : 0;
  // the ring reaches the slip while it burns (3.6–7.6) and while its truth fills with light (8.8–11.6)
  const ring = u < 3 ? 0.1 : u < 3.6 ? (u - 3) / 0.6 : u < 7.6 ? 1 : u < 8.4 ? Math.max(0.3, 1 - (u - 7.6)) : u < 8.8 ? 0.3 + (u - 8.4) * 1.75 : u < 11.6 ? 1 : Math.max(0.1, 1 - (u - 11.6));
  const rx = Math.min(w * 0.3, fs * 4.4);
  drawLights(ctx, fx, fy + fs * 0.2, rx, rx * 0.4, gathered + flown, time, 0.5, reduced || !p);
  if (s) {
    const restY = Math.max(s.h / 2 + 6, fy - fs * 2.3 - s.h / 2 - fs * 1.4);
    const reach = fy - (restY + s.h / 2) + 2;
    drawRing(ctx, fx, fy, fs * 1.5 + (reach - fs * 1.5) * clamp(ring), 0.3 + 0.7 * clamp(ring));
    drawFlame(ctx, fx, fy, fs, 0.4 + 0.5 * clamp(ring), time, reduced || !p);
    // the slip: in from the left, waiting, burning, gone
    const inK = reduced ? 1 : ease.outCubic(clamp(u / 1.5));
    const x = fx - (1 - inK) * (w * 0.6), y = restY + (1 - inK) * 24;
    const burn = clamp((u - 3.6) / 4);
    const alpha = (reduced ? clamp(u / 1.5) : 1) * (u < 7.6 ? 1 : clamp(1 - (u - 7.6) * 2));
    drawBurningSlip(ctx, s, x, y, -0.03 + (1 - inK) * -0.2, burn, flameTones(d.mix), 3, ring > 0.9 ? 1 : 0.2, alpha);
    // its truth unfolds in the same place, fills with light, and folds into a golden light
    const g = u >= 7.6 && u < 12 ? goldFor(ctx, d, slipW, px) : null;
    if (g) {
      const open = clamp((u - 7.6) / 0.8);
      const fill = clamp((u - 8.8) / 2.8);
      const fade = u < 11.6 ? 1 : clamp(1 - (u - 11.6) / 0.4);
      drawGoldSlip(ctx, g, x, y, -0.03, open, fill, ring > 0.9 ? 1 : 0, fade, reduced || !p);
    }
    // the golden light rising from the truth to the point
    if (u > 11.6 && u < 12.8 && !reduced) {
      const k = ease.inOutSine((u - 11.6) / 1.2);
      const lx = x + (fx + rx - x) * k, ly = y + (fy - y) * k - Math.sin(k * Math.PI) * 20;
      glow(ctx, GOLD_HI, lx, ly, 12, 0.8);
    }
  } else drawFlame(ctx, fx, fy, fs, 0.6, time, true);
  ctx.restore();
}

/** The calibration's intro: the room and the flame alone, brightening a little as the band settles. */
export class MysliIntro {
  private shown = 0;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, dpr: number, reduced: boolean): void {
    if (w < 4 || h < 4) return;
    this.shown += (clamp(p) - this.shown) * Math.min(1, dt / 0.4);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the calibration card covers the lower part: the flame in the upper two thirds
    const fx = w / 2, fy = Math.max(70, h * 0.19);
    const fs = clamp(Math.min(w, h) * 0.06, 10, 30);
    paintRoom(ctx, w, h, fx, fy);
    drawRing(ctx, fx, fy, fs * 1.6, 0.25 + 0.2 * this.shown);
    drawFlame(ctx, fx, fy, fs, 0.2 + 0.4 * this.shown, performance.now() / 1000, reduced);
    ctx.restore();
  }
}
