/**
 * The few texts the app shows about the exercise cards before their module is loaded: the card in
 * Trening and the tile on Start (src/ui/activities.ts).  Everything else is in src/cards/i18n.ts,
 * which loads with the module.
 */
import { translator, type Catalog } from '../i18n';

const pl = {
  'act.title': 'Karty ćwiczeń',
  'act.text': '32 karty koordynacji, uwagi i pamięci: do druku i jako gry na dwa ekrany. Plansza podaje polecenie, telefon albo tablet jest przyciskami.',
  'act.cta': 'Otwórz karty',
  'act.tile': 'Gry na dwa ekrany i karty do druku',
  'act.loading': 'Wczytuję karty…',
  'act.failed': 'Nie udało się wczytać kart: {error}',
} as const;

type Key = keyof typeof pl;

const en: Catalog<Key> = {
  'act.title': 'Exercise cards',
  'act.text': '32 cards for coordination, attention and memory: to print, and as two-screen games. The board gives the task; a phone or tablet is the buttons.',
  'act.cta': 'Open the cards',
  'act.tile': 'Two-screen games and printable cards',
  'act.loading': 'Loading the cards…',
  'act.failed': 'Could not load the cards: {error}',
};

const de: Catalog<Key> = {
  'act.title': 'Übungskarten',
  'act.text': '32 Karten für Koordination, Aufmerksamkeit und Gedächtnis: zum Drucken und als Spiele auf zwei Bildschirmen. Die Tafel gibt die Aufgabe, ein Handy oder Tablet ist die Tastatur.',
  'act.cta': 'Karten öffnen',
  'act.tile': 'Spiele auf zwei Bildschirmen und Karten zum Drucken',
  'act.loading': 'Karten werden geladen …',
  'act.failed': 'Die Karten konnten nicht geladen werden: {error}',
};

const sv: Catalog<Key> = {
  'act.title': 'Övningskort',
  'act.text': '32 kort för koordination, uppmärksamhet och minne: att skriva ut och som spel på två skärmar. Tavlan ger uppgiften, en mobil eller surfplatta är knapparna.',
  'act.cta': 'Öppna korten',
  'act.tile': 'Spel på två skärmar och kort att skriva ut',
  'act.loading': 'Laddar korten …',
  'act.failed': 'Korten kunde inte laddas: {error}',
};

export const ENTRY_CATALOGS = { pl, en, de, sv } as const;
export const te = translator<Key>(ENTRY_CATALOGS);
