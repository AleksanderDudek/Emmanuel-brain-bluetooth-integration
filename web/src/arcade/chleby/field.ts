/**
 * One terrace of Chleby i ryby (v2, after Mob Control), without the DOM or the canvas: the lane up
 * the hillside, the gates across it, the stream of bread-bearers running up through them, the gull
 * waves waddling down to meet them, the Pelikan on a chapter's last terrace, and the tables of the
 * hungry at the top.  The session (sim.ts) fires the runners and says what the golden gate
 * multiplies by; the field moves everything and reports what happened as events (`take()`).
 *
 *   a runner   a loaf on little legs (worth 1), a fish (worth 2, faster) or the Big Basket (the
 *              champion: slow, wide, worth 30+).  Past the crowd cap a multiplying gate makes a
 *              runner heavier (a stack of loaves) instead of adding more.
 *   a gate     honey ×n: each runner through it becomes n (once per gate); green +n: the first
 *              runner to touch it pops n more, then it recharges; grey −n swallows n, then breaks
 *              for a while (what it took goes to the crumbs); the golden gate multiplies by what
 *              the band says (×1 … ×5, in halves: the fractions carry over from runner to runner).
 *   a gull     waddles down toward the basket in a wave; meeting runners, it snatches loaves one
 *              for one (its worth: 1, Mirka 4, Gerwazy the fat gull 6) and flies off to the lake
 *              with them; one that reaches the basket pecks it (the stream jams for a moment, no
 *              more).  In a rest block the gulls doze where they stand and a runner just shoos one.
 *   Pelikan    the boss of a chapter's last terrace: walks down slowly and gulps every runner he
 *              meets until his pouch is full — then he waddles off, sated and sheepish.
 *   a table    a group of the hungry on a blanket with its hunger (the "base"): every runner that
 *              reaches the top feeds the nearest hungry table by its worth.  All tables fed = the
 *              terrace is done.  Grace: after a while the disciples help (the hunger falls by itself).
 */
import { mulberry32 } from '../../core/random';
import { RULES } from './rules';

export type GateKind = 'add' | 'mul' | 'sub' | 'gold' | 'start';
export type RunnerKind = 'loaf' | 'fish' | 'big';
export type GullKind = 'gull' | 'fat' | 'mirka';

export interface Gate {
  id: number;
  kind: GateKind;
  /** mul / add / sub / start: its number; gold: the multiplier now (set every step) */
  n: number;
  y: number;
  half: number;
  /** the slide: centre x0, amplitude, angular speed, phase; x = the centre now */
  x0: number;
  slide: number;
  speed: number;
  phase: number;
  x: number;
  /** add: 0..1, ready at 1; sub: the count left and the seconds broken */
  charge: number;
  left: number;
  down: number;
  /** gold: the fraction of a runner carried over; flash 0..1 after a pass (the view) */
  carry: number;
  flash: number;
  /** runners made by this gate on this terrace */
  made: number;
}

export interface Runner {
  id: number;
  kind: RunnerKind;
  x: number;
  y: number;
  vx: number;
  /** people it feeds */
  w: number;
  /** the gates it went through (bit = gate id) */
  mask: number;
  age: number;
}

export interface Gull {
  id: number;
  kind: GullKind;
  x: number;
  y: number;
  /** loaves it may still snatch */
  w: number;
  state: 'walk' | 'doze' | 'fly' | 'gone';
  /** seconds in this state; the flight's direction; a loaf in its beak */
  t: number;
  dir: number;
  carry: boolean;
  /** its place in the wave (a small lag so a wave waddles, not marches) */
  lag: number;
}

export interface Pelikan {
  x: number;
  y: number;
  pouch: number;
  full: number;
  state: 'come' | 'walk' | 'sated' | 'gone';
  t: number;
  /** seconds since the last gulp (the view's bulge) */
  gulp: number;
}

export interface Table {
  id: number;
  x: number;
  half: number;
  hunger: number;
  full: number;
  /** fractional help of the disciples */
  help: number;
  /** seconds since it was last fed (the view's bounce); fed = all eaten */
  bite: number;
  fed: boolean;
}

export interface GateSpec { kind: Exclude<GateKind, 'gold'>; n: number; y: number; x0: number; slide: number }

