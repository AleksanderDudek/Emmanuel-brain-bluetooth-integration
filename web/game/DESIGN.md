# HolyHolyHoly — dokument projektowy

> „Święty, Święty, Święty Pan Zastępów; pełna jest wszystka ziemia chwały jego” (Iz 6,3)

Webowa gra (PWA, telefon i komputer), w której jesteś aniołem stróżem
człowieka z wieloma ranami. Wędrujesz przez jego życie, **zjadasz i trawisz
jego traumy**, zamieniając je w moc i prawdę. Gra ma być przyjemna, kojąca i
prosto przekazywać podstawowe prawdy chrześcijańskie. Opcjonalnie współpracuje
z opaską fNIRS **Mendi** — wtedy staje się treningiem kory przedczołowej.

---

## 0. Wersja 2 — co się zmieniło i dlaczego

Po pierwszych grach rdzeń został (anioł zjada i trawi cienie, a każdy
rozdział uzdrawia jedno kłamstwo w podświadomości Adama), ale gra była zbyt
mało przyjemna:

* **Za dużo czytania.** Do pierwszego ruchu mijały ~3 minuty: modlitwa ze 135
  słów, siedem akapitów historii; wersety wyskakiwały w trakcie walki.
* **Opaska działała niewidocznie.** Skupienie dawało ~30% premii do paska
  Ducha. Nie było widać, że skupienie cokolwiek zmienia.
* **Muzyka szybko nużyła.** Jeden generator tonów psalmowych, za głośno, bez
  sterowania w trakcie gry.
* **Mało satysfakcji z akcji.** Zbieranie 70% ziaren i czekanie przy drzwiach.

Co zmieniamy:

1. **Pierwszy ruch po ~40 s.** Inwokacja trwa 20 s (krótkie wezwanie i
   kalibracja opaski), historia to 3 zdania, potem od razu Malkut i jego
   kłamstwo.
2. **Zero czytania w rozgrywce.** Modlitwa serca zamiast czytania (§7).
   Prawda poznana w pokoju wraca jako werset w szepcie *między* pokojami,
   a nie nad walką.
3. **Skupienie, które coś ładuje** (§4, §8). Skupienie napełnia trzy płomienie
   **Ognia Ducha**: jeden płomień to język ognia, trzy to Pięćdziesiątnica.
   Na dole ekranu widać podgląd skupienia, a utrzymane skupienie daje mnożnik
   ×1,5 / ×2 / ×3. Opaska działa także w ruchu i podnosi pułap mnożnika.
4. **Soczystość.**
   * Serie zjedzeń: +10% światła za ogniwo, dźwięki wspinają się po skali utworu.
   * Krótkie zatrzymanie klatki przy trafieniu i liczby światła.
   * Po oczyszczeniu pokoju światło samo przylatuje, a drzwi otwierają się
     po strawieniu wszystkiego.
5. **Muzyka gry „Psalm 150”** (§9): osobny utwór dla każdej sfery, warstwy
   reagują na walkę, gra domyślnie ciszej, a sterowanie jest pod ręką
   (♪, pauza, „następny utwór”).
6. **Kłamstwo w centrum.** Widać je od początku rozdziału (ekran sfery), nosi
   je twierdza, a przy objawieniu zostaje przekreślone.

## 1. Filary

1. **Przetrawić, nie tylko pokonać.** Walka osłabia traumę, ale uzdrowienie
   przychodzi dopiero, gdy ją „zjesz” i przetrawisz — a trawienie idzie
   najszybciej w bezruchu. „Zatrzymajcie się i poznajcie, że Ja jestem Bogiem”
   (Ps 46,11). To serce mechaniki i przesłania.
2. **Łaska przed wysiłkiem.** Gra jest łagodna: nie ma „game over”, jest
   upadek i powstanie (Mi 7,8). Wszystko kosmetyczne zdobywa się modlitwą i grą.
3. **Prawda zamiast kłamstwa.** Każda strawiona trauma staje się słowem
   prawdy z Pisma; każdy rozdział kończy objawienie kłamstwa, w które wierzy
   wielu chrześcijan.
