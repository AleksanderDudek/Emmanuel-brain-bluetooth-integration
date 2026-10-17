/**
 * HolyHolyHoly — shared contracts between content, audio and the game engine.
 * Content modules (src/content) and the audio engine (src/audio) implement these;
 * the simulation (src/sim) and UI (src/ui) consume them.  Game text is Polish.
 */

// ─── Scripture ──────────────────────────────────────────────────────

/** A Bible verse in Polish. `ref` uses Polish abbreviations, e.g. "J 3,16", "Iz 6,3", "1 J 4,18". */
export interface Verse {
  ref: string;
  text: string;
}

// ─── Identifiers ────────────────────────────────────────────────────

/** The ten spheres of the Tree, ascended from Malkut (bottom) to Keter (top). */
export type SphereId =
  | 'malkut' | 'jesod' | 'hod' | 'necach' | 'tiferet' | 'gewura' | 'chesed' | 'bina' | 'chochma' | 'keter';
/** Side realms: Szeol (the descent to the dead — rescue lost soul fragments) and Ród (the family line). */
export type RealmId = SphereId | 'szeol' | 'rod';

export type TraumaKind =
  | 'lek' | 'wstyd' | 'gniew' | 'rozpacz' | 'odrzucenie' | 'samotnosc' | 'wina'
  | 'nalog' | 'pycha' | 'zazdrosc' | 'nieprzebaczenie' | 'zwatpienie' | 'kontrola' | 'oskarzyciel';

/**
 * How a trauma moves (Pac-Man ghost personalities, adapted):
 * chase = straight at you (Blinky), ambush = aims ahead of you (Pinky),
 * erratic = drifts then dashes (Inky), shy = chases from afar, flees up close (Clyde),
 * tank = slow and tough, splitter = splits in two when weakened,
 * blink = shy and teleports, ranged = keeps distance and shoots "flaming arrows" (Ef 6,16).
 */
export type TraumaBehavior = 'chase' | 'ambush' | 'erratic' | 'shy' | 'tank' | 'splitter' | 'blink' | 'ranged';

export type PowerId =
  | 'slowo' | 'chleby' | 'tarcza' | 'ogien' | 'wicher' | 'golebica' | 'eliasz' | 'jerycho' | 'dawid' | 'samson'
  | 'manna' | 'sandaly' | 'pancerz' | 'helm' | 'ucisz' | 'milosc' | 'ryba' | 'serce' | 'przebaczenie' | 'gorczyca';

/** Fruits of the Spirit (Ga 5,22-23): permanent talents bought with Manna. */
export type FruitId =
  | 'milosc' | 'radosc' | 'pokoj' | 'cierpliwosc' | 'uprzejmosc' | 'dobroc' | 'wiernosc' | 'lagodnosc' | 'opanowanie';

export type PrayerId =
  | 'inwokacja' | 'przyjmuje' | 'rod' | 'przebaczenie' | 'zbroja' | 'jezusowa' | 'zagubieni' | 'klamstwa' | 'trisagion';

/** The nine choirs of angels — the guardian angel's ranks, lowest first. */
export type RankId =
  | 'aniol' | 'archaniol' | 'zwierzchnosci' | 'wladze' | 'moce' | 'panowania' | 'trony' | 'cherubini' | 'serafini';

export type SkinSlot = 'halo' | 'robe' | 'wings';
export type SkinId = string;
export type SoundscapeId = 'gregorianski' | 'bizantyjski' | 'dzwony' | 'cisza';

/** The eight church modes (Gregorian numbering): 1 Dorian … 8 Hypomixolydian. */
export type ChantMode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// ─── Content ────────────────────────────────────────────────────────

export interface TraumaDef {
  kind: TraumaKind;
  /** shown on the creature, e.g. "Lęk" */
  name: string;
  behavior: TraumaBehavior;
  /** rim/eye colour of the shadow creature, CSS colour */
  color: string;
  /** base hit points before chapter scaling (10 = one basic "Słowo" hit) */
  hp: number;
  /** world units per second (player moves 4.2) */
  speed: number;
  /** what the trauma becomes once digested */
  truth: { word: string; verse: Verse };
}

/** A lie many Christians believe, exposed by a revelation after a chapter's stronghold falls. */
export interface Revelation {
  id: string;
  lie: string;
  truth: string;
  verses: Verse[];
}

