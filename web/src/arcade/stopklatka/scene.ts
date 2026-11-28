/**
 * Stop-klatka's picture (DESIGN.md §28): a beat seen through the eyes — the place (baked once per size and view), the
 * people facing the player, the place's foreground, the player's own hands and what they hold — and, when the time
 * freezes, the camera stepping out of the eyes: the first-person picture draws back and fades while the observer's
 * view (the camera risen, a step back and aside) comes in, and the player appears from below, seen from behind and a
 * little aside, facing the other person.  Over it the look of the moment: `heat` warms the picture and narrows the
 * view, the freeze drains the colour to a cool still (a single blend over the frame) that clarity brings back, and a
 * soft white flash marks the stop.
 *
 * Still layers are baked (each place's background and foreground for both views, with a margin for the camera's
 * draw-back), so a frame is two or three images, a few people and the overlays: well under the 4 ms budget.
 */
import { lang } from '../../i18n';
import type { Layout } from './layout';
import { FONT, INK, type Cam, P, TAU, clamp01, ellipse, fillRR, font, grain, layer, lerp, mix, rgba, rr, shade, smooth, soft, wrap } from './paint';
import { BACK, FRONT, PLACE_CFG } from './places';
import { arm, avatar, drawPerson, drawSelf, lookOf, speakingFor, type Look } from './people';
import type { SceneBeat } from './sim';
import type { Age, Mood, Place } from './story';

/** A head's radius in metres (the scale of everything). */
const HEAD = 0.115;
/** The baked layers' margin around the canvas (a share of its larger side): the room for the camera's draw-back. */
const MARGIN = 0.08;

export type View = 'eyes' | 'out';

export interface SceneLook {
  sat: number;
  cool: number;
  out: number;
  flash: number;
  heat: number;
  frozen: boolean;
  /** seconds, for the people's idle life */
  t: number;
  /** seconds since the beat's words began (a speaker's mouth moves while they are new) */
  since: number;
  reduced: boolean;
}

interface Baked { back: HTMLCanvasElement | null; front: HTMLCanvasElement | null; m: number }

/** A figure placed: its look, mood, screen position and head radius. */
interface Placed { look: Look; mood: Mood; x: number; y: number; R: number; speaking: boolean; phase: number; fi: number; mid: boolean }

export class SceneView {
  private l: Layout | null = null;
  private dpr = 1;
  private readonly cache = new Map<string, Baked>();
  private readonly order: string[] = [];
  private vignette: HTMLCanvasElement | null = null;
  private readonly textCache = new Map<string, string[]>();

  resize(l: Layout, dpr: number): void {
    this.l = l;
    this.dpr = Math.min(2, Math.max(1, dpr));
    this.cache.clear();
    this.order.length = 0;
    this.vignette = null;
    this.textCache.clear();
  }

  /** The camera of a place for a view. */
  cam(place: Place, view: View): Cam {
    const l = this.l!;
    const cfg = PLACE_CFG[place];
    const f = (l.frame.R * cfg.fZ) / HEAD;
    if (view === 'eyes') return { cx: l.frame.cx, hy: l.frame.headY - (f * (cfg.E - cfg.headH)) / cfg.Z0, f, E: cfg.E, w: l.w, h: l.h, dx: 0, dz: 0 };
    const car = place === 'car';
    const dz = car ? 0.9 : 1.0, dx = car ? 0.35 : 0.7, E = cfg.E + (car ? 0.25 : 0.55);
    const hy = l.out.otherY - (f * (E - cfg.headH)) / (cfg.Z0 + dz);
    const cx = l.out.otherX + (f * dx) / (cfg.Z0 + dz);
    return { cx, hy, f, E, w: l.w, h: l.h, dx, dz };
  }

