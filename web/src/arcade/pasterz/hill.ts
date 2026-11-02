/**
 * A pasture on the Judean hills, seen from above, made from a seed (the same seed makes the same
 * hill on every device): thorn bushes, rocks, dry-stone terrace walls with gaps, a stream with its
 * stepping-stone fords, the grazing groups and the lost lamb's hiding place among the rocks.  And
 * the walking rules every body on it shares: `resolve()` pushes a body out of what is solid, and
 * `walk()` slides along it, so nobody is ever stuck against a wall or a rock.
 */
import { mulberry32 } from '../../core/random';
import { RULES, span } from './rules';

export interface Circle { x: number; y: number; r: number; kind: 'rock' | 'bush'; seed: number }
/** A terrace wall: a capsule from (x0, y0) to (x1, y1), RULES.wallHalf thick. */
export interface Wall { x0: number; y0: number; x1: number; y1: number; seed: number }
export interface Ford { x: number; stones: { x: number; y: number; r: number }[] }
export interface Group { x: number; y: number; n: number }

export interface Contact { nx: number; ny: number; /** the side to slide toward when pushing straight in (+1 / −1 along (−ny, nx)) */ side: number }

const TAU = Math.PI * 2;

export class Hill {
  readonly seed: number;
  readonly w: number = RULES.mapW;
  readonly h: number = RULES.mapH;
  readonly start: { x: number; y: number };
  readonly circles: Circle[] = [];
  readonly walls: Wall[] = [];
  /** the stream's centre line: y = sy + amp × sin(x × k + ph) */
  readonly stream: { sy: number; amp: number; k: number; ph: number };
  readonly fords: Ford[] = [];
  readonly groups: Group[] = [];
  readonly lamb: { x: number; y: number };
  /** soft patches of dry earth and greener grass for the painter */
  readonly patches: { x: number; y: number; r: number; tone: number }[] = [];

