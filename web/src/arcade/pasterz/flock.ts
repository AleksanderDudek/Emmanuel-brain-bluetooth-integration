/**
 * The bodies on the hill: the shepherd (who walks toward the finger with easing and slides along
 * whatever is solid) and the sheep — grazing in small groups, walking up when called, and in the
 * flock a soft boids crowd (separation, alignment, cohesion toward where the shepherd was a moment
 * ago), so the flock trails him with a little lag and funnels through the gaps of the terraces.
 * Pure: no DOM, randomness only from the caller's generator.
 */
import { approach } from '../kit/juice';
import type { Hill } from './hill';
import { RULES } from './rules';

export type SheepState = 'graze' | 'called' | 'follow' | 'snag' | 'gate' | 'folded';

export interface Sheep {
  readonly id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** heading (rad) */
  dir: number;
  state: SheepState;
  /** the grazing group's centre, the spot it wanders to and how long it waits there (s) */
  homeX: number;
  homeY: number;
  wx: number;
  wy: number;
  wait: number;
  /** a lamb (morning lambs): smaller */
  small: boolean;
  /** looking up at the call (s left) */
  look: number;
  /** the walk's phase (the wool bobs with it) */
  stepT: number;
  /** thorns: no new snag until this runs out (s); how long this snag has held (s) */
  snagCool: number;
  snagT: number;
  /** called by the voice: for how long (s) */
  calledT: number;
  /** lying down (0..1) at the night's fire, and asleep (the Zzz) */
  lie: number;
  asleep: boolean;
  /** out of sight and far behind (s) */
  strayT: number;
  /** the fold: walking to the gate (s), counted in, and its spot inside */
  gateT: number;
  counted: boolean;
  spotX: number;
  spotY: number;
}

export function makeSheep(id: number, x: number, y: number, rnd: () => number, small = false): Sheep {
  return {
    id, x, y, vx: 0, vy: 0, dir: rnd() * Math.PI * 2, state: 'graze', homeX: x, homeY: y, wx: x, wy: y, wait: rnd() * 3,
    small, look: 0, stepT: rnd() * 10, snagCool: 0, snagT: 0, calledT: 0, lie: 0, asleep: false, strayT: 0,
    gateT: 0, counted: false, spotX: x, spotY: y,
  };
}

/** How far the flock keeps around what it follows (m): a bigger flock spreads wider. */
export const keepFor = (n: number): number => RULES.keep0 + RULES.keepN * Math.sqrt(Math.max(1, n));

export class Shepherd {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** heading (rad) and the last real speed (m/s) */
  dir = Math.PI / 2;
  speed = 0;
  /** a tap's goal or the drag's point (null: none) and the keys' direction */
  goal: { x: number; y: number } | null = null;
  kx = 0;
  ky = 0;
  /** the lost lamb on the shoulders */
  carrying = false;
  /** the walk's phase, for the stride and the sway */
  stepT = 0;
  wading = false;
  /** where he was, every 0.05 s, for the flock's lag */
  private readonly trail: { x: number; y: number }[] = [];
  private trailT = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.resetTrail();
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.goal = null;
    this.resetTrail();
  }

  private resetTrail(): void {
    this.trail.length = 0;
    for (let i = 0; i < 64; i++) this.trail.push({ x: this.x, y: this.y });
  }

  /** Where he was `sec` ago (at most 3.2 s). */
  past(sec: number): { x: number; y: number } {
    const k = Math.min(this.trail.length - 1, Math.max(0, Math.round(sec / 0.05)));
    return this.trail[this.trail.length - 1 - k];
  }

  /** One step: toward the keys' direction or the goal, eased, sliding along obstacles.  Returns the distance walked. */
  step(dt: number, hill: Hill, mul: number): number {
    const R = RULES;
    this.wading = hill.wading(this.x, this.y);
    const top = R.speed * mul * (this.wading ? R.wade : 1);
    let wx = 0, wy = 0;
    const kl = Math.hypot(this.kx, this.ky);
    if (kl > 0) {
      wx = (this.kx / kl) * top;
      wy = (this.ky / kl) * top;
      this.goal = null;
    } else if (this.goal) {
      const dx = this.goal.x - this.x, dy = this.goal.y - this.y, d = Math.hypot(dx, dy);
      if (d < 0.06) this.goal = null;
      else {
        const s = top * Math.min(1, d / R.arrive);
        wx = (dx / d) * s;
        wy = (dy / d) * s;
      }
    }
    this.vx = approach(this.vx, wx, dt, R.accelTau);
    this.vy = approach(this.vy, wy, dt, R.accelTau);
    const x0 = this.x, y0 = this.y;
    hill.walk(this, this.vx * dt, this.vy * dt, R.radius);
    const moved = Math.hypot(this.x - x0, this.y - y0);
    this.speed = dt > 0 ? moved / dt : 0;
    if (moved > 1e-4) {
      const want = Math.atan2(this.y - y0, this.x - x0);
      this.dir += angleDiff(this.dir, want) * Math.min(1, dt * 12);
    }
    this.stepT += moved;
    this.trailT += dt;
    while (this.trailT >= 0.05) {
      this.trailT -= 0.05;
      this.trail.shift();
      this.trail.push({ x: this.x, y: this.y });
    }
    return moved;
  }
}

