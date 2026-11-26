/**
 * Dobry bój's fighters (DESIGN.md §25, builder B): a skeleton rig seen from the side, in profile, and a pose for every
 * act of view.ts and every move of moves.ts — the guard, the tell of each strike, each strike over its load → travel →
 * back, each defence, the hit by target, the knockdown, rising, sitting out, the stool, the cheer, the embrace, touching
 * gloves and the openings an opponent gives.
 *
 * The fighter's own frame: x forward (toward the opponent), y up, z toward the fighter's right (rear, in an orthodox
 * stance) side; units of a standing height (1).  A pose is a flat record of numbers (the pelvis, the spine's lean,
 * the shoulders' and the hips' turn, the head's offset, the two gloves and the two ankles as targets, the elbows'
 * lift, the knees' pole, the feet's pitch), so blending two poses is a plain mix.  `solve` turns a pose into joints
 * (two-bone IK for each limb in 3-D, with a pole for the elbow and the knee), `paintFighter` draws them in layers (the
 * far limbs, the body, the near limbs, and the striking limb on top) so the render can interleave two fighters.
 *
 * Seen from one side, an orthodox fighter facing right shows the chest (the lead arm and leg far, the rear ones near);
 * one facing left shows the back (the lead side near).  The depth follows that: world z = frame z × facing.
 */
import { DEFENSES, STRIKES, type DefenseId, type OpeningTell, type StrikeId, type Style, type Target } from './moves';
import type { Act, Look } from './view';
import { SKINS, TAU, clamp01, clampInt, easeIn, easeOut, hairColour, isHex, lerp, lit, mixHex, smooth } from './paint';

// ── the pose ───────────────────────────────────────────────────────────────────────────

/** A pose: every number a target the solver reaches for (see the file's header for the frame). */
export interface Pose {
  /** the root's shift along the forward axis (a step in +, a step back −) */
  x: number;
  /** the pelvis from the root */
  px: number; py: number;
  /** the spine's tilt from upright (+ forward) and the upper back's extra curl (rad) */
  lean: number; bend: number;
  /** the shoulders' and the hips' line: 1 bladed (the lead side to the opponent), 0 squared, −1 the rear side forward */
  turn: number; hip: number;
  /** the head's offset from its place, and its pitch (+ the chin down) */
  hx: number; hy: number; hz: number; tilt: number;
  /** the lead and the rear glove's centre */
  lx: number; ly: number; lz: number;
  rx: number; ry: number; rz: number;
  /** the elbows: 0 tucked down, 1 up and out (a hook), −1 forward and down (an uppercut) */
  le: number; re: number;
  /** the lead and the rear ankle */
  flx: number; fly: number; flz: number;
  frx: number; fry: number; frz: number;
  /** the feet's pitch: 0 flat, + the heel up (on the ball), − the toes up (a teep's sole, a check) */
  tl: number; tr: number;
  /** the knees' pole (rad from forward, + up, − down) */
  kl: number; kr: number;
  /** sitting on the corner's stool (0..1: the stool fades in) */
  stool: number;
}

export const POSE_KEYS = [
  'x', 'px', 'py', 'lean', 'bend', 'turn', 'hip', 'hx', 'hy', 'hz', 'tilt', 'lx', 'ly', 'lz', 'rx', 'ry', 'rz', 'le', 're',
  'flx', 'fly', 'flz', 'frx', 'fry', 'frz', 'tl', 'tr', 'kl', 'kr', 'stool',
] as const satisfies readonly (keyof Pose)[];

type Over = Partial<Pose>;

/** The guard of each style: boxing (bladed, hands high, the rear heel up) and the cage (more upright, wider, hands open). */
export const GUARD: Readonly<Record<Style, Pose>> = {
  boks: {
    x: 0, px: 0, py: 0.47, lean: 0.1, bend: 0.06, turn: 0.55, hip: 0.45,
    hx: 0, hy: 0, hz: 0, tilt: 0.2,
    lx: 0.22, ly: 0.83, lz: -0.05, rx: 0.1, ry: 0.775, rz: 0.06, le: 0, re: 0,
    flx: 0.19, fly: 0.045, flz: -0.09, frx: -0.17, fry: 0.06, frz: 0.09, tl: 0, tr: 0.35, kl: 0.12, kr: 0.12,
    stool: 0,
  },
  mma: {
    x: 0, px: 0, py: 0.46, lean: 0.08, bend: 0.04, turn: 0.42, hip: 0.35,
    hx: 0, hy: 0, hz: 0, tilt: 0.16,
    lx: 0.25, ly: 0.8, lz: -0.06, rx: 0.14, ry: 0.79, rz: 0.07, le: 0, re: 0,
    flx: 0.2, fly: 0.045, flz: -0.1, frx: -0.19, fry: 0.05, frz: 0.1, tl: 0, tr: 0.2, kl: 0.15, kr: 0.15,
    stool: 0,
  },
};

const copy = (p: Pose): Pose => ({ ...p });

