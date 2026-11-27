/**
 * Złota passa's garland — the streak (DESIGN.md §26, builder B): one string of warm festoon bulbs zig-zagging across the
 * street from facade to facade, nearest span first (world.ts `ANCHORS`).  Each win's light flies up from the card in
 * an arc and lights the next bulb, which flares and settles; the string gently sways.  The street shows the spans the
 * day's wins need — a new span is strung across the street (the wire unrolling) when the last one is nearly full —
 * so there is never a row of unearned dark bulbs ahead.  Past GARLAND_MAX the bulbs double up, brighter.  In the
 * evening the lit garland lights the darkening street.
 */
import { GARLAND_MAX } from './moments';
import { ANCHORS, PER_SPAN, SAG } from './world';
import { project, type Cam } from './scene';
import { C, TAU, clamp01, easeInOut, glow, lerp, mixHex, rgba } from './paint';

export const SPANS = ANCHORS.length - 1;

export interface Bulb { x: number; y: number; z: number; span: number }

/** Where bulb i hangs in the world (`sway` −1..1 moves the sag a little). */
export function bulbAt(i: number, sway = 0): Bulb {
  const n = Math.max(0, Math.floor(i)) % (SPANS * PER_SPAN);
  const span = Math.floor(n / PER_SPAN), j = n % PER_SPAN;
  const a = ANCHORS[span], b = ANCHORS[span + 1];
  const t = (j + 0.5) / PER_SPAN;
  return wireAt(a, b, t, sway, span);
}

function wireAt(a: readonly number[], b: readonly number[], t: number, sway: number, span: number): Bulb {
  const sag = SAG * 4 * t * (1 - t);
  return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t) - sag * (1 + 0.05 * sway), z: lerp(a[2], b[2], t) + sag * 0.22 * sway, span };
}

/** How many spans the street shows for `lights` lit (and one flying): the next bulb's span, at least one. */
export function spansFor(lights: number, flying: number | null): number {
  const n = Math.max(0, Math.floor(lights || 0)) + (flying != null ? 1 : 0);
  return Math.max(1, Math.min(SPANS, Math.ceil((Math.min(n, GARLAND_MAX - 1) + 1) / PER_SPAN)));
}

/** The bulb the light now flying goes to (past GARLAND_MAX the bulbs double up from the first). */
export const targetBulb = (lights: number): number => Math.max(0, Math.floor(lights || 0)) % GARLAND_MAX;

export interface GarlandOpts {
  lights: number;
  flying: number | null;
  time: number;
  reduced: boolean;
  /** calm 0..1 (a rest's glow: the lit bulbs breathe brighter), the evening's dusk 0..1, the breath 0..1 */
  calm: number;
  dusk: number;
  breath: number;
  /** where the flying light starts (the card's stamp), CSS px; the UI scale */
  from: { x: number; y: number } | null;
  k: number;
}

export class Garland {
  private litAt: number[] = [];
  private spanAt: number[] = [];
  private seenLights = -1;
  private seenSpans = 0;

  /** The screen place and size of bulb i now. */
  bulbScreen(c: Cam, i: number, time: number, reduced: boolean): { x: number; y: number; r: number; z: number } {
    const b = bulbAt(i, this.sway(Math.floor(i / PER_SPAN), time, reduced));
    const [x, y] = project(c, b.x, b.y, b.z);
    return { x, y, r: Math.max(1.8, (c.f * 0.12) / b.z), z: b.z };
  }

  private sway(span: number, time: number, reduced: boolean): number {
    return reduced ? 0 : Math.sin(time * 0.55 + span * 1.7) * 0.8 + Math.sin(time * 1.3 + span) * 0.2;
  }

