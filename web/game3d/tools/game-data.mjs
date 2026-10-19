/**
 * The playable side of HolyHolyHoly 3D (Polish): the seven archangels, their gifts and virtues
 * (with evolutions, as in Heroes vs Hordes), the shadow-thoughts the player fights and the
 * thinking errors they embody (Beck, Burns). content.mjs turns this into content.json.
 *
 * Text conventions, resolved in the game by HolyHoly::G():
 *   {a|b}   form for a man | for a woman (the person under the angel's protection)
 *   {imie}  the person's name (nominative only: write sentences where the name is the subject)
 * Verses are references into the Gdańsk Bible (web/game/src/content/bible.ts, tools/bible.mjs);
 * `from` / `to` cut a verse to the words that matter, verbatim.
 *
 * Content rules (DESIGN.md, "Bezpieczeństwo"): enemies are thoughts and lies, never people or
 * illnesses; what a broken shadow leaves behind is a believable, realistic statement in the
 * person's own voice (process, capability, feeling then action), while the global words of worth
 * ("Jesteś kochany") come from the angel, as a gift, in the second person.
 */

/** The seven archangels of the Eastern tradition (Synaxis, 8 November), with Polish names. */
export const HEROES = [
  {
    id: 'uriel', name: 'Uriel', meaning: 'Światło Boże', tradition: 'wschodnia', color: '255;150;60',
    lore: 'Archanioł światła. Na ikonach trzyma miecz i płomień: oświeca umysły zaciemnione kłamstwem. Stoi przy tych, którzy uczą się myśleć zgodnie z prawdą.',
    verse: { ref: '2 Kor 10,5' },
    signature: 'sig-uriel',
    ultimate: { name: 'Ogień Boży', text: 'Słupy ognia spadają na osiem cieni, a wszystko wokół anioła płonie.' },
    passive: { name: 'Jasność umysłu', text: 'Podpalone cienie słabną: +15% obrażeń.' },
    stats: { hearts: 5, speed: 1, damage: 1.15, prayer: 1, light: 1 },
    unlockedBy: '',
  },
  {
    id: 'michal', name: 'Michał', meaning: 'Któż jak Bóg?', tradition: 'wspólna', color: '220;60;50',
    lore: 'Archistrateg, wódz zastępów niebieskich. Włócznią z chorągwią krzyża strąca smoka. Stoi przy tych, którzy muszą się bronić.',
    verse: { ref: 'Dn 12,1', to: 'twego;' },
    signature: 'sig-michal',
    ultimate: { name: 'Któż jak Bóg!', text: 'Włócznia światła uderza we wszystkie cienie wokół i ogłusza je na półtorej sekundy.' },
    passive: { name: 'Tarcza wodza', text: '+1 serce i dłuższa łaska po ranie.' },
    stats: { hearts: 6, speed: 0.95, damage: 1, prayer: 1, light: 1 },
    unlockedBy: '',
  },
  {
    id: 'gabriel', name: 'Gabriel', meaning: 'Moc Boża', tradition: 'wspólna', color: '120;170;255',
    lore: 'Zwiastun. Niesie latarnię ze świecą i zwierciadło z jaspisu: dobrą nowinę, która rozprasza noc. Do przestraszonych mówi: „Nie bój się”.',
    verse: { ref: 'Łk 1,19', from: 'Jam jest' },
    signature: 'sig-gabriel',
    ultimate: { name: 'Zwiastowanie', text: 'Głos trąby zatrzymuje wszystkie cienie na cztery sekundy i gasi ich strzały.' },
    passive: { name: 'Dobra nowina', text: '+20% światła z każdego cienia.' },
    stats: { hearts: 5, speed: 1.05, damage: 1, prayer: 1, light: 1.2 },
    unlockedBy: 'noc',
  },
  {
    id: 'rafal', name: 'Rafał', meaning: 'Bóg uzdrawia', tradition: 'wspólna', color: '90;200;120',
    lore: 'Lekarz i przewodnik w drodze. Prowadził młodego Tobiasza i niósł naczynie z lekarstwem. Stoi przy chorych, podróżnych i tych, którzy szukają uzdrowienia.',
    verse: { ref: 'Ps 147,3' },
    signature: 'sig-rafal',
    ultimate: { name: 'Uzdrowienie', text: 'Odnawia wszystkie serca, daje cztery sekundy łaski i rozlewa wielki krąg balsamu.' },
    passive: { name: 'Lekarz w drodze', text: 'Co 45 sekund wraca jedno serce.' },
    stats: { hearts: 5, speed: 1, damage: 1, prayer: 1, light: 1 },
    unlockedBy: 'dom',
  },
  {
    id: 'selafiel', name: 'Selafiel', meaning: 'Modlitwa Boża', tradition: 'wschodnia', color: '140;120;220',
    lore: 'Archanioł modlitwy. Stoi z dłońmi skrzyżowanymi na piersi i oczami spuszczonymi. Uczy uwagi: modlić się to być obecnym.',
    verse: { ref: 'Ps 141,2' },
    signature: 'sig-selafiel',
    ultimate: { name: 'Cisza modlitwy', text: 'Na sześć sekund cienie zwalniają do jednej czwartej i tracą siły.' },
    passive: { name: 'Uważność', text: 'Modlitwa (moc specjalna) ładuje się o 30% szybciej.' },
    stats: { hearts: 5, speed: 1, damage: 1, prayer: 1.3, light: 1 },
    unlockedBy: 'ekran',
  },
  {
    id: 'barachiel', name: 'Barachiel', meaning: 'Błogosławieństwo Boże', tradition: 'wschodnia', color: '255;190;210',
    lore: 'Rozdawca Bożych błogosławieństw za dobre uczynki. Białe róże na jego płaszczu to łaski dla rodzin i codziennej pracy.',
    verse: { ref: 'Lm 3,22-23' },
    signature: 'sig-barachiel',
    ultimate: { name: 'Błogosławieństwo', text: 'Fala płatków rani wszystkie cienie wokół i zostawia trzy serca do zebrania.' },
    passive: { name: 'Hojność', text: 'Jedno losowanie darów więcej, a silne cienie zawsze zostawiają relikwiarz.' },
    stats: { hearts: 5, speed: 1, damage: 1, prayer: 1, light: 1 },
    unlockedBy: 'odrzucenie',
  },
  {
    id: 'jehudiel', name: 'Jehudiel', meaning: 'Chwalący Boga', tradition: 'wschodnia', color: '230;180;70',
    lore: 'Patron tych, którzy pracują. W prawej ręce trzyma koronę, nagrodę za trud, w lewej bicz o trzech rzemieniach, który przegania lenistwo i strach.',
    verse: { ref: '2 Tm 4,7' },
    signature: 'sig-jehudiel',
    ultimate: { name: 'Korona', text: 'Przez osiem sekund dwa razy większa siła, szybsze ciosy, a światło samo leci do anioła.' },
    passive: { name: 'Nagroda za trud', text: '+25% manny po rozdziale i szybszy cios.' },
    stats: { hearts: 5, speed: 1.05, damage: 1, prayer: 1, light: 1 },
    unlockedBy: 'ciezar',
  },
];

