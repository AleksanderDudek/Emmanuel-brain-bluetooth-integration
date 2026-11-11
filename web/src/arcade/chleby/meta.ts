/**
 * What Chleby i ryby remembers between sessions (v3) and the pure rules of its meta game:
 *
 *   the path      the level the player stands at (chapters of four, the fourth ending in a boss
 *                 arena) and the best stars won on each level
 *   the bank      baskets of crumbs (calm on the grass, snatched bread, levels, bosses, the day's
 *                 gift) — they build the village
 *   the village   Betsaida by the lake, built between levels: Piekarnia (the stream), Przystań (fish),
 *                 Wikliniarnia (the champions), Brama (a ×2 gate by the basket), Studnia (the help
 *                 charges faster), Spichlerz (the gift and the bundles' luck); its level (the sum)
 *                 brings new cards into the bundles
 *   the cards     copies by card (cards.ts), the loadout (basket, bread, champion, help), the pity
 *   the league    stars from levels, buildings and evolutions → tiers from a handful to the twelve
 *                 baskets; each new tier pays a chest
 *   missions      three at a time, each pays a bundle
 *   the day       the date's weather, the same for everyone; the day's gift
 *
 * No DOM, no randomness.  Old saves are migrated in place by `migrate()`: a v2 save keeps its path,
 * stars, bank, records and coach marks, and its four upgrades become the village's first buildings;
 * a v1 save keeps its records, sessions and people fed.
 */
import {
  CARDS, KINDS, STARTER, cardDef, evolutions, isCard, levelOf, starterCards, type CardDef, type CardId, type CardKind, type Loadout,
} from './cards';
import { RULES } from './rules';

export type BossKind = 'pelikan' | 'koziol' | 'czapla' | 'kormorany';
export const BOSSES: readonly BossKind[] = ['pelikan', 'koziol', 'czapla', 'kormorany'];

export type Building = 'piekarnia' | 'przystan' | 'wiklina' | 'brama' | 'studnia' | 'spichlerz';
export const BUILDINGS: readonly Building[] = ['piekarnia', 'przystan', 'wiklina', 'brama', 'studnia', 'spichlerz'];
/** baskets for each building's next level (the first four were v2's upgrades; a v2 save keeps the levels it bought) */
export const BUILD_PRICES: Readonly<Record<Building, readonly number[]>> = {
  piekarnia: [8, 16, 26, 40],
  przystan: [10, 20, 32],
  wiklina: [12, 22, 36, 50],
  brama: [12, 24, 36],
  studnia: [14, 26, 40],
  spichlerz: [16, 30, 46],
};

export type MissionKind = 'feed' | 'gold' | 'champ' | 'gulls' | 'stars' | 'help' | 'rest' | 'boss' | 'build';
export const MISSION_KINDS: readonly MissionKind[] = ['feed', 'gold', 'champ', 'gulls', 'stars', 'help', 'rest', 'boss', 'build'];
export interface Mission { kind: MissionKind; goal: number; have: number }

export type DayKind = 'zwykly' | 'wiatr' | 'targ' | 'rodzina' | 'polow' | 'cisza';

export interface ChlebyProgress {
  ver: 3;
  /** sessions saved */
  sessions: number;
  /** people fed, all time; levels finished; Pelikans sated (v2's count); champions sent */
  total: number;
  levels: number;
  pelikans: number;
  bigs: number;
  /** the level the player stands at (0-based, all chapters) */
  level: number;
  /** the best stars per level (index = level) */
  stars: number[];
  /** baskets of crumbs in the bank, the crumbs of the next one (0..1), and all baskets ever filled */
  bank: number;
  crumbs: number;
  bankAll: number;
  /** the village: each building's level (0 = not built) */
  village: Record<Building, number>;
  /** the collection: copies by card id */
  cards: Record<string, number>;
  /** the cards taken into play */
  loadout: Loadout;
  /** cards since the last epic or legend (the bundles' pity), and bundles opened, all time */
  pity: number;
  packs: number;
  /** league tiers already paid (a chest each) */
  tier: number;
  /** the three missions, and how many were done, all time */
  missions: Mission[];
  missionsDone: number;
  /** bosses sated by kind, and helps used, all time */
  bosses: Record<BossKind, number>;
  helps: number;
  /** a chest waits for a player coming from v2 (the village opens) */
  welcome: number;
  /** Rozdawanie blocks begun, all time: every 4th is blind ("Mgła nad jeziorem") from the 3rd session */
  calls: number;
  /** the highest golden-gate multiplier ever seen working */
  bestGold: number;
  /** records: people fed per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** story cards shown: bit 0 the opening, bit c + 1 the chapter c, STORY_BITS for the rest */
  seen: number;
  /** coach marks whose control the player has done (bits of Teach) */
  taught: number;
  /** the day's gift */
  giftDay: string;
}

