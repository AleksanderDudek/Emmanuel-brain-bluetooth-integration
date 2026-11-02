/**
 * Jericho's street as the rules see it: the pieces made from the chunks (content.ts) laid end to
 * end ahead of Zacchaeus and forgotten behind him — solid boxes (the street itself, stalls,
 * walls, houses, crates, the sycamore's trunk), ledges he lands on from above (awnings that
 * bounce, planks, branches, and the high way's bridges, fronds and roof awnings, whose solidity
 * the band decides), pits, denarii, the things he vaults, the fig trees of the shade and the
 * stretches ("zones") that tell the run how fast to go.  No DOM, no randomness of its own.
 */
import type { BoxKind, ChunkDef, PitKind, PlatKind, VaultKind, ZoneKind } from './content';
import { isHigh } from './content';
import { RULES } from './rules';

export interface Solid { id: number; x0: number; x1: number; top: number; bottom: number; kind: BoxKind | 'ground'; ladder: boolean }

/**
 * A ledge he lands on from above.  A high piece starts `live` (it follows the band, not yet
 * decided) and locks once, ahead of him: `solid`, `outline` (below the threshold, or the band not
 * asked) or `mist` (no signal: the same as an outline for the run, drawn as the sensor's fault).
 */
export type PlatState = 'live' | 'solid' | 'outline' | 'mist';
export interface Plat { id: number; x0: number; x1: number; y: number; kind: PlatKind; high: boolean; state: PlatState; lockedAt: number }

export interface Coin { id: number; x: number; y: number; got: boolean; gotAt: number; special: number; born: number }
export interface Vault { id: number; x: number; kind: VaultKind; done: boolean; at: number }
export interface Pit { id: number; x0: number; x1: number; kind: PitKind; falls: number; bridged: boolean }
/** A fig tree of the shade: how many of its five figs were ripe when he passed (−1: not yet passed). */
export interface FigTree { id: number; x: number; picked: number; at: number }
export interface Palm { x: number; h: number }
/** `course`: the course's index (−1 the day's course, −2 none); `seq`: the chunk's place in its course (−1 none) */
export interface Zone { id: number; x0: number; x1: number; kind: ZoneKind; chunk: string; course: number; seq: number; speed: number }

/** How a chunk is laid: the course it belongs to, which of its special places carry a special (by order), a reveal's solid count. */
export interface LayOpts { course: number; seq?: number; specials?: readonly number[]; firstSlot?: number; solid?: number; now?: number }

export const standable = (p: Plat): boolean => !p.high || p.state === 'solid';

export class World {
  readonly solids: Solid[] = [];
  readonly plats: Plat[] = [];
  readonly coins: Coin[] = [];
  readonly vaults: Vault[] = [];
  readonly pits: Pit[] = [];
  readonly figs: FigTree[] = [];
  readonly palms: Palm[] = [];
  readonly zones: Zone[] = [];
  /** where the street made so far ends (u) */
  end = 0;
  private ids = 1;

