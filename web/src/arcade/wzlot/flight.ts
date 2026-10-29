/**
 * The eaglet's flight, without the DOM: Tiny Wings' verb on Wzlot's hills (terrain.ts).
 *
 * On the ground it slides along the slope (gravity's tangential part and light friction); in the
 * air it is ballistic.  Holding folds the wings — gravity × 2.2 — so it hugs downslopes, gains speed
 * and dives; letting go opens them: glide gravity g × (1 − 0.5 W), and a sink rate that open wings
 * never exceed, so height turns into long glides.  It launches from crests by its own momentum
 * (when the ground curves away faster than gravity can hold it).  A dive close above a downslope
 * lines up with it.  A landing compares the flight's angle with the slope: within 10° of a downslope
 * it is smooth, up to 12° the honest margin, more than 35° into an upslope a stall.  The eaglet's
 * own little push keeps it at 0.9 sh/s or more, except for a moment after a stall, when it may roll
 * back: then the parent swoops under it and carries it over the next crest — and over a wadi it
 * cannot make.  Nothing is ever lost: `maxX` only grows.
 *
 * The session (sim.ts) steps it at a fixed 1/120 s with what the hands and the band say this step.
 */
import { RULES } from './rules';
import type { Ridge, Terrain } from './terrain';

export type Mode = 'ground' | 'air' | 'climb' | 'catch' | 'carry' | 'nest';
export type Landing = 'smooth' | 'near' | 'rough' | 'stall';

export interface FlightInput {
  /** wings folded (a finger, Space, ↓, a mouse button) */
  held: boolean;
  /** wing lift: 0.55 neutral … 0.9 */
  W: number;
  /** the parent's draft (follow steps, a return's wingbeat), 0…0.2: less drag, a higher floor and cap */
  draft: number;
  /** soaring: less drag, a higher cap */
  soaring: boolean;
}

/** What one step of flight did (sim.ts turns these into the game's events). */
export type FlightEvent =
  | { type: 'launch'; x: number; y: number }
  /** `deg`: the angle between the flight and the slope at touchdown; `down`: it was a downslope */
  | { type: 'land'; cls: Landing; deg: number; down: boolean; airT: number; glide: number; hills: number; speed: number }
  | { type: 'crest'; x: number; airborne: boolean }
  | { type: 'catch'; why: 'roll' | 'wadi' }
  | { type: 'carried' }
  | { type: 'climbEnd'; height: number }
  | { type: 'climbOut' };

/** A thermal the eaglet is climbing in: its rate (sh/s) and how long it lasts (s). */
export interface Climb { rate: number; dur: number }

const DEG = 180 / Math.PI;

/** The lift the wings give at forward speed vx: W's gain over neutral grows with the airspeed, full from liftV. */
export function liftAt(W: number, vx: number): number {
  const k = Math.min(1, (vx / RULES.liftV) ** 2);
  return RULES.wNeutral + (W - RULES.wNeutral) * k;
}

/** The fastest open wings sink (sh/s) at wing lift W and forward speed vx. */
export function sinkRate(W: number, vx: number): number {
  const R = RULES;
  return (R.sink0 - R.sinkW * liftAt(W, vx)) * (R.sinkRef / Math.min(R.sinkVx[1], Math.max(R.sinkVx[0], vx))) ** R.sinkPow;
}

export class Eaglet {
  mode: Mode = 'ground';
  x: number = RULES.startX;
  y = 0;
  /** in the air: velocity; on the ground: `s`, the speed along the slope (negative: rolling back) */
  vx = 0;
  vy = 0;
  s: number = RULES.startV;
  /** the farthest x reached: the headline counts it, so a roll back costs nothing */
  maxX: number = RULES.startX;
  /** seconds in the air in this flight, the flight's start, crests passed in it, its highest point over the ground */
  airT = 0;
  private flightX = 0;
  private hills = 0;
  apex = 0;
  /** after a stall the eaglet's own push rests (s left) */
  stun = 0;
  private back = 0;
  /** the climb in a thermal: time in it, its numbers, the height gained and over the ground at its top */
  climbT = 0;
  climbing: Climb | null = null;
  climbFrom = 0;
  /** the catch: its phase time, where the swoop began and the carry's curve */
  catchT = 0;
  private readonly carryP = new Float64Array(8);
  private carryDur = 1;
  /** the slope's angle under the eaglet now (rad), for the picture */
  angle = 0;
  private lastSlope = 0;
  /** the parent has just let go: the next touchdown is a soft set-down, not a landing */
  private setDown = false;

  constructor(private readonly t: Terrain, private readonly emit: (e: FlightEvent) => void) {
    this.y = t.height(this.x);
  }

