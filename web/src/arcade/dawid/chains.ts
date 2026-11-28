/**
 * Dawid's quest chains (round 25, DESIGN §29): each land's chain, area by area, from the people of the story.  The
 * system's quests teach the camp as before (hunt, build, buy, forge, bring brushwood, reach a level, the guardian,
 * the gate); the story's quests carry David's road (1 Samuel 16–30) — find a thing, rescue someone from the beasts,
 * escort someone, deliver something, defend a place, talk to someone, bring a word, meet a companion — and a pass
 * opens the next area.  A story quest has an `id`: its pill's words, the scene played when it is done (and the
 * choice that ends some scenes) are the story writer's (story-<land>.ts, keyed by that id).  Every land also has
 * the scenes `open` (when it begins, after the chapter card) and `end` (after its guardian).
 *
 * The choices never close a road: both answers go on; they change a line and a small reward.
 */
import type { BeastKind, BuildingId, CompanionId, LandId, NodeKind, WeaponId } from './content';
import type { PassageId } from '../kit/scripture';

export type QuestKind =
  | 'hunt' | 'build' | 'buy' | 'forge' | 'gather' | 'visit' | 'level' | 'guard' | 'gate'
  | 'pass' | 'find' | 'rescue' | 'escort' | 'deliver' | 'defend' | 'talk' | 'word';

/** What a choice gives: silver, rested XP, the great stone's charge, a heal, Saul's armour (the clank), or only a line. */
export type ChoiceEffect = 'silver' | 'rested' | 'charge' | 'armour' | 'line';

export interface QuestSpec {
  kind: QuestKind;
  /** hunt: a beast kind or 'any'; build: a building; buy: an ability; forge: a weapon; gather: wood/stone; visit: the companion's spot */
  what?: string;
  n?: number;
  /** a visit makes a companion join, or gives a weapon */
  joins?: CompanionId;
  gives?: WeaponId;
  /** the round-5 line key of a visit (npc.<say>), kept for the later circles' words */
  say?: string;
  /** a story quest: its id (the words, the scene) */
  id?: string;
  /** the area the quest is in (0, 1, 2) */
  area?: number;
  /** the place: talk / visit / rescue / defend / find (one); deliver, escort, word: where it starts ('camp': the area's fire) */
  at?: string;
  /** deliver, escort, word: where it goes */
  to?: string;
  /** find: several places, one thing at each */
  spots?: readonly string[];
  /** rescue, defend: the beasts that come */
  beast?: BeastKind;
  /** the scene played when it is done (default: the id; null: none) */
  scene?: string | null;
  /** the choice that ends the scene, and what each answer gives */
  choice?: { a: ChoiceEffect; b: ChoiceEffect };
  /** a passage shown on the scene's card */
  verse?: PassageId;
  /** done, it polishes the great stone this far (the five smooth stones) */
  charge?: number;
}

const H = (what: BeastKind, n: number, area: number): QuestSpec => ({ kind: 'hunt', what, n, area });
const pass = (area: number): QuestSpec => ({ kind: 'pass', area });