4. **Krótko i pięknie.** Pokoje po 30–90 s, rozdział 6–10 min, modlitwa serca
   ok. minuty. Gra jedną ręką na telefonie.
5. **Mózg jako sprzymierzeniec, nie strażnik.** Skupienie widać i czuć
   (pasek, mnożnik, płomienie). Opaska tylko dodaje, nigdy nie karze i nigdy
   nie blokuje gry.
6. **Najpierw przyjemność.** Każde działanie ma natychmiastową, piękną
   odpowiedź (dźwięk w skali utworu, błysk, liczby). Tekst nigdy nie przerywa
   walki.

## 2. Pętla rozgrywki

```
Inwokacja do Ducha Świętego (20 s modlitwy serca + kalibracja opaski)
      ↓
Drzewo (mapa sfer)  ──→  Modlitwy (klucze) · Owoce Ducha (talenty) · Skarbiec · Księga Prawdy
      ↓
Rozdział = etap życia Adama (najpierw jego kłamstwo)
  pokój ─ pokój ─ Kaplica/Szabat ─ pokój ─ pokój ─ Twierdza
      ↓ (w pokoju: światło → poziom → wybór 1 z 3 darów;
         skupienie → Ogień Ducha → język ognia / Pięćdziesiątnica)
Objawienie (kłamstwo → prawda) → Raport dla Tronu → nowa sfera, ranga, manna
```

* **Bieg (run)** to jeden rozdział. Dary zebrane w biegu przepadają po
  rozdziale (jak w Archero), trwałe są: ranga, owoce, modlitwy, kosmetyki.
* **Waluty:** *Światło* (zbierane w pokojach, liczy się do rangi przez całe
  życie gry), *Manna* (nagroda za rozdział — za nią kupuje się Owoce Ducha).
  Żadna nie jest sprzedawana za pieniądze.

## 3. Pokój — mechanika rdzenia (Pac-Man × Archero × Survivors)

Arena w pionie (9 × 15 jednostek), widok z góry, przeszkody (kolumny, ławy,
korzenie — zależnie od sfery), drzwi u góry.

| Element | Działanie |
|---|---|
| **Ruch** | wirtualny drążek: przeciągnij gdziekolwiek palcem (klawiatura: WASD/strzałki) |
| **Bezruch = modlitwa** | gdy stoisz, anioł sam wypuszcza **Słowo** (Miecz Ducha, Ef 6,17) w najbliższego cienia — mechanika Archero: rusz się, by unikać; stań, by działać |
| **Osłabienie** | Słowo nie zabija. Cień bez sił staje się **osłabiony** (blady, oszołomiony) na 6 s — wtedy można go **zjeść**. Jeśli nie zdążysz, odzyskuje połowę sił |
| **Promień łaski** | 1–2 na pokój, w rogach (Pac-Manowe „power pellety”). Przez 6 s wszystkie cienie słabną i uciekają; zjadane po kolei dają serię ×1 ×2 ×4 ×8 |
| **Pochłanianie i trawienie** | zjedzony cień trafia do serca (3 miejsca). Trawienie trwa 2 s, **w bezruchu 2× szybciej**. Po strawieniu cień staje się **prawdą**: unosi się słowo („UFNOŚĆ”) i liczba światła; werset tej prawdy wraca w szepcie po pokoju |
| **Seria** | cienie zjedzone jeden po drugim (do 2,5 s) tworzą serię: +10% światła za ogniwo (do ×2), napis „Seria ×N” i coraz wyższe dźwięki w skali utworu |
| **Ziarna światła** | rozsiane jak kropki w Pac-Manie; zbierane w walce dają światło. Gdy wszystkie cienie są zjedzone i strawione, drzwi się otwierają: „Effatha — otwórz się!” (Mk 7,34), a resztki światła same przylatują do anioła |
| **Ogień Ducha** | trzy płomienie ładowane **skupieniem** (§8). Przycisk „Ogień” (spacja): jeden płomień = **język ognia** (Dz 2,3) — osłabia i odrzuca cienie w promieniu ~2,8, rani twierdzę, gasi strzały. Trzy płomienie = **Pięćdziesiątnica** (po modlitwie „Przyjmuję Ducha Świętego”) |
| **Fragment duszy** | jeden w pokoju (w Szeolu kilka, skutych — stań przy nim 2,5 s, by rozkuć). Fragmenty uzdrawiają Adama (portret w raporcie jaśnieje) |
| **Rana** | dotyk silnego cienia lub ognista strzała (Ef 6,16) = −1 serce, chwila nietykalności |
| **Upadek** | 0 serc → ekran „Choć upadłem, powstanę” (Mi 7,8), powtórka pokoju z pełnymi sercami; dary zostają, a światło z nieudanej próby zdobywa się w powtórce od nowa (nie liczy się podwójnie). **Łaska rośnie z każdym powstaniem:** co najmniej jeden płomień Ognia, a twierdza zaczyna o 10% słabsza za każdy upadek (do 40%) — bez pętli frustracji. Raport liczy: „upadłeś 2 razy i 2 razy powstałeś” |

