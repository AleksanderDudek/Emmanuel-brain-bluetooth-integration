# HolyHolyHoly 3D: Burzenie twierdz — dokument projektowy

> „Albowiem broń żołnierstwa naszego nie jest cielesna, ale z Boga jest, mocna ku zburzeniu
> miejsc obronnych” (2 Kor 10,4)

Przeglądarkowa gra 3D zrobiona w silniku **GDevelop**, nowa interpretacja
[HolyHolyHoly](../game/DESIGN.md). Jesteś aniołem stróżem Adama. W kolejnych
rozdziałach jego życia rozbijasz traumy, które zamieniają się w prawdę, i burzysz
twierdze kłamstw, w które Adam uwierzył. Opaska fNIRS **Mendi** jest opcjonalna:
z nią skupienie liczy się także w ruchu.

---

## 0. Co się zmieniło względem gry 2D

| | HolyHolyHoly (2D) | HolyHolyHoly 3D |
|---|---|---|
| Silnik | własny kod TypeScript, Canvas 2D | **GDevelop 5** (sceny, zdarzenia, rozszerzenia), renderowanie 3D (three.js) |
| Rdzeń | Pac-Man × Archero × survivors: labirynt, ziarna, promienie łaski, duszki-cienie, **zjadanie i trawienie** | **Archero × survivors × Endless Puncher**: arena, fale, dary, ciosy w serii, **rozbijanie** traum |
| Modlitwy | modlitwy serca jako klucze, opcjonalnie wypowiadane na głos | **brak modlitw mówionych** i ekranów modlitwy; nic nie trzeba mówić ani czytać w trakcie gry |
| Odblokowania | modlitwa otwiera talenty i krainy | postęp: kolejne sfery otwiera ukończenie poprzedniej; Ród i Szeol otwierają Gewura i Bina |
| Muzyka | „Psalm 150”, synteza na żywo | ten sam silnik muzyczny jako rozszerzenie GDevelop (`Psalm150`) |
| Opaska | moduły BrainLink | te same moduły jako rozszerzenie GDevelop (`MendiFocus`) |

Temat zostaje: **rany stają się prawdą**. Zamiast zjadać cień, anioł go rozbija;
z rozbitego cienia wylatuje światło i unosi się jego prawda (Lęk → **UFNOŚĆ**,
Wstyd → **GODNOŚĆ**…). Kłamstwo rozdziału nosi twierdza, a jej upadek kończy się
objawieniem: kłamstwo zostaje przekreślone, a w jego miejsce pojawia się prawda
i werset (Biblia Gdańska).

Usunięte motywy Pac-Mana: labirynt i drzwi, ziarna do zbierania jak kropki,
„power pellets”, duszki z osobowościami Blinky/Pinky/Inky/Clyde, zjadanie
osłabionych cieni i serie zjedzeń.

## 1. Filary

1. **Trzy gry w jednej, każda czytelna.** Stój, a Słowo strzela samo (Archero).
   Fale cieni i 1 z 3 darów co poziom (survivors). Ciosy w serii, zanim cień
   podejdzie, a pudło przerywa serię (Endless Puncher).
2. **Łaska przed wysiłkiem.** Nie ma końca gry. Upadek to ekran „Choć upadłem,
   powstanę” (Mi 7,8) i powrót z pełnymi sercami; z każdym upadkiem twierdza
   słabnie o 10% (do 40%).
3. **Prawda zamiast kłamstwa.** Każdy rozbity cień pokazuje swoją prawdę, każda
   twierdza kończy się objawieniem i wpisem do Księgi Prawdy.
4. **Nic do czytania w walce.** Teksty są na kartach przed rozdziałem, w objawieniu
   i w menu. W walce są tylko krótkie napisy (fala, seria, Pięćdziesiątnica).
5. **Mózg jako sprzymierzeniec.** Skupienie ładuje Ogień Ducha. Opaska tylko dodaje
   (skupienie w ruchu, mnożnik do ×3), nigdy nie odbiera.
6. **Najpierw przyjemność.** Natychmiastowa odpowiedź na każde działanie: iskry,
   wstrząs, dźwięk w skali utworu, prawda unosząca się nad cieniem.

