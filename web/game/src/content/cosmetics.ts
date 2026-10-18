/**
 * Cosmetics (halo, robe, wings) and soundscapes. Nothing here is sold: they unlock through prayer,
 * Light gathered in play, or the angel's rank. `colors` = [main, glow].
 */
import type { SkinDef, SoundscapeDef } from '../types';

export const SKINS: SkinDef[] = [
  // ─── halo ──────────────────────────────────────────────────────────
  {
    id: 'halo_zlota',
    slot: 'halo',
    name: 'Złota aureola',
    description: 'Prosty krąg światła: znak, że należysz do Boga.',
    colors: ['#ffd76a', '#fff3c0'],
    unlock: 'default',
  },
  {
    id: 'halo_plomien',
    slot: 'halo',
    name: 'Aureola płomienia',
    description: 'Ogień Pięćdziesiątnicy nad twoją głową.',
    colors: ['#ff8a3d', '#ffd27a'],
    unlock: { prayer: 'przyjmuje' },
  },
  {
    id: 'halo_biel',
    slot: 'halo',
    name: 'Biała aureola',
    description: 'Cicha jasność serca, które oddycha imieniem Jezusa.',
    colors: ['#f4f7ff', '#ffffff'],
    unlock: { prayer: 'jezusowa' },
  },
  {
    id: 'halo_blekit',
    slot: 'halo',
    name: 'Błękitna aureola',
    description: 'Błękit nieba po burzy.',
    colors: ['#7cc4ff', '#d4ecff'],
    unlock: { light: 1500 },
  },
  {
    id: 'halo_purpura',
    slot: 'halo',
    name: 'Purpurowa aureola',
    description: 'Godność chóru Tronów, nadana za wierną służbę.',
    colors: ['#b36bff', '#e5ccff'],
    unlock: { rank: 'trony' },
  },

  // ─── robe ──────────────────────────────────────────────────────────
  {
    id: 'szata_lniana',
    slot: 'robe',
    name: 'Szata lniana',
    description: 'Czysty, jasny len świętych z Apokalipsy (Ap 19,8): prosta szata służby.',
    colors: ['#f3ead7', '#fffaf0'],
    unlock: 'default',
  },
  {
    id: 'szata_przemienienia',
    slot: 'robe',
    name: 'Szata Przemienienia',
    description: 'Biała jak światło na górze Tabor.',
    colors: ['#ffffff', '#e8f0ff'],
    unlock: { prayer: 'jezusowa' },
  },
  {
    id: 'szata_rod',
    slot: 'robe',
    name: 'Szata rodu',
    description: 'Utkana z błogosławieństwa dla całych pokoleń.',
    colors: ['#5f8f4e', '#c9e8b0'],
    unlock: { prayer: 'rod' },
  },
  {
    id: 'szata_szeol',
    slot: 'robe',
    name: 'Szata Zstąpienia',
    description: 'Ciemna jak otchłań, obszyta światłem, które tam zstąpiło.',
    colors: ['#2b2522', '#ff9a52'],
    unlock: { prayer: 'zagubieni' },
  },
  {
    id: 'szata_krolewska',
    slot: 'robe',
    name: 'Szata królewska',
    description: 'Najlepsza szata, którą ojciec kazał przynieść synowi, gdy ten wrócił do domu.',
    colors: ['#7a2a8f', '#ffd76a'],
    unlock: { light: 5000 },
  },

  // ─── wings ─────────────────────────────────────────────────────────
  {
    id: 'skrzydla_biale',
    slot: 'wings',
    name: 'Białe skrzydła',
    description: 'Skrzydła posłańca, gotowe do drogi.',
    colors: ['#ffffff', '#dfe9ff'],
    unlock: 'default',
  },
  {
    id: 'skrzydla_golebie',
    slot: 'wings',
    name: 'Skrzydła gołębicy',
    description: 'Miękkie i srebrzyste, jak Duch nad Jordanem.',
    colors: ['#e9eef5', '#c8d8ff'],
    unlock: { prayer: 'inwokacja' },
  },
  {
    id: 'skrzydla_zlote',
    slot: 'wings',
    name: 'Złote skrzydła',
    description: 'Skrzydła cherubinów, którzy strzegą świętości.',
    colors: ['#ffd25e', '#fff1b5'],
    unlock: { rank: 'cherubini' },
  },
  {
    id: 'skrzydla_ogniste',
    slot: 'wings',
    name: 'Skrzydła ogniste',
    description: 'Sześć skrzydeł serafina, płonących miłością.',
    colors: ['#ff6a2b', '#ffd36b'],
    unlock: { rank: 'serafini' },
  },
];

export const SOUNDSCAPES: SoundscapeDef[] = [
  {
    id: 'psalm',
    name: 'Psalm 150',
    description: 'Muzyka gry na instrumentach z Psalmu 150: lira, bębenek, cymbały i flet. Każda sfera ma własny utwór.',
    unlock: 'default',
  },
  {
    id: 'gregorianski',
    name: 'Chorał gregoriański',
    description: 'Spokojny, jednogłosowy śpiew Kościoła Zachodu w ośmiu tonach kościelnych.',
    unlock: 'default',
  },
  {
    id: 'bizantyjski',
    name: 'Śpiew bizantyjski',
    description: 'Głęboki burdon i melodia Wschodu, która niesie modlitwę serca.',
    unlock: { prayer: 'jezusowa' },
  },
  {
    id: 'dzwony',
    name: 'Dzwony',
    description: 'Dalekie dzwony, które wołają na modlitwę.',
    unlock: { light: 1500 },
  },
  {
    id: 'cisza',
    name: 'Cisza',
    description: 'Tylko oddech i delikatne dźwięki. „Uspokójcie się, a wiedzcie, żem Ja Bóg” (Ps 46,11).',
    unlock: 'default',
  },
];