  get speed(): number { return this.mode === 'ground' ? this.s : Math.hypot(this.vx, this.vy); }
  get airborne(): boolean { return this.mode === 'air' || this.mode === 'climb'; }
  /** height over the ground (sh) */
  get altitude(): number { return Math.max(0, this.y - this.t.height(this.x)); }
  /** in the parent's care (the swoop and the carry) */
  get caught(): boolean { return this.mode === 'catch' || this.mode === 'carry'; }

  step(dt: number, inp: FlightInput): void {
    switch (this.mode) {
      case 'ground': this.ground(dt, inp); break;
      case 'air': this.air(dt, inp); break;
      case 'climb': this.climb(dt, inp); break;
      case 'catch': this.swoop(dt); break;
      case 'carry': this.carry(dt); break;
      default: break;
    }
    if (this.x > this.maxX) {
      this.maxX = this.x;
      this.back = 0;
    }
  }

  /** The soft ceiling (sh/s). */
  private cap(inp: FlightInput): number {
    return RULES.vMax * (1 + inp.draft) * (inp.soaring ? RULES.soarBonus : 1);
  }

  /** Drag's factor: the parent's draft and soaring both thin it. */
  private drag(inp: FlightInput): number {
    return (inp.soaring ? RULES.soarDrag : 1) / ((1 + inp.draft) * (1 + inp.draft));
  }

  private ground(dt: number, inp: FlightInput): void {
    const R = RULES, T = this.t;
    const m = T.slope(this.x);
    const cos = 1 / Math.sqrt(1 + m * m), sin = m * cos;
    const g = R.g * (inp.held ? R.dive : 1);
    let s = this.s;
    // friction grows with the weight on the ground (a tucked eaglet presses harder), drag with the speed
    const fr = R.friction * g * cos * Math.tanh(s / 0.05) + Math.sign(s) * R.groundDrag * s * s * this.drag(inp);
    let a = -g * sin - fr;
    const cap = this.cap(inp), floor = R.vMin * (1 + inp.draft);
    if (s > cap) a -= (s - cap) * R.capRate;
    if (this.stun > 0) this.stun = Math.max(0, this.stun - dt);
    else if (s < floor) a += Math.min(R.floorPush, (floor - s) * R.floorRate);
    s += a * dt;
    this.s = s;
    this.x += s * cos * dt;
    this.y = T.height(this.x);
    this.angle = Math.atan(m);
    const wadi = T.wadiAt(this.x);
    if (wadi && this.y < wadi.catchY) {
      this.startCatch('wadi');   // slid over the edge: the gorge is no place for an eaglet
      return;
    }
    const m1 = T.slope(this.x);
    if (this.lastSlope > 0 && m1 <= 0 && s > 0) {
      this.stun = 0;   // over the top: the stall is behind
      this.emit({ type: 'crest', x: this.x, airborne: false });
    }
    this.lastSlope = m1;
    // the ground curves away faster than gravity can hold the eaglet to it: it flies
    if (s > 0) {
      const c1 = 1 / Math.sqrt(1 + m1 * m1);
      const kappa = T.bend(this.x) * c1 * c1 * c1;
      if (s * s * -kappa > g * c1 * R.launchMargin) {
        this.mode = 'air';
        this.vx = s * c1;
        this.vy = s * m1 * c1;
        this.airT = 0;
        this.flightX = this.x;
        this.hills = 0;
        this.apex = 0;
        this.emit({ type: 'launch', x: this.x, y: this.y });
        return;
      }
    }
    // rolling back: the seconds spent sliding backwards since the eaglet last got farther (a stalled
    // eaglet rocking in a valley adds them up too) call the parent
    if (s < 0) {
      this.back += dt;
      if (this.back >= R.rollBack) this.startCatch('roll');
    }
  }

