/**
 * Złota passa's close-up (DESIGN.md §29, the film — builder P2): where the camera's push-in on a sense or a given
 * moment's thing ends — an insert shot.  The thing large and in detail (things.ts) with its place behind it out of
 * focus (the place's own frame shrunk and blown up again: a soft blur, warm bokeh of its lights), a slow push of its
 * own, and a rack focus: while the attention is not yet there the thing is soft and muted; as focus holds (`open`)
 * the focus racks onto it and its colour and its small life come out (savouring).  A given moment's thing fades
 * away in its rest (`grey`: "imagine it is not there") and comes back as focus holds.
 *
 * Still parts are baked (the thing per motif, size and light; its blurred copy; the backdrop a few times a second):
 * per frame a few drawImages, the thing's small live part and two overlays.
 */
import { clamp01, glow, layer, lerp, rgba, rgbHex } from './paint';
import { roomAt, type Ctx, type Room } from './stage';
import { thingOf, type AnyMotif } from './things';

export interface Rect { x: number; y: number; w: number; h: number }

export interface CloseOpts {
  motif: string;
  /** the canvas, the strip over the card (where the thing stands) */
  w: number; h: number; strip: Rect;
  day: number;
  /** 0..1 the insert's opacity, its framing (0 a medium shot … 1 filling the frame), the focus's opening, the greying */
  alpha: number;
  size: number;
  open: number;
  grey: number;
  time: number;
  reduced: boolean;
  dpr: number;
  /** paints the place now (the backdrop) into a context already scaled to the canvas */
  backdrop: ((c: Ctx) => void) | null;
}

