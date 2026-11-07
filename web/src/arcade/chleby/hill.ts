/**
 * One level of Chleby i ryby, without the DOM or the canvas: the lane up the hillside, the gates
 * that slide across it, the bread rolling up through them, the gulls that swoop across, the
 * Pelikan on a chapter's last level, and the groups of the hungry at the top.  The session
 * (sim.ts) fires the bread and tells the hill what the golden gate multiplies by; the hill moves
 * everything and reports what happened as events (`take()`).  All numbers are in rules.ts.
 *
 *   a piece      a loaf, a fish (fast; it leaps over the first grey gate it meets) or the big
 *                basket (slow; it splits into loaves at the first gate it meets, or feeds them all
 *                at the top).  A piece feeds `n` people (1, more when the hill is crowded).
 *   a gate       green `+n` adds n pieces for each one through, honey `×n` multiplies, grey `−n`
 *                swallows pieces until its count is used up, then breaks for a few seconds (what it
 *                took goes to the crumbs); the golden gate multiplies by what the band says.
 *   a gull       takes one piece and flies off with it; a piece that meets a gull carrying bread
 *                knocks it into the lake.  Mirka takes five, laughs, and the sixth knocks her in.
 *   the hungry   groups of fifty and a hundred (Mark 6:40) in rows of three: a piece that
 *                reaches the top feeds the nearest hungry group of the front row.
 */
import { mulberry32 } from '../../core/random';
import { RULES } from './rules';

export type GateKind = 'add' | 'mul' | 'sub' | 'gold' | 'start';
export type PieceKind = 'loaf' | 'fish' | 'big';
export type GullKind = 'gull' | 'mirka';

export interface Gate {
  id: number;
  kind: GateKind;
  /** add / mul: its number; sub: its full count; gold: the multiplier now (set every step) */
  n: number;
  /** a grey gate's count left, and its seconds broken */
  left: number;
  down: number;
  y: number;
  w: number;
  /** the row's slide: centre x0, amplitude, angular speed, phase; x = the centre now */
  x0: number;
  slide: number;
  speed: number;
  phase: number;
  x: number;
  /** pieces through it this level (the view flashes it) */
  passed: number;
  flash: number;
}

export interface Piece {
  id: number;
  kind: PieceKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** people it feeds */
  n: number;
  /** the gates it went through (bit = gate id) */
  mask: number;
  /** a fish's leap over a grey gate is still to come */
  leap: boolean;
  /** seconds alive (the view's hop) */
  age: number;
}

export interface Gull {
  id: number;
  kind: GullKind;
  x: number;
  y: number;
  /** +1 from the lake (left) to the right, −1 back */
  dir: number;
  baseY: number;
  amp: number;
  speed: number;
  /** pieces it may still take; pieces it carries */
  takes: number;
  carry: number;
  state: 'fly' | 'carry' | 'fall' | 'gone';
  t: number;
  /** a flock's place in the V (0 = the leader) */
  slot: number;
}

export interface Group {
  id: number;
  size: number;
  fed: number;
  row: number;
  /** the lane's x range it sits in, once in the front row */
  x0: number;
  x1: number;
  /** seconds since it was fed (the cheer), −1 while hungry */
  done: number;
}

export interface Pelikan {
  x: number;
  y: number;
  pouch: number;
  cap: number;
  state: 'sit' | 'leave' | 'gone';
  t: number;
  /** a gulp's seconds (the view's pouch wobble) */
  gulp: number;
}

export type HillEvent =
  | { type: 'gate'; gate: number; kind: GateKind; n: number; x: number; y: number; added: number }
  | { type: 'swallow'; gate: number; x: number; y: number; n: number }
  | { type: 'break'; gate: number; x: number; y: number }
  | { type: 'leap'; x: number; y: number }
  | { type: 'split'; x: number; y: number; loaves: number }
  | { type: 'near'; x: number; y: number }
  | { type: 'feed'; group: number; n: number; x: number }
  | { type: 'fed'; group: number; size: number }
  | { type: 'row'; row: number }
  | { type: 'gull'; gull: number; kind: GullKind; flock: boolean }
  | { type: 'steal'; gull: number; kind: GullKind; x: number; y: number; n: number; laugh: boolean }
  | { type: 'knock'; gull: number; kind: GullKind; x: number; y: number }
  | { type: 'pelikan' }
  | { type: 'gulp'; x: number; y: number; n: number }
  | { type: 'sated' }
  | { type: 'done'; byTime: boolean; left: number };

