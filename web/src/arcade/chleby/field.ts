/**
 * One terrace of Chleby i ryby (v3, after Mob Control), without the DOM or the canvas: the lane up
 * the hillside, the gates and the lane's elements, the stream of bread-bearers running up through
 * them, the gull waves waddling down to meet them, a boss on an arena terrace, the gulls that carry
 * bread through the air, and the tables of the hungry at the top.  The session (sim.ts) fires the
 * runners and says what the golden gate multiplies by; the field moves everything and reports what
 * happened as events (`take()`).
 *
 *   a runner   a bread on little legs (a loaf, a bun, a flatbread, a barley cake, a big round loaf,
 *              a fish from the harbour, a golden loaf) with its worth and speed — or a champion: the
 *              Big Basket (spills loaves at gates), the donkey (gulls he meets eat crumbs from his
 *              panniers and fly bread up to the tables), the cart (fastest, shoos the gulls), the
 *              giant loaf (bursts into a shower of loaves at a tap) or the camel (gulls bounce off).
 *              Past the crowd cap a multiplying gate makes a runner heavier instead of adding more.
 *   a gate     honey ×n: each runner through it becomes n (once per gate); green +n: the first
 *              runner to touch it pops n more, then it recharges; grey −n swallows n, then breaks
 *              for a while; the jar drinks loaves until it is full, then opens as ×3 for a while;
 *              the golden gate multiplies by what the band says (×1 … ×5, in halves: the fractions
 *              carry over from runner to runner).  A flatbread slips under grey gates and the jar.
 *   elements   pebble arrows (runners sprint straight up), the brook (it carries runners sideways,
 *              except on its stepping stones), boulders (runners flow around them)
 *   a gull     waddles down toward the basket in a wave; meeting runners, it snatches loaves one
 *              for one (its worth: 1, Mirka 4, Gerwazy the fat gull 6) and flies off with them; one
 *              that reaches the basket pecks it.  In a rest block the gulls doze and are only shooed.
 *   a carrier  a gull flying a loaf (or a few) to the hungriest table: the donkey's friends, Mirka's
 *              family (the help)
 *   a boss     on a chapter's last terrace (boss.ts): fed until sated, then it leaves
 *   a table    a group of the hungry on a blanket with its hunger (the "base").  All tables fed =
 *              the terrace is done.  Grace: after a while the disciples help (and feed the boss too).
 */
import { mulberry32 } from '../../core/random';
import { feedBoss, makeBoss, pouchOf, stepBoss, stunBoss, type Boss, type BossEvent } from './boss';
import type { ChlebId, MistrzId, PomocId } from './cards';
import { BOSSES, type BossKind, type DayKind } from './meta';
import { RULES } from './rules';

export type GateKind = 'add' | 'mul' | 'sub' | 'gold' | 'start' | 'jar' | 'help';
export type Look = ChlebId | 'fish' | 'gold';
export type GullKind = 'gull' | 'fat' | 'mirka';

export interface Gate {
  id: number;
  kind: GateKind;
  /** mul / add / sub / start / help: its number; jar: its multiplier when open; gold: the multiplier now */
  n: number;
  y: number;
  half: number;
  /** the slide: centre x0, amplitude, angular speed, phase; x = the centre now */
  x0: number;
  slide: number;
  speed: number;
  phase: number;
  x: number;
  /** add: 0..1, ready at 1; sub and jar: the count left and the seconds broken */
  charge: number;
  left: number;
  down: number;
  /** gold: the fraction of a runner carried over; flash 0..1 after a pass (the view) */
  carry: number;
  flash: number;
  /** runners made by this gate on this terrace */
  made: number;
  /** jar: loaves it drinks before it opens, seconds it stays open; help: seconds it stays */
  need: number;
  open: number;
  life: number;
}

export interface Runner {
  id: number;
  x: number;
  y: number;
  vx: number;
  /** people it feeds (and how many gull bites stop it) */
  w: number;
  /** the gates it went through (bit = gate id) */
  mask: number;
  age: number;
  look: Look;
  /** u/s up the hill */
  speed: number;
  /** a flatbread: slips under grey gates and the jar, the brook can't carry it */
  flat: boolean;
  /** from the oven (the view's glow) */
  warm: boolean;
  /** a champion (null: a small runner) and its card's evolution */
  champ: MistrzId | null;
  evo: number;
  /** the giant loaf: seconds to its own burst, and the loaves it bursts into */
  fuse: number;
  burst: number;
  /** butted by the goat: seconds of the roll (the view); a one-time effect already done (the cart on a boss) */
  tumble: number;
  hit: boolean;
}