## 2. Pętla gry

```
Tytuł (menu, opaska, ustawienia, pomoc)
   ↓
Drzewo Życia (ogród z dziesięcioma sferami, Owoce Ducha, Księga Prawdy)
   ↓
Rozdział (Arena): karta rozdziału z kłamstwem
   fala 1 (≈55 s) → Szabat → fala 2 → Szabat → fala 3 → Szabat → Twierdza
   (w trakcie: światło → poziom → 1 z 3 darów; skupienie → Ogień Ducha)
   ↓
Objawienie: kłamstwo przekreślone, prawda, werset → Raport dla Tronu (nagrody)
   ↓
Drzewo: nowa sfera otwarta, ranga anielska, manna na Owoce Ducha
```

* **Dary** (Miecz Ducha, Tarcza wiary…) trwają tylko jeden rozdział.
  **Owoce Ducha**, ranga i Księga Prawdy zostają na zawsze.
* **Światło** liczy się do rangi (dziewięć chórów: Anioł → … → Cherub (4 skrzydła)
  → Seraf (6 skrzydeł, Iz 6,2)). **Manna** (nagroda za rozdział, więcej za pierwsze
  ukończenie) kupuje Owoce Ducha.

## 3. Arena — sterowanie i mechanika

Okrągła arena (promień 1500) w kolorach rozdziału, z rekwizytami (kolumny, ławy,
kamienie, świece, drzewa), widziana z góry i z tyłu.

| Akcja | Klawiatura / mysz | Dotyk |
|---|---|---|
| Ruch | WASD / strzałki | lewy kciuk (drążek pojawia się tam, gdzie dotkniesz) |
| Słowo (Archero) | samo, gdy stoisz | samo, gdy stoisz |
| Cios Samsona | spacja / J / klik | przycisk z gwiazdą |
| Ogień Ducha | E / K | przycisk z płomieniem |
| Pauza | Esc / P / przycisk II | przycisk II |
| Wybór daru | 1 / 2 / 3 lub klik | dotknięcie karty |

* **Słowo (Archero).** Gdy anioł stoi (≥ 0,18 s), Słowo leci w najbliższy cień w
  zasięgu 620. Rusz się, by uniknąć; stań, by działać.
* **Cios Samsona (Endless Puncher).** Cios trafia najbliższy cień w zasięgu 190:
  doskok, odrzut, ogłuszenie. Ciosy w odstępie do 1,1 s tworzą **serię ×N**:
  +10% obrażeń za ogniwo (do ×2) i +5% światła (do ×2). Cios w pustkę przerywa serię
  i kosztuje 0,45 s. Każde trafienie dolewa trochę Ognia Ducha.
* **Ogień Ducha.** Trzy płomienie ładowane skupieniem (§6). Jeden płomień: **język
  ognia** wokół anioła (promień 330, odrzut, gasi strzały). Trzy płomienie:
  **Pięćdziesiątnica** (cała arena, +1 serce, 3 s łaski).
* **Rany i łaska.** Dotyk cienia lub ognista strzała to −1 serce i chwila łaski.
  Zero serc to upadek i powstanie (filar 2).
* **Światło.** Rozbity cień zostawia okruchy światła; przyciąga je magnes (210),
  resztę trzeba zebrać. Poziomy rosną (6, potem ×1,32 + 3).

### Cienie (traumy)

Cień jest ciemną bryłą w barwie swojej rany, ze świecącymi oczami. Czternaście
traum z gry 2D ma osiem sposobów poruszania się:

| Ruch | Traumy | Jak walczy |
|---|---|---|
| pogoń | Lęk, Odrzucenie | prosto na anioła |
| krążenie | Wstyd, Kontrola | krąży, potem uderza |
| szarża | Gniew, Zazdrość | zbliża się, nabiera rozpędu (chwila na cios!), szarżuje |
| dryf | Rozpacz, Samotność | podchodzi i trzyma się z boku |
| ciężki | Wina, Pycha, Nieprzebaczenie | wolny, wytrzymały, więcej światła |
| podział | Nałóg | rozbity dzieli się na dwa mniejsze |
| przeskok | Zwątpienie | znika i pojawia się obok |
| oskarżenia | Oskarżyciel (Ap 12,10) | trzyma dystans, ciska ogniste strzały (Ef 6,16) |

