/**
 * Zacchaeus' run on a fixed step (rules.ts): Super Mario Run's verb.  He runs right by himself at
 * the street's pace; a tap jumps, a press held up to a quarter of a second jumps higher; against a
 * wall in the air he slides, and a tap kicks him off it upward (a little back, then on again, so
 * repeated taps climb a wall); a ledge within reach of his hands is pulled up onto; baskets,
 * chickens and sleeping dogs are hopped over on their own; awnings bounce him; ladders on a
 * house's near side are climbed on their own; pressed against a wall on the street for a while,
 * a neighbour gives him a leg-up.  The rope (a fall), the tree and the finale are the sim's: it
 * moves him itself while `mode` says so.
 */
import type { VaultKind } from './content';
import { RULES } from './rules';
import { standable, type Plat, type Solid, type Vault, type World } from './world';

export type HeroMode = 'run' | 'climb' | 'rope' | 'tree' | 'stop';

export type HeroEvent =
  | { type: 'jump'; held: boolean }
  | { type: 'land'; air: number; fall: number }
  | { type: 'wallJump' }
  | { type: 'bounce'; plat: Plat }
  | { type: 'vault'; vault: Vault; kind: VaultKind }
  | { type: 'mantle' }
  | { type: 'legUp' }
  | { type: 'ladder'; solid: Solid }
  | { type: 'trunk'; y: number; solid: Solid }
  | { type: 'fall' };

const EPS = 1e-6;

export class Hero {
  x = 1;
  y = 0;
  vx: number = RULES.run;
  vy = 0;
  /** the pace he runs toward (u/s): the street's, or 0 when he stops */
  pace: number = RULES.run;
  mode: HeroMode = 'run';
  ground = true;
  /** what he stands on (null in the air) */
  on: Solid | Plat | null = null;
  /** the wall he is touching in the air, or pressed against on the street */
  wall: Solid | null = null;
  /** the finger or the key is down */
  held = false;
  /** a tap waiting to become a jump (s left), the grace after leaving a ledge (s left) */
  private buf = 0;
  private coyote = 0;
  /** a held jump is rising on the lighter gravity, for this long so far (s) */
  private rising = false;
  private holdT = 0;
  /** pressed against a wall on the street (s), seconds in the air, the highest point of this flight */
  private push = 0;
  airT = 0;
  private peak = 0;
  private ladderTop = 0;
  /** the last frame's facts the picture reads: a wall slide, a squash on landing */
  sliding = false;
  /** seconds over the roofs so far, on them or leaping between them (a mission and a stat) */
  highSec = 0;

  constructor(private readonly emit: (e: HeroEvent) => void) {}

  /** A tap (pointer or key down): it jumps at the next step it can. */
  press(): void {
    this.held = true;
    this.buf = RULES.buffer;
  }

  release(): void { this.held = false; }

  /** Put him somewhere standing (the rope's end, the tree's foot). */
  place(x: number, y: number, vx = 0): void {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = 0;
    this.ground = true;
    this.on = null;
    this.wall = null;
    this.rising = false;
    this.buf = 0;
    this.push = 0;
    this.airT = 0;
    this.peak = y;
  }