/** What the basket fires. */
export interface Shot {
  look: Look;
  w: number;
  speed: number;
  flat?: boolean;
  warm?: boolean;
  champ?: MistrzId | null;
  evo?: number;
  /** the giant loaf's burst */
  burst?: number;
  /** an exact sideways offset from the basket (no jitter) */
  dx?: number;
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

/** A gull flying bread to a table (the donkey's friends; Mirka's family). */
export interface Carrier {
  id: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  table: number;
  w: number;
  t: number;
  dur: number;
  from: 'mewy' | 'osiol';
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

/** Pebble arrows (runners on them sprint straight up), the brook, a boulder. */
export interface Pad { x: number; half: number; y0: number; y1: number }
export interface Brook { y0: number; y1: number; dir: 1 | -1; speed: number }
export interface Rock { x: number; y: number; r: number }

export interface GateSpec { kind: 'add' | 'mul' | 'sub' | 'start' | 'jar'; n: number; y: number; x0: number; slide: number; half?: number }

export interface TerracePlan {
  level: number;
  /** this terrace in its level, and how many the level has */
  index: number;
  of: number;
  chapter: number;
  circle: number;
  /** the level's place in its chapter (0..3); the last one ends in a boss arena */
  local: number;
  boss: boolean;
  /** the boss waiting on this terrace (its arena's layout), or null */
  arena: BossKind | null;
  tables: { x: number; half: number; hunger: number }[];
  gates: GateSpec[];
  goldY: number;
  hunger: number;
  pads: Pad[];
  brook: Brook | null;
  rocks: Rock[];
}

export type FieldEvent =
  /** a gate made runners (one event per gate per step) */
  | { type: 'gate'; kind: GateKind; n: number; made: number; x: number; y: number }
  | { type: 'feed'; n: number; x: number; table: number; big: boolean; air: boolean }
  | { type: 'tableFed'; table: number; x: number }
  | { type: 'snatch'; n: number; x: number; y: number; kind: GullKind }
  | { type: 'peck'; x: number; kind: GullKind }
  | { type: 'shoo'; x: number; y: number }
  | { type: 'wave'; n: number; fat: boolean; mirka: boolean; x: number }
  | { type: 'boss'; kind: BossKind }
  | BossEvent
  | { type: 'spill'; n: number; x: number; y: number }
  | { type: 'swallow'; n: number; x: number; y: number; jar: boolean }
  | { type: 'break'; x: number; y: number }
  | { type: 'jarOpen'; x: number; y: number }
  | { type: 'befriend'; n: number; x: number; y: number }
  | { type: 'burst'; n: number; x: number; y: number }
  | { type: 'ram'; n: number; x: number; y: number }
  | { type: 'helped'; id: PomocId; n: number }
  | { type: 'disciples' }
  | { type: 'cleared'; byHelp: boolean };

/** What the session tells the field each step. */
export interface FieldCtl {
  /** the golden gate's multiplier now (1 when the band is not asked or not heard) */
  gold: number;
  /** a rest block: no new waves, the gulls and the boss doze */
  rest: boolean;
  /** the finale or a card between levels: no new waves */
  quiet: boolean;
  /** where the basket is (u): the gulls drift toward it */
  basketX: number;
}

const LEVEL_SALT = 0x5bd1e995;
/** the summoned gate's id (a bit of the runners' mask; plan gates use the low ids) */
const HELP_GATE = 30;

// ── the path ─────────────────────────────────────────────────────
export function placeOf(level: number): { chapter: number; circle: number; local: number } {
  const L = Math.max(0, Math.floor(level)), R = RULES;
  const ch = Math.floor(L / R.chapter);
  return { chapter: ch % R.chapters, circle: Math.floor(ch / R.chapters), local: L % R.chapter };
}

export const isBoss = (level: number): boolean => placeOf(level).local === RULES.chapter - 1;

/** The boss of a chapter's arena. */
export const bossOf = (chapter: number): BossKind => BOSSES[((chapter % BOSSES.length) + BOSSES.length) % BOSSES.length];

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
 * its gates (a ×2 first; then pairs to choose from, green bursts, grey takers, the jar), the golden
 * gate in the middle, the lane's elements as the levels grow, and its hunger.  The last terrace of a
 * chapter's last level is the boss's arena, with a layout of its own.
 */
export function planTerrace(level: number, index: number, startLevel = 0): TerracePlan {
  const R = RULES, L = Math.max(0, Math.floor(level));
  const { chapter, circle, local } = placeOf(L);
  const of = terracesOf(L);
  const i = Math.max(0, Math.min(of - 1, index));
  const boss = local === R.chapter - 1;
  const arenaKind = boss && i === of - 1 ? bossOf(chapter) : null;
  const rnd = mulberry32((L * 2654435761 + i * 97 + LEVEL_SALT) >>> 0);
  const hunger = Math.max(10, Math.round((levelHunger(L) * (0.7 + 0.15 * i) * (arenaKind ? R.bossHunger : 1)) / 2) * 2);
  const amp = (k: number) => Math.min(2.6, 1.2 + 0.12 * L) * k;
  const addN = 5 + 5 * Math.min(3, Math.floor(L / 3));
  const base = { level: L, index: i, of, chapter, circle, local, boss, arena: arenaKind };
  const start: GateSpec[] = startLevel > 0 ? [{ kind: 'start', n: 2, y: R.startY, x0: 5, slide: 2.6 }] : [];
  const one = [{ x: 5, half: 2.7, hunger }];
  const two = [{ x: 2.6, half: 1.8, hunger: hunger / 2 }, { x: 7.4, half: 1.8, hunger: hunger / 2 }];
  const plan = (o: Pick<TerracePlan, 'tables' | 'gates' | 'goldY'> & Partial<Pick<TerracePlan, 'pads' | 'brook' | 'rocks'>>): TerracePlan => ({
    ...base, pads: [], brook: null, rocks: [], ...o, gates: [...o.gates, ...start], hunger: o.tables.reduce((s, t) => s + t.hunger, 0),
  });
  if (arenaKind) {
    const first: GateSpec = { kind: 'mul', n: 2, y: 3.6, x0: 5, slide: amp(1) };
    switch (arenaKind) {
      case 'pelikan':
        return plan({
          tables: one, goldY: 8.4,
          gates: [first, { kind: 'mul', n: L >= 6 ? 3 : 2, y: 12.6, x0: 2.6, slide: 0.4 }, { kind: 'add', n: addN, y: 12.6, x0: 7.4, slide: 0.4 },
            ...(L >= R.jarFrom ? [{ kind: 'jar', n: R.jarMult, y: 5.9, x0: 5, slide: 1.2 } as GateSpec] : [])],
        });
      case 'koziol':
        return plan({
          tables: two, goldY: 8.4,
          gates: [first, { kind: 'add', n: addN, y: 13.8, x0: 5, slide: 0 }],
          rocks: [{ x: 3.4, y: 12.6, r: 0.6 }, { x: 6.6, y: 12.6, r: 0.6 }],
          pads: [{ x: 1.5, half: 0.9, y0: 13.2, y1: 15.8 }, { x: 8.5, half: 0.9, y0: 13.2, y1: 15.8 }],
        });
      case 'czapla':
        return plan({
          tables: one, goldY: 7.2,
          gates: [first, { kind: 'mul', n: 3, y: 14.8, x0: 5, slide: 2.4, half: 1.05 }],
          brook: { y0: 10.4, y1: 12.4, dir: L % 2 ? 1 : -1, speed: R.brookSpeed },
          pads: [{ x: 2.2, half: 0.75, y0: 10.2, y1: 12.6 }, { x: 7.8, half: 0.75, y0: 10.2, y1: 12.6 }],
        });
      case 'kormorany':
        return plan({
          tables: two, goldY: 7,
          gates: [first, { kind: 'mul', n: 2, y: 12.4, x0: 1.8, slide: 0.25, half: 1.05 }, { kind: 'mul', n: 3, y: 12.4, x0: 8.2, slide: 0.25, half: 1.05 },
            { kind: 'add', n: addN, y: 16, x0: 5, slide: 0.6 }],
          rocks: [{ x: 3.4, y: 10.4, r: 0.45 }, { x: 6.6, y: 10.4, r: 0.45 }, { x: 3.4, y: 14.4, r: 0.45 }, { x: 6.6, y: 14.4, r: 0.45 }],
        });
    }
  }
  const tables = L >= R.twoFrom && (i + L) % 2 === 1 ? two : one;
  const gates: GateSpec[] = [];
  // the first row: a sliding ×2 (×3 later), the gate that teaches the joy
  gates.push({ kind: 'mul', n: L >= 6 && rnd() < 0.4 ? 3 : 2, y: 3.6, x0: 5, slide: amp(1) });
  // the lane's elements as the levels grow: at most two on a terrace
  const extras: ('pad' | 'jar' | 'rocks' | 'brook')[] = [];
  if (L >= R.sprintFrom && rnd() < 0.45) extras.push('pad');
  if (L >= R.jarFrom && rnd() < 0.4) extras.push('jar');
  if (L >= R.rocksFrom && rnd() < 0.35) extras.push('rocks');
  if (L >= R.brookFrom && rnd() < 0.3) extras.push('brook');
  const use = extras.slice(0, 2);
  // the rows above the golden gate: a choice of two, a green burst, or a grey taker (the jar takes its place)
  const upper = L === 0 ? 1 : L < 4 ? 2 : 3;
  const ys = [12.6, 15.8, 5.9];
  for (let k = 0; k < upper; k++) {
    const y = ys[k];
    const roll = rnd();
    if (k === 2) {
      // a low taker beside a lane left free: grey, or the jar that pays back
      const side = rnd() < 0.5 ? 3 : 7;
      if (use.includes('jar')) gates.push({ kind: 'jar', n: R.jarMult, y, x0: side, slide: amp(0.3) });
      else gates.push({ kind: 'sub', n: 4 + Math.floor(L / 2), y, x0: side, slide: amp(0.4) });
    } else if (L >= 1 && roll < 0.42) {
      // a choice: a bigger multiplier on one side, a burst or a taker on the other
      const left = rnd() < 0.5;
      const four = k === 1 && L >= R.fourFrom && rnd() < 0.35;
      gates.push({ kind: 'mul', n: four ? 4 : L >= 5 && rnd() < 0.5 ? 3 : 2, y, x0: left ? 2.6 : 7.4, slide: four ? 0.9 : 0.35, half: four ? 1 : undefined });
      if (L >= 2 && rnd() < 0.5) gates.push({ kind: 'sub', n: 3 + Math.floor(L / 2), y, x0: left ? 7.4 : 2.6, slide: 0.35 });
      else gates.push({ kind: 'add', n: addN, y, x0: left ? 7.4 : 2.6, slide: 0.35 });
    } else if (roll < 0.75 || L === 0) {
      gates.push({ kind: 'add', n: addN, y, x0: 5, slide: amp(0.9) });
    } else {
      const four = k === 1 && L >= R.fourFrom && rnd() < 0.35;
      gates.push({ kind: 'mul', n: four ? 4 : 2, y, x0: 5, slide: amp(four ? 1.3 : 1.1), half: four ? 1 : undefined });
    }
  }
  if (use.includes('jar') && upper < 3) gates.push({ kind: 'jar', n: R.jarMult, y: 5.9, x0: rnd() < 0.5 ? 3 : 7, slide: amp(0.3) });
  const padX = rnd() < 0.5 ? 2 : 8;
  return plan({
    tables, gates, goldY: 8.4,
    pads: use.includes('pad') ? [{ x: padX, half: 1, y0: 9.8, y1: 12.2 }] : use.includes('brook') ? [{ x: 10 - padX, half: 0.8, y0: 9.8, y1: 11.6 }] : [],
    brook: use.includes('brook') ? { y0: 10, y1: 11.4, dir: rnd() < 0.5 ? 1 : -1, speed: R.brookSpeed } : null,
    rocks: use.includes('rocks') ? [{ x: 3.3, y: 14.2, r: 0.5 }, { x: 6.7, y: 14.2, r: 0.5 }] : [],
  });
}

// ── the terrace ──────────────────────────────────────────────────
export interface FieldOpts {
  seed: number;
  /** the Brama's level (0: no start gate) */
  start?: number;
  /** the first wave waits longer (a first-ever session) */
  firstEver?: boolean;
  /** the day's weather */
  day?: DayKind;
}

export class Field {
  readonly plan: TerracePlan;
  readonly gates: Gate[] = [];
  readonly runners: Runner[] = [];
  readonly gulls: Gull[] = [];
  readonly carriers: Carrier[] = [];
  readonly tables: Table[];
  readonly pads: Pad[];
  readonly brook: Brook | null;
  readonly rocks: Rock[];
  boss: Boss | null = null;
  /** seconds on this terrace */
  t = 0;
  done = false;
  byHelp = false;
  helping = false;
  waves = 0;
  /** seconds of the lake's wind left (the help) */
  wind = 0;
  /** runners through the golden gate on this terrace (a mission counts them) */
  goldPassed = 0;
  /** the gold gate (always there) */
  readonly gold: Gate;
  private nextWave: number;
  private ids = 0;
  private readonly rnd: () => number;
  private readonly events: FieldEvent[] = [];
  private readonly made = new Map<Gate, number>();
  private wasRest = false;
  private readonly day: DayKind;
  private bossHelp = 0;