export interface TerracePlan {
  level: number;
  /** this terrace in its level, and how many the level has */
  index: number;
  of: number;
  chapter: number;
  circle: number;
  /** the level's place in its chapter (0..3); the last one is the Pelikan's */
  local: number;
  boss: boolean;
  /** the Pelikan waits on this terrace */
  pelikan: boolean;
  tables: { x: number; half: number; hunger: number }[];
  gates: GateSpec[];
  goldY: number;
  hunger: number;
}

export type FieldEvent =
  /** a gate made runners (one event per gate per step) */
  | { type: 'gate'; kind: GateKind; n: number; made: number; x: number; y: number }
  | { type: 'feed'; n: number; x: number; table: number; big: boolean }
  | { type: 'tableFed'; table: number; x: number }
  | { type: 'snatch'; n: number; x: number; y: number; kind: GullKind }
  | { type: 'peck'; x: number; kind: GullKind }
  | { type: 'shoo'; x: number; y: number }
  | { type: 'wave'; n: number; fat: boolean; mirka: boolean; x: number }
  | { type: 'gulp'; n: number; x: number; y: number }
  | { type: 'pelikan' }
  | { type: 'sated'; x: number; y: number }
  | { type: 'spill'; n: number; x: number; y: number }
  | { type: 'swallow'; n: number; x: number; y: number }
  | { type: 'break'; x: number; y: number }
  | { type: 'help' }
  | { type: 'cleared'; byHelp: boolean };

/** What the session tells the field each step. */
export interface FieldCtl {
  /** the golden gate's multiplier now (1 when the band is not asked or not heard) */
  gold: number;
  /** a rest block: no new waves, the gulls doze */
  rest: boolean;
  /** the finale or a card between levels: no new waves */
  quiet: boolean;
  /** where the basket is (u): the gulls drift toward it */
  basketX: number;
}

const LEVEL_SALT = 0x5bd1e995;

// ── the path ─────────────────────────────────────────────────────
export function placeOf(level: number): { chapter: number; circle: number; local: number } {
  const L = Math.max(0, Math.floor(level)), R = RULES;
  const ch = Math.floor(L / R.chapter);
  return { chapter: ch % R.chapters, circle: Math.floor(ch / R.chapters), local: L % R.chapter };
}

export const isBoss = (level: number): boolean => placeOf(level).local === RULES.chapter - 1;

export const terracesOf = (level: number): number =>
  level < RULES.twoTerraces ? 1 : level < RULES.threeTerraces ? 2 : 3;

/** The level's hunger before it is split over its terraces. */
export function levelHunger(level: number): number {
  const R = RULES, L = Math.max(0, Math.floor(level));
  const { circle } = placeOf(L);
  return Math.min(R.hungerMax, R.hunger + R.hungerPerLevel * L) * (1 + R.circleHunger * circle);
}

/**
 * A terrace's layout, the same for everyone at that level: its tables (one, or two side by side),
 * its gates (a ×2 first; then pairs to choose from, green bursts, grey takers), the golden gate in
 * the middle, the Pelikan on a chapter's last terrace, and its hunger.
 */