const freshVillage = (): Record<Building, number> => ({ piekarnia: 0, przystan: 0, wiklina: 0, brama: 0, studnia: 0, spichlerz: 0 });
const freshBosses = (): Record<BossKind, number> => ({ pelikan: 0, koziol: 0, czapla: 0, kormorany: 0 });

export function freshProgress(): ChlebyProgress {
  const p: ChlebyProgress = {
    ver: 3, sessions: 0, total: 0, levels: 0, pelikans: 0, bigs: 0, level: 0, stars: [], bank: 0, crumbs: 0, bankAll: 0,
    village: freshVillage(), cards: starterCards(), loadout: { ...STARTER }, pity: 0, packs: 0, tier: 0, missions: [], missionsDone: 0,
    bosses: freshBosses(), helps: 0, welcome: 0, calls: 0, bestGold: 1, best: {}, lastLen: 0, seen: 0, taught: 0, giftDay: '',
  };
  fillMissions(p);
  return p;
}

const num = (v: unknown, def = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Bring a loaded save to v3, in place (idempotent).  v2: the path, the stars, the bank, the records,
 * the story cards and the coach marks stay; the upgrades become buildings (Strumień → Piekarnia, Ryby
 * → Przystań, Wielki kosz → Wikliniarnia, Bramka startowa → Brama); the collection starts with the
 * starter cards and a welcome chest; the league starts at the tier the stars already reach (no
 * back-pay).  v1: the records, the sessions and the people fed stay.  Fields of a wrong type are
 * reset rather than trusted.
 */
export function migrate(p: ChlebyProgress): ChlebyProgress {
  const o = p as unknown as Record<string, unknown>;
  if ('v' in o || (o.ver !== 2 && o.ver !== 3)) {
    // v1 (the rolling-bread version) or unknown: keep the records only
    const keep = {
      sessions: num(o.sessions), total: num(o.total), calls: num(o.calls), lastLen: num(o.lastLen),
      giftDay: typeof o.giftDay === 'string' ? o.giftDay : '',
      best: isObj(o.best) ? o.best : {},
    };
    for (const k of Object.keys(o)) delete o[k];
    Object.assign(o, freshProgress(), keep, { welcome: num(keep.sessions) > 0 ? 1 : 0 });
  } else if (o.ver === 2) {
    // v2: the four upgrades become the village's first buildings
    const up = isObj(o.up) ? o.up : {};
    const village = freshVillage();
    village.piekarnia = num(up.rate);
    village.przystan = num(up.fish);
    village.wiklina = num(up.big);
    village.brama = num(up.start);
    delete o.up;
    o.village = village;
    o.cards = starterCards();
    o.loadout = { ...STARTER };
    o.bosses = { ...freshBosses(), pelikan: num(o.pelikans) };
    o.welcome = num(o.sessions) > 0 ? 1 : 0;
    o.ver = 3;
    o.tier = -1;   // set from the stars below
  }
  // sanitise every field (an odd save never crashes the game)
  const f = freshProgress() as unknown as Record<string, unknown>;
  for (const k of Object.keys(f)) {
    const want = typeof f[k];
    if (Array.isArray(f[k])) { if (!Array.isArray(o[k])) o[k] = []; continue; }
    if (want === 'object') { if (!isObj(o[k])) o[k] = f[k]; continue; }
    if (typeof o[k] !== want || (want === 'number' && !Number.isFinite(o[k] as number))) o[k] = f[k];
  }
  const best: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.best)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) best[k] = v;
  p.best = best;
  const village = freshVillage();
  for (const b of BUILDINGS) village[b] = Math.min(maxBuild(b), Math.max(0, Math.round(num((p.village as Record<string, unknown>)[b]))));
  p.village = village;
  const cards: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.cards)) if (isCard(k) && typeof v === 'number' && Number.isFinite(v) && v >= 1) cards[k] = Math.floor(v);
  for (const [k, v] of Object.entries(starterCards())) cards[k] = Math.max(cards[k] ?? 0, v);
  p.cards = cards;
  const lo = (isObj(p.loadout) ? p.loadout : {}) as Record<string, unknown>;
  const loadout = { ...STARTER } as Loadout;
  for (const k of KINDS) {
    const id = lo[k];
    if (isCard(id) && cardDef(id)?.kind === k && (cards[id] ?? 0) >= 1) (loadout as Record<CardKind, CardId>)[k] = id;
  }
  p.loadout = loadout;
  const bosses = freshBosses();
  for (const b of BOSSES) bosses[b] = Math.max(0, Math.floor(num((p.bosses as Record<string, unknown>)[b])));
  p.bosses = bosses;
  p.missions = p.missions
    .filter((m): m is Mission => isObj(m) && MISSION_KINDS.includes(m.kind as MissionKind) && num(m.goal) > 0)
    .map(m => ({ kind: m.kind, goal: Math.floor(num(m.goal)), have: Math.max(0, Math.min(Math.floor(num(m.goal)), Math.floor(num(m.have)))) }))
    .filter((m, i, all) => all.findIndex(x => x.kind === m.kind) === i)
    .slice(0, RULES.missions);
  p.stars = p.stars.map(s => Math.max(0, Math.min(3, Math.round(num(s)))));
  p.level = Math.max(0, Math.floor(p.level));
  p.crumbs = Math.max(0, Math.min(0.999, p.crumbs));
  p.bank = Math.max(0, Math.floor(p.bank));
  p.pity = Math.max(0, Math.floor(p.pity));
  p.missionsDone = Math.max(0, Math.floor(p.missionsDone));
  p.welcome = p.welcome > 0 ? 1 : 0;
  if (p.tier < 0) p.tier = tierOf(starsTotal(p));
  p.tier = Math.max(0, Math.floor(p.tier));
  p.ver = 3;
  fillMissions(p);
  return p;
}