  constructor(plan: TerracePlan, opts: FieldOpts) {
    const R = RULES;
    this.plan = plan;
    this.day = opts.day ?? 'zwykly';
    this.rnd = mulberry32(opts.seed >>> 0);
    const slideSpeed = Math.min(R.slideMax, R.slideBase + R.slidePerLevel * plan.level);
    let id = 0;
    for (const g of plan.gates) {
      const half = g.kind === 'start' ? R.startHalf[Math.min(R.startHalf.length - 1, opts.start ?? 0)] : g.half ?? (g.kind === 'jar' ? R.jarHalf : R.gateHalf);
      if (half <= 0) continue;
      const gate = this.mkGate(id++, g.kind, g.n, g.y, half, g.x0, g.slide, slideSpeed * (0.8 + 0.4 * this.rnd()));
      if (g.kind === 'jar') {
        gate.need = R.jarNeed + Math.floor(plan.level / 2);
        gate.left = gate.need;
      }
      this.gates.push(gate);
    }
    this.gold = this.mkGate(id++, 'gold', 1, plan.goldY, R.goldHalf, 5, Math.min(2.3, 1 + 0.1 * plan.level), slideSpeed * 0.62);
    this.gates.push(this.gold);
    this.tables = plan.tables.map((tb, i) => ({ id: i, x: tb.x, half: tb.half, hunger: Math.round(tb.hunger), full: Math.round(tb.hunger), help: 0, bite: 9, fed: false }));
    this.pads = plan.pads.map(p => ({ ...p }));
    this.brook = plan.brook ? { ...plan.brook } : null;
    this.rocks = plan.rocks.map(r => ({ ...r }));
    this.nextWave = opts.firstEver && plan.level === 0 && plan.index === 0 ? R.waveFirstEver : R.waveFirst;
    if (this.day === 'cisza') this.nextWave += 6;
    if (plan.arena) {
      const brookY = this.brook ? (this.brook.y0 + this.brook.y1) / 2 : 11.4;
      this.boss = makeBoss(plan.arena, pouchOf(plan.arena, plan.chapter, plan.circle), brookY);
      this.events.push({ type: 'boss', kind: plan.arena });
    }
  }

