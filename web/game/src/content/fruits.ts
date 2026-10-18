/**
 * Fruits of the Spirit (Ga 5,22-23): permanent talents bought with Manna, three levels each.
 * `effect` is what one level adds.
 */
import type { FruitDef } from '../types';
import { verse } from './bible';

const COSTS = [20, 40, 80];

export const FRUITS: FruitDef[] = [
  {
    id: 'milosc',
    name: 'Miłość',
    effect: 'Każdy poziom dodaje jedno serce.',
    verse: verse('Ga 5,22-23'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'radosc',
    name: 'Radość',
    effect: 'Każdy poziom daje o 10% więcej światła.',
    verse: verse('Flp 4,4'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'pokoj',
    name: 'Pokój',
    effect: 'Każdy poziom poszerza promień aury pokoju o 0,3.',
    verse: verse('J 14,27'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'cierpliwosc',
    name: 'Cierpliwość',
    effect: 'Każdy poziom przyspiesza trawienie cieni o 15%.',
    verse: verse('Iz 40,31'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'uprzejmosc',
    name: 'Uprzejmość',
    effect: 'Każdy poziom zwiększa o 0,5 zasięg, z którego przyciągasz ziarna światła.',
    verse: verse('Prz 16,24'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'dobroc',
    name: 'Dobroć',
    effect: 'Każdy poziom wydłuża łaskę o 1 s.',
    verse: verse('Ps 23,6'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'wiernosc',
    name: 'Wierność',
    effect: 'Każdy poziom przyspiesza ładowanie Ognia Ducha o 15%.',
    verse: verse('2 Tm 2,13'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'lagodnosc',
    name: 'Łagodność',
    effect: 'Każdy poziom zwiększa obrażenia o 8%.',
    verse: verse('Mt 5,5'),
    maxLevel: 3,
    costs: [...COSTS],
  },
  {
    id: 'opanowanie',
    name: 'Opanowanie',
    effect: 'Każdy poziom zwiększa o 10% szybkostrzelność, gdy stoisz w miejscu.',
    verse: verse('Prz 16,32'),
    maxLevel: 3,
    costs: [...COSTS],
  },
];
