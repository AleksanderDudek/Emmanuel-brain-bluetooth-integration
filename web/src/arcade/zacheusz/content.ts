/**
 * Zacheusz's data: three worlds of four hand-made levels (Super Mario Run's World Tour, our own
 * streets of Jericho), built in code with a small cursor builder so each level reads like a sketch;
 * the fig orchard of a rest block; the twelve households of "Czterokrotnie" (Luke 19:8); the
 * missions; and the strategies under a block's name.  The rules read it (world.ts, sim.ts, meta.ts);
 * the words come from the catalog (i18n.ts) in this page's language.
 *
 * A level's coordinates are in u from its start; the street's top is y = 0 and has ground
 * everywhere except in its pits.  Every level has five special denarii for each of its three sets
 * (silver, then gold, then purple on replays — Mario's pink, purple and black), each set in other,
 * harder places; the purple ones mostly hang in the light road's lane (y ≈ 4), reachable by a held
 * bounce or a wall climb, and easy from the road the band builds.
 */
import { t, type Key } from './i18n';
import { RULES } from './rules';

export type BoxKind = 'stall' | 'wall' | 'house' | 'crate' | 'crowd' | 'trunk';
/** awning: bounces; plank: a plain ledge (jumped through from below) */
export type PlatKind = 'awning' | 'plank';
export type CritterKind = 'goose' | 'goat';
export type TileKind = 'pause' | 'back' | 'dash';
export type PitKind = 'ditch' | 'well';
export type FinishKind = 'palm' | 'sycamore';

export type Item =
  | { t: 'box'; a: number; b: number; h: number; k: BoxKind }
  | { t: 'plat'; a: number; b: number; y: number; k: PlatKind }
  | { t: 'pit'; a: number; b: number; k: PitKind }
  | { t: 'coins'; a: number; b: number; y: number; n: number; arc: number }
  | { t: 'sp'; tier: number; x: number; y: number }
  | { t: 'critter'; x: number; y: number; k: CritterKind }
  | { t: 'tile'; a: number; b: number; y: number; k: TileKind }
  | { t: 'finish'; x: number; k: FinishKind };

export interface Level {
  index: number;
  world: number;
  /** the finish's x and the level's end (the walk-off beyond it) */
  len: number;
  finishX: number;
  finish: FinishKind;
  items: readonly Item[];
  /** denarii for the second star (about 60 % of the level's plain coins) */
  target: number;
}

/** a coin on the street, at his middle's height */
const G = 0.5;

/** The cursor builder: `x` walks right as the motifs are laid. */
class B {
  x = 0;
  readonly items: Item[] = [];
  private y0 = 0;

  /** lay things on a roof or a ledge at this height (0 = the street) */
  on(y: number): this { this.y0 = y; return this; }
  at(x: number): this { this.x = x; return this; }

  /** a flat stretch with a row of coins on it */
  run(d: number, n = Math.floor(d / 1.4)): this {
    if (n > 0) this.coins(0.6, d - 0.6, this.y0 + G, n);
    this.x += d;
    return this;
  }
  gap(d: number): this { this.x += d; return this; }
  coins(da: number, db: number, y: number, n: number, arc = 0): this {
    this.items.push({ t: 'coins', a: this.x + da, b: this.x + db, y, n, arc });
    return this;
  }
  /** a special denarius of a set (0 silver, 1 gold, 2 purple), relative to the cursor */
  sp(tier: number, dx: number, y: number): this {
    this.items.push({ t: 'sp', tier, x: this.x + dx, y });
    return this;
  }
  /** a place a level's second half offers for a special of a set the level still lacks */
  readonly slots: { tier: number; x: number; y: number }[] = [];
  slot(tier: number, dx: number, y: number): this {
    this.slots.push({ tier, x: this.x + dx, y });
    return this;
  }
  box(w: number, h: number, k: BoxKind): this {
    this.items.push({ t: 'box', a: this.x, b: this.x + w, h, k });
    this.x += w;
    return this;
  }
  plat(da: number, db: number, y: number, k: PlatKind): this {
    this.items.push({ t: 'plat', a: this.x + da, b: this.x + db, y, k });
    return this;
  }
  goose(dx: number): this { this.items.push({ t: 'critter', x: this.x + dx, y: this.y0, k: 'goose' }); return this; }
  goat(dx: number): this { this.items.push({ t: 'critter', x: this.x + dx, y: this.y0, k: 'goat' }); return this; }
  /**
   * An inlaid stone: on the street at the cursor (the cursor walks past it); on a roof (`on(y)`)
   * just inside the house that starts at the cursor (the cursor stays, the roofs come next).
   */
  tile(k: TileKind, w = 1.2): this {
    if (this.y0 > 0) {
      this.items.push({ t: 'tile', a: this.x + 0.6, b: this.x + 0.6 + w, y: this.y0, k });
      return this;
    }
    this.items.push({ t: 'tile', a: this.x, b: this.x + w, y: 0, k });
    this.x += w;
    return this;
  }