export function planTerrace(level: number, index: number, startLevel = 0): TerracePlan {
  const R = RULES, L = Math.max(0, Math.floor(level));
  const { chapter, circle, local } = placeOf(L);
  const of = terracesOf(L);
  const i = Math.max(0, Math.min(of - 1, index));
  const boss = local === R.chapter - 1;
  const pelikan = boss && i === of - 1;
  const rnd = mulberry32((L * 2654435761 + i * 97 + LEVEL_SALT) >>> 0);
  const hunger = Math.max(10, Math.round((levelHunger(L) * (0.7 + 0.15 * i) * (pelikan ? R.bossHunger : 1)) / 2) * 2);
  const two = L >= R.twoFrom && (i + L) % 2 === 1;
  const tables = two
    ? [{ x: 2.6, half: 1.8, hunger: hunger / 2 }, { x: 7.4, half: 1.8, hunger: hunger / 2 }]
    : [{ x: 5, half: 2.7, hunger }];
  const amp = (k: number) => Math.min(2.6, 1.2 + 0.12 * L) * k;
  const gates: GateSpec[] = [];
  // the first row: a sliding ×2 (×3 later), the gate that teaches the joy
  gates.push({ kind: 'mul', n: L >= 6 && rnd() < 0.4 ? 3 : 2, y: 3.6, x0: 5, slide: amp(1) });
  // the rows above the golden gate: a choice of two, a green burst, or a grey taker
  const upper = L === 0 ? 1 : L < 4 ? 2 : 3;
  const ys = [12.6, 15.8, 5.9];
  for (let k = 0; k < upper; k++) {
    const y = ys[k];
    const roll = rnd();
    if (k === 2) {
      // a low grey taker beside a lane left free
      gates.push({ kind: 'sub', n: 4 + Math.floor(L / 2), y, x0: rnd() < 0.5 ? 3 : 7, slide: amp(0.4) });
    } else if (L >= 1 && roll < 0.42) {
      // a choice: a bigger multiplier on one side, a burst or a taker on the other
      const left = rnd() < 0.5;
      gates.push({ kind: 'mul', n: L >= 5 && rnd() < 0.5 ? 3 : 2, y, x0: left ? 2.6 : 7.4, slide: 0.35 });
      if (L >= 2 && rnd() < 0.5) gates.push({ kind: 'sub', n: 3 + Math.floor(L / 2), y, x0: left ? 7.4 : 2.6, slide: 0.35 });
      else gates.push({ kind: 'add', n: 5 + 5 * Math.min(3, Math.floor(L / 3)), y, x0: left ? 7.4 : 2.6, slide: 0.35 });
    } else if (roll < 0.75 || L === 0) {
      gates.push({ kind: 'add', n: 5 + 5 * Math.min(3, Math.floor(L / 3)), y, x0: 5, slide: amp(0.9) });
    } else {
      gates.push({ kind: 'mul', n: 2, y, x0: 5, slide: amp(1.1) });
    }
  }
  if (startLevel > 0) gates.push({ kind: 'start', n: 2, y: R.startY, x0: 5, slide: 2.6 });
  return { level: L, index: i, of, chapter, circle, local, boss, pelikan, tables, gates, goldY: 8.4, hunger: tables.reduce((s, t) => s + t.hunger, 0) };
}

// ── the terrace ──────────────────────────────────────────────────
export interface FieldOpts {
  seed: number;
  /** Bramka startowa's level (0: none) */
  start?: number;
  /** the first wave waits longer (a first-ever session) */
  firstEver?: boolean;
}

export class Field {
  readonly plan: TerracePlan;
  readonly gates: Gate[] = [];
  readonly runners: Runner[] = [];
  readonly gulls: Gull[] = [];
  readonly tables: Table[];
  pelikan: Pelikan | null = null;
  /** seconds on this terrace */
  t = 0;
  done = false;
  byHelp = false;
  helping = false;
  waves = 0;
  /** the gold gate (always there) */
  readonly gold: Gate;
  private nextWave: number;
  private ids = 0;
  private readonly rnd: () => number;
  private readonly events: FieldEvent[] = [];
  private readonly made = new Map<Gate, number>();
  private wasRest = false;

  constructor(plan: TerracePlan, opts: FieldOpts) {
    const R = RULES;
    this.plan = plan;
    this.rnd = mulberry32(opts.seed >>> 0);
    const slideSpeed = Math.min(R.slideMax, R.slideBase + R.slidePerLevel * plan.level);
    let id = 0;
    for (const g of plan.gates) {
      const half = g.kind === 'start' ? R.startHalf[Math.min(R.startHalf.length - 1, opts.start ?? 0)] : R.gateHalf;
      if (half <= 0) continue;
      this.gates.push(this.mkGate(id++, g.kind, g.n, g.y, half, g.x0, g.slide, slideSpeed * (0.8 + 0.4 * this.rnd())));
    }
    this.gold = this.mkGate(id++, 'gold', 1, plan.goldY, R.goldHalf, 5, Math.min(2.3, 1 + 0.1 * plan.level), slideSpeed * 0.62);
    this.gates.push(this.gold);
    this.tables = plan.tables.map((tb, i) => ({ id: i, x: tb.x, half: tb.half, hunger: Math.round(tb.hunger), full: Math.round(tb.hunger), help: 0, bite: 9, fed: false }));
    this.nextWave = opts.firstEver && plan.level === 0 && plan.index === 0 ? R.waveFirstEver : R.waveFirst;
    if (plan.pelikan) {
      const pouch = R.pelikanPouch + R.pelikanPerChapter * (plan.chapter + plan.circle * R.chapters);
      this.pelikan = { x: 5, y: R.laneH + 2, pouch, full: pouch, state: 'come', t: 0, gulp: 9 };
      this.events.push({ type: 'pelikan' });
    }
  }

