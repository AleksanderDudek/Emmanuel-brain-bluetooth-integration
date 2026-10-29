/**
 * Urodzaj's circle world: the fruit in the woven basket, position-based and robust for stacking.
 *
 * Units are W (the basket's inner width at the rim); y points up and the floor is y = 0.  The walls
 * are two straight lines from (±0.42, 0) to (±0.50, 1.00), carried on above the rim so a heap that
 * rises over it stays in the basket (the overflow rule decides what spills, sim.ts).
 *
 * The fruit are discs that roll.  Each fixed step of 1/120 s integrates gravity and damping, then
 * solves 8 iterations of walls and contacts from the floor up: a touching pair is pushed apart along
 * its centres (mass ∝ r², every correction capped at 0.02 W, so a growing merge eases its neighbours
 * aside instead of blowing them apart), and the slip of their surfaces is held inside the friction
 * cone — split between moving and turning, so a fruit balanced on another rolls off instead of
 * standing as a tower.  Then positions turn back into velocities, with Coulomb friction and
 * restitution per contact (the XPBD velocity pass).  A fruit that rests on two supports (or the floor)
 * sleeps until the heap changes around it, so a still basket stays still.  Alike fruit that touch
 * merge into the next tier at their midpoint, one merge per body per step; the new fruit's radius
 * grows over 0.12 s.
 *
 * Kinematic bodies (a fruit the vine or the dew is pulling) collide with nothing: the sim moves them.
 * The same inputs at the same frames give the same basket: every step is fixed and the order of work
 * is stable (ids break ties), so tests and the day's shared drops can rely on it.
 */
import { FRUITS, MAX_TIER } from './content';

export const PHYS = {
  step: 1 / 120,
  iterations: 8,
  maxSteps: 6,
  gravity: 3.2,
  restitution: 0.18,
  friction: 0.42,
  damping: 0.6,
  /** rolling slows a little faster than sliding, so a lone fruit on the floor comes to rest */
  spinDamping: 1.2,
  maxBodies: 60,
  grow: 0.12,
  cap: 0.02,
  /** restitution applies only to contacts approaching faster than this (W/s) */
  bounceMin: 0.1,
  /** slower bodies in contact stop (W/s, also at the rim of a turning fruit) */
  zeroSpeed: 0.01,
  /** "resting": slower than restSpeed for restSec */
  restSpeed: 0.02,
  restSec: 0.5,
  /** alike fruit this close count as touching */
  touch: 0.002,
  /** pairs this close are checked during a step */
  margin: 0.02,
} as const;

/** The basket in W: floor and rim half-widths, the rim's height, the drawn wall, the hanging fruit's line. */
export const BASKET = { floor: 0.42, rimHalf: 0.5, rim: 1, wall: 0.035, hang: 1.16 } as const;

const SLANT = (BASKET.rimHalf - BASKET.floor) / BASKET.rim;
const WALL_LEN = Math.hypot(SLANT, 1);
/** the left wall's inward normal; the right wall mirrors its x */
const NX = 1 / WALL_LEN;
const NY = SLANT / WALL_LEN;

/** The basket's inner half-width at height y. */
export const halfWidthAt = (y: number): number => BASKET.floor + SLANT * Math.max(0, y);

