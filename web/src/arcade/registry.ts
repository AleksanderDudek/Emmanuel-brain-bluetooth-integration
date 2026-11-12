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
export type ArcadeKind = 'vision' | 'body' | 'puzzle' | 'run' | 'arcade' | 'strategy' | 'craft';
/** `vision`: the visualisation games (§13); `body`: the series "Weź moc, obudź się" about the body's own processes (§13). */
export const KINDS: readonly ArcadeKind[] = ['vision', 'body', 'puzzle', 'run', 'arcade', 'strategy', 'craft'];

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
  /**
   * What the band drives in this game, in plain words (the calibration card, the block banner, the
   * signal dock): what the signal above the threshold does in push blocks, what calm does in rest
   * blocks, and the names of the quantities the dock's gauge shows (it follows `level` and `calm`).
   */
  brain: { focus: string; rest: string; meter: string; meterRest: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: () => Promise<ArcadeModule<any>>;
}

type GameId = 'geoda' | 'latarnik' | 'motylarnia' | 'arka' | 'urodzaj' | 'wzlot' | 'glina' | 'zrodla' | 'poslaniec' | 'zacheusz' | 'pasterz' | 'aniol' | 'zastepy' | 'firmament' | 'dolina' | 'chleby' | 'jerzy' | 'dawid' | 'dziewiatka' | 'nehemiasz' | 'koty'
  | 'ogien' | 'rozswietl' | 'jestem' | 'odpornosc' | 'swiatlo' | 'synapsy' | 'odnowa';
const brain = (id: GameId): ArcadeEntry['brain'] => ({
  focus: t(`${id}.brainFocus`), rest: t(`${id}.brainRest`), meter: t(`${id}.meter`), meterRest: t(`${id}.meterRest`),
});