  private air(dt: number, inp: FlightInput): void {
    const R = RULES, T = this.t;
    const held = inp.held;
    const vy0 = this.vy;
    let rail = 0;
    if (held) {
      this.vy -= R.g * R.dive * dt;
      // a dive close above a downslope flares onto it: the flight turns toward the slope, aimed into
      // it the more the higher it still is, so the tucked eaglet swoops down and touches the hill along it
      const h = this.y - T.height(this.x), m = T.slope(this.x);
      if (this.vy < 0 && m < R.magnetSlope && h < R.magnetH && !T.wadiAt(this.x)) {
        rail = 1;
        const want = Math.atan(m) - Math.min(R.magnetMaxInto, R.magnetFlare * Math.max(0, h - R.touchH));
        const sp = Math.hypot(this.vx, this.vy), ph = Math.atan2(this.vy, this.vx);
        const rate = R.magnetRate + R.magnetRateNear * (1 - Math.max(0, h) / R.magnetH);
        const nph = ph + (want - ph) * (1 - Math.exp(-dt * rate));
        this.vx = sp * Math.cos(nph);
        this.vy = sp * Math.sin(nph);
      }
    } else {
      // open wings: glide gravity down to the sink rate they never exceed (lower for more lift, and at
      // speed: a slow eaglet settles steeply, a fast one flattens out); a dive's speed bleeds into them
      const sink = sinkRate(inp.W, this.vx);
      if (this.vy > -sink) this.vy = Math.max(-sink, this.vy - R.g * (1 - 0.5 * liftAt(inp.W, this.vx)) * dt);
      else this.vy += (-sink - this.vy) * (1 - Math.exp(-dt / R.sinkTau));
    }
    let sp = Math.hypot(this.vx, this.vy);
    if (sp > 0) {
      let dv = R.airDrag * sp * sp * this.drag(inp) * dt;
      const cap = this.cap(inp);
      if (sp > cap) dv += (sp - cap) * R.capRate * dt;
      const k = Math.max(0, sp - dv) / sp;
      this.vx *= k;
      this.vy *= k;
      sp *= k;
    }
    if (this.vx < 0.3) this.vx = 0.3;   // the wind is at its back: it never flies backwards
    const mBefore = T.slope(this.x);
    this.x += this.vx * dt;
    // the mean of the step's two vertical speeds: a launch's arc leaves the ground the way the ground curves away
    this.y += 0.5 * (vy0 + this.vy) * dt;
    this.airT += dt;
    const ground = T.height(this.x);
    this.apex = Math.max(this.apex, this.y - ground);
    this.angle = Math.atan2(this.vy, this.vx);
    const mNow = T.slope(this.x);
    if (mBefore > 0 && mNow <= 0) {
      this.hills++;
      this.emit({ type: 'crest', x: this.x, airborne: true });
    }
    const wadi = T.wadiAt(this.x);
    if (wadi && this.y < wadi.catchY) {
      this.startCatch('wadi');
      return;
    }
    // on the rail and a feather's breadth over the slope, lined up with it: the feet touch the ground
    const touch = rail > 0 && this.y - ground < R.touchH && Math.abs(Math.atan(mNow) - this.angle) * DEG <= R.smooth;
    if (this.y <= ground || touch) this.touchdown(ground, mNow, sp);
  }

  /** Back on the ground: the landing's class from the angle between the flight and the slope. */
  private touchdown(ground: number, m: number, sp: number): void {
    const R = RULES;
    const th = Math.atan(m), ph = Math.atan2(this.vy, this.vx);
    const diff = Math.abs(ph - th) * DEG;
    const down = m < 0;
    let s = sp * Math.cos(Math.min(Math.PI / 2, Math.abs(ph - th)));
    this.y = ground;
    this.mode = 'ground';
    this.lastSlope = m;
    this.back = 0;
    if (this.airT < R.minAir || this.setDown) {
      this.setDown = false;
      this.s = Math.max(R.releaseV, s);   // a hop over a crest, or the parent setting it down: no landing to speak of
      return;
    }
    let cls: Landing;
    if (down && diff <= R.smooth) {
      cls = 'smooth';
      s *= R.smoothBonus;
    } else if (down && diff <= R.near) cls = 'near';
    else if (m > R.upslope && diff > R.stall) {
      cls = 'stall';
      s = sp * R.stallKeep;
      this.stun = R.stun;
    } else cls = 'rough';
    this.s = s;
    this.emit({ type: 'land', cls, deg: diff, down, airT: this.airT, glide: this.x - this.flightX, hills: this.hills, speed: s });
  }

  /** Glide into a thermal with open wings: it climbs a spiral. */
  enterClimb(c: Climb): void {
    if (this.mode === 'ground') {
      const m = this.t.slope(this.x), cos = 1 / Math.sqrt(1 + m * m);
      this.vx = Math.max(0.3, this.s * cos);
      this.vy = 0;
    }
    this.mode = 'climb';
    this.climbing = c;
    this.climbT = 0;
    this.climbFrom = this.y;
  }

  private climb(dt: number, inp: FlightInput): void {
    const c = this.climbing!;
    this.climbT += dt;
    this.x += RULES.climbDrift * dt;
    this.y += c.rate * dt;
    this.angle = 0.25 * Math.sin(this.climbT * 4);
    if (inp.held || this.climbT >= c.dur) this.leaveClimb(inp.held);
  }

  /** Out of the column at its top (or folded out of it): a glide begins. */
  private leaveClimb(dropped: boolean): void {
    this.mode = 'air';
    this.vx = Math.max(this.vx, RULES.climbExit);
    this.vy = 0;
    this.airT = RULES.minAir;   // a glide out of a thermal always lands as a landing
    this.flightX = this.x;
    this.hills = 0;
    const height = this.altitude;
    this.climbing = null;
    this.emit(dropped ? { type: 'climbOut' } : { type: 'climbEnd', height });
  }