export interface Body {
  readonly id: number;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** the turn (rad, counter-clockwise in the world's y-up frame: the canvas draws −angle) and its rate */
  angle: number;
  spin: number;
  /** the radius now (it grows after a merge) and the tier's own */
  r: number;
  r1: number;
  /** a pull moves it: no gravity, no contacts */
  kinematic: boolean;
  /** world time it was made, and of its first contact (−1: none yet) */
  readonly born: number;
  touched: number;
  /** seconds slower than restSpeed, and the resting flag */
  restT: number;
  resting: boolean;
  /** resting on two supports or the floor: no gravity until something moves it or the heap changes */
  sleeping: boolean;
  /** the heap changed around it: one step of gravity tells whether it still has support */
  woke: boolean;
  /** it touched something during the last step, and how many things */
  contact: boolean;
  touches: number;
  floor: boolean;
  /** merged away (or taken out) */
  dead: boolean;
  // solver scratch
  px: number;
  py: number;
  pa: number;
  vxPre: number;
  vyPre: number;
  r0: number;
  growT: number;
  inv: number;
  /** 1 / moment of inertia (a disc: ½ m r², m ∝ r²) */
  invI: number;
  /** accumulated wall corrections this step: floor, left, right */
  lf: number;
  ll: number;
  lr: number;
}

export interface Merge {
  body: Body;
  tier: number;
  x: number;
  y: number;
  t: number;
  /** a pull ended in it (the gather's vine, the dew's bridge), else two fruit met */
  pulled: boolean;
}

export interface Landing { body: Body; speed: number }

/** An alike pair (the vine and the dew): `gap` = centre distance − both radii (W). */
export interface Pair { a: Body; b: Body; gap: number; r: number }

interface Contact { a: Body; b: Body; nx: number; ny: number; lambda: number }

const ease = (k: number) => 1 - (1 - k) ** 3;
/** Asleep this step: a resting, held fruit nothing has woken. */
const asleep = (b: Body) => b.sleeping && !b.woke;
/** Contacts closer than this count as touching for a sleeping fruit (W). */
const NEAR = 1e-4;
const byLeftEdge = (a: Body, b: Body) => a.x - a.r - (b.x - b.r) || a.id - b.id;
const byHeight = (a: Body, b: Body) => a.y - b.y || a.id - b.id;
const lowerPair = (p: Contact, q: Contact) => Math.min(p.a.y, p.b.y) - Math.min(q.a.y, q.b.y) || p.a.id - q.a.id || p.b.id - q.b.id;

/**
 * Hold the surfaces where they touched: the slip along the tangent t = (−ny, nx) since the step
 * began, of a against b (b null: a wall), is undone by moving and turning both — if it lies inside
 * the friction cone of the normal correction λ.  Rolling costs no slip, so a fruit can roll.
 */
function stick(a: Body, b: Body | null, nx: number, ny: number, lambda: number, mu: number): void {
  const tx = -ny, ty = nx;
  let slip = (a.x - a.px) * tx + (a.y - a.py) * ty - (a.angle - a.pa) * a.r;
  const wa = a.inv, ia = a.invI * a.r * a.r;
  let wn = wa, wt = wa + ia;
  if (b) {
    slip -= (b.x - b.px) * tx + (b.y - b.py) * ty + (b.angle - b.pa) * b.r;
    wn += b.inv;
    wt += b.inv + b.invI * b.r * b.r;
  }
  if (Math.abs(slip) / wt >= (mu * lambda) / wn) return;
  const P = -slip / wt;
  a.x += P * wa * tx;
  a.y += P * wa * ty;
  a.angle -= a.invI * a.r * P;
  if (b) {
    b.x -= P * b.inv * tx;
    b.y -= P * b.inv * ty;
    b.angle -= b.invI * b.r * P;
  }
}

/** The velocity pass of one contact: Coulomb friction on the surfaces' relative slip, then restitution along the normal. */
function settleContact(a: Body, b: Body | null, nx: number, ny: number, lambda: number, mu: number, bounce: number, h: number): void {
  const tx = -ny, ty = nx;
  const wa = a.inv, wb = b ? b.inv : 0;
  const wn = wa + wb;
  const wt = wn + a.invI * a.r * a.r + (b ? b.invI * b.r * b.r : 0);
  // friction: the impulse that would stop the slip, at most μ times the normal one
  let vt = a.vx * tx + a.vy * ty - a.spin * a.r;
  if (b) vt -= b.vx * tx + b.vy * ty + b.spin * b.r;
  const pMax = (mu * lambda) / h / wn;
  const P = Math.max(-pMax, Math.min(pMax, -vt / wt));
  a.vx += P * wa * tx;
  a.vy += P * wa * ty;
  a.spin -= a.invI * a.r * P;
  if (b) {
    b.vx -= P * wb * tx;
    b.vy -= P * wb * ty;
    b.spin -= b.invI * b.r * P;
  }
  // restitution from the speed it came in with: only a real impact bounces, and the separation the
  // position correction itself made is taken back, so a heap does not breathe
  const now = (a.vx - (b ? b.vx : 0)) * nx + (a.vy - (b ? b.vy : 0)) * ny;
  const pre = (a.vxPre - (b ? b.vxPre : 0)) * nx + (a.vyPre - (b ? b.vyPre : 0)) * ny;
  const want = pre < -PHYS.bounceMin ? -bounce * pre : 0;
  const dn = (want - now) / wn;
  a.vx += nx * dn * wa;
  a.vy += ny * dn * wa;
  if (b) {
    b.vx -= nx * dn * wb;
    b.vy -= ny * dn * wb;
  }
}

export class World {
  readonly bodies: Body[] = [];
  /** world time (s), advanced in fixed steps */
  t = 0;
  private acc = 0;
  private ids = 0;
  /** the dew's settle: friction and gravity scales, restitution (set through settle()) */
  muScale = 1;
  gScale = 1;
  bounce: number = PHYS.restitution;
  /** what happened since the sim last drained them */
  readonly merges: Merge[] = [];
  readonly landings: Landing[] = [];
  private readonly byX: Body[] = [];
  private readonly byY: Body[] = [];
  /** contact records, reused step after step; `active` holds this step's, from the floor up */
  private readonly pool: Contact[] = [];
  private readonly active: Contact[] = [];