  // ── motifs ─────────────────────────────────────────────────
  /** a ditch (or a well) with an arc of coins over it */
  ditch(w: number, k: PitKind = 'ditch', coins = true): this {
    this.items.push({ t: 'pit', a: this.x, b: this.x + w, k });
    if (coins) this.coins(-0.5, w + 0.5, 1.2, Math.max(2, Math.round(w * 1.5)), 0.9);
    this.x += w;
    return this;
  }
  /** a market stall with its awning (a bounce) and an arc of coins over it */
  stall(w = 2, awning = true): this {
    const a = this.x;
    if (awning) this.plat(-0.2, w + 0.2, 1.9, 'awning');
    this.box(w, 1, 'stall');
    if (awning) this.items.push({ t: 'coins', a: a - 0.4, b: a + w + 1.6, y: 3.5, n: 4, arc: 0.8 });
    return this;
  }
  /** a staircase of crates up to `steps` × 0.8 */
  crates(steps: number, down = false): this {
    for (let i = 0; i < steps; i++) {
      const h = 0.8 * (down ? steps - i : i + 1);
      this.coins(0.3, 0.9, h + G, 1);
      this.box(1.2, h, 'crate');
    }
    return this;
  }
  wall(h: number, w = 1.2): this {
    this.coins(0.2, w - 0.2, h + G, 2);
    return this.box(w, h, 'wall');
  }
  /** a house with coins on its roof */
  house(w: number, h = 2.6): this {
    this.coins(0.5, w - 0.5, h + G, Math.max(1, Math.floor(w / 1.2)));
    return this.box(w, h, 'house');
  }
  /** houses in a row with gaps between (an alley under each, coins over it), planks across some */
  roofs(widths: number[], gaps: number[], planks: boolean[] = [], h = 2.6): this {
    widths.forEach((w, i) => {
      this.house(w, h);
      if (i < gaps.length) {
        const g = gaps[i];
        if (planks[i]) this.plat(0, g, h, 'plank');
        this.coins(0.2, g - 0.2, h + 1.1, Math.max(1, Math.round(g)), 0.5);
        this.gap(g);
      }
    });
    return this;
  }
  /** the crowd: backs in a row, a wall to the street; landing on them tosses him up (crowd-surfing) */
  crowd(w: number): this {
    this.coins(0.3, w - 0.3, 2.6, Math.max(2, Math.round(w)), 0.6);
    return this.box(w, 1.7, 'crowd');
  }
  /** the finish: a run-up with an awning for height, the trunk, and the walk-off */
  finish(k: FinishKind): { finishX: number; len: number } {
    this.run(2.5, 2);
    this.plat(0, 2, 1.4, 'awning');
    this.coins(0.5, 4.4, 3.8, 4, 0.7);
    this.gap(4.6);
    const finishX = this.x;
    this.items.push({ t: 'finish', x: finishX, k });
    this.items.push({ t: 'box', a: finishX, b: finishX + 1.1, h: k === 'palm' ? 5.6 : 6.4, k: 'trunk' });
    this.x += 1.1;
    this.run(9, 0);
    return { finishX, len: this.x };
  }
}