/** What the session tells the hill each step. */
export interface Control {
  /** the golden gate's multiplier now (1: below the threshold, a rest, a blind block) */
  gold: number;
  /** a rest block: no gulls come, those about fly back to the lake */
  rest: boolean;
  /** no new gulls (the finale) */
  quiet: boolean;
}

export interface LevelPlan {
  level: number;
  chapter: number;
  /** times round the hills (0 the first) */
  circle: number;
  local: number;
  pelikan: boolean;
  groups: number[];
  hunger: number;
  limit: number;
  gates: Omit<Gate, 'x' | 'passed' | 'flash' | 'left' | 'down'>[];
}

const LEVEL_SALT = 0x2f6b9a31;

/** The chapter (0-based, of the six hillsides), the time round, and the level within its chapter. */
export function placeOf(level: number): { chapter: number; circle: number; local: number } {
  const L = Math.max(0, Math.floor(level)), R = RULES;
  const ch = Math.floor(L / R.chapter);
  return { chapter: ch % R.chapters, circle: Math.floor(ch / R.chapters), local: L % R.chapter };
}

export const isPelikan = (level: number): boolean => placeOf(level).local === RULES.chapter - 1;

/**
 * A level's layout, the same for everyone at that level: its groups (4 → 12, fifties and hundreds),
 * its rows of gates (2 → 4; the golden gate always in the row nearest the hungry), the Pelikan on a
 * chapter's last level, and its time.
 */