// ── the village ──────────────────────────────────────────────────
export const maxBuild = (b: Building): number => BUILD_PRICES[b].length;

export const buildLevel = (p: ChlebyProgress, b: Building): number =>
  Math.min(maxBuild(b), Math.max(0, Math.round(p.village?.[b] ?? 0)));

/** The village's level: every building's level added up (it brings new cards into the bundles). */
export const villageLevel = (p: ChlebyProgress): number => BUILDINGS.reduce((s, b) => s + buildLevel(p, b), 0);
export const VILLAGE_MAX = BUILDINGS.reduce((s, b) => s + maxBuild(b), 0);

/** The baskets for a building's next level (null at the top). */
export function buildPrice(b: Building, level: number): number | null {
  const list = BUILD_PRICES[b];
  return level >= list.length ? null : list[level];
}

/** Build a building's next level if the bank allows; true when built. */
export function build(p: ChlebyProgress, b: Building): boolean {
  const lv = buildLevel(p, b), price = buildPrice(b, lv);
  if (price === null || p.bank < price) return false;
  p.bank -= price;
  p.village = { ...freshVillage(), ...p.village, [b]: lv + 1 };
  return true;
}

export interface Offer { b: Building; level: number; price: number; can: boolean }

/** The buildings on offer (not at the top), cheapest first; `level` is the one it would build. */
export function offers(p: ChlebyProgress): Offer[] {
  return BUILDINGS
    .map(b => ({ b, level: buildLevel(p, b), price: buildPrice(b, buildLevel(p, b)) }))
    .filter((o): o is { b: Building; level: number; price: number } => o.price !== null)
    .sort((a, b) => a.price - b.price)
    .map(o => ({ ...o, level: o.level + 1, can: p.bank >= o.price }));
}

/** The cards a village level brings into the bundles (the next ones, for the lobby). */
export const nextUnlocks = (p: ChlebyProgress): CardDef[] => {
  const v = villageLevel(p);
  const next = CARDS.filter(c => c.unlock > v);
  if (!next.length) return [];
  const at = Math.min(...next.map(c => c.unlock));
  return next.filter(c => c.unlock === at);
};