/**
 * Gifts (weapons: they fight by themselves; the signature one flies while the angel stands still)
 * and virtues (passive, like the tomes of Heroes vs Hordes). Four slots of each. A weapon at its
 * last level evolves when the paired virtue is owned: the evolution is offered as a golden card.
 * icons: one per stage (levels 1-2, levels 3+, evolved); virtues have one.
 */
const sig = (hero, name, description, levels, evolution) => ({ id: `sig-${hero}`, kind: 'signature', hero, name, description, levels, evolution, icons: [1, 2, 3].map(n => `sig-${hero}-${n}`) });
const weapon = (id, name, verse, description, levels, evolution) => ({ id, kind: 'weapon', name, verse: { ref: verse }, description, levels, evolution, icons: [1, 2, 3].map(n => `${id}-${n}`) });
const virtue = (id, name, verse, description, levels, extra = {}) => ({ id, kind: 'virtue', name, verse: { ref: verse }, description, levels, icons: [id], ...extra });

export const SKILLS = [
  sig('uriel', 'Płomień Uriela', 'Gdy stoisz w ciszy, płomień leci w najbliższy cień i podpala go.',
    ['Płomień leci w najbliższy cień i podpala go', '+30% obrażeń', 'Płomień leci szybciej i częściej', 'Płomień przebija jeden cień', '+30% obrażeń, dłuższe podpalenie'],
    { with: 'helm', name: 'Światło dla umysłu', verse: { ref: '2 Kor 10,5', from: 'podbijając' }, text: 'Trzy płomienie naraz, każdy przebija dwa cienie, a podpalenie pali mocniej.' }),
  sig('michal', 'Włócznia Michała', 'Gdy stoisz, włócznia przeszywa cienie w jednej linii.',
    ['Włócznia przeszywa dwa cienie', '+30% obrażeń', 'Przeszywa trzy cienie', 'Szybciej', '+40% obrażeń'],
    { with: 'pancerz', name: 'Chorągiew zwycięstwa', verse: { ref: 'Ap 12,7', to: 'smokiem,' }, text: 'Pięć włóczni naraz, w gwiazdę, każda przeszywa wszystko na swojej drodze.' }),
  sig('gabriel', 'Latarnia Gabriela', 'Gdy stoisz, z latarni wylatuje kula światła, która przechodzi przez wszystkie cienie.',
    ['Powolna kula światła przechodzi przez wszystko', '+30% obrażeń', 'Większa kula', 'Dwie kule naraz', '+30% obrażeń, częściej'],
    { with: 'chleby', name: 'Nowina dla wszystkich', verse: { ref: 'Łk 1,19', from: 'abym mówił' }, text: 'Każda kula na końcu lotu wybucha światłem i rani wszystko wokół.' }),
  sig('rafal', 'Balsam Rafała', 'Gdy stoisz, naczynie z balsamem rozlewa krąg, który rani cienie i leczy anioła.',
    ['Krąg balsamu rani cienie w środku', 'Większy krąg', 'Krąg leczy szybciej', '+40% obrażeń', 'Dwa kręgi naraz'],
    { with: 'przebaczenie', name: 'Lekarstwo dla duszy', verse: { ref: 'Jk 5,16', to: 'uzdrowieni.' }, text: 'Kręgi są dwa razy większe, trwają dłużej i spowalniają cienie.' }),
  sig('selafiel', 'Kadzidło Selafiela', 'Gdy stoisz, wokół anioła rośnie obłok kadzidła, który rani i spowalnia cienie.',
    ['Obłok kadzidła wokół anioła', 'Szerszy obłok', '+40% obrażeń', 'Mocniej spowalnia', 'Szerszy i mocniejszy'],
    { with: 'ucisz', name: 'Modlitwa nieustanna', verse: { ref: '1 Tes 5,17' }, text: 'Obłok zostaje także w ruchu i jest półtora raza szerszy.' }),
  sig('barachiel', 'Róże Barachiela', 'Gdy stoisz, wachlarz płatków róż leci w cienie; czasem zostaje po nich serce.',
    ['Dwa płatki w wachlarzu', '+30% obrażeń', 'Trzy płatki', 'Płatki przebijają cień', 'Cztery płatki'],
    { with: 'milosc', name: 'Deszcz róż', verse: { ref: 'Lm 3,22-23', from: 'Ale się' }, text: 'Siedem płatków, każdy przebija trzy cienie, a serca zostają częściej.' }),
  sig('jehudiel', 'Bicz Jehudiela', 'Gdy stoisz, bicz o trzech rzemieniach smaga cienie przed aniołem i mocno je odrzuca.',
    ['Trzy rzemienie smagają z bliska', '+30% obrażeń', 'Dalszy zasięg', 'Szybciej', '+40% obrażeń'],
    { with: 'sandaly', name: 'Dobry bój', verse: { ref: '2 Tm 4,7' }, text: 'Pięć rzemieni, szerzej i dalej, z ogłuszeniem.' }),

  weapon('tarcza', 'Tarcza wiary', 'Ef 6,16', 'Tarcza wiary gasi ogniste strzały złego: krąży wokół anioła i rozbija cienie, które podejdą.',
    ['Jedna tarcza krąży wokół anioła', 'Dwie tarcze', 'Trzy tarcze, szybciej', 'Cztery tarcze, mocniej'],
    { with: 'milosc', name: 'Pancerz wiary i miłości', verse: { ref: '1 Tes 5,8', from: 'oblekłszy' }, text: 'Sześć większych tarcz, które odbijają strzały i ranią dwa razy mocniej.' }),
  weapon('ogien', 'Języki ognia', 'Dz 2,3', 'W dniu Pięćdziesiątnicy Duch zstąpił jak języki ognia; teraz płomień otacza anioła.',
    ['Płomienie parzą cienie tuż obok', 'Szerszy krąg', 'Mocniejszy ogień', 'Szerszy krąg', 'Częstszy i mocniejszy ogień'],
    { with: 'serce', name: 'Serce pałające', verse: { ref: 'Łk 24,32', to: 'mówił,' }, text: 'Krąg ognia jest dwa razy szerszy i pali bez przerwy.' }),
  weapon('wicher', 'Gwałtowny wicher', 'Dz 2,2', 'Szum gwałtownego wichru napełnił dom w dniu Pięćdziesiątnicy; teraz ten wiatr odpycha cienie.',
    ['Co 6 s wicher odrzuca cienie', 'Co 5 s', 'Co 4 s, dalej', 'Co 3 s, z obrażeniami'],
    { with: 'sandaly', name: 'Wicher z nieba', verse: { ref: 'Dz 2,2' }, text: 'Co 2 sekundy, szerzej i z dużymi obrażeniami.' }),
  weapon('golebica', 'Gołębica', 'Mt 3,16', 'Nad Jordanem Duch zstąpił jak gołębica; teraz gołębica leci przy aniele i sama odnajduje cienie.',
    ['Gołębica uderza co 1,6 s', 'Co 1,3 s', 'Mocniej', 'Co 1 s, mocniej'],
    { with: 'ryba', name: 'Gołębica nad Jordanem', verse: { ref: 'Mt 3,16', from: 'a oto' }, text: 'Gołębica uderza dwa razy częściej i trzy razy mocniej.' }),
  weapon('eliasz', 'Ogień Eliasza', '1 Krl 18,38', 'Na górze Karmel ogień Pański spadł z nieba na modlitwę Eliasza; teraz spada na cienie.',
    ['Co 4 s ogień z nieba', 'Większy płomień', 'Co 3 s', 'Dwa płomienie naraz'],
    { with: 'chleby', name: 'Chleb na drogę', verse: { ref: '1 Krl 19,7', from: 'Wstań' }, text: 'Cztery słupy ognia co dwie sekundy.' }),
  weapon('jerycho', 'Trąby Jerycha', 'Joz 6,20', 'Mury Jerycha upadły od głosu trąb; teraz ten głos gasi strzały i zatrzymuje cienie.',
    ['Co 8 s fala zatrzymuje cienie na 1,5 s', 'Co 7 s, na 2 s', 'Co 6 s, z obrażeniami'],
    { with: 'ucisz', name: 'Mury padają', verse: { ref: 'Joz 6,20', from: 'upadł mur', to: 'swem,' }, text: 'Co 5 sekund, zatrzymuje na 4 sekundy i mocno rani.' }),
  weapon('dawid', 'Proca Dawida', '1 Sm 17,49', 'Mały Dawid jednym kamieniem z procy powalił olbrzyma; ten kamień zawsze leci w najsilniejszy cień.',
    ['Co 3 s kamień w najsilniejszy cień', 'Mocniejszy kamień', 'Co 2,2 s', 'Kamień przebija i rani twierdze podwójnie'],
    { with: 'samson', name: 'Olbrzym pada', verse: { ref: '1 Sm 17,49', from: 'i padł' }, text: 'Kamień trzy razy mocniejszy, leci co sekundę i przebija wszystko.' }),

  virtue('sandaly', 'Sandały pokoju', 'Ef 6,15', 'Nogi obute w gotowość Ewangelii pokoju niosą anioła szybciej.', ['+12% szybkości', '+12% szybkości', '+12% szybkości']),
  virtue('pancerz', 'Pancerz sprawiedliwości', 'Ef 6,14', 'Pancerz sprawiedliwości, nie twojej, lecz Bożej, chroni serce przed ranami.', ['12% szans uniknięcia rany', '24% szans', '36% szans']),
  virtue('helm', 'Hełm zbawienia', 'Ef 6,17', 'Hełm zbawienia strzeże myśli; gdy wszystko wydaje się stracone, przypomina, że należysz do Boga.', ['Raz w rozdziale podnosi cię od razu z dwoma sercami']),
  virtue('ucisz', 'Ucisz się', 'Mk 4,39', 'Jezus zgromił wiatr i rzekł morzu: „Umilknij”; gdy cię zranią, burza zamiera.', ['Po ranie cienie obok zamierają na 1,5 s', 'Na 2,5 s', 'Na 3,5 s, w szerszym kręgu']),
  virtue('milosc', 'Miłość', '1 J 4,18', 'Doskonała miłość usuwa lęk; im więcej miłości, tym słabsze cienie.', ['Cienie mają 10% mniej sił', '20% mniej', '30% mniej']),
  virtue('ryba', 'Ryba Jonasza', 'Jon 2,1', 'Bóg posłał wielką rybę, która ocaliła Jonasza; tak światło samo płynie do anioła z daleka.', ['+40% zasięgu przyciągania światła', '+80%', '+120%']),
  virtue('serce', 'Serce z ciała', 'Ez 36,26', 'Bóg obiecał zabrać serce z kamienia i dać serce z ciała.', ['+1 serce', '+1 serce']),
  virtue('przebaczenie', 'Siedemdziesiąt siedem razy', 'Mt 18,22', 'Przebaczenie bez końca: łaska po ranie trwa dłużej, a seria ciosów nie gaśnie tak szybko.', ['+0,4 s łaski po ranie, dłuższa seria', '+0,8 s', '+1,2 s']),
  virtue('chleby', 'Rozmnożenie chlebów', 'Mt 14,20', 'Jak pięć chlebów nakarmiło tysiące, tak dar anioła się mnoży.', ['+1 pocisk (albo szerszy krąg)', '+2', '+3']),
  virtue('samson', 'Siła z wysoka', 'Iz 40,29', 'Bóg dodaje spracowanemu siły: cios jest mocniejszy i odrzuca cienie.', ['+40% siły ciosu', 'Dłuższy zasięg ciosu', '+40% siły ciosu', 'Cios odpycha też cienie wokół']),
  virtue('manna', 'Manna', 'Wj 16,4', 'Bóg karmił swój lud manną każdego dnia; tak samo odnawia twoje siły. Nie zajmuje miejsca wśród cnót.', ['Odnawia jedno serce', 'Odnawia jedno serce', 'Odnawia dwa serca'], { consumable: true }),
];