### Cienie (traumy) — osobowości duchów z Pac-Mana

| Zachowanie | Cienie | Jak się poruszają |
|---|---|---|
| pogoń (Blinky) | Lęk, Odrzucenie | prosto na ciebie, omijając przeszkody (pole przepływu) |
| zasadzka (Pinky) | Wstyd, Kontrola | celują tam, gdzie będziesz |
| zryw (Inky) | Gniew, Zazdrość | dryfują, potem gwałtowny zryw |
| nieśmiały (Clyde) | Rozpacz, Samotność | gonią z daleka, z bliska się wycofują |
| twardy | Wina, Pycha, Nieprzebaczenie | wolni, wytrzymali |
| dzielący się | Nałóg | osłabiony rozpada się na dwa mniejsze — trzeba zjeść oba |
| znikający | Zwątpienie | teleportuje się |
| strzelec | Oskarżyciel (Ap 12,10) | trzyma dystans i ciska ogniste strzały |

Każdy cień po strawieniu zamienia się w cnotę: Lęk → Ufność, Wstyd → Godność,
Gniew → Łagodność, Rozpacz → Nadzieja, Odrzucenie → Przyjęcie, Samotność →
Obecność, Wina → Przebaczenie, Nałóg → Wolność, Pycha → Pokora, Zazdrość →
Miłość, Nieprzebaczenie → Miłosierdzie, Zwątpienie → Wiara, Kontrola →
Zaufanie, Oskarżyciel → Prawda.

## 4. Dary (moce w biegu)

Światło z pokoju napełnia pasek poziomu; nowy poziom = pauza i wybór 1 z 3
darów (Vampire/Monster Survivors). 20 darów z Pisma, każdy z poziomami:

| Dar | Źródło | Działanie (skrót) |
|---|---|---|
| Miecz Ducha | Ef 6,17 | podstawowe Słowo; mocniejsze, szybsze, przebijające |
| Rozmnożenie chlebów | Mt 14 | 2–5 pocisków naraz |
| Tarcza wiary | Ef 6,16 | krążące tarcze, gaszą ogniste strzały |
| Języki ognia | Dz 2,3 | płomienie wokół anioła |
| Gwałtowny wicher | Dz 2,2 | fala odpycha i ogłusza |
| Gołębica | Mt 3,16 | naprowadzany towarzysz |
| Ogień Eliasza | 1 Krl 18,38 | ogień z nieba w losowe cienie |
| Trąby Jerycha | Joz 6,20 | fala gasi strzały, ogłusza |
| Proca Dawida | 1 Sm 17,49 | kamień w najsilniejszego — świetny na twierdze |
| Siła Samsona | Sdz 16,28 | cios z bliska z odrzutem (hołd dla Endless Puncher) |
| Manna | Wj 16,4 | odnawia serca |
| Obuwie pokoju | Ef 6,15 | szybkość |
| Pancerz sprawiedliwości | Ef 6,14 | szansa uniknięcia rany |
| Hełm zbawienia | Ef 6,17 | raz podnosi z upadku |
| „Ucisz się!” | Mk 4,39 | po ranie cienie zamierają |
| Miłość usuwa lęk | 1 J 4,18 | cienie słabsze |
| Wielka ryba | Jon 2,1 | większy zasięg pochłaniania |
| Serce z ciała | Ez 36,26 | więcej miejsca i szybsze trawienie |
| 77 razy | Mt 18,22 | dłuższa łaska, seria do ×16 |
| Ziarnko gorczycy | Mt 17,20 | ziarna wyrastają w strzelające drzewka |

