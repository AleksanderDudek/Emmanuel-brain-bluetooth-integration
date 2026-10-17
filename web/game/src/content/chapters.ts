/**
 * The chapters of Adam's life: the ten spheres of the Tree, ascended from Malkut to Keter,
 * plus two side realms opened by prayer (Ród, the family line; Szeol, the descent to the dead).
 * The sephiroth are used only as names of the spheres, each paired with a biblical theme.
 * Each chapter ends with a stronghold, a big lie (2 Kor 10,4); its fall brings a revelation.
 */
import type { ChapterDef } from '../types';
import { verse } from './bible';
import { REVELATIONS } from './revelations';

/** The stronghold's lie is the lie its revelation exposes. */
function lieOf(revelationId: string): string {
  const r = REVELATIONS.find(x => x.id === revelationId);
  if (!r) throw new Error(`Unknown revelation: ${revelationId}`);
  return r.lie;
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'malkut',
    order: 0,
    title: 'Kołyska',
    sphere: { name: 'Malkut', meaning: 'Królestwo' },
    story:
      'Adam jest małym chłopcem. Noce są długie, a dom bywa głośny i niespokojny. ' +
      'Gdy płacze w ciemności, nikt nie przychodzi, i Adam zaczyna wierzyć, że nikt go nie widzi. Nawet Bóg.',
    verse: verse('Iz 49,15'),
    palette: { bg1: '#23220f', bg2: '#2e1b10', accent: '#c9b458', wall: '#5b5130', seed: '#f3e7b3' },
    traumas: ['lek', 'samotnosc', 'odrzucenie'],
    boss: { name: 'Twierdza: Daleki Bóg', lie: lieOf('bog-widzi'), hp: 300 },
    revelationId: 'bog-widzi',
    mode: 1,
    realm: 'earth',
    report: 'Panie, Adam był małym dzieckiem i bał się ciemności. Dziś wie, że widziałeś każdą jego łzę.',
  },
  {
    id: 'jesod',
    order: 1,
    title: 'Dom',
    sphere: { name: 'Jesod', meaning: 'Fundament' },
    story:
      'Ojciec Adama często jest daleko, a gdy wraca, bywa zimny i surowy. Pochwała zdarza się rzadko, kara przychodzi za każdy błąd. ' +
      'Adam uczy się, że na miłość trzeba zapracować, i tak samo zaczyna myśleć o Bogu.',
    verse: verse('Ps 27,10'),
    palette: { bg1: '#1a1029', bg2: '#26143a', accent: '#b48cff', wall: '#4f3d6e', seed: '#ecdfff' },
    traumas: ['odrzucenie', 'samotnosc', 'lek', 'gniew'],
    boss: { name: 'Twierdza: Surowy Ojciec', lie: lieOf('ojciec'), hp: 380 },
    revelationId: 'ojciec',
    mode: 2,
    realm: 'earth',
    report: 'Panie, Adam tęsknił za ojcem, który by go przytulił. Odkrywa, że Ty sam wybiegasz mu naprzeciw.',
  },
  {
    id: 'hod',
    order: 2,
    title: 'Szkoła',
    sphere: { name: 'Hod', meaning: 'Chwała' },
    story:
      'W szkole Adam słyszy przezwiska i śmiech za plecami. Słowa innych przyklejają się do niego jak etykiety. ' +
      'Z czasem zaczyna wierzyć, że jest dokładnie taki, jak o nim mówią.',
    verse: verse('Ps 34,6'),
    palette: { bg1: '#24120a', bg2: '#33180b', accent: '#ff9f45', wall: '#6b4428', seed: '#ffe3c4' },
    traumas: ['wstyd', 'odrzucenie', 'oskarzyciel', 'lek'],
    boss: { name: 'Twierdza: Etykieta', lie: lieOf('tozsamosc'), hp: 460 },
    revelationId: 'tozsamosc',
    mode: 3,
    realm: 'earth',
    report: 'Panie, Adam nosił imiona, które nadali mu inni. Teraz słyszy, jak Ty wołasz go po imieniu.',
  },
  {
    id: 'necach',
    order: 3,
    title: 'Pierwsza miłość',
    sphere: { name: 'Necach', meaning: 'Zwycięstwo' },
    story:
      'Adam zakochuje się pierwszy raz i otwiera serce jak nigdy wcześniej. Gdy zostaje zdradzony, coś w nim pęka. ' +
      'Postanawia, że już nikomu nie zaufa.',
    verse: verse('Ps 147,3'),
    palette: { bg1: '#0a1f17', bg2: '#0d2c20', accent: '#3ddc97', wall: '#2b5c47', seed: '#d4ffeb' },
    traumas: ['odrzucenie', 'zazdrosc', 'samotnosc', 'oskarzyciel'],
    boss: { name: 'Twierdza: Zamknięte Serce', lie: lieOf('milosc-rani'), hp: 540 },
    revelationId: 'milosc-rani',
    mode: 4,
    realm: 'earth',
    report: 'Panie, serce Adama było zamknięte na klucz. Uchyla się powoli, bo Twoja miłość nie odchodzi.',
  },
  {
    id: 'tiferet',
    order: 4,
    title: 'Ambicja',
    sphere: { name: 'Tiferet', meaning: 'Piękno' },
    story:
      'Dorosły Adam pracuje bez wytchnienia. Każdy sukces cieszy go tylko przez chwilę, a każdy błąd boli długo. ' +
      'W głębi serca wierzy, że Bóg kocha go tylko wtedy, gdy jest najlepszy.',
    verse: verse('Mt 11,28'),
    palette: { bg1: '#231b07', bg2: '#30250a', accent: '#ffd54f', wall: '#6a5a2c', seed: '#fff4c7' },
    traumas: ['kontrola', 'pycha', 'lek', 'oskarzyciel'],
    boss: { name: 'Twierdza: Zasługa', lie: lieOf('zasluga'), hp: 620 },
    revelationId: 'zasluga',
    mode: 5,
    realm: 'earth',
    report: 'Panie, Adam biegł bez końca, żeby zasłużyć na Twoją miłość. Dziś odpoczywa, bo otrzymał ją w darze.',
  },
  {
    id: 'gewura',
    order: 5,
    title: 'Gniew',
    sphere: { name: 'Gewura', meaning: 'Moc' },
    story:
      'Stare rany zamieniają się w gniew. Adam wybucha na tych, których kocha, i nie potrafi przebaczyć tym, którzy go skrzywdzili. ' +
      'Boi się, że przebaczenie oznaczałoby udawanie, że nic się nie stało.',
    verse: verse('Ef 4,26'),
    palette: { bg1: '#26090c', bg2: '#360d11', accent: '#ff5252', wall: '#73303a', seed: '#ffd6d6' },
    traumas: ['gniew', 'nieprzebaczenie', 'pycha', 'oskarzyciel'],
    boss: { name: 'Twierdza: Udawany Pokój', lie: lieOf('przebaczenie'), hp: 720 },
    revelationId: 'przebaczenie',
    mode: 6,
    realm: 'earth',
    report: 'Panie, Adam nazwał krzywdę po imieniu i oddał Ci sąd. Gniew nie rządzi już jego sercem.',
  },
  {
    id: 'chesed',
    order: 6,
    title: 'Upadek',
    sphere: { name: 'Chesed', meaning: 'Miłosierdzie' },
    story:
      'Żeby uciszyć ból, Adam sięga po coś, co obiecuje ulgę, a staje się łańcuchem. Upada, podnosi się i znów upada. ' +
      'Wina szepcze mu, że Bóg ma go już dość.',
    verse: verse('Iz 42,3'),
    palette: { bg1: '#09142b', bg2: '#0c1c3f', accent: '#5aa9ff', wall: '#2e4a78', seed: '#d6eaff' },
    traumas: ['nalog', 'wina', 'wstyd', 'rozpacz', 'oskarzyciel'],
    boss: { name: 'Twierdza: Ostatnia Szansa', lie: lieOf('ma-dosc'), hp: 820 },
    revelationId: 'ma-dosc',
    mode: 7,
    realm: 'earth',
    report: 'Panie, Adam upadał wiele razy. Za każdym razem Twoje miłosierdzie było nowe.',
  },
  {
    id: 'bina',
    order: 7,
    title: 'Ciemna noc',
    sphere: { name: 'Bina', meaning: 'Zrozumienie' },
    story:
      'Przychodzi czas ciężkiej ciemności. Adam jest wyczerpany, nic go nie cieszy, a modlitwa wydaje się pusta. ' +
      'Ukrywa to przed wszystkimi, bo myśli, że wierzący nie powinien się smucić ani prosić o pomoc.',
    verse: verse('1 Krl 19,7'),
    palette: { bg1: '#0b0920', bg2: '#120f33', accent: '#8f82ff', wall: '#3a3570', seed: '#dedaff' },
    traumas: ['rozpacz', 'samotnosc', 'wstyd', 'oskarzyciel'],
    boss: { name: 'Twierdza: Maska', lie: lieOf('smutek'), hp: 940 },
    revelationId: 'smutek',
    mode: 2,
    realm: 'heaven',
    report: 'Panie, Adam przestał udawać, że wszystko jest dobrze. Poprosił ludzi o pomoc i nie jest już sam w ciemności.',
  },
  {
    id: 'chochma',
    order: 8,
    title: 'Pustynia',
    sphere: { name: 'Chochma', meaning: 'Mądrość' },
    story:
      'Wiara Adama wysycha jak ziemia bez deszczu. Modlitwy zdają się odbijać od nieba, a Bóg milczy. ' +
      'Adam patrzy na innych i myśli, że Duch Święty jest dla nich, ale nie dla niego.',
    verse: verse('Pwt 32,10'),
    palette: { bg1: '#121820', bg2: '#1b2430', accent: '#c3d6ea', wall: '#3e4b5d', seed: '#f0f5fb' },
    traumas: ['zwatpienie', 'samotnosc', 'kontrola', 'oskarzyciel'],
    boss: { name: 'Twierdza: Zamknięte Niebo', lie: lieOf('duch-dla-wszystkich'), hp: 1080 },
    revelationId: 'duch-dla-wszystkich',
    mode: 8,
    realm: 'heaven',
    report: 'Panie, Adam myślał, że niebo jest dla niego zamknięte. Poprosił o Twojego Ducha i pustynia zaczyna kwitnąć.',
  },
  {
    id: 'keter',
    order: 9,
    title: 'Dom Ojca',
    sphere: { name: 'Keter', meaning: 'Korona' },
    story:
      'Adam staje w progu domu Ojca. Drzwi są otwarte, ale stary głos mówi mu, że przeszłość zamyka mu drogę. ' +
      'To ostatnia twierdza i ostatni krok do domu.',
    verse: verse('J 14,2-3'),
    palette: { bg1: '#3a3122', bg2: '#4f4430', accent: '#fff3c2', wall: '#a38d5c', seed: '#ffffff' },
    traumas: ['oskarzyciel', 'wina', 'wstyd', 'pycha', 'lek'],
    boss: { name: 'Twierdza: Stary Człowiek', lie: lieOf('przeszlosc'), hp: 1250 },
    revelationId: 'przeszlosc',
    mode: 8,
    realm: 'heaven',
    report: 'Panie, Adam jest w domu. Przeszłość nie jest już jego imieniem, bo Ty uczyniłeś go nowym.',
  },
  {
    id: 'rod',
    order: 100,
    title: 'Drzewo rodu',
    sphere: { name: 'Ród', meaning: 'Pokolenia' },
    story:
      'Anioł schodzi do korzeni rodzinnego drzewa Adama. Widzi wzorce, które powtarzały się przez pokolenia: milczenie, lęk, gniew i ucieczki. ' +
      'Adam boi się, że jest skazany powtarzać to samo.',
    verse: verse('Wj 20,6'),
    palette: { bg1: '#121d0e', bg2: '#271b0f', accent: '#94d36b', wall: '#55452a', seed: '#e6f6d2' },
    traumas: ['lek', 'gniew', 'nieprzebaczenie', 'kontrola'],
    boss: { name: 'Twierdza: Klątwa Pokoleń', lie: lieOf('przodkowie'), hp: 700 },
    revelationId: 'przodkowie',
    mode: 1,
    realm: 'earth',
    unlockedBy: 'rod',
    report: 'Panie, Adam powierzył Ci historię swojego rodu. Stare wzorce tracą moc, a Twoje miłosierdzie płynie dalej.',
  },
  {
    id: 'szeol',
    order: 101,
    title: 'Zstąpienie',
    sphere: { name: 'Szeol', meaning: 'Otchłań' },
    story:
      'W otchłani, dokąd nie dociera żadne światło, czekają zagubione części serca Adama: dziecięca radość, ufność i śmiech. ' +
      'Chrystus zstąpił tu wcześniej i zostawił ślady światła. Anioł idzie po tych śladach, żeby przynieść zagubione do domu.',
    verse: verse('Ps 139,8'),
    palette: { bg1: '#111010', bg2: '#1e1311', accent: '#ff7b3a', wall: '#4a3832', seed: '#ffd9bf' },
    traumas: ['rozpacz', 'samotnosc', 'wstyd', 'oskarzyciel'],
    boss: { name: 'Twierdza: Bezdenna Ciemność', lie: lieOf('za-gleboko'), hp: 800 },
    revelationId: 'za-gleboko',
    mode: 4,
    realm: 'hell',
    unlockedBy: 'zagubieni',
    report: 'Panie, w otchłani czekały zagubione części serca Adama. Ty byłeś tam pierwszy, a teraz wracają z Tobą do domu.',
  },
];