/** A level's plain coins (the second star's base). */
const coinCount = (items: readonly Item[]): number => items.reduce((s, it) => s + (it.t === 'coins' ? it.n : 0), 0);

/**
 * The second half of a level: a stretch in its world's style (four of them a world, each level
 * takes two or three in its own order), so a level runs 40–60 s.  Each is a small sketch of its own.
 */
const STRETCH: readonly ((b: B) => void)[][] = [
  // world 1: the market and the gate
  [
    b => b.run(3).stall().slot(2, -1.2, 4.6).goose(1).goose(2.6).run(5).slot(0, -2.5, 1.5).ditch(1.8).run(2).stall(2.4).slot(1, -1.2, 4.1)
      .run(3).crates(2).crates(2, true).run(4).wall(2.2).run(4),
    b => b.run(3).goat(2).run(4).slot(1, -2, 2.4).ditch(2.2).run(2).tile('pause').run(1, 0).stall(3).gap(0.8).stall().slot(2, -2, 4.8)
      .run(4).goose(1.5).run(4).slot(0, -2.5, 1.6).ditch(1.6, 'well').run(4),
    b => b.run(3).crates(3).slot(1, -0.6, 3.6).ditch(2, 'ditch', false).box(1.2, 2.4, 'crate').run(3).stall().slot(0, -1.2, 2.6).run(2)
      .goose(1).goose(2.4).goose(3.8).run(6).slot(2, -3.4, 3.2).wall(2.6).run(4),
    b => b.run(3).stall().stall().slot(1, -1.4, 4.4).run(3).tile('dash').ditch(3.6).slot(2, -1.8, 3.4).run(3).goat(1.5).run(4)
      .crowd(3).slot(0, -1.5, 2.6).run(3).ditch(2).run(4),
  ],
  // world 2: the roofs
  [
    b => b.run(3).crates(3).roofs([4, 3, 4], [2, 2.4], [false, true]).slot(2, -6.4, 4.8).slot(0, -2, 3.3).run(3).goose(1).run(3)
      .slot(1, -1, 2.4).ditch(2).run(4),
    b => b.run(3).crates(3).on(2.6).goose(2).on(0).roofs([5, 4], [2.6]).slot(1, -5.4, 4.2).run(3).wall(2.6).run(1.4, 0).wall(3)
      .slot(2, -0.6, 4.6).run(4).slot(0, -2, 1.4),
    b => b.run(3).box(1, 3, 'wall').gap(1.1).box(1, 3, 'wall').slot(2, -1.6, 4.4).run(3).crates(2).ditch(2.2).slot(1, -1.1, 2.6)
      .crates(2, true).run(3).goat(1.5).slot(0, 1.5, 2.4).run(5),
    b => b.run(3).crates(3).on(2.6).tile('pause').on(0).roofs([3, 3, 3], [2, 2]).slot(1, -6.5, 4.2).slot(2, -3.5, 5).run(3).stall()
      .slot(0, -1.2, 3.9).goose(1.2).run(5),
  ],
  // world 3: the grove and the gardens
  [
    b => b.run(3).plat(0, 3, 1.6, 'plank').run(3.4, 0).plat(0, 3, 2.6, 'plank').slot(2, 1.5, 4.6).run(3.4, 0).slot(0, -1, 3.2)
      .ditch(2.2, 'well').run(3).goat(1.5).goat(3.2).slot(1, 2.4, 2.4).run(6),
    b => b.run(3).ditch(1.6).slot(0, -0.8, 1.8).run(2).ditch(2).run(2).tile('dash').ditch(3.8).slot(2, -1.9, 3.6).run(3)
      .goose(1).goose(2.4).slot(1, 1.8, 2.2).run(5),
    b => b.run(3).wall(2.8).ditch(2.4).slot(1, -1.2, 3.6).wall(2.4).run(3).stall().ditch(2).stall().slot(2, -3, 4.6).run(4)
      .goat(1).slot(0, 1, 2.2).run(4),
    b => b.run(3).crates(3).roofs([3, 4], [2.8]).slot(2, -5.4, 4.8).run(2).tile('back').run(2, 0).slot(0, -3.6, 1.4).crates(2)
      .run(3).ditch(2.4).slot(1, -1.2, 2.4).run(4),
  ],
];