  step(dt: number, w: World): void {
    if (this.mode === 'climb') return this.climb(dt);
    if (this.mode !== 'run') return;
    const R = RULES;
    this.buf = Math.max(0, this.buf - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    // the pace: the run catches up quickly after a wall's kick
    const dv = this.pace - this.vx, a = R.accel * dt;
    this.vx += Math.abs(dv) <= a ? dv : Math.sign(dv) * a;
    // a tap: from the ground (or just off it), else off a wall
    if (this.buf > 0) {
      if (this.ground || this.coyote > 0) this.jump(R.jumpV);
      else if (this.wall) {
        this.jump(R.wallV);
        this.vx = -R.wallKick;
        this.emit({ type: 'wallJump' });
      }
    }
    if (this.rising) {
      this.holdT += dt;
      if (!this.held || this.holdT >= R.holdMax || this.vy <= 0) this.rising = false;
    }
    // across
    const px = this.x;
    this.x += this.vx * dt;
    this.wall = null;
    for (const s of w.solids) {
      if (!(this.y < s.top - EPS && this.y + R.height > s.bottom)) continue;
      if (this.vx > 0 && px + R.halfW <= s.x0 + EPS && this.x + R.halfW > s.x0) {
        if (this.ground && s.top - this.y <= R.stepUp && s.kind !== 'trunk') {
          this.y = s.top;
          this.on = s;
          continue;
        }
        this.x = s.x0 - R.halfW;
        if (s.kind === 'trunk') {
          this.emit({ type: 'trunk', y: this.y, solid: s });
          return;
        }
        if (s.ladder) {
          this.mode = 'climb';
          this.ladderTop = s.top;
          this.vy = 0;
          this.ground = false;
          this.rising = false;
          this.emit({ type: 'ladder', solid: s });
          return;
        }
        this.wall = s;
      } else if (this.vx < 0 && px - R.halfW >= s.x1 - EPS && this.x - R.halfW < s.x1) {
        this.x = s.x1 + R.halfW;
        this.vx = 0;
      }
    }
    const wall = this.wall;
    // a ledge within reach of the hands: up he goes
    if (wall && !this.ground && wall.top - this.y > 0 && wall.top - this.y <= (wall.kind === 'ground' ? R.rimMantle : R.mantle)) {
      this.y = wall.top;
      this.x = wall.x0 + 0.02;
      this.vy = 0;
      this.land(wall);
      this.wall = null;
      this.emit({ type: 'mantle' });
    } else if (wall && this.ground) {
      this.push += dt;
      if (this.push >= R.legUp) {
        this.push = 0;
        this.ground = false;
        this.on = null;
        this.vy = R.legUpV;
        this.emit({ type: 'legUp' });
      }
    } else this.push = 0;
    // up and down
    const g = this.rising ? R.gHold : R.g;
    this.vy = Math.max(-R.maxFall, this.vy - g * dt);
    this.sliding = !!this.wall && !this.ground && this.vy < 0;
    if (this.sliding) this.vy = Math.max(this.vy, -R.wallSlide);
    const py = this.y;
    if (!this.ground) {
      this.y += this.vy * dt;
      this.airT += dt;
      this.peak = Math.max(this.peak, this.y);
      if (this.vy <= 0) this.landing(w, py);
    } else {
      this.vy = 0;
      if (!this.supported(w)) {
        this.ground = false;
        this.on = null;
        this.coyote = R.coyote;
        this.airT = 0;
        this.peak = this.y;
      }
    }
    // the things he hops over on his own
    if (this.ground) {
      for (const v of w.vaults) {
        if (v.done) continue;
        const d = v.x - this.x;
        if (d > 0 && d <= R.vaultAhead) {
          v.done = true;
          this.ground = false;
          this.on = null;
          this.vy = R.vaultV;
          this.airT = 0;
          this.peak = this.y;
          this.emit({ type: 'vault', vault: v, kind: v.kind });
          break;
        }
      }
    }
    if (this.y >= 2.2) this.highSec += dt;
    if (this.y < R.fallY) this.emit({ type: 'fall' });
  }

  private jump(v: number): void {
    this.vy = v;
    this.ground = false;
    this.on = null;
    this.coyote = 0;
    this.buf = 0;
    this.rising = true;
    this.holdT = 0;
    this.airT = 0;
    this.peak = this.y;
    this.wall = null;
    this.emit({ type: 'jump', held: this.held });
  }

  private landing(w: World, py: number): void {
    const R = RULES;
    const l = this.x - R.halfW + 0.02, r = this.x + R.halfW - 0.02;
    let best: Solid | Plat | null = null, top = -Infinity;
    for (const s of w.solids) {
      if (s.x1 > l && s.x0 < r && py >= s.top - 1e-4 && this.y <= s.top && s.top > top) { best = s; top = s.top; }
    }
    for (const p of w.plats) {
      if (standable(p) && p.x1 > l && p.x0 < r && py >= p.y - 1e-4 && this.y <= p.y && p.y > top) { best = p; top = p.y; }
    }
    if (!best) return;
    this.y = top;
    if ('kind' in best && 'high' in best && best.kind === 'awning') {
      this.vy = this.held ? R.bounceHeld : R.bounceV;
      this.rising = false;
      this.airT = 0;
      this.peak = this.y;
      this.emit({ type: 'bounce', plat: best });
      return;
    }
    this.land(best);
  }

  private land(on: Solid | Plat): void {
    const air = this.airT, fall = this.peak - this.y;
    this.vy = 0;
    this.ground = true;
    this.on = on;
    this.rising = false;
    if (air > 0.05) this.emit({ type: 'land', air, fall });
    this.airT = 0;
    this.peak = this.y;
  }

  private supported(w: World): boolean {
    const l = this.x - RULES.halfW + 0.02, r = this.x + RULES.halfW - 0.02;
    for (const s of w.solids) if (s.x1 > l && s.x0 < r && Math.abs(s.top - this.y) < 1e-3) { this.on = s; return true; }
    for (const p of w.plats) if (standable(p) && p.x1 > l && p.x0 < r && Math.abs(p.y - this.y) < 1e-3) { this.on = p; return true; }
    return false;
  }

  private climb(dt: number): void {
    this.y = Math.min(this.ladderTop, this.y + RULES.climbV * dt);
    this.vx = 0;
    if (this.y >= this.ladderTop - 1e-6) {
      // over the parapet: a little hop forward onto the roof
      this.mode = 'run';
      this.y = this.ladderTop + 0.02;
      this.x += 0.04;
      this.vy = 2.4;
      this.vx = this.pace * 0.7;
      this.ground = false;
      this.airT = 0;
      this.peak = this.y;
    }
  }

  /** On the street or a roof, standing (not in the air, not on a ladder). */
  get standing(): boolean { return this.mode === 'run' && this.ground; }
}
