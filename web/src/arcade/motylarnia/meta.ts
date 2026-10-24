/**
 * What Motylarnia remembers between sessions, and the rules that change it — pure functions over a
 * JSON-safe progress object (no DOM, randomness only from the injected `rng`):
 *
 *   eggs     each butterfly lays an egg that is ready the next calendar day; egg cards draw from
 *            ready eggs first, else wild eggs of the open habitats; after two days away a rare egg
 *            is waiting.  Wild eggs follow the published odds (62/26/10/2 %) with pity that never
 *            looks at the brain: a rare egg within 5, an exceptional one within 15, a legendary one
 *            within 28 (counted per butterfly; the forced egg is the default left card).  An egg is
 *            spent only when its butterfly emerges, so a round cut short never costs one.
 *   pyłek    duplicates give 5/15/40/100 by tier (×2 radiant); once it covers a missing species'
 *            egg (40/120/300/800) the next egg offered is that species, paid when it emerges.
 *   atlas    18 species with a caterpillar card (hatched) and a butterfly card (emerged), their
 *            records, forms and aberrations (one within 40 butterflies); Łąka opens after 6.
 *   records  up to 120 full butterflies (path and all) for the glasshouse; each species' biggest
 *            stays for good (its Atlas picture), the oldest others live on in the per-species summary.
 */
import {
  ABERRATION_ODDS, ABERRATION_PITY, HABITATS, RADIANT_ABERRATION_BOOST, SPECIES, TIERS, speciesById,
  type Aberration, type HabitatId, type Species, type TierIndex,
} from './content';

/** Butterfly flags (bit mask). */
export const F = {
  RADIANT: 1, CLASSIC: 2, ALBINO: 4, MELANIC: 8, GYN: 16, BLIND: 32, SILK: 64, BOLD: 128, DEEP: 256, DAILY: 512,
} as const;

export interface AtlasEntry {
  /** butterflies of the species ever */
  n: number;
  /** a caterpillar of it hatched */
  larva: boolean;
  /** biggest wingspan (mm) */
  best: number;
  radiant: number;
  classic: boolean;
  /** aberrations seen (F.ALBINO | F.MELANIC | F.GYN) */
  ab: number;
  first: string;
}

/** One butterfly, compactly: its path (base64, wing.ts) draws the same wing forever. */
export interface ButterflyRec {
  id: number;
  sp: string;
  day: string;
  mm: number;
  /** size class 0..3 (S..XL) */
  cls: number;
  f: number;
  pig: number[];
  /** colour depth 0..100 */
  b: number;
  path: string;
}

export interface EggRec { sp: string; ready: string; from: 'laid' | 'welcome' }

export interface MothProgress {
  v: 1;
  sessions: number;
  lastDay: string | null;
  total: number;
  /** eggs used up (one per butterfly) */
  hatched: number;
  nextId: number;
  butterflies: ButterflyRec[];
  atlas: Record<string, AtlasEntry>;
  eggs: EggRec[];
  /** butterflies since the last egg of each tier or better, and since the last aberration */
  pity: { rare: number; epic: number; legend: number; aberr: number };
  pollen: number;
  bestSession: number;
  daily: { day: string; done: boolean; sp: string; mm: number };
}

export const KEEP_RECORDS = 120;
const MAX_EGGS = 30;

export function freshProgress(): MothProgress {
  return {
    v: 1, sessions: 0, lastDay: null, total: 0, hatched: 0, nextId: 1, butterflies: [], atlas: {}, eggs: [],
    pity: { rare: 0, epic: 0, legend: 0, aberr: 0 }, pollen: 0, bestSession: 0,
    daily: { day: '', done: false, sp: '', mm: 0 },
  };
}

// ── days ──────────────────────────────────────────────────────────
const parseDay = (d: string): Date => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, (m || 1) - 1, dd || 1);
};
const fmtDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const nextDay = (day: string): string => {
  const d = parseDay(day);
  d.setDate(d.getDate() + 1);
  return fmtDay(d);
};

export const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);

// ── habitats and species ──────────────────────────────────────────
export const openHabitats = (p: MothProgress): HabitatId[] => HABITATS.filter(h => p.total >= h.unlock).map(h => h.id);