/** `a` mixed toward `b` by k. */
export function mixPose(a: Pose, b: Pose, k: number, out: Pose = copy(a)): Pose {
  for (const key of POSE_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

/** `base` with `o`'s numbers mixed in by k (absent keys keep the base). */
function over(base: Pose, o: Over, k = 1): Pose {
  const out = copy(base);
  for (const key of POSE_KEYS) {
    const v = o[key];
    if (v !== undefined) out[key] = base[key] + (v - base[key]) * k;
  }
  return out;
}

/** Offsets added to `base` (scaled by k). */
function add(base: Pose, o: Over, k = 1): Pose {
  const out = copy(base);
  for (const key of POSE_KEYS) {
    const v = o[key];
    if (v !== undefined) out[key] = base[key] + v * k;
  }
  return out;
}

// ── what the pose aims at ─────────────────────────────────────────────────────────────────

export interface PoseCtx {
  style: Style;
  /** the distance between the two fighters' roots (frame units) — where a strike lands */
  D: number;
  /** world seconds (slowed in the slow motion): the guard's bounce, an opening's loop */
  time: number;
  /** a defence's level: what it answers (a body shot drops the elbows) */
  vs?: Target | null;
  /** the rest's breath 0..1 (the stool, the read) */
  breath?: number;
  /** stepping while the spacing changes (the walk to the centre, the circling): the step's phase and how much */
  walk?: { phase: number; amt: number };
}

/** Where a glove's centre (or a shin) meets the opponent, in my frame. */
export function aimAt(target: Target, D: number): [number, number] {
  if (target === 'head') return [D - 0.165, 0.875];
  if (target === 'body') return [D - 0.115, 0.64];
  return [D - 0.2, 0.3];
}

/** The strike's three parts for a 0..1 through the act: which part and how far through it. */
export function strikePhase(id: StrikeId, t: number): { part: 'load' | 'travel' | 'back'; u: number } {
  const s = STRIKES[id];
  const all = s.load + s.travel + s.back;
  const x = clamp01(t) * all;
  if (x < s.load) return { part: 'load', u: x / s.load };
  if (x < s.load + s.travel) return { part: 'travel', u: (x - s.load) / s.travel };
  return { part: 'back', u: (x - s.load - s.travel) / s.back };
}

/** The act's t at a point of the strike's travel (0 its start, 1 the contact): the slow motion's creeping strike. */
export function travelT(id: StrikeId, travel: number): number {
  const s = STRIKES[id];
  return (s.load + s.travel * clamp01(travel)) / (s.load + s.travel + s.back);
}

/** The limb a strike throws, and the pose's fields of its end (a glove or an ankle). */
type Eff = 'l' | 'r' | 'fl' | 'fr';
const EFF_OF: Readonly<Record<StrikeId, Eff>> = {
  jab: 'l', cross: 'r', hookL: 'l', hookR: 'r', upperL: 'l', upperR: 'r', bodyHook: 'l', overhand: 'r',
  lowKick: 'fr', bodyKick: 'fr', headKick: 'fr', teep: 'fl', knee: 'fr', takedown: 'l',
};
export const effectorOf = (id: StrikeId): Eff => EFF_OF[id];

type V3 = [number, number, number];
const effGet = (p: Pose, e: Eff): V3 =>
  e === 'l' ? [p.lx, p.ly, p.lz] : e === 'r' ? [p.rx, p.ry, p.rz] : e === 'fl' ? [p.flx, p.fly, p.flz] : [p.frx, p.fry, p.frz];
function effSet(p: Pose, e: Eff, v: V3): void {
  if (e === 'l') [p.lx, p.ly, p.lz] = v;
  else if (e === 'r') [p.rx, p.ry, p.rz] = v;
  else if (e === 'fl') [p.flx, p.fly, p.flz] = v;
  else [p.frx, p.fry, p.frz] = v;
}
const bez = (a: V3, c: V3, b: V3, u: number): V3 => {
  const k = 1 - u;
  return [k * k * a[0] + 2 * k * u * c[0] + u * u * b[0], k * k * a[1] + 2 * k * u * c[1] + u * u * b[1], k * k * a[2] + 2 * k * u * c[2] + u * u * b[2]];
};

/**
 * A strike's shape: the tell (load) and the moment of contact (hit) over the guard, where its end lands, and the
 * path's bend between them (a control point relative to the straight line: hooks go round, uppercuts rise, the
 * overhand loops over, kicks come from the hip).
 */
interface StrikeShape {
  load: Over;
  hit: Over;
  /** the end at contact (frame units; z the depth); null keeps the hit pose's own numbers (the takedown's arms) */
  end: ((D: number) => V3) | null;
  /** the path's control point from the load's end `a` to the contact `b` */
  ctrl?: (a: V3, b: V3) => V3;
}

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const head = (D: number, z = 0): V3 => { const [x, y] = aimAt('head', D); return [x, y, z]; };
const body = (D: number, z = 0): V3 => { const [x, y] = aimAt('body', D); return [x, y, z]; };

export const STRIKE_SHAPES: Readonly<Record<StrikeId, StrikeShape>> = {
  // 1: the lead hand snaps straight out from the guard, the lead shoulder rolls up over the chin
  jab: {
    load: { lx: 0.19, ly: 0.82, px: 0.012, turn: 0.62 },
    hit: { turn: 0.98, hip: 0.55, lean: 0.17, px: 0.03, x: 0.04, tilt: 0.3, hy: -0.012, rx: 0.12, ry: 0.82, le: 0 },
    end: D => head(D, -0.01),
  },
  // 2: the rear hand drives straight from the chin; the rear hip and shoulder turn through, the rear heel pivots
  cross: {
    load: { turn: 0.72, hip: 0.62, px: -0.025, lean: 0.07, rx: 0.09, ry: 0.81, tr: 0.25 },
    hit: { turn: -0.62, hip: -0.3, px: 0.055, x: 0.035, lean: 0.2, tr: 0.95, frx: -0.14, lx: 0.2, ly: 0.85, lz: -0.09, tilt: 0.28, hx: 0.02, re: 0 },
    end: D => head(D, 0.01),
  },
  // 3: the lead shoulder dips, the elbow comes up level, the glove swings round to the side of the head
  hookL: {
    load: { turn: 0.72, lean: 0.14, bend: 0.1, px: 0.025, py: 0.45, ly: 0.79, lx: 0.2, le: 0.45 },
    hit: { turn: -0.35, hip: 0.0, le: 1, tl: 0.45, px: 0.07, x: 0.1, lean: 0.16, rx: 0.13, ry: 0.84, tilt: 0.28 },
    end: D => [D - 0.14, 0.875, -0.03],
    ctrl: (a, b) => { const m = mid(a, b); return [m[0] - 0.06, m[1] + 0.03, -0.36]; },
  },
  // 4: the rear hook — the weight loads on the rear leg, the glove comes round from the far side of the body
  hookR: {
    load: { turn: 0.78, hip: 0.6, px: -0.02, ry: 0.79, re: 0.4, tr: 0.25 },
    hit: { turn: -0.85, hip: -0.45, re: 1, tr: 0.95, px: 0.07, x: 0.1, lean: 0.16, lx: 0.2, ly: 0.85, lz: -0.09, tilt: 0.28 },
    end: D => [D - 0.14, 0.875, 0.03],
    ctrl: (a, b) => { const m = mid(a, b); return [m[0] - 0.06, m[1] + 0.03, 0.36]; },
  },
  // 5: the knees dip, the lead glove drops to the chest, then rises in a tight arc under the chin
  upperL: {
    load: { py: 0.43, lx: 0.15, ly: 0.66, lz: -0.03, le: -0.85, lean: 0.16, turn: 0.75 },
    hit: { py: 0.48, le: -1, turn: 0.25, hip: 0.25, x: 0.1, px: 0.07, lean: 0.06, rx: 0.13, ry: 0.84, tilt: 0.25 },
    end: D => [D - 0.15, 0.8, -0.01],
    ctrl: (a, b) => [b[0] - 0.02, a[1] - 0.04, a[2] * 0.5],
  },
  // 6: the same from the rear side, the rear hip driving up and through
  upperR: {
    load: { py: 0.43, rx: 0.08, ry: 0.65, rz: 0.03, re: -0.85, lean: 0.16, turn: 0.72 },
    hit: { py: 0.48, re: -1, turn: -0.45, hip: -0.25, tr: 0.85, x: 0.1, px: 0.07, lean: 0.06, lx: 0.2, ly: 0.85, lz: -0.09, tilt: 0.25 },
    end: D => [D - 0.15, 0.8, 0.01],
    ctrl: (a, b) => [b[0] - 0.02, a[1] - 0.04, a[2] * 0.5],
  },
  // the lead hook to the body: the level drops first, the elbow level with the glove, round to the ribs
  bodyHook: {
    load: { py: 0.42, lean: 0.2, lx: 0.2, ly: 0.72, le: 0.3, px: 0.02 },
    hit: { py: 0.41, le: 0.85, turn: -0.25, hip: 0.0, tl: 0.45, x: 0.1, px: 0.05, lean: 0.28, hy: -0.035, rx: 0.14, ry: 0.84, tilt: 0.3 },
    end: D => body(D, -0.02),
    ctrl: (a, b) => { const m = mid(a, b); return [m[0] - 0.05, m[1], -0.33]; },
  },
  // the overhand: the rear shoulder rises and the body drops, the glove loops over the top and down
  overhand: {
    load: { py: 0.44, rx: 0.04, ry: 0.88, rz: 0.1, re: 0.55, lean: 0.08, turn: 0.82 },
    hit: { lean: 0.42, turn: -0.65, hip: -0.3, re: 0.75, tr: 1, x: 0.06, py: 0.43, hy: -0.05, hx: 0.03, lx: 0.14, ly: 0.8, tilt: 0.35 },
    end: D => [D - 0.17, 0.88, 0.02],
    ctrl: (a, b) => { const m = mid(a, b); return [m[0] - 0.04, Math.max(a[1], b[1]) + 0.24, 0.16]; },
  },
  // the low kick: the lead foot steps out, the hips turn over, the rear shin swings round into the lead thigh
  lowKick: {
    load: { flx: 0.25, flz: -0.13, hip: 0.75, lean: -0.02, rx: 0.12, ry: 0.84, lx: 0.25, ly: 0.8 },
    hit: { hip: -0.95, turn: -0.2, lean: -0.2, px: 0.03, tl: 0.45, kr: 0.12, rx: -0.04, ry: 0.62, rz: 0.13, lx: 0.12, ly: 0.86, tilt: 0.25 },
    end: D => [D - 0.15, 0.22, 0.02],
    ctrl: (a, b) => [(a[0] + b[0]) / 2, 0.36, 0.26],
  },
  // the body kick: the same turn of the hips, the leg level, the standing foot pivoting
  bodyKick: {
    load: { flx: 0.25, flz: -0.13, hip: 0.8, lean: -0.04, rx: 0.12, ry: 0.84, lx: 0.25, ly: 0.8 },
    hit: { hip: -1, turn: -0.25, lean: -0.36, px: 0.03, py: 0.48, tl: 0.55, fly: 0.05, kr: 0.2, rx: -0.06, ry: 0.6, rz: 0.14, lx: 0.12, ly: 0.88, tilt: 0.2 },
    end: D => [D - 0.1, 0.6, 0.02],
    ctrl: a => [a[0] + 0.12, 0.56, 0.34],
  },
  // the head kick: the hips over, the body leaning far back, the shin rising to the head
  headKick: {
    load: { flx: 0.25, flz: -0.13, hip: 0.85, lean: -0.06, rx: 0.12, ry: 0.86, lx: 0.25, ly: 0.82 },
    hit: { hip: -1, turn: -0.3, lean: -0.6, px: 0.05, py: 0.5, tl: 0.7, fly: 0.07, kr: 0.3, rx: -0.08, ry: 0.62, rz: 0.15, lx: 0.1, ly: 0.9, tilt: 0.05 },
    end: D => [D - 0.13, 0.85, 0.02],
    ctrl: a => [a[0] + 0.05, 0.72, 0.36],
  },
  // the teep: the lead knee chambers up, the sole pushes straight into the belly
  teep: {
    load: { flx: 0.13, fly: 0.27, flz: -0.05, kl: 0.95, tl: -0.4, lean: -0.05, px: -0.02, lx: 0.2, ly: 0.86, rx: 0.1, ry: 0.84 },
    hit: { lean: -0.26, px: -0.02, kl: 0.25, tl: -1.15, lx: 0.16, ly: 0.88, rx: 0.08, ry: 0.86, tilt: 0.15 },
    end: D => [D - 0.16, 0.57, -0.03],
  },
  // the knee: the gloves reach for the head, the rear knee drives up and forward into the body
  knee: {
    load: { lx: 0.3, ly: 0.86, rx: 0.27, ry: 0.86, lean: 0.06, px: 0.02 },
    hit: { hip: -0.6, px: 0.06, x: 0.09, lean: -0.16, kr: 0.9, tr: -0.2, lx: 0.32, ly: 0.82, rx: 0.3, ry: 0.8, tilt: 0.25 },
    end: D => [D - 0.35, 0.33, 0.04],
  },
  // the shot: the level drops (the tell), then a deep penetration step, the head at the chest, the arms round the legs
  takedown: {
    load: { py: 0.34, lean: 0.38, lx: 0.26, ly: 0.56, rx: 0.19, ry: 0.55, tilt: -0.2, kl: 0.1, kr: 0.1 },
    hit: { x: 0.2, py: 0.26, lean: 0.8, flx: 0.3, kl: -0.2, frx: -0.36, tr: 0.85, hx: 0.05, tilt: -0.3, lx: 0.48, ly: 0.36, lz: -0.1, rx: 0.44, ry: 0.36, rz: 0.1, le: 0.3, re: 0.3 },
    end: null,
  },
};

/** A defence's shape: where the body goes (over the guard), and its timeline (in, hold, out as shares of the act). */
interface DefenseShape {
  pose: (vs: Target | null, k: number) => Over;
  /** a pose added on top through the move (the roll's U under the hook) */
  arc?: (k: number) => Over;
  inn: number; out: number;
}

export const DEFENSE_SHAPES: Readonly<Record<DefenseId, DefenseShape>> = {
  // the head off the line of the straight punch: a small turn and dip to the outside
  slip: {
    pose: () => ({ hx: 0.05, hy: -0.085, hz: -0.15, py: 0.43, turn: 0.8, lean: 0.24, tilt: 0.32, lz: -0.09, lx: 0.24, ly: 0.8 }),
    inn: 0.35, out: 0.72,
  },
  // bend the knees and roll under the hook's arc: the head travels down in a U and comes up on the other side
  roll: {
    pose: () => ({ py: 0.37, lean: 0.36, bend: 0.12, lx: 0.17, ly: 0.8, rx: 0.1, ry: 0.78, tilt: 0.35 }),
    arc: k => ({ hy: -0.12 * Math.sin(Math.PI * k), hz: 0.13 * Math.cos(Math.PI * k), hx: 0.03 * Math.sin(Math.PI * k) }),
    inn: 0.2, out: 0.8,
  },
  // the rear hand meets the jab and turns it aside
  parry: {
    pose: () => ({ rx: 0.27, ry: 0.86, rz: -0.07, re: 0.15, hz: -0.03, turn: 0.62, tilt: 0.25 }),
    inn: 0.35, out: 0.55,
  },
  // the high guard, elbows in, the chin down — over the ribs when the shot comes to the body
  block: {
    pose: vs => vs === 'body' || vs === 'legs'
      ? { lx: 0.13, ly: 0.73, lz: -0.07, rx: 0.08, ry: 0.72, rz: 0.08, le: -0.2, re: -0.2, py: 0.44, lean: 0.2, bend: 0.12, tilt: 0.35, turn: 0.7 }
      : { lx: 0.13, ly: 0.89, lz: -0.08, rx: 0.1, ry: 0.88, rz: 0.08, py: 0.45, lean: 0.14, tilt: 0.4, hy: -0.02, turn: 0.6 },
    inn: 0.3, out: 0.75,
  },
  // a step back out of range, then back in
  step: {
    pose: () => ({ x: -0.17, lean: -0.04, py: 0.46, tr: 0.15 }),
    inn: 0.4, out: 0.72,
  },
  // the lead knee lifts and turns out: the shin takes the low kick
  check: {
    pose: () => ({ flx: 0.17, fly: 0.25, flz: -0.11, kl: 0.95, tl: -0.25, px: -0.03, lean: 0.06, lx: 0.14, ly: 0.88, rx: 0.1, ry: 0.87 }),
    inn: 0.3, out: 0.75,
  },
  // the lead arm traps the kick against the ribs, the rear glove stays at the chin
  catch: {
    pose: () => ({ lx: 0.15, ly: 0.58, lz: -0.02, le: -0.3, rx: 0.12, ry: 0.87, lean: 0.12, turn: 0.72, px: -0.02, tilt: 0.3 }),
    inn: 0.3, out: 0.75,
  },
  // the legs shoot back, the hips drop, the chest and the gloves come down on the opponent's back
  sprawl: {
    pose: () => ({ x: -0.1, px: -0.16, py: 0.21, lean: 1.05, bend: 0.1, flx: -0.34, fly: 0.04, frx: -0.46, fry: 0.04, tl: 0.95, tr: 0.95, kl: -0.7, kr: -0.7, lx: 0.24, ly: 0.4, rx: 0.2, ry: 0.38, rz: 0.04, tilt: -0.45, le: 0.2, re: 0.2 }),
    inn: 0.3, out: 0.8,
  },
};

/** An opening's look on the opponent, and its small loop (k 0..1 of a ~2 s cycle). */
export const OPEN_SHAPES: Readonly<Record<OpeningTell, (k: number) => Over>> = {
  // the lead hand drops after the jab and comes back lazily
  dropHand: k => ({ lx: 0.16 + 0.03 * Math.sin(TAU * k), ly: 0.62 + 0.03 * Math.sin(TAU * k), lz: -0.06, tilt: 0.04, hy: 0.01 }),
  // the head comes in low and forward
  leanIn: k => ({ lean: 0.42 + 0.03 * Math.sin(TAU * k), hx: 0.05, hy: -0.03, px: 0.03, lx: 0.26, ly: 0.74, rx: 0.2, ry: 0.73, tilt: 0.1 }),
  // wide, looping punches: the gloves swing out round the sides
  wide: k => ({
    lz: -0.26 - 0.06 * Math.sin(TAU * k), rz: 0.26 + 0.06 * Math.sin(TAU * k + Math.PI), le: 0.95, re: 0.95,
    lx: 0.1 + 0.13 * Math.cos(TAU * k), ly: 0.76 + 0.06 * Math.sin(TAU * k), rx: 0.02 + 0.1 * Math.cos(TAU * k + Math.PI), ry: 0.78 + 0.05 * Math.sin(TAU * k + Math.PI),
    turn: 0.2 + 0.22 * Math.sin(TAU * k), hip: 0.25, tilt: 0.05,
  }),
  // squared up, the elbows high: the body open
  square: k => ({ turn: 0.02, hip: 0.02, flx: 0.07, frx: -0.06, flz: -0.15, frz: 0.15, tr: 0, le: 0.7, re: 0.7, lx: 0.15, ly: 0.92, rx: 0.14, ry: 0.92, lz: -0.1, rz: 0.1, py: 0.47 + 0.006 * Math.sin(TAU * k) }),
  // the weight sits on the lead leg
  heavyLeg: k => ({ px: 0.07 + 0.01 * Math.sin(TAU * k), py: 0.45, flx: 0.17, tr: 0.65, fry: 0.07, lean: 0.13, kl: 0.05 }),
  // tired: the hands low, the shoulders slumped, breathing hard
  tired: k => ({ lx: 0.16, ly: 0.66, rx: 0.06, ry: 0.64, lean: 0.2, bend: 0.12, tilt: 0.32, turn: 0.42, py: 0.455 + 0.012 * Math.sin(TAU * k * 2), hy: -0.01 }),
};

/** The kneel of a knockdown: the rear knee and one glove on the canvas, the head bowed. */
const KNEEL: Over = {
  x: -0.04, px: -0.08, py: 0.275, lean: 0.62, bend: 0.22, turn: 0.4, hip: 0.4, tilt: 0.45, hy: -0.01,
  frx: -0.28, fry: 0.05, tr: 1.25, kr: -1.3, flx: 0.15, fly: 0.045, tl: 0, kl: 0.75,
  lx: 0.22, ly: 0.075, lz: -0.06, le: 0.1, rx: 0.13, ry: 0.32, rz: 0.06,
};
/** Sitting on the canvas when the fight is over for this fighter: knees up, the gloves on them, the head bowed. */
const SIT: Over = {
  x: -0.06, px: -0.08, py: 0.1, lean: -0.12, bend: 0.12, turn: 0.35, hip: 0.3, tilt: 0.55, hy: -0.01,
  flx: 0.25, fly: 0.045, flz: -0.08, frx: 0.18, fry: 0.045, frz: 0.08, tl: 0, tr: 0, kl: 0.95, kr: 0.95,
  lx: 0.2, ly: 0.33, lz: -0.08, rx: 0.14, ry: 0.31, rz: 0.08, le: 0, re: 0,
};
/** On the corner's stool: upright, the feet forward, the gloves on the thighs. */
const STOOL: Over = {
  px: -0.06, py: 0.35, lean: 0.03, bend: 0.02, turn: 0.3, hip: 0.25, tilt: 0.12,
  flx: 0.21, fly: 0.045, flz: -0.1, frx: 0.13, fry: 0.045, frz: 0.1, tl: 0, tr: 0, kl: 0.55, kr: 0.55,
  lx: 0.17, ly: 0.39, lz: -0.08, rx: 0.11, ry: 0.38, rz: 0.09, le: 0, re: 0, stool: 1,
};
const CHEER: Over = {
  lx: 0.1, ly: 1.17, lz: -0.12, rx: 0.0, ry: 1.15, rz: 0.12, le: 0.35, re: 0.35, lean: -0.04, bend: 0, tilt: -0.3, turn: 0.3, tr: 0.1,
};

/** The referee's stance: upright, the feet apart, the hands loose at the sides. */
export const REF_STAND: Pose = {
  x: 0, px: 0, py: 0.52, lean: 0.04, bend: 0.02, turn: 0.2, hip: 0.15,
  hx: 0, hy: 0, hz: 0, tilt: 0.08,
  lx: 0.06, ly: 0.45, lz: -0.13, rx: -0.01, ry: 0.45, rz: 0.13, le: 0, re: 0,
  flx: 0.09, fly: 0.045, flz: -0.09, frx: -0.08, fry: 0.045, frz: 0.09, tl: 0, tr: 0, kl: 0.1, kr: 0.1,
  stool: 0,
};

/** What the referee does: stands by, counts over a fallen fighter (one arm marking each number), waves it off. */
export type RefAct = 'stand' | 'count' | 'wave';

/** The referee's pose: `beat` 0..1 through the current number of a count, `time` for the wave. */
export function refPose(a: RefAct, beat: number, time: number, walk?: { phase: number; amt: number }): Pose {
  const p = copy(REF_STAND);
  if (a === 'count') {
    // leaning over the fallen fighter, the near arm marks each number with a short downward stroke
    const k = clamp01(beat);
    const stroke = k < 0.25 ? easeOut(k / 0.25) : 1 - smooth((k - 0.25) / 0.75) * 0.15;
    Object.assign(p, { lean: 0.22, bend: 0.06, tilt: 0.25, rx: 0.3, ry: 0.86 - 0.14 * stroke, rz: 0.08, re: -0.2, lx: 0.1, ly: 0.5 });
  } else if (a === 'wave') {
    // both arms crossing over the head: it is over
    const w = Math.sin(time * 5.5);
    Object.assign(p, { lx: 0.12 + 0.13 * w, ly: 0.98, lz: -0.08, rx: 0.12 - 0.13 * w, ry: 0.98, rz: 0.08, le: 0.45, re: 0.45, tilt: -0.05 });
  }
  if (walk && walk.amt > 0) {
    const m = clamp01(walk.amt);
    p.fly += 0.05 * m * Math.max(0, Math.sin(walk.phase));
    p.fry += 0.05 * m * Math.max(0, Math.sin(walk.phase + Math.PI));
    p.flx += 0.06 * m * Math.cos(walk.phase);
    p.frx -= 0.06 * m * Math.cos(walk.phase);
  }
  return p;
}

/** The pose of an act at t (0..1 through it). */
export function poseFor(act: Act, t: number, c: PoseCtx): Pose {
  const base = guardAt(c);
  const k = clamp01(Number.isFinite(t) ? t : 0);
  switch (act.kind) {
    case 'guard': return base;
    case 'tell': {
      const sh = STRIKE_SHAPES[act.strike];
      // the load, eased in and held, with a small gathering (the eye can read it)
      return over(base, sh.load, smooth(Math.min(1, k * 1.6)));
    }
    case 'strike': return strikePose(act.strike, k, c, base, act.power);
    case 'defend': return defensePose(act.defense, k, c, base, act.ok);
    case 'hit': return hitPose(act.target, act.force, k, base);
    case 'open': {
      const loop = (c.time / 2.2) % 1;
      return over(base, OPEN_SHAPES[act.tell](loop), smooth(Math.min(1, k * 4 + 0.25)));
    }
    case 'down': {
      if (k < 0.35) {
        // the legs give: a stagger down toward the knee
        const stag = hitPose('legs', 1, 0.15, base);
        return mixPose(stag, over(stag, KNEEL), easeIn(k / 0.35));
      }
      const p = over(base, KNEEL);
      p.py += 0.006 * Math.sin(c.time * 4.2);
      return p;
    }
    case 'rise': {
      const kneel = over(base, KNEEL);
      if (k < 0.55) {
        const up = over(base, { lx: 0.18, ly: 0.7, rx: 0.1, ry: 0.72, tilt: 0.35, lean: 0.2 });
        return mixPose(kneel, up, smooth(k / 0.55));
      }
      const up = over(base, { lx: 0.18, ly: 0.7, rx: 0.1, ry: 0.72, tilt: 0.35, lean: 0.2 });
      return mixPose(up, base, smooth((k - 0.55) / 0.45));
    }
    case 'out': {
      if (k < 0.5) {
        const kneel = over(base, KNEEL);
        return mixPose(kneel, over(base, SIT), smooth(k / 0.5));
      }
      return over(base, SIT);
    }
    case 'corner': {
      const p = over(base, STOOL);
      const b = clamp01(c.breath ?? 0.5);
      p.py += 0.006 * b;
      p.hy += 0.006 * b;
      p.ly += 0.004 * b;
      p.ry += 0.004 * b;
      p.lean -= 0.03 * b;
      return p;
    }
    case 'cheer': {
      const p = over(base, CHEER, smooth(Math.min(1, k * 4)));
      p.py += 0.012 * Math.abs(Math.sin(c.time * 5));
      p.ly += 0.02 * Math.sin(c.time * 5);
      p.ry += 0.02 * Math.sin(c.time * 5 + 1);
      return p;
    }
    case 'embrace': {
      const D = c.D;
      const wrap: Over = {
        lean: 0.16, bend: 0.06, turn: 0.2, hip: 0.25, tilt: 0.35, hx: 0.05, hz: 0.09, py: 0.48,
        lx: D + 0.04, ly: 0.73, lz: -0.13, rx: D + 0.02, ry: 0.79, rz: 0.13, le: 0.65, re: 0.65, tr: 0.15,
      };
      const p = over(base, wrap, smooth(Math.min(1, k * 3.5)));
      p.ry += 0.02 * Math.max(0, Math.sin(c.time * 7)) * smooth((k - 0.3) * 3);
      return p;
    }
    case 'touch': {
      const D = c.D;
      const reach: Over = { lx: D / 2 + 0.01, ly: 0.81, lz: -0.025, rx: D / 2 - 0.01, ry: 0.79, rz: 0.025, lean: 0.14, tilt: 0.38, turn: 0.3, le: 0, re: 0 };
      const a = k < 0.35 ? smooth(k / 0.35) : k < 0.7 ? 1 : 1 - smooth((k - 0.7) / 0.3);
      return over(base, reach, a);
    }
  }
}

/** The guard with its light bounce (world time), in the fight's style. */
function guardAt(c: PoseCtx): Pose {
  const p = copy(GUARD[c.style]);
  const w = c.time * TAU * 1.55;
  p.py += 0.007 * Math.sin(w);
  p.ly += 0.006 * Math.sin(w + 0.6);
  p.ry += 0.005 * Math.sin(w + 1.1);
  p.lx += 0.006 * Math.sin(w * 0.5);
  p.tr += 0.05 * Math.sin(w);
  const wk = c.walk;
  if (wk && wk.amt > 0) {
    // small steps: one foot lifts and moves while the other carries the weight
    const a = clamp01(wk.amt);
    p.fly += 0.045 * a * Math.max(0, Math.sin(wk.phase));
    p.fry += 0.045 * a * Math.max(0, Math.sin(wk.phase + Math.PI));
    p.flx += 0.035 * a * Math.cos(wk.phase);
    p.frx -= 0.035 * a * Math.cos(wk.phase);
    p.py += 0.008 * a * Math.abs(Math.sin(wk.phase));
  }
  return p;
}

function strikePose(id: StrikeId, t: number, c: PoseCtx, base: Pose, power: number): Pose {
  const sh = STRIKE_SHAPES[id];
  const pw = 0.75 + 0.25 * clamp01(Number.isFinite(power) ? power : 1);
  const loaded = over(base, sh.load);
  const hit = over(base, sh.hit, pw);
  const e = EFF_OF[id];
  // the end is where it lands (from the stance's root); the pose's targets are from the root after the step in
  if (sh.end) { const end = sh.end(c.D); effSet(hit, e, [end[0] - hit.x, end[1], end[2]]); }
  const { part, u } = strikePhase(id, t);
  if (part === 'load') return mixPose(base, loaded, smooth(u));
  if (part === 'back') return mixPose(hit, base, smooth(u));
  // the travel: the body moves on its own ease, the fist or foot on its path (fast out, a hair of settle at contact)
  const k = easeOut(u);
  const p = mixPose(loaded, hit, smooth(Math.min(1, u * 1.25)));
  if (sh.end) {
    const a = effGet(loaded, e), b = effGet(hit, e);
    const ctl = sh.ctrl ? sh.ctrl(a, b) : mid(a, b);
    effSet(p, e, bez(a, ctl, b, k));
  }
  return p;
}

function defensePose(id: DefenseId, t: number, c: PoseCtx, base: Pose, ok: number): Pose {
  const sh = DEFENSE_SHAPES[id];
  // how well it answered: a late or half-hearted defence moves less
  const amt = 0.55 + 0.45 * clamp01(Number.isFinite(ok) ? ok : 1);
  const a = t < sh.inn ? smooth(t / sh.inn) : t < sh.out ? 1 : 1 - smooth((t - sh.out) / (1 - sh.out));
  let p = over(base, sh.pose(c.vs ?? null, a), a * amt);
  if (sh.arc) {
    const k = clamp01(t / Math.max(0.01, sh.out));
    p = add(p, sh.arc(k), amt);
  }
  return p;
}

/** Taking a hit (force 0..1): a quick snap away from the blow, then the guard back. */
function hitPose(target: Target, force: number, t: number, base: Pose): Pose {
  const f = clamp01(Number.isFinite(force) ? force : 0.5);
  const snap = t < 0.18 ? easeOut(t / 0.18) : 1 - smooth((t - 0.18) / 0.82);
  const a = snap * (0.35 + 0.65 * f);
  if (target === 'head') {
    return add(base, { hx: -0.055, hy: 0.012, tilt: -0.6, lean: -0.15, x: -0.05, turn: 0.2, ly: -0.07, lx: -0.05, ry: -0.03, px: -0.02 }, a);
  }
  if (target === 'body') {
    return add(base, { lean: 0.32, bend: 0.26, px: -0.04, py: -0.035, x: -0.03, ly: -0.12, ry: -0.1, lx: -0.06, rx: -0.02, tilt: 0.25, hy: -0.02 }, a);
  }
  return add(base, { py: -0.06, flx: 0.04, kl: -0.35, tl: 0.3, lean: -0.05, x: -0.02, ly: -0.04, tilt: 0.1 }, a);
}

// ── the joints ────────────────────────────────────────────────────────────────────────

/** A body's measures (frame units): the division's build. */
export interface Build {
  /** the shoulders' and the hips' half widths, the chest's and the waist's half depths */
  sw: number; hw: number; chest: number; waist: number;
  /** bone lengths: upper arm, forearm to the glove's centre, thigh, shin to the ankle, the spine's two parts, the neck */
  ua: number; fa: number; th: number; sh: number; sp1: number; sp2: number; neck: number;
  /** the head's radius; limb radii at each end */
  head: number;
  rUa: [number, number]; rFa: [number, number]; rTh: [number, number]; rSh: [number, number]; rNeck: number;
  /** the whole figure's scale (a woman's division a little smaller) */
  scale: number;
}

export const BUILD: Readonly<Record<Look['sex'], Build>> = {
  on: {
    sw: 0.108, hw: 0.07, chest: 0.072, waist: 0.058,
    ua: 0.165, fa: 0.2, th: 0.245, sh: 0.245, sp1: 0.15, sp2: 0.14, neck: 0.05, head: 0.062,
    rUa: [0.037, 0.029], rFa: [0.03, 0.023], rTh: [0.05, 0.036], rSh: [0.036, 0.024], rNeck: 0.035, scale: 1,
  },
  ona: {
    sw: 0.094, hw: 0.077, chest: 0.07, waist: 0.051,
    ua: 0.165, fa: 0.2, th: 0.245, sh: 0.245, sp1: 0.15, sp2: 0.14, neck: 0.052, head: 0.06,
    rUa: [0.031, 0.025], rFa: [0.026, 0.02], rTh: [0.05, 0.034], rSh: [0.034, 0.022], rNeck: 0.029, scale: 0.95,
  },
};

export type P3 = [number, number, number];

/** The solved joints in the frame (before the depth's small drop on screen). */
export interface Joints {
  root: number;
  pel: P3; mid: P3; chest: P3; neck: P3; head: P3;
  /** the spine's up direction at the chest (x, y) and the head's tilt (rad) */
  up: [number, number]; tilt: number;
  sL: P3; sR: P3; eL: P3; eR: P3; gL: P3; gR: P3;
  hL: P3; hR: P3; kL: P3; kR: P3; aL: P3; aR: P3;
  tl: number; tr: number;
  turn: number; hip: number; lean: number;
  stool: number;
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: P3, b: P3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: P3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: P3): P3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Two-bone IK in 3-D: the middle joint for a root, a target, two lengths and a pole (the bend's direction). */
export function ik(root: P3, target: P3, a: number, b: number, pole: P3): { mid: P3; end: P3 } {
  let d = sub(target, root);
  let dist = len(d);
  const maxD = (a + b) * 0.999, minD = Math.abs(a - b) + 1e-3;
  if (dist < 1e-6) { d = [0, -1, 0]; dist = minD; }
  const dir = norm(d);
  const L = Math.max(minD, Math.min(maxD, dist));
  const end = addv(root, mul(dir, L));
  const x = (a * a - b * b + L * L) / (2 * L);
  const r = Math.sqrt(Math.max(0, a * a - x * x));
  let pp = sub(pole, mul(dir, dot(pole, dir)));
  if (len(pp) < 1e-6) pp = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  pp = norm(pp);
  return { mid: addv(addv(root, mul(dir, x)), mul(pp, r)), end };
}

/** A pose's joints for a build. */
export function solve(p: Pose, b: Build): Joints {
  const root = p.x;
  const pel: P3 = [root + p.px, p.py, 0];
  const a1 = p.lean, a2 = p.lean + p.bend;
  const mid: P3 = [pel[0] + Math.sin(a1) * b.sp1, pel[1] + Math.cos(a1) * b.sp1, 0];
  const chest: P3 = [mid[0] + Math.sin(a2) * b.sp2, mid[1] + Math.cos(a2) * b.sp2, 0];
  const a3 = a2 * 0.45;
  const neck: P3 = [chest[0] + Math.sin(a3) * b.neck, chest[1] + Math.cos(a3) * b.neck, 0];
  const head: P3 = [neck[0] + Math.sin(a3) * 0.055 + 0.014 + p.hx, neck[1] + Math.cos(a3) * 0.055 + p.hy, p.hz];
  // the shoulders: their line turned about the spine (1 bladed: the lead shoulder forward)
  const phi = clampN(p.turn, -1.2, 1.2) * Math.PI / 2;
  const fwd: P3 = [Math.cos(a2), -Math.sin(a2), 0];
  const upv: P3 = [Math.sin(a2), Math.cos(a2), 0];
  const sDrop = mul(upv, -0.022);
  const sL = addv(addv(chest, sDrop), [fwd[0] * b.sw * Math.sin(phi), fwd[1] * b.sw * Math.sin(phi), -b.sw * Math.cos(phi)]);
  const sR = addv(addv(chest, sDrop), [-fwd[0] * b.sw * Math.sin(phi), -fwd[1] * b.sw * Math.sin(phi), b.sw * Math.cos(phi)]);
  const psi = clampN(p.hip, -1.2, 1.2) * Math.PI / 2;
  const hL: P3 = [pel[0] + b.hw * Math.sin(psi), pel[1] - 0.02, -b.hw * Math.cos(psi)];
  const hR: P3 = [pel[0] - b.hw * Math.sin(psi), pel[1] - 0.02, b.hw * Math.cos(psi)];
  // the arms: the elbow tucked down and back, or lifted out (a hook), or forward and down (an uppercut)
  const pole = (e: number, side: number): P3 => {
    const down: P3 = [-0.35, -1, side * 0.3];
    const k = Math.min(1, Math.abs(e));
    const to: P3 = e >= 0 ? [-0.15, 0.3, side * 1.1] : [0.7, -1, side * 0.15];
    return [lerp(down[0], to[0], k), lerp(down[1], to[1], k), lerp(down[2], to[2], k)];
  };
  const armL = ik(sL, [root + p.lx, p.ly, p.lz], b.ua, b.fa, pole(p.le, -1));
  const armR = ik(sR, [root + p.rx, p.ry, p.rz], b.ua, b.fa, pole(p.re, 1));
  // the legs: the knee's pole forward (and up, or down for a kneel)
  const kpole = (k: number, side: number): P3 => [Math.cos(k), Math.sin(k), side * 0.12];
  const legL = ik(hL, [root + p.flx, p.fly, p.flz], b.th, b.sh, kpole(p.kl, -1));
  const legR = ik(hR, [root + p.frx, p.fry, p.frz], b.th, b.sh, kpole(p.kr, 1));
  return {
    root, pel, mid, chest, neck, head, up: [upv[0], upv[1]], tilt: p.tilt,
    sL, sR, eL: armL.mid, eR: armR.mid, gL: armL.end, gR: armR.end,
    hL, hR, kL: legL.mid, kR: legR.mid, aL: legL.end, aR: legR.end,
    tl: p.tl, tr: p.tr, turn: p.turn, hip: p.hip, lean: p.lean, stool: p.stool,
  };
}

const clampN = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ── the rig: a fighter that blends between acts ──────────────────────────────────────────────

/** A key for an act: a new key starts a blend from the pose shown. */
export function actKey(a: Act): string {
  switch (a.kind) {
    case 'tell': case 'strike': return `${a.kind}:${a.strike}`;
    case 'defend': return `defend:${a.defense}`;
    case 'hit': return `hit:${a.target}`;
    case 'open': return `open:${a.tell}`;
    default: return a.kind;
  }
}

/** The blend between two acts (world seconds). */
export const BLEND = 0.12;

/** One fighter's moving body: the pose it shows now, blended from the last act into the current one. */
export class Rig {
  pose: Pose;
  joints: Joints;
  private from: Pose;
  private key = '';
  private blendT = 1;
  private lastAct: Act = { kind: 'guard' };
  constructor(public build: Build, style: Style = 'boks') {
    this.pose = copy(GUARD[style]);
    this.from = copy(this.pose);
    this.joints = solve(this.pose, build);
  }
  /** the act being shown (the render reads which limb strikes) */
  get act(): Act { return this.lastAct; }
  /** Move to (act, t) over `dt` world seconds. */
  update(act: Act, t: number, dt: number, c: PoseCtx): Joints {
    const key = actKey(act);
    if (key !== this.key) {
      this.from = copy(this.pose);
      this.key = key;
      this.blendT = 0;
    }
    this.lastAct = act;
    this.blendT += Math.max(0, Number.isFinite(dt) ? dt : 0);
    const target = poseFor(act, t, c);
    const k = smooth(this.blendT / BLEND);
    this.pose = k >= 1 ? target : mixPose(this.from, target, k);
    this.joints = solve(this.pose, this.build);
    return this.joints;
  }
  /** Jump to (act, t) without a blend (the gallery, a fresh view). */
  set(act: Act, t: number, c: PoseCtx): Joints {
    this.key = actKey(act);
    this.lastAct = act;
    this.blendT = BLEND;
    this.pose = poseFor(act, t, c);
    this.from = copy(this.pose);
    this.joints = solve(this.pose, this.build);
    return this.joints;
  }
}

// ── drawing ───────────────────────────────────────────────────────────────────────────

/** How the fighter is drawn: the look, the fight's style, which way it faces, and its place on the screen. */
export interface Paint {
  look: Look;
  style: Style;
  /** +1 facing right (the player), −1 facing left (the opponent) */
  facing: number;
  /** screen x of the root's zero and of the floor (px), px per frame unit */
  x: number; y: number; s: number;
  /** the hall's light on the fighter 0..1 (the slow motion dims the world) */
  light?: number;
  /** a ghost (the slow motion's afterimage): one flat colour at this alpha */
  ghost?: { colour: string; alpha: number } | null;
  /** the referee: a white shirt and a bow tie, dark trousers and shoes, bare hands (the look's `kit` = the trousers) */
  referee?: boolean;
}

/** The screen point of a frame point (with the depth's small drop: nearer is a little lower). */
export function toScreen(j: P3, pt: Paint, b: Build): [number, number] {
  const s = pt.s * b.scale;
  const zw = j[2] * pt.facing;
  return [pt.x + pt.facing * j[0] * s, pt.y - (j[1] - zw * DEPTH_DROP) * s];
}
/** How much a point's depth lowers it on screen (frame units per unit of depth: the camera looks a little down). */
export const DEPTH_DROP = 0.2;

/** The layers of a fighter, so two can be interleaved (far limbs of both, the bodies, the near limbs, the strikes). */
export type Layer = 'far' | 'body' | 'near' | 'top';

/** The parts of a fighter and the layer each falls in now. */
interface Parts { armL: Layer; armR: Layer; legL: Layer; legR: Layer }

/** Which layer each limb falls in: by its depth, and the striking limb on top once it is out in front. */
export function partsOf(j: Joints, facing: number, act: Act): Parts {
  // frame z: the lead side −, the rear side +; world z = frame z × facing (+ near)
  const nearRear = facing > 0;
  const parts: Parts = {
    armL: nearRear ? 'far' : 'near', armR: nearRear ? 'near' : 'far',
    legL: nearRear ? 'far' : 'near', legR: nearRear ? 'near' : 'far',
  };
  if (act.kind === 'strike' || act.kind === 'tell') {
    const e = EFF_OF[act.strike];
    if (e === 'l' && j.gL[0] > j.head[0] + 0.13) parts.armL = 'top';
    if (e === 'r' && j.gR[0] > j.head[0] + 0.13) parts.armR = 'top';
    if (e === 'fl' && j.aL[0] > j.pel[0] + 0.15) parts.legL = 'top';
    if (e === 'fr' && j.aR[0] > j.pel[0] + 0.12) parts.legR = 'top';
    if (act.strike === 'takedown') { parts.armL = 'top'; parts.armR = 'top'; }
  }
  if (act.kind === 'embrace') {
    // the arms round the other's back: the far arm behind both bodies, the near one over the other's shoulder
    parts.armL = nearRear ? 'far' : 'top';
    parts.armR = nearRear ? 'top' : 'far';
  }
  if (act.kind === 'touch') { parts.armL = 'top'; parts.armR = 'top'; }
  return parts;
}

interface Tone { base: string; shade: string; hi: string }

/** The colours a fighter is drawn in (cached per look). */
interface Palette {
  skin: Tone; skinFar: Tone; lip: string;
  kit: Tone; kitFar: Tone; trim: string;
  glove: Tone; gloveFar: Tone;
  hair: string; boot: Tone; bootFar: Tone;
  shirt: Tone; shirtFar: Tone;
}

const palCache = new Map<string, Palette>();
function tone(base: string, k = 0): Tone {
  const b = k ? lit(base, k) : base;
  return { base: b, shade: lit(b, -0.32), hi: lit(b, 0.35) };
}
export function paletteOf(look: Look): Palette {
  const key = `${look.skin}|${look.kit}|${look.gloves}|${look.hair}`;
  const hit = palCache.get(key);
  if (hit) return hit;
  const sk = SKINS[clampInt(look.skin, 0, 4)];
  const kit = isHex(look.kit) ? look.kit : '#3c5f9e';
  const glv = isHex(look.gloves) ? look.gloves : '#b8423a';
  const skin: Tone = { base: sk.base, shade: sk.shade, hi: sk.hi };
  const far = (t: Tone): Tone => ({ base: lit(t.base, -0.2), shade: lit(t.shade, -0.2), hi: lit(t.hi, -0.25) });
  const bootBase = mixHex(kit, '#121014', 0.55);
  const p: Palette = {
    skin, skinFar: far(skin), lip: sk.lip,
    kit: tone(kit), kitFar: far(tone(kit)), trim: mixHex(kit, '#fff6e6', 0.78),
    glove: tone(glv), gloveFar: far(tone(glv)),
    hair: hairColour(look.skin, look.hair),
    boot: tone(bootBase), bootFar: far(tone(bootBase)),
    shirt: tone('#ecebe6'), shirtFar: far(tone('#ecebe6')),
  };
  palCache.set(key, p);
  return p;
}

/** A capsule (two circles and their tangents) between a and b: the limbs. */
function capsule(ctx: CanvasRenderingContext2D, ax: number, ay: number, ra: number, bx: number, by: number, rb: number): void {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  ctx.beginPath();
  if (d < Math.abs(ra - rb) + 1e-6) {
    ctx.arc(ax, ay, Math.max(ra, rb), 0, TAU);
    return;
  }
  const ang = Math.atan2(dy, dx);
  const th = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)));
  ctx.arc(ax, ay, ra, ang + th, ang + TAU - th);
  ctx.arc(bx, by, rb, ang - th, ang + th);
  ctx.closePath();
}