  /** A place's baked layers for a view (made on first use; a few kept). */
  private baked(place: Place, view: View): Baked {
    const key = `${place}:${view}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const l = this.l!;
    const m = Math.round(Math.max(l.w, l.h) * MARGIN);
    const W = l.w + 2 * m, H = l.h + 2 * m;
    const c = { ...this.cam(place, view), cx: this.cam(place, view).cx + m, hy: this.cam(place, view).hy + m, w: W, h: H };
    const back = layer(W * this.dpr, H * this.dpr);
    const bctx = back?.getContext('2d') ?? null;
    if (bctx) {
      bctx.scale(this.dpr, this.dpr);
      bctx.fillStyle = '#d8cbb6';
      bctx.fillRect(0, 0, W, H);
      BACK[place](bctx, c);
      grain(bctx, W, H, 0.06);
    }
    const fp = place === 'car' ? (fctx2: CanvasRenderingContext2D) => drawCar(fctx2, carFrame(l, view), m) : FRONT[place];
    let front: HTMLCanvasElement | null = null;
    // the foreground stands between the player and the other person: in the observer's view too
    if (fp) {
      front = layer(W * this.dpr, H * this.dpr);
      const fctx = front?.getContext('2d') ?? null;
      if (fctx) {
        fctx.scale(this.dpr, this.dpr);
        fp(fctx, c);
      }
    }
    const b: Baked = { back, front, m };
    this.cache.set(key, b);
    this.order.push(key);
    while (this.order.length > 6) this.cache.delete(this.order.shift()!);
    return b;
  }

  /** Where the beat's people stand (3D for the view, then projected). */
  private place(beat: SceneBeat, group: Age, view: View, look: SceneLook): Placed[] {
    const l = this.l!;
    const cfg = PLACE_CFG[beat.place], c = this.cam(beat.place, view), fe = this.cam(beat.place, 'eyes').f;
    const people = beat.people;
    // who stands in the view: on a phone filling it nobody (they are on the screen); in the car a child, a teenager
    // or a partner sits behind or beside (the mirror shows them)
    const shown = people.map((f, i) => ({ f, i })).filter(({ f }) =>
      beat.place !== 'screen' && !(beat.place === 'car' && (f.who === 'child' || f.who === 'teenager' || f.who === 'partner')));
    const n = shown.length;
    // their slots across the view (a share of its width, so a narrow phone keeps them in it), left to right
    const FR: Record<number, number[]> = { 1: [0], 2: [-0.21, 0.21], 3: [-0.3, 0, 0.3] };
    const fr = FR[n] ?? Array.from({ length: n }, (_, j) => -0.36 + (0.72 * j) / Math.max(1, n - 1));
    const rank = (a?: string): number => (a === 'left' ? 0 : a === 'right' ? 2 : 1);
    const order = [...shown].sort((a, b) => rank(a.f.at) - rank(b.f.at) || a.i - b.i);
    const out: Placed[] = [];
    order.forEach(({ f, i }, j) => {
      const slots = f.who === 'group' ? [[-0.55, 0.45], [0, 0], [0.55, 0.35]] : [[0, 0]];
      const spread = n > 1 ? 0.55 : 1;
      for (const [gx, gz] of slots) {
        let Z = cfg.Z0 + gz + (n > 1 && fr[j] !== 0 ? 0.15 : 0);
        if (beat.far) Z += 1.2;
        const X = (fr[j] * l.view.w * Z) / Math.max(1, fe) + gx * spread;
        const who = f.who === 'group' ? 'peer' : f.who;
        // the same role in a story keeps its face from beat to beat (the n-th of its kind in the beat)
        const nth = people.slice(0, i).filter(x => x.who === f.who).length;
        const lk = lookOf(who, group, `${beat.key.split(':')[0]}:${f.who}:${nth}:${gx}`, f.sex);
        let headH = cfg.headH;
        if (lk.age === 'child') headH = cfg.headH === 1.62 ? 1.08 : cfg.headH - 0.3;
        else if (lk.age === 'teen' && group !== 'teen') headH -= 0.06;
        else if (lk.age === 'elder') headH -= 0.05;
        const [x, y] = P(c, X, headH, Z);
        const R = (c.f * HEAD) / (Z + c.dz);
        out.push({ look: lk, mood: f.mood, x, y, R, speaking: beat.from === i && gx === 0 && speakingFor(look.since), phase: (j * 1.7 + i) % 6, fi: i, mid: gx === 0 });
      }
    });
    // the far ones first
    return out.sort((a, b) => a.R - b.R);
  }

  /** Draw the beat with the moment's look. */
  draw(ctx: CanvasRenderingContext2D, beat: SceneBeat, group: Age, look: SceneLook): void {
    const l = this.l;
    if (!l) return;
    const e = smooth(look.out);
    const eyesA = 1 - e;
    ctx.save();
    ctx.fillStyle = '#20202a';
    ctx.fillRect(0, 0, l.w, l.h);
    const pivot = { x: l.frame.cx, y: l.frame.headY };
    const outPivot = { x: l.out.otherX, y: l.out.otherY };
    // the views' backgrounds: the eyes draw back and fade, the observer's view settles in
    if (eyesA > 0.002) this.image(ctx, this.baked(beat.place, 'eyes').back, this.baked(beat.place, 'eyes').m, pivot, lerp(1, 0.88, e) * (1 + 0.04 * look.heat), eyesA);
    if (e > 0.002) this.image(ctx, this.baked(beat.place, 'out').back, this.baked(beat.place, 'out').m, outPivot, lerp(1.1, 1, e), 1);
    // the people: their places lerped from the eyes to the observer's view
    const pe = this.place(beat, group, 'eyes', look);
    const po = e > 0.002 ? this.place(beat, group, 'out', look) : pe;
    const bottom = l.h + 4;
    for (let i = 0; i < pe.length; i++) {
      const a = pe[i], b = po[i] ?? a;
      const zoom = lerp(1, 0.88, e);
      const ax = pivot.x + (a.x - pivot.x) * zoom, ay = pivot.y + (a.y - pivot.y) * zoom;
      drawPerson(ctx, {
        x: lerp(ax, b.x, e), y: lerp(ay, b.y, e), R: lerp(a.R * zoom, b.R, e), look: a.look, mood: a.mood, t: look.t, frozen: look.frozen,
        speaking: a.speaking && !look.frozen, phase: a.phase, bottom,
      });
    }
    // the place's foreground (the desk, the counter's glass, the dashboard)
    const be = this.baked(beat.place, 'eyes');
    if (be.front && eyesA > 0.002) this.image(ctx, be.front, be.m, pivot, lerp(1, 0.88, e), eyesA);
    if (e > 0.002) {
      const bo = this.baked(beat.place, 'out');
      if (bo.front) this.image(ctx, bo.front, bo.m, outPivot, lerp(1.1, 1, e), e);
    }
    // the player's hands and what they hold, through the eyes
    if (eyesA > 0.02) {
      ctx.globalAlpha = eyesA;
      this.hands(ctx, beat, group, look);
      ctx.globalAlpha = 1;
    }
    // the player from behind and aside, rising into the frame as the camera steps out
    if (e > 0.002) {
      const Rs = l.frame.R * 1.2;
      const rise = (1 - e) * Rs * 4;
      ctx.globalAlpha = Math.min(1, e * 1.4);
      drawSelf(ctx, l.out.selfX, l.out.selfY + rise, Rs, group, bottom);
      // on a phone filling the view: its light on the player, the screen's edge at their hands
      if (beat.place === 'screen') {
        soft(ctx, l.out.selfX + Rs * 1.5, l.out.selfY + rise + Rs * 2.1, Rs * 2.6, '#bcd8ff', 0.4);
        fillRR(ctx, l.out.selfX + Rs * 1.25, l.out.selfY + rise + Rs * 1.7, Rs * 0.5, Rs * 0.85, Rs * 0.08, '#e8f2ff');
      }
      ctx.globalAlpha = 1;
    }
    this.tints(ctx, look);
    ctx.restore();
  }

  /** A baked layer drawn scaled about a pivot with an alpha. */
  private image(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement | null, m: number, pivot: { x: number; y: number }, s: number, a: number): void {
    const l = this.l!;
    if (!img || a <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = clamp01(a);
    ctx.translate(pivot.x, pivot.y);
    ctx.scale(s, s);
    ctx.translate(-pivot.x, -pivot.y);
    ctx.drawImage(img, -m, -m, l.w + 2 * m, l.h + 2 * m);
    ctx.restore();
  }

  /** The heat's warmth and narrowing, the freeze's drained colour and its cool, the flash. */
  private tints(ctx: CanvasRenderingContext2D, look: SceneLook): void {
    const l = this.l!;
    const heat = clamp01(look.heat);
    if (heat > 0.02) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = rgba('#ff6a2a', 0.55 * heat);
      ctx.fillRect(0, 0, l.w, l.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    const grey = 1 - clamp01(look.sat);
    if (grey > 0.01) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${grey.toFixed(3)})`;
      ctx.fillRect(0, 0, l.w, l.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    const cool = clamp01(look.cool);
    if (cool > 0.01) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = rgba('#6f8fc0', 0.6 * cool);
      ctx.fillRect(0, 0, l.w, l.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the view narrows with the heat (a soft dark edge), and a still's gentle frame in the freeze
    const narrow = 0.25 + 0.55 * heat + 0.25 * cool;
    this.vignetteDraw(ctx, narrow);
    if (look.flash > 0.01) {
      ctx.fillStyle = `rgba(255,252,244,${(0.85 * clamp01(look.flash)).toFixed(3)})`;
      ctx.fillRect(0, 0, l.w, l.h);
    }
  }

  private vignetteDraw(ctx: CanvasRenderingContext2D, a: number): void {
    const l = this.l!;
    if (a <= 0.01) return;
    if (!this.vignette) {
      const v = layer(256, 256);
      const g = v?.getContext('2d');
      if (v && g) {
        const grad = g.createRadialGradient(128, 128, 60, 128, 128, 182);
        grad.addColorStop(0, 'rgba(20,12,10,0)');
        grad.addColorStop(1, 'rgba(20,12,10,0.85)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 256);
      }
      this.vignette = v;
    }
    if (!this.vignette) return;
    ctx.save();
    ctx.globalAlpha = clamp01(a);
    ctx.drawImage(this.vignette, 0, 0, l.w, l.h);
    ctx.restore();
  }

  // ── the player's hands and what they hold ─────────────────────

  private hands(ctx: CanvasRenderingContext2D, beat: SceneBeat, group: Age, look: SceneLook): void {
    const l = this.l!;
    const v = l.view;
    const R = l.frame.R;
    const capTop = l.mode === 'upright' ? l.caption.y : l.band.y + l.band.h;
    const base = Math.min(l.h + 6, capTop + R * 1.2);
    if (beat.place === 'screen') {
      this.phone(ctx, beat, group, true);
      return;
    }
    if (beat.place === 'car') {
      const g = carFrame(l, 'eyes');
      const { x: wx, y: wy, r: wr } = g.wheel;
      const hr = Math.max(9, wr * 0.17);
      arm(ctx, wx - wr * 1.25, l.h + 20, wx + Math.cos(-2.6) * wr, wy + Math.sin(-2.6) * wr, hr, group, undefined, -0.5);
      arm(ctx, wx + wr * 1.25, l.h + 20, wx + Math.cos(-0.54) * wr, wy + Math.sin(-0.54) * wr, hr, group, undefined, 0.5);
      // a child or a teenager behind: in the mirror
      const back = beat.people.find(f => f.who === 'child' || f.who === 'teenager' || f.who === 'partner');
      if (back) {
        const mm = g.mirror;
        ctx.save();
        rr(ctx, mm.x + 3, mm.y + 3, mm.w - 6, mm.h - 6, 4);
        ctx.clip();
        const lk = lookOf(back.who, group, `${beat.key.split(':')[0]}:${back.who}:0:0`, back.sex);
        drawPerson(ctx, { x: mm.x + mm.w * 0.62, y: mm.y + mm.h * 0.48, R: mm.h * 0.26, look: lk, mood: back.mood, t: look.t, frozen: look.frozen, speaking: false, phase: 1, bottom: mm.y + mm.h * 2 });
        ctx.restore();
      }
      return;
    }
    const prop = beat.prop;
    if (!prop) return;
    const rx = v.x + v.w * (l.mode === 'upright' ? 0.78 : 0.76);
    switch (prop) {
      case 'phone': this.phone(ctx, beat, group, false); break;
      case 'paper': this.paper(ctx, beat, group, base); break;
      case 'cup': {
        const x = rx, y = base - R * 1.6;
        arm(ctx, x + R * 1.4, l.h + 10, x + R * 0.35, y + R * 0.2, R * 0.5, group);
        fillRR(ctx, x - R * 0.55, y - R * 0.7, R * 1.0, R * 1.1, R * 0.18, '#f2ece2');
        ellipse(ctx, x - R * 0.05, y - R * 0.7, R * 0.5, R * 0.14, '#6a4a32');
        ctx.strokeStyle = '#f2ece2';
        ctx.lineWidth = R * 0.14;
        ctx.beginPath();
        ctx.arc(x + R * 0.48, y - R * 0.15, R * 0.24, -1.2, 1.2);
        ctx.stroke();
        break;
      }
      case 'keys': case 'card': case 'ticket': case 'remote': {
        const x = rx, y = base - R * 1.5;
        arm(ctx, x + R * 1.2, l.h + 10, x, y, R * 0.5, group, undefined, 0.3);
        if (prop === 'keys') {
          ctx.strokeStyle = '#c9b46a';
          ctx.lineWidth = R * 0.1;
          ctx.beginPath();
          ctx.arc(x - R * 0.5, y - R * 0.5, R * 0.22, 0, TAU);
          ctx.stroke();
          fillRR(ctx, x - R * 0.95, y - R * 0.6, R * 0.5, R * 0.14, R * 0.05, '#b8bcc0');
        } else if (prop === 'card') {
          fillRR(ctx, x - R * 1.05, y - R * 0.85, R * 1.0, R * 0.64, R * 0.08, '#3f6fb0');
          fillRR(ctx, x - R * 0.95, y - R * 0.72, R * 0.22, R * 0.16, R * 0.03, '#e8c66a');
        } else if (prop === 'ticket') {
          fillRR(ctx, x - R * 0.95, y - R * 1.0, R * 0.8, R * 0.95, R * 0.05, '#fbf8f0');
          ctx.fillStyle = '#2a211c';
          ctx.font = font(R * 0.38, 800);
          ctx.textAlign = 'center';
          ctx.fillText('047', x - R * 0.55, y - R * 0.4);
        } else {
          fillRR(ctx, x - R * 0.35, y - R * 1.35, R * 0.5, R * 1.3, R * 0.15, '#2b2e33');
          for (let i = 0; i < 3; i++) ellipse(ctx, x - R * 0.1, y - R * (1.1 - i * 0.3), R * 0.07, R * 0.07, '#8a9098');
        }
        break;
      }
      case 'bag': {
        const x = v.x + v.w * 0.2, y = base - R * 0.6;
        fillRR(ctx, x - R * 1.1, y - R * 1.2, R * 2.2, R * 1.8, R * 0.5, '#5e7f6a');
        fillRR(ctx, x - R * 0.8, y - R * 0.6, R * 1.6, R * 0.7, R * 0.3, '#6f9a7e');
        break;
      }
      case 'plate': {
        const x = v.x + v.w * 0.5, y = base - R * 0.9;
        ellipse(ctx, x, y, R * 1.5, R * 0.42, '#f6f2ea');
        ellipse(ctx, x, y, R * 1.0, R * 0.26, '#ece5d8');
        ellipse(ctx, x + R * 0.1, y - R * 0.05, R * 0.5, R * 0.14, '#d69a5a');
        break;
      }
      case 'toy': {
        const x = v.x + v.w * 0.24, y = base - R * 0.7;
        fillRR(ctx, x - R * 0.5, y - R * 0.5, R, R, R * 0.12, '#e05a4a');
        fillRR(ctx, x + R * 0.3, y - R * 0.2, R * 0.7, R * 0.7, R * 0.1, '#4a8fd0');
        ellipse(ctx, x - R * 0.9, y - R * 0.1, R * 0.4, R * 0.45, '#c8955a');
        break;
      }
      case 'laptop': {
        const x = v.x + v.w * 0.5, y = base - R * 0.5;
        fillRR(ctx, x - R * 2.2, y - R * 2.4, R * 4.4, R * 2.6, R * 0.15, '#3a3f46');
        fillRR(ctx, x - R * 2.0, y - R * 2.25, R * 4.0, R * 2.3, R * 0.1, '#dfe7ee');
        if (beat.screen) this.screenText(ctx, beat.screen, x - R * 1.85, y - R * 2.1, R * 3.7, R * 2.0, '#2a3340', Math.max(13, R * 0.42));
        fillRR(ctx, x - R * 2.6, y + R * 0.2, R * 5.2, R * 0.35, R * 0.1, '#5a6068');
        break;
      }
      case 'clock': {
        const x = v.x + v.w * 0.84, y = v.y + Math.max(R * 1.2, v.h * 0.16);
        ellipse(ctx, x, y, R * 0.75, R * 0.75, '#fbf7ee');
        ctx.strokeStyle = '#3a302a';
        ctx.lineWidth = Math.max(1.5, R * 0.1);
        ctx.beginPath();
        ctx.arc(x, y, R * 0.75, 0, TAU);
        ctx.moveTo(x, y);
        ctx.lineTo(x + R * 0.42, y + R * 0.12);
        ctx.moveTo(x, y);
        ctx.lineTo(x - R * 0.05, y - R * 0.58);
        ctx.stroke();
        break;
      }
      default: break;
    }
  }

  /** Lines of words cached per text and width. */
  private lines(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight = 600): string[] {
    const key = `${px}|${weight}|${Math.round(maxW)}|${text}`;
    let hit = this.textCache.get(key);
    if (!hit) {
      ctx.font = font(px, weight);
      hit = wrap(ctx, text, maxW);
      this.textCache.set(key, hit);
      if (this.textCache.size > 200) this.textCache.delete(this.textCache.keys().next().value as string);
    }
    return hit;
  }

  private screenText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, col: string, px: number): void {
    const lines = this.lines(ctx, text, w, px, 600);
    ctx.font = font(px, 600);
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lh = px * 1.3;
    for (let i = 0; i < lines.length && (i + 1) * lh <= h + 1; i++) ctx.fillText(lines[i], x, y + i * lh);
  }

  /** A phone: filling the view (the place 'screen') or held in the right hand (the prop). */
  private phone(ctx: CanvasRenderingContext2D, beat: SceneBeat, group: Age, full: boolean): void {
    const l = this.l!;
    const v = l.view;
    const R = l.frame.R;
    const capTop = l.mode === 'upright' ? l.caption.y : l.band.y + l.band.h;
    const px = Math.max(13, Math.round(l.font * 0.9));
    let x: number, y: number, w: number, h: number;
    if (full) {
      w = Math.min(v.w * (l.mode === 'upright' ? 0.78 : 0.62), 380 * l.k);
      x = v.x + (v.w - w) / 2;
      y = v.y + Math.max(8, v.h * 0.04);
      h = Math.max(capTop - y + R * 2, w * 1.4);
    } else {
      w = Math.min(v.w * 0.34, 150 * l.k);
      h = w * 1.9;
      x = v.x + v.w * (l.mode === 'upright' ? 0.96 : 0.92) - w;
      y = capTop - w * 1.05;
    }
    // the hands holding it
    arm(ctx, x - R * 0.2, l.h + 10, x + w * 0.06, y + h * 0.62, R * 0.55, group, undefined, -0.3);
    fillRR(ctx, x, y, w, h, w * 0.12, '#1d2026');
    const s = w * 0.05;
    fillRR(ctx, x + s, y + s, w - 2 * s, h - 2 * s, w * 0.09, '#f3f5f7');
    arm(ctx, x + w + R * 0.4, l.h + 10, x + w * 0.96, y + h * 0.58, R * 0.55, group, undefined, 0.3);
    const ix = x + s * 2.2, iw = w - s * 4.4;
    let cy = y + s * 2;
    const visible = capTop - 4;
    // the header: who it is from (the first figure's face), and a line for the name
    const first = beat.people[0];
    if (full) {
      const ar = Math.max(9, w * 0.07);
      if (first) {
        const lk = lookOf(first.who === 'group' ? 'peer' : first.who, group, `${beat.key.split(':')[0]}:${first.who}:0:0`, first.sex);
        avatar(ctx, ix + ar, cy + ar, ar, lk, first.mood);
      } else ellipse(ctx, ix + ar, cy + ar, ar, ar, '#c9d3dc');
      fillRR(ctx, ix + ar * 2.6, cy + ar * 0.55, iw * 0.42, ar * 0.42, ar * 0.2, '#c9d0d8');
      ctx.fillStyle = '#e3e7eb';
      ctx.fillRect(x + s, cy + ar * 2 + s, w - 2 * s, 1);
      cy += ar * 2 + s * 2;
    }
    // a call with no one in the view: the phone shows the call (a face's circle, a handset, the time running)
    if (!beat.screen && beat.say && !beat.people.length) {
      const cr = Math.min(iw * 0.22, (visible - cy) * 0.28);
      if (cr > 6) {
        const ccx = x + w / 2, ccy = cy + cr + s * 2;
        ellipse(ctx, ccx, ccy, cr, cr, '#c9d3dc');
        ellipse(ctx, ccx, ccy - cr * 0.2, cr * 0.36, cr * 0.38, '#eef2f5');
        ellipse(ctx, ccx, ccy + cr * 0.62, cr * 0.62, cr * 0.36, '#eef2f5');
        fillRR(ctx, ccx - iw * 0.3, ccy + cr * 1.35, iw * 0.6, Math.max(6, cr * 0.22), 4, '#d5dbe1');
        const by = Math.min(visible - cr * 0.7, ccy + cr * 2.4);
        ellipse(ctx, ccx, by, cr * 0.55, cr * 0.55, '#3f9a6a');
      }
    }
    // the screen's words (a post, a message, a notice) and someone's words as an incoming bubble
    const lh = px * 1.3;
    if (beat.screen) {
      const lines = this.lines(ctx, beat.screen, iw - px, px, 700);
      const bh = lines.length * lh + px * 0.8;
      if (cy + bh <= visible || full) {
        fillRR(ctx, ix, cy, iw, bh, px * 0.5, '#e6eef6');
        ctx.font = font(px, 700);
        ctx.fillStyle = '#23303e';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((ln, i) => ctx.fillText(ln, ix + px * 0.5, cy + px * 0.4 + i * lh));
        cy += bh + px * 0.6;
      }
    }
    if (full && beat.say) {
      const lines = this.lines(ctx, beat.say, iw * 0.82 - px, px, 600);
      const bh = lines.length * lh + px * 0.8;
      const bw = Math.min(iw * 0.86, Math.max(...lines.map(t => { ctx.font = font(px, 600); return ctx.measureText(t).width; })) + px);
      fillRR(ctx, ix, cy, bw, bh, px * 0.6, '#ffffff');
      ctx.strokeStyle = '#d5dbe1';
      ctx.lineWidth = 1;
      rr(ctx, ix, cy, bw, bh, px * 0.6);
      ctx.stroke();
      ctx.font = font(px, 600);
      ctx.fillStyle = '#26221e';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((ln, i) => ctx.fillText(ln, ix + px * 0.5, cy + px * 0.4 + i * lh));
    }
    void lang;
  }

  /** A paper held in both hands with its few words. */
  private paper(ctx: CanvasRenderingContext2D, beat: SceneBeat, group: Age, base: number): void {
    const l = this.l!;
    const v = l.view;
    const R = l.frame.R;
    const w = Math.min(v.w * 0.4, 230 * l.k), h = w * 0.62;
    const x = v.x + v.w * 0.62 - w / 2, y = base - h * 0.9;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(-0.05);
    ctx.translate(-w / 2, -h / 2);
    fillRR(ctx, 0, 0, w, h, 3, '#fbf8f0');
    ctx.strokeStyle = 'rgba(120,150,180,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let yy = h * 0.2; yy < h; yy += h * 0.14) { ctx.moveTo(w * 0.06, yy); ctx.lineTo(w * 0.94, yy); }
    ctx.stroke();
    if (beat.screen) this.screenText(ctx, beat.screen, w * 0.08, h * 0.12, w * 0.84, h * 0.8, '#b0302a', Math.max(13, Math.round(l.font * 0.92)));
    ctx.restore();
    arm(ctx, x - R * 0.3, l.h + 10, x + R * 0.1, y + h * 0.75, R * 0.5, group, undefined, -0.5);
    arm(ctx, x + w + R * 0.3, l.h + 10, x + w - R * 0.1, y + h * 0.7, R * 0.5, group, undefined, 0.5);
  }

  /** Where the speaker's mouth is now (for the bubble's tail), or null. */
  speakerAt(beat: SceneBeat, group: Age, look: SceneLook): { x: number; y: number; R: number } | null {
    if (beat.from === null || beat.from < 0 || beat.place === 'screen') return null;
    // the speaker: the placed figure of the beat's `from` (a group speaks from its middle)
    const target = this.place(beat, group, 'eyes', look).find(p => p.fi === beat.from && p.mid);
    return target ? { x: target.x, y: target.y + target.R * 0.5, R: target.R } : null;
  }
}

/** The car's inside through the eyes (or scaled back in the observer's view), in canvas px: the roof's edge, the
 * pillars, the dashboard, the mirror and the wheel, framing the windscreen over the view. */
export interface CarFrame {
  roofY: number;
  dashY: number;
  pillar: number;
  mirror: { x: number; y: number; w: number; h: number };
  wheel: { x: number; y: number; r: number };
  w: number;
  h: number;
}

export function carFrame(l: Layout, view: View): CarFrame {
  const v = l.view;
  const k = view === 'out' ? 0.8 : 1;
  const cx = v.x + v.w / 2, cy = v.y + v.h * 0.45;
  const sc = (x: number, y: number): [number, number] => [cx + (x - cx) * k, cy + (y - cy) * k];
  const [, roofY] = sc(0, v.y + v.h * 0.05);
  const [, dashY] = sc(0, v.y + v.h * 0.8);
  const mw = Math.min(170, v.w * 0.28) * k;
  const [mx, my] = sc(cx + v.w * 0.06, v.y + v.h * 0.1);
  const wr = Math.min(190, v.w * 0.27) * k;
  const [wx, wy] = sc(v.x + v.w * 0.3, v.y + v.h * 0.8 + wr * 0.62 / k);
  return { roofY, dashY, pillar: Math.max(16, v.w * 0.1) * k, mirror: { x: mx - mw / 2, y: my, w: mw, h: mw * 0.26 }, wheel: { x: wx, y: wy, r: wr }, w: l.w, h: l.h };
}

/** Paint the car's inside (into a baked layer with margin `m`). */
function drawCar(ctx: CanvasRenderingContext2D, g: CarFrame, m: number): void {
  ctx.save();
  ctx.translate(m, m);
  const W = g.w, H = g.h;
  const lining = '#4c4642', dark = '#2e2a28';
  // the roof's lining over the windscreen, its soft edge
  ctx.fillStyle = lining;
  ctx.fillRect(-m, -m, W + 2 * m, g.roofY + m);
  ctx.fillStyle = dark;
  ctx.fillRect(-m, g.roofY - 4, W + 2 * m, 6);
  // the pillars: from the roof's corners down to the dashboard's ends
  const p = g.pillar;
  ctx.beginPath();
  ctx.moveTo(-m, g.roofY - 2);
  ctx.lineTo(p * 1.4, g.roofY - 2);
  ctx.lineTo(p * 0.4, g.dashY);
  ctx.lineTo(-m, g.dashY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W + m, g.roofY - 2);
  ctx.lineTo(W - p * 1.4, g.roofY - 2);
  ctx.lineTo(W - p * 0.4, g.dashY);
  ctx.lineTo(W + m, g.dashY);
  ctx.closePath();
  ctx.fill();
  // the dashboard: a soft curve, darker toward the player
  const grad = ctx.createLinearGradient(0, g.dashY - 10, 0, H + m);
  grad.addColorStop(0, '#4a4440');
  grad.addColorStop(0.15, '#3a3532');
  grad.addColorStop(1, '#25211f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-m, g.dashY + 6);
  ctx.quadraticCurveTo(W / 2, g.dashY - 18, W + m, g.dashY + 6);
  ctx.lineTo(W + m, H + m);
  ctx.lineTo(-m, H + m);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,220,0.12)';
  ctx.fillRect(W * 0.55, g.dashY + 4, W * 0.22, 4);
  // the mirror on its stem
  const mm = g.mirror;
  ctx.fillStyle = dark;
  ctx.fillRect(mm.x + mm.w / 2 - 3, g.roofY, 6, mm.y - g.roofY + 2);
  fillRR(ctx, mm.x, mm.y, mm.w, mm.h, 6, '#26221f');
  fillRR(ctx, mm.x + 3, mm.y + 3, mm.w - 6, mm.h - 6, 4, '#9fb6c8');
  // the wheel
  const wh = g.wheel;
  ctx.strokeStyle = '#1f1c1a';
  ctx.lineWidth = wh.r * 0.16;
  ctx.beginPath();
  ctx.arc(wh.x, wh.y, wh.r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = wh.r * 0.12;
  ctx.beginPath();
  ctx.moveTo(wh.x - wh.r, wh.y + wh.r * 0.1);
  ctx.lineTo(wh.x + wh.r, wh.y + wh.r * 0.1);
  ctx.stroke();
  ellipse(ctx, wh.x, wh.y + wh.r * 0.1, wh.r * 0.3, wh.r * 0.24, '#2b2724');
  ctx.restore();
}

/** A word's colour on the cards (for the hud). */
export const CARD = { bg: rgba(INK.paper, 0.94), ink: INK.ink, soft: INK.inkSoft, edge: INK.paperEdge, dark: rgba('#141018', 0.62) };
export { FONT, mix, shade };