export const openSpecies = (p: MothProgress): Species[] => {
  const open = openHabitats(p);
  return SPECIES.filter(s => open.includes(s.habitat));
};

export const collected = (p: MothProgress, id: string): boolean => (p.atlas[id]?.n ?? 0) > 0;

const entry = (p: MothProgress, id: string, day: string): AtlasEntry =>
  (p.atlas[id] ??= { n: 0, larva: false, best: 0, radiant: 0, classic: false, ab: 0, first: day });

/** The published odds: a tier for a wild egg. */
export function rollTier(rng: () => number): TierIndex {
  const u = rng();
  if (u < TIERS[3].odds) return 3;
  if (u < TIERS[3].odds + TIERS[2].odds) return 2;
  if (u < TIERS[3].odds + TIERS[2].odds + TIERS[1].odds) return 1;
  return 0;
}

const pityOf = (p: MothProgress, t: TierIndex): number => (t === 1 ? p.pity.rare : t === 2 ? p.pity.epic : t === 3 ? p.pity.legend : 0);

/** The highest tier the pity now guarantees for the next egg (0: none). */
export function forcedTier(p: MothProgress): TierIndex {
  for (const t of [3, 2, 1] as const) if (pityOf(p, t) >= TIERS[t].pity - 1) return t;
  return 0;
}

const pick = <T>(arr: readonly T[], rng: () => number): T => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

/** A wild egg's species of `tier` from the open habitats (missing ones first when asked). */
function wildSpecies(p: MothProgress, tier: TierIndex, rng: () => number, preferMissing: boolean): Species {
  const pool = openSpecies(p).filter(s => s.tier === tier);
  const missing = pool.filter(s => !collected(p, s.id));
  return pick(preferMissing && missing.length ? missing : pool, rng);
}

/** The cheapest missing species pyłek can buy now (null: none, or not enough pyłek). */
export function pollenTarget(p: MothProgress): Species | null {
  const missing = openSpecies(p).filter(s => !collected(p, s.id)).sort((a, b) => a.tier - b.tier);
  return missing.length ? missing[0] : null;
}

const DAILY_POOL = SPECIES.filter(s => s.habitat === 'ogrod' && s.tier <= 1);