  /** Lay a chunk at the street's end; returns its zone. */
  lay(def: ChunkDef, o: LayOpts): Zone {
    const X = this.end, id = () => this.ids++;
    const speed = def.zone === 'shade' ? RULES.walk : RULES.run;
    const zone: Zone = { id: id(), x0: X, x1: X + def.w, kind: def.zone, chunk: def.id, course: o.course, seq: o.seq ?? -1, speed };
    // the street: everywhere but the pits
    const pits = def.items.filter(it => it.t === 'pit').map(it => it as Extract<typeof it, { t: 'pit' }>).sort((a, b) => a.a - b.a);
    let from = 0;
    for (const p of pits) {
      if (p.a > from) this.solids.push({ id: id(), x0: X + from, x1: X + p.a, top: 0, bottom: -3, kind: 'ground', ladder: false });
      this.pits.push({ id: id(), x0: X + p.a, x1: X + p.b, kind: p.k, falls: 0, bridged: false });
      from = p.b;
    }
    if (from < def.w) this.solids.push({ id: id(), x0: X + from, x1: X + def.w, top: 0, bottom: -3, kind: 'ground', ladder: false });
    let spIndex = 0, highIndex = 0;
    for (const it of def.items) {
      switch (it.t) {
        case 'box':
          this.solids.push({ id: id(), x0: X + it.a, x1: X + it.b, top: it.h, bottom: 0, kind: it.k, ladder: it.ladder });
          break;
        case 'plat': {
          const high = isHigh(it.k);
          let state: PlatState = high ? 'live' : 'solid';
          if (high && o.solid !== undefined) state = highIndex++ < o.solid ? 'solid' : 'outline';
          this.plats.push({ id: id(), x0: X + it.a, x1: X + it.b, y: it.y, kind: it.k, high, state, lockedAt: high && o.solid !== undefined ? (o.now ?? 0) : -1 });
          break;
        }
        case 'coins':
          for (let i = 0; i < it.n; i++) {
            const k = it.n > 1 ? i / (it.n - 1) : 0.5;
            const x = it.n > 1 ? it.a + (it.b - it.a) * k : (it.a + it.b) / 2;
            this.coins.push({ id: id(), x: X + x, y: it.y + it.arc * 4 * k * (1 - k), got: false, gotAt: -1, special: -1, born: -1 });
          }
          break;
        case 'sp': {
          const k = o.specials?.indexOf(spIndex) ?? -1;
          spIndex++;
          if (k >= 0) this.coins.push({ id: id(), x: X + it.x, y: it.y, got: false, gotAt: -1, special: (o.firstSlot ?? 0) + k, born: -1 });
          break;
        }
        case 'vault':
          this.vaults.push({ id: id(), x: X + it.x, kind: it.k, done: false, at: -1 });
          break;
        case 'fig':
          this.figs.push({ id: id(), x: X + it.x, picked: -1, at: -1 });
          break;
        case 'palm':
          this.palms.push({ x: X + it.x, h: it.h });
          break;
        case 'pit':
          break;
      }
    }
    this.zones.push(zone);
    this.end = X + def.w;
    return zone;
  }

  /** A short plain stretch of street (between courses, after the tree). */
  road(w: number, course: number): Zone {
    const X = this.end;
    this.solids.push({ id: this.ids++, x0: X, x1: X + w, top: 0, bottom: -3, kind: 'ground', ladder: false });
    const zone: Zone = { id: this.ids++, x0: X, x1: X + w, kind: 'course', chunk: 'road', course, seq: -1, speed: RULES.run };
    this.zones.push(zone);
    this.end = X + w;
    return zone;
  }

  zoneAt(x: number): Zone | null {
    for (const z of this.zones) if (x >= z.x0 && x < z.x1) return z;
    return null;
  }

  /** A coin of the Widok's burst or a block's payout, at (x, y), born at `now`. */
  addCoin(x: number, y: number, now: number): Coin {
    const c: Coin = { id: this.ids++, x, y, got: false, gotAt: -1, special: -1, born: now };
    this.coins.push(c);
    return c;
  }

  /** The neighbour's plank over a pit he fell into twice. */
  bridge(p: Pit): Plat {
    p.bridged = true;
    const pl: Plat = { id: this.ids++, x0: p.x0 - 0.1, x1: p.x1 + 0.1, y: 0, kind: 'plank', high: false, state: 'solid', lockedAt: -1 };
    this.plats.push(pl);
    return pl;
  }

  /** The highest surface he could stand on over [x0, x1] at or below `under` (u; −Infinity: none). */
  topAt(x0: number, x1: number, under = Infinity): number {
    let best = -Infinity;
    for (const s of this.solids) if (s.x1 > x0 && s.x0 < x1 && s.top <= under && s.top > best) best = s.top;
    for (const p of this.plats) if (standable(p) && p.x1 > x0 && p.x0 < x1 && p.y <= under && p.y > best) best = p.y;
    return best;
  }

  pitAt(x: number): Pit | null {
    for (const p of this.pits) if (x >= p.x0 - 0.3 && x <= p.x1 + 0.3) return p;
    return null;
  }

  /** Forget what lies further than RULES.behind behind `x`. */
  trim(x: number): void {
    const cut = x - RULES.behind;
    const keep = <T>(arr: T[], end: (v: T) => number) => {
      let n = 0;
      for (const v of arr) if (end(v) >= cut) arr[n++] = v;
      arr.length = n;
    };
    keep(this.solids, s => s.x1);
    keep(this.plats, p => p.x1);
    keep(this.coins, c => c.x);
    keep(this.vaults, v => v.x);
    keep(this.pits, p => p.x1);
    keep(this.figs, f => f.x);
    keep(this.palms, p => p.x);
    keep(this.zones, z => z.x1);
  }
}