/** The light's direction in the frame (forward and up: the ring's centre light, over the fighters' fronts). */
const LX = 0.32, LY = 0.95;

/**
 * A shaded limb in the frame (the context already in frame units): the shade, the lit side toward the light inside it,
 * and a thin highlight along the lit edge.
 */
function limb(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], ra: number, rb: number, t: Tone, flat: string | null): void {
  capsule(ctx, a[0], a[1], ra, b[0], b[1], rb);
  if (flat) { ctx.fillStyle = flat; ctx.fill(); return; }
  ctx.fillStyle = t.shade;
  ctx.fill();
  // the side facing the light: the perpendicular nearer the light's direction
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
  const o = 0.3;
  capsule(ctx, a[0] + nx * ra * o, a[1] + ny * ra * o, ra * 0.72, b[0] + nx * rb * o, b[1] + ny * rb * o, rb * 0.72);
  ctx.fillStyle = t.base;
  ctx.fill();
  ctx.strokeStyle = t.hi;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.min(ra, rb) * 0.32;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * ra * 0.72, a[1] + ny * ra * 0.72);
  ctx.lineTo(b[0] + nx * rb * 0.72, b[1] + ny * rb * 0.72);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A tube of cloth from a (rounded, under the body) to b (a straight hem with a trim line). */
