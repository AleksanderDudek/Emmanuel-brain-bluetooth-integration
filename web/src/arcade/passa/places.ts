/**
 * Złota passa's places of the day (DESIGN.md §29, the film — builder P2): every place of life.ts `PLACES` but the street
 * (scene.ts draws that one) as a painted set on the stage (stage.ts) in two layers the camera moves at different
 * speeds — the far one (walls, windows and their views) and the near one (the surface and what stands on it) — with
 * a live part between them (people passing, a window's weather) and over them (steam, water, a breath).  Each set
 * names where its things are (`hot`, the camera's aim for a moment's motif), the spot where a moment's object stands
 * when the place has none of its own, and its main window (the weather of a rain or a rainbow moment shows there).
 *
 * The layers are baked per size and per step of the day (`PLACE_STEPS`, two steps crossfaded, as the street does):
 * the live layer is small.  Without a DOM (tests) a set paints straight into the context.
 */
import type { Xf } from './camera';
import type { Place } from './life';
import { clamp01, layer, rgba } from './paint';
import { HOME_SETS } from './places-home';
import { OUT_SETS } from './places-out';
import { WORK_SETS } from './places-work';
import { roomAt, tone, type Ctx, type Room, type Stage } from './stage';
import { SPOT_OBJECTS, drawObject, type AnyMotif } from './things';

export interface PlaceSet {
  id: Place;
  /** the hour (0..1 of the day) its sun comes in most */
  face: number;
  /** live, before the far layer (whose glass is cut out): the world passing a vehicle's windows */
  beyond?(c: Ctx, S: Stage, R: Room, t: number, reduced: boolean): void;
  back(c: Ctx, S: Stage, R: Room): void;
  front(c: Ctx, S: Stage, R: Room): void;
  /** live, between the layers (it moves with the far one): people passing, the window's life */
  behind?(c: Ctx, S: Stage, R: Room, t: number, reduced: boolean): void;
  /** live, over the near layer: steam, a drip, a breath */
  over?(c: Ctx, S: Stage, R: Room, t: number, reduced: boolean): void;
  /** where things are (units): the camera's aim for a moment's motif */
  hot: Partial<Record<AnyMotif, [number, number]>>;
  /** the aim when the motif has no place here */
  aim: [number, number];
  /** where a moment's object stands when the set has none of its own (units: its foot) and its size */
  spot: [number, number, number];
  /** the motifs the set itself shows (no object is added for them) */
  has: readonly AnyMotif[];
  /** the main window (units), where a rain or a rainbow moment's weather shows; null outdoors */
  win: [number, number, number, number] | null;
}

export const PLACE_SETS: Readonly<Partial<Record<Place, PlaceSet>>> = { ...HOME_SETS, ...OUT_SETS, ...WORK_SETS };

/** The set of a place (the street has none: scene.ts). */
export const setOf = (p: Place | null | undefined): PlaceSet | null => (p ? PLACE_SETS[p] ?? null : null);

/** Steps of the day a place is baked at (crossfaded between). */
export const PLACE_STEPS = 24;
/** At most this device-pixel ratio for a place's layers (soft painting needs no more; it saves memory)… */
export const PLACE_DPR = 1.5;
/** …and at most this many device pixels a layer (a big screen's places bake a little softer, and fast). */
export const PLACE_PIXELS = 2.4e6;

/** The aim of a motif in a set (units), or the set's own. */
export function aimIn(set: PlaceSet, motif: string | null | undefined): [number, number] {
  const m = (motif ?? '') as AnyMotif;
  const h = set.hot[m];
  if (h) return h;
  if (SPOT_OBJECTS.includes(m) && !set.has.includes(m)) return [set.spot[0], set.spot[1] - set.spot[2] * 0.5];
  if ((m === 'rain' || m === 'rainbow' || m === 'sky' || m === 'sun') && set.win) return [(set.win[0] + set.win[2]) / 2, (set.win[1] + set.win[3]) / 2];
  return set.aim;
}