/** The signed smallest turn from a to b (rad). */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** What the flock steers by this frame. */
export interface FlockCtx {
  hill: Hill;
  shepherd: Shepherd;
  /** what followers gather around (the lagged shepherd, or the night's fire) and how far they keep */
  tx: number;
  ty: number;
  keep: number;
  /** the fold's gate (outward direction gx, gy) and its centre, while the count runs */
  gate: { x: number; y: number; gx: number; gy: number; cx: number; cy: number } | null;
}

const want = { x: 0, y: 0 };

/** One step of every sheep's steering and walking. */
export function stepSheep(list: Sheep[], c: FlockCtx, dt: number, rnd: () => number): void {
  const R = RULES, hill = c.hill, sh = c.shepherd;
  for (const s of list) {
    s.look = Math.max(0, s.look - dt);
    s.snagCool = Math.max(0, s.snagCool - dt);
    want.x = 0;
    want.y = 0;
    let top: number = R.maxSpeed;
    switch (s.state) {
      case 'graze': {
        s.wait -= dt;
        if (s.wait <= 0) {
          const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R.grazeR;
          s.wx = s.homeX + Math.cos(a) * r;
          s.wy = s.homeY + Math.sin(a) * r;
          s.wait = 2 + rnd() * 4;
        }
        seek(s, s.wx, s.wy, 0.25, R.grazeSpeed);
        top = R.grazeSpeed;
        break;
      }
      case 'called':
        s.calledT += dt;
        seek(s, sh.x, sh.y, 0.8, R.calledSpeed);
        break;
      case 'follow': {
        const dx = c.tx - s.x, dy = c.ty - s.y, d = Math.hypot(dx, dy);
        if (d > c.keep) {
          const sp = Math.min(R.maxSpeed, (d - c.keep) * 2.2 + 0.3);
          want.x = (dx / d) * sp;
          want.y = (dy / d) * sp;
        }
        break;
      }
      case 'snag':
        s.snagT += dt;
        break;
      case 'gate': {
        s.gateT += dt;
        const g = c.gate;
        if (!g) break;
        if (!s.counted) {
          // around the fold's wall to its gate, then through
          const ox = s.x - g.cx, oy = s.y - g.cy, od = Math.hypot(ox, oy) || 1;
          if ((ox * g.gx + oy * g.gy) / od < 0.35 && od < R.foldR + 2.5) {
            const side = ox * -g.gy + oy * g.gx >= 0 ? 1 : -1;
            seek(s, g.cx + (g.gx - g.gy * side) * (R.foldR + 1.4), g.cy + (g.gy + g.gx * side) * (R.foldR + 1.4), 0.2, R.maxSpeed);
          } else seek(s, g.x, g.y, 0, R.maxSpeed);
        } else seek(s, s.spotX, s.spotY, 0.15, 2.4);
        break;
      }
      case 'folded':
        seek(s, s.spotX, s.spotY, 0.2, 0.8);
        top = 0.8;
        break;
    }
    if (s.state !== 'snag' && s.state !== 'folded') {
      // separation from the others and from the shepherd; alignment in the flock
      let ax = 0, ay = 0, an = 0;
      for (const o of list) {
        if (o === s || o.state === 'folded') continue;
        const dx = s.x - o.x, dy = s.y - o.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) continue;
        const d = Math.hypot(dx, dy);
        const sep = R.sepR * (s.small || o.small ? 0.8 : 1);
        if (d < sep && d > 1e-6) {
          const k = ((sep - d) / sep) * 3.2;
          want.x += (dx / d) * k;
          want.y += (dy / d) * k;
        }
        if (s.state === 'follow' && o.state === 'follow' && d < 2) {
          ax += o.vx;
          ay += o.vy;
          an++;
        }
      }
      if (an) {
        want.x += (ax / an) * 0.25;
        want.y += (ay / an) * 0.25;
      }
      const dx = s.x - sh.x, dy = s.y - sh.y, d = Math.hypot(dx, dy);
      if (d < 1.35 && d > 1e-6 && s.state !== 'gate') {
        want.x += (dx / d) * (1.35 - d) * 5;
        want.y += (dy / d) * (1.35 - d) * 5;
      }
    }
    const wl = Math.hypot(want.x, want.y);
    if (wl > top) {
      want.x *= top / wl;
      want.y *= top / wl;
    }
    const tau = s.state === 'snag' ? 0.08 : R.steerTau;
    s.vx = approach(s.vx, s.state === 'snag' ? 0 : want.x, dt, tau);
    s.vy = approach(s.vy, s.state === 'snag' ? 0 : want.y, dt, tau);
    const slow = hill.wading(s.x, s.y) ? R.wade : 1;
    const x0 = s.x, y0 = s.y;
    if (s.state === 'gate' || s.state === 'folded') {
      // through the fold's gate: the walls do not stop it (nothing solid stands at the fold)
      s.x += s.vx * dt * slow;
      s.y += s.vy * dt * slow;
    } else hill.walk(s, s.vx * dt * slow, s.vy * dt * slow, s.small ? R.sheepR * 0.75 : R.sheepR);
    const moved = Math.hypot(s.x - x0, s.y - y0);
    if (moved > dt * 0.15) s.dir += angleDiff(s.dir, Math.atan2(s.y - y0, s.x - x0)) * Math.min(1, dt * 8);
    s.stepT += moved * 2.4;
  }
}

function seek(s: Sheep, x: number, y: number, stop: number, speed: number): void {
  const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy);
  if (d <= stop || d < 1e-6) return;
  const sp = Math.min(speed, (d - stop) * 2.5 + 0.15);
  want.x += (dx / d) * sp;
  want.y += (dy / d) * sp;
}
