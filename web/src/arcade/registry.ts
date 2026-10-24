/**
 * The arcade games (DESIGN.md §9): what the app shows about each one without loading it (cards,
 * lobby text, colours), and how to load it — every game is its own chunk, fetched on first use.
 */
import type { SceneId } from '../settings';
import type { Tool } from '../tools';
import { SCENES } from '../training/scene';
import type { TrainingResult } from '../training/score';
import type { FocusTuning } from './kit/focus';
import type { ArcadeModule } from './kit/types';

export interface ArcadeEntry {
  id: string;
  title: string;
  /** one line under the title */
  tagline: string;
  /** the card's text */
  text: string;
  /** how the band plays it: three short lines for the lobby */
  how: string[];
  /** tutorial lines shown during calibration */
  tips: string[];
  /** the headline unit ("pięter") */
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: () => Promise<ArcadeModule<any>>;
}

export const ARCADE: ArcadeEntry[] = [
  {
    id: 'geoda', title: 'Geoda', tagline: 'Wyhoduj kryształy i domknij nimi skałę.',
    text: 'Klocki jak w Block Blast, ale rosną z Twojego skupienia: im równiej je trzymasz, tym czystszy kryształ. Pełne linie pękają na koniec bloku.',
    how: [
      'Wzrost: spokojne skupienie przyspiesza kapanie — karmiony kryształ rośnie.',
      'Im dłużej równo, tym czystszy kryształ: mleczny, czysty, lśniący.',
      'Szlif: odpocznij — spokój poleruje zbiór.',
    ],
    tips: [
      'Przeciągnij kryształ na ścianę — pasuje bez obracania, jak w Block Blast.',
      'Stuknij kryształ w tacce, by go karmić. Rośnie tylko karmiony.',
      'Spróbuj liczyć w myślach wstecz od 100 co 7 — wielu osobom to przyspiesza kapanie.',
      'Pełne linie świecą i pękają razem na końcu Wzrostu.',
      'W Szlifie rozluźnij czoło i patrz miękko — spokój poleruje.',
      'Zapełnij geodę prawie całą, a przy zbiorze pęknie w całości — z dodatkowym okazem.',
    ],
    unit: 'ct', art: 'art-geoda', fill: ['#ffd6f5', '#c77dff', '#9b5de5', '#3c1f6e'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 },
    load: () => import('./geoda/index').then(m => m.default),
  },
  {
    id: 'latarnik', title: 'Latarnik', tagline: 'Skup światło i sprowadź łodzie do portu.',
    text: 'Stuknij, gdy promień latarni padnie na łódź. Skupienie wydłuża światło, spokój rozświetla morze i wyrzuca na brzeg bursztyny.',
    how: [
      'Konwój: zaplanuj w myślach kurs łodzi — promień sięgnie dalej.',
      'Cisza: odpuść — morze świeci samo i odsłania bursztyny.',
      'Stuknięcie zawsze należy do Ciebie, opaska zmienia zasięg i blask.',
    ],
    tips: [
      'Stuknij w dowolnym miejscu, gdy promień przechodzi przez łódź.',
      'Środek promienia to „Idealnie”. Seria idealnych podnosi dźwięk dzwonu.',
      'Światło rozpala się powoli, kilka sekund po wysiłku. Nie poganiaj go.',
      'W Konwoju spróbuj zaplanować w myślach drogę każdej łodzi do portu.',
      'W Ciszy rozluźnij czoło i oddychaj zwyczajnie — morze rozjaśni się samo.',
    ],
    unit: 'łodzi', art: 'art-latarnik', fill: ['#ffe9a8', '#ffd27a', '#ff7a59', '#0b1630'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { adapt: 0.08 },
    load: () => import('./latarnik/index').then(m => m.default),
  },
  {
    id: 'motylarnia', title: 'Motylarnia', tagline: 'Gąsienica rysuje skrzydła, Twój umysł je barwi.',
    text: 'Prowadź gąsienicę po liściu: skupienie wzmaga apetyt i pogrubia linie, spokój w poczwarce pogłębia barwy. Każdy motyl jest jedyny.',
    how: [
      'Żer: skupienie — gąsienica je szybciej i rysuje śmielsze linie.',
      'Poczwarka: spokój — barwy skrzydeł głębieją.',
      'Ścieżka Twojego palca staje się wzorem skrzydeł.',
    ],
    tips: [
      'Prowadź gąsienicę palcem albo myszą. Strzałki też skręcają.',
      'Kropki barwnika dają kolory skrzydeł — przepis gatunku jest na karcie.',
      'Gąsienica rozkręca się powoli: apetyt rośnie kilka sekund po wysiłku.',
      'Przy żerze spróbuj planować trasę i wyobrażać sobie gotowy wzór.',
      'Gdy wisi poczwarka, rozluźnij czoło i patrz miękko — barwy zgęstnieją.',
    ],
    unit: 'mm', art: 'art-motylarnia', fill: ['#f2c230', '#e0453a', '#c2408f', '#3a5bd9'], tools: ['fnirs', 'eeg'], focusChip: false,
    tuning: { targetRate: 0.5, adapt: 0.08 },
    load: () => import('./motylarnia/index').then(m => m.default),
  },
];

export const arcadeEntry = (id: string): ArcadeEntry | undefined => ARCADE.find(a => a.id === id);

/** The session curve's colours for a saved result: the focus training's scene, or the arcade game's own. */
export function resultFill(r: Pick<TrainingResult, 'kind' | 'scene' | 'game'>): [string, string, string, string] {
  if (r.kind === 'game') return arcadeEntry(r.game?.id ?? r.scene)?.fill ?? SCENES.hills.fill;
  return SCENES[r.scene as SceneId]?.fill ?? SCENES.hills.fill;
}
