/**
 * The arcade games (DESIGN.md §9): what the app shows about each one without loading it (cards,
 * lobby text, colours), and how to load it — every game is its own chunk, fetched on first use.
 * The texts are in this page load's language (src/i18n/arcade.ts).
 */
import { t } from '../i18n/arcade';
import type { SceneId } from '../settings';
import type { Tool } from '../tools';
import { SCENES } from '../training/scene';
import type { TrainingResult } from '../training/score';
import type { FocusTuning } from './kit/focus';
import { dayKey } from './kit/progress';
import type { PassageId } from './kit/scripture';
import type { ArcadeModule } from './kit/types';

/** What kind of play a game is: the Games tab shows the games in these sections, in this order. */
export type ArcadeKind = 'puzzle' | 'arcade' | 'craft';
export const KINDS: readonly ArcadeKind[] = ['puzzle', 'arcade', 'craft'];

export interface ArcadeEntry {
  id: string;
  kind: ArcadeKind;
  /** in the page's language; a long German compound carries soft hyphens (U+00AD) where it may break */
  title: string;
  /** one line under the title */
  tagline: string;
  /** the card's text */
  text: string;
  /** how the band plays it: three short lines for the lobby */
  how: string[];
  /** tutorial lines shown during calibration */
  tips: string[];
  /** the headline unit ("ct"); a game whose unit bends with the count gives `unit(n)` in its module */
  unit: string;
  /** CSS class of the card art (a gradient in styles.css) */
  art: string;
  /** the session curve's fill, top of the chart to the bottom */
  fill: [string, string, string, string];
  tools: Tool[];
  /** the runner's standard focus chip (top left) */
  focusChip: boolean;
  /** the game's own adaptive-threshold settings, over the kit's defaults */
  tuning?: Partial<FocusTuning>;
  /** the passage the game takes root in (kit/scripture.ts): its lobby opens with it */
  root: PassageId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: () => Promise<ArcadeModule<any>>;
}