function level(index: number, build: (b: B) => void, finish: FinishKind = 'palm'): Level {
  const b = new B();
  b.run(3, 0);
  build(b);
  const set = STRETCH[Math.floor(index / RULES.perWorld)], k = index % RULES.perWorld;
  set[k](b);
  set[(k + 1 + (index % 2)) % set.length](b);
  if (b.x < 215) set[(k + 3) % set.length](b);
  // five specials a set: extras dropped from the end, a missing one in the second half's slot for that set
  for (let tier = 0; tier < 3; tier++) {
    const mine = b.items.filter(it => it.t === 'sp' && it.tier === tier);
    for (const extra of mine.slice(RULES.specials)) b.items.splice(b.items.indexOf(extra), 1);
    const free = b.slots.filter(sl => sl.tier === tier);
    for (let n = mine.length; n < RULES.specials && free.length; n++) {
      const sl = free.shift()!;
      b.items.push({ t: 'sp', tier, x: sl.x, y: sl.y });
    }
  }
  const end = b.finish(finish);
  return {
    index, world: Math.floor(index / RULES.perWorld), len: end.len, finishX: end.finishX, finish, items: b.items,
    target: Math.round(coinCount(b.items) * 0.6),
  };
}

// ── world 1: Brama Jerycha (the gate and the market) ─────────────
const L0 = level(0, b => {
  // one thing at a time: a jump, a held jump, a goose, a ditch, an awning, a pause stone, a wall
  b.run(6).sp(0, 3, 1.6)
    .crates(1).run(4)
    .crates(2, false).crates(2, true).run(4).sp(1, -5.6, 3.6)
    .goose(2).run(6).sp(0, 2, 1.2)
    .ditch(1.6).run(4)
    .stall().run(3).sp(0, -4.2, 3.9).sp(2, -4.6, 4.6)
    .goose(1.5).goose(4).run(6)
    .ditch(2.2).run(3).sp(1, -3.6, 2.3)
    .tile('pause').run(1.5, 0).wall(2.2).run(4).sp(0, -3.4, 3.3).sp(2, -3.8, 4.4)
    .stall().gap(1).stall().run(4).sp(1, -6.5, 4.0)
    .goat(2).run(6)
    .ditch(1.8).run(3)
    .wall(3).run(4).sp(1, -4.4, 3.8).sp(2, -4.6, 5.2)
    .crates(3).ditch(2.4, 'ditch', false).box(1.2, 2.4, 'crate').run(5).sp(0, -7, 3.3).sp(2, -6.4, 4.6)
    .goose(1).goose(2.6).goose(4.2).run(7).sp(1, -3.5, 2.4).sp(0, -4, 1.8)
    .stall().run(3).sp(2, -4.3, 4.4)
    .ditch(2).run(4);
});

const L1 = level(1, b => {
  // the date market: awnings in rows, geese among the stalls, the ▶ stone for a long jump
  b.run(4)
    .stall().stall(2.4).gap(0.6).stall().run(3).sp(0, -7, 3.9).sp(1, -4.5, 4.4).sp(2, -9.2, 5.2)
    .goose(1).run(4)
    .ditch(2).run(3)
    .tile('dash').ditch(3.8, 'ditch').run(4).sp(0, -6, 1.9).sp(2, -6.4, 3.4)
    .stall().goose(1.2).goose(3).run(5).sp(1, -2.5, 2.6)
    .crates(2).ditch(1.8, 'well').crates(2, true).run(3).sp(0, -5.4, 2.6)
    .stall(3).gap(1.2).stall(3).run(4).sp(2, -7.6, 5.3).sp(1, -4.4, 4.1)
    .goat(2).goose(4.5).run(6)
    .tile('dash').ditch(4).run(3).sp(0, -5, 2)
    .wall(2.4).run(3).stall().run(3).sp(1, -4, 3.9)
    .goose(1).goose(2.2).run(5).sp(2, -3.5, 3.1)
    .stall().stall().run(4).sp(0, -5, 3.9).sp(2, -6.4, 4.9)
    .ditch(2.2).run(4).sp(1, -5.6, 2.2);
});