  get count(): number { return this.bodies.length; }

  add(tier: number, x: number, y: number, r0?: number): Body {
    const r1 = FRUITS[tier - 1].r;
    const r = r0 ?? r1;
    const b: Body = {
      id: ++this.ids, tier, x, y, vx: 0, vy: 0, angle: 0, spin: 0, r, r1, kinematic: false, born: this.t, touched: -1,
      restT: 0, resting: false, sleeping: false, woke: false, contact: false, touches: 0, floor: false, dead: false,
      px: x, py: y, pa: 0, vxPre: 0, vyPre: 0, r0: r, growT: r0 !== undefined && r0 !== r1 ? PHYS.grow : 0,
      inv: 1 / (r * r), invI: 2 / (r * r * r * r), lf: 0, ll: 0, lr: 0,
    };
    this.bodies.push(b);
    return b;
  }

  remove(b: Body): void {
    b.dead = true;
    this.compact();
    this.wake();
  }

  clear(): void {
    for (const b of this.bodies) b.dead = true;
    this.bodies.length = 0;
    this.merges.length = 0;
    this.landings.length = 0;
  }

  has(b: Body | null | undefined): b is Body { return !!b && !b.dead; }

  /**
   * The heap changed (a merge, a fruit taken out, the dew's settle): every sleeping fruit feels gravity
   * for a step — one that lost its support falls (and stops resting), one still held goes back to sleep.
   */
  wake(): void {
    for (const b of this.bodies) b.woke = true;
  }

  /** The dew's settle (or back to normal): friction and gravity scales and the restitution. */
  settle(muScale: number, gScale: number, bounce: number): void {
    if (muScale === this.muScale && gScale === this.gScale && bounce === this.bounce) return;
    this.muScale = muScale;
    this.gScale = gScale;
    this.bounce = bounce;
    this.wake();
  }

  /** Run the fixed steps due after `dt` of real time (at most PHYS.maxSteps). */
  advance(dt: number): number {
    this.acc = Math.min(this.acc + Math.max(0, dt), PHYS.step * PHYS.maxSteps);
    let n = 0;
    while (this.acc >= PHYS.step - 1e-9) {
      this.acc -= PHYS.step;
      this.stepOnce();
      n++;
    }
    return n;
  }