/** Add crumbs (in baskets); returns how many whole baskets they completed. */
export function addCrumbs(p: ChlebyProgress, baskets: number): number {
  if (!(baskets > 0)) return 0;
  p.crumbs += baskets;
  const whole = Math.floor(p.crumbs);
  p.crumbs -= whole;
  p.bank += whole;
  p.bankAll += whole;
  return whole;
}

/** The stream's rate (runners/s) with the Piekarnia; the fish's spacing with the Przystań (0: none). */
export const streamRate = (p: ChlebyProgress): number => RULES.stream + RULES.streamPerLevel * buildLevel(p, 'piekarnia');
export const fishEvery = (p: ChlebyProgress): number => RULES.fishEvery[Math.min(RULES.fishEvery.length - 1, buildLevel(p, 'przystan'))];
/** The Wikliniarnia's share on every champion's worth, and the ring's fill per shot. */
export const champBonus = (p: ChlebyProgress): number => 1 + RULES.champPerLevel * buildLevel(p, 'wiklina');
export const bigPerShot = (p: ChlebyProgress): number => RULES.bigPerShot + RULES.bigPerShotLevel * buildLevel(p, 'wiklina');
/** People fed that fill the help once (the Studnia makes it quicker). */
export const helpNeed = (p: ChlebyProgress): number => Math.round(RULES.helpNeed * (1 - RULES.studniaPerLevel * buildLevel(p, 'studnia')));
/** The day's gift, and the bundles' luck (the Spichlerz). */
export const giftOf = (p: ChlebyProgress): number => RULES.giftBaskets + buildLevel(p, 'spichlerz');
export const luckOf = (p: ChlebyProgress): number => RULES.luckPerLevel * buildLevel(p, 'spichlerz');
/** Posiłki: loaves that pour out by themselves at a terrace's start. */
export const reinforcements = (p: ChlebyProgress): number => RULES.reinforce + RULES.reinforcePerLevel * buildLevel(p, 'spichlerz');

// ── the league of stars ──────────────────────────────────────────
/** Stars: the best of every level, one per building level, one per card evolution. */
export const levelStars = (p: ChlebyProgress): number => (p.stars ?? []).reduce((s, n) => s + (n || 0), 0);
export const starsTotal = (p: ChlebyProgress): number => levelStars(p) + villageLevel(p) + evolutions(p.cards ?? {});

/** The tier for a number of stars (0: Garść … 5: Dwanaście koszy, then II, III … every tierStep). */
export function tierOf(stars: number): number {
  const T = RULES.tiers, s = Math.max(0, stars);
  let i = 0;
  for (let k = 0; k < T.length; k++) if (s >= T[k]) i = k;
  const last = T[T.length - 1];
  return s >= last ? T.length - 1 + Math.floor((s - last) / RULES.tierStep) : i;
}

/** The stars a tier begins at. */
export function tierFloor(tier: number): number {
  const T = RULES.tiers;
  return tier < T.length ? T[Math.max(0, tier)] : T[T.length - 1] + (tier - T.length + 1) * RULES.tierStep;
}

// ── missions ─────────────────────────────────────────────────────
/** A mission's goal, growing with the missions done before it. */
export function missionGoal(kind: MissionKind, k: number): number {
  switch (kind) {
    case 'feed': return Math.min(12000, 2000 + 600 * k);
    case 'gold': return Math.min(2500, 400 + 100 * k);
    case 'champ': return Math.min(8, 3 + Math.floor(k / 3));
    case 'gulls': return Math.min(400, 120 + 20 * k);
    case 'stars': return Math.min(24, 9 + Math.floor(k / 2));
    case 'help': return Math.min(8, 3 + Math.floor(k / 4));
    case 'rest': return Math.min(6, 3 + Math.floor(k / 5));
    case 'boss': return Math.min(3, 1 + Math.floor(k / 12));
    case 'build': return 1;
  }
}

/** The kinds in the order missions come round (a fixed shuffle). */
const ROTA: readonly MissionKind[] = ['feed', 'champ', 'gulls', 'build', 'gold', 'stars', 'rest', 'boss', 'help'];

