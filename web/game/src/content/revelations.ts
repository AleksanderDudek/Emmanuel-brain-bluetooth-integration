/**
 * Revelations: lies many Christians believe, exposed when a chapter's stronghold falls
 * (2 Kor 10,4). One per chapter (ChapterDef.revelationId), plus a few the game can show
 * elsewhere (e.g. in the codex). Quotes in the prose are exact and checked by the tests.
 */
import type { Revelation } from '../types';
import { verse } from './bible';

export const REVELATIONS: Revelation[] = [
  // ─── one per chapter ───────────────────────────────────────────────
  {
    id: 'bog-widzi',
    lie: 'Bóg jest daleko i mnie nie widzi.',
    truth:
      'Bóg widział cię zawsze: w kołysce, w ciemności, przy każdej łzie, której nikt nie otarł. ' +
      'Nie jest daleko od żadnego z nas. Jest bliżej, niż sięga twój lęk.',
    verses: [verse('Rdz 16,13'), verse('Dz 17,27')],
  },
  {
    id: 'ojciec',
    lie: 'Bóg jest jak surowy ojciec, który tylko czeka, aż się potknę.',
    truth:
      'Bóg nie jest odbiciem ludzi, którzy cię zranili. Jest Ojcem, który wybiega naprzeciw, ' +
      'obejmuje i całuje, zanim padną słowa przeprosin. Lituje się nad tobą tak, jak dobry ojciec lituje się nad dzieckiem.',
    verses: [verse('Łk 15,20'), verse('Ps 103,13')],
  },
  {
    id: 'tozsamosc',
    lie: 'Jestem tym, co o mnie mówią.',
    truth:
      'Słowa innych mogą zranić, ale nie mają ostatniego słowa. Bóg zna cię po imieniu i mówi: „mójeś ty” (Iz 43,1). ' +
      'Twoje prawdziwe imię brzmi: umiłowane dziecko Boga.',
    verses: [verse('Iz 43,1'), verse('1 J 3,1')],
  },
  {
    id: 'milosc-rani',
    lie: 'Miłość zawsze rani. Lepiej nikogo nie kochać.',
    truth:
      'Ludzka miłość bywa krucha i potrafi zawieść. Boża miłość nie odstąpi od ciebie, nawet gdyby poruszyły się góry. ' +
      'Ona wypędza lęk i z czasem uczy serce znów ufać, mądrze i bezpiecznie.',
    verses: [verse('Iz 54,10'), verse('1 J 4,18')],
  },
  {
    id: 'zasluga',
    lie: 'Muszę zasłużyć na miłość Boga.',
    truth:
      'Nie można zasłużyć na to, co już zostało dane. Chrystus umarł za nas, gdy jeszcze nie mieliśmy nic do pokazania. ' +
      'Zbawienie jest darem łaski, nie nagrodą za wysiłek, więc możesz odpocząć.',
    verses: [verse('Ef 2,8-9'), verse('Rz 5,8')],
  },
  {
    id: 'przebaczenie',
    lie: 'Przebaczyć to udawać, że nic się nie stało.',
    truth:
      'Przebaczenie nie zaprzecza krzywdzie, tylko najpierw ją nazywa. Józef powiedział braciom: ' +
      '„Wyście złe myślili przeciwko mnie, ale Bóg obrócił to w dobre” (Rdz 50,20). ' +
      'Przebaczyć znaczy oddać sąd Bogu i przestać nosić truciznę, a nie wracać tam, gdzie wciąż jest niebezpiecznie.',
    verses: [verse('Rdz 50,20'), verse('Rz 12,19')],
  },
  {
    id: 'ma-dosc',
    lie: 'Upadłem za wiele razy. Bóg ma mnie dość.',
    truth:
      'Boże miłosierdzie nie wyczerpuje się, tylko odnawia się każdego poranka. ' +
      'Bóg nie trzyma gniewu na zawsze, bo kocha się w miłosierdziu. Gdy wracasz po raz setny, On wciąż wybiega ci naprzeciw.',
    verses: [verse('Lm 3,22-23'), verse('Mi 7,18')],
  },
  {
    id: 'smutek',
    lie: 'Chrześcijanin nie powinien się smucić ani prosić o pomoc.',
    truth:
      'Jezus płakał przy grobie przyjaciela, więc smutek nie jest brakiem wiary. ' +
      'Bóg jest blisko ludzi o złamanym sercu, a nam każe nosić nawzajem swoje ciężary. ' +
      'Gdy prosisz o pomoc przyjaciela, duszpasterza, psychologa czy lekarza psychiatrę, okazujesz mądrość i odwagę, a nie słabość.',
    verses: [verse('J 11,35'), verse('Ga 6,2'), verse('Ps 34,19')],
  },
  {
    id: 'duch-dla-wszystkich',
    lie: 'Duch Święty jest tylko dla wybranych, nie dla mnie.',
    truth:
      'Obietnica Ducha jest także dla tych, „którzy daleko są” (Dz 2,39). ' +
      'Ojciec daje Ducha Świętego tym, którzy Go proszą: nie najlepszym, lecz proszącym. Wystarczy otworzyć serce i poprosić.',
    verses: [verse('Łk 11,13'), verse('Dz 2,39')],
  },
  {
    id: 'przeszlosc',
    lie: 'Moja przeszłość mnie definiuje.',
    truth:
      'Twoja historia jest prawdziwa, ale nie jest twoim imieniem. W Chrystusie jesteś nowym stworzeniem i to, co stare, przeminęło. ' +
      'Ten, który siedzi na tronie, czyni wszystko nowe, także ciebie.',
    verses: [verse('2 Kor 5,17'), verse('Ap 21,5')],
  },
  {
    id: 'przodkowie',
    lie: 'Jestem skazany powtarzać grzechy przodków.',
    truth:
      'Każdy odpowiada za własne czyny: syn nie poniesie winy ojca. ' +
      'Chrystus wziął na siebie przekleństwo, abyśmy byli wolni, a w Nim zaczyna się nowe stworzenie. ' +
      'Możesz z wdzięcznością przyjąć dobro swojego rodu i z Bożą pomocą zakończyć to, co raniło.',
    verses: [verse('Ez 18,20'), verse('Ga 3,13'), verse('2 Kor 5,17')],
  },
  {
    id: 'za-gleboko',
    lie: 'Moja ciemność jest dla Boga za głęboka.',
    truth:
      'Chrystus zstąpił do najniższych miejsc ziemi, nawet do duchów w więzieniu, aby zanieść światło tam, gdzie nikt nie sięgał. ' +
      'Przyszedł szukać i zbawić to, co zginęło. Nie ma ciemności, do której Jego miłość nie mogłaby zejść.',
    verses: [verse('1 P 3,18-19'), verse('Łk 19,10'), verse('Ef 4,9')],
  },

  // ─── more lies, for the codex ──────────────────────────────────────
  {
    id: 'modlitwa',
    lie: 'Modlitwa działa jak zaklęcie: jeśli powiem ją idealnie, Bóg musi zadziałać.',
    truth:
      'Modlitwa nie jest formułką ani zapłatą, tylko rozmową dziecka z Ojcem, który wie, czego potrzebujesz, zanim poprosisz. ' +
      'Gdy brakuje ci słów, Duch Święty modli się w tobie. Liczy się serce, nie perfekcja.',
    verses: [verse('Mt 6,7-8'), verse('Rz 8,26')],
  },
  {
    id: 'cierpienie',
    lie: 'Moje cierpienie to kara od Boga.',
    truth:
      'Gdy uczniowie pytali, czyja wina sprawiła, że człowiek urodził się niewidomy, Jezus odpowiedział: ani jego, ani jego rodziców. ' +
      'Bóg nie znajduje radości w twoim bólu. Jest z tobą w cierpieniu i potrafi wyprowadzić z niego dobro.',
    verses: [verse('J 9,3'), verse('Lm 3,33')],
  },
  {
    id: 'male-sprawy',
    lie: 'Moje sprawy są dla Boga zbyt małe.',
    truth:
      'Bóg zna nawet liczbę włosów na twojej głowie. Możesz złożyć na Niego każdą troskę, dużą i małą, bo On troszczy się o ciebie. ' +
      'Nic, co dotyka twojego serca, nie jest dla Niego drobiazgiem.',
    verses: [verse('1 P 5,7'), verse('Mt 10,30')],
  },
  {
    id: 'slabosc',
    lie: 'Słabość to porażka. Nie wolno mi jej okazać.',
    truth:
      'Bóg powiedział Pawłowi: „Dosyć masz na łasce mojej” (2 Kor 12,9), bo Jego moc działa właśnie w słabości. ' +
      'Jezus rozumie nasze słabości, bo sam ich doświadczył. Możesz z ufnością przyjść po pomoc, gdy jej potrzebujesz.',
    verses: [verse('2 Kor 12,9'), verse('Hbr 4,15-16')],
  },
  {
    id: 'watpliwosci',
    lie: 'Jeśli mam wątpliwości, to znaczy, że nie mam wiary.',
    truth:
      'Ojciec chorego chłopca zawołał: „Wierzę, Panie! ty ratuj niedowiarstwa mego” (Mk 9,24), i Jezus mu pomógł. ' +
      'Gdy Piotr zaczął tonąć, Jezus od razu wyciągnął rękę. Wątpliwość nie wyrzuca cię z Bożych objęć; możesz przynieść ją do Niego.',
    verses: [verse('Mk 9,24'), verse('Mt 14,31')],
  },
];