const L2 = level(2, b => {
  // the potters' street: walls to climb, the ◀ stone that runs him back for a coin behind
  b.run(4)
    .wall(2.2).run(3).sp(0, -2.2, 3.2)
    .wall(3).run(3).sp(1, -4.4, 4.0)
    .tile('back').run(2.5).wall(2.6).run(1.5).sp(0, -5.2, 1.4).sp(2, -3.8, 3.6)
    .ditch(1.8, 'well').run(3)
    .goose(1.5).run(4)
    .box(1, 2.8, 'wall').gap(1.3).box(1, 3, 'wall').run(4).sp(1, -5.3, 3.6).sp(2, -4.7, 5)
    .crates(3).run(1.5).ditch(2.6, 'ditch', false).house(4).run(4).sp(0, -8, 3.6).sp(2, -6.5, 4.4)
    .tile('pause').run(1, 0).stall().run(3).sp(1, -4, 4.2)
    .goat(1.5).goose(3).run(5).sp(0, -3.2, 2.5)
    .wall(2.4).ditch(2.2, 'ditch').wall(2.4).run(4).sp(1, -6.2, 3.8).sp(2, -6.6, 4.9)
    .tile('back').run(2, 0).crates(2).run(4).sp(0, -8.2, 1.2)
    .ditch(2).run(3).sp(2, -4.6, 3.4)
    .stall().run(4);
});

const L3 = level(3, b => {
  // the crowd at the gate (the world's end): the backs bar the street, the awnings and crates lift
  // him over, and the crowd tosses him up when he lands on it; the sycamore at the end
  b.run(4)
    .crowd(3).run(3).sp(0, -4.5, 3.1)
    .stall().crowd(4).run(3).sp(1, -5, 3.8)
    .crates(2).crowd(5).run(3).sp(2, -6, 4.6)
    .goose(1.5).run(5)
    .ditch(2).run(2).crowd(3).run(3).sp(0, -4.5, 2.9)
    .tile('pause').run(1, 0).wall(2.6).crowd(4).run(4).sp(1, -6, 4.0).sp(2, -6.5, 5.2)
    .house(4).gap(1.5).house(3).run(3).sp(0, -6, 3.4).sp(2, -6.8, 4.6)
    .crowd(6).run(3).sp(1, -6.2, 3.6)
    .goat(1).goose(3).run(5).sp(0, -3, 2.2)
    .stall().crowd(5).run(4).sp(2, -6.6, 4.4).sp(1, -5, 2.8);
}, 'sycamore');

// ── world 2: Dachy tkaczy (the weavers' roofs) ───────────────────
const L4 = level(4, b => {
  // up onto the roofs: crates as steps, gaps between houses, planks over some
  b.run(4)
    .crates(3).roofs([4, 3, 4], [1.6, 2.2], [false, true]).sp(0, -9, 3.6).sp(1, -5.8, 4.4)
    .run(3)
    .crates(2).roofs([3, 3, 5], [2.4, 1.4]).sp(2, -9.4, 4.8).sp(0, -4, 3.3)
    .ditch(1.6).run(3)
    .stall().crates(3).roofs([4, 4], [2.6], [true]).sp(1, -6.4, 4.6)
    .goose(1).run(4)
    .crates(3).on(2.6).tile('pause').on(0).roofs([3, 4], [3]).sp(2, -5.6, 4.6).sp(0, -8.4, 3.7)
    .run(4)
    .wall(2.4).roofs([4, 3, 3], [1.8, 2]).sp(1, -5, 4.2).sp(2, -7.6, 5.2)
    .run(4).sp(0, -2, 1.4);
});