export function planLevel(level: number, startLevel = 0): LevelPlan {
  const R = RULES, L = Math.max(0, Math.floor(level));
  const { chapter, circle, local } = placeOf(L);
  const pelikan = local === R.chapter - 1;
  const rnd = mulberry32((L * 2654435761 + LEVEL_SALT) >>> 0);
  // the hungry
  const count = Math.min(R.groupsMax, R.groups + Math.floor(L * R.groupsPerLevel));
  const pHundred = Math.min(R.hundredMax, R.hundred + R.hundredPerLevel * L);
  const grow = 1 + R.circleHunger * circle;
  const groups: number[] = [];
  for (let i = 0; i < count; i++) groups.push(Math.round(((rnd() < pHundred ? 100 : 50) * grow) / 10) * 10);
  if (L === 0) groups.fill(50);
  const hunger = groups.reduce((s, g) => s + g, 0);
  // the rows of gates, bottom to top; the golden row nearest the hungry
  const rowsN = Math.min(4, 2 + (L >= 2 ? 1 : 0) + (L >= 6 ? 1 : 0));
  const lo = startLevel > 0 ? R.startY + 2.2 : 4.4, goldY = R.laneH - 5.6;
  const ys: number[] = [];
  // on the Pelikan's level his bench (between the rows and the golden gate) stays clear
  const others = rowsN - 1 - (pelikan && rowsN > 2 ? 1 : 0);
  const hi = pelikan ? R.pelikanY - 2 : goldY - 2.4;
  for (let i = 0; i < others; i++) ys.push(lo + ((hi - lo) * (i + 0.5)) / others);
  const gates: LevelPlan['gates'] = [];
  let id = 0;
  const W = R.laneW;
  const row = (y: number, specs: { kind: GateKind; n: number; w: number }[], speed: number, slide: number) => {
    const total = specs.reduce((s, g) => s + g.w, 0);
    const gap = specs.length > 1 ? Math.min(1.6, (W - 1 - total) / (specs.length - 1)) : 0;
    const span = total + gap * (specs.length - 1);
    const room = Math.max(0, (W - 0.6 - span) / 2);
    const amp = Math.min(slide, room);
    let x = (W - span) / 2;
    const phase = rnd() * Math.PI * 2;
    for (const s of specs) {
      gates.push({ id: id++, kind: s.kind, n: s.n, y, w: s.w, x0: x + s.w / 2, slide: amp, speed, phase });
      x += s.w + gap;
    }
  };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length];
  ys.forEach((y, i) => {
    const hard = L + i;
    if (L === 0) {
      row(y, [{ kind: 'add', n: 2, w: 3.4 }], 0.55, 2.6);
      return;
    }
    const pool: { kind: GateKind; n: number }[] = [{ kind: 'add', n: 1 }, { kind: 'add', n: 2 }, { kind: 'mul', n: 2 }];
    if (hard >= 2) pool.push({ kind: 'mul', n: 3 }, { kind: 'add', n: 3 });
    const two = L >= 1 && rnd() < 0.75;
    if (two) {
      const a = pick(pool);
      const grey = L >= 1 && rnd() < Math.min(0.7, 0.35 + 0.05 * L);
      const b = grey ? { kind: 'sub' as GateKind, n: 4 + Math.min(6, Math.floor(L / 3) * 2) } : pick(pool);
      const specs = rnd() < 0.5 ? [a, b] : [b, a];
      row(y, specs.map(s => ({ ...s, w: s.kind === 'sub' ? 2.6 : 2.5 })), 0.45 + 0.08 * Math.min(6, L) + rnd() * 0.25, 2.4);
    } else {
      const a = pick(pool);
      row(y, [{ ...a, w: 2.6 }], 0.5 + 0.1 * Math.min(6, L) + rnd() * 0.3, 3.4);
    }
  });
  // the golden gate: wide, slow; later a grey gate beside it
  const greyBeside = L >= 4 && rnd() < 0.5;
  const goldRow: { kind: GateKind; n: number; w: number }[] = greyBeside
    ? [{ kind: 'gold', n: 1, w: 3.4 }, { kind: 'sub', n: 4 + Math.min(6, Math.floor(L / 3)), w: 2.2 }]
    : [{ kind: 'gold', n: 1, w: 3.8 }];
  if (greyBeside && rnd() < 0.5) goldRow.reverse();
  row(goldY, goldRow, 0.32 + 0.03 * Math.min(8, L), 2.6);
  // the start gate (an upgrade): a ×2 near the basket
  const sw = R.startW[Math.min(R.startW.length - 1, Math.max(0, startLevel))];
  if (sw > 0) gates.push({ id: id++, kind: 'start', n: 2, y: R.startY, w: sw, x0: W / 2, slide: Math.min(3.2, (W - sw) / 2 - 0.4), speed: 0.7, phase: 0 });
  const limit = Math.round(R.timeBase + R.timePerPerson * hunger);
  return { level: L, chapter, circle, local, pelikan, groups, hunger, limit, gates };
}

export class Hill {
  readonly plan: LevelPlan;
  readonly gates: Gate[];
  readonly pieces: Piece[] = [];
  readonly gulls: Gull[] = [];
  readonly groups: Group[];
  pelikan: Pelikan | null = null;
  /** the front row of the hungry */
  row = 0;
  readonly rows: number;
  t = 0;
  /** people fed by bread, by the disciples; bread swallowed by grey gates, taken by gulls (crumbs) */
  fed = 0;
  crumbs = 0;
  done = false;
  byTime = false;
  /** the golden gate's multiplier as last applied */
  gold = 1;
  knocked = 0;
  stolen = 0;
  private nextId = 1;
  private gullT: number;
  private gullN = 0;
  private mirkaDone = false;
  private readonly events: HillEvent[] = [];
  private readonly rnd: () => number;
  private nearT = 0;