type Baked = { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; step: number };

/** The baked layers of the places shown (the one now and the one a cut is leaving). */
export class PlaceLayers {
  private S: Stage | null = null;
  private dpr = 1;
  private key = '';
  private cache = new Map<string, Baked[]>();
  private order: Place[] = [];
  /** bakes this frame: a layer's second step waits for a frame with none (a cut bakes its first steps only) */
  private bakes = 0;

  /** A new frame: the bake budget starts again. */
  frame(): void { this.bakes = 0; }

  resize(S: Stage, dpr: number): void {
    const area = (S.w + 2 * S.M) * (S.h + 2 * S.M);
    const d = Math.max(0.75, Math.min(PLACE_DPR, Math.max(1, dpr || 1), Math.sqrt(PLACE_PIXELS / Math.max(1, area))));
    const key = `${Math.round(S.w)}|${Math.round(S.h)}|${d}|${S.cx.toFixed(1)}|${S.hy.toFixed(1)}|${S.u.toFixed(2)}|${S.age ?? ''}`;
    this.S = S;
    this.dpr = d;
    if (key !== this.key) {
      this.key = key;
      this.cache.clear();
      this.pool = [];
      this.order = [];
    }
  }

  get stage(): Stage | null { return this.S; }

  /** Keep only the places in `keep` (the others' canvases go to a pool the next place's bakes take from). */
  keep(keep: readonly Place[]): void {
    for (const k of [...this.cache.keys()]) {
      const p = k.split('|')[0] as Place;
      if (!keep.includes(p)) {
        for (const b of this.cache.get(k) ?? []) if (this.pool.length < 6) this.pool.push(b);
        this.cache.delete(k);
      }
    }
    this.order = this.order.filter(p => keep.includes(p));
  }

  private pool: Baked[] = [];

  /**
   * Draw a place's layer at a moment of the day through a layer's transform (camera.ts `Xf`: a canvas point q lands at
   * q·z + (x, y)).  Two baked steps crossfaded; painted live without a DOM.
   */
  draw(ctx: Ctx, set: PlaceSet, which: 'back' | 'front', day: number, xf: Xf, dpr: number): void {
    const S = this.S;
    if (!S) return;
    // the baked canvas's origin is the overscan's corner (−M, −M)
    const m = { z: xf.z, x: xf.x - S.M * xf.z, y: xf.y - S.M * xf.z };
    const d = clamp01(day);
    const f = d * PLACE_STEPS;
    const s0 = Math.min(PLACE_STEPS - 1, Math.floor(f));
    const k = f - s0;
    const a = this.baked(set, which, s0);
    if (!a) {
      // no canvas (tests): the set painted straight in, at the transform
      ctx.save();
      ctx.setTransform(dpr * m.z * S.u, 0, 0, dpr * m.z * S.u, dpr * (m.x + m.z * (S.M + S.cx)), dpr * (m.y + m.z * (S.M + S.hy)));
      const R = roomAt(d, set.face);
      if (which === 'back') set.back(ctx, S, R); else set.front(ctx, S, R);
      ctx.restore();
      return;
    }
    const b = k > 0.004 ? this.baked(set, which, s0 + 1, this.bakes > 0) : null;
    ctx.save();
    ctx.setTransform(dpr * m.z, 0, 0, dpr * m.z, dpr * m.x, dpr * m.y);
    const W = S.w + 2 * S.M, H = S.h + 2 * S.M;
    ctx.drawImage(a.c, 0, 0, W, H);
    if (b) {
      ctx.globalAlpha = k;
      ctx.drawImage(b.c, 0, 0, W, H);
    }
    ctx.restore();
  }