const L5 = level(5, b => {
  // washing lines and geese on the roofs, goats in the alleys, the ▶ stone across a wide gap
  b.run(4)
    .crates(3).on(2.6).goose(2).on(0).roofs([5, 4], [2]).sp(0, -7, 3.4)
    .run(3).goat(1).run(4).sp(1, -3, 2.4)
    .crates(3).on(2.6).tile('dash', 1.4).on(0).roofs([2.6, 4], [3.6]).sp(2, -6.6, 4.6).sp(0, -4.8, 3.5)
    .run(3)
    .crates(3).on(2.6).goose(1.5).goose(3).on(0).roofs([5, 3], [1.8], [true]).sp(1, -6, 4.4)
    .ditch(2).run(3)
    .stall().goose(1).run(3)
    .crates(3).on(2.6).goat(2).on(0).roofs([4.4, 4], [2.4]).sp(0, -5, 3.3).sp(2, -7.4, 5)
    .run(4).sp(1, -3.5, 1.3)
    .crates(3).on(2.6).tile('pause').on(0).roofs([3, 4], [2.8]).sp(2, -5.8, 4.4)
    .run(4).sp(0, -2.6, 1.4).sp(1, -5, 0.6);
});

const L6 = level(6, b => {
  // towers and walls: chimneys of two walls to climb, the ◀ stone into a nook
  b.run(4)
    .wall(2.6).run(1.4, 0).wall(3).run(3).sp(0, -4.2, 3.6)
    .box(1, 2.8, 'wall').gap(1.1).box(1, 3, 'wall').run(3).sp(1, -4.1, 4.4).sp(2, -4.6, 5.4)
    .tile('back').run(2, 0).crates(3).roofs([4, 3], [2.2]).sp(0, -11, 1.4)
    .run(3)
    .ditch(2.2, 'well').run(3)
    .goose(1).goat(3).run(5).sp(1, -4, 2.4)
    .wall(3).ditch(2.4, 'ditch').wall(2.6).run(3).sp(2, -6.2, 4.6).sp(0, -5.4, 3.0)
    .box(1, 3, 'wall').gap(1.1).box(1, 3, 'wall').gap(1.1).box(1, 3, 'wall').run(3).sp(1, -5.8, 4.2).sp(2, -4.6, 5.6)
    .tile('pause').run(1, 0).stall().run(2).wall(2.4).run(3).sp(0, -3.4, 3.2)
    .crates(2).ditch(2).crates(2, true).run(4).sp(1, -6.4, 2.6).sp(2, -5.4, 4.2)
    .run(3).sp(0, -2.4, 1.4);
});

const L7 = level(7, b => {
  // the procession's street (the world's end): roofs over a long crowd, the sycamore
  b.run(4)
    .crowd(4).run(2).crates(3).roofs([4, 4], [2]).sp(0, -7, 3.5).sp(2, -11, 4.6)
    .crowd(5).run(3).sp(1, -6.5, 3.4)
    .stall().crowd(4).house(4).run(3).sp(0, -6.2, 3.3)
    .crowd(6).run(2).sp(2, -6.4, 4.8)
    .goose(1).goat(2.8).run(5).sp(1, -3.4, 2.2)
    .crates(3).on(2.6).tile('pause').on(0).roofs([3, 4, 3], [2.2, 2.4], [false, true]).sp(0, -9, 3.8).sp(2, -5.6, 5)
    .crowd(7).run(3).sp(1, -7.4, 3.8)
    .wall(2.4).crowd(4).run(3).sp(0, -4.2, 2.8).sp(2, -5, 4.4)
    .run(3).sp(1, -2, 1.4);
}, 'sycamore');