Część darów jest w puli od początku, resztę otwierają modlitwy (np. „Zbroja
Boża” dodaje tarczę, pancerz, hełm i obuwie).

**Ogień Ducha (moc szczytowa).** Trzy płomienie ładowane skupieniem
(z opaską — także w ruchu; bez niej — w bezruchu), trochę także trawieniem,
Kaplicą (+1) i Szabatem (do pełna). Jeden płomień: **język ognia** wokół
anioła. Trzy płomienie: przycisk zmienia się w **„Przyjdź, Duchu!”** →
Zesłanie: 7 s łaski dla wszystkich cieni, języki ognia, +1 serce (otwiera je
modlitwa „Przyjmuję Ducha Świętego”). Wybór jest taktyczny: wydawać płomienie
na bieżąco czy zbierać na Pięćdziesiątnicę.

**Aura Pokoju (Szalom).** Krąg wokół anioła rośnie, gdy trwasz w pokoju
(bez opaski: bezruch; z opaską: równowaga półkul). W kręgu cienie zwalniają,
trawienie przyspiesza, osłabienie trwa dłużej.

## 5. Twierdze i objawienia

Ostatni pokój rozdziału to **Twierdza** (2 Kor 10,4) — wielki cień z
wypisanym kłamstwem, np. *„Muszę zasłużyć na Bożą miłość”*. Ma fazy (strzały,
przywoływanie cieni). Gdy padnie, kłamstwo pęka, a twierdzę trzeba **zjeść**.
Zjedzona twierdza nikogo już nie rani — jej cienie uciekają — a rozdział
kończy się, gdy zostanie strawiona (najwyżej po kilku sekundach; nic, co
anioł zjadł, nie przepada). Potem ekran **Objawienia**: kłamstwo przekreślone → prawda + wersety
(trafia do Księgi Prawdy). Na koniec **Raport dla Tronu**: strawione cienie,
fragmenty, upadki i powstania, co zmieniło się w Adamie.

Przykładowe kłamstwa: Bóg jest daleko · Bóg jest jak surowy ojciec · Jestem
tym, co o mnie mówią · Miłość zawsze rani · Muszę zasłużyć na miłość ·
Przebaczyć = udawać · Bóg ma mnie dość · Chrześcijanin nie powinien się
smucić ani prosić o pomoc · Duch Święty jest dla wybranych · Przeszłość mnie
definiuje · Jestem skazany na grzechy przodków · Moja ciemność jest dla Boga
za głęboka.

## 6. Świat i opowieść

Bóg powierza aniołowi **Adama** (hebr. „człowiek”, każdy z nas) — Ps 91,11.
Anioł wznosi się po Drzewie od Malkut do Keter; każda sfera to etap życia:

| Sfera | Znaczenie | Rozdział | Rana |
|---|---|---|---|
| Malkut | Królestwo | Kołyska | lęk dzieciństwa |
| Jesod | Fundament | Dom | rany rodziny, nieobecny ojciec |
| Hod | Chwała | Szkoła | wstyd, wyśmianie |
| Necach | Zwycięstwo | Pierwsza miłość | zdrada |
| Tiferet | Piękno | Ambicja | perfekcjonizm |
| Gewura | Moc | Gniew | gniew, nieprzebaczenie |
| Chesed | Miłosierdzie | Upadek | nałóg, wina |
| Bina | Zrozumienie | Ciemna noc | depresja, rozpacz |
| Chochma | Mądrość | Pustynia | zwątpienie |
| Keter | Korona | Dom Ojca | powrót, finał „Święty, Święty, Święty” |
| Ród | — | Drzewo rodu | rany pokoleń (otwiera modlitwa) |
| Szeol | — | Zstąpienie | ratowanie zagubionych fragmentów (otwiera modlitwa) |