function cloth(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], ra: number, rb: number, t: Tone, flat: string | null, trim: string): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const ang = Math.atan2(ny, nx);
  const path = (k: number, o: number): void => {
    ctx.beginPath();
    ctx.arc(a[0] + nx * o * ra, a[1] + ny * o * ra, ra * k, ang, ang + Math.PI);
    ctx.lineTo(b[0] - nx * rb * k + nx * o * rb, b[1] - ny * rb * k + ny * o * rb);
    ctx.lineTo(b[0] + nx * rb * k + nx * o * rb, b[1] + ny * rb * k + ny * o * rb);
    ctx.closePath();
  };
  path(1, 0);
  if (flat) { ctx.fillStyle = flat; ctx.fill(); return; }
  ctx.fillStyle = t.shade;
  ctx.fill();
  const lightSide = nx * LX + ny * LY >= 0 ? 1 : -1;
  path(0.74, 0.26 * lightSide);
  ctx.fillStyle = t.base;
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.009;
  ctx.beginPath();
  ctx.moveTo(b[0] + nx * rb * 0.96 - (dx / d) * 0.008, b[1] + ny * rb * 0.96 - (dy / d) * 0.008);
  ctx.lineTo(b[0] - nx * rb * 0.96 - (dx / d) * 0.008, b[1] - ny * rb * 0.96 - (dy / d) * 0.008);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A frame point to the drawing's local 2-D (x, y up), with the depth's drop. */
