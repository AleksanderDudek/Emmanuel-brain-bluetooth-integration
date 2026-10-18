/**
 * Prayers of the heart: a short invocation held in focus, not a text to read. The player repeats it
 * in the heart (or aloud, with speech recognition turned on) while focus — the Mendi band, the
 * voice, or simply stillness — fills the prayer. Grace is free: a prayer is a response of the
 * heart, never a payment. In the game it "opens" realms, powers and cosmetics as a gift.
 * `invocation` holds only words and plain punctuation (speech recognition follows it).
 * Ordered as the game offers them: the invocation opens the game, the Trisagion closes it.
 */
import type { PrayerDef } from '../types';
import { verse } from './bible';

export const PRAYERS: PrayerDef[] = [
  {
    id: 'inwokacja',
    title: 'Inwokacja do Ducha Świętego',
    intro: 'Każda droga zaczyna się od zaproszenia. Powtarzaj w sercu, spokojnie, jak do Kogoś bardzo bliskiego.',
    invocation: 'Przyjdź, Duchu Święty.',
    seconds: 20,
    verse: verse('Ps 104,30'),
    unlocks: { soundscapes: ['gregorianski'], skins: ['skrzydla_golebie'], powers: ['golebica'] },
    unlockText: 'Modlitwa otwiera chorał gregoriański, skrzydła gołębicy i moc Gołębicy.',
  },
  {
    id: 'przyjmuje',
    title: 'Przyjmuję Ducha Świętego',
    intro: 'Duch Święty jest darem, nie nagrodą. Wystarczy otworzyć ręce i przyjąć.',
    invocation: 'Duchu Święty, przyjmuję Cię.',
    seconds: 60,
    verse: verse('J 20,22'),
    unlocks: { ultimate: true, powers: ['ogien', 'wicher'], skins: ['halo_plomien'] },
    unlockText: 'Modlitwa otwiera Pięćdziesiątnicę (trzy płomienie Ognia naraz), Języki ognia, Gwałtowny wicher i aureolę płomienia.',
  },
  {
    id: 'rod',
    title: 'Przeciw ranom w linii mojego rodu',
    intro: 'Nikogo nie oskarżasz: powierzasz historię swojej rodziny Chrystusowi, który przełamuje każde przekleństwo.',
    invocation: 'Jezu, uwolnij mój ród od ran.',
    seconds: 75,
    verse: verse('Iz 44,3'),
    unlocks: { realms: ['rod'], skins: ['szata_rod'] },
    unlockText: 'Modlitwa otwiera Drzewo rodu, krainę pokoleń, i szatę rodu.',
  },
  {
    id: 'przebaczenie',
    title: 'Modlitwa przebaczenia',
    intro: 'Przebaczenie nie mówi, że krzywda była w porządku. To decyzja, by oddać sąd Bogu i nie nosić już trucizny.',
    invocation: 'Przebaczam, bo mnie przebaczono.',
    seconds: 75,
    verse: verse('Ef 4,32'),
    unlocks: { powers: ['przebaczenie', 'ucisz'] },
    unlockText: 'Modlitwa otwiera moce Siedemdziesiąt siedem razy i Ucisz się!',
  },
  {
    id: 'zbroja',
    title: 'Zbroja Boża',
    intro: 'Prawda, sprawiedliwość, pokój, wiara, zbawienie i Słowo: przywdziej zbroję, którą opisał święty Paweł.',
    invocation: 'Przywdziewam zbroję Bożą.',
    seconds: 60,
    verse: verse('Ef 6,10-11'),
    unlocks: { powers: ['tarcza', 'pancerz', 'helm', 'sandaly'] },
    unlockText: 'Modlitwa otwiera Zbroję Bożą: Tarczę wiary, Pancerz sprawiedliwości, Hełm zbawienia i Obuwie pokoju.',
  },
  {
    id: 'jezusowa',
    title: 'Modlitwa Jezusowa',
    intro: 'Starodawna modlitwa serca: na wdechu wzywasz imienia Jezusa, na wydechu oddajesz Mu serce. Nie spiesz się.',
    invocation: 'Panie Jezu Chryste, Synu Boży, zmiłuj się nade mną, grzesznikiem.',
    seconds: 90,
    verse: verse('Łk 18,13'),
    unlocks: { soundscapes: ['bizantyjski'], skins: ['szata_przemienienia', 'halo_biel'] },
    unlockText: 'Modlitwa otwiera śpiew bizantyjski, szatę Przemienienia i białą aureolę.',
  },
  {
    id: 'zagubieni',
    title: 'Modlitwa za zagubionych',
    intro: 'Dobry Pasterz idzie za zagubioną owcą. Pomódl się za zagubione części serca Adama i za wszystkich, którzy zabłądzili.',
    invocation: 'Panie, odnajdź to, co zginęło.',
    seconds: 75,
    verse: verse('Łk 15,4'),
    unlocks: { realms: ['szeol'], skins: ['szata_szeol'] },
    unlockText: 'Modlitwa otwiera Szeol, gdzie czekają zagubione odłamki duszy Adama, i szatę Zstąpienia.',
  },
  {
    id: 'klamstwa',
    title: 'Wyrzeczenie się kłamstw',
    intro: 'Każda twierdza stoi na kłamstwie. Wyrzeknij się go i przyjmij w jego miejsce Bożą prawdę.',
    invocation: 'Odrzucam kłamstwo, przyjmuję Prawdę.',
    seconds: 75,
    verse: verse('2 Kor 10,4'),
    unlocks: { codex: true, powers: ['milosc'] },
    unlockText: 'Modlitwa otwiera Księgę Prawdy, w której zapisują się objawienia, i moc Miłość usuwa lęk.',
  },
  {
    id: 'trisagion',
    title: 'Trisagion',
    intro: 'Prorok Izajasz usłyszał serafinów wołających: Święty, Święty, Święty. Dołącz do ich pieśni.',
    invocation: 'Święty Boże, Święty Mocny, Święty a Nieśmiertelny, zmiłuj się nad nami.',
    seconds: 60,
    verse: verse('Ap 4,8'),
    unlocks: {},
    unlockText: 'Modlitwa otwiera finał: pieśń serafinów nad Adamem, który wrócił do domu.',
  },
];
