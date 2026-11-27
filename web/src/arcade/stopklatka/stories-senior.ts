/**
 * Stop-klatka — the stories for the age group 'senior' (50+), Polish, the source.  Contract: ./story.ts.
 *
 * What people past fifty tell of their days in Poland and Europe: a clinic where nobody listens ("w tym wieku tak
 * bywa"), machines that beep at the checkout while a queue sighs behind, a bus driver who shuts the door, a seat
 * refused, a courier who never rang, adult children who take the grandparent's time for granted, the first year of
 * retirement under one roof, a family table where "to już nie twoje czasy", and the care of a very old parent whose
 * illness turns against the one who helps.  Being talked down to is the thread: the freeze names what mattered
 * (respect, one's own time, one's voice) and the answer is a skill — a calm question, a clear request, a boundary
 * with an offer, curiosity instead of defence, humour.  The outcome is honest.
 *
 * Narration: second person, present tense, the address capitalised (Ci, Ciebie, Twój), no gendered forms; what others
 * say is their own speech (lowercase "ty").  Adult children only call or write (never drawn); the partner is "Twoja
 * druga połowa"; the grandchild is the 'teenager'.
 */
import type { Story } from './story';

export const STORIES_SENIOR: readonly Story[] = [
  {
    id: 'senior.lekarz',
    age: 'senior',
    title: 'W tym wieku tak bywa',
    beats: [
      {
        place: 'clinic', people: [{ who: 'group', mood: 'tired' }], prop: 'clock', heat: 0.3,
        text: 'Wizyta była na 10:15. Jest 11:05, na tablicy wciąż ten sam numer, a w poczekalni duszno.',
      },
      {
        place: 'clinic', people: [{ who: 'doctor', mood: 'busy', sex: 'm' }], heat: 0.5,
        text: 'Wreszcie gabinet. Lekarz pisze coś w komputerze i nie podnosi wzroku, gdy mówisz o zawrotach głowy.',
        say: 'Tak, tak. Coś jeszcze?',
      },
      {
        place: 'clinic', people: [{ who: 'doctor', mood: 'busy', sex: 'm' }], prop: 'paper', heat: 0.68,
        text: 'Wyjmujesz kartkę z zapisanymi objawami. Lekarz przerywa w połowie pierwszego zdania.',
        say: 'Proszę mi nie czytać całej listy. Mam dziś czterdzieści osób.',
      },
      {
        place: 'clinic', people: [{ who: 'doctor', mood: 'cold', sex: 'm' }], heat: 0.88,
        text: 'Pytasz, czy to nie coś z sercem. Lekarz już wypisuje receptę „na krążenie”.',
        say: 'W tym wieku tak już bywa. Następna osoba czeka.',
      },
    ],
    trigger: 'Policzki płoną, w uszach szumi. Palce gniotą kartkę z pytaniami.',
    urge: 'Powiedzieć mu, co się myśli o takich lekarzach, i trzasnąć drzwiami.',
    feel: ['hurt', 'anger', 'fear', 'helpless'],
    second: [
      'Złość mówi: chcesz, żeby ktoś Cię wysłuchał. Masz do tego prawo.',
      'Pod złością jest też lęk o zdrowie. On także zasługuje na odpowiedź.',
      'Trzaśnięte drzwi nie dadzą skierowania. Jedno spokojne pytanie może dać.',
    ],
    answer: 'Prostujesz się, patrzysz lekarzowi w oczy i spokojnie prosisz o jedną konkretną rzecz.',
    answerSay: 'Rozumiem, że czas goni. Czy możemy to sprawdzić badaniem, zamiast zgadywać?',
    outcome: {
      place: 'clinic', people: [{ who: 'doctor', mood: 'calm', sex: 'm' }], prop: 'paper', heat: 0.2,
      text: 'Lekarz pierwszy raz odrywa wzrok od ekranu. Wzdycha, ale wypisuje skierowanie na EKG i badanie krwi.',
      say: 'Dobrze. Z wynikami proszę przyjść od razu.',
    },
    lesson: 'Zapisz pytania przed wizytą i proś o jedną rzecz. Spokój mówi głośniej niż krzyk.',
    verse: 'php4.7',
  },
  {
    id: 'senior.kasa',
    age: 'senior',
    title: 'Kasa samoobsługowa',
    beats: [
      {
        place: 'shop', people: [{ who: 'group', mood: 'busy' }], prop: 'bag', heat: 0.25,
        text: 'Sobotnie zakupy. Przy zwykłej kasie długi ogonek, więc pierwszy raz idziesz do kasy samoobsługowej.',
      },
      {
        place: 'shop', prop: 'card', heat: 0.45,
        text: 'Skanujesz chleb, kładziesz go obok i maszyna piszczy: „Nieoczekiwany przedmiot w strefie pakowania”.',
      },
      {
        place: 'shop', people: [{ who: 'group', mood: 'angry' }], heat: 0.66,
        text: 'Za Tobą rośnie kolejka. Ktoś głośno wzdycha, ktoś inny stuka koszykiem w Twój wózek.',
        say: 'No ileż można? Ludzie się spieszą!',
      },
      {
        place: 'shop', people: [{ who: 'clerk', mood: 'smirk', sex: 'm' }], heat: 0.88,
        text: 'Podchodzi młody pracownik, odblokowuje kasę jednym kliknięciem i przewraca oczami.',
        say: 'Trzeba było iść do zwykłej kasy. To nie jest dla wszystkich.',
      },
    ],
    trigger: 'Uszy pieką ze wstydu i ze złości. Ręce drżą nad zakupami.',
    urge: 'Rzucić wszystko i wyjść, mówiąc głośno, co się myśli o takiej obsłudze.',
    feel: ['shame', 'anger', 'hurt', 'helpless'],
    second: [
      'Wstyd mówi: chcesz radzić sobie samodzielnie. To dobre pragnienie.',
      'Te maszyny piszczą na każdego. Młodzi też stoją przy nich zakłopotani.',
      'Kolejka zapomni o Tobie za minutę. Masz prawo uczyć się w swoim tempie.',
    ],
    answer: 'Nie uciekasz. Spokojnie mówisz, czego potrzebujesz: nie wyręczenia, tylko pokazania.',
    answerSay: 'Proszę mi pokazać, co zrobić, gdy znowu zapiszczy. Następnym razem dam radę.',
    outcome: {
      place: 'shop', people: [{ who: 'clerk', mood: 'sorry', sex: 'm' }], heat: 0.15,
      text: 'Pracownik lekko się czerwieni. Pokazuje przycisk pomocy i wagę. Następna bułka przechodzi bez pisku.',
      say: 'Przepraszam. Ona serio piszczy na wszystkich.',
    },
    lesson: 'Proś o naukę, nie o wyręczenie. Masz prawo uczyć się w swoim tempie.',
    verse: 'jas1.19',
  },
  {
    id: 'senior.autobus',
    age: 'senior',
    title: 'Miejsce w autobusie',
    beats: [
      {
        place: 'street', people: [{ who: 'driver', mood: 'cold', sex: 'm' }], prop: 'bag', heat: 0.3,
        text: 'Spieszysz się z ciężkimi siatkami na przystanek. Kierowca widzi Cię w lusterku i zamyka drzwi przed nosem.',
      },
      {
        place: 'street', prop: 'clock', heat: 0.48,
        text: 'Następny za dwadzieścia minut. Mżawka, zimno, a uchwyty siatek wrzynają się w palce.',
      },
      {
        place: 'bus', people: [{ who: 'group', mood: 'busy' }], prop: 'bag', heat: 0.66,
        text: 'W autobusie tłok. Na miejscach dla starszych siedzą młodzi ludzie z telefonami. Nikt nie podnosi wzroku.',
      },
      {
        place: 'bus', people: [{ who: 'stranger', mood: 'smirk', sex: 'm' }], heat: 0.88,
        text: 'Pytasz chłopaka przy drzwiach, czy mógłby ustąpić miejsca. Wyjmuje jedną słuchawkę z ucha.',
        say: 'A co, mam wstawać? Też płacę za bilet.',
      },
    ],
    trigger: 'Gorąco uderza do twarzy. Kolana drżą, a w gardle rośnie krzyk.',
    urge: 'Zawstydzić go na cały autobus: za moich czasów to było nie do pomyślenia!',
    feel: ['anger', 'hurt', 'tired', 'helpless'],
    second: [
      'Ta złość ma powód: należy Ci się szacunek.',
      'Potrzebujesz miejsca, nie wygranej kłótni. Twoje kolana są ważniejsze.',
      'W autobusie jest więcej ludzi. Ktoś z nich może chętnie pomóc.',
    ],
    answer: 'Nie wdajesz się w spór. Zwracasz się spokojnie do całego rzędu i prosisz wprost.',
    answerSay: 'Przepraszam, czy ktoś mógłby mi ustąpić? Mam ciężkie torby, a kolana już nie te.',
    outcome: {
      place: 'bus', people: [{ who: 'stranger', mood: 'smile', sex: 'f' }], heat: 0.15,
      text: 'Dziewczyna z drugiego rzędu od razu wstaje i bierze od Ciebie jedną siatkę. Chłopak udaje, że śpi.',
      say: 'Proszę usiąść. I tak wysiadam za dwa przystanki.',
    },
    lesson: 'Poproś wprost i uprzejmie. Ludzie częściej pomagają, niż się wydaje.',
    verse: 'rom12.21',
  },
  {
    id: 'senior.ferie',
    age: 'senior',
    title: 'Wnuki na całe ferie',
    beats: [
      {
        place: 'kitchen', prop: 'paper', heat: 0.2,
        text: 'Na stole leży skierowanie do sanatorium. Półtora roku czekania i wreszcie jest termin.',
        screen: 'Sanatorium — turnus od 3 lutego',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.45,
        text: 'Wiadomość od Twojego dorosłego dziecka. Nikt nie pyta, czy masz jakieś plany.',
        screen: 'Przywieziemy dzieci w poniedziałek na całe ferie. Pasuje?',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.66,
        text: 'Dzwonisz, żeby powiedzieć o sanatorium. W tle krzyczą wnuki, w głosie słychać pośpiech.',
        say: 'Sanatorium? To przełożysz. Wiesz, jak u nas jest z pracą.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.88,
        text: 'Próbujesz coś wtrącić, ale słyszysz tylko westchnienie.',
        say: 'Przecież na emeryturze i tak nic nie robisz.',
      },
    ],
    trigger: 'W piersi robi się ciasno. Ręka zaciska się na telefonie, oczy pieką.',
    urge: 'Wygarnąć, że wszyscy traktują Cię jak darmową pomoc, i się rozłączyć.',
    feel: ['hurt', 'anger', 'tired', 'helpless'],
    second: [
      'Pod złością jest ważna prawda: Twój czas też się liczy, także na emeryturze.',
      'Twoje dziecko może być naprawdę w kropce: praca, ferie, brak opieki.',
      'Możesz kochać wnuki i zarazem powiedzieć: nie przez cały czas.',
    ],
    answer: 'Nie wygarniasz. Mówisz spokojnie, co możesz dać, a czego nie. I nie tłumaczysz się z sanatorium.',
    answerSay: 'Wnuki wezmę chętnie, ale na trzy dni. W drugim tygodniu mam sanatorium.',
    outcome: {
      place: 'screen', prop: 'phone', heat: 0.25,
      text: 'Po drugiej stronie chwila ciszy. Potem odpowiedź, trochę chłodna, ale bez kłótni.',
      say: 'No dobrze. Trzy dni. Resztę jakoś zorganizujemy.',
    },
    lesson: 'Granica z propozycją: tyle mogę, tego nie mogę. Bez tłumaczenia się.',
    verse: 'mat5.9',
  },
  {
    id: 'senior.poczta',
    age: 'senior',
    title: 'Awizo',
    beats: [
      {
        place: 'street', prop: 'paper', heat: 0.3,
        text: 'Cały dzień jesteś w domu. Wieczorem w skrzynce leży awizo: kurier „nie zastał adresata”.',
        screen: 'Awizo — przesyłka do odbioru w placówce',
      },
      {
        place: 'queue', people: [{ who: 'group', mood: 'tired' }], prop: 'ticket', heat: 0.48,
        text: 'Rano na poczcie długa kolejka i jedno czynne okienko. Stoisz już trzy kwadranse.',
      },
      {
        place: 'queue', people: [{ who: 'stranger', mood: 'smirk' }], heat: 0.66,
        text: 'Ktoś wchodzi bokiem i staje tuż przed Tobą, z telefonem przy uchu.',
        say: 'Ja tylko na sekundę, list odebrać.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'cold', sex: 'f' }], prop: 'paper', heat: 0.88,
        text: 'Wreszcie okienko. Pani za szybą sprawdza numer i wzrusza ramionami.',
        say: 'Paczka już wróciła do nadawcy. Trzeba było przyjść wcześniej.',
      },
    ],
    trigger: 'Gorąco podchodzi do gardła, a dłonie same zgniatają awizo w kulkę.',
    urge: 'Wykrzyczeć przy całej kolejce, co się myśli o tej poczcie.',
    feel: ['anger', 'helpless', 'hurt', 'tired'],
    second: [
      'Złość ma rację: ktoś Cię zlekceważył. Kurier nawet nie zadzwonił.',
      'Pani w okienku nie roznosi paczek. Codziennie obrywa za cudze błędy.',
      'Chodzi o paczkę, nie o wygraną w kolejce. Czego teraz potrzebujesz?',
    ],
    answer: 'Wypuszczasz powietrze powoli i pytasz o następny krok: reklamację i ponowną wysyłkę.',
    answerSay: 'Wiem, że to nie wasza wina. Jak złożyć reklamację na kuriera?',
    outcome: {
      place: 'queue', people: [{ who: 'clerk', mood: 'sorry', sex: 'f' }], prop: 'paper', heat: 0.2,
      text: 'Pani za szybą mięknie. Podaje formularz i radzi, żeby nadawca wysłał paczkę jeszcze raz, do automatu.',
      say: 'Proszę to wypełnić. Z paczkomatem będzie prościej.',
    },
    lesson: 'Złość pokazuje krzywdę. Spokojne pytanie pokazuje drogę.',
    verse: 'pro15.1',
  },
  {
    id: 'senior.emerytura',
    age: 'senior',
    title: 'Emerytura we dwoje',
    beats: [
      {
        place: 'kitchen', people: [{ who: 'partner', mood: 'calm' }], prop: 'plate', heat: 0.3,
        text: 'Pierwszy rok wspólnej emerytury. Robisz śniadanie, a Twoja druga połowa zagląda Ci przez ramię.',
        say: 'Za dużo soli. Zawsze dajesz za dużo soli.',
      },
      {
        place: 'living', people: [{ who: 'partner', mood: 'busy' }], prop: 'remote', heat: 0.48,
        text: 'Siadasz do swojego serialu. Pilot znika Ci z ręki, a na ekranie pojawia się mecz.',
        say: 'Ten twój serial i tak jest o niczym.',
      },
      {
        place: 'kitchen', people: [{ who: 'partner', mood: 'cold' }], prop: 'plate', heat: 0.66,
        text: 'Ładujesz zmywarkę. Za plecami słychać westchnienie i brzęk przestawianych talerzy.',
        say: 'Daj, poprawię. Talerzy się tak nie stawia.',
      },
      {
        place: 'kitchen', people: [{ who: 'partner', mood: 'smirk' }], heat: 0.88,
        text: 'Pytasz, czy naprawdę trzeba poprawiać wszystko, co robisz.',
        say: 'Czterdzieści lat i dalej nie umiesz załadować zmywarki.',
      },
    ],
    trigger: 'Szczęka się zaciska. Talerz w dłoni nagle ciąży, w skroniach pulsuje.',
    urge: 'Odstawić talerz z hukiem i wyliczyć wszystkie przewinienia z czterdziestu lat.',
    feel: ['anger', 'hurt', 'tired', 'helpless'],
    second: [
      'Złość pilnuje czegoś ważnego: Twojego miejsca i szacunku. To słuszne.',
      'Emerytura to nowy etap dla was obojga. Druga strona też szuka w nim swojej roli.',
      'Nie o talerze tu chodzi. Za tydzień ważne będzie, czy umiecie się dogadać.',
    ],
    answer: 'Odstawiasz talerz delikatnie. Z uśmiechem mówisz o sobie i proponujesz układ zamiast wojny.',
    answerSay: 'Zmywarka niech będzie twoja, a kuchnia rano moja. A teraz idę na spacer.',
    outcome: {
      place: 'park', heat: 0.15,
      text: 'Na spacerze w parku złość opada. Wieczorem wracacie do tematu: kto czym się zajmuje i kiedy każde ma czas dla siebie.',
    },
    lesson: 'Wspólny czas potrzebuje też osobnego. Umówcie się, zamiast się przepychać.',
    verse: 'gal5.22-23',
  },
  {
    id: 'senior.stol',
    age: 'senior',
    title: 'Niedzielny obiad',
    beats: [
      {
        place: 'living', people: [{ who: 'group', mood: 'smile' }], prop: 'plate', heat: 0.2,
        text: 'Niedzielny obiad dla całej rodziny. Od rana gotujesz, a teraz wszyscy siedzą przy stole.',
      },
      {
        place: 'living', people: [{ who: 'teenager', mood: 'busy', sex: 'm' }], prop: 'phone', heat: 0.42,
        text: 'Wnuk przez cały obiad przewija telefon. Pytasz o szkołę, a on kiwa głową, nie patrząc.',
        say: 'Mhm. Spoko.',
      },
      {
        place: 'living', people: [{ who: 'group', mood: 'smirk' }], heat: 0.64,
        text: 'Rozmowa schodzi na pieniądze i politykę. Mówisz, jak to widzisz, a przy stole ktoś parska śmiechem.',
        say: 'Oj, daj spokój. Teraz jest inny świat.',
      },
      {
        place: 'living', people: [{ who: 'teenager', mood: 'smirk', sex: 'm' }], heat: 0.88,
        text: 'Wnuk wreszcie podnosi wzrok znad telefonu, ale tylko na chwilę.',
        say: 'To już nie twoje czasy. Ty tego nie ogarniesz.',
      },
    ],
    trigger: 'Coś ściska w piersi. Widelec zatrzymuje się w pół drogi, policzki płoną.',
    urge: 'Wstać od stołu i rzucić, że skoro tak, to następny obiad mogą zrobić sobie sami.',
    feel: ['hurt', 'anger', 'shame', 'helpless'],
    second: [
      'Masz prawo się złościć. Chcesz, żeby Twój głos się liczył, i on się liczy.',
      'Wnuk jest w wieku, w którym każdy dorosły wydaje się „z innej epoki”. To minie.',
      'Masz za sobą lata doświadczeń. Nie musisz ich bronić krzykiem.',
    ],
    answer: 'Odkładasz widelec, uśmiechasz się i zamieniasz obronę w ciekawość.',
    answerSay: 'Może nie moje czasy, ale wciąż moje zdanie. Wytłumaczysz mi, jak ty to widzisz?',
    outcome: {
      place: 'living', people: [{ who: 'teenager', mood: 'smile', sex: 'm' }], heat: 0.15,
      text: 'Wnuk patrzy zaskoczony, a potem pierwszy raz odkłada telefon. Tłumaczy coś z zapałem, a Ty dopytujesz.',
    },
    lesson: 'Gdy ktoś Cię lekceważy, ciekawość rozbraja lepiej niż obrona.',
    verse: 'pro16.24',
  },
  {
    id: 'senior.portfel',
    age: 'senior',
    title: 'Gdzie jest portfel?',
    heavy: true,
    beats: [
      {
        place: 'kitchen', people: [{ who: 'elder', mood: 'calm', sex: 'f' }], prop: 'cup', heat: 0.3,
        text: 'Od roku opiekujesz się mamą. Przy śniadaniu pyta czwarty raz w ciągu godziny, jaki dziś dzień.',
        say: 'A jaki dziś dzień? Środa?',
      },
      {
        place: 'living', people: [{ who: 'elder', mood: 'sad', sex: 'f' }], prop: 'remote', heat: 0.48,
        text: 'Pilot znajduje się w lodówce. Mama nie pamięta, że go tam włożyła, i obraża się na cały świat.',
      },
      {
        place: 'living', people: [{ who: 'elder', mood: 'angry', sex: 'f' }], prop: 'bag', heat: 0.66,
        text: 'Po południu mama przetrząsa torebkę coraz szybciej. Portfela nie ma.',
        say: 'Ktoś tu grzebał! Ktoś mi wszystko zabiera!',
      },
      {
        place: 'living', people: [{ who: 'elder', mood: 'shout', sex: 'f' }], heat: 0.9,
        text: 'Podchodzisz, żeby pomóc szukać. Mama się cofa i patrzy na Ciebie jak na kogoś obcego.',
        say: 'To ty mi zabierasz pieniądze! Oddawaj portfel!',
      },
    ],
    trigger: 'Jakby ktoś uderzył Cię w brzuch. Oddech staje, łzy i złość naraz.',
    urge: 'Krzyknąć, że oddajesz jej całe dnie, a ona oskarża Cię o kradzież.',
    feel: ['hurt', 'anger', 'tired', 'helpless'],
    second: [
      'To mówi choroba, nie mama. Mama się boi, że wszystko jej ucieka.',
      'Twój żal i złość są zrozumiałe. Dajesz tak wiele, a słyszysz coś takiego.',
      'Z chorobą nie wygrasz sporu. Możesz za to uspokoić strach.',
    ],
    answer: 'Nie tłumaczysz się i nie bronisz. Mówisz łagodnie, że widzisz jej strach, i szukacie razem.',
    answerSay: 'Widzę, że się martwisz. Poszukajmy razem. Na pewno się znajdzie.',
    outcome: {
      place: 'kitchen', people: [{ who: 'elder', mood: 'sorry', sex: 'f' }], prop: 'cup', heat: 0.2,
      text: 'Portfel leży w chlebaku. Mama się uspokaja i prosi o herbatę. Wieczorem szukasz grupy wsparcia dla opiekunów.',
    },
    lesson: 'Z chorobą się nie kłócisz. Odpowiadasz na lęk, który jest pod spodem.',
    verse: 'isa46.4',
  },
  {
    id: 'senior.infolinia',
    age: 'senior',
    title: 'Infolinia',
    beats: [
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'busy' }], prop: 'card', heat: 0.3,
        text: 'W aptece płacisz kartą za leki. Terminal piszczy: karta odrzucona. Za Tobą czeka kolejka.',
        say: 'Odrzucona. Może inna karta? Albo gotówka?',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.48,
        text: 'W domu dzwonisz na infolinię banku. Wybierz jeden, potem cztery, potem dwa. I muzyka.',
        screen: 'Czas oczekiwania: ok. 25 minut',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.68,
        text: 'Po półgodzinie odbiera konsultant. Prosi o kod z aplikacji, której nie masz.',
        say: 'Bez aplikacji nic nie zrobię. Przełączam do działu kart.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.88,
        text: 'Znowu muzyka. Mija dziesięć minut, piętnaście. Nagle cisza i krótki sygnał.',
        screen: 'Połączenie zakończone · 47:12',
      },
    ],
    trigger: 'Telefon parzy w dłoni. W skroniach dudni, ręka już się zamachuje.',
    urge: 'Zadzwonić jeszcze raz i nawrzeszczeć na pierwszą osobę, która odbierze.',
    feel: ['anger', 'helpless', 'tired', 'fear'],
    second: [
      'Złość mówi: to Twoje pieniądze i masz prawo do pomocy. To prawda.',
      'Następna osoba w słuchawce nie rozłączyła tej rozmowy. Krzyk trafi w kogoś niewinnego.',
      'Zapisz, co już wiesz: godzinę, co mówili i do jakiego działu przełączali.',
    ],
    answer: 'Robisz herbatę i zapisujesz na kartce, co już wiesz. Potem dzwonisz jeszcze raz i spokojnie prosisz o konkret.',
    answerSay: 'Rozmowa zerwała się po czterdziestu minutach. Proszę o numer zgłoszenia i oddzwonienie.',
    outcome: {
      place: 'kitchen', prop: 'paper', heat: 0.2,
      text: 'Tym razem konsultantka przeprasza, zadaje kilka pytań i odblokowuje kartę. Numer zgłoszenia zapisujesz grubo na kartce.',
    },
    lesson: 'Nie wyładowuj złości na następnej osobie. Zapisz fakty i proś o konkret.',
    verse: 'psa131.2',
  },
  {
    id: 'senior.pies',
    age: 'senior',
    title: 'Pies sąsiadki',
    beats: [
      {
        place: 'park', heat: 0.3,
        text: 'Poranny spacer po parku. Przy ławce wdeptujesz w to, czego ktoś nie posprzątał po swoim psie.',
      },
      {
        place: 'street', people: [{ who: 'neighbour', mood: 'smile', sex: 'f' }], heat: 0.48,
        text: 'Pod blokiem pies sąsiadki, bez smyczy, skacze Ci na płaszcz. Błotne łapy na jasnym materiale.',
        say: 'On tylko chce się przywitać! Nic nie zrobi.',
      },
      {
        place: 'corridor', heat: 0.66,
        text: 'Po południu sąsiadka wychodzi, a pies szczeka za ścianą. Godzinę, drugą. Nie da się czytać ani zdrzemnąć.',
      },
      {
        place: 'corridor', people: [{ who: 'neighbour', mood: 'cold', sex: 'f' }], heat: 0.88,
        text: 'Wieczorem na klatce mówisz jej o szczekaniu. Sąsiadka przewraca oczami.',
        say: 'Pies to nie radio, nie wyłączę go. Jak komuś przeszkadza, niech mieszka na wsi.',
      },
    ],
    trigger: 'Gorąco wspina się do twarzy. Ręce drżą, a głos już się podnosi.',
    urge: 'Wykrzyczeć na całą klatkę, co myślisz o niej i o jej psie.',
    feel: ['anger', 'disgust', 'tired', 'helpless'],
    second: [
      'Złość mówi: Twój spokój i czysty płaszcz też się liczą. To prawda.',
      'Ona kocha tego psa jak domownika. Atak na psa usłyszy jako atak na siebie.',
      'Chcesz ciszy po południu, nie wojny na klatce przez lata.',
    ],
    answer: 'Nie oceniasz ani jej, ani psa. Mówisz o jednej rzeczy, której potrzebujesz, i pytasz, co da się zrobić.',
    answerSay: 'Lubię psy, ale gdy pani wychodzi, on szczeka godzinami. Da się coś z tym zrobić?',
    outcome: {
      place: 'corridor', people: [{ who: 'neighbour', mood: 'sorry', sex: 'f' }], heat: 0.2,
      text: 'Sąsiadka milknie zaskoczona. Potem wzdycha i przyznaje, że nie wiedziała, jak długo to trwa.',
      say: 'Nie miałam pojęcia. Spróbuję go brać do mamy albo zostawiać mu radio.',
    },
    lesson: 'Jedna prośba o jedną rzecz, bez oceniania człowieka.',
    verse: 'rom12.18',
  },
  {
    id: 'senior.hit',
    age: 'senior',
    title: 'Hit wieczoru',
    beats: [
      {
        place: 'kitchen', prop: 'plate', heat: 0.2,
        text: 'Wnuczka nocuje u Ciebie. Lepisz pierogi, a z radia leci piosenka z Twojej młodości. Tańczysz przy stolnicy.',
      },
      {
        place: 'living', people: [{ who: 'teenager', mood: 'busy', sex: 'f' }], prop: 'phone', heat: 0.42,
        text: 'Z kanapy dobiega chichot. Wnuczka trzyma telefon w górze i coś nagrywa.',
        say: 'Nie przestawaj, to jest złoto!',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.66,
        text: 'Później telefon brzęczy. Rodzinna grupa: filmik z Twoim tańcem i fala śmiechu.',
        screen: 'Hit wieczoru xD · 14 reakcji',
      },
      {
        place: 'living', people: [{ who: 'teenager', mood: 'smirk', sex: 'f' }], heat: 0.88,
        text: 'Pytasz, czemu wysłała to bez pytania. Wnuczka wzrusza ramionami.',
        say: 'No co? Przecież to śmieszne. Wszyscy się śmieją.',
      },
    ],
    trigger: 'Policzki pieką. W gardle ściska wstyd zmieszany ze złością.',
    urge: 'Zabrać jej telefon, skasować wszystko i powiedzieć, że więcej tu nie przyjedzie.',
    feel: ['shame', 'hurt', 'anger'],
    second: [
      'Wstyd mówi: zależy Ci na tym, jak widzą Cię bliscy. To zrozumiałe.',
      'Wnuczka chyba nie chciała Cię ośmieszyć. Dla niej to zabawny, czuły filmik.',
      'Możesz postawić granicę i zostać w tym samym pokoju, przy tych samych pierogach.',
    ],
    answer: 'Siadasz obok wnuczki. Mówisz wprost, co Ci przeszkadza, i dodajesz coś z przymrużeniem oka.',
    answerSay: 'Następnym razem zapytaj. A jak już wrzucasz, to cały taniec, nie tylko potknięcie.',
    outcome: {
      place: 'kitchen', people: [{ who: 'teenager', mood: 'smile', sex: 'f' }], heat: 0.15,
      text: 'Wnuczka parska śmiechem, kasuje filmik i prosi, żeby nauczyć ją tego kroku. Tańczycie razem przy stolnicy.',
    },
    lesson: 'Granica może być lekka. Powiedz, co Ci przeszkadza, i zostaw drzwi otwarte.',
    verse: 'col3.15',
  },
  {
    id: 'senior.szybko',
    age: 'senior',
    title: 'Za szybko',
    beats: [
      {
        place: 'living', prop: 'remote', heat: 0.3,
        text: 'Nowy dekoder od operatora. Na telewizorze od rana napis: brak sygnału. A wieczorem Twój ulubiony teleturniej.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.48,
        text: 'Dzwonisz na wideo do swojego dorosłego dziecka. W tle hałas, pośpiech, ktoś woła.',
        say: 'Dobra, szybko. Pokaż pilota. Nie tak, odwróć telefon.',
      },
      {
        place: 'living', prop: 'phone', heat: 0.68,
        text: 'Kierujesz kamerę na telewizor. Polecenia lecą jedno za drugim, za szybko, by nadążyć.',
        say: 'Menu, zębatka, sieć, źródło, HDMI dwa. No przecież mówię!',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.88,
        text: 'Pytasz o drugi krok jeszcze raz. W słuchawce długie westchnienie i zdanie rzucone do kogoś obok.',
        say: 'Godzina z głowy. Jak zawsze, kiedy coś się zepsuje.',
      },
    ],
    trigger: 'Coś ściska w gardle. Telefon w dłoni nagle waży więcej niż pilot.',
    urge: 'Rzucić, że nikt nie musi się męczyć, i rozłączyć się bez słowa.',
    feel: ['hurt', 'shame', 'anger', 'helpless'],
    second: [
      'Złość i żal mówią: chcesz być dla bliskich radością, nie kłopotem.',
      'Twoje dziecko może mieć dziś urwanie głowy. Ten pośpiech nie jest oceną Ciebie.',
      'Uczysz się czegoś nowego. Każdy potrzebuje na to czasu, w każdym wieku.',
    ],
    answer: 'Nie rozłączasz się. Mówisz spokojnie, czego potrzebujesz, i proponujesz inny sposób.',
    answerSay: 'Widzę, że się spieszysz. Nagrasz mi krótki filmik krok po kroku? Obejrzę w swoim tempie.',
    outcome: {
      place: 'living', prop: 'remote', heat: 0.2,
      text: 'Wieczorem przychodzi filmik. Oglądasz go trzy razy, klikasz po kolei i na ekranie zaczyna się teleturniej.',
    },
    lesson: 'Gdy ktoś tłumaczy za szybko, poproś o swoje tempo, nie o łaskę.',
    verse: 'pro14.29',
  },
];
