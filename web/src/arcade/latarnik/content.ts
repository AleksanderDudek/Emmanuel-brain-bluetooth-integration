/**
 * Latarnik's data: the fishing village built from delivered crates, the amber album ("Bursztyny"),
 * the letters in bottles ("Listy z butelki") and the short lines the game shows during play.
 * Everything a designer may want to tune without touching the rules (sim.ts); the words themselves
 * live in the catalog (i18n.ts), in the language of this page load.
 */
import { t } from './i18n';

/** A step of the village; `name` reads inside a sentence ("Port rośnie: chata rybacka"), cap() makes a label of it. */
export interface VillageStep { id: string; name: string; short: string; cost: number }

type VillageId = 'pomost' | 'sieci' | 'wedzarnia' | 'chata' | 'chata2' | 'kapliczka' | 'lodzie' | 'muzeum';
const step = (id: VillageId): VillageStep => ({ id, name: t(`village.${id}`), short: t(`village.${id}.short`), cost: 150 });

/** The harbour around the lighthouse, built in this order; one step is about one session of play. */
export const VILLAGE: readonly VillageStep[] = (['pomost', 'sieci', 'wedzarnia', 'chata', 'chata2', 'kapliczka', 'lodzie', 'muzeum'] as const).map(step);

/** The first step starts half-built, "za kalibrację" (an endowed start). */
export const START_CRATES = 75;
/** The village step whose smoke turns days away into a welcome-back bonus. */
export const SMOKEHOUSE = 2;

export type Tier = 'common' | 'rare' | 'epic' | 'legend';
export const TIERS: readonly Tier[] = ['common', 'rare', 'epic', 'legend'];
export const TIER_NAME: Record<Tier, string> = { common: t('tier.common'), rare: t('tier.rare'), epic: t('tier.epic'), legend: t('tier.legend') };
/** The album tile's class in styles.css (.arcade-album > div.rare …). */
export const TIER_CLASS: Record<Tier, string> = { common: '', rare: 'rare', epic: 'epic', legend: 'legend' };
/** The honest feat that earns a draw of each tier (published in the lobby). */
export const TIER_FEAT: Record<Tier, string> = { common: t('feat.common'), rare: t('feat.rare'), epic: t('feat.epic'), legend: t('feat.legend') };

export type Inclusion = 'komar' | 'mrowka' | 'lisc' | 'nasiono' | 'pioro' | 'zuk' | 'pajak' | 'kwiat' | 'jaszczurka';

const INCLUSIONS: readonly { id: Inclusion; tier: Tier }[] = [
  { id: 'komar', tier: 'common' },
  { id: 'mrowka', tier: 'common' },
  { id: 'lisc', tier: 'common' },
  { id: 'nasiono', tier: 'common' },
  { id: 'pioro', tier: 'rare' },
  { id: 'zuk', tier: 'rare' },
  { id: 'pajak', tier: 'epic' },
  { id: 'kwiat', tier: 'epic' },
  { id: 'jaszczurka', tier: 'legend' },
];

/** Two sets of nine: the clear honey amber of the bay and the darker, cherry amber of the spit. */
export const SETS: readonly { name: string; tone: 'honey' | 'cherry' }[] = [
  { name: t('set.zatoka'), tone: 'honey' },
  { name: t('set.mierzeja'), tone: 'cherry' },
];

/** A piece of the album; `name` (its inclusion) reads inside a sentence, like a village step's. */
export interface AmberPiece { index: number; set: number; inclusion: Inclusion; name: string; tier: Tier }

export const AMBER: readonly AmberPiece[] = SETS.flatMap((_, set) =>
  INCLUSIONS.map((inc, i) => ({ index: set * INCLUSIONS.length + i, set, inclusion: inc.id, name: t(`amber.${inc.id}`), tier: inc.tier })));

/** A duplicate becomes crumbs; enough crumbs become the album's next missing piece. */
export const DUPLICATE_OKRUCHY = 5;
export const CRAFT_OKRUCHY = 25;

/**
 * Hania, the old keeper's daughter, writes to the new keeper from the village by the lighthouse.
 * One bottle a session; each letter about 380 characters in Polish, signed with her name at its end.
 */
export const LETTERS: readonly string[] = [
  t('letter.1'), t('letter.2'), t('letter.3'), t('letter.4'), t('letter.5'), t('letter.6'),
  t('letter.7'), t('letter.8'), t('letter.9'), t('letter.10'), t('letter.11'), t('letter.12'),
];

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2'), t('tip.warmup.3')],
  konwoj: [t('tip.konwoj.1'), t('tip.konwoj.2'), t('tip.konwoj.3'), t('tip.konwoj.4'), t('tip.konwoj.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  cisza: [t('tip.cisza.1'), t('tip.cisza.2'), t('tip.cisza.3')],
  /** the first-ever Konwój and Cisza explain themselves */
  firstKonwoj: t('tip.firstKonwoj'),
  firstCisza: t('tip.firstCisza'),
} as const;