  private mkGate(id: number, kind: GateKind, n: number, y: number, half: number, x0: number, slide: number, speed: number): Gate {
    const phase = this.rnd() * Math.PI * 2;
    const g: Gate = { id, kind, n, y, half, x0, slide, speed, phase, x: x0, charge: 1, left: n, down: 0, carry: 0, flash: 0, made: 0 };
    g.x = this.slideX(g, 0);
    return g;
  }

  private slideX(g: Gate, t: number): number {
    const R = RULES;
    const amp = Math.max(0, Math.min(g.slide, g.x0 - g.half - 0.1, R.laneW - g.x0 - g.half - 0.1));
    return g.x0 + amp * Math.sin(g.phase + g.speed * t);
  }

  /** hunger left on the terrace, and the share fed */
  get hunger(): number { return this.tables.reduce((s, t) => s + Math.max(0, t.hunger), 0); }
  get share(): number { return this.plan.hunger > 0 ? 1 - this.hunger / this.plan.hunger : 1; }
  get crowd(): number { return this.runners.length; }
  /** the weight of every live runner (people on the way) */
  get carried(): number { return this.runners.reduce((s, r) => s + r.w, 0); }

  /** A runner leaves the basket at lane x. */
  fire(x: number, kind: RunnerKind, w = kind === 'fish' ? RULES.fishW : 1): void {
    if (this.done) return;
    const R = RULES;
    const cx = Math.max(R.edge, Math.min(R.laneW - R.edge, x + (this.rnd() - 0.5) * 0.5));
    this.runners.push({ id: this.ids++, kind, x: cx, y: 0.35, vx: (this.rnd() - 0.5) * R.wander, w, mask: 0, age: 0 });
  }

  // ── a step ──────────────────────────────────────────────────────
  step(dt: number, ctl: FieldCtl): void {
    if (!(dt > 0)) return;
    const R = RULES;
    this.t += dt;
    for (const g of this.gates) {
      g.x = g.kind === 'gold' || g.slide > 0 ? this.slideX(g, this.t) : g.x0;
      g.flash = Math.max(0, g.flash - dt * 3);
      if (g.kind === 'gold') g.n = ctl.gold;
      if (g.kind === 'add' && g.charge < 1) g.charge = Math.min(1, g.charge + dt / R.addBack);
      if (g.kind === 'sub' && g.down > 0) {
        g.down -= dt;
        if (g.down <= 0) { g.down = 0; g.left = g.n; }
      }
    }
    this.made.clear();
    this.moveRunners(dt);
    this.waveTick(ctl);
    this.moveGulls(dt, ctl);
    this.movePelikan(dt, ctl);
    this.collide();
    this.help(dt);
    for (const [g, made] of this.made) {
      g.made += made;
      g.flash = 1;
      this.events.push({ type: 'gate', kind: g.kind, n: g.n, made, x: g.x, y: g.y });
    }
    for (const tb of this.tables) tb.bite += dt;
    if (!this.done && this.tables.every(tb => tb.fed)) {
      this.done = true;
      this.events.push({ type: 'cleared', byHelp: this.byHelp });
    }
    this.wasRest = ctl.rest;
  }