  private mkGate(id: number, kind: GateKind, n: number, y: number, half: number, x0: number, slide: number, speed: number): Gate {
    const phase = this.rnd() * Math.PI * 2;
    const g: Gate = {
      id, kind, n, y, half, x0, slide, speed, phase, x: x0, charge: 1, left: n, down: 0, carry: 0, flash: 0, made: 0, need: 0, open: 0, life: Infinity,
    };
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
  /** the Pelikan, for the view and old callers */
  get pelikan(): Boss | null { return this.boss?.kind === 'pelikan' ? this.boss : null; }

  /** A runner leaves the basket at lane x. */
  fire(x: number, s: Shot): void {
    if (this.done) return;
    const R = RULES;
    const champ = s.champ ?? null;
    const e = champ ? R.bigR : R.edge;
    const cx = Math.max(e, Math.min(R.laneW - e, x + (s.dx ?? (this.rnd() - 0.5) * 0.5)));
    this.runners.push({
      id: this.ids++, x: cx, y: 0.35, vx: champ ? 0 : (this.rnd() - 0.5) * R.wander, w: s.w, mask: 0, age: 0, look: s.look, speed: s.speed,
      flat: !!s.flat, warm: !!s.warm, champ, evo: s.evo ?? 0, fuse: champ === 'olbrzym' ? R.champ.olbrzym.fuse : 0, burst: s.burst ?? 0, tumble: 0, hit: false,
    });
  }

  // ── a step ──────────────────────────────────────────────────────
  step(dt: number, ctl: FieldCtl): void {
    if (!(dt > 0)) return;
    const R = RULES;
    this.t += dt;
    this.wind = Math.max(0, this.wind - dt);
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.x = g.kind === 'gold' || g.slide > 0 ? this.slideX(g, this.t) : g.x0;
      g.flash = Math.max(0, g.flash - dt * 3);
      if (g.kind === 'gold') g.n = ctl.gold;
      if (g.kind === 'add' && g.charge < 1) g.charge = Math.min(1, g.charge + dt / R.addBack);
      if (g.kind === 'sub' && g.down > 0) {
        g.down -= dt;
        if (g.down <= 0) { g.down = 0; g.left = g.n; }
      }
      if (g.kind === 'jar' && g.open > 0) {
        g.open -= dt;
        if (g.open <= 0) { g.open = 0; g.left = g.need; }
      }
      if (g.kind === 'help') {
        g.life -= dt;
        if (g.life <= 0) this.gates.splice(i, 1);
      }
    }
    this.made.clear();
    this.moveRunners(dt);
    this.waveTick(ctl);
    this.moveGulls(dt, ctl);
    this.moveCarriers(dt);
    if (this.boss) {
      const brookY = this.brook ? (this.brook.y0 + this.brook.y1) / 2 : 11.4;
      stepBoss(this.boss, dt, { runners: this.runners, rest: ctl.rest, rnd: this.rnd, emit: e => this.events.push(e), brookY });
      if (this.boss.state === 'gone') this.boss = null;
    }
    this.collide();
    this.sweep();
    this.help(dt);
    for (const [g, made] of this.made) {
      g.made += made;
      g.flash = 1;
      this.events.push({ type: 'gate', kind: g.kind, n: g.kind === 'jar' ? R.jarMult : g.n, made, x: g.x, y: g.y });
    }
    for (const tb of this.tables) tb.bite += dt;
    // an arena is done when the tables are fed and its glutton has been sated (the disciples see to both in the end)
    const bossOut = !this.boss || this.boss.state === 'sated' || this.boss.state === 'gone';
    if (!this.done && bossOut && this.tables.every(tb => tb.fed)) {
      this.done = true;
      this.events.push({ type: 'cleared', byHelp: this.byHelp });
    }
    this.wasRest = ctl.rest;
  }