  /** One fixed step (tests drive it directly). */
  stepOnce(): void {
    const h = PHYS.step;
    this.t += h;
    const g = PHYS.gravity * this.gScale;
    const damp = 1 - PHYS.damping * h, spinDamp = 1 - PHYS.spinDamping * h;
    for (const b of this.bodies) {
      b.contact = false;
      b.touches = 0;
      b.floor = false;
      b.lf = b.ll = b.lr = 0;
      if (b.growT > 0) {
        b.growT = Math.max(0, b.growT - h);
        b.r = b.r0 + (b.r1 - b.r0) * ease(1 - b.growT / PHYS.grow);
      }
      b.inv = 1 / (b.r * b.r);
      b.invI = 2 * b.inv / (b.r * b.r);
      b.px = b.x;
      b.py = b.y;
      b.pa = b.angle;
      b.vxPre = b.vyPre = 0;
      if (b.kinematic || (b.sleeping && !b.woke)) continue;
      b.vy -= g * h;
      b.vx *= damp;
      b.vy *= damp;
      b.spin *= spinDamp;
      b.vxPre = b.vx;
      b.vyPre = b.vy;
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.angle += b.spin * h;
    }
    this.broadphase();
    const mu = PHYS.friction * this.muScale;
    for (let it = 0; it < PHYS.iterations; it++) {
      for (const b of this.byY) this.walls(b, mu);
      for (const c of this.active) this.solve(c, mu);
    }
    this.velocities(h, mu);
    this.mergeTouching();
  }

  // ── the solver ─────────────────────────────────────────────────
  /** Candidate pairs (sweep and prune on x), ordered from the floor up; bodies by height too. */
  private broadphase(): void {
    const byX = this.byX, byY = this.byY;
    byX.length = 0;
    byY.length = 0;
    for (const b of this.bodies) if (!b.kinematic) { byX.push(b); byY.push(b); }
    byX.sort(byLeftEdge);
    byY.sort(byHeight);
    const active = this.active;
    active.length = 0;
    const m = PHYS.margin;
    for (let i = 0; i < byX.length; i++) {
      const a = byX[i];
      const right = a.x + a.r + m;
      for (let j = i + 1; j < byX.length; j++) {
        const b = byX[j];
        if (b.x - b.r > right) break;
        const rr = a.r + b.r + m;
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        let c = this.pool[active.length];
        if (!c) this.pool.push(c = { a, b, nx: 0, ny: 1, lambda: 0 });
        c.a = a.id < b.id ? a : b;
        c.b = a.id < b.id ? b : a;
        c.nx = 0;
        c.ny = 1;
        c.lambda = 0;
        active.push(c);
      }
    }
    // floor-up: the lower pair first (ties by ids, so the order never depends on the sort's whims)
    active.sort(lowerPair);
  }

  private walls(b: Body, mu: number): void {
    if (asleep(b)) return;   // a sleeping heap is not solved: it would only drift on its leftovers
    const r = b.r, cap = PHYS.cap;
    if (b.y < r) {
      const d = Math.min(r - b.y, cap);
      b.y += d;
      b.lf += d;
      stick(b, null, 0, 1, b.lf, mu);
    }
    let s = (b.x + BASKET.floor) * NX + b.y * NY;
    if (s < r) {
      const d = Math.min(r - s, cap);
      b.x += NX * d;
      b.y += NY * d;
      b.ll += d;
      stick(b, null, NX, NY, b.ll, mu);
    }
    s = (BASKET.floor - b.x) * NX + b.y * NY;
    if (s < r) {
      const d = Math.min(r - s, cap);
      b.x -= NX * d;
      b.y += NY * d;
      b.lr += d;
      stick(b, null, -NX, NY, b.lr, mu);
    }
  }

  /** Push a touching pair apart along their centres, then hold their surfaces where they touched (inside the cone). */
  private solve(c: Contact, mu: number): void {
    const a = c.a, b = c.b;
    if (asleep(a) && asleep(b)) return;
    const dx = a.x - b.x, dy = a.y - b.y;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    // a moving fruit presses on a sleeping one: it wakes and passes the push on to what it rests on
    a.woke ||= a.sleeping;
    b.woke ||= b.sleeping;
    const d = Math.sqrt(d2);
    const nx = d > 1e-9 ? dx / d : 0, ny = d > 1e-9 ? dy / d : 1;
    const pen = Math.min(rr - d, PHYS.cap);
    const wa = a.inv, wb = b.inv, k = pen / (wa + wb);
    a.x += nx * k * wa;
    a.y += ny * k * wa;
    b.x -= nx * k * wb;
    b.y -= ny * k * wb;
    c.nx = nx;
    c.ny = ny;
    c.lambda += pen;
    stick(a, b, nx, ny, c.lambda, mu);
  }

