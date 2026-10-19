/**
 * The story of HolyHolyHoly 3D (Polish): a guardian angel and the person under its protection,
 * a man or a woman in today's Poland, chosen by the player (Adam or Ewa by default, after the
 * Anastasis icon, where Christ raises Adam and Eve by the wrist).
 *
 * Ten chapters climb the Ladder (St John Climacus' icon of the Ladder of Divine Ascent). Each one:
 * a situation of the 2020s built on what research says hurts men and women most (sources in
 * DESIGN.md), the shadow-thoughts it breeds, the stronghold of one lie, a Gospel encounter in
 * which Christ comes to heal, a thought to transform (choose the balanced one, not the distorted
 * nor the sugar-coated), and one real skill to take into life.
 *
 * Christ is never playable, never a power: He comes, speaks His own words (Gdańsk Bible,
 * verbatim, with the reference) and the person answers. Text conventions: see game-data.mjs.
 */

// speakers: narrator, person ({imie}), angel (the player's archangel), christ, scripture
const N = (text, panel) => ({ who: 'narrator', text, ...(panel ? { panel } : {}) });
const P = text => ({ who: 'person', text });
const A = text => ({ who: 'angel', text });
const C = (ref, cut = {}) => ({ who: 'christ', verse: { ref, ...cut } });
const S = (ref, cut = {}, intro = '', panel) => ({ who: 'scripture', verse: { ref, ...cut }, text: intro, ...(panel ? { panel } : {}) });

export const PROLOGUE = [
  S('Ps 91,11', {}, 'Tak zaczyna się każda historia, w której ktoś czuwa.', 'prolog-{m|f}'),
  N('Rok 2026. {imie} ma trzydzieści kilka lat, mieszka w bloku, pracuje, odpisuje na wiadomości. Z zewnątrz wszystko w porządku. Od miesięcy źle śpi.'),
  N('Nikt tego nie widzi, ale myśli, które szepczą w ciemności, mają kształt cieni. Każdy cień kłamie trochę inaczej. Za nimi stoją twierdze: kłamstwa, w które {imie} {uwierzył|uwierzyła}.'),
  N('Bóg powierza ci {tego mężczyznę|tę kobietę}. Nie po to, żebyś walczył zamiast {niego|niej}, ale żebyś stał obok, kiedy {on sam|ona sama} uczy się rozpoznawać kłamstwa i wybierać prawdę.'),
  N('Rozbite cienie zostawią po sobie prawdziwe słowa. Twierdze upadną. A w najciemniejszej chwili nie przyjdziesz {mu|jej} na pomoc sam.'),
];

export const FALL = {
  panel: 'christ-hand',
  lines: [
    '{imie} upada pod ciężarem cieni. Ale Ktoś już wyciąga rękę.',
    'Upadek nie jest końcem. On podaje rękę, zanim zdążysz poprosić.',
    'Siedem razy, siedemdziesiąt siedem razy: za każdym razem wstajemy.',
    'Nie ma w tym wstydu. Odpocznij chwilę i spróbuj jeszcze raz.',
    'Cień szepcze: „To koniec”. Bóg mówi: „To dopiero początek”.',
  ],
  verses: [{ ref: 'Mi 7,8', from: 'jeźlim' }, { ref: 'Prz 24,16', to: 'powstaje' }, { ref: 'Ps 37,24' }, { ref: 'Mt 14,31', to: 'uchwycił go' }],
  button: 'Chwyć Jego dłoń',
};

/** Help that is real: shown on first launch, in the pause menu, before heavy chapters and with any crisis thought. Verified October 2026. */
export const HELPLINES = [
  { number: '116 123', text: 'Telefon zaufania dla dorosłych w kryzysie emocjonalnym, całą dobę (czat: 116sos.pl)' },
  { number: '800 70 2222', text: 'Centrum Wsparcia dla osób w kryzysie psychicznym, całą dobę (centrumwsparcia.pl)' },
  { number: '116 111', text: 'Telefon zaufania dla dzieci i młodzieży, całą dobę (116111.pl)' },
  { number: '800 120 002', text: 'Niebieska Linia: pomoc dla osób doznających przemocy domowej, całą dobę' },
  { number: '112', text: 'Zagrożenie życia: numer alarmowy' },
];

export const DISCLAIMER = 'HolyHolyHoly to gra o nadziei. Opowiada o prawdziwych zranieniach, ale nie jest terapią ani leczeniem i nie zastąpi specjalisty. Narzędzia, których uczy, pochodzą z terapii poznawczo-behawioralnej i są sprawdzone w badaniach, ale najlepiej działają z drugim człowiekiem: przyjacielem, duszpasterzem, psychologiem, lekarzem. Sięgnięcie po pomoc to odwaga, nie słabość. Wiara nie zastępuje lekarza, a lekarz nie zastępuje wiary.';

export const SUPPORT = {
  url: 'https://buymeacoffee.com/atd_uriel',
  title: 'Wesprzyj twórcę',
  text: 'HolyHolyHoly jest darmowe, bez reklam i bez zbierania danych. Jeśli gra coś w tobie poruszyła i chcesz, żeby powstawały kolejne rozdziały, możesz postawić twórcy kawę.',
  button: 'Postaw kawę ☕',
};

export const FINALE = [
  'Ostatnia twierdza upada. Na drabinie, po której {imie} wspinał{|a} się szczebel po szczeblu, nie ma już cieni. Są blizny. I prawdy znalezione po drodze.',
  'Rany nie zniknęły bez śladu, ale przestały rządzić. {imie} ma narzędzia, ludzi i Kogoś, kto zszedł po {niego|nią} na samo dno.',
  'Stajesz przed tronem razem z niezliczonymi aniołami. Serafini zakrywają twarze skrzydłami i wołają: „Święty, święty, święty”.',
  'Dziękujemy za wspólną drogę. Jeśli coś z tej gry zostanie z tobą, niech to będzie to: nie musisz iść przez to w pojedynkę, a prośba o pomoc to początek, nie koniec.',
];

export const HOW_TO = [
  'Ruch: WASD / strzałki albo lewy kciuk. Gdy stoisz w miejscu, twój archanioł sam atakuje najbliższy cień (to jego dar, a moc rośnie z poziomem).',
  'Cios: spacja / J albo przycisk z gwiazdą. Uderzaj seriami, zanim cień podejdzie. Pudło przerywa serię.',
  'Modlitwa: E / K albo przycisk z ikoną archanioła. Ładuje się, gdy stoisz w ciszy (albo z opaską Mendi) i gdy cienie pękają.',
  'Co poziom wybierasz dar albo cnotę (najwyżej po cztery). Dar na najwyższym poziomie i jego cnota dają złotą kartę: ewolucję.',
  'Rozbity cień zostawia prawdziwe zdanie. Czytaj je: to nie dekoracja, tylko sedno gry.',
];

// the painted floors are rich: a darker tint keeps the figures readable on them
const look = (background, fog, sky, ground, floor = '150;144;138') => ({ background, fog, sky, ground, floor });

/**
 * The chapters, bottom of the Ladder to the top. track: the Psalm 150 piece. enemies: shadow kinds.
 * story.intro / story.heal: scenes (panel per line where it changes). cbt: the thought record of
 * the Revelation; options are distorted / sugar-coated / balanced, in this order (the game
 * shuffles them). tool: the skill learned, with an everyday practice.
 */