// ── world 3: Gaj palmowy (the palm grove and the road) ───────────
const L8 = level(8, b => {
  // the palm grove: fronds as ledges, goats on them, wells between the trees
  const frond = (y: number, w = 3) => b.plat(0, w, y, 'plank').coins(0.4, w - 0.4, y + G, 2);
  b.run(4);
  frond(1.6); b.run(3.4, 0);
  frond(2.6); b.run(3.4, 0).sp(0, -2.4, 3.7).sp(2, -2.6, 4.7);
  b.ditch(2, 'well').run(3);
  frond(1.8, 4); b.on(1.8).goat(2).on(0).run(4.6, 0).sp(1, -3, 3.4);
  b.goose(1).run(4);
  frond(1.6); b.run(3, 0);
  frond(2.6); b.run(3, 0);
  frond(3.6); b.run(3.4, 0).sp(2, -2.4, 4.8).sp(0, -6, 3.2);
  b.ditch(2.4).run(3).sp(1, -4.6, 2.2);
  b.tile('dash').ditch(3.8, 'ditch').run(3).sp(0, -5.6, 2.2);
  b.goat(1.5).goat(3.5).run(6).sp(2, -3.8, 3.4);
  frond(2, 4); b.on(2).goose(2).on(0).run(4.6, 0).sp(1, -3.4, 3.8);
  b.wall(2.4).run(3).sp(0, -2.6, 3.4);
  b.ditch(2, 'well').run(4).sp(1, -6, 2.4).sp(2, -6.4, 3.8);
});

const L9 = level(9, b => {
  // the irrigation ditches: ditch after ditch, ▶ stones for the long ones, geese on the banks
  b.run(4)
    .ditch(1.6).run(2).ditch(1.8).run(2).ditch(2).run(3).sp(0, -8, 1.8)
    .goose(1).run(3)
    .tile('dash').ditch(4).run(3).sp(1, -5, 2.4).sp(2, -5.4, 3.6)
    .stall().ditch(2.4).stall().run(3).sp(0, -6.8, 3.9)
    .goose(1).goose(2.5).ditch(1.6).run(3).sp(1, -4.5, 2.2)
    .crates(2).ditch(2.8, 'ditch', false).crates(2, true).run(3).sp(2, -6.4, 3.8).sp(0, -6.2, 2.6)
    .tile('pause').run(1, 0).ditch(3.2).run(3).sp(1, -4.4, 2.6)
    .goat(1).ditch(2).run(3)
    .tile('dash').ditch(4).run(3).sp(2, -5.6, 4).sp(0, -5.4, 1.8)
    .ditch(1.8, 'well').run(2).ditch(1.8).run(4).sp(1, -5.4, 1.4).sp(2, -7, 3.4);
});

const L10 = level(10, b => {
  // the balsam gardens: everything at once, chains of bonks over the ditches
  b.run(4)
    .goose(1).ditch(1.4, 'ditch', false).goose(1).run(2).ditch(1.4, 'ditch', false).run(3).sp(0, -5.2, 1.9).sp(2, -5, 3.4)
    .wall(2.6).run(1.4, 0).wall(3).run(3).sp(1, -4.2, 4.4)
    .crates(3).roofs([3, 3], [3]).sp(0, -4.6, 3.6).sp(2, -6, 5)
    .goat(1.5).run(4)
    .tile('back').run(2, 0).wall(2.8).run(3).sp(1, -6.2, 1.4)
    .stall().ditch(2.2).stall().run(3).sp(0, -6.4, 3.9)
    .box(1, 3, 'wall').gap(1.1).box(1, 3, 'wall').run(3).sp(2, -4.6, 5.4)
    .tile('dash').ditch(3.8).run(3).sp(1, -5.4, 2.2)
    .goose(1).goose(2.2).goose(3.4).run(6).sp(0, -4, 2)
    .crates(3).on(2.6).goose(1.6).on(0).roofs([4, 3], [2.6]).sp(1, -5.4, 4.4).sp(2, -6.6, 4.8)
    .ditch(2).run(4).sp(0, -2.8, 1.4);
});