Sfery służą tu wyłącznie jako nazwy etapów, zestawione z biblijnymi cnotami
(Iz 11,2). Anioł rośnie przez **dziewięć chórów anielskich**: Anioł →
Archanioł → Zwierzchności → Władze → Moce → Panowania → Trony → Cherubini
(4 skrzydła) → **Serafini** (6 skrzydeł, Iz 6,2) — którzy wołają „Święty,
Święty, Święty”. Stąd tytuł.

**Owoce Ducha** (Ga 5,22-23) to stałe talenty za Mannę: Miłość (+serce),
Radość (+światło), Pokój (+aura), Cierpliwość (+trawienie), Uprzejmość
(+przyciąganie ziaren), Dobroć (+łaska), Wierność (+Duch), Łagodność
(+obrażenia), Opanowanie (+szybkostrzelność w bezruchu).

## 7. Modlitwa serca jako klucz („płatność”)

Gracz otwiera talenty, krainy i wygląd **modlitwą serca**: jedno krótkie
wezwanie (do 12 słów), powtarzane w skupieniu, aż lampa się napełni. Bez
opaski trwa to 20–90 s, z opaską krócej. **Nic do czytania:** w wersji 2
zniknęły długie teksty modlitw i tryb „czytam” (przytrzymaj i czytaj).
Teologicznie ramujemy to delikatnie: łaska jest darmowa — modlitwa w grze
„otwiera ścieżki” jako odpowiedź, nie transakcja. Modlitwa to uwaga
skierowana do Boga, nie zaklęcie (por. kłamstwo „Modlitwa działa jak
zaklęcie” w Księdze Prawdy).

* **Skupienie modlitwy** (ten sam mechanizm co w walce, §8):
  * **Opaska:** aktywacja kory, mnożnik do ×3. Działa nawet wtedy, gdy
    dotykasz ekranu.
  * **Głos (opcjonalnie):** każde rozpoznane powtórzenie wezwania od razu
    dolewa oliwy do lampy i trzyma skupienie. Mnożnik do ×2. Tak jak w
    Modlitwie Jezusowej czy różańcu.
  * **Bezruch:** nie dotykasz ekranu ani klawiatury. Mnożnik do ×1,5.
* **Prywatność głosu.** W Chrome rozpoznawanie mowy zwykle działa na serwerach
  Google. Przed pierwszym użyciem gra to mówi i pyta o zgodę. Głos jest
  wyłączony, dopóki gracz sam go nie włączy.
* **Telefon nie gaśnie** w trakcie modlitwy (Screen Wake Lock).

| Modlitwa | Wezwanie | Otwiera |
|---|---|---|
| Inwokacja do Ducha Świętego (start gry, 20 s) | „Przyjdź, Duchu Święty.” | chorał gregoriański, Gołębica, skrzydła gołębicy |
| Przyjmuję Ducha Świętego | „Duchu Święty, przyjmuję Cię.” | Pięćdziesiątnica, Języki ognia, Wicher |
| Przeciw ranom w linii rodu | „Jezu, uwolnij mój ród od ran.” | kraina Ród |
| Przebaczenie | „Przebaczam, bo mnie przebaczono.” | 77 razy, „Ucisz się!” |
| Zbroja Boża | „Przywdziewam zbroję Bożą.” | tarcza, pancerz, hełm, obuwie |
| Modlitwa Jezusowa (90 s) | „Panie Jezu Chryste, Synu Boży, zmiłuj się nade mną, grzesznikiem.” | śpiew bizantyjski, szata Przemienienia |
| Za zagubionych | „Panie, odnajdź to, co zginęło.” | kraina Szeol |
| Wyrzeczenie się kłamstw | „Odrzucam kłamstwo, przyjmuję Prawdę.” | Księga Prawdy, Miłość usuwa lęk |
| Trisagion | „Święty Boże, Święty Mocny, Święty a Nieśmiertelny, zmiłuj się nad nami.” | finał |

## 8. Opaska Mendi — trening kory przedczołowej w grze