  /** Positions and turns back into velocities, then each contact's friction and restitution; rest and sleep. */
  private velocities(h: number, mu: number): void {
    for (const b of this.bodies) {
      if (b.kinematic) continue;
      b.vx = (b.x - b.px) / h;
      b.vy = (b.y - b.py) / h;
      b.spin = (b.angle - b.pa) / h;
    }
    for (const c of this.active) {
      const a = c.a, b = c.b;
      if (c.lambda <= 0) {
        // two sleeping fruit still lean on each other: their support counts, nothing moves
        if (asleep(a) && asleep(b) && Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + NEAR) {
          this.touchOf(a);
          this.touchOf(b);
        }
        continue;
      }
      this.touchOf(a);
      this.touchOf(b);
      settleContact(a, b, c.nx, c.ny, c.lambda, mu, this.bounce, h);
    }
    for (const b of this.bodies) {
      if (b.kinematic) continue;
      if (asleep(b)) {
        if (b.y - b.r <= NEAR) {
          b.floor = true;
          this.touchOf(b);
        }
        if ((b.x + BASKET.floor) * NX + b.y * NY - b.r <= NEAR) this.touchOf(b);
        if ((BASKET.floor - b.x) * NX + b.y * NY - b.r <= NEAR) this.touchOf(b);
      }
      if (b.lf > 0) {
        b.floor = true;
        this.touchOf(b);
        settleContact(b, null, 0, 1, b.lf, mu, this.bounce, h);
      }
      if (b.ll > 0) {
        this.touchOf(b);
        settleContact(b, null, NX, NY, b.ll, mu, this.bounce, h);
      }
      if (b.lr > 0) {
        this.touchOf(b);
        settleContact(b, null, -NX, NY, b.lr, mu, this.bounce, h);
      }
      // a supported fruit that barely moves stops; one on a single fruit keeps rolling until it finds a seat
      const speed = Math.hypot(b.vx, b.vy), rim = Math.abs(b.spin) * b.r;
      const held = b.floor || b.touches >= 2;
      if (held && speed < PHYS.zeroSpeed && rim < PHYS.zeroSpeed) {
        b.vx = b.vy = b.spin = 0;
      }
      if (speed < PHYS.restSpeed && rim < PHYS.restSpeed) b.restT += h;
      else b.restT = 0;
      b.resting = b.restT >= PHYS.restSec;
      // a fruit on a single fruit would roll off: only one held from two sides (or lying on the floor) sleeps
      b.sleeping = b.resting && held;
      b.woke = false;
    }
  }

  private touchOf(b: Body): void {
    b.contact = true;
    b.touches++;
    if (b.touched >= 0) return;
    b.touched = this.t;
    this.landings.push({ body: b, speed: Math.hypot(b.vxPre, b.vyPre) });
  }

  /** Alike fruit (up to the bunch) that touch become the next tier, one merge per body per step. */
  private mergeTouching(): void {
    let any = false;
    for (const c of this.active) {
      const a = c.a, b = c.b;
      if (a.dead || b.dead || a.tier !== b.tier || a.tier >= MAX_TIER) continue;
      const rr = a.r + b.r + PHYS.touch;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.join(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2, false);
      any = true;
    }
    if (any) this.compact();
  }

  /**
   * Merge `a` and `b` into the next tier at (x, y): it starts at the larger parent's size and grows
   * to its own, with half their mean velocity.  The sim calls it when a pull arrives (at the partner).
   */
  join(a: Body, b: Body, x: number, y: number, pulled: boolean): Body {
    a.dead = b.dead = true;
    this.wake();
    const nb = this.add(Math.min(MAX_TIER, a.tier + 1), x, y, Math.max(a.r, b.r));
    nb.vx = (a.vx + b.vx) * 0.25;
    nb.vy = (a.vy + b.vy) * 0.25;
    nb.spin = (a.spin + b.spin) * 0.25;
    nb.angle = b.angle;
    nb.touched = this.t;
    this.merges.push({ body: nb, tier: nb.tier, x, y, t: this.t, pulled });
    return nb;
  }