/**
 * Thinking errors (cognitive distortions, after Beck and Burns, with Leahy's unfair comparison and
 * the "one more time" trap of gambling and drinking), each with the Socratic question that tests it.
 */
export const DISTORTIONS = [
  { id: 'wszystko-albo-nic', name: 'Wszystko albo nic', question: 'Czy jest coś pomiędzy całkowitym sukcesem a porażką?' },
  { id: 'uogolnianie', name: 'Nadmierne uogólnianie', question: 'Zawsze? Nikt? Znajdę choć jeden wyjątek?' },
  { id: 'filtr', name: 'Filtr umysłowy', question: 'Co pomijam w tym obrazie?' },
  { id: 'umniejszanie', name: 'Umniejszanie dobrego', question: 'Gdyby zrobił to przyjaciel, czy to też by się nie liczyło?' },
  { id: 'czytanie-mysli', name: 'Czytanie w myślach', question: 'Skąd wiem, co myślą inni? Czy mogę zapytać?' },
  { id: 'przepowiadanie', name: 'Przepowiadanie przyszłości', question: 'Jak często moje czarne prognozy naprawdę się sprawdzały?' },
  { id: 'katastrofizacja', name: 'Katastrofizowanie', question: 'Co najgorszego, co najlepszego, a co najbardziej prawdopodobne? Co mogę zrobić, jeśli stanie się najgorsze?' },
  { id: 'rozumowanie-emocjonalne', name: 'Rozumowanie emocjonalne', question: 'Czy uczucie jest dowodem?' },
  { id: 'powinnosci', name: '„Muszę” i „{powinienem|powinnam}”', question: 'Kto tak mówi? Czego naprawdę chcę?' },
  { id: 'etykietka', name: 'Etykietowanie', question: 'Czy jestem jednym czynem, czy całym człowiekiem?' },
  { id: 'personalizacja', name: 'Branie winy na siebie', question: 'Co jeszcze się do tego przyczyniło? Kto tu za co odpowiada?' },
  { id: 'porownanie', name: 'Niesprawiedliwe porównanie', question: 'Czy porównuję swoje kulisy z cudzą wystawą?' },
  { id: 'jeszcze-raz', name: 'Pułapka „jeszcze raz”', question: 'Czy „jeszcze raz” kiedykolwiek był ostatni?' },
];

