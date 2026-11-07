/**
 * One hill of Pasterz, seeded and pure (no DOM): the river with its bridges, the dry-stone pens
 * with their gates (Crowd City's plazas: the pens are full of loose sheep), rocks, olive trees and
 * thorn bushes; where the loose sheep graze, where the shepherds start, where the lost lamb hides.
 * It also answers the bodies' questions: push a body out of what is solid, and "the next point
 * on the way" (a bridge, a pen's gate) when the straight line would cross the river or a wall.
 */
import { mulberry32 } from '../../core/random';
import type { HillDef } from './content';
import { RULES, span } from './rules';

export interface Circle { x: number; y: number; r: number; seed: number }
export interface Pen { x: number; y: number; r: number; gate: number }
export interface Bridge { u: number }
export interface Group { x: number; y: number; n: number; pen: number }

const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class World {
  readonly w = RULES.mapW;
  readonly h = RULES.mapH;
  readonly rocks: Circle[] = [];
  readonly trees: Circle[] = [];
  readonly bushes: Circle[] = [];
  readonly pens: Pen[] = [];
  readonly bridges: Bridge[] = [];
  readonly groups: Group[] = [];
  /** the river: along y ('v': x = c + A sin(k y + φ)) or along x ('h'), or none */
  readonly river: HillDef['river'];
  private rc = 0;
  private ra = 0;
  private rk = 0;
  private rp = 0;
  /** where the shepherds start: [0] is the player's */
  readonly starts: { x: number; y: number }[] = [];
  readonly lamb: { x: number; y: number };

  constructor(readonly seed: number, readonly def: HillDef, rivals: number) {
    const rnd = mulberry32(seed ^ 0x51ed270b);
    const R = RULES, W = this.w, H = this.h;
    this.river = def.river;
    if (this.river !== 'none') {
      const len = this.river === 'v' ? W : H;
      this.rc = len * (0.38 + rnd() * 0.24);
      this.ra = span(R.riverAmp, rnd());
      this.rk = TAU / span(R.riverWave, rnd());
      this.rp = rnd() * TAU;
      const along = this.river === 'v' ? H : W;
      const n = Math.max(1, def.bridges);
      for (let i = 0; i < n; i++) this.bridges.push({ u: along * ((i + 0.5 + (rnd() - 0.5) * 0.4) / n) });
    }
    // the player starts near the middle, on the bigger side of the river; the rivals around the map
    const cx = W * (0.42 + rnd() * 0.16), cy = H * (0.42 + rnd() * 0.16);
    const p0 = this.dry(cx, cy, 3);
    this.starts.push(p0);
    for (let i = 0; i < rivals; i++) {
      const a = (i / rivals) * TAU + rnd() * 0.6;
      const d = Math.min(W, H) * (0.3 + rnd() * 0.12);
      this.starts.push(this.dry(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d, 3));
    }
    const clear = (x: number, y: number, r: number) => this.starts.every(s => Math.hypot(x - s.x, y - s.y) > r + 4);
    // the pens
    for (let i = 0, tries = 0; i < def.pens && tries < 80; tries++) {
      const r = span(R.penR, rnd());
      const x = R.edge + r + 2 + rnd() * (W - 2 * (R.edge + r + 2)), y = R.edge + r + 2 + rnd() * (H - 2 * (R.edge + r + 2));
      if (!clear(x, y, r) || this.wet(x, y, r + 2) || this.pens.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r + 6)) continue;
      // the gate faces the middle of the map, give or take
      const gate = Math.atan2(H / 2 - y, W / 2 - x) + (rnd() - 0.5) * 1.6;
      this.pens.push({ x, y, r, gate });
      i++;
    }
    // things that stand
    const place = (list: Circle[], n: number, rr: readonly [number, number] | number, room: number) => {
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
        const r = typeof rr === 'number' ? rr : span(rr, rnd());
        const x = R.edge + 1 + rnd() * (W - 2 * R.edge - 2), y = R.edge + 1 + rnd() * (H - 2 * R.edge - 2);
        if (!clear(x, y, r) || this.wet(x, y, r + 0.8) || this.inPen(x, y, r + 1.5) >= 0 || this.solid(x, y, r + room)) continue;
        list.push({ x, y, r, seed: Math.floor(rnd() * 1e6) });
        i++;
      }
    };
    place(this.trees, Math.round(span(R.trees, def.trees)), R.treeR, 2.6);
    place(this.rocks, Math.round(span(R.rocks, def.rocks)), R.rockR, 1.6);
    place(this.bushes, Math.round(span(R.bushes, rnd())), R.bushR, 1.4);
    // the loose sheep: one small group right by the player's start (they join at once), the pens full, groups over the hill
    this.groups.push({ x: p0.x + 1.6, y: p0.y + 1.2, n: 4, pen: -1 });
    this.pens.forEach((p, i) => this.groups.push({ x: p.x, y: p.y, n: Math.round(span(R.penSheep, rnd())), pen: i }));
    const n = Math.round(span(R.groups, rnd()));
    for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
      const x = R.edge + 3 + rnd() * (W - 2 * R.edge - 6), y = R.edge + 3 + rnd() * (H - 2 * R.edge - 6);
      if (this.wet(x, y, 2) || this.inPen(x, y, 2) >= 0 || this.solid(x, y, 1.2) || Math.hypot(x - p0.x, y - p0.y) < 6) continue;
      this.groups.push({ x, y, n: Math.round(span(R.group, rnd())), pen: -1 });
      i++;
    }
    // the lost lamb: far from the start, by a bush or a rock if it can
    let best = { x: W * 0.1, y: H * 0.1, d: -1 };
    for (let i = 0; i < 40; i++) {
      const x = R.edge + 2 + rnd() * (W - 2 * R.edge - 4), y = R.edge + 2 + rnd() * (H - 2 * R.edge - 4);
      if (this.wet(x, y, 1.5) || this.inPen(x, y, 1) >= 0 || this.solid(x, y, 0.8)) continue;
      const d = Math.hypot(x - p0.x, y - p0.y);
      if (d >= R.lambDist && rnd() < 0.5) { best = { x, y, d }; break; }
      if (d > best.d) best = { x, y, d };
    }
    this.lamb = { x: best.x, y: best.y };
  }

  // ── the river ──────────────────────────────────────────────────
  /** the river's centre line across at `u` (along the river) */
  riverAt(u: number): number { return this.rc + this.ra * Math.sin(this.rk * u + this.rp); }
  /** (along, across) of a point, for the river's axis */
  private ua(x: number, y: number): [number, number] { return this.river === 'v' ? [y, x] : [x, y]; }
  private xy(u: number, a: number): { x: number; y: number } { return this.river === 'v' ? { x: a, y: u } : { x: u, y: a }; }

  /** which bank a point is on: −1 / +1 (0 without a river) */
  side(x: number, y: number): number {
    if (this.river === 'none') return 0;
    const [u, a] = this.ua(x, y);
    return a < this.riverAt(u) ? -1 : 1;
  }

  /** the bridge a point stands on (index), or −1 */
  onBridge(x: number, y: number, pad = 0): number {
    if (this.river === 'none') return -1;
    const [u] = this.ua(x, y);
    return this.bridges.findIndex(b => Math.abs(u - b.u) <= RULES.bridgeHalf - pad);
  }

  /** is the point in the river (within `pad` of its water), and not on a bridge */
  wet(x: number, y: number, pad = 0): boolean {
    if (this.river === 'none') return false;
    const [u, a] = this.ua(x, y);
    return Math.abs(a - this.riverAt(u)) < RULES.riverHalf + pad && this.onBridge(x, y) < 0;
  }

  /** the two ends of a bridge (just off the water on each bank) */
  bridgeEnds(i: number): [{ x: number; y: number }, { x: number; y: number }] {
    const u = this.bridges[i].u, c = this.riverAt(u), off = RULES.riverHalf + 1.1;
    return [this.xy(u, c - off), this.xy(u, c + off)];
  }

  // ── the pens ───────────────────────────────────────────────────
  inPen(x: number, y: number, pad = 0): number {
    return this.pens.findIndex(p => Math.hypot(x - p.x, y - p.y) < p.r + pad);
  }

  /** the gate's two points, just outside and just inside */
  gate(i: number): [{ x: number; y: number }, { x: number; y: number }] {
    const p = this.pens[i];
    const c = Math.cos(p.gate), s = Math.sin(p.gate);
    return [{ x: p.x + c * (p.r + 1.2), y: p.y + s * (p.r + 1.2) }, { x: p.x + c * (p.r - 1.4), y: p.y + s * (p.r - 1.4) }];
  }

  // ── solid things ───────────────────────────────────────────────
  solid(x: number, y: number, r: number): boolean {
    for (const c of this.rocks) if (Math.hypot(x - c.x, y - c.y) < c.r + r) return true;
    for (const c of this.trees) if (Math.hypot(x - c.x, y - c.y) < c.r + r) return true;
    for (const c of this.bushes) if (Math.hypot(x - c.x, y - c.y) < c.r + r) return true;
    return false;
  }

  /** a free dry point near (x, y) */
  dry(x: number, y: number, pad = 1): { x: number; y: number } {
    const R = RULES;
    for (let k = 0; k < 60; k++) {
      const a = k * 2.39996, d = k * 0.6;
      const px = Math.min(this.w - R.edge - pad, Math.max(R.edge + pad, x + Math.cos(a) * d));
      const py = Math.min(this.h - R.edge - pad, Math.max(R.edge + pad, y + Math.sin(a) * d));
      if (!this.wet(px, py, pad) && this.inPen(px, py, pad) < 0 && !this.solid(px, py, pad * 0.5)) return { x: px, y: py };
    }
    return { x, y };
  }

  /**
   * Push a body of radius `r` out of whatever is solid: the map's edge, rocks, trunks, bushes, the
   * pens' walls (not through the gate) and the river (not on a bridge).  `from` is where it was
   * (which bank, which side of a wall it belongs on).  Mutates and returns `p`.
   */
  push<T extends { x: number; y: number }>(p: T, r: number, fromX: number, fromY: number): T {
    const R = RULES;
    p.x = Math.min(this.w - R.edge - r, Math.max(R.edge + r, p.x));
    p.y = Math.min(this.h - R.edge - r, Math.max(R.edge + r, p.y));
    for (const list of [this.rocks, this.trees, this.bushes]) {
      for (const c of list) {
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), m = c.r + r;
        if (d < m) {
          const k = d > 1e-6 ? m / d : 0;
          p.x = c.x + (d > 1e-6 ? dx * k : m);
          p.y = c.y + dy * k;
        }
      }
    }
    for (const pen of this.pens) {
      const dx = p.x - pen.x, dy = p.y - pen.y, d = Math.hypot(dx, dy);
      const t = R.penWall + r;
      if (Math.abs(d - pen.r) >= t || d < 1e-6) continue;
      if (Math.abs(angDiff(Math.atan2(dy, dx), pen.gate)) < R.penGate) continue;
      const wasIn = Math.hypot(fromX - pen.x, fromY - pen.y) < pen.r;
      const to = wasIn ? pen.r - t : pen.r + t;
      p.x = pen.x + (dx / d) * to;
      p.y = pen.y + (dy / d) * to;
    }
    if (this.river !== 'none' && this.wet(p.x, p.y, r)) {
      const [u, a] = this.ua(p.x, p.y);
      const b = this.onBridge(fromX, fromY);
      if (b >= 0) {
        // off a bridge's side: back between its rails
        const bu = this.bridges[b].u, lim = R.bridgeHalf - 0.02;
        const q = this.xy(Math.min(bu + lim, Math.max(bu - lim, u)), a);
        p.x = q.x;
        p.y = q.y;
        return p;
      }
      const c = this.riverAt(u);
      const s = this.side(fromX, fromY) || (a < c ? -1 : 1);
      // back onto the bank it came from (off a bridge's side rail too)
      const q = this.xy(u, c + s * (R.riverHalf + r + 0.01));
      p.x = q.x;
      p.y = q.y;
    }
    return p;
  }

  /**
   * The next point to walk to on the way from (x, y) to (tx, ty): the near end of the best bridge
   * when the river is between them, a pen's gate when a wall is; else the target itself.
   */
  waypoint(x: number, y: number, tx: number, ty: number): { x: number; y: number } {
    // pens first: in or out through the gate
    const inA = this.inPen(x, y), inB = this.inPen(tx, ty);
    if (inA !== inB) {
      // through the gate: once lined up with it, straight through; else to the gate's mouth first
      const i = inA >= 0 ? inA : inB;
      const pen = this.pens[i];
      const [out, inner] = this.gate(i);
      const lined = Math.abs(angDiff(Math.atan2(y - pen.y, x - pen.x), pen.gate)) < RULES.penGate * 0.8;
      if (inA >= 0) return lined ? out : inner;
      return lined && Math.hypot(x - pen.x, y - pen.y) < pen.r + 1.6 ? inner : out;
    }
    if (this.river === 'none') return { x: tx, y: ty };
    const sa = this.side(x, y), sb = this.side(tx, ty);
    if (sa === sb || this.onBridge(x, y, 0.3) >= 0) {
      // on a bridge: walk straight across toward the far end
      const b = this.onBridge(x, y, 0.3);
      if (b >= 0 && sa !== sb) {
        const ends = this.bridgeEnds(b);
        return ends[sb < 0 ? 0 : 1];
      }
      return { x: tx, y: ty };
    }
    let best = 0, bd = Infinity;
    this.bridges.forEach((_, i) => {
      const [e0, e1] = this.bridgeEnds(i);
      const near = sa < 0 ? e0 : e1, far = sa < 0 ? e1 : e0;
      const d = Math.hypot(near.x - x, near.y - y) + Math.hypot(tx - far.x, ty - far.y);
      if (d < bd) { bd = d; best = i; }
    });
    const [e0, e1] = this.bridgeEnds(best);
    const near = sa < 0 ? e0 : e1, far = sa < 0 ? e1 : e0;
    return Math.hypot(near.x - x, near.y - y) > 0.9 ? near : far;
  }

  /**
   * A direction (unit) that bends around what stands within `look` m ahead of (x, y) on the way
   * (dx, dy): rocks, trunks, bushes, and the pens' walls from outside.
   */
  avoid(x: number, y: number, dx: number, dy: number, r: number, look = 1.8): { x: number; y: number } {
    let ax = dx, ay = dy;
    const test = (cx: number, cy: number, cr: number) => {
      const ox = cx - x, oy = cy - y;
      const along = ox * dx + oy * dy;
      if (along <= 0 || along > look + cr) return;
      const side = -ox * dy + oy * dx;
      const room = cr + r + 0.3;
      if (Math.abs(side) >= room) return;
      const k = ((room - Math.abs(side)) / room) * 1.8;
      const s = side >= 0 ? 1 : -1;
      ax += dy * s * k;
      ay += -dx * s * k;
    };
    for (const list of [this.rocks, this.trees, this.bushes]) for (const c of list) test(c.x, c.y, c.r);
    for (const p of this.pens) if (Math.hypot(x - p.x, y - p.y) > p.r) test(p.x, p.y, p.r + RULES.penWall);
    const l = Math.hypot(ax, ay) || 1;
    return { x: ax / l, y: ay / l };
  }

  /** points along the river's centre for the painter: [x, y] every `step` m */
  riverLine(step = 1): { x: number; y: number }[] {
    if (this.river === 'none') return [];
    const len = this.river === 'v' ? this.h : this.w;
    const out: { x: number; y: number }[] = [];
    for (let u = -2; u <= len + 2; u += step) out.push(this.xy(u, this.riverAt(u)));
    return out;
  }

  /** the bridge's corners for the painter */
  bridgeQuad(i: number): { x: number; y: number }[] {
    const u = this.bridges[i].u, c = this.riverAt(u), a = RULES.riverHalf + 0.7, b = RULES.bridgeHalf;
    return [this.xy(u - b, c - a), this.xy(u + b, c - a), this.xy(u + b, c + a), this.xy(u - b, c + a)];
  }
}