  /** `sheep` = how many graze on this hill (the first group stands around the start). */
  constructor(seed: number, sheep: number) {
    this.seed = seed >>> 0;
    const rnd = mulberry32(this.seed || 1);
    const R = RULES, W = this.w, H = this.h;
    this.start = { x: W * R.startAt[0], y: H * R.startAt[1] };
    const sy = H * span(R.streamAt, rnd());
    this.stream = { sy, amp: span(R.streamAmp, rnd()), k: (TAU / W) * (1 + rnd() * 1.2), ph: rnd() * TAU };
    // fords: stepping stones across the stream at a few places
    for (let i = 0; i < R.fords; i++) {
      const x = W * ((i + 0.5) / R.fords) + (rnd() - 0.5) * W * 0.12;
      const stones: Ford['stones'] = [];
      const c = this.streamY(x);
      for (let k = -2; k <= 2; k++) stones.push({ x: x + (rnd() - 0.5) * 0.35, y: c + k * 0.55, r: 0.26 + rnd() * 0.08 });
      this.fords.push({ x, stones });
    }
    for (let i = 0; i < 26; i++) this.patches.push({ x: rnd() * W, y: rnd() * H, r: 3 + rnd() * 7, tone: rnd() });
    // the lost lamb: far from the start, in a nook of rocks open on one side
    const lamb = this.findSpot(rnd, (x, y) => Math.hypot(x - this.start.x, y - this.start.y) >= R.lambDist && Math.abs(y - this.streamY(x)) > 4, 3) ?? { x: W * 0.15, y: H * 0.9 };
    this.lamb = lamb;
    const open = rnd() * TAU;
    for (let k = 1; k <= 3; k++) {
      const a = open + (k * TAU) / 4;
      this.circles.push({ x: lamb.x + Math.cos(a) * 1.45, y: lamb.y + Math.sin(a) * 1.45, r: 0.7 + rnd() * 0.25, kind: 'rock', seed: (rnd() * 1e9) | 0 });
    }
    // terrace walls: long, gently tilted, never across the stream, never at the start
    const nT = Math.round(span(R.terraces, rnd()));
    for (let i = 0, tries = 0; i < nT && tries < 200; tries++) {
      const len = span(R.terraceLen, rnd());
      const a = (rnd() - 0.5) * 0.5;
      const cx = R.edge + 3 + rnd() * (W - 2 * R.edge - 6), cy = R.edge + 3 + rnd() * (H - 2 * R.edge - 6);
      const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
      const wall: Wall = { x0: cx - dx, y0: cy - dy, x1: cx + dx, y1: cy + dy, seed: (rnd() * 1e9) | 0 };
      if (Math.min(wall.x0, wall.x1) < R.edge + 1 || Math.max(wall.x0, wall.x1) > W - R.edge - 1) continue;
      if (segDist(this.start.x, this.start.y, wall) < R.clearStart + 2) continue;
      if (segDist(lamb.x, lamb.y, wall) < 4) continue;
      let ok = true;
      for (let s = 0; s <= 8 && ok; s++) {
        const x = wall.x0 + ((wall.x1 - wall.x0) * s) / 8, y = wall.y0 + ((wall.y1 - wall.y0) * s) / 8;
        if (Math.abs(y - this.streamY(x)) < 3.2) ok = false;
      }
      // a gap of at least 4 m to every other wall, so the flock can always pass
      for (const o of this.walls) if (ok && wallDist(wall, o) < 4) ok = false;
      if (!ok) continue;
      this.walls.push(wall);
      i++;
    }
    // rocks and thorn bushes
    const place = (n: number, kind: 'rock' | 'bush') => {
      const rr = kind === 'rock' ? R.rockR : R.bushR;
      for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
        const r = span(rr, rnd());
        const x = R.edge + r + rnd() * (W - 2 * (R.edge + r)), y = R.edge + r + rnd() * (H - 2 * (R.edge + r));
        if (Math.hypot(x - this.start.x, y - this.start.y) < R.clearStart + r) continue;
        if (Math.abs(y - this.streamY(x)) < R.streamHalf + r + 0.6) continue;
        if (this.solidNear(x, y, r + 1.6)) continue;
        this.circles.push({ x, y, r, kind, seed: (rnd() * 1e9) | 0 });
        i++;
      }
    };
    place(Math.round(span(R.rocks, rnd())), 'rock');
    place(Math.round(span(R.bushes, rnd())), 'bush');
    // the grazing groups: the first stands around the start (it joins at once), the rest spread out
    let left = Math.max(3, sheep);
    const first = Math.min(left, 3);
    this.groups.push({ x: this.start.x, y: this.start.y, n: first });
    left -= first;
    // the second grazes just down the slope: the first steps of any walk south find it
    if (left > 0) {
      const n = Math.min(left, 5);
      const g = this.freeNear(this.start.x + (rnd() - 0.5) * 2, this.start.y + 7.5, RULES.grazeR + 0.4);
      this.groups.push({ x: g.x, y: g.y, n });
      left -= n;
    }
    while (left > 0) {
      const n = Math.min(left, Math.round(span(RULES.group, rnd())));
      const g = this.findSpot(rnd, (x, y) => {
        if (Math.hypot(x - this.start.x, y - this.start.y) < 8) return false;
        if (Math.hypot(x - lamb.x, y - lamb.y) < 5) return false;
        if (Math.abs(y - this.streamY(x)) < 3) return false;
        return this.groups.every(o => Math.hypot(o.x - x, o.y - y) >= 6.5);
      }, RULES.grazeR + 0.8) ?? this.findSpot(rnd, () => true, RULES.grazeR) ?? { x: this.start.x, y: this.start.y + 10 };
      this.groups.push({ x: g.x, y: g.y, n });
      left -= n;
    }
  }

  /** The stream's centre line at x. */
  streamY(x: number): number { return this.stream.sy + this.stream.amp * Math.sin(x * this.stream.k + this.stream.ph); }

  /** In the water (and not on a ford's stones): walking is slower there. */
  wading(x: number, y: number): boolean {
    if (Math.abs(y - this.streamY(x)) > RULES.streamHalf) return false;
    for (const f of this.fords) if (Math.abs(x - f.x) < 0.7) return false;
    return true;
  }

  /** Anything solid within `d` of (x, y). */
  solidNear(x: number, y: number, d: number): boolean {
    for (const c of this.circles) if (Math.hypot(c.x - x, c.y - y) < c.r + d) return true;
    for (const w of this.walls) if (segDist(x, y, w) < RULES.wallHalf + d) return true;
    return false;
  }

  /** A random spot that passes `ok`, clear of everything solid by `clear` (null: none found). */
  findSpot(rnd: () => number, ok: (x: number, y: number) => boolean, clear: number): { x: number; y: number } | null {
    const m = RULES.edge + clear + 1;
    for (let i = 0; i < 300; i++) {
      const x = m + rnd() * (this.w - 2 * m), y = m + rnd() * (this.h - 2 * m);
      if (ok(x, y) && !this.solidNear(x, y, clear)) return { x, y };
    }
    return null;
  }

  /**
   * The free spot nearest to (x, y) with `clear` m around it (searched in rings), kept inside the
   * map, and passing `ok` when given.
   */
  freeNear(x: number, y: number, clear: number, ok?: (x: number, y: number) => boolean): { x: number; y: number } {
    const m = RULES.edge + clear;
    const inside = (px: number, py: number) => ({ x: Math.min(this.w - m, Math.max(m, px)), y: Math.min(this.h - m, Math.max(m, py)) });
    const good = (p: { x: number; y: number }, water: number) =>
      !this.solidNear(p.x, p.y, clear) && Math.abs(p.y - this.streamY(p.x)) > water && (!ok || ok(p.x, p.y));
    const p0 = inside(x, y);
    if (good(p0, RULES.streamHalf)) return p0;
    for (let r = 0.5; r < 40; r += 0.5) {
      const n = Math.max(8, Math.round(r * 6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const p = inside(x + Math.cos(a) * r, y + Math.sin(a) * r);
        if (good(p, RULES.streamHalf + clear * 0.5)) return p;
      }
    }
    return p0;
  }

  /**
   * Push a body of radius `r` at (x, y) out of rocks, bushes, walls and the map's edge.  Returns the
   * position (in `out`) and the last contact's normal, or null when nothing was touched.
   */
  resolve(out: { x: number; y: number }, r: number): Contact | null {
    let hit: Contact | null = null;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.circles) {
        const dx = out.x - c.x, dy = out.y - c.y, d = Math.hypot(dx, dy), min = c.r + r;
        if (d >= min) continue;
        const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
        out.x = c.x + nx * min;
        out.y = c.y + ny * min;
        hit = { nx, ny, side: (c.seed & 1) ? 1 : -1 };
      }
      for (const w of this.walls) {
        const q = closest(out.x, out.y, w);
        const dx = out.x - q.x, dy = out.y - q.y, d = Math.hypot(dx, dy), min = RULES.wallHalf + r;
        if (d >= min) continue;
        const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1;
        out.x = q.x + nx * min;
        out.y = q.y + ny * min;
        // straight in: slide toward the nearer end of the wall
        const tx = -ny, ty = nx;
        const toEnd1 = (w.x1 - q.x) * tx + (w.y1 - q.y) * ty, toEnd0 = (w.x0 - q.x) * tx + (w.y0 - q.y) * ty;
        hit = { nx, ny, side: Math.abs(toEnd1) < Math.abs(toEnd0) ? Math.sign(toEnd1) || 1 : Math.sign(toEnd0) || -1 };
      }
    }
    const m = RULES.edge * 0.5 + r;
    out.x = Math.min(this.w - m, Math.max(m, out.x));
    out.y = Math.min(this.h - m, Math.max(m, out.y));
    return hit;
  }

  /**
   * Move a body from (x, y) by (dx, dy), sliding along whatever it touches: a push straight into a
   * wall or a rock turns along it (toward the nearer end), so walking never ends against an obstacle.
   */
  walk(pos: { x: number; y: number }, dx: number, dy: number, r: number): void {
    const want = Math.hypot(dx, dy);
    const x0 = pos.x, y0 = pos.y;
    pos.x += dx;
    pos.y += dy;
    const hit = this.resolve(pos, r);
    if (!hit || want < 1e-4) return;
    const moved = Math.hypot(pos.x - x0, pos.y - y0);
    if (moved >= want * 0.45) return;
    // blocked: slide along the contact's tangent
    const tx = -hit.ny, ty = hit.nx;
    const along = (dx * tx + dy * ty) / want;
    const side = Math.abs(along) > 0.08 ? Math.sign(along) : hit.side;
    pos.x = x0 + tx * side * want * 0.85;
    pos.y = y0 + ty * side * want * 0.85;
    this.resolve(pos, r);
  }
}

/** The point of a wall's centre line closest to (x, y). */
function closest(x: number, y: number, w: Wall): { x: number; y: number } {
  const vx = w.x1 - w.x0, vy = w.y1 - w.y0;
  const l2 = vx * vx + vy * vy;
  const k = l2 > 0 ? Math.min(1, Math.max(0, ((x - w.x0) * vx + (y - w.y0) * vy) / l2)) : 0;
  return { x: w.x0 + vx * k, y: w.y0 + vy * k };
}

export function segDist(x: number, y: number, w: Wall): number {
  const q = closest(x, y, w);
  return Math.hypot(x - q.x, y - q.y);
}

/** The least distance between two walls' centre lines (sampled along the first: crossings read as 0). */
function wallDist(a: Wall, b: Wall): number {
  let d = Math.min(segDist(b.x0, b.y0, a), segDist(b.x1, b.y1, a));
  for (let s = 0; s <= 16; s++) d = Math.min(d, segDist(a.x0 + ((a.x1 - a.x0) * s) / 16, a.y0 + ((a.y1 - a.y0) * s) / 16, b));
  return d;
}
