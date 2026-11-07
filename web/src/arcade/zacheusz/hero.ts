/**
 * Zacchaeus' run on a fixed step (rules.ts): Super Mario Run's verbs.
 *
 *   run        right by himself at the street's pace (◀ stone: back for a moment; ▶ stone: a dash)
 *   tap        jumps; held up to a quarter second, higher; just before landing, it still jumps
 *              (buffer); just after leaving a ledge, too (coyote)
 *   in the air a tap against a wall kicks off it (up and back: repeated taps climb); elsewhere it is
 *              a spin (a little lift, once a flight: a stylish move)
 *   on its own a ledge within reach of the hands is pulled up onto; geese and goats in the way are
 *              vaulted; landing on one's back bonks it (a bounce, higher while held); awnings bounce,
 *              the crowd tosses him up, a spring of light throws him onto the band's road; pressed
 *              against a wall on the street, a neighbour gives him a leg-up
 *   stones     pause: he stops until a tap (Mario's pause block); ◀ runs him back; ▶ dashes, and a
 *              tap on it is a long jump
 *
 * The bubble, the rope, the finish and the cards are the sim's: it holds him (`mode = 'held'`).
 */
import type { Critter, Plat, Solid, Spring, Tile, World } from './world';
import { RULES } from './rules';

export type HeroMode = 'run' | 'held';

export type HeroEvent =
  | { type: 'jump'; held: boolean }
  | { type: 'land'; air: number; fall: number }
  | { type: 'wallJump' }
  | { type: 'spin'; vault: boolean }
  | { type: 'bounce'; on: 'awning' | 'crowd'; x: number; y: number; plat: Plat | null }
  | { type: 'spring'; spring: Spring }
  | { type: 'vault'; critter: Critter }
  | { type: 'bonk'; critter: Critter }
  | { type: 'mantle' }
  | { type: 'legUp' }
  | { type: 'tile'; tile: Tile }
  | { type: 'longJump' }
  | { type: 'trunk'; y: number; solid: Solid }
  | { type: 'fall' };

const EPS = 1e-6;
const SPEC = { goose: RULES.goose, goat: RULES.goat } as const;

export class Hero {
  x = 1;
  y = 0;
  vx: number = RULES.run;
  vy = 0;
  /** the street's pace he runs toward (u/s), set by the sim (road, orchard) */
  pace: number = RULES.run;
  /** +1 running right, −1 back (the ◀ stone) */
  dir = 1;
  mode: HeroMode = 'run';
  ground = true;
  on: Solid | Plat | null = null;
  /** the wall he is touching (side +1 = on his right), in the air or pressed against on the street */
  wall: Solid | null = null;
  wallSide = 1;
  held = false;
  /** waiting on a pause stone (s so far), running back (s left), dashing (s left) */
  pauseT = -1;
  backT = 0;
  dashT = 0;
  private pauseTile: Tile | null = null;
  private buf = 0;
  private coyote = 0;
  private rising = false;
  private holdT = 0;
  private push = 0;
  airT = 0;
  private peak = 0;
  /** the spin is used this flight; a vault's flight; bonks in a row without touching the ground */
  spun = false;
  vaulting = false;
  bonks = 0;
  sliding = false;
  /** seconds on the light road (a stat and a mission) */
  roadSec = 0;

  constructor(private readonly emit: (e: HeroEvent) => void) {}

  /** A tap (pointer or key down). */
  press(w: World): void {
    this.held = true;
    if (this.mode !== 'run') return;
    if (this.ground || this.coyote > 0) { this.buf = RULES.buffer; return; }
    if (this.wall) { this.buf = RULES.buffer; return; }
    // in the air: near the ground on the way down it is a buffered jump, else a spin
    const below = w.surfaceAt(this.x, this.y + 0.01);
    if (this.vy < 0 && below !== null && this.y - below < 0.7) { this.buf = RULES.buffer; return; }
    if (!this.spun) {
      this.spun = true;
      this.vy = Math.max(this.vy, RULES.spinV);
      this.emit({ type: 'spin', vault: this.vaulting });
    } else this.buf = RULES.buffer;
  }

  release(): void { this.held = false; }