type L = { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

/** The thing's light in a close-up: the hour's light, brightened (looked at with attention). */
export function closeRoom(day: number): Room {
  const R = roomAt(day, day);
  const amb: [number, number, number] = [lerp(R.amb[0], 1.04, 0.55), lerp(R.amb[1], 1.0, 0.55), lerp(R.amb[2], 0.95, 0.55)];
  return { ...R, amb, sunK: Math.max(R.sunK, 0.35 * (1 - R.night)) };
}

/** The light bucket of a moment of the day (the thing is baked again only when it changes). */
const lightStep = (day: number): number => Math.round(clamp01(day) * 12);

export class CloseUp {
  private thingL: L | null = null;
  private blurL: L | null = null;
  private thingKey = '';
  private back1: L | null = null;
  private back2: L | null = null;
  private backAt = -1e9;
  private backKey = '';

  /** The box the thing stands in (CSS px): an object's square, or a view's frame. */
  static box(o: Pick<CloseOpts, 'motif' | 'w' | 'h' | 'strip' | 'size'>): Rect {
    const th = thingOf(o.motif);
    const s = o.strip;
    if (th.kind === 'view') {
      const bottom = Math.min(o.h, s.y + s.h * 1.3);
      return { x: 0, y: 0, w: o.w, h: Math.max(1, bottom) };
    }
    // the thing's middle (~0.62 of its square) at the strip's middle; its steam may rise under the HUD
    const k = 0.72 + 0.28 * clamp01(o.size);
    const S = Math.max(40, Math.min(s.h * 1.3, o.w * 0.88) * k);
    return { x: s.x + s.w / 2 - S / 2, y: s.y + s.h * 0.56 - S * 0.62, w: S, h: S };
  }

  draw(ctx: Ctx, o: CloseOpts): void {
    const a = clamp01(o.alpha);
    if (a <= 0.004 || o.w < 2 || o.h < 2) return;
    const th = thingOf(o.motif);
    const R = closeRoom(o.day);
    const t = o.reduced ? 0 : o.time;
    const open = clamp01(o.open), grey = clamp01(o.grey);
    ctx.save();
    ctx.globalAlpha = a;
    // the place behind, out of focus, drifting a little slower than the thing (parallax)
    this.drawBackdrop(ctx, o, R, t);
    const box = CloseUp.box(o);
    // the thing: sharp, with its soft copy over it while the focus has not racked onto it yet
    const keep = 1 - 0.85 * grey;
    const drift = o.reduced ? 0 : Math.sin(t * 0.11) * 0.012;
    const push = 1 + (o.reduced ? 0 : 0.035 * Math.sin(t * 0.05) + 0.02) + drift;
    const bx = box.x + box.w / 2, by = box.y + box.h / 2;
    const dw = box.w * push, dh = box.h * push;
    const dx = bx - dw / 2, dy = by - dh / 2;
    const baked = this.bakeThing(o, th.kind, box, R);
    ctx.globalAlpha = a * keep;
    if (baked) {
      ctx.drawImage(baked.c, dx, dy, dw, dh);
      const soft = (1 - open) * 0.85;
      if (soft > 0.02 && this.blurL) {
        ctx.globalAlpha = a * keep * soft;
        ctx.drawImage(this.blurL.c, dx, dy, dw, dh);
      }
    } else {
      // no canvas (tests): straight in
      ctx.save();
      if (th.kind === 'object') { ctx.translate(dx, dy); ctx.scale(dw, dh); th.still(ctx, R); } else th.still(ctx, R, dx, dy, dw, dh);
      ctx.restore();
    }
    // its small life, fuller with the focus
    ctx.globalAlpha = a * keep * (0.35 + 0.65 * open);
    ctx.save();
    if (th.kind === 'object') {
      ctx.translate(dx, dy);
      ctx.scale(dw, dh);
      th.live?.(ctx, R, t, open);
    } else th.live?.(ctx, R, dx, dy, dw, dh, t, open);
    ctx.restore();
    // the frame's edges darker, as a lens's
    ctx.globalAlpha = a;
    const vg = ctx.createRadialGradient(o.strip.x + o.strip.w / 2, o.strip.y + o.strip.h * 0.5, Math.min(o.w, o.strip.h) * 0.3, o.strip.x + o.strip.w / 2, o.strip.y + o.strip.h * 0.5, Math.hypot(o.w, o.h) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, rgba('#08060a', 0.42));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, o.w, o.h);
    // muted while the attention is not there yet: the colour comes as the focus racks onto it
    const mute = Math.max(0, (1 - open) * 0.5);
    if (mute > 0.01) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = a * mute;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, o.w, o.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the warm light of attention on the thing
    if (open > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * keep;
      glow(ctx, '#ffe2b0', bx, by, Math.max(box.w, box.h) * 0.75, (th.kind === 'view' ? 0.05 : 0.07) + 0.08 * open);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /** The place out of focus: its frame drawn small (a few times a second) and blown up, with warm bokeh. */
  private drawBackdrop(ctx: Ctx, o: CloseOpts, R: Room, t: number): void {
    const w1 = Math.max(8, Math.round(o.w / 6)), h1 = Math.max(8, Math.round(o.h / 6));
    const w2 = Math.max(4, Math.round(o.w / 18)), h2 = Math.max(4, Math.round(o.h / 18));
    const key = `${w1}x${h1}`;
    if (key !== this.backKey) { this.back1 = layer(w1, h1, 1); this.back2 = layer(w2, h2, 1); this.backKey = key; this.backAt = -1e9; }
    const now = o.time;
    if (this.back1 && this.back2 && o.backdrop && (now - this.backAt > 0.35 || now < this.backAt)) {
      this.backAt = now;
      const c1 = this.back1.ctx;
      c1.setTransform(1, 0, 0, 1, 0, 0);
      c1.clearRect(0, 0, w1, h1);
      c1.setTransform(w1 / o.w, 0, 0, h1 / o.h, 0, 0);
      o.backdrop(c1);
      const c2 = this.back2.ctx;
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, w2, h2);
      c2.imageSmoothingEnabled = true;
      c2.drawImage(this.back1.c, 0, 0, w2, h2);
    }
    const sc = 1.18 + (o.reduced ? 0 : 0.02 * Math.sin(t * 0.07));
    const W = o.w * sc, H = o.h * sc;
    const cx = o.strip.x + o.strip.w / 2, cy = o.strip.y + o.strip.h * 0.5;
    if (this.back2) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.back2.c, cx - (cx / o.w) * W, cy - (cy / o.h) * H, W, H);
    } else {
      ctx.fillStyle = rgbHex([R.amb[0] * 200, R.amb[1] * 180, R.amb[2] * 160]);
      ctx.fillRect(0, 0, o.w, o.h);
    }
    // a soft wash in the hour's light, then the bokeh of the place's lights
    ctx.fillStyle = rgba(rgbHex(R.Lt.hor), 0.12);
    ctx.fillRect(0, 0, o.w, o.h);
    const ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    const n = 9;
    const s = o.strip;
    for (let i = 0; i < n; i++) {
      const hx = ((i * 0.618 + 0.13) % 1), hy = ((i * 0.377 + 0.21) % 1);
      const x = s.x + s.w * hx + (o.reduced ? 0 : Math.sin(t * 0.06 + i) * 6);
      const y = s.y + s.h * (0.1 + 0.8 * hy);
      const r = Math.min(s.w, s.h) * (0.06 + 0.07 * ((i * 0.53) % 1));
      const col = R.night > 0.4 ? (i % 2 ? '#ffc070' : '#ffe0a8') : (i % 3 ? '#fff4dc' : rgbHex(R.Lt.hor));
      glow(ctx, col, x, y, r, (0.1 + 0.2 * R.night) * ga);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ga;
  }

  /** The thing's still part baked at its box's size and the hour's light, and its soft copy (the rack focus). */
  private bakeThing(o: CloseOpts, kind: 'object' | 'view', box: Rect, R: Room): L | null {
    const th = thingOf(o.motif);
    // bake at the largest size the framing reaches, in steps
    const full = CloseUp.box({ ...o, size: 1 });
    const bw = Math.ceil(full.w / 24) * 24, bh = Math.ceil(full.h / 24) * 24;
    const dpr = Math.min(2, Math.max(1, o.dpr || 1));
    const key = `${o.motif}|${bw}x${bh}|${dpr}|${lightStep(o.day)}`;
    if (key !== this.thingKey || !this.thingL) {
      this.thingL = layer(bw, bh, dpr);
      if (!this.thingL) return null;
      this.thingKey = key;
      const c = this.thingL.ctx;
      const Rb = closeRoom(lightStep(o.day) / 12);
      try {
        if (th.kind === 'object') { c.save(); c.scale(bw, bh); th.still(c, Rb); c.restore(); } else th.still(c, Rb, 0, 0, bw, bh);
      } catch (e) { console.error(e); }
      // the soft copy: shrunk twice and blown up
      const s1 = layer(Math.max(4, bw / 5), Math.max(4, bh / 5), 1), s2 = layer(Math.max(4, bw / 12), Math.max(4, bh / 12), 1);
      this.blurL = layer(bw, bh, 1);
      if (s1 && s2 && this.blurL) {
        s1.ctx.drawImage(this.thingL.c, 0, 0, bw / 5, bh / 5);
        s2.ctx.drawImage(s1.c, 0, 0, bw / 12, bh / 12);
        this.blurL.ctx.imageSmoothingEnabled = true;
        this.blurL.ctx.drawImage(s2.c, 0, 0, bw, bh);
      }
    }
    void kind; void box; void R;
    return this.thingL;
  }
}

/** The motif a close-up shows (any string: an unknown one shows the sun's). */
export const closeMotif = (m: string | null | undefined): AnyMotif => (thingOf(m) ? ((m ?? 'sun') as AnyMotif) : 'sun');