/**
 * The shadow-thoughts. archetype = how it moves (chase, circle, charge, drift, tank, split, blink,
 * ranged, gentle). thoughts: what it whispers (shown over strong shadows and in the discernment
 * cards). reframes: what the person says when it breaks; angel: what the angel says (gold).
 * Grief is "gentle": it is not an enemy to beat, it dissolves when the angel stands by it in silence.
 */
export const ENEMIES = [
  {
    kind: 'lek', name: 'Lęk', distortion: 'katastrofizacja', archetype: 'blink', hp: 18, speed: 2.1, color: '#7d9cff',
    thoughts: ['Zaraz stanie się coś strasznego.', 'Nie dam rady, jeśli to się powtórzy.', 'A co, jeśli…?'],
    reframes: ['Boję się i robię jeden krok.', 'Lęk to alarm, nie wyrok.', 'Mogę oddychać spokojnie, nawet gdy się boję.', 'Nie znam przyszłości. Znam następny krok.', 'Uczę się ufać, krok po kroku.'],
    angel: ['Jesteś {bezpieczny|bezpieczna} w Bożych rękach.'],
  },
  {
    kind: 'wstyd', name: 'Wstyd', distortion: 'etykietka', archetype: 'drift', hp: 20, speed: 1.9, color: '#b07ab8',
    thoughts: ['{Jestem żałosny.|Jestem żałosna.}', '{Gdyby wiedzieli, jaki naprawdę jestem…|Gdyby wiedzieli, jaka naprawdę jestem…}', 'Coś jest ze mną nie tak.'],
    reframes: ['{Popełniłem błąd. Nie jestem błędem.|Popełniłam błąd. Nie jestem błędem.}', 'Mogę być sobą przy ludziach, którym ufam.', 'Moja wartość nie zależy od jednej chwili.'],
    angel: ['{Jesteś kochany taki, jaki jesteś.|Jesteś kochana taka, jaka jesteś.}'],
  },
  {
    kind: 'gniew', name: 'Gniew', distortion: 'powinnosci', archetype: 'charge', hp: 24, speed: 1.8, color: '#e0583a',
    thoughts: ['Muszę się bronić, nikomu nie ufam.', 'Nie powinni tak robić!', 'Wszyscy są przeciwko mnie.'],
    reframes: ['Nazywam gniew, zanim on mnie poprowadzi.', 'Mogę się złościć i nikogo nie krzywdzić.', 'Gniew pokazuje, że coś jest dla mnie ważne.', 'Pauza: stop, oddech, dopiero potem słowo.'],
    angel: ['Twoja złość może służyć dobru.'],
  },
  {
    kind: 'samotnosc', name: 'Samotność', distortion: 'przepowiadanie', archetype: 'drift', hp: 18, speed: 1.8, color: '#8fa3b8',
    thoughts: ['{Muszę radzić sobie sam.|Muszę radzić sobie sama.}', 'Nikt nie zadzwoni.', 'Nie będę się narzucać.'],
    reframes: ['Mogę napisać do jednej osoby.', 'Proszenie o pomoc to umiejętność, nie słabość.', '{Ktoś też czeka, aż odezwę się pierwszy.|Ktoś też czeka, aż odezwę się pierwsza.}', '{Jestem otoczony miłością, choć nie zawsze ją widzę.|Jestem otoczona miłością, choć nie zawsze ją widzę.}'],
    angel: ['Nie jesteś {sam|sama}.'],
  },
  {
    kind: 'porownanie', name: 'Porównanie', distortion: 'porownanie', archetype: 'circle', hp: 18, speed: 2.3, color: '#6ad1c9',
    thoughts: ['Inni mają lepiej.', '{Jestem gorszy.|Jestem gorsza.}', 'Wszyscy już coś osiągnęli.'],
    reframes: ['Porównuję swoje kulisy z cudzą wystawą.', 'Porównuję się ze sobą sprzed roku.', 'Moje życie ma swoje tempo.', 'Moje ciało nie jest projektem do oceny.'],
    angel: ['Bóg patrzy na serce.'],
  },
  {
    kind: 'wina', name: 'Wina', distortion: 'personalizacja', archetype: 'tank', hp: 46, speed: 1.3, color: '#8a6f4f',
    thoughts: ['To wszystko przeze mnie.', '{Powinienem był temu zapobiec.|Powinnam była temu zapobiec.}', 'Nie zasługuję na przebaczenie.'],
    reframes: ['Biorę odpowiedzialność za swoją część, nie za wszystko.', '{Wtedy wiedziałem mniej niż dziś.|Wtedy wiedziałam mniej niż dziś.}', 'Naprawiam, co się da. Resztę oddaję Bogu.'],
    angel: ['Nikt cię nie potępia.'],
  },
  {
    kind: 'nalog', name: 'Nałóg', distortion: 'jeszcze-raz', archetype: 'split', hp: 28, speed: 2, color: '#c0508a',
    thoughts: ['Jeszcze raz i koniec.', 'Bez tego nie wytrzymam.', '{Znowu się złamałem. Jestem stracony.|Znowu się złamałam. Jestem stracona.}'],
    reframes: ['Fala pragnienia opada. Przeczekam ją.', 'Potknięcie to informacja, nie wyrok.', 'Dzwonię do kogoś, zanim sięgnę.', 'Każdy zakład to nowe losowanie. Zamykam aplikację.'],
    angel: ['Zawsze możesz wrócić na drogę.'],
  },
  {
    kind: 'perfekcja', name: 'Perfekcjonizm', distortion: 'wszystko-albo-nic', archetype: 'chase', hp: 18, speed: 2.3, color: '#e8e2d0',
    thoughts: ['Albo idealnie, albo wcale.', 'Jeden błąd i wszystko stracone.', '{Muszę być najlepszy.|Muszę być najlepsza.}'],
    reframes: ['Część wyszła dobrze, część do poprawy.', 'Wystarczająco dobrze to też dobrze.', 'Uczę się, a nauka to próby i błędy.'],
    angel: ['Nie musisz być {idealny|idealna}, żeby być {kochany|kochana}.'],
  },
  {
    kind: 'beznadzieja', name: 'Beznadzieja', distortion: 'przepowiadanie', archetype: 'tank', hp: 44, speed: 1.2, color: '#4f5a6e',
    thoughts: ['Nic się nie zmieni.', 'Nie ma sensu się starać.', 'Zawsze będzie tak źle.'],
    reframes: ['Nie znam przyszłości. Dziś mogę zrobić jeden mały krok.', 'Już kiedyś było inaczej.', 'Nadzieja to decyzja na dziś, nie tylko uczucie.'],
    angel: ['Twoja historia się nie skończyła.'],
  },
  {
    kind: 'oskarzyciel', name: 'Oskarżyciel', distortion: 'etykietka', archetype: 'ranged', hp: 22, speed: 1.6, color: '#a83a52',
    thoughts: ['Znowu wszystko psujesz.', 'Jesteś do niczego.', 'Kto by cię chciał?'],
    reframes: ['Mówię do siebie jak do przyjaciela.', 'Krytyk mówi głośno, ale nie mówi prawdy.', 'Mogę się mylić i dalej się uczyć.'],
    angel: ['Oskarżyciel został strącony. Nikt cię nie potępia.'],
  },
  {
    kind: 'zwatpienie', name: 'Zwątpienie', distortion: 'rozumowanie-emocjonalne', archetype: 'blink', hp: 18, speed: 1.9, color: '#9aa0b5',
    thoughts: ['Bóg mnie opuścił.', 'Czuję, że to bez sensu, więc tak jest.', 'Modlitwa nic nie da.'],
    reframes: ['Uczucie jest prawdziwe, ale nie jest dowodem.', 'Mogę przynieść Bogu także gniew i pytania.', 'Wierzę. Pomóż mi w mojej niewierze.'],
    angel: ['Bóg nie odszedł. Jest bliżej, niż czujesz.'],
  },
  {
    kind: 'kontrola', name: 'Kontrola', distortion: 'przepowiadanie', archetype: 'circle', hp: 22, speed: 2.1, color: '#c49a3c',
    thoughts: ['{Bez niej sobie nie poradzę.|Bez niego sobie nie poradzę.}', 'Jeśli puszczę, wszystko się rozsypie.', 'Muszę mieć wszystko pod kontrolą.'],
    reframes: ['Są ludzie i miejsca, które pomagają odejść bezpiecznie.', 'Zajmuję się tym, na co mam wpływ. Resztę odpuszczam.', 'Mam prawo do swoich pieniędzy, telefonu i przyjaciół.'],
    angel: ['Twoje życie należy do ciebie i do Boga.'],
  },
  {
    kind: 'tesknota', name: 'Tęsknota', distortion: 'powinnosci', archetype: 'gentle', hp: 30, speed: 1.1, color: '#d9c7a0',
    thoughts: ['{Powinienem już przestać tęsknić.|Powinnam już przestać tęsknić.}', 'Nie wolno mi płakać.', 'Czas miał leczyć, a nie leczy.'],
    reframes: ['{Żałoba nie ma terminu. Tęsknota pokazuje, jak bardzo kochałem.|Żałoba nie ma terminu. Tęsknota pokazuje, jak bardzo kochałam.}', 'Mogę płakać. Jezus też płakał.', 'Noszę w sobie miłość, nie tylko ból.'],
    angel: ['Twoja miłość nie umarła.'],
  },
  {
    kind: 'milczenie', name: 'Milczenie', distortion: 'czytanie-mysli', archetype: 'chase', hp: 20, speed: 2.1, color: '#5b4a6b',
    thoughts: ['Nikt mi nie uwierzy.', 'Lepiej nic nie mówić.', 'Jak powiem, będzie gorzej.'],
    reframes: ['Mogę powiedzieć jednej zaufanej osobie.', 'Mój głos ma znaczenie.', 'Za przemoc odpowiada ten, kto jej używa.'],
    angel: ['Twój głos jest słyszany.'],
  },
  {
    kind: 'odrzucenie', name: 'Odrzucenie', distortion: 'uogolnianie', archetype: 'charge', hp: 20, speed: 2.2, color: '#c86b85',
    thoughts: ['Nikt mnie nie zechce.', '{Zawsze zostaję sam.|Zawsze zostaję sama.}', 'Jestem nie do kochania.'],
    reframes: ['Jedno odejście nie mówi wszystkiego o mnie.', 'Dziś trudno mi to poczuć, ale są ludzie, którym na mnie zależy.', '{Jestem wart miłości, także gdy ktoś odchodzi.|Jestem warta miłości, także gdy ktoś odchodzi.}', '{Jestem kochany, nawet gdy dziś tego nie czuję.|Jestem kochana, nawet gdy dziś tego nie czuję.}'],
    angel: ['{Jesteś kochany.|Jesteś kochana.}'],
  },
  {
    kind: 'powinnosc', name: 'Powinność', distortion: 'powinnosci', archetype: 'tank', hp: 42, speed: 1.3, color: '#b8a46a',
    thoughts: ['Nie wolno mi odpocząć.', '{Jak odpocznę, to znaczy, że jestem leniwy.|Jak odpocznę, to znaczy, że jestem leniwa.}', 'Muszę wszystko ogarnąć.'],
    reframes: ['Odpoczynek to część pracy, nie nagroda za nią.', 'Wybieram, co dziś najważniejsze.', 'Nie muszę dźwigać wszystkiego {sam|sama}.'],
    angel: ['Jesteś {wart|warta} odpoczynku.'],
  },
];