export const ARCADE: ArcadeEntry[] = [
  {
    id: 'geoda', kind: 'puzzle', title: t('geoda.title'), tagline: t('geoda.tagline'), text: t('geoda.text'),
    how: [t('geoda.how1'), t('geoda.how2'), t('geoda.how3')],
    tips: [t('geoda.tip1'), t('geoda.tip2'), t('geoda.tip3'), t('geoda.tip4'), t('geoda.tip5'), t('geoda.tip6')],
    unit: t('geoda.unit'), art: 'art-geoda', fill: ['#ffd6f5', '#c77dff', '#9b5de5', '#3c1f6e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'isa54.11-12',
    load: () => import('./geoda/index').then(m => m.default),
  },
  {
    id: 'latarnik', kind: 'arcade', title: t('latarnik.title'), tagline: t('latarnik.tagline'), text: t('latarnik.text'),
    how: [t('latarnik.how1'), t('latarnik.how2'), t('latarnik.how3')],
    tips: [t('latarnik.tip1'), t('latarnik.tip2'), t('latarnik.tip3'), t('latarnik.tip4'), t('latarnik.tip5')],
    unit: t('latarnik.unit'), art: 'art-latarnik', fill: ['#ffe9a8', '#ffd27a', '#ff7a59', '#0b1630'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'mat5.14-16',
    load: () => import('./latarnik/index').then(m => m.default),
  },
  {
    id: 'motylarnia', kind: 'craft', title: t('motylarnia.title'), tagline: t('motylarnia.tagline'), text: t('motylarnia.text'),
    how: [t('motylarnia.how1'), t('motylarnia.how2'), t('motylarnia.how3')],
    tips: [t('motylarnia.tip1'), t('motylarnia.tip2'), t('motylarnia.tip3'), t('motylarnia.tip4'), t('motylarnia.tip5')],
    unit: t('motylarnia.unit'), art: 'art-motylarnia', fill: ['#f2c230', '#e0453a', '#c2408f', '#3a5bd9'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.5, adapt: 0.08 }, root: '2co5.17',
    load: () => import('./motylarnia/index').then(m => m.default),
  },
  {
    id: 'arka', kind: 'puzzle', title: t('arka.title'), tagline: t('arka.tagline'), text: t('arka.text'),
    how: [t('arka.how1'), t('arka.how2'), t('arka.how3')],
    tips: [t('arka.tip1'), t('arka.tip2'), t('arka.tip3'), t('arka.tip4'), t('arka.tip5')],
    unit: t('arka.unit'), art: 'art-arka', fill: ['#efe4cf', '#c08a3e', '#6b4a2f', '#3b2a1e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'gen8.1',
    load: () => import('./arka/index').then(m => m.default),
  },
  {
    id: 'urodzaj', kind: 'arcade', title: t('urodzaj.title'), tagline: t('urodzaj.tagline'), text: t('urodzaj.text'),
    how: [t('urodzaj.how1'), t('urodzaj.how2'), t('urodzaj.how3')],
    tips: [t('urodzaj.tip1'), t('urodzaj.tip2'), t('urodzaj.tip3'), t('urodzaj.tip4'), t('urodzaj.tip5'), t('urodzaj.tip6')],
    unit: t('urodzaj.unit'), art: 'art-urodzaj', fill: ['#f2dea0', '#d4a640', '#b5523b', '#4b2e5a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.5, adapt: 0.08 }, root: 'deu8.10',
    load: () => import('./urodzaj/index').then(m => m.default),
  },
  {
    id: 'wzlot', kind: 'arcade', title: t('wzlot.title'), tagline: t('wzlot.tagline'), text: t('wzlot.text'),
    how: [t('wzlot.how1'), t('wzlot.how2'), t('wzlot.how3')],
    tips: [t('wzlot.tip1'), t('wzlot.tip2'), t('wzlot.tip3'), t('wzlot.tip4'), t('wzlot.tip5')],
    unit: t('wzlot.unit'), art: 'art-wzlot', fill: ['#f9d5a7', '#f2b26b', '#c97a4a', '#6c5b9a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'deu32.11',
    load: () => import('./wzlot/index').then(m => m.default),
  },
  {
    id: 'glina', kind: 'craft', title: t('glina.title'), tagline: t('glina.tagline'), text: t('glina.text'),
    how: [t('glina.how1'), t('glina.how2'), t('glina.how3')],
    tips: [t('glina.tip1'), t('glina.tip2'), t('glina.tip3'), t('glina.tip4'), t('glina.tip5'), t('glina.tip6')],
    unit: t('glina.unit'), art: 'art-glina', fill: ['#9ccbea', '#e9d8bc', '#c4673f', '#6e4632'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'jer18.6',
    load: () => import('./glina/index').then(m => m.default),
  },
  {
    id: 'zrodla', kind: 'puzzle', title: t('zrodla.title'), tagline: t('zrodla.tagline'), text: t('zrodla.text'),
    how: [t('zrodla.how1'), t('zrodla.how2'), t('zrodla.how3')],
    tips: [t('zrodla.tip1'), t('zrodla.tip2'), t('zrodla.tip3'), t('zrodla.tip4'), t('zrodla.tip5'), t('zrodla.tip6')],
    unit: t('zrodla.unit'), art: 'art-zrodla', fill: ['#cdf3ef', '#2fb3c4', '#1c6e96', '#4f7a43'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.55, adapt: 0.08 }, root: 'psa84.5-6',
    load: () => import('./zrodla/index').then(m => m.default),
  },
];

export const arcadeEntry = (id: string): ArcadeEntry | undefined => ARCADE.find(a => a.id === id);

/**
 * The game of the day (the Games tab's first card, Start's first game): every game in turn, one a
 * day, the same for everyone.
 */
export function gameOfDay(day = dayKey()): ArcadeEntry {
  const n = Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  return ARCADE[((n % ARCADE.length) + ARCADE.length) % ARCADE.length];
}

/** The session curve's colours for a saved result: the focus training's scene, or the arcade game's own. */
export function resultFill(r: Pick<TrainingResult, 'kind' | 'scene' | 'game'>): [string, string, string, string] {
  if (r.kind === 'game') return arcadeEntry(r.game?.id ?? r.scene)?.fill ?? SCENES.hills.fill;
  return SCENES[r.scene as SceneId]?.fill ?? SCENES.hills.fill;
}