  constructor(level: number, opts: { start?: number; seed?: number } = {}) {
    this.plan = planLevel(level, opts.start ?? 0);
    this.rnd = mulberry32(((opts.seed ?? 1) ^ (level * 7919)) >>> 0);
    this.gates = this.plan.gates.map(g => ({ ...g, x: g.x0, passed: 0, flash: 0, left: g.n, down: 0 }));
    const R = RULES;
    this.groups = this.plan.groups.map((size, i) => ({ id: i, size, fed: 0, row: Math.floor(i / R.rowMax), x0: 0, x1: 0, done: -1 }));
    this.rows = Math.ceil(this.groups.length / R.rowMax);
    for (let r = 0; r < this.rows; r++) {
      const inRow = this.groups.filter(g => g.row === r);
      const w = R.laneW / inRow.length;
      inRow.forEach((g, i) => { g.x0 = i * w; g.x1 = (i + 1) * w; });
    }
    if (this.plan.pelikan) {
      const cap = R.pelikanPouch + R.pelikanPerChapter * (this.plan.chapter + this.plan.circle * R.chapters);
      this.pelikan = { x: R.laneW / 2, y: R.pelikanY, pouch: 0, cap, state: 'sit', t: 0, gulp: 0 };
    }
    this.gullT = R.gullFirst;
    this.moveGates(0);
  }

  get level(): number { return this.plan.level; }
  get hunger(): number { return this.plan.hunger; }
  get limit(): number { return this.plan.limit; }
  get timeLeft(): number { return Math.max(0, this.plan.limit - this.t); }
  get goldGate(): Gate | undefined { return this.gates.find(g => g.kind === 'gold'); }
  /** people still hungry */
  get left(): number { return this.groups.reduce((s, g) => s + g.size - g.fed, 0); }
  get share(): number { return this.hunger > 0 ? 1 - this.left / this.hunger : 1; }

  // ── the hands' bread ────────────────────────────────────────────
  /** A piece leaves the basket at x (lane u). */
  fire(x: number, kind: PieceKind, n = 1): Piece | null {
    if (this.done) return null;
    const R = RULES;
    const speed = kind === 'fish' ? R.fishSpeed : kind === 'big' ? R.bigSpeed : R.loafSpeed;
    const p: Piece = {
      id: this.nextId++, kind, x: clampX(x), y: 0.3, vx: kind === 'big' ? 0 : (this.rnd() - 0.5) * R.spread * 2,
      vy: speed * (kind === 'big' ? 1 : 0.94 + this.rnd() * 0.12), n, mask: 0, leap: kind === 'fish', age: 0,
    };
    this.pieces.push(p);
    return p;
  }

  // ── a step ──────────────────────────────────────────────────────
  step(dt: number, ctl: Control): void {
    if (!(dt > 0)) return;
    this.t += dt;
    this.gold = ctl.gold;
    this.nearT = Math.max(0, this.nearT - dt);
    for (const g of this.gates) {
      if (g.kind === 'gold') g.n = ctl.gold;
      g.flash = Math.max(0, g.flash - dt * 3);
      if (g.down > 0) {
        g.down -= dt;
        if (g.down <= 0) { g.down = 0; g.left = g.n; }
      }
    }
    this.moveGates(this.t);
    this.movePieces(dt);
    this.moveGulls(dt, ctl);
    this.movePelikan(dt);
    for (const g of this.groups) if (g.done >= 0) g.done += dt;
    if (!this.done && this.t >= this.plan.limit) this.finishByTime();
  }

  private moveGates(t: number): void {
    for (const g of this.gates) g.x = g.x0 + g.slide * Math.sin(g.speed * t + g.phase);
  }