export const ARCADE: ArcadeEntry[] = [
  {
    id: 'geoda', kind: 'puzzle', title: t('geoda.title'), tagline: t('geoda.tagline'), text: t('geoda.text'),
    how: [t('geoda.how1'), t('geoda.how2'), t('geoda.how3')],
    tips: [t('geoda.tip1'), t('geoda.tip2'), t('geoda.tip3'), t('geoda.tip4'), t('geoda.tip5'), t('geoda.tip6')],
    unit: t('geoda.unit'), art: 'art-geoda', fill: ['#ffd6f5', '#c77dff', '#9b5de5', '#3c1f6e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'isa54.11-12',
    brain: brain('geoda'),
    load: () => import('./geoda/index').then(m => m.default),
  },
  {
    id: 'latarnik', kind: 'arcade', title: t('latarnik.title'), tagline: t('latarnik.tagline'), text: t('latarnik.text'),
    how: [t('latarnik.how1'), t('latarnik.how2'), t('latarnik.how3')],
    tips: [t('latarnik.tip1'), t('latarnik.tip2'), t('latarnik.tip3'), t('latarnik.tip4'), t('latarnik.tip5')],
    unit: t('latarnik.unit'), art: 'art-latarnik', fill: ['#ffe9a8', '#ffd27a', '#ff7a59', '#0b1630'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'mat5.14-16',
    brain: brain('latarnik'),
    load: () => import('./latarnik/index').then(m => m.default),
  },
  {
    id: 'motylarnia', kind: 'craft', title: t('motylarnia.title'), tagline: t('motylarnia.tagline'), text: t('motylarnia.text'),
    how: [t('motylarnia.how1'), t('motylarnia.how2'), t('motylarnia.how3')],
    tips: [t('motylarnia.tip1'), t('motylarnia.tip2'), t('motylarnia.tip3'), t('motylarnia.tip4'), t('motylarnia.tip5')],
    unit: t('motylarnia.unit'), art: 'art-motylarnia', fill: ['#f2c230', '#e0453a', '#c2408f', '#3a5bd9'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.5, adapt: 0.08 }, root: '2co5.17',
    brain: brain('motylarnia'),
    load: () => import('./motylarnia/index').then(m => m.default),
  },
  {
    id: 'arka', kind: 'puzzle', title: t('arka.title'), tagline: t('arka.tagline'), text: t('arka.text'),
    how: [t('arka.how1'), t('arka.how2'), t('arka.how3')],
    tips: [t('arka.tip1'), t('arka.tip2'), t('arka.tip3'), t('arka.tip4'), t('arka.tip5')],
    unit: t('arka.unit'), art: 'art-arka', fill: ['#efe4cf', '#c08a3e', '#6b4a2f', '#3b2a1e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'gen8.1',
    brain: brain('arka'),
    load: () => import('./arka/index').then(m => m.default),
  },
  {
    id: 'urodzaj', kind: 'arcade', title: t('urodzaj.title'), tagline: t('urodzaj.tagline'), text: t('urodzaj.text'),
    how: [t('urodzaj.how1'), t('urodzaj.how2'), t('urodzaj.how3')],
    tips: [t('urodzaj.tip1'), t('urodzaj.tip2'), t('urodzaj.tip3'), t('urodzaj.tip4'), t('urodzaj.tip5'), t('urodzaj.tip6')],
    unit: t('urodzaj.unit'), art: 'art-urodzaj', fill: ['#f2dea0', '#d4a640', '#b5523b', '#4b2e5a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.5, adapt: 0.08 }, root: 'deu8.10',
    brain: brain('urodzaj'),
    load: () => import('./urodzaj/index').then(m => m.default),
  },
  {
    id: 'wzlot', kind: 'arcade', title: t('wzlot.title'), tagline: t('wzlot.tagline'), text: t('wzlot.text'),
    how: [t('wzlot.how1'), t('wzlot.how2'), t('wzlot.how3')],
    tips: [t('wzlot.tip1'), t('wzlot.tip2'), t('wzlot.tip3'), t('wzlot.tip4'), t('wzlot.tip5')],
    unit: t('wzlot.unit'), art: 'art-wzlot', fill: ['#f9d5a7', '#f2b26b', '#c97a4a', '#6c5b9a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'deu32.11',
    brain: brain('wzlot'),
    load: () => import('./wzlot/index').then(m => m.default),
  },
  {
    id: 'glina', kind: 'craft', title: t('glina.title'), tagline: t('glina.tagline'), text: t('glina.text'),
    how: [t('glina.how1'), t('glina.how2'), t('glina.how3')],
    tips: [t('glina.tip1'), t('glina.tip2'), t('glina.tip3'), t('glina.tip4'), t('glina.tip5'), t('glina.tip6')],
    unit: t('glina.unit'), art: 'art-glina', fill: ['#9ccbea', '#e9d8bc', '#c4673f', '#6e4632'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'jer18.6',
    brain: brain('glina'),
    load: () => import('./glina/index').then(m => m.default),
  },
  {
    id: 'zrodla', kind: 'puzzle', title: t('zrodla.title'), tagline: t('zrodla.tagline'), text: t('zrodla.text'),
    how: [t('zrodla.how1'), t('zrodla.how2'), t('zrodla.how3')],
    tips: [t('zrodla.tip1'), t('zrodla.tip2'), t('zrodla.tip3'), t('zrodla.tip4'), t('zrodla.tip5'), t('zrodla.tip6')],
    unit: t('zrodla.unit'), art: 'art-zrodla', fill: ['#cdf3ef', '#2fb3c4', '#1c6e96', '#4f7a43'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.55, adapt: 0.08 }, root: 'psa84.5-6',
    brain: brain('zrodla'),
    load: () => import('./zrodla/index').then(m => m.default),
  },
  {
    id: 'poslaniec', kind: 'run', title: t('poslaniec.title'), tagline: t('poslaniec.tagline'), text: t('poslaniec.text'),
    how: [t('poslaniec.how1'), t('poslaniec.how2'), t('poslaniec.how3')],
    tips: [t('poslaniec.tip1'), t('poslaniec.tip2'), t('poslaniec.tip3'), t('poslaniec.tip4'), t('poslaniec.tip5')],
    unit: t('poslaniec.unit'), art: 'art-poslaniec', fill: ['#ffe2b8', '#f4a259', '#c8553d', '#2e3a59'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'isa52.7',
    brain: brain('poslaniec'),
    load: () => import('./poslaniec/index').then(m => m.default),
  },
  {
    id: 'zacheusz', kind: 'run', title: t('zacheusz.title'), tagline: t('zacheusz.tagline'), text: t('zacheusz.text'),
    how: [t('zacheusz.how1'), t('zacheusz.how2'), t('zacheusz.how3')],
    tips: [t('zacheusz.tip1'), t('zacheusz.tip2'), t('zacheusz.tip3'), t('zacheusz.tip4'), t('zacheusz.tip5')],
    unit: t('zacheusz.unit'), art: 'art-zacheusz', fill: ['#fde7a9', '#e9a23b', '#7a9e3d', '#5b3a6e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'luk19.3-4',
    brain: brain('zacheusz'),
    load: () => import('./zacheusz/index').then(m => m.default),
  },
  {
    id: 'pasterz', kind: 'arcade', title: t('pasterz.title'), tagline: t('pasterz.tagline'), text: t('pasterz.text'),
    how: [t('pasterz.how1'), t('pasterz.how2'), t('pasterz.how3')],
    tips: [t('pasterz.tip1'), t('pasterz.tip2'), t('pasterz.tip3'), t('pasterz.tip4'), t('pasterz.tip5')],
    unit: t('pasterz.unit'), art: 'art-pasterz', fill: ['#eef3d2', '#a8c66c', '#5f8a4a', '#2f3e5c'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.55, adapt: 0.08 }, root: 'luk15.4-6',
    brain: brain('pasterz'),
    load: () => import('./pasterz/index').then(m => m.default),
  },
  {
    id: 'aniol', kind: 'arcade', title: t('aniol.title'), tagline: t('aniol.tagline'), text: t('aniol.text'),
    how: [t('aniol.how1'), t('aniol.how2'), t('aniol.how3')],
    tips: [t('aniol.tip1'), t('aniol.tip2'), t('aniol.tip3'), t('aniol.tip4'), t('aniol.tip5')],
    unit: t('aniol.unit'), art: 'art-aniol', fill: ['#fff3c4', '#f5c96a', '#6f6bb8', '#1c1d3f'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'psa91.11',
    brain: brain('aniol'),
    load: () => import('./aniol/index').then(m => m.default),
  },
  {
    id: 'zastepy', kind: 'strategy', title: t('zastepy.title'), tagline: t('zastepy.tagline'), text: t('zastepy.text'),
    how: [t('zastepy.how1'), t('zastepy.how2'), t('zastepy.how3')],
    tips: [t('zastepy.tip1'), t('zastepy.tip2'), t('zastepy.tip3'), t('zastepy.tip4'), t('zastepy.tip5')],
    unit: t('zastepy.unit'), art: 'art-zastepy', fill: ['#fff1c9', '#e8b04a', '#8a4a3a', '#2a1f2e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'rev12.7-8',
    brain: brain('zastepy'),
    load: () => import('./zastepy/index').then(m => m.default),
  },
  {
    id: 'firmament', kind: 'puzzle', title: t('firmament.title'), tagline: t('firmament.tagline'), text: t('firmament.text'),
    how: [t('firmament.how1'), t('firmament.how2'), t('firmament.how3')],
    tips: [t('firmament.tip1'), t('firmament.tip2'), t('firmament.tip3'), t('firmament.tip4'), t('firmament.tip5')],
    unit: t('firmament.unit'), art: 'art-firmament', fill: ['#e9e4ff', '#9d8cff', '#3b3f9e', '#0b0f2e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'psa147.4',
    brain: brain('firmament'),
    load: () => import('./firmament/index').then(m => m.default),
  },
  {
    id: 'dolina', kind: 'run', title: t('dolina.title'), tagline: t('dolina.tagline'), text: t('dolina.text'),
    how: [t('dolina.how1'), t('dolina.how2'), t('dolina.how3')],
    tips: [t('dolina.tip1'), t('dolina.tip2'), t('dolina.tip3'), t('dolina.tip4'), t('dolina.tip5')],
    unit: t('dolina.unit'), art: 'art-dolina', fill: ['#ffe6a8', '#e09a3e', '#4a3f63', '#16131f'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'psa23.4',
    brain: brain('dolina'),
    load: () => import('./dolina/index').then(m => m.default),
  },
  {
    id: 'chleby', kind: 'arcade', title: t('chleby.title'), tagline: t('chleby.tagline'), text: t('chleby.text'),
    how: [t('chleby.how1'), t('chleby.how2'), t('chleby.how3')],
    tips: [t('chleby.tip1'), t('chleby.tip2'), t('chleby.tip3'), t('chleby.tip4'), t('chleby.tip5')],
    unit: t('chleby.unit'), art: 'art-chleby', fill: ['#fff3d6', '#e6b25c', '#6f9a52', '#2f5d78'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'jhn6.9',
    brain: brain('chleby'),
    load: () => import('./chleby/index').then(m => m.default),
  },
  {
    id: 'jerzy', kind: 'arcade', title: t('jerzy.title'), tagline: t('jerzy.tagline'), text: t('jerzy.text'),
    how: [t('jerzy.how1'), t('jerzy.how2'), t('jerzy.how3')],
    tips: [t('jerzy.tip1'), t('jerzy.tip2'), t('jerzy.tip3'), t('jerzy.tip4'), t('jerzy.tip5')],
    unit: t('jerzy.unit'), art: 'art-jerzy', fill: ['#fde7b0', '#d9a441', '#5b8a4a', '#2b2a3a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'eph6.16',
    brain: brain('jerzy'),
    load: () => import('./jerzy/index').then(m => m.default),
  },
  {
    id: 'dawid', kind: 'arcade', title: t('dawid.title'), tagline: t('dawid.tagline'), text: t('dawid.text'),
    how: [t('dawid.how1'), t('dawid.how2'), t('dawid.how3')],
    tips: [t('dawid.tip1'), t('dawid.tip2'), t('dawid.tip3'), t('dawid.tip4'), t('dawid.tip5')],
    unit: t('dawid.unit'), art: 'art-dawid', fill: ['#ffe8b0', '#e8b85a', '#a8743a', '#3a2a1c'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: '1sa17.37',
    brain: brain('dawid'),
    load: () => import('./dawid/index').then(m => m.default),
  },
  {
    id: 'dziewiatka', kind: 'strategy', title: t('dziewiatka.title'), tagline: t('dziewiatka.tagline'), text: t('dziewiatka.text'),
    how: [t('dziewiatka.how1'), t('dziewiatka.how2'), t('dziewiatka.how3')],
    tips: [t('dziewiatka.tip1'), t('dziewiatka.tip2'), t('dziewiatka.tip3'), t('dziewiatka.tip4'), t('dziewiatka.tip5')],
    unit: t('dziewiatka.unit'), art: 'art-dziewiatka', fill: ['#fff0c8', '#9ad0c2', '#5a7fb8', '#232846'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'gal5.22-23',
    brain: brain('dziewiatka'),
    load: () => import('./dziewiatka/index').then(m => m.default),
  },
  {
    id: 'nehemiasz', kind: 'strategy', title: t('nehemiasz.title'), tagline: t('nehemiasz.tagline'), text: t('nehemiasz.text'),
    how: [t('nehemiasz.how1'), t('nehemiasz.how2'), t('nehemiasz.how3')],
    tips: [t('nehemiasz.tip1'), t('nehemiasz.tip2'), t('nehemiasz.tip3'), t('nehemiasz.tip4'), t('nehemiasz.tip5')],
    unit: t('nehemiasz.unit'), art: 'art-nehemiasz', fill: ['#ffe0a0', '#e0a25a', '#8a5a3a', '#241a1a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'neh2.18',
    brain: brain('nehemiasz'),
    load: () => import('./nehemiasz/index').then(m => m.default),
  },
  {
    id: 'koty', kind: 'strategy', title: t('koty.title'), tagline: t('koty.tagline'), text: t('koty.text'),
    how: [t('koty.how1'), t('koty.how2'), t('koty.how3')],
    tips: [t('koty.tip1'), t('koty.tip2'), t('koty.tip3'), t('koty.tip4'), t('koty.tip5')],
    unit: t('koty.unit'), art: 'art-koty', fill: ['#f7e6c4', '#b9d18a', '#7a9a4a', '#2e3a1e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'sng2.15',
    brain: brain('koty'),
    load: () => import('./koty/index').then(m => m.default),
  },
  // ── version 4 (DESIGN.md §13): three visualisation games and the series "Weź moc, obudź się"
  {
    id: 'ogien', kind: 'vision', title: t('ogien.title'), tagline: t('ogien.tagline'), text: t('ogien.text'),
    how: [t('ogien.how1'), t('ogien.how2'), t('ogien.how3')],
    tips: [t('ogien.tip1'), t('ogien.tip2'), t('ogien.tip3'), t('ogien.tip4'), t('ogien.tip5')],
    unit: t('ogien.unit'), art: 'art-ogien', fill: ['#fff1c2', '#ffb347', '#e8562a', '#2a0f1e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: '2ti1.6',
    brain: brain('ogien'),
    load: () => import('./ogien/index').then(m => m.default),
  },
  {
    id: 'rozswietl', kind: 'vision', title: t('rozswietl.title'), tagline: t('rozswietl.tagline'), text: t('rozswietl.text'),
    how: [t('rozswietl.how1'), t('rozswietl.how2'), t('rozswietl.how3')],
    tips: [t('rozswietl.tip1'), t('rozswietl.tip2'), t('rozswietl.tip3'), t('rozswietl.tip4'), t('rozswietl.tip5')],
    unit: t('rozswietl.unit'), art: 'art-rozswietl', fill: ['#fff6d8', '#f6c35c', '#6c7aa8', '#1f2233'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'isa60.1',
    brain: brain('rozswietl'),
    load: () => import('./rozswietl/index').then(m => m.default),
  },
  {
    id: 'jestem', kind: 'vision', title: t('jestem.title'), tagline: t('jestem.tagline'), text: t('jestem.text'),
    how: [t('jestem.how1'), t('jestem.how2'), t('jestem.how3')],
    tips: [t('jestem.tip1'), t('jestem.tip2'), t('jestem.tip3'), t('jestem.tip4'), t('jestem.tip5')],
    unit: t('jestem.unit'), art: 'art-jestem', fill: ['#fff8e6', '#f3d27a', '#b98bd6', '#2b1f45'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'php2.9-10',
    brain: brain('jestem'),
    load: () => import('./jestem/index').then(m => m.default),
  },
  {
    id: 'odpornosc', kind: 'body', title: t('odpornosc.title'), tagline: t('odpornosc.tagline'), text: t('odpornosc.text'),
    how: [t('odpornosc.how1'), t('odpornosc.how2'), t('odpornosc.how3')],
    tips: [t('odpornosc.tip1'), t('odpornosc.tip2'), t('odpornosc.tip3'), t('odpornosc.tip4'), t('odpornosc.tip5')],
    unit: t('odpornosc.unit'), art: 'art-odpornosc', fill: ['#f5f7ff', '#ffb3c1', '#c2416b', '#2c1430'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'psa103.2-3',
    brain: brain('odpornosc'),
    load: () => import('./odpornosc/index').then(m => m.default),
  },
  {
    id: 'swiatlo', kind: 'body', title: t('swiatlo.title'), tagline: t('swiatlo.tagline'), text: t('swiatlo.text'),
    how: [t('swiatlo.how1'), t('swiatlo.how2'), t('swiatlo.how3')],
    tips: [t('swiatlo.tip1'), t('swiatlo.tip2'), t('swiatlo.tip3'), t('swiatlo.tip4'), t('swiatlo.tip5')],
    unit: t('swiatlo.unit'), art: 'art-swiatlo', fill: ['#e9fbff', '#8fd6e8', '#3f7fb8', '#14203a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'mat6.22',
    brain: brain('swiatlo'),
    load: () => import('./swiatlo/index').then(m => m.default),
  },
  {
    id: 'synapsy', kind: 'body', title: t('synapsy.title'), tagline: t('synapsy.tagline'), text: t('synapsy.text'),
    how: [t('synapsy.how1'), t('synapsy.how2'), t('synapsy.how3')],
    tips: [t('synapsy.tip1'), t('synapsy.tip2'), t('synapsy.tip3'), t('synapsy.tip4'), t('synapsy.tip5')],
    unit: t('synapsy.unit'), art: 'art-synapsy', fill: ['#f3e9ff', '#b48cff', '#5a46c8', '#120f30'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: 'rom12.2',
    brain: brain('synapsy'),
    load: () => import('./synapsy/index').then(m => m.default),
  },
  {
    id: 'odnowa', kind: 'body', title: t('odnowa.title'), tagline: t('odnowa.tagline'), text: t('odnowa.text'),
    how: [t('odnowa.how1'), t('odnowa.how2'), t('odnowa.how3')],
    tips: [t('odnowa.tip1'), t('odnowa.tip2'), t('odnowa.tip3'), t('odnowa.tip4'), t('odnowa.tip5')],
    unit: t('odnowa.unit'), art: 'art-odnowa', fill: ['#effff0', '#8fe3a3', '#2e9a76', '#0f2a2a'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 }, root: '2co4.16',
    brain: brain('odnowa'),
    load: () => import('./odnowa/index').then(m => m.default),
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