const P = (j: P3, facing: number): [number, number] => [j[0], j[1] - j[2] * facing * DEPTH_DROP];

/**
 * Draw one layer of a fighter.  The context is set to the fighter's frame inside (x forward, y up, units of height),
 * so line widths and shapes scale with it.
 */
export function paintFighter(ctx: CanvasRenderingContext2D, j: Joints, b: Build, pt: Paint, act: Act, layerWanted: Layer): void {
  const pal = paletteOf(pt.look);
  const parts = partsOf(j, pt.facing, act);
  const flat = pt.ghost ? pt.ghost.colour : null;
  ctx.save();
  ctx.translate(pt.x, pt.y);
  const s = pt.s * b.scale;
  ctx.scale(pt.facing * s, -s);
  if (pt.ghost) ctx.globalAlpha = pt.ghost.alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const f = pt.facing;
  const near = (side: 'L' | 'R') => (side === 'R') === (f > 0);
  // the stool sits under the body
  if (layerWanted === 'far' && j.stool > 0.01 && !pt.ghost) stoolAt(ctx, j, f, j.stool);
  for (const side of ['L', 'R'] as const) {
    if (parts[side === 'L' ? 'legL' : 'legR'] === layerWanted) legOf(ctx, j, b, pt, pal, side, near(side), flat);
  }
  if (layerWanted === 'body') torsoOf(ctx, j, b, pt, pal, flat);
  for (const side of ['L', 'R'] as const) {
    if (parts[side === 'L' ? 'armL' : 'armR'] === layerWanted) armOf(ctx, j, b, pt, pal, side, near(side), flat);
  }
  ctx.restore();
}