W połowie każdej fali przychodzi **silny cień** (×4 sił, ×1,5 rozmiaru, czasem
zostawia mannę, która odnawia serce).

### Dary (1 z 3 przy każdym poziomie)

Bronie działają same, reszta zmienia anioła. Opisy poziomów są w
`assets/data/content.json`.

* **Bronie:** Miecz Ducha (Słowo: obrażenia, szybkostrzelność, przebicie),
  Rozmnożenie chlebów (wachlarz 2–5 Słów), Tarcza wiary (krążące tarcze, gaszą
  strzały), Języki ognia (płomienie wokół anioła), Gwałtowny wicher (fala odrzutu),
  Gołębica (sama nurkuje w cienie), Ogień Eliasza (ogień z nieba), Trąby Jerycha
  (fala zatrzymuje cienie i gasi strzały), Proca Dawida (kamień zawsze w
  najsilniejszego, także w twierdzę).
* **Cios:** Siła Samsona (siła, zasięg, odepchnięcie wokół).
* **Anioł:** Manna (serca), Obuwie pokoju (szybkość), Pancerz sprawiedliwości (unik),
  Hełm zbawienia (raz w rozdziale powstajesz od razu), „Ucisz się!” (po ranie cienie
  zamierają), Miłość usuwa lęk (cienie słabsze), Wielka ryba (magnes), Serce z ciała
  (+1 serce), Siedemdziesiąt siedem razy (dłuższa łaska i seria).

### Szabat

Po każdej fali: cienie rozpadają się w światło, które samo leci do anioła, wraca
jedno serce, muzyka cichnie. Po kilku sekundach przychodzi kolejna fala.

## 4. Twierdze (2 Kor 10,4)

Ostatnia część rozdziału: twierdza z wypisanym kłamstwem (np. „Bóg jest daleko i
mnie nie widzi”) wynurza się z ziemi. Ma trzy fazy:

1. **Ogniste strzały.** Pierścienie strzał co ~3,4 s; twierdza powoli sunie ku aniołowi.
2. **Łańcuchy kłamstwa** (od 66%). Cztery słupy z łańcuchami; dopóki stoją,
   twierdza jest nietykalna. Cios Samsona rani łańcuchy ×3. Twierdza przywołuje cienie.
3. **Drżenie** (od 33%). Szarże i gęstsze pierścienie strzał.

Skupienie przebija kłamstwo: przy mnożniku ×2 i więcej twierdza dostaje o 25%
więcej obrażeń. Upadek twierdzy: „Kłamstwo pęka”, zwolnienie czasu, deszcz światła,
potem **Objawienie** i **Raport dla Tronu** (zburzone cienie, najdłuższa seria,
najdłuższe czuwanie, upadki i powstania, światło, manna, ranga).

## 5. Świat i treść

Dziesięć sfer Drzewa (Malkut → Keter) i dwie krainy poboczne (Ród, Szeol): te same
rozdziały, historie Adama, kłamstwa, objawienia i wersety co w grze 2D. Treść
pochodzi z `web/game/src/content` i jest budowana do `assets/data/content.json`
(`npm run game3d:content`); test pilnuje, by była aktualna. Nowe w 3D są dary,
kolory aren i wstęp.

Drzewo Życia leży w ogrodzie jak mapa: złote ścieżki, kule sfer (złote ukończone,
białe otwarte, ciemne zamknięte), anioł przy wybranej sferze. Po Keter przychodzi
finał „Święty, Święty, Święty”.

## 6. Skupienie i opaska Mendi

Ten sam mechanizm co w grze 2D (`web/game/src/neuro/focus.ts`):

* poziom skupienia 0–1, próg 0,55; utrzymane skupienie podnosi mnożnik ×1 → ×1,5
  (8 s) → ×2 (18 s) → ×3 (32 s);
* **bez opaski** skupieniem jest bezruch (mnożnik do ×1,5);
* **z opaską** liczy się aktywacja kory przedczołowej, także w ruchu (do ×3);
  zły sygnał (ruch głowy, słaby kontakt) wstrzymuje wpływ opaski;
