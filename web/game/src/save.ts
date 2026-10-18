/**
 * Progress, kept in localStorage (small JSON; versioned; validated on load).
 * What is unlocked is DERIVED from prayers, Light and rank rather than stored,
 * so it can never drift out of sync.  Export/import guards against browsers
 * clearing site data.
 */
import { FRUITS } from './content/fruits';
import { BASE_POOL } from './sim/run';
import type {
  ChapterDef, FruitId, PowerId, PrayerDef, PrayerId, RankDef, RealmId, SkinDef, SkinId, SkinSlot, SoundscapeDef, SoundscapeId,
} from './types';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  /** everything silent */
  muted: boolean;
  /** music off, effects on (the ♪ button) */
  musicMuted: boolean;
  reducedMotion: boolean;
  /** repeat the prayers of the heart aloud (speech recognition) */
  voicePrayer: boolean;
  voiceConsent: boolean;
}

export interface SaveData {
  version: 2;
  createdAt: number;
  seenDisclaimer: boolean;
  seenIntro: boolean;
  /** completion time per prayer */
  prayers: Partial<Record<PrayerId, number>>;
  cleared: Partial<Record<RealmId, { at: number; falls: number; fragments: number; times: number }>>;
  /** lifetime Light — decides the angel's rank */
  light: number;
  manna: number;
  fruits: Partial<Record<FruitId, number>>;
  equipped: Record<SkinSlot, SkinId>;
  soundscape: SoundscapeId;
  /** revelation ids received */
  codex: string[];
  /** bestStreak: the longest sustained focus, s */
  stats: { traumas: number; fragments: number; falls: number; chapters: number; seconds: number; bestStreak: number };
  settings: Settings;
}

export const SAVE_KEY = 'holyholyholy.save';

/** quiet by default: the music sits under the game */
export const DEFAULT_VOLUMES = { master: 0.7, music: 0.4, sfx: 0.7 } as const;

export const defaultSave = (): SaveData => ({
  version: 2,
  createdAt: Date.now(),
  seenDisclaimer: false,
  seenIntro: false,
  prayers: {},
  cleared: {},
  light: 0,
  manna: 0,
  fruits: {},
  equipped: { halo: 'halo_zlota', robe: 'szata_lniana', wings: 'skrzydla_biale' },
  soundscape: 'psalm',
  codex: [],
  stats: { traumas: 0, fragments: 0, falls: 0, chapters: 0, seconds: 0, bestStreak: 0 },
  settings: { ...DEFAULT_VOLUMES, muted: false, musicMuted: false, reducedMotion: false, voicePrayer: false, voiceConsent: false },
});

const SOUNDSCAPES: readonly SoundscapeId[] = ['psalm', 'gregorianski', 'bizantyjski', 'dzwony', 'cisza'];

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** a finite number clamped to [lo, hi] — hostile or corrupt values cannot freeze the HUD or poison sums */
const bounded = (v: unknown, lo: number, hi: number, d = lo) => Math.min(hi, Math.max(lo, num(v, d)));
const count = (v: unknown, hi = 1e9) => Math.floor(bounded(v, 0, hi));
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/** Merge untrusted JSON onto defaults, keeping only well-typed fields. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  const numRecord = <K extends string>(v: unknown): Partial<Record<K, number>> => {
    const out: Partial<Record<K, number>> = {};
    if (isObj(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x)) out[k as K] = x;
    return out;
  };
  const cleared: SaveData['cleared'] = {};
  if (isObj(raw.cleared)) {
    for (const [k, v] of Object.entries(raw.cleared)) {
      if (isObj(v)) cleared[k as RealmId] = { at: num(v.at, 0), falls: count(v.falls), fragments: count(v.fragments), times: Math.max(1, count(v.times)) };
    }
  }
  // fruit levels: whole numbers within each fruit's range; unknown fruits dropped
  const fruits: SaveData['fruits'] = {};
  if (isObj(raw.fruits)) {
    for (const f of FRUITS) {
      const lvl = count(raw.fruits[f.id], f.maxLevel);
      if (lvl > 0) fruits[f.id] = lvl;
    }
  }
  const eq = isObj(raw.equipped) ? raw.equipped : {};
  const st = isObj(raw.stats) ? raw.stats : {};
  const se = isObj(raw.settings) ? raw.settings : {};
  // version 1 → 2: the loud old defaults and the old default chant give way to the quieter game soundtrack;
  // the read-aloud mode is gone (praying aloud stays, if the player had agreed to speech recognition)
  const v1 = raw.version !== 2;
  const oldLoud = v1 && se.master === 0.8 && se.music === 0.7 && se.sfx === 0.8;
  const vol = (k: 'master' | 'music' | 'sfx') => (oldLoud ? DEFAULT_VOLUMES[k] : bounded(se[k], 0, 1, DEFAULT_VOLUMES[k]));
  const soundscape = v1 && raw.soundscape === 'gregorianski' ? 'psalm'
    : SOUNDSCAPES.includes(raw.soundscape as SoundscapeId) ? raw.soundscape as SoundscapeId : d.soundscape;
  const voiceConsent = bool(se.voiceConsent, false);
  return {
    version: 2,
    createdAt: num(raw.createdAt, d.createdAt),
    seenDisclaimer: bool(raw.seenDisclaimer, false),
    seenIntro: bool(raw.seenIntro, false),
    prayers: numRecord<PrayerId>(raw.prayers),
    cleared,
    light: bounded(raw.light, 0, 1e12),
    manna: count(raw.manna),
    fruits,
    equipped: {
      halo: typeof eq.halo === 'string' ? eq.halo : d.equipped.halo,
      robe: typeof eq.robe === 'string' ? eq.robe : d.equipped.robe,
      wings: typeof eq.wings === 'string' ? eq.wings : d.equipped.wings,
    },
    soundscape,
    codex: Array.isArray(raw.codex) ? raw.codex.filter((x): x is string => typeof x === 'string') : [],
    stats: {
      traumas: count(st.traumas), fragments: count(st.fragments), falls: count(st.falls),
      chapters: count(st.chapters), seconds: bounded(st.seconds, 0, 1e10), bestStreak: bounded(st.bestStreak, 0, 1e7),
    },
    settings: {
      master: vol('master'), music: vol('music'), sfx: vol('sfx'),
      muted: bool(se.muted, false), musicMuted: bool(se.musicMuted, false), reducedMotion: bool(se.reducedMotion, false),
      voicePrayer: v1 ? voiceConsent && se.prayerMode !== 'read' : bool(se.voicePrayer, false), voiceConsent,
    },
  };
}

export function loadSave(storage: StorageLike | null = safeStorage()): SaveData {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(SAVE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : defaultSave();
  } catch {
    // unreadable: set it aside, so the fresh save written next does not destroy it
    try {
      if (raw) storage?.setItem(`${SAVE_KEY}.corrupt`, raw);
    } catch {
      // quota or blocked storage: nothing more to do
    }
    return defaultSave();
  }
}

/** Keep a copy of the stored save (before an import or a reset replaces it). */
export function backupSave(storage: StorageLike | null = safeStorage()): void {
  try {
    const cur = storage?.getItem(SAVE_KEY);
    if (cur) storage?.setItem(`${SAVE_KEY}.bak`, cur);
  } catch {
    // quota or blocked storage: the import still goes ahead
  }
}

