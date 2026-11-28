/**
 * Dawid's story words: the wilderness of En-Gedi (1 Sam 21–25, the leopard), Polish — the source.  Bread and
 * Goliath's sword at Nob (told plainly: "chleby pokładne", the bread taken from the table), Benaiah, water from
 * the cave's drip, Saul in the cave and David who spares him, a kid saved from the caracals, Abigail's gifts and her
 * wise words to an angry David; then the road west to Gath.  Both of the cave's choices spare the king.
 */
import type { LandWords } from './story';

export const PL: LandWords = {
  chapter: 'Saul szuka Dawida po całej pustyni z trzema tysiącami wybranych ludzi. Dawid i jego czterystu chowają się wśród skał En-Gedi, gdzie bije źródło i skaczą kozice.',
  areas: {
    skaly: { name: 'Skały Dzikich Kóz', line: 'Skalne stopnie, kozice na półkach i karakale w szczelinach. Patrz pod nogi.' },
    jaskinia: { name: 'Jaskinia przy owczarniach', line: 'Kamienne owczarnie przy drodze, a za nimi ciemny otwór jaskini. W środku chłodno i cicho.' },
    zrodlo: { name: 'Źródło En-Gedi', line: 'Woda spada z wysokiej skały, wokół palmy i trzciny. Najpiękniejsze miejsce na pustyni.' },
  },
  quests: {
    achimelek: 'Idź do kapłana Achimeleka w Nob',
    benajasz: 'Znajdź Benajasza',
    cave: 'Ukryj się w jaskini',
    call: 'Zawołaj za królem ze wzgórza',
    water: 'Napełnij bukłaki w jaskini',
    abigail: 'Wyjdź naprzeciw Abigail',
    kid: 'Uratuj koźlę przed karakalami',
  },
  things: {
    water: 'bukłak wody',
    kid: 'koźlę',
    corner: 'róg płaszcza',
  },
  scenes: {
    open: [
      ['narrator', 'W jaskini Adullam zbierają się przy Dawidzie bracia, a za nimi strapieni, zadłużeni i rozgoryczeni.'],
      ['klebek', 'Czterystu nowych przyjaciół! Mam nadzieję, że żaden nie lubi jagnięciny.'],
      ['narrator', 'Z nimi Dawid idzie na pustynię En-Gedi, nad Morze Słone. Król Saul szuka go wszędzie.'],
      ['abiszaj', 'Wujku, czterystu ludzi i jedno źródło. Trzeba wody, chleba i trochę spokoju.'],
      ['klebek', 'I sera. Czterysta serów. No dobrze, trzysta. Ja przecież jem mało.'],
    ],
    achimelek: [
      ['narrator', 'Głodny i bez broni Dawid zachodzi do Nob, miasta kapłanów. Jego ludzie czekają w ukryciu.'],
      ['achimelek', 'Sam? Bez ludzi? Co się stało?'],
      ['dawid', 'Pilna sprawa, kapłanie. Masz trochę chleba na drogę?'],
      ['achimelek', 'Mam tylko chleby pokładne, zdjęte dziś ze stołu. Weź je. I miecz olbrzyma, owinięty w płaszcz.'],
      ['klebek', 'Miecz Goliata? Dwa razy dłuższy ode mnie. I cięższy od nas obu.'],
    ],
    benajasz: [
      ['benajasz', 'Jestem Benajasz. Słyszałem, że zbierasz ludzi, którzy się nie boją.'],
      ['klebek', 'Nie boisz się? Niczego? Nawet lwa?'],
      ['benajasz', 'W śnieżny dzień zszedłem kiedyś do jamy, w której siedział lew. I wyszedłem z niej sam.'],
      ['klebek', 'Ja kiedyś byłem w paszczy lwa. Też wyszedłem. Z pomocą. Mamy coś wspólnego.'],
    ],
    cave: [
      ['narrator', 'Saul z wojskiem staje przy owczarniach. Sam wchodzi do jaskini, nie wiedząc, kto siedzi w głębi.'],
      ['abiszaj', 'Wujku, to on! Sam, bez straży. Taka chwila się nie powtórzy.'],
      ['dawid', 'Nie podniosę ręki na króla. Nie mnie go sądzić.'],
      ['klebek', 'Ćśś. On odpoczywa. My oddychamy cicho. Bardzo cicho.'],
    ],
    call: [
      ['narrator', 'Saul wychodzi z jaskini i idzie swoją drogą. Dawid wybiega za nim na wzgórze i woła.'],
      ['dawid', 'Królu, mój panie! Byłem tuż obok Ciebie w jaskini i nie podniosłem na Ciebie ręki.'],
      ['saul', 'Dawid? To Ty? …Synu, masz w sercu więcej dobra niż ja.'],
      ['narrator', 'Saul płacze. Potem zawraca z wojskiem do domu.'],
      ['klebek', 'Król płacze, ja płaczę, nawet kozice mają mokre oczy. Dobry dzień.'],
    ],
    water: [
      ['narrator', 'Ze stropu jaskini kapie woda, kropla po kropli. Trzy bukłaki pełne.'],
      ['abiszaj', 'Kropla do kropli i ludzie mają co pić. Dobra robota, wujku.'],
      ['klebek', 'Ja wypiłem tylko jeden łyk. Duży. Bardzo duży. Ale jeden.'],
    ],
    abigail: [
      ['narrator', 'Bogaty Nabal z Karmelu odprawił ludzi Dawida z niczym, choć strzegli jego stad. Dawid wpada w gniew.'],
      ['narrator', 'Ale drogą nadjeżdża na osiołku Abigail, żona Nabala, z chlebem, rodzynkami i plackami figowymi.'],
      ['abigail', 'Panie, nie zważaj na Nabala. Jego imię znaczy „głupiec” i on taki jest.'],
      ['abigail', 'Nie bierz na siebie krzywdy, której potem będzie Ci żal. Przyjmij te dary.'],
      ['dawid', 'Dziękuję za Twoją mądrość. Zatrzymujesz mnie przed złym krokiem.'],
      ['klebek', 'Placki figowe! Ona wie, jak rozmawiać z drużyną.'],
    ],
    kid: [
      ['narrator', 'Karakale uciekają w szczeliny. Na skalnej półce drży małe koźlę.'],
      ['klebek', 'Spokojnie, mały. Ja też kiedyś byłem w kłopocie. Teraz chodzę z Dawidem i jest dobrze.'],
      ['narrator', 'Koźlę skacze do matki. Kozica długo patrzy na Dawida, a potem obie znikają w skałach.'],
    ],
    end: [
      ['narrator', 'Lampart skacze na skałę i znika za grzbietem. Ścieżka na zachód, do ziemi Gat, otwarta.'],
      ['dawid', 'Saul nie przestanie mnie szukać. Pójdę tam, gdzie mnie nie szuka: do Filistynów.'],
      ['abigail', 'Pójdziemy z Tobą. Zapasów starczy na drogę.'],
      ['klebek', 'Do Gat? Tam, gdzie mieszkają olbrzymi? Dobrze. Ale idę w samym środku drużyny.'],
    ],
  },
  choices: {
    cave: {
      a: 'Odetnij róg płaszcza',
      b: 'Odejdź cicho w głąb jaskini',
      ra: [
        ['narrator', 'Dawid odcina róg królewskiego płaszcza. Saul niczego nie czuje.'],
        ['klebek', 'Róg płaszcza. Najdroższa łatka w całym Izraelu.'],
      ],
      rb: [
        ['narrator', 'Dawid cofa się w ciemność. Saul wstaje, poprawia płaszcz i wychodzi, niczego nie wiedząc.'],
        ['klebek', 'Nikt nie wie, jak blisko był. Tylko my. I to wystarczy.'],
      ],
    },
  },
};