  private onPad(x: number, y: number): boolean {
    for (const p of this.pads) if (y >= p.y0 && y <= p.y1 && Math.abs(x - p.x) <= p.half) return true;
    return false;
  }

  private moveRunners(dt: number): void {
    const R = RULES, rs = this.runners;
    const hungry = this.tables.filter(tb => !tb.fed);
    const wind = this.wind > 0 ? R.help.wiatr.speed : 1;
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      if (r.w <= 0) continue;
      r.age += dt;
      r.tumble = Math.max(0, r.tumble - dt);
      const py = r.y;
      const pad = !r.champ && this.onPad(r.x, r.y);
      let sp = r.speed * wind * (pad ? R.sprint : 1);
      if (r.tumble > 0) sp *= 0.25;
      r.y += sp * dt;
      if (pad) r.vx *= Math.max(0, 1 - dt * 8);
      else if (r.y > R.pullFrom && hungry.length && !r.champ) {
        // the pull toward the nearest hungry table in the top rows
        let best = hungry[0];
        for (const tb of hungry) if (Math.abs(tb.x - r.x) < Math.abs(best.x - r.x)) best = tb;
        const dx = best.x - r.x, inside = Math.abs(dx) < best.half * 0.75;
        const want = inside ? 0 : Math.sign(dx) * Math.min(R.pull, Math.abs(dx) * 2);
        r.vx += (want - r.vx) * Math.min(1, dt * 5);
      } else if (!r.champ && r.tumble <= 0 && this.rnd() < dt * 2) r.vx = (this.rnd() - 0.5) * 2 * R.wander;
      else if (r.champ && r.y > R.pullFrom && hungry.length) {
        let best = hungry[0];
        for (const tb of hungry) if (Math.abs(tb.x - r.x) < Math.abs(best.x - r.x)) best = tb;
        r.vx = Math.sign(best.x - r.x) * Math.min(1.2, Math.abs(best.x - r.x) * 2);
      }
      r.x += r.vx * dt;
      // the brook carries what is not on its stones, not flat and not a champion
      const b = this.brook;
      if (b && r.y >= b.y0 && r.y <= b.y1 && !pad && !r.flat && !r.champ) r.x += b.dir * b.speed * dt;
      // boulders: runners flow around them
      const rr = r.champ ? R.bigR : R.runnerR;
      for (const k of this.rocks) {
        const dx = r.x - k.x, dy = r.y - k.y, d = Math.hypot(dx, dy), min = k.r + rr;
        if (d >= min || d === 0) continue;
        // pushed out sideways mostly, so the stream parts around the stone
        const side = dx === 0 ? (this.rnd() < 0.5 ? -1 : 1) : Math.sign(dx);
        r.x = k.x + side * Math.sqrt(Math.max(0, min * min - dy * dy)) + side * 0.01;
        r.vx = side * Math.max(Math.abs(r.vx), 0.6);
      }
      const e = r.champ ? R.bigR : R.edge;
      if (r.x < e) { r.x = e; r.vx = Math.abs(r.vx); }
      if (r.x > R.laneW - e) { r.x = R.laneW - e; r.vx = -Math.abs(r.vx); }
      // the gates it crosses this step
      for (const g of this.gates) {
        if (g.y <= py || g.y > r.y) continue;
        const bit = 1 << g.id;
        if (r.mask & bit) continue;
        if (Math.abs(r.x - g.x) > g.half + (r.champ ? 0.4 : 0)) continue;
        r.mask |= bit;
        if (!this.pass(r, g)) break;
      }
      if (r.w <= 0) continue;
      // the giant loaf bursts by itself after its fuse, or at the tables
      if (r.champ === 'olbrzym') {
        r.fuse -= dt;
        if (r.fuse <= 0 || r.y >= R.laneH - 0.6) { this.burstRunner(r); continue; }
      }
      // the top: the nearest hungry table eats; when every table is full, the glutton still waiting gets it
      if (r.y >= R.laneH - 0.25) {
        const B = this.boss;
        if (B && B.state === 'act' && this.tables.every(tb => tb.fed)) feedBoss(B, r.w, e => this.events.push(e), { x: r.x, y: r.y });
        else this.feed(r.x, r.w, r.champ !== null, false);
        r.w = 0;
      }
    }
  }