export const CHAINS: Readonly<Record<LandId, readonly QuestSpec[]>> = {
  pastwiska: [
    H('szakal', 4, 0),
    { kind: 'build', what: 'ognisko' satisfies BuildingId, n: 1, area: 0 },
    { kind: 'buy', what: 'sila', n: 1, area: 0 },
    { kind: 'find', id: 'lamb', area: 0, at: 'thorns' },
    H('szerszen', 6, 0),
    pass(0),
    { kind: 'talk', id: 'well', area: 1, at: 'well', choice: { a: 'silver', b: 'rested' } },
    { kind: 'gather', what: 'wood' satisfies NodeKind, n: 5, area: 1 },
    { kind: 'build', what: 'kuznia', n: 1, area: 1 },
    { kind: 'forge', what: 'kij', area: 1 },
    { kind: 'deliver', id: 'jar', area: 1, at: 'well', to: 'starzec' },
    { kind: 'visit', id: 'asahel', what: 'asahel', joins: 'asahel', say: 'asahel', area: 1, at: 'asahel' },
    pass(1),
    H('wilk', 6, 2),
    { kind: 'rescue', id: 'ewe', area: 2, at: 'ewe', beast: 'wilk', n: 4 },
    { kind: 'level', n: 8, area: 2 },
    { kind: 'guard', area: 2 },
    { kind: 'gate', area: 2 },
  ],
  wzgorza: [
    H('dzik', 4, 0),
    { kind: 'talk', id: 'sluga', area: 0, at: 'sluga' },
    { kind: 'build', what: 'spichlerz', n: 1, area: 0 },
    { kind: 'defend', id: 'vines', area: 0, at: 'vines', beast: 'dzik', n: 6 },
    pass(0),
    H('zmija', 6, 1),
    { kind: 'visit', id: 'abiszaj', what: 'abiszaj', joins: 'abiszaj', say: 'abiszaj', area: 1, at: 'abiszaj' },
    { kind: 'escort', id: 'donkey', area: 1, at: 'donkey', to: 'milestone' },
    { kind: 'buy', what: 'torba', n: 2, area: 1 },
    pass(1),
    H('hiena', 8, 2),
    { kind: 'talk', id: 'harp', area: 2, at: 'harp', choice: { a: 'rested', b: 'charge' }, verse: '1sa16.23' },
    { kind: 'level', n: 16, area: 2 },
    { kind: 'guard', area: 2 },
    { kind: 'gate', area: 2 },
  ],
  ela: [
    { kind: 'deliver', id: 'bread', area: 0, at: 'camp', to: 'eliab' },
    H('skorpion', 6, 0),
    { kind: 'talk', id: 'soldiers', area: 0, at: 'soldiers', choice: { a: 'line', b: 'line' } },
    { kind: 'talk', id: 'saul', area: 0, at: 'saul', choice: { a: 'armour', b: 'line' } },
    pass(0),
    { kind: 'find', id: 'stones', area: 1, spots: ['s1', 's2', 's3', 's4', 's5'], verse: '1sa17.40', charge: 0.6 },
    H('sep', 4, 1),
    { kind: 'level', n: 24, area: 1 },
    pass(1),
    { kind: 'talk', id: 'goliath', area: 2, at: 'goliath' },
    { kind: 'guard', area: 2 },
    { kind: 'visit', id: 'jonatan', what: 'jonatan', joins: 'jonatan', gives: 'luk', say: 'jonatan', area: 2, at: 'jonatan' },
    { kind: 'gate', area: 2 },
  ],
  gibea: [
    H('tur', 4, 0),
    { kind: 'talk', id: 'women', area: 0, at: 'women' },
    { kind: 'forge', what: 'oszczep', area: 0 },
    H('szerszen', 10, 0),
    pass(0),
    { kind: 'build', what: 'owczarnia', n: 1, area: 1 },
    { kind: 'find', id: 'rope', area: 1, at: 'rope' },
    { kind: 'talk', id: 'mikal', area: 1, at: 'mikal', choice: { a: 'line', b: 'line' } },
    { kind: 'defend', id: 'barley', area: 1, at: 'barley', beast: 'dzik', n: 6 },
    { kind: 'level', n: 32, area: 1 },
    pass(1),
    { kind: 'talk', id: 'ezel', area: 2, at: 'ezel' },
    { kind: 'find', id: 'arrows', area: 2, spots: ['a1', 'a2', 'a3'] },
    { kind: 'guard', area: 2 },
    { kind: 'talk', id: 'farewell', area: 2, at: 'ezel', verse: 'col3.14' },
    { kind: 'gate', area: 2 },
  ],
  engedi: [
    H('karakal', 6, 0),
    { kind: 'talk', id: 'achimelek', area: 0, at: 'achimelek' },
    { kind: 'visit', id: 'benajasz', what: 'benajasz', joins: 'benajasz', say: 'benajasz', area: 0, at: 'benajasz' },
    pass(0),
    H('skorpion', 8, 1),
    { kind: 'talk', id: 'cave', area: 1, at: 'cave', choice: { a: 'line', b: 'rested' } },
    { kind: 'word', id: 'call', area: 1, at: 'cave', to: 'hill', verse: 'rom12.21' },
    { kind: 'find', id: 'water', area: 1, spots: ['w1', 'w2', 'w3'] },
    pass(1),
    { kind: 'visit', id: 'abigail', what: 'abigail', joins: 'abigail', say: 'abigail', area: 2, at: 'abigail' },
    { kind: 'rescue', id: 'kid', area: 2, at: 'kid', beast: 'karakal', n: 4 },
    { kind: 'level', n: 40, area: 2 },
    { kind: 'guard', area: 2 },
    { kind: 'gate', area: 2 },
  ],
  gat: [
    { kind: 'talk', id: 'itaj', area: 0, at: 'itaj' },
    { kind: 'talk', id: 'achisz', area: 0, at: 'achisz', choice: { a: 'line', b: 'line' } },
    H('hiena', 10, 0),
    pass(0),
    { kind: 'talk', id: 'ziklag', area: 1, at: 'ziklag' },
    H('wilk', 10, 1),
    { kind: 'rescue', id: 'flock', area: 1, at: 'flock', beast: 'wilk', n: 5 },
    { kind: 'escort', id: 'families', area: 1, at: 'flock', to: 'home' },
    { kind: 'visit', id: 'szamma', what: 'szamma', joins: 'szamma', say: 'szamma', area: 1, at: 'szamma' },
    pass(1),
    { kind: 'level', n: 48, area: 2 },
    { kind: 'guard', area: 2 },
    { kind: 'gate', area: 2 },
  ],
};

/** The chapter card's passage for each land. */
export const CHAPTER_VERSE: Readonly<Record<LandId, PassageId>> = {
  pastwiska: '1sa17.37', wzgorza: 'psa121.1-2', ela: 'psa27.1', gibea: 'ecc4.9-10', engedi: 'psa18.2', gat: 'psa56.3',
};

/** The passages the land-opening and land-ending scenes carry (a quest's own scene takes its `verse`). */
const SCENE_VERSE: Readonly<Partial<Record<LandId, Readonly<Record<string, PassageId>>>>> = {
  pastwiska: { open: '1sa16.13' },
  ela: { goliath: '1sa17.45', jonatan: '1sa18.1' },
  engedi: { abigail: '1sa25.32-33' },
  gat: { ziklag: '1sa30.6', families: '1sa30.24', end: 'psa23.6' },
};

/** A scene's passage (none: the scene ends with its last line). */
export const sceneVerse = (land: LandId, scene: string): PassageId | undefined => SCENE_VERSE[land]?.[scene];

/** The story's ids a land's words must give (for the tests and the writer). */
export function storyIds(land: LandId): { quests: string[]; scenes: string[]; choices: string[] } {
  const qs = CHAINS[land].filter(q => q.id);
  return {
    quests: qs.map(q => q.id!),
    scenes: ['open', ...qs.filter(q => q.scene !== null).map(q => q.scene ?? q.id!), 'end'],
    choices: qs.filter(q => q.choice).map(q => q.id!),
  };
}