export interface ChapterDef {
  id: RealmId;
  /** 0 = Malkut … 9 = Keter; side realms use 100+ */
  order: number;
  /** chapter title, e.g. "Kołyska" */
  title: string;
  /** e.g. { name: 'Malkut', meaning: 'Królestwo' } (side realms: their own name/meaning) */
  sphere: { name: string; meaning: string };
  /** 2–4 sentences: what Adam lived through at this stage (gentle, non-graphic) */
  story: string;
  /** chapter epigraph */
  verse: Verse;
  palette: { bg1: string; bg2: string; accent: string; wall: string; seed: string };
  /** trauma kinds that appear, most common first */
  traumas: TraumaKind[];
  boss: { name: string; lie: string; hp: number };
  revelationId: string;
  mode: ChantMode;
  realm: 'heaven' | 'earth' | 'hell';
  unlockedBy?: PrayerId;
  /** what the report to the Throne says after the chapter (1–2 sentences) */
  report: string;
}

export interface PrayerDef {
  id: PrayerId;
  title: string;
  /** one or two sentences shown before praying */
  intro: string;
  /** the prayer itself, read aloud in 1–2 minutes (≈120–260 words), paragraphs separated by "\n\n" */
  text: string;
  verse: Verse;
  unlocks: { realms?: RealmId[]; powers?: PowerId[]; skins?: SkinId[]; soundscapes?: SoundscapeId[]; ultimate?: boolean; codex?: boolean };
  /** what the player is told was unlocked, 1 sentence */
  unlockText: string;
}

export interface PowerDef {
  id: PowerId;
  name: string;
  /** 1 sentence linking the power to its biblical source */
  description: string;
  verse: Verse;
  maxLevel: number;
  /** short effect text per level, index 0 = level 1 */
  levels: string[];
}

export interface FruitDef {
  id: FruitId;
  name: string;
  /** what one level does, 1 sentence */
  effect: string;
  verse: Verse;
  maxLevel: number;
  costs: number[];
}

export interface RankDef {
  id: RankId;
  name: string;
  /** lifetime Light needed */
  light: number;
  wings: 2 | 4 | 6;
  verse: Verse;
  /** 1 sentence shown on promotion */
  blessing: string;
}

export interface SkinDef {
  id: SkinId;
  slot: SkinSlot;
  name: string;
  description: string;
  /** main colour and glow colour */
  colors: [string, string];
  unlock: { prayer?: PrayerId; light?: number; rank?: RankId } | 'default';
}

export interface SoundscapeDef {
  id: SoundscapeId;
  name: string;
  description: string;
  unlock: { prayer?: PrayerId; light?: number } | 'default';
}

export interface StoryText {
  /** title screen epigraph (Iz 6,3) */
  titleVerse: Verse;
  /** first-launch notice: not therapy, gentle content, where to get help */
  disclaimer: string;
  /** crisis lines (Poland + general advice) */
  crisisHelp: string;
  /** shown after the invocation: the angel is given charge over Adam (several short paragraphs) */
  intro: string[];
  /** shown when the angel falls in a room (Mi 7,8 spirit) — several variants */
  fall: string[];
  /** after Keter: the Trisagion finale */
  finale: string[];
  /** "Freely you received, freely give" (Mt 10,8) — the support / free-to-play note */
  support: string;
  /** short lines the angel hears from God between rooms, picked at random */
  whispers: Verse[];
  /** Sabbath rest room text */
  sabbath: string;
}

// ─── Audio ──────────────────────────────────────────────────────────

export type SfxName =
  | 'eat' | 'digest' | 'shoot' | 'hit' | 'weaken' | 'hurt' | 'seed' | 'grace' | 'levelup' | 'door'
  | 'fragment' | 'boss' | 'revelation' | 'prayer_word' | 'ultimate' | 'bell' | 'click' | 'fall' | 'rank';

export interface MusicMood {
  mode: ChantMode;
  /** 0 = calm (menus, Sabbath) … 1 = intense (boss) */
  intensity: number;
  realm: 'heaven' | 'earth' | 'hell';
}

/** Procedural chant + effects. All methods are safe to call before unlock() (they no-op). */
export interface AudioApi {
  /** create/resume the AudioContext — must be called from a user gesture */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  setSoundscape(id: SoundscapeId): void;
  setMood(mood: MusicMood): void;
  /** the hymn to the Holy Spirit for the invocation scene (starts the music if stopped) */
  playInvocation(): void;
  sfx(name: SfxName, opts?: { pan?: number; pitch?: number; volume?: number }): void;
  setVolumes(v: { master: number; music: number; sfx: number }): void;
  setMuted(muted: boolean): void;
  /** soft heartbeat-synced swell under the music (user's heart rate from the band); null = off */
  setHeartRate(bpm: number | null): void;
  suspend(): void;
  resume(): void;
}