  /** Merge a pulled fruit into its partner, in the partner's place. */
  joinAt(a: Body, b: Body): Body {
    const nb = this.join(a, b, b.x, b.y, true);
    this.compact();
    return nb;
  }

  private compact(): void {
    let n = 0;
    for (const b of this.bodies) if (!b.dead) this.bodies[n++] = b;
    this.bodies.length = n;
  }

  /** Move a body sideways without giving it speed (the dew's jiggle); the solver settles it. */
  nudge(b: Body, dx: number): void {
    b.x += dx;
    b.px += dx;
    b.woke = true;
  }

  // ── queries ────────────────────────────────────────────────────
  /** The highest point of the heap (W): the top of its highest fruit, 0 when empty. */
  heapTop(): number {
    let top = 0;
    for (const b of this.bodies) if (!b.kinematic) top = Math.max(top, b.y + b.r);
    return top;
  }

  /** Where a fruit of radius `r` dropped at `x` would first touch (its centre's height): a body, a wall or the floor. */
  dropY(x: number, r: number): number {
    // a wall: the height below which the centre at x would be closer than r to it
    let y = Math.max(r, (r - (x + BASKET.floor) * NX) / NY, (r - (BASKET.floor - x) * NX) / NY);
    for (const b of this.bodies) {
      if (b.kinematic) continue;
      const R = b.r + r, dx = b.x - x;
      if (Math.abs(dx) >= R) continue;
      y = Math.max(y, b.y + Math.sqrt(R * R - dx * dx));
    }
    return y;
  }

  /**
   * Alike pairs (tiers 1–8) not yet touching, nearest first, at most `limit`: within `maxGap` × r
   * (r the pair's radius, at least `minR`),
   * optionally only resting fruit, only slow ones, and only with a clear line between them (no third
   * fruit within `clear` of its own radius of the gap).
   */
  pairs(out: Pair[], o: { maxGap: number; limit: number; clear?: number; resting?: boolean; maxSpeed?: number; minR?: number }): Pair[] {
    out.length = 0;
    const list = this.bodies;
    const ok = (b: Body) => !b.kinematic && !b.dead && b.tier < MAX_TIER && (!o.resting || b.resting)
      && (o.maxSpeed === undefined || Math.hypot(b.vx, b.vy) <= o.maxSpeed);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!ok(a)) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.tier !== a.tier || !ok(b)) continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
        const r = Math.max(a.r1, o.minR ?? 0);
        if (gap < 0 || gap > o.maxGap * r) continue;
        if (o.clear !== undefined && this.blocked(a, b, o.clear)) continue;
        out.push({ a, b, gap, r });
      }
    }
    out.sort((p, q) => p.gap - q.gap || p.a.id - q.a.id || p.b.id - q.b.id);
    if (out.length > o.limit) out.length = o.limit;
    return out;
  }

  /** Whether a third fruit stands in the gap between `a` and `b` (its centre within `k` of its radius of the gap's segment). */
  private blocked(a: Body, b: Body, k: number): boolean {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-9;
    const ux = dx / d, uy = dy / d;
    const x0 = a.x + ux * a.r, y0 = a.y + uy * a.r;
    const len = Math.max(0, d - a.r - b.r);
    for (const c of this.bodies) {
      if (c === a || c === b || c.kinematic || c.dead) continue;
      const along = Math.max(0, Math.min(len, (c.x - x0) * ux + (c.y - y0) * uy));
      const qx = x0 + ux * along, qy = y0 + uy * along;
      if (Math.hypot(c.x - qx, c.y - qy) < k * c.r) return true;
    }
    return false;
  }

  /** Kinetic energy per unit mass, summed (a heap at rest has next to none). */
  energy(): number {
    let e = 0;
    for (const b of this.bodies) if (!b.kinematic) e += 0.5 * (b.vx * b.vx + b.vy * b.vy) + 0.25 * (b.spin * b.r) ** 2;
    return e;
  }
}