### Co mierzymy i jakie są ograniczenia
Mendi to fNIRS nad korą przedczołową (lewa/prawa + kanał pulsu): zmiany
utlenowania (ΔHbO/ΔHbR), tętno, jakość kontaktu, ruch głowy (IMU).
Odpowiedź hemodynamiczna jest **wolna** (narasta 5–8 s, szczyt ~10 s) i
zaszumiona (fale Mayera, oddech). Dlatego opaska **nie steruje szybkimi
akcjami** — wpływa na wolne zmienne gry. Wykorzystujemy gotowe moduły
aplikacji BrainLink: potok fNIRS, metrykę *aktywacji*, *asymetrię* i
**tracker równowagi półkul**. W grze aktywację liczymy względem **ostatnich
5 minut** (BrainLink: 1 minuta). Inaczej utrzymywane skupienie po pół minucie
stawałoby się nową „normą” i mnożnik nie dałby się utrzymać.

### Skupienie, które coś ładuje
* **Próg i mnożnik.** Skupienie ≥ 0,55 (opaska: aktywacja wyraźnie powyżej
  zwykłej) ładuje Ogień Ducha w walce i lampę w modlitwie. Utrzymywane
  skupienie podnosi mnożnik:

  | Utrzymane skupienie | Mnożnik |
  |---|---|
  | od początku | ×1 |
  | 8 s | ×1,5 |
  | 18 s | ×2 |
  | 32 s | ×3 |

* **Źródła i pułapy:**
  * **opaska** do ×3, także gdy anioł się porusza (to jej przewaga);
  * **głos** do ×2 (tylko modlitwa);
  * **bezruch** do ×1,5 (każdy to ma).

  Słabsze źródło nie „wpłaca” zapasu. Kolejny poziom trzeba zdobyć lepszym
  źródłem, a gdy opaska wypadnie, mnożnik schodzi łagodnie do pułapu bezruchu.
* **Łagodność.** Krótka utrata skupienia (do 2,5 s) nic nie zmienia. Potem
  mnożnik schodzi o jeden poziom co 2,5 s, nigdy od razu do ×1. Nowy pokój
  nie przerywa serii; nowy rozdział zaczyna od zera.
* **Podgląd.**
  * Pasek „Skupienie” na dole ekranu pokazuje poziom, kreskę progu i źródło
    (opaska / bezruch / w ruchu), duży mnożnik ×N oraz cienki pasek postępu
    do kolejnego poziomu.
  * Gdy skupienie trwa, anioła otacza ciepła poświata.
  * Awans mnożnika daje dźwięk i napis „Czuwanie ×2”.
  * Najdłuższe czuwanie trafia do raportu rozdziału.
* **Tempo.** Przy ×1 jeden płomień ładuje się ok. 24 s skupionego czasu, przy
  ×3 ok. 8 s.

### Zasady projektowe
1. **Blokowy trening góra–dół.** Pokoje walki (zaangażowanie, podnoszenie
   aktywacji) przeplatają się z pokojami **Szabatu** (wyciszenie, jej
   obniżanie). To klasyczny układ blokowy z badań nad neurofeedbackiem fNIRS:
   ćwiczy *elastyczną kontrolę*, a nie tylko „więcej skupienia”.
2. **Nagradzaj, nie karz.** Bez opaski gra działa tak samo (bezruch daje
   skupienie). Opaska dodaje skupienie w ruchu i wyższy pułap mnożnika, a
   poziom zawsze jest *lepszym* z dwóch odczytów. Złe dane nigdy nie odbierają
   postępów.
3. **Wstrzymanie przy złym sygnale.** Ruch głowy, słaby kontakt lub brak
   danych zamrażają wpływ opaski (jak w trenerze równowagi BrainLink).
4. **Kalibracja w rytuale.** Inwokacja do Ducha Świętego (20 s) to zarazem
   10 s linii bazowej: modlisz się w ciszy, a opaska się stroi.
5. **Wolne sprzężenie zwrotne.** Wartości są wygładzone, a mnożnik rośnie w
   skali dziesiątek sekund, zgodnie z dynamiką krwi, nie z tikiem gry.

