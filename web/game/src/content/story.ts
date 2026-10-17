/**
 * Story text: title, first-launch notice, crisis lines, intro, falls, finale, the support note,
 * whispers between rooms and the Sabbath room. Scripture quoted inside prose is written
 * „exact words” (Ref) and checked against BIBLE by the tests.
 *
 * Crisis lines verified on 2026-10-17 on the operators' own pages and on gov.pl:
 *   116 123      https://116sos.pl ("dostępny 24/7"; also chat 24/7), listed on
 *                https://www.gov.pl/web/zdrowie/gdzie-uzyskac-pomoc-psychologiczna-i-psychiatryczna
 *   116 111      https://116111.pl ("codziennie – 7 dni w tygodniu, 24 godziny na dobę"), Fundacja Dajemy Dzieciom Siłę
 *   800 70 2222  https://centrumwsparcia.pl ("Całodobowo", "Bezpłatnie"), run by Fundacja ITAKA (per gov.pl)
 *   112          European emergency number
 * Re-check them before each release: hours and operators change.
 */
import type { StoryText } from '../types';
import { verse } from './bible';

export const STORY: StoryText = {
  titleVerse: verse('Iz 6,3'),

  disclaimer:
    'HolyHolyHoly to gra modlitwy i nadziei. Nie jest terapią ani leczeniem i nie zastąpi pomocy specjalisty. ' +
    'O zranieniach opowiada delikatnie, bez drastycznych scen. ' +
    'Jeśli nosisz w sobie ciężkie rany, porozmawiaj z kimś, komu ufasz: z przyjacielem, z duszpasterzem (księdzem albo pastorem), ' +
    'z psychologiem lub lekarzem psychiatrą. Sięgnięcie po pomoc to odwaga, nie słabość.',

  crisisHelp: [
    'Jeśli przeżywasz kryzys, nie zostawaj z tym w pojedynkę. W Polsce możesz zadzwonić bezpłatnie:',
    '116 123: telefon zaufania dla dorosłych w kryzysie emocjonalnym, całą dobę (czat: 116sos.pl)',
    '116 111: telefon zaufania dla dzieci i młodzieży, całą dobę (116111.pl)',
    '800 70 2222: Centrum Wsparcia dla Osób Dorosłych w Kryzysie Psychicznym, całą dobę (centrumwsparcia.pl)',
    '112: numer alarmowy, gdy zagrożone jest czyjeś życie lub zdrowie',
    'Poza Polską zadzwoń pod lokalny numer alarmowy. Numery sprawdzone w październiku 2026 roku.',
  ].join('\n'),

  intro: [
    'Przed tronem Boga panuje cisza pełna światła. W tej ciszy Pan woła ciebie, anioła stróża.',
    '„Aniołom swoim przykazał o tobie, aby cię strzegli na wszystkich drogach twoich” (Ps 91,11). ' +
      'Dziś Bóg powierza ci człowieka. Ma na imię Adam.',
    'Adam po hebrajsku znaczy „człowiek”. Mógłby być każdym z nas. ' +
      'Nosi rany z dzieciństwa, z domu, ze szkoły i z miłości, która zawiodła. Niektóre bolą tak długo, że zamieniły się w cienie.',
    'Cienie krążą po jego życiu i szepczą kłamstwa: że jest sam, że musi zasłużyć na miłość, że Bóg jest daleko. ' +
      'Za nimi wznoszą się twierdze, wielkie kłamstwa, w które Adam uwierzył.',
    'Oto twoja misja: przejdź przez życie Adama, od Królestwa aż do Korony. Stań w ciszy i mów Słowem, a cienie osłabną. ' +
      'Wtedy je pochłoń i przetraw, bo każda rana może stać się prawdą.',
    'Szukaj zagubionych odłamków jego duszy. Burz twierdze kłamstwa. Po każdym etapie wróć przed tron i zdaj sprawę z drogi.',
    'Gdy zabraknie ci sił, módl się. Łaska jest darmowa, a modlitwa otwiera drogi, których jeszcze nie widzisz. Pan idzie z tobą.',
  ],

  fall: [
    '„Jeźli siedzę w ciemnościach, Pan jest światłością moją” (Mi 7,8). Upadek nie jest końcem. Wstań, On już podaje ci rękę.',
    '„Bo choć siedm kroć upada sprawiedliwy, przecie zaś powstaje” (Prz 24,16). Siedem razy, siedemdziesiąt siedem razy: wstajemy dalej.',
    '„Gdy padnie, nie stłucze się: albowiem Pan trzyma go za rękę jego” (Ps 37,24). Nie ma w tym wstydu. Odpocznij chwilę i spróbuj jeszcze raz.',
    'Cień szepcze: „To koniec”. Bóg mówi: „To dopiero początek”. Wstań i idź dalej.',
    'Łaska nie kończy się po pierwszym upadku. Ani po setnym. Weź głęboki oddech i spróbuj jeszcze raz.',
  ],

  finale: [
    'Ostatnia twierdza upada. Nad Koroną rozlewa się światło, którego nie da się opisać słowami.',
    'Adam stoi w progu domu Ojca. Jego rany stały się bliznami, a blizny świadectwem łaski. ' +
      'Niesie w sercu prawdy znalezione po drodze: Ufność, Godność, Nadzieję, Przebaczenie i Wolność.',
    'Ojciec wybiega mu naprzeciw, obejmuje go i nie pozwala dokończyć przeprosin. Mówi tylko: „Jesteś mój. Jesteś w domu”.',
    'Stajesz przed tronem razem z niezliczonymi aniołami. Serafini zakrywają twarze skrzydłami i wołają jeden do drugiego: ' +
      '„Święty, święty, święty, Pan zastępów; pełna jest wszystka ziemia chwały jego” (Iz 6,3).',
    'A „otrze Bóg wszelką łzę z oczów ich; a śmierci więcej nie będzie, ani smutku, ani krzyku, ani boleści nie będzie” (Ap 21,4-5). ' +
      'Ten, który siedzi na tronie, mówi: „Oto wszystko nowe czynię” (Ap 21,5).',
    'Dziękujemy za wspólną drogę. Adam jest w domu. Ty także.',
  ],

  support:
    '„Darmoście wzięli, darmo dawajcie” (Mt 10,8). Ta gra jest i zawsze będzie darmowa. ' +
    'Łaski nie da się kupić, a modlitwa nie jest tu zapłatą, lecz odpowiedzią serca, która otwiera nowe drogi. ' +
    'Aureole, szaty i skrzydła odblokowujesz modlitwą i grą, nie pieniędzmi. ' +
    'Jeśli zechcesz wesprzeć tę służbę, dobrowolny dar będzie prezentem, nigdy warunkiem. Dziękujemy za każdą modlitwę.',

  whispers: [
    verse('Iz 41,10'),
    verse('Iz 43,1'),
    verse('Iz 43,2'),
    verse('Iz 49,16'),
    verse('Iz 54,10'),
    verse('Wj 14,14'),
    verse('Ps 46,11'),
    verse('Mt 11,28'),
    verse('J 14,27'),
    verse('J 14,18'),
    verse('J 15,9'),
    verse('J 10,28'),
    verse('J 16,33'),
    verse('Iz 46,4'),
    verse('Ap 3,20'),
    verse('J 1,5'),
    verse('Ps 34,19'),
    verse('Lm 3,22-23'),
    verse('2 Kor 12,9'),
    verse('Ps 147,3'),
    verse('Ps 103,12'),
    verse('Iz 42,3'),
    verse('Rz 5,8'),
    verse('1 J 4,18'),
    verse('J 6,37'),
    verse('Mt 10,30'),
    verse('Ap 21,5'),
    verse('Iz 40,31'),
  ],

  sabbath:
    'Tu możesz odpocząć: usiądź, oddychaj powoli i pozwól sercu się wyciszyć. ' +
    '„Uspokójcie się, a wiedzcie, żem Ja Bóg” (Ps 46,11). ' +
    'Jezus mówi: „Pójdźcie do mnie wszyscy, którzyście spracowani i obciążeni, a Ja wam sprawię odpocznienie” (Mt 11,28).',
};
