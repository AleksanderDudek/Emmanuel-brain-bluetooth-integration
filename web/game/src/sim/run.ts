/**
 * A run = one chapter played from its first room to its stronghold.
 * Gifts (powers) live only for the run, like in Archero; Light, Manna,
 * ranks, fruits and prayers are permanent (see save.ts).
 */
import type { ChapterDef, FruitId, PowerId, TraumaKind } from '../types';
import { chapterRooms, type RoomKind } from './room';
import { Rng } from './rng';

/** Gifts available without any prayer; prayers add more (PrayerDef.unlocks.powers). */
export const BASE_POOL: readonly PowerId[] = ['slowo', 'chleby', 'eliasz', 'jerycho', 'dawid', 'samson', 'manna', 'ryba', 'serce', 'gorczyca'];

export const MAX_LEVEL: Record<PowerId, number> = {
  slowo: 5, chleby: 4, tarcza: 4, ogien: 5, wicher: 4, golebica: 4, eliasz: 4, jerycho: 3, dawid: 4, samson: 4,
  manna: 3, sandaly: 3, pancerz: 3, helm: 1, ucisz: 3, milosc: 3, ryba: 3, serce: 3, przebaczenie: 3, gorczyca: 3,
};

/** Permanent bonuses that shape a run (fruits of the Spirit, rank, prayers). */
export interface RunMods {
  extraHearts: number;
  lightMult: number;
  auraBonus: number;
  digestMult: number;
  magnet: number;
  graceBonus: number;
  spiritMult: number;
  dmgMult: number;
  stillFireMult: number;
}

export function modsFrom(fruits: Partial<Record<FruitId, number>>, rankIndex: number, hesychia = false): RunMods {
  const f = (id: FruitId) => fruits[id] ?? 0;
  return {
    extraHearts: f('milosc'),
    lightMult: 1 + 0.1 * f('radosc'),
    auraBonus: 0.3 * f('pokoj') + (hesychia ? 0.3 : 0),
    digestMult: 1 + 0.15 * f('cierpliwosc'),
    magnet: 0.5 * f('uprzejmosc'),
    graceBonus: f('dobroc'),
    spiritMult: 1 + 0.15 * f('wiernosc'),
    dmgMult: (1 + 0.08 * f('lagodnosc')) * (1 + 0.02 * rankIndex),
    stillFireMult: 1 + 0.1 * f('opanowanie'),
  };
}

export interface RunStats {
  digested: Partial<Record<TraumaKind, number>>;
  fragments: number;
  fragmentsTotal: number;
  falls: number;
  seeds: number;
  rooms: number;
  revelations: number;
}

export type Offer = PowerId | 'heal';

export const BASE_HEARTS = 5;

export class Run {
  readonly rooms: RoomKind[];
  roomIndex = 0;
  readonly gifts = new Map<PowerId, number>([['slowo', 1]]);
  level = 1;
  xp = 0;
  /** Light earned this run (already multiplied by Joy) */
  light = 0;
  spirit = 0;
  hearts: number;
  maxHearts: number;
  helmUsed = false;
  pendingLevelUps = 0;
  /** chapel/sabbath blessings that last for the rest of the run */
  auraBlessing = 0;
  readonly truthsSeen = new Set<TraumaKind>();
  readonly stats: RunStats = { digested: {}, fragments: 0, fragmentsTotal: 0, falls: 0, seeds: 0, rooms: 0, revelations: 0 };
  readonly rng: Rng;

  constructor(readonly chapter: ChapterDef, readonly pool: readonly PowerId[], readonly mods: RunMods,
              readonly ultimateUnlocked: boolean, readonly seed: number) {
    this.rooms = chapterRooms(chapter.realm === 'hell');
    this.maxHearts = BASE_HEARTS + mods.extraHearts;
    this.hearts = this.maxHearts;
    this.rng = new Rng(seed ^ 0x51ed);
  }

  get difficulty(): number {
    return this.chapter.order >= 100 ? 5 : this.chapter.order;
  }

  get roomKind(): RoomKind { return this.rooms[this.roomIndex]; }
  get isLastRoom(): boolean { return this.roomIndex >= this.rooms.length - 1; }

  /** Light needed for the next level. */
  get xpNeed(): number { return 20 + 14 * this.level; }

  giftLevel(id: PowerId): number { return this.gifts.get(id) ?? 0; }

  /** Add Light from seeds and digested shadows; queues level-ups. */
  addLight(base: number): number {
    const gained = base * this.mods.lightMult;
    this.light += gained;
    this.xp += gained;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.pendingLevelUps++;
    }
    return gained;
  }

  /** Three gift cards (fewer if the pool runs dry; "heal" fills the gap). */
  offers(n = 3): Offer[] {
    const open = this.pool.filter(id => this.giftLevel(id) < MAX_LEVEL[id]);
    // owned gifts a little more likely, so builds can deepen
    const weighted = open.map(id => ({ id, w: (this.gifts.has(id) ? 1.6 : 1) * this.rng.range(0.6, 1.4) }));
    weighted.sort((a, b) => b.w - a.w);
    const out: Offer[] = weighted.slice(0, n).map(o => o.id);
    while (out.length < n && !out.includes('heal')) out.push('heal');
    return out;
  }

  choose(o: Offer): void {
    if (o === 'heal') this.hearts = Math.min(this.maxHearts, this.hearts + 2);
    else this.gifts.set(o, Math.min(MAX_LEVEL[o], this.giftLevel(o) + 1));
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
  }

  /** Manna earned for finishing the chapter. */
  get manna(): number {
    return 10 + 2 * this.stats.fragments + (this.stats.falls === 0 ? 5 : 0) + Math.floor(this.difficulty);
  }
}