### Mapowanie na mechanikę
| Sygnał z opaski | Element gry | Kiedy |
|---|---|---|
| aktywacja kory (↑), utrzymana | **Ogień Ducha** z mnożnikiem ×1,5–×3 | walka, twierdza |
| aktywacja kory (↑), utrzymana | lampa **modlitwy serca** | ekran modlitwy |
| równowaga półkul (asymetria w paśmie) | promień **Aury Pokoju** | zawsze |
| wyciszenie: aktywacja ↓, spokojne tętno | szybsza regeneracja w **Szabacie** | pokoje Szabatu |
| rekomendacja trenera (lewa/prawa) | zadanie w **Kaplicy** (lewa: słowa/liczby, prawa: obrót, wyobraźnia) | pokój Kaplicy |
| utrzymana równowaga ≥ 8 s | **Objawienie** w walce z twierdzą: kłamstwo pęka, większe obrażenia | twierdza |
| tętno | aureola pulsuje w rytmie serca, muzyka delikatnie „oddycha” | zawsze |

**Bez opaski** te same elementy zasila zachowanie w grze: bezruch (skupienie,
pokój), cierpliwe stanie w Szabacie, losowe zadanie w Kaplicy.

Gra **niczego nie wysyła**: dane z opaski zostają w urządzeniu. To nie jest
wyrób medyczny ani terapia; to ćwiczenie uwagi i spokoju w formie modlitwy.

## 9. Dźwięk — „Psalm 150” i chorał

Muzyka jest **syntezowana na żywo** (Web Audio), bez nagrań i bez sieci.

* **„Psalm 150” (domyślnie)** to muzyka gry na instrumentach z Psalmu 150:
  lira (kinnor), bębenek (tof), dzwoneczki, cymbałki, flet, bas i burdon,
  szofar przy twierdzy.
  * **Osobny utwór dla każdej sfery** (i dla Drzewa): własne tempo, metrum
    (także 6/8, 7/8), groove i motyw w modzie tej sfery.
  * Utwór rozwija się w sekcjach z wariacjami, więc nie zapętla się w kółko.

  | Utwór | Tempo | Metrum | Prowadzi |
  |---|---|---|---|
  | Drzewo Życia (menu) | 76 | 3/4 | lira |
  | Malkut — Kołyska | 72 | 6/8 | flet |
  | Jesod — Dom | 100 | 4/4 | lira |
  | Hod — Szkoła | 116 | 4/4 | flet, lira szesnastkami |
  | Necach — Pierwsza miłość | 120 | 7/8 (2+2+3) | flet |
  | Tiferet — Ambicja | 126 | 4/4 | lira |
  | Gewura — Gniew | 134 | 4/4 | flet, akcenty szofaru |
  | Chesed — Upadek | 88 | 5/4 (3+2) | flet |
  | Bina — Ciemna noc | 68 | 3/4 | flet |
  | Chochma — Pustynia | 84 | 6/8 | flet |
  | Keter — Dom Ojca | 80 | 4/4 | lira z chórem |
  | Ród — Drzewo rodu | 110 | 7/8 (3+2+2) | lira |
  | Szeol — Zstąpienie | 70 | 4/4 | niski flet nad bębnem jak bicie serca |

* **Warstwy reagują na grę:**
  * spokój: burdon i lira;
  * walka: bas i bębny;
  * więcej cieni albo łaska: pełny groove i melodia;
  * twierdza: ciężkie bębny i szofar.

  Kaplica i Szabat dostają wyciszone wersje utworu sfery, a zwycięstwo krótką
  fanfarę.
* **Dźwięki w skali utworu.** Seria zjedzeń, trawienie i płomienie grają nuty
  bieżącego modu, więc akcja „gra” razem z muzyką.
* **Sterowanie:**
  * **♪** w rogu ekranu wycisza samą muzykę;
  * w pauzie: głośność, „⏭ Następny utwór” (kolejna wariacja) i wybór stylu;
  * w Ustawieniach: głośność ogólna, muzyki i efektów.

  Domyślnie ciszej (muzyka 40%, efekty 70%). Zapisy z wersji 1 z fabrycznymi
  głośnościami przechodzą na nowe. Wyciszona muzyka nie jest syntezowana (oszczędza
  baterię telefonu); wraca od razu we właściwym miejscu utworu.