* krótka utrata skupienia (2,5 s) nic nie zmienia, potem mnożnik schodzi stopniami;
* jeden płomień to ok. 25 s skupienia przy ×1, ok. 8 s przy ×3.

Opaskę łączy się w menu tytułowym („Opaska Mendi”); Web Bluetooth działa w Chrome i
Edge (komputer, Android), na iPhonie w przeglądarce Bluefy. Dane zostają w urządzeniu.
To nie jest wyrób medyczny ani terapia.

## 7. Dźwięk

Muzyka „Psalm 150” jest syntezowana na żywo (lira, bęben, flet, szofar; osobny utwór
dla każdej sfery, warstwy zależne od walki; Szabat, twierdza i zwycięstwo mają własne
sceny). Efekty grają nuty bieżącego utworu (seria ciosów i rozbijane cienie wspinają
się po skali). Dźwięk rusza po pierwszym kliknięciu lub klawiszu. Głośność ogólną,
muzyki i efektów zmienia się w Ustawieniach (także w pauzie), a „Następny utwór” w pauzie.

## 8. Grafika

Wszystko jest proceduralne, jak w grze 2D: modele 3D (anioł z 2/4/6 skrzydłami,
14 cieni, twierdza, pociski, rekwizyty) powstają w kodzie (`tools/build-models.mjs`),
tekstury i ikony też (`tools/build-textures.mjs`). Niski poligon, ciepłe światło,
poświata (bloom) na świetle i oczach cieni, mgła w barwie rozdziału. Ustawienie
„Grafika: lekka” wyłącza poświatę i cienie (telefony).

## 9. Etyka i dostępność

* Przy pierwszym uruchomieniu: to gra modlitwy i nadziei, nie terapia; numery pomocy
  kryzysowej (116 123, 116 111, 800 70 2222, 112) zawsze w „Pomoc i bezpieczeństwo”.
* Traumy są abstrakcyjne (nazwy uczuć), bez przemocy wobec ludzi i bez drastycznych scen.
* Wstrząsy ekranu można wyłączyć; gra respektuje systemowe „ogranicz ruch”.
* Gra w poziomie; na telefonie w pionie pojawia się prośba o obrót.
* Gra jest darmowa, bez reklam i zakupów. Ekran startowy i znak „Made with GDevelop”
  zostają (ich usunięcie to funkcja płatnej subskrypcji GDevelop).

## 10. Architektura

Projekt GDevelop leży w `web/game3d/project` jako **projekt wieloplikowy** (każda
scena, zdarzenia zewnętrzne i rozszerzenie w osobnym JSON-ie) i otwiera się w
edytorze GDevelop. Szczegóły techniczne i polecenia: [README.md](README.md).

| Scena | Rola |
|---|---|
| `Title` | menu, panele: jak grać, opaska, ustawienia, pomoc |
| `Tree` | Drzewo Życia, wybór rozdziału, Owoce Ducha, Księga Prawdy |
| `Arena` | rozdział: fale, dary, Szabat, twierdza, upadek, pauza, HUD |
| `Revelation` | objawienie, raport, nagrody, finał |

Rozszerzenia: własne `HolyHoly` (treść, zapis, rzut 3D→ekran, przyciski i panele),
`Psalm150` i `MendiFocus` (biblioteki JS z kodu gry 2D i BrainLink) oraz oficjalne
z GDevelop: `FireBullet`, `SpriteMultitouchJoystick`, `ParticleEmitter3D`, `ShakeObject3D`.

Cały balans jest w zmiennej globalnej `Tuning` (wartości w §3–§4).

## 11. Co dalej

* własne modele i animacje (np. z Blendera) w miejsce proceduralnych,
* tryb bez końca („Czuwanie”: fale bez twierdzy, ranking najdłuższego skupienia),
* więcej rodzajów twierdz i aren, codzienne wyzwanie,
* wersja na telefony (eksport GDevelop do Androida/iOS) z natywnym Bluetooth,
* tłumaczenie interfejsu (dziś tylko po polsku).
