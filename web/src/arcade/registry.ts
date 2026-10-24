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
import type { PassageId } from './kit/scripture';
import type { ArcadeModule } from './kit/types';

export interface ArcadeEntry {
  id: string;
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
    id: 'geoda', title: t('geoda.title'), tagline: t('geoda.tagline'), text: t('geoda.text'),
    how: [t('geoda.how1'), t('geoda.how2'), t('geoda.how3')],
    tips: [t('geoda.tip1'), t('geoda.tip2'), t('geoda.tip3'), t('geoda.tip4'), t('geoda.tip5'), t('geoda.tip6')],
    unit: t('geoda.unit'), art: 'art-geoda', fill: ['#ffd6f5', '#c77dff', '#9b5de5', '#3c1f6e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'isa54.11-12',
    load: () => import('./geoda/index').then(m => m.default),
  },
  {
    id: 'latarnik', title: t('latarnik.title'), tagline: t('latarnik.tagline'), text: t('latarnik.text'),
    how: [t('latarnik.how1'), t('latarnik.how2'), t('latarnik.how3')],
    tips: [t('latarnik.tip1'), t('latarnik.tip2'), t('latarnik.tip3'), t('latarnik.tip4'), t('latarnik.tip5')],
    unit: t('latarnik.unit'), art: 'art-latarnik', fill: ['#ffe9a8', '#ffd27a', '#ff7a59', '#0b1630'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'mat5.14-16',
    load: () => import('./latarnik/index').then(m => m.default),
  },
  {
    id: 'motylarnia', title: t('motylarnia.title'), tagline: t('motylarnia.tagline'), text: t('motylarnia.text'),
    how: [t('motylarnia.how1'), t('motylarnia.how2'), t('motylarnia.how3')],
    tips: [t('motylarnia.tip1'), t('motylarnia.tip2'), t('motylarnia.tip3'), t('motylarnia.tip4'), t('motylarnia.tip5')],
    unit: t('motylarnia.unit'), art: 'art-motylarnia', fill: ['#f2c230', '#e0453a', '#c2408f', '#3a5bd9'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.5, adapt: 0.08 }, root: '2co5.17',
    load: () => import('./motylarnia/index').then(m => m.default),
  },
];

export const arcadeEntry = (id: string): ArcadeEntry | undefined => ARCADE.find(a => a.id === id);

/** The session curve's colours for a saved result: the focus training's scene, or the arcade game's own. */
export function resultFill(r: Pick<TrainingResult, 'kind' | 'scene' | 'game'>): [string, string, string, string] {
  if (r.kind === 'game') return arcadeEntry(r.game?.id ?? r.scene)?.fill ?? SCENES.hills.fill;
  return SCENES[r.scene as SceneId]?.fill ?? SCENES.hills.fill;
}