export function writeSave(data: SaveData, storage: StorageLike | null = safeStorage()): boolean {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(data));
    return !!storage;
  } catch {
    return false;   // private mode / quota: the game keeps running in memory
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const exportSave = (data: SaveData): string => JSON.stringify({ app: 'HolyHolyHoly', ...data }, null, 2);

export function importSave(text: string): SaveData {
  const raw: unknown = JSON.parse(text);
  if (!isObj(raw) || raw.app !== 'HolyHolyHoly') throw new Error('To nie jest kopia zapasowa HolyHolyHoly');
  const s = sanitize(raw);
  s.settings.voiceConsent = false;   // consent belongs to a device, not to a backup file
  return s;
}

// ─── derived unlocks ────────────────────────────────────────────────

export const prayed = (s: SaveData, id: PrayerId): boolean => s.prayers[id] !== undefined;

export function rankIndex(s: SaveData, ranks: readonly RankDef[]): number {
  let i = 0;
  ranks.forEach((r, k) => { if (s.light >= r.light) i = k; });
  return i;
}

export function availablePowers(s: SaveData, prayers: readonly PrayerDef[]): PowerId[] {
  const out = new Set<PowerId>(BASE_POOL);
  for (const p of prayers) if (prayed(s, p.id)) p.unlocks.powers?.forEach(id => out.add(id));
  return [...out];
}

export const ultimateUnlocked = (s: SaveData, prayers: readonly PrayerDef[]): boolean =>
  prayers.some(p => p.unlocks.ultimate && prayed(s, p.id));

export const codexUnlocked = (s: SaveData, prayers: readonly PrayerDef[]): boolean =>
  prayers.some(p => p.unlocks.codex && prayed(s, p.id));

/** Spheres open one after another; side realms open with their prayer. */
export function realmUnlocked(s: SaveData, ch: ChapterDef, chapters: readonly ChapterDef[]): boolean {
  if (ch.unlockedBy) return prayed(s, ch.unlockedBy);
  if (ch.order === 0) return true;
  const prev = chapters.find(c => c.order === ch.order - 1);
  return !!prev && s.cleared[prev.id] !== undefined;
}

export function skinOwned(s: SaveData, skin: SkinDef, ranks: readonly RankDef[]): boolean {
  const u = skin.unlock;
  if (u === 'default') return true;
  if (u.prayer && prayed(s, u.prayer)) return true;
  if (u.light !== undefined && s.light >= u.light) return true;
  if (u.rank) {
    const need = ranks.findIndex(r => r.id === u.rank);
    if (need >= 0 && rankIndex(s, ranks) >= need) return true;
  }
  return false;
}

export function soundscapeOwned(s: SaveData, sc: SoundscapeDef): boolean {
  const u = sc.unlock;
  if (u === 'default') return true;
  return (u.prayer !== undefined && prayed(s, u.prayer)) || (u.light !== undefined && s.light >= u.light);
}

/** Buy one level of a fruit with Manna. Returns false if not affordable or maxed. */
export function buyFruit(s: SaveData, id: FruitId, costs: readonly number[], maxLevel: number): boolean {
  const lvl = s.fruits[id] ?? 0;
  if (lvl >= maxLevel) return false;
  const cost = costs[lvl];
  if (s.manna < cost) return false;
  s.manna -= cost;
  s.fruits[id] = lvl + 1;
  return true;
}