/** Top the missions up to three: the next kinds in the rota that are not already open. */
export function fillMissions(p: ChlebyProgress): void {
  if (!Array.isArray(p.missions)) p.missions = [];
  let k = Math.max(0, Math.floor(p.missionsDone ?? 0)) * 4;
  for (let guard = 0; p.missions.length < RULES.missions && guard < 40; guard++, k++) {
    const kind = ROTA[k % ROTA.length];
    if (p.missions.some(m => m.kind === kind)) continue;
    p.missions.push({ kind, goal: missionGoal(kind, p.missionsDone ?? 0), have: 0 });
  }
}

/** Count `n` toward every open mission of `kind`; returns the missions it completed (already replaced). */
export function progressMission(p: ChlebyProgress, kind: MissionKind, n = 1): Mission[] {
  if (!(n > 0)) return [];
  const done: Mission[] = [];
  for (const m of p.missions) {
    if (m.kind !== kind || m.have >= m.goal) continue;
    m.have = Math.min(m.goal, m.have + n);
    if (m.have >= m.goal) done.push({ ...m });
  }
  if (!done.length) return [];
  p.missions = p.missions.filter(m => m.have < m.goal);
  p.missionsDone += done.length;
  fillMissions(p);
  return done;
}

// ── the day ──────────────────────────────────────────────────────
const DAYS: readonly DayKind[] = ['zwykly', 'wiatr', 'targ', 'zwykly', 'rodzina', 'polow', 'cisza'];
/** The day's weather from its seed: the same for everyone on that day. */
export const dayOf = (daySeed: number): DayKind => DAYS[((daySeed >>> 5) ^ (daySeed & 31)) % DAYS.length];

// ── stars per level ──────────────────────────────────────────────
/** A level's par (s): each terrace parBase + its hunger / parRate. */
export const parOf = (hungers: readonly number[]): number =>
  hungers.reduce((s, h) => s + RULES.parBase + h / RULES.parRate, 0);

/** A finished level's stars: 3 within par, 2 within starSlow × par, else 1 (the disciples' help: 1). */
export function starsFor(sec: number, par: number, byHelp: boolean): number {
  if (byHelp) return 1;
  if (sec <= par) return 3;
  return sec <= par * RULES.starSlow ? 2 : 1;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: ChlebyProgress, plannedSec: number): number | null {
  const v = p.best?.[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: ChlebyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best ?? {}).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

// ── the loadout ──────────────────────────────────────────────────
/** Take an owned card into play (its kind's slot); false when not owned. */
export function equip(p: ChlebyProgress, id: CardId): boolean {
  const def = cardDef(id);
  if (!def || !((p.cards?.[id] ?? 0) >= 1)) return false;
  p.loadout = { ...p.loadout, [def.kind]: id } as Loadout;
  return true;
}

export const lvl = (p: ChlebyProgress, id: CardId): number => Math.max(1, levelOf(id, p.cards?.[id] ?? 0));

// ── story cards and coach marks ──────────────────────────────────
export const seenCard = (p: ChlebyProgress, bit: number): boolean => ((p.seen ?? 0) & (1 << bit)) !== 0;
export const markCard = (p: ChlebyProgress, bit: number): void => { p.seen = (p.seen ?? 0) | (1 << bit); };
/** Story bits past the chapters (bits 1..6): a boss's first arena, the village, the collection. */
export const STORY_BITS = { boss: { pelikan: 8, koziol: 9, czapla: 10, kormorany: 11 }, village: 12, cards: 13 } as const;

/** The coach marks (bits of `taught`; v2's ten first, in their order, so old saves keep theirs). */
export const TEACH = [
  'tap', 'hold', 'drag', 'gull', 'gold', 'big', 'rest', 'pelikan', 'sub', 'add',
  'help', 'pack', 'jar', 'brook', 'sprint', 'rock', 'koziol', 'czapla', 'kormorany', 'burst', 'osiol', 'woz', 'wielblad', 'four',
] as const;
export type Teach = (typeof TEACH)[number];
export const taughtBit = (w: Teach): number => 1 << TEACH.indexOf(w);
export const isTaught = (p: ChlebyProgress, w: Teach): boolean => ((p.taught ?? 0) & taughtBit(w)) !== 0;
