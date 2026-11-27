/**
 * Stop-klatka — the stories for the age group 'mid' (36–50), Polish, the source.  Contract: ./story.ts.
 *
 * The middle years in Poland and Europe as people tell them: a teenager at home and an ageing parent at once (the
 * "sandwich"), work that runs into the evening and a boss who takes the credit, the unseen load of a home, a sibling
 * who leaves the care to the one who lives closer, a neighbour's renovation, an office queue on a day of leave, a
 * traffic jam on the way to a doctor awaited for months.  Each story builds in small steps to the last straw; the
 * freeze does not dismiss the anger (it says what mattered) and the answer is a skill: an "I" sentence, one clear
 * request, a question instead of an accusation, a talk later and in private, a boundary.  The outcome is honest: it
 * eases a little, and the player kept their own course.
 *
 * Narration: second person, present tense, the address capitalised (Ci, Ciebie, Twój), no gendered forms; what others
 * say is their own speech (lowercase "ty").  The partner is "Twoja druga połowa"; the teenager "Twoje dziecko".
 */
import type { Story } from './story';

export const STORIES_MID: readonly Story[] = [
  {
    id: 'mid.dziennik',
    age: 'mid',
    title: 'Trzecia jedynka',
    beats: [
      {
        place: 'office', prop: 'phone', heat: 0.3,
        text: 'Środek dnia w pracy. Telefon brzęczy: nowa ocena w dzienniku. Już trzecia jedynka z matematyki w tym miesiącu.',
        screen: 'E-dziennik: matematyka — ocena 1',
      },
      {
        place: 'kitchen', prop: 'plate', heat: 0.5,
        text: 'Wracasz po siódmej. Kolacja stoi nietknięta, w zlewie piętrzą się naczynia, a zza drzwi dudni muzyka.',
      },
      {
        place: 'living', people: [{ who: 'teenager', mood: 'busy' }], prop: 'phone', heat: 0.68,
        text: 'Pytasz o tę jedynkę. Twoje dziecko nie odrywa wzroku od telefonu.',
        say: 'No i co? Jedna ocena. Nie rób dramy.',
      },
      {
        place: 'living', people: [{ who: 'teenager', mood: 'smirk' }], heat: 0.88,
        text: 'Prosisz o odłożenie telefonu i chwilę rozmowy. W odpowiedzi przewrócone oczy.',
        say: 'Ty i tak nic nie rozumiesz. Daj mi spokój.',
      },
    ],
    trigger: 'Gorąco uderza Ci do głowy. Ręka sama wyciąga się po ten telefon.',
    urge: 'Wyrwać telefon z ręki i ogłosić szlaban na miesiąc.',
    feel: ['anger', 'hurt', 'helpless', 'fear'],
    second: [
      'Złość mówi, że Ci zależy — na tym dziecku i na tym, co dalej ze szkołą.',
      'Za „daj mi spokój” może stać wstyd. Nikt nie lubi tłumaczyć się z jedynki.',
      'Szlaban rzucony w gniewie zamknie rozmowę, zanim się zacznie.',
    ],
    answer: 'Nie sięgasz po telefon. Mówisz spokojnie, co czujesz, i umawiacie się na rozmowę po kolacji.',
    answerSay: 'Martwię się o tę matmę i nie chcę krzyczeć. Pogadamy po kolacji?',
    outcome: {
      place: 'kitchen', people: [{ who: 'teenager', mood: 'sorry' }], heat: 0.2,
      text: 'Po kolacji drzwi pokoju się uchylają. Twoje dziecko siada przy stole z zeszytem.',
      say: 'Sorry. Ja serio nie ogarniam tych funkcji.',
    },
    lesson: 'Najpierw ochłoń, potem rozmawiaj. Rozmowa w gniewie zamienia się w kłótnię.',
    verse: 'jas1.19-20',
  },
  {
    id: 'mid.mama',
    age: 'mid',
    title: 'Wieczór u mamy',
    beats: [
      {
        place: 'meeting', people: [{ who: 'group', mood: 'busy' }], prop: 'phone', heat: 0.3,
        text: 'Ważne spotkanie w pracy. Telefon wibruje raz, drugi, trzeci. Wychodzisz w pół zdania, serce w gardle.',
        screen: 'Mama — 3 nieodebrane połączenia',
      },
      {
        place: 'corridor', prop: 'phone', heat: 0.48,
        text: 'Oddzwaniasz z korytarza. Nic się nie stało. Chodzi o pilota do telewizora.',
        say: 'Ten pilot znowu nie działa. Przyjedziesz dziś?',
      },
      {
        place: 'kitchen', people: [{ who: 'elder', mood: 'tired', sex: 'f' }], prop: 'bag', heat: 0.66,
        text: 'Wieczorem, po pracy i godzinie w korkach, wnosisz mamie zakupy do kuchni.',
        say: 'Nie te tabletki. Mówiłam przecież: w niebieskim pudełku.',
      },
      {
        place: 'kitchen', people: [{ who: 'elder', mood: 'cold', sex: 'f' }], heat: 0.88,
        text: 'Rozpakowujesz resztę. Mama wzdycha głośno w stronę okna.',
        say: 'Ty to nigdy nie masz dla mnie czasu. Inni mają dzieci jak dzieci.',
      },
    ],
    trigger: 'Coś ściska Cię w gardle. Siatka z zakupami nagle waży tonę.',
    urge: 'Wyliczyć wszystko, co dla niej robisz, i trzasnąć drzwiami.',
    feel: ['hurt', 'anger', 'tired', 'helpless'],
    second: [
      'To boli, bo dajesz naprawdę dużo. Twoje zmęczenie jest prawdziwe.',
      'Za tym wyrzutem może stać samotność. Mama cały dzień czekała na kogoś.',
      'Mamę też złości, że coraz mniej może sama. To nie tylko o Tobie.',
    ],
    answer: 'Odstawiasz siatkę i siadasz przy mamie. Dajesz jej kwadrans uwagi i mówisz uczciwie, ile możesz zostać.',
    answerSay: 'Mamo, jestem tu. Napijmy się herbaty. Za pół godziny muszę jechać.',
    outcome: {
      place: 'kitchen', people: [{ who: 'elder', mood: 'smile', sex: 'f' }], prop: 'cup', heat: 0.2,
      text: 'Mama nastawia czajnik. Jeszcze trochę narzeka, ale przy herbacie opowiada o sąsiadce i nawet się śmieje.',
    },
    lesson: 'Za wyrzutem często stoi lęk albo samotność. Odpowiedz na nie, nie na ton.',
    verse: 'pro15.1',
  },
  {
    id: 'mid.korek',
    age: 'mid',
    title: 'Korek na moście',
    beats: [
      {
        place: 'car', prop: 'clock', heat: 0.3,
        text: 'Jedziesz na wizytę, na którą czekasz od trzech miesięcy. Na moście korek, a nawigacja dolicza kolejne minuty.',
      },
      {
        place: 'car', people: [{ who: 'driver', mood: 'smirk', at: 'left', sex: 'm' }], heat: 0.5,
        text: 'Ktoś wciska się z sąsiedniego pasa tuż przed Twoją maskę. Hamujesz w ostatniej chwili.',
      },
      {
        place: 'car', heat: 0.68,
        text: 'Zielone. Ruszasz sekundę za późno i za Tobą zaczyna się koncert klaksonów.',
      },
      {
        place: 'car', people: [{ who: 'driver', mood: 'shout', at: 'right', sex: 'm' }], heat: 0.88,
        text: 'Na następnych światłach auto obok zrównuje się z Twoim. Szyba zjeżdża w dół.',
        say: 'Kto wam dał prawo jazdy?! Jedź albo zjedź!',
      },
    ],
    trigger: 'Dłonie bieleją na kierownicy. Serce wali, a szczęka zaciska się do bólu.',
    urge: 'Opuścić szybę, odpowiedzieć tym samym i pokazać mu na drodze.',
    feel: ['anger', 'fear', 'helpless'],
    second: [
      'Złość ma rację: to było chamskie. Ale nie musisz się tym zarażać.',
      'Ten kierowca nic o Tobie nie wie. Krzyczy z własnego stresu, nie na Ciebie.',
      'Dziś ważne jest jedno: dojechać cało na tę wizytę.',
    ],
    answer: 'Nie odpowiadasz. Wydłużasz wydech, puszczasz go przodem i przez zestaw głośnomówiący dzwonisz do przychodni.',
    answerSay: 'Dzień dobry, stoję w korku. Będę kwadrans później. Czy to coś zmienia?',
    outcome: {
      place: 'queue', people: [{ who: 'clerk', mood: 'smile' }], heat: 0.15,
      text: 'Docierasz z poślizgiem, ale w spokoju. W rejestracji ktoś się uśmiecha: lekarz też ma dziś opóźnienie.',
      say: 'Spokojnie, kolejka jeszcze długa.',
    },
    lesson: 'Na drodze nie musisz wygrywać. Wygrana to dojechać cało.',
    verse: 'pro14.29',
  },
  {
    id: 'mid.slajdy',
    age: 'mid',
    title: 'Cudze nazwisko na slajdzie',
    beats: [
      {
        place: 'office', people: [{ who: 'boss', mood: 'busy', at: 'right', sex: 'm' }], prop: 'laptop', heat: 0.3,
        text: 'Za dziesięć piąta. Szef staje przy Twoim biurku z kubkiem kawy.',
        say: 'Prezentacja dla zarządu na jutro, na ósmą. Ogarniesz?',
      },
      {
        place: 'kitchen', people: [{ who: 'partner', mood: 'cold' }], prop: 'plate', heat: 0.5,
        text: 'Wracasz po dziewiątej. Kolacja stygnie na talerzu, a w kuchni zapada ciężka cisza.',
        say: 'Dzieci pytały o ciebie. Znowu.',
      },
      {
        place: 'meeting', people: [{ who: 'boss', mood: 'smile', at: 'centre', sex: 'm' }, { who: 'group', mood: 'calm', at: 'left' }], heat: 0.68,
        text: 'Rano zarząd ogląda Twoje slajdy. Szef prowadzi prezentację, jakby była jego.',
      },
      {
        place: 'meeting', people: [{ who: 'boss', mood: 'smirk', sex: 'm' }], heat: 0.88,
        text: 'Prezes chwali analizę. Szef dziękuje z uśmiechem i nawet na Ciebie nie spojrzy.',
        say: 'Dziękuję. Musiałem to jeszcze mocno poprawić po zespole.',
      },
    ],
    trigger: 'Gorąco wspina się po szyi. Pięść zaciska się pod stołem.',
    urge: 'Przerwać mu przy wszystkich: to jest moja praca!',
    feel: ['anger', 'hurt', 'tired', 'helpless'],
    second: [
      'Ta złość ma powód: Twoja praca ma wartość. Warto o nią zadbać.',
      'Przy zarządzie zrobi się z tego scena. W cztery oczy masz większą szansę.',
      'Chodzi o następny raz: żeby pod Twoją pracą stało Twoje nazwisko.',
    ],
    answer: 'Milczysz do końca spotkania. Potem prosisz szefa o pięć minut i spokojnie mówisz, czego potrzebujesz.',
    answerSay: 'Zależy mi, żeby przy moich analizach było moje nazwisko. Możemy tak ustalić?',
    outcome: {
      place: 'corridor', people: [{ who: 'boss', mood: 'tired', sex: 'm' }], heat: 0.25,
      text: 'Szef marszczy brwi i chwilę milczy. Potem kiwa głową, choć bez entuzjazmu.',
      say: 'No dobrze. Następną przedstawiasz ty.',
    },
    lesson: 'Granicę stawiaj spokojnie i w cztery oczy. Tak łatwiej ją usłyszeć.',
    verse: 'pro19.11',
  },
  {
    id: 'mid.sasiad',
    age: 'mid',
    title: 'Wiertarka w sobotę',
    beats: [
      {
        place: 'bedroom', prop: 'clock', heat: 0.3,
        text: 'Sobota, 7:30. Po tygodniu nadgodzin wreszcie możesz pospać. Zza ściany wyje wiertarka.',
      },
      {
        place: 'kitchen', people: [{ who: 'child', mood: 'sad' }], prop: 'cup', heat: 0.5,
        text: 'Hałas budzi najmłodsze dziecko. Maluch płacze, kawa się wylewa, a za ścianą zaczyna się kucie.',
      },
      {
        place: 'corridor', people: [{ who: 'neighbour', mood: 'busy', sex: 'm' }], heat: 0.68,
        text: 'Pukasz do sąsiada. Otwiera cały w pyle, z wiertarką w ręku.',
        say: 'Jest po siódmej, mam prawo. Remont sam się nie zrobi.',
      },
      {
        place: 'corridor', people: [{ who: 'neighbour', mood: 'smirk', sex: 'm' }], heat: 0.88,
        text: 'Zaczynasz mówić o dziecku, ale sąsiad macha ręką i już zamyka drzwi.',
        say: 'Nie podoba się? Trzeba było kupić dom.',
      },
    ],
    trigger: 'Krew uderza do skroni. Pięść sama unosi się, żeby walić w drzwi.',
    urge: 'Walić w drzwi i krzyczeć na całą klatkę, że wzywasz policję.',
    feel: ['anger', 'tired', 'helpless'],
    second: [
      'Masz prawo do odpoczynku. On ma prawo do remontu. Jedno i drugie jest prawdą.',
      'Będziecie mieszkać ściana w ścianę jeszcze latami. Ta rozmowa coś zbuduje albo zepsuje.',
      'Może ekipa ma tylko weekendy. Nie znasz jego sytuacji.',
    ],
    answer: 'Wracasz do siebie i dajesz sobie godzinę. Potem pukasz jeszcze raz: z pytaniem, nie z zarzutem.',
    answerSay: 'Wiem, że remont musi być. Umówimy się na wiercenie od dziewiątej w weekendy?',
    outcome: {
      place: 'corridor', people: [{ who: 'neighbour', mood: 'tired', sex: 'm' }], heat: 0.2,
      text: 'Sąsiad wzdycha i ociera pył z czoła. Mruczy coś o ekipie, ale się zgadza.',
      say: 'Dobra. W soboty od dziewiątej. W tygodniu od ósmej.',
    },
    lesson: 'Pytanie o rozwiązanie działa lepiej niż oskarżenie.',
    verse: 'rom12.18',
  },
  {
    id: 'mid.urzad',
    age: 'mid',
    title: 'Brakuje jednego papieru',
    beats: [
      {
        place: 'street', prop: 'clock', heat: 0.25,
        text: 'Bierzesz dzień urlopu na sprawę w urzędzie. Parkujesz trzy ulice dalej i idziesz szybkim krokiem na ósmą.',
      },
      {
        place: 'queue', people: [{ who: 'group', mood: 'tired' }], prop: 'ticket', heat: 0.45,
        text: 'Z automatu wyskakuje bilet: A47. Na tablicy dopiero A12, a czynne są tylko dwa okienka.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'busy', sex: 'm' }], prop: 'paper', heat: 0.66,
        text: 'Po dwóch godzinach siadasz przy okienku. Urzędnik przegląda dokumenty i kręci głową.',
        say: 'Brakuje zaświadczenia z banku. Proszę przyjść jeszcze raz.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'cold', sex: 'm' }], heat: 0.88,
        text: 'Mówisz, że na stronie urzędu nic o tym nie ma. Urzędnik nawet nie podnosi wzroku.',
        say: 'Ja przepisów nie piszę. Następny numerek!',
      },
    ],
    trigger: 'Twarz płonie. Dłoń już się unosi, żeby trzasnąć w blat.',
    urge: 'Trzasnąć w blat i na cały głos zażądać kierownika.',
    feel: ['anger', 'helpless', 'tired'],
    second: [
      'Masz prawo się złościć: Twój czas jest ważny. Chodzi o to, by nie stracić go drugi raz.',
      'Urzędnik nie pisze przepisów, a codziennie zbiera za nie cudzą złość.',
      'Za tydzień ta sprawa może być załatwiona. Potrzebujesz konkretu, nie zwycięstwa.',
    ],
    answer: 'Bierzesz oddech i pytasz spokojnie o dwie rzeczy: czego dokładnie brakuje i czy można to dosłać przez internet.',
    answerSay: 'Rozumiem. Proszę zapisać, czego brakuje. Czy mogę to dosłać przez internet?',
    outcome: {
      place: 'queue', people: [{ who: 'clerk', mood: 'calm', sex: 'm' }], prop: 'paper', heat: 0.2,
      text: 'Urzędnik pierwszy raz na Ciebie patrzy. Wypisuje listę na kartce i dopisuje adres skrzynki podawczej.',
      say: 'Przez internet też można. Wtedy bez kolejki.',
    },
    lesson: 'Gdy system zawodzi, pytaj o następny krok. To oddaje Ci wpływ.',
    verse: 'col3.15',
  },
  {
    id: 'mid.wieczor',
    age: 'mid',
    title: 'Kto to ogarnie?',
    beats: [
      {
        place: 'kitchen', prop: 'paper', heat: 0.3,
        text: 'Wracasz po pracy i zakupach. Zlew pełen naczyń, na stole otwarty plecak, a w nim kartka ze szkoły.',
        screen: 'Jutro apel — biały strój obowiązkowy!',
      },
      {
        place: 'living', people: [{ who: 'partner', mood: 'calm' }], prop: 'remote', heat: 0.5,
        text: 'W pokoju gra telewizor. Twoja druga połowa leży na kanapie z pilotem w ręku.',
        say: 'O, jesteś. Co dziś na kolację?',
      },
      {
        place: 'living', people: [{ who: 'partner', mood: 'busy' }], heat: 0.68,
        text: 'Prosisz o pomoc: naczynia albo strój na jutro. Wzrok nie odrywa się od ekranu.',
        say: 'Zaraz. Kończy się mecz.',
      },
      {
        place: 'living', people: [{ who: 'partner', mood: 'smirk' }], heat: 0.88,
        text: 'Mówisz, że od rana nie masz chwili dla siebie. W odpowiedzi słyszysz westchnienie.',
        say: 'Trzeba było powiedzieć wcześniej. Skąd mam wiedzieć?',
      },
    ],
    trigger: 'W brzuchu zaciska się węzeł. Głos sam podnosi się o oktawę.',
    urge: 'Wyliczyć wszystko, co robisz w tym domu, od rana do nocy.',
    feel: ['anger', 'tired', 'hurt', 'helpless'],
    second: [
      'Złość pilnuje czegoś ważnego: niesiesz za dużo w pojedynkę.',
      'Może naprawdę nie widzi tego, co Tobie wydaje się oczywiste.',
      'Lista żalów skończy się kłótnią. Jedna jasna prośba ma szansę.',
    ],
    answer: 'Nie wyliczasz. Mówisz jednym zdaniem, jak Ci jest, i prosisz o jedną konkretną rzecz.',
    answerSay: 'Nie mam dziś siły na wszystko. Zrobisz kolację? Ja przygotuję strój.',
    outcome: {
      place: 'kitchen', people: [{ who: 'partner', mood: 'sorry' }], prop: 'plate', heat: 0.2,
      text: 'Telewizor gaśnie. Twoja druga połowa staje przy garnkach — trochę naburmuszona, ale staje.',
      say: 'Może w niedzielę spiszemy, kto co robi?',
    },
    lesson: 'Jedna konkretna prośba zamiast listy żalów.',
    verse: 'eph4.26',
  },
  {
    id: 'mid.rodzenstwo',
    age: 'mid',
    title: 'Ty masz bliżej',
    heavy: true,
    beats: [
      {
        place: 'clinic', people: [{ who: 'elder', mood: 'tired', sex: 'm' }], prop: 'ticket', heat: 0.3,
        text: 'Druga godzina w poczekalni z tatą. Wizyta miała być o dziesiątej, a numer na tablicy ani drgnie.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.48,
        text: 'Telefon brzęczy. Brat pisze, że znowu nie przyjedzie.',
        screen: 'Sorry, dziś nie dam rady. Daj znać, co lekarz.',
      },
      {
        place: 'clinic', people: [{ who: 'doctor', mood: 'busy', sex: 'm' }, { who: 'elder', mood: 'sad', at: 'left', sex: 'm' }], heat: 0.66,
        text: 'Lekarz mówi szybko, ponad głową taty, o kolejnych badaniach. Tata gubi się w słowach i patrzy na Ciebie.',
        say: 'Wszystko jest w zaleceniach. Kolejka czeka.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.88,
        text: 'Wieczorem dzwonisz do brata. Opowiadasz o badaniach, a w słuchawce słychać westchnienie.',
        say: 'No bo ty masz bliżej. Ja też mam swoje życie.',
      },
    ],
    trigger: 'Ściska Cię w piersi. Ręka z telefonem drży, oddech robi się płytki.',
    urge: 'Wykrzyczeć, że Ty też masz swoje życie, i rozłączyć się w pół słowa.',
    feel: ['hurt', 'anger', 'tired', 'fear'],
    second: [
      'Złość mówi: potrzebujesz pomocy. To uczciwa potrzeba, nie słabość.',
      'Może brat boi się patrzeć na chorobę taty i dlatego trzyma się z daleka.',
      'Tata potrzebuje was obojga. To ważniejsze niż to, kto ma rację.',
    ],
    answer: 'Zamiast wyrzutu mówisz, czego potrzebujesz. Prosisz o jedną stałą rzecz, którą brat może wziąć na siebie.',
    answerSay: 'Nie dam rady w pojedynkę. Weźmiesz czwartkowe wizyty? Resztę ogarnę.',
    outcome: {
      place: 'screen', prop: 'phone', heat: 0.25,
      text: 'Po drugiej stronie długa cisza, potem krótkie zdanie. Nie wszystko załatwione, ale już nie w pojedynkę.',
      say: 'Dobra. Czwartki są moje.',
    },
    lesson: 'Proś o konkretną pomoc. Zarzut zamyka drzwi, prośba je uchyla.',
    verse: '1pe5.7',
  },
  {
    id: 'mid.ekran',
    age: 'mid',
    title: 'Światło pod drzwiami',
    beats: [
      {
        place: 'living', prop: 'laptop', heat: 0.3,
        text: 'Wieczór. Kończysz jeszcze maile z pracy. Umowa w domu jest jasna: o dziesiątej telefony idą spać.',
      },
      {
        place: 'corridor', heat: 0.5,
        text: 'Wpół do dwunastej. Spod drzwi pokoju Twojego dziecka sączy się niebieskie światło ekranu.',
      },
      {
        place: 'bedroom', people: [{ who: 'teenager', mood: 'busy' }], prop: 'phone', heat: 0.68,
        text: 'Otwierasz drzwi. Pod kołdrą świeci telefon, a jutro o ósmej sprawdzian.',
        say: 'Jeszcze pięć minut. Wszyscy w klasie siedzą do pierwszej.',
      },
      {
        place: 'bedroom', people: [{ who: 'teenager', mood: 'smirk' }], heat: 0.88,
        text: 'Wyciągasz rękę po telefon. Twoje dziecko odsuwa się pod ścianę.',
        say: 'A ty? Ty też cały wieczór siedzisz w telefonie.',
      },
    ],
    trigger: 'Szczęka się zaciska. To zdanie parzy, bo trafia w punkt.',
    urge: 'Zabrać telefon siłą i krzyknąć, kto w tym domu ustala zasady.',
    feel: ['anger', 'shame', 'helpless', 'tired'],
    second: [
      'Złość mówi: zależy Ci na śnie i zdrowiu dziecka. To dobra troska.',
      'Wstyd też coś mówi: w tym zdaniu jest trochę prawdy. Można ją przyznać bez przegranej.',
      'Zasada, której trzymają się też dorośli, ma większą szansę niż zakaz z góry.',
    ],
    answer: 'Zostawiasz telefon w spokoju. Przyznajesz rację i proponujesz jedną zasadę dla wszystkich.',
    answerSay: 'Masz rację, ja też przesadzam. Od jutra oba telefony nocują w kuchni. Umowa?',
    outcome: {
      place: 'kitchen', people: [{ who: 'teenager', mood: 'calm' }], prop: 'phone', heat: 0.2,
      text: 'Następnego wieczoru przy ładowarce w kuchni leżą dwa telefony. Twoje dziecko mruczy, ale kładzie swój pierwsze.',
      say: 'To kto mnie rano obudzi?',
    },
    lesson: 'Zasada działa najlepiej, gdy obowiązuje także Ciebie.',
    verse: 'jas1.19',
  },
  {
    id: 'mid.mechanik',
    age: 'mid',
    title: 'Rachunek z warsztatu',
    beats: [
      {
        place: 'car', heat: 0.3,
        text: 'W drodze do pracy na desce rozdzielczej zapala się kontrolka hamulców. Warsztat masz po drodze.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'calm', sex: 'm' }], prop: 'keys', heat: 0.48,
        text: 'Oddajesz kluczyki i mówisz wyraźnie: tylko klocki hamulcowe, najwyżej czterysta złotych.',
        say: 'Jasne, zrobi się. Jutro do odbioru.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.68,
        text: 'Następnego dnia przychodzi SMS z warsztatu. Czytasz go dwa razy, bo nie wierzysz w tę liczbę.',
        screen: 'Klocki, tarcze, sprzęgło: 3 850 zł. Odbiór od 16:00.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'smirk', sex: 'm' }], prop: 'paper', heat: 0.88,
        text: 'W warsztacie mechanik podsuwa rachunek i stuka długopisem w kwotę.',
        say: 'Przy okazji zrobiliśmy. Kto się nie zna na autach, ten nie dyskutuje.',
      },
    ],
    trigger: 'Gorąco uderza w kark. Kluczyki wbijają się w zaciśniętą dłoń.',
    urge: 'Rzucić kluczykami w ladę i krzyknąć, że to zwykłe oszustwo.',
    feel: ['anger', 'helpless', 'fear', 'shame'],
    second: [
      'Złość mówi: ktoś zdecydował o Twoich pieniądzach bez pytania. To ważne.',
      'Nie musisz znać się na autach, żeby mieć prawo do ustaleń i rozpisanego rachunku.',
      'Konkretne pytania zadane spokojnie bronią pieniędzy lepiej niż krzyk.',
    ],
    answer: 'Nie rzucasz kluczykami. Spokojnie przypominasz, na co była zgoda, i prosisz o rozpisany rachunek i stare części.',
    answerSay: 'Zgoda była na klocki, do czterystu złotych. Proszę o rozpisany rachunek i stare części.',
    outcome: {
      place: 'queue', people: [{ who: 'clerk', mood: 'tired', sex: 'm' }], prop: 'paper', heat: 0.25,
      text: 'Mechanik marszczy brwi i dzwoni do szefa. Sprzęgło schodzi z rachunku do wyjaśnienia.',
      say: 'Dobra, sprzęgło wyjaśnimy. Klocki i tarcze zostają.',
    },
    lesson: 'Trzymaj się ustaleń i pytaj o konkret. Spokój pomaga bronić Twoich pieniędzy.',
    verse: 'rom12.21',
  },
  {
    id: 'mid.czat',
    age: 'mid',
    title: 'Czat rodziców',
    beats: [
      {
        place: 'bus', prop: 'phone', heat: 0.25,
        text: 'Wracasz autobusem z pracy. Czat rodziców z klasy Twojego dziecka puchnie: zbiórka na prezent.',
        screen: 'Rodzice 4b · 140 nowych wiadomości',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.45,
        text: 'Ktoś wkleja listę osób, które nie wpłaciły. Twoje nazwisko stoi na niej, choć przelew poszedł wczoraj.',
        screen: 'Jeszcze nie wpłacili: 5 osób. Przypominam!!!',
      },
      {
        place: 'kitchen', prop: 'phone', heat: 0.66,
        text: 'Przy kolacji piszesz krótko, że przelew już poszedł, a ciasta na festyn tym razem nie upieczesz.',
        screen: 'Przelew poszedł wczoraj. Ciasta tym razem nie dam rady.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.88,
        text: 'Odpowiedź przychodzi po minucie. Pod nią sypią się reakcje: sześć, potem osiem.',
        screen: 'Jak zwykle. Jedni robią, inni tylko piszą. · 8 reakcji',
      },
    ],
    trigger: 'Policzki płoną. Kciuki same wystukują długą, ostrą odpowiedź.',
    urge: 'Wysłać to na całą grupę i z hukiem wyjść z czatu.',
    feel: ['anger', 'hurt', 'shame', 'tired'],
    second: [
      'Złość mówi, że oceniono Cię niesprawiedliwie, przy wszystkich. To naprawdę boli.',
      'Na czacie nie słychać tonu. To, co wyślesz teraz, zostanie tam na długo.',
      'Większość rodziców tylko czyta. Nie musisz przekonywać wszystkich.',
    ],
    answer: 'Kasujesz długą odpowiedź. Odkładasz telefon do rana, a potem piszesz jedno spokojne zdanie.',
    answerSay: 'Przelew jest od wczoraj na koncie. Ciasto upiekę następnym razem. Dzięki za organizację!',
    outcome: {
      place: 'screen', prop: 'phone', heat: 0.15,
      text: 'Rano pod Twoją wiadomością kilka serduszek. Jedna z mam pisze do Ciebie prywatnie.',
      screen: 'Mam tak samo. Nie przejmuj się, to tylko czat.',
    },
    lesson: 'W złości nie wysyłaj. Napisz rano, jednym spokojnym zdaniem.',
    verse: 'pro16.24',
  },
  {
    id: 'mid.kolega',
    age: 'mid',
    title: 'Jeszcze tylko jutro',
    beats: [
      {
        place: 'office', people: [{ who: 'colleague', mood: 'calm', sex: 'm' }], heat: 0.3,
        text: 'Poniedziałek. Wspólny raport dla klienta na czwartek. Kolega bierze swoją część i obiecuje środę.',
        say: 'Spoko, w środę masz wszystko.',
      },
      {
        place: 'screen', prop: 'phone', heat: 0.5,
        text: 'Środa, dziewiąta wieczorem. Twoja część czeka od rana, od kolegi ani pliku. Wreszcie wiadomość.',
        screen: 'Jutro rano, sorry, urwanie głowy!',
      },
      {
        place: 'meeting', people: [{ who: 'boss', mood: 'cold' }, { who: 'client', mood: 'busy', at: 'left' }], heat: 0.68,
        text: 'Czwartek, spotkanie. Klient czeka na liczby, których nie ma. Szef patrzy prosto na Ciebie.',
        say: 'Dlaczego to nie jest gotowe? Odpowiadacie za to razem.',
      },
      {
        place: 'corridor', people: [{ who: 'colleague', mood: 'smirk', sex: 'm' }], heat: 0.88,
        text: 'Po spotkaniu kolega wzrusza ramionami i uśmiecha się, jakby nic się nie stało.',
        say: 'No co, wyszło, jak wyszło. Nikt nie umarł.',
      },
    ],
    trigger: 'Krew uderza do głowy. Dłoń zaciska się na teczce z Twoją gotową częścią.',
    urge: 'Pójść prosto do szefa i wyliczyć wszystko, co ten kolega zawalił w tym roku.',
    feel: ['anger', 'helpless', 'tired', 'hurt'],
    second: [
      'Złość mówi: zależy Ci na rzetelnej pracy i na Twoim dobrym imieniu.',
      'Może tonie w czymś, o czym nie wiesz. To nie zwalnia z umowy, ale zmienia rozmowę.',
      'Za miesiąc przyjdzie następny projekt. Lepiej ustalić zasady, niż wygrać tę rundę.',
    ],
    answer: 'Mówisz koledze wprost, jak to na Ciebie wpłynęło, i proponujesz terminy pośrednie na następny raz.',
    answerSay: 'Przez to świecę oczami przed szefem. Następnym razem: wtorek szkic, czwartek całość?',
    outcome: {
      place: 'corridor', people: [{ who: 'colleague', mood: 'sorry', sex: 'm' }], heat: 0.2,
      text: 'Uśmiech znika. Kolega milknie, a potem mówi cicho, co się u niego dzieje.',
      say: 'Masz rację, przepraszam. Ojciec jest w szpitalu, nie ogarniam. Wtorek dam radę.',
    },
    lesson: 'Powiedz, jak coś na Ciebie wpływa, i umów konkretny termin. To buduje współpracę.',
    verse: 'mat5.9',
  },
];