  draw(ctx: CanvasRenderingContext2D, c: Cam, o: GarlandOpts): void {
    const lights = Math.max(0, Math.floor(o.lights || 0));
    const t = o.time;
    // remember when each bulb was lit (its flare) and each span strung (its wire unrolling)
    if (this.seenLights < 0) {
      this.seenLights = lights;
      for (let i = 0; i < lights; i++) this.litAt[i % GARLAND_MAX] = -100;
    } else if (lights > this.seenLights) {
      for (let i = this.seenLights; i < lights; i++) this.litAt[i % GARLAND_MAX] = t;
      this.seenLights = lights;
    } else if (lights < this.seenLights) this.seenLights = lights;
    const spans = spansFor(lights, o.flying);
    if (this.seenSpans === 0) { for (let s = 0; s < spans; s++) this.spanAt[s] = -100; this.seenSpans = spans; }
    else if (spans > this.seenSpans) { for (let s = this.seenSpans; s < spans; s++) this.spanAt[s] = t; this.seenSpans = spans; }
    else if (spans < this.seenSpans) this.seenSpans = spans;
    const dusk = clamp01(o.dusk), calm = clamp01(o.calm);
    const breathe = o.reduced ? 1 : 0.92 + 0.08 * Math.sin(t * 0.9) + 0.1 * calm * (clamp01(o.breath) - 0.5);
    // far spans first
    for (let s = spans - 1; s >= 0; s--) {
      const a = ANCHORS[s], b = ANCHORS[s + 1];
      const strung = o.reduced ? 1 : clamp01((t - (this.spanAt[s] ?? -100)) / 1.4);
      const sw = this.sway(s, t, o.reduced);
      const fade = o.reduced ? clamp01((t - (this.spanAt[s] ?? -100)) / 0.8) : 1;
      // the wire, unrolling from its first anchor when the span is new
      const zm = (a[2] + b[2]) / 2;
      ctx.strokeStyle = rgba(mixHex(C.wire, '#ffd9a0', dusk * 0.15), 0.85 * fade);
      ctx.lineWidth = Math.max(0.8, (c.f * 0.022) / zm);
      ctx.beginPath();
      const N = 22;
      for (let q = 0; q <= N; q++) {
        const u = (q / N) * strung;
        const p = wireAt(a, b, u, sw, s);
        const [x, y] = project(c, p.x, p.y, p.z);
        if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      // the anchors: a small bracket on each wall
      ctx.fillStyle = rgba('#3a3430', fade);
      for (const an of [a, b]) {
        const [x, y] = project(c, an[0], an[1], an[2]);
        const r = Math.max(1.2, (c.f * 0.06) / an[2]);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // the bulbs on it
      for (let j = 0; j < PER_SPAN; j++) {
        const i = s * PER_SPAN + j;
        const u = (j + 0.5) / PER_SPAN;
        if (u > strung) continue;
        const p = wireAt(a, b, u, sw, s);
        const [x, y] = project(c, p.x, p.y, p.z);
        const k = c.f / p.z;
        const r = Math.max(1.8, k * 0.12);
        // the socket and the drop
        ctx.fillStyle = rgba('#2a2420', 0.9 * fade);
        ctx.fillRect(x - r * 0.45, y - r * 1.9, r * 0.9, r * 1.0);
        const lit = i < lights || (lights >= GARLAND_MAX);
        const doubled = lights > GARLAND_MAX && i < lights - GARLAND_MAX;
        if (!lit) {
          // an unlit bulb: clear glass, a glint of the sky
          ctx.fillStyle = rgba('#cfc8bc', 0.42 * fade);
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.85, r, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = rgba('#ffffff', 0.45 * fade);
          ctx.beginPath();
          ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, TAU);
          ctx.fill();
          continue;
        }
        const since = t - (this.litAt[i] ?? -100);
        const flare = since < 0 ? 0 : Math.max(0, 1 - since / 1.6) ** 2;
        const pulse = breathe * (0.94 + 0.06 * Math.sin(t * 1.7 + i * 0.9));
        ctx.globalCompositeOperation = 'lighter';
        // the light it throws on the street in the evening, its halo, its warm core
        if (dusk > 0.05) glow(ctx, '#ffb860', x, y + k * 0.4, k * 2.4, 0.07 * dusk * pulse);
        glow(ctx, '#ffcf80', x, y, k * (0.9 + 0.3 * dusk) * (doubled ? 1.35 : 1), (0.5 + 0.3 * dusk + 0.12 * calm) * pulse);
        glow(ctx, '#fff1c8', x, y, r * 3.6, 0.9 * pulse);
        if (doubled) glow(ctx, '#fff6dc', x, y, r * 5, 0.5 * pulse);
        if (flare > 0.01) {
          glow(ctx, '#fff4d6', x, y, k * 1.8 * (1 + flare), 0.8 * flare);
          if (!o.reduced) {
            ctx.strokeStyle = rgba('#fff0c8', 0.6 * flare);
            ctx.lineWidth = 1.2;
            for (let q = 0; q < 6; q++) {
              const ang = (q / 6) * TAU + i;
              const r0 = r * 2.2, r1 = r * (2.2 + 5 * (1 - flare));
              ctx.beginPath();
              ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0);
              ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
              ctx.stroke();
            }
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // the bulb: warm gold glass by day (it reads on a bright sky), pale and hot at night; a white filament
        ctx.fillStyle = doubled ? '#fffaf0' : mixHex('#ffc444', '#fff3cf', dusk);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.9, r * 1.05, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fffdf6';
        ctx.beginPath();
        ctx.arc(x, y + r * 0.1, r * 0.38, 0, TAU);
        ctx.fill();
      }
    }
  }

  /** The light flying up from the card to its bulb (drawn over the card). */
  flight(ctx: CanvasRenderingContext2D, c: Cam, o: GarlandOpts): void {
    if (o.flying == null || !o.from) return;
    const to = this.bulbScreen(c, targetBulb(o.lights), o.time, o.reduced);
    const from = o.from!;
    const f = clamp01(o.flying ?? 0);
    const ctrl = { x: lerp(from.x, to.x, 0.25), y: Math.min(from.y, to.y) - Math.abs(from.y - to.y) * 0.35 - 30 * o.k };
    const at = (u: number): { x: number; y: number } => {
      const q = easeInOut(clamp01(u)), m = 1 - q;
      return { x: m * m * from.x + 2 * m * q * ctrl.x + q * q * to.x, y: m * m * from.y + 2 * m * q * ctrl.y + q * q * to.y };
    };
    ctx.globalCompositeOperation = 'lighter';
    if (o.reduced) {
      // still frames: the light shows at the card, then at the bulb
      const p = f < 0.5 ? from : to;
      glow(ctx, '#ffe2a0', p.x, p.y, 26 * o.k, 0.9 * (f < 0.5 ? 1 - f * 2 : (f - 0.5) * 2));
    } else {
      for (let j = 14; j >= 1; j--) {
        const p = at(f - j * 0.022);
        if (f - j * 0.022 < 0) continue;
        glow(ctx, '#ffcf80', p.x, p.y, (12 - j * 0.6) * o.k, 0.5 * (1 - j / 15));
      }
      const p = at(f);
      glow(ctx, '#ffd890', p.x, p.y, 34 * o.k, 0.55);
      glow(ctx, '#fff6dc', p.x, p.y, 11 * o.k, 1);
      // a few sparks shed along the way
      for (let j = 0; j < 5; j++) {
        const u = f - 0.05 - j * 0.06;
        if (u < 0) continue;
        const q = at(u);
        const dy = (f - u) * 60 * o.k;
        glow(ctx, '#ffe6b0', q.x + Math.sin(o.time * 3 + j) * 6, q.y + dy, 4 * o.k, 0.7 * (1 - (f - u) * 3));
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