/** The day's shared species ("Liść dnia"): the same for everybody on that day. */
export function dailySpecies(daySeed: number): Species {
  // a cheap hash of the seed: independent of the leaf's own random stream
  let h = (daySeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return DAILY_POOL[h % DAILY_POOL.length];
}

export type EggSource = 'first' | 'daily' | 'pity' | 'pollen' | 'laid' | 'welcome' | 'wild';

export interface EggOffer {
  sp: string;
  tier: TierIndex;
  source: EggSource;
  /** the species is not in the atlas yet */
  isNew: boolean;
  /** index into progress.eggs for a laid or welcome egg */
  egg: number;
}

export const SOURCE_TEXT: Record<EggSource, string> = {
  first: 'Pierwsze jajo', daily: 'Liść dnia', pity: 'Gwarantowane', pollen: 'Za pyłek', laid: 'Twoje jajo',
  welcome: 'Ktoś zostawił jajeczko…', wild: 'Dzikie jajo',
};

/**
 * The two egg cards of a new leaf, in order (the left one is the default pick): the very first
 * egg, a pity egg (on the default card, as published), the day's leaf (it waits for the next leaf
 * when a pity egg is due), an egg pyłek can buy, ready eggs (oldest first), wild eggs.
 */
export function drawEggs(p: MothProgress, day: string, daySeed: number, rng: () => number): EggOffer[] {
  const offers: EggOffer[] = [];
  const add = (sp: Species, source: EggSource, egg = -1) => {
    if (offers.length >= 2 || offers.some(o => o.sp === sp.id && o.source === source && o.egg === egg)) return;
    offers.push({ sp: sp.id, tier: sp.tier, source, isNew: !collected(p, sp.id), egg });
  };
  if (p.hatched === 0) add(speciesById('pawik'), 'first');
  const forced = forcedTier(p);
  if (forced > 0 && !offers.some(o => o.tier >= forced)) add(wildSpecies(p, forced, rng, true), 'pity');
  if (p.daily.day !== day) p.daily = { day, done: false, sp: dailySpecies(daySeed).id, mm: 0 };
  if (!p.daily.done) add(speciesById(p.daily.sp), 'daily');
  const target = pollenTarget(p);
  if (target && p.pollen >= TIERS[target.tier].price) add(target, 'pollen');
  p.eggs.forEach((e, i) => { if (e.ready <= day) add(speciesById(e.sp), e.from, i); });
  for (let tries = 0; offers.length < 2 && tries < 12; tries++) {
    const sp = wildSpecies(p, rollTier(rng), rng, false);
    if (tries < 8 && offers.some(o => o.sp === sp.id)) continue;   // two different cards when possible
    add(sp, 'wild', -100 - tries);
  }
  return offers;
}

/** A caterpillar of `sp` hatched: its card opens in the Atlas (its egg is spent when the butterfly emerges). */
export function hatch(p: MothProgress, sp: string, day: string): void {
  entry(p, sp, day).larva = true;
}

/**
 * A butterfly emerged from `egg`: a laid or welcome egg leaves the list, a bought one costs its pyłek,
 * and the pity counters move by the butterfly's tier (null: an egg of no particular source).
 */
function spendEgg(p: MothProgress, egg: EggOffer | null, tier: TierIndex): void {
  if (egg && (egg.source === 'laid' || egg.source === 'welcome')) {
    const at = p.eggs[egg.egg];
    const i = at && at.sp === egg.sp && at.from === egg.source ? egg.egg : p.eggs.findIndex(e => e.sp === egg.sp && e.from === egg.source);
    if (i >= 0) p.eggs.splice(i, 1);
  }
  if (egg?.source === 'pollen') p.pollen = Math.max(0, p.pollen - TIERS[egg.tier].price);
  p.pity.rare = tier >= 1 ? 0 : p.pity.rare + 1;
  p.pity.epic = tier >= 2 ? 0 : p.pity.epic + 1;
  p.pity.legend = tier >= 3 ? 0 : p.pity.legend + 1;
  p.hatched++;
}

/** Session start: the welcome-back egg after two or more days away (its species, or null), the day and the count. */
export function beginSession(p: MothProgress, day: string, rng: () => number): Species | null {
  let gift: Species | null = null;
  if (p.lastDay && daysBetween(p.lastDay, day) >= 2) {
    gift = wildSpecies(p, 1, rng, true);
    p.eggs.unshift({ sp: gift.id, ready: day, from: 'welcome' });
  }
  p.lastDay = day;
  p.sessions++;
  return gift;
}

/** An aberration at emergence (forced once the pity runs out). */
export function rollAberration(p: MothProgress, radiant: boolean, rng: () => number): Aberration | null {
  const u = rng(), k = radiant ? RADIANT_ABERRATION_BOOST : 1;
  const g = ABERRATION_ODDS.gyn * k, a = ABERRATION_ODDS.albino * k, m = ABERRATION_ODDS.melanic * k;
  let ab: Aberration | null = null;
  if (p.pity.aberr >= ABERRATION_PITY - 1) {
    const w = u * (g + a + m);
    ab = w < g ? 'gyn' : w < g + a ? 'albino' : 'melanic';
  } else if (u < g) ab = 'gyn';
  else if (u < g + a) ab = 'albino';
  else if (u < g + a + m) ab = 'melanic';
  p.pity.aberr = ab ? 0 : p.pity.aberr + 1;
  return ab;
}

export const ABERRATION_FLAG: Record<Aberration, number> = { albino: F.ALBINO, melanic: F.MELANIC, gyn: F.GYN };

export interface EmergeInput {
  sp: string;
  mm: number;
  cls: number;
  flags: number;
  pig: number[];
  depth: number;
  path: string;
  daily: boolean;
  /** the egg card it hatched from (spent now) */
  egg?: EggOffer | null;
}

export interface EmergeResult {
  rec: ButterflyRec;
  isNew: boolean;
  /** beat the species' biggest so far */
  record: boolean;
  aberration: Aberration | null;
  pollen: number;
  /** a habitat opened by this butterfly */
  opened: HabitatId | null;
}

/**
 * Keep at most KEEP_RECORDS full butterflies: each species' biggest (the first of equals, the one the
 * Atlas shows) stays, the oldest others go (their species' summary in the atlas keeps their numbers).
 */
function pruneRecords(p: MothProgress): void {
  let extra = p.butterflies.length - KEEP_RECORDS;
  if (extra <= 0) return;
  const best = new Map<string, ButterflyRec>();
  for (const r of p.butterflies) {
    const b = best.get(r.sp);
    if (!b || r.mm > b.mm) best.set(r.sp, r);
  }
  const pinned = new Set(best.values());
  for (let i = 0; i < p.butterflies.length && extra > 0;) {
    if (pinned.has(p.butterflies[i])) i++;
    else {
      p.butterflies.splice(i, 1);
      extra--;
    }
  }
}

/** A butterfly flew out: its egg is spent, the atlas, pyłek for a duplicate, an aberration roll, its egg for tomorrow. */
export function emerge(p: MothProgress, b: EmergeInput, day: string, rng: () => number): EmergeResult {
  const sp = speciesById(b.sp), e = entry(p, sp.id, day);
  spendEgg(p, b.egg ?? null, sp.tier);
  const radiant = (b.flags & F.RADIANT) !== 0;
  const isNew = e.n === 0, before = e.best;
  const aberration = rollAberration(p, radiant, rng);
  const flags = b.flags | (aberration ? ABERRATION_FLAG[aberration] : 0) | (b.daily ? F.DAILY : 0);
  const pollen = isNew ? 0 : TIERS[sp.tier].dup * (radiant ? 2 : 1);
  p.pollen += pollen;
  const open0 = openHabitats(p);
  const rec: ButterflyRec = { id: p.nextId++, sp: sp.id, day, mm: b.mm, cls: b.cls, f: flags, pig: b.pig.slice(0, 3), b: Math.round(b.depth * 100), path: b.path };
  p.butterflies.push(rec);
  pruneRecords(p);
  e.n++;
  e.larva = true;
  e.best = Math.max(e.best, b.mm);
  if (radiant) e.radiant++;
  if (flags & F.CLASSIC) e.classic = true;
  if (aberration) e.ab |= ABERRATION_FLAG[aberration];
  p.total++;
  p.eggs.push({ sp: sp.id, ready: nextDay(day), from: 'laid' });
  while (p.eggs.length > MAX_EGGS) {
    const [old] = p.eggs.splice(0, 1);
    p.pollen += Math.ceil(TIERS[speciesById(old.sp).tier].dup / 2);   // nothing is wasted
  }
  if (b.daily && p.daily.day === day) {
    p.daily.done = true;
    p.daily.mm = Math.max(p.daily.mm, b.mm);
  }
  const opened = openHabitats(p).find(h => !open0.includes(h)) ?? null;
  return { rec, isNew, record: !isNew && b.mm > before, aberration, pollen, opened };
}

/** Eggs waiting for a later day, by species: "Jutro wyklują się: 2× rusałka pawik, cytrynek (nowy!)". */
export function laterEggs(p: MothProgress, day: string): { sp: Species; n: number; isNew: boolean }[] {
  const out: { sp: Species; n: number; isNew: boolean }[] = [];
  for (const e of p.eggs) {
    if (e.ready <= day) continue;
    const hit = out.find(o => o.sp.id === e.sp);
    if (hit) hit.n++;
    else out.push({ sp: speciesById(e.sp), n: 1, isNew: !collected(p, e.sp) });
  }
  return out;
}

export function eggsLine(items: { sp: Species; n: number; isNew: boolean }[]): string {
  return items.map(i => `${i.n > 1 ? `${i.n}× ` : ''}${i.sp.name}${i.isNew ? ' (nowy!)' : ''}`).join(', ');
}

/** Stats for the lobby: species found, butterflies, the biggest, radiant ones. */
export function atlasStats(p: MothProgress): { found: number; total: number; biggest: number; radiant: number } {
  let found = 0, biggest = 0, radiant = 0;
  for (const s of SPECIES) {
    const e = p.atlas[s.id];
    if (!e || e.n === 0) continue;
    found++;
    biggest = Math.max(biggest, e.best);
    radiant += e.radiant;
  }
  return { found, total: p.total, biggest, radiant };
}
