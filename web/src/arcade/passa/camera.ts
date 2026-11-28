/**
 * Złota passa's camera (DESIGN.md §29, the film — builder P2): the day shot as a film.  Each place is a shot; the
 * camera moves in it as a film's would:
 *
 *   the dolly    a slow travel across the place (indoors, with parallax: the far layer moves at 0.55 of the near
 *                one), or along the street toward its square (a slow push-in)
 *   the push-in  toward the moment's thing in its turn (gently), and for a sense or a given moment all the way in,
 *                where the close-up takes over (`close`)
 *   the lift     after a win the camera looks up a little toward the garland the light flies into
 *   the cut      a new place begins on the beat of a card's arrival: a short dissolve from the last frame of the place
 *                before; the new shot starts from the other side
 *
 * Reduced motion: no moves at all — a still frame per shot, the cuts are fades, the close-up comes as a fade.
 * Everything is CSS px of the canvas; a layer's transform (`layer(depth)`) keeps the overscan covering the canvas.
 */
import type { Place } from './life';
import { clamp01, easeInOut, lerp, smooth } from './paint';
import type { Cam } from './scene';

/** A layer's transform: canvas point q lands at q·z + (x, y) (CSS px; the overscan's origin included by the caller). */
export interface Xf { z: number; x: number; y: number }

export interface ShotAsk {
  place: Place;
  /** the thing's place on the canvas (CSS px) the push-in aims at */
  aim: { x: number; y: number };
  /** 0..1: how far the camera pushes in on the aim (a turn's gentle push, a sense moment's close) */
  push: number;
  /** 0..1: the look up toward the garland (after a win, in the evening) */
  lift: number;
  /** the canvas, its overscan (0 for the street) */
  w: number; h: number; M: number;
  street: boolean;
}

/** Seconds: a cut's dissolve (a fade with reduced motion); the dolly's crossing of a place. */
export const CUT_S = 0.6, CUT_REDUCED_S = 0.9, DOLLY_S = 38;
/** How far a push-in goes (zoom added at push 1) and the street's slow push along it. */
export const PUSH_Z = 0.55, STREET_Z0 = 1.035, STREET_PUSH = 0.07;

export interface Frame {
  /** the zoom (≥ 1), the pan (CSS px) and the point the zoom is about */
  z: number; px: number; py: number; fx: number; fy: number;
}

export class FilmCamera {
  place: Place | null = null;
  prev: Place | null = null;
  /** the dissolve from the place before: 0 just cut … 1 done */
  mix = 1;
  /** the last frame of the place before (it holds still while it fades) */
  prevFrame: Frame | null = null;
  shotT = 0;
  private dir = 1;
  private f: Frame = { z: 1, px: 0, py: 0, fx: 0, fy: 0 };
  private cuts = 0;

  constructor(readonly reduced: boolean) {}

  /** How many cuts so far (the tests and the sound read it). */
  get cutCount(): number { return this.cuts; }
  get frame(): Frame { return this.f; }

  update(dt: number, a: ShotAsk, reduced = this.reduced): Frame {
    const step = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
    if (a.place !== this.place) {
      if (this.place !== null) {
        this.prev = this.place;
        this.prevFrame = { ...this.f };
        this.mix = 0;
        this.cuts++;
      }
      this.place = a.place;
      this.shotT = 0;
      this.dir = -this.dir;
      // a new shot starts where its dolly starts (no travel from the last place's framing)
      this.f = this.target(a, reduced);
    }
    this.shotT += step;
    if (this.mix < 1) this.mix = Math.min(1, this.mix + step / (reduced ? CUT_REDUCED_S : CUT_S));
    if (this.mix >= 1) { this.prev = null; this.prevFrame = null; }
    const tg = this.target(a, reduced);
    if (reduced) { this.f = tg; return this.f; }
    const k = (tau: number) => 1 - Math.exp(-step / tau);
    this.f = {
      z: lerp(this.f.z, tg.z, k(a.push > 0.5 ? 0.9 : 1.4)),
      px: lerp(this.f.px, tg.px, k(1.2)),
      py: lerp(this.f.py, tg.py, k(1.1)),
      fx: lerp(this.f.fx, tg.fx, k(0.8)),
      fy: lerp(this.f.fy, tg.fy, k(0.8)),
    };
    return this.f;
  }

  /** Where the camera wants to be now. */
  private target(a: ShotAsk, reduced: boolean): Frame {
    const push = clamp01(a.push), lift = clamp01(a.lift);
    if (reduced) return { z: a.street ? 1 : 1, px: 0, py: 0, fx: a.w / 2, fy: a.h / 2 };
    // the dolly: across the place and back, slowly, eased at its ends
    const u = (this.shotT / DOLLY_S) % 2;
    const tri = u < 1 ? u : 2 - u;
    const dolly = (2 * easeInOut(tri) - 1) * this.dir;
    let z: number, px: number;
    if (a.street) {
      z = STREET_Z0 + STREET_PUSH * smooth(tri);
      px = dolly * a.w * 0.012;
    } else {
      z = 1;
      px = dolly * a.M * 0.72;
    }
    // the push-in toward the aim: the dolly stands still as it pushes
    z += PUSH_Z * push * push * (2 - push);
    px *= 1 - push;
    const py = lift * a.h * 0.045;
    const fx = lerp(a.w / 2, a.aim.x, Math.min(1, push * 2.2));
    const fy = lerp(a.h * 0.42, a.aim.y, Math.min(1, push * 2.2));
    return { z, px, py, fx, fy };
  }
}

/**
 * A layer's transform for a frame at a depth (0 far … 1 the near layer; the garland hangs at 1): its zoom and pan are
 * the frame's scaled by the depth, clamped so a layer `M` px larger than the canvas on every side still covers it.
 */
export function layerXf(fr: Frame, depth: number, w: number, h: number, M: number): Xf {
  const z = 1 + (fr.z - 1) * depth;
  const lo = (F: number, size: number) => -(size - F) * (z - 1) - M * z;
  const hi = (F: number) => F * (z - 1) + M * z;
  const px = Math.max(lo(fr.fx, w), Math.min(hi(fr.fx), fr.px * depth));
  const py = Math.max(lo(fr.fy, h), Math.min(hi(fr.fy), fr.py * depth));
  // screen q → F + (q − F)·z + p
  return { z, x: fr.fx * (1 - z) + px, y: fr.fy * (1 - z) + py };
}

/** A street camera seen through a layer's transform (the garland and the street's life are projected with it). */
export const camThrough = (c: Cam, x: Xf): Cam => ({ cx: c.cx * x.z + x.x, hy: c.hy * x.z + x.y, f: c.f * x.z });

/** A canvas point through a transform. */
export const through = (x: Xf, px: number, py: number): { x: number; y: number } => ({ x: px * x.z + x.x, y: py * x.z + x.y });