export const CHAPTERS = [
  {
    id: 'noc', title: 'Noc', theme: 'Lęk i panika',
    place: '{Warszawa, blok na Woli, 3:12 w nocy|Wrocław, tramwaj w godzinach szczytu}',
    track: 'bina', floor: 'floor-noc', look: look('12;14;30', '18;22;44', '200;210;255', '40;40;70'),
    enemies: ['lek', 'zwatpienie', 'samotnosc'],
    boss: { name: 'Twierdza Paniki', hp: 60, lie: '{Zaraz umrę i nikt mi nie pomoże.|Zaraz zwariuję i wszyscy to zobaczą.}' },
    fact: 'Zaburzenia lękowe to najczęstsze problemy psychiczne na świecie. W Polsce napady paniki ma 8,5% kobiet i 3,9% mężczyzn (EZOP).',
    warning: '',
    story: {
      intro: [
        N('{Trzecia w nocy. {imie} siedzi na brzegu łóżka. Serce wali, ręce drętwieją, a w telefonie wciąż te same nagłówki: wojna za granicą, zwolnienia, ceny. Od rozwodu mieszka sam.|Tramwaj w godzinach szczytu. {imie} ściska poręcz. Duszno, serce wali, świat nagle robi się za ciasny. Rok temu przeprowadziła się do Wrocławia, za mężem i za pracą.}', 'noc-{m|f}'),
        P('{To zawał. Na pewno zawał.|Zaraz zemdleję. Zaraz zwariuję.}'),
        N('To atak paniki. Przeraża, ale nie zabija i mija, zwykle po kilku minutach. Lęk podpowiada jednak co innego, a cienie podchwytują każde słowo.'),
        N('Stań przy {nim|niej}. Lęk to nie wróg, tylko alarm, który dzwoni za głośno. Wrogiem jest kłamstwo, że alarm zawsze ma rację.'),
      ],
      heal: [
        N('Twierdza Paniki pada. W ciszy, która po niej zostaje, {imie} widzi coś, czego się nie {spodziewał|spodziewała}.', 'noc-heal-{m|f}'),
        N('Jak Piotr na wzburzonym jeziorze: fale, wiatr i pewność, że zaraz pójdzie na dno. A po wodzie idzie Ktoś, kto się nie boi.'),
        C('Mt 14,27', { from: 'Ufajcie' }),
        S('Mt 14,31', { to: 'uchwycił go' }, 'Nie czeka, aż burza ucichnie. Najpierw chwyta za rękę.'),
        P('Serce wciąż bije szybko. Ale już wiem, co to jest. To lęk, nie śmierć. Wydłużam wydech i czekam, aż fala opadnie.'),
        A('Jesteś {bezpieczny|bezpieczna}. Także wtedy, gdy się boisz.'),
      ],
    },
    cbt: {
      situation: '{Noc, serce wali, w telefonie wiadomości o wojnie.|Tłok w tramwaju, duszno, serce wali.}',
      feeling: 'Lęk 90 na 100',
      distortion: 'katastrofizacja',
      options: [
        { text: 'Skoro tak się czuję, to na pewno coś mi jest. Zaraz stanie się najgorsze. Muszę uciekać.', why: 'To katastrofizowanie, wzmocnione uczuciem, które udaje dowód. Ucieczka da ulgę na chwilę, ale nauczy mózg, że naprawdę było groźnie.' },
        { text: 'Nic mi nie jest i już nigdy więcej się nie przestraszę.', why: 'Brzmi dobrze, ale takiej obietnicy nikt nie dotrzyma. Przy następnym ataku ta myśl pęknie i zostawi wstyd.' },
        { text: 'To atak paniki: nieprzyjemny, ale niegroźny. Minie za kilka minut. Wydłużam wydech i zostaję.', why: 'Prawdziwe i pomocne: nazywa to, co się dzieje, i daje następny krok.' },
      ],
      truth: 'Lęk to alarm, nie wyrok. Mogę się bać i dalej oddychać, dalej iść. Nie znam przyszłości, ale znam następny krok.',
      verse: { ref: 'J 14,27' },
    },
    tool: {
      id: 'oddech', name: 'Oddech z westchnieniem',
      summary: 'Gdy lęk rośnie, wydłuż wydech. Ciało dostaje sygnał, że jest bezpiecznie.',
      steps: ['Weź spokojny wdech nosem.', 'Dobierz jeszcze trochę powietrza krótkim drugim wdechem.', 'Wypuść powietrze długo i powoli ustami.', 'Powtarzaj przez 1–5 minut. Przy panice nazwij też 5 rzeczy, które widzisz, 4, które słyszysz, 3, których możesz dotknąć, 2, które czujesz węchem, i 1, którą czujesz smakiem.', 'Jeśli to pierwszy taki atak albo ból w klatce piersiowej jest nowy, sprawdź to u lekarza (w nagłym przypadku: 112).'],
      practice: 'Dziś wieczorem, zanim weźmiesz telefon do ręki, pooddychaj tak przez trzy minuty.',
      evidence: 'Są umiarkowane dowody, że oddech z wydłużonym wydechem obniża stres i lęk (Balban 2023, Fincham 2023). Liczenie 5-4-3-2-1 to sposób na uspokojenie, nie leczenie.',
      breathing: true,
    },
  },
  {
    id: 'dom', title: 'Dom', theme: 'Dzieciństwo, alkohol i milczenie',
    place: '{Radom, urodziny ojca|Kielce, Wigilia u rodziców}',
    track: 'jesod', floor: 'floor-dom', look: look('24;18;14', '40;30;22', '255;220;180', '70;50;40'),
    enemies: ['gniew', 'wina', 'milczenie', 'wstyd'],
    boss: { name: 'Twierdza Milczenia', hp: 70, lie: '{Prawdziwy facet nie płacze. Moje uczucia się nie liczą.|To przeze mnie się kłócili. Muszę wszystkich pilnować.}' },
    fact: 'Co czwarty dorosły dorastał w domu, w którym ktoś nadużywał alkoholu lub narkotyków, a co trzeci doznał w dzieciństwie przemocy emocjonalnej (CDC, 264 tys. badanych).',
    warning: 'Ten rozdział dotyka przemocy w rodzinie i picia alkoholu przez rodzica. Pokazuje to symbolicznie, bez drastycznych scen.',
    story: {
      intro: [
        N('{Urodziny ojca w Radomiu. Ojciec od lat nie pije, ale przy stole wszyscy i tak mówią ciszej. {imie} zna ten ton od dziecka.|Wigilia u rodziców w Kielcach. Opłatek, dwanaście potraw i to samo napięcie co zawsze. {imie} od dziecka pilnuje, żeby nikt się nie pokłócił.}', 'dom-{m|f}'),
        N('{Kiedy był mały, ojciec wracał pijany, a w kuchni latały słowa i talerze. Matka mówiła: „Nie płacz, bo będzie gorzej”. Nauczył się nie czuć nic.|Kiedy była mała, stawała między rodzicami z misiem w ręku. Myślała, że jeśli będzie grzeczna, przestaną krzyczeć.}'),
        P('{Nic mi nie jest. Po prostu jestem zmęczony.|Uśmiechnę się, przyniosę ciasto, jakoś to będzie.}'),
        N('Pomóż {mu|jej} nazwać to, co czuje. Uczucie nazwane po imieniu traci połowę władzy.'),
      ],
      heal: [
        N('Twierdza Milczenia pęka. {imie} wraca pamięcią do ciemnej kuchni i znów jest {małym chłopcem|małą dziewczynką}. Ale tym razem nie jest {sam|sama}.', 'dom-heal-{m|f}'),
        C('Mk 10,14', { from: 'Dopuśćcie' }),
        S('Mk 10,16', {}, 'Tak było wtedy, nad Jordanem. Tak jest teraz.'),
        P('{Bałem się. Byłem dzieckiem i miałem prawo się bać. Dziś mogę powiedzieć: jest mi smutno i jestem zły.|To nie przeze mnie się kłócili. Byłam dzieckiem. Za ich kłótnie odpowiadali dorośli.}'),
        A('Twoje uczucia się liczą. Ty się liczysz.'),
      ],
    },
    cbt: {
      situation: '{Ojciec przy stole rzuca kąśliwą uwagę o pracy.|Rodzice podnoszą głos przy wigilijnym stole.}',
      feeling: '{Złość 70, smutek 60, a na zewnątrz: nic|Lęk 80, wina 70}',
      distortion: '{powinnosci|personalizacja}',
      options: [
        { text: '{Muszę to w sobie zdusić, bo inaczej wybuchnę.|Muszę coś zrobić, żeby przestali. To moja rola.}', why: '{„Muszę” zamyka uczucia w piwnicy, a one i tak wychodzą: złością, piciem, bezsennością.|To branie na siebie cudzej odpowiedzialności. Jako dziecko nie mogłaś tego zmienić, a jako dorosła nie musisz.}' },
        { text: 'Przeszłość już mnie nie dotyczy. Nic nie czuję i dobrze.', why: 'Odcięcie od uczuć chroni przez chwilę, ale odcina też od radości i bliskości.' },
        { text: '{Czuję złość i smutek. Mogę je nazwać i nie muszę nimi rzucać ani ich dusić.|Za kłótnie rodziców odpowiadają rodzice. Mogę wyjść na chwilę i odetchnąć.}', why: '{Nazywa uczucia takimi, jakie są, i daje wolność ruchu.|Oddaje odpowiedzialność tym, do których należy, i daje wolność ruchu.}' },
      ],
      truth: '{Prawdziwy mężczyzna czuje i umie o tym powiedzieć. Nazwać, co czuję, to też odwaga.|Nie muszę pilnować cudzych emocji. Za nie odpowiada ten, kto je ma.}',
      verse: { ref: 'Ps 27,10' },
    },
    tool: {
      id: 'uczucia', name: 'Nazwij uczucie',
      summary: 'Uczucie nazwane słowami słabnie. To najprostszy krok do panowania nad sobą.',
      steps: ['Zatrzymaj się i zapytaj: co teraz czuję?', 'Wybierz słowo: złość, smutek, lęk, wstyd, samotność, radość, ulga…', 'Oceń siłę od 0 do 10.', 'Powiedz to sobie albo komuś: „Czuję…, bo…”.'],
      practice: 'Powiedz dziś bliskiej osobie choć jedno zdanie zaczynające się od „Czuję…”.',
      evidence: 'Nazywanie uczuć słowami obniża reakcję mózgowego układu alarmowego (Lieberman 2007).',
    },
  },
  {
    id: 'ekran', title: 'Ekran', theme: 'Porównywanie, wygląd i status',
    place: '{Kawalerka, 1:40 w nocy|Łazienka, lustro i telefon}',
    track: 'hod', floor: 'floor-ekran', look: look('8;14;24', '14;28;44', '170;220;255', '30;50;70'),
    enemies: ['porownanie', 'perfekcja', 'wstyd', 'samotnosc'],
    boss: { name: 'Twierdza Porównań', hp: 80, lie: '{Wszyscy mają więcej niż ja. Przegrałem życie.|Muszę wyglądać jak dziewczyny z ekranu, żeby ktoś mnie pokochał.}' },
    fact: 'Nastolatkowie, którzy spędzają w mediach społecznościowych 5 i więcej godzin dziennie, mają objawy depresji nasilone o 50% (dziewczęta) i 35% (chłopcy) bardziej niż ci, którzy spędzają tam 1–3 godziny, m.in. przez porównywanie wyglądu i krótszy sen (Kelly 2019).',
    warning: '',
    story: {
      intro: [
        N('{Pierwsza czterdzieści w nocy. Kolega z liceum kupił dom pod Warszawą, inny wrzuca zdjęcia z Dubaju. {imie} wynajmuje kawalerkę i przewija dalej.|{imie} stoi przed lustrem z telefonem w ręku. Na ekranie dziewczyny bez porów, bez zmęczenia, bez jednego gorszego dnia. Mąż rzucił rano: „Mogłabyś coś ze sobą zrobić”.}', 'ekran-{m|f}'),
        P('{Mam trzydzieści cztery lata i nic. Inni już dawno coś osiągnęli.|Za grube uda. Szara skóra. Jak ja w ogóle wyglądam?}'),
        N('Cienie porównań nie atakują wprost. Szepczą: „Zobacz, jak dobrze mają inni”. I zawsze pokazują wystawę, nigdy kulisy.'),
        N('Pomóż {mu|jej} złapać tę myśl na gorącym uczynku: co się stało, co {pomyślał|pomyślała}, co {poczuł|poczuła}.'),
      ],
      heal: [
        N('Twierdza Porównań się sypie. Na ulicy pod blokiem Ktoś woła w górę, jakby znał imię każdego na każdym balkonie.', 'ekran-heal-{m|f}'),
        N('Zacheusz był zwierzchnikiem celników i wszyscy nim gardzili. Był niski, więc wspiął się na drzewo, żeby choć z daleka zobaczyć Jezusa. Ale to Jezus pierwszy zobaczył jego.'),
        C('Łk 19,5', { from: 'Zacheuszu' }),
        S('1 Sm 16,7', { from: 'człowiek patrzy' }, 'Dziś woła tak samo, tylko innym imieniem.'),
        P('{Porównuję swoje kulisy z cudzą wystawą. Moje życie ma swoje tempo. Porównam się ze sobą sprzed roku.|Porównuję swoje kulisy z cudzą wystawą. Moje ciało nie jest projektem do oceny. Pozwala mi żyć.}'),
        A('Bóg widzi ciebie, nie twój wynik ani wygląd.'),
      ],
    },
    cbt: {
      situation: '{Zdjęcie znajomego przed nowym domem.|Zdjęcie influencerki po filtrach.}',
      feeling: 'Wstyd 75, smutek 60',
      distortion: 'porownanie',
      options: [
        { text: '{Inni dali radę, ja nie. Jestem nieudacznikiem.|Jestem brzydka. Nikt mnie takiej nie zechce.}', why: 'Porównanie plus etykietka: jedno zdjęcie staje się wyrokiem o całym człowieku.' },
        { text: '{Jestem lepszy od nich wszystkich.|Jestem najpiękniejsza i koniec.}', why: 'To ta sama gra w porównania, tylko na odwrót. Wystarczy jedno kolejne zdjęcie, żeby ta pewność się rozsypała.' },
        { text: '{Widzę cudzą wystawę, nie kulisy. Sprawdzę, co mi się udało w tym roku, i odłożę telefon na noc.|Widzę filtr i dobre światło, nie prawdziwy dzień. Moje ciało pozwala mi żyć. Odkładam telefon.}', why: 'Realistyczne: nazywa, co naprawdę widać, i wraca do własnego życia.' },
      ],
      truth: '{Jestem kimś więcej niż mój wynik.|Jestem kimś więcej niż mój wygląd.} Ci, którzy mnie znają, cenią mnie za to, {jaki|jaka} jestem.',
      verse: { ref: '1 Sm 16,7', from: 'Albowiem' },
    },
    tool: {
      id: 'zlap-mysl', name: 'Złap myśl',
      summary: 'Myśl zapisana na kartce to już tylko myśl, nie prawda objawiona.',
      steps: ['Sytuacja: co się stało? (np. zdjęcie w telefonie)', 'Myśl: co dokładnie przeszło mi przez głowę?', 'Uczucie: co czuję i jak mocno, od 0 do 100?', 'Zapisz te trzy rzeczy. Wrócisz do nich, gdy emocje opadną.'],
      practice: 'Przez jeden dzień zapisz trzy sytuacje, w których porównanie zepsuło ci humor.',
      evidence: 'Zapis myśli to podstawowe narzędzie terapii poznawczo-behawioralnej (Beck). CBT działa także jako samopomoc (Cuijpers 2023).',
    },
  },
  {
    id: 'odrzucenie', title: 'Odrzucenie', theme: '{Rozwód i samotność|Kontrola w związku i odejście}',
    place: '{Kawalerka po rozwodzie, niedziela wieczorem|Wrocław Główny, 23:50}',
    track: 'necach', floor: 'floor-odrzucenie', look: look('16;18;24', '30;34;44', '210;220;240', '50;55;65'),
    enemies: ['odrzucenie', 'samotnosc', 'kontrola', 'oskarzyciel'],
    boss: { name: 'Twierdza Odrzucenia', hp: 90, lie: '{Straciłem wszystko. Nikt mnie już nie zechce.|Bez niego sobie nie poradzę. Nikt inny mnie nie zechce.}' },
    fact: '{W Polsce rozpada się ponad 57 tysięcy małżeństw rocznie (GUS). Samotność „zawsze lub bardzo często” czuje 8% dorosłych, dwa razy więcej niż w 2017 roku (CBOS 2024).|Kontrolowanie pieniędzy i telefonu partnerki to w polskim prawie przemoc domowa (nowelizacja z 2023 r.). Policja zakłada co roku około 60 tysięcy Niebieskich Kart.}',
    warning: '{|Ten rozdział dotyka przemocy psychicznej i ekonomicznej w związku. Niebieska Linia: 800 120 002 (całą dobę).}',
    story: {
      intro: [
        N('{Po rozwodzie {imie} widzi syna co drugi weekend. Kuba wraca do mamy w niedzielę o osiemnastej. Zostają kartony, cisza i rysunek na lodówce: tata i ja.|Mąż, Tomek, przegląda jej telefon, zabrał kartę, bo „ona nie umie oszczędzać”, i decyduje, z kim wolno jej się spotykać. Dziś {imie} spakowała walizkę. Stoi na dworcu, pociąg do siostry dopiero rano.}', 'odrzucenie-{m|f}'),
        P('{Nikomu nie powiem. Facet musi radzić sobie sam.|Może przesadzam. Może to ja jestem problemem.}'),
        N('{Samotność podpowiada, żeby się schować. A chowanie się karmi samotność. To błędne koło.|Kontrola kłamie najsprytniej: przekonuje, że bez niego {imie} sobie nie poradzi. Ale za kontrolę odpowiada ten, kto kontroluje.}'),
        N('Pomóż {mu|jej} nazwać, jak kłamie ten cień. Czy to przepowiadanie przyszłości? Czytanie w myślach? Uogólnianie?'),
      ],
      heal: [
        N('Twierdza Odrzucenia pada. {imie} wciąż jest {sam|sama}, ale cisza brzmi inaczej. Ktoś siada obok.', 'odrzucenie-heal-{m|f}'),
        N('Trędowatych wszyscy omijali. Nikt ich nie dotykał. Jezus zrobił to, czego nikt nie robił.'),
        C('Mk 1,41'),
        P('{Proszenie o pomoc to umiejętność, nie słabość. Dziś napiszę do Marka. W środę zadzwonię do Kuby.|Za przemoc odpowiada ten, kto jej używa. Nie zasłużyłam na to. Siostra czeka, a jutro zadzwonię do Niebieskiej Linii.}'),
        A('Nie jesteś {sam|sama}. I nigdy nie {byłeś|byłaś}.'),
      ],
    },
    cbt: {
      situation: '{Kuba wraca do mamy. Mieszkanie pustoszeje.|Telefon wibruje: dziesięć wiadomości od Tomka.}',
      feeling: 'Smutek 85, wstyd 60, lęk 70',
      distortion: '{uogolnianie|przepowiadanie}',
      options: [
        { text: '{Skoro ona odeszła, to każdy odejdzie.|Wrócę. Bez niego i tak sobie nie poradzę.}', why: '{Jedno rozstanie staje się prawem natury: to nadmierne uogólnianie.|To przepowiadanie przyszłości podsunięte przez kogoś, kto długo powtarzał, że sobie nie poradzisz.}' },
        { text: '{Nie potrzebuję nikogo. Sam dla siebie jestem najlepszym towarzystwem.|Nic się nie stało, wszystko jest w porządku.}', why: 'Zaprzeczenie chroni przed bólem na chwilę, ale zamyka drogę do pomocy.' },
        { text: '{Rozwód boli, ale nie odebrał mi tego, że jestem ojcem. Zadzwonię do syna w środę i napiszę dziś do kolegi.|Tak to czuję, bo długo słyszałam, że jestem nic niewarta. Są ludzie i miejsca, które pomagają odejść bezpiecznie.}', why: 'Uznaje ból i pokazuje prawdziwe możliwości.' },
      ],
      truth: '{Jestem wart miłości także wtedy, gdy ktoś odchodzi. Mogę odezwać się pierwszy.|Mam prawo do swoich pieniędzy, telefonu i przyjaciół. Nie zasłużyłam na kontrolę.}',
      verse: { ref: 'J 6,37', from: 'a tego' },
    },
    tool: {
      id: 'znieksztalcenia', name: 'Nazwij zniekształcenie',
      summary: 'Myśl nazwana po imieniu przestaje udawać fakt.',
      steps: ['Zapytaj: jak ta myśl kłamie?', 'Czy to czytanie w myślach? Przepowiadanie przyszłości? Wszystko albo nic? Uogólnianie? Etykietka?', 'Nazwij ją głośno: „To czytanie w myślach”.', 'Zadaj pytanie, które ją sprawdza (znajdziesz je w Księdze Prawdy).'],
      practice: 'Gdy dziś złapiesz się na „zawsze” albo „nikt”, zapytaj: „Czy na pewno zawsze? Czy na pewno nikt?”.',
      evidence: 'Rozpoznawanie zniekształceń poznawczych to jedna z podstaw CBT (Beck, Burns).',
    },
  },
  {
    id: 'rana', title: 'Rana', theme: '{Napaść|Przemoc seksualna}',
    place: '{Łódź, ulica po meczu, 23:30|Mieszkanie siostry, świt}',
    track: 'rod', floor: 'floor-rana', look: look('14;12;20', '28;24;36', '220;200;230', '50;40;60'),
    enemies: ['wstyd', 'milczenie', 'wina', 'lek'],
    boss: { name: 'Twierdza Wstydu', hp: 100, lie: '{Jestem słaby. Facetowi nikt nie uwierzy.|Sama się prosiłam. To moja wina.}' },
    fact: '{Mężczyźni znacznie częściej niż kobiety padają ofiarą napaści ze strony obcych i bywają świadkami przemocy (badania WHO w 24 krajach). Rzadko o tym mówią.|Przemocy fizycznej lub seksualnej doświadczyło 30,7% kobiet w UE; tylko co ósma zgłosiła to policji (Eurostat 2024).}',
    warning: 'Ten rozdział dotyka przemocy {fizycznej|seksualnej}. Nic nie jest pokazane wprost. Możesz pominąć rozdział bez utraty postępów. Pomoc: 116 123 i 800 70 2222 (całą dobę).',
    story: {
      intro: [
        N('{Wracał z meczu. Trzech chłopaków, pytanie o papierosa, potem już tylko asfalt. Telefon zabrali, rozcięty łuk brwiowy się zagoił. Ale {imie} od miesięcy omija tę ulicę i budzi się w nocy.|Pięć lat temu: impreza firmowa i szef, który „tylko odprowadzi”. Tego, co stało się potem, {imie} nie chce nazywać. Dziś w wiadomościach znów mówią o takich sprawach i wszystko wraca.}', 'rana-{m|f}'),
        P('{Mogłem się bronić. Co ze mnie za facet?|Po co tyle piłam? Po co się zgodziłam, żeby mnie odprowadził?}'),
        N('Za przemoc zawsze odpowiada ten, kto jej używa. Nigdy ten, kto jej doznał. Cienie wstydu mówią co innego, bo żyją z milczenia.'),
        N('Pomóż {mu|jej} zapytać o dowody: „Co naprawdę wiem? Kto tu za co odpowiada?”.'),
      ],
      heal: [
        N('{Twierdza Wstydu pęka. {imie} siedzi na krawężniku, a Ktoś przyklęka obok i nie pyta, czemu się nie bronił.|Twierdza Wstydu pęka. Ktoś klęka w bezpiecznej odległości. Nie zbliża się bez pozwolenia. Czeka.}', 'rana-heal-{m|f}'),
        N('{Uczniowie zapytali kiedyś Jezusa o niewidomego od urodzenia: „Kto zawinił? On czy jego rodzice?”.|Kobieta, która od lat krwawiła i uchodziła za nieczystą, dotknęła płaszcza Jezusa ukradkiem. Bała się, że ją zawstydzi. A On nazwał ją córką.}'),
        C('{J 9,3|Mk 5,34}', { from: '{Ani ten|Córko}' }),
        P('{Nie zasłużyłem na to. Strach w takiej chwili to nie słabość, tylko ciało, które chce przeżyć. Pójdę na policję i do psychologa.|Nie zasłużyłam na to. Za to, co się stało, odpowiada on. Porozmawiam z siostrą i z kimś, kto umie pomóc.}'),
        A('To nie twoja wina. Twoja godność jest nienaruszona.'),
      ],
    },
    cbt: {
      situation: '{Wieczorem trzeba przejść tą samą ulicą.|W wiadomościach mówią o podobnej sprawie.}',
      feeling: 'Wstyd 90, lęk 80',
      distortion: 'personalizacja',
      options: [
        { text: '{Powinienem był im oddać. Jestem żałosny.|Powinnam była wiedzieć. Sama jestem sobie winna.}', why: '{To branie na siebie winy sprawców.|To branie na siebie winy sprawcy.} Ofiara nie odpowiada za przemoc.' },
        { text: 'Nic się nie stało. Zapomnę i już.', why: 'Zapomnieć na zawołanie się nie da. Zaprzeczanie trzyma ranę zamkniętą, ale niezagojoną.' },
        { text: '{Za to odpowiadają napastnicy, nie ja. Nie muszę tego dźwigać sam: mogę zgłosić się na policję i do psychologa.|Za to odpowiada on, nie ja. Mogę szukać pomocy: u bliskiej osoby, pod numerem 116 123, u psychologa.}', why: 'Odpowiedzialność trafia tam, gdzie powinna, a ty odzyskujesz swobodę działania.' },
      ],
      truth: 'Za przemoc odpowiada ten, kto jej używa. {Nie zasłużyłem|Nie zasłużyłam} na to i mogę szukać pomocy.',
      verse: { ref: 'Iz 61,1', from: 'abym związał', to: 'serca,' },
      helplines: true,
    },
    tool: {
      id: 'dowody', name: 'Przesłuchaj myśl',
      summary: 'Myśl to hipoteza, nie wyrok. Sprawdź ją jak sędzia, który słucha obu stron.',
      steps: ['Zapisz myśl, która boli.', 'Dowody za: co naprawdę na nią wskazuje?', 'Dowody przeciw: co jej przeczy? Kto tu za co odpowiada?', 'Ułóż zdanie, które uwzględnia jedne i drugie: zrównoważoną myśl.'],
      practice: 'Wybierz jedną bolesną myśl o sobie i zapisz po trzy dowody za i przeciw.',
      evidence: 'Pytania sokratejskie przewidują poprawę z sesji na sesję w terapii depresji (Braun 2015).',
    },
  },
  {
    id: 'ciezar', title: 'Ciężar', theme: '{Utrata pracy i wypalenie|Opieka nad chorą mamą i wypalenie}',
    place: '{Kuchnia, 23:00, mail z działu kadr|Szpital w Kielcach, sala 214}',
    track: 'tiferet', floor: 'floor-ciezar', look: look('20;20;22', '36;36;40', '240;235;220', '60;60;60'),
    enemies: ['powinnosc', 'perfekcja', 'oskarzyciel', 'beznadzieja'],
    boss: { name: 'Twierdza Powinności', hp: 110, lie: '{Jak nie zarabiam, nie jestem nic wart.|Nie wolno mi odpocząć, bo wszystko się zawali.}' },
    fact: '{Niepewność zatrudnienia prawie podwaja ryzyko myśli samobójczych (Milner 2018). Mężczyźni rzadko o tym mówią. Pomoc: 116 123 (całą dobę).|W UE 32% kobiet, które nie pracują zawodowo, jako powód podaje opiekę nad bliskimi; wśród mężczyzn 5% (EIGE).}',
    warning: '',
    story: {
      intro: [
        N('{Restrukturyzacja. Jeden mail. Dziesięć lat pracy mieści się w kartonie. {imie} nie mówi nikomu, ani mamie, ani byłej żonie. Alimenty trzeba płacić. Wieczorem piwo, potem drugie.|Mama po udarze. Praca zdalna z laptopem na kolanach przy szpitalnym łóżku, co weekend pociąg do Kielc. {imie} śpi po pięć godzin i przeprasza wszystkich, że nie daje rady.}', 'ciezar-{m|f}'),
        P('{Nie mogę nikomu powiedzieć. Facet ma utrzymać rodzinę.|Nie mam prawa się zmęczyć. Kto, jak nie ja?}'),
        N('Niektórych myśli nie da się pokonać w dyskusji. Wracają jak natrętne powiadomienia. Na nie jest inny sposób: zauważyć je i nie dać się im prowadzić.'),
        N('Naucz {go|ją} mówić: „Mam myśl, że…”. Myśl zauważona to tylko myśl.'),
      ],
      heal: [
        N('{Twierdza Powinności pada. Przy kuchennym stole Ktoś siada naprzeciwko i łamie chleb. Rachunki mogą poczekać do rana.|Twierdza Powinności pada. Przy szpitalnym łóżku Ktoś staje obok. Pierwszy raz od tygodni {imie} pozwala sobie oprzeć głowę na czyimś ramieniu.}', 'ciezar-heal-{m|f}'),
        C('Mt 11,28'),
        C('{Mt 11,29|Łk 10,41}'),
        P('{Mam myśl, że bez pracy jestem nic niewart. To tylko myśl. Szukanie pracy to praca, nie wstyd. Powiem mamie prawdę.|Mam myśl, że nie wolno mi odpocząć. To tylko myśl. Mogę kochać mamę i mieć granice. Poproszę brata, żeby przejął weekendy przy mamie.}'),
        A('Odpoczynek to nie zdrada. Jesteś {wart|warta} odpoczynku.'),
      ],
    },
    cbt: {
      situation: '{Kolejny dzień bez pracy, rachunki na stole.|Szef pisze o dwudziestej drugiej, mama woła z łóżka.}',
      feeling: 'Zmęczenie 90, wina 70',
      distortion: 'powinnosci',
      options: [
        { text: '{Jestem nieudacznikiem. Prawdziwy facet utrzymuje rodzinę.|Jestem złą córką. Muszę wszystko ogarniać sama.}', why: '„Muszę” i „{powinienem|powinnam}” zamieniają się w etykietkę i zabierają ostatnie siły.' },
        { text: 'Wszystko jest w porządku, nie muszę niczego zmieniać.', why: 'Udawanie, że daje się radę, prowadzi prosto do wypalenia.' },
        { text: '{Odpoczynek to część pracy, nie nagroda. Zmęczony zrobię mniej, nie więcej. Jutro wyślę trzy CV i pójdę pobiegać.|Odpoczynek to część pracy, nie nagroda. Zmęczona zrobię mniej, nie więcej. Poproszę o pomoc i prześpię się dziś osiem godzin.}', why: 'Realistyczne i konkretne: siły to też zasób, o który trzeba dbać.' },
      ],
      truth: 'Jestem kimś więcej niż to, ile zarobię i ile zrobię. Mogę odpocząć i nadal być kimś wartościowym.',
      verse: { ref: 'Ps 127,2', from: 'ponieważ' },
    },
    tool: {
      id: 'defuzja', name: 'Mam myśl, że…',
      summary: 'Nie każdą myśl trzeba pokonać. Niektóre wystarczy zauważyć i nie dać się im prowadzić.',
      steps: ['Gdy wraca natrętna myśl, dodaj na początku: „Mam myśl, że…”.', 'Możesz dodać jeszcze: „Zauważam, że mam myśl, że…”.', 'Nazwij całą historię: „O, znowu opowieść pod tytułem »Muszę wszystko dźwigać w pojedynkę«”.', 'Wróć do tego, co robisz. Myśl może zostać, ale nie musi prowadzić.'],
      practice: 'Dziś trzy razy złap się na natrętnej myśli i dodaj do niej „Mam myśl, że…”.',
      evidence: 'Defuzja z terapii akceptacji i zaangażowania (ACT) zmniejsza wiarygodność natrętnych myśli (Masuda 2009).',
    },
  },
  {
    id: 'nalog', title: 'Nałóg', theme: '{Hazard online|Alkohol w samotności}',
    place: '{Pokój, 2:00, aplikacja bukmacherska|Kuchnia, 23:00, trzeci kieliszek}',
    track: 'chesed', floor: 'floor-nalog', look: look('18;8;22', '36;14;40', '255;170;220', '60;30;60'),
    enemies: ['nalog', 'samotnosc', 'wstyd', 'gniew'],
    boss: { name: 'Twierdza Nałogu', hp: 120, lie: '{Jeszcze jeden zakład i się odegram.|Bez tego nie wytrzymam wieczoru.}' },
    fact: '{Nadużywanie alkoholu to najczęstsze zaburzenie psychiczne w Polsce: dotyczy 18,6% mężczyzn (EZOP). Wśród grających w kasynach online problem z hazardem ma co szósty (Tran 2024).|Problem z alkoholem ma 3,3% Polek (EZOP), a tylko około 16% osób z zaburzeniami psychicznymi korzysta z pomocy (EZOP II).}',
    warning: 'Ten rozdział dotyka uzależnienia. Jeśli ty też zmagasz się z nałogiem, nie musisz robić tego w pojedynkę.',
    story: {
      intro: [
        N('{Po utracie pracy {imie} chciał tylko trochę dorobić na alimenty. Pierwszy zakład wszedł. Potem już nie. Teraz obstawia w nocy, żeby odrobić to, co przegrał w dzień.|Odkąd odeszła od męża, wieczory są najgorsze. Jeden kieliszek na sen, potem dwa. Teraz butelka znika, zanim {imie} zdąży pomyśleć.}', 'nalog-{m|f}'),
        P('{Jeszcze jeden zakład i się odegram.|Jeszcze jeden kieliszek i przestanie boleć.}'),
        N('Nałóg obiecuje ulgę i rzeczywiście ją daje: na chwilę. Potem zabiera więcej, niż dał. Pragnienie przychodzi falą i, jeśli się jej nie karmi, opada.'),
        N('Gdy {imie} się potknie, cień powie: „{Przegrałeś|Przegrałaś} wszystko”. To kłamstwo. Potknięcie to nie upadek.'),
      ],
      heal: [
        N('Twierdza Nałogu pada. Łańcuchy, które wydawały się z żelaza, pękają jak nitki.', 'nalog-heal-{m|f}'),
        N('W kraju Gerazeńczyków żył człowiek, którego nikt nie umiał związać. Rozrywał łańcuchy i krzyczał wśród grobów. Gdy spotkał Jezusa, ludzie zobaczyli coś, czego się nie spodziewali.'),
        S('Mk 5,15', { from: 'i siedział', to: 'baczeniu;' }),
        C('J 8,36'),
        P('{Odgrywanie się to pułapka. Usunąłem aplikację i zablokowałem strony. W czwartek idę na pierwszy mityng.|Piłam, żeby nie czuć. Teraz uczę się czuć i przetrwać falę. Jutro dzwonię do poradni.}'),
        A('Potknięcie to informacja, nie wyrok. Zawsze możesz wrócić na drogę.'),
      ],
    },
    cbt: {
      situation: '{Przegrany zakład o północy.|Samotny wieczór po ciężkim dniu.}',
      feeling: 'Napięcie 85, wstyd 70',
      distortion: 'jeszcze-raz',
      options: [
        { text: '{Jeszcze raz i się odegram. Tym razem musi wejść.|Bez tego nie zasnę. Jeden kieliszek to nic.}', why: 'Pułapka „jeszcze raz”: każdy zakład to nowe losowanie, a każdy kieliszek uczy mózg, że inaczej się nie da.' },
        { text: 'Od jutra rzucam na zawsze i nigdy więcej mnie nie pociągnie.', why: 'Obietnica bez planu. Przy pierwszej fali pęknie i zostawi wstyd.' },
        { text: 'Pragnienie to fala: rośnie, osiąga szczyt i opada w ciągu kilkunastu minut. Przeczekam ją, dzwoniąc do kogoś. Jeśli się potknę, wracam na drogę od razu.', why: 'Realistyczne: zakłada trudność i ma plan na upadek.' },
      ],
      truth: 'Potknięcie to informacja, nie wyrok. Sprawdzam, co do niego doprowadziło, i wracam na drogę już dziś.',
      verse: { ref: '1 Kor 10,13', from: 'ale wiernyć' },
    },
    tool: {
      id: 'fala', name: 'Przeczekaj falę',
      summary: 'Głód nałogu przychodzi falą. Fala, której się nie karmi, opada.',
      steps: ['Zauważ pragnienie i nazwij je: „Mam falę ochoty na…”.', 'Sprawdź, czy to nie głód, złość, samotność albo zmęczenie. Najpierw zajmij się tym.', 'Oddychaj i obserwuj falę przez 15–20 minut, nie karmiąc jej.', 'Zadzwoń do kogoś albo zmień miejsce.', 'Jeśli się potkniesz: bez wyrzutów sprawdź, co zawiodło, i wróć od razu.'],
      practice: 'Zapisz trzy sytuacje, w których fala jest najsilniejsza, i to, co zrobisz zamiast tego.',
      evidence: 'Planowanie potknięć i przeczekiwanie głodu to elementy terapii zapobiegania nawrotom (Larimer 1999).',
    },
  },
  {
    id: 'strata', title: 'Strata', theme: '{Nagła śmierć ojca|Poronienie}',
    place: '{Cmentarz w Radomiu, Wszystkich Świętych|Szpital, oddział ginekologiczny}',
    track: 'malkut', floor: 'floor-strata', look: look('18;16;12', '38;32;26', '255;225;190', '70;55;40'),
    enemies: ['tesknota', 'wina', 'zwatpienie', 'beznadzieja'],
    boss: { name: 'Twierdza Straty', hp: 130, lie: '{Powinienem był odebrać. To moja wina.|Moje ciało zawiodło. To przeze mnie.}' },
    fact: '{Nagła śmierć bliskiej osoby to najczęstsze traumatyczne zdarzenie na świecie: przeżyło ją 31,4% dorosłych (WHO). U około 10% osób żałoba się przedłuża i wymaga pomocy.|Poronieniem kończy się około 15% rozpoznanych ciąż. Dziewięć miesięcy później 16% kobiet ma objawy stresu pourazowego (Farren 2020).}',
    warning: 'Ten rozdział dotyka {nagłej śmierci bliskiej osoby|straty dziecka w ciąży}.',
    story: {
      intro: [
        N('{Ojciec zmarł nagle, na zawał, w sobotę rano. W piątek dzwonił. {imie} nie odebrał, bo był zmęczony. Teraz stoi nad grobem i wciąż ma w telefonie tamto nieodebrane połączenie.|Jedenasty tydzień. Po wszystkim, co przeszła, {imie} zaczynała wierzyć, że wreszcie czeka ją coś dobrego. Potem krwawienie, szpital i cisza w gabinecie USG.}', 'strata-{m|f}'),
        P('{Powinienem był odebrać. To moja wina.|Moje ciało zawiodło. To przeze mnie.}'),
        N('Żałoby nie da się wygrać. Tęsknota nie jest wrogiem. Wrogiem są kłamstwa, które się do niej doklejają: że to {jego|jej} wina, że już powinno przestać boleć.'),
        N('Nie walcz z tęsknotą. Gdy ją spotkasz, stań przy niej w ciszy. Sama zamieni się w światło.'),
      ],
      heal: [
        N('Twierdza Straty pada, ale smutek zostaje. I tak ma być.', 'strata-heal-{m|f}'),
        N('Gdy umarł Łazarz, Jezus wiedział, że za chwilę go wskrzesi. A jednak stanął przy grobie i płakał razem z siostrami.'),
        S('J 11,35'),
        C('J 11,25', { from: 'Jam jest' }),
        P('{Wtedy nie wiedziałem, że to ostatni telefon. Kochałem go, a on o tym wiedział. Tęsknota pokazuje, jak bardzo kochałem.|Wczesne poronienie zwykle ma przyczyny, na które nikt nie ma wpływu. To nie moja wina. Mogę opłakiwać moje dziecko bez obwiniania siebie.}'),
        A('Możesz płakać. Twoja miłość nie umarła.'),
      ],
    },
    cbt: {
      situation: '{Nieodebrane połączenie w telefonie.|Przypadkiem mija w sklepie dziecięce łóżeczka.}',
      feeling: 'Smutek 90, wina 80',
      distortion: 'personalizacja',
      options: [
        { text: '{Gdybym odebrał, wszystko byłoby inaczej. Nie zasługuję na spokój.|To przeze mnie. Pewnie Bóg mnie ukarał.}', why: '{Tak działa myślenie „po fakcie”: dziś wiesz to, czego wtedy nie wiedziałeś.|Cierpienie nie jest dowodem kary. Takie myśli tylko dokładają ciężaru.}' },
        { text: 'Wszystko dzieje się po coś. Nie ma co płakać.', why: 'To odbiera prawo do żałoby. Smutek nie jest brakiem wiary.' },
        { text: '{Wtedy nie wiedziałem, co się stanie. Kochałem go. Mogę tęsknić i nie oskarżać się.|Wczesne poronienie zwykle ma przyczyny, na które nikt nie ma wpływu. Mogę płakać i nie obwiniać siebie.}', why: 'Daje miejsce na ból, ale zdejmuje z niego fałszywą winę.' },
      ],
      truth: 'Żałoba nie ma terminu. {Tęsknota pokazuje, jak bardzo kochałem.|Tęsknota pokazuje, jak bardzo kochałam.} Mogę mówić do siebie tak, jak {mówiłbym do przyjaciela|mówiłabym do przyjaciółki} w żałobie.',
      verse: { ref: 'Mt 5,4' },
    },
    tool: {
      id: 'przyjaciel', name: 'Mów do siebie jak do przyjaciela',
      summary: 'Dla siebie bywamy najsurowszymi sędziami. Spróbuj być dla siebie przyjacielem.',
      steps: ['Wyobraź sobie przyjaciela w tej samej sytuacji.', 'Co warto mu powiedzieć? Zapisz to.', 'Powiedz to samo do siebie, po imieniu albo na „ty”.', 'Połóż dłoń na sercu. Ból to część bycia człowiekiem: inni też go znają.'],
      practice: 'Napisz do siebie krótki list tak, jakby pisał go ktoś, kto cię kocha.',
      evidence: 'Współczucie dla siebie (Neff i Germer 2013) i mówienie do siebie na „ty” (Kross 2014) zmniejszają poczucie zagrożenia.',
    },
  },
  {
    id: 'ciemnosc', title: 'Ciemność', theme: 'Depresja i myśli z kryzysu',
    place: '{Mieszkanie, listopad, 16:00, już ciemno|Pokój z zasłoniętymi oknami, środek dnia}',
    track: 'szeol', floor: 'floor-ciemnosc', look: look('6;8;12', '12;16;22', '160;170;200', '20;24;30'),
    enemies: ['beznadzieja', 'samotnosc', 'oskarzyciel', 'zwatpienie'],
    boss: { name: 'Twierdza Ciemności', hp: 140, lie: '{Nikt nie zauważy, jak zniknę.|Wszystkim byłoby beze mnie lepiej.}' },
    fact: '{W 2024 roku mężczyźni stanowili w Polsce 84% osób, które odebrały sobie życie (Policja). Rozmowa ratuje: 116 123 i 800 70 2222 działają całą dobę.|Kobiety częściej niż mężczyźni chorują na depresję i zaburzenia lękowe. Telefon zaufania 116 123 i Centrum Wsparcia 800 70 2222 działają całą dobę.}',
    warning: 'Ten rozdział dotyka depresji i myśli samobójczych. Opowiada o wyjściu z kryzysu dzięki pomocy. Jeśli masz takie myśli, zadzwoń: 116 123 lub 800 70 2222 (całą dobę). W zagrożeniu życia: 112.',
    helplines: true,
    story: {
      intro: [
        N('{Od pogrzebu ojca minął miesiąc. {imie} chodzi do nowej pracy, odpisuje na maile, nawet żartuje. Nikt nie widzi, że od tygodni nic nie czuje, a wieczorami siedzi w ciemności.|Po stracie dziecka {imie} przestała wychodzić. Siostra pisze codziennie. {imie} odpisuje „jest ok” i odwraca się do ściany.}', 'ciemnosc-{m|f}'),
        P('{Nikt nie zauważy, jak zniknę.|Wszystkim byłoby beze mnie lepiej.}'),
        N('To myśl z kryzysu. Brzmi jak prawda, ale nią nie jest. Jeśli ty też ją znasz, zadzwoń pod 116 123 albo 800 70 2222 (oba całą dobę). W zagrożeniu życia: 112.'),
        S('1 Krl 19,5', { from: 'a oto' }, 'Prorok Eliasz też kiedyś usiadł pod krzewem i nie miał siły iść dalej. Wtedy przyszedł anioł.'),
        N('Twoja kolej, aniele. Pomóż {mu|jej} zwrócić się do ludzi. Nie zastąpisz ich, ale możesz {go|ją} do nich poprowadzić.'),
      ],
      heal: [
        N('{Twierdza Ciemności pada. {imie} bierze telefon i pisze do Marka: „Nie jest dobrze. Możesz przyjechać?”. Marek jest po dwudziestu minutach. Rano jadą razem do lekarza.|Twierdza Ciemności pada. {imie} pisze siostrze prawdę: „Nie daję rady. Boję się swoich myśli”. Siostra zostaje na noc. Rano dzwonią razem do poradni.}', 'ciemnosc-heal-{m|f}'),
        N('Dwóch uczniów szło do Emaus, przybitych, bez nadziei. Ktoś dołączył do nich w drodze i szedł z nimi tak długo, aż zrozumieli.'),
        { who: 'person', verse: { ref: 'Łk 24,29', from: 'Zostań', to: 'nachylił.' } },
        C('Mt 28,20', { from: 'A oto', to: 'świata.' }),
        P('{To była myśl z kryzysu, a nie prawda o mnie. Powiedziałem o niej komuś. Mam plan na trudne wieczory i numery, pod które mogę zadzwonić.|To była myśl z kryzysu, a nie prawda o mnie. Powiedziałam o niej komuś. Mam plan na trudne wieczory i numery, pod które mogę zadzwonić.}'),
        A('Twoja historia się nie skończyła. Jesteś {potrzebny|potrzebna}.'),
      ],
    },
    cbt: {
      situation: '{Niedziela wieczorem, pusto i ciemno.|Kolejny dzień w łóżku.}',
      feeling: 'Beznadzieja 95',
      distortion: 'przepowiadanie',
      options: [
        { text: 'Zawsze będzie tak źle. Nie ma sensu nikomu mówić.', why: 'To depresja przepowiada przyszłość. Zawsze mówi „zawsze”, a to objaw, nie prognoza.' },
        { text: 'Wystarczy pozytywnie myśleć i samo przejdzie.', why: 'Depresja nie mija od pozytywnego myślenia. Potrzebuje ludzi i często leczenia.' },
        { text: 'To myśl z kryzysu, a nie prawda o mnie. Dziś mówię o niej komuś zaufanemu albo dzwonię pod 116 123.', why: 'Tak wygląda pierwszy krok do wyjścia z kryzysu: nazwać myśl i nie zostać z nią samemu.' },
      ],
      truth: 'Nie znam przyszłości. Już kiedyś było inaczej. Dziś robię jeden krok: odzywam się do człowieka.',
      verse: { ref: 'Ps 23,4', to: 'ze mną;' },
      helplines: true,
    },
    tool: {
      id: 'plan', name: 'Plan bezpieczeństwa',
      summary: 'Na trudne chwile przygotuj plan wcześniej, kiedy jest spokojniej.',
      steps: ['Moje sygnały ostrzegawcze: po czym poznaję, że robi się źle?', 'Co mi choć trochę pomaga: spacer, prysznic, muzyka, modlitwa, oddech.', 'Ludzie, do których mogę napisać: wpisz dwie osoby.', 'Numery całodobowe: 116 123 i 800 70 2222. W zagrożeniu życia: 112.', 'Bezpieczne otoczenie: odsuń od siebie to, co mogłoby ci zaszkodzić, i poproś kogoś, żeby był przy tobie.'],
      practice: 'Zapisz swój plan w telefonie albo na kartce i pokaż go jednej zaufanej osobie.',
      evidence: 'Plan bezpieczeństwa zmniejsza ryzyko zachowań samobójczych (Stanley 2018).',
    },
  },
  {
    id: 'anastasis', title: 'Zmartwychwstanie', theme: 'Wszystkie kłamstwa naraz i droga dalej',
    place: 'Sala parafialna, Wielka Sobota',
    track: 'keter', floor: 'floor-anastasis', look: look('10;8;6', '30;24;14', '255;236;180', '80;60;30'),
    enemies: ['oskarzyciel', 'wstyd', 'beznadzieja', 'lek', 'wina', 'odrzucenie'],
    boss: { name: 'Bramy Otchłani', hp: 170, lie: '{Nic się nie zmieniło. Jesteś taki sam jak zawsze.|Nic się nie zmieniło. Jesteś taka sama jak zawsze.}' },
    fact: 'Bliska, wspierająca relacja z zaufanym dorosłym w dzieciństwie zmniejsza prawie o połowę ryzyko prób samobójczych u osób, które dorastały w trudnych warunkach (Hughes 2019). Nikt nie wychodzi z grobu sam.',
    warning: '',
    story: {
      intro: [
        N('Pół roku później. Sala parafialna, krąg krzeseł, herbata w plastikowych kubkach. Grupa wsparcia: ludzie, którzy też coś przeszli.', 'anastasis-intro-{m|f}'),
        N('{imie} pierwszy raz mówi na głos o tym, co {przeżył|przeżyła}. Nikt się nie odwraca.'),
        P('{Nie jestem już tym samym człowiekiem. Ale wciąż się boję, że wszystko wróci.|Nie jestem już tą samą kobietą. Ale wciąż się boję, że wszystko wróci.}'),
        N('Tej nocy Oskarżyciel zbiera wszystkie cienie naraz. To ostatnia próba: przekonać {go|ją}, że nic się nie zmieniło.'),
        N('Wszystko, czego się nauczyliście, jest z wami: oddech, nazwane uczucia, złapane myśli, dowody, współczucie, ludzie. Idźcie.'),
      ],
      heal: [
        N('Bramy Otchłani pękają i padają na krzyż. Klucze, zamki i łańcuchy leżą rozsypane w ciemności.', 'anastasis-{m|f}'),
        N('Na ikonie Zmartwychwstania Chrystus nie stoi w chwale z daleka. Schodzi na samo dno i chwyta Adama i Ewę za nadgarstki, bo tylko On może ich wyprowadzić.'),
        S('Ef 5,14', { from: 'Ocuć' }),
        C('J 14,31', { from: 'Wstańcież' }),
        C('Ap 21,5', { from: 'Oto', to: 'czynię.' }),
        P('Moje rany stały się bliznami. Nie wstydzę się ich. Idę dalej, krok po kroku, z ludźmi i z Tobą.'),
        A('{Jesteś kochany.|Jesteś kochana.} Zawsze {byłeś|byłaś}.'),
      ],
    },
    cbt: {
      situation: 'Ktoś wypomina dawny błąd i wraca stary lęk.',
      feeling: 'Wstyd 60, nadzieja 40',
      distortion: 'etykietka',
      options: [
        { text: '{Skoro wciąż czasem się boję, to nic się nie zmieniło. Jestem przegrany.|Skoro wciąż czasem się boję, to nic się nie zmieniło. Jestem przegrana.}', why: 'Wszystko albo nic plus etykietka: jeden gorszy dzień ma przekreślić całą drogę.' },
        { text: 'Już nigdy nie będzie mi źle. Jestem {całkowicie uzdrowiony|całkowicie uzdrowiona}.', why: 'Piękne, ale nieprawdziwe. Gorsze dni przyjdą, a wtedy taka myśl zawstydzi.' },
        { text: 'Zmieniło się wiele, choć nie wszystko. Mam narzędzia i ludzi. Dziś zrobię jeden mały krok, który jest dla mnie ważny.', why: 'Uczciwie: widzi postęp, przyjmuje trudność i patrzy na następny krok.' },
      ],
      truth: 'Jestem w drodze. Upadki się zdarzą, ale wiem, jak wstać i do kogo się zwrócić. Krok po kroku, z Bogiem i z ludźmi.',
      verse: { ref: '2 Kor 5,17' },
    },
    tool: {
      id: 'krok', name: 'Jeden mały krok',
      summary: 'Działanie często wyprzedza motywację. Mały krok w stronę tego, co ważne, przywraca życie.',
      steps: ['Wybierz wartość, na której ci zależy: bliskość, zdrowie, wiara, praca, twórczość…', 'Wymyśl krok tak mały, że nie da się go nie zrobić: pięć minut.', 'Zaplanuj: kiedy i gdzie?', 'Zrób go i zauważ, co czujesz potem.'],
      practice: 'Zaplanuj na jutro jeden pięciominutowy krok w stronę tego, co dla ciebie ważne.',
      evidence: 'Aktywizacja behawioralna to skuteczna metoda pomocy w depresji (Ekers 2014).',
    },
  },
];
