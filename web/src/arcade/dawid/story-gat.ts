/**
 * Dawid's story words: the land of Gath (1 Sam 21:10-15, 27, 30, the giant), Polish — the source.  Ittai, a
 * Philistine friend; David afraid before King Achish, playing the madman at the gate; the years between and the gift
 * of Ziklag; Ziklag found burnt and empty (nobody harmed, all taken, 30:2), David alone a while with God, then up;
 * the flock from the wolves, the families home with nothing missing and the spoil shared with those who stayed by
 * the brook Besor (30:24); Shammah's lentils; the giant flat on his face and the road back to the sheepfold.
 */
import type { LandWords } from './story';

export const PL: LandWords = {
  chapter: 'Ziemia Gat, ojczyzna olbrzymów. Tu, wśród Filistynów, Dawid szuka schronienia przed Saulem. Nie każdy Filistyn jest wrogiem, a jeden zostanie przyjacielem.',
  areas: {
    brama: { name: 'Brama Gat', line: 'Wysokie wrota miasta i straż w pióropuszach. Za bramą mieszka król Akisz.' },
    ziklag: { name: 'Siklag', line: 'Małe miasteczko na skraju pustyni: niskie mury, studnia i domy dla sześciuset rodzin.' },
    obozowisko: { name: 'Obozowisko olbrzymów', line: 'Namioty wielkie jak stodoły i włócznie grube jak belki. Ktoś tu jest bardzo duży.' },
  },
  quests: {
    itaj: 'Poznaj Itaja z Gat',
    achisz: 'Stań przed królem Akiszem',
    ziklag: 'Wróć do Siklag',
    flock: 'Uratuj stada przed wilkami',
    families: 'Odprowadź rodziny do domu',
    szamma: 'Szamma broni pola soczewicy',
  },
  things: {
    flock: 'stado z Siklag',
    families: 'rodziny z Siklag',
  },
  scenes: {
    open: [
      ['narrator', 'Ziemia Gat, ojczyzna olbrzymów. Dawid przychodzi tu, żeby ukryć się przed Saulem.'],
      ['klebek', 'Do Filistynów? Do olbrzymów? Mam pytanie: czy oni jedzą jagnięta?'],
      ['abiszaj', 'Nie wszyscy, jagnię. Ale trzymaj się blisko wujka.'],
    ],
    itaj: [
      ['itaj', 'Witaj w Gat! Jestem Itaj. U nas nie każdy jest olbrzymem. Ja na przykład jestem przyjacielem.'],
      ['itaj', 'Ale uważaj. Słudzy króla Akisza pamiętają pieśń o dziesiątkach tysięcy.'],
      ['klebek', 'Ta pieśń wszędzie nas wyprzedza. Jest szybsza niż Asahel.'],
      ['dawid', 'Dziękuję, Itaju. Będę ostrożny.'],
    ],
    achisz: [
      ['narrator', 'Słudzy prowadzą Dawida do króla Akisza. Dawid boi się, więc udaje szaleńca.'],
      ['achisz', 'To ma być ten wielki Dawid? Ten od pieśni?'],
      ['klebek', 'Udawaj szaleńca. Ja zagram zdziwione jagnię. To akurat umiem najlepiej.'],
    ],
    ziklag: [
      ['narrator', 'Mijają lata. Dawid wraca do Gat z sześciuset ludźmi, a Akisz daje mu miasteczko Siklag.'],
      ['narrator', 'Pewnego dnia, po trzech dniach drogi, Dawid wraca do domu. Siklag jest spalone i puste.'],
      ['abiszaj', 'Łupieżcy z pustyni zabrali kobiety, dzieci i cały dobytek. Nikomu nic się nie stało, ale nikogo nie ma.'],
      ['narrator', 'Ludzie płaczą, aż brak im sił. Niektórzy patrzą na Dawida z gniewem.'],
      ['narrator', 'Dawid zostaje chwilę sam, w ciszy, z Bogiem. Potem wstaje.'],
      ['dawid', 'Wstańcie. Pójdziemy za nimi. Odzyskamy wszystko.'],
    ],
    flock: [
      ['narrator', 'Wilki uciekają w pustynię. Owce i kozy z Siklag stoją razem, całe i zdrowe.'],
      ['klebek', 'Owce! Prawdziwe owce! Po tylu krainach czuję się jak w domu.'],
      ['abiszaj', 'Stada odzyskane. Teraz rodziny.'],
    ],
    families: [
      ['narrator', 'Łupieżcy uciekają na wielbłądach i porzucają wszystko, co zabrali.'],
      ['narrator', 'Rodziny wracają do Siklag. Nie brakuje nikogo, od najmłodszego do najstarszego.'],
      ['abigail', 'Wszyscy są. Wszyscy! Nawet koza sąsiadki.'],
      ['dawid', 'Ci przy potoku Besor pilnowali bagaży. Dostaną tyle samo co my. Dzielimy po równo.'],
      ['klebek', 'Po równo! Czyli ja też dostaję ser. Wreszcie sprawiedliwość dotarła na pustynię.'],
    ],
    szamma: [
      ['szamma', 'Stój! To pole soczewicy. Nie oddam go. Ani wilkom, ani olbrzymom. Nikomu.'],
      ['dawid', 'Nikt nie chce Ci go zabrać, Szammo. Chcemy pomóc.'],
      ['szamma', 'Pomóc? W obronie soczewicy? …To zmienia postać rzeczy. Idę z wami.'],
      ['klebek', 'Soczewica! Mówiłem, że kiedyś się przyda. Nie mówiłem? To teraz mówię.'],
    ],
    end: [
      ['narrator', 'Olbrzym z Gat pada jak długi, a jego obóz rozpierzcha się po wzgórzach.'],
      ['narrator', 'W Siklag znów płoną ogniska. Z łupu Dawid posyła dary starszym Judy, swoim sąsiadom.'],
      ['itaj', 'Jestem Filistynem, ale idę z Tobą. Na dobre i na złe.'],
      ['narrator', 'Wkrótce w Hebronie ludzie Judy namaszczą Dawida na króla. Ale to już inna opowieść.'],
      ['klebek', 'Pamiętasz owczarnię? Szakale, ciernie, lew. Od niej zaczęła się cała droga.'],
      ['klebek', 'Teraz idziemy jeszcze raz, od pastwisk. Ty z procą, ja z radami. Tylko nie daj się zjeść.'],
    ],
  },
  choices: {
    achisz: {
      a: 'Porysuj wrota bramy',
      b: 'Zaśpiewaj głupią piosenkę',
      ra: [
        ['narrator', 'Dawid drapie po wrotach bramy i ślini się na brodę. Strażnicy cofają się o krok.'],
        ['achisz', 'Mało mam szaleńców w Gat? Wyprowadźcie go!'],
      ],
      rb: [
        ['dawid', 'Beee, mee, olbrzym w kapeluszu, beee!'],
        ['achisz', 'Mało mam szaleńców w Gat? Wyprowadźcie go!'],
      ],
    },
  },
};