  /** A runner goes through a gate; false when the gate swallowed it whole. */
  private pass(r: Runner, g: Gate): boolean {
    const R = RULES;
    switch (g.kind) {
      case 'mul':
      case 'start':
      case 'help':
        if (r.champ) this.champGate(r, g, g.n, false);
        else this.clone(r, g, g.n - 1);
        return true;
      case 'gold': {
        const m = g.n;
        this.goldPassed++;
        if (m <= 1) return true;
        if (r.champ) { this.champGate(r, g, m, false); return true; }
        g.carry += m - 1;
        const k = Math.floor(g.carry);
        g.carry -= k;
        this.clone(r, g, k);
        return true;
      }
      case 'add':
        if (g.charge < 1) return true;
        g.charge = 0;
        if (r.champ) this.champGate(r, g, g.n, true);
        else this.clone(r, g, g.n, true);
        return true;
      case 'jar': {
        if (g.open > 0) {
          if (r.champ) this.champGate(r, g, R.jarMult, false);
          else this.clone(r, g, R.jarMult - 1);
          return true;
        }
        if (r.flat) return true;
        const take = Math.min(r.w, g.left);
        r.w -= take;
        g.left -= take;
        g.flash = 1;
        this.events.push({ type: 'swallow', n: take, x: r.x, y: g.y, jar: true });
        if (g.left <= 0) {
          g.open = R.jarOpen;
          g.left = 0;
          this.events.push({ type: 'jarOpen', x: g.x, y: g.y });
        }
        return r.w > 0;
      }
      case 'sub': {
        if (g.down > 0 || g.left <= 0 || r.flat) return true;
        const take = Math.min(r.w, g.left);
        r.w -= take;
        g.left -= take;
        g.flash = 1;
        this.events.push({ type: 'swallow', n: take, x: r.x, y: g.y, jar: false });
        if (g.left <= 0) {
          g.down = R.greyBack;
          this.events.push({ type: 'break', x: g.x, y: g.y });
        }
        return r.w > 0;
      }
    }
  }

  /** A champion goes through a gate of multiplier `m` (or a green gate's +m). */
  private champGate(r: Runner, g: Gate, m: number, add: boolean): void {
    const C = RULES.champ, e = Math.max(0, Math.min(3, r.evo));
    const pts = add ? m / 5 : m - 1;
    if (pts <= 0) return;
    switch (r.champ) {
      case 'kosz': this.spill(r, g, Math.round(pts * C.kosz.spill[e])); break;
      case 'woz': this.spill(r, g, Math.round(pts * C.woz.spill[e])); break;
      case 'olbrzym': r.burst += pts * C.olbrzym.perGate; this.made.set(g, (this.made.get(g) ?? 0) + Math.round(pts * C.olbrzym.perGate)); break;
      case 'wielblad': {
        const k = Math.round(pts * C.wielblad.perGate[e]);
        r.w += k;
        this.made.set(g, (this.made.get(g) ?? 0) + k);
        break;
      }
      default: break;
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
      this.runners.push({ ...r, id: this.ids++, x, y: r.y - this.rnd() * 0.5, vx: (this.rnd() - 0.5) * R.wander * 2, age: 0, tumble: 0, hit: false });
    }
    if (k > n) r.w += (k - n) * r.w;
    this.made.set(g, (this.made.get(g) ?? 0) + k * r.w);
  }