  /** The baked canvas of a layer at a step (two kept per layer: the older one re-baked). */
  private baked(set: PlaceSet, which: 'back' | 'front', step: number, wait = false): Baked | null {
    const S = this.S!;
    const key = `${set.id}|${which}`;
    let list = this.cache.get(key);
    if (!list) { list = []; this.cache.set(key, list); }
    const hit = list.find(b => b.step === step);
    if (hit) return hit;
    if (wait) return null;
    this.bakes++;
    let L: Baked | null = null;
    if (list.length >= 2) {
      // re-use the one farther from the step asked
      list.sort((p, q) => Math.abs(q.step - step) - Math.abs(p.step - step));
      L = list[0];
    } else {
      const made = this.pool.pop() ?? layer(S.w + 2 * S.M, S.h + 2 * S.M, this.dpr);
      if (!made) return null;
      L = { c: made.c, ctx: made.ctx, step: -1 };
      list.push(L);
    }
    const c = L.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, L.c.width, L.c.height);
    c.setTransform(this.dpr * S.u, 0, 0, this.dpr * S.u, this.dpr * (S.M + S.cx), this.dpr * (S.M + S.hy));
    const R = roomAt(step / PLACE_STEPS, set.face);
    try {
      // a warm dark ground under the far layer: no corner of a wide screen is ever empty
      if (which === 'back') { c.fillStyle = tone('#5a4636', R); c.fillRect(S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0); }
      if (which === 'back') set.back(c, S, R); else set.front(c, S, R);
    } catch (e) {
      console.error(e);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    L.step = step;
    if (!this.order.includes(set.id)) this.order.push(set.id);
    return L;
  }
}

/**
 * The live part of a place for its depth: the set's own (`behind` / `over`), a moment's object at the set's spot (when
 * the set has none of its own), the weather of a rain or a rainbow moment in its window.
 */
export function drawLive(ctx: Ctx, set: PlaceSet, which: 'behind' | 'over', S: Stage, R: Room, t: number, reduced: boolean, motif: string | null, open: number): void {
  const tt = reduced ? 0 : t;
  if (which === 'behind') {
    set.behind?.(ctx, S, R, tt, reduced);
    const w = set.win;
    if (w && (motif === 'rain' || motif === 'rainbow')) weather(ctx, w, motif, tt, R);
    return;
  }
  const m = (motif ?? '') as AnyMotif;
  if (motif && SPOT_OBJECTS.includes(m) && !set.has.includes(m)) {
    const [x, y, s] = set.spot;
    drawObject(ctx, m, R, x, y, s, tt, open);
  }
  set.over?.(ctx, S, R, tt, reduced);
}

/** Rain streaking a window, or a rainbow in it (live, clipped to the window). */
function weather(c: Ctx, w: [number, number, number, number], m: 'rain' | 'rainbow', t: number, R: Room): void {
  const [x0, y0, x1, y1] = w;
  c.save();
  c.beginPath();
  c.rect(x0, y0, x1 - x0, y1 - y0);
  c.clip();
  if (m === 'rain') {
    c.fillStyle = rgba('#5a6a80', 0.22);
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = rgba('#e0ecf4', 0.55);
    c.lineWidth = 0.012;
    c.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const ph = ((t * (0.9 + (i % 5) * 0.12)) + i * 0.137) % 1;
      const x = x0 + (x1 - x0) * ((i * 0.381) % 1), y = y0 + (y1 - y0) * ph;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 0.03, y + 0.16); c.stroke();
    }
  } else {
    const cx = (x0 + x1) / 2, cy = y1 + (y1 - y0) * 0.3, r = (x1 - x0) * 0.62;
    const cols = ['#ff6a5a', '#ffa848', '#ffe060', '#7ad070', '#5aa8f0', '#8a78e0'];
    c.globalAlpha = 0.42 * (1 - R.night);
    cols.forEach((col, i) => {
      c.strokeStyle = col;
      c.lineWidth = r * 0.05;
      c.beginPath(); c.arc(cx, cy, r - i * r * 0.05, Math.PI, Math.PI * 2); c.stroke();
    });
  }
  c.restore();
}