const L11 = level(11, b => {
  // the road to the sycamore (the last world's end): the whole crowd of Jericho, the roofs above
  // it, and at its end the tree by the road
  b.run(4)
    .crowd(4).run(2).stall().crowd(5).run(3).sp(0, -8.4, 3.3).sp(2, -7.4, 4.8)
    .crates(3).roofs([4, 3, 4], [2, 2.4], [true, false]).sp(1, -6.6, 4.2).sp(0, -11, 3.6)
    .crowd(6).run(2).sp(2, -6.6, 4.6)
    .goose(1).goat(2.6).ditch(2).run(3).sp(1, -3.6, 1.8)
    .tile('pause').run(1, 0).wall(3).crowd(5).run(3).sp(0, -6.4, 3.0)
    .box(1, 3, 'wall').gap(1.1).box(1, 3, 'wall').crowd(4).run(3).sp(2, -6.4, 5.4).sp(1, -4, 2.8)
    .tile('dash').ditch(3.8).run(2).crowd(6).run(3).sp(0, -7.6, 3.2).sp(2, -8.6, 3.8)
    .stall().crowd(5).run(4).sp(1, -6.2, 3.6);
}, 'sycamore');

/** The twelve levels in order: world w holds levels 4w … 4w + 3. */
export const LEVELS: readonly Level[] = [L0, L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11];
export const levelCount = LEVELS.length;
export const levelName = (i: number): string => t(`level.${i}` as Key);
export const worldName = (w: number): string => t(`world.${w}` as Key);
/** "1-3": the world and the level in it. */
export const levelCode = (i: number): string => `${Math.floor(i / RULES.perWorld) + 1}-${(i % RULES.perWorld) + 1}`;

/** The specials of a set in a level, in order along the way. */
export const specialsOf = (lv: Level, tier: number): { x: number; y: number }[] =>
  lv.items.filter((it): it is Extract<Item, { t: 'sp' }> => it.t === 'sp' && it.tier === tier).map(it => ({ x: it.x, y: it.y })).sort((a, b) => a.x - b.x);

// ── the households of Jericho (Fourfold, Luke 19:8) ───────────────
export interface Home { index: number; name: string; fix: string; at: number }
export const HOMES: readonly Home[] = RULES.homes.map((at, i) => ({ index: i, name: t(`home.${i}` as Key), fix: t(`home.${i}.fix` as Key), at }));

// ── the missions ─────────────────────────────────────────────────
export type MissionKind = 'coins' | 'bonk' | 'wall' | 'set' | 'figs' | 'road' | 'style' | 'top' | 'levels' | 'vaultSpin';
export type MissionId = 'coins80' | 'bonk6' | 'wall4' | 'set1' | 'figs10' | 'road20' | 'style300' | 'top1' | 'levels2' | 'vaultSpin3' | 'coins200' | 'bonk15';
export interface Mission { id: MissionId; kind: MissionKind; target: number; name: string }
const mission = (id: MissionId, kind: MissionKind, target: number): Mission => ({ id, kind, target, name: t(`mission.${id}`) });

/** Three at a time, a done one replaced after the session by the next not yet open. */
export const MISSIONS: readonly Mission[] = [
  mission('coins80', 'coins', 80),
  mission('bonk6', 'bonk', 6),
  mission('wall4', 'wall', 4),
  mission('top1', 'top', 1),
  mission('figs10', 'figs', 10),
  mission('road20', 'road', 20),
  mission('vaultSpin3', 'vaultSpin', 3),
  mission('set1', 'set', 1),
  mission('style300', 'style', 300),
  mission('levels2', 'levels', 2),
  mission('bonk15', 'bonk', 15),
  mission('coins200', 'coins', 200),
];
export const missionById = (id: string): Mission | undefined => MISSIONS.find(m => m.id === id);

/** The special denarii's three sets (Mario's pink, purple, black). */
export const TIERS = ['silver', 'gold', 'purple'] as const;
export type Tier = (typeof TIERS)[number];

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;
