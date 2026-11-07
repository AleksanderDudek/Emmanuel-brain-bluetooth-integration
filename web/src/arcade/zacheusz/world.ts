/**
 * The street Zacchaeus runs on, made from one level's items (content.ts): the solids (the street
 * between its pits, stalls, walls, houses, crates, the crowd, the finish trunk), the ledges (awnings
 * that bounce, planks, raised stones, the light road the band builds), the inlaid stones (pause, ◀,
 * ▶), the creatures, the coins and the special denarii of the level's current set, the springs of
 * light and the fig trees of an orchard.  Pure data and geometry (no DOM): the hero collides with
 * it, the sim changes it, the view draws it.
 *
 * `splice(cut, len)` opens the street at a safe place and inserts an empty stretch (the fig orchard
 * of a rest block): everything from the cut on moves right, the street segment at the cut stretches.
 */
import type { BoxKind, CritterKind, FinishKind, Level, PitKind, TileKind } from './content';
import { RULES } from './rules';

export type SolidKind = BoxKind | 'ground';
export interface Solid { x0: number; x1: number; top: number; bottom: number; kind: SolidKind; seed: number }
/** awning: bounces; plank: a ledge; road: the band's light road; stone: a raised pause/arrow stone */
export type PlatKind = 'awning' | 'plank' | 'road' | 'stone';
export interface Plat { x0: number; x1: number; y: number; kind: PlatKind; squash: number; born: number; passed: number }
export interface Tile { x0: number; x1: number; y: number; kind: TileKind; used: boolean; glow: number }
export interface Pit { x0: number; x1: number; kind: PitKind }
export type CritterState = 'idle' | 'bonked' | 'gone';
export interface Critter {
  id: number; kind: CritterKind; x: number; y: number; home: number; dir: number;
  state: CritterState; t: number; vaulted: boolean; spin: number;
}
export type CoinKind = 'denar' | 'light';
export interface Coin { x: number; y: number; kind: CoinKind; taken: boolean; t: number }
export interface Special { x: number; y: number; i: number; taken: boolean; t: number }
export interface Spring { x: number; y: number; squash: number; born: number }
export interface FigTree { x: number; picked: number; bubble: boolean }
export interface Orchard { x0: number; x1: number }
export interface Finish { x: number; kind: FinishKind }

let nextId = 1;

export class World {
  readonly solids: Solid[] = [];
  readonly plats: Plat[] = [];
  readonly tiles: Tile[] = [];
  readonly pits: Pit[] = [];
  readonly critters: Critter[] = [];
  readonly coins: Coin[] = [];
  readonly specials: Special[] = [];
  readonly springs: Spring[] = [];
  readonly trees: FigTree[] = [];
  readonly orchards: Orchard[] = [];
  finish: Finish;
  /** the level's end (the walk-off beyond the finish) */
  end: number;
  /** coins laid at the start (the second star's count) */
  readonly plain: number;

  constructor(readonly level: Level, tier: number) {
    let seed = level.index * 97 + 13;
    const pits: Pit[] = [];
    let finish: Finish = { x: level.finishX, kind: level.finish };
    for (const it of level.items) {
      switch (it.t) {
        case 'box': this.solids.push({ x0: it.a, x1: it.b, top: it.h, bottom: 0, kind: it.k, seed: seed++ }); break;
        case 'plat': this.plats.push({ x0: it.a, x1: it.b, y: it.y, kind: it.k, squash: 0, born: -9, passed: -1 }); break;
        case 'pit': pits.push({ x0: it.a, x1: it.b, kind: it.k }); break;
        case 'coins':
          for (let i = 0; i < it.n; i++) {
            const k = it.n === 1 ? 0.5 : i / (it.n - 1);
            this.coins.push({ x: it.a + (it.b - it.a) * k, y: it.y + it.arc * Math.sin(Math.PI * k), kind: 'denar', taken: false, t: 0 });
          }
          break;
        case 'sp':
          if (it.tier === tier) this.specials.push({ x: it.x, y: it.y, i: 0, taken: false, t: 0 });
          break;
        case 'critter':
          this.critters.push({ id: nextId++, kind: it.k, x: it.x, y: it.y, home: it.x, dir: -1, state: 'idle', t: 0, vaulted: false, spin: 0 });
          break;
        case 'tile':
          this.tiles.push({ x0: it.a, x1: it.b, y: it.y, kind: it.k, used: false, glow: 0 });
          if (it.y > 0) this.plats.push({ x0: it.a, x1: it.b, y: it.y, kind: 'stone', squash: 0, born: -9, passed: -1 });
          break;
        case 'finish': finish = { x: it.x, kind: it.k }; break;
      }
    }
    this.specials.sort((a, b) => a.x - b.x).forEach((s, i) => (s.i = i));
    this.finish = finish;
    this.end = level.len;
    this.plain = this.coins.length;
    // the street: ground everywhere but in the pits (from well behind the start to beyond the end)
    pits.sort((a, b) => a.x0 - b.x0);
    let x = -20;
    for (const p of pits) {
      if (p.x0 > x) this.solids.push({ x0: x, x1: p.x0, top: 0, bottom: -12, kind: 'ground', seed: seed++ });
      x = Math.max(x, p.x1);
      this.pits.push(p);
    }
    this.solids.push({ x0: x, x1: level.len + 60, top: 0, bottom: -12, kind: 'ground', seed: seed++ });
  }