  /** Put him somewhere standing (the bubble's end, the rope's end, a new level). */
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
    this.dir = 1;
    this.backT = 0;
    this.dashT = 0;
    this.pauseT = -1;
    this.pauseTile = null;
    this.spun = false;
    this.vaulting = false;
    this.bonks = 0;
  }

  step(dt: number, w: World): void {
    if (this.mode !== 'run') return;
    const R = RULES;
    this.buf = Math.max(0, this.buf - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    if (this.backT > 0 && (this.backT -= dt) <= 0) this.dir = 1;
    if (this.dashT > 0) this.dashT -= dt;
    // the pause stone: he waits for a tap
    if (this.pauseT >= 0) {
      this.pauseT += dt;
      this.vx = 0;
      if (this.buf > 0 || this.pauseT >= R.pauseMax) {
        if (this.pauseTile) this.pauseTile.used = true;
        this.pauseTile = null;
        this.pauseT = -1;
        this.jump(R.jumpV);
      } else return;
    }
    const pace = (this.dashT > 0 ? Math.max(this.pace, R.dash) : this.pace) * this.dir;
    const dv = pace - this.vx, a = R.accel * dt * (this.dashT > 0 ? 2 : 1);
    this.vx += Math.abs(dv) <= a ? dv : Math.sign(dv) * a;
    // a tap: from the ground (a long jump on the ▶ stone), or off a wall
    if (this.buf > 0) {
      if (this.ground || this.coyote > 0) {
        const t = this.ground ? this.tileUnder(w) : null;
        if (t?.kind === 'dash') {
          this.jump(R.longV);
          this.vx = R.longVx * this.dir;
          this.dashT = Math.max(this.dashT, 0.6);
          this.emit({ type: 'longJump' });
        } else this.jump(R.jumpV);
      } else if (this.wall) {
        this.jump(R.wallV);
        this.vx = -this.wallSide * R.wallKick;
        this.emit({ type: 'wallJump' });
      }
    }
    if (this.rising) {
      this.holdT += dt;
      if (!this.held || this.holdT >= R.holdMax || this.vy <= 0) this.rising = false;
    }
    this.across(dt, w);
    const wall = this.wall;
    // a ledge within reach of the hands: up he goes
    if (wall && !this.ground && wall.top - this.y > 0 && wall.top - this.y <= (wall.kind === 'ground' ? R.rimMantle : R.mantle) && wall.kind !== 'trunk') {
      this.y = wall.top;
      this.x = this.wallSide > 0 ? wall.x0 + 0.02 : wall.x1 - 0.02;
      this.vy = 0;
      this.land(wall, w);
      this.wall = null;
      this.emit({ type: 'mantle' });
    } else if (wall && this.ground) {
      this.push += dt;
      if (this.push >= R.legUp) {
        this.push = 0;
        this.ground = false;
        this.on = null;
        this.vy = R.legUpV;
        this.airT = 0;
        this.peak = this.y;
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
      if (this.vy <= 0) {
        if (!this.bonk(w, py)) this.landing(w, py);
      }
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
    if (this.ground) {
      this.vault(w);
      this.stones(w);
    }
    if (this.ground || this.vy <= 0) this.spring(w);
    if (this.on && 'kind' in this.on && this.on.kind === 'road') this.roadSec += dt;
    if (this.y < R.fallY) this.emit({ type: 'fall' });
  }

  private across(dt: number, w: World): void {
    const R = RULES;
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
          this.mode = 'held';
          this.emit({ type: 'trunk', y: this.y, solid: s });
          return;
        }
        this.wall = s;
        this.wallSide = 1;
      } else if (this.vx < 0 && px - R.halfW >= s.x1 - EPS && this.x - R.halfW < s.x1) {
        if (this.ground && s.top - this.y <= R.stepUp) {
          this.y = s.top;
          this.on = s;
          continue;
        }
        this.x = s.x1 + R.halfW;
        this.wall = s;
        this.wallSide = -1;
      }
    }
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
    this.spun = false;
    this.vaulting = false;
    this.emit({ type: 'jump', held: this.held });
  }

  /** A bounce that is not a jump of his own (an awning, the crowd, a creature, a spring). */
  private toss(v: number): void {
    this.vy = v;
    this.ground = false;
    this.on = null;
    this.rising = false;
    this.airT = 0;
    this.peak = this.y;
    this.spun = false;
    this.vaulting = false;
  }

  /** Landing on a creature's back: a bonk (it is dizzy and waddles off, never hurt). */
  private bonk(w: World, py: number): boolean {
    const R = RULES;
    for (const c of w.critters) {
      if (c.state !== 'idle') continue;
      const sp = SPEC[c.kind], top = c.y + sp.h;
      if (Math.abs(this.x - c.x) > sp.hw + R.halfW + 0.05) continue;
      if (py >= top - 0.05 && this.y <= top + 0.02) {
        this.y = top;
        this.toss(this.held ? R.bonkHeld : R.bonkV);
        this.bonks++;
        this.emit({ type: 'bonk', critter: c });
        return true;
      }
    }
    return false;
  }

  private vault(w: World): void {
    const R = RULES;
    for (const c of w.critters) {
      if (c.state !== 'idle' || c.vaulted || Math.abs(c.y - this.y) > 0.3) continue;
      const sp = SPEC[c.kind];
      const d = (c.x - this.x) * this.dir - sp.hw - R.halfW;
      if (d > -0.2 && d <= R.vaultAhead) {
        c.vaulted = true;
        this.toss(sp.vault);
        this.vaulting = true;
        this.emit({ type: 'vault', critter: c });
        return;
      }
    }
  }

  private tileUnder(w: World): Tile | null {
    for (const t of w.tiles) if (this.x >= t.x0 - 0.1 && this.x <= t.x1 + 0.1 && Math.abs(t.y - this.y) < 0.02) return t;
    return null;
  }

  private stones(w: World): void {
    const t = this.tileUnder(w);
    if (!t || t.used) return;
    if (t.kind === 'pause' && this.x >= (t.x0 + t.x1) / 2 - 0.15) {
      this.pauseT = 0;
      this.pauseTile = t;
      this.vx = 0;
      this.x = (t.x0 + t.x1) / 2;
      this.emit({ type: 'tile', tile: t });
    } else if (t.kind === 'back') {
      t.used = true;
      this.dir = -1;
      this.backT = RULES.backSec;
      this.emit({ type: 'tile', tile: t });
    } else if (t.kind === 'dash') {
      t.used = true;
      this.dashT = RULES.dashSec;
      this.emit({ type: 'tile', tile: t });
    }
  }

  private spring(w: World): void {
    // generous: standing on it, or coming down onto it from a low hop
    for (const s of w.springs) {
      if (Math.abs(s.x - this.x) < 0.65 && this.y - s.y > -0.05 && this.y - s.y < 0.7) {
        this.toss(RULES.springV);
        s.squash = 1;
        this.emit({ type: 'spring', spring: s });
        return;
      }
    }
  }

  private landing(w: World, py: number): void {
    const R = RULES;
    const l = this.x - R.halfW + 0.02, r = this.x + R.halfW - 0.02;
    let best: Solid | Plat | null = null, top = -Infinity;
    for (const s of w.solids) {
      if (s.x1 > l && s.x0 < r && py >= s.top - 1e-4 && this.y <= s.top && s.top > top) { best = s; top = s.top; }
    }
    for (const p of w.plats) {
      if (p.x1 > l && p.x0 < r && py >= p.y - 1e-4 && this.y <= p.y && p.y > top) { best = p; top = p.y; }
    }
    if (!best) return;
    this.y = top;
    if ('squash' in best && best.kind === 'awning') {
      best.squash = 1;
      this.toss(this.held ? R.bounceHeld : R.bounceV);
      this.emit({ type: 'bounce', on: 'awning', x: this.x, y: top, plat: best });
      return;
    }
    if (!('squash' in best) && best.kind === 'crowd') {
      this.toss(this.held ? R.bounceHeld : R.bounceV);
      this.emit({ type: 'bounce', on: 'crowd', x: this.x, y: top, plat: null });
      return;
    }
    this.land(best, w);
  }

  private land(on: Solid | Plat, w: World): void {
    const air = this.airT, fall = this.peak - this.y;
    this.vy = 0;
    this.ground = true;
    this.on = on;
    this.rising = false;
    this.spun = false;
    this.vaulting = false;
    this.bonks = 0;
    if (air > 0.05) this.emit({ type: 'land', air, fall });
    this.airT = 0;
    this.peak = this.y;
    void w;
  }

  private supported(w: World): boolean {
    const l = this.x - RULES.halfW + 0.02, r = this.x + RULES.halfW - 0.02;
    for (const s of w.solids) if (s.x1 > l && s.x0 < r && Math.abs(s.top - this.y) < 1e-3) { this.on = s; return true; }
    for (const p of w.plats) if (p.x1 > l && p.x0 < r && Math.abs(p.y - this.y) < 1e-3) { this.on = p; return true; }
    return false;
  }

  /** On a surface, running (not in the air, not held by the sim). */
  get standing(): boolean { return this.mode === 'run' && this.ground; }
  get onRoad(): boolean { return !!this.on && 'squash' in this.on && this.on.kind === 'road'; }
}
