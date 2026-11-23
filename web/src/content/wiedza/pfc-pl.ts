/** Kora przedczołowa — the article in Polish (the source language; DESIGN.md §15). Keys cited: refs.ts. */
import type { Article } from './types';

const article: Article = {
  kicker: 'Artykuł · mózg i umysł',
  title: 'Kora przedczołowa',
  lede: 'Tuż za czołem, nad brwiami, leży kora przedczołowa — ta część mózgu, którą mierzy Twoja opaska. Pomaga utrzymać cel w głowie, powstrzymać pochopny odruch, uspokoić emocje i zrozumieć drugiego człowieka. Poniżej znajdziesz to, co o niej wiadomo z badań: przystępnie i ze źródłami, przede wszystkim z metaanaliz i przeglądów systematycznych.',

  band: {
    title: 'Co widzi Twoja opaska',
    intro: 'Obie opaski patrzą na ten sam fragment mózgu — przód kory przedczołowej, pod czołem — ale mierzą co innego.',
    fnirs: {
      title: 'Mendi · fNIRS',
      text: 'Świeci w czoło bliską podczerwienią i mierzy, ile światła wraca. Z tego liczy zmiany ilości krwi natlenionej (HbO) i odtlenowanej (HbR) w korze tuż pod czujnikami: w biegunie czołowym i w grzbietowo-bocznej korze przedczołowej. Gdy ta okolica pracuje mocniej, napływa do niej więcej natlenionej krwi.',
    },
    eeg: {
      title: 'HALO · EEG',
      text: 'Elektrody na czole (Fp1, Fp2) i z tyłu głowy odbierają drobne napięcia elektryczne — rytmy, które powstają, gdy wielkie grupy neuronów pracują razem. Opaska nie widzi głębi mózgu, tylko to, co dociera do skóry.',
    },
    points: [
      { text: 'fNIRS jest bezpieczne, znosi ruch i mieści się w opasce, dlatego da się nim mierzyć poza laboratorium — od niemowląt po seniorów.', refs: ['pinti2020'] },
      { text: 'Z odbitego światła liczy się zmiany stężenia hemoglobiny natlenionej i odtlenowanej; większość urządzeń na rynku działa na świetle ciągłym, tak jak Mendi.', refs: ['scholkmann2014'] },
      { text: 'Część zmian w sygnale fNIRS może pochodzić nie z pracy neuronów, lecz z innych procesów w ciele. Badacze nazywają to fałszywymi alarmami i uczą się je odfiltrowywać.', refs: ['tachtsidis2016'] },
      { text: 'W EEG rytm theta nad środkiem czoła wygląda na sygnał, że potrzebna jest kontrola — mózg „zauważa”, że trzeba się skupić albo poprawić.', refs: ['cavanagh2014'] },
      { text: 'Asymetria fal alfa między lewą a prawą stroną czoła bywa przedstawiana jako wskaźnik depresji. Metaanaliza 16 badań pokazała jednak, że do diagnozy się nie nadaje.', refs: ['vandervinne2017'] },
    ],
  },

  sections: [
    {
      id: 'what',
      title: 'Czym jest kora przedczołowa',
      short: 'To przednia część płatów czołowych — dyrygent, który trzyma cel i kieruje pracą reszty mózgu.',
      body: [
        { text: 'Kora przedczołowa zajmuje przód mózgu, za czołem i nad oczodołami. Badacze dzielą ją na kilka okolic: grzbietowo-boczną (po bokach czoła, ważną dla myślenia i planowania), brzuszno-przyśrodkową i oczodołową (nad oczami, ważne dla wartości i emocji), przyśrodkową (ważną dla rozumienia siebie i innych) oraz biegun czołowy, tuż za środkiem czoła.', refs: [] },
        { text: 'Jej pracę najlepiej opisują słowa „kontrola poznawcza”: myśli i działania idą za Twoim celem, a nie za tym, co akurat najgłośniejsze. Kora przedczołowa utrzymuje w gotowości obraz celu i podpowiada innym częściom mózgu, którą drogą puścić sygnał.', refs: ['miller2001'] },
        { text: 'Nie działa w pojedynkę. Pracuje w sieciach z korą ciemieniową, zakrętem obręczy, wyspą i strukturami głęboko w mózgu — i to od współpracy tych sieci zależy, czy łatwo nam się skupić, przełączyć albo odpocząć.', refs: ['niendam2012', 'menon2011'] },
      ],
      points: [
        { text: 'Teoria Millera i Cohena: kontrola poznawcza polega na tym, że kora przedczołowa aktywnie podtrzymuje wzorce reprezentujące cel i drogę do niego, a te kierują przepływem sygnałów w innych częściach mózgu.', refs: ['miller2001'] },
        { text: 'Badania osób z uszkodzeniem kory przedczołowej pokazują, że jest ona niezbędna do organizowania i kontrolowania działań nastawionych na cel — choć kiedyś uważano ją za mało ważną.', refs: ['szczepanski2014'] },
        { text: 'Metaanaliza 193 badań obrazowych (2 832 zdrowe osoby) znalazła wspólną sieć — grzbietowo-boczną korę przedczołową, przedni zakręt obręczy i korę ciemieniową — aktywną przy bardzo różnych zadaniach wymagających kontroli.', refs: ['niendam2012'] },
        { text: 'W depresji, lęku czy demencji kłopot często leży w tym, jak sieci mózgu się włączają i wyłączają, a nie w jednym „zepsutym” miejscu.', refs: ['menon2011'] },
      ],
      strength: 'strong',
      forYou: 'Gdy opaska pokazuje pracę kory przedczołowej, widzisz fragment większej całości: sygnał jednej okolicy, która współpracuje z całym mózgiem.',
      link: '#sygnal',
    },
    {
      id: 'executive',
      title: 'Myślenie, pamięć robocza i hamowanie',
      short: 'Funkcje wykonawcze — trzymanie informacji w głowie, powstrzymanie odruchu i zmiana planu — opierają się na sieci z korą przedczołową w centrum.',
      body: [
        { text: 'Psychologowie wyróżniają trzy podstawowe funkcje wykonawcze. Pamięć robocza pozwala trzymać w głowie informacje i coś z nimi robić, na przykład liczyć w pamięci. Hamowanie pozwala nie zrobić tego, co pierwsze przychodzi do głowy, i nie dać się rozproszyć. Elastyczność pozwala zmienić plan i spojrzeć z innej strony. Na nich budują się planowanie, rozwiązywanie problemów i rozumowanie.', refs: ['diamond2013'] },
        { text: 'Te umiejętności są wrażliwe na codzienność: stres, brak snu, samotność i brak ruchu wyraźnie je osłabiają, a ćwiczenie je wzmacnia.', refs: ['diamond2013'] },
      ],
      points: [
        { text: 'Rdzeń funkcji wykonawczych to hamowanie, pamięć robocza i elastyczność. Dzięki nim możemy „bawić się pomysłami”, pomyśleć przed działaniem, sprostać nowym wyzwaniom, oprzeć się pokusie i zostać przy zadaniu.', refs: ['diamond2013'] },
        { text: 'Metaanaliza 24 badań z zadaniem n-back (klasyczny test pamięci roboczej): zadanie niezawodnie pobudza grzbietowo-boczną i brzuszno-boczną korę przedczołową, bieguny czołowe oraz korę ciemieniową.', refs: ['owen2005'] },
        { text: 'Hamowanie opiera się w dużej mierze na prawej dolnej korze czołowej, która razem z jądrami podstawy działa jak hamulec — wciskany do końca albo tylko na chwilę, by się zatrzymać.', refs: ['aron2014'] },
        { text: 'Różne funkcje wykonawcze dzielą wspólną sieć kontroli, ale każda dokłada też własne obszary.', refs: ['niendam2012'] },
      ],
      strength: 'strong',
      forYou: 'Jeśli coś „nie chce wejść do głowy”, zanim zrzucisz to na słabą wolę, sprawdź sen, stres i ruch — to one najszybciej zmieniają sprawność funkcji wykonawczych.',
      link: '#gry',
    },
    {
      id: 'attention',
      title: 'Uwaga i długie skupienie',
      short: 'Utrzymać uwagę przez wiele minut jest trudno każdemu, zwłaszcza przy prostym, monotonnym zadaniu. Pomaga w tym głównie prawostronna sieć z korą przedczołową.',
      body: [
        { text: 'Każdy zna chwilę, gdy czyta ten sam akapit trzeci raz. Zdolność pozostania przy zadaniu słabnie z czasem — i, co zaskakujące, szybciej przy zadaniach prostych i powtarzalnych.', refs: ['langner2013'] },
        { text: 'Długa uwaga to nie jeden proces, tylko dwa splecione: stałe podtrzymywanie nastawienia na zadanie i krótkie, szybkie powroty do niego, gdy coś nas wybije.', refs: ['langner2013'] },
        { text: 'Błądzenie myśli nie jest „wyłączeniem mózgu”. Gdy myśli odpływają, pracuje sieć spoczynkowa mózgu (z przyśrodkową korą przedczołową), ale równie stale także obszary kontroli w przedniej części kory przedczołowej.', refs: ['fox2015'] },
      ],
      points: [
        { text: 'Metaanaliza badań obrazowych czujności: rdzeń sieci długiej uwagi leży głównie po prawej stronie — w grzbietowo-przyśrodkowej, środkowej i brzuszno-bocznej korze przedczołowej, przedniej wyspie, korze ciemieniowej i strukturach podkorowych.', refs: ['langner2013'] },
        { text: 'Spadek sprawności z upływem czasu jest regułą, nie wyjątkiem — to dobrze znane zjawisko, które dotyczy każdego.', refs: ['langner2013'] },
        { text: 'Metaanaliza 24 badań błądzenia myśli: obok sieci spoczynkowej (przyśrodkowa kora przedczołowa, tylny zakręt obręczy) równie stale pracują obszary kontroli — m.in. rostrolateralna kora przedczołowa i grzbietowa część przedniego zakrętu obręczy.', refs: ['fox2015'] },
      ],
      strength: 'strong',
      forYou: 'Odpływające myśli to nie porażka. W treningu liczy się łagodny powrót — i każdy taki powrót jest właśnie ćwiczeniem, które widzi opaska.',
      link: '#trening/focus',
    },
    {
      id: 'emotion',
      title: 'Emocje i ich regulacja',
      short: 'Kora przedczołowa nie wyłącza emocji, ale pomaga przeżyć je mądrzej — przez skierowanie uwagi albo zmianę znaczenia sytuacji.',
      body: [
        { text: 'Emocje powstają w wielu miejscach mózgu, także głęboko pod korą — m.in. w ciele migdałowatym. Kora przedczołowa i zakręt obręczy mogą tę odpowiedź łagodzić.', refs: ['ochsner2005', 'buhle2014'] },
        { text: 'Najlepiej zbadane są dwie drogi: skierować uwagę gdzie indziej albo zmienić sposób myślenia o sytuacji. Tę drugą psychologowie nazywają przewartościowaniem — na przykład: „on nie jest niegrzeczny, ma po prostu zły dzień”.', refs: ['ochsner2005', 'buhle2014'] },
        { text: 'Przewartościowanie angażuje obszary kontroli w korze czołowej i ciemieniowej, a w efekcie zmniejsza pobudzenie ciała migdałowatego.', refs: ['buhle2014'] },
      ],
      points: [
        { text: 'Metaanaliza 48 badań: przewartościowanie stale pobudzało obszary kontroli poznawczej i boczną korę skroniową oraz zmieniało aktywność ciała migdałowatego po obu stronach.', refs: ['buhle2014'] },
        { text: 'Wniosek autorów: kontrola poznawcza zmienia znaczenie tego, co widzimy, i dopiero ten nowy sens wycisza ciało migdałowate.', refs: ['buhle2014'] },
        { text: 'Inna metaanaliza (23 badania, 479 osób) proponuje podział ról: grzbietowo-boczna kora przedczołowa kieruje uwagą, brzuszno-boczna sygnalizuje, że trzeba coś uregulować, a środkowa część zakrętu obręczy łączy te informacje.', refs: ['kohn2014'] },
        { text: 'Obie drogi — kierowanie uwagą i zmiana znaczenia — opierają się na współpracy przedczołowych systemów kontroli z systemami, które emocje wytwarzają.', refs: ['ochsner2005'] },
      ],
      strength: 'strong',
      forYou: 'Gdy emocja jest silna, spróbuj spojrzeć na sytuację z innej strony albo świadomie przenieść uwagę. To te same drogi regulacji, które badacze widzą w mózgu.',
      link: '#gra/serce',
    },
    {
      id: 'stress',
      title: 'Stres',
      short: 'Kora przedczołowa najmocniej w całym mózgu odczuwa stres — ale jej osłabienie często mija, gdy stres odpuszcza.',
      body: [
        { text: 'W ostrym stresie mózg przestawia się na szybkie, nawykowe reakcje. Nawet łagodny, ale niekontrolowany stres może szybko i wyraźnie osłabić zdolności, za które odpowiada kora przedczołowa.', refs: ['arnsten2009'] },
        { text: 'Długotrwały stres zmienia nawet budowę komórek nerwowych w tej okolicy. Dobra wiadomość: te zmiany nie muszą być trwałe. Kora przedczołowa jest bardzo plastyczna przez całe życie, choć z wiekiem staje się mniej odporna.', refs: ['arnsten2009', 'mcewen2013'] },
      ],
      points: [
        { text: 'Kora przedczołowa jest obszarem mózgu najbardziej wrażliwym na szkodliwe działanie stresu; długi stres zmienia rozgałęzienia (dendryty) jej neuronów.', refs: ['arnsten2009'] },
        { text: 'Metaanaliza: ostry stres osłabia pamięć roboczą i elastyczność; jego wpływ na hamowanie jest bardziej złożony, a wiele efektów zależy od innych czynników, np. płci.', refs: ['shields2016'] },
        { text: 'Badanie z rezonansem: u 20 zdrowych osób miesiąc stresu psychospołecznego osłabił kontrolę uwagi i połączenia w sieci czołowo-ciemieniowej. Po miesiącu mniejszego stresu nie różnili się już od grupy spokojnej.', refs: ['liston2009'] },
        { text: 'Zmiany wywołane stresem nie muszą być trwałe: u młodych zwierząt neurony odzyskują sprawność, gdy stres ustaje; z wiekiem ta odporność maleje.', refs: ['mcewen2013'] },
      ],
      strength: 'moderate',
      forYou: 'Gdy w stresie nie możesz zebrać myśli, to nie wada charakteru, tylko fizjologia. Odpoczynek, sen i spokojny oddech dają korze przedczołowej szansę wrócić do formy.',
      link: '#gra/drzewo',
    },
    {
      id: 'anxiety',
      title: 'Lęk',
      short: 'W zaburzeniach lękowych za mocno pracują obszary alarmowe mózgu; kora przedczołowa pomaga uczyć się, że już jest bezpiecznie.',
      body: [
        { text: 'Lęk jest potrzebny — chroni przed niebezpieczeństwem. Kłopot zaczyna się wtedy, gdy alarm włącza się za często, za mocno albo nie chce się wyłączyć.', refs: [] },
        { text: 'U osób z różnymi zaburzeniami lękowymi silniej pracują ciało migdałowate i wyspa — te same struktury, które u zdrowych reagują, gdy uczą się strachu. W zespole stresu pourazowego (PTSD) słabiej pracują dodatkowo obszary pomagające regulować emocje, w tym brzuszno-przyśrodkowa kora przedczołowa.', refs: ['etkin2007'] },
        { text: 'Oduczanie się strachu, tzw. wygaszanie, to aktywne uczenie się z własnymi obwodami w mózgu, badanymi równolegle u zwierząt i u ludzi; wiąże się z nim m.in. brzuszno-przyśrodkowa kora przedczołowa.', refs: ['milad2012', 'buhle2014'] },
      ],
      points: [
        { text: 'Metaanaliza badań PTSD, fobii społecznej i fobii specyficznej: we wszystkich trzech silniej aktywne ciało migdałowate i wyspa.', refs: ['etkin2007'] },
        { text: 'Tylko w PTSD słabiej pracowały grzbietowa i przednia część zakrętu obręczy oraz brzuszno-przyśrodkowa kora przedczołowa — obszary związane z przeżywaniem i regulacją emocji.', refs: ['etkin2007'] },
        { text: 'Wygaszanie strachu stało się wzorem badań „od zwierząt do człowieka” — dzięki ścisłej współpracy obu tych dziedzin.', refs: ['milad2012'] },
        { text: 'Zmiana znaczenia sytuacji (przewartościowanie) zmniejsza pobudzenie ciała migdałowatego.', refs: ['buhle2014'] },
        { text: 'U zdrowych osób powolny oddech wiązał się z mniejszym pobudzeniem i słabszymi objawami lęku.', refs: ['zaccaro2018'] },
      ],
      strength: 'moderate',
      forYou: 'Jeśli lęk odbiera Ci sen albo zwykłe życie, porozmawiaj z lekarzem lub psychoterapeutą. Spokojny oddech i modlitwa mogą pomóc się wyciszyć, ale nie zastąpią leczenia.',
    },
    {
      id: 'depression',
      title: 'Depresja',
      short: 'W depresji zmienia się praca kory przedczołowej i cierpi myślenie; dlatego to właśnie przednia część mózgu jest celem stymulacji magnetycznej.',
      body: [
        { text: 'Depresja to nie tylko smutek. Często osłabia też koncentrację, pamięć roboczą i podejmowanie decyzji — to realne, mierzalne trudności, a nie lenistwo.', refs: ['snyder2013'] },
        { text: 'Różne metody — obrazowanie, badania osób po urazach mózgu i stymulacja mózgu — wskazują na dwie kluczowe okolice: brzuszno-przyśrodkową i grzbietowo-boczną korę przedczołową, które w depresji pełnią różne role.', refs: ['koenigs2009'] },
        { text: 'Powtarzalna przezczaszkowa stymulacja magnetyczna (rTMS) to metoda leczenia, w której cewka przy głowie pobudza wybrany fragment kory — w depresji zwykle grzbietowo-boczną korę przedczołową. O leczeniu zawsze decyduje lekarz.', refs: ['koenigs2009', 'brunoni2017'] },
      ],
      points: [
        { text: 'Metaanaliza 113 badań: depresja wiąże się z gorszymi wynikami w testach funkcji wykonawczych (wielkość efektu od 0,32 do 0,97); trudności są większe przy cięższych objawach.', refs: ['snyder2013'] },
        { text: 'Obrazowanie, badania uszkodzeń i stymulacja mózgu zgodnie wskazują brzuszno-przyśrodkową i grzbietowo-boczną korę przedczołową jako kluczowe dla depresji — każdą z inną rolą.', refs: ['koenigs2009'] },
        { text: 'Sieciowa metaanaliza 81 badań z losowaniem (4 233 pacjentów): kilka form rTMS działało w ostrym epizodzie depresji lepiej niż stymulacja pozorowana; nowsze odmiany (przyspieszona, głęboka) — nie.', refs: ['brunoni2017'] },
        { text: 'Metaanaliza 121 badań fNIRS — tą samą metodą, której używa Mendi: przy zadaniu słownym kora czołowa i skroniowa osób z depresją słabiej zwiększała natlenienie niż u osób zdrowych.', refs: ['yeung2021'] },
        { text: 'To różnice średnich w grupach. Ani fNIRS, ani asymetria fal EEG nie pozwalają dziś rozpoznać depresji u jednej osoby.', refs: ['yeung2021', 'vandervinne2017'] },
      ],
      strength: 'moderate',
      forYou: 'Emmanuel nie rozpoznaje ani nie leczy depresji. Jeśli od tygodni czujesz smutek, pustkę albo brak sił, porozmawiaj z lekarzem. Trening może towarzyszyć leczeniu, ale go nie zastąpi.',
    },
    {
      id: 'decisions',
      title: 'Decyzje, wartości i samokontrola',
      short: 'Brzuszno-przyśrodkowa kora przedczołowa „wycenia” możliwości, a grzbietowo-boczna pomaga wybrać to, co ważniejsze w dłuższej perspektywie.',
      body: [
        { text: 'Przy każdym wyborze mózg porównuje bardzo różne rzeczy — smak, pieniądze, zdrowie, czas — na jednej wewnętrznej skali wartości. Taki wspólny sygnał wartości niesie brzuszno-przyśrodkowa kora przedczołowa razem z brzusznym prążkowiem.', refs: ['bartra2013'] },
        { text: 'Samokontrola nie wygląda na zwycięstwo „siły woli” nad pokusą. W znanym badaniu u osób, które panowały nad sobą, sygnał wartości obejmował także zdrowie, nie tylko smak — a grzbietowo-boczna kora przedczołowa była wtedy aktywniejsza i współpracowała z obszarem wyceny.', refs: ['hare2009'] },
      ],
      points: [
        { text: 'Metaanaliza 206 badań z rezonansem: brzuszno-przyśrodkowa kora przedczołowa i przednie brzuszne prążkowie tworzą „system wyceny”, który koduje subiektywną wartość — przy decyzji i przy nagrodzie, dla pieniędzy i dla nagród podstawowych.', refs: ['bartra2013'] },
        { text: 'Badanie z udziałem osób na diecie: aktywność brzuszno-przyśrodkowej kory przedczołowej śledziła wartość wyboru; grzbietowo-boczna była aktywniejsza, gdy ktoś panował nad sobą, i jej aktywność szła w parze z aktywnością obszaru wyceny.', refs: ['hare2009'] },
        { text: 'Opieranie się pokusom jest jedną z funkcji wykonawczych — tych samych, które osłabiają stres i brak snu.', refs: ['diamond2013'] },
      ],
      strength: 'moderate',
      forYou: 'Ważne decyzje podejmuj wypoczęty i spokojny, nie w pośpiechu. I przypominaj sobie, co jest dla Ciebie naprawdę ważne — u osób panujących nad sobą sygnał wartości obejmował także cel na dłużej.',
    },
    {
      id: 'social',
      title: 'Drugi człowiek: rozumienie i empatia',
      short: 'Przyśrodkowa kora przedczołowa należy do sieci, która pracuje, gdy próbujemy zrozumieć myśli i uczucia innych.',
      body: [
        { text: 'Zdolność rozumienia, co ktoś myśli, czego chce i co czuje, psychologowie nazywają teorią umysłu. Badania obrazowe konsekwentnie wskazują tu na przyśrodkową korę czołową.', refs: ['amodio2006'] },
        { text: 'Niezależnie od tego, czy ludzie czytali opowiadania, oglądali rysunki czy filmy, pojawiał się ten sam rdzeń: przyśrodkowa kora przedczołowa i okolica skroniowo-ciemieniowa po obu stronach mózgu.', refs: ['schurz2014'] },
      ],
      points: [
        { text: 'Zbieżne dane z badań obrazowych wskazują na wyjątkową rolę przyśrodkowej kory czołowej w poznaniu społecznym.', refs: ['amodio2006'] },
        { text: 'Metaanaliza badań teorii umysłu: wspólna aktywność przyśrodkowej kory przedczołowej i obustronnej tylnej okolicy skroniowo-ciemieniowej, bez względu na formę zadania — rdzeń sieci rozumienia innych.', refs: ['schurz2014'] },
        { text: 'Badanie wierzących chrześcijan: osobista modlitwa własnymi słowami — w odróżnieniu od wyuczonej formuły — pobudzała te same obszary poznania społecznego, w tym przyśrodkową korę przedczołową.', refs: ['schjoedt2009'] },
      ],
      strength: 'moderate',
      forYou: 'Uważne słuchanie drugiej osoby i pytanie siebie, co ona może teraz czuć, to codzienne korzystanie z tej sieci.',
      link: '#gra/brzemiona',
    },
    {
      id: 'sleep',
      title: 'Sen',
      short: 'Po nieprzespanej nocy najbardziej cierpi uwaga, a kora przedczołowa pracuje słabiej.',
      body: [
        { text: 'Brak snu to nie tylko zmęczenie. Już jedna zarwana noc wyraźnie pogarsza utrzymanie uwagi i pamięć roboczą, a obrazowanie pokazuje słabszą pracę sieci uwagi w korze czołowej i ciemieniowej.', refs: ['lim2010', 'ma2015'] },
        { text: 'Sen i emocje są ze sobą ściśle związane: niemal wszystkim zaburzeniom nastroju i lękowym towarzyszą kłopoty ze snem. Badacze sądzą, że sen — zwłaszcza faza REM — pomaga mózgowi przywrócić emocjonalną równowagę na kolejny dzień.', refs: ['goldstein2014'] },
      ],
      points: [
        { text: 'Metaanaliza 70 prac (147 testów), deprywacja snu krótsza niż 48 h: od małego, nieistotnego wpływu na trafność rozumowania (g = −0,125) do dużego wpływu na luki w prostej uwadze (g = −0,776).', refs: ['lim2010'] },
        { text: 'Metaanaliza 11 badań obrazowych (185 osób): po nieprzespanej nocy słabiej pracowały m.in. prawa kora przedczołowa, przyśrodkowa kora czołowa, bruzda śródciemieniowa i wyspa.', refs: ['ma2015'] },
        { text: 'Związek snu z emocjonalną pracą mózgu jest bliski i przyczynowy; sen REM może wspierać emocjonalną równowagę mózgu.', refs: ['goldstein2014'] },
        { text: 'Brak snu należy do głównych czynników, które osłabiają funkcje wykonawcze.', refs: ['diamond2013'] },
      ],
      strength: 'strong',
      forYou: 'Jeśli po słabej nocy trening idzie gorzej, to normalne. Dobry sen to jedna z najprostszych rzeczy, które możesz zrobić dla swojej kory przedczołowej.',
    },
    {
      id: 'exercise',
      title: 'Ruch',
      short: 'Regularny ruch wspiera myślenie — u starszych osób najwyraźniej funkcje wykonawcze; pojedynczy wysiłek daje mały efekt.',
      body: [
        { text: 'Ćwiczenia fizyczne należą do najlepiej zbadanych sposobów dbania o sprawność umysłu. U starszych osób najwięcej korzystały na nich właśnie funkcje wykonawcze, związane z korą przedczołową.', refs: ['colcombe2003'] },
        { text: 'Efekty są realne, ale skromne: jeden trening poprawia wyniki testów nieznacznie, a ruch przez miesiące daje mały, ogólny zysk. Najwięcej dawały ćwiczenia wymagające koordynacji.', refs: ['chang2012', 'ludyga2020'] },
      ],
      points: [
        { text: 'Metaanaliza 18 badań z udziałem zdrowych, mało aktywnych seniorów: trening wytrzymałościowy przynosił wyraźne, ale wybiórcze korzyści — największe dla kontroli wykonawczej.', refs: ['colcombe2003'] },
        { text: 'Metaanaliza 79 badań: jedna sesja ćwiczeń ma mały pozytywny wpływ na wyniki poznawcze (g = 0,097) — w trakcie, tuż po i jakiś czas po wysiłku.', refs: ['chang2012'] },
        { text: 'Metaanaliza 80 badań z losowaniem: długofalowy wpływ ruchu na myślenie jest mały i ogólny, nie dotyczy jednej funkcji; większy po ćwiczeniach koordynacyjnych.', refs: ['ludyga2020'] },
        { text: 'Przegląd badań fNIRS: podczas bardzo intensywnego wysiłku natlenienie kory przedczołowej czasem spada, a czasem nie — wyniki są niespójne, m.in. przez sygnały spoza mózgu.', refs: ['jung2025'] },
      ],
      strength: 'moderate',
      forYou: 'Spacer, taniec czy gra w piłkę pomagają głowie na dłuższą metę. Nie trenuj jednak z opaską w trakcie intensywnego wysiłku — sygnał jest wtedy mało wiarygodny.',
    },
    {
      id: 'prayer',
      title: 'Modlitwa, medytacja i oddech',
      short: 'Praktyki kontemplacyjne angażują m.in. korę przedczołową; dane są obiecujące, ale wciąż wstępne.',
      body: [
        { text: 'Medytacja to cała rodzina praktyk: skupienie na jednym punkcie, powtarzanie słowa, otwarta uważność, życzliwość wobec innych. Każda ma w mózgu nieco inny „podpis”, a niektóre obszary — m.in. biegun czołowy, wyspa i przedni zakręt obręczy — pojawiają się w wielu z nich.', refs: ['fox2016'] },
        { text: 'Badań nad modlitwą jest niewiele. W jednym z nich osobista modlitwa własnymi słowami angażowała obszary, których używamy w relacji z drugim człowiekiem — autorzy opisują ją jako doświadczenie spotkania, a nie samą recytację.', refs: ['schjoedt2009'] },
        { text: 'Najprostszym wejściem w ciszę jest powolny oddech. Przegląd systematyczny wiąże go z większą zmiennością rytmu serca, spokojniejszym zapisem EEG i lepszym samopoczuciem.', refs: ['zaccaro2018'] },
      ],
      points: [
        { text: 'Metaanaliza 78 badań obrazowych medytacji: różne style mają odrębne wzorce aktywności, a wspólne obszary są raczej wyjątkiem niż regułą; efekty średnie, przy wielu zastrzeżeniach metodologicznych.', refs: ['fox2016'] },
        { text: 'Metaanaliza badań budowy mózgu (21 badań, ok. 300 praktykujących): różnice m.in. w biegunie czołowym (świadomość własnych myśli), wyspie i korze oczodołowej; autorzy ostrzegają przed stronniczością publikacji.', refs: ['fox2014'] },
        { text: 'Osobista modlitwa pobudzała przyśrodkową korę przedczołową i okolicę skroniowo-ciemieniową — sieć poznania społecznego.', refs: ['schjoedt2009'] },
        { text: 'Przegląd 15 badań wolnego oddechu (mniej niż 10 oddechów na minutę): więcej fal alfa i mniej theta w EEG, większa zmienność rytmu serca, a w samopoczuciu więcej spokoju i czujności, mniej lęku i złości.', refs: ['zaccaro2018'] },
      ],
      strength: 'early',
      forYou: 'Badania pokazują, co dzieje się w mózgu, gdy się modlisz — nie mówią, kto słucha. Emmanuel nie wytwarza wiary; pomaga ćwiczyć ciszę, w której łatwiej się modlić.',
      link: '#gra/dlonie',
    },
    {
      id: 'life',
      title: 'Od dzieciństwa do starości',
      short: 'Kora przedczołowa dojrzewa najdłużej, aż do wczesnej dorosłości, a w starszym wieku często pracuje intensywniej, by utrzymać sprawność.',
      body: [
        { text: 'Kora mózgu dojrzewa etapami: najpierw obszary zmysłów (dotyku, wzroku), później te, które łączą informacje — a kora przedczołowa należy do ostatnich. Proces ten trwa przez lata nastoletnie i sięga wczesnej dorosłości.', refs: ['gogtay2004'] },
        { text: 'U nastolatków układ nagrody i emocji reaguje bardzo silnie, a kontrola impulsów wciąż się rozwija. To pomaga zrozumieć, skąd w tym wieku biorą się ryzykowne decyzje.', refs: ['casey2008'] },
        { text: 'U starszych osób kora przedczołowa często pracuje przy tych samych zadaniach mocniej niż u młodych, jakby mózg dokładał wysiłku. Plastyczność trwa przez całe życie, choć z wiekiem odporność na stres maleje.', refs: ['spreng2010', 'mcewen2013'] },
      ],
      points: [
        { text: 'Badanie podłużne (13 dzieci, rezonans co 2 lata, wiek 4–21 lat): obszary kojarzeniowe wyższego rzędu dojrzewają dopiero po korze zmysłowej; obszary starsze ewolucyjnie — wcześniej niż nowsze.', refs: ['gogtay2004'] },
        { text: 'W okresie dojrzewania wzmożona wrażliwość na nagrody i kontekst społeczno-emocjonalny idzie w parze z wciąż niedojrzałą kontrolą impulsów.', refs: ['casey2008'] },
        { text: 'Metaanaliza 80 grup badanych: osoby starsze angażowały korę przedczołową bardziej niż młode; przy równym wyniku — lewą, a przy słabszym — prawą.', refs: ['spreng2010'] },
        { text: 'Kora przedczołowa zachowuje plastyczność przez całe życie; z wiekiem jej neurony stają się mniej odporne na stres.', refs: ['mcewen2013'] },
        { text: 'U seniorów ruch najbardziej wspierał właśnie funkcje wykonawcze.', refs: ['colcombe2003'] },
      ],
      strength: 'moderate',
      forYou: 'Na ćwiczenie uwagi nigdy nie jest za późno — mózg zmienia się przez całe życie.',
    },
    {
      id: 'neurofeedback',
      title: 'Neurofeedback: co wiadomo, a czego jeszcze nie',
      short: 'Ludzie potrafią nauczyć się zmieniać sygnał własnej kory przedczołowej; czy i jak przekłada się to na codzienne życie, wciąż nie wiadomo na pewno.',
      body: [
        { text: 'Neurofeedback to trening z lustrem: aplikacja na bieżąco pokazuje sygnał Twojego mózgu, a Ty uczysz się go zmieniać. Tak działa Emmanuel — kula, gra czy światło odpowiadają na pracę Twojej kory przedczołowej.', refs: ['sitaram2017'] },
        { text: 'Badania z fNIRS pokazują, że w ten sposób da się wpływać na natlenienie kory przedczołowej. Jest ich jednak wciąż niewiele, są małe i różnorodne, a dobrze kontrolowane badania kliniczne często nie potwierdzają efektów widzianych w słabszych.', refs: ['kohl2020', 'cortese2016'] },
        { text: 'Z badań nad treningiem umysłu wiadomo też, że trening poprawia głównie to, co się ćwiczy — a dużo mniej to, co od ćwiczenia dalekie.', refs: ['melbylervag2016'] },
      ],
      points: [
        { text: 'Wyuczona przez neurofeedback kontrola nad konkretnymi obszarami mózgu potrafi zmieniać konkretne zachowania; mechanizmy dopiero zaczynamy rozumieć.', refs: ['sitaram2017'] },
        { text: 'Przegląd systematyczny 22 badań neurofeedbacku fNIRS (441 osób): ludzie potrafią regulować sygnał kory; jakość badań umiarkowana, brakuje dużych badań z losowaniem, wnioski o skuteczności klinicznej są przedwczesne.', refs: ['kohl2020'] },
        { text: 'Metaanaliza 13 badań z losowaniem (ADHD, 520 osób): poprawę widzieli głównie oceniający, którzy wiedzieli o leczeniu; przy ocenach „w ciemno” i w porównaniu z treningiem pozorowanym efekt nie był istotny.', refs: ['cortese2016'] },
        { text: 'Metaanaliza 87 publikacji o treningu pamięci roboczej: poprawa w ćwiczonych i bliskich zadaniach, brak przekonujących dowodów na przeniesienie na inteligencję czy czytanie.', refs: ['melbylervag2016'] },
      ],
      strength: 'early',
      forYou: 'Traktuj Emmanuela jak lustro i nawyk ciszy, nie jak cudowną kurację. Najwięcej dają regularność, sen, ruch i modlitwa; opaska pomaga zauważyć, kiedy uwaga odpływa.',
      link: '#trening/focus',
    },
    {
      id: 'practice',
      title: 'Co z tego wynika w praktyce',
      short: 'Kora przedczołowa najlepiej pracuje, gdy jesteś wyspany, spokojny i w ruchu — a uwagę ćwiczy się cierpliwym powracaniem.',
      body: [
        { text: 'Z badań wyłania się prosty obraz. Kora przedczołowa jest potężna, ale delikatna: szybko słabnie w stresie i bez snu, a wraca do formy, gdy dostanie odpoczynek. Nie jest „ośrodkiem silnej woli”, tylko częścią sieci, która uczy się przez powtarzanie.', refs: ['arnsten2009', 'liston2009', 'menon2011'] },
        { text: 'Nie musisz zmieniać wszystkiego naraz. Wybierz jedno: sen, ruch, kilka minut powolnego oddechu albo krótką, codzienną chwilę skupienia.', refs: [] },
      ],
      points: [
        { text: 'Sen: brak snu najmocniej uderza w prostą, długą uwagę.', refs: ['lim2010'] },
        { text: 'Stres: osłabienie kory przedczołowej po miesiącu stresu minęło, gdy stres zmalał.', refs: ['liston2009'] },
        { text: 'Ruch: regularny wysiłek daje mały, ale ogólny zysk dla myślenia.', refs: ['ludyga2020'] },
        { text: 'Oddech: powolny oddech wiązał się z większym spokojem i czujnością.', refs: ['zaccaro2018'] },
        { text: 'Realizm: trening poprawia głównie to, co ćwiczysz — ćwicz więc to, czego potrzebujesz w życiu: ciszę, uwagę i powrót.', refs: ['melbylervag2016'] },
      ],
      forYou: 'Zacznij od kilku minut dziennie. Gdy myśli odpłyną, wróć — bez oceniania. To właśnie jest trening.',
      link: '#trening',
    },
  ],

  limits: {
    title: 'Granice tej wiedzy',
    points: [
      { text: 'Większość badań pokazuje związki, nie przyczyny: to, że jakiś obszar „świeci” podczas zadania, nie znaczy, że tylko on za nie odpowiada.', refs: [] },
      { text: 'Mózg pracuje w sieciach. Nie ma „ośrodka silnej woli” ani „ośrodka empatii” — skróty w rodzaju „kora przedczołowa = siła woli” to mit.', refs: ['menon2011'] },
      { text: 'Wyniki to średnie z grup. Nie da się z nich wyczytać diagnozy dla jednej osoby — ani z rezonansu, ani z opaski.', refs: ['yeung2021', 'vandervinne2017'] },
      { text: 'Pomiar z czoła może zawierać sygnały spoza mózgu, a dowody na skuteczność neurofeedbacku są wciąż skromne.', refs: ['tachtsidis2016', 'kohl2020', 'cortese2016'] },
      { text: 'Ten tekst nie jest poradą medyczną. W sprawach zdrowia — ciała i psychiki — rozmawiaj z lekarzem.', refs: [] },
    ],
  },

  reviewed: '2026-11',
};

export default article;
