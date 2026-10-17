/**
 * The nine choirs of angels: the guardian angel's ranks, lowest first, by lifetime Light.
 * `name` is the angel's title within the choir (singular), e.g. "Anioł Mocy" in the choir of the Powers.
 */
import type { RankDef } from '../types';
import { verse } from './bible';

export const RANKS: RankDef[] = [
  {
    id: 'aniol',
    name: 'Anioł',
    light: 0,
    wings: 2,
    verse: verse('Hbr 1,14'),
    blessing: 'Bóg posyła cię do służby, a Jego obecność idzie razem z tobą.',
  },
  {
    id: 'archaniol',
    name: 'Archanioł',
    light: 300,
    wings: 2,
    verse: verse('Łk 1,19'),
    blessing: 'Stoisz przed obliczem Boga i niesiesz ludziom dobrą nowinę.',
  },
  {
    id: 'zwierzchnosci',
    name: 'Anioł Zwierzchności',
    light: 900,
    wings: 2,
    verse: verse('Ef 3,10'),
    blessing: 'Przez twoją służbę objawia się rozliczna mądrość Boża.',
  },
  {
    id: 'wladze',
    name: 'Anioł Władz',
    light: 1800,
    wings: 2,
    verse: verse('1 P 3,22'),
    blessing: 'Wszelka władza jest poddana Chrystusowi, a w Nim nic ci nie grozi.',
  },
  {
    id: 'moce',
    name: 'Anioł Mocy',
    light: 3200,
    wings: 2,
    verse: verse('Ps 103,20'),
    blessing: 'Twoja siła rodzi się z posłuszeństwa Jego słowu.',
  },
  {
    id: 'panowania',
    name: 'Anioł Panowań',
    light: 5000,
    wings: 2,
    verse: verse('Ef 1,21'),
    blessing: 'Chrystus jest ponad wszelkim panowaniem, a ty służysz Mu z radością.',
  },
  {
    id: 'trony',
    name: 'Anioł Tronów',
    light: 7500,
    wings: 2,
    verse: verse('Kol 1,16'),
    blessing: 'Wszystko zostało stworzone przez Niego i dla Niego, także ty.',
  },
  {
    id: 'cherubini',
    name: 'Cherub',
    light: 11000,
    wings: 4,
    verse: verse('Ez 10,21'),
    blessing: 'Cztery skrzydła, by strzec świętości i nieść chwałę.',
  },
  {
    id: 'serafini',
    name: 'Seraf',
    light: 16000,
    wings: 6,
    verse: verse('Iz 6,2'),
    blessing: 'Płoniesz miłością przed tronem i wołasz: Święty, Święty, Święty.',
  },
];
