/**
 * Dawid's story words: the hills of Judah (1 Sam 16:14-23 and the she-bear), Polish — the source.  The king
 * cannot sleep and his servant seeks a harpist; a vineyard kept from the boars, Abishai and his shield, Jesse's
 * donkey with bread and a kid for the king (16:20), the harp in Saul's tent; the she-bear goes back to her cubs and
 * word comes of the Philistines in Elah.  Saul's trouble is told as a heavy unrest, gently; the harp is a rest.
 */
import type { LandWords } from './story';

export const PL: LandWords = {
  chapter: 'Kamieniste wzgórza Judy, winnice na zboczach i droga na północ. Król Saul nie sypia po nocach, a jego słudzy szukają kogoś, kto zagra mu na harfie.',
  areas: {
    winnice: { name: 'Winnice na zboczach', line: 'Tarasy z winoroślą, kamienne murki i świeże ślady racic. Ktoś tu nocą rył.' },
    trakt: { name: 'Królewski trakt', line: 'Droga przez góry na północ, do króla. Kurz, kamienie i żmije w rowach.' },
    przelecz: { name: 'Przełęcz przy obozie Saula', line: 'Po jednej stronie namioty króla, po drugiej gawra niedźwiedzicy. Idźmy cicho.' },
  },
  quests: {
    sluga: 'Porozmawiaj ze sługą króla',
    vines: 'Obroń winnicę przed dzikami',
    abiszaj: 'Znajdź Abiszaja przy drodze',
    donkey: 'Poprowadź osła z darami do króla',
    harp: 'Zagraj królowi na harfie',
  },
  things: {
    donkey: 'osioł z darami',
  },
  scenes: {
    open: [
      ['narrator', 'Kamieniste wzgórza Judy. Na tarasach dojrzewają winogrona, a w trawie śpią żmije.'],
      ['kobieta', 'Dziki ryją mi winnicę! Jeszcze jedna noc i zostaną same patyki.'],
      ['klebek', 'Dziki? Duże? Z kłami? Pytam z ciekawości. Naukowej.'],
      ['narrator', 'A na królewskim trakcie ktoś z dworu wypytuje o syna Jessego.'],
    ],
    sluga: [
      ['sluga', 'Szukam syna Jessego. To Ty? Mówią, że grasz na harfie i nie boisz się lwów.'],
      ['klebek', 'Prawda. To lew boi się jego. Ja jestem dowodem.'],
      ['sluga', 'Król Saul nie sypia po nocach. Ciężki niepokój siedzi mu na sercu. Potrzebna mu muzyka.'],
      ['dawid', 'Zagram mu. Ojciec wyśle ze mną dary dla króla.'],
      ['sluga', 'Dobrze. Król czeka w obozie przy przełęczy. Tylko uważaj po drodze na dziki.'],
    ],
    vines: [
      ['narrator', 'Ostatni dzik zmyka w krzaki, a za nim cała rodzina dzików, od największego do najmniejszego.'],
      ['kobieta', 'Winnica ocalona! Weźcie kosz winogron na drogę. Jagnię też może spróbować.'],
      ['klebek', 'Najpierw jedno winogrono. Dla sprawdzenia. Potem resztę, dla pewności.'],
    ],
    abiszaj: [
      ['abiszaj', 'Wujku! Asahel mówi, że idziesz do króla. Sam? Z jagnięciem? Bez tarczy?'],
      ['dawid', 'Z harfą, Abiszaju. Na koncert nie bierze się tarczy.'],
      ['abiszaj', 'Ja biorę zawsze. Ktoś musi pilnować wujka. Idę z Tobą.'],
      ['klebek', 'Tarcza większa od niego. Dobrze. W razie czego schowam się za nią.'],
    ],
    donkey: [
      ['narrator', 'Osioł Jessego niesie chleb i koźlę dla króla. Idzie wolno i staje przy każdym oście.'],
      ['klebek', 'Rusz się, ośle! Król czeka! …Nie patrz tak na mnie. Ja też jestem zwierzęciem.'],
      ['narrator', 'Przy kamieniu na rozstajach czekają ludzie króla. Zabierają dary i prowadzą Dawida dalej, ku przełęczy.'],
    ],
    harp: [
      ['narrator', 'W namiocie króla jest ciemno. Saul siedzi z głową w dłoniach i nie śpi od wielu nocy.'],
      ['saul', 'Graj. Może przy Tobie wreszcie odetchnę.'],
      ['narrator', 'Dawid trąca struny. Melodia płynie cicho jak potok nocą, a ramiona króla powoli opadają.'],
      ['saul', 'Zostań przy mnie. Odtąd nosisz moją broń.'],
      ['klebek', 'Giermek króla! A ja? Giermek giermka? Mogę nosić… ser.'],
    ],
    end: [
      ['narrator', 'Niedźwiedzica zabiera młode i odchodzi w głąb lasu. Przełęcz jest wolna.'],
      ['narrator', 'Zza gór przychodzi wieść: Filistyni stanęli w dolinie Ela, naprzeciw wojska Saula.'],
      ['jesse', 'Trzej Twoi bracia są w wojsku. Zanieś im chleb i sery i wróć z wieścią, jak się mają.'],
      ['klebek', 'Sery! Ja poniosę. Do pierwszego zakrętu. Potem zobaczymy.'],
    ],
  },
  choices: {
    harp: {
      a: 'Zagraj pieśń pasterzy',
      b: 'Zagraj cichą melodię',
      ra: [
        ['saul', 'Pieśń pasterzy… Kiedyś szukałem po tych górach oślic mojego ojca.'],
        ['narrator', 'Król uśmiecha się pierwszy raz od wielu tygodni.'],
      ],
      rb: [
        ['narrator', 'Struny ledwie szepczą. Robi się tak cicho, że słychać oddech króla. Saul zasypia.'],
        ['klebek', 'Ćśś. Ja też śpię. Prawie.'],
      ],
    },
  },
};