/** A fighter's shadow on the floor from the light overhead (drawn before everything of both fighters). */
export function paintShadow(ctx: CanvasRenderingContext2D, j: Joints, b: Build, pt: Paint): void {
  const s = pt.s * b.scale;
  const xs = [j.aL[0], j.aR[0], j.pel[0], j.head[0]];
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const cx = pt.x + pt.facing * ((lo + hi) / 2) * s;
  const rx = Math.max(0.16, (hi - lo) / 2 + 0.08) * s;
  const lift = Math.max(0, Math.min(j.aL[1], j.aR[1]) - 0.05);
  const a = 0.5 * (1 - Math.min(0.6, lift * 1.5));
  ctx.save();
  ctx.fillStyle = `rgba(8,4,6,${a})`;
  ctx.beginPath();
  ctx.ellipse(cx, pt.y + 0.012 * s, rx, 0.045 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function stoolAt(ctx: CanvasRenderingContext2D, j: Joints, f: number, k: number): void {
  const x = j.pel[0] - 0.02, top = 0.3;
  ctx.globalAlpha *= clamp01(k);
  ctx.fillStyle = '#3b2a22';
  ctx.fillRect(x - 0.12, top - 0.035, 0.24, 0.035);
  ctx.fillStyle = '#5a4234';
  ctx.fillRect(x - 0.12, top - 0.012, 0.24, 0.012);
  ctx.strokeStyle = '#2a1d18';
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.moveTo(x - 0.1, top - 0.035); ctx.lineTo(x - 0.13, 0.0);
  ctx.moveTo(x + 0.1, top - 0.035); ctx.lineTo(x + 0.13, 0.0);
  ctx.moveTo(x - 0.02, top - 0.035); ctx.lineTo(x - 0.03, 0.0 - 0.02 * f * DEPTH_DROP);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function legOf(ctx: CanvasRenderingContext2D, j: Joints, b: Build, pt: Paint, pal: Palette, side: 'L' | 'R', isNear: boolean, flat: string | null): void {
  const f = pt.facing;
  const hp = P(side === 'L' ? j.hL : j.hR, f), kn = P(side === 'L' ? j.kL : j.kR, f), an = P(side === 'L' ? j.aL : j.aR, f);
  const skin = isNear ? pal.skin : pal.skinFar;
  const kit = isNear ? pal.kit : pal.kitFar;
  const boot = isNear ? pal.boot : pal.bootFar;
  const pitch = side === 'L' ? j.tl : j.tr;
  if (pt.referee) {
    // the referee's trousers to the shoe, the shoe
    cloth(ctx, hp, kn, b.rTh[0] * 1.08, b.rTh[1] * 1.12, kit, flat, pal.kit.shade);
    cloth(ctx, [kn[0] + (kn[0] - an[0]) * 0.12, kn[1] + (kn[1] - an[1]) * 0.12], [an[0], an[1] - 0.012], b.rTh[1] * 1.1, b.rSh[1] * 1.35, kit, flat, pal.kit.shade);
    const ca = Math.cos(-pitch * 0.95), sa = Math.sin(-pitch * 0.95);
    ctx.fillStyle = flat ?? '#141216';
    ctx.beginPath();
    ctx.ellipse(an[0] + 0.035 * ca, an[1] - 0.03 + 0.035 * sa, 0.07, 0.026, -pitch * 0.95, 0, TAU);
    ctx.fill();
    return;
  }
  // thigh (the shorts' leg over its top) and shin
  limb(ctx, hp, kn, b.rTh[0], b.rTh[1] * 1.08, skin, flat);
  // the shorts' leg: loose cloth to a straight hem (boxing trunks to mid-thigh, the cage's shorts nearly to the knee)
  const shortLen = pt.style === 'mma' ? 0.74 : 0.52;
  const sx = hp[0] + (kn[0] - hp[0]) * shortLen, sy = hp[1] + (kn[1] - hp[1]) * shortLen;
  const rHem = lerp(b.rTh[0], b.rTh[1], shortLen) * (pt.style === 'mma' ? 1.32 : 1.22);
  cloth(ctx, hp, [sx, sy], b.rTh[0] * 1.2, rHem, kit, flat, pal.trim);
  limb(ctx, kn, an, b.rSh[0], b.rSh[1], skin, flat);
  // the foot: from the heel to the toes, pitched (+ heel up)
  const ang = -pitch * 0.95;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const R = (x: number, y: number): [number, number] => [an[0] + x * ca - y * sa, an[1] + x * sa + y * ca];
  const heel = R(-0.038, -0.03), sole0 = R(-0.03, -0.045), toe = R(0.118, -0.04), toeTop = R(0.104, -0.02), instep = R(0.035, 0.004);
  const boxing = pt.style === 'boks';
  const ft = boxing ? boot : skin;
  ctx.beginPath();
  ctx.moveTo(...heel);
  ctx.quadraticCurveTo(sole0[0] - 0.006, sole0[1], sole0[0], sole0[1]);
  ctx.lineTo(toe[0], toe[1]);
  ctx.quadraticCurveTo(toe[0] + 0.012, toe[1] + 0.014, toeTop[0], toeTop[1]);
  ctx.quadraticCurveTo(instep[0], instep[1], an[0] + 0.012 * ca, an[1] + 0.02);
  ctx.closePath();
  ctx.fillStyle = flat ?? ft.base;
  ctx.fill();
  if (boxing) {
    // the boot's shaft up the shin, laced in the trim's colour
    const up = 0.085;
    const dx = kn[0] - an[0], dy = kn[1] - an[1], d = Math.hypot(dx, dy) || 1;
    const top: [number, number] = [an[0] + (dx / d) * up, an[1] + (dy / d) * up];
    limb(ctx, an, top, b.rSh[1] * 1.28, b.rSh[1] * 1.22, ft, flat);
    if (!flat) {
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 0.009;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(top[0] - (dy / d) * b.rSh[1] * 1.2, top[1] + (dx / d) * b.rSh[1] * 1.2);
      ctx.lineTo(top[0] + (dy / d) * b.rSh[1] * 1.2, top[1] - (dx / d) * b.rSh[1] * 1.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else if (!flat) {
    ctx.fillStyle = skin.shade;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(...sole0);
    ctx.lineTo(toe[0], toe[1]);
    ctx.lineTo(...R(0.1, -0.03));
    ctx.lineTo(...R(-0.02, -0.035));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function armOf(ctx: CanvasRenderingContext2D, j: Joints, b: Build, pt: Paint, pal: Palette, side: 'L' | 'R', isNear: boolean, flat: string | null): void {
  const f = pt.facing;
  const s3 = side === 'L' ? j.sL : j.sR, e3 = side === 'L' ? j.eL : j.eR, g3 = side === 'L' ? j.gL : j.gR;
  const sh = P(s3, f), el = P(e3, f), gl = P(g3, f);
  const skin = isNear ? pal.skin : pal.skinFar;
  const glv = isNear ? pal.glove : pal.gloveFar;
  // the glove grows a little as it comes toward the camera
  const zk = 1 + clampN(g3[2] * f, -0.3, 0.3) * 0.55;
  if (pt.referee) {
    // a short white sleeve, the forearm, a bare hand
    const shirt = isNear ? pal.shirt : pal.shirtFar;
    limb(ctx, sh, el, b.rUa[0] * 1.08, b.rUa[1], skin, flat);
    limb(ctx, sh, [sh[0] + (el[0] - sh[0]) * 0.62, sh[1] + (el[1] - sh[1]) * 0.62], b.rUa[0] * 1.3, b.rUa[0] * 1.15, shirt, flat);
    limb(ctx, el, gl, b.rFa[0], b.rFa[1], skin, flat);
    ctx.beginPath();
    ctx.arc(gl[0], gl[1], 0.03, 0, TAU);
    ctx.fillStyle = flat ?? skin.base;
    ctx.fill();
    return;
  }
  // the shoulder's cap (the deltoid) and the upper arm
  limb(ctx, sh, [sh[0] + (el[0] - sh[0]) * 0.3, sh[1] + (el[1] - sh[1]) * 0.3], b.rUa[0] * 1.32, b.rUa[0] * 1.08, skin, flat);
  limb(ctx, sh, el, b.rUa[0] * 1.05, b.rUa[1], skin, flat);
  // the forearm to the wrist
  const dx = gl[0] - el[0], dy = gl[1] - el[1], d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const boxing = pt.style === 'boks';
  const wristBack = boxing ? 0.07 : 0.045;
  const wr: [number, number] = [gl[0] - ux * wristBack * zk, gl[1] - uy * wristBack * zk];
  limb(ctx, el, wr, b.rFa[0], b.rFa[1], skin, flat);
  const ang = Math.atan2(uy, ux);
  if (boxing) boxingGlove(ctx, gl, wr, ang, zk, glv, pal.trim, flat);
  else mmaGlove(ctx, gl, wr, ang, zk, glv, skin, flat);
}

function boxingGlove(ctx: CanvasRenderingContext2D, g: [number, number], w: [number, number], ang: number, k: number, t: Tone, trim: string, flat: string | null): void {
  // the cuff
  limb(ctx, [w[0] - Math.cos(ang) * 0.03 * k, w[1] - Math.sin(ang) * 0.03 * k], w, 0.037 * k, 0.04 * k, t, flat);
  ctx.save();
  ctx.translate(g[0], g[1]);
  ctx.rotate(ang);
  ctx.scale(k, k);
  // the glove's body: knuckles forward, the thumb on top
  ctx.beginPath();
  ctx.ellipse(-0.006, 0, 0.066, 0.054, 0, 0, TAU);
  ctx.fillStyle = flat ?? t.shade;
  ctx.fill();
  if (!flat) {
    const lyS = ang > Math.PI / 2 || ang < -Math.PI / 2 ? -1 : 1;
    ctx.beginPath();
    ctx.ellipse(-0.004, 0.012 * lyS, 0.054, 0.038, 0, 0, TAU);
    ctx.fillStyle = t.base;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-0.02, 0.03 * lyS, 0.03, 0.012, 0, 0, TAU);
    ctx.fillStyle = t.hi;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    // the thumb's seam
    ctx.strokeStyle = t.shade;
    ctx.lineWidth = 0.007;
    ctx.beginPath();
    ctx.ellipse(-0.026, 0.018 * lyS, 0.026, 0.02, 0, Math.PI * 0.1, Math.PI * 1.1);
    ctx.stroke();
    // the cuff's band
    ctx.fillStyle = trim;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-0.082, -0.036, 0.016, 0.072);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function mmaGlove(ctx: CanvasRenderingContext2D, g: [number, number], w: [number, number], ang: number, k: number, t: Tone, skin: Tone, flat: string | null): void {
  ctx.save();
  ctx.translate(g[0], g[1]);
  ctx.rotate(ang);
  ctx.scale(k, k);
  // the fist (fingers curled), a pad over the knuckles, the wrap at the wrist
  ctx.beginPath();
  ctx.ellipse(-0.004, 0, 0.044, 0.036, 0, 0, TAU);
  ctx.fillStyle = flat ?? skin.base;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.008, 0.004, 0.038, 0.034, 0, -Math.PI * 0.55, Math.PI * 0.55);
  ctx.closePath();
  ctx.fillStyle = flat ?? t.base;
  ctx.fill();
  if (!flat) {
    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.moveTo(-0.01, -0.02); ctx.lineTo(0.0, -0.032);
    ctx.moveTo(-0.022, -0.016); ctx.lineTo(-0.014, -0.031);
    ctx.stroke();
  }
  ctx.fillStyle = flat ?? t.shade;
  ctx.fillRect(-0.06, -0.03, 0.024, 0.06);
  ctx.restore();
  void w;
}

function torsoOf(ctx: CanvasRenderingContext2D, j: Joints, b: Build, pt: Paint, pal: Palette, flat: string | null): void {
  const f = pt.facing;
  const sex = pt.look.sex;
  const phi = clampN(j.turn, -1.2, 1.2) * Math.PI / 2;
  const psi = clampN(j.hip, -1.2, 1.2) * Math.PI / 2;
  // the visible half-widths: the depth in profile, the shoulders' width when the chest turns to the camera
  const wC = Math.hypot(b.chest * Math.cos(phi), b.sw * 0.92 * Math.sin(phi));
  const wW = Math.hypot(b.waist * Math.cos((phi + psi) / 2), (b.hw * 0.95) * Math.sin((phi + psi) / 2));
  const wH = Math.hypot((b.waist + 0.012) * Math.cos(psi), (b.hw + 0.02) * Math.sin(psi));
  const pel = P(j.pel, f), mid = P(j.mid, f), ch = P(j.chest, f), nk = P(j.neck, f);
  const [ux, uy] = j.up;
  const fx = uy, fy = -ux; // forward, perpendicular to the spine
  const pl = [pel[0], pel[1] - 0.02] as [number, number];
  const chestLow: [number, number] = [(mid[0] + ch[0]) / 2, (mid[1] + ch[1]) / 2];
  // a gentle front line: the chest a touch fuller in profile (a sports top for a woman)
  const prof = Math.cos(phi) ** 2;
  const front = sex === 'ona' ? 0.012 * prof : 0.008 * prof;
  const pts = {
    hipB: [pl[0] - wH, pl[1] - 0.02], hipF: [pl[0] + wH, pl[1] - 0.02],
    waistB: [mid[0] - fx * wW, mid[1] - fy * wW], waistF: [mid[0] + fx * wW, mid[1] + fy * wW],
    chestB: [chestLow[0] - fx * wC * 1.0, chestLow[1] - fy * wC], chestF: [chestLow[0] + fx * (wC + front), chestLow[1] + fy * (wC + front)],
    shB: [ch[0] - fx * wC * 0.98 - ux * 0.005, ch[1] - fy * wC * 0.98 - uy * 0.005], shF: [ch[0] + fx * wC * 0.9, ch[1] + fy * wC * 0.9],
  } as Record<string, [number, number]>;
  const ref = !!pt.referee;
  const skin = ref ? pal.shirt : pal.skin;
  // the neck first (under the head and the shoulders' line)
  limb(ctx, ch, [nk[0] + 0.004, nk[1] + 0.012], b.rNeck * 1.1, b.rNeck, pal.skin, flat);
  // the trunk
  ctx.beginPath();
  ctx.moveTo(...pts.hipB);
  ctx.quadraticCurveTo(pts.waistB[0] - fx * 0.006, pts.waistB[1] - fy * 0.006, pts.chestB[0], pts.chestB[1]);
  ctx.quadraticCurveTo(pts.shB[0] - fx * 0.01, pts.shB[1] + 0.01, (pts.shB[0] + nk[0]) / 2, (pts.shB[1] + nk[1]) / 2 + 0.008);
  ctx.lineTo((pts.shF[0] + nk[0]) / 2, (pts.shF[1] + nk[1]) / 2 + 0.004);
  ctx.quadraticCurveTo(pts.shF[0] + fx * 0.012, pts.shF[1], pts.chestF[0], pts.chestF[1]);
  ctx.quadraticCurveTo(pts.waistF[0] + fx * 0.004, pts.waistF[1] + fy * 0.004, pts.hipF[0], pts.hipF[1]);
  ctx.closePath();
  ctx.fillStyle = flat ?? skin.shade;
  ctx.fill();
  if (!flat) {
    // lit from above and the front: a lighter body inside the shade
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(pl[0] - wH, pl[1], ch[0] + wC * 0.8, ch[1] + 0.06);
    g.addColorStop(0, skin.shade);
    g.addColorStop(0.55, skin.base);
    g.addColorStop(1, skin.hi);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    // muscle's quiet lines: the chest's line and the middle of the belly (front), or the spine's groove (back)
    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = 0.008;
    ctx.globalAlpha = ref ? 0.25 : 0.45;
    const showsFront = f > 0;
    const off = Math.sin(phi) * 0.25;
    ctx.beginPath();
    if (showsFront) {
      const cx = chestLow[0] + fx * wC * off, cy = chestLow[1] + fy * wC * off;
      ctx.moveTo(cx - ux * 0.0, cy - uy * 0.0);
      ctx.lineTo(mid[0] + fx * wW * off * 0.8 - ux * 0.04, mid[1] + fy * wW * off * 0.8 - uy * 0.04);
      if (sex === 'on') {
        ctx.moveTo(pts.shB[0] * 0.5 + pts.shF[0] * 0.5 - ux * 0.06 - fx * wC * 0.6, pts.shB[1] * 0.5 + pts.shF[1] * 0.5 - uy * 0.06 - fy * wC * 0.6);
        ctx.quadraticCurveTo(cx - ux * 0.03, cy - uy * 0.03, cx + fx * wC * 0.6 - ux * 0.0, cy + fy * wC * 0.6);
      }
    } else {
      ctx.moveTo(ch[0] - fx * wC * off * 0.3, ch[1] - fy * wC * off * 0.3);
      ctx.lineTo(mid[0] - fx * wW * off * 0.3 - ux * 0.04, mid[1] - fy * wW * off * 0.3 - uy * 0.04);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  if (ref && !flat) {
    // the bow tie and the shirt's line of buttons
    ctx.fillStyle = '#121014';
    const bx = ch[0] + fx * wC * 0.55 + ux * 0.01, by = ch[1] + fy * wC * 0.55 + uy * 0.01;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 0.022 * ux + 0.014 * fx, by - 0.022 * uy + 0.014 * fy);
    ctx.lineTo(bx + 0.022 * ux + 0.014 * fx, by + 0.022 * uy + 0.014 * fy);
    ctx.closePath();
    ctx.fill();
  }
  // the sports top (a woman's division): from under the arms to the bottom of the ribs
  if (sex === 'ona' && !ref) {
    const k = pal.kit;
    const yTop = 0.06, yBot = 0.115;
    const a1: [number, number] = [ch[0] - ux * yTop, ch[1] - uy * yTop];
    const a2: [number, number] = [ch[0] - ux * yBot - ux * 0.03, ch[1] - uy * yBot - uy * 0.03];
    ctx.beginPath();
    ctx.moveTo(a1[0] - fx * wC * 1.04, a1[1] - fy * wC * 1.04);
    ctx.lineTo((pts.shB[0] + nk[0]) / 2 + 0.006, (pts.shB[1] + nk[1]) / 2);
    ctx.lineTo(ch[0] + fx * wC * 0.35, ch[1] + fy * wC * 0.35 - 0.012);
    ctx.quadraticCurveTo(pts.chestF[0] + fx * 0.012, pts.chestF[1] + fy * 0.012 + 0.01, a2[0] + fx * (wC + front) * 1.02, a2[1] + fy * (wC + front) * 1.02);
    ctx.lineTo(a2[0] - fx * wC * 1.02, a2[1] - fy * wC * 1.02);
    ctx.closePath();
    ctx.fillStyle = flat ?? k.base;
    ctx.fill();
    if (!flat) {
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 0.011;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(a2[0] + fx * (wC + front) * 1.0, a2[1] + fy * (wC + front) * 1.0);
      ctx.lineTo(a2[0] - fx * wC * 1.0, a2[1] - fy * wC * 1.0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // the trunks / shorts over the pelvis, with the waistband
  const wb1: [number, number] = [mid[0] - ux * 0.045, mid[1] - uy * 0.045];
  ctx.beginPath();
  ctx.moveTo(wb1[0] - fx * (wW + 0.006), wb1[1] - fy * (wW + 0.006));
  ctx.lineTo(wb1[0] + fx * (wW + 0.006), wb1[1] + fy * (wW + 0.006));
  ctx.lineTo(pts.hipF[0] + 0.01, pts.hipF[1] - 0.04);
  ctx.lineTo(pl[0], pl[1] - 0.075);
  ctx.lineTo(pts.hipB[0] - 0.01, pts.hipB[1] - 0.04);
  ctx.closePath();
  ctx.fillStyle = flat ?? pal.kit.base;
  ctx.fill();
  if (!flat) {
    ctx.fillStyle = pal.kit.shade;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(pts.hipB[0] - 0.01, pts.hipB[1] - 0.04);
    ctx.lineTo(pl[0], pl[1] - 0.075);
    ctx.lineTo(pts.hipF[0] + 0.01, pts.hipF[1] - 0.04);
    ctx.lineTo(pts.hipF[0], pts.hipF[1] + 0.0);
    ctx.lineTo(pts.hipB[0], pts.hipB[1] + 0.0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ref ? '#121014' : pal.trim;
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(wb1[0] - fx * (wW + 0.005) - ux * 0.008, wb1[1] - fy * (wW + 0.005) - uy * 0.008);
    ctx.lineTo(wb1[0] + fx * (wW + 0.005) - ux * 0.008, wb1[1] + fy * (wW + 0.005) - uy * 0.008);
    ctx.stroke();
  }
  headOf(ctx, j, b, pt, pal, flat);
}

function headOf(ctx: CanvasRenderingContext2D, j: Joints, b: Build, pt: Paint, pal: Palette, flat: string | null): void {
  const f = pt.facing;
  const [hx, hy] = P(j.head, f);
  const R = b.head * (1 + clampN(j.head[2] * f, -0.2, 0.2) * 0.4);
  const skin = pal.skin;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-j.tilt * 0.9);
  // hair behind the head (a tie, braids)
  const hair = pt.look.hair;
  if (!flat && (hair === 1 || hair === 2)) {
    ctx.strokeStyle = pal.hair;
    ctx.lineCap = 'round';
    if (hair === 1) {
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.ellipse(-R * 1.02, R * 0.28, R * 0.3, R * 0.27, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = R * 0.32;
      ctx.beginPath();
      ctx.moveTo(-R * 1.05, R * 0.2);
      ctx.quadraticCurveTo(-R * 1.45, -R * 0.1, -R * 1.3, -R * 0.75);
      ctx.stroke();
    } else {
      ctx.lineWidth = R * 0.2;
      for (const dz of [0, 0.22]) {
        ctx.beginPath();
        ctx.moveTo(-R * (0.85 - dz * 0.4), -R * 0.1);
        ctx.quadraticCurveTo(-R * (1.15 + dz), -R * 0.7, -R * (1.0 + dz), -R * 1.45);
        ctx.stroke();
      }
    }
  }
  // the skull over the top and the back, the jaw forward to the chin, then up the face: lips, nose, brow, forehead
  ctx.beginPath();
  ctx.moveTo(R * 0.45, R * 0.93);
  ctx.arc(-R * 0.06, R * 0.06, R, Math.PI * 0.32, Math.PI * 1.38, false);
  ctx.quadraticCurveTo(-R * 0.1, -R * 0.95, R * 0.25, -R * 0.84);
  ctx.quadraticCurveTo(R * 0.55, -R * 0.94, R * 0.8, -R * 0.86);
  ctx.quadraticCurveTo(R * 0.97, -R * 0.8, R * 0.96, -R * 0.62);
  ctx.quadraticCurveTo(R * 1.04, -R * 0.53, R * 1.0, -R * 0.44);
  ctx.quadraticCurveTo(R * 1.05, -R * 0.34, R * 0.99, -R * 0.25);
  ctx.quadraticCurveTo(R * 1.13, -R * 0.24, R * 1.17, -R * 0.12);
  ctx.lineTo(R * 1.0, R * 0.1);
  ctx.quadraticCurveTo(R * 0.95, R * 0.2, R * 0.96, R * 0.32);
  ctx.quadraticCurveTo(R * 0.92, R * 0.78, R * 0.45, R * 0.93);
  ctx.closePath();
  ctx.fillStyle = flat ?? skin.base;
  ctx.fill();
  if (!flat) {
    // the shade under the jaw and at the back of the head
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(-R, -R, R * 0.4, R * 0.9);
    g.addColorStop(0, skin.shade);
    g.addColorStop(0.55, skin.base);
    g.addColorStop(1, skin.hi);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    // the ear
    ctx.fillStyle = skin.shade;
    ctx.beginPath();
    ctx.ellipse(-R * 0.18, -R * 0.06, R * 0.17, R * 0.25, 0.15, 0, TAU);
    ctx.fill();
    // the eye under the brow, the brow, the lips
    ctx.fillStyle = '#1a1210';
    ctx.beginPath();
    ctx.ellipse(R * 0.66, R * 0.14, R * 0.085, R * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = lit(pal.hair, 0.05);
    ctx.lineWidth = R * 0.1;
    ctx.beginPath();
    ctx.moveTo(R * 0.52, R * 0.3);
    ctx.quadraticCurveTo(R * 0.72, R * 0.36, R * 0.9, R * 0.3);
    ctx.stroke();
    ctx.strokeStyle = pal.lip;
    ctx.lineWidth = R * 0.06;
    ctx.beginPath();
    ctx.moveTo(R * 0.86, -R * 0.42);
    ctx.lineTo(R * 1.0, -R * 0.42);
    ctx.stroke();
  }
  // the hair on the head
  if (!flat) {
    ctx.fillStyle = pal.hair;
    if (hair === 3) {
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.arc(-R * 0.06, R * 0.06, R * 1.0, Math.PI * 0.18, Math.PI * 1.05);
      ctx.quadraticCurveTo(-R * 0.2, R * 0.35, R * 0.5, R * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.arc(-R * 0.06, R * 0.06, R * 1.05, Math.PI * 0.2, Math.PI * (hair === 0 ? 1.12 : 1.2));
      ctx.quadraticCurveTo(-R * 0.55, -R * 0.1, -R * 0.3, R * 0.32);
      ctx.quadraticCurveTo(R * 0.1, R * 0.55, R * 0.58, R * 0.66);
      ctx.closePath();
      ctx.fill();
      if (hair === 2) {
        // braids: rows along the skull
        ctx.strokeStyle = lit(pal.hair, 0.25);
        ctx.lineWidth = R * 0.05;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(-R * 0.1, R * 0.0, R * (0.62 + i * 0.16), Math.PI * 0.25, Math.PI * 0.95);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = lit(pal.hair, 0.22);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(R * 0.05, R * 0.82, R * 0.42, R * 0.12, -0.2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.restore();
}

/** Where on a fighter a hit lands, in frame coordinates (the effects' anchor). */
export function targetPoint(j: Joints, t: Target): P3 {
  if (t === 'head') return [j.head[0] + 0.05, j.head[1], j.head[2]];
  if (t === 'body') return [(j.mid[0] + j.chest[0]) / 2 + 0.06, (j.mid[1] + j.chest[1]) / 2, 0];
  const k = j.kL;
  return [(j.hL[0] + k[0]) / 2 + 0.04, (j.hL[1] + k[1]) / 2, j.hL[2]];
}

/** The tip of a strike's limb (a glove's centre, a shin's middle, the knee) in the frame. */
export function strikeTip(j: Joints, id: StrikeId): P3 {
  const e = EFF_OF[id];
  if (id === 'knee') return j.kR;
  if (e === 'l') return j.gL;
  if (e === 'r') return j.gR;
  if (e === 'fl') return j.aL;
  const a = j.aR, k = j.kR;
  return id === 'lowKick' || id === 'bodyKick' || id === 'headKick' ? [(a[0] * 2 + k[0]) / 3, (a[1] * 2 + k[1]) / 3, (a[2] * 2 + k[2]) / 3] : a;
}

/** Every pose the rig draws, for the gallery and the tests: an act at the moments worth seeing. */
export function allActs(style: Style): { name: string; act: Act; ts: number[] }[] {
  const out: { name: string; act: Act; ts: number[] }[] = [{ name: 'guard', act: { kind: 'guard' }, ts: [0] }];
  for (const id of Object.keys(STRIKES) as StrikeId[]) {
    if (!STRIKES[id].styles.includes(style)) continue;
    out.push({ name: `tell ${id}`, act: { kind: 'tell', strike: id }, ts: [1] });
    const { load, travel, back } = STRIKES[id];
    const all = load + travel + back;
    out.push({ name: id, act: { kind: 'strike', strike: id, power: 1 }, ts: [(load + travel * 0.5) / all, (load + travel) / all - 1e-4] });
  }
  for (const id of Object.keys(DEFENSES) as DefenseId[]) {
    if (!DEFENSES[id].styles.includes(style)) continue;
    out.push({ name: id, act: { kind: 'defend', defense: id, ok: 1 }, ts: [0.5] });
  }
  for (const target of ['head', 'body', 'legs'] as const) out.push({ name: `hit ${target}`, act: { kind: 'hit', target, force: 1 }, ts: [0.18] });
  for (const tell of Object.keys(OPEN_SHAPES) as OpeningTell[]) out.push({ name: `open ${tell}`, act: { kind: 'open', tell }, ts: [1] });
  for (const kind of ['down', 'rise', 'out', 'corner', 'cheer', 'embrace', 'touch'] as const) out.push({ name: kind, act: { kind }, ts: kind === 'rise' ? [0.3, 0.7] : kind === 'touch' ? [0.5] : [1] });
  return out;
}
