/**
 * Dawid's story words: the Valley of Elah (1 Sam 17 – 18:4, Goliath), Polish — the source.  Bread and cheeses
 * for the brothers and Eliab's temper, the soldiers' talk of the king's reward, Saul's armour, five smooth stones,
 * the giant's taunts and David's answer, Goliath flat on his face, Jonathan's cloak and bow.  David's answer to the
 * giant stays short ("I do not come alone"): the words of 17:45 come only through its verse id.
 */
import type { LandWords } from './story';

export const PL: LandWords = {
  chapter: 'Dolina Ela. Po jednej stronie obóz Izraela, po drugiej Filistyni, a pośrodku olbrzym z Gat, który od czterdziestu dni wyzywa całe wojsko.',
  areas: {
    oboz: { name: 'Obóz Izraela', line: 'Namioty na zboczu, wozy z bagażami i ogniska. Wojsko ma miny jak owce w burzę.' },
    terebint: { name: 'Dolina terebintu', line: 'Stary terebint i potok w dolinie. Tu leżą najgładsze kamienie w całej Judzie.' },
    pole: { name: 'Pole między wojskami', line: 'Na drugim zboczu stoją Filistyni, a przed nimi ktoś bardzo, bardzo duży.' },
  },
  quests: {
    bread: 'Zanieś Eliabowi chleb i sery',
    soldiers: 'Porozmawiaj z żołnierzami',
    saul: 'Idź do namiotu króla Saula',
    stones: 'Wybierz z potoku gładkie kamienie',
    goliath: 'Wyjdź naprzeciw olbrzyma',
    jonatan: 'Jonatan czeka na Ciebie',
  },
  things: {
    bread: 'chleb i sery',
    stone: 'gładki kamień',
  },
  scenes: {
    open: [
      ['narrator', 'Dolina Ela. Na jednym zboczu namioty Izraela, na drugim Filistyni, a pośrodku potok.'],
      ['narrator', 'Co rano i co wieczór z obozu Filistynów wychodzi olbrzym z Gat i krzyczy na całą dolinę.'],
      ['goliat', 'Dajcie mi jednego człowieka! Jednego! Czterdzieści dni czekam i nic.'],
      ['klebek', 'Beee… To jest człowiek? On ma włócznię jak wał tkacki. A ja mam ser.'],
    ],
    bread: [
      ['eliab', 'A Ty co tu robisz? Kto pilnuje owiec? Chcesz popatrzeć na bitwę, co?'],
      ['dawid', 'Przecież tylko pytam. Ojciec przysłał chleb i sery.'],
      ['eliab', 'Sery? …Dawaj. Ale i tak mnie złościsz.'],
      ['klebek', 'Eliab zjadł trzy sery. Ja zjadłem okruszki. Sprawiedliwość to rzadki gość w tej dolinie.'],
    ],
    soldiers: [
      ['zolnierz', 'Widzisz go? To Goliat z Gat. Wysoki jak dwóch ludzi, a jego zbroja waży tyle co osioł.'],
      ['zolnierz', 'Król obiecał: kto go pokona, dostanie bogactwa i córkę króla, a dom jego ojca nie zapłaci podatków.'],
      ['klebek', 'Bez podatków! Jesse się ucieszy. Może nawet bardziej niż z córki króla.'],
    ],
    saul: [
      ['saul', 'Taki młody, a on walczy od młodości. Jak chcesz z nim stanąć?'],
      ['dawid', 'Pasę owce, królu. Lew i niedźwiedzica też myśleli, że jestem mały.'],
      ['saul', 'Idź więc. Ale weź przynajmniej moją zbroję i mój hełm.'],
    ],
    stones: [
      ['narrator', 'Dawid chowa do pasterskiej torby pięć gładkich kamieni z potoku. Tylko pięć.'],
      ['klebek', 'Czemu pięć? Na zapas? Na wypadek, gdyby olbrzym miał braci?'],
      ['dawid', 'Wystarczy jeden. Resztę policz, żeby było Ci spokojniej.'],
    ],
    goliath: [
      ['goliat', 'Idziesz na mnie z kijem? Co ja jestem, pies? Przysłali mi pastuszka z kamykami!'],
      ['klebek', 'Beee… on mówi do nas. Nie odpowiadaj. Albo odpowiedz z daleka.'],
      ['dawid', 'Ty masz miecz, włócznię i giermka z tarczą. A ja nie przychodzę sam.'],
      ['narrator', 'Przed olbrzymem idzie giermek z wielką tarczą. Kamienie odbijają się od niej z brzdękiem.'],
      ['klebek', 'Obejdź go bokiem! Albo rzuć wielkim kamieniem: przelatuje nad tarczą.'],
    ],
    jonatan: [
      ['narrator', 'Po bitwie Dawid staje przed królem z procą w ręku. Obok króla stoi jego syn, Jonatan.'],
      ['jonatan', 'Jeszcze nikt tak nie zamknął ust olbrzymowi. Od dziś jesteśmy braćmi.'],
      ['narrator', 'Jonatan zdejmuje swój płaszcz, pas i łuk i daje je Dawidowi. Zawierają przymierze przyjaźni.'],
      ['klebek', 'Płaszcz królewicza! Mięciutki. Czy ja też mogę być w przymierzu? Chociaż trochę?'],
      ['jonatan', 'Ty też, jagnię. Ty przede wszystkim.'],
    ],
    end: [
      ['narrator', 'Kamień z procy trafia olbrzyma w czoło. Goliat pada jak długi, twarzą w trawę.'],
      ['narrator', 'Filistyni uciekają z doliny, a wojsko Izraela wraca do domów ze śpiewem.'],
      ['eliab', 'No dobrze… Dziś owce popilnuję ja.'],
      ['klebek', 'Jeden kamień. Jeden! Powtarzam wszystkim: jeden.'],
      ['narrator', 'Saul nie pozwala już Dawidowi wrócić do ojca. Zabiera go ze sobą do Gibei.'],
    ],
  },
  choices: {
    soldiers: {
      a: 'Kim on jest, żeby tak krzyczeć?',
      b: 'A co dostanie jagnię?',
      ra: [
        ['zolnierz', 'Kim? Olbrzymem. Olbrzymowi to wystarczy, żeby krzyczeć.'],
        ['dawid', 'Krzyczy na lud Boga. Długo już nie pokrzyczy.'],
      ],
      rb: [
        ['zolnierz', 'Jagnię? Hm… Pewnie miskę soczewicy.'],
        ['klebek', 'Soczewica! Biorę. Idziemy na olbrzyma.'],
      ],
    },
    saul: {
      a: 'Przymierz zbroję króla',
      b: 'Podziękuj, zostań przy procy',
      ra: [
        ['narrator', 'Dawid robi dwa kroki, dzwoni jak garnek i zdejmuje wszystko. W tym się nie da chodzić.'],
        ['klebek', 'Brzmiało to jak kuchnia przed ucztą. Lepiej idź w tunice.'],
      ],
      rb: [
        ['dawid', 'Dziękuję, królu. Ale ja chodzę w tunice, z kijem i z procą.'],
        ['saul', 'Rób, jak uważasz. Tylko wróć cały.'],
      ],
    },
  },
};
