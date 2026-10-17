/**
 * Prayers spoken aloud. Speech recognition follows the text, so `text` holds only words and plain
 * punctuation: no digits, symbols, quotes or abbreviations; paragraphs are separated by a blank line.
 * Grace is free: a prayer is a response of the heart, never a payment. In the game it "opens"
 * realms, powers and cosmetics as a gift.
 * Ordered as the game offers them: the invocation opens the game, the Trisagion closes it.
 */
import type { PrayerDef } from '../types';
import { verse } from './bible';

const paragraphs = (...parts: string[]): string => parts.join('\n\n');

const JESUS_PRAYER = 'Panie Jezu Chryste, Synu Boży, zmiłuj się nade mną, grzesznikiem.';
const TRISAGION = 'Święty Boże, Święty Mocny, Święty a Nieśmiertelny, zmiłuj się nad nami.';

export const PRAYERS: PrayerDef[] = [
  {
    id: 'inwokacja',
    title: 'Inwokacja do Ducha Świętego',
    intro: 'Każda droga zaczyna się od zaproszenia. Wypowiedz tę modlitwę na głos, spokojnie, jak do Kogoś, kto jest bardzo blisko.',
    text: paragraphs(
      'Przyjdź, Duchu Święty. Przyjdź, Stwórco, który na początku unosiłeś się nad wodami. ' +
        'Odwiedź moje serce i napełnij je łaską z wysoka.',
      'Ty jesteś Pocieszycielem i darem Boga Najwyższego. Jesteś żywym źródłem, ogniem i miłością. ' +
        'Zapal światło w moich myślach i wlej miłość do mojego serca. Umacniaj swoją mocą to, co we mnie słabe.',
      'Odpędź ode mnie lęk i daj mi swój pokój. Idź przede mną jak przewodnik. ' +
        'Pomóż mi omijać to, co rani, i wybierać to, co dobre. ' +
        'Naucz mnie poznawać Ojca i Syna, i Ciebie, Duchu Święty, Panie i Ożywicielu.',
      'Prowadź mnie przez tę drogę. Prowadź Adama i każdego, kto nosi w sobie rany. ' +
        'Tam, gdzie jest ciemno, zapal światło. Tam, gdzie jest zimno, rozgrzej. Tam, gdzie boli, przynieś ukojenie.',
      'Chwała Ojcu i Synowi, i Tobie, Duchu Święty, teraz i na wieki wieków. Amen.',
    ),
    verse: verse('Ps 104,30'),
    unlocks: { soundscapes: ['gregorianski'], skins: ['skrzydla_golebie'], powers: ['golebica'] },
    unlockText: 'Modlitwa otwiera chorał gregoriański, skrzydła gołębicy i moc Gołębicy.',
  },
  {
    id: 'przyjmuje',
    title: 'Przyjmuję Ducha Świętego',
    intro: 'Duch Święty jest darem, nie nagrodą. Wystarczy otworzyć ręce i przyjąć.',
    text: paragraphs(
      'Panie Jezu, dziękuję, że obiecałeś nie zostawić nas sierotami. ' +
        'Dziękuję, że Ojciec daje Ducha Świętego tym, którzy Go proszą. Proszę więc jak dziecko: daj mi swojego Ducha.',
      'Nie muszę zasługiwać na ten dar. Otwieram ręce i przyjmuję go z wdzięcznością. ' +
        'Duchu Święty, przyjmuję Cię. Zamieszkaj we mnie. ' +
        'Wejdź do każdego pokoju mojego serca, także do tych, których drzwi od dawna są zamknięte.',
      'Rozpal we mnie ogień Twojej miłości. Przyjdź jak wiatr, który rozwiewa mgłę i otwiera okna. ' +
        'Daj mi odwagę, by mówić prawdę z miłością, i łagodność, by nikogo nie ranić.',
      'Oddaję Ci moje myśli, słowa i czyny. Oddaję Ci moje rany i moje lęki. ' +
        'Uzdrawiaj moje serce w Twoim czasie i na Twój sposób.',
      'Niech owocem Twojej obecności będą miłość, radość i pokój. Prowadź mnie każdego dnia.',
      'Przyjmuję Cię, Duchu Święty. Należę do Ciebie. Amen.',
    ),
    verse: verse('J 20,22'),
    unlocks: { ultimate: true, powers: ['ogien', 'wicher'], skins: ['halo_plomien'] },
    unlockText: 'Modlitwa otwiera dar Pięćdziesiątnicy: moc Ducha, Języki ognia, Gwałtowny wicher i aureolę płomienia.',
  },
  {
    id: 'rod',
    title: 'Przeciw ranom w linii mojego rodu',
    intro:
      'Ta modlitwa nikogo nie oskarża. Powierza historię twojej rodziny Chrystusowi, który przełamuje każde przekleństwo, ' +
      'i błogosławi tym, którzy przyjdą po tobie.',
    text: paragraphs(
      'Panie Jezu Chryste, staję przed Tobą jako dziecko mojego rodu. ' +
        'Dziękuję Ci za dar życia, który przyszedł do mnie przez moich rodziców i przodków. ' +
        'Dziękuję za każde dobro, wiarę i miłość, które mi przekazali.',
      'Ty znasz historię mojej rodziny lepiej niż ja. ' +
        'Znasz jej rany: lęk, gniew, milczenie, nałogi i odrzucenie, które powtarzały się z pokolenia na pokolenie. ' +
        'Nie przychodzę, by kogokolwiek sądzić. Powierzam Ci moich przodków i całą ich historię. ' +
        'Ty jesteś miłosierny i sprawiedliwy.',
      'W Twoim imieniu wyrzekam się powtarzania złych wzorców mojego rodu. ' +
        'Każdy człowiek odpowiada za własne czyny, a ja nie muszę nieść ciężarów, które nie są moje. ' +
        'Ty, Jezu, na krzyżu wziąłeś na siebie przekleństwo, abyśmy byli wolni. Twoja miłość jest silniejsza niż każda rana.',
      'Przebaczam tym, którzy w moim rodzie zranili innych i mnie. Proszę też o przebaczenie za moje własne winy.',
      'Błogosławię wszystkim, którzy przyjdą po mnie. ' +
        'Niech Twoje miłosierdzie, które trwa przez tysiące pokoleń, płynie przez mój ród jak czysta rzeka. ' +
        'Niech od dziś w moim rodzie przekazuje się wiarę, przebaczenie i pokój.',
      'Panie, Ty czynisz wszystko nowe. Ufam Tobie. Amen.',
    ),
    verse: verse('Iz 44,3'),
    unlocks: { realms: ['rod'], skins: ['szata_rod'] },
    unlockText: 'Modlitwa otwiera Drzewo rodu, krainę pokoleń, i szatę rodu.',
  },
  {
    id: 'przebaczenie',
    title: 'Modlitwa przebaczenia',
    intro: 'Przebaczenie nie oznacza, że krzywda była w porządku. To decyzja, by oddać sąd Bogu i nie nosić już trucizny.',
    text: paragraphs(
      'Panie Jezu, Ty znasz każdą krzywdę, która mnie spotkała. Widziałeś moje łzy, także te, których nikt nie zauważył. ' +
        'Nie każesz mi udawać, że nic się nie stało. Krzywda była prawdziwa i Ty o tym wiesz.',
      'Na krzyżu modliłeś się za tych, którzy Cię ranili. Daj mi choć trochę Twojego serca. ' +
        'Dziś, z Twoją pomocą, postanawiam przebaczyć. Przebaczam osobom, które mnie zraniły. ' +
        'W ciszy wypowiadam przed Tobą ich imiona.',
      'Oddaję Ci sąd nad nimi, bo Ty jesteś sprawiedliwy. Nie muszę już nosić tego ciężaru. ' +
        'Uwalniam ich od długu, który u mnie mają. ' +
        'Przebaczenie nie oznacza, że muszę wracać tam, gdzie jest niebezpiecznie. Przebaczyć to nie to samo, co znów zaufać.',
      'Proszę Cię też o przebaczenie dla mnie. Tam, gdzie mój gniew zamienił się w gorycz, oczyść moje serce. ' +
        'Przebaczam także sobie, bo Ty już mi przebaczyłeś.',
      'Błogosław tym, którzy mnie skrzywdzili. Niech poznają Twoją miłość. A mnie daj pokój, który przewyższa wszelki rozum.',
      'Ojcze nasz, odpuść nam nasze winy, jako i my odpuszczamy naszym winowajcom. Amen.',
    ),
    verse: verse('Ef 4,32'),
    unlocks: { powers: ['przebaczenie', 'ucisz'] },
    unlockText: 'Modlitwa otwiera moce Siedemdziesiąt siedem razy i Ucisz się!',
  },
  {
    id: 'zbroja',
    title: 'Zbroja Boża',
    intro: 'Święty Paweł opisał zbroję Bożą w Liście do Efezjan. Przywdziej ją słowami, część po części.',
    text: paragraphs(
      'Panie, Ty jesteś moją siłą. Dziś przyjmuję Twoją zbroję, ' +
        'bo moja walka nie toczy się przeciw ludziom, ale przeciw kłamstwu i ciemności.',
      'Przepasuję się prawdą. Niech Twoja prawda trzyma mnie mocno, gdy kłamstwo podsuwa mi swoje szepty.',
      'Przywdziewam pancerz sprawiedliwości. Nie mojej, ale Twojej, Jezu, którą otrzymuję w darze. Niech strzeże mojego serca.',
      'Obuwam nogi w gotowość głoszenia Ewangelii pokoju. Gdziekolwiek pójdę, pozwól mi nieść pokój, a nie niepokój.',
      'Biorę tarczę wiary. Niech gasi każdą ognistą strzałę oskarżenia, lęku i zwątpienia.',
      'Zakładam hełm zbawienia. Moje myśli należą do Ciebie, a moje zbawienie jest Twoim darem, nie moją zasługą.',
      'Chwytam miecz Ducha, którym jest słowo Boże. Niech Twoje słowo będzie w moich ustach światłem.',
      'Naucz mnie modlić się w każdym czasie, w Duchu, i czuwać za siebie i za wszystkich, których kochasz. ' +
        'Stoję w Twojej mocy, nie w swojej. Amen.',
    ),
    verse: verse('Ef 6,10-11'),
    unlocks: { powers: ['tarcza', 'pancerz', 'helm', 'sandaly'] },
    unlockText: 'Modlitwa otwiera Zbroję Bożą: Tarczę wiary, Pancerz sprawiedliwości, Hełm zbawienia i Obuwie pokoju.',
  },
  {
    id: 'jezusowa',
    title: 'Modlitwa Jezusowa',
    intro:
      'Starodawna modlitwa serca, odmawiana w rytmie oddechu: na wdechu „Panie Jezu Chryste, Synu Boży”, ' +
      'na wydechu „zmiłuj się nade mną, grzesznikiem” (albo „grzesznicą”). Nie spiesz się.',
    text: paragraphs(
      'Panie Jezu, wyciszam się przed Tobą. Oddycham spokojnie i powoli. ' +
        'Na wdechu wzywam Twojego imienia, a na wydechu oddaję Ci moje serce.',
      ...Array<string>(12).fill(JESUS_PRAYER),
      'Zostań ze mną, Panie, w każdym oddechu. Amen.',
    ),
    verse: verse('Łk 18,13'),
    unlocks: { soundscapes: ['bizantyjski'], skins: ['szata_przemienienia', 'halo_biel'] },
    unlockText: 'Modlitwa otwiera śpiew bizantyjski, szatę Przemienienia i białą aureolę.',
  },
  {
    id: 'zagubieni',
    title: 'Modlitwa za zagubionych',
    intro:
      'Jezus jest Dobrym Pasterzem, który idzie za zagubioną owcą. ' +
      'Pomódl się za zagubione części serca Adama i za wszystkich, którzy zabłądzili.',
    text: paragraphs(
      'Panie Jezu, Dobry Pasterzu, Ty zostawiasz dziewięćdziesiąt dziewięć owiec i idziesz szukać tej jednej, która się zgubiła. ' +
        'Przyszedłeś szukać i zbawić to, co zginęło.',
      'Wierzę, że zstąpiłeś do otchłani, aby nawet tam zanieść światło. ' +
        'Nie ma takiej głębi, do której nie sięgnęłaby Twoja miłość. Ty masz klucze śmierci i otchłani.',
      'Proszę Cię za zagubione części mojego serca: za radość, która zgasła, za ufność, która się schowała, ' +
        'za dziecko we mnie, które przestało się śmiać. Odszukaj je i przynieś do domu na swoich ramionach.',
      'Proszę Cię także za ludzi, którzy zabłądzili. Za tych, którzy stracili nadzieję, za tych, którzy odeszli od Ciebie, ' +
        'i za tych, za których nikt się nie modli. Znasz każdego z nich po imieniu i nikogo nie przestajesz szukać.',
      'Dobry Pasterzu, prowadź nas wszystkich do domu Ojca. Tam, gdzie jest ciemność, bądź naszym światłem. Amen.',
    ),
    verse: verse('Łk 15,4'),
    unlocks: { realms: ['szeol'], skins: ['szata_szeol'] },
    unlockText: 'Modlitwa otwiera Szeol, gdzie czekają zagubione odłamki duszy Adama, i szatę Zstąpienia.',
  },
  {
    id: 'klamstwa',
    title: 'Wyrzeczenie się kłamstw',
    intro: 'Każda twierdza stoi na kłamstwie. Nazwij kłamstwa po imieniu i przyjmij w ich miejsce Bożą prawdę.',
    text: paragraphs(
      'Panie Boże, Ty jesteś prawdą, a Twoje słowo jest światłem na mojej drodze. ' +
        'Przychodzę do Ciebie z myślami, które przez lata mówiły mi nieprawdę o Tobie, o mnie i o innych.',
      'W imię Jezusa wyrzekam się kłamstwa, że nikt mnie nie widzi. Przyjmuję prawdę, że Ty widzisz mnie zawsze.',
      'Wyrzekam się kłamstwa, że muszę zasłużyć na Twoją miłość. Przyjmuję prawdę, że Twoja miłość jest darem.',
      'Wyrzekam się kłamstwa, że jestem tym, co mówią o mnie inni. Przyjmuję prawdę, że jestem Twoim umiłowanym dzieckiem.',
      'Wyrzekam się kłamstwa, że moja przeszłość mnie określa. Przyjmuję prawdę, że w Chrystusie jestem nowym stworzeniem.',
      'Wyrzekam się kłamstwa, że moja ciemność jest dla Ciebie za głęboka. Przyjmuję prawdę, że Ty jesteś także tam.',
      'Duchu Święty, odnawiaj mój umysł. Gdy wrócą stare myśli, przypomnij mi Twoją prawdę. ' +
        'Niech prawda wyzwala mnie każdego dnia. Amen.',
    ),
    verse: verse('2 Kor 10,4'),
    unlocks: { codex: true, powers: ['milosc'] },
    unlockText: 'Modlitwa otwiera Księgę Prawdy, w której zapisują się objawienia, i moc Miłość usuwa lęk.',
  },
  {
    id: 'trisagion',
    title: 'Trisagion',
    intro: 'Prorok Izajasz usłyszał serafinów wołających: Święty, Święty, Święty. Dołącz do ich pieśni.',
    text: paragraphs(
      'Panie, Boże Zastępów, prorok Izajasz ujrzał Cię na wysokim tronie. ' +
        'Serafini zakrywali twarze skrzydłami i wołali jeden do drugiego, że jesteś święty, a cała ziemia jest pełna Twojej chwały. ' +
        'Razem z nimi i ze wszystkimi aniołami oddaję Ci cześć.',
      'Święty, Święty, Święty, Pan Bóg Zastępów. Niebo i ziemia są pełne Twojej chwały.',
      TRISAGION,
      TRISAGION,
      TRISAGION,
      'Dziękuję Ci za Adama i za każdą ranę, którą przemieniasz w prawdę. Dziękuję, że nikogo nie zostawiasz w ciemności. ' +
        'Dziękuję za drogę od Królestwa aż do Korony. Prowadziła nas Twoja łaska, nie nasza siła.',
      'Chwała Ojcu i Synowi, i Duchowi Świętemu, teraz i zawsze, i na wieki wieków. Amen.',
    ),
    verse: verse('Ap 4,8'),
    unlocks: {},
    unlockText: 'Modlitwa otwiera finał: pieśń serafinów nad Adamem, który wrócił do domu.',
  },
];
