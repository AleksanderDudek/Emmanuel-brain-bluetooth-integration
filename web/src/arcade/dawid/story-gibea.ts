/**
 * Dawid's story words: the fields of Gibeah (1 Sam 18–20, the great aurochs), Polish — the source.  The women's
 * song and Saul's jealousy (the spear in the wall, a dodge), Michal's warning and the rope at the window, a
 * widow's barley kept from the aurochs calves, Jonathan's plan by the stone Ezel, the three arrows, the farewell;
 * then the flight to the cave of Adullam and the four hundred.  The song is told in narration, never as a quote.
 */
import type { LandWords } from './story';

export const PL: LandWords = {
  chapter: 'Gibea, miasto króla Saula. Kobiety śpiewają o Dawidzie głośniej niż o królu, a król patrzy na to coraz chmurniej. Tylko Jonatan stoi przy przyjacielu.',
  areas: {
    pola: { name: 'Pola jęczmienia', line: 'Jęczmień po pas, miedze i ścieżki. Młode tury też uważają, że jęczmień jest pyszny.' },
    mury: { name: 'Mury Gibei', line: 'Mury miasta króla, a w murze okno domu Mikal. Wysoko. Bardzo wysoko.' },
    ezel: { name: 'Kamień Ezel', line: 'Wielki kamień pośrodku pola. Dobre miejsce, żeby się schować. I żeby czekać.' },
  },
  quests: {
    women: 'Posłuchaj pieśni kobiet',
    rope: 'Znajdź mocny sznur',
    mikal: 'Idź pod okno Mikal',
    barley: 'Obroń jęczmień wdowy przed dzikami',
    ezel: 'Spotkaj Jonatana przy kamieniu Ezel',
    arrows: 'Przynieś strzały Jonatana',
    farewell: 'Pożegnaj się z Jonatanem',
  },
  things: {
    rope: 'mocny sznur',
    arrow: 'strzała Jonatana',
  },
  scenes: {
    open: [
      ['narrator', 'Gibea, miasto króla Saula. Dawid mieszka teraz na dworze i chodzi z wojskiem na wyprawy.'],
      ['jonatan', 'Gdzie Cię ojciec pośle, tam Ci się udaje. Ludzie Cię kochają. Ja też.'],
      ['narrator', 'Ale król patrzy na Dawida coraz chmurniej i coraz częściej ściska włócznię.'],
      ['klebek', 'Nie podoba mi się ta włócznia. Jest za blisko i za często.'],
    ],
    women: [
      ['narrator', 'Z miast wychodzą kobiety z bębenkami i tańczą na powitanie wojska.'],
      ['narrator', 'Śpiewają, że Saul ma swoje tysiące, a Dawid swoje dziesiątki tysięcy. Król słucha i chmurnieje.'],
      ['saul', 'Jemu dziesiątki tysięcy, mnie tysiące. Brakuje mu jeszcze tylko królestwa.'],
      ['narrator', 'Następnego dnia, gdy Dawid gra, król ciska włócznią. Włócznia wbija się w ścianę. Dawid robi unik.'],
      ['klebek', 'Beee! To nie była nuta! To była włócznia!'],
    ],
    rope: [
      ['narrator', 'Pod murem, w stercie siana, leży mocny, długi sznur. Akurat taki, jaki trzeba.'],
      ['mikal', 'Dawidzie, ludzie ojca stoją pod drzwiami. Jeśli nie uciekniesz tej nocy, rano będzie za późno.'],
      ['klebek', 'Sznur, mur, okno i noc. Mam złe przeczucie. I lęk wysokości.'],
    ],
    mikal: [
      ['narrator', 'Mikal, córka króla i żona Dawida, przywiązuje sznur w oknie od strony muru.'],
      ['mikal', 'W łóżku położę kukłę z poduszką z koziej sierści. Powiem, że masz gorączkę.'],
      ['klebek', 'Kukła z koziej sierści? Będzie bardziej podobna do mnie niż do Ciebie.'],
    ],
    barley: [
      ['narrator', 'Dziki uciekają z pola, kwicząc na pożegnanie.'],
      ['kobieta', 'Mój jęczmień! Cały! Nie mam męża ani syna, mam tylko to pole. Dziękuję Ci.'],
      ['klebek', 'Pole całe, wdowa szczęśliwa, dziki obrażone. Tak lubię.'],
    ],
    ezel: [
      ['jonatan', 'Jutro nów i uczta u ojca. Twoje miejsce przy stole będzie puste. Zobaczę, co ojciec powie.'],
      ['jonatan', 'Ukryj się przy tym kamieniu. Wystrzelę trzy strzały i poślę chłopca, żeby je przyniósł.'],
      ['jonatan', 'Jeśli zawołam: strzały są bliżej, wracaj spokojnie. Jeśli zawołam: dalej, uciekaj.'],
      ['klebek', 'Prosty plan. Lubię proste plany. Pod warunkiem, że nikt nie celuje w jagnięta.'],
    ],
    arrows: [
      ['chlopiec', 'Trzy strzały! Dziękuję. Sam szukałbym ich do wieczora.'],
      ['jonatan', 'Ostatnia poleciała dalej… Dużo dalej, niż bym chciał.'],
      ['narrator', 'Dawid rozumie znak. Dalej znaczy: uciekaj. Król chce jego zguby.'],
      ['klebek', 'Nie lubię słowa „dalej”. Jest smutne. I daleko.'],
    ],
    farewell: [
      ['narrator', 'Chłopiec odchodzi ze strzałami do miasta. Dawid wychodzi zza kamienia.'],
      ['narrator', 'Przyjaciele obejmują się i płaczą. Dawid płacze bardziej.'],
      ['jonatan', 'Idź w pokoju. Cokolwiek się stanie, zostaniemy przyjaciółmi: my i nasze dzieci.'],
      ['dawid', 'Nie zapomnę Ci tego, Jonatanie. Nigdy.'],
      ['klebek', 'Ja nie płaczę. To kurz. Polny.'],
    ],
    end: [
      ['narrator', 'Wielki tur parska i gna w step. Droga na południe, na pustynię, stoi otworem.'],
      ['klebek', 'Droga wolna. Ale zanim pójdziemy… Jonatan czeka przy kamieniu.'],
      ['narrator', 'Dawid wie, co znaczy ostatnia strzała. Idzie się pożegnać.'],
    ],
  },
  choices: {
    mikal: {
      a: 'Zejdź po sznurze',
      b: 'Najpierw jagnię, w koszyku',
      ra: [
        ['narrator', 'Dawid zsuwa się po sznurze i znika w ciemności. Mikal macha mu z okna.'],
      ],
      rb: [
        ['klebek', 'W koszyku? Ja? …Dobrze. Ale powoli. I nie patrzę w dół.'],
        ['narrator', 'Kosz z jagnięciem zjeżdża pierwszy, a za nim Dawid. Nikt niczego nie słyszy.'],
      ],
    },
  },
};