  private movePieces(dt: number): void {
    const R = RULES, W = R.laneW;
    const list = this.pieces;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const y0 = p.y;
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < R.edge) { p.x = R.edge; p.vx = Math.abs(p.vx) * 0.7; }
      else if (p.x > W - R.edge) { p.x = W - R.edge; p.vx = -Math.abs(p.vx) * 0.7; }
      // the gates it crosses
      let gone = false;
      for (const g of this.gates) {
        if (p.mask & (1 << g.id)) continue;
        if (!(y0 < g.y && p.y >= g.y)) continue;
        const half = g.w / 2;
        const off = Math.abs(p.x - g.x);
        if (off > half) {
          if (g.kind === 'gold' && off < half + 0.45 && this.nearT <= 0 && p.kind !== 'big') {
            this.nearT = 3;
            this.emit({ type: 'near', x: p.x, y: g.y });
          }
          continue;
        }
        p.mask |= 1 << g.id;
        if (g.kind === 'sub' && g.down > 0) continue;
        if (p.kind === 'big') {
          this.split(p, g);
          gone = true;
          break;
        }
        if (g.kind === 'sub') {
          if (p.leap) {
            p.leap = false;
            this.emit({ type: 'leap', x: p.x, y: g.y });
            continue;
          }
          g.left -= p.n;
          g.passed++;
          g.flash = 1;
          this.crumbs += p.n;
          this.emit({ type: 'swallow', gate: g.id, x: p.x, y: g.y, n: p.n });
          if (g.left <= 0) {
            g.down = R.greyBack;
            g.left = 0;
            this.emit({ type: 'break', gate: g.id, x: g.x, y: g.y });
          }
          gone = true;
          break;
        }
        const extra = this.extraFor(g);
        g.passed++;
        g.flash = 1;
        const added = this.multiply(p, extra);
        this.emit({ type: 'gate', gate: g.id, kind: g.kind, n: g.n, x: p.x, y: g.y, added });
      }
      if (!gone) gone = this.hitGull(p) || this.hitPelikan(p);
      if (!gone && p.y >= R.laneH) {
        // off the list first: a level that ends with this piece must not count it twice
        list.splice(i, 1);
        i--;
        this.feed(p.n, p.x);
        continue;
      }
      if (gone) {
        list.splice(i, 1);
        i--;
      }
    }
  }

  /** Pieces a gate adds for one piece: +n adds n, ×n adds n − 1 (a half adds one every other time). */
  private extraFor(g: Gate): number {
    if (g.kind === 'add') return g.n;
    const m = g.n - 1;
    if (m <= 0) return 0;
    const whole = Math.floor(m);
    return whole + (this.rnd() < m - whole ? 1 : 0);
  }

  /** Clones beside the piece (or, on a crowded hill, a heavier piece); returns the people added. */
  private multiply(p: Piece, extra: number): number {
    if (extra <= 0) return 0;
    const R = RULES;
    const room = Math.max(0, R.maxPieces - this.pieces.length);
    const clones = Math.min(extra, room);
    for (let k = 0; k < clones; k++) {
      const a = ((k + 1) * (k % 2 ? 1 : -1)) * 0.22;
      this.pieces.push({
        id: this.nextId++, kind: p.kind, x: clampX(p.x + a), y: p.y - 0.05 - this.rnd() * 0.25,
        vx: p.vx + a * 1.6 + (this.rnd() - 0.5) * 0.6, vy: p.vy * (0.92 + this.rnd() * 0.12), n: p.n, mask: p.mask, leap: p.leap, age: p.age,
      });
    }
    if (extra > clones) p.n += (extra - clones) * p.n;
    return extra * p.n;
  }

  /** The big basket meets a gate: its loaves tumble out just before the line, so the gate counts each of them. */
  private split(p: Piece, g: Gate): void {
    const loaves = p.n;
    if (g.kind === 'sub' && g.down <= 0) {
      g.down = RULES.greyBack;
      g.left = 0;
      this.emit({ type: 'break', gate: g.id, x: g.x, y: g.y });
    }
    this.emit({ type: 'split', x: p.x, y: g.y, loaves });
    const room = Math.max(1, RULES.maxPieces - this.pieces.length);
    const k = Math.min(loaves, room);
    const each = Math.floor(loaves / k), rest = loaves - each * k;
    for (let i = 0; i < k; i++) {
      const a = (i / Math.max(1, k - 1) - 0.5) * Math.min(g.w * 0.9, 3);
      this.pieces.push({
        id: this.nextId++, kind: 'loaf', x: clampX(g.x + a * 0.6 + (p.x - g.x) * 0.3), y: g.y - 0.15 - this.rnd() * 0.5,
        vx: a * 0.4 + (this.rnd() - 0.5) * 0.5, vy: RULES.loafSpeed * (0.85 + this.rnd() * 0.3), n: each + (i < rest ? 1 : 0),
        mask: p.mask & ~(1 << g.id), leap: false, age: 0,
      });
    }
  }

  // ── the hungry ──────────────────────────────────────────────────
  /** `n` people's bread reaches the top at x: the nearest hungry group of the front row eats. */
  private feed(n: number, x: number): void {
    let left = n;
    while (left > 0 && !this.done) {
      const front = this.groups.filter(g => g.row === this.row && g.fed < g.size);
      if (!front.length) break;
      let best = front[0], bestD = Infinity;
      for (const g of front) {
        const d = x >= g.x0 && x <= g.x1 ? 0 : Math.min(Math.abs(x - g.x0), Math.abs(x - g.x1));
        if (d < bestD) { bestD = d; best = g; }
      }
      const eat = Math.min(left, best.size - best.fed);
      best.fed += eat;
      left -= eat;
      this.fed += eat;
      this.emit({ type: 'feed', group: best.id, n: eat, x });
      if (best.fed >= best.size) {
        best.done = 0;
        this.emit({ type: 'fed', group: best.id, size: best.size });
        this.advanceRow();
      }
    }
    if (left > 0) this.crumbs += left;
  }

  private advanceRow(): void {
    while (!this.done && this.groups.filter(g => g.row === this.row).every(g => g.fed >= g.size)) {
      if (this.row + 1 >= this.rows) {
        this.finish(false);
        return;
      }
      this.row++;
      this.emit({ type: 'row', row: this.row });
    }
  }

  /** The session ends with the level well fed: the disciples finish it now (as when time is up). */
  endNow(): void {
    if (!this.done) this.finishByTime();
  }

  /** Time is up: the disciples feed everyone still hungry (the session counts them at half). */
  private finishByTime(): void {
    const left = this.left;
    for (const g of this.groups) {
      if (g.fed < g.size) {
        g.fed = g.size;
        g.done = 0;
      }
    }
    this.finish(true, left);
  }

  private finish(byTime: boolean, left = 0): void {
    if (this.done) return;
    this.done = true;
    this.byTime = byTime;
    // the bread still on the way becomes crumbs for the baskets
    for (const p of this.pieces) this.crumbs += p.n;
    this.pieces.length = 0;
    this.emit({ type: 'done', byTime, left });
  }

  // ── the gulls ───────────────────────────────────────────────────
  private moveGulls(dt: number, ctl: Control): void {
    const R = RULES, W = R.laneW;
    if (!this.done && !ctl.rest && !ctl.quiet) {
      this.gullT -= dt;
      if (this.gullT <= 0) {
        this.gullN++;
        this.gullT = Math.max(R.gullMin, R.gullGap - R.gullGapPerLevel * this.level) * (0.8 + this.rnd() * 0.4);
        const mirka = !this.mirkaDone && this.level >= R.mirkaFrom && this.t >= R.mirkaAt;
        if (mirka) {
          this.mirkaDone = true;
          this.spawnGull('mirka', 0, false);
        } else if (this.level >= R.flockFrom && this.gullN % 3 === 0) {
          for (let s = 0; s < 3; s++) this.spawnGull('gull', s, true);
        } else this.spawnGull('gull', 0, false);
      }
    }
    for (let i = 0; i < this.gulls.length; i++) {
      const g = this.gulls[i];
      g.t += dt;
      if (g.state === 'fly') {
        if (ctl.rest) { g.state = 'carry'; g.dir = -1; }
        g.x += g.dir * g.speed * dt;
        g.y = g.baseY + g.amp * Math.sin(g.t * 2.2 + g.id);
        if ((g.dir > 0 && g.x > W + 2) || (g.dir < 0 && g.x < -2)) g.state = 'gone';
      } else if (g.state === 'carry') {
        // back to the lake on the left, rising a little
        g.dir = -1;
        g.x -= g.speed * 1.15 * dt;
        g.y += 0.4 * dt;
        if (g.x < -2.5) g.state = 'gone';
      } else if (g.state === 'fall') {
        g.x -= g.speed * 0.6 * dt;
        g.y -= 5 * dt;
        if (g.t > 1.2) g.state = 'gone';
      }
      if (g.state === 'gone') {
        this.gulls.splice(i, 1);
        i--;
      }
    }
  }

  private spawnGull(kind: GullKind, slot: number, flock: boolean): void {
    const R = RULES;
    const [y0, y1] = R.gullY;
    const baseY = (flock && slot > 0 ? this.gulls[this.gulls.length - slot]?.baseY ?? y0 : y0 + this.rnd() * (y1 - y0)) + (slot ? (slot % 2 ? 0.9 : -0.9) : 0);
    const g: Gull = {
      id: this.nextId++, kind, x: -1.5 - slot * 0.9, y: baseY, dir: 1, baseY, amp: kind === 'mirka' ? 0.8 : 0.45,
      speed: R.gullSpeed * (kind === 'mirka' ? 0.8 : 0.9 + this.rnd() * 0.25), takes: kind === 'mirka' ? R.mirkaTakes : 1,
      carry: 0, state: 'fly', t: 0, slot,
    };
    this.gulls.push(g);
    this.emit({ type: 'gull', gull: g.id, kind, flock });
  }

  /** A piece meets a gull: a hungry gull takes it; a gull carrying bread is knocked into the lake. */
  private hitGull(p: Piece): boolean {
    const R = RULES;
    for (const g of this.gulls) {
      if (g.state !== 'fly' && g.state !== 'carry') continue;
      const r = g.kind === 'mirka' ? R.gullR * 1.35 : R.gullR;
      const dx = p.x - g.x, dy = p.y - g.y;
      if (dx * dx + dy * dy > r * r) continue;
      if (g.state === 'fly' && g.takes > 0 && p.kind !== 'big') {
        g.takes--;
        g.carry += p.n;
        this.crumbs += p.n;
        this.stolen += p.n;
        const laugh = g.takes === 0 && g.kind === 'mirka';
        if (g.takes === 0 && g.kind === 'gull') g.state = 'carry';
        this.emit({ type: 'steal', gull: g.id, kind: g.kind, x: g.x, y: g.y, n: p.n, laugh });
        return true;
      }
      // full: the bread knocks it off into the lake and rolls on
      g.state = 'fall';
      g.t = 0;
      this.knocked++;
      this.emit({ type: 'knock', gull: g.id, kind: g.kind, x: g.x, y: g.y });
      return false;
    }
    return false;
  }

  // ── the Pelikan ─────────────────────────────────────────────────
  private movePelikan(dt: number): void {
    const pk = this.pelikan;
    if (!pk) return;
    pk.t += dt;
    pk.gulp = Math.max(0, pk.gulp - dt * 3);
    if (pk.state === 'sit') pk.x = RULES.laneW / 2 + RULES.pelikanSlide * Math.sin(pk.t * 0.42);
    else if (pk.state === 'leave') {
      pk.x += 2.2 * dt;
      if (pk.x > RULES.laneW + 2.5) pk.state = 'gone';
    }
    if (pk.t > 0 && pk.t - dt <= 0) this.emit({ type: 'pelikan' });
  }

  private hitPelikan(p: Piece): boolean {
    const pk = this.pelikan;
    if (!pk || pk.state !== 'sit') return false;
    const r = RULES.pelikanR;
    const dx = (p.x - pk.x) / r, dy = (p.y - pk.y) / (r * 0.8);
    if (dx * dx + dy * dy > 1) return false;
    const n = p.kind === 'big' ? p.n : p.n;
    pk.pouch += n;
    pk.gulp = 1;
    this.emit({ type: 'gulp', x: p.x, y: p.y, n });
    if (pk.pouch >= pk.cap) {
      pk.pouch = pk.cap;
      pk.state = 'leave';
      this.emit({ type: 'sated' });
    }
    return true;
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: HillEvent): void { this.events.push(e); }

  take(): HillEvent[] {
    if (!this.events.length) return [];
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }
}

const clampX = (x: number): number => Math.min(RULES.laneW - RULES.edge, Math.max(RULES.edge, x));
