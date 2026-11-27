/**
 * Stop-klatka — the stories for 27–35 (Polish, the source; en/de/sv in stories-adult.<lang>.ts).  Contract: ./story.ts.
 *
 * A small child on a late morning, a boss at 16:47 on Friday, a night clinic with a feverish child, the traffic before
 * the preschool closes, a full sink and a partner on the sofa, a card declined at the checkout, one's own mother's good
 * advice; a layoff as `heavy`.  Second person present tense, no gendered forms (narration capitalised: Ci/Cię/Twój;
 * speech lowercase).
 */
import type { Story } from './story';

export const STORIES_ADULT: readonly Story[] = [
  {
    id: 'adult.morning',
    age: 'adult',
    title: 'Poranek z kakao',
    beats: [
      {
        place: 'kitchen', people: [{ who: 'child', mood: 'smile' }], prop: 'cup', heat: 0.15,
        text: '7:40. Śniadanie, kanapki do przedszkola, mail od szefa na telefonie. Kubek kakao stoi na brzegu stołu.',
      },
      {
        place: 'kitchen', people: [{ who: 'child', mood: 'sorry' }], prop: 'cup', heat: 0.35,
        text: 'Mały łokieć, wielki plusk. Kakao na stole, na podłodze i na Twojej jedynej czystej koszuli.',
      },
      {
        place: 'living', people: [{ who: 'child', mood: 'angry' }], prop: 'clock', heat: 0.6,
        text: 'Przebierasz się w biegu. 8:05. Teraz buty. Dziecko siada na podłodze i krzyżuje ręce.',
        say: 'Nie te buty! Chcę czerwone!',
      },
      {
        place: 'living', people: [{ who: 'child', mood: 'shout' }], prop: 'toy', heat: 0.85,
        text: 'Czerwone są mokre. Tłumaczysz raz, drugi. Zabawka leci przez pokój. Telefon brzęczy: spotkanie o 8:30.',
        say: 'Nieee! Nie idę!',
      },
    ],
    trigger: 'Głos już nabiera powietrza do krzyku. Ręka sięga, żeby szarpnąć za rękaw.',
    urge: 'Wrzasnąć tak, żeby wreszcie posłuchało, i wcisnąć te buty na siłę.',
    feel: ['anger', 'helpless', 'tired'],
    second: [
      'Złość mówi: masz za dużo na głowie naraz. To prawda i to nie Twoja wina.',
      'Dziecko nie robi Ci na złość. Jego mózg nie umie jeszcze tego, co Ty ćwiczysz właśnie teraz.',
      'Pięć minut spóźnienia to mało. Poranek z krzykiem zostaje w dziecku na cały dzień.',
    ],
    answer: 'Kucasz, żeby być na wysokości oczu. Nazywasz to, co czuje dziecko, i dajesz mu prosty wybór.',
    answerSay: 'Złości cię, że czerwone są mokre. Bierzesz niebieskie czy żółte?',
    outcome: {
      place: 'street', people: [{ who: 'child', mood: 'smile' }], heat: 0.2,
      text: 'Niebieskie. Wychodzicie o 8:14. Na spotkanie wchodzisz pięć minut później, z plamą kakao pod marynarką.',
    },
    lesson: 'Dziecko pożycza od Ciebie spokój, którego samo jeszcze nie ma.',
    verse: 'gal5.22-23',
  },
  {
    id: 'adult.friday',
    age: 'adult',
    title: 'Piątek, 16:47',
    beats: [
      {
        place: 'office', prop: 'laptop', heat: 0.15,
        text: 'Piątek. Raport wysłany, plan na weekend gotowy: wyjazd za miasto, pierwszy od miesięcy.',
      },
      {
        place: 'office', prop: 'keys', heat: 0.35,
        text: '16:45. Zamykasz laptopa. Kluczyki już w dłoni, myśli już na trasie.',
      },
      {
        place: 'screen', heat: 0.6,
        text: '16:47. Telefon brzęczy. Mail od szefa, temat wielkimi literami.',
        screen: 'PILNE: prezentacja dla klienta na pon. 8:00',
      },
      {
        place: 'office', people: [{ who: 'boss', mood: 'busy' }], heat: 0.85,
        text: 'Szef przechodzi obok z płaszczem na ręce. W drzwiach jeszcze się odwraca z uśmiechem.',
        say: 'Wiem, wiem. Ale ty zrobisz to najlepiej. Miłego weekendu!',
      },
    ],
    trigger: 'Kluczyki wbijają się w dłoń. Szczęka się zaciska, w skroniach pulsuje.',
    urge: 'Rzucić kluczykami o biurko i wygarnąć wszystko, co się zbiera od miesięcy.',
    feel: ['anger', 'tired', 'helpless'],
    second: [
      'Ta złość broni czegoś ważnego: Twojego wolnego czasu. To nie fanaberia.',
      '„Zrobisz to najlepiej” to komplement, ale i wygoda. Możesz zapytać o priorytety.',
      'Spokojne „tak, ale” zadziała lepiej niż wybuch albo cicha harówka w niedzielę.',
    ],
    answer: 'Doganiasz szefa przy windzie. Mówisz, co możesz zrobić i na kiedy, i pytasz, co jest naprawdę niezbędne.',
    answerSay: 'W weekend wyjeżdżam. Skróconą wersję zrobię na poniedziałek, na 12:00. Co jest kluczowe?',
    outcome: {
      place: 'corridor', people: [{ who: 'boss', mood: 'tired' }], heat: 0.25,
      text: 'Szef marszczy brwi, potem kiwa głową. Trzy slajdy, w poniedziałek do południa. Weekend wciąż jest Twój.',
      say: 'Dobra. Trzy slajdy, do dwunastej.',
    },
    lesson: 'Zamiast wybuchu powiedz: tak, ale tyle, na kiedy i co odpada.',
    verse: 'mat11.28',
  },
  {
    id: 'adult.traffic',
    age: 'adult',
    title: 'Przedszkole do 17:00',
    beats: [
      {
        place: 'car', prop: 'clock', heat: 0.25,
        text: '16:35. Przedszkole zamykają o 17:00, a Ty stoisz w korku na wiadukcie. Nawigacja pokazuje 22 minuty.',
      },
      {
        place: 'car', people: [{ who: 'driver', mood: 'busy' }], heat: 0.5,
        text: 'Pas obok wreszcie rusza. Ktoś wciska się przed Twoją maskę na trzeciego, bez kierunkowskazu.',
      },
      {
        place: 'car', people: [{ who: 'driver', mood: 'angry' }], heat: 0.8,
        text: 'Na światłach ten sam samochód hamuje gwałtownie tuż przed Tobą. Z okna wysuwa się ręka z wymownym gestem.',
      },
    ],
    trigger: 'Dłoń już wciska klakson, palce ściskają kierownicę do białych kostek.',
    urge: 'Trąbić bez końca, przykleić się do zderzaka i pokazać, kto tu rządzi.',
    feel: ['anger', 'fear', 'helpless'],
    second: [
      'Ta złość ma powód: śpieszysz się do dziecka. To najważniejsza sprawa tego dnia.',
      'Za minutę ten samochód zniknie Ci z oczu. Stłuczka zostałaby z Tobą na długo.',
      'Dziecko czeka na Ciebie, nie na wyścig.',
    ],
    answer: 'Zdejmujesz dłoń z klaksonu i zwiększasz odstęp. Na czerwonym dzwonisz do przedszkola.',
    answerSay: 'Dzień dobry, stoję w korku. Będę dziesięć minut po piątej, przepraszam.',
    outcome: {
      place: 'street', people: [{ who: 'teacher', mood: 'tired' }, { who: 'child', mood: 'smile', at: 'right' }], heat: 0.25,
      text: '17:09. W drzwiach przedszkola zmęczone spojrzenie, a obok dziecko, które biegnie Ci w ramiona.',
      say: 'Dziękuję za telefon. Jutro do piątej, dobrze?',
    },
    lesson: 'Nie wpuszczaj złości za kierownicę.',
    verse: 'pro16.32',
  },
  {
    id: 'adult.sink',
    age: 'adult',
    title: 'Pełny zlew',
    beats: [
      {
        place: 'kitchen', prop: 'bag', heat: 0.2,
        text: '19:20. Wracasz z pracy przez sklep, z dwiema siatkami. W zlewie naczynia z wczoraj i z dziś.',
      },
      {
        place: 'kitchen', prop: 'toy', heat: 0.4,
        text: 'Rozpakowujesz zakupy. Na stole okruchy, pod stołem rozsypane klocki, pranie wciąż w pralce.',
      },
      {
        place: 'living', people: [{ who: 'partner', mood: 'calm' }], prop: 'remote', heat: 0.6,
        text: 'W salonie Twoja druga połówka, z telefonem w ręce i serialem w tle.',
        say: 'O, jesteś. Co na kolację?',
      },
      {
        place: 'kitchen', people: [{ who: 'partner', mood: 'smirk' }], heat: 0.85,
        text: 'Zaczynasz zmywać tak, że talerze dzwonią. Z salonu dobiega zdanie z lekkim śmiechem:',
        say: 'Odpocznij, czemu się tak spinasz?',
      },
    ],
    trigger: 'Talerz zatrzymuje się w pół drogi. Gorąco rozlewa się po karku, szczęka twardnieje.',
    urge: 'Trzasnąć talerzem o zlew i wyliczyć wszystko, czego nikt w tym domu nie robi.',
    feel: ['anger', 'tired', 'hurt'],
    second: [
      'Złość mówi: potrzebujesz podziału, który jest fair. To uczciwa potrzeba.',
      '„Wszystko” i „nikt” zamieniają prośbę w oskarżenie. Konkret łatwiej usłyszeć.',
      'Ta osoba też ma za sobą dzień. Może po prostu nie widzi tego, co widzisz Ty.',
    ],
    answer: 'Odkładasz talerz. Mówisz od siebie: co czujesz, czego potrzebujesz i o co prosisz dziś wieczorem.',
    answerSay: 'Gdy po pracy widzę pełny zlew, opadam z sił. Pozmywasz dziś? Ja zrobię kolację.',
    outcome: {
      place: 'kitchen', people: [{ who: 'partner', mood: 'sorry' }], heat: 0.25,
      text: 'Chwila ciszy, potem ciche „jasne”. Zmywanie idzie w milczeniu, ale idzie. O podziale pogadacie w niedzielę.',
    },
    lesson: 'Mów „czuję” i „proszę”, zamiast „ty zawsze” i „ty nigdy”.',
    verse: 'eph4.26',
  },
  {
    id: 'adult.clinic',
    age: 'adult',
    title: 'Nocna pomoc',
    beats: [
      {
        place: 'clinic', people: [{ who: 'group', mood: 'tired' }], prop: 'ticket', heat: 0.2,
        text: '23:10, nocna pomoc lekarska. Dziecko z gorączką śpi Ci na ramieniu. Przed wami dwanaście osób.',
      },
      {
        place: 'clinic', prop: 'clock', heat: 0.4,
        text: 'Mija druga godzina. Numer na tablicy stoi w miejscu. Czoło pod Twoją dłonią znowu jest gorące.',
      },
      {
        place: 'clinic', people: [{ who: 'stranger', mood: 'smirk' }], heat: 0.6,
        text: 'Ktoś wchodzi z ulicy i bez słowa staje pod drzwiami gabinetu, przed całą kolejką.',
        say: 'Ja tylko po receptę, na minutkę.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'cold' }], heat: 0.85,
        text: 'Podchodzisz do rejestracji i pytasz, jak długo jeszcze. Spojrzenie znad okularów.',
        say: 'Kolejność ustala lekarz. Proszę czekać.',
      },
    ],
    trigger: 'Gorąco uderza w skronie. Ramię z dzieckiem sztywnieje, a głos rośnie w gardle.',
    urge: 'Zrobić awanturę na całą poczekalnię i wejść do gabinetu bez kolejki.',
    feel: ['anger', 'fear', 'tired'],
    second: [
      'Pod złością jest lęk o dziecko. To on każe Ci walczyć.',
      'Osoba w rejestracji nie ustala kolejki i też ma za sobą długą noc.',
      'Gdy coś się pogarsza, masz prawo powiedzieć to jasno. Bez krzyku słychać lepiej.',
    ],
    answer: 'Mówisz spokojnie i konkretnie: ile stopni, od kiedy, jaki lek już był. Prosisz, by lekarz o tym wiedział.',
    answerSay: 'Gorączka 39,8 mimo leku, od czterech godzin. Proszę to przekazać lekarzowi.',
    outcome: {
      place: 'clinic', people: [{ who: 'doctor', mood: 'calm' }], heat: 0.3,
      text: 'Dziesięć minut później drzwi gabinetu się otwierają: wasza kolej. Noc jeszcze długa, ale głowa jasna.',
    },
    lesson: 'Pod złością często jest lęk. Powiedz, czego się boisz, a usłyszą więcej.',
    verse: '1pe5.7',
  },
  {
    id: 'adult.card',
    age: 'adult',
    title: 'Karta odrzucona',
    beats: [
      {
        place: 'shop', prop: 'bag', heat: 0.2,
        text: 'Sobota, zakupy na cały tydzień. Pełny wózek, długa kolejka do jedynej otwartej kasy.',
      },
      {
        place: 'screen', heat: 0.4,
        text: 'Czekając, zaglądasz do banku. Pensja jeszcze nie weszła, rata kredytu już zeszła.',
        screen: 'Dostępne środki: 312,40\u00a0zł',
      },
      {
        place: 'shop', people: [{ who: 'clerk', mood: 'busy' }], prop: 'card', heat: 0.6,
        text: 'Taśma, skaner, 386\u00a0złotych. Przykładasz kartę. Terminal piszczy.',
        say: 'Odrzucona. Jeszcze raz?',
      },
      {
        place: 'shop', people: [{ who: 'clerk', mood: 'cold' }, { who: 'stranger', mood: 'angry', at: 'right' }], from: 1, heat: 0.85,
        text: 'Drugi raz to samo. Za Tobą ktoś głośno wzdycha i mówi do całej kolejki:',
        say: 'No ludzie, sobota. Można by wcześniej sprawdzić konto.',
      },
    ],
    trigger: 'Twarz pali, w uszach szum. Ręka z kartą sztywnieje, a język już szuka ciętej riposty.',
    urge: 'Odwrócić się i odpyskować tak, żeby cała kolejka słyszała.',
    feel: ['shame', 'anger', 'fear'],
    second: [
      'Pod złością jest wstyd i lęk o pieniądze. W wielu domach koniec miesiąca wygląda tak samo.',
      'Osoba za Tobą nie zna Twojego miesiąca. Jej zdanie nie musi stać się Twoim.',
      'Za godzinę nikt z tej kolejki nie będzie tego pamiętać.',
    ],
    answer: 'Mówisz spokojnie, że odłożysz część rzeczy. Wybierasz, co niezbędne, i płacisz za resztę z drugiego konta.',
    answerSay: 'Przepraszam za kłopot. Odłożę kilka rzeczy, to zajmie chwilę.',
    outcome: {
      place: 'shop', people: [{ who: 'clerk', mood: 'smile' }], heat: 0.25,
      text: 'Terminal przyjmuje płatność. Wstyd jeszcze piecze, ale wychodzisz z podniesioną głową.',
      say: 'Spokojnie, zdarza się co sobotę.',
    },
    lesson: 'Wstyd nie musi mówić za Ciebie. Wystarczy jedno spokojne zdanie.',
    verse: 'pro19.11',
  },
  {
    id: 'adult.advice',
    age: 'adult',
    title: 'Dobre rady',
    beats: [
      {
        place: 'living', people: [{ who: 'elder', mood: 'smile' }], prop: 'toy', heat: 0.2,
        text: 'Niedzielne odwiedziny. Twoja mama przyjeżdża z ciastem i z torbą prezentów dla dziecka.',
      },
      {
        place: 'kitchen', people: [{ who: 'elder', mood: 'busy' }], heat: 0.4,
        text: 'Po kwadransie zaczyna przestawiać rzeczy w Twojej kuchni. Bo tak będzie wygodniej.',
      },
      {
        place: 'living', people: [{ who: 'elder', mood: 'cold' }], heat: 0.6,
        text: 'Dziecko ogląda bajkę na tablecie. Pada westchnienie i zdanie na pół pokoju:',
        say: 'W moich czasach dzieci nie siedziały w tych ekranach.',
      },
      {
        place: 'kitchen', people: [{ who: 'elder', mood: 'smirk' }, { who: 'child', mood: 'sad', at: 'right' }], prop: 'plate', heat: 0.85,
        text: 'Przy kolacji, przy samym dziecku, pada kolejna uwaga, tym razem prosto do Ciebie:',
        say: 'Ty je za bardzo rozpieszczasz. Wyrośnie z tego kłopot.',
      },
    ],
    trigger: 'Widelec stuka o talerz. Gorąco wypełnia klatkę piersiową, a słowa już się cisną.',
    urge: 'Wypomnieć jej wszystko z własnego dzieciństwa, tu i teraz, przy stole.',
    feel: ['anger', 'hurt', 'shame'],
    second: [
      'Masz prawo do tej złości: chodzi o szacunek dla Twojego rodzicielstwa.',
      'Mama chce być potrzebna. Rady bywają jej sposobem na bliskość.',
      'Dziecko patrzy teraz na Ciebie. Uczy się z tej chwili, jak rozmawiać, gdy jest trudno.',
    ],
    answer: 'Odkładasz widelec. Mówisz ciepło, ale jasno: o radach możecie porozmawiać później, nie przy dziecku.',
    answerSay: 'Mamo, wiem, że chcesz dobrze. Przy dziecku proszę bez ocen. Pogadamy wieczorem?',
    outcome: {
      place: 'living', people: [{ who: 'elder', mood: 'sorry' }], prop: 'cup', heat: 0.25,
      text: 'Mama na chwilę milknie. Wieczorem przy herbacie mówi, że się martwi. Nie zgadzacie się we wszystkim, ale rozmawiacie.',
    },
    lesson: 'Granica powiedziana ciepło nie jest przez to słabsza.',
    verse: 'mat5.9',
  },
  {
    id: 'adult.layoff',
    age: 'adult',
    title: 'Krótka rozmowa',
    heavy: true,
    beats: [
      {
        place: 'office', prop: 'laptop', heat: 0.2,
        text: 'Wtorek, 9:00. W kalendarzu nagle pojawia się spotkanie: „Krótka rozmowa”. Bez opisu.',
      },
      {
        place: 'meeting', people: [{ who: 'boss', mood: 'cold' }, { who: 'colleague', mood: 'busy', at: 'right' }], heat: 0.4,
        text: 'Mała sala. Szef i ktoś z kadr, z teczką. Nikt nie patrzy Ci w oczy.',
      },
      {
        place: 'meeting', people: [{ who: 'colleague', mood: 'cold' }], prop: 'paper', heat: 0.6,
        text: 'Restrukturyzacja. Twoje stanowisko znika. Kartka z porozumieniem leży już przed Tobą.',
        say: 'Prosimy o podpis jeszcze dziś.',
        screen: 'Porozumienie o rozwiązaniu umowy',
      },
      {
        place: 'meeting', people: [{ who: 'boss', mood: 'busy' }], heat: 0.85,
        text: 'Myślisz o racie kredytu, o dziecku, o pięciu latach tutaj. Szef zerka na zegarek.',
        say: 'Rozumiemy, że to trudne. Mamy jeszcze dwie rozmowy.',
      },
    ],
    trigger: 'Krew odpływa z twarzy, a potem wraca falą. Dłonie zaciskają się pod stołem.',
    urge: 'Powiedzieć im w twarz, co się myśli o tej firmie, i wyjść, trzaskając drzwiami.',
    feel: ['fear', 'anger', 'helpless'],
    second: [
      'Złość i lęk mówią prawdę: to dotyka Twojego domu i bezpieczeństwa.',
      'Nie musisz dziś niczego podpisywać. Masz prawo do czasu i do porady.',
      'Ta decyzja mówi o budżecie firmy, nie o Twojej wartości.',
    ],
    answer: 'Prosisz o dokumenty na piśmie i o czas do namysłu. Dziś nic nie podpisujesz. Wychodzisz spokojnym krokiem.',
    answerSay: 'Potrzebuję czasu. Proszę o dokumenty mailem, odpowiem do piątku.',
    outcome: {
      place: 'park', people: [{ who: 'partner', mood: 'calm' }], heat: 0.3,
      text: 'Wieczorem spacer z kimś bliskim. Lęk nie znika, ale jest plan: porada prawna, CV, rozmowa o budżecie.',
    },
    lesson: 'W szoku nie podejmuj decyzji. Poproś o czas i nie zostawaj z tym w pojedynkę.',
    verse: 'php4.7',
  },
];