  /** A champion spills `n` loaves at a gate (it keeps its own weight). */
  private spill(r: Runner, g: Gate, n: number): void {
    if (n <= 0) return;
    const m = this.spawnLoaves(r.x, r.y, n, 2.6, r.mask);
    if (n > m) r.w += n - m;
    this.made.set(g, (this.made.get(g) ?? 0) + n);
    this.events.push({ type: 'spill', n, x: r.x, y: g.y });
  }

  /** Loaves on little legs around (x, y), as many as there is room for; returns how many. */
  private spawnLoaves(x: number, y: number, n: number, spread: number, mask: number): number {
    const R = RULES, room = Math.max(0, R.maxRunners - this.runners.length);
    const m = Math.min(n, room);
    for (let i = 0; i < m; i++) {
      const cx = Math.max(R.edge, Math.min(R.laneW - R.edge, x + (this.rnd() - 0.5) * spread));
      this.runners.push({
        id: this.ids++, x: cx, y: Math.max(0.3, y + (this.rnd() - 0.3) * 0.8), vx: (this.rnd() - 0.5) * 2, w: 1, mask, age: 0, look: 'bochenek',
        speed: R.loafSpeed, flat: false, warm: false, champ: null, evo: 0, fuse: 0, burst: 0, tumble: 0, hit: false,
      });
    }
    return m;
  }

  /** The giant loaf bursts: a shower of loaves that run on from where it was (the gates above multiply them). */
  private burstRunner(r: Runner): void {
    const R = RULES;
    const n = Math.max(1, Math.round(r.burst));
    r.w = 0;
    const m = this.spawnLoaves(r.x, r.y, n, 3.2, r.mask);
    // what there was no room for goes straight to the tables
    if (n > m) this.feed(r.x, n - m, false, false);
    let shooed = 0;
    for (const g of this.gulls) {
      if (g.state !== 'walk' && g.state !== 'doze') continue;
      if (Math.hypot(g.x - r.x, g.y - r.y) > R.champ.olbrzym.shoo) continue;
      this.fly(g, false);
      shooed++;
    }
    this.events.push({ type: 'burst', n, x: r.x, y: r.y });
    if (shooed) this.events.push({ type: 'shoo', x: r.x, y: r.y });
  }

  /** A tap bursts the oldest giant loaf on the lane; true when one burst. */
  burstChampion(): boolean {
    const r = this.runners.find(x => x.champ === 'olbrzym' && x.w > 0);
    if (!r) return false;
    this.burstRunner(r);
    return true;
  }