  /** Faster by the factor k at once, on the ground or in the air (the parent's draft, soaring). */
  boost(k: number): void {
    if (this.mode === 'ground') this.s *= k;
    else if (this.mode === 'air') {
      this.vx *= k;
      this.vy *= k;
    }
  }

  /** A stage-3 wingbeat: up and forward, off the ground too. */
  wingbeat(): void {
    if (this.mode === 'ground') {
      const m = this.t.slope(this.x), cos = 1 / Math.sqrt(1 + m * m);
      this.vx = Math.max(0.3, this.s * cos);
      this.vy = Math.max(0, this.s * m * cos);
      this.mode = 'air';
      this.airT = 0;
      this.flightX = this.x;
      this.hills = 0;
      this.apex = 0;
      this.y += 0.005;
    } else if (this.mode !== 'air') return;
    this.vy = Math.max(this.vy, 0) + RULES.beatVy;
    this.vx += RULES.beatVx;
  }

  // ── the parent's catch ─────────────────────────────────────────
  /** The parent swoops under the eaglet (it hangs, slowing, for the swoop), then carries it over the next crest. */
  startCatch(why: 'roll' | 'wadi'): void {
    if (this.caught) return;
    if (this.mode === 'ground') {
      const m = this.t.slope(this.x), cos = 1 / Math.sqrt(1 + m * m);
      this.vx = this.s * cos;
      this.vy = this.s * m * cos;
    }
    this.mode = 'catch';
    this.catchT = 0;
    this.climbing = null;
    this.stun = 0;
    this.back = 0;
    this.emit({ type: 'catch', why });
  }

  private swoop(dt: number): void {
    this.catchT += dt;
    // the fall eases off as the parent comes under: drift on, slower every moment
    const k = Math.exp(-dt * 3.2);
    this.vx *= k;
    this.vy = this.vy * k + 0.25 * dt;
    this.x += this.vx * dt;
    this.y = Math.max(this.y + this.vy * dt, this.t.height(this.x) + 0.04);
    if (this.catchT >= RULES.swoop) this.beginCarry();
  }

  private beginCarry(): void {
    const R = RULES, T = this.t;
    // over the next crest: beyond the farthest point reached, and beyond the wadi if over one
    const wadi: Ridge | null = T.wadiAt(this.x);
    const from = Math.max(this.x, this.maxX, wadi ? wadi.wadiX1 - 0.05 : -Infinity);
    const crest = T.crestAfter(from);
    const x3 = crest.x + R.releaseAt[0], y3 = T.height(x3) + R.releaseAt[1];
    const p = this.carryP;
    p[0] = this.x; p[1] = this.y;
    p[2] = this.x + 0.25; p[3] = Math.max(this.y, crest.y) + 0.35;
    p[4] = x3 - 0.35; p[5] = Math.max(y3, crest.y) + 0.25;
    p[6] = x3; p[7] = y3;
    this.carryDur = Math.max(R.carryMin, Math.hypot(x3 - this.x, y3 - this.y) / R.carrySpeed);
    this.mode = 'carry';
    this.catchT = 0;
  }

  /** How far along the carry is (0…1). */
  get carried(): number { return this.mode === 'carry' ? Math.min(1, this.catchT / this.carryDur) : 0; }

  private carry(dt: number): void {
    this.catchT += dt;
    const u = Math.min(1, this.catchT / this.carryDur);
    const e = u * u * (3 - 2 * u), v = 1 - e;
    const p = this.carryP;
    const x = v * v * v * p[0] + 3 * v * v * e * p[2] + 3 * v * e * e * p[4] + e * e * e * p[6];
    const y = v * v * v * p[1] + 3 * v * v * e * p[3] + 3 * v * e * e * p[5] + e * e * e * p[7];
    this.angle = Math.atan2(y - this.y, Math.max(1e-6, x - this.x));
    this.x = Math.max(this.x, x);
    this.y = Math.max(y, this.t.height(this.x) + 0.05);
    if (u >= 1) {
      // let go just over the downslope past the crest, along it
      const m = this.t.slope(this.x), cos = 1 / Math.sqrt(1 + m * m);
      this.mode = 'air';
      this.vx = RULES.releaseV * cos;
      this.vy = RULES.releaseV * m * cos;
      this.setDown = true;
      this.airT = 0;
      this.flightX = this.x;
      this.hills = 0;
      this.apex = 0;
      this.emit({ type: 'carried' });
    }
  }

  /** The finisher takes over: the eaglet is lifted to the nest (sim.ts draws its path). */
  toNest(): void {
    this.mode = 'nest';
    this.climbing = null;
  }
}
