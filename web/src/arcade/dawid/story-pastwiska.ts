/**
 * Dawid's story words: the pastures of Bethlehem (1 Sam 16:1-13 and the lion), Polish — the source.  Samuel
 * comes to Jesse's house, the youngest is fetched from the sheep and anointed among his brothers; a lost lamb in
 * the thorns, a girl at the well, a jar of water for the old shepherd at the gate, Asahel, a ewe saved from the
 * wolves; the lion runs off and word comes that the king seeks a harpist.  Told in the game's own words: God's
 * words only through the verse ids, never in a quoted line.  The shape and the limits are in story.ts.
 */
import type { LandWords } from './story';

export const PL: LandWords = {
  chapter: 'Najmłodszy z ośmiu synów Jessego pasie owce ojca na wzgórzach Betlejem. Do miasta idzie prorok Samuel, a w gęstwinie za potokiem znowu czai się lew.',
  areas: {
    owczarnia: { name: 'Owczarnia Jessego', line: 'Kamienny murek, kolczasty żywopłot i sto owiec, które liczą na Ciebie.' },
    studnia: { name: 'Studnia przy bramie', line: 'Studnia Betlejem: najzimniejsza woda w całej Judzie. Przy bramie drzemie stary pasterz.' },
    potok: { name: 'Potok gładkich kamieni', line: 'Potok pełen okrągłych kamieni. Za nim gęstwina, a w gęstwinie ktoś ryczy.' },
  },
  quests: {
    lamb: 'Znajdź jagnię zagubione w cierniach',
    well: 'Porozmawiaj z dziewczyną przy studni',
    jar: 'Zanieś dzban wody staremu pasterzowi',
    asahel: 'Znajdź Asahela na wzgórzu',
    ewe: 'Uratuj owcę z jagnięciem przed wilkami',
  },
  things: {
    lamb: 'zagubione jagnię',
    jar: 'dzban wody',
  },
  scenes: {
    open: [
      ['narrator', 'Do domu Jessego przychodzi prorok Samuel. Przed nim staje siedmiu synów.'],
      ['samuel', 'To jeszcze nie ten. Masz jeszcze jakiegoś syna, Jesse?'],
      ['jesse', 'Został najmłodszy, Dawid. Pasie owce. Zawsze pachnie owcami.'],
      ['narrator', 'Dawid przybiega z pastwiska. Samuel namaszcza go oliwą pośrodku braci.'],
      ['eliab', 'On? Ten od owiec? Przecież to ja jestem najwyższy.'],
      ['klebek', 'Teraz pachnie oliwą. I owcami. Ale głównie oliwą.'],
    ],
    lamb: [
      ['klebek', 'Słyszysz to beczenie? To nie ja. Ja beczę ładniej.'],
      ['narrator', 'W cierniach siedzi małe jagnię, zaplątane po same uszy. Dawid ostrożnie je wyplątuje.'],
      ['klebek', 'Witaj w stadzie, mały. Zasada pierwsza: nie chodzimy w ciernie. Zasada druga: trzymamy się Dawida.'],
    ],
    well: [
      ['dziewczyna', 'To u was był prorok? Całe Betlejem o tym mówi.'],
      ['dawid', 'Był. Zjadł z nami kolację i poszedł. A ja wróciłem do owiec.'],
      ['dziewczyna', 'Dzban ciężki, a do domu daleko. Podobno grasz też na harfie?'],
      ['klebek', 'Gra. I nosi. Ale nie naraz.'],
    ],
    jar: [
      ['starzec', 'Woda ze studni przy bramie… Pił ją mój dziad i jego dziad. Dziękuję Ci z całego serca.'],
      ['starzec', 'Widziałem w nocy wilki przy potoku. Pilnuj owiec, bo idą po najmłodsze.'],
      ['klebek', 'Po najmłodsze? Ja jestem najmłodszy! Znaczy, prawie. Pilnujmy owiec.'],
    ],
    asahel: [
      ['asahel', 'Wujku! Słyszałem, że prorok był u dziadka. Teraz to już na pewno ścigamy się do lwa!'],
      ['dawid', 'Do lwa się nie ścigamy, Asahelu. Do lwa idziemy ostrożnie.'],
      ['asahel', 'Ostrożnie, ale szybko! Biegam szybciej niż gazela. Zobaczysz.'],
      ['klebek', 'Jeden biega jak gazela, drugi rzuca jak burza. A ja? Ja wspieram moralnie.'],
    ],
    ewe: [
      ['narrator', 'Wilki uciekają w zarośla. Owca z jagnięciem tuli się do nóg Dawida.'],
      ['klebek', 'Spokojnie, mamo. To jest Dawid. On tak zawsze: przychodzi, rzuca, wilki znikają.'],
      ['jesse', 'Dobrze pilnujesz stada, Dawidzie. Ale z gęstwiny słychać ryk. Lew jest blisko.'],
    ],
    end: [
      ['narrator', 'Lew dostaje kamieniem w nos i ucieka w góry. Owce wracają na pastwisko jedna po drugiej.'],
      ['jesse', 'Wszystkie owce całe. A Kłębek?'],
      ['klebek', 'Też cały. Dziękuję za troskę. Spóźnioną, ale zawsze.'],
      ['narrator', 'Wieczorem przychodzi wieść: król Saul nie sypia po nocach, a jego słudzy szukają kogoś, kto gra na harfie.'],
      ['klebek', 'Ty grasz na harfie! Ja śpiewam. Mniej więcej. Idziemy na wzgórza?'],
    ],
  },
  choices: {
    well: {
      a: 'Ponieś jej dzban do domu',
      b: 'Zagraj jej na harfie',
      ra: [
        ['dziewczyna', 'Dziękuję! Mama da Ci za to srebrnika. Albo dwa, jeśli jagnię nie zje jej chleba.'],
        ['klebek', 'Nie obiecuję.'],
      ],
      rb: [
        ['narrator', 'Przy studni robi się cicho. Nawet osły przestają ryczeć.'],
        ['dziewczyna', 'Pięknie… Teraz dzban sam się niesie.'],
      ],
    },
  },
};