  /** Feed `n` people at the top near x: the nearest hungry table first, the rest to the next. */
  private feed(x: number, n: number, big: boolean, air: boolean, table?: number): void {
    let left = n;
    for (let guard = 0; left > 0 && guard <= this.tables.length; guard++) {
      const hungry = this.tables.filter(tb => !tb.fed);
      if (!hungry.length) return;
      const want = guard === 0 && table !== undefined ? this.tables[table] : undefined;
      let tb = hungry[0];
      if (want && !want.fed) tb = want;
      else for (const t of hungry) if (Math.abs(t.x - x) < Math.abs(tb.x - x)) tb = t;
      const k = Math.min(left, tb.hunger);
      tb.hunger -= k;
      tb.bite = 0;
      left -= k;
      if (k > 0) this.events.push({ type: 'feed', n: k, x: air ? tb.x : x, table: tb.id, big, air });
      if (tb.hunger <= 0) this.tableFed(tb);
    }
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
    if (this.wind > 0) { this.nextWave = this.t + 0.5; return; }
    const L = this.plan.level;
    this.waves++;
    const gap = Math.max(R.waveMin, R.waveGap - R.waveGapPerLevel * L) * (0.85 + 0.3 * this.rnd());
    this.nextWave = this.t + gap * (this.day === 'cisza' ? 1.25 : 1);
    const many = this.day === 'rodzina' ? 1.3 : 1;
    const n = Math.min(R.waveMax, Math.round((R.waveN + R.wavePerLevel * L * (0.8 + 0.4 * this.rnd())) * many));
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
      if (this.wind > 0) {
        // the lake's wind blows them back up the hill, flapping
        g.y += R.help.wiatr.push * dt;
        if (g.y > R.laneH + 0.5) g.state = 'gone';
        continue;
      }
      const speed = R.gullSpeed * (g.kind === 'fat' ? 0.7 : g.kind === 'mirka' ? 1.15 : 1);
      g.y -= speed * dt;
      // drift toward the basket in the lower half (they want the bread at its source)
      if (g.y < R.laneH * 0.55) g.x += Math.sign(ctl.basketX - g.x) * Math.min(Math.abs(ctl.basketX - g.x), 0.6 * dt);
      for (const k of this.rocks) {
        const dx = g.x - k.x, dy = g.y - k.y, d = Math.hypot(dx, dy), min = k.r + R.gullR;
        if (d < min && d > 0) { g.x = k.x + (dx / d) * min; g.y = k.y + (dy / d) * min; }
      }
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

  // ── the carriers (gulls with bread, flying to the tables) ───────
  private carrier(x0: number, y0: number, w: number, from: Carrier['from']): void {
    const hungry = this.tables.filter(tb => !tb.fed);
    if (!hungry.length) return;
    // the hungriest table first, then the nearest
    let tb = hungry[0];
    for (const t of hungry) if (t.hunger > tb.hunger || (t.hunger === tb.hunger && Math.abs(t.x - x0) < Math.abs(tb.x - x0))) tb = t;
    const dist = Math.hypot(tb.x - x0, RULES.laneH - y0);
    this.carriers.push({ id: this.ids++, x: x0, y: y0, x0, y0, table: tb.id, w, t: 0, dur: Math.max(0.6, dist / RULES.carrierSpeed), from });
  }

  private moveCarriers(dt: number): void {
    const R = RULES, cs = this.carriers;
    for (let i = cs.length - 1; i >= 0; i--) {
      const c = cs[i];
      c.t += dt;
      const tb = this.tables[c.table];
      const k = Math.min(1, c.t / c.dur);
      // an arc: up and over, landing on the cloth
      const tx = tb ? tb.x : c.x0, ty = R.laneH - 0.2;
      c.x = c.x0 + (tx - c.x0) * k;
      c.y = c.y0 + (ty - c.y0) * k + Math.sin(k * Math.PI) * 2.2;
      if (c.t >= c.dur) {
        cs.splice(i, 1);
        if (!this.done) this.feed(c.x, c.w, false, true, c.table);
      }
    }
  }

  // ── the meetings ────────────────────────────────────────────────
  private collide(): void {
    const R = RULES, rs = this.runners, C = R.champ;
    const live = this.gulls.filter(g => g.state === 'walk' || g.state === 'doze');
    const B = this.boss;
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      if (r.w <= 0) continue;
      const rr = r.champ ? R.bigR : R.runnerR;
      // the champions' own ways with gulls and bosses
      if (r.champ === 'osiol' || r.champ === 'woz' || r.champ === 'wielblad') {
        const e = Math.max(0, Math.min(3, r.evo));
        const reach = r.champ === 'osiol' ? C.osiol.reach[e] : r.champ === 'woz' ? C.woz.reach[e] : rr + R.gullR;
        let n = 0;
        for (const g of live) {
          if (g.state !== 'walk' && g.state !== 'doze') continue;
          if ((g.x - r.x) ** 2 + (g.y - r.y) ** 2 > reach * reach) continue;
          if (r.champ === 'osiol') {
            // a crumb from the panniers, and off it flies with bread for the people
            g.state = 'gone';
            this.carrier(g.x, g.y, C.osiol.carry[e] * Math.max(1, g.w), 'osiol');
          } else this.fly(g, false);
          n++;
        }
        if (n) this.events.push({ type: r.champ === 'osiol' ? 'befriend' : 'ram', n, x: r.x, y: r.y });
        if (r.champ === 'woz' && B && B.state === 'act' && !r.hit && Math.hypot(B.x - r.x, B.y - r.y) < 2.2) {
          r.hit = true;
          stunBoss(B, C.woz.stun);
          this.events.push({ type: 'ram', n: 0, x: B.x, y: B.y });
        }
        if (r.champ !== 'osiol') continue;
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
    }
  }

  /** Runners with nothing left go. */
  private sweep(): void {
    const rs = this.runners;
    let j = 0;
    for (let i = 0; i < rs.length; i++) if (rs[i].w > 0) rs[j++] = rs[i];
    rs.length = j;
  }

  // ── the helps ───────────────────────────────────────────────────
  /** A help card comes into play (`evo` 0..3, `power` its level's factor, `x` the basket). */
  useHelp(id: PomocId, evo: number, power: number, x: number): void {
    const R = RULES, H = R.help, e = Math.max(0, Math.min(3, evo));
    let n = 0;
    switch (id) {
      case 'mewy': {
        const each = Math.max(1, Math.round(H.mewy.each * power));
        n = H.mewy.gulls[e];
        for (let i = 0; i < n; i++) this.carrier(1 + (i + 0.5) * (8 / n) + (this.rnd() - 0.5), R.laneH + 4 + this.rnd() * 2, each, 'mewy');
        n *= each;
        break;
      }
      case 'siec':
        for (const g of this.gulls) {
          if (g.state !== 'walk' && g.state !== 'doze') continue;
          this.fly(g, false);
          n++;
        }
        if (this.boss) stunBoss(this.boss, H.siec.stun[e] * power);
        break;
      case 'wiatr':
        this.wind = H.wiatr.sec[e] * power;
        break;
      case 'bramka': {
        const old = this.gates.findIndex(g => g.id === HELP_GATE);
        if (old >= 0) this.gates.splice(old, 1);
        const g = this.mkGate(HELP_GATE, 'help', H.bramka.mult[e], H.bramka.y, H.bramka.half[e], Math.max(H.bramka.half[e], Math.min(R.laneW - H.bramka.half[e], x)), 0, 0);
        g.life = H.bramka.sec[e] * power;
        this.gates.push(g);
        n = g.n;
        break;
      }
    }
    this.events.push({ type: 'helped', id, n });
  }

  // ── grace ───────────────────────────────────────────────────────
  private help(dt: number): void {
    const R = RULES;
    if (this.done || this.t < R.helpAfter) return;
    if (!this.helping) {
      this.helping = true;
      this.events.push({ type: 'disciples' });
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
    // the disciples bring the boss a share too, so it always leaves in the end
    const B = this.boss;
    if (B && B.state === 'act') {
      this.bossHelp += rate * dt;
      const n = Math.floor(this.bossHelp);
      if (n > 0) {
        this.bossHelp -= n;
        feedBoss(B, n, e => this.events.push(e));
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
