/**
 * Stop-klatka — the stories for 11–19 (Polish, the source; en/de/sv in stories-teen.<lang>.ts).  Contract: ./story.ts.
 *
 * Children and youth: school and grades, a group project, PE, the bus home, a younger sibling, a parent and the phone;
 * exclusion and a mocking meme only as `heavy`, each ending with a trusted adult.  No romance, alcohol, drugs, sex or
 * self-harm.  Second person present tense, no gendered forms (narration capitalised: Ci/Cię/Twój; speech lowercase).
 */
import type { Story } from './story';

export const STORIES_TEEN: readonly Story[] = [
  {
    id: 'teen.test',
    age: 'teen',
    title: 'Kartkówka',
    beats: [
      {
        place: 'classroom', prop: 'paper', heat: 0.2,
        text: 'Cały wczorajszy wieczór nad matmą. Rano wzory wydają się jasne jak nigdy.',
      },
      {
        place: 'classroom', people: [{ who: 'teacher', mood: 'busy' }], prop: 'paper', heat: 0.4,
        text: 'Kartkówki wracają. Twoja ląduje na ławce, cała w czerwonych poprawkach.',
        screen: '2 · Więcej staranności!',
      },
      {
        place: 'classroom', people: [{ who: 'peer', mood: 'smirk', at: 'right' }], heat: 0.6,
        text: 'Ktoś z ławki obok zagląda Ci przez ramię i parska śmiechem na całą klasę.',
        say: 'Dwója? Tyle nauki i dwója?',
      },
      {
        place: 'classroom', people: [{ who: 'teacher', mood: 'cold' }], prop: 'paper', heat: 0.8,
        text: 'Przy biurku pytasz, gdzie jest błąd. Odpowiedź pada głośno, żeby słyszała cała klasa.',
        say: 'Gdzie? Wszędzie. Może mniej telefonu, więcej nauki.',
      },
    ],
    trigger: 'Uszy płoną, w brzuchu ściska. Słowa same podchodzą do gardła.',
    urge: 'Odpyskować przy wszystkich i trzasnąć kartkówką o ławkę.',
    feel: ['shame', 'anger', 'hurt'],
    second: [
      'Złość broni czegoś ważnego: Twojej pracy, której nikt nie widział.',
      'Jedna kartkówka mówi o jednej kartkówce. Nie o Tobie.',
      'Odpowiedź przy klasie to scena. Rozmowa po lekcji to szansa.',
    ],
    answer: 'Bierzesz oddech i mówisz spokojnie, że chcesz to zrozumieć. Prosisz o pięć minut po lekcji.',
    answerSay: 'Uczę się, naprawdę. Możemy po lekcji przejrzeć błędy? Chcę wiedzieć, co poprawić.',
    outcome: {
      place: 'classroom', people: [{ who: 'teacher', mood: 'calm' }], prop: 'paper', heat: 0.2,
      text: 'Po dzwonku przy biurku jest już inny ton. Dwa pomylone znaki, nic więcej, i termin poprawy w czwartek.',
      say: 'Dobrze, że pytasz. Poprawa w czwartek.',
    },
    lesson: 'Pytanie zamiast pyskówki to też odwaga.',
    verse: 'pro14.29',
  },
  {
    id: 'teen.project',
    age: 'teen',
    title: 'Projekt na jutro',
    beats: [
      {
        place: 'bedroom', prop: 'laptop', heat: 0.2,
        text: 'Wieczór. Prezentacja z biologii na jutro, grupa czteroosobowa. Otwierasz wspólny plik: są tylko Twoje slajdy.',
      },
      {
        place: 'screen', heat: 0.4,
        text: 'Piszesz na czacie grupy: kto robi resztę? Cisza. Po kwadransie ktoś wrzuca mema i trzy uśmiechy.',
        screen: 'kto robi resztę? jutro oddajemy',
      },
      {
        place: 'screen', heat: 0.6,
        text: 'O 22:40 przychodzi wiadomość. Czytasz ją dwa razy.',
        screen: 'ty to ogarniesz, nie? ty zawsze ogarniasz',
      },
      {
        place: 'screen', heat: 0.8,
        text: 'Ktoś dopisuje, że jutro chętnie poprowadzi prezentację. Twoje slajdy, cudzy głos.',
        screen: 'ja mogę jutro mówić, luz',
      },
    ],
    trigger: 'Gorąco uderza Ci do twarzy. Kciuki już stukają w ekran, szybciej niż myśli.',
    urge: 'Napisać do całej grupy coś, co zaboli, i wyjść z czatu.',
    feel: ['anger', 'helpless', 'tired'],
    second: [
      'Ta złość ma sens: zależy Ci na uczciwym podziale pracy.',
      'Nie musisz dziś ratować wszystkich. Możesz zrobić swoją część i powiedzieć, jak jest.',
      'Za tydzień nikt nie będzie pamiętać tego czatu. Ty zapamiętasz, czy umiesz spokojnie powiedzieć: dość.',
    ],
    answer: 'Piszesz krótko i bez wyzwisk: Twoja część jest zrobiona, reszta do 23:30, a jutro każdy mówi swoje slajdy.',
    answerSay: 'Moje slajdy są w pliku. Każdy robi swoje dwa do 23:30 i jutro je mówi.',
    outcome: {
      place: 'screen', heat: 0.25,
      text: 'Dwie osoby dorzucają slajdy przed północą, trzecia milczy. Rano mówisz swoją część pewnym głosem.',
      screen: 'ok, sorry, już robię',
    },
    lesson: 'Granica powiedziana spokojnie działa lepiej niż wybuch na czacie.',
    verse: 'pro15.1',
  },
  {
    id: 'teen.sibling',
    age: 'teen',
    title: 'Słuchawki',
    beats: [
      {
        place: 'bedroom', heat: 0.15,
        text: 'Wracasz ze szkoły. Drzwi do Twojego pokoju są otwarte, choć rano je zamykasz.',
      },
      {
        place: 'bedroom', people: [{ who: 'sibling', mood: 'smirk' }], heat: 0.35,
        text: 'Młodsze rodzeństwo siedzi na Twoim łóżku, w Twoich słuchawkach. Na pałąku widać świeże pęknięcie.',
        say: 'Co? Przecież nic się nie stało.',
      },
      {
        place: 'living', people: [{ who: 'parent', mood: 'tired' }], heat: 0.6,
        text: 'Idziesz do salonu pokazać pęknięcie. Słyszysz tylko westchnienie znad laptopa.',
        say: 'Nie rób afery, to jeszcze dziecko.',
      },
      {
        place: 'living', people: [{ who: 'parent', mood: 'cold' }, { who: 'sibling', mood: 'smirk', at: 'right' }], heat: 0.8,
        text: 'Zza pleców rodzica młodsze rodzeństwo pokazuje Ci język. I jeszcze zdanie, które słyszysz zawsze:',
        say: 'Ty masz więcej rozumu. Odpuść.',
      },
    ],
    trigger: 'Szczęka się zaciska, w gardle rośnie krzyk. Dłoń z pękniętymi słuchawkami drży.',
    urge: 'Wrzasnąć, że nikt Cię tu nie słucha, i rzucić słuchawkami o podłogę.',
    feel: ['anger', 'hurt', 'helpless'],
    second: [
      'Złość mówi: Twoje rzeczy i Twój pokój są dla Ciebie ważne. To uczciwa potrzeba.',
      'W tym zmęczeniu przy laptopie nie ma decyzji przeciw Tobie. Jest za mało sił na dziś.',
      'Krzyk teraz zmieni temat: z pękniętych słuchawek na Twój krzyk.',
    ],
    answer: 'Odkładasz słuchawki na stół i mówisz cicho, patrząc w oczy. Prosisz o jedną zasadę i rozmowę wieczorem.',
    answerSay: 'Nie robię afery. Proszę o zasadę: do mojego pokoju nikt nie wchodzi bez pytania.',
    outcome: {
      place: 'living', people: [{ who: 'parent', mood: 'sorry' }], heat: 0.25,
      text: 'Wieczorem jest zgoda na zasadę. Słuchawek to nie sklei, ale drzwi do pokoju znów są Twoje.',
      say: 'Masz rację. Ustalmy to razem.',
    },
    lesson: 'Mów o tym, czego potrzebujesz, a nie o tym, kto jest winny.',
    verse: 'jas1.19',
  },
  {
    id: 'teen.bus',
    age: 'teen',
    title: 'Autobus po lekcjach',
    beats: [
      {
        place: 'bus', prop: 'bag', heat: 0.25,
        text: 'Po siedmiu lekcjach wsiadasz do zatłoczonego autobusu. Siadasz, plecak na kolanach, oczy same się zamykają.',
      },
      {
        place: 'bus', people: [{ who: 'stranger', mood: 'angry' }], heat: 0.55,
        text: 'Nad Tobą staje ktoś starszy z ciężkimi siatkami. Zanim otworzysz oczy, słyszysz na pół autobusu:',
        say: 'Ta dzisiejsza młodzież! Siedzi i udaje, że śpi.',
      },
      {
        place: 'bus', people: [{ who: 'group', mood: 'cold' }], heat: 0.8,
        text: 'Kilka głów odwraca się w Twoją stronę. Ktoś kręci głową z politowaniem.',
      },
    ],
    trigger: 'Gorąco wylewa się na kark. Serce wali, jakby ktoś Cię przyłapał na czymś, czego nie robisz.',
    urge: 'Odburknąć coś ostrego i zostać na miejscu, na złość.',
    feel: ['shame', 'anger', 'tired'],
    second: [
      'Ktoś ocenia Cię, zanim Cię zobaczy. Złość ma powód: to boli i ma prawo boleć.',
      'Ten ktoś stoi z ciężkimi siatkami i też ma za sobą długi dzień.',
      'Nie musisz udowadniać, że to zdanie było niesprawiedliwe. Wystarczy zrobić to, co uważasz za dobre.',
    ],
    answer: 'Wstajesz, robisz miejsce i mówisz zwyczajnie, bez kpiny. Plecak bierzesz na ramię.',
    answerSay: 'Proszę usiąść. Oczy zamykam po prostu ze zmęczenia.',
    outcome: {
      place: 'bus', people: [{ who: 'stranger', mood: 'cold' }, { who: 'peer', mood: 'smile', at: 'right' }], heat: 0.2,
      text: 'Słyszysz tylko krótkie „no” zamiast „dziękuję”. Za to ktoś z boku uśmiecha się do Ciebie znad telefonu.',
    },
    lesson: 'Cudze zdanie o Tobie nie musi decydować o tym, co robisz.',
    verse: 'rom12.21',
  },
  {
    id: 'teen.phone',
    age: 'teen',
    title: 'Ostatnia runda',
    beats: [
      {
        place: 'bedroom', prop: 'phone', heat: 0.2,
        text: 'Gracie w czwórkę z ludźmi z klasy. Ostatnia runda, remis, wszyscy krzyczą w słuchawkach.',
        screen: 'RUNDA 5 · 2 : 2',
      },
      {
        place: 'bedroom', prop: 'phone', heat: 0.4,
        text: 'Z kuchni wołanie na kolację. Odkrzykujesz: jeszcze pięć minut! Naprawdę tylko pięć.',
      },
      {
        place: 'bedroom', people: [{ who: 'parent', mood: 'angry' }], heat: 0.65,
        text: 'Drzwi się otwierają. W progu ktoś stoi z rękami na biodrach.',
        say: 'Pięć minut było dwadzieścia minut temu.',
      },
      {
        place: 'screen', heat: 0.85,
        text: 'Ekran zastyga. Wi-Fi wyłączone w połowie akcji. Na czacie drużyny pojawia się wiadomość.',
        screen: 'halo?? gdzie jesteś? przegrana. dzięki',
      },
    ],
    trigger: 'Krew uderza do głowy. Ręka sama unosi się z telefonem, jakby chciała nim rzucić.',
    urge: 'Cisnąć telefonem w łóżko i krzyknąć, że ktoś tu niszczy Ci życie.',
    feel: ['anger', 'shame', 'helpless'],
    second: [
      'Za tą złością stoi coś dobrego: drużyna była dla Ciebie ważna.',
      'Dwadzieścia minut przy stygnącej kolacji to też było czyjeś czekanie.',
      'Za tydzień tej rundy nikt nie będzie pamiętać. Słowa rzucone dziś w kuchni zostaną dłużej.',
    ],
    answer: 'Piszesz drużynie jedno zdanie i idziesz na kolację. Przy stole mówisz, co było nie fair, i proponujesz zasadę.',
    answerSay: 'Głupio mi przed drużyną. Mów proszę dziesięć minut wcześniej, a ja kończę po rundzie.',
    outcome: {
      place: 'kitchen', people: [{ who: 'parent', mood: 'calm' }], prop: 'plate', heat: 0.2,
      text: 'Kolacja jest letnia, rozmowa krótka. Ustalacie: znak dziesięć minut przed końcem i koniec gry po rundzie.',
      say: 'Dobra. Ale jak mówię „koniec”, to koniec.',
    },
    lesson: 'Gdy przegrywasz grę, nie przegrywaj jeszcze rozmowy.',
    verse: 'col3.15',
  },
  {
    id: 'teen.pe',
    age: 'teen',
    title: 'Siatkówka na WF-ie',
    beats: [
      {
        place: 'gym', people: [{ who: 'group', mood: 'busy' }], heat: 0.15,
        text: 'WF, siatkówka. Dwie osoby wybierają składy. Twoje imię wciąż nie pada.',
      },
      {
        place: 'gym', people: [{ who: 'peer', mood: 'tired' }], heat: 0.35,
        text: 'Trafiasz do drużyny prawie na końcu. Ktoś wzdycha tak, żeby było słychać.',
        say: 'No trudno, bierzemy.',
      },
      {
        place: 'gym', people: [{ who: 'peer', mood: 'angry' }], heat: 0.6,
        text: 'Piłka leci prosto na Ciebie. Odbijasz ją w aut. Drużyna jęczy chórem.',
        say: 'Serio?! Taka łatwa piłka!',
      },
      {
        place: 'gym', people: [{ who: 'peer', mood: 'shout' }, { who: 'group', mood: 'smirk', at: 'right' }], heat: 0.8,
        text: 'Przy zmianie stron ktoś rzuca przez całą salę, a kilka osób się śmieje.',
        say: 'Weź się ogarnij! Przez ciebie przegrywamy!',
      },
    ],
    trigger: 'Policzki płoną. Palce zaciskają się na piłce tak mocno, że aż bolą.',
    urge: 'Rzucić piłką w tę osobę i zejść z boiska.',
    feel: ['shame', 'anger', 'hurt'],
    second: [
      'Złość mówi: chcesz być częścią drużyny, a nie jej żartem. To ważna potrzeba.',
      'Za pięć minut gra toczy się dalej. Piłka rzucona w kogoś zostanie dłużej niż jedna zła piłka.',
      'Każdy na tej sali boi się czasem, że wypadnie śmiesznie. Także ten, kto teraz krzyczy.',
    ],
    answer: 'Puszczasz piłkę, prostujesz się i mówisz głośno, ale spokojnie. Potem wracasz na swoje miejsce.',
    answerSay: 'Dobra, ta piłka była słaba. Ale krzyczeć na mnie nie musisz.',
    outcome: {
      place: 'gym', people: [{ who: 'friend', mood: 'smile' }], heat: 0.25,
      text: 'Śmiech cichnie. Przy następnej akcji odbijasz czysto. Po lekcji ktoś z drużyny klepie Cię w ramię.',
      say: 'Ładnie z tą zagrywką na koniec.',
    },
    lesson: 'Możesz przyznać się do błędu i nie oddać nikomu swojej godności.',
    verse: 'jas1.19-20',
  },
  {
    id: 'teen.left',
    age: 'teen',
    title: 'Zdjęcie bez Ciebie',
    heavy: true,
    beats: [
      {
        place: 'bedroom', prop: 'phone', heat: 0.2,
        text: 'Sobotni wieczór. Przewijasz relacje i nagle widzisz znajome twarze: cała Twoja paczka w kinie.',
        screen: 'kino z ekipą · 21:14',
      },
      {
        place: 'screen', heat: 0.4,
        text: 'Na czacie paczki od tygodnia cisza. Pod zdjęciem ktoś pisze o „naszej grupie”. Nie znasz takiej grupy.',
        screen: 'dzięki ekipa, nasza grupa najlepsza',
      },
      {
        place: 'corridor', people: [{ who: 'group', mood: 'smirk' }], heat: 0.65,
        text: 'W poniedziałek na korytarzu podchodzisz do nich. Rozmowa urywa się w pół słowa.',
      },
      {
        place: 'corridor', people: [{ who: 'peer', mood: 'smirk' }, { who: 'group', mood: 'smirk', at: 'right' }], heat: 0.85,
        text: 'Ktoś uśmiecha się krzywo i mówi tak, żeby wszyscy słyszeli.',
        say: 'Oj, nie mówiliśmy ci? Sorki, zapomnieliśmy.',
      },
    ],
    trigger: 'W gardle staje gula. Oczy pieką, a dłonie aż drżą, żeby coś zrobić.',
    urge: 'Powiedzieć coś okropnego o każdym z nich albo uciec i nigdy więcej nie podejść.',
    feel: ['hurt', 'anger', 'shame'],
    second: [
      'Ból i złość mówią prawdę: wykluczanie rani. To nie jest przewrażliwienie.',
      'To, że ktoś Cię pomija, mówi więcej o tej grupie niż o Tobie.',
      'Nie musisz tego dźwigać w pojedynkę. Są dorośli, którym można o tym powiedzieć.',
    ],
    answer: 'Nie odpowiadasz na zaczepkę. Odchodzisz spokojnym krokiem, a po lekcjach mówisz o tym komuś dorosłemu, komu ufasz.',
    outcome: {
      place: 'classroom', people: [{ who: 'teacher', mood: 'calm' }], heat: 0.25,
      text: 'Po lekcjach idziesz do pedagoga szkolnego. Słucha Cię do końca. Ból nie znika od razu, ale nie jest już tylko Twój.',
      say: 'Dobrze, że przychodzisz. Zajmiemy się tym razem.',
    },
    lesson: 'Wykluczenie to nie Twoja wina. Powiedz o nim dorosłemu, któremu ufasz.',
    verse: '1pe5.7',
  },
  {
    id: 'teen.meme',
    age: 'teen',
    title: 'Mem na czacie klasy',
    heavy: true,
    beats: [
      {
        place: 'classroom', prop: 'phone', heat: 0.2,
        text: 'Na przerwie telefon wibruje raz, drugi, dziesiąty. Czat klasy ożywa jak nigdy.',
        screen: 'Czat klasy · 34 nowe wiadomości',
      },
      {
        place: 'screen', heat: 0.45,
        text: 'Ktoś wrzuca zdjęcie: Ty przy tablicy, z przekrzywioną miną, i podpis, który ma być zabawny.',
        screen: 'kiedy myślisz, że umiesz xD',
      },
      {
        place: 'screen', heat: 0.65,
        text: 'Pod spodem lawina reakcji. Nawet osoba, z którą siedzisz w ławce, daje serduszko.',
        screen: '27 reakcji · 12 odpowiedzi',
      },
      {
        place: 'corridor', people: [{ who: 'group', mood: 'smirk' }], heat: 0.85,
        text: 'Wychodzisz na korytarz. Ktoś podnosi telefon i robi tę samą minę. Śmiech.',
        say: 'Zrób jeszcze raz tę minę!',
      },
    ],
    trigger: 'Twarz płonie, w uszach szum. Pięści same się zaciskają, a nogi chcą biec.',
    urge: 'Wyrwać ten telefon albo wrzucić na czat coś jeszcze gorszego o nich.',
    feel: ['shame', 'anger', 'hurt'],
    second: [
      'To nie jest żart. Złość ma rację: ktoś przekracza granicę.',
      'Nie musisz odpowiadać tym samym. Zemsta wciągnie Cię w tę samą grę.',
      'Zrzut ekranu i rozmowa z dorosłym to nie skarżenie. To dbanie o siebie.',
    ],
    answer: 'Nie wchodzisz w tę grę. Mówisz jedno spokojne zdanie, robisz zrzut ekranu i idziesz do kogoś dorosłego.',
    answerSay: 'To nie jest śmieszne. Usuń to zdjęcie.',
    outcome: {
      place: 'corridor', people: [{ who: 'teacher', mood: 'calm' }], heat: 0.25,
      text: 'Osoba dorosła, której ufasz, ogląda zrzut i mówi, co zrobi dalej. Wstyd jeszcze piecze, ale nie zostajesz z tym w pojedynkę.',
      say: 'Dziękuję, że mówisz. To nie twoja wina.',
    },
    lesson: 'Na przemoc w sieci nie odpowiadaj zemstą: zapisz dowód i powiedz dorosłemu.',
    verse: '2ti1.7',
  },
];