  private moveRunners(dt: number): void {
    const R = RULES, rs = this.runners;
    const hungry = this.tables.filter(tb => !tb.fed);
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      r.age += dt;
      const py = r.y;
      const speed = r.kind === 'big' ? R.bigSpeed : r.kind === 'fish' ? R.fishSpeed : R.loafSpeed;
      r.y += speed * dt;
      // wander, and in the top rows the pull toward the nearest hungry table
      if (r.y > R.pullFrom && hungry.length) {
        let best = hungry[0];
        for (const tb of hungry) if (Math.abs(tb.x - r.x) < Math.abs(best.x - r.x)) best = tb;
        const dx = best.x - r.x, inside = Math.abs(dx) < best.half * 0.75;
        const want = inside ? 0 : Math.sign(dx) * Math.min(R.pull, Math.abs(dx) * 2);
        r.vx += (want - r.vx) * Math.min(1, dt * 5);
      } else if (this.rnd() < dt * 2) r.vx = (this.rnd() - 0.5) * 2 * R.wander;
      r.x += r.vx * dt;
      const e = r.kind === 'big' ? R.bigR : R.edge;
      if (r.x < e) { r.x = e; r.vx = Math.abs(r.vx); }
      if (r.x > R.laneW - e) { r.x = R.laneW - e; r.vx = -Math.abs(r.vx); }
      // the gates it crosses this step
      for (const g of this.gates) {
        if (g.y <= py || g.y > r.y) continue;
        const bit = 1 << g.id;
        if (r.mask & bit) continue;
        if (Math.abs(r.x - g.x) > g.half + (r.kind === 'big' ? 0.4 : 0)) continue;
        r.mask |= bit;
        if (!this.pass(r, g)) break;
      }
      if (r.w <= 0) { rs.splice(i, 1); continue; }
      // the top: the nearest hungry table eats
      if (r.y >= R.laneH - 0.25) {
        this.feed(r);
        rs.splice(i, 1);
      }
    }
  }

  /** A runner goes through a gate; false when the gate swallowed it whole. */
  private pass(r: Runner, g: Gate): boolean {
    const R = RULES;
    switch (g.kind) {
      case 'mul':
      case 'start':
        if (r.kind === 'big') this.spill(r, g, (g.n - 1) * R.bigSpill);
        else this.clone(r, g, g.n - 1);
        return true;
      case 'gold': {
        const m = g.n;
        if (m <= 1) return true;
        if (r.kind === 'big') { this.spill(r, g, Math.round((m - 1) * R.bigSpill)); return true; }
        g.carry += m - 1;
        const k = Math.floor(g.carry);
        g.carry -= k;
        this.clone(r, g, k);
        return true;
      }
      case 'add':
        if (g.charge < 1) return true;
        g.charge = 0;
        if (r.kind === 'big') this.spill(r, g, g.n);
        else this.clone(r, g, g.n, true);
        return true;
      case 'sub': {
        if (g.down > 0 || g.left <= 0) return true;
        const take = Math.min(r.w, g.left);
        r.w -= take;
        g.left -= take;
        g.flash = 1;
        this.events.push({ type: 'swallow', n: take, x: r.x, y: g.y });
        if (g.left <= 0) {
          g.down = R.greyBack;
          this.events.push({ type: 'break', x: g.x, y: g.y });
        }
        return r.w > 0;
      }
    }
  }

  /** `k` more runners like `r` (the same gates behind them); past the cap `r` grows heavier instead. */
  private clone(r: Runner, g: Gate, k: number, burst = false): void {
    if (k <= 0) return;
    const R = RULES, room = Math.max(0, R.maxRunners - this.runners.length);
    const n = Math.min(k, room);
    for (let i = 0; i < n; i++) {
      const sp = burst ? 1.4 : 0.7;
      const x = Math.max(R.edge, Math.min(R.laneW - R.edge, r.x + (this.rnd() - 0.5) * sp * 2));
      this.runners.push({ id: this.ids++, kind: r.kind === 'fish' ? 'fish' : 'loaf', x, y: r.y - this.rnd() * 0.5, vx: (this.rnd() - 0.5) * R.wander * 2, w: r.w, mask: r.mask, age: 0 });
    }
    if (k > n) r.w += (k - n) * r.w;
    this.made.set(g, (this.made.get(g) ?? 0) + k * r.w);
  }

  /** The Big Basket spills `n` loaves at a gate (it keeps its own weight). */
  private spill(r: Runner, g: Gate, n: number): void {
    if (n <= 0) return;
    const R = RULES, room = Math.max(0, R.maxRunners - this.runners.length);
    const m = Math.min(n, room);
    for (let i = 0; i < m; i++) {
      const x = Math.max(R.edge, Math.min(R.laneW - R.edge, r.x + (this.rnd() - 0.5) * 2.6));
      this.runners.push({ id: this.ids++, kind: 'loaf', x, y: r.y + this.rnd() * 0.4, vx: (this.rnd() - 0.5) * 2, w: 1, mask: r.mask, age: 0 });
    }
    if (n > m) r.w += n - m;
    this.made.set(g, (this.made.get(g) ?? 0) + n);
    this.events.push({ type: 'spill', n, x: r.x, y: g.y });
  }

  private feed(r: Runner): void {
    const hungry = this.tables.filter(tb => !tb.fed);
    if (!hungry.length) return;
    let tb = hungry[0];
    for (const x of hungry) if (Math.abs(x.x - r.x) < Math.abs(tb.x - r.x)) tb = x;
    const n = Math.min(r.w, tb.hunger);
    tb.hunger -= n;
    tb.bite = 0;
    if (n > 0) this.events.push({ type: 'feed', n, x: r.x, table: tb.id, big: r.kind === 'big' });
    if (tb.hunger <= 0) this.tableFed(tb);
  }

  private tableFed(tb: Table): void {
    if (tb.fed) return;
    tb.hunger = 0;
    tb.fed = true;
    this.events.push({ type: 'tableFed', table: tb.id, x: tb.x });
  }

  // ── the gulls ───────────────────────────────────────────────────
  private waveTick(ctl: FieldCtl): void {
    const R = RULES;
    if (ctl.rest) return;
    if (this.wasRest) this.nextWave = Math.max(this.nextWave, this.t + R.waveAfterRest);
    if (ctl.quiet || this.done || this.t < this.nextWave) return;
    const L = this.plan.level;
    this.waves++;
    this.nextWave = this.t + Math.max(R.waveMin, R.waveGap - R.waveGapPerLevel * L) * (0.85 + 0.3 * this.rnd());
    const n = Math.min(R.waveMax, Math.round(R.waveN + R.wavePerLevel * L * (0.8 + 0.4 * this.rnd())));
    const fat = L >= R.fatFrom && this.waves % R.fatEvery === 0;
    const mirka = !fat && L >= R.mirkaFrom && this.waves % R.mirkaEvery === 2;
    const cx = 2.2 + this.rnd() * 5.6;
    const cols = Math.min(5, Math.ceil(Math.sqrt(n * 1.6)));
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const x = Math.max(R.edge, Math.min(R.laneW - R.edge, cx + (col - (cols - 1) / 2) * 0.85 + (this.rnd() - 0.5) * 0.3));
      this.gulls.push({ id: this.ids++, kind: 'gull', x, y: R.laneH - 0.6 + row * 0.75, w: 1, state: 'walk', t: 0, dir: 1, carry: false, lag: this.rnd() * 0.4 });
    }
    if (fat) this.gulls.push({ id: this.ids++, kind: 'fat', x: cx, y: R.laneH - 1.4, w: R.fatW, state: 'walk', t: 0, dir: 1, carry: false, lag: 0 });
    if (mirka) this.gulls.push({ id: this.ids++, kind: 'mirka', x: cx, y: R.laneH - 1.6, w: R.mirkaW, state: 'walk', t: 0, dir: 1, carry: false, lag: 0 });
    this.events.push({ type: 'wave', n: n + (fat ? 1 : 0) + (mirka ? 1 : 0), fat, mirka, x: cx });
  }

  private moveGulls(dt: number, ctl: FieldCtl): void {
    const R = RULES, gs = this.gulls;
    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      g.t += dt;
      if (g.state === 'gone') { gs.splice(i, 1); continue; }
      if (g.state === 'fly') {
        g.x += g.dir * 5 * dt;
        g.y += 3.2 * dt;
        if (g.t > 1.6) g.state = 'gone';
        continue;
      }
      if (ctl.rest && g.state === 'walk') { g.state = 'doze'; g.t = 0; }
      if (!ctl.rest && g.state === 'doze') { g.state = 'walk'; g.t = 0; }
      if (g.state === 'doze') continue;
      if (g.t < g.lag) continue;
      const speed = R.gullSpeed * (g.kind === 'fat' ? 0.7 : g.kind === 'mirka' ? 1.15 : 1);
      g.y -= speed * dt;
      // drift toward the basket in the lower half (they want the bread at its source)
      if (g.y < R.laneH * 0.55) g.x += Math.sign(ctl.basketX - g.x) * Math.min(Math.abs(ctl.basketX - g.x), 0.6 * dt);
      if (g.y <= 0.7) {
        this.events.push({ type: 'peck', x: g.x, kind: g.kind });
        this.fly(g, false);
      }
    }
  }

  private fly(g: Gull, carry: boolean): void {
    g.state = 'fly';
    g.t = 0;
    g.carry = carry;
    g.dir = g.x < RULES.laneW / 2 ? -1 : 1;
  }

  private movePelikan(dt: number, ctl: FieldCtl): void {
    const P = this.pelikan, R = RULES;
    if (!P) return;
    P.t += dt;
    P.gulp += dt;
    if (P.state === 'come') {
      P.y -= 2.2 * dt;
      if (P.y <= R.pelikanY) { P.y = R.pelikanY; P.state = 'walk'; P.t = 0; }
    } else if (P.state === 'walk') {
      if (!ctl.rest && P.y > R.pelikanStop) P.y -= R.pelikanSpeed * dt;
      P.x = 5 + Math.sin(P.t * R.pelikanSway) * 2.4;
    } else if (P.state === 'sated') {
      P.x += (P.x < 5 ? -1 : 1) * 2.2 * dt;
      if (P.t > 3) P.state = 'gone';
    } else if (P.state === 'gone') this.pelikan = null;
  }

  // ── the meetings ────────────────────────────────────────────────
  private collide(): void {
    const R = RULES, rs = this.runners, P = this.pelikan;
    const live = this.gulls.filter(g => g.state === 'walk' || g.state === 'doze');
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      const rr = r.kind === 'big' ? R.bigR : R.runnerR;
      if (P && P.state === 'walk' && P.pouch > 0) {
        const dx = r.x - P.x, dy = r.y - P.y, d = rr + R.pelikanR;
        if (dx * dx + dy * dy < d * d) {
          const k = Math.min(r.w, P.pouch);
          P.pouch -= k;
          r.w -= k;
          P.gulp = 0;
          this.events.push({ type: 'gulp', n: k, x: P.x, y: P.y });
          if (P.pouch <= 0) {
            P.state = 'sated';
            P.t = 0;
            this.events.push({ type: 'sated', x: P.x, y: P.y });
          }
          if (r.w <= 0) { rs.splice(i, 1); continue; }
        }
      }
      for (const g of live) {
        if (g.state !== 'walk' && g.state !== 'doze') continue;
        const gr = g.kind === 'fat' ? R.fatR : R.gullR;
        const dx = r.x - g.x, dy = r.y - g.y, d = rr + gr;
        if (dx * dx + dy * dy >= d * d) continue;
        if (g.state === 'doze') {
          // a dozing gull is only shooed away: the bread runs on
          this.fly(g, false);
          this.events.push({ type: 'shoo', x: g.x, y: g.y });
          continue;
        }
        const k = Math.min(r.w, g.w);
        r.w -= k;
        g.w -= k;
        this.events.push({ type: 'snatch', n: k, x: g.x, y: g.y, kind: g.kind });
        if (g.w <= 0) this.fly(g, true);
        if (r.w <= 0) break;
      }
      if (r.w <= 0) rs.splice(i, 1);
    }
  }

  // ── grace ───────────────────────────────────────────────────────
  private help(dt: number): void {
    const R = RULES;
    if (this.done || this.t < R.helpAfter) return;
    if (!this.helping) {
      this.helping = true;
      this.events.push({ type: 'help' });
    }
    const rate = R.helpRate + R.helpGrow * (this.t - R.helpAfter);
    for (const tb of this.tables) {
      if (tb.fed) continue;
      tb.help += rate * dt;
      const n = Math.floor(tb.help);
      if (n <= 0) continue;
      tb.help -= n;
      tb.hunger -= n;
      if (tb.hunger <= 0) {
        this.byHelp = true;
        this.tableFed(tb);
      }
    }
  }

  /** The session ends on this terrace: the disciples feed the rest at once. */
  endNow(): void {
    if (this.done) return;
    this.byHelp = true;
    for (const tb of this.tables) this.tableFed(tb);
    this.done = true;
    this.events.push({ type: 'cleared', byHelp: true });
  }

  take(): FieldEvent[] {
    if (!this.events.length) return [];
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }
}