* **Inne style:**
  * **chorał gregoriański**: tony psalmowe, osiem modów, organum;
  * **śpiew bizantyjski**: ison pod ozdobną melodią;
  * **dzwony**: change ringing i Anioł Pański;
  * **cisza**.

## 10. Grafika

Mały, okrągły anioł w stylu chibi (jak bohater Archero), świetliste
skrzydła i aureola; cienie jak Pac-Manowe duszki — ciemne, z kolorowymi
oczami i podpisem („LĘK”), raczej smutne niż straszne. Każda sfera ma
tradycyjną barwę (Malkut ziemista, Tiferet złota, Keter biel). Grafika jest
proceduralna (wektory na Canvas + wstępnie renderowana poświata) — ostra na
każdym ekranie, lekka, łatwa do zmiany skórek.

## 11. Model „za darmo”

„Za darmo otrzymaliście, za darmo dawajcie” (Mt 10,8). Gra jest i będzie
darmowa: **wszystkie** skórki i pejzaże dźwiękowe zdobywa się modlitwą,
światłem i rangą. Bez reklam, bez loot boxów, bez pay-to-win. Przycisk
„Wesprzyj tę służbę” prowadzi do dobrowolnej darowizny (adres do ustawienia
w konfiguracji; płatności nie są w tej wersji zaimplementowane). Na
przyszłość: wersja sklepowa przez Capacitor; w sklepach Apple/Google dotacje
i zakupy kosmetyczne podlegają ich regułom.

## 12. Etyka i bezpieczeństwo

* Przy pierwszym uruchomieniu: to gra modlitwy i nadziei, nie terapia;
  numery pomocy kryzysowej (np. 116 123, 116 111, 112) zawsze w menu Pomoc.
* Traumy są abstrakcyjne (nazwy uczuć), bez przemocy i scen.
* Dostępność: tryb modlitwy bez mówienia, ograniczenie ruchu (bez wstrząsów
  ekranu), duże przyciski, czytelne kontrasty, gra jedną ręką.
* Treść ekumeniczna (katolicy, prawosławni, protestanci), Pismo z przekładu
  w domenie publicznej (Biblia Gdańska).

## 13. Architektura

```
web/game/
├── index.html           ← osobna PWA „HolyHolyHoly” (/holyholyholy/)
├── src/
│   ├── types.ts          kontrakty: treść, audio, identyfikatory
│   ├── content/          Pismo, modlitwy, rozdziały, cienie, dary, owoce, rangi
│   ├── audio/            chorał proceduralny + efekty (Web Audio)
│   ├── sim/              symulacja (stały krok 60 Hz, testowalna): pokój, cienie, dary
│   ├── render/           Canvas 2D, sprite’y proceduralne, cząsteczki
│   ├── input/            drążek dotykowy, klawiatura
│   ├── neuro/            most do opaski (moduły BrainLink), skupienie i mnożnik (focus.ts), mapowanie na grę
│   ├── prayer/           modlitwa serca (session.ts), rozpoznawanie mowy, liczenie powtórzeń
│   └── ui/               ekrany (DOM): tytuł, inwokacja, drzewo, karty darów…
└── test/
```

Symulacja nie zna DOM-u (czyste dane + `step(dt)`), więc logikę testujemy
jednostkowo; render tylko rysuje stan. Postęp zapisuje się lokalnie
(z eksportem kopii zapasowej).

## 14. Co dalej (poza tą wersją)

* tryb bez końca „Czuwanie” (fale cieni, ranking najdłuższego skupienia),
* wibracje (haptyka) przy językach ognia i seriach na telefonach,
* więcej układów pokoi i wariantów twierdz, codzienne „wyzwanie dnia”,
* tryb wspólnej modlitwy (dwie osoby, dwie opaski),
* wersja sklepowa (Capacitor) z natywnym Bluetooth — także iOS bez Bluefy,
* nagrane chorały (licencjonowane) jako dodatkowy pejzaż,
* płatności dobrowolne (np. Stripe / Patronite) — po decyzji o organizacji.