  /** The highest standing surface over x (solids and ledges), or null over a pit with nothing above. */
  surfaceAt(x: number, below = Infinity): number | null {
    let top: number | null = null;
    for (const s of this.solids) if (x >= s.x0 && x <= s.x1 && s.top <= below && (top === null || s.top > top)) top = s.top;
    for (const p of this.plats) if (p.kind !== 'road' && x >= p.x0 && x <= p.x1 && p.y <= below && (top === null || p.y > top)) top = p.y;
    return top;
  }

  inPit(x: number): boolean { return this.pits.some(p => x > p.x0 && x < p.x1); }

  /**
   * A safe place to open the street for an orchard, from `from` on (u): on the street between two
   * pits with nothing standing or hanging there, well before the finish.  Null: none in reach.
   */
  findCut(from: number, to: number): number | null {
    const clear = 1;
    for (let x = from; x <= to; x += 0.25) {
      if (x > this.finish.x - 12) return null;
      if (this.pits.some(p => p.x1 > x - clear - 0.4 && p.x0 < x + clear + 0.4)) continue;
      if (this.solids.some(s => s.kind !== 'ground' && s.x1 > x - clear && s.x0 < x + clear)) continue;
      if (this.plats.some(p => p.x1 > x - clear && p.x0 < x + clear)) continue;
      if (this.tiles.some(t => t.x1 > x - clear && t.x0 < x + clear)) continue;
      if (this.critters.some(c => c.state !== 'gone' && Math.abs(c.home - x) < clear + 1)) continue;
      return x;
    }
    return null;
  }

  /** Open the street at `cut` (a place findCut chose) and insert `len` u of empty street. */
  splice(cut: number, len: number): void {
    const mv = (x: number) => (x >= cut ? x + len : x);
    for (const s of this.solids) {
      if (s.x0 < cut && s.x1 > cut) s.x1 += len;
      else if (s.x0 >= cut) { s.x0 += len; s.x1 += len; }
    }
    for (const p of [...this.plats, ...this.tiles, ...this.pits, ...this.orchards]) {
      if (p.x0 >= cut) { p.x0 += len; p.x1 += len; }
    }
    for (const c of this.critters) { if (c.home >= cut) { c.home += len; c.x += len; } }
    for (const c of [...this.coins, ...this.specials, ...this.springs, ...this.trees]) c.x = mv(c.x);
    this.finish.x = mv(this.finish.x);
    this.end += len;
  }

  /** Lay a fig orchard in [x0, x1]: trees every few u, a few coins between them. */
  orchard(x0: number, x1: number): void {
    this.orchards.push({ x0, x1 });
    for (let x = x0 + 3.5; x < x1 - 2.5; x += RULES.treeEvery) {
      this.trees.push({ x, picked: 0, bubble: false });
      this.coins.push({ x: x + 3.2, y: 0.5, kind: 'denar', taken: false, t: 0 });
      this.coins.push({ x: x + 3.9, y: 0.5, kind: 'denar', taken: false, t: 0 });
    }
  }

  inOrchard(x: number): Orchard | null {
    return this.orchards.find(o => x >= o.x0 && x <= o.x1) ?? null;
  }

  /** Forget what lies far behind him (keeps the arrays short over a long level). */
  prune(behind: number, now: number): void {
    const keep = <T>(arr: T[], ok: (v: T) => boolean) => {
      let w = 0;
      for (const v of arr) if (ok(v)) arr[w++] = v;
      arr.length = w;
    };
    keep(this.coins, c => c.x > behind && !(c.taken && now - c.t > 1));
    keep(this.plats, p => p.x1 > behind && !(p.kind === 'road' && p.passed >= 0 && now - p.passed > RULES.plankFade));
    keep(this.springs, s => s.x > behind);
    keep(this.critters, c => c.state !== 'gone');
  }
}
