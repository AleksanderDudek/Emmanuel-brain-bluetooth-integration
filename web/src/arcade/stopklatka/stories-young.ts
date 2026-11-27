/**
 * Stop-klatka — the stories for 20–26 (Polish, the source; en/de/sv in stories-young.<lang>.ts).  Contract: ./story.ts.
 *
 * Studies and first jobs, rent and a deposit, a flatmate, a date that does not come, the family's Sunday questions, the
 * tram and its inspectors, a dean's office window; online hate as `heavy`.  Second person present tense, no gendered
 * forms (narration capitalised: Ci/Cię/Twój; speech lowercase).
 */
import type { Story } from './story';

export const STORIES_YOUNG: readonly Story[] = [
  {
    id: 'young.flatmate',
    age: 'young',
    title: 'Lodówka',
    beats: [
      {
        place: 'kitchen', prop: 'plate', heat: 0.2,
        text: 'Wracasz po ośmiu godzinach zajęć. W lodówce miał czekać obiad ugotowany wczoraj na dwa dni.',
      },
      {
        place: 'kitchen', prop: 'plate', heat: 0.4,
        text: 'Pojemnik stoi w zlewie, pusty. Obok góra naczyń, ta sama od czwartku.',
      },
      {
        place: 'kitchen', people: [{ who: 'peer', mood: 'busy' }], heat: 0.6,
        text: 'Drzwi pokoju obok się otwierają. Pytasz o obiad.',
        say: 'A, to było twoje? Wyglądało na wspólne. Sorry.',
      },
      {
        place: 'bedroom', prop: 'clock', heat: 0.85,
        text: 'Północ. Jutro o ósmej egzamin. Zza ściany dudni muzyka, ktoś się śmieje, przychodzą kolejni goście.',
      },
    ],
    trigger: 'Coś w Tobie pęka. Wstajesz tak gwałtownie, że krzesło uderza o ścianę.',
    urge: 'Walnąć pięścią w drzwi i wykrzyczeć wszystko naraz: obiad, naczynia, muzykę.',
    feel: ['anger', 'tired', 'helpless'],
    second: [
      'Złość zbiera się od dni. Mówi: w tym mieszkaniu potrzebujesz zasad.',
      'Wszystko naraz, o północy, przy gościach, zabrzmi jak awantura, nie jak prośba.',
      'Dziś chodzi o jedno: ciszę przed egzaminem. Reszta może poczekać do jutra.',
    ],
    answer: 'Pukasz, czekasz, mówisz tylko o dzisiejszej nocy. O obiedzie i naczyniach proponujesz rozmowę jutro.',
    answerSay: 'Mam o ósmej egzamin. Ściszcie, proszę, po północy. Jutro pogadajmy o kuchni.',
    outcome: {
      place: 'kitchen', people: [{ who: 'peer', mood: 'sorry' }], prop: 'paper', heat: 0.25,
      text: 'Muzyka cichnie. Następnego dnia na lodówce wisi grafik zmywania. Obiadu nikt nie odda, za to pada „sorry”.',
      screen: 'GRAFIK ZMYWANIA · pn–nd',
    },
    lesson: 'Jedna sprawa naraz. Wszystko naraz brzmi jak atak.',
    verse: 'rom12.18',
  },
  {
    id: 'young.tram',
    age: 'young',
    title: 'Kontrola biletów',
    beats: [
      {
        place: 'bus', prop: 'phone', heat: 0.25,
        text: 'Tramwaj, 7:40, ścisk jak w puszce. Kupujesz bilet w aplikacji, jak zawsze. Kółko się kręci i kręci.',
        screen: 'Przetwarzanie płatności…',
      },
      {
        place: 'bus', people: [{ who: 'stranger', mood: 'cold' }], heat: 0.55,
        text: 'Na przystanku wsiada kontrola. Pokazujesz telefon z kręcącym się kółkiem.',
        say: 'Wszyscy tak mówią. Dokument poproszę.',
      },
      {
        place: 'bus', people: [{ who: 'stranger', mood: 'smirk' }, { who: 'group', mood: 'cold', at: 'right' }], heat: 0.8,
        text: 'Długopis już skrzypi nad mandatem. Ludzie się odsuwają. Telefon w Twojej dłoni pika: bilet kupiony. Minutę za późno.',
        say: 'Siódma pięćdziesiąt jeden. Za późno.',
      },
    ],
    trigger: 'Krew uderza do twarzy. Głos już się podnosi, a ręka podtyka telefon prawie pod nos.',
    urge: 'Nakrzyczeć, że to złodziejstwo, i nie podać dokumentu.',
    feel: ['anger', 'helpless', 'shame'],
    second: [
      'Złość mówi: to niesprawiedliwe. I być może masz rację.',
      'Ta osoba ma tu tylko swój regulamin. Odwołanie rozpatrzy ktoś inny, na spokojnie.',
      'Krzyk dziś nie zmieni mandatu. Zrzut ekranu i odwołanie mogą.',
    ],
    answer: 'Podajesz dokument. Robisz zrzut ekranu z godziną zakupu i spokojnie prosisz o wpisanie uwagi.',
    answerSay: 'Proszę wpisać, że płatność szła przed kontrolą. Odwołam się.',
    outcome: {
      place: 'street', prop: 'phone', heat: 0.3,
      text: 'Wieczorem wysyłasz odwołanie ze zrzutem ekranu. Odpowiedź przyjdzie za kilka tygodni. Dzień nie jest zmarnowany.',
      screen: 'Odwołanie wysłane · nr 2291/K',
    },
    lesson: 'Spór wygrywa się na piśmie, nie na przystanku.',
    verse: 'jas1.19-20',
  },
  {
    id: 'young.cafe',
    age: 'young',
    title: 'Sobota w kawiarni',
    beats: [
      {
        place: 'shop', people: [{ who: 'group', mood: 'busy' }], heat: 0.2,
        text: 'Sobota, kawiarnia przy rynku. Kolejka do drzwi, ekspres syczy, a druga osoba ze zmiany właśnie wyszła na przerwę.',
      },
      {
        place: 'shop', people: [{ who: 'client', mood: 'angry' }], prop: 'cup', heat: 0.4,
        text: 'Kubek wraca na ladę. Miało być mleko owsiane, jest zwykłe. Pomyłka jest Twoja, przyznajesz to.',
        say: 'Mówię wyraźnie: owsiane!',
      },
      {
        place: 'shop', people: [{ who: 'client', mood: 'shout' }], heat: 0.6,
        text: 'Robisz nową kawę, przepraszasz. To za mało. Głos rośnie, ludzie w kolejce patrzą.',
        say: 'Czy ty w ogóle umiesz coś zrobić dobrze?',
      },
      {
        place: 'shop', people: [{ who: 'boss', mood: 'cold' }], heat: 0.85,
        text: 'Z zaplecza wychodzi szef. Nie pyta, co się stało. Mówi przy wszystkich:',
        say: 'Przeproś jeszcze raz. Uczysz się, to słuchaj.',
      },
    ],
    trigger: 'Kark sztywnieje, w uszach dzwoni. Dłoń zaciska się na dzbanku z mlekiem.',
    urge: 'Postawić dzbanek z hukiem, zdjąć fartuch i wyjść w środku zmiany.',
    feel: ['anger', 'shame', 'helpless'],
    second: [
      'Masz prawo się złościć: jeden błąd nie daje nikomu prawa do takiego tonu.',
      'Klient może mieć zły dzień, szef pełną kolejkę. To nie usprawiedliwia, ale wyjaśnia.',
      'Fartuch możesz zdjąć jutro, na spokojnie, jeśli zechcesz. Nie teraz, nie w złości.',
    ],
    answer: 'Podajesz kawę spokojnie i obsługujesz kolejkę dalej. Po zmianie prosisz szefa o pięć minut w cztery oczy.',
    answerSay: 'Pomyłka była moja. Ale proszę, nie zwracaj mi uwagi przy klientach.',
    outcome: {
      place: 'shop', people: [{ who: 'boss', mood: 'tired' }], heat: 0.25,
      text: 'Po zmianie szef słucha do końca. Mówi, że sobota też go przerosła. Uwagi odtąd na zapleczu.',
      say: 'Masz rację. Następnym razem na zapleczu.',
    },
    lesson: 'Przyznaj się do błędu, ale nie pozwalaj się upokarzać.',
    verse: 'col3.15',
  },
  {
    id: 'young.sunday',
    age: 'young',
    title: 'Niedzielny obiad',
    beats: [
      {
        place: 'kitchen', people: [{ who: 'parent', mood: 'smile' }], prop: 'plate', heat: 0.2,
        text: 'Niedzielny obiad u rodziców. Rosół, ciasto i pytania. Pierwsze jak zwykle: kiedy przyjedziesz na dłużej?',
      },
      {
        place: 'kitchen', people: [{ who: 'parent', mood: 'busy' }], heat: 0.4,
        text: 'Opowiadasz o pracy w kawiarni i o kursie, który właśnie zaczynasz.',
        say: 'Kurs, kurs… A kiedy jakaś normalna praca?',
      },
      {
        place: 'kitchen', people: [{ who: 'parent', mood: 'cold' }], heat: 0.6,
        text: 'Przy cieście zaczyna się porównywanie.',
        say: 'A syn Nowaków już ma mieszkanie i awans w banku.',
      },
      {
        place: 'kitchen', people: [{ who: 'parent', mood: 'angry' }, { who: 'sibling', mood: 'smirk', at: 'right' }], heat: 0.85,
        text: 'Rodzeństwo chichocze nad talerzem. A potem zdanie, które słyszysz od lat:',
        say: 'Ty zawsze musisz wszystko po swojemu.',
      },
    ],
    trigger: 'Łyżeczka dzwoni o talerzyk. W piersi ściska tak samo jak przy tym stole dziesięć lat temu.',
    urge: 'Wykrzyczeć wszystkie stare żale naraz i wyjść bez pożegnania.',
    feel: ['hurt', 'anger', 'shame'],
    second: [
      'Pod tą złością jest pragnienie: żeby Twoja droga była widziana i szanowana.',
      'Za tymi pytaniami często stoi lęk o Ciebie, przebrany za porównania.',
      'Nie musisz dziś wygrać tej rozmowy. Wystarczy, że nie zgubisz w niej siebie.',
    ],
    answer: 'Odkładasz łyżeczkę. Mówisz spokojnie, co boli, i proponujesz inny temat albo krótki spacer.',
    answerSay: 'Wiem, że się martwicie. Ale porównania bolą. Opowiem wam o kursie, jeśli chcecie słuchać.',
    outcome: {
      place: 'kitchen', people: [{ who: 'parent', mood: 'sorry' }], heat: 0.25,
      text: 'Chwila ciszy. Potem pytanie o kurs, trochę niezgrabne. Nie wszystko jest naprawione, ale ten obiad kończy się dobrze.',
      say: 'No to opowiadaj. Czego tam uczą?',
    },
    lesson: 'Powiedz, co boli, zamiast udowadniać, kto ma rację.',
    verse: 'eph4.26',
  },
  {
    id: 'young.deposit',
    age: 'young',
    title: 'Kaucja',
    beats: [
      {
        place: 'screen', heat: 0.2,
        text: 'Miesiąc po wyprowadzce. Kaucji wciąż nie ma na koncie. Piszesz do właściciela już trzeci raz.',
        screen: 'Dzień dobry, kiedy mogę liczyć na zwrot kaucji?',
      },
      {
        place: 'screen', heat: 0.4,
        text: 'Odpowiedź po dwóch dniach. Potrącenie prawie całej kwoty: za ślady na ścianie i „zużycie”.',
        screen: 'Potrącam 1700\u00a0zł za malowanie i zniszczenia.',
      },
      {
        place: 'living', prop: 'paper', heat: 0.6,
        text: 'Wyjmujesz protokół z oddania kluczy. Podpisany przez obie strony, bez żadnych uwag.',
        screen: 'Ściany: stan dobry. Uwagi: brak.',
      },
      {
        place: 'screen', heat: 0.8,
        text: 'Kolejna wiadomość przychodzi, zanim zdążysz odpisać.',
        screen: 'Jak się nie podoba, zapraszam do sądu.',
      },
    ],
    trigger: 'Ręce drżą nad klawiaturą. W głowie już pisze się wiadomość pełna wielkich liter.',
    urge: 'Odpisać caps lockiem, co myślisz o takich ludziach, i wystawić złą opinię wszędzie.',
    feel: ['anger', 'helpless', 'fear'],
    second: [
      'Złość ma rację: 1700\u00a0zł to dla Ciebie mnóstwo pieniędzy, a protokół mówi swoje.',
      'Wiadomość pełna wyzwisk też będzie dowodem. Tylko że przeciw Tobie.',
      'Nie musisz odpowiadać teraz. Na spokojną odpowiedź masz cały wieczór.',
    ],
    answer: 'Wieczorem piszesz rzeczowo: prosisz o rozliczenie na piśmie z fakturami i załączasz protokół ze zdjęciami.',
    answerSay: 'Proszę o rozliczenie kaucji na piśmie, z fakturami. W załączniku protokół i zdjęcia.',
    outcome: {
      place: 'screen', heat: 0.3,
      text: 'Po tygodniu przychodzi przelew na 1200\u00a0zł. Nie wszystko. Ale wiesz już, gdzie zapytać o resztę, i to bez krzyku.',
      screen: 'Przelew przychodzący: 1200,00\u00a0zł',
    },
    lesson: 'Gdy ktoś gra nie fair, odpowiadaj na piśmie: krótko i rzeczowo.',
    verse: 'psa46.10',
  },
  {
    id: 'young.stamp',
    age: 'young',
    title: 'Okienko w dziekanacie',
    beats: [
      {
        place: 'queue', people: [{ who: 'group', mood: 'tired' }], prop: 'ticket', heat: 0.2,
        text: 'Dziekanat, ostatni dzień składania wniosków o stypendium. Masz numerek 47, na tablicy 31.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'busy' }], prop: 'paper', heat: 0.4,
        text: 'Po godzinie Twoja kolej. Wniosek wraca przez szparę pod szybą po kilku sekundach.',
        say: 'Brak pieczątki na drugiej stronie. Następny proszę.',
      },
      {
        place: 'corridor', prop: 'paper', heat: 0.6,
        text: 'Biegniesz na drugie piętro po pieczątkę i z powrotem. Schody, korytarz, zadyszka. Jest 12:58.',
      },
      {
        place: 'queue', people: [{ who: 'clerk', mood: 'cold' }], heat: 0.85,
        text: 'Okienko zamyka się tuż przed Tobą. Przez szybę widać, że w środku ktoś jeszcze siedzi.',
        say: 'Zamknięte. Zapraszam jutro.',
      },
    ],
    trigger: 'Serce wali po biegu i ze złości. Dłoń już się unosi, żeby uderzyć w szybę.',
    urge: 'Walić w szybę, aż ktoś otworzy, i powiedzieć, co się myśli o tym urzędzie.',
    feel: ['anger', 'helpless', 'fear'],
    second: [
      'Ta złość nie bierze się znikąd: stawka jest prawdziwa. Stypendium to Twoje pieniądze na życie.',
      'Za szybą też jest człowiek, który siedzi tu od ósmej i ma swoje zasady.',
      'Walenie w szybę zamknie te drzwi mocniej. Pytanie może je uchylić.',
    ],
    answer: 'Pukasz raz, delikatnie. Pokazujesz wniosek z pieczątką i pytasz, czy da się go złożyć dziś w inny sposób.',
    answerSay: 'Wiem, że już po czasie. Czy mogę zostawić wniosek w biurze podawczym z dzisiejszą datą?',
    outcome: {
      place: 'queue', people: [{ who: 'clerk', mood: 'tired' }], prop: 'paper', heat: 0.25,
      text: 'Za szybą chwila wahania. Potem stempel z datą: przyjęto. Bez uśmiechu, ale przyjęto.',
      say: 'Dobrze. Ale to wyjątek.',
    },
    lesson: 'Gdy drzwi się zamykają, zapytaj o inne drzwi, zanim w nie uderzysz.',
    verse: 'pro15.1',
  },
  {
    id: 'young.ghosted',
    age: 'young',
    title: 'Odwołana randka',
    beats: [
      {
        place: 'street', prop: 'phone', heat: 0.2,
        text: 'Trzecia randka, wreszcie. Stoisz przed kawiarnią dziesięć minut przed czasem i odświeżasz czat.',
      },
      {
        place: 'street', prop: 'phone', heat: 0.4,
        text: 'Mija dwadzieścia minut. Piszesz, że jesteś na miejscu. Wiadomość przeczytana. Odpowiedzi brak.',
        screen: 'jestem już na miejscu :) · Przeczytano 19:21',
      },
      {
        place: 'street', prop: 'phone', heat: 0.6,
        text: 'Po godzinie przychodzi jedno zdanie. Idziesz na przystanek i czujesz, jak wszystko w Tobie tężeje.',
        screen: 'sorry, nie czuję tego. powodzenia',
      },
      {
        place: 'screen', heat: 0.85,
        text: 'W autobusie otwierasz relacje. Ta osoba siedzi w barze ze znajomymi, uśmiechnięta. Od godziny.',
        screen: 'relacja · 1 godz. temu',
      },
    ],
    trigger: 'Gardło się ściska. Kciuki już szukają słów, które zranią tak, jak zraniono Ciebie.',
    urge: 'Napisać długą wiadomość o tym, jakim jest człowiekiem, i wysłać od razu.',
    feel: ['hurt', 'shame', 'anger'],
    second: [
      'Żal i złość mówią: zależy Ci na szacunku. Godzina czekania to brak szacunku.',
      'To, że ktoś nie umie powiedzieć „nie” w porę, mówi o tej osobie, nie o Twojej wartości.',
      'Wiadomość pisana w tej minucie zostanie w cudzym telefonie dłużej niż ta złość w Tobie.',
    ],
    answer: 'Chowasz telefon do kieszeni na całą drogę. W domu piszesz krótko albo wcale. I dzwonisz do kogoś bliskiego.',
    answerSay: 'Szkoda, że nie od razu. Trzymaj się.',
    outcome: {
      place: 'living', people: [{ who: 'friend', mood: 'calm' }], heat: 0.25,
      text: 'Wieczorem ktoś bliski słucha i nie ocenia. Wciąż boli. Ale Twoja wiadomość jest krótka i godna.',
      say: 'Zasługujesz na kogoś, kto przychodzi.',
    },
    lesson: 'Nie odpowiadaj na zranienie w minucie zranienia.',
    verse: 'pro19.11',
  },
  {
    id: 'young.comments',
    age: 'young',
    title: 'Komentarze',
    heavy: true,
    beats: [
      {
        place: 'bedroom', prop: 'laptop', heat: 0.2,
        text: 'Wrzucasz krótki film: pierwszy raz pokazujesz, jak rysujesz. Pół nocy przy montażu.',
      },
      {
        place: 'screen', heat: 0.4,
        text: 'Rano dwieście wyświetleń. Kilka miłych słów. I pierwszy komentarz od kogoś obcego.',
        screen: 'żenada. kto to w ogóle ogląda',
      },
      {
        place: 'screen', heat: 0.6,
        text: 'Pod nim kolejne. O Twoim głosie, o twarzy, o wszystkim, tylko nie o rysunku.',
        screen: 'lepiej pokazuj same ręce',
      },
      {
        place: 'screen', heat: 0.85,
        text: 'Ktoś udostępnia film u siebie, z podpisem. Wyświetlenia rosną. Śmiech rośnie.',
        screen: 'patrzcie na to xD',
      },
    ],
    trigger: 'Twarz płonie. Serce dudni w uszach. Palce już piszą odpowiedź pełną wyzwisk.',
    urge: 'Odpisać każdemu z osobna, tak samo okrutnie, albo skasować wszystko i zniknąć.',
    feel: ['shame', 'hurt', 'anger'],
    second: [
      'Wstyd i złość mówią: to, co robisz, jest dla Ciebie ważne. Dlatego tak boli.',
      'Obcy ludzie widzą kilka sekund. Nie znają Ciebie ani godzin przy rysowaniu.',
      'Odpowiedź w tej minucie nakarmi tę lawinę. Cisza i zgłoszenie mogą ją zatrzymać.',
    ],
    answer: 'Nie odpisujesz. Zgłaszasz komentarze, blokujesz konta, wyłączasz komentowanie i dzwonisz do kogoś bliskiego.',
    answerSay: 'Możesz wpaść? Potrzebuję dziś kogoś obok.',
    outcome: {
      place: 'living', people: [{ who: 'friend', mood: 'calm' }], heat: 0.3,
      text: 'Wieczorem ktoś bliski siedzi obok. Komentarze wciąż gdzieś są, ale Twój następny rysunek już leży na biurku.',
      say: 'Ty rysujesz. Oni tylko piszą.',
    },
    lesson: 'Na hejt nie odpowiadaj w gorącej minucie: zgłoś, zablokuj, zadzwoń do bliskich.',
    verse: '2ti1.7',
  },
];
